#!/usr/bin/env ruby
# frozen_string_literal: true

require "fileutils"
require "open-uri"

# Config
GFS_BASE_URL = "https://nomads.ncep.noaa.gov/pub/data/nccf/com/gfs/prod"
# 1.0° GFS file pattern; adjust cycle (00/12) via CRON or logic below.
GFS_PRODUCT   = "gfs"
GRID_RES      = "1p00"
FORECAST_HOUR = "f000" # analysis

ROOT          = File.expand_path("..", __dir__) # backend/
DATA_DIR      = File.join(ROOT, "public", "data", "weather", "current")
TMP_DIR       = File.join(ROOT, "tmp", "gfs")
GRIB2JSON     = ENV["GRIB2JSON"] || "grib2json" # path to grib2json script

FileUtils.mkdir_p(DATA_DIR)
FileUtils.mkdir_p(TMP_DIR)

def log(msg)
  $stdout.puts "[#{Time.now.utc.iso8601}] #{msg}"
end

def run!(cmd)
  log "RUN: #{cmd}"
  success = system(cmd)
  raise "Command failed: #{cmd}" unless success
end

# Choose cycle: run script twice a day, target 00Z & 12Z
def current_cycle
  now = Time.now.utc
  hour = now.hour < 12 ? "00" : "12"
  [now.strftime("%Y%m%d"), hour]
end

def gfs_url(date, cycle)
  "#{GFS_BASE_URL}/#{GFS_PRODUCT}.#{date}/#{cycle}/atmos/" \
    "gfs.t#{cycle}z.pgrb2.#{GRID_RES}.#{FORECAST_HOUR}"
end

def local_grib_path(date, cycle)
  File.join(TMP_DIR, "gfs.t#{cycle}z.pgrb2.#{GRID_RES}.#{FORECAST_HOUR}.grib2")
end

date, cycle = current_cycle
log "Fetching GFS #{GRID_RES} for #{date} #{cycle}Z"

grib_path = local_grib_path(date, cycle)
url       = gfs_url(date, cycle)

# 1. Download GRIB2 if not already present
unless File.exist?(grib_path)
  log "Downloading GRIB2 from #{url}"
  URI.open(url) do |r|
    File.open(grib_path, "wb") { |f| IO.copy_stream(r, f) }
  end
else
  log "Using cached GRIB2 #{grib_path}"
end

# Helper to convert a GRIB2 parameter/level to JSON
# Uses grib2json filters for parameter & surface type/value.
def convert_to_json(grib_path:, output_path:, fp:, fs:, fv:)
  FileUtils.mkdir_p(File.dirname(output_path))
  cmd = [
    GRIB2JSON,
    "--data",
    "--names",
    "--compact",
    "--filter.parameter", fp.to_s,
    "--filter.surface",   fs.to_s,
    "--filter.value",     fv.to_s,
    "--output",           output_path,
    grib_path
  ].join(" ")
  run!(cmd)
end

# GRIB2 codes:
# UGRD: parameterNumber 2, VGRD: 3 (category 2), TMP: 0 (category 0), RH: 1 (category 1) depending on table.
# grib2json lets you filter by parameter number only when category is implied by the file's metadata.[web:114][web:124]
#
# Surface types:
# 103 = specified height above ground (e.g. 10 m)
# 100 = isobaric surface (hPa)
# 1   = surface (ground or water)[web:124][web:128]
#
# For clarity, we call grib2json separately by parameter/level.

# 2a. Surface wind (already have, but keep here for completeness)
log "Converting surface wind (10 m) to JSON"
convert_to_json(
  grib_path:   grib_path,
  output_path: File.join(DATA_DIR, "current-wind-surface-level-gfs-1.0.json"),
  fp:          2,    # UGRD
  fs:          103,  # 10 m above ground
  fv:          10.0
)
# You may also want VGRD at 10 m; earth.nullschool combines U/V records client-side.

# Helper to build standard filename
def out_name(var, level_hpa)
  "current-#{var}-isobaric-#{level_hpa}hPa-gfs-1.0.json"
end

# Map desired isobaric levels (hPa) to GRIB surface value
LEVELS = [1000, 850, 700, 500, 250, 70, 10].freeze

# 2b. Isobaric winds (UGRD/VGRD for each hPa)
LEVELS.each do |lev|
  log "Converting wind at #{lev} hPa"
  # U-component
  convert_to_json(
    grib_path:   grib_path,
    output_path: File.join(DATA_DIR, out_name("wind-u", lev)),
    fp:          2,   # UGRD (u-component)
    fs:          100, # isobaric surface
    fv:          lev.to_f
  )
  # V-component
  convert_to_json(
    grib_path:   grib_path,
    output_path: File.join(DATA_DIR, out_name("wind-v", lev)),
    fp:          3,   # VGRD (v-component)
    fs:          100,
    fv:          lev.to_f
  )
end

# 2c. Isobaric temperature (TMP, parameter 0 in temperature category)
LEVELS.each do |lev|
  log "Converting temperature at #{lev} hPa"
  convert_to_json(
    grib_path:   grib_path,
    output_path: File.join(DATA_DIR, out_name("temp", lev)),
    fp:          0,   # TMP
    fs:          100,
    fv:          lev.to_f
  )
end

# 2d. Isobaric relative humidity (RH, parameter 1 in moisture category)
LEVELS.each do |lev|
  log "Converting RH at #{lev} hPa"
  convert_to_json(
    grib_path:   grib_path,
    output_path: File.join(DATA_DIR, out_name("rh", lev)),
    fp:          1,   # RH
    fs:          100,
    fv:          lev.to_f
  )
end

log "Done."

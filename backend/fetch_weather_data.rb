#!/usr/bin/env ruby
# lib/fetch_weather_data.rb - Runs every 3 hours

require 'json'
require 'open-uri'
require 'fileutils'

# GFS/GRIB2 data (your grib2json setup)
dir = Rails.root.join("tmp", "weather-data")
FileUtils.mkdir_p(dir)

# Example weather APIs:
[
  "https://api.openweathermap.org/data/2.5/onecall?lat=0&lon=0&appid=YOUR_KEY",
  # Add your GRIB2 endpoints
].each do |url|
  begin
    data = URI.open(url).read
    filename = File.basename(url)
    File.write(File.join(dir, filename), data)
    puts "✅ Downloaded #{filename}"
  rescue => e
    puts "❌ #{url}: #{e.message}"
  end
end

puts "✅ Weather data updated"

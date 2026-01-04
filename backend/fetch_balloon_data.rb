#!/usr/bin/env ruby

require 'fileutils'
require 'net/http'
require 'uri'

BASE_URL = 'https://a.windbornesystems.com/treasure'.freeze

# On Render, /tmp is the writable area - scratch that, new tmp 
OUTPUT_DIR = '/rails/tmp/balloon-data/raw-jsons'


FileUtils.mkdir_p(OUTPUT_DIR)

def fetch_hour(hour)
  filename = format('%02d.json', hour)
  url      = "#{BASE_URL}/#{filename}"
  uri      = URI(url)

  puts "Fetching #{url}..."
  response = Net::HTTP.get_response(uri)
  unless response.is_a?(Net::HTTPSuccess)
    warn " -> failed with HTTP #{response.code}"
    return
  end

  path = File.join(OUTPUT_DIR, filename)
  File.open(path, 'wb') { |f| f.write(response.body) }
  puts " -> saved to #{path}"
rescue StandardError => e
  warn " -> error: #{e.class}: #{e.message}"
end

(0..23).each do |hour|
  fetch_hour(hour)
  sleep 0.1
end

puts 'Done.'

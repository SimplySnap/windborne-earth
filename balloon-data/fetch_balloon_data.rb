#!/usr/bin/env ruby
# balloon-data/fetch_balloon_data.rb

require 'fileutils'
require 'net/http'
require 'uri'

BASE_URL   = 'https://a.windbornesystems.com/treasure'.freeze
OUTPUT_DIR = File.join(__dir__)  #current folder (balloon-data)

FileUtils.mkdir_p(OUTPUT_DIR)

def fetch_hour(hour)
  #hour is an integer 0..23; format as two digits
  filename = format('%02d.json', hour)
  url      = "#{BASE_URL}/#{filename}"
  uri      = URI(url)

  puts "Fetching #{url}..."

  response = Net::HTTP.get_response(uri)

  unless response.is_a?(Net::HTTPSuccess)
    warn "  -> failed with HTTP #{response.code}"
    return
  end

  path = File.join(OUTPUT_DIR, filename)
  File.open(path, 'wb') do |f|
    f.write(response.body)
  end

  puts "  -> saved to #{path}"
rescue StandardError => e
  warn "  -> error: #{e.class}: #{e.message}"
end

#Fetch 00.json (now) through 23.json (23 hours ago)
(0..23).each do |hour|
  fetch_hour(hour)
  sleep 0.1  #small delay to be polite lol
end

puts "Done."

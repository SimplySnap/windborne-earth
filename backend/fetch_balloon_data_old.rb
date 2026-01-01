# lib/fetch_balloon_data.rb
require 'json'
require 'net/http'
require 'open-uri'

class FetchBalloonData
  def self.run
    url = "https://api.balloon-release.org/v1/balloons"  # Your data source
    begin
      data = JSON.parse(URI.open(url).read)
      File.write(Rails.root.join("tmp", "balloons.json"), data.to_json)
      puts "✅ Fetched #{data["balloons"]&.length || 0} balloons"
    rescue => e
      puts "❌ Balloon fetch failed: #{e.message}"
    end
  end
end

FetchBalloonData.run if __FILE__ == $0

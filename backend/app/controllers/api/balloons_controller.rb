class Api::BalloonsController < ApplicationController
  def index
    download_balloons  # This WILL run on every /api/balloons call
    
    dir = Rails.root.join("..", "balloon-data", "raw-jsons")
    Dir.mkdir(dir, 0755) unless Dir.exist?(dir)
    
    files = Dir.glob(File.join(dir, "*.json")).sort
    records = files.flat_map do |path|
      begin
        JSON.parse(File.read(path))
      rescue JSON::ParserError
        []
      end
    end
    
    render json: { balloons: records }
  end

  private

  def download_balloons
    script_path = Rails.root.join("fetch_balloon_data.rb")  # ← Fix filename
    if File.exist?(script_path)
      success = system("ruby #{script_path}")
      Rails.logger.info("Download script #{success ? 'succeeded' : 'failed'}")
    else
      Rails.logger.warn("Download script not found: #{script_path}")
    end
  end
end
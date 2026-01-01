# app/controllers/api/balloons_controller.rb (FIXED)
class Api::BalloonsController < ApplicationController
  def index
    dir = Rails.root.join("tmp", "balloon-data", "raw-jsons")
    #Dir.mkdir(dir, 0755, true) unless Dir.exist?(dir)
    
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
end

class Api::BalloonsController < ApplicationController
  def index
    dir   = Rails.root.join('..', 'balloon-data', 'raw-jsons')
    files = Dir.glob(dir.join('*.json')).sort

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

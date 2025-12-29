# syntax = docker/dockerfile:1

# Make sure RUBY_VERSION matches .ruby-version and Gemfile
ARG RUBY_VERSION=3.0.2
FROM registry.docker.com/library/ruby:$RUBY_VERSION-slim as base

WORKDIR /rails

ENV RAILS_ENV="production" \
    BUNDLE_DEPLOYMENT="1" \
    BUNDLE_PATH="/usr/local/bundle" \
    BUNDLE_WITHOUT="development"

FROM base as build

# Install build deps + GRIB tools (ONLY ONCE)
RUN apt-get update -qq && \
    apt-get install --no-install-recommends -y \
    build-essential git pkg-config curl && \
    rm -rf /var/lib/apt/lists/*

# Copy Gemfile FIRST
COPY Gemfile Gemfile.lock ./

# Install gems (fixed - no bootsnap precompile)
RUN bundle install && \
    rm -rf ~/.bundle/ "${BUNDLE_PATH}"/ruby/*/cache "${BUNDLE_PATH}"/ruby/*/bundler/gems/*/.git

# Install grib2json binary (standalone - no system GRIB deps needed)
RUN curl -L https://github.com/jsocol/grib2json/releases/latest/download/grib2json-linux64 -o /usr/local/bin/grib2json && \
    chmod +x /usr/local/bin/grib2json

# Copy app code
COPY . .

# Precompile bootsnap (optional - ignore failures)
RUN bundle exec bootsnap precompile app/ lib/ || true

# Precompile assets
RUN SECRET_KEY_BASE_DUMMY=1 ./bin/rails assets:precompile

# Final runtime image
FROM base

# Install RUNTIME deps only (curl for HTTP, no build tools)
RUN apt-get update -qq && \
    apt-get install --no-install-recommends -y \
    curl && \
    rm -rf /var/lib/apt/lists/*

# Copy built artifacts
COPY --from=build /usr/local/bundle /usr/local/bundle
COPY --from=build /rails /rails
COPY --from=build /usr/local/bin/grib2json /usr/local/bin/grib2json

# Create non-root user
RUN useradd rails --create-home --shell /bin/bash && \
    chown -R rails:rails log tmp storage
USER rails:rails

EXPOSE 3000
CMD ["./bin/rails", "server", "-b", "0.0.0.0"]

# Dockerfile for building the image for globallog.
FROM ghcr.io/astral-sh/uv:python3.11-alpine

# Authors
LABEL authors="Waterloo Rocketry <contact@waterloorocketry.com>"

# Install git.
# Required to build parsley dependency.
RUN apk add --no-cache git

# Copy the project into the image.
# Copy omnibus and the in-repo parsley it depends on, keeping their relative
# layout (the build context is the monorepo root).
COPY areas/apps/omnibus /app/areas/apps/omnibus
COPY areas/sw_libs/parsley /app/areas/sw_libs/parsley
WORKDIR /app/areas/apps/omnibus

# Sync the project into the new environment, asserting the lockfile is up to date.
RUN uv sync --locked --no-editable --no-dev --package globallog

ENV OMNIBUS_SERVER_HOST="localhost"

# Run the global logger.
ENTRYPOINT ["src/globallog/docker_entrypoint.sh"]

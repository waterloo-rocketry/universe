# Dockerfile for building the image for omnibus-server.
FROM ghcr.io/astral-sh/uv:python3.11-alpine

# Authors
LABEL authors="Waterloo Rocketry <contact@waterloorocketry.com>"

# Expose the port the server will run on (5075, 5076, 5077).
EXPOSE 5075-5077

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
RUN uv sync --locked --no-dev --no-editable --package omnibus

# Run the server.
ENTRYPOINT ["uv", "run", "--no-sync", "omnibus-server"]
CMD ["--quiet"]

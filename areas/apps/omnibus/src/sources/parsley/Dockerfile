FROM ghcr.io/astral-sh/uv:python3.11-alpine

# Authors
LABEL authors="Waterloo Rocketry <contact@waterloorocketry.com>"

# Install git.
RUN apk add --no-cache git

# Copy omnibus and the in-repo parsley it depends on, keeping their relative
# layout (the build context is the monorepo root).
COPY areas/apps/omnibus /app/areas/apps/omnibus
COPY areas/sw_libs/parsley /app/areas/sw_libs/parsley
WORKDIR /app/areas/apps/omnibus

# Sync the project into the new environment, asserting the lockfile is up to date.
RUN uv sync --no-dev --no-editable --locked --package parsley-source

# Set default Omnibus server
ENV OMNIBUS_SERVER_HOST="localhost"

# Run the server.
ENTRYPOINT ["uv","run", "--no-sync", "src/sources/parsley/main.py"]
CMD ["--quiet", "/dev/ttyACM0"]

# Dockerfile for building the image for omnibus-ws-bridge.
FROM ghcr.io/astral-sh/uv:python3.14-alpine

# Authors
LABEL authors="Waterloo Rocketry <contact@waterloorocketry.com>"

# Install git.
# Required to build parsley dependency.
RUN apk add --no-cache git

# Copy the monorepo into the image (build context is the repo root, which
# holds the shared uv workspace and uv.lock).
COPY . /app

# Install omnibus plus only this component's dependency group, asserting the
# lockfile is up to date.
WORKDIR /app
RUN uv sync --locked --no-editable --no-default-groups --package omnibus --group bridge
WORKDIR /app/areas/apps/omnibus

ENV OMNIBUS_SERVER_HOST="localhost"

# Run the bridge relay.
ENTRYPOINT ["src/bridge/docker_entrypoint.sh"]

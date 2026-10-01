# Dockerfile for building the image for omnibus-server.
FROM ghcr.io/astral-sh/uv:python3.14-alpine

# Authors
LABEL authors="Waterloo Rocketry <contact@waterloorocketry.com>"

# Expose the port the server will run on (5075, 5076, 5077).
EXPOSE 5075-5077

# Install git.
# Required to build parsley dependency.
RUN apk add --no-cache git

# Copy the monorepo into the image (build context is the repo root, which
# holds the shared uv workspace and uv.lock).
COPY . /app

# Install omnibus plus only this component's dependency group, asserting the
# lockfile is up to date.
WORKDIR /app
RUN uv sync --locked --no-editable --no-default-groups --package omnibus
WORKDIR /app/areas/apps/omnibus

# Run the server.
ENTRYPOINT ["uv", "run", "--no-sync", "omnibus-server"]
CMD ["--quiet"]

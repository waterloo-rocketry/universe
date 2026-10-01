FROM ghcr.io/astral-sh/uv:python3.14-alpine

# Authors
LABEL authors="Waterloo Rocketry <contact@waterloorocketry.com>"

# Install git.
RUN apk add --no-cache git

# Copy the monorepo into the image (build context is the repo root, which
# holds the shared uv workspace and uv.lock).
COPY . /app
WORKDIR /app

# Install omnibus plus only this component's dependency group, asserting the
# lockfile is up to date.
RUN uv sync --locked --no-editable --no-default-groups --package omnibus --group source-parsley
WORKDIR /app/areas/apps/omnibus

# Set default Omnibus server
ENV OMNIBUS_SERVER_HOST="localhost"

# Run the server.
ENTRYPOINT ["uv","run", "--no-sync", "src/sources/parsley/main.py"]
CMD ["--quiet", "/dev/ttyACM0"]

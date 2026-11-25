# sd-card-tool

Command-line tool for Waterloo Rocketry's append-only SD card log format.

Status: project skeleton. The format, export and format commands
follow in the next PRs.

## Development

```sh
uv sync
uv run pytest
uv run flake8
```

CI runs both on every pull request that changes this folder
(`.github/workflows/ci.yml`; after editing it, run `uv run tools/build_ci`
from the repo root and commit the copy it makes).

The tests build fake card images, so no SD card is needed.

# universe

Waterloo Rocketry's software monorepo.

## Requirements

**You must have the `uv` Python package manager and builder installed. Visit https://docs.astral.sh/uv/getting-started/installation/ to get started. If you don't know otherwise, choose the "Standalone Installer".**

## Layout

```
areas/            Code, organized by kind
  apps/            Deployable applications
  sw_libs/         Shared software libraries
  apis/            API/schema definitions (protobuf, etc.)
  ...
tools/            Scripts that manage the monorepo itself
```

Each project lives at `areas/<apps|sw_libs|apis|...>/<project>/`, and may keep its
own GitHub Actions workflows at `areas/<...>/.github/workflows/*.yml`, right
next to the code they build. GitHub itself only runs workflows found under
the repo-root `.github/workflows/`, so `tools/build_ci` bridges the two by
symlinking each nested workflow into the root directory.

## CI tooling: `tools/build_ci`

Run it from the repo root:

```sh
uv run tools/build_ci              # create any missing symlinks, warn on scoping issues
uv run tools/build_ci --validate   # check only; non-zero exit on any problem
```

What it does by default:
- Finds every `areas/**/.github/workflows/*.yml`, up to 3 path segments deep
  (e.g. `areas/apps/omnibus/.github/workflows/ci.yml`).
- Symlinks each one into `.github/workflows/`, named after the file plus its
  area path (e.g. `ci-areas-apps-omnibus.yml`), so multiple areas can each
  have a workflow with the same base filename.
- Warns if a workflow's `on:` triggers aren't scoped to its own area via a
  `paths:` filter (e.g. `paths: ["areas/apps/omnibus/**"]`) — an unscoped
  workflow runs on every push to the repo, not just changes to its own area.

`--validate` turns both of those checks into hard failures (exit code 1),
for use in CI: an area added a workflow without running the tool, or a
workflow isn't properly path-scoped.

## Development

The repo root `pyproject.toml` declares the Python dependencies shared by
everything under `tools/` (it's not published as a package itself).

```sh
uv sync                                          # install tooling deps
uv run pytest tools/build_ci/build_ci_test       # run build_ci's tests
```

# universe

Waterloo Rocketry's software monorepo.

**Issues and task tracking:** [2026-2027-software-issues](https://github.com/waterloo-rocketry/2026-2027-software-issues)

`areas/apis/rocketcan` is a git submodule linking the separate
[rocketcan](https://github.com/waterloo-rocketry/rocketcan) repo (CAN message
definitions). Clone with `git clone --recurse-submodules`, or run
`git submodule update --init` in an existing clone.

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
copying each nested workflow into the root directory (symlinks don't work
here — GitHub Actions doesn't follow them).

## CI tooling: `tools/build_ci`

Run it from the repo root:

```sh
uv run tools/build_ci              # create/refresh copies, warn on scoping issues
uv run tools/build_ci --validate   # check only; non-zero exit on any problem
```

What it does by default:
- Finds every `areas/**/.github/workflows/*.yml`, up to 3 path segments deep
  (e.g. `areas/apps/omnibus/.github/workflows/ci.yml`).
- Copies each one into `.github/workflows/`, named after the file plus its
  area path (e.g. `ci-areas-apps-omnibus.yml`), so multiple areas can each
  have a workflow with the same base filename. If the root copy already
  exists but no longer matches its source (someone hand-edited the copy, or
  the source changed since it was last copied), it's overwritten.
- Warns if a workflow's `on:` triggers aren't scoped to its own area via a
  `paths:` filter (e.g. `paths: ["areas/apps/omnibus/**"]`) — an unscoped
  workflow runs on every push to the repo, not just changes to its own area.
- Warns if that filter misses the area's in-repo dependencies or the shared
  root files it builds from (e.g. omnibus must also list
  `areas/sw_libs/parsley/**`, and npm workspace projects the root
  `package-lock.json`), so a change to a library or a lockfile re-tests
  everything that uses it. Dependencies are read from the manifests (uv `path`
  sources, npm workspace packages).

`--validate` turns both of those checks into hard failures (exit code 1),
for use in CI: an area added or changed a workflow without running the tool
(so its root copy is missing or has drifted from the source), or a workflow
isn't properly path-scoped.

## Development

The repo root `pyproject.toml` declares the Python dependencies shared by
everything under `tools/` (it's not published as a package itself).

```sh
uv sync                                          # install tooling deps
uv run pytest tools/build_ci/build_ci_test       # run build_ci's tests
```

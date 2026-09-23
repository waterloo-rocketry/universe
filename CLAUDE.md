# universe

Waterloo Rocketry's 2026 monorepo. This file is symlinked to
`.github/copilot-instructions.md` and `AGENTS.md` — edit only this copy.

## Structure

- `areas/` — all project code, split by kind:
  - `areas/apps/<name>/` — deployable applications
  - `areas/sw_libs/<name>/` — shared software libraries
  - `areas/apis/<name>/` — API/schema definitions (protobuf, etc.)
- `tools/` — scripts that manage the monorepo itself, not shipped as part of
  any product. These are plain Python packages (no per-tool `pyproject.toml`
  or build backend) run in place with `uv run tools/<name>` or
  `python -m tools.<name>`, sharing the dependencies declared in the root
  `pyproject.toml`.
  - `tools/build_ci/` — symlinks nested `areas/**/.github/workflows/*.yml`
    into the repo-root `.github/workflows/` (see its README-level detail in
    the root `README.md`) and validates that each workflow's `on:` triggers
    are scoped to its own area with a `paths:` filter. Run it after adding
    or editing any workflow under `areas/`: `uv run tools/build_ci`.

## Conventions

- A project's CI lives with the project: `areas/<...>/.github/workflows/*.yml`,
  never directly under the repo-root `.github/workflows/`. Files there are
  either generated symlinks (do not hand-edit or hand-create these) or
  repo-wide meta-CI that isn't scoped to any single area — currently just
  `.github/workflows/validate-ci.yml`, which runs
  `uv run tools/build_ci --validate` on every push/PR.
- After adding/renaming/removing a workflow under `areas/`, run
  `uv run tools/build_ci` and commit the resulting symlink changes. CI runs
  `uv run tools/build_ci --validate` (via `validate-ci.yml`), which fails the
  build if that step was skipped or if a workflow's `on:` isn't scoped to its
  own area path.
- Workflow depth under `areas/` is capped at 3 path segments before
  `.github/` (e.g. `areas/apps/omnibus/.github/...` is fine; a 4th nested
  level is not discovered).
- The root `pyproject.toml` (`package = false`) holds the Python
  dependencies for everything under `tools/`; it is not itself an
  installable package, and tools under `tools/` don't get their own
  `pyproject.toml`/build backend unless one is genuinely needed for
  dependency isolation.

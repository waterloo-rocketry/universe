# universe

Waterloo Rocketry's software monorepo. `CLAUDE.md` points here; edit only this
file.

## Map

| Path | What it is |
| --- | --- |
| `areas/sw_libs/parsley/` | Python CAN message transcoder (library) |
| `areas/sw_libs/parsley-ts/` | TypeScript port of parsley, published to npm |
| `areas/sw_libs/omnibus-ts/` | TypeScript client for Omnibus, published to npm |
| `areas/apps/omnibus/` | Omnibus data bus: server, PyQt dashboard, sources (`src/sources/`), sinks, globallog, WebSocket server/bridge, data tools. Publishes Docker images to GHCR |
| `areas/apps/omnibus-daqms/` | React sensor dashboard (Docker image served by nginx) |
| `areas/apps/omnibus-telem/` | Telemetry monitoring Electron app (still the unmodified vite-electron-builder template) |
| `areas/apps/omnibus-avionics-testing-app/` | Avionics board testing Electron app |
| `areas/apis/rocketcan/` | Git submodule: the separate `rocketcan` repo (`rocketcan.yaml`, the CAN message source of truth) |
| `areas/infra/daq-raspi-deploy/` | Ansible deployment of the DAQ Raspberry Pi (pins Omnibus images by digest) |
| `tools/build_ci/` | Copies per-project workflows to the root `.github/workflows/` and validates them |
| `tools/ci/` | Scripts used by repo-wide CI (`wait_for_checks.sh` backs the `required` check) |

`areas/apis/rocketcan` is a git submodule of the separate `rocketcan` repo
(CAN message definitions), which the firmware team owns. Change it in that
repo, then bump the submodule here. Minerva and the website live outside this
repo. Issues are tracked in
https://github.com/waterloo-rocketry/2026-2027-software-issues.

Each project keeps its own `README.md`; read it before changing the project.

## Toolchains

- **Python:** each project keeps its own `.python-version`, `uv.lock` and
  `.venv`, and runs `uv` from its own directory: Omnibus and parsley on 3.11,
  daq-raspi-deploy on 3.13. Some Omnibus components don't fully work on newer
  Python, so versions move per project, not repo-wide. Omnibus is its own uv
  workspace (its `src/*` and `tools/*` components are members). Projects
  consume in-repo libraries with editable `path` sources, never git URLs, e.g.
  Omnibus has `parsley = { path = "../../sw_libs/parsley", editable = true }`.
  The root `pyproject.toml` / `uv.lock` (Python 3.14) are only for `tools/`.
- **Node:** one npm workspace at the root (`package.json` `workspaces`, one
  `package-lock.json`), Node from `.nvmrc`. Libraries build to `dist/`, so run
  `npm run build:libs` before typechecking or testing a dependent app. The
  Electron apps are standalone npm projects (own lockfile): their template
  packages are all named `@app/*` and clash in a shared workspace.
- **Docker:** images build with the repo root as context (they copy in-repo
  dependencies and the root npm lockfile), e.g.
  `docker build -f areas/apps/omnibus-daqms/Dockerfile .`.
  The root `.dockerignore` serves the Python images; DAQms has its own
  `Dockerfile.dockerignore`.

## CI

- A project's workflows live at `areas/<kind>/<project>/.github/workflows/*.yml`,
  with every `push`/`pull_request` trigger scoped by `paths:` to that project's
  own area, and `working-directory` set where needed (copies run from the repo root).
- `paths:` must also list every in-repo dependency (`areas/.../**`) and, for
  npm workspace projects, the shared root files (`package.json`,
  `package-lock.json`, `.nvmrc`), so a change to shared code or a lockfile
  re-tests its dependents. `build_ci` works out the dependencies from the
  manifests (uv `path` sources, npm workspace packages) and `--validate` names
  anything missing. Add a dependency in the
  manifest and the validator tells you which workflows to update.
- After adding, editing, renaming or removing one, run `uv run tools/build_ci`
  and commit the regenerated `.github/workflows/<name>-areas-<kind>-<project>.yml`.
  Never edit those copies; CI (`validate-ci.yml`) fails on drift.
- `main` requires one status check, `required`
  (`.github/workflows/required.yml`). It waits for every other check on the PR
  and fails if any fail, so every triggered test and lint job must pass before
  merging. After re-running a failed check, re-run `required` too.
  `validate-ci.yml` (tooling tests plus `build_ci --validate`) runs on every PR.
- Releases are GitHub releases with project-prefixed tags (`omnibus-v1.2.0`,
  `omnibus-daqms-v…`, `omnibus-ts-v…`); release workflows check the prefix.

## Migrating another repository

Each migrated repository is exactly one commit: a snapshot (no history) that
links to the upstream commit and credits every upstream author with
`Co-authored-by:` trailers. The tool that wrote those commits was removed once
the migration finished; to reuse it, restore it from the commit titled "Add
tools/import_repo for one-commit-per-repo migrations".

## Checks

```sh
uv run pytest tools                 # monorepo tooling
uv run tools/build_ci --validate    # workflow copies and scoping
npm run test                        # all npm workspace tests (builds libs first)
```

Plus the project's own checks, as listed in its workflow.

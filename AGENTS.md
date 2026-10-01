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
| `tools/import_repo/` | Imports an existing repo into `areas/` as one attributed snapshot commit |

`areas/apis/rocketcan` is a git submodule of the separate `rocketcan` repo
(CAN message definitions), which the firmware team owns. Change it in that
repo, then bump the submodule here. Minerva and the website live outside this
repo. Issues are tracked in
https://github.com/waterloo-rocketry/2026-2027-software-issues.

Each project keeps its own `README.md`; read it before changing the project.

## Shared toolchains

One setup per language, at the repo root:

- **Python:** one uv workspace (`pyproject.toml` members), one `uv.lock`, one
  `.venv`, one interpreter (`.python-version`, 3.14). `uv sync --all-packages`
  from anywhere installs everything. Projects consume each other with
  `{ workspace = true }` sources, never git URLs.
- **Never put a `pyproject.toml` inside another project's directory.** uv stops
  looking for the workspace at the nearest enclosing project, so nested scripts
  get a private venv with the wrong Python. That is why Omnibus components
  (`src/*`, `tools/*`) are dependency groups in `areas/apps/omnibus/pyproject.toml`
  rather than their own projects.
- **Node:** one npm workspace (`package.json` `workspaces`, one
  `package-lock.json`), Node from `.nvmrc`. Libraries build to `dist/`, so run
  `npm run build:libs` before typechecking or testing a dependent app. The
  Electron apps are standalone npm projects (own lockfile): their template
  packages are all named `@app/*` and clash in a shared workspace.
- **Docker:** images build with the repo root as context (they need the root
  lockfiles), e.g. `docker build -f areas/apps/omnibus-daqms/Dockerfile .`.
  The root `.dockerignore` serves the Python images; DAQms has its own
  `Dockerfile.dockerignore`.

## CI

- A project's workflows live at `areas/<kind>/<project>/.github/workflows/*.yml`,
  with every `push`/`pull_request` trigger scoped by `paths:` to that project's
  own area, and `working-directory` set where needed (copies run from the repo root).
- `paths:` must also list every in-repo dependency (`areas/.../**`) and that
  language's shared root files (`pyproject.toml`, `uv.lock`, `.python-version`
  or `package.json`, `package-lock.json`, `.nvmrc`), so a change to shared code
  or a lockfile re-tests its dependents. `build_ci` works out the dependencies
  from the manifests (`{ workspace = true }` uv sources, npm workspace
  packages) and `--validate` names anything missing. Add a dependency in the
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

## Adding an existing repository

Each imported repository is exactly one commit: a snapshot (no history) that
links to the upstream commit and credits every upstream author with
`Co-authored-by:` trailers.

```sh
uv run tools/import_repo https://github.com/waterloo-rocketry/<repo> areas/<kind>/<name> \
    --message-out /tmp/<name>.txt
# integrate it (workspace membership, CI, Dockerfiles), note the changes in the message, then:
git add areas/<kind>/<name> && git commit -F /tmp/<name>.txt
```

## Checks

```sh
uv run pytest tools                 # monorepo tooling
uv run tools/build_ci --validate    # workflow copies and scoping
npm run test                        # all npm workspace tests (builds libs first)
```

Plus the project's own checks, as listed in its workflow.

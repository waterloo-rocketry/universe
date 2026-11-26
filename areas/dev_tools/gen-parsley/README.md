# gen-parsley

A code generator that reads a `rocketcan.yaml` CAN message definition and produces TypeScript.

## Setup

Install [uv](https://docs.astral.sh/uv/getting-started/installation/), then run from the repository root:

```bash
cd areas/dev_tools/gen-parsley
uv sync
```

## Running

From the repository root, provide the path to the RocketCAN YAML file:

```bash
uv run --project areas/dev_tools/gen-parsley gen-parsley path/to/rocketcan.yaml --target ts
```

By default, files are written to `areas/dev_tools/gen-parsley/out/ts`. To use another existing directory, pass `--out path/to/output`.

Run tests from the project directory with `uv run pytest`. To include TypeScript checks, install the dependencies in `areas/sw_libs/parsley-ts` first.

# gen-parsley

A code generator that reads the `rocketcan.yaml` CAN message definition and produces TypeScript 

## Setup

You must have the [uv](https://docs.astral.sh/uv/getting-started/installation/) package manager installed to run `gen-parsley`.

From repo root:

```bash
cd areas/scripts/gen-parsley
uv sync
```

This creates `.venv/` and installs locked dependencies.

## Running

From `areas/scripts/gen-parsley/`:

```bash
uv run gen-parsley
```

Or from the repo root:

```bash
uv run --project areas/scripts/gen-parsley gen-parsley
```


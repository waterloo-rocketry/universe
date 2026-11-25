"""Command-line interface."""

from __future__ import annotations

import argparse
import sys

from .config import ConfigError, default_format_text, load_config
from .export import corrupt_runs, export


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        prog="sd-card-tool",
        description="Export logs from Waterloo Rocketry's SD card format.")
    commands = parser.add_subparsers(dest="command", required=True)

    export_cmd = commands.add_parser(
        "export", help="rebuild the logged files from a card image")
    export_cmd.add_argument(
        "source", help="card image file to read")
    export_cmd.add_argument("out_dir", help="folder to write the files into")
    export_cmd.add_argument(
        "--format", help="format YAML file (default: built-in placeholders)")
    export_cmd.add_argument(
        "--overwrite", action="store_true",
        help="replace output files that already exist")

    commands.add_parser(
        "default-format", help="print the built-in format file")

    args = parser.parse_args(argv)
    if args.command == "default-format":
        print(default_format_text(), end="")
        return 0
    try:
        return _export(args)
    except (ConfigError, OSError, ValueError) as error:
        print(f"error: {error}", file=sys.stderr)
        return 1


def _export(args: argparse.Namespace) -> int:
    config = load_config(args.format)
    card = open(args.source, "rb")

    with card:
        result, files = export(card, config, args.out_dir,
                               overwrite=args.overwrite)

    print(f"Scanned {result.slots} slots: {result.valid} valid, "
          f"{result.empty} empty, {len(result.corrupt)} corrupt")
    runs = corrupt_runs(result.corrupt)
    for first, last, reason in runs[:20]:
        where = f"slot {first:,}" if first == last else \
            f"slots {first:,}-{last:,} ({last - first + 1:,} slots)"
        print(f"  {where} skipped: {reason}")
    if len(runs) > 20:
        rest = sum(last - first + 1 for first, last, _ in runs[20:])
        print(f"  ...and {rest:,} more corrupt slots")
    for location in result.duplicates:
        print(f"  slot {location.slot} skipped: duplicate of segment "
              f"{location.segment}")
    for wrap in result.wraps:
        print(f"  slot {wrap.slot}: startup counter went from {wrap.previous} "
              f"to {wrap.counter}; treating it as a wrap")
    if result.trailing_bytes:
        print(f"  ignored {result.trailing_bytes} bytes after the last "
              f"whole slot")
    for file in files:
        count = len(file.record.chunks)
        line = (f"Wrote {file.path} ({count} chunk{'' if count == 1 else 's'}, "
                f"{file.size} bytes)")
        if file.record.missing_segments:
            missing = ", ".join(map(str, file.record.missing_segments))
            line += f"; missing segments: {missing}"
        print(line)
    if not files:
        print("No log files found.")
    return 0


if __name__ == "__main__":
    sys.exit(main())

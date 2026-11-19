"""Command-line interface."""

from __future__ import annotations

import argparse
import sys
from importlib import resources

from .config import ConfigError, load_config
from .export import export


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        prog="sd-card-tool",
        description="Export logs from Waterloo Rocketry's SD card format.")
    commands = parser.add_subparsers(dest="command", required=True)

    export_cmd = commands.add_parser(
        "export", help="rebuild the logged files from a card image")
    export_cmd.add_argument("image", help="card image file to read")
    export_cmd.add_argument("out_dir", help="folder to write the files into")
    export_cmd.add_argument(
        "--config", help="format config TOML (default: built-in placeholders)")
    export_cmd.add_argument(
        "--overwrite", action="store_true",
        help="replace output files that already exist")

    commands.add_parser(
        "default-config", help="print the built-in format config")

    args = parser.parse_args(argv)
    if args.command == "default-config":
        print(resources.files("sd_card_tool").joinpath(
            "default_config.toml").read_text(encoding="utf-8"), end="")
        return 0
    return _export(args)


def _export(args: argparse.Namespace) -> int:
    try:
        config = load_config(args.config)
        with open(args.image, "rb") as card:
            result, files = export(
                card, config, args.out_dir, overwrite=args.overwrite)
    except (ConfigError, OSError) as error:
        print(f"error: {error}", file=sys.stderr)
        return 1

    print(f"Scanned {result.slots} slots: {result.valid} valid, "
          f"{result.empty} empty, {len(result.corrupt)} corrupt")
    for slot, reason in result.corrupt:
        print(f"  slot {slot} skipped: {reason}")
    for location in result.duplicates:
        print(f"  slot {location.slot} skipped: duplicate of segment "
              f"{location.segment}")
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
    return 0


if __name__ == "__main__":
    sys.exit(main())

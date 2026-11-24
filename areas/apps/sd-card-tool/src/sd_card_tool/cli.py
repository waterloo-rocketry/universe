"""Command-line interface."""

from __future__ import annotations

import argparse
import os
import sys
import time

from .config import ConfigError, default_format_text, load_config
from .device import (
    DeviceError,
    checked_disk,
    external_disks,
    format_size,
    give_back_to_user,
    open_disk,
    parse_disk_name,
    problems,
    system_disks,
)
from .export import export


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        prog="sd-card-tool",
        description="Export logs from Waterloo Rocketry's SD card format.")
    commands = parser.add_subparsers(dest="command", required=True)

    commands.add_parser("list", help="list external disks (SD cards)")

    export_cmd = commands.add_parser(
        "export", help="rebuild the logged files from a card or card image")
    export_cmd.add_argument(
        "source", help="a card such as disk4 (see `list`), or an image file")
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
        if args.command == "list":
            return _list()
        return _export(args)
    except (ConfigError, DeviceError, OSError, ValueError) as error:
        print(f"error: {error}", file=sys.stderr)
        return 1


def _list() -> int:
    disks = external_disks()
    if not disks:
        print("No external disks found. Is the card reader plugged in?")
        return 0
    system = system_disks()
    for disk in disks:
        found = problems(disk, system)
        status = "can't use: " + "; ".join(found) if found else "ok"
        print(f"{disk.describe()} ({status})")
    return 0


def _export(args: argparse.Namespace) -> int:
    config = load_config(args.format)
    is_file = os.path.isfile(args.source)
    is_disk = parse_disk_name(args.source) is not None and not is_file
    if not is_file and not is_disk and "disk" in args.source:
        checked_disk(args.source)  # explains why it isn't a usable disk
    progress = None
    if is_disk:
        disk = checked_disk(args.source)
        print(f"Reading {disk.describe()} "
              f"({disk.size // config.slot_size:,} slots). "
              f"The card is only read, never written.", flush=True)
        progress = _Progress(disk.size)
        card = open_disk(disk)
    else:
        card = open(args.source, "rb")

    with card:
        result, files = export(card, config, args.out_dir,
                               overwrite=args.overwrite, progress=progress)
    if progress:
        progress.finish()
    # Under sudo the files would belong to root; give them back.
    give_back_to_user([args.out_dir, *(str(f.path) for f in files)])

    print(f"Scanned {result.slots} slots: {result.valid} valid, "
          f"{result.empty} empty, {len(result.corrupt)} corrupt")
    for slot, reason in result.corrupt[:20]:
        print(f"  slot {slot} skipped: {reason}")
    if len(result.corrupt) > 20:
        print(f"  ...and {len(result.corrupt) - 20} more corrupt slots")
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


class _Progress:
    """Prints a one-line progress bar to stderr, a few times a second."""

    def __init__(self, total: int) -> None:
        self.total = max(total, 1)
        self.start = time.monotonic()
        self.last = 0.0

    def __call__(self, done: int) -> None:
        now = time.monotonic()
        if now - self.last < 0.25 and done < self.total:
            return
        self.last = now
        rate = done / max(now - self.start, 1e-6)
        left = (self.total - done) / rate if rate else 0
        print(f"\r  {done / self.total:6.1%}  {format_size(done)} of "
              f"{format_size(self.total)}, {format_size(int(rate))}/s, "
              f"about {left:.0f} s left   ", end="", file=sys.stderr,
              flush=True)

    def finish(self) -> None:
        print(file=sys.stderr)


if __name__ == "__main__":
    sys.exit(main())

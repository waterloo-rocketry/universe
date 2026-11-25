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
    unmount_disk,
)
from .export import corrupt_runs, export
from .wipe import find_leftovers, make_plan, write_zeros


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
        "--allow-disk-image", action="store_true",
        help="also accept a mounted disk image (for testing only)")
    export_cmd.add_argument(
        "--overwrite", action="store_true",
        help="replace output files that already exist")

    format_cmd = commands.add_parser(
        "format", help="erase a card so it is ready for logging")
    format_cmd.add_argument(
        "target", help="a card such as disk4 (see `list`), or an image file")
    format_cmd.add_argument(
        "--format", help="format YAML file (default: built-in placeholders)")
    format_cmd.add_argument(
        "--allow-disk-image", action="store_true",
        help="also accept a mounted disk image (for testing only)")
    format_cmd.add_argument(
        "--whole", action="store_true",
        help="zero every byte, not just the start of each slot")
    format_cmd.add_argument(
        "--confirm", metavar="DISK",
        help="skip the prompt by giving the disk name (e.g. disk4) again")

    commands.add_parser(
        "default-format", help="print the built-in format file")

    args = parser.parse_args(argv)
    if args.command == "default-format":
        print(default_format_text(), end="")
        return 0
    try:
        if args.command == "list":
            return _list()
        if args.command == "format":
            return _format(args)
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
        disk = checked_disk(args.source,
                            allow_disk_image=args.allow_disk_image)
        print(f"Reading {disk.describe()} "
              f"({disk.size // config.slot_size:,} slots). "
              f"The card is only read, never written.", flush=True)
        progress = _Progress(disk.size, "Reading")
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


def _format(args: argparse.Namespace) -> int:
    config = load_config(args.format)
    is_file = os.path.isfile(args.target)
    if is_file:
        size = os.path.getsize(args.target)
        plan = make_plan(size, config, args.whole)
        print(f"Formatting image {args.target} ({plan.slots:,} slots)",
              flush=True)
    else:
        disk = checked_disk(args.target,
                            allow_disk_image=args.allow_disk_image)
        plan = make_plan(disk.size, config, args.whole, disk.block_size)
        what = ("every byte" if plan.whole else
                f"the first {plan.clear_bytes:,} bytes of each of "
                f"{plan.slots:,} slots")
        print(f"This ERASES {disk.describe()}.")
        print(f"It writes zeros to {what} ({format_size(plan.total)}), then "
              f"reads them back to check.", flush=True)
        answer = args.confirm
        if answer is None:
            answer = input(f"Type {disk.identifier} to continue: ").strip()
        if parse_disk_name(answer) != disk.identifier:
            print("Not confirmed; nothing was written.")
            return 1
        unmount_disk(disk)

    card = open(args.target, "r+b") if is_file else open_disk(
        disk, writable=True)
    with card:
        progress = _Progress(plan.total, "Writing zeros")
        write_zeros(card, plan, progress)
        progress.finish()
        progress = _Progress(plan.total, "Checking")
        bad = find_leftovers(card, plan, progress)
        progress.finish()

    if bad:
        shown = ", ".join(f"{slot:,}" for slot in bad[:10])
        more = f" and {len(bad) - 10:,} more" if len(bad) > 10 else ""
        print(f"FAILED: {len(bad):,} slots are not blank after formatting "
              f"(slots {shown}{more}). The card may be failing or "
              f"write-protected.")
        return 1
    print(f"Done. All {plan.slots:,} slots are blank and ready for logging.")
    return 0


class _Progress:
    """Prints a one-line progress bar to stderr, a few times a second."""

    def __init__(self, total: int, label: str) -> None:
        self.label = label
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
        print(f"\r  {self.label}: {done / self.total:6.1%}  "
              f"{format_size(done)} of "
              f"{format_size(self.total)}, {format_size(int(rate))}/s, "
              f"about {left:.0f} s left   ", end="", file=sys.stderr,
              flush=True)

    def finish(self) -> None:
        print(file=sys.stderr)


if __name__ == "__main__":
    sys.exit(main())

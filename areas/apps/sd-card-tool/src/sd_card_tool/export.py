"""Scans a card (or card image) and rebuilds the logged files.

The card is read once, front to back. Each valid chunk's payload goes
straight into a temporary `.part` file on the computer, and each `.part`
file is renamed to its final name at the end. If a file's segments arrived
out of order, it is put back in order from the `.part` file, never by
reading the card again.
"""

from __future__ import annotations

import os
from collections import OrderedDict
from dataclasses import dataclass, field
from pathlib import Path
from typing import BinaryIO, Callable

from .chunk import Chunk, ChunkError, decode_chunk
from .config import FormatConfig

# Read this many slots per call; large reads are much faster on raw devices.
SLOTS_PER_READ = 32
# Most `.part` files kept open at once; others are reopened when needed.
MAX_OPEN_FILES = 64
PART_SUFFIX = ".part"


@dataclass(frozen=True)
class ChunkLocation:
    slot: int
    segment: int


@dataclass
class FileRecord:
    # How many times the startup counter had wrapped before this file.
    generation: int
    counter: int
    data_type: int
    chunks: list[ChunkLocation] = field(default_factory=list)

    @property
    def segments(self) -> list[int]:
        return [chunk.segment for chunk in self.chunks]

    @property
    def missing_segments(self) -> list[int]:
        """Segment numbers absent between the first and last ones found."""
        present = set(self.segments)
        return [s for s in range(min(present), max(present) + 1)
                if s not in present]


@dataclass(frozen=True)
class Wrap:
    """The startup counter went down, so it is treated as having wrapped."""
    slot: int
    previous: int
    counter: int


@dataclass
class ScanResult:
    slots: int = 0
    empty: int = 0
    # (slot index, reason) for every slot that was neither empty nor valid.
    corrupt: list[tuple[int, str]] = field(default_factory=list)
    # Later copies of a (file, segment) that was already found; first one wins.
    duplicates: list[ChunkLocation] = field(default_factory=list)
    wraps: list[Wrap] = field(default_factory=list)
    # Bytes at the end of the card that do not fill a whole slot.
    trailing_bytes: int = 0
    files: dict[tuple[int, int, int], FileRecord] = field(default_factory=dict)

    @property
    def valid(self) -> int:
        return sum(len(record.chunks) for record in self.files.values())


@dataclass(frozen=True)
class ExportedFile:
    record: FileRecord
    path: Path
    size: int


# Called with the number of bytes scanned so far.
Progress = Callable[[int], None]
# Called with each accepted chunk (not empty, corrupt or a duplicate).
OnChunk = Callable[[FileRecord, Chunk], None]


def scan(card: BinaryIO, config: FormatConfig,
         progress: Progress | None = None,
         on_chunk: OnChunk | None = None) -> ScanResult:
    """Check every slot in address order and record where valid chunks are.

    Startup counters only go up in card order, so a valid chunk whose counter
    is lower than the previous valid chunk's means the counter wrapped. Files
    after a wrap get the next generation, so two startups that share a counter
    are never merged. Payloads are not kept; pass on_chunk to use them as the
    scan finds them.
    """
    result = ScanResult()
    blank = bytes(config.clear_bytes)
    seen: set[tuple[int, int, int, int]] = set()
    files: dict[tuple[int, int, int], FileRecord] = {}
    size = config.slot_size
    generation = 0
    previous: int | None = None
    done = 0

    while block := card.read(size * SLOTS_PER_READ):
        done += len(block)
        if progress:
            progress(done)
        whole = len(block) - len(block) % size
        result.trailing_bytes = len(block) - whole
        view = memoryview(block)
        for start in range(0, whole, size):
            slot_index = result.slots
            result.slots += 1
            slot = view[start:start + size]
            if slot[:config.clear_bytes] == blank:
                result.empty += 1
                continue
            try:
                chunk = decode_chunk(bytes(slot), config)
            except ChunkError as error:
                result.corrupt.append((slot_index, str(error)))
                continue

            if previous is not None and chunk.counter < previous:
                generation += 1
                result.wraps.append(Wrap(slot_index, previous, chunk.counter))
            previous = chunk.counter

            location = ChunkLocation(slot_index, chunk.segment)
            key = (generation, chunk.counter, chunk.data_type, chunk.segment)
            if key in seen:
                result.duplicates.append(location)
                continue
            seen.add(key)
            record = files.setdefault(
                key[:3],
                FileRecord(generation, chunk.counter, chunk.data_type))
            record.chunks.append(location)
            if on_chunk:
                on_chunk(record, chunk)
        if result.trailing_bytes:
            break

    for record in files.values():
        record.chunks.sort(key=lambda chunk: chunk.segment)
    result.files = dict(sorted(files.items()))
    return result


def corrupt_runs(corrupt: list[tuple[int, str]]) -> list[tuple[int, int, str]]:
    """Group consecutive corrupt slots that failed the same way.

    Returns (first slot, last slot, reason). CRC failures are grouped
    together even though each has its own checksum values.
    """
    runs: list[tuple[int, int, str]] = []
    for slot, reason in corrupt:
        if reason.startswith("CRC"):
            reason = "CRC check failed"
        if runs and runs[-1][1] == slot - 1 and runs[-1][2] == reason:
            runs[-1] = (runs[-1][0], slot, reason)
        else:
            runs.append((slot, slot, reason))
    return runs


def output_name(record: FileRecord, config: FormatConfig) -> str:
    pattern = config.filename if record.generation == 0 \
        else config.wrapped_filename
    return pattern.format(counter=record.counter,
                          ext=config.extension(record.data_type),
                          generation=record.generation)


def export(
    card: BinaryIO,
    config: FormatConfig,
    out_dir: str | Path,
    *,
    overwrite: bool = False,
    progress: Progress | None = None,
) -> tuple[ScanResult, list[ExportedFile]]:
    """Read the card once and write each file's payloads in segment order.

    Existing output files are only replaced when overwrite is True;
    otherwise FileExistsError is raised. Final files only appear once the
    whole card has been read, so a failed export leaves no output files and
    no `.part` files behind.
    """
    out = Path(out_dir)
    out.mkdir(parents=True, exist_ok=True)
    writer = _PartFiles(out, config, overwrite)
    try:
        result = scan(card, config, progress, writer.add)
        exported = writer.finish(result)
    except BaseException:
        writer.discard()
        raise
    return result, exported


@dataclass
class _Part:
    """A file being rebuilt in a `.part` file."""
    final: Path
    part: Path
    # (segment, byte offset in the .part file), in the order chunks arrived.
    pieces: list[tuple[int, int]] = field(default_factory=list)
    size: int = 0


class _PartFiles:
    """Streams payloads into `.part` files and renames them at the end."""

    def __init__(self, out: Path, config: FormatConfig, overwrite: bool):
        self.out = out
        self.config = config
        self.overwrite = overwrite
        self.parts: dict[tuple[int, int, int], _Part] = {}
        self.names: set[str] = set()
        self.open: OrderedDict[Path, BinaryIO] = OrderedDict()

    def add(self, record: FileRecord, chunk: Chunk) -> None:
        key = (record.generation, record.counter, record.data_type)
        part = self.parts.get(key)
        if part is None:
            part = self._start(record)
            self.parts[key] = part
        handle = self._handle(part.part)
        part.pieces.append((chunk.segment, part.size))
        part.size += handle.write(chunk.data)

    def finish(self, result: ScanResult) -> list[ExportedFile]:
        self._close_all()
        exported = []
        for key, record in result.files.items():
            part = self.parts[key]
            if [seg for seg, _ in part.pieces] != sorted(
                    seg for seg, _ in part.pieces):
                self._reorder(part)
            os.replace(part.part, part.final)
            exported.append(ExportedFile(record, part.final, part.size))
        return exported

    def discard(self) -> None:
        """Remove every `.part` file after a failure."""
        self._close_all()
        for part in self.parts.values():
            part.part.unlink(missing_ok=True)

    def _start(self, record: FileRecord) -> _Part:
        name = output_name(record, self.config)
        if name in self.names:
            raise ValueError(
                "The output filename patterns give two files the same name: "
                + name)
        self.names.add(name)
        final = self.out / name
        if final.exists() and not self.overwrite:
            raise FileExistsError(f"Output file already exists: {final}")
        part = self.out / (name + PART_SUFFIX)
        part.unlink(missing_ok=True)  # left over from an interrupted export
        return _Part(final, part)

    def _handle(self, path: Path) -> BinaryIO:
        handle = self.open.get(path)
        if handle is not None:
            self.open.move_to_end(path)
            return handle
        if len(self.open) >= MAX_OPEN_FILES:
            _, oldest = self.open.popitem(last=False)
            oldest.close()
        handle = path.open("ab")
        self.open[path] = handle
        return handle

    def _close_all(self) -> None:
        while self.open:
            _, handle = self.open.popitem()
            handle.close()

    def _reorder(self, part: _Part) -> None:
        """Rewrite a `.part` file in segment order, reading from the disk."""
        ordered = sorted(part.pieces)
        sizes = {}
        offsets = sorted(offset for _, offset in part.pieces) + [part.size]
        for here, after in zip(offsets, offsets[1:]):
            sizes[here] = after - here
        sorted_path = part.part.with_name(part.part.name + ".sorted")
        with part.part.open("rb") as source, sorted_path.open("wb") as target:
            for _, offset in ordered:
                source.seek(offset)
                target.write(source.read(sizes[offset]))
        os.replace(sorted_path, part.part)

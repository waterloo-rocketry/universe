"""Scans a card (or card image) and rebuilds the logged files."""

from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path
from typing import BinaryIO, Callable

from .chunk import ChunkError, decode_chunk
from .config import FormatConfig

# Read this many slots per call; large reads are much faster on raw devices.
SLOTS_PER_READ = 32


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


def scan(card: BinaryIO, config: FormatConfig,
         progress: Progress | None = None) -> ScanResult:
    """Check every slot in address order and record where valid chunks are.

    Startup counters only go up in card order, so a valid chunk whose counter
    is lower than the previous valid chunk's means the counter wrapped. Files
    after a wrap get the next generation, so two startups that share a counter
    are never merged. Payloads are not kept in memory; export() reads them
    again by slot.
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
    """Scan the card, then write each file's payloads in segment order.

    The card stream must be seekable. Each chunk's CRC is checked again as it
    is copied. Existing output files are only replaced when overwrite is
    True; otherwise FileExistsError is raised before anything is written.
    """
    card.seek(0)
    result = scan(card, config, progress)
    out = Path(out_dir)
    targets = [(record, out / output_name(record, config))
               for record in result.files.values()]
    names = [path.name for _, path in targets]
    if len(set(names)) != len(names):
        raise ValueError(
            "The output filename patterns give two files the same name")
    if not overwrite:
        existing = [str(path) for _, path in targets if path.exists()]
        if existing:
            raise FileExistsError(
                "Output files already exist: " + ", ".join(existing))

    out.mkdir(parents=True, exist_ok=True)
    exported = []
    for record, path in targets:
        with path.open("wb") as file:
            for location in record.chunks:
                card.seek(location.slot * config.slot_size)
                # Check the CRC again, in case the second read differs.
                try:
                    chunk = decode_chunk(card.read(config.slot_size), config)
                except ChunkError as error:
                    raise ChunkError(
                        f"slot {location.slot} changed between reads: "
                        f"{error}") from error
                file.write(chunk.data)
        exported.append(ExportedFile(
            record, path, len(record.chunks) * config.data_size))
    return result, exported

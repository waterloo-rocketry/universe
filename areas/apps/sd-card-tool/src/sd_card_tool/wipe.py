"""Formats a card: writes zeros so every slot reads as unused, then checks.

Formatting only writes zeros; the card's own erase command is not used,
because some cards read back 0xFF (not 0x00) after an erase.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import BinaryIO, Callable

from .config import FormatConfig

# Bytes per write/read when the whole card is zeroed (a multiple of 512).
BLOCK = 1 << 20

Progress = Callable[[int], None]


class WipeError(OSError):
    """The card failed while being formatted."""

    def __init__(self, action: str, offset: int, slot_size: int,
                 error: OSError) -> None:
        slot = offset // slot_size
        super().__init__(
            f"{action} slot {slot:,} (byte {offset:,}) failed: "
            f"{error.strerror or error}. "
            + ("The card refused the very first write, so it is probably "
               "write-protected (check the lock switch on the card or "
               "adapter) or failing." if offset == 0 and action == "Writing"
               else "The card or reader may have disconnected, or the card "
                    "may be failing or smaller than it claims."))
        self.offset = offset
        self.slot = slot


@dataclass(frozen=True)
class Plan:
    """Which byte ranges formatting zeroes."""
    size: int           # bytes on the card
    slot_size: int
    clear_bytes: int    # per slot; ignored when whole is True
    whole: bool

    @property
    def slots(self) -> int:
        return self.size // self.slot_size

    @property
    def total(self) -> int:
        """Bytes that will be written (and read back)."""
        return self.size if self.whole else self.slots * self.clear_bytes

    def ranges(self):
        """(offset, length) pieces to zero, in address order."""
        if self.whole:
            for offset in range(0, self.size, BLOCK):
                yield offset, min(BLOCK, self.size - offset)
        else:
            for slot in range(self.slots):
                yield slot * self.slot_size, self.clear_bytes


def make_plan(size: int, config: FormatConfig, whole: bool,
              block_size: int = 512) -> Plan:
    if size < config.slot_size:
        raise ValueError("The card is smaller than one slot")
    if not whole and config.clear_bytes % block_size:
        raise ValueError(
            f"clear_bytes ({config.clear_bytes}) must be a multiple of the "
            f"card's {block_size}-byte blocks; use --whole instead")
    return Plan(size, config.slot_size, config.clear_bytes, whole)


def write_zeros(card: BinaryIO, plan: Plan,
                progress: Progress | None = None) -> None:
    zeros = bytes(BLOCK if plan.whole else plan.clear_bytes)
    done = 0
    offset = 0
    try:
        for offset, length in plan.ranges():
            card.seek(offset)
            _write_all(card, zeros[:length])
            done += length
            if progress:
                progress(done)
        card.flush()
    except WipeError:
        raise
    except OSError as error:
        raise WipeError("Writing", offset, plan.slot_size, error) from error


def find_leftovers(card: BinaryIO, plan: Plan,
                   progress: Progress | None = None) -> list[int]:
    """Read the zeroed ranges back; return slots that are not all zero."""
    bad: list[int] = []
    done = 0
    for offset, length in plan.ranges():
        try:
            card.seek(offset)
            data = card.read(length)
        except OSError as error:
            raise WipeError("Checking", offset, plan.slot_size, error) \
                from error
        if len(data) != length or data.count(0) != length:
            first = offset // plan.slot_size
            if len(data) == length:
                # Report each slot in this block that has a non-zero byte.
                for start in range(0, length, plan.slot_size):
                    piece = data[start:start + plan.slot_size]
                    if piece.count(0) != len(piece):
                        bad.append(first + start // plan.slot_size)
            else:
                bad.append(first)
        done += length
        if progress:
            progress(done)
    return bad


def _write_all(card: BinaryIO, data: bytes) -> None:
    view = memoryview(data)
    while view:
        written = card.write(view)
        if not written:
            raise OSError("The card stopped accepting writes")
        view = view[written:]

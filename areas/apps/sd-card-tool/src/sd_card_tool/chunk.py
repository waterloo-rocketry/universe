"""Encodes and decodes a single chunk slot, following the format file."""

from __future__ import annotations

from dataclasses import dataclass

from .config import (
    DATA_TYPE,
    SEGMENT_COUNTER,
    STARTUP_COUNTER,
    Field,
    FormatConfig,
)
from .crc import crc16


class ChunkError(ValueError):
    """A slot is not a valid chunk (wrong fixed value or failed CRC)."""


@dataclass(frozen=True)
class Chunk:
    counter: int
    data_type: int
    segment: int
    data: bytes


def encode_chunk(chunk: Chunk, config: FormatConfig) -> bytes:
    """Build the bytes of one slot. Short payloads are zero-padded."""
    if len(chunk.data) > config.data_size:
        raise ValueError(
            f"payload is {len(chunk.data)} bytes; a chunk holds "
            f"{config.data_size}")
    given = {
        STARTUP_COUNTER: chunk.counter,
        DATA_TYPE: chunk.data_type,
        SEGMENT_COUNTER: chunk.segment,
    }
    header = b""
    for field in config.fields:
        total = 0
        for part in config.parts(field):
            number = given.get(part.name, part.value)
            if number is None:
                number = 0  # an extra field the tool does not fill
            elif part.value is not None and number != part.value:
                raise ValueError(f"{part.name} must be {part.value}")
            if not 0 <= number <= part.max:
                raise ValueError(
                    f"{part.name} {number} does not fit in {part.bits} bits")
            total |= number << part.shift
        header += total.to_bytes(field.size, config.byte_order)

    data = chunk.data.ljust(config.data_size, b"\0")
    body = header + data
    crc = crc16(body if config.crc_covers == "header+data" else data,
                config.crc)
    return body + crc.to_bytes(config.footer_size, config.byte_order)


def read_value(slot: bytes, field: Field, config: FormatConfig) -> int:
    whole = int.from_bytes(slot[field.offset:field.offset + field.size],
                           config.byte_order)
    return (whole >> field.shift) & field.max


def decode_chunk(slot: bytes, config: FormatConfig) -> Chunk:
    """Validate and decode one slot. Raises ChunkError if it is not valid."""
    if len(slot) != config.slot_size:
        raise ChunkError(
            f"slot is {len(slot)} bytes, expected {config.slot_size}")
    for field in config.values.values():
        if field.value is None:
            continue
        actual = read_value(slot, field, config)
        if actual != field.value:
            width = (field.bits + 3) // 4
            raise ChunkError(
                f"{field.name} is {actual:#0{width + 2}x}, "
                f"expected {field.value:#0{width + 2}x}")

    body = slot[:-config.footer_size]
    data = slot[config.header_size:-config.footer_size]
    expected = crc16(body if config.crc_covers == "header+data" else data,
                     config.crc)
    actual = int.from_bytes(slot[-config.footer_size:], config.byte_order)
    if actual != expected:
        raise ChunkError(f"CRC is {actual:#06x}, expected {expected:#06x}")

    values = config.values
    return Chunk(
        counter=read_value(slot, values[STARTUP_COUNTER], config),
        data_type=read_value(slot, values[DATA_TYPE], config),
        segment=read_value(slot, values[SEGMENT_COUNTER], config),
        data=bytes(data),
    )

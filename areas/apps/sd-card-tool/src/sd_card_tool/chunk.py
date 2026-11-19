"""Encodes and decodes a single chunk slot."""

from __future__ import annotations

from dataclasses import dataclass

from .config import FormatConfig
from .crc import crc16


class ChunkError(ValueError):
    """A slot is not a valid chunk (wrong header ID or failed CRC)."""


@dataclass(frozen=True)
class Chunk:
    counter: int
    data_type: int
    segment: int
    data: bytes


def pack_file_id(counter: int, data_type: int, config: FormatConfig) -> int:
    if not 0 <= counter <= config.max_counter:
        raise ValueError(
            f"startup counter {counter} does not fit in "
            f"{config.counter_bits} bits")
    if not 0 <= data_type <= config.max_type:
        raise ValueError(
            f"data type {data_type} does not fit in {config.type_bits} bits")
    if config.counter_position == "high":
        return (counter << config.type_bits) | data_type
    return (data_type << config.counter_bits) | counter


def unpack_file_id(file_id: int, config: FormatConfig) -> tuple[int, int]:
    """Split a file ID into (startup counter, data type)."""
    if config.counter_position == "high":
        return file_id >> config.type_bits, file_id & config.max_type
    return file_id & config.max_counter, file_id >> config.counter_bits


def encode_chunk(chunk: Chunk, config: FormatConfig) -> bytes:
    """Build the bytes of one slot. Short payloads are zero-padded."""
    if len(chunk.data) > config.data_size:
        raise ValueError(
            f"payload is {len(chunk.data)} bytes; a chunk holds "
            f"{config.data_size}")
    if not 0 <= chunk.segment <= 0xFFFFFFFF:
        raise ValueError("segment counter must fit in 32 bits")
    order = config.byte_order
    data = chunk.data.ljust(config.data_size, b"\0")
    body = (
        config.header_id.to_bytes(4, order)
        + pack_file_id(chunk.counter, chunk.data_type, config).to_bytes(2, order)
        + chunk.segment.to_bytes(4, order)
        + data
    )
    crc = crc16(body if config.crc.covers == "chunk" else data, config.crc)
    return body + crc.to_bytes(2, order)


def decode_chunk(slot: bytes, config: FormatConfig) -> Chunk:
    """Validate and decode one slot. Raises ChunkError if it is not valid."""
    if len(slot) != config.chunk_size:
        raise ChunkError(
            f"slot is {len(slot)} bytes, expected {config.chunk_size}")
    order = config.byte_order
    header_id = int.from_bytes(slot[0:4], order)
    if header_id != config.header_id:
        raise ChunkError(f"header ID is {header_id:#010x}")
    body, footer = slot[:-2], slot[-2:]
    data = slot[10:-2]
    expected = crc16(body if config.crc.covers == "chunk" else data, config.crc)
    actual = int.from_bytes(footer, order)
    if actual != expected:
        raise ChunkError(f"CRC is {actual:#06x}, expected {expected:#06x}")
    counter, data_type = unpack_file_id(int.from_bytes(slot[4:6], order), config)
    return Chunk(
        counter=counter,
        data_type=data_type,
        segment=int.from_bytes(slot[6:10], order),
        data=data,
    )

import dataclasses

import pytest

from sd_card_tool.chunk import (
    Chunk,
    ChunkError,
    decode_chunk,
    encode_chunk,
    pack_file_id,
    unpack_file_id,
)
from sd_card_tool.config import load_config

CONFIG = load_config()


def test_round_trip():
    chunk = Chunk(counter=1, data_type=2, segment=7,
                  data=(bytes(range(256)) * 128)[:32752] + b"end!")
    assert len(chunk.data) == CONFIG.data_size
    slot = encode_chunk(chunk, CONFIG)
    assert len(slot) == 32768
    assert decode_chunk(slot, CONFIG) == chunk


def test_layout_matches_the_spec():
    slot = encode_chunk(Chunk(1, 2, 7, b"\xAA" * CONFIG.data_size), CONFIG)
    assert slot[0:4] == CONFIG.header_id.to_bytes(4, "little")
    assert slot[4:6] == ((1 << 3) | 2).to_bytes(2, "little")
    assert slot[6:10] == (7).to_bytes(4, "little")
    assert slot[10:-2] == b"\xAA" * 32756


def test_short_payload_is_zero_padded():
    slot = encode_chunk(Chunk(0, 0, 0, b"hi"), CONFIG)
    assert decode_chunk(slot, CONFIG).data == b"hi".ljust(32756, b"\0")


def test_big_endian():
    config = dataclasses.replace(CONFIG, byte_order="big")
    chunk = Chunk(5, 1, 3, b"x")
    slot = encode_chunk(chunk, config)
    assert slot[0:4] == config.header_id.to_bytes(4, "big")
    assert decode_chunk(slot, config).segment == 3
    with pytest.raises(ChunkError):
        decode_chunk(slot, CONFIG)


@pytest.mark.parametrize("position", ["high", "low"])
def test_file_id_packs_counter_and_type(position):
    config = dataclasses.replace(CONFIG, counter_position=position)
    for counter, data_type in [(0, 0), (8191, 7), (1234, 5)]:
        file_id = pack_file_id(counter, data_type, config)
        assert 0 <= file_id <= 0xFFFF
        assert unpack_file_id(file_id, config) == (counter, data_type)


def test_file_id_rejects_values_that_do_not_fit():
    with pytest.raises(ValueError, match="13 bits"):
        pack_file_id(8192, 0, CONFIG)
    with pytest.raises(ValueError, match="3 bits"):
        pack_file_id(0, 8, CONFIG)


def test_rejects_oversized_payload():
    with pytest.raises(ValueError, match="32756"):
        encode_chunk(Chunk(0, 0, 0, bytes(32757)), CONFIG)


def test_detects_any_flipped_byte():
    slot = bytearray(encode_chunk(Chunk(1, 0, 0, b"payload"), CONFIG))
    for index in (4, 5, 9, 100, 32765, 32766, 32767):
        broken = bytearray(slot)
        broken[index] ^= 0x01
        with pytest.raises(ChunkError):
            decode_chunk(bytes(broken), CONFIG)


def test_rejects_wrong_header_id():
    slot = bytearray(encode_chunk(Chunk(1, 0, 0, b"x"), CONFIG))
    slot[0] ^= 0xFF
    with pytest.raises(ChunkError, match="header ID"):
        decode_chunk(bytes(slot), CONFIG)


def test_crc_over_data_only():
    config = dataclasses.replace(
        CONFIG, crc=dataclasses.replace(CONFIG.crc, covers="data"))
    slot = encode_chunk(Chunk(1, 0, 0, b"x"), config)
    assert decode_chunk(slot, config).data[:1] == b"x"
    # A header change is not covered by the CRC in this mode.
    changed = bytearray(slot)
    changed[6] = 9
    assert decode_chunk(bytes(changed), config).segment == 9

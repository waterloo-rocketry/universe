import pytest
from helpers import config_with

from sd_card_tool.chunk import Chunk, ChunkError, decode_chunk, encode_chunk
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
    assert slot[0:4] == bytes.fromhex("5D5D5D5D")
    # Startup 1, type 2: 0000000000001 010 = 0x000A, little endian.
    assert slot[4:6] == bytes.fromhex("0A00")
    assert slot[6:10] == bytes.fromhex("07000000")
    assert slot[10:-2] == b"\xAA" * 32756


def test_largest_values_fit():
    chunk = Chunk(8191, 7, 0xFFFFFFFF, b"x".ljust(CONFIG.data_size, b"\0"))
    assert decode_chunk(encode_chunk(chunk, CONFIG), CONFIG) == chunk


def test_big_endian():
    config = config_with(lambda r: r["layout"].update(byte_order="big"))
    slot = encode_chunk(Chunk(1, 2, 7, b"x"), config)
    assert slot[4:6] == bytes.fromhex("000A")
    assert slot[6:10] == bytes.fromhex("00000007")
    assert decode_chunk(slot, config).segment == 7
    with pytest.raises(ChunkError):
        decode_chunk(slot, CONFIG)


def test_type_in_the_high_bits():
    def change(raw):
        subs = next(f for f in raw["header"] if f["name"] == "FILE_ID")
        subs["subfields"].reverse()
    config = config_with(change)
    slot = encode_chunk(Chunk(1, 2, 0, b"x"), config)
    # Type 2 on top (010), counter 1 below: 010 0000000000001 = 0x4001.
    assert slot[4:6] == bytes.fromhex("0140")
    assert decode_chunk(slot, config).counter == 1


def test_extra_fields_are_written_and_checked():
    def change(raw):
        raw["header"].append({"name": "VERSION", "width": 8, "value": 3})
        raw["header"].append({"name": "BOARD_ID", "width": 8})
    config = config_with(change)
    chunk = Chunk(1, 0, 0, b"x".ljust(config.data_size, b"\0"))
    slot = bytearray(encode_chunk(chunk, config))
    assert slot[10:12] == bytes([3, 0])
    assert decode_chunk(bytes(slot), config) == chunk
    slot[10] = 4
    with pytest.raises(ChunkError, match="VERSION is 0x04, expected 0x03"):
        decode_chunk(bytes(slot), config)


def test_rejects_values_that_do_not_fit():
    with pytest.raises(ValueError, match="13 bits"):
        encode_chunk(Chunk(8192, 0, 0, b""), CONFIG)
    with pytest.raises(ValueError, match="3 bits"):
        encode_chunk(Chunk(0, 8, 0, b""), CONFIG)
    with pytest.raises(ValueError, match="32756"):
        encode_chunk(Chunk(0, 0, 0, bytes(32757)), CONFIG)


def test_short_payload_is_zero_padded():
    slot = encode_chunk(Chunk(0, 0, 0, b"hi"), CONFIG)
    assert decode_chunk(slot, CONFIG).data == b"hi".ljust(32756, b"\0")


def test_detects_any_flipped_byte():
    slot = encode_chunk(Chunk(1, 0, 0, b"payload"), CONFIG)
    for index in (4, 5, 9, 100, 32765, 32766, 32767):
        broken = bytearray(slot)
        broken[index] ^= 0x01
        with pytest.raises(ChunkError):
            decode_chunk(bytes(broken), CONFIG)


def test_rejects_wrong_header_id():
    slot = bytearray(encode_chunk(Chunk(1, 0, 0, b"x"), CONFIG))
    slot[0] ^= 0xFF
    with pytest.raises(ChunkError, match="HEADER_ID is 0x5d5d5da2"):
        decode_chunk(bytes(slot), CONFIG)


def test_crc_over_data_only():
    config = config_with(lambda r: r["crc"].update(covers="data"))
    slot = encode_chunk(Chunk(1, 0, 0, b"x"), config)
    # A header change is not covered by the CRC in this mode.
    changed = bytearray(slot)
    changed[6] = 9
    assert decode_chunk(bytes(changed), config).segment == 9

import dataclasses

import pytest

from sd_card_tool.config import CrcParams
from sd_card_tool.crc import crc16

CHECK = b"123456789"

# Standard check values from the CRC catalogue (reveng.sourceforge.io).
VARIANTS = {
    "CCITT-FALSE": (CrcParams(0x1021, 0xFFFF, False, False, 0, "chunk"), 0x29B1),
    "XMODEM": (CrcParams(0x1021, 0x0000, False, False, 0, "chunk"), 0x31C3),
    "KERMIT": (CrcParams(0x1021, 0x0000, True, True, 0, "chunk"), 0x2189),
    "ARC": (CrcParams(0x8005, 0x0000, True, True, 0, "chunk"), 0xBB3D),
    "BUYPASS": (CrcParams(0x8005, 0x0000, False, False, 0, "chunk"), 0xFEE8),
    "X-25": (CrcParams(0x1021, 0xFFFF, True, True, 0xFFFF, "chunk"), 0x906E),
}


@pytest.mark.parametrize("name", VARIANTS)
def test_matches_catalogue_check_values(name):
    params, expected = VARIANTS[name]
    assert crc16(CHECK, params) == expected


def test_fast_and_table_paths_match_a_bitwise_reference():
    # Poly 0x1021 uses binascii; 0x8005 uses the lookup table.
    params = VARIANTS["CCITT-FALSE"][0]
    data = bytes(range(256)) * 50
    assert crc16(data, params) == _bitwise(data, params)
    other = dataclasses.replace(params, poly=0x8005)
    assert crc16(data, other) == _bitwise(data, other)


def _bitwise(data: bytes, params: CrcParams) -> int:
    crc = params.init
    for byte in data:
        crc ^= byte << 8
        for _ in range(8):
            crc = ((crc << 1) ^ params.poly) if crc & 0x8000 else crc << 1
            crc &= 0xFFFF
    return crc ^ params.xor_out

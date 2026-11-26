import dataclasses

import pytest

from sd_card_tool.crc import ALGORITHMS, CrcParams, crc16

# Check values for b"123456789" from the CRC catalogue (reveng.sourceforge.io).
CHECK_VALUES = {
    "CRC-16/CCITT-FALSE": 0x29B1,
    "CRC-16/XMODEM": 0x31C3,
    "CRC-16/KERMIT": 0x2189,
    "CRC-16/X-25": 0x906E,
    "CRC-16/ARC": 0xBB3D,
    "CRC-16/MODBUS": 0x4B37,
    "CRC-16/USB": 0xB4C8,
    "CRC-16/UMTS": 0xFEE8,
}


def test_every_named_algorithm_has_a_check_value():
    assert set(ALGORITHMS) == set(CHECK_VALUES)


@pytest.mark.parametrize("name", CHECK_VALUES)
def test_matches_catalogue_check_values(name):
    assert crc16(b"123456789", ALGORITHMS[name]) == CHECK_VALUES[name]


def test_fast_and_table_paths_match_a_bitwise_reference():
    # Poly 0x1021 uses binascii; 0x8005 uses the lookup table.
    params = ALGORITHMS["CRC-16/CCITT-FALSE"]
    data = bytes(range(256)) * 50
    assert crc16(data, params) == _bitwise(data, params)
    other = dataclasses.replace(params, poly=0x8005)
    assert crc16(data, other) == _bitwise(data, other)


def test_rejects_values_wider_than_16_bits():
    with pytest.raises(ValueError, match="poly"):
        CrcParams(0x10000, 0, False, False, 0)


def _bitwise(data: bytes, params: CrcParams) -> int:
    crc = params.init
    for byte in data:
        crc ^= byte << 8
        for _ in range(8):
            crc = ((crc << 1) ^ params.poly) if crc & 0x8000 else crc << 1
            crc &= 0xFFFF
    return crc ^ params.xor_out

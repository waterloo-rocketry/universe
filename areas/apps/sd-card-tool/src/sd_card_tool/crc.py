"""Configurable CRC-16."""

from __future__ import annotations

import binascii
from dataclasses import dataclass
from functools import lru_cache


@dataclass(frozen=True)
class CrcParams:
    """A CRC-16 recipe in the usual (Rocksoft) model."""
    poly: int
    init: int
    reflect_in: bool
    reflect_out: bool
    xor_out: int

    def __post_init__(self) -> None:
        for name in ("poly", "init", "xor_out"):
            if not 0 <= getattr(self, name) <= 0xFFFF:
                raise ValueError(f"crc.{name} must fit in 16 bits")


# Named algorithms from the CRC catalogue (reveng.sourceforge.io).
ALGORITHMS: dict[str, CrcParams] = {
    "CRC-16/CCITT-FALSE": CrcParams(0x1021, 0xFFFF, False, False, 0x0000),
    "CRC-16/XMODEM": CrcParams(0x1021, 0x0000, False, False, 0x0000),
    "CRC-16/KERMIT": CrcParams(0x1021, 0x0000, True, True, 0x0000),
    "CRC-16/X-25": CrcParams(0x1021, 0xFFFF, True, True, 0xFFFF),
    "CRC-16/ARC": CrcParams(0x8005, 0x0000, True, True, 0x0000),
    "CRC-16/MODBUS": CrcParams(0x8005, 0xFFFF, True, True, 0x0000),
    "CRC-16/USB": CrcParams(0x8005, 0xFFFF, True, True, 0xFFFF),
    "CRC-16/UMTS": CrcParams(0x8005, 0x0000, False, False, 0x0000),
}


def crc16(data: bytes, params: CrcParams) -> int:
    """Compute a CRC-16 with the given recipe."""
    if params.poly == 0x1021 and not params.reflect_in and not params.reflect_out:
        # The common CCITT family; binascii does it in C, which keeps a full
        # card scan fast.
        return binascii.crc_hqx(data, params.init) ^ params.xor_out

    table = _table(params.poly, params.reflect_in)
    if params.reflect_in:
        crc = _reflect(params.init)
        for byte in data:
            crc = (crc >> 8) ^ table[(crc ^ byte) & 0xFF]
        # A reflected register already holds the reflected result.
        if not params.reflect_out:
            crc = _reflect(crc)
    else:
        crc = params.init
        for byte in data:
            crc = ((crc << 8) & 0xFFFF) ^ table[((crc >> 8) ^ byte) & 0xFF]
        if params.reflect_out:
            crc = _reflect(crc)
    return crc ^ params.xor_out


def _reflect(value: int, bits: int = 16) -> int:
    result = 0
    for _ in range(bits):
        result = (result << 1) | (value & 1)
        value >>= 1
    return result


@lru_cache(maxsize=8)
def _table(poly: int, reflected: bool) -> tuple[int, ...]:
    table = []
    if reflected:
        rpoly = _reflect(poly)
        for byte in range(256):
            crc = byte
            for _ in range(8):
                crc = (crc >> 1) ^ rpoly if crc & 1 else crc >> 1
            table.append(crc)
    else:
        for byte in range(256):
            crc = byte << 8
            for _ in range(8):
                crc = ((crc << 1) ^ poly) if crc & 0x8000 else crc << 1
            table.append(crc & 0xFFFF)
    return tuple(table)

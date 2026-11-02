import pytest

from parsley.bitstring import BitString
from parsley.message_definitions import MESSAGE_TYPE, BOARD_TYPE_ID, BOARD_INST_ID, MESSAGE_SID, MESSAGE_PRIO, MESSAGE_METADATA

FLOAT_TOLERANCE = 0.01

def approx(value):
    return pytest.approx(value, FLOAT_TOLERANCE)

def create_msg_sid_from_strings(priority_str: str, msg_type_str: str, metadata_str: str, board_type_str: str, board_inst_str: str):
    (msg_prio_bits, _) = MESSAGE_PRIO.encode(priority_str)
    (msg_type_bits, _) = MESSAGE_TYPE.encode(msg_type_str)
    (board_type_bits, _) = BOARD_TYPE_ID.encode(board_type_str)
    (board_inst_bits, _) = BOARD_INST_ID.encode(board_inst_str)
    (metadata_bits, _) = MESSAGE_METADATA.encode(int(metadata_str) if metadata_str.isdigit() else 0)

    bit_msg_sid = BitString(msg_prio_bits, MESSAGE_PRIO.length)
    bit_msg_sid.push(msg_type_bits, MESSAGE_TYPE.length)
    bit_msg_sid.push(board_type_bits, BOARD_TYPE_ID.length)
    bit_msg_sid.push(board_inst_bits, BOARD_INST_ID.length)
    bit_msg_sid.push(metadata_bits, MESSAGE_METADATA.length)
    msg_sid = bit_msg_sid.pop(MESSAGE_SID.length)
    return msg_sid


def split_format_line(line: str) -> tuple[list[str], dict[str, str]]:
    """Parse format_line output back into (header_fields, body_dict)."""
    bracket, sep, body = line.partition(']')
    assert sep == ']', f"format_line output missing closing bracket: {line!r}"
    header_fields = bracket.lstrip('[ ').split()
    parts = body.strip().split()
    assert len(parts) % 2 == 0, f"format_line body has unpaired key/value tokens: {body!r}"
    body_dict = {parts[i].rstrip(':'): parts[i + 1] for i in range(0, len(parts), 2)}
    return header_fields, body_dict

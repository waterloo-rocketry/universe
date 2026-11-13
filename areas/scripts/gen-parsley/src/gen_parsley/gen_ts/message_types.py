from collections.abc import Iterable
from string import Template
from typing import Any

from gen_parsley.models import RocketCAN
from gen_parsley.utils import snake_to_title_case

_FILE = Template("""\
// Auto generated file, do not edit directly

import { z } from 'zod'

$type_blocks
""")

_TYPE_BLOCK = Template("""\
// ============================================================
// $title
// ============================================================

export const $name = {
$entries
} as const

export const ${name}_schema = z.nativeEnum($name)
export type ${name} = z.infer<typeof ${name}_schema>
""")


def _obj_entries(items: Iterable[tuple[Any, Any]]) -> str:
    return "\n".join(f"    {name}: {val}," for name, val in items)


def _hex_entries(items: Iterable[tuple[str, int]]) -> str:
    return _obj_entries((name, f"0x{val:02X}") for name, val in items)


def render(data: RocketCAN) -> str:
    blocks: list[dict] = []

    # message priority
    msg_prio = ["HIGHEST", "HIGH", "MEDIUM", "LOW"]
    blocks.append(
        {
            "title": "Message Priority",
            "name": "msg_prio",
            "entries": _obj_entries(zip(msg_prio, range(len(msg_prio)))),
        }
    )

    # message types
    blocks.append(
        {
            "title": "Message Types",
            "name": "msg_type",
            "entries": _hex_entries([(m.name, m.id) for m in data.messages]),
        }
    )

    # board types
    blocks.append(
        {
            "title": "Board Type ID",
            "name": "board_type_id",
            "entries": _hex_entries([(b.name, b.id) for b in data.boards]),
        }
    )

    # board instance ids
    board_inst = ["ANY", "GROUND", "ROCKET"]
    for board in data.boards:
        if board.inst:
            board_inst.extend(inst.name for inst in board.inst)
    blocks.append(
        {
            "title": "Board Instance ID",
            "name": "board_inst_id",
            "entries": _hex_entries(zip(board_inst, range(len(board_inst)))),
        }
    )

    for enum in data.enums:
        field_bits = [f"{enum.prefix}_{v.name}" for v in enum.value]
        blocks.append(
            {
                "title": snake_to_title_case(enum.name),
                "name": enum.name,
                "entries": _hex_entries(zip(field_bits, range(len(field_bits)))),
            }
        )

    for bitfield in data.bitfields:
        field_bits = [f"{bitfield.prefix}_{v.name}" for v in bitfield.bits]
        blocks.append(
            {
                "title": f"{snake_to_title_case(bitfield.name)} Offset (bitfield positions)",
                "name": f"{bitfield.name}_offset",
                "entries": _hex_entries(zip(field_bits, range(len(field_bits)))),
            }
        )

    type_blocks = "\n".join(_TYPE_BLOCK.substitute(b) for b in blocks)
    return _FILE.substitute(type_blocks=type_blocks)

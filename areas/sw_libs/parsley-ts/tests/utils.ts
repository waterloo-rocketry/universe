/*
Test utilities — ported from Python `tests/utils.py`.
*/

import { BitString } from '../src/bitString.js'
import type { Field } from '../src/fields.js'
import {
    BOARD_INST_ID,
    BOARD_TYPE_ID,
    MESSAGE_METADATA,
    MESSAGE_PRIO,
    MESSAGE_SID_LEN,
    MESSAGE_TYPE,
} from '../src/messageDefs.js'

export const FLOAT_TOLERANCE = 0.01

// Mirrors Python `tests/utils.create_msg_sid_from_strings`.
// `metadata` accepts either a number (raw) or a string (decoded via the per-msg-type metadataField).
export function createMsgSid(
    priority: string,
    msgType: string,
    metadata: number | string,
    boardType: string,
    boardInst: string,
    metadataField: Field = MESSAGE_METADATA,
): Uint8Array {
    const bs = new BitString()
    const [prioBits, prioLen]     = MESSAGE_PRIO.encode(priority)
    const [typeBits, typeLen]     = MESSAGE_TYPE.encode(msgType)
    const [btypeBits, btypeLen]   = BOARD_TYPE_ID.encode(boardType)
    const [binstBits, binstLen]   = BOARD_INST_ID.encode(boardInst)
    const [metaBits, metaLen]     = metadataField.encode(metadata)

    bs.push(prioBits, prioLen)
    bs.push(typeBits, typeLen)
    bs.push(btypeBits, btypeLen)
    bs.push(binstBits, binstLen)
    bs.push(metaBits, metaLen)

    return bigintToBytes(bs.pop(MESSAGE_SID_LEN), Math.ceil(MESSAGE_SID_LEN / 8))
}

// Encode a list of [field, value] pairs into a packed Uint8Array (msg_data).
export function encodeFields(
    parts: ReadonlyArray<readonly [Field, unknown]>,
): Uint8Array {
    const bs = new BitString()
    let totalBits = 0
    for (const [field, value] of parts) {
        const [bits, len] = field.encode(value)
        bs.push(bits, len)
        totalBits += len
    }
    return bigintToBytes(bs.pop(totalBits), Math.ceil(totalBits / 8))
}

export function bigintToBytes(value: bigint, byteCount: number): Uint8Array {
    const out = new Uint8Array(byteCount)
    let v = value
    for (let i = byteCount - 1; i >= 0; i--) {
        out[i] = Number(v & 0xffn)
        v >>= 8n
    }
    return out
}

// Parse formatLine output back into structured header + body.
// Mirrors Python `tests/utils.split_format_line` from parsley PR #66.
export function splitFormatLine(line: string): { header: string[]; body: Record<string, string> } {
    const closeIdx = line.indexOf(']')
    if (closeIdx === -1) throw new Error(`format_line output missing closing bracket: ${line}`)
    const bracket = line.slice(0, closeIdx).replace(/^\[\s*/, '')
    const body = line.slice(closeIdx + 1).trim()

    const header = bracket.trim().split(/\s+/).filter(Boolean)
    const parts = body.split(/\s+/).filter(Boolean)
    if (parts.length % 2 !== 0) {
        throw new Error(`format_line body has unpaired key/value tokens: ${body}`)
    }
    const bodyDict: Record<string, string> = {}
    for (let i = 0; i < parts.length; i += 2) {
        const key = parts[i]!.replace(/:$/, '')
        bodyDict[key] = parts[i + 1]!
    }
    return { header, body: bodyDict }
}

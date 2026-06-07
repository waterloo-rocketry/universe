/*
Top-level CAN message parser.

Mirrors Python `parse_to_object.py`: SID decoded incrementally, board ids softened
(hexify fallback on enum miss), msg_type/payload hard-fail to ParsleyError, empty
payloads return data=null.

Wire format spec: https://docs.waterloorocketry.com/avionics/rocketcan/index.html
*/

import { BitString } from './bitString.js'
import { Enum } from './fields.js'
import type { Field } from './fields.js'
import {
    BOARD_INST_ID,
    BOARD_TYPE_ID,
    MESSAGE_METADATA,
    MESSAGE_PRIO,
    MESSAGE_SID_LEN,
    MESSAGE_TYPE,
    MESSAGE_DEFS,
    ParsleyDataPayload,
} from './messageDefs.js'
import type { MessageDefKey, ParsleyMessage } from './messageDefs.js'
import type { ParsleyError } from './schemas.js'
import type { msg_prio, board_type_id, board_inst_id } from './messageTypes.js'

// SID is exactly 29 bits, transported in 4 bytes (3 leading pad bits).
export const MESSAGE_SID_BYTES = Math.ceil(MESSAGE_SID_LEN / 8)

// Helpers

function hexify(bytes: Uint8Array): string {
    if (bytes.length === 0) return '0x'
    return (
        '0x' +
        Array.from(bytes, (b) => b.toString(16).toUpperCase().padStart(2, '0')).join('')
    )
}

function safeDecode(field: Field, raw: bigint): string {
    try {
        return field.decode(raw) as string
    } catch {
        // Render the raw bits as hex (length rounded up to the nearest nibble).
        const nibbles = Math.ceil(field.length / 4)
        return '0x' + raw.toString(16).toUpperCase().padStart(nibbles, '0')
    }
}

// Main entry point

// Coerce a SID input (raw bytes, bigint, or number) into the canonical 4-byte big-endian form.
// For numeric inputs, missing high bits are implicitly zero (the docs' "pad bits 31:29").
function coerceSid(sid: Uint8Array | bigint | number): Uint8Array {
    if (sid instanceof Uint8Array) return sid
    let v: bigint
    if (typeof sid === 'number') {
        if (!Number.isInteger(sid) || sid < 0) {
            throw new Error(`SID number must be a non-negative integer, got ${sid}`)
        }
        v = BigInt(sid)
    } else if (typeof sid === 'bigint') {
        if (sid < 0n) throw new Error(`SID bigint must be non-negative, got ${sid}`)
        v = sid
    } else {
        throw new Error(`SID must be Uint8Array, number, or bigint`)
    }
    if (v >> BigInt(MESSAGE_SID_BYTES * 8) !== 0n) {
        throw new Error(`SID exceeds ${MESSAGE_SID_BYTES} bytes`)
    }
    const out = new Uint8Array(MESSAGE_SID_BYTES)
    for (let i = MESSAGE_SID_BYTES - 1; i >= 0; i--) {
        out[i] = Number(v & 0xffn)
        v >>= 8n
    }
    return out
}

function coerceData(data: Uint8Array | number[]): Uint8Array {
    if (data instanceof Uint8Array) return data
    if (!Array.isArray(data)) throw new Error(`msgData must be Uint8Array or number[]`)
    return Uint8Array.from(data)
}

export function parseToObject(
    msgSidIn: Uint8Array | bigint | number,
    msgDataIn: Uint8Array | number[],
): ParsleyMessage | ParsleyError {
    let msgSid: Uint8Array
    let msgData: Uint8Array
    try {
        msgSid = coerceSid(msgSidIn)
        msgData = coerceData(msgDataIn)
    } catch (err) {
        // Coercion failed before we have canonical bytes — render inputs best-effort.
        const sidRepr = msgSidIn instanceof Uint8Array ? hexify(msgSidIn) : String(msgSidIn)
        const dataRepr = msgDataIn instanceof Uint8Array ? hexify(msgDataIn) : String(msgDataIn)
        return {
            msg_prio: '',
            board_type_id: sidRepr,
            board_inst_id: sidRepr,
            msg_type: sidRepr,
            msg_metadata: 0,
            msg_data: dataRepr,
            error: `error: ${(err as Error).message}`,
        }
    }

    // Catch-all error builder for early SID failures (msg_prio not yet known).
    const earlyError = (err: unknown): ParsleyError => ({
        msg_prio: '',
        board_type_id: hexify(msgSid),
        board_inst_id: hexify(msgSid),
        msg_type: hexify(msgSid),
        msg_metadata: 0,
        msg_data: hexify(msgData),
        error: `error: ${(err as Error).message}`,
    })

    // SID must be at least 29 bits (4 bytes). Reject short/empty SID before BitString
    // silently zero-pads the high bits (which would otherwise decode as UNDEFINED).
    if (msgSid.length < MESSAGE_SID_BYTES) {
        return earlyError(
            new Error(`SID must be at least ${MESSAGE_SID_LEN} bits (${MESSAGE_SID_BYTES} bytes), got ${msgSid.length} bytes`),
        )
    }

    let sidBits: BitString
    let prioRaw: bigint
    let typeRaw: bigint
    let btypeRaw: bigint
    let binstRaw: bigint
    let metaRaw: bigint
    try {
        sidBits = new BitString(msgSid, MESSAGE_SID_LEN)
        prioRaw  = sidBits.pop(MESSAGE_PRIO.length)
        typeRaw  = sidBits.pop(MESSAGE_TYPE.length)
        btypeRaw = sidBits.pop(BOARD_TYPE_ID.length)
        binstRaw = sidBits.pop(BOARD_INST_ID.length)
        metaRaw  = sidBits.pop(MESSAGE_METADATA.length)
    } catch (err) {
        return earlyError(err)
    }

    // These three never throw out — they hexify on enum miss.
    const msg_prio      = safeDecode(MESSAGE_PRIO, prioRaw)
    const board_type_id = safeDecode(BOARD_TYPE_ID, btypeRaw)
    const board_inst_id = safeDecode(BOARD_INST_ID, binstRaw)

    // Numeric metadata is the default fallback shown when msg_type decode fails too.
    const metadataNumeric = Number(metaRaw)

    let msg_type: MessageDefKey
    let cls: typeof ParsleyDataPayload
    try {
        msg_type = MESSAGE_TYPE.decode(typeRaw) as MessageDefKey
        cls = MESSAGE_DEFS[msg_type as MessageDefKey]
        if (!cls) throw new Error(`Unknown msg_type ${String(msg_type)}`)
    } catch (err) {
        return {
            msg_prio,
            board_type_id,
            board_inst_id,
            msg_type: hexify(new Uint8Array(typeRawToBytes(typeRaw))),
            msg_metadata: metadataNumeric,
            msg_data: hexify(msgData),
            error: `error: ${(err as Error).message}`,
        }
    }

    // Per-msg-type metadata typing; fall back to numeric on enum miss.
    let msg_metadata: string | number
    try {
        msg_metadata = cls.metadataField.decode(metaRaw) as string | number
    } catch {
        msg_metadata = metadataNumeric
    }

    let data: InstanceType<typeof ParsleyDataPayload> | null
    try {
        data = cls.fields.length === 0 ? null : cls.decode(new BitString(msgData))
    } catch (err) {
        return {
            msg_prio,
            board_type_id,
            board_inst_id,
            msg_type,
            msg_metadata,
            msg_data: hexify(msgData),
            error: `error: ${(err as Error).message}`,
        }
    }

    // Cast through `unknown` because TS can't see that `msg_type` discriminates `data`'s
    // concrete subclass — at runtime the invariant holds (verified by `data instanceof MESSAGE_DEFS[msg_type]`).
    return {
        msg_prio,
        msg_type,
        board_type_id,
        board_inst_id,
        msg_metadata,
        data,
    } as unknown as ParsleyMessage
}

// Render a partially-decoded msg_type bigint back as hex bytes, padded to the field width.
function typeRawToBytes(raw: bigint): number[] {
    const byteCount = Math.ceil(MESSAGE_TYPE.length / 8)
    const bytes: number[] = []
    let v = raw
    for (let i = 0; i < byteCount; i++) {
        bytes.unshift(Number(v & 0xffn))
        v >>= 8n
    }
    return bytes
}

// formatLine — pretty-print a parsed message (mirrors Python format_line)

const MSG_PRIO_LEN      = Math.max(...Object.keys(MESSAGE_PRIO.map_key_val).map((k) => k.length))
const MSG_TYPE_LEN      = Math.max(...Object.keys(MESSAGE_TYPE.map_key_val).map((k) => k.length))
const BOARD_TYPE_ID_LEN = Math.max(...Object.keys(BOARD_TYPE_ID.map_key_val).map((k) => k.length))
const BOARD_INST_ID_LEN = Math.max(...Object.keys(BOARD_INST_ID.map_key_val).map((k) => k.length))
const MSG_METADATA_LEN = Math.max(
    0,
    ...Object.values(MESSAGE_DEFS)
        .map((cls) => cls.metadataField)
        .filter((f): f is Enum => f instanceof Enum)
        .flatMap((f) => Object.keys(f.map_key_val).map((k) => k.length)),
)

function padRight(s: string, len: number): string {
    return s.length >= len ? s : s + ' '.repeat(len - s.length)
}

export function formatLine(parsed: ParsleyMessage): string {
    const header =
        `[ ${padRight(parsed.msg_prio, MSG_PRIO_LEN)}` +
        ` ${padRight(parsed.msg_type, MSG_TYPE_LEN)}` +
        ` ${padRight(parsed.board_type_id, BOARD_TYPE_ID_LEN)}` +
        ` ${padRight(parsed.board_inst_id, BOARD_INST_ID_LEN)}` +
        ` ${padRight(String(parsed.msg_metadata), MSG_METADATA_LEN)} ]`

    let body = ''
    if (parsed.data !== null) {
        for (const [k, v] of Object.entries(parsed.data as Record<string, unknown>)) {
            // Match Python's `{v:.3f}` for floats — JS doesn't distinguish int from float,
            // so format any non-integer number to 3 decimals.
            const formatted =
                typeof v === 'number' && !Number.isInteger(v) ? v.toFixed(3) : String(v)
            body += ` ${k}: ${formatted}`
        }
    }
    return header + body
}

// encodeData — reverse direction: parsed object -> (sid, msgData)

export interface ParsedMessageLike {
    msg_prio: keyof typeof msg_prio | string
    msg_type: MessageDefKey
    board_type_id: keyof typeof board_type_id | string
    board_inst_id: keyof typeof board_inst_id | string
    msg_metadata: string | number
    data: Record<string, unknown> | null
}

export function encodeData(parsed: ParsedMessageLike): { sid: bigint; data: Uint8Array } {
    const cls = MESSAGE_DEFS[parsed.msg_type as MessageDefKey]
    if (!cls) throw new Error(`Unknown msg_type "${String(parsed.msg_type)}"`)

    // ---- Build SID ----
    const sidBits = new BitString()
    sidBits.push(...MESSAGE_PRIO.encode(parsed.msg_prio))
    sidBits.push(...MESSAGE_TYPE.encode(parsed.msg_type))
    sidBits.push(...BOARD_TYPE_ID.encode(parsed.board_type_id))
    sidBits.push(...BOARD_INST_ID.encode(parsed.board_inst_id))
    // If the metadata field is an Enum but the caller passed a raw int, fall back
    // to the 8-bit numeric MESSAGE_METADATA encoding — mirrors parsley PR #66.
    if (cls.metadataField instanceof Enum && typeof parsed.msg_metadata === 'number') {
        sidBits.push(...MESSAGE_METADATA.encode(parsed.msg_metadata))
    } else {
        sidBits.push(...cls.metadataField.encode(parsed.msg_metadata))
    }
    const sid = sidBits.pop(MESSAGE_SID_LEN)

    // ---- Build payload data ----
    const dataBits = new BitString()
    let totalBits = 0
    if (parsed.data === null) {
        if (cls.fields.length > 0) {
            throw new Error(`msg_type "${String(parsed.msg_type)}" requires payload data, got null`)
        }
    } else {
        for (const field of cls.fields) {
            const value = (parsed.data as Record<string, unknown>)[field.name]
            const [bits, len] = field.encode(value)
            dataBits.push(bits, len)
            totalBits += len
        }
    }

    const byteCount = Math.ceil(totalBits / 8)
    const dataBytes = new Uint8Array(byteCount)
    if (totalBits > 0) {
        let v = dataBits.pop(totalBits)
        for (let i = byteCount - 1; i >= 0; i--) {
            dataBytes[i] = Number(v & 0xffn)
            v >>= 8n
        }
    }

    return { sid, data: dataBytes }
}

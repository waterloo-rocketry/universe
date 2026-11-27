/*
Ported from PR #56's `tests/test_parse_to_object.py`.

Each test reconstructs a CAN message (SID + payload), runs parseToObject, and
asserts on the typed result. Tests also lock in the per-msg-type metadata
typing (the improvement over PR #56).
*/

import { describe, it, expect } from 'vitest'
import { BitString } from '../src/bitString.js'
import { ASCII, Bitfield, Enum, Numeric } from '../src/fields.js'
import {
    BOARD_INST,
    BOARD_TYPE,
    METADATA,
    PRIO,
    MESSAGE_SID_LEN,
    MESSAGE_TYPE,
    MSG_FIELD_TIMESTAMP,
    type MessagePayload,
} from '../src/messageDefs.js'
import { parseToObject } from '../src/parseToObject.js'
import {
    actuator_id,
    actuator_state,
    alt_arm_state,
    altimeter_id,
    analog_sensor_id,
    board_error_bitfield_offset,
    board_inst,
    canards_module_id,
    dem_2d_sensor_id,
    dem_3d_sensor_id,
} from '../src/messageTypes.js'
import { createMsgSid, encodeFields, bigintToBytes, FLOAT_TOLERANCE } from './utils.js'

function isError(r: ReturnType<typeof parseToObject>): r is Extract<typeof r, { error: string }> {
    return 'error' in r
}

describe('parseToObject', () => {
    it('parses a GENERAL_BOARD_STATUS with bitfield', () => {
        const sid = createMsgSid('PRIO_HIGH', 'GENERAL_BOARD_STATUS', 0, 'BOARD_TYPE_ID_RLCS_RELAY', 'BOARD_INST_ID_GROUND')
        const data = encodeFields([
            [MSG_FIELD_TIMESTAMP, 1.234],
            [
                new Bitfield('board_error_bitfield', 32, 'E_NOMINAL', board_error_bitfield_offset),
                'E_5V_OVER_VOLT|E_5V_EFUSE_FAULT',
            ],
        ])

        const result = parseToObject(sid, data)
        if (isError(result)) throw new Error(`unexpected error: ${result.error}`)

        expect(result.msg_type).toBe('GENERAL_BOARD_STATUS')
        expect(result.board_type_id).toBe('BOARD_TYPE_ID_RLCS_RELAY')
        expect(result.board_inst_id).toBe('BOARD_INST_ID_GROUND')
        expect(result.msg_prio).toBe('PRIO_HIGH')
        expect(result.msg_metadata).toBe(0)
        const payload = result.data as MessagePayload<"GENERAL_BOARD_STATUS">
        expect(Math.abs(payload.time - 1.234)).toBeLessThan(FLOAT_TOLERANCE)
        expect(payload.board_error_bitfield).toBe('E_5V_OVER_VOLT|E_5V_EFUSE_FAULT')
    })

    it('parses DEBUG_RAW with partial-byte ASCII field', () => {
        const sid = createMsgSid('PRIO_LOW', 'DEBUG_RAW', 0, 'BOARD_TYPE_ID_GPS', 'BOARD_INST_ID_ROCKET')
        const data = encodeFields([
            [MSG_FIELD_TIMESTAMP, 0.133],
            [new ASCII('string', 48), 'zZz'],
        ])

        const result = parseToObject(sid, data)
        if (isError(result)) throw new Error(`unexpected error: ${result.error}`)

        expect(result.msg_type).toBe('DEBUG_RAW')
        expect(result.board_type_id).toBe('BOARD_TYPE_ID_GPS')
        expect(result.board_inst_id).toBe('BOARD_INST_ID_ROCKET')
        expect(result.msg_prio).toBe('PRIO_LOW')
        expect(result.msg_metadata).toBe(0)
        expect(result.data).not.toBeNull()
        const payload = result.data as MessagePayload<"DEBUG_RAW">
        expect(Math.abs(payload.time - 0.133)).toBeLessThan(FLOAT_TOLERANCE)
        expect(payload.raw_data).toBe('zZz')
    })

    it('parses SENSOR_ANALOG16 with enum metadata', () => {
        const sid = createMsgSid(
            'PRIO_MEDIUM',
            'SENSOR_ANALOG16',
            'SENSOR_5V_VOLT',
            'BOARD_TYPE_ID_PAYLOAD',
            'BOARD_INST_ID_ANY',
            new Enum('msg_metadata', 8, analog_sensor_id),
        )
        const data = encodeFields([
            [MSG_FIELD_TIMESTAMP, 12.345],
            [new Numeric('value', 16), 3300],
        ])

        const result = parseToObject(sid, data)
        if (isError(result)) throw new Error(`unexpected error: ${result.error}`)

        expect(result.msg_type).toBe('SENSOR_ANALOG16')
        expect(result.msg_metadata).toBe('SENSOR_5V_VOLT')
        const payload = result.data as MessagePayload<"SENSOR_ANALOG16">
        expect(Math.abs(payload.time - 12.345)).toBeLessThan(FLOAT_TOLERANCE)
        expect(payload.value).toBe(3300)
    })

    it('decodes nonzero numeric metadata on DEBUG_RAW', () => {
        const sid = createMsgSid('PRIO_LOW', 'DEBUG_RAW', 42, 'BOARD_TYPE_ID_GPS', 'BOARD_INST_ID_ROCKET')
        const data = encodeFields([
            [MSG_FIELD_TIMESTAMP, 1.0],
            [new ASCII('string', 48), 'abc'],
        ])

        const result = parseToObject(sid, data)
        if (isError(result)) throw new Error(`unexpected error: ${result.error}`)

        expect(result.msg_metadata).toBe(42)
        expect(result.msg_type).toBe('DEBUG_RAW')
    })

    it('decodes ACTUATOR_CMD metadata as an actuator_id', () => {
        const sid = createMsgSid(
            'PRIO_HIGH',
            'ACTUATOR_CMD',
            'ACTUATOR_FUEL_INJECTOR_VALVE',
            'BOARD_TYPE_ID_INJECTOR',
            'BOARD_INST_ID_ROCKET',
            new Enum('msg_metadata', 8, actuator_id),
        )
        const data = encodeFields([
            [MSG_FIELD_TIMESTAMP, 2.0],
            [new Enum('actuator_cmd_state', 8, actuator_state), 'ACT_STATE_ON'],
        ])

        const result = parseToObject(sid, data)
        if (isError(result)) throw new Error(`unexpected error: ${result.error}`)

        expect(result.msg_metadata).toBe('ACTUATOR_FUEL_INJECTOR_VALVE')
        const payload = result.data as MessagePayload<"ACTUATOR_CMD">
        expect(payload.actuator_cmd_state).toBe('ACT_STATE_ON')
    })

    it('decodes SENSOR_ANALOG16 metadata as SENSOR_5V_CURR', () => {
        const sid = createMsgSid(
            'PRIO_MEDIUM',
            'SENSOR_ANALOG16',
            'SENSOR_5V_CURR',
            'BOARD_TYPE_ID_POWER',
            'BOARD_INST_ID_ROCKET',
            new Enum('msg_metadata', 8, analog_sensor_id),
        )
        const data = encodeFields([
            [MSG_FIELD_TIMESTAMP, 5.0],
            [new Numeric('value', 16), 4800],
        ])

        const result = parseToObject(sid, data)
        if (isError(result)) throw new Error(`unexpected error: ${result.error}`)

        expect(result.msg_metadata).toBe('SENSOR_5V_CURR')
        const payload = result.data as MessagePayload<"SENSOR_ANALOG16">
        expect(payload.value).toBe(4800)
    })

    it('decodes ALT_ARM_CMD metadata as ALTIMETER_STRATOLOGGER', () => {
        const sid = createMsgSid(
            'PRIO_HIGH',
            'ALT_ARM_CMD',
            'ALTIMETER_STRATOLOGGER',
            'BOARD_TYPE_ID_ALTIMETER',
            'BOARD_INST_ID_ROCKET',
            new Enum('msg_metadata', 8, altimeter_id),
        )
        const data = encodeFields([
            [MSG_FIELD_TIMESTAMP, 1.0],
            [new Enum('alt_arm_state', 8, alt_arm_state), 'ALT_ARM_STATE_ARMED'],
        ])

        const result = parseToObject(sid, data)
        if (isError(result)) throw new Error(`unexpected error: ${result.error}`)

        expect(result.msg_metadata).toBe('ALTIMETER_STRATOLOGGER')
        const payload = result.data as MessagePayload<"ALT_ARM_CMD">
        expect(payload.alt_arm_state).toBe('ALT_ARM_STATE_ARMED')
    })

    it('keeps STREAM_DATA metadata as numeric (SEQ_ID)', () => {
        const sid = createMsgSid('PRIO_LOW', 'STREAM_DATA', 5, 'BOARD_TYPE_ID_LOGGER', 'BOARD_INST_ID_ROCKET')
        const data = encodeFields([
            [MSG_FIELD_TIMESTAMP, 3.0],
            [new ASCII('data', 48), 'hello!'],
        ])

        const result = parseToObject(sid, data)
        if (isError(result)) throw new Error(`unexpected error: ${result.error}`)

        expect(result.msg_metadata).toBe(5)
        const payload = result.data as MessagePayload<"STREAM_DATA">
        expect(payload.data).toBe('hello!')
    })

    it('decodes SENSOR_2D_ANALOG24 metadata as DEM 2D enum', () => {
        const sid = createMsgSid(
            'PRIO_MEDIUM',
            'SENSOR_2D_ANALOG24',
            'DEM_2D_SENSOR_CANARD_MS5611_BARO_TEMP',
            'BOARD_TYPE_ID_CANARD',
            'BOARD_INST_ID_ROCKET',
            new Enum('msg_metadata', 8, dem_2d_sensor_id),
        )
        const data = encodeFields([
            [MSG_FIELD_TIMESTAMP, 1.5],
            [new Numeric('value_x', 24), 500],
            [new Numeric('value_y', 24), 1000],
        ])

        const result = parseToObject(sid, data)
        if (isError(result)) throw new Error(`unexpected error: ${result.error}`)

        expect(result.msg_metadata).toBe('DEM_2D_SENSOR_CANARD_MS5611_BARO_TEMP')
        const payload = result.data as MessagePayload<"SENSOR_2D_ANALOG24">
        expect(payload.value_x).toBe(500)
        expect(payload.value_y).toBe(1000)
    })

    it('decodes SENSOR_3D_ANALOG16 metadata as DEM 3D enum', () => {
        const sid = createMsgSid(
            'PRIO_MEDIUM',
            'SENSOR_3D_ANALOG16',
            'DEM_3D_SENSOR_CANARD_LSM6DSV32X_ACCEL',
            'BOARD_TYPE_ID_CANARD',
            'BOARD_INST_ID_ROCKET',
            new Enum('msg_metadata', 8, dem_3d_sensor_id),
        )
        const data = encodeFields([
            [MSG_FIELD_TIMESTAMP, 1.5],
            [new Numeric('value_x', 16), 100],
            [new Numeric('value_y', 16), 200],
            [new Numeric('value_z', 16), 300],
        ])

        const result = parseToObject(sid, data)
        if (isError(result)) throw new Error(`unexpected error: ${result.error}`)

        expect(result.msg_metadata).toBe('DEM_3D_SENSOR_CANARD_LSM6DSV32X_ACCEL')
        const payload = result.data as MessagePayload<"SENSOR_3D_ANALOG16">
        expect(payload.value_x).toBe(100)
        expect(payload.value_y).toBe(200)
        expect(payload.value_z).toBe(300)
    })

    it('falls back to numeric metadata when enum decode fails', () => {
        // Construct SID with metadata=0xFF — not in actuator_id, so ACTUATOR_CMD's
        // metadataField throws and we fall back to numeric 255.
        const bs = new BitString()
        const [prioBits, prioLen] = PRIO.encode('PRIO_HIGH')
        const [typeBits, typeLen] = MESSAGE_TYPE.encode('ACTUATOR_CMD')
        const [btBits,   btLen]   = BOARD_TYPE.encode('BOARD_TYPE_ID_INJECTOR')
        const [biBits,   biLen]   = BOARD_INST.encode('BOARD_INST_ID_ROCKET')
        bs.push(prioBits, prioLen)
        bs.push(typeBits, typeLen)
        bs.push(btBits, btLen)
        bs.push(biBits, biLen)
        bs.push(0xffn, METADATA.length)
        const sid = bigintToBytes(bs.pop(MESSAGE_SID_LEN), Math.ceil(MESSAGE_SID_LEN / 8))

        const data = encodeFields([
            [MSG_FIELD_TIMESTAMP, 1.0],
            [new Enum('actuator_cmd_state', 8, actuator_state), 'ACT_STATE_ON'],
        ])

        const result = parseToObject(sid, data)
        if (isError(result)) throw new Error(`unexpected error: ${result.error}`)

        expect(result.msg_metadata).toBe(255)
        expect(result.msg_type).toBe('ACTUATOR_CMD')
        expect((result.data as MessagePayload<"ACTUATOR_CMD">).actuator_cmd_state).toBe('ACT_STATE_ON')
    })

    it('returns ParsleyError on bad msg_type', () => {
        // SID = 0x0000 — msg_type bits are all zero -> UNDEFINED (which is valid)
        // but we don't have enough SID bits, so this should still error.
        const sid = new Uint8Array([0x00, 0x00])
        const data = new Uint8Array([0xab, 0xcd, 0xef, 0x00])
        const result = parseToObject(sid, data)
        expect(isError(result)).toBe(true)
        if (isError(result)) expect(result.error).toContain('error')
    })

    it('returns ParsleyError on empty SID and data', () => {
        const result = parseToObject(new Uint8Array(), new Uint8Array())
        expect(isError(result)).toBe(true)
        if (isError(result)) expect(result.error).toContain('error')
    })

    it('returns ParsleyError on messed-up SID', () => {
        const sid = new Uint8Array([0xff, 0xff, 0xff, 0xff])
        const data = new Uint8Array([0x00, 0x00, 0x00, 0x00])
        const result = parseToObject(sid, data)
        expect(isError(result)).toBe(true)
        if (isError(result)) expect(result.error).toContain('error')
    })

    it('softens bad board_type_id to hexified string but still returns success', () => {
        // Manually build SID with board_type_id = 0x1F (invalid)
        const bs = new BitString()
        const [prioBits, prioLen] = PRIO.encode('PRIO_LOW')
        const [typeBits, typeLen] = MESSAGE_TYPE.encode('LEDS_ON')
        bs.push(prioBits, prioLen)
        bs.push(typeBits, typeLen)
        bs.push(0x1fn, BOARD_TYPE.length)
        bs.push(0x00n, BOARD_INST.length)
        bs.push(0x00n, METADATA.length)
        const sid = bigintToBytes(bs.pop(MESSAGE_SID_LEN), Math.ceil(MESSAGE_SID_LEN / 8))

        const result = parseToObject(sid, encodeFields([[MSG_FIELD_TIMESTAMP, 0]]))
        if (isError(result)) throw new Error(`unexpected error: ${result.error}`)

        expect(String(result.board_type_id)).toBe('0x1F')
        expect(String(result.board_inst_id)).toBe('BOARD_INST_ID_ANY')
        expect(result.msg_prio).toBe('PRIO_LOW')
        expect(result.msg_type).toBe('LEDS_ON')
    })

    it('returns ParsleyError on truncated msg_data', () => {
        const sid = createMsgSid(
            'PRIO_MEDIUM',
            'ALT_ARM_STATUS',
            'ALTIMETER_RAVEN',
            'BOARD_TYPE_ID_ALTIMETER',
            'BOARD_INST_ID_ANY',
            new Enum('msg_metadata', 8, altimeter_id),
        )
        // ALT_ARM_STATUS expects time(16) + alt_arm_state(8) + drogue_v(16) + main_v(16) = 56 bits = 7 bytes
        // Provide only 3 bytes.
        const data = new Uint8Array([0x00, 0x00, 0x01])
        const result = parseToObject(sid, data)
        expect(isError(result)).toBe(true)
        if (isError(result)) {
            expect(result.error).toContain('error')
            // SID-level fields must survive even on payload-decode failure (PR #66).
            expect(result.msg_prio).toBe('PRIO_MEDIUM')
            expect(result.board_type_id).toBe('BOARD_TYPE_ID_ALTIMETER')
            expect(result.board_inst_id).toBe('BOARD_INST_ID_ANY')
        }
    })

    it('ParsleyError carries msg_prio for unknown msg_type', () => {
        // SID with valid msg_prio bits but msg_type = 0x7F (out of range).
        const bs = new BitString()
        const [prioBits, prioLen] = PRIO.encode('PRIO_LOW')
        bs.push(prioBits, prioLen)
        bs.push(0x7fn, MESSAGE_TYPE.length)
        const [btBits, btLen] = BOARD_TYPE.encode('BOARD_TYPE_ID_GPS')
        bs.push(btBits, btLen)
        const [biBits, biLen] = BOARD_INST.encode('BOARD_INST_ID_ROCKET')
        bs.push(biBits, biLen)
        bs.push(0n, METADATA.length)
        const sid = bigintToBytes(bs.pop(MESSAGE_SID_LEN), Math.ceil(MESSAGE_SID_LEN / 8))

        const result = parseToObject(sid, new Uint8Array())
        expect(isError(result)).toBe(true)
        if (isError(result)) {
            expect(result.msg_prio).toBe('PRIO_LOW')
        }
    })

    it('early errors (short SID) use empty msg_prio', () => {
        const result = parseToObject(new Uint8Array(), new Uint8Array())
        expect(isError(result)).toBe(true)
        if (isError(result)) expect(result.msg_prio).toBe('')
    })

    it('softens bad board_inst_id to hexified string but still returns success', () => {
        const bs = new BitString()
        const [prioBits, prioLen] = PRIO.encode('PRIO_LOW')
        const [typeBits, typeLen] = MESSAGE_TYPE.encode('LEDS_ON')
        bs.push(prioBits, prioLen)
        bs.push(typeBits, typeLen)
        const [btBits, btLen] = BOARD_TYPE.encode('BOARD_TYPE_ID_GPS')
        bs.push(btBits, btLen)
        bs.push(0x1fn, BOARD_INST.length) // invalid board_inst_id
        bs.push(0x00n, METADATA.length)
        const sid = bigintToBytes(bs.pop(MESSAGE_SID_LEN), Math.ceil(MESSAGE_SID_LEN / 8))

        const result = parseToObject(sid, encodeFields([[MSG_FIELD_TIMESTAMP, 0]]))
        if (isError(result)) throw new Error(`unexpected error: ${result.error}`)

        expect(String(result.board_type_id)).toBe('BOARD_TYPE_ID_GPS')
        expect(String(result.board_inst_id)).toBe('0x1F')
        expect(result.msg_type).toBe('LEDS_ON')
    })

    it('returns an ACTUATOR_CMD payload discriminated by msg_type', () => {
        const sid = createMsgSid(
            'PRIO_HIGH',
            'ACTUATOR_CMD',
            'ACTUATOR_OX_INJECTOR_VALVE',
            'BOARD_TYPE_ID_INJECTOR',
            'BOARD_INST_ID_ROCKET',
            new Enum('msg_metadata', 8, actuator_id),
        )
        const data = encodeFields([
            [MSG_FIELD_TIMESTAMP, 1.0],
            [new Enum('actuator_cmd_state', 8, actuator_state), 'ACT_STATE_OFF'],
        ])

        const result = parseToObject(sid, data)
        if (isError(result)) throw new Error(`unexpected error: ${result.error}`)

        expect(result.msg_type).toBe('ACTUATOR_CMD')
        const payload = result.data as MessagePayload<"ACTUATOR_CMD">
        expect(Math.abs(payload.time - 1.0)).toBeLessThan(FLOAT_TOLERANCE)
        expect(payload.actuator_cmd_state).toBe('ACT_STATE_OFF')
    })

    it('decodes TELEMETRY_INFO with signed RSSI and channel ID metadata', () => {
        const sid = createMsgSid('PRIO_HIGH', 'TELEMETRY_INFO', 'BOARD_INST_ID_GROUND', 'BOARD_TYPE_ID_RLCS_RELAY', 'BOARD_INST_ID_GROUND',
            new Enum('msg_metadata', 8, board_inst))
        const result = parseToObject(sid, [0x00, 0x00, 0x01, 0xC4])
        if (isError(result)) throw new Error(`unexpected error: ${result.error}`)

        expect(result.msg_metadata).toBe('BOARD_INST_ID_GROUND')
        expect(result.data).toEqual({ time: 0, lqi: 1, rssi: -60 })
    })

    it('decodes CANARD_FIRMWARE_ERROR with module ID, error bitfield and severity', () => {
        const sid = createMsgSid('PRIO_HIGH', 'CANARD_FIRMWARE_ERROR', 'CANARDS_MODULE_ID_ADXL380', 'BOARD_TYPE_ID_RLCS_RELAY', 'BOARD_INST_ID_GROUND',
            new Enum('msg_metadata', 8, canards_module_id))
        const result = parseToObject(sid, [0x00, 0x00, 0x00, 0x00, 0x00, 0x05, 0x01])
        if (isError(result)) throw new Error(`unexpected error: ${result.error}`)

        expect(result.msg_metadata).toBe('CANARDS_MODULE_ID_ADXL380')
        expect(result.data).toEqual({
            time: 0,
            error_code: 'CANARDS_MODULE_E_BAT1_FAULT|CANARDS_MODULE_E_DEVICE_FAULT',
            severity: 'CANARDS_HEALTH_SEVERITY_HEALTH_ERROR',
        })
    })

    it('decodes RESET_CMD target board IDs', () => {
        const sid = createMsgSid('PRIO_HIGH', 'RESET_CMD', 0, 'BOARD_TYPE_ID_RLCS_RELAY', 'BOARD_INST_ID_GROUND')
        const result = parseToObject(sid, [0x00, 0x00, 0x0C, 0x01])
        if (isError(result)) throw new Error(`unexpected error: ${result.error}`)

        expect(result.data).toEqual({
            time: 0,
            target_board_type_id: 'BOARD_TYPE_ID_RLCS_RELAY',
            target_board_inst_id: 'BOARD_INST_ID_GROUND',
        })
    })

    it('decodes CONFIG_SET target board IDs', () => {
        const sid = createMsgSid('PRIO_HIGH', 'CONFIG_SET', 0, 'BOARD_TYPE_ID_RLCS_RELAY', 'BOARD_INST_ID_GROUND')
        const result = parseToObject(sid, [0x00, 0x00, 0x0C, 0x01, 0x00, 0x02, 0x00, 0x2A])
        if (isError(result)) throw new Error(`unexpected error: ${result.error}`)

        expect(result.data).toEqual({
            time: 0,
            target_board_type_id: 'BOARD_TYPE_ID_RLCS_RELAY',
            target_board_inst_id: 'BOARD_INST_ID_GROUND',
            config_id: 2,
            config_value: 42,
        })
    })
})

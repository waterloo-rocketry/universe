/*
RocketCAN message definitions.

Each message type is a class that owns:
- `static fields`        : ordered list of Field transcoders for the payload bytes
- `static metadataField` : Field used to decode the 8-bit Metadata in the SID (per-msg-type)
- `static decode(bs)`    : inherited generic decoder that walks `fields` and returns a typed instance

See: https://docs.waterloorocketry.com/avionics/rocketcan/packet-format.html
*/

import { BitString } from './bitString.js'
import { ASCII, Bitfield, Enum, Numeric } from './fields.js'
import type { Field } from './fields.js'
import {
    ActuatorId,
    ActuatorState,
    AltArmState,
    AltimeterId,
    AnalogSensorId,
    BoardErrorBitfieldOffset,
    BoardInstId,
    BoardTypeId,
    DemSensor2DId,
    DemSensor3DId,
    MsgPrio,
    MsgType,
} from './messageTypes.js'

// SID-level field constants (shared, not per-msg-type)

export const MESSAGE_PRIO     = new Enum('msg_prio', 2, MsgPrio)
export const MESSAGE_TYPE     = new Enum('msg_type', 7, MsgType)
export const BOARD_TYPE_ID    = new Enum('board_type_id', 6, BoardTypeId)
export const BOARD_INST_ID    = new Enum('board_inst_id', 6, BoardInstId)
export const MESSAGE_METADATA = new Numeric('msg_metadata', 8)
export const MESSAGE_SID_LEN =
    MESSAGE_PRIO.length +
    MESSAGE_TYPE.length +
    BOARD_TYPE_ID.length +
    BOARD_INST_ID.length +
    MESSAGE_METADATA.length

// Shared payload field: 16-bit millisecond timestamp, scaled to seconds.
export const TIMESTAMP_2 = new Numeric('time', 16, 1 / 1000, false, true, 's')

// Base class — owns the generic decoder

export class ParsleyDataPayload {
    static fields: Field[] = []
    static metadataField: Field = MESSAGE_METADATA

    constructor(data: Record<string, unknown>) {
        Object.assign(this, data)
    }

    static decode<T extends ParsleyDataPayload>(
        this: { new (data: Record<string, unknown>): T; fields: Field[] },
        bs: BitString,
    ): T {
        const data: Record<string, unknown> = {}
        for (const field of this.fields) {
            data[field.name] = field.decode(bs.pop(field.length, field.variable_length))
        }
        return new this(data)
    }
}

// One class per msg_type (24 total: UNDEFINED + 23 real types)

export class UNDEFINED extends ParsleyDataPayload {
    static override fields: Field[] = []
}

export class GENERAL_BOARD_STATUS extends ParsleyDataPayload {
    static override fields: Field[] = [
        TIMESTAMP_2,
        new Bitfield('board_error_bitfield', 32, 'E_NOMINAL', BoardErrorBitfieldOffset),
    ]
    declare time: number
    declare board_error_bitfield: string
}

export class RESET_CMD extends ParsleyDataPayload {
    static override fields: Field[] = [
        TIMESTAMP_2,
        new Enum('board_type_id', 8, BoardTypeId),
        new Enum('board_inst_id', 8, BoardInstId),
    ]
    declare time: number
    declare board_type_id: keyof typeof BoardTypeId
    declare board_inst_id: keyof typeof BoardInstId
}

export class DEBUG_RAW extends ParsleyDataPayload {
    static override fields: Field[] = [TIMESTAMP_2, new ASCII('string', 48)]
    declare time: number
    declare string: string
}

export class CONFIG_SET extends ParsleyDataPayload {
    static override fields: Field[] = [
        TIMESTAMP_2,
        new Enum('board_type_id', 8, BoardTypeId),
        new Enum('board_inst_id', 8, BoardInstId),
        new Numeric('config_id', 16),
        new Numeric('config_value', 16),
    ]
    declare time: number
    declare board_type_id: keyof typeof BoardTypeId
    declare board_inst_id: keyof typeof BoardInstId
    declare config_id: number
    declare config_value: number
}

export class CONFIG_STATUS extends ParsleyDataPayload {
    static override fields: Field[] = [
        TIMESTAMP_2,
        new Numeric('config_id', 16),
        new Numeric('config_value', 16),
    ]
    declare time: number
    declare config_id: number
    declare config_value: number
}

export class ACTUATOR_CMD extends ParsleyDataPayload {
    static override fields: Field[] = [
        TIMESTAMP_2,
        new Enum('cmd_state', 8, ActuatorState),
    ]
    static override metadataField: Field = new Enum('msg_metadata', 8, ActuatorId)
    declare time: number
    declare cmd_state: keyof typeof ActuatorState
}

export class ACTUATOR_STATUS extends ParsleyDataPayload {
    static override fields: Field[] = [
        TIMESTAMP_2,
        new Enum('cmd_state', 8, ActuatorState),
        new Enum('curr_state', 8, ActuatorState),
    ]
    static override metadataField: Field = new Enum('msg_metadata', 8, ActuatorId)
    declare time: number
    declare cmd_state: keyof typeof ActuatorState
    declare curr_state: keyof typeof ActuatorState
}

export class ALT_ARM_CMD extends ParsleyDataPayload {
    static override fields: Field[] = [
        TIMESTAMP_2,
        new Enum('alt_arm_state', 8, AltArmState),
    ]
    static override metadataField: Field = new Enum('msg_metadata', 8, AltimeterId)
    declare time: number
    declare alt_arm_state: keyof typeof AltArmState
}

export class ALT_ARM_STATUS extends ParsleyDataPayload {
    static override fields: Field[] = [
        TIMESTAMP_2,
        new Enum('alt_arm_state', 8, AltArmState),
        new Numeric('drogue_v', 16),
        new Numeric('main_v', 16),
    ]
    static override metadataField: Field = new Enum('msg_metadata', 8, AltimeterId)
    declare time: number
    declare alt_arm_state: keyof typeof AltArmState
    declare drogue_v: number
    declare main_v: number
}

export class SENSOR_ANALOG16 extends ParsleyDataPayload {
    static override fields: Field[] = [TIMESTAMP_2, new Numeric('value', 16)]
    static override metadataField: Field = new Enum('msg_metadata', 8, AnalogSensorId)
    declare time: number
    declare value: number
}

export class SENSOR_ANALOG32 extends ParsleyDataPayload {
    static override fields: Field[] = [TIMESTAMP_2, new Numeric('value', 32)]
    static override metadataField: Field = new Enum('msg_metadata', 8, AnalogSensorId)
    declare time: number
    declare value: number
}

export class SENSOR_2D_ANALOG24 extends ParsleyDataPayload {
    static override fields: Field[] = [
        TIMESTAMP_2,
        new Numeric('value_x', 24),
        new Numeric('value_y', 24),
    ]
    static override metadataField: Field = new Enum('msg_metadata', 8, DemSensor2DId)
    declare time: number
    declare value_x: number
    declare value_y: number
}

export class SENSOR_3D_ANALOG16 extends ParsleyDataPayload {
    static override fields: Field[] = [
        TIMESTAMP_2,
        new Numeric('value_x', 16),
        new Numeric('value_y', 16),
        new Numeric('value_z', 16),
    ]
    static override metadataField: Field = new Enum('msg_metadata', 8, DemSensor3DId)
    declare time: number
    declare value_x: number
    declare value_y: number
    declare value_z: number
}

export class GPS_TIMESTAMP extends ParsleyDataPayload {
    static override fields: Field[] = [
        TIMESTAMP_2,
        new Numeric('hrs', 8),
        new Numeric('mins', 8),
        new Numeric('secs', 8),
        new Numeric('dsecs', 8),
    ]
    declare time: number
    declare hrs: number
    declare mins: number
    declare secs: number
    declare dsecs: number
}

export class GPS_LATITUDE extends ParsleyDataPayload {
    static override fields: Field[] = [
        TIMESTAMP_2,
        new Numeric('degs', 8),
        new Numeric('mins', 8),
        new Numeric('dmins', 16),
        new ASCII('direction', 8),
    ]
    declare time: number
    declare degs: number
    declare mins: number
    declare dmins: number
    declare direction: string
}

export class GPS_LONGITUDE extends ParsleyDataPayload {
    static override fields: Field[] = [
        TIMESTAMP_2,
        new Numeric('degs', 8),
        new Numeric('mins', 8),
        new Numeric('dmins', 16),
        new ASCII('direction', 8),
    ]
    declare time: number
    declare degs: number
    declare mins: number
    declare dmins: number
    declare direction: string
}

export class GPS_ALTITUDE extends ParsleyDataPayload {
    static override fields: Field[] = [
        TIMESTAMP_2,
        new Numeric('altitude', 32),
        new Numeric('daltitude', 8),
    ]
    declare time: number
    declare altitude: number
    declare daltitude: number
}

export class GPS_INFO extends ParsleyDataPayload {
    static override fields: Field[] = [
        TIMESTAMP_2,
        new Numeric('num_sats', 8),
        new Numeric('quality', 8),
    ]
    declare time: number
    declare num_sats: number
    declare quality: number
}

export class STREAM_STATUS extends ParsleyDataPayload {
    static override fields: Field[] = [
        TIMESTAMP_2,
        new Numeric('total_size', 24),
        new Numeric('tx_size', 24),
    ]
    declare time: number
    declare total_size: number
    declare tx_size: number
}

export class STREAM_DATA extends ParsleyDataPayload {
    // Metadata is SEQ_ID (numeric per docs); inherits default MESSAGE_METADATA.
    static override fields: Field[] = [TIMESTAMP_2, new ASCII('data', 48)]
    declare time: number
    declare data: string
}

export class STREAM_RETRY extends ParsleyDataPayload {
    static override fields: Field[] = [TIMESTAMP_2]
    declare time: number
}

export class LEDS_ON extends ParsleyDataPayload {
    static override fields: Field[] = []
}

export class LEDS_OFF extends ParsleyDataPayload {
    static override fields: Field[] = []
}

// Registry — exhaustive coverage of MsgType enforced by `satisfies`

export const MESSAGE_DEFS = {
    UNDEFINED,
    GENERAL_BOARD_STATUS,
    RESET_CMD,
    DEBUG_RAW,
    CONFIG_SET,
    CONFIG_STATUS,
    ACTUATOR_CMD,
    ACTUATOR_STATUS,
    ALT_ARM_CMD,
    ALT_ARM_STATUS,
    SENSOR_ANALOG16,
    SENSOR_ANALOG32,
    SENSOR_2D_ANALOG24,
    SENSOR_3D_ANALOG16,
    GPS_TIMESTAMP,
    GPS_LATITUDE,
    GPS_LONGITUDE,
    GPS_ALTITUDE,
    GPS_INFO,
    STREAM_STATUS,
    STREAM_DATA,
    STREAM_RETRY,
    LEDS_ON,
    LEDS_OFF,
} satisfies Record<keyof typeof MsgType, typeof ParsleyDataPayload>

export type MessageDefKey = keyof typeof MESSAGE_DEFS

// Discriminated union — `data` is a class instance, `msg_metadata` is loose (string | number)

type ParsleyMessageEntry<K extends MessageDefKey> = {
    msg_prio: keyof typeof MsgPrio | string
    msg_type: K
    board_type_id: keyof typeof BoardTypeId | string
    board_inst_id: keyof typeof BoardInstId | string
    msg_metadata: string | number
    data: InstanceType<(typeof MESSAGE_DEFS)[K]> | null
}

export type ParsleyMessage = {
    [K in MessageDefKey]: ParsleyMessageEntry<K>
}[MessageDefKey]

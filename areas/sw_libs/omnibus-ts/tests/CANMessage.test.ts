import { describe, expect, it } from 'vitest'

import {
    CANCommandMessageSchema,
    ParsleyMessageSchema,
} from '../src/data/CANMessage.js'
import { DAQMessageSchema } from '../src/data/DAQMessage.js'
import { snakeCaseParser, toSnakeCase } from '../src/helpers.js'

describe('Parsley CAN message schemas', () => {
    const canMessage = {
        boardTypeId: 'INJECTOR',
        boardInstId: 'ROCKET',
        msgPrio: 'HIGH' as const,
        msgType: 'SENSOR_ANALOG16',
        msgMetadata: 'SENSOR_PT_CHANNEL_1',
    }

    it('accepts Parsley message metadata names and numeric metadata bytes', () => {
        expect(
            ParsleyMessageSchema.parse({
                ...canMessage,
                data: { value: 800 },
                parsley: 'test-instance',
                messageFormatVersion: 2,
            }).msgMetadata
        ).toBe('SENSOR_PT_CHANNEL_1')

        expect(
            ParsleyMessageSchema.parse({
                ...canMessage,
                msgMetadata: 255,
                data: null,
                parsley: 'test-instance',
                messageFormatVersion: 2,
            }).msgMetadata
        ).toBe(255)
    })

    it('rejects invalid metadata values', () => {
        expect(() =>
            ParsleyMessageSchema.parse({
                ...canMessage,
                msgMetadata: 256,
                data: null,
                parsley: 'test-instance',
                messageFormatVersion: 2,
            })
        ).toThrow()

        expect(() =>
            ParsleyMessageSchema.parse({
                ...canMessage,
                msgMetadata: '',
                data: null,
                parsley: 'test-instance',
                messageFormatVersion: 2,
            })
        ).toThrow()
    })

    it('normalizes the nested CAN command wire payload', () => {
        const payload = snakeCaseParser(CANCommandMessageSchema).parse({
            data: {
                can_msg: {
                    board_type_id: 'INJECTOR',
                    board_inst_id: 'ROCKET',
                    msg_prio: 'HIGH',
                    msg_type: 'SENSOR_ANALOG16',
                    msg_metadata: 'SENSOR_PT_CHANNEL_1',
                    sensor_value: 800,
                },
            },
            parsley: 'test-instance',
            message_format_version: 2,
        })

        expect(payload.data.canMsg).toMatchObject({
            ...canMessage,
            sensorValue: 800,
        })
        expect(
            toSnakeCase({
                ...payload,
                data: { canMsg: payload.data.canMsg },
            })
        ).toMatchObject({
            data: {
                can_msg: {
                    board_type_id: 'INJECTOR',
                    board_inst_id: 'ROCKET',
                    msg_prio: 'HIGH',
                    msg_type: 'SENSOR_ANALOG16',
                    msg_metadata: 'SENSOR_PT_CHANNEL_1',
                    sensor_value: 800,
                },
            },
        })
    })

    it('preserves non-CAN data record keys exactly', () => {
        const wirePayload = {
            timestamp: 1,
            data: {
                Fake1: [1, 2, 3, 5],
                sensor_value: [800],
                alreadyCamel: [900],
            },
            relative_timestamps: [0],
            sample_rate: 100,
            message_format_version: 3,
        }

        const payload = snakeCaseParser(DAQMessageSchema).parse(wirePayload)

        expect(payload.data).toStrictEqual({
            Fake1: [1, 2, 3, 5],
            sensor_value: [800],
            alreadyCamel: [900],
        })
        expect(toSnakeCase(payload)).toStrictEqual(wirePayload)
    })
})

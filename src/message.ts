// TODO: Maybe there's a better name for this file?

import { io } from 'socket.io-client'
import msgpackParser from 'socket.io-msgpack-parser'
import { snakeCaseParser, toSnakeCase } from './helpers.js'
import { tryit } from 'radash'

import { z } from 'zod'

import { DAQMessageSchema } from './data/DAQMessage.js'
import type { DAQMessage } from './data/DAQMessage.ts'

import {
    ParsleyMessageSchema,
    CANCommandMessageSchema,
    RLCSv3MessageSchema,
    ParsleyHeartbeatMessageSchema,
} from './data/CANMessage.js'

import type {
    ParsleyMessage,
    CANCommandMessage,
    RLCSv3Message,
    ParsleyHeartbeatMessage,
} from './data/CANMessage.ts'

export type AnyPayload =
    | DAQMessage
    | ParsleyMessage
    | CANCommandMessage
    | RLCSv3Message
    | ParsleyHeartbeatMessage

type ChannelLiteralToPayloadType<T extends AnyPayload> =
    T extends DAQMessage ? `DAQ/${string}` | 'DAQ'
    : T extends ParsleyMessage ? `CAN/Parsley/${string}` | 'CAN/Parsley'
    : T extends CANCommandMessage ? `CAN/Commands/${string}` | 'CAN/Commands'
    : T extends ParsleyHeartbeatMessage ?
        `Parsley/Health/${string}` | 'Parsley/Health'
    : T extends RLCSv3Message ? `RLCS/${string}` | 'RLCS'
    : never

export interface Message<T extends AnyPayload> {
    channel: string
    timestamp: number
    payload: T
}

export interface MessageToSend<T extends AnyPayload> extends Message<T> {
    channel: ChannelLiteralToPayloadType<T>
}

const getPayloadSchemaFromChannel = (channel: unknown) => {
    if (typeof channel !== 'string') {
        throw new Error(
            `[Omnibus] Channel must be a string, got: ${typeof channel}`
        )
    }

    const mapChannelPrefix: Record<string, z.ZodObject | z.ZodRecord> = {
        DAQ: DAQMessageSchema,
        'CAN/Parsley': ParsleyMessageSchema,
        'CAN/Commands': CANCommandMessageSchema,
        'Parsley/Health': ParsleyHeartbeatMessageSchema,
        RLCS: RLCSv3MessageSchema,
    }

    const channelPrefix = Object.keys(mapChannelPrefix).find((prefix) => {
        const channelParts = channel.split('/')
        return prefix.split('/').every((part, i) => channelParts[i] === part)
    })

    return channelPrefix ? mapChannelPrefix[channelPrefix] : undefined
}

export const socketCallbackBuilder = <T extends AnyPayload>(
    channel: string,
    afterMessageReceived: (msg: Message<T>) => void
) => {
    const buildMessageObject = (
        channel: string,
        timestamp: number,
        payload: object
    ) => {
        return {
            channel: channel,
            timestamp: timestamp,
            payload: payload as T,
        }
    }

    const eventHandler = (
        event: string,
        timestamp: number,
        payload: object
    ) => {
        if (!event.startsWith(channel) && channel !== '') return

        const [schemaGetError, schema] = tryit(getPayloadSchemaFromChannel)(
            event
        )

        if (schemaGetError) {
            console.warn(schemaGetError)
            return
        }

        if (!schema) {
            console.warn(
                '[Omnibus] Received message on unknown channel:',
                event
            )
            return
        }

        const [parserError, messagePayload] = tryit(
            snakeCaseParser(schema).parse
        )(payload)

        if (parserError) {
            console.warn(
                `[Omnibus] Received malformed payload on channel ${event}:`,
                parserError
            )
            return
        }

        const msgObject = buildMessageObject(event, timestamp, messagePayload)
        afterMessageReceived(msgObject)
    }

    return eventHandler
}

export function getOmnibusSenderReceiver(serverURL: string) {
    const socket = io(serverURL, {
        parser: msgpackParser,
        transports: ['websocket'],
        upgrade: false,
    })

    const send = <T extends AnyPayload>(msg: MessageToSend<T>) => {
        socket.emit(msg.channel, msg.timestamp, toSnakeCase(msg.payload))
    }

    const _attachReceiver = <T extends AnyPayload>(
        channel: string | '',
        callback: (msg: Message<T>) => void
    ) => {
        const handler = socketCallbackBuilder(channel, callback)
        socket.onAny(handler)
        return () => socket.offAny(handler)
    }

    const receive = <T extends AnyPayload>(
        channel: ChannelLiteralToPayloadType<T>,
        callback: (msg: Message<T>) => void
    ) => {
        return _attachReceiver(channel, callback)
    }

    const receiveAll = (callback: (msg: Message<AnyPayload>) => void) => {
        return _attachReceiver('', callback)
    }

    // No static type checking or runtime sanity checks
    const unsafeReceiveGenericMessage = <T = unknown>(
        callback: ({
            channel,
            timestamp,
            payload,
        }: {
            channel: string
            timestamp: number
            payload: T
        }) => void
    ) => {
        const fn = (event: string, timestamp: number, payload: T) => {
            callback({ channel: event, timestamp, payload })
        }
        socket.onAny(fn)
        return () => socket.offAny(fn)
    }

    const disconnect = () => {
        socket.disconnect()
    }

    return {
        socket,
        sender: { send },
        receiver: {
            receive,
            receiveAll,
        },
        unsafeReceiveGenericMessage,
        disconnect,
    }
}

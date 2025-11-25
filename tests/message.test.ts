import { expect, describe, it, beforeAll, afterAll, vi } from 'vitest'
import express from 'express'
import { createServer, Server as HTTPServer } from 'node:http'
import { Server } from 'socket.io'
import msgpackParser from 'socket.io-msgpack-parser'

import { communicator } from '../src/index.js'

import { Message, AnyPayload } from '../src/message.ts'

import type { DAQMessage } from '../src/data/DAQMessage.ts'

describe('test Omnibus communication functions', () => {
    let server: HTTPServer | null = null

    beforeAll(() => {
        const app = express()
        server = createServer(app)
        const io = new Server(server, {
            cors: {
                origin: '*',
                methods: ['GET', 'POST'],
            },
            transports: ['websocket'],
            parser: msgpackParser,
        })

        io.on('connection', (socket) => {
            console.log('connection established, sid: ' + socket.id)
            socket.onAny((event, ...args) => {
                // Echo back the received event and arguments
                socket.emit(event, ...args)
            })
        })
        server.listen(3000)
    })

    afterAll(() => {
        expect(server).not.toBeNull()
        server?.close()
    })

    const getCommunicatorInstance = async () => {
        const c = communicator({
            serverURL: 'http://localhost:3000',
            allowExposeSocket: true,
            allowUnsafe: true,
        })
        await new Promise((res) => {
            expect(c.socket).toBeDefined()
            c.socket?.on('connect', () => res('Connected'))
        })
        return c
    }

    it('should establish a connection', async () => {
        const fns = await getCommunicatorInstance()
        expect(fns.socket?.id).not.toBeUndefined()
    })

    it('should send and receive messages', async () => {
        const fns = await getCommunicatorInstance()
        const testChannel = 'Test/AnyMessage'
        const testPayload = 'test'
        const p = new Promise<{ channel: string; payload: string }>((res) => {
            expect(fns.unsafeReceiveGenericMessage).toBeDefined()
            if (!fns.unsafeReceiveGenericMessage) return
            fns.unsafeReceiveGenericMessage(({ channel, payload }) => {
                res({ channel, payload: payload as string })
            })
        })
        fns.socket?.emit(testChannel, Date.now() / 1000, testPayload)
        const res = await p
        expect(res.channel).toBe(testChannel)
        expect(res.payload).toBe('test')
    })

    it('should send and receive multiple typed messages for a given prefix', async () => {
        const fns = await getCommunicatorInstance()
        const testChannel = 'DAQ/abdiabdu'
        const secondChannel = 'DAQ/abdc'
        const testPayload = {
            timestamp: Date.now() / 1000,
            data: { sensor1: [1, 2, 3], sensor2: [4, 5, 6] } as Record<
                string,
                number[]
            >,
            relativeTimestamps: [0, 1, 2],
            sampleRate: 1000,
            messageFormatVersion: 3,
        } as DAQMessage

        const arr: Message<DAQMessage>[] = []
        const allMessages: Message<AnyPayload>[] = []

        fns.receiver.receive<DAQMessage>('DAQ', (msg) => {
            arr.push(msg)
        })

        let i = 0
        const q = new Promise((res) =>
            fns.receiver.receiveAll((msg) => {
                allMessages.push(msg)
                if (i == 2) {
                    res(msg)
                } else {
                    i++
                }
            })
        )

        fns.sender.send({
            channel: testChannel,
            timestamp: 1,
            payload: testPayload,
        })
        fns.sender.send({
            channel: secondChannel,
            timestamp: 3,
            payload: testPayload,
        })

        // Should be ignored
        fns.sender.send({
            channel: 'Parsley/Health/DESKTOP-6454HW',
            timestamp: 5,
            payload: { id: 'DESKTOP-6454HW/USB', health: 'HEALTHY' },
        })
        await q

        expect(arr.length).toBe(2)
        expect(arr[0].channel).toBe(testChannel)
        expect(arr[0].payload).toStrictEqual(testPayload)
        expect(arr[1].channel).toBe(secondChannel)
        expect(arr[0].timestamp).toBe(1)
        expect(arr[1].timestamp).toBe(3)

        expect(allMessages.length).toBe(3)
    })

    it('should disconnect properly', async () => {
        const fns = await getCommunicatorInstance()
        expect(fns.socket).toBeDefined()
        fns.disconnect()
        expect(fns.socket?.id).not.toBeDefined()
        expect(fns.socket?.connected).toBe(false)
    })

    // TODO: Fix this so it doesn't depend as much on the implementation (Chris Yang <chrisyx511@gmail.com>)
    it('should throw error on null payload', async () => {
        const fns = await getCommunicatorInstance()
        const a = vi
            .spyOn(console, 'warn')
            .mockImplementationOnce(() => undefined)
        const b = vi
            .spyOn(console, 'log')
            .mockImplementationOnce(() => undefined)
        const c = vi
            .spyOn(fns.socket!, 'onAny')
            .mockImplementationOnce((callback) => {
                return fns.socket!.onAny((...args) => {
                    callback(...args)
                    expect(console.warn).toHaveBeenCalledWith(
                        expect.stringContaining('Received malformed payload'),
                        expect.any(Error)
                    )
                    expect(console.warn).toHaveBeenCalledTimes(1)
                    a.mockClear()
                    b.mockClear()
                    c.mockClear()
                })
            })
        fns.receiver.receiveAll((msg) => {
            console.log(msg)
        })
        expect(fns.socket!.onAny).toHaveBeenCalled()
        fns.socket?.emit('DAQ', Date.now() / 1000, null)
    })

    it('should throw error on bad payload', async () => {
        const fns = await getCommunicatorInstance()
        const a = vi
            .spyOn(console, 'warn')
            .mockImplementationOnce(() => undefined)
        const b = vi
            .spyOn(console, 'log')
            .mockImplementationOnce(() => undefined)
        const c = vi
            .spyOn(fns.socket!, 'onAny')
            .mockImplementationOnce((callback) => {
                return fns.socket!.onAny((...args) => {
                    callback(...args)
                    expect(console.warn).toHaveBeenCalledWith(
                        expect.stringContaining('Received malformed payload'),
                        expect.any(Error)
                    )
                    expect(console.warn).toHaveBeenCalledTimes(1)
                    a.mockClear()
                    b.mockClear()
                    c.mockClear()
                })
            })
        fns.receiver.receiveAll((msg) => {
            console.log(msg)
        })
        expect(fns.socket!.onAny).toHaveBeenCalled()
        fns.socket?.emit('DAQ', Date.now() / 1000, 'string or something')
    })

    it('should throw error on bad timestamp', async () => {
        const fns = await getCommunicatorInstance()
        const a = vi
            .spyOn(console, 'warn')
            .mockImplementationOnce(() => undefined)
        const b = vi
            .spyOn(console, 'log')
            .mockImplementationOnce(() => undefined)
        const c = vi
            .spyOn(fns.socket!, 'onAny')
            .mockImplementationOnce((callback) => {
                return fns.socket!.onAny((...args) => {
                    callback(...args)
                    expect(console.warn).toHaveBeenCalledWith(
                        expect.stringContaining('Received malformed payload'),
                        expect.any(Error)
                    )
                    expect(console.warn).toHaveBeenCalledTimes(1)
                    a.mockClear()
                    b.mockClear()
                    c.mockClear()
                })
            })
        fns.receiver.receiveAll((msg) => {
            console.log(msg)
        })
        expect(fns.socket!.onAny).toHaveBeenCalled()
        fns.socket?.emit('DAQ', 'bad timestamp', 'string or something')
    })
})

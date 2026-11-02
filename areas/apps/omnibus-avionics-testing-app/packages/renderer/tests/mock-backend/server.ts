import { Server } from 'socket.io'
import msgpackParser from 'socket.io-msgpack-parser'
import type { ParsleyMessage } from '@waterloorocketry/omnibus-ts'

interface Identifier {
    type_id: string
    inst_id: string
}

const identifiers: Identifier[] = [
    { type_id: 'TYPE-1', inst_id: 'INST-1' },
    { type_id: 'TYPE-2', inst_id: 'INST-2' },
    { type_id: 'TYPE-3', inst_id: 'INST-3' },
    { type_id: 'TYPE-4', inst_id: 'INST-4' },
]

const io = new Server(8081, {
    cors: { origin: '*' },
    parser: msgpackParser,
})

const MsgPrioSchema = ['LOW', 'MEDIUM', 'HIGH', 'HIGHEST'] as const

const STATUSES = ['OK', 'WARN', 'ERROR'] as const

function randomInt(min: number, max: number) {
    return Math.floor(Math.random() * (max - min + 1)) + min
}

function randomFloat(min: number, max: number) {
    return parseFloat((Math.random() * (max - min) + min).toFixed(2))
}

let currentIndex = 0 // Track the current index in the identifiers array

function generateSequentialUpdate(): ParsleyMessage<{
    status: (typeof STATUSES)[number]
    value: number
}> {
    // Get the current board type and instance
    const { type_id, inst_id } = identifiers[currentIndex]

    // Move to the next board, looping back to the start if necessary
    currentIndex = (currentIndex + 1) % identifiers.length

    // Generate the update for the current board
    return {
        boardTypeId: type_id,
        boardInstId: inst_id,
        msgPrio: MsgPrioSchema[randomInt(0, MsgPrioSchema.length - 1)],
        msgType: 'SENSOR',
        data: {
            status: STATUSES[randomInt(0, STATUSES.length - 1)],
            value: randomFloat(0.0, 100.0),
        },
        parsley: 'mock-payload',
        messageFormatVersion: 2,
    }
}

io.on('connection', (socket) => {
    console.log(`Client connected: ${socket.id}`)

    const interval = setInterval(() => {
        const updates = generateSequentialUpdate()
        console.log(updates)
        socket.emit('CAN/Parsley', Date.now() / 1000, updates)
    }, 500)

    socket.on('disconnect', () => {
        console.log(`Client disconnected: ${socket.id}`)

        clearInterval(interval)
    })
})

console.log('Mock Omnibus server running on http://localhost:8081')

console.log(' Using msgpack parser (matching omnibus-ts client)')

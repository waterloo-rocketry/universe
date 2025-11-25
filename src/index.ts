import { getOmnibusSenderReceiver } from './message.js'

export type * from './data/DAQMessage.ts'
export type * from './data/CANMessage.ts'

const communicator = ({
    serverURL,
    allowUnsafe = false,
    allowExposeSocket = false,
}: {
    serverURL: string
    allowUnsafe?: boolean
    allowExposeSocket?: boolean
}) => {
    const fns = getOmnibusSenderReceiver(serverURL)
    const res: {
        socket?: typeof fns.socket
        sender: typeof fns.sender
        receiver: typeof fns.receiver
        unsafeReceiveGenericMessage?: typeof fns.unsafeReceiveGenericMessage
        disconnect: typeof fns.disconnect
    } = {
        sender: fns.sender,
        receiver: fns.receiver,
        disconnect: fns.disconnect,
    }
    if (allowUnsafe) {
        res.unsafeReceiveGenericMessage = fns.unsafeReceiveGenericMessage
    }
    if (allowExposeSocket) {
        res.socket = fns.socket
    }

    return res
}

export { communicator }

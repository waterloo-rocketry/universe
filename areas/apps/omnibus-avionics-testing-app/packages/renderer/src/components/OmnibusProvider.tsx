import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { communicator } from '@waterloorocketry/omnibus-ts'
import type { ParsleyMessage } from '@waterloorocketry/omnibus-ts'
import { useOmnibusStore } from '@/store/omnibusStore'

type ConnectionStatus = 'connected' | 'disconnected' | 'connecting' | 'error'
type OmnibusCommunicator = ReturnType<typeof communicator>

interface OmnibusContextValue {
    connectionStatus: ConnectionStatus
    errorMessage: string
    connect: (url: string) => void
    disconnect: () => void
}

const OmnibusContext = createContext<OmnibusContextValue | null>(null)

export function OmnibusProvider({ children }: { children: ReactNode }) {
    const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('disconnected')
    const [errorMessage, setErrorMessage] = useState<string>('')
    const omnibusRef = useRef<OmnibusCommunicator | null>(null)
    const [serverURL, setServerURL] = useState<string | null>(null)
    const [reconnectCounter, setReconnectCounter] = useState<number>(0)

    useEffect(() => {
        if (!serverURL) return

        setConnectionStatus('connecting')
        setErrorMessage('')

        const newOmnibus = communicator({ serverURL, allowExposeSocket: true })

        if (!newOmnibus.socket) {
            setErrorMessage('Failed to initialize socket connection.')
            setConnectionStatus('error')
            newOmnibus.disconnect()
            return
        }

        omnibusRef.current = newOmnibus

        newOmnibus.socket.on('connect', () => {
            setConnectionStatus('connected')
        })

        newOmnibus.socket.on('connect_error', (err) => {
            setErrorMessage('Failed to connect: ' + err.message)
            setConnectionStatus('error')
            newOmnibus.disconnect()
            omnibusRef.current = null
        })

        newOmnibus.receiver.receive<ParsleyMessage>("CAN/Parsley", (msg) => {
            const typeID = msg.payload.boardTypeId
            const instID = msg.payload.boardInstId
            const key = `${typeID}-${instID}`
            useOmnibusStore.getState().updateSeries(key, msg.payload)
        })

        return () => {
            newOmnibus.disconnect()
            omnibusRef.current = null
        }
    }, [serverURL, reconnectCounter])

    const connect = useCallback((url: string) => {
        setServerURL(url)
        setReconnectCounter((c) => c + 1)
    }, [])

    const disconnect = useCallback(() => {
        omnibusRef.current?.disconnect()
        omnibusRef.current = null
        setServerURL(null)
        setConnectionStatus('disconnected')
    }, [])

    return (
        <OmnibusContext.Provider value={{ connectionStatus, errorMessage, connect, disconnect }}>
            {children}
        </OmnibusContext.Provider>
    )
}

export function useOmnibus(): OmnibusContextValue {
    const ctx = useContext(OmnibusContext)
    if (!ctx) throw new Error('useOmnibus must be used within OmnibusProvider')
    return ctx
}

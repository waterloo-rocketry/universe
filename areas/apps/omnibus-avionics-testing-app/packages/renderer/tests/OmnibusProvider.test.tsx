import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen, act, waitFor } from '@testing-library/react'
import { OmnibusProvider, useOmnibus } from '@/components/OmnibusProvider'

// --- Hoist mocks so they're available when vi.mock factory runs ---
const { mockOn, mockDisconnect, mockReceive, mockCommunicator, mockUpdateSeries } = vi.hoisted(
    () => {
        const mockOn = vi.fn()
        const mockDisconnect = vi.fn()
        const mockUpdateSeries = vi.fn()
        const mockReceive = vi.fn()
        const mockCommunicator = vi.fn(() => ({
            socket: { on: mockOn },
            disconnect: mockDisconnect,
            sender: { send: vi.fn() },
            receiver: {
                receive: mockReceive,
                receiveAll: vi.fn(),
            },
        }))
        return { mockOn, mockDisconnect, mockReceive, mockCommunicator, mockUpdateSeries }
    }
)

vi.mock('@waterloorocketry/omnibus-ts', () => ({
    communicator: mockCommunicator,
}))

vi.mock('@/store/omnibusStore', () => ({
    useOmnibusStore: {
        getState: () => ({
            updateSeries: mockUpdateSeries,
        }),
    },
}))

// --- Helper to fire socket events registered via mockOn ---
function emitSocketEvent(eventName: string, ...args: unknown[]) {
    const calls = mockOn.mock.calls as [string, (...a: unknown[]) => void][]
    const handler = calls.find(([name]) => name === eventName)?.[1]
    if (!handler) throw new Error(`No handler registered for '${eventName}'`)
    handler(...args)
}

// --- Helper to fire receiver.receive handlers ---
function emitReceiveEvent(channel: string, payload: unknown) {
    const calls = mockReceive.mock.calls as [string, (msg: { payload: unknown }) => void][]
    const handler = calls.find(([name]) => name === channel)?.[1]
    if (!handler) throw new Error(`No handler registered for '${channel}'`)
    handler({ payload })
}

// --- Test component that exposes provider state ---
function StatusDisplay() {
    const { connectionStatus, errorMessage, connect, disconnect } = useOmnibus()
    return (
        <div>
            <span data-testid="status">{connectionStatus}</span>
            <span data-testid="error">{errorMessage}</span>
            <button onClick={() => connect('http://localhost:8081')}>connect</button>
            <button onClick={disconnect}>disconnect</button>
        </div>
    )
}

function renderWithProvider() {
    return render(
        <OmnibusProvider>
            <StatusDisplay />
        </OmnibusProvider>
    )
}

describe('OmnibusProvider', () => {
    beforeEach(() => {
        mockOn.mockClear()
        mockDisconnect.mockClear()
        mockCommunicator.mockClear()
        mockReceive.mockClear()
        mockUpdateSeries.mockClear()
        mockCommunicator.mockReturnValue({
            socket: { on: mockOn },
            disconnect: mockDisconnect,
            sender: { send: vi.fn() },
            receiver: {
                receive: mockReceive,
                receiveAll: vi.fn(),
            },
        })
    })

    it('starts with disconnected status', () => {
        renderWithProvider()
        expect(screen.getByTestId('status').textContent).toBe('disconnected')
    })

    it('sets status to connecting when connect() is called', async () => {
        renderWithProvider()
        act(() => {
            screen.getByText('connect').click()
        })
        expect(screen.getByTestId('status').textContent).toBe('connecting')
    })

    it('sets status to connected on socket connect event', async () => {
        renderWithProvider()
        act(() => {
            screen.getByText('connect').click()
        })
        act(() => {
            emitSocketEvent('connect')
        })
        await waitFor(() => {
            expect(screen.getByTestId('status').textContent).toBe('connected')
        })
    })

    it('sets error status and message on connect_error event', async () => {
        renderWithProvider()
        act(() => {
            screen.getByText('connect').click()
        })
        act(() => {
            emitSocketEvent('connect_error', { message: 'refused' })
        })
        await waitFor(() => {
            expect(screen.getByTestId('status').textContent).toBe('error')
            expect(screen.getByTestId('error').textContent).toContain('refused')
        })
    })

    it('calls disconnect on the communicator after connect_error', async () => {
        renderWithProvider()
        act(() => {
            screen.getByText('connect').click()
        })
        act(() => {
            emitSocketEvent('connect_error', { message: 'refused' })
        })
        await waitFor(() => {
            expect(mockDisconnect).toHaveBeenCalledOnce()
        })
    })

    it('sets status to disconnected when disconnect() is called', async () => {
        renderWithProvider()
        act(() => {
            screen.getByText('connect').click()
        })
        act(() => {
            emitSocketEvent('connect')
        })
        await waitFor(() => {
            expect(screen.getByTestId('status').textContent).toBe('connected')
        })
        act(() => {
            screen.getByText('disconnect').click()
        })
        await waitFor(() => {
            expect(screen.getByTestId('status').textContent).toBe('disconnected')
        })
    })

    it('sets error status when socket is undefined', async () => {
        mockCommunicator.mockReturnValueOnce({
            socket: undefined,
            disconnect: mockDisconnect,
            sender: { send: vi.fn() },
            receiver: {
                receive: mockReceive,
                receiveAll: vi.fn(),
            },
        } as any)
        renderWithProvider()
        act(() => {
            screen.getByText('connect').click()
        })
        await waitFor(() => {
            expect(screen.getByTestId('status').textContent).toBe('error')
        })
        expect(mockDisconnect).toHaveBeenCalledOnce()
    })

    it('handles CAN/Parsley message and calls updateSeries', async () => {
        renderWithProvider()
        act(() => {
            screen.getByText('connect').click()
        })
        await waitFor(() => {
            expect(mockReceive).toHaveBeenCalledWith('CAN/Parsley', expect.any(Function))
        })
        act(() => {
            emitReceiveEvent('CAN/Parsley', {
                boardTypeId: 'type1',
                boardInstId: 'inst1',
                data: { status: 'OK', value: 42 },
            })
        })
        await waitFor(() => {
            expect(mockUpdateSeries).toHaveBeenCalledWith('type1-inst1', {
                boardTypeId: 'type1',
                boardInstId: 'inst1',
                data: { status: 'OK', value: 42 },
            })
        })
    })
})

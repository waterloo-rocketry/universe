import { describe, expect, it } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { OmnibusProvider } from '@/components/OmnibusProvider'
import App from '@/App'

function renderApp() {
    return render(
        <OmnibusProvider>
            <App />
        </OmnibusProvider>
    )
}

describe('App Component', () => {
    it('renders without crashing', () => {
        renderApp()
        expect(screen.getByText(/Disconnected/i)).toBeDefined()
    })

    it('shows Connect to Omnibus button initially', () => {
        renderApp()
        expect(screen.getByText(/Connect to Omnibus/i)).toBeDefined()
    })

    it('opens the connect dialog when Connect to Omnibus is clicked', () => {
        renderApp()
        fireEvent.click(screen.getByText(/Connect to Omnibus/i))
        expect(screen.getByRole('dialog')).toBeDefined()
        expect(screen.getByLabelText(/Server Address/i)).toBeDefined()
    })

    it('connect button in dialog is enabled when input has a value', () => {
        renderApp()
        fireEvent.click(screen.getByText(/Connect to Omnibus/i))
        const input = screen.getByLabelText(/Server Address/i)
        fireEvent.change(input, { target: { value: 'http://localhost:8081' } })
        const connectBtn = screen.getByRole('button', { name: /^Connect$/i })
        expect((connectBtn as HTMLButtonElement).disabled).toBe(false)
    })

    it('does not show Disconnect button initially', () => {
        renderApp()
        expect(screen.queryByText(/^Disconnect$/i)).toBeNull()
    })

    it('renders CanSender component', () => {
        renderApp()
        expect(screen.getByText('msg_type')).toBeDefined()
        expect(screen.getByText('msg_prio')).toBeDefined()
        expect(screen.getByText('board_type_id')).toBeDefined()
        expect(screen.getByText('board_inst_id')).toBeDefined()
        expect(screen.getByText('time (s)')).toBeDefined()
        expect(screen.getByText('SEND')).toBeDefined()
    })
})

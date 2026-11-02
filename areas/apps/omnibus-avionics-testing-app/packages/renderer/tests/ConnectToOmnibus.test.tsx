import { describe, expect, it } from 'vitest'
import { render, fireEvent, screen } from '@testing-library/react'
import App from '@/App'

describe('Connect To Omnibus', () => {
    it('shows Connect to Omnibus button initially', () => {
        render(<App />)
        expect(screen.getByText(/Connect to Omnibus/i)).toBeDefined()
    })

    it('opens the connect dialog when Connect to Omnibus is clicked', () => {
        render(<App />)
        fireEvent.click(screen.getByText(/Connect to Omnibus/i))
        expect(screen.getByRole('dialog')).toBeDefined()
        expect(screen.getByLabelText(/Server Address/i)).toBeDefined()
    })

    it('connect button in dialog is enabled when input has a value', () => {
        render(<App />)
        fireEvent.click(screen.getByText(/Connect to Omnibus/i))
        const input = screen.getByLabelText(/Server Address/i)
        fireEvent.change(input, { target: { value: 'http://localhost:8081' } })
        const connectBtn = screen.getByRole('button', { name: /^Connect$/i })
        expect((connectBtn as HTMLButtonElement).disabled).toBe(false)
    })

    it('does not show Disconnect button initially', () => {
        render(<App />)
        expect(screen.queryByText(/^Disconnect$/i)).toBeNull()
    })
})

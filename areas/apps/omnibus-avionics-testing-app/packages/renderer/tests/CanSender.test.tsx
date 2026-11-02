import { describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { CanSender } from '@/components/CanSender/CanSender'

describe('CanSender Component', () => {
    it('renders all form fields', () => {
        render(<CanSender />)

        expect(screen.getByLabelText(/msg_type/i)).toBeDefined()
        expect(screen.getByLabelText(/msg_prio/i)).toBeDefined()
        expect(screen.getByLabelText(/board_type_id/i)).toBeDefined()
        expect(screen.getByLabelText(/board_inst_id/i)).toBeDefined()
        expect(screen.getByLabelText(/time/i)).toBeDefined()
        expect(screen.getByRole('button', { name: /send/i })).toBeDefined()
    })

    it('displays correct placeholders', () => {
        render(<CanSender />)

        const strInputs = screen.getAllByPlaceholderText('str')
        expect(strInputs.length).toBe(4)
        expect(screen.getByPlaceholderText('int')).toBeDefined()
    })

    it('accepts valid JSON input', () => {
        render(<CanSender />)

        const msgTypeInput = screen.getByLabelText(/msg_type/i) as HTMLInputElement
        fireEvent.change(msgTypeInput, { target: { value: '{"type": 1}' } })

        expect(msgTypeInput.value).toBe('{"type": 1}')
    })

    it('shows validation error for non-integer time', async () => {
        render(<CanSender />)

        const timeInput = screen.getByLabelText(/time/i)
        const submitButton = screen.getByRole('button', { name: /send/i })

        fireEvent.change(timeInput, { target: { value: 'notanumber' } })
        fireEvent.click(submitButton)

        await waitFor(() => {
            expect(screen.getByText(/Must be a valid integer/i)).toBeDefined()
        })
    })

    it('allows empty fields', async () => {
        const consoleSpy = vi.spyOn(console, 'log')
        render(<CanSender />)

        const submitButton = screen.getByRole('button', { name: /send/i })
        fireEvent.click(submitButton)

        // Should submit without errors when all fields are empty
        await waitFor(() => {
            expect(consoleSpy).toHaveBeenCalledWith({
                msg_type: null,
                msg_prio: null,
                board_type_id: null,
                board_inst_id: null,
                time: null,
            })
        })

        consoleSpy.mockRestore()
    })

    it('submits string values and parses time as integer', async () => {
        const consoleSpy = vi.spyOn(console, 'log')
        render(<CanSender />)

        fireEvent.change(screen.getByLabelText(/msg_type/i), { target: { value: 'SENSOR_ANALOG' } })
        fireEvent.change(screen.getByLabelText(/msg_prio/i), { target: { value: 'HIGH' } })
        fireEvent.change(screen.getByLabelText(/board_type_id/i), { target: { value: 'INJ_SENSOR' } })
        fireEvent.change(screen.getByLabelText(/board_inst_id/i), { target: { value: 'ROCKET' } })
        fireEvent.change(screen.getByLabelText(/time \(s\)/i), { target: { value: '1234' } })

        fireEvent.click(screen.getByRole('button', { name: /send/i }))

        await waitFor(() => {
            expect(consoleSpy).toHaveBeenCalledWith({
                msg_type: 'SENSOR_ANALOG',
                msg_prio: 'HIGH',
                board_type_id: 'INJ_SENSOR',
                board_inst_id: 'ROCKET',
                time: 1234,
            })
        })

        consoleSpy.mockRestore()
    })

    it('accepts any string in non-time fields', async () => {
        const consoleSpy = vi.spyOn(console, 'log')
        render(<CanSender />)

        fireEvent.change(screen.getByLabelText(/msg_type/i), { target: { value: '{not valid json}' } })
        fireEvent.change(screen.getByLabelText(/msg_prio/i), { target: { value: 'anything goes' } })

        fireEvent.click(screen.getByRole('button', { name: /send/i }))

        await waitFor(() => {
            expect(consoleSpy).toHaveBeenCalledWith(expect.objectContaining({
                msg_type: '{not valid json}',
                msg_prio: 'anything goes',
            }))
        })

        consoleSpy.mockRestore()
    })

    it('clears time validation error when valid integer is entered', async () => {
        render(<CanSender />)

        const timeInput = screen.getByLabelText(/time/i)
        const submitButton = screen.getByRole('button', { name: /send/i })

        fireEvent.change(timeInput, { target: { value: 'notanumber' } })
        fireEvent.click(submitButton)

        await waitFor(() => {
            expect(screen.getByText(/Must be a valid integer/i)).toBeDefined()
        })

        fireEvent.change(timeInput, { target: { value: '42' } })

        await waitFor(() => {
            expect(screen.queryByText(/Must be a valid integer/i)).toBeNull()
        })
    })
})

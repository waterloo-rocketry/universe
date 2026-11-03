import { describe, expect, it } from 'vitest'
import { render } from '@testing-library/react'
import BoardStatusRow from '@/components/BoardStatus/BoardStatusRow'

describe('Board Status Row', () => {
    it('Renders the name cell', () => {
        const { getByText } = render(<BoardStatusRow name="Row1" value="1" />)
        expect(getByText('Row1')).toBeDefined()
    })

    it('Renders the value cell', () => {
        const { getByText } = render(<BoardStatusRow name="Row1" value="42" />)
        expect(getByText('42')).toBeDefined()
    })

    it('Renders both name and value cells together', () => {
        const { getByText } = render(<BoardStatusRow name="linear_accel" value="-0.247" />)
        expect(getByText('linear_accel')).toBeDefined()
        expect(getByText('-0.247')).toBeDefined()
    })

    it('Renders numeric name and value', () => {
        const { getByText } = render(<BoardStatusRow name={0} value={99} />)
        expect(getByText('0')).toBeDefined()
        expect(getByText('99')).toBeDefined()
    })

    it('Renders with undefined value without crashing', () => {
        const { queryByText } = render(<BoardStatusRow name="empty_field" value={undefined} />)
        expect(queryByText('empty_field')).toBeDefined()
    })
})

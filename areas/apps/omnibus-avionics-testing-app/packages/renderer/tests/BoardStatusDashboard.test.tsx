import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import BoardStatusDashboard from '@/components/BoardStatus/BoardStatusDashboard'

import { sourceArray } from './testInput.fixture'

vi.mock('@/components/BoardStatus/BoardStatus', () => ({
    default: ({ boardTitle }: { boardTitle: string }) => (
        <div data-testid="board-status">{boardTitle}</div>
    ),
}))

describe('Board Status Dashboard', () => {
    it('Renders one BoardStatus per item in the array', () => {
        render(<BoardStatusDashboard boardInfoArray={sourceArray} />)
        const cards = screen.getAllByTestId('board-status')
        expect(cards).toHaveLength(sourceArray.length)
    })

    it("Renders each board's title correctly", () => {
        render(<BoardStatusDashboard boardInfoArray={sourceArray} />)
        const cards = screen.getAllByTestId('board-status')
        sourceArray.forEach((msg, i) => {
            expect(cards[i].textContent).toBe(msg.boardTypeId)
        })
    })

    it('Renders nothing when given an empty array', () => {
        render(<BoardStatusDashboard boardInfoArray={[]} />)
        expect(screen.queryAllByTestId('board-status')).toHaveLength(0)
    })
})

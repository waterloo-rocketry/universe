import { describe, expect, it } from 'vitest'
import { render } from '@testing-library/react'
import BoardStatus from '@/components/BoardStatus/BoardStatus'

import type { BoardMessage } from '@/components/types.ts'
import { sourceData } from './testInput.fixture'
import type { testDataTemplate } from './testInput.fixture'

describe('Board Status', () => {
    const boardMsg: BoardMessage<testDataTemplate> = sourceData[2]

    it('Renders the board type title', () => {
        const { getByText } = render(
            <BoardStatus
                boardData={boardMsg}
                boardTitle={boardMsg.boardTypeId}
                boardInstId={boardMsg.boardInstId}
                boardMsgPrio={boardMsg.msgPriority}
            />
        )
        expect(getByText('PROCESSOR')).toBeDefined()
    })

    it('Renders the board instance id', () => {
        const { getByText } = render(
            <BoardStatus
                boardData={boardMsg}
                boardTitle={boardMsg.boardTypeId}
                boardInstId={boardMsg.boardInstId}
                boardMsgPrio={boardMsg.msgPriority}
            />
        )
        expect(getByText('GENERIC')).toBeDefined()
    })

    it('Renders the msg_prio row with correct priority', () => {
        const { getByText } = render(
            <BoardStatus
                boardData={boardMsg}
                boardTitle={boardMsg.boardTypeId}
                boardInstId={boardMsg.boardInstId}
                boardMsgPrio={boardMsg.msgPriority}
            />
        )
        expect(getByText('msg_prio')).toBeDefined()
        expect(getByText('LOW')).toBeDefined()
    })

    it('Renders data field keys as row names', () => {
        const { getByText } = render(
            <BoardStatus
                boardData={boardMsg}
                boardTitle={boardMsg.boardTypeId}
                boardInstId={boardMsg.boardInstId}
                boardMsgPrio={boardMsg.msgPriority}
            />
        )
        expect(getByText('imu_id')).toBeDefined()
        expect(getByText('linear_accel')).toBeDefined()
        expect(getByText('angular_velocity')).toBeDefined()
    })

    it('Renders data field values', () => {
        const { getByText } = render(
            <BoardStatus
                boardData={boardMsg}
                boardTitle={boardMsg.boardTypeId}
                boardInstId={boardMsg.boardInstId}
                boardMsgPrio={boardMsg.msgPriority}
            />
        )
        expect(getByText('IMU_PROC_ALTIMU10')).toBeDefined()
    })

    it('Renders without crashing when data is null', () => {
        const nullDataMsg: BoardMessage<testDataTemplate> = { ...boardMsg, data: null }
        const { getByText } = render(
            <BoardStatus
                boardData={nullDataMsg}
                boardTitle={nullDataMsg.boardTypeId}
                boardInstId={nullDataMsg.boardInstId}
                boardMsgPrio={nullDataMsg.msgPriority}
            />
        )
        expect(getByText('PROCESSOR')).toBeDefined()
    })

    it('Renders without crashing when data is undefined', () => {
        const undefinedDataMsg: BoardMessage<testDataTemplate> = { ...boardMsg, data: undefined }
        const { getByText } = render(
            <BoardStatus
                boardData={undefinedDataMsg}
                boardTitle={undefinedDataMsg.boardTypeId}
                boardInstId={undefinedDataMsg.boardInstId}
                boardMsgPrio={undefinedDataMsg.msgPriority}
            />
        )
        expect(getByText('PROCESSOR')).toBeDefined()
    })
})

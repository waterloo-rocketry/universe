import type { BoardMessage } from '@/components/types.ts'
import BoardStatus from './BoardStatus'

function BoardStatusDashboard<T extends Record<keyof T, string | number>>({
    boardInfoArray,
}: {
    boardInfoArray: BoardMessage<T>[]
}) {
    return (
        <div className="overflow-y-auto grid grid-cols-1 md:grid-cols-3 2xl:grid-cols-4 gap-4">
            {boardInfoArray.map((x) => (
                <div>
                    <BoardStatus
                        key={`${x.boardTypeId}-${x.boardInstId}`}
                        boardData={x}
                        boardTitle={x.boardTypeId}
                        boardInstId={x.boardInstId}
                        boardMsgPrio={x.msgPriority}
                    ></BoardStatus>
                </div>
            ))}
        </div>
    )
}

export default BoardStatusDashboard

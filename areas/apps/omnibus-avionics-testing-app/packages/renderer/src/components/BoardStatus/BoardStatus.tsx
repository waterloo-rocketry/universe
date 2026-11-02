import { Card } from '@/components/ui/card'
import {
  Table,
  TableBody,
} from "@/components/ui/table"

import BoardStatusRow from './BoardStatusRow'
import type { BoardMessage } from '@/components/types'

function BoardStatus<T extends Record<keyof T, string | number>>({boardData, boardTitle, boardInstId, boardMsgPrio} : {boardData: BoardMessage<T>, boardTitle: string, boardInstId : string, boardMsgPrio: string}) { 
    const data = boardData.data ?? null
    const boardKeys = data ? Object.keys(data) as (string & keyof typeof data)[] : []
    const boardFields = data ? boardKeys.map((key) => [key, data[key]]) : []    
    return (
        <Card className="mt-10 ml-10 mr-10 w-90 h-100 p-5 bg-yellow-200">
                <h1 className="text-3xl font-bold text-center">{boardTitle}</h1>
                <h2 className = "text-large font-bold text-center">{boardInstId}</h2>
                <Table>
                
                <TableBody>
                    <BoardStatusRow name="msg_prio" value={boardMsgPrio}></BoardStatusRow>
                    {boardFields.map((x) => <BoardStatusRow  key={x[0]} name={x[0]} value={x[1]}></BoardStatusRow>)}
                </TableBody>
                </Table>
            </Card>
    )
}

export default BoardStatus;
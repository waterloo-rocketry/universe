import {
  TableCell,
  TableRow,
} from "@/components/ui/table"

function BoardStatusRow({name, value} : {name: string | number, value: string | number | undefined}) {
    return (
        <TableRow>
            <TableCell>{name}</TableCell>
            <TableCell>{value}</TableCell>
        </TableRow>
    )
}

export default BoardStatusRow;
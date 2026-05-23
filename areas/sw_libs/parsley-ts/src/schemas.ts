import { z } from 'zod'

// ============================================================
// Parsley Error — emitted when parseToObject fails to decode a message
// ============================================================

export const ParsleyErrorSchema = z.object({
    msg_prio: z.string(),
    board_type_id: z.string(),
    board_inst_id: z.string(),
    msg_type: z.string(),
    msg_metadata: z.union([z.number(), z.string()]),
    msg_data: z.string(),
    error: z.string(),
})

export type ParsleyError = z.infer<typeof ParsleyErrorSchema>

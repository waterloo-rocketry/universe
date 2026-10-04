import { z } from 'zod'
import type { AnyParsleyPayload } from './payloads.js'
import { msg_type } from './message_types.js'

// ============================================================
// Parsed CAN Message
// ============================================================

const msgTypeKeys = Object.keys(msg_type) as string[]

export const ParsleyObjectSchema = z.object({
    board_type_id: z.string(),
    board_inst_id: z.string(),
    msg_prio: z.string().min(1, 'msg_prio must be non-empty'),
    msg_type: z.string().refine(
        (val) => msgTypeKeys.includes(val),
        (val) => ({ message: `Invalid msg_type type '${val}'` })
    ),
    msg_metadata: z.union([
        z.number().int().min(0).max(255),
        z.string().min(1, 'msg_metadata string must be non-empty'),
    ]),
    data: z.record(z.string(), z.union([z.string(), z.number()])).nullable(),
})

export type ParsleyObject = Omit<z.infer<typeof ParsleyObjectSchema>,'data'> & {
    data: AnyParsleyPayload | null
}

// ============================================================
// Parsley Error
// ============================================================

export const ParsleyErrorSchema = z.object({
    board_type_id: z.string(),
    board_inst_id: z.string(),
    msg_type: z.string(),
    msg_metadata: z.union([z.number(), z.string()]),
    msg_data: z.string(),
    error: z.string(),
})

export type ParsleyError = z.infer<typeof ParsleyErrorSchema>

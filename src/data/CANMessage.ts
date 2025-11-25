import { z } from 'zod'

// Message priority enum schema
const MsgPrioSchema = z.enum(['LOW', 'MEDIUM', 'HIGH', 'HIGHEST'])

// TODO: This will extend a Parsley interface that will have boardTypeId... etc.
export const ParsleyMessageSchema = z.object({
    boardTypeId: z.string(),
    boardInstId: z.string(),
    msgPrio: MsgPrioSchema,
    msgType: z.string(),
    data: z.unknown().nullable(), // parsley data payload
    parsley: z.string(),
    messageFormatVersion: z.literal(2),
})

export const CANCommandMessageSchema = z.object({
    boardTypeId: z.string(),
    boardInstId: z.string(),
    msgPrio: MsgPrioSchema,
    msgType: z.string(),
    canMsg: z.unknown().nullable(),
    parsley: z.string(), // Parsley server instance ID
    messageFormatVersion: z.literal(2),
})

// TODO: Once RLCS uses a better message type, replace it (probably when RLCSv4 uses CAN)
const RLCSSensorNameSchema = z.string()
export const RLCSv3MessageSchema = z.record(
    RLCSSensorNameSchema,
    z.union([z.number(), z.string()])
)

export const ParsleyHeartbeatMessageSchema = z.object({
    id: z.string(),
    health: z.string(),
})

export type ParsleyMessage<T = unknown> = z.infer<
    typeof ParsleyMessageSchema
> & { data: T | null }
export type CANCommandMessage<T = unknown> = z.infer<
    typeof CANCommandMessageSchema
> & { canMsg: T | null }
export type RLCSv3Message = z.infer<typeof RLCSv3MessageSchema>
export type ParsleyHeartbeatMessage = z.infer<
    typeof ParsleyHeartbeatMessageSchema
>

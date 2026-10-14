import { z } from 'zod'

// Message priority enum schema
const MsgPrioSchema = z.enum(['LOW', 'MEDIUM', 'HIGH', 'HIGHEST'])

const MsgMetadataSchema = z.union([
    z.number().int().min(0).max(255),
    z.string().min(1),
])

export const CANMessageSchema = z.object({
    boardTypeId: z.string(),
    boardInstId: z.string(),
    msgPrio: MsgPrioSchema,
    msgType: z.string(),
    msgMetadata: MsgMetadataSchema,
})

export const ParsleyMessageSchema = CANMessageSchema.extend({
    data: z.unknown().nullable(), // parsley data payload
    parsley: z.string(),
    messageFormatVersion: z.literal(2),
})

export const CANCommandMessageSchema = z.object({
    data: z.object({
        canMsg: CANMessageSchema.passthrough(),
    }),
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
export type CANMessage = z.infer<typeof CANMessageSchema>
export type CANCommandMessage<T extends object = Record<string, unknown>> = z.infer<
    typeof CANCommandMessageSchema
> & { data: { canMsg: CANMessage & T } }
export type RLCSv3Message = z.infer<typeof RLCSv3MessageSchema>
export type ParsleyHeartbeatMessage = z.infer<
    typeof ParsleyHeartbeatMessageSchema
>

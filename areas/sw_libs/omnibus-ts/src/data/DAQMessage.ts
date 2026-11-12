import z from 'zod'

export const DAQMessageSchema = z.object({
    timestamp: z.number(),
    data: z.record(z.string(), z.array(z.number())),
    relativeTimestamps: z.array(z.number()),
    sampleRate: z.int(),
    messageFormatVersion: z.literal(3),
})

export type DAQMessage = z.infer<typeof DAQMessageSchema>

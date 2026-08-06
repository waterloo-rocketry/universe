import { mapKeys, snake, camel } from 'radash'
import { z } from 'zod'

const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null && !Array.isArray(value)

// Omnibus messages come in and leave as snake case dictionaries, so we should respect that
export const snakeCaseParser = (targetSchema: z.ZodObject | z.ZodRecord) => {
    return z
        .record(z.string(), z.unknown())
        .transform((input) => {
            const output = mapKeys(input, camel)
            const data = output['data']

            if (!isRecord(data)) return output

            const normalizedData = toSnakeCase(data)
            const canMsg = normalizedData['can_msg']
            if (!isRecord(canMsg)) {
                return { ...output, data: normalizedData }
            }

            return {
                ...output,
                data: {
                    ...normalizedData,
                    canMsg: mapKeys(canMsg, camel),
                },
            }
        })
        .pipe(targetSchema)
}

export const toSnakeCase = <T extends object>(
    input: T
): Record<string, unknown> => {
    const convertedEntries = Object.entries(input).map(([key, value]) => [
        snake(key),
        value,
    ])
    const output = Object.fromEntries(convertedEntries)
    const data = Object.entries(input).find(([key]) => key === 'data')?.[1]

    if (!isRecord(data) || !isRecord(data['canMsg'])) return output

    return {
        ...output,
        data: {
            ...toSnakeCase(data),
            can_msg: toSnakeCase(data['canMsg']),
        },
    }
}

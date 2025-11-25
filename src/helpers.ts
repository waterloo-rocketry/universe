import { mapKeys, snake, camel } from 'radash'
import { z } from 'zod'

// Omnibus messages come in and leave as snake case dictionaries, so we should respect that
export const snakeCaseParser = (targetSchema: z.ZodObject | z.ZodRecord) => {
    return z
        .record(z.string(), z.unknown())
        .transform((x) => mapKeys(x, camel))
        .pipe(targetSchema)
}

export const toSnakeCase = <T extends object>(input: T) => {
    const convertedEntries = Object.entries(input).map(([key, value]) => [
        snake(key),
        value,
    ])
    return Object.fromEntries(convertedEntries)
}

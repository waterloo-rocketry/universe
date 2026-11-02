export interface BoardMessage<T extends Record<keyof T, string | number>> {
    boardTypeId: string
    boardInstId: string
    msgPriority: string
    msgType: string
    data: T | undefined | null
}

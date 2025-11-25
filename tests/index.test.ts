import { describe, it, expect } from 'vitest'
import { communicator } from '../src/index.js'

describe('Omnibus library entry point communicator function', () => {
    it('should only export sender, receiver, and disconnect when flags are disabled', () => {
        const c = communicator({ serverURL: 'test' })
        expect(c).toBeDefined()
        expect(c.unsafeReceiveGenericMessage).toBeUndefined()
        expect(c.socket).toBeUndefined()
        expect(Object.keys(c)).toEqual(['sender', 'receiver', 'disconnect'])
    })
    it('should export unsafeReceiveGenericMessage when allowUnsafe is true', () => {
        const c = communicator({ serverURL: 'test', allowUnsafe: true })
        expect(c).toBeDefined()
        expect(c.unsafeReceiveGenericMessage).toBeDefined()
    })
    it('should export socket when allowExposeSocket is true', () => {
        const c = communicator({ serverURL: 'test', allowExposeSocket: true })
        expect(c).toBeDefined()
        expect(c.socket).toBeDefined()
    })
})

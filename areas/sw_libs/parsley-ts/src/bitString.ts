export class BitString{
    private data: bigint;
    length: number;

    public constructor (data: Uint8Array = new Uint8Array(), dataBitLength?: number) {
        this.length = dataBitLength ?? (data.length * 8);
        this.data = 0n;
        
        for (const byte of data) {
            this.data = (this.data << 8n) | BigInt(byte)
        }
    }

    public pop(fieldLength: number, variableLength: boolean = false): bigint { 
        /*
        Returns the next fieldLength most significant bits of data as a bigint.

        The data returned will be LSB-aligned, so for example, asking for 12 bits will return:
        0000BBBB BBBBBBBB
        where B represents a data bit.
        */

        // Python's pop() returns bytes, but every field decoder immediately converts
        // it back to int. We return bigint directly to skip that round-trip.
        if (fieldLength < 0) {
            throw new RangeError(`Field length must be non-negative, got ${fieldLength}.`);
        }
        if (fieldLength > this.length && !variableLength)
            throw new RangeError(`Cannot pop ${fieldLength} bits from a BitString of length ${this.length}, try setting variableLength to true.`);
        fieldLength = fieldLength > this.length ? this.length : fieldLength;

        this.length -= fieldLength;
        const result: bigint = this.data >> BigInt(this.length); // extract the fieldLength most significant bits
        // Mask out the bits we just extracted by AND-ing with a bitmask of
        // this.length 1-bits. e.g. if 5 bits remain: (1 << 5) - 1 = 0b11111
        this.data = this.data & ((1n << BigInt(this.length)) - 1n);
        return result;
    }

    public push(value: bigint | number, fieldLength: number): void {
        /*
        Appends the next fieldLength least significant bits of data from value (to the back).

        So for example, appending 6 bits from:
        10110000
        will append only 110000
        */
        value = BigInt(value);
        if (fieldLength < 0) {
            throw new Error(`Field length must be non-negative, got ${fieldLength}.`);
        }

        this.length += fieldLength;
        value = value & ((1n << BigInt(fieldLength)) - 1n); // extract the fieldLength least significant bits
        this.data = value | (this.data << BigInt(fieldLength)); // shift the new bits to the left and then add them to the existing data
    }

    public pushFront(value: bigint | number, fieldLength: number): void {
        /*
        Prepends the next fieldLength least significant bits of data from value (to the front).
        */

        value = BigInt(value);
        if (fieldLength < 0) {
            throw new Error(`Field length must be non-negative, got ${fieldLength}.`);
        }

        value = value & ((1n << BigInt(fieldLength)) - 1n); // extract the fieldLength least significant bits
        this.data = (value << BigInt(this.length)) | this.data; // prepend to the front
        this.length += fieldLength;
    }

}

/*
Field transcoders. Each field knows how to convert between a JS value and a
bigint of `length` bits, LSB-aligned to match BitString.
*/

export abstract class Field {
    /*
    Abstract base class for all fields that can be transcoded.

    Note: data is assumed to be LSB-aligned to match the implementation of BitString.
    */

    name: string;
    length: number;
    unit: string;
    variable_length: boolean;

    constructor(name: string, length: number, unit: string = "") {
        this.name = name;
        this.length = length;
        this.unit = unit;
        this.variable_length = false;
    }

    abstract decode(data: bigint): unknown;
    /*
    Converts `self.length` bits of `data` to the field's corresponding python value.
    This value could be an integer, string, etc. depending on the specific field type.
    */


    abstract encode(value: unknown): readonly [bigint, number];
    /*
    Converts value to `self.length` bits of data and returns a tuple of (encoded_value, self.length)
    or raises a ValueError with an appropiate message if this is not possible.

    self.length is returned in order to properly parse leading zeros. For example,
    the following cases are bit-level identical, but are not equilvalent for our purposes:
    2-bit: ______10
    4-bit: ____0010
    8-bit: 00000010 (<= they all look like this)
    */
}

// Reverse the byte order of an unsigned integer that occupies `byteCount` bytes.
function byteSwap(value: bigint, byteCount: number): bigint {
    let result = BigInt(0);
    for (let i = 0; i < byteCount; i++) {
        result = (result << 8n) | (value & 0xffn);
        value >>= 8n;
    }
    return result;
}

export class ASCII extends Field {
    /*
    Transcodes binary data and ASCII text.

    b'\x48\x65\x79' <=> 'Hey'
    Encoded data is left-aligned with trailing null bytes.
    */
    constructor(name: string, length: number) {
        super(name, length);
        this.variable_length = true;
    }

    public decode(data: bigint): string {
        const byteCount = this.length / 8;
        const hex = data.toString(16).padStart(byteCount * 2, "0");
        return Buffer.from(hex, "hex").toString("ascii").replace(/\0/g, "");
    }

    public encode(value: string): [bigint, number] {
        if (typeof value !== "string") {
            throw new Error(`${value} is not a string`);
        }
        const bytes = Buffer.from(value, "ascii");

        // Detect non-ASCII
        if (!/^[\x00-\x7F]*$/.test(value)) {
            throw new Error(`${value} contains non-ascii character(s)`);
        }
        if (this.length < 8 * bytes.length) {
            throw new Error(`${value} is too large for ${Math.floor(this.length / 8)} character(s)`);
        }

        const byteCount = this.length / 8;
        const hex = bytes.toString("hex").padEnd(byteCount * 2, "0");
        return [hex.length === 0 ? BigInt(0) : BigInt(`0x${hex}`), this.length];
    }
}

export class Enum extends Field {
    /*
    Transcodes binary data using a user-defined dictionary.

    This allows for customizable byte interpretations:
    dictionary: {'GENERAL_CMD': 0x060, 'RESET_CMD': 0x160}
    b'\x01\x60' <=> 'RESET_CMD'
    */

    map_key_val: Record<string, number>;
    map_val_key: Record<number, string>;

    constructor(name: string, length: number, map_key_val: Record<string, number>) {
        super(name, length);
        this.map_key_val = map_key_val;
        this.map_val_key = Object.fromEntries(
            Object.entries(map_key_val).map(([k, v]) => [v, k]),
        );

        const valueSize = Object.values(map_key_val).length;
        const uniqueValueSize = new Set(Object.values(map_key_val)).size;
        if (valueSize !== uniqueValueSize) {
            throw new Error(
                `Mapping "${this.name}" is not bijective: has ${valueSize} values but only ${uniqueValueSize} are unique`,
            );
        }

        const max = BigInt(1) << BigInt(length);
        for (const [k, v] of Object.entries(map_key_val)) {
            if (v < 0) {
                throw new Error(`Mapping value ${v} for key ${k} must be non-negative`);
            }
            if (BigInt(v) >= max) {
                throw new Error(
                    `Mapping value ${v} for key ${k} is too large to fit in ${length} bits`,
                );
            }
        }
    }

    public decode(data: bigint): string {
        const key = Number(data);
        const name = this.map_val_key[key];
        if (name === undefined) {
            throw new Error(`Value "${data}" not found in map "${this.name}"`);
        }
        return name;
    }

    public encode(value: string): [bigint, number] {
        if (!Object.prototype.hasOwnProperty.call(this.map_key_val, value)) {
            throw new Error(`Key "${value}" not found in map "${this.name}"`);
        }
        return [BigInt(this.map_key_val[value]!), this.length];
    }

    public get_keys(): string[] {
        return Object.keys(this.map_key_val);
    }
}

export class Numeric extends Field {
    /*
    Transcodes binary data and numbers (ie. (un)signed and/or fixed point)
    with an optional scaling factor during transcoding.

    For example:
    b'\xFC' <=> -4 (two's complement)
    */
    scale: number;
    signed: boolean;
    big_endian: boolean;

    constructor(name: string, length: number, scale: number = 1, signed: boolean = false, big_endian: boolean = true, unit: string = "") {
        super(name, length, unit);
        this.scale = scale;
        this.signed = signed;
        this.big_endian = big_endian;
    }

    public decode(data: bigint): number {
        const byteCount = Math.ceil(this.length / 8);
        let raw = this.big_endian ? data : byteSwap(data, byteCount);

        if (this.signed) {
            const signBit = BigInt(1) << BigInt(this.length - 1);
            if (raw & signBit) {
                raw -= BigInt(1) << BigInt(this.length);
            }
        }
        return Number(raw) * this.scale;
    }

    public encode(value: number): [bigint, number] {
        if (typeof value !== "number" || Number.isNaN(value)) {
            throw new Error(`Value "${value}" is not a valid number`);
        }

        const intVal = Math.floor(value / this.scale);
        const max = BigInt(1) << BigInt(this.signed ? this.length - 1 : this.length);
        const min = this.signed ? -(BigInt(1) << BigInt(this.length - 1)) : BigInt(0);
        const big = BigInt(intVal);

        if (big >= max) {
            throw new Error(
                `Value "${intVal}" (0x${intVal.toString(16)}) is too large for ${this.length} ${this.signed ? "signed" : "unsigned"} bits`,
            );
        }
        if (big < min) {
            throw new Error(
                this.signed
                    ? `Value "${intVal}" (0x${intVal.toString(16)}) is too small for ${this.length} signed bits`
                    : `Cannot encode negative value "${intVal}" in an unsigned field`,
            );
        }

        // Two's complement for negatives in signed fields.
        const unsigned = big < BigInt(0) ? big + (BigInt(1) << BigInt(this.length)) : big;
        const byteCount = Math.ceil(this.length / 8);
        const encoded = this.big_endian ? unsigned : byteSwap(unsigned, byteCount);
        return [encoded, this.length];
    }
}

export class Floating extends Field {
    /*
    IEEE 754 single-precision float. 32 bits.

    For example:
    9.8125 -> b'A\x1d\x00\x00'

    (Note, byte order may be reversed depending on endianess)
    */
    big_endian: boolean;

    constructor(name: string, big_endian: boolean = true, unit: string = "") {
        super(name, 32, unit);
        this.big_endian = big_endian;
    }

    public decode(data: bigint): number {
        const buf = new ArrayBuffer(4);
        const view = new DataView(buf);
        view.setUint32(0, Number(data & 0xffffffffn), false);
        return view.getFloat32(0, !this.big_endian);
    }

    public encode(value: number): [bigint, number] {
        if (typeof value !== "number" || Number.isNaN(value)) {
            throw new Error(`Value "${value}" is not a valid float`);
        }
        const buf = new ArrayBuffer(4);
        const view = new DataView(buf);
        view.setFloat32(0, value, !this.big_endian);
        return [BigInt(view.getUint32(0, false)), this.length];
    }
}

export class Switch extends Enum {
    /*
    An Enum wrapper to map binary data -> list of Fields using a user-defined dictionary.

    For perspective, our CAN messages are defined as a Switch that maps:
    binary data <=> string (message type) and then
    string -> list of Fields (the specific fields that are defined in the message type)
    */
    map_key_fields: Record<string, Field[]>;

    constructor(
        name: string,
        length: number,
        map_key_val: Record<string, number>,
        map_key_fields: Record<string, Field[]>,
    ) {
        super(name, length, map_key_val);
        this.map_key_fields = map_key_fields;
    }

    public get_fields(key: string): Field[] {
        const fields = this.map_key_fields[key];
        if (fields === undefined) {
            throw new Error(`Key "${key}" not found in switch "${this.name}"`);
        }
        return fields;
    }
}

export class Bitfield extends Field {
    /*
    Transcodes binary data and bitfields using a user-defined dictionary.
    
    This is a bitfield, so the dictionary maps the bit position to the name of the field.
    For example:
    dictionary: {'E_NOMINAL': 0, 'E_5V_OVER_CURRENT': 1, 'E_5V_OVER_VOLTAGE': 2}
    b'\x01\x60' <=> 'E_5V_OVER_CURRENT|E_5V_OVER_VOLTAGE'
    */
    default: string;
    map_name_offset: Record<string, number> | null;

    constructor(name: string, length: number, default_value: string = "DEFAULT_STRING", map_name_offset: Record<string, number> | null = null, unit: string = "") {
        super(name, length, unit);
        this.default = default_value;
        this.map_name_offset = map_name_offset;

        // Every flag's bit position must fit in the field
        if (map_name_offset !== null) {
            for (const [flag, offset] of Object.entries(map_name_offset)) {
                if (offset < 0 || offset >= length) {
                    throw new Error(
                        `Bitfield "${name}": flag "${flag}" offset ${offset} doesn't fit in ${length} bits`,
                    );
                }
            }
        }
    }

    public decode(data: bigint): string {
        if (this.map_name_offset === null) {
            const hexWidth = Math.ceil(this.length / 4);
            return "0x" + data.toString(16).padStart(hexWidth, "0");
        }

        const set: string[] = [];
        for (const [flag, bit] of Object.entries(this.map_name_offset)) {
            if (data & (BigInt(1) << BigInt(bit))) {
                set.push(flag);
            }
        }
        return set.length === 0 ? this.default : set.join("|");
    }

    public encode(value: string): [bigint, number] {
        if (typeof value !== "string") {
            throw new Error(`Value "${value}" is not a valid bitfield string`);
        }

        const max = BigInt(1) << BigInt(this.length);

        if (this.map_name_offset === null) {
            let parsed: bigint;
            try {
                parsed = BigInt(value);
            } catch {
                throw new Error(`Value "${value}" is not a valid bitfield string`);
            }
            if (parsed < BigInt(0) || parsed >= max) {
                throw new Error(`Value "${value}" does not fit in ${this.length} bits`);
            }
            return [parsed, this.length];
        }

        let bits = BigInt(0);
        if (value !== this.default) {
            for (const name of value.split("|")) {
                const offset = this.map_name_offset[name];
                if (offset === undefined) {
                    throw new Error(`Name "${name}" not found in bitfield "${this.name}"`);
                }
                bits |= BigInt(1) << BigInt(offset);
            }
        }
        return [bits, this.length];
    }
}

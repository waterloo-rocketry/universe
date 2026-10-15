## Parsley
```Parsley``` is a library to transcode Controller Area Network (CAN) and human-readable messages.

## Highlights
- ```bitstring.py```: Provides a custom data structure to store and read bits of arbitrary-length.
- ```fields.py```:  Defines custom data types for transcoding byte strings such as ASCII and numerical data.
- ```parsley_defintions.py```: Offers a new architecture for defining CAN messages.
- Enhanced error handling across all stages of transcoding.

## Example

``` python
from parsley import (
    message_definitions as md,
    parse, format_line,
    BitString
)

# Encoding a DEBUG_MSG CAN message
bit_str = BitString()
bit_str.push(*md.TIMESTAMP_3.encode(12.345)) # 12.345 seconds
bit_str.push(*md.Numeric("level", 4).encode(6))
bit_str.push(*md.Numeric("line", 12).encode(0x123))
bit_str.push(*md.ASCII("data", 24).encode("T_T"))
"""
The data encoded in bit_str looks like:
          |=> level of 6
          |
          |    T_T encoded in ASCII
          |       |--------|
\x30\x39\x61\x23\x54\x5f\x54
|------|   |---|
|        line of 0x123
|=> 12345 milliseconds
"""

# Creating the full CAN message
msg_sid = b'\x01\x90' # DEBUG_MSG | GPS
msg_data = bit_str.pop(64)

# Decoding a CAN message
result = parse(msg_sid, msg_data)
"""
result = {
    'msg_type' = 'DEBUG_MSG',
    'board_id' = 'GPS',
    'time': 12.345,
    'level': 6,
    'line': 291, 
    'data': 'T_T'
}
"""

# displaying everything into one formatted line
print(format_line(result))
"""
[ DEBUG_MSG            GPS            ] time: 12.345 level: 6 line: 291 data: T_T
"""

```

## Using Parsley

The easiest way to include parsley is through `uv` if your project uses it. Run `uv add git+https://github.com/waterloo-rocketry/parsley` to add to your project. 

You can also include parsley as a submodule in your project with ```git submodule add https://github.com/waterloo-rocketry/parsley.git``` and to pull the submodule as a developer, you can use ```git submodule update --init --recursive```

## Requirements
**You must have the `uv` Python package manager and builder installed. Visit https://docs.astral.sh/uv/getting-started/installation/ to get started. If you don't know otherwise, choose the "Standalone Installer".**

1. Run `uv sync`
2. Source virtual environment in `.venv`
3. To build, run `uv build`

# sd-card-tool

Command-line tool for Waterloo Rocketry's append-only SD card log format.

Status: the on-card format is defined in YAML. Reading and writing
chunks follows in the next PR.

## On-card format

The card is a sequence of 32,768-byte slots. Formatting zeroes the start of
each slot. Each written slot holds one chunk:

| Field           | Size         | Purpose                                  |
| --------------- | ------------ | ---------------------------------------- |
| HEADER_ID       | 32 bits      | Magic value marking a log chunk          |
| FILE_ID         | 16 bits      | 13-bit startup counter + 3-bit data type |
| SEGMENT_COUNTER | 32 bits      | Position of the chunk within its file    |
| Data            | 32,756 bytes | Payload                                  |
| CRC             | 16 bits      | CRC-16 over header + data                |

A file is every chunk with the same startup counter and data type.

## Format file

The whole layout is defined in
[`src/sd_card_tool/format.yaml`](src/sd_card_tool/format.yaml), in the same
style as RocketCan: slot size, how many bytes formatting clears, byte order,
header fields and their bit widths, the CRC algorithm, output filenames, and
the data type enum. Values marked `PLACEHOLDER` are not decided yet.

- Header fields are listed in order; their widths are in bits and each
  top-level field must be whole bytes. Subfields are listed from the most
  significant bits down.
- The tool needs `HEADER_ID`, `STARTUP_COUNTER`, `DATA_TYPE` and
  `SEGMENT_COUNTER`. Other fields can be added (for example by another team);
  the payload shrinks to fit, and any field with a `value` must match it for a
  chunk to be valid.
- `crc.algorithm` is a named CRC-16 (such as `CRC-16/CCITT-FALSE` or
  `CRC-16/MODBUS`) or `custom` with `poly`, `init`, `reflect_in`,
  `reflect_out` and `xor_out`.

## Development

```sh
uv sync
uv run pytest
uv run flake8
```

CI runs both on every pull request that changes this folder
(`.github/workflows/ci.yml`; after editing it, run `uv run tools/build_ci`
from the repo root and commit the copy it makes).

The tests build fake card images, so no SD card is needed.

# sd-card-tool

Command-line tool for Waterloo Rocketry's append-only SD card log format.

Status: exports the logged files from card image files. Reading real
cards and formatting are not built yet.

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

To try other values, copy the file, edit it, and pass `--format`:

```sh
uv run sd-card-tool default-format > my-format.yaml
uv run sd-card-tool export card.img out/ --format my-format.yaml
```

## Export

From a card image file:

```sh
uv run sd-card-tool export card.img out/
```

Export reads the card once, front to back, checking every slot in order:

- A slot whose first `clear_bytes` bytes are all zero is unused.
- Other slots must have the right fixed values (such as `HEADER_ID`) and CRC.
  Slots that fail are reported and skipped, and the scan continues.
- Valid chunks are grouped by file, sorted by segment counter, and their
  payloads concatenated. The segment counter is only used for sorting, so it
  can start at 0 or 1. Missing segments are skipped and reported; each chunk
  is self-contained, so the rest of the file is still usable. If a segment
  appears twice, the first copy is kept.
- Files are named from the startup counter and type, e.g. `00001.BIN`,
  `00001.ERR`, `00001.TXT`. An unknown type is still exported, as
  `00001.TYPE6`.
- Startup counters only go up in card order. If one goes down (for example
  8191 to 0), the 13-bit counter wrapped: later files get a generation
  number, e.g. `00001-1.BIN`, so they never merge with an earlier `00001`.
- Each file's data is streamed into a `.part` file as it is found and
  renamed when the whole card has been read. Segments that arrive out of
  order are put back in order from the `.part` file, not by reading the card
  again. If export fails partway, no output or `.part` files are left.
- Existing output files are not replaced unless you pass `--overwrite`.

Payloads are copied in full, including any zero padding at the end of a chunk.

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

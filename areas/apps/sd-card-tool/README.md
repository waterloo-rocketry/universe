# sd-card-tool

Command-line tool for Waterloo Rocketry's append-only SD card log format.

Status: it formats SD cards and exports the logged files from them (macOS),
or from card image files. Importing is not built yet.

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

From an SD card (macOS). Find the card's disk name, then read it. Reading
the raw card needs `sudo`; the card is only read, never written, and the
exported files are handed back to your user:

```sh
uv run sd-card-tool list
sudo .venv/bin/python -m sd_card_tool export disk4 out/
```

Before opening a disk the tool refuses anything that is internal, holds the
running system, is a partition rather than a whole disk, or is virtual (disk
images made with `hdiutil attach` are allowed, for testing). Only whole disks
named like `disk4` are accepted.

Export checks every slot in address order:

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
- Existing output files are not replaced unless you pass `--overwrite`.

Payloads are copied in full, including any zero padding at the end of a chunk.

## Format

```sh
uv run sd-card-tool list
sudo .venv/bin/python -m sd_card_tool format disk4
```

Formatting writes zeros to the first `clear_bytes` bytes of every slot, or to
every byte with `--whole`. It then reads those bytes back and fails if any
slot is not blank. It does not use the card's own erase command, because
some cards read back 0xFF rather than 0x00 after an erase.

The same safety checks as export apply. The tool also shows the card's name
and size and asks you to type the disk name (e.g. `disk4`) before it writes
anything; pass `--confirm disk4` to answer in advance. The card is unmounted
first so nothing else writes to it.

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

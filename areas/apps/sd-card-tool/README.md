# sd-card-tool

Command-line tool for Waterloo Rocketry's append-only SD card log format.

Status: **step 1**. It reads card *image files* and rebuilds the logged files.
Reading a real card, formatting, and importing are not built yet.

## On-card format

The card is a sequence of 32,768-byte slots. Unused slots are all zero. Each
written slot holds one chunk:

| Field                | Size         | Purpose                                     |
| -------------------- | ------------ | ------------------------------------------- |
| Header identifier    | 32 bits      | Marks the slot as a log chunk               |
| File identifier      | 16 bits      | 13-bit startup counter + 3-bit data type    |
| File segment counter | 32 bits      | Position of the chunk within its file       |
| Data                 | 32,756 bytes | Payload                                     |
| CRC-16 footer        | 16 bits      | Checksum used to validate the chunk         |

A file is every chunk with the same startup counter and data type.

## Config

The values firmware has not decided yet (header ID, CRC variant, data type
numbers, byte order, bit order) live in
[`src/sd_card_tool/default_config.toml`](src/sd_card_tool/default_config.toml).
The current values are **placeholders**. To try other values, copy the file,
edit it, and pass `--config`:

```sh
uv run sd-card-tool default-config > my-format.toml
uv run sd-card-tool export card.img out/ --config my-format.toml
```

## Export

```sh
uv run sd-card-tool export card.img out/
```

Export checks every slot in address order:

- All-zero slots are skipped. `empty_check_bytes` sets how many leading bytes
  must be zero; use 512 if formatting only clears the start of each slot.
- Other slots must have the right header ID and CRC. Slots that fail are
  reported and skipped, and the scan continues.
- Valid chunks are grouped by file, sorted by segment counter, and their
  payloads concatenated. Missing segments are skipped and reported. If a
  segment appears twice, the first copy is kept.
- Files are named from the startup counter and type, e.g. `00001.BIN`,
  `00001.ERR`, `00001.TXT`. An unknown type is still exported, as
  `00001.TYPE6`.
- Existing output files are not replaced unless you pass `--overwrite`.

Payloads are copied in full, including any zero padding at the end of a chunk.

## Development

```sh
uv sync
uv run pytest
```

The tests build fake card images, so no SD card is needed.

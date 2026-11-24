import io

import pytest
from helpers import config_with

from sd_card_tool.chunk import Chunk, encode_chunk
from sd_card_tool.cli import main
from sd_card_tool.config import load_config
from sd_card_tool.export import corrupt_runs, export, scan

CONFIG = load_config()
SIZE = CONFIG.slot_size
EMPTY = bytes(SIZE)
DATA, ERROR, TEXT = 0, 1, 2


def payload(tag: str) -> bytes:
    """A full payload that is easy to recognize in the output."""
    return tag.encode().ljust(CONFIG.data_size, b".")


def slot(counter: int, data_type: int, segment: int, tag: str,
         config=CONFIG) -> bytes:
    return encode_chunk(Chunk(counter, data_type, segment, payload(tag)),
                        config)


def corrupt(raw: bytes) -> bytes:
    broken = bytearray(raw)
    broken[500] ^= 0xFF
    return bytes(broken)


def test_rebuilds_files_in_segment_order(tmp_path):
    card = io.BytesIO(b"".join([
        slot(1, DATA, 0, "d0"),
        slot(1, TEXT, 0, "t0"),
        slot(1, DATA, 2, "d2"),   # out of order on the card
        slot(1, DATA, 1, "d1"),
        slot(2, ERROR, 0, "e0"),  # next startup
        EMPTY, EMPTY,
    ]))
    result, files = export(card, CONFIG, tmp_path)

    assert result.slots == 7
    assert result.valid == 5
    assert result.empty == 2
    assert result.corrupt == []
    assert [f.path.name for f in files] == ["00001.BIN", "00001.TXT",
                                            "00002.ERR"]
    assert (tmp_path / "00001.BIN").read_bytes() == (
        payload("d0") + payload("d1") + payload("d2"))
    assert (tmp_path / "00001.TXT").read_bytes() == payload("t0")
    assert (tmp_path / "00002.ERR").read_bytes() == payload("e0")


def test_skips_corrupt_chunks_and_keeps_scanning(tmp_path):
    card = io.BytesIO(b"".join([
        slot(1, DATA, 0, "d0"),
        corrupt(slot(1, DATA, 1, "d1")),
        b"\x01" + bytes(SIZE - 1),  # garbage: not blank, wrong header
        slot(1, DATA, 2, "d2"),
    ]))
    result, files = export(card, CONFIG, tmp_path)

    assert [index for index, _ in result.corrupt] == [1, 2]
    assert "CRC" in result.corrupt[0][1]
    assert "HEADER_ID" in result.corrupt[1][1]
    record = files[0].record
    assert record.segments == [0, 2]
    assert record.missing_segments == [1]
    assert files[0].path.read_bytes() == payload("d0") + payload("d2")


def test_empty_card_exports_nothing(tmp_path):
    result, files = export(io.BytesIO(EMPTY * 3), CONFIG, tmp_path / "out")
    assert (result.slots, result.empty, files) == (3, 3, [])


def test_keeps_the_first_copy_of_a_duplicate_segment(tmp_path):
    card = io.BytesIO(slot(1, DATA, 0, "first") + slot(1, DATA, 0, "second"))
    result, files = export(card, CONFIG, tmp_path)
    assert [d.slot for d in result.duplicates] == [1]
    assert files[0].path.read_bytes() == payload("first")


def test_unknown_data_type_is_still_exported(tmp_path):
    _, files = export(io.BytesIO(slot(3, 6, 0, "x")), CONFIG, tmp_path)
    assert files[0].path.name == "00003.TYPE6"


def test_reports_a_partial_slot_at_the_end(tmp_path):
    card = io.BytesIO(slot(1, DATA, 0, "d0") + b"\x07" * 100)
    result, _ = export(card, CONFIG, tmp_path)
    assert (result.slots, result.trailing_bytes) == (1, 100)


def test_scans_across_read_blocks():
    # More slots than one read, so chunks straddle the block boundary.
    slots = [slot(1, DATA, i, f"d{i}") for i in range(40)]
    result = scan(io.BytesIO(b"".join(slots)), CONFIG)
    assert result.valid == 40
    assert result.files[(0, 1, DATA)].segments == list(range(40))


def test_only_the_cleared_bytes_need_to_be_zero(tmp_path):
    # Formatting clears the first 512 bytes; old data after that is ignored.
    leftover = bytes(512) + b"\xFF" * (SIZE - 512)
    result, _ = export(io.BytesIO(leftover + slot(1, DATA, 0, "d0")),
                       CONFIG, tmp_path)
    assert (result.empty, result.valid, result.corrupt) == (1, 1, [])


def test_whole_slot_clearing(tmp_path):
    config = config_with(lambda r: r["layout"].update(clear_bytes=SIZE))
    leftover = bytes(512) + b"\xFF" * (SIZE - 512)
    result, _ = export(io.BytesIO(leftover), config, tmp_path)
    assert (result.empty, len(result.corrupt)) == (0, 1)


def test_counter_wrap_starts_a_new_generation(tmp_path):
    card = io.BytesIO(b"".join([
        slot(1, DATA, 0, "old 1"),
        slot(8191, DATA, 0, "last before wrap"),
        slot(0, DATA, 0, "after wrap 0"),
        slot(1, DATA, 0, "after wrap 1"),  # same counter as the first file
        slot(1, TEXT, 0, "after wrap 1 text"),
    ]))
    result, files = export(card, CONFIG, tmp_path)

    assert [(w.slot, w.previous, w.counter) for w in result.wraps] == [
        (2, 8191, 0)]
    assert [f.path.name for f in files] == [
        "00001.BIN", "08191.BIN", "00000-1.BIN", "00001-1.BIN", "00001-1.TXT"]
    assert (tmp_path / "00001.BIN").read_bytes() == payload("old 1")
    assert (tmp_path / "00001-1.BIN").read_bytes() == payload("after wrap 1")


def test_rejects_patterns_that_collide(tmp_path):
    config = config_with(
        lambda r: r["output"].update(wrapped_filename="{counter:05d}{ext}"))
    card = io.BytesIO(slot(1, DATA, 0, "a") + slot(0, DATA, 0, "b")
                      + slot(1, DATA, 0, "c"))
    with pytest.raises(ValueError, match="same name"):
        export(card, config, tmp_path)


def test_does_not_overwrite_by_default(tmp_path):
    (tmp_path / "00001.BIN").write_bytes(b"keep me")
    card = io.BytesIO(slot(1, DATA, 0, "d0"))
    with pytest.raises(FileExistsError):
        export(card, CONFIG, tmp_path)
    assert (tmp_path / "00001.BIN").read_bytes() == b"keep me"

    export(card, CONFIG, tmp_path, overwrite=True)
    assert (tmp_path / "00001.BIN").read_bytes() == payload("d0")


def test_cli_export(tmp_path, capsys):
    image = tmp_path / "card.img"
    image.write_bytes(slot(4, TEXT, 0, "hello") + corrupt(slot(4, TEXT, 1, "x"))
                      + EMPTY)
    assert main(["export", str(image), str(tmp_path / "out")]) == 0
    output = capsys.readouterr().out
    assert "Scanned 3 slots: 1 valid, 1 empty, 1 corrupt" in output
    assert "slot 1 skipped" in output
    assert (tmp_path / "out" / "00004.TXT").read_bytes() == payload("hello")


def test_cli_reports_wraps(tmp_path, capsys):
    image = tmp_path / "card.img"
    image.write_bytes(slot(5, DATA, 0, "a") + slot(2, DATA, 0, "b"))
    assert main(["export", str(image), str(tmp_path / "out")]) == 0
    assert "startup counter went from 5 to 2" in capsys.readouterr().out


def test_cli_uses_a_format_file(tmp_path, capsys):
    from sd_card_tool.config import default_format_text
    fmt = tmp_path / "format.yaml"
    fmt.write_text(default_format_text().replace("ext: .TXT", "ext: .LOG"))
    image = tmp_path / "card.img"
    image.write_bytes(slot(1, TEXT, 0, "hi"))
    assert main(["export", str(image), str(tmp_path / "out"),
                 "--format", str(fmt)]) == 0
    assert (tmp_path / "out" / "00001.LOG").exists()


def test_cli_reports_errors(tmp_path, capsys):
    assert main(["export", str(tmp_path / "missing.img"),
                 str(tmp_path)]) == 1
    assert "error:" in capsys.readouterr().err


def test_cli_prints_default_format(capsys):
    assert main(["default-format"]) == 0
    assert "slot_size: 32768" in capsys.readouterr().out


def test_groups_corrupt_runs():
    corrupt = [(1, "HEADER_ID is 0x1"), (2, "HEADER_ID is 0x1"),
               (3, "HEADER_ID is 0x2"), (5, "HEADER_ID is 0x2"),
               (6, "CRC is 0x0001, expected 0x0002"),
               (7, "CRC is 0x0003, expected 0x0004")]
    assert corrupt_runs(corrupt) == [
        (1, 2, "HEADER_ID is 0x1"), (3, 3, "HEADER_ID is 0x2"),
        (5, 5, "HEADER_ID is 0x2"), (6, 7, "CRC check failed")]


def test_cli_groups_corrupt_slots(tmp_path, capsys):
    image = tmp_path / "card.img"
    image.write_bytes(EMPTY + (b"\xFF" * SIZE) * 3)
    assert main(["export", str(image), str(tmp_path / "out")]) == 0
    assert "slots 1-3 (3 slots) skipped: HEADER_ID is 0xffffffff" in \
        capsys.readouterr().out

import importlib
import io

import pytest
from helpers import config_with

from sd_card_tool.chunk import Chunk, encode_chunk
from sd_card_tool.config import load_config
from sd_card_tool.export import corrupt_runs, export, scan

# The module, not the export() function the package also exposes.
export_module = importlib.import_module("sd_card_tool.export")
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
    assert sorted(p.name for p in tmp_path.iterdir()) == ["00001.BIN"]

    card.seek(0)
    export(card, CONFIG, tmp_path, overwrite=True)
    assert (tmp_path / "00001.BIN").read_bytes() == payload("d0")


def test_groups_corrupt_runs():
    corrupt = [(1, "HEADER_ID is 0x1"), (2, "HEADER_ID is 0x1"),
               (3, "HEADER_ID is 0x2"), (5, "HEADER_ID is 0x2"),
               (6, "CRC is 0x0001, expected 0x0002"),
               (7, "CRC is 0x0003, expected 0x0004")]
    assert corrupt_runs(corrupt) == [
        (1, 2, "HEADER_ID is 0x1"), (3, 3, "HEADER_ID is 0x2"),
        (5, 5, "HEADER_ID is 0x2"), (6, 7, "CRC check failed")]


class ReadOnce(io.RawIOBase):
    """A card that can only be read front to back, once."""

    def __init__(self, data: bytes) -> None:
        self.data = io.BytesIO(data)
        self.bytes_read = 0

    def readable(self) -> bool:
        return True

    def read(self, size: int = -1) -> bytes:
        chunk = self.data.read(size)
        self.bytes_read += len(chunk)
        return chunk

    def seek(self, *args):
        raise AssertionError("export must not seek the card")


def test_reads_the_card_exactly_once(tmp_path):
    image = b"".join([slot(1, DATA, 1, "d1"), slot(1, TEXT, 0, "t0"),
                      slot(1, DATA, 0, "d0"), EMPTY])
    card = ReadOnce(image)
    _, files = export(card, CONFIG, tmp_path)
    assert card.bytes_read == len(image)
    # Out of order on the card, put back in order from the .part file.
    assert (tmp_path / "00001.BIN").read_bytes() == payload("d0") + payload("d1")
    assert {f.path.name: f.size for f in files} == {
        "00001.BIN": 2 * CONFIG.data_size, "00001.TXT": CONFIG.data_size}


def test_leaves_no_part_files(tmp_path):
    export(io.BytesIO(slot(1, DATA, 1, "d1") + slot(1, DATA, 0, "d0")),
           CONFIG, tmp_path)
    assert sorted(p.name for p in tmp_path.iterdir()) == ["00001.BIN"]


class FailsHalfway(io.BytesIO):
    def read(self, size: int = -1) -> bytes:
        if self.tell() > 0:
            raise OSError(5, "Input/output error")
        return super().read(size)


def test_a_failed_read_leaves_no_files(tmp_path, monkeypatch):
    monkeypatch.setattr(export_module, "SLOTS_PER_READ", 2)
    card = FailsHalfway(b"".join(slot(1, DATA, i, f"d{i}") for i in range(4)))
    with pytest.raises(OSError):
        export(card, CONFIG, tmp_path)
    assert list(tmp_path.iterdir()) == []


def test_replaces_a_part_file_left_by_an_interrupted_export(tmp_path):
    (tmp_path / "00001.BIN.part").write_bytes(b"stale")
    export(io.BytesIO(slot(1, DATA, 0, "d0")), CONFIG, tmp_path)
    assert (tmp_path / "00001.BIN").read_bytes() == payload("d0")
    assert not (tmp_path / "00001.BIN.part").exists()


def test_more_files_than_open_handles(tmp_path, monkeypatch):
    monkeypatch.setattr(export_module, "MAX_OPEN_FILES", 2)
    # One startup writing four types at once, so handles are closed and
    # reopened as the chunks interleave.
    slots = [slot(1, kind, seg, f"{kind}-{seg}") for seg in range(3)
             for kind in range(4)]
    _, files = export(io.BytesIO(b"".join(slots)), CONFIG, tmp_path)
    assert [f.path.name for f in files] == [
        "00001.BIN", "00001.ERR", "00001.TXT", "00001.TYPE3"]
    for kind, file in enumerate(files):
        assert file.path.read_bytes() == b"".join(
            payload(f"{kind}-{seg}") for seg in range(3))

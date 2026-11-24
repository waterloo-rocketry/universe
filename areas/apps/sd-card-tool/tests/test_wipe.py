import io

import pytest
from helpers import config_with

from sd_card_tool import cli
from sd_card_tool.chunk import Chunk, encode_chunk
from sd_card_tool.config import load_config
from sd_card_tool.device import Disk, RawDisk
from sd_card_tool.export import scan
from sd_card_tool.wipe import find_leftovers, make_plan, write_zeros

CONFIG = load_config()
SIZE = CONFIG.slot_size


def junk_card(slots: int) -> io.BytesIO:
    """A card full of 0xFF with a valid chunk in slot 0."""
    data = bytearray(b"\xFF" * (SIZE * slots))
    data[:SIZE] = encode_chunk(Chunk(1, 0, 0, b"old log"), CONFIG)
    return io.BytesIO(data)


def test_clears_the_start_of_every_slot():
    card = junk_card(5)
    plan = make_plan(5 * SIZE, CONFIG, whole=False)
    assert (plan.slots, plan.total) == (5, 5 * 512)
    write_zeros(card, plan)

    data = card.getvalue()
    for slot in range(5):
        start = slot * SIZE
        assert data[start:start + 512] == bytes(512)
    # Only the start of each slot is touched; old 0xFF bytes stay after it.
    assert data[SIZE + 512:2 * SIZE] == b"\xFF" * (SIZE - 512)
    assert find_leftovers(card, plan) == []
    result = scan(io.BytesIO(data), CONFIG)
    assert (result.empty, result.valid, result.corrupt) == (5, 0, [])


def test_whole_card():
    card = junk_card(40)  # more than one 1 MiB block
    plan = make_plan(40 * SIZE, CONFIG, whole=True)
    assert plan.total == 40 * SIZE
    write_zeros(card, plan)
    assert card.getvalue() == bytes(40 * SIZE)
    assert find_leftovers(card, plan) == []


def test_whole_card_with_a_partial_slot_at_the_end():
    card = io.BytesIO(b"\xFF" * (2 * SIZE + 1024))
    write_zeros(card, make_plan(2 * SIZE + 1024, CONFIG, whole=True))
    assert card.getvalue() == bytes(2 * SIZE + 1024)


class StuckSlot(io.BytesIO):
    """A card where writes to one slot are silently lost."""

    def __init__(self, data: bytes, stuck: int) -> None:
        super().__init__(data)
        self.stuck = stuck

    def write(self, data) -> int:
        start = self.stuck * SIZE
        before = self.getvalue()[start:start + SIZE]
        written = super().write(data)
        end = self.tell()
        self.seek(start)
        super().write(before)  # undo any change to the stuck slot
        self.seek(end)
        return written


@pytest.mark.parametrize("whole", [False, True])
def test_check_finds_slots_that_did_not_clear(whole):
    card = StuckSlot(b"\xFF" * (40 * SIZE), stuck=33)
    plan = make_plan(40 * SIZE, CONFIG, whole=whole)
    write_zeros(card, plan)
    assert find_leftovers(card, plan) == [33]


def test_progress_reaches_the_total():
    seen = []
    plan = make_plan(3 * SIZE, CONFIG, whole=False)
    write_zeros(junk_card(3), plan, seen.append)
    assert seen[-1] == plan.total


def test_rejects_a_card_smaller_than_a_slot():
    with pytest.raises(ValueError, match="smaller than one slot"):
        make_plan(SIZE - 1, CONFIG, whole=True)


def test_clear_bytes_must_match_the_card_blocks():
    config = config_with(lambda r: r["layout"].update(clear_bytes=600))
    with pytest.raises(ValueError, match="--whole"):
        make_plan(4 * SIZE, config, whole=False)
    assert make_plan(4 * SIZE, config, whole=True).whole


# --- the format command ------------------------------------------------------

CARD = Disk("disk4", "Test Card", 4 * SIZE, 512, False, True, "USB", True,
            True)


@pytest.fixture
def fake_card(tmp_path, monkeypatch):
    """Point the CLI's disk functions at an image file standing in for disk4."""
    image = tmp_path / "card.img"
    image.write_bytes(junk_card(4).getvalue())
    calls = []
    monkeypatch.setattr(cli, "checked_disk", lambda name: CARD)
    monkeypatch.setattr(cli, "unmount_disk",
                        lambda disk: calls.append(("unmount", disk.identifier)))

    def open_card(disk, writable=False):
        calls.append(("open", writable))
        return RawDisk(open(image, "r+b" if writable else "rb", buffering=0))
    monkeypatch.setattr(cli, "open_disk", open_card)
    return image, calls


def test_format_needs_the_disk_name_typed(fake_card, monkeypatch, capsys):
    image, calls = fake_card
    before = image.read_bytes()
    monkeypatch.setattr("builtins.input", lambda prompt: "yes")
    assert cli.main(["format", "disk4"]) == 1
    assert "nothing was written" in capsys.readouterr().out
    assert calls == []
    assert image.read_bytes() == before


def test_format_after_confirming(fake_card, monkeypatch, capsys):
    image, calls = fake_card
    monkeypatch.setattr("builtins.input", lambda prompt: "disk4")
    assert cli.main(["format", "disk4"]) == 0
    output = capsys.readouterr().out
    assert "This ERASES disk4: Test Card" in output
    assert "All 4 slots are blank" in output
    assert calls == [("unmount", "disk4"), ("open", True)]
    result = scan(io.BytesIO(image.read_bytes()), CONFIG)
    assert result.empty == 4


def test_format_confirm_flag(fake_card, capsys):
    _, calls = fake_card
    assert cli.main(["format", "disk4", "--confirm", "disk5"]) == 1
    assert calls == []
    assert cli.main(["format", "disk4", "--confirm", "disk4", "--whole"]) == 0
    assert "every byte" in capsys.readouterr().out


def test_format_reports_slots_that_stay_dirty(fake_card, monkeypatch, capsys):
    image, _ = fake_card

    def open_stuck(disk, writable=False):
        return StuckSlot(image.read_bytes(), stuck=2)
    monkeypatch.setattr(cli, "open_disk", open_stuck)
    assert cli.main(["format", "disk4", "--confirm", "disk4"]) == 1
    assert "FAILED: 1 slots are not blank" in capsys.readouterr().out


def test_format_an_image_file(tmp_path, capsys):
    image = tmp_path / "card.img"
    image.write_bytes(junk_card(3).getvalue())
    assert cli.main(["format", str(image)]) == 0
    assert "All 3 slots are blank" in capsys.readouterr().out
    assert scan(io.BytesIO(image.read_bytes()), CONFIG).empty == 3

from sd_card_tool.chunk import Chunk, encode_chunk
from sd_card_tool.cli import main
from sd_card_tool.config import load_config

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


def test_cli_groups_corrupt_slots(tmp_path, capsys):
    image = tmp_path / "card.img"
    image.write_bytes(EMPTY + (b"\xFF" * SIZE) * 3)
    assert main(["export", str(image), str(tmp_path / "out")]) == 0
    assert "slots 1-3 (3 slots) skipped: HEADER_ID is 0xffffffff" in \
        capsys.readouterr().out

import io
import plistlib
import sys

import pytest

from sd_card_tool import device
from sd_card_tool.device import (
    DeviceError,
    RawDisk,
    checked_disk,
    disk_info,
    external_disks,
    format_size,
    parse_disk_name,
    problems,
    system_disks,
)

SD_CARD = {
    "DeviceIdentifier": "disk4",
    "IORegistryEntryName": "Mass Storage Device Media",
    "TotalSize": 3980394496,
    "DeviceBlockSize": 512,
    "Internal": False,
    "VirtualOrPhysical": "Physical",
    "BusProtocol": "USB",
    "WholeDisk": True,
    "RemovableMedia": True,
}
LAPTOP = SD_CARD | {"DeviceIdentifier": "disk0", "Internal": True,
                    "IORegistryEntryName": "APPLE SSD", "BusProtocol": "PCI"}
ROOT = {"ParentWholeDisk": "disk1",
        "APFSPhysicalStores": [{"APFSPhysicalStore": "disk0s2"}]}


def fake_diskutil(disks: dict[str, dict], root: dict = ROOT):
    """A stand-in for diskutil that answers from dicts."""
    def run(args: list[str]) -> bytes:
        if args[:2] == ["list", "-plist"]:
            return plistlib.dumps({"WholeDisks": [
                name for name, info in disks.items()
                if not info.get("Internal")]})
        if args[:2] == ["info", "-plist"]:
            if args[2] == "/":
                return plistlib.dumps(root)
            if args[2] not in disks:
                raise DeviceError(f"Could not find disk: {args[2]}")
            return plistlib.dumps(disks[args[2]])
        raise AssertionError(f"unexpected diskutil {args}")
    return run


@pytest.fixture(autouse=True)
def pretend_macos(monkeypatch):
    monkeypatch.setattr(sys, "platform", "darwin")


@pytest.mark.parametrize("text, expected", [
    ("disk4", "disk4"),
    ("/dev/disk4", "disk4"),
    ("/dev/rdisk12", "disk12"),
    ("disk4s1", None),       # a partition
    ("card.img", None),
    ("/dev/sda", None),
])
def test_parse_disk_name(text, expected):
    assert parse_disk_name(text) == expected


def test_reads_disk_info():
    disk = disk_info("disk4", fake_diskutil({"disk4": SD_CARD}))
    assert disk.name == "Mass Storage Device Media"
    assert disk.size == 3980394496
    assert disk.raw_path == "/dev/rdisk4"
    assert disk.describe() == "disk4: Mass Storage Device Media, 3.98 GB, USB"
    assert not disk.internal and disk.physical and disk.whole


def test_system_disks_include_the_physical_store():
    assert system_disks(fake_diskutil({})) == {"disk0", "disk1"}


def test_accepts_an_external_card():
    run = fake_diskutil({"disk4": SD_CARD})
    assert checked_disk("disk4", run).identifier == "disk4"


@pytest.mark.parametrize("name, info, reason", [
    ("disk0", LAPTOP, "holds this computer's system"),
    ("disk5", SD_CARD | {"DeviceIdentifier": "disk5", "Internal": True},
     "internal"),
    ("disk1", SD_CARD | {"DeviceIdentifier": "disk1"}, "system"),
    ("disk6", SD_CARD | {"DeviceIdentifier": "disk6", "WholeDisk": False},
     "partition"),
    ("disk7", SD_CARD | {"DeviceIdentifier": "disk7",
                         "VirtualOrPhysical": "Virtual"}, "virtual"),
    ("disk8", SD_CARD | {"DeviceIdentifier": "disk8", "TotalSize": 0},
     "size"),
])
def test_refuses_unsafe_disks(name, info, reason):
    run = fake_diskutil({name: info})
    with pytest.raises(DeviceError, match=reason):
        checked_disk(name, run)


def test_missing_internal_flag_counts_as_internal():
    info = dict(SD_CARD)
    del info["Internal"]
    with pytest.raises(DeviceError, match="internal"):
        checked_disk("disk4", fake_diskutil({"disk4": info}))


def test_disk_images_are_refused_unless_allowed():
    image = SD_CARD | {"VirtualOrPhysical": "Virtual",
                       "BusProtocol": "Disk Image"}
    run = fake_diskutil({"disk4": image})
    with pytest.raises(DeviceError, match="disk image"):
        checked_disk("disk4", run)
    assert checked_disk("disk4", run, allow_disk_image=True)


def test_allowing_disk_images_still_refuses_other_virtual_disks():
    virtual = SD_CARD | {"VirtualOrPhysical": "Virtual"}
    with pytest.raises(DeviceError, match="virtual"):
        checked_disk("disk4", fake_diskutil({"disk4": virtual}),
                     allow_disk_image=True)


def test_refuses_partitions_by_name():
    with pytest.raises(DeviceError, match="whole disk"):
        checked_disk("disk4s1", fake_diskutil({}))


def test_unknown_disk():
    with pytest.raises(DeviceError, match="Could not find"):
        checked_disk("disk9", fake_diskutil({}))


def test_only_on_macos(monkeypatch):
    monkeypatch.setattr(sys, "platform", "linux")
    with pytest.raises(DeviceError, match="macOS"):
        checked_disk("disk4", fake_diskutil({"disk4": SD_CARD}))


def test_lists_external_disks():
    run = fake_diskutil({"disk0": LAPTOP, "disk4": SD_CARD})
    disks = external_disks(run)
    assert [d.identifier for d in disks] == ["disk4"]
    assert problems(disks[0], system_disks(run)) == []


def test_open_disk_explains_permission_errors(monkeypatch):
    def deny(*args, **kwargs):
        raise PermissionError("denied")
    monkeypatch.setattr("builtins.open", deny)
    disk = disk_info("disk4", fake_diskutil({"disk4": SD_CARD}))
    with pytest.raises(DeviceError, match="sudo"):
        device.open_disk(disk)


class Trickle(io.RawIOBase):
    """Returns at most 3 bytes per read, like a slow device."""

    def __init__(self, data: bytes) -> None:
        self.data = io.BytesIO(data)

    def readable(self) -> bool:
        return True

    def read(self, size: int = -1) -> bytes:
        return self.data.read(min(size, 3))

    def seek(self, offset: int, whence: int = 0) -> int:
        return self.data.seek(offset, whence)


def test_full_reader_fills_each_read():
    reader = RawDisk(Trickle(b"0123456789"))
    assert reader.read(8) == b"01234567"
    assert reader.read(8) == b"89"
    assert reader.read(8) == b""
    reader.seek(2)
    assert reader.read(3) == b"234"


@pytest.mark.parametrize("size, text", [
    (512, "512 bytes"),
    (3980394496, "3.98 GB"),
    (16_000_000_000, "16.00 GB"),
])
def test_format_size(size, text):
    assert format_size(size) == text

"""Finds SD cards on macOS and opens them for raw reading.

Every disk goes through the same safety checks before it is opened, so the
tool can never be pointed at the computer's own drive.
"""

from __future__ import annotations

import os
import plistlib
import re
import subprocess
import sys
from dataclasses import dataclass
from typing import BinaryIO, Callable

# Whole disks only ("disk4"), never a partition ("disk4s1").
DISK_PATTERN = re.compile(r"^(?:/dev/)?r?(disk\d+)$")


class DeviceError(Exception):
    """A disk can't be used, or diskutil failed."""


@dataclass(frozen=True)
class Disk:
    identifier: str       # e.g. "disk4"
    name: str             # what macOS calls the media
    size: int             # bytes
    block_size: int
    internal: bool
    physical: bool
    protocol: str         # e.g. "USB", "Secure Digital", "Disk Image"
    whole: bool
    removable: bool

    @property
    def raw_path(self) -> str:
        # The "r" device skips the kernel's buffer cache; much faster.
        return f"/dev/r{self.identifier}"

    def describe(self) -> str:
        return (f"{self.identifier}: {self.name}, {format_size(self.size)}, "
                f"{self.protocol}")


# Runs diskutil and returns its stdout; replaced in tests.
Runner = Callable[[list[str]], bytes]


def _diskutil(args: list[str]) -> bytes:
    try:
        return subprocess.run(["diskutil", *args], check=True,
                              capture_output=True).stdout
    except FileNotFoundError as error:
        raise DeviceError("diskutil not found; this needs macOS") from error
    except subprocess.CalledProcessError as error:
        message = error.stderr.decode(errors="replace").strip()
        raise DeviceError(message or f"diskutil {' '.join(args)} failed") \
            from error


def parse_disk_name(text: str) -> str | None:
    """Return "diskN" if text names a whole disk, otherwise None."""
    match = DISK_PATTERN.match(text)
    return match.group(1) if match else None


def disk_info(identifier: str, run: Runner = _diskutil) -> Disk:
    info = plistlib.loads(run(["info", "-plist", identifier]))
    return Disk(
        identifier=info.get("DeviceIdentifier", identifier),
        name=info.get("IORegistryEntryName") or info.get("MediaName")
        or "(no name)",
        size=int(info.get("TotalSize") or info.get("Size") or 0),
        block_size=int(info.get("DeviceBlockSize") or 512),
        internal=bool(info.get("Internal", True)),
        physical=info.get("VirtualOrPhysical") != "Virtual",
        protocol=info.get("BusProtocol") or "unknown",
        whole=bool(info.get("WholeDisk", False)),
        removable=bool(info.get("RemovableMedia") or info.get("Removable")
                       or info.get("Ejectable")),
    )


def system_disks(run: Runner = _diskutil) -> set[str]:
    """Whole disks that hold the running system (the "/" volume)."""
    info = plistlib.loads(run(["info", "-plist", "/"]))
    disks = {info.get("ParentWholeDisk")}
    for store in info.get("APFSPhysicalStores") or []:
        name = store.get("APFSPhysicalStore", "")
        disks.add(re.sub(r"s\d+$", "", name))
    return {disk for disk in disks if disk}


def problems(disk: Disk, system: set[str],
             allow_disk_image: bool = False) -> list[str]:
    """Reasons this disk must not be used; empty if it is safe.

    Disk images (a mounted .dmg, or a test card made with hdiutil) are
    refused unless allow_disk_image is set: disk numbers change as things
    are plugged in, so "disk2" can be a downloaded installer one day and the
    SD card the next.
    """
    found = []
    if disk.identifier in system:
        found.append("it holds this computer's system")
    if disk.internal:
        found.append("it is an internal disk")
    if not disk.whole:
        found.append("it is a partition, not a whole disk")
    if disk.protocol == "Disk Image":
        if not allow_disk_image:
            found.append("it is a disk image, not an SD card "
                         "(--allow-disk-image is for testing)")
    elif not disk.physical:
        found.append("it is a virtual disk")
    if disk.size <= 0:
        found.append("its size is unknown")
    return found


def external_disks(run: Runner = _diskutil) -> list[Disk]:
    """Every external whole disk, safe or not, for listing."""
    listing = plistlib.loads(run(["list", "-plist", "external"]))
    return [disk_info(name, run) for name in listing.get("WholeDisks", [])]


def checked_disk(text: str, run: Runner = _diskutil,
                 allow_disk_image: bool = False) -> Disk:
    """Look up a disk by name and refuse anything unsafe."""
    if sys.platform != "darwin":
        raise DeviceError(
            "Reading cards directly only works on macOS for now; "
            "use an image file instead")
    identifier = parse_disk_name(text)
    if identifier is None:
        raise DeviceError(f"{text!r} is not a whole disk like disk4")
    disk = disk_info(identifier, run)
    found = problems(disk, system_disks(run), allow_disk_image)
    if found:
        raise DeviceError(
            f"Refusing to use {disk.describe()}: " + "; ".join(found))
    return disk


class RawDisk:
    """A raw disk device opened unbuffered.

    read(n) returns n bytes unless at the end, write() is retried by the
    caller until everything is written, and flush() makes sure the card has
    actually stored what was written.
    """

    def __init__(self, raw: BinaryIO) -> None:
        self._raw = raw

    def read(self, size: int) -> bytes:
        parts = []
        while size > 0:
            part = self._raw.read(size)
            if not part:
                break
            parts.append(part)
            size -= len(part)
        return b"".join(parts)

    def write(self, data) -> int:
        return self._raw.write(data)

    def seek(self, offset: int, whence: int = 0) -> int:
        return self._raw.seek(offset, whence)

    def flush(self) -> None:
        self._raw.flush()
        try:
            fd = self._raw.fileno()
        except (AttributeError, OSError, ValueError):
            return
        try:
            import fcntl
            # On macOS, fsync alone may leave data in the drive's cache.
            fcntl.fcntl(fd, fcntl.F_FULLFSYNC)
        except (ImportError, AttributeError, OSError):
            os.fsync(fd)

    def close(self) -> None:
        self._raw.close()

    def __enter__(self) -> "RawDisk":
        return self

    def __exit__(self, *exc: object) -> None:
        self.close()


def open_disk(disk: Disk, writable: bool = False) -> RawDisk:
    """Open a checked disk, read-only unless writable is True."""
    try:
        raw = open(disk.raw_path, "r+b" if writable else "rb", buffering=0)
    except PermissionError as error:
        raise DeviceError(
            f"No permission to {'write' if writable else 'read'} "
            f"{disk.raw_path}. Run the command with sudo (see the README).") \
            from error
    return RawDisk(raw)


def unmount_disk(disk: Disk, run: Runner = _diskutil) -> None:
    """Unmount every volume on the disk so nothing else writes to it."""
    run(["unmountDisk", disk.identifier])


def give_back_to_user(paths: list[str]) -> None:
    """Under sudo, hand created files back to the user who ran sudo."""
    uid, gid = os.environ.get("SUDO_UID"), os.environ.get("SUDO_GID")
    if os.geteuid() != 0 or uid is None or gid is None:
        return
    for path in paths:
        os.chown(path, int(uid), int(gid))


def format_size(size: int) -> str:
    for unit in ("bytes", "KB", "MB", "GB", "TB"):
        if size < 1000 or unit == "TB":
            return f"{size:.2f} {unit}" if unit != "bytes" else f"{size} bytes"
        size /= 1000
    return ""  # unreachable

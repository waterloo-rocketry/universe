"""Migrate an existing repository into areas/ as a single snapshot commit.

History is deliberately not carried over: each repository lands as one commit
whose message links back to the exact upstream commit (where the full history
still lives) and credits every upstream author and co-author with a
``Co-authored-by:`` trailer, plus their commit and line counts.

Two steps, so the snapshot can be inspected before anything is committed:

    uv run tools/import_repo <git-url> <dest>                  # copy files + write message
    git add <dest> && git commit -F <message-file>             # when happy with it
"""

from __future__ import annotations

import argparse
import io
import re
import subprocess
import sys
import tarfile
import tempfile
from collections import Counter
from dataclasses import dataclass, field
from pathlib import Path

# Authors that are automation or AI assistants, not people, and so get no
# co-author credit.
BOT_PATTERN = re.compile(
    r"\[bot\]|^noreply@github\.com$|^actions@github\.com$|^noreply@anthropic\.com$"
    r"|^\d+\+Copilot@users\.noreply\.github\.com$|@cursor\.(com|sh)$",
    re.I,
)
NOREPLY_PATTERN = re.compile(r"^(?:\d+\+)?(?P<login>[^@]+)@users\.noreply\.github\.com$", re.I)
TRAILER_PATTERN = re.compile(r"^\s*(?P<name>.+?)\s*<(?P<email>[^>]+)>\s*$")
RECORD_SEP = "\x1e"


@dataclass(frozen=True)
class Identity:
    name: str
    email: str


@dataclass
class Contributor:
    """One person, possibly committing under several names/emails."""

    names: Counter[str] = field(default_factory=Counter)
    emails: Counter[str] = field(default_factory=Counter)
    commits: int = 0
    co_authored: int = 0
    added: int = 0
    removed: int = 0

    @property
    def name(self) -> str:
        return self.names.most_common(1)[0][0]

    @property
    def email(self) -> str:
        # A GitHub noreply address always resolves to the right account, so
        # prefer it; otherwise use the address they committed with most.
        noreply = [e for e, _ in self.emails.most_common() if NOREPLY_PATTERN.search(e)]
        return noreply[0] if noreply else self.emails.most_common(1)[0][0]


@dataclass(frozen=True)
class CommitRecord:
    author: Identity
    co_authors: tuple[Identity, ...]
    added: int
    removed: int


def git(repo: Path, *args: str) -> str:
    return subprocess.run(
        ["git", "-C", str(repo), *args], check=True, capture_output=True, text=True
    ).stdout


def parse_log(log: str) -> list[CommitRecord]:
    """Parse output of ``git log`` in the format produced by ``read_commits``."""
    records = []
    for chunk in log.split(RECORD_SEP)[1:]:
        header, _, rest = chunk.partition("\n")
        name, email, trailers = (header.split("\t") + ["", ""])[:3]
        co_authors = []
        for value in trailers.split(";"):
            match = TRAILER_PATTERN.match(value)
            if match:
                co_authors.append(Identity(match["name"], match["email"]))
        added = removed = 0
        for line in rest.splitlines():
            parts = line.split("\t")
            # Binary files report "-" instead of line counts.
            if len(parts) == 3 and parts[0].isdigit() and parts[1].isdigit():
                added += int(parts[0])
                removed += int(parts[1])
        records.append(CommitRecord(Identity(name, email), tuple(co_authors), added, removed))
    return records


def read_commits(repo: Path, ref: str) -> list[CommitRecord]:
    log = git(
        repo,
        "log",
        ref,
        "--use-mailmap",
        "--no-merges",
        "--numstat",
        f"--format={RECORD_SEP}%aN%x09%aE%x09%(trailers:key=Co-authored-by,valueonly,separator=;)",
    )
    return parse_log(log)


def is_bot(identity: Identity) -> bool:
    return bool(BOT_PATTERN.search(identity.name) or BOT_PATTERN.search(identity.email))


def identity_keys(identity: Identity) -> list[str]:
    """Keys under which two identities are considered the same person.

    Besides exact email and name, people commit as e.g. "Kavin Satheeskumar"
    from one machine and "KavinSatheeskumar" (their GitHub login, via a noreply
    address) from another, so a normalised handle is compared too: the GitHub
    login of a noreply address, an email's local part, and the space-free name.
    """
    email = identity.email.lower()
    name = identity.name.lower()
    noreply = NOREPLY_PATTERN.match(email)
    handle = noreply["login"] if noreply else email.partition("@")[0]
    # "shreyshingala1@gmail.com" and login "ShreyShingala" are the same person.
    handles = {handle, handle.rstrip("0123456789"), re.sub(r"\s+", "", name)}
    return [f"e:{email}", f"n:{name}", *(f"h:{h}" for h in sorted(handles) if len(h) > 2)]


def tally_contributors(records: list[CommitRecord]) -> list[Contributor]:
    """Merge identities that look like the same person (see `identity_keys`)
    into one contributor each, ordered by commits then lines added."""
    # Union-find over identities: any shared key joins two identities.
    parent: dict[Identity, Identity] = {}

    def root(identity: Identity) -> Identity:
        while parent[identity] != identity:
            parent[identity] = parent[parent[identity]]
            identity = parent[identity]
        return identity

    owner_of_key: dict[str, Identity] = {}
    people_in = [r.author for r in records] + [c for r in records for c in r.co_authors]
    for identity in people_in:
        if is_bot(identity) or identity in parent:
            continue
        parent[identity] = identity
        for key in identity_keys(identity):
            if key in owner_of_key:
                parent[root(identity)] = root(owner_of_key[key])
            else:
                owner_of_key[key] = identity

    people: dict[Identity, Contributor] = {}

    def person_for(identity: Identity) -> Contributor:
        person = people.setdefault(root(identity), Contributor())
        person.names[identity.name] += 1
        person.emails[identity.email] += 1
        return person

    for record in records:
        if not is_bot(record.author):
            person = person_for(record.author)
            person.commits += 1
            person.added += record.added
            person.removed += record.removed
        for co_author in record.co_authors:
            if not is_bot(co_author):
                person_for(co_author).co_authored += 1

    return sorted(
        people.values(), key=lambda c: (-c.commits, -c.co_authored, -c.added, c.name.lower())
    )


def render_message(
    *,
    project: str,
    dest: str,
    url: str,
    sha: str,
    branch: str,
    date: str,
    contributors: list[Contributor],
) -> str:
    web_url = url.removesuffix(".git")
    width = max((len(c.name) for c in contributors), default=0)
    rows = []
    for c in contributors:
        extra = f", co-authored {c.co_authored}" if c.co_authored else ""
        rows.append(
            f"  {c.name:<{width}}  {c.commits:>4} commits  +{c.added}/-{c.removed}{extra}"
        )
    trailers = [f"Co-authored-by: {c.name} <{c.email}>" for c in contributors]
    return "\n".join(
        [
            f"Migrate {project} into {dest}",
            "",
            f"Snapshot of {web_url} at {sha[:12]} ({branch}, {date}).",
            "History was not carried over. The full commit history is in the",
            "original repository:",
            "",
            f"  {web_url}/commits/{sha}",
            "",
            "Upstream contributors (commits, lines added/removed):",
            "",
            *rows,
            "",
            *trailers,
            "",
        ]
    )


def extract_snapshot(repo: Path, ref: str, dest: Path) -> int:
    """Write the tracked files at `ref` into `dest`. Returns the file count."""
    archive = subprocess.run(
        ["git", "-C", str(repo), "archive", "--format=tar", ref],
        check=True,
        capture_output=True,
    ).stdout
    dest.mkdir(parents=True, exist_ok=True)
    with tarfile.open(fileobj=io.BytesIO(archive)) as tar:
        tar.extractall(dest, filter="tar")
        return sum(1 for m in tar.getmembers() if m.isfile())


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="import_repo", description=__doc__.splitlines()[0])
    parser.add_argument("url", help="Upstream repository URL (linked in the commit message)")
    parser.add_argument("dest", help="Destination, e.g. areas/sw_libs/parsley")
    parser.add_argument("--ref", help="Upstream ref to snapshot (default: its default branch)")
    parser.add_argument(
        "--clone", type=Path, help="Use this existing clone of `url` instead of cloning"
    )
    parser.add_argument(
        "--message-out", type=Path, help="Write the commit message here (default: stdout)"
    )
    args = parser.parse_args(argv)

    dest = Path(args.dest)
    if dest.exists() and any(dest.iterdir()):
        print(f"error: {dest} already exists and is not empty", file=sys.stderr)
        return 1

    with tempfile.TemporaryDirectory() as tmp:
        repo = args.clone
        if repo is None:
            repo = Path(tmp) / "src"
            subprocess.run(["git", "clone", "--quiet", args.url, str(repo)], check=True)
        ref = args.ref or "HEAD"
        sha = git(repo, "rev-parse", f"{ref}^{{commit}}").strip()
        branch = args.ref or git(repo, "rev-parse", "--abbrev-ref", "HEAD").strip()
        date = git(repo, "show", "-s", "--format=%cs", sha).strip()

        count = extract_snapshot(repo, sha, dest)
        contributors = tally_contributors(read_commits(repo, sha))

    message = render_message(
        project=dest.name,
        dest=dest.as_posix(),
        url=args.url,
        sha=sha,
        branch=branch,
        date=date,
        contributors=contributors,
    )
    if args.message_out:
        args.message_out.parent.mkdir(parents=True, exist_ok=True)
        args.message_out.write_text(message)
        print(
            f"{dest}: {count} files from {sha[:12]}, {len(contributors)} contributors; "
            f"message -> {args.message_out}"
        )
    else:
        print(message)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

from __future__ import annotations

import subprocess
from pathlib import Path

from tools.import_repo import import_repo as ir

SEP = ir.RECORD_SEP


def test_parse_log_reads_authors_trailers_and_line_counts():
    log = (
        f"{SEP}Ada\tada@x.com\tBob <bob@x.com>;\n\n3\t1\ta.py\n-\t-\timg.png\n"
        f"{SEP}Bob\tbob@x.com\t\n\n2\t0\tb.py\n"
    )
    records = ir.parse_log(log)

    assert records[0].author == ir.Identity("Ada", "ada@x.com")
    assert records[0].co_authors == (ir.Identity("Bob", "bob@x.com"),)
    assert (records[0].added, records[0].removed) == (3, 1)  # binary file skipped
    assert records[1].co_authors == ()


def test_tally_merges_identities_sharing_email_or_name():
    records = [
        ir.CommitRecord(ir.Identity("BluCode", "1+Blu@users.noreply.github.com"), (), 10, 0),
        ir.CommitRecord(ir.Identity("BluCodeGH", "1+Blu@users.noreply.github.com"), (), 5, 0),
        ir.CommitRecord(ir.Identity("bluCode", "blu@gmail.com"), (), 1, 1),
    ]
    [person] = ir.tally_contributors(records)

    assert person.commits == 3
    assert (person.added, person.removed) == (16, 1)
    assert person.email == "1+Blu@users.noreply.github.com"  # noreply preferred


def test_tally_credits_co_authors_and_skips_bots():
    records = [
        ir.CommitRecord(
            ir.Identity("dependabot[bot]", "49699333+dependabot[bot]@users.noreply.github.com"),
            (ir.Identity("Cy", "cy@x.com"),),
            100,
            0,
        ),
    ]
    [person] = ir.tally_contributors(records)

    assert person.name == "Cy"
    assert (person.commits, person.co_authored) == (0, 1)


def test_render_message_links_upstream_and_adds_trailers():
    person = ir.Contributor()
    person.names["Ada"] += 1
    person.emails["ada@x.com"] += 1
    person.commits, person.added, person.removed = 2, 30, 4

    message = ir.render_message(
        project="parsley",
        dest="areas/sw_libs/parsley",
        url="https://github.com/org/parsley.git",
        sha="abcdef1234567890",
        branch="main",
        date="2026-08-26",
        contributors=[person],
    )

    assert message.startswith("Import parsley into areas/sw_libs/parsley\n\n")
    assert "https://github.com/org/parsley/commits/abcdef1234567890" in message
    assert message.rstrip().endswith("Co-authored-by: Ada <ada@x.com>")


def test_main_snapshots_tracked_files_only(tmp_path: Path):
    upstream = tmp_path / "up"
    upstream.mkdir()
    run = lambda *a: subprocess.run(["git", "-C", str(upstream), *a], check=True)  # noqa: E731
    run("init", "-q", "-b", "main")
    (upstream / "kept.txt").write_text("hi\n")
    run("add", "kept.txt")
    run("-c", "user.name=Ada", "-c", "user.email=ada@x.com", "commit", "-qm", "init")
    (upstream / "untracked.txt").write_text("nope\n")

    dest = tmp_path / "areas" / "sw_libs" / "demo"
    out = tmp_path / "msg.txt"
    code = ir.main([str(upstream), str(dest), "--clone", str(upstream), "--message-out", str(out)])

    assert code == 0
    assert (dest / "kept.txt").read_text() == "hi\n"
    assert not (dest / "untracked.txt").exists()
    assert "Co-authored-by: Ada <ada@x.com>" in out.read_text()


def test_tally_merges_github_login_with_other_addresses():
    records = [
        ir.CommitRecord(ir.Identity("Kavin Satheeskumar", "71+KavinSatheeskumar@users.noreply.github.com"), (), 1, 0),
        ir.CommitRecord(ir.Identity("KavinSatheeskumar", "kavinsatheesk@gmail.com"), (), 1, 0),
        ir.CommitRecord(ir.Identity("Chris Yang", "chrisyx511@gmail.com"), (), 1, 0),
        ir.CommitRecord(ir.Identity("ChrisYx511", "58+ChrisYx511@users.noreply.github.com"), (), 1, 0),
    ]
    people = ir.tally_contributors(records)

    assert sorted(p.commits for p in people) == [2, 2]


def test_tally_skips_ai_assistant_co_authors():
    records = [
        ir.CommitRecord(
            ir.Identity("Ada", "ada@x.com"),
            (
                ir.Identity("Claude Opus 4.6", "noreply@anthropic.com"),
                ir.Identity("Copilot", "198982749+Copilot@users.noreply.github.com"),
            ),
            1,
            0,
        ),
    ]
    assert [p.name for p in ir.tally_contributors(records)] == ["Ada"]

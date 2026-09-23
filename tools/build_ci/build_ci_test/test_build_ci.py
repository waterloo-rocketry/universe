from __future__ import annotations

from pathlib import Path

import pytest

from tools.build_ci import build_ci


@pytest.fixture
def repo(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Path:
    """A scratch repo root with build_ci's module-level path globals patched
    to point at it, so tests never touch the real monorepo."""
    areas_root = tmp_path / "areas"
    root_workflows_dir = tmp_path / ".github" / "workflows"
    areas_root.mkdir(parents=True)
    monkeypatch.setattr(build_ci, "REPO_ROOT", tmp_path)
    monkeypatch.setattr(build_ci, "AREAS_ROOT", areas_root)
    monkeypatch.setattr(build_ci, "ROOT_WORKFLOWS_DIR", root_workflows_dir)
    return tmp_path


def write_workflow(
    areas_root: Path,
    area_parts: tuple[str, ...],
    filename: str,
    body: str = "on:\n  push:\n    paths:\n      - '{scope}/**'\njobs: {{}}\n",
) -> Path:
    scope = "/".join(("areas", *area_parts))
    wf_dir = areas_root / Path(*area_parts) / ".github" / "workflows"
    wf_dir.mkdir(parents=True, exist_ok=True)
    path = wf_dir / filename
    path.write_text(body.format(scope=scope))
    return path


def test_find_area_workflows_respects_max_depth(repo: Path):
    areas_root = build_ci.AREAS_ROOT
    write_workflow(areas_root, ("apps", "omnibus"), "ci.yml")  # depth 3, allowed
    write_workflow(areas_root, ("apps", "omnibus", "too", "deep"), "ci.yml")  # depth 5

    found = build_ci.find_area_workflows()
    area_parts = {wf.area_parts for wf in found}

    assert ("apps", "omnibus") in area_parts
    assert ("apps", "omnibus", "too", "deep") not in area_parts
    assert len(found) == 1


def test_find_area_workflows_ignores_hidden_dirs_other_than_github(repo: Path):
    areas_root = build_ci.AREAS_ROOT
    write_workflow(areas_root, ("apps",), "ci.yml")
    hidden = areas_root / "apps" / ".cache" / ".github" / "workflows"
    hidden.mkdir(parents=True)
    (hidden / "ci.yml").write_text("on: push\njobs: {}\n")

    found = build_ci.find_area_workflows()
    assert len(found) == 1
    assert found[0].area_parts == ("apps",)


def test_link_name_mirrors_area_path(repo: Path):
    wf = build_ci.AreaWorkflow(Path("ci.yml"), ("apps", "omnibus"))
    assert wf.link_name == "ci-areas-apps-omnibus.yml"


def test_create_link_creates_relative_symlink(repo: Path):
    areas_root = build_ci.AREAS_ROOT
    source = write_workflow(areas_root, ("apps", "omnibus"), "ci.yml")
    wf = build_ci.AreaWorkflow(source, ("apps", "omnibus"))

    link = build_ci.create_link(wf)

    assert link.is_symlink()
    assert link.resolve() == source.resolve()
    assert build_ci.is_correctly_linked(wf)


def test_run_creates_missing_symlinks(repo: Path):
    areas_root = build_ci.AREAS_ROOT
    write_workflow(areas_root, ("apps", "omnibus"), "ci.yml")

    exit_code = build_ci.run(validate=False)

    assert exit_code == 0
    linked = list(build_ci.ROOT_WORKFLOWS_DIR.iterdir())
    assert len(linked) == 1
    assert linked[0].name == "ci-areas-apps-omnibus.yml"


def test_validate_fails_when_symlink_missing(repo: Path):
    areas_root = build_ci.AREAS_ROOT
    write_workflow(areas_root, ("apps", "omnibus"), "ci.yml")

    assert build_ci.run(validate=True) == 1


def test_validate_passes_after_run(repo: Path):
    areas_root = build_ci.AREAS_ROOT
    write_workflow(areas_root, ("apps", "omnibus"), "ci.yml")

    build_ci.run(validate=False)

    assert build_ci.run(validate=True) == 0


def test_check_scoping_flags_missing_paths_filter(repo: Path):
    areas_root = build_ci.AREAS_ROOT
    source = write_workflow(
        areas_root, ("apps", "omnibus"), "ci.yml", body="on:\n  push: {{}}\njobs: {{}}\n"
    )
    wf = build_ci.AreaWorkflow(source, ("apps", "omnibus"))

    issues = build_ci.check_scoping(wf)

    assert any("paths" in issue for issue in issues)


def test_check_scoping_flags_bareword_on(repo: Path):
    areas_root = build_ci.AREAS_ROOT
    source = write_workflow(
        areas_root, ("apps", "omnibus"), "ci.yml", body="on: push\njobs: {{}}\n"
    )
    wf = build_ci.AreaWorkflow(source, ("apps", "omnibus"))

    issues = build_ci.check_scoping(wf)

    assert issues


def test_check_scoping_flags_out_of_scope_path(repo: Path):
    areas_root = build_ci.AREAS_ROOT
    source = write_workflow(
        areas_root,
        ("apps", "omnibus"),
        "ci.yml",
        body="on:\n  push:\n    paths:\n      - 'areas/apps/other/**'\njobs: {{}}\n",
    )
    wf = build_ci.AreaWorkflow(source, ("apps", "omnibus"))

    issues = build_ci.check_scoping(wf)

    assert any("not scoped" in issue for issue in issues)


def test_check_scoping_accepts_properly_scoped_workflow(repo: Path):
    areas_root = build_ci.AREAS_ROOT
    source = write_workflow(areas_root, ("apps", "omnibus"), "ci.yml")
    wf = build_ci.AreaWorkflow(source, ("apps", "omnibus"))

    assert build_ci.check_scoping(wf) == []


def test_validate_fails_on_scoping_issue_even_when_linked(repo: Path):
    areas_root = build_ci.AREAS_ROOT
    write_workflow(
        areas_root, ("apps", "omnibus"), "ci.yml", body="on:\n  push: {{}}\njobs: {{}}\n"
    )
    build_ci.run(validate=False)

    assert build_ci.run(validate=True) == 1


def test_find_orphaned_links_detects_dangling_symlink(repo: Path):
    areas_root = build_ci.AREAS_ROOT
    workflows_dir = build_ci.ROOT_WORKFLOWS_DIR
    workflows_dir.mkdir(parents=True)
    ghost_source = areas_root / "apps" / ".github" / "workflows" / "gone.yml"
    ghost_source.parent.mkdir(parents=True)
    ghost_source.write_text("on: push\njobs: {}\n")
    link = workflows_dir / "gone-areas-apps.yml"
    link.symlink_to(ghost_source)
    ghost_source.unlink()

    orphans = build_ci.find_orphaned_links([])

    assert link in orphans

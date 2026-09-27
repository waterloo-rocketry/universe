"""Copy nested GitHub Actions workflows from areas/ into .github/workflows/.

GitHub only discovers workflow files under the repo-root ``.github/workflows``
directory, but this monorepo keeps each workflow next to the code it builds,
at ``areas/<up to 3 path segments>/.github/workflows/<name>.yml``. This tool
copies (and validates) each of those files into the root workflows directory
(symlinks don't work for this — GitHub Actions doesn't follow them), and
checks that each workflow's ``on:`` triggers are scoped to its own area via a
``paths:`` filter.
"""

from __future__ import annotations

import argparse
import filecmp
import os
import re
import shutil
import sys
from dataclasses import dataclass
from pathlib import Path

import yaml

MAX_DEPTH = 3  # max path segments from areas/ through and including .github/
WORKFLOW_EXTENSIONS = (".yml", ".yaml")
PATH_SCOPED_EVENTS = ("push", "pull_request", "pull_request_target")
MANAGED_COPY_PATTERN = re.compile(r"-areas-[^/]+\.ya?ml$")


def _find_repo_root(start: Path | None = None) -> Path:
    """Walk up from `start` (default: cwd) looking for the monorepo root,
    identified by a .git directory alongside an areas/ folder.

    __file__-relative detection doesn't work once this is installed into a
    site-packages directory, so the root is instead located from where the
    tool is actually invoked.
    """
    here = (start or Path.cwd()).resolve()
    for candidate in (here, *here.parents):
        if (candidate / ".git").exists() and (candidate / "areas").is_dir():
            return candidate
    raise RuntimeError(
        "Could not locate the monorepo root (expected a .git directory next to "
        "an areas/ folder in a parent of the current directory)."
    )


REPO_ROOT = _find_repo_root()
AREAS_ROOT = REPO_ROOT / "areas"
ROOT_WORKFLOWS_DIR = REPO_ROOT / ".github" / "workflows"


@dataclass(frozen=True)
class AreaWorkflow:
    """A workflow file discovered under areas/.../.github/workflows/."""

    source: Path
    area_parts: tuple[str, ...]

    @property
    def copy_name(self) -> str:
        tag = "-".join(("areas", *self.area_parts))
        return f"{self.source.stem}-{tag}{self.source.suffix}"

    @property
    def area_path(self) -> str:
        return "/".join(("areas", *self.area_parts))


def find_area_workflows(areas_root: Path | None = None) -> list[AreaWorkflow]:
    """Find every workflow file under areas/, up to MAX_DEPTH directories deep.

    Traversal is bounded (no descent past MAX_DEPTH, no descent into hidden
    directories other than .github, and no descent into .github itself) so
    it never walks unrelated trees like node_modules or build output.
    """
    if areas_root is None:
        areas_root = AREAS_ROOT
    workflows: list[AreaWorkflow] = []

    def scan(dir_path: Path, parts: tuple[str, ...]) -> None:
        try:
            entries = list(os.scandir(dir_path))
        except OSError:
            return
        for entry in entries:
            if not entry.is_dir(follow_symlinks=False):
                continue
            name = entry.name
            if name == ".github":
                if len(parts) + 1 > MAX_DEPTH:
                    continue
                workflows_dir = Path(entry.path) / "workflows"
                if not workflows_dir.is_dir():
                    continue
                for wf_entry in os.scandir(workflows_dir):
                    if wf_entry.is_file(follow_symlinks=True) and wf_entry.name.endswith(
                        WORKFLOW_EXTENSIONS
                    ):
                        workflows.append(AreaWorkflow(Path(wf_entry.path), parts))
                continue
            if name.startswith("."):
                continue
            if len(parts) + 1 < MAX_DEPTH:
                scan(Path(entry.path), parts + (name,))

    scan(areas_root, ())
    return workflows


def expected_copy_path(workflow: AreaWorkflow) -> Path:
    return ROOT_WORKFLOWS_DIR / workflow.copy_name


def copy_status(workflow: AreaWorkflow) -> str:
    """"ok", "missing", or "drifted" (exists but no longer matches source)."""
    copy = expected_copy_path(workflow)
    if not copy.is_file() or copy.is_symlink():
        return "missing"
    if filecmp.cmp(copy, workflow.source, shallow=False):
        return "ok"
    return "drifted"


def create_copy(workflow: AreaWorkflow) -> Path:
    copy = expected_copy_path(workflow)
    copy.parent.mkdir(parents=True, exist_ok=True)
    if copy.is_symlink() or copy.exists():
        copy.unlink()
    shutil.copy2(workflow.source, copy)
    return copy


def find_orphaned_copies(workflows: list[AreaWorkflow]) -> list[Path]:
    """Files in .github/workflows/ that look build_ci-managed (named after the
    `<name>-areas-<path>.yml` convention) but no longer correspond to a
    discovered area workflow — left behind by a rename/removal upstream."""
    if not ROOT_WORKFLOWS_DIR.is_dir():
        return []
    expected = {expected_copy_path(wf) for wf in workflows}
    orphans = []
    for entry in os.scandir(ROOT_WORKFLOWS_DIR):
        path = Path(entry.path)
        if path in expected:
            continue
        if MANAGED_COPY_PATTERN.search(path.name):
            orphans.append(path)
    return orphans


def _on_triggers(doc: dict) -> object:
    # PyYAML parses the bare `on:` key as the boolean True (YAML 1.1 bareword).
    if True in doc:
        return doc[True]
    return doc.get("on")


def check_scoping(workflow: AreaWorkflow) -> list[str]:
    """Return a list of human-readable warnings if `on:` isn't scoped to this
    workflow's own area path via a `paths:` filter."""
    try:
        doc = yaml.safe_load(workflow.source.read_text())
    except (OSError, yaml.YAMLError) as exc:
        return [f"could not parse YAML ({exc})"]

    if not isinstance(doc, dict):
        return ["workflow file has no top-level `on:` mapping"]

    on_value = _on_triggers(doc)
    if on_value is None:
        return ["missing `on:` trigger"]

    if isinstance(on_value, (str, list)):
        events = {on_value} if isinstance(on_value, str) else set(on_value)
        scoped_events = events & set(PATH_SCOPED_EVENTS)
        if scoped_events:
            return [
                f"`on: {sorted(scoped_events)}` has no `paths:` filter scoping it to "
                f"{workflow.area_path}/"
            ]
        return []

    if not isinstance(on_value, dict):
        return []

    warnings: list[str] = []
    expected_prefix = f"{workflow.area_path}/"
    for event in PATH_SCOPED_EVENTS:
        if event not in on_value:
            continue
        event_config = on_value[event]
        if not isinstance(event_config, dict):
            warnings.append(
                f"`on.{event}` has no `paths:` filter scoping it to {expected_prefix}"
            )
            continue
        paths = event_config.get("paths")
        if not paths:
            warnings.append(
                f"`on.{event}` has no `paths:` filter scoping it to {expected_prefix}"
            )
            continue
        for pattern in paths:
            normalized = pattern.lstrip("./")
            if not normalized.startswith(expected_prefix):
                warnings.append(
                    f"`on.{event}.paths` entry {pattern!r} is not scoped to {expected_prefix}"
                )
    return warnings


def run(validate: bool) -> int:
    workflows = find_area_workflows()
    out_of_date: list[tuple[AreaWorkflow, str]] = []
    scoping_issues: list[tuple[AreaWorkflow, list[str]]] = []

    for workflow in workflows:
        status = copy_status(workflow)
        if status != "ok":
            out_of_date.append((workflow, status))
        issues = check_scoping(workflow)
        if issues:
            scoping_issues.append((workflow, issues))

    orphans = find_orphaned_copies(workflows)

    if validate:
        ok = True
        for workflow, status in out_of_date:
            verb = "is missing from" if status == "missing" else "has drifted from"
            print(
                f"ERROR: {workflow.source.relative_to(REPO_ROOT)} {verb} "
                f".github/workflows/{workflow.copy_name}",
                file=sys.stderr,
            )
            ok = False
        for path in orphans:
            print(
                f"ERROR: stale copy .github/workflows/{path.name} has no matching "
                "area workflow",
                file=sys.stderr,
            )
            ok = False
        for workflow, issues in scoping_issues:
            for issue in issues:
                print(
                    f"ERROR: {workflow.source.relative_to(REPO_ROOT)}: {issue}",
                    file=sys.stderr,
                )
                ok = False
        if ok:
            print(f"OK: {len(workflows)} workflow(s) copied and scoped correctly.")
        return 0 if ok else 1

    for workflow, status in out_of_date:
        copy = create_copy(workflow)
        verb = "copied" if status == "missing" else "re-copied (was drifted)"
        print(f"{verb} {workflow.source.relative_to(REPO_ROOT)} -> {copy.relative_to(REPO_ROOT)}")
    for path in orphans:
        print(f"WARNING: stale copy .github/workflows/{path.name} has no matching area workflow")
    for workflow, issues in scoping_issues:
        for issue in issues:
            print(f"WARNING: {workflow.source.relative_to(REPO_ROOT)}: {issue}")
    if not out_of_date and not orphans and not scoping_issues:
        print(f"Up to date: {len(workflows)} workflow(s) copied and scoped correctly.")
    return 0


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        prog="build_ci",
        description="Copy areas/**/.github/workflows/* into .github/workflows/",
    )
    parser.add_argument(
        "--validate",
        action="store_true",
        help="Check without modifying the filesystem; exit non-zero on any "
        "missing/drifted copy or improperly scoped `on:` trigger.",
    )
    args = parser.parse_args(argv)
    return run(validate=args.validate)


if __name__ == "__main__":
    raise SystemExit(main())

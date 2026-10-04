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
import json
import os
import re
import shutil
import sys
import tomllib
from dataclasses import dataclass, field
from pathlib import Path

import yaml

MAX_DEPTH = 3  # max path segments from areas/ through and including .github/
WORKFLOW_EXTENSIONS = (".yml", ".yaml")
PATH_SCOPED_EVENTS = ("push", "pull_request", "pull_request_target")
MANAGED_COPY_PATTERN = re.compile(r"-areas-[^/]+\.ya?ml$")
# Root files every member of the shared uv / npm workspace builds from. A change
# to one of them (a dependency bump, a new interpreter) must re-run that
# language's project workflows.
PYTHON_ROOT_FILES = ("pyproject.toml", "uv.lock", ".python-version")
NODE_ROOT_FILES = ("package.json", "package-lock.json", ".nvmrc")


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
            # A git submodule (e.g. areas/apis/rocketcan) is another repository
            # with its own CI. CI checkouts don't fetch submodules, so copying
            # its workflows here would show up as drift there.
            if (Path(entry.path) / ".git").exists():
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


@dataclass(frozen=True)
class WorkspaceMember:
    """A project in the root uv or npm workspace."""

    path: str  # repo-relative, e.g. "areas/sw_libs/parsley"
    root_files: tuple[str, ...]  # shared root files it builds from
    deps: frozenset[str] = field(default_factory=frozenset)  # names of in-repo deps


def _expand_members(patterns: list[str]) -> list[Path]:
    dirs: list[Path] = []
    for pattern in patterns:
        dirs.extend(sorted(p for p in REPO_ROOT.glob(pattern) if p.is_dir()))
    return dirs


def load_workspace_members() -> dict[str, WorkspaceMember]:
    """Every root-workspace project, keyed by package name, with the names of
    the other workspace projects it depends on (read from the manifests:
    `{ workspace = true }` uv sources, and npm dependencies naming a workspace
    package)."""
    members: dict[str, WorkspaceMember] = {}

    root_pyproject = REPO_ROOT / "pyproject.toml"
    if root_pyproject.is_file():
        root = tomllib.loads(root_pyproject.read_text())
        patterns = root.get("tool", {}).get("uv", {}).get("workspace", {}).get("members", [])
        for member_dir in _expand_members(patterns):
            manifest = member_dir / "pyproject.toml"
            if not manifest.is_file():
                continue
            data = tomllib.loads(manifest.read_text())
            sources = data.get("tool", {}).get("uv", {}).get("sources", {})
            deps = {
                name
                for name, source in sources.items()
                if isinstance(source, dict) and source.get("workspace")
            }
            members[data["project"]["name"]] = WorkspaceMember(
                member_dir.relative_to(REPO_ROOT).as_posix(), PYTHON_ROOT_FILES, frozenset(deps)
            )

    root_package = REPO_ROOT / "package.json"
    if root_package.is_file():
        root = json.loads(root_package.read_text())
        packages: dict[str, tuple[Path, set[str]]] = {}
        for member_dir in _expand_members(root.get("workspaces", [])):
            manifest = member_dir / "package.json"
            if not manifest.is_file():
                continue
            data = json.loads(manifest.read_text())
            names: set[str] = set()
            for section in ("dependencies", "devDependencies", "peerDependencies"):
                names.update(data.get(section, {}))
            packages[data["name"]] = (member_dir, names)
        for name, (member_dir, names) in packages.items():
            members[name] = WorkspaceMember(
                member_dir.relative_to(REPO_ROOT).as_posix(),
                NODE_ROOT_FILES,
                frozenset(names & packages.keys()),
            )
    return members


@dataclass(frozen=True)
class TriggerRequirements:
    """What a workflow's `paths:` must cover besides its own area."""

    dep_areas: frozenset[str] = frozenset()  # e.g. "areas/sw_libs/parsley"
    root_files: frozenset[str] = frozenset()  # e.g. "uv.lock"


def _area_of(path: Path) -> str | None:
    """`areas/<kind>/<project>` containing `path`, if it is inside areas/."""
    try:
        parts = path.resolve().relative_to(REPO_ROOT).parts
    except ValueError:
        return None
    return "/".join(parts[:3]) if len(parts) >= 3 and parts[0] == "areas" else None


def load_path_dependencies() -> dict[str, frozenset[str]]:
    """Area -> other areas it depends on through uv `path` sources.

    Python projects that keep their own lockfile and interpreter (outside the
    root workspace) consume in-repo libraries this way, e.g. omnibus has
    `parsley = { path = "../../sw_libs/parsley" }`. Every pyproject.toml under
    areas/ counts, including nested sub-projects of a project's own workspace.
    """
    edges: dict[str, set[str]] = {}
    for dirpath, dirnames, filenames in os.walk(AREAS_ROOT):
        here = Path(dirpath)
        # Skip environments, dependencies, hidden dirs and git submodules.
        dirnames[:] = [
            d
            for d in dirnames
            if not d.startswith(".")
            and d != "node_modules"
            and not (here / d / ".git").exists()
        ]
        if "pyproject.toml" not in filenames:
            continue
        source_area = _area_of(here)
        try:
            data = tomllib.loads((here / "pyproject.toml").read_text())
        except (OSError, tomllib.TOMLDecodeError):
            continue
        sources = data.get("tool", {}).get("uv", {}).get("sources", {})
        for source in sources.values():
            if not isinstance(source, dict) or "path" not in source:
                continue
            target_area = _area_of(here / source["path"])
            if source_area and target_area and target_area != source_area:
                edges.setdefault(source_area, set()).add(target_area)
    return {area: frozenset(deps) for area, deps in edges.items()}


def trigger_requirements(
    workflow: AreaWorkflow,
    members: dict[str, WorkspaceMember],
    path_deps: dict[str, frozenset[str]] | None = None,
) -> TriggerRequirements:
    """In-repo dependencies (transitively) and shared root files of the
    projects inside this workflow's area: root-workspace dependencies plus
    uv `path` sources into other areas (`load_path_dependencies`)."""
    if path_deps is None:
        path_deps = load_path_dependencies()
    own = [
        name
        for name, m in members.items()
        if m.path == workflow.area_path or m.path.startswith(f"{workflow.area_path}/")
    ]
    root_files = {f for name in own for f in members[name].root_files}
    seen: set[str] = set(own)
    pending = [dep for name in own for dep in members[name].deps]
    while pending:
        name = pending.pop()
        if name in seen or name not in members:
            continue
        seen.add(name)
        pending.extend(members[name].deps)
    dep_areas = {
        members[name].path
        for name in seen - set(own)
        if not members[name].path.startswith(f"{workflow.area_path}/")
    }
    # Follow path dependencies transitively, from this area and from every
    # workspace dependency found above.
    pending_areas = [*dep_areas, *path_deps.get(workflow.area_path, ())]
    all_dep_areas: set[str] = set()
    while pending_areas:
        area = pending_areas.pop()
        if area in all_dep_areas or area == workflow.area_path:
            continue
        all_dep_areas.add(area)
        pending_areas.extend(path_deps.get(area, ()))
    return TriggerRequirements(frozenset(all_dep_areas), frozenset(root_files))


def _normalize(pattern: str) -> str:
    return pattern.removeprefix("./")


def check_scoping(
    workflow: AreaWorkflow, requirements: TriggerRequirements | None = None
) -> list[str]:
    """Return a list of human-readable warnings if `on:` isn't scoped by a
    `paths:` filter to this workflow's own area, or if that filter misses the
    in-repo dependencies or shared root files the area builds from (so a change
    to them would not re-test it). Paths outside those are rejected."""
    if requirements is None:
        requirements = trigger_requirements(workflow, load_workspace_members())
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
        allowed_prefixes = (expected_prefix, *(f"{a}/" for a in requirements.dep_areas))
        for pattern in paths:
            # A `!` pattern only narrows the filter, so it is checked like the
            # path it excludes.
            normalized = _normalize(pattern.removeprefix("!"))
            if normalized in requirements.root_files:
                continue
            if not normalized.startswith(allowed_prefixes):
                warnings.append(
                    f"`on.{event}.paths` entry {pattern!r} is not scoped to {expected_prefix}"
                    + (" or its dependencies" if requirements.dep_areas else "")
                )
        positive = [_normalize(p) for p in paths if not p.startswith("!")]
        for area in sorted(requirements.dep_areas):
            if not any(p.startswith(f"{area}/") for p in positive):
                warnings.append(
                    f"`on.{event}.paths` is missing '{area}/**': {workflow.area_path} depends "
                    "on it, so changes there must re-run this workflow"
                )
        for root_file in sorted(requirements.root_files):
            if root_file not in positive:
                warnings.append(
                    f"`on.{event}.paths` is missing '{root_file}': {workflow.area_path} "
                    "builds from this shared root file"
                )
    return warnings


def run(validate: bool) -> int:
    workflows = find_area_workflows()
    out_of_date: list[tuple[AreaWorkflow, str]] = []
    scoping_issues: list[tuple[AreaWorkflow, list[str]]] = []

    members = load_workspace_members()
    path_deps = load_path_dependencies()
    for workflow in workflows:
        status = copy_status(workflow)
        if status != "ok":
            out_of_date.append((workflow, status))
        issues = check_scoping(workflow, trigger_requirements(workflow, members, path_deps))
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

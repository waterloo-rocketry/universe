import os
import shutil
import subprocess
import tempfile
from pathlib import Path

import pytest

from gen_parsley.gen_ts.generator import Generator
from gen_parsley.parse import load_rocketcan

PARSLEY = Path(__file__).resolve().parents[3] / "sw_libs" / "parsley-ts"


def test_generated_typescript_typechecks():
    rocketcan = os.environ.get("GEN_PARSLEY_ROCKETCAN")
    if not rocketcan:
        pytest.skip("set GEN_PARSLEY_ROCKETCAN to type-check the parsley-ts package")
    parsley = PARSLEY
    tsc = parsley / "node_modules" / "typescript" / "bin" / "tsc"
    node = shutil.which("node")
    assert node and tsc.is_file(), "install parsley-ts dependencies and Node.js to type-check generated files"
    yaml = Path(rocketcan).resolve()
    assert yaml.is_file(), f"RocketCAN file not found: {yaml}"

    with tempfile.TemporaryDirectory(dir=parsley) as tmp:
        root = Path(tmp)
        src = root / "src"
        shutil.copytree(parsley / "src", src)
        shutil.copy(parsley / "package.json", root)
        shutil.copy(parsley / "tsconfig.json", root)
        Generator(src).generate(load_rocketcan(yaml))
        result = subprocess.run(
            [node, str(tsc), "--noEmit", "-p", str(root)],
            cwd=root, capture_output=True, text=True, encoding="utf-8", errors="replace",
        )
        assert result.returncode == 0, result.stdout + result.stderr


def test_generated_typescript_with_parsley_suite():
    rocketcan = os.environ.get("GEN_PARSLEY_ROCKETCAN")
    if not rocketcan:
        pytest.skip("set GEN_PARSLEY_ROCKETCAN to run the parsley-ts integration suite")

    node = shutil.which("node")
    vitest = PARSLEY / "node_modules" / "vitest" / "vitest.mjs"
    assert node and vitest.is_file(), (
        "install Node.js and parsley-ts dependencies to run the integration suite"
    )
    yaml = Path(rocketcan).resolve()
    assert yaml.is_file(), f"RocketCAN file not found: {yaml}"

    with tempfile.TemporaryDirectory(dir=PARSLEY) as tmp:
        root = Path(tmp)
        for directory in ("src", "tests"):
            shutil.copytree(PARSLEY / directory, root / directory)
        for name in ("package.json", "tsconfig.json", "vitest.config.json"):
            shutil.copy(PARSLEY / name, root / name)
        Generator(root / "src").generate(load_rocketcan(yaml))

        result = subprocess.run(
            [node, str(vitest), "run"], cwd=root, capture_output=True, text=True,
            encoding="utf-8", errors="replace",
        )
        assert result.returncode == 0, result.stdout + result.stderr

import argparse
import runpy
import sys

import pytest

from gen_parsley import cli
from .test_parse import ROCKETCAN_YAML


def test_cli_paths_and_targets(tmp_path):
    file = tmp_path / 'schema.yaml'
    file.write_text(ROCKETCAN_YAML, encoding='utf-8')
    assert cli.file_path(str(file)) == file
    assert cli.folder_path(str(tmp_path)) == tmp_path
    with pytest.raises(argparse.ArgumentTypeError):
        cli.file_path(str(tmp_path))
    with pytest.raises(argparse.ArgumentTypeError):
        cli.folder_path(str(file))
    assert 'ts' in cli.available_targets()


def test_cli_generates_files(tmp_path, monkeypatch, capsys):
    schema = tmp_path / 'schema.yaml'
    schema.write_text(ROCKETCAN_YAML, encoding='utf-8')
    monkeypatch.setattr(sys, 'argv', ['gen-parsley', str(schema), '--target', 'ts', '--out', str(tmp_path)])
    cli.main()
    assert 'export const MESSAGE_SCHEMAS' in (tmp_path / 'messageDefs.ts').read_text(encoding='utf-8')
    assert str(tmp_path) in capsys.readouterr().out


def test_cli_default_output_and_module_entrypoint(tmp_path, monkeypatch):
    schema = tmp_path / 'schema.yaml'
    schema.write_text(ROCKETCAN_YAML, encoding='utf-8')
    # The CLI derives its default output relative to its own module file.
    fake = tmp_path / 'project' / 'src' / 'gen_parsley' / 'cli.py'
    monkeypatch.setattr(cli, '__file__', str(fake))
    monkeypatch.setattr(cli, 'available_targets', lambda: ['ts'])
    monkeypatch.setattr(sys, 'argv', ['gen-parsley', str(schema), '-t', 'ts'])
    cli.main()
    assert (tmp_path / 'project' / 'out' / 'ts' / 'messageTypes.ts').is_file()
    monkeypatch.setattr(sys, 'argv', ['gen-parsley', str(schema), '-t', 'ts', '-o', str(tmp_path)])
    with pytest.warns(RuntimeWarning, match='found in sys.modules'):
        runpy.run_module('gen_parsley.cli', run_name='__main__')
    assert (tmp_path / 'messageDefs.ts').is_file()



"""Shared helpers for building format files in tests."""

import copy

import yaml

from sd_card_tool.config import default_format_text, parse_config


def default_raw() -> dict:
    """The built-in format file as a dict, safe to modify."""
    return copy.deepcopy(yaml.safe_load(default_format_text()))


def config_with(change):
    """Build a config after `change(raw)` edits the default format dict."""
    raw = default_raw()
    change(raw)
    return parse_config(raw)

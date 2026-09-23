try:
    from .build_ci import main  # run as `python -m tools.build_ci` / `-m build_ci`
except ImportError:
    from build_ci import main  # run as `python tools/build_ci` / `uv run tools/build_ci`

if __name__ == "__main__":
    raise SystemExit(main())

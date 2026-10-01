try:
    from .import_repo import main  # run as `python -m tools.import_repo`
except ImportError:
    from import_repo import main  # run as `uv run tools/import_repo`

if __name__ == "__main__":
    raise SystemExit(main())

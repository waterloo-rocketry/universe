import argparse
import importlib
import pkgutil
from pathlib import Path

from gen_parsley.parse import load_rocketcan


def file_path(val):
    path = Path(val)
    if not path.is_file():
        raise argparse.ArgumentTypeError(f"'{path}' is not a valid file.")
    return path


def folder_path(val):
    path = Path(val)
    if not path.is_dir():
        raise argparse.ArgumentTypeError(f"'{path}' is not a valid directory.")
    return path


def available_targets() -> list[str]:
    gen_parsley_root = Path(__file__).resolve().parent
    return sorted(
        m.name.removeprefix("gen_")
        for m in pkgutil.iter_modules([str(gen_parsley_root)])
        if m.name.startswith("gen_")
    )


def main():
    parser = argparse.ArgumentParser(
        prog="Generative Parsley",
        description="Generate Parsley configs from RocketCAN!",
    )

    targets = available_targets()
    parser.add_argument("path", type=file_path, help="Path to rocketcan.yaml schema")
    parser.add_argument(
        "-t",
        "--target",
        choices=targets,
        required=True,
        help="Target language to generate Parsley configs to",
    )
    parser.add_argument(
        "-o",
        "--out",
        type=folder_path,
        help="Output folder for generated files",
    )

    args = parser.parse_args()

    data = load_rocketcan(args.path)

    out_dir = args.out
    if out_dir is None:
        out_dir = Path(__file__).resolve().parent.parent.parent / "out" / args.target

    gen_target = importlib.import_module(f".gen_{args.target}", package=__package__)
    generator = gen_target.Generator(out_dir)
    generator.generate(data)
    generator.validate()

    print(f"configs written to {args.out}")


if __name__ == "__main__":
    main()

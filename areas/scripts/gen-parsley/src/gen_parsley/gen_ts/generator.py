from pathlib import Path

from gen_parsley.gen_ts import message_defs, message_types
from gen_parsley.models import RocketCAN


class Generator:
    def __init__(self, out_dir: Path):
        self.out_dir = out_dir

    def generate(self, data: RocketCAN):
        self.out_dir.mkdir(parents=True, exist_ok=True)
        files = {
            "messageTypes.ts": message_types.render(data),
            "messageDefs.ts": message_defs.render(data),
        }
        for name, text in files.items():
            (self.out_dir / name).write_text(text, encoding="utf-8", newline="\n")

    def validate(self): ...

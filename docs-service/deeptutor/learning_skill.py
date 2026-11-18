"""Bundled learn v7 skill and its reference files.

The skill is shipped with the docs service so the tutor can follow a stable
teaching workflow even when the app is running as a portable exe.
"""
import sys
from pathlib import Path

REFERENCE_NAMES = (
    "mission",
    "modes",
    "lesson-format",
    "figure-spec",
    "quiz-rules",
    "review-plan",
)


def _skill_root() -> Path:
    if getattr(sys, "frozen", False):
        base = Path(getattr(sys, "_MEIPASS", Path(sys.executable).parent))
        return base / "deeptutor" / "skills" / "learn"
    return Path(__file__).resolve().parent / "skills" / "learn"


def _read(name: str) -> str:
    path = _skill_root() / name
    try:
        return path.read_text(encoding="utf-8")
    except Exception:
        return ""


LEARN_SKILL_TEXT = _read("SKILL.md")


def read_reference(name: str) -> str:
    key = (name or "").strip().lower()
    if key.endswith(".md"):
        key = key[:-3]
    if key not in REFERENCE_NAMES:
        return "可读取的参考文件：" + "、".join(REFERENCE_NAMES)
    text = _read("references/" + key + ".md")
    if not text:
        text = _read(key + ".md")
    if not text:
        return "参考文件未随程序打包：" + key + ".md"
    return text

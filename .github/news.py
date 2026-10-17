"""The release notes of Dante, kept by hand in docs/novita.md (Italian) and docs/whats-new.md
(English).

Each change adds a line under the first heading, "## Prossima versione" / "## Next version",
in the pull request that makes it. When the Builds workflow publishes a version, it moves
those lines under a heading of their own, "## 0.1.N · date", and puts them on the release
page and in latest.json, where Dante's update banner reads them.

Usage:
  news.py pending <docs folder>
      The lines waiting for the next version, as JSON: {"it": [...], "en": [...]}.
  news.py stamp <docs folder> <version> <pending JSON>
      Moves those lines (only those: later ones stay waiting) under the version's heading.
  news.py history <docs folder> <version>
      Every version up to this one with its lines, newest first, as JSON:
      {"it": [{"version": "0.1.N", "notes": [...]}], "en": [...]}.
  news.py body <pending JSON>
      The notes as Markdown, Italian then English, for the release page.
"""

import json
import re
import sys
from datetime import date
from pathlib import Path

FILES = {"it": "novita.md", "en": "whats-new.md"}
PENDING = {"it": "## Prossima versione", "en": "## Next version"}
MONTHS = {
    "it": ["gennaio", "febbraio", "marzo", "aprile", "maggio", "giugno", "luglio", "agosto", "settembre", "ottobre", "novembre", "dicembre"],
    "en": ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
}
VERSION = re.compile(r"^## (\d+\.\d+\.\d+)")


def day(language: str, d: date) -> str:
    month = MONTHS[language][d.month - 1]
    return f"{d.day} {month} {d.year}" if language == "it" else f"{month} {d.day}, {d.year}"


def sections(text: str) -> list[tuple[str, list[str]]]:
    """The headings of level 2 with the lines under them; the text before the first is ("", ...)."""
    out: list[tuple[str, list[str]]] = [("", [])]
    for line in text.splitlines():
        if line.startswith("## "):
            out.append((line.strip(), []))
        else:
            out[-1][1].append(line)
    return out


def items(lines: list[str]) -> list[str]:
    """The entries of a section: each "- " line with the indented lines that continue it."""
    out: list[str] = []
    for line in lines:
        if line.startswith("- "):
            out.append(line[2:].strip())
        elif out and line.startswith("  ") and line.strip():
            out[-1] += " " + line.strip()
    return out


def read(folder: Path, language: str) -> list[tuple[str, list[str]]]:
    return sections((folder / FILES[language]).read_text(encoding="utf-8"))


def pending(folder: Path) -> dict[str, list[str]]:
    result = {}
    for language in FILES:
        found = [lines for heading, lines in read(folder, language) if heading == PENDING[language]]
        result[language] = items(found[0]) if found else []
    return result


def stamp(folder: Path, version: str, notes: dict[str, list[str]]) -> None:
    for language, file in FILES.items():
        moving = notes.get(language, [])
        if not moving:
            continue
        parts = read(folder, language)
        out: list[str] = []
        for heading, lines in parts:
            if heading:
                out.append(heading)
            if heading != PENDING[language]:
                out.extend(lines)
                continue
            # The pending lines that are not being published stay where they are.
            kept: list[str] = []
            skip = False
            for line in lines:
                if line.startswith("- "):
                    skip = line[2:].strip() in moving
                elif not (line.startswith("  ") and line.strip()):
                    skip = False
                if not skip:
                    kept.append(line)
            while kept and not kept[-1].strip():
                kept.pop()
            out.extend(kept)
            out.extend(["", f"## {version} · {day(language, date.today())}", ""])
            out.extend(f"- {item}" for item in moving)
            out.append("")
        (folder / file).write_text("\n".join(out).rstrip("\n") + "\n", encoding="utf-8")


def key(version: str) -> tuple[int, ...]:
    return tuple(int(n) for n in version.split("."))


def history(folder: Path, version: str) -> dict[str, list[dict]]:
    result = {}
    for language in FILES:
        found = []
        for heading, lines in read(folder, language):
            m = VERSION.match(heading)
            if m and key(m.group(1)) <= key(version) and items(lines):
                found.append({"version": m.group(1), "notes": items(lines)})
        result[language] = sorted(found, key=lambda v: key(v["version"]), reverse=True)
    return result


def body(notes: dict[str, list[str]]) -> str:
    out = []
    for language, title in (("it", "Novità"), ("en", "What's new")):
        if notes.get(language):
            out.append(f"### {title}\n\n" + "\n".join(f"- {item}" for item in notes[language]))
    return "\n\n".join(out)


if __name__ == "__main__":
    command, *args = sys.argv[1:]
    if command == "pending":
        print(json.dumps(pending(Path(args[0])), ensure_ascii=False))
    elif command == "stamp":
        stamp(Path(args[0]), args[1], json.loads(args[2]))
    elif command == "history":
        print(json.dumps(history(Path(args[0]), args[1]), ensure_ascii=False))
    elif command == "body":
        print(body(json.loads(args[0])))
    else:
        sys.exit(f"Unknown command: {command}")

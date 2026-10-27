"""The release notes of Dante, kept by hand in docs/novita.md (Italian) and docs/whats-new.md
(English).

Each change adds a line under the first heading, "## Prossima versione" / "## Next version",
in the pull request that makes it, in one of three groups: "### Nuovo" / "### New" (a new
feature), "### Cambiato" / "### Changed" (something that works differently), "### Corretto" /
"### Fixed" (a bug fixed). When the Release workflow publishes a version, it moves those lines
under a heading of their own, "## 1.2.0 · date", and the Builds workflow puts them on the
release page and in latest.json, where Dante's update bar reads them.

A stable minor version (1.2.0) also gathers the lines of its betas (1.2.0-beta.1, -beta.2...),
so whoever goes from 1.1 to 1.2 reads everything in one place; the beta sections stay in the
files as they were. Versions written before 1.0 have no groups.

Usage:
  news.py release <docs folder> <version>
      Writes the section of the version from the pending lines (and, for x.y.0, its betas).
      Fails when the section would be empty in both languages. A section already written
      by hand for the version is left as it is.
  news.py history <docs folder> <version>
      Every version up to this one with its lines, newest first, as JSON:
      {"it": [{"version": "1.2.0", "notes": [...]}], "en": [...]}. For a stable version the
      betas are left out: its own section already has their lines.
  news.py body <docs folder> <version>
      The notes of the version as Markdown, Italian then English, for the release page.
"""

import json
import re
import sys
from datetime import date
from pathlib import Path

FILES = {"it": "novita.md", "en": "whats-new.md"}
PENDING = {"it": "## Prossima versione", "en": "## Next version"}
GROUPS = {
    "it": {"new": "Nuovo", "changed": "Cambiato", "fixed": "Corretto"},
    "en": {"new": "New", "changed": "Changed", "fixed": "Fixed"},
}
MONTHS = {
    "it": ["gennaio", "febbraio", "marzo", "aprile", "maggio", "giugno", "luglio", "agosto", "settembre", "ottobre", "novembre", "dicembre"],
    "en": ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
}
VERSION = re.compile(r"^## (\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?)(?:\s|$)")
SEMVER = re.compile(r"^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?$")


def day(language: str, d: date) -> str:
    month = MONTHS[language][d.month - 1]
    return f"{d.day} {month} {d.year}" if language == "it" else f"{month} {d.day}, {d.year}"


def key(version: str) -> tuple:
    """Sorts versions as semver does: a beta comes before its version."""
    m = SEMVER.match(version)
    if not m:
        raise ValueError(f"not a version: {version}")
    core = tuple(int(n) for n in m.group(1, 2, 3))
    pre = m.group(4)
    if not pre:
        return core + (1, ())
    parts = tuple((0, int(p), "") if p.isdigit() else (1, 0, p) for p in pre.split("."))
    return core + (0, parts)


def prerelease(version: str) -> bool:
    return "-" in version


def sections(text: str) -> list[tuple[str, list[str]]]:
    """The headings of level 2 with the lines under them; the text before the first is ("", ...)."""
    out: list[tuple[str, list[str]]] = [("", [])]
    for line in text.splitlines():
        if line.startswith("## "):
            out.append((line.strip(), []))
        else:
            out[-1][1].append(line)
    return out


def grouped(language: str, lines: list[str]) -> list[tuple[str, str]]:
    """The entries of a section as (group, text): each "- " line with the indented lines that
    continue it, under the "### " heading it follows ("" before any)."""
    names = {v.lower(): k for k, v in GROUPS[language].items()}
    out: list[tuple[str, str]] = []
    group = ""
    for line in lines:
        if line.startswith("### "):
            group = names.get(line[4:].strip().lower(), "")
        elif line.startswith("- "):
            out.append((group, line[2:].strip()))
        elif out and line.startswith("  ") and line.strip():
            out[-1] = (out[-1][0], out[-1][1] + " " + line.strip())
    return out


def items(language: str, lines: list[str]) -> list[str]:
    """The entries in the order they are read: those without a group, new, changed, fixed."""
    order = {"": 0, "new": 1, "changed": 2, "fixed": 3}
    return [text for _, text in sorted(grouped(language, lines), key=lambda e: order[e[0]])]


def write(language: str, entries: list[tuple[str, str]]) -> list[str]:
    """Entries as the lines of a section, under the headings of their groups."""
    out: list[str] = []
    for group in ("", "new", "changed", "fixed"):
        lines = [f"- {text}" for g, text in entries if g == group]
        if not lines:
            continue
        if group:
            out.extend([f"### {GROUPS[language][group]}", ""])
        out.extend(lines + [""])
    return out


def read(folder: Path, language: str) -> list[tuple[str, list[str]]]:
    return sections((folder / FILES[language]).read_text(encoding="utf-8"))


def version_of(heading: str) -> str | None:
    m = VERSION.match(heading)
    return m.group(1) if m else None


def release(folder: Path, version: str) -> bool:
    """Writes the section of `version`; False when there is nothing to say in either language."""
    key(version)
    m = SEMVER.match(version)
    minor = not prerelease(version) and m.group(3) == "0"
    found = False
    for language, file in FILES.items():
        parts = read(folder, language)
        if any(version_of(h) == version for h, _ in parts):
            found = found or any(items(language, lines) for h, lines in parts if version_of(h) == version)
            continue
        entries: list[tuple[str, str]] = []
        if minor:
            for heading, lines in parts:
                v = version_of(heading)
                if v and prerelease(v) and key(v)[:3] == key(version)[:3]:
                    entries.extend(e for e in grouped(language, lines) if e not in entries)
        pending = [lines for heading, lines in parts if heading == PENDING[language]]
        entries.extend(e for e in grouped(language, pending[0] if pending else []) if e not in entries)
        if not entries:
            continue
        found = True
        out: list[str] = []
        for heading, lines in parts:
            if heading:
                out.append(heading)
            if heading != PENDING[language]:
                out.extend(lines)
                continue
            # The pending section stays, empty, with the headings of its groups.
            out.extend(["", *[f"### {g}\n" for g in GROUPS[language].values()]])
            out.extend([f"## {version} · {day(language, date.today())}", ""])
            out.extend(write(language, entries))
        if not pending:
            # No pending heading: the new section goes before the first version.
            first = next((i for i, line in enumerate(out) if version_of(line)), len(out))
            out[first:first] = [f"## {version} · {day(language, date.today())}", "", *write(language, entries)]
        text = "\n".join(out)
        text = re.sub(r"\n{3,}", "\n\n", text).rstrip("\n") + "\n"
        (folder / file).write_text(text, encoding="utf-8")
    return found


def history(folder: Path, version: str) -> dict[str, list[dict]]:
    result = {}
    betas = prerelease(version)
    for language in FILES:
        found = []
        for heading, lines in read(folder, language):
            v = version_of(heading)
            if not v or key(v) > key(version) or (prerelease(v) and not betas):
                continue
            notes = items(language, lines)
            if notes:
                found.append({"version": v, "notes": notes})
        result[language] = sorted(found, key=lambda e: key(e["version"]), reverse=True)
    return result


def body(folder: Path, version: str) -> str:
    out = []
    for language, title in (("it", "Novità"), ("en", "What's new")):
        for heading, lines in read(folder, language):
            if version_of(heading) == version:
                text = "\n".join(write(language, grouped(language, lines))).strip()
                text = text.replace("### ", "#### ")
                if text:
                    out.append(f"### {title}\n\n{text}")
    return "\n\n".join(out)


if __name__ == "__main__":
    command, *args = sys.argv[1:]
    if command == "release":
        if not release(Path(args[0]), args[1]):
            sys.exit(f"Nothing to release for {args[1]}: no lines under Prossima versione / Next version.")
    elif command == "history":
        print(json.dumps(history(Path(args[0]), args[1]), ensure_ascii=False))
    elif command == "body":
        print(body(Path(args[0]), args[1]))
    else:
        sys.exit(f"Unknown command: {command}")

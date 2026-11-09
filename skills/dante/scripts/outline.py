#!/usr/bin/env python3
"""Outline of a Dante project's manuscript, in reading order, with structural warnings.

    python3 outline.py <project folder>            outline and warnings
    python3 outline.py <project folder> --text     the whole book's text, in order
    python3 outline.py <project folder> --json     the outline as JSON

Lengths are given in words and in characters with spaces included, counted as Dante counts
them (no comments, revisions accepted, no Markdown marks). A gamebook (gamebook.enabled in
dante.yaml) is listed by paragraph number, with its references and their problems.

Only reads files. Uses PyYAML when installed; otherwise a small reader that understands the
frontmatter Dante writes (keys, quoted values, inline and block lists).
"""

import json
import os
import re
import sys

try:
    import yaml  # type: ignore
except ImportError:  # pragma: no cover
    yaml = None

SKIPPED = {"node_modules", "export"}  # and every hidden folder (.dante, .trash, .git…)
PREFIX = re.compile(r"^(\d+)\s+(.*)$")
FENCE = re.compile(r"^---[ \t]*\r?\n")
CLOSE = re.compile(r"^---[ \t]*(\r?\n|$)", re.M)
LINK = re.compile(r"!?\[\[([^\[\]|#^\n]+)(?:[#^][^\[\]|\n]*)?(?:\\?\|[^\[\]\n]*)?\]\]")
CONFLICT = re.compile(
    r"( \([^()]+?['’]s conflicted copy[^()]*\)| \(copia in conflitto di [^()]+\)"
    r"| \((?:[^()]*?\b)?(?:conflict|conflicted|conflitto|conflicto|conflit|konflikt)\b[^()]*\)"
    r"| ?\[(?:conflict|conflitto)\]|\.sync-conflict-\d{8}-\d{6}(?:-[A-Z0-9]+)?| \(\d\))$",
    re.I,
)
WORD = re.compile(r"[^\W_]+(?:['’\-][^\W_]+)*")
REFERENCE = re.compile(r"(!?)\[\[([^\[\]|#]+)(?:#[^\[\]|]*)?(?:\\?\|([^\[\]]*))?\]\]")
BOX = re.compile(r'^::: \{custom-style="box"\}[ \t]*\n[\s\S]*?\n:::[ \t]*$', re.M)
DEFAULT_MANUSCRIPT = {"en": "Manuscript", "it": "Manoscritto", "es": "Manuscrito", "fr": "Manuscrit"}
CONTAINER_KINDS = {"part", "chapter", "prologue", "epilogue"}


def unquote(value):
    value = value.strip()
    if len(value) >= 2 and value[0] == value[-1] and value[0] in "'\"":
        return value[1:-1]
    return value


def scalar(value):
    value = value.strip()
    if value in ("true", "false"):
        return value == "true"
    if value.startswith("[") and value.endswith("]") and not value.startswith("[["):
        return [unquote(v) for v in value[1:-1].split(",") if v.strip()]
    return unquote(value)


def mini_yaml(text):
    """Top-level keys, one level of nested mappings, and lists. Enough for these files."""
    out, parent, last = {}, None, None
    for line in text.splitlines():
        if not line.strip() or line.lstrip().startswith("#"):
            continue
        indent = len(line) - len(line.lstrip())
        stripped = line.strip()
        if stripped == "-" or stripped.startswith("- "):
            if indent > 0 and parent is not None and last is not None and last != parent:
                holder, key = out[parent], last
            elif last is not None:
                holder, key = out, last
            else:
                continue
            if not isinstance(holder.get(key), list):
                holder[key] = []
            holder[key].append(unquote(stripped[2:]))
            continue
        if ":" not in stripped:
            continue
        key, _, value = stripped.partition(":")
        key = unquote(key)
        if indent == 0:
            last = key
            parent = None if value.strip() else key
            out[key] = scalar(value) if value.strip() else {}
        elif parent is not None and isinstance(out.get(parent), dict):
            out[parent][key] = scalar(value) if value.strip() else []
            last = key
    return out


def load_yaml(text):
    if yaml is not None:
        try:
            value = yaml.safe_load(text)
            return value if isinstance(value, dict) else {}, None
        except yaml.YAMLError as error:
            return {}, str(error).splitlines()[0]
    return mini_yaml(text), None


def split_note(text):
    if not FENCE.match(text):
        return None, text
    rest = text[text.index("\n") + 1:]
    match = CLOSE.search(rest)
    if not match:
        return None, text
    return rest[: match.start()], rest[match.end():]


def plain_text(body):
    """The text as Dante counts it: revisions accepted, no comments, marks, tags or embeds."""
    body = re.sub(r"\{>>[\s\S]*?<<\}", "", body)
    body = re.sub(r"\{\+\+([\s\S]*?)\+\+\}", r"\1", body)
    body = re.sub(r"\{--[\s\S]*?--\}", "", body)
    body = re.sub(r"\{~~[\s\S]*?~>([\s\S]*?)~~\}", r"\1", body)
    body = re.sub(r"\{==([\s\S]*?)==\}", r"\1", body)
    body = re.sub(r"<!--[\s\S]*?-->", "", body)
    body = re.sub(r"&(?:nbsp|#160|#x0*a0);", " ", body, flags=re.I)
    body = re.sub(r"</?[a-zA-Z][^<>\n]*>", "", body)
    body = re.sub(r"!\[\[[^\]]*\]\]|!\[[^\]\n]*\]\([^)\n]*\)", "", body)
    body = re.sub(r"^[ \t]*\|?[ \t]*:?-+:?[ \t]*(\|[ \t]*:?-+:?[ \t]*)+\|?[ \t]*$", "", body, flags=re.M)
    body = re.sub(r"\[\[([^\]|]+)\\?\|([^\]]+)\]\]", r"\2", body)
    body = re.sub(r"\[\[([^\]]+)\]\]", r"\1", body)
    body = re.sub(r"\[([^\]]*)\]\([^)]*\)", r"\1", body)
    body = re.sub(r"\\?\|", lambda m: " " if m.group(0) == "|" else m.group(0), body)
    body = re.sub(r"^\s{0,3}(#{1,6}|>|[-*+]|\d+[.)])\s+", "", body, flags=re.M)
    body = re.sub(r"[*_~`=]+", "", body)
    return re.sub(r"\s+", " ", body).strip()


def measure(body):
    text = plain_text(body)
    return {"words": len(WORD.findall(text)), "characters": len(text)}


def show_size(size):
    return f"{size['words']} words, {size['characters']} characters"


class Report:
    def __init__(self, root):
        self.root = root
        self.warnings = []
        self.notes = {}  # relative path -> (properties, body)

    def rel(self, path):
        return os.path.relpath(path, self.root).replace(os.sep, "/")

    def read(self, path):
        rel = self.rel(path)
        if rel not in self.notes:
            with open(path, encoding="utf-8") as handle:
                text = handle.read()
            front, body = split_note(text)
            props, error = load_yaml(front) if front else ({}, None)
            if error:
                self.warnings.append(f"{rel}: frontmatter is not valid YAML ({error})")
            self.notes[rel] = (props or {}, body)
        return self.notes[rel]


def own_title(props):
    value = props.get("title")
    if isinstance(value, (int, float)) and not isinstance(value, bool):
        return str(value)
    return value.strip() if isinstance(value, str) and value.strip() else None


def parse_name(name):
    match = PREFIX.match(name)
    if not match or not match.group(2).strip():
        return None, name
    return int(match.group(1)), match.group(2)


def is_conflict(directory, name):
    stem, ext = os.path.splitext(name)
    match = CONFLICT.search(stem)
    if not match or match.start() == 0:
        return False
    return os.path.exists(os.path.join(directory, stem[: match.start()].rstrip() + ext))


def load_children(report, directory, depth, parts):
    note = os.path.join(directory, os.path.basename(directory) + ".md") if depth > 0 else None
    entries = sorted(os.listdir(directory))
    children, seen = [], {}
    for name in entries:
        path = os.path.join(directory, name)
        if name.startswith((".", "_")) or path == note:
            continue
        if os.path.isfile(path) and is_conflict(directory, name):
            report.warnings.append(f"{report.rel(path)}: conflict copy made by a sync service, not a scene")
            continue
        if os.path.isdir(path):
            node = load_container(report, path, depth + 1, parts)
        elif name.lower().endswith(".md"):
            order, title = parse_name(name[:-3])
            props, body = report.read(path)
            node = {
                "kind": "scene",
                "path": report.rel(path),
                "order": order,
                "title": own_title(props) or title,
                "fileTitle": title,
                **measure(body),
                "children": [],
            }
        else:
            continue
        if node["order"] is None:
            report.warnings.append(f"{node['path']}: no number prefix, so it is placed last")
        else:
            seen.setdefault(node["order"], []).append(node["path"])
        children.append(node)
    for order, paths in seen.items():
        if len(paths) > 1:
            report.warnings.append(f"same number {order:03d} for siblings: " + ", ".join(paths))
    children.sort(key=lambda n: (n["order"] is None, n["order"] or 0, n["title"].lower()))
    return children


def load_container(report, directory, depth, parts):
    name = os.path.basename(directory)
    order, title = parse_name(name)
    kind = "part" if parts and depth == 1 else "chapter"
    note = os.path.join(directory, name + ".md")
    numbered, own = True, None
    if os.path.exists(note):
        props, body = report.read(note)
        numbered = props.get("numbered") is not False
        own = own_title(props)
        if props.get("kind") in CONTAINER_KINDS:
            kind = props["kind"]
        if body.strip():
            report.warnings.append(f"{report.rel(note)}: folder note has text, which Dante does not show as prose")
    node = {
        "kind": kind,
        "path": report.rel(directory),
        "order": order,
        "title": own or title,
        "fileTitle": title,
        "numbered": numbered,
        "children": load_children(report, directory, depth, parts),
    }
    for child in node["children"]:
        if child["kind"] == "scene" and child["fileTitle"].lower() == title.lower():
            report.warnings.append(f"{child['path']}: scene has the same title as its folder")
    if not any(c["kind"] == "scene" for c in flatten(node)):
        report.warnings.append(f"{node['path']}: {kind} without scenes")
    if kind == "chapter" and any(c["kind"] != "scene" for c in node["children"]):
        report.warnings.append(f"{node['path']}: chapter holds folders; check structure.parts in dante.yaml")
    return node


def flatten(node):
    out = [node]
    for child in node["children"]:
        out.extend(flatten(child))
    return out


def all_files(root):
    out = []
    for directory, dirs, files in os.walk(root):
        if os.path.abspath(directory) == os.path.abspath(root):
            dirs[:] = [d for d in dirs if d not in SKIPPED and not d.startswith(".")]
        for name in files:
            out.append(os.path.relpath(os.path.join(directory, name), root).replace(os.sep, "/"))
    return out


def check_links(report, files, skip_targets=frozenset()):
    keys = [(f[:-3] if f.lower().endswith(".md") else f).lower() for f in files]
    aliases = set()
    for f in files:
        if f.lower().endswith(".md"):
            props, _ = report.read(os.path.join(report.root, f))
            value = props.get("aliases", props.get("alias"))
            for alias in value if isinstance(value, list) else [value] if isinstance(value, str) else []:
                if isinstance(alias, str):
                    aliases.add(alias.strip().lower())
    missing = {}
    for f in files:
        if not f.lower().endswith(".md"):
            continue
        props, body = report.read(os.path.join(report.root, f))
        texts = [body] + [v for v in props.values() if isinstance(v, str)]
        texts += [i for v in props.values() if isinstance(v, list) for i in v if isinstance(i, str)]
        for text in texts:
            for match in LINK.finditer(text):
                target = match.group(1).strip()
                wanted = (target[:-3] if target.lower().endswith(".md") else target).lstrip("/").lower()
                if not wanted or wanted in aliases or wanted in skip_targets:
                    continue
                if any(k == wanted or k.endswith("/" + wanted) for k in keys):
                    continue
                missing.setdefault(target, set()).add(f)
    for target, sources in sorted(missing.items()):
        names = ", ".join(sorted(sources)[:3]) + (" …" if len(sources) > 3 else "")
        report.warnings.append(f"link to a missing note [[{target}]] in {names}")


def sum_size(nodes):
    return {
        "words": sum(n["words"] for n in nodes if n["kind"] == "scene"),
        "characters": sum(n["characters"] for n in nodes if n["kind"] == "scene"),
    }


def integer(value):
    if isinstance(value, bool):
        return None
    if isinstance(value, int):
        return value
    if isinstance(value, str) and re.fullmatch(r"\s*-?\d+\s*", value):
        return int(value)
    return None


def as_list(value):
    if value is None or value == "":
        return []
    return value if isinstance(value, list) else [value]


def gamebook(report, base, folder, settings):
    """Paragraphs by number, their references and the problems Dante would flag."""
    options = settings.get("gamebook") if isinstance(settings.get("gamebook"), dict) else {}
    start = integer(options.get("start")) or 1
    paragraphs, pages = [], []
    for directory, dirs, files in os.walk(base):
        dirs[:] = sorted(d for d in dirs if not d.startswith((".", "_")))
        for name in sorted(files):
            if name.startswith((".", "_")) or not name.lower().endswith(".md"):
                continue
            path = os.path.join(directory, name)
            if is_conflict(directory, name):
                report.warnings.append(f"{report.rel(path)}: conflict copy made by a sync service, not a paragraph")
                continue
            props, body = report.read(path)
            title = name[:-3]
            entry = {"kind": "scene", "path": report.rel(path), "title": title, **measure(BOX.sub("", body))}
            number = integer(props.get("numero"))
            if number is None:
                entry["position"] = "after" if str(props.get("posizione", "")).strip() == "dopo" else "before"
                pages.append(entry)
                continue
            entry.update({
                "number": number,
                "numberType": str(props.get("numero_tipo") or "libero"),
                "ending": props.get("finale") is True or str(props.get("finale")).lower() == "true",
                "links": [],
                "hidden": [],
            })
            for match in REFERENCE.finditer(body):
                if not match.group(1):
                    entry["links"].append((match.group(2).strip(), (match.group(3) or "").strip()))
            for value in as_list(props.get("rimandi nascosti")):
                for match in REFERENCE.finditer(str(value)):
                    entry["hidden"].append((match.group(2).strip(), (match.group(3) or "").strip()))
            entry["endingBox"] = "😢" in "".join(m.group(0)[:60] for m in BOX.finditer(body))
            paragraphs.append(entry)
    paragraphs.sort(key=lambda p: (p["number"], p["title"].lower()))
    by_title = {p["title"].lower(): p for p in paragraphs}
    by_number = {}
    for p in paragraphs:
        by_number.setdefault(p["number"], []).append(p)
    for number, same in sorted(by_number.items()):
        if len(same) > 1:
            report.warnings.append(f"number {number} used by " + ", ".join(p["title"] for p in same))
    incoming = {p["title"].lower(): [] for p in paragraphs}
    for p in paragraphs:
        p["to"] = []
        for target, label in p["links"] + p["hidden"]:
            other = by_title.get(target.lower())
            if other is None and integer(target) is not None and integer(target) in by_number:
                other = by_number[integer(target)][0]
                report.warnings.append(f"{p['number']} {p['title']}: [[{target}]] points at a number, write [[{other['title']}|{other['number']}]]")
            if other is None:
                continue  # a missing note is reported with the other broken links
            if label and integer(label) is not None and integer(label) != other["number"]:
                report.warnings.append(f"{p['number']} {p['title']}: [[{target}|{label}]] but {other['title']} is {other['number']}")
            elif not label:
                report.warnings.append(f"{p['number']} {p['title']}: [[{target}]] has no number label")
            p["to"].append(other["number"])
            incoming[other["title"].lower()].append(p["number"])
    for p in paragraphs:
        p["from"] = sorted(set(incoming[p["title"].lower()]))
        label = f"{p['number']} {p['title']}"
        if not p["from"] and p["number"] != start:
            report.warnings.append(f"{label}: orphan, no paragraph leads here")
        if not p["to"] and not p["ending"] and not p["endingBox"]:
            report.warnings.append(f"{label}: dead end, leads nowhere and is not an ending")
        if p["endingBox"] and not p["ending"]:
            report.warnings.append(f"{label}: ending box but no finale: true")
        if p["numberType"] not in ("libero", "fisso", "relativo"):
            report.warnings.append(f"{label}: numero_tipo {p['numberType']!r} is not libero, fisso or relativo")
    reached, todo = set(), [start]
    while todo:
        n = todo.pop()
        if n in reached or n not in by_number:
            continue
        reached.add(n)
        todo.extend(by_number[n][0]["to"])
    for p in paragraphs:
        if p["number"] not in reached and p["from"]:
            report.warnings.append(f"{p['number']} {p['title']}: unreachable from paragraph {start}")
    return paragraphs, pages


def main(argv):
    args = [a for a in argv if not a.startswith("--")]
    if not args:
        print(__doc__.strip())
        return 2
    root = os.path.abspath(args[0])
    settings_path = os.path.join(root, "dante.yaml")
    if not os.path.exists(settings_path):
        print(f"{root} is not a Dante project: dante.yaml is missing", file=sys.stderr)
        return 1
    with open(settings_path, encoding="utf-8") as handle:
        settings, error = load_yaml(handle.read())
    report = Report(root)
    if error:
        report.warnings.append(f"dante.yaml is not valid YAML ({error})")
    language = str(settings.get("language") or "en")
    folders = settings.get("folders") if isinstance(settings.get("folders"), dict) else {}
    manuscript = folders.get("manuscript") or DEFAULT_MANUSCRIPT.get(language[:2], "Manuscript")
    if not os.path.isdir(os.path.join(root, manuscript)) and os.path.isdir(os.path.join(root, "Manuscript")):
        manuscript = "Manuscript"
    goals = settings.get("goals") if isinstance(settings.get("goals"), dict) else {}
    unit = "characters" if goals.get("unit") == "characters" else "words"
    options = settings.get("gamebook") if isinstance(settings.get("gamebook"), dict) else {}
    base = os.path.join(root, manuscript)
    title = settings.get("title") or os.path.basename(root)
    if not os.path.isdir(base):
        report.warnings.append(f"manuscript folder {manuscript}/ is missing")

    if options.get("enabled") is True:
        paragraphs, pages = gamebook(report, base, manuscript, settings) if os.path.isdir(base) else ([], [])
        ordered = [p for p in pages if p["position"] == "before"] + paragraphs + [p for p in pages if p["position"] == "after"]
        if "--text" in argv:
            for p in ordered:
                print(f"\n# {p.get('number', p['title'])}\n")
                print(report.notes[p["path"]][1].strip())
            return 0
        check_links(report, all_files(root), skip_targets={p["title"].lower() for p in ordered})
        if "--json" in argv:
            print(json.dumps({"gamebook": True, "unit": unit, "paragraphs": ordered, "warnings": report.warnings}, ensure_ascii=False, indent=2))
            return 0
        print(f"{title} · gamebook in {manuscript}/ · {len(paragraphs)} paragraphs · start {integer(options.get('start')) or 1} · unit {unit}")
        for p in ordered:
            if "number" not in p:
                print(f"- [page, {p['position']}] {p['title']}  [{show_size(p)}]  {p['path']}")
                continue
            kind = {"fisso": " fixed", "relativo": " relative"}.get(p["numberType"], "")
            end = " ENDING" if p["ending"] else ""
            print(f"- {p['number']}{kind}{end}: {p['title']}  [{show_size(p)}]  from {p['from'] or '-'} to {p['to'] or '-'}")
        total = sum_size(ordered)
        print(f"\nTotal: {show_size(total)}")
        return finish(report)

    structure = settings.get("structure") if isinstance(settings.get("structure"), dict) else {}
    parts = structure.get("parts") is True
    tree = {"kind": "manuscript", "path": manuscript, "children": []}
    if os.path.isdir(base):
        tree["children"] = load_children(report, base, 0, parts)
    for node in flatten(tree):
        if node["kind"] == "manuscript" or (parts and node["kind"] == "part"):
            for child in node["children"]:
                if child["kind"] == "scene":
                    report.warnings.append(f"{child['path']}: scene outside chapters (exported with the previous chapter)")

    if "--text" in argv:
        for node in flatten(tree)[1:]:
            if node["kind"] == "scene":
                print(report.notes[node["path"]][1].strip() + "\n")
            else:
                print(f"\n# {node['title']}\n")
        return 0

    check_links(report, all_files(root))
    if "--json" in argv:
        print(json.dumps({"unit": unit, "manuscript": tree, "warnings": report.warnings}, ensure_ascii=False, indent=2))
        return 0

    def show(node, level):
        for child in node["children"]:
            mark = "" if child.get("numbered", True) else " (unnumbered)"
            if child["kind"] == "scene":
                print(f"{'  ' * level}- {child['title']}  [{show_size(child)}]  {child['path']}")
            else:
                size = sum_size(flatten(child))
                print(f"{'  ' * level}{child['kind'].upper()}{mark}: {child['title']}  [{show_size(size)}]  {child['path']}/")
                show(child, level + 1)

    print(f"{title} · manuscript in {manuscript}/ · parts {'on' if parts else 'off'} · goals in {unit}")
    show(tree, 0)
    total = sum_size(flatten(tree))
    print(f"\nTotal: {show_size(total)}")
    target = integer(goals.get("words"))
    if target:
        print(f"Goal: {target} {unit} ({round(100 * total[unit] / target)}%)")
    return finish(report)


def finish(report):
    if report.warnings:
        print("\nWarnings:")
        for warning in report.warnings:
            print(f"- {warning}")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))

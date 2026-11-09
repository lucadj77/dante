# Gamebooks in Dante

A gamebook is made of numbered paragraphs: the reader jumps from one to another by the choices
they make. Dante turns a project into a gamebook when `dante.yaml` says:

```yaml
folders:
  manuscript: Paragraphs     # the folder that holds the paragraphs
gamebook:
  enabled: true
  start: 1                   # the paragraph the reader starts from
  short: 400                 # shorter than this (in goals.unit) is flagged as short
  onePerPage: true           # each paragraph starts on a new page (page estimates, export)
  showLinks: false
  boxes: [...]               # box types, see below
  export: {...}              # see references/dante-yaml.md
```

Everything in SKILL.md about presence, snapshots, trash, CriticMarkup, the Story Bible and
links still applies. What changes is the manuscript.

## Paragraph files

**The number is a property, never part of the file name.** The file name is the paragraph's
title and does not change when the number does. There are no chapters: the paragraphs folder
is flat (a subfolder is a separate numbering scope; avoid creating one).

```markdown
---
numero: 12
aliases:
  - "12"
note: "The guard can be bribed only here"
---
The courtyard is empty. A door creaks on your left.

::: {custom-style="box"}
🤔 **You must act fast!**

If you open the door, turn to **[[The cellar|27]]**. If you climb the wall, turn to **[[On the roof|31]]**.
:::
```

Keys, the same in every language (they are the file format):

| Key | Meaning |
| --- | --- |
| `numero` | the paragraph's number, an integer. A file without it is a page (rules, credits) |
| `aliases` | holds the number as a quoted string (`- "12"`), plus any aliases written by hand |
| `numero_tipo` | `libero` (default when missing: a shuffle may change it), `fisso` (never changes), `relativo` |
| `ancora`, `scarto` | for `relativo`: `ancora: "[[Other title]]"` and `scarto: 2`; the number is the anchor's plus the offset |
| `finale` | `true` for an ending |
| `note` | the author's note on the paragraph (shown as the synopsis) |
| `rimandi nascosti` | references the reader does not see (a number to compute): a list of `"[[Title|N]]"` |
| `posizione` | on a page without number: `dopo` puts it after the paragraphs (default: before) |
| box properties | `traits`, `keywords`, `encounters` in English books, `carattere`, `parole chiave`, `incontri` in Italian ones (from `gamebook.boxes`) |

**Frontmatter is read line by line, not as full YAML.** Write it exactly in this shape:
one `key: value` per line, and lists as `key:` followed by lines `  - item` (two spaces,
dash, space). Do not use inline lists (`[a, b]`), nested maps or multi-line strings. A key
with no value is written `key:` alone. Keep the existing lines you do not change byte for
byte.

A new paragraph, as Dante writes it:

```markdown
---
numero: 7
aliases:
  - "7"
note:
---
```

A relative one: add `numero_tipo: relativo`, `ancora: "[[The cellar]]"`, `scarto: 2` after
`numero`.

## References

- A reference is `[[Title|N]]`: the target is the title (stable), the label is the current
  number. Usually in bold: `**[[The cellar|27]]**`.
- `[[27]]` (bare number) works through the alias but breaks at the first shuffle: write the
  title form. Never write paragraph numbers as plain text ("turn to 27"): renumbering cannot
  update them.
- When you change a paragraph's number, update `numero`, replace the old number in its
  `aliases`, rewrite the label of every `[[Title|old]]` across the book (text and
  `rimandi nascosti`), and move the paragraphs that are `relativo` to it by the same amount.
  Two paragraphs must never share a number. In Italian books, fix the article before the
  reference: «al 7» but «all'8», «il 12» but «l'11» (numbers starting with a vowel sound:
  1, 8, 11, 80-89, 800-899).
- Renaming a paragraph (its file) means rewriting the target of every reference to it, keeping
  the label.
- Prefer letting Dante shuffle or reorder the numbering (buttons **Shuffle** and **Reorder**):
  it keeps fixed paragraphs, the start paragraph and relative anchors, saves snapshots and
  records the operation in `.dante/gamebook/operations.json` so it can be undone. Do not
  renumber the whole book by hand unless asked.

## Boxes

A box is a Pandoc fenced div with the style `box`; the emoji opening its first content line
gives its type:

```markdown
::: {custom-style="box"}
✏️ **Item**

Note the keyword **lantern** on your sheet.
:::
```

The opening line is exactly `::: {custom-style="box"}` and the closing line exactly `:::`,
each on its own line, with an empty line before and after the box. Default types (each book
can define its own in `gamebook.boxes`, with `id`, `emoji`, `name`, `color`, `text`,
`property`, `ending`):

| Emoji | Type | Property (en / it) |
| --- | --- | --- |
| 🤔 | choice | |
| ❤️ | trait | `traits` / `carattere` |
| ✏️ | item, keyword | `keywords` / `parole chiave` |
| ✅ | memorable encounter | `encounters` / `incontri` |
| 😢 | ending (the paragraph gets `finale: true`) | |
| 🆗 | confirmed | |

When a box gives the reader a value tied to a property, also add the value to that property's
list in the paragraph's frontmatter (`keywords:` / `  - lantern`).

## Game state

Dante follows the references from the start paragraph and checks what the reader can have:

- A value in a box property (`keywords: [lantern]`) **gives** it; the same value with a
  question mark (`lantern?`) marks a paragraph that **asks** for it. A value with a leading
  `-` takes it away and is ignored by the checks.
- In the text, sentences give or ask too. English: "Note the keyword **lantern**", "Circle
  the trait **careful**" give; "If you have the keyword **lantern**", "If you own a **small
  shield**" ask. Italian: «Segna la parola chiave **lavanda**», «Cerchia la caratteristica
  **studioso**» give; «Se hai la parola chiave **lavanda**», «Se possiedi uno **scudo
  piccolo**» ask. Put the value in bold, spelled exactly as where it is given.
- Dante flags values asked but never given, values asked before the reader can have them, and
  (as information) values given but never asked.

## Checks Dante runs (keep the book free of them)

Orphan (no paragraph leads there), dead end (leads nowhere and is not an ending), unreachable
from the start, duplicate number, link without a number, reference to a missing paragraph,
ending box in a paragraph without `finale: true` or the reverse, reference label different from
the target's number, possible duplicates in the register (values differing by one or two
letters, such as "moon" and "mooon"). Before a shuffle Dante also lists paragraph numbers
written as plain text ("turn to 12", "section 5"), which a shuffle cannot update.

`scripts/outline.py` reports orphans, dead ends, duplicates, wrong labels and missing
targets for a gamebook.

## Other notes

- **Pages** (rules, introduction, credits) are files in the paragraphs folder without
  `numero`; they export before the paragraphs, or after with `posizione: dopo`.
- **Graph**: Dante writes a Mermaid diagram of the book to the note `Gamebook graph.md`
  (`Grafo del libro game.md` in Italian) at the project's top level when the writer presses
  **Graph**. Regenerating it keeps the text around the diagram. Do not edit the diagram by hand.
- **Callouts** (`> [!note] Title`) can hold rules or notes inside a paragraph; they export as
  coloured boxes.
- **Export**: paragraphs come out in number order with the number as heading; references
  become clickable in DOCX, PDF and EPUB. Settings are in `gamebook.export`.

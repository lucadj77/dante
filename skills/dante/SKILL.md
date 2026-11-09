---
name: dante-novel-project
description: Read, write, revise and reorganize a novel or gamebook kept as a Dante project (a folder with dante.yaml and Markdown scenes or numbered paragraphs) without breaking it. Use when a folder holds dante.yaml or the user mentions Dante.
---

# Working on a Dante project

[Dante](https://github.com/lucadj77/dante) is a writing app for novelists. A Dante project is
an ordinary folder of Markdown files: the files on disk are the only source of truth, and the
app rebuilds everything (tree, chapter numbers, statistics, views, checks) from them. The
folder is often shared with co-authors through Dropbox or Google Drive, and may be open in
Dante while you work.

You can therefore work on a book by reading and editing files directly, as long as you follow
the conventions below. Breaking them does not corrupt anything, but it scrambles the order of
the book, turns scenes into chapter properties, loses links, or overwrites a co-author's work.

This file covers what every task needs. Read the reference files when the task touches them:

| File | Read it when |
| --- | --- |
| `references/dante-yaml.md` | changing `dante.yaml`: headings, goals, pages, cover, tree colours, export, typography |
| `references/markup.md` | writing or converting text with images, tables, alignment, blank lines, callouts, embeds, diagrams |
| `references/gamebook.md` | a gamebook needs more than the "Gamebooks" section below: checks, game state, export |

`scripts/outline.py` prints the manuscript in reading order with lengths and warnings (see
"Tools" at the end). Run it before and after any structural change.

## Recognizing a project

A folder is a Dante project when it holds `dante.yaml` (often next to a `<Title>.dante`
launcher file, whose content does not matter). Always read `dante.yaml` first: folder names
are in the book's language and can be renamed, so never assume `Manuscript/`.

```yaml
title: The Return
subtitle: A novel
authors: [Ada Rossi]
language: en                # the book's language (BCP 47), not the interface's
folders:
  manuscript: Manuscript    # scenes and chapters (or a gamebook's paragraphs)
  codex: Story Bible        # characters, places… (called codex in the file)
  research: Research
  laboratory: Laboratory    # drafts, outlines, discarded material
  views: Views              # tables and boards (YAML)
  templates: Templates      # templates of scenes and note types
structure:
  parts: false              # true: the first level of folders in the manuscript are parts
goals: { unit: characters, words: 480000, deadline: 2027-03-31, daily: 3000, days: [1, 2, 3, 4, 5] }
```

Default folder names by language (a missing key falls back to them):

| | manuscript | codex | research | laboratory | views | templates |
| --- | --- | --- | --- | --- | --- | --- |
| en | Manuscript | Story Bible | Research | Laboratory | Views | Templates |
| it | Manoscritto | Bibbia | Ricerca | Laboratorio | Viste | Modelli |
| es | Manuscrito | Biblia | Investigación | Laboratorio | Vistas | Plantillas |
| fr | Manuscrit | Bible | Recherche | Laboratoire | Vues | Modèles |

Speak to the writer in their language, and write property names and values in the language
the project already uses (`status: draft` in an English book, `stato: bozza` in an Italian one).
Only the properties listed under "Properties with a meaning for Dante" are English everywhere.

## The golden rules

1. **Never touch Dante's own data**: `.dante/` (snapshots, presence, writing log, history,
   trash log, gamebook operations), `.trash/`, `export/` (generated books), and other apps'
   hidden folders. Read them if useful; do not edit or delete, except as described below
   (adding a snapshot, moving to the trash).
2. **Check presence before editing a scene** (see "Co-authors"): if someone else has that file
   open in Dante, do not write it.
3. **Keep order in names**: every scene file and chapter folder in a novel's manuscript starts
   with a number and a space (`010 Arrival.md`). Never drop, reformat or duplicate the prefix.
   (Gamebooks are different: the number is a property, never in the name. See
   `references/gamebook.md`.)
4. **Titles are not in the text**: do not write `# Chapter 3` or `# Scene title` at the top of a
   scene. Headings such as "Chapter 3: The letter" are computed from `dante.yaml`, the folder
   order and the titles.
5. **Respect typography as typed**: Dante converts quotes, dialogue dashes, apostrophes and
   ellipses only when exporting, by the project's settings. Do not "fix" `"…"`, `«…»`, `—`
   or `'` in the files unless you are asked to.
6. **Keep frontmatter valid YAML**: quote any value containing `: ` or ` #`, or starting with
   `[`, `{`, `*`, `&`, `!`, `|`, `>`, `%`, `@`, `` ` ``; links in properties are always quoted
   (`"[[Lucia]]"`). Never remove properties you do not understand.
7. **Leave CriticMarkup alone unless asked**: `{++ ++}`, `{-- --}`, `{~~ ~> ~~}`, `{== ==}`,
   `{>> <<}` are co-authors' revisions and comments. Do not accept, reject, or delete them on
   your own, and do not edit text inside someone else's pending revision.
8. **Renaming or moving fixes links**: when a note or scene changes name, update every
   `[[wikilink]]` that pointed to it across the project (see "Links").
9. **Delete by moving to `.trash/`**, never with a real delete (see "Deleting").
10. **When the writer wants to review your changes**, write them as signed revisions
    (see "Comments and revisions") instead of editing the text silently.
11. **Measure the way the project does**: when you report a length or set a goal, use the
    project's unit (`goals.unit`: `words`, or `characters` with spaces included). When unsure,
    give both. Italian publishing counts characters with spaces, so many projects do.

## The manuscript of a novel

```text
Manuscript/
├── 000 Prologue/
│   ├── 000 Prologue.md       folder note: kind: prologue
│   └── 010 The call.md       scene
├── 010 Homecoming/           a part (when structure.parts is true)
│   ├── 010 Homecoming.md     the part's folder note
│   └── 010 Return/           a chapter
│       ├── 010 Arrival.md    scene
│       └── 020 The house.md  scene
└── 900 Epilogue/
```

- **Scenes** are `.md` files; **chapters** and **parts** are folders. With `parts: false`,
  every folder is a chapter; with `parts: true`, folders directly in the manuscript are parts
  and folders inside them chapters. A folder note can say otherwise with `kind`.
- **Order**: siblings are sorted by the number before the first space, as a number
  (`5` < `010` < `100`), not as text. Names without a number go last. Numbers go in steps of
  10 and are usually three digits wide (`010`, `020`, … `990`, then `1000`); `000` is fine for
  a prologue. The number never appears in the book.
- **Folder note**: a note inside a folder with exactly the folder's name
  (`010 Return/010 Return.md`) holds the chapter's or part's properties. It is not a scene and
  its body is not part of the book. Consequently **a scene must never have the same name as
  its folder**. Folder notes exist only when there is something to store (a part always has
  one; a chapter only for `kind`, `title`, `synopsis`, `goal`…): do not create empty ones.
- **Hidden**: files and folders whose names start with `.` or `_` are not part of the
  manuscript. Conflict copies (see below) are not scenes either.
- **Loose scenes**: a scene directly in the manuscript or in a part, outside chapters, is
  allowed but flagged; the export appends it to the previous chapter. Avoid creating them.
- **Reading order**: depth first, folders and scenes sorted together by number. A chapter's
  text is its scenes in order.

### Scene files

```markdown
---
title: "The meeting: part one"
synopsis: "Two thugs stop the priest: the wedding must not happen."
status: draft
pov: "[[Don Abbondio]]"
date: 1628-11-07
goal: 3000
---
The scene's prose starts here, in Markdown paragraphs separated by one empty line.

A second paragraph. *Italic*, **bold**, ==highlight==, ~~strike~~.

***

A line with only `***`, `---` or `* * *` is a break inside the scene, printed as a separator.
```

- Paragraphs are separated by **exactly one** empty line. Extra empty lines vanish in the book;
  a visible blank line is a paragraph holding only `&nbsp;` (see `references/markup.md`).
- A single line break inside a paragraph (verse, letters) is a line ending with a backslash
  or two spaces; prefer a backslash, which is visible.
- Headings inside a scene are exported as headings: use them only when the writer wants one
  inside the text.
- A new scene starts from the scene template, `<Templates>/<Scene>.md` (`Templates/Scene.md`,
  `Modelli/Scena.md`, `Plantillas/Escena.md`, `Modèles/Scène.md`) when it exists, with
  `{{title}}` and `{{date}}` (YYYY-MM-DD) filled in. Its properties are the ones "for all
  scenes". Without a template, start with the project's status property set to its first
  value when the project uses one.

### Properties with a meaning for Dante

Their names are English in every language:

| Property | Where | Meaning |
| --- | --- | --- |
| `title` | scene, folder note | title shown everywhere, when it differs from the file name |
| `synopsis` | scene, folder note | a few lines on what happens; shown in views and boards |
| `goal` | scene, folder note | target length, in the project's unit (`goals.unit`) |
| `kind` | folder note | `part`, `chapter`, `prologue` or `epilogue` |
| `numbered` | folder note | `false`: no number, not counted (an interlude) |
| `published_title` | scene, folder note | title used only in the exported book |
| `type` | Story Bible note | the note's type id (`character`, `place`…) |
| `aliases` | any note | other names of the note, for links and mention counts |

The stage of work is the property `status` (`stato`, `estado`, `statut` in the other
languages); its allowed values, in order from first to last stage, are in `dante.yaml`.
Any other property is the writer's own (`pov`, `date`, `place`, in any language).

**Typed properties** are defined in `dante.yaml`; respect their kind and allowed values:

```yaml
properties:
  status:
    kind: text                         # text, number, date, checkbox, list, link
    values: [idea, draft, revised, done]
  pov:
    kind: link
    note_type: character               # value is a "[[link]]" to a character note
  date: date                           # short for { kind: date }
```

| Kind | Written in the file as |
| --- | --- |
| `text` | plain text; one of `values` when they are given |
| `number` | `42` (bare) |
| `date` | `2026-10-15` (`YYYY-MM-DD`; a timeline also accepts `1628`, `1628-11`, negative years, or a plain day number) |
| `checkbox` | `true` / `false` |
| `list` | YAML list, items from `values` when given |
| `link` | `"[[Name]]"`, quoted; a list of them for several |

A value that does not fit its definition is kept and flagged by Dante, not lost; still, do
not write one. To add a property "for all scenes", add it with an empty value to the scene
template; scenes get it in their file only when given a value. To rename a property across
the project, rename the key in every frontmatter (keeping value and position), in
`dante.yaml` (`properties`, `tree.dot`, `tree.colors`, type `properties`) and in every view
(`filter`, `sort`, `group_by`, `fields`, `date`, `end`, `widths`). Never rename the status
property or the English ones above.

## Common operations on a novel

Large restructurings are safest done by the writer in Dante, which renames and relinks
atomically. Do them by hand when asked, following these recipes, and run the outline script
afterwards.

**Add a scene** at a position: pick a number between its neighbours (between `020` and `030`,
use `025`); at the end, last number + 10. Create `NNN Title.md` from the template. If there is
no free number, renumber the siblings from that point in steps of 10, renaming the fewest
files possible.

**Add a chapter**: create the folder `NNN Title/` with at least one scene inside. Add a folder
note only for properties (`kind: prologue`, `title`, `synopsis`…). With parts on, a chapter
goes inside a part folder; a folder created directly in the manuscript is a part unless its
folder note says `kind: chapter`.

**Reorder**: change only the numbers needed (rename, keeping the title). Two siblings must not
share a number.

**Move a scene to another chapter**: rename it into the other folder with a number that fits
there; make sure its name differs from the destination folder's name.

**Rename a scene or chapter**: either change the title in the file or folder name (keep the
number), or set the `title` property and leave the name alone. Renaming a folder means
renaming its folder note to the same new name. Snapshots follow the scene: move
`.dante/snapshots/<old path without .md>/` to the new path too. Then fix links. Characters
`\ / : * ? " < > | # ^ [ ]` cannot be in names; put such a title in the `title` property.

**Split a scene**: keep the first half in the file, create the second half as the next scene.
**Split a chapter**: create the next chapter folder and move the following scenes into it.
**Merge scenes**: append the later scene's body to the first (one empty line between), move
the later file to the trash, and redirect links that pointed to it. A scene with a conflict
copy must be settled first.

**Turn a chapter into a prologue, epilogue or interlude**: in its folder note set
`kind: prologue` / `kind: epilogue`, or `numbered: false`. The following chapters renumber
themselves; nothing else changes.

**Read, summarize or analyse the novel**: walk the manuscript in reading order, skipping folder
notes; the chapter title is the folder note's `title` or the folder name without its number.
Leave out CriticMarkup comments, read pending revisions as accepted (the default export), and
say so if it matters.

## Gamebooks

A project is a gamebook when `dante.yaml` has `gamebook: enabled: true`. The manuscript folder
(`folders.manuscript`, often `Paragraphs`, `Sections` or `Paragrafi`) then holds **numbered
paragraphs** instead of chapters and scenes, and the reader jumps from one to another by the
choices they make. Everything else in this file (presence, snapshots, trash, CriticMarkup, Story
Bible, links) still applies. `references/gamebook.md` has the edge cases.

```yaml
folders:
  manuscript: Paragraphs
gamebook:
  enabled: true
  start: 1          # the number of the paragraph the reader starts from
  short: 400        # a paragraph shorter than this (in goals.unit) is flagged as short
  onePerPage: true  # each paragraph starts on a new page (pages and export)
  boxes: [...]      # the box types of this book (defaults below)
```

### Paragraph files

One Markdown file per paragraph, in the paragraphs folder (flat, no subfolders). **The file
name is the paragraph's title and never holds the number; the number is the `numero`
property, repeated in `aliases`.** The keys are the same in every language, because they are
the file format:

```markdown
---
numero: 12
aliases:
  - "12"
note: "Only place where the guard can be bribed"
---
The courtyard is empty. A door creaks on your left.

::: {custom-style="box"}
🤔 **You must act fast!**

If you open the door, turn to **[[The cellar|27]]**. If you climb the wall, turn to **[[On the roof|31]]**.
:::
```

| Key | Meaning |
| --- | --- |
| `numero` | the paragraph's number (integer). Without it the file is a page: rules, introduction, credits |
| `aliases` | the number as a quoted string (`- "12"`), plus hand-written aliases |
| `numero_tipo` | `libero` (default: a shuffle may change it), `fisso` (never changes), `relativo` |
| `ancora`, `scarto` | for `relativo`: `ancora: "[[Other title]]"`, `scarto: 2` → the anchor's number + 2 |
| `finale` | `true` on an ending (death, victory) |
| `note` | the author's note on the paragraph |
| `rimandi nascosti` | references the reader does not see (a number to work out from a riddle): list of `"[[Title|N]]"` |
| `posizione` | on a page without number: `dopo` puts it after the paragraphs; otherwise it goes before |
| box properties | values the reader gets: `traits`, `keywords`, `encounters` (English books), `carattere`, `parole chiave`, `incontri` (Italian books) |

**Write the frontmatter of paragraphs line by line, not as free YAML**: one `key: value` per
line; lists as `key:` followed by `  - item` lines (two spaces, dash, space); never inline
lists `[a, b]`; an empty key is `key:` alone. Leave the lines you do not change exactly as they
are.

A new paragraph, as Dante writes it (use the first number not yet taken, unless the writer
says otherwise):

```markdown
---
numero: 7
aliases:
  - "7"
note:
---
```

### The start paragraph

The reader starts from the paragraph whose `numero` is `gamebook.start` (1 when missing). It
must exist, it is never an orphan, a shuffle never moves it, and every other paragraph should
be reachable from it by following references. To change where the book starts, change
`gamebook.start`, not the numbers.

### References between paragraphs

- A reference is a wikilink to the **title** with the **number as label**, in bold:
  `**[[The cellar|27]]**`. The title keeps the link valid when numbers change; the label is
  what the reader sees.
- Never write `[[27]]` (breaks at the first shuffle) or a number as plain text ("turn to 27"),
  which no renumbering can update.
- The label must equal the target's current `numero`. When a number changes: update `numero`,
  replace the old number in `aliases`, rewrite the label of every reference to it (in text and
  in `rimandi nascosti`), and move the `relativo` paragraphs anchored to it by the same amount.
  Two paragraphs never share a number. Renaming a paragraph's file means rewriting the target
  of every reference to it, keeping the label.
- In Italian books, fix the article before the reference: «vai al **[[Bosco|7]]**» but
  «vai all'**[[Fiume|8]]**», «il 12» but «l'11» (numbers said with a leading vowel: 1, 8, 11,
  80-89, 800-899).
- Leave whole-book renumbering to Dante (**Shuffle**, **Reorder**): it keeps fixed paragraphs,
  the start and the anchors, saves snapshots, and can undo the operation.

### Boxes: choice, trait, item, encounter, ending

A box is a block between the line `::: {custom-style="box"}` and the line `:::`, each alone on
its line, with an empty line before and after. The **emoji that opens its first line gives
its type**. Default types (a book can define others in `gamebook.boxes`, each with `id`,
`emoji`, `name`, `color`, `text`, `property`, `ending`):

| Emoji | Type | First line (en / it) | Property it fills (en / it) |
| --- | --- | --- | --- |
| 🤔 | choice | `**You must act fast!**` / `**Devi agire in fretta!**` | |
| ❤️ | trait | `**Trait**` / `**Carattere**` | `traits` / `carattere` |
| ✏️ | item, keyword | `**Item**` / `**Oggetto**` | `keywords` / `parole chiave` |
| ✅ | memorable encounter | `**Memorable encounter**` / `**Incontro memorabile**` | `encounters` / `incontri` |
| 😢 | ending | `**The end**` / `**Fine**` | (sets `finale: true`) |
| 🆗 | confirmed | `**Confirmed**` / `**Corretto**` | |

Examples:

```markdown
::: {custom-style="box"}
✏️ **Item**

Note the keyword **lantern** on your sheet, then turn to **[[The stairs|14]]**.
:::

::: {custom-style="box"}
😢 **The end**

The tower collapses on you. Your adventure ends here.
:::
```

- A box that gives a value also adds it to the paragraph's property list
  (`keywords:` / `  - lantern`).
- An ending box (😢) needs `finale: true` in the frontmatter: a box without the flag is a
  problem Dante flags. The reverse is fine: a paragraph with `finale: true` and no ending box
  (an ending told in the prose) is not an error; at most mention it to the writer as a note.
- A paragraph that **asks** for a value lists it with a question mark (`keywords:` /
  `  - lantern?`), or says it in the text with the value in bold: "If you have the keyword
  **lantern**, turn to …" («Se hai la parola chiave **lanterna**, vai al …»). Values are
  given in text by "Note the keyword **x**", "Circle the trait **x**" («Segna la parola
  chiave **x**», «Cerchia la caratteristica **x**»). Spell a value the same everywhere:
  Dante flags values asked but never given, or asked before the reader can have them.

### What a sound gamebook looks like

Dante flags these problems, so avoid creating them: **orphans** (no paragraph leads there,
except the start), **dead ends** (no reference out and not an ending), paragraphs
**unreachable** from the start, **duplicate numbers**, references to missing paragraphs,
reference labels that differ from the target's number, ending boxes without `finale: true`,
near-duplicate values ("lantern" and "lanterm"). Run
`scripts/outline.py`: for a gamebook it lists the paragraphs by number with where each comes
from and leads to, and these problems.

**Add a paragraph with a choice leading to it**: create `<Title>.md` with the first free
number, write its text (with a reference out, or a 😢 box and `finale: true`), then add
`**[[Title|N]]**` where the choice is made. **Delete a paragraph**: move it to the trash as
below and remove or redirect every reference to it, or the paragraphs that led there become
dead ends.

## Deleting

Move the file or folder to `.trash/<name>` at the top of the project (add ` 2`, ` 3` before the
extension if the name is taken), together with its conflict copies. Then record where it came
from in `.dante/trash.json`, so Dante can put it back (keep the other entries):

```json
{ "010 Arrival.md": { "from": "Manuscript/010 Return/010 Arrival.md", "date": "2026-11-09T10:12:00.000Z" } }
```

An item in `.trash/` with no entry is restored to the Laboratory. Never empty the trash.

## The Story Bible, Research and Laboratory

- **Story Bible** (`folders.codex`): one note per character, place, object, event, group,
  plotline or other type. A note's type is its `type` property, or else the type whose
  `folder` it sits in (`Story Bible/Characters/` → `character`). Types are in `dante.yaml`:

  ```yaml
  types:
    character: { name: Character, folder: Characters, icon: "👤", properties: [role, age, appearance, aliases] }
    creature:  { name: Creature,  folder: Creatures,  icon: "🐉", properties: [habitat] }
  ```

  Default types: `character`, `place`, `object`, `event`, `group`, `plotline`, with names and
  folders in the book's language (Personaggi, Luoghi, Oggetti, Eventi, Gruppi, Plotline in
  Italian). A new note goes in its type's folder, starts from `<Templates>/<type name>.md`
  when it exists (`{{title}}`, `{{date}}` filled in) or else from the type's suggested
  properties (empty), and gets `type: <id>` in its frontmatter.
- **Card images**: the board of the Story Bible shows a note's first image: a property holding
  one (`portrait: "[[Lucia.jpg]]"`) or else the first image in the text.
- **Mentions**: Dante counts and underlines a Bible note's name and aliases where the scenes
  write them as plain words, case-sensitive and whole words only. So `aliases` matter: add
  the forms the text really uses (`Renzo` for `Lorenzo Tramaglino`).
- **Research** and **Laboratory** hold free notes and files in any folder structure. Images and
  files added from Dante go to `<Research>/Attachments/` (`Allegati`, `Adjuntos`,
  `Pièces jointes`). Notes outside the manuscript need no number prefix.

## Links and embeds

Links are wikilinks, resolved by file name, case-insensitive, without `.md`:

```markdown
[[Lucia]]   [[Lucia|the girl]]   [[Lucia#Childhood]]   [[Characters/Lucia]]
![[Lucia]]  ![[Lucia#Childhood]]  ![[Lucia#^quote1]]      (embedded notes)
```

- A bare name matches any note with that name; when several match, the one closest to the
  linking note wins. Use the shortest target that is unambiguous.
- An alias of exactly one note, when no note has that name, is written as
  `[[Lorenzo Tramaglino|Renzo]]`: the text still reads "Renzo" and the link resolves in any
  editor. Prefer that form over `[[Renzo]]`.
- In a table cell the alias bar is escaped: `[[Lucia\|the girl]]`.
- After renaming or moving a note, rewrite every link that resolved to it, in text and in
  properties, keeping its `#section`, `|alias` and leading `!`. A link that still reaches its
  note is left as is.
- A link to a note that does not exist is allowed (Dante offers to create it); do not create
  notes for such links unless asked.

## Comments and revisions (CriticMarkup)

Co-authors comment and revise in CriticMarkup; every change and comment is followed by a
signature comment `{>>@Name YYYY-MM-DD<<}` (or `{>>@Name YYYY-MM-DD: words<<}`):

```markdown
The door was {--closed--}{>>@Anna 2026-10-14<<}{++ajar++}{>>@Anna 2026-10-14<<}.
{==The wind smelled of salt.==}{>>@Luca 2026-10-13: too early for the sea?<<}{>>@Anna 2026-10-14: I'd move it<<}
```

- **Addition** `{++text++}`, **deletion** `{--text--}`, **substitution** as a signed deletion
  followed by a signed addition (`{~~old~>new~~}` is also read), **highlight + comment**
  `{==text==}{>>@Name date: comment<<}`, **plain comment** `{>>@Name date: comment<<}`.
- A **reply** is one more comment placed immediately after the previous one, with no space.
- Sign as the name the writer tells you to use (ask if unsure; `@Claude` or the agent's own
  name is a reasonable default) with today's date. The name may contain spaces when followed
  by a date.
- To **accept** an addition keep its text without marks; to accept a deletion remove the
  text; rejecting does the opposite. Remove the signature comments with them. To **resolve**
  a comment thread, remove the comments and keep the highlighted text. Do this only when the
  writer asks, and only for the items they mean.
- Settling an item through Dante also writes it to the history (`.dante/history/<name>.jsonl`).
  Do not write there; if the writer wants a record of what you settled, list it in your reply.
- Never nest CriticMarkup or put a mark across a paragraph break. Keep marks out of
  frontmatter, link targets and code.
- The export drops comments and accepts or rejects pending revisions by `export.revisions`.

## Co-authors, sync and history

- **Presence**: `.dante/presence/<name>.json` holds `{ "user", "path", "since", "updated" }`
  for each person with Dante open. If a presence's `path` is the file you want to edit and its
  `updated` is less than 3 minutes old, someone is editing it: do not write that file; tell
  the writer, or leave your changes as a comment elsewhere.
- **Dante may be open**: it watches the folder and reloads changed files, so editing while it
  runs is fine for files nobody has open. Write whole files at once rather than in many small
  appends.
- **Conflict copies**: files such as `Scene (Anna's conflicted copy 2026-10-14).md`,
  `Scena (copia in conflitto di Anna …).md`, `Scene (1).md` next to `Scene.md`, or
  `Scene.sync-conflict-….md` are copies made by a sync service. They are not scenes; Dante
  offers to merge them. Do not edit, rename or delete them unless asked to settle the conflict.
- **Snapshots**: `.dante/snapshots/<scene path without .md>/YYYY-MM-DDTHH-MM-SS[ name].md` are
  earlier versions of a scene, in local time. **Before rewriting a scene, add one** (a copy of
  the file, named with the current time and a name such as `Before AI edit`); the writer can
  then compare and restore it in Dante. Never change or delete existing ones.
- **Writing log**: `.dante/sessions/<name>.json` counts each person's words and characters per
  day. Leave it alone; edits made outside Dante are not counted, which is correct.
- **Backups** are zip files outside the project, made by Dante; nothing to do for you.

## Views: tables, boards, timelines

A view is a YAML file in the Views folder (`Views/Scenes by status.yaml`). Dante shows it as a
table, list, cards, kanban board or timeline, and lets the writer edit notes from it. You may
create or edit one:

```yaml
type: kanban            # table, list, cards, kanban, timeline
items: scene            # scene, chapter, note, or a Bible type id such as character
source: Manuscript      # folder or list of folders to take notes from; omitted = whole project
filter:
  pov: Marta            # every condition must hold; a list means any of its values
sort: -date             # "-" reverses; omitted keeps the manuscript's order
group_by: status        # columns of the board, or groups in the other types
groups: [idea, draft, revised, done]   # in this order, even when empty
fields: [pov, words]    # also name, folder, type, words, chapter
date: date              # timeline only: the property with the date
end: until              # timeline only, optional
synopsis: false         # hide the synopsis under each item (shown by default)
widths: {name: 320, pov: 140, lane: 260}   # column widths in pixels, set by dragging
order: [Manuscript/010 Return/020 The house.md]   # manual order by dragging, when no sort
```

Chapter rows read and write their folder note and count their scenes. When Dante rewrites a
view it drops hand-written comments, so do not rely on them. To answer questions such as
"which scenes are still drafts" you do not need a view: read the frontmatter directly.

## Statistics you can compute

Dante counts the text as read: without frontmatter, CriticMarkup comments, HTML tags,
embedded images and notes, table rules, link targets (aliases count) and Markdown marks, with
pending revisions accepted. **Characters** are characters with spaces included after
collapsing whitespace; **words** are runs of letters and digits, joined by `'`, `’` or `-`.
A page is `pages.size` units of `pages.unit` (by default 1,800 characters with spaces).
Reading time uses 230 words a minute. `scripts/outline.py` counts the same way.

## Before you finish

- Run `python3 scripts/outline.py <project>`: no new warnings (duplicate numbers, scene named
  like its folder, missing links, invalid YAML, scenes outside chapters).
- Every frontmatter you touched parses as YAML (gamebook paragraphs: see their own rules).
- Nothing in `.dante/`, `.trash/` or `export/` changed except snapshots you added, items you
  trashed and their `trash.json` entries.
- CriticMarkup you did not write is intact.
- Tell the writer which files you created, renamed, moved or trashed, and lengths in the
  project's unit, so they can find everything in Dante.

## Tools

`scripts/outline.py` (Python 3, standard library; PyYAML used when installed):

```text
python3 scripts/outline.py <project>           outline in reading order, lengths, warnings
python3 scripts/outline.py <project> --text    the whole book's text, in order
python3 scripts/outline.py <project> --json    the outline as JSON
```

It reads `goals.unit` and shows lengths in words and characters with spaces. For a gamebook it
lists the paragraphs by number with where each leads, and the orphans, dead ends, duplicate
numbers and broken references. It only reads files.

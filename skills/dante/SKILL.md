---
name: dante-novel-project
description: Read, write and reorganize a novel kept as a Dante project (a folder with dante.yaml and numbered Markdown scenes) without breaking it for Dante or Obsidian.
---

# Working on a Dante novel project

[Dante](https://github.com/lucadj77/dante) is a writing app for novelists. A Dante project is
an ordinary folder of Markdown files: the files on disk are the only source of truth, and the
app rebuilds everything (tree, chapter numbers, statistics, views) from them. The same folder
opens in Obsidian and is often shared through Dropbox or Google Drive with co-authors.

This means you can work on a novel by editing files directly, but only if you follow the
conventions below. Breaking them does not corrupt anything, but it scrambles the order of the
book, turns scenes into chapter properties, loses links or overwrites a co-author's work.

## Recognizing a project

A folder is a Dante project when it holds `dante.yaml` (and usually a `Title.dante` launcher
file, whose content does not matter). Always read `dante.yaml` first: folder names are in the
novel's language and can be renamed, so never assume `Manuscript/`.

```yaml
title: The Return
authors: [Ada Rossi]
language: it                # the novel's language (BCP 47), not the interface's
folders:
  manuscript: Manoscritto   # scenes and chapters
  codex: Bibbia             # the Story Bible: characters, places… (called codex in the file)
  research: Ricerca
  laboratory: Laboratorio   # drafts, ideas, discarded material
  views: Viste              # view definitions (YAML)
  templates: Modelli        # templates of note types
structure:
  parts: false              # true: the first level of folders in the manuscript are parts
```

Default folder names: English `Manuscript`, `Story Bible`, `Research`, `Laboratory`, `Views`,
`Templates`; Italian `Manoscritto`, `Bibbia`, `Ricerca`, `Laboratorio`, `Viste`, `Modelli`;
Spanish and French have their own. A missing key falls back to the default of the language.

If `scripts/outline.py` sits next to this file, run `python3 scripts/outline.py <project>` to
get the manuscript in reading order with titles, kinds, word counts and structural warnings,
and `--text` to print the whole novel in order. Otherwise build the order yourself as
described below.

## The golden rules

1. **Never touch Dante's own data**: `.dante/` (snapshots, presence, writing log), `.trash/`,
   `export/` (generated books), `.obsidian/`. Read them if useful; do not edit or delete.
2. **Check presence before editing a scene** (see "Co-authors"): if someone else has that file
   open in Dante, do not write it.
3. **Keep order in names**: every scene file and chapter folder in the manuscript starts with
   a number and a space (`010 Arrival.md`). Never drop, reformat or duplicate the prefix.
4. **Titles are not in the text**: do not write `# Chapter 3` or `# Scene title` at the top of a
   scene. Chapter and part headings ("Chapter 3: The letter") are computed by Dante from
   `dante.yaml`, the folder order and the titles.
5. **Respect typography as typed**: Dante converts quotes, dialogue dashes, apostrophes and
   ellipses only when exporting, by the project's settings. Do not "fix" `"…"`, `«…»`, `—`
   or `'` in the files unless you are asked to.
6. **Keep frontmatter valid YAML**: quote any value containing `: `, `#`, or starting with `[`,
   `{`, `*`, `&`, `!`, `|`, `>`, `%`, `@`; links in properties are always quoted (`"[[Lucia]]"`).
   Never remove properties you do not understand.
7. **Leave CriticMarkup alone unless asked**: `{++ ++}`, `{-- --}`, `{~~ ~> ~~}`, `{== ==}`,
   `{>> <<}` are co-authors' revisions and comments. Do not accept, reject, or delete them on
   your own, and do not edit text inside someone else's pending revision.
8. **Renaming or moving fixes links**: when a note or scene changes name, update every
   `[[wikilink]]` that pointed to it across the project (see "Links").
9. **Delete by moving to `.trash/`** at the top of the project, never with a real delete.
10. **When the writer wants to review your changes**, write them as signed revisions
    (see "Comments and revisions") instead of editing the text silently.

## The manuscript

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
  (`5` < `010` < `100`), not by text. Names without a number go last. Numbers go in steps
  of 10 and are usually three digits wide (`010`, `020`, … `990`, then `1000`); `000` is
  fine for a prologue. The number never appears in the book.
- **Folder note**: a note inside a folder with exactly the folder's name
  (`010 Return/010 Return.md`) holds the chapter's or part's properties. It is not a scene.
  Consequently **a scene must never have the same name as its folder**. Folder notes exist
  only when there is something to store; do not create empty ones.
- **Hidden**: files and folders whose names start with `.` or `_` are not part of the
  manuscript. Conflict copies (see below) are not scenes either.
- **Loose scenes**: a scene directly in the manuscript or in a part, outside chapters, is
  allowed but flagged; the export appends it to the previous chapter. Avoid creating them.
- **Reading order**: depth first, folders and scenes sorted together by number. A chapter's
  text is its scenes in order; there is no chapter-level text besides the folder note's
  properties.

### Scene files

```markdown
---
title: "The meeting: part one"
synopsis: "Two thugs stop the priest: the wedding must not happen."
status: draft
pov: "[[Don Abbondio]]"
date: 1628-11-07
---
The scene's prose starts here, in Markdown paragraphs separated by a blank line.

A line with only `***`, `---` or `* * *` is a break inside the scene.
```

The body is plain prose in Markdown: paragraphs, `*italic*`, `**bold**`, `~~strike~~`,
`==highlight==`, block quotes, lists, tables, images and wikilinks. Headings inside a scene are
exported as headings, so use them only when the writer wants a heading inside the text.

### Properties with a meaning for Dante

Their names are English in every language:

| Property | Where | Meaning |
| --- | --- | --- |
| `title` | scene, folder note | title shown everywhere, when it differs from the file name |
| `synopsis` | scene, folder note | a few lines on what happens |
| `kind` | folder note | `part`, `chapter`, `prologue` or `epilogue` |
| `numbered` | folder note | `false`: no number, not counted (like a prologue) |
| `published_title` | scene, folder note | title used only in the exported book |
| `type` | Story Bible note | the note's type id (`character`, `place`…) |
| `aliases` | any note | other names of the note, for links and mention counts |

Any other property is the writer's own (`status`, `pov`, `date`, in any language). Typed
properties are defined in `dante.yaml`; respect their kind and allowed values:

```yaml
properties:
  status:
    kind: text                         # text, number, date, checkbox, list, link
    values: [idea, draft, revised, done]
  pov:
    kind: link
    note_type: character               # value is a "[[link]]" to a character note
  date: date                           # short for { kind: date }: YYYY-MM-DD
```

Write values as Obsidian does: numbers bare, `true`/`false`, dates `YYYY-MM-DD`, YAML lists,
links as quoted `"[[Name]]"`.

## Common operations

Prefer asking the writer to do large restructurings in Dante (it renames and relinks
atomically); do them by hand only when asked, following these recipes.

**Add a scene** at a position: pick a number between its neighbours (between `020` and
`030`, use `025`); at the end, last number + 10. Create `NNN Title.md` with the prose. If
there is no free number between the neighbours, renumber the siblings from that point in
steps of 10, renaming the fewest files possible.

**Add a chapter**: create the folder `NNN Title/` with at least one scene inside. Add a
folder note only for properties (`kind: prologue`, `title`, `synopsis`…). With parts on, a
chapter goes inside a part folder; a folder created directly in the manuscript is a part
unless its folder note says `kind: chapter`.

**Reorder**: change only the numbers needed (rename, keeping the title). Two siblings must not
share a number.

**Move a scene to another chapter**: rename it into the other folder with a number that fits
there; make sure its name differs from the destination folder's name.

**Rename a scene or chapter**: either change the title in the file or folder name (keep the
number), or set the `title` property and leave the name alone. Renaming a folder means
renaming its folder note to the same new name. Then fix links (below). Characters
`\ / : * ? " < > | # ^ [ ]` cannot be in names; put such a title in the `title` property.

**Split a scene**: keep the first half in the file, create the second half as the next scene.
**Merge scenes**: append the later scene's body to the first (blank line between), move the
later file to `.trash/`, and redirect links that pointed to it.

**Delete**: move the file or folder to `.trash/<name>` (add ` 2`, ` 3` if taken), with its
conflict copies.

**Read or summarize the novel**: walk the manuscript in reading order, skipping folder notes;
the chapter title is the folder's `title` property or the folder name without its number.

## The Story Bible, Research and Laboratory

- **Story Bible** (`folders.codex`): one note per character, place, object, event, group,
  plotline or other type. A note's type is its `type` property, or else the type whose
  `folder` it sits in (`Bibbia/Personaggi/` → `character`). Types are defined in
  `dante.yaml`:

  ```yaml
  types:
    character: { name: Personaggio, folder: Personaggi, icon: "👤", properties: [ruolo, età, aliases] }
  ```

  A new note of a type goes in its folder, starts from `Templates/<type name>.md` when it
  exists (`{{title}}` and `{{date}}` filled in) or else from the type's suggested properties,
  and gets `type: <id>` written in its frontmatter.
- **Research** and **Laboratory** hold free notes and files in any folder structure. Images
  added from Dante go to `<Research>/Attachments/` (`Allegati`, `Adjuntos`, `Pièces jointes`).
- Note names need no numeric prefix outside the manuscript.

## Links and embeds

Links are Obsidian wikilinks, resolved by name, case-insensitive, without `.md`:

```markdown
[[Lucia]]   [[Lucia|the girl]]   [[Lucia#Childhood]]   [[Characters/Lucia]]
![[Lucia]]  ![[Lucia#^quote1]]   (embedded notes)
```

- A bare name matches any note with that name; when several match, the one closest to the
  linking note wins. Use the shortest target that is unambiguous.
- `aliases` let `[[the Unnamed]]` reach a note listing that alias, when no note has that name.
- In a table cell an alias is written `[[Lucia\|the girl]]`.
- After renaming or moving a note, rewrite every link that resolved to it, keeping its
  `#section`, `|alias` and leading `!`. A link that still reaches its note is left as is.

## Other markup Dante uses

- **Images**: `![[photo.jpg]]`, `![[photo.jpg|300]]` (width), `![[photo.jpg|caption|300]]`,
  `![caption|300](Attachments/photo.jpg)`.
- **Alignment** (no Markdown equivalent): a paragraph wrapped as
  `<span style="display:block;text-align:center">The End</span>` (`center`, `right`,
  `justify`). Markdown inside the span still works. Do not remove these spans.
- **Tables**: GitHub-style pipe tables; the paragraph right after a table starting with
  `Table:` (or `Tabella:`, or just `:`) is its caption.
- **Lists** with a hanging indent are ordinary Markdown lists.

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
- Sign as the name the writer tells you to use (ask if unsure; a name like `@Claude` is a
  reasonable default) with today's date. The name may contain spaces when followed by a date.
- To **accept** an addition keep its text without marks; to accept a deletion remove the
  text. Rejecting does the opposite. Remove the signature comments with them. To **resolve**
  a comment thread, remove the comments and keep the highlighted text. Do this only when the
  writer asks, and only for the items they mean.
- Never nest CriticMarkup or put a mark across a paragraph break.

## Co-authors, sync and history

- **Presence**: `.dante/presence/<name>.json` holds `{ "user", "path", "since", "updated" }`
  for each person with Dante open. If a presence's `path` is the file you want to edit and its
  `updated` is less than 3 minutes old, someone is editing it: do not write that file; tell
  the writer, or leave your changes as a comment elsewhere.
- **Dante may be open**: it watches the folder and reloads changed files, so editing while it
  runs is fine for files nobody has open. Write whole files at once rather than in many
  small appends.
- **Conflict copies**: files such as `Scene (Anna's conflicted copy 2026-10-14).md`,
  `Scena (copia in conflitto di Anna …).md`, `Scene (1).md` next to `Scene.md`, or
  `Scene.sync-conflict-….md` are copies made by a sync service. They are not scenes; Dante
  offers to merge them. Do not edit, rename or delete them unless asked to settle the conflict.
- **Snapshots**: `.dante/snapshots/<scene path without .md>/YYYY-MM-DDTHH-MM-SS[ name].md`
  are earlier versions of a scene. Before a large rewrite of a scene you may add one there
  (a copy of the file, named with the current local time and a name such as `Before AI
  edit`); never change or delete existing ones.
- **Writing log**: `.dante/sessions/<name>.json` counts each person's words per day. Leave it
  alone; your edits made outside Dante are not counted, which is correct.

## Views

A view is a YAML file in the Views folder, read by Dante as a table, list, cards, kanban board
or timeline. You may create or edit one:

```yaml
type: kanban            # table, list, cards, kanban, timeline
items: scene            # scene, chapter, note, or a type id such as character
source: Manuscript      # folders to take notes from; omitted means the whole project
filter:
  pov: Marta            # every condition must hold; a list means any of its values
sort: -date             # "-" reverses; omitted keeps the manuscript's order
group_by: status
groups: [idea, draft, revised, done]
fields: [pov, words]    # also name, folder, type, words, chapter
date: date              # timeline only
end: until              # timeline only, optional
```

## Settings you may be asked to change

`dante.yaml` also holds headings (`structure.part`, `structure.chapter`: `numbering` arabic,
roman, words, ordinal or none; `label`; `showLabel`; `showTitle`; `separator`;
`restartEachPart`), goals (`goals: {unit, words, deadline, daily, days}`; `unit` is `words` or `characters` with spaces, `words` when missing, and `words`/`daily` and the scenes' `goal` property are in that unit), pages
(`pages: {unit, size}`), the cover, and export choices (`export.docx`, `export.typography`
with `quotes` (`keep` in new projects: dialogue as typed), `dialogueDash`, `apostrophes`, `ellipsis`, `spaces`; `export.paratext` with
dedication, epigraph and so on; `export.revisions: accept | reject`). Edit only the keys you
are asked about and keep the rest of the file, comments included, exactly as it is.

## Before you finish

- Every scene and chapter in the manuscript still has a unique number prefix among its
  siblings, and no scene has its folder's name.
- Every frontmatter you touched parses as YAML.
- No link you could have broken points to a missing note.
- Nothing in `.dante/`, `.trash/` or `export/` changed except snapshots you added or items you
  moved to the trash.
- CriticMarkup you did not write is intact.
- Tell the writer which files you created, renamed, moved or trashed, so they can find them
  in Dante.

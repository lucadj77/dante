# Dante

A light writing app for novelists. A project is just a folder of Markdown files, so the
same novel opens in Obsidian, in Claude Code or in any text editor, and can be shared
through Google Drive or Dropbox.

The design is described in the [design document](https://claude.ai/code/artifact/6ae8607c-9d16-4657-a49c-c0faabf1db0a).
This repository is at **phase 1: the manuscript**.

## A project on disk

```text
My novel/
├── dante.yaml                  novel settings
├── Story Bible/  Research/  Laboratory/  Views/  Templates/
└── Manuscript/
    ├── 000 Prologue/
    │   ├── 000 Prologue.md     folder note: kind: prologue
    │   └── 010 The call.md     scene
    ├── 010 Homecoming/         a part (when parts are on)
    │   ├── 010 Homecoming.md
    │   └── 010 Return/         a chapter
    │       ├── 010 Arrival.md
    │       └── 020 The house.md
    └── 900 Epilogue/
```

- The numeric prefix only sets the order. Moving an item renames as few files as possible
  and updates the wikilinks that pointed to anything that moved.
- A folder's properties live in a note with the folder's own name (`kind`, and anything else).
- Scene properties are YAML frontmatter, as in Obsidian.
- Displayed chapter and part headings ("Chapter 3: The letter") are computed from `dante.yaml`.
- Any note can have a type (character, place, plotline…) through its `type` property; a note
  without one takes the type of the Story Bible folder it is in (`Story Bible/Characters/`). Types are
  defined in `dante.yaml` under `types`, each with a name, a Story Bible folder, an icon and
  suggested properties. `Templates/<type name>.md` is the starting text of a new note of that
  type; `{{title}}` and `{{date}}` are filled in.

## What works in phase 1

- Open a folder, watch it for changes made by other programs, reload open scenes.
- Manuscript tree: select, rename (double click or F2), drag to reorder or move.
- Editor with live preview (Markdown markers hidden away from the cursor), at four levels:
  scene, chapter, part, whole novel. Plain Markdown view on demand.
- `Ctrl/Cmd+Enter` splits the scene at the cursor; `Ctrl/Cmd+Shift+Enter` starts a new chapter there.
  Arrow keys move across scenes.
- Properties panel and statistics (words, characters with and without spaces, reading time).
- Typewriter, focus and full screen modes.
- Novel settings (labels, numbering in digits, roman numerals or words, heading templates)
  and application settings (interface language, theme, font).
- Snapshots: one taken automatically before the first change to a scene in each session,
  named ones on demand, word-by-word comparison, restore, and clean-up of old automatic ones.
  They live in `.dante/snapshots/` and follow their scene when it moves.
- DOCX export in standard manuscript format (title page with word count, running header,
  chapters on a new page a third of the way down, scene separators). Comments are removed and
  pending revisions accepted or rejected.
- Interface in English and Italian.

## What phase 2 adds

- Story Bible (Bibbia in Italian, Codex in earlier versions): notes grouped by type, shown as cards with their properties; new notes from the
  type's template or suggested properties; types added and edited from the app.
- Research and Laboratory: a file tree (new notes and folders, rename, drag to move, delete to
  `.trash/`, add files from the computer). Notes open in the editor; images, PDF and HTML
  (without its scripts) open in the app; anything else opens with the system's app.
- Wikilinks with aliases: a click follows a link (Cmd/Ctrl+click on the line being edited),
  `[[` suggests notes and their aliases, links to missing notes are drawn fainter. Renaming or
  moving anything fixes the links to it.
- A right panel with two tabs in every section: properties and links (backlinks with the lines
  that hold them, outgoing links). Both side panels can be hidden from the top bar.
- Search from the section bar (Cmd/Ctrl+Shift+F) over names, aliases and text, with a preview of
  each result beside the text.
- The section bar names its icons at once on hover, or beside them when widened.

## Development

Requirements: Node 22, Rust, and the [Tauri system dependencies](https://v2.tauri.app/start/prerequisites/).

```sh
npm install
npm run tauri dev     # desktop app
npm run dev           # browser only, with the sample project
npm test              # core logic tests
npm run check         # type checking
cd src-tauri && cargo test
```

The project logic (`src/lib/core`) has no dependency on Tauri or the interface and is
tested against an in-memory filesystem. The Rust side (`src-tauri/src/files.rs`) only
reads, writes, renames and watches files inside the opened folder.

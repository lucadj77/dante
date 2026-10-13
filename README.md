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
├── Codex/  Research/  Laboratory/  Views/  Templates/
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
- Interface in English and Italian.

Still to come in phase 1: snapshots and DOCX export.

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

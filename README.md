# Dante

A light writing app for novelists. A project is just a folder of Markdown files, so the
same novel opens in Obsidian, in Claude Code or in any text editor, and can be shared
through Google Drive or Dropbox.

The design is described in the [design document](https://claude.ai/code/artifact/6ae8607c-9d16-4657-a49c-c0faabf1db0a).
This repository is at **phase 3: collaboration**.

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

## What phase 3 adds

Several people can work on the same folder shared through Dropbox or Google Drive.

- Your name (in the settings) signs comments and revisions, written in
  [CriticMarkup](https://github.com/CriticMarkup/CriticMarkup-toolkit) with a signature comment:

  ```markdown
  The door was {--closed--}{>>@Anna 2026-10-14<<}{++ajar++}{>>@Anna 2026-10-14<<}.
  {==The wind smelled of salt.==}{>>@Luca 2026-10-13: too early for the sea?<<}{>>@Anna 2026-10-14: I'd move it<<}
  ```

  The editor draws additions, deletions and highlights as a word processor does and hides the
  marks; a comment is a 💬 bubble. The raw Markdown view shows everything as written.
- Select text and press 💬 (or `Cmd/Ctrl+Alt+M`) to comment. The right panel's Comments tab lists
  the comments and changes of the text shown, with reply, resolve (removes the discussion from the
  file), accept, reject, and accept or reject all.
- Revision mode (toolbar or settings): what you type becomes an addition and what you delete a
  deletion, signed with your name. Typing inside your own addition just edits it; edits inside
  someone else's pending addition or inside highlighted text are applied directly.
- Presence: the app writes `.dante/presence/<name>.json` with the scene or note being edited,
  refreshed every minute. A scene someone else opened first is read-only, with a warning and an
  "Edit anyway" button. A presence not refreshed for three minutes is ignored.
- Conflict copies made by Dropbox (`… (Anna's conflicted copy …)`, also in Italian), Google Drive
  (`… (1)` next to the original), Syncthing and similar are left out of the manuscript tree and
  flagged at the top. The dialog compares the two texts and keeps the file, takes the copy, or
  merges the copy's differences as revisions to accept one by one (existing comments are kept
  whole). What is set aside goes to `.trash`; a merge keeps a snapshot of the file first.

## What phase 4 adds

The Views section lists notes as a table, a list, cards, a board (kanban) or a timeline. Each
view is a YAML file in the Views folder, so it is synced with the project and can be written
by hand:

```yaml
type: kanban            # table, list, cards, kanban, timeline
items: scene            # scene, chapter, note (any note), or a type id such as character
source: Manuscript      # folders to take notes from; omitted means the whole project
filter:
  pov: Marta            # every condition must hold; a list means any of its values
sort: -date             # a minus sorts in reverse; omitted keeps the manuscript's order
group_by: status        # the board's columns, or the groups of a table, list or cards
groups: [idea, draft, revised, done]   # shown in this order, even when empty
fields: [pov, words]    # shown on each item; also name, folder, type, words, chapter
date: date              # timeline only: the property with each note's date
end: until              # timeline only: optional end
```

- Everything is also set from the app (⚙ Settings above the view); changes are saved to the file
  at once, rewriting it without comments.
- Table: click a header to sort, click a property cell to change it in the note.
- Board: drag a card to another column to change its property; "New column" adds a group.
- Timeline: dates such as `1987`, `1987-03` or `1987-03-12`, negative years, or plain numbers
  such as a story day; notes without a date are listed below.
- Chapter rows read and write the properties of the chapter's folder note and count the words of
  their scenes. Conflict copies, templates and the views themselves are never listed.
- A project without views offers two starting ones: scenes by status on a board, and a table of
  scenes.

## What phase 5 adds

- Export to PDF and EPUB besides DOCX, chosen at the top of the Export page. PDF uses the
  same layout choices as DOCX (standard manuscript or typeset book, page size, font, spacing,
  separators, headings, front and back matter) and is typeset by [Typst](https://typst.app),
  built into the desktop app: nothing to install. Fonts are the system's plus Libertinus Serif
  and New Computer Modern, used when the chosen font is missing. In the browser the PDF cannot
  be made and the Typst source is downloaded instead.
- EPUB 3 (checked with EPUBCheck): one file per part, chapter and page of front and back matter,
  a table of contents with chapters inside their parts; readers choose font and size. The book
  keeps the same identifier across exports (`export.epubId` in `dante.yaml`).
- Statistics section: words, pages (1,800 characters with spaces by default, or a number of
  words: `pages: {unit, size}` in `dante.yaml`, set in the settings), chapters, scenes, reading time;
  words by chapter; how often the scenes name each note of the Story Bible (name or alias, as
  written); the most used words without the commonest ones (English, Italian, Spanish, French).
- Goals in `dante.yaml` (`goals: {words, deadline, daily, days}`): progress, words a day needed
  to finish on time, today's words and days in a row with the daily goal reached; today's words
  also appear in the manuscript's side panel. `days` lists the writing days of the week, 1
  (Monday) to 7 (Sunday): the words needed are spread over those days only, and rest days do
  not break a run.
- Writing log: each person's words added and removed and minutes spent writing, by day, in
  `.dante/sessions/<name>.json` (one file per person, so a shared folder never has two writers);
  the chart shows the last 30 days for everyone, the table each person.

## Properties with a kind

A property can be defined once in `dante.yaml` and then works the same way in every note:

```yaml
properties:
  status:
    kind: text                       # text, number, date, checkbox, list, link
    values: [idea, draft, revised, done]   # text: one of them; list: any of them
  pov:
    kind: link
    note_type: character             # only characters are suggested
  date: date                         # short for { kind: date }
```

- The properties panel shows the right field for each kind: a menu of the allowed values, a
  number, a date picker, a checkbox, toggles for a list, link suggestions limited to a type.
  A value that does not fit is kept as written and flagged.
- The sign before a property's name sets its kind from the panel; Settings lists every definition.
- Values are written as Obsidian writes them (numbers, true/false, YYYY-MM-DD, YAML lists,
  "[[links]]"). A board grouped by a property with allowed values takes them as its columns
  when the view lists none.
- New projects define age, date, place and owner (in the novel's language).

## Title and synopsis

- A scene, chapter or part can have a `title` property (in a chapter's or part's folder note).
  It is the title shown in the tree, the headings, the views, the statistics and the export;
  without it, the title is the one in the file name. The properties panel has both fields:
  the title, and the file name (which renames the file). Renaming from the tree changes the
  title when the item has its own, otherwise the file. `published_title` still wins in the export.
- Every scene, chapter and part has a synopsis field in the panel (`synopsis` property). Views
  show it under each item's name unless their file says `synopsis: false` (⚙ Settings → Synopsis).

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

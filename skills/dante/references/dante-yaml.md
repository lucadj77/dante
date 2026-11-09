# dante.yaml reference

`dante.yaml` holds the book's settings, shared by everyone who opens the folder. Edit only the
keys you are asked about, keep everything else (comments included) exactly as it is, and keep
the file valid YAML. Missing keys take their defaults, so a short file is fine.

Settings that belong to one computer (theme, font of the editor, interface size, spell
checking, backups, the writer's name) are **not** here: they live in the app and you cannot
change them from the project.

## A complete file with the defaults (English project)

```yaml
title: The Return
subtitle: ""
authors: [Ada Rossi]            # one name each, in cover order
language: en                    # the book's language: dictionaries, hyphenation, quotes, labels
folders:
  codex: Story Bible
  research: Research
  laboratory: Laboratory
  manuscript: Manuscript
  views: Views
  templates: Templates
types:                          # Story Bible types, by id (see SKILL.md)
  character: { name: Character, folder: Characters, icon: "👤", properties: [role, age, appearance, aliases] }
  place:     { name: Place, folder: Places, icon: "📍", properties: [region, aliases] }
  object:    { name: Object, folder: Objects, icon: "🗝", properties: [owner] }
  event:     { name: Event, folder: Events, icon: "📅", properties: [date, place] }
  group:     { name: Group, folder: Groups, icon: "👥", properties: [members] }
  plotline:  { name: Plotline, folder: Plotlines, icon: "🧵", properties: [status] }
properties:                     # typed properties (see SKILL.md)
  status: { kind: text, values: [idea, draft, revised, done] }
  pov:    { kind: link, note_type: character }
  age:    { kind: number }
  date:   { kind: date }
  place:  { kind: link, note_type: place }
  owner:  { kind: link, note_type: character }
structure:
  parts: false                  # true: top-level folders of the manuscript are parts
  part:
    numbering: roman            # arabic, roman, words, ordinal, none
    showLabel: true
    label: Part
    showTitle: true
    separator: ": "             # between number and title; "\n" puts the title on its own line
  chapter:
    numbering: arabic
    showLabel: true
    label: Chapter
    showTitle: true
    separator: ": "
    restartEachPart: false
goals:
  unit: words                   # words, or characters (with spaces); also the unit of `goal`
  words: 0                      # length of the finished book, in the unit; 0 = none
  deadline: ""                  # YYYY-MM-DD
  daily: 0                      # per writing day, in the unit
  days: [1, 2, 3, 4, 5, 6, 7]   # writing days, 1 = Monday … 7 = Sunday
cover:
  template: ""                  # generated cover; "" picks one from the title
  palette: ""
  image: ""                     # path of a picture in the project, drawn instead
  show: { title: true, subtitle: true, authors: true }
  textColor: ""                 # #rrggbb; "" = the palette's
  outlineColor: ""              # #rrggbb line around the letters; "" = none
tree:
  dot: ""                       # property colouring the dots in the tree; "" = status
  colors:                       # optional, by property and lower-case value
    pov: { "lucia mondella": "#d064a6" }
pages:
  unit: characters              # what makes a page: characters (with spaces) or words
  size: 1800                    # 1,800 characters is the Italian "cartella"; 250 for words
export:
  format: docx                  # docx, pdf, epub, md: the one chosen last
  epubId: ""                    # keeps the ebook's identity across exports; do not change
  epubCss: ""
  cover: false                  # the book opens with the cover
  docx:                         # layout of DOCX and PDF (EPUB takes structure and headings)
    profile: manuscript         # manuscript (for agents and publishers) or typeset (a book)
    pageSize: a4                # a4, letter, a5, 15x21, 14x21, 13x20, 12x19, 17x24,
                                # 6x9in, 5.5x8.5in, 5x8in, bformat, custom
    pageWidth: 21               # cm, for custom
    pageHeight: 29.7
    font: Times New Roman
    fontSize: 12                # points
    lineSpacing: 2              # 1, 1.5, 2
    indent: 1.27                # first-line indent, cm
    partBreak: pageBreak        # pageBreak, blankLine, twoBlankLines, characters, none
    chapterBreak: pageBreak
    sceneBreak: characters
    sceneSeparator: "#"         # used when sceneBreak is characters; "\n* * *\n" = asterisks between blank lines
    lineSign: \n                # the sign that starts a new line in sceneSeparator
    titlePage: true
    header: true                # author, title and page number (title only in a typeset book)
    scene:                      # headings of scenes in the book; none by default
      numbering: none
      showLabel: false
      label: Scene
      showTitle: false
      separator: ". "
    sceneNumbersRestart: true
    omitSingleSceneHeading: true
  typography:                   # applied to the exported text only (and while typing if asked)
    quotes: keep                # keep (as typed), guillemets «», guillemetsSpaced « »,
                                # guillemetsReversed »«, curly “”, curlySingle ‘’, low „“,
                                # lowPolish „”, swedish ””, dash (— Come — he said),
                                # dashAttached (—Come —he said—)
    dialogueDash: em            # em (—) or en (–), for the dash styles
    apostrophes: true           # ' becomes ’
    ellipsis: true              # ... becomes …
    spaces: true                # double spaces and spaces before punctuation removed
    whileTyping: true
  paratext:                     # texts around the book; empty ones are left out
    dedication: ""
    epigraph: ""
    epigraphSource: ""
    authorNote: ""
    acknowledgements: ""
    colophon: ""
  revisions: accept             # pending CriticMarkup revisions: accept or reject in the export
```

An Italian project has the same keys with Italian names and values where they are the writer's
(`folders`, type names and folders, `stato: {values: [idea, bozza, rivista, finita]}`,
`età`, `data`, `luogo`, `proprietario`, labels `Parte`, `Capitolo`, `Scena`). New Italian
projects measure in characters (`goals.unit: characters`).

`gamebook:` appears only when the module has been turned on; see `references/gamebook.md`.
Its `export` block: `heading` (`number` or `numberTitle`), `prefix` (such as `"§ "`), `align`
(`center`, `left`), `size` (pt), `separator` (`pageBreak`, `blankLine`, `characters`),
`symbol`, `links` (clickable references), `bold`, `boxes` (`color`, `gray`, `none`),
`justify`, `indent` (cm), `spacing` (pt), `boxSize` (pt, 0 = text size), `numberBold`,
`numberItalic`, `numberFont`.

## Typical requests

- **"Number chapters in words, title on the next line"**: `structure.chapter.numbering: words`,
  `separator: "\n"`. Headings are computed; nothing in the manuscript changes.
- **"Group the chapters into parts"**: set `structure.parts: true` and move the chapter folders
  into part folders (`010 Part title/`), each with a folder note. Turning parts on without
  moving folders makes every chapter a part.
- **"I want to write 300,000 characters by March"**: `goals.unit: characters`,
  `goals.words: 300000`, `goals.deadline: 2027-03-31`. When switching units, convert the book
  and daily goals with the manuscript's ratio (about 6 characters per word) and tell the writer
  that scene and chapter `goal` values were not converted.
- **"Send it to a publisher"**: `export.docx.profile: manuscript`, A4, Times New Roman 12,
  double spacing. **"Print a paperback"**: `profile: typeset` and a book `pageSize` such as
  `14x21` or `6x9in`.
- **"Dialogue with Italian dashes in the book"**: `export.typography.quotes: dash`. The files
  keep what the writer typed.
- **"Colour the tree by point of view"**: `tree.dot: pov`.

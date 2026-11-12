# Markup Dante understands

Dante's editor hides Markdown marks and shows the text formatted. Everything below survives the
export to DOCX, PDF, EPUB and Markdown unless said otherwise. Write it exactly as shown, so the
writer sees it formatted in Dante and the book comes out right.

## Paragraphs, line breaks and blank lines

- **Paragraphs** are separated by exactly one empty line. Dante writes and hides that line;
  any extra empty lines are ignored by the book.
- **A visible blank line** (a pause in the text, without starting a new scene) is a paragraph
  holding only `&nbsp;`, with an empty line before and after:

  ```markdown
  …and the door closed.

  &nbsp;

  In the morning the house was silent.
  ```

  A line with only `<br>` or a non-breaking space is read the same way. It is not counted in
  words or characters.
- **A line break inside a paragraph** (verse, a letter's address): end the line with a
  backslash. A plain single newline is joined with a space in the exported book.

  ```markdown
  Nel mezzo del cammin di nostra vita\
  mi ritrovai per una selva oscura
  ```

- **A scene break** inside a scene: a line with only `***`, `---` or `* * *`, between empty
  lines. It is printed as the project's separator.

## Inline styles

`*italic*`, `**bold**`, `==highlight==` (a note to self: exported as plain text), `~~strike~~`,
`` `code` ``. Highlighting is dropped in the export; use bold or italic for emphasis that must
print.

**Footnotes**: `^[the note, written where its number goes]`, or `[^1]` in the text with
`[^1]: the note` on a paragraph of its own in the same scene. They are exported as footnotes
(Word, PDF) or as notes at the end of the chapter (EPUB).

## Alignment

Markdown has no alignment, so a centred or right-aligned paragraph is wrapped in a span, on one
line; Markdown inside it still works:

```markdown
<span style="display:block;text-align:center">*The End*</span>
<span style="display:block;text-align:right">— Lucia, Milan 1629</span>
```

Values: `center`, `right`, `justify`. Do not remove these spans when editing the text.

## Images

```markdown
![[photo.jpg]]                     found by name anywhere in the project
![[photo.jpg|300]]                 300 pixels wide (|300x200 fixes the height too)
![[house.png|The house by the sea|300]]   caption, when the image is alone in its paragraph
![The house by the sea|300](Research/Attachments/house.png)
```

- Image files belong inside the project, normally in `<Research>/Attachments/`. A file outside
  the project, or a web address, does not reach the export: download it into the project
  first.
- An image alone in a paragraph is a figure (with its caption); inside a sentence it stays in
  the line. Wrap it in an alignment span to centre or right-align it.
- Images do not count as words or characters.

## Tables and captions

GitHub-style pipe tables; the line after the table, following an empty line, starting with
`Table:` (`Tabella:`, or just `:`) is its caption:

```markdown
| Character | Who | First scene |
| :--- | :--- | ---: |
| Renzo | silk weaver | The meeting |
| Lucia [[Lucia Mondella\|Mondella]] | his bride | Lucia |

Table: The characters of chapter 1
```

Escape `|` inside a cell (`\|`), including the alias bar of a wikilink.

## Lists

Ordinary Markdown lists: `- item`, `1. item`, `- [ ] task` / `- [x] done`. Indent a nested item
by four spaces.

## Quotes and callouts

A quote is a block of lines starting with `> `. A **callout** is a quote whose first line is
`> [!type] Title`:

```markdown
> [!note] The rules of the city
> Nobody walks the walls after dusk.
> - The gates close at nine.
```

Types such as `note`, `tip`, `info`, `warning`, `danger`, `quote` get their own colour. A callout
exports as a coloured box with the title in bold (the type's name when there is no title);
in Markdown it stays a callout.

## Embedded notes

`![[Note]]` alone on a line shows the note's text in place (read-only in the editor) and puts
it in the exported book; `![[Note#Heading]]` embeds one section, `![[Note#^id]]` the paragraph
ending with ` ^id`. Embedded words count in the export, not in the scene's statistics. Inside a
sentence, `![[Note]]` is just a link. A note that embeds itself is skipped.

## Diagrams

A fenced ```` ```mermaid ```` block in any note or scene is drawn as a diagram in Dante. Useful
for plot maps or family trees in the Laboratory; do not put one in a scene meant for print.

## Headings

Headings (`#`, `##`) inside a scene are exported as headings inside the chapter; use them only
when the writer wants one. Chapter and part headings are never written in the text.

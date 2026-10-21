# What's new in Dante

What changes in each version of Dante, newest first. The same notes appear on the version's page on GitHub and in the update notice inside Dante. In Italian: [Novità](novita.md).

## Next version

- **Visible update check**: at start Dante says for a few seconds that it is up to date, or that it could not check, instead of staying silent. If it stays open it checks again every six hours, and on the Mac there is **Dante > Check for Updates…**.
- **Dialogue in exports**: lines of dialogue typed with dashes or hyphens at the start of the paragraph take the marks of the chosen style (— Come in — she said becomes “Come in” she said). New projects leave dialogue as typed until you pick a style in Export > Typography.

## 0.1.38 · October 20, 2026

- **Safer saving**: closing the window or quitting with Cmd+Q right after typing saves the last words before quitting. If a file cannot be written, Dante says so and tries again instead of losing the text.
- **Fixes**: smart quotes no longer double in revision mode nor break centred paragraphs; splitting a scene no longer leaves the whole text in the first one; merging scenes right after typing no longer loses the last words; Dropbox or Drive conflict copies follow a renamed or trashed scene; a folder called "export" inside Research or the Story Bible no longer disappears; links written as `<https://…>` stay in the export; the EPUB stylesheet saves itself; Esc while renaming a Codex note really cancels.

## 0.1.37 · October 20, 2026

- **Importing from Word**: chapters written as a centred number with the title below become chapters with their title. Empty lines inside a paragraph no longer show code such as `<span style=…>`, and when scenes are separated by `***` empty lines no longer split them.

## 0.1.36 · October 20, 2026

- **macOS 10.15 Catalina**: Dante uses the engine of the updated Safari instead of the Safari 13 one that Catalina gives to apps, with which the window did not open. It is still being tried: if Dante does not start, the start-up report tells what is missing.

## 0.1.35 · October 20, 2026

- **Importing from Word on macOS Catalina**: importing a .docx file now works with Safari 15 too; before, it failed with an error.
- **Report for a problem**: if Dante cannot start, it shows a report to copy instead of an empty window; the same report can be copied from Settings > Report a problem.

## 0.1.34 · October 18, 2026

- **macOS 10.15 Catalina**: Dante now opens on Intel Macs with Catalina, as long as Safari is updated to version 15.6. Before, the window stayed blank. Nothing changes on newer systems.

## 0.1.32 · October 17, 2026

- **Lists**: the text of bulleted, numbered and checkbox list items now hangs after the bullet, number or box, and wrapped lines line up under the text. Nested items go in by one level. Word, PDF and EPUB exports have the same indent; the Markdown export writes Markdown lists.
- **What's new**: with each version, the update notice lists what changes (this page, in English or Italian depending on Dante's language).

# What's new in Dante

What changes in each version of Dante, newest first. The same notes appear on the version's page on GitHub and in the update notice inside Dante. In Italian: [Novità](novita.md).

## Next version

### New

- **Characters with spaces in tables, export and import**: tables and boards have a **Characters** field beside **Words**, and a new project's Scenes table starts with the unit the project measures in. The manuscript's title page and the summary after an export use the same unit. The import preview shows words and characters.
- **Mac menu in the language of the interface**: the items of the menu bar (Check for Updates…, Edit, Window, Dante Help and the others) follow the language chosen in Dante.
- **Full guide in English**: with the interface in English, Help opens the full guide in English, chapter by chapter like the Italian one.
- **Footnotes**: the **x¹** button of the formatting bar inserts a note right where you write it (`^[text]`). In the export it goes at the foot of the page in Word and in the PDF, at the end of the chapter in the EPUB. The notes of an imported Word file stay notes.
- **The novel's names no longer underlined by the spelling checker**: the names and aliases of the Story Bible's cards are no longer marked as mistakes. Other words of the novel are added in Settings > Writing > Words of this novel, and hold on every computer.
- **Snapshot of the whole manuscript**: in Settings > Upkeep you can set a milestone with a name, such as "First draft", for all the scenes together, and later take the whole manuscript back to it.
- **A look for each novel**: in Settings > Look of this novel you can give a novel its own theme, accent colour, font and text layout. The choices stay on this computer and not in the project: those who write with you keep their own look.
- **Undo for moves, splits and merges**: after moving, splitting or merging scenes and chapters, **Undo** appears at the bottom of the tree (also Cmd+Z / Ctrl+Z with the tree active) and puts everything back as it was, links included.
- **Going back to a backup from Dante**: Settings > Backups lists the backups; **Open this backup** takes it out into a new folder beside the novel and opens it, without touching the novel as it is now.
- **One property for several scenes**: choose several scenes in the tree (Cmd/Ctrl+click), then right click > **Set a property on the scenes…** to give all of them the same value, for example the status.
- **Table of contents in Word and PDF**: in Export the box **Table of contents** adds the contents of parts and chapters with the page numbers, after title page, dedication and epigraph.
- **Saved export profiles**: the choices of Export are saved under a name ("For the publisher", "For print") and taken up again from a list, without setting them every time.

### Changed

- **Settings rearranged**: instead of the two tabs there is a list of pages on the left, divided between "This novel" and "Dante on this computer", with a box to search for a setting. Themes are chosen from small drawings of the window, and structure, tree colours, page and editor text have a preview beside them.
- **Tidier guide**: the chapter on gamebooks is divided into groups (setting up, reading, writing, numbering, checking, exporting) and the details for those who develop Dante have left the guide.
- **More compact bars above the text**: in the Manuscript the command bars take fewer rows. In a narrow window the buttons show only their icon (the name stays in the tooltip), "Split into scene" and "Split into chapter" become icons and the text size moves into the **More** menu.
- **Windows that answer the keyboard at once**: Trash, Move to…, conflicts, snapshot comparison, import and the gamebook windows take the keyboard as soon as they open: Esc closes them without a click first, Tab stays inside the window and closing takes you back where you were.
- **Names in the bar of the sections**: in a wide window the bar on the left starts with the names beside the icons; **Hide names**, at the bottom, takes it back to the icons alone.
- **Clearer words**: "tree", "card", "link" and "Resolved" are used the same way everywhere; in Italian, "Citazioni" in Statistics becomes "Menzioni" and the type "Plotline" of new projects is called "Trama".
- **Fewer repeated numbers**: with a single scene on screen the Properties panel and the status bar do not write the same number twice, and "Today" stays only in the status bar when it is visible.
- **Boards**: the columns share the space when they are few, and **Delete this view** is inside the settings of the view instead of always in sight.
- **Scene and chapter goals converted**: when you switch between words and characters, Dante also lists the goals of single scenes and chapters with the value they would have and converts them all with one click.
- **The name, asked at once**: those who open a project without having written their name yet are asked for it once, at the first opening, so that comments, revisions and the day's count start at once.

### Fixed

- **The same number everywhere**: with revisions pending, the Properties panel, the tables and the writing log also counted the deleted text and the revision marks. They now count as the Statistics do: added text counts, deleted text does not.
- **Interrupted moves**: if Dante closed while it was reordering scenes or chapters, some files kept a temporary name and no longer showed in the tree. Dante now puts the files back or finishes the move when the project is opened again, and says so in a notice.
- **Guide**: the chapter on installing, the name of the setting "A single Enter starts a new paragraph" and the names of the Mac menu items are corrected.

## 1.2.0-beta.3 · November 10, 2026

### Fixed

- **Moving several times from the keyboard**: in the manuscript tree Ctrl+Alt+arrow (Cmd+Option+arrow on a Mac) moves the scene one place at each press, without clicking on it every time.

## 1.2.0-beta.2 · November 10, 2026

### New

- **Move to… and Copy to…**: right-click a scene, chapter, note or folder (Story Bible cards too) to move or copy it to another section or to a precise place in the manuscript, chosen from a window with the tree and a search box, without dragging.
- **Updated skill for AI agents**: the skill in `skills/dante` now also covers gamebooks, views, properties for all scenes, the trash, blank lines, callouts and every setting of the novel, and its script counts words and characters with spaces as Dante does.
- **Gamebooks in English**: in an English gamebook Dante reads the game state from sentences such as “Note the keyword…” and “If you have…”, finds numbers written by hand such as “turn to 12”, gives the boxes properties with English names (traits, keywords, encounters), calls the graph note “Gamebook graph” and leaves the words before references alone (articles are corrected only in Italian books).

### Fixed

- **Callouts in the export**: blocks that start with `> [!note] Title` become a coloured frame with the title in bold in Word, PDF and EPUB; before, they came out as quotes starting with “!note”. In exported Markdown they stay callouts.

## 1.2.0-beta.1 · November 9, 2026

### New

- **Callouts**: `> [!note]`, `> [!warning]` and similar blocks show their name in a coloured pill; lists and tables inside them show as in the rest of the text.
- **Gamebooks**: a project can become a gamebook (Settings > Gamebook). The tree shows the paragraphs in order of number, with warnings, lengths and where each comes from and leads; references read as numbers and boxes as coloured frames; the Paragraph panel sums up each paragraph and changes its number, type and ending, updating the references; rules and other pages without a number (Page button at the top of the tree) sit before or after the paragraphs. Writing is quick: `[[` finds or creates a paragraph (the two entries that create one come first in the list) and writes the reference with the right Italian article, Cmd/Ctrl+Enter opens the new paragraph window (free, fixed or relative number, reference in the text or hidden), the Paragraph button on the bar opens the same window, the Box button inserts the book's boxes and writes their value in the properties. The export puts the paragraphs in order under their number and the boxes in coloured frames, and warns about broken references. The Reorder button numbers the paragraphs in sequence in reading order; the Paragraph button in the tree creates a paragraph without a reference. The Shuffle button gives new random numbers with a preview, keeping fixed paragraphs and moving relative ones with their anchor, updates references and articles and can be undone, even just for the numbers; the Graph button writes a note with the map of the book, to look at full screen as well. The Gamebook section has the table of the paragraphs, to sort and filter, the checks of the whole book (orphans, dead ends, broken references and game state: values asked for with a question mark that the reader cannot have yet) and the register of traits, keywords and encounters with likely duplicates; the status bar tells how many problems there are. In the export the Gamebook section takes the place of parts, chapters and scenes: paragraph heading, what parts paragraphs, boxes in colour, grey or plain, and clickable references in Word, PDF and EPUB. The paragraphs' text can be set: justified or left, indent, space between paragraphs, size of the text in boxes, number in bold or italics and in a font of its own.
- **Interface size**: in Settings > Dante on this computer > Appearance you can enlarge the whole Dante window, from 80% to 200%: menus, panels, buttons and their text, not just the text in the editor.

### Changed

- **Mermaid diagrams**: ```` ```mermaid ```` blocks in notes and scenes show as drawings, with a button to see them full screen.

### Fixed

- **Right-click menu**: on the last items of a panel the menu opens higher up and stays fully visible.
- **Tooltips**: the hints that appear over an item now open above it, so the pointer does not cover them.

## 1.1.4 · October 28, 2026

### Fixed

- **Picture on Story Bible cards**: a picture added to an entry now shows on its card right away, without reopening the Story Bible.

## 1.1.3 · October 28, 2026

### New

- **Column width in views**: in tables drag the right edge of a heading to change the column's width; in a grouped timeline do the same on a column's title. Double-click the edge to go back to automatic widths. The widths are saved with the view.

### Fixed

- **Timeline too wide**: in 1.1.2 the columns of a grouped timeline grew as wide as their longest text; now they fit the window as before.

## 1.1.2 · October 28, 2026

### Fixed

- **Fixed header in Tables and boards**: while a view scrolls, its name, buttons and settings stay at the top, and so do the column names of the table and of the board.

## 1.1.1 · October 28, 2026

### Fixed

- **End of a paragraph with hidden blank lines**: the End key (Cmd+→ on Mac) and a click after the end of a paragraph put the cursor at the end of the paragraph, no longer in the invisible blank line or at the start of the next paragraph.

## 1.1.0 · October 28, 2026

### New

- **How Story Bible pictures look**: on the Story Bible board, **Look** next to Pictures chooses whether the picture sits across the top of the card or beside the title, cropped or whole, which part to keep (the top, for portraits) and how big it is.
- **Cover and subtitle when creating**: when creating a new novel you can write the subtitle and pick a picture of your own for the cover, without going through Settings.
- **Rename a property everywhere**: in the Properties panel, opening a property's definition, **Rename** changes its name in every scene and note, in the views and in the settings.
- **Properties for every scene**: when creating a property, choose whether it is for the open scene only or for every scene of the novel; in the other scenes it shows up ready to fill in.
- **Dot colours**: when a property colours the dots of the tree (for example the point of view), its definition shows the colour of each value and lets you change it.
- **Story Bible mentions**: names and aliases of Story Bible entries written in the text get a dotted underline. Right-click shows the entry and lets you open it or turn the name into a link. The **Names** button in the toolbar turns them on and off; the Links panel lists them separately.
- **History of comments and revisions**: in the Comments tab, **History** shows who accepted, rejected or closed what and when, with the text before and after, for the scene or the whole novel, filtered by person and dates.
- **Question about blank lines**: when you leave more empty lines between two paragraphs than usual, Dante asks whether you want a real blank line, one that shows in the book too. Turn it off with **Don't ask again** or in Settings > Appearance.
- **Pictures on Story Bible cards**: on the Story Bible board the cards show their first picture; the **Pictures** box hides them.
- **Scene separator over several lines**: in export, between scenes, there is also **Two blank lines**, and in your own separator each `\n` starts a new line: `\n* * *\n` puts three asterisks between two blank lines.
- **Cmd+W closes the project**: when the cursor is not in a side pane, Cmd+W (Ctrl+W on Windows and Linux) closes the project and goes back to the start screen; with the cursor in a pane it closes the pane, as before. In the web version use Alt+Cmd+W, since Cmd+W closes the browser tab.

### Changed

- **A single Enter for a new paragraph**: Enter starts a new paragraph and the empty line that separates paragraphs in the file is no longer shown: only the space between paragraphs remains, the arrows skip it and Backspace at the start of a paragraph joins it to the one before. Enter twice in a row leaves a blank line that shows in the book too (¶); Shift+Enter starts a new line in the same paragraph. It can be turned off in Settings > Appearance.
- **Names button**: it has a new icon, a person above a dotted line, that no longer looks like the others; the menu of a recognised name reminds you that the button turns the names off.
- **Tidier Properties panel**: the panel is split into sections that fold and unfold with a click; **+ New** under the heading opens the form to add a property, and the more visible symbol before a name opens its definition.
- **Add buttons on one row**: Scene, Chapter, Part and Import always fit on a single row.

### Fixed

- **Card previews**: a picture at the start of the text no longer shows as "!" followed by the file name.
- **Attachments shown at once**: the first image added to a novel creates the Attachments folder inside Research, and now the folder shows at once in the Notes section, without reopening the project.
- **Readable update notice**: in the notice of a new version the text and the news take the whole width, with the three buttons below; before, they were squeezed into a narrow column.

## 1.1.0-beta.3 · October 28, 2026

### Changed

- **A single Enter for a new paragraph**: Enter starts a new paragraph and the empty line that separates paragraphs in the file is no longer shown: only the space between paragraphs remains, the arrows skip it and Backspace at the start of a paragraph joins it to the one before. Enter twice in a row leaves a blank line that shows in the book too (¶); Shift+Enter starts a new line in the same paragraph. It can be turned off in Settings > Appearance.

## 1.1.0-beta.2 · October 28, 2026

### New

- **How Story Bible pictures look**: on the Story Bible board, **Look** next to Pictures chooses whether the picture sits across the top of the card or beside the title, cropped or whole, which part to keep (the top, for portraits) and how big it is.

### Changed

- **Names button**: it has a new icon, a person above a dotted line, that no longer looks like the others; the menu of a recognised name reminds you that the button turns the names off.

## 1.1.0-beta.1 · October 28, 2026

### New

- **Cover and subtitle when creating**: when creating a new novel you can write the subtitle and pick a picture of your own for the cover, without going through Settings.
- **Rename a property everywhere**: in the Properties panel, opening a property's definition, **Rename** changes its name in every scene and note, in the views and in the settings.
- **Properties for every scene**: when creating a property, choose whether it is for the open scene only or for every scene of the novel; in the other scenes it shows up ready to fill in.
- **Dot colours**: when a property colours the dots of the tree (for example the point of view), its definition shows the colour of each value and lets you change it.
- **Story Bible mentions**: names and aliases of Story Bible entries written in the text get a dotted underline. Right-click shows the entry and lets you open it or turn the name into a link. The **Names** button in the toolbar turns them on and off; the Links panel lists them separately.
- **History of comments and revisions**: in the Comments tab, **History** shows who accepted, rejected or closed what and when, with the text before and after, for the scene or the whole novel, filtered by person and dates.
- **Question about blank lines**: when you leave more empty lines between two paragraphs than usual, Dante asks whether you want a real blank line, one that shows in the book too. Turn it off with **Don't ask again** or in Settings > Appearance.
- **Pictures on Story Bible cards**: on the Story Bible board the cards show their first picture; the **Pictures** box hides them.
- **Scene separator over several lines**: in export, between scenes, there is also **Two blank lines**, and in your own separator each `\n` starts a new line: `\n* * *\n` puts three asterisks between two blank lines.

### Changed

- **Tidier Properties panel**: the panel is split into sections that fold and unfold with a click; **+ New** under the heading opens the form to add a property, and the more visible symbol before a name opens its definition.
- **Add buttons on one row**: Scene, Chapter, Part and Import always fit on a single row.

### Fixed

- **Card previews**: a picture at the start of the text no longer shows as "!" followed by the file name.

## 1.0.0 · October 27, 2026

### New

- **Dante 1.0 and two update channels**: Dante moves to version numbers 1.0, 1.1, 1.2... In Settings > Dante on this computer > Updates choose the channel: **Stable** (the default) gets only the official versions, **Beta** gets the new features first, in versions still being tried. Whoever installs a beta stays on the Beta channel until they change it.
- **Skip this version**: the update notice also has **Skip this version**, which the automatic checks no longer offer (Check for updates still shows it). **Later** is now called **Remind me later**.
- **Scrivener: research and characters too**: importing from Scrivener now brings the other folders as well as the novel. For each folder you choose whether it goes into the Story Bible (characters, places…) or among the notes, in Research or the Laboratory; Dante suggests the likely choice. Texts become notes with their synopsis, PDFs and pictures are copied.

## 0.1.49 · October 27, 2026

- **Dante's website and a new address for the web version**: Dante has a website, https://dante.lucadj.eu, with screenshots, downloads for every system and, soon, video tutorials. The web version moves to https://dante.lucadj.eu/app/ (the latest official version) and https://dante.lucadj.eu/beta/ (the latest trial one). If you used the old address, open the new one, install Dante from the browser again if you had installed it, and reopen your novels' folders: the texts do not change, the recent list and the settings do.

## 0.1.46 · October 26, 2026

- **Cover with a picture of yours**: in Settings > Cover you can use a photo or drawing of yours instead of the shapes, choose whether to show title, subtitle and authors, and change the colour of the text and of its outline. The cover is shown among recent projects and at the start of Word, PDF and EPUB.
- **Tree dots**: hovering over the dot beside a scene shows its stage, for example "Stage: draft". In Settings > Scene tree the dots can be coloured by another property, such as the point of view.
- **Statistics to the right spot**: a click on a repetition or a long sentence opens the scene at that point and selects the passage.
- **Shortcuts for Windows and Linux**: the guide and the first steps give every shortcut for both Mac and Windows and Linux (for example Cmd+F / Ctrl+F). On Windows and Linux the button tips now read Ctrl+click and Ctrl+Enter correctly.
- **Clearer Scrivener import**: when the chosen `.scriv` is an empty file or not a Scrivener project, Dante says so and explains what to choose, instead of a technical error such as "Not a directory". A `.scriv` packed into a single file is imported like a zip.
- **New project says what is missing**: pressing Create or Import before choosing where to save the project now tells you so instead of leaving the button grey; errors show beside the button, which reads "Importing…" while it works.
- **Scrivener without odd marks**: the marks of Scrivener's styles, such as `<$Scr_Ps::0>`, no longer show at the start of imported scenes.
- **Dialogue as typed in new projects**: a new novel exports dialogue with the marks it is written with, even if you chose guillemets for another novel. The other choices of your last export are still the starting point.

## 0.1.45 · October 26, 2026

- **Find in the scene**: Cmd+F opens a bar to find a word in the open scene or note, with Enter to go to the next one.
- **Find and replace in the whole novel**: Alt+Cmd+F, or the **Replace** tab of the search, changes a word in every note, for example a character's name. You see every occurrence first, choose which to change, and can undo. Properties, links, images and comments are left alone, and each scene is saved in a snapshot before the change.
- **Trash**: the icon at the bottom of the left bar shows what you deleted, puts it back where it was or deletes it for good.
- **Backups**: when you close a project Dante saves a zip copy of it in Documents/Dante backup, outside the novel's folder, and keeps the 10 most recent. Folder and number can be changed in Settings; in the browser a button downloads the zip.
- **Window remembered**: Dante reopens with the size and position it had.
- **Fix**: word goals saved in Statistics no longer erase those a co-author changed meanwhile.
- **Help inside Dante**: the question mark icon in the left bar opens the first steps, the full guide and what's new, readable without a connection. On the Mac there is also the Help menu (Cmd+?).
- **New projects ready to use**: every new novel already has the scene status (idea, draft, revised, done), the point of view, and a board and a table of the scenes. The first empty scene explains in three lines how to start.
- **Simpler settings**: two tabs, This novel and Dante on this computer, and no Save button: every change saves itself. The novel's language is picked from a menu.
- **Tidier manuscript bar**: it fits on one row; formatting bar, scene cards, revisions and Markdown text are in the More menu.
- **Notes section**: Research and Laboratory are now one section, with the two folders one below the other. Views is now called Tables and boards.
- **Clearer errors**: when something fails Dante explains it in a plain sentence; the technical message is behind Details.
- **Fix**: on an Italian keyboard Cmd+Shift+7 inserted a comment instead of starting a numbered list; now Cmd+Shift+7, 8, 9 and . do what they should.
- **Stage and goals in the tree**: beside each scene a coloured dot shows its stage (idea, draft, revised, done). A scene or chapter can have a word goal, in the Properties panel: the tree shows a small bar that turns green when you reach it.
- **Status bar**: under the text the words of the scene, of the selection, of the chapter and of today, always in sight. It can be hidden from the More menu.
- **Writing sessions**: from the status bar, a timer of 10 to 90 minutes with a number of words to reach, if you like. At the end Dante tells you how many words you wrote.
- **Template of new scenes**: in Settings choose the properties and the text every new scene starts with, for example the stage «idea» and a few questions.
- **Style in the statistics**: average sentence length, long sentences, adverbs, share of dialogue and words repeated close together, with examples that open the scene.
- **Import from Scrivener**: from the start screen, a Scrivener project becomes a Dante project with chapters, scenes and synopses, after the same preview as Word.
- **Measure in characters**: in Statistics > Goals choose whether to count words or characters with spaces. The choice applies to goals, status bar, tree, panel, writing sessions and chart, and goals already set are converted. New Italian projects start with characters.
- **Themes and accent colour**: besides light and dark there are Sepia and Night, and you can choose the colour of buttons and links. The system theme now changes along with the computer.
- **Text like a book**: in Settings > Dante on this computer choose line spacing, space between paragraphs, first-line indent, justified text and any installed font, with a sample below.
- **Spelling checker**: it can be turned off, and it is told the novel's language.

## 0.1.44 · October 21, 2026

- **Fix**: version 0.1.43 (and 0.1.42) opened with a blank window after updating. If you installed it, download the new version by hand once: the broken one cannot update itself.

## 0.1.43 · October 21, 2026

- **Blank lines between paragraphs**: the **¶** button on the formatting bar, or Alt+Enter, leaves a blank line after the paragraph without starting a new scene. The editor shows it as a faint **¶**; in Word, PDF, EPUB and Obsidian it is an empty line. In the file it is a paragraph holding only `&nbsp;`. When importing from Word you can keep empty lines as they are, or keep a single one by clicking it in the preview and marking it as text. An empty line that would leave a scene of one or two paragraphs stays a blank line instead of starting a scene.

## 0.1.42 · October 21, 2026

- **Dante in the browser**: Dante can also be used from Chrome, Edge or Brave, with nothing to install, at https://lucadj77.github.io/dante/. It works on the files of the novel's folder, works offline after the first visit and never sends your writing online. No PDF yet, and a few other limits described in chapter 18 of the guide.
- **Importing from Word with a preview**: before importing you see the document next to the result and can say line by line what it is (part, chapter or scene title, scene break, text, leave out), for all similar lines at once too. Sections divided only by a number on its own line ("1", "2", "3"…) become chapters instead of scenes holding just the number. With the **Import** button in the manuscript you can add a Word file to a project already under way, such as a novel split into several files.
- **Visible update check**: at start Dante says for a few seconds that it is up to date, or that it could not check, instead of staying silent. If it stays open it checks again every six hours, and on the Mac there is **Dante > Check for Updates…**.
- **Dialogue in exports**: lines of dialogue typed with dashes or hyphens at the start of the paragraph take the marks of the chosen style (— Come in — she said becomes “Come in” she said). New projects leave dialogue as typed until you pick a style in Export > Typography.
- **Skill for AI agents**: an instruction file in English, in the repository's `skills/dante` folder, teaches an AI assistant how to read and change a Dante project without breaking it (scene order, folder notes, links, comments and revisions).

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

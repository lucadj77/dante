# Video tutorials

Short silent tutorials in Italian and English, made the same way as those of Stella: a box around the element with a large text beside it, section titles, zoom, a pretend pointer, an opening and a closing cover, fades and generated ambient music. The Italian video uses the Italian interface and *I promessi sposi*, the English one the English interface and *Pride and Prejudice*; the labels on screen come from `src/lib/i18n`. The list of videos and their outlines is in a Claude Doc shared with Luca; each video is a script in `videos/`.

```sh
npm run dev -- --port 5173          # in another terminal
cd scripts/tutorials
python3 assets/make.py              # only if the Word and Scrivener files in assets/ change (needs python-docx)
node run.mjs 7 it                   # frames and timeline.json in out/07-scrivere-una-scena-it
python3 build.py out/07-scrivere-una-scena-it   # video.mp4 and thumbnail.jpg there
```

- `lib.mjs` opens Chromium at 1440×810 with a scale of 4/3, so each frame is 1920×1080, and gives the scripts `focus`, `say`, `title`, `zoom`, `click`, `type`, `drag` and the labels of the interface (`L(key)`). Text stays on screen for a time that grows with its length. The desktop welcome, with recent projects, comes from a pretend Tauri; folder pickers return folders in the browser's private storage.
- `FAST=1` runs a script quickly without saving frames, to check it works; `SHOT=page.png` saves the page where a script stops on an error. `TRACE=1` prints the page's console.
- `cover.mjs` draws the covers with the author's name, `music.py` the music (the video number picks the chords), `build.py` joins covers, recording and music into an H.264/AAC mp4. The opening cover is also the YouTube thumbnail.
- Shortcuts are shown as on a Mac (⌘); the text on screen gives Ctrl for Windows and Linux. Dialogs of the system do not appear in the recording: a text says what is chosen.

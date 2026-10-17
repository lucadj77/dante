# Presentation video

A video of about three minutes that shows Dante's main features, recorded from the app in the browser with the English sample project (*Pride and Prejudice*). The scenes, their captions and the subtitles in English and Italian are in `scenes.json`.

```sh
npm run dev -- --port 5173                         # in another terminal
cd scripts/video
pandoc lighthouse.md -o "The Lighthouse.docx"      # the Word file for the import scene
node rec.mjs                                       # frames in frames/, scene times in timeline.json
mkdir -p out && python3 build.py out               # out/dante.mp4, out/dante-en.srt, out/dante-it.srt
```

`rec.mjs` draws a mouse pointer and the caption of each scene over the page, since headless Chromium shows neither. Frames come from the browser's screencast and `build.py` turns them into a 1920×1080, 30 fps video with ffmpeg; the subtitles follow the scene times. Set `PLAYWRIGHT` to the path of an installed `playwright/index.mjs` if the import fails.

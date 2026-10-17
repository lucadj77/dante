# Screenshots of the user guide

The images in `docs/img` are taken from the app in the browser, with the sample project in Italian.

```sh
npm run dev -- --port 5173                     # in another terminal
cd scripts/screenshots
mkdir -p shots && pandoc il-faro.md -o "shots/Il faro.docx"   # the Word file for chapter 3
node start.mjs && node sections.mjs            # raw shots in shots/; a name (start.mjs tabella) redoes one
python3 finalize.py                            # crops, shrinks and writes docs/img
```

Playwright and Chromium are not dependencies of Dante: set `PLAYWRIGHT` to the path of an installed `playwright/index.mjs` if the import fails. The pages pretend to be on a Mac, so shortcuts read ⌘ as in the guide.

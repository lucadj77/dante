# Screenshots of the user guide

The images in `docs/img` are taken from the app in the browser, with the sample project in Italian.

```sh
npm run dev -- --port 5173                     # in another terminal
cd scripts/screenshots
mkdir -p shots && pandoc il-faro.md -o "shots/Il faro.docx"   # the Word file for chapter 3
node start.mjs && node sections.mjs && node recent.mjs            # raw shots in shots/; a name (start.mjs tabella) redoes one
python3 finalize.py                            # crops, shrinks and writes docs/img
```

The English guide has its own images in `docs/img/en`, from the same scripts with `GUIDE_LANG=en` (English interface and sample, the Word file of the tutorials; raw shots in `shots-en/`):

```sh
GUIDE_LANG=en node start.mjs && GUIDE_LANG=en node sections.mjs && GUIDE_LANG=en node recent.mjs
GUIDE_LANG=en python3 finalize.py
```

Playwright and Chromium are not dependencies of Dante: set `PLAYWRIGHT` to the path of an installed `playwright/index.mjs` if the import fails. The pages pretend to be on a Mac, so shortcuts read ⌘ as in the guide.

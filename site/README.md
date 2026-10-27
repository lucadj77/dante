# The presentation site

<https://dante.lucadj.eu/> presents Dante, offers the latest official version for the visitor's
system (read from GitHub's latest release), the video tutorials and links to the guide and the
news. English at the root, Italian in `it/`. The web version of Dante sits beside it: the latest
official version in `app/`, the latest build of main in `beta/`. The layout follows Luca's other
site, <https://stella.lucadj.eu/> (repository lucadj77/stella, folder `site/`).

- `template.html`: the page, with `{{key}}` placeholders filled from `texts.mjs`.
- `texts.mjs`: every text in both languages, and the list of videos (`videos`: number, group,
  minutes, title and description per language, YouTube address per language; a video appears
  only once it has an address, until then the section says the videos are coming).
- `style.css`, `site.js`: style, enlarged screenshots and the download buttons. `fonts/`: Lora
  and Nunito Sans (SIL Open Font License, from @fontsource), served by the site itself.
- `img/en`, `img/it`: the screenshots, taken from the app with the sample project by
  `node site/shots.mjs` (with `npm run dev -- --port 5173` running) and made smaller by
  `python3 site/shrink.py`. The guide's labelled images are a different set, in `docs/img`.
- `build.mjs <folder>`: builds the site in the folder. `.github/workflows/web.yml` does it,
  builds the two web versions beside it and publishes everything on GitHub Pages.

To see the site locally: `node site/build.mjs /tmp/pages && python3 -m http.server -d /tmp/pages`
(opened as file:// the download buttons cannot ask GitHub).

## Domain

The site answers at `dante.lucadj.eu`: a CNAME record `dante` → `lucadj77.github.io` in the DNS
of `lucadj.eu` (Hostinger) and the custom domain in the repository's Pages settings (Settings →
Pages → Custom domain, with Enforce HTTPS). Publishing through GitHub Actions needs no `CNAME`
file. The old address `lucadj77.github.io/dante/` redirects to the new one; web.yml reads the
base path from Pages, so without a custom domain the copies of Dante are built for
`/dante/app` and `/dante/beta`.

## Privacy

The site uses no cookies, stores nothing in the browser and counts no visits, so it needs no
banner. Fonts and video covers are inside the site: a visitor contacts YouTube only by opening
a video, which is a plain link. The only other request is the one to GitHub's API for the latest
version to download.

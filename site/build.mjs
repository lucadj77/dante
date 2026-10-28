// Builds the presentation site in a folder: index.html (English), it/index.html (Italian), style,
// script, fonts and images. Usage: node site/build.mjs <output folder>
// The web version of Dante goes beside it, in app/ and beta/ (.github/workflows/web.yml).
import { cpSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { playlists, texts, videos } from './texts.mjs'

const here = new URL('.', import.meta.url).pathname
const out = process.argv[2]
if (!out) throw new Error('usage: node site/build.mjs <output folder>')
const template = readFileSync(`${here}template.html`, 'utf8')
const esc = (s) =>
  String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
// flags in the language button, drawn here so as not to depend on the system's emoji
const FLAGS = {
  it: '<svg class="flag" viewBox="0 0 3 2" width="21" height="14" aria-hidden="true"><rect width="1" height="2" fill="#009246"/><rect x="1" width="1" height="2" fill="#fff"/><rect x="2" width="1" height="2" fill="#ce2b37"/></svg>',
  en: '<svg class="flag" viewBox="0 0 60 30" width="21" height="14" aria-hidden="true"><clipPath id="f"><rect width="60" height="30"/></clipPath><g clip-path="url(#f)"><rect width="60" height="30" fill="#012169"/><path d="M0 0l60 30M60 0L0 30" stroke="#fff" stroke-width="6"/><path d="M0 0l60 30M60 0L0 30" stroke="#c8102e" stroke-width="2"/><path d="M30 0v30M0 15h60" stroke="#fff" stroke-width="10"/><path d="M30 0v30M0 15h60" stroke="#c8102e" stroke-width="6"/></g></svg>'
}
// line icons of the features, in the feature's colour (currentColor)
const icon = (d) =>
  `<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`
const ICONS = [
  // scenes: pages one on another
  icon('<path d="M8 3h9l3 3v12H8z"/><path d="M17 3v3h3"/><path d="M4 7v14h11"/><path d="M11 10h6M11 14h6"/>'),
  // Story Bible: a person beside a card
  icon('<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2.5"/><path d="M5 17c.8-2.2 2.2-3.2 4-3.2s3.2 1 4 3.2"/><path d="M15 9h3M15 13h3"/>'),
  // board: three columns of cards
  icon('<rect x="3" y="4" width="5" height="8" rx="1"/><rect x="10" y="4" width="5" height="12" rx="1"/><rect x="17" y="4" width="4" height="6" rx="1"/><path d="M3 20h18"/>'),
  // statistics: bars and a goal line
  icon('<path d="M4 20V12M9 20V8M14 20v-6M19 20V5"/><path d="M3 6h18" stroke-dasharray="2 2"/>'),
  // together: two people
  icon('<circle cx="8" cy="9" r="3"/><circle cx="16.5" cy="10" r="2.5"/><path d="M3 19c.8-3 2.6-4.5 5-4.5s4.2 1.5 5 4.5"/><path d="M14 15.2c.7-.5 1.6-.7 2.5-.7 2 0 3.4 1.3 4 4.5"/>'),
  // from Word to the book: an arrow into an open book
  icon('<path d="M12 7c-2-1.5-4.5-2-8-2v13c3.5 0 6 .5 8 2 2-1.5 4.5-2 8-2V5c-3.5 0-6 .5-8 2z"/><path d="M12 7v13"/>')
]
// icons of the section on local files: computer with a lock, document, folder with an arrow
const LOCAL_ICONS = [
  icon(
    '<rect x="2" y="4" width="20" height="13" rx="2"/><path d="M8 21h8M12 17v4"/><rect x="9" y="10" width="6" height="4" rx="1"/><path d="M10.5 10V8.5a1.5 1.5 0 0 1 3 0V10"/>'
  ),
  icon('<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4"/><path d="M9 12h6M9 16h6"/>'),
  icon(
    '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M9 14h6M13 11.5 15.5 14 13 16.5"/>'
  )
]
// ornament of the sections: the nib of the logo between two rules
const ORNAMENT =
  '<svg class="ornament" viewBox="0 0 92 18" width="92" height="18" aria-hidden="true"><path d="M0 9h34M58 9h34" stroke="currentColor" stroke-width="1.5" opacity=".45"/><path d="M46 1l7 9-7 7-7-7z" fill="#8e2a2a"/><circle cx="46" cy="10" r="1.6" fill="#f4ead6"/></svg>'

mkdirSync(`${out}/it`, { recursive: true })
for (const f of ['style.css', 'site.js']) cpSync(`${here}${f}`, `${out}/${f}`)
for (const d of ['fonts', 'img']) cpSync(`${here}${d}`, `${out}/${d}`, { recursive: true })
// hidden page with the download counts of the releases (no link from the site, noindex)
cpSync(`${here}dcount`, `${out}/dcount`, { recursive: true })

// covers of the videos copied into the site while building: visitors download nothing from
// YouTube until they open a video. If the download fails, YouTube's address stays.
const ytId = (url) => (url.match(/(?:v=|youtu\.be\/)([\w-]+)/) || [])[1]
const thumbs = {}
mkdirSync(`${out}/img/yt`, { recursive: true })
for (const id of videos.flatMap((v) => Object.values(v.url).map(ytId)).filter(Boolean)) {
  try {
    // maxresdefault is 16:9 like the cover; hqdefault is 4:3 with two black bands, only when the other is missing
    let res = await fetch(`https://i.ytimg.com/vi/${id}/maxresdefault.jpg`)
    if (!res.ok) res = await fetch(`https://i.ytimg.com/vi/${id}/hqdefault.jpg`)
    if (!res.ok) throw new Error(res.status)
    writeFileSync(`${out}/img/yt/${id}.jpg`, Buffer.from(await res.arrayBuffer()))
    thumbs[id] = `img/yt/${id}.jpg`
  } catch (e) {
    console.warn(`cover of ${id} not downloaded (${e.message}): YouTube's stays`)
  }
}

// one group per key of tutorial.groups, only with the videos already on YouTube; empty groups do not appear
function videoGroups(lang, t) {
  const ready = videos.filter((v) => v.url[lang])
  if (!ready.length) return `<p>${esc(t.tutorial.soon)}</p>`
  return Object.entries(t.tutorial.groups)
    .map(([key, [title, text]]) => {
      const items = ready.filter((v) => v.group === key).sort((a, b) => a.n - b.n)
      if (!items.length) return ''
      const cards = items
        .map((v) => {
          const id = ytId(v.url[lang])
          const thumb = id
            ? `<img src="${thumbs[id] ? t.root + thumbs[id] : `https://i.ytimg.com/vi/${id}/maxresdefault.jpg`}" alt="" loading="lazy">`
            : esc(v[lang])
          return `<a class="video" href="${esc(v.url[lang])}"><div class="thumb">${thumb}</div><div class="meta"><h4><span class="num">${v.n}</span> ${esc(v[lang])}</h4><span>${v.minutes} min</span></div><p>${esc(v.about[lang])}</p></a>`
        })
        .join('\n')
      // an accordion: with the same name one group opens at a time; Start here starts open
      const count = `${items.length} ${lang === 'en' && items.length > 1 ? 'videos' : 'video'}`
      return `<details class="video-group${key === 'start' ? ' start' : ''}" name="video-groups"${key === 'start' ? ' open' : ''}><summary><h3>${esc(title)} <span class="count">(${count})</span></h3><p class="group-text">${esc(text)}</p></summary><div class="videos">${cards}</div></details>`
    })
    .join('\n')
}

const raw = new Set(['features.items', 'local.items', 'shots.items', 'videos', 'playlist', 'downloadJson', 'flag', 'ornament'])
for (const lang of ['en', 'it']) {
  const t = texts[lang]
  const data = {
    ...t,
    flag: FLAGS[t.otherLang],
    toTop: lang === 'it' ? 'Torna a inizio pagina' : 'Back to top',
    zoomClose: lang === 'it' ? 'Chiudi' : 'Close',
    releases: 'https://github.com/lucadj77/dante/releases',
    installHref:
      lang === 'it'
        ? 'https://github.com/lucadj77/dante/blob/main/docs/beta.md#installare-dante'
        : 'https://github.com/lucadj77/dante/blob/main/docs/first-steps.md',
    ornament: ORNAMENT,
    'features.items': t.features.items
      .map(
        ([h, p], i) =>
          `<div class="feature"><div class="icon">${ICONS[i] ?? ''}</div><h3>${esc(h)}</h3><p>${esc(p)}</p></div>`
      )
      .join('\n'),
    'local.items': t.local.items
      .map(
        ([h, p], i) =>
          `<div class="local-item"><div class="icon">${LOCAL_ICONS[i]}</div><div><h3>${esc(h)}</h3><p>${esc(p)}</p></div></div>`
      )
      .join('\n'),
    'shots.items': t.shots.items
      .map(
        ([f, c]) =>
          `<figure><img class="zoomable" src="${t.img}${f}" alt="${esc(c)}" width="1440" height="900" loading="lazy"><figcaption>${esc(c)}</figcaption></figure>`
      )
      .join('\n'),
    playlist: playlists[lang]
      ? `<p class="playlist"><a href="${esc(playlists[lang])}">${esc(t.tutorial.playlist)}</a></p>`
      : '',
    videos: videoGroups(lang, t),
    downloadJson: JSON.stringify({
      zoomOpen: lang === 'it' ? 'Clic per ingrandire' : 'Click to enlarge',
      ...t.download,
      download: t.hero.download,
      downloadGeneric: t.hero.downloadGeneric,
      version: t.hero.version
    }).replace(/</g, '\\u003c')
  }
  const get = (key) => {
    if (key in data) return typeof data[key] === 'string' ? data[key] : ''
    const v = key.split('.').reduce((o, k) => (o == null ? undefined : o[k]), data)
    if (typeof v !== 'string') throw new Error(`missing key in the template: ${key}`)
    return v
  }
  const html = template.replace(/\{\{([\w.]+)\}\}/g, (_, key) => (raw.has(key) ? get(key) : esc(get(key))))
  writeFileSync(lang === 'en' ? `${out}/index.html` : `${out}/it/index.html`, html)
}
console.log(`site in ${out}`)

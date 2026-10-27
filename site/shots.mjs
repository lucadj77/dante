// Screenshots of the site, in English and Italian, from the app in the browser with the sample
// project (Pride and Prejudice / I promessi sposi). Clean windows, no badges: the guide's
// labelled images are in docs/img. Needs the dev server (npm run dev -- --port 5173) and
// Playwright; then `python3 site/shrink.py` makes them smaller. Usage: node site/shots.mjs [name,...]
import { mkdirSync } from 'node:fs'
const { chromium } = await import(process.env.PLAYWRIGHT ?? 'playwright')

const here = new URL('.', import.meta.url).pathname
const only = process.argv[2]
const run = (n) => !only || only.split(',').includes(n)
const L = {
  en: { sample: 'Try the sample project', scene: 'The ball', bible: 'Story Bible', views: 'Tables and boards', stats: 'Statistics', more: 'More', sheets: 'Cards of the scene, beside the text', quiet: 'Jane and Elizabeth' },
  it: { sample: 'Prova il progetto di esempio', scene: 'L’incontro', bible: 'Bibbia', views: 'Tabelle e bacheche', stats: 'Statistiche', more: 'Altro', sheets: 'Schede della scena, accanto al testo', quiet: 'Perpetua' }
}

async function start(lang, settings = {}) {
  const b = await chromium.launch({ args: [`--lang=${lang}`, '--font-render-hinting=none'] })
  const ctx = await b.newContext({
    viewport: { width: 1440, height: 900 },
    locale: lang === 'it' ? 'it-IT' : 'en-GB',
    // twice the pixels, so the enlarged screenshots stay sharp
    deviceScaleFactor: 2,
    colorScheme: 'light',
    // a Mac, so shortcuts read ⌘
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Safari/537.36'
  })
  const page = await ctx.newPage()
  page.on('pageerror', (e) => console.log('ERR', e.message))
  await page.addInitScript(
    (s) => {
      if (!sessionStorage.getItem('init')) {
        localStorage.clear()
        localStorage.setItem('dante.app-settings', JSON.stringify(s))
        sessionStorage.setItem('init', '1')
      }
    },
    { language: lang, userName: lang === 'it' ? 'Luca' : 'Jane', theme: 'light', checkUpdates: false, ...settings }
  )
  await page.goto('http://127.0.0.1:5173/')
  await page.waitForTimeout(1500)
  await page.getByText(L[lang].sample).click()
  await page.waitForTimeout(1500)
  return { b, page }
}
const open = async (page, t) => {
  await page.getByText(t, { exact: true }).first().click()
  await page.waitForTimeout(900)
}
const nav = async (page, name) => {
  await page.getByRole('button', { name, exact: true }).first().click()
  await page.waitForTimeout(1000)
}

for (const lang of ['en', 'it']) {
  const t = L[lang]
  const S = `${here}img/${lang}/`
  mkdirSync(S, { recursive: true })
  const shot = async (page, name) => {
    await page.mouse.move(1430, 890)
    await page.waitForTimeout(300)
    await page.screenshot({ path: S + name + '.png' })
  }
  if (run('editor')) {
    const { b, page } = await start(lang)
    await open(page, t.scene)
    await shot(page, 'editor')
    await b.close()
  }
  if (run('dark')) {
    const { b, page } = await start(lang, { theme: 'night' })
    await open(page, t.quiet)
    await shot(page, 'night')
    await b.close()
  }
  if (run('bible')) {
    const { b, page } = await start(lang)
    await nav(page, t.bible)
    await shot(page, 'bible')
    await b.close()
  }
  if (run('views')) {
    const { b, page } = await start(lang)
    await nav(page, t.views)
    await shot(page, 'board')
    await b.close()
  }
  if (run('sheets')) {
    const { b, page } = await start(lang)
    await open(page, t.scene)
    await page.getByRole('button', { name: t.more }).first().click()
    await page.waitForTimeout(300)
    await page.getByText(t.sheets).first().click()
    await page.waitForTimeout(1200)
    await shot(page, 'sheets')
    await b.close()
  }
  if (run('stats')) {
    const { b, page } = await start(lang)
    await nav(page, t.stats)
    await shot(page, 'stats')
    await b.close()
  }
}

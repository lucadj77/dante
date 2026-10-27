// Download: reads the latest release from GitHub and offers the right file for the visitor's system.
// Enlarged images: a click (or Enter) on a screenshot opens it in a full-screen window
;(function () {
  var dlg = document.getElementById('zoom')
  if (!dlg || !dlg.showModal) return
  var big = dlg.querySelector('img')
  var caption = dlg.querySelector('.zoom-caption')
  var hint = window.SITE_TEXTS && window.SITE_TEXTS.zoomOpen
  function open(img) {
    var fig = img.closest('figure')
    var text = fig && fig.querySelector('figcaption')
    big.src = img.currentSrc || img.src
    big.alt = img.alt
    caption.textContent = text ? text.textContent : img.alt
    dlg.showModal()
  }
  document.querySelectorAll('img.zoomable').forEach(function (img) {
    img.tabIndex = 0
    img.setAttribute('role', 'button')
    if (hint) img.title = hint
    img.addEventListener('click', function () {
      open(img)
    })
    img.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        open(img)
      }
    })
  })
  // a click anywhere closes it: on the image, the backdrop or the button
  dlg.addEventListener('click', function () {
    dlg.close()
  })
})()

// The «back to top» button: it appears after one screen of scrolling
;(function () {
  var b = document.getElementById('to-top')
  var show = function () {
    b.hidden = window.scrollY < window.innerHeight * 0.8
  }
  window.addEventListener('scroll', show, { passive: true })
  show()
})()

;(function () {
  var REPO = 'lucadj77/dante'
  var RELEASES = 'https://github.com/' + REPO + '/releases'
  var t = window.SITE_TEXTS
  var kinds = {
    macArm: /-mac-apple-silicon\.dmg$/,
    macIntel: /-mac-intel\.dmg$/,
    winSetup: /^Dante-setup-.*\.exe$/,
    winPortable: /^Dante-portable-.*\.zip$/,
    linuxAppImage: /\.AppImage$/,
    linuxDeb: /\.deb$/,
    linuxRpm: /\.rpm$/
  }
  function platform() {
    var p = (
      (navigator.userAgentData && navigator.userAgentData.platform) ||
      navigator.platform ||
      ''
    ).toLowerCase()
    var ua = navigator.userAgent.toLowerCase()
    if (/mac/.test(p)) return 'mac'
    if (/win/.test(p)) return 'win'
    if (/linux/.test(p) && !/android/.test(ua)) return 'linux'
    return ''
  }
  var main = document.getElementById('dl-main')
  var status = document.getElementById('dl-status')
  var intro = document.getElementById('dl-intro')
  function set(kind, url, version) {
    var a = document.getElementById('dl-' + kind)
    if (!a) return
    if (url) {
      a.href = url
      a.removeAttribute('aria-disabled')
    } else {
      a.href = RELEASES + '/latest'
    }
  }
  function fallback() {
    main.href = RELEASES + '/latest'
    main.querySelector('.label').textContent = t.downloadGeneric
    status.textContent = t.failed
    Object.keys(kinds).forEach(function (k) {
      set(k, '')
    })
  }
  fetch('https://api.github.com/repos/' + REPO + '/releases/latest')
    .then(function (r) {
      if (!r.ok) throw new Error(r.status)
      return r.json()
    })
    .then(function (rel) {
      var version = rel.tag_name.replace(/^v/, '')
      var found = {}
      rel.assets.forEach(function (a) {
        Object.keys(kinds).forEach(function (k) {
          if (kinds[k].test(a.name)) found[k] = a.browser_download_url
        })
      })
      Object.keys(kinds).forEach(function (k) {
        set(k, found[k])
      })
      intro.textContent = intro.textContent.replace('{version}', version)
      status.textContent = t.version + ' ' + version
      var os = platform()
      var pick =
        os === 'mac'
          ? ['macArm', t.mac]
          : os === 'win'
            ? ['winSetup', t.win]
            : os === 'linux'
              ? ['linuxAppImage', t.linux]
              : null
      if (pick && found[pick[0]]) {
        main.href = found[pick[0]]
        main.querySelector('.label').textContent = t.download + ' ' + pick[1]
        if (os === 'mac') {
          var hint = document.getElementById('dl-hint')
          hint.innerHTML = t.macArm + ' · <a href="' + found.macIntel + '">' + t.macIntel + '</a>'
        }
      } else {
        main.href = '#download'
        main.querySelector('.label').textContent = t.downloadGeneric
      }
    })
    .catch(fallback)
})()

// tutorials as an accordion: when a group opens and the one above closes, its title stays in view
document.querySelectorAll('details.video-group').forEach((d) => {
  d.addEventListener('toggle', () => {
    if (d.open && d.getBoundingClientRect().top < 0) d.scrollIntoView({ block: 'start' })
  })
})

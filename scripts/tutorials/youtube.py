#!/usr/bin/env python3
"""Upload finished tutorials to YouTube: python3 youtube.py [--privacy public] out/<video>-<lang> ...

Each video goes up with its thumbnail (the opening cover) into the "Dante - ITA" or "Dante - EN"
playlist, in the order of its number. The description lists the video's sections, taken from
the script. Uploaded ids are kept in youtube.json, so a video already there is updated instead
of uploaded again. Needs YOUTUBE_CLIENT_ID, YOUTUBE_CLIENT_SECRET and YOUTUBE_REFRESH_TOKEN.
"""
import json, os, re, subprocess, sys
import requests

HERE = os.path.dirname(os.path.abspath(__file__))
STORE = os.path.join(HERE, 'youtube.json')
API = 'https://www.googleapis.com/youtube/v3'
PLAYLISTS = {'it': 'Dante - ITA', 'en': 'Dante - EN'}
SITE = {'it': 'https://dante.lucadj.eu/it/', 'en': 'https://dante.lucadj.eu/'}
TEXT = {
    'it': {
        'lead': 'Un video della guida a Dante: {subtitle}.',
        'inside': 'Nel video:',
        'guide': 'Tutta la guida: {site}',
        'about': 'Dante è un’app gratuita per scrivere romanzi: scene, capitoli, schede dei personaggi, revisioni ed esportazione in Word, PDF ed EPUB. Il romanzo resta in file Markdown, uno standard libero che si apre con qualsiasi editor di testo. Funziona su Mac, Windows, Linux e nel browser.',
        'download': 'Guida completa e download: {site}',
        'playlist': 'Le guide video di Dante, l’app gratuita per scrivere romanzi.',
    },
    'en': {
        'lead': 'A video of the Dante guide: {subtitle}.',
        'inside': 'In this video:',
        'guide': 'The full guide: {site}',
        'about': 'Dante is a free app for writing novels: scenes, chapters, character sheets, revisions and export to Word, PDF and EPUB. The novel stays in Markdown files, a free standard any text editor can open. It runs on Mac, Windows, Linux and in the browser.',
        'download': 'Full guide and downloads: {site}',
        'playlist': 'The video guides of Dante, the free app for writing novels.',
    },
}


def token():
    r = requests.post('https://oauth2.googleapis.com/token', data={
        'client_id': os.environ['YOUTUBE_CLIENT_ID'],
        'client_secret': os.environ['YOUTUBE_CLIENT_SECRET'],
        'refresh_token': os.environ['YOUTUBE_REFRESH_TOKEN'],
        'grant_type': 'refresh_token',
    })
    r.raise_for_status()
    return {'Authorization': 'Bearer ' + r.json()['access_token']}


def check(r):
    if r.status_code >= 400:
        raise SystemExit(f'{r.status_code} {r.text}')
    return r.json() if r.text else {}


def sections(n, lang):
    """The section titles and subtitles of a video, read from the texts at the top of its script."""
    script = next(f for f in os.listdir(os.path.join(HERE, 'videos')) if f.startswith(f'{n:02d}-'))
    src = open(os.path.join(HERE, 'videos', script)).read()
    block = src[src.index(f'\n  {lang}: {{'):]
    block = block[:block.index('\n  },')]
    out = {}
    for m in re.finditer(r"^    (s\d+[ac-z]?)(b?): '((?:[^'\\]|\\.)*)',$", block, re.M):
        key, sub, text = m.group(1), m.group(2), m.group(3).replace("\\'", "'")
        if sub and key in out:
            out[key] = f'{out[key]}. {text}'
        elif not sub:
            out[key] = text
    return list(out.values())


def description(meta, lang):
    t = TEXT[lang]
    sub = meta['subtitle']
    lines = [t['lead'].format(subtitle=sub[0].lower() + sub[1:]), '', t['inside']]
    lines += [f'- {s}' for s in sections(meta['n'], lang)]
    lines += ['', t['guide'].format(site=SITE[lang]), '', t['about'], '', t['download'].format(site=SITE[lang])]
    return '\n'.join(lines)


def playlist(h, lang, store):
    key = f'playlist-{lang}'
    if key in store:
        return store[key]
    body = {'snippet': {'title': PLAYLISTS[lang], 'description': TEXT[lang]['playlist'], 'defaultLanguage': lang},
            'status': {'privacyStatus': 'public'}}
    store[key] = check(requests.post(f'{API}/playlists?part=snippet,status', headers=h, json=body))['id']
    return store[key]


def place(h, pid, vid, n, store, lang):
    """Puts the video in the playlist after the ones with a lower number."""
    items = check(requests.get(f'{API}/playlistItems?part=snippet&maxResults=50&playlistId={pid}', headers=h)).get('items', [])
    if any(i['snippet']['resourceId']['videoId'] == vid for i in items):
        return
    numbers = {v['id']: int(k.split('-')[0]) for k, v in store.get('videos', {}).items() if k.endswith('-' + lang)}
    position = sum(1 for i in items if numbers.get(i['snippet']['resourceId']['videoId'], 0) < n)
    check(requests.post(f'{API}/playlistItems?part=snippet', headers=h, json={'snippet': {
        'playlistId': pid, 'position': position, 'resourceId': {'kind': 'youtube#video', 'videoId': vid}}}))


def upload(h, path, snippet, status):
    size = os.path.getsize(path)
    r = requests.post(f'{API.replace("/youtube/v3", "/upload/youtube/v3")}/videos?uploadType=resumable&part=snippet,status',
                      headers={**h, 'X-Upload-Content-Type': 'video/mp4', 'X-Upload-Content-Length': str(size)},
                      json={'snippet': snippet, 'status': status})
    check(r)
    with open(path, 'rb') as f:
        return check(requests.put(r.headers['Location'], headers={**h, 'Content-Type': 'video/mp4'}, data=f))['id']


def main():
    args = sys.argv[1:]
    privacy = 'public'
    if args[:1] == ['--privacy']:
        privacy, args = args[1], args[2:]
    store = json.load(open(STORE)) if os.path.exists(STORE) else {}
    store.setdefault('videos', {})
    h = token()
    for d in args:
        d = d.rstrip('/')
        meta = json.load(open(os.path.join(d, 'meta.json')))
        n, lang = meta['n'], meta['lang']
        key = f'{n:02d}-{lang}'
        title = f'{lang.upper()}{n:02d} Dante - {meta["title"]}'
        snippet = {'title': title, 'description': description(meta, lang), 'categoryId': '27',
                   'defaultLanguage': lang, 'defaultAudioLanguage': lang}
        status = {'privacyStatus': privacy, 'selfDeclaredMadeForKids': False}
        old = store['videos'].get(key)
        if old:
            # the same number again: a new upload replaces the old one in the playlist
            check(requests.delete(f'{API}/videos?id={old["id"]}', headers=h))
        vid = upload(h, os.path.join(d, 'video.mp4'), snippet, status)
        with open(os.path.join(d, 'thumbnail.jpg'), 'rb') as f:
            check(requests.post(f'https://www.googleapis.com/upload/youtube/v3/thumbnails/set?videoId={vid}',
                                headers={**h, 'Content-Type': 'image/jpeg'}, data=f))
        store['videos'][key] = {'id': vid, 'title': title}
        place(h, playlist(h, lang, store), vid, n, store, lang)
        json.dump(store, open(STORE, 'w'), indent=1, ensure_ascii=False)
        print(f'UPLOADED {key} https://youtu.be/{vid}')


if __name__ == '__main__':
    main()

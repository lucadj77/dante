#!/usr/bin/env python3
"""Writes the videos of the site (site/texts.mjs) from the uploaded tutorials: python3 site_videos.py

Number, group and titles come from the scripts in videos/, the length from out/<video>-<lang>/video.mp4,
the YouTube addresses and playlists from youtube.json. A video appears in a language only once it is
on YouTube in that language.
"""
import json, os, re, subprocess

HERE = os.path.dirname(os.path.abspath(__file__))
TEXTS = os.path.join(HERE, '..', '..', 'site', 'texts.mjs')
store = json.load(open(os.path.join(HERE, 'youtube.json')))


def field(src, name):
    """A { it: '…', en: '…' } of the meta at the top of a script."""
    m = re.search(name + r": \{ it: '((?:[^'\\]|\\.)*)', en: '((?:[^'\\]|\\.)*)' \}", src)
    return {'it': m.group(1).replace("\\'", "'"), 'en': m.group(2).replace("\\'", "'")}


def minutes(d):
    seconds = float(subprocess.check_output(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0',
                                             os.path.join(d, 'video.mp4')]))
    return max(1, round(seconds / 60))


def js(s):
    return "'" + s.replace('\\', '\\\\').replace("'", "\\'") + "'"


items = []
for script in sorted(os.listdir(os.path.join(HERE, 'videos'))):
    src = open(os.path.join(HERE, 'videos', script)).read()
    n = int(re.search(r'\bn: (\d+)', src).group(1))
    group = re.search(r"group: '(\w+)'", src).group(1)
    title, subtitle = field(src, 'title'), field(src, 'subtitle')
    url = {l: f'https://www.youtube.com/watch?v={store["videos"][f"{n:02d}-{l}"]["id"]}'
           for l in ('en', 'it') if f'{n:02d}-{l}' in store['videos']}
    if not url:
        continue
    d = os.path.join(HERE, 'out', script[:-4] + '-it')
    items.append(
        '  {\n'
        f'    n: {n},\n'
        f"    group: '{group}',\n"
        f'    minutes: {minutes(d)},\n'
        f'    en: {js(title["en"])},\n'
        f'    it: {js(title["it"])},\n'
        f'    about: {{ en: {js(subtitle["en"])}, it: {js(subtitle["it"])} }},\n'
        f'    url: {{ {", ".join(f"{l}: {js(u)}" for l, u in url.items())} }}\n'
        '  }')

playlists = {l: f'https://www.youtube.com/playlist?list={store[f"playlist-{l}"]}' if f'playlist-{l}' in store else ''
             for l in ('en', 'it')}
text = open(TEXTS).read()
text = re.sub(r'export const videos = \[.*?\n\]\n', 'export const videos = [\n' + ',\n'.join(items) + '\n]\n', text, count=1, flags=re.S)
text = re.sub(r'export const playlists = \{.*?\}\n',
              f"export const playlists = {{ en: {js(playlists['en'])}, it: {js(playlists['it'])} }}\n", text, count=1)
open(TEXTS, 'w').write(text)
print(f'{len(items)} videos, playlists {playlists}')

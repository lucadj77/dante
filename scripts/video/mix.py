# Lays a read voice-over and background music under out/dante.mp4.
#   python3 mix.py voice.wav music.m4a cuts.json
# cuts.json lists where each paragraph of the reading ends, in seconds (scenes.json order,
# then "Dante. Write your novel." for the closing card). Each paragraph starts half a second
# into its scene; the music loops with a crossfade and drops by 10 dB while the voice speaks.
import json, subprocess, sys
import numpy as np

R = 48000
voice_file, music_file, cuts_file = sys.argv[1:4]
tl = json.load(open('timeline.json'))
f0 = tl['frames'][0]
starts = [m['start'] - f0 for m in tl['marks']]
D = float(subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', 'out/dante.mp4'], capture_output=True, text=True).stdout)
N = int(D * R)
card = D - 6.7  # the closing card is fully in
cuts = [0] + json.load(open(cuts_file))
places = [s + 0.5 for s in starts] + [card + 0.5]

def pcm(path, channels, extra=()):
    raw = subprocess.run(['ffmpeg', '-v', 'error', *extra, '-i', path, '-ar', str(R), '-ac', str(channels), '-f', 'f32le', '-'], capture_output=True, check=True).stdout
    return np.frombuffer(raw, dtype=np.float32).copy()

x = pcm(voice_file, 1)
v = np.zeros(N, np.float32)
for i in range(len(cuts) - 1):
    a, b = int(max(cuts[i] - (0.12 if i else 0), 0) * R), int(cuts[i + 1] * R)
    seg = x[a:b].copy()
    n = int(0.05 * R)
    seg[:n] *= np.linspace(0, 1, n)
    seg[-n:] *= np.linspace(1, 0, n)
    p = int(places[i] * R)
    v[p:p + len(seg)] += seg[:N - p]
    nxt = places[i + 1] - 0.5 if i + 1 < len(places) else D
    if places[i] + len(seg) / R > nxt:
        print(f'paragraph {i + 1} runs {places[i] + len(seg) / R - nxt:.1f} s into the next scene')

loop = subprocess.run(['ffmpeg', '-v', 'error', '-i', music_file, '-i', music_file, '-filter_complex', f'[0:a][1:a]acrossfade=d=4,atrim=0:{D}[m]', '-map', '[m]', '-ar', str(R), '-ac', '2', '-f', 'f32le', '-'], capture_output=True, check=True).stdout
u = np.frombuffer(loop, dtype=np.float32).reshape(-1, 2)[:N]
u = np.pad(u, ((0, N - len(u)), (0, 0)))

# Voice activity from a 20 ms RMS, held for 0.4 s so short pauses do not pump the music.
w = int(0.02 * R)
active = np.sqrt(np.convolve(v ** 2, np.ones(w) / w, 'same')) > 0.01
active = np.convolve(active.astype(np.float32), np.ones(int(0.4 * R)), 'same') > 0
t = np.arange(N) / R
base = np.full(N, 0.32, np.float32)
base[(t < starts[0]) | (t > card + 3.5)] = 0.55  # louder on the title cards
k = int(R)
base = np.convolve(np.pad(base, (k // 2, k - k // 2 - 1), 'edge'), np.ones(k) / k, 'valid').astype(np.float32)
duck = np.ones(N, np.float32)
blk, cur = int(0.01 * R), 1.0
for i in range(0, N, blk):
    target = 0.3 if active[i:i + blk].any() else 1.0
    cur += (target - cur) * (0.01 / 0.15 if target < cur else 0.01 / 0.6)
    duck[i:i + blk] = cur
fade = np.ones(N, np.float32)
fade[:int(1.5 * R)] = np.linspace(0, 1, int(1.5 * R))
fade[-4 * R:] = np.linspace(1, 0, 4 * R)
music = u * (base * duck * fade)[:, None]
mix = music + v[:, None]
mix *= min(1.0, 0.97 / np.abs(mix).max())

def wav(path, data, channels):
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-f', 'f32le', '-ar', str(R), '-ac', str(channels), '-i', '-', path], input=data.astype(np.float32).tobytes(), check=True)

wav('out/voce.wav', v, 1)
wav('out/mix.wav', mix, 2)
subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', 'out/dante.mp4', '-i', 'out/mix.wav', '-i', 'out/dante-it.srt', '-i', 'out/dante-en.srt',
                '-map', '0:v', '-map', '1:a', '-map', '2', '-map', '3', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-c:s', 'mov_text',
                '-metadata:s:s:0', 'language=ita', '-metadata:s:s:1', 'language=eng', '-movflags', '+faststart', 'out/dante-audio.mp4'], check=True)
print('ok')

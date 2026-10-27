# Ambient music for a tutorial, made here so that nobody else holds rights on it:
# python3 music.py <seconds> <seed> <out.wav>. Slow pads on a four-chord loop, soft and low.
import sys, wave
import numpy as np

seconds, seed, out = float(sys.argv[1]), int(sys.argv[2]), sys.argv[3]
rate = 44100
rng = np.random.default_rng(seed)
# Four progressions; the seed picks one, so the videos do not all sound the same.
PROGRESSIONS = [
    [[48, 55, 64, 71], [45, 52, 60, 67], [41, 48, 57, 64], [43, 50, 59, 62]],  # Cmaj7 Am7 Fmaj7 G
    [[50, 57, 65, 72], [46, 53, 62, 69], [41, 48, 57, 65], [48, 55, 64, 67]],  # Dm9 Bbmaj7 F C
    [[45, 52, 60, 64], [41, 48, 57, 64], [48, 55, 64, 67], [43, 50, 59, 66]],  # Am F C G
    [[43, 50, 59, 66], [40, 47, 55, 62], [36, 43, 52, 59], [38, 45, 54, 62]],  # Gmaj7 Em7 Cmaj7 D
]
chords = PROGRESSIONS[seed % len(PROGRESSIONS)]
chord_len = 8.0  # seconds per chord
n = int(seconds * rate)
t = np.arange(n) / rate
left = np.zeros(n)
right = np.zeros(n)
freq = lambda m: 440.0 * 2 ** ((m - 69) / 12)

for start in np.arange(0, seconds, chord_len):
    chord = chords[int(start / chord_len) % len(chords)]
    a, b = int(start * rate), min(n, int((start + chord_len + 4) * rate))  # chords overlap by 4 s
    tt = t[a:b] - start
    env = np.minimum(1, tt / 3.0) * np.clip((chord_len + 4 - tt) / 4.0, 0, 1)
    for i, m in enumerate(chord):
        f = freq(m)
        pan = 0.3 + 0.4 * (i / 3)
        for detune in (-0.0025, 0.0025):
            phase = rng.uniform(0, 2 * np.pi)
            tone = np.sin(2 * np.pi * f * (1 + detune) * tt + phase) + 0.25 * np.sin(4 * np.pi * f * (1 + detune) * tt + phase)
            tone *= env * (0.9 if i == 0 else 0.55)
            left[a:b] += tone * (1 - pan)
            right[a:b] += tone * pan
    # a few soft high notes from the chord, like a slow music box
    for k in range(3):
        m = chord[rng.integers(1, 4)] + 12
        s = int((start + rng.uniform(0.5, chord_len - 1)) * rate)
        e = min(n, s + int(3.5 * rate))
        if s >= n:
            continue
        tt2 = (np.arange(e - s)) / rate
        bell = np.sin(2 * np.pi * freq(m) * tt2) * np.exp(-tt2 * 1.4) * 0.35
        left[s:e] += bell * 0.6
        right[s:e] += bell * 0.4

# A simple echo for room, then a gentle low-pass.
def echo(x, delay, gain):
    d = int(delay * rate)
    y = x.copy()
    y[d:] += x[:-d] * gain
    return y
for x in (left, right):
    x[:] = echo(echo(x, 0.37, 0.35), 0.61, 0.25)
kernel = np.ones(24) / 24
left = np.convolve(left, kernel, 'same')
right = np.convolve(right, kernel, 'same')
fade = np.minimum(1, np.minimum(t / 3, (seconds - t) / 4))
peak = max(np.abs(left).max(), np.abs(right).max())
stereo = np.stack([left, right], 1) * fade[:, None] / peak * 0.5
with wave.open(out, 'wb') as w:
    w.setnchannels(2)
    w.setsampwidth(2)
    w.setframerate(rate)
    w.writeframes((stereo * 32767).astype('<i2').tobytes())

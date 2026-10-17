# Builds the .mp4 from the screencast frames and the .srt files from the scene marks.
import json, re, subprocess, sys
tl = json.load(open('timeline.json')); sc = json.load(open('scenes.json'))
fr = tl['frames']; t0 = fr[0]; end = tl['t1']
with open('frames.txt', 'w') as f:
    f.write('ffconcat version 1.0\n')
    for i, t in enumerate(fr):
        nxt = fr[i + 1] if i + 1 < len(fr) else end
        f.write(f"file 'frames/{i:06d}.jpg'\nduration {max(nxt - t, 0.001):.4f}\n")
    f.write(f"file 'frames/{len(fr)-1:06d}.jpg'\n")
out = sys.argv[1]
subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', 'frames.txt', '-vf', 'scale=1920:1080:flags=lanczos,fps=30,format=yuv420p', '-c:v', 'libx264', '-preset', 'slow', '-crf', '18', '-movflags', '+faststart', out + '/dante.mp4'], check=True)

def ts(x):
    ms = int(round(x * 1000)); h, ms = divmod(ms, 3600000); m, ms = divmod(ms, 60000); s, ms = divmod(ms, 1000)
    return f"{h:02d}:{m:02d}:{s:02d},{ms:03d}"
def cues(text, a, b):
    # one cue per sentence (short ones joined), time shared by length
    parts = re.split(r'(?<=[.?!:])\s+(?=[A-ZÈÉ«“])', text)
    merged = []
    for p_ in parts:
        if merged and len(merged[-1]) + len(p_) < 60: merged[-1] += ' ' + p_
        else: merged.append(p_)
    tot = sum(len(x) for x in merged); t = a; res = []
    for x in merged:
        d = (b - a) * len(x) / tot; res.append((t, t + d - 0.05, x)); t += d
    return res
for lang in ('en', 'it'):
    n = 1; lines = []
    for m in tl['marks']:
        s = sc[m['n'] - 1]
        a = m['start'] - t0 + 0.4; b = m['end'] - t0 - 0.3
        for (x, y, txt) in cues(s[lang], a, b):
            lines.append(f"{n}\n{ts(x)} --> {ts(y)}\n{txt}\n"); n += 1
    open(f"{out}/dante-{lang}.srt", 'w', encoding='utf-8').write('\n'.join(lines))
print('ok', round(end - t0, 1), 's')

# Edits a recorded tutorial: python3 build.py out/<video>-<lang>. Opening cover, the recording, closing
# cover, fades, the generated music at a low volume; writes video.mp4 (H.264/AAC) and thumbnail.jpg.
import json, os, subprocess, sys

out = sys.argv[1]
here = os.path.dirname(os.path.abspath(__file__))
meta = json.load(open(os.path.join(out, 'meta.json')))
tl = json.load(open(os.path.join(out, 'timeline.json')))
run = lambda *a: subprocess.run(a, check=True)

# The recording: each frame lasts until the next one, then 30 frames a second.
frames = tl['frames']
with open(os.path.join(out, 'frames.txt'), 'w') as f:
    f.write('ffconcat version 1.0\n')
    for i, t in enumerate(frames):
        nxt = frames[i + 1] if i + 1 < len(frames) else tl['t1']
        f.write(f"file 'frames/{i:06d}.jpg'\nduration {max(nxt - t, 0.001):.4f}\n")
    f.write(f"file 'frames/{len(frames) - 1:06d}.jpg'\n")
body = os.path.join(out, 'body.mp4')
run('ffmpeg', '-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', os.path.join(out, 'frames.txt'),
    '-vf', 'scale=1920:1080:flags=lanczos,fps=30,format=yuv420p', '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', body)
length = float(subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', body],
                              capture_output=True, text=True, check=True).stdout)

if not os.path.exists(os.path.join(out, 'cover-start.png')):
    run('node', os.path.join(here, 'cover.mjs'), out)
START, END = 4.5, 5.0
total = START + length + END
music = os.path.join(out, 'music.wav')
run('python3', os.path.join(here, 'music.py'), f'{total + 1:.2f}', str(meta['n']), music)

video = os.path.join(out, 'video.mp4')
graph = (
    f"[0:v]fps=30,format=yuv420p,fade=in:st=0:d=0.8,fade=out:st={START - 0.6}:d=0.6[a];"
    f"[1:v]fps=30,format=yuv420p,fade=in:st=0:d=0.5,fade=out:st={length - 0.7:.3f}:d=0.7[b];"
    f"[2:v]fps=30,format=yuv420p,fade=in:st=0:d=0.6,fade=out:st={END - 1.2}:d=1.2[c];"
    f"[a][b][c]concat=n=3:v=1:a=0[v];"
    f"[3:a]atrim=0:{total:.3f},volume=0.35,afade=in:st=0:d=2,afade=out:st={total - 3:.3f}:d=3[m]"
)
run('ffmpeg', '-y', '-loglevel', 'error',
    '-loop', '1', '-t', str(START), '-i', os.path.join(out, 'cover-start.png'),
    '-i', body,
    '-loop', '1', '-t', str(END), '-i', os.path.join(out, 'cover-end.png'),
    '-i', music,
    '-filter_complex', graph, '-map', '[v]', '-map', '[m]',
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '18', '-pix_fmt', 'yuv420p',
    '-c:a', 'aac', '-b:a', '160k', '-movflags', '+faststart', video)
run('ffmpeg', '-y', '-loglevel', 'error', '-i', os.path.join(out, 'cover-start.png'), '-vf', 'scale=1920:1080', '-q:v', '2',
    os.path.join(out, 'thumbnail.jpg'))
print(f'{video}: {total:.1f} s')

"""Makes the site's screenshots smaller: 256 colours, as the guide's (scripts/screenshots/finalize.py).
Usage: python3 site/shrink.py, after node site/shots.mjs."""

from pathlib import Path

from PIL import Image

for path in sorted(Path(__file__).parent.glob("img/*/*.png")):
    image = Image.open(path).convert("RGB")
    image = image.quantize(colors=256, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE)
    image.save(path, optimize=True)
    print(path, path.stat().st_size // 1024, "KB")

"""Copies the shots to docs/img: crops the full-window ones, limits the width, reduces colours."""
import glob, os
from PIL import Image
OUT = os.path.join(os.path.dirname(__file__), '../../docs/img')
# name in shots -> (name in docs, crop in CSS pixels or None)
CROPS = {
    'area-di-lavoro': ('area-di-lavoro', None),
    'bibbia': ('bibbia', None),
    'pannelli-full': ('pannelli', None),
    'cerca-full': ('cerca', (0, 0, 560, 600)),
    'commenti-full': ('commenti', (300, 40, 1500, 420)),
    'bacheca-full': ('bacheca', (240, 0, 1500, 420)),
    'linea-tempo-full': ('linea-tempo', (240, 0, 1500, 300)),
    'tabella-vista-full': ('tabella-vista', (240, 0, 1500, 420)),
    'vista-impostazioni-full': ('vista-impostazioni', (240, 0, 1500, 330)),
    'statistiche-full': ('statistiche', (50, 0, 1020, 640)),
    'statistiche2-full': ('statistiche-lunghezza', (50, 0, 1020, 660)),
    'esportazione-full': ('esportazione', (50, 30, 700, 640)),
    'struttura-full': ('struttura', (50, 30, 860, 430)),
    'scheda': ('scheda', None),
}
os.makedirs(OUT, exist_ok=True)
for f in sorted(glob.glob(os.path.join(os.path.dirname(__file__), 'shots/f-*.png'))):
    key = os.path.basename(f)[2:-4]
    if key in ('anteprima-full', 'menu-collegamento-full', 'conflitto-full'):
        continue
    name, crop = CROPS.get(key, (key, None))
    im = Image.open(f).convert('RGB')
    if crop:
        im = im.crop(tuple(v * 2 for v in crop))
    if im.width > 1800:
        im = im.resize((1800, round(im.height * 1800 / im.width)), Image.LANCZOS)
    im = im.quantize(colors=256, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE)
    im.save(f'{OUT}/{name}.png', optimize=True)
    print(name, im.size, os.path.getsize(f'{OUT}/{name}.png') // 1024, 'KB')

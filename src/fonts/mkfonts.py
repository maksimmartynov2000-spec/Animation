# Шрифты игры — внутри файла: подмножества Lora (заголовки, карты) и Inter (интерфейс) → fonts.css с @font-face (WOFF, base64).
# Ничего не грузится из сети: текст не «перескакивает» при запуске, игра работает и без интернета.
import base64, io, os, sys
from fontTools import subset
from fontTools.ttLib import TTFont
HERE = os.path.dirname(os.path.abspath(__file__))
# латиница, кириллица, цифры, знаки, стрелки и пометки из интерфейса
RANGES = [(0x20, 0x7E), (0xA0, 0xA0), (0xAB, 0xAB), (0xB0, 0xB1), (0xB7, 0xB7), (0xBB, 0xBB), (0xD7, 0xD7), (0xF7, 0xF7),
          (0x401, 0x401), (0x410, 0x44F), (0x451, 0x451), (0x2010, 0x2015), (0x2018, 0x201E), (0x2022, 0x2022), (0x2026, 0x2026),
          (0x2030, 0x2030), (0x2039, 0x203A), (0x20BD, 0x20BD), (0x2116, 0x2116), (0x2190, 0x2193), (0x21BB, 0x21BB), (0x2212, 0x2212),
          (0x2248, 0x2248), (0x2260, 0x2260), (0x2264, 0x2265), (0x25B8, 0x25B8), (0x25BE, 0x25BE), (0x2713, 0x2713), (0x2715, 0x2715), (0x2039, 0x203A)]
UNI = sorted({c for a, b in RANGES for c in range(a, b + 1)})
def make(src, feats):
    opt = subset.Options()
    opt.layout_features = feats; opt.name_IDs = [1, 2]; opt.notdef_outline = True; opt.hinting = False; opt.desubroutinize = True
    opt.flavor = 'woff'; opt.with_zopfli = False; opt.drop_tables += ['DSIG', 'STAT'] if False else ['DSIG']
    f = TTFont(src); s = subset.Subsetter(opt); s.populate(unicodes=UNI); s.subset(f)
    f.flavor = 'woff'; buf = io.BytesIO(); f.save(buf); return buf.getvalue(), len(f.getGlyphOrder())
FEATS = ['kern', 'liga', 'tnum', 'lnum', 'pnum', 'case', 'mark', 'mkmk', 'ccmp', 'locl', 'calt']
FACES = [('Lora', '400 700', 'normal', '/usr/share/fonts/truetype/google-fonts/Lora-Variable.ttf'),
         ('Inter', '500', 'normal', '/usr/share/fonts/opentype/inter/Inter-Medium.otf'),
         ('Inter', '600', 'normal', '/usr/share/fonts/opentype/inter/Inter-SemiBold.otf'),
         ('Inter', '700', 'normal', '/usr/share/fonts/opentype/inter/Inter-Bold.otf'),
         ('Inter', '800', 'normal', '/usr/share/fonts/opentype/inter/Inter-ExtraBold.otf')]
css, total = [], 0
for fam, w, st, src in FACES:
    data, n = make(src, FEATS)
    total += len(data)
    open(os.path.join(HERE, f"{fam}-{w.replace(' ', '_')}.woff"), 'wb').write(data)
    css.append(f"@font-face{{font-family:'{fam}';font-style:{st};font-weight:{w};font-display:block;src:url(data:font/woff;base64,{base64.b64encode(data).decode()}) format('woff')}}")
    print(fam, w, n, 'glyphs', len(data) // 1024, 'KB')
open(os.path.join(HERE, 'fonts.css'), 'w').write('\n'.join(css) + '\n')
print('fonts.css', os.path.getsize(os.path.join(HERE, 'fonts.css')) // 1024, 'KB; woff total', total // 1024, 'KB')

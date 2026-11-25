import pathlib
root = pathlib.Path(__file__).parent
css = (root/'fonts'/'fonts.css').read_text() + '\n' + (root/'style.css').read_text() + '\n' + (root/'board.css').read_text() + '\n' + (root/'menu.css').read_text()
js = '\n'.join((root/f).read_text() for f in ['symicons.js','cardfx.js','aid.js','data.js','pcards.js','modrules.js','art.js','engine.js','net.js','sfx.js','music.js','cnav.js','ui.js'])
# значки в тексте: путь к файлу, а в отдельной сборке — встроенная картинка (ASSET_URL)
js += "\nSymIcons.observe(document.body, (k) => (typeof ASSET_URL === 'function' ? ASSET_URL(`icons/i_${k}.svg`) : `icons/i_${k}.svg`));\n"
content = f'''<title>Претенденты</title>
<meta name="claude:viewport-fit-sides" content="cover">
<style>
{css}
</style>
<div id="app"></div>
<div id="bar" class="bar" hidden></div>
<div id="toasts" aria-live="polite"></div>
<div id="sheet-root"></div>
<script>
{js}
</script>
'''
(root/'dist'/'velikie-doma.html').write_text(content)
# локальная версия с каркасом, как при публикации
skeleton = '''<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<style>:root{color-scheme:light;padding-top:env(safe-area-inset-top);padding-bottom:env(safe-area-inset-bottom)}body{margin:0;font:14px system-ui}img{max-width:100%}[hidden]{display:none!important}</style></head><body>
'''
(root/'dist'/'test.html').write_text(skeleton + content + '</body></html>')
print('ok', len(content)//1024, 'KB')

# ---------- отдельная сборка: один файл index.html для GitHub Pages ----------
# Всё внутри: код, стили, шрифты, картинки (SVG). Из сети ничего не подгружается.
import json, re, subprocess
used = json.loads(subprocess.check_output(['node', '-e', r"""
const fs = require('fs');
global.self = global;
const D = require('./data.js'), sym = require('./symicons.js');
const ART = new Function(fs.readFileSync('art.js', 'utf8') + ';return ART;')();
const out = new Set();
for (const k of new Set([...Object.values(sym.MAP), ...Object.keys(sym.NAME)])) out.add(`icons/i_${k}.svg`);
// гербы Домов (icons/h_*) в отдельной сборке получаются из полных рисунков art/h_* — см. ASSET_URL
for (const h in D.HOUSES) out.add(`art/h_${h}.svg`);
for (const b in D.BAN) out.add(`art/b_${b}.svg`);
for (const f in D.FAITHS) out.add(`art/r_${f}.svg`);
for (const w in (D.RITUALS || {})) out.add(`art/w_${w}.svg`); // ритуалы вер
for (const p in D.PROV) out.add(`art/p_${p}.svg`);
for (const id in D.ESTATES) if (!ART[id]) out.add(`art/${id}.svg`);
for (const id in D.COURT) if (!ART[id]) out.add(`art/${id}.svg`);
for (const r of ['envy', 'support', 'alms', 'lore', 'trade']) out.add(`art/r_${r}.svg`); // карты правил и значков (Подаяния — во всплывашке дохода соперника)
for (const m of ['sets', ...(D.MODULE_PICK || [])]) out.add(`art/m_${m}.svg`); // карты модулей
for (const p of Object.values(ART)) out.add(p);
console.log(JSON.stringify([...out]));
"""], cwd=root))
def minsvg(t):
    t = re.sub(r'>\s+<', '><', t.strip())
    # укорачиваем только координаты контуров (d="…"): 12.3456 -> 12.35. Числа в transform не трогаем —
    # масштаб 0.22462 -> 0.2 уменьшал рисунок и сдвигал его влево-вверх
    t = re.sub(r'd="([^"]*)"', lambda m: 'd="' + re.sub(r'(\d+\.\d\d)\d+', r'\1', m.group(1)) + '"', t)
    return t
assets = {}
for p in used:
    f = root / 'dist' / p
    if not f.exists():
        raise SystemExit(f'нет картинки {p}')
    assets[p] = minsvg(f.read_text())
# значения — в одинарных кавычках: кавычки атрибутов SVG не надо экранировать (экономит ~90 КБ в index.html)
def jsstr(t):
    return "'" + t.replace('\\', '\\\\').replace("'", "\\'").replace('\n', '\\n').replace('\r', '').replace('\u2028', ' ').replace('\u2029', ' ').replace('</script', '<\\/script') + "'"
# одинаковые теги (общий фон, тени, рамки рисунков) хранятся один раз: в рисунке стоит метка «~x», словарь — в ASSET_DICT.
# Это около 300 КБ: index.html остаётся далеко от 2 МБ, после которых GitHub не показывает файл на сайте.
import collections
assert not any('~' in v for v in assets.values()), 'в рисунках есть «~» — метки словаря нельзя'
_cnt = collections.Counter()
for _v in assets.values():
    _cnt.update(re.findall(r'<[^>]+>', _v))
_TOK = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ'
_top = sorted(((t, n) for t, n in _cnt.items() if n > 3 and len(t) > 12), key=lambda x: -(len(x[0]) - 2) * (x[1] - 1))[:len(_TOK)]
asset_dict = {_TOK[i]: t for i, (t, n) in enumerate(_top)}
_rev = {t: '~' + k for k, t in asset_dict.items()}
_pat = re.compile('|'.join(re.escape(t) for t in sorted(_rev, key=len, reverse=True)))
assets_full = dict(assets)
assets = {k: _pat.sub(lambda m: _rev[m.group(0)], v) for k, v in assets.items()}
# проверка: после подстановки словаря рисунки совпадают с исходными
for _k, _v in assets.items():
    assert re.sub(r'~(.)', lambda m: asset_dict[m.group(1)], _v) == assets_full[_k], _k
asset_dict_js = '{' + ','.join(json.dumps(k) + ':' + jsstr(v) for k, v in asset_dict.items()) + '}'
assets_js = '{' + ','.join(json.dumps(k, ensure_ascii=False) + ':' + jsstr(v) for k, v in assets.items()) + '}'

import base64, urllib.parse
touch_icon = 'data:image/png;base64,' + base64.b64encode((root/'appicon'/'icon-180.png').read_bytes()).decode()
favicon_svg = 'data:image/svg+xml,' + urllib.parse.quote(re.sub(r'\s+', ' ', (root/'appicon'/'icon.svg').read_text()).strip().replace('"', "'"), safe=" =:/'")
favicon = "data:image/svg+xml," + "%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Cpath d='M10 6h44v26c0 14-10 22-22 28C20 54 10 46 10 32z' fill='%238a6309' stroke='%232a241c' stroke-width='3'/%3E%3Cpath d='M22 18h20l-4 8 4 8H22z' fill='%23f1e5c3'/%3E%3C/svg%3E"
# код и стили отдельной сборки сжимаем (esbuild): без комментариев и отступов файл заметно меньше.
# GitHub не показывает и не даёт править на сайте файлы больше ~2 МБ, а index.html обновляют именно так — вставкой в редакторе
def minify(text, loader):
    # esbuild: переменная ESBUILD, node_modules рядом с сайтом или с исходниками, общий каталог или PATH
    import os, shutil
    cands = [os.environ.get('ESBUILD'), str(root.parent/'node_modules'/'.bin'/'esbuild'), str(root/'node_modules'/'.bin'/'esbuild'), '/opt/npm-tools/node_modules/.bin/esbuild', shutil.which('esbuild')]
    exe = next((c for c in cands if c and os.path.exists(c)), None)
    if not exe:
        print('без сжатия: esbuild не найден (npm install)')
        return text
    try:
        out = subprocess.run([exe, f'--loader={loader}', '--minify', '--charset=utf8', '--target=es2020,safari15', '--log-level=warning'], input=text.encode(), capture_output=True, check=True).stdout.decode()
        return out if out.strip() else text
    except Exception as e:
        print('без сжатия:', e)
        return text
js_src, css_src = js, css
js = minify(js, 'js')
css = minify(css, 'css')
standalone = f'''<!doctype html>
<html lang="ru">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover">
<title>Претенденты</title>
<meta name="theme-color" content="#3a271b">
<link rel="icon" type="image/svg+xml" href="{favicon_svg}">
<link rel="apple-touch-icon" href="{touch_icon}">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-title" content="Претенденты">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<style>
:root {{ color-scheme: dark; padding-top: env(safe-area-inset-top); padding-bottom: env(safe-area-inset-bottom); }}
body {{ margin: 0; font: 14px system-ui, sans-serif; }}
img {{ max-width: 100%; }}
[hidden] {{ display: none !important; }}
{css}
</style>
</head>
<body>
<!--
  Претенденты — карточная игра (прототип). Один файл: открывается в любом браузере, работает на GitHub Pages.
  Партия и настройки сохраняются в браузере (localStorage). Код игры — во втором <script> ниже, картинки — в первом.
-->
<div id="app"></div>
<div id="bar" class="bar" hidden></div>
<div id="toasts" aria-live="polite"></div>
<div id="sheet-root"></div>
<script>
// Картинки игры (SVG) встроены в файл, чтобы для игры хватало одного index.html.
window.PRETENDENTY_LINKS = {{}}; // ссылки на учебник и каталог на claude.ai здесь не нужны
// игра по сети: публичные MQTT-брокеры (список можно поменять в настройках игры)
window.PRETENDENTY_NET = {{ brokers: ['wss://broker.emqx.io:8084/mqtt', 'wss://test.mosquitto.org:8081/mqtt', 'wss://broker.hivemq.com:8884/mqtt'] }};
const ASSETS = {assets_js};
// общие куски рисунков лежат в словаре: «~x» в рисунке — это ASSET_DICT.x
const ASSET_DICT = {asset_dict_js};
const ASSET_X = (s) => s.replace(/~(.)/g, (m, c) => ASSET_DICT[c] || m);
const ASSET_CACHE = {{}};
// гербы Домов, вассалов, лордов (icons/h_*, v_*, g_*) — тот же рисунок, что на карте, только кадр по эмблеме
const ICON_FROM_ART = /^icons\\/([hvgstpbr]_[A-Za-z0-9]+\\.svg)$/;
function ASSET_URL(p) {{
  if (ASSET_CACHE[p]) return ASSET_CACHE[p];
  let svg = ASSETS[p] ? ASSET_X(ASSETS[p]) : null;
  if (!svg) {{ const m = ICON_FROM_ART.exec(p); if (m && ASSETS['art/' + m[1]]) svg = ASSET_X(ASSETS['art/' + m[1]]).replace(/viewBox="[^"]*"/, 'viewBox="48 24 124 124"'); }}
  if (!svg) return p;
  return (ASSET_CACHE[p] = URL.createObjectURL(new Blob([svg], {{ type: 'image/svg+xml' }})));
}}
</script>
<script>
{js}
</script>
</body>
</html>
'''
# метка сборки — в самом начале файла: игра на сайте читает начало свежего index.html и узнаёт, что вышла новая версия (v10.7)
import hashlib
_ver = re.search(r"const VERSION = '([^']+)'", (root/'ui.js').read_text()).group(1)
_build = f"{_ver}·{hashlib.sha1(standalone.encode('utf-8')).hexdigest()[:8]}"
assert standalone.count('<meta charset="utf-8">') == 1
standalone = standalone.replace('<meta charset="utf-8">', f'<meta charset="utf-8">\n<meta name="pretendenty-build" content="{_build}">', 1)
(root/'dist'/'index.html').write_text(standalone)
print('сборка', _build)
# репозиторий сайта: исходники лежат в src/, готовая игра — index.html в корне (его отдаёт GitHub Pages)
if (root.parent/'.pretendenty-site').exists():
    (root.parent/'index.html').write_text(standalone)
    print('index.html в корне сайта обновлён')
js, css = js_src, css_src
print('index.html', len(standalone.encode('utf-8'))//1024, 'KB, картинок', len(assets))

# ---------- публикация на claude.ai: тот же фрагмент, что velikie-doma.html, но картинки встроены (без отдельных файлов) ----------
asset_script = f'''<script>
const ASSETS = {assets_js};
const ASSET_DICT = {asset_dict_js};
const ASSET_X = (s) => s.replace(/~(.)/g, (m, c) => ASSET_DICT[c] || m);
const ASSET_CACHE = {{}};
const ICON_FROM_ART = /^icons\\/([hvgstpbr]_[A-Za-z0-9]+\\.svg)$/;
function ASSET_URL(p) {{
  if (ASSET_CACHE[p]) return ASSET_CACHE[p];
  let svg = ASSETS[p] ? ASSET_X(ASSETS[p]) : null;
  if (!svg) {{ const m = ICON_FROM_ART.exec(p); if (m && ASSETS['art/' + m[1]]) svg = ASSET_X(ASSETS['art/' + m[1]]).replace(/viewBox="[^"]*"/, 'viewBox="48 24 124 124"'); }}
  if (!svg) return p;
  return (ASSET_CACHE[p] = URL.createObjectURL(new Blob([svg], {{ type: 'image/svg+xml' }})));
}}
</script>
'''
embed = content.replace('<script>\n' + js, asset_script + '<script>\n' + js, 1)
assert embed != content
(root/'dist'/'velikie-doma-embed.html').write_text(embed)
print('embed', len(embed.encode('utf-8'))//1024, 'KB')

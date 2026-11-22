# Тестовая страница для проверок в браузере: сборка для встраивания (src/dist/velikie-doma-embed.html) в простом каркасе.
# Запуск: python3 tests/make-page.py  →  .work/test-embed.html (её открывают тесты из этой папки)
import pathlib
root = pathlib.Path(__file__).resolve().parent.parent
work = root / '.work'; (work / 'v10').mkdir(parents=True, exist_ok=True)
head = ('<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n'
        '<style>:root{color-scheme:light;padding-top:env(safe-area-inset-top);padding-bottom:env(safe-area-inset-bottom)}body{margin:0;font:14px system-ui}img{max-width:100%}[hidden]{display:none!important}</style></head><body>')
emb = (root / 'src' / 'dist' / 'velikie-doma-embed.html').read_text()
(work / 'test-embed.html').write_text(head + emb + '</body></html>')
print('готово:', work / 'test-embed.html')

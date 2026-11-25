// Проверка перед PR одной командой: сборка, движок и основные браузерные тесты — по очереди, в конце один итог.
//   npm run check                — всё (около 15 минут)
//   npm run check -- quick       — быстрый набор для работы (несколько минут)
//   npm run check -- info cards  — только названные тесты (имя файла без .js; «buy:mini» — с устройством)
// Полные логи — в .work/check/<тест>.log. Код выхода 1, если что-то упало.
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const LOGS = path.join(ROOT, '.work', 'check');
const MAX_HTML = 2 * 1024 * 1024; // index.html должен оставаться меньше 2 МБ (CLAUDE.md)

// [имя в итоге, файл, аргументы, таймаут в секундах]
const FULL = [
  ['info', 'info.js', []], ['cards', 'cards.js', []], ['kb', 'kb.js', []],
  ['buy:i15', 'buy.js', ['i15']], ['buy:mini', 'buy.js', ['mini']], ['buy:mac', 'buy.js', ['mac']], ['buy2', 'buy2.js', []],
  ['handplay', 'handplay.js', []],
  ['faith:i15', 'faith.js', ['i15']], ['faith:mini', 'faith.js', ['mini']], ['faith:mac', 'faith.js', ['mac']],
  ['tab:i15', 'tab.js', ['i15']], ['tab:mini', 'tab.js', ['mini']], ['tut:i15', 'tut.js', ['i15']], ['tut:mini', 'tut.js', ['mini']],
  ['fly', 'fly.js', []], ['head', 'head.js', []], ['headbig', 'headbig.js', []],
  ['upd', 'upd.js', []], ['prefs', 'prefs.js', []], ['save', 'save.js', []], ['catalog', 'catalog.js', []], ['curses', 'curses.js', []], ['sins', 'sins.js', []], ['rituals', 'rituals.js', []], ['hints', 'hints.js', []], ['pair', 'pair.js', []], ['net2', 'net2.js', []], ['table3', 'table3.js', []],
  ['standalone', 'standalone.js', []],
  ['monkey', 'monkey.js', ['games=1', 'turns=100'], 500],
];
const QUICK = ['info', 'cards', 'buy:i15', 'handplay', 'prefs', 'save', 'curses', 'sins', 'rituals', 'hints', 'standalone'];

// разбор вывода теста: у тестов разные привычки, поэтому смотрим на все известные признаки провала
function verdict(name, out, code, timedOut) {
  const bad = [];
  if (timedOut) bad.push('не уложился во время');
  else if (code !== 0) bad.push(`код выхода ${code}`);
  const lines = out.split('\n');
  for (const l of lines) {
    if (/^FAIL/.test(l)) bad.push(l.trim().slice(0, 160));
    else if (/^✗/.test(l.trim())) bad.push(l.trim().slice(0, 160));
    const m = l.match(/^\s*ошибки:?\s*(.*)$/);
    if (m && m[1].trim() && !/^\[\s*\]$/.test(m[1].trim())) bad.push('ошибки на странице: ' + m[1].trim().slice(0, 160));
    const net = l.match(/^\s*запросы в сеть:?\s*(.*)$/);
    if (net && net[1].trim() && !/^\[\s*\]$/.test(net[1].trim())) bad.push('запросы в сеть: ' + net[1].trim().slice(0, 160));
    const no = l.match(/не открылось (\d+)/); if (no && +no[1] > 0) bad.push(l.trim());
    const pl = l.match(/плохих (\d+)/); if (pl && +pl[1] > 0) bad.push(l.trim());
  }
  if (name === 'monkey') {
    const j = out.slice(out.indexOf('{'), out.lastIndexOf('}') + 1);
    try {
      const r = JSON.parse(j);
      if (!r.games) bad.push('партия не началась');
      if (r.errors && r.errors.length) bad.push('ошибки: ' + r.errors.slice(0, 3).join(' | ').slice(0, 200));
      if (r.stalls && r.stalls.length) bad.push('зависания: ' + JSON.stringify(r.stalls.slice(0, 3)).slice(0, 200));
      if (r.overflow && r.overflow.length) bad.push('вылезает за экран: ' + JSON.stringify(r.overflow.slice(0, 3)).slice(0, 200));
    } catch (e) { bad.push('не разобрал отчёт робота'); }
  }
  const ok = lines.filter(l => /^OK/.test(l)).length;
  return { bad: [...new Set(bad)], ok };
}

const pl = (n, a, b, c) => (n % 10 === 1 && n % 100 !== 11 ? a : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 12 || n % 100 > 14) ? b : c);
const sec = (ms) => (ms < 60000 ? `${Math.round(ms / 1000)} с` : `${Math.floor(ms / 60000)} мин ${Math.round((ms % 60000) / 1000)} с`);
const run = (cmd, args, timeoutS) => { const t = Date.now(); const r = spawnSync(cmd, args, { cwd: ROOT, encoding: 'utf8', timeout: timeoutS * 1000, maxBuffer: 64 * 1024 * 1024 }); return { out: (r.stdout || '') + (r.stderr || ''), code: r.status, timedOut: !!(r.error && r.error.code === 'ETIMEDOUT') || r.signal === 'SIGTERM', ms: Date.now() - t }; };
const save = (name, out) => fs.writeFileSync(path.join(LOGS, name.replace(/[^a-z0-9_-]/gi, '_') + '.log'), out);

function main() {
  fs.mkdirSync(LOGS, { recursive: true });
  const argv = process.argv.slice(2);
  const want = argv.includes('quick') ? QUICK : argv.length ? argv : null;
  const list = want ? FULL.filter(([n, f]) => want.includes(n) || want.includes(f.replace(/\.js$/, ''))) : FULL;
  if (want && !list.length) { console.log('Нет таких тестов:', want.join(', ')); process.exit(1); }
  const t0 = Date.now(), fails = [];
  console.log(`Проверка «Претендентов»: сборка, движок и ${list.length} ${pl(list.length, 'браузерный тест', 'браузерных теста', 'браузерных тестов')}`);

  // 1. сборка и размер index.html
  const b = run('python3', ['src/build.py'], 300); save('build', b.out);
  const html = path.join(ROOT, 'index.html');
  const size = fs.existsSync(html) ? fs.statSync(html).size : 0;
  const buildOk = b.code === 0 && size > 0 && size < MAX_HTML;
  console.log(`${buildOk ? '✓' : '✗'} сборка — index.html ${Math.round(size / 1024)} КБ из ${MAX_HTML / 1024} КБ`);
  if (!buildOk) { fails.push(['сборка', [b.code !== 0 ? 'сборка упала, см. .work/check/build.log' : `index.html ${Math.round(size / 1024)} КБ — больше лимита`]]); }
  const pg = run('python3', ['tests/make-page.py'], 60); save('make-page', pg.out);
  if (pg.code !== 0) fails.push(['тестовая страница', ['make-page.py упал, см. .work/check/make-page.log']]);

  // 2. движок
  const e = run(process.execPath, ['tests/fxtest.js'], 300); save('engine', e.out);
  const em = e.out.match(/(\d+) проверок прошли, (\d+) не прошли/);
  const engOk = e.code === 0 && em && +em[2] === 0;
  console.log(`${engOk ? '✓' : '✗'} движок — ${em ? `${em[1]} прошли, ${em[2]} не прошли` : 'итог не найден'} · ${sec(e.ms)}`);
  if (!engOk) fails.push(['движок', [em ? `${em[2]} не прошли` : 'итог не найден, см. .work/check/engine.log']]);

  // 3. браузерные тесты — по одному: они меряют время и анимации, параллельно могут ложно падать
  if (buildOk && pg.code === 0) {
    for (const [name, file, args, to] of list) {
      const r = run(process.execPath, [path.join('tests', file), ...args], to || 300); save(name, r.out);
      const v = verdict(name.split(':')[0], r.out, r.code, r.timedOut);
      console.log(`${v.bad.length ? '✗' : '✓'} ${name}${v.ok ? ` — OK ${v.ok}` : ''} · ${sec(r.ms)}${v.bad.length ? `\n    ${v.bad.slice(0, 4).join('\n    ')}` : ''}`);
      if (v.bad.length) fails.push([name, v.bad]);
    }
  } else console.log('✗ браузерные тесты пропущены: нет сборки');

  // 4. итог
  const total = list.length + 2;
  console.log(fails.length
    ? `\nИТОГ: упало ${fails.length} из ${total} — ${fails.map(f => f[0]).join(', ')}. Логи: .work/check/ · ${sec(Date.now() - t0)}`
    : `\nИТОГ: всё прошло (${total} из ${total}) · ${sec(Date.now() - t0)}`);
  const st = spawnSync('git', ['status', '--porcelain', 'index.html'], { cwd: ROOT, encoding: 'utf8' });
  if (st.stdout && st.stdout.trim()) console.log('Напоминание: index.html пересобран и отличается от коммита — закоммитьте его вместе с исходниками.');
  process.exit(fails.length ? 1 : 0);
}

if (require.main === module) main();
module.exports = { verdict };

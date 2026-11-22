// Сравнение прогонов: node compare.js base.json a.json b.json ... [sizes=2,4,6]
const fs = require('fs');
const DATA = require('./data.js');
const files = process.argv.slice(2).filter(a => !a.includes('='));
const sz = (process.argv.find(a => a.startsWith('sizes=')) || '').split('=')[1];
const runs = files.map(f => ({ f: f.replace(/.*\//, '').replace(/^out-[a-z]+-/, '').replace('.json', ''), o: JSON.parse(fs.readFileSync(f, 'utf8')) }));
const sizes = sz ? sz.split(',') : Object.keys(runs[0].o.bySize);
const HS = Object.keys(DATA.HOUSES);
const sd = (a) => { const m = a.reduce((x, y) => x + y, 0) / a.length; return Math.sqrt(a.reduce((x, y) => x + (y - m) ** 2, 0) / a.length); };
for (const np of sizes) {
  const fair = 100 / np;
  console.log(`\n== ${np} игр. (норма ${fair.toFixed(1)}%) ==`);
  console.log('вариант'.padEnd(12) + 'раунды  мин   места(разброс)  лидер½ послед½  7из8  шпион% двор/игр  Дома: ' + HS.map(h => DATA.HOUSES[h].sigil).join('    ') + '  откл.');
  for (const r of runs) {
    const a = r.o.bySize[np]; if (!a) continue;
    const seat = `${Math.min(...a.seat).toFixed(0)}–${Math.max(...a.seat).toFixed(0)}`;
    const court = Object.values(a.court).reduce((x, v) => x + v.perGame, 0) / np;
    const hw = HS.map(h => a.house[h] ? a.house[h].p : NaN);
    const dev = Math.sqrt(hw.reduce((x, y) => x + (y - fair) ** 2, 0) / hw.length) / fair * 100;
    console.log(r.f.padEnd(12) + `${String(a.rounds.avg).padStart(5)} ${String(a.minutes.avg).padStart(5)}   ${seat.padStart(7)}        ${String(a.intrigue.midLeaderWins).padStart(5)} ${String(a.intrigue.winnerLastAtMid).padStart(6)} ${String(a.intrigue.closeFinish).padStart(5)} ${String(a.interaction.spyOk).padStart(6)} ${court.toFixed(2).padStart(7)}       ` + hw.map(x => x.toFixed(0).padStart(5)).join('') + `  ${dev.toFixed(0)}%`);
  }
  console.log('  характеры:');
  for (const r of runs) { const a = r.o.bySize[np]; if (!a) continue; console.log('  ' + r.f.padEnd(10) + Object.entries(a.persona).sort().map(([k, v]) => `${k} ${v.p.toFixed(1)}`).join('  ')); }
}

// Отчёт по результатам lab.js: node report.js lab/big/natural.json [sections=core,houses,cards]
const fs = require('fs');
const DATA = require('./data.js');
const file = process.argv[2];
const sec = (process.argv.find(a => a.startsWith('sections=')) || 'sections=core,houses').split('=')[1].split(',');
const o = JSON.parse(fs.readFileSync(file, 'utf8'));
const H = (h) => DATA.HOUSES[h] ? DATA.HOUSES[h].sigil : h;
const pad = (s, n) => String(s).padStart(n);
console.log(`### ${o.exp} · ${o.n} партий на размер стола${o.patch ? ' · патч ' + o.patch : ''}`);
for (const np in o.bySize) {
  const a = o.bySize[np]; const fair = 100 / np;
  console.log(`\n== ${np} игр. ==`);
  if (sec.includes('core')) {
    console.log(`раунды ${a.rounds.avg} (p10 ${a.rounds.p10}, мед ${a.rounds.med}, p90 ${a.rounds.p90}); ходов на игрока ${a.turnsPP}; минут ${a.minutes.avg} (${a.minutes.p10}–${a.minutes.p90}); ход ${a.turnSec} c; ожидание ${a.waitMin} мин; таймауты ${a.timeouts}; зависло ${a.stuck}`);
    console.log(`места: ${a.seat.map((x, i) => `${i + 1}-й ${x}%`).join(' · ')} (норма ${fair.toFixed(0)}%)`);
    const I = a.intrigue;
    console.log(`интрига: смен лидера ${I.leadChanges} (≥2 смены в ${I.twoPlusChanges}%), лидер на середине побеждает ${I.midLeaderWins}%, на 3/4 — ${I.q3LeaderWins}%, победитель отставал на середине ${I.winnerBehindAtMid}%, был последним ${I.winnerLastAtMid}%; у второго в конце ${I.runnerUpBanners} знамён, «7 из 8» у второго ${I.closeFinish}%; «решено» последние ${I.decidedShare}% партии`);
    const t = a.tempo;
    console.log(`темп: пустых ходов ${t.emptyTurns}%, карт за ход ${t.playsPerTurn}, действий ${t.actsPerTurn}; свой бросок что-то дал ${t.ownRollPays}%, чужой бросок дал вам ${t.othersRollPays}%`);
    const x = a.interaction;
    console.log(`конфликты/партию: осад ${x.sieges} (успех ${x.siegeWin}%), захватов ${x.captures}; шпионаж ${x.spies} (успех ${x.spyOk}%, откуп ${x.spyBribed}%); набеги ${x.raidGold}🪙, кражи ${x.stealGold}🪙, осады ${x.siegeGold}🪙; доля «отнятого» в доходе ${x.interShare}%; зависть ${x.envy}🪙, поддержка ${x.support}🪙, замыслов сработало ${x.plotsDone}`);
  }
  if (sec.includes('houses')) {
    console.log('Дома: ' + Object.entries(a.house).sort((p, q) => q[1].p - p[1].p).map(([h, v]) => `${H(h)} ${v.p}%±${v.ci}`).join('  '));
    console.log('характеры: ' + Object.entries(a.persona).sort((p, q) => q[1].p - p[1].p).map(([h, v]) => `${h} ${v.p}%±${v.ci}`).join('  '));
  }
  if (sec.includes('hp')) {
    const hs = Object.keys(DATA.HOUSES), ps = [...new Set(Object.keys(a.housePersona).map(k => k.split(':')[1]))];
    console.log('Дом×характер (победы %, норма ' + fair.toFixed(0) + '):\n      ' + ps.map(p => pad(p, 6)).join(''));
    for (const h of hs) console.log(`  ${H(h)}  ` + ps.map(p => { const v = a.housePersona[h + ':' + p]; return pad(v ? v.p.toFixed(0) : '-', 6); }).join(''));
  }
  if (sec.includes('profile')) {
    for (const k in a.profile) { const p = a.profile[k]; console.log(`  ${k.padEnd(5)} владений ${p.est} (🟦${p.land} 🟩${p.craft} 🟥${p.raid} 🟪${p.hold} 🧱${p.wall}) 📚${p.sci} ⚔️${p.war} 🔗${p.int} двор ${p.court} осад ${p.sieges} шпион ${p.spies} замыслов ${p.plots} золото в конце ${p.gold} пустых ${p.emptyTurns}%`); }
  }
  if (sec.includes('cards')) {
    const fmt = (m, nameOf) => Object.entries(m).sort((p, q) => q[1].win - p[1].win).map(([id, v]) => `${nameOf(id)} ${v.win}% (есть у ${v.own}%)`).join(' · ');
    console.log('владения к концу (победы владельцев):\n  ' + fmt(a.estates, id => DATA.ESTATES[id].name));
    console.log('двор (купившие):\n  ' + fmt(a.court, id => DATA.COURT[id].name));
    console.log('великие лорды (взявшие):\n  ' + fmt(a.great, id => DATA.GREAT[id].name));
  }
  if (sec.includes('regalia')) {
    for (const h in DATA.HOUSES) console.log(`  ${H(h)} ` + DATA.HOUSES[h].regalia.map(r => { const v = a.regalia[r.id]; return v ? `${r.name}: №${v.order} р.${v.round} (${v.per})` : `${r.name}: —`; }).join(' · '));
  }
}

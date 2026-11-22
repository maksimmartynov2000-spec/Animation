// Прогон партий ботов: длина партии, победы по Домам, застревания
const DATA = require('./data.js');
global.DATA = DATA;
const E = require('./engine.js');

const houses = Object.keys(DATA.HOUSES);
const N = +(process.argv[2] || 300);
const sizes = (process.argv[3] || '2,3,4,6').split(',').map(Number);

(async () => {
  for (const np of sizes) {
    const wins = {}, plays = {};
    houses.forEach(h => { wins[h] = 0; plays[h] = 0; });
    let firstWins = 0, plotsDone = {}; houses.forEach(h => plotsDone[h] = 0);
    let rounds = 0, timeouts = 0, turnsPP = 0, sieges = 0, captures = 0, stolen = 0, greatTaken = 0, maxR = 0;
    const regAtEnd = [];
    const roundsList = [];
    for (let g = 0; g < N; g++) {
      const hs = [...houses].sort(() => Math.random() - 0.5).slice(0, np);
      const S = E.newGame({ seed: 1000 + g * 7 + np, players: hs.map(h => ({ house: h, isBot: true })) });
      let guard = 0;
      while (S.winner === null && guard++ < 2000) await E.runTurn(S);
      if (S.winner === null) { console.log('STUCK', g); continue; }
      rounds += S.round; roundsList.push(S.round); maxR = Math.max(maxR, S.round);
      if (S.timeout) timeouts++;
      turnsPP += S.turnNo / np;
      hs.forEach(h => plays[h]++);
      wins[S.players[S.winner].house]++;
      if (S.winner === S.first) firstWins++;
      for (const p of S.players) { sieges += p.stats.sieges; captures += p.stats.captured; stolen += p.stats.stolen; if (p.i !== S.winner) regAtEnd.push(E.regCount(p)); }
    }
    roundsList.sort((a, b) => a - b);
    const med = roundsList[Math.floor(roundsList.length / 2)];
    console.log(`\n=== ${np} игрока, ${N} партий ===`);
    console.log(`раундов: среднее ${(rounds / N).toFixed(1)}, медиана ${med}, макс ${maxR}; ходов на игрока ${(turnsPP / N).toFixed(1)}; таймаутов ${timeouts}`);
    console.log(`проигравшие в среднем имели регалий: ${(regAtEnd.reduce((a, b) => a + b, 0) / regAtEnd.length).toFixed(2)}`);
    console.log(`на партию: осад ${(sieges / N).toFixed(1)}, захватов ${(captures / N).toFixed(1)}, украдено ${(stolen / N).toFixed(1)}🪙`);
    console.log(`первый игрок побеждает: ${(100 * firstWins / N).toFixed(0)}%`);
    console.log('победы (доля от участий):', houses.map(h => `${DATA.HOUSES[h].sigil}${(100 * wins[h] / Math.max(1, plays[h])).toFixed(0)}%`).join('  '), ` (ожидание ${(100 / np).toFixed(0)}%)`);
  }
})();

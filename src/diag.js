const DATA = require('./data.js'); global.DATA = DATA;
const E = require('./engine.js');
const houses = Object.keys(DATA.HOUSES);
const N = +(process.argv[2]||300), np = +(process.argv[3]||2);
(async()=>{
  const agg = {}; houses.forEach(h=>agg[h]={n:0,w:0,rollInc:0,raidInc:0,cardGold:0,startInc:0,trade:0,sieges:0,siegeWins:0,captured:0,lost:0,stolen:0,est:0,dice2:0});
  for (let g=0; g<N; g++){
    const hs=[...houses].sort(()=>Math.random()-0.5).slice(0,np);
    const S=E.newGame({seed:5000+g, players:hs.map(h=>({house:h,isBot:true}))});
    const d2 = {};
    while(S.winner===null) { await E.runTurn(S); for (const p of S.players) if (d2[p.i]==null && E.mods(S,p).dice2) d2[p.i]=S.round; }
    for (const p of S.players){ const a=agg[p.house]; a.n++; if (S.winner===p.i) a.w++; for (const k of ['rollInc','raidInc','cardGold','startInc','trade','sieges','siegeWins','captured','lost','stolen']) a[k]+=p.stats[k]; a.est+=p.estates.length; a.dice2 += d2[p.i]||S.round; }
  }
  console.log('дом  win%  roll  raid  cards start trade sieges wins capt lost stolen estates dice2rnd');
  for (const h of houses){ const a=agg[h]; if(!a.n) continue; const f=k=>(a[k]/a.n).toFixed(1).padStart(5); console.log(DATA.HOUSES[h].sigil, (100*a.w/a.n).toFixed(0).padStart(4), f('rollInc'),f('raidInc'),f('cardGold'),f('startInc'),f('trade'),f('sieges'),f('siegeWins'),f('captured'),f('lost'),f('stolen'),f('est'),f('dice2')); }
})();

// Случайный «человек»: проверяем, что движок не падает на любых действиях
const DATA = require('./data.js'); global.DATA = DATA;
const E = require('./engine.js');
const houses = Object.keys(DATA.HOUSES);
function R(n){ return Math.floor(Math.random()*n); }
(async()=>{
  let games=0, errors=0, turns=0;
  E.setHooks({
    ask: async (S,p,q)=>{
      switch(q.type){
        case 'target': return q.options[R(q.options.length)].i;
        case 'capture': return q.options[R(q.options.length)];
        case 'bribe': return Math.random()<0.5;
        case 'adjust': { const r=Math.random(); if (r<0.3) return {a:'accept'}; if (r<0.5 && q.rerolls) return {a:'reroll'}; if (q.shifts.length) return {a:'shift', k:R(q.shifts.length), d: Math.random()<0.5?-1:1}; if (q.canHarbor) return {a:'harbor'}; return {a:'accept'}; }
        case 'plotNums': return Array.from({length:q.count},()=>1+R(12));
        case 'trash': return [R(p.hand.length+1)-1].filter(x=>x>=0);
      }
    },
    humanTurn: async (S,p)=>{
      for (let k=0;k<12;k++){
        const r=Math.random();
        if (r<0.35 && p.hand.length){ const i=R(p.hand.length); const c=DATA.COURT[p.hand[i]]; await E.play(S,p,i, c.plot && Math.random()<0.4 ? {plot:true}: {}); }
        else if (r<0.5 && !p.turn.rolled) await E.roll(S,p,1+R(2));
        else if (r<0.7) { const src=['basic','estate','court'][R(3)]; const key= src==='basic' ? ['field','bakery','wall'][R(3)] : R(4); await E.buy(S,p,src,key); }
        else if (r<0.85) { const own = DATA.HOUSES[p.house].regalia[R(6)].id; await E.build(S,p,'own',own); if (S.greatRow.length) await E.build(S,p,'great',S.greatRow[R(S.greatRow.length)]); }
        if (S.winner!==null) return;
      }
    }
  });
  for (let g=0; g<300; g++){
    const np=2+R(5);
    const hs=[...houses].sort(()=>Math.random()-0.5).slice(0,np);
    const S=E.newGame({players:hs.map((h,i)=>({house:h,isBot: i>0 && Math.random()<0.5}))});
    try { let guard=0; while(S.winner===null && guard++<3000){ await E.runTurn(S); turns++; }
      // инварианты
      for (const p of S.players){ if (p.gold<0 || !Number.isFinite(p.gold)) throw new Error('gold '+p.gold); if (new Set(p.estates.map(e=>e.uid)).size!==p.estates.length) throw new Error('dup uid'); }
      JSON.parse(JSON.stringify(S));
      games++;
    } catch(e){ errors++; console.log('ERR', e.stack.split('\n').slice(0,4).join('\n')); if (errors>3) break; }
  }
  console.log('games', games, 'errors', errors, 'turns', turns);
})();

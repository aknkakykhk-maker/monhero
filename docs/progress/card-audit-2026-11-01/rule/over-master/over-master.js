// 戦術カードで MASTER を超えられるかを測る(2026-11-02 ルールくん・社長の質問への答え用。直しはしない)
//   node over-master.js <root> <助手> <試合数> <組み方…>
const fs=require('fs'),path=require('path'),vm=require('vm');
const ROOT=path.resolve(process.argv[2]),W=process.argv[3]||'mua',N=Number(process.argv[4]||100),ONLY=process.argv.slice(5);
const GAME=path.join(ROOT,'monster-hero'),PART=(n)=>fs.readFileSync(path.join(GAME,'src','parts',n),'utf8');
const ctx=vm.createContext({console,Math,JSON,Object,Array,Number,String,Set,Map,Date});
vm.runInContext(`${fs.readFileSync(path.join(GAME,'data','card-battle-cards.js'),'utf8')}\n;\n${PART('82-card-battle-core.jsx')}\n;\n${PART('82-card-tactics-core.jsx')}\n;\n${PART('82-card-share-core.jsx')}\n;\nthis.E={CARD_BATTLE_DATA,cardSharePolicy,cardShareSmartLevel,cardTacticPackFrames,cardAiTacticGambit,CARD_AI_TACTIC_BASE,cardAiPolicy,cardAiBuildDeck,cardAiSeededRand,cardSimulate};`,ctx);
const E=ctx.E,db=E.CARD_BATTLE_DATA;
const R=(c,a)=>({c,a,on:true});
const good=[R('ko','atk'),R('incomingKo','guard'),R('foeLife.30','atk'),R('foeAlive.1','atk'),R('myGuts.5','cost.大技(4以上)')];
const good2=[R('ko','atk'),R('incoming.5','guard'),R('lowest','atk'),R('foeStun','atk'),R('attacker','atk')];
const good3=[R('ko','atk'),R('incomingKo','guard'),R('strongest','atk'),R('leader','atk'),R('foeCharge','atk')];
const base3=E.CARD_AI_TACTIC_BASE[W];
const tac=(base,mons)=>({habit:W,f:E.cardTacticPackFrames({base,breeder:[],mons})});
const V={
  なし:{habit:W},
  助手MASTERそのまま:'helper',
  助手と同じカードを登録:tac(base3,E.cardAiTacticGambit(W,'master').mons),
  基本3枚だけ:tac(base3,[[],[],[]]),
  基本2枚と良い行:tac(base3.slice(0,2),[good,good2,good3]),
  基本3枚と良い行:tac(base3,[good,good2,good3]),
};
for(const [name,t] of Object.entries(V)){
  if(ONLY.length&&!ONLY.includes(name))continue;
  let win=0,lose=0,t0=Date.now();
  for(let g=0;g<N;g++){
    const rnd=E.cardAiSeededRand(`${W}:om:${g}`);
    const dP=E.cardAiBuildDeck(db,W,'master',rnd);
    const dO=E.cardAiBuildDeck(db,W,'master',rnd,{playerDeck:dP});
    const pP=t==='helper'?E.cardAiPolicy(W,'master',{sameBlood:!!dP.sameBlood}):E.cardSharePolicy(t,null);
    const pO=E.cardAiPolicy(W,'master',{sameBlood:!!dO.sameBlood});
    const st=E.cardSimulate(db,{decks:[dP,dO],policies:[pP,pO],seed:9100+g,first:g%2});
    if(st.winner===0)win++;else if(st.winner===1)lose++;
  }
  console.log(name.padEnd(14,'　'),'賢さ',t==='helper'?'(助手)':E.cardShareSmartLevel(t),'勝率',(win*100/N).toFixed(0)+'%','負け',lose,'引分',N-win-lose,((Date.now()-t0)/1000).toFixed(0)+'秒');
}

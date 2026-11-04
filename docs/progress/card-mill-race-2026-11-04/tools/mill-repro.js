// 再現: 「毎ターン手札を1枚だけガッツにする」だけのプレイヤーに、助手が山札切れで負けるか
//   node mill-repro.js <root> <試合数/組> [助手…]
const fs=require('fs'),path=require('path'),vm=require('vm');
const [root,N0,...WS]=process.argv.slice(2);const N=Number(N0||20);
const G=path.join(path.resolve(root),'monster-hero'),PART=(n)=>fs.readFileSync(path.join(G,'src','parts',n),'utf8');
const ctx=vm.createContext({console,Math,JSON,Object,Array,Number,String,Set,Map,Date});
vm.runInContext(`${fs.readFileSync(path.join(G,'data/card-battle-cards.js'),'utf8')}\n;\n${PART('82-card-battle-core.jsx')}\n;\n${PART('82-card-tactics-core.jsx')}\n;\nthis.E={CARD_BATTLE_DATA,cardAiPolicy,cardAiBuildDeck,cardAiSeededRand,cardCreateGame,cardAiChooseAction,cardApplyAction,cardDecider,cardOther,cardOf};`,ctx);
const E=ctx.E,db=E.CARD_BATTLE_DATA;
const W=WS.length?WS:['mua','momosuke','kiki','kyuko','dra','atsu','sorashido'];
const LV=['easy','normal','hard','expert','master'];
// プレイヤー: P1 = 何もしない(攻めない・守らない)で毎ターン1枚だけガッツ / P2 = 守りはふつう・攻めない・1枚だけガッツ
const playerAct=(mode,st,pol,rand)=>{
  if(mode==='P0')return E.cardAiChooseAction(db,st,pol,rand);
  if(mode==='P3'){ if(st.phase==='guts'){const a=E.cardAiChooseAction(db,st,pol,rand);return {type:'guts',hand:(a.hand||[]).slice(0,1)};} return E.cardAiChooseAction(db,st,pol,rand); }
  if(st.phase==='setup')return {type:'setupGuts',hand:[]};
  if(st.pending)return mode==='P2'?E.cardAiChooseAction(db,st,pol,rand):{type:'pass'};
  if(st.phase==='guts'){const h=st.players[st.active].hand;return {type:'guts',hand:h.length?[0]:[]};}
  if(st.phase==='main')return {type:'endAttacks'};
  return E.cardAiChooseAction(db,st,pol,rand);
};
const rows=[];
for(const mode of (process.env.MODES||'P0,P3').split(',')){
  for(const lv of LV){const r={mode,lv,n:0,pw:0,deckout:0,turns:0,per:{}};
    for(const w of W){let pw=0;
      Object.keys(db.starters).forEach((k,ki)=>{for(let g=0;g<N;g++){
        const pd=E.cardAiBuildDeck(db,k);const d=E.cardAiBuildDeck(db,w,lv,E.cardAiSeededRand(`mr:${w}:${lv}:${k}:${g}`),{playerDeck:pd});
        const pols=[E.cardAiPolicy('kyuko','master',{playerRole:true}),E.cardAiPolicy(w,lv,{sameBlood:!!d.sameBlood})];
        let st=E.cardCreateGame(db,{decks:[pd,d],seed:600+g*3+ki,first:g%2});const rand=E.cardAiSeededRand('mrr'+g+w+k+lv);let steps=0;
        while(st.winner===null&&steps++<4000){
          const who=st.pendingDiscard?st.pendingDiscard.p:st.phase==='setup'?E.cardOther(st.first):E.cardDecider(st);
          let a=who===0?(st.pendingDiscard||st.pendingChoice||st.pendingPray||st.pendingReveal?E.cardAiChooseAction(db,st,pols[0],rand):playerAct(mode,st,pols[0],rand)):E.cardAiChooseAction(db,st,pols[1],rand);
          let n=a&&E.cardApplyAction(db,st,a);if(!n){a=st.pending?{type:'pass'}:st.phase==='main'?{type:'endAttacks'}:st.phase==='guts'?{type:'guts',hand:[]}:null;n=a&&E.cardApplyAction(db,st,a);if(!n)break;}
          st=n;st.log=[];
        }
        r.n++;if(st.winner===0){r.pw++;pw++;}if(st.reason&&/deck|山札/.test(st.reason))r.deckout++;r.turns+=st.turn;
      }});
      r.per[w]=Math.round(pw*100/(N*3));
    }
    console.log(mode,lv,'プレイヤーの勝率',Math.round(r.pw*1000/r.n)/10+'%','山札切れで決着',Math.round(r.deckout*100/r.n)+'%','平均ターン',(r.turns/r.n).toFixed(0),JSON.stringify(r.per));
  }
}

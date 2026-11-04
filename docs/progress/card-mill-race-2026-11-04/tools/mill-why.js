const fs=require('fs'),path=require('path'),vm=require('vm');
const [root,W,LV,N0]=process.argv.slice(2);const N=Number(N0||30);
const G=path.join(path.resolve(root),'monster-hero'),PART=(n)=>fs.readFileSync(path.join(G,'src','parts',n),'utf8');
const ctx=vm.createContext({console,Math,JSON,Object,Array,Number,String,Set,Map,Date});
vm.runInContext(`${fs.readFileSync(path.join(G,'data/card-battle-cards.js'),'utf8')}\n;\n${PART('82-card-battle-core.jsx')}\n;\n${PART('82-card-tactics-core.jsx')}\n;\nthis.E={CARD_BATTLE_DATA,cardAiPolicy,cardAiBuildDeck,cardAiSeededRand,cardCreateGame,cardAiChooseAction,cardApplyAction,cardDecider,cardOther,cardOf};`,ctx);
const E=ctx.E,db=E.CARD_BATTLE_DATA;
const tot={games:0,pw:0,deckout:0,aiGuts:0,aiGutsTurns:0,plGuts:0,plGutsTurns:0,aiPlays:0,plPlays:0,aiMill:0,endDeckAI:0,endDeckPl:0,aiKos:0,plKos:0,reasons:{}};
Object.keys(db.starters).forEach((k,ki)=>{for(let g=0;g<N;g++){
  const pd=E.cardAiBuildDeck(db,k);const d=E.cardAiBuildDeck(db,W,LV,E.cardAiSeededRand(`mw:${W}:${k}:${g}`),{playerDeck:pd});
  const pols=[E.cardAiPolicy('kyuko','master',{playerRole:true}),E.cardAiPolicy(W,LV,{sameBlood:!!d.sameBlood})];
  let st=E.cardCreateGame(db,{decks:[pd,d],seed:900+g*3+ki,first:g%2});const rand=E.cardAiSeededRand('mw'+g+k);let steps=0;
  while(st.winner===null&&steps++<4000){
    const who=st.pendingDiscard?st.pendingDiscard.p:st.phase==='setup'?E.cardOther(st.first):E.cardDecider(st);
    let a=E.cardAiChooseAction(db,st,pols[who],rand);
    if(who===0&&a&&a.type==='guts'&&st.phase==='guts')a={type:'guts',hand:(a.hand||[]).slice(0,1)};
    if(a&&a.type==='guts'&&st.phase==='guts'){if(who===1){tot.aiGuts+=a.hand.length;tot.aiGutsTurns++;}else{tot.plGuts+=a.hand.length;tot.plGutsTurns++;}}
    if(a&&a.type==='guard'&&who===1)tot.aiGuard=(tot.aiGuard||0)+1;if(a&&a.type==='guard'&&who===0)tot.plGuard=(tot.plGuard||0)+1;
    if(a&&(a.type==='attack'||a.type==='breeder')){const c=E.cardOf(db,st.players[who].hand[a.hand[0]]);(tot.eff=tot.eff||{});((c&&c.effects)||[]).forEach(e=>{if(/draw|rush|deckToGuts|refresh|choose|mill|oppDraw|discard|gutsToDeck/i.test(e.t))tot.eff[(who?'AI:':'P:')+e.t]=(tot.eff[(who?'AI:':'P:')+e.t]||0)+1;});}
    if(a&&(a.type==='attack'||a.type==='breeder')){if(who===1){tot.aiPlays+=a.hand.length;const c=E.cardOf(db,st.players[1].hand[a.hand[0]]);if(c&&(c.effects||[]).some(e=>/mill|oppDraw/i.test(e.t)))tot.aiMill++;}else tot.plPlays+=a.hand.length;}
    let n=a&&E.cardApplyAction(db,st,a);if(!n){a=st.pending?{type:'pass'}:st.phase==='main'?{type:'endAttacks'}:st.phase==='guts'?{type:'guts',hand:[]}:null;n=a&&E.cardApplyAction(db,st,a);if(!n)break;}
    st=n;st.log=[];
  }
  tot.games++;if(st.winner===0)tot.pw++;tot.reasons[(st.winner===0?'P勝ち:':'AI勝ち:')+(st.reason||'?')]=(tot.reasons[(st.winner===0?'P勝ち:':'AI勝ち:')+(st.reason||'?')]||0)+1;
  tot.endDeckAI+=st.players[1].deck.length;tot.endDeckPl+=st.players[0].deck.length;
}});
const g=tot.games;console.log(W,LV,JSON.stringify({プレイヤー勝率:Math.round(tot.pw*100/g),決着:tot.reasons,AIのガッツ1回あたり:(tot.aiGuts/tot.aiGutsTurns).toFixed(2),プレイヤーのガッツ1回あたり:(tot.plGuts/tot.plGutsTurns).toFixed(2),AIの出した札_1試合:(tot.aiPlays/g).toFixed(1),プレイヤーの出した札_1試合:(tot.plPlays/g).toFixed(1),AIの削る札_1試合:(tot.aiMill/g).toFixed(1),終わりの山札_AI:(tot.endDeckAI/g).toFixed(1),終わりの山札_P:(tot.endDeckPl/g).toFixed(1),守り_AI:((tot.aiGuard||0)/g).toFixed(1),守り_P:((tot.plGuard||0)/g).toFixed(1),山札を使う効果:tot.eff,初めの山札:[0,1].map(i=>0)}));

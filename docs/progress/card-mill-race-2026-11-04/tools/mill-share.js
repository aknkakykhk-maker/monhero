// 再現: 山札切れ狙いの戦術カード入り登録デッキ(AI)を、人間(毎ターン1枚だけガッツ)が相手する
//   node mill-share.js <root> <試合数/スターター> [P0|P3] [owner]  owner=share(登録デッキが AI)/auto(人間側がオートで同じデッキ)
const fs=require('fs'),path=require('path'),vm=require('vm');
const [root,N0,MODE0,OWN]=process.argv.slice(2);const N=Number(N0||30),MODE=MODE0||'P3';
const G=path.join(path.resolve(root),'monster-hero'),PART=(n)=>fs.readFileSync(path.join(G,'src','parts',n),'utf8');
const ctx=vm.createContext({console,Math,JSON,Object,Array,Number,String,Set,Map,Date});
let CORE=PART('82-card-battle-core.jsx');if(process.env.PATCH)JSON.parse(process.env.PATCH).forEach(([a,b])=>{if(!CORE.includes(a))throw new Error('patch miss '+a);CORE=CORE.split(a).join(b);});
vm.runInContext(`${fs.readFileSync(path.join(G,'data/card-battle-cards.js'),'utf8')}\n;\n${CORE}\n;\n${PART('82-card-tactics-core.jsx')}\n;\n${PART('82-card-share-core.jsx')}\n;\nthis.E={CARD_BATTLE_DATA,cardSharePolicy,cardTacticPackFrames,cardShareSmartLevel,cardAiPolicy,cardAiBuildDeck,cardAiSeededRand,cardCreateGame,cardAiChooseAction,cardApplyAction,cardDecider,cardOther,cardOf,cardMonsterOf};`,ctx);
const E=ctx.E,db=E.CARD_BATTLE_DATA;
const R=(c,a)=>({c,a,on:true});
// 山札切れ狙いの組み方(えるびんさんの形の想像): 持久型+崩し型+守り型、場に「山札を削る」全体カード、相手の山札が減ったら削る
const EL=process.env.ELBIN?JSON.parse(fs.readFileSync(process.env.ELBIN,'utf8')):null;
const t=EL?EL.tactics:{habit:'sorashido',f:E.cardTacticPackFrames({base:['tMill','tDisrupt','tGuard'],breeder:[R('noField','fieldKind.山札を削る'),R('any','fieldKind.山札を削る')],mons:[[R('foeDeck.30','disrupt.山札を削る'),R('ko','atk')],[R('foeDeck.30','disrupt.山札を削る'),R('ko','atk')],[R('foeDeck.30','disrupt.山札を削る'),R('ko','atk')]]})};
const millDeck=(seed)=>{if(EL)return EL.deck;const d=E.cardAiBuildDeck(db,'sorashido','master',E.cardAiSeededRand(seed));const cards=d.cards.slice();
  const add=['F120','F120','F120'];const usable=(no)=>{const c=E.cardOf(db,no);return c&&d.monsters.some(m=>{const mm=E.cardMonsterOf(db,m);return mm&&(c.user===mm.species||c.user==='any'||c.user==='breeder');});};
  ['306','149'].forEach(no=>{if(usable(no))add.push(no,no);});
  for(let i=0;i<add.length;i++)cards[cards.length-1-i]=add[i];return {...d,cards};};
let pw=0,n=0,reasons={},millUsed=0;const S={g:0,gt:0,hg:0,hgt:0,f:0,fBehind:0,plays:0,guard:0,endAI:0,endH:0};const human=(st,pol,rand)=>{const a=E.cardAiChooseAction(db,st,pol,rand);if(MODE==='P3'&&a&&a.type==='guts'&&st.phase==='guts')return {type:'guts',hand:(a.hand||[]).slice(0,1)};return a;};
Object.keys(db.starters).forEach((k,ki)=>{for(let g=0;g<N;g++){
  const pd=E.cardAiBuildDeck(db,k);const md=millDeck(`ms:${k}:${g}`);
  const sp=E.cardSharePolicy(t,null);
  const hp=OWN==='auto'?sp:E.cardAiPolicy('kyuko','master',{playerRole:true});
  const decks=OWN==='auto'?[md,E.cardAiBuildDeck(db,'sorashido','master',E.cardAiSeededRand('o'+k+g))]:[pd,md];
  const pols=OWN==='auto'?[hp,E.cardAiPolicy('kyuko','master',{playerRole:true})]:[hp,sp];
  let st=E.cardCreateGame(db,{decks,seed:800+g*3+ki,first:g%2});const rand=E.cardAiSeededRand('msr'+g+k);let steps=0;
  while(st.winner===null&&steps++<4000){
    const who=st.pendingDiscard?st.pendingDiscard.p:st.phase==='setup'?E.cardOther(st.first):E.cardDecider(st);
    let a=OWN==='auto'?(who===1?human(st,pols[1],rand):E.cardAiChooseAction(db,st,pols[0],rand)):(who===0?human(st,pols[0],rand):E.cardAiChooseAction(db,st,pols[1],rand));
    if(a&&(a.type==='attack'||a.type==='breeder')&&who===(OWN==='auto'?0:1)){const c=E.cardOf(db,st.players[who].hand[a.hand[0]]);if(c&&(c.effects||[]).some(e=>['millOpp','oppDraw','fieldMill'].includes(e.t)))millUsed++;}
    {const ai=OWN==='auto'?0:1;if(who===ai&&a&&a.type==='guts'&&st.phase==='guts'){S.g+=a.hand.length;S.gt++;}if(who!==ai&&a&&a.type==='guts'&&st.phase==='guts'){S.hg+=a.hand.length;S.hgt++;}
     if(who===ai&&a&&(a.type==='attack'||a.type==='breeder')){const c=E.cardOf(db,st.players[who].hand[a.hand[0]]);if(c&&c.no==='F120'){S.f++;if(st.players[ai].deck.length<=st.players[1-ai].deck.length)S.fBehind++;}S.plays+=a.hand.length;}
     if(who===ai&&a&&a.type==='guard')S.guard++;}
    let nn=a&&E.cardApplyAction(db,st,a);if(!nn){a=st.pending?{type:'pass'}:st.phase==='main'?{type:'endAttacks'}:st.phase==='guts'?{type:'guts',hand:[]}:null;nn=a&&E.cardApplyAction(db,st,a);if(!nn)break;}
    st=nn;st.log=[];
  }
  const humanSide=OWN==='auto'?1:0;n++;S.endAI+=st.players[1-humanSide].deck.length;S.endH+=st.players[humanSide].deck.length;if(st.winner===humanSide)pw++;const key=(st.winner===humanSide?'人間の勝ち:':'AIの勝ち:')+(st.reason||'?');reasons[key]=(reasons[key]||0)+1;
}});
console.log(MODE,OWN||'share','賢さ',E.cardShareSmartLevel(t),'人間の勝率',Math.round(pw*1000/n)/10+'%',JSON.stringify(reasons),'削る札/試合',(millUsed/n).toFixed(1),JSON.stringify({AIガッツ:(S.g/S.gt).toFixed(2),人ガッツ:(S.hg/S.hgt).toFixed(2),大混乱:(S.f/n).toFixed(2),大混乱_山札で負けているとき:(S.fBehind/n).toFixed(2),AIの札:(S.plays/n).toFixed(1),AIの守り:(S.guard/n).toFixed(1),終わりの山札AI:(S.endAI/n).toFixed(1),人:(S.endH/n).toFixed(1)}));

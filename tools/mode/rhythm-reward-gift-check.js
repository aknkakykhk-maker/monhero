// モンヒロビートの報酬が「ギフト経由」で正しく届くかを、実際に動かして確かめる。
//
// 2026-09-14・ユーザー指摘「イベント報酬が直接アイテム欄に入ってた / ギフト経由して」。
// 文字列を見るだけの検査では「中身が合っているか」は分からないので、
// 報酬 → ギフトの中身 → 受け取り、まで通して数を突き合わせる。
//
//   node tools/mode/rhythm-reward-gift-check.js
const fs=require('fs'),path=require('path'),vm=require('vm');
const ROOT=path.resolve(__dirname,'../..');
const src=fs.readFileSync(path.join(ROOT,'monster-hero/src/game-system.jsx'),'utf8');
const grab=(a,b)=>{const i=src.indexOf(a),j=src.indexOf(b);return (i<0||j<0||j<i)?'':src.slice(i,j);};
const one=(re)=>(src.match(re)||[''])[0];

let failed=0;
const check=(name,ok,detail='')=>{console.log(`${ok?'✓':'✗'} ${name}${detail?` — ${detail}`:''}`);if(!ok)failed++;};

// 本番の実装をそのまま持ち込む。血統の一覧とマーケットの一覧だけ、動かすための見本にする
// (どちらも「名前を引くための材料」で、ギフトの組み立てとは関係がないため)
const ctx={console};
vm.createContext(ctx);
const prelude=[
  "const speciesChallengeLineages=()=>[{id:'suezo',name:'スエゾー'},{id:'mocchi',name:'モッチー'}];",
  "const BREEDER_MARKET_ITEMS=[{id:'rainbow_psyche',type:'item',name:'虹のプシュケー',emoji:'🌈'}];",
  one(/^const SPECIES_TRANSCEND_FRUIT_ITEM_ID_PREFIX = .*$/m),
  one(/^const RAINBOW_TRANSCEND_FRUIT_ITEM_ID = .*$/m),
  grab('let _speciesTranscendFruitItems = null;','let _transcendFruitItemIds = null;'),
  one(/^const HERO_PROOF_ITEM_ID = .*$/m),
  grab('const HERO_PROOF_ITEM = Object.freeze({','const HERO_PROOF_CLEAR_REWARDS'),
  one(/^const ownedItemCount = .*$/m),
  one(/^const GIFT_REWARD_LABELS = .*$/m),
  grab('const GIFT_ITEM_REWARD_TYPE','const missionDailyPeriod'),
  grab('const rhythmEventRewardItem=','const RhythmEventBanner='),
  grab('const rhythmEventGiftRewards=','const rhythmEventParticipationText='),
  'this.o={rhythmEventGiftRewards,grantGiftOnce,buildGiftClaim,giftRewardText,normalizeGiftRewards,'
  +'HERO_PROOF_ITEM_ID,HERO_PROOF_SHARD_ITEM_ID,speciesTranscendFruitItems};',
].join('\n');
// 切り出しに失敗する(範囲が空になる)と、検査がまるごと空回りするので先に確かめる
check('本番の実装を取り出せている',[
  ['勇者の証',grab('const HERO_PROOF_ITEM = Object.freeze({','const HERO_PROOF_CLEAR_REWARDS')],
  ['種族の超越の実',grab('let _speciesTranscendFruitItems = null;','let _transcendFruitItemIds = null;')],
  ['ギフト',grab('const GIFT_ITEM_REWARD_TYPE','const missionDailyPeriod')],
  ['報酬のアイテム解決',grab('const rhythmEventRewardItem=','const RhythmEventBanner=')],
  ['ギフトの組み立て',grab('const rhythmEventGiftRewards=','const rhythmEventParticipationText=')],
].every(([, text])=>text.length>50));
vm.runInContext(prelude,ctx);
const o=ctx.o;
const fruitId=(lineageId)=>o.speciesTranscendFruitItems()[lineageId].id;
const claimWith=(rewards,balances)=>o.buildGiftClaim(
  {id:'x',title:'t',source:'rhythmEvent',rewards,claimedAt:null},balances);

// ===== イベント(週末ゲリラ杯の形) =====
// 曲の部門で1位(超越の実×5＋プシュケー1000)、総合で3位(勇者の証×3＋プシュケー600)、
// 参加賞(勇者の証×10＋ダイヤ3000＋プシュケー50)
{
  const prize={
    event:{id:'weekend_2026_09_11',name:'モンヒロビート 週末ゲリラ杯'},
    prizes:[
      {divisionId:'song:monster_hero',rank:1,reward:{kind:'speciesFruit',lineageId:'suezo',count:5,psyche:1000}},
      {divisionId:'total',rank:3,reward:{kind:'heroProof',count:3,psyche:600}},
    ],
    participation:{songs:3,gold:3000,psyche:50,heroProof:10},
  };
  const rewards=o.rhythmEventGiftRewards(prize);
  check('ギフトの中身を作れる',rewards.length>0,rewards.map(r=>o.giftRewardText(r)).join(' ／ '));
  check('同じ種類は1行にまとまる(プシュケーが何行も並ばない)',
    rewards.filter(r=>r.type==='rainbowPsyche').length===1
    &&rewards.filter(r=>r.type===o.GIFT_ITEM_REWARD_TYPE&&r.itemId===o.HERO_PROOF_ITEM_ID).length<=1);
  const claim=claimWith(rewards,{gold:100,breederPoints:0,breederXp:0,ownedItems:{hero_proof:2}});
  check('ギフトを受け取れる',claim.ok===true,claim.reason||'');
  const items=claim.ok?claim.balances.ownedItems:{};
  check('勇者の証は入賞3個＋参加賞10個＝13個(元の2個に足される)',items.hero_proof===15,String(items.hero_proof));
  check('超越の実は種族ぶんがそのまま入る',items[fruitId('suezo')]===5,String(items[fruitId('suezo')]));
  check('虹のプシュケーは部門ぶんと参加賞の合計',items.rainbow_psyche===1650,String(items.rainbow_psyche));
  check('ダイヤは mh_gold 側へ入る',claim.ok&&claim.balances.gold===3100,String(claim.ok&&claim.balances.gold));
  check('受け取ったギフトには受取日が付く(二度目は受け取れない)',
    !!claim.gift.claimedAt&&claimWith(rewards,{gold:0,ownedItems:{}}).ok===true
    &&o.buildGiftClaim(claim.gift,{gold:0,ownedItems:{}}).ok===false);
}

// ===== 週間ランキングの形(勇者の証片) =====
{
  const prize={event:{id:'weekly_2026_09_14',name:'週間ランキング',kind:'weekly'},
    prizes:[{divisionId:'total',rank:1,reward:{kind:'heroProofShard',count:10,psyche:500,gold:30000}}],
    participation:{plays:3,count:1,psyche:30,gold:2000}};
  const rewards=o.rhythmEventGiftRewards(prize);
  const claim=claimWith(rewards,{gold:0,breederPoints:0,breederXp:0,ownedItems:{}});
  check('週間もギフトで受け取れる',claim.ok===true);
  const items=claim.ok?claim.balances.ownedItems:{};
  check('勇者の証片は順位10個＋参加賞1個＝11個',items[o.HERO_PROOF_SHARD_ITEM_ID]===11,String(items[o.HERO_PROOF_SHARD_ITEM_ID]));
  check('週間のダイヤは順位30,000＋参加賞2,000＝32,000',claim.ok&&claim.balances.gold===32000,String(claim.ok&&claim.balances.gold));
  check('週間のプシュケーは500＋30＝530',items.rainbow_psyche===530,String(items.rainbow_psyche));
}

// ===== 壊れた値・二重付与 =====
{
  check('報酬が無いときは空になる(空のギフトを作らない)',
    o.rhythmEventGiftRewards(null).length===0
    &&o.rhythmEventGiftRewards({prizes:[],participation:null}).length===0);
  check('0個の報酬は入れない',
    o.rhythmEventGiftRewards({prizes:[{reward:{kind:'heroProof',count:0,psyche:0,gold:0}}]}).length===0);
  const gift={id:'rhythm_event_test',title:'t',source:'rhythmEvent',
    rewards:[{type:'diamond',amount:10}]};
  const first=o.grantGiftOnce([],gift);
  const second=o.grantGiftOnce(first.gifts,gift);
  check('同じidのギフトは二重に作らない',first.granted===true&&second.granted===false&&second.gifts.length===1);
  check('中身が壊れているギフトは足さない',
    o.grantGiftOnce([],{id:'bad',rewards:[{type:'gameItem',itemId:'nazo_item',amount:1}]}).granted===false
    &&o.grantGiftOnce([],{id:'bad2',rewards:[{type:'diamond',amount:0}]}).granted===false);
  check('既存のギフトの形はそのまま読める(diamond / rainbowPsyche など)',
    JSON.stringify(o.normalizeGiftRewards({rewards:[{type:'diamond',amount:5},{type:'rainbowPsyche',amount:3}]}))
    ==='[{"type":"diamond","amount":5},{"type":"rainbowPsyche","amount":3}]');
  check('知らないアイテムidは配らない',
    o.normalizeGiftRewards({rewards:[{type:'gameItem',itemId:'nazo_item',amount:1}]})===null);
}

console.log(failed?`\n${failed}件のNGがあります`:'\nすべてOK');
process.exit(failed?1:0);

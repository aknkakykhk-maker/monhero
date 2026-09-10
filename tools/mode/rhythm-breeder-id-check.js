// モンビー(音ゲー)のブリーダーID(breeder_id)まわりを見る。2026-09-11。
//
// 全国ランキングはこれまで user_name だけで人を見分けていた。曲別ランキング(その名前の
// 最高1件を見せるだけ)なら同名がいても大きな害は無いが、これから作る「全曲合算」は
// その人の全曲を足すため、同名の人がいると別人の点まで足されてしまう。
// そこで端末ごとのIDを送ることにした(docs/spec/RHYTHM_RANKING.md §4)。
//
// ここで一番大事なのは次の2つ。どちらも壊れると被害が大きいのに、実際に1曲遊ばないと
// 通らない経路なので、目で確かめるのに何分もかかる。
//
//   ① breeder_id の列がまだ無い環境でも、スコアが必ず保存されること
//      (列を外して送り直す。ここが崩れると、SQLを適用するまで新しい記録が1件も残らない)
//   ② 保存できないときはIDを付けずに送ること
//      (初回プレイのプレビュー中は storeSet が丸ごと止まる。そこで確かめずに返すと、
//       毎回ちがう「その場かぎりのID」が送られ、かえって人を見分けられなくなる)
//
//   node tools/mode/rhythm-breeder-id-check.js
const fs=require('fs'),path=require('path'),vm=require('vm');
const ROOT=path.resolve(__dirname,'../..'),read=file=>fs.readFileSync(path.join(ROOT,file),'utf8');
const supa=read('monster-hero/src/parts/26-supabase.jsx');
const app=read('monster-hero/src/parts/60-app.jsx');
const game=read('monster-hero/src/game-system.jsx');
const spec=read('docs/spec/RHYTHM_RANKING.md');

let failed=0;
const check=(name,ok,detail='')=>{console.log(`${ok?'✓':'✗'} ${name}${detail?` — ${detail}`:''}`);if(!ok)failed++;};

// --- 対象のブロックを切り出す ---
const start=supa.indexOf("const BREEDER_ID_KEY = 'mh_breeder_id_v1';");
const insertStart=supa.indexOf('const sbInsertRhythmScore = async (row) => {');
const insertEnd=insertStart>=0?supa.indexOf('\n};',insertStart)+3:-1;
check('breeder_idと送信のブロックを抽出できる',start>=0&&insertStart>start&&insertEnd>insertStart);
if(start<0||insertStart<=start||insertEnd<=insertStart){console.log(`\n${failed}件のNGがあります`);process.exit(1);}
const block=supa.slice(start,insertEnd);

// --- 実際に動かすための土台(ゲーム側の動きは持ち込まず、必要な入口だけスタブする) ---
let uuidCount=0;
const PRELUDE=`
const SUPABASE_URL='https://example.test';
const SB_HEADERS={'apikey':'k','Content-Type':'application/json'};
const rankingLog=()=>{};
const RHYTHM_RANKING_PREFIX='Rhythm';
const RHYTHM_RANKING_SEPARATOR='-';
const storeGet=async(key,def)=>(key in __store?__store[key]:def);
const storeSet=async(key,val)=>{if(__writable)__store[key]=val;};
`;
const makeContext=({stored={},writable=true,responses=[]}={})=>{
  const store={...stored};
  const calls=[];
  const context={
    console,setTimeout,clearTimeout,AbortController,JSON,Date,Math,Error,Promise,Object,Array,String,Number,
    crypto:{randomUUID:()=>`uuid-${++uuidCount}`},
    __store:store,__writable:writable,
    fetch:async(url,init)=>{
      calls.push({url,body:JSON.parse(init.body)});
      const res=responses[Math.min(calls.length-1,responses.length-1)]||{ok:true,status:201,body:''};
      return {ok:res.ok,status:res.status,statusText:res.statusText||'',text:async()=>res.body||''};
    },
  };
  vm.createContext(context);
  vm.runInContext(`${PRELUDE}\n${block}\n this.out={BREEDER_ID_KEY,ensureBreederId,rankingBreederIdUnavailable,sbInsertRhythmScore};`,context);
  return {...context.out,store,calls};
};

const MISSING='{"code":"PGRST204","message":"Could not find the \'breeder_id\' column of \'rankings\' in the schema cache"}';
const OK_RES={ok:true,status:201,body:''};
const MISSING_RES={ok:false,status:400,statusText:'Bad Request',body:MISSING};
const OTHER_400={ok:false,status:400,statusText:'Bad Request',body:'{"code":"22P02","message":"invalid input syntax"}'};
const row=extra=>({difficulty:'Rhythm-monster_hero-EASY',user_name:'テスト',score:123,clear_id:'clear-1',...extra});

(async()=>{
  // ① 保存キーは新設のもの
  {
    const c=makeContext();
    check('保存キーは mh_breeder_id_v1(新設)',c.BREEDER_ID_KEY==='mh_breeder_id_v1',c.BREEDER_ID_KEY);
  }

  // ② 初回は作って保存し、2回目は同じIDを返す
  {
    const c=makeContext();
    const first=await c.ensureBreederId();
    const second=await c.ensureBreederId();
    check('初回にIDを作って端末へ保存する',typeof first==='string'&&first.length>0&&c.store['mh_breeder_id_v1']===first,String(first));
    check('2回目も同じIDを返す(作り直さない)',first===second);
  }

  // ③ すでに保存されているIDはそのまま使う
  {
    const c=makeContext({stored:{'mh_breeder_id_v1':'existing-id'}});
    check('保存済みのIDを作り直さない',await c.ensureBreederId()==='existing-id');
  }

  // ④ 保存が止まっている(プレビュー中など)ときは null。その場かぎりのIDを送らない
  {
    const c=makeContext({writable:false});
    const got=await c.ensureBreederId();
    check('保存できないときはnull(IDを付けずに送る)',got===null,String(got));
  }

  // ⑤ 列がある環境では breeder_id を含めて送る
  {
    const c=makeContext({responses:[OK_RES]});
    const res=await c.sbInsertRhythmScore(row({breeder_id:'b-1'}));
    check('列がある環境ではbreeder_idを含めて送る',res.saved===true&&c.calls.length===1&&c.calls[0].body.breeder_id==='b-1');
  }

  // ⑥ 列が無い環境でも記録が落ちない(外して送り直す)
  {
    const c=makeContext({responses:[MISSING_RES,OK_RES]});
    const res=await c.sbInsertRhythmScore(row({breeder_id:'b-1'}));
    check('列が無ければbreeder_idを外して送り直し、記録は保存される',res.saved===true&&c.calls.length===2,`fetch ${c.calls.length}回`);
    check('送り直しではbreeder_idを付けない',c.calls[1]&&c.calls[1].body.breeder_id===undefined);
    check('送り直しでも同じclear_idを使う(重複行を作らない)',c.calls[1]&&c.calls[1].body.clear_id==='clear-1');
    check('スコア・難易度・名前は落とさない',c.calls[1]&&c.calls[1].body.score===123&&c.calls[1].body.difficulty==='Rhythm-monster_hero-EASY'&&c.calls[1].body.user_name==='テスト');
    check('列が無いと気付いたことを覚える',c.rankingBreederIdUnavailable()===true);
    // 2件目からは最初から外して送る(寄り道は多くても1回きり)
    const res2=await c.sbInsertRhythmScore(row({breeder_id:'b-1',clear_id:'clear-2'}));
    check('2件目からは最初から外して送る',res2.saved===true&&c.calls.length===3&&c.calls[2].body.breeder_id===undefined,`fetch ${c.calls.length}回`);
  }

  // ⑦ breeder_id と関係のない400では送り直さない(失敗を握りつぶさない)
  {
    const c=makeContext({responses:[OTHER_400,OK_RES]});
    let threw=false;
    try{await c.sbInsertRhythmScore(row({breeder_id:'b-1'}));}catch{threw=true;}
    check('別の400では送り直さずエラーにする',threw===true&&c.calls.length===1,`fetch ${c.calls.length}回`);
    check('別の400で「列が無い」と誤って覚えない',c.rankingBreederIdUnavailable()===false);
  }

  // ⑧ clear_id が無い送信は今までどおり拒む
  {
    const c=makeContext({responses:[OK_RES]});
    let threw=false;
    try{await c.sbInsertRhythmScore({difficulty:'Rhythm-monster_hero-EASY',breeder_id:'b-1'});}catch{threw=true;}
    check('clear_idの無い送信は拒む(既存の守り)',threw===true&&c.calls.length===0);
  }

  // --- 結線と、壊してはいけないものの確認 ---
  check('曲の送信でensureBreederIdを呼んでいる',/const breederId = await ensureBreederId\(\);/.test(app));
  check('IDが作れないときは付けずに送る結線になっている',
    app.includes('...(breederId ? { breeder_id: breederId } : {})'));
  check('配信用JSにも同じ結線が入っている(build忘れではない)',
    game.includes('const breederId = await ensureBreederId();')
    &&game.includes("const BREEDER_ID_KEY = 'mh_breeder_id_v1';"));

  // 既存モードの送信は触らない。sbInsertScore に breeder_id を混ぜていないこと
  const otherInsert=supa.slice(supa.indexOf('const sbInsertScore = async (row) => {'),supa.indexOf('const persistRankingScore'));
  check('既存モードの送信(sbInsertScore)にbreeder_idを足していない',!otherInsert.includes('breeder_id'));
  // 既存の保存キーを触らない
  check('既存の保存キー(mh_rhythm_best_v1)を書き換えていない',
    !/mh_rhythm_best_v1[^\n]*BREEDER/.test(supa)&&supa.includes("const BREEDER_ID_KEY = 'mh_breeder_id_v1';"));
  check('仕様書に保存キーと引き継ぎの決めごとがある',
    spec.includes('mh_breeder_id_v1')&&spec.includes('identity_key'));

  console.log(failed?`\n${failed}件のNGがあります`:'\nすべてOK');
  process.exit(failed?1:0);
})();

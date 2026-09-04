// 音ゲーモードの拡張用データ。音源そのものは既存 BGM_TRACKS を正本とし、trackId だけを参照する。
const RHYTHM_LANE_COUNT = 5;
const RHYTHM_SUB_LANE_COUNT = RHYTHM_LANE_COUNT*2;
const RHYTHM_NOTE_TYPES = Object.freeze(['TAP', 'HOLD', 'FLICK', 'SLIDE']);
const RHYTHM_DIFFICULTIES = Object.freeze([
  Object.freeze({ id:'EASY', maxScore:600000 }),
  Object.freeze({ id:'NORMAL', maxScore:700000 }),
  Object.freeze({ id:'HARD', maxScore:800000 }),
  Object.freeze({ id:'EXPERT', maxScore:900000 }),
  Object.freeze({ id:'MASTER', maxScore:1000000 }),
]);
const RHYTHM_JUDGMENTS = Object.freeze([
  Object.freeze({ id:'MARVELOUS', windowMs:25, scoreRate:1 }),
  Object.freeze({ id:'EXCELLENT', windowMs:50, scoreRate:.98 }),
  Object.freeze({ id:'GREAT', windowMs:100, scoreRate:.9 }),
  Object.freeze({ id:'GOOD', windowMs:150, scoreRate:.7 }),
  Object.freeze({ id:'BAD', windowMs:200, scoreRate:.3 }),
  Object.freeze({ id:'MISS', windowMs:null, scoreRate:0 }),
]);
const RHYTHM_SCORE_WEIGHTS = Object.freeze({ judgment:.9, combo:.1 });
// スコアランク(暫定値)。G→F→E→D→C→B→A→S→SS→Mの10段階(Mが最上位)。
// 難易度ごとの割合(%)ではなく絶対スコアのしきい値で判定する。%基準だと
// EASYで100%を出してもMASTERで100%を出しても同じ最上位ランクになってしまうが、
// 絶対値にすることでEASYの最大60万点はどれだけ極めてもBが上限になり、
// MASTERの満点(100万点)だけがMへ届く。
//
// 2026-09-04、ユーザー指示で各しきい値を1段ずつ上（=同じ点数で付くランクは1段ずつ下）へ
// ずらした。旧しきい値ではEXPERTの満点(90万点)もM(旧しきい値900000)に届いてしまい、
// 「MASTERの満点だけがMになる」という上の説明と実際の挙動が食い違っていた。
// 難易度別最大スコア(EASY 60万 / NORMAL 70万 / HARD 80万 / EXPERT 90万 / MASTER 100万)を
// 1段上のランクの境界にそれぞれ使うことで、各難易度の満点が届く上限ランクを
// 「EASY→B / NORMAL→A / HARD→S / EXPERT→SS / MASTER→M」に変え、Mは
// MASTERの満点(100万点)でしか届かないようにしている。Gだけは0のまま(最下段なので
// これ以上下げられない)。
const RHYTHM_RANKS = Object.freeze([
  Object.freeze({ id:'M', min:1000000 }),
  Object.freeze({ id:'SS', min:900000 }),
  Object.freeze({ id:'S', min:800000 }),
  Object.freeze({ id:'A', min:700000 }),
  Object.freeze({ id:'B', min:600000 }),
  Object.freeze({ id:'C', min:500000 }),
  Object.freeze({ id:'D', min:400000 }),
  Object.freeze({ id:'E', min:300000 }),
  Object.freeze({ id:'F', min:200000 }),
  Object.freeze({ id:'G', min:0 }),
]);
const rhythmRankForScore = score => {
  const value = Number.isFinite(Number(score)) ? Number(score) : 0;
  return (RHYTHM_RANKS.find(rank => value >= rank.min) || RHYTHM_RANKS[RHYTHM_RANKS.length - 1]).id;
};
// 現在のランクから次のランクまでの進捗(0〜100)。HUDの丸バッジ横の進捗バーに使う。
// 最上位ランク(M)のときは100で頭打ちにする。
const rhythmRankProgress = score => {
  const value = Number.isFinite(Number(score)) ? Number(score) : 0;
  const index = RHYTHM_RANKS.findIndex(rank => value >= rank.min);
  const current = index < 0 ? RHYTHM_RANKS[RHYTHM_RANKS.length - 1] : RHYTHM_RANKS[index];
  const next = index > 0 ? RHYTHM_RANKS[index - 1] : null;
  if (!next) return 100;
  const span = next.min - current.min;
  return span > 0 ? Math.max(0, Math.min(100, (value - current.min) / span * 100)) : 100;
};
// このスコアの1つ上のランクIDを返す。すでに最上位(M)なら null。
// ランクゲージ横の「→次のランク」表示に使う(スコアランクの判定そのものは増やさない)。
// マイナスや壊れた値はどのランクの条件にも一致しない(findIndexが-1を返す)ため、
// rhythmRankForScoreと同じく最下位(G)として扱う(そうしないと「次はF」ではなく
// 「次は無い」という誤った答えを返してしまう)。
//
// 第2引数maxScoreは現在の難易度の満点(RHYTHM_DIFFICULTIESのmaxScore)。
// 2026-09-04にPR #1023で追加した直後、EASY(満点60万=A上限)なのに「→S」のような
// その難易度では絶対に届かない次ランクを表示してしまう不具合が見つかった。
// RHYTHM_RANKSのしきい値自体は難易度を跨いだ共通のものなので、次ランクのしきい値が
// 今の難易度の満点を超えるならその難易度では到達不可能と分かる。その場合はnextが
// 無い(=★MAX)ものとして扱う。RHYTHM_RANKS・rhythmRankForScore・rhythmRankProgressの
// 判定・しきい値は一切変更しない(表示だけの追加ガード)。maxScoreを渡さない/0以下/壊れた値の
// ときは今までどおり上限なし(Infinity)として扱い、既存の呼び出し互換を保つ。
const rhythmNextRankId = (score, maxScore) => {
  const value = Number.isFinite(Number(score)) ? Number(score) : 0;
  const index = RHYTHM_RANKS.findIndex(rank => value >= rank.min);
  const currentIndex = index < 0 ? RHYTHM_RANKS.length - 1 : index;
  const next = currentIndex > 0 ? RHYTHM_RANKS[currentIndex - 1] : null;
  if (!next) return null;
  const parsedMax = Number(maxScore);
  const cap = Number.isFinite(parsedMax) && parsedMax > 0 ? parsedMax : Infinity;
  return next.min <= cap ? next.id : null;
};
// 音ゲーのライフ(暫定値)。0へ到達したrunは不可逆のDOWNとなり、曲は止めずに
// ライフとスコアだけを固定する。将来の回復処理も0からは復帰させない。
const RHYTHM_LIFE_MAX = 1000;
const RHYTHM_LIFE_DELTA = Object.freeze({ MARVELOUS:2, EXCELLENT:2, GREAT:1, GOOD:0, BAD:-20, MISS:-50 });
// null / undefined / 空文字は「値なし」として満タン扱いにする(Number()では0になってしまう)。
const rhythmLifeValue = life => {
  const raw = life == null || life === '' ? NaN : Number(life);
  return Number.isFinite(raw) ? raw : RHYTHM_LIFE_MAX;
};
const rhythmLifeAfter = (life, judgment) => {
  if (rhythmLifeValue(life) <= 0) return 0;
  const delta = Number(RHYTHM_LIFE_DELTA[judgment]) || 0;
  return Math.max(0, Math.min(RHYTHM_LIFE_MAX, rhythmLifeValue(life) + delta));
};
const rhythmLifeRatio = life => Math.max(0, Math.min(1, rhythmLifeValue(life) / RHYTHM_LIFE_MAX));
// ── モンスターノーツ用のマスモン設定(RHYTHM_MODE §3.2 / 実装計画 §3.2〜3.3) ──────
// 音ゲー用モンスターはマスモンから設定する。最大4体で、1〜4枠目の並び順が
// そのままモンスターノーツの登場順になる。4体そろえる必要はなく、1〜3体でも遊べる。
//
// 重複禁止は「同じ個体UUID」だけでなく **同じベースモンスター(同 baseId)** まで見る。
//   ミーア + ミーア → 不可 / ミーア + パンドラ → 可
// 別モンスターなら、同じ血統・同じ能力でも同時に設定できる。
//
// 保存は既存の mh_* を一切触らず、新しいキー mh_rhythm_monsters_v1 へ分ける。
const RHYTHM_MONSTER_SLOT_KEY='mh_rhythm_monsters_v1';
const RHYTHM_MONSTER_SLOT_MAX=4;
// 保存する値は「マスモンの個体ID(文字列)の並び」だけ。名前・染色・能力はマスモン本体から
// 毎回引き直す。ここへ複製して持つと、育成や染色の変更に追従できなくなるため。
//
// **形として整えるだけで、手元にいるかどうかは見ない。**
// マスモン一覧をまだ読めていない時点で存在確認まで行うと、設定が空として保存され直し、
// プレイヤーの設定が消えてしまう(CLAUDE.md ⑦「消さない・上書きしない」)。
const sanitizeRhythmMonsterSlotIds=value=>{
  const list=Array.isArray(value)?value:(Array.isArray(value?.slots)?value.slots:[]);
  const ids=[],seen=new Set();
  for(const raw of list){
    const id=typeof raw==='string'?raw:(raw&&typeof raw==='object'&&raw.id!=null?String(raw.id):'');
    if(!id||id==='undefined'||id==='null'||seen.has(id))continue;
    seen.add(id);ids.push(id);
    if(ids.length>=RHYTHM_MONSTER_SLOT_MAX)break;
  }
  return ids;
};
// 実際に使う並び。手元にいないマスモンと、同じベースモンスターの重複をここで落とす。
// 落とすのは「使うとき」だけで、保存値そのものは書き換えない。
const resolveRhythmMonsterSlots=(value,masuMons)=>{
  const owned=Array.isArray(masuMons)?masuMons:[];
  const byId=new Map(owned.filter(masu=>masu&&masu.id!=null).map(masu=>[String(masu.id),masu]));
  const slots=[],usedBaseIds=new Set();
  for(const id of sanitizeRhythmMonsterSlotIds(value)){
    const masu=byId.get(id);
    if(!masu)continue;
    const baseId=String(masu.baseId||'');
    if(!baseId||usedBaseIds.has(baseId))continue;
    usedBaseIds.add(baseId);slots.push(masu);
    if(slots.length>=RHYTHM_MONSTER_SLOT_MAX)break;
  }
  return slots;
};
// 枠へ足せない理由を返す(足せるなら null)。UI側でそのまま理由を出せるようにしている。
const rhythmMonsterSlotAddIssue=(value,masuId,masuMons)=>{
  const owned=Array.isArray(masuMons)?masuMons:[];
  const target=owned.find(masu=>masu&&String(masu.id)===String(masuId));
  if(!target||!String(target.baseId||''))return 'missing';
  const ids=sanitizeRhythmMonsterSlotIds(value);
  if(ids.length>=RHYTHM_MONSTER_SLOT_MAX)return 'full';
  if(ids.includes(String(masuId)))return 'duplicate-id';
  const usedBaseIds=resolveRhythmMonsterSlots(ids,owned).map(masu=>String(masu.baseId||''));
  if(usedBaseIds.includes(String(target.baseId)))return 'duplicate-base';
  return null;
};
const RHYTHM_MONSTER_SLOT_ISSUE_TEXT=Object.freeze({
  missing:'このマスモンは設定できません',
  full:`設定できるのは${RHYTHM_MONSTER_SLOT_MAX}体までです`,
  'duplicate-id':'すでに設定しています',
  'duplicate-base':'同じモンスターは重ねて設定できません',
});
const addRhythmMonsterSlot=(value,masuId,masuMons)=>{
  const ids=sanitizeRhythmMonsterSlotIds(value);
  return rhythmMonsterSlotAddIssue(ids,masuId,masuMons)?ids:[...ids,String(masuId)];
};
const removeRhythmMonsterSlot=(value,masuId)=>sanitizeRhythmMonsterSlotIds(value).filter(id=>id!==String(masuId));
// 並び順は登場順そのものなので、入れ替えられるようにしておく。
const moveRhythmMonsterSlot=(value,index,delta)=>{
  const ids=sanitizeRhythmMonsterSlotIds(value),next=Number(index)+Number(delta);
  if(!(index>=0&&index<ids.length&&next>=0&&next<ids.length))return ids;
  const moved=ids.slice();[moved[index],moved[next]]=[moved[next],moved[index]];
  return moved;
};
// 設定した1体につき1回、最大4回(§3.3)。20 / 40 / 60 / 80%は機械的な固定秒数ではなく
// **配置目安**で、実際の時刻は譜面ごとにフレーズ境界へ寄せて決める。
// ここでは目安の割合だけを持ち、譜面への実配置は譜面データ側の仕事とする。
const RHYTHM_MONSTER_NOTE_BASE_RATIOS=Object.freeze([.2,.4,.6,.8]);
const rhythmMonsterNoteBaseRatios=count=>{
  const size=Math.max(0,Math.min(RHYTHM_MONSTER_SLOT_MAX,Math.floor(Number(count)||0)));
  return RHYTHM_MONSTER_NOTE_BASE_RATIOS.slice(0,size);
};
// ── モンスターノーツ本体（RHYTHM_MODE §3.4 / §4） ─────────────────────────────
// 譜面には **通常のTAPノーツへ1行足すだけ** で書く。
//   { type:'TAP', timeMs, lane, subLane, subLaneWidth, monsterSlot:1 }
// monsterSlot はマスモン設定の何枠目かを指す。1枠目→1個目、2枠目→2個目…と対応する(§3.3)。
// 判定・描画・幅の計算は通常ノーツの経路をそのまま使い、能力発動だけを足す。
//
// 初期実装は **TAP専用**(2026-09-03 ユーザー判断)。HOLD / FLICK / SLIDE は
// 「始点はGREATだが途中でMISSした」ときの能力の扱いを別途決めてから足す。
const rhythmNoteMonsterSlot=note=>{
  if(note?.type!=='TAP')return 0;
  // 譜面の書き間違いを黙って通さないよう、数値で書かれたものだけを受ける
  const slot=note?.monsterSlot;
  return typeof slot==='number'&&Number.isInteger(slot)&&slot>=1&&slot<=RHYTHM_MONSTER_SLOT_MAX?slot:0;
};
const rhythmChartMonsterNotes=notes=>(Array.isArray(notes)?notes:[]).filter(note=>rhythmNoteMonsterSlot(note)>0);
// 譜面の書き間違いを機械的に拾う。公開してから「能力ノーツが2個同じ枠だった」と
// 気づくのでは遅いので、検査ツールから使う。
const rhythmChartMonsterNoteIssues=notes=>{
  const all=Array.isArray(notes)?notes:[];
  const issues=[];
  all.forEach((note,index)=>{
    const raw=note?.monsterSlot;
    if(raw==null)return;
    if(note?.type!=='TAP')issues.push({index,issue:'not-tap'});
    else if(!(typeof raw==='number'&&Number.isInteger(raw)&&raw>=1&&raw<=RHYTHM_MONSTER_SLOT_MAX))issues.push({index,issue:'out-of-range'});
  });
  const monsterNotes=rhythmChartMonsterNotes(all).slice().sort((a,b)=>Number(a.timeMs)-Number(b.timeMs));
  const seen=new Set();
  monsterNotes.forEach((note,order)=>{
    const slot=rhythmNoteMonsterSlot(note);
    if(seen.has(slot))issues.push({slot,issue:'duplicate-slot'});
    seen.add(slot);
    // 1枠目→1個目、2枠目→2個目…の対応を崩さない(§3.3)
    if(slot!==order+1)issues.push({slot,order:order+1,issue:'order-mismatch'});
  });
  if(monsterNotes.length>RHYTHM_MONSTER_SLOT_MAX)issues.push({issue:'too-many'});
  return issues;
};

// ── 能力（§4） ───────────────────────────────────────────────────────────────
// 能力は **主血統** で決まる(§4.5)。副血統では変えない。
// ドラゴン / ジョーカー / ゲル はプレイアブル代表が未実装のため、能力をまだ決めない(§4.6)。
// 「？？？」はレア区分用の血統なので割り当て対象にしない。
const RHYTHM_MONSTER_ABILITIES=Object.freeze({
  GENKI:Object.freeze({id:'GENKI',name:'元気',lifeGain:500}),
  MUTEKI:Object.freeze({id:'MUTEKI',name:'無敵',durationMs:6000}),
  GAMAN:Object.freeze({id:'GAMAN',name:'我慢',durationMs:15000,reduceRate:.5}),
  KONJO:Object.freeze({id:'KONJO',name:'根性',reviveLife:50,stockLifeGain:50}),
});
const RHYTHM_MONSTER_ABILITY_BY_LINEAGE=Object.freeze({
  pixie:'GENKI', undine:'GENKI', plant:'GENKI', suezo:'GENKI', tiger:'GENKI',
  monol:'MUTEKI', ark:'MUTEKI',
  golem:'GAMAN', mocchi:'GAMAN',
  ham:'KONJO', zan:'KONJO',
});
const rhythmMonsterAbilityForLineage=lineageId=>
  RHYTHM_MONSTER_ABILITIES[RHYTHM_MONSTER_ABILITY_BY_LINEAGE[String(lineageId||'')]]||null;
// 能力発動は GREAT 以上(§3.4)。判定窓そのものはモンスターノーツ専用に甘くしない。
const RHYTHM_MONSTER_ABILITY_JUDGMENTS=Object.freeze(['MARVELOUS','EXCELLENT','GREAT']);
const rhythmMonsterAbilityTriggers=judgment=>RHYTHM_MONSTER_ABILITY_JUDGMENTS.includes(judgment);

// 能力の状態。プレイ中のライフ計算へ差し込む。runへ持たせて毎フレーム作り直さない。
const createRhythmMonsterAbilityState=()=>({mutekiUntilMs:0,gamanUntilMs:0,konjoStock:0});
const rhythmMonsterAbilityRemainingMs=(state,abilityId,songTimeMs)=>{
  const until=abilityId==='MUTEKI'?Number(state?.mutekiUntilMs):abilityId==='GAMAN'?Number(state?.gamanUntilMs):0;
  const now=Number(songTimeMs);
  if(!(Number.isFinite(until)&&Number.isFinite(now)))return 0;
  return Math.max(0,until-now);
};
const rhythmMonsterAbilityActive=(state,abilityId,songTimeMs)=>rhythmMonsterAbilityRemainingMs(state,abilityId,songTimeMs)>0;
// 負のライフ変化だけを能力で弱める。判定・コンボ・スコアそのものは変えない(§4.2)。
//
// **無敵と我慢は別の能力として、それぞれの残り時間で独立して走る**(§4.7)。
// 効果時間が違う(6秒 / 15秒)ので、片方が切れてももう片方はそのまま続く。
// 両方が有効なあいだは強いほう(無敵)が勝ち、無敵が切れたらそこから我慢の軽減へ変わる。
// 逆に我慢が先に切れた場合は、無敵が残っているあいだダメージ0のまま。
const rhythmApplyMonsterAbilityToLifeDelta=(state,delta,songTimeMs)=>{
  const raw=Number(delta)||0;
  if(raw>=0)return raw;
  if(rhythmMonsterAbilityActive(state,'MUTEKI',songTimeMs))return 0;
  if(rhythmMonsterAbilityActive(state,'GAMAN',songTimeMs))
    return -Math.round(Math.abs(raw)*(1-RHYTHM_MONSTER_ABILITIES.GAMAN.reduceRate));
  return raw;
};
// 能力を通したライフ計算。既存の rhythmLifeAfter は変えずに別入口として足す。
const rhythmLifeAfterWithMonsterAbilities=(life,judgment,state,songTimeMs)=>{
  if(rhythmLifeValue(life)<=0)return 0;
  const delta=rhythmApplyMonsterAbilityToLifeDelta(state,Number(RHYTHM_LIFE_DELTA[judgment])||0,songTimeMs);
  return Math.max(0,Math.min(RHYTHM_LIFE_MAX,rhythmLifeValue(life)+delta));
};
// 根性ストックを持ったままライフが0になったら、自動でライフ50へ復活する(§4.4)。
const rhythmConsumeKonjoStock=(state,life)=>{
  if(rhythmLifeValue(life)>0||!(Number(state?.konjoStock)>0))return {life:rhythmLifeValue(life),state,revived:false};
  return {life:RHYTHM_MONSTER_ABILITIES.KONJO.reviveLife,state:{...state,konjoStock:0},revived:true};
};
// モンスターノーツをGREAT以上で取ったときの発動。状態を書き換えず新しい値を返す。
// applied=false は「取れたが効果が無かった」(DOWN中の元気など)。
const rhythmActivateMonsterAbility=({ability,state,life,songTimeMs}={})=>{
  const current=state||createRhythmMonsterAbilityState();
  const now=Number(songTimeMs)||0,lifeNow=rhythmLifeValue(life);
  const stay={life:lifeNow,state:current,applied:false,revived:false};
  if(!ability)return stay;
  if(ability.id==='GENKI'){
    // 生存中のみ通常回復として働く。DOWNから復帰できるのは根性だけ(§4.1)
    if(lifeNow<=0)return stay;
    return {...stay,life:Math.min(RHYTHM_LIFE_MAX,lifeNow+ability.lifeGain),applied:true};
  }
  if(ability.id==='MUTEKI'||ability.id==='GAMAN'){
    // 無敵と我慢はそれぞれ別に持つので、片方を取ってももう片方の残り時間は消えない(§4.7)。
    // 同じ能力を続けて取ったときは、終わりが遅いほう(=いま取ったぶん)まで効く。
    // 率を足したり残り時間へ足したりはしない。
    const key=ability.id==='MUTEKI'?'mutekiUntilMs':'gamanUntilMs';
    return {...stay,state:{...current,[key]:now+ability.durationMs},applied:true};
  }
  if(ability.id==='KONJO'){
    // DOWN中に取ったら、その場でライフ50へ復活する(§4.4)
    if(lifeNow<=0)return {...stay,life:ability.reviveLife,applied:true,revived:true};
    // ストックは最大1。すでに持っているならライフ+50へ変換する
    if(Number(current.konjoStock)>0)
      return {...stay,life:Math.min(RHYTHM_LIFE_MAX,lifeNow+ability.stockLifeGain),applied:true};
    return {...stay,state:{...current,konjoStock:1},applied:true};
  }
  return stay;
};
// 蘇生したときのスコアの続き方(2026-09-03 ユーザー判断)。
// **蘇生ノーツ自身は加算せず、次のノーツから再開する。**
// DOWN中に止まっていたぶんを遡って足さないよう、そのぶんを差し引く量として持つ。
const rhythmScoreOffsetAfterRevive=(calculatedScore,lockedScore)=>
  Math.max(0,(Number(calculatedScore)||0)-(Number(lockedScore)||0));
// ── 性能計測(デバッグ限定) ─────────────────────────────────────────────────
// 実機で音ゲー中のカクつきが報告されている。原因を断定せず切り分けるため、
// フレーム時間と「1フレームあたりのlayout read / DOM検索 / SLIDE polygon更新」を数える。
// **既定はOFF。OFFのあいだは加算も配列追加も一切しない**(計測のために重くしない)。
// 判定窓・BPM・noteTime・スコア式・譜面データには一切関与しない。
const RHYTHM_PERF_KEY='mh_rhythm_perf_v1';
const RHYTHM_PERF_LONG_MS=Object.freeze([16.7,25,33]);
const RHYTHM_PERF=(()=>{
  const zero=()=>({frames:0,totalMs:0,maxMs:0,long:[0,0,0],layoutReads:0,domQueries:0,slidePolygons:0,gestureFrames:0,noteRescans:0});
  let on=false,last=null,acc=zero();
  const api={
    get enabled(){return on;},
    setEnabled(next){
      on=!!next;last=null;acc=zero();
      try{if(typeof localStorage!=='undefined')localStorage.setItem(RHYTHM_PERF_KEY,on?'1':'0');}catch{}
      return on;
    },
    restore(){try{if(typeof localStorage!=='undefined')on=localStorage.getItem(RHYTHM_PERF_KEY)==='1';}catch{}return on;},
    reset(){last=null;acc=zero();},
    // 本体のrAFから毎フレーム1回だけ呼ぶ(計測用のrAFは増やさない)
    frame(nowMs){
      if(!on)return;
      const t=Number(nowMs);
      if(last!==null&&Number.isFinite(t)){
        const dt=t-last;
        // 一時停止・バックグラウンド復帰の巨大な間隔は数えない
        if(dt>0&&dt<2000){
          acc.frames++;acc.totalMs+=dt;
          if(dt>acc.maxMs)acc.maxMs=dt;
          for(let i=0;i<RHYTHM_PERF_LONG_MS.length;i++)if(dt>RHYTHM_PERF_LONG_MS[i])acc.long[i]++;
        }
      }
      last=Number.isFinite(t)?t:null;
    },
    gestureFrame(){if(on)acc.gestureFrames++;},
    noteRescan(){if(on)acc.noteRescans++;},
    layoutRead(){if(on)acc.layoutReads++;},
    domQuery(){if(on)acc.domQueries++;},
    slidePolygons(count){if(on)acc.slidePolygons+=Number(count)||0;},
    snapshot(){
      const frames=acc.frames;
      const per=value=>frames?value/frames:0;
      return {
        frames,
        avgMs:per(acc.totalMs),
        fps:acc.totalMs?1000*frames/acc.totalMs:0,
        maxMs:acc.maxMs,
        over16:acc.long[0],over25:acc.long[1],over33:acc.long[2],
        layoutReadsPerFrame:per(acc.layoutReads),
        domQueriesPerFrame:per(acc.domQueries),
        slidePolygonsPerFrame:per(acc.slidePolygons),
        gestureFrames:acc.gestureFrames,
        noteRescans:acc.noteRescans,
      };
    },
  };
  api.restore();
  return api;
})();

const RHYTHM_PROJECTION_TOP_SCALE=.18;
const RHYTHM_NOTE_WIDTH_RATIO=.78;
const RHYTHM_BODY_WIDTH_RATIO=.64;
// 幅1だけに付ける入力側の余白。隣接する細ノーツの中心までは広げない。
const RHYTHM_NARROW_TAP_TOLERANCE_SUB_LANES=.18;
const rhythmClamp01=value=>Math.max(0,Math.min(1,Number(value)||0));
const rhythmProjectionScale=yRatio=>RHYTHM_PROJECTION_TOP_SCALE+(1-RHYTHM_PROJECTION_TOP_SCALE)*Math.pow(rhythmClamp01(yRatio),1.24);
const rhythmProjectBoundary=(boundary,yRatio)=>{
  const scale=rhythmProjectionScale(yRatio),flat=Number(boundary)/RHYTHM_LANE_COUNT;
  return .5+(flat-.5)*scale;
};
const rhythmProjectLane=(lane,yRatio)=>{
  const value=Number(lane),left=rhythmProjectBoundary(value,yRatio),right=rhythmProjectBoundary(value+1,yRatio);
  return {left,right,center:(left+right)/2,width:right-left,scale:rhythmProjectionScale(yRatio)};
};
const rhythmProjectSubLaneSpan=(subLane,width,yRatio)=>{
  const total=RHYTHM_LANE_COUNT*2;
  const span=Math.max(1,Math.min(4,Math.trunc(Number(width))||2));
  const start=Math.max(0,Math.min(total-span,Math.trunc(Number(subLane))||0));
  const left=rhythmProjectBoundary(start/2,yRatio),right=rhythmProjectBoundary((start+span)/2,yRatio);
  return {left,right,center:(left+right)/2,width:right-left,scale:rhythmProjectionScale(yRatio),subLane:start,subLaneWidth:span};
};
// 旧譜面は lane を正本のまま使い、従来と同じ中央・2サブレーン幅へ写す。
// TAP/HOLDはsubLaneで可変幅、SLIDEはlane/slidePoints.laneを中心線として幅1〜4へ対応する。
const rhythmNoteHasVariableSpan=note=>(note?.type==='TAP'||note?.type==='HOLD'||note?.type==='FLICK'||note?._rhythmOriginalType==='FLICK')&&note?.subLane!=null&&Number.isFinite(Number(note.subLane));
const rhythmNoteIsSlide=note=>note?.type==='SLIDE'||note?._rhythmOriginalType==='SLIDE';
const rhythmSlideAuthoredLane=lane=>{
  const value=Number(lane),doubled=Math.round(value*2);
  if(!Number.isFinite(value)||Math.abs(value*2-doubled)>1e-6||doubled<0||doubled>RHYTHM_SUB_LANE_COUNT-2)return null;
  return doubled/2;
};
const rhythmSlideAuthoredWidth=value=>{
  const width=Number(value);
  return Number.isInteger(width)&&width>=1&&width<=4?width:null;
};
const rhythmSlideWidth=note=>rhythmSlideAuthoredWidth(note?.subLaneWidth)??2;
const rhythmSlidePointWidth=(note,point)=>rhythmSlideAuthoredWidth(point?.subLaneWidth)??rhythmSlideWidth(note);
const rhythmProjectSlideSpan=(lane,note,yRatio,chartTimeMs=note?.timeMs)=>{
  const value=Number(lane),width=rhythmSlideWidthAt(note,chartTimeMs),half=width/4,centerBoundary=value+.5;
  const left=rhythmProjectBoundary(centerBoundary-half,yRatio),right=rhythmProjectBoundary(centerBoundary+half,yRatio);
  return {left,right,center:(left+right)/2,width:right-left,scale:rhythmProjectionScale(yRatio),subLaneWidth:width};
};
const rhythmSlideInputSpan=note=>{
  if(!rhythmNoteIsSlide(note))return null;
  const lane=rhythmSlideAuthoredLane(note?.lane);
  if(lane===null)return null;
  const width=rhythmSlideWidthAt(note,note?.timeMs),center=(lane+.5)*2;
  return {start:center-width/2,end:center+width/2,center,width};
};
const rhythmNoteVisualSpan=(note,visualLane,yRatio)=>rhythmNoteHasVariableSpan(note)
  ?rhythmProjectSubLaneSpan(note.subLane,note.subLaneWidth,yRatio)
  :rhythmNoteIsSlide(note)
    ?rhythmProjectSlideSpan(Number(visualLane),note,yRatio)
    :rhythmProjectSubLaneSpan(Number(visualLane)*2,2,yRatio);
// projectionはyに対する曲線(pow 1.24)なので、上端と下端だけを直線で結ぶ台形にすると
// 中間の高さでレーン枠だけがノーツより外側へ膨らむ。見た目の枠も同じboundary helperを
// 一定間隔でサンプルし、ノーツ・HOLD帯・SLIDE帯と同じ曲線へ沿わせる。
const RHYTHM_PROJECTION_EDGE_STEPS=16;
// SLIDEはauthored点の間を実時間で細分化して曲線へ沿わせる。点が多い譜面でも描画量が跳ねないよう、
// レーン枠(静的)より粗い刻みにする。
const RHYTHM_SLIDE_SEGMENT_STEPS=10;
const rhythmProjectionEdgeRatios=(steps=RHYTHM_PROJECTION_EDGE_STEPS)=>Array.from({length:steps+1},(_,index)=>index/steps);
const rhythmBoundaryEdgePoints=(boundary,steps=RHYTHM_PROJECTION_EDGE_STEPS)=>rhythmProjectionEdgeRatios(steps).map(y=>({x:rhythmProjectBoundary(boundary,y),y}));
const rhythmSpanPolygon=(leftBoundary,rightBoundary,steps=RHYTHM_PROJECTION_EDGE_STEPS)=>{
  const at=(boundary,y)=>`${(rhythmProjectBoundary(boundary,y)*100).toFixed(4)}% ${(y*100).toFixed(4)}%`;
  const ratios=rhythmProjectionEdgeRatios(steps);
  const right=ratios.map(y=>at(rightBoundary,y)),left=ratios.map(y=>at(leftBoundary,y)).reverse();
  return `polygon(${[at(leftBoundary,0),...right,...left.slice(0,-1)].join(',')})`;
};
// 1px幅の境界線も同じ曲線に沿わせる。幅だけはpx指定なのでcalcで足す。
const rhythmBoundaryLinePolygon=(boundary,widthPx=1,steps=RHYTHM_PROJECTION_EDGE_STEPS)=>{
  const ratios=rhythmProjectionEdgeRatios(steps);
  const right=ratios.map(y=>`calc(${(rhythmProjectBoundary(boundary,y)*100).toFixed(4)}% + ${widthPx}px) ${(y*100).toFixed(4)}%`);
  const left=ratios.map(y=>`${(rhythmProjectBoundary(boundary,y)*100).toFixed(4)}% ${(y*100).toFixed(4)}%`).reverse();
  return `polygon(${[...right,...left].join(',')})`;
};
const rhythmLanePolygon=lane=>rhythmSpanPolygon(lane,lane+1);
const rhythmSubLanePolygon=subLane=>rhythmSpanPolygon(subLane/2,(subLane+1)/2);
const rhythmProjectTravelProgress=progress=>{
  const p=Number(progress)||0;
  if(p<0)return p*.72;
  if(p>1)return 1+(p-1)*1.28;
  return p*(.54+.46*p);
};
const rhythmReleaseTargetMs=note=>Number(note?._rhythmReleaseTargetMs??note?._rhythmReleaseOriginalEndTimeMs??note?.endTimeMs??note?.timeMs)||0;
const rhythmReleaseLane=note=>{
  const points=Array.isArray(note?.slidePoints)?note.slidePoints:[];
  return Number(points[points.length-1]?.lane??note?.endLane??note?.lane)||0;
};
const rhythmLaneCoordinateAtPoint=(clientX,clientY,rect)=>{
  if(!rect||!Number.isFinite(rect.width)||rect.width<=0||!Number.isFinite(rect.height)||rect.height<=0)return null;
  const yRatio=rhythmClamp01((Number(clientY)-rect.top)/rect.height),nx=(Number(clientX)-rect.left)/rect.width;
  const left=rhythmProjectBoundary(0,yRatio),right=rhythmProjectBoundary(RHYTHM_LANE_COUNT,yRatio),laneWidth=(right-left)/RHYTHM_LANE_COUNT;
  if(!Number.isFinite(nx)||nx<left||nx>right||!(laneWidth>0))return null;
  return (nx-left)/laneWidth-.5;
};
const rhythmSubLaneCoordinateAtPoint=(clientX,clientY,rect)=>{
  const coordinate=rhythmLaneCoordinateAtPoint(clientX,clientY,rect);
  return coordinate===null?null:(coordinate+.5)*2;
};
const rhythmLaneAtPoint=(clientX,clientY,rect)=>{
  const coordinate=rhythmLaneCoordinateAtPoint(clientX,clientY,rect);
  if(coordinate===null)return null;
  return Math.max(0,Math.min(RHYTHM_LANE_COUNT-1,Math.floor(coordinate+.5)));
};

const RHYTHM_FLICK_DISTANCE_PX = 24;
const RHYTHM_FLICK_MAX_MS = 450;
const RHYTHM_SLIDE_TOLERANCE_LANES = .82;
const RHYTHM_RELEASE_MAX_MS = 200;
const RHYTHM_RELEASE_DEFER_ARM_MS = 100;
const RHYTHM_RELEASE_AUTO_MISS_ARM_MS = 180;
const RHYTHM_RELEASE_JUDGMENT_IDS = Object.freeze(['MARVELOUS','EXCELLENT','GREAT','GOOD','BAD','MISS']);
const rhythmSlideTrackingTolerance=(note,chartTimeMs)=>RHYTHM_SLIDE_TOLERANCE_LANES+(rhythmSlideWidthAt(note,chartTimeMs)-2)/4;
const rhythmJudgeRelease=deltaMs=>{
  const value=Math.abs(Number(deltaMs));
  if(!Number.isFinite(value))return 'MISS';
  for(const judgment of RHYTHM_JUDGMENTS){
    if(judgment.windowMs!==null&&value<=judgment.windowMs)return judgment.id;
  }
  return 'MISS';
};
const rhythmWorseJudgment=(a,b)=>{
  const left=RHYTHM_RELEASE_JUDGMENT_IDS.indexOf(String(a||'MISS')),right=RHYTHM_RELEASE_JUDGMENT_IDS.indexOf(String(b||'MISS'));
  return RHYTHM_RELEASE_JUDGMENT_IDS[Math.max(left<0?RHYTHM_RELEASE_JUDGMENT_IDS.length-1:left,right<0?RHYTHM_RELEASE_JUDGMENT_IDS.length-1:right)];
};
const rhythmSlidePoints=note=>Array.isArray(note?.slidePoints)&&note.slidePoints.length>=2
    ? note.slidePoints
    : [{timeMs:Number(note?.timeMs)||0,lane:Number(note?.lane)||0},{timeMs:Number(note?._rhythmReleaseOriginalEndTimeMs??note?.endTimeMs)||Number(note?.timeMs)||0,lane:Number(note?.endLane??note?.lane)||0}];
const rhythmSlideWidthAt=(note,chartTimeMs)=>{
  const points=rhythmSlidePoints(note),t=Number(chartTimeMs);
  if(!Number.isFinite(t)||t<=Number(points[0]?.timeMs))return rhythmSlidePointWidth(note,points[0]);
  for(let i=1;i<points.length;i++){
    const a=points[i-1],b=points[i];
    if(t<=Number(b.timeMs)){
      const span=Math.max(1,Number(b.timeMs)-Number(a.timeMs)),p=Math.max(0,Math.min(1,(t-Number(a.timeMs))/span));
      return rhythmSlidePointWidth(note,a)+(rhythmSlidePointWidth(note,b)-rhythmSlidePointWidth(note,a))*p;
    }
  }
  return rhythmSlidePointWidth(note,points[points.length-1]);
};
const rhythmSlideExpectedLane=(note,chartTimeMs)=>{
  const points=rhythmSlidePoints(note);
  const t=Number(chartTimeMs);
  if(!Number.isFinite(t))return Number(points[0]?.lane)||0;
  if(t<=points[0].timeMs)return Number(points[0]?.lane)||0;
  for(let i=1;i<points.length;i++){
    const a=points[i-1],b=points[i];
    if(t<=b.timeMs){
      const span=Math.max(1,Number(b.timeMs)-Number(a.timeMs));
      const p=Math.max(0,Math.min(1,(t-Number(a.timeMs))/span));
      return Number(a.lane)+(Number(b.lane)-Number(a.lane))*p;
    }
  }
  return Number(points[points.length-1]?.lane)||0;
};

// STEP 2A.5: 入力成功と空押しを即座に返すWeb Audio SE。既存の音ゲー設定キーだけを読み、
// AudioContextは1個だけ遅延生成して再利用する。空押しは新規入力でノーツを取得できなかったときだけ呼ぶ。
// 音ゲーのタップ音量はメインのSE音量設定と独立している(rhythm-mode.js側で自前のAudioContextを使う)。
// ただし全体ミュート(タイトル画面の「音がオフです」)だけは、game-system.jsx の Audio_.setEnabled が
// window.__mhAudioEnabled へ反映するのでそれを見て共通に効かせる。値が無い(main未読込)場合はfalse扱いにしない。
const rhythmAudioGloballyEnabled=()=>typeof window==='undefined'||window.__mhAudioEnabled!==false;
const RHYTHM_NOTE_SE_RUNTIME=(()=>{
  let ctx=null,cachedRaw=null,cachedSettings={enabled:true,volume:70},inputGroupDepth=0,inputGroupHit=false;
  const readSettings=()=>{
    if(typeof localStorage==='undefined')return cachedSettings;
    let raw=null;
    try{raw=localStorage.getItem('mh_rhythm_settings_v1');}catch{return cachedSettings;}
    if(raw===cachedRaw)return cachedSettings;
    cachedRaw=raw;
    if(!raw){cachedSettings={enabled:true,volume:70};return cachedSettings;}
    try{
      const value=JSON.parse(raw),number=Number(value?.noteSeVolume);
      cachedSettings={
        enabled:typeof value?.noteSeEnabled==='boolean'?value.noteSeEnabled:true,
        volume:Number.isFinite(number)?Math.max(0,Math.min(100,number)):70,
      };
    }catch{cachedSettings={enabled:true,volume:70};}
    return cachedSettings;
  };
  const context=()=>{
    if(ctx&&ctx.state!=='closed')return ctx;
    if(typeof window==='undefined')return null;
    const AudioContextClass=window.AudioContext||window.webkitAudioContext;
    if(!AudioContextClass)return null;
    try{ctx=new AudioContextClass();}catch{return null;}
    return ctx;
  };
  const warm=()=>{
    const audio=context();
    if(audio?.state==='suspended'&&typeof audio.resume==='function')audio.resume().catch(()=>{});
  };
  const play=(previewSettings=null)=>{
    if(inputGroupDepth>0)inputGroupHit=true;
    const settings=previewSettings?{enabled:previewSettings.noteSeEnabled!==false,volume:Math.max(0,Math.min(100,Number(previewSettings.noteSeVolume)||0))}:readSettings();
    if(!settings.enabled||settings.volume<=0||!rhythmAudioGloballyEnabled())return false;
    const audio=context();
    if(!audio)return false;
    if(audio.state==='suspended'&&typeof audio.resume==='function')audio.resume().catch(()=>{});
    const oscillator=audio.createOscillator(),gain=audio.createGain(),now=audio.currentTime,level=Math.max(.0001,.035*(settings.volume/100));
    oscillator.type='triangle';
    oscillator.frequency.setValueAtTime(1120,now);
    oscillator.frequency.exponentialRampToValueAtTime(820,now+.035);
    gain.gain.setValueAtTime(level,now);
    gain.gain.exponentialRampToValueAtTime(.0001,now+.045);
    oscillator.connect(gain);
    gain.connect(audio.destination);
    oscillator.start(now);
    oscillator.stop(now+.05);
    oscillator.onended=()=>{try{oscillator.disconnect();gain.disconnect();}catch{}};
    return true;
  };
  const emitEmpty=()=>{
    const settings=readSettings();
    if(!settings.enabled||settings.volume<=0||!rhythmAudioGloballyEnabled())return false;
    const audio=context();
    if(!audio)return false;
    if(audio.state==='suspended'&&typeof audio.resume==='function')audio.resume().catch(()=>{});
    const duration=.055,sampleRate=audio.sampleRate||44100,buffer=audio.createBuffer(1,Math.max(1,Math.floor(sampleRate*duration)),sampleRate),samples=buffer.getChannelData(0);
    for(let i=0;i<samples.length;i++)samples[i]=(Math.random()*2-1)*(1-i/samples.length);
    const source=audio.createBufferSource(),filter=audio.createBiquadFilter(),gain=audio.createGain(),now=audio.currentTime,level=Math.max(.0001,.022*(settings.volume/100));
    source.buffer=buffer;
    filter.type='bandpass';
    filter.frequency.setValueAtTime(2800,now);
    filter.Q.setValueAtTime(.7,now);
    gain.gain.setValueAtTime(level,now);
    gain.gain.exponentialRampToValueAtTime(.0001,now+duration);
    source.connect(filter);filter.connect(gain);gain.connect(audio.destination);
    source.start(now);source.stop(now+duration);
    source.onended=()=>{try{source.disconnect();filter.disconnect();gain.disconnect();}catch{}};
    return true;
  };
  const playEmpty=()=>inputGroupDepth>0?true:emitEmpty();
  const beginInputGroup=()=>{if(inputGroupDepth===0)inputGroupHit=false;inputGroupDepth++;};
  const markInputGroupHandled=()=>{if(inputGroupDepth>0)inputGroupHit=true;};
  const endInputGroup=()=>{
    if(inputGroupDepth<=0)return false;
    inputGroupDepth--;
    if(inputGroupDepth>0)return true;
    const handled=inputGroupHit;
    inputGroupHit=false;
    return handled?true:emitEmpty();
  };
  // フルコンボ等を達成して曲を終えたときの、リザルトへ行く前のお祝い演出で鳴らす1回だけの
  // 合成音。本物の掛け声(音声ファイル)は用意していないため、上昇アルペジオで代える。
  // 既存のタップ音と同じ設定(音量・ON/OFF・全体ミュート)を読み、専用の保存キーは増やさない。
  const playFullCombo=()=>{
    const settings=readSettings();
    if(!settings.enabled||settings.volume<=0||!rhythmAudioGloballyEnabled())return false;
    const audio=context();
    if(!audio)return false;
    if(audio.state==='suspended'&&typeof audio.resume==='function')audio.resume().catch(()=>{});
    const now=audio.currentTime,level=Math.max(.0001,.05*(settings.volume/100));
    // E5 → G5 → B5 → E6 の上昇アルペジオ。最後の音だけ長く伸ばして締める。
    [659.25,783.99,987.77,1318.51].forEach((freq,index,notes)=>{
      const start=now+index*.09,sustain=index===notes.length-1?.42:.16;
      const oscillator=audio.createOscillator(),gain=audio.createGain();
      oscillator.type='triangle';
      oscillator.frequency.setValueAtTime(freq,start);
      gain.gain.setValueAtTime(.0001,start);
      gain.gain.exponentialRampToValueAtTime(level,start+.012);
      gain.gain.exponentialRampToValueAtTime(.0001,start+sustain);
      oscillator.connect(gain);
      gain.connect(audio.destination);
      oscillator.start(start);
      oscillator.stop(start+sustain+.02);
      oscillator.onended=()=>{try{oscillator.disconnect();gain.disconnect();}catch{}};
    });
    return true;
  };
  return {warm,play,preview:settings=>play(settings),playEmpty,beginInputGroup,markInputGroupHandled,endInputGroup,playFullCombo,_readSettings:readSettings};
})();

// 途中追従判定(暫定値。実機確認のうえで調整する)。
// ・猶予: 外れてからこの時間を超えて戻らなければMISS確定する。iPhoneの指ブレで
//   1サンプルだけ外れても即失敗にしないための余裕。
// ・HOLD横ズレ許容: 帯の半分幅に、0.3サブレーン(=0.15レーン)ぶんの余白を足す。
//   HOLDは動かない的なので、経路を追従するSLIDEより厳しめにしている。
const RHYTHM_MID_TRACKING_GRACE_MS=120;
const RHYTHM_HOLD_TRACKING_MARGIN_LANES=.15;
// note.lane / rhythmLaneCoordinateAtPoint と同じ「整数=レーン中心」座標系で、
// HOLDの中心と半幅を返す。subLane/width指定はboundary座標系(整数=境界)なので
// -0.5して中心座標系へ揃える。
const rhythmHoldTrackedLane=note=>{
  if(note?.subLane!=null&&Number.isFinite(Number(note.subLane))){
    const subLane=Number(note.subLane),width=Math.max(1,Math.min(4,Number(note.subLaneWidth)||2));
    return {center:subLane/2+width/4-.5,half:width/4};
  }
  return {center:Number(note?.lane)||0,half:.5};
};
const RHYTHM_GESTURE_RUNTIME=(()=>{
  const positions=new Map(),sessions=new Map();
  let raf=0;

  const nowPerf=()=>typeof performance!=='undefined'&&typeof performance.now==='function'?performance.now():Date.now();
  const inputKey=(kind,id)=>`${kind}:${id}`;
  // areaRect は「指の座標 → レーン」の変換のたびに呼ばれる。以前は毎回 querySelector と
  // getBoundingClientRect()(=強制レイアウト)をしていたため、1フレームのあいだに
  // 指の数ぶん・pointermoveの数ぶんレイアウトを確定させていた。
  // 同じフレームのあいだは測り直さずに共有する。**ズレると入力位置がずれる**ので、
  // フレームが変わるとき・画面サイズが変わるときは必ず捨てる(invalidateAreaRect)。
  let cachedRect=null;
  const invalidateAreaRect=()=>{cachedRect=null;};
  const areaRect=()=>{
    if(typeof document==='undefined')return null;
    if(cachedRect)return cachedRect;
    RHYTHM_PERF.domQuery();
    const area=document.querySelector('[data-rhythm-play-area]');
    if(!area)return null;
    RHYTHM_PERF.layoutRead();
    const rect=area.getBoundingClientRect();
    if(!(rect&&Number.isFinite(rect.width)&&rect.width>0))return null;
    cachedRect=rect;
    return cachedRect;
  };
  // 画面が動く操作では即座に捨てる(iOSのURLバー出入りなども visualViewport で拾う)
  if(typeof window!=='undefined'&&typeof window.addEventListener==='function'){
    ['resize','orientationchange','scroll'].forEach(type=>window.addEventListener(type,invalidateAreaRect,{passive:true,capture:true}));
    if(window.visualViewport&&typeof window.visualViewport.addEventListener==='function'){
      ['resize','scroll'].forEach(type=>window.visualViewport.addEventListener(type,invalidateAreaRect,{passive:true}));
    }
  }
  const laneCoordinate=(clientX,clientY)=>{
    const rect=areaRect();
    if(!rect)return null;
    return rhythmLaneCoordinateAtPoint(clientX,clientY,rect);
  };
  const estimatedSongMs=session=>{
    const elapsed=Math.max(0,nowPerf()-session.startPerfMs);
    return session.startSongMs+elapsed;
  };
  const finishGesture=(session,success)=>{
    if(!session||session.note.done||session.finished)return;
    session.finished=true;
    if(!success)session.note.holdJudgment='MISS';
    const songNow=estimatedSongMs(session);
    session.note.endTimeMs=songNow-session.offsetMs;
    session.note._rhythmGestureDone=true;
  };
  const evaluatePosition=(session,pos)=>{
    if(!session||session.finished||session.note.done||!pos)return;
    if(session.kind==='FLICK'){
      const elapsed=Math.max(0,pos.perfMs-session.startPerfMs);
      const dx=pos.clientX-session.startX,dy=pos.clientY-session.startY;
      if(elapsed<=RHYTHM_FLICK_MAX_MS&&Math.hypot(dx,dy)>=RHYTHM_FLICK_DISTANCE_PX)finishGesture(session,true);
      return;
    }
    if(session.kind!=='SLIDE'&&session.kind!=='HOLD')return;
    const actual=laneCoordinate(pos.clientX,pos.clientY);
    const chartNow=estimatedSongMs(session)-session.offsetMs;
    let bad;
    if(actual===null){
      bad=true;
    }else if(session.kind==='SLIDE'){
      bad=Math.abs(actual-rhythmSlideExpectedLane(session.note,chartNow))>rhythmSlideTrackingTolerance(session.note,chartNow);
    }else{
      const tracked=rhythmHoldTrackedLane(session.note);
      bad=Math.abs(actual-tracked.center)>tracked.half+RHYTHM_HOLD_TRACKING_MARGIN_LANES;
    }
    if(!bad){session.trackingBadSincePerf=null;return;}
    if(session.trackingBadSincePerf==null)session.trackingBadSincePerf=pos.perfMs;
    if(pos.perfMs-session.trackingBadSincePerf<RHYTHM_MID_TRACKING_GRACE_MS)return;
    session.note.holdJudgment='MISS';
    session.failed=true;
    // 猶予を超えて外れたままなら、指を離すのを待たずその場でMISS確定する。
    // endTimeMsを現在より少し前へ寄せ、本体(scheduleTick)の「endTimeMs到達で
    // 既存applyJudgmentを呼ぶ」経路をそのまま使ってグレー表示へ切り替える(新しい判定経路は作らない)。
    session.note.endTimeMs=chartNow-50;
  };
  const tick=()=>{
    raf=0;
    invalidateAreaRect();
    const paused=typeof document!=='undefined'&&!!document.querySelector('[data-rhythm-pause-menu]');
    const perf=nowPerf();
    sessions.forEach((session,key)=>{
      if(!session.note||session.note.done){sessions.delete(key);return;}
      if(paused){
        const delta=Math.max(0,perf-session.lastPerfMs);
        session.startPerfMs+=delta;
        session.lastPerfMs=perf;
        return;
      }
      session.lastPerfMs=perf;
      if(session.releaseRequired&&session.startJudgment===null&&session.note.holdJudgment){
        session.startJudgment=session.note.holdJudgment;
        session.startDeltaMs=Number(session.note.holdDeltaMs)||0;
      }
      if(session.kind==='FLICK'&&!session.finished&&perf-session.startPerfMs>RHYTHM_FLICK_MAX_MS){
        finishGesture(session,false);
        return;
      }
      if((session.kind==='SLIDE'||session.kind==='HOLD')&&!session.finished)evaluatePosition(session,positions.get(key));
      if(session.releaseRequired&&!session.note.done){
        const releaseDelta=estimatedSongMs(session)-(session.releaseTargetMs+session.offsetMs);
        if(!session.autoCompletionDeferred&&releaseDelta>=-RHYTHM_RELEASE_DEFER_ARM_MS){
          // 本体の「終端到達で自動成功」を終端判定窓の直後まで延期する。
          session.note.endTimeMs=session.releaseTargetMs+RHYTHM_RELEASE_MAX_MS+1;
          session.autoCompletionDeferred=true;
        }
        if(releaseDelta>=RHYTHM_RELEASE_AUTO_MISS_ARM_MS){
          session.expiredGuard=true;
          session.note.holdJudgment='MISS';
          session.note.holdDeltaMs=releaseDelta;
        }
      }
    });
    RHYTHM_PERF.gestureFrame();
    if(sessions.size&&typeof requestAnimationFrame==='function')raf=requestAnimationFrame(tick);
  };
  const ensureTick=()=>{
    if(!raf&&sessions.size&&typeof requestAnimationFrame==='function')raf=requestAnimationFrame(tick);
  };
  const record=(key,clientX,clientY)=>{
    const pos={clientX:Number(clientX)||0,clientY:Number(clientY)||0,perfMs:nowPerf()};
    positions.set(String(key),pos);
    evaluatePosition(sessions.get(String(key)),pos);
  };
  const release=(key,cancelled=false)=>{
    const id=String(key),session=sessions.get(id);
    positions.delete(id);
    if(!session){sessions.delete(id);return;}
    if(session.releaseRequired&&!session.note.done){
      if(session.startJudgment===null&&session.note.holdJudgment){
        session.startJudgment=session.note.holdJudgment;
        session.startDeltaMs=Number(session.note.holdDeltaMs)||0;
      }
      const songNow=estimatedSongMs(session);
      const releaseDelta=songNow-(session.releaseTargetMs+session.offsetMs);
      const endJudgment=cancelled?'MISS':rhythmJudgeRelease(releaseDelta);
      const startJudgment=session.startJudgment||session.note.holdJudgment||'MISS';
      const finalJudgment=session.failed?'MISS':rhythmWorseJudgment(startJudgment,endJudgment);
      const startRank=RHYTHM_RELEASE_JUDGMENT_IDS.indexOf(startJudgment),endRank=RHYTHM_RELEASE_JUDGMENT_IDS.indexOf(endJudgment);
      session.note.holdJudgment=finalJudgment;
      session.note.holdDeltaMs=session.failed||endRank>=startRank?releaseDelta:(session.startDeltaMs||0);
      session.note._rhythmReleaseJudgment=endJudgment;
      session.note._rhythmReleaseDeltaMs=releaseDelta;
      session.note._rhythmReleaseDone=true;
      // game-system.jsx の既存 inputEnds に最終判定だけ適用させる。
      // document capture は play-area の inputEnds より先に走るため、ここで終了時刻を
      // 現在より十分前へ寄せれば旧「早離し」分岐へ入らず、上で合成した判定が1回だけ反映される。
      session.note.endTimeMs=songNow-session.offsetMs-101;
    }
    sessions.delete(id);
  };
  const bind=(inputKeyValue,note,kind,startSongMs,offsetMs)=>{
    const key=String(inputKeyValue||'');
    if(!key||!note||(kind!=='HOLD'&&kind!=='FLICK'&&kind!=='SLIDE'))return;
    const pos=positions.get(key)||{clientX:0,clientY:0,perfMs:nowPerf()};
    note._rhythmGestureType=kind;
    note._rhythmOriginalType=kind;
    note.type='HOLD';
    const releaseRequired=kind==='HOLD'||kind==='SLIDE';
    const releaseTargetMs=releaseRequired?(Number(note.endTimeMs)||Number(note.timeMs)||0):null;
    if(releaseRequired){
      note._rhythmReleaseTargetMs=releaseTargetMs;
      note._rhythmReleaseOriginalEndTimeMs=releaseTargetMs;
      note._rhythmReleaseRequired=true;
      // 普段の見た目は元のendTimeMsを保ち、終端100ms前からだけ自動完了を延期する。
      // release() が終端判定を作り、押しっぱなしなら+200ms超でMISSになる。
    }else if(kind==='FLICK')note.endTimeMs=(Number(note.timeMs)||0)+60000;
    const perf=nowPerf();
    sessions.set(key,{key,note,kind,startSongMs:Number(startSongMs)||0,offsetMs:Number(offsetMs)||0,startPerfMs:perf,lastPerfMs:perf,startX:pos.clientX,startY:pos.clientY,finished:false,failed:false,releaseRequired,releaseTargetMs,startJudgment:null,startDeltaMs:0,expiredGuard:false,autoCompletionDeferred:false,trackingBadSincePerf:null});
    ensureTick();
  };
  const slideVisualLaneForIndex=index=>{
    for(const session of sessions.values()){
      if(session.kind==='SLIDE'&&session.note?.index===index&&!session.note.done)return rhythmSlideExpectedLane(session.note,estimatedSongMs(session)-session.offsetMs);
    }
    return null;
  };
  const clear=()=>{
    positions.clear();
    sessions.clear();
    if(raf&&typeof cancelAnimationFrame==='function')cancelAnimationFrame(raf);
    raf=0;
  };

  if(typeof document!=='undefined'){
    const captureTouchPositions=event=>{Array.from(event.changedTouches||[]).forEach(touch=>record(inputKey('touch',touch.identifier),touch.clientX,touch.clientY));};
    const captureTouchStart=event=>{if(event.target?.closest?.('[data-rhythm-play-area]'))RHYTHM_NOTE_SE_RUNTIME.warm();captureTouchPositions(event);};
    const releaseTouches=event=>{Array.from(event.changedTouches||[]).forEach(touch=>release(inputKey('touch',touch.identifier),false));};
    const cancelTouches=event=>{Array.from(event.changedTouches||[]).forEach(touch=>release(inputKey('touch',touch.identifier),true));};
    document.addEventListener('touchstart',captureTouchStart,{capture:true,passive:true});
    document.addEventListener('touchmove',captureTouchPositions,{capture:true,passive:true});
    document.addEventListener('touchend',releaseTouches,{capture:true,passive:true});
    document.addEventListener('touchcancel',cancelTouches,{capture:true,passive:true});
    document.addEventListener('pointerdown',event=>{if(event.pointerType!=='touch'){if(event.target?.closest?.('[data-rhythm-play-area]'))RHYTHM_NOTE_SE_RUNTIME.warm();record(inputKey('pointer',event.pointerId),event.clientX,event.clientY);}},true);
    document.addEventListener('pointermove',event=>{if(event.pointerType!=='touch')record(inputKey('pointer',event.pointerId),event.clientX,event.clientY);},true);
    document.addEventListener('pointerup',event=>{if(event.pointerType!=='touch')release(inputKey('pointer',event.pointerId),false);},true);
    document.addEventListener('pointercancel',event=>{if(event.pointerType!=='touch')release(inputKey('pointer',event.pointerId),true);},true);
    document.addEventListener('click',event=>{const button=event.target?.closest?.('[data-rhythm-pause-menu] button');if(button&&/リスタート|中断/.test(button.textContent||''))clear();},true);
  }

  return {bind,record,release,clear,slideVisualLaneForIndex,invalidateAreaRect,_sessions:sessions};
})();

// iPhoneのTouch.radiusXを既存projectionへ通し、実際の接触幅に応じたサブレーン領域として扱う。
// radiusXは端を拾いすぎないよう70%へ縮小し、隣接サブレーンは25%以上重なった時だけ接触扱いにする。
// 明らかな異常値だけ中心1サブレーンへfallbackする。ゲーム本体の中心1点入力はそのまま残し、
// 中心以外の新規接触サブレーンだけTAP専用の疑似Pointerで補う。
const RHYTHM_TOUCH_RADIUS_SCALE=.70;
const RHYTHM_TOUCH_MIN_SUBLANE_COVERAGE=.25;
const RHYTHM_TOUCH_RADIUS_MAX_PLAY_AREA_RATIO=.25;
const RHYTHM_TOUCH_CENTER_DEADZONE_MIN_PX=6;
const RHYTHM_TOUCH_CENTER_DEADZONE_MAX_PX=10;
const RHYTHM_TOUCH_CENTER_DEADZONE_PLAY_AREA_RATIO=.02;
const RHYTHM_TOUCH_RADIUS_EXPAND_MIN_PX=3;
const RHYTHM_TOUCH_RADIUS_EXPAND_MIN_RATIO=.10;
const RHYTHM_TOUCH_SPAN_RUNTIME=(()=>{
  const touchStates=new Map(),syntheticTapKeys=new Set();
  let nextSyntheticPointerId=900000;
  const clampSubLane=value=>Math.max(0,Math.min(RHYTHM_SUB_LANE_COUNT-1,Math.floor(Number(value))));
  const centerDeadzonePx=rect=>Math.min(RHYTHM_TOUCH_CENTER_DEADZONE_MAX_PX,Math.max(RHYTHM_TOUCH_CENTER_DEADZONE_MIN_PX,(Number(rect?.width)||0)*RHYTHM_TOUCH_CENTER_DEADZONE_PLAY_AREA_RATIO));
  const stabilizedMoveTouch=(previous,touch,rect)=>{
    const rawClientX=Number(touch?.clientX),rawClientY=Number(touch?.clientY),rawRadiusX=Number(touch?.radiusX);
    const previousAnchor=Number(previous?.centerAnchorX),anchor=Number.isFinite(previousAnchor)?previousAnchor:rawClientX,deadzone=centerDeadzonePx(rect);
    const centerMoved=Number.isFinite(rawClientX)&&Number.isFinite(anchor)&&Math.abs(rawClientX-anchor)>deadzone,effectiveClientX=centerMoved?rawClientX:anchor;
    return {touch:{identifier:touch?.identifier,clientX:effectiveClientX,clientY:rawClientY,radiusX:rawRadiusX},centerAnchorX:effectiveClientX,centerMoved,rawClientX};
  };
  const radiusExpansionAccepted=(previousRadius,currentRadius)=>{
    const from=Number(previousRadius),to=Number(currentRadius);
    if(!(from>0&&to>from))return false;
    return to-from>=Math.max(RHYTHM_TOUCH_RADIUS_EXPAND_MIN_PX,from*RHYTHM_TOUCH_RADIUS_EXPAND_MIN_RATIO);
  };
  const contactsForTouch=(touch,rect)=>{
    const centerCoordinate=rhythmSubLaneCoordinateAtPoint(touch?.clientX,touch?.clientY,rect);
    if(!Number.isFinite(centerCoordinate))return null;
    const centerSubLane=clampSubLane(centerCoordinate),rawRadiusX=Number(touch?.radiusX);
    if(!(rawRadiusX>0))return {centerCoordinate,centerSubLane,subLanes:[centerSubLane]};
    const maxSaneRadiusX=Number(rect?.width)*RHYTHM_TOUCH_RADIUS_MAX_PLAY_AREA_RATIO;
    if(!(maxSaneRadiusX>0)||rawRadiusX>maxSaneRadiusX)return {centerCoordinate,centerSubLane,subLanes:[centerSubLane]};
    const radiusX=rawRadiusX*RHYTHM_TOUCH_RADIUS_SCALE;
    const leftCoordinate=rhythmSubLaneCoordinateAtPoint(Number(touch.clientX)-radiusX,touch.clientY,rect);
    const rightCoordinate=rhythmSubLaneCoordinateAtPoint(Number(touch.clientX)+radiusX,touch.clientY,rect);
    const coordinates=[centerCoordinate];
    if(Number.isFinite(leftCoordinate))coordinates.push(leftCoordinate);
    if(Number.isFinite(rightCoordinate))coordinates.push(rightCoordinate);
    const min=Math.max(0,Math.min(...coordinates)),max=Math.min(RHYTHM_SUB_LANE_COUNT-.000001,Math.max(...coordinates));
    let subLanes=[];
    for(let lane=clampSubLane(min);lane<=clampSubLane(max);lane++){
      const overlap=Math.max(0,Math.min(max,lane+1)-Math.max(min,lane));
      if(lane===centerSubLane||overlap>=RHYTHM_TOUCH_MIN_SUBLANE_COVERAGE)subLanes.push(lane);
    }
    if(!subLanes.includes(centerSubLane))subLanes.push(centerSubLane);
    subLanes.sort((a,b)=>a-b);
    return {centerCoordinate,centerSubLane,subLanes};
  };
  const defer=fn=>{if(typeof queueMicrotask==='function')queueMicrotask(fn);else Promise.resolve().then(fn);};
  const pointForSubLane=(subLane,clientY,rect)=>{
    const yRatio=rhythmClamp01((Number(clientY)-rect.top)/rect.height),nx=rhythmProjectBoundary((Number(subLane)+.5)/2,yRatio);
    return {clientX:rect.left+rect.width*nx,clientY:Number(clientY)};
  };
  const makePointerEvent=(type,id,point)=>{
    const init={bubbles:true,cancelable:true,pointerId:id,pointerType:'pen',isPrimary:false,clientX:point.clientX,clientY:point.clientY,button:0,buttons:type==='pointerdown'?1:0};
    if(typeof PointerEvent==='function')return new PointerEvent(type,init);
    const event=new Event(type,{bubbles:true,cancelable:true});
    Object.entries(init).forEach(([key,value])=>{try{Object.defineProperty(event,key,{value,configurable:true});}catch{}});
    return event;
  };
  const dispatchTapProbe=(area,touch,subLane)=>{
    if(!area?.dispatchEvent)return false;
    const rect=area.getBoundingClientRect();
    if(!(rect.width>0&&rect.height>0))return false;
    const id=++nextSyntheticPointerId,key=`pointer:${id}`,point=pointForSubLane(subLane,touch.clientY,rect);
    syntheticTapKeys.add(key);
    try{
      area.dispatchEvent(makePointerEvent('pointerdown',id,point));
      area.dispatchEvent(makePointerEvent('pointerup',id,point));
      return true;
    }finally{syntheticTapKeys.delete(key);}
  };
  // 指を動かすたびに10要素を querySelectorAll で引き直し、毎回全部へ書き込んでいた。
  // 要素は覚えておき、状態が変わったサブレーンだけ書き換える(書き込みはstyle再計算を誘発するため)。
  let glowNodes=null;
  const applyTouchSpanGlow=()=>{
    if(typeof document==='undefined')return;
    const active=new Set();
    touchStates.forEach(state=>state.subLanes.forEach(lane=>active.add(lane)));
    // プレイ画面を作り直すとDOMが入れ替わるので、外れていたら引き直す
    if(!glowNodes||!glowNodes.length||!glowNodes[0].isConnected){
      RHYTHM_PERF.domQuery();
      glowNodes=Array.from(document.querySelectorAll('[data-rhythm-sublane-feedback]'));
    }
    glowNodes.forEach((el,index)=>{
      const want=active.has(index);
      if(want===(el.dataset.rhythmTouchspan==='true'))return;
      if(want)el.dataset.rhythmTouchspan='true';
      else delete el.dataset.rhythmTouchspan;
    });
  };
  const clear=()=>{touchStates.clear();applyTouchSpanGlow();};
  const startOrMove=(event,isStart)=>{
    if(typeof document==='undefined')return;
    const eventArea=event.target?.closest?.('[data-rhythm-play-area]'),fallbackArea=document.querySelector('[data-rhythm-play-area]'),area=eventArea||fallbackArea;
    if(!area)return;
    if(isStart&&!eventArea)return;
    const rect=area.getBoundingClientRect();
    if(!(rect.width>0&&rect.height>0))return;
    const actions=[];
    Array.from(event.changedTouches||[]).forEach(touch=>{
      const id=Number(touch.identifier),previous=touchStates.get(id),stabilized=previous&&!isStart?stabilizedMoveTouch(previous,touch,rect):{touch,centerAnchorX:Number(touch.clientX),centerMoved:false},next=contactsForTouch(stabilized.touch,rect);
      if(!next)return;
      const previousSet=new Set(previous?.subLanes||[]),candidateEntered=next.subLanes.filter(lane=>!previousSet.has(lane)),centerChanged=!previous||previous.centerSubLane!==next.centerSubLane;
      let entered=candidateEntered,acceptedRadiusX=Number(previous?.acceptedRadiusX);
      const rawRadiusX=Number(touch?.radiusX);
      if(isStart||centerChanged||stabilized.centerMoved){
        acceptedRadiusX=rawRadiusX>0?rawRadiusX:acceptedRadiusX;
      }else if(candidateEntered.length){
        if(!radiusExpansionAccepted(acceptedRadiusX,rawRadiusX)){
          const nextSet=new Set(next.subLanes),kept=(previous?.subLanes||[]).filter(lane=>nextSet.has(lane));
          if(!kept.includes(next.centerSubLane))kept.push(next.centerSubLane);
          next.subLanes=kept.sort((a,b)=>a-b);
          entered=[];
        }else acceptedRadiusX=rawRadiusX;
      }else if(rawRadiusX>0&&(!(acceptedRadiusX>0)||rawRadiusX<acceptedRadiusX))acceptedRadiusX=rawRadiusX;
      touchStates.set(id,{...next,touch,centerAnchorX:stabilized.centerAnchorX,acceptedRadiusX});
      if(isStart||centerChanged||entered.length)actions.push({id,touch,next,entered:isStart?next.subLanes:entered});
    });
    if(!actions.length){defer(applyTouchSpanGlow);return;}
    RHYTHM_NOTE_SE_RUNTIME.beginInputGroup?.();
    defer(()=>{
      let eligible=false;
      try{
        actions.forEach(action=>{
          const baseKey=`touch:${action.id}`;
          if(RHYTHM_GESTURE_RUNTIME._sessions?.has(baseKey))return;
          eligible=true;
          action.entered.filter(lane=>lane!==action.next.centerSubLane).forEach(lane=>dispatchTapProbe(area,action.touch,lane));
        });
        if(!eligible)RHYTHM_NOTE_SE_RUNTIME.markInputGroupHandled?.();
        applyTouchSpanGlow();
      }finally{RHYTHM_NOTE_SE_RUNTIME.endInputGroup?.();}
    });
  };
  if(typeof document!=='undefined'){
    const style=document.createElement('style');
    style.dataset.rhythmTouchSpan='';
    style.textContent='[data-rhythm-sublane-feedback][data-rhythm-touchspan="true"]{opacity:1!important}';
    document.head.appendChild(style);
    document.addEventListener('touchstart',event=>startOrMove(event,true),{capture:true,passive:true});
    document.addEventListener('touchmove',event=>{if(Array.from(event.changedTouches||[]).some(touch=>touchStates.has(Number(touch.identifier))))startOrMove(event,false);},{capture:true,passive:true});
    const finish=event=>{Array.from(event.changedTouches||[]).forEach(touch=>touchStates.delete(Number(touch.identifier)));defer(applyTouchSpanGlow);};
    document.addEventListener('touchend',finish,{capture:true,passive:true});
    document.addEventListener('touchcancel',finish,{capture:true,passive:true});
    document.addEventListener('click',event=>{if(event.target?.closest?.('[data-rhythm-pause],[data-rhythm-pause-menu] button'))clear();},true);
  }
  return {contactsForTouch,isSyntheticTapKey:key=>syntheticTapKeys.has(String(key)),clear,_touchStates:touchStates,_syntheticTapKeys:syntheticTapKeys,_stabilizedMoveTouch:stabilizedMoveTouch,_radiusExpansionAccepted:radiusExpansionAccepted};
})();

const rhythmMatchInputBatch=(notes,inputs,nowMs,offsetMs=0)=>{
  const source=Array.isArray(notes)?notes:[],claimed=new Set(),seenInputs=new Set(),now=Number(nowMs),offset=Number(offsetMs)||0;
  return (Array.isArray(inputs)?inputs:[]).map(input=>{
    const key=String(input?.inputKey??'');
    if(!key||seenInputs.has(key))return {input,target:null,deltaMs:null};
    seenInputs.add(key);
    const lane=Number(input?.lane),subCoordinate=Number(input?.subLaneCoordinate),tapOnly=RHYTHM_TOUCH_SPAN_RUNTIME.isSyntheticTapKey(key);
    const inputSpan=note=>{
      if(rhythmNoteHasVariableSpan(note)){
        const span=rhythmProjectSubLaneSpan(note.subLane,note.subLaneWidth,1);
        return {start:span.subLane,end:span.subLane+span.subLaneWidth,center:span.subLane+span.subLaneWidth/2,width:span.subLaneWidth};
      }
      return rhythmSlideInputSpan(note);
    };
    const acceptsPosition=note=>{
      const span=inputSpan(note);
      if(!span)return note.lane===lane;
      if(!Number.isFinite(subCoordinate))return note.lane===lane;
      const tolerance=span.width===1?RHYTHM_NARROW_TAP_TOLERANCE_SUB_LANES:0;
      return subCoordinate>=span.start-tolerance&&subCoordinate<=span.end+tolerance;
    };
    const spatialDistance=note=>{
      if(!Number.isFinite(subCoordinate))return 0;
      const span=inputSpan(note);
      return span?Math.abs(subCoordinate-span.center):0;
    };
    const candidates=source.map((note,index)=>({note,index})).filter(({note,index})=>!claimed.has(index)&&!note.done&&note.activePointerId===null&&RHYTHM_NOTE_TYPES.includes(note.type)&&(!tapOnly||note.type==='TAP')&&acceptsPosition(note)&&Math.abs(now-(note.timeMs+offset))<=200).sort((a,b)=>Math.abs(now-(a.note.timeMs+offset))-Math.abs(now-(b.note.timeMs+offset))||spatialDistance(a.note)-spatialDistance(b.note)||a.index-b.index);
    const picked=candidates[0];
    if(!picked)return {input,target:null,deltaMs:null};
    claimed.add(picked.index);
    const originalType=picked.note.type;
    if(originalType==='HOLD'||originalType==='FLICK'||originalType==='SLIDE')RHYTHM_GESTURE_RUNTIME.bind(key,picked.note,originalType,now,offset);
    RHYTHM_NOTE_SE_RUNTIME.play();
    return {input,target:picked.note,deltaMs:now-(picked.note.timeMs+offset)};
  });
};

const emptyRhythmChart = (level=0) => Object.freeze({ level, notes:Object.freeze([]), totalNotes:0 });
const atsuCupTapNotes = Object.freeze([
  [1800,2],[2600,0],[3200,4],[4000,1],[4400,3],[5200,2],[5800,2],[6400,0],[6400,4],
  [7200,1],[7600,2],[8000,3],[8800,0],[9200,4],[10000,2],[10600,1],[11200,3],[11800,0],
  [11800,4],[12600,2],[13000,1],[13400,0],[14200,3],[14600,4],[15000,2],[15800,0],[16200,1],
  [16600,2],[17000,3],[17400,4],[18200,1],[18200,3],[19000,0],[19400,2],[19800,4],[20600,2],
  [21200,1],[21600,3],[22200,0],[22200,4],[23000,2],[23400,1],[23800,3],[24600,0],[24600,4],
].map(([timeMs,lane])=>Object.freeze({type:'TAP',timeMs,lane})));
const atsuCupTapChart = Object.freeze({level:1,notes:atsuCupTapNotes,totalNotes:atsuCupTapNotes.length,durationMs:26000});

// STEP 3A: HOLDと複数指入力を検証するNORMAL専用テスト譜面。
// HOLD中の別レーンTAPと、同時2本HOLDを意図的に含める。
const atsuCupHoldTestNotes = Object.freeze([
  Object.freeze({type:'TAP',timeMs:1800,lane:2}),
  Object.freeze({type:'HOLD',timeMs:2600,endTimeMs:4000,lane:0}),
  Object.freeze({type:'TAP',timeMs:3200,lane:4}),
  Object.freeze({type:'TAP',timeMs:3600,lane:2}),
  Object.freeze({type:'TAP',timeMs:4600,lane:1}),
  Object.freeze({type:'HOLD',timeMs:5200,endTimeMs:6800,lane:3}),
  Object.freeze({type:'TAP',timeMs:5800,lane:0}),
  Object.freeze({type:'TAP',timeMs:6400,lane:4}),
  Object.freeze({type:'TAP',timeMs:7600,lane:2}),
  Object.freeze({type:'HOLD',timeMs:8400,endTimeMs:10000,lane:1}),
  Object.freeze({type:'TAP',timeMs:9000,lane:3}),
  Object.freeze({type:'TAP',timeMs:9600,lane:4}),
  Object.freeze({type:'HOLD',timeMs:11800,endTimeMs:13600,lane:0}),
  Object.freeze({type:'HOLD',timeMs:11800,endTimeMs:13600,lane:4}),
  Object.freeze({type:'TAP',timeMs:14200,lane:2}),
  Object.freeze({type:'HOLD',timeMs:15000,endTimeMs:16600,lane:3}),
  Object.freeze({type:'TAP',timeMs:15600,lane:0}),
  Object.freeze({type:'TAP',timeMs:16200,lane:1}),
  Object.freeze({type:'HOLD',timeMs:17400,endTimeMs:19000,lane:2}),
  Object.freeze({type:'TAP',timeMs:18000,lane:4}),
  Object.freeze({type:'TAP',timeMs:18600,lane:0}),
  Object.freeze({type:'HOLD',timeMs:19800,endTimeMs:21600,lane:1}),
  Object.freeze({type:'TAP',timeMs:20400,lane:3}),
  Object.freeze({type:'TAP',timeMs:21200,lane:4}),
  Object.freeze({type:'TAP',timeMs:22800,lane:0}),
  Object.freeze({type:'TAP',timeMs:23400,lane:2}),
  Object.freeze({type:'TAP',timeMs:24200,lane:4}),
]);
const atsuCupHoldTestChart = Object.freeze({level:5,notes:atsuCupHoldTestNotes,totalNotes:atsuCupHoldTestNotes.length,durationMs:26000});

// STEP 3B: 4種類のノーツと複数指ジェスチャーを確認するHARD専用テスト譜面。
// FLICKは方向指定なし。SLIDEはslidePointsを1本の指で追従し、各ノーツは最終的に1判定だけを持つ。
const atsuCupGestureTestNotes = Object.freeze([
  Object.freeze({type:'TAP',timeMs:1800,lane:2}),
  Object.freeze({type:'FLICK',timeMs:2600,lane:0}),
  Object.freeze({type:'TAP',timeMs:3200,lane:4}),
  Object.freeze({type:'HOLD',timeMs:4000,endTimeMs:5600,lane:1}),
  Object.freeze({type:'FLICK',timeMs:4600,lane:4}),
  Object.freeze({type:'SLIDE',timeMs:6400,endTimeMs:8000,lane:0,endLane:2,slidePoints:Object.freeze([Object.freeze({timeMs:6400,lane:0}),Object.freeze({timeMs:7200,lane:1}),Object.freeze({timeMs:8000,lane:2})])}),
  Object.freeze({type:'TAP',timeMs:7200,lane:4}),
  Object.freeze({type:'FLICK',timeMs:8800,lane:3}),
  Object.freeze({type:'HOLD',timeMs:9600,endTimeMs:11200,lane:0}),
  Object.freeze({type:'SLIDE',timeMs:10000,endTimeMs:11600,lane:4,endLane:2,slidePoints:Object.freeze([Object.freeze({timeMs:10000,lane:4}),Object.freeze({timeMs:10800,lane:3}),Object.freeze({timeMs:11600,lane:2})])}),
  Object.freeze({type:'TAP',timeMs:12400,lane:2}),
  Object.freeze({type:'FLICK',timeMs:13200,lane:0}),
  Object.freeze({type:'FLICK',timeMs:13200,lane:4}),
  Object.freeze({type:'SLIDE',timeMs:14400,endTimeMs:16400,lane:1,endLane:3,slidePoints:Object.freeze([Object.freeze({timeMs:14400,lane:1}),Object.freeze({timeMs:15400,lane:2}),Object.freeze({timeMs:16400,lane:3})])}),
  Object.freeze({type:'TAP',timeMs:15200,lane:4}),
  Object.freeze({type:'HOLD',timeMs:17400,endTimeMs:19000,lane:3}),
  Object.freeze({type:'FLICK',timeMs:18000,lane:0}),
  Object.freeze({type:'SLIDE',timeMs:19800,endTimeMs:21800,lane:4,endLane:1,slidePoints:Object.freeze([Object.freeze({timeMs:19800,lane:4}),Object.freeze({timeMs:20800,lane:3}),Object.freeze({timeMs:21300,lane:2}),Object.freeze({timeMs:21800,lane:1})])}),
  Object.freeze({type:'TAP',timeMs:20600,lane:0}),
  Object.freeze({type:'TAP',timeMs:22800,lane:2}),
]);
const atsuCupGestureTestChart = Object.freeze({level:9,notes:atsuCupGestureTestNotes,totalNotes:atsuCupGestureTestNotes.length,durationMs:26000});

// 10サブレーン入力と幅1〜4を実際に確認するデバッグ専用譜面。
const widthTestNotes = Object.freeze([
  [1800,0,1],[2600,4,1],[3400,9,1], // 左端・中央・右端の幅1
  [4400,1,2],[5200,3,3],[6000,6,4], // 幅2〜4とワイドTAP
  [7200,4,1],[7200,5,1],             // 隣接する幅1の同時押し
  [8400,0,1],[9000,1,2],[9600,3,3],[10200,6,4], // 幅1→2→3→4
  [11200,3,1],[11200,4,1],[11200,5,1],          // 1本指の接触幅で確認する幅1×3同時TAP
].map(([timeMs,subLane,subLaneWidth])=>Object.freeze({type:'TAP',timeMs,lane:Math.floor(subLane/2),subLane,subLaneWidth})));
const widthTestChart=Object.freeze({level:1,notes:widthTestNotes,totalNotes:widthTestNotes.length,durationMs:13000});
// STEP 2A: 可変幅HOLDの始点・帯・ENDバーと複数指入力を確認するNORMAL専用譜面。
const widthHoldTestNotes=Object.freeze([
  [1800,3200,0,1],[4000,5400,2,2],[6200,7600,4,3],[8400,10000,6,4],
  [10800,12200,0,1],[13000,14400,9,1],
  [15200,17000,4,1],[15200,17000,5,1],
].map(([timeMs,endTimeMs,subLane,subLaneWidth])=>Object.freeze({type:'HOLD',timeMs,endTimeMs,lane:Math.floor(subLane/2),subLane,subLaneWidth})).concat([
  Object.freeze({type:'HOLD',timeMs:18000,endTimeMs:20200,lane:2,subLane:4,subLaneWidth:2}),
  Object.freeze({type:'TAP',timeMs:18800,lane:4,subLane:8,subLaneWidth:2}),
  // STEP 2C: FLICKもTAP/HOLDと同じ10サブレーン・幅1〜4で開始位置を確認する。
  Object.freeze({type:'FLICK',timeMs:22200,lane:0,subLane:0,subLaneWidth:1}),
  Object.freeze({type:'FLICK',timeMs:23000,lane:1,subLane:2,subLaneWidth:2}),
  Object.freeze({type:'FLICK',timeMs:23800,lane:2,subLane:4,subLaneWidth:3}),
  Object.freeze({type:'FLICK',timeMs:24600,lane:3,subLane:6,subLaneWidth:4}),
  Object.freeze({type:'FLICK',timeMs:25600,lane:4,subLane:9,subLaneWidth:1}),
  Object.freeze({type:'FLICK',timeMs:26600,lane:2,subLane:4,subLaneWidth:1}),
  Object.freeze({type:'FLICK',timeMs:26600,lane:2,subLane:5,subLaneWidth:1}),
  Object.freeze({type:'FLICK',timeMs:27800,lane:1,subLane:2,subLaneWidth:2}),
  Object.freeze({type:'TAP',timeMs:27800,lane:4,subLane:8,subLaneWidth:2}),
  Object.freeze({type:'HOLD',timeMs:29000,endTimeMs:31000,lane:0,subLane:0,subLaneWidth:2}),
  Object.freeze({type:'FLICK',timeMs:29800,lane:3,subLane:6,subLaneWidth:2}),
]));
const widthHoldTestChart=Object.freeze({level:2,notes:widthHoldTestNotes,totalNotes:widthHoldTestNotes.length,durationMs:32000});
// STEP 2B-1: SLIDEの幅は従来のまま、始点とslidePointsを0.5レーン刻みへ拡張するHARD専用テスト譜面。
const widthSlideTestNotes=Object.freeze([
  Object.freeze({type:'SLIDE',timeMs:1800,endTimeMs:3600,lane:.5,endLane:2,slidePoints:Object.freeze([Object.freeze({timeMs:1800,lane:.5}),Object.freeze({timeMs:2400,lane:1}),Object.freeze({timeMs:3000,lane:1.5}),Object.freeze({timeMs:3600,lane:2})])}),
  Object.freeze({type:'SLIDE',timeMs:4600,endTimeMs:6400,lane:3.5,endLane:2,slidePoints:Object.freeze([Object.freeze({timeMs:4600,lane:3.5}),Object.freeze({timeMs:5200,lane:3}),Object.freeze({timeMs:5800,lane:2.5}),Object.freeze({timeMs:6400,lane:2})])}),
  Object.freeze({type:'SLIDE',timeMs:7400,endTimeMs:9800,lane:1,endLane:3,slidePoints:Object.freeze([Object.freeze({timeMs:7400,lane:1}),Object.freeze({timeMs:8000,lane:1.5}),Object.freeze({timeMs:8600,lane:1}),Object.freeze({timeMs:9200,lane:2.5}),Object.freeze({timeMs:9800,lane:3})])}),
  Object.freeze({type:'TAP',timeMs:8600,lane:4,subLane:8,subLaneWidth:2}),
  Object.freeze({type:'SLIDE',timeMs:10800,endTimeMs:12800,lane:2.5,endLane:.5,slidePoints:Object.freeze([Object.freeze({timeMs:10800,lane:2.5}),Object.freeze({timeMs:11300,lane:2}),Object.freeze({timeMs:11800,lane:1.5}),Object.freeze({timeMs:12300,lane:1}),Object.freeze({timeMs:12800,lane:.5})])}),
]);
const widthSlideTestChart=Object.freeze({level:4,notes:widthSlideTestNotes,totalNotes:widthSlideTestNotes.length,durationMs:14000});
// STEP 2B-2: SLIDE全体へsubLaneWidth 1〜4を指定するEXPERT専用テスト譜面。
// この段階では途中幅変化は行わず、1ノーツ内は始点・帯・ENDバーまで一定幅とする。
const widthSlideVariableTestNotes=Object.freeze([
  Object.freeze({type:'SLIDE',timeMs:1800,endTimeMs:3400,lane:0,endLane:1,subLaneWidth:1,slidePoints:Object.freeze([Object.freeze({timeMs:1800,lane:0}),Object.freeze({timeMs:2600,lane:.5}),Object.freeze({timeMs:3400,lane:1})])}),
  Object.freeze({type:'SLIDE',timeMs:4200,endTimeMs:5800,lane:1,endLane:2.5,subLaneWidth:2,slidePoints:Object.freeze([Object.freeze({timeMs:4200,lane:1}),Object.freeze({timeMs:5000,lane:1.5}),Object.freeze({timeMs:5800,lane:2.5})])}),
  Object.freeze({type:'SLIDE',timeMs:6600,endTimeMs:8400,lane:1.5,endLane:2.5,subLaneWidth:3,slidePoints:Object.freeze([Object.freeze({timeMs:6600,lane:1.5}),Object.freeze({timeMs:7200,lane:2}),Object.freeze({timeMs:7800,lane:1.5}),Object.freeze({timeMs:8400,lane:2.5})])}),
  Object.freeze({type:'SLIDE',timeMs:9200,endTimeMs:11200,lane:1.5,endLane:2.5,subLaneWidth:4,slidePoints:Object.freeze([Object.freeze({timeMs:9200,lane:1.5}),Object.freeze({timeMs:9800,lane:2}),Object.freeze({timeMs:10400,lane:2.5}),Object.freeze({timeMs:11200,lane:2.5})])}),
  Object.freeze({type:'TAP',timeMs:10000,lane:4,subLane:8,subLaneWidth:2}),
  Object.freeze({type:'SLIDE',timeMs:12200,endTimeMs:14200,lane:.5,endLane:1.5,subLaneWidth:1,slidePoints:Object.freeze([Object.freeze({timeMs:12200,lane:.5}),Object.freeze({timeMs:13200,lane:1}),Object.freeze({timeMs:14200,lane:1.5})])}),
  Object.freeze({type:'SLIDE',timeMs:12200,endTimeMs:14200,lane:3.5,endLane:2.5,subLaneWidth:1,slidePoints:Object.freeze([Object.freeze({timeMs:12200,lane:3.5}),Object.freeze({timeMs:13200,lane:3}),Object.freeze({timeMs:14200,lane:2.5})])}),
]);
const widthSlideVariableTestChart=Object.freeze({level:7,notes:widthSlideVariableTestNotes,totalNotes:widthSlideVariableTestNotes.length,durationMs:15500});
// STEP 2B-4: STEP2B-3の幅変化に、複雑な経路を実際に追従するMASTER専用テストを追加する。
const widthSlideChangingTestNotes=Object.freeze([
  // STEP2B-3の基本的な幅変化を維持する。
  Object.freeze({type:'SLIDE',timeMs:1800,endTimeMs:3800,lane:1.5,endLane:1.5,slidePoints:Object.freeze([Object.freeze({timeMs:1800,lane:1.5,subLaneWidth:1}),Object.freeze({timeMs:3800,lane:1.5,subLaneWidth:4})])}),
  Object.freeze({type:'SLIDE',timeMs:4600,endTimeMs:6600,lane:2.5,endLane:2.5,slidePoints:Object.freeze([Object.freeze({timeMs:4600,lane:2.5,subLaneWidth:4}),Object.freeze({timeMs:6600,lane:2.5,subLaneWidth:1})])}),
  Object.freeze({type:'SLIDE',timeMs:7400,endTimeMs:10600,lane:1.5,endLane:1.5,slidePoints:Object.freeze([Object.freeze({timeMs:7400,lane:1.5,subLaneWidth:1}),Object.freeze({timeMs:8400,lane:1.5,subLaneWidth:3}),Object.freeze({timeMs:9400,lane:1.5,subLaneWidth:2}),Object.freeze({timeMs:10600,lane:1.5,subLaneWidth:4})])}),
  // 大きなS字。緩やかな折り返しで帯と追従経路の一致を見る。
  Object.freeze({type:'SLIDE',timeMs:11400,endTimeMs:15800,lane:.5,endLane:.5,subLaneWidth:2,slidePoints:Object.freeze([Object.freeze({timeMs:11400,lane:.5}),Object.freeze({timeMs:12500,lane:2}),Object.freeze({timeMs:13600,lane:3.5}),Object.freeze({timeMs:14700,lane:2}),Object.freeze({timeMs:15800,lane:.5})])}),
  // 細かいジグザグ。短いsegmentの連続で飛びや隙間が出ないかを見る。
  Object.freeze({type:'SLIDE',timeMs:16600,endTimeMs:20600,lane:1,endLane:3,subLaneWidth:1,slidePoints:Object.freeze([Object.freeze({timeMs:16600,lane:1}),Object.freeze({timeMs:17100,lane:3}),Object.freeze({timeMs:17600,lane:1}),Object.freeze({timeMs:18100,lane:3}),Object.freeze({timeMs:18600,lane:1}),Object.freeze({timeMs:19100,lane:3}),Object.freeze({timeMs:19600,lane:1}),Object.freeze({timeMs:20100,lane:3}),Object.freeze({timeMs:20600,lane:3})])}),
  // 0.5レーン単位の左右移動。SLIDE中の別TAPも同時に確認する。
  Object.freeze({type:'SLIDE',timeMs:21400,endTimeMs:25400,lane:1.5,endLane:1.5,subLaneWidth:1,slidePoints:Object.freeze([Object.freeze({timeMs:21400,lane:1.5}),Object.freeze({timeMs:21900,lane:2}),Object.freeze({timeMs:22400,lane:1.5}),Object.freeze({timeMs:22900,lane:2}),Object.freeze({timeMs:23400,lane:1.5}),Object.freeze({timeMs:23900,lane:2}),Object.freeze({timeMs:24400,lane:1.5}),Object.freeze({timeMs:24900,lane:2}),Object.freeze({timeMs:25400,lane:1.5})])}),
  Object.freeze({type:'TAP',timeMs:23400,lane:4,subLane:8,subLaneWidth:2}),
  // 曲がりながら幅1→4→1。頭とENDバーも各時刻の幅に揃える。
  Object.freeze({type:'SLIDE',timeMs:26200,endTimeMs:30600,lane:.5,endLane:3.5,slidePoints:Object.freeze([Object.freeze({timeMs:26200,lane:.5,subLaneWidth:1}),Object.freeze({timeMs:27300,lane:2,subLaneWidth:2}),Object.freeze({timeMs:28400,lane:3.5,subLaneWidth:4}),Object.freeze({timeMs:29500,lane:2,subLaneWidth:2}),Object.freeze({timeMs:30600,lane:3.5,subLaneWidth:1})])}),
  // 多数pointの長い経路。同時HOLDで別pointerの入力も確認する。
  Object.freeze({type:'SLIDE',timeMs:31400,endTimeMs:39400,lane:.5,endLane:3.5,subLaneWidth:2,slidePoints:Object.freeze([Object.freeze({timeMs:31400,lane:.5}),Object.freeze({timeMs:31900,lane:1}),Object.freeze({timeMs:32400,lane:1.5}),Object.freeze({timeMs:32900,lane:2}),Object.freeze({timeMs:33400,lane:2.5}),Object.freeze({timeMs:33900,lane:3}),Object.freeze({timeMs:34400,lane:3.5}),Object.freeze({timeMs:34900,lane:3}),Object.freeze({timeMs:35400,lane:2.5}),Object.freeze({timeMs:35900,lane:2}),Object.freeze({timeMs:36400,lane:1.5}),Object.freeze({timeMs:36900,lane:1}),Object.freeze({timeMs:37400,lane:.5}),Object.freeze({timeMs:37900,lane:1.5}),Object.freeze({timeMs:38400,lane:2.5}),Object.freeze({timeMs:38900,lane:3}),Object.freeze({timeMs:39400,lane:3.5})])}),
  Object.freeze({type:'HOLD',timeMs:33800,endTimeMs:35800,lane:4,subLane:8,subLaneWidth:2}),
]);
const widthSlideChangingTestChart=Object.freeze({level:9,notes:widthSlideChangingTestNotes,totalNotes:widthSlideChangingTestNotes.length,durationMs:41000});

// 同じあつ杯テーマ音源を0秒から使う、約60秒の総合回帰テスト譜面。
// 正式譜面候補やWIDTH TESTとは分離し、169 BPM / beatZero 40msの16分グリッドへ揃える。
const atsuCupDebugGridMs=grid=>Math.round(40+Number(grid)*(60000/169/4));
const atsuCupDebugTap=(grid,subLane,subLaneWidth=2)=>Object.freeze({type:'TAP',timeMs:atsuCupDebugGridMs(grid),lane:Math.floor(subLane/2),subLane,subLaneWidth});
const atsuCupDebugHold=(startGrid,endGrid,subLane,subLaneWidth=2)=>Object.freeze({type:'HOLD',timeMs:atsuCupDebugGridMs(startGrid),endTimeMs:atsuCupDebugGridMs(endGrid),lane:Math.floor(subLane/2),subLane,subLaneWidth});
const atsuCupDebugFlick=(grid,subLane,subLaneWidth=2)=>Object.freeze({type:'FLICK',timeMs:atsuCupDebugGridMs(grid),lane:Math.floor(subLane/2),subLane,subLaneWidth});
const atsuCupDebugSlide=(points,subLaneWidth=2)=>{
  const slidePoints=Object.freeze(points.map(([grid,lane,width])=>Object.freeze({timeMs:atsuCupDebugGridMs(grid),lane,...(width?{subLaneWidth:width}:{})})));
  return Object.freeze({type:'SLIDE',timeMs:slidePoints[0].timeMs,endTimeMs:slidePoints[slidePoints.length-1].timeMs,lane:slidePoints[0].lane,endLane:slidePoints[slidePoints.length-1].lane,subLaneWidth,slidePoints});
};
const atsuCupDebugShortNotes=Object.freeze([
  // 0〜14秒: 導入、左右・中央・交互・同時押しの基本TAP。
  atsuCupDebugTap(20,4),atsuCupDebugTap(32,2),atsuCupDebugTap(40,6),
  atsuCupDebugTap(48,0),atsuCupDebugTap(56,8),atsuCupDebugTap(64,2),atsuCupDebugTap(72,6),
  atsuCupDebugTap(80,4),atsuCupDebugTap(88,0),atsuCupDebugTap(88,8),atsuCupDebugTap(96,2),
  atsuCupDebugTap(104,6),atsuCupDebugTap(112,4),atsuCupDebugTap(120,0),atsuCupDebugTap(120,8),
  atsuCupDebugTap(132,2),atsuCupDebugTap(144,6),
  // 14〜24秒: 幅1〜4、左右端、隣接幅1、2本指と指腹接触の確認。
  atsuCupDebugTap(160,0,1),atsuCupDebugTap(176,2,2),atsuCupDebugTap(192,4,3),atsuCupDebugTap(208,6,4),
  atsuCupDebugTap(220,9,1),atsuCupDebugTap(232,4,1),atsuCupDebugTap(232,5,1),
  atsuCupDebugTap(244,0,1),atsuCupDebugTap(244,8,2),
  atsuCupDebugTap(260,3,1),atsuCupDebugTap(260,4,1),atsuCupDebugTap(260,5,1),
  // 24〜34秒: 幅1〜4、短長HOLD、HOLD中別TAP、左右2本指。
  atsuCupDebugHold(276,292,0,1),atsuCupDebugHold(304,328,2,2),atsuCupDebugTap(316,8,2),
  atsuCupDebugHold(340,372,4,3),atsuCupDebugTap(352,0,1),
  atsuCupDebugHold(380,412,6,4),atsuCupDebugHold(380,404,0,1),
  // 34〜42秒: 左右・幅違いFLICKとFLICK+別TAP。
  atsuCupDebugFlick(420,0,1),atsuCupDebugFlick(432,8,2),atsuCupDebugFlick(444,2,3),
  atsuCupDebugFlick(456,6,4),atsuCupDebugFlick(468,0,2),atsuCupDebugTap(468,8,2),
  // 42〜52秒: 直線、0.5レーン、折り返し、固定幅、幅1→4→1。
  atsuCupDebugSlide([[480,.5],[496,1.5],[512,2.5]],2),
  atsuCupDebugSlide([[520,3.5],[532,3],[544,3.5],[556,2.5]],1),
  atsuCupDebugSlide([[566,.5,1],[578,2,4],[590,3.5,1]],1),
  atsuCupDebugTap(578,8,2),
  // 52〜58秒: HOLD/SLIDE中の別TAP、幅違い、左右2本指。
  atsuCupDebugHold(596,628,0,2),atsuCupDebugTap(608,8,1),atsuCupDebugTap(620,6,3),
  atsuCupDebugSlide([[632,3.5,1],[644,2.5,3],[656,3.5,2]],1),atsuCupDebugTap(644,0,2),
  // 終了直前は疎にして、最終ノーツ後の短縮終了とリザルト遷移を見やすくする。
  atsuCupDebugTap(664,4,2),
]);
const ATSU_CUP_DEBUG_SHORT_END_MS=atsuCupDebugGridMs(676);
const atsuCupDebugShortChart=Object.freeze({level:8,notes:atsuCupDebugShortNotes,totalNotes:atsuCupDebugShortNotes.length,durationMs:ATSU_CUP_DEBUG_SHORT_END_MS});

// DEBUG ONLY: モンスターノーツの確認用。既存の譜面は触らず、専用の1曲として分けてある。
// 約40秒のあいだに、設定した枠の順どおり4個のモンスターノーツを 20 / 40 / 60 / 80% 付近へ置く(§3.3)。
// 曲開始直後・終了直前は避け、前後を少し空けて狙って取れるようにしている。
const monsterNoteTestTap=(timeMs,subLane,monsterSlot=null)=>Object.freeze({
  type:'TAP',timeMs,lane:Math.floor(subLane/2),subLane,subLaneWidth:2,
  ...(monsterSlot?{monsterSlot}:{}),
});
const MONSTER_NOTE_TEST_DURATION_MS=40000;
const monsterNoteTestNotes=Object.freeze([
  monsterNoteTestTap(2000,4), monsterNoteTestTap(2800,2), monsterNoteTestTap(3600,6),
  monsterNoteTestTap(4400,0), monsterNoteTestTap(5200,8), monsterNoteTestTap(6000,4),
  monsterNoteTestTap(8000,4,1),   // 20%付近: 1枠目
  monsterNoteTestTap(10000,2), monsterNoteTestTap(10800,6), monsterNoteTestTap(11600,0),
  monsterNoteTestTap(12400,8), monsterNoteTestTap(13200,4), monsterNoteTestTap(14000,2),
  monsterNoteTestTap(16000,4,2),  // 40%付近: 2枠目
  monsterNoteTestTap(18000,6), monsterNoteTestTap(18800,0), monsterNoteTestTap(19600,8),
  monsterNoteTestTap(20400,2), monsterNoteTestTap(21200,6), monsterNoteTestTap(22000,4),
  monsterNoteTestTap(24000,4,3),  // 60%付近: 3枠目
  monsterNoteTestTap(26000,0), monsterNoteTestTap(26800,8), monsterNoteTestTap(27600,2),
  monsterNoteTestTap(28400,6), monsterNoteTestTap(29200,4), monsterNoteTestTap(30000,0),
  monsterNoteTestTap(32000,4,4),  // 80%付近: 4枠目(終盤の復帰チャンス)
  monsterNoteTestTap(34000,8), monsterNoteTestTap(34800,2), monsterNoteTestTap(35600,6),
  monsterNoteTestTap(36400,4),
]);
const monsterNoteTestChart=Object.freeze({level:3,notes:monsterNoteTestNotes,totalNotes:monsterNoteTestNotes.length,durationMs:MONSTER_NOTE_TEST_DURATION_MS});

// DEBUG ONLY: 体験版の先行公開曲「Monster Hero」の正式候補v1（EASY / NORMAL / HARD）。
// tools/mode/rhythm-monster-hero-chart-build.js が実音源のオンセット解析から決定的に組み立て、
// 下のマーカーの内側だけを書き換える。手で書き換えず、方針を変えるときはツール側を直す。
//
//   t(時刻, サブレーン, 幅, モンスター枠)   TAP（枠0は通常ノーツ）
//   h(時刻, サブレーン, 幅, 終了時刻)       HOLD
//   f(時刻, サブレーン, 幅)                 FLICK
//   s(時刻, 終了時刻, [[時刻,レーン,幅]...]) SLIDE（レーンは0.5刻み）
//
// 耳確認前の制作候補であり、正式完成譜面ではない。デバッグ導線でだけ遊べる状態にしてある。
const mhTap=(timeMs,subLane,subLaneWidth,monsterSlot)=>Object.freeze({
  type:'TAP',timeMs,lane:Math.floor(subLane/2),subLane,subLaneWidth,
  ...(monsterSlot?{monsterSlot}:{}),
});
const mhHold=(timeMs,subLane,subLaneWidth,endTimeMs)=>Object.freeze({
  type:'HOLD',timeMs,endTimeMs,lane:Math.floor(subLane/2),subLane,subLaneWidth,
});
const mhFlick=(timeMs,subLane,subLaneWidth)=>Object.freeze({
  type:'FLICK',timeMs,lane:Math.floor(subLane/2),subLane,subLaneWidth,
});
const mhSlide=(timeMs,endTimeMs,points)=>{
  const slidePoints=Object.freeze(points.map(([pointTimeMs,lane,subLaneWidth])=>Object.freeze({timeMs:pointTimeMs,lane,subLaneWidth})));
  return Object.freeze({
    type:'SLIDE',timeMs,endTimeMs,
    lane:slidePoints[0].lane,endLane:slidePoints[slidePoints.length-1].lane,
    subLaneWidth:slidePoints[0].subLaneWidth,slidePoints,
  });
};
const mhChart=(level,notes,durationMs)=>Object.freeze({level,notes:Object.freeze(notes),totalNotes:notes.length,durationMs});
const MONSTER_HERO_EASY_DURATION_MS=152761;

const monsterHeroEasyNotes=((t,h,f,s)=>[
// <monster-hero-easy-notes>
  t(5577,2,2,0),h(6097,4,2,6790),t(10948,2,2,0),t(11988,4,2,0),
  t(13200,2,2,0),t(14413,4,2,0),t(14760,6,2,0),t(16146,4,2,0),
  t(16319,4,2,0),t(17185,6,2,0),t(18571,4,2,0),t(20650,6,2,0),
  t(20997,4,2,0),t(21690,2,2,0),t(23423,4,2,0),t(24289,2,2,0),
  t(25502,4,2,0),h(25848,6,2,26541),t(27061,4,2,0),t(27754,2,2,0),
  t(28967,4,2,0),t(29313,2,2,0),t(29487,2,2,0),t(30699,4,2,0),
  t(31046,6,2,0),t(31392,8,2,0),t(31739,6,2,0),t(32432,4,2,0),
  t(32952,2,2,0),t(33298,0,2,0),t(34511,2,2,1),t(35897,0,2,0),
  t(37283,2,2,0),t(37630,0,2,0),t(38496,2,2,0),t(39016,4,2,0),
  t(39362,6,2,0),t(39709,8,2,0),t(40228,6,2,0),t(40575,4,2,0),
  t(41615,2,2,0),t(41961,4,2,0),h(44213,2,2,44906),t(45253,4,2,0),
  t(46119,2,2,0),t(47159,0,2,0),h(48025,2,2,48718),t(49931,0,2,0),
  t(50451,2,2,0),t(51144,4,2,0),t(51837,2,2,0),t(52703,0,2,0),
  t(53223,2,2,0),t(53396,2,2,0),t(54089,4,2,0),t(54782,2,2,0),
  t(55475,0,2,0),t(55648,2,2,0),t(56168,4,2,0),t(57381,2,2,0),
  t(58247,0,2,0),t(59114,2,2,0),t(59633,4,2,0),t(60846,2,2,0),
  t(61539,4,2,0),t(61886,6,2,0),t(62752,4,2,0),t(63445,2,2,0),
  t(64311,4,2,2),t(64658,6,2,0),t(65178,8,2,0),t(65871,6,2,0),
  t(66564,4,2,0),t(67776,6,2,0),t(68123,4,2,0),t(68989,2,2,0),
  t(71761,0,2,0),t(72628,2,2,0),t(72974,4,2,0),t(73494,6,2,0),
  h(74360,4,2,75053),t(75746,6,2,0),t(76093,8,2,0),t(76439,6,2,0),
  t(77306,4,2,0),t(77652,2,2,0),t(78865,4,2,0),t(79038,4,2,0),
  t(79731,2,2,0),t(80424,0,2,0),t(80944,2,2,0),t(81637,4,2,0),
  t(81810,4,2,0),t(82330,2,2,0),t(83196,0,2,0),t(83370,2,2,0),
  t(84063,4,2,0),h(84409,6,2,85102),t(85795,4,2,0),t(85968,4,2,0),
  t(86488,6,2,0),t(86661,6,2,0),t(88567,4,2,0),t(89607,6,2,0),
  t(89953,8,2,0),t(90993,6,2,0),t(91166,6,2,0),t(91513,4,2,0),
  t(91686,6,2,0),t(92379,8,2,3),t(92726,6,2,0),t(93072,4,2,0),
  t(94112,2,2,0),t(95151,4,2,0),t(95498,6,2,0),t(95671,6,2,0),
  h(96884,4,2,97577),t(98270,6,2,0),t(98616,4,2,0),t(99309,2,2,0),
  t(99829,0,2,0),t(100002,2,2,0),t(100349,4,2,0),t(101215,6,2,0),
  t(102081,4,2,0),t(102601,2,2,0),t(103814,4,2,0),t(105547,6,2,0),
  t(106240,8,2,0),t(106586,6,2,0),t(106759,6,2,0),t(107972,4,2,0),
  t(110398,2,2,0),t(111957,4,2,0),t(112304,6,2,0),h(113516,4,2,114209),
  t(114902,6,2,0),t(115076,6,2,0),t(116289,4,2,0),t(116982,6,2,0),
  t(117848,8,2,0),t(118368,6,2,0),t(118541,6,2,0),t(120620,8,2,0),
  t(121486,6,2,0),t(121660,6,2,0),t(122699,8,2,0),t(123392,6,2,0),
  t(124605,4,2,4),t(126164,6,2,0),t(127030,4,2,0),h(127377,2,2,128070),
  t(128590,4,2,0),t(130149,2,2,0),t(130496,4,2,0),t(130669,4,2,0),
  t(131015,6,2,0),t(131362,8,2,0),t(132228,6,2,0),t(133095,4,2,0),
  t(134307,6,2,0),t(134481,6,2,0),t(136560,8,2,0),t(136906,6,2,0),
  t(137426,4,2,0),t(141238,2,2,0),t(141411,2,2,0),t(141931,4,2,0),
  t(142624,6,2,0),t(142797,6,2,0),t(143143,4,2,0),t(144703,6,2,0),
  h(145742,4,2,146435),t(147995,6,2,0),t(149554,4,2,0),t(149727,4,2,0),
// </monster-hero-easy-notes>
])(mhTap,mhHold,mhFlick,mhSlide);
const monsterHeroNormalNotes=((t,h,f,s)=>[
// <monster-hero-normal-notes>
  t(4191,8,2,0),h(4364,4,1,5057),t(5577,0,2,0),f(6097,4,1),
  t(7483,0,2,0),t(10948,4,2,0),t(11988,7,3,0),t(12681,4,2,0),
  t(13027,0,2,0),t(13200,0,1,0),t(14413,4,3,0),t(14760,8,2,0),
  t(16146,4,2,0),t(16319,4,1,0),t(17185,7,3,0),t(18571,4,2,0),
  t(20650,8,2,0),t(20997,4,2,0),h(21690,0,2,22383),f(23423,4,1),
  t(24116,0,2,0),t(24289,0,1,0),t(24635,4,2,0),t(25502,7,3,0),
  t(25848,4,3,0),t(26195,0,2,0),t(26541,4,2,0),t(27061,7,3,0),
  t(27754,4,2,0),t(28967,7,3,0),t(29313,4,2,0),t(29487,4,1,0),
  t(30526,0,2,0),t(30699,4,1,0),t(31046,8,2,0),t(31392,4,2,0),
  t(31739,0,2,0),t(32432,4,2,1),t(32952,7,3,0),t(33298,4,2,0),
  h(34511,8,2,35204),f(35897,4,1),t(37283,8,2,0),t(37630,4,2,0),
  t(38496,0,3,0),t(39016,4,3,0),t(39362,7,3,0),t(39709,4,3,0),
  t(40228,0,2,0),t(40748,4,2,0),t(41615,8,2,0),h(42827,4,2,43520),
  t(44213,0,3,0),t(45253,4,3,0),t(45773,8,2,0),t(46986,4,2,0),
  t(47159,4,1,0),t(48025,7,3,0),t(49931,4,2,0),f(50451,6,1),
  t(51144,4,2,0),t(51837,0,2,0),t(52703,4,3,0),t(53223,8,2,0),
  t(53569,4,2,0),t(54089,0,2,0),t(54782,4,3,0),t(55475,7,3,0),
  t(55648,4,1,0),t(56168,0,3,0),h(57381,4,3,57727),t(58247,7,3,0),
  t(59114,4,3,0),t(59633,0,2,0),t(60846,4,2,0),t(61539,7,3,2),
  f(61886,4,1),t(62405,0,2,0),t(62752,4,3,0),t(63445,7,3,0),
  t(64311,4,3,0),t(64658,0,3,0),t(65178,4,3,0),t(65351,0,1,0),
  t(65871,4,3,0),t(66564,7,3,0),t(67776,4,2,0),h(68123,0,3,68469),
  t(68989,4,3,0),t(70722,8,2,0),t(71761,4,2,0),t(72108,0,2,0),
  t(72628,4,3,0),t(72974,7,3,0),t(73321,4,2,0),t(73494,4,1,0),
  t(74360,0,2,0),h(74707,4,2,75400),t(75746,8,2,0),t(76093,4,2,0),
  t(76266,4,1,0),t(76439,0,1,0),t(77306,4,3,0),t(77652,8,2,0),
  t(78865,4,3,0),t(79038,4,1,0),t(79731,0,3,0),t(80424,4,3,0),
  f(80944,6,1),t(81637,4,2,0),t(81810,4,1,0),h(82330,0,3,82677),
  t(83196,4,3,0),t(83370,8,1,0),t(84063,4,3,0),f(84409,0,1),
  t(85795,4,2,0),t(85968,4,1,0),t(86142,8,1,0),t(86488,4,2,0),
  t(86661,4,1,0),t(88567,0,2,0),t(88741,0,1,0),t(89607,4,3,0),
  t(89953,7,3,0),t(90993,4,3,0),t(91166,4,1,0),t(91513,0,3,0),
  t(91686,4,1,0),t(92379,7,3,3),t(92726,4,3,0),h(93072,0,3,93765),
  f(94112,4,1),t(95151,7,3,0),t(95498,4,2,0),t(95671,4,1,0),
  t(96884,0,3,0),t(97057,0,1,0),t(98270,4,3,0),t(98443,4,1,0),
  t(98616,0,1,0),t(99309,4,3,0),t(99829,7,3,0),t(100002,4,1,0),
  t(100349,0,3,0),t(101042,4,2,0),t(101215,4,1,0),t(102081,0,3,0),
  t(102601,4,3,0),t(103814,7,3,0),t(104161,4,2,0),t(104507,0,2,0),
  f(104854,4,1),t(105373,8,2,0),t(105547,4,1,0),t(106240,0,3,0),
  t(106586,4,3,0),t(106759,4,1,0),h(107972,0,3,108665),t(109531,4,2,0),
  h(110398,0,3,111091),t(111957,4,3,0),t(112304,7,3,0),t(113516,4,3,0),
  t(114902,8,2,0),t(115076,8,1,0),t(116289,4,3,0),f(116982,6,1),
  t(117848,4,3,0),t(118368,0,3,0),t(118541,0,1,0),t(120620,4,3,0),
  t(121486,0,3,0),t(121660,0,1,0),t(122699,4,3,0),t(123392,7,3,0),
  t(124605,4,3,4),h(125298,8,2,125644),t(126164,4,3,0),t(127030,0,2,0),
  t(127377,4,2,0),t(128763,8,2,0),t(128936,8,1,0),t(130149,4,3,0),
  t(130496,7,3,0),t(130842,4,2,0),t(131015,4,1,0),t(131362,0,2,0),
  f(132228,4,1),t(133095,8,2,0),t(134307,4,3,0),t(134481,4,1,0),
  h(135693,0,2,136040),t(136560,4,3,0),t(136906,8,2,0),t(137426,4,3,0),
  t(138119,0,2,0),t(139159,4,2,0),t(141238,0,3,0),t(141411,0,1,0),
  t(141931,4,3,0),t(142624,7,3,0),t(142797,8,1,0),t(142970,4,1,0),
  t(143143,4,1,0),f(144703,8,1),t(145396,4,2,0),h(145742,0,2,146435),
  t(147995,4,3,0),t(149554,0,3,0),t(149727,0,1,0),t(149900,4,1,0),
// </monster-hero-normal-notes>
])(mhTap,mhHold,mhFlick,mhSlide);
const monsterHeroHardNotes=((t,h,f,s)=>[
// <monster-hero-hard-notes>
  t(2198,7,3,0),t(2718,2,2,0),t(3065,8,2,0),t(4191,2,2,0),
  t(4364,8,2,0),h(4711,2,2,5057),t(5577,7,3,0),s(6097,7136,[[6097,1,2],[6617,1.5,3],[7136,2,2]]),
  t(7483,2,2,0),t(7916,8,2,0),t(8262,2,2,0),f(8869,8,1),
  t(9649,2,2,0),t(10948,8,2,0),t(11121,2,2,0),t(11988,7,3,0),
  t(12334,2,2,0),t(12507,8,2,0),t(12681,2,2,0),t(13027,8,2,0),
  t(13200,2,3,0),t(13460,7,3,0),t(14413,2,4,0),t(14760,8,2,0),
  t(15106,2,2,0),t(16146,8,2,0),t(16492,2,2,0),t(16665,8,2,0),
  h(17185,2,4,17878),t(18571,8,2,0),t(19178,2,3,0),t(19438,8,2,0),
  t(20650,2,2,0),t(20997,7,3,0),t(21690,2,2,0),t(22296,6,4,0),
  t(23423,2,4,0),f(24116,8,1),t(24895,2,3,0),t(25502,7,3,0),
  t(25848,2,3,0),s(26195,27234,[[26195,3,2],[26714,3.5,3],[27234,4,2]]),t(26714,0,2,0),t(27321,7,3,0),
  t(27754,2,2,0),t(28967,6,4,0),t(29313,2,2,0),t(29487,8,2,0),
  t(29746,2,2,0),t(30526,8,2,0),t(30699,2,4,0),t(31046,8,2,0),
  t(31392,2,2,1),t(31739,8,2,0),t(31912,2,2,0),f(32432,6,1),
  t(32952,2,4,0),t(33298,7,3,0),h(34511,2,3,35204),t(34858,8,2,0),
  t(35897,7,3,0),t(36070,2,2,0),t(37283,7,3,0),t(37456,2,2,0),
  t(37630,7,3,0),t(38669,2,2,0),t(38842,8,2,0),t(39016,2,3,0),
  t(39362,7,3,0),f(39709,2,1),t(40228,7,3,0),t(40748,2,2,0),
  t(41095,8,2,0),t(41615,2,2,0),t(42827,8,2,0),t(43001,2,2,0),
  h(44213,6,4,44906),t(44560,0,2,0),s(45253,46292,[[45253,1,2],[45773,1.5,3],[46292,2,2]]),t(45773,8,2,0),
  t(46986,2,2,0),t(47159,7,3,0),t(48025,2,3,0),t(48285,7,3,0),
  t(48545,2,2,0),t(48718,8,2,0),t(49758,2,2,0),t(49931,7,3,0),
  f(50451,2,1),t(51144,7,3,0),t(51404,2,2,0),h(51837,8,2,52183),
  t(52010,0,2,0),t(52703,2,3,0),t(53223,8,2,0),t(53569,2,2,0),
  t(54089,8,2,0),t(54262,2,2,0),t(54782,7,3,0),t(55475,2,3,0),
  t(55648,7,3,0),t(56168,2,3,0),t(56775,7,3,0),f(57381,2,1),
  t(58247,7,3,0),t(59114,2,3,0),t(59633,8,2,0),t(60846,2,2,0),
  t(61539,7,3,2),t(61886,2,3,0),t(62405,8,2,0),t(62752,2,4,0),
  t(63445,6,4,0),t(63792,2,2,0),t(64311,6,4,0),f(64658,2,1),
  t(65178,7,3,0),s(65351,66390,[[65351,1,2],[65871,1.5,3],[66390,2,2]]),t(65871,8,2,0),t(66564,2,3,0),
  t(67776,7,3,0),h(68123,2,4,68469),t(68989,7,3,0),t(69336,2,2,0),
  f(70202,8,1),t(70722,2,2,0),t(71935,8,2,0),t(72108,2,2,0),
  t(72628,6,4,0),t(72974,2,3,0),t(73321,8,2,0),t(73494,2,4,0),
  t(74360,8,2,0),h(74707,2,2,75400),t(75053,8,2,0),t(75746,8,2,0),
  t(76093,2,2,0),t(76266,8,2,0),t(76439,2,4,0),t(77479,8,2,0),
  t(77652,2,3,0),t(78865,6,4,0),t(79038,2,3,0),t(79731,6,4,0),
  t(80424,2,4,0),t(80944,6,4,0),t(81637,2,2,0),t(81810,6,4,0),
  f(82330,2,1),t(83196,6,4,0),t(83370,2,4,0),t(84063,7,3,0),
  h(84409,2,3,85102),t(84756,8,2,0),t(85795,8,2,0),t(85968,2,4,0),
  t(86142,7,3,0),h(86488,2,2,86835),t(86661,8,2,0),t(87441,7,3,0),
  s(88567,89607,[[88567,1,2],[89087,1.5,3],[89607,2,2]]),t(89087,8,2,0),t(89953,6,4,0),t(90213,2,3,0),
  t(90993,6,4,0),t(91166,2,3,0),t(91513,7,3,0),t(91686,2,4,0),
  t(92379,7,3,3),t(92726,2,3,0),h(93072,7,3,93765),f(94112,2,1),
  t(95151,6,4,0),t(95498,2,2,0),t(95671,6,4,0),t(96884,2,3,0),
  t(97057,8,2,0),t(98270,2,4,0),t(98443,8,2,0),t(98616,2,4,0),
  t(99309,6,4,0),t(99656,2,2,0),t(99829,6,4,0),t(100002,2,4,0),
  f(100349,6,1),t(101042,2,2,0),t(101215,6,4,0),t(102081,2,4,0),
  t(102601,6,4,0),t(103814,2,4,0),t(104161,8,2,0),t(104507,2,2,0),
  f(104854,8,1),t(105373,2,2,0),s(105547,106586,[[105547,2,2],[106066,2.5,3],[106586,3,2]]),t(106759,2,3,0),
  t(107972,6,4,0),t(108232,2,3,0),t(109098,8,2,0),t(109531,2,2,0),
  t(110398,7,3,0),t(111004,2,2,0),t(111957,7,3,0),t(112304,2,3,0),
  h(113516,7,3,114209),t(114902,2,3,0),t(115076,6,4,0),f(116289,2,1),
  t(116982,6,4,0),t(117328,2,2,0),t(117675,8,2,0),t(117848,2,4,0),
  t(118368,6,4,0),t(118801,2,4,0),t(120014,7,3,0),t(120620,2,3,0),
  t(121486,7,3,4),t(122093,2,3,0),t(122526,8,2,0),t(122699,2,4,0),
  t(123392,7,3,0),f(124605,2,1),h(125298,8,2,125644),t(125471,0,2,0),
  t(126164,2,4,0),t(127030,8,2,0),t(127377,2,2,0),t(127550,8,2,0),
  s(128763,129803,[[128763,1,2],[129283,1.5,3],[129803,2,2]]),t(129283,8,2,0),t(130149,2,3,0),t(130496,6,4,0),
  t(130842,2,2,0),t(131015,8,2,0),t(131362,2,2,0),t(131622,8,2,0),
  h(132228,2,2,132575),t(133095,7,3,0),t(134307,2,4,0),t(134481,8,2,0),
  f(135693,2,1),t(136386,8,2,0),t(136560,2,3,0),t(136906,8,2,0),
  t(137426,2,4,0),t(138119,8,2,0),t(138552,2,2,0),t(139159,8,2,0),
  t(139938,2,2,0),t(141238,7,3,0),t(141411,2,3,0),t(141931,7,3,0),
  t(142624,2,3,0),t(142797,7,3,0),t(142970,2,2,0),t(143143,7,3,0),
  t(144096,2,3,0),f(144703,6,1),t(145396,2,2,0),h(145742,7,3,146089),
  t(146695,2,3,0),t(147388,7,3,0),t(147995,2,3,0),t(149554,6,4,0),
  t(149727,2,4,0),s(149900,150940,[[149900,2,2],[150420,2.5,3],[150940,3,2]]),
// </monster-hero-hard-notes>
])(mhTap,mhHold,mhFlick,mhSlide);
const monsterHeroEasyChart=mhChart(1,monsterHeroEasyNotes,MONSTER_HERO_EASY_DURATION_MS);
const monsterHeroNormalChart=mhChart(3,monsterHeroNormalNotes,MONSTER_HERO_EASY_DURATION_MS);
const monsterHeroHardChart=mhChart(5,monsterHeroHardNotes,MONSTER_HERO_EASY_DURATION_MS);

const RHYTHM_SONGS = Object.freeze([
  Object.freeze({
    songId:'atsu_cup_theme_test',
    displayName:'あつ杯テーマ',
    bgmTrackId:'atsu_cup_theme',
    difficulties:Object.freeze(Object.fromEntries(RHYTHM_DIFFICULTIES.map(({id})=>[
      id,
      id==='EASY'?atsuCupTapChart:id==='NORMAL'?atsuCupHoldTestChart:id==='HARD'?atsuCupGestureTestChart:emptyRhythmChart()
    ])))
  }),
  Object.freeze({
    songId:'width_test', displayName:'WIDTH TEST', bgmTrackId:'atsu_cup_theme',
    difficulties:Object.freeze(Object.fromEntries(RHYTHM_DIFFICULTIES.map(({id})=>[id,id==='EASY'?widthTestChart:id==='NORMAL'?widthHoldTestChart:id==='HARD'?widthSlideTestChart:id==='EXPERT'?widthSlideVariableTestChart:id==='MASTER'?widthSlideChangingTestChart:emptyRhythmChart()])))
  }),
  Object.freeze({
    songId:'monster_note_test', displayName:'MONSTER NOTE TEST',
    debugDescription:'モンスターノーツの確認用（設定した枠の順に4個・約40秒）',
    bgmTrackId:'atsu_cup_theme', playDurationMs:MONSTER_NOTE_TEST_DURATION_MS,
    difficulties:Object.freeze(Object.fromEntries(RHYTHM_DIFFICULTIES.map(({id})=>[id,id==='EASY'?monsterNoteTestChart:emptyRhythmChart()])))
  }),
  // DEBUG ONLY: 体験版の先行公開曲「Monster Hero」のEASY正式候補v1を全尺で試すための入口。
  // 耳確認前の制作候補なので、正式な曲選択・BEST・一般ユーザー導線へは出さない。
  Object.freeze({
    songId:'monster_hero_theme_candidate',
    displayName:'Monster Hero 候補',
    debugDescription:'体験版の正式候補v1（EASY/NORMAL/HARD・全尺2分32秒・耳確認前）',
    bgmTrackId:'monster_hero_theme',
    // 全尺で遊ぶ曲なので playDurationMs（短縮再生の指定）は持たせない。
    // 終了は chart.durationMs と音源の終わりで決まる。
    difficulties:Object.freeze(Object.fromEntries(RHYTHM_DIFFICULTIES.map(({id})=>[
      id,
      id==='EASY'?monsterHeroEasyChart:id==='NORMAL'?monsterHeroNormalChart:id==='HARD'?monsterHeroHardChart:emptyRhythmChart()
    ])))
  }),
  Object.freeze({
    songId:'atsu_cup_theme_debug_short',
    displayName:'あつ杯テーマ DEBUG 60s',
    debugDescription:'約60秒の総合テスト（正式候補・WIDTH TESTとは別）',
    bgmTrackId:'atsu_cup_theme',
    playDurationMs:ATSU_CUP_DEBUG_SHORT_END_MS,
    difficulties:Object.freeze(Object.fromEntries(RHYTHM_DIFFICULTIES.map(({id})=>[id,id==='HARD'?atsuCupDebugShortChart:emptyRhythmChart()])))
  }),
]);

// 先行公開する「音ゲー体験版」で遊べる範囲。ここに書いた1曲・3難易度だけを体験版の画面へ出す。
// デバッグ画面の曲一覧(RHYTHM_SONGS)とは役割を分ける。デバッグ用の曲を体験版へ出さないため。
const RHYTHM_DEMO_SONG_ID='monster_hero_theme_candidate';
const RHYTHM_DEMO_DIFFICULTY_IDS=Object.freeze(['EASY','NORMAL','HARD']);
const RHYTHM_DEMO_DIFFICULTY_LABELS=Object.freeze({
  EASY:Object.freeze({name:'EASY', note:'はじめての人向け。TAPが中心で、押す場所も大きく動きません。'}),
  NORMAL:Object.freeze({name:'NORMAL', note:'ふつうの遊び方。FLICKと幅の違うノーツが増えます。'}),
  HARD:Object.freeze({name:'HARD', note:'いまの音ゲーでできることをひととおり。SLIDEと長押し中の別ノーツが入ります。'}),
});
const rhythmDemoSong=songs=>(songs||[]).find(song=>song.songId===RHYTHM_DEMO_SONG_ID)||null;
// 体験版で選べる難易度だけを、譜面が入っているものに限って返す。
// 譜面が空の難易度をボタンに出すと「押せるのに始まらない」状態になるため。
const rhythmDemoDifficulties=(song,difficulties)=>{
  if(!song)return [];
  return (difficulties||[]).filter(difficulty=>{
    if(!RHYTHM_DEMO_DIFFICULTY_IDS.includes(difficulty.id))return false;
    const chart=song.difficulties?.[difficulty.id];
    return !!chart&&Array.isArray(chart.notes)&&chart.notes.length>0;
  });
};

// モンビー(音ゲー)の全国ランキング。2026-09-04、ユーザー指示で先行公開時から用意する。
// 既存のSupabase `rankings` テーブル・列は増やさず、種族チャレンジ(Species-<血統>-<難易度>)と
// 同じやり方で difficulty 列へ Rhythm-<songId>-<難易度id> という専用キーを入れるだけにする。
// 難易度ごとに別々の行として保存しつつ、表示は複数キーをまとめて取得して1つの
// 「難易度合算」ランキングにする(=難易度が高いほど満点も高いので、高難易度で挑むほど有利になる)。
const RHYTHM_RANKING_PREFIX='Rhythm';
const RHYTHM_RANKING_SEPARATOR='-';
// songId(monster_hero_theme_candidate等)はアンダースコアのみでハイフンを含まないため、
// この区切り文字で3つに割ればsongIdを壊さず難易度idまで取り出せる
const rhythmRankingDifficultyKey=(songId,difficultyId)=>{
  if(!songId||!RHYTHM_DIFFICULTIES.some(d=>d.id===difficultyId))return null;
  return `${RHYTHM_RANKING_PREFIX}${RHYTHM_RANKING_SEPARATOR}${songId}${RHYTHM_RANKING_SEPARATOR}${difficultyId}`;
};
// ランキングキーから曲と難易度へ戻す。知らない形式や難易度はnull(既存キーとして扱わない)
const parseRhythmRankingDifficultyKey=(key)=>{
  const parts=String(key??'').trim().split(RHYTHM_RANKING_SEPARATOR);
  if(parts.length!==3||parts[0]!==RHYTHM_RANKING_PREFIX)return null;
  const [,songId,difficultyId]=parts;
  if(!songId||!RHYTHM_DIFFICULTIES.some(d=>d.id===difficultyId))return null;
  return {songId,difficultyId};
};
// 「難易度合算」ランキングを取りに行くときに展開する、実在するキーの一覧。
// 体験版で遊べる難易度(RHYTHM_DEMO_DIFFICULTY_IDS)だけを対象にする。
// 将来EXPERT/MASTERを体験版へ追加したときは、そちらの定数を増やすだけで自動的に対象へ入る
const rhythmRankingCombinedMembers=(songId)=>RHYTHM_DEMO_DIFFICULTY_IDS
  .map(difficultyId=>rhythmRankingDifficultyKey(songId,difficultyId))
  .filter(Boolean);
// 1回の取得で受け取る生の行数(重複ユーザーぶんを見込んで多めに取る)と、
// ユーザーごとに畳んだあと画面へ出す件数
const RHYTHM_RANKING_FETCH_LIMIT=200;
const RHYTHM_RANKING_DISPLAY_LIMIT=50;
// 同じユーザー名の行が複数あっても、いちばん高いスコアの1件だけを残す
// (「自分のスコアはハイスコア1件のみ」という仕様。書き込み側は1プレイ=1行のまま増やし続け、
// 表示のときにだけ集約する。既存のaggregateBreederLevelsと同じ考え方)
const rhythmRankingDedupeByUser=(rows)=>{
  const byUser=new Map();
  (rows||[]).forEach(r=>{
    const name=r?.user_name||'名無しのブリーダー';
    const score=Number(r?.score)||0;
    const cur=byUser.get(name);
    if(!cur||score>(Number(cur.score)||0))byUser.set(name,r);
  });
  return [...byUser.values()].sort((a,b)=>(Number(b.score)||0)-(Number(a.score)||0));
};
// Supabaseの生の行を画面表示用の形へ整える。partyには判定内訳等の詳細をJSONで持たせている
// (種族チャレンジがpartyへ育て方の詳細を持たせているのと同じ、列を増やさない考え方)
const rhythmRankingEntryFromRow=(row)=>{
  const parsed=parseRhythmRankingDifficultyKey(row?.difficulty);
  const detail=(row?.party&&typeof row.party==='object'&&!Array.isArray(row.party))?row.party:null;
  return {
    userName:row?.user_name||'名無しのブリーダー',
    score:Number(row?.score)||0,
    level:Number(row?.level)||0,
    icon:row?.icon??null,
    difficultyId:parsed?.difficultyId||row?.hero||null,
    detail,
  };
};

const installRhythmGestureVisuals=()=>{
  if(typeof document==='undefined'||typeof MutationObserver==='undefined')return;
  if(document.documentElement.dataset.rhythmGestureVisuals==='ready')return;
  document.documentElement.dataset.rhythmGestureVisuals='ready';
  const style=document.createElement('style');
  style.textContent=`
    [data-rhythm-note][data-note-type="FLICK"] > span:last-child{background:linear-gradient(180deg,#f9a8d4,#ec4899 52%,#a21caf)!important;border-color:rgba(253,164,175,.95)!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.8),0 0 16px rgba(236,72,153,.68)!important}
    [data-rhythm-note][data-note-type="FLICK"] > span:last-child::after{content:"▲";position:absolute;left:50%;top:-18px;transform:translateX(-50%);color:#fdf2f8;font-size:18px;line-height:1;text-shadow:0 0 8px #ec4899,0 0 14px #d946ef}
    [data-rhythm-note][data-note-type="SLIDE"] > span:last-child{background:linear-gradient(180deg,#ddd6fe,#a855f7 58%,#6d28d9)!important;border-color:rgba(221,214,254,.95)!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.82),0 0 16px rgba(168,85,247,.64)!important}
    svg[data-rhythm-slide-body]{position:absolute;inset:0;height:var(--rhythm-slide-area-height,0px)!important;overflow:visible;pointer-events:none;filter:drop-shadow(0 0 5px rgba(168,85,247,.38))}
    [data-rhythm-slide-segment]{fill:rgba(168,85,247,.48);stroke:rgba(233,213,255,.56);stroke-width:1}
  `;
  document.head.appendChild(style);
  const decorate=()=>{
    const area=document.querySelector('[data-rhythm-play-area]');
    if(!area)return;
    RHYTHM_PERF.noteRescan();
    const els=Array.from(area.querySelectorAll('[data-rhythm-note]'));
    els.forEach((el,index)=>{
      if(el.dataset.noteType!=='SLIDE'||el.querySelector('[data-rhythm-slide-body]'))return;
      const body=document.createElementNS('http://www.w3.org/2000/svg','svg');
      body.dataset.rhythmSlideBody='';
      body.setAttribute('aria-hidden','true');
      el.insertBefore(body,el.firstChild);
    });
    // HUDの中から目印で探す。以前は「HUDの最初の<small>」という位置頼みで拾っていたため、
    // HUDの並び順を変えたときにBEST行を'MIX TEST'で上書きしてしまう不具合を出した。
    const label=document.querySelector('[data-rhythm-mode-label]');
    const hasGestureNotes=els.some(el=>el.dataset.noteType==='FLICK'||el.dataset.noteType==='SLIDE');
    if(label&&hasGestureNotes&&label.textContent!=='MIX TEST')label.textContent='MIX TEST';
  };
  // decorate() は area 配下の全ノーツを引き直すので、DOMのどんな変化でも走ると重い。
  // (スコア・コンボ・判定表示の書き換えなど、ノーツと無関係な変化でも呼ばれていた)
  // ノーツ・プレイエリア・モード表記が増減したときだけ走らせる。やることは変えない。
  const RHYTHM_DECORATE_TARGET='[data-rhythm-note],[data-rhythm-play-area],[data-rhythm-mode-label]';
  const touchesPlayDom=records=>records.some(record=>{
    if(record.type!=='childList')return false;
    const hit=node=>node&&node.nodeType===1
      &&(node.matches?.(RHYTHM_DECORATE_TARGET)||node.querySelector?.(RHYTHM_DECORATE_TARGET));
    for(const node of record.addedNodes)if(hit(node))return true;
    for(const node of record.removedNodes)if(hit(node))return true;
    return false;
  });
  const observer=new MutationObserver(records=>{if(touchesPlayDom(records))decorate();});
  const start=()=>{decorate();observer.observe(document.body,{childList:true,subtree:true});};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});
  else start();
};
installRhythmGestureVisuals();

const installRhythmGeometryStyles=()=>{
  if(typeof document==='undefined')return;
  if(document.documentElement.dataset.rhythmGeometryStyle==='ready')return;
  document.documentElement.dataset.rhythmGeometryStyle='ready';
  const style=document.createElement('style');
  style.dataset.rhythmGeometryStyle='';
  style.textContent=`
    [data-rhythm-lane]{position:absolute!important;inset:0!important;border:0!important;filter:none!important;background:linear-gradient(180deg,rgba(15,23,42,.76) 0%,rgba(15,23,42,.48) 48%,rgba(8,47,73,.58) 100%)!important}
    [data-rhythm-lane]::before{content:"";position:absolute;inset:0!important;pointer-events:none;opacity:1!important;filter:none!important;background:linear-gradient(180deg,rgba(216,180,254,.26),rgba(103,232,249,.34) 72%,rgba(236,254,255,.72));clip-path:var(--rhythm-boundary-clip,none)!important}
    [data-rhythm-lane]::after{content:none!important}
    [data-rhythm-lane]:last-child::after{content:""!important;position:absolute;inset:0!important;pointer-events:none;opacity:1!important;filter:none!important;background:linear-gradient(180deg,rgba(216,180,254,.26),rgba(103,232,249,.34) 72%,rgba(236,254,255,.72));clip-path:var(--rhythm-right-clip,none)!important}
    [data-rhythm-sublane-boundary]{display:block;position:absolute;z-index:1;inset:0;pointer-events:none;background:linear-gradient(180deg,rgba(216,180,254,.12),rgba(103,232,249,.20) 70%,rgba(236,254,255,.38));clip-path:var(--rhythm-sub-clip,none)}
    [data-rhythm-note]{z-index:2}
    [data-rhythm-lane][data-pressed="true"]{background:linear-gradient(180deg,rgba(34,211,238,.10),rgba(34,211,238,.22) 54%,rgba(217,70,239,.30) 100%)!important;box-shadow:inset 0 0 30px rgba(103,232,249,.48),inset 0 -72px 64px rgba(6,182,212,.34),0 0 15px rgba(34,211,238,.24)!important;border:0!important;filter:none!important}
    [data-rhythm-note]>span:last-child{transform:scale(var(--rhythm-note-size-scale,1)) scaleY(var(--rhythm-note-depth-scale,1));transform-origin:center;filter:brightness(var(--rhythm-note-depth-brightness,1));transition:filter 40ms linear}
    [data-rhythm-note][data-rhythm-failed="true"]{filter:grayscale(1) brightness(.72)!important}
    [data-rhythm-note][data-rhythm-failed="true"]>span:last-child{box-shadow:none!important;border-color:rgba(148,163,184,.6)!important}
    [data-rhythm-judgment-line]{height:4px!important;background:linear-gradient(90deg,#d8b4fe 0%,#ecfeff 50%,#d8b4fe 100%)!important;border-radius:999px;box-shadow:0 0 14px #67e8f9,0 0 28px #c084fc,0 8px 24px rgba(34,211,238,.34)!important}
  `;
  document.head.appendChild(style);
};
installRhythmGeometryStyles();

const rhythmLayoutPlayArea=area=>{
  if(!area)return;
  const rect=area.getBoundingClientRect();
  if(!(rect.width>0&&rect.height>0))return;
  Array.from(area.querySelectorAll('[data-rhythm-lane]')).forEach((lane,index)=>{
    lane.style.clipPath=rhythmLanePolygon(index);
    lane.style.setProperty('--rhythm-boundary-clip',rhythmBoundaryLinePolygon(index));
    if(index===RHYTHM_LANE_COUNT-1)lane.style.setProperty('--rhythm-right-clip',rhythmBoundaryLinePolygon(RHYTHM_LANE_COUNT,-1));
    const label=lane.querySelector('span');
    if(label){
      const labelRect=label.getBoundingClientRect(),labelY=rhythmClamp01((labelRect.top-rect.top+labelRect.height/2)/rect.height),at=rhythmProjectLane(index,labelY);
      label.style.left=`${at.center*100}%`;
      label.style.transform='translateX(-50%)';
    }
  });
  Array.from(area.querySelectorAll('[data-rhythm-sublane-boundary]')).forEach((boundary,index)=>{
    boundary.style.setProperty('--rhythm-sub-clip',rhythmBoundaryLinePolygon(index+.5));
  });
  const line=area.querySelector('[data-rhythm-judgment-line]'),lineRect=line?.getBoundingClientRect();
  if(line&&lineRect){
    const y=rhythmClamp01((lineRect.top-rect.top+lineRect.height/2)/rect.height),left=rhythmProjectBoundary(0,y),right=rhythmProjectBoundary(RHYTHM_LANE_COUNT,y);
    line.style.left=`${(left*100).toFixed(4)}%`;
    line.style.right=`${((1-right)*100).toFixed(4)}%`;
  }
};
const rhythmSlideSegmentPolygons=(note,chartNowMs,travel,rect,noteHalfHeight=Number(travel.noteHalfHeight)||0)=>{
  const source=note?._rhythmSlideRenderPoints||rhythmSlidePoints(note),start=Number(source[0]?.timeMs)||0,end=Number(source[source.length-1]?.timeMs)||start;
  const now=Math.max(start,Math.min(end,Number(chartNowMs)||start));
  const project=point=>{
    const progress=1-(Number(point.timeMs)-Number(travel.visualTime))/Number(travel.travelMs),y=Number(travel.spawnY)+rhythmProjectTravelProgress(progress)*Number(travel.travelPx)+noteHalfHeight,yRatio=rhythmClamp01(y/rect.height),span=rhythmProjectSlideSpan(Number(point.lane),note,yRatio,point.timeMs),half=rect.width*span.width*RHYTHM_BODY_WIDTH_RATIO/2;
    return {y,left:rect.width*span.center-half,right:rect.width*span.center+half};
  };
  let firstIndex=0;
  while(firstIndex<source.length&&Number(source[firstIndex].timeMs)<=now)firstIndex++;
  const segments=[];
  // authored点の間をそのまま直線で結ぶと、projectionの曲線ぶんだけ途中がレーンから外れる。
  // 点の間隔が長い(=高速でSLIDEが画面より長く伸びる)ほど差が開くので、時間で細分化して沿わせる。
  const startPoint=now>start?{timeMs:now,lane:rhythmSlideExpectedLane(note,now)}:source[0];
  let fromPoint=startPoint,from=project(startPoint);
  for(let index=Math.max(1,firstIndex);index<source.length;index++){
    const toPoint=source[index],fromTime=Number(fromPoint.timeMs),toTime=Number(toPoint.timeMs),spanMs=toTime-fromTime;
    for(let step=1;step<=RHYTHM_SLIDE_SEGMENT_STEPS;step++){
      const ratio=step/RHYTHM_SLIDE_SEGMENT_STEPS,timeMs=fromTime+spanMs*ratio;
      const to=step===RHYTHM_SLIDE_SEGMENT_STEPS?project(toPoint):project({timeMs,lane:rhythmSlideExpectedLane(note,timeMs)});
      segments.push(`${from.left.toFixed(2)},${from.y.toFixed(2)} ${from.right.toFixed(2)},${from.y.toFixed(2)} ${to.right.toFixed(2)},${to.y.toFixed(2)} ${to.left.toFixed(2)},${to.y.toFixed(2)}`);
      from=to;
    }
    fromPoint=toPoint;
  }
  return segments;
};
const rhythmLayoutNoteVisual=(el,note,yPx,visualLane,area,releaseYpx=null,slideTravel=null,frameLayout=null)=>{
  if(!el||!area)return;
  // フレーム共有のrectが渡っていればlayout readは発生しない。渡っていない場合だけ数える
  if(!frameLayout?.rect)RHYTHM_PERF.layoutRead();
  const rect=frameLayout?.rect||area.getBoundingClientRect();
  if(!(rect.width>0&&rect.height>0))return;
  const noteHeight=Number(frameLayout?.noteHeight)||el.offsetHeight,lane=Number(visualLane),centerY=Number(yPx)+noteHeight/2,yRatio=rhythmClamp01(centerY/rect.height);
  const projected=rhythmNoteIsSlide(note)?rhythmProjectSlideSpan(lane,note,yRatio,slideTravel?.chartNowMs):rhythmNoteVisualSpan(note,lane,yRatio),projectedWidth=rect.width*projected.width,width=Math.min(projectedWidth,Math.max(4,projectedWidth*RHYTHM_NOTE_WIDTH_RATIO)),left=rect.width*projected.center-width/2;
  el.style.left=`${left.toFixed(2)}px`;
  el.style.width=`${width.toFixed(2)}px`;
  el.style.setProperty('--rhythm-note-depth-scale',(0.56+projected.scale*.44).toFixed(3));
  el.style.setProperty('--rhythm-note-depth-brightness',(0.72+projected.scale*.28).toFixed(3));
  const body=el._rhythmVisualBody||el.querySelector('[data-rhythm-hold-body],[data-rhythm-slide-body]');
  if(!body)return;
  el._rhythmVisualBody=body;
  if(body.hasAttribute('data-rhythm-slide-body')){
    body.style.left=`${(-left).toFixed(2)}px`;
    body.style.top=`${(-Number(yPx)).toFixed(2)}px`;
    body.style.width=`${rect.width.toFixed(2)}px`;
    body.style.setProperty('--rhythm-slide-area-height',`${rect.height.toFixed(2)}px`);
    body.setAttribute('viewBox',`0 0 ${rect.width} ${rect.height}`);
    const polygons=slideTravel?rhythmSlideSegmentPolygons(note,slideTravel.chartNowMs,slideTravel,rect,noteHeight/2):[];
    RHYTHM_PERF.slidePolygons(polygons.length);
    polygons.forEach((points,index)=>{
      let segment=body.childNodes[index];
      if(!segment){segment=document.createElementNS('http://www.w3.org/2000/svg','polygon');segment.dataset.rhythmSlideSegment='';body.appendChild(segment);}
      segment.style.display='';
      if(segment._rhythmPoints!==points){segment.setAttribute('points',points);segment._rhythmPoints=points;}
    });
    for(let index=polygons.length;index<body.childNodes.length;index++)body.childNodes[index].style.display='none';
  }else{
  const measuredBodyHeight=frameLayout&&Number.isFinite(Number(frameLayout.bodyHeight))?Number(frameLayout.bodyHeight):parseFloat(getComputedStyle(body).height),height=Math.max(0,measuredBodyHeight||0);
  // 帯の上端と下端だけを直線で結ぶと、projectionが曲線であるぶん途中の高さでレーンから外れる。
  // さらに帯が画面上端を越えて長い(=高速)場合、clipPathの0%は画面外のyを指すのに
  // 幅は画面内の0%位置で計算されてしまい、可視範囲の全体が外側へ膨らむ。
  // 帯の実際の上端(画面外でも可)から下端までを一定間隔でサンプルし、曲線へ沿わせる。
  const bodyTopY=centerY-height;
  const variableHold=rhythmNoteHasVariableSpan(note)&&note.type==='HOLD',bodyRatio=variableHold?RHYTHM_NOTE_WIDTH_RATIO:RHYTHM_BODY_WIDTH_RATIO;
  const edgeAt=ratio=>{
    const span=variableHold?rhythmNoteVisualSpan(note,lane,rhythmClamp01((bodyTopY+height*ratio)/rect.height)):rhythmProjectLane(lane,rhythmClamp01((bodyTopY+height*ratio)/rect.height)),half=span.width*bodyRatio/2;
    return {left:span.center-half,right:span.center+half};
  };
  // 画面上端はprojectionの曲がりが一番きついので、帯がそこを跨ぐときは必ず点を置く。
  const topEdgeRatio=height>0?(0-bodyTopY)/height:0;
  const bodyRatios=topEdgeRatio>1e-6&&topEdgeRatio<1-1e-6
    ?[...rhythmProjectionEdgeRatios(),topEdgeRatio].sort((a,b)=>a-b)
    :rhythmProjectionEdgeRatios();
  const bodyEdges=bodyRatios.map(edgeAt);
  const bodyRight=bodyEdges.map((edge,index)=>`${(edge.right*100).toFixed(3)}% ${(bodyRatios[index]*100).toFixed(3)}%`);
  const bodyLeft=bodyEdges.map((edge,index)=>`${(edge.left*100).toFixed(3)}% ${(bodyRatios[index]*100).toFixed(3)}%`).reverse();
  body.style.left=`${(-left).toFixed(2)}px`;
  body.style.width=`${rect.width.toFixed(2)}px`;
  body.style.clipPath=`polygon(${[...bodyRight,...bodyLeft].join(',')})`;
  }
  const endBar=el._rhythmEndBar||el.querySelector('[data-rhythm-end-bar]');
  if(endBar)el._rhythmEndBar=endBar;
  if(endBar&&Number.isFinite(releaseYpx)){
    const endY=rhythmClamp01((Number(releaseYpx)+noteHeight/2)/rect.height),end=rhythmNoteHasVariableSpan(note)&&note.type==='HOLD'?rhythmNoteVisualSpan(note,lane,endY):rhythmNoteIsSlide(note)?rhythmProjectSlideSpan(rhythmReleaseLane(note),note,endY,rhythmReleaseTargetMs(note)):rhythmProjectLane(rhythmReleaseLane(note),endY),barWidth=Math.max(10,rect.width*end.width*RHYTHM_NOTE_WIDTH_RATIO);
    endBar.style.left=`${(rect.width*end.center-left-barWidth/2).toFixed(2)}px`;
    endBar.style.top=`${(Number(releaseYpx)-Number(yPx)+noteHeight/2-4).toFixed(2)}px`;
    endBar.style.width=`${barWidth.toFixed(2)}px`;
    endBar.style.setProperty('--rhythm-end-depth-scale',(0.52+end.scale*.48).toFixed(3));
  }
};

// レーンのDOMが入れ替わった時だけ静的形状を設定する。ノーツはプレイ本体の1本のrAFから直接配置する。
const installRhythmPerspectiveNoteVisuals=()=>{
  if(typeof document==='undefined'||typeof MutationObserver==='undefined')return;
  if(document.documentElement.dataset.rhythmPerspectiveNotes==='ready')return;
  document.documentElement.dataset.rhythmPerspectiveNotes='ready';

  let area=null,laidOutWidth=0,laidOutHeight=0;
  const layoutFor=next=>{
    area=next;
    const rect=next?.getBoundingClientRect?.();
    laidOutWidth=rect?.width||0;laidOutHeight=rect?.height||0;
    rhythmLayoutPlayArea(next);
  };
  const scan=()=>{
    const next=document.querySelector('[data-rhythm-play-area]');
    if(next!==area)layoutFor(next);
  };
  // 端末を回した / 画面の大きさが変わったときは、要素が同じでも測り直す。
  // 以前は「プレイエリアの要素が入れ替わったときだけ」だったので、回転してもレーンの
  // 静的形状(レーン番号の位置・判定ラインの左右)が古い縦横比のまま残っていた。
  //
  // ノーツの配置は本体の1本のrAFが持つので、ここでrAFを増やさない。
  // 代わりに「大きさが実際に変わったときだけ」やり直す(回転中に resize が連続で
  // 飛んできても、同じ大きさなら何もしない)。
  // 触るのは見た目のstyleだけで、audio clock・run・スコア・コンボ・判定状態には関与しない。
  const relayout=()=>{
    const next=document.querySelector('[data-rhythm-play-area]');
    if(!next)return;
    const rect=next.getBoundingClientRect();
    if(!(rect.width>0&&rect.height>0))return;
    if(next===area&&rect.width===laidOutWidth&&rect.height===laidOutHeight)return;
    layoutFor(next);
  };
  const observe=()=>{
    scan();
    new MutationObserver(scan).observe(document.body,{childList:true,subtree:true});
    if(typeof window!=='undefined'&&typeof window.addEventListener==='function'){
      ['resize','orientationchange'].forEach(type=>window.addEventListener(type,relayout,{passive:true}));
      if(window.visualViewport&&typeof window.visualViewport.addEventListener==='function'){
        window.visualViewport.addEventListener('resize',relayout,{passive:true});
      }
    }
  };
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',observe,{once:true});
  else observe();
};
installRhythmPerspectiveNoteVisuals();

// DEBUG ONLY: 音ゲーデバッグ画面を開いた時だけ譜面制作ツールを読み込む。
const installRhythmAuthoringLoader=()=>{
  if(typeof document==='undefined'||typeof MutationObserver==='undefined')return;
  let loaded=false;
  const load=()=>{
    if(loaded||!document.querySelector('[data-rhythm-debug]'))return;
    loaded=true;
    const script=document.createElement('script');
    script.dataset.rhythmAuthoringLoader='';
    script.src='data/rhythm-authoring.js?v=20260831a';
    document.head.appendChild(script);
  };
  const start=()=>{load();if(!loaded)new MutationObserver(load).observe(document.body,{childList:true,subtree:true});};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});
  else start();
};
installRhythmAuthoringLoader();

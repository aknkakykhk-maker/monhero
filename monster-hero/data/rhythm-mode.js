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
// 判定の幅(ms)。ノーツの時刻からこれだけずれても、その判定になる。
//
// 【2026-09-05・実機で遊んだユーザーの指摘でゆるくした】
// 「やってみて思ったけどめちゃくちゃむずいからタップ判定をもう少しゆるくしたほうがいい」
// それまでは MARVELOUS が±25msで、指が触れてから画面が反応するまでの遅れ(端末差で
// 20〜40msある)だけで最上位判定を外す幅だった。よその音ゲーの最上位判定は±40〜50msが
// ふつうなので、そこへ寄せた。
//   MARVELOUS 25→40 / EXCELLENT 50→75 / GREAT 100→130 / GOOD 150→170
// BAD(200ms)だけは動かさない。入力とノーツを結びつける窓が±200msで、
// ここを広げると「まだ来ていないノーツ」まで拾ってしまうため。
// 判定窓。ノーツの時刻から前後どれだけずれてよいかをmsで持つ。
//
// 【2026-09-05・2回目の緩和「まだ全然むずい」】
//   MARVELOUS 40→55 / EXCELLENT 75→100 / GREAT 130→150 / GOOD 170→200 / BAD 200→240
// 1回目(0.025→0.04秒)で指の遅れぶんは吸収できたが、それでも難しいという報告が続いた。
// コンボが切れないのは GOOD までなので、**つながるかどうかを決めているのは GOOD の幅**。
// ここを170→200msへ広げたのが今回のいちばん大きい変更で、
// 「拍は取れているのに切れる」状態をほぼ無くすことを狙っている。
// ほかの音ゲーの最上位判定はおおむね±0.03〜0.05秒なので、MARVELOUS 0.055秒はやさしめ。
const RHYTHM_JUDGMENTS = Object.freeze([
  Object.freeze({ id:'MARVELOUS', windowMs:55, scoreRate:1 }),
  Object.freeze({ id:'EXCELLENT', windowMs:100, scoreRate:.98 }),
  Object.freeze({ id:'GREAT', windowMs:150, scoreRate:.9 }),
  Object.freeze({ id:'GOOD', windowMs:200, scoreRate:.7 }),
  Object.freeze({ id:'BAD', windowMs:240, scoreRate:.3 }),
  Object.freeze({ id:'MISS', windowMs:null, scoreRate:0 }),
]);
// 入力をどのノーツに当てるかを探す範囲。**判定窓のいちばん外側と必ず同じにする**。
// 以前はここに 200 という数字を直接書いていたため、判定窓を広げても
// 受け付ける範囲が広がらず、いちばん外側の判定(BAD)へ永遠に届かない状態になりかねなかった。
// 判定表から作れば、窓を変えるだけで両方そろう。
const RHYTHM_INPUT_MATCH_WINDOW_MS = RHYTHM_JUDGMENTS
  .reduce((widest,judgment)=>Number.isFinite(judgment.windowMs)?Math.max(widest,judgment.windowMs):widest,0);
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
  // notesScanned / notesDrawn は「毎フレーム何ノーツを見て、実際に何ノーツ描き替えたか」。
  // worst* は、いちばん長かったフレームの直前に数えたぶんを保存したもの。
  // 「長いフレームで何が増えていたのか」を切り分けるために持つ。
  const zero=()=>({frames:0,totalMs:0,maxMs:0,long:[0,0,0],layoutReads:0,domQueries:0,slidePolygons:0,gestureFrames:0,noteRescans:0,
    notesScanned:0,notesDrawn:0,pendingScanned:0,pendingDrawn:0,worstScanned:0,worstDrawn:0,
    tickMs:0,pendingTickMs:0,worstTickMs:0,maxTickMs:0,headSkipped:0,pendingHeadSkipped:0,narrowed:null,
    tickDelayMs:0,pendingDelayMs:0,worstDelayMs:0,maxDelayMs:0});
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
          acc.notesScanned+=acc.pendingScanned;acc.notesDrawn+=acc.pendingDrawn;
          acc.tickMs+=acc.pendingTickMs;acc.headSkipped+=acc.pendingHeadSkipped;acc.tickDelayMs+=acc.pendingDelayMs;
          if(acc.pendingTickMs>acc.maxTickMs)acc.maxTickMs=acc.pendingTickMs;
          if(acc.pendingDelayMs>acc.maxDelayMs)acc.maxDelayMs=acc.pendingDelayMs;
          if(dt>acc.maxMs){acc.maxMs=dt;acc.worstScanned=acc.pendingScanned;acc.worstDrawn=acc.pendingDrawn;acc.worstTickMs=acc.pendingTickMs;acc.worstDelayMs=acc.pendingDelayMs;}
          for(let i=0;i<RHYTHM_PERF_LONG_MS.length;i++)if(dt>RHYTHM_PERF_LONG_MS[i])acc.long[i]++;
        }
      }
      acc.pendingScanned=0;acc.pendingDrawn=0;acc.pendingTickMs=0;acc.pendingHeadSkipped=0;acc.pendingDelayMs=0;
      last=Number.isFinite(t)?t:null;
    },
    // tickのノーツ走査から呼ぶ。ONのときだけ足し込む(OFFなら即return)
    notes(scanned,drawn,headSkipped,narrowed){if(!on)return;acc.pendingScanned=Number(scanned)||0;acc.pendingDrawn=Number(drawn)||0;
      acc.pendingHeadSkipped=Number(headSkipped)||0;if(narrowed!==undefined)acc.narrowed=!!narrowed;},
    // 本体のrAFの中身そのものにかかった時間。
    // 注意: フレーム全体(avgMs)との差は「描画時間」ではない。rAFの間隔には
    // 次のリフレッシュを待つ時間(60Hzなら何もしなくても16.7ms)と、この
    // コールバックの外で走る処理が含まれる。差は「tickの外で起きている時間」
    // としか言えないので、そこから先は別に測る。rAFは増やさない。
    // ms: tick本体にかかった時間。delayMs: そのフレームが始まってから(rAFのタイムスタンプ)
    // 実際にこのコールバックが動き出すまでの遅れ。遅れが大きいフレームは、
    // 「tickへ入る前に」メインスレッドが他の仕事(判定時のReact描画・GC・他のコールバック)で
    // 塞がっていたことを意味する。tickの中が0msでもJSが無実とは限らないので、ここを見る。
    tick(ms,delayMs){if(!on)return;const v=Number(ms);if(Number.isFinite(v)&&v>=0)acc.pendingTickMs=v;
      const d=Number(delayMs);if(Number.isFinite(d)&&d>=0)acc.pendingDelayMs=d;},
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
        notesScannedPerFrame:per(acc.notesScanned),
        notesDrawnPerFrame:per(acc.notesDrawn),
        worstFrameScanned:acc.worstScanned,
        worstFrameDrawn:acc.worstDrawn,
        tickMsPerFrame:per(acc.tickMs),
        worstFrameTickMs:acc.worstTickMs,
        maxTickMs:acc.maxTickMs,
        tickDelayMsPerFrame:per(acc.tickDelayMs),
        worstFrameDelayMs:acc.worstDelayMs,
        maxDelayMs:acc.maxDelayMs,
        headSkippedPerFrame:per(acc.headSkipped),
        narrowed:acc.narrowed,
      };
    },
  };
  api.restore();
  return api;
})();

const RHYTHM_PROJECTION_TOP_SCALE=.18;
const RHYTHM_NOTE_WIDTH_RATIO=.78;
const RHYTHM_BODY_WIDTH_RATIO=.64;
// 入力側の余白(サブレーン)。見えている帯のふちギリギリを押したときに
// 「外れた」ことにしないためのもの。指の当たりは点ではなく面なので、
// 見た目どおりの範囲だけで受けると、狙って押しても外れることがある。
//
// 【2026-09-05・「めちゃくちゃむずい」という指摘でどちらも広げた】
// 幅1のノーツ .18→.45 / それ以外 0→.35(これまでは余白そのものが無かった)。
// どちらも「隣のノーツの中心」までは届かない大きさに留めてある
// (幅1が隣り合うとき、隣の中心はサブレーン1.5ぶん先にある)。
//
// 【2026-09-05・2回目の緩和「まだ全然むずい」】
// 幅2以上は .35→.60 へ広げた。幅1は .45 のままにする。
// 理由: 帯のふちから「隣のノーツの中心」までの距離は、隣の幅の半分ぶんある。
// 幅1どうしが隣り合うと 0.5 しかないので .45 が構造上の上限。
// 幅2以上なら 1.0 以上あるので .60 でも隣の中心には届かない。
// なお候補が複数あるときは**入力位置にいちばん近い中心**のノーツを選ぶので、
// 広げたことで「狙った側とは違うノーツが取れる」ことは起きない。
const RHYTHM_NARROW_TAP_TOLERANCE_SUB_LANES=.45;
const RHYTHM_TAP_TOLERANCE_SUB_LANES=.60;
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
// ノーツの幅(サブレーン数)の上限。以前は4(=2レーンぶん)で頭打ちにしていたが、実機で
// 「上限を無くして全幅もありにして」と言われたので、全幅(=5レーンぶん)まで出せるようにした。
// (RHYTHM_SUB_LANE_COUNT と同じ数。検査がこのブロックだけを切り出して動かすので、
//  ここでは RHYTHM_LANE_COUNT から作る)
const RHYTHM_MAX_SUB_LANE_WIDTH=RHYTHM_LANE_COUNT*2;
// 幅が途中で変わるHOLDは端数(小数)の帯を作るので、整数へ丸めない版も要る。
const rhythmProjectSubLaneRange=(subLane,width,yRatio)=>{
  const span=Math.max(1,Math.min(RHYTHM_MAX_SUB_LANE_WIDTH,Number(width)||2));
  const start=Math.max(0,Math.min(RHYTHM_MAX_SUB_LANE_WIDTH-span,Number(subLane)||0));
  const left=rhythmProjectBoundary(start/2,yRatio),right=rhythmProjectBoundary((start+span)/2,yRatio);
  return {left,right,center:(left+right)/2,width:right-left,scale:rhythmProjectionScale(yRatio),subLane:start,subLaneWidth:span};
};
const rhythmProjectSubLaneSpan=(subLane,width,yRatio)=>rhythmProjectSubLaneRange(Math.trunc(Number(subLane))||0,Math.trunc(Number(width))||2,yRatio);
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
  return Number.isInteger(width)&&width>=1&&width<=RHYTHM_MAX_SUB_LANE_WIDTH?width:null;
};
const rhythmSlideWidth=note=>rhythmSlideAuthoredWidth(note?.subLaneWidth)??2;
const rhythmSlidePointWidth=(note,point)=>rhythmSlideAuthoredWidth(point?.subLaneWidth)??rhythmSlideWidth(note);
// 太いSLIDEが端のレーンを通ると、中心線のまわりへ幅を広げただけでは**レーンの外へはみ出す**。
// TAP/HOLD(rhythmProjectSubLaneRange)は左端を収まる位置へ寄せているのに、SLIDEだけ寄せていなかった。
// 実機で「スライド、ホールドノーツがレーンからはみ出て表示される場面がある」と報告があった(2026-09-05)。
//
// 幅は変えずに**中心線を内側へ寄せて**収める。見た目・入力の受け付け・途中追従の的が
// すべてこの関数を通るので、寄せたぶんは3つとも同じだけ動き、ずれない。
// 幅2(既存の正式候補v1が使う唯一の幅)では、レーン0〜4がそのまま収まるので**何も動かない**。
const rhythmSlideFittedLane=(lane,width)=>{
  const half=(Number(width)||2)/4,center=(Number(lane)||0)+.5;
  const lowest=Math.min(RHYTHM_LANE_COUNT/2,half),highest=Math.max(RHYTHM_LANE_COUNT/2,RHYTHM_LANE_COUNT-half);
  return Math.max(lowest,Math.min(highest,center))-.5;
};
const rhythmProjectSlideSpan=(lane,note,yRatio,chartTimeMs=note?.timeMs)=>{
  const width=rhythmSlideWidthAt(note,chartTimeMs),half=width/4;
  const centerBoundary=rhythmSlideFittedLane(lane,width)+.5;
  const left=rhythmProjectBoundary(centerBoundary-half,yRatio),right=rhythmProjectBoundary(centerBoundary+half,yRatio);
  return {left,right,center:(left+right)/2,width:right-left,scale:rhythmProjectionScale(yRatio),subLaneWidth:width};
};
const rhythmSlideInputSpan=note=>{
  if(!rhythmNoteIsSlide(note))return null;
  const lane=rhythmSlideAuthoredLane(note?.lane);
  if(lane===null)return null;
  // 見た目と同じだけ内側へ寄せる(寄せた帯を押したら取れる、が成り立つようにする)
  const width=rhythmSlideWidthAt(note,note?.timeMs),center=(rhythmSlideFittedLane(lane,width)+.5)*2;
  return {start:center-width/2,end:center+width/2,center,width};
};
// --- HOLDの途中で幅が変わる ---
// holdPoints:[{timeMs, subLane, subLaneWidth}, ...] を時刻順に書くと、点と点の間を
// 直線でつないだ帯になる（書かなかった項目は始点の値を使う）。押さえたまま帯が広がったり
// 細くなったりする、プロセカのロングノーツと同じ考え方。
// 中心を動かすのはSLIDEの役目なので、HOLDは基本「その場で太さだけが変わる」。
// 始点・終点の判定と入力の受け付け幅は**始点の帯のまま**で、変わるのは
// 見た目と「押さえ続けている最中に外れたと見なす幅」だけ。
const rhythmHoldPointWidth=(note,point)=>{
  const width=Number(point?.subLaneWidth);
  const fallback=Math.max(1,Math.min(RHYTHM_MAX_SUB_LANE_WIDTH,Number(note?.subLaneWidth)||2));
  return Number.isFinite(width)&&width>=1?Math.min(RHYTHM_MAX_SUB_LANE_WIDTH,width):fallback;
};
const rhythmHoldPointSubLane=(note,point)=>{
  const value=Number(point?.subLane);
  return Number.isFinite(value)?value:Number(note?.subLane)||0;
};
const rhythmNoteHasHoldPoints=note=>note?.type==='HOLD'&&Array.isArray(note?.holdPoints)&&note.holdPoints.length>=2;
// 幅の上限を全幅(10)まで広げたので、「広いノーツ」は形でも区別できるようにする。
// プロセカ・チュウニズムの幅広ノーツと同じ考え方で、丸い粒ではなく端の分かる「棒」に見せる。
// 5サブレーン(=2.5レーン)以上を広いノーツとする。
const RHYTHM_WIDE_NOTE_SUB_LANES=5;
const rhythmNoteIsWide=note=>{
  const type=note?._rhythmOriginalType||note?.type;
  if(type==='SLIDE')return rhythmSlideWidth(note)>=RHYTHM_WIDE_NOTE_SUB_LANES;
  const width=Number(note?.subLaneWidth);
  return Number.isFinite(width)&&width>=RHYTHM_WIDE_NOTE_SUB_LANES;
};
const rhythmHoldSpanAt=(note,chartTimeMs)=>{
  const at=point=>({subLane:rhythmHoldPointSubLane(note,point),subLaneWidth:rhythmHoldPointWidth(note,point)});
  if(!rhythmNoteHasHoldPoints(note))return at(null);
  const points=note.holdPoints,t=Number(chartTimeMs);
  if(!Number.isFinite(t)||t<=Number(points[0]?.timeMs))return at(points[0]);
  for(let i=1;i<points.length;i++){
    const a=points[i-1],b=points[i];
    if(t<=Number(b.timeMs)){
      const span=Math.max(1,Number(b.timeMs)-Number(a.timeMs)),p=Math.max(0,Math.min(1,(t-Number(a.timeMs))/span));
      const from=at(a),to=at(b);
      return {subLane:from.subLane+(to.subLane-from.subLane)*p,subLaneWidth:from.subLaneWidth+(to.subLaneWidth-from.subLaneWidth)*p};
    }
  }
  return at(points[points.length-1]);
};
const rhythmNoteVisualSpan=(note,visualLane,yRatio,chartTimeMs)=>{
  if(rhythmNoteHasVariableSpan(note)){
    if(rhythmNoteHasHoldPoints(note)){
      const span=rhythmHoldSpanAt(note,chartTimeMs);
      return rhythmProjectSubLaneRange(span.subLane,span.subLaneWidth,yRatio);
    }
    return rhythmProjectSubLaneSpan(note.subLane,note.subLaneWidth,yRatio);
  }
  if(rhythmNoteIsSlide(note))return rhythmProjectSlideSpan(Number(visualLane),note,yRatio);
  return rhythmProjectSubLaneSpan(Number(visualLane)*2,2,yRatio);
};
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
// 終点フリック(HOLD / SLIDE の終わりでフリックして離す)。
// ・受付開始: 終端のこの時間前から。受付に入った瞬間の指の位置を基準にし、
//   そこから RHYTHM_FLICK_DISTANCE_PX(単発FLICKと同じ距離・方向指定なし)動けば成立する。
// ・受付中は追従の外れ判定を止める。フリックすれば的から外れるのは当たり前のため。
// 判定の基準そのもの(判定窓 RHYTHM_RELEASE_MAX_MS / rhythmJudgeRelease)は既存のまま使う。
// 成立すれば指を離すのを待たずその場で終端判定を出す(単発FLICKと同じ考え方)。
const RHYTHM_END_FLICK_ARM_MS = 250;
// 終点フリックを要求するノーツか。endFlick を書いていない既存譜面は必ず false になり、
// 「終端で離すだけ」という従来の挙動が一切変わらないようにしている。
const rhythmNoteWantsEndFlick=note=>{
  if(note?.endFlick!==true)return false;
  const type=note?._rhythmOriginalType||note?.type;
  return type==='HOLD'||type==='SLIDE';
};
const RHYTHM_SLIDE_TOLERANCE_LANES = .82;
// HOLD・SLIDEの終わり(離す・終点フリック)の判定も、単発のタップと同じ表を使う。
// 数字を別に持つと、タップだけ緩めて終端が置き去りになる。判定表のいちばん外側から作る。
const RHYTHM_RELEASE_MAX_MS = RHYTHM_INPUT_MATCH_WINDOW_MS;
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
// 追従の的も、見た目と同じだけ内側へ寄せる(rhythmSlideFittedLane)。
// 帯だけ寄せて的が元の場所に残ると、見えている帯をなぞっているのに外れた扱いになる。
const rhythmSlideExpectedLane=(note,chartTimeMs)=>{
  const points=rhythmSlidePoints(note);
  const t=Number(chartTimeMs);
  const fit=(lane,timeMs)=>rhythmSlideFittedLane(Number(lane)||0,rhythmSlideWidthAt(note,timeMs));
  if(!Number.isFinite(t))return fit(points[0]?.lane,points[0]?.timeMs);
  if(t<=points[0].timeMs)return fit(points[0]?.lane,points[0]?.timeMs);
  for(let i=1;i<points.length;i++){
    const a=points[i-1],b=points[i];
    if(t<=b.timeMs){
      const span=Math.max(1,Number(b.timeMs)-Number(a.timeMs));
      const p=Math.max(0,Math.min(1,(t-Number(a.timeMs))/span));
      return fit(Number(a.lane)+(Number(b.lane)-Number(a.lane))*p,t);
    }
  }
  const last=points[points.length-1];
  return fit(last?.lane,last?.timeMs);
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
  // HOLD / SLIDE を最後まで取れたとき、FLICK が成立したときに鳴らす。
  // 開始のタップ音と同じ音だと「指を置いた音」と区別が付かず、取れたのか分からない
  // (実機で「フリックが成功したのか分かりづらい」という報告があった)。
  // 少し高いところから上へ抜ける短い音にして、「取れた」ことが耳で分かるようにする。
  // 音量・ON/OFF・全体ミュートはタップ音と同じ設定を読む(専用の保存キーは増やさない)。
  const playClear=()=>{
    const settings=readSettings();
    if(!settings.enabled||settings.volume<=0||!rhythmAudioGloballyEnabled())return false;
    const audio=context();
    if(!audio)return false;
    if(audio.state==='suspended'&&typeof audio.resume==='function')audio.resume().catch(()=>{});
    const now=audio.currentTime,level=Math.max(.0001,.028*(settings.volume/100)),duration=.13;
    const oscillator=audio.createOscillator(),gain=audio.createGain();
    oscillator.type='triangle';
    oscillator.frequency.setValueAtTime(1318.51,now);                    // E6
    oscillator.frequency.exponentialRampToValueAtTime(1975.53,now+.055); // B6 へ上げて抜ける
    gain.gain.setValueAtTime(.0001,now);
    gain.gain.exponentialRampToValueAtTime(level,now+.008);
    gain.gain.exponentialRampToValueAtTime(.0001,now+duration);
    oscillator.connect(gain);gain.connect(audio.destination);
    oscillator.start(now);oscillator.stop(now+duration+.02);
    oscillator.onended=()=>{try{oscillator.disconnect();gain.disconnect();}catch{}};
    return true;
  };
  // モンスターノーツを取ったときの音。実機で「モンスターノーツ踏んだときは音も演出も地味すぎる」と
  // 言われたので(2026-09-05)、ふつうのノーツとは**はっきり違う音**にする。
  // 1曲に最大4回しか鳴らないので、ふつうのタップ音より長く・厚くしてよい。
  //   ・上へ駆け上がる3音(C6→E6→G6)を短い間隔で重ねる
  //   ・その下へ、丸い低音(C4)を1つ置いて厚みを出す
  // 既存のタップ音と同じ設定(音量・ON/OFF・全体ミュート)を読み、専用の保存キーは増やさない。
  const playMonster=()=>{
    const settings=readSettings();
    if(!settings.enabled||settings.volume<=0||!rhythmAudioGloballyEnabled())return false;
    const audio=context();
    if(!audio)return false;
    if(audio.state==='suspended'&&typeof audio.resume==='function')audio.resume().catch(()=>{});
    const now=audio.currentTime,volume=settings.volume/100;
    const tone=(type,freq,start,sustain,peak)=>{
      const oscillator=audio.createOscillator(),gain=audio.createGain();
      oscillator.type=type;
      oscillator.frequency.setValueAtTime(freq,start);
      gain.gain.setValueAtTime(.0001,start);
      gain.gain.exponentialRampToValueAtTime(Math.max(.0001,peak*volume),start+.008);
      gain.gain.exponentialRampToValueAtTime(.0001,start+sustain);
      oscillator.connect(gain);gain.connect(audio.destination);
      oscillator.start(start);oscillator.stop(start+sustain+.02);
      oscillator.onended=()=>{try{oscillator.disconnect();gain.disconnect();}catch{}};
    };
    // C6 → E6 → G6 を35msずつずらして駆け上がる
    [1046.50,1318.51,1567.98].forEach((freq,index,list)=>
      tone('triangle',freq,now+index*.035,index===list.length-1?.34:.16,.042));
    // 厚みを出す低音(C4)。上の3音より小さくして、音量が跳ねないようにする
    tone('sine',261.63,now,.30,.030);
    return true;
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
  return {warm,play,playClear,playMonster,preview:settings=>play(settings),playEmpty,beginInputGroup,markInputGroupHandled,endInputGroup,playFullCombo,_readSettings:readSettings};
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
const rhythmHoldTrackedLane=(note,chartTimeMs)=>{
  if(note?.subLane!=null&&Number.isFinite(Number(note.subLane))){
    // 幅が途中で変わるHOLD(holdPoints)は、その時刻の帯を的にする。
    // 細くなる帯を押さえ続けているとき、始点の広い幅のままだと外れても気付けない。
    const span=rhythmHoldSpanAt(note,chartTimeMs);
    const width=span.subLaneWidth,subLane=Math.max(0,Math.min(RHYTHM_MAX_SUB_LANE_WIDTH-width,span.subLane));
    return {center:subLane/2+width/4-.5,half:width/4};
  }
  return {center:Number(note?.lane)||0,half:.5};
};
// ── HOLD / SLIDE の指の持ち替え ──────────────────────────────────────────────
// 【2026-09-05・ユーザー指摘「指置き換えも機能してない。してるとしたら時間が短すぎる？」】
//
// 猶予の長さの問題ではなかった。持ち替えは**2か所で塞がれていて**、一度も成立していなかった。
//
//   ① 入力とノーツの突き合わせ(rhythmMatchInputBatch)は、
//      「いまの時刻の前後 RHYTHM_INPUT_MATCH_WINDOW_MS(240ms)以内に**始まる**ノーツ」しか
//      候補にしない。3秒のHOLDを2秒押さえてから持ち替えると、そのノーツの開始時刻は
//      とっくに240msの外なので、置き直した指はどこにも当たらない。
//   ② 指を離した瞬間に RHYTHM_GESTURE_RUNTIME.release() が終端判定を作り、
//      note.endTimeMs を「いまより前」へ書き換えていた。そのため game-system.jsx 側の
//      inputEnds は必ず「終わり際まで来ている」分岐に入り、猶予を見る分岐へ行かなかった。
//
// いまは、終わりよりずっと手前で離したときは判定を確定させず「浮いている」ことにして、
// 浮いているノーツは開始時刻に関係なく必ず候補へ入れる。
//
// 猶予はここに置く。data/*.js は game-system.jsx より先に読み込まれるので、
// 両方から見える場所へ定数を1つだけ持つ(2か所に書くと必ず片方が古くなる)。
// 実機で「120msでは足りない」と分かったので200msにした。指を持ち替える動作
// (離す→置き直す)は実測で100〜200msかかる。長くしすぎると「一瞬離しても平気」に
// なってしまうので、持ち替えに要るぶんの上限で止める。
const RHYTHM_HOLD_HANDOVER_GRACE_MS=200;
// 終わり際に離すぶんの猶予。持ち替えとは別物なので混ぜない
// (混ぜると「終わりに離す」と「途中で持ち替える」が同じ扱いになる)。
const RHYTHM_HOLD_RELEASE_GRACE_MS=100;
// 浮いているノーツ(持ち替え待ち)の控え。指の数までしか増えないので、そのまま総当たりでよい。
// 突き合わせ側は「開始時刻の窓」を無視してここを見る。
const RHYTHM_FLOATING_NOTES=new Set();
const rhythmFloatingNoteAdd=note=>{if(note)RHYTHM_FLOATING_NOTES.add(note);};
const rhythmFloatingNoteRemove=note=>{if(note)RHYTHM_FLOATING_NOTES.delete(note);};
const rhythmFloatingNotesClear=()=>{RHYTHM_FLOATING_NOTES.clear();};
// 浮いているノーツの「いまの帯」。持ち替えは押さえ直しなので、始点の帯ではなく
// その時刻に見えている帯へ指を置けたかどうかで見る(帯が動く・太さが変わるため)。
const rhythmHandoverSpanAt=(note,chartTimeMs)=>{
  if(rhythmNoteIsSlide(note)){
    const width=rhythmSlideWidthAt(note,chartTimeMs);
    const center=(rhythmSlideFittedLane(rhythmSlideExpectedLane(note,chartTimeMs),width)+.5)*2;
    return {start:center-width/2,end:center+width/2,width};
  }
  const span=rhythmHoldSpanAt(note,chartTimeMs);
  return {start:span.subLane,end:span.subLane+span.subLaneWidth,width:span.subLaneWidth};
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
  // knownArea を渡せると querySelector を省ける(呼び出し側が既に要素を持っている場合)。
  // ゲーム本体のTAP入力もここを通すので、1フレームのあいだに何本指で触っても
  // getBoundingClientRect()(=強制レイアウト)は最大1回で済む。
  const areaRect=(knownArea)=>{
    if(typeof document==='undefined')return null;
    if(cachedRect)return cachedRect;
    let area=knownArea||null;
    if(!area){
      RHYTHM_PERF.domQuery();
      area=document.querySelector('[data-rhythm-play-area]');
    }
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
  // 終点フリックの受付を開始する。終端の RHYTHM_END_FLICK_ARM_MS 前に入ったら、
  // 「その瞬間の指の位置」を基準として覚え、以後の移動量をフリックとして測る。
  // 指が動かないまま受付へ入る場合もあるので、tick からも呼んで必ず基準を作る。
  const armEndFlick=(session,pos)=>{
    if(!session||!session.endFlickRequired||session.endFlickArmed||session.note.done)return;
    if((session.releaseTargetMs+session.offsetMs)-estimatedSongMs(session)>RHYTHM_END_FLICK_ARM_MS)return;
    const at=pos||positions.get(session.key);
    session.endFlickArmed=true;
    session.endFlickAnchorX=at?at.clientX:session.startX;
    session.endFlickAnchorY=at?at.clientY:session.startY;
    // 受付に入る前の「外れっぱなし」の計測は捨てる。ここから先の移動はフリックの動作なので、
    // 追従が外れたことを理由にMISSにしてはいけない。
    session.trackingBadSincePerf=null;
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
    if(session.endFlickRequired){
      armEndFlick(session,pos);
      if(session.endFlickArmed){
        if(!session.endFlickDone){
          const dx=pos.clientX-session.endFlickAnchorX,dy=pos.clientY-session.endFlickAnchorY;
          if(Math.hypot(dx,dy)>=RHYTHM_FLICK_DISTANCE_PX){
            session.endFlickDone=true;
            // 指を離すのを待たず、その場で終端判定を確定する。
            // release() が既存の判定合成(開始判定と終端判定の悪いほう)をそのまま行う。
            release(session.key,false);
          }
        }
        // 受付中は追従の外れを見ない(フリックで的から外れるのは当たり前のため)。
        return;
      }
    }
    const actual=laneCoordinate(pos.clientX,pos.clientY);
    const chartNow=estimatedSongMs(session)-session.offsetMs;
    let bad;
    if(actual===null){
      bad=true;
    }else if(session.kind==='SLIDE'){
      bad=Math.abs(actual-rhythmSlideExpectedLane(session.note,chartNow))>rhythmSlideTrackingTolerance(session.note,chartNow);
    }else{
      const tracked=rhythmHoldTrackedLane(session.note,chartNow);
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
      if((session.kind==='SLIDE'||session.kind==='HOLD')&&!session.finished){
        const pos=positions.get(key);
        // 指が1本も動いていない(pointermoveが来ない)ままでも受付へ入れるよう、ここでも基準を作る。
        armEndFlick(session,pos);
        evaluatePosition(session,pos);
      }
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
      // 終わりよりずっと手前で離したときは、指を持ち替えている途中かもしれない。
      // ここで終端判定を作って note.endTimeMs を書き換えてしまうと、
      // game-system.jsx の inputEnds が必ず「終わり際まで来ている」分岐へ入り、
      // 猶予を見る分岐(=持ち替え)へ一度も行かなくなる。
      // 判定は確定させず、浮いていることだけを記録して抜ける。
      // 途中で外れて失敗が確定しているとき(failed)と、指が取り消されたとき(cancelled)は、
      // 持ち替えではないのでこれまでどおり確定させる。
      if(!cancelled&&!session.failed&&releaseDelta<-RHYTHM_HOLD_RELEASE_GRACE_MS){
        session.note.releasedAtMs=songNow-session.offsetMs;
        rhythmFloatingNoteAdd(session.note);
        sessions.delete(id);
        return;
      }
      // 終点フリックのノーツは、フリックしないまま離してもMISS。判定窓そのものは変えない。
      const endJudgment=cancelled?'MISS'
        :session.endFlickRequired&&!session.endFlickDone?'MISS'
        :rhythmJudgeRelease(releaseDelta);
      const startJudgment=session.startJudgment||session.note.holdJudgment||'MISS';
      const finalJudgment=session.failed?'MISS':rhythmWorseJudgment(startJudgment,endJudgment);
      const startRank=RHYTHM_RELEASE_JUDGMENT_IDS.indexOf(startJudgment),endRank=RHYTHM_RELEASE_JUDGMENT_IDS.indexOf(endJudgment);
      session.note.holdJudgment=finalJudgment;
      session.note.holdDeltaMs=session.failed||endRank>=startRank?releaseDelta:(session.startDeltaMs||0);
      session.note._rhythmReleaseJudgment=endJudgment;
      session.note._rhythmReleaseDeltaMs=releaseDelta;
      session.note._rhythmReleaseDone=true;
      if(session.endFlickRequired)session.note._rhythmEndFlickDone=session.endFlickDone===true;
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
    const endFlickRequired=releaseRequired&&rhythmNoteWantsEndFlick(note);
    if(endFlickRequired)note._rhythmEndFlickRequired=true;
    const releaseTargetMs=releaseRequired?(Number(note.endTimeMs)||Number(note.timeMs)||0):null;
    if(releaseRequired){
      note._rhythmReleaseTargetMs=releaseTargetMs;
      note._rhythmReleaseOriginalEndTimeMs=releaseTargetMs;
      note._rhythmReleaseRequired=true;
      // 普段の見た目は元のendTimeMsを保ち、終端100ms前からだけ自動完了を延期する。
      // release() が終端判定を作り、押しっぱなしなら+200ms超でMISSになる。
    }else if(kind==='FLICK')note.endTimeMs=(Number(note.timeMs)||0)+60000;
    const perf=nowPerf();
    sessions.set(key,{key,note,kind,startSongMs:Number(startSongMs)||0,offsetMs:Number(offsetMs)||0,startPerfMs:perf,lastPerfMs:perf,startX:pos.clientX,startY:pos.clientY,finished:false,failed:false,releaseRequired,releaseTargetMs,startJudgment:null,startDeltaMs:0,expiredGuard:false,autoCompletionDeferred:false,trackingBadSincePerf:null,endFlickRequired,endFlickArmed:false,endFlickAnchorX:pos.clientX,endFlickAnchorY:pos.clientY,endFlickDone:false});
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

  return {bind,record,release,clear,slideVisualLaneForIndex,invalidateAreaRect,areaRect,_sessions:sessions};
})();

// iPhoneのTouch.radiusXを既存projectionへ通し、実際の接触幅に応じたサブレーン領域として扱う。
// radiusXは端を拾いすぎないよう70%へ縮小し、隣接サブレーンは20%以上重なった時だけ接触扱いにする。
// 明らかな異常値だけ中心1サブレーンへfallbackする。ゲーム本体の中心1点入力はそのまま残し、
// 中心以外の新規接触サブレーンだけTAP専用の疑似Pointerで補う。
const RHYTHM_TOUCH_RADIUS_SCALE=.70;
const RHYTHM_TOUCH_MIN_SUBLANE_COVERAGE=.20;
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

// 入力候補は判定時刻±RHYTHM_INPUT_MATCH_WINDOW_ms(=いちばん外側の判定窓)だけ見ればよい。以前は1入力ごとに全ノーツを
// map→filter→sortして一時配列を作っていたため、長い譜面ほどタップ直前/直後に
// メインスレッドの仕事とGCを増やしていた。譜面が時刻昇順なら二分探索で候補窓だけへ
// 絞り、並び順が崩れている譜面だけ従来どおり全範囲へフォールバックする。
// 候補の優先順(時刻差→入力位置への近さ→元index)は変えない。
const RHYTHM_INPUT_MATCH_META=new WeakMap();
const rhythmInputMatchBounds=(source,now,offset)=>{
  let meta=RHYTHM_INPUT_MATCH_META.get(source);
  if(!meta){
    let ascending=true;
    for(let i=1;i<source.length;i++){
      const prev=Number(source[i-1]?.timeMs),cur=Number(source[i]?.timeMs);
      if(!Number.isFinite(prev)||!Number.isFinite(cur)||cur<prev){ascending=false;break;}
    }
    meta={ascending};RHYTHM_INPUT_MATCH_META.set(source,meta);
  }
  if(!meta.ascending)return [0,source.length];
  const center=Number(now)-Number(offset),min=center-RHYTHM_INPUT_MATCH_WINDOW_MS,max=center+RHYTHM_INPUT_MATCH_WINDOW_MS;
  let lo=0,hi=source.length;
  while(lo<hi){const mid=(lo+hi)>>1;if(Number(source[mid]?.timeMs)<min)lo=mid+1;else hi=mid;}
  const start=lo;hi=source.length;
  while(lo<hi){const mid=(lo+hi)>>1;if(Number(source[mid]?.timeMs)<=max)lo=mid+1;else hi=mid;}
  return [start,lo];
};
const rhythmMatchInputBatch=(notes,inputs,nowMs,offsetMs=0)=>{
  const source=Array.isArray(notes)?notes:[],claimed=new Set(),seenInputs=new Set(),now=Number(nowMs),offset=Number(offsetMs)||0;
  const [matchStart,matchEnd]=rhythmInputMatchBounds(source,now,offset);
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
      const tolerance=span.width===1?RHYTHM_NARROW_TAP_TOLERANCE_SUB_LANES:RHYTHM_TAP_TOLERANCE_SUB_LANES;
      return subCoordinate>=span.start-tolerance&&subCoordinate<=span.end+tolerance;
    };
    const spatialDistance=note=>{
      if(!Number.isFinite(subCoordinate))return 0;
      const span=inputSpan(note);
      return span?Math.abs(subCoordinate-span.center):0;
    };
    // どのノーツを叩いたことにするかの決め方。
    //
    // 【なぜ「近い順」だけではいけないか】
    // 以前は時間の差を**絶対値**で比べ、いちばん近いものを選んでいた。これだと、
    // 次のノーツとの間隔の半分を超えて遅れた瞬間、次のノーツのほうが「近い」ことに
    // なって判定がそちらへ移る。BPM170の8分(176ms間隔)なら89ms、16分(88ms)なら45ms
    // 遅れただけで、狙ったノーツではなく次のノーツを取ってしまっていた
    // (2026-09-05・ユーザー指摘「近くに次のノーツがあるときに判定がそっちにいってる」)。
    // しかも取られた次のノーツは本来の時刻には既に消えているので、1回の遅れで2つ崩れる。
    //
    // 【どう直したか】
    // **まだ叩いていない、時刻を過ぎたノーツ**（＝遅れて叩いているぶん）を先に見る。
    // ノーツは前から順に来るので、前を飛ばして次を取ると必ず破綻するため。
    // 遅れ側に候補が無いときだけ、これから来るノーツ（早く押した場合）を見る。
    // どちらの側でも、そのなかでは時間がいちばん近いもの、同じなら押した位置に
    // いちばん近いものを選ぶ。
    //
    // これで「1つめを叩き損ねて2つめのタイミングで叩いた」ときも、
    // 2つめ(差0ms)のほうが1つめ(差176ms)より近いので2つめが取れる＝ずれ込まない。
    let picked=null,pickedIndex=-1,pickedRank=Infinity,pickedNoteTime=Infinity,pickedSpatialDistance=Infinity;
    for(let index=matchStart;index<matchEnd;index++){
      const note=source[index];
      if(claimed.has(index)||!note||note.done||note.activePointerId!==null||!RHYTHM_NOTE_TYPES.includes(note.type)||tapOnly&&note.type!=='TAP')continue;
      const noteTime=Number(note.timeMs)+offset;
      const timeDistance=Math.abs(now-noteTime);
      if(!(timeDistance<=RHYTHM_INPUT_MATCH_WINDOW_MS)||!acceptsPosition(note))continue;
      const distance=spatialDistance(note);
      const rank=now>=noteTime?0:1;   // 0=時刻を過ぎている(遅れ) / 1=まだ来ていない(早い)
      // 同じ組の中では、時刻が早いノーツから順に取る。
      // 過ぎているノーツが2つ以上あるとき「時間の差が近いほう」で選ぶと、
      // 前のノーツを飛ばして後ろを取ってしまい、前は必ずMISSになる
      // (16分で1個分ちょうど遅れて叩くと、まさにこれが起きていた)。
      // ノーツは前から順に来るので、遅れて叩いたぶんは「まだ残っている中でいちばん前」へ渡す。
      if(!picked
        ||rank<pickedRank
        ||(rank===pickedRank&&(noteTime<pickedNoteTime
          ||(noteTime===pickedNoteTime&&distance<pickedSpatialDistance)))){
        picked=note;pickedIndex=index;pickedRank=rank;pickedNoteTime=noteTime;pickedSpatialDistance=distance;
      }
    }
    // 持ち替え待ちで浮いているノーツは、開始時刻がどれだけ前でも候補へ入れる。
    // ふつうの候補より**先に**取る。押さえ直しをほかのノーツへ吸われると、
    // 持ち替えが失敗して必ずMISSになるため。
    // 見るのは「いまの帯へ指が乗ったか」だけで、時間の近さは見ない(押さえ直しなので)。
    if(RHYTHM_FLOATING_NOTES.size){
      for(const note of RHYTHM_FLOATING_NOTES){
        // 判定が確定した・拾われたノーツの控えが残っていることがあるので、ここで捨てる
        if(!note||note.done||note.releasedAtMs==null){RHYTHM_FLOATING_NOTES.delete(note);continue;}
        const index=Number(note.index);
        if(note.activePointerId!==null||claimed.has(index))continue;
        if(tapOnly)continue;   // 指の代わりに作った仮の入力では持ち替えを扱わない
        const span=rhythmHandoverSpanAt(note,now-offset);
        const tolerance=span.width<=1?RHYTHM_NARROW_TAP_TOLERANCE_SUB_LANES:RHYTHM_TAP_TOLERANCE_SUB_LANES;
        const onBand=Number.isFinite(subCoordinate)
          ?(subCoordinate>=span.start-tolerance&&subCoordinate<=span.end+tolerance)
          :note.lane===lane;
        if(!onBand)continue;
        picked=note;pickedIndex=index;
        break;
      }
    }
    if(!picked)return {input,target:null,deltaMs:null};
    claimed.add(pickedIndex);
    // 浮いていたSLIDEを引き継ぐときは、bind へ「元の種類」を渡す。
    // bind が note.type を 'HOLD' へ書き換えているので、picked.type だけを見ると
    // 持ち替えた瞬間にSLIDEが普通のHOLDへ変わり、経路の追従が消える
    const originalType=picked._rhythmOriginalType||picked.type;
    if(originalType==='HOLD'||originalType==='FLICK'||originalType==='SLIDE')RHYTHM_GESTURE_RUNTIME.bind(key,picked,originalType,now,offset);
    RHYTHM_NOTE_SE_RUNTIME.play();
    return {input,target:picked,deltaMs:now-(picked.timeMs+offset)};
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
// STEP 2B-5: 幅の上限撤廃(全幅=10サブレーン)と、HOLDの途中幅変化(holdPoints)の確認用。
// 実機で「上限を無くして全幅もありに」「HOLD・SLIDEも途中で広がったり細くなったりしてほしい」
// と言われて足した(2026-09-04)。判定の作りは変えていないので、見た目と追従の確認だけを行う。
const wideLaneOf=(subLane,width)=>Math.max(0,Math.min(RHYTHM_LANE_COUNT-1,Math.floor((Number(subLane)+Number(width)/2)/2)));
const wideTap=(timeMs,subLane,subLaneWidth)=>Object.freeze({type:'TAP',timeMs,lane:wideLaneOf(subLane,subLaneWidth),subLane,subLaneWidth});
const wideFlick=(timeMs,subLane,subLaneWidth)=>Object.freeze({type:'FLICK',timeMs,lane:wideLaneOf(subLane,subLaneWidth),subLane,subLaneWidth});
const wideHold=(timeMs,endTimeMs,subLane,subLaneWidth,points=null)=>Object.freeze({
  type:'HOLD',timeMs,endTimeMs,lane:wideLaneOf(subLane,subLaneWidth),subLane,subLaneWidth,
  ...(points?{holdPoints:Object.freeze(points.map(([pointTimeMs,pointSubLane,pointWidth])=>Object.freeze({timeMs:pointTimeMs,subLane:pointSubLane,subLaneWidth:pointWidth})))}:{}),
});
// EASY: 幅2から全幅(10)までを順に出して、大きさの段階が見えるかを確かめる。
const wideWidthTestNotes=Object.freeze([
  wideTap(1800,4,2),wideTap(2600,3,4),wideTap(3400,2,6),wideTap(4200,1,8),wideTap(5000,0,10),
  wideHold(6200,8200,0,10),
  wideTap(9000,0,5),wideTap(9000,5,5),
  wideFlick(10200,0,10),
  wideHold(11400,13400,2,6),wideTap(12400,0,2),
  wideFlick(14600,0,6),wideFlick(14600,6,4),
  wideTap(15800,0,3),wideTap(15800,3,4),wideTap(15800,7,3),
  wideHold(17000,20000,1,8),
]);
const wideWidthTestChart=Object.freeze({level:2,notes:wideWidthTestNotes,totalNotes:wideWidthTestNotes.length,durationMs:21500});
// NORMAL: HOLDの途中で幅が変わる形。広がる・細くなる・途中で折り返す・全幅まで開く。
const wideHoldTaperTestNotes=Object.freeze([
  // 細い→太い(プロセカのロングノーツと同じ「広がる」形)
  wideHold(1800,4200,4,2,[[1800,4,2],[4200,2,6]]),
  // 太い→細い
  wideHold(5400,7800,2,6,[[5400,2,6],[7800,4,2]]),
  // 途中で広がってから細くなる(「途中から」を確かめる本命)
  wideHold(9000,13000,3,4,[[9000,3,4],[10600,1,8],[11800,1,8],[13000,4,2]]),
  // 全幅まで開いてから戻る
  wideHold(14200,18200,4,2,[[14200,4,2],[16200,0,10],[18200,4,2]]),
  // 幅が変わるHOLDを押さえたまま、別の指でTAPが取れるか
  wideHold(19400,23400,0,4,[[19400,0,4],[21400,0,8],[23400,0,4]]),
  wideTap(20600,8,2),wideTap(22200,8,2),
  // 終点フリック付きで、終わりの横棒も細くなった幅に合うか
  Object.freeze({type:'HOLD',timeMs:24600,endTimeMs:27400,lane:1,subLane:1,subLaneWidth:8,endFlick:true,
    holdPoints:Object.freeze([Object.freeze({timeMs:24600,subLane:1,subLaneWidth:8}),Object.freeze({timeMs:27400,subLane:4,subLaneWidth:2})])}),
]);
const wideHoldTaperTestChart=Object.freeze({level:5,notes:wideHoldTaperTestNotes,totalNotes:wideHoldTaperTestNotes.length,durationMs:29000});
// HARD: 全幅のSLIDEと、幅が変わるSLIDE・HOLDの組み合わせ。
const wideSlideTestNotes=Object.freeze([
  // 全幅(10)のSLIDE。中心は必ず真ん中のレーンになる。
  Object.freeze({type:'SLIDE',timeMs:1800,endTimeMs:4200,lane:2,endLane:2,subLaneWidth:10,
    slidePoints:Object.freeze([Object.freeze({timeMs:1800,lane:2}),Object.freeze({timeMs:4200,lane:2})])}),
  // 細い→全幅→細い
  Object.freeze({type:'SLIDE',timeMs:5400,endTimeMs:9400,lane:2,endLane:2,
    slidePoints:Object.freeze([Object.freeze({timeMs:5400,lane:2,subLaneWidth:2}),Object.freeze({timeMs:7400,lane:2,subLaneWidth:10}),Object.freeze({timeMs:9400,lane:2,subLaneWidth:2})])}),
  // 曲がりながら幅6→幅1
  Object.freeze({type:'SLIDE',timeMs:10600,endTimeMs:14600,lane:1,endLane:3,
    slidePoints:Object.freeze([Object.freeze({timeMs:10600,lane:1,subLaneWidth:6}),Object.freeze({timeMs:12600,lane:2,subLaneWidth:3}),Object.freeze({timeMs:14600,lane:3,subLaneWidth:1})])}),
  // 幅の変わるHOLD2本を左右で同時に押さえる
  wideHold(15800,19800,0,4,[[15800,0,4],[17800,0,2],[19800,0,4]]),
  wideHold(15800,19800,6,4,[[15800,6,4],[17800,8,2],[19800,6,4]]),
  wideFlick(21000,0,10),
]);
const wideSlideTestChart=Object.freeze({level:7,notes:wideSlideTestNotes,totalNotes:wideSlideTestNotes.length,durationMs:22500});

// 終点フリック(endFlick)の確認用テスト譜面。
// HOLD / SLIDE の終わりで「フリックして離す」パターン。endFlick を書いていないノーツも
// わざと混ぜてあり、見分けが付くか・従来どおり離すだけで取れるかを同じ譜面で確かめられる。
const efHold=(timeMs,endTimeMs,subLane,subLaneWidth,endFlick)=>Object.freeze({
  type:'HOLD',timeMs,endTimeMs,lane:Math.floor(subLane/2),subLane,subLaneWidth,...(endFlick?{endFlick:true}:{}),
});
const efSlide=(points,subLaneWidth,endFlick)=>{
  const slidePoints=Object.freeze(points.map(([timeMs,lane])=>Object.freeze({timeMs,lane})));
  return Object.freeze({
    type:'SLIDE',timeMs:slidePoints[0].timeMs,endTimeMs:slidePoints[slidePoints.length-1].timeMs,
    lane:slidePoints[0].lane,endLane:slidePoints[slidePoints.length-1].lane,subLaneWidth,slidePoints,
    ...(endFlick?{endFlick:true}:{}),
  });
};
// EASY: HOLDの終点フリックだけ。幅違いと、最後は左右同時の終点フリック。
const endFlickHoldTestNotes=Object.freeze([
  efHold(1800,3000,4,2,true),
  efHold(4000,5200,0,2,true),
  efHold(6200,7400,8,2,true),
  efHold(8400,10000,2,1,true),
  efHold(11000,12600,6,4,true),
  efHold(13600,14800,4,2,false),
  efHold(15800,17400,0,2,true),
  efHold(15800,17400,8,2,true),
]);
const endFlickHoldTestChart=Object.freeze({level:4,notes:endFlickHoldTestNotes,totalNotes:endFlickHoldTestNotes.length,durationMs:19000});
// NORMAL: SLIDEの終点フリック。動かしている指をそのまま弾いて終われるかを見る。
const endFlickSlideTestNotes=Object.freeze([
  efSlide([[1800,0],[2600,1],[3400,2]],2,true),
  efSlide([[4400,4],[5200,3],[6000,2]],2,true),
  efSlide([[7000,1],[8000,2],[9000,3]],3,true),
  efSlide([[10000,2],[10800,2],[11600,2]],2,false),
  efSlide([[12600,.5],[13600,2],[14600,3.5]],1,true),
]);
const endFlickSlideTestChart=Object.freeze({level:6,notes:endFlickSlideTestNotes,totalNotes:endFlickSlideTestNotes.length,durationMs:16500});
// HARD: TAP / FLICK と混ぜ、終点フリックが2本同時に来る場面も入れる。
const endFlickMixTestNotes=Object.freeze([
  Object.freeze({type:'TAP',timeMs:1800,lane:2,subLane:4,subLaneWidth:2}),
  efHold(2600,3800,0,2,true),
  efSlide([[4600,4],[5400,3],[6200,2]],2,true),
  Object.freeze({type:'TAP',timeMs:5400,lane:0,subLane:0,subLaneWidth:2}),
  efHold(7000,8200,6,2,false),
  efSlide([[9000,1],[10000,2],[11000,3]],3,true),
  efHold(9400,11000,0,1,true),
  Object.freeze({type:'FLICK',timeMs:12000,lane:2,subLane:4,subLaneWidth:2}),
  efHold(12800,14400,8,2,true),
  Object.freeze({type:'TAP',timeMs:15200,lane:0,subLane:0,subLaneWidth:2}),
]);
const endFlickMixTestChart=Object.freeze({level:8,notes:endFlickMixTestNotes,totalNotes:endFlickMixTestNotes.length,durationMs:17000});

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
// 自動譜面制作V2(STEP1〜7)で作った譜面用のヘルパー。v1のヘルパー(mhHold / mhSlide)は
// 一切変えず、終点フリック(endFlick)を書ける形だけを別に用意する。
//   h2(時刻, サブレーン, 幅, 終了時刻, 終点フリック)
//   s2(時刻, 終了時刻, [[時刻,レーン,幅]...], 終点フリック)
// holdPoints は [[timeMs,subLane,subLaneWidth], ...]。書くと押さえている途中で帯の幅が変わる。
const mhHoldV2=(timeMs,subLane,subLaneWidth,endTimeMs,endFlick,holdPoints)=>Object.freeze({
  type:'HOLD',timeMs,endTimeMs,lane:Math.floor(subLane/2),subLane,subLaneWidth,
  ...(endFlick?{endFlick:true}:{}),
  ...(Array.isArray(holdPoints)&&holdPoints.length>=2
    ?{holdPoints:Object.freeze(holdPoints.map(([pointTimeMs,pointSubLane,pointWidth])=>Object.freeze({timeMs:pointTimeMs,subLane:pointSubLane,subLaneWidth:pointWidth})))}
    :{}),
});
const mhSlideV2=(timeMs,endTimeMs,points,endFlick)=>{
  const slidePoints=Object.freeze(points.map(([pointTimeMs,lane,subLaneWidth])=>Object.freeze({timeMs:pointTimeMs,lane,subLaneWidth})));
  return Object.freeze({
    type:'SLIDE',timeMs,endTimeMs,
    lane:slidePoints[0].lane,endLane:slidePoints[slidePoints.length-1].lane,
    subLaneWidth:slidePoints[0].subLaneWidth,slidePoints,
    ...(endFlick?{endFlick:true}:{}),
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

// 自動譜面制作システムV2(STEP1〜7)が作った候補。マーカーの内側は
// tools/mode/rhythm-chart-v2-step8-pipeline.js --release が差し替えるので手で書かない。
// v1(monsterHeroEasyNotes ほか)とは別物で、v1は1音も変えていない。
const monsterHeroV2EasyNotes=((t,h,f,s)=>[
// <monster-hero-v2-easy-notes>
  h(6097,6,3,7136,0,[[6097,6,3],[6443,5,4],[6790,5,4],[7136,4,6]]),t(10948,3,4,0),t(11988,6,4,0),t(14413,0,10,0),
  t(16146,1,3,0),t(17185,0,6,0),t(18571,1,3,0),t(20650,3,3,0),
  t(20997,0,4,0),t(21690,1,3,0),t(23423,2,6,0),t(25155,6,4,0),
  t(25502,4,6,0),t(28274,7,3,0),t(28967,4,6,0),t(29313,3,3,0),
  t(30699,0,6,0),t(31046,1,4,0),h(32432,0,4,33471),t(34511,1,4,1),
  t(35204,0,3,0),t(35897,2,6,0),t(37283,6,4,0),t(37630,5,4,0),
  h(39016,4,6,40055),t(44213,4,6,0),t(44560,6,4,0),h(45253,2,6,46292),
  t(48025,1,4,0),t(50451,0,4,0),t(51144,1,4,0),h(51837,0,3,52530),
  t(53223,3,3,0),t(55648,5,4,0),t(56168,4,6,0),h(57381,4,6,58074),
  t(58594,7,3,0),h(59114,3,4,59807),t(60326,1,3,0),t(60673,0,4,0),
  t(60846,0,3,0),t(61539,1,4,0),t(61886,3,4,0),t(62752,4,6,0),
  t(63445,4,6,0),t(64311,0,10,2),t(64658,3,4,0),t(65178,1,4,0),
  t(65871,0,6,0),t(66564,0,6,0),t(66737,3,4,0),t(67603,6,4,0),
  t(67776,6,4,0),t(68123,4,6,0),t(68989,2,6,0),t(72628,0,6,0),
  t(72974,1,4,0),t(73840,0,4,0),t(74360,1,3,0),t(74533,1,3,0),
  t(75746,5,3,0),t(76093,7,3,0),h(76439,4,6,77132),t(77999,6,4,0),
  t(78692,3,3,0),t(79038,0,6,0),t(79731,2,6,0),t(80424,4,6,0),
  t(81637,7,3,0),t(81984,5,4,0),t(82850,3,4,0),t(83370,0,10,0),
  t(84063,0,6,0),t(84409,0,4,0),t(84929,1,4,0),t(85622,3,4,0),
  t(85795,3,3,0),t(86142,6,4,0),t(86315,7,3,0),t(86661,5,4,0),
  t(88048,0,6,0),t(88394,0,6,0),t(88567,0,3,0),t(88914,0,6,0),
  t(89087,0,6,0),t(89607,4,6,0),h(89953,4,6,90646,0,[[89953,4,6],[90300,5,4],[90646,6,3]]),t(90993,4,6,0),
  t(91166,5,4,0),t(91513,3,4,0),t(91686,4,6,0),t(92032,3,4,0),
  t(92379,0,6,3),t(92726,0,6,0),t(93072,0,6,0),t(93245,0,4,0),
  t(93592,3,3,0),t(94112,6,4,0),t(94458,5,3,0),t(94805,0,10,0),
  t(95151,4,6,0),t(95498,3,3,0),t(95844,1,3,0),t(96191,0,3,0),
  t(96364,0,3,0),t(96884,1,4,0),t(97057,1,3,0),t(97577,2,6,0),
  t(97923,6,4,0),t(98270,4,6,0),t(98443,5,3,0),t(98790,4,6,0),
  t(99309,2,6,0),t(99829,0,6,0),t(100002,0,6,0),t(100349,2,6,0),
  t(101215,4,6,0),t(101562,4,6,0),t(102081,4,6,0),t(102255,6,4,0),
  t(102601,4,6,0),t(103121,3,4,0),t(103814,0,6,0),t(104161,1,3,0),
  t(104507,0,3,0),t(104680,0,3,0),t(105373,1,3,0),t(105547,2,6,0),
  t(105893,5,3,0),t(106240,4,6,0),t(106586,5,4,0),t(106759,5,4,0),
  t(107106,3,4,0),t(107279,3,3,0),t(107626,1,3,0),t(107799,0,6,0),
  h(108319,0,3,109012,0,[[108319,0,3],[108665,0,6],[109012,0,3]]),t(109531,1,3,0),t(109705,0,3,0),t(110051,3,4,0),
  t(110398,6,4,0),t(111264,5,3,0),t(111957,6,4,0),t(112304,5,4,0),
  t(112650,4,6,0),t(112823,7,3,0),t(113516,3,4,0),t(114383,0,3,0),
  t(114729,1,3,0),t(114902,1,4,0),t(115249,0,4,0),t(115942,3,3,0),
  t(116289,4,6,0),t(116808,4,6,0),t(116982,0,10,0),t(117328,5,3,0),
  t(117501,5,3,0),t(117848,2,6,0),t(118194,0,6,0),h(118368,0,6,119061),
  t(119407,1,3,0),t(120100,3,3,0),t(120620,6,4,0),t(120793,5,4,0),
  t(121140,1,3,4),t(121486,0,4,0),t(121660,0,3,0),t(122526,1,3,0),
  t(122699,0,6,0),t(123046,3,4,0),t(123392,4,6,0),t(123912,5,3,0),
  t(124258,3,4,0),t(124605,0,6,0),t(125125,1,3,0),t(125298,1,3,0),
  t(125818,3,4,0),t(126164,4,6,0),t(126511,5,4,0),t(126684,5,3,0),
  t(127030,7,3,0),t(127377,3,3,0),t(128070,0,3,0),t(128590,0,6,0),
  t(128763,1,3,0),t(129456,0,3,0),t(129629,0,3,0),t(129976,3,3,0),
  t(130149,2,6,0),t(130496,4,6,0),t(130669,6,4,0),t(131015,5,4,0),
  t(131362,7,3,0),t(131882,5,3,0),t(132228,3,3,0),t(133095,0,4,0),
  t(134134,1,4,0),h(134307,0,6,135000,0,[[134307,0,6],[134654,2,3],[135000,0,6]]),t(135693,0,3,0),t(136386,3,3,0),
  t(136560,3,4,0),t(136906,5,3,0),t(137253,6,4,0),t(137426,4,6,0),
  t(138119,7,3,0),t(138812,5,3,0),t(139159,1,3,0),t(139852,0,3,0),
  t(140025,0,3,0),t(140545,1,3,0),t(140891,3,3,0),t(141064,3,4,0),
  t(141411,6,4,0),t(141757,4,6,0),t(141931,5,4,0),t(142624,6,4,0),
  t(142797,6,4,0),t(143143,5,4,0),t(144010,1,3,0),t(144703,0,4,0),
  t(145049,1,3,0),t(145396,0,3,0),t(145742,3,4,0),t(146262,7,3,0),
  t(146782,5,3,0),t(147302,0,10,0),t(147995,3,4,0),t(148341,0,3,0),
  t(149207,0,6,0),t(149554,0,6,0),t(149727,0,6,0),
// </monster-hero-v2-easy-notes>
])(mhTap,mhHoldV2,mhFlick,mhSlideV2);
const monsterHeroV2NormalNotes=((t,h,f,s)=>[
// <monster-hero-v2-normal-notes>
  h(6097,6,2,6790,1,[[6097,6,2],[6443,5,4],[6790,4,6]]),f(7483,4,2),t(10255,2,2,0),t(10948,0,3,0),
  t(11294,1,3,0),t(11988,6,4,0),t(12681,6,2,0),t(14413,0,10,0),
  t(16146,3,3,0),t(17185,0,6,0),t(18571,1,3,0),t(20650,3,3,0),
  t(20997,0,3,0),t(21690,5,3,0),t(23423,4,6,0),t(25155,5,4,0),
  h(25502,3,4,26541),t(28274,7,3,0),t(28967,0,6,0),t(29313,0,3,0),
  t(30699,0,6,0),t(31046,3,3,0),t(32432,0,3,0),f(34511,5,3),
  t(35204,7,3,1),t(35897,5,4,0),t(36937,8,2,0),t(37283,3,3,0),
  t(37630,1,3,0),t(39016,0,6,0),t(39362,1,4,0),t(40748,0,2,0),
  h(42827,4,2,43520),t(44213,4,6,0),t(44560,6,4,0),t(45253,4,6,0),
  t(45773,4,2,0),t(46986,2,2,0),t(47679,8,2,0),t(48025,5,4,0),
  t(50451,0,4,0),t(51144,1,3,0),t(51837,0,3,0),t(53223,3,3,0),
  f(53569,8,2),t(55648,5,4,0),t(56168,3,4,0),h(57381,0,6,58074),
  t(58421,8,2,0),t(58767,6,2,0),h(59114,0,4,59807),t(60500,2,2,0),
  t(60673,1,3,0),t(60846,1,3,0),t(61539,3,4,0),h(61886,7,3,62232),
  t(62752,4,6,0),t(63445,0,6,0),t(63792,4,2,0),t(63965,8,2,0),
  t(64311,0,10,2),t(64658,0,4,0),f(65351,4,2),t(65871,4,6,0),
  h(66737,5,3,67083),t(67603,0,4,0),t(67776,0,3,0),h(68123,0,6,68469),
  t(68989,2,6,0),t(69336,8,2,0),t(72628,4,6,0),t(72974,3,4,0),
  t(73667,2,2,0),t(74360,0,3,0),t(74707,2,2,0),t(75400,8,2,0),
  t(75746,5,3,0),t(75920,5,3,0),t(76093,5,3,0),h(76439,2,6,77132,0,[[76439,2,6],[76786,3,4],[77132,4,2]]),
  t(77825,7,3,0),t(77999,6,4,0),t(78518,4,2,0),t(79038,0,4,0),
  t(79731,0,6,0),t(80424,0,6,0),f(81637,1,3),h(81984,0,4,82330),
  t(82850,3,4,0),t(83196,4,6,0),t(83370,0,10,0),t(84063,3,4,0),
  t(84409,1,4,0),t(84756,0,2,0),t(84929,0,4,0),t(85449,2,2,0),
  t(85795,7,3,0),t(85968,4,6,0),t(86142,5,4,0),t(86488,3,3,0),
  t(86661,3,4,0),t(87701,1,3,0),t(88048,0,6,0),t(88394,4,6,0),
  t(88567,5,3,0),t(88914,4,6,0),t(89087,4,6,0),t(89260,6,4,0),
  t(89607,2,6,0),t(89780,3,4,0),t(89953,2,6,0),f(90646,2,2),
  t(90993,0,6,0),t(91166,0,4,0),t(91686,0,6,0),t(92032,5,3,3),
  t(92379,4,6,0),t(92726,5,4,0),t(93072,1,4,0),t(93245,1,4,0),
  t(93765,0,2,0),t(94112,3,4,0),t(94458,5,3,0),t(94631,5,3,0),
  t(94805,0,10,0),t(95151,4,6,0),t(95498,3,3,0),t(95671,2,6,0),
  t(95844,0,2,0),t(96191,1,3,0),t(96364,2,2,0),t(96537,2,2,0),
  f(96884,6,4),t(97230,6,2,0),t(97577,0,6,0),t(97923,3,4,0),
  t(98270,4,6,0),t(98616,4,6,0),t(98790,4,6,0),t(99136,0,3,0),
  t(99309,0,6,0),t(99829,0,6,0),t(100002,2,6,0),t(100349,6,4,0),
  t(101042,4,2,0),t(101562,0,6,0),t(102081,0,6,0),t(102255,1,4,0),
  t(102601,4,6,0),t(103121,5,4,0),f(103467,0,2),t(103814,2,6,0),
  t(104161,8,2,0),t(104507,6,2,0),t(104680,6,2,0),t(104854,6,2,0),
  t(105373,0,2,0),t(105547,0,6,0),t(105720,1,4,0),t(106240,6,4,0),
  t(106586,3,4,0),t(106759,3,4,0),t(107106,0,4,0),t(107279,0,3,0),
  t(107626,2,2,0),t(107799,0,6,0),t(107972,0,6,0),h(108319,8,2,109012,1,[[108319,8,2],[108665,4,6],[109012,8,2]]),
  t(109531,4,2,0),t(109705,8,2,0),t(109878,4,6,0),h(110398,5,4,110744),
  t(111264,0,3,0),t(111957,3,4,0),t(112304,6,4,0),t(112650,4,6,0),
  t(112823,5,3,0),h(113516,0,4,113863),t(114383,4,2,0),t(114729,7,3,0),
  t(114902,7,3,0),t(115076,4,6,0),f(115942,3,3),t(116289,0,4,0),
  t(116808,0,6,0),t(116982,0,10,0),t(117328,0,2,0),t(117501,0,2,0),
  t(117848,2,6,0),t(118194,4,6,0),t(118368,4,6,0),t(118541,5,3,0),
  h(119407,4,6,120100,0,[[119407,4,6],[119754,8,2],[120100,4,6]]),t(120620,3,4,0),t(120793,1,4,0),f(121140,0,3),
  t(121486,1,4,0),t(121660,1,3,0),t(122526,4,2,0),t(122699,2,6,0),
  t(123046,7,3,0),t(123392,4,6,0),t(123565,8,2,0),t(123912,5,3,4),
  t(124258,0,4,0),t(124605,0,6,0),t(125125,0,3,0),t(125298,0,2,0),
  t(125471,0,2,0),t(125818,3,4,0),t(126164,4,6,0),t(126511,5,4,0),
  t(126684,5,3,0),t(127030,3,3,0),f(127377,1,3),t(128070,8,2,0),
  t(128590,2,6,0),t(128763,4,2,0),t(128936,4,2,0),t(129456,1,3,0),
  t(129629,1,3,0),t(129803,2,2,0),t(130149,0,4,0),t(130496,4,6,0),
  t(130669,5,4,0),t(130842,6,2,0),t(131362,7,3,0),t(131882,3,3,0),
  h(132228,0,3,132575),t(133095,1,3,0),t(133441,8,2,0),t(134134,5,3,0),
  t(134307,4,6,0),t(134481,5,3,0),f(135693,0,2),t(136386,2,2,0),
  t(136560,1,4,0),t(136906,7,3,0),t(137079,7,3,0),t(137253,7,3,0),
  t(138119,4,2,0),t(138812,0,2,0),h(139159,4,2,139852),t(140545,0,2,0),
  t(140891,2,2,0),t(141064,1,4,0),t(141238,0,6,0),t(141584,8,2,0),
  t(141757,4,6,0),t(141931,6,4,0),t(142624,3,4,0),t(142970,0,3,0),
  t(143143,0,4,0),t(144010,4,2,0),t(144703,5,3,0),t(145049,0,2,0),
  f(145396,4,2),h(145742,0,3,146435,1),t(147302,0,10,0),t(147995,6,4,0),
  t(148341,6,2,0),t(149207,3,4,0),t(149381,2,6,0),t(149554,2,6,0),
// </monster-hero-v2-normal-notes>
])(mhTap,mhHoldV2,mhFlick,mhSlideV2);
const monsterHeroV2HardNotes=((t,h,f,s)=>[
// <monster-hero-v2-hard-notes>
  t(4191,6,2,0),h(4364,5,1,5057,1,[[4364,5,1],[4711,4,3],[5057,3,5]]),t(5577,1,3,0),f(6097,6,4),
  s(7483,8176,[[7483,2,3],[7829,2.5,3],[8176,2.5,3]]),t(9389,0,2,0),t(10255,1,3,0),t(10948,3,3,0),
  t(11294,7,3,0),t(11988,5,4,0),t(12681,0,2,0),t(14413,0,8,0),
  h(14760,3,3,15453),t(16146,0,3,0),t(16319,1,4,0),h(17185,5,5,17878),
  t(18398,5,4,0),h(18571,3,3,18918),t(19438,0,2,0),t(20650,1,3,0),
  t(20997,7,3,0),h(21690,5,3,22383),t(23076,6,4,0),t(23423,2,5,0),
  t(24116,0,2,0),t(24289,1,3,0),t(25155,3,4,0),h(25502,4,5,26195),
  f(26541,0,2),t(27061,0,5,0),t(27754,7,3,0),t(28274,5,3,0),
  t(28967,2,5,0),t(29313,0,3,0),t(29487,1,3,0),t(30526,8,2,0),
  t(30699,4,5,0),h(31046,3,3,31739),t(32085,0,2,0),t(32432,1,3,1),
  t(32952,5,5,0),t(34511,5,4,0),t(34858,4,2,0),t(35204,0,3,0),
  h(35897,0,5,36590),t(36937,7,3,0),t(37283,5,4,0),h(37630,3,4,37976),
  t(38496,0,4,0),t(38669,2,2,0),f(39016,5,5),h(39362,5,4,40055),
  t(40575,2,5,0),h(40748,1,2,41441),s(41788,42827,[[41788,1,1],[42134,2,4],[42481,2,4],[42827,1,1]]),h(43174,6,2,43867),
  t(44213,2,5,0),t(44560,6,4,0),t(45253,4,5,0),t(45773,0,3,0),
  t(46292,2,2,0),t(46986,4,2,0),t(47505,6,4,0),t(47679,5,3,0),
  h(48025,0,5,49065,0,[[48025,0,5],[48372,0,4],[48718,1,2],[49065,2,1]]),t(49931,1,3,0),t(50277,2,5,0),t(50451,6,4,0),
  t(51144,5,4,0),t(51663,0,3,0),h(51837,1,3,52183),t(52703,3,4,0),
  t(52876,7,2,0),f(53223,5,3),h(53569,0,2,54262),t(54782,0,5,0),
  t(55475,2,5,0),t(55648,6,4,0),t(55822,5,4,0),t(56168,0,5,0),
  t(57034,2,2,0),h(57381,4,1,58074,0,[[57381,4,1],[57727,2,5],[58074,4,1]]),t(58421,8,2,0),t(58594,5,3,0),
  t(58767,3,3,0),h(59114,0,5,59807,0,[[59114,0,5],[59460,2,1],[59807,0,5]]),t(60326,1,3,0),t(60500,0,2,0),
  t(60673,1,4,0),t(60846,3,3,0),t(61539,6,4,2),h(61886,5,3,62232,1),
  t(62752,0,5,0),t(63185,1,3,0),t(63445,2,5,0),t(63792,8,2,0),
  t(63965,6,2,0),f(64311,0,8),t(64658,1,4,0),t(65178,6,4,0),
  s(65351,68123,[[65351,3,5],[65697,3,4],[66044,3,3],[66390,2.5,2],[66737,2.5,1],[67083,2.5,2],[67430,2,3],[67776,2,4],[68123,2,5]]),t(68383,1,4,0),t(68989,5,5,0),t(69682,6,2,0),
  t(70375,4,2,0),t(70722,0,2,0),t(70895,2,2,0),t(71242,8,2,0),
  t(71761,5,4,0),t(71935,4,2,0),t(72281,8,2,0),t(72628,4,5,0),
  t(72974,0,4,0),f(73321,2,2),t(73667,0,2,0),t(74100,2,5,0),
  t(74360,7,3,0),t(74707,6,2,0),t(75053,8,2,0),t(75400,3,3,0),
  t(75746,1,3,0),t(76093,0,3,0),t(76439,0,5,0),t(76613,2,5,0),
  t(77306,4,5,0),t(77825,7,3,0),t(77999,5,4,0),t(78518,0,2,0),
  t(79038,1,4,0),t(79731,0,5,0),t(80424,2,5,0),t(80771,5,5,0),
  t(81637,5,3,0),t(81984,3,4,0),t(82157,1,4,0),t(82850,0,4,0),
  f(83370,0,5),t(83716,2,8,0),t(84063,4,5,0),t(84236,2,5,0),
  t(84409,0,4,0),t(84756,1,3,0),t(84929,3,4,0),s(85449,86488,[[85449,4,1],[85795,3,4],[86142,3,4],[86488,4,1]]),
  t(86661,1,4,0),t(87441,0,4,0),t(87701,1,4,0),t(87874,4,2,0),
  t(88048,4,5,0),t(88394,5,5,0),t(88567,5,3,0),t(88914,0,5,0),
  t(89087,0,5,0),t(89260,2,5,0),t(89434,6,2,0),t(89607,4,5,0),
  t(89780,3,4,0),t(89953,0,5,0),t(90213,1,4,0),f(90646,0,2),
  t(90993,0,5,0),t(91166,3,4,0),t(91686,5,5,0),t(91859,4,5,0),
  t(92032,6,4,0),t(92206,6,2,0),t(92379,2,5,0),t(92726,0,5,3),
  t(93072,0,5,0),t(93245,0,4,0),t(93592,2,2,0),t(93765,4,2,0),
  f(94112,6,4),t(94458,5,3,0),t(94631,7,3,0),t(94805,2,8,0),
  t(94978,4,1,0),t(95151,0,5,0),t(95498,1,3,0),t(95671,0,5,0),
  t(95844,2,2,0),t(96191,7,3,0),t(96364,6,2,0),t(96537,4,2,0),
  s(96884,98963,[[96884,0,5],[97230,0.5,4],[97577,0.5,4],[97923,1,3],[98270,1.5,2],[98616,1,2],[98963,0.5,1]]),t(99136,7,3,0),t(99309,4,5,0),t(99656,8,1,0),
  t(99829,4,5,0),t(100002,5,5,0),t(100176,4,2,0),t(100349,1,4,0),
  t(101042,0,3,0),t(101215,0,5,0),t(101562,0,5,0),t(101908,4,1,0),
  t(102081,4,5,0),t(102255,6,4,0),t(102601,4,5,0),f(103121,6,4),
  t(103467,4,2,0),t(103641,1,3,0),t(103814,0,5,0),t(104161,2,2,0),
  t(104334,4,2,0),t(104507,6,2,0),t(104680,8,2,0),t(104854,6,2,0),
  t(105373,0,3,0),t(105547,0,5,0),t(105720,3,4,0),t(105893,7,3,0),
  t(105980,6,1,0),f(106240,2,5),t(106586,0,4,0),t(106759,1,4,0),
  t(106933,0,2,0),t(107106,1,4,0),t(107279,3,3,0),t(107626,8,2,0),
  t(107799,4,5,0),t(107972,5,5,0),t(108232,4,5,0),s(108319,109012,[[108319,4,1],[108665,3.5,3],[109012,4,5]]),
  t(109098,3,3,0),t(109272,1,2,0),t(109531,1,3,0),t(109705,0,2,0),
  t(109878,0,5,0),t(110051,3,4,0),f(110398,5,4),t(111004,8,2,0),
  t(111264,5,3,0),t(111611,0,3,0),t(111957,1,4,0),t(112304,3,4,0),
  t(112650,0,5,0),t(112823,1,3,0),t(112997,4,2,0),t(113170,8,1,0),
  h(113516,7,1,113863,1,[[113516,7,1],[113690,6,3],[113863,5,5]]),t(114383,7,3,0),t(114643,6,1,0),t(114729,3,3,0),
  t(114902,0,4,0),t(115076,0,5,0),t(115249,0,4,0),t(115422,1,4,0),
  t(115595,3,3,0),t(115942,7,3,0),t(116289,5,4,0),t(116808,5,5,0),
  t(116982,2,8,0),t(117328,0,2,0),t(117501,1,3,0),t(117675,4,1,0),
  t(117848,5,5,0),t(117934,8,1,0),t(118194,4,5,0),t(118368,2,5,0),
  t(118541,0,4,0),t(118801,0,5,0),f(119407,0,2),t(119840,2,2,0),
  t(120014,3,4,0),t(120360,6,2,0),t(120620,6,4,0),t(120793,5,4,0),
  t(120966,4,2,0),t(121140,1,3,0),t(121486,1,4,0),t(121660,0,3,0),
  t(122093,1,4,0),t(122266,4,2,0),s(122526,123912,[[122526,4,3],[122872,4,3],[123219,3.5,3],[123565,2.5,3],[123912,2.5,3]],1),t(124258,5,4,4),
  f(124605,5,5),t(125125,5,3,0),t(125298,4,2,0),t(125471,2,2,0),
  t(125818,0,4,0),t(125904,0,1,0),t(126164,0,5,0),t(126511,6,4,0),
  t(126684,5,3,0),t(127030,3,3,0),t(127377,7,3,0),t(127550,6,2,0),
  t(128070,8,2,0),t(128590,2,5,0),t(128763,2,2,0),t(128936,0,2,0),
  t(129283,2,2,0),t(129456,3,3,0),t(129629,5,3,0),t(129803,8,2,0),
  t(129976,6,2,0),t(130149,2,5,0),t(130409,0,1,0),t(130496,0,5,0),
  t(130669,0,4,0),t(130842,1,3,0),t(131015,3,3,0),t(131362,7,3,0),
  t(131622,6,2,0),f(131882,7,3),t(132228,5,3,0),t(132661,0,3,0),
  t(133095,1,3,0),t(133441,4,2,0),t(133528,7,1,0),t(134134,0,4,0),
  t(134307,2,5,0),t(134481,7,3,0),s(135693,138465,[[135693,3,1],[136040,3,3],[136386,3,5],[136733,2.5,3],[137079,2.5,1],[137426,2.5,3],[137772,2.5,5],[138119,2,3],[138465,2,1]]),t(138552,3,3,0),
  t(138812,8,2,0),f(139159,5,3),t(139678,0,1,0),t(139852,2,1,0),
  t(139938,5,3,0),t(140285,0,2,0),t(140545,2,2,0),t(140891,8,2,0),
  t(141064,5,4,0),t(141151,4,2,0),t(141411,0,4,0),t(141584,2,2,0),
  t(141757,2,5,0),t(141931,6,4,0),t(142104,4,5,0),t(142450,0,4,0),
  t(142624,1,4,0),t(142797,3,4,0),t(142970,6,3,0),t(143143,5,4,0),
  t(143577,0,3,0),t(144010,2,2,0),t(144096,0,3,0),t(144703,3,4,0),
  f(145049,8,2),t(145396,5,3,0),t(145656,8,1,0),t(145742,5,4,0),
  t(146002,3,4,0),t(146349,1,3,0),t(146695,0,4,0),t(147302,2,2,0),
  t(147388,0,8,0),t(147995,6,4,0),t(148341,6,2,0),t(148601,2,5,0),
  t(149207,0,4,0),t(149381,2,5,0),s(149554,150594,[[149554,2,5],[149900,3,2],[150247,3.5,2],[150594,3.5,5]],1),
// </monster-hero-v2-hard-notes>
])(mhTap,mhHoldV2,mhFlick,mhSlideV2);
const monsterHeroV2ExpertNotes=((t,h,f,s)=>[
// <monster-hero-v2-expert-notes>
  t(2112,1,3,0),h(2285,2,1,3325,1,[[2285,2,1],[2632,1,2],[2978,0,4],[3325,0,5]]),t(5577,3,3,0),f(6097,5,4),
  s(7483,8176,[[7483,4,3],[7829,4,3],[8176,3.5,3]]),t(10255,6,2,0),t(10948,3,3,0),t(11294,7,3,0),
  t(11988,5,4,0),h(12681,2,2,13720),t(13200,8,2,0),t(14413,0,8,0),
  h(14760,2,2,15453),t(15106,8,2,0),t(15799,0,3,0),t(16146,3,3,0),
  t(16319,7,3,0),h(17185,4,5,17878),t(18398,3,4,0),h(18571,2,2,19264),
  t(19784,0,3,0),t(20650,2,2,0),t(20997,0,3,0),h(21690,3,3,22383),
  t(22036,8,2,0),t(23076,6,4,0),h(23423,4,5,23769),t(24289,7,3,0),
  t(25155,5,4,0),f(25502,3,4),h(25848,1,4,26541),t(26195,8,2,0),
  t(27061,0,5,0),t(27754,1,3,0),h(28274,3,3,28620),t(28447,8,2,0),
  t(28967,5,5,0),t(29313,5,3,0),t(29487,7,3,0),t(30699,4,5,0),
  t(31046,3,3,0),t(31392,0,3,1),h(31739,1,3,32085),t(31912,8,2,0),
  t(32432,0,3,0),t(32952,0,5,0),t(33298,3,3,0),t(33991,7,3,0),
  t(34511,5,3,0),t(35031,7,3,0),h(35204,5,3,35551),t(35377,6,2,0),
  t(35897,2,5,0),t(36937,0,2,0),t(37110,1,3,0),t(37283,0,3,0),
  h(37630,1,3,37976),t(37803,8,2,0),t(38496,3,4,0),f(39016,5,5),
  h(39362,5,4,40055),t(39709,0,2,0),t(40575,5,5,0),t(41268,5,3,0),
  t(41615,3,3,0),t(41961,0,8,0),h(42827,2,2,43520,1),t(43174,8,2,0),
  s(44213,45599,[[44213,0,1],[44560,0.5,5],[44906,0.5,1],[45253,1,5],[45599,1,1]]),t(44906,8,2,0),t(45773,6,2,0),t(46119,5,5,0),
  t(47159,5,4,0),t(47505,6,4,0),t(47679,4,2,0),t(48025,0,4,0),
  t(48198,1,3,0),t(49931,0,3,0),t(50277,0,5,0),t(50451,3,4,0),
  t(50624,6,2,0),f(51144,6,4),t(51663,5,3,0),h(51837,2,5,52183,0,[[51837,2,5],[52010,3,3],[52183,4,1]]),
  t(52010,8,2,0),t(52703,0,4,0),t(53050,1,4,0),t(53223,0,3,0),
  t(53396,1,3,0),t(54089,4,2,0),t(54436,7,3,0),t(54782,4,5,0),
  t(55475,5,5,0),t(55648,5,3,0),h(55995,4,1,56341,0,[[55995,4,1],[56168,2,5],[56341,4,1]]),t(56168,8,2,0),
  t(56688,0,3,0),h(57381,0,5,57727),t(58247,0,4,0),t(58421,2,2,0),
  t(58767,4,2,2),f(59114,6,4),t(59460,3,1,0),t(59460,5,4,0),
  t(59633,7,3,0),t(59807,6,1,0),t(60326,4,2,0),t(60500,0,1,0),
  t(60673,1,4,0),s(60846,61539,[[60846,0,1],[61193,0.5,3],[61539,0,5]]),h(61886,5,5,62232,0,[[61886,5,5],[62059,8,1],[62232,5,5]]),t(62752,4,5,0),
  t(63098,8,2,0),t(63185,4,3,0),t(63445,2,5,0),t(63532,4,2,0),
  t(63965,0,2,0),t(64311,0,8,0),f(64658,0,4),t(65004,2,1,0),
  t(65178,5,4,0),t(65351,8,2,0),t(65871,4,5,0),t(66217,6,4,0),
  t(66564,2,5,0),t(66737,0,3,0),t(66997,1,4,0),t(67603,0,4,0),
  t(67776,1,4,0),t(68123,0,5,0),t(68383,3,3,0),t(68989,5,5,0),
  t(69076,4,2,0),h(69162,7,1,70202,1,[[69162,7,1],[69509,5,4],[69856,5,4],[70202,7,1]]),t(69682,0,2,0),t(71068,4,2,0),
  t(71761,1,4,0),t(72628,4,5,0),t(72974,6,4,0),t(73147,5,3,0),
  t(73494,2,5,0),t(73667,0,1,0),t(73840,1,3,0),t(74100,0,5,0),
  t(74187,0,5,0),t(74360,1,3,0),f(74707,4,1),t(75226,8,2,0),
  t(75400,6,2,0),t(75746,7,3,0),t(75920,5,3,0),t(76093,3,3,0),
  t(76439,0,5,0),t(76613,0,5,0),t(76959,1,4,0),t(76959,7,1,0),
  t(77306,2,5,0),t(77825,7,3,0),t(78172,6,2,0),f(78518,8,2),
  t(78865,4,5,0),t(79038,3,4,0),t(79731,0,5,0),t(80078,1,4,0),
  t(80424,0,5,0),t(80511,0,3,0),t(80857,1,4,0),t(81550,4,3,0),
  s(81637,82677,[[81637,2,1],[81984,2.5,4],[82330,2.5,4],[82677,2,1]]),t(82157,8,2,0),t(82850,6,4,0),t(83370,2,5,0),
  t(83543,0,8,0),t(84063,0,5,0),t(84236,0,5,0),t(84323,3,1,0),
  t(84409,0,4,0),t(84756,4,2,0),t(84929,6,4,0),t(85016,8,2,0),
  t(85449,6,2,0),t(85622,3,4,0),t(85795,1,3,0),t(85795,6,1,0),
  t(85968,4,5,0),t(86055,5,1,0),t(86142,5,4,0),t(86488,4,2,0),
  t(86661,1,4,0),t(86835,0,3,0),t(87095,1,3,0),t(87441,3,4,0),
  t(87528,8,2,0),t(87701,5,4,0),t(88048,5,5,0),t(88394,4,5,0),
  t(88567,3,3,0),t(88741,1,2,0),t(88914,0,5,0),t(89087,0,5,0),
  t(89260,0,5,0),t(89434,4,2,0),t(89607,5,5,0),t(89780,5,4,0),
  t(89953,5,5,0),t(90213,5,4,0),t(90300,4,2,0),f(90646,0,2),
  t(90993,0,5,0),t(91166,0,4,0),t(91339,2,2,0),s(91686,92379,[[91686,1,1],[92032,1.5,3],[92379,1,5]],1),
  t(92032,8,2,3),f(92726,2,5),t(93072,0,5,0),t(93072,6,1,0),
  t(93245,1,4,0),t(93592,0,2,0),t(93765,2,1,0),t(94112,3,4,0),
  t(94371,8,2,0),t(94458,4,2,0),t(94631,8,2,0),t(94805,2,8,0),
  t(95151,2,5,0),t(95498,0,3,0),t(95671,0,5,0),t(95844,0,2,0),
  t(96191,1,3,0),t(96364,4,2,0),t(96537,3,1,0),t(96884,5,4,0),
  t(97057,8,1,0),t(97317,6,1,0),t(97403,4,1,0),t(97577,0,5,0),
  f(97923,1,4),t(98270,0,5,0),t(98443,2,2,0),t(98616,0,5,0),
  t(98790,2,5,0),t(98790,8,1,0),t(99136,7,3,0),t(99309,4,5,0),
  t(99483,8,1,0),t(99829,4,5,0),t(99916,8,1,0),t(100002,5,5,0),
  f(100349,5,4),t(100782,2,2,0),t(101042,0,2,0),t(101215,0,5,0),
  t(101302,2,2,0),t(101562,0,5,0),t(101735,4,2,0),t(101908,7,3,0),
  t(102081,4,5,0),t(102255,3,4,0),t(102601,0,5,0),f(103121,1,4),
  t(103467,4,2,0),t(103641,7,3,0),s(103814,104507,[[103814,2,1],[104161,2.5,3],[104507,2,5]]),t(104161,8,2,0),
  t(104680,2,1,0),t(104854,0,1,0),t(105027,2,1,0),t(105373,4,2,0),
  t(105547,5,5,0),t(105720,5,4,0),t(105893,7,3,0),t(105980,6,2,0),
  t(106153,4,1,0),t(106240,1,5,0),t(106586,0,4,0),t(106586,6,1,0),
  t(106759,1,4,0),t(106933,0,1,0),t(107106,3,4,0),t(107279,6,3,0),
  t(107626,6,2,0),t(107799,5,5,0),t(107886,6,4,0),t(107972,5,5,0),
  t(108059,8,2,0),t(108232,4,5,0),h(108319,5,1,108665,0,[[108319,5,1],[108492,4,3],[108665,3,5]]),t(109098,0,2,0),
  t(109531,2,2,0),t(109705,0,2,0),t(109878,0,5,0),t(110051,3,4,0),
  t(110398,5,4,0),t(110571,3,3,0),t(110744,1,2,0),f(111091,2,1),
  t(111437,6,2,0),t(111784,8,2,0),t(111957,5,4,0),t(112130,4,2,0),
  t(112650,0,5,0),t(112823,1,3,0),t(112823,6,1,0),t(112997,0,1,0),
  t(113170,2,2,0),t(113516,3,4,0),t(113690,6,1,0),t(114296,8,2,0),
  t(114383,6,2,0),t(114469,4,2,0),t(114643,2,3,0),t(114729,1,3,0),
  s(114902,116289,[[114902,0,3],[115249,0,3],[115595,0.5,3],[115942,1,3],[116289,1,3]],1),t(115595,8,2,4),t(116808,5,5,0),t(116982,1,8,0),
  t(117328,2,1,0),t(117501,0,2,0),t(117848,0,5,0),t(117934,3,1,0),
  t(118194,2,5,0),t(118368,4,5,0),t(118714,6,4,0),t(118801,5,5,0),
  t(119321,5,4,0),t(119407,3,4,0),t(119840,0,5,0),t(120014,0,4,0),
  t(120100,0,2,0),t(120100,5,1,0),t(120360,2,2,0),t(120620,3,4,0),
  t(120793,5,4,0),t(120966,8,2,0),t(121140,5,3,0),t(121486,3,4,0),
  t(121573,2,2,0),t(121660,0,3,0),t(121833,2,2,0),t(122093,3,4,0),
  t(122179,8,1,0),t(122526,6,1,0),t(122699,5,5,0),t(123046,5,4,0),
  t(123219,4,2,0),t(123392,0,5,0),t(123565,2,1,0),t(123739,0,3,0),
  t(123912,1,3,0),t(124258,3,4,0),t(124345,3,4,0),f(124605,5,5),
  t(125125,5,3,0),t(125211,1,1,0),s(125298,126337,[[125298,2,5],[125644,2.5,2],[125991,3,2],[126337,3,5]]),t(125818,8,2,0),
  t(126424,6,1,0),t(126511,6,4,0),t(126684,5,3,0),f(127030,7,3),
  t(127377,6,2,0),t(127550,4,1,0),f(128070,0,1),t(128590,0,5,0),
  t(128763,0,2,0),t(128763,5,1,0),t(128936,2,2,0),t(129283,0,2,0),
  t(129456,3,3,0),t(129629,1,3,0),t(129803,6,2,0),t(129976,8,2,0),
  t(130149,5,4,0),t(130409,4,1,0),t(130496,5,5,0),t(130669,5,4,0),
  t(130756,4,1,0),t(130842,6,2,0),t(131015,1,3,0),t(131362,0,3,0),
  t(131449,1,3,0),t(131882,0,3,0),f(132228,1,3),t(132661,4,2,0),
  t(132748,2,2,0),t(133095,0,3,0),t(133441,4,3,0),t(133528,3,1,0),
  t(133528,6,2,0),t(133874,8,1,0),t(134134,5,4,0),t(134307,5,5,0),
  t(134481,3,3,0),t(135693,0,1,0),t(135780,4,1,0),t(136386,0,1,0),
  t(136560,1,4,0),t(136646,0,1,0),t(136906,3,3,0),t(137079,5,5,0),
  t(137253,4,5,0),t(137426,5,5,0),s(137772,138465,[[137772,3,5],[138119,2.5,3],[138465,3,1]],1),t(138119,0,2,0),
  f(138812,0,2),h(139159,1,5,139505,0,[[139159,1,5],[139332,2,3],[139505,3,1]]),t(139852,4,1,0),t(139938,6,3,0),
  t(140025,8,2,0),t(140285,6,2,0),t(140545,8,1,0),t(140891,4,2,0),
  t(141064,0,4,0),t(141151,0,3,0),t(141238,0,5,0),t(141324,0,2,0),
  t(141411,0,4,0),t(141584,2,1,0),t(141757,2,5,0),t(141931,6,4,0),
  t(142104,4,5,0),t(142450,1,4,0),t(142624,3,4,0),t(142797,4,1,0),
  t(142797,6,4,0),t(142884,8,2,0),t(142970,5,3,0),t(143143,2,4,0),
  t(143577,3,3,0),t(144010,5,3,0),t(144096,7,3,0),t(144183,6,1,0),
  t(144703,1,3,0),t(144963,0,1,0),t(145049,4,1,0),t(145396,4,2,0),
  t(145656,8,2,0),t(145742,6,4,0),t(146002,3,3,0),t(146089,2,1,0),
  t(146522,0,4,0),f(146782,2,1),t(147302,3,4,0),t(147388,2,5,0),
  t(147475,1,8,0),t(147821,8,2,0),t(148341,4,5,0),t(148514,7,3,0),
  t(148601,5,5,0),f(148861,4,5),t(149207,1,4,0),t(149207,7,1,0),
  t(149381,0,5,0),s(149554,150247,[[149554,0,5],[149900,0.5,3],[150247,0,1]],1),t(149900,8,2,0),
// </monster-hero-v2-expert-notes>
])(mhTap,mhHoldV2,mhFlick,mhSlideV2);
const monsterHeroV2MasterNotes=((t,h,f,s)=>[
// <monster-hero-v2-master-notes>
  t(2112,1,3,0),h(2285,1,1,2978,1,[[2285,1,1],[2632,0,3],[2978,0,4]]),f(3671,4,1),t(4191,6,2,0),
  s(4364,5057,[[4364,4,3],[4711,4,3],[5057,3.5,3]]),t(5577,3,3,0),t(5750,7,1,0),t(6097,1,4,0),
  t(6617,0,1,0),t(7483,2,2,0),t(8176,4,1,0),t(8522,6,1,0),
  t(9562,8,1,0),t(9908,0,1,0),t(10255,2,2,0),t(10948,3,3,0),
  t(11294,5,3,0),t(11988,6,4,0),t(12334,0,1,0),t(12681,2,2,0),
  t(13027,4,2,0),t(14413,4,6,0),t(14760,8,2,0),h(15106,0,1,15453,1),
  t(15799,2,2,0),t(16146,4,2,0),t(16319,5,3,0),f(17185,6,4),
  t(17705,0,1,0),t(17705,4,1,0),t(17878,2,2,0),t(18398,0,4,0),
  t(18571,4,2,0),t(18745,6,1,0),t(19264,8,2,0),t(19438,6,1,0),
  t(19611,8,2,0),t(20650,4,2,0),t(20997,1,3,0),t(21690,0,3,0),
  t(22036,2,2,0),t(22036,7,1,0),t(23076,3,4,0),t(23423,5,4,0),
  t(24116,0,1,0),t(24289,2,2,0),t(24982,8,2,0),t(25155,5,3,0),
  f(25502,3,4),h(25848,0,3,26195),t(26541,8,2,0),t(27061,5,4,0),
  t(27754,3,3,0),t(27927,6,2,0),s(28274,29660,[[28274,0,1],[28620,1,4],[28967,1.5,1],[29313,2,4],[29660,2,1]],1),t(28967,8,2,0),
  t(30526,6,1,0),t(30699,6,4,0),t(31046,5,3,0),t(31392,3,3,0),
  t(31739,1,3,1),t(32085,0,2,0),t(32432,7,3,0),t(32952,5,4,0),
  f(33471,8,1),t(33818,4,1,0),t(34511,1,3,0),t(35204,0,2,0),
  t(35551,2,1,0),h(35897,3,4,36244),t(36070,8,2,0),t(36590,6,1,0),
  t(36937,8,2,0),t(37110,5,3,0),t(37283,3,3,0),t(37630,0,3,0),
  t(38323,2,2,0),t(38669,8,1,0),t(39016,0,4,0),t(39362,1,3,0),
  f(39709,3,3),t(40575,0,4,0),t(40748,2,2,0),t(41615,5,3,0),
  t(41788,8,1,0),t(41961,4,6,0),f(42827,4,2),t(43174,0,1,0),
  t(44213,6,4,0),t(44560,5,4,0),f(44906,4,1),t(45253,1,4,0),
  t(45426,0,2,0),t(45773,8,2,0),t(46119,5,4,0),h(46292,3,4,46639,1,[[46292,3,4],[46466,3,3],[46639,4,1]]),
  t(46986,2,2,0),t(47332,8,2,0),f(47679,0,2),h(48025,1,3,49065),
  t(48545,8,2,0),s(49758,50451,[[49758,0,1],[50104,0.5,3],[50451,0,4]]),f(50797,6,1),h(51144,3,3,51490),
  t(51663,2,2,0),t(51837,0,2,0),t(52010,2,1,0),t(52357,8,1,0),
  t(52703,5,4,0),t(52876,8,1,0),t(53050,3,3,0),t(53223,0,3,0),
  h(53569,2,2,53916,1),t(54436,0,2,0),t(54782,3,4,0),t(55475,5,4,0),
  t(55648,7,3,0),h(55995,5,3,56341),t(56168,0,2,0),t(56688,3,3,0),
  f(57034,2,2),h(57381,0,4,57727,1),t(58247,7,3,0),t(58421,6,2,0),
  t(58594,3,3,0),t(58767,2,2,0),f(59114,0,4),t(59460,4,1,0),
  t(59460,6,4,0),t(59633,5,3,0),h(59807,4,1,60153),t(60326,2,2,0),
  t(60500,0,1,0),t(60673,1,3,0),h(60846,3,3,61193),t(61019,8,2,0),
  t(61366,6,4,0),t(61539,5,3,0),f(61886,0,3),t(62319,8,1,0),
  t(62752,5,4,0),t(63098,4,2,0),t(63185,1,3,0),t(63445,0,4,0),
  t(63532,0,2,0),f(63965,4,6),s(64311,65004,[[64311,2,1],[64658,2.5,3],[65004,2,4]]),t(64658,8,2,2),
  t(65178,5,3,0),h(65351,4,2,65697),t(65871,1,4,0),t(66217,0,3,0),
  t(66564,4,1,0),t(66564,6,4,0),t(66737,5,3,0),t(66997,3,3,0),
  t(67517,2,1,0),t(67603,3,3,0),t(67690,2,2,0),t(67776,0,3,0),
  t(68123,6,4,0),t(68383,5,3,0),t(68989,0,4,0),h(69162,3,1,69509,0,[[69162,3,1],[69336,1,4],[69509,3,1]]),
  t(69336,8,2,0),t(69682,8,1,0),t(70722,6,1,0),t(70895,4,1,0),
  t(71068,1,2,0),h(71242,2,1,71588),t(71415,8,2,0),t(71761,7,3,0),
  t(71935,6,1,0),t(72108,4,2,0),t(72281,6,1,0),f(72628,0,4),
  t(72974,1,3,0),t(73321,4,2,0),t(73494,5,4,0),t(73667,8,1,0),
  t(73840,5,3,0),t(74100,3,4,0),t(74187,3,4,0),t(74360,0,3,0),
  h(74707,1,4,75053,0,[[74707,1,4],[74880,2,1],[75053,1,4]]),t(75226,8,2,0),t(75400,3,1,0),t(75400,6,2,0),
  t(75746,0,3,0),t(75920,1,3,0),t(76093,0,3,0),t(76266,2,2,0),
  s(76439,77132,[[76439,0,1],[76786,0.5,3],[77132,0,4]]),t(77306,2,1,0),t(77306,5,4,0),t(77652,7,3,0),
  t(77825,5,3,0),t(78172,8,2,0),t(78259,2,1,0),t(78259,6,1,0),
  f(78518,0,2),t(78865,6,4,0),t(79038,5,4,0),t(79731,3,4,0),
  t(80078,1,3,0),t(80424,0,4,0),t(80511,0,3,0),t(80857,7,3,0),
  t(81550,5,3,0),t(81637,4,3,0),t(81984,1,3,0),t(82157,0,4,0),
  t(82850,6,4,0),t(83370,5,4,0),t(83543,2,6,0),t(83889,2,1,0),
  t(84063,0,4,0),t(84236,1,4,0),t(84323,4,1,0),t(84409,1,3,0),
  t(84756,8,2,0),t(84929,5,4,0),t(85016,7,2,0),t(85449,4,2,0),
  t(85622,1,4,0),t(85795,0,3,0),t(85795,5,1,0),t(85968,1,4,0),
  t(86055,1,1,0),t(86142,3,3,0),t(86488,8,2,0),t(86661,5,3,0),
  t(86748,4,2,0),t(86835,0,2,0),t(87095,3,3,0),t(87441,1,4,0),
  t(87528,0,2,0),t(87701,1,3,0),t(88048,6,4,0),t(88394,5,4,0),
  t(88567,3,3,0),t(88741,0,2,0),s(88914,89607,[[88914,0,1],[89260,0.5,3],[89607,0,4]]),t(89260,8,2,3),
  t(89780,5,3,0),t(89953,3,4,0),t(90213,0,4,0),t(90300,2,2,0),
  f(90646,8,2),t(90993,0,4,0),t(91166,1,4,0),t(91339,4,2,0),
  t(91686,3,1,0),t(91686,5,4,0),t(91859,6,4,0),t(92032,5,3,0),
  t(92206,4,1,0),t(92379,0,4,0),f(92726,1,4),t(93072,0,4,0),
  t(93245,1,3,0),t(93592,8,2,0),t(93765,6,1,0),t(93852,4,1,0),
  t(94112,0,4,0),t(94371,2,2,0),t(94458,4,2,0),t(94631,7,2,0),
  t(94805,4,6,0),f(95151,0,4),t(95498,8,2,0),t(95671,5,4,0),
  t(95844,4,2,0),t(96191,1,3,0),t(96364,0,2,0),t(96537,2,1,0),
  t(96884,6,4,0),t(97057,6,1,0),t(97317,8,1,0),t(97403,5,1,0),
  t(97577,3,4,0),f(97923,0,3),t(98270,1,4,0),t(98270,7,1,0),
  t(98443,4,2,0),t(98616,0,4,0),t(98790,1,4,0),t(99136,7,3,0),
  s(99309,100695,[[99309,2,3],[99656,2,3],[100002,3,3],[100349,4,3],[100695,4,3]]),t(100002,8,2,0),t(100782,6,2,0),t(101042,8,2,0),
  t(101215,5,4,0),t(101302,5,2,0),t(101562,1,4,0),t(101735,0,2,0),
  t(101908,2,2,0),t(102081,3,4,0),t(102255,7,3,0),t(102601,5,4,0),
  f(103121,7,3),t(103467,0,2,0),t(103641,1,3,0),t(103814,3,4,0),
  t(103901,3,1,0),t(103901,6,1,0),t(104161,8,2,0),t(104334,6,1,0),
  t(104507,4,1,0),t(104680,1,1,0),t(104854,2,1,0),t(105027,0,1,0),
  t(105373,8,2,0),t(105547,5,4,0),t(105720,3,3,0),t(105893,1,3,0),
  t(105980,0,2,0),t(106153,2,1,0),t(106240,3,4,0),t(106586,7,3,0),
  t(106759,5,4,0),t(106933,8,1,0),t(107106,5,3,0),t(107279,3,3,0),
  t(107626,0,2,0),t(107799,1,4,0),t(107886,1,3,0),t(107972,1,4,0),
  t(108059,6,2,0),t(108145,4,1,0),t(108232,5,4,0),h(108319,6,4,108665,1),
  t(109098,0,2,0),t(109531,8,2,0),s(109705,110744,[[109705,3,4],[110051,2,2],[110398,1.5,2],[110744,1,4]]),t(111004,2,2,0),
  t(111091,0,1,0),f(111437,8,2),t(111784,6,2,0),t(111957,3,4,0),
  t(111957,9,1,0),t(112130,2,2,0),t(112304,0,3,0),t(112650,6,4,0),
  t(112823,5,3,0),t(112910,4,1,0),t(112997,2,1,0),t(113170,0,2,0),
  t(113516,6,4,0),t(113690,6,1,0),t(114296,8,2,0),t(114383,6,2,0),
  t(114469,3,2,0),t(114643,1,3,0),t(114729,0,3,0),t(114902,1,3,0),
  t(115076,3,4,0),t(115249,0,3,0),t(115422,1,4,0),t(115595,4,2,0),
  t(115942,7,3,0),t(116115,6,2,0),h(116289,8,1,116635,0,[[116289,8,1],[116462,7,3],[116635,6,4]]),t(116808,0,4,0),
  t(116808,6,1,0),t(116982,0,6,0),t(117328,4,1,0),t(117501,6,2,0),
  t(117848,6,4,0),t(117934,6,1,0),t(118194,3,4,0),t(118368,0,4,0),
  t(118541,1,3,0),s(118714,119754,[[118714,0,4],[119061,1,2],[119407,1.5,2],[119754,2,4]]),t(119234,8,2,0),t(119840,3,4,0),
  t(120014,1,3,0),t(120100,0,2,0),t(120100,5,1,0),t(120273,2,1,0),
  t(120360,4,2,0),t(120620,7,3,0),t(120793,5,3,0),t(120966,8,2,0),
  t(121140,5,3,0),t(121486,3,4,0),t(121573,2,2,0),t(121660,0,2,0),
  t(121746,2,2,0),t(121833,0,2,0),t(122093,3,4,0),t(122179,8,1,0),
  t(122266,4,2,0),t(122526,6,1,0),t(122699,6,4,0),t(123046,5,3,0),
  t(123219,3,2,0),t(123392,0,4,0),t(123565,2,1,0),t(123739,3,3,0),
  t(123912,7,3,0),t(123998,6,2,0),t(124258,7,3,0),t(124345,5,3,0),
  h(124605,3,4,124951),t(124778,8,2,0),t(125125,6,2,0),t(125211,4,1,0),
  t(125298,6,2,0),t(125471,8,1,0),t(125818,1,4,0),t(125904,1,2,0),
  t(125904,5,1,0),t(126164,1,4,0),t(126424,0,1,0),t(126511,2,3,0),
  t(126684,4,2,0),f(127030,7,3),t(127377,6,2,0),t(127550,8,1,0),
  h(128070,0,4,128417,0,[[128070,0,4],[128243,0,3],[128417,0,1]]),t(128590,1,4,0),s(128763,130842,[[128763,2,1],[129110,2,2],[129456,2.5,3],[129803,3,4],[130149,3,3],[130496,3.5,2],[130842,3.5,1]]),t(129803,8,2,4),
  t(131015,3,3,0),t(131362,1,3,0),t(131449,0,2,0),f(131882,5,3),
  t(132228,7,3,0),t(132661,0,2,0),t(132748,4,2,0),t(132835,0,1,0),
  t(133095,3,3,0),t(133441,5,3,0),t(133528,7,2,0),t(133701,6,1,0),
  t(133874,4,1,0),t(134134,1,3,0),t(134307,0,4,0),t(134481,2,2,0),
  t(135693,8,1,0),t(135780,5,1,0),t(136386,8,1,0),t(136560,3,3,0),
  t(136646,6,1,0),t(136906,0,3,0),t(136906,5,1,0),t(137079,3,4,0),
  t(137253,5,4,0),t(137426,6,4,0),t(137772,0,2,0),t(137859,4,2,0),
  f(138119,4,2),t(138465,6,2,0),t(138812,8,2,0),h(139159,0,2,139505,1),
  t(139852,2,1,0),t(139938,3,3,0),t(140025,6,2,0),t(140285,8,2,0),
  f(140545,6,1),s(140891,141584,[[140891,0,4],[141238,0.5,3],[141584,0,1]]),t(141238,8,2,0),t(141757,6,4,0),
  t(141931,5,4,0),t(142104,3,4,0),t(142450,1,3,0),t(142624,3,3,0),
  t(142797,6,3,0),t(142884,4,1,0),t(142970,1,3,0),t(142970,6,1,0),
  t(143143,3,3,0),t(143577,7,3,0),t(144010,5,3,0),t(144096,1,3,0),
  t(144183,6,1,0),t(144703,1,3,0),t(144963,0,1,0),t(145049,2,1,0),
  t(145136,4,1,0),t(145396,8,2,0),t(145656,6,2,0),t(145742,3,3,0),
  t(146002,1,3,0),t(146089,5,1,0),t(146349,1,3,0),t(146522,3,4,0),
  h(146782,8,1,147128),t(146955,0,2,0),t(147302,5,4,0),t(147388,5,4,0),
  t(147475,4,6,0),h(147821,1,1,148168,0,[[147821,1,1],[147995,0,4],[148168,1,1]]),t(147995,8,2,0),t(148341,6,4,0),
  t(148514,3,3,0),t(148601,3,4,0),t(148861,1,4,0),t(148948,1,4,0),
  t(149207,0,4,0),t(149207,6,1,0),t(149381,1,4,0),s(149554,150940,[[149554,0,1],[149900,0.5,2],[150247,1.5,3],[150594,2,3],[150940,1,4]],1),
// </monster-hero-v2-master-notes>
])(mhTap,mhHoldV2,mhFlick,mhSlideV2);
const monsterHeroV2Charts=Object.freeze({
  EASY:mhChart(1,monsterHeroV2EasyNotes,MONSTER_HERO_EASY_DURATION_MS),
  NORMAL:mhChart(3,monsterHeroV2NormalNotes,MONSTER_HERO_EASY_DURATION_MS),
  HARD:mhChart(5,monsterHeroV2HardNotes,MONSTER_HERO_EASY_DURATION_MS),
  EXPERT:mhChart(7,monsterHeroV2ExpertNotes,MONSTER_HERO_EASY_DURATION_MS),
  MASTER:mhChart(9,monsterHeroV2MasterNotes,MONSTER_HERO_EASY_DURATION_MS),
});

// 自動譜面制作V3が作った候補。V3は「音の種類・音の高さ・形の語彙」から組み立てる。
// マーカーの内側は tools/mode/rhythm-chart-v3-pipeline.js --release が差し替えるので手で書かない。
// v1(monsterHeroEasyNotes ほか)・V2(monsterHeroV2*Notes)には1音も触れていない。
const monsterHeroV3EasyNotes=((t,h,f,s)=>[
// <monster-hero-v3-easy-notes>
  t(2805,1,4,0),t(4018,0,3,0),t(4018,7,3,0),t(5404,1,4,0),
  h(5577,4,3,6443,0,[[5577,4,3],[5837,3,4],[6183,3,4],[6443,2,6]]),t(6790,5,4,0),t(6963,5,4,0),h(7483,5,4,8349),
  t(9215,6,4,0),t(10255,5,4,0),t(10601,5,4,0),t(11988,3,4,0),
  t(12334,5,4,0),t(12854,3,4,0),t(14413,0,10,0),t(15799,0,4,0),
  t(17878,1,4,0),t(18571,3,4,0),t(19264,5,4,0),t(20304,4,6,0),
  t(20997,4,6,0),t(21690,4,6,0),t(23423,4,6,0),t(24116,6,4,0),
  t(25502,4,6,0),t(26195,3,4,0),t(26888,0,6,0),t(28274,5,4,0),
  t(28967,2,6,0),t(29660,1,4,0),t(30353,0,4,0),t(31046,0,6,0),
  t(31392,2,6,0),t(32432,0,6,1),t(33125,3,4,0),t(33818,5,4,0),
  t(34511,4,6,0),t(35897,5,4,0),t(36937,4,6,0),t(37283,6,4,0),
  t(38323,5,4,0),t(38669,3,4,0),t(39362,1,4,0),t(40055,0,4,0),
  t(41268,0,6,0),h(42134,0,4,43520),t(44906,1,4,0),h(45253,2,6,45946),
  t(46466,1,4,0),t(47159,1,4,0),t(47505,0,6,0),t(47679,1,4,0),
  t(48025,2,6,0),t(48372,5,4,0),h(49065,4,6,50104,0,[[49065,4,6],[49411,6,4],[49758,6,4],[50104,7,3]]),t(50451,7,3,0),
  t(50451,0,3,0),t(50797,2,6,0),t(51144,1,4,0),t(51837,0,4,0),
  t(52703,0,6,0),t(53223,1,4,0),t(53569,2,6,0),t(53916,2,6,0),
  t(54609,5,4,0),t(54955,6,4,0),t(55648,5,4,0),t(55995,1,4,0),
  t(56688,0,10,0),t(57034,4,6,0),t(57554,6,4,0),t(57728,5,4,0),
  t(58421,5,4,0),t(59114,1,4,0),t(59460,3,4,0),t(59633,5,4,0),
  t(60153,6,4,0),t(60500,3,4,0),t(60846,5,4,0),t(61193,4,6,0),
  t(61539,4,6,2),t(62232,3,4,0),t(62752,1,4,0),t(62925,0,4,0),
  t(63618,1,4,0),t(64311,4,6,0),t(65004,5,4,0),t(65351,2,6,0),
  t(65697,1,4,0),t(65871,0,4,0),t(67083,0,4,0),t(67257,0,4,0),
  t(67776,0,6,0),t(68469,0,6,0),t(69336,1,4,0),t(69509,3,4,0),
  t(69856,5,4,0),t(70549,6,4,0),t(70895,5,4,0),t(71242,5,4,0),
  t(71935,6,4,0),t(72108,6,4,0),t(72628,3,4,0),t(72974,5,4,0),
  t(73667,6,4,0),t(74360,7,3,0),t(74360,0,3,0),t(74707,4,6,0),
  t(75400,5,4,0),t(75920,3,4,0),t(76093,1,4,0),t(76439,0,6,0),
  t(76613,0,10,0),t(76959,3,4,0),t(77825,4,6,0),t(78518,2,6,0),
  t(78865,0,6,0),t(79211,2,6,0),t(79385,5,4,0),t(79731,4,6,0),
  t(80944,4,6,0),t(81637,4,6,0),t(81810,2,6,0),t(82330,1,4,0),
  t(82850,0,6,0),t(83370,0,6,0),t(84063,0,6,0),t(84409,0,4,0),
  t(84929,1,4,0),t(85102,3,4,0),t(85622,5,4,0),t(86488,3,4,0),
  h(86835,6,3,87788,0,[[86835,6,3],[87181,5,4],[87441,5,4],[87788,6,3]]),t(87874,6,4,0),t(89260,2,6,0),t(89607,5,4,0),
  h(89953,2,6,90820),t(91339,5,4,3),t(92033,2,6,0),t(92726,0,6,0),
  h(93072,2,6,94458),t(95151,0,6,0),h(95844,1,4,96537),t(97923,5,4,0),
  t(98270,3,4,0),t(98616,0,6,0),t(98790,0,4,0),t(99309,1,4,0),
  t(100002,0,6,0),t(101215,0,6,0),t(101562,1,4,0),t(102081,3,4,0),
  t(102601,5,4,0),t(103121,7,3,0),t(103121,0,3,0),t(103468,5,4,0),
  h(103814,4,6,104854,0,[[103814,4,6],[104161,5,4],[104507,5,4],[104854,4,6]]),t(105547,6,4,0),t(105893,5,4,0),t(106240,3,4,0),
  t(106586,1,4,0),t(107106,0,4,0),t(107972,0,10,0),t(108492,3,4,0),
  t(108665,5,4,0),t(109358,3,4,0),t(109532,1,4,0),t(110051,3,4,0),
  t(110398,5,4,0),t(110744,3,4,0),t(110918,5,4,0),t(111437,3,4,0),
  t(112130,5,4,0),t(112823,6,4,0),t(113170,5,4,0),t(113516,2,6,0),
  t(113690,1,4,0),t(114210,0,4,0),t(114903,0,4,0),t(115076,0,4,0),
  t(115596,0,4,0),t(116289,0,6,0),t(116808,0,6,0),t(116982,1,4,0),
  t(118194,0,6,0),t(118368,0,6,0),t(118887,0,4,0),t(119061,1,4,0),
  t(119407,0,4,0),t(119754,1,4,0),t(120100,3,4,4),t(120447,5,4,0),
  t(120620,2,6,0),t(121140,2,6,0),t(121486,5,4,0),t(121833,5,4,0),
  t(122526,6,4,0),t(123219,5,4,0),t(123392,2,6,0),t(123912,1,4,0),
  t(124258,0,6,0),t(124605,0,3,0),t(124605,7,3,0),t(125125,0,4,0),
  t(125298,0,4,0),t(125818,0,6,0),t(125991,1,4,0),t(126338,0,10,0),
  t(126511,5,4,0),h(127031,4,6,128417),t(128763,5,4,0),t(129283,5,4,0),
  t(129456,6,4,0),t(129803,6,4,0),t(130149,5,4,0),t(130496,6,4,0),
  t(130669,5,4,0),h(131189,6,4,132315),t(132748,6,4,0),t(133095,5,4,0),
  t(133614,3,4,0),t(134134,1,4,0),h(134307,0,6,135693),t(136040,1,4,0),
  t(136213,1,4,0),t(137253,0,4,0),h(137426,0,4,138206),t(138466,1,4,0),
  t(139159,3,4,0),t(139505,5,4,0),t(139852,3,4,0),t(140198,5,4,0),
  t(140545,6,4,0),t(141064,5,4,0),t(141238,3,4,0),t(141931,1,4,0),
  t(142277,0,6,0),t(142450,1,4,0),t(143144,3,4,0),t(143317,1,4,0),
  t(143837,0,4,0),t(144010,1,4,0),t(144356,3,4,0),t(144703,4,6,0),
  t(145396,3,4,0),t(145742,1,4,0),t(146089,0,6,0),t(146782,0,6,0),
  t(147128,3,4,0),t(147475,4,6,0),t(148168,2,6,0),t(148861,0,3,0),
  t(148861,7,3,0),t(149208,0,6,0),t(149554,0,10,0),t(149727,0,4,0),
// </monster-hero-v3-easy-notes>
])(mhTap,mhHoldV2,mhFlick,mhSlideV2);
const monsterHeroV3NormalNotes=((t,h,f,s)=>[
// <monster-hero-v3-normal-notes>
  f(2805,1,4),t(4018,0,3,0),t(4018,7,3,0),t(5404,1,4,0),
  h(5577,4,2,6443,1,[[5577,4,2],[5837,4,3],[6183,3,4],[6443,2,6]]),t(6790,5,4,0),t(6963,5,4,0),h(7483,5,4,8349),
  t(9215,3,4,0),t(9562,5,4,0),t(10255,3,4,0),t(11468,1,4,0),
  t(11988,3,4,0),t(12334,5,4,0),t(12854,6,4,0),t(14413,0,10,0),
  t(15799,6,4,0),t(17185,3,4,0),t(17878,6,4,0),t(18571,5,4,0),
  t(19957,1,4,0),t(20304,4,6,0),t(20997,2,6,0),t(21690,4,6,0),
  f(23423,2,6),t(24116,5,4,0),t(24635,3,4,0),t(25502,0,6,0),
  t(26541,0,6,0),t(26888,0,6,0),t(28274,1,4,0),t(28967,2,6,0),
  t(29660,5,4,0),t(30353,6,4,0),t(31046,4,6,0),t(31392,2,6,0),
  t(32432,4,6,1),t(32778,4,6,0),t(33125,3,4,0),t(33818,1,4,0),
  t(34511,0,6,0),t(35897,5,4,0),t(36590,1,3,0),t(36937,2,6,0),
  t(37283,0,3,0),t(37283,7,3,0),t(38323,5,3,0),f(38669,3,4),
  t(39362,1,4,0),t(40055,0,4,0),t(40575,1,4,0),t(41268,2,6,0),
  h(42134,1,4,43520),t(43867,0,6,0),t(44906,1,4,0),h(45253,0,6,45946),
  t(46466,0,4,0),t(47159,1,3,0),t(47505,0,6,0),t(47679,1,4,0),
  t(48025,2,6,0),t(48372,5,4,0),t(48545,3,4,0),h(49065,4,6,50104,0,[[49065,4,6],[49411,6,4],[49758,7,3],[50104,7,2]]),
  t(50451,1,4,0),t(50797,4,6,0),t(51144,3,4,0),t(51837,6,4,0),
  t(52530,5,4,0),f(52703,4,6),t(53223,6,4,0),t(53569,4,6,0),
  t(53916,4,6,0),t(54609,5,4,0),t(54955,3,3,0),t(55648,3,3,0),
  t(55995,5,4,0),t(56688,0,10,0),t(56861,3,4,0),t(57034,0,6,0),
  t(57554,1,4,0),t(57728,3,4,0),t(58247,1,4,0),t(58421,3,4,0),
  t(59114,0,3,0),t(59114,7,3,0),t(59460,0,4,0),t(59633,3,4,0),
  t(60153,0,4,0),t(60326,3,3,0),t(60500,1,3,0),t(60846,3,4,0),
  f(61193,4,6),t(61539,4,6,2),t(62232,5,4,0),t(62752,3,4,0),
  t(62925,1,4,0),t(63618,0,4,0),t(64311,4,6,0),t(65004,1,4,0),
  t(65178,2,6,0),t(65351,0,6,0),t(65697,1,4,0),t(67083,3,4,0),
  t(67257,1,4,0),t(67603,0,4,0),t(67776,0,6,0),t(68469,2,6,0),
  h(68989,6,4,69769),t(69856,3,4,0),t(70549,5,4,0),t(70895,7,3,0),
  t(71242,5,4,0),f(71588,7,3),t(71935,6,4,0),t(72108,6,4,0),
  t(72628,6,4,0),t(72974,1,3,0),t(73667,3,3,0),t(74360,5,3,0),
  t(74707,4,6,0),t(75400,5,4,0),t(75920,6,4,0),t(76093,5,4,0),
  t(76439,4,6,0),t(76613,2,6,0),t(76959,5,4,0),t(77479,7,3,0),
  t(77479,0,3,0),t(77825,4,6,0),t(78518,0,10,0),t(78692,1,4,0),
  t(78865,0,6,0),t(79385,1,4,0),t(79731,2,6,0),t(80944,0,6,0),
  f(81291,0,3),t(81637,0,6,0),t(81810,0,6,0),t(82330,0,4,0),
  t(82850,0,6,0),t(83196,3,4,0),t(83370,4,6,0),t(84063,4,6,0),
  t(84409,3,4,0),h(84929,7,2,85622,1,[[84929,7,2],[85275,4,6],[85622,7,2]]),t(86488,5,4,0),h(86835,5,4,87788),
  t(87874,6,4,0),t(88221,6,4,0),t(89260,2,6,0),t(89607,5,4,0),
  h(89953,2,6,90820),t(90993,6,4,3),t(91339,5,4,0),t(92033,2,6,0),
  t(92726,0,6,0),h(93072,0,6,94458),f(94805,1,4),t(95151,0,6,0),
  h(95844,1,4,96537),t(97577,5,4,0),t(97923,1,3,0),t(98270,3,3,0),
  t(98616,0,6,0),t(98790,0,4,0),t(99309,0,3,0),t(99309,7,3,0),
  t(100002,4,6,0),t(101215,0,6,0),t(101562,1,4,0),t(102081,3,4,0),
  t(102601,5,4,0),t(102948,7,3,0),t(103121,3,4,0),t(103468,1,4,0),
  h(103814,2,6,104854,0,[[103814,2,6],[104161,4,3],[104507,4,3],[104854,2,6]]),t(105547,1,4,0),t(105893,5,4,0),t(106240,1,4,0),
  t(106586,5,4,0),f(107106,1,4),t(107972,0,10,0),t(108492,1,4,0),
  t(108665,0,3,0),t(109358,1,3,0),t(109532,1,4,0),t(110051,5,4,0),
  t(110398,3,3,0),t(110744,1,4,0),t(110918,3,4,0),t(111091,5,3,0),
  t(111437,3,4,0),t(112130,1,4,0),t(112823,5,4,0),t(113170,1,3,0),
  t(113516,2,6,0),t(113690,5,4,0),t(114210,6,4,0),t(114903,5,4,0),
  t(115076,3,4,0),t(115249,0,6,0),t(115596,3,4,0),f(115942,1,3),
  t(116289,4,6,0),t(116808,1,6,0),t(116982,7,3,0),t(116982,0,3,0),
  t(117155,4,6,0),t(118194,4,6,0),t(118368,4,6,0),t(118714,3,3,0),
  t(118887,1,4,0),t(119061,3,4,0),t(119407,1,3,0),t(119580,0,4,0),
  t(119754,1,4,0),t(120100,0,4,4),t(120447,1,4,0),t(120620,2,6,0),
  t(120793,5,3,0),t(121140,4,6,0),t(121486,7,3,0),t(121833,6,4,0),
  t(122526,6,4,0),t(123219,1,4,0),t(123392,4,6,0),f(123565,2,6),
  t(123912,6,4,0),t(124258,4,6,0),t(124605,5,4,0),t(124778,6,4,0),
  t(125125,6,4,0),t(125298,5,4,0),t(125818,4,6,0),t(125991,5,4,0),
  t(126164,6,4,0),t(126511,6,4,0),t(126684,0,10,0),h(127031,4,6,128417),
  t(128763,3,4,0),t(129283,5,4,0),t(129456,3,4,0),t(129629,1,4,0),
  t(130149,0,4,0),t(130496,1,4,0),t(130669,2,4,0),t(130842,0,3,0),
  t(130842,7,3,0),h(131189,0,4,132315),f(132748,1,4),t(133095,3,4,0),
  t(133614,5,4,0),t(133961,7,3,0),t(134134,5,4,0),h(134307,4,6,135693,1),
  t(136040,5,4,0),t(136213,1,4,0),t(136386,3,4,0),t(137080,0,3,0),
  t(137253,0,4,0),h(137426,0,3,138206),t(138466,1,4,0),t(139159,3,4,0),
  t(139505,5,3,0),t(139678,3,4,0),t(139852,6,4,0),t(140198,5,3,0),
  t(140545,6,4,0),t(141064,5,4,0),f(141238,3,4),t(141931,1,4,0),
  t(142104,0,4,0),t(142277,4,6,0),t(142624,1,4,0),t(143144,3,4,0),
  t(143317,0,4,0),t(143837,1,4,0),t(144010,5,4,0),t(144183,3,4,0),
  t(144703,4,6,0),t(145049,1,3,0),t(145396,3,4,0),t(145742,5,3,0),
  t(146089,4,6,0),t(146609,5,4,0),t(146782,4,6,0),t(147128,5,4,0),
  t(147475,4,6,0),t(148168,4,6,0),t(148861,0,3,0),t(148861,7,3,0),
  t(149208,0,6,0),t(149381,0,3,0),f(149554,0,6),t(149901,0,10,0),
// </monster-hero-v3-normal-notes>
])(mhTap,mhHoldV2,mhFlick,mhSlideV2);
const monsterHeroV3HardNotes=((t,h,f,s)=>[
// <monster-hero-v3-hard-notes>
  t(2718,1,4,0),f(2805,3,4),t(3931,1,4,0),t(4018,5,4,0),
  t(4537,0,4,0),t(4537,7,3,0),t(5404,0,4,0),h(5577,2,1,6443,0,[[5577,2,1],[5837,1,2],[6183,0,4],[6443,0,5]]),
  t(6617,1,3,0),t(6790,1,4,0),t(6963,3,4,0),h(7483,3,4,8349,1),
  t(8869,0,4,0),t(9215,1,4,0),t(9562,3,4,0),t(10255,5,4,0),
  t(10601,6,4,0),t(11468,3,4,0),t(11988,5,4,0),t(12334,6,4,0),
  t(12854,5,4,0),s(13547,14067,[[13547,2,3],[13720,3.5,3],[13893,3.5,3],[14067,4,3]]),t(14326,5,4,0),t(14413,2,8,0),
  t(15799,6,4,0),t(16492,5,4,0),t(16665,3,4,0),s(17185,17705,[[17185,1,3],[17359,1,3],[17532,0.5,3],[17705,2.5,3]]),
  f(17878,0,4),t(18571,6,4,0),t(19264,3,3,0),t(19957,5,4,0),
  t(20304,0,5,0),t(20997,2,5,0),t(21690,0,5,0),t(23076,2,5,0),
  t(23423,4,5,0),t(24116,3,4,0),t(24289,1,4,0),t(24635,3,4,0),
  t(25502,5,5,0),t(26195,5,4,0),t(26541,2,5,0),t(26888,0,5,0),
  t(27061,0,5,0),t(28274,1,4,0),t(28967,2,5,0),t(29313,0,5,0),
  t(29660,3,4,0),t(30006,1,3,0),t(30353,0,4,0),t(30353,7,3,0),
  f(31046,0,5),t(31392,2,5,1),h(32432,4,5,32778),t(33125,3,4,0),
  t(33298,1,4,0),t(33471,0,3,0),t(33818,1,4,0),t(34511,2,5,0),
  t(35204,1,4,0),t(35897,3,4,0),t(36590,5,3,0),t(36937,2,5,0),
  t(37283,1,4,0),t(38149,0,4,0),h(38323,3,3,38842),t(39016,0,5,0),
  t(39362,5,4,0),t(40055,3,4,0),t(40575,6,4,0),t(40922,3,4,0),
  t(41268,5,5,0),s(42134,43520,[[42134,0,3],[42394,1.5,3],[42654,2.5,3],[42914,3,3],[43174,4,3],[43434,4,3],[43520,3.5,3]]),t(43867,2,5,0),f(44560,3,3),
  t(44906,5,4,0),h(45253,4,5,45946,0,[[45253,4,5],[45599,5,3],[45946,6,1]]),t(46466,3,4,0),t(47159,5,3,0),
  t(47505,0,5,0),t(47679,3,4,0),t(47852,5,4,0),t(48025,5,5,0),
  t(48372,5,4,0),t(48545,3,4,0),t(48718,1,3,0),h(49065,5,4,50104,1),
  t(50451,0,4,0),t(50797,2,5,0),t(51144,1,4,0),t(51317,5,4,0),
  t(51837,3,4,0),t(52530,6,4,0),t(52703,2,8,0),t(52876,7,3,0),
  t(52876,1,3,0),t(53223,6,4,0),t(53569,4,5,0),t(53916,2,5,0),
  f(54089,0,5),s(54609,55302,[[54609,1,3],[54782,1,3],[54955,0,3],[55129,0,3],[55302,0,3]]),t(55475,0,4,0),t(55648,5,3,0),
  t(55822,1,4,0),t(55995,5,4,0),t(56341,1,4,0),t(56688,4,5,0),
  t(56861,3,4,0),t(57034,0,5,0),t(57554,3,4,0),t(57728,0,4,0),
  t(57901,3,4,0),t(58247,0,4,0),t(58421,1,4,0),t(58594,3,4,0),
  t(58767,5,3,0),t(59114,5,3,0),s(59460,59980,[[59460,3,3],[59633,3.5,3],[59807,3.5,3],[59980,2,3]]),t(60153,5,4,0),
  t(60326,3,3,0),t(60500,1,3,0),s(60846,61366,[[60846,2,3],[61019,3,3],[61193,3,3],[61366,4,3]]),f(61539,4,5),
  t(61886,1,3,0),t(62232,3,4,2),t(62752,5,4,0),t(62925,6,4,0),
  t(63445,4,5,0),t(63618,3,4,0),t(63792,0,4,0),t(64311,2,5,0),
  t(64658,0,5,0),t(65004,5,4,0),t(65178,2,5,0),t(65351,5,5,0),
  t(65697,5,4,0),t(65871,6,4,0),h(66737,6,4,67343),t(67430,3,3,0),
  t(67603,6,4,0),t(67603,0,3,0),t(67776,0,5,0),t(68469,2,5,0),
  h(68989,2,1,69769,0,[[68989,2,1],[69422,0,5],[69769,2,1]]),f(69856,1,4),t(70375,3,4,0),t(70549,1,4,0),
  t(70722,0,4,0),t(70895,1,3,0),t(71242,3,4,0),t(71588,1,3,0),
  t(71761,1,4,0),t(71935,3,4,0),t(72108,3,4,0),t(72628,5,4,0),
  t(72974,5,3,0),t(73321,1,4,0),t(73667,3,3,0),t(73840,5,4,0),
  t(74360,7,3,0),t(74534,5,4,0),t(74707,1,8,0),t(75227,5,3,0),
  t(75400,3,4,0),t(75920,1,4,0),t(76093,0,4,0),t(76439,0,5,0),
  t(76613,2,5,0),t(76959,1,4,0),f(77132,5,3),t(77479,1,4,0),
  t(77825,4,5,0),t(78172,1,4,0),t(78518,4,5,0),t(78692,6,4,0),
  s(78865,79471,[[78865,3,3],[79038,4,3],[79211,4,3],[79385,4,3],[79471,4,3]]),t(79731,2,5,0),t(80251,0,4,0),t(80944,2,5,0),
  t(81291,0,3,0),t(81464,3,4,0),t(81637,0,5,0),t(81810,0,5,0),
  t(82157,0,4,0),t(82157,7,3,0),t(82330,5,4,0),t(82850,5,5,0),
  t(83196,5,4,0),s(83370,84149,[[83370,2,3],[83543,2,3],[83716,1.5,3],[83889,1.5,3],[84063,0,3],[84149,0,3]]),t(84236,4,5,0),t(84409,3,4,0),
  h(84929,1,4,85622,1),t(85969,5,4,0),f(86142,1,3),t(86488,3,4,0),
  t(86835,0,4,0),h(87008,0,5,87788),t(87874,0,4,0),t(88221,3,4,0),
  t(88567,0,4,0),t(88914,3,4,0),t(89260,0,5,0),t(89607,3,4,0),
  h(89953,0,5,90820),t(90993,1,4,0),t(91339,3,4,0),t(91513,5,4,0),
  t(91686,5,5,0),t(92033,4,5,3),t(92379,2,5,0),t(92726,4,5,0),
  s(93072,94458,[[93072,4,3],[93332,3,3],[93592,1.5,3],[93852,1,3],[94112,1,3],[94372,0.5,3],[94458,0,3]]),t(94805,6,4,0),t(95151,5,5,0),h(95844,5,5,96537,0,[[95844,5,5],[96191,8,1],[96537,5,5]]),
  t(96884,0,4,0),t(97230,3,4,0),f(97577,1,4),t(97923,5,3,0),
  t(98270,3,3,0),t(98443,7,3,0),t(98616,0,8,0),t(98790,3,4,0),
  t(99309,5,4,0),t(99829,6,4,0),t(100002,4,5,0),t(100176,3,4,0),
  t(100349,0,4,0),t(100349,7,3,0),t(101215,4,5,0),t(101562,3,4,0),
  t(101908,1,3,0),t(102081,0,4,0),t(102601,1,4,0),t(102948,3,3,0),
  t(103121,5,4,0),t(103468,3,4,0),t(103641,1,4,0),s(103814,104854,[[103814,1,3],[103987,1,3],[104161,2,3],[104334,2,3],[104507,2,3],[104680,3,3],[104854,3,3]],1),
  t(105200,1,4,0),t(105547,5,4,0),f(105893,3,4),t(106240,6,4,0),
  t(106586,5,4,0),t(106759,1,4,0),t(107019,3,3,0),t(107106,1,4,0),
  t(107972,4,5,0),t(108492,1,4,0),t(108665,3,3,0),t(109098,0,5,0),
  t(109358,5,3,0),t(109445,1,4,0),t(110051,3,4,0),t(110225,0,4,0),
  t(110398,0,3,0),h(110571,1,3,111264),t(111437,0,4,0),t(111611,1,3,0),
  t(112130,3,4,0),t(112304,5,4,0),t(112477,2,5,0),t(112823,6,4,0),
  t(113170,5,3,0),t(113516,5,5,0),f(113690,5,4),t(114210,3,4,0),
  t(114383,5,4,0),t(114729,5,3,0),t(114903,5,4,0),t(115076,6,4,0),
  t(115249,5,5,0),t(115596,6,4,0),t(115596,0,3,0),t(115942,3,3,0),
  t(116289,0,5,0),t(116462,0,4,0),t(116808,0,5,0),t(116982,1,4,0),
  t(117155,2,5,0),t(117501,6,4,0),t(117848,3,4,0),t(118194,2,8,0),
  f(118368,5,5),t(118714,5,3,0),t(118887,6,4,0),t(119061,6,4,0),
  t(119234,5,4,0),t(119407,5,3,0),t(119580,6,4,0),t(119754,3,4,0),
  t(119927,5,4,0),t(120100,1,4,0),t(120187,5,3,0),t(120447,3,4,0),
  t(120620,0,5,0),t(120793,0,3,0),t(120967,1,3,0),t(121140,2,5,0),
  t(121486,5,3,4),t(121833,6,4,0),t(122006,0,4,0),t(122179,3,3,0),
  t(122526,1,4,0),t(122699,5,3,0),t(123219,3,4,0),h(123392,5,5,124085),
  t(124258,4,5,0),t(124432,5,4,0),t(124605,6,4,0),f(124778,6,4),
  t(125125,5,4,0),t(125298,6,4,0),t(125385,5,4,0),t(125645,7,3,0),
  t(125818,4,5,0),t(125991,3,4,0),t(126164,6,4,0),t(126164,0,3,0),
  t(126338,5,5,0),t(126511,6,4,0),t(126684,5,5,0),t(127031,2,8,0),
  h(127204,6,4,128417,1),t(128763,5,4,0),t(128936,6,4,0),t(129283,5,4,0),
  t(129456,3,4,0),t(129629,5,4,0),t(129803,6,4,0),t(129976,1,4,0),
  t(130149,3,4,0),t(130322,5,4,0),t(130496,6,4,0),t(130669,5,4,0),
  t(130842,3,4,0),t(131015,1,4,0),t(131189,5,4,0),h(131362,3,4,132315),
  t(132402,2,4,0),t(132575,3,4,0),f(132748,1,4),t(133095,5,4,0),
  t(133441,3,4,0),t(133614,6,4,0),t(133961,3,3,0),t(134134,5,4,0),
  h(134307,5,5,135693),t(135867,6,4,0),t(136040,6,4,0),t(136213,6,4,0),
  t(136386,6,4,0),t(136473,5,4,0),t(137080,5,3,0),t(137253,6,4,0),
  h(137426,8,1,138206,0,[[137426,8,1],[137859,7,3],[138206,5,5]]),t(138466,3,4,0),t(138639,5,4,0),f(139159,6,4),
  t(139505,5,3,0),t(139678,6,4,0),t(139852,5,4,0),t(140025,3,4,0),
  t(140198,1,3,0),t(140371,0,4,0),t(140545,3,4,0),t(140718,1,4,0),
  t(141064,5,4,0),t(141238,1,4,0),t(141411,4,1,0),t(141757,5,4,0),
  t(141931,6,4,0),t(142104,3,4,0),t(142277,4,5,0),t(142450,6,4,0),
  t(142624,5,4,0),t(142797,6,4,0),t(143144,5,4,0),t(143230,3,4,0),
  t(143837,1,4,0),t(144010,5,4,0),t(144183,1,4,0),t(144270,3,4,0),
  t(144530,0,4,0),f(144703,0,5),t(145049,1,3,0),t(145396,3,4,0),
  t(145569,5,4,0),t(145742,7,3,0),t(145916,3,4,0),t(146089,4,5,0),
  t(146609,6,4,0),t(146782,4,5,0),t(147128,3,4,0),t(147302,5,4,0),
  t(147475,2,5,0),t(147821,1,4,0),t(148168,0,5,0),t(148861,3,4,0),
  t(149034,1,4,0),t(149208,4,5,0),t(149381,0,3,0),t(149554,0,5,0),
  t(149727,3,4,0),t(149901,2,8,0),t(150247,6,4,0),t(150247,0,3,0),
  f(151547,5,4),
// </monster-hero-v3-hard-notes>
])(mhTap,mhHoldV2,mhFlick,mhSlideV2);
const monsterHeroV3ExpertNotes=((t,h,f,s)=>[
// <monster-hero-v3-expert-notes>
  t(2718,1,4,0),t(2805,3,4,0),f(2891,1,3),t(3931,0,4,0),
  t(4018,3,4,0),t(4537,0,4,0),t(4537,7,3,0),t(5404,1,4,0),
  h(5577,3,1,6443,0,[[5577,3,1],[5837,2,2],[6183,1,4],[6443,1,5]]),t(6617,0,2,0),t(6617,4,2,0),t(6790,2,2,0),
  t(6790,6,2,0),t(6963,4,2,0),t(6963,8,2,0),h(7483,5,4,8349,1),
  t(8003,6,4,0),t(8869,1,4,0),t(9215,5,4,0),t(9562,3,4,0),
  t(10255,6,4,0),t(10601,5,4,0),t(11468,3,4,0),t(11814,5,4,0),
  t(11988,3,4,0),t(12334,1,4,0),t(12854,3,4,0),s(13460,14067,[[13460,0.5,3],[13720,2,3],[13980,3.5,3],[14067,3.5,3]]),
  t(14326,3,4,0),t(14413,2,8,0),f(15799,6,4),t(16492,3,4,0),
  t(16665,5,4,0),s(17185,17705,[[17185,1.5,3],[17359,1,3],[17532,0.5,3],[17705,3,3]]),t(17878,1,2,0),t(17878,5,2,0),
  t(18571,3,2,0),t(18571,7,2,0),t(19264,1,2,0),t(19264,5,2,0),
  t(19957,1,4,0),t(20304,5,5,0),t(20997,0,5,0),t(21690,5,5,0),
  t(22036,1,4,0),t(23076,2,5,0),t(23423,4,5,0),t(24116,3,4,0),
  t(24289,1,4,0),t(24635,3,4,0),t(25155,5,3,0),t(25502,5,5,0),
  t(26195,0,2,0),t(26195,4,2,0),t(26541,2,2,0),t(26541,6,2,0),
  t(26888,4,2,0),t(26888,8,2,0),f(28274,3,4),t(28620,1,3,0),
  t(28620,7,3,0),t(28967,1,2,0),t(28967,5,2,0),t(29313,3,2,0),
  t(29313,7,2,0),t(29660,1,2,0),t(29660,5,2,0),t(30006,7,3,0),
  t(30353,3,4,0),t(31046,5,5,0),t(31392,4,5,0),t(31739,6,4,1),
  h(32432,4,5,32778),t(33125,5,4,0),t(33298,3,4,0),t(33471,3,3,0),
  t(33818,1,4,0),t(34511,0,5,0),t(35204,3,4,0),t(35897,3,4,0),
  t(36590,1,3,0),t(36937,0,5,0),t(37283,0,4,0),f(37456,0,4),
  t(38149,1,4,0),h(38323,2,5,38842,0,[[38323,2,5],[38583,3,3],[38842,4,1]]),t(39016,4,5,0),t(39362,6,4,0),
  t(40055,5,4,0),t(40575,3,4,0),t(40922,5,4,0),t(41268,2,5,0),
  t(41615,1,4,0),s(42134,43520,[[42134,0,3],[42394,1.5,3],[42654,2.5,3],[42914,3,3],[43174,4,3],[43434,4,3],[43520,3.5,3]]),t(42827,1,4,0),t(43001,2,5,0),
  t(43174,0,3,0),t(43867,2,5,0),t(44213,1,4,0),t(44560,5,3,0),
  t(44906,3,4,0),h(45253,5,5,45946,1),t(46466,5,4,0),t(47159,7,3,0),
  t(47159,1,3,0),t(47505,0,5,0),t(47679,3,4,0),t(47852,5,4,0),
  f(48025,5,5),t(48372,3,4,0),t(48545,6,4,0),t(48718,5,3,0),
  h(49065,5,4,50104,1),t(49411,3,3,0),t(49758,5,4,0),t(50451,1,4,0),
  t(50797,5,5,0),t(51144,5,4,0),t(51317,5,4,0),t(51490,7,3,0),
  t(51837,6,4,0),t(52530,3,4,0),t(52703,2,8,0),t(52876,7,3,0),
  t(53223,5,4,0),t(53569,2,5,0),t(53916,0,5,0),t(54089,2,5,0),
  s(54609,55302,[[54609,4,3],[54869,2,3],[55129,0.5,3],[55302,0,3]]),f(54955,5,3),t(55475,3,4,0),t(55648,5,3,0),
  t(55995,3,4,0),t(56341,1,4,0),t(56688,0,5,0),t(56861,1,4,0),
  t(57034,3,5,0),t(57208,3,4,0),t(57554,6,4,0),t(57728,3,4,0),
  t(57901,6,4,0),t(58247,3,4,0),t(58421,6,4,0),t(58594,3,4,0),
  t(58767,1,3,0),t(59114,3,3,0),t(59287,6,3,0),t(59287,0,3,0),
  s(59460,59980,[[59460,3,3],[59633,3,3],[59807,3,3],[59980,1.5,3]]),t(60153,4,4,0),t(60326,5,3,0),t(60500,5,3,0),
  s(60846,61366,[[60846,3,3],[61019,4,3],[61193,4,3],[61366,4,3]]),f(61539,2,5),t(61886,5,3,2),t(62232,1,4,0),
  t(62405,0,4,0),t(62752,1,4,0),t(62925,3,4,0),t(63099,1,4,0),
  t(63445,0,5,0),t(63618,0,4,0),t(63792,1,4,0),t(64311,0,5,0),
  t(64658,0,5,0),t(65004,3,4,0),t(65178,0,5,0),t(65351,4,5,0),
  t(65697,6,4,0),t(65871,5,4,0),t(66217,3,4,0),h(66737,3,1,67343,0,[[66737,3,1],[67083,1,5],[67343,3,1]]),
  t(67430,5,3,0),t(67603,1,4,0),t(67776,2,5,0),f(68469,0,5),
  h(68989,1,4,69769),t(69336,1,4,0),t(69422,0,4,0),t(69856,0,4,0),
  t(70375,1,4,0),t(70549,1,4,0),t(70722,0,4,0),t(70895,0,3,0),
  h(71242,1,4,71675),t(71761,2,4,0),t(71935,5,4,0),t(72108,6,4,0),
  t(72628,3,4,0),t(72974,5,3,0),t(73321,6,4,0),t(73321,0,3,0),
  t(73494,5,4,0),t(73667,1,3,0),t(73840,3,4,0),t(74360,5,3,0),
  t(74534,6,4,0),t(74707,2,8,0),t(75227,1,3,0),f(75400,3,4),
  t(75920,0,4,0),t(76093,1,4,0),t(76439,4,5,0),t(76613,2,5,0),
  t(76959,6,4,0),t(77132,3,3,0),t(77479,5,4,0),t(77652,1,4,0),
  t(77825,2,5,0),t(78172,5,4,0),t(78518,2,5,0),t(78692,1,4,0),
  s(78865,79471,[[78865,0,3],[79125,2,3],[79385,4,3],[79471,4,3]]),t(79731,0,5,0),t(80251,3,4,0),h(80944,4,5,81464),
  t(81637,5,5,0),t(81810,4,5,0),t(82157,3,4,0),t(82330,0,4,0),
  f(82503,3,4),t(82850,0,5,0),t(83196,5,4,0),s(83370,84149,[[83370,2,3],[83543,2,3],[83716,1.5,3],[83889,1.5,3],[84063,0,3],[84149,0,3]]),
  t(83716,6,4,0),t(84236,4,5,0),t(84409,3,4,0),h(84929,1,5,85622,1,[[84929,1,5],[85275,3,1],[85622,1,5]]),
  t(85275,0,4,0),t(85969,1,4,0),t(86142,3,3,0),t(86488,1,4,0),
  t(86835,0,4,0),t(86835,7,3,0),h(87008,4,5,87788),t(87874,3,4,0),
  t(88221,3,4,0),t(88567,5,4,0),t(88914,5,4,0),t(89260,5,5,0),
  t(89607,6,4,0),t(89780,2,5,0),h(89953,5,5,90820),f(90300,3,4),
  t(90993,6,4,0),t(91339,3,4,0),t(91513,6,4,0),t(91686,4,5,0),
  t(91859,2,5,0),t(92033,0,5,0),t(92379,0,5,3),t(92726,0,5,0),
  s(93072,94458,[[93072,2,3],[93332,1.5,3],[93592,0.5,3],[93852,0.5,3],[94112,0.5,3],[94372,0,3],[94458,0,3]],1),t(93419,3,4,0),t(93765,3,4,0),t(94112,1,4,0),
  t(94805,1,4,0),t(95151,0,5,0),h(95498,0,4,96537,1),t(95844,0,4,0),
  t(96191,1,4,0),t(96884,0,4,0),t(97057,3,4,0),t(97230,1,4,0),
  t(97577,5,4,0),f(97923,3,3),t(98270,7,3,0),t(98443,5,3,0),
  t(98616,1,8,0),t(98790,1,4,0),t(99309,0,4,0),t(99829,1,4,0),
  t(100002,2,5,0),t(100176,1,4,0),t(100349,5,4,0),t(101215,2,5,0),
  t(101562,6,4,0),t(101562,0,3,0),t(101908,7,3,0),t(102081,5,4,0),
  t(102601,3,4,0),t(102948,5,3,0),t(103121,3,4,0),t(103468,1,4,0),
  t(103641,0,4,0),s(103814,104854,[[103814,1.5,3],[103987,1,3],[104161,2.5,3],[104334,2.5,3],[104507,3,3],[104680,3.5,3],[104854,3.5,3]],1),t(104161,0,4,0),f(104507,1,4),
  t(105200,3,4,0),t(105373,5,4,0),t(105547,6,4,0),t(105720,5,4,0),
  t(105893,3,4,0),t(106240,1,4,0),t(106586,0,4,0),t(106759,1,4,0),
  t(107019,3,3,0),t(107106,1,4,0),t(107193,0,4,0),t(107972,0,5,0),
  t(108492,3,4,0),t(108665,1,3,0),t(109098,0,5,0),t(109358,1,3,0),
  t(109445,0,4,0),s(109532,110138,[[109532,1.5,3],[109705,0,3],[109878,0,3],[110051,0.5,3],[110138,1,3]]),t(110225,3,4,0),t(110398,1,3,0),
  h(110571,5,3,111264),t(110918,3,4,0),t(111437,6,4,0),f(111611,5,3),
  t(112130,3,4,0),t(112304,1,4,0),t(112477,0,5,0),t(112650,1,4,0),
  t(112823,5,4,0),t(113170,7,3,0),t(113516,2,5,0),t(113690,6,4,0),
  t(113690,0,3,0),t(114210,1,4,0),t(114383,0,4,0),t(114729,1,3,0),
  t(114903,3,4,0),t(115076,5,4,0),t(115249,5,5,0),t(115422,5,4,0),
  t(115596,3,4,0),t(115942,5,3,4),t(116289,0,5,0),t(116462,3,4,0),
  t(116808,4,5,0),t(116982,6,4,0),f(117155,4,5),t(117501,6,4,0),
  t(117848,1,4,0),t(118194,4,5,0),t(118281,3,4,0),t(118368,2,8,0),
  t(118714,5,3,0),t(118887,1,4,0),t(119061,3,4,0),t(119234,0,4,0),
  t(119407,0,3,0),t(119580,0,4,0),t(119754,0,4,0),t(119927,0,4,0),
  t(120100,1,4,0),t(120187,3,3,0),t(120360,5,3,0),t(120447,6,4,0),
  t(120620,4,5,0),t(120793,3,3,0),t(120967,1,3,0),f(121140,0,5),
  t(121486,0,3,0),t(121660,1,3,0),t(121833,3,4,0),t(122006,1,4,0),
  t(122179,0,3,0),t(122526,0,4,0),t(122526,7,3,0),t(122699,1,3,0),
  t(123219,5,4,0),h(123392,4,1,124085,0,[[123392,4,1],[123739,3,3],[124085,2,5]]),t(124258,4,5,0),t(124432,5,4,0),
  t(124605,6,4,0),t(124778,6,4,0),t(125125,5,4,0),t(125298,6,4,0),
  t(125385,5,4,0),t(125471,6,4,0),t(125645,1,3,0),t(125818,2,5,0),
  t(125991,5,4,0),t(126164,6,4,0),t(126338,5,5,0),t(126511,6,4,0),
  f(126684,5,5),t(127031,2,8,0),h(127204,5,4,128417),t(127550,6,4,0),
  t(127637,5,4,0),t(127724,4,3,0),t(127897,5,4,0),t(128070,5,4,0),
  t(128590,6,4,0),t(128763,6,4,0),t(128936,3,4,0),t(129283,6,4,0),
  t(129456,3,4,0),t(129629,6,4,0),t(129803,3,4,0),t(129976,5,4,0),
  t(130149,6,4,0),t(130322,5,4,0),t(130496,3,4,0),t(130669,6,4,0),
  t(130842,5,4,0),t(131015,6,4,0),t(131189,6,4,0),t(131189,0,3,0),
  h(131362,3,4,132315),t(131709,1,4,0),t(131795,2,4,0),f(131882,3,4),
  t(132402,3,4,0),t(132575,1,4,0),t(132748,0,4,0),t(133095,1,4,0),
  t(133268,3,3,0),t(133441,1,4,0),t(133614,0,4,0),t(133961,1,3,0),
  t(134134,3,4,0),h(134307,4,5,135693),t(134654,1,3,0),t(134827,3,4,0),
  t(135000,3,4,0),t(135174,6,3,0),f(135347,5,4),t(135867,5,4,0),
  t(136040,6,4,0),t(136213,6,4,0),t(136386,5,4,0),t(136473,6,4,0),
  t(137080,5,3,0),t(137253,6,4,0),t(137339,5,4,0),h(137426,5,5,138206,0,[[137426,5,5],[137859,7,3],[138206,8,1]]),
  t(137773,5,4,0),t(137859,4,4,0),t(138466,0,4,0),t(138639,1,4,0),
  t(139159,3,4,0),t(139505,1,3,0),t(139678,5,4,0),t(139852,3,4,0),
  t(140025,1,4,0),t(140198,0,3,0),t(140371,1,4,0),t(140545,5,4,0),
  f(140718,3,4),t(141064,6,4,0),t(141238,1,4,0),t(141411,4,1,0),
  t(141757,6,4,0),t(141757,0,3,0),t(141931,5,4,0),t(142017,2,4,0),
  t(142104,5,4,0),t(142277,5,5,0),t(142450,5,4,0),t(142624,6,4,0),
  t(142797,5,4,0),t(143144,3,4,0),t(143230,3,4,0),t(143317,0,4,0),
  t(143837,1,4,0),t(144010,0,4,0),t(144096,1,4,0),t(144183,0,4,0),
  t(144270,3,4,0),t(144356,1,3,0),t(144530,5,4,0),t(144703,4,5,0),
  f(145049,1,3),t(145396,3,4,0),t(145569,0,4,0),t(145742,1,3,0),
  t(145916,0,4,0),t(146089,0,5,0),t(146262,3,3,0),t(146609,5,4,0),
  t(146782,2,5,0),t(147128,5,4,0),t(147302,6,4,0),t(147475,4,5,0),
  t(147821,3,4,0),t(148168,4,5,0),t(148861,3,4,0),t(149034,1,4,0),
  t(149208,2,5,0),t(149381,1,3,0),t(149467,3,4,0),t(149554,4,5,0),
  t(149727,3,4,0),t(149901,2,8,0),t(150247,6,4,0),t(150247,0,3,0),
  f(151547,5,4),
// </monster-hero-v3-expert-notes>
])(mhTap,mhHoldV2,mhFlick,mhSlideV2);
const monsterHeroV3MasterNotes=((t,h,f,s)=>[
// <monster-hero-v3-master-notes>
  t(2718,1,3,0),t(2805,3,3,0),f(2891,2,2),t(3931,0,3,0),
  t(4018,3,3,0),t(4537,0,3,0),t(4537,5,3,0),t(5404,1,3,0),
  h(5577,2,1,6443,0,[[5577,2,1],[5837,2,2],[6183,1,3],[6443,1,4]]),t(6617,0,2,0),t(6790,1,3,0),t(6963,3,3,0),
  h(7483,5,3,8349,1),t(8003,8,2,0),t(8869,0,3,0),t(9042,3,3,0),
  t(9215,1,3,0),t(9562,5,3,0),t(10255,3,3,0),t(10601,7,3,0),
  t(11468,3,3,0),t(11814,5,3,0),t(11988,3,3,0),t(12334,1,3,0),
  f(12854,3,3),s(13460,14067,[[13460,0,2],[13720,2.5,2],[13980,4,2],[14067,4,2]]),t(14326,3,3,0),t(14413,4,6,0),
  t(15799,7,3,0),t(16492,3,3,0),t(16665,5,3,0),s(17185,17705,[[17185,1.5,2],[17359,1,2],[17532,0.5,2],[17705,3,2]]),
  t(17878,3,3,0),t(18225,0,2,0),t(18571,7,3,0),t(19264,4,2,0),
  t(19957,5,3,0),t(20304,1,4,0),t(20650,2,3,0),t(20650,7,3,0),
  t(20997,0,4,0),t(21690,1,4,0),t(22036,5,3,0),t(23076,3,4,0),
  t(23423,3,4,0),t(24116,5,3,0),t(24289,5,3,0),t(24462,8,2,0),
  f(24635,7,3),t(25502,6,4,0),t(26195,5,3,0),t(26541,3,4,0),
  t(26888,1,4,0),t(27061,0,4,0),t(27927,0,2,0),t(27927,4,2,0),
  t(28274,4,2,0),t(28274,8,2,0),t(28620,0,2,0),t(28620,4,2,0),
  t(28967,4,2,0),t(28967,8,2,0),t(29313,5,4,0),t(29660,3,3,0),
  t(30006,4,2,0),t(30353,5,3,0),t(31046,1,4,0),t(31392,0,4,0),
  t(31739,3,3,0),h(32085,6,2,32778,1),t(32432,3,4,1),t(33125,1,3,0),
  t(33298,0,3,0),f(33471,2,2),t(33818,2,3,0),t(33818,7,3,0),
  t(34511,0,4,0),t(34684,3,3,0),t(35204,1,3,0),h(35897,5,3,36330),
  t(36590,4,2,0),t(36937,6,4,0),t(37283,7,3,0),t(37456,3,3,0),
  t(37803,5,3,0),t(38149,1,3,0),h(38323,3,4,38842,0,[[38323,3,4],[38583,4,3],[38842,5,1]]),t(39016,0,4,0),
  t(39362,1,3,0),t(40055,3,3,0),t(40575,0,2,0),t(40575,4,2,0),
  t(40922,1,2,0),t(40922,5,2,0),t(41268,3,2,0),t(41268,7,2,0),
  t(41615,4,2,0),t(41615,8,2,0),f(41788,6,4),s(42134,43520,[[42134,3,2],[42394,4,2],[42654,4,2],[42914,4,2],[43174,4,2],[43434,4,2],[43520,4,2]],1),
  t(42827,3,3,0),t(43001,5,4,0),t(43174,4,2,0),t(43867,2,2,0),
  t(43867,6,2,0),t(44213,2,2,0),t(44213,7,2,0),t(44560,1,2,0),
  t(44560,8,2,0),t(44906,0,2,0),t(44906,8,2,0),h(45253,5,4,45946),
  t(46119,3,3,0),t(46466,5,3,0),t(46466,0,3,0),t(47159,2,2,0),
  t(47505,0,4,0),t(47679,1,3,0),t(47765,3,3,0),t(47852,4,3,0),
  t(48025,0,6,0),t(48198,6,2,0),t(48372,3,3,0),t(48545,7,3,0),
  f(48718,4,2),h(49065,7,3,50104,1),t(49411,6,2,0),t(49758,1,3,0),
  t(50451,3,3,0),t(50797,0,4,0),t(51144,0,3,0),t(51317,0,3,0),
  t(51490,0,2,0),t(51837,0,3,0),t(52530,1,2,0),t(52530,5,2,0),
  t(52703,4,2,0),t(52703,8,2,0),t(52876,1,2,0),t(52876,5,2,0),
  t(53050,4,2,0),t(53050,8,2,0),t(53223,3,3,0),t(53569,1,4,0),
  t(53916,0,4,0),t(54089,1,4,0),s(54609,55302,[[54609,4,2],[54869,2,2],[55129,0.5,2],[55302,0,2]]),t(54955,6,2,0),
  t(55475,3,3,0),t(55648,6,2,0),t(55648,2,2,0),t(55822,3,3,0),
  f(55995,1,3),t(56341,0,2,0),t(56341,4,2,0),t(56515,1,2,0),
  t(56515,5,2,0),t(56688,3,2,0),t(56688,7,2,0),t(56861,4,2,0),
  t(56861,8,2,0),t(57034,6,4,0),t(57208,5,3,0),t(57554,3,3,0),
  t(57728,1,3,0),t(57901,0,3,0),t(58247,7,3,0),t(58421,3,3,0),
  t(58594,0,3,0),t(58767,2,2,0),t(59114,6,2,0),t(59287,2,2,0),
  s(59460,59980,[[59460,3,2],[59633,3,2],[59807,3,2],[59980,1.5,2]]),t(60153,5,3,0),t(60326,6,2,0),f(60500,8,2),
  s(60846,61366,[[60846,3,2],[61019,4,2],[61193,4,2],[61366,4,2]]),t(61539,3,4,0),t(61886,6,2,2),t(62232,2,2,0),
  t(62232,6,2,0),t(62405,2,2,0),t(62405,7,2,0),t(62579,1,2,0),
  t(62579,8,2,0),t(62752,0,2,0),t(62752,8,2,0),t(62925,7,3,0),
  t(63099,5,3,0),t(63099,0,3,0),t(63445,3,4,0),t(63618,1,3,0),
  t(63792,0,3,0),t(64138,0,3,0),t(64311,0,4,0),t(64658,1,4,0),
  t(65004,1,3,0),t(65178,3,4,0),t(65351,6,4,0),t(65697,3,3,0),
  t(65871,7,3,0),f(66217,1,3),h(66737,6,1,67343,0,[[66737,6,1],[67083,5,4],[67343,6,1]]),t(67430,4,2,0),
  t(67603,6,3,0),t(67776,4,6,0),t(68296,3,3,0),t(68469,1,4,0),
  h(68989,0,3,69769),t(69336,3,3,0),t(69422,2,3,0),t(69856,3,3,0),
  t(70029,0,3,0),t(70375,5,3,0),t(70549,1,3,0),t(70722,3,3,0),
  t(70895,0,2,0),h(71242,0,3,71675),t(71761,0,3,0),t(71935,3,3,0),
  t(72108,1,3,0),t(72108,6,3,0),f(72628,3,3),t(72974,6,2,0),
  t(73147,7,3,0),t(73321,5,3,0),t(73494,2,3,0),t(73667,4,2,0),
  t(73840,5,3,0),t(74360,8,2,0),t(74534,5,3,0),t(74707,6,4,0),
  t(75227,6,2,0),t(75400,3,3,0),t(75920,5,3,0),t(76093,3,3,0),
  t(76179,6,2,0),t(76439,6,4,0),t(76613,1,4,0),t(76959,5,3,0),
  t(77132,4,2,0),t(77306,6,3,0),t(77479,5,3,0),t(77652,7,3,0),
  t(77825,3,4,0),f(78172,3,3),t(78518,5,4,0),t(78692,5,3,0),
  s(78865,79471,[[78865,0,2],[79125,2,2],[79385,4,2],[79471,4,2]]),t(79731,1,4,0),t(80078,3,4,0),t(80251,5,3,0),
  t(80771,7,3,0),t(80771,2,3,0),h(80944,5,4,81464,0,[[80944,5,4],[81204,7,1],[81464,5,4]]),t(81637,3,4,0),
  t(81810,0,4,0),t(82157,3,3,0),t(82330,1,3,0),t(82503,5,3,0),
  t(82677,4,1,0),t(82850,6,4,0),t(83196,7,3,0),s(83370,84149,[[83370,2,2],[83543,2,2],[83716,1.5,2],[83889,1.5,2],[84063,0,2],[84149,0,2]]),
  t(83716,5,3,0),t(84236,2,4,0),f(84409,3,3),h(84929,0,3,85622),
  t(85275,1,3,0),t(85795,6,1,0),t(85969,7,3,0),t(86142,4,2,0),
  t(86488,5,3,0),t(86835,1,3,0),h(87008,3,4,87788),t(87874,2,3,0),
  t(88221,3,3,0),t(88567,5,3,0),t(88741,3,3,0),t(88914,5,3,0),
  t(89087,4,6,0),t(89260,6,4,0),t(89607,7,3,0),t(89780,5,4,0),
  t(89780,0,3,0),h(89953,3,4,90820),f(90300,1,3),t(90993,0,3,0),
  t(91166,2,2,0),t(91339,3,3,0),t(91513,5,3,0),t(91686,6,4,0),
  t(91859,5,4,0),t(92033,1,4,0),t(92379,3,4,3),t(92726,0,4,0),
  s(93072,94458,[[93072,4,2],[93332,3,2],[93592,1.5,2],[93852,1,2],[94112,1,2],[94372,0.5,2],[94458,0,2]]),t(93419,1,3,0),t(93765,0,3,0),t(94112,0,3,0),
  t(94631,1,3,0),t(94805,4,3,0),t(95151,3,4,0),h(95498,7,3,96537,1),
  t(95844,5,3,0),t(96191,6,3,0),t(96884,1,3,0),t(97057,3,3,0),
  t(97230,5,3,0),f(97577,7,3),t(97923,6,2,0),t(98270,4,2,0),
  t(98443,2,2,0),t(98616,0,4,0),t(98790,1,3,0),t(98876,5,3,0),
  t(99136,2,3,0),t(99136,7,3,0),t(99309,7,3,0),t(99829,3,3,0),
  t(100002,6,4,0),t(100176,3,3,0),t(100349,7,3,0),t(101215,5,4,0),
  t(101562,1,3,0),t(101908,6,2,0),t(102081,1,3,0),t(102428,0,2,0),
  t(102601,3,3,0),t(102948,2,2,0),f(103121,3,3),t(103468,1,3,0),
  t(103641,0,3,0),s(103814,104854,[[103814,1.5,2],[103987,1,2],[104161,2.5,2],[104334,2.5,2],[104507,3,2],[104680,3.5,2],[104854,3.5,2]],1),t(104161,1,3,0),t(104507,1,3,0),
  t(105200,0,3,0),t(105373,0,3,0),t(105547,1,3,0),t(105720,1,3,0),
  t(105893,0,3,0),t(106240,0,3,0),t(106326,5,3,0),t(106413,4,3,0),
  t(106586,1,3,0),t(106759,0,3,0),t(106759,5,3,0),t(107019,0,2,0),
  t(107106,1,3,0),t(107193,0,3,0),t(107972,4,6,0),t(108405,3,3,0),
  t(108492,1,3,0),f(108665,0,2),t(109098,6,4,0),t(109272,4,1,0),
  t(109358,6,2,0),t(109445,7,3,0),s(109532,110138,[[109532,2.5,2],[109705,0,2],[109878,0.5,2],[110051,1.5,2],[110138,2,2]]),t(110225,1,3,0),
  t(110398,6,2,0),h(110571,2,2,111264),t(110918,0,2,0),t(111437,1,3,0),
  t(111611,4,2,0),t(111784,2,2,0),t(112130,0,3,0),t(112304,1,3,0),
  t(112477,3,4,0),t(112650,5,3,0),t(112823,7,3,0),t(113170,4,2,0),
  t(113516,5,4,0),f(113690,7,3),t(114036,6,2,0),t(114210,1,3,0),
  t(114296,5,3,0),t(114383,3,3,0),t(114729,0,2,0),t(114729,4,2,0),
  t(114903,5,3,0),t(115076,2,3,0),t(115249,3,4,0),t(115422,0,3,0),
  t(115596,5,3,0),t(115942,2,2,4),t(116289,3,4,0),t(116462,0,3,0),
  t(116808,1,4,0),t(116982,3,3,0),t(117155,5,4,0),t(117328,4,2,0),
  t(117501,1,3,0),f(117848,0,3),t(118194,1,4,0),t(118281,3,3,0),
  h(118368,5,4,118887),t(119061,1,3,0),t(119234,5,3,0),t(119407,4,2,0),
  t(119580,6,3,0),t(119754,3,3,0),t(119840,5,3,0),t(119927,6,3,0),
  t(120100,5,3,0),t(120187,2,2,0),t(120360,6,2,0),t(120447,3,3,0),
  t(120620,6,4,0),t(120793,2,2,0),t(120793,6,2,0),t(120967,4,2,0),
  t(121053,2,2,0),t(121140,6,4,0),t(121486,6,2,0),t(121660,8,2,0),
  t(121833,5,3,0),t(122006,3,3,0),f(122179,6,2),t(122526,7,3,0),
  t(122612,5,3,0),t(122699,8,2,0),t(123219,5,3,0),h(123392,8,1,124085,0,[[123392,8,1],[123739,7,3],[124085,6,4]]),
  t(124258,2,6,0),t(124432,7,3,0),t(124605,3,3,0),t(124692,7,3,0),
  t(124778,1,3,0),t(125125,3,3,0),t(125211,5,3,0),t(125298,6,3,0),
  t(125385,5,3,0),t(125471,3,3,0),t(125645,2,2,0),t(125818,0,4,0),
  t(125991,0,3,0),t(126164,0,3,0),t(126338,1,4,0),t(126511,1,3,0),
  t(126597,0,3,0),f(126684,1,4),t(127031,0,4,0),t(127031,6,3,0),
  h(127204,1,3,128417),t(127550,3,3,0),t(127637,2,3,0),t(127724,4,2,0),
  t(127897,2,3,0),t(127983,3,3,0),t(128070,4,3,0),t(128590,3,3,0),
  t(128763,6,3,0),f(128936,1,3),t(129283,3,3,0),t(129370,5,4,0),
  t(129456,7,3,0),t(129629,3,3,0),t(129803,5,3,0),t(129976,7,3,0),
  t(130149,5,3,0),t(130322,7,3,0),t(130496,3,3,0),t(130669,5,3,0),
  t(130842,1,3,0),t(131015,5,3,0),t(131102,3,3,0),t(131189,2,3,0),
  h(131362,0,3,132315),t(131709,1,3,0),t(131795,2,3,0),t(131882,1,3,0),
  t(132402,0,3,0),t(132575,0,3,0),t(132575,5,3,0),t(132748,1,3,0),
  t(132835,0,3,0),t(133095,1,3,0),t(133268,0,2,0),t(133441,1,3,0),
  f(133614,3,3),t(133961,6,2,0),t(134134,7,3,0),h(134307,6,4,135693),
  t(134654,8,2,0),t(134827,6,3,0),t(135000,3,3,0),t(135087,2,3,0),
  t(135174,4,2,0),t(135347,6,3,0),t(135867,5,3,0),t(136040,5,3,0),
  t(136213,7,3,0),t(136386,6,3,0),t(136473,5,3,0),t(136560,2,2,0),
  t(137080,4,2,0),t(137253,0,3,0),t(137339,5,3,0),h(137426,6,4,138206,0,[[137426,6,4],[137859,7,3],[138206,9,1]]),
  t(137773,5,3,0),t(137859,6,3,0),t(138466,5,3,0),t(138639,7,3,0),
  f(138725,5,3),t(139159,2,3,0),t(139159,7,3,0),t(139332,1,3,0),
  t(139505,6,2,0),t(139678,7,3,0),t(139852,5,3,0),t(140025,3,3,0),
  t(140198,2,2,0),t(140371,5,3,0),t(140545,1,3,0),t(140631,3,3,0),
  t(140718,0,3,0),t(141064,1,3,0),t(141238,5,3,0),t(141411,4,1,0),
  t(141757,6,3,0),t(141931,2,3,0),t(142017,3,3,0),t(142104,5,3,0),
  t(142277,4,6,0),t(142450,5,3,0),t(142624,7,3,0),t(142797,5,3,0),
  t(142884,7,3,0),t(143144,3,3,0),t(143230,7,3,0),t(143317,3,3,0),
  f(143403,7,3),t(143837,5,3,0),t(144010,2,3,0),t(144096,5,3,0),
  t(144183,4,3,0),t(144270,1,3,0),t(144356,6,2,0),t(144530,2,3,0),
  t(144530,7,3,0),t(144703,6,4,0),t(144876,5,3,0),t(145049,2,2,0),
  t(145396,3,3,0),t(145569,0,3,0),t(145742,2,2,0),t(145916,0,3,0),
  t(146089,1,4,0),f(146262,4,2),t(146609,1,3,0),t(146782,0,4,0),
  t(147128,1,3,0),t(147302,3,3,0),t(147475,5,4,0),t(147821,7,3,0),
  t(147995,5,3,0),t(148168,3,4,0),t(148861,1,3,0),t(148948,0,3,0),
  t(149034,3,3,0),t(149208,1,4,0),t(149381,6,2,0),t(149467,0,3,0),
  t(149554,1,4,0),t(149727,0,3,0),t(149901,1,4,0),t(150074,0,6,0),
  t(150247,2,3,0),t(150247,7,3,0),f(151547,0,3),
// </monster-hero-v3-master-notes>
])(mhTap,mhHoldV2,mhFlick,mhSlideV2);
const monsterHeroV3Charts=Object.freeze({
  EASY:mhChart(1,monsterHeroV3EasyNotes,MONSTER_HERO_EASY_DURATION_MS),
  NORMAL:mhChart(3,monsterHeroV3NormalNotes,MONSTER_HERO_EASY_DURATION_MS),
  HARD:mhChart(5,monsterHeroV3HardNotes,MONSTER_HERO_EASY_DURATION_MS),
  EXPERT:mhChart(7,monsterHeroV3ExpertNotes,MONSTER_HERO_EASY_DURATION_MS),
  MASTER:mhChart(9,monsterHeroV3MasterNotes,MONSTER_HERO_EASY_DURATION_MS),
});

// SIX ÉTERNEL（モンビー用ショート）の譜面。
// もらった音源は5分あるので、曲の頭からサビの終わりまでを切り出した短い版で遊ぶ。
// 音源は tools/mode/rhythm-audio-reencode.js で作り、譜面は
// tools/mode/rhythm-chart-v3-pipeline.js --track six_eternel_beat --release が
// マーカーの内側だけを差し替える。ここは手で書かない。
const SIX_ETERNEL_BEAT_DURATION_MS=157970;
const sixEternelBeatEasyNotes=((t,h,f,s)=>[
// <six-eternel-beat-v3-easy-notes>
  t(2591,0,3,0),t(2591,7,3,0),t(3171,3,3,0),t(3316,5,4,0),
  t(4765,6,4,0),t(5200,6,4,0),t(6505,5,4,0),t(8679,3,3,0),
  t(9258,5,4,0),t(10273,3,3,0),t(11867,0,10,0),t(12302,1,4,0),
  t(13172,0,4,0),t(15490,1,4,0),t(15635,3,4,0),t(16795,0,3,0),
  h(17809,2,3,18462,0,[[17809,2,3],[18172,1,4],[18462,0,6]]),t(18534,0,3,0),t(19838,1,4,0),t(20128,2,6,0),
  t(20563,5,4,0),t(21433,6,4,0),t(22302,5,4,0),t(23172,6,4,0),
  t(23607,4,6,0),t(24041,3,4,0),t(24476,0,6,0),t(24911,0,4,0),
  t(25781,3,4,0),t(26360,4,6,0),t(26650,2,6,0),t(27520,4,6,0),
  t(28389,0,4,0),t(28824,0,6,0),t(29259,3,4,0),t(29694,5,4,0),
  t(30129,4,6,0),t(30563,4,6,0),t(30998,5,4,0),t(32737,3,4,1),
  t(33172,5,4,0),t(34477,4,6,0),t(34911,5,4,0),t(36651,4,6,0),
  t(37085,6,4,0),t(37955,2,6,0),t(38390,4,6,0),t(38825,3,4,0),
  t(39694,1,4,0),t(40564,3,4,0),t(40854,1,4,0),t(41433,3,4,0),
  t(42303,3,4,0),t(42738,0,6,0),t(43173,3,4,0),t(44042,1,4,0),
  h(44912,0,4,45854),t(46651,0,6,0),t(47521,0,4,0),t(48390,0,6,0),
  t(48825,2,6,0),t(49260,0,3,0),t(49260,7,3,0),t(49695,0,6,0),
  t(50129,3,4,0),t(50999,1,4,0),t(51434,2,6,0),t(51869,4,6,0),
  t(52303,4,6,0),t(52738,4,6,0),t(53608,0,10,0),t(53898,3,4,0),
  h(54043,0,6,55057),h(55347,0,4,56506),t(57521,4,6,0),t(57811,3,4,0),
  t(57956,1,4,0),t(58391,0,4,0),h(59260,0,6,59912),t(60130,2,6,0),
  t(60564,4,6,0),t(60999,4,6,0),t(61434,5,4,0),t(62304,3,4,0),
  t(62738,0,6,0),t(63173,0,6,2),t(63608,1,4,0),t(64478,2,6,0),
  t(64912,0,6,0),t(65347,0,4,0),t(65637,1,4,0),t(65782,3,4,0),
  t(66072,5,4,0),t(66652,6,4,0),t(67086,5,4,0),t(67376,6,4,0),
  t(67521,5,4,0),t(68391,4,6,0),t(68826,4,6,0),t(69260,5,4,0),
  t(69695,4,6,0),t(70130,5,4,0),t(70565,4,6,0),h(71000,4,6,71507,0,[[71000,4,6],[71290,5,4],[71507,6,3]]),
  t(71869,2,6,0),t(72304,4,6,0),t(72739,6,4,0),t(73174,4,6,0),
  t(73608,3,4,0),t(74043,0,6,0),t(74188,0,3,0),t(74478,0,4,0),
  t(74913,0,6,0),t(75348,0,4,0),t(76217,1,4,0),t(77087,0,6,0),
  t(77667,0,3,0),t(77667,7,3,0),t(77956,2,6,0),t(78391,4,6,0),
  t(78826,6,4,0),t(79696,0,6,0),t(80130,3,4,0),t(80275,5,3,0),
  t(80565,6,4,0),t(80855,5,4,0),t(81435,6,4,0),t(82159,0,10,0),
  t(82304,5,4,0),h(83174,6,4,83826),t(84044,3,4,0),t(84478,5,4,0),
  t(84913,4,6,0),h(85638,5,4,86797),t(87087,2,6,0),t(87522,5,4,0),
  t(87812,3,4,0),t(88392,5,4,0),t(88826,2,6,0),t(89261,5,4,0),
  t(89696,2,6,0),t(90131,4,6,0),t(90566,2,6,0),t(91000,2,6,0),
  t(91435,4,6,0),t(91870,5,4,0),t(92740,6,4,0),t(93609,3,4,3),
  t(94044,4,6,0),t(94334,6,4,0),t(94479,4,6,0),t(94914,3,4,0),
  t(95203,1,4,0),t(95348,1,6,0),t(95783,0,6,0),t(96218,2,6,0),
  t(96653,5,4,0),t(97088,6,4,0),t(97377,5,4,0),t(97522,6,4,0),
  t(97957,5,4,0),t(98392,2,6,0),t(98827,0,6,0),t(99262,0,6,0),
  t(99696,1,4,0),t(100131,4,6,0),t(100566,5,4,0),t(101001,3,4,0),
  t(101435,1,4,0),h(102015,1,3,102740,0,[[102015,1,3],[102233,0,4],[102522,0,4],[102740,1,3]]),h(103175,1,4,103682),t(104044,0,4,0),
  t(104189,1,4,0),t(104479,2,6,0),t(104914,4,6,0),t(105349,6,4,0),
  t(105783,7,3,0),t(105783,0,3,0),t(106218,0,10,0),t(106653,4,6,0),
  t(107523,5,4,0),t(107957,6,4,0),t(108682,5,4,0),t(108827,3,4,0),
  t(109262,1,4,0),t(109697,0,4,0),t(110131,1,4,0),t(110566,0,4,0),
  t(111871,1,4,0),t(112305,2,6,0),h(112740,5,4,113537),t(113610,6,4,0),
  t(114479,5,4,0),t(114914,6,4,0),t(115349,5,4,0),t(116219,4,6,0),
  t(117088,4,6,0),t(117958,4,6,0),t(118827,5,4,0),h(119262,4,6,120204),
  h(120567,4,6,121726,0,[[120567,4,6],[120856,6,4],[121146,7,3],[121436,6,4],[121726,4,6]]),t(121871,0,4,0),t(122306,0,6,0),t(122741,0,6,0),
  t(123175,0,6,0),t(123610,0,6,0),t(124045,1,4,0),t(124480,0,6,0),
  t(124915,1,4,0),t(125349,0,6,0),t(125784,1,4,4),t(126364,0,4,0),
  t(126654,1,4,0),t(127089,0,6,0),t(127523,0,6,0),t(127958,0,6,0),
  t(128393,0,6,0),t(129263,0,4,0),t(129697,0,6,0),t(130132,2,6,0),
  t(130567,5,4,0),t(131002,6,4,0),t(131437,4,6,0),t(131871,3,4,0),
  t(132306,1,4,0),t(132741,0,6,0),t(133176,0,6,0),t(133611,3,4,0),
  t(134045,0,6,0),t(134480,0,3,0),t(134480,7,3,0),t(134915,0,10,0),
  t(135350,2,6,0),t(135495,1,4,0),t(135785,0,6,0),t(136219,0,6,0),
  t(136509,2,6,0),t(136654,5,4,0),t(137524,6,4,0),t(138103,5,4,0),
  t(138393,2,6,0),t(138828,1,4,0),t(139263,0,6,0),t(139408,3,4,0),
  t(139698,0,6,0),t(140132,0,6,0),t(140567,1,4,0),t(141002,0,4,0),
  t(141437,0,6,0),t(141727,3,4,0),t(141872,1,4,0),t(142306,0,4,0),
  t(142451,1,4,0),t(142741,2,6,0),t(143176,5,4,0),t(143611,2,6,0),
  t(144046,0,6,0),t(144480,0,4,0),t(144915,2,6,0),t(145350,1,4,0),
  t(145785,0,4,0),t(146220,0,6,0),t(146654,3,4,0),t(147089,4,6,0),
  t(147524,4,6,0),t(147959,4,6,0),t(148249,1,4,0),t(148394,3,4,0),
  t(148828,5,4,0),t(149263,6,4,0),t(149698,5,4,0),t(149988,3,4,0),
  t(150133,1,4,0),t(150568,0,6,0),t(151002,3,4,0),t(151292,1,3,0),
  t(151437,0,4,0),t(151872,1,4,0),h(152307,4,3,153031,0,[[152307,4,3],[152524,2,6],[152814,3,4],[153031,4,3]]),t(153176,5,4,0),
  t(153611,6,4,0),t(154481,6,4,0),t(154916,0,10,0),t(155350,5,4,0),
  t(155495,4,4,0),t(156220,7,3,0),t(156220,0,3,0),
// </six-eternel-beat-v3-easy-notes>
])(mhTap,mhHoldV2,mhFlick,mhSlideV2);
const sixEternelBeatNormalNotes=((t,h,f,s)=>[
// <six-eternel-beat-v3-normal-notes>
  t(2447,1,3,0),f(2591,5,3),t(3316,3,3,0),t(4765,5,3,0),
  t(5200,7,3,0),t(5200,0,3,0),h(5490,6,2,6070,1,[[5490,6,2],[5780,5,4],[6070,4,6]]),t(6505,3,3,0),
  t(8244,3,3,0),t(8679,6,2,0),t(9258,3,4,0),t(9838,1,3,0),
  t(10273,4,2,0),t(11577,1,4,0),t(11867,0,10,0),t(13172,0,4,0),
  t(15490,3,3,0),t(15635,1,3,0),t(16215,0,2,0),t(16795,2,2,0),
  t(18534,0,2,0),t(19259,1,3,0),t(19838,3,4,0),t(20128,4,6,0),
  t(20563,6,4,0),t(21433,3,4,0),t(21867,6,4,0),f(22302,3,4),
  t(23172,5,4,0),t(23607,4,6,0),t(23752,6,4,0),t(24041,6,4,0),
  t(24911,5,4,0),t(25636,1,3,0),t(25781,5,4,0),t(26360,2,6,0),
  t(26650,4,6,0),t(27520,4,6,0),t(28389,6,4,0),t(28824,4,6,0),
  t(29259,6,4,0),t(29404,4,6,0),t(29694,3,4,0),t(30129,4,6,0),
  t(30563,2,6,0),t(30998,5,4,0),t(31433,4,6,0),t(31868,4,6,0),
  t(32737,6,4,0),t(33607,5,4,1),t(34477,4,6,0),f(35346,5,4),
  t(36651,2,6,0),t(37085,0,3,0),t(37085,7,3,0),t(37955,0,6,0),
  t(38390,0,6,0),t(38825,3,4,0),t(39259,3,4,0),t(39694,5,4,0),
  t(40564,6,4,0),t(40854,5,4,0),t(41433,3,4,0),t(41868,0,6,0),
  t(42303,3,4,0),t(42738,4,6,0),t(43173,6,4,0),t(44042,3,4,0),
  t(44477,4,6,0),h(44912,3,4,45854),t(46216,0,6,0),t(46651,2,6,0),
  t(47521,1,4,0),t(47955,0,6,0),t(48390,0,6,0),t(49260,0,4,0),
  f(49695,0,6),t(50129,3,4,0),t(50564,4,6,0),t(50999,3,4,0),
  t(51434,0,6,0),h(51724,0,3,52883),t(53173,1,3,0),t(53608,0,10,0),
  t(53898,3,4,0),h(54043,4,6,55057),h(55347,5,4,56506),t(56651,3,6,0),
  t(57521,0,6,0),t(57811,3,4,0),t(57956,5,4,0),t(58391,7,3,0),
  h(59260,4,6,59912),t(60130,4,6,0),t(60564,4,6,0),t(60999,2,6,0),
  t(61434,1,4,0),t(61869,0,6,0),t(62304,0,3,0),t(62304,7,3,0),
  t(62738,2,6,0),f(63173,4,6),t(63608,1,3,0),t(64043,3,3,2),
  t(64478,4,6,0),t(64912,4,6,0),t(65347,1,4,0),t(65637,3,4,0),
  t(65782,5,4,0),t(66072,6,4,0),t(66217,5,3,0),t(66652,3,3,0),
  t(67086,1,4,0),t(67376,3,4,0),t(67521,5,3,0),t(68391,4,6,0),
  t(68826,2,6,0),t(69260,5,4,0),t(69695,0,6,0),t(69985,0,4,0),
  t(70130,3,4,0),t(70565,0,6,0),h(71000,4,6,71507,0,[[71000,4,6],[71290,5,4],[71507,6,2]]),h(71869,4,6,72377),
  t(72739,1,4,0),f(72884,3,4),t(73174,4,6,0),t(73608,6,4,0),
  t(74043,2,6,0),t(74188,3,2,0),t(74478,5,4,0),t(74913,4,6,0),
  t(75348,6,4,0),t(76217,5,4,0),h(76652,4,6,77304),t(77667,1,4,0),
  t(77956,4,6,0),t(78391,2,6,0),t(78826,6,4,0),t(79696,0,10,0),
  t(80130,3,3,0),t(80275,2,2,0),t(80420,0,4,0),t(80855,3,4,0),
  t(81000,1,3,0),t(81435,0,3,0),t(81870,1,3,0),t(82159,0,6,0),
  t(82304,0,4,0),h(83174,0,4,83826),f(84044,0,4),t(84478,1,4,0),
  t(84913,2,6,0),t(85348,0,6,0),h(85638,1,2,86797,1,[[85638,1,2],[85928,0,4],[86218,0,6],[86507,0,4],[86797,1,2]]),t(87087,0,6,0),
  t(87522,0,4,0),t(87667,0,6,0),t(87812,0,3,0),t(88392,5,4,0),
  t(88826,0,6,0),t(89261,3,4,0),t(89696,0,6,0),t(89986,1,3,0),
  t(90131,2,6,0),t(90566,4,6,0),t(91000,4,6,0),t(91435,4,6,0),
  t(91870,6,4,0),t(92305,4,6,0),t(92740,6,4,0),t(93609,1,4,3),
  t(94044,4,6,0),t(94334,3,4,0),f(94479,4,6),t(94914,0,3,0),
  t(95203,3,4,0),t(95348,4,6,0),t(95783,2,6,0),t(96218,4,6,0),
  t(96653,3,3,0),t(97088,6,4,0),t(97377,3,3,0),t(97522,5,3,0),
  t(97957,1,4,0),t(98392,0,6,0),t(98537,0,3,0),t(98537,7,3,0),
  t(98827,0,6,0),t(99262,2,6,0),t(99696,1,4,0),t(100131,4,6,0),
  t(100566,0,4,0),t(101001,1,3,0),t(101435,3,4,0),t(101870,5,3,0),
  h(102015,7,3,102740),h(103175,5,4,103682),t(104044,6,4,0),f(104189,5,3),
  t(104479,0,10,0),t(104914,0,6,0),t(105349,0,3,0),t(105783,0,4,0),
  t(106218,0,6,0),t(106653,0,6,0),t(107088,0,3,0),t(107523,3,3,0),
  t(107957,1,3,0),t(108682,5,4,0),t(108827,1,3,0),t(109117,3,4,0),
  t(109262,0,3,0),t(109697,0,3,0),t(110131,0,4,0),t(110566,0,4,0),
  t(111001,0,4,0),t(112305,0,6,0),h(112740,2,6,113537,0,[[112740,2,6],[113030,4,3],[113247,4,3],[113537,2,6]]),t(113610,1,4,0),
  t(114045,2,6,0),t(114479,5,4,0),t(115349,3,4,0),f(115784,6,4),
  t(116219,2,6,0),t(117088,0,6,0),t(117958,4,6,0),t(118393,3,4,0),
  t(118827,0,3,0),t(118827,7,3,0),t(119697,0,6,0),t(120132,2,6,0),
  h(120567,7,2,121726,1,[[120567,7,2],[120856,4,6],[121146,7,2],[121436,4,6],[121726,7,2]]),t(122306,0,6,0),t(122741,4,6,0),t(123175,2,6,0),
  t(123610,4,6,0),t(124045,1,4,0),t(124480,4,6,0),t(124770,3,4,0),
  t(124915,6,4,0),t(125349,2,6,0),t(125784,5,4,4),t(126364,6,4,0),
  t(126654,5,4,0),t(127089,0,6,0),t(127523,2,6,0),t(127958,4,6,0),
  f(128393,4,6),t(128683,5,3,0),t(129263,3,4,0),t(129697,0,6,0),
  t(130132,0,6,0),t(130567,1,4,0),t(131002,3,4,0),t(131437,0,6,0),
  t(131726,5,4,0),t(131871,6,4,0),t(132306,6,4,0),t(132741,0,10,0),
  t(133176,4,6,0),t(133611,3,4,0),t(134045,4,6,0),t(134480,5,3,0),
  t(134915,0,6,0),t(135350,2,6,0),t(135495,0,3,0),t(135640,5,3,0),
  t(136219,2,6,0),t(136509,0,6,0),t(136654,0,3,0),t(137524,0,4,0),
  f(138103,1,4),t(138393,2,6,0),t(138828,7,3,0),t(138828,0,3,0),
  t(139263,4,6,0),t(139408,3,4,0),t(139698,4,6,0),t(140132,4,6,0),
  t(140567,5,4,0),t(140712,1,3,0),t(141002,5,3,0),t(141437,2,6,0),
  t(141727,7,3,0),t(141872,6,3,0),t(142306,6,4,0),t(142451,7,3,0),
  t(142741,4,6,0),t(143176,5,4,0),t(143611,4,6,0),t(143901,6,2,0),
  t(144046,3,6,0),t(144480,5,3,0),t(144915,4,6,0),t(145350,5,3,0),
  t(145785,3,4,0),f(145930,1,3),t(146220,4,6,0),t(146654,1,4,0),
  t(147089,2,6,0),t(147524,0,6,0),t(147959,0,6,0),t(148249,3,3,0),
  t(148394,5,4,0),t(148828,6,4,0),t(149263,5,4,0),h(149698,7,3,150350),
  t(150568,0,6,0),t(151002,5,4,0),t(151292,4,2,0),t(151437,7,3,0),
  t(151872,3,4,0),h(152307,8,2,153031,0,[[152307,8,2],[152524,7,3],[152814,6,4],[153031,4,6]]),t(153176,3,4,0),t(153611,3,4,0),
  t(154046,1,4,0),t(154481,1,4,0),t(154916,0,10,0),t(155350,0,3,0),
  t(155350,7,3,0),t(155495,2,3,0),f(156220,1,4),
// </six-eternel-beat-v3-normal-notes>
])(mhTap,mhHoldV2,mhFlick,mhSlideV2);
const sixEternelBeatHardNotes=((t,h,f,s)=>[
// <six-eternel-beat-v3-hard-notes>
  t(2447,0,3,0),t(2447,6,3,0),f(2591,1,3),t(3171,4,1,0),
  t(3316,5,3,0),t(3823,7,3,0),t(4765,5,3,0),t(5200,7,3,0),
  t(5490,5,3,0),t(6505,3,3,0),t(7157,1,3,0),t(7302,1,1,0),
  h(8244,3,3,8606),t(8679,6,1,0),t(8896,3,3,0),t(9258,1,4,0),
  t(9838,3,3,0),t(10273,6,1,0),t(11142,1,4,0),t(11577,3,4,0),
  t(11867,2,8,0),t(12302,6,4,0),t(13172,5,4,0),t(13969,6,4,0),
  t(15201,6,1,0),t(15490,3,3,0),t(15635,1,3,0),f(15708,0,3),
  h(16215,2,1,16722,0,[[16215,2,1],[16505,1,3],[16722,0,5]]),t(16795,6,1,0),h(17882,7,3,18462),t(18534,5,1,0),
  t(19259,1,3,0),t(19838,5,4,0),t(20128,2,5,0),t(20563,6,4,0),
  t(21143,3,4,0),t(21433,5,4,0),t(21867,6,4,0),t(22302,5,4,0),
  t(22375,5,5,0),t(22737,3,4,0),t(23172,5,4,0),t(23607,0,5,0),
  t(23752,3,4,0),t(24041,1,4,0),t(24476,0,5,0),t(24911,1,4,0),
  t(25636,0,3,0),t(25781,1,4,0),t(26071,0,3,0),t(26360,0,5,0),
  f(26650,2,5),t(27520,5,5,0),t(27955,0,4,0),t(27955,7,3,0),
  t(28389,5,4,0),t(28534,1,4,0),t(28824,2,5,0),t(29259,0,4,0),
  t(29404,0,5,0),t(29694,3,4,0),t(29839,6,1,0),t(30129,5,5,0),
  t(30274,5,3,0),t(30563,2,5,0),t(30998,3,4,0),t(31433,4,5,0),
  t(31868,0,5,0),t(32737,3,4,0),t(33172,1,4,0),t(33607,5,4,1),
  t(34477,2,5,0),t(34911,1,4,0),t(35346,5,4,0),t(36216,3,4,0),
  h(36651,5,5,37158,1),h(37955,4,5,38462),f(38825,3,4),t(39259,5,4,0),
  t(39404,6,4,0),t(39694,5,4,0),t(39839,3,4,0),t(40564,0,4,0),
  t(40854,3,4,0),t(40999,1,4,0),t(41433,5,4,0),t(41868,2,5,0),
  t(42303,6,4,0),t(42738,4,5,0),t(43173,5,4,0),h(43607,4,5,44187),
  t(44477,2,5,0),h(44912,6,4,45854),t(46216,4,5,0),t(46651,2,5,0),
  t(47086,0,5,0),t(47521,0,4,0),t(47955,0,5,0),t(48390,0,5,0),
  t(48825,0,5,0),t(49115,0,4,0),t(49115,7,3,0),f(49260,1,4),
  t(49695,1,8,0),t(50129,5,4,0),t(50564,2,5,0),t(50999,1,4,0),
  t(51216,2,5,0),t(51434,0,5,0),s(51724,52883,[[51724,2,3],[51941,2,3],[52158,1,3],[52376,1,3],[52593,1,3],[52811,0,3],[52883,0,3]]),t(53390,0,4,0),
  t(53608,0,5,0),t(53825,3,4,0),t(53898,6,4,0),s(54043,55057,[[54043,3,3],[54187,4,3],[54332,4,3],[54477,4,3],[54622,4,3],[54767,4,3],[54912,4,3],[55057,4,3]]),
  s(55274,56434,[[55274,3,3],[55492,4,3],[55709,4,3],[55927,4,3],[56144,3.5,3],[56361,4,3],[56434,4,3]]),t(56651,5,5,0),t(57014,3,4,0),t(57304,5,4,0),
  t(57521,0,5,0),t(57811,3,4,0),t(57956,0,4,0),t(58391,5,3,0),
  t(58608,3,3,0),t(58825,1,3,0),h(59260,0,5,59912,0,[[59260,0,5],[59622,1,3],[59912,2,1]]),f(60130,0,5),
  t(60492,5,4,0),t(60564,2,5,0),t(60782,5,5,0),t(60999,4,5,0),
  t(61434,1,4,0),t(61869,2,5,0),t(62304,0,4,2),t(62738,0,5,0),
  t(63173,4,5,0),t(63391,5,5,0),t(63608,5,3,0),t(63970,3,4,0),
  t(64043,1,3,0),t(64478,4,5,0),t(64912,0,5,0),t(65057,3,4,0),
  t(65347,0,4,0),t(65637,0,4,0),t(65782,1,4,0),t(66072,3,4,0),
  t(66217,5,3,0),t(66507,6,4,0),t(66507,0,3,0),f(66652,5,3),
  t(67086,6,4,0),t(67159,5,4,0),t(67376,6,4,0),t(67521,3,3,0),
  t(67956,7,3,0),t(68391,2,5,0),t(68463,6,4,0),t(68826,2,5,0),
  t(69260,1,4,0),t(69695,0,5,0),t(69985,1,4,0),t(70130,0,4,0),
  t(70420,3,3,0),t(70565,4,5,0),h(71000,3,4,71507,1),t(71869,0,5,0),
  t(72304,0,8,0),t(72594,1,3,0),t(72739,5,4,0),t(72884,3,4,0),
  t(72956,7,3,0),h(73174,4,5,73753),t(74043,0,5,0),t(74188,4,1,0),
  t(74261,5,3,0),f(74478,6,4),t(74913,4,5,0),h(75203,7,3,75637,1),
  t(76217,6,4,0),s(76652,77304,[[76652,3,3],[76797,3,3],[76942,3,3],[77087,4,3],[77232,4,3],[77304,4,3]]),t(77522,2,5,0),t(77667,6,4,0),
  t(77956,2,5,0),t(78391,5,5,0),h(78609,5,1,79116,0,[[78609,5,1],[78898,3,5],[79116,5,1]]),t(79261,5,3,0),
  t(79696,2,5,0),t(79913,0,5,0),t(80130,0,3,0),t(80275,2,1,0),
  t(80348,5,4,0),t(80565,3,3,0),t(80783,5,5,0),t(80855,3,4,0),
  t(81435,5,3,0),t(81652,6,4,0),t(81870,5,3,0),t(82159,0,5,0),
  t(82304,0,4,0),t(82304,7,3,0),f(82739,0,5),s(83174,83826,[[83174,1,3],[83319,1,3],[83464,2.5,3],[83609,3,3],[83754,1,3],[83826,1,3]]),
  t(84044,5,4,0),t(84478,3,4,0),t(84696,1,3,0),t(84913,0,5,0),
  t(85348,0,5,0),s(85638,86797,[[85638,2,3],[85855,3,3],[86073,3.5,3],[86290,4,3],[86507,3.5,3],[86725,2.5,3],[86797,2.5,3]]),t(87015,5,4,0),t(87087,0,5,0),
  t(87522,3,4,0),t(87594,0,4,0),h(87812,1,3,88247),t(88392,5,4,0),
  t(88826,2,5,0),t(89044,5,5,0),t(89261,5,4,0),t(89696,2,5,0),
  t(89986,1,3,0),t(90131,1,5,0),t(90566,0,5,0),t(90928,0,5,0),
  t(91000,0,5,0),t(91218,1,4,0),f(91435,0,5),t(91870,0,4,0),
  t(92305,0,5,0),t(92740,0,4,0),t(93174,1,4,0),t(93609,0,4,0),
  t(93827,1,4,0),t(94044,0,5,0),t(94261,4,4,0),t(94479,1,8,0),
  t(94551,1,3,0),t(94696,0,4,0),t(94914,1,3,0),t(95131,3,4,0),
  t(95203,4,4,0),t(95348,5,5,0),t(95566,1,4,0),t(95783,4,5,0),
  t(96218,2,5,3),t(96653,7,3,0),t(96870,4,1,0),t(97088,5,4,0),
  t(97377,7,3,0),f(97522,5,3),t(97812,1,3,0),t(97812,7,3,0),
  t(97957,5,4,0),t(98102,1,3,0),t(98392,0,5,0),t(98537,3,3,0),
  t(98827,0,5,0),t(98899,3,4,0),t(99044,1,3,0),t(99262,0,5,0),
  t(99696,0,4,0),t(99914,0,4,0),t(100131,0,5,0),t(100566,0,4,0),
  t(100783,5,3,0),t(101001,3,3,0),t(101073,1,4,0),t(101435,0,4,0),
  t(101870,1,3,0),h(102015,5,3,102740),h(102957,5,5,103682,1,[[102957,5,5],[103175,7,2],[103465,7,2],[103682,5,5]]),t(104044,1,4,0),
  t(104189,3,3,0),t(104262,5,3,0),t(104479,5,5,0),t(104914,0,5,0),
  f(104986,5,4),t(105349,3,3,0),t(105566,7,3,0),t(105783,6,4,0),
  t(106001,5,5,0),t(106218,5,5,0),t(106436,6,4,0),t(106653,4,5,0),
  t(107088,3,3,0),t(107305,1,4,0),t(107523,0,3,0),t(107740,1,4,0),
  t(107957,3,3,0),t(108175,5,4,0),t(108610,6,4,0),t(108682,5,4,0),
  t(108827,1,3,0),t(109117,3,4,0),t(109262,0,3,0),t(109334,2,4,0),
  t(109479,3,3,0),t(109697,5,3,0),t(110131,3,4,0),t(110566,5,4,0),
  t(110711,8,1,0),f(111001,5,4),t(111871,3,4,0),t(112305,4,5,0),
  s(112740,113537,[[112740,3,3],[112885,2,3],[113030,2,3],[113175,1.5,3],[113320,1,3],[113465,1,3],[113537,1.5,3]]),t(113610,0,4,0),t(114045,1,8,0),t(114479,1,4,0),
  t(114914,5,4,0),t(115059,3,4,0),t(115349,6,4,0),t(115784,3,4,0),
  t(116219,5,5,0),t(117088,4,5,0),t(117958,5,5,0),t(118393,5,4,0),
  t(118538,3,4,0),t(118827,5,4,0),s(119262,120204,[[119262,3,3],[119407,3,3],[119552,2.5,3],[119697,3,3],[119842,3,3],[119987,3.5,3],[120132,4,3],[120204,4,3]]),h(120567,5,4,121726),
  t(121871,3,4,0),t(122306,4,5,0),t(122741,5,5,0),t(122958,4,5,0),
  t(123175,4,5,0),t(123393,4,5,0),f(123610,5,5),t(123973,5,5,0),
  t(124045,1,4,0),t(124480,2,5,0),t(124770,5,4,0),t(124915,6,4,0),
  t(125349,4,5,0),t(125567,0,5,0),t(125784,3,4,0),t(126002,0,3,0),
  t(126219,5,3,0),t(126364,3,4,0),t(126654,1,4,4),t(127089,0,5,0),
  t(127523,0,5,0),t(127741,5,3,0),t(127958,2,5,0),t(128176,6,4,0),
  t(128393,2,5,0),t(128683,7,3,0),t(129263,6,4,0),t(129263,0,3,0),
  t(129697,2,5,0),f(129842,1,4),t(130132,0,5,0),t(130277,3,5,0),
  t(130567,1,4,0),t(131002,3,4,0),t(131437,0,5,0),t(131509,3,4,0),
  t(131726,0,4,0),t(131871,3,4,0),t(132089,1,4,0),t(132306,0,4,0),
  h(132741,0,5,133176,1),t(133466,5,3,0),t(133611,3,4,0),t(133683,1,4,0),
  t(134045,0,5,0),t(134263,0,5,0),t(134480,3,3,0),t(134698,5,4,0),
  t(134915,5,5,0),t(135132,5,4,0),t(135350,0,5,0),t(135495,3,3,0),
  t(135567,2,4,0),t(135785,0,8,0),t(136002,4,5,0),t(136219,2,5,0),
  t(136437,5,5,0),t(136509,0,5,0),t(136654,5,3,0),f(136872,2,5),
  t(137379,7,3,0),t(137524,5,4,0),t(138103,6,4,0),t(138176,3,3,0),
  t(138321,7,3,0),t(138393,4,5,0),t(138828,6,4,0),t(139263,2,5,0),
  t(139408,1,4,0),h(139480,5,4,140132),t(140350,0,5,0),t(140567,5,4,0),
  t(140712,3,3,0),t(141002,7,3,0),t(141437,0,5,0),t(141582,3,4,0),
  t(141654,3,5,0),f(141872,7,3),t(142306,5,4,0),t(142451,7,3,0),
  t(142524,5,4,0),t(142741,2,5,0),t(143176,5,4,0),t(143393,1,4,0),
  t(143611,2,5,0),t(143901,0,1,0),t(144046,0,5,0),t(144263,5,4,0),
  t(144480,3,3,0),t(144698,4,5,0),t(144843,3,4,0),t(144915,2,5,0),
  t(145133,0,5,0),t(145350,1,3,0),t(145785,3,4,0),t(145930,1,3,0),
  t(146002,0,3,0),t(146220,4,5,0),t(146654,1,4,0),f(147089,2,5),
  t(147524,0,5,0),t(147741,1,4,0),t(147959,4,5,0),t(148176,3,3,0),
  t(148249,7,3,0),t(148394,5,4,0),t(148828,3,4,0),t(149046,1,3,0),
  t(149263,0,4,0),t(149481,0,3,0),s(149698,150350,[[149698,1,3],[149843,1,3],[149988,0.5,3],[150133,0,3],[150278,0,3],[150350,0,3]]),t(150568,0,5,0),
  t(151002,1,4,0),t(151292,4,1,0),t(151437,5,3,0),t(151655,3,4,0),
  t(151872,1,4,0),t(152089,0,3,0),h(152307,4,1,153031,0,[[152307,4,1],[152524,4,2],[152814,3,4],[153031,2,5]]),t(153176,1,4,0),
  t(153394,0,8,0),t(153611,1,4,0),t(154046,5,4,0),s(154263,155423,[[154263,2,3],[154481,3,3],[154698,3,3],[154916,4,3],[155133,3.5,3],[155350,3.5,3],[155423,4,3]]),
  t(155495,0,3,0),t(155785,0,4,0),t(155785,7,3,0),f(156220,3,4),
// </six-eternel-beat-v3-hard-notes>
])(mhTap,mhHoldV2,mhFlick,mhSlideV2);
const sixEternelBeatExpertNotes=((t,h,f,s)=>[
// <six-eternel-beat-v3-expert-notes>
  f(2157,0,3),t(2447,1,3,0),t(2447,7,3,0),t(2591,3,3,0),
  t(3171,6,1,0),t(3316,7,3,0),s(4548,5200,[[4548,3,3],[4693,1.5,3],[4838,1.5,3],[4983,1.5,3],[5128,2,3],[5200,3.5,3]],1),s(5490,6070,[[5490,0.5,3],[5708,1,3],[5925,2.5,3],[6070,3.5,3]]),
  t(6505,1,3,0),t(7157,0,3,0),t(7302,0,1,0),h(8244,3,3,8606),
  t(8679,6,1,0),t(8896,3,3,0),t(9258,1,4,0),t(9838,3,3,0),
  t(10273,6,1,0),t(11142,1,4,0),t(11577,5,4,0),t(11867,1,8,0),
  t(12157,6,4,0),t(12302,5,4,0),t(13172,6,4,0),t(13969,5,4,0),
  t(14621,6,4,0),t(15201,4,1,0),t(15490,5,3,0),f(15635,1,3),
  h(16215,4,1,16722,0,[[16215,4,1],[16505,3,3],[16722,2,5]]),t(16795,0,1,0),h(17882,1,3,18462),t(18534,0,1,0),
  t(19186,2,1,0),t(19259,3,3,0),t(19838,5,4,0),t(20128,5,5,0),
  t(20563,3,4,0),t(21143,0,2,0),t(21143,4,2,0),t(21433,2,2,0),
  t(21433,6,2,0),t(21723,4,2,0),t(21723,8,2,0),t(21867,2,4,0),
  t(22302,6,4,0),t(22737,3,4,0),t(23172,6,4,0),t(23607,4,5,0),
  t(23752,1,4,0),t(23897,6,1,0),t(24041,1,4,0),t(24476,0,5,0),
  t(24911,6,4,0),t(24911,0,3,0),t(25563,3,3,0),t(25636,5,3,0),
  f(25781,6,4),t(26071,1,2,0),t(26071,5,2,0),t(26360,3,2,0),
  t(26360,7,2,0),t(26650,1,2,0),t(26650,5,2,0),t(27085,5,5,0),
  t(27520,4,5,0),t(27955,3,4,0),t(28389,1,4,0),t(28534,3,4,0),
  t(28824,4,5,0),t(28897,1,4,0),t(29259,5,4,0),t(29404,0,5,0),
  t(29694,3,4,0),t(29839,0,1,0),t(30129,2,5,0),t(30274,0,3,0),
  t(30563,0,5,0),t(30998,0,2,0),t(30998,4,2,0),t(31216,2,2,0),
  t(31216,6,2,0),t(31433,4,2,0),t(31433,8,2,0),t(31868,4,5,0),
  f(32737,1,4),t(33172,5,4,0),t(33607,3,4,1),t(34477,1,2,0),
  t(34477,5,2,0),t(34694,3,2,0),t(34694,7,2,0),t(34911,1,2,0),
  t(34911,5,2,0),t(35346,6,4,0),t(36216,5,4,0),h(36651,2,5,37158,1),
  t(37665,1,3,0),h(37955,0,5,38462),t(38825,0,4,0),t(39259,1,4,0),
  t(39404,3,4,0),t(39694,1,4,0),t(39839,0,4,0),t(40564,1,4,0),
  t(40854,3,4,0),t(40999,1,4,0),t(41288,0,5,0),t(41433,1,4,0),
  t(41868,2,5,0),t(42303,6,4,0),t(42303,0,3,0),t(42738,2,5,0),
  t(42883,2,1,0),f(43173,3,4),h(43607,4,5,44187,0,[[43607,4,5],[43897,5,3],[44187,6,1]]),t(44477,2,5,0),
  t(44767,5,3,0),h(44912,3,4,45854),t(45347,7,3,0),t(46216,4,5,0),
  t(46651,0,5,0),t(47086,2,5,0),t(47521,0,4,0),t(47593,0,5,0),
  t(47955,2,5,0),t(48390,4,5,0),t(48825,2,5,0),t(49115,5,4,0),
  t(49260,4,4,0),t(49695,5,5,0),t(49912,2,8,0),t(50129,1,4,0),
  t(50564,4,5,0),t(50999,3,4,0),t(51216,5,5,0),t(51434,4,5,0),
  s(51651,52811,[[51651,3,3],[51869,2,3],[52086,1,3],[52303,1,3],[52521,1,3],[52738,0.5,3],[52811,0.5,3]],1),f(52303,4,5),t(53173,1,3,0),t(53390,3,4,0),
  t(53608,4,5,0),t(53825,6,4,0),t(53898,3,4,0),s(54043,55057,[[54043,3,3],[54187,4,3],[54332,4,3],[54477,4,3],[54622,4,3],[54767,4,3],[54912,4,3],[55057,4,3]]),
  t(54405,3,4,0),t(54477,2,4,0),t(54622,1,4,0),s(55274,56434,[[55274,0.5,3],[55492,2,3],[55709,3.5,3],[55927,2.5,3],[56144,1.5,3],[56361,3,3],[56434,3.5,3]]),
  t(55564,3,4,0),t(55637,2,4,0),t(55782,4,5,0),t(56651,5,5,0),
  t(56724,3,3,0),t(57014,5,4,0),t(57304,1,4,0),t(57521,0,5,0),
  t(57811,1,4,0),t(57956,0,4,0),t(58028,1,4,0),t(58391,6,3,0),
  t(58391,0,3,0),t(58608,3,3,0),f(58825,1,3),h(59260,0,5,59912),
  t(60130,0,5,0),t(60347,3,4,0),t(60492,5,4,0),t(60564,5,5,0),
  t(60782,2,5,0),t(60999,4,5,0),t(61434,6,4,2),t(61869,4,5,0),
  t(62159,6,4,0),t(62304,3,4,0),t(62738,4,5,0),t(63173,0,5,0),
  t(63391,2,5,0),t(63608,1,3,0),t(63970,0,4,0),t(64043,1,3,0),
  t(64478,4,5,0),t(64550,3,3,0),t(64912,0,5,0),t(65057,0,4,0),
  t(65275,1,4,0),f(65347,5,4),t(65637,3,4,0),t(65782,6,4,0),
  t(66072,5,4,0),t(66217,3,3,0),t(66507,5,4,0),t(66652,3,3,0),
  t(67086,5,4,0),t(67159,3,4,0),t(67376,1,4,0),t(67449,0,4,0),
  t(67521,1,3,0),t(67956,3,3,0),t(68391,4,5,0),t(68463,3,4,0),
  t(68826,4,5,0),t(69043,7,3,0),t(69260,5,4,0),t(69695,2,5,0),
  t(69985,1,4,0),t(70130,0,4,0),t(70420,0,3,0),t(70420,6,3,0),
  f(70565,0,5),h(71000,2,1,71507,0,[[71000,2,1],[71290,0,5],[71507,2,1]]),t(71652,1,5,0),t(71869,2,5,0),
  t(72304,2,8,0),t(72594,1,3,0),t(72739,5,4,0),t(72884,3,4,0),
  t(72956,7,3,0),t(73101,5,4,0),h(73174,5,5,73753),t(74043,4,5,0),
  t(74188,4,1,0),t(74261,0,3,0),t(74478,0,4,0),t(74913,0,5,0),
  h(75203,0,3,75637),h(75782,0,4,76362,1),s(76652,77304,[[76652,1.5,3],[76797,1,3],[76942,1,3],[77087,3.5,3],[77232,3.5,3],[77304,3.5,3]]),t(77522,0,5,0),
  t(77667,1,4,0),t(77956,2,5,0),t(78391,4,5,0),h(78464,3,4,79116),
  t(78826,1,4,0),f(79261,0,3),t(79696,0,5,0),t(79841,0,4,0),
  t(79913,0,5,0),t(80130,0,3,0),t(80275,2,1,0),t(80348,2,4,0),
  t(80420,0,4,0),t(80565,0,3,0),t(80783,0,5,0),t(80855,5,4,0),
  t(81000,3,3,0),t(81435,1,3,0),t(81652,0,4,0),t(81870,1,3,0),
  t(82159,2,5,0),t(82304,5,4,0),t(82739,5,5,0),t(82812,2,5,0),
  s(83174,83826,[[83174,3,3],[83319,3,3],[83464,4,3],[83609,4,3],[83754,3,3],[83826,3,3]]),t(84044,1,4,0),t(84478,6,4,0),t(84478,0,3,0),
  t(84696,3,3,0),t(84768,8,1,0),f(84913,4,5),t(85348,5,5,0),
  s(85638,86797,[[85638,1.5,3],[85855,2.5,3],[86073,3,3],[86290,3.5,3],[86507,3.5,3],[86725,2,3],[86797,2,3]]),t(86218,2,5,0),t(86435,4,5,0),t(87015,6,4,0),
  t(87087,3,5,0),t(87522,3,4,0),t(87594,3,4,0),h(87667,0,5,88247),
  t(88392,5,4,0),t(88826,0,5,0),t(88899,3,4,0),t(89044,0,5,0),
  t(89261,5,4,0),t(89696,0,5,0),t(89913,3,3,0),t(89986,0,3,0),
  t(90131,4,5,0),t(90566,0,5,0),t(90928,2,5,0),t(91000,0,5,0),
  t(91218,0,4,0),h(91435,0,5,91942,1,[[91435,0,5],[91725,2,1],[91942,0,5]]),t(92305,0,5,0),t(92522,3,4,0),
  f(92740,5,4),t(93174,6,4,0),t(93609,5,4,0),t(93827,3,4,0),
  t(94044,4,5,0),t(94261,6,4,0),t(94334,5,4,0),t(94479,5,5,0),
  t(94551,1,3,0),t(94696,3,4,0),t(94914,5,3,0),t(95131,6,4,0),
  t(95203,3,4,0),t(95348,2,8,0),t(95421,7,3,0),t(95566,5,4,0),
  t(95783,1,5,0),t(96218,4,5,3),t(96653,3,3,0),t(96870,8,1,0),
  f(97088,5,4),t(97377,7,3,0),t(97377,1,3,0),t(97522,5,3,0),
  t(97595,3,3,0),t(97812,1,3,0),t(97957,3,4,0),t(98102,5,3,0),
  t(98392,2,5,0),t(98537,5,3,0),t(98827,2,5,0),t(98899,6,4,0),
  t(99044,3,3,0),t(99262,5,5,0),t(99696,5,4,0),t(99914,6,4,0),
  t(100131,4,5,0),t(100204,3,4,0),t(100566,0,4,0),t(100638,1,4,0),
  t(100783,3,3,0),t(101001,1,3,0),t(101073,0,4,0),t(101435,1,4,0),
  t(101870,3,3,0),h(102015,5,3,102740),f(102305,6,4),h(102957,5,4,103682),
  t(104044,1,4,0),t(104189,5,3,0),t(104262,3,3,0),t(104479,5,5,0),
  t(104696,5,3,0),t(104914,2,5,0),t(104986,2,4,0),t(105349,0,3,0),
  t(105566,0,3,0),t(105783,0,4,0),t(106001,0,5,0),t(106218,0,5,0),
  t(106436,0,4,0),t(106653,2,5,0),t(107088,0,3,0),t(107305,3,4,0),
  t(107523,3,3,0),t(107740,1,4,0),t(107957,0,3,0),f(108175,1,4),
  t(108610,5,4,0),t(108682,2,4,0),t(108827,1,3,0),t(108827,7,3,0),
  t(109044,0,3,0),t(109117,2,4,0),t(109262,5,3,0),t(109334,3,4,0),
  t(109479,7,3,0),t(109697,7,3,0),t(109914,7,3,0),t(110131,6,4,0),
  t(110566,6,4,0),t(110711,8,1,0),t(111001,6,4,0),t(111871,1,4,0),
  t(112016,2,5,0),t(112305,4,5,0),s(112740,113537,[[112740,3,3],[112885,1.5,3],[113030,1.5,3],[113175,0.5,3],[113320,0.5,3],[113465,0.5,3],[113537,1,3]]),t(113175,3,4,0),
  t(113610,6,4,0),t(113827,2,5,0),t(114045,5,5,0),t(114479,3,4,0),
  t(114914,6,4,0),t(115349,6,4,0),f(115784,3,4),t(116219,2,8,0),
  t(116653,1,4,0),t(117088,2,5,0),t(117523,0,4,0),t(117958,0,5,0),
  t(118393,1,4,0),t(118538,3,4,0),t(118827,5,4,0),s(119262,120204,[[119262,2,3],[119407,2,3],[119552,1.5,3],[119697,2,3],[119842,2.5,3],[119987,3,3],[120132,3.5,3],[120204,4,3]],1),
  t(119697,0,5,0),t(119914,0,3,0),h(120567,5,1,121726,0,[[120567,5,1],[120856,3,5],[121146,5,1],[121436,3,5],[121726,5,1]]),t(121001,7,3,0),
  t(121436,0,4,0),t(121871,1,4,0),t(122306,0,5,0),t(122523,0,5,0),
  t(122741,4,5,0),t(122958,2,5,0),t(123175,0,5,0),t(123393,0,5,0),
  t(123610,0,5,0),t(123973,2,5,0),t(124045,1,4,0),f(124190,0,4),
  t(124480,4,5,0),t(124770,0,4,0),t(124770,7,3,0),t(124915,4,4,0),
  t(124987,0,3,0),t(125349,4,5,0),t(125567,0,5,0),t(125784,3,4,0),
  t(126002,0,3,0),t(126219,1,3,0),t(126364,3,4,0),t(126654,5,4,4),
  t(127089,5,5,0),t(127523,0,5,0),t(127741,3,3,0),t(127958,4,5,0),
  t(128176,6,4,0),t(128320,3,4,0),t(128393,4,5,0),t(128683,7,3,0),
  t(128828,5,4,0),t(129263,5,4,0),f(129697,4,5),t(130132,5,5,0),
  t(130277,4,5,0),t(130350,1,4,0),t(130567,5,4,0),t(130784,2,5,0),
  t(131002,6,4,0),t(131437,4,5,0),t(131509,5,4,0),t(131726,3,4,0),
  t(131871,2,4,0),t(132089,1,4,0),t(132306,0,4,0),h(132668,3,1,133176,1,[[132668,3,1],[132958,2,3],[133176,1,5]]),
  t(133466,0,3,0),t(133611,3,4,0),f(133683,1,4),t(134045,4,5,0),
  t(134263,0,5,0),t(134480,3,3,0),t(134698,5,4,0),t(134842,6,4,0),
  t(134915,5,5,0),t(135132,0,4,0),t(135132,7,3,0),t(135350,2,5,0),
  t(135495,1,3,0),t(135567,5,4,0),t(135640,3,3,0),t(135785,0,5,0),
  t(136002,4,5,0),t(136219,0,5,0),t(136292,3,3,0),t(136437,0,5,0),
  t(136509,2,5,0),t(136654,1,3,0),t(136727,0,8,0),t(136872,0,5,0),
  t(137379,0,3,0),t(137524,3,4,0),t(138103,1,4,0),t(138176,5,3,0),
  t(138321,0,3,0),t(138393,0,5,0),t(138828,0,4,0),t(139045,1,3,0),
  t(139263,0,5,0),t(139408,1,4,0),h(139480,5,4,140132),t(140350,0,5,0),
  t(140567,3,4,0),f(140712,5,3),t(141002,7,3,0),t(141147,6,1,0),
  t(141437,0,5,0),t(141582,3,4,0),t(141654,0,5,0),t(141727,1,3,0),
  t(141872,3,3,0),t(142089,5,3,0),t(142306,6,4,0),t(142451,3,3,0),
  t(142524,5,4,0),t(142741,5,5,0),t(143176,5,4,0),t(143393,1,4,0),
  t(143611,2,5,0),t(143828,5,4,0),t(143901,5,1,0),t(144046,5,5,0),
  t(144263,6,4,0),t(144263,0,3,0),t(144408,7,3,0),t(144480,3,3,0),
  t(144698,5,5,0),t(144843,1,4,0),t(144915,2,5,0),t(145133,4,5,0),
  f(145350,7,3),t(145785,5,4,0),t(145930,7,3,0),t(146002,5,3,0),
  t(146220,5,5,0),t(146654,1,4,0),t(146872,5,4,0),t(147089,2,5,0),
  t(147307,6,4,0),t(147524,2,5,0),t(147741,5,4,0),t(147959,5,5,0),
  t(148176,5,3,0),t(148249,6,3,0),t(148394,3,4,0),t(148828,5,4,0),
  t(149046,1,3,0),t(149263,0,4,0),t(149481,1,3,0),s(149698,150350,[[149698,4,3],[149915,3,3],[150133,1.5,3],[150350,0,3]]),
  t(149988,1,4,0),f(150060,2,3),t(150568,2,5,0),t(151002,6,4,0),
  t(151220,5,4,0),t(151292,3,1,0),t(151437,1,3,0),t(151510,0,4,0),
  t(151655,3,4,0),t(151872,1,4,0),t(152089,0,3,0),h(152307,0,5,153031,0,[[152307,0,5],[152524,1,4],[152814,2,2],[153031,2,1]]),
  t(152669,5,4,0),t(152742,4,4,0),t(153176,3,4,0),t(153394,0,5,0),
  t(153611,0,4,0),t(154046,1,4,0),s(154263,155423,[[154263,2,3],[154481,3,3],[154698,3.5,3],[154916,4,3],[155133,4,3],[155350,4,3],[155423,4,3]]),t(154698,1,4,0),
  t(154916,2,8,0),t(155133,5,4,0),t(155495,3,3,0),t(155785,0,4,0),
  t(155785,7,3,0),f(156220,0,4),
// </six-eternel-beat-v3-expert-notes>
])(mhTap,mhHoldV2,mhFlick,mhSlideV2);
const sixEternelBeatMasterNotes=((t,h,f,s)=>[
// <six-eternel-beat-v3-master-notes>
  f(2157,2,2),t(2447,4,2,0),t(2447,8,2,0),t(2591,6,2,0),
  t(3026,8,2,0),t(3171,6,1,0),t(3316,4,2,0),s(4548,5200,[[4548,1.5,2],[4693,0,2],[4838,0,2],[4983,0,2],[5128,0.5,2],[5200,2,2]],1),
  t(4838,4,2,0),s(5490,6070,[[5490,1.5,2],[5635,1.5,2],[5780,1.5,2],[5925,3,2],[6070,4,2]]),t(6505,0,2,0),t(6867,2,2,0),
  t(7157,4,2,0),t(7302,6,1,0),h(8244,8,2,8606),t(8679,6,1,0),
  t(8896,4,2,0),t(9258,1,3,0),t(9838,0,2,0),t(10273,3,1,0),
  t(10345,6,2,0),t(11142,1,3,0),t(11577,5,3,0),t(11867,2,6,0),
  t(12157,7,3,0),f(12302,5,3),t(13027,3,3,0),t(13172,5,3,0),
  t(13969,5,3,0),t(14621,7,3,0),t(15201,4,1,0),t(15490,6,2,0),
  t(15490,2,2,0),t(15635,4,2,0),t(15708,0,2,0),h(16215,2,1,16722,0,[[16215,2,1],[16505,1,3],[16722,1,4]]),
  t(16795,2,1,0),h(17882,2,2,18462),t(18534,0,1,0),t(19186,2,1,0),
  t(19259,6,2,0),t(19766,3,3,0),t(19838,7,3,0),t(20128,3,4,0),
  t(20563,5,3,0),t(21143,7,3,0),t(21433,5,3,0),t(21723,3,3,0),
  t(21867,5,3,0),t(22302,3,3,0),f(22375,5,4),t(22737,3,3,0),
  t(23172,1,3,0),t(23607,0,4,0),t(23752,1,3,0),t(23824,0,3,0),
  t(23897,4,1,0),t(24041,1,3,0),t(24476,5,4,0),t(24911,0,3,0),
  t(25128,2,2,0),t(25563,4,2,0),t(25636,2,2,0),t(25781,0,2,0),
  t(25781,4,2,0),t(26071,4,2,0),t(26071,8,2,0),t(26360,0,2,0),
  t(26360,4,2,0),t(26650,4,2,0),t(26650,8,2,0),t(27085,3,4,0),
  t(27302,5,3,0),t(27520,1,4,0),t(27955,2,3,0),t(27955,7,3,0),
  t(28389,0,3,0),f(28534,1,3),t(28824,5,4,0),t(28897,1,3,0),
  t(29259,5,3,0),t(29404,6,4,0),t(29476,4,2,0),t(29694,7,3,0),
  t(29839,4,1,0),t(30129,1,4,0),t(30274,4,2,0),t(30563,5,4,0),
  t(30926,6,4,0),t(30998,1,3,0),t(31216,5,4,0),t(31433,3,4,0),
  t(31868,6,4,0),t(32737,3,3,0),t(32955,6,2,0),t(33172,1,3,0),
  t(33607,0,3,1),h(34042,0,4,34694),t(34911,1,3,0),t(35346,3,3,0),
  f(35781,5,4),t(36216,7,3,0),h(36651,6,4,37158,1),t(37665,0,2,0),
  h(37955,3,4,38462),t(38535,1,4,0),t(38825,5,3,0),t(39259,2,3,0),
  t(39259,7,3,0),t(39404,6,3,0),t(39694,1,3,0),s(39839,40491,[[39839,2,2],[39984,2,2],[40129,2,2],[40274,2.5,2],[40419,4,2],[40491,4,2]]),
  t(40129,5,3,0),t(40564,7,3,0),t(40854,5,3,0),t(40999,3,3,0),
  t(41288,5,4,0),t(41433,3,3,0),t(41868,1,4,0),t(42086,0,4,0),
  t(42303,1,3,0),t(42738,3,4,0),t(42883,2,1,0),f(43173,1,3),
  h(43607,1,4,44187,1,[[43607,1,4],[43897,2,3],[44187,3,1]]),t(44477,4,6,0),t(44694,2,2,0),t(44767,4,2,0),
  t(44912,0,3,0),h(45129,1,4,45854,1),t(46216,5,4,0),t(46651,3,4,0),
  t(47086,1,4,0),t(47521,0,3,0),t(47593,0,4,0),t(47955,1,4,0),
  t(48390,3,4,0),t(48608,6,2,0),t(48825,6,4,0),t(49115,7,3,0),
  t(49260,6,3,0),t(49695,6,4,0),t(49695,1,3,0),t(49912,6,4,0),
  t(50129,3,3,0),f(50564,6,4),t(50999,3,3,0),t(51216,6,4,0),
  t(51434,5,4,0),s(51651,52811,[[51651,3,2],[51869,2,2],[52086,1,2],[52303,1,2],[52521,1,2],[52738,0.5,2],[52811,0.5,2]],1),t(52303,5,4,0),t(53173,2,2,0),
  t(53390,3,3,0),t(53608,5,4,0),t(53825,7,3,0),t(53898,5,3,0),
  t(53970,4,3,0),s(54043,55057,[[54043,1.5,2],[54187,2.5,2],[54332,2.5,2],[54477,3,2],[54622,3.5,2],[54767,3.5,2],[54912,3.5,2],[55057,4,2]]),t(54405,0,3,0),t(54477,1,3,0),
  t(54622,3,3,0),t(54695,2,3,0),s(55274,56434,[[55274,0,2],[55492,2,2],[55709,4,2],[55927,2.5,2],[56144,1.5,2],[56361,3.5,2],[56434,3.5,2]]),t(55564,3,3,0),
  t(55637,4,3,0),t(55782,3,4,0),t(55854,3,3,0),t(56651,5,4,0),
  t(56724,2,2,0),t(57014,3,3,0),t(57304,0,3,0),f(57521,0,4),
  t(57811,1,3,0),t(57956,0,3,0),t(58028,1,3,0),t(58173,7,3,0),
  t(58173,2,3,0),t(58391,6,2,0),t(58608,4,2,0),t(58825,2,2,0),
  h(59260,0,4,59912),t(60130,1,4,0),t(60347,5,3,0),t(60492,3,3,0),
  t(60564,6,4,0),t(60782,0,2,0),t(60782,4,2,0),t(60999,1,2,0),
  t(60999,5,2,0),t(61217,3,2,0),t(61217,7,2,0),t(61434,4,2,0),
  t(61434,8,2,0),t(61869,3,4,0),t(62086,5,3,0),t(62159,7,3,0),
  t(62304,5,3,0),h(62521,5,1,63318,0,[[62521,5,1],[62811,4,3],[63028,4,3],[63318,5,1]]),t(63391,5,4,0),f(63608,4,2),
  t(63970,1,3,0),t(64043,4,2,0),t(64115,2,2,0),t(64478,3,4,0),
  t(64550,2,2,0),t(64912,0,4,0),t(65057,0,3,0),t(65275,1,3,0),
  t(65347,0,3,0),t(65637,1,3,0),t(65782,0,3,0),t(66072,3,3,0),
  t(66217,2,2,0),t(66217,6,2,0),t(66434,4,6,0),t(66507,3,3,0),
  t(66652,2,2,0),t(66869,6,2,0),t(67086,1,3,0),t(67159,5,3,0),
  t(67376,3,3,0),t(67449,5,3,0),f(67521,4,2),t(67884,2,2,0),
  t(67956,6,2,0),t(68391,1,4,0),t(68463,4,3,0),t(68826,0,4,0),
  t(69043,6,2,0),t(69260,1,3,0),t(69695,3,4,0),t(69985,0,3,0),
  t(70130,1,3,0),t(70420,0,2,0),t(70565,3,4,0),h(70782,6,4,71507),
  t(71652,5,4,0),s(71869,72377,[[71869,3,2],[72014,3,2],[72159,1,2],[72304,3.5,2],[72377,3.5,2]]),t(72594,2,2,0),t(72739,3,3,0),
  t(72884,5,3,0),t(72956,4,2,0),t(73101,3,3,0),h(73174,6,4,73753,1),
  t(74043,0,4,0),t(74188,3,1,0),t(74261,5,2,0),t(74478,0,3,0),
  t(74478,5,3,0),t(74695,2,2,0),f(74913,3,4),h(75203,6,2,75637),
  h(75782,3,3,76362),t(76435,5,3,0),s(76652,77304,[[76652,3,2],[76797,2.5,2],[76942,2.5,2],[77087,4,2],[77232,4,2],[77304,4,2]]),t(77522,5,4,0),
  t(77667,1,3,0),t(77956,3,4,2),t(78391,0,4,0),h(78464,3,3,79116),
  t(78826,7,3,0),t(79261,5,2,0),t(79333,1,3,0),t(79696,5,4,0),
  t(79768,1,3,0),t(79841,4,3,0),t(79913,0,4,0),t(80130,6,2,0),
  t(80275,2,1,0),t(80348,4,3,0),t(80420,0,3,0),t(80565,2,2,0),
  t(80783,5,4,0),t(80855,3,3,0),f(81000,8,2),t(81435,2,2,0),
  t(81507,5,4,0),t(81652,3,3,0),t(81870,8,2,0),t(82087,6,2,0),
  t(82159,6,4,0),t(82304,5,3,0),t(82304,0,3,0),t(82739,3,4,0),
  t(82812,1,4,0),s(83174,83826,[[83174,0,2],[83391,2,2],[83609,3.5,2],[83826,1.5,2]]),t(84044,3,3,0),t(84261,5,3,0),
  t(84478,0,3,0),t(84696,2,2,0),t(84768,5,1,0),t(84913,0,6,0),
  t(85131,0,2,0),f(85348,0,4),s(85638,86797,[[85638,1.5,2],[85855,2.5,2],[86073,3,2],[86290,3.5,2],[86507,3.5,2],[86725,2,2],[86797,2,2]]),t(86218,3,4,0),
  t(86435,5,4,0),t(86870,4,1,0),t(87015,5,3,0),t(87087,1,4,0),
  t(87522,3,3,0),t(87594,0,3,0),h(87667,1,4,88247,0,[[87667,1,4],[87957,3,1],[88247,1,4]]),t(88392,3,3,0),
  t(88826,1,4,0),t(88899,0,3,0),t(89044,1,4,0),t(89261,3,3,0),
  t(89696,5,4,0),t(89913,8,2,0),t(89986,5,2,0),t(90131,3,4,0),
  t(90203,4,3,0),t(90348,8,2,0),t(90348,4,2,0),f(90566,5,4),
  t(90928,3,4,0),t(91000,5,4,0),t(91218,3,3,0),h(91435,1,4,91942),
  t(92087,1,2,0),t(92087,6,2,0),t(92305,2,2,0),t(92305,7,2,0),
  t(92522,1,2,0),t(92522,8,2,0),t(92740,0,2,0),t(92740,8,2,0),
  t(93174,5,3,0),t(93609,3,3,0),t(93754,1,3,0),t(93827,0,3,0),
  t(94044,5,4,0),t(94261,1,3,0),t(94334,4,3,0),t(94479,0,4,0),
  t(94551,4,2,0),t(94696,5,3,0),t(94914,8,2,0),t(95131,5,3,0),
  t(95203,2,3,0),t(95348,5,4,0),t(95421,4,2,0),t(95566,1,3,0),
  f(95783,0,4),t(96218,1,4,3),t(96653,4,2,0),t(96870,6,1,0),
  t(97088,1,3,0),t(97160,6,1,0),t(97377,4,2,0),t(97522,2,2,0),
  t(97595,4,2,0),t(97812,6,2,0),t(97812,2,2,0),t(97957,7,3,0),
  t(98102,6,2,0),t(98392,3,4,0),t(98537,6,2,0),t(98827,5,4,0),
  t(98899,5,3,0),t(99044,0,2,0),t(99044,4,2,0),t(99262,4,2,0),
  t(99262,8,2,0),t(99479,0,2,0),t(99479,4,2,0),t(99696,4,2,0),
  t(99696,8,2,0),t(99914,5,3,0),t(100131,6,4,0),f(100204,1,3),
  t(100566,5,3,0),t(100638,3,3,0),t(100783,8,2,0),t(101001,4,2,0),
  t(101073,6,3,0),t(101435,7,3,0),t(101653,4,6,0),t(101870,4,2,0),
  t(102015,8,2,0),h(102088,4,2,102740),h(102957,1,3,103682,1),t(104044,0,3,0),
  t(104189,2,2,0),t(104262,5,2,0),t(104479,5,4,0),t(104696,2,2,0),
  t(104914,5,4,0),f(104986,3,3),t(105349,8,2,0),t(105349,4,2,0),
  t(105566,0,2,0),t(105566,4,2,0),t(105783,1,2,0),t(105783,5,2,0),
  t(106001,3,2,0),t(106001,7,2,0),t(106218,4,2,0),t(106218,8,2,0),
  t(106436,5,3,0),t(106653,3,4,0),t(106870,1,4,0),t(107088,0,2,0),
  t(107305,1,3,0),t(107523,0,2,0),t(107740,1,3,0),t(107957,4,2,0),
  t(108175,0,3,0),t(108610,1,3,0),t(108682,4,3,0),t(108827,2,2,0),
  t(109044,0,2,0),t(109117,2,3,0),t(109262,0,2,0),t(109334,1,3,0),
  t(109479,0,2,0),t(109697,2,2,0),t(109914,4,2,0),f(110131,5,3),
  t(110566,3,3,0),t(110711,6,1,0),t(111001,3,3,0),t(111436,1,3,0),
  t(111871,0,3,0),t(112016,1,4,0),t(112305,1,4,0),t(112305,7,3,0),
  s(112740,113537,[[112740,3,2],[112885,1.5,2],[113030,1.5,2],[113175,0.5,2],[113320,0.5,2],[113465,0.5,2],[113537,1,2]]),t(113175,3,3,0),t(113610,7,3,0),t(113827,3,4,0),
  t(114045,6,4,0),t(114479,3,3,0),t(114914,5,3,0),t(115059,7,3,0),
  t(115349,5,3,0),t(115494,4,2,0),t(115784,5,3,0),t(116219,6,4,0),
  t(117088,6,4,0),t(117523,3,3,0),t(117740,6,4,0),t(117958,3,4,0),
  t(118393,0,3,0),f(118538,4,3),t(118827,1,3,0),s(119262,120204,[[119262,3,2],[119407,2.5,2],[119552,2,2],[119697,2.5,2],[119842,3,2],[119987,3.5,2],[120132,4,2],[120204,4,2]],1),
  t(119697,3,4,0),t(119914,8,2,0),h(120567,4,1,121726,0,[[120567,4,1],[120856,4,2],[121146,3,3],[121436,3,3],[121726,3,4]]),t(121001,6,4,0),
  t(121436,0,3,4),t(121871,1,3,0),t(122306,3,4,0),t(122523,0,4,0),
  t(122668,4,2,0),t(122741,0,4,0),t(122958,0,4,0),t(123175,0,4,0),
  t(123393,0,4,0),t(123610,0,4,0),t(123610,6,3,0),t(123973,1,4,0),
  t(124045,5,3,0),t(124190,3,3,0),t(124480,4,6,0),t(124697,1,3,0),
  t(124770,4,3,0),t(124915,5,3,0),f(124987,3,2),t(125349,2,2,0),
  t(125349,6,2,0),t(125567,2,2,0),t(125567,7,2,0),t(125784,1,2,0),
  t(125784,8,2,0),t(126002,0,2,0),t(126002,8,2,0),t(126219,6,2,0),
  t(126364,1,3,0),t(126654,3,3,0),t(126871,0,2,0),t(127089,5,4,0),
  t(127306,3,4,0),t(127523,1,4,0),t(127741,0,2,0),t(127958,3,4,0),
  t(128176,5,3,0),t(128393,6,4,0),t(128683,6,2,0),t(128828,3,3,0),
  t(129045,1,4,0),t(129263,0,3,0),t(129697,1,4,0),f(129842,0,3),
  t(130132,1,4,0),t(130277,3,4,0),t(130350,4,3,0),t(130567,1,3,0),
  t(130567,6,3,0),t(130784,5,4,0),t(131002,3,3,0),t(131364,8,1,0),
  t(131437,4,4,0),t(131509,6,3,0),t(131726,3,3,0),t(131871,7,3,0),
  t(132089,5,3,0),t(132234,3,3,0),t(132306,2,3,0),h(132668,0,3,133176,1),
  t(133466,2,2,0),t(133611,0,3,0),f(133683,1,3),t(134045,3,4,0),
  t(134118,1,3,0),t(134263,5,4,0),t(134480,4,2,0),t(134698,7,3,0),
  t(134842,5,3,0),t(134915,1,4,0),t(135132,3,3,0),t(135350,0,4,0),
  t(135495,6,2,0),t(135567,3,3,0),t(135640,5,2,0),t(135785,0,4,0),
  t(136002,1,4,0),t(136147,5,3,0),t(136219,5,4,0),t(136292,4,2,0),
  t(136437,5,4,0),t(136509,1,4,0),t(136654,0,2,0),t(136727,0,4,0),
  t(136872,1,4,0),t(136872,7,3,0),t(137379,6,2,0),t(137524,7,3,0),
  t(137741,3,3,0),t(138103,5,3,0),t(138176,2,2,0),t(138321,0,2,0),
  f(138393,0,4),t(138828,0,3,0),t(139045,2,2,0),t(139263,0,4,0),
  t(139408,1,3,0),h(139480,5,4,140132,0,[[139480,5,4],[139843,5,3],[140132,6,1]]),t(140350,0,6,0),t(140567,3,3,0),
  f(140712,6,2),t(141002,8,2,0),t(141147,6,1,0),t(141437,1,4,0),
  t(141582,3,3,0),t(141654,2,4,0),t(141727,6,2,0),t(141872,4,2,0),
  t(142089,2,2,0),t(142234,0,3,0),t(142306,1,3,0),t(142451,4,2,0),
  t(142524,1,3,0),t(142741,0,4,0),t(142741,6,3,0),t(142959,4,1,0),
  t(143104,1,3,0),t(143176,0,3,0),t(143393,1,3,0),t(143611,3,4,0),
  t(143828,1,3,0),t(143901,4,1,0),t(144046,1,4,0),t(144118,3,3,0),
  t(144263,5,3,0),t(144408,8,2,0),t(144480,5,2,0),t(144698,6,4,0),
  t(144843,1,3,0),t(144915,5,4,0),t(145133,3,4,0),t(145350,8,2,0),
  t(145567,5,3,0),t(145785,3,3,0),t(145930,2,2,0),t(146002,4,2,0),
  t(146220,5,4,0),t(146437,1,3,0),t(146654,3,3,0),t(146872,0,3,0),
  t(147089,5,4,0),t(147307,1,3,0),t(147524,3,4,0),t(147741,0,3,0),
  t(147886,5,3,0),t(147959,5,4,0),t(148176,6,2,0),t(148249,3,2,0),
  f(148394,5,3),t(148828,2,3,0),t(148828,7,3,0),t(149046,2,2,0),
  t(149263,0,3,0),t(149481,4,2,0),s(149698,150350,[[149698,4,2],[149915,3,2],[150133,1.5,2],[150350,0,2]]),t(149988,5,3,0),
  f(150060,3,2),t(150568,3,4,0),t(150785,0,2,0),t(151002,3,3,0),
  t(151220,1,3,0),t(151292,4,1,0),t(151437,2,2,0),t(151510,5,3,0),
  t(151655,3,3,0),t(151872,1,3,0),t(151945,4,2,0),t(152089,6,2,0),
  h(152307,9,1,153031,0,[[152307,9,1],[152524,7,3],[152814,7,3],[153031,9,1]]),t(152669,5,3,0),t(152742,6,3,0),t(153176,3,3,0),
  t(153394,6,4,0),t(153611,5,3,0),t(154046,3,3,0),s(154263,155423,[[154263,3,2],[154481,4,2],[154698,4,2],[154916,4,2],[155133,4,2],[155350,4,2],[155423,4,2]]),
  t(154698,7,3,0),t(154916,4,6,0),t(155133,5,3,0),t(155495,4,2,0),
  t(155785,5,3,0),t(156003,4,2,0),t(156220,5,3,0),t(156220,0,3,0),
  f(156655,7,3),
// </six-eternel-beat-v3-master-notes>
])(mhTap,mhHoldV2,mhFlick,mhSlideV2);
const sixEternelBeatCharts=Object.freeze({
  EASY:mhChart(1,sixEternelBeatEasyNotes,SIX_ETERNEL_BEAT_DURATION_MS),
  NORMAL:mhChart(3,sixEternelBeatNormalNotes,SIX_ETERNEL_BEAT_DURATION_MS),
  HARD:mhChart(5,sixEternelBeatHardNotes,SIX_ETERNEL_BEAT_DURATION_MS),
  EXPERT:mhChart(7,sixEternelBeatExpertNotes,SIX_ETERNEL_BEAT_DURATION_MS),
  MASTER:mhChart(9,sixEternelBeatMasterNotes,SIX_ETERNEL_BEAT_DURATION_MS),
});

// SIX ÉTERNEL ドパガキリミックス（モンビー用ショート）。作り方は上と同じ。
const SIX_ETERNEL_REMIX_BEAT_DURATION_MS=150410;
const sixEternelRemixBeatEasyNotes=((t,h,f,s)=>[
// <six-eternel-remix-beat-v3-easy-notes>
  t(2559,0,3,0),t(2559,7,3,0),h(2928,4,3,3758,0,[[2928,4,3],[3389,3,4],[3758,2,6]]),t(4773,0,10,0),
  h(5880,4,6,6710),t(8462,4,6,0),t(9200,2,6,0),h(9938,1,4,11413),
  t(12151,0,4,0),h(13627,0,6,15102),t(15840,2,6,0),t(16209,0,6,0),
  t(17316,2,6,0),t(17685,4,6,0),t(18054,4,6,0),t(19529,4,6,0),
  t(19898,5,4,0),h(20267,4,6,21282),t(21743,0,4,0),t(22480,0,6,0),
  t(23218,2,6,0),t(23587,5,4,0),t(23956,4,6,0),t(25063,3,4,0),
  t(25432,5,4,0),t(25801,6,4,0),t(26538,4,6,0),t(26907,2,6,0),
  t(28383,0,6,0),t(28936,3,4,0),t(29121,0,6,0),t(29859,2,6,0),
  t(30412,4,6,0),t(30596,2,6,0),t(30965,1,4,0),t(31334,0,6,1),
  t(32441,0,6,0),t(32810,0,6,0),t(33917,0,4,0),t(35023,0,6,0),
  t(35392,2,6,0),t(35761,5,4,0),t(36868,2,6,0),h(37237,4,6,38528),
  t(38713,4,6,0),h(39819,4,6,41110,0,[[39819,4,6],[40188,4,6],[40465,5,4],[40834,5,4],[41110,6,3]]),t(41295,6,4,0),t(41664,4,6,0),
  t(42771,5,4,0),t(43508,0,10,0),t(44246,0,3,0),t(44246,7,3,0),
  t(45353,0,6,0),t(45722,1,4,0),t(46091,2,6,0),t(47197,1,4,0),
  t(48304,2,6,0),t(48673,1,4,0),t(49042,0,6,0),t(49780,0,6,0),
  t(50149,3,4,0),t(51255,4,6,0),t(51624,3,4,0),t(51993,0,6,0),
  t(53100,0,4,0),t(54022,0,6,0),h(54945,0,6,56236),t(57158,0,6,0),
  t(57527,3,4,0),t(58449,5,4,0),t(58634,4,6,0),t(59003,4,6,0),
  t(59371,4,6,0),t(60109,2,6,0),t(60478,1,4,0),t(60847,0,6,2),
  t(61216,0,6,0),t(61954,3,4,0),t(62323,5,4,0),t(62876,2,6,0),
  t(63061,4,6,0),t(63429,3,4,0),t(63798,5,4,0),t(64905,6,4,0),
  t(65274,6,4,0),t(66750,4,6,0),t(67119,6,4,0),t(67487,4,6,0),
  t(67856,2,6,0),t(68410,0,6,0),t(69332,0,4,0),t(69701,0,6,0),
  t(70808,0,3,0),t(70808,7,3,0),t(71177,0,6,0),t(71914,0,10,0),
  t(72283,1,4,0),t(72652,0,6,0),t(73390,0,6,0),t(73759,0,4,0),
  t(74128,0,6,0),t(74866,0,6,0),h(75604,2,3,76895,0,[[75604,2,3],[75972,1,4],[76249,0,6],[76618,1,4],[76895,2,3]]),t(77079,0,6,0),
  t(77817,2,6,0),t(78186,5,4,0),t(78555,4,6,0),t(78924,6,4,0),
  t(80399,5,4,0),h(80584,5,4,81598),t(82059,3,4,0),t(82613,5,4,0),
  t(83351,4,6,0),t(83720,4,6,0),h(84088,5,4,85380),t(85564,1,4,0),
  t(85933,2,6,0),t(86671,4,6,0),t(87040,6,4,0),t(87409,4,6,0),
  t(87962,5,4,0),t(88515,6,4,0),t(88884,6,4,0),t(89622,2,6,0),
  t(89991,5,4,0),t(90360,4,6,3),t(90913,5,4,0),t(91098,4,6,0),
  t(91467,4,6,0),t(91651,2,6,0),t(92204,1,4,0),t(92942,0,4,0),
  t(93865,1,4,0),t(94049,2,6,0),t(94418,0,3,0),t(94418,7,3,0),
  t(95525,0,6,0),t(95894,0,4,0),t(96262,0,6,0),t(96816,1,4,0),
  t(97000,0,10,0),t(97369,0,4,0),t(97738,0,6,0),t(98476,0,6,0),
  t(98845,0,4,0),t(99214,0,6,0),t(99952,0,6,0),t(100320,0,6,0),
  t(100689,2,6,0),t(101427,4,6,0),t(101796,6,4,0),h(102903,4,6,104286,0,[[102903,4,6],[103272,5,4],[103641,6,3],[103917,5,4],[104286,4,6]]),
  t(104378,6,4,0),t(105670,4,6,0),t(106039,4,6,0),t(106961,3,4,0),
  t(107699,4,6,0),t(108252,4,6,0),t(109543,3,4,0),t(109912,5,4,0),
  t(110650,6,4,0),t(111388,4,6,0),t(112495,4,6,0),h(113232,4,6,114708),
  t(115077,5,4,0),t(115446,3,4,0),t(115815,1,4,0),t(116553,0,4,0),
  t(116921,1,4,0),t(117290,3,4,0),t(118766,5,4,0),t(119135,2,6,4),
  t(119873,0,6,0),t(120242,2,6,0),t(120611,4,6,0),t(120979,3,4,0),
  t(121717,0,3,0),t(121717,7,3,0),t(122086,2,6,0),t(122455,5,4,0),
  t(122824,3,4,0),t(123562,1,4,0),t(123931,0,4,0),t(124669,1,4,0),
  t(125037,3,4,0),t(125406,5,4,0),t(125775,0,10,0),t(126144,4,6,0),
  t(126882,3,4,0),t(127066,5,4,0),t(127989,3,3,0),t(128358,5,4,0),
  t(128727,4,6,0),t(129095,5,4,0),t(129464,2,6,0),t(129833,5,4,0),
  t(130202,4,6,0),t(130756,4,6,0),t(130940,4,6,0),t(131309,6,4,0),
  t(132416,0,6,0),t(132785,3,4,0),t(133338,5,4,0),t(133522,6,4,0),
  t(133891,4,6,0),t(134076,2,6,0),h(134629,2,3,135828,0,[[134629,2,3],[134998,0,6],[135459,1,4],[135828,2,3]]),t(136105,0,6,0),
  t(136474,0,6,0),t(137211,3,4,0),t(137580,0,6,0),t(138318,0,6,0),
  t(138503,0,6,0),t(139056,0,6,0),t(139425,0,6,0),t(139794,0,4,0),
  t(140163,1,4,0),t(140532,3,4,0),t(140901,7,3,0),t(140901,0,3,0),
  t(141454,6,4,0),t(142561,4,6,0),t(143298,3,4,0),t(144221,2,6,0),
  t(144959,4,6,0),t(145328,2,6,0),t(146434,5,4,0),t(146619,3,4,0),
  t(146988,1,4,0),t(147910,0,6,0),t(148094,0,6,0),t(148648,0,10,0),
// </six-eternel-remix-beat-v3-easy-notes>
])(mhTap,mhHoldV2,mhFlick,mhSlideV2);
const sixEternelRemixBeatNormalNotes=((t,h,f,s)=>[
// <six-eternel-remix-beat-v3-normal-notes>
  t(2559,2,2,0),h(2928,6,2,3758,1,[[2928,6,2],[3389,5,4],[3758,4,6]]),t(4773,0,10,0),f(5511,1,3),
  h(5880,0,6,6710),t(8462,0,6,0),t(9200,2,6,0),h(9938,5,3,11413),
  t(12151,0,3,0),t(12151,7,3,0),t(12335,4,6,0),h(13627,4,6,15102),
  t(15840,4,6,0),t(16209,2,6,0),h(16578,0,6,18054),t(19529,0,6,0),
  t(19898,3,4,0),t(20083,1,4,0),h(20267,4,6,21282,1),t(22112,2,6,0),
  t(22480,4,6,0),t(22849,3,3,0),t(23218,0,6,0),t(23587,3,3,0),
  t(23956,4,6,0),f(25063,3,3),t(25432,5,3,0),t(25801,7,3,0),
  t(26538,4,6,0),t(26907,4,6,0),t(27645,3,4,0),t(28383,4,6,0),
  t(28936,1,4,0),t(29121,0,6,0),t(29859,0,6,0),t(30412,0,6,0),
  t(30596,0,6,0),t(30781,0,6,0),t(31334,0,6,0),t(32072,2,6,1),
  t(32441,4,6,0),t(32810,4,6,0),t(33917,5,4,0),t(35023,0,6,0),
  f(35392,2,6),t(35761,5,4,0),t(36499,4,6,0),t(36868,4,6,0),
  h(37237,2,6,38528),t(38713,0,6,0),h(39819,0,6,41110,0,[[39819,0,6],[40188,0,4],[40465,0,4],[40834,1,3],[41110,1,2]]),t(41295,0,3,0),
  t(41295,7,3,0),t(41664,4,6,0),t(42771,6,4,0),t(43508,4,6,0),
  t(43877,0,10,0),t(44246,1,4,0),t(45353,0,6,0),t(45722,1,4,0),
  t(46091,2,6,0),t(46829,4,6,0),t(47197,6,4,0),t(48304,4,6,0),
  f(48673,5,4),t(49042,2,6,0),t(49780,0,6,0),t(50149,0,4,0),
  t(51071,5,4,0),t(51255,0,6,0),t(51624,3,4,0),t(51993,0,6,0),
  t(53100,3,4,0),t(53469,0,6,0),t(54022,0,6,0),h(54945,0,6,56236),
  t(56420,0,6,0),t(57158,2,6,0),t(57527,6,4,0),t(58449,3,4,0),
  t(58634,4,6,0),t(59003,0,6,0),t(59187,5,4,0),f(59371,2,6),
  t(60109,4,6,0),t(60478,7,3,0),t(60478,0,3,0),t(60847,0,6,2),
  t(61216,2,6,0),t(61954,0,4,0),t(62323,0,3,0),t(62876,0,6,0),
  t(63061,2,6,0),t(63429,5,4,0),t(63798,6,4,0),t(64905,3,4,0),
  t(65274,6,4,0),t(65643,5,4,0),t(66750,2,6,0),t(67119,5,4,0),
  t(67487,4,6,0),t(67856,4,6,0),t(68410,4,6,0),f(69332,1,4),
  t(69701,4,6,0),t(70439,2,6,0),t(70808,6,4,0),t(71177,0,10,0),
  t(71730,3,4,0),t(71914,0,6,0),t(72283,0,3,0),t(72652,0,6,0),
  t(73390,2,6,0),t(73759,5,4,0),t(74128,4,6,0),t(74866,4,6,0),
  t(75235,5,4,0),h(75604,6,2,76895,0,[[75604,6,2],[75972,5,4],[76249,4,6],[76618,5,4],[76895,6,2]]),t(77079,2,6,0),t(77817,4,6,0),
  t(78186,0,3,0),t(78186,7,3,0),t(78555,4,6,0),f(78924,5,4),
  t(79662,3,3,0),t(80399,1,3,0),h(80584,0,3,81598),t(81875,1,3,0),
  t(82059,0,4,0),t(82613,1,4,0),t(83351,0,6,0),t(83720,0,6,0),
  h(84088,0,4,85380),t(85564,5,4,0),t(85933,0,6,0),t(86671,2,6,0),
  t(87040,0,4,0),t(87409,0,6,0),t(87962,0,4,0),t(88146,0,6,0),
  h(88515,0,4,89438),t(89622,0,6,0),f(89991,3,4),t(90360,4,6,3),
  t(90913,6,4,0),t(91098,4,6,0),t(91467,2,6,0),t(91651,0,6,0),
  t(91836,0,6,0),t(92204,1,4,0),t(92942,0,4,0),t(93865,1,4,0),
  t(94049,0,6,0),t(94418,0,3,0),t(94418,7,3,0),t(94787,0,6,0),
  t(95525,2,6,0),t(95894,6,4,0),t(96262,4,6,0),t(97000,0,10,0),
  t(97369,6,4,0),f(97738,4,6),t(98291,6,4,0),t(98476,4,6,0),
  t(98845,6,4,0),t(99214,4,6,0),t(99767,5,4,0),t(99952,4,6,0),
  t(100320,4,6,0),t(100689,4,6,0),t(101427,2,6,0),t(101796,0,4,0),
  h(102534,0,6,104010,0,[[102534,0,6],[102903,1,4],[103272,2,2],[103641,1,4],[104010,0,6]]),t(104194,0,3,0),t(104378,1,3,0),t(105670,2,6,0),
  t(106039,0,6,0),t(106961,0,3,0),t(107699,0,6,0),t(108252,2,6,0),
  t(109543,0,3,0),f(109912,3,4),t(110650,6,4,0),t(111388,2,6,0),
  t(111757,4,6,0),t(112495,4,6,0),h(113232,4,6,114708,1),t(115077,1,3,0),
  t(115446,7,3,0),t(115446,0,3,0),t(115815,3,4,0),t(116553,6,4,0),
  t(116921,3,3,0),t(117290,5,3,0),t(117659,7,3,0),t(118766,3,3,0),
  t(119135,4,6,0),t(119504,3,4,4),t(119873,4,6,0),t(120242,4,6,0),
  t(120611,0,6,0),f(120979,3,4),t(121717,0,4,0),t(122086,4,6,0),
  t(122455,3,4,0),t(122824,1,3,0),t(123562,0,4,0),t(123931,1,4,0),
  t(124300,5,4,0),t(124669,3,3,0),t(125037,7,3,0),t(125406,5,4,0),
  t(125591,0,10,0),t(125775,4,6,0),t(126144,2,6,0),t(126882,5,3,0),
  t(127066,6,4,0),t(127989,2,2,0),t(128358,3,3,0),t(128727,4,6,0),
  f(129095,7,3),t(129464,2,6,0),t(129833,7,3,0),t(129833,0,3,0),
  t(130202,4,6,0),t(130756,4,6,0),t(130940,4,6,0),t(131124,3,3,0),
  t(131678,0,6,0),t(132416,0,6,0),t(132785,5,3,0),t(133338,1,4,0),
  t(133522,3,3,0),t(133891,0,6,0),t(134076,0,6,0),t(134260,3,3,0),
  h(134629,6,2,135828,0,[[134629,6,2],[134998,5,4],[135459,5,4],[135828,6,2]]),t(136105,2,6,0),t(136474,4,6,0),t(136843,4,6,0),
  f(137211,5,3),t(138318,4,6,0),t(138503,4,6,0),t(138687,3,4,0),
  t(139056,0,6,0),t(139425,2,6,0),t(139794,5,3,0),t(140163,3,3,0),
  t(140532,1,4,0),t(140901,0,4,0),t(141454,3,3,0),t(142561,0,6,0),
  t(144221,0,6,0),t(144959,0,6,0),t(145328,0,6,0),t(146434,1,3,0),
  t(146619,5,3,0),t(146803,0,3,0),t(146803,7,3,0),t(147910,4,6,0),
  f(148094,4,6),t(148648,0,10,0),
// </six-eternel-remix-beat-v3-normal-notes>
])(mhTap,mhHoldV2,mhFlick,mhSlideV2);
const sixEternelRemixBeatHardNotes=((t,h,f,s)=>[
// <six-eternel-remix-beat-v3-hard-notes>
  t(2559,2,1,0),f(2928,5,3),t(3297,4,1,0),t(4404,6,3,0),
  t(4404,0,3,0),t(4773,1,8,0),t(5511,1,3,0),h(5880,4,1,6710,1,[[5880,4,1],[6341,3,3],[6710,2,5]]),
  t(7355,2,5,0),h(7724,4,5,8277),t(8462,2,5,0),t(9200,0,5,0),
  s(9938,11413,[[9938,2,3],[10214,0,3],[10491,0,3],[10768,0.5,3],[11044,0.5,3],[11321,0.5,3],[11413,0.5,3]]),t(12151,1,3,0),t(12335,0,5,0),h(13627,0,5,15102),
  t(15840,0,5,0),t(16025,0,5,0),t(16209,2,5,0),h(16578,2,5,18054),
  t(18422,4,5,0),t(19529,0,5,0),t(19898,5,4,0),t(20083,3,4,0),
  h(20267,5,5,21282,1),f(21743,1,3),t(22112,2,5,0),t(22480,4,5,0),
  t(22849,7,3,0),t(23034,2,5,0),t(23218,4,5,0),t(23587,7,3,0),
  t(23956,4,5,0),t(24694,7,3,0),t(25063,5,3,0),t(25247,2,5,0),
  t(25432,1,3,0),t(25801,0,3,0),t(25985,2,5,0),t(26538,0,5,0),
  t(26723,4,5,0),t(26907,5,5,0),t(27645,3,4,0),t(28383,4,5,0),
  f(28567,0,5),t(28936,0,4,0),t(28936,7,3,0),t(29121,0,5,0),
  t(29305,0,5,0),t(29859,0,5,0),t(30043,0,5,0),t(30412,2,5,0),
  t(30596,0,5,0),t(30781,2,5,0),t(30873,1,5,0),t(31334,2,5,0),
  t(31519,4,5,0),t(32072,5,5,1),t(32441,4,5,0),t(32810,2,5,0),
  t(33179,4,5,0),t(33917,6,4,0),s(34286,35577,[[34286,3,3],[34470,3,3],[34655,3,3],[34839,3,3],[35023,3,3],[35208,4,3],[35392,4,3],[35577,4,3]]),t(35761,6,4,0),
  t(36499,5,5,0),f(36868,5,5),h(37237,5,5,38528),t(38713,0,8,0),
  t(39450,4,5,0),s(39819,41110,[[39819,2,3],[40004,2,3],[40188,2,3],[40373,1,3],[40557,2,3],[40742,2,3],[40926,2.5,3],[41110,3,3]]),t(41295,6,4,0),h(41664,4,5,42217),
  t(42402,2,5,0),t(42771,1,4,0),h(43508,0,5,44338,0,[[43508,0,5],[43969,1,3],[44338,2,1]]),t(44431,0,4,0),
  t(44615,2,5,0),t(45353,0,5,0),t(45722,5,4,0),t(46091,2,5,0),
  t(46829,5,5,0),t(47013,0,5,0),t(47197,3,4,0),t(47566,4,5,0),
  t(48120,6,4,0),t(48120,0,3,0),t(48304,4,5,0),t(48673,3,4,0),
  f(49042,4,5),h(49411,5,5,50149,1),t(50518,7,3,0),t(50887,3,3,0),
  t(51071,5,4,0),t(51255,0,5,0),t(51624,3,4,0),t(51993,0,5,0),
  t(52731,4,5,0),t(53100,3,4,0),t(53469,0,5,0),t(53838,0,3,0),
  t(54022,0,5,0),t(54576,3,4,0),s(54945,56236,[[54945,3,3],[55129,4,3],[55313,4,3],[55498,3.5,3],[55682,3.5,3],[55867,3.5,3],[56051,3,3],[56236,3,3]]),t(56420,2,5,0),
  s(56789,57988,[[56789,3,3],[56974,3,3],[57158,3,3],[57342,3,3],[57527,4,3],[57711,4,3],[57896,4,3],[57988,4,3]],1),t(58449,3,4,0),t(58541,5,4,0),t(59003,5,5,0),
  t(59187,1,4,0),f(59371,4,5),t(59925,3,4,0),t(60109,5,5,0),
  t(60478,3,4,0),t(60847,4,5,2),t(61216,5,5,0),t(61400,5,4,0),
  t(61585,7,3,0),t(61769,4,5,0),t(61954,3,4,0),t(62138,1,4,0),
  t(62323,3,3,0),t(62876,4,5,0),h(63061,1,5,63798,1),t(64167,0,4,0),
  t(64167,7,3,0),t(64536,1,4,0),t(64905,3,4,0),t(65274,5,4,0),
  t(65643,3,4,0),t(66012,2,8,0),f(66381,2,5),t(66750,5,5,0),
  t(67119,3,4,0),t(67487,0,5,0),t(67672,3,4,0),t(67856,4,5,0),
  t(68410,5,5,0),t(68963,5,3,0),t(69332,6,4,0),t(69701,0,5,0),
  t(70070,3,3,0),t(70254,5,4,0),t(70439,5,5,0),t(70808,5,4,0),
  h(71177,4,1,71914,0,[[71177,4,1],[71546,2,5],[71914,4,1]]),t(72099,0,5,0),t(72283,5,3,0),t(72652,0,5,0),
  t(73021,5,4,0),t(73206,1,4,0),f(73390,4,5),t(73759,6,4,0),
  t(73943,4,5,0),t(74128,2,5,0),t(74681,1,4,0),t(74866,2,5,0),
  t(75235,5,4,0),s(75604,76895,[[75604,3,3],[75788,3,3],[75972,3,3],[76157,3,3],[76341,4,3],[76526,4,3],[76710,4,3],[76895,4,3]]),t(77079,0,5,0),t(77633,5,4,0),
  t(77817,2,5,0),t(78186,6,4,0),t(78186,0,3,0),t(78370,5,4,0),
  t(78555,5,5,0),t(78924,6,4,0),t(79108,5,4,0),t(79293,2,5,0),
  t(79662,1,3,0),t(80215,0,4,0),t(80399,1,3,0),s(80584,81598,[[80584,3,3],[80768,3,3],[80953,2,3],[81137,2,3],[81322,1,3],[81506,2,3],[81598,3,3]]),
  t(81875,0,3,0),f(82059,3,4),t(82428,1,4,0),t(82613,5,4,0),
  t(82982,2,5,0),t(83351,5,5,0),t(83720,4,5,0),t(83904,5,5,0),
  h(84088,5,4,85380),t(85564,6,4,0),t(85933,4,5,0),h(86302,3,4,86947),
  t(87040,3,4,0),t(87409,1,8,0),t(87962,5,4,0),t(88146,5,5,0),
  t(88331,2,5,0),t(88515,5,4,0),t(88884,1,3,3),t(89253,3,4,0),
  t(89438,0,4,0),f(89622,0,5),t(89991,1,4,0),t(90175,3,4,0),
  t(90360,0,5,0),s(90729,92204,[[90729,1,3],[91006,1.5,3],[91282,1.5,3],[91559,2.5,3],[91836,2.5,3],[92112,3,3],[92204,3,3]]),t(92297,0,4,0),t(92942,3,4,0),
  t(93311,0,3,0),t(93496,3,4,0),t(93865,0,4,0),t(94049,2,5,0),
  t(94418,3,4,0),t(94787,0,5,0),t(95340,0,4,0),t(95525,0,5,0),
  h(95894,3,5,96631,0,[[95894,3,5],[96262,5,1],[96631,3,5]]),t(96816,5,3,0),t(96908,1,4,0),t(97369,3,4,0),
  t(97554,0,4,0),f(97738,4,5),t(98291,3,4,0),t(98476,0,5,0),
  h(98660,0,4,99398),t(99583,0,3,0),t(99767,1,4,0),t(99952,2,5,0),
  t(100320,4,5,0),t(100689,2,5,0),t(100874,0,5,0),h(101243,0,4,101981),
  t(102165,1,4,0),s(102534,104010,[[102534,3,3],[102811,1.5,3],[103087,1,3],[103364,1.5,3],[103641,1.5,3],[103917,1.5,3],[104010,1.5,3]]),t(104194,3,3,0),t(104378,5,3,0),
  t(104563,3,3,0),t(105301,0,5,0),t(105670,2,5,0),t(106039,4,5,0),
  t(106961,0,3,0),f(107330,3,3),t(107699,0,5,0),t(108252,4,5,0),
  t(108621,2,5,0),t(109359,5,5,0),t(109543,5,3,0),t(109912,0,4,0),
  t(109912,7,3,0),t(110650,1,4,0),t(111019,0,3,0),t(111388,0,8,0),
  t(111757,2,5,0),t(112126,5,3,0),t(112495,2,5,0),t(112863,7,3,0),
  s(113232,114708,[[113232,2,3],[113509,3.5,3],[113786,3.5,3],[114062,3.5,3],[114339,3.5,3],[114616,4,3],[114708,4,3]]),t(114892,3,4,0),t(115077,3,3,0),h(115446,5,3,116184),
  t(116276,2,5,0),t(116553,5,4,0),f(116921,7,3),t(117290,5,3,0),
  t(117475,2,5,0),t(117659,5,3,0),t(117844,7,3,0),t(118028,3,4,0),
  t(118766,1,3,0),t(119135,0,5,4),t(119504,1,4,0),t(119688,0,5,0),
  t(119873,2,5,0),t(120242,0,5,0),t(120426,4,5,0),t(120611,2,5,0),
  t(120979,6,4,0),t(121348,5,4,0),t(121717,1,4,0),t(122086,2,5,0),
  t(122271,5,3,0),t(122455,6,4,0),f(122824,5,3),t(123193,7,3,0),
  t(123377,5,3,0),t(123562,3,4,0),t(123931,0,4,0),t(123931,7,3,0),
  t(124300,0,4,0),t(124669,1,3,0),t(125037,5,3,0),t(125222,2,5,0),
  t(125406,6,4,0),t(125591,5,5,0),t(125775,4,5,0),t(126144,2,5,0),
  t(126329,5,3,0),t(126513,6,4,0),t(126882,0,3,0),t(126974,1,3,0),
  t(127435,3,3,0),t(127897,1,3,0),t(127989,5,1,0),t(128358,0,3,0),
  t(128542,1,4,0),f(128727,0,5),t(129095,1,3,0),t(129280,3,4,0),
  t(129464,4,5,0),t(129833,6,4,0),t(130202,1,8,0),t(130387,1,3,0),
  t(130756,0,5,0),t(130940,0,5,0),t(131124,5,3,0),t(131309,3,3,0),
  t(131678,5,5,0),t(131862,3,3,0),t(132231,6,4,0),f(132416,2,5),
  t(132785,7,3,0),t(132969,1,3,0),t(133153,3,3,0),t(133338,5,4,0),
  t(133522,7,3,0),t(133707,6,4,0),t(133891,4,5,0),t(134076,2,5,0),
  t(134260,1,3,0),t(134445,0,3,0),t(134629,0,3,0),t(135090,1,3,0),
  t(135367,0,5,0),t(135551,3,3,0),t(135736,0,3,0),t(135920,0,3,0),
  t(136105,0,5,0),t(136474,0,5,0),t(136658,1,4,0),t(136843,2,5,0),
  t(137211,5,3,0),t(137396,7,3,0),t(137580,4,5,0),h(138318,6,1,138964,0,[[138318,6,1],[138687,5,3],[138964,4,5]]),
  t(139056,5,5,0),f(139425,5,5),t(139794,1,3,0),t(139886,5,4,0),
  t(140163,3,3,0),t(140439,5,5,0),t(140532,3,4,0),t(140901,1,4,0),
  t(141454,0,3,0),t(141546,1,4,0),t(142468,3,3,0),t(142561,1,5,0),
  t(143298,0,3,0),t(144221,0,5,0),t(144959,0,5,0),t(145328,0,5,0),
  t(146434,5,3,0),t(146619,1,3,0),t(146803,3,3,0),t(146988,0,3,0),
  t(146988,6,3,0),t(147910,0,5,0),f(148094,0,5),t(148463,0,5,0),
  t(148648,0,8,0),
// </six-eternel-remix-beat-v3-hard-notes>
])(mhTap,mhHoldV2,mhFlick,mhSlideV2);
const sixEternelRemixBeatExpertNotes=((t,h,f,s)=>[
// <six-eternel-remix-beat-v3-expert-notes>
  t(2283,1,3,0),t(2283,7,3,0),t(2559,6,1,0),s(2928,3758,[[2928,2,3],[3113,2,3],[3297,3.5,3],[3482,1,3],[3666,1,3],[3758,1,3]],1),
  f(4404,5,3),t(4773,1,8,0),t(5511,1,3,0),h(5880,4,1,6710,0,[[5880,4,1],[6341,3,3],[6710,2,5]]),
  t(7078,1,3,0),h(7724,5,5,8277),t(8462,0,5,0),t(9200,5,5,0),
  s(9938,11413,[[9938,3.5,3],[10214,1.5,3],[10491,0.5,3],[10768,1,3],[11044,1.5,3],[11321,1.5,3],[11413,1.5,3]]),t(10306,6,4,0),t(10675,0,5,0),t(12059,0,5,0),
  t(12151,1,3,0),t(12335,0,5,0),h(13627,0,5,15102,1),t(13996,1,3,0),
  t(14364,2,5,0),t(14733,2,5,0),t(15840,0,2,0),t(15840,4,2,0),
  t(16025,2,2,0),t(16025,6,2,0),t(16209,4,2,0),t(16209,8,2,0),
  h(16578,5,5,18054,1),t(17131,4,5,0),f(17316,2,5),t(17685,0,5,0),
  t(18422,4,5,0),t(19529,1,2,0),t(19529,5,2,0),t(19714,3,2,0),
  t(19714,7,2,0),t(19898,1,2,0),t(19898,5,2,0),t(20083,1,4,0),
  h(20267,2,5,21282,1),t(20636,5,3,0),t(20820,5,5,0),t(21743,1,3,0),
  t(22112,0,2,0),t(22112,4,2,0),t(22480,2,2,0),t(22480,6,2,0),
  t(22849,4,2,0),t(22849,8,2,0),t(23034,2,5,0),t(23218,4,5,0),
  t(23587,7,3,0),t(23587,1,3,0),t(23956,4,5,0),f(24325,3,3),
  t(24694,5,3,0),t(25063,1,2,0),t(25063,5,2,0),t(25247,3,2,0),
  t(25247,7,2,0),t(25432,1,2,0),t(25432,5,2,0),t(25801,3,3,0),
  t(25985,0,5,0),t(26538,4,5,0),t(26907,5,5,0),t(27645,3,4,0),
  t(28383,4,5,0),t(28567,0,5,0),t(28660,0,5,0),t(28936,1,4,0),
  t(29121,2,5,0),t(29305,0,5,0),t(29859,4,5,0),t(30043,0,5,0),
  t(30412,2,5,0),t(30596,0,5,0),t(30781,0,5,0),t(30873,2,5,0),
  f(30965,1,4),t(31334,2,5,0),t(31519,0,5,0),t(31611,4,5,0),
  t(32072,0,5,1),t(32441,4,5,0),t(32810,5,5,0),t(33179,5,5,0),
  t(33917,5,4,0),s(34286,35577,[[34286,3,3],[34470,3,3],[34655,3,3],[34839,2.5,3],[35023,2.5,3],[35208,4,3],[35392,4,3],[35577,4,3]]),t(35023,0,5,0),t(35208,2,8,0),
  t(35761,0,4,0),t(35761,7,3,0),t(36499,5,5,0),t(36868,4,5,0),
  h(37237,4,5,38528,0,[[37237,4,5],[37606,5,4],[37882,5,3],[38251,6,2],[38528,6,1]]),t(37790,4,5,0),f(38713,5,5),t(39450,2,5,0),
  s(39819,41110,[[39819,2,3],[40096,2,3],[40373,0.5,3],[40649,1.5,3],[40926,3,3],[41110,3.5,3]]),t(40188,0,5,0),t(41295,0,4,0),h(41664,4,5,42217),
  t(42402,0,5,0),t(42771,5,4,0),h(43508,0,5,44338),t(43877,4,5,0),
  t(44431,0,4,0),t(44615,2,5,0),t(45353,0,5,0),t(45722,5,4,0),
  t(46091,2,5,0),t(46829,5,5,0),t(47013,0,5,0),t(47197,3,4,0),
  t(47566,4,5,0),t(48120,6,4,0),f(48304,4,5),t(48673,3,4,0),
  t(49042,0,5,0),h(49411,2,5,50149,1),t(49780,0,5,0),t(50887,5,3,0),
  t(51071,3,4,0),t(51255,0,5,0),t(51624,0,4,0),t(51993,0,5,0),
  t(52547,3,4,0),t(52731,0,5,0),t(53100,0,4,0),t(53100,7,3,0),
  t(53469,0,5,0),t(53838,5,3,0),t(54022,2,5,0),t(54576,6,4,0),
  s(54945,56236,[[54945,2,3],[55221,4,3],[55498,2.5,3],[55775,1,3],[56051,0.5,3],[56236,0,3]]),t(55498,3,4,0),t(55682,4,5,0),f(55867,5,5),
  t(56420,4,5,0),s(56789,57988,[[56789,2,3],[56974,2,3],[57158,2,3],[57342,2,3],[57527,4,3],[57711,4,3],[57896,4,3],[57988,4,3]],1),t(57158,4,5,0),t(57527,6,4,0),
  t(58449,1,4,0),t(58541,2,4,0),t(58634,4,5,0),t(59003,5,5,0),
  t(59187,3,4,0),t(59371,5,5,0),t(59925,3,4,0),t(60109,5,5,0),
  t(60478,3,4,0),t(60847,4,5,2),t(61216,5,5,0),t(61400,5,4,0),
  t(61585,7,3,0),t(61769,2,5,0),t(61954,5,4,0),t(62138,1,4,0),
  t(62323,0,3,0),f(62507,1,3),t(62876,1,8,0),h(63061,6,1,63798,1,[[63061,6,1],[63429,4,5],[63798,6,1]]),
  t(63429,3,4,0),h(64167,1,4,64905),t(64536,0,4,0),t(65274,1,4,0),
  t(65643,0,4,0),t(65643,7,3,0),t(66012,4,5,0),t(66381,0,5,0),
  t(66750,5,5,0),t(67119,3,4,0),t(67487,0,5,0),t(67672,5,4,0),
  t(67856,2,5,0),t(68410,5,5,0),t(68963,3,3,0),f(69332,6,4),
  t(69701,4,5,0),t(70070,3,3,0),t(70254,1,4,0),t(70439,0,5,0),
  t(70808,1,4,0),h(71177,2,5,71914),h(72099,4,5,72652),t(72837,4,5,0),
  t(73021,6,4,0),t(73206,6,4,0),t(73390,4,5,0),t(73759,1,4,0),
  t(73943,2,5,0),t(74128,0,5,0),t(74681,1,4,0),t(74866,2,5,0),
  t(75235,5,4,0),s(75604,76895,[[75604,0,3],[75880,0,3],[76157,1,3],[76434,2.5,3],[76710,3.5,3],[76895,4,3]]),f(76341,0,5),t(77079,4,5,0),
  t(77448,4,1,0),t(77633,6,4,0),t(77817,4,5,0),t(78186,1,4,0),
  t(78555,0,5,0),t(78924,1,4,0),t(79108,0,4,0),t(79108,7,3,0),
  t(79293,4,5,0),t(79662,1,3,0),t(80030,3,4,0),t(80215,5,4,0),
  t(80399,7,3,0),s(80584,81598,[[80584,3,3],[80768,3,3],[80953,2,3],[81137,2,3],[81322,0.5,3],[81506,1.5,3],[81598,3,3]]),t(81137,1,4,0),t(81875,3,3,0),
  t(82059,0,4,0),t(82428,1,4,0),t(82613,3,4,0),f(82982,4,5),
  t(83351,2,5,0),t(83535,1,4,0),t(83720,2,5,0),t(83904,0,5,0),
  h(84088,5,5,85380,0,[[84088,5,5],[84457,6,3],[84734,7,1],[85103,6,3],[85380,5,5]]),t(84457,2,5,0),t(84826,1,3,0),t(85011,0,4,0),
  t(85564,5,4,0),t(85933,1,8,0),h(86302,1,4,86947),t(87040,0,4,0),
  t(87409,0,5,0),t(87962,0,4,0),t(88146,0,5,0),t(88331,0,5,0),
  t(88515,3,4,0),t(88700,1,4,0),f(88884,0,3),t(89253,1,4,0),
  t(89438,3,4,0),t(89622,0,5,0),t(89991,0,4,0),t(89991,7,3,0),
  t(90360,4,5,3),s(90729,92204,[[90729,2,3],[91006,2.5,3],[91282,2.5,3],[91559,3.5,3],[91836,4,3],[92112,4,3],[92204,4,3]]),t(91098,4,5,0),t(91282,3,4,0),
  t(91467,0,5,0),t(91559,2,4,0),t(91651,1,5,0),t(91743,3,4,0),
  t(91836,4,5,0),t(92297,6,4,0),t(92481,1,4,0),t(92942,5,4,0),
  t(93311,3,3,0),t(93496,6,4,0),t(93865,1,4,0),f(94049,4,5),
  t(94418,3,4,0),t(94787,5,5,0),t(95340,3,4,0),t(95525,5,5,0),
  h(95894,5,4,96631),t(96262,2,5,0),t(96816,1,3,0),t(96908,0,4,0),
  t(97000,2,5,0),t(97369,1,4,0),t(97554,0,4,0),t(97738,0,5,0),
  t(98291,3,4,0),t(98476,0,5,0),h(98660,5,4,99398),t(99583,0,3,0),
  t(99767,3,4,0),t(99952,0,5,0),t(100136,5,3,0),f(100320,2,5),
  t(100689,5,5,0),t(100874,2,5,0),h(101243,6,4,101981),t(102165,6,4,0),
  t(102165,0,3,0),s(102534,104010,[[102534,4,3],[102811,2,3],[103087,0.5,3],[103364,0,3],[103641,0.5,3],[103917,0.5,3],[104010,0.5,3]]),t(102903,0,5,0),t(103272,0,5,0),
  t(103456,1,3,0),t(103641,3,3,0),t(104194,5,3,0),t(104378,7,3,0),
  t(104563,5,3,0),t(105301,2,5,0),t(105670,4,5,0),t(106039,5,5,0),
  t(106961,5,3,0),t(107145,3,3,0),t(107330,1,3,0),f(107699,0,5),
  t(108252,0,8,0),t(108621,0,5,0),t(109359,0,5,0),t(109543,1,3,0),
  t(109912,0,4,0),t(110650,1,4,0),t(111019,3,3,0),t(111388,4,5,0),
  t(111757,2,5,0),t(112126,5,3,0),t(112495,0,5,0),t(112863,5,3,0),
  s(113232,114708,[[113232,1.5,3],[113509,3,3],[113786,3.5,3],[114062,3.5,3],[114339,3.5,3],[114616,3.5,3],[114708,4,3]]),t(113601,3,3,0),t(113786,0,5,0),t(113970,0,5,0),
  t(114155,1,3,0),t(114339,0,3,0),t(114892,0,4,0),t(114892,7,3,0),
  f(115077,3,3),h(115446,6,1,116184,0,[[115446,6,1],[115815,5,3],[116184,4,5]]),t(115815,8,2,0),t(116276,4,5,0),
  t(116553,3,4,0),t(116737,1,4,0),t(116921,3,3,0),t(117290,7,3,0),
  t(117475,4,5,0),t(117659,3,3,0),t(117844,5,3,0),t(118028,3,4,0),
  t(118766,1,3,0),t(119135,0,5,4),t(119504,1,4,0),t(119688,0,5,0),
  t(119873,2,5,0),t(120242,0,5,0),t(120426,4,5,0),f(120611,2,5),
  t(120979,6,4,0),t(121348,5,4,0),t(121717,6,4,0),t(121902,5,3,0),
  t(122086,2,5,0),t(122271,1,3,0),t(122455,0,4,0),t(122824,0,3,0),
  t(123193,1,3,0),t(123377,3,3,0),t(123562,1,4,0),t(123931,0,4,0),
  t(124300,1,4,0),t(124669,0,3,0),t(125037,1,3,0),t(125222,2,5,0),
  t(125406,5,4,0),t(125591,5,5,0),f(125775,4,5),t(126144,2,5,0),
  t(126329,1,3,0),t(126329,7,3,0),t(126513,0,4,0),t(126882,0,3,0),
  t(126974,1,3,0),t(127066,0,4,0),t(127435,1,3,0),t(127897,3,3,0),
  t(127989,8,1,0),t(128358,3,3,0),t(128450,6,4,0),t(128542,5,4,0),
  t(128727,0,8,0),t(129095,1,3,0),t(129280,3,4,0),t(129464,4,5,0),
  t(129833,6,4,0),t(130018,5,3,0),t(130202,2,5,0),f(130387,1,3),
  t(130756,0,5,0),t(130940,2,5,0),t(131124,6,3,0),t(131309,3,3,0),
  t(131678,5,5,0),t(131862,1,3,0),t(132231,5,4,0),t(132416,2,5,0),
  t(132785,7,3,0),t(132969,1,3,0),t(133153,3,3,0),t(133338,5,4,0),
  t(133522,7,3,0),t(133707,6,4,0),t(133891,4,5,0),t(134076,2,5,0),
  t(134260,1,3,0),t(134260,7,3,0),t(134445,0,3,0),s(134629,135828,[[134629,2,3],[134814,0,3],[134998,1.5,3],[135182,1.5,3],[135367,2,3],[135551,2.5,3],[135736,2,3],[135828,2,3]]),
  t(135090,1,3,0),t(135275,0,4,0),f(135367,0,5),t(135920,3,3,0),
  t(136105,4,5,0),t(136474,5,5,0),t(136843,4,5,0),t(137211,1,3,0),
  t(137396,3,3,0),t(137580,4,5,0),t(138226,7,3,0),h(138318,5,5,138964,0,[[138318,5,5],[138687,6,3],[138964,7,1]]),
  t(139056,5,5,0),t(139425,5,5,0),t(139794,7,3,0),t(139886,1,4,0),
  t(139978,5,3,0),t(140163,3,3,0),t(140439,5,5,0),t(140532,6,4,0),
  t(140808,5,3,0),f(140901,3,4),t(141454,5,3,0),t(141546,6,4,0),
  t(142468,5,3,0),t(142561,0,5,0),t(142653,3,3,0),t(143298,0,3,0),
  t(144221,0,5,0),t(144959,0,5,0),t(145328,0,5,0),t(146434,5,3,0),
  t(146619,3,3,0),t(146803,1,3,0),t(146988,0,3,0),t(146988,6,3,0),
  t(147910,0,5,0),t(148094,0,5,0),t(148463,0,5,0),t(148648,0,8,0),
  f(148832,3,4),
// </six-eternel-remix-beat-v3-expert-notes>
])(mhTap,mhHoldV2,mhFlick,mhSlideV2);
const sixEternelRemixBeatMasterNotes=((t,h,f,s)=>[
// <six-eternel-remix-beat-v3-master-notes>
  t(2283,2,2,0),t(2283,6,2,0),t(2559,6,1,0),s(2928,3758,[[2928,2,2],[3113,2,2],[3297,3.5,2],[3482,1,2],[3666,1,2],[3758,1,2]],1),
  t(3297,5,1,0),f(4404,4,2),t(4773,0,6,0),t(5511,0,2,0),
  h(5880,3,1,6710,1,[[5880,3,1],[6341,2,3],[6710,1,4]]),t(7078,0,2,0),t(7355,0,4,0),h(7724,1,4,8277),
  t(8462,1,4,0),t(9200,3,4,0),s(9938,11413,[[9938,3,2],[10214,0.5,2],[10491,0.5,2],[10768,1,2],[11044,1,2],[11321,1,2],[11413,1,2]],1),t(10306,3,3,0),
  t(10583,2,4,0),t(10675,2,4,0),t(12059,5,4,0),t(12151,7,2,0),
  t(12335,5,4,0),h(13627,3,4,15102,1),t(13996,8,2,0),t(14180,4,4,0),
  t(14364,5,4,0),f(14733,3,4),t(15840,0,4,0),t(16025,3,4,0),
  t(16209,1,4,0),h(16578,5,4,18054),t(17131,3,4,0),t(17316,6,4,0),
  t(17685,5,4,0),t(18238,3,4,0),t(18422,5,4,0),t(18422,0,3,0),
  t(19529,1,2,0),t(19529,5,2,0),t(19714,4,2,0),t(19714,8,2,0),
  t(19898,1,2,0),t(19898,5,2,0),t(20083,4,2,0),t(20083,8,2,0),
  h(20267,5,4,21282,1),t(20636,4,2,0),t(20820,1,4,0),t(21743,0,2,0),
  t(22112,1,4,0),f(22480,3,4),t(22849,0,2,0),t(22849,4,2,0),
  t(23034,1,2,0),t(23034,5,2,0),t(23218,3,2,0),t(23218,7,2,0),
  t(23403,4,2,0),t(23403,8,2,0),t(23587,8,2,0),t(23956,3,4,0),
  t(24325,6,2,0),t(24694,4,2,0),t(25063,2,2,0),t(25247,5,4,0),
  t(25432,2,2,0),t(25801,4,2,0),t(25985,0,4,0),t(26354,2,2,0),
  t(26538,0,4,0),t(26723,0,4,0),t(26907,0,4,0),t(26907,6,3,0),
  f(27184,0,4),t(27645,5,3,1),t(28383,3,4,0),t(28567,1,4,0),
  t(28660,0,4,0),t(28936,5,3,0),t(29121,1,4,0),t(29305,3,4,0),
  t(29674,0,4,0),t(29859,3,4,0),t(30043,1,4,0),t(30412,3,4,0),
  t(30596,5,4,0),t(30781,2,6,0),t(30873,5,4,0),t(30965,3,3,0),
  t(31334,5,4,0),t(31519,3,4,0),f(31611,6,4),t(32072,2,2,0),
  t(32072,6,2,0),t(32441,2,2,0),t(32441,7,2,0),t(32810,1,2,0),
  t(32810,8,2,0),t(33179,0,2,0),t(33179,8,2,0),t(33363,2,2,0),
  t(33917,0,3,0),t(33917,5,3,0),s(34286,35577,[[34286,0,2],[34562,0,2],[34839,0,2],[35116,1,2],[35392,3.5,2],[35577,4,2]]),t(35023,2,4,0),
  t(35208,0,4,0),t(35761,1,3,0),t(35946,0,3,0),t(36499,0,4,0),
  t(36868,0,4,0),h(37237,0,4,38528,0,[[37237,0,4],[37606,1,3],[37882,1,3],[38251,1,2],[38528,2,1]]),t(37790,5,4,0),t(37975,2,4,0),
  t(38713,3,4,0),f(39450,0,4),s(39819,41110,[[39819,3,2],[40004,3,2],[40188,3,2],[40373,1.5,2],[40557,3,2],[40742,3,2],[40926,3,2],[41110,4,2]]),t(40188,3,4,0),
  t(40557,1,4,0),t(41295,0,3,0),h(41664,0,4,42217),t(42402,6,4,0),
  t(42771,1,3,0),h(43508,5,4,44338),t(43877,1,4,0),t(44431,3,3,0),
  t(44615,5,4,0),t(45353,6,4,0),t(45722,3,3,0),t(46091,6,4,0),
  t(46644,3,3,0),t(46829,5,4,0),t(46829,0,3,0),t(47013,3,4,0),
  t(47197,1,3,0),f(47566,0,4),t(48120,5,3,0),t(48304,1,4,0),
  t(48673,3,3,0),t(49042,0,4,0),t(49226,1,3,0),h(49411,5,4,50149,1),
  t(49780,3,4,0),t(50518,8,2,0),t(50887,6,2,0),t(51071,5,3,0),
  t(51255,6,4,0),t(51624,7,3,0),t(51993,1,4,0),t(52547,3,3,0),
  t(52731,0,2,0),t(52731,4,2,0),t(53100,4,2,0),t(53100,8,2,0),
  t(53469,0,2,0),t(53469,4,2,0),t(53838,4,2,0),t(53838,8,2,0),
  f(54022,1,4),t(54391,0,4,0),t(54576,1,3,0),s(54945,56236,[[54945,2,2],[55221,4,2],[55498,2.5,2],[55775,1,2],[56051,0.5,2],[56236,0,2]]),
  t(55498,6,3,0),t(55682,2,6,0),t(55867,2,4,0),t(56420,5,4,0),
  t(56420,0,3,0),s(56789,57988,[[56789,2,2],[56974,2,2],[57158,2,2],[57342,2,2],[57527,4,2],[57711,4,2],[57896,4,2],[57988,4,2]]),t(57158,6,4,0),t(57527,5,3,0),
  s(58173,59279,[[58173,2,2],[58357,2,2],[58541,3,2],[58726,4,2],[58910,1.5,2],[59095,3,2],[59279,3,2]]),t(58541,1,3,0),t(58634,0,4,0),t(59371,5,4,0),
  t(59925,1,3,0),t(60109,3,4,0),t(60294,0,2,0),f(60478,1,3),
  t(60847,3,4,2),t(61216,0,2,0),t(61216,4,2,0),t(61400,1,2,0),
  t(61400,5,2,0),t(61585,3,2,0),t(61585,7,2,0),t(61769,4,2,0),
  t(61769,8,2,0),t(61954,5,3,0),t(62138,7,3,0),t(62323,2,2,0),
  t(62507,6,2,0),t(62599,3,4,0),t(62876,6,4,0),h(63061,7,1,63798,0,[[63061,7,1],[63429,5,4],[63798,7,1]]),
  t(63429,3,3,0),t(63983,1,4,0),t(63983,7,3,0),h(64167,0,3,64905,1),
  t(64536,1,3,0),t(65274,5,3,0),f(65643,0,3),t(66012,2,2,0),
  t(66012,6,2,0),t(66381,2,2,0),t(66381,7,2,0),t(66750,1,2,0),
  t(66750,8,2,0),t(67119,0,2,0),t(67119,8,2,0),t(67303,5,3,0),
  t(67487,3,4,0),t(67672,0,3,0),t(67856,1,4,0),t(68410,3,4,0),
  t(68594,6,2,0),t(68963,8,2,0),t(69332,1,3,0),t(69701,5,4,0),
  t(69885,3,3,0),t(70070,8,2,0),t(70254,3,3,0),f(70439,6,4),
  t(70808,3,3,0),t(70992,6,4,0),h(71177,3,4,71914),h(72099,6,4,72652,0,[[72099,6,4],[72376,8,1],[72652,6,4]]),
  t(72837,6,4,0),t(73021,7,3,0),t(73021,2,3,0),t(73206,7,3,0),
  t(73390,5,4,0),t(73759,1,3,0),t(73943,3,4,0),t(74128,0,4,0),
  t(74681,1,3,0),t(74866,3,4,0),t(75050,4,6,0),t(75235,7,3,0),
  s(75604,76895,[[75604,0,2],[75880,0,2],[76157,1,2],[76434,2.5,2],[76710,3.5,2],[76895,4,2]]),t(76157,5,3,0),t(76341,4,4,0),f(77079,6,4),
  t(77448,6,1,0),t(77633,3,3,0),t(77817,1,4,0),t(78186,0,3,0),
  t(78370,1,3,0),t(78555,3,4,0),t(78924,1,3,0),t(79108,3,3,0),
  t(79293,5,4,0),t(79662,8,2,0),t(79846,5,3,0),t(80030,1,3,0),
  t(80215,3,3,0),t(80399,0,2,0),t(80399,4,2,0),s(80584,81598,[[80584,1.5,2],[80768,1.5,2],[80953,0.5,2],[81137,0.5,2],[81322,0,2],[81506,0,2],[81598,1.5,2]]),
  t(81137,3,3,0),t(81691,5,3,0),t(81875,8,2,0),f(82059,5,3),
  t(82428,3,3,0),t(82613,1,3,0),t(82982,0,4,0),t(83351,1,4,0),
  t(83535,5,3,0),t(83720,3,4,0),t(83904,6,4,0),h(84088,3,3,85380),
  t(84457,6,4,0),t(84642,7,3,0),t(84826,6,2,0),t(85011,7,3,0),
  t(85564,5,3,0),t(85749,4,2,0),t(85933,1,4,0),h(86302,5,3,86947),
  t(87040,1,3,0),f(87409,3,4),t(87778,0,3,0),t(87962,5,3,0),
  t(88146,1,4,0),t(88146,7,3,0),t(88331,1,4,0),s(88515,89438,[[88515,1.5,2],[88700,1,2],[88884,1,2],[89069,1,2],[89253,1,2],[89438,3.5,2]]),
  t(88884,0,2,0),t(89622,3,4,3),t(89991,5,3,0),t(90175,3,3,0),
  t(90360,1,4,0),s(90729,92204,[[90729,3,2],[91006,3.5,2],[91282,3.5,2],[91559,4,2],[91836,4,2],[92112,4,2],[92204,4,2]]),t(91098,1,4,0),t(91282,5,3,0),
  t(91467,3,4,0),t(91559,5,3,0),t(91651,3,4,0),t(91743,5,3,0),
  f(91836,3,4),t(92297,7,3,0),t(92481,1,3,0),t(92942,3,3,0),
  t(93311,6,2,0),t(93496,7,3,0),t(93865,5,3,0),t(94049,2,6,0),
  t(94326,1,3,0),t(94418,3,3,0),t(94787,1,4,0),t(95340,0,3,0),
  t(95525,1,4,0),t(95525,7,3,0),t(95709,0,2,0),h(95894,3,3,96631),
  t(96262,6,4,0),t(96816,2,2,0),t(96908,0,3,0),f(97000,1,4),
  t(97369,3,3,0),t(97554,1,3,0),t(97738,0,4,0),t(97923,1,3,0),
  t(98291,3,3,0),t(98476,5,4,0),h(98660,7,3,99398),t(99583,0,2,0),
  t(99767,3,3,0),t(99952,1,4,0),t(100136,6,2,0),t(100320,3,4,0),
  t(100505,7,3,0),t(100689,5,4,0),t(100874,6,4,0),h(101243,5,3,101981),
  f(102165,7,3),s(102534,104010,[[102534,4,2],[102811,2,2],[103087,0.5,2],[103364,0,2],[103641,0.5,2],[103917,0.5,2],[104010,0.5,2]]),t(102903,5,4,0),t(103087,2,3,0),
  t(103272,1,4,0),t(103456,3,2,0),t(103641,3,2,0),t(104194,2,2,0),
  t(104286,0,2,0),t(104378,2,2,0),t(104563,0,2,0),t(104563,4,2,0),
  t(105301,1,4,0),t(105670,3,4,0),t(106039,6,4,0),t(106961,8,2,0),
  t(107145,4,2,0),t(107330,6,2,0),t(107699,1,4,0),t(108252,3,4,0),
  h(108621,0,4,109359),f(109543,2,2),t(109912,5,3,0),t(110097,3,3,0),
  t(110650,7,3,0),t(111019,0,2,0),t(111203,1,4,0),t(111388,3,4,0),
  t(111757,5,4,0),t(112126,8,2,0),t(112495,5,4,0),t(112863,8,2,0),
  t(113048,5,2,0),t(113048,0,2,0),s(113232,114708,[[113232,0,2],[113509,2,2],[113786,3.5,2],[114062,3.5,2],[114339,3.5,2],[114616,4,2],[114708,4,2]]),t(113601,7,2,0),
  t(113786,5,4,0),t(113970,4,6,0),t(114155,5,2,0),t(114339,5,2,0),
  t(114892,7,3,0),f(115077,8,2),h(115446,3,1,116184,0,[[115446,3,1],[115815,2,3],[116184,1,4]]),t(115815,0,2,0),
  t(116276,5,4,0),t(116553,7,3,0),t(116737,1,3,0),t(116921,6,2,0),
  t(117290,4,2,0),t(117475,6,4,0),t(117659,4,2,0),t(117844,8,2,0),
  t(118028,5,3,0),t(118397,7,3,0),t(118766,4,2,0),t(119135,5,4,4),
  t(119504,7,3,0),t(119688,5,4,0),f(119873,3,4),t(120242,5,4,0),
  t(120426,1,4,0),t(120426,7,3,0),t(120611,3,4,0),t(120795,1,2,0),
  t(120979,1,3,0),t(121348,5,3,0),t(121717,7,3,0),t(121902,6,2,0),
  t(122086,3,4,0),t(122271,2,2,0),t(122455,0,3,0),t(122824,0,2,0),
  t(123193,2,2,0),t(123285,0,3,0),t(123377,2,2,0),t(123562,3,3,0),
  t(123931,5,3,0),t(124300,3,3,0),t(124392,2,2,0),f(124669,0,2),
  t(125037,2,2,0),t(125222,3,4,0),t(125406,5,3,0),t(125591,6,4,0),
  t(125775,3,4,0),t(125960,6,2,0),t(126144,1,4,0),t(126329,0,2,0),
  t(126513,2,3,0),t(126513,7,3,0),h(126882,2,2,127343),t(127435,6,2,0),
  t(127897,4,2,0),t(127989,8,1,0),t(128358,6,2,0),t(128450,3,3,0),
  t(128542,2,3,0),f(128727,0,4),t(129095,2,2,0),t(129280,3,3,0),
  t(129464,5,4,0),t(129833,7,3,0),t(130018,6,2,0),t(130110,2,2,0),
  t(130202,3,4,0),t(130387,0,2,0),t(130756,0,6,0),t(130940,0,4,0),
  t(131124,4,2,0),t(131309,0,2,0),t(131493,3,3,0),t(131678,5,4,0),
  t(131862,4,2,0),t(132231,1,3,0),f(132416,0,4),t(132785,2,2,0),
  t(132785,6,2,0),t(132969,6,2,0),t(133153,4,2,0),t(133338,7,3,0),
  t(133522,6,2,0),t(133707,7,3,0),t(133799,6,2,0),t(133891,6,4,0),
  t(134076,1,4,0),t(134168,3,2,0),t(134260,6,2,0),t(134445,8,2,0),
  s(134629,135828,[[134629,2,2],[134814,0,2],[134998,1.5,2],[135182,1.5,2],[135367,2,2],[135551,2.5,2],[135736,2,2],[135828,2,2]]),t(135090,1,2,0),t(135275,0,3,0),t(135367,1,4,0),
  t(135920,0,2,0),t(136105,1,4,0),t(136474,3,4,0),t(136658,1,3,0),
  f(136843,0,4),t(137211,2,2,0),t(137211,6,2,0),t(137396,0,2,0),
  t(137488,1,3,0),t(137580,0,4,0),t(138226,4,2,0),h(138318,1,4,138964,0,[[138318,1,4],[138687,2,3],[138964,3,1]]),
  t(139056,5,4,0),t(139333,2,2,0),t(139425,3,4,0),t(139794,6,2,0),
  t(139886,7,3,0),t(139978,4,2,0),t(140163,8,2,0),t(140255,4,2,0),
  t(140439,6,4,0),t(140532,7,3,0),t(140808,6,2,0),f(140901,3,3),
  t(141454,6,2,0),t(141546,7,3,0),t(142468,6,2,0),t(142561,1,4,0),
  t(142653,4,2,0),t(143298,0,2,0),t(144221,0,4,0),t(144959,0,4,0),
  t(145328,0,4,0),t(146434,6,2,0),t(146619,4,2,0),t(146803,2,2,0),
  t(146988,0,2,0),t(147910,0,4,0),t(148094,0,4,0),t(148463,1,4,0),
  t(148463,7,3,0),t(148648,0,6,0),f(148832,3,3),
// </six-eternel-remix-beat-v3-master-notes>
])(mhTap,mhHoldV2,mhFlick,mhSlideV2);
const sixEternelRemixBeatCharts=Object.freeze({
  EASY:mhChart(1,sixEternelRemixBeatEasyNotes,SIX_ETERNEL_REMIX_BEAT_DURATION_MS),
  NORMAL:mhChart(3,sixEternelRemixBeatNormalNotes,SIX_ETERNEL_REMIX_BEAT_DURATION_MS),
  HARD:mhChart(5,sixEternelRemixBeatHardNotes,SIX_ETERNEL_REMIX_BEAT_DURATION_MS),
  EXPERT:mhChart(7,sixEternelRemixBeatExpertNotes,SIX_ETERNEL_REMIX_BEAT_DURATION_MS),
  MASTER:mhChart(9,sixEternelRemixBeatMasterNotes,SIX_ETERNEL_REMIX_BEAT_DURATION_MS),
});

// SIX ÉTERNEL ドパガキリミックス（全尺4分58秒）。先行公開はこちらを使う。
// 上の「（ショート）」はデバッグ曲が使っているので残す。
const SIX_ETERNEL_REMIX_DURATION_MS=298620;
const sixEternelRemixEasyNotes=((t,h,f,s)=>[
// <six-eternel-remix-v3-easy-notes>
  t(2666,0,3,0),t(2666,7,3,0),t(3228,3,3,0),t(4540,5,4,0),
  h(5852,6,3,6695,0,[[5852,6,3],[6320,5,4],[6695,4,6]]),t(6789,0,10,0),t(8288,2,6,0),t(9038,0,6,0),
  h(10162,0,4,11662),t(12036,0,6,0),t(12224,1,4,0),t(13348,5,4,0),
  t(13911,2,6,0),t(14473,0,6,0),t(15222,0,3,0),t(16534,0,6,0),
  t(17284,0,6,0),t(17659,2,6,0),t(18034,2,6,0),t(19158,5,4,0),
  t(19533,4,6,0),t(20470,5,4,0),t(21407,3,4,0),t(21969,5,4,0),
  t(22344,2,6,0),t(22719,0,6,0),t(22906,2,6,0),t(23843,4,6,0),
  t(27404,1,4,0),t(27591,3,4,0),t(28341,4,6,0),t(28529,4,6,0),
  t(28903,6,4,0),t(29278,4,6,0),t(29840,2,6,0),t(30028,0,6,0),
  t(30403,0,6,0),t(31902,5,4,0),t(32277,3,4,0),t(32652,1,4,0),
  t(33026,0,3,0),t(33026,7,3,0),h(34151,1,4,35556),t(35650,0,3,0),
  t(36025,0,4,0),h(37524,1,3,38461),t(38649,0,10,0),t(39398,2,6,0),
  t(40148,0,6,0),t(40898,0,6,0),t(41272,1,4,0),t(41835,3,4,0),
  t(42772,5,4,0),t(43334,4,6,0),t(44833,4,6,0),t(46332,0,6,0),
  t(46520,2,6,0),t(47082,4,6,0),t(47644,7,3,0),t(49706,4,6,0),
  t(49893,5,3,0),t(51018,3,4,0),t(51205,4,6,0),h(52142,4,6,53079,0,[[52142,4,6],[52423,5,4],[52798,5,4],[53079,6,3]]),
  t(54016,4,6,0),t(54578,6,4,0),t(55516,5,4,0),h(56827,6,4,57952),
  h(58139,4,6,59264),t(59451,3,4,0),t(60201,5,4,0),t(60763,4,6,1),
  t(61700,4,6,0),t(62075,5,4,0),t(62824,4,6,0),t(63387,5,4,0),
  t(63762,3,4,0),t(64511,0,3,0),t(64511,7,3,0),t(64886,0,4,0),
  t(66573,1,4,0),t(67885,0,4,0),t(68072,1,4,0),t(69009,0,4,0),
  t(69384,0,10,0),t(70133,2,6,0),t(70696,5,4,0),t(72008,2,6,0),
  t(72570,4,6,0),t(73319,4,6,0),t(74069,4,6,0),t(74631,6,4,0),
  t(75194,5,4,0),t(75568,2,6,0),h(75756,1,4,76880),t(78754,2,6,0),
  t(79504,1,4,0),t(79879,0,6,0),t(80254,1,4,0),t(81191,0,4,0),
  t(81753,0,6,0),t(82128,3,4,0),t(82690,5,4,0),t(84377,2,6,0),
  t(84939,5,4,0),t(85501,6,4,0),t(85876,4,6,0),t(86251,6,4,0),
  t(86625,4,6,0),t(87000,3,4,0),t(87375,0,6,0),t(87750,0,4,0),
  t(87937,5,4,0),t(88500,3,4,0),t(88687,1,4,0),t(89437,0,4,0),
  h(90749,2,3,91873,0,[[90749,2,3],[91123,1,4],[91498,1,4],[91873,2,3]]),t(92060,0,4,0),t(92248,1,4,0),t(92997,0,3,0),
  t(92997,7,3,0),t(93560,1,4,0),h(93747,0,4,94590),t(94872,1,4,0),
  t(96183,0,10,0),t(96371,5,4,0),t(96746,2,6,0),t(97308,1,4,0),
  t(97495,0,4,0),t(97870,1,4,0),t(98245,0,6,0),t(98620,3,4,0),
  t(98807,1,4,0),t(99182,0,6,0),t(99744,1,4,0),t(100306,2,6,0),
  t(100869,4,6,0),t(101243,6,4,0),t(103305,5,4,0),t(103492,6,4,0),
  t(103867,5,4,0),t(104055,6,4,0),t(104804,5,4,0),t(105741,6,4,0),
  h(106491,4,6,107522,0,[[106491,4,6],[106866,5,4],[107147,5,4],[107522,4,6]]),t(107990,5,4,0),t(108178,4,6,0),t(109115,6,4,0),
  t(109677,4,6,0),t(110239,5,4,0),t(110614,3,4,0),t(111364,0,6,0),
  t(111738,0,10,0),t(112863,0,3,0),t(112863,7,3,0),t(113425,3,4,0),
  t(114362,1,4,0),t(114924,1,4,0),t(115299,0,4,0),t(115674,1,4,0),
  t(116049,3,4,0),t(116236,0,6,0),t(117923,0,4,0),t(120359,1,3,0),
  t(120547,2,6,0),t(120921,5,4,0),t(121296,4,6,0),t(121859,5,4,0),
  t(122046,4,6,0),t(122796,5,4,0),t(122983,6,4,0),t(123358,5,4,0),
  t(123545,3,4,0),t(124107,1,4,2),t(124670,0,4,0),t(125232,0,6,0),
  t(126731,1,4,0),t(126919,3,4,0),t(127856,1,4,0),t(128418,3,4,0),
  t(128980,5,4,0),t(129167,6,4,0),t(130105,5,4,0),t(132916,6,4,0),
  t(133103,4,6,0),t(133853,3,4,0),h(134040,0,6,135165),t(135352,3,4,0),
  t(135727,1,4,0),t(135914,3,4,0),t(137039,1,4,0),t(137226,3,4,0),
  t(137976,7,3,0),t(137976,0,3,0),t(138538,3,4,0),t(139288,0,10,0),
  t(140225,0,6,0),t(140412,0,6,0),t(140787,3,4,0),t(142474,1,4,0),
  t(142661,3,4,0),t(143223,5,4,0),t(143785,7,3,0),t(145097,6,4,0),
  t(145285,6,4,0),t(146222,3,4,0),t(146409,5,4,0),t(146784,6,4,0),
  t(146971,5,4,0),h(147346,4,3,148845,0,[[147346,4,3],[147721,2,6],[148096,4,3],[148471,2,6],[148845,4,3]]),t(149220,5,4,0),t(149970,3,4,0),
  t(150345,0,6,0),t(150532,0,4,0),t(151469,0,6,0),t(152219,2,6,0),
  t(152594,5,4,0),t(152968,6,4,0),t(153343,5,4,0),t(153531,6,4,0),
  t(154093,5,4,0),t(154468,6,4,0),t(154843,6,4,0),t(155217,6,4,0),
  h(156342,5,4,157279),t(157466,4,6,0),t(158966,0,10,0),h(159153,4,6,160184),
  t(160840,7,3,0),t(160840,0,3,0),t(162901,3,4,0),t(163276,5,4,0),
  h(164400,4,6,165900),t(166837,5,4,0),t(167212,3,4,0),t(167399,1,4,0),
  t(167774,3,4,0),t(168336,1,4,0),t(168898,3,4,0),t(169086,4,6,0),
  t(169835,6,4,0),t(171335,5,3,0),t(171897,3,4,0),t(172459,0,6,0),
  h(173021,0,6,173771),t(174146,1,4,0),t(174521,3,4,0),t(174895,5,4,0),
  t(175270,6,4,0),t(175645,5,4,0),t(176207,3,4,3),t(180143,5,4,0),
  t(180330,6,4,0),t(181267,1,4,0),t(182017,3,4,0),t(182204,5,4,0),
  t(182579,4,6,0),t(183891,4,6,0),t(185016,6,4,0),t(185578,6,4,0),
  t(185953,4,6,0),t(187452,4,6,0),t(187827,6,4,0),t(188951,5,4,0),
  h(190076,7,3,191575,0,[[190076,7,3],[190450,6,4],[190825,6,4],[191200,4,6],[191575,4,6]]),t(191950,7,3,0),t(191950,0,3,0),t(193074,0,10,0),
  t(194573,4,6,0),h(194948,6,4,195885),t(196448,6,4,0),h(197197,6,4,198134),
  t(198696,5,4,0),h(199071,5,4,200008),t(200571,4,6,0),t(200945,2,6,0),
  t(201320,0,6,0),t(201695,0,6,0),t(202070,1,4,0),h(202445,3,4,203663),
  h(203944,0,6,204881),t(205443,0,4,0),t(205818,0,4,0),t(206568,1,4,0),
  t(206755,1,4,0),t(207317,0,4,0),t(207692,1,4,0),t(208067,3,4,0),
  t(208254,5,4,0),t(209004,6,4,0),t(209941,4,6,0),t(211253,3,4,0),
  t(211440,5,4,0),t(213502,3,4,0),t(213877,4,6,0),t(214251,2,6,0),
  t(215563,0,4,0),t(215938,0,4,0),t(216875,0,6,0),t(217250,1,4,0),
  t(217812,3,4,0),t(218374,5,4,0),t(218937,7,3,0),t(218937,0,3,0),
  t(220436,5,3,0),t(221373,3,4,0),t(221560,0,10,0),t(222497,2,6,0),
  t(222685,1,4,0),t(223622,3,4,0),t(223997,1,4,0),t(224372,0,4,0),
  t(224746,0,4,0),t(225121,1,4,0),t(225683,3,4,0),t(226808,0,4,0),
  t(226995,0,4,0),t(227932,0,4,0),t(228307,1,4,0),t(228495,3,4,0),
  t(228869,1,4,0),t(229057,0,4,0),t(231493,1,4,0),t(232618,0,4,0),
  t(234679,0,6,0),t(235054,3,4,0),t(235429,4,6,0),t(236178,6,4,0),
  t(236553,3,4,0),t(236928,1,4,0),t(237303,0,4,0),t(238052,0,4,4),
  t(238427,0,6,0),t(239552,1,4,0),t(239739,3,4,0),t(241426,0,4,0),
  h(241801,0,6,242738,0,[[241801,0,6],[242082,0,4],[242457,0,4],[242738,1,3]]),h(244050,1,4,245174),t(245361,0,4,0),t(245736,1,4,0),
  t(245924,3,4,0),t(246486,5,3,0),t(248173,0,3,0),t(248173,7,3,0),
  t(248922,0,10,0),t(249110,3,4,0),t(250047,5,4,0),t(250421,4,6,0),
  t(251359,3,4,0),t(251546,4,6,0),t(252296,4,6,0),t(252670,4,6,0),
  t(252858,2,6,0),t(257168,0,4,0),t(257356,0,4,0),t(257730,1,4,0),
  t(257918,1,4,0),t(258293,0,4,0),t(258480,0,4,0),t(259417,1,4,0),
  t(261104,0,4,0),t(262791,0,6,0),t(263165,3,4,0),t(263540,5,4,0),
  t(263728,6,4,0),t(264290,4,6,0),t(264477,4,6,0),t(265039,5,4,0),
  t(265414,4,6,0),t(265789,4,6,0),t(266164,6,4,0),t(266914,7,3,0),
  t(266914,0,3,0),t(269162,6,4,0),t(269350,5,4,0),t(269725,3,4,0),
  t(269912,1,4,0),t(270474,0,4,0),t(271224,1,4,0),t(271411,0,10,0),
  t(271786,5,4,0),h(271974,7,3,273473,0,[[271974,7,3],[272348,6,4],[272723,4,6],[273098,6,4],[273473,7,3]]),h(273848,5,3,274785),t(276659,2,6,0),
  t(276846,2,6,0),t(277221,5,4,0),t(277408,4,6,0),t(277971,2,6,0),
  t(278533,4,6,0),t(279095,4,6,0),t(279283,4,6,0),t(279657,3,4,0),
  t(280032,0,6,0),t(280782,0,4,0),t(281157,0,6,0),t(281531,0,4,0),
  t(282469,1,4,0),t(283218,3,3,0),t(283780,0,4,0),t(284155,1,4,0),
  t(284530,2,6,0),t(285467,6,4,0),t(286029,5,4,0),t(286779,2,6,0),
  t(287341,1,4,0),t(288091,0,4,0),t(290527,0,6,0),t(290715,0,6,0),
  t(291277,0,6,0),t(291652,0,6,0),t(292401,0,6,0),t(292776,0,6,0),
  t(292963,2,6,0),h(293338,0,6,294369,0,[[293338,0,6],[293713,1,4],[293994,1,4],[294369,0,6]]),t(294650,0,10,0),t(295775,0,3,0),
  t(295775,7,3,0),t(296337,3,4,0),t(296712,5,4,0),
// </six-eternel-remix-v3-easy-notes>
])(mhTap,mhHoldV2,mhFlick,mhSlideV2);
const sixEternelRemixNormalNotes=((t,h,f,s)=>[
// <six-eternel-remix-v3-normal-notes>
  f(2666,1,3),t(3228,6,2,0),t(4540,0,3,0),t(4540,7,3,0),
  h(5852,2,2,6695,0,[[5852,2,2],[6320,1,4],[6695,0,6]]),t(6789,0,10,0),t(7726,0,6,0),t(8288,0,6,0),
  t(9038,0,6,0),t(9413,1,4,0),t(10537,0,6,0),t(11662,1,4,0),
  t(11849,2,6,0),t(12036,0,6,0),t(13348,3,4,0),t(13723,3,3,0),
  t(13911,4,6,0),t(14473,4,6,0),t(15222,8,2,0),t(16534,2,6,0),
  f(17284,4,6),t(17659,2,6,0),t(17846,0,6,0),t(18034,2,6,0),
  t(19158,1,3,0),t(19533,4,6,0),t(20470,6,4,0),t(21407,5,4,0),
  t(21969,6,4,0),t(22344,4,6,0),t(22719,4,6,0),t(22906,4,6,0),
  t(23843,4,6,0),t(27404,1,4,0),t(27591,5,4,0),t(28154,3,3,0),
  t(28341,4,6,0),t(28529,4,6,0),f(28903,1,3),t(29278,2,6,0),
  t(29840,0,6,0),t(30028,0,6,0),t(30403,0,10,0),t(30965,5,4,0),
  t(31902,7,3,0),t(31902,0,3,0),t(32277,3,4,0),t(32652,5,3,0),
  t(33026,1,4,0),t(33401,3,3,0),h(34151,0,4,35556),t(35650,2,2,0),
  t(36025,3,4,0),t(36587,2,2,0),h(37524,0,2,38461),t(38649,4,6,0),
  f(38836,2,6),t(39398,0,6,0),t(39586,0,6,0),t(40148,0,6,0),
  t(40898,2,6,0),t(41272,5,3,0),t(41835,6,4,0),t(42772,5,4,0),
  t(43334,4,6,0),t(44833,4,6,0),t(45958,1,4,0),t(46332,4,6,0),
  t(46520,2,6,0),t(47082,4,6,0),t(47644,6,2,0),t(49706,4,6,0),
  t(49893,8,2,0),f(50643,7,3),t(51018,7,3,0),t(51018,0,3,0),
  t(51205,2,6,0),t(51392,4,6,0),h(52142,4,6,53079,1),t(54016,2,6,0),
  t(54578,5,4,0),t(55516,6,4,0),h(56827,5,3,57952),h(58139,4,6,59264,0,[[58139,4,6],[58514,5,4],[58889,6,3],[59264,6,2]]),
  t(59451,3,4,0),t(60201,5,3,0),t(60763,0,6,1),t(61700,0,6,0),
  t(62075,0,4,0),t(62450,0,3,0),t(62824,0,10,0),f(63387,0,4),
  t(63762,0,4,0),t(64511,0,4,0),t(64886,0,4,0),t(65261,0,4,0),
  t(66573,1,4,0),t(67885,0,3,0),t(68072,1,3,0),t(68259,2,6,0),
  t(69009,0,3,0),t(69009,7,3,0),t(69384,4,6,0),t(70133,2,6,0),
  t(70696,6,4,0),t(72008,2,6,0),t(72570,4,6,0),t(73319,2,6,0),
  t(73882,4,6,0),t(74069,4,6,0),f(74631,6,4),t(75194,5,4,0),
  t(75568,4,6,0),h(75756,5,4,76880),t(78754,0,6,0),t(79504,3,4,0),
  t(79879,4,6,0),t(80254,6,4,0),t(81191,3,4,0),t(81753,4,6,0),
  t(82128,6,4,0),t(82690,5,4,0),t(84377,4,6,0),t(84939,5,3,0),
  t(85126,2,6,0),t(85501,1,4,0),f(85876,0,6),t(86251,0,4,0),
  t(86438,1,4,0),t(86625,0,6,0),t(87000,3,4,0),t(87375,0,10,0),
  t(87750,0,4,0),t(87937,3,4,0),t(88500,1,4,0),t(88687,0,4,0),
  t(89437,1,4,0),h(90749,1,2,91873,0,[[90749,1,2],[91123,0,4],[91498,0,4],[91873,1,2]]),t(92060,1,3,0),t(92248,3,4,0),
  t(92435,5,4,0),t(92997,3,3,0),t(93560,1,4,0),h(93747,3,4,94590),
  f(94872,5,3),t(96183,0,6,0),t(96371,5,3,0),t(96746,2,6,0),
  t(96933,4,6,0),t(97308,5,4,0),t(97495,1,4,0),t(97683,2,6,0),
  t(98245,0,6,0),t(98432,0,6,0),h(98620,5,3,99369),t(99744,0,4,0),
  t(100306,0,6,0),t(100494,3,4,0),t(100869,4,6,0),t(101243,6,4,0),
  t(103305,5,4,0),f(103492,5,4),t(103867,5,3,0),t(104055,5,3,0),
  t(104242,0,3,0),t(104242,7,3,0),t(104804,5,4,0),t(105741,3,4,0),
  t(106116,5,4,0),h(106491,2,6,107522,1),t(107990,1,3,0),t(108178,4,6,0),
  t(108552,2,6,0),t(109115,6,4,0),t(109677,4,6,0),t(110052,3,4,0),
  t(110239,1,3,0),t(110614,0,4,0),t(110989,3,3,0),t(111364,0,10,0),
  f(111738,2,6),t(112863,1,4,0),t(113425,5,3,0),t(114362,3,3,0),
  t(114924,5,4,0),h(115299,4,6,116143,0,[[115299,4,6],[115768,7,2],[116143,4,6]]),t(116236,4,6,2),t(117923,7,3,0),
  t(120359,2,2,0),t(120547,4,6,0),t(120921,3,3,0),t(121296,4,6,0),
  t(121484,3,3,0),t(121859,5,3,0),t(122046,4,6,0),t(122233,7,3,0),
  t(122233,0,3,0),t(122796,1,4,0),f(122983,3,4),t(123358,5,3,0),
  t(123545,6,4,0),t(123920,5,4,0),t(124107,3,3,0),t(124670,1,4,0),
  t(125232,0,6,0),t(126731,1,3,0),t(126919,5,3,0),t(127856,7,3,0),
  t(128418,3,4,0),t(128980,5,3,0),t(129167,2,3,0),t(130105,0,3,0),
  t(132916,1,3,0),t(133103,2,6,0),t(133853,5,3,0),h(134040,6,2,135165,0,[[134040,6,2],[134415,5,4],[134790,5,4],[135165,6,2]]),
  t(135352,5,3,0),f(135539,3,3),t(135914,1,3,0),t(136102,0,10,0),
  t(136664,5,4,0),t(137039,1,3,0),t(137226,3,4,0),t(137413,0,3,0),
  t(137976,1,4,0),t(138538,5,4,0),t(139288,2,6,0),t(140225,0,6,0),
  t(140412,2,6,0),t(140787,7,3,0),t(142474,5,3,0),t(142661,1,3,0),
  f(143223,3,3),t(143785,0,2,0),t(145097,1,4,0),t(145285,1,3,0),
  t(146222,0,4,0),t(146409,1,3,0),t(146597,3,3,0),t(146971,5,3,0),
  h(147346,7,3,148845,1),t(149220,1,4,0),t(149783,5,4,0),t(149970,3,4,0),
  t(150345,4,6,0),t(150532,5,4,0),t(151469,4,6,0),t(152219,2,6,0),
  t(152594,5,4,0),f(152968,1,4),t(153343,0,4,0),t(153531,1,4,0),
  t(154093,0,4,0),t(154468,1,4,0),t(154843,0,4,0),t(155217,0,3,0),
  t(155217,7,3,0),h(156342,1,4,157279),t(157466,0,6,0),t(157654,0,6,0),
  t(158966,0,6,0),h(159153,6,2,160184,0,[[159153,6,2],[159528,6,3],[159809,5,4],[160184,4,6]]),t(160465,0,10,0),t(160840,5,4,0),
  t(162901,1,3,0),t(163276,3,4,0),t(164026,5,3,0),h(164400,4,6,165900),
  f(166087,3,3),t(166837,5,4,0),t(167024,6,4,0),t(167212,5,4,0),
  t(167774,6,4,0),t(168336,5,4,0),t(168898,3,4,0),t(169086,0,6,0),
  t(169835,0,3,0),t(171335,0,2,0),t(171897,3,4,0),t(172459,0,6,0),
  h(173021,2,6,173771),t(174146,0,4,0),t(174333,0,4,0),t(174521,0,4,0),
  t(174895,0,4,0),f(175270,3,4),t(175645,5,4,0),t(176207,3,3,3),
  t(180143,5,3,0),t(180330,3,3,0),t(180518,1,3,0),t(181267,0,3,0),
  t(182017,0,4,0),t(182204,3,4,0),t(182579,0,6,0),t(183891,0,6,0),
  t(185016,0,4,0),t(185578,1,3,0),t(185953,0,6,0),t(187077,1,3,0),
  t(187452,0,6,0),f(187827,3,3),h(188576,3,3,190076),h(190450,0,6,191950),
  t(192137,0,6,0),t(193074,0,10,0),t(194573,0,6,0),h(194948,0,6,195885,1,[[194948,0,6],[195229,0,4],[195604,1,3],[195885,1,2]]),
  t(196448,1,3,0),t(196822,3,3,0),h(197197,5,3,198134),t(198696,3,4,0),
  h(199071,5,4,200008),t(200571,0,6,0),t(200945,2,6,0),t(201320,4,6,0),
  t(201695,4,6,0),t(202070,5,4,0),h(202445,3,4,203663),h(203944,0,6,204881),
  f(205443,0,4),t(205818,0,3,0),t(205818,7,3,0),t(206193,0,4,0),
  t(206568,0,4,0),t(206755,5,4,0),t(206942,0,6,0),t(207317,3,4,0),
  t(207505,0,4,0),t(207692,1,4,0),t(208067,3,4,0),t(208254,5,4,0),
  t(208442,6,4,0),t(209004,3,4,0),t(209566,6,2,0),t(209941,4,6,0),
  t(210691,5,3,0),t(211253,3,4,0),f(211440,5,4),t(213502,3,3,0),
  t(213877,4,6,0),t(214251,2,6,0),t(215563,1,4,0),t(215938,5,3,0),
  t(216875,4,6,0),t(217250,3,4,0),t(217812,5,4,0),t(218374,1,3,0),
  t(218937,3,3,0),t(220436,2,2,0),t(221373,0,4,0),t(221560,0,10,0),
  t(222123,1,4,0),t(222497,4,6,0),t(222685,0,3,0),t(222685,7,3,0),
  f(222872,4,6),t(223622,6,4,0),t(223997,5,4,0),t(224184,6,4,0),
  t(224372,5,4,0),t(224746,3,4,0),t(225121,1,4,0),t(225683,0,4,0),
  t(226808,1,4,0),t(226995,5,4,0),t(227932,7,3,0),t(228307,5,3,0),
  t(228495,3,3,0),t(228682,5,4,0),t(229057,6,4,0),t(231493,7,3,0),
  t(232618,5,4,0),f(234679,4,6),t(235054,6,4,0),t(235429,4,6,0),
  h(235804,7,2,236647,0,[[235804,7,2],[236272,4,6],[236647,7,2]]),h(236928,5,4,237584,1),t(238052,7,3,4),t(238427,2,6,0),
  t(238615,0,6,0),t(239552,0,4,0),t(239739,1,4,0),t(241426,0,3,0),
  t(241426,7,3,0),h(241801,1,4,242738),h(244050,0,6,245174,0,[[244050,0,6],[244424,1,3],[244799,1,3],[245174,0,6]]),t(245361,1,4,0),
  t(245924,3,3,0),t(246486,0,2,0),t(248173,0,3,0),t(248922,0,10,0),
  t(249110,0,3,0),f(249297,0,3),t(250047,1,3,0),t(250234,5,4,0),
  t(250421,2,6,0),t(250984,6,4,0),t(251359,1,3,0),t(251546,2,6,0),
  t(251733,4,6,0),t(252108,6,4,0),t(252296,4,6,0),t(252670,4,6,0),
  t(252858,4,6,0),t(257168,7,3,0),t(257356,7,3,0),t(257543,7,3,0),
  t(257918,7,3,0),t(258105,5,3,0),f(258293,2,3),t(258668,3,3,0),
  t(259417,0,4,0),t(261104,1,3,0),t(262791,0,6,0),t(263165,0,3,0),
  t(263165,7,3,0),t(263540,1,3,0),t(263728,5,4,0),t(263915,4,6,0),
  t(264290,4,6,0),t(264477,4,6,0),t(264665,7,3,0),t(265039,3,3,0),
  t(265414,4,6,0),t(265789,2,6,0),t(266164,1,4,0),f(266914,3,4),
  t(269162,5,3,0),t(269350,3,3,0),t(269725,1,3,0),t(269912,0,3,0),
  t(270099,1,3,0),t(270474,5,3,0),t(271224,3,3,0),t(271411,0,10,0),
  t(271599,4,2,0),h(271974,8,2,273473,0,[[271974,8,2],[272348,4,6],[272723,8,2],[273098,4,6],[273473,8,2]]),h(273848,6,2,274785,1),t(276659,4,6,0),
  t(276846,4,6,0),t(277221,7,3,0),t(277408,4,6,0),t(277783,2,6,0),
  f(277971,4,6),t(278346,4,6,0),t(279095,4,6,0),t(279283,4,6,0),
  t(279657,0,3,0),t(279657,7,3,0),t(279845,4,6,0),t(280032,4,6,0),
  t(280782,7,3,0),t(281157,4,6,0),t(281531,6,4,0),t(282469,5,4,0),
  t(283218,8,2,0),t(283780,1,3,0),t(284155,5,3,0),t(284530,2,6,0),
  t(285467,1,4,0),t(286029,3,4,0),t(286217,5,4,0),f(286779,4,6),
  t(287341,3,4,0),t(288091,7,3,0),t(290527,4,6,0),t(290715,4,6,0),
  t(290902,4,6,0),t(291277,4,6,0),t(291652,0,6,0),t(292026,4,6,0),
  t(292401,2,6,0),t(292776,4,6,0),t(292963,4,6,0),t(293151,4,6,0),
  h(293526,8,2,294369,0,[[293526,8,2],[293994,6,4],[294369,4,6]]),t(294650,0,10,0),t(295775,0,3,0),t(295775,7,3,0),
  t(296337,1,4,0),f(296712,0,4),
// </six-eternel-remix-v3-normal-notes>
])(mhTap,mhHoldV2,mhFlick,mhSlideV2);
const sixEternelRemixHardNotes=((t,h,f,s)=>[
// <six-eternel-remix-v3-hard-notes>
  f(1916,1,4),t(2666,6,3,0),t(2666,0,3,0),t(3322,3,3,0),
  t(4540,1,3,0),h(5852,2,1,6695,0,[[5852,2,1],[6320,1,3],[6695,0,5]]),t(6789,0,8,0),t(7726,2,5,0),
  t(8288,4,5,0),t(9038,2,5,0),t(9413,1,4,0),h(10162,3,3,11662),
  t(11849,4,5,0),t(12036,5,5,0),t(12224,5,3,0),t(12318,5,5,0),
  t(13255,1,4,0),t(13348,1,4,0),t(13911,4,5,0),t(14473,5,5,0),
  t(15316,5,3,0),f(16534,2,5),t(17097,2,5,0),t(17284,4,5,0),
  t(17659,4,5,0),t(17846,5,5,0),t(18034,5,5,0),t(19158,5,3,0),
  t(19533,2,5,0),t(20001,1,4,0),t(20470,0,4,0),t(21407,1,4,0),
  t(21969,3,4,0),t(22063,4,5,0),t(22438,5,5,0),t(22719,4,5,0),
  t(22906,4,5,0),t(23187,6,3,0),t(23187,0,3,0),t(23562,5,4,0),
  f(23937,1,3),t(24687,2,5,0),t(24874,4,5,0),t(25061,5,5,0),
  t(25811,3,3,0),t(26186,6,4,0),t(26373,3,4,0),t(27404,1,4,0),
  t(27591,3,4,0),t(28154,5,3,0),t(28341,2,5,0),t(28529,4,5,0),
  t(28622,2,5,0),t(28903,1,3,0),t(29278,2,5,0),t(29653,0,5,0),
  t(29840,0,5,0),t(30028,2,5,0),t(30403,2,8,0),t(30965,6,4,0),
  t(31902,6,4,0),f(32277,3,4),t(32652,5,3,0),t(33026,1,4,0),
  t(33401,3,3,0),s(34151,35556,[[34151,1,3],[34432,1,3],[34713,1,3],[34994,1,3],[35275,2,3],[35556,3,3]],1),t(35931,0,5,0),t(36025,5,4,0),
  t(36306,2,5,0),t(36868,5,5,0),t(37056,0,4,0),t(37056,7,3,0),
  h(37524,5,5,38461,0,[[37524,5,5],[37805,6,4],[38180,8,2],[38461,8,1]]),t(38649,0,5,0),t(38836,2,5,0),t(39398,4,5,0),
  t(39586,5,5,0),t(40148,4,5,0),t(40898,2,5,0),t(41272,1,3,0),
  t(41835,6,4,0),f(42209,3,4),t(42772,5,4,0),t(43428,0,5,0),
  t(43990,2,5,0),t(44552,0,5,0),t(44833,0,5,0),h(45302,2,5,45770),
  t(46332,0,5,0),t(46520,4,5,0),t(46614,2,5,0),t(46988,5,5,0),
  t(47082,2,5,0),t(47644,6,1,0),t(48113,1,4,0),t(49612,3,4,0),
  t(49706,4,5,0),t(49893,4,1,0),t(50643,1,3,0),t(51018,0,4,0),
  t(51205,2,5,0),f(51392,0,5),s(51955,53079,[[51955,0.5,3],[52236,0.5,3],[52517,1,3],[52798,2.5,3],[53079,3.5,3]]),t(54016,4,5,0),
  t(54578,6,4,0),t(55516,6,4,0),t(55516,0,3,0),t(56171,0,5,0),
  t(56359,2,8,0),s(56827,57952,[[56827,1,3],[57015,1,3],[57202,1,3],[57390,1,3],[57577,3,3],[57764,3,3],[57952,3,3]]),h(58139,0,5,59264),t(59451,1,4,0),
  t(59920,1,4,0),t(60201,0,3,0),t(60763,2,5,0),t(61044,1,3,0),
  t(61700,4,5,0),t(62075,1,4,0),t(62450,3,3,0),t(62543,4,5,0),
  f(62824,5,5),h(63387,3,4,63762),h(64136,6,4,64980),t(65261,5,4,1),
  t(66292,3,4,0),t(66573,5,4,0),t(67416,0,5,0),t(67603,5,4,0),
  t(67791,2,5,0),t(67885,7,3,0),t(68072,5,3,0),t(68259,4,5,0),
  t(69009,3,3,0),t(69384,0,5,0),t(69665,2,5,0),h(70133,2,1,70789,0,[[70133,2,1],[70508,0,5],[70789,2,1]]),
  t(71352,0,5,0),f(72008,0,5),t(72570,0,5,0),t(72851,0,5,0),
  t(73038,2,5,0),t(73319,2,5,0),t(73601,8,1,0),t(73882,2,5,0),
  t(74069,4,5,0),t(74631,0,4,0),t(74631,7,3,0),t(75194,3,4,0),
  t(75381,0,5,0),t(75568,0,5,0),s(75756,76880,[[75756,1,3],[75943,1,3],[76131,1,3],[76318,2,3],[76505,2,3],[76693,3,3],[76880,3,3]],1),t(77911,0,5,0),
  t(78473,0,5,0),t(78754,2,5,0),t(79223,4,5,0),t(79410,1,3,0),
  t(79504,5,4,0),t(79879,2,5,0),t(80160,6,4,0),t(80254,3,4,0),
  s(80535,81565,[[80535,3,3],[80722,3,3],[80910,2,3],[81097,2,3],[81284,1,3],[81472,2,3],[81565,2.5,3]]),t(81753,2,8,0),t(82034,6,4,0),f(82128,5,4),
  t(82596,6,4,0),t(82690,5,4,0),t(84377,0,5,0),t(84658,2,5,0),
  t(84845,5,3,0),t(84939,6,3,0),t(85126,5,5,0),t(85501,6,4,0),
  t(85688,7,3,0),t(85876,5,5,0),t(86251,6,4,0),t(86438,6,4,0),
  t(86625,5,5,0),h(87000,6,4,87750),f(87937,1,4),t(88500,6,4,0),
  t(88500,0,3,0),t(88687,3,4,0),t(89437,6,4,0),t(90093,1,4,0),
  t(90280,2,5,0),t(90467,6,1,0),s(90749,91873,[[90749,3,3],[90936,2,3],[91123,4,3],[91311,2,3],[91498,2.5,3],[91686,2.5,3],[91873,2.5,3]]),t(91967,4,4,0),
  t(92060,3,3,0),t(92248,1,4,0),t(92435,5,4,0),t(92904,1,4,0),
  t(92997,3,3,0),t(93279,0,3,0),t(93560,0,4,0),t(93747,1,4,0),
  h(93841,0,5,94590,0,[[93841,0,5],[94216,2,1],[94590,0,5]]),t(94872,3,3,0),t(94965,1,4,0),t(96183,5,5,0),
  f(96371,3,3),t(96746,4,5,0),t(96933,0,5,0),t(97308,3,4,0),
  t(97495,0,4,0),t(97683,0,5,0),h(97870,3,4,98432),h(98620,1,3,99369),
  t(99557,0,3,0),t(99744,1,4,0),t(100306,1,8,0),t(100494,5,4,0),
  t(100869,2,5,0),t(100962,6,4,0),t(101243,0,4,0),t(101243,7,3,0),
  h(102836,1,4,104336,1),t(104804,5,4,0),t(105273,0,5,0),t(105648,2,5,0),
  f(105741,1,4),s(106491,107522,[[106491,1,3],[106678,1,3],[106866,1,3],[107053,0,3],[107241,0,3],[107428,0,3],[107522,0,3]],1),t(107990,0,3,0),t(108178,0,5,0),
  t(109115,0,4,0),t(109302,2,5,0),t(109677,0,5,0),t(110052,5,4,0),
  t(110239,3,3,0),t(110614,6,4,0),t(110989,1,3,0),t(111364,2,5,0),
  t(111738,4,5,0),t(112113,7,3,0),t(112863,5,4,0),t(113425,3,3,0),
  t(114362,5,3,0),t(114643,3,3,0),t(114831,1,4,0),f(114924,0,4),
  t(115299,1,4,0),h(115393,3,3,116143),t(116236,1,5,0),t(116517,3,4,0),
  t(116705,5,4,0),h(116892,6,4,117454),t(117642,4,5,0),t(117829,1,3,0),
  t(117923,3,3,0),t(118391,0,4,0),t(118391,7,3,0),t(119141,0,5,0),
  t(120078,5,3,0),t(120359,8,1,0),t(120453,4,3,0),t(120921,7,3,0),
  t(121296,0,5,0),f(121484,5,3),t(121859,3,3,0),t(122046,2,8,0),
  t(122233,3,3,0),t(122421,6,4,0),t(122796,3,4,0),t(122983,5,4,0),
  t(123170,7,3,0),t(123358,5,3,0),t(123545,3,4,0),t(123920,1,4,0),
  t(124107,0,3,0),t(124670,0,4,0),t(125232,0,5,2),t(126263,0,5,0),
  t(126731,3,3,0),t(126825,5,3,0),t(127856,1,3,0),t(127949,4,1,0),
  t(128324,0,5,0),t(128418,3,4,0),t(128699,0,5,0),t(128980,0,3,0),
  t(129167,1,3,0),t(129261,5,3,0),f(129449,2,5),t(129823,6,4,0),
  t(129823,0,3,0),t(130105,3,3,0),t(130386,5,3,0),t(130573,7,3,0),
  t(130760,4,5,0),t(131135,3,3,0),t(132916,1,3,0),t(133103,4,5,0),
  t(133384,1,3,0),t(133572,4,5,0),t(133759,0,3,0),t(133853,1,3,0),
  s(134040,135165,[[134040,1,3],[134228,1,3],[134415,2,3],[134602,2,3],[134790,2,3],[134977,2,3],[135165,1.5,3]]),h(135352,6,1,135914,0,[[135352,6,1],[135633,5,3],[135914,4,5]]),t(136102,0,5,0),f(136289,3,3),
  t(136664,0,4,0),t(137039,3,3,0),t(137226,1,4,0),t(137413,0,3,0),
  t(137882,1,3,0),t(137976,5,4,0),t(138538,3,4,0),t(139288,0,5,0),
  t(139756,0,3,0),t(139944,0,3,0),t(140131,1,3,0),t(140225,0,5,0),
  t(140412,0,8,0),t(140506,0,4,0),t(140881,1,4,0),t(141255,3,4,0),
  f(141630,5,4),t(142005,6,4,0),t(142005,0,3,0),t(142192,2,5,0),
  t(142380,5,4,0),t(142474,1,3,0),t(142661,5,3,0),t(142755,3,4,0),
  t(143129,1,4,0),t(143223,0,3,0),t(143504,0,4,0),t(143692,3,3,0),
  t(143879,0,4,0),t(145097,5,4,0),t(145285,3,3,0),t(146034,1,4,0),
  t(146222,0,4,0),t(146409,1,3,0),t(146597,3,3,0),t(146784,1,3,0),
  f(146971,5,3),s(147346,148845,[[147346,2,3],[147627,3,3],[147908,3,3],[148190,3,3],[148471,3,3],[148752,1,3],[148845,3,3]]),t(149033,5,4,0),t(149220,5,4,0),
  t(149783,6,4,0),t(149970,6,4,0),t(150251,2,5,0),t(150345,4,5,0),
  t(150532,6,4,0),t(151469,0,5,0),t(151938,4,5,0),t(152219,2,5,0),
  t(152313,5,5,0),t(152594,5,4,0),t(152687,0,5,0),t(152875,3,4,0),
  t(152968,0,4,0),t(153343,0,4,0),t(153437,1,4,0),t(153812,0,4,0),
  t(153812,7,3,0),f(154093,1,4),t(154468,3,4,0),t(154749,0,5,0),
  t(154936,0,5,0),t(155217,1,3,0),t(155686,2,5,0),t(156248,1,4,0),
  s(156342,157279,[[156342,3,3],[156529,3,3],[156717,2,3],[156904,2.5,3],[157092,4,3],[157279,4,3]]),t(157466,2,8,0),t(157654,5,5,0),t(158966,4,5,0),
  h(159153,5,5,160184,0,[[159153,5,5],[159528,6,4],[159809,7,2],[160184,7,1]]),t(160465,2,5,0),t(160840,6,4,0),t(162901,5,3,0),
  t(163276,6,4,0),s(164400,165900,[[164400,3,3],[164682,3,3],[164963,3,3],[165244,4,3],[165525,3.5,3],[165806,3,3],[165900,3,3]]),t(166087,7,3,0),t(166181,5,4,0),
  t(166743,3,4,0),f(166837,3,4),t(167212,0,4,0),t(167399,0,3,0),
  h(167774,0,4,168336,1),t(168898,1,4,0),t(168992,3,4,0),t(169179,5,3,0),
  t(169835,7,3,0),t(171335,2,1,0),t(171897,5,4,0),t(172459,2,5,0),
  h(172647,6,4,173771),t(173958,1,3,0),t(173958,7,3,0),t(174146,3,4,0),
  t(174333,5,4,0),t(174521,6,4,0),t(174895,5,4,0),t(175270,3,4,0),
  t(175645,0,4,0),f(176207,0,3),t(176863,0,1,0),t(177800,0,5,0),
  t(177988,3,4,0),t(178175,0,5,0),t(178362,0,3,0),t(178550,1,3,0),
  s(178737,179862,[[178737,2,3],[178925,2,3],[179112,2,3],[179300,2,3],[179487,2,3],[179674,2,3],[179862,4,3]]),t(180143,5,3,0),t(180330,3,3,0),h(180986,1,3,181923),
  t(182204,0,4,0),t(182486,2,5,0),t(182579,0,5,0),t(183891,0,5,0),
  h(184547,1,4,185484),t(185578,0,3,3),t(185953,0,8,0),t(187077,1,3,0),
  f(187452,4,5),t(187827,3,3,0),t(188202,7,3,0),s(188576,190076,[[188576,3,3],[188857,3,3],[189139,2,3],[189420,2,3],[189701,2,3],[189982,3,3],[190076,4,3]],1),
  s(190450,191950,[[190450,3,3],[190732,3.5,3],[191013,3.5,3],[191294,3,3],[191575,1.5,3],[191856,1.5,3],[191950,1.5,3]]),t(192137,4,5,0),t(193074,5,5,0),t(194573,2,5,0),
  h(194948,6,4,195885),t(195979,1,3,0),t(196448,1,3,0),t(196448,7,3,0),
  t(196822,5,3,0),h(197197,8,1,198134,0,[[197197,8,1],[197478,6,4],[197853,6,4],[198134,8,1]]),t(198696,5,4,0),s(199071,200008,[[199071,3,3],[199259,1,3],[199446,2,3],[199633,3,3],[199821,3,3],[200008,3,3]]),
  s(200196,201695,[[200196,3,3],[200477,3.5,3],[200758,1.5,3],[201039,2,3],[201320,2.5,3],[201601,2.5,3],[201695,2.5,3]],1),t(202070,6,4,0),h(202445,5,4,203663),t(203944,4,5,0),
  t(204319,5,4,0),f(204694,6,4),h(205068,5,5,206568),t(206755,6,4,0),
  t(206942,2,5,0),t(207317,5,4,0),t(207505,1,4,0),t(207692,3,4,0),
  t(208067,0,4,0),t(208254,1,4,0),t(208442,3,4,0),t(208629,1,3,0),
  t(209004,0,4,0),t(209566,2,1,0),t(209941,2,5,0),h(210691,0,3,211159),
  t(211253,1,4,0),t(211440,0,4,0),t(212658,0,5,0),t(213033,2,5,0),
  t(213221,4,5,0),f(213502,7,3),t(213877,4,5,0),t(213970,2,5,0),
  t(214251,0,5,0),t(214720,0,5,0),t(214907,4,5,0),t(215095,0,4,0),
  t(215095,7,3,0),t(215563,3,4,0),t(215938,0,3,0),t(216781,1,4,0),
  t(216875,2,8,0),t(217344,3,4,0),t(217719,5,5,0),t(217812,1,4,0),
  t(218093,2,5,0),t(218374,5,3,0),t(218843,6,4,0),t(218937,3,3,0),
  f(219405,6,4),t(219780,2,5,0),t(220155,6,4,0),t(220436,6,1,0),
  t(221373,1,4,0),t(221560,4,5,0),t(222123,3,4,0),h(222497,5,5,223060,1,[[222497,5,5],[222779,7,1],[223060,5,5]]),
  t(223622,1,4,0),t(223809,3,4,0),t(223997,5,4,0),t(224184,6,4,0),
  t(224372,5,4,0),t(224746,3,4,0),t(225121,0,4,0),t(225496,1,4,0),
  t(225683,3,4,0),t(226808,5,4,0),t(226995,0,4,0),t(226995,7,3,0),
  f(227932,5,3),t(228307,3,3,0),t(228495,1,3,0),t(228682,0,4,0),
  t(228776,1,3,0),t(228963,3,3,0),t(229057,1,4,0),t(229525,0,5,0),
  t(229900,0,5,0),t(230275,0,3,0),t(230650,1,4,0),t(231025,3,4,0),
  t(231399,4,5,0),t(231493,1,3,0),t(231962,2,5,0),t(232618,0,4,0),
  t(232899,1,4,0),h(233461,4,5,234023,1),t(234679,5,5,0),f(235054,5,4),
  t(235429,1,8,0),s(235804,236647,[[235804,1,3],[235991,0,3],[236178,0,3],[236366,0,3],[236553,0,3],[236647,0,3]]),s(236928,237584,[[236928,1,3],[237115,1,3],[237303,0,3],[237490,0,3],[237584,0,3]]),t(237678,0,3,4),
  t(238052,3,3,0),t(238427,0,5,0),t(238615,0,5,0),t(239552,0,4,0),
  t(239739,0,4,0),t(240957,0,1,0),t(241426,1,4,0),t(241520,0,3,0),
  h(241801,1,4,242738),t(242831,0,5,0),h(243206,3,3,243768),h(244050,7,1,245174,0,[[244050,7,1],[244424,5,4],[244799,5,4],[245174,7,1]]),
  t(245268,1,4,0),t(245361,5,4,0),f(245924,3,3),t(246486,8,1,0),
  t(246580,5,3,0),t(247329,5,4,0),t(248173,7,3,0),t(248922,4,5,0),
  t(249110,3,3,0),t(249203,0,1,0),t(250047,3,3,0),t(250234,5,4,0),
  t(250421,5,5,0),t(250609,5,4,0),t(250984,3,4,0),t(251359,7,3,0),
  t(251546,2,5,0),t(251733,5,5,0),t(252108,1,4,0),t(252296,4,5,0),
  t(252670,2,5,0),t(252764,7,3,0),f(253514,5,4),t(255763,5,3,0),
  t(255950,5,3,0),t(256137,5,5,0),t(256325,7,3,0),t(256512,5,3,0),
  t(256700,7,3,0),t(257075,5,3,0),t(257168,7,3,0),t(257356,7,3,0),
  t(257543,7,3,0),t(257730,7,3,0),t(257918,7,3,0),t(258105,5,3,0),
  t(258293,3,3,0),t(258480,1,3,0),t(258668,0,3,0),t(258761,1,3,0),
  t(259136,0,8,0),t(259417,0,4,0),f(259511,0,5),t(259886,0,5,0),
  t(260823,3,4,0),t(261104,1,3,0),t(261385,0,4,0),t(261572,1,4,0),
  t(261760,3,4,0),t(262791,0,5,0),t(262978,1,3,0),t(263165,3,4,0),
  t(263540,1,3,0),t(263728,0,4,0),t(263915,0,5,0),t(264102,0,5,0),
  t(264290,0,5,0),t(264477,0,5,0),t(264571,4,3,0),t(265039,1,3,0),
  t(265227,0,3,0),f(265414,0,5),t(265789,0,5,0),t(266164,3,4,0),
  t(266539,5,4,0),t(266914,6,4,0),t(266914,0,3,0),t(269162,5,3,0),
  t(269256,6,3,0),t(269444,4,5,0),t(269725,3,3,0),t(269818,0,5,0),
  t(270099,0,3,0),t(270193,0,5,0),h(270474,6,1,271130,0,[[270474,6,1],[270849,5,3],[271130,4,5]]),t(271318,3,4,0),
  t(271411,4,5,0),t(271692,5,5,0),s(271786,273285,[[271786,3,3],[272067,3,3],[272348,4,3],[272630,4,3],[272911,4,3],[273192,4,3],[273285,4,3]]),t(273379,7,3,0),
  t(273567,3,3,0),t(273754,5,4,0),s(273848,274785,[[273848,1,3],[274035,0,3],[274223,0,3],[274410,0,3],[274597,0,3],[274785,0,3]],1),f(276003,0,3),
  t(276565,1,4,0),t(276659,0,8,0),t(276846,0,5,0),t(277127,3,3,0),
  t(277221,5,3,0),h(277408,2,5,278064),t(278346,0,5,0),t(278533,4,5,0),
  t(279095,5,5,0),t(279283,4,5,0),t(279470,2,5,0),t(279657,1,4,0),
  t(279845,0,5,0),t(280032,0,5,0),t(280782,0,3,0),t(280969,1,3,0),
  f(281157,2,5),t(281531,6,4,0),t(281531,0,3,0),t(282469,6,4,0),
  t(283499,4,5,0),t(283687,0,5,0),t(283780,3,3,0),t(284155,0,3,0),
  t(284249,0,5,0),t(284530,0,5,0),t(285467,6,4,0),t(285748,4,5,0),
  h(286029,3,4,286592),t(286779,0,5,0),t(287247,2,5,0),t(287716,5,3,0),
  t(288091,7,3,0),t(289496,5,4,0),f(289871,3,4),t(290433,0,5,0),
  t(290527,0,5,0),t(290715,4,5,0),t(290902,0,5,0),t(291089,2,5,0),
  t(291277,0,5,0),t(291652,0,5,0),t(292026,0,5,0),t(292214,2,5,0),
  t(292401,0,5,0),t(292589,0,5,0),t(292776,0,5,0),t(292963,0,5,0),
  t(293151,2,5,0),h(293338,5,5,294369,0,[[293338,5,5],[293713,6,4],[293994,7,2],[294369,7,1]]),t(294556,3,4,0),t(294650,2,8,0),
  t(295775,1,3,0),t(295775,7,3,0),t(296243,5,4,0),t(296337,2,4,0),
  f(296712,6,4),
// </six-eternel-remix-v3-hard-notes>
])(mhTap,mhHoldV2,mhFlick,mhSlideV2);
const sixEternelRemixExpertNotes=((t,h,f,s)=>[
// <six-eternel-remix-v3-expert-notes>
  f(1916,1,4),t(2666,6,3,0),t(2666,0,3,0),t(3228,4,1,0),
  t(3322,5,3,0),t(4540,7,3,0),h(5852,6,1,6695,0,[[5852,6,1],[6320,5,3],[6695,4,5]]),t(6789,1,8,0),
  t(7726,2,5,0),t(8288,4,5,0),t(9038,2,5,0),t(9413,1,4,0),
  h(10162,3,3,11662),t(10537,6,4,0),t(11287,6,4,0),t(11849,0,2,0),
  t(11849,4,2,0),t(12036,2,2,0),t(12036,6,2,0),t(12224,4,2,0),
  t(12224,8,2,0),t(13255,3,4,0),t(13348,6,4,0),f(13911,2,5),
  t(14379,5,5,0),t(14473,2,5,0),t(15316,1,3,0),t(16534,0,5,0),
  t(17097,0,5,0),t(17284,0,5,0),t(17659,1,2,0),t(17659,5,2,0),
  t(17846,3,2,0),t(17846,7,2,0),t(18034,1,2,0),t(18034,5,2,0),
  t(18971,0,5,0),t(19158,5,3,0),t(19533,2,5,0),t(20001,6,4,0),
  t(20470,5,4,0),t(21407,0,4,0),t(21407,7,3,0),t(21969,5,4,0),
  f(22063,2,5),t(22438,4,5,0),t(22719,5,5,0),t(22906,5,5,0),
  t(23187,0,2,0),t(23187,4,2,0),t(23562,2,2,0),t(23562,6,2,0),
  t(23937,4,2,0),t(23937,8,2,0),t(24687,0,5,0),t(24874,2,5,0),
  t(25061,4,5,0),t(25436,7,3,0),t(25811,3,3,0),t(26186,6,4,0),
  t(26373,3,4,0),t(27404,1,4,0),t(27591,3,4,0),t(28154,5,3,0),
  t(28341,2,5,0),t(28529,4,5,0),t(28622,2,5,0),f(28903,1,3),
  t(29278,2,5,0),t(29653,1,2,0),t(29653,5,2,0),t(29840,3,2,0),
  t(29840,7,2,0),t(30028,1,2,0),t(30028,5,2,0),t(30309,2,5,0),
  t(30403,0,8,0),t(30965,5,4,0),t(31902,3,4,0),t(32277,0,2,0),
  t(32277,4,2,0),t(32652,2,2,0),t(32652,6,2,0),t(33026,4,2,0),
  t(33026,8,2,0),t(33401,0,3,0),t(34151,1,4,0),s(34245,35556,[[34245,2,3],[34432,2,3],[34619,2,3],[34807,2,3],[34994,2,3],[35182,3,3],[35369,3,3],[35556,4,3]]),
  t(35744,0,4,0),t(35744,7,3,0),t(35931,4,5,0),t(36025,3,4,0),
  f(36306,5,5),t(36868,4,5,0),t(37056,3,4,0),h(37524,0,5,38461,0,[[37524,0,5],[37805,1,4],[38180,2,2],[38461,2,1]]),
  t(37899,0,5,0),t(38649,4,5,0),t(38836,0,5,0),t(39398,2,5,0),
  t(39586,0,5,0),t(40148,1,2,0),t(40148,5,2,0),t(40523,3,2,0),
  t(40523,7,2,0),t(40898,1,2,0),t(40898,5,2,0),t(41272,1,3,0),
  t(41835,0,4,0),t(42209,5,4,0),t(42772,0,4,0),t(43428,4,5,0),
  f(43990,5,5),t(44552,4,5,0),t(44833,2,5,0),h(45302,0,5,45770),
  t(46051,2,5,0),t(46332,4,5,0),t(46520,2,5,0),t(46614,1,5,0),
  t(47082,0,5,0),t(47176,1,4,0),t(47644,4,1,0),t(48113,6,4,0),
  t(48113,0,3,0),t(49612,3,4,0),t(49706,4,5,0),t(49893,4,1,0),
  t(49987,3,5,0),t(50643,7,3,0),t(51018,5,4,0),t(51205,2,5,0),
  f(51392,0,5),s(51955,53079,[[51955,2,3],[52142,2,3],[52330,2,3],[52517,2,3],[52704,3,3],[52892,4,3],[53079,4,3]],1),t(52517,5,4,0),t(52704,1,5,0),
  t(54016,0,5,0),t(54578,3,4,0),t(55516,1,4,0),h(55609,4,5,56546),
  t(56171,2,5,0),s(56827,57952,[[56827,0,3],[57108,0,3],[57390,1.5,3],[57671,3.5,3],[57952,4,3]]),t(57390,3,3,0),t(57483,4,4,0),
  h(58139,7,1,59264,0,[[58139,7,1],[58514,6,4],[58889,6,4],[59264,7,1]]),t(59451,5,4,0),t(59920,6,4,0),t(60201,3,3,0),
  t(60763,2,8,0),t(61044,3,3,0),f(61700,5,5),t(62075,1,4,0),
  t(62450,5,3,0),t(62543,2,5,0),t(62824,5,5,0),h(63387,5,4,63762),
  t(63949,4,5,0),h(64136,5,4,64980),t(64511,5,4,1),t(66292,0,4,0),
  t(66292,7,3,0),t(66573,5,4,0),t(67416,2,5,0),t(67603,6,4,0),
  t(67791,2,5,0),t(67885,7,3,0),t(68072,3,3,0),t(68166,5,3,0),
  t(68259,0,5,0),f(69009,0,3),t(69384,0,2,0),t(69384,4,2,0),
  t(69665,2,2,0),t(69665,6,2,0),t(69946,4,2,0),t(69946,8,2,0),
  h(70133,0,5,70789),t(71352,0,5,0),t(72008,2,5,0),t(72476,1,4,0),
  t(72570,0,5,0),t(72851,0,5,0),t(73038,1,2,0),t(73038,5,2,0),
  t(73319,3,2,0),t(73319,7,2,0),t(73601,1,2,0),t(73601,5,2,0),
  t(73882,4,5,0),t(74069,0,5,0),t(74631,0,4,0),t(74631,7,3,0),
  t(74819,0,5,0),f(75194,0,4),t(75568,0,5,0),s(75756,76880,[[75756,1.5,3],[75943,1.5,3],[76131,1.5,3],[76318,3,3],[76505,3,3],[76693,3.5,3],[76880,4,3]],1),
  t(76131,0,4,0),t(77911,0,5,0),t(78473,2,5,0),t(78754,4,5,0),
  t(79223,2,5,0),t(79410,1,3,0),t(79504,3,4,0),t(79879,4,5,0),
  t(80160,6,4,0),t(80254,1,4,0),t(80347,4,5,0),s(80535,81565,[[80535,4,3],[80816,2.5,3],[81097,0.5,3],[81378,0.5,3],[81565,1,3]]),
  t(81097,6,4,0),t(81191,5,4,0),t(81753,2,8,0),t(82034,5,4,0),
  f(82128,6,4),t(82596,3,4,0),t(82690,6,4,0),t(84377,2,5,0),
  t(84658,4,5,0),t(84845,7,3,0),t(84939,5,3,0),t(85126,1,5,0),
  t(85501,0,4,0),t(85688,1,3,0),t(85876,0,5,0),t(86063,0,5,0),
  t(86251,0,4,0),t(86438,0,4,0),t(86625,0,5,0),h(87000,5,5,87750,0,[[87000,5,5],[87375,7,1],[87750,5,5]]),
  t(87375,0,5,0),t(87937,3,4,0),t(88500,0,4,0),t(88500,7,3,0),
  f(88687,1,4),t(89437,5,4,0),t(90093,3,4,0),t(90280,4,5,0),
  t(90467,2,1,0),s(90749,91873,[[90749,1.5,3],[90936,0,3],[91123,2.5,3],[91311,0,3],[91498,0.5,3],[91686,1,3],[91873,1,3]]),t(91404,0,5,0),t(91498,0,4,0),
  t(91967,0,4,0),t(92060,3,3,0),t(92248,0,4,0),t(92435,1,4,0),
  t(92904,0,4,0),t(92997,1,3,0),t(93279,0,3,0),t(93560,1,4,0),
  t(93747,3,4,0),h(93841,3,4,94590),t(94872,3,3,0),f(94965,5,4),
  t(96183,5,5,0),t(96371,7,3,0),t(96746,5,5,0),t(96839,6,4,0),
  t(96933,5,5,0),t(97308,5,4,0),t(97495,6,4,0),t(97683,4,5,0),
  h(97870,3,4,98432),h(98620,7,3,99369),t(99557,7,3,0),t(99744,6,4,0),
  t(99744,0,3,0),t(100306,5,5,0),t(100400,6,4,0),t(100494,5,4,0),
  t(100869,0,8,0),t(100962,3,4,0),f(101243,0,4),h(102836,5,1,104336,1,[[102836,5,1],[103211,3,5],[103586,5,1],[103961,3,5],[104336,5,1]]),
  t(103211,1,4,0),t(103305,0,4,0),t(103492,1,4,0),t(103586,2,5,0),
  t(103867,5,3,0),t(103961,6,3,0),t(104804,5,4,0),t(104898,7,3,0),
  t(105273,4,5,0),t(105648,5,5,0),t(105741,1,4,0),s(106491,107522,[[106491,3,3],[106678,2.5,3],[106866,2.5,3],[107053,1.5,3],[107241,1.5,3],[107428,0.5,3],[107522,0.5,3]],1),
  t(107990,3,3,0),t(108178,5,5,0),t(109115,0,4,0),f(109302,2,5),
  t(109677,0,5,0),t(110052,5,4,0),t(110239,3,3,0),t(110614,6,4,0),
  t(110801,5,3,0),t(110989,5,3,0),t(111364,4,5,0),s(111738,112301,[[111738,3,3],[111926,4,3],[112113,4,3],[112301,4,3]],1),
  t(112863,3,4,0),t(113425,5,3,0),t(114362,1,3,0),t(114362,7,3,0),
  t(114643,5,3,0),t(114831,6,4,0),t(114924,5,4,0),t(115299,3,4,0),
  h(115393,5,3,116143),f(115768,1,4),t(116236,2,5,0),t(116517,0,4,0),
  t(116705,1,4,0),h(116892,3,4,117454),t(117642,4,5,0),t(117923,7,3,0),
  t(118017,1,3,0),t(118391,5,4,0),t(119141,2,5,0),t(120078,5,3,0),
  t(120359,8,1,0),t(120453,3,3,0),s(120547,121203,[[120547,3,3],[120734,1,3],[120921,0.5,3],[121109,0.5,3],[121203,0.5,3]]),t(121296,0,5,0),
  t(121484,5,3,0),t(121859,3,3,0),t(122046,5,5,0),t(122233,3,3,0),
  f(122421,6,4),t(122796,3,4,0),t(122983,5,4,0),t(123170,7,3,0),
  t(123358,5,3,0),t(123545,3,4,0),t(123920,1,4,0),t(124107,0,3,0),
  t(124670,0,4,0),t(124670,7,3,0),t(125232,0,8,2),t(126263,0,5,0),
  t(126731,3,3,0),t(126825,2,3,0),t(126919,5,3,0),t(127856,3,3,0),
  t(127949,8,1,0),t(128324,2,5,0),t(128418,5,4,0),t(128699,2,5,0),
  t(128980,2,3,0),t(129074,7,3,0),t(129167,4,3,0),t(129261,3,3,0),
  f(129449,0,5),t(129823,0,4,0),t(130105,0,3,0),t(130386,1,3,0),
  t(130573,3,3,0),t(130760,0,5,0),t(131135,0,3,0),t(132916,1,3,0),
  t(133103,4,5,0),t(133384,1,3,0),t(133572,4,5,0),t(133759,1,3,0),
  t(133853,3,3,0),s(134040,135165,[[134040,0,3],[134321,2,3],[134602,4,3],[134883,3,3],[135165,2,3]]),t(134415,7,3,0),t(134602,4,3,0),
  f(134790,5,4),h(135352,2,1,135914,0,[[135352,2,1],[135633,1,3],[135914,0,5]]),t(136102,2,5,0),t(136289,1,3,0),
  t(136289,7,3,0),t(136664,0,4,0),t(137039,1,3,0),t(137226,0,4,0),
  t(137413,3,3,0),t(137882,1,3,0),t(137976,5,4,0),t(138069,6,4,0),
  t(138538,5,4,0),f(139288,2,5),t(139756,1,3,0),t(139944,0,3,0),
  t(140131,1,3,0),t(140225,0,5,0),t(140412,0,5,0),t(140506,3,4,0),
  t(140787,5,3,0),t(140881,3,4,0),t(141255,1,4,0),t(141630,5,4,0),
  t(142005,1,4,0),t(142192,1,8,0),t(142380,0,4,0),t(142474,7,3,0),
  t(142661,5,3,0),t(142755,3,4,0),t(143129,1,4,0),t(143223,0,3,0),
  t(143504,1,4,0),t(143692,3,3,0),f(143879,5,4),t(145097,6,4,0),
  t(145285,6,3,0),t(145285,0,3,0),t(146034,3,4,0),t(146222,1,4,0),
  t(146409,3,3,0),t(146597,5,3,0),t(146784,3,3,0),t(146971,5,3,0),
  s(147159,148658,[[147159,3,3],[147440,1,3],[147721,1.5,3],[148002,1.5,3],[148283,1.5,3],[148564,1.5,3],[148658,0.5,3]],1),t(147534,5,4,0),t(147908,5,5,0),t(148096,5,5,0),
  t(149033,5,4,0),t(149220,5,4,0),t(149783,6,4,0),t(149970,6,4,0),
  t(150251,0,5,0),t(150345,3,5,0),t(150438,4,5,0),f(150532,6,4),
  t(151469,0,5,0),t(151938,4,5,0),t(152219,2,5,0),t(152313,3,5,0),
  t(152500,4,5,0),t(152594,3,4,0),t(152687,0,5,0),t(152968,0,4,0),
  t(153343,0,4,0),t(153437,1,4,0),t(153531,0,4,0),t(153812,1,4,0),
  t(154093,6,4,0),t(154093,0,3,0),t(154468,3,4,0),t(154561,1,4,0),
  t(154749,0,5,0),t(154936,0,5,0),f(155217,3,3),t(155686,0,5,0),
  t(156248,1,4,0),s(156342,157279,[[156342,3,3],[156529,2.5,3],[156717,1.5,3],[156904,2,3],[157092,4,3],[157279,4,3]]),t(157466,2,5,0),t(157654,4,5,0),
  t(158497,0,5,0),t(158966,0,5,0),h(159153,2,5,160184,0,[[159153,2,5],[159528,3,4],[159809,4,2],[160184,4,1]]),t(159528,4,5,0),
  t(159715,1,8,0),t(160465,0,5,0),t(160840,0,4,0),t(162901,0,3,0),
  t(163276,0,4,0),s(164400,165900,[[164400,0.5,3],[164682,0.5,3],[164963,1.5,3],[165244,3.5,3],[165525,2,3],[165806,0.5,3],[165900,0.5,3]]),t(164775,3,4,0),f(164869,4,5),
  t(165244,5,5,0),t(165431,5,5,0),t(166087,5,3,0),t(166181,3,4,0),
  t(166743,1,4,0),t(166837,0,4,0),t(167212,1,4,0),t(167399,1,3,0),
  h(167774,0,4,168336),t(168430,0,4,0),t(168898,0,4,0),t(168992,1,4,0),
  t(169086,2,5,0),t(169179,1,3,0),t(169835,0,3,0),t(169835,6,3,0),
  t(171335,0,1,0),f(171897,3,4),t(172459,0,5,0),h(172647,7,1,173771,0,[[172647,7,1],[173021,5,4],[173396,5,4],[173771,7,1]]),
  t(173021,2,5,0),t(173209,6,3,0),t(173396,9,1,0),t(173958,7,3,0),
  t(174146,3,4,0),t(174333,6,4,0),t(174521,3,4,0),t(174895,6,4,0),
  t(175270,6,4,0),t(175645,6,4,0),t(176207,7,3,3),t(176863,8,1,0),
  t(177800,0,5,0),t(177988,1,4,0),f(178175,2,5),t(178550,5,3,0),
  s(178737,179862,[[178737,2,3],[178925,2,3],[179112,2,3],[179300,2,3],[179487,2,3],[179674,2,3],[179862,4,3]]),t(179112,1,4,0),t(179300,0,4,0),t(180143,5,3,0),
  t(180330,3,3,0),h(180986,1,3,181923),t(181548,0,4,0),t(182017,4,4,0),
  t(182204,6,4,0),t(182204,0,3,0),t(182486,2,5,0),t(182579,5,5,0),
  t(183891,5,5,0),h(184547,5,4,185484),t(185016,3,4,0),t(185578,5,3,0),
  t(185953,2,8,0),t(187077,5,3,0),t(187452,5,5,0),h(187827,5,3,188483),
  f(188576,3,3),t(188951,5,4,0),s(190076,191575,[[190076,3,3],[190357,2.5,3],[190638,3,3],[190919,3.5,3],[191200,2.5,3],[191481,2.5,3],[191575,1,3]],1),t(190450,5,5,0),
  t(191950,1,4,0),t(192137,4,5,0),s(192325,193824,[[192325,2,3],[192606,1.5,3],[192887,1.5,3],[193168,2.5,3],[193449,3.5,3],[193730,4,3],[193824,4,3]],1),t(193074,5,5,0),
  t(194573,0,5,0),h(194948,6,4,195885),t(195323,1,4,0),t(195979,7,3,0),
  t(196448,1,3,0),t(196822,7,3,0),h(197197,5,3,198134,1),t(197572,6,4,0),
  t(197759,5,3,0),f(198696,3,4),s(199071,200008,[[199071,1.5,3],[199352,0.5,3],[199633,2.5,3],[199915,3.5,3],[200008,3.5,3]]),t(199446,0,4,0),
  s(200196,201695,[[200196,3,3],[200477,3.5,3],[200758,1,3],[201039,2,3],[201320,2,3],[201601,2,3],[201695,2,3]],1),t(200571,2,5,0),t(200945,4,5,0),t(201320,0,5,0),
  t(202070,0,4,0),t(202070,7,3,0),h(202257,0,5,203663,0,[[202257,0,5],[202632,1,3],[203007,2,1],[203288,1,3],[203663,0,5]]),t(202819,5,3,0),
  t(203194,2,5,0),h(203944,0,5,204881),t(204319,0,4,0),h(205068,0,5,206568),
  t(205443,3,4,0),t(205818,0,4,0),f(206193,3,4),t(206755,1,4,0),
  t(206942,4,5,0),t(207130,3,4,0),t(207317,6,4,0),t(207505,1,4,0),
  t(207692,3,4,0),t(207880,5,4,0),t(208067,6,4,0),t(208254,5,4,0),
  t(208442,3,4,0),t(208629,0,3,0),t(209004,3,4,0),t(209566,0,1,0),
  t(209941,2,5,0),h(210691,0,3,211159),t(211253,3,4,0),t(211440,0,4,0),
  t(212658,0,5,0),t(213033,2,5,0),t(213221,2,8,0),f(213502,7,3),
  t(213877,4,5,0),t(213970,0,5,0),t(214251,2,5,0),t(214533,0,3,0),
  t(214533,6,3,0),t(214720,0,5,0),t(214907,0,5,0),t(215095,3,4,0),
  t(215563,1,4,0),t(215938,0,3,0),t(216781,1,4,0),t(216875,4,5,0),
  t(217344,3,4,0),t(217719,5,5,0),t(217812,1,4,0),t(218093,2,5,0),
  t(218374,5,3,0),t(218843,6,4,0),f(218937,5,3),t(219405,6,4,0),
  t(219780,2,5,0),t(220155,1,4,0),t(220436,0,1,0),t(221373,0,4,0),
  t(221560,2,5,0),t(221748,0,4,0),t(222123,3,4,0),h(222497,0,5,223060,1),
  t(223622,0,4,0),t(223997,1,4,0),t(224184,3,4,0),s(224372,225121,[[224372,3,3],[224559,2.5,3],[224746,1.5,3],[224934,0.5,3],[225121,0.5,3]],1),
  t(224746,3,4,0),t(225496,1,4,0),t(225683,0,4,0),t(225683,7,3,0),
  t(226808,1,4,0),f(226995,0,4),t(227932,5,3,0),t(228307,3,3,0),
  t(228495,1,3,0),t(228588,0,3,0),t(228682,1,4,0),t(228776,2,3,0),
  t(228869,3,3,0),t(229057,6,4,0),t(229525,2,5,0),t(229900,4,5,0),
  t(230275,7,3,0),t(230462,4,5,0),t(230650,5,4,0),t(231025,6,4,0),
  t(231399,4,5,0),t(231493,4,3,0),f(231962,0,5),t(232524,0,4,0),
  t(232618,1,4,0),t(232899,3,4,0),h(233461,0,5,234023,1),t(234679,2,8,0),
  t(235054,1,4,0),t(235429,2,5,0),s(235804,236647,[[235804,1.5,3],[235991,0,3],[236178,0,3],[236366,0,3],[236553,0,3],[236647,0,3]]),t(236178,1,4,4),
  s(236928,237584,[[236928,1.5,3],[237115,1.5,3],[237303,0,3],[237490,0,3],[237584,0,3]]),t(237678,4,3,0),t(237865,0,5,0),t(238052,6,3,0),
  t(238052,0,3,0),t(238427,2,5,0),t(238615,5,5,0),t(239552,6,4,0),
  f(239739,6,4),t(240957,6,1,0),t(241426,6,4,0),t(241520,5,3,0),
  h(241801,6,4,242738),t(242269,0,5,0),t(242831,4,5,0),h(243206,1,3,243768),
  h(243956,8,1,245174,0,[[243956,8,1],[244331,7,2],[244799,6,4],[245174,5,5]]),t(245268,1,4,0),t(245361,5,4,0),t(245924,3,3,0),
  t(246486,8,1,0),t(246580,3,3,0),t(247329,6,4,0),t(248173,1,3,0),
  t(248922,4,5,0),t(249110,3,3,0),t(249203,8,1,0),s(249297,250140,[[249297,3,3],[249484,2,3],[249672,2,3],[249859,2,3],[250047,0.5,3],[250140,0.5,3]]),
  t(250234,0,4,0),t(250421,2,5,0),f(250609,5,4),t(250984,6,4,0),
  t(251359,1,3,0),t(251546,4,5,0),t(251733,2,5,0),t(252108,6,4,0),
  t(252296,4,5,0),t(252670,5,5,0),t(252764,5,3,0),t(252858,5,5,0),
  t(253326,0,4,0),t(253326,7,3,0),t(253514,6,4,0),t(255763,0,3,0),
  t(255950,0,3,0),t(256137,0,5,0),t(256325,0,3,0),t(256512,1,3,0),
  f(256700,3,3),t(257075,1,3,0),t(257168,0,3,0),t(257262,1,3,0),
  t(257356,4,3,0),t(257449,0,8,0),t(257730,3,3,0),t(257918,5,3,0),
  t(258105,1,3,0),t(258293,3,3,0),t(258480,0,3,0),t(258668,1,3,0),
  t(258761,3,3,0),t(259136,4,5,0),t(259417,6,4,0),t(259511,2,5,0),
  f(259886,5,5),t(260823,6,4,0),t(261104,5,3,0),t(261385,3,4,0),
  t(261572,5,4,0),t(261760,6,4,0),t(262791,0,5,0),t(262978,6,3,0),
  t(262978,0,3,0),t(263165,2,4,0),t(263259,5,4,0),t(263540,0,3,0),
  t(263728,0,4,0),t(263915,0,5,0),t(264102,0,5,0),t(264290,0,5,0),
  t(264477,2,5,0),t(264571,5,3,0),t(264665,6,3,0),t(265039,5,3,0),
  t(265227,5,3,0),f(265414,5,5),t(265789,5,5,0),t(266164,5,4,0),
  t(266539,6,4,0),t(266914,5,4,0),t(269162,7,3,0),t(269256,3,3,0),
  t(269350,5,3,0),t(269444,0,5,0),t(269631,4,5,0),t(269725,3,3,0),
  t(269818,2,5,0),t(269912,0,3,0),t(270099,1,3,0),t(270193,4,5,0),
  h(270474,2,5,271130,0,[[270474,2,5],[270849,3,3],[271130,4,1]]),t(271318,1,4,0),t(271411,2,5,0),t(271692,4,5,0),
  t(271786,6,3,0),s(271974,273473,[[271974,2,3],[272255,3,3],[272536,3.5,3],[272817,3.5,3],[273098,4,3],[273379,4,3],[273473,4,3]]),f(272442,4,5),t(272817,1,4,0),
  t(273567,7,3,0),s(273754,274785,[[273754,3,3],[273941,3,3],[274129,1,3],[274316,1.5,3],[274504,2,3],[274691,1.5,3],[274785,1.5,3]],1),t(274316,6,4,0),t(276003,6,3,0),
  t(276003,0,3,0),t(276565,5,4,0),t(276659,2,8,0),t(276753,3,3,0),
  t(276846,0,5,0),t(277127,3,3,0),t(277221,0,3,0),h(277408,2,5,278064),
  t(278346,0,5,0),f(278533,0,5),t(279095,4,5,0),t(279283,2,5,0),
  t(279470,0,5,0),t(279657,0,4,0),t(279845,0,5,0),t(280032,0,5,0),
  t(280220,3,3,0),t(280782,5,3,0),t(280969,3,3,0),t(281157,0,5,0),
  t(281531,0,4,0),t(282469,0,4,0),t(282469,7,3,0),t(283499,4,5,0),
  t(283687,0,5,0),t(283780,3,3,0),t(284155,0,3,0),t(284249,0,5,0),
  f(284530,4,5),h(284999,2,5,285561),t(285748,0,5,0),h(286029,5,4,286592),
  t(286779,2,5,0),t(287247,5,5,0),t(287341,3,4,0),t(287716,5,3,0),
  t(288091,7,3,0),t(289496,5,4,0),t(289871,3,4,0),t(290433,0,5,0),
  t(290527,0,5,0),t(290621,0,5,0),t(290715,2,5,0),t(290902,4,5,0),
  t(291089,5,5,0),f(291277,0,5),t(291652,4,5,0),t(291839,2,5,0),
  t(292026,5,5,0),t(292214,2,5,0),t(292401,5,5,0),t(292589,4,5,0),
  t(292776,2,5,0),t(292963,5,5,0),t(293151,4,5,0),h(293338,7,1,294369,0,[[293338,7,1],[293713,6,4],[293994,6,4],[294369,7,1]]),
  t(293713,5,5,0),t(293901,9,1,0),t(294556,3,4,0),t(294650,1,5,0),
  t(294931,0,8,0),t(295775,1,3,0),t(295775,7,3,0),t(296243,5,4,0),
  t(296337,2,4,0),t(296712,6,4,0),f(296805,5,3),
// </six-eternel-remix-v3-expert-notes>
])(mhTap,mhHoldV2,mhFlick,mhSlideV2);
const sixEternelRemixMasterNotes=((t,h,f,s)=>[
// <six-eternel-remix-v3-master-notes>
  f(1916,1,3),t(2666,6,2,0),t(2666,2,2,0),t(3228,4,1,0),
  t(3322,6,2,0),t(4540,8,2,0),h(5852,7,1,6695,0,[[5852,7,1],[6320,6,3],[6695,5,4]]),t(6789,2,6,0),
  t(7164,2,2,0),t(7164,6,2,0),t(7726,1,2,0),t(7726,7,2,0),
  t(8288,0,2,0),t(8288,8,2,0),t(9038,1,4,0),t(9413,1,3,0),
  h(10162,2,2,11662),t(10537,0,2,0),t(11287,3,3,0),t(11849,5,4,0),
  t(12036,3,4,0),t(12224,2,2,0),f(12318,3,4),t(13255,5,3,0),
  t(13348,6,3,0),t(13911,5,4,0),t(14379,6,4,0),t(14473,5,4,0),
  t(15316,8,2,0),t(16534,3,4,0),t(17097,3,4,0),t(17284,5,4,0),
  t(17659,5,4,0),t(17846,6,4,0),t(17846,1,3,0),t(18034,6,4,0),
  t(18221,1,4,0),t(18971,3,4,0),t(19158,6,2,0),t(19533,6,4,0),
  f(20001,5,3),t(20470,3,3,0),t(21407,1,3,0),t(21501,5,4,0),
  t(21969,3,3,0),t(22063,6,4,0),t(22344,5,4,0),t(22438,6,4,0),
  t(22719,5,4,0),t(22906,6,4,0),t(23187,4,2,0),t(23562,7,3,0),
  t(23843,3,4,0),t(23937,8,2,0),t(24687,5,4,0),t(24874,3,4,0),
  t(25061,1,4,0),f(25436,0,2),t(25811,2,2,0),t(25811,6,2,0),
  t(26186,3,3,0),t(26373,5,3,0),t(27123,7,3,0),t(27404,3,3,0),
  t(27591,5,3,0),t(28154,8,2,0),t(28341,5,4,0),t(28529,3,4,0),
  t(28622,2,4,0),t(28903,0,2,0),t(29091,0,6,0),t(29278,5,4,0),
  t(29653,1,4,0),t(29840,3,4,0),t(30028,0,4,0),t(30122,5,3,0),
  t(30309,1,4,0),f(30403,3,4),t(30965,0,3,0),t(31902,3,3,0),
  t(32277,1,3,0),t(32464,0,4,0),t(32652,2,2,0),t(33026,0,3,0),
  t(33401,2,2,0),t(33401,6,2,0),t(34151,3,3,0),s(34245,35556,[[34245,3,2],[34432,3,2],[34619,3,2],[34807,2.5,2],[34994,2.5,2],[35182,4,2],[35369,4,2],[35556,4,2]]),
  t(34994,3,4,0),t(35744,5,3,0),t(35931,3,4,0),t(36025,5,3,0),
  f(36306,3,4),t(36868,6,4,0),t(37056,3,3,0),h(37524,6,4,38461,0,[[37524,6,4],[37805,7,3],[38180,8,2],[38461,8,1]]),
  t(37899,1,4,0),t(38649,5,4,0),t(38836,3,4,0),t(39211,8,2,0),
  t(39398,5,4,0),t(39586,6,4,0),t(40148,0,2,0),t(40148,4,2,0),
  t(40523,4,2,0),t(40523,8,2,0),t(40898,0,2,0),t(40898,4,2,0),
  t(41272,4,2,0),t(41272,8,2,0),h(41460,1,3,42116),t(42209,2,3,0),
  t(42772,0,3,0),t(42772,5,3,0),f(43428,0,4),h(43802,1,4,44271),
  t(44552,3,4,0),t(44833,5,4,0),h(45302,6,4,45770),t(46051,5,4,0),
  t(46332,6,4,0),t(46520,5,4,0),t(46614,6,4,0),t(46988,1,4,0),
  t(47082,5,4,0),t(47176,3,3,0),t(47644,8,1,0),f(48113,5,3),
  t(49612,3,3,0),t(49706,5,4,0),t(49893,4,1,0),t(49987,0,6,0),
  t(50643,0,2,0),t(50643,4,2,0),t(50830,1,2,0),t(50830,5,2,0),
  t(51018,3,2,0),t(51018,7,2,0),t(51205,4,2,0),t(51205,8,2,0),
  t(51392,1,4,0),s(51955,53079,[[51955,1.5,2],[52142,1.5,2],[52330,1.5,2],[52517,1.5,2],[52704,2,2],[52892,3.5,2],[53079,3.5,2]],1),t(52517,1,3,0),t(52704,3,4,0),
  t(53829,6,2,0),t(53829,2,2,0),t(54016,3,4,0),t(54578,1,3,0),
  t(55516,0,3,0),h(55609,3,4,56546),t(56171,7,3,0),s(56827,57952,[[56827,0,2],[57108,0,2],[57390,1.5,2],[57671,4,2],[57952,4,2]]),
  t(57390,4,2,0),f(57483,5,3),h(58139,3,1,59264,0,[[58139,3,1],[58514,2,3],[58889,2,3],[59264,3,1]]),t(59451,0,3,0),
  t(59920,3,3,0),t(60201,2,2,0),t(60763,3,4,0),t(61044,6,2,0),
  t(61700,6,4,0),t(62075,5,3,0),t(62356,8,2,0),t(62450,6,2,0),
  t(62543,6,4,0),t(62824,5,4,0),h(63012,5,4,63762),t(63387,7,3,1),
  t(63949,6,4,0),t(63949,1,3,0),h(64136,3,3,64980),f(64511,1,3),
  t(65261,5,3,0),t(66292,3,3,0),t(66573,7,3,0),t(67416,5,4,0),
  t(67603,7,3,0),t(67791,5,4,0),t(67885,7,2,0),t(68072,4,2,0),
  t(68166,6,2,0),t(68259,6,4,0),t(69009,6,2,0),t(69384,1,4,0),
  t(69665,3,4,0),t(69946,0,4,0),t(70133,1,4,0),h(70227,5,3,70789,1),
  f(71352,0,4),t(72008,1,4,0),t(72476,0,3,0),t(72570,1,4,0),
  t(72851,0,6,0),t(73038,1,4,0),t(73319,1,4,0),t(73319,7,3,0),
  t(73601,6,1,0),t(73882,3,4,0),t(74069,5,4,0),t(74350,6,4,0),
  t(74631,5,3,0),t(74819,0,4,0),t(75194,0,3,0),t(75381,1,4,0),
  t(75568,1,4,0),s(75756,76880,[[75756,1.5,2],[75943,1.5,2],[76131,1.5,2],[76318,3,2],[76505,3,2],[76693,3.5,2],[76880,4,2]],1),f(76131,0,3),t(77911,1,4,0),
  t(78473,3,4,0),t(78754,5,4,0),t(79223,6,4,0),t(79410,2,2,0),
  t(79504,5,3,0),t(79879,3,4,0),t(80160,7,3,0),t(80254,3,3,0),
  t(80347,5,4,0),s(80535,81565,[[80535,4,2],[80816,2.5,2],[81097,0.5,2],[81378,0.5,2],[81565,1,2]]),t(81097,5,3,0),t(81191,4,3,0),
  t(81753,1,4,0),t(81847,0,4,0),t(82034,1,3,0),f(82128,0,3),
  t(82596,3,3,0),t(82690,0,3,0),t(84377,1,4,0),t(84377,7,3,0),
  t(84658,3,4,0),t(84845,6,2,0),t(84939,4,2,0),t(85126,5,4,0),
  t(85501,2,2,0),t(85501,6,2,0),t(85688,2,2,0),t(85688,7,2,0),
  t(85876,1,2,0),t(85876,8,2,0),t(86063,0,2,0),t(86063,8,2,0),
  t(86251,7,3,0),t(86438,7,3,0),t(86625,6,4,0),t(86813,1,4,0),
  h(87000,0,4,87750,0,[[87000,0,4],[87375,1,1],[87750,0,4]]),f(87375,1,4),t(87937,0,3,0),t(88500,1,3,0),
  t(88687,0,3,0),t(89437,1,3,0),t(89437,6,3,0),t(90093,3,3,0),
  t(90280,5,4,0),t(90467,2,1,0),s(90749,91873,[[90749,1.5,2],[90936,0,2],[91123,2.5,2],[91311,0,2],[91498,0.5,2],[91686,1,2],[91873,1,2]]),t(91404,0,6,0),
  t(91498,0,3,0),t(91967,0,3,0),t(92060,2,2,0),t(92154,3,3,0),
  t(92248,1,3,0),f(92435,0,3),t(92904,5,3,0),t(92997,2,2,0),
  t(93279,4,2,0),t(93466,0,3,0),t(93560,1,3,0),t(93747,5,3,0),
  h(93841,1,3,94590),t(94872,0,2,0),t(94965,1,3,0),t(96183,0,4,0),
  t(96371,0,2,0),t(96746,0,4,0),t(96839,0,3,0),t(96933,1,4,0),
  t(97308,0,3,0),t(97308,5,3,0),t(97495,1,3,0),t(97683,0,4,0),
  h(97870,1,3,98432),h(98620,6,2,99369),t(99557,8,2,0),f(99744,7,3),
  t(100306,6,4,0),t(100400,7,3,0),t(100494,4,3,0),t(100869,1,4,0),
  t(100962,3,3,0),t(101243,0,3,0),h(102836,4,1,104336,1,[[102836,4,1],[103211,3,4],[103586,4,1],[103961,3,4],[104336,4,1]]),t(103211,5,3,0),
  t(103305,4,3,0),t(103492,2,3,0),t(103586,3,4,0),t(103867,6,2,0),
  f(103961,4,3),t(104804,5,3,0),t(104898,7,2,0),t(105273,5,4,0),
  t(105273,0,3,0),t(105648,6,4,0),t(105741,3,3,0),t(106116,5,3,0),
  s(106491,107522,[[106491,3,2],[106678,2.5,2],[106866,2.5,2],[107053,1.5,2],[107241,1.5,2],[107428,0.5,2],[107522,0.5,2]],1),t(107990,0,2,0),t(108178,3,4,0),t(108552,1,4,0),
  t(109115,5,3,0),t(109302,3,4,0),t(109677,4,6,0),t(110052,1,3,0),
  t(110239,4,2,0),t(110614,1,2,0),t(110614,5,2,0),t(110801,4,2,0),
  t(110801,8,2,0),t(110989,1,2,0),t(110989,5,2,0),t(111176,4,2,0),
  t(111176,8,2,0),f(111364,0,4),s(111738,112301,[[111738,1.5,2],[111926,3,2],[112113,4,2],[112301,3,2]],1),t(112863,1,3,0),
  t(113425,4,2,0),t(114362,0,2,0),t(114643,2,2,0),t(114831,3,3,0),
  t(114924,4,3,0),t(115299,7,3,0),h(115393,6,2,116143),t(115768,8,2,0),
  t(116236,4,4,0),t(116517,0,3,0),t(116517,5,3,0),t(116705,1,3,0),
  h(116892,4,1,117454,0,[[116892,4,1],[117173,3,3],[117454,3,4]]),t(117642,6,4,0),t(117829,4,2,0),t(117923,6,2,0),
  f(118017,4,2),t(118391,3,3,0),t(119141,6,4,0),t(120078,0,2,0),
  t(120359,3,1,0),t(120453,7,2,0),s(120547,121203,[[120547,2.5,2],[120734,1,2],[120921,1,2],[121109,1,2],[121203,1,2]]),t(121296,1,4,0),
  t(121484,4,2,0),t(121577,6,2,0),t(121859,8,2,0),t(122046,3,4,0),
  t(122233,6,2,0),f(122421,1,3),t(122796,0,3,0),t(122983,3,3,0),
  t(123170,0,2,0),t(123170,4,2,0),t(123358,2,2,0),t(123545,5,3,0),
  t(123920,3,3,0),t(124107,8,2,0),t(124295,5,3,0),t(124670,3,3,0),
  t(125232,5,4,2),t(126263,1,4,0),t(126731,4,2,0),t(126825,6,2,0),
  f(126919,1,2),t(127856,4,2,0),t(127949,8,1,0),t(128324,3,4,0),
  t(128418,5,3,0),t(128699,2,6,0),t(128980,2,2,0),t(129074,5,2,0),
  t(129167,2,2,0),t(129261,4,2,0),t(129449,1,4,0),t(129823,3,3,0),
  t(130011,6,2,0),t(130105,4,2,0),t(130386,2,2,0),t(130386,6,2,0),
  t(130573,0,2,0),t(130760,1,4,0),f(131135,6,2),t(132916,2,2,0),
  t(133103,5,4,0),t(133384,4,2,0),t(133572,6,4,0),t(133759,5,2,0),
  t(133853,0,2,0),s(134040,135165,[[134040,0,2],[134321,2,2],[134602,4,2],[134883,3,2],[135165,2,2]]),t(134415,8,2,0),t(134602,5,2,0),
  t(134790,5,3,0),h(135352,1,4,135914,0,[[135352,1,4],[135633,2,3],[135914,3,1]]),t(136102,5,4,0),t(136289,4,2,0),
  t(136570,2,2,0),t(136664,0,3,0),t(137039,6,2,0),t(137226,3,3,0),
  t(137413,2,2,0),t(137882,0,2,0),t(137976,5,3,0),f(138069,1,3),
  t(138538,2,3,0),t(138538,7,3,0),t(139288,0,4,0),t(139569,0,1,0),
  t(139756,0,2,0),t(139944,2,2,0),t(140131,2,2,0),t(140225,0,4,0),
  t(140412,1,4,0),t(140506,3,3,0),t(140787,6,2,0),t(140881,7,3,0),
  t(141068,6,2,0),t(141255,3,3,0),t(141443,2,2,0),f(141630,5,3),
  t(142005,1,3,0),t(142192,2,6,0),t(142380,0,3,0),t(142474,2,2,0),
  t(142661,4,2,0),t(142755,1,3,0),t(143129,0,3,0),t(143223,2,2,0),
  t(143317,4,2,0),t(143504,5,3,0),t(143504,0,3,0),t(143692,4,2,0),
  t(143879,7,3,0),t(145097,5,3,0),f(145285,4,2),t(146034,0,2,0),
  t(146034,4,2,0),t(146222,1,2,0),t(146222,5,2,0),t(146409,3,2,0),
  t(146409,7,2,0),t(146597,4,2,0),t(146597,8,2,0),t(146784,6,2,0),
  t(146878,3,3,0),t(146971,2,2,0),s(147159,148658,[[147159,2,2],[147440,0,2],[147721,1,2],[148002,1,2],[148283,1,2],[148564,1,2],[148658,0,2]]),t(147534,5,3,0),
  t(147908,5,4,0),t(148096,5,4,0),t(148845,6,4,0),t(149033,7,3,0),
  t(149220,7,3,0),t(149783,7,3,0),t(149970,7,3,0),t(150251,6,4,0),
  t(150345,2,4,0),t(150438,6,4,0),f(150532,3,3),t(151469,0,4,0),
  t(151469,6,3,0),t(151938,0,4,0),t(152125,0,4,0),t(152219,1,4,0),
  t(152313,1,4,0),t(152500,5,4,0),t(152594,3,3,0),t(152687,6,4,0),
  t(152875,4,3,0),t(152968,7,3,0),t(153343,5,3,0),t(153437,7,3,0),
  t(153531,3,3,0),t(153812,7,3,0),t(154093,3,3,0),t(154187,6,3,0),
  t(154468,1,3,0),t(154561,4,3,0),t(154749,5,4,0),t(154843,7,3,0),
  t(154936,3,4,0),f(155217,6,2),t(155686,1,4,0),t(156248,0,3,0),
  s(156342,157279,[[156342,1.5,2],[156529,1,2],[156717,0,2],[156904,0.5,2],[157092,2.5,2],[157279,2.5,2]]),t(157466,0,4,0),t(157466,6,3,0),t(157654,1,4,0),
  t(158029,0,3,0),t(158966,4,6,0),h(159153,5,1,160184,0,[[159153,5,1],[159528,4,3],[159809,4,3],[160184,5,1]]),t(159528,7,3,0),
  t(159715,3,4,0),t(160465,1,4,0),f(160840,3,3),t(161402,5,4,0),
  t(162901,4,2,0),t(163276,7,3,0),s(164307,165806,[[164307,3,2],[164588,2.5,2],[164869,3,2],[165150,4,2],[165431,3.5,2],[165712,3,2],[165806,3,2]]),t(164682,6,4,0),
  t(164775,5,3,0),t(164869,6,4,0),t(165244,5,4,0),t(165431,5,4,0),
  t(165900,3,4,0),t(166087,3,2,0),t(166181,1,3,0),t(166743,3,3,0),
  t(166837,5,3,0),t(167212,7,3,0),t(167212,2,3,0),t(167399,8,2,0),
  h(167774,5,3,168336),f(168430,5,3),t(168898,3,3,0),t(168992,5,3,0),
  t(169086,6,4,0),t(169179,6,2,0),t(169835,4,2,0),t(171335,0,1,0),
  t(171897,3,3,0),t(172272,0,4,0),t(172459,3,4,0),h(172647,0,3,173771),
  t(173021,0,4,0),t(173209,0,2,0),t(173396,0,3,0),t(173958,2,2,0),
  t(174146,0,3,0),t(174333,1,3,0),f(174521,3,3),t(174895,1,3,0),
  t(174989,4,1,0),t(175270,5,3,0),t(175645,7,3,0),t(175739,3,3,0),
  t(176207,6,2,0),t(176207,2,2,0),t(176863,8,1,0),t(177613,6,2,0),
  t(177800,6,4,0),t(177988,5,3,0),t(178175,2,6,0),t(178362,2,2,0),
  t(178550,0,2,0),s(178737,179862,[[178737,1.5,2],[178925,1.5,2],[179112,1,2],[179300,1,2],[179487,1,2],[179674,1.5,2],[179862,3.5,2]]),t(179112,1,3,0),f(179300,1,3),
  t(180143,6,2,0),t(180330,2,2,0),h(180986,4,2,181923),t(181548,0,3,0),
  t(182017,1,3,0),t(182204,5,3,0),t(182486,3,4,0),t(182579,4,4,0),
  t(183891,5,4,0),t(184360,4,2,0),h(184547,1,3,185484),t(185016,0,3,0),
  t(185578,2,2,3),t(185953,1,4,0),t(185953,7,3,0),t(187077,0,2,0),
  t(187264,4,2,0),f(187452,0,4),h(187827,3,4,188483,0,[[187827,3,4],[188202,5,1],[188483,3,4]]),t(188576,0,2,0),
  t(188951,3,3,0),s(190076,191575,[[190076,1.5,2],[190357,1,2],[190638,1.5,2],[190919,2,2],[191200,1,2],[191481,1,2],[191575,0,2]],1),t(190450,0,4,0),t(191013,0,2,0),
  t(191950,1,3,0),t(192137,4,4,0),s(192325,193824,[[192325,2,2],[192606,1.5,2],[192887,1.5,2],[193168,2.5,2],[193449,3.5,2],[193730,4,2],[193824,4,2]],1),t(193074,6,4,0),
  t(194199,1,4,0),t(194573,3,4,0),h(194948,5,3,195885),t(195323,7,3,0),
  t(195979,6,2,0),f(196448,4,2),t(196822,0,2,0),t(197010,1,4,0),
  h(197197,4,2,198134,1),t(197572,7,3,0),t(197759,8,2,0),t(198696,5,3,0),
  t(198696,0,3,0),s(199071,200008,[[199071,2,2],[199259,0,2],[199446,1,2],[199633,2,2],[199821,2,2],[200008,2,2]]),t(199446,1,3,0),t(199633,0,2,0),
  s(200196,201695,[[200196,1.5,2],[200477,2,2],[200758,0,2],[201039,0.5,2],[201320,0.5,2],[201601,0.5,2],[201695,0.5,2]],1),t(200571,3,4,0),t(200945,5,4,0),t(201320,1,4,0),
  t(202070,7,3,0),h(202257,0,3,203663),t(202819,8,2,0),f(203194,1,4),
  t(203944,4,6,0),t(204319,1,3,0),t(204694,3,3,0),h(205068,7,1,206568,0,[[205068,7,1],[205443,5,4],[205818,7,1],[206193,5,4],[206568,7,1]]),
  t(205443,7,3,0),t(205818,5,3,0),t(206005,5,3,0),t(206193,9,1,0),
  t(206755,7,3,0),t(206942,1,4,0),t(207130,1,3,0),t(207224,2,3,0),
  t(207317,1,3,0),t(207505,5,3,0),t(207505,0,3,0),t(207692,2,2,0),
  t(207692,6,2,0),t(207880,2,2,0),t(207880,7,2,0),t(208067,1,2,0),
  t(208067,8,2,0),t(208254,0,2,0),t(208254,8,2,0),t(208442,0,3,0),
  t(208629,2,2,0),t(208910,0,3,0),f(209004,1,3),t(209566,4,1,0),
  t(209941,5,4,0),h(210691,8,2,211159),t(211253,3,3,0),t(211347,6,4,0),
  t(211440,3,3,0),t(212658,0,4,0),t(213033,1,4,0),t(213221,3,4,0),
  f(213502,2,2),t(213877,0,4,0),t(213970,1,4,0),t(214251,0,4,0),
  t(214345,2,2,0),t(214533,0,2,0),t(214533,4,2,0),t(214720,3,4,0),
  t(214907,1,4,0),t(215095,5,3,0),t(215470,8,2,0),t(215563,4,3,0),
  t(215938,4,2,0),t(216781,3,3,0),t(216875,6,4,0),t(217250,3,3,0),
  t(217344,7,3,0),t(217719,5,4,0),t(217812,7,3,0),t(218093,5,4,0),
  f(218374,8,2),t(218843,5,3,0),t(218937,8,2,0),t(219405,3,3,0),
  t(219780,5,4,0),t(219967,3,3,0),t(220155,1,3,0),t(220436,0,1,0),
  t(221373,0,3,0),t(221560,2,6,0),t(221748,0,3,0),t(222123,2,3,0),
  t(222123,7,3,0),h(222497,0,4,223060,1),t(223435,1,2,0),t(223435,5,2,0),
  t(223622,4,2,0),t(223622,8,2,0),t(223809,1,2,0),t(223809,5,2,0),
  t(223997,4,2,0),t(223997,8,2,0),t(224184,1,3,0),s(224372,225121,[[224372,2,2],[224559,2,2],[224746,0.5,2],[224934,0,2],[225121,0,2]],1),
  f(224746,1,3),t(225496,3,3,0),t(225683,0,3,0),t(226808,0,3,0),
  t(226995,1,3,0),t(227932,0,2,0),t(228213,2,2,0),t(228307,6,2,0),
  t(228495,6,2,0),t(228588,2,2,0),t(228682,5,3,0),t(228776,4,2,0),
  t(228869,2,2,0),t(228963,6,2,0),t(229057,7,3,0),f(229150,6,2),
  t(229525,1,4,0),t(229525,7,3,0),t(229900,6,4,0),t(230275,6,2,0),
  t(230462,3,4,0),t(230650,1,3,0),t(231025,0,3,0),t(231399,5,4,0),
  t(231493,2,2,0),t(231962,3,4,0),t(232149,0,3,0),t(232524,1,3,0),
  t(232618,5,3,0),t(232899,3,3,0),h(233461,8,1,234023,1,[[233461,8,1],[233742,7,3],[234023,6,4]]),t(234679,1,4,0),
  t(234866,4,2,0),f(235054,5,3),t(235429,6,4,0),s(235804,236647,[[235804,3,2],[235991,0.5,2],[236178,0.5,2],[236366,0.5,2],[236553,1.5,2],[236647,1.5,2]]),
  t(236178,3,3,4),s(236928,237584,[[236928,1.5,2],[237115,1.5,2],[237303,0,2],[237490,0,2],[237584,0,2]]),t(237678,4,2,0),t(237865,5,4,0),
  t(238052,8,2,0),t(238427,5,4,0),t(238615,1,4,0),t(238615,7,3,0),
  t(239552,1,3,0),t(239739,5,3,0),t(240957,6,1,0),t(241426,7,3,0),
  t(241520,6,2,0),h(241801,7,3,242738),t(242269,0,6,0),t(242831,5,4,0),
  h(243019,4,2,243768),f(243394,6,4),h(243956,5,3,245174),t(245268,1,3,0),
  t(245361,3,3,0),t(245924,6,2,0),t(246486,8,1,0),t(246580,4,2,0),
  t(247329,7,3,0),t(248173,0,2,0),t(248922,0,4,0),t(249110,2,2,0),
  t(249203,6,1,0),s(249297,250140,[[249297,2,2],[249484,1,2],[249672,1,2],[249859,1,2],[250047,0.5,2],[250140,0.5,2]]),t(250234,1,3,0),t(250421,5,4,0),
  t(250421,0,3,0),f(250609,3,3),t(250984,7,3,0),t(251359,2,2,0),
  t(251546,3,4,0),t(251733,5,4,0),t(252108,7,3,0),t(252296,5,4,0),
  t(252483,8,2,0),t(252670,5,4,0),t(252764,5,2,0),t(252858,6,4,0),
  t(253326,7,3,0),f(253514,7,3),t(255763,0,2,0),t(255763,4,2,0),
  t(255950,1,2,0),t(255950,5,2,0),t(256137,3,2,0),t(256137,7,2,0),
  t(256325,4,2,0),t(256325,8,2,0),t(256512,2,2,0),t(256700,2,2,0),
  t(256887,0,2,0),t(257075,1,2,0),t(257168,6,2,0),t(257262,4,2,0),
  t(257356,2,2,0),t(257449,0,4,0),t(257543,0,2,0),t(257730,2,2,0),
  t(257730,6,2,0),t(257918,5,2,0),t(258012,2,2,0),t(258105,4,2,0),
  h(258293,6,4,258949,0,[[258293,6,4],[258668,7,3],[258949,9,1]]),t(259136,5,4,0),t(259417,3,3,0),f(259511,1,4),
  t(259886,0,6,0),t(260260,1,3,0),t(260635,3,3,0),t(260823,5,3,0),
  t(261104,8,2,0),t(261385,0,3,0),t(261572,3,3,0),t(261760,7,3,0),
  t(262791,1,4,0),t(262978,6,2,0),t(263165,3,3,0),t(263259,7,3,0),
  h(263540,8,2,264196),t(264290,6,4,0),t(264477,3,4,0),t(264571,3,2,0),
  t(264665,5,2,0),t(264946,2,2,0),t(265039,4,2,0),t(265227,2,2,0),
  t(265227,6,2,0),f(265414,0,4),t(265789,2,2,0),t(265789,6,2,0),
  t(266164,2,2,0),t(266164,7,2,0),t(266539,1,2,0),t(266539,8,2,0),
  t(266914,0,2,0),t(266914,8,2,0),f(267101,0,2),t(269162,2,2,0),
  t(269256,6,2,0),t(269350,4,2,0),t(269444,6,4,0),t(269631,3,4,0),
  t(269725,5,2,0),t(269818,0,4,0),t(269912,2,2,0),t(270099,6,2,0),
  t(270193,1,4,0),h(270474,4,2,271130),t(271224,0,2,0),t(271318,3,3,0),
  t(271411,4,4,0),t(271692,6,4,0),t(271786,6,2,0),s(271974,273473,[[271974,1.5,2],[272255,2,2],[272536,2.5,2],[272817,2.5,2],[273098,4,2],[273379,4,2],[273473,4,2]]),
  t(272348,6,2,0),t(272442,4,4,0),t(272817,7,3,0),t(273567,6,2,0),
  t(273754,3,3,0),s(273848,274785,[[273848,1.5,2],[274035,0,2],[274223,0,2],[274410,0,2],[274597,0,2],[274785,0,2]],1),t(274316,0,3,0),f(276003,2,2),
  t(276565,3,3,0),t(276659,1,4,0),t(276753,0,2,0),t(276846,0,4,0),
  t(277127,2,2,0),t(277221,0,2,0),t(277315,3,3,0),h(277408,2,1,278064,0,[[277408,2,1],[277783,0,4],[278064,2,1]]),
  t(278346,0,6,0),t(278533,5,4,0),t(278533,0,3,0),t(279095,1,2,0),
  t(279095,5,2,0),t(279283,4,2,0),t(279283,8,2,0),t(279470,1,2,0),
  t(279470,5,2,0),t(279657,4,2,0),t(279657,8,2,0),t(279845,0,4,0),
  h(280032,0,4,280594),s(280782,281344,[[280782,1.5,2],[280969,1.5,2],[281157,2,2],[281344,3.5,2]]),f(281531,2,3),t(282469,0,3,0),
  t(282469,5,3,0),t(283499,1,4,0),t(283687,3,4,0),t(283780,2,2,0),
  t(284062,0,4,0),t(284155,6,2,0),t(284249,1,4,0),t(284530,3,4,0),
  h(284999,0,4,285561),t(285748,1,4,0),h(286029,0,3,286592),t(286779,1,4,0),
  t(287247,3,4,0),t(287341,3,3,0),f(287716,6,2),t(288091,8,2,0),
  t(289496,3,3,0),t(289871,7,3,0),t(290246,5,3,0),t(290246,0,3,0),
  t(290433,6,4,0),t(290527,5,4,0),t(290621,6,4,0),t(290715,5,4,0),
  t(290902,3,4,0),t(291089,1,4,0),f(291277,0,4),t(291652,1,4,0),
  t(291839,5,4,0),t(291933,3,4,0),t(292026,6,4,0),t(292120,5,4,0),
  t(292214,1,4,0),t(292401,0,2,0),t(292401,4,2,0),t(292589,1,2,0),
  t(292589,5,2,0),t(292776,3,2,0),t(292776,7,2,0),t(292963,4,2,0),
  t(292963,8,2,0),t(293151,3,4,0),h(293338,6,4,294369,0,[[293338,6,4],[293713,7,2],[293994,7,2],[294369,6,4]]),t(293713,5,4,0),
  t(293901,3,4,0),t(294556,1,3,0),t(294650,0,4,0),t(294744,0,1,0),
  t(294931,0,6,0),t(295775,2,2,0),t(295775,6,2,0),t(296243,5,3,0),
  t(296337,3,3,0),t(296712,7,3,0),f(296805,6,2),
// </six-eternel-remix-v3-master-notes>
])(mhTap,mhHoldV2,mhFlick,mhSlideV2);
const sixEternelRemixCharts=Object.freeze({
  EASY:mhChart(1,sixEternelRemixEasyNotes,SIX_ETERNEL_REMIX_DURATION_MS),
  NORMAL:mhChart(3,sixEternelRemixNormalNotes,SIX_ETERNEL_REMIX_DURATION_MS),
  HARD:mhChart(5,sixEternelRemixHardNotes,SIX_ETERNEL_REMIX_DURATION_MS),
  EXPERT:mhChart(7,sixEternelRemixExpertNotes,SIX_ETERNEL_REMIX_DURATION_MS),
  MASTER:mhChart(9,sixEternelRemixMasterNotes,SIX_ETERNEL_REMIX_DURATION_MS),
});

// Stay With Me ～Locked Fate～（全尺4分34秒）。2026-09-05、ユーザー指示で
// 「4分半ぐらいならフル曲にしよう」となったため、切り出し版から全尺へ戻した。
const PANDORA_BOSS_DURATION_MS=274400;
const pandoraBossEasyNotes=((t,h,f,s)=>[
// <pandora-boss-v3-easy-notes>
  t(1852,0,3,0),t(1852,7,3,0),t(3970,0,4,0),t(4323,0,4,0),
  t(5381,3,4,0),t(5734,5,4,0),t(6440,0,10,0),t(8382,1,4,0),
  t(9264,2,6,0),t(9617,5,4,0),t(9970,4,6,0),t(10676,4,6,0),
  t(11029,3,4,0),t(12088,4,6,0),t(12441,6,4,0),t(13853,3,4,0),
  t(14206,1,4,0),t(14911,2,6,0),t(15794,1,4,0),t(16323,0,6,0),
  t(17735,3,4,0),t(18441,1,4,0),h(19147,4,3,19941,0,[[19147,4,3],[19588,3,4],[19941,2,6]]),t(21265,4,6,0),
  t(22500,4,6,0),t(23383,4,6,0),t(24441,6,4,0),t(26206,4,6,0),
  t(26912,2,6,0),t(27265,1,3,0),t(27618,0,6,0),t(28677,1,4,0),
  t(30442,0,3,0),t(30442,7,3,0),t(31324,0,6,0),t(31854,2,6,0),
  t(32560,5,4,0),t(33265,4,6,0),t(34677,0,10,0),t(35383,5,4,0),
  t(35736,3,4,0),t(36089,4,6,0),t(37501,4,6,0),t(39619,4,6,0),
  t(39795,4,6,0),t(40325,4,6,0),t(40854,5,4,0),t(42442,4,6,0),
  t(43325,5,3,0),h(43854,4,6,44825),t(45443,2,6,0),t(46149,5,4,0),
  t(46502,6,4,0),t(48090,5,4,0),t(49325,3,4,0),t(49678,4,6,0),
  t(49855,3,4,0),t(50208,5,3,0),t(51796,6,4,0),t(52502,6,4,0),
  t(52678,4,6,0),t(54620,6,4,0),t(54796,5,4,0),t(55326,3,4,0),
  t(55679,1,4,0),t(57620,0,3,0),t(57620,7,3,0),t(58149,1,4,0),
  t(59032,0,10,0),t(59208,1,4,0),t(60444,0,4,1),t(60973,1,4,0),
  t(61149,3,4,0),t(61855,1,4,0),t(63267,0,3,0),t(63444,0,6,0),
  t(63797,3,4,0),t(64679,1,4,0),h(65032,0,4,65914),t(66444,1,4,0),
  t(67503,2,6,0),t(67856,0,6,0),t(68209,0,4,0),h(68562,1,4,69444),
  t(69621,3,4,0),t(70150,1,4,0),t(70679,0,4,0),t(74033,0,6,0),
  t(75444,0,6,0),h(75974,0,6,77209,0,[[75974,0,6],[76327,0,6],[76592,0,4],[76945,0,4],[77209,1,3]]),t(78092,1,4,0),t(78268,2,6,0),
  t(79503,1,4,0),t(79680,2,6,0),t(80386,0,10,0),t(81092,6,4,0),
  t(81621,3,4,0),t(81974,7,3,0),t(81974,0,3,0),t(82504,6,4,0),
  t(83210,5,4,0),t(83916,6,4,0),t(84445,6,4,0),t(85327,5,4,0),
  t(85504,5,4,0),t(87269,6,4,0),t(89033,4,6,0),t(90445,3,4,0),
  t(91151,4,6,0),t(91857,4,6,0),h(93269,5,4,94063),t(94681,4,6,0),
  t(96093,4,6,0),t(96799,5,4,0),t(97505,4,6,0),t(98210,4,6,0),
  t(99622,0,6,0),t(100328,2,6,0),t(101034,5,4,0),t(101387,6,4,0),
  t(101740,4,6,0),t(102446,2,6,0),h(103328,1,4,104387),t(104740,0,4,0),
  t(105270,1,4,0),t(105976,3,4,0),t(106329,5,4,2),t(107564,4,6,0),
  h(108093,6,3,108976,0,[[108093,6,3],[108358,5,4],[108711,5,4],[108976,6,3]]),t(109682,4,6,0),t(110564,0,3,0),t(110564,7,3,0),
  t(111094,0,10,0),t(112329,6,4,0),t(112505,4,6,0),t(113741,5,4,0),
  t(114623,3,4,0),t(115329,4,6,0),t(115506,7,3,0),h(116741,4,6,117535),
  t(117623,4,6,0),t(118682,5,4,0),h(119035,4,6,119829),t(120447,2,6,0),
  t(121153,5,4,0),t(122918,6,4,0),t(123624,6,4,0),t(124683,2,6,0),
  t(125389,5,4,0),t(126094,4,6,0),t(127506,5,4,0),h(129271,3,3,130683),
  t(131389,1,4,0),t(132448,0,4,0),t(133154,1,4,0),t(133683,3,4,0),
  t(134036,4,6,0),t(134389,3,4,0),t(134742,1,4,0),t(135448,0,6,0),
  t(136860,1,4,0),h(138272,0,6,139684),t(139860,0,10,0),t(140566,0,3,0),
  t(140566,7,3,0),h(141095,0,6,142507,0,[[141095,0,6],[141448,1,4],[141801,2,3],[142154,1,4],[142507,0,6]]),t(143213,3,4,0),t(143919,0,6,0),
  t(144448,0,4,0),t(145507,1,4,0),t(146037,3,4,0),t(148155,0,6,0),
  t(148684,3,3,0),h(149037,0,6,150449),t(151155,3,4,0),t(151508,1,4,0),
  t(151861,0,4,0),t(152214,1,4,0),t(152920,3,4,0),t(153802,1,4,0),
  t(153978,2,6,0),t(154684,4,6,0),t(154861,6,4,0),t(155390,5,4,0),
  t(155743,6,4,0),t(156449,5,3,0),t(157155,4,6,0),t(157332,5,3,0),
  t(159096,0,10,0),t(159626,7,3,0),t(159626,0,3,0),t(160155,5,4,0),
  t(160508,3,4,0),t(161214,1,4,0),t(161391,0,4,0),t(162273,1,4,0),
  t(163332,0,4,0),h(163685,1,3,165097),t(165450,0,4,0),t(165979,0,6,3),
  t(166862,0,4,0),t(167391,0,6,0),t(167568,0,6,0),t(169156,1,3,0),
  t(169509,3,3,0),h(169685,6,3,170921,0,[[169685,6,3],[170038,4,6],[170303,6,3],[170656,4,6],[170921,6,3]]),t(171627,4,6,0),t(172509,5,4,0),
  t(173921,6,4,0),t(176215,4,6,0),h(176921,6,4,177715),t(179039,4,6,0),
  t(179745,4,6,0),t(181157,5,4,0),t(183098,6,4,0),t(183274,4,6,0),
  t(184686,2,6,0),t(185392,4,6,0),t(185745,6,4,0),h(186274,4,6,187069),
  t(187686,7,3,0),t(189098,4,6,0),t(189275,7,3,0),t(190334,0,10,0),
  t(191039,5,4,0),t(192098,2,6,0),t(192275,5,4,0),t(192804,7,3,0),
  t(192804,0,3,0),t(194040,4,6,0),t(194216,6,4,0),t(195981,5,4,0),
  t(196334,6,4,0),t(197569,5,4,0),h(197746,4,6,199158),t(199687,2,6,0),
  t(200569,3,4,0),t(201099,0,6,0),t(201628,0,4,0),t(203393,0,6,0),
  t(203570,0,6,0),t(204099,3,4,0),t(204805,5,4,0),t(205511,4,6,0),
  h(207629,6,3,208511,0,[[207629,6,3],[207893,5,4],[208246,5,4],[208511,4,6]]),t(209041,2,6,0),t(209570,5,4,0),t(210452,3,4,0),
  t(210805,3,4,0),t(211864,4,6,0),t(212394,5,4,0),t(212747,3,4,0),
  t(212923,1,4,0),t(213276,0,4,0),t(214335,1,4,0),t(214688,0,10,0),
  t(214864,4,6,0),t(215394,7,3,0),t(215394,0,3,0),t(216276,5,4,0),
  t(217159,3,4,0),t(217512,5,4,4),h(218218,3,4,219629),t(219806,1,3,0),
  t(220512,0,6,0),t(221218,0,6,0),t(221394,0,4,0),h(221924,0,6,223336),
  t(223865,1,4,0),t(224571,2,6,0),t(224747,4,6,0),t(225453,4,6,0),
  t(225806,5,4,0),t(226336,4,6,0),h(228100,5,4,229512),t(231101,6,4,0),
  t(231454,6,4,0),t(233395,6,4,0),t(233571,6,4,0),t(234807,5,3,0),
  t(235160,5,4,0),t(236219,3,4,0),h(237983,0,6,238954,0,[[237983,0,6],[238336,1,4],[238601,1,4],[238954,2,3]]),t(239042,0,4,0),
  t(240101,1,4,0),t(240454,3,4,0),t(241866,0,10,0),t(243631,0,4,0),
  t(243807,1,4,0),t(244337,3,4,0),t(244690,7,3,0),t(244690,0,3,0),
  t(245749,3,4,0),t(246102,5,4,0),t(246807,4,6,0),t(247513,4,6,0),
  t(248396,4,6,0),t(248925,5,4,0),t(249455,3,4,0),t(249631,1,4,0),
  t(250337,2,6,0),t(251043,0,6,0),t(251749,3,4,0),t(253161,1,4,0),
  t(254220,0,4,0),t(254573,1,4,0),t(255102,3,4,0),t(256867,0,6,0),
  t(257573,0,6,0),t(258279,2,6,0),t(258985,5,4,0),t(259691,2,6,0),
  t(260220,1,4,0),t(261632,0,4,0),t(262514,0,6,0),t(263926,0,10,0),
  t(264456,1,4,0),h(265162,1,3,266573,0,[[265162,1,3],[265514,0,4],[265867,0,6],[266220,0,4],[266573,1,3]]),t(266750,1,4,0),t(267985,0,4,0),
  t(270456,1,4,0),t(270809,3,4,0),t(271515,0,3,0),t(271515,7,3,0),
// </pandora-boss-v3-easy-notes>
])(mhTap,mhHoldV2,mhFlick,mhSlideV2);
const pandoraBossNormalNotes=((t,h,f,s)=>[
// <pandora-boss-v3-normal-notes>
  f(1852,1,4),t(2558,7,3,0),t(2558,0,3,0),t(3970,3,4,0),
  t(4323,5,3,0),t(5381,6,4,0),t(5734,6,4,0),t(6440,0,10,0),
  t(6970,6,4,0),t(8382,5,4,0),t(9264,2,6,0),t(9617,5,3,0),
  t(9970,4,6,0),t(10676,4,6,0),t(11029,3,4,0),t(12088,0,6,0),
  t(12441,3,4,0),f(13147,1,4),t(13853,5,4,0),t(14206,3,4,0),
  t(14911,4,6,0),t(15794,3,4,0),t(16323,4,6,0),t(17735,5,4,0),
  t(18441,3,3,0),h(19147,2,2,19941,1,[[19147,2,2],[19588,1,4],[19941,0,6]]),h(20559,0,2,21794),t(22500,0,6,0),
  t(23383,0,6,0),t(24441,0,3,0),t(24441,7,3,0),t(24971,3,3,0),
  t(26206,0,6,0),f(26912,2,6),t(27265,6,2,0),t(27618,4,6,0),
  t(28677,3,3,0),h(29030,6,4,30177),t(30442,5,3,0),t(31324,2,6,0),
  t(31854,4,6,0),t(32560,7,3,0),t(32913,5,4,0),t(33265,2,6,0),
  t(34677,0,10,0),t(35383,3,3,0),t(35736,1,4,0),t(36089,0,6,0),
  t(37325,0,4,0),f(37501,2,6),t(39619,4,6,0),t(39795,4,6,0),
  t(40325,2,6,0),t(40854,6,4,0),h(41737,4,6,42972),t(43325,8,2,0),
  h(43854,4,6,44825),t(45443,4,6,0),t(46149,6,4,0),h(47031,5,3,47649),
  t(48090,0,3,0),t(48090,7,3,0),t(49325,1,4,0),t(49678,4,6,0),
  f(49855,3,4),t(50208,8,2,1),t(51796,3,3,0),t(52502,6,4,0),
  t(52678,4,6,0),h(53384,4,6,54443,0,[[53384,4,6],[53737,5,4],[54090,5,3],[54443,6,2]]),t(54620,6,4,0),t(54796,3,4,0),
  t(55326,5,3,0),t(55679,1,3,0),t(57443,0,3,0),t(57620,1,3,0),
  t(58149,3,4,0),t(59032,0,6,0),t(59208,3,4,0),h(60091,1,4,61502),
  f(61855,0,4),t(63267,6,2,0),t(63444,0,10,0),t(63797,1,4,0),
  t(64150,0,2,0),t(64679,1,3,0),h(65032,0,3,65914,1),t(66444,0,3,0),
  t(66444,7,3,0),t(66797,4,2,0),t(67503,4,6,0),t(67856,4,6,0),
  t(68209,5,3,0),h(68562,3,4,69444),t(69621,1,3,0),f(70150,3,4),
  t(70679,5,4,0),t(74033,4,6,0),t(75444,2,6,0),h(75974,7,2,77209,0,[[75974,7,2],[76327,6,4],[76592,4,6],[76945,6,4],[77209,7,2]]),
  t(77386,5,4,0),t(78092,6,4,0),t(78268,4,6,0),t(78974,4,6,0),
  t(79503,1,4,0),t(79680,4,6,0),t(80386,2,6,0),t(81092,6,4,0),
  t(81621,5,4,0),t(81974,3,4,0),f(82504,5,4),t(83210,3,4,0),
  t(83916,5,4,0),t(84445,1,4,0),t(85327,3,4,0),t(85504,0,4,0),
  t(86916,0,3,0),t(86916,7,3,0),t(87269,1,4,0),t(89033,0,10,0),
  t(89739,1,3,0),t(90445,0,3,0),t(91151,0,6,0),t(91857,2,6,0),
  h(93269,1,4,94063),t(94681,0,6,0),f(95387,1,4),t(96093,2,6,0),
  t(96799,5,4,0),t(97505,2,6,0),t(98210,0,6,0),t(98916,0,6,0),
  t(100328,0,6,0),t(100681,3,4,0),t(101034,5,4,0),t(101387,6,4,0),
  t(101740,4,6,0),t(102270,6,4,0),t(102446,4,6,0),h(103328,4,6,104387,0,[[103328,4,6],[103681,7,3],[104034,7,3],[104387,4,6]]),
  t(104740,1,3,0),f(105270,5,4),t(105976,3,4,0),t(106329,6,4,0),
  t(106682,7,3,0),t(106682,0,3,0),t(107564,2,6,0),h(108093,4,6,108976),
  t(109682,4,6,0),t(110564,7,3,2),t(111094,4,6,0),t(111623,5,4,0),
  t(112329,3,4,0),t(112505,0,10,0),t(112682,0,3,0),t(113564,1,4,0),
  t(113741,3,3,0),f(114623,1,3),t(115329,2,6,0),t(115506,0,2,0),
  h(116741,0,6,117535),t(117623,0,6,0),t(118153,0,6,0),t(118682,1,4,0),
  t(119035,0,6,0),t(119212,2,6,0),t(120447,0,6,0),t(120624,5,3,0),
  t(121153,6,4,0),t(122918,3,4,0),t(123271,5,3,0),t(123624,3,4,0),
  f(124683,0,6),t(125389,0,3,0),t(125389,7,3,0),t(126094,4,6,0),
  t(127506,7,3,0),h(129271,6,2,130683,1,[[129271,6,2],[129624,4,6],[129977,6,2],[130330,4,6],[130683,6,2]]),t(131389,6,4,0),t(132271,5,4,0),
  t(132448,5,3,0),t(133154,5,4,0),t(133683,5,4,0),t(134036,4,6,0),
  t(134389,3,3,0),t(134742,5,4,0),t(135448,0,6,0),t(136860,3,3,0),
  f(137566,5,3),h(138272,0,6,139684),t(139860,0,10,0),t(140566,6,2,0),
  h(141095,3,3,142507),t(143213,1,3,0),t(143919,2,6,0),t(144448,5,4,0),
  t(145507,7,3,0),t(146037,7,3,0),t(146390,6,4,0),t(148155,4,6,0),
  t(148684,8,2,0),h(149037,4,6,150449),t(151155,7,3,0),t(151155,0,3,0),
  t(151508,5,3,0),f(151861,3,3),t(152214,1,4,0),t(152920,0,4,0),
  t(153802,1,4,0),t(153978,2,6,0),t(154684,4,6,0),t(154861,6,4,0),
  t(155390,5,4,0),t(155743,5,4,0),t(156449,8,2,0),t(156626,6,4,0),
  t(157155,4,6,0),t(157332,8,2,0),t(157508,4,6,0),t(159096,0,10,0),
  f(159626,6,4),t(160155,1,3,0),t(160508,5,3,0),t(161214,3,3,0),
  t(161391,7,3,0),t(161391,0,3,0),t(161567,5,3,0),t(162273,3,4,0),
  t(163332,0,3,0),h(163685,0,2,165097,0,[[163685,0,2],[164038,0,3],[164391,0,4],[164744,0,4],[165097,0,6]]),t(165450,1,3,0),t(165979,4,6,3),
  t(166862,3,3,0),t(167391,4,6,0),f(167568,2,6),t(169156,0,2,0),
  t(169509,2,2,0),h(169685,0,6,170921,1),t(171627,0,6,0),t(172509,0,3,0),
  t(173921,1,3,0),t(176039,0,6,0),t(176215,0,6,0),t(176921,1,3,0),
  t(177627,4,6,0),t(179039,0,6,0),t(179745,2,6,0),t(180451,4,6,0),
  t(181157,7,3,0),t(183098,5,3,0),t(183274,4,6,0),f(183980,5,3),
  t(184686,4,6,0),t(185392,2,6,0),t(185745,7,3,0),h(186274,4,6,187069,0,[[186274,4,6],[186716,5,4],[187069,6,2]]),
  t(187686,8,2,0),t(188922,4,2,0),t(189098,0,6,0),t(189275,0,2,0),
  t(190334,0,10,0),t(191039,0,3,0),t(191039,7,3,0),t(192098,0,6,0),
  t(192275,5,4,0),t(192451,2,6,0),f(192804,6,4),t(194040,4,6,0),
  t(194216,5,3,0),t(195099,6,4,0),t(195981,3,3,0),t(196334,6,4,0),
  t(197569,5,4,0),h(197746,4,6,199158),t(199687,2,6,0),t(200216,8,2,0),
  t(200393,0,6,0),t(200569,5,3,0),t(201099,2,6,0),t(201628,6,4,0),
  t(203393,4,6,0),t(203570,4,6,0),f(204099,3,3),t(204805,1,4,0),
  t(205511,0,6,0),h(207629,2,2,208511,0,[[207629,2,2],[207893,1,4],[208246,1,4],[208511,2,2]]),t(209041,0,6,0),t(209570,0,4,0),
  t(210452,0,3,0),t(210452,7,3,0),t(210805,3,3,0),t(211158,6,2,0),
  t(211864,4,6,0),t(212394,5,4,0),t(212747,7,3,0),t(212923,5,4,0),
  t(213276,6,4,0),f(214335,1,3),t(214688,0,10,0),t(214864,2,6,0),
  t(215394,7,3,0),t(215923,5,3,0),t(216276,5,3,0),t(217159,3,3,0),
  t(217512,1,3,4),h(218218,0,3,219629),t(219806,0,2,0),t(220512,0,6,0),
  t(221218,2,6,0),t(221394,1,4,0),h(221924,2,6,223336),t(223865,1,4,0),
  t(224571,4,6,0),f(224747,2,6),t(225453,4,6,0),t(225806,3,3,0),
  t(226336,4,6,0),t(227571,5,3,0),h(228100,5,4,229512,1),t(231101,7,3,0),
  t(232865,4,6,0),t(233395,7,3,0),t(233395,0,3,0),t(233571,5,4,0),
  t(234807,4,2,0),t(235160,5,3,0),t(236219,1,3,0),t(236925,0,3,0),
  h(237983,0,6,238954,0,[[237983,0,6],[238336,2,3],[238601,2,3],[238954,0,6]]),f(239042,0,4),t(240101,0,4,0),t(240454,3,4,0),
  t(241337,0,2,0),t(241866,0,10,0),t(243631,0,4,0),t(243807,3,4,0),
  t(244337,1,4,0),t(244513,5,4,0),t(244690,3,4,0),t(245749,0,4,0),
  t(246102,1,3,0),t(246807,2,6,0),t(247160,1,4,0),t(247513,0,6,0),
  f(248396,0,6),t(248925,0,3,0),t(248925,7,3,0),t(249455,0,4,0),
  t(249631,1,3,0),t(250337,0,6,0),t(251043,2,6,0),t(251220,0,6,0),
  t(251749,3,3,0),t(252631,0,6,0),t(253161,0,4,0),t(254573,0,4,0),
  t(255102,1,4,0),t(255455,0,6,0),t(256867,0,6,0),t(257573,2,6,0),
  f(258279,4,6),t(259691,2,6,0),t(260220,6,4,0),t(260926,5,4,0),
  t(261632,6,4,0),t(262514,4,6,0),t(263220,7,3,0),t(263926,0,10,0),
  t(264456,1,4,0),h(265162,1,2,266573,0,[[265162,1,2],[265514,0,6],[265867,1,2],[266220,0,6],[266573,1,2]]),t(266750,1,3,0),t(267985,0,4,0),
  t(269044,1,4,0),t(270456,0,4,0),t(270809,0,3,0),t(270809,7,3,0),
  f(271515,3,4),
// </pandora-boss-v3-normal-notes>
])(mhTap,mhHoldV2,mhFlick,mhSlideV2);
const pandoraBossHardNotes=((t,h,f,s)=>[
// <pandora-boss-v3-hard-notes>
  f(1852,0,4),t(2558,0,4,0),t(2558,7,3,0),t(3087,7,3,0),
  t(3970,3,4,0),t(4146,5,4,0),t(4323,7,3,0),t(4587,5,4,0),
  t(4676,3,4,0),t(5381,1,4,0),t(5734,0,4,0),t(6440,0,8,0),
  t(6970,3,4,0),t(8382,1,4,0),t(9264,2,5,0),t(9617,5,3,0),
  t(9970,5,5,0),f(10146,5,4),t(10676,2,5,0),t(11029,1,4,0),
  t(11117,0,5,0),t(11382,2,1,0),t(11823,0,5,0),t(12088,2,5,0),
  t(12441,1,4,0),t(13147,5,4,0),t(13323,3,4,0),t(13764,1,4,0),
  t(13853,3,4,0),t(14206,5,4,0),t(14911,5,5,0),t(15794,0,4,0),
  t(15794,7,3,0),t(16323,2,5,0),f(16853,5,5),t(17294,3,3,0),
  t(17735,6,4,0),t(18265,5,3,0),t(18441,7,3,0),t(20118,2,5,0),
  t(20206,5,3,0),s(20559,21794,[[20559,3,3],[20735,2.5,3],[20912,3,3],[21088,3,3],[21265,3.5,3],[21441,3,3],[21618,2.5,3],[21794,1.5,3]],1),t(22412,2,5,0),t(22500,3,5,0),
  t(23383,4,5,0),t(24088,5,3,0),t(24441,3,4,0),t(24530,4,5,0),
  t(24794,7,3,0),f(24971,5,3),t(26206,5,5,0),t(26912,5,5,0),
  t(27265,8,1,0),t(27618,2,8,0),t(27971,6,4,0),t(28324,7,3,0),
  t(28677,7,3,0),t(29030,6,4,0),t(29736,7,3,0),t(30883,4,5,0),
  t(31059,4,5,0),t(31324,5,5,0),t(31854,5,5,0),t(32560,1,3,0),
  t(32560,7,3,0),t(32824,2,5,0),f(32913,5,4),t(33265,5,5,0),
  t(33530,4,5,0),t(33971,7,3,0),t(34677,2,5,0),h(35119,7,1,35913,0,[[35119,7,1],[35560,6,3],[35913,5,5]]),
  t(36089,0,5,0),t(36530,4,5,0),h(36795,3,4,37589),t(38119,0,5,0),
  t(38472,0,5,0),t(39354,0,5,0),t(39619,0,5,0),t(39795,0,5,0),
  s(40060,41472,[[40060,2,3],[40325,1,3],[40589,1,3],[40854,1,3],[41119,1,3],[41384,0,3],[41472,0,3]]),s(41737,42972,[[41737,0,3],[42001,1.5,3],[42266,3,3],[42531,4,3],[42795,4,3],[42972,4,3]]),t(43325,6,1,0),t(43413,4,1,0),
  f(43854,0,5),t(44560,0,4,0),t(44737,0,5,0),t(45443,0,5,0),
  t(46060,0,4,0),t(46149,1,4,0),t(46502,3,3,0),t(47031,1,3,0),
  t(47031,7,3,0),h(47825,0,5,48355),f(48531,0,5),t(49325,5,4,0),
  t(49413,0,8,0),t(49678,0,5,0),t(49855,0,4,0),t(50031,3,4,0),
  t(50208,6,1,0),t(50384,1,3,0),t(51796,0,3,0),t(52502,3,4,0),
  t(52678,4,5,0),s(53031,54443,[[53031,3,3],[53296,3,3],[53561,1.5,3],[53826,2.5,3],[54090,2.5,3],[54355,2.5,3],[54443,3,3]]),t(54620,6,4,0),t(54796,5,4,0),
  t(55326,3,3,0),t(55679,1,3,0),t(57443,3,3,0),t(57620,5,3,0),
  f(58149,1,4),t(59032,0,5,0),t(59120,1,4,0),s(60091,61502,[[60091,0,3],[60355,0.5,3],[60620,1.5,3],[60885,2.5,3],[61149,3.5,3],[61414,4,3],[61502,4,3]]),
  t(61855,1,4,1),t(62385,1,4,0),s(62826,64061,[[62826,1,3],[63003,1,3],[63179,1,3],[63355,1,3],[63532,0,3],[63708,0,3],[63885,0,3],[64061,0,3]]),t(64150,0,1,0),
  t(64679,3,3,0),t(65032,0,3,0),t(65032,6,3,0),t(65650,2,5,0),
  h(66444,5,3,66885,1),h(67503,5,5,68032,0,[[67503,5,5],[67768,6,3],[68032,7,1]]),t(68209,5,3,0),h(68562,6,4,69444),
  t(69621,5,3,0),h(69885,5,3,70415),f(70679,3,4),h(71121,8,1,72532),
  h(73062,6,1,73944),t(74033,3,5,0),t(75444,0,8,0),h(75974,3,4,77209),
  t(77386,1,4,0),t(77562,3,4,0),t(78092,5,4,0),t(78268,5,5,0),
  t(78533,4,5,0),t(78974,2,5,0),t(79503,1,4,0),t(79680,2,5,0),
  f(80386,0,5),t(81092,0,4,0),t(81621,1,4,0),t(81798,3,4,0),
  t(81974,1,4,0),t(82504,3,4,0),t(83210,5,4,0),h(83474,8,1,84092,1,[[83474,8,1],[83827,5,5],[84092,8,1]]),
  t(84445,6,4,0),t(84445,0,3,0),t(85327,0,4,0),t(85504,3,4,0),
  t(86033,1,3,0),t(86386,5,4,0),t(86916,3,3,0),t(87269,6,4,0),
  t(89033,4,5,0),f(89739,1,3),t(90445,3,3,0),t(90710,0,3,0),
  t(91151,0,5,0),t(91857,0,5,0),t(92563,3,4,0),t(92828,0,5,0),
  t(93269,3,4,0),t(93710,4,5,0),t(93975,7,3,0),t(94681,4,5,0),
  t(95387,3,4,0),t(95916,1,4,0),t(96093,0,5,0),t(96534,2,5,0),
  f(96799,3,4),t(97505,2,8,0),t(98210,4,5,0),t(98563,0,4,0),
  t(98563,7,3,0),t(98916,4,5,0),t(99181,2,5,0),t(99622,0,5,0),
  t(100328,2,5,0),t(100681,5,4,0),t(101034,3,4,0),t(101211,5,5,0),
  t(101387,3,4,0),t(101740,5,5,0),t(101917,3,4,0),t(102270,6,4,0),
  f(102446,2,5),t(103328,1,3,0),t(104034,2,5,0),h(104740,5,3,105270),
  t(105711,2,5,0),t(105976,5,4,0),h(106064,3,5,106682,1,[[106064,3,5],[106417,5,1],[106682,3,5]]),t(107123,0,5,0),
  t(107564,2,5,0),t(107829,0,5,0),t(107917,0,4,0),t(108093,0,5,0),
  t(108799,5,3,2),t(109682,5,5,0),t(109858,3,4,0),h(110564,5,3,110917),
  f(111094,0,5),t(111535,0,5,0),t(111623,1,4,0),h(112329,3,4,112770),
  t(113035,0,4,0),t(113035,7,3,0),t(113211,3,3,0),t(113476,0,5,0),
  t(113741,1,3,0),t(114358,2,8,0),t(114623,3,3,0),t(115329,5,5,0),
  t(115506,6,1,0),t(115770,0,5,0),t(116476,2,5,0),t(116741,0,5,0),
  t(117182,2,5,0),f(117270,1,4),h(117623,0,5,118418),t(118682,0,4,0),
  t(119035,2,5,0),t(119212,0,5,0),t(119741,3,3,0),t(120271,0,4,0),
  t(120447,2,5,0),t(120624,0,3,0),h(121153,3,4,121594),t(122830,4,5,0),
  t(122918,6,4,0),t(123271,5,3,0),t(123624,6,4,0),t(124153,5,4,0),
  f(124683,4,5),t(125124,5,5,0),t(125389,7,3,0),t(125389,1,3,0),
  t(126094,4,5,0),t(126536,4,5,0),t(126712,5,4,0),t(127418,6,1,0),
  t(127506,3,3,0),t(127859,6,4,0),t(129271,8,1,0),s(129359,130771,[[129359,3,3],[129624,3,3],[129889,1,3],[130154,1,3],[130418,1,3],[130683,2,3],[130771,2,3]]),
  t(130859,3,4,0),t(131389,6,4,0),t(132183,2,5,0),t(132271,5,4,0),
  f(132448,3,3),t(133154,1,4,0),t(133330,0,4,0),t(133595,1,8,0),
  t(133683,1,4,0),t(134036,4,5,0),t(134389,3,3,0),t(134742,1,4,0),
  t(135448,0,5,0),t(136860,1,3,0),t(137566,3,3,0),t(137830,4,5,0),
  s(138272,139684,[[138272,3,3],[138536,2,3],[138801,1,3],[139066,1,3],[139331,1,3],[139595,1,3],[139684,1,3]]),t(139860,4,5,0),f(140125,6,4),t(140478,6,1,0),
  t(140566,3,1,0),h(141095,5,3,142507,1),t(143213,1,3,0),t(143213,7,3,0),
  t(143919,4,5,0),t(144184,3,3,0),t(144448,6,4,0),s(144713,146125,[[144713,3,3],[144978,3,3],[145243,2,3],[145507,3,3],[145772,3,3],[146037,3,3],[146125,3,3]]),
  t(146390,6,4,0),t(147096,7,3,0),t(148155,2,5,0),t(148684,6,1,0),
  s(149037,150449,[[149037,3,3],[149302,3,3],[149566,4,3],[149831,4,3],[150096,4,3],[150361,4,3],[150449,4,3]]),t(151155,5,3,0),t(151508,3,3,0),h(151861,6,1,152390,0,[[151861,6,1],[152125,5,3],[152390,4,5]]),
  f(152920,3,4),s(153449,154861,[[153449,0.5,3],[153714,1,3],[153978,2,3],[154243,2,3],[154508,2,3],[154773,3,3],[154861,3.5,3]]),t(155390,0,4,0),t(155743,0,4,0),
  h(156449,0,1,157067),t(157155,2,5,0),t(157243,1,3,0),t(157508,4,5,0),
  t(159096,1,8,0),t(159361,5,4,0),t(159626,6,4,0),h(160067,4,5,160597),
  t(161214,0,3,0),t(161214,6,3,0),t(161391,1,4,0),t(161479,3,3,0),
  t(162185,4,5,0),f(162273,6,4),t(163332,5,3,0),s(163685,165097,[[163685,3,3],[163950,1,3],[164214,2,3],[164479,2,3],[164744,2.5,3],[165009,3,3],[165097,3,3]],1),
  t(165450,3,3,0),t(165979,4,5,3),t(166420,7,3,0),t(166509,6,1,0),
  t(166862,3,3,0),t(167038,1,4,0),t(167391,0,5,0),t(167568,0,5,0),
  t(168273,3,3,0),t(169156,0,1,0),t(169509,5,1,0),s(169597,170921,[[169597,1.5,3],[169862,1,3],[170126,1,3],[170391,0.5,3],[170656,0.5,3],[170921,0.5,3]]),
  f(171627,0,5),t(172244,2,5,0),h(172509,0,5,173127,0,[[172509,0,5],[172862,0,3],[173127,1,1]]),t(173303,5,5,0),
  t(173833,2,5,0),t(174362,0,3,0),t(176039,0,5,0),t(176215,0,5,0),
  t(176921,0,3,0),t(177186,0,5,0),t(177627,2,5,0),t(177892,1,3,0),
  t(177892,7,3,0),t(178862,4,5,0),t(179039,0,5,0),f(179745,2,5),
  t(180098,0,1,0),t(180451,0,5,0),t(181157,5,3,0),t(181862,0,8,0),
  t(182568,5,3,0),t(183098,3,3,0),t(183274,4,5,0),t(183980,7,3,0),
  t(184421,5,5,0),t(184686,5,5,0),t(185039,3,3,0),h(185392,5,5,186098),
  t(186274,4,5,0),t(186539,0,5,0),t(186804,3,3,0),f(186980,0,4),
  t(187686,2,1,0),t(187775,6,1,0),t(188481,3,4,0),t(188922,8,1,0),
  t(189098,4,5,0),t(189275,8,1,0),h(189628,1,3,190157),t(190334,4,5,0),
  t(191039,1,3,0),t(191039,7,3,0),h(191481,7,3,192010),t(192098,4,5,0),
  t(192275,3,4,0),t(192363,0,5,0),t(192804,0,4,0),t(192893,0,3,0),
  f(193245,0,5),t(194040,0,5,0),t(194216,5,3,0),t(195099,6,4,0),
  h(195981,6,1,196599,1,[[195981,6,1],[196334,4,5],[196599,6,1]]),t(197569,3,4,0),s(197746,199158,[[197746,3,3],[198010,3,3],[198275,2.5,3],[198540,2,3],[198805,1.5,3],[199069,1.5,3],[199158,1,3]]),t(199511,4,1,0),
  t(199687,4,5,0),t(200216,8,1,0),t(200393,5,5,0),t(200569,3,3,0),
  t(201099,2,8,0),t(201628,1,4,0),t(203393,0,5,0),h(203570,2,5,204187),
  f(204805,5,4),t(205511,5,5,0),t(207187,5,5,0),h(207629,7,3,208511),
  t(209041,2,5,0),h(209129,5,5,210541,0,[[209129,5,5],[209482,7,3],[209835,8,1],[210188,7,3],[210541,5,5]]),t(210805,5,3,0),t(210894,2,5,0),
  t(211158,2,1,0),t(211864,0,5,4),t(212394,0,4,0),t(212394,7,3,0),
  t(212747,5,3,0),t(212923,3,4,0),t(213276,6,4,0),f(213453,6,4),
  t(214158,3,3,0),t(214335,0,3,0),t(214688,4,5,0),t(214864,0,5,0),
  t(215217,4,1,0),t(215394,0,3,0),t(215923,0,3,0),t(216276,0,3,0),
  t(216541,0,5,0),h(217159,0,3,217600,1),s(218218,219629,[[218218,1,3],[218482,1,3],[218747,1.5,3],[219012,1.5,3],[219276,2,3],[219541,3,3],[219629,3,3]]),t(219806,0,1,0),
  t(220512,2,5,0),f(220777,7,3),t(221218,4,5,0),t(221394,6,4,0),
  t(221659,4,1,0),s(221924,223336,[[221924,3,3],[222188,3,3],[222453,4,3],[222718,2.5,3],[222983,2.5,3],[223247,3,3],[223336,3,3]]),t(223865,0,4,0),t(223865,7,3,0),
  t(224394,6,1,0),t(224483,3,1,0),t(224747,2,8,0),t(225100,0,3,0),
  t(225453,0,5,0),t(225806,3,3,0),t(226336,4,5,0),t(226777,5,5,0),
  t(227571,5,3,0),s(228100,229512,[[228100,3,3],[228365,1,3],[228630,1.5,3],[228895,1,3],[229159,1.5,3],[229424,2,3],[229512,2,3]]),t(231101,3,3,0),f(231542,5,5),
  t(232865,0,5,0),t(233042,5,3,0),t(233395,3,3,0),t(234366,2,5,0),
  t(234807,2,1,0),t(235071,0,5,0),t(235160,1,3,0),t(235866,0,4,0),
  t(236219,3,3,0),h(236925,1,3,237542),t(237630,5,4,0),t(237983,0,4,0),
  t(238160,1,3,0),t(238866,2,5,0),f(239042,1,4),h(239748,1,1,240719,1,[[239748,1,1],[240101,0,4],[240366,0,4],[240719,1,1]]),
  t(241337,6,1,0),t(241513,2,1,0),t(241866,2,5,0),t(242572,0,1,0),
  t(243631,0,4,0),t(243719,0,5,0),t(244337,0,4,0),t(244337,7,3,0),
  t(244513,1,4,0),t(244690,0,4,0),t(245749,1,4,0),t(246102,3,3,0),
  t(246631,5,4,0),t(246807,2,8,0),f(247160,5,4),t(247513,2,5,0),
  t(247690,1,4,0),t(248219,0,1,0),t(248396,0,5,0),t(248925,5,3,0),
  t(249366,3,4,0),t(249455,4,4,0),t(249631,3,3,0),t(250337,4,5,0),
  t(251043,5,5,0),t(251220,4,5,0),t(251749,3,3,0),t(252278,5,4,0),
  t(252631,2,5,0),t(253161,1,4,0),f(254220,0,4),t(254573,0,4,0),
  t(254573,7,3,0),t(255014,0,5,0),t(255102,1,4,0),t(255455,0,5,0),
  t(256867,4,5,0),t(257573,0,5,0),t(258279,2,5,0),t(258720,0,5,0),
  t(259691,0,5,0),t(260132,0,5,0),t(260220,3,4,0),t(260926,1,4,0),
  t(261544,0,5,0),t(261632,1,4,0),f(261808,3,3),t(262514,4,5,0),
  t(262603,3,4,0),t(263220,1,3,0),h(263661,1,1,264367,0,[[263661,1,1],[264014,0,3],[264367,0,5]]),t(264456,1,4,0),
  t(264632,3,4,0),s(265162,266573,[[265162,1,3],[265426,1,3],[265691,2,3],[265956,2.5,3],[266220,3,3],[266485,2.5,3],[266573,2.5,3]]),t(266662,0,8,0),t(266750,1,3,0),
  t(267985,0,4,0),t(268515,0,4,0),t(269044,0,4,0),t(270103,0,4,0),
  t(270456,1,4,0),t(270809,0,4,0),t(270809,7,3,0),f(271515,1,4),
// </pandora-boss-v3-hard-notes>
])(mhTap,mhHoldV2,mhFlick,mhSlideV2);
const pandoraBossExpertNotes=((t,h,f,s)=>[
// <pandora-boss-v3-expert-notes>
  f(1852,0,4),t(2558,0,4,0),t(2558,7,3,0),t(3087,7,3,0),
  t(3970,0,2,0),t(3970,4,2,0),t(4146,2,2,0),t(4146,6,2,0),
  t(4323,4,2,0),t(4323,8,2,0),t(4587,5,4,0),t(4676,4,4,0),
  t(5381,1,4,0),t(5734,0,4,0),t(6440,0,8,0),t(6970,6,4,0),
  t(8382,5,4,0),t(9264,1,2,0),t(9264,5,2,0),t(9617,3,2,0),
  t(9617,7,2,0),t(9970,1,2,0),t(9970,5,2,0),f(10146,5,4),
  t(10676,2,5,0),t(11029,1,4,0),t(11117,0,5,0),t(11205,1,4,0),
  t(11382,6,1,0),t(11823,0,5,0),t(12088,2,5,0),t(12441,0,4,0),
  t(13147,1,4,0),t(13323,5,4,0),t(13764,1,4,0),t(13853,5,4,0),
  t(14206,0,4,0),t(14206,7,3,0),t(14911,5,5,0),f(15794,0,4),
  t(16323,2,5,0),t(16853,0,2,0),t(16853,4,2,0),t(17294,2,2,0),
  t(17294,6,2,0),t(17735,4,2,0),t(17735,8,2,0),t(18265,3,3,0),
  t(18441,7,3,0),t(19147,5,3,0),t(20118,2,5,0),s(20559,21794,[[20559,3,3],[20735,2.5,3],[20912,3,3],[21088,3,3],[21265,3,3],[21441,2.5,3],[21618,2,3],[21794,0.5,3]],1),
  t(21265,5,5,0),t(22412,4,5,0),t(22500,0,5,0),t(23118,2,5,0),
  t(23383,0,5,0),f(24088,1,3),t(24441,3,4,0),t(24530,0,5,0),
  t(24794,5,3,0),t(24971,7,3,0),t(26206,0,5,0),t(26912,4,5,0),
  t(27177,2,5,0),t(27265,8,1,0),t(27618,0,5,0),t(27971,5,4,0),
  t(28324,1,3,0),t(28324,7,3,0),t(28677,7,3,0),s(29030,30177,[[29030,1.5,3],[29206,1.5,3],[29383,1.5,3],[29559,0,3],[29736,2.5,3],[29912,2,3],[30089,2,3],[30177,2,3]]),
  f(29736,7,3),t(30883,2,8,0),t(31059,4,5,0),t(31324,4,5,0),
  t(31854,4,5,0),t(32295,0,5,0),t(32560,1,3,0),t(32824,2,5,0),
  t(32913,5,4,0),t(33265,5,5,0),t(33530,2,5,0),t(33971,7,3,0),
  t(34677,4,5,0),h(35119,7,1,35913,0,[[35119,7,1],[35560,6,3],[35913,5,5]]),t(36001,4,5,0),f(36089,3,5),
  t(36530,0,5,0),h(36795,0,4,37589),t(38119,0,5,0),t(38472,0,5,0),
  t(39354,0,5,0),t(39442,1,4,0),t(39619,2,5,0),t(39795,0,5,0),
  s(40060,41472,[[40060,2,3],[40325,1,3],[40589,1,3],[40854,0.5,3],[41119,0.5,3],[41384,0,3],[41472,0,3]]),t(40766,1,4,0),t(40854,2,4,0),s(41737,42972,[[41737,1.5,3],[41913,2,3],[42090,3,3],[42266,3,3],[42442,4,3],[42619,4,3],[42795,4,3],[42972,4,3]],1),
  t(42178,4,5,0),t(42266,3,5,0),f(42442,5,5),t(43325,6,1,0),
  t(43413,2,1,0),t(43854,0,5,0),t(44560,0,4,0),t(44560,7,3,0),
  t(44737,0,5,0),s(45090,46237,[[45090,3,3],[45266,2.5,3],[45443,2.5,3],[45619,3,3],[45796,4,3],[45972,4,3],[46149,4,3],[46237,4,3]]),t(45443,2,5,0),t(46502,1,3,0),
  t(47031,5,3,0),h(47825,2,5,48355),t(48531,4,5,0),t(49325,6,4,0),
  t(49413,4,5,0),t(49678,1,8,0),t(49855,1,2,0),t(49855,5,2,0),
  t(50031,3,2,0),t(50031,7,2,0),t(50208,1,2,0),t(50208,5,2,0),
  f(50384,1,3),t(51796,0,3,0),h(52502,3,5,53031,0,[[52502,3,5],[52767,4,3],[53031,5,1]]),s(53208,54443,[[53208,1.5,3],[53384,0,3],[53561,0,3],[53737,0.5,3],[53914,0.5,3],[54090,0.5,3],[54267,0.5,3],[54443,0.5,3]]),
  t(54620,6,4,0),t(54620,0,3,0),t(54796,1,4,0),t(55326,3,3,0),
  t(55679,0,3,0),t(57443,1,3,0),t(57620,3,3,0),t(58149,5,4,0),
  t(59032,2,5,0),t(59120,5,4,0),f(59208,3,4),s(60091,61502,[[60091,0,3],[60355,0.5,3],[60620,1.5,3],[60885,2.5,3],[61149,3.5,3],[61414,4,3],[61502,4,3]]),
  t(60444,5,3,0),t(60620,4,3,0),t(60973,6,4,0),t(61149,5,3,0),
  t(61855,6,4,1),t(62385,6,4,0),s(62826,64061,[[62826,3,3],[63003,3,3],[63179,2.5,3],[63355,2.5,3],[63532,0.5,3],[63708,1.5,3],[63885,1.5,3],[64061,1.5,3]]),t(63267,7,1,0),
  t(63444,1,5,0),t(64150,4,1,0),t(64679,0,3,0),t(65032,1,3,0),
  t(65561,0,3,0),f(65650,0,5),h(66444,0,3,66885,1),h(67503,0,5,68032),
  t(68209,6,3,0),t(68209,0,3,0),h(68562,0,4,69444),t(68915,0,4,0),
  t(69621,0,3,0),t(69797,3,1,0),h(69885,0,3,70415),t(70679,1,4,0),
  h(71121,8,1,72532),h(73062,6,1,73944),t(74033,5,5,0),t(75444,4,5,0),
  h(75974,5,4,77209),f(76327,6,4),t(76680,6,4,0),t(76856,2,8,0),
  t(77386,5,4,0),t(77562,3,4,0),t(78092,3,4,0),t(78268,0,5,0),
  t(78533,0,5,0),t(78974,0,5,0),t(79415,0,5,0),t(79503,1,4,0),
  t(79680,2,5,0),t(80386,4,5,0),f(81092,3,4),t(81621,0,2,0),
  t(81621,4,2,0),t(81798,2,2,0),t(81798,6,2,0),t(81974,4,2,0),
  t(81974,8,2,0),t(82504,6,4,0),t(82504,0,3,0),t(83210,3,4,0),
  h(83474,8,1,84092,1,[[83474,8,1],[83827,5,5],[84092,8,1]]),t(84445,5,4,0),t(85327,3,4,0),t(85504,5,4,0),
  t(86033,3,3,0),t(86386,1,4,0),t(86916,3,3,0),t(87269,5,4,0),
  t(89033,2,5,0),t(89739,3,3,0),f(90004,5,3),t(90445,5,3,0),
  t(90710,3,3,0),t(91151,1,2,0),t(91151,5,2,0),t(91857,3,2,0),
  t(91857,7,2,0),t(92563,1,2,0),t(92563,5,2,0),t(92828,0,5,0),
  t(92916,3,4,0),t(93269,5,4,0),t(93975,7,3,0),t(94681,4,5,0),
  t(95387,1,4,0),t(95916,0,4,0),t(95916,7,3,0),t(96093,0,5,0),
  t(96534,0,5,0),t(96622,1,4,0),f(96799,0,4),t(97505,0,5,0),
  t(98210,0,5,0),t(98563,0,4,0),t(98916,0,8,0),t(99181,0,5,0),
  t(99358,0,5,0),t(99622,0,5,0),t(100328,0,2,0),t(100328,4,2,0),
  t(100681,2,2,0),t(100681,6,2,0),t(101034,4,2,0),t(101034,8,2,0),
  t(101211,2,5,0),t(101387,1,4,0),t(101740,0,5,0),f(101917,0,4),
  t(102270,0,4,0),t(102446,0,5,0),s(103328,104387,[[103328,1.5,3],[103505,1.5,3],[103681,2.5,3],[103858,3.5,3],[104034,3.5,3],[104211,3.5,3],[104387,4,3]],1),t(104034,0,5,0),
  h(104740,0,5,105270,0,[[104740,0,5],[105005,1,1],[105270,0,5]]),t(105711,0,5,0),t(105976,3,4,0),h(106064,3,4,106682,1),
  t(107123,2,5,0),t(107564,4,5,0),t(107829,2,5,0),t(107917,1,4,0),
  t(108093,0,5,0),t(108535,1,3,0),t(108535,7,3,0),f(108799,0,3),
  t(109682,2,5,0),t(109858,1,4,0),t(110211,0,3,2),t(110564,1,3,0),
  t(110741,4,5,0),t(111094,2,5,0),t(111535,4,5,0),t(111623,6,4,0),
  h(112329,3,4,112770),t(113035,1,4,0),t(113211,3,3,0),t(113476,4,5,0),
  t(113564,3,4,0),f(113741,1,3),t(114358,0,5,0),t(114535,4,1,0),
  t(114623,1,3,0),t(115329,4,5,0),t(115506,8,1,0),t(115770,4,5,0),
  t(116476,1,8,0),t(116564,5,3,0),t(116741,0,5,0),t(117182,2,5,0),
  t(117270,5,4,0),h(117623,5,5,118418),t(118682,0,4,0),t(118682,7,3,0),
  t(119035,2,5,0),t(119212,4,5,0),f(119741,7,3),t(120271,5,4,0),
  t(120447,2,5,0),t(120624,1,3,0),h(121153,0,4,121594),s(121771,123183,[[121771,3,3],[122035,2.5,3],[122300,0.5,3],[122565,0.5,3],[122830,0.5,3],[123094,0.5,3],[123183,0.5,3]]),
  t(122830,5,5,0),t(123271,7,3,0),t(123624,6,4,0),t(124153,6,4,0),
  t(124683,0,5,0),t(125124,4,5,0),t(125389,3,3,0),t(126094,5,5,0),
  t(126536,0,5,0),f(126712,3,4),t(127418,6,1,0),t(127506,3,3,0),
  t(127859,1,4,0),h(128389,8,1,129006),t(129271,6,1,0),s(129359,130771,[[129359,2,3],[129624,2,3],[129889,0,3],[130154,0,3],[130418,0,3],[130683,1,3],[130771,1,3]]),
  t(129801,0,5,0),t(129977,0,4,0),t(130330,4,5,0),t(130859,1,4,0),
  t(131389,0,4,0),t(131389,7,3,0),t(131565,0,4,0),t(132183,0,5,0),
  t(132271,1,4,0),f(132448,0,3),t(133154,1,4,0),t(133330,0,4,0),
  t(133595,0,5,0),t(133683,2,4,0),t(134036,4,5,0),t(134389,7,3,0),
  t(134742,5,4,0),t(135448,1,8,0),t(136860,1,3,0),t(137566,3,3,0),
  t(137830,4,5,0),s(138272,139684,[[138272,4,3],[138536,2.5,3],[138801,0.5,3],[139066,0,3],[139331,0,3],[139595,0,3],[139684,0,3]]),t(139242,4,5,0),f(139331,6,4),
  t(139860,4,5,0),t(140125,6,4,0),t(140478,6,1,0),t(140566,2,1,0),
  h(141095,6,1,142507,1,[[141095,6,1],[141448,6,2],[141801,5,3],[142154,5,4],[142507,4,5]]),t(141801,8,2,0),t(142154,5,4,0),t(143213,0,3,0),
  t(143213,6,3,0),t(143919,0,5,0),t(144184,3,3,0),t(144448,5,4,0),
  s(144713,146125,[[144713,3,3],[144978,3,3],[145243,1.5,3],[145507,3,3],[145772,3,3],[146037,3,3],[146125,2.5,3]]),t(145507,4,3,0),t(146390,6,4,0),f(147096,7,3),
  t(148155,2,5,0),t(148684,6,1,0),s(149037,150449,[[149037,3,3],[149302,2.5,3],[149566,4,3],[149831,4,3],[150096,4,3],[150361,4,3],[150449,4,3]]),t(149743,4,5,0),
  t(150008,3,3,0),t(150096,4,4,0),t(151155,3,3,0),t(151508,1,3,0),
  h(151861,0,3,152390,1),t(152920,1,4,0),t(153449,4,1,0),s(153537,154949,[[153537,3,3],[153802,3.5,3],[154067,4,3],[154331,3.5,3],[154596,3.5,3],[154861,4,3],[154949,4,3]]),
  t(153978,5,5,0),t(155390,5,4,0),f(155743,5,4),h(156449,8,1,157067),
  t(157155,5,5,0),t(157243,6,3,0),t(157332,4,1,0),t(157508,5,5,0),
  t(159096,2,5,0),t(159361,6,4,0),t(159361,0,3,0),t(159626,6,4,0),
  h(160067,4,5,160597,0,[[160067,4,5],[160332,5,3],[160597,6,1]]),t(161214,5,3,0),t(161391,6,4,0),t(161479,5,3,0),
  t(161567,2,3,0),t(162185,1,8,0),f(162273,6,4),t(163332,5,3,0),
  s(163685,165097,[[163685,1.5,3],[163950,0,3],[164214,1,3],[164479,1,3],[164744,2.5,3],[165009,4,3],[165097,4,3]]),t(164214,0,4,0),t(164391,0,4,0),t(164744,1,3,0),
  t(165450,3,3,0),t(165979,0,5,3),t(166420,5,3,0),t(166509,2,1,0),
  t(166862,4,3,0),t(167038,0,4,0),t(167038,7,3,0),t(167391,0,5,0),
  t(167568,2,5,0),f(168273,5,3),t(169156,8,1,0),t(169509,6,1,0),
  t(169597,2,1,0),s(169685,170921,[[169685,1.5,3],[169862,0.5,3],[170038,0.5,3],[170215,0.5,3],[170391,0,3],[170568,0,3],[170744,0,3],[170921,0,3]],1),t(170391,1,3,0),t(171627,0,5,0),
  t(172244,2,5,0),h(172509,0,3,173127),t(173303,5,5,0),t(173833,2,5,0),
  t(174362,0,3,0),t(176039,0,5,0),t(176215,2,5,0),t(176480,1,3,0),
  t(176921,5,3,0),f(177186,2,5),t(177627,5,5,0),t(177892,5,3,0),
  t(178862,5,5,0),t(179039,4,5,0),t(179745,2,5,0),t(180098,2,1,0),
  t(180451,0,5,0),t(181157,1,3,0),t(181421,4,5,0),t(181862,0,5,0),
  t(182568,3,3,0),t(183098,0,3,0),t(183274,0,8,0),f(183980,5,3),
  t(184421,5,5,0),t(184686,5,5,0),t(185039,6,3,0),t(185039,0,3,0),
  h(185392,4,1,186098,0,[[185392,4,1],[185745,2,5],[186098,4,1]]),t(185745,7,3,0),t(186186,4,5,0),t(186274,0,5,0),
  t(186539,2,5,0),t(186804,0,3,0),t(186980,1,4,0),t(187686,6,1,0),
  t(187775,4,1,0),t(188481,6,4,0),t(188922,8,1,0),t(189098,2,5,0),
  t(189275,1,1,0),h(189628,0,3,190157),f(190334,4,5),t(191039,1,3,0),
  h(191481,7,3,192010),t(192098,3,5,0),t(192275,6,4,0),t(192363,4,5,0),
  t(192451,5,5,0),t(192804,3,4,0),t(192893,0,3,0),t(193245,0,5,0),
  t(194040,0,5,0),t(194216,0,3,0),t(194216,6,3,0),f(195099,1,4),
  h(195981,0,3,196599,1),t(197569,5,4,0),s(197746,199158,[[197746,4,3],[198010,4,3],[198275,3,3],[198540,1.5,3],[198805,0.5,3],[199069,0,3],[199158,0,3]]),t(198275,2,5,0),
  t(198452,0,3,0),t(198716,0,5,0),t(199511,0,1,0),t(199687,2,5,0),
  t(200216,6,1,0),t(200393,5,5,0),t(200569,1,3,0),t(200746,3,3,0),
  t(201099,4,5,0),h(201628,6,4,202070),t(203393,2,8,0),h(203570,5,5,204187,1,[[203570,5,5],[203923,7,1],[204187,5,5]]),
  f(204805,3,4),t(205511,5,5,0),t(207187,4,5,0),h(207629,7,3,208511),
  t(209041,2,5,0),h(209129,6,1,210541),t(209570,8,2,0),t(210805,1,3,0),
  t(210894,1,5,0),t(210982,5,4,0),t(211158,8,1,0),t(211864,0,5,4),
  t(212394,6,4,0),t(212394,0,3,0),t(212747,3,3,0),f(212923,6,4),
  t(213276,5,4,0),t(213453,1,4,0),t(214158,3,3,0),t(214335,0,3,0),
  t(214688,4,5,0),t(214864,2,5,0),t(215217,2,1,0),t(215394,0,3,0),
  t(215923,0,3,0),t(216276,0,3,0),t(216541,0,5,0),h(217159,1,3,217600),
  s(218218,219629,[[218218,0,3],[218482,0,3],[218747,0.5,3],[219012,1.5,3],[219276,3,3],[219541,3.5,3],[219629,4,3]]),t(218923,3,4,0),f(219100,1,3),t(219806,6,1,0),
  t(220512,2,5,0),t(220777,7,3,0),t(220953,7,3,0),t(221218,2,5,0),
  t(221394,0,4,0),t(221659,0,1,0),s(221924,223336,[[221924,1.5,3],[222188,1.5,3],[222453,3,3],[222718,0.5,3],[222983,0.5,3],[223247,1.5,3],[223336,1.5,3]],1),t(222277,2,5,0),
  t(222630,0,5,0),t(223865,3,4,0),t(224394,6,1,0),t(224483,4,1,0),
  t(224571,1,5,0),f(224747,0,5),t(225100,1,3,0),t(225453,1,8,0),
  t(225806,5,3,0),t(226336,2,5,0),t(226424,7,3,0),t(226777,2,5,0),
  t(227571,0,3,0),s(228100,229512,[[228100,1.5,3],[228365,0,3],[228630,0,3],[228895,0,3],[229159,0,3],[229424,0,3],[229512,0,3]]),t(228806,0,4,0),t(228983,1,3,0),
  t(229689,1,3,0),t(231101,0,3,0),t(231542,4,5,0),t(232865,2,5,0),
  f(233042,6,3),h(233395,5,3,233924),t(234366,2,5,0),t(234807,2,1,0),
  t(235071,0,5,0),t(235160,1,3,0),t(235866,0,4,0),t(235866,7,3,0),
  t(236219,5,3,0),h(236925,1,3,237542),t(237630,6,4,0),t(237983,3,4,0),
  t(238072,4,5,0),t(238160,5,3,0),t(238866,4,5,0),f(239042,5,4),
  h(239748,6,1,240719,1,[[239748,6,1],[240101,6,2],[240366,5,4],[240719,4,5]]),t(240101,6,4,0),t(240278,8,2,0),t(241337,6,1,0),
  t(241513,3,1,0),t(241866,2,5,0),t(242395,5,3,0),t(242572,8,1,0),
  t(243631,1,4,0),t(243719,4,5,0),t(243807,3,4,0),t(244337,6,4,0),
  t(244513,3,4,0),t(244690,6,4,0),f(245749,1,4),t(246102,3,3,0),
  t(246543,4,5,0),t(246631,6,4,0),t(246807,1,8,0),t(247160,6,4,0),
  t(247160,0,3,0),t(247513,5,5,0),t(247690,5,4,0),t(248219,4,1,0),
  t(248396,0,5,0),t(248925,0,3,0),t(249366,1,4,0),t(249455,3,4,0),
  t(249631,5,3,0),t(250337,2,5,0),t(251043,0,5,0),f(251220,0,5),
  t(251749,1,3,0),t(252190,0,5,0),t(252278,1,4,0),t(252631,0,5,0),
  t(253161,5,4,0),t(254220,6,4,0),t(254573,5,4,0),t(254749,2,5,0),
  t(255014,0,5,0),t(255102,0,4,0),t(255455,2,5,0),t(256867,0,5,0),
  t(257573,0,5,0),f(258279,0,5),t(258720,0,5,0),t(258985,6,3,0),
  t(258985,0,3,0),t(259691,2,5,0),t(260044,1,4,0),t(260132,0,5,0),
  t(260220,0,4,0),t(260926,0,4,0),t(261544,0,5,0),t(261632,3,4,0),
  t(261808,5,3,0),t(262514,5,5,0),t(262603,5,4,0),t(263044,1,4,0),
  f(263220,3,3),h(263661,0,5,264367,0,[[263661,0,5],[264014,0,3],[264367,1,1]]),t(264456,0,4,0),t(264632,0,4,0),
  s(265162,266573,[[265162,1.5,3],[265426,1.5,3],[265691,2.5,3],[265956,3.5,3],[266220,4,3],[266485,3.5,3],[266573,3.5,3]]),t(265514,1,4,0),t(266044,0,3,0),t(266662,0,8,0),
  t(266750,1,3,0),t(267985,3,4,0),t(268515,5,4,0),t(269044,3,4,0),
  t(270103,0,4,0),t(270456,1,4,0),t(270809,3,4,0),t(270985,6,4,0),
  t(270985,0,3,0),f(271515,6,4),
// </pandora-boss-v3-expert-notes>
])(mhTap,mhHoldV2,mhFlick,mhSlideV2);
const pandoraBossMasterNotes=((t,h,f,s)=>[
// <pandora-boss-v3-master-notes>
  f(1852,0,3),t(2558,2,3,0),t(2558,7,3,0),t(3087,8,2,0),
  t(3970,2,2,0),t(3970,6,2,0),t(4146,1,2,0),t(4146,7,2,0),
  t(4323,0,2,0),t(4323,8,2,0),t(4587,5,3,0),t(4676,6,3,0),
  t(5381,5,3,0),t(5558,7,3,0),t(5734,1,3,0),t(6440,4,6,0),
  t(6970,1,3,0),t(8382,0,3,0),t(9264,1,4,0),f(9617,4,2),
  t(9970,5,4,0),t(10146,3,3,0),t(10676,5,4,0),t(11029,3,3,0),
  t(11117,1,4,0),t(11205,3,3,0),t(11382,6,1,0),t(11823,1,4,0),
  t(11823,7,3,0),t(12088,3,4,0),t(12441,0,3,0),t(13147,1,3,0),
  f(13323,5,3),t(13764,1,3,0),t(13853,5,3,0),t(14029,3,3,0),
  t(14206,7,3,0),t(14911,5,4,0),t(15794,0,2,0),t(15794,4,2,0),
  t(16323,4,2,0),t(16323,8,2,0),t(16853,0,2,0),t(16853,4,2,0),
  s(17294,18265,[[17294,3,2],[17470,3,2],[17647,2.5,2],[17823,1,2],[18000,3.5,2],[18176,3.5,2],[18265,3.5,2]]),t(17735,1,3,0),t(18441,2,2,0),t(19147,0,2,0),
  t(19147,4,2,0),t(20118,0,4,0),t(20206,2,2,0),t(20294,3,4,0),
  s(20559,21794,[[20559,3,2],[20735,2.5,2],[20912,3,2],[21088,3,2],[21265,3,2],[21441,2.5,2],[21618,2,2],[21794,0.5,2]],1),f(21265,6,4),t(22235,4,2,0),t(22412,5,4,0),
  t(22500,6,4,0),t(23118,5,4,0),t(23383,3,4,0),t(24088,2,2,0),
  t(24441,5,3,0),t(24530,3,4,0),t(24794,6,2,0),t(24971,8,2,0),
  f(25236,6,4),t(26030,5,4,0),t(26206,6,4,0),t(26912,1,4,0),
  t(27177,3,4,0),t(27265,6,1,0),t(27353,4,6,0),t(27618,6,4,0),
  t(27618,1,3,0),t(27795,1,2,0),t(27795,5,2,0),t(27971,4,2,0),
  t(27971,8,2,0),t(28148,1,2,0),t(28148,5,2,0),t(28324,4,2,0),
  t(28324,8,2,0),t(28677,4,2,0),s(29030,30177,[[29030,3,2],[29206,3,2],[29383,3,2],[29559,1.5,2],[29736,4,2],[29912,3.5,2],[30089,3.5,2],[30177,3.5,2]]),f(29736,2,2),
  t(30442,8,2,0),t(30883,5,4,0),t(31059,5,4,0),t(31324,6,4,0),
  t(31854,6,4,0),t(32295,3,4,0),t(32560,6,2,0),t(32824,6,4,0),
  t(32913,5,3,0),t(33265,0,4,0),t(33265,6,3,0),t(33442,2,1,0),
  f(33530,3,4),t(33971,6,2,0),h(34236,8,1,34942,0,[[34236,8,1],[34589,7,3],[34942,6,4]]),h(35119,5,4,35913),
  t(36001,6,4,0),t(36089,3,4,0),t(36530,5,4,0),h(36795,1,3,37589),
  t(38119,0,4,0),t(38472,3,4,0),t(39354,3,4,0),t(39442,5,3,0),
  t(39619,1,4,0),t(39795,0,4,0),s(40060,41472,[[40060,1.5,2],[40325,0.5,2],[40589,0,2],[40854,0,2],[41119,0,2],[41384,0,2],[41472,0,2]]),t(40766,2,3,0),
  f(40854,1,3),s(41737,42972,[[41737,1.5,2],[41913,2,2],[42090,3,2],[42266,3,2],[42442,4,2],[42619,4,2],[42795,4,2],[42972,4,2]]),t(42178,3,4,0),t(42266,4,4,0),
  t(42442,6,4,0),t(43325,6,1,0),t(43413,2,1,0),t(43854,1,4,0),
  t(43854,7,3,0),t(44560,0,3,0),t(44737,3,4,0),s(45090,46237,[[45090,0,2],[45354,0,2],[45619,1,2],[45884,3.5,2],[46149,4,2],[46237,4,2]]),
  t(45443,0,6,0),t(46413,2,2,0),f(46502,6,2),t(47031,4,2,1),
  h(47825,1,4,48355),t(48531,5,4,0),t(49325,7,3,0),t(49413,3,4,0),
  t(49590,5,3,0),t(49678,1,4,0),t(49855,0,3,0),t(50031,1,3,0),
  t(50031,6,3,0),t(50208,4,1,0),t(50384,6,2,0),t(51796,4,2,0),
  h(52502,5,4,53031,0,[[52502,5,4],[52767,5,3],[53031,6,1]]),s(53208,54443,[[53208,3,2],[53384,0.5,2],[53561,0.5,2],[53737,2,2],[53914,2,2],[54090,2,2],[54267,2,2],[54443,2,2]]),t(54620,1,3,0),f(54796,5,3),
  h(55326,4,2,55767,1),t(57443,6,2,0),t(57620,2,2,0),t(58149,3,3,0),
  t(59032,3,4,0),t(59120,5,3,0),t(59208,3,3,0),s(60091,61502,[[60091,1.5,2],[60355,1.5,2],[60620,2,2],[60885,3,2],[61149,4,2],[61414,3.5,2],[61502,3.5,2]]),
  t(60444,6,2,0),t(60620,6,2,0),t(60973,4,3,0),f(61149,6,2),
  t(61855,5,3,0),t(61855,0,3,0),t(62385,7,3,0),s(62826,64061,[[62826,3,2],[63003,3,2],[63179,2.5,2],[63355,2.5,2],[63532,0.5,2],[63708,1.5,2],[63885,1.5,2],[64061,1.5,2]]),
  t(63267,8,1,0),t(63444,5,4,0),t(64150,4,1,0),t(64679,2,2,0),
  t(65032,0,2,0),t(65561,2,2,0),t(65650,4,6,0),h(66444,8,2,66885,1),
  h(67503,5,4,68032),f(68209,8,2),h(68562,5,3,69444),t(68915,8,2,0),
  t(69621,4,2,0),t(69797,6,1,0),h(69885,2,2,70415),t(70679,0,3,0),
  t(70679,5,3,0),h(71121,6,1,72532,1),h(73062,8,1,73944),t(74033,5,4,0),
  t(75444,6,4,0),h(75974,7,3,77209),t(76327,6,3,0),t(76680,6,3,0),
  f(76856,6,4),t(77386,7,3,0),t(77562,7,3,0),t(78092,7,3,0),
  t(78268,5,4,0),t(78533,5,4,0),t(78974,5,4,0),t(79415,5,4,0),
  t(79503,1,3,0),t(79680,0,2,0),t(79680,4,2,0),t(80386,2,2,0),
  t(80386,6,2,0),t(81092,4,2,0),t(81092,8,2,0),t(81621,3,3,0),
  t(81798,5,3,0),t(81798,0,3,0),f(81974,7,3),t(82504,5,3,0),
  t(83210,3,3,0),h(83474,6,1,84092,1,[[83474,6,1],[83827,5,4],[84092,6,1]]),t(84445,3,3,0),t(85327,0,3,0),
  t(85504,3,3,0),t(86033,2,2,0),t(86033,6,2,0),t(86386,1,2,0),
  t(86386,7,2,0),t(86739,0,2,0),t(86739,8,2,0),t(86916,3,2,0),
  t(87269,0,3,0),t(89033,0,4,0),t(89739,0,2,0),f(90004,0,2),
  t(90445,0,2,0),t(90710,2,2,0),t(91151,6,4,0),t(91857,5,4,0),
  t(92563,7,3,0),t(92563,2,3,0),t(92740,5,3,0),t(92828,2,6,0),
  t(92916,2,3,0),t(93269,0,3,0),t(93710,0,4,0),t(93975,2,2,0),
  t(94681,3,4,0),f(95387,1,3),t(95916,0,3,0),t(96093,3,4,0),
  t(96534,1,4,0),t(96622,5,3,0),t(96799,7,3,0),t(97505,6,4,0),
  t(97769,6,4,0),t(97946,6,4,0),t(98210,3,4,0),t(98475,5,4,0),
  t(98563,3,3,0),t(98916,1,4,0),t(98916,7,3,0),t(99181,0,4,0),
  t(99358,0,4,0),f(99622,1,4),t(100328,0,2,0),t(100328,4,2,0),
  t(100681,4,2,0),t(100681,8,2,0),t(101034,0,2,0),t(101034,4,2,0),
  t(101211,3,4,0),t(101387,5,3,0),t(101740,6,4,0),t(101917,7,3,0),
  t(102270,7,3,0),t(102446,6,4,0),s(103328,104387,[[103328,3,2],[103505,3,2],[103681,4,2],[103858,4,2],[104034,4,2],[104211,4,2],[104387,4,2]],1),f(104034,6,4),
  h(104740,5,4,105270,0,[[104740,5,4],[105005,7,1],[105270,5,4]]),t(105711,3,4,0),t(105976,5,3,0),h(106064,4,3,106682),
  t(106858,0,4,0),t(106858,6,3,0),t(107123,0,4,0),t(107564,1,4,0),
  t(107829,1,4,0),t(107917,0,3,0),t(108093,1,4,0),t(108535,4,2,0),
  t(108799,6,2,0),t(109417,3,4,0),t(109682,4,6,0),f(109858,3,3),
  t(110211,8,2,2),t(110564,6,2,0),t(110652,3,4,0),t(110741,2,4,0),
  t(111094,0,4,0),t(111535,1,4,0),t(111623,5,3,0),t(111800,3,3,0),
  h(112241,6,4,112770),t(113035,2,3,0),t(113035,7,3,0),t(113211,6,2,0),
  t(113476,6,4,0),t(113564,5,3,0),h(113741,4,2,114182),t(114358,5,4,0),
  t(114535,2,1,0),f(114623,4,2),t(115329,0,4,0),t(115506,6,1,0),
  t(115682,4,1,0),t(115770,1,4,0),t(116476,0,4,0),t(116564,6,2,0),
  t(116741,3,4,0),t(117182,1,4,0),t(117270,0,3,0),t(117447,1,4,0),
  h(117623,3,4,118418),f(118682,0,3),t(119035,1,4,0),t(119035,7,3,0),
  t(119212,0,2,0),t(119212,4,2,0),t(119741,2,2,0),t(119741,6,2,0),
  t(120271,4,2,0),t(120271,8,2,0),t(120447,1,4,0),t(120624,0,2,0),
  h(121153,1,3,121594),s(121771,123183,[[121771,3,2],[122035,2.5,2],[122300,0.5,2],[122565,0.5,2],[122830,0.5,2],[123094,0.5,2],[123183,0.5,2]]),t(122741,6,2,0),t(122830,6,4,0),
  t(123271,6,2,0),f(123624,7,3),t(124153,1,3,0),t(124683,0,4,0),
  t(125124,1,4,0),t(125389,0,2,0),t(126094,0,4,0),t(126536,0,6,0),
  t(126712,0,3,0),t(126712,5,3,0),t(127418,0,1,0),t(127506,3,2,0),
  t(127859,0,3,0),t(128389,3,1,0),h(128477,1,1,129006,0,[[128477,1,1],[128742,0,3],[129006,0,4]]),t(129183,2,1,0),
  t(129271,0,1,0),s(129359,130771,[[129359,2,2],[129624,2,2],[129889,0.5,2],[130154,0.5,2],[130418,0.5,2],[130683,0.5,2],[130771,0.5,2]]),t(129801,2,4,0),f(129977,3,3),
  t(130330,5,4,0),t(130859,1,3,0),t(131212,2,2,0),t(131212,6,2,0),
  t(131389,1,2,0),t(131389,7,2,0),t(131565,0,2,0),t(131565,8,2,0),
  t(132183,5,4,0),t(132271,7,3,0),t(132448,6,2,0),t(133154,3,3,0),
  t(133330,1,3,0),t(133330,6,3,0),t(133595,3,4,0),f(133683,0,3),
  t(134036,0,2,0),t(134036,4,2,0),t(134389,4,2,0),t(134389,0,2,0),
  t(134742,0,2,0),t(134742,4,2,0),t(135448,6,4,0),t(136860,2,2,0),
  t(137566,6,2,0),t(137830,3,4,0),s(138272,139684,[[138272,4,2],[138536,2.5,2],[138801,0.5,2],[139066,0,2],[139331,0,2],[139595,0,2],[139684,0,2]]),t(139242,5,4,0),
  t(139331,7,3,0),t(139860,5,4,0),f(140125,7,3),t(140478,4,1,0),
  t(140566,8,1,0),h(141095,4,2,142507,1),t(141801,7,3,0),t(142154,2,3,0),
  t(143213,0,2,0),t(143213,4,2,0),t(143919,0,2,0),t(143919,4,2,0),
  t(144184,2,2,0),t(144184,6,2,0),t(144448,4,2,0),t(144448,8,2,0),
  s(144713,146125,[[144713,3,2],[144978,3,2],[145243,1.5,2],[145507,3,2],[145772,3,2],[146037,3,2],[146125,2.5,2]]),t(145507,4,2,0),t(146390,3,3,0),t(147096,8,2,0),
  f(147184,3,3),t(148155,0,6,0),t(148684,2,1,0),s(149037,150449,[[149037,2,2],[149302,2,2],[149566,3.5,2],[149831,4,2],[150096,3.5,2],[150361,3,2],[150449,3,2]],1),
  t(149743,1,4,0),t(150008,0,2,0),t(150096,1,3,0),t(151155,4,2,0),
  t(151508,2,2,0),h(151861,0,4,152390,1,[[151861,0,4],[152125,0,3],[152390,1,1]]),t(152920,1,3,0),t(152920,6,3,0),
  t(153449,3,1,0),s(153537,154949,[[153537,3,2],[153802,3.5,2],[154067,4,2],[154331,3.5,2],[154596,3.5,2],[154861,4,2],[154949,4,2]]),t(153978,5,4,0),f(155390,5,3),
  t(155743,5,3,0),h(156449,8,1,157067),t(157155,6,4,0),t(157243,0,2,0),
  t(157332,4,1,0),t(157508,6,4,0),t(159096,3,4,0),t(159361,5,3,0),
  t(159626,7,3,0),h(160067,5,4,160597,1),t(161214,0,2,0),t(161391,1,3,0),
  t(161479,0,2,0),f(161567,3,2),t(162185,0,4,0),t(162273,3,3,0),
  t(163332,6,2,0),t(163332,2,2,0),s(163685,165097,[[163685,1.5,2],[163950,0,2],[164214,1,2],[164479,1,2],[164744,2.5,2],[165009,4,2],[165097,4,2]]),t(164214,0,3,0),
  t(164391,0,3,0),t(164744,2,2,0),t(165450,4,2,0),t(165979,0,4,3),
  t(166420,6,2,0),t(166509,2,1,0),t(166862,4,2,0),f(167038,0,3),
  t(167391,1,4,0),t(167568,2,6,0),t(168273,6,2,0),t(169156,0,1,0),
  t(169509,2,1,0),t(169597,6,1,0),s(169685,170921,[[169685,1.5,2],[169862,0.5,2],[170038,0.5,2],[170215,0.5,2],[170391,0,2],[170568,0,2],[170744,0,2],[170921,0,2]],1),t(170391,2,2,0),
  t(171627,1,4,0),t(171803,5,3,0),t(171803,0,3,0),t(172244,3,4,0),
  h(172509,9,1,173127,0,[[172509,9,1],[172862,6,4],[173127,9,1]]),f(173303,5,4),t(173833,1,4,0),t(173921,4,2,0),
  t(174362,0,2,0),t(176039,1,4,0),t(176215,3,4,0),t(176480,2,2,0),
  t(176921,6,2,0),t(177186,1,4,0),t(177627,5,4,0),t(177892,4,2,0),
  t(178068,6,2,0),t(178774,3,4,0),t(178862,1,4,0),f(179039,3,4),
  t(179745,5,4,0),t(180098,8,1,0),t(180274,4,2,0),t(180274,8,2,0),
  t(180451,6,4,0),t(181157,2,2,0),t(181421,3,4,0),t(181862,5,4,0),
  h(182039,6,4,182745,1),t(183098,2,2,0),t(183274,5,4,0),s(183451,184863,[[183451,2,2],[183716,2,2],[183980,2,2],[184245,2,2],[184510,3,2],[184774,0.5,2],[184863,1.5,2]]),
  t(183980,8,2,0),t(184421,1,4,0),f(184510,1,2),t(185039,4,2,0),
  t(185216,1,3,0),h(185392,5,4,186098,0,[[185392,5,4],[185745,7,1],[186098,5,4]]),t(185745,4,2,0),t(186186,4,4,0),
  t(186274,5,4,0),t(186539,0,6,0),t(186804,0,2,0),t(186804,4,2,0),
  t(186980,1,3,0),t(187686,0,1,0),t(187775,3,1,0),f(188481,5,3),
  t(188922,4,1,0),t(189098,1,4,0),t(189275,0,1,0),h(189628,0,2,190157),
  t(190334,0,4,0),t(190951,3,1,0),t(191039,0,2,0),h(191481,2,2,192010),
  t(192098,5,4,0),t(192275,3,3,0),t(192363,6,4,0),t(192451,3,4,0),
  t(192804,5,3,0),t(192893,8,2,0),f(193245,5,4),t(194040,1,4,0),
  t(194040,7,3,0),t(194216,8,2,0),t(195099,5,3,0),h(195981,8,2,196599),
  t(197569,7,3,0),s(197746,199158,[[197746,3,2],[198010,2.5,2],[198275,2,2],[198540,1.5,2],[198805,1,2],[199069,1,2],[199158,0.5,2]],1),t(198275,2,4,0),t(198452,1,2,0),
  t(198716,0,4,0),t(199511,2,1,0),t(199687,3,4,0),t(200216,2,1,0),
  t(200393,1,4,0),t(200569,0,2,0),f(200746,4,2),t(201099,1,4,0),
  h(201628,5,3,202070),t(203393,3,4,0),h(203570,6,4,204187),t(204805,1,3,0),
  t(204805,6,3,0),t(205511,6,4,0),t(207187,5,4,0),h(207629,8,2,208511),
  t(209041,3,4,0),h(209129,6,1,210541,0,[[209129,6,1],[209482,5,4],[209835,6,1],[210188,5,4],[210541,6,1]]),f(209570,3,3),t(210805,2,2,0),
  t(210894,4,6,0),t(210982,1,3,0),t(211158,6,1,0),t(211864,1,4,4),
  t(212394,5,3,0),t(212747,4,2,0),t(212923,7,3,0),t(213276,5,3,0),
  t(213453,3,3,0),t(214158,2,2,0),t(214335,0,2,0),t(214688,5,4,0),
  t(214864,1,4,0),t(214864,7,3,0),t(215217,4,1,0),f(215394,0,2),
  t(215923,0,2,0),t(216276,0,2,0),t(216541,0,4,0),h(217159,0,2,217600,1),
  s(218218,219629,[[218218,0,2],[218482,0,2],[218747,0.5,2],[219012,1.5,2],[219276,3,2],[219541,3.5,2],[219629,4,2]]),t(218923,4,3,0),t(219100,0,2,0),t(219806,4,1,0),
  t(220512,0,4,0),t(220777,3,2,0),t(220953,8,2,0),t(221218,3,4,0),
  t(221394,0,3,0),t(221659,2,1,0),s(221924,223336,[[221924,2,2],[222188,2,2],[222453,3.5,2],[222718,1,2],[222983,1,2],[223247,2,2],[223336,2,2]]),f(222277,6,4),
  t(222630,6,4,0),t(223865,5,3,0),t(223865,0,3,0),t(224394,8,1,0),
  t(224483,4,1,0),t(224571,6,4,0),t(224747,0,2,0),t(224747,4,2,0),
  t(225100,1,2,0),t(225100,5,2,0),t(225453,3,2,0),t(225453,7,2,0),
  t(225806,4,2,0),t(225806,8,2,0),t(226336,3,4,0),f(226424,8,2),
  t(226777,2,6,0),t(227571,2,2,0),t(228100,3,3,0),s(228277,229689,[[228277,3,2],[228542,3.5,2],[228806,3,2],[229071,4,2],[229336,3.5,2],[229601,4,2],[229689,4,2]],1),
  t(228718,4,2,0),t(228806,7,3,0),t(228983,4,2,0),t(230659,2,2,0),
  t(231101,2,2,0),t(231101,6,2,0),t(231454,0,2,0),t(231542,3,4,0),
  t(232865,1,4,0),f(233042,6,2),h(233395,5,1,233924,0,[[233395,5,1],[233660,4,3],[233924,3,4]]),t(234366,0,4,0),
  t(234807,3,1,0),t(234895,5,2,0),t(235071,0,4,0),t(235160,6,2,0),
  t(235689,1,3,0),t(235866,3,3,0),t(236219,0,2,0),h(236925,2,2,237542),
  t(237630,3,3,0),s(237983,238954,[[237983,3,2],[238160,3,2],[238336,3.5,2],[238513,3,2],[238689,3,2],[238866,1,2],[238954,1,2]]),f(238601,8,2),t(239042,1,3,0),
  t(239219,5,3,0),t(239307,3,3,0),h(239748,6,4,240719,1,[[239748,6,4],[240101,7,3],[240366,8,2],[240719,9,1]]),t(240101,6,3,0),
  t(240278,6,3,0),t(241337,6,1,0),t(241513,3,1,0),t(241866,1,4,0),
  t(241866,7,3,0),t(242395,8,2,0),t(242572,4,1,0),t(242837,0,4,0),
  t(243631,1,3,0),t(243719,5,4,0),f(243807,3,3),t(244337,7,3,0),
  t(244513,3,3,0),t(244690,7,3,0),t(245749,5,3,0),t(246102,8,2,0),
  t(246543,5,4,0),t(246631,7,3,0),t(246807,1,4,0),t(246807,7,3,0),
  t(247160,5,3,0),t(247513,4,6,0),t(247690,5,3,0),t(248219,4,1,0),
  f(248396,1,4),t(248925,0,2,0),t(249366,1,3,0),t(249455,0,3,0),
  t(249631,2,2,0),t(250337,3,4,0),t(251043,5,4,0),t(251220,1,4,0),
  t(251749,6,2,0),t(252190,3,4,0),t(252278,7,3,0),t(252631,3,4,0),
  t(253161,7,3,0),f(254220,1,3),t(254573,0,3,0),t(254749,1,4,0),
  t(254749,7,3,0),t(255014,0,4,0),t(255102,1,3,0),t(255455,1,4,0),
  t(256867,5,4,0),t(257573,1,4,0),t(258279,3,4,0),t(258720,0,4,0),
  t(258985,4,2,0),t(259691,1,4,0),t(260044,0,3,0),t(260132,1,4,0),
  f(260220,0,3),t(260926,1,3,0),t(261102,0,2,0),t(261544,1,4,0),
  t(261632,3,3,0),t(261808,2,2,0),t(262161,0,3,0),t(262161,5,3,0),
  t(262514,1,4,0),t(262603,5,3,0),t(263044,3,3,0),t(263220,8,2,0),
  h(263661,7,1,264367,0,[[263661,7,1],[264014,5,4],[264367,7,1]]),t(264456,7,3,0),f(264632,7,3),s(265162,266573,[[265162,3,2],[265426,3,2],[265691,4,2],[265956,4,2],[266220,4,2],[266485,4,2],[266573,4,2]]),
  t(265514,4,3,0),t(265691,4,3,0),t(266044,4,2,0),t(266662,4,6,0),
  t(266750,7,2,0),t(267985,5,3,0),t(268515,7,3,0),t(269044,5,3,0),
  t(270103,1,3,0),t(270456,3,3,0),t(270809,5,3,0),t(270985,7,3,0),
  t(271515,5,3,0),t(271515,0,3,0),f(271868,3,3),
// </pandora-boss-v3-master-notes>
])(mhTap,mhHoldV2,mhFlick,mhSlideV2);
const pandoraBossCharts=Object.freeze({
  EASY:mhChart(1,pandoraBossEasyNotes,PANDORA_BOSS_DURATION_MS),
  NORMAL:mhChart(3,pandoraBossNormalNotes,PANDORA_BOSS_DURATION_MS),
  HARD:mhChart(5,pandoraBossHardNotes,PANDORA_BOSS_DURATION_MS),
  EXPERT:mhChart(7,pandoraBossExpertNotes,PANDORA_BOSS_DURATION_MS),
  MASTER:mhChart(9,pandoraBossMasterNotes,PANDORA_BOSS_DURATION_MS),
});

// 綺季一閃 ～花雪に舞う詠姫～（全尺4分21秒）。作り方は上と同じ。
const EIKI_BOSS_DURATION_MS=261841;
const eikiBossEasyNotes=((t,h,f,s)=>[
// <eiki-boss-v3-easy-notes>
  t(2124,0,10,0),t(5801,0,6,0),t(5994,1,4,0),t(6575,2,6,0),
  t(7156,7,3,0),t(7156,0,3,0),t(7930,3,4,0),t(8123,4,6,0),
  t(8897,4,6,0),t(9672,4,6,0),t(9865,6,4,0),t(10252,6,4,0),
  t(12188,5,4,0),h(12962,6,3,14510,0,[[12962,6,3],[13349,5,4],[13736,5,4],[14123,4,6],[14510,4,6]]),t(14897,4,6,0),h(15671,4,6,17219),
  t(18961,3,4,0),t(19735,5,4,0),t(19929,6,4,0),t(23026,4,6,0),
  t(23413,4,6,0),t(24574,2,6,0),t(25348,2,6,0),t(26509,1,3,0),
  h(27477,0,6,28348),t(28832,1,4,0),t(29606,2,6,0),t(30380,4,6,0),
  t(31154,2,6,0),t(32702,0,6,0),h(33476,3,4,34347),h(34638,1,4,35702),
  t(35992,0,6,0),t(37541,0,6,0),t(38702,2,6,0),t(39089,0,6,0),
  t(39670,0,4,0),t(40444,1,4,0),t(41218,0,4,0),t(43153,5,4,0),
  t(43927,3,4,0),t(44701,0,10,0),t(45089,0,6,0),t(45476,1,4,1),
  h(46250,2,6,47121),t(48379,4,6,0),h(50508,4,6,51765),t(51862,5,3,0),
  t(52830,7,3,0),t(52830,0,3,0),t(54185,1,4,0),t(54959,3,4,0),
  t(55346,5,4,0),h(55926,4,6,57088),t(57281,4,6,0),t(58055,5,4,0),
  t(58249,5,3,0),t(58830,5,4,0),t(60571,3,3,0),t(60765,5,4,0),
  t(62894,6,4,0),t(63474,4,6,0),t(64055,3,4,0),h(64829,0,6,65603,0,[[64829,0,6],[65216,1,4],[65603,2,3]]),
  t(66377,0,6,0),t(66571,0,6,0),t(67152,2,6,0),t(67539,5,4,0),
  t(68313,3,4,0),h(68893,1,4,69861),t(70635,0,6,0),t(71409,0,3,0),
  t(73538,0,4,0),t(73925,1,4,0),t(74312,2,6,0),t(74699,5,4,0),
  t(75086,6,4,0),t(76441,5,4,0),t(76635,6,4,0),t(77215,5,4,0),
  t(77796,6,4,0),t(78570,0,10,0),t(78957,5,4,0),t(79344,3,4,0),
  t(79925,0,3,0),t(79925,7,3,0),t(80699,0,6,0),t(81667,1,4,0),
  t(82054,1,4,0),t(82247,0,6,0),t(83021,0,4,0),t(84183,0,6,0),
  t(84570,2,6,0),t(84957,0,6,0),t(85344,2,6,0),t(85731,1,4,0),
  t(86118,3,4,0),t(86505,0,6,0),t(87279,3,4,0),t(87666,0,6,0),
  t(88247,2,6,0),t(88634,4,6,0),h(89021,4,6,90472),t(90569,5,4,0),
  h(92118,6,3,93666,0,[[92118,6,3],[92505,5,4],[92892,4,6],[93279,5,4],[93666,6,3]]),h(94246,4,6,95795),t(96182,3,4,0),t(96569,5,4,0),
  t(96956,3,4,0),t(98117,0,6,0),t(98891,2,6,0),t(99665,4,6,0),
  t(100052,3,4,0),t(100440,0,6,0),t(101601,0,3,0),t(103149,1,4,0),
  t(104117,0,6,0),t(104891,0,10,0),t(106246,0,6,2),t(106633,2,6,0),
  t(107213,4,6,0),t(108568,4,6,0),t(109536,4,6,0),h(110116,4,6,111665),
  t(112052,7,3,0),t(112052,0,3,0),t(113213,2,6,0),t(113987,4,6,0),
  t(115535,4,6,0),t(116309,4,6,0),t(118051,4,6,0),t(119019,4,6,0),
  h(119406,4,6,120567,0,[[119406,4,6],[119793,6,4],[120180,6,4],[120567,4,6]]),t(121148,5,4,0),t(122309,6,4,0),t(122503,4,6,0),
  t(125018,5,4,0),t(126180,6,4,0),t(127147,3,4,0),t(127534,5,4,0),
  t(128115,6,4,0),t(128502,5,4,0),t(128889,3,4,0),t(129276,1,4,0),
  t(129663,0,6,0),t(129857,1,4,0),t(130437,3,4,0),t(130825,5,4,0),
  t(131212,3,4,0),t(131986,0,6,0),t(132179,1,4,0),t(132760,3,4,0),
  t(133147,2,6,0),t(134115,1,4,0),t(134889,3,4,0),t(135469,5,4,0),
  t(136244,6,4,0),t(138179,5,4,0),t(138566,0,10,0),t(138953,6,4,0),
  t(140695,7,3,0),t(140695,0,3,0),t(142243,0,6,0),t(143017,1,4,0),
  t(143404,0,6,0),t(143791,0,6,0),t(144178,0,4,0),t(144566,1,4,0),
  t(145340,0,4,0),t(145727,1,4,0),t(146501,0,4,0),t(146888,0,6,0),
  t(147275,0,4,0),t(147662,5,4,0),t(148049,2,6,0),t(148436,1,4,0),
  t(149210,0,4,0),t(149597,1,4,0),t(149984,3,4,0),t(150372,0,6,0),
  h(150759,1,4,152113),t(152694,3,4,0),t(153081,5,4,0),t(153468,3,4,0),
  t(155016,5,4,0),t(155403,6,4,0),t(156565,5,4,0),t(156952,5,4,3),
  t(158113,6,4,0),t(159274,4,6,0),t(160629,2,6,0),t(160822,4,6,0),
  t(161210,4,6,0),t(163532,4,6,0),t(163919,0,10,0),t(165080,4,6,0),
  t(165854,3,4,0),t(166048,0,6,0),h(167403,2,3,168951,0,[[167403,2,3],[167790,0,6],[168177,2,3],[168564,0,6],[168951,2,3]]),h(169338,0,6,170886),
  t(172241,0,6,0),t(172435,0,6,0),t(173596,0,3,0),t(173596,7,3,0),
  t(173983,2,6,0),t(174370,4,6,0),t(174951,2,6,0),t(175144,4,6,0),
  t(175531,4,6,0),t(175918,5,4,0),t(176112,2,6,0),t(176692,1,4,0),
  t(177079,0,6,0),t(177466,0,6,0),t(177854,2,6,0),t(178241,4,6,0),
  t(178628,1,4,0),t(179402,3,4,0),t(180176,5,4,0),t(180369,4,6,0),
  t(180950,4,6,0),t(181144,4,6,0),t(182111,1,4,0),t(182498,2,6,0),
  t(182885,5,4,0),t(183079,4,6,0),t(183660,5,4,0),t(184047,3,4,0),
  t(184434,1,4,0),t(184821,0,6,0),t(185595,4,6,0),t(185982,4,6,0),
  t(186369,0,10,0),t(187143,1,4,0),t(187337,0,6,0),t(187917,0,3,0),
  t(187917,7,3,0),t(188304,1,4,0),t(188498,0,6,0),t(188885,3,4,0),
  t(189079,1,4,0),t(189466,0,4,0),t(189853,1,4,0),t(190046,2,6,0),
  t(190627,0,6,0),t(191014,2,6,0),t(191207,5,4,0),t(191788,4,6,0),
  t(192175,5,4,0),t(192562,2,6,0),t(192949,0,6,0),t(193336,0,4,0),
  t(193723,5,4,0),t(194110,2,6,0),t(194498,1,4,0),t(194885,0,4,0),
  t(195659,1,4,0),t(196046,2,6,0),t(196433,4,6,0),t(196626,2,6,0),
  t(197207,0,6,0),t(197981,0,4,0),t(198755,0,6,0),t(199142,0,6,0),
  h(199723,1,3,201271,0,[[199723,1,3],[200110,0,4],[200497,0,4],[200884,0,6],[201271,0,6]]),t(201465,4,6,0),t(201852,5,4,0),t(202239,3,4,0),
  t(202626,1,4,0),t(203013,0,6,0),t(203207,0,10,0),t(203787,0,3,0),
  t(203787,7,3,0),t(204174,5,4,0),t(204368,3,4,0),t(204948,4,6,0),
  h(205723,3,4,206593),t(206884,4,6,0),t(207464,2,6,0),t(207658,1,4,0),
  t(208045,2,6,0),t(208432,0,4,0),t(208819,0,4,4),h(209206,0,6,210754,0,[[209206,0,6],[209593,0,6],[209980,1,4],[210367,1,4],[210754,2,3]]),
  t(211142,0,4,0),t(211916,0,6,0),t(212303,0,6,0),h(212496,0,4,213851),
  t(214238,0,6,0),t(214625,1,4,0),t(215399,2,6,0),t(215593,4,6,0),
  t(216173,6,4,0),t(216561,5,4,0),t(216948,3,4,0),t(217722,1,4,0),
  t(218109,0,4,0),t(218496,1,4,0),t(218689,2,6,0),t(219657,5,4,0),
  t(220431,4,6,0),t(220818,4,6,0),t(221205,3,4,0),t(221592,5,4,0),
  t(221980,6,4,0),h(223141,4,6,224689),t(225076,6,4,0),t(225463,5,4,0),
  t(225850,3,4,0),t(226237,1,4,0),t(226624,3,4,0),t(227398,7,3,0),
  t(227398,0,3,0),t(227786,6,4,0),t(229721,1,4,0),t(230495,3,4,0),
  t(231269,5,4,0),t(231850,0,10,0),t(233592,5,4,0),t(233785,4,6,0),
  t(234366,5,4,0),t(236108,6,4,0),t(236495,6,4,0),t(237656,6,4,0),
  t(238043,6,4,0),t(239011,3,4,0),t(239398,5,4,0),t(239785,3,4,0),
  h(241720,2,3,243268,0,[[241720,2,3],[242107,1,4],[242494,0,6],[242881,1,4],[243268,2,3]]),t(243462,0,4,0),t(244236,1,4,0),t(244623,3,4,0),
  t(245784,0,4,0),t(246171,0,6,0),t(246558,0,4,0),t(247720,0,6,0),
  t(248494,0,6,0),t(248881,0,4,0),t(249268,1,4,0),t(249655,0,4,0),
  t(250429,1,4,0),t(250816,0,4,0),t(251203,1,4,0),t(252365,3,4,0),
  t(253139,1,4,0),t(253913,0,4,0),t(257783,0,6,0),t(258558,0,6,0),
  t(259332,0,10,0),t(260299,0,3,0),t(260299,7,3,0),
// </eiki-boss-v3-easy-notes>
])(mhTap,mhHoldV2,mhFlick,mhSlideV2);
const eikiBossNormalNotes=((t,h,f,s)=>[
// <eiki-boss-v3-normal-notes>
  t(2124,0,10,0),t(5801,0,6,0),f(5994,1,4),t(6575,2,6,0),
  t(7156,7,3,0),t(7156,0,3,0),t(7930,3,4,0),t(8123,4,6,0),
  t(8897,4,6,0),t(9672,4,6,0),t(9865,3,4,0),t(10059,4,6,0),
  t(12188,6,4,0),h(12962,6,2,14510,0,[[12962,6,2],[13349,6,3],[13736,5,4],[14123,5,4],[14510,4,6]]),t(14704,2,6,0),t(14897,4,6,0),
  h(15671,4,6,17219,1),t(18961,3,3,0),h(19735,6,4,20413),t(22251,3,3,0),
  t(23026,4,6,0),f(23413,2,6),t(24574,0,6,0),t(25348,2,6,0),
  t(26509,2,2,0),h(27477,0,6,28348),t(28832,1,4,0),h(29606,0,6,30380),
  t(31154,0,6,0),t(31541,2,6,0),t(32702,4,6,0),h(33476,1,3,34347),
  h(34638,0,3,35702),t(35992,0,6,0),t(37541,0,6,0),t(38702,0,6,0),
  t(39089,4,6,0),t(39670,0,3,0),t(39670,7,3,0),f(40444,5,4),
  t(41218,1,4,0),t(43153,6,4,0),t(43927,3,4,0),t(44701,4,6,0),
  t(45089,0,6,0),t(45476,3,4,0),h(46250,0,6,47121),t(48379,0,10,0),
  t(49153,2,6,0),h(50508,4,6,51765),t(51862,7,2,0),t(52830,6,2,1),
  t(54185,3,4,0),t(54959,1,4,0),f(55346,0,4),h(55926,0,6,57088),
  t(57281,0,6,0),t(57475,0,2,0),t(58055,1,4,0),t(58249,2,2,0),
  t(58830,3,4,0),t(60571,2,2,0),t(60765,5,4,0),t(62894,7,3,0),
  t(62894,0,3,0),t(63474,2,6,0),t(64055,5,4,0),h(64829,0,6,65603,0,[[64829,0,6],[65216,1,4],[65603,2,2]]),
  h(65990,0,4,67539),t(68313,1,3,0),h(68893,3,3,69861),t(70635,4,6,0),
  t(71409,6,2,0),f(73538,0,4),t(73925,1,4,0),t(74312,2,6,0),
  t(74699,5,4,0),t(75086,6,4,0),t(76441,1,4,0),t(76635,5,4,0),
  t(77215,3,4,0),t(77796,6,4,0),t(78183,6,2,0),t(78570,0,6,0),
  t(78957,3,4,0),t(79344,0,4,0),t(79925,1,4,0),t(80699,0,6,0),
  t(81667,0,4,0),t(82054,1,4,0),t(82247,0,10,0),f(83021,0,4),
  t(83796,0,3,0),t(83796,7,3,0),t(84183,0,6,0),t(84570,0,6,0),
  t(84957,0,6,0),t(85344,2,6,0),t(85731,5,4,0),t(86118,6,4,0),
  t(86505,4,6,0),t(86892,0,4,0),t(87279,3,4,0),t(87666,0,6,0),
  t(88247,4,6,0),t(88634,2,6,0),h(89021,6,2,90472,0,[[89021,6,2],[89408,5,4],[89795,4,6],[90085,5,4],[90472,6,2]]),f(90569,5,3),
  h(92118,4,6,93666,1),h(94246,4,6,95795),t(96182,3,4,0),t(96569,5,4,0),
  t(96956,3,4,0),t(97343,5,4,0),t(98117,2,6,0),t(98891,4,6,0),
  t(99665,2,6,0),t(100052,5,4,0),t(100440,0,6,0),t(100827,0,3,0),
  t(100827,7,3,0),t(101601,8,2,0),t(103149,5,3,0),t(104117,0,6,0),
  t(104891,2,6,0),f(105665,5,4),t(106246,4,6,2),t(106633,4,6,0),
  t(107213,2,6,0),t(108568,0,6,0),t(109536,2,6,0),t(109923,7,3,0),
  h(110116,4,6,111665),t(111858,6,4,0),t(112052,6,4,0),t(113213,0,10,0),
  t(113987,4,6,0),t(115535,2,6,0),t(116309,4,6,0),t(118051,4,6,0),
  t(119019,2,6,0),h(119406,4,6,120567,0,[[119406,4,6],[119793,7,3],[120180,7,3],[120567,4,6]]),f(121148,5,4),t(122309,6,4,0),
  t(122503,4,6,0),t(125018,5,3,0),t(126180,6,4,0),t(127147,1,3,0),
  t(127534,7,3,0),t(127534,0,3,0),t(127728,3,4,0),t(128115,6,4,0),
  t(128502,5,3,0),t(128889,1,3,0),t(129276,3,4,0),t(129663,4,6,0),
  t(129857,6,4,0),t(130050,5,3,0),t(130437,3,4,0),t(130825,1,4,0),
  f(131212,0,4),t(131986,0,6,0),t(132179,0,4,0),t(132760,0,3,0),
  t(133147,0,6,0),t(134115,5,4,0),t(134889,1,4,0),t(135469,3,3,0),
  t(136244,0,3,0),t(138179,1,4,0),t(138566,4,6,0),t(138953,6,4,0),
  t(140695,5,4,0),t(142243,4,6,0),t(142630,5,4,0),t(143017,3,4,0),
  f(143404,0,6),t(143791,0,10,0),t(144178,7,3,0),t(144178,0,3,0),
  t(144566,6,4,0),t(145727,3,4,0),t(146501,5,4,0),t(146888,4,6,0),
  t(147275,5,4,0),t(147662,0,4,0),t(148049,0,6,0),t(148436,0,4,0),
  t(148823,1,4,0),t(149210,0,4,0),t(149597,1,4,0),t(149984,0,4,0),
  t(150372,0,6,0),h(150759,1,4,152113,1),t(152694,0,3,0),f(153081,0,4),
  t(153468,1,4,0),h(153855,2,2,155403,0,[[153855,2,2],[154242,0,6],[154629,2,2],[155016,0,6],[155403,2,2]]),t(156565,3,4,0),t(156952,1,4,3),
  t(157339,0,4,0),t(158113,1,4,0),t(159274,0,6,0),t(160629,0,6,0),
  t(160822,2,6,0),t(161210,0,6,0),t(163532,0,6,0),t(163919,0,6,0),
  t(165080,0,6,0),t(165467,0,6,0),t(165854,0,3,0),t(165854,7,3,0),
  f(166048,4,6),h(167403,4,6,168951),h(169338,6,2,170886,0,[[169338,6,2],[169725,6,3],[170112,5,4],[170499,5,4],[170886,4,6]]),t(172241,0,6,0),
  t(172435,4,6,0),t(173209,3,4,0),t(173596,6,4,0),t(173983,2,6,0),
  t(174370,4,6,0),t(174951,4,6,0),t(175144,4,6,0),t(175531,0,10,0),
  t(175918,3,4,0),t(176112,4,6,0),t(176499,4,6,0),t(176692,5,4,0),
  f(177079,2,6),t(177466,0,6,0),t(177660,0,6,0),t(177854,0,6,0),
  t(178241,4,6,0),t(178628,6,4,0),t(179015,5,4,0),t(179402,0,3,0),
  t(179402,7,3,0),t(180176,1,4,0),t(180369,4,6,0),t(180563,0,6,0),
  t(180950,2,6,0),t(181144,0,6,0),t(181337,1,3,0),t(182111,3,4,0),
  t(182305,4,6,0),t(182498,4,6,0),t(182885,1,4,0),t(183079,2,6,0),
  f(183273,5,4),t(183660,7,3,0),t(183853,0,6,0),t(184047,3,4,0),
  t(184434,5,4,0),t(184821,4,6,0),t(185401,4,6,0),t(185595,2,6,0),
  t(185982,0,6,0),t(186369,0,6,0),t(187143,1,4,0),t(187337,2,6,0),
  t(187530,4,6,0),t(187917,3,4,0),t(188111,0,6,0),f(188304,0,4),
  t(188691,7,3,0),t(188691,0,3,0),t(188885,1,4,0),t(189079,3,4,0),
  t(189466,0,4,0),t(189853,1,4,0),t(190046,0,10,0),t(190240,1,4,0),
  t(190627,4,6,0),t(191014,2,6,0),t(191207,6,4,0),t(191401,6,4,0),
  t(191788,4,6,0),t(191982,4,6,0),t(192175,6,4,0),t(192562,4,6,0),
  t(192949,2,6,0),t(193336,1,4,0),f(193723,0,4),t(194110,0,6,0),
  t(194498,3,4,0),t(194885,5,4,0),t(195078,4,6,0),t(195272,1,4,0),
  t(195659,3,4,0),t(196046,4,6,0),t(196433,4,6,0),t(196626,2,6,0),
  t(196820,7,3,0),t(196820,0,3,0),t(197207,4,6,0),t(197594,5,3,0),
  t(197981,7,3,0),t(198562,5,4,0),t(198755,2,6,0),f(199142,4,6),
  h(199723,4,6,201271,0,[[199723,4,6],[200110,6,4],[200497,6,4],[200884,7,3],[201271,8,2]]),t(201465,0,6,0),t(201852,3,4,0),t(202045,4,6,0),
  t(202239,6,4,0),t(202626,5,4,0),t(203013,2,6,0),t(203207,0,6,0),
  t(203400,4,6,0),t(203787,3,4,0),t(204174,0,4,0),t(204368,3,4,0),
  t(204561,1,4,0),t(204948,0,10,0),h(205336,1,4,206593),f(206884,0,6),
  t(207271,0,4,0),t(207464,0,6,0),t(207658,0,4,0),t(208045,2,6,4),
  t(208432,0,3,0),t(208432,7,3,0),t(208626,0,6,0),t(208819,1,4,0),
  h(209206,2,6,210754,1),t(211142,1,4,0),t(211529,3,4,0),t(211916,4,6,0),
  t(212109,4,6,0),t(212303,2,6,0),h(212690,6,2,213851,0,[[212690,6,2],[213077,5,4],[213464,5,4],[213851,6,2]]),t(214238,4,6,0),
  t(214625,6,4,0),f(215012,3,4),t(215399,0,6,0),t(215593,2,6,0),
  t(215786,4,6,0),t(216173,3,3,0),t(216561,1,4,0),t(216948,3,4,0),
  t(217335,5,4,0),t(217528,6,4,0),t(217722,1,4,0),t(218109,5,4,0),
  t(218496,3,4,0),t(218689,4,6,0),t(218883,5,3,0),t(219657,3,4,0),
  t(220431,0,6,0),t(220818,0,10,0),t(221205,0,3,0),t(221205,7,3,0),
  f(221592,1,4),t(221980,3,4,0),t(222754,1,4,0),h(223141,0,6,224689,1),
  t(225076,5,4,0),t(225463,3,4,0),t(225850,1,4,0),t(226237,0,4,0),
  t(226624,1,4,0),t(227398,3,4,0),t(227786,5,4,0),t(229721,0,4,0),
  t(230495,1,4,0),t(231269,3,4,0),t(231850,4,6,0),t(232043,6,4,0),
  t(233592,3,4,0),f(233785,4,6),t(234366,3,4,0),t(236108,0,3,0),
  t(236495,1,3,0),t(237269,3,3,0),t(237656,1,3,0),t(238043,0,4,0),
  t(239011,3,4,0),t(239398,5,4,0),t(239785,0,3,0),t(239785,7,3,0),
  h(241720,4,6,243268,0,[[241720,4,6],[242107,5,4],[242494,6,2],[242881,5,4],[243268,4,6]]),t(243462,7,3,0),t(244236,5,4,0),t(244623,3,3,0),
  t(245397,1,4,0),t(245784,3,3,0),f(246171,4,6),t(246558,7,3,0),
  t(247720,2,6,0),t(248494,4,6,0),t(248881,3,3,0),t(249268,7,3,0),
  t(249655,3,3,0),t(250429,6,4,0),t(250816,3,4,0),t(251203,6,4,0),
  t(251977,5,3,0),t(252365,1,4,0),t(253139,3,4,0),t(253913,0,4,0),
  t(257783,0,6,0),t(258558,0,6,0),t(259332,0,10,0),f(260299,1,4),
// </eiki-boss-v3-normal-notes>
])(mhTap,mhHoldV2,mhFlick,mhSlideV2);
const eikiBossHardNotes=((t,h,f,s)=>[
// <eiki-boss-v3-hard-notes>
  t(1930,0,8,0),f(2124,0,5),t(3962,0,4,0),t(3962,7,3,0),
  t(4156,3,4,0),t(5414,3,4,0),t(5801,4,5,0),t(5994,3,4,0),
  t(6865,4,5,0),t(7059,5,5,0),t(7156,5,4,0),t(7930,6,4,0),
  t(8123,2,5,0),t(8897,4,5,0),t(8994,5,5,0),t(9672,4,5,0),
  t(9865,3,4,0),t(10059,5,5,0),t(10155,2,5,0),t(11026,1,4,0),
  t(12188,0,4,0),s(12962,14510,[[12962,1,3],[13252,2.5,3],[13542,2,3],[13833,2,3],[14123,1.5,3],[14413,2.5,3],[14510,3,3]]),t(14704,0,5,0),f(14897,2,5),
  t(15478,6,1,0),h(15671,7,1,17219,0,[[15671,7,1],[16058,7,2],[16445,6,3],[16832,6,4],[17219,5,5]]),t(17316,5,4,0),t(18961,3,3,0),
  h(19735,5,4,20413),t(20606,2,5,0),t(20993,5,5,0),t(22348,2,5,0),
  t(23026,4,5,0),t(23316,2,5,0),t(23413,1,5,0),t(24574,0,5,0),
  t(25348,2,5,0),t(25735,0,5,0),t(26509,6,1,0),h(27477,5,5,28348,1),
  t(28832,6,4,0),t(28832,0,3,0),f(29025,5,5),s(29606,30380,[[29606,1,3],[29896,1,3],[30186,2.5,3],[30380,3.5,3]]),
  t(31154,0,5,0),t(31541,0,5,0),t(31928,2,5,0),t(32702,4,5,0),
  h(33476,7,3,34347),h(34638,5,3,35702),t(35992,5,5,0),t(37541,2,5,0),
  t(37637,5,5,0),t(38702,0,8,0),t(39089,4,5,0),t(39670,3,4,0),
  t(40057,1,4,0),t(40444,3,4,0),t(41218,1,4,0),t(41798,0,5,0),
  f(42089,0,5),t(43153,1,4,0),t(43540,3,4,0),t(43927,1,4,0),
  t(44701,2,5,0),t(45089,0,5,0),t(45476,3,4,0),t(45863,1,4,1),
  h(46250,2,5,47121),h(47411,1,4,48379),t(49153,0,5,0),h(50508,0,5,51765),
  h(52153,4,5,52733),t(52830,4,1,0),t(52927,1,5,0),t(54088,2,5,0),
  t(54475,6,4,0),t(54475,0,3,0),t(54862,3,4,0),f(54959,1,4),
  t(55926,0,5,0),s(56217,57088,[[56217,2,3],[56410,2,3],[56604,2.5,3],[56797,3.5,3],[56991,4,3],[57088,4,3]]),t(57281,0,5,0),t(57572,2,5,0),
  t(57765,4,5,0),t(58055,1,4,0),t(58249,6,1,0),t(58830,3,4,0),
  t(59313,5,5,0),t(59700,4,5,0),t(60087,2,5,0),t(60281,4,5,0),
  h(60571,2,5,61249,0,[[60571,2,5],[60958,3,3],[61249,4,1]]),t(61636,1,3,0),t(62507,0,4,0),t(62894,3,4,0),
  t(63474,0,5,0),f(64055,3,4),h(64829,0,4,65603,1),s(65990,67539,[[65990,1,3],[66281,1,3],[66571,0,3],[66861,1,3],[67152,1,3],[67442,1,3],[67539,1,3]]),
  t(67732,5,4,0),t(68313,3,3,0),t(68506,1,3,0),h(68893,0,3,69861),
  t(70151,1,3,0),t(70538,3,4,0),t(70635,0,8,0),t(71409,4,1,0),
  t(72474,0,4,0),t(72474,7,3,0),t(72861,3,4,0),t(73635,5,4,0),
  t(74022,6,4,0),t(74216,2,5,0),h(74312,5,5,74990),t(75183,5,4,0),
  t(75377,4,5,0),t(75570,6,4,0),f(75764,5,5),t(76344,4,5,0),
  t(76441,3,4,0),t(77119,5,4,0),t(77215,3,4,0),t(77699,5,3,0),
  t(77796,1,4,0),t(78280,3,4,0),t(78570,0,5,0),t(78957,1,4,0),
  t(79247,3,3,0),t(79344,1,4,0),h(79635,1,1,80409,0,[[79635,1,1],[80022,0,5],[80409,1,1]]),t(80602,0,5,0),
  t(80699,4,5,0),t(81667,3,4,0),t(82054,5,4,0),f(82247,0,5),
  t(83021,5,4,0),t(83118,4,1,0),h(83505,7,3,83989),t(84183,5,5,0),
  t(84376,6,4,0),t(84376,0,3,0),t(84570,0,5,0),t(84957,2,5,0),
  t(85344,4,5,0),t(85537,5,5,0),t(85731,5,4,0),t(86118,6,4,0),
  t(86505,4,5,0),t(86699,2,5,0),t(86892,1,4,0),t(87086,3,3,0),
  t(87279,5,4,0),f(87666,5,5),t(88053,5,4,0),t(88247,1,8,0),
  t(88634,0,5,0),t(88924,0,4,0),s(89021,90472,[[89021,1,3],[89311,0.5,3],[89602,1,3],[89892,2,3],[90182,2.5,3],[90472,2.5,3]]),t(90569,0,3,0),
  s(92118,93666,[[92118,1,3],[92408,1,3],[92698,1.5,3],[92988,2,3],[93279,1.5,3],[93569,0,3],[93666,0,3]],1),s(94150,95698,[[94150,1,3],[94440,0.5,3],[94730,1,3],[95021,2,3],[95311,2,3],[95601,2,3],[95698,2,3]]),t(95795,0,5,0),t(96182,0,4,0),
  t(96569,1,4,0),t(96956,1,4,0),t(97343,1,4,0),t(98117,0,5,0),
  t(98214,0,5,0),t(98504,0,4,0),t(98891,0,5,0),t(99278,0,4,0),
  f(99665,0,5),t(100052,0,4,0),t(100440,0,5,0),t(100827,0,4,0),
  t(100827,7,3,0),h(101310,5,5,102472),t(103149,5,3,2),t(104117,0,5,0),
  t(104504,4,5,0),t(104891,2,5,0),t(105665,6,4,0),s(106246,107020,[[106246,3,3],[106439,3,3],[106633,4,3],[106826,4,3],[107020,4,3]]),
  t(107213,0,5,0),h(107794,3,3,108471),t(108568,4,5,0),t(109149,7,3,0),
  t(109536,4,5,0),t(109923,3,3,0),s(110116,111665,[[110116,1,3],[110407,0,3],[110697,0,3],[110987,0,3],[111277,0,3],[111568,0,3],[111665,0,3]]),t(111858,0,4,0),
  f(112052,0,4),t(113213,0,5,0),t(113406,3,4,0),t(113987,4,5,0),
  h(115535,2,5,116116,0,[[115535,2,5],[115826,4,1],[116116,2,5]]),t(116309,5,5,0),t(118051,4,5,0),h(118148,6,4,118922),
  t(119019,4,5,0),h(119406,5,3,120567,1),t(121245,0,5,0),t(121632,2,5,0),
  t(122309,5,4,0),t(122503,5,5,0),t(123567,2,8,0),t(123954,2,5,0),
  h(124341,0,5,124922),t(125018,3,3,0),f(125115,7,3),t(125502,2,5,0),
  t(125696,0,4,0),t(125696,7,3,0),t(125889,0,5,0),t(126180,1,4,0),
  t(126470,5,4,0),t(126664,2,5,0),t(126857,6,4,0),t(127051,6,4,0),
  t(127147,5,3,0),t(127438,2,5,0),t(127534,1,4,0),t(127825,0,5,0),
  t(128405,0,5,0),h(128502,3,3,129179),t(129276,4,4,0),t(129373,2,5,0),
  t(129663,0,5,0),t(129857,5,4,0),t(130147,1,4,0),t(130341,5,4,0),
  f(130437,0,4),t(130825,1,4,0),t(131115,3,4,0),t(131212,5,4,0),
  t(131502,5,5,0),t(131986,4,5,0),t(132179,6,4,0),t(132276,4,5,0),
  t(132760,3,3,0),t(133147,0,5,0),t(133244,5,4,0),t(133437,2,5,0),
  t(133631,5,5,0),t(133824,6,3,0),t(133824,0,3,0),t(134018,5,5,0),
  f(134115,5,4),t(134889,6,4,0),t(135469,5,3,0),t(135566,3,5,0),
  t(135760,0,5,0),t(136147,0,5,0),t(136244,1,3,0),h(136534,4,5,137405,1),
  t(138082,5,5,0),t(138179,3,4,0),t(138469,5,3,0),t(138566,0,8,0),
  t(138953,0,4,0),t(139630,1,3,0),t(139824,0,3,0),t(140695,1,4,0),
  t(141953,0,3,0),t(142243,0,5,0),f(142630,3,4),t(143017,5,4,0),
  t(143404,5,5,0),t(143791,4,5,0),t(144082,3,4,0),t(144178,1,4,0),
  t(144566,3,4,0),t(144953,6,4,0),t(145340,3,4,0),t(145727,5,4,0),
  t(146501,6,4,0),t(146888,4,5,0),h(147178,3,4,147856),t(148049,0,5,0),
  t(148436,0,4,0),t(148436,7,3,0),t(148630,3,3,0),t(148727,5,3,0),
  s(149017,149791,[[149017,3,3],[149210,3,3],[149404,3,3],[149597,3,3],[149791,4,3]]),f(149984,5,4),t(150372,5,5,0),s(150759,152113,[[150759,2,3],[150952,2,3],[151146,2,3],[151339,2,3],[151533,1,3],[151726,1,3],[151920,0,3],[152113,0,3]]),
  t(152307,6,4,0),t(152694,5,3,0),t(153081,3,4,0),t(153468,5,4,0),
  h(153855,6,4,155403),h(155791,5,4,157339,1),t(158113,3,4,3),t(158887,5,5,0),
  t(159274,5,5,0),t(159661,6,4,0),t(160629,0,5,0),t(160822,0,5,0),
  t(161210,2,5,0),t(161984,4,5,0),t(162758,3,4,0),f(163532,0,5),
  t(163919,0,5,0),t(165080,0,5,0),t(165467,4,5,0),t(165854,3,4,0),
  t(166048,2,8,0),s(167403,168951,[[167403,0,3],[167693,1.5,3],[167983,3,3],[168274,4,3],[168564,4,3],[168854,4,3],[168951,4,3]]),h(169338,7,1,170886,1,[[169338,7,1],[169725,7,2],[170112,6,3],[170499,6,4],[170886,5,5]]),t(171660,4,5,0),
  t(172241,2,5,0),t(172435,0,5,0),t(173015,0,5,0),t(173209,0,4,0),
  t(173209,7,3,0),t(173596,3,4,0),t(173789,0,5,0),t(173983,0,5,0),
  f(174370,2,5),t(174757,5,4,0),t(174951,5,5,0),t(175144,2,5,0),
  t(175338,5,5,0),t(175531,2,5,0),t(175918,5,4,0),t(176112,5,5,0),
  t(176499,4,5,0),h(176692,3,5,177660,0,[[176692,3,5],[176983,3,4],[177370,4,2],[177660,5,1]]),t(177854,0,5,0),t(178047,4,5,0),
  t(178241,2,5,0),t(178434,5,5,0),t(178628,5,4,0),t(179015,5,4,0),
  t(179208,5,5,0),t(179402,6,4,0),t(179789,6,4,0),t(179982,5,5,0),
  t(180176,6,4,0),t(180369,5,5,0),f(180563,2,5),t(180950,4,5,0),
  t(181144,2,5,0),t(181337,1,3,0),t(181531,4,5,0),t(181724,3,3,0),
  t(182111,0,4,0),t(182111,7,3,0),t(182305,0,5,0),t(182498,4,5,0),
  t(182885,1,4,0),t(183079,2,5,0),t(183273,0,4,0),t(183563,0,5,0),
  t(183660,1,3,0),t(183853,0,5,0),t(184047,1,4,0),t(184434,0,4,0),
  t(184627,0,8,0),f(184821,0,5),t(185401,0,5,0),t(185595,4,5,0),
  t(185982,0,5,0),f(186369,2,5),t(186756,0,4,0),t(186950,1,4,0),
  t(187143,3,4,0),t(187337,0,5,0),t(187530,0,5,0),t(187724,1,3,0),
  t(187917,3,4,0),t(188111,0,5,0),t(188304,0,4,0),t(188498,2,5,0),
  t(188691,0,4,0),t(188885,3,4,0),t(188982,2,5,0),t(189272,1,4,0),
  t(189466,0,4,0),t(189659,1,4,0),t(189853,0,4,0),t(189853,7,3,0),
  t(190046,1,5,0),t(190143,2,4,0),t(190433,0,4,0),t(190627,2,5,0),
  t(190820,1,4,0),t(191014,0,5,0),t(191207,1,4,0),t(191401,3,4,0),
  t(191595,0,3,0),t(191788,2,5,0),t(191982,0,5,0),t(192175,3,4,0),
  t(192369,1,3,0),t(192562,0,5,0),t(192756,0,5,0),f(192949,2,5),
  t(193336,0,4,0),t(193723,3,4,0),t(193917,0,5,0),t(194110,0,5,0),
  t(194498,3,4,0),t(194885,5,4,0),t(195078,5,5,0),t(195272,3,4,0),
  t(195659,1,4,0),t(196046,0,5,0),t(196239,1,4,0),t(196433,1,8,0),
  t(196626,0,5,0),t(196820,0,3,0),t(197013,1,4,0),f(197207,2,5),
  t(197594,1,3,0),t(197788,0,3,0),t(197981,0,3,0),t(198562,1,4,0),
  t(198755,0,5,0),t(199142,0,5,0),t(199723,3,3,0),h(199820,6,1,201271,0,[[199820,6,1],[200207,5,3],[200594,4,5],[200884,5,3],[201271,6,1]]),
  t(201465,2,5,0),h(201852,5,5,202626,0,[[201852,5,5],[202239,8,1],[202626,5,5]]),t(202820,5,5,0),t(203013,4,5,0),
  t(203110,3,4,0),t(203400,4,5,0),t(203594,3,4,0),t(203690,7,3,0),
  t(204174,5,4,0),t(204368,6,4,0),t(204561,5,4,0),t(204755,2,5,0),
  f(204948,0,5),s(205336,206593,[[205336,1,3],[205529,0,3],[205723,0,3],[205916,0,3],[206110,0,3],[206303,0,3],[206497,0.5,3],[206593,0.5,3]]),t(206884,0,5,0),t(207077,2,5,0),
  t(207271,1,4,0),t(207464,4,5,0),t(207658,3,4,0),t(208045,5,5,4),
  t(208432,6,4,0),t(208626,4,5,0),t(208819,3,4,0),t(209013,4,5,0),
  s(209206,210754,[[209206,3,3],[209497,3,3],[209787,3,3],[210077,1,3],[210367,1,3],[210658,1,3],[210754,1,3]]),t(210948,1,3,0),t(211142,3,4,0),f(211529,5,4),
  t(211916,5,5,0),t(212109,4,5,0),t(212303,2,5,0),t(212496,1,4,0),
  s(212690,213851,[[212690,3,3],[212883,3,3],[213077,3,3],[213270,4,3],[213464,3,3],[213658,3,3],[213851,3,3]],1),t(214238,0,5,0),t(214432,2,5,0),t(214625,1,4,0),
  t(215012,5,4,0),t(215206,3,3,0),t(215399,2,8,0),t(215593,0,5,0),
  t(215786,0,5,0),t(216173,3,3,0),t(216367,5,4,0),t(216561,6,4,0),
  t(216754,5,4,0),f(216948,6,4),t(217335,5,4,0),t(217528,3,4,0),
  t(217722,1,4,0),t(217915,0,4,0),t(218109,1,4,0),t(218496,3,4,0),
  t(218689,0,5,0),t(218883,3,3,0),t(219270,5,4,0),t(219657,6,4,0),
  t(220044,5,4,0),t(220431,2,5,0),t(220818,2,5,0),t(221012,5,5,0),
  t(221205,3,4,0),t(221592,6,4,0),t(221592,0,3,0),t(221980,3,4,0),
  t(222560,5,5,0),f(222754,3,4),s(223141,224689,[[223141,3,3],[223431,3,3],[223721,3,3],[224012,3,3],[224302,3,3],[224592,3,3],[224689,3,3]],1),t(225076,5,4,0),
  t(225270,6,4,0),t(225463,5,4,0),t(225850,3,4,0),t(226237,5,4,0),
  t(226624,6,4,0),t(227011,6,4,0),t(227398,6,4,0),t(227786,6,4,0),
  s(229431,230979,[[229431,3,3],[229721,3,3],[230011,3,3],[230302,3,3],[230592,3,3],[230882,4,3],[230979,3,3]]),t(231269,1,4,0),t(231850,2,5,0),t(232043,5,4,0),
  t(232140,5,5,0),t(233592,1,4,0),t(233785,4,5,0),f(233882,2,5),
  t(234366,6,4,0),t(235237,4,5,0),t(236108,7,3,0),t(236495,5,3,0),
  t(236978,3,4,0),t(237172,0,8,0),t(237946,0,5,0),t(238333,0,5,0),
  t(238527,3,4,0),t(239011,1,4,0),t(239398,3,4,0),t(239494,4,5,0),
  t(239785,0,4,0),t(239785,7,3,0),t(240849,0,5,0),t(241623,2,4,0),
  h(241720,2,1,243268,0,[[241720,2,1],[242107,0,5],[242494,2,1],[242881,0,5],[243268,2,1]]),t(243462,0,3,0),t(243946,0,4,0),f(244236,1,4),
  t(244623,1,3,0),t(244720,0,4,0),t(244913,0,5,0),t(245300,0,5,0),
  t(245688,0,5,0),t(246171,0,5,0),t(246462,5,3,0),t(246558,1,3,0),
  t(247720,2,5,0),t(248204,0,5,0),t(248494,0,5,0),t(248784,0,5,0),
  t(248978,2,5,0),t(250332,5,5,0),t(250429,5,4,0),t(250913,2,5,0),
  t(251300,4,5,0),f(251687,4,5),t(252365,6,4,0),t(252461,4,5,0),
  t(253139,6,4,0),t(253622,4,5,0),t(253913,3,4,0),t(254010,1,5,0),
  t(254203,0,4,0),t(255558,0,5,0),t(255945,0,4,0),t(255945,7,3,0),
  t(256913,0,5,0),t(257106,2,5,0),t(257783,0,5,0),t(258074,4,5,0),
  t(258558,2,5,0),t(258848,5,5,0),t(259041,2,5,0),t(259332,2,8,0),
  f(260299,5,4),
// </eiki-boss-v3-hard-notes>
])(mhTap,mhHoldV2,mhFlick,mhSlideV2);
const eikiBossExpertNotes=((t,h,f,s)=>[
// <eiki-boss-v3-expert-notes>
  t(1930,0,8,0),f(2124,0,5),t(3962,0,4,0),t(3962,7,3,0),
  t(4156,3,4,0),t(5414,5,4,0),t(5801,5,5,0),t(5994,5,4,0),
  t(6091,5,5,0),t(6865,2,5,0),t(7059,4,5,0),t(7156,3,4,0),
  t(7930,1,4,0),t(8123,0,5,0),s(8897,9478,[[8897,1.5,3],[9091,0.5,3],[9285,1.5,3],[9478,3,3]]),t(9672,0,5,0),
  t(9865,1,4,0),t(10059,4,5,0),t(10155,0,5,0),t(10252,5,4,0),
  t(11026,1,4,0),f(12188,3,4),t(12768,5,3,0),s(12962,14510,[[12962,3,3],[13252,4,3],[13542,4,3],[13833,4,3],[14123,3.5,3],[14413,4,3],[14510,4,3]]),
  t(13349,4,5,0),t(13736,3,4,0),t(14123,1,4,0),t(14704,2,5,0),
  t(14897,4,5,0),h(15671,7,1,17219,0,[[15671,7,1],[16058,7,2],[16445,6,3],[16832,6,4],[17219,5,5]]),t(16832,9,1,0),t(17316,2,4,0),
  t(18961,1,3,0),t(18961,7,3,0),h(19735,5,4,20413),t(20606,0,2,0),
  t(20606,4,2,0),t(20800,2,2,0),t(20800,6,2,0),t(20993,4,2,0),
  t(20993,8,2,0),t(22348,5,5,0),f(23026,0,5),t(23413,4,5,0),
  s(23800,24380,[[23800,1.5,3],[23993,1,3],[24187,0,3],[24380,0,3]]),t(24574,2,5,0),t(25348,0,5,0),t(25735,2,5,0),
  t(26509,2,1,0),t(27380,0,5,0),h(27477,1,5,28348,1),t(28832,5,4,0),
  t(29025,5,5,0),s(29606,30380,[[29606,3,3],[29799,2,3],[29993,3,3],[30186,3,3],[30380,4,3]]),t(29993,4,5,0),t(31154,5,5,0),
  t(31541,5,5,0),t(32702,2,5,0),t(33283,4,5,0),h(33476,3,3,34347),
  h(34638,1,3,35702),f(35315,0,4),t(35992,0,5,0),t(37541,0,8,0),
  t(37637,2,5,0),t(38702,4,5,0),t(39089,2,5,0),t(39670,1,2,0),
  t(39670,5,2,0),t(40057,3,2,0),t(40057,7,2,0),t(40444,1,2,0),
  t(40444,5,2,0),t(41218,0,4,0),t(41218,7,3,0),s(41798,42379,[[41798,3.5,3],[42089,2.5,3],[42379,0.5,3]]),
  t(43153,0,2,0),t(43153,4,2,0),t(43540,2,2,0),t(43540,6,2,0),
  t(43927,4,2,0),t(43927,8,2,0),t(44701,0,5,0),f(45089,2,5),
  t(45476,0,4,0),t(45863,1,4,0),h(46250,2,5,47121),t(46637,5,4,0),
  t(47411,3,4,0),h(47604,0,5,48379,0,[[47604,0,5],[47992,1,3],[48379,2,1]]),t(49153,0,5,0),h(50508,0,5,51765),
  t(51185,4,5,0),h(52153,5,5,52733),t(52830,6,1,0),t(52927,2,5,0),
  t(54088,2,5,0),t(54475,5,4,0),t(54862,3,4,0),f(54959,2,4),
  t(55926,0,5,0),s(56217,57088,[[56217,1.5,3],[56410,1.5,3],[56604,2,3],[56797,3,3],[56991,3.5,3],[57088,3.5,3]]),t(56701,0,5,1),t(57281,0,5,0),
  t(57475,4,1,0),t(57572,4,5,0),t(57765,5,5,0),t(58055,1,4,0),
  t(58249,6,1,0),t(58830,0,4,0),t(58830,7,3,0),t(59313,1,2,0),
  t(59313,5,2,0),t(59700,3,2,0),t(59700,7,2,0),t(60087,1,2,0),
  t(60087,5,2,0),t(60281,4,5,0),h(60571,4,1,61249,1),t(61636,1,3,0),
  t(62507,0,4,0),f(62894,1,4),t(63474,2,5,0),t(64055,5,4,0),
  t(64248,3,4,0),h(64829,1,4,65603,1),s(65990,67539,[[65990,3,3],[66281,3,3],[66571,1.5,3],[66861,3,3],[67152,3,3],[67442,2.5,3],[67539,3,3]]),t(66377,2,5,0),
  t(66571,0,5,0),t(66764,0,5,0),t(67152,0,8,0),t(67732,3,4,0),
  t(67926,5,4,0),t(68313,7,3,0),h(68893,6,1,69861,0,[[68893,6,1],[69184,5,4],[69571,5,4],[69861,6,1]]),t(70151,3,3,0),
  t(70538,5,4,0),t(70635,2,5,0),t(71409,2,1,0),f(72474,0,4),
  t(72861,0,2,0),t(72861,4,2,0),t(73248,2,2,0),t(73248,6,2,0),
  t(73635,4,2,0),t(73635,8,2,0),t(74022,0,4,0),t(74022,7,3,0),
  t(74216,4,5,0),t(74312,0,5,0),h(74409,2,5,74990),t(75183,0,4,0),
  t(75377,0,5,0),t(75570,0,4,0),t(75764,0,5,0),t(76344,0,5,0),
  t(76441,3,4,0),t(77119,5,4,0),t(77215,2,4,0),f(77312,0,5),
  t(77699,5,3,0),t(77796,3,4,0),t(78280,1,4,0),t(78570,0,5,0),
  t(78957,1,4,0),t(79247,3,3,0),t(79344,1,4,0),h(79635,2,5,80409,0,[[79635,2,5],[80022,4,1],[80409,2,5]]),
  t(80602,0,5,0),t(80699,4,5,0),t(81183,2,5,0),t(81667,1,4,0),
  t(82054,5,4,0),t(82247,0,5,0),t(83021,3,4,0),t(83118,6,1,0),
  h(83505,7,3,83989),t(84183,4,5,0),t(84376,6,4,0),t(84376,0,3,0),
  f(84570,0,5),t(84957,4,5,0),t(85344,1,2,0),t(85344,5,2,0),
  t(85537,3,2,0),t(85537,7,2,0),t(85731,1,2,0),t(85731,5,2,0),
  t(86118,6,4,0),t(86505,4,5,0),t(86699,5,5,0),t(86892,5,4,0),
  t(87086,7,3,0),t(87279,5,4,0),t(87666,5,5,0),t(88053,3,4,0),
  f(88247,4,5),t(88634,0,8,0),t(88924,6,4,0),s(89021,90472,[[89021,3,3],[89311,2,3],[89602,2.5,3],[89892,4,3],[90182,4,3],[90472,4,3]]),
  t(89505,3,3,0),t(89795,0,5,0),t(90569,0,3,0),s(92118,93666,[[92118,1.5,3],[92408,1,3],[92698,2,3],[92988,2.5,3],[93279,1.5,3],[93569,0,3],[93666,0,3]],1),
  t(92795,2,4,0),t(93085,0,5,0),s(94150,95698,[[94150,1.5,3],[94440,0.5,3],[94730,1.5,3],[95021,2,3],[95311,2,3],[95601,2,3],[95698,2,3]]),t(94827,2,5,0),
  t(94924,3,5,0),t(95021,2,4,0),t(95795,8,2,0),t(95795,4,2,0),
  t(96182,2,2,0),t(96182,6,2,0),t(96569,4,2,0),t(96569,8,2,0),
  t(96956,6,4,0),t(96956,0,3,0),f(97343,6,4),t(98117,5,5,0),
  t(98214,4,5,0),t(98504,5,4,0),t(98891,2,5,0),t(99278,5,4,0),
  t(99569,2,5,0),t(99665,0,5,0),t(100052,0,4,0),t(100440,0,5,0),
  t(100827,3,4,0),h(101310,4,5,102472),t(103149,7,3,2),t(104117,0,5,0),
  t(104504,2,5,0),t(104891,0,5,0),t(105665,5,4,0),s(106246,107020,[[106246,0,3],[106536,1,3],[106826,3,3],[107020,4,3]]),
  f(106633,5,5),t(107213,5,5,0),h(107794,3,3,108471),t(108568,4,5,0),
  t(109149,1,3,0),t(109536,2,5,0),t(109923,0,3,0),s(110116,111665,[[110116,1.5,3],[110407,0,3],[110697,0,3],[110987,0,3],[111277,0,3],[111568,0,3],[111665,0,3]]),
  t(110503,5,4,0),t(111858,6,4,0),t(112052,6,4,0),t(113213,4,5,0),
  t(113406,6,4,0),t(113406,0,3,0),t(113987,4,5,0),h(115535,2,5,116116),
  t(116309,4,5,0),t(118051,2,5,0),h(118148,6,4,118922),f(119019,0,5),
  h(119406,1,3,120567,1),t(119793,3,3,0),t(119987,5,4,0),t(120083,6,4,0),
  t(121245,1,8,0),t(121632,4,5,0),t(122309,6,4,0),t(122503,4,5,0),
  t(123180,6,4,0),t(123567,4,5,0),t(123954,2,5,0),h(124341,0,5,124922),
  t(125018,0,3,0),f(125115,4,3),t(125502,0,5,0),t(125696,5,4,0),
  t(125889,2,5,0),t(126180,1,4,0),t(126470,0,4,0),t(126664,0,5,0),
  t(126857,0,4,0),t(127051,1,4,0),t(127147,0,3,0),t(127438,0,5,0),
  t(127534,0,4,0),t(127825,2,5,0),t(128115,6,4,0),t(128115,0,3,0),
  t(128405,2,5,0),h(128502,2,3,129179),t(129276,0,4,0),t(129373,0,5,0),
  t(129663,4,5,0),t(129857,3,4,0),t(130147,6,4,0),t(130341,5,4,0),
  f(130437,6,4),t(130825,5,4,0),t(131115,6,4,0),t(131212,3,4,0),
  t(131502,5,5,0),t(131889,2,5,0),t(131986,4,5,0),t(132179,3,4,0),
  t(132276,1,5,0),t(132760,5,3,0),t(133147,0,5,0),t(133244,3,4,0),
  t(133437,0,5,0),t(133631,0,5,0),t(133824,1,3,0),t(133824,7,3,0),
  t(134018,2,5,0),t(134115,1,4,0),f(134211,0,5),h(134889,7,1,135663,0,[[134889,7,1],[135276,6,3],[135663,5,5]]),
  t(135760,2,5,0),t(136147,0,5,0),t(136244,0,3,0),h(136534,0,5,137405,1),
  t(138082,4,5,0),t(138179,1,4,0),t(138469,3,3,0),t(138566,0,8,0),
  t(138663,1,4,0),t(138953,5,4,0),t(139630,3,3,0),t(139824,5,3,0),
  f(140695,6,4),t(141953,1,3,0),t(142243,4,5,0),t(142630,3,4,0),
  t(143017,6,4,0),t(143404,4,5,0),t(143791,2,5,0),t(144082,1,4,0),
  t(144178,0,4,0),t(144566,1,4,0),t(144953,5,4,0),t(145340,3,4,0),
  h(145727,5,4,146501),t(146888,5,5,0),h(147178,6,4,147856),f(148049,0,5),
  t(148436,3,4,0),t(148630,5,3,0),t(148727,2,3,0),t(148823,3,4,0),
  s(149017,149791,[[149017,0,3],[149307,0.5,3],[149597,2.5,3],[149791,4,3]]),t(149984,0,4,0),t(149984,7,3,0),t(150372,2,5,0),
  s(150759,152113,[[150759,3,3],[150952,2.5,3],[151146,2.5,3],[151339,2.5,3],[151533,1.5,3],[151726,1.5,3],[151920,0.5,3],[152113,0.5,3]]),t(151146,6,4,0),t(151339,4,5,0),t(151533,2,5,0),
  t(152307,6,4,0),t(152694,3,3,0),t(153081,5,4,0),t(153468,1,4,0),
  h(153855,3,4,155403,1),t(154242,0,4,0),t(155016,7,3,0),h(155791,0,5,157339,0,[[155791,0,5],[156178,0,4],[156565,1,3],[156952,1,2],[157339,2,1]]),
  f(156565,0,4),t(156952,1,4,3),t(158113,5,4,0),t(158500,2,5,0),
  t(158887,0,5,0),t(159274,0,5,0),t(160629,0,5,0),t(160822,2,5,0),
  t(161210,4,5,0),t(161984,5,5,0),t(162758,5,4,0),t(163145,3,4,0),
  t(163532,4,5,0),t(163919,0,5,0),t(165080,0,5,0),f(165467,0,5),
  t(165854,0,4,0),t(165854,7,3,0),t(166048,2,8,0),t(166435,5,5,0),
  s(167403,168951,[[167403,1.5,3],[167693,3,3],[167983,3.5,3],[168274,3.5,3],[168564,4,3],[168854,4,3],[168951,4,3]],1),t(167790,6,4,0),t(168177,1,4,0),t(168564,6,4,0),
  h(169338,0,5,170886,1),t(170112,6,4,0),t(170499,1,4,0),t(171660,0,5,0),
  t(172241,0,5,0),t(172435,0,5,0),t(173015,0,5,0),t(173209,1,4,0),
  t(173596,3,4,0),t(173789,0,5,0),f(173983,0,5),t(174370,2,5,0),
  t(174757,1,4,0),t(174951,0,5,0),t(175144,0,5,0),t(175338,4,5,0),
  h(175531,0,5,176112),t(176305,3,4,0),t(176499,4,5,0),h(176692,8,1,177660,0,[[176692,8,1],[176983,6,4],[177370,6,4],[177660,8,1]]),
  t(177079,4,5,0),t(177273,2,5,0),t(177854,0,5,0),t(178047,0,5,0),
  t(178241,4,5,0),t(178434,2,5,0),f(178628,1,4),t(179015,0,4,0),
  t(179015,7,3,0),t(179208,0,5,0),t(179402,0,4,0),t(179789,1,4,0),
  t(179982,0,5,0),t(180176,5,4,0),t(180369,2,5,0),t(180563,0,5,0),
  t(180950,0,5,0),t(181144,0,5,0),t(181337,5,3,0),t(181531,2,5,0),
  t(181724,7,3,0),t(182111,5,4,0),t(182305,2,5,0),f(182498,0,5),
  t(182885,0,4,0),t(183079,0,5,0),t(183176,3,5,0),t(183273,5,4,0),
  t(183563,2,5,0),t(183660,2,3,0),t(183853,2,5,0),t(184047,5,4,0),
  t(184434,6,4,0),t(184627,2,8,0),t(184821,2,5,0),t(185401,0,5,0),
  t(185595,2,5,0),t(185982,0,5,0),f(186369,4,5),t(186756,0,4,0),
  t(186756,7,3,0),t(186950,6,4,0),t(187143,5,4,0),t(187337,5,5,0),
  t(187434,1,4,0),t(187530,2,5,0),t(187724,5,3,0),t(187917,6,4,0),
  t(188111,4,5,0),t(188304,1,4,0),t(188498,2,5,0),t(188691,0,4,0),
  t(188885,1,4,0),t(188982,2,5,0),t(189079,1,4,0),t(189272,0,4,0),
  t(189466,1,4,0),t(189659,5,4,0),t(189853,3,4,0),t(190046,5,5,0),
  t(190143,3,4,0),t(190240,6,4,0),t(190433,5,4,0),t(190627,2,5,0),
  t(190820,5,4,0),t(191014,5,5,0),t(191207,1,4,0),t(191401,5,4,0),
  t(191595,1,3,0),t(191595,7,3,0),t(191788,5,5,0),t(191982,4,5,0),
  t(192078,2,5,0),t(192175,5,4,0),t(192369,7,3,0),t(192562,2,5,0),
  t(192756,5,5,0),f(192949,4,5),t(193336,3,4,0),t(193723,1,4,0),
  t(193917,0,5,0),t(194110,4,5,0),t(194304,1,4,0),f(194498,3,4),
  t(194885,0,4,0),t(195078,0,5,0),t(195272,0,4,0),t(195659,1,4,0),
  t(196046,2,5,0),t(196239,0,4,0),t(196433,2,5,0),t(196626,0,8,0),
  t(196820,3,3,0),t(197013,0,4,0),f(197207,2,5),t(197594,1,3,0),
  t(197788,0,3,0),t(197981,5,3,0),t(198175,1,3,0),t(198562,0,4,0),
  t(198562,7,3,0),t(198755,0,5,0),t(199142,0,5,0),h(199723,0,5,201271,0,[[199723,0,5],[200110,1,3],[200497,2,1],[200884,1,3],[201271,0,5]]),
  t(200110,2,5,0),t(200304,6,4,0),t(200497,6,4,0),t(200691,5,5,0),
  t(200884,2,5,0),t(201465,4,5,0),t(201658,6,4,0),h(201852,5,4,202626),
  f(202239,1,4),t(202820,2,5,0),t(203013,4,5,0),t(203110,6,4,0),
  t(203207,4,5,0),t(203400,0,5,0),s(203594,204368,[[203594,1.5,3],[203787,0.5,3],[203981,0,3],[204174,0,3],[204368,2,3]]),t(204561,5,4,0),
  t(204755,0,5,0),t(204948,2,5,0),t(205336,0,4,0),s(205529,206593,[[205529,2,3],[205723,1.5,3],[205916,2,3],[206110,2,3],[206303,3,3],[206497,4,3],[206593,4,3]]),
  t(206110,1,4,0),t(206884,0,5,0),t(207077,0,5,0),t(207271,0,4,0),
  t(207464,2,5,0),t(207658,1,4,0),t(207851,4,5,0),f(208045,5,5),
  t(208432,0,4,0),t(208432,7,3,0),t(208626,4,5,0),t(208819,1,4,0),
  t(209013,2,5,0),s(209206,210754,[[209206,1.5,3],[209497,1.5,3],[209787,1,3],[210077,0,3],[210367,0,3],[210658,0,3],[210754,0,3]]),t(209593,3,4,4),t(209980,5,3,0),
  t(210367,1,4,0),t(210948,5,3,0),t(211142,3,4,0),t(211529,6,4,0),
  t(211916,5,5,0),t(212109,4,5,0),t(212303,2,5,0),t(212496,3,4,0),
  s(212690,213851,[[212690,1.5,3],[212883,1.5,3],[213077,1.5,3],[213270,4,3],[213464,1.5,3],[213658,1.5,3],[213851,1.5,3]],1),t(213077,0,4,0),t(213367,1,4,0),f(213464,0,4),
  t(214238,1,8,0),t(214432,0,5,0),t(214625,5,4,0),t(215012,1,4,0),
  t(215206,3,3,0),t(215399,4,5,0),t(215593,5,5,0),t(215786,4,5,0),
  t(216173,3,3,0),t(216367,1,4,0),t(216561,0,4,0),t(216754,0,4,0),
  t(216948,1,4,0),t(217141,0,4,0),t(217141,7,3,0),t(217335,3,4,0),
  t(217528,1,4,0),t(217722,5,4,0),t(217915,1,4,0),f(218109,3,4),
  t(218496,5,4,0),t(218689,5,5,0),t(218883,5,3,0),t(219270,1,4,0),
  t(219657,3,4,0),t(220044,0,4,0),t(220431,2,5,0),t(220818,4,5,0),
  h(221012,4,1,221592,1,[[221012,4,1],[221302,3,3],[221592,2,5]]),t(221980,6,4,0),t(222560,4,5,0),f(222754,6,4),
  s(223141,224689,[[223141,2,3],[223431,2,3],[223721,2,3],[224012,2,3],[224302,2,3],[224592,2,3],[224689,2,3]],1),t(223721,2,3,0),t(223915,5,4,0),t(224302,5,4,0),
  t(225076,6,4,0),t(225270,6,4,0),t(225463,1,4,0),t(225850,6,4,0),
  t(226237,1,4,0),t(226624,6,4,0),t(227011,1,4,0),t(227398,6,4,0),
  t(227786,0,4,0),t(227786,7,3,0),s(229431,230979,[[229431,1.5,3],[229721,1.5,3],[230011,1.5,3],[230302,1.5,3],[230592,1.5,3],[230882,4,3],[230979,1.5,3]]),t(230011,0,3,0),
  t(230495,0,4,0),f(231269,0,4),t(231850,0,5,0),t(232043,1,4,0),
  t(232140,0,5,0),t(233592,1,4,0),t(233785,4,5,0),t(233882,2,5,0),
  t(234366,6,4,0),t(235237,2,8,0),t(236108,5,3,0),t(236495,7,3,0),
  t(236882,5,3,0),t(236978,3,4,0),t(237172,2,5,0),t(237946,5,5,0),
  t(238527,1,4,0),f(239011,3,4),t(239398,5,4,0),t(239494,5,5,0),
  t(239591,5,4,0),t(239785,6,4,0),t(240849,4,5,0),t(241623,6,4,0),
  h(241720,5,5,243268,0,[[241720,5,5],[242107,5,4],[242494,6,3],[242881,6,2],[243268,7,1]]),t(242591,3,3,0),t(242688,4,3,0),t(242785,3,4,0),
  t(243462,7,3,0),t(243946,0,4,0),t(243946,7,3,0),t(244236,3,4,0),
  t(244623,5,3,0),t(244720,6,4,0),t(244913,5,5,0),t(245300,5,5,0),
  f(245688,5,5),t(246075,5,5,0),t(246171,4,5,0),t(246462,7,3,0),
  t(246558,5,3,0),t(247720,5,5,0),t(248204,4,5,0),t(248494,2,5,0),
  t(248784,4,5,0),t(248978,5,5,0),t(250332,2,5,0),t(250429,1,4,0),
  t(250526,2,5,0),t(250816,0,4,0),t(250913,4,5,0),t(251300,2,5,0),
  t(251687,0,5,0),t(252365,0,4,0),f(252461,4,5),t(253139,3,4,0),
  t(253622,0,5,0),t(253913,0,4,0),t(254010,0,5,0),t(254203,0,4,0),
  t(255558,0,5,0),t(255945,0,4,0),t(255945,7,3,0),t(256913,0,5,0),
  t(257106,2,5,0),t(257783,4,5,0),t(258074,5,5,0),t(258558,4,5,0),
  t(258848,2,5,0),t(259041,4,5,0),t(259332,2,8,0),t(260299,3,4,0),
  f(260396,6,4),
// </eiki-boss-v3-expert-notes>
])(mhTap,mhHoldV2,mhFlick,mhSlideV2);
const eikiBossMasterNotes=((t,h,f,s)=>[
// <eiki-boss-v3-master-notes>
  t(1930,0,6,0),t(2124,1,4,0),t(2124,7,3,0),f(2317,5,4),
  t(3962,3,3,0),t(4156,7,3,0),t(5414,5,3,0),t(5801,6,4,0),
  t(5994,5,3,0),t(6091,6,4,0),t(6865,3,4,0),t(7059,5,4,0),
  t(7156,3,3,0),h(7930,2,1,8510,1,[[7930,2,1],[8220,1,3],[8510,1,4]]),s(8897,9478,[[8897,1.5,2],[9091,0.5,2],[9285,1.5,2],[9478,3,2]]),t(9672,1,4,0),
  t(9865,1,3,0),t(10059,5,4,0),t(10155,1,4,0),t(10252,5,3,0),
  f(11026,1,3),s(11413,12671,[[11413,2,2],[11607,2,2],[11801,3,2],[11994,4,2],[12188,4,2],[12381,4,2],[12575,3,2],[12671,3,2]]),t(12188,5,3,0),t(12768,8,2,0),
  s(12962,14510,[[12962,3,2],[13252,4,2],[13542,4,2],[13833,4,2],[14123,3.5,2],[14413,4,2],[14510,4,2]]),t(13349,1,4,0),t(13736,5,3,0),t(14123,1,3,0),
  t(14704,0,4,0),t(14704,6,3,0),t(14897,1,4,0),t(15478,4,1,0),
  h(15671,1,4,17219),t(16832,0,1,0),t(17316,0,3,0),h(18961,2,2,19445),
  h(19735,3,3,20413),t(20606,3,4,0),t(20800,5,4,0),f(20993,1,4),
  t(22348,6,4,0),t(23026,5,4,0),t(23413,3,4,0),s(23800,24380,[[23800,1.5,2],[23993,1,2],[24187,0,2],[24380,0,2]]),
  t(24574,0,4,0),t(25348,5,4,0),t(25445,1,4,0),t(25735,3,4,0),
  t(26509,0,1,0),t(27380,1,4,0),h(27477,3,4,28348),t(28832,1,3,0),
  t(29025,5,4,0),t(29025,0,3,0),s(29606,30380,[[29606,0.5,2],[29896,0.5,2],[30186,3,2],[30380,4,2]]),f(29993,6,4),
  t(31154,0,4,0),t(31348,3,4,0),t(31541,0,6,0),t(31928,5,4,0),
  t(32702,3,4,0),h(33476,8,2,34347),h(34638,2,2,35702),t(35315,0,2,0),
  t(35992,3,4,0),t(36476,7,3,0),t(37541,3,4,0),t(37637,3,4,0),
  t(38702,5,4,0),t(38799,3,4,0),t(39089,1,4,0),f(39670,0,3),
  t(40057,1,3,0),t(40444,3,3,0),t(41218,5,3,0),t(41508,6,4,0),
  t(41508,1,3,0),s(41798,42379,[[41798,3,2],[41992,3,2],[42185,2,2],[42379,0.5,2]],1),t(43153,1,3,0),t(43540,3,3,0),
  t(43927,5,3,0),t(44701,6,4,0),t(45089,5,4,0),t(45282,3,4,0),
  t(45476,0,3,0),t(45863,3,3,1),h(46250,1,4,47121),f(46637,5,3),
  t(47411,3,3,0),h(47604,6,4,48379,1,[[47604,6,4],[47992,7,3],[48379,8,1]]),t(49153,5,4,0),h(50508,3,4,51765),
  t(51185,7,3,0),h(52153,5,4,52733),t(52830,4,1,0),t(52927,1,4,0),
  t(53314,0,4,0),t(54088,1,4,0),t(54475,3,3,0),t(54862,5,3,0),
  t(54959,3,3,0),t(55346,1,3,0),t(55346,6,3,0),t(55926,0,4,0),
  s(56217,57088,[[56217,1.5,2],[56410,1.5,2],[56604,2,2],[56797,3,2],[56991,3.5,2],[57088,3.5,2]]),f(56701,0,4),t(57281,1,4,0),t(57475,4,1,0),
  t(57572,5,4,0),t(57765,6,4,0),t(58055,3,3,0),t(58249,6,1,0),
  t(58733,3,4,0),t(58830,0,3,0),s(59313,59991,[[59313,3,2],[59507,2.5,2],[59700,4,2],[59894,4,2],[59991,2.5,2]]),t(60087,2,6,0),
  t(60281,1,4,0),h(60571,0,1,61249,1),t(61636,2,2,0),t(62507,0,3,0),
  t(62894,1,3,0),f(63087,3,3),t(63474,5,4,0),t(64055,3,3,0),
  t(64248,1,3,0),t(64248,6,3,0),h(64829,0,3,65603,1),s(65990,67539,[[65990,1.5,2],[66281,1.5,2],[66571,0,2],[66861,1.5,2],[67152,1.5,2],[67442,1,2],[67539,1.5,2]]),
  t(66377,3,4,0),t(66571,1,4,0),t(66764,4,4,0),t(67152,3,4,0),
  t(67732,1,2,0),t(67732,5,2,0),t(67926,4,2,0),t(67926,8,2,0),
  t(68119,1,2,0),t(68119,5,2,0),t(68313,4,2,0),t(68313,8,2,0),
  t(68506,4,2,0),h(68893,7,1,69861,0,[[68893,7,1],[69184,6,3],[69571,6,3],[69861,7,1]]),f(70151,4,2),t(70538,5,3,0),
  t(70635,3,4,0),t(71409,2,1,0),t(72087,0,2,0),t(72087,4,2,0),
  t(72474,1,2,0),t(72474,5,2,0),t(72861,3,2,0),t(72861,7,2,0),
  t(73248,4,2,0),t(73248,8,2,0),t(73635,1,3,0),t(74022,2,3,0),
  t(74022,7,3,0),t(74216,5,4,0),t(74312,3,4,0),h(74409,3,4,74990),
  t(75086,0,3,0),t(75183,1,3,0),t(75377,1,4,0),t(75570,1,3,0),
  f(75764,1,4),t(76344,3,4,0),t(76441,7,3,0),t(76635,5,3,0),
  t(77119,1,3,0),t(77215,0,3,0),t(77312,5,4,0),t(77699,7,2,0),
  t(77796,5,3,0),t(78183,4,1,0),t(78280,1,3,0),t(78570,0,6,0),
  t(78957,3,3,0),t(79247,6,2,0),t(79344,3,3,0),h(79635,1,4,80409,0,[[79635,1,4],[80022,3,1],[80409,1,4]]),
  f(80022,5,2),t(80602,5,4,0),t(80699,6,4,0),t(81183,5,4,0),
  t(81183,0,3,0),t(81667,3,3,0),t(82054,5,3,0),t(82247,1,4,0),
  t(83021,3,3,0),t(83118,6,1,0),h(83505,8,2,83989),t(84183,3,4,0),
  t(84376,7,3,0),t(84570,1,4,0),f(84957,5,4),t(85344,2,2,0),
  t(85344,6,2,0),t(85537,2,2,0),t(85537,7,2,0),t(85731,1,2,0),
  t(85731,8,2,0),t(85924,0,2,0),t(85924,8,2,0),t(86118,7,3,0),
  t(86311,5,3,0),t(86505,1,4,0),t(86699,3,4,0),t(86892,5,3,0),
  t(87086,8,2,0),t(87279,5,3,0),t(87279,0,3,0),t(87666,3,4,0),
  t(88053,1,3,0),t(88247,3,4,0),t(88537,5,3,0),t(88634,3,4,0),
  t(88924,0,3,0),s(89021,90472,[[89021,1.5,2],[89311,0.5,2],[89602,1,2],[89892,2.5,2],[90182,3,2],[90472,3,2]]),t(89505,4,2,0),f(89795,4,4),
  t(90569,6,2,0),s(92118,93666,[[92118,1.5,2],[92408,1,2],[92698,2,2],[92988,2.5,2],[93279,1.5,2],[93569,0,2],[93666,0,2]],1),t(92795,2,3,0),t(93085,5,4,0),
  t(93182,6,4,0),s(94150,95698,[[94150,2,2],[94440,1,2],[94730,2,2],[95021,3,2],[95311,3,2],[95601,3,2],[95698,3,2]]),t(94827,5,4,0),t(94924,6,4,0),
  t(95021,4,3,0),t(95795,3,4,0),t(96182,5,3,0),t(96279,3,3,0),
  f(96569,1,3),t(96956,0,3,0),t(96956,5,3,0),t(97343,1,3,0),
  t(98117,0,4,0),t(98214,1,4,0),t(98504,0,3,0),t(98891,2,6,0),
  t(99182,0,4,0),t(99278,3,3,0),t(99569,5,4,0),t(99665,2,4,0),
  t(100052,1,3,0),t(100440,0,4,0),t(100827,1,3,0),h(101310,6,4,102472,1),
  f(103149,6,2),t(104117,0,2,0),t(104117,4,2,0),t(104504,4,2,0),
  t(104504,8,2,0),t(104891,0,2,0),t(104891,4,2,0),t(105278,4,2,0),
  t(105278,8,2,0),t(105665,3,3,0),s(106246,107020,[[106246,0,2],[106536,1,2],[106826,3.5,2],[107020,4,2]]),t(106633,1,4,2),
  t(107213,3,4,0),h(107794,6,2,108471),t(108568,6,4,0),t(109149,6,2,0),
  t(109149,2,2,0),t(109536,3,4,0),t(109923,2,2,0),s(110116,111665,[[110116,3,2],[110407,0.5,2],[110697,0.5,2],[110987,0.5,2],[111277,0.5,2],[111568,0.5,2],[111665,1,2]]),
  t(110503,2,3,0),f(111084,3,3),t(111858,0,3,0),t(112052,1,3,0),
  t(113019,6,2,0),t(113213,3,4,0),t(113406,1,3,0),t(113987,0,4,0),
  h(115535,1,4,116116),t(116309,3,4,0),t(118051,1,4,0),h(118148,5,3,118922),
  t(119019,0,4,0),h(119406,2,2,120567,1),t(119793,0,2,0),t(119987,5,3,0),
  t(120083,6,3,0),t(121148,1,3,0),f(121245,5,4),t(121632,1,4,0),
  t(121632,7,3,0),t(122309,7,3,0),t(122503,5,4,0),t(123180,5,3,0),
  t(123567,6,4,0),t(123954,6,4,0),h(124341,5,4,124922),t(125018,4,2,0),
  f(125115,6,2),t(125502,6,4,0),t(125696,5,3,0),t(125889,0,6,0),
  t(126180,3,3,0),t(126470,0,3,0),t(126664,1,4,0),t(126857,3,3,0),
  t(127051,5,3,0),t(127147,7,2,0),t(127438,5,4,0),t(127534,3,3,0),
  t(127631,1,4,0),t(127825,0,4,0),t(128115,2,3,0),t(128115,7,3,0),
  t(128405,1,4,0),h(128502,1,1,129179,0,[[128502,1,1],[128889,0,3],[129179,0,4]]),t(129276,1,3,0),t(129373,0,4,0),
  t(129663,3,4,0),t(129857,0,3,0),t(130147,3,3,0),t(130341,5,3,0),
  t(130437,4,3,0),t(130728,0,3,0),t(130825,1,3,0),t(131115,3,3,0),
  t(131212,5,3,0),f(131502,6,4),t(131889,5,4,0),t(131986,6,4,0),
  t(132179,5,3,0),t(132276,3,4,0),t(132760,6,2,0),t(133147,1,4,0),
  t(133244,3,3,0),t(133437,0,4,0),t(133631,0,4,0),t(133631,6,3,0),
  t(133824,1,2,0),t(134018,3,4,0),t(134115,2,3,0),f(134211,3,4),
  t(134598,8,2,0),h(134889,5,3,135663),t(135760,6,4,0),t(136147,5,4,0),
  t(136244,4,2,0),h(136534,5,4,137405,1),t(138082,6,4,0),t(138179,3,3,0),
  t(138469,6,2,0),t(138566,1,4,0),t(138663,0,3,0),f(138953,3,3),
  t(139630,6,2,0),t(139824,8,2,0),t(140695,5,3,0),t(141953,2,2,0),
  t(142243,4,6,0),t(142630,3,3,0),t(143017,7,3,0),t(143017,2,3,0),
  t(143308,5,3,0),t(143404,3,4,0),t(143791,1,4,0),t(144082,0,3,0),
  t(144178,5,3,0),t(144469,1,3,0),t(144566,3,3,0),t(144953,0,3,0),
  f(145340,1,3),h(145727,5,3,146501,1),t(146888,5,4,0),h(147178,6,4,147856,0,[[147178,6,4],[147565,7,3],[147856,8,1]]),
  t(148049,1,4,0),t(148436,3,3,0),t(148630,6,2,0),t(148727,1,2,0),
  t(148823,3,3,0),s(149017,149791,[[149017,0,2],[149307,0.5,2],[149597,2.5,2],[149791,4,2]]),t(149404,7,3,0),t(149984,5,3,0),
  t(150372,3,4,0),t(150565,6,4,0),t(150565,1,3,0),s(150759,152113,[[150759,3,2],[150952,2.5,2],[151146,2.5,2],[151339,2.5,2],[151533,1.5,2],[151726,1.5,2],[151920,0.5,2],[152113,0.5,2]]),
  t(151146,1,3,0),t(151339,3,4,0),f(151533,0,4),t(152307,0,2,0),
  t(152307,4,2,0),t(152694,1,2,0),t(152694,5,2,0),t(153081,3,2,0),
  t(153081,7,2,0),t(153468,4,2,0),t(153468,8,2,0),h(153855,1,3,155403,1),
  t(154242,5,3,0),t(155016,3,3,0),h(155791,7,3,157339,1),t(156178,3,3,0),
  t(156565,1,3,0),t(156952,0,3,3),h(157726,1,3,158306,1),t(158887,3,4,0),
  t(159274,5,4,0),f(159661,1,3),t(160629,0,4,0),t(160822,1,4,0),
  t(161210,3,4,0),t(161984,1,4,0),t(162371,3,4,0),t(162758,5,3,0),
  t(162758,0,3,0),t(163145,3,3,0),t(163532,1,4,0),t(163919,2,6,0),
  t(164306,5,4,0),t(165080,1,4,0),t(165467,3,4,0),t(165854,5,3,0),
  t(166048,6,4,0),s(167403,168951,[[167403,1.5,2],[167693,3,2],[167983,3.5,2],[168274,3.5,2],[168564,4,2],[168854,4,2],[168951,4,2]],1),f(167790,4,3),t(168177,1,3,0),
  t(168564,6,3,0),h(169338,3,1,170886,1,[[169338,3,1],[169725,2,3],[170112,1,4],[170499,2,3],[170886,3,1]]),t(170112,0,2,0),t(170499,1,3,0),
  t(171467,0,4,0),t(171660,0,4,0),t(172241,0,4,0),t(172435,0,4,0),
  t(173015,1,4,0),t(173209,5,3,0),t(173596,4,3,0),t(173789,1,4,0),
  t(173789,7,3,0),f(173983,3,4),t(174370,5,4,0),t(174563,8,2,0),
  t(174660,3,4,0),t(174757,2,3,0),t(174951,0,4,0),t(175144,1,4,0),
  t(175338,5,4,0),h(175531,3,4,176112),t(176305,5,3,0),t(176499,6,4,0),
  t(176692,5,3,0),h(176886,6,4,177660,0,[[176886,6,4],[177273,8,1],[177660,6,4]]),t(177273,5,4,0),t(177854,2,2,0),
  t(177854,6,2,0),t(178047,2,2,0),t(178047,7,2,0),t(178241,1,2,0),
  t(178241,8,2,0),t(178434,0,2,0),t(178434,8,2,0),t(178628,3,3,0),
  t(178821,0,3,0),t(179015,1,3,0),t(179208,3,4,0),f(179402,1,3),
  t(179789,0,3,0),t(179789,5,3,0),t(179982,5,4,0),t(180176,3,3,0),
  t(180369,1,2,0),t(180369,5,2,0),t(180563,4,2,0),t(180563,8,2,0),
  t(180757,1,2,0),t(180757,5,2,0),t(180950,4,2,0),t(180950,8,2,0),
  t(181144,6,4,0),t(181337,6,2,0),t(181531,6,4,0),t(181627,4,6,0),
  t(181724,4,2,0),t(181918,1,4,0),t(182111,3,3,0),t(182305,1,4,0),
  f(182498,3,4),t(182885,5,3,0),t(183079,6,4,0),t(183176,5,4,0),
  t(183273,3,3,0),t(183563,1,4,0),t(183660,4,2,0),t(183853,1,4,0),
  t(184047,2,3,0),t(184047,7,3,0),t(184337,5,4,0),t(184434,1,3,0),
  t(184627,5,4,0),f(184821,3,4),t(185401,6,4,0),t(185595,5,4,0),
  t(185982,3,4,0),t(186369,1,4,0),t(186659,0,3,0),t(186756,3,3,0),
  t(186950,1,3,0),t(187143,0,3,0),t(187337,1,4,0),t(187434,0,3,0),
  t(187530,1,4,0),s(187724,188401,[[187724,2,2],[187917,0,2],[188111,0,2],[188304,0,2],[188401,0,2]]),t(188498,1,4,0),t(188691,3,3,0),
  t(188885,5,3,0),t(188982,3,4,0),t(189079,1,3,0),t(189175,5,3,0),
  t(189272,3,3,0),t(189466,1,3,0),t(189466,6,3,0),t(189659,0,3,0),
  t(189853,3,3,0),t(190046,5,4,0),t(190143,7,3,0),t(190240,3,3,0),
  t(190433,0,2,0),t(190433,4,2,0),t(190627,1,2,0),t(190627,5,2,0),
  t(190820,3,2,0),t(190820,7,2,0),t(191014,4,2,0),t(191014,8,2,0),
  t(191207,3,3,0),t(191304,6,3,0),t(191401,7,3,0),t(191595,6,2,0),
  t(191788,3,4,0),t(191982,1,4,0),t(192078,2,6,0),t(192175,5,3,0),
  t(192369,4,2,0),t(192562,6,4,0),t(192756,3,4,0),t(192949,0,4,0),
  t(193143,2,2,0),t(193143,6,2,0),f(193336,3,3),t(193723,2,2,0),
  t(193723,6,2,0),t(193917,2,2,0),t(193917,7,2,0),t(194110,1,2,0),
  t(194110,8,2,0),t(194304,0,2,0),t(194304,8,2,0),t(194498,5,3,0),
  t(194691,2,2,0),t(194885,3,3,0),t(195078,5,4,0),t(195272,7,3,0),
  t(195465,5,4,0),f(195659,1,3),t(196046,3,4,0),t(196239,1,2,0),
  t(196239,5,2,0),t(196433,4,2,0),t(196433,8,2,0),t(196626,1,2,0),
  t(196626,5,2,0),t(196820,4,2,0),t(196820,8,2,0),t(197013,3,3,0),
  f(197207,6,4),t(197594,6,2,0),t(197788,4,2,0),t(197981,6,2,0),
  f(198175,4,2),t(198562,5,3,0),t(198562,0,3,0),t(198755,6,4,0),
  t(199142,3,4,0),t(199433,5,3,0),t(199723,4,2,0),h(199820,8,1,201271,0,[[199820,8,1],[200207,6,4],[200594,8,1],[200884,6,4],[201271,8,1]]),
  t(200304,6,1,0),t(200497,5,3,0),t(200691,5,4,0),t(200884,6,4,0),
  t(201465,1,4,0),t(201658,5,3,0),h(201852,4,1,202626,0,[[201852,4,1],[202239,3,3],[202626,3,4]]),f(202239,7,3),
  t(202820,5,4,0),t(203013,3,4,0),t(203110,0,3,0),t(203207,0,4,0),
  t(203400,1,4,0),s(203594,204368,[[203594,2,2],[203787,1.5,2],[203981,0.5,2],[204174,0.5,2],[204368,3,2]]),t(204561,7,3,0),t(204755,5,4,0),
  t(204948,3,4,0),t(205142,1,3,0),t(205142,6,3,0),t(205336,0,3,0),
  s(205529,206593,[[205529,3,2],[205723,2,2],[205916,2.5,2],[206110,2.5,2],[206303,3.5,2],[206497,4,2],[206593,4,2]]),f(206110,3,3),t(206690,0,6,0),t(206884,0,4,0),
  t(207077,5,4,0),t(207271,3,3,0),t(207464,1,4,0),t(207658,0,3,0),
  t(207851,5,4,0),t(208045,1,4,0),t(208239,3,3,0),t(208432,0,3,0),
  t(208626,5,4,0),t(208819,3,3,0),t(209013,1,4,0),s(209206,210754,[[209206,1.5,2],[209497,1.5,2],[209787,1,2],[210077,0,2],[210367,0,2],[210658,0,2],[210754,0,2]]),
  t(209593,5,3,4),t(209980,4,2,0),t(210367,1,3,0),t(210948,0,2,0),
  t(211142,1,3,0),t(211238,2,3,0),f(211529,5,3),t(211916,6,4,0),
  t(211916,1,3,0),t(212109,5,4,0),t(212303,6,4,0),t(212496,5,3,0),
  s(212690,213851,[[212690,1.5,2],[212883,1.5,2],[213077,1.5,2],[213270,4,2],[213464,1.5,2],[213658,1.5,2],[213851,1.5,2]]),t(213077,4,3,0),t(213367,0,3,0),t(213464,1,3,0),
  t(214045,0,3,0),t(214238,1,4,0),t(214432,3,4,0),t(214625,0,3,0),
  t(214819,3,4,0),t(215012,5,3,0),t(215206,4,2,0),t(215399,1,4,0),
  t(215593,0,4,0),f(215786,5,4),t(216173,4,2,0),t(216367,1,3,0),
  t(216561,0,3,0),t(216754,0,3,0),t(216948,1,3,0),t(216948,6,3,0),
  t(217141,0,3,0),t(217335,3,3,0),t(217528,1,3,0),t(217722,5,3,0),
  t(217915,7,3,0),t(218109,3,3,0),t(218302,0,3,0),t(218496,5,3,0),
  t(218689,2,6,0),f(218883,2,2),t(219270,0,3,0),t(219464,5,4,0),
  t(219657,1,3,0),t(220044,3,3,0),t(220238,0,4,0),t(220431,3,4,0),
  t(220818,1,4,0),h(221012,0,4,221592,0,[[221012,0,4],[221302,1,3],[221592,2,1]]),t(221786,1,4,0),t(221980,3,3,0),
  t(222560,6,4,0),t(222560,1,3,0),f(222754,5,3),s(223141,224689,[[223141,3,2],[223431,3,2],[223721,3,2],[224012,3,2],[224302,3,2],[224592,3,2],[224689,3,2]],1),
  t(223721,8,2,0),t(223915,7,3,0),t(224302,7,3,0),t(225076,5,3,0),
  t(225270,5,3,0),t(225463,7,3,0),t(225850,7,3,0),t(226044,1,3,0),
  t(226237,3,3,0),t(226624,5,3,0),t(227011,7,3,0),t(227398,3,3,0),
  t(227786,7,3,0),s(229431,230979,[[229431,3,2],[229721,3,2],[230011,3,2],[230302,3,2],[230592,3,2],[230882,4,2],[230979,3,2]]),t(230011,8,2,0),f(230495,7,3),
  t(231269,7,3,0),t(231850,5,4,0),t(232043,7,3,0),t(232140,5,4,0),
  t(233592,5,3,0),t(233688,6,4,0),t(233785,5,4,0),t(233882,6,4,0),
  t(234269,3,4,0),t(234366,7,3,0),t(235237,6,4,0),t(235237,1,3,0),
  t(236108,2,2,0),t(236495,6,2,0),t(236978,3,3,0),f(237172,6,4),
  t(237559,1,4,0),t(237946,3,4,0),t(238333,5,4,0),t(238527,7,3,0),
  t(239011,5,3,0),t(239398,7,3,0),t(239494,5,4,0),t(239591,7,3,0),
  t(239785,5,3,0),t(240849,2,6,0),t(241236,6,4,0),t(241623,3,3,0),
  h(241720,8,1,243268,0,[[241720,8,1],[242107,7,3],[242494,6,4],[242881,7,3],[243268,8,1]]),t(242591,6,2,0),t(242688,4,2,0),f(242785,5,3),
  t(243462,4,2,0),t(243462,8,2,0),t(243946,0,3,0),t(244236,1,3,0),
  t(244623,0,2,0),t(244720,1,3,0),t(244913,0,4,0),t(245300,0,4,0),
  t(245688,0,4,0),t(246075,0,4,0),t(246171,0,4,0),t(246462,4,2,0),
  t(246558,0,2,0),t(247720,5,4,0),t(248204,3,4,0),t(248494,1,4,0),
  t(248784,0,4,0),t(248978,0,4,0),t(249171,1,4,0),f(249365,3,4),
  t(250332,1,4,0),t(250429,0,3,0),t(250526,1,4,0),t(250816,3,3,0),
  t(250913,4,4,0),t(251203,1,3,0),t(251300,3,4,0),t(251687,0,4,0),
  t(251687,6,3,0),t(252365,1,3,0),t(252461,3,4,0),f(253139,5,3),
  t(253622,6,4,0),t(253816,3,4,0),t(253913,2,3,0),t(254010,0,4,0),
  t(254203,1,3,0),t(255558,3,4,0),t(255945,0,3,0),t(256913,0,4,0),
  t(257106,1,4,0),t(257783,3,4,0),t(258074,1,4,0),t(258558,0,4,0),
  t(258654,1,4,0),t(258848,3,4,0),t(259041,5,4,0),t(259332,1,4,0),
  t(259332,7,3,0),t(259622,4,6,0),f(260299,7,3),
// </eiki-boss-v3-master-notes>
])(mhTap,mhHoldV2,mhFlick,mhSlideV2);
const eikiBossCharts=Object.freeze({
  EASY:mhChart(1,eikiBossEasyNotes,EIKI_BOSS_DURATION_MS),
  NORMAL:mhChart(3,eikiBossNormalNotes,EIKI_BOSS_DURATION_MS),
  HARD:mhChart(5,eikiBossHardNotes,EIKI_BOSS_DURATION_MS),
  EXPERT:mhChart(7,eikiBossExpertNotes,EIKI_BOSS_DURATION_MS),
  MASTER:mhChart(9,eikiBossMasterNotes,EIKI_BOSS_DURATION_MS),
});

// MF × ICHIKA MIX（元「あつ杯テーマ」）。先行公開の1曲。譜面はV3パイプラインが入れる。
const ATSU_CUP_THEME_V3_DURATION_MS=144640;
const atsuCupThemeV3EasyNotes=((t,h,f,s)=>[
// <atsu-cup-theme-v3-easy-notes>
  t(2525,0,10,0),t(3235,2,6,0),t(3590,0,6,0),t(5010,0,3,0),
  t(5010,7,3,0),t(5365,4,6,0),t(5898,6,4,0),t(6253,5,4,0),
  t(6431,2,6,0),t(6786,1,4,0),t(7318,3,4,0),t(7851,5,4,0),
  t(8028,5,4,0),t(9271,6,4,0),t(9448,6,4,0),t(11401,5,4,0),
  h(12644,7,3,13265,0,[[12644,7,3],[12999,6,4],[13265,4,6]]),t(13709,5,4,0),t(14419,6,4,0),t(15129,5,4,0),
  t(15306,6,4,0),t(15839,5,4,0),t(17081,3,4,0),t(18324,1,4,0),
  t(20809,0,4,0),t(21164,1,4,0),h(22052,0,4,23383),t(26312,1,4,0),
  t(26845,3,4,0),t(28442,1,4,0),t(29152,1,4,0),t(30040,0,4,0),
  t(30395,1,4,0),t(31638,0,4,1),t(32525,1,4,0),t(33413,0,4,0),
  t(33590,1,4,0),t(34123,3,4,0),t(35188,5,4,0),t(36431,6,4,0),
  t(37673,5,4,0),t(38738,0,3,0),t(38738,7,3,0),t(39093,1,4,0),
  t(39271,0,4,0),h(41401,1,4,42377),t(45839,0,10,0),t(46016,2,6,0),
  t(46549,5,4,0),t(47081,4,6,0),t(47436,3,4,0),h(47969,5,4,48502),
  h(49212,6,4,49567),t(51164,5,4,0),t(51519,5,4,0),t(53294,3,4,0),
  t(53472,5,4,0),t(56490,3,4,0),t(56667,5,4,0),t(57022,3,4,0),
  t(58087,0,6,0),t(58620,1,4,2),t(60395,3,4,0),t(61105,1,4,0),
  h(62170,0,6,63235,0,[[62170,0,6],[62525,0,4],[62880,0,4],[63235,1,3]]),t(63590,1,4,0),t(63768,1,4,0),t(64123,3,4,0),
  t(64655,3,4,0),t(65543,1,4,0),t(66253,3,4,0),t(66431,5,4,0),
  t(68028,6,4,0),t(69448,5,4,0),t(69981,6,4,0),h(70336,5,4,71046),
  t(71933,0,10,0),t(72466,4,6,0),t(73886,7,3,0),t(73886,0,3,0),
  t(74241,6,4,0),t(76194,3,4,0),t(76371,5,4,0),t(77081,6,4,0),
  t(78502,4,6,0),t(79212,5,4,0),t(80454,6,4,0),t(81519,5,4,0),
  t(82229,6,4,0),t(83117,4,6,0),t(83294,3,4,0),t(83827,0,6,0),
  t(84005,0,6,0),t(85247,0,6,0),t(85425,0,6,0),t(85957,0,6,0),
  t(86667,0,6,3),t(87377,2,6,0),t(87732,4,6,0),t(88265,4,6,0),
  t(89330,5,4,0),t(89507,3,4,0),t(90040,1,4,0),t(90573,2,6,0),
  t(91105,5,4,0),h(91283,7,3,91815,0,[[91283,7,3],[91549,4,6],[91815,7,3]]),h(92348,4,6,93058),t(94123,0,10,0),
  t(94300,0,6,0),t(94655,0,6,0),t(95543,1,4,0),t(96253,0,3,0),
  t(96253,7,3,0),t(96608,4,6,0),t(96963,6,4,0),t(97496,5,4,0),
  t(98028,2,6,0),t(99093,0,6,0),t(99448,3,4,0),t(99626,5,4,0),
  t(99981,6,4,0),t(101046,5,4,0),t(101578,5,4,0),t(103354,6,4,0),
  t(104774,5,4,0),t(104951,4,6,0),h(105484,5,4,106016),h(106371,6,4,107348),
  t(108324,5,4,0),t(109034,4,6,0),t(109389,3,4,0),t(109744,5,4,0),
  t(110099,3,4,0),t(111164,1,4,0),t(111519,1,4,0),t(112584,0,4,0),
  t(112939,1,4,0),t(113472,3,4,0),h(113649,4,6,114360,0,[[113649,4,6],[114005,6,3],[114360,4,6]]),t(115425,6,4,4),
  t(115780,5,4,0),t(116490,3,4,0),t(116845,1,4,0),t(117555,0,4,0),
  t(117910,1,4,0),t(118087,0,4,0),t(119330,0,3,0),t(119330,7,3,0),
  t(119685,1,4,0),t(121460,0,4,0),t(121993,1,4,0),t(123590,0,4,0),
  t(123768,0,10,0),t(125365,0,4,0),t(125720,1,4,0),t(126431,3,4,0),
  t(126786,1,4,0),t(126963,0,4,0),t(128206,0,4,0),t(128916,1,4,0),
  t(129271,3,4,0),t(129626,5,4,0),t(129981,6,4,0),t(130336,3,4,0),
  t(130691,5,4,0),t(131046,3,4,0),t(131401,1,4,0),t(132111,0,6,0),
  t(132466,1,4,0),t(132644,0,6,0),t(133354,0,6,0),t(133531,0,4,0),
  t(134241,0,6,0),t(134774,0,6,0),h(135306,0,6,135750),t(138324,2,6,0),
  t(138857,1,4,0),t(139389,0,4,0),t(140277,0,10,0),t(140632,3,4,0),
  t(140987,0,3,0),t(140987,7,3,0),t(142229,3,4,0),t(142762,5,4,0),
  t(142939,6,4,0),
// </atsu-cup-theme-v3-easy-notes>
])(mhTap,mhHoldV2,mhFlick,mhSlideV2);
const atsuCupThemeV3NormalNotes=((t,h,f,s)=>[
// <atsu-cup-theme-v3-normal-notes>
  f(1815,1,4),t(2525,0,10,0),t(3235,4,6,0),t(3590,2,6,0),
  t(4833,0,6,0),t(5010,7,3,0),t(5010,0,3,0),t(5365,2,6,0),
  t(5898,6,4,0),t(6253,5,4,0),t(6431,2,6,0),t(6786,1,4,0),
  t(7318,3,3,0),t(7851,1,4,0),t(8028,5,4,0),t(9271,3,3,0),
  t(9448,0,4,0),t(11401,1,3,0),h(12644,1,2,13265,1,[[12644,1,2],[12999,0,4],[13265,0,6]]),t(13709,1,4,0),
  f(14419,3,4),t(15129,1,4,0),t(15306,3,4,0),t(15839,1,3,0),
  t(17081,0,4,0),t(18324,1,4,0),t(20809,0,4,0),t(21164,0,4,0),
  h(22052,1,3,23383),t(26312,3,4,0),t(26845,6,4,0),t(28442,5,4,0),
  t(29152,6,4,1),t(30040,3,4,0),t(30395,6,4,0),t(31638,5,4,0),
  f(32525,1,4),t(33235,5,3,0),t(33413,3,4,0),t(33590,7,3,0),
  t(34123,5,4,0),t(35188,6,4,0),t(36431,5,4,0),t(37673,6,4,0),
  t(38738,3,4,0),t(39093,5,4,0),t(39271,6,4,0),h(41401,5,4,42377),
  t(45484,7,3,0),t(45839,0,10,0),t(46016,4,6,0),t(46549,6,4,0),
  t(47081,2,6,0),f(47436,5,4),h(47969,0,6,48502,0,[[47969,0,6],[48235,1,4],[48502,2,2]]),h(49212,0,4,49567),
  t(51164,1,4,0),t(51519,1,4,0),t(52052,1,4,0),t(52407,1,3,0),
  t(53294,0,4,0),t(53472,1,4,0),t(56490,3,4,0),t(56667,5,3,0),
  t(56845,3,3,0),t(58087,0,6,0),t(58620,7,3,0),t(58620,0,3,0),
  t(60395,6,4,2),t(61105,5,4,0),h(62170,7,3,63235),t(63590,5,4,0),
  f(63768,5,4),t(64123,6,4,0),t(64655,6,4,0),t(65543,5,4,0),
  t(66253,3,4,0),t(66431,1,4,0),t(68028,0,4,0),t(68561,3,4,0),
  t(69448,5,4,0),t(69981,6,4,0),h(70336,6,2,71046,0,[[70336,6,2],[70691,4,6],[71046,6,2]]),t(71933,0,10,0),
  t(72466,4,6,0),t(73886,6,4,0),t(74241,6,4,0),t(76194,3,4,0),
  t(76371,6,4,0),f(77081,3,3),t(78502,0,6,0),t(79034,3,4,0),
  t(79212,7,3,0),t(79212,0,3,0),t(80454,6,4,0),t(81519,5,4,0),
  t(82229,6,4,0),t(83117,4,6,0),t(83294,1,3,0),t(83827,2,6,0),
  t(84005,0,6,0),t(84537,0,6,0),t(85247,0,6,0),t(85425,0,6,0),
  t(85957,0,6,3),t(86667,4,6,0),t(86845,3,4,0),f(87022,4,6),
  t(87377,4,6,0),t(87732,2,6,0),t(88265,0,6,0),t(89330,3,4,0),
  t(89507,1,4,0),t(89685,0,4,0),t(90040,1,4,0),t(90573,0,6,0),
  t(91105,1,4,0),h(91283,0,4,91815,1),h(92348,0,6,93058,0,[[92348,0,6],[92703,2,2],[93058,0,6]]),t(94123,0,6,0),
  t(94300,0,6,0),t(94655,0,10,0),t(95010,5,4,0),t(95543,7,3,0),
  t(95543,0,3,0),f(95720,5,4),t(96253,3,4,0),t(96608,0,6,0),
  t(97496,5,4,0),t(98028,2,6,0),t(98383,1,3,0),t(98561,0,6,0),
  t(99093,2,6,0),t(99448,5,3,0),t(99981,1,4,0),t(101046,0,3,0),
  t(101578,3,3,0),t(101756,0,3,0),t(103354,1,3,0),t(104419,3,3,0),
  t(104774,1,4,0),f(104951,0,6),h(105484,1,4,106016),h(106371,0,4,107348),
  t(108324,1,4,0),t(109034,2,6,0),t(109389,1,4,0),t(109744,5,4,0),
  t(110099,3,4,0),h(110632,6,4,111076),t(111164,5,4,0),t(111519,3,4,0),
  t(112052,1,4,0),t(112584,0,3,0),t(112584,7,3,0),t(112939,3,4,0),
  t(113472,5,4,0),h(113649,1,4,114360),t(114892,5,4,0),t(115070,1,4,0),
  f(115425,3,4),t(115780,0,4,4),t(116490,1,4,0),t(116845,3,4,0),
  t(117555,5,4,0),t(117910,3,4,0),t(118087,1,4,0),t(119330,0,4,0),
  t(119685,3,4,0),t(121460,5,4,0),t(121993,5,4,0),t(123590,3,3,0),
  t(123768,0,10,0),t(125365,1,4,0),t(125720,3,4,0),h(126076,5,4,126519),
  t(126786,6,4,0),t(126963,5,4,0),f(127141,1,4),t(127851,3,4,0),
  t(128206,0,4,0),t(128561,0,3,0),t(128561,7,3,0),t(128916,3,4,0),
  t(129271,5,4,0),t(129626,3,4,0),t(129981,1,4,0),t(130336,3,4,0),
  t(130691,5,4,0),t(131046,3,4,0),t(131401,1,4,0),t(131578,0,4,0),
  t(132111,0,6,0),t(132466,0,4,0),t(132644,0,6,0),f(132821,0,4),
  t(133354,2,6,0),t(133531,1,4,0),t(133709,4,6,0),t(134241,4,6,0),
  t(134774,4,6,0),h(135306,4,6,135750,1),t(138324,2,6,0),t(138857,5,4,0),
  t(139389,6,4,0),t(140277,0,10,0),t(140632,6,4,0),t(140987,5,4,0),
  t(141874,1,4,0),t(142229,5,4,0),t(142762,3,4,0),t(142939,6,4,0),
  f(143117,5,4),
// </atsu-cup-theme-v3-normal-notes>
])(mhTap,mhHoldV2,mhFlick,mhSlideV2);
const atsuCupThemeV3HardNotes=((t,h,f,s)=>[
// <atsu-cup-theme-v3-hard-notes>
  f(1815,0,4),t(2525,1,8,0),t(3235,0,5,0),t(3590,4,5,0),
  h(4123,2,5,4478),t(4567,6,4,0),t(5365,4,5,0),t(5632,6,4,0),
  t(5632,0,3,0),t(5898,1,4,0),t(6253,3,4,0),t(6431,4,5,0),
  t(6786,6,4,0),t(7318,5,3,0),t(7673,3,4,0),t(7851,1,4,0),
  t(8028,5,4,0),t(9182,3,4,0),t(9271,5,3,0),t(9448,6,4,0),
  t(11401,5,3,0),f(12200,6,4),h(12555,8,1,13265,1,[[12555,8,1],[12910,7,3],[13265,5,5]]),t(13620,1,4,0),
  t(13709,5,4,0),h(13975,3,4,14419),t(14507,6,4,0),t(15040,5,4,0),
  t(15129,1,4,0),t(15306,3,4,0),t(15395,0,4,0),t(15928,5,4,0),
  t(16460,1,4,0),t(16815,3,4,0),t(17081,0,4,0),t(17170,0,5,0),
  s(17525,18235,[[17525,3.5,3],[17791,2.5,3],[18058,1,3],[18235,0.5,3]]),t(18768,1,4,0),t(19478,3,4,0),f(19655,5,4),
  t(20188,5,5,0),t(20365,5,4,0),t(20809,3,4,0),t(21164,0,4,0),
  t(21164,7,3,0),t(21608,3,4,0),h(22052,5,3,23383),t(23561,3,4,0),
  t(23916,1,4,0),t(24448,0,8,0),t(25336,1,4,0),h(25868,5,4,26223),
  t(26312,3,4,0),t(26401,2,4,0),t(26845,0,4,0),t(27289,1,4,0),
  f(27821,5,4),t(28176,1,4,0),t(28442,3,4,0),t(28531,0,4,0),
  t(29596,1,4,0),t(29951,3,4,0),t(30040,1,4,0),t(30395,3,4,0),
  t(31638,1,4,1),t(32081,3,4,0),t(32525,5,4,0),t(33235,7,3,0),
  t(33413,5,4,0),t(33590,3,3,0),t(34123,1,4,0),h(34567,5,4,35720),
  h(36431,6,4,36874),h(37229,5,4,37762),f(38117,6,4),t(38738,5,4,0),
  t(39093,3,4,0),t(39271,0,4,0),t(39271,7,3,0),h(40070,0,5,40780,0,[[40070,0,5],[40425,1,3],[40780,2,1]]),
  s(41401,42377,[[41401,0,3],[41667,1.5,3],[41933,3,3],[42200,4,3],[42377,4,3]]),h(44862,2,1,45484,0,[[44862,2,1],[45218,0,5],[45484,2,1]]),t(45839,0,5,0),t(46016,0,5,0),
  t(46371,3,4,0),t(46549,3,4,0),t(47081,4,5,0),t(47436,5,4,0),
  t(47969,0,3,0),t(48147,1,4,0),t(48324,3,3,0),f(48590,5,4),
  h(49212,6,4,49567),t(51164,1,4,0),t(51431,5,4,0),t(51519,3,4,0),
  t(52052,6,4,0),h(52851,5,5,53916,1,[[52851,5,5],[53206,6,2],[53561,6,2],[53916,5,5]]),s(54271,55158,[[54271,3,3],[54448,1.5,3],[54626,1,3],[54803,1,3],[54981,1,3],[55158,1,3]]),t(56401,3,4,0),
  t(56490,3,4,0),t(56667,3,3,0),t(56845,1,3,0),t(57999,3,4,0),
  t(58087,2,8,0),t(58620,1,4,2),s(59419,60839,[[59419,1,3],[59685,1,3],[59951,1,3],[60218,1,3],[60484,1.5,3],[60750,2,3],[60839,2.5,3]]),t(61105,1,4,0),
  t(61904,0,4,0),t(62170,1,3,0),s(62259,63235,[[62259,2,3],[62436,1,3],[62614,3,3],[62791,2,3],[62969,2,3],[63147,2,3],[63235,2,3]]),t(63324,5,4,0),
  t(63590,3,4,0),f(63679,2,4),t(64567,0,5,0),t(64655,3,4,0),
  t(65454,5,4,0),t(65543,6,4,0),t(66253,5,4,0),t(66431,6,4,0),
  t(67052,5,4,0),t(68028,6,4,0),t(68561,6,4,0),t(69448,5,4,0),
  t(69981,6,4,0),h(70336,5,3,71046),t(71401,3,3,0),t(71933,4,5,0),
  f(72466,0,5),t(73797,0,4,0),t(73886,1,4,0),t(74241,0,4,0),
  t(74685,1,4,0),t(75040,0,4,0),t(75573,0,4,0),t(75750,1,4,0),
  t(76194,1,4,0),t(76371,0,4,0),t(76993,3,4,0),t(77081,1,3,0),
  t(77348,5,4,0),t(77880,3,4,0),t(78413,1,4,0),t(78502,1,8,0),
  t(79034,5,4,0),f(79212,6,4),t(79833,5,4,0),t(80188,6,4,0),
  t(80454,5,4,0),t(81519,3,4,0),t(82229,5,4,0),t(83117,5,5,0),
  t(83294,3,3,0),t(83827,4,5,0),t(84005,0,5,0),t(84182,3,4,0),
  t(84537,0,5,0),t(85247,0,5,0),t(85425,4,5,0),t(85957,0,5,3),
  t(86667,2,5,0),t(86845,1,4,0),t(87022,4,5,0),f(87377,2,5),
  t(87732,5,5,0),t(87910,4,5,0),t(88265,4,5,0),t(89330,3,4,0),
  t(89507,5,4,0),t(89685,3,4,0),t(89774,5,4,0),t(90040,1,4,0),
  t(90129,5,4,0),t(90573,2,5,0),t(91105,6,4,0),t(91283,3,4,0),
  t(91460,7,3,0),t(92259,4,4,0),s(92348,93058,[[92348,3,3],[92525,3,3],[92703,3,3],[92880,3,3],[93058,4,3]],1),t(94123,0,5,0),
  t(94300,2,5,0),f(94655,4,5),t(95010,6,4,0),t(95010,0,3,0),
  t(95543,5,4,0),t(95720,3,4,0),t(96253,6,4,0),t(96431,3,4,0),
  t(96608,4,5,0),t(96963,1,4,0),t(97496,3,4,0),t(98028,0,8,0),
  t(98383,5,3,0),t(98561,2,5,0),t(99093,0,5,0),t(99448,0,3,0),
  t(99626,1,3,0),t(99981,3,4,0),t(101046,5,3,0),f(101578,7,3),
  t(102022,5,4,0),s(102821,104241,[[102821,3,3],[103087,3,3],[103354,1.5,3],[103620,1,3],[103886,1.5,3],[104152,2,3],[104241,1.5,3]]),t(104419,5,3,0),t(104774,3,4,0),
  t(104951,0,5,0),s(105129,106016,[[105129,1,3],[105306,1,3],[105484,1,3],[105661,1,3],[105839,1,3],[106016,3,3]],1),s(106371,107348,[[106371,1,3],[106549,1,3],[106726,3,3],[106904,3,3],[107081,2,3],[107259,2,3],[107348,2,3]]),t(107436,0,5,0),
  t(108324,1,4,0),t(109034,4,5,0),t(109389,1,4,0),t(109744,5,4,0),
  t(110099,3,4,0),t(110188,5,4,0),h(110632,1,4,111076),t(111164,3,4,0),
  f(111519,5,4),t(112052,6,4,0),t(112229,6,4,0),t(112584,5,4,0),
  t(112939,3,4,0),t(113472,1,4,0),h(113649,2,1,114360,0,[[113649,2,1],[114005,1,3],[114360,0,5]]),t(114892,5,4,0),
  t(115070,1,4,0),t(115425,3,4,4),t(115780,0,4,0),t(116312,1,4,0),
  t(116490,5,4,0),t(116667,3,3,0),t(116845,1,4,0),t(117555,3,4,0),
  t(117910,5,4,0),t(118087,6,4,0),f(119330,3,4),t(119685,6,4,0),
  t(121460,5,4,0),t(121993,6,4,0),t(123590,7,3,0),t(123768,2,8,0),
  t(125365,1,4,0),t(125720,5,4,0),h(126076,3,4,126519),t(126786,6,4,0),
  t(126963,5,4,0),t(127141,3,4,0),t(127851,1,4,0),t(128206,0,4,0),
  t(128561,1,4,0),t(128916,3,4,0),t(129271,5,4,0),t(129626,6,4,0),
  t(129803,0,4,0),t(129803,7,3,0),f(129981,5,4),t(130336,6,4,0),
  t(130425,5,4,0),t(130691,3,4,0),t(131046,5,4,0),t(131401,3,4,0),
  t(131578,1,4,0),t(132111,4,5,0),t(132466,1,4,0),t(132644,2,5,0),
  t(132821,0,4,0),t(132910,1,4,0),t(133354,2,5,0),t(133531,5,4,0),
  t(133709,5,5,0),t(134241,5,5,0),f(134774,5,5),t(135129,5,5,0),
  h(135306,5,5,135750,1),t(137170,5,4,0),t(138324,5,5,0),t(138590,4,5,0),
  t(138857,3,4,0),t(139123,1,4,0),t(139389,0,4,0),t(140188,1,4,0),
  t(140277,4,5,0),t(140632,3,4,0),t(140987,6,4,0),t(141431,1,8,0),
  t(141874,5,4,0),t(142229,6,4,0),t(142762,5,4,0),t(142939,0,4,0),
  t(142939,7,3,0),f(143117,5,4),
// </atsu-cup-theme-v3-hard-notes>
])(mhTap,mhHoldV2,mhFlick,mhSlideV2);
const atsuCupThemeV3ExpertNotes=((t,h,f,s)=>[
// <atsu-cup-theme-v3-expert-notes>
  f(1815,0,4),t(2525,1,8,0),t(2703,1,3,0),t(2703,7,3,0),
  t(3235,4,5,0),t(3590,2,5,0),h(4123,5,5,4478),t(4567,1,4,0),
  t(5010,3,4,0),t(5365,0,2,0),t(5365,4,2,0),t(5632,2,2,0),
  t(5632,6,2,0),t(5898,4,2,0),t(5898,8,2,0),t(6253,3,4,0),
  t(6431,4,5,0),t(6786,6,4,0),t(7318,5,3,0),t(7673,3,4,0),
  t(7851,5,4,0),f(8028,6,4),t(9182,3,4,0),t(9271,7,3,0),
  t(9448,3,4,0),t(11401,1,3,0),t(12200,0,4,0),h(12555,2,1,13265,1,[[12555,2,1],[12910,1,3],[13265,0,5]]),
  t(13620,1,4,0),t(13709,5,4,0),h(13975,3,4,14419),t(14507,6,4,0),
  t(15040,5,4,0),t(15129,1,4,0),t(15306,3,4,0),t(15395,0,4,0),
  t(15839,5,3,0),t(15928,1,4,0),f(16460,3,4),t(16815,0,4,0),
  t(17081,1,4,0),t(17170,2,5,0),s(17525,18235,[[17525,4,3],[17791,3,3],[18058,1,3],[18235,0,3]]),t(17880,2,5,0),
  t(18768,0,4,0),t(18768,7,3,0),t(19478,5,4,0),t(19655,1,4,0),
  t(20188,4,5,0),t(20365,6,4,0),t(20809,6,4,0),t(21164,6,4,0),
  t(21608,6,4,0),h(22052,3,3,23383),t(22407,7,3,0),t(22939,3,4,0),
  f(23028,4,4),t(23561,5,4,0),t(23916,1,4,0),t(24448,1,8,0),
  s(24981,25780,[[24981,1.5,3],[25158,1.5,3],[25336,1.5,3],[25513,0,3],[25691,0,3],[25780,1,3]]),t(25336,1,4,0),t(25868,3,4,0),t(26312,3,4,0),
  t(26401,1,4,0),t(26756,3,4,0),t(26845,4,4,0),t(27289,3,4,0),
  t(27821,0,4,0),t(28176,3,4,0),t(28442,0,4,0),t(28531,1,4,0),
  f(29152,1,4),t(29596,1,4,0),t(29951,1,4,0),t(30040,0,4,0),
  t(30395,0,4,0),t(30395,7,3,0),t(31638,1,2,0),t(31638,5,2,0),
  t(32081,3,2,0),t(32081,7,2,0),t(32525,1,2,0),t(32525,5,2,0),
  t(33235,5,3,0),t(33413,3,4,0),t(33590,1,3,0),t(34123,3,4,1),
  t(34567,1,4,0),h(34744,0,4,35720),t(35188,1,4,0),h(36431,0,4,36874),
  h(37229,1,4,37762,1),h(38117,5,4,38561),f(38738,3,4),t(39093,1,4,0),
  h(39271,0,4,39803),h(40070,1,5,40780,0,[[40070,1,5],[40425,2,3],[40780,3,1]]),s(41401,42377,[[41401,0,3],[41667,1.5,3],[41933,3,3],[42200,4,3],[42377,4,3]]),h(44862,0,5,45484),
  t(45839,2,5,0),t(46016,2,5,0),t(46371,5,4,0),t(46549,5,4,0),
  t(47081,5,5,0),t(47436,6,4,0),t(47969,0,2,0),t(47969,4,2,0),
  t(48147,2,2,0),t(48147,6,2,0),t(48324,4,2,0),t(48324,8,2,0),
  f(48590,5,4),h(49212,6,4,49567),t(51164,6,4,0),t(51164,0,3,0),
  t(51431,4,4,0),h(51519,7,1,52052,0,[[51519,7,1],[51786,5,5],[52052,7,1]]),t(52407,3,3,0),h(52851,5,5,53916,0,[[52851,5,5],[53206,6,2],[53561,6,2],[53916,5,5]]),
  t(53294,1,4,2),s(54271,55158,[[54271,1.5,3],[54448,0,3],[54626,0,3],[54803,0,3],[54981,0,3],[55158,0,3]]),t(55691,5,4,0),t(56401,3,4,0),
  t(56490,2,4,0),t(56667,0,3,0),t(56756,1,3,0),t(56845,3,3,0),
  t(57999,1,4,0),t(58087,2,8,0),f(58176,2,5),t(58531,5,5,0),
  t(58620,5,4,0),s(59419,60839,[[59419,1,3],[59685,0,3],[59951,0,3],[60218,0.5,3],[60484,2,3],[60750,3.5,3],[60839,4,3]]),t(59951,3,4,0),t(60129,5,4,0),
  t(60395,6,4,0),t(60484,5,4,0),t(61105,6,4,0),t(61371,3,4,0),
  t(61904,6,4,0),t(62170,1,3,0),s(62259,63235,[[62259,2,3],[62436,1,3],[62614,3.5,3],[62791,2,3],[62969,2,3],[63147,2,3],[63235,2,3]]),t(62791,5,4,0),
  t(63324,6,4,0),t(63502,5,4,0),t(63590,6,4,0),f(63679,5,4),
  t(64567,2,5,0),t(64655,5,4,0),t(65099,0,4,0),t(65099,7,3,0),
  t(65454,5,4,0),t(65543,6,4,0),t(65632,4,5,0),t(66253,3,4,0),
  t(66431,1,4,0),t(67052,0,4,0),t(68028,1,4,0),t(68561,1,4,0),
  t(69448,5,4,0),t(69981,1,4,0),t(70336,3,3,0),h(70513,0,3,71046,1),
  f(71401,1,3),t(71756,3,3,0),t(71933,4,5,0),t(72466,5,5,0),
  t(73797,5,4,0),t(73886,6,4,0),t(74241,5,4,0),t(74507,3,4,0),
  t(74685,5,4,0),t(75040,3,4,0),t(75573,1,4,0),t(75750,3,4,0),
  t(76194,1,4,0),t(76371,5,4,0),t(76993,3,4,0),t(77081,7,3,0),
  f(77348,3,4),t(77880,6,4,0),t(77880,0,3,0),t(78413,1,4,0),
  t(78502,0,8,0),t(79034,5,4,0),t(79212,6,4,0),t(79833,5,4,0),
  t(80188,6,4,0),t(80454,5,4,0),t(81519,3,4,0),t(82229,5,4,0),
  t(83117,5,5,0),t(83294,3,3,0),t(83827,1,2,0),t(83827,5,2,0),
  t(84005,3,2,0),t(84005,7,2,0),t(84182,1,2,0),t(84182,5,2,0),
  f(84537,0,5),t(85247,0,5,0),t(85425,4,5,0),t(85780,2,5,0),
  t(85957,2,5,0),t(86312,4,5,3),t(86667,4,5,0),t(86845,6,4,0),
  t(87022,5,5,0),t(87377,5,5,0),t(87732,4,5,0),t(87910,2,5,0),
  t(88265,0,5,0),s(88797,89596,[[88797,1.5,3],[88975,3,3],[89152,0.5,3],[89330,0.5,3],[89507,0.5,3],[89596,0.5,3]]),t(89685,0,4,0),t(89774,1,4,0),
  t(90040,0,4,0),f(90129,1,4),t(90573,2,5,0),t(90661,5,4,0),
  t(91105,0,4,0),t(91105,7,3,0),t(91283,1,4,0),t(91460,3,3,0),
  t(92259,1,4,0),s(92348,93058,[[92348,3,3],[92525,2.5,3],[92703,2.5,3],[92880,2.5,3],[93058,4,3]],1),t(94123,0,5,0),t(94300,2,5,0),
  t(94655,0,5,0),t(95010,5,4,0),t(95543,3,4,0),t(95720,6,4,0),
  t(95898,6,1,0),t(96253,3,4,0),t(96431,1,4,0),t(96608,0,8,0),
  t(96963,1,4,0),f(97141,3,4),t(97496,6,4,0),t(98028,2,5,0),
  t(98383,5,3,0),t(98561,0,5,0),t(99093,2,5,0),t(99448,0,3,0),
  t(99626,1,3,0),t(99981,5,4,0),t(101046,1,3,0),t(101578,5,3,0),
  t(101756,3,3,0),f(102022,6,4),s(102821,104241,[[102821,3.5,3],[103087,3.5,3],[103354,1.5,3],[103620,0,3],[103886,1.5,3],[104152,2.5,3],[104241,2,3]]),t(103354,7,3,0),
  t(104419,7,3,0),t(104419,1,3,0),t(104774,5,4,0),t(104951,2,5,0),
  s(105129,106016,[[105129,1.5,3],[105306,1.5,3],[105484,1.5,3],[105661,1.5,3],[105839,1.5,3],[106016,4,3]],1),t(105484,0,4,0),s(106371,107348,[[106371,1.5,3],[106549,1.5,3],[106726,3.5,3],[106904,3.5,3],[107081,2.5,3],[107259,2.5,3],[107348,2.5,3]]),t(106726,2,5,0),
  t(106904,5,4,0),t(107436,5,5,0),t(108324,3,4,0),t(109034,5,5,0),
  t(109389,5,4,0),t(109744,6,4,0),t(110099,5,4,0),f(110188,6,4),
  h(110632,3,4,111076),t(111164,5,4,0),t(111519,6,4,0),t(111874,5,4,0),
  t(112052,3,4,0),t(112229,1,4,0),t(112584,0,4,0),t(112939,1,4,0),
  t(113472,3,4,0),t(113649,5,4,0),h(113827,5,1,114360,1,[[113827,5,1],[114093,4,3],[114360,3,5]]),t(114892,5,4,0),
  t(115070,3,4,0),t(115425,1,4,4),f(115780,0,4),t(116312,1,4,0),
  t(116490,6,4,0),t(116490,0,3,0),t(116667,3,3,0),t(116845,5,4,0),
  t(117555,1,4,0),t(117910,3,4,0),t(118087,0,4,0),t(119330,0,4,0),
  t(119685,1,4,0),t(121460,0,4,0),t(121993,3,4,0),t(123590,0,3,0),
  t(123768,0,8,0),t(125365,1,4,0),t(125720,3,4,0),h(126076,5,4,126519),
  t(126786,6,4,0),t(126963,1,4,0),f(127141,5,4),t(127851,3,4,0),
  t(128028,6,4,0),t(128206,3,4,0),t(128561,5,4,0),t(128916,1,4,0),
  t(129271,6,4,0),t(129626,3,4,0),t(129803,6,4,0),t(129981,3,4,0),
  t(130336,6,4,0),t(130425,3,4,0),t(130691,5,4,0),t(131046,6,4,0),
  t(131401,6,4,0),t(131401,0,3,0),f(131578,1,4),t(132111,2,5,0),
  t(132466,5,4,0),t(132644,5,5,0),t(132821,5,4,0),t(132910,6,4,0),
  t(133354,4,5,0),t(133531,6,4,0),t(133709,0,5,0),t(134241,4,5,0),
  t(134330,2,5,0),t(134774,5,5,0),t(134862,5,5,0),t(135129,5,5,0),
  h(135306,5,5,135750,1),f(137170,5,4),t(138324,5,5,0),t(138590,4,5,0),
  t(138857,3,4,0),t(139123,1,4,0),t(139389,5,4,0),t(140010,1,4,0),
  t(140188,3,4,0),t(140277,0,5,0),t(140632,0,4,0),t(140809,1,4,0),
  t(140987,3,4,0),t(141431,0,8,0),t(141874,0,4,0),t(142229,1,4,0),
  t(142584,3,4,0),t(142762,5,4,0),t(142939,0,4,0),t(142939,7,3,0),
  f(143117,6,4),
// </atsu-cup-theme-v3-expert-notes>
])(mhTap,mhHoldV2,mhFlick,mhSlideV2);
const atsuCupThemeV3MasterNotes=((t,h,f,s)=>[
// <atsu-cup-theme-v3-master-notes>
  f(1815,7,3),t(2525,2,6,0),t(2703,6,2,0),t(2703,2,2,0),
  t(3235,1,4,0),t(3590,3,4,0),t(3768,2,1,0),h(4123,5,4,4478),
  t(4567,3,3,0),t(4833,1,4,0),t(5010,0,3,0),t(5365,0,2,0),
  t(5365,4,2,0),t(5632,4,2,0),t(5632,8,2,0),t(5898,0,2,0),
  t(5898,4,2,0),t(6253,3,3,0),t(6431,1,4,0),t(6786,5,3,0),
  f(7318,4,2),t(7673,0,2,0),t(7673,4,2,0),t(7851,2,2,0),
  t(7851,6,2,0),t(8028,4,2,0),t(8028,8,2,0),t(9182,3,3,0),
  t(9271,8,2,0),t(9448,3,3,0),t(11401,6,2,0),t(11667,5,3,0),
  t(12200,7,3,0),t(12200,2,3,0),h(12555,8,1,13265,1,[[12555,8,1],[12910,7,3],[13265,6,4]]),t(13620,1,3,0),
  t(13709,5,3,0),h(13975,3,3,14419),f(14507,7,3),t(15040,5,3,0),
  t(15129,1,3,0),t(15306,3,3,0),t(15395,0,3,0),t(15839,6,2,0),
  t(15928,4,3,0),t(16460,1,3,0),t(16815,0,3,0),t(17081,1,3,0),
  t(17170,1,4,0),s(17525,18235,[[17525,4,2],[17791,3,2],[18058,1,2],[18235,0,2]]),t(17880,0,4,0),t(18768,1,3,0),
  t(19478,5,3,0),t(19655,1,3,0),t(20188,5,4,0),t(20188,0,3,0),
  f(20365,7,3),t(20809,7,3,0),t(21164,7,3,0),t(21608,7,3,0),
  h(22052,6,2,23383),t(22407,8,2,1),t(22939,4,3,0),t(23028,7,3,0),
  t(23561,5,3,0),t(23916,1,3,0),t(24448,2,6,0),s(24981,25780,[[24981,1.5,2],[25158,1.5,2],[25336,1.5,2],[25513,0,2],[25691,0,2],[25780,1,2]]),
  f(25336,4,3),t(25868,1,3,0),t(26046,0,3,0),t(26312,1,3,0),
  t(26401,5,3,0),t(26756,1,3,0),t(26845,3,3,0),t(27289,0,3,0),
  t(27821,5,3,0),t(28176,1,3,0),t(28176,6,3,0),t(28442,3,3,0),
  t(28531,5,3,0),t(28886,0,3,0),t(29152,1,3,0),t(29241,0,3,0),
  t(29596,0,3,0),t(29951,1,3,0),f(30040,3,3),t(30395,1,3,0),
  t(31638,2,2,0),t(31638,6,2,0),t(32081,1,2,0),t(32081,7,2,0),
  t(32525,0,2,0),t(32525,8,2,0),t(33235,6,2,0),t(33413,7,3,0),
  t(33590,6,2,0),t(34123,7,3,0),t(34212,6,3,0),t(34567,0,3,0),
  h(34744,0,4,35720,1,[[34744,0,4],[35099,0,3],[35365,1,2],[35720,1,1]]),t(35099,1,3,0),f(35188,2,3),h(36431,1,3,36874),
  h(37229,3,3,37762),h(38117,5,3,38561),t(38738,2,3,0),t(38738,7,3,0),
  t(39093,1,3,0),h(39271,0,3,39803),h(40070,1,3,40780),s(41401,42377,[[41401,2,2],[41578,3.5,2],[41756,3.5,2],[41933,3.5,2],[42111,4,2],[42289,4,2],[42377,4,2]]),
  h(44862,3,1,45484,0,[[44862,3,1],[45218,1,4],[45484,3,1]]),t(45839,3,4,0),t(46016,3,4,0),t(46371,5,3,0),
  t(46549,5,3,0),t(47081,4,6,0),t(47436,7,3,0),s(47969,48502,[[47969,1.5,2],[48147,1.5,2],[48324,2,2],[48502,3.5,2]]),
  f(48590,5,3),h(49212,3,3,49567),t(51164,5,3,0),t(51431,7,3,0),
  h(51519,5,4,52052,1,[[51519,5,4],[51786,6,1],[52052,5,4]]),t(52407,2,2,0),t(52407,6,2,0),h(52851,6,1,53916,0,[[52851,6,1],[53206,5,3],[53561,5,3],[53916,6,1]]),
  t(53294,8,2,0),t(53472,7,3,0),s(54271,55158,[[54271,3,2],[54448,0.5,2],[54626,0.5,2],[54803,0.5,2],[54981,0.5,2],[55158,0.5,2]]),t(55691,7,3,0),
  t(56401,4,3,0),t(56490,3,3,0),t(56667,2,2,0),t(56756,0,2,0),
  t(56845,2,2,0),f(57022,0,3),t(57999,1,3,0),t(58087,4,4,0),
  t(58176,5,4,0),t(58531,6,4,0),t(58620,3,3,0),s(59064,60484,[[59064,3,2],[59330,2,2],[59596,1,2],[59862,0.5,2],[60129,1.5,2],[60395,1,2],[60484,2,2]],1),
  t(59419,1,4,0),t(59596,3,4,0),t(59951,5,3,0),t(60129,7,3,0),
  t(60839,1,3,0),t(61105,2,3,0),t(61105,7,3,0),f(61371,5,3),
  t(61904,7,3,0),t(62170,2,2,0),s(62259,63235,[[62259,3,2],[62436,1.5,2],[62614,4,2],[62791,3,2],[62969,3,2],[63147,3,2],[63235,3,2]]),t(62791,3,3,0),
  t(63324,7,3,0),t(63502,5,3,0),t(63590,7,3,0),t(63679,5,3,0),
  h(63768,7,3,64212,1),t(64567,3,4,0),t(64655,5,3,0),t(64744,1,3,0),
  f(65099,1,3),t(65454,0,3,0),t(65543,3,3,0),t(65632,0,6,0),
  t(66253,3,3,0),t(66431,1,3,0),t(67052,1,3,0),t(68028,0,3,0),
  t(68561,1,3,2),t(69448,0,3,0),t(69448,5,3,0),t(69803,3,3,0),
  t(69981,1,3,0),t(70336,6,2,0),h(70513,5,1,71046,1,[[70513,5,1],[70780,4,3],[71046,3,4]]),t(71401,2,2,0),
  t(71756,4,2,0),f(71933,5,4),t(72466,6,4,0),t(73797,3,3,0),
  t(73886,5,3,0),t(74241,3,3,0),t(74507,1,3,0),t(74685,5,3,0),
  t(75040,3,3,0),t(75218,1,3,0),t(75573,0,3,0),t(75750,1,3,0),
  t(76194,5,3,0),t(76371,3,3,0),t(76993,7,3,0),t(77081,4,2,0),
  f(77348,5,3),t(77880,7,3,0),t(77880,2,3,0),t(78413,3,3,0),
  t(78502,5,4,0),t(79034,7,3,0),t(79212,5,3,0),t(79300,4,3,0),
  t(79833,5,3,0),t(80188,3,3,0),t(80454,1,3,0),t(81519,0,3,0),
  t(82229,1,3,0),t(83117,5,4,0),f(83294,4,2),t(83827,1,4,0),
  t(84005,0,4,0),t(84093,1,4,0),t(84182,5,3,0),t(84537,3,4,0),
  s(84803,86223,[[84803,1.5,2],[85070,0,2],[85336,0,2],[85602,0,2],[85868,0,2],[86135,0,2],[86223,0,2]]),t(85247,5,4,0),t(85425,6,4,0),t(85780,2,6,0),
  t(86312,5,4,3),t(86667,1,4,0),t(86667,7,3,0),t(86845,0,3,0),
  t(87022,3,4,0),t(87377,1,4,0),t(87732,5,4,0),f(87910,0,4),
  t(88265,6,4,0),s(88797,89596,[[88797,1.5,2],[88975,3,2],[89152,0.5,2],[89330,0.5,2],[89507,0.5,2],[89596,0.5,2]]),t(89152,6,1,0),t(89685,3,3,0),
  t(89774,4,3,0),t(90040,3,3,0),t(90129,4,3,0),t(90573,3,4,0),
  t(90661,5,3,0),t(91105,3,3,0),t(91283,1,3,0),t(91460,4,2,0),
  t(92259,1,3,0),s(92348,93058,[[92348,3,2],[92525,2.5,2],[92703,2.5,2],[92880,2.5,2],[93058,4,2]],1),t(94123,1,4,0),t(94123,7,3,0),
  t(94300,5,4,0),t(94478,4,2,0),f(94655,6,4),t(95010,5,3,0),
  t(95543,3,3,0),h(95720,1,3,96076),t(96253,0,3,0),t(96431,1,3,0),
  t(96519,3,3,0),t(96608,4,4,0),t(96963,7,3,0),t(97141,5,3,0),
  t(97496,1,3,0),t(97851,3,3,0),f(98028,0,4),t(98383,2,2,0),
  t(98561,3,4,0),t(98738,5,3,0),t(99093,6,4,0),t(99271,6,4,0),
  t(99448,8,2,0),t(99626,8,2,0),t(99626,4,2,0),t(99981,7,3,0),
  t(101046,4,2,0),t(101578,8,2,0),t(101756,4,2,0),t(102022,7,3,0),
  s(102821,104241,[[102821,4,2],[103087,4,2],[103354,1.5,2],[103620,0,2],[103886,1.5,2],[104152,2.5,2],[104241,2,2]]),t(103354,8,2,0),f(104419,6,2),t(104774,3,3,0),
  t(104862,2,3,0),t(104951,0,6,0),s(105129,106016,[[105129,1.5,2],[105306,1.5,2],[105484,1.5,2],[105661,1.5,2],[105839,1.5,2],[106016,4,2]]),t(105484,4,3,0),
  s(106194,107348,[[106194,3,2],[106371,1.5,2],[106549,1.5,2],[106726,4,2],[106904,4,2],[107081,2.5,2],[107259,2.5,2],[107348,2.5,2]]),t(106549,7,3,0),t(106726,3,4,0),t(106904,5,3,0),
  t(107436,2,4,0),t(108324,0,3,0),t(109034,3,4,0),t(109389,1,3,0),
  t(109389,6,3,0),f(109744,5,3),t(110099,3,3,0),t(110188,7,3,0),
  h(110632,3,3,111076),t(111164,5,3,0),t(111519,1,2,0),t(111519,5,2,0),
  t(111697,4,2,0),t(111697,8,2,0),t(111874,1,2,0),t(111874,5,2,0),
  t(112052,4,2,0),t(112052,8,2,0),t(112229,5,3,0),t(112584,7,3,0),
  t(112939,5,3,0),t(113472,3,3,0),t(113649,1,3,0),h(113827,0,4,114360,1,[[113827,0,4],[114093,0,3],[114360,1,1]]),
  t(114892,1,3,0),f(115070,3,3),t(115425,5,3,4),t(115780,7,3,0),
  t(116312,1,3,0),t(116490,5,3,0),t(116667,4,2,0),t(116845,5,3,0),
  t(116845,0,3,0),t(117555,1,3,0),t(117910,3,3,0),t(118087,0,3,0),
  t(119330,1,3,0),t(119685,5,3,0),t(121460,1,3,0),f(121993,7,3),
  t(123590,8,2,0),t(123768,4,6,0),t(125365,3,3,0),t(125720,5,3,0),
  h(126076,1,3,126519),t(126786,7,3,0),t(126963,1,3,0),t(127141,3,3,0),
  t(127851,5,3,0),t(128028,7,3,0),t(128206,0,2,0),t(128206,4,2,0),
  t(128561,1,2,0),t(128561,5,2,0),t(128916,3,2,0),t(128916,7,2,0),
  t(129271,4,2,0),t(129271,8,2,0),t(129626,2,3,0),t(129626,7,3,0),
  t(129803,7,3,0),f(129981,3,3),t(130336,7,3,0),t(130425,3,3,0),
  t(130691,5,3,0),t(131046,7,3,0),t(131401,5,3,0),t(131578,2,3,0),
  t(132111,3,4,0),t(132466,5,3,0),t(132644,6,4,0),t(132821,1,3,0),
  t(132910,4,3,0),t(133354,5,4,0),t(133531,7,3,0),f(133709,5,4),
  t(134241,6,4,0),t(134330,5,4,0),t(134596,8,1,0),t(134774,3,4,0),
  t(134862,2,4,0),t(135129,0,4,0),t(135129,6,3,0),h(135306,1,4,135750),
  t(135928,3,4,0),t(137170,1,3,0),t(138324,2,2,0),t(138324,6,2,0),
  t(138590,2,2,0),t(138590,7,2,0),t(138857,1,2,0),t(138857,8,2,0),
  t(139123,0,2,0),t(139123,8,2,0),f(139389,1,3),t(139833,0,3,0),
  t(140010,1,3,0),t(140188,0,3,0),t(140277,1,4,0),t(140632,3,3,0),
  t(140809,5,3,0),t(140987,7,3,0),t(141431,2,6,0),t(141874,5,3,0),
  t(142229,7,3,0),t(142584,5,3,0),t(142762,3,3,0),t(142939,5,3,0),
  t(143117,2,3,0),t(143117,7,3,0),f(143294,1,3),
// </atsu-cup-theme-v3-master-notes>
])(mhTap,mhHoldV2,mhFlick,mhSlideV2);
const atsuCupThemeV3Charts=Object.freeze({
  EASY:mhChart(1,atsuCupThemeV3EasyNotes,ATSU_CUP_THEME_V3_DURATION_MS),
  NORMAL:mhChart(3,atsuCupThemeV3NormalNotes,ATSU_CUP_THEME_V3_DURATION_MS),
  HARD:mhChart(5,atsuCupThemeV3HardNotes,ATSU_CUP_THEME_V3_DURATION_MS),
  EXPERT:mhChart(7,atsuCupThemeV3ExpertNotes,ATSU_CUP_THEME_V3_DURATION_MS),
  MASTER:mhChart(9,atsuCupThemeV3MasterNotes,ATSU_CUP_THEME_V3_DURATION_MS),
});



// 譜面のレベル（Lv.）。**手で決めない**。tools/mode/rhythm-chart-level.js が
// 譜面そのもの（詰まり具合・横の移動・細さ・種類・SLIDEの経路）から計算した値を、
// `node tools/mode/rhythm-chart-level.js --write` がここへ書き写す。
// 物差しの基準は「Monster Hero 候補v3 の MASTER = Lv.30」。曲が増えても、
// この基準からの相対でレベルが決まるので、曲どうしを見比べられる。
// マーカーの内側は書き換えられるので、手で編集しないこと。
const RHYTHM_CHART_LEVELS = Object.freeze({
// <rhythm-chart-levels>
  atsu_cup_theme_test:Object.freeze({EASY:11,NORMAL:7,HARD:6}),
  width_test:Object.freeze({EASY:10,NORMAL:8,MASTER:2}),
  wide_width_test:Object.freeze({EASY:10,HARD:2}),
  end_flick_test:Object.freeze({EASY:4,HARD:4}),
  monster_note_test:Object.freeze({EASY:4}),
  monster_hero_theme_candidate:Object.freeze({EASY:6,NORMAL:7,HARD:10}),
  monster_hero_theme_candidate_v2:Object.freeze({EASY:7,NORMAL:9,HARD:15,EXPERT:22,MASTER:26}),
  monster_hero_theme_candidate_v3:Object.freeze({EASY:8,NORMAL:11,HARD:15,EXPERT:21,MASTER:30}),
  six_eternel_beat:Object.freeze({EASY:8,NORMAL:10,HARD:18,EXPERT:25,MASTER:35}),
  six_eternel_remix_beat:Object.freeze({EASY:8,NORMAL:9,HARD:14,EXPERT:22,MASTER:28}),
  mf_ichika_mix:Object.freeze({EASY:7,NORMAL:9,HARD:12,EXPERT:18,MASTER:24}),
  monster_hero:Object.freeze({EASY:8,NORMAL:11,HARD:15,EXPERT:21,MASTER:30}),
  six_eternel_remix:Object.freeze({EASY:8,NORMAL:9,HARD:14,EXPERT:22,MASTER:28}),
  stay_with_me:Object.freeze({EASY:6,NORMAL:7,HARD:11,EXPERT:17,MASTER:23}),
  kiki_issen:Object.freeze({EASY:7,NORMAL:10,HARD:15,EXPERT:20,MASTER:31}),
  atsu_cup_theme_debug_short:Object.freeze({HARD:10}),
// </rhythm-chart-levels>
});
// レベルだけを差し替える。表に無い曲・難易度は、譜面が持っている値をそのまま使う。
const rhythmChartWithLevel=(songId,difficultyId,chart)=>{
  const levels=RHYTHM_CHART_LEVELS[songId];
  const level=levels?levels[difficultyId]:undefined;
  return Number.isFinite(level)&&level!==chart.level?Object.freeze({...chart,level}):chart;
};
const RHYTHM_SONG_ENTRIES = [
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
  // DEBUG ONLY: 幅の上限撤廃(全幅)とHOLD/SLIDEの途中幅変化を見るためのテスト曲。
  Object.freeze({
    songId:'wide_width_test', displayName:'WIDE / TAPER TEST',
    debugDescription:'全幅ノーツと、HOLD・SLIDEの途中で幅が変わる形の確認（EASY=幅の段階 / HARD=HOLDの幅変化 / EXPERT=SLIDEの幅変化）',
    bgmTrackId:'atsu_cup_theme',
    difficulties:Object.freeze(Object.fromEntries(RHYTHM_DIFFICULTIES.map(({id})=>[id,id==='EASY'?wideWidthTestChart:id==='HARD'?wideHoldTaperTestChart:id==='EXPERT'?wideSlideTestChart:emptyRhythmChart()])))
  }),
  Object.freeze({
    songId:'end_flick_test', displayName:'END FLICK TEST',
    debugDescription:'終点フリックの確認用（EASY=HOLD／NORMAL=SLIDE／HARD=混在）',
    bgmTrackId:'atsu_cup_theme',
    difficulties:Object.freeze(Object.fromEntries(RHYTHM_DIFFICULTIES.map(({id})=>[id,id==='EASY'?endFlickHoldTestChart:id==='NORMAL'?endFlickSlideTestChart:id==='HARD'?endFlickMixTestChart:emptyRhythmChart()])))
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
  // DEBUG ONLY: 自動譜面制作V2(STEP1〜7)が作った候補。v1と遊び比べるための入口。
  // 5難易度そろっており、EXPERT / MASTER はv1に無い。耳確認前なので正式導線へは出さない。
  Object.freeze({
    songId:'monster_hero_theme_candidate_v2',
    displayName:'Monster Hero 候補v2',
    debugDescription:'自動譜面制作V2の候補（EASY〜MASTERの5難易度・全尺2分32秒・耳確認前）',
    bgmTrackId:'monster_hero_theme',
    difficulties:Object.freeze(Object.fromEntries(RHYTHM_DIFFICULTIES.map(({id})=>[
      id,monsterHeroV2Charts[id]||emptyRhythmChart()
    ])))
  }),
  // DEBUG ONLY: 自動譜面制作V3が作った候補。V2と遊び比べるための入口。
  // 音の種類でノーツの種類を決め、音の高さの動きで形（階段・折り返し・交互…）を選び、
  // HOLDの長さとSLIDEの経路を実際の音から取る。耳確認前なので正式導線へは出さない。
  Object.freeze({
    songId:'monster_hero_theme_candidate_v3',
    displayName:'Monster Hero 候補v3',
    debugDescription:'自動譜面制作V3の候補（音の種類と音の高さから組み立て・EASY〜MASTER・耳確認前）',
    bgmTrackId:'monster_hero_theme',
    difficulties:Object.freeze(Object.fromEntries(RHYTHM_DIFFICULTIES.map(({id})=>[
      id,monsterHeroV3Charts[id]||emptyRhythmChart()
    ])))
  }),
  // DEBUG ONLY: もらった新曲2曲。V3が自動で作った譜面なので、耳確認前は正式導線へ出さない。
  // 音源は「曲の頭からサビの終わりまで」を切り出したショート版（2分38秒 / 2分30秒）。
  Object.freeze({
    songId:'six_eternel_beat',
    displayName:'SIX ÉTERNEL',
    debugDescription:'SIX ÉTERNEL ―愛はひとつじゃない―（モンビー用ショート2分38秒・EASY〜MASTER・耳確認前）',
    bgmTrackId:'six_eternel_beat',
    difficulties:Object.freeze(Object.fromEntries(RHYTHM_DIFFICULTIES.map(({id})=>[
      id,sixEternelBeatCharts[id]||emptyRhythmChart()
    ])))
  }),
  Object.freeze({
    songId:'six_eternel_remix_beat',
    displayName:'SIX ÉTERNEL ドパガキリミックス',
    debugDescription:'SIX ÉTERNEL ドパガキリミックス（モンビー用ショート2分30秒・EASY〜MASTER・耳確認前）',
    bgmTrackId:'six_eternel_remix_beat',
    difficulties:Object.freeze(Object.fromEntries(RHYTHM_DIFFICULTIES.map(({id})=>[
      id,sixEternelRemixBeatCharts[id]||emptyRhythmChart()
    ])))
  }),
  // ---- 先行公開する5曲 ----
  // 体験版の曲えらびへ出すのはここから下の5曲だけ(RHYTHM_DEMO_SONG_IDS)。
  // 上のデバッグ曲と役割を分けているので、デバッグ曲を足しても曲えらびは増えない。
  Object.freeze({
    songId:'mf_ichika_mix',
    displayName:'MF × ICHIKA MIX',
    bgmTrackId:'atsu_cup_theme',
    difficulties:Object.freeze(Object.fromEntries(RHYTHM_DIFFICULTIES.map(({id})=>[
      id,atsuCupThemeV3Charts[id]||emptyRhythmChart()
    ])))
  }),
  Object.freeze({
    songId:'monster_hero',
    displayName:'Monster Hero',
    bgmTrackId:'monster_hero_theme',
    difficulties:Object.freeze(Object.fromEntries(RHYTHM_DIFFICULTIES.map(({id})=>[
      id,monsterHeroV3Charts[id]||emptyRhythmChart()
    ])))
  }),
  Object.freeze({
    songId:'six_eternel_remix',
    displayName:'SIX ÉTERNEL ―愛はひとつじゃない―',
    subtitle:'ドパガキリミックス',
    // 2026-09-05、ユーザー指示「いいとこで切れてたからショートバージョンを採用して」。
    // 全尺(4分58秒)ではなく、頭からサビの終わりまでを切り出した2分30秒のほうを使う。
    bgmTrackId:'six_eternel_remix_beat',
    difficulties:Object.freeze(Object.fromEntries(RHYTHM_DIFFICULTIES.map(({id})=>[
      id,sixEternelRemixBeatCharts[id]||emptyRhythmChart()
    ])))
  }),
  Object.freeze({
    songId:'stay_with_me',
    displayName:'Stay With Me',
    subtitle:'～Locked Fate～',
    bgmTrackId:'pandora_boss',
    difficulties:Object.freeze(Object.fromEntries(RHYTHM_DIFFICULTIES.map(({id})=>[
      id,pandoraBossCharts[id]||emptyRhythmChart()
    ])))
  }),
  Object.freeze({
    songId:'kiki_issen',
    displayName:'綺季一閃',
    subtitle:'～花雪に舞う詠姫～',
    bgmTrackId:'eiki_boss',
    difficulties:Object.freeze(Object.fromEntries(RHYTHM_DIFFICULTIES.map(({id})=>[
      id,eikiBossCharts[id]||emptyRhythmChart()
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
];
const RHYTHM_SONGS = Object.freeze(RHYTHM_SONG_ENTRIES.map(song=>Object.freeze({...song,
  difficulties:Object.freeze(Object.fromEntries(RHYTHM_DIFFICULTIES.map(({id})=>
    [id,rhythmChartWithLevel(song.songId,id,song.difficulties[id])])))})));

// 先行公開する「音ゲー体験版」で遊べる範囲。ここに書いた曲・難易度だけを体験版の画面へ出す。
// デバッグ画面の曲一覧(RHYTHM_SONGS)とは役割を分ける。デバッグ用の曲を体験版へ出さないため。
// 2026-09-05、ユーザー指示で先行公開の5曲・5難易度になった。
const RHYTHM_DEMO_SONG_IDS=Object.freeze([
  'mf_ichika_mix',
  'monster_hero',
  'six_eternel_remix',
  'stay_with_me',
  'kiki_issen',
]);
// 1曲だけを指す場面(全国ランキングの既定など)のために先頭を別名で持つ。
const RHYTHM_DEMO_SONG_ID=RHYTHM_DEMO_SONG_IDS[0];
const RHYTHM_DEMO_DIFFICULTY_IDS=Object.freeze(['EASY','NORMAL','HARD','EXPERT','MASTER']);
const RHYTHM_DEMO_DIFFICULTY_LABELS=Object.freeze({
  EASY:Object.freeze({name:'EASY', note:'はじめての人向け。TAPが中心で、押す場所も大きく動きません。'}),
  NORMAL:Object.freeze({name:'NORMAL', note:'ふつうの遊び方。FLICKと幅の違うノーツが増えます。'}),
  HARD:Object.freeze({name:'HARD', note:'いまの音ゲーでできることをひととおり。SLIDEと長押し中の別ノーツが入ります。'}),
  EXPERT:Object.freeze({name:'EXPERT', note:'同時押しの連なりや指をクロスさせる配置が入ります。'}),
  MASTER:Object.freeze({name:'MASTER', note:'端から端へ動くSLIDEまで、その曲でできることの全部。'}),
});
// EXPERT以上は「同じ曲の1つ下の難易度をクリアしている」ことが条件(2026-09-05・ユーザー指示)。
// 判定に使うのは既にある自己ベスト(mh_rhythm_best_v1)の clear だけで、新しい保存キーは足さない。
const RHYTHM_DIFFICULTY_UNLOCK_BY=Object.freeze({EXPERT:'HARD', MASTER:'EXPERT'});
// 解放に必要な1つ下の難易度id(いらない難易度はnull)。
const rhythmDifficultyUnlockRequirement=difficultyId=>RHYTHM_DIFFICULTY_UNLOCK_BY[difficultyId]||null;
// 記録の形が壊れていても「解放されていない」に倒す(勝手に開けない)。
const rhythmDifficultyUnlocked=(songId,difficultyId,bestRecords)=>{
  const required=RHYTHM_DIFFICULTY_UNLOCK_BY[difficultyId];
  if(!required)return true;
  const bySong=bestRecords&&typeof bestRecords==='object'?bestRecords[songId]:null;
  const record=bySong&&typeof bySong==='object'?bySong[required]:null;
  return !!(record&&record.clear===true);
};
const rhythmDemoSong=songs=>(songs||[]).find(song=>song.songId===RHYTHM_DEMO_SONG_ID)||null;
// 体験版の曲えらびに出す曲。**曲が増えても画面を書き換えずに済むよう**配列で持つ
// (2026-09-05・曲選択画面を一覧の形にしたときに用意した)。
// 耳で確かめた曲をここへ足せば、そのまま曲えらびの一覧に並ぶ。
const rhythmDemoSongs=songs=>RHYTHM_DEMO_SONG_IDS
  .map(songId=>(songs||[]).find(song=>song.songId===songId))
  .filter(Boolean);
// 体験版で選べる難易度そのもの(曲ごとの絞り込みは rhythmDemoDifficulties が行う)。
const rhythmDemoDifficultyList=difficulties=>(difficulties||[])
  .filter(difficulty=>RHYTHM_DEMO_DIFFICULTY_IDS.includes(difficulty.id));
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
// 1ページで受け取る生の行数、ユーザーごとに畳んだあと画面へ出す件数、
// 十分な人数が集まるまでページ送りする上限(下のrhythmRankingDedupeByUserの説明も参照)。
// 2026-09-04、Codexレビュー指摘: 1回200件で打ち切ると、同じプレイヤーが200回を超えて
// 高得点を記録した場合にその1人の行だけで埋まり、本来上位に入る他プレイヤーが消えてしまう。
// 1プレイ=1行で行が際限なく増える点は既存のsbFetchAllBreederRows(ブリーダーLvランキング)と
// 同じ構造のため、そちらと同じ「ユニークな人数が集まるかページが尽きるまで送る」考え方にした
const RHYTHM_RANKING_FETCH_LIMIT=200;
const RHYTHM_RANKING_DISPLAY_LIMIT=50;
const RHYTHM_RANKING_MAX_PAGES=10;
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
// (種族チャレンジがpartyへ育て方の詳細を持たせているのと同じ、列を増やさない考え方)。
// party列は既存モードと同じ「配列」の形で送っており(スキーマの配列前提と衝突しないための
// 防御)、その先頭要素をdetailとして読む。配列でない・空・要素がオブジェクトでない場合はnull
const rhythmRankingEntryFromRow=(row)=>{
  const parsed=parseRhythmRankingDifficultyKey(row?.difficulty);
  const partyDetail=Array.isArray(row?.party)?row.party[0]:null;
  const detail=(partyDetail&&typeof partyDetail==='object')?partyDetail:null;
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
    /* 終点フリックの終端バー。「ここで弾く」ことが一目で分かるよう、単発FLICKと同じ緑と「⇧」に揃える。
       backgroundのショートハンドで書くとbackground-clipなどを巻き添えでリセットしてしまうため、
       background-imageだけを上書きする(200コンボの演出が消えた不具合と同じ罠を避ける)。 */
    /* 音ゲーオプションのスライダー。指で掴めるよう、つまみを大きめ(26px)にする。
       溝の色はJS側で「いまの値まで」を塗り分けるので、ここでは形と、つまみの見た目だけを決める。 */
    .mh-rhythm-range{-webkit-appearance:none;appearance:none;outline:none;touch-action:pan-y}
    .mh-rhythm-range::-webkit-slider-thumb{-webkit-appearance:none;appearance:none;width:26px;height:26px;border-radius:9999px;background:#f8fafc;border:2px solid #22d3ee;box-shadow:0 1px 4px rgba(0,0,0,.55)}
    .mh-rhythm-range::-moz-range-thumb{width:26px;height:26px;border:2px solid #22d3ee;border-radius:9999px;background:#f8fafc;box-shadow:0 1px 4px rgba(0,0,0,.55)}
    .mh-rhythm-range:focus-visible{box-shadow:0 0 0 2px rgba(34,211,238,.65)}
    /* HOLD / SLIDE / FLICK を最後まで取れたときに、判定ラインで一度だけ広がって消える光。
       押した手ごたえを目でも返すためのもので、判定・スコアには関与しない。 */
    [data-rhythm-note][data-rhythm-clear] > span:last-child{animation:rhythm-clear-pop .26s ease-out forwards}
    [data-rhythm-note][data-rhythm-clear] > span:not(:last-child){opacity:0}
    @keyframes rhythm-clear-pop{from{transform:scale(1);opacity:.95}to{transform:scale(2.1);opacity:0}}
    [data-rhythm-end-bar][data-rhythm-end-flick]{background-image:linear-gradient(90deg,#22c55e,#f0fdf4 50%,#22c55e)!important;border-color:rgba(220,252,231,.98)!important}
    [data-rhythm-end-bar][data-rhythm-end-flick]::after{content:"⇧";position:absolute;left:50%;bottom:100%;transform:translateX(-50%) scaleY(calc(1 / var(--rhythm-end-depth-scale, 1)));transform-origin:50% 100%;color:#f0fdf4;font-size:15px;line-height:1;pointer-events:none;text-shadow:0 0 8px #22c55e,0 0 14px #15803d}
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
    /* --rhythm-note-depth-brightness は落下中まいフレーム書き換えている。そこへ40msの
       transitionを付けると、目標値が毎フレーム置き換わるので補間はほぼ働かず、
       それでいて「動いている遷移」を全ノーツぶん抱え続けることになる。
       実測(デスクトップChromium・266ノーツ/同時表示5)で、毎フレームの
       style+layoutが 0.786ms → 0.332ms と半分以下になった。
       明るさは元から位置の関数として滑らかに変わるため、見た目は変えていない。 */
    [data-rhythm-note]>span:last-child{transform:scale(var(--rhythm-note-size-scale,1)) scaleY(var(--rhythm-note-depth-scale,1));transform-origin:center;filter:brightness(var(--rhythm-note-depth-brightness,1))}
    /* 幅広ノーツ(5サブレーン以上)は、丸い粒を横に引き伸ばした形だと「どこからどこまでか」が
       読み取りにくい。プロセカ・チュウニズムの幅広ノーツと同じく、角を落とした棒にして
       両端へ明るい縁を置く。塗りは静的なCSSだけで作るので、毎フレームの負担は増えない。 */
    [data-rhythm-note][data-rhythm-note-wide="1"]>span:last-child{border-radius:7px!important}
    [data-rhythm-note][data-rhythm-note-wide="1"]>span:last-child::before,
    [data-rhythm-note][data-rhythm-note-wide="1"]>span:last-child::after{
      content:"";position:absolute;top:1px;bottom:1px;width:3px;border-radius:3px;
      background:linear-gradient(180deg,rgba(255,255,255,.95),rgba(255,255,255,.55));pointer-events:none}
    [data-rhythm-note][data-rhythm-note-wide="1"]>span:last-child::before{left:1px}
    [data-rhythm-note][data-rhythm-note-wide="1"]>span:last-child::after{right:1px}
    [data-rhythm-note][data-rhythm-failed="true"]{filter:grayscale(1) brightness(.72)!important}
    [data-rhythm-note][data-rhythm-failed="true"]>span:last-child{box-shadow:none!important;border-color:rgba(148,163,184,.6)!important}
    /* --- ノーツを取ったときのヒットエフェクト --- */
    /* 判定ラインの高さで、ノーツの幅に合わせて弾ける。要素は使い回すので増えない。
       動かすのは transform と opacity だけ。ぼかし・影・色は動かさないので塗り直しは起きない。

       ★子要素の既定は必ず opacity:0 にする。
         ここを 0 以外にしていると、CSSアニメーション(fill-mode なし)が終わった瞬間に
         元の見た目へ戻ってしまい、判定ラインへ光が10個ぶん residual として残り続ける。
         実機で「タップのとこがわけわかんないことになってる」と言われた原因がこれ(2026-09-05)。 */
    [data-rhythm-hit-layer]{position:absolute;inset:0;pointer-events:none;z-index:3;overflow:hidden}
    [data-rhythm-hit-effect]{position:absolute;bottom:12%;left:var(--rhythm-hit-center,50%);
      width:var(--rhythm-hit-width,12%);height:0;pointer-events:none;
      transform:translateX(-50%)}
    [data-rhythm-hit-effect]>i,[data-rhythm-hit-effect]>b,[data-rhythm-hit-effect]>u{
      position:absolute;display:block;opacity:0;border-radius:999px}
    /* 中心のフラッシュ: 判定ラインの上で横へ広がる帯(プロセカの着弾の光) */
    [data-rhythm-hit-effect]>i{left:0;right:0;top:-7px;height:14px;transform-origin:center;
      background:radial-gradient(closest-side,#fff 0%,var(--rhythm-hit-color,#fff) 40%,rgba(255,255,255,0) 100%)}
    /* 立ち上がる光の柱: 判定ラインから上へ抜ける(チュウニズムの光柱) */
    [data-rhythm-hit-effect]>b{left:0;right:0;bottom:0;height:96px;border-radius:999px 999px 0 0;
      transform-origin:bottom center;
      background:linear-gradient(to top,var(--rhythm-hit-color,#fff) 0%,rgba(255,255,255,.32) 42%,rgba(255,255,255,0) 100%)}
    /* はじける粒: 判定ラインから外へ飛ぶ。飛ぶ向きはCSSで固定なので毎回の計算は要らない */
    [data-rhythm-hit-effect]>u{left:50%;top:0;width:7px;height:7px;margin:-3.5px 0 0 -3.5px;
      background:var(--rhythm-hit-color,#fff)}
    [data-rhythm-hit-effect]>u:nth-of-type(1){--rhythm-spark-x:-54px;--rhythm-spark-y:-56px}
    [data-rhythm-hit-effect]>u:nth-of-type(2){--rhythm-spark-x:-24px;--rhythm-spark-y:-86px}
    [data-rhythm-hit-effect]>u:nth-of-type(3){--rhythm-spark-x:0px;--rhythm-spark-y:-104px}
    [data-rhythm-hit-effect]>u:nth-of-type(4){--rhythm-spark-x:24px;--rhythm-spark-y:-86px}
    [data-rhythm-hit-effect]>u:nth-of-type(5){--rhythm-spark-x:54px;--rhythm-spark-y:-56px}
    [data-rhythm-hit-effect][data-rhythm-hit-kind="NORMAL"]>i{animation:mhRhythmHitCore var(--rhythm-hit-ms,340ms) cubic-bezier(.16,.9,.3,1) 1}
    [data-rhythm-hit-effect][data-rhythm-hit-kind="NORMAL"]>b{animation:mhRhythmHitBeam var(--rhythm-hit-ms,340ms) cubic-bezier(.16,.9,.3,1) 1}
    [data-rhythm-hit-effect][data-rhythm-hit-kind="NORMAL"]>u{animation:mhRhythmHitSpark var(--rhythm-hit-ms,340ms) cubic-bezier(.16,.9,.3,1) 1}
    [data-rhythm-hit-effect][data-rhythm-hit-kind="MONSTER"]>i{animation:mhRhythmHitCoreBig var(--rhythm-hit-ms,900ms) cubic-bezier(.16,.9,.3,1) 1}
    [data-rhythm-hit-effect][data-rhythm-hit-kind="MONSTER"]>b{animation:mhRhythmHitBeamBig var(--rhythm-hit-ms,900ms) cubic-bezier(.16,.9,.3,1) 1}
    [data-rhythm-hit-effect][data-rhythm-hit-kind="MONSTER"]>u{animation:mhRhythmHitSpark var(--rhythm-hit-ms,900ms) cubic-bezier(.16,.9,.3,1) 1}
    @keyframes mhRhythmHitCore{
      0%{opacity:0;transform:scale(.28,.4)}
      12%{opacity:1;transform:scale(1.02,1.9)}
      100%{opacity:0;transform:scale(1.34,.28)}}
    @keyframes mhRhythmHitBeam{
      0%{opacity:0;transform:scale(.68,.08)}
      14%{opacity:.82;transform:scale(1,.74)}
      100%{opacity:0;transform:scale(.52,1.3)}}
    @keyframes mhRhythmHitSpark{
      0%{opacity:0;transform:translate(0,0) scale(.3)}
      12%{opacity:1;transform:translate(calc(var(--rhythm-spark-x,0px)*var(--rhythm-spark-scale,1)*.3),calc(var(--rhythm-spark-y,0px)*var(--rhythm-spark-scale,1)*.3)) scale(1)}
      100%{opacity:0;transform:translate(calc(var(--rhythm-spark-x,0px)*var(--rhythm-spark-scale,1)),calc(var(--rhythm-spark-y,0px)*var(--rhythm-spark-scale,1))) scale(.2)}}
    @keyframes mhRhythmHitCoreBig{
      0%{opacity:0;transform:scale(.3,.5)}
      9%{opacity:1;transform:scale(1.3,3.2)}
      42%{opacity:.9;transform:scale(1.7,1.6)}
      100%{opacity:0;transform:scale(2.1,.3)}}
    @keyframes mhRhythmHitBeamBig{
      0%{opacity:0;transform:scale(.7,.1)}
      10%{opacity:1;transform:scale(1.16,1.5)}
      48%{opacity:.72;transform:scale(1,2.1)}
      100%{opacity:0;transform:scale(.6,2.9)}}
    /* 画面全体を一瞬だけ染める(モンスターノーツだけ)。あらかじめ置いた1枚の
       グラデーションの opacity だけを動かすので、塗り直しは起きない。 */
    [data-rhythm-screen-flash]{position:absolute;inset:0;pointer-events:none;z-index:4;opacity:0;
      background:radial-gradient(120% 60% at 50% 100%,rgba(253,224,71,.42) 0%,rgba(253,224,71,.14) 45%,rgba(253,224,71,0) 100%)}
    [data-rhythm-screen-flash][data-rhythm-flash="1"]{animation:mhRhythmScreenFlash 620ms ease-out 1}
    @keyframes mhRhythmScreenFlash{0%{opacity:0}12%{opacity:1}100%{opacity:0}}
    /* 演出量MINIMAL・軽量モードでは出さない(音は鳴る) */
    [data-rhythm-play-area][data-rhythm-lightweight="true"] [data-rhythm-hit-layer],
    [data-rhythm-play-area][data-rhythm-effect="MINIMAL"] [data-rhythm-hit-layer],
    [data-rhythm-play-area][data-rhythm-lightweight="true"] [data-rhythm-screen-flash],
    [data-rhythm-play-area][data-rhythm-effect="MINIMAL"] [data-rhythm-screen-flash]{display:none!important}
    /* 能力名(「ミーア 元気！」)も出た瞬間に大きく弾ませる。1曲に最大4回しか出ないので大きめに。 */
    [data-rhythm-ability-flash]{animation:mhRhythmAbilityPop 420ms cubic-bezier(.2,1.5,.4,1) 1;
      transform-origin:center;will-change:transform}
    @keyframes mhRhythmAbilityPop{
      0%{transform:translateX(-50%) scale(.5);opacity:0}
      35%{transform:translateX(-50%) scale(1.18);opacity:1}
      60%{transform:translateX(-50%) scale(.96)}
      100%{transform:translateX(-50%) scale(1);opacity:1}}
    [data-rhythm-play-area][data-rhythm-lightweight="true"] [data-rhythm-ability-flash],
    [data-rhythm-play-area][data-rhythm-effect="MINIMAL"] [data-rhythm-ability-flash]{animation:none!important}
    /* 判定文字を一度だけ弾ませる(プロセカのように、出た瞬間だけ大きく) */
    [data-rhythm-judgment-text][data-rhythm-judgment-pop="1"]{animation:mhRhythmJudgmentPop 220ms ease-out 1}
    @keyframes mhRhythmJudgmentPop{
      0%{transform:scale(.72)}
      45%{transform:scale(1.16)}
      100%{transform:scale(1)}}
    [data-rhythm-play-area][data-rhythm-lightweight="true"] [data-rhythm-judgment-text],
    [data-rhythm-play-area][data-rhythm-effect="MINIMAL"] [data-rhythm-judgment-text]{animation:none!important}
    /* コンボ数も1つ増えるたびに弾ませる(プロセカのように数字が跳ねる)。
       HUDはプレイエリアの外にあるので、出す・出さないはJS側の演出量の判定で決める。 */
    [data-rhythm-combo][data-rhythm-combo-pop="1"]{animation:mhRhythmComboPop 180ms ease-out 1;
      transform-origin:center}
    @keyframes mhRhythmComboPop{
      0%{transform:scale(1.34)}
      55%{transform:scale(.97)}
      100%{transform:scale(1)}}
    /* --- 両サイドのマスモン --- */
    /* 動かすのは transform だけ。影・ぼかし・色は動かさないので、跳ねても塗り直しは起きない。
       跳ねる速さは1拍の長さ(--rhythm-side-beat)。曲ごとにプレイ開始時へ一度だけ書く。 */
    [data-rhythm-side-monster]{position:absolute;pointer-events:none;z-index:1;
      opacity:var(--rhythm-side-opacity,.8);will-change:transform}
    /* 絵の入れ物。DyedMonsterImage は染色ありのとき<div>で返るので、ここで大きさを与える。
       object-fit は className(h-full w-full object-contain)側に任せる。
       ここで全imgへ object-fit を書くと、染色マスクの重ね絵が使う objectFit:inherit を壊す。 */
    [data-rhythm-side-monster-art]{display:block;width:100%;height:100%;
      transition:transform 140ms ease-out}
    /* DyedMonsterImage は染色なしなら<img>、染色ありなら<div>で返る。どちらにも大きさを与える。
       className(h-full w-full object-contain)だけに任せると、Tailwindが読めない場面で
       高さ0になって絵が消える(実機で「丸い枠だけ出て絵が出ない」不具合を出した)。
       収め方は直下の要素にだけ書く。中の重ね絵は objectFit:inherit でここから受け取るので、
       全imgへ書くとその仕組みを壊す。 */
    [data-rhythm-side-monster-art]>*{display:block;width:100%;height:100%;object-fit:contain}
    [data-rhythm-side-monster][data-rhythm-side-active="1"] [data-rhythm-side-monster-art]{transform:scale(1.14)}
    [data-rhythm-play-area][data-rhythm-lightweight="true"] [data-rhythm-side-monster-art]{transition:none}
    [data-rhythm-side-monster][data-rhythm-side-motion="NORMAL"]{
      animation:mhRhythmSideHop var(--rhythm-side-beat,500ms) ease-in-out infinite;
      animation-delay:var(--rhythm-side-delay,0ms)}
    [data-rhythm-side-monster][data-rhythm-side-motion="SMALL"]{
      animation:mhRhythmSideHopSmall var(--rhythm-side-beat,500ms) ease-in-out infinite;
      animation-delay:var(--rhythm-side-delay,0ms)}
    @keyframes mhRhythmSideHop{
      0%{transform:translate3d(0,0,0) scale(1)}
      28%{transform:translate3d(0,-16%,0) scale(1.04)}
      55%{transform:translate3d(0,0,0) scale(.97)}
      100%{transform:translate3d(0,0,0) scale(1)}}
    @keyframes mhRhythmSideHopSmall{
      0%{transform:translate3d(0,0,0) scale(1)}
      28%{transform:translate3d(0,-7%,0) scale(1.02)}
      55%{transform:translate3d(0,0,0) scale(.99)}
      100%{transform:translate3d(0,0,0) scale(1)}}
    /* 能力が効いているあいだの強調。輪はあらかじめ用意しておき、出し入れするだけにする
       (影を都度作ると、その要素が毎フレーム塗り直しになる)。 */
    [data-rhythm-side-monster]::after{content:"";position:absolute;inset:-6%;border-radius:999px;
      border:2px solid rgba(253,224,71,.95);opacity:0;transform:scale(.9)}
    [data-rhythm-side-monster][data-rhythm-side-active="1"]{opacity:1!important}
    [data-rhythm-side-monster][data-rhythm-side-active="1"]::after{
      opacity:1;animation:mhRhythmSideRing 900ms ease-out infinite}
    @keyframes mhRhythmSideRing{
      0%{opacity:.95;transform:scale(.92)}
      70%{opacity:0;transform:scale(1.14)}
      100%{opacity:0;transform:scale(1.14)}}
    /* モンスターノーツを取った瞬間、そのマスモンが大きく跳ねる */
    /* モンスターノーツを取った瞬間の歓声。1回だけ再生する。
       【2026-09-05に直した不具合】
       この指定は !important で、しかも「1回だけ」なので、再生が終わったあとも
       data-rhythm-side-hit="1" が付いたままだと待機の動きを打ち消し続け、
       そのマスモンが**曲の終わりまで止まったまま**になっていた。
       いまは歓声が終わったら印を外し、下の「出番のあと」の動きへ戻す。 */
    [data-rhythm-side-monster][data-rhythm-side-hit="1"]{animation:mhRhythmSideCheer 700ms ease-out 1!important}
    /* 出番のあと(自分のモンスターノーツを取ったあと)の待機。
       最初のぴょんぴょんとは別の動きにして、「もう出番は済んだ」ことが見て分かるようにする。
       跳ねるのをやめ、ゆっくり左右へ揺れながら少し傾く。周期は1拍の2倍。 */
    [data-rhythm-side-monster][data-rhythm-side-phase="done"][data-rhythm-side-motion="NORMAL"]{
      animation:mhRhythmSideSway calc(var(--rhythm-side-beat,500ms) * 2) ease-in-out infinite;
      animation-delay:var(--rhythm-side-delay,0ms)}
    [data-rhythm-side-monster][data-rhythm-side-phase="done"][data-rhythm-side-motion="SMALL"]{
      animation:mhRhythmSideSwaySmall calc(var(--rhythm-side-beat,500ms) * 2) ease-in-out infinite;
      animation-delay:var(--rhythm-side-delay,0ms)}
    @keyframes mhRhythmSideSway{
      0%{transform:translate3d(-5%,0,0) rotate(-5deg)}
      50%{transform:translate3d(5%,0,0) rotate(5deg)}
      100%{transform:translate3d(-5%,0,0) rotate(-5deg)}}
    @keyframes mhRhythmSideSwaySmall{
      0%{transform:translate3d(-2%,0,0) rotate(-2deg)}
      50%{transform:translate3d(2%,0,0) rotate(2deg)}
      100%{transform:translate3d(-2%,0,0) rotate(-2deg)}}
    @keyframes mhRhythmSideCheer{
      0%{transform:translate3d(0,0,0) scale(1)}
      22%{transform:translate3d(0,-42%,0) scale(1.22)}
      48%{transform:translate3d(0,4%,0) scale(.94)}
      70%{transform:translate3d(0,-14%,0) scale(1.08)}
      100%{transform:translate3d(0,0,0) scale(1)}}
    [data-rhythm-play-area][data-rhythm-lightweight="true"] [data-rhythm-side-monster],
    [data-rhythm-play-area][data-rhythm-effect="MINIMAL"] [data-rhythm-side-monster]{animation:none!important}
    [data-rhythm-play-area][data-rhythm-lightweight="true"] [data-rhythm-side-monster]::after,
    [data-rhythm-play-area][data-rhythm-effect="MINIMAL"] [data-rhythm-side-monster]::after{animation:none!important}
    [data-rhythm-judgment-line]{height:4px!important;background:linear-gradient(90deg,#d8b4fe 0%,#ecfeff 50%,#d8b4fe 100%)!important;border-radius:999px;box-shadow:0 0 14px #67e8f9,0 0 28px #c084fc,0 8px 24px rgba(34,211,238,.34)!important}
    /* 判定ラインを曲の拍に合わせて静かに脈打たせる(2026-09-05・演出強化)。
       1拍の長さ(--rhythm-beat)はプレイ開始時に一度だけ書くので、毎フレームのJSは増えない。
       動かすのは opacity と scaleY だけなので、レイアウトも塗り直しも起こさない。
       判定ラインの「位置」は変えない(transform-origin を中央にして厚みだけを変える)ので、
       判定・入力・当たり判定には一切影響しない。 */
    @keyframes mhRhythmLinePulse{
      0%{opacity:1;transform:scaleY(1)}
      12%{opacity:1;transform:scaleY(1.35)}
      55%{opacity:.86;transform:scaleY(1)}
      100%{opacity:1;transform:scaleY(1)}}
    [data-rhythm-judgment-line]{transform-origin:50% 50%;will-change:transform,opacity;
      animation:mhRhythmLinePulse var(--rhythm-beat,500ms) ease-out infinite}
    /* 軽量モードと演出量MINIMALでは止める(ほかの演出と同じ扱い) */
    [data-rhythm-play-area][data-rhythm-lightweight="true"] [data-rhythm-judgment-line],
    [data-rhythm-play-area][data-rhythm-effect="MINIMAL"] [data-rhythm-judgment-line]{animation:none!important;will-change:auto}
  `;
  document.head.appendChild(style);
};
installRhythmGeometryStyles();

// --- ノーツを取ったときのヒットエフェクト ---
// 実機で「画面演出はあまりかわってない」「プロセカ、チュウニズムのようなのを参考に」
// 「モンスターノーツ踏んだときは音も演出も地味すぎる」と言われて足した(2026-09-05)。
//
// 以前は「ノーツ1枚ごとの派手なエフェクトは重いので入れない」としていたが、
// あのとき実機でカクついた原因は**画面いっぱいのぼかしを押すたびに描き直していた**ことで、
// エフェクトそのものが重かったわけではない。次を守れば発熱時でも負担は増えない。
//
//   ・要素は**あらかじめ作って使い回す**(押すたびにDOMを増やさない)
//   ・動かすのは transform と opacity **だけ**。ぼかし・影・色は動かさない
//   ・光り方はCSSアニメーションなので、毎フレームのJSは走らない
//   ・1回の発生で書くのは「位置・幅・色・種類」の数個だけ
//
// 使い回す枚数。同時にこれ以上重なることは実際には無く、足りなければ古いものから奪う。
const RHYTHM_HIT_EFFECT_POOL=10;
// 1枚あたりに仕込む「はじける粒」の数。飛ぶ向きはCSS側に書いてある。
const RHYTHM_HIT_SPARK_COUNT=5;
// ふつうのノーツと、モンスターノーツ(1曲に最大4回)で光の大きさ・長さを変える。
const RHYTHM_HIT_EFFECT_MS=Object.freeze({NORMAL:340,MONSTER:900});
const RHYTHM_HIT_EFFECT_JUDGMENT_COLORS=Object.freeze({
  MARVELOUS:'#f5d0fe',EXCELLENT:'#a5f3fc',GREAT:'#fde68a',GOOD:'#bef264',BAD:'#fda4af',
});
const rhythmHitEffectColor=judgment=>RHYTHM_HIT_EFFECT_JUDGMENT_COLORS[String(judgment||'')]||'#e2e8f0';
// プレイエリアの中に、使い回すエフェクトの入れ物を用意する。すでにあれば作り直さない。
const rhythmEnsureHitEffects=area=>{
  if(!area||typeof document==='undefined')return null;
  let layer=area.querySelector('[data-rhythm-hit-layer]');
  if(layer&&layer._rhythmPool)return layer;
  if(!layer){
    layer=document.createElement('div');
    layer.dataset.rhythmHitLayer='';
    area.appendChild(layer);
  }
  layer.innerHTML='';
  layer._rhythmPool=[];
  layer._rhythmNext=0;
  for(let index=0;index<RHYTHM_HIT_EFFECT_POOL;index++){
    const item=document.createElement('span');
    item.dataset.rhythmHitEffect='';
    item.appendChild(document.createElement('i'));   // 中心のフラッシュ
    item.appendChild(document.createElement('b'));   // 立ち上がる光の柱
    // はじける粒。飛ぶ向きはCSSの nth-of-type で決めてあるので、ここでは数だけ揃える
    for(let spark=0;spark<RHYTHM_HIT_SPARK_COUNT;spark++)item.appendChild(document.createElement('u'));
    layer.appendChild(item);
    layer._rhythmPool.push(item);
  }
  return layer;
};
// 判定ラインの高さでノーツの幅に合わせて光らせる。span は 0〜1 のプレイエリア比で受け取る。
const rhythmSpawnHitEffect=(area,{centerRatio,widthRatio,judgment,monster=false})=>{
  const layer=rhythmEnsureHitEffects(area);
  if(!layer||!layer._rhythmPool.length)return null;
  const item=layer._rhythmPool[layer._rhythmNext%layer._rhythmPool.length];
  layer._rhythmNext=(layer._rhythmNext+1)%layer._rhythmPool.length;
  const kind=monster?'MONSTER':'NORMAL';
  const width=Math.max(.06,Math.min(1,Number(widthRatio)||.1))*(monster?1.5:1.15);
  item.style.setProperty('--rhythm-hit-center',`${(Math.max(0,Math.min(1,Number(centerRatio)||.5))*100).toFixed(2)}%`);
  item.style.setProperty('--rhythm-hit-width',`${(width*100).toFixed(2)}%`);
  item.style.setProperty('--rhythm-hit-color',monster?'#fde047':rhythmHitEffectColor(judgment));
  item.style.setProperty('--rhythm-hit-ms',`${RHYTHM_HIT_EFFECT_MS[kind]}ms`);
  item.style.setProperty('--rhythm-spark-scale',monster?'2.1':'1');
  // 同じ要素をすぐ使い回すときは、アニメーションを一度切らないと最初から再生されない
  item.dataset.rhythmHitKind='';
  void item.offsetWidth;
  item.dataset.rhythmHitKind=kind;
  return item;
};

// --- プレイ画面の両サイドへ出すマスモン ---
// レーンは奥へ向かって狭くなる台形なので、その外側に「上が広く下が狭い三角形」の空きができる。
// 実機で「画面の空いてる両サイドに設定してるマスモンを出して音にあわせてピョンピョンするとか可能？」
// と言われて足した(2026-09-05)。
//
// **発熱に強い作りにすることだけを条件にしている。**
//   ・動かすのは transform だけ。影・ぼかし・色は動かさない(毎フレームの塗り直しを増やさない)
//   ・跳ねるのはCSSアニメーションなので、毎フレームのJSは一切走らない
//   ・置き場所と大きさは、プレイエリアの大きさが変わったときだけ測り直す
//   ・能力が効いているあいだの強調は、状態が変わった瞬間に属性を1つ書き換えるだけ
//
// 縦の置き場所。0=画面上端 / 1=下端。HUD(スコア・ライフ・コンボ)の下、判定ラインより上へ置く。
const RHYTHM_SIDE_MONSTER_ANCHORS=Object.freeze([.30,.52]);
// 空いている幅のうち、実際に使う割合。1.0にすると台形の縁へ触れるので余白を残す。
const RHYTHM_SIDE_MONSTER_FILL=.72;
// プレイエリア幅に対する最大の大きさ。大きすぎるとノーツから目線が外れる。
const RHYTHM_SIDE_MONSTER_MAX_RATIO=.17;
// 能力を取った瞬間の強調を出しておく時間(元気のように一瞬で終わる能力のため)
const RHYTHM_SIDE_MONSTER_FLASH_MS=1200;
// 跳ねる高さ(自分の大きさに対する割合)。段階はオプションで選べる。
const RHYTHM_SIDE_MONSTER_MOTIONS=Object.freeze(['NONE','SMALL','NORMAL']);
const RHYTHM_SIDE_MONSTER_OPACITIES=Object.freeze(['OFF','FAINT','SOFT','NORMAL']);
const rhythmSideMonsterOpacityValue=level=>level==='FAINT'?.22:level==='SOFT'?.45:level==='NORMAL'?.8:0;
// 何枠目をどちら側へ置くか。1・3が左、2・4が右(登場順が左右へ交互に並ぶ)。
const rhythmSideMonsterPlacement=slot=>{
  const index=Math.max(1,Math.min(4,Math.trunc(Number(slot))||1))-1;
  return {side:index%2===0?'left':'right',row:Math.floor(index/2)};
};
// レーンの外側に空いている幅(プレイエリア幅に対する割合)から、置き場所と大きさを決める。
const rhythmSideMonsterBox=(slot,areaWidth,areaHeight)=>{
  const {side,row}=rhythmSideMonsterPlacement(slot);
  const centerY=RHYTHM_SIDE_MONSTER_ANCHORS[Math.min(RHYTHM_SIDE_MONSTER_ANCHORS.length-1,row)];
  // その高さでレーンが始まる位置。左端0からそこまでが空き。
  const width=Number(areaWidth||0),height=Number(areaHeight||0);
  // まず真ん中の高さで大きさを決め、そのあと**箱の下端**でも収まるか確かめて縮める。
  // 台形は下へ行くほど空きが狭くなるので、真ん中だけで決めると下の角がレーンへ食い込む。
  const freeAt=y=>Math.max(0,rhythmProjectBoundary(0,Math.max(0,Math.min(1,y))));
  const sizeFor=free=>Math.max(24,Math.min(RHYTHM_SIDE_MONSTER_MAX_RATIO,free*RHYTHM_SIDE_MONSTER_FILL)*width);
  let size=sizeFor(freeAt(centerY));
  for(let pass=0;pass<3;pass++){
    const bottomRatio=height>0?centerY+size/2/height:centerY;
    const limited=sizeFor(freeAt(bottomRatio));
    if(limited>=size-.5)break;
    size=limited;
  }
  const free=freeAt(height>0?centerY+size/2/height:centerY);
  // 空きの真ん中へ置く。台形の縁にも画面の端にも寄りすぎないため。
  const centerRatio=side==='left'?free/2:1-free/2;
  return {side,size,left:centerRatio*width-size/2,top:centerY*height-size/2};
};
// 曲の1拍の長さ(ms)。両サイドのマスモンが跳ねる速さをここへ合わせる。
// 正本は data/rhythm-timing.js だが、そちらは配信物へ含めていない(譜面づくり用の道具が読む)。
// ここは「跳ねる速さ」だけに使う写しで、値がずれていないことは
// tools/mode/rhythm-side-monster-check.js が rhythm-timing.js と突き合わせて見張る。
const RHYTHM_TRACK_BEAT_MS=Object.freeze({
  atsu_cup_theme:355,
  monster_hero_theme:347,
});
const rhythmSideMonsterBeatMs=trackId=>{
  const beat=Number(RHYTHM_TRACK_BEAT_MS[String(trackId||'')]);
  return Number.isFinite(beat)&&beat>=120&&beat<=2000?Math.round(beat):500;
};
const rhythmLayoutSideMonsters=area=>{
  if(!area)return;
  const rect=area.getBoundingClientRect();
  if(!(rect.width>0&&rect.height>0))return;
  Array.from(area.querySelectorAll('[data-rhythm-side-monster]')).forEach(el=>{
    const box=rhythmSideMonsterBox(Number(el.dataset.rhythmSideMonster),rect.width,rect.height);
    const next=`${box.left.toFixed(1)},${box.top.toFixed(1)},${box.size.toFixed(1)}`;
    if(el._rhythmSideBox===next)return;
    el._rhythmSideBox=next;
    el.style.left=`${box.left.toFixed(1)}px`;
    el.style.top=`${box.top.toFixed(1)}px`;
    el.style.width=`${box.size.toFixed(1)}px`;
    el.style.height=`${box.size.toFixed(1)}px`;
  });
};

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
  rhythmLayoutSideMonsters(area);
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
  const projected=rhythmNoteIsSlide(note)?rhythmProjectSlideSpan(lane,note,yRatio,slideTravel?.chartNowMs):rhythmNoteVisualSpan(note,lane,yRatio,slideTravel?.chartNowMs),projectedWidth=rect.width*projected.width,width=Math.min(projectedWidth,Math.max(4,projectedWidth*RHYTHM_NOTE_WIDTH_RATIO)),left=rect.width*projected.center-width/2;
  // 横位置をleftで毎フレーム書くとlayout系の更新になる。縦は本体transformで動かしているため、
  // CSS Transforms Level 2の独立translateへ横移動だけ分離し、見た目の座標を変えず合成側へ寄せる。
  // left=0 + translateX(left) なので、HOLD/SLIDEのbodyが使う -left の補正も従来と同じ実座標になる。
  if(el._rhythmPositionOrigin!==true){el.style.left='0px';el._rhythmPositionOrigin=true;}
  const nextTranslate=`${left.toFixed(2)}px 0px`;
  if(el._rhythmTranslate!==nextTranslate){el.style.translate=nextTranslate;el._rhythmTranslate=nextTranslate;}
  const nextWidth=`${width.toFixed(2)}px`;
  if(el._rhythmWidth!==nextWidth){el.style.width=nextWidth;el._rhythmWidth=nextWidth;}
  // 奥行きの拡大率と明るさは、それぞれ transform:scaleY() と filter:brightness() へ入る。
  // filterの値が毎フレーム変わると、その要素はGPUで動かすだけでは済まず毎フレーム
  // 「塗り直し(ラスタライズ)」が必要になる。塗り直しの重さは画素数に比例するので、
  // 画面の広い端末(iPhone 16e=2.96M画素)ではSE2(1.00M画素)の約3倍の負担になり、
  // 発熱してGPUが絞られるとそのままカクつきになる。
  //
  // そこで0.01刻みへ丸め、値が実際に変わったときだけ書く。
  //   ・明るさ … 0.72〜1.00を0.01刻み(=1%刻み)。目では区別できない
  //   ・拡大率 … 0.56〜1.00を0.01刻み。ノーツ高さ22pxなら1段0.22pxで画素より細かい
  // 実測(Chromium・16e相当の画素数・同時表示4ノーツ)で
  // 書き込み 8.0回/frame → 1.4回/frame、フレーム中央値 1.90ms → 1.20ms(-37%)。
  // 判定・当たり判定・ノーツの位置と大きさの決まり方そのものは一切変えていない。
  const depthScale=(Math.round((0.56+projected.scale*.44)*100)/100).toFixed(2);
  const depthBrightness=(Math.round((0.72+projected.scale*.28)*100)/100).toFixed(2);
  if(el._rhythmDepthScale!==depthScale){el.style.setProperty('--rhythm-note-depth-scale',depthScale);el._rhythmDepthScale=depthScale;}
  if(el._rhythmDepthBrightness!==depthBrightness){el.style.setProperty('--rhythm-note-depth-brightness',depthBrightness);el._rhythmDepthBrightness=depthBrightness;}
  // TAP/FLICKにはこのbodyが存在しない。nullもキャッシュしないと、表示中ずっと毎フレーム
  // querySelectorで「無い」ことを探し直すため、存在しない結果も1回で覚える。
  let body;
  if(Object.prototype.hasOwnProperty.call(el,'_rhythmVisualBody'))body=el._rhythmVisualBody;
  else{RHYTHM_PERF.domQuery();body=el.querySelector('[data-rhythm-hold-body],[data-rhythm-slide-body]');el._rhythmVisualBody=body||null;}
  if(!body)return;
  if(body.hasAttribute('data-rhythm-slide-body')){
    // 位置(left/top)は毎フレーム動くが、幅・高さ・viewBoxはプレイエリアの大きさそのもので
    // 遊んでいるあいだ変わらない。それでも毎フレーム書き直すと、プレイエリア全面サイズの
    // SVGを毎フレーム作り直させることになる(とくにviewBoxの再設定は中身の再構築を招く)。
    // 変わったときだけ書く。見た目は同じ。
    const slideLeft=`${(-left).toFixed(2)}px`;
    if(body._rhythmSlideLeft!==slideLeft){body.style.left=slideLeft;body._rhythmSlideLeft=slideLeft;}
    const slideTop=`${(-Number(yPx)).toFixed(2)}px`;
    if(body._rhythmSlideTop!==slideTop){body.style.top=slideTop;body._rhythmSlideTop=slideTop;}
    const slideArea=`${rect.width.toFixed(2)}x${rect.height.toFixed(2)}`;
    if(body._rhythmSlideArea!==slideArea){
      body.style.width=`${rect.width.toFixed(2)}px`;
      body.style.setProperty('--rhythm-slide-area-height',`${rect.height.toFixed(2)}px`);
      body.setAttribute('viewBox',`0 0 ${rect.width} ${rect.height}`);
      body._rhythmSlideArea=slideArea;
    }
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
  // 幅が途中で変わるHOLD(holdPoints)は「幅が変わる時刻」が帯のどの高さに当たるかを先に出し、
  // そこを必ず頂点にする。高さの比だけで刻むと、落下が曲線(projection)であるぶん
  // 幅の変わり目が実際の時刻からずれる(速いほどずれる)。
  const holdAnchors=variableHold&&rhythmNoteHasHoldPoints(note)&&height>0&&slideTravel&&Number(slideTravel.travelMs)>0
    ?(()=>{
      const travelMs=Number(slideTravel.travelMs),visualTime=Number(slideTravel.visualTime);
      const yAtMs=timeMs=>Number(slideTravel.spawnY)+rhythmProjectTravelProgress(1-(Number(timeMs)-visualTime)/travelMs)*Number(slideTravel.travelPx)+noteHeight/2;
      const headMs=Math.max(Number(note.timeMs)||0,Number(slideTravel.chartNowMs)||0),endMs=rhythmReleaseTargetMs(note);
      const times=[endMs,...note.holdPoints.map(point=>Number(point.timeMs)),headMs]
        .filter(timeMs=>Number.isFinite(timeMs)&&timeMs>=Math.min(headMs,endMs)&&timeMs<=Math.max(headMs,endMs));
      const anchors=times.map(timeMs=>({ratio:rhythmClamp01((yAtMs(timeMs)-bodyTopY)/height),span:rhythmHoldSpanAt(note,timeMs)}))
        .sort((a,b)=>a.ratio-b.ratio);
      return anchors.length>=2?anchors:null;
    })()
    :null;
  const holdSpanAtRatio=ratio=>{
    if(!holdAnchors)return null;
    if(ratio<=holdAnchors[0].ratio)return holdAnchors[0].span;
    for(let index=1;index<holdAnchors.length;index++){
      const a=holdAnchors[index-1],b=holdAnchors[index];
      if(ratio<=b.ratio){
        const gap=b.ratio-a.ratio;
        if(!(gap>1e-9))return b.span;
        const p=(ratio-a.ratio)/gap;
        return {subLane:a.span.subLane+(b.span.subLane-a.span.subLane)*p,subLaneWidth:a.span.subLaneWidth+(b.span.subLaneWidth-a.span.subLaneWidth)*p};
      }
    }
    return holdAnchors[holdAnchors.length-1].span;
  };
  const edgeAt=ratio=>{
    const yRatioAt=rhythmClamp01((bodyTopY+height*ratio)/rect.height);
    const holdSpan=holdSpanAtRatio(ratio);
    const span=holdSpan?rhythmProjectSubLaneRange(holdSpan.subLane,holdSpan.subLaneWidth,yRatioAt)
      :variableHold?rhythmNoteVisualSpan(note,lane,yRatioAt)
      :rhythmProjectLane(lane,yRatioAt);
    const half=span.width*bodyRatio/2;
    return {left:span.center-half,right:span.center+half};
  };
  // 画面上端はprojectionの曲がりが一番きついので、帯がそこを跨ぐときは必ず点を置く。
  const topEdgeRatio=height>0?(0-bodyTopY)/height:0;
  const extraRatios=[
    ...(topEdgeRatio>1e-6&&topEdgeRatio<1-1e-6?[topEdgeRatio]:[]),
    ...(holdAnchors?holdAnchors.map(anchor=>anchor.ratio).filter(ratio=>ratio>1e-6&&ratio<1-1e-6):[]),
  ];
  const bodyRatios=extraRatios.length
    ?[...rhythmProjectionEdgeRatios(),...extraRatios].sort((a,b)=>a-b)
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
    const endY=rhythmClamp01((Number(releaseYpx)+noteHeight/2)/rect.height),end=rhythmNoteHasVariableSpan(note)&&note.type==='HOLD'?rhythmNoteVisualSpan(note,lane,endY,rhythmReleaseTargetMs(note)):rhythmNoteIsSlide(note)?rhythmProjectSlideSpan(rhythmReleaseLane(note),note,endY,rhythmReleaseTargetMs(note)):rhythmProjectLane(rhythmReleaseLane(note),endY),barWidth=Math.max(10,rect.width*end.width*RHYTHM_NOTE_WIDTH_RATIO);
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

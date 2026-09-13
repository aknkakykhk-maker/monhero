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
//
// 【2026-09-11・外側の2つ(GOOD/BAD)だけ狭める】
//   GOOD 200→170 / BAD 240→185。MARVELOUS〜GREATは動かさない。
// ユーザー指示「グッドとバッド判定を狭くするのと同時に進めたい / ぶっちゃけこのふたつは
// ミスみたいなもん ただし判定が広い必要はないと思ってる」。
//
// 狭めるのが「タップ判定の巻き込み」の対策そのものでもある。入力をどのノーツへ結びつけるかの
// 探索範囲(RHYTHM_INPUT_MATCH_WINDOW_MS)は判定表のいちばん外側から作っているので、
// BADを240→185へ縮めると、取りこぼしたノーツが次のタップを奪える射程がそのまま55ms短くなる。
// GOODを200→170にしたぶんコンボは切れやすくなるが、巻き込みが直るぶんと相殺される見込み。
// よその音ゲーのいちばん外側はおおむね±150〜200msなので、185msはまだ広いほう。
const RHYTHM_JUDGMENTS = Object.freeze([
  Object.freeze({ id:'MARVELOUS', windowMs:55, scoreRate:1 }),
  Object.freeze({ id:'EXCELLENT', windowMs:100, scoreRate:.98 }),
  Object.freeze({ id:'GREAT', windowMs:150, scoreRate:.9 }),
  Object.freeze({ id:'GOOD', windowMs:170, scoreRate:.7 }),
  Object.freeze({ id:'BAD', windowMs:185, scoreRate:.3 }),
  Object.freeze({ id:'MISS', windowMs:null, scoreRate:0 }),
]);
// コンボがつながる judgment かどうか。BAD と MISS はどちらもコンボが切れるので、
// 「取れた/取れない」の意味ではこの2つは同じ側にいる。
const RHYTHM_COMBO_SAFE_JUDGMENT_IDS = Object.freeze(['MARVELOUS','EXCELLENT','GREAT','GOOD']);
// コンボがつながる範囲(=GOODの窓)。入力をどのノーツへ当てるかを決めるとき、
// 「まだコンボがつながる相手」を「もうBADにしかならない相手」より必ず先に見るために使う。
const RHYTHM_COMBO_SAFE_WINDOW_MS = RHYTHM_JUDGMENTS
  .filter(judgment=>RHYTHM_COMBO_SAFE_JUDGMENT_IDS.includes(judgment.id))
  .reduce((widest,judgment)=>Math.max(widest,judgment.windowMs),0);
// 入力をどのノーツに当てるかを探す範囲。**判定窓のいちばん外側と必ず同じにする**。
// 以前はここに 200 という数字を直接書いていたため、判定窓を広げても
// 受け付ける範囲が広がらず、いちばん外側の判定(BAD)へ永遠に届かない状態になりかねなかった。
// 判定表から作れば、窓を変えるだけで両方そろう。
const RHYTHM_INPUT_MATCH_WINDOW_MS = RHYTHM_JUDGMENTS
  .reduce((widest,judgment)=>Number.isFinite(judgment.windowMs)?Math.max(widest,judgment.windowMs):widest,0);
// タップの「どのノーツを狙ったか」は判定ランクとは別に決める。
// 判定窓は遊びやすさのため最大±185msあるが、その全域を前ノーツの所有時間にはしない。
// 隣り合う候補の間は前ノーツへ75%寄せ、次ノーツが早取りできる範囲もMARVELOUS窓以内に制限する。
// これで16分88msなら切替は前から66ms地点: +60msの遅押しは前、次の-22ms以降は次を狙った入力として扱う。
const RHYTHM_TAP_TARGET_PREVIOUS_SHARE=.75;
const RHYTHM_TAP_TARGET_UPCOMING_MAX_EARLY_MS=RHYTHM_JUDGMENTS.find(judgment=>judgment.id==='MARVELOUS')?.windowMs||55;
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
// 飛んだフレームを控える上限。多すぎると記録そのものが負担になるので頭打ちにする
const RHYTHM_PERF_SPIKE_MAX=40;
const RHYTHM_PERF=(()=>{
  // notesScanned / notesDrawn は「毎フレーム何ノーツを見て、実際に何ノーツ描き替えたか」。
  // worst* は、いちばん長かったフレームの直前に数えたぶんを保存したもの。
  // 「長いフレームで何が増えていたのか」を切り分けるために持つ。
  const zero=()=>({frames:0,totalMs:0,maxMs:0,long:[0,0,0],layoutReads:0,domQueries:0,slidePolygons:0,gestureFrames:0,noteRescans:0,
    notesScanned:0,notesDrawn:0,pendingScanned:0,pendingDrawn:0,worstScanned:0,worstDrawn:0,
    tickMs:0,pendingTickMs:0,worstTickMs:0,maxTickMs:0,headSkipped:0,pendingHeadSkipped:0,narrowed:null,
    tickDelayMs:0,pendingDelayMs:0,worstDelayMs:0,maxDelayMs:0,
    // 曲の再生位置が1フレームでどれだけ進んだか。ノーツの位置はこれで決まる
    songSteps:0,songStepSum:0,songStepMax:0,songStalls:0,lastSongMs:null,
    // ノーツを取ったときの処理にかかった時間。モンスターノーツだけ別に数える
    judgeCount:0,judgeSum:0,judgeMax:0,monsterCount:0,monsterSum:0,monsterMax:0,
    // 大きく飛んだフレームを「起きたときに1件ずつ」控える。
    // 平均や最大だけだと「たまに起きる」ものは埋もれる(実機で4回とも2.0msだった)。
    spikes:[],lastMonsterAtMs:0});
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
          // 2フレーム以上飛んだら、そのときの状況をそのまま控える。
          // 「いつ・どれだけ飛んで・そのときJSは何をしていて・直前にモンスターノーツを
          // 踏んでいたか」が1件ずつ残るので、たまにしか起きないものでも捕まえられる。
          // pendingTickMs はこの下でリセットされるので、必ずその前に読むこと。
          if(dt>RHYTHM_PERF_LONG_MS[2]&&acc.spikes.length<RHYTHM_PERF_SPIKE_MAX){
            acc.spikes.push({
              at:Math.round(Number(acc.lastSongMs)||0),
              dt:Math.round(dt),
              tick:Math.round(acc.pendingTickMs*10)/10,
              delay:Math.round(acc.pendingDelayMs*10)/10,
              scan:acc.pendingScanned,draw:acc.pendingDrawn,
              mon:acc.lastMonsterAtMs?Math.round(t-acc.lastMonsterAtMs):-1,
            });
          }
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
    // 曲の再生位置(run.audio.songTimeMs())が1フレームでどれだけ進んだかを数える。
    // ノーツの位置はこの時刻だけで決まり、演奏ループは rAF のタイムスタンプで補間していない。
    // 再生位置は AudioContext.currentTime そのもの(14-audio.jsx の songTimeSeconds)なので、
    // 端末のオーディオのバッファが大きいと数十msごとにしか進まないことがある。
    // そうなるとノーツは「何フレームか止まって、一気に飛ぶ」動きになる。
    // **フレームレートは60fpsのままなので、フレーム間隔をいくら測っても見つからない。**
    // stall(進まなかったフレーム)の割合と、いちばん大きく飛んだ量を見る。
    songTime(ms){
      if(!on)return;
      const v=Number(ms);if(!Number.isFinite(v))return;
      if(acc.lastSongMs!==null){
        const d=v-acc.lastSongMs;
        // 一時停止・やり直しで巻き戻る/飛ぶぶんは数えない
        if(d>=0&&d<2000){acc.songSteps++;acc.songStepSum+=d;if(d>acc.songStepMax)acc.songStepMax=d;if(d<=0)acc.songStalls++;}
      }
      acc.lastSongMs=v;
    },
    // ノーツを取ったときの処理(applyJudgment)にかかった時間。
    // 実機で「モンスターノーツを踏むと固まる」と報告されたので、ふつうのノーツと分けて数える。
    // ここで測るのは判定・スコア・ライフの更新と setView(Reactの再描画の要求)まで。
    // 光と画面フラッシュの発動は別に測ってあり、そちらは1フレームぶんの遅れも出ていない。
    judge(ms,monster){
      if(!on)return;
      const v=Number(ms);if(!Number.isFinite(v)||v<0)return;
      acc.judgeCount++;acc.judgeSum+=v;if(v>acc.judgeMax)acc.judgeMax=v;
      if(monster){acc.monsterCount++;acc.monsterSum+=v;if(v>acc.monsterMax)acc.monsterMax=v;
        // 踏んだ時刻を控える。光と画面フラッシュは**次のフレームから**900ms続くので、
        // 「踏んだあとに飛んだか」はこの時刻からの経過で見る
        if(typeof performance!=='undefined')acc.lastMonsterAtMs=performance.now();}
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
        // 曲の時刻の進み方。songStallRate が高いほど「止まって飛ぶ」動きになる
        songStepMsPerFrame:acc.songSteps?acc.songStepSum/acc.songSteps:0,
        songStepMaxMs:acc.songStepMax,
        songStallRate:acc.songSteps?acc.songStalls/acc.songSteps:0,
        songSteps:acc.songSteps,
        judgeMsAvg:acc.judgeCount?acc.judgeSum/acc.judgeCount:0,
        judgeMsMax:acc.judgeMax,
        judgeCount:acc.judgeCount,
        monsterJudgeMsAvg:acc.monsterCount?acc.monsterSum/acc.monsterCount:0,
        monsterJudgeMsMax:acc.monsterMax,
        monsterJudgeCount:acc.monsterCount,
        spikes:acc.spikes.slice(),
        narrowed:acc.narrowed,
      };
    },
  };
  api.restore();
  return api;
})();

// 演奏画面の「重そうな装飾」を個別に切って、実機で何が効くかを切り分けるための逃げ道。
// デバッグ限定で、ふだんは空。プレイヤーの通常プレイでは何も起きない。
// 保存は新しいキーへ分ける(既存の音ゲー設定・BESTには触らない)。
const RHYTHM_STRIP_KEY='mh_rhythm_strip_v1';
const RHYTHM_STRIP_ITEMS=Object.freeze([
  {id:'glow',label:'上の光（blur 12px）'},
  {id:'grid',label:'奥行きの格子（drop-shadow）'},
  {id:'bg',label:'背景のグラデーション3層'},
  {id:'lane',label:'レーンの影と縁'},
]);
const RHYTHM_STRIP=(()=>{
  let value='';
  const api={
    get value(){return value;},
    has(id){return value.split(/\s+/).includes(id);},
    set(next){value=String(next||'').trim();
      try{if(typeof localStorage!=='undefined')localStorage.setItem(RHYTHM_STRIP_KEY,value);}catch{}
      return value;},
    toggle(id){const set=new Set(value.split(/\s+/).filter(Boolean));
      if(set.has(id))set.delete(id);else set.add(id);
      return api.set([...set].join(' '));},
    restore(){try{if(typeof localStorage!=='undefined')value=localStorage.getItem(RHYTHM_STRIP_KEY)||'';}catch{}return value;},
  };
  api.restore();
  return api;
})();

const RHYTHM_PROJECTION_TOP_SCALE=.18;
const RHYTHM_NOTE_WIDTH_RATIO=.78;
// HOLD/SLIDEの帯の太さ。ノーツの頭(.78)より細い。
//
// 【2026-09-11・一度 .78 へそろえようとして戻した】
// 見えている帯(幅2で42px)と、追従で実際に許される幅(±0.82レーン=108px)には
// 2.6倍の食い違いがある。細く見えるぶん細く狙ってしまうので頭と同じ .78 にしたところ、
// 隣のノーツの帯が「何も無いはず」の場所へはみ出した
// (tools/mode/rhythm-canvas-render-check.js が検出)。食い違いは 2.56→2.10倍に
// なるだけで得が小さく、見た目の衝突に見合わないため戻した。
// 「狙いどころが細く見える」問題は、帯を太くする以外の見せ方で別途考える。
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
// 描くときに見る「元の種類」。指で触ると HOLD / FLICK / SLIDE は判定のために type が 'HOLD' へ化ける
// (RHYTHM_GESTURE_RUNTIME.bind。FLICK は終端を60秒先へ置いて指の動きを待つ)。
// 見た目の判断に note.type を使うと、触って取り損ねた FLICK が「終端が60秒先の失敗した HOLD」に見えてしまい、
// canvas 版ではレーン全体の薄い灰色の帯が1分間残った(2026-09-08・実機「レーンに白いあとが出続けた」)。
const rhythmNoteVisualType=note=>note?._rhythmOriginalType||note?.type;
const rhythmNoteIsHold=note=>rhythmNoteVisualType(note)==='HOLD';
// 帯を持つ(=取り損ねたとき終端まで薄く流す)のは、元が HOLD か SLIDE のノーツだけ
const rhythmNoteHasBody=note=>rhythmNoteIsHold(note)||rhythmNoteIsSlide(note);
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
// --- 判定ラインの「幅」を画面で見せる（2026-09-06・ユーザー指示
//     「タップ判定ラインの表示を上下goodラインまで広げて真ん中にマーベラスラインを出す」）---
//
// 判定はミリ秒(MARVELOUS±55 / GOOD±200)で決まるのに、線が1本しか出ていなかったので、
// プレイヤーからは「どこからどこまでなら取れるのか」がまったく見えなかった。
// ノーツが流れる時間(travelMs)と流れる距離(travelPx)が分かれば、判定窓はそのまま画面のpxへ直せる。
//
// ノーツの縦位置は progress(0=出た瞬間 / 1=判定ライン)に対して
// rhythmProjectTravelProgress で曲がるので、**線の上側と下側で幅が違う**（下のほうが広い）。
// ごまかして左右対称にはしない。見えている幅は本当に取れる幅と同じにする。
//
// ここで返すのは見た目の位置だけで、判定そのもの（窓・タイミング・スコア）には一切関与しない。
const rhythmJudgmentWindowMs=id=>{
  const found=RHYTHM_JUDGMENTS.find(judgment=>judgment.id===id);
  return Number(found&&found.windowMs)||0;
};
const rhythmJudgmentBandLayout=(travel,travelMs)=>{
  if(!travel)return null;
  const height=Number(travel.playAreaHeight),span=Number(travel.travelPx),ms=Number(travelMs);
  if(!(height>0)||!(span>0)||!(ms>0))return null;
  const noteHalf=(Number(travel.noteHeight)||0)/2;
  const yAt=offsetMs=>{
    const y=Number(travel.spawnY)+rhythmProjectTravelProgress(1+offsetMs/ms)*span+noteHalf;
    return Math.max(0,Math.min(height,y));
  };
  const good=rhythmJudgmentWindowMs('GOOD'),marvelous=rhythmJudgmentWindowMs('MARVELOUS');
  const top=yAt(-good),bottom=yAt(good),center=yAt(0);
  const bandHeight=Math.max(1,bottom-top);
  return {
    top,height:bandHeight,center,
    // 帯の中で判定ちょうどの線がどこに来るか(0〜1)。上下で幅が違うので0.5にはならない。
    centerRatio:Math.max(0,Math.min(1,(center-top)/bandHeight)),
    marvelousTop:yAt(-marvelous),marvelousBottom:yAt(marvelous),
  };
};
// ============================================================================
// 自前で画面を回す(向きの固定が効かない端末のための二の矢)
// ============================================================================
// 【2026-09-06・ユーザーからの相談】
// 「これって端末の設定とか関係なく強制的に画面の向きを変えられないの？」
//
// 【答え: APIでは無理】
// ページから端末の向きを変える手段は screen.orientation.lock() ひとつしか無く、
//   ・Androidは**全画面のあいだしか**許さない(抜けた瞬間に外れる)
//   ・iOSのSafariには機能そのものが無い(iPhone・iPadは全滅)
//   ・LINE・X・Instagramなどのアプリ内ブラウザは全画面を塞いでいるので断られる
//   ・ブラウザ側の判断でいつでも拒否できる
// これに頼るかぎり「できない端末」は必ず残る。仕様の壁なので直しようがない。
//
// 【そこで、端末ではなく**こちらの画面のほう**を回す】
// 端末は縦のまま、モンビーの絵を90度回して描く。ただのCSSなので許可もAPIも要らず、
// 端末の「画面の自動回転」の設定にも一切左右されない。どのブラウザでも必ず効く。
//
// 【回すと座標がずれるので、そこだけ引き受ける】
// CSSで回すと getBoundingClientRect() も指の位置(clientX/clientY)も**回ったあとの値**で
// 返ってくる。レーン判定もノーツの配置もこの値を使っているので、素直に回すと
// 「押した場所と違うレーンが反応する」「ノーツが横に流れる」ことになる。
// そこで、回転を打ち消す変換をここに1組だけ置き、測る側・読む側はすべてこれを通す。
//
// 回していないとき(既定)は**そのまま返すだけ**にしてある。既存の端末の挙動を
// 1ビットも変えないための作り(CLAUDE.md ⑦)。
//
// 【変換の中身】
// 器は position:fixed / 左上そろえ / 幅=画面の高さ・高さ=画面の幅 とし、
//   transform: rotate(90deg) translateY(-100%)  (transform-origin: 0 0)
// を掛ける。器の中の点 (x,y) は画面上の (vw-y, x) へ移る(vw = 画面の幅)。
// したがって逆向きは、画面上の (X,Y) → 器の中の (Y, vw-X)。
const RHYTHM_VIEW_ROTATION=(()=>{
  // 0 = 回していない / 90 = 右へ90度 / 270 = 左へ90度
  let angle=0;
  const listeners=new Set();
  const vw=()=>(typeof window==='undefined')?0:(window.innerWidth||0);
  const vh=()=>(typeof window==='undefined')?0:(window.innerHeight||0);
  const get=()=>angle;
  const active=()=>angle===90||angle===270;
  const set=next=>{
    const value=(next===90||next===270)?next:0;
    if(value===angle)return angle;
    angle=value;
    listeners.forEach(fn=>{try{fn(angle);}catch(_){}});
    // 自前で回しても端末は回っていないので resize は鳴らない。
    // ところが「測り直す」しくみ(レーンの形・判定ラインの左右・当たり判定の箱・
    // ノーツの走る距離)はどれも resize を合図にしている。ここで自分で鳴らして、
    // **端末が回ったときとまったく同じ道**を通す。
    // 値が変わったときだけ通るので、これが引き金になって回り続けることはない。
    if(typeof window!=='undefined'&&typeof window.dispatchEvent==='function'){
      try{window.dispatchEvent(new Event('resize'));}catch(_){}
    }
    return angle;
  };
  const subscribe=fn=>{
    if(typeof fn!=='function')return()=>{};
    listeners.add(fn);
    return()=>{listeners.delete(fn);};
  };
  // Safe Area(ノッチ・ダイナミックアイランド・ホームインジケータ)の取り置き。
  //
  // 【なぜ器の側で持つか】(2026-09-12・ユーザー報告
  //   「縦横ボタンを押して横画面にしたときにiPhoneの場合、左上の戻るボタンが押せない」)
  // ふだんの Safe Area は index.html の body(padding-top/bottom)が確保している。
  // ところがこの器は position:fixed なので body の外側に置かれ、**画面のいちばん端から**
  // 始まる。しかも90度回っているので、器の「左端」は端末の**上端**にあたる。
  // その結果、横画面の左上に置いたボタン(曲えらびの「戻る」)が、ちょうど端末の
  // ステータスバー(時計・電池)の下へ入り込み、iPhoneではそこのタップがOSに取られて
  // **押しても反応しない**状態になっていた。
  //
  // 器そのものは画面を端まで覆ったまま(座標の変換 point / rect / unpoint は
  // 「器は画面いっぱい」を前提にしているので、大きさも位置も動かさない)、
  // **内側の余白だけ**で中身を安全な範囲へ寄せる。
  //
  // 90度回すと軸が入れ替わるので、当てる向きも入れ替える。
  //   角度90 : 器の左=端末の上 / 右=下 / 上=右 / 下=左
  //   角度270: 器の左=端末の下 / 右=上 / 上=左 / 下=右
  //
  // env(...) を var(...) でくるんでいるのは、実ブラウザの検査から値を差し替えて
  // 測れるようにするため(env() はテストから作れない)。ふだんは var が空なので
  // そのまま env() の値が入る。
  const safeInset=side=>`var(--mh-safe-${side}, env(safe-area-inset-${side}))`;
  const frameStyle=()=>{
    if(!active())return null;
    const forLeft=angle===90?'top':'bottom';     // 器の左 ← 端末の(上 / 下)
    const forRight=angle===90?'bottom':'top';   // 器の右 ← 端末の(下 / 上)
    const forTop=angle===90?'right':'left';     // 器の上 ← 端末の(右 / 左)
    const forBottom=angle===90?'left':'right';  // 器の下 ← 端末の(左 / 右)
    return{
      position:'fixed',left:0,top:0,
      width:`${vh()}px`,height:`${vw()}px`,
      // index.html に「#root > div { max-width:600px; margin:0 auto }」がある。
      // 縦持ちのコラム幅を決めている大事なCSSだが、ここでは器の幅(=画面の高さ)を
      // 600pxへ切り詰めてしまい、器が画面を覆えなくなる。今どきのスマホは
      // 高さが600pxを超えるので**必ず**踏む。実ブラウザの検査で見つけた(2026-09-06)。
      maxWidth:'none',maxHeight:'none',margin:0,
      // 大きさは画面ぴったりのまま、内側だけ削る(box-sizing:border-box)
      boxSizing:'border-box',
      paddingLeft:safeInset(forLeft),paddingRight:safeInset(forRight),
      paddingTop:safeInset(forTop),paddingBottom:safeInset(forBottom),
      transform:angle===90?'rotate(90deg) translateY(-100%)':'rotate(-90deg) translateX(-100%)',
      transformOrigin:'0 0',
    };
  };
  // 画面上の点 → 器の中の点
  const point=(clientX,clientY)=>{
    const x=Number(clientX),y=Number(clientY);
    if(angle===90)return{x:y,y:vw()-x};
    if(angle===270)return{x:vh()-y,y:x};
    return{x,y};
  };
  // 器の中の点 → 画面上の点(こちらから合成のタップを撃つときに使う)
  const unpoint=(x,y)=>{
    const px=Number(x),py=Number(y);
    if(angle===90)return{clientX:vw()-py,clientY:px};
    if(angle===270)return{clientX:py,clientY:vh()-px};
    return{clientX:px,clientY:py};
  };
  // 画面上の箱(getBoundingClientRect の値) → 器の中の箱。
  // 90度回っているので**幅と高さが入れ替わる**。
  const rect=box=>{
    if(!box||!active())return box;
    const left=angle===90?box.top:vh()-box.bottom;
    const top=angle===90?vw()-box.right:box.left;
    const width=box.height,height=box.width;
    return{left,top,right:left+width,bottom:top+height,width,height,x:left,y:top};
  };
  // 要素を「器の中の座標」で測る。測る側はこれだけを使えばよい
  const rectOf=el=>{
    if(!el||typeof el.getBoundingClientRect!=='function')return null;
    return rect(el.getBoundingClientRect());
  };
  // 指の当たりの半径も90度ぶん入れ替わる
  const touch=t=>{
    if(!t||!active())return t;
    const p=point(t.clientX,t.clientY);
    return{identifier:t.identifier,clientX:p.x,clientY:p.y,
      radiusX:Number(t.radiusY)||0,radiusY:Number(t.radiusX)||0,force:t.force};
  };
  // どちら回りにすると「持っている向きから見て正しい上下」になるか。
  // screen.orientation.angle は端末を自然な向きから何度回したかを表すので、
  // その逆を掛ければ、いま持っている向きに対して素直な絵になる。
  const preferredAngle=()=>{
    const current=(typeof window!=='undefined'&&window.screen&&window.screen.orientation)
      ? Number(window.screen.orientation.angle) : NaN;
    return current===90?270:90;
  };
  return{get,active,set,subscribe,point,unpoint,rect,rectOf,touch,frameStyle,preferredAngle};
})();
const rhythmReleaseTargetMs=note=>Number(note?._rhythmReleaseTargetMs??note?._rhythmReleaseOriginalEndTimeMs??note?.endTimeMs??note?.timeMs)||0;
const rhythmReleaseLane=note=>{
  const points=Array.isArray(note?.slidePoints)?note.slidePoints:[];
  return Number(points[points.length-1]?.lane??note?.endLane??note?.lane)||0;
};
// レーンの台形の**外側**でも、その高さのサブレーン何個ぶんまで受け付けるか。
//
// 【なぜ要るか】(2026-09-05・#156 演奏時の操作性の調査)
// 叩いた場所は、その高さのレーンの台形の内側でなければ「無かったこと」にしていた。
// ところが台形は画面の端まで届いていない。判定ライン(下から12%)の高さで実測すると、
// 390px幅のプレイエリアに対して**左右23pxずつが完全な死角**で、そこを押しても
// 空打ちの音すら鳴らずに消えていた。
//
// 困るのは、いちばん外のレーン(左端・右端)のノーツ。ノーツの当たりは
// RHYTHM_TAP_TOLERANCE_SUB_LANES(0.6サブレーン)ぶん外側までを受け付ける作りなのに、
// 台形の外はここで先に落とされるので、**外側だけこの猶予が使えなかった**。
// 内側へ0.6サブレーンずれても取れるのに、外側は数pxずれただけで無反応になる。
// スマホは端のレーンほど親指が外へはみ出しやすいので、いちばん起きやすい場所でもある。
//
// 【どう決めたか】
// 猶予(0.6)より広くないと意味がないので1サブレーンにした。少し広いぶんは、
// ノーツを取れないときでも「空打ち」として音が鳴る＝押したことが伝わる側に倒している
// (空打ちにスコア・ライフの罰は無い)。
// 幅はその高さのレーンに比例するので、レーンが細くなる画面の上のほうでは猶予も狭い。
// 実測: 判定ラインで34px(死角23pxを覆う) / 画面のいちばん上では7pxしか広がらない。
// 「関係ないところを押しても取れる」にはならない。
const RHYTHM_INPUT_EDGE_MARGIN_SUB_LANES=1;
const rhythmLaneCoordinateAtPoint=(clientX,clientY,rect)=>{
  if(!rect||!Number.isFinite(rect.width)||rect.width<=0||!Number.isFinite(rect.height)||rect.height<=0)return null;
  const yRatio=rhythmClamp01((Number(clientY)-rect.top)/rect.height),nx=(Number(clientX)-rect.left)/rect.width;
  const left=rhythmProjectBoundary(0,yRatio),right=rhythmProjectBoundary(RHYTHM_LANE_COUNT,yRatio),laneWidth=(right-left)/RHYTHM_LANE_COUNT;
  if(!Number.isFinite(nx)||!(laneWidth>0))return null;
  // サブレーンはレーンの半分なので、1サブレーン = laneWidth/2
  const margin=laneWidth/2*RHYTHM_INPUT_EDGE_MARGIN_SUB_LANES;
  if(nx<left-margin||nx>right+margin)return null;
  // 台形の外は端のレーンの延長として、そのまま外側の座標を返す。
  // 受け取る側は subLane を 0〜9 へ丸める(setPressedLanes / inputStarts)ので、
  // 少しはみ出した値がそのまま使われることはない。
  return (nx-left)/laneWidth-.5;
};
// 判定ラインの高さ(プレイエリアの下から12% ＝ y比0.88)。
const RHYTHM_JUDGMENT_LINE_Y_RATIO=.88;
// HOLD/SLIDEを押さえ続けているあいだの「指がどのレーンにいるか」。
//
// 【2026-09-11・「スライドの判定幅が細か過ぎる」のいちばんの原因】
// ふつうのレーン座標は**指のその場の高さ**で台形の幅を決める。レーンは奥ほど狭いので、
// 判定ラインの上の正しい位置に指があっても、指が上へ流れただけでレーン座標が外へ膨らむ。
// ずれの大きさは |レーン-2| × (scale(0.88)/scale(y) - 1) で、エリア高700px想定だと
// 判定ラインの140px上・端のレーンで0.556レーン。幅2のSLIDEの許容0.82レーンの68%を、
// **横に一切ずれていないのに**食いつぶしていた(中央のレーンでは0なので、端だけ理不尽に落ちる)。
//
// 追従の的(rhythmSlideExpectedLane)は「いまの時刻＝判定ラインの上」の位置なので、
// 比べる相手も判定ラインの高さで測るのが筋。指のxはそのまま使い、高さだけを揃える。
// 許容の数字は1つも変えていない。
const rhythmTrackingLaneCoordinateAtPoint=(clientX,clientY,rect)=>{
  if(!rect||!Number.isFinite(rect.height)||rect.height<=0)return rhythmLaneCoordinateAtPoint(clientX,clientY,rect);
  return rhythmLaneCoordinateAtPoint(clientX,rect.top+rect.height*RHYTHM_JUDGMENT_LINE_Y_RATIO,rect);
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

// --- 入力イベントの「古さ」 ---
// 指が触れた瞬間(event.timeStamp)と、JSがそのイベントを処理する瞬間(performance.now())には
// 端末によって数ms〜数十msの差がある(iOS Safariは描画の1コマぶん遅れて届くことがある)。
// 判定の時刻を「処理した瞬間の曲の時刻」で取ると、そのぶん必ず SLOW 側へずれる。
// ここでは差を測って、判定に使う曲の時刻からその古さを差し引く。
//   ・timeStamp が高精度(performance.now と同じ基準)のときだけ効く。
//     基準が違う(1970年からのms など)・未来・古すぎる値は 0 として扱う(安全側)
//   ・上限を置く(それより古い値は端末の時計の都合と見なして使わない)
const RHYTHM_INPUT_AGE_MAX_MS=80;
const rhythmInputAgeMs=(eventTimeStamp,nowPerfMs)=>{
  const stamp=Number(eventTimeStamp),now=Number(nowPerfMs);
  if(!Number.isFinite(stamp)||!Number.isFinite(now))return 0;
  const age=now-stamp;
  if(!(age>0)||age>RHYTHM_INPUT_AGE_MAX_MS)return 0;
  return age;
};
// ノーツを「もう誰も取れない」として見逃しMISSにする時刻。
//
// 【2026-09-11・「叩いたのにノーツが消えている」の対策】
// 回収はフレーム(rAF)の中で、そのフレームの曲の時刻で行う。いっぽう入力の判定は
// 上の rhythmInputAgeMs で**最大80ms巻き戻した**時刻で行う。この2つが同じ値だったため、
// 物理的には判定窓の内側で叩いていても、イベントがJSへ届く前に走ったフレームが
// 窓を越えていればノーツは既に done。届いた入力はそのノーツを候補から外し、
// ±窓内にある次のノーツを掴む＝狙ったほうはMISS、次も早取りで消える(1入力で2つ崩れる)。
// 入力が遅れて届きうるぶんだけ回収を待てば、この取りこぼしは起きない。
// 受け付ける広さそのもの(RHYTHM_INPUT_MATCH_WINDOW_MS)は広げていない。
// 判定は入力側の時刻で測るので、遅れて届いた入力が窓の外なら今までどおりMISSになる。
const RHYTHM_MISS_RECLAIM_MS = RHYTHM_INPUT_MATCH_WINDOW_MS + RHYTHM_INPUT_AGE_MAX_MS;

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
// SLIDEの追従を、難易度ごとにやさしくする。
//
// 【2026-09-11・ユーザー指示】
// 「スライドノーツの判定幅が細か過ぎてかなりむずい / 難易度によって細かさを調整してほしい /
//   もちろん難しい曲なら細かくてもいい」
//
// それまで追従の許容も猶予も全難易度で同じ1つの値だった。難易度差は譜面の中身
// (帯の幅)だけで付いていて、しかも**MASTERがいちばん厳しい**状態になっていた。
// 配信中の譜面の実測: HARD 191本中163本が幅3(±1.07レーン) / EXPERT 202本中186本が幅3 /
// MASTER 228本中210本が幅2(±0.82レーン)。つまり上の難易度ほど細い帯を使っている。
//
//   toleranceBonusLanes … 追従の許容へ足すレーン数。MASTERは0＝これまでどおり
//   graceMs             … 的から外れてから失敗にするまでの猶予(ms)。MASTERは120＝これまでどおり
//
// 猶予にも差を付けるのは、経路の速い区間では許容だけでは足りないため。
// 配信譜面の移動速度はp90で7.2レーン/秒あり、そこでは幅2の許容0.82レーンを
// **114msで使い切る**（＝従来の猶予120msと同じ桁）。許容と猶予は掛け算で効く。
// 上限は200msに留める(HOLD/SLIDEの持ち替え猶予 RHYTHM_HOLD_HANDOVER_GRACE_MS と同じ)。
const RHYTHM_SLIDE_TRACKING_BY_DIFFICULTY = Object.freeze({
  EASY:   Object.freeze({ toleranceBonusLanes:.40, graceMs:200 }),
  NORMAL: Object.freeze({ toleranceBonusLanes:.32, graceMs:190 }),
  HARD:   Object.freeze({ toleranceBonusLanes:.24, graceMs:175 }),
  EXPERT: Object.freeze({ toleranceBonusLanes:.12, graceMs:150 }),
  MASTER: Object.freeze({ toleranceBonusLanes:0,   graceMs:120 }),
});
// 保存値も譜面も持たない「そのときの難易度」を判定へ渡すために、演奏を始めるときへ
// ノーツ1つ1つへ焼き込む(makeRuntimeNotes)。関数の引数を増やさずに済み、
// 譜面データそのものは触らないので保存データにもランキングにも影響しない。
const rhythmSlideTrackingFor = difficultyId =>
  RHYTHM_SLIDE_TRACKING_BY_DIFFICULTY[String(difficultyId||'').toUpperCase()]
  || RHYTHM_SLIDE_TRACKING_BY_DIFFICULTY.MASTER;
// HOLD・SLIDEの終わり(離す・終点フリック)の判定も、単発のタップと同じ表を使う。
// 数字を別に持つと、タップだけ緩めて終端が置き去りになる。判定表のいちばん外側から作る。
const RHYTHM_RELEASE_MAX_MS = RHYTHM_INPUT_MATCH_WINDOW_MS;
const RHYTHM_RELEASE_DEFER_ARM_MS = 100;
const RHYTHM_RELEASE_AUTO_MISS_ARM_MS = 180;
const RHYTHM_RELEASE_JUDGMENT_IDS = Object.freeze(['MARVELOUS','EXCELLENT','GREAT','GOOD','BAD','MISS']);
// ── そのスライド1本ごとの「なぞりにくさ」を許容へ足す ──────────────────────────
//
// 【2026-09-11・ユーザー指示】
// 「難易度固定より曲にあわせて変えてほしい / 難易度準拠はもちろんそうなんだけど」
//
// 難易度だけで決めると粗すぎる。同じ難易度の中でも、譜面のスライドの速さは実測で
// **14倍ちがう**(MASTER: 中央1.80 / p90 8.33 / 最大25.77 レーン/秒)。
//
// 速いスライドが落ちやすいのは腕前の問題ではなく、**タイミングのぶれがそのまま
// 位置のぶれに化ける**ため。8.3レーン/秒なら50msの遅れが0.42レーンのズレになり、
// 幅2の許容0.82レーンの半分を、狙いが合っていても食いつぶす。
// そこで「人がこれくらいはぶれる」ぶんの時間を決め、その時間に進む距離を許容へ足す。
// こうすると、遅いスライドも速いスライドも**要求される腕前が揃う**。
//
//   足す量 = そのスライドのいちばん速い区間の速さ(レーン/秒) × 0.045秒
//
// 45msは判定表のいちばん内側(MARVELOUS ±55ms)より小さく取った。これより大きくすると
// 「MARVELOUSで叩ける腕前なら絶対に落ちない」を超えて、狙いが外れていても通ってしまう。
// 上限はレーン半分(0.5)。25.77レーン/秒のような極端な区間で許容が広がりすぎると、
// 隣のレーンまで届いて「どこを触っても通る」状態になるため。
const RHYTHM_SLIDE_SPEED_COMPENSATION_MS = 45;
// 上乗せの上限(レーン)。0.35レーンは判定ラインで約23px。
// ここを大きくすると、太いSLIDE((幅-2)/4 ぶんが既に乗っている)で許容が画面の半分近くまで
// 広がり「どこを触っても通る」状態になる。実際に上限0.5で試したらEXPERTの太い帯が
// ±193px(プレイエリア374pxの半分)まで開いたので、そこから絞った。
const RHYTHM_SLIDE_SPEED_BONUS_MAX_LANES = .35;
// **その時刻の**区間の速さ(レーン/秒)。1本まるごとのいちばん速い区間ではなく、
// いま指が乗っている区間だけを見る。
//
// はじめは「1本のいちばん速い区間」で作ったが、配信譜面に当てると
// HARD以上の9割超が上限へ張り付いた(1か所でも速い区間があれば1本ぜんぶが最大になるため)。
// それでは「曲ごとに変える」ことにならないので、区間ごとに見る形へ変えた。
// ゆっくり流れるところは上乗せがほぼ0、振り回すところだけ広がる。
// 形は rhythmSlideWidthAt と同じ(同じ points を同じ順で辿る)。
const rhythmSlideLaneSpeedAt=(note,chartTimeMs)=>{
  const points=rhythmSlidePoints(note),t=Number(chartTimeMs);
  if(!Array.isArray(points)||points.length<2)return 0;
  const speedOf=(a,b)=>{
    const seconds=(Number(b?.timeMs)-Number(a?.timeMs))/1000,lanes=Math.abs(Number(b?.lane)-Number(a?.lane));
    return seconds>0&&Number.isFinite(lanes)?lanes/seconds:0;
  };
  if(!Number.isFinite(t)||t<=Number(points[0]?.timeMs))return speedOf(points[0],points[1]);
  for(let i=1;i<points.length;i++){
    if(t<=Number(points[i].timeMs))return speedOf(points[i-1],points[i]);
  }
  return speedOf(points[points.length-2],points[points.length-1]);
};
// その時刻の速さから、許容へ足すレーン数を作る。
const rhythmSlideSpeedBonusLanes=(note,chartTimeMs)=>{
  if(note?.type!=='SLIDE')return 0;
  const speed=rhythmSlideLaneSpeedAt(note,chartTimeMs);
  if(!(speed>0))return 0;
  return Math.min(RHYTHM_SLIDE_SPEED_BONUS_MAX_LANES,speed*RHYTHM_SLIDE_SPEED_COMPENSATION_MS/1000);
};
const rhythmSlideToleranceBonus=(note,chartTimeMs)=>{
  // 難易度の土台(演奏開始時に焼き込む)＋ いま乗っている区間の速さぶん。
  // どちらも無い・壊れている場合は0＝従来どおりの許容になる。
  const byDifficulty=Number(note?._rhythmSlideToleranceBonusLanes);
  return (Number.isFinite(byDifficulty)&&byDifficulty>0?byDifficulty:0)
    +rhythmSlideSpeedBonusLanes(note,chartTimeMs);
};
const rhythmSlideTrackingTolerance=(note,chartTimeMs)=>RHYTHM_SLIDE_TOLERANCE_LANES+(rhythmSlideWidthAt(note,chartTimeMs)-2)/4+rhythmSlideToleranceBonus(note,chartTimeMs);
const rhythmJudgeRelease=deltaMs=>{
  const value=Math.abs(Number(deltaMs));
  if(!Number.isFinite(value))return 'MISS';
  for(const judgment of RHYTHM_JUDGMENTS){
    if(judgment.windowMs!==null&&value<=judgment.windowMs)return judgment.id;
  }
  return 'MISS';
};
// 【2026-09-07・離すのが遅いほうはやさしくする】
// それまでは、終端から+240msより遅く離す・押しっぱなしにすると MISS だった。
// 親指で押さえていると「音が終わってから離す」のはごくふつうの動きで、これで
// コンボが切れると「取れているのに切れた」と感じる。よその音ゲーもここは緩い
// (プロセカ・CHUNITHMは離すタイミングを見ない、Quaverは離し忘れがGOODでコンボは続く)。
// **早く離すほう**は音が終わる前に手を離しているので、これまでどおり判定表で見る。
// **遅く離すほう**(押しっぱなしを含む)は、どれだけ遅くても GOOD より下にしない。
// 判定表そのもの(RHYTHM_JUDGMENTS)と早離しの扱いは変えていない。
const RHYTHM_RELEASE_LATE_FLOOR = 'GOOD';
const rhythmJudgeReleaseLenient=deltaMs=>{
  const judged=rhythmJudgeRelease(deltaMs);
  if(!(Number(deltaMs)>0))return judged;
  const floorRank=RHYTHM_RELEASE_JUDGMENT_IDS.indexOf(RHYTHM_RELEASE_LATE_FLOOR);
  const rank=RHYTHM_RELEASE_JUDGMENT_IDS.indexOf(judged);
  return rank>floorRank?RHYTHM_RELEASE_LATE_FLOOR:judged;
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

// ── SLIDEの途中は「チェックポイント(判定線)」で見る ──────────────────────────
//
// 【2026-09-12・ユーザー指示】
// 「スライドってずれたりしたらミス扱いになるでしょ / あれを判定線を設けてそのときに
//   押されてなきゃミス扱いになるようにできないの？ / 音ゲーとかってだいたいそうなってない？」
//
// 直す前は、追従が猶予を超えて外れた**その場でノーツを打ち切って**いた
// (holdJudgment='MISS' / failed=true / endTimeMs=chartNow-50)。3秒のSLIDEを
// 95%なぞれていても、途中で一度滑ったら全部失う作りで、復帰する道が無かった。
// プロセカ・バンドリ・CHUNITHM などは途中を一定間隔のチェックポイントで見て、
// 外れたらそのチェックポイントを落とすだけにしている。ここも同じ形にする。
//
// ⚠️ ランキングとセーブデータを壊さないため、**SLIDEは今までどおり1ノーツ・1コンボ**の
// ままにする(totalNotes も最大コンボも変わらない)。チェックポイントは
// 「そのノーツのグレードを決める」ためだけに使う。1つずつノーツとして数えると
// 満点も最大コンボも変わり、過去の記録と比べられなくなる(運用ルール⑦)。
const RHYTHM_SLIDE_CHECKPOINT_BASE_MS=Object.freeze({
  EASY:240, NORMAL:210, HARD:180, EXPERT:150, MASTER:125,
});
// 曲ごとの調整の物差し。BPMは実行時のデータに無いので、曲と難易度の**両方**を表す
// 譜面のレベルを使う(同じMASTERでも かぜがそよぐ Lv.15 と SIX ÉTERNEL Lv.39 がある)。
// 基準は配信中の譜面のレベルの中央値(HARD 13 / EXPERT 18 / MASTER 25)。
// 基準どおりのレベルなら上の基準値そのまま、それより歯ごたえのある譜面ほど細かくなる。
const RHYTHM_SLIDE_CHECKPOINT_REFERENCE_LEVEL=Object.freeze({
  EASY:4, NORMAL:8, HARD:13, EXPERT:18, MASTER:25,
});
const RHYTHM_SLIDE_CHECKPOINT_MIN_MS=90;
const RHYTHM_SLIDE_CHECKPOINT_MAX_MS=400;
const RHYTHM_SLIDE_CHECKPOINT_SCALE_MIN=.75;
const RHYTHM_SLIDE_CHECKPOINT_SCALE_MAX=1.35;
// 終端の手前はチェックポイントを置かない。終わりは「離す・終点フリック」の判定が
// 別にあるので、重ねると同じ1回のしくじりを二重に取ることになる。
const RHYTHM_SLIDE_CHECKPOINT_TAIL_GUARD_MS=30;
const rhythmSlideCheckpointIntervalMs=(difficultyId,level)=>{
  const id=String(difficultyId||'').toUpperCase();
  const base=RHYTHM_SLIDE_CHECKPOINT_BASE_MS[id]||RHYTHM_SLIDE_CHECKPOINT_BASE_MS.MASTER;
  const reference=RHYTHM_SLIDE_CHECKPOINT_REFERENCE_LEVEL[id]||RHYTHM_SLIDE_CHECKPOINT_REFERENCE_LEVEL.MASTER;
  const actual=Number(level);
  const scale=Number.isFinite(actual)&&actual>0
    ?Math.max(RHYTHM_SLIDE_CHECKPOINT_SCALE_MIN,Math.min(RHYTHM_SLIDE_CHECKPOINT_SCALE_MAX,Math.sqrt(reference/actual)))
    :1;
  return Math.max(RHYTHM_SLIDE_CHECKPOINT_MIN_MS,Math.min(RHYTHM_SLIDE_CHECKPOINT_MAX_MS,base*scale));
};
// 中継点には必ず置き、その間を intervalMs で埋める。
// 中継点＝経路が折れるところ＝判定の的(rhythmSlideExpectedLane)が向きを変えるところなので、
// ここを外すと「曲がったのに気づかなかった」を拾えない。
const rhythmSlideCheckpointTimes=(note,intervalMs)=>{
  const points=rhythmSlidePoints(note);
  if(!Array.isArray(points)||points.length<2)return Object.freeze([]);
  const step=Math.max(RHYTHM_SLIDE_CHECKPOINT_MIN_MS,Number(intervalMs)||RHYTHM_SLIDE_CHECKPOINT_MAX_MS);
  const endMs=Number(points[points.length-1]?.timeMs);
  const limit=Number.isFinite(endMs)?endMs-RHYTHM_SLIDE_CHECKPOINT_TAIL_GUARD_MS:Infinity;
  const times=[];
  const push=value=>{
    const at=Math.round(Number(value));
    if(!Number.isFinite(at)||at>limit)return;
    if(times.length&&at-times[times.length-1]<1)return;
    times.push(at);
  };
  for(let i=1;i<points.length;i++){
    const from=Number(points[i-1]?.timeMs),to=Number(points[i]?.timeMs);
    if(!Number.isFinite(from)||!Number.isFinite(to)||to<=from){push(to);continue;}
    const count=Math.max(1,Math.round((to-from)/step));
    for(let s=1;s<=count;s++)push(from+(to-from)*(s/count));
  }
  return Object.freeze(times);
};
// 焼き込み前(古い経路・検査)のノーツでも素通しにしない。いちばん細かい既定で作る。
const rhythmSlideNoteCheckpoints=note=>{
  const baked=note?._rhythmSlideCheckpoints;
  if(Array.isArray(baked))return baked;
  return rhythmSlideCheckpointTimes(note,rhythmSlideCheckpointIntervalMs('MASTER',null));
};
// 通過率から「これより良くはならない」という押さえを決める。始点・終点の判定と
// 悪いほうで合わせて使う。null は「落としていない＝押さえを掛けない」＝これまでどおり。
const RHYTHM_SLIDE_CHECKPOINT_GRADES=Object.freeze([
  Object.freeze({ minRate:1,  judgment:null    }),
  Object.freeze({ minRate:.9, judgment:'GREAT' }),
  Object.freeze({ minRate:.7, judgment:'GOOD'  }),
  Object.freeze({ minRate:.5, judgment:'BAD'   }),
]);
const rhythmSlideTrackingFloor=(passed,total)=>{
  const count=Number(total);
  if(!Number.isFinite(count)||count<=0)return null;
  const cleared=Math.max(0,Math.min(count,Number(passed)||0));
  const rate=cleared/count;
  for(const grade of RHYTHM_SLIDE_CHECKPOINT_GRADES){if(rate>=grade.minRate)return grade.judgment;}
  return 'MISS';
};

// STEP 2A.5: 入力成功と空押しを即座に返すWeb Audio SE。既存の音ゲー設定キーだけを読み、
// AudioContextは1個だけ遅延生成して再利用する。空押しは新規入力でノーツを取得できなかったときだけ呼ぶ。
// 音ゲーのタップ音量はメインのSE音量設定と独立している(rhythm-mode.js側で自前のAudioContextを使う)。
// ただし全体ミュート(タイトル画面の「音がオフです」)だけは、game-system.jsx の Audio_.setEnabled が
// window.__mhAudioEnabled へ反映するのでそれを見て共通に効かせる。値が無い(main未読込)場合はfalse扱いにしない。
const rhythmAudioGloballyEnabled=()=>typeof window==='undefined'||window.__mhAudioEnabled!==false;
// モンビーのオプションの音量(BGM音量・タップ音量)で使える上限(2026-09-12・ユーザー指示
//   「音量調整を今のベースで200まで引き上げて」)。
// **100の意味は今までと同じ**。100より上を使えるようにしただけで、既存の保存値は
// そのまま同じ音量で鳴る(上限を広げただけなので、保存してある0〜100は1つも動かない)。
// ★ここはモンビーの音量だけ。メインゲーム(HOME)の音量設定には一切関係しない。
const RHYTHM_VOLUME_MAX = 200;
// ===== タップ音まわりの大きさをまとめて上げる倍率(2026-09-12・ユーザー指示) =====
// 「アンドロイドでタップ音量が小さいって声がある」。
// 原因は合成音の振幅そのもので、タップ音はフルスケールの3.5%(既定の音量70なら2.45%)しかなく、
// -14 LUFS へそろえた曲のピーク(-1 dBTP = 0.891)より **約28dB** 小さかった。
// タップ音量を最大の100にしても、曲と釣り合わせるにはBGM音量を7まで下げるしかない状態で、
// iPhoneは端末側の音量で20dB以上押し上げられるので成立していたが、
// Androidのスピーカーではそこまで持ち上がらず「聞こえない」になっていた。
//
// ★戻すときはこの数字を 1 にするだけ。下の .035 などの元の係数は1つも書き換えていないので、
//   1 にすれば2026-09-12より前とまったく同じ音量へ戻る。
// ★効くのは「タップ音量(noteSeVolume)」で鳴るモンビーの合成音だけ。
//   BGM音量(bgmVolume)にも、メインゲームの音量設定(_bgmGain / seGain)にも一切触れない。
const RHYTHM_NOTE_SE_GAIN_SCALE = 10;
// 1つの音が出せる大きさの上限(安全側の蓋)。倍率や音量を上げすぎたときに音が割れないようにする。
// 音量100のあいだはどの音もここへ届かない(いちばん大きいフルコンボ音で .50)。
// 音量を200まで使えるようにしたので(RHYTHM_VOLUME_MAX)、タップ音が音量200でちょうど
// 2倍(.70)まで素直に伸びるところへ蓋を置く。重ねて鳴らすモンスターノーツ(.84)と
// フルコンボ音(1.00)は音量140あたりからここで頭打ちになるが、そこから上は
// 割れるだけなので止めてよい(2026-09-12)。
const RHYTHM_NOTE_SE_LEVEL_MAX = .8;
// 元の係数 × 倍率 × 音量(0〜1)。
// 下限(.0001)は exponentialRampToValueAtTime が0を受け取れないためで、これまでと同じ。
const rhythmNoteSeLevel = (base, volume) =>
  Math.max(.0001, Math.min(RHYTHM_NOTE_SE_LEVEL_MAX, base * RHYTHM_NOTE_SE_GAIN_SCALE * volume));
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
        volume:Number.isFinite(number)?Math.max(0,Math.min(RHYTHM_VOLUME_MAX,number)):70,
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
    const settings=previewSettings?{enabled:previewSettings.noteSeEnabled!==false,volume:Math.max(0,Math.min(RHYTHM_VOLUME_MAX,Number(previewSettings.noteSeVolume)||0))}:readSettings();
    if(!settings.enabled||settings.volume<=0||!rhythmAudioGloballyEnabled())return false;
    const audio=context();
    if(!audio)return false;
    if(audio.state==='suspended'&&typeof audio.resume==='function')audio.resume().catch(()=>{});
    const oscillator=audio.createOscillator(),gain=audio.createGain(),now=audio.currentTime,level=rhythmNoteSeLevel(.035,settings.volume/100);
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
    const source=audio.createBufferSource(),filter=audio.createBiquadFilter(),gain=audio.createGain(),now=audio.currentTime,level=rhythmNoteSeLevel(.022,settings.volume/100);
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
    const now=audio.currentTime,level=rhythmNoteSeLevel(.028,settings.volume/100),duration=.13;
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
      gain.gain.exponentialRampToValueAtTime(rhythmNoteSeLevel(peak,volume),start+.008);
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
    const now=audio.currentTime,level=rhythmNoteSeLevel(.05,settings.volume/100);
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
// 演奏を始める前に「プレイエリアが遊べる大きさになる」のを待つ上限。
// 待てないまま止まってしまうより、始めてしまったほうがましなので必ず打ち切る。
// 実測(iPhone・初回起動・EXPERT)ではレイアウトの確定に数フレームしかかからないので、
// ふつうは 1〜2フレームで抜ける。1.2秒は「明らかにおかしいときだけ効く」上限。
const RHYTHM_LAYOUT_WAIT_MAX_MS=1200;
// 曲えらびで選んだ直後にいきなり曲が鳴り始めるのをやめ、
// 構える時間を挟んでから演奏を始める(2026-09-05・ユーザー指摘
// 「そもそも入ってすぐ音楽なるのも良くない？ 3秒から5秒ぐらいしてから演奏がいい」)。
// ほかの音ゲーと同じく、画面が出てから READY → 3 → 2 → 1 と数えて始める。
// この待ち時間はレイアウトが固まる時間にもなるので、
// 「判定ラインやノーツが出そろう前に曲だけ進む」も起きにくくなる。
// 1つぶんの長さ×段数が待ち時間になる(READY・3・2・1の4段 = 3.2秒)。
const RHYTHM_COUNTDOWN_STEP_MS=800;
const RHYTHM_COUNTDOWN_STEPS=Object.freeze(['READY','3','2','1']);
const RHYTHM_COUNTDOWN_TOTAL_MS=RHYTHM_COUNTDOWN_STEP_MS*RHYTHM_COUNTDOWN_STEPS.length;
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
    // 自前で回しているときは「回す前の箱」に直してから配る。
    // ここが唯一の配り元なので、レーン判定も追従もまとめて正しくなる
    const rect=RHYTHM_VIEW_ROTATION.rectOf(area);
    if(!(rect&&Number.isFinite(rect.width)&&rect.width>0))return null;
    cachedRect=rect;
    return cachedRect;
  };
  // 画面が動く操作では即座に捨てる(iOSのURLバー出入りなども visualViewport で拾う)
  // 自前で画面を回したときも、覚えている箱は必ず捨てる(ズレると入力位置がずれる)
  RHYTHM_VIEW_ROTATION.subscribe(invalidateAreaRect);
  if(typeof window!=='undefined'&&typeof window.addEventListener==='function'){
    ['resize','orientationchange','scroll'].forEach(type=>window.addEventListener(type,invalidateAreaRect,{passive:true,capture:true}));
    if(window.visualViewport&&typeof window.visualViewport.addEventListener==='function'){
      ['resize','scroll'].forEach(type=>window.visualViewport.addEventListener(type,invalidateAreaRect,{passive:true}));
    }
  }
  // 追従専用。指の高さではなく判定ラインの高さでレーンを測る
  // (rhythmTrackingLaneCoordinateAtPoint の説明を参照)
  const laneCoordinate=(clientX,clientY)=>{
    const rect=areaRect();
    if(!rect)return null;
    return rhythmTrackingLaneCoordinateAtPoint(clientX,clientY,rect);
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
    // 【2026-09-12】SLIDEはここで打ち切らない。外れているあいだに来たチェックポイントだけが
    // 落ちて、指を戻せば続きは拾える(evaluateCheckpoints が数える)。
    // HOLDはこれまでどおり、猶予を超えたらその場でMISSを確定する。
    if(session.kind==='SLIDE')return;
    const graceMs=Number(session.note?._rhythmTrackingGraceMs)>0
      ?Number(session.note._rhythmTrackingGraceMs):RHYTHM_MID_TRACKING_GRACE_MS;
    if(pos.perfMs-session.trackingBadSincePerf<graceMs)return;
    session.note.holdJudgment='MISS';
    session.failed=true;
    // 猶予を超えて外れたままなら、指を離すのを待たずその場でMISS確定する。
    // endTimeMsを現在より少し前へ寄せ、本体(scheduleTick)の「endTimeMs到達で
    // 既存applyJudgmentを呼ぶ」経路をそのまま使ってグレー表示へ切り替える(新しい判定経路は作らない)。
    session.note.endTimeMs=chartNow-50;
  };
  // ── チェックポイント(判定線)を数える ──────────────────────────────────
  // 時刻が来たチェックポイントを1つずつ見て、そのとき指が的の中にいたかを記録する。
  // 「ぶれた一瞬では落とさない」は evaluatePosition が維持している trackingBadSincePerf を
  // そのまま使う(猶予の考え方を追従の判定と共有するため)。
  const evaluateCheckpoints=(session,perf)=>{
    if(!session||session.kind!=='SLIDE'||session.finished||session.note.done)return;
    const times=session.checkpointTimes;
    if(!Array.isArray(times)||session.checkpointIndex>=times.length)return;
    const chartNow=estimatedSongMs(session)-session.offsetMs;
    const graceMs=Number(session.note?._rhythmTrackingGraceMs)>0
      ?Number(session.note._rhythmTrackingGraceMs):RHYTHM_MID_TRACKING_GRACE_MS;
    while(session.checkpointIndex<times.length&&Number(times[session.checkpointIndex])<=chartNow){
      session.checkpointIndex++;
      // 終点フリックの受付中は追従を見ない(フリックで的から外れるのは当たり前のため)。
      if(session.endFlickArmed){session.checkpointPassed++;continue;}
      if(session.trackingBadSincePerf==null||perf-session.trackingBadSincePerf<graceMs)session.checkpointPassed++;
    }
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
        evaluateCheckpoints(session,perf);
      }
      if(session.releaseRequired&&!session.note.done){
        const releaseDelta=estimatedSongMs(session)-(session.releaseTargetMs+session.offsetMs);
        if(!session.autoCompletionDeferred&&releaseDelta>=-RHYTHM_RELEASE_DEFER_ARM_MS){
          // 本体の「終端到達で自動成功」を終端判定窓の直後まで延期する。
          session.note.endTimeMs=session.releaseTargetMs+RHYTHM_RELEASE_MAX_MS+1;
          session.autoCompletionDeferred=true;
        }
        if(releaseDelta>=RHYTHM_RELEASE_AUTO_MISS_ARM_MS){
          // 押しっぱなしのまま終端を過ぎた。離すのが遅いほうはやさしくするので、
          // ここで確定するのは MISS ではなく「始点の判定と GOOD の悪いほう」。
          // (終点フリックが要るノーツは、弾かずに終わったので MISS のまま)
          session.expiredGuard=true;
          const start=session.startJudgment||session.note.holdJudgment||'MISS';
          const lateJudgment=rhythmWorseJudgment(start,RHYTHM_RELEASE_LATE_FLOOR);
          const lateFloor=session.kind==='SLIDE'
            ?rhythmSlideTrackingFloor(session.checkpointPassed,session.checkpointIndex):null;
          session.note.holdJudgment=session.failed||session.endFlickRequired?'MISS'
            :lateFloor?rhythmWorseJudgment(lateJudgment,lateFloor):lateJudgment;
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
    // 自前で回しているときは、覚える前に「回す前の座標」へ直す。
    // ここを通った値がフリックの距離(dx/dy)にもレーンの追従(laneCoordinate)にも使われる
    const p=RHYTHM_VIEW_ROTATION.point(clientX,clientY);
    const pos={clientX:Number(p.x)||0,clientY:Number(p.y)||0,perfMs:nowPerf()};
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
      // 終点フリックを弾き終えたときは持ち替えではないので、その場で確定する
      if(!cancelled&&!session.failed&&!session.endFlickDone&&releaseDelta<-RHYTHM_HOLD_RELEASE_GRACE_MS){
        session.note.releasedAtMs=songNow-session.offsetMs;
        rhythmFloatingNoteAdd(session.note);
        sessions.delete(id);
        return;
      }
      // 終点フリックのノーツは、フリックしないまま離してもMISS。判定窓そのものは変えない。
      const endJudgment=cancelled?'MISS'
        :session.endFlickRequired&&!session.endFlickDone?'MISS'
        :rhythmJudgeReleaseLenient(releaseDelta);
      const startJudgment=session.startJudgment||session.note.holdJudgment||'MISS';
      // 途中のチェックポイントの通過率を「これより良くはならない」押さえとして掛ける。
      // 全通過なら null(押さえなし)＝始点と終点の判定だけで決まる(＝これまでと同じ)。
      const bothEnds=rhythmWorseJudgment(startJudgment,endJudgment);
      // 分母は「実際に通り過ぎて見たぶん」(checkpointIndex)。全件にすると、
      // requestAnimationFrame が動いていない環境で1件も見ないまま通過率0になり、
      // すべてのSLIDEがMISSになってしまう。見ていないぶんを失敗として数えない。
      // 早く離した場合は終端の判定が既に厳しく出るので、二重に取る必要もない。
      const trackingFloor=session.kind==='SLIDE'
        ?rhythmSlideTrackingFloor(session.checkpointPassed,session.checkpointIndex):null;
      const finalJudgment=session.failed?'MISS':trackingFloor?rhythmWorseJudgment(bothEnds,trackingFloor):bothEnds;
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
    sessions.set(key,{key,note,kind,startSongMs:Number(startSongMs)||0,offsetMs:Number(offsetMs)||0,startPerfMs:perf,lastPerfMs:perf,startX:pos.clientX,startY:pos.clientY,finished:false,failed:false,releaseRequired,releaseTargetMs,startJudgment:null,startDeltaMs:0,expiredGuard:false,autoCompletionDeferred:false,trackingBadSincePerf:null,checkpointTimes:kind==='SLIDE'?rhythmSlideNoteCheckpoints(note):[],checkpointIndex:0,checkpointPassed:0,endFlickRequired,endFlickArmed:false,endFlickAnchorX:pos.clientX,endFlickAnchorY:pos.clientY,endFlickDone:false});
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
  const touchStates=new Map(),syntheticTapKeys=new Set(),syntheticTapSources=new Map(),physicalTargetTimes=new Map();
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
  // 【2026-09-11・疑似TAPを本体の入力より後に撃つ】
  // 接触幅の疑似TAPは「中心の指が取ったノーツと同じ時刻のノーツ」だけを取るよう
  // physicalTargetTimes で鍵を掛けている(syntheticTargetTime)。その鍵を掛けるのは
  // 本体の入力処理(inputStarts → recordPhysicalTarget)。
  //
  // ところが、この接触幅ランタイムは document の capture、ゲーム本体は play area の
  // bubble に登録されている。capture が先に走り、queueMicrotask は
  // 「リスナとリスナのあいだのマイクロタスクチェックポイント」で消化されるため、
  // **疑似TAPのほうが本体より先に**走っていた。そのとき鍵はまだ空なので
  // `Number.isFinite(syntheticTime)` が false になり、時刻の制限がまるごと外れる。
  // 制限の無い疑似TAPは判定窓いっぱい先のノーツまで取れてしまい、
  // 取られたノーツは本来の時刻には既に done ＝ 1本の指で別時刻の2ノーツが落ちる。
  //
  // setTimeout(0) はマクロタスクなので、いま配送中のイベントのリスナが全部
  // 走り終わってから実行される。これで鍵が必ず先に掛かる。
  // (queueMicrotask のままでは、リスナの途中で割り込むので順序を保証できない)
  const defer=fn=>{if(typeof setTimeout==='function')setTimeout(fn,0);else if(typeof queueMicrotask==='function')queueMicrotask(fn);else Promise.resolve().then(fn);};
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
  const dispatchTapProbe=(area,touch,subLane,sourceKey)=>{
    if(!area?.dispatchEvent)return false;
    const rect=RHYTHM_VIEW_ROTATION.rectOf(area);
    if(!(rect&&rect.width>0&&rect.height>0))return false;
    // 出す先はDOMなので、撃つ座標だけは「回したあと」へ戻す。
    // (受け取る側がまた回す前へ直すので、行って帰って元の場所になる)
    const local=pointForSubLane(subLane,touch.clientY,rect);
    const id=++nextSyntheticPointerId,key=`pointer:${id}`,point=RHYTHM_VIEW_ROTATION.unpoint(local.clientX,local.clientY);
    syntheticTapKeys.add(key);
    syntheticTapSources.set(key,String(sourceKey));
    try{
      area.dispatchEvent(makePointerEvent('pointerdown',id,point));
      area.dispatchEvent(makePointerEvent('pointerup',id,point));
      return true;
    }finally{syntheticTapKeys.delete(key);syntheticTapSources.delete(key);}
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
  const clear=()=>{touchStates.clear();physicalTargetTimes.clear();applyTouchSpanGlow();};
  // 1回の物理接触から出す接触幅用の疑似TAPは、中心入力が取ったノーツと同じ時刻だけを補う。
  // 中心に対象が無い場合は最初の疑似TAPが時刻を決め、同じ接触の残りもそこへ束ねる。
  // これで同時押し・幅広ノーツは維持しつつ、88ms先など別時刻のTAPを先食いしない。
  const recordPhysicalTarget=(key,target)=>{
    const value=String(key);
    if(!value.startsWith('touch:'))return;
    const noteTime=Number(target?.timeMs);
    if(Number.isFinite(noteTime))physicalTargetTimes.set(value,noteTime);
    else physicalTargetTimes.delete(value);
  };
  const syntheticTargetTime=key=>{
    const source=syntheticTapSources.get(String(key));
    return source&&physicalTargetTimes.has(source)?physicalTargetTimes.get(source):null;
  };
  const claimSyntheticTarget=(key,target)=>{
    const source=syntheticTapSources.get(String(key)),noteTime=Number(target?.timeMs);
    if(source&&!physicalTargetTimes.has(source)&&Number.isFinite(noteTime))physicalTargetTimes.set(source,noteTime);
  };
  const startOrMove=(event,isStart)=>{
    if(typeof document==='undefined')return;
    const eventArea=event.target?.closest?.('[data-rhythm-play-area]'),fallbackArea=document.querySelector('[data-rhythm-play-area]'),area=eventArea||fallbackArea;
    if(!area)return;
    if(isStart&&!eventArea)return;
    const rect=RHYTHM_VIEW_ROTATION.rectOf(area);
    if(!(rect&&rect.width>0&&rect.height>0))return;
    const actions=[];
    // 自前で回しているときは、指のほうも「回す前」にそろえてから配る。
    // 当たりの半径(radiusX)も90度ぶん入れ替わるので RHYTHM_VIEW_ROTATION.touch がまとめて直す
    Array.from(event.changedTouches||[]).map(t=>RHYTHM_VIEW_ROTATION.touch(t)).forEach(touch=>{
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
          action.entered.filter(lane=>lane!==action.next.centerSubLane).forEach(lane=>dispatchTapProbe(area,action.touch,lane,baseKey));
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
    const finish=event=>{Array.from(event.changedTouches||[]).forEach(touch=>{touchStates.delete(Number(touch.identifier));physicalTargetTimes.delete(`touch:${touch.identifier}`);});defer(applyTouchSpanGlow);};
    document.addEventListener('touchend',finish,{capture:true,passive:true});
    document.addEventListener('touchcancel',finish,{capture:true,passive:true});
    document.addEventListener('click',event=>{if(event.target?.closest?.('[data-rhythm-pause],[data-rhythm-pause-menu] button'))clear();},true);
  }
  return {contactsForTouch,isSyntheticTapKey:key=>syntheticTapKeys.has(String(key)),recordPhysicalTarget,syntheticTargetTime,claimSyntheticTarget,clear,_touchStates:touchStates,_syntheticTapKeys:syntheticTapKeys,_syntheticTapSources:syntheticTapSources,_physicalTargetTimes:physicalTargetTimes,_stabilizedMoveTouch:stabilizedMoveTouch,_radiusExpansionAccepted:radiusExpansionAccepted};
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
const rhythmChooseTapTarget=(passed,upcoming,now)=>{
  if(!passed)return upcoming;
  if(!upcoming)return passed;
  // 【2026-09-11・「押したときにBADを拾う」の対策】
  // 片方がもう BAD にしかならない位置にいて、もう片方はまだコンボがつながるなら、
  // 時刻の取り分(switchAt)を見るまでもなく**つながるほう**を取る。
  //
  // どちらを取っても、取らなかったほうは残って見逃しMISSになる。だからここは
  // 「2つのうちどちらを捨てるか」の選択でしかない。BADはコンボが切れるので
  // MISSと同じ側であり、捨てるならBADにしかならないほうを捨てるのが必ず得になる。
  //   例) A=1000ms(叩けずに残っている) / B=1300ms を狙って1180msに叩く
  //       直す前 … Aが+180msで取られて BAD。Bは残って MISS。1入力で2つ崩れる
  //       直した後 … Bが-120msで取られて GREAT。Aだけが MISS
  const passedComboSafe=Math.abs(now-passed.noteTime)<=RHYTHM_COMBO_SAFE_WINDOW_MS;
  const upcomingComboSafe=Math.abs(now-upcoming.noteTime)<=RHYTHM_COMBO_SAFE_WINDOW_MS;
  if(passedComboSafe!==upcomingComboSafe)return passedComboSafe?passed:upcoming;
  const gap=upcoming.noteTime-passed.noteTime;
  if(!(gap>0))return passed;
  // 時刻だけでは「前を遅く叩いた」のか「次を少し早く叩いた」のか判別不能な帯がある。
  // そこで中間点ではなく前へ寄せた境界を作る。密な連打で+60ms程度の遅れを次へ飛ばさず、
  // 一方で次ノーツ直前の早押しを取り逃した前ノーツへ吸わせ続けない。
  const switchAt=Math.max(
    passed.noteTime+gap*RHYTHM_TAP_TARGET_PREVIOUS_SHARE,
    upcoming.noteTime-RHYTHM_TAP_TARGET_UPCOMING_MAX_EARLY_MS
  );
  return now>=switchAt?upcoming:passed;
};
// 1フレームに複数の指が来たとき、どの入力から先に相手を決めるか。
//
// 【2026-09-11・指を置いた順で結果が変わっていた】
// 入力は先に処理したものが claimed で勝つ「早い者勝ち」で、並び順は
// Array.from(e.touches) の順＝**指が画面に触れた順**。位置とは何の関係もない。
// そのため同じ配置でも、置いた順で片方が空打ちになりノーツが1つ見逃しになった。
//
//   実測: X=sub0〜2(中心1) / Y=sub3〜5(中心4) が同時刻。
//         f1=sub2.6(どちらの内側でもない・Yの中心に近い) / f2=sub4.0(Yの内側だけ)
//     順[f1,f2] … f1がYを取り、f2は行き先が無く空打ち → **Xが見逃しMISS**
//     順[f2,f1] … f2がY、f1がX。両方取れる
//
// f2は「Yしか選べない」のに、f1は「XでもYでもよい」。選べる先が狭いほうを先に通せば、
// 広いほうは残りへ回れる。ここでは「どれかのノーツの帯の内側にいるか」を狭さの目安にする
// (内側にいる指は、その帯を狙っているのがはっきりしている)。
// 並べ替えは安定ソートなので、同じ区分どうしの順番は触れた順のまま変わらない。
const rhythmOrderInputsForMatch=(inputs,isInsideSomeNote)=>{
  const list=Array.isArray(inputs)?inputs:[];
  if(list.length<2)return list;
  return list
    .map((input,order)=>({input,order,inside:isInsideSomeNote(input)?0:1}))
    .sort((a,b)=>a.inside-b.inside||a.order-b.order)
    .map(entry=>entry.input);
};
const rhythmMatchInputBatch=(notes,inputs,nowMs,offsetMs=0)=>{
  const source=Array.isArray(notes)?notes:[],claimed=new Set(),seenInputs=new Set(),now=Number(nowMs),offset=Number(offsetMs)||0;
  const [matchStart,matchEnd]=rhythmInputMatchBounds(source,now,offset);
  // 相手を決める前に、選べる先が狭い入力から順に並べ替える(上の説明)。
  // 見るのは位置だけで、時刻の取り合い(switchAt)には一切触れない。
  const insideSomeNote=input=>{
    const coordinate=Number(input?.subLaneCoordinate);
    if(!Number.isFinite(coordinate))return false;
    for(let index=matchStart;index<matchEnd;index++){
      const note=source[index];
      if(!note||note.done||note.activePointerId!==null||!RHYTHM_NOTE_TYPES.includes(note.type))continue;
      if(Math.abs(now-(Number(note.timeMs)+offset))>RHYTHM_INPUT_MATCH_WINDOW_MS)continue;
      const span=rhythmNoteHasVariableSpan(note)
        ?(()=>{const projected=rhythmProjectSubLaneSpan(note.subLane,note.subLaneWidth,1);
               return {start:projected.subLane,end:projected.subLane+projected.subLaneWidth};})()
        :rhythmSlideInputSpan(note);
      if(!span)continue;
      if(coordinate>=span.start&&coordinate<=span.end)return true;
    }
    return false;
  };
  return rhythmOrderInputsForMatch(inputs,insideSomeNote).map(input=>{
    const key=String(input?.inputKey??'');
    if(!key||seenInputs.has(key))return {input,target:null,deltaMs:null};
    seenInputs.add(key);
    const lane=Number(input?.lane),subCoordinate=Number(input?.subLaneCoordinate),tapOnly=RHYTHM_TOUCH_SPAN_RUNTIME.isSyntheticTapKey(key),syntheticTime=RHYTHM_TOUCH_SPAN_RUNTIME.syntheticTargetTime(key);
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
    // 遅れ側に候補が無いときだけ、これから来るノーツ（早く押した場合）を見る。
    //
    // 過ぎている側が2つ以上あるときは、**いちばん後ろ（時刻の新しいほう）**を取る。
    // ここは2026-09-05に2回直している。
    //   1回目 … 時間の差の**絶対値**でいちばん近いものを選んでいた。
    //           1つめの0.06秒あとに叩くと、0.088秒先の2つめのほうが「近い」ことになって
    //           まだ来ていないノーツを取ってしまう
    //           (ユーザー指摘「次のノーツのBad範囲内に入るとそっちを拾ってる」)。
    //   2回目 … そこで「過ぎている中でいちばん前」にしたところ、今度は逆に
    //           **後ろのノーツを巻き込む**ようになった。16分(0.088秒)で並ぶ2つを、
    //           2つめの時刻ちょうどで叩いても1つめが取られ、2つめは必ずMISSになる。
    //           1回の入力で2つ崩れる(ユーザー指摘「あとのノーツを巻き込んでる」)。
    //
    // 「過ぎている中でいちばん後ろ」なら両方とも起きない。
    //   ・1つめの0.06秒あと … 2つめはまだ来ていない(過ぎていない)ので1つめが取れる
    //   ・2つめの時刻ちょうど … 2つめも過ぎているので2つめが取れる。1つめだけがMISS
    // つまり1つのノーツが取られるのは「次のノーツの時刻が来るまで」。
    // 判定の受付幅(前後0.24秒)がノーツの間隔(16分で0.088秒)より広くても、
    // 受け付ける相手が前後へ滑らない。
    // 同じ時刻に複数あるときだけ、押した位置にいちばん近いものを選ぶ。
    // 押した位置がノーツの内側そのものに入っているか。
    // ぎりぎり外側(許容ぶん)で受け付けたものより、内側を必ず優先する。
    // これをしないと、幅の広いノーツの内側を押しているのに、中心がたまたま近い
    // 隣のノーツが取られる(2026-09-05・実機の指摘「タップ判定の巻き込み」)。
    const isInside=note=>{
      const span=inputSpan(note);
      if(!span||!Number.isFinite(subCoordinate))return false;
      return subCoordinate>=span.start&&subCoordinate<=span.end;
    };
    // 過ぎている側とまだ来ていない側を**別々に**いちばん良いものまで絞り、
    // 最後に「叩いた時刻に近いほう」を選ぶ。
    //
    // 以前は過ぎている側を無条件に優先していた。そのため
    //   ノーツA=1.000秒 / ノーツB=1.100秒 で、Bを狙って1.099秒(ほぼジャスト)に叩くと、
    //   0.099秒も前のAが取られ、狙ったBは巻き込まれてMISSになる
    // という状態だった(2026-09-05・実機の指摘「タップ判定の巻き込みもまだある」)。
    // 近いほうを選べばBが取れる。ほかの叩き方(16分・8分・3連符・連打の取りこぼし)は
    // 結果が変わらないことを tools/mode/rhythm-tap-target-check.js で確かめている。
    const candidate=(current,note,index,noteTime,inside,distance,preferLater,span)=>{
      const made={note,index,noteTime,inside,distance,span};
      if(!current)return made;
      // 時刻がいちばん端のものを選ぶ。過ぎている側は後ろ、まだ来ていない側は前
      if(noteTime!==current.noteTime)
        return (preferLater?noteTime>current.noteTime:noteTime<current.noteTime)?made:current;
      // 同じ時刻なら、内側にあるほう
      if(inside!==current.inside)return inside?made:current;
      // 【2026-09-11】どちらの内側にもいるときは、**細いほう**を先に見る。
      // 幅の広いノーツと細いノーツが同じ時刻で重なっていると、細いほうの内側を
      // 押しているのに「中心がたまたま近い」広いほうが取られていた
      // (実測: 全幅TAP(中心5)と幅1TAP(sub5〜6,中心5.5)が重なるとき、sub5.2を押すと全幅が取れる)。
      // 細い帯をわざわざ押しているのだから、狙いはそちら。取られた広いほうは
      // もう片方の指が来るまで残るので、1入力で2つ崩れる形にもなっていた。
      if(inside&&current.inside&&Number.isFinite(span)&&Number.isFinite(current.span)&&span!==current.span)
        return span<current.span?made:current;
      // それも同じなら押した位置に近いほう
      return distance<current.distance?made:current;
    };
    let passedBest=null,upcomingBest=null;
    for(let index=matchStart;index<matchEnd;index++){
      const note=source[index];
      if(claimed.has(index)||!note||note.done||note.activePointerId!==null||!RHYTHM_NOTE_TYPES.includes(note.type)||tapOnly&&note.type!=='TAP')continue;
      const noteTime=Number(note.timeMs)+offset;
      if(tapOnly&&Number.isFinite(syntheticTime)&&Math.abs(Number(note.timeMs)-syntheticTime)>.001)continue;
      const timeDistance=Math.abs(now-noteTime);
      if(!(timeDistance<=RHYTHM_INPUT_MATCH_WINDOW_MS)||!acceptsPosition(note))continue;
      // 【2026-09-11・早押しでノーツを「BADで食べる」のをやめる】
      // まだ来ていないTAPを、もうBADにしかならない早さ(GOODの窓より外)で取ると、
      // コンボを切ったうえにノーツまで消える。叩き直せばMARVELOUSで取れたはずのものを、
      // 自分から捨てることになっていた。空打ちには何のペナルティも無い
      // (30-rhythm-play.jsx、音が鳴るだけ)ので、取らずに残すほうが必ず得。
      //
      // 遅れ側は逆で、放っておけば確実に見逃しMISSになるぶん、BADでも拾えたほうがまし。
      // だからここは**早押し側だけ**を狭める。
      // HOLD/SLIDE/FLICKは指を置き続ける・弾く一続きの操作で、取らなかったら押し直しが
      // 効かない(指はもう降りている)。巻き込みが起きるのはTAPなので、TAPだけに限る。
      if(now<noteTime&&note.type==='TAP'&&timeDistance>RHYTHM_COMBO_SAFE_WINDOW_MS)continue;
      const distance=spatialDistance(note),inside=isInside(note);
      const noteSpan=inputSpan(note),spanWidth=noteSpan?Number(noteSpan.width):NaN;
      if(now>=noteTime)passedBest=candidate(passedBest,note,index,noteTime,inside,distance,true,spanWidth);
      else upcomingBest=candidate(upcomingBest,note,index,noteTime,inside,distance,false,spanWidth);
    }
    // 過ぎている側とまだ来ていない側の両方がある場合は、判定ランクの良し悪しではなく
    // 「ノーツ間のどこまでを前ノーツの所有時間にするか」で決める。
    //
    // 単純な近い方(50:50)や判定ランク優先は、16分で60ms遅れただけでも次ノーツへ飛び、
    // 以後の入力まで1つ先へずれる前方引っ張りを起こした。一方、前を100%優先すると
    // 次ノーツの10ms程度の早押しまで取り逃した前ノーツへ吸われ、1つ後ろへずれ続ける。
    // そのため前75% / 次25%を基本にし、次側の早取りはMARVELOUS窓より広げない。
    const chosen=rhythmChooseTapTarget(passedBest,upcomingBest,now);
    let picked=chosen?chosen.note:null,pickedIndex=chosen?chosen.index:-1;
    // 持ち替え待ちで浮いているノーツは、開始時刻がどれだけ前でも候補へ入れる。
    // ふつうの候補より**先に**取る。押さえ直しをほかのノーツへ吸われると、
    // 持ち替えが失敗して必ずMISSになるため。
    // 見るのは「いまの帯へ指が乗ったか」だけで、時間の近さは見ない(押さえ直しなので)。
    //
    // 【2026-09-11・ただし「ちょうど今来ているノーツ」だけは譲らない】
    // 時間を一切見ずに**無条件で**上書きしていたため、浮いているノーツの帯に重なる入力は
    // すべて吸われていた。とくに画面いっぱいの幅を持つHOLD/SLIDEを離した直後は、
    // 受付範囲がプレイエリア全域になり、持ち替え猶予(200ms)のあいだに来たTAPが
    // 「どこを叩いても」落ちる状態だった。叩いたほうは見逃しMISSになるので、
    // 1入力で2つ崩れる形の巻き込みそのもの。
    // ふつうの候補がまだコンボのつながる範囲(GOODの窓)にいるなら、そちらが本命の入力。
    // 持ち替えは「ほかに取るものが無いとき」に効けば足りる。
    const chosenComboSafe=chosen&&Math.abs(now-chosen.noteTime)<=RHYTHM_COMBO_SAFE_WINDOW_MS;
    if(RHYTHM_FLOATING_NOTES.size&&!chosenComboSafe){
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
    // どれにも当たらなかったとき、いま**押さえられている**HOLD/SLIDEの帯の上に
    // 指を置いたのなら、それは空打ちではなく「持ち替えのために置いた2本目の指」。
    //
    // 【なぜ要るか】(2026-09-05・プレイヤーからの声)
    //   「左指でスライダーノーツ押さえてて、左指で押さえた状態で右指を置くとミス判定。
    //     スライダーノーツを左指で押さえる → 同じスライダーノーツを右指で押さえる →
    //     左指を離して続きを右指で押さえ、左指は自由にする」
    //   「指置き換えがプロセカの感覚でやってると確実にミス」
    //
    // 親指で遊ぶ人は**先に2本目を置いてから1本目を離す**。ところがこちらは
    // 「離してから置き直す」順番しか想定しておらず、押さえている帯へ置いた2本目は
    // どのノーツにも当たらない＝空打ちになっていた。しかも1本目を離したときには
    // 2本目はもう画面に触れているので新しい入力が起きず、引き継ぐきっかけが無い。
    // 猶予を過ぎて必ずMISSになる、というのがこの声の正体。
    //
    // ここでは「控えの指」として返すだけで、判定も音も出さない。
    // 実際の引き継ぎは、1本目が離れたときに game-system.jsx 側が行う。
    if(!picked&&!tapOnly&&Number.isFinite(subCoordinate)){
      for(let index=0;index<source.length;index++){
        const note=source[index];
        if(!note||note.done||note.activePointerId===null)continue;
        if(!(note.type==='HOLD'||rhythmNoteIsSlide(note)||note._rhythmOriginalType==='SLIDE'))continue;
        if(note.activePointerId===key)continue;   // 自分がいま押さえている指
        const span=rhythmHandoverSpanAt(note,now-offset);
        const tolerance=span.width<=1?RHYTHM_NARROW_TAP_TOLERANCE_SUB_LANES:RHYTHM_TAP_TOLERANCE_SUB_LANES;
        if(subCoordinate<span.start-tolerance||subCoordinate>span.end+tolerance)continue;
        return {input,target:null,deltaMs:null,standby:note};
      }
    }
    if(!picked)return {input,target:null,deltaMs:null};
    claimed.add(pickedIndex);
    if(tapOnly)RHYTHM_TOUCH_SPAN_RUNTIME.claimSyntheticTarget(key,picked);
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

// 自動譜面制作システムV2(STEP1〜7)が作った候補。**凍結済み**(2026-09-13)。
// V2の生成系統は引退したので、この中身を作り直す道具はもう無い。手でも書かない。
// 残してあるのは、V3と聴き比べる入口としてと、検査
// (rhythm-chart-musical-tempo-check.js / rhythm-chart-v2-step7-check.js)が
// この譜面を土台に使っているため。
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
  t(2805,5,4,0),t(4018,6,4,0),t(5404,5,4,0),h(5577,7,3,6443,0,[[5577,7,3],[5837,6,4],[6183,6,4],[6443,4,6]]),
  t(6790,5,4,0),t(6963,5,4,0),h(7483,5,4,8349),t(9215,3,4,0),
  t(9562,5,4,0),t(10255,3,4,0),t(11468,0,4,0),t(11988,1,4,0),
  t(12334,3,4,0),t(12854,5,4,0),t(13547,6,4,0),t(14413,0,10,0),
  t(15799,3,4,0),t(16492,5,4,0),t(17878,6,4,0),t(18571,5,4,0),
  t(19264,3,4,0),t(20304,0,6,0),t(20997,0,6,0),t(21690,0,6,0),
  t(23423,0,6,0),t(24116,1,4,0),t(24635,3,4,0),t(25502,4,6,0),
  t(26195,3,4,0),t(26541,0,6,0),t(26888,2,6,0),t(28274,1,4,0),
  t(28967,2,6,0),t(29660,1,4,0),t(30353,3,4,0),t(31046,4,6,0),
  t(31392,2,6,0),t(32432,4,6,1),t(33125,3,4,0),t(33471,5,4,0),
  t(33818,3,4,0),t(34511,0,6,0),t(35897,5,4,0),t(36590,3,4,0),
  t(36937,0,6,0),t(37283,0,4,0),t(38323,5,4,0),t(38669,3,4,0),
  t(39362,1,4,0),t(40055,0,4,0),t(40575,1,4,0),t(41268,2,6,0),
  h(42134,5,4,43520),t(43867,4,6,0),t(44906,6,4,0),t(45253,4,6,0),
  t(46466,5,4,0),t(47159,6,4,0),t(47505,0,6,0),t(47679,3,4,0),
  t(48025,4,6,0),t(48372,6,4,0),t(48545,5,4,0),h(49065,4,6,50104,0,[[49065,4,6],[49411,5,4],[49758,5,4],[50104,6,3]]),
  t(50451,0,3,0),t(50451,7,3,0),t(50797,4,6,0),t(51144,3,4,0),
  t(51837,5,4,0),t(52530,5,4,0),t(52703,4,6,0),t(53223,6,4,0),
  t(53569,4,6,0),t(53916,0,10,0),t(54609,6,4,0),t(54955,5,4,0),
  t(55648,5,4,0),t(55995,3,4,0),t(56688,0,6,0),t(56861,3,4,0),
  t(57554,1,4,0),t(57728,0,4,0),t(58247,1,4,0),t(58421,3,4,0),
  t(58767,1,4,0),t(59114,0,4,0),t(59460,1,4,0),t(59633,3,4,0),
  t(60153,5,4,0),t(60500,6,4,0),t(60846,5,4,0),t(61193,2,6,0),
  t(61539,0,6,2),t(62232,0,4,0),t(62752,0,4,0),t(62925,1,4,0),
  t(63618,0,4,0),t(63792,1,4,0),t(64311,0,6,0),t(65004,1,4,0),
  t(65178,0,6,0),t(65697,1,4,0),t(67083,3,4,0),t(67257,1,4,0),
  t(67603,3,4,0),t(67776,0,6,0),t(68469,0,6,0),h(68989,0,4,69769),
  t(69856,0,4,0),t(70549,0,3,0),t(70549,7,3,0),t(70895,1,4,0),
  t(71242,1,4,0),t(71935,5,4,0),t(72108,3,4,0),t(72628,1,4,0),
  t(72974,0,4,0),t(73321,0,4,0),t(73667,1,4,0),t(74360,3,4,0),
  t(74707,0,6,0),t(75400,3,4,0),t(75920,5,4,0),t(76093,3,4,0),
  t(76439,4,6,0),t(76613,0,10,0),t(76959,6,4,0),t(77479,5,4,0),
  t(77825,4,6,0),t(78518,4,6,0),t(78692,3,4,0),t(79385,1,4,0),
  t(79731,2,6,0),t(80944,0,6,0),t(81291,0,4,0),t(81637,0,6,0),
  t(81810,0,6,0),t(82330,0,4,0),t(82850,0,6,0),t(83196,3,4,0),
  t(83370,0,6,0),t(84063,0,6,0),t(84409,3,4,0),t(84929,1,4,0),
  t(85102,0,4,0),t(85622,1,4,0),t(86488,0,4,0),t(86835,1,4,0),
  h(87008,4,3,87788,0,[[87008,4,3],[87441,2,6],[87788,4,3]]),t(87874,5,4,0),t(88221,5,4,0),t(89260,4,6,0),
  t(89607,7,3,0),t(89607,0,3,0),h(89953,2,6,90820),t(91339,6,4,3),
  t(92033,4,6,0),t(92379,2,6,0),t(92726,0,6,0),h(93072,0,6,94458),
  t(94805,3,4,0),t(95151,4,6,0),h(95844,3,4,96537),t(97230,3,4,0),
  t(97577,5,4,0),t(97923,6,4,0),t(98270,5,4,0),t(98616,4,6,0),
  t(98790,5,4,0),t(99309,3,4,0),t(100002,4,6,0),t(101215,0,6,0),
  t(101562,1,4,0),t(102081,3,4,0),t(102601,5,4,0),t(102948,6,4,0),
  t(103121,6,4,0),t(103468,5,4,0),h(103814,2,6,104854,0,[[103814,2,6],[104161,3,4],[104507,3,4],[104854,2,6]]),t(105547,6,4,0),
  t(105893,5,4,0),t(106240,3,4,0),t(106586,1,4,0),t(107106,0,4,0),
  t(107972,0,10,0),t(108492,1,4,0),t(108665,0,4,0),t(109358,1,4,0),
  t(109532,0,4,0),t(110051,1,4,0),t(110398,0,4,0),t(110744,0,4,0),
  t(110918,1,4,0),t(111437,3,4,0),t(112130,6,4,0),t(112823,7,3,0),
  t(112823,0,3,0),t(113170,5,4,0),t(113516,4,6,0),t(113690,5,4,0),
  t(114210,6,4,0),t(114383,5,4,0),t(114903,6,4,0),t(115076,5,4,0),
  t(115596,6,4,0),t(116289,4,6,0),t(116808,2,6,0),t(116982,1,4,0),
  t(117848,0,4,0),t(118194,0,6,0),t(118368,2,6,0),t(118887,1,4,0),
  t(119061,3,4,0),t(119407,1,4,0),t(119580,3,4,0),t(120100,1,4,4),
  t(120447,0,4,0),t(120620,0,6,0),t(121140,0,6,0),t(121486,1,4,0),
  t(121833,0,4,0),t(122179,1,4,0),t(122526,3,4,0),t(123219,5,4,0),
  t(123392,2,6,0),t(123912,5,4,0),t(124258,4,6,0),t(124605,5,4,0),
  t(125125,6,4,0),t(125298,5,4,0),t(125818,2,6,0),t(125991,1,4,0),
  t(126338,0,10,0),t(126511,1,4,0),h(127031,0,6,128417),t(128763,0,4,0),
  t(129283,0,4,0),t(129456,0,4,0),t(129803,0,3,0),t(129803,7,3,0),
  t(130149,0,4,0),t(130496,0,4,0),t(130669,1,4,0),h(131189,1,4,132315),
  t(132748,0,4,0),t(133095,1,4,0),t(133614,3,4,0),t(133961,5,4,0),
  h(134134,6,4,135520),t(135693,3,4,0),t(136040,5,4,0),t(136213,3,4,0),
  t(137253,1,4,0),h(137426,1,4,138206),t(138466,0,4,0),t(138639,1,4,0),
  t(139159,3,4,0),t(139505,1,4,0),t(139852,3,4,0),t(140198,5,4,0),
  t(140371,5,4,0),t(141064,6,4,0),t(141238,5,4,0),t(141931,6,4,0),
  t(142104,5,4,0),t(142624,5,4,0),t(143144,6,4,0),t(143317,6,4,0),
  t(143837,5,4,0),t(144010,3,4,0),t(144356,1,4,0),t(144703,0,6,0),
  t(145049,1,4,0),t(145396,0,4,0),t(145742,1,4,0),t(146089,0,6,0),
  t(146609,0,4,0),t(146782,0,6,0),t(147128,0,4,0),t(147475,0,6,0),
  t(148168,2,6,0),t(148861,7,3,0),t(148861,0,3,0),t(149208,2,6,0),
  t(149381,5,4,0),t(149901,0,10,0),
// </monster-hero-v3-easy-notes>
])(mhTap,mhHoldV2,mhFlick,mhSlideV2);
const monsterHeroV3NormalNotes=((t,h,f,s)=>[
// <monster-hero-v3-normal-notes>
  f(2805,1,4),t(4018,0,4,0),t(4537,1,4,0),t(5404,3,4,0),
  h(5577,2,2,6443,1,[[5577,2,2],[5837,2,3],[6183,1,4],[6443,0,6]]),t(6790,0,4,0),h(7483,3,4,8349),t(9215,1,4,0),
  t(9562,3,4,0),t(10255,5,4,0),t(10601,6,4,0),t(11988,5,4,0),
  t(12334,3,4,0),t(12854,1,4,0),t(13547,0,3,0),t(14413,0,10,0),
  t(15799,3,4,0),t(16492,3,4,0),t(17878,5,4,0),t(18571,6,4,0),
  t(19264,5,3,0),t(20304,0,6,0),t(20997,4,6,0),t(21690,2,6,0),
  t(23076,0,6,0),f(23423,0,6),t(24116,3,4,0),t(24635,3,4,0),
  t(25502,4,6,0),t(26195,3,4,0),t(26888,0,6,0),t(28274,0,4,0),
  t(28620,3,3,0),t(28967,0,6,0),t(29660,3,4,0),t(30353,0,4,0),
  t(31046,2,6,0),t(31392,0,6,0),t(32432,2,6,1),t(32778,0,6,0),
  t(33125,3,4,0),t(33471,7,3,0),t(33818,3,4,0),t(34511,0,6,0),
  t(35897,1,4,0),t(36590,0,3,0),t(36937,0,6,0),t(37283,0,4,0),
  t(38323,5,3,0),f(38669,3,4),t(39362,1,4,0),t(40055,0,4,0),
  t(40575,1,4,0),t(41268,2,6,0),h(42134,5,4,43520),t(43867,4,6,0),
  t(44560,5,3,0),t(44906,6,4,0),h(45253,4,6,45946),t(46466,3,4,0),
  t(47159,7,3,0),t(47505,4,6,0),t(47679,7,3,0),t(47679,0,3,0),
  t(48025,4,6,0),t(48372,6,4,0),t(48545,5,4,0),h(49065,4,6,50104,0,[[49065,4,6],[49411,6,4],[49758,7,3],[50104,7,2]]),
  t(50451,1,4,0),t(50797,2,6,0),t(51144,5,4,0),t(51837,6,4,0),
  t(52703,4,6,0),t(53223,5,4,0),f(53569,4,6),t(53916,4,6,0),
  t(54089,4,6,0),t(54609,6,4,0),t(54955,7,3,0),t(55475,6,4,0),
  t(55648,5,3,0),t(55995,3,4,0),t(56688,0,10,0),t(56861,0,4,0),
  t(57034,0,6,0),t(57554,3,4,0),t(57728,5,4,0),t(58247,6,4,0),
  t(58421,6,4,0),t(58767,3,3,0),t(59114,0,3,0),t(59460,1,4,0),
  t(59633,5,4,0),t(60153,3,4,0),t(60500,7,3,0),t(60846,1,4,0),
  t(61193,2,6,0),t(61539,4,6,2),f(61886,7,3),t(62232,7,3,0),
  t(62232,0,3,0),t(62752,3,4,0),t(62925,1,4,0),t(63618,0,4,0),
  t(63792,0,4,0),t(64311,0,6,0),t(65004,0,4,0),t(65178,0,6,0),
  t(65351,2,6,0),t(65697,5,4,0),t(65871,1,4,0),t(67083,3,4,0),
  t(67257,1,4,0),t(67603,0,4,0),t(67776,0,6,0),t(68469,0,6,0),
  h(68989,3,4,69769),t(69856,3,4,0),t(70549,5,4,0),t(70722,6,4,0),
  t(70895,5,3,0),t(71242,5,4,0),t(71935,5,4,0),f(72108,6,4),
  t(72628,6,4,0),t(72974,5,3,0),t(73321,3,4,0),t(73667,1,3,0),
  t(74360,0,3,0),t(74534,1,4,0),t(74707,0,6,0),t(75400,1,4,0),
  t(75920,0,4,0),t(76093,0,4,0),t(76439,0,6,0),t(76613,0,6,0),
  t(76959,1,4,0),t(77479,0,3,0),t(77479,7,3,0),t(77825,0,6,0),
  t(78518,0,10,0),t(78692,1,4,0),t(78865,0,6,0),t(79211,0,6,0),
  t(79385,3,4,0),t(79731,4,6,0),t(80944,4,6,0),f(81291,5,3),
  t(81637,4,6,0),t(81810,4,6,0),t(82330,6,4,0),t(82850,4,6,0),
  t(83196,5,4,0),t(83370,4,6,0),t(83716,3,4,0),t(84063,4,6,0),
  t(84409,3,4,0),h(84929,7,2,85622,1,[[84929,7,2],[85275,4,6],[85622,7,2]]),t(86488,6,4,0),h(86835,6,4,87788),
  t(87874,5,4,0),t(88221,6,4,0),t(88567,5,4,0),t(89260,2,6,0),
  t(89607,5,4,0),h(89953,4,6,90820),t(90993,3,4,0),t(91339,0,4,3),
  t(92033,2,6,0),t(92379,4,6,0),t(92726,2,6,0),h(93072,0,6,94458),
  f(94805,1,4),t(95151,4,6,0),h(95844,1,4,96537),t(97230,0,3,0),
  t(97230,7,3,0),t(97577,5,4,0),t(97923,7,3,0),t(98270,5,3,0),
  t(98616,4,6,0),t(98790,5,4,0),t(99309,3,4,0),t(100002,4,6,0),
  t(100349,6,4,0),t(101215,0,6,0),t(101562,1,4,0),t(102081,3,4,0),
  t(102601,5,4,0),t(102948,7,3,0),t(103121,5,4,0),t(103468,1,4,0),
  h(103814,4,6,104854,0,[[103814,4,6],[104161,6,3],[104507,6,3],[104854,4,6]]),t(105547,3,4,0),t(105893,5,4,0),t(106240,6,4,0),
  t(106586,5,4,0),f(107106,3,4),t(107972,0,10,0),t(108492,5,4,0),
  t(108665,3,3,0),t(109358,7,3,0),t(109532,6,4,0),t(110051,5,4,0),
  t(110398,7,3,0),t(110571,5,3,0),t(110744,3,4,0),t(111091,7,3,0),
  t(111091,0,3,0),t(111437,3,4,0),t(112130,1,4,0),t(112823,3,4,0),
  t(113170,1,3,0),t(113516,2,6,0),t(113690,5,4,0),t(114210,3,4,0),
  t(114383,1,4,0),t(114903,3,4,0),t(115076,5,4,0),t(115249,4,6,0),
  t(115596,3,4,0),t(115942,5,3,0),f(116289,2,6),t(116808,4,6,0),
  t(116982,6,4,0),t(117155,4,6,0),t(117848,3,4,0),t(118194,0,6,0),
  t(118368,0,6,0),t(118714,3,3,0),t(118887,1,4,0),t(119061,0,4,0),
  t(119407,1,3,0),t(119580,1,4,0),t(119754,0,4,0),t(120100,1,4,0),
  t(120447,0,4,0),t(120620,0,6,0),t(120793,1,3,0),t(121140,0,6,4),
  t(121486,1,3,0),t(121833,5,4,0),t(122006,2,4,0),t(122179,0,3,0),
  t(122179,7,3,0),t(122526,0,4,0),t(123219,1,4,0),t(123392,2,6,0),
  f(123565,4,6),t(123912,6,4,0),t(124258,4,6,0),t(124605,5,4,0),
  t(124778,6,4,0),t(125125,6,4,0),t(125298,5,4,0),t(125818,4,6,0),
  t(125991,5,4,0),t(126164,6,4,0),t(126684,4,6,0),t(127031,0,10,0),
  h(127204,6,4,128417,1),t(128763,3,4,0),t(128936,5,4,0),t(129283,6,4,0),
  t(129456,5,4,0),t(129629,5,4,0),t(130149,5,4,0),t(130496,6,4,0),
  t(130669,6,4,0),t(130842,3,4,0),h(131189,6,4,132315),t(132575,1,4,0),
  f(132748,5,4),t(133095,3,4,0),t(133614,6,4,0),t(133961,5,3,0),
  t(134134,6,4,0),h(134307,4,6,135693),t(135867,2,4,0),t(136040,0,3,0),
  t(136040,7,3,0),t(136386,3,4,0),t(137253,1,4,0),h(137426,5,3,138206),
  t(138466,0,4,0),t(138639,3,4,0),t(139159,6,4,0),t(139505,3,3,0),
  t(139678,5,4,0),t(139852,6,4,0),t(140198,1,3,0),t(140371,5,4,0),
  t(140545,3,4,0),t(141064,5,4,0),t(141238,3,4,0),t(141757,1,4,0),
  t(141931,0,4,0),f(142104,0,4),t(142624,0,4,0),t(143144,1,4,0),
  t(143317,1,4,0),t(143837,0,4,0),t(144010,3,4,0),t(144183,1,4,0),
  t(144703,4,6,0),t(145049,1,3,0),t(145396,0,4,0),t(145742,1,3,0),
  t(146089,0,6,0),t(146609,1,4,0),t(146782,0,6,0),t(147128,1,4,0),
  t(147475,0,6,0),t(147821,0,4,0),t(148168,0,6,0),t(148861,0,3,0),
  t(148861,7,3,0),t(149208,0,6,0),t(149381,0,3,0),t(149554,2,6,0),
  t(149901,0,10,0),f(150247,5,4),
// </monster-hero-v3-normal-notes>
])(mhTap,mhHoldV2,mhFlick,mhSlideV2);
const monsterHeroV3HardNotes=((t,h,f,s)=>[
// <monster-hero-v3-hard-notes>
  t(2718,5,4,0),f(2805,6,4),t(3931,3,4,0),t(4018,6,4,0),
  t(4537,3,4,0),t(5404,1,4,0),h(5577,3,1,6443,0,[[5577,3,1],[5837,2,2],[6183,1,4],[6443,1,5]]),t(6617,0,3,0),
  t(6790,0,4,0),t(6963,1,4,0),h(7483,1,4,8349,1),t(8869,0,4,0),
  t(9215,1,4,0),t(9562,3,4,0),t(10255,5,4,0),t(10601,6,4,0),
  t(10948,5,4,0),t(11468,3,4,0),t(11988,1,4,0),t(12334,3,4,0),
  t(12854,5,4,0),s(13460,14067,[[13460,3,3],[13633,4,3],[13807,4,3],[13980,4,3],[14067,4,3]]),t(14326,5,4,0),t(14413,2,8,0),
  t(15799,5,4,0),t(16492,3,4,0),t(16665,5,4,0),s(17185,17705,[[17185,2,3],[17359,2,3],[17532,1.5,3],[17705,3.5,3]]),
  f(17878,1,4),t(18225,3,3,0),t(18571,6,4,0),t(19264,5,3,0),
  t(19957,3,4,0),t(20304,0,5,0),t(20997,0,5,0),t(21690,0,5,0),
  t(22036,3,4,0),t(23076,2,5,0),t(23423,4,5,0),t(24116,3,4,0),
  t(24289,1,4,0),t(24635,3,4,0),t(25502,4,5,0),t(26195,3,4,0),
  t(26541,0,5,0),t(26888,2,5,0),t(27061,4,5,0),t(28274,3,4,0),
  t(28620,0,3,0),t(28967,2,5,0),t(29313,5,5,0),t(29660,3,4,0),
  t(30353,0,4,0),f(31046,2,5),t(31392,0,5,0),t(31739,5,4,1),
  h(32432,5,5,32778),t(33125,3,4,0),t(33298,5,4,0),t(33471,1,3,0),
  t(33818,3,4,0),t(34511,0,5,0),t(34684,0,4,0),t(35204,1,4,0),
  t(35897,3,4,0),t(36590,5,3,0),t(36937,2,5,0),t(37283,1,4,0),
  t(37456,0,4,0),t(38149,3,4,0),h(38323,7,3,38842),t(39016,2,5,0),
  t(39362,0,4,0),t(40055,3,4,0),t(40575,6,4,0),t(40922,1,4,0),
  t(41268,2,5,0),t(41788,4,5,0),s(42134,43520,[[42134,0,3],[42394,1.5,3],[42654,2.5,3],[42914,3,3],[43174,4,3],[43434,4,3],[43520,3.5,3]]),f(43867,4,5),
  t(44560,5,3,0),t(44906,6,4,0),h(45253,5,5,45946,0,[[45253,5,5],[45599,6,3],[45946,7,1]]),t(46119,0,4,0),
  t(46119,7,3,0),t(46466,6,4,0),t(46466,0,3,0),t(47159,1,3,0),
  t(47505,0,5,0),t(47679,1,4,0),t(47852,0,4,0),t(48025,0,5,0),
  t(48372,3,4,0),t(48545,1,4,0),t(48718,3,3,0),h(49065,6,4,50104,1),
  t(50451,0,4,0),t(50797,0,5,0),t(51144,3,4,0),t(51317,5,4,0),
  t(51490,7,3,0),t(51837,5,4,0),t(52530,3,4,0),t(52703,2,8,0),
  t(52876,7,3,0),t(53223,6,4,0),f(53569,4,5),t(53916,2,5,0),
  t(54089,0,5,0),s(54609,55302,[[54609,1,3],[54782,1,3],[54955,0,3],[55129,0,3],[55302,0,3]]),t(55475,0,4,0),t(55648,3,3,0),
  t(55822,1,4,0),t(55995,5,4,0),t(56341,3,4,0),t(56688,5,5,0),
  t(56861,6,4,0),t(57034,2,5,0),t(57208,5,4,0),t(57554,1,4,0),
  t(57728,3,4,0),t(57901,0,4,0),t(58247,6,4,0),t(58421,3,4,0),
  t(58594,0,4,0),t(58767,1,3,0),t(59114,5,3,0),t(59287,1,3,0),
  s(59460,59980,[[59460,3,3],[59633,3.5,3],[59807,3.5,3],[59980,2,3]]),t(60153,1,4,0),t(60326,5,3,0),f(60500,3,3),
  s(60846,61366,[[60846,3,3],[61019,4,3],[61193,4,3],[61366,4,3]]),t(61539,2,5,0),t(61886,5,3,2),t(62232,6,4,0),
  t(62405,3,4,0),t(62752,5,4,0),t(62925,3,4,0),t(63445,4,5,0),
  t(63618,6,4,0),t(63792,5,4,0),t(64311,0,5,0),t(64658,2,5,0),
  t(65004,1,4,0),t(65178,4,5,0),t(65351,2,5,0),t(65697,6,4,0),
  t(65871,3,4,0),t(66217,6,4,0),h(66737,3,4,67343),t(67430,7,3,0),
  t(67603,3,4,0),t(67776,5,5,0),t(68296,5,4,0),t(68469,5,5,0),
  h(68989,7,1,69769,0,[[68989,7,1],[69422,5,5],[69769,7,1]]),f(69856,6,4),t(70375,3,4,0),t(70549,5,4,0),
  t(70722,1,4,0),t(70895,3,3,0),t(71242,0,4,0),t(71242,7,3,0),
  t(71415,2,4,0),t(71588,0,3,0),t(71761,3,4,0),t(71935,0,4,0),
  t(72108,3,4,0),t(72628,0,4,0),t(72974,1,3,0),t(73321,3,4,0),
  t(73494,1,4,0),t(73667,0,3,0),t(73840,1,4,0),t(74360,3,3,0),
  t(74534,6,4,0),t(74707,2,8,0),t(75227,3,3,0),t(75400,1,4,0),
  t(75920,0,4,0),t(76093,1,4,0),t(76439,0,5,0),f(76613,0,5),
  t(76959,0,4,0),t(77132,1,3,0),t(77479,3,4,0),t(77652,1,4,0),
  t(77825,0,5,0),t(78172,0,4,0),t(78518,0,5,0),t(78692,1,4,0),
  s(78865,79471,[[78865,2,3],[79038,3,3],[79211,3,3],[79385,3,3],[79471,4,3]]),t(79731,2,5,0),t(80251,0,4,0),t(80944,2,5,0),
  t(81291,7,3,0),t(81464,3,4,0),t(81637,0,5,0),t(81810,0,5,0),
  t(82157,3,4,0),t(82330,5,4,0),t(82503,6,4,0),t(82503,0,3,0),
  t(82850,4,5,0),t(83196,3,4,0),s(83370,84149,[[83370,1,3],[83543,1,3],[83716,0.5,3],[83889,0.5,3],[84063,0,3],[84149,0,3]]),t(84236,2,5,0),
  f(84409,1,4),h(84929,0,4,85622,1),t(85969,3,4,0),t(86142,1,3,0),
  t(86488,3,4,0),t(86835,1,4,0),h(87008,0,5,87788),t(87874,1,4,0),
  t(88221,3,4,0),t(88567,1,4,0),t(88914,0,4,0),t(89087,0,5,0),
  t(89260,2,5,0),t(89607,5,4,0),t(89780,4,5,0),h(89953,4,5,90820),
  t(90993,0,4,0),t(91339,3,4,0),t(91513,6,4,0),t(91686,2,5,0),
  t(92033,0,5,3),t(92379,2,5,0),t(92726,4,5,0),s(93072,94458,[[93072,3,3],[93332,2.5,3],[93592,1.5,3],[93852,1.5,3],[94112,1.5,3],[94372,1,3],[94458,1,3]]),
  t(94631,6,4,0),f(94805,5,4),t(95151,2,8,0),h(95498,5,5,96537,1,[[95498,5,5],[95844,6,2],[96191,6,2],[96537,5,5]]),
  t(96884,1,4,0),t(97230,3,4,0),t(97577,5,4,0),t(97923,7,3,0),
  t(98270,5,3,0),t(98443,1,3,0),t(98443,7,3,0),t(98616,2,5,0),
  t(98790,0,4,0),t(99136,3,4,0),t(99309,6,4,0),t(99829,3,4,0),
  t(100002,0,5,0),t(100176,1,4,0),t(100349,5,4,0),t(101215,0,5,0),
  t(101562,3,4,0),t(101908,7,3,0),t(102081,3,4,0),t(102601,0,4,0),
  t(102948,3,3,0),t(103121,6,4,0),t(103468,5,4,0),t(103641,3,4,0),
  s(103814,104854,[[103814,3,3],[103987,3,3],[104161,4,3],[104334,4,3],[104507,4,3],[104680,4,3],[104854,4,3]],1),f(105200,5,4),t(105547,6,4,0),t(105720,5,4,0),
  t(105893,6,4,0),t(106240,5,4,0),t(106413,3,4,0),t(106586,1,4,0),
  t(106759,0,4,0),t(107019,0,3,0),t(107106,1,4,0),t(107972,0,5,0),
  t(108492,0,4,0),t(108665,1,3,0),t(109098,0,5,0),t(109358,1,3,0),
  t(109445,5,4,0),t(110051,3,4,0),t(110138,6,4,0),t(110398,3,3,0),
  h(110571,7,3,111264),t(111437,0,4,0),t(111437,7,3,0),t(111611,3,3,0),
  t(112130,5,4,0),t(112304,6,4,0),t(112477,4,5,0),t(112650,3,4,0),
  f(112823,1,4),t(113170,0,3,0),t(113516,0,5,0),t(113690,3,4,0),
  t(114210,1,4,0),t(114383,1,4,0),t(114729,0,3,0),t(114903,1,4,0),
  t(115076,0,4,0),t(115249,2,5,0),t(115422,1,4,0),t(115596,0,4,0),
  t(115942,1,3,0),t(116289,0,5,0),t(116462,1,4,0),t(116808,1,8,0),
  t(116982,5,4,0),t(117155,0,5,0),t(117328,5,3,0),t(117501,3,4,0),
  t(117848,3,4,0),t(118194,4,5,0),f(118368,5,5),t(118714,5,3,0),
  t(118887,5,4,0),t(119061,5,4,0),t(119234,6,4,0),t(119407,7,3,0),
  t(119580,5,4,0),t(119754,3,4,0),t(119840,1,4,0),t(120100,1,4,0),
  t(120187,0,3,0),t(120360,2,3,0),t(120447,0,4,0),t(120620,0,5,0),
  t(120793,0,3,0),t(120967,1,3,0),t(121140,2,5,0),t(121486,5,3,4),
  t(121833,6,4,0),t(122006,5,4,0),t(122179,7,3,0),t(122526,5,4,0),
  t(122612,3,4,0),t(123219,5,4,0),h(123392,0,5,124085),t(124258,0,5,0),
  t(124432,1,4,0),t(124605,0,4,0),f(124778,0,4),t(125125,0,4,0),
  t(125298,1,4,0),t(125385,0,4,0),t(125645,1,3,0),t(125818,0,5,0),
  t(125991,1,4,0),t(126164,3,4,0),t(126338,4,5,0),t(126511,6,4,0),
  t(126684,5,5,0),t(127031,2,8,0),h(127204,6,4,128417),t(128590,5,4,0),
  t(128763,6,4,0),t(128936,5,4,0),t(129283,3,4,0),t(129456,5,4,0),
  t(129629,6,4,0),t(129803,5,4,0),t(129976,0,4,0),t(129976,7,3,0),
  t(130149,1,4,0),t(130322,0,4,0),t(130496,1,4,0),t(130669,3,4,0),
  t(130842,5,4,0),t(131015,6,4,0),t(131189,6,4,0),h(131362,6,4,132315),
  t(132402,1,4,0),t(132575,3,4,0),f(132748,5,4),t(133095,6,4,0),
  t(133268,5,3,0),t(133441,3,4,0),t(133614,1,4,0),t(133961,3,3,0),
  t(134134,5,4,0),h(134307,5,5,135693),t(135867,5,4,0),t(136040,5,4,0),
  t(136213,6,4,0),t(136386,6,4,0),t(136473,5,4,0),t(137080,7,3,0),
  t(137253,5,4,0),h(137339,5,1,138206,0,[[137339,5,1],[137599,4,2],[137946,3,4],[138206,3,5]]),t(138466,0,4,0),f(138639,1,4),
  t(139159,3,4,0),t(139332,1,4,0),t(139505,0,3,0),t(139678,3,4,0),
  t(139852,1,4,0),t(140025,0,4,0),t(140198,1,3,0),t(140371,0,4,0),
  t(140545,3,4,0),t(140718,0,4,0),t(140718,7,3,0),t(141064,5,4,0),
  t(141238,5,4,0),t(141411,8,1,0),t(141757,5,4,0),t(141931,6,4,0),
  t(142017,3,4,0),t(142277,4,5,0),t(142450,6,4,0),t(142624,5,4,0),
  t(142797,1,4,0),t(143144,3,4,0),t(143230,5,4,0),t(143837,6,4,0),
  t(144010,5,4,0),t(144096,6,4,0),t(144356,5,3,0),t(144530,6,4,0),
  f(144703,5,5),t(145049,5,3,0),t(145396,6,4,0),t(145569,5,4,0),
  t(145742,3,3,0),t(145916,0,4,0),t(146089,0,5,0),t(146609,3,4,0),
  t(146782,0,5,0),t(147128,0,4,0),t(147302,1,4,0),t(147475,0,5,0),
  t(147821,1,4,0),t(147995,5,4,0),t(148168,2,5,0),t(148861,1,4,0),
  t(149034,0,4,0),t(149034,7,3,0),t(149208,0,5,0),t(149381,3,3,0),
  t(149467,5,4,0),t(149727,6,4,0),t(149727,0,3,0),t(149901,1,8,0),
  t(150247,6,4,0),f(151547,6,4),
// </monster-hero-v3-hard-notes>
])(mhTap,mhHoldV2,mhFlick,mhSlideV2);
const monsterHeroV3ExpertNotes=((t,h,f,s)=>[
// <monster-hero-v3-expert-notes>
  t(2718,1,4,0),t(2805,3,4,0),f(2891,1,3),t(3931,0,4,0),
  t(4018,3,4,0),t(4537,1,4,0),t(4884,5,4,0),t(5404,3,4,0),
  h(5577,8,1,6443,0,[[5577,8,1],[5837,7,2],[6183,6,4],[6443,5,5]]),t(6617,0,2,0),t(6617,5,2,0),t(6790,2,2,0),
  t(6790,6,2,0),t(6963,4,2,0),t(6963,8,2,0),h(7483,5,4,8349,1),
  t(8003,6,4,0),t(8869,3,4,0),t(9215,5,4,0),t(9562,3,4,0),
  t(10255,5,4,0),t(10601,6,4,0),t(11468,3,4,0),t(11814,5,4,0),
  t(11988,3,4,0),t(12334,1,4,0),t(12854,3,4,0),s(13460,14067,[[13460,0.5,3],[13720,2,3],[13980,3.5,3],[14067,3.5,3]]),
  t(14326,3,4,0),t(14413,2,8,0),t(15799,3,4,0),t(16492,1,4,0),
  f(16665,3,4),s(17185,17705,[[17185,1.5,3],[17359,1,3],[17532,0.5,3],[17705,3,3]]),t(17878,1,2,0),t(17878,5,2,0),
  t(18225,3,2,0),t(18225,7,2,0),t(18571,1,2,0),t(18571,5,2,0),
  t(19264,5,3,0),t(19957,3,4,0),t(20304,0,5,0),t(20997,0,5,0),
  t(21690,0,5,0),t(22036,3,4,0),t(23076,2,5,0),t(23423,4,5,0),
  t(24116,0,2,0),t(24116,4,2,0),t(24289,2,2,0),t(24289,6,2,0),
  t(24462,4,2,0),t(24462,8,2,0),t(24635,5,4,0),t(25502,5,5,0),
  t(26195,5,4,0),t(26541,5,5,0),t(26888,4,5,0),t(27061,2,5,0),
  t(27927,0,3,0),f(28274,3,4),t(28620,1,2,0),t(28620,5,2,0),
  t(28967,3,2,0),t(28967,7,2,0),t(29313,1,2,0),t(29313,5,2,0),
  t(29660,3,4,0),t(30353,3,4,0),t(30699,4,5,0),t(31046,5,5,0),
  t(31392,4,5,0),t(31739,6,4,1),h(32432,4,5,32778,1),t(33125,6,4,0),
  t(33298,5,4,0),t(33471,3,3,0),t(33818,5,4,0),t(34511,2,5,0),
  t(34684,5,4,0),t(35204,3,4,0),t(35897,5,4,0),t(36590,7,3,0),
  t(36937,4,5,0),t(37283,3,4,0),t(37456,5,4,0),t(37803,3,4,0),
  t(38149,5,4,0),h(38323,5,5,38842,0,[[38323,5,5],[38583,7,3],[38842,8,1]]),f(39016,4,5),t(39362,3,4,0),
  t(40055,5,4,0),t(40575,6,4,0),t(40922,0,4,0),t(41268,0,5,0),
  t(41615,3,4,0),t(41788,4,5,0),s(42134,43520,[[42134,3,3],[42394,4,3],[42654,4,3],[42914,4,3],[43174,4,3],[43434,4,3],[43520,4,3]],1),t(42827,5,4,0),
  t(43001,2,5,0),t(43174,5,3,0),t(43867,2,5,0),t(44560,5,3,0),
  t(44906,6,4,0),h(45253,4,5,45946),t(46119,0,4,0),t(46119,7,3,0),
  t(46466,6,4,0),t(46466,0,3,0),t(47159,1,3,0),t(47505,0,5,0),
  t(47679,1,4,0),t(47852,3,4,0),t(48025,0,5,0),t(48198,3,3,0),
  t(48372,5,4,0),t(48545,6,4,0),f(48718,3,3),h(49065,6,4,50104,1),
  t(49411,5,3,0),t(49758,5,4,0),t(50451,5,4,0),t(50797,5,5,0),
  t(51144,6,4,0),t(51317,6,4,0),t(51490,7,3,0),t(51837,6,4,0),
  t(52530,6,4,0),t(52703,2,8,0),t(52876,7,3,0),t(53050,6,4,0),
  t(53223,3,4,0),t(53569,0,5,0),t(53916,0,5,0),t(54089,0,5,0),
  s(54609,55302,[[54609,4,3],[54869,2,3],[55129,0.5,3],[55302,0,3]]),t(54955,1,3,0),t(55475,1,4,0),t(55648,5,3,0),
  t(55822,3,4,0),f(55995,1,4),t(56341,0,4,0),t(56515,0,4,0),
  t(56688,0,5,0),t(56861,0,4,0),t(57034,0,5,0),t(57208,0,4,0),
  t(57208,7,3,0),t(57554,1,4,0),t(57728,0,4,0),t(57901,1,4,0),
  t(58247,6,4,0),t(58421,3,4,0),t(58594,0,4,0),t(58767,0,3,0),
  t(59114,3,3,0),t(59287,1,3,0),s(59460,59980,[[59460,3,3],[59633,3,3],[59807,3,3],[59980,1.5,3]]),t(60153,5,4,0),
  t(60326,5,3,0),t(60500,7,3,0),s(60846,61366,[[60846,3,3],[61019,4,3],[61193,4,3],[61366,4,3]]),t(61539,2,5,2),
  f(61886,5,3),t(62232,6,4,0),t(62405,3,4,0),t(62752,5,4,0),
  t(62925,6,4,0),t(63099,5,4,0),t(63445,0,5,0),t(63618,1,4,0),
  t(63792,0,4,0),t(64138,1,4,0),t(64311,0,5,0),t(64658,2,5,0),
  t(65004,1,4,0),t(65178,4,5,0),t(65351,2,5,0),t(65697,6,4,0),
  t(65871,3,4,0),t(66217,6,4,0),h(66737,7,1,67343,0,[[66737,7,1],[67083,5,5],[67343,7,1]]),t(67430,1,3,0),
  t(67603,5,4,0),t(67776,0,5,0),t(68296,0,4,0),t(68296,7,3,0),
  t(68469,0,5,0),h(68989,0,4,69769),t(69336,2,4,0),f(69422,1,4),
  t(69856,0,4,0),t(70029,1,4,0),t(70375,0,4,0),t(70549,0,4,0),
  t(70722,0,4,0),t(70895,1,3,0),h(71242,1,4,71675),t(71761,3,4,0),
  t(71935,1,4,0),t(72108,3,4,0),t(72628,1,4,0),t(72974,0,3,0),
  t(73321,1,4,0),t(73494,3,4,0),t(73667,1,3,0),t(73840,3,4,0),
  t(74187,1,4,0),t(74360,0,3,0),t(74534,1,4,0),t(74707,2,8,0),
  t(75227,3,3,0),f(75400,1,4),t(75920,0,4,0),t(76093,1,4,0),
  t(76179,3,3,0),t(76439,4,5,0),t(76613,5,5,0),t(76959,1,4,0),
  t(77132,3,3,0),t(77479,5,4,0),t(77652,6,4,0),t(77825,2,5,0),
  t(78172,6,4,0),t(78172,0,3,0),t(78518,2,5,0),t(78692,1,4,0),
  s(78865,79471,[[78865,0,3],[79125,2,3],[79385,4,3],[79471,4,3]]),t(79731,5,5,0),t(80078,4,5,0),t(80251,3,4,0),
  t(80771,1,4,0),h(80944,0,5,81464),t(81637,0,5,0),t(81810,0,5,0),
  t(82157,1,4,0),t(82330,3,4,0),t(82503,5,4,0),f(82850,5,5),
  t(83196,5,4,0),s(83370,84149,[[83370,3,3],[83543,2.5,3],[83716,2,3],[83889,2,3],[84063,0.5,3],[84149,0.5,3]]),t(83716,5,4,0),t(84236,2,5,0),
  t(84409,1,4,0),h(84929,3,5,85622,0,[[84929,3,5],[85275,5,1],[85622,3,5]]),t(85275,8,2,0),t(85795,8,1,0),
  t(85969,6,4,0),t(86142,5,3,0),t(86488,6,4,0),t(86835,5,4,0),
  h(87008,2,5,87788),t(87874,1,4,0),t(88221,3,4,0),t(88567,5,4,0),
  t(88741,6,4,0),t(88914,5,4,0),t(89087,2,5,0),t(89260,4,5,0),
  t(89607,3,4,0),t(89780,0,5,0),h(89953,0,5,90820),f(90300,2,4),
  t(90993,0,4,0),t(90993,7,3,0),t(91339,0,4,0),t(91513,3,4,0),
  t(91686,5,5,0),t(91859,2,5,0),t(92033,0,5,0),t(92379,2,5,3),
  t(92726,5,5,0),s(93072,94458,[[93072,4,3],[93332,3,3],[93592,1.5,3],[93852,1,3],[94112,1,3],[94372,0.5,3],[94458,0,3]]),t(93419,0,4,0),t(93765,3,4,0),
  t(94112,6,4,0),t(94631,3,4,0),t(94805,3,4,0),t(95151,0,5,0),
  h(95498,0,4,96537,1),t(95844,1,4,0),t(96191,3,4,0),t(96884,0,4,0),
  t(97057,3,4,0),t(97230,6,4,0),t(97577,3,4,0),f(97923,0,3),
  t(98270,3,3,0),t(98443,3,3,0),t(98616,0,8,0),t(98790,3,4,0),
  t(99136,6,4,0),t(99309,3,4,0),t(99829,0,4,0),t(100002,0,5,0),
  t(100176,3,4,0),t(100349,1,4,0),t(101215,2,5,0),t(101562,5,4,0),
  t(101908,7,3,0),t(102081,5,4,0),t(102428,1,3,0),t(102601,5,4,0),
  t(102948,3,3,0),t(103121,5,4,0),t(103468,1,4,0),t(103641,3,4,0),
  s(103814,104854,[[103814,1.5,3],[103987,1,3],[104161,2.5,3],[104334,2.5,3],[104507,3,3],[104680,3.5,3],[104854,3.5,3]],1),t(104161,1,4,0),t(104507,3,4,0),t(105200,5,4,0),
  t(105373,6,4,0),t(105547,5,4,0),t(105720,3,4,0),f(105893,1,4),
  t(106240,0,4,0),t(106413,0,4,0),t(106586,1,4,0),t(106759,0,4,0),
  t(107019,2,3,0),t(107106,0,4,0),t(107193,1,4,0),t(107972,0,5,0),
  t(108405,3,4,0),t(108492,1,4,0),t(108665,5,3,0),t(109098,2,5,0),
  t(109358,5,3,0),t(109445,0,4,0),s(109532,110138,[[109532,1.5,3],[109705,0,3],[109878,0,3],[110051,0.5,3],[110138,1,3]]),t(110225,0,4,0),
  t(110398,3,3,0),h(110571,0,3,111264),t(110918,3,4,0),t(111437,0,4,0),
  t(111611,3,3,0),f(111784,1,3),t(112130,0,4,0),t(112304,0,4,0),
  t(112304,7,3,0),t(112477,2,5,0),t(112650,1,4,0),t(112823,0,4,0),
  t(113170,3,3,0),t(113516,4,5,0),t(113690,6,4,0),t(114036,5,3,0),
  t(114210,1,4,0),t(114383,3,4,0),t(114729,5,3,0),t(114903,6,4,0),
  t(115076,6,4,0),t(115249,4,5,0),t(115422,3,4,0),t(115596,5,4,0),
  t(115942,3,3,4),t(116289,4,5,0),t(116462,3,4,0),t(116808,4,5,0),
  t(116982,6,4,0),t(117155,5,5,0),t(117328,5,3,0),f(117501,3,4),
  t(117848,0,4,0),t(118194,0,5,0),t(118281,3,4,0),t(118368,0,8,0),
  t(118454,0,4,0),t(118714,0,3,0),t(118887,0,4,0),t(119061,0,4,0),
  t(119234,0,4,0),t(119407,0,3,0),t(119580,1,4,0),t(119754,1,4,0),
  t(119840,0,4,0),t(119927,1,4,0),t(120100,3,4,0),t(120187,5,3,0),
  t(120360,7,3,0),t(120447,5,4,0),t(120620,5,5,0),t(120793,5,3,0),
  t(120967,5,3,0),f(121140,5,5),t(121486,5,3,0),t(121660,7,3,0),
  t(121833,5,4,0),t(122006,3,4,0),t(122179,1,3,0),t(122526,0,4,0),
  t(122699,1,3,0),t(123219,5,4,0),h(123392,7,1,124085,0,[[123392,7,1],[123739,6,3],[124085,5,5]]),t(124258,4,5,0),
  t(124432,6,4,0),t(124605,5,4,0),t(124692,6,4,0),t(124778,5,4,0),
  t(125125,6,4,0),t(125211,5,4,0),t(125298,3,4,0),t(125385,5,4,0),
  t(125471,3,4,0),t(125645,1,3,0),t(125818,0,5,0),t(125991,0,4,0),
  t(126164,0,4,0),t(126338,0,5,0),t(126511,1,4,0),f(126684,0,5),
  t(127031,0,5,0),h(127204,0,4,128417),t(127550,2,4,0),t(127637,1,4,0),
  t(127724,3,3,0),t(127897,1,4,0),t(127983,2,4,0),t(128070,1,4,0),
  t(128590,6,4,0),t(128590,0,3,0),t(128763,1,4,0),t(128936,5,4,0),
  t(129283,5,4,0),t(129370,2,8,0),t(129456,5,4,0),t(129629,6,4,0),
  t(129803,3,4,0),t(129976,5,4,0),t(130149,6,4,0),t(130322,5,4,0),
  t(130496,3,4,0),t(130669,5,4,0),t(130842,6,4,0),t(131015,6,4,0),
  t(131102,5,4,0),t(131189,6,4,0),h(131362,5,4,132315),t(131709,3,4,0),
  t(131795,4,4,0),f(131882,3,4),t(132402,1,4,0),t(132575,0,4,0),
  t(132748,1,4,0),t(132835,0,4,0),t(133095,1,4,0),t(133268,0,3,0),
  t(133441,1,4,0),t(133614,3,4,0),t(133961,5,3,0),t(134134,6,4,0),
  t(134134,0,3,0),h(134307,5,5,135693),t(134654,7,3,0),t(134827,4,4,0),
  t(135000,4,4,0),t(135087,3,4,0),t(135174,5,3,0),f(135347,4,4),
  t(135867,5,4,0),t(136040,5,4,0),t(136213,6,4,0),t(136386,6,4,0),
  t(136473,3,4,0),t(137080,5,3,0),t(137253,3,4,0),t(137339,1,4,0),
  h(137426,4,5,138206,0,[[137426,4,5],[137859,5,3],[138206,6,1]]),t(137773,1,4,0),t(137859,2,4,0),t(138466,0,4,0),
  t(138639,0,4,0),t(138725,3,4,0),t(139159,6,4,0),t(139332,3,4,0),
  t(139505,0,3,0),t(139678,3,4,0),t(139852,1,4,0),t(140025,0,4,0),
  t(140198,1,3,0),t(140371,1,4,0),t(140545,0,4,0),t(140631,1,4,0),
  f(140718,0,4),t(141064,1,4,0),t(141238,5,4,0),t(141411,4,1,0),
  t(141757,6,4,0),t(141931,5,4,0),t(142017,6,4,0),t(142104,5,4,0),
  t(142277,5,5,0),t(142450,6,4,0),t(142450,0,3,0),t(142624,6,4,0),
  t(142797,5,4,0),t(142884,6,4,0),t(143144,5,4,0),t(143230,2,4,0),
  t(143317,1,4,0),t(143837,0,4,0),t(144010,1,4,0),t(144096,0,4,0),
  t(144183,1,4,0),t(144270,0,4,0),t(144356,3,3,0),t(144530,1,4,0),
  t(144703,0,5,0),t(144876,1,4,0),f(145049,5,3),t(145396,1,4,0),
  t(145569,3,4,0),t(145742,0,3,0),t(145916,1,4,0),t(146089,2,5,0),
  t(146609,5,4,0),t(146782,5,5,0),t(147128,3,4,0),t(147302,5,4,0),
  t(147475,5,5,0),t(147648,5,4,0),t(147821,1,4,0),t(147995,5,4,0),
  t(148168,2,5,0),t(148861,6,4,0),t(149034,6,4,0),t(149034,0,3,0),
  t(149208,4,5,0),t(149381,7,3,0),t(149467,5,4,0),t(149554,2,5,0),
  t(149727,6,4,0),t(149727,0,3,0),t(149901,2,5,0),t(150074,0,8,0),
  t(150247,3,4,0),f(151547,1,4),
// </monster-hero-v3-expert-notes>
])(mhTap,mhHoldV2,mhFlick,mhSlideV2);
const monsterHeroV3MasterNotes=((t,h,f,s)=>[
// <monster-hero-v3-master-notes>
  t(2718,5,3,0),t(2805,7,3,0),f(2891,6,2),t(3931,1,3,0),
  t(4018,5,3,0),t(4537,3,3,0),t(4884,7,3,0),t(5404,3,3,0),
  h(5577,8,1,6443,0,[[5577,8,1],[5837,8,2],[6183,7,3],[6443,6,4]]),t(6617,4,2,0),t(6790,5,3,0),t(6876,3,3,0),
  t(6963,2,3,0),h(7483,0,3,8349,1),t(8003,5,3,0),t(8869,3,3,0),
  t(9042,5,3,0),t(9215,3,3,0),t(9562,5,3,0),t(10255,2,2,0),
  t(10255,6,2,0),t(10601,1,2,0),t(10601,7,2,0),t(10948,0,2,0),
  t(10948,8,2,0),t(11468,3,3,0),t(11814,5,3,0),t(11988,7,3,0),
  t(12334,5,3,0),f(12854,3,3),s(13460,14067,[[13460,0,2],[13720,2.5,2],[13980,4,2],[14067,4,2]]),t(14326,0,3,0),
  t(14413,2,6,0),t(15626,8,2,0),t(15799,5,3,0),t(16492,3,3,0),
  t(16665,1,3,0),s(17185,17705,[[17185,1.5,2],[17359,1,2],[17532,0.5,2],[17705,3,2]]),t(17878,1,3,0),t(18225,2,2,0),
  t(18571,0,3,0),t(19264,2,2,0),h(19438,0,3,20044),t(20304,0,4,0),
  t(20997,0,2,0),t(20997,4,2,0),t(21343,4,2,0),t(21343,8,2,0),
  t(21690,0,2,0),t(21690,4,2,0),t(22036,4,2,0),t(22036,8,2,0),
  t(23076,3,4,0),t(23423,5,4,0),t(24116,3,3,0),t(24289,1,3,0),
  t(24462,4,2,0),f(24635,5,3),t(24982,2,2,0),t(25502,3,4,0),
  t(26195,5,3,0),t(26541,6,4,0),t(26888,5,4,0),t(27061,3,4,0),
  t(27581,0,2,0),t(27581,4,2,0),t(27927,1,2,0),t(27927,5,2,0),
  t(28274,3,2,0),t(28274,7,2,0),t(28620,4,2,0),t(28620,8,2,0),
  t(28967,0,4,0),t(29313,3,4,0),t(29660,0,3,0),t(30006,4,2,0),
  t(30353,2,2,0),t(30353,6,2,0),t(30699,2,2,0),t(30699,7,2,0),
  t(31046,1,2,0),t(31046,8,2,0),t(31392,0,2,0),t(31392,8,2,0),
  t(31739,3,3,0),h(32085,0,2,32778,1),t(32432,3,4,1),t(33125,7,3,0),
  t(33298,3,3,0),f(33471,1,2),t(33818,7,3,0),t(34511,3,4,0),
  t(34684,5,3,0),t(35204,1,3,0),t(35724,3,3,0),t(35897,0,3,0),
  t(36590,2,2,0),t(36937,5,4,0),t(37110,3,3,0),t(37283,3,3,0),
  t(37456,7,3,0),t(38149,3,3,0),h(38323,0,4,38842,0,[[38323,0,4],[38583,0,3],[38842,1,1]]),t(39016,3,4,0),
  t(39189,6,4,0),t(39362,5,3,0),t(40055,3,3,0),t(40229,1,3,0),
  t(40575,0,3,0),t(40922,0,3,0),f(41268,1,4),t(41615,3,3,0),
  t(41788,5,4,0),s(42134,43520,[[42134,3,2],[42394,4,2],[42654,4,2],[42914,4,2],[43174,4,2],[43434,4,2],[43520,4,2]],1),t(42827,5,3,0),t(43001,2,4,0),
  t(43174,4,2,0),t(43867,0,2,0),t(43867,4,2,0),t(44213,4,2,0),
  t(44213,8,2,0),t(44560,0,2,0),t(44560,4,2,0),t(44906,4,2,0),
  t(44906,8,2,0),h(45253,1,4,45946),t(46119,0,3,0),t(46119,5,3,0),
  t(46466,1,3,0),t(46466,6,3,0),t(47159,4,2,0),t(47159,8,2,0),
  t(47505,5,4,0),t(47679,7,3,0),t(47765,5,3,0),t(47852,7,3,0),
  t(48025,4,6,0),t(48198,8,2,0),t(48372,5,3,0),t(48545,7,3,0),
  t(48631,5,3,0),f(48718,8,2),h(49065,5,3,50104,1),t(49411,4,2,0),
  t(49758,8,2,0),t(50451,3,3,0),t(50624,0,3,0),t(50797,0,4,0),
  t(51144,1,3,0),t(51317,1,3,0),t(51490,0,2,0),t(51837,1,3,0),
  t(52530,0,2,0),t(52530,4,2,0),t(52703,1,2,0),t(52703,5,2,0),
  t(52876,3,2,0),t(52876,7,2,0),t(53050,4,2,0),t(53050,8,2,0),
  t(53223,3,3,0),t(53569,1,4,0),t(53743,0,3,0),t(53916,1,4,0),
  t(54089,0,4,0),s(54609,55302,[[54609,1.5,2],[54782,1.5,2],[54955,0,2],[55129,0,2],[55302,0,2]]),f(54955,4,2),t(55475,5,3,0),
  t(55648,8,2,0),t(55822,5,3,0),t(55995,3,3,0),t(56168,2,2,0),
  t(56341,1,3,0),t(56515,0,3,0),t(56688,1,4,0),t(56861,0,3,0),
  t(57034,1,4,0),t(57208,0,3,0),t(57554,1,3,0),t(57728,0,3,0),
  t(57901,1,3,0),t(57987,5,3,0),t(58247,3,3,0),t(58421,7,3,0),
  t(58594,5,3,0),t(58767,8,2,0),t(59114,6,2,0),t(59200,3,3,0),
  t(59287,2,2,0),s(59460,59980,[[59460,2,2],[59633,2.5,2],[59807,2.5,2],[59980,1,2]]),t(60153,1,3,0),t(60326,0,2,0),
  t(60326,4,2,0),f(60500,2,2),s(60846,61366,[[60846,1.5,2],[61019,2.5,2],[61193,2.5,2],[61366,4,2]]),t(61453,1,3,0),
  t(61539,3,4,0),t(61886,6,2,2),t(62232,7,3,0),t(62405,5,3,0),
  t(62579,8,2,0),t(62752,5,3,0),t(62925,7,3,0),t(63099,5,3,0),
  t(63445,6,4,0),t(63618,5,3,0),t(63792,7,3,0),t(64138,5,3,0),
  t(64311,5,4,0),t(64658,6,4,0),t(65004,7,3,0),t(65178,3,4,0),
  t(65351,6,4,0),t(65697,3,3,0),f(65871,7,3),t(66217,1,3,0),
  t(66564,2,3,0),t(66564,7,3,0),h(66737,6,1,67343,0,[[66737,6,1],[67083,5,4],[67343,6,1]]),t(67430,8,2,0),
  t(67603,5,3,0),t(67776,2,6,0),t(68296,1,3,0),t(68469,1,4,0),
  t(68556,0,3,0),h(68989,1,3,69769),t(69336,0,3,0),t(69422,2,3,0),
  t(69856,3,3,0),t(69942,4,3,0),t(70029,3,3,0),t(70375,1,3,0),
  t(70549,0,3,0),t(70722,0,3,0),t(70895,2,2,0),h(71068,1,3,71675),
  t(71761,0,3,0),t(71935,0,3,0),f(72108,0,3),t(72628,0,3,0),
  t(72974,2,2,0),t(73147,1,3,0),t(73321,0,3,0),t(73494,0,3,0),
  t(73667,0,2,0),t(73840,1,3,0),t(74187,0,3,0),t(74360,2,2,0),
  t(74534,0,3,0),t(74707,1,4,0),t(75227,4,2,0),t(75400,5,3,0),
  t(75400,0,3,0),t(75920,7,3,0),t(76093,5,3,0),t(76179,4,2,0),
  t(76439,1,4,0),t(76613,0,4,0),t(76959,1,3,0),t(77132,0,2,0),
  t(77306,1,3,0),t(77479,3,3,0),t(77652,7,3,0),f(77825,5,4),
  t(78172,5,3,0),t(78345,7,3,0),t(78518,6,4,0),t(78692,5,3,0),
  s(78865,79471,[[78865,3,2],[79038,3.5,2],[79211,4,2],[79385,4,2],[79471,4,2]]),t(79731,6,4,0),t(80078,5,4,0),t(80251,3,3,0),
  t(80771,1,3,0),t(80857,0,3,0),h(80944,1,4,81464,0,[[80944,1,4],[81204,3,1],[81464,1,4]]),t(81637,0,4,0),
  t(81637,6,3,0),t(81810,1,4,0),t(82157,3,3,0),t(82330,1,3,0),
  t(82503,3,3,0),t(82677,2,1,0),t(82850,1,4,0),t(83196,0,3,0),
  t(83370,1,4,0),s(83543,84149,[[83543,1.5,2],[83716,0.5,2],[83889,0.5,2],[84063,0,2],[84149,0,2]]),t(84236,5,4,0),t(84409,3,3,0),
  f(84582,1,4),h(84929,0,3,85622),t(85275,1,3,0),t(85795,6,1,0),
  t(85969,7,3,0),t(86142,8,2,0),t(86488,5,3,0),t(86835,5,3,0),
  h(87008,6,4,87788),t(87355,5,3,0),t(87874,7,3,0),t(88221,7,3,0),
  t(88567,3,3,0),t(88741,5,3,0),t(88914,7,3,0),t(88914,2,3,0),
  t(89087,4,6,0),t(89260,3,4,0),t(89607,5,3,0),t(89780,3,4,0),
  h(89953,1,4,90820),f(90300,0,3),t(90993,0,3,0),t(91166,2,2,0),
  t(91166,6,2,0),t(91339,1,3,0),t(91513,5,3,0),t(91686,3,4,0),
  t(91859,1,4,0),t(92033,0,4,0),t(92379,3,4,3),t(92726,1,4,0),
  t(92812,0,3,0),s(93072,94458,[[93072,1.5,2],[93332,1,2],[93592,0,2],[93852,0,2],[94112,0,2],[94372,0,2],[94458,0,2]]),t(93419,3,3,0),t(93765,1,3,0),
  t(94112,3,3,0),t(94631,5,3,0),t(94805,7,3,0),t(94978,5,3,0),
  t(95151,6,4,0),h(95498,5,3,96537,1),t(95844,8,2,0),t(96191,7,3,0),
  t(96884,7,3,0),t(96884,2,3,0),t(97057,5,3,0),t(97230,3,3,0),
  t(97404,5,3,0),f(97577,3,3),t(97923,2,2,0),t(98270,4,2,0),
  t(98443,6,2,0),t(98616,6,4,0),t(98790,7,3,0),t(98876,5,3,0),
  t(99136,5,3,0),t(99309,3,3,0),t(99829,5,3,0),t(100002,6,4,0),
  t(100176,5,3,0),t(100349,3,3,0),t(100436,7,3,0),t(101215,1,4,0),
  t(101562,3,3,0),t(101908,6,2,0),t(102081,7,3,0),t(102255,8,2,0),
  t(102428,8,2,0),f(102601,7,3),t(102948,8,2,0),t(103121,5,3,0),
  t(103468,7,3,0),t(103554,5,3,0),t(103641,4,3,0),s(103814,104854,[[103814,2,2],[103987,2,2],[104161,3,2],[104334,3,2],[104507,3.5,2],[104680,4,2],[104854,4,2]],1),
  t(104161,4,3,0),t(104507,1,3,0),t(105200,7,3,0),t(105373,5,3,0),
  t(105547,7,3,0),t(105720,5,3,0),t(105893,7,3,0),t(106240,5,3,0),
  t(106326,7,3,0),t(106413,5,3,0),t(106586,7,3,0),t(106759,3,3,0),
  t(107019,6,2,0),t(107106,3,3,0),t(107193,2,3,0),t(107972,2,6,4),
  t(108405,1,3,0),t(108492,0,3,0),f(108665,2,2),t(109098,1,4,0),
  t(109272,0,1,0),t(109358,2,2,0),t(109445,0,3,0),s(109532,110138,[[109532,1.5,2],[109705,0,2],[109878,0,2],[110051,0.5,2],[110138,1,2]]),
  t(110225,3,3,0),t(110398,6,2,0),h(110571,8,2,111264),t(110918,3,3,0),
  t(111437,7,3,0),t(111611,6,2,0),t(111784,4,2,0),t(112130,1,3,0),
  t(112304,3,3,0),t(112477,1,4,0),t(112650,3,3,0),t(112823,0,3,0),
  t(113170,2,2,0),t(113343,0,3,0),t(113516,1,4,0),f(113690,0,3),
  t(114036,2,2,0),t(114210,0,3,0),t(114296,1,3,0),t(114383,3,3,0),
  t(114729,6,2,0),t(114903,5,3,0),t(115076,7,3,0),t(115249,6,4,0),
  t(115422,3,3,0),t(115596,5,3,0),t(115942,8,2,0),t(116115,6,2,0),
  t(116289,3,4,0),t(116462,5,3,0),t(116635,4,2,0),t(116808,5,4,0),
  t(116982,7,3,0),t(117155,5,4,0),t(117328,4,2,0),t(117501,1,3,0),
  f(117848,0,3),t(118194,1,4,0),t(118281,3,3,0),h(118368,5,4,118887),
  t(119061,7,3,0),t(119061,2,3,0),t(119234,7,3,0),t(119407,8,2,0),
  t(119580,7,3,0),t(119754,7,3,0),t(119840,5,3,0),t(119927,7,3,0),
  t(120100,5,3,0),t(120187,2,2,0),t(120360,6,2,0),t(120447,3,3,0),
  t(120533,7,3,0),t(120620,5,4,0),t(120707,7,3,0),t(120793,6,2,0),
  t(120967,8,2,0),t(121053,6,2,0),t(121140,6,4,0),t(121486,6,2,0),
  t(121660,8,2,0),t(121833,5,3,0),t(122006,3,3,0),f(122179,6,2),
  t(122526,3,3,0),t(122612,1,3,0),t(122699,6,2,0),t(123219,3,3,0),
  h(123392,8,1,124085,0,[[123392,8,1],[123739,7,3],[124085,6,4]]),t(124258,2,6,0),t(124432,5,3,0),t(124605,3,3,0),
  t(124692,1,3,0),t(124778,3,3,0),t(125038,2,2,0),t(125125,3,3,0),
  t(125211,5,3,0),t(125298,3,3,0),t(125385,5,3,0),t(125471,3,3,0),
  t(125645,6,2,0),t(125818,1,4,0),t(125818,7,3,0),t(125991,3,3,0),
  t(126078,4,3,0),t(126164,7,3,0),t(126338,3,4,0),t(126511,7,3,0),
  t(126597,3,3,0),f(126684,6,4),t(127031,3,4,0),h(127204,5,3,128417),
  t(127550,2,3,0),t(127637,1,3,0),t(127724,0,2,0),t(127897,1,3,0),
  t(127983,0,3,0),t(128070,1,3,0),t(128590,0,3,0),t(128590,5,3,0),
  t(128763,0,3,0),f(128936,0,3),t(129283,2,3,0),t(129370,0,4,0),
  t(129456,3,3,0),t(129543,0,3,0),t(129629,3,3,0),t(129803,1,3,0),
  t(129976,1,3,0),t(130149,0,3,0),t(130322,0,3,0),t(130496,0,3,0),
  t(130669,1,3,0),t(130669,6,3,0),t(130842,3,3,0),t(131015,1,3,0),
  t(131102,0,3,0),t(131189,1,3,0),h(131362,0,3,132315),t(131709,1,3,0),
  t(131795,2,3,0),t(131882,1,3,0),t(132402,0,3,0),t(132575,0,3,0),
  t(132748,1,3,0),t(132835,0,3,0),t(133095,1,3,0),t(133268,4,2,0),
  t(133441,7,3,0),t(133614,3,3,0),t(133701,7,3,0),t(133874,6,2,0),
  t(133961,8,2,0),t(134134,5,3,0),h(134307,6,4,135693),t(134654,6,2,0),
  t(134827,3,3,0),t(134914,4,3,0),t(135000,3,3,0),t(135087,5,3,0),
  t(135174,4,2,0),f(135347,1,3),t(135867,0,3,0),t(135867,5,3,0),
  t(136040,0,3,0),t(136213,3,3,0),t(136386,0,3,0),t(136473,3,3,0),
  t(136560,5,2,0),t(137080,2,2,0),t(137253,3,3,0),t(137339,0,3,0),
  h(137426,1,4,138206,0,[[137426,1,4],[137859,2,3],[138206,3,1]]),t(137773,0,3,0),t(137859,1,3,0),t(138466,0,3,0),
  t(138466,5,3,0),t(138639,0,3,0),f(138725,1,3),t(139159,0,3,0),
  t(139245,1,3,0),t(139332,2,3,0),t(139505,8,2,0),t(139678,7,3,0),
  t(139852,5,3,0),t(140025,3,3,0),t(140198,6,2,0),t(140371,1,3,0),
  t(140545,0,3,0),t(140631,1,3,0),t(140718,0,3,0),t(141064,3,3,0),
  t(141238,0,3,0),t(141411,4,1,0),t(141498,0,3,0),t(141757,1,3,0),
  t(141931,0,3,0),t(142017,1,3,0),t(142104,0,3,0),t(142277,0,6,0),
  t(142450,3,3,0),t(142537,1,3,0),t(142624,3,3,0),t(142797,1,3,0),
  t(142884,3,3,0),t(143144,5,3,0),t(143230,7,3,0),t(143317,5,3,0),
  f(143403,4,3),t(143837,5,3,0),t(143923,3,3,0),t(144010,5,3,0),
  t(144096,1,3,0),t(144183,5,3,0),t(144270,1,3,0),t(144356,0,2,0),
  t(144530,0,3,0),t(144703,1,4,0),t(144876,1,3,0),t(145049,2,2,0),
  t(145396,0,3,0),t(145569,1,3,0),t(145742,0,2,0),t(145916,0,3,0),
  t(146089,1,4,0),f(146262,0,2),t(146609,1,3,0),t(146782,0,4,0),
  t(146955,2,1,0),t(147128,3,3,0),t(147302,5,3,0),t(147475,5,4,0),
  t(147648,5,3,0),t(147821,7,3,0),t(147995,7,3,0),t(147995,2,3,0),
  t(148168,5,4,0),t(148861,3,3,0),t(148948,1,3,0),t(149034,0,3,0),
  t(149208,2,4,0),t(149294,1,3,0),t(149381,0,2,0),t(149467,1,3,0),
  t(149554,3,4,0),t(149727,5,3,0),t(149727,0,3,0),t(149901,6,4,0),
  t(150074,4,6,0),t(150247,3,3,0),f(151547,5,3),
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
  t(2447,1,4,0),t(2591,3,4,0),t(3171,5,3,0),t(3316,6,4,0),
  h(4476,5,3,5200,0,[[4476,5,3],[4693,5,4],[4983,5,4],[5200,4,6]]),t(5490,3,4,0),t(6505,1,4,0),t(8244,3,4,0),
  t(8679,3,3,0),t(9258,5,4,0),t(9838,5,4,0),t(10273,7,3,0),
  t(11432,0,10,0),t(11867,2,6,0),t(12302,1,4,0),t(13027,0,4,0),
  t(13172,0,4,0),t(14621,1,4,0),t(15201,0,3,0),t(15490,1,4,0),
  t(15635,0,4,0),t(16215,1,3,0),t(16795,3,3,0),h(17809,5,4,18462),
  t(18534,7,3,0),t(19259,5,4,0),t(19838,6,4,0),t(20128,4,6,0),
  t(20563,6,4,0),t(21143,3,4,0),t(21433,5,4,0),t(21867,6,4,0),
  t(22302,5,4,0),t(22737,3,4,0),t(23172,1,4,0),t(23607,2,6,0),
  t(23752,1,4,0),t(24041,0,4,0),t(24476,0,6,0),t(24911,0,3,0),
  t(24911,7,3,0),t(25636,5,4,0),t(25781,6,4,0),t(26360,4,6,0),
  t(26650,4,6,0),t(27085,4,6,0),t(27520,4,6,0),t(28389,5,4,0),
  t(28534,3,4,0),t(28824,0,6,0),t(29259,0,4,0),t(29404,0,6,0),
  t(29694,3,4,0),t(29839,5,3,0),t(30129,4,6,0),t(30274,5,4,0),
  t(30563,2,6,0),t(30998,5,4,0),t(31868,2,6,0),t(32737,1,4,0),
  t(33172,0,4,0),t(33607,1,4,1),h(34042,0,6,34694),t(34911,1,4,0),
  t(35346,3,4,0),t(36651,0,6,0),t(37085,3,4,0),t(37665,5,4,0),
  t(37955,4,6,0),t(38390,4,6,0),t(38825,6,4,0),t(39259,6,4,0),
  t(39694,5,4,0),t(39839,5,4,0),t(40564,3,4,0),t(40854,5,4,0),
  t(40999,3,4,0),t(41433,5,4,0),t(41868,2,6,0),t(42303,5,4,0),
  t(42738,2,6,0),t(43173,5,4,0),t(43607,0,10,0),t(44042,5,4,0),
  t(44477,4,6,0),h(44912,6,4,45854),t(46216,4,6,0),t(46651,2,6,0),
  t(47086,4,6,0),t(47521,3,4,0),t(47955,0,6,0),t(48390,2,6,0),
  t(48825,0,6,0),t(49260,5,4,0),t(49550,2,6,0),t(49695,0,6,0),
  t(50129,0,4,0),t(50999,1,4,0),t(51434,2,6,0),h(51724,5,4,52883),
  t(53173,5,4,0),t(53608,4,6,0),t(53898,5,4,0),h(54043,4,6,55057),
  h(55347,6,4,56506),t(56651,4,6,0),t(57521,2,6,0),t(57811,1,4,0),
  t(57956,3,4,0),t(58391,1,4,0),h(59260,0,6,59912,0,[[59260,0,6],[59622,1,4],[59912,2,3]]),t(60130,0,6,0),
  t(60564,2,6,0),t(60999,0,6,0),t(61434,3,4,0),t(61869,0,6,0),
  t(62304,0,4,0),t(62738,0,6,0),t(63173,0,6,0),t(63608,5,4,0),
  t(64043,3,4,2),t(64478,0,6,0),t(64912,0,6,0),t(65057,1,4,0),
  t(65347,3,4,0),t(65637,5,4,0),t(65782,6,4,0),t(66072,6,4,0),
  t(66217,5,4,0),t(66507,6,4,0),t(66652,5,4,0),t(67086,5,4,0),
  t(67376,6,4,0),t(67521,6,4,0),t(67956,5,4,0),t(68391,4,6,0),
  t(68826,4,6,0),t(69260,7,3,0),t(69260,0,3,0),t(69695,4,6,0),
  t(69985,3,4,0),t(70130,1,4,0),t(70420,0,4,0),t(70565,0,6,0),
  t(71000,0,4,0),t(71434,0,6,0),t(71869,0,6,0),t(72304,2,6,0),
  t(72739,1,4,0),t(72884,3,4,0),t(73174,0,10,0),t(73608,6,4,0),
  t(74043,4,6,0),t(74188,3,3,0),t(74478,1,4,0),t(74913,0,6,0),
  t(75348,1,4,0),t(75782,0,4,0),t(76217,1,4,0),t(76652,0,6,0),
  t(77087,0,6,0),t(77522,0,6,0),t(77667,1,4,0),t(77956,2,6,0),
  t(78391,4,6,0),t(78826,6,4,0),t(79261,5,4,0),t(79696,2,6,0),
  t(79841,1,4,0),t(80130,0,4,0),t(80275,1,3,0),t(80565,3,4,0),
  t(80855,5,4,0),t(81000,3,4,0),t(81435,5,4,0),t(81870,3,4,0),
  t(82159,2,6,0),t(82304,1,4,0),t(82739,0,6,0),t(83174,1,4,0),
  t(83609,3,4,0),t(84044,1,4,0),t(84478,3,4,0),t(84768,1,3,0),
  t(84913,2,6,0),h(85638,6,3,86797,0,[[85638,6,3],[85928,5,4],[86218,4,6],[86507,5,4],[86797,6,3]]),t(87087,2,6,0),t(87522,5,4,0),
  t(87667,4,6,0),t(88392,7,3,0),t(88392,0,3,0),t(88826,2,6,0),
  t(89261,1,4,0),t(89696,0,6,0),t(89986,0,4,0),t(90131,0,6,0),
  t(90566,2,6,0),t(91000,0,6,0),t(91435,2,6,0),t(91870,1,4,0),
  t(92305,0,6,0),t(92740,1,4,0),t(93174,1,4,0),t(93609,0,4,0),
  t(93754,1,4,0),t(94044,0,6,0),t(94334,0,4,0),t(94479,0,6,0),
  t(94914,3,4,0),t(95203,1,4,0),t(95348,0,6,0),t(95783,0,6,0),
  t(96218,2,6,3),t(96653,5,4,0),t(97088,6,4,0),t(97377,5,4,0),
  t(97522,6,4,0),t(97812,5,4,0),t(97957,6,4,0),t(98392,0,10,0),
  t(98537,6,4,0),t(98827,4,6,0),t(99262,2,6,0),t(99696,1,4,0),
  t(100131,0,6,0),t(100566,5,4,0),t(101001,3,4,0),t(101435,1,4,0),
  t(101870,0,4,0),t(102015,1,4,0),t(102305,0,4,0),t(102740,0,6,0),
  t(103175,0,4,0),t(103609,0,6,0),t(104044,0,4,0),t(104189,0,4,0),
  t(104479,0,6,0),t(104914,0,6,0),t(105349,1,4,0),t(105783,3,4,0),
  t(106218,0,6,0),t(106653,0,6,0),t(107088,1,4,0),t(107523,0,3,0),
  t(107523,7,3,0),t(107957,5,4,0),t(108682,6,4,0),t(108827,5,4,0),
  t(109117,6,4,0),t(109262,5,4,0),t(109697,6,4,0),t(110131,6,4,0),
  t(110566,6,4,0),t(111001,6,4,0),t(111871,6,4,0),t(112305,4,6,0),
  h(112740,6,4,113537),t(113610,6,4,0),t(114045,4,6,0),t(114479,6,4,0),
  t(114914,6,4,0),t(115349,6,4,0),t(115784,6,4,0),t(116219,4,6,0),
  t(116653,6,4,0),t(117088,4,6,0),t(117958,4,6,0),t(118393,5,4,0),
  t(118538,3,4,0),t(118827,1,4,0),h(119262,0,6,120204),h(120567,0,6,121726,0,[[120567,0,6],[120856,0,4],[121146,1,3],[121436,0,4],[121726,0,6]]),
  t(121871,0,4,0),t(122306,0,6,0),t(122741,2,6,0),t(123175,0,6,0),
  t(123610,2,6,0),t(124045,1,4,0),t(124480,2,6,0),t(124770,1,4,0),
  t(124915,1,4,0),t(125349,0,6,0),t(125784,1,4,4),t(126219,0,4,0),
  t(126364,0,4,0),t(126654,1,4,0),t(127089,0,10,0),t(127523,0,6,0),
  t(127958,2,6,0),t(128393,2,6,0),t(128683,5,4,0),t(128828,5,4,0),
  t(129263,5,4,0),t(129697,4,6,0),t(130132,2,6,0),t(130277,4,6,0),
  t(130567,3,4,0),t(131002,5,4,0),t(131437,2,6,0),t(131726,5,4,0),
  t(131871,3,4,0),t(132306,1,4,0),t(132741,4,6,0),t(133176,2,6,0),
  t(133466,1,4,0),t(133611,0,4,0),t(134045,0,6,0),t(134480,0,3,0),
  t(134480,7,3,0),t(134915,2,6,0),t(135350,0,6,0),t(135495,0,4,0),
  t(135785,0,6,0),t(136219,0,6,0),t(136509,0,6,0),t(136654,3,4,0),
  t(137379,5,4,0),t(137524,6,4,0),t(138103,5,4,0),t(138393,4,6,0),
  t(138828,6,4,0),t(139263,4,6,0),t(139408,5,4,0),t(139698,4,6,0),
  t(140132,4,6,0),t(140567,6,4,0),t(140712,5,4,0),t(141002,6,4,0),
  t(141437,4,6,0),t(141582,6,4,0),t(142306,3,4,0),t(142451,5,4,0),
  t(142741,4,6,0),t(143176,5,4,0),t(143611,2,6,0),t(143901,1,3,0),
  t(144046,2,6,0),t(144480,1,4,0),t(144915,0,6,0),t(145350,1,4,0),
  t(145785,0,4,0),t(145930,1,4,0),t(146220,2,6,0),t(146654,1,4,0),
  t(147089,2,6,0),t(147524,0,6,0),t(147959,4,6,0),t(148249,3,4,0),
  t(148394,1,4,0),t(148828,0,4,0),t(149263,1,4,0),t(149698,0,4,0),
  t(149988,1,4,0),t(150133,0,4,0),t(150568,0,10,0),t(151002,3,4,0),
  t(151292,1,3,0),t(151437,3,4,0),t(151872,6,4,0),h(152307,6,4,153031),
  t(153176,3,4,0),t(153611,7,3,0),t(153611,0,3,0),h(154191,4,3,155350,0,[[154191,4,3],[154481,2,6],[154771,4,3],[155061,2,6],[155350,4,3]]),
  t(155495,1,4,0),t(156220,0,4,0),
// </six-eternel-beat-v3-easy-notes>
])(mhTap,mhHoldV2,mhFlick,mhSlideV2);
const sixEternelBeatNormalNotes=((t,h,f,s)=>[
// <six-eternel-beat-v3-normal-notes>
  f(2157,1,3),t(2447,3,3,0),t(2591,5,3,0),t(3026,7,3,0),
  t(3171,4,2,0),t(3316,7,3,0),t(3606,3,3,0),h(4476,2,2,5200,1,[[4476,2,2],[4693,2,3],[4983,1,4],[5200,0,6]]),
  t(5490,0,3,0),t(5925,1,4,0),t(6505,3,3,0),t(8244,3,3,0),
  t(8679,6,2,0),t(9258,3,4,0),t(9838,1,3,0),t(10273,4,2,0),
  t(11432,0,10,0),t(11577,1,4,0),t(11867,2,6,0),t(12157,5,4,0),
  t(12302,6,4,0),t(13027,5,4,0),t(13172,5,4,0),t(14621,6,4,0),
  t(15201,6,2,0),t(15490,3,3,0),t(15635,1,3,0),t(16215,0,2,0),
  t(16795,2,2,0),h(17809,3,4,18462),t(18534,6,2,0),t(19259,1,3,0),
  f(19838,3,4),t(20128,4,6,0),t(20563,6,4,0),t(20998,1,4,0),
  t(21143,5,4,0),t(21433,3,4,0),t(21723,6,4,0),t(21867,3,4,0),
  t(22302,6,4,0),t(22737,3,4,0),t(23172,6,4,0),t(23607,4,6,0),
  t(23752,6,4,0),t(23897,6,2,0),t(24476,4,6,0),t(24911,7,3,0),
  t(24911,0,3,0),t(25636,3,3,0),t(25781,3,4,0),t(26071,1,3,0),
  t(26360,2,6,0),t(26650,0,6,0),t(27085,2,6,0),t(27520,4,6,0),
  t(27955,3,4,0),t(28389,1,4,0),t(28534,3,4,0),t(28824,0,6,0),
  t(29259,5,4,0),t(29404,2,6,0),t(29694,6,4,0),t(29839,4,2,0),
  t(30129,4,6,0),f(30274,7,3),t(30563,4,6,0),t(30853,1,3,0),
  t(30998,3,4,0),t(31433,4,6,0),t(31868,4,6,0),t(32303,4,6,0),
  t(32737,5,4,1),t(33172,3,4,0),t(33607,1,4,0),h(34042,0,6,34694),
  t(34911,0,4,0),t(35346,3,4,0),t(35781,4,6,0),t(36216,3,4,0),
  t(36651,4,6,0),t(37085,5,4,0),t(37665,7,3,0),t(37955,4,6,0),
  t(38390,4,6,0),t(38535,4,6,0),t(38825,5,4,0),t(39259,1,4,0),
  t(39404,5,4,0),t(39694,3,4,0),t(39839,6,4,0),t(40129,3,4,0),
  t(40564,6,4,0),t(40854,3,4,0),f(40999,6,4),t(41288,0,10,0),
  t(41433,6,4,0),t(41868,4,6,0),t(42303,6,4,0),t(42738,4,6,0),
  t(42883,6,2,0),t(43173,5,4,0),t(43607,4,6,0),t(44042,5,4,0),
  t(44477,2,6,0),t(44767,1,3,0),h(44912,0,6,45854,0,[[44912,0,6],[45202,0,4],[45564,1,3],[45854,1,2]]),t(46216,0,6,0),
  t(46651,0,6,0),t(47086,0,6,0),t(47521,0,4,0),t(47955,0,6,0),
  t(48390,2,6,0),t(48825,4,6,0),t(49115,3,4,0),t(49260,5,4,0),
  t(49550,4,6,0),t(49695,4,6,0),t(50129,3,4,0),t(50564,4,6,0),
  t(50999,3,4,0),t(51434,4,6,0),h(51724,3,3,52883),t(53173,0,3,0),
  f(53608,0,6),t(53898,0,4,0),h(54043,0,6,55057),h(55347,0,4,56506),
  t(56651,0,6,0),t(57521,0,6,0),t(57811,1,4,0),t(57956,0,3,0),
  t(57956,7,3,0),t(58391,1,3,0),t(58825,0,3,0),h(59260,0,6,59912),
  t(60130,0,6,0),t(60564,2,6,0),t(60999,4,6,0),t(61434,6,4,0),
  t(61869,4,6,0),t(62159,6,4,0),t(62304,5,4,0),t(62738,4,6,0),
  t(63173,2,6,0),t(63608,7,3,0),t(64043,3,3,2),t(64478,4,6,0),
  t(64912,4,6,0),t(65057,5,4,0),t(65347,6,4,0),t(65637,6,4,0),
  t(65782,5,4,0),t(66072,6,4,0),t(66217,5,3,0),t(66507,6,4,0),
  f(66652,5,3),t(67086,5,4,0),t(67376,6,4,0),t(67521,7,3,0),
  t(67956,5,3,0),t(68391,0,6,0),t(68826,4,6,0),t(69260,1,4,0),
  t(69695,2,6,0),t(69985,1,4,0),t(70130,0,4,0),t(70420,0,3,0),
  t(70565,0,10,0),h(71000,0,4,71507),t(71869,0,6,0),t(72304,0,6,0),
  t(72594,0,3,0),t(72739,1,4,0),t(72884,0,4,0),t(73174,0,6,0),
  t(73608,7,3,0),t(73608,0,3,0),t(74043,0,6,0),t(74188,4,2,0),
  t(74478,0,4,0),t(74913,2,6,0),t(75203,0,3,0),t(75348,3,4,0),
  t(75782,6,4,0),t(76217,3,4,0),h(76652,2,2,77304,0,[[76652,2,2],[77014,0,6],[77304,2,2]]),t(77522,0,6,0),
  f(77667,3,4),t(77956,4,6,0),t(78391,4,6,0),t(78826,5,4,0),
  t(79261,3,3,0),t(79696,0,6,0),t(79841,0,4,0),t(80130,0,3,0),
  t(80275,2,2,0),t(80420,0,4,0),t(80855,1,4,0),t(81000,3,3,0),
  t(81435,5,3,0),t(81870,1,3,0),t(82159,0,6,0),t(82304,0,4,0),
  t(82739,0,6,0),h(83174,1,4,83826),t(84044,0,4,0),t(84478,3,4,0),
  t(84768,8,2,0),t(84913,2,6,0),t(85348,0,6,0),h(85638,3,3,86797,1),
  t(87087,0,6,0),t(87522,1,4,0),t(87667,0,6,0),t(87812,1,3,0),
  t(88392,0,3,0),t(88392,7,3,0),t(88826,0,6,0),f(89261,1,4),
  t(89696,0,6,0),t(89986,1,3,0),t(90131,2,6,0),t(90566,4,6,0),
  t(91000,4,6,0),t(91435,4,6,0),t(91870,5,4,0),t(92305,2,6,0),
  t(92740,5,4,0),t(93174,3,4,0),t(93609,1,4,0),t(93754,0,4,0),
  t(94044,0,6,0),t(94334,0,4,0),t(94479,0,6,0),t(94914,0,3,0),
  t(95203,3,4,0),t(95348,4,6,0),t(95783,4,6,0),t(96218,0,10,3),
  t(96653,5,3,0),t(97088,1,4,0),t(97377,0,3,0),t(97522,1,3,0),
  t(97812,3,3,0),t(97957,5,4,0),t(98102,7,3,0),t(98392,4,6,0),
  t(98537,7,3,0),t(98827,4,6,0),f(99262,4,6),t(99696,5,4,0),
  t(100131,4,6,0),t(100566,5,4,0),t(101001,3,3,0),t(101435,5,4,0),
  t(101870,3,3,0),t(102015,1,3,0),t(102160,0,3,0),t(102740,0,6,0),
  t(103175,0,4,0),t(103609,0,6,0),t(104044,0,4,0),t(104189,0,3,0),
  t(104479,0,6,0),t(104914,0,6,0),t(105349,1,3,0),t(105783,0,3,0),
  t(105783,7,3,0),t(106218,0,6,0),t(106653,0,6,0),t(107088,3,3,0),
  t(107523,1,3,0),t(107957,5,3,0),t(108682,6,4,0),t(108827,5,3,0),
  t(109117,3,4,0),t(109262,1,3,0),t(109697,0,3,0),t(110131,0,4,0),
  t(110566,1,4,0),t(110711,2,2,0),f(111001,0,4),t(111436,3,4,0),
  t(111871,1,4,0),t(112016,4,6,0),t(112305,4,6,0),h(112740,4,6,113537,0,[[112740,4,6],[113030,7,3],[113247,7,3],[113537,4,6]]),
  t(113610,6,4,0),t(114045,2,6,0),t(114479,6,4,0),t(114914,3,4,0),
  t(115059,3,4,0),t(115349,0,4,0),t(115494,3,3,0),t(115784,6,4,0),
  t(116219,4,6,0),t(116653,3,4,0),t(117088,0,6,0),t(117523,0,4,0),
  t(117958,0,6,0),t(118393,1,4,0),t(118538,3,4,0),t(118682,0,6,0),
  h(119262,0,6,120204,1),h(120567,2,2,121726,0,[[120567,2,2],[120856,0,6],[121146,2,2],[121436,0,6],[121726,2,2]]),t(121871,3,4,0),t(122306,4,6,0),
  t(122741,4,6,0),t(123175,4,6,0),t(123610,4,6,0),t(124045,7,3,0),
  t(124045,0,3,0),f(124190,3,4),t(124480,0,6,0),t(124770,1,4,0),
  t(124915,0,4,0),t(125349,0,10,0),t(125784,0,4,4),t(126219,0,3,0),
  t(126364,0,4,0),t(126654,0,4,0),t(127089,0,6,0),t(127523,4,6,0),
  t(127958,2,6,0),t(128393,0,6,0),t(128683,1,3,0),t(128828,3,4,0),
  t(129263,5,4,0),t(129697,4,6,0),t(129842,3,4,0),t(130132,4,6,0),
  t(130277,2,6,0),t(130567,5,4,0),t(131002,6,4,0),t(131437,2,6,0),
  t(131726,6,4,0),t(131871,5,4,0),t(132306,6,4,0),t(132741,4,6,0),
  t(133176,2,6,0),t(133466,1,3,0),t(133611,0,4,0),f(134045,0,6),
  t(134480,3,3,0),t(134915,4,6,0),t(135350,2,6,0),t(135495,5,3,0),
  t(135640,3,3,0),t(136219,4,6,0),t(136509,2,6,0),t(136654,1,3,0),
  t(137379,0,3,0),t(137524,3,4,0),t(138103,1,4,0),t(138393,4,6,0),
  t(138828,0,3,0),t(138828,7,3,0),t(139263,4,6,0),t(139408,5,4,0),
  t(139698,4,6,0),t(140132,4,6,0),t(140567,6,4,0),t(140712,5,3,0),
  t(141002,5,3,0),t(141147,8,2,0),t(141437,4,6,0),t(141582,3,4,0),
  t(141727,5,3,0),t(142306,6,4,0),t(142451,5,3,0),t(142741,4,6,0),
  t(143176,5,4,0),t(143611,2,6,0),t(143901,2,2,0),f(144046,0,6),
  t(144480,1,3,0),t(144915,4,6,0),t(145350,1,3,0),t(145785,3,4,0),
  t(145930,0,3,0),t(146220,0,6,0),t(146654,0,4,0),t(147089,0,6,0),
  t(147524,0,6,0),t(147959,4,6,0),t(148249,3,3,0),t(148394,1,4,0),
  t(148828,0,4,0),t(149263,5,4,0),t(149698,1,3,0),t(149988,3,4,0),
  t(150133,0,3,0),t(150568,0,10,0),t(151002,5,4,0),t(151292,4,2,0),
  t(151437,7,3,0),t(151872,5,4,0),h(152307,7,3,153031),t(153176,6,4,0),
  t(153611,7,3,0),t(153611,0,3,0),t(154046,6,4,0),h(154191,6,2,155350,0,[[154191,6,2],[154481,6,3],[154771,5,4],[155061,5,4],[155350,4,6]]),
  t(155495,3,3,0),t(155785,5,4,0),f(156220,1,4),
// </six-eternel-beat-v3-normal-notes>
])(mhTap,mhHoldV2,mhFlick,mhSlideV2);
const sixEternelBeatHardNotes=((t,h,f,s)=>[
// <six-eternel-beat-v3-hard-notes>
  f(2157,0,3),t(2447,1,3,0),t(2591,3,3,0),t(3026,5,3,0),
  t(3171,8,1,0),t(3316,5,3,0),t(3823,3,3,0),s(4548,5200,[[4548,3,4],[4621,3,3],[4693,2,3],[4765,2,3],[4838,2,2],[4910,2,2],[4983,2,3],[5055,2,3],[5128,2.5,3],[5200,4,4]],1),
  t(5490,3,3,0),t(5925,5,4,0),t(5997,7,3,0),t(6505,5,3,0),
  t(7157,3,3,0),t(7302,8,1,0),h(8244,5,3,8606),t(8679,4,1,0),
  t(8896,1,3,0),t(9258,0,4,0),t(9838,1,3,0),t(10273,4,1,0),
  t(10635,2,8,0),t(11432,2,5,0),t(11577,5,4,0),t(11867,2,5,0),
  t(12157,5,4,0),t(12302,6,4,0),t(13027,6,4,0),t(13172,6,4,0),
  t(13969,5,4,0),t(14621,6,4,0),t(15201,6,1,0),t(15490,3,3,0),
  t(15635,1,3,0),f(15708,3,3),h(16215,6,1,16722,0,[[16215,6,1],[16505,5,3],[16722,4,5]]),t(16795,2,1,0),
  h(17882,3,3,18462),t(18534,2,1,0),t(18679,4,1,0),t(19259,5,3,0),
  t(19766,6,4,0),t(19838,3,4,0),t(20128,4,5,0),t(20563,6,4,0),
  t(20998,5,4,0),t(21143,3,4,0),t(21433,5,4,0),t(21723,3,4,0),
  t(21867,1,4,0),t(22302,2,4,0),t(22375,0,5,0),t(22737,0,4,0),
  t(23172,1,4,0),t(23607,0,5,0),t(23752,3,4,0),t(23824,1,4,0),
  t(24041,5,4,0),t(24476,2,5,0),t(24911,5,4,0),t(25128,7,3,0),
  t(25128,1,3,0),t(25563,5,3,0),t(25636,3,3,0),t(25781,6,4,0),
  t(26071,1,3,0),t(26360,2,5,0),f(26650,4,5),t(27085,5,5,0),
  t(27302,3,4,0),t(27520,5,5,0),t(27955,3,4,0),t(28389,6,4,0),
  t(28534,5,4,0),t(28824,3,5,0),t(28897,5,4,0),t(29259,6,4,0),
  t(29404,4,5,0),t(29694,6,4,0),t(29839,5,1,0),t(29911,5,5,0),
  t(30129,2,5,0),t(30274,5,3,0),t(30563,5,5,0),t(30853,5,3,0),
  t(30926,0,5,0),t(31433,2,5,0),t(31868,4,5,0),t(32303,5,5,0),
  t(32737,5,4,1),t(33172,3,4,0),t(33607,1,4,0),h(34042,0,5,34694),
  t(34911,0,4,0),t(35346,3,4,0),t(35781,5,5,0),t(36216,3,4,0),
  h(36651,5,5,37158),f(37665,5,3),h(37955,5,5,38462),t(38535,4,5,0),
  t(38825,6,4,0),t(38825,0,3,0),t(39259,3,4,0),t(39404,5,4,0),
  t(39694,6,4,0),t(39839,5,4,0),t(40129,1,4,0),t(40564,3,4,0),
  t(40854,5,4,0),t(40999,6,4,0),t(41216,5,4,0),t(41288,2,5,0),
  t(41433,0,4,0),t(41433,7,3,0),t(41868,0,8,0),t(42303,0,4,0),
  t(42738,2,5,0),t(42883,8,1,0),t(43173,3,4,0),h(43607,0,5,44187),
  t(44477,2,5,0),t(44694,1,3,0),t(44767,3,3,0),t(44912,1,4,0),
  h(45129,0,5,45854,0,[[45129,0,5],[45347,1,4],[45636,2,2],[45854,2,1]]),t(46216,4,5,0),t(46651,0,5,0),t(47086,2,5,0),
  t(47303,0,3,0),t(47521,2,4,0),t(47593,0,5,0),f(47955,2,5),
  t(48390,0,5,0),t(48825,0,5,0),t(49115,0,4,0),t(49260,1,4,0),
  t(49550,2,5,0),t(49695,4,5,0),t(49912,4,5,0),t(50129,6,4,0),
  t(50564,4,5,0),t(50999,6,4,0),t(51216,4,5,0),t(51434,2,5,0),
  s(51651,52811,[[51651,1,4],[51796,0.5,4],[52013,0,4],[52376,0,4],[52811,0,4]]),t(52956,0,3,0),t(53173,3,3,0),t(53390,0,4,0),
  t(53608,0,5,0),t(53825,3,4,0),t(53898,5,4,0),s(54043,55057,[[54043,3,4],[54405,4,3],[54767,4,3],[54985,4,2],[55057,4,2]]),
  s(55274,56434,[[55274,3,4],[55419,3.5,4],[55564,4,3],[55709,4,3],[55782,4,3],[55854,4,3],[55999,3.5,3],[56144,3.5,2],[56289,4,2],[56434,4,2]]),t(56651,5,5,0),t(56724,5,3,0),t(57014,6,4,0),
  t(57304,5,4,0),t(57521,2,5,0),t(57811,5,4,0),t(57956,3,4,0),
  t(58028,5,4,0),t(58173,3,4,0),t(58391,3,3,0),t(58608,5,3,0),
  t(58825,5,3,0),t(59043,3,4,0),h(59260,5,5,59912),f(60130,4,5),
  t(60492,6,4,0),t(60564,4,5,0),t(60782,5,5,0),t(60999,2,5,0),
  t(61434,6,4,2),t(61869,2,5,0),t(62086,6,4,0),t(62159,3,4,0),
  t(62304,6,4,0),h(62521,4,5,63318),t(63391,4,5,0),t(63608,3,3,0),
  t(63825,1,4,0),t(63970,2,4,0),t(64043,1,3,0),t(64478,1,5,0),
  t(64550,1,3,0),t(64912,0,5,0),t(65057,0,4,0),t(65275,1,4,0),
  t(65347,0,4,0),t(65637,1,4,0),f(65710,3,3),t(66072,1,4,0),
  t(66217,0,3,0),t(66434,0,5,0),t(66507,3,4,0),t(66652,1,3,0),
  t(66869,5,3,0),t(67086,3,4,0),t(67159,6,4,0),t(67376,5,4,0),
  t(67449,6,4,0),t(67884,5,3,0),t(67956,7,3,0),t(68391,2,5,0),
  t(68463,5,4,0),t(68826,0,8,0),t(69043,3,3,0),t(69260,1,4,0),
  t(69695,2,5,0),t(69985,1,4,0),t(70130,0,4,0),t(70420,3,3,0),
  t(70565,0,5,0),h(70782,0,5,71507),t(71652,0,5,0),t(71869,0,5,0),
  t(72304,2,5,0),t(72594,5,3,0),t(72739,6,4,0),t(72884,5,4,0),
  t(72956,7,3,0),t(73101,3,4,0),h(73174,5,5,73753,1),t(74043,0,5,0),
  t(74188,6,1,0),t(74261,3,3,0),t(74478,6,4,0),t(74695,3,3,0),
  f(74913,4,5),t(75203,7,3,0),t(75348,5,4,0),t(75782,3,4,0),
  t(76000,6,3,0),t(76000,0,3,0),t(76217,1,4,0),s(76652,77304,[[76652,1,4],[76724,1,4],[76869,1,3],[77014,1,3],[77159,3,2],[77232,2.5,2],[77304,3,2]]),
  t(77522,4,5,0),t(77667,3,4,0),t(77739,1,3,0),t(77956,0,5,0),
  t(78391,0,5,0),h(78464,5,1,79116,0,[[78464,5,1],[78826,3,5],[79116,5,1]]),t(79261,0,3,0),t(79696,0,5,0),
  t(79768,3,4,0),t(79913,0,5,0),t(80130,5,3,0),t(80275,2,1,0),
  t(80348,3,4,0),t(80565,0,3,0),t(80783,2,5,0),t(80855,1,4,0),
  t(81000,0,3,0),t(81435,0,3,0),t(81507,0,5,0),t(81652,0,4,0),
  t(81870,1,3,0),t(82087,0,3,0),t(82159,0,5,0),f(82304,3,4),
  t(82739,1,5,0),t(82812,0,5,0),s(83174,83826,[[83174,1,2],[83246,1,3],[83319,1,3],[83391,1.5,4],[83464,2.5,4],[83536,1.5,4],[83609,3,4],[83681,1.5,3],[83754,1,3],[83826,1,2]]),t(84044,3,4,0),
  t(84261,6,4,0),t(84478,3,4,0),t(84696,5,3,0),t(84768,4,1,0),
  t(84913,0,5,0),t(85131,0,3,0),t(85348,0,5,0),s(85638,86797,[[85638,1,2],[85783,2,3],[85928,2,3],[86073,2.5,4],[86218,2.5,4],[86362,3,4],[86435,3,4],[86507,2.5,3],[86580,2.5,3],[86652,1.5,3],[86797,1.5,2]]),
  t(87015,2,4,0),t(87087,0,5,0),t(87522,1,4,0),t(87594,0,4,0),
  t(87812,0,3,0),t(88174,1,3,0),t(88392,3,4,0),t(88826,1,5,0),
  t(88899,0,4,0),t(89044,0,5,0),t(89261,1,4,0),t(89479,1,3,0),
  t(89696,2,5,0),t(89913,1,3,0),t(89986,0,3,0),t(90131,0,5,0),
  t(90348,1,3,0),t(90348,7,3,0),f(90566,4,5),t(90928,2,5,0),
  t(91000,0,5,0),t(91218,0,4,0),t(91435,0,5,0),t(91653,0,3,0),
  t(91870,0,4,0),t(92305,0,8,0),t(92522,1,4,0),t(92740,0,4,0),
  t(93174,1,4,0),t(93609,1,4,0),t(93754,3,4,0),t(93827,5,4,0),
  t(94044,5,5,0),t(94261,3,4,0),t(94334,5,4,0),t(94479,0,5,0),
  t(94551,2,3,0),t(94696,3,4,0),t(94914,1,3,0),s(95131,95566,[[95131,3,2],[95203,3,3],[95276,3.5,4],[95348,4,4],[95421,4,4],[95493,3,3],[95566,2,2]]),
  t(95783,5,5,0),t(96218,2,5,3),t(96653,7,3,0),t(96870,4,1,0),
  t(97088,1,4,0),t(97160,4,1,0),t(97377,5,3,0),t(97522,7,3,0),
  t(97595,5,3,0),t(97812,7,3,0),t(97957,5,4,0),f(98102,7,3),
  t(98392,4,5,0),t(98537,7,3,0),t(98827,4,5,0),t(98899,6,4,0),
  t(99044,5,3,0),t(99262,5,5,0),t(99696,3,4,0),t(99914,5,4,0),
  t(100131,2,5,0),t(100204,1,4,0),t(100348,3,3,0),t(100566,1,4,0),
  t(100638,3,4,0),t(100783,5,3,0),t(101001,3,3,0),t(101073,5,4,0),
  t(101435,6,4,0),t(101653,4,5,0),t(101870,3,3,0),t(102015,7,3,0),
  h(102088,3,3,102740),h(102957,1,5,103682,1,[[102957,1,5],[103175,2,2],[103465,2,2],[103682,1,5]]),t(104044,0,4,0),t(104189,1,3,0),
  t(104262,0,3,0),t(104479,1,5,0),t(104552,0,4,0),t(104696,3,3,0),
  t(104914,5,5,0),f(104986,3,4),t(105349,5,3,0),t(105566,5,3,0),
  t(105783,6,4,0),t(106001,5,5,0),t(106218,5,5,0),t(106436,5,4,0),
  t(106653,2,5,0),t(106870,0,5,0),t(107088,0,3,0),t(107305,0,4,0),
  t(107523,1,3,0),t(107740,3,4,0),t(107957,5,3,0),t(108175,3,4,0),
  t(108610,5,4,0),t(108682,6,4,0),t(108827,5,3,0),t(109044,3,3,0),
  t(109117,5,4,0),t(109262,3,3,0),t(109334,1,4,0),t(109479,3,3,0),
  t(109697,1,3,0),t(109914,0,3,0),t(110131,1,4,0),t(110566,0,4,0),
  t(110711,2,1,0),t(111001,3,4,0),t(111436,5,4,0),t(111871,1,4,0),
  t(112016,2,5,0),f(112305,4,5),s(112740,113537,[[112740,3,4],[112813,2,4],[112885,2,4],[112958,2,3],[113030,2,3],[113103,1.5,3],[113175,1.5,3],[113247,1.5,3],[113320,1,3],[113392,1.5,2],[113465,1,2],[113537,1.5,2]]),t(113610,0,4,0),
  t(113827,0,8,0),t(114045,2,5,0),t(114479,5,4,0),t(114914,6,4,0),
  t(115059,5,4,0),t(115349,6,4,0),t(115494,5,3,0),t(115784,3,4,0),
  t(116219,0,5,0),t(116653,0,4,0),t(117088,0,5,0),t(117523,3,4,0),
  t(117958,0,5,0),t(118393,0,4,0),t(118538,1,4,0),t(118682,2,5,0),
  t(118827,6,4,0),s(119262,120204,[[119262,3,4],[119480,2.5,4],[119552,2.5,3],[119842,3,3],[119987,3.5,2],[120132,4,2],[120204,4,2]],1),h(120567,6,4,121726),t(121871,0,4,0),
  t(122306,2,5,0),t(122523,4,5,0),t(122668,3,3,0),t(122741,0,5,0),
  t(122958,0,5,0),t(123175,0,5,0),t(123393,0,5,0),t(123610,0,5,0),
  t(123828,0,3,0),t(123828,6,3,0),t(123973,1,5,0),t(124045,0,4,0),
  f(124190,0,4),t(124480,0,5,0),t(124697,3,4,0),t(124770,1,4,0),
  t(124915,3,4,0),t(124987,5,3,0),t(125349,5,5,0),t(125567,4,5,0),
  t(125784,6,4,0),t(125784,0,3,0),t(126002,5,3,0),t(126219,2,3,0),
  t(126291,0,4,0),t(126654,1,4,4),t(127089,0,5,0),t(127306,2,5,0),
  t(127523,0,5,0),t(127741,0,3,0),t(127958,0,5,0),t(128176,5,4,0),
  t(128320,1,4,0),t(128393,2,5,0),t(128683,0,3,0),t(128828,3,4,0),
  t(129045,0,5,0),t(129263,0,4,0),t(129697,0,5,0),f(129842,1,4),
  t(130132,0,5,0),t(130277,1,5,0),t(130350,0,4,0),t(130567,1,4,0),
  t(130784,2,5,0),t(131002,5,4,0),t(131364,8,1,0),t(131437,2,5,0),
  t(131726,6,4,0),t(131871,3,4,0),t(132089,2,4,0),t(132234,3,4,0),
  t(132306,6,4,0),h(132668,3,4,133176,1),t(133466,3,3,0),t(133611,1,4,0),
  t(133683,0,4,0),t(134045,1,5,0),t(134118,0,4,0),t(134263,0,5,0),
  t(134480,0,3,0),t(134698,1,4,0),t(134842,5,4,0),t(134915,2,5,0),
  t(135132,1,4,0),t(135350,0,5,0),t(135495,0,3,0),t(135567,3,4,0),
  t(135785,5,5,0),t(136002,2,5,0),t(136147,0,4,0),t(136219,2,5,0),
  t(136437,0,8,0),t(136509,0,5,0),t(136654,0,3,0),t(136727,0,5,0),
  t(136872,0,5,0),f(137016,1,4),t(137379,0,3,0),t(137524,1,4,0),
  t(137741,0,4,0),t(138103,2,4,0),t(138176,1,3,0),t(138321,1,3,0),
  t(138393,4,5,0),t(138828,3,4,0),t(139045,7,3,0),t(139263,4,5,0),
  t(139408,5,4,0),h(139480,6,4,140132),t(140350,0,5,0),t(140567,5,4,0),
  f(140712,3,3),t(141002,7,3,0),t(141147,8,1,0),t(141437,4,5,0),
  t(141582,6,4,0),t(141654,4,5,0),t(141872,3,3,0),t(142089,7,3,0),
  t(142234,5,4,0),t(142306,3,4,0),t(142451,5,3,0),t(142524,3,4,0),
  t(142741,0,5,0),t(142959,2,1,0),t(143104,0,4,0),t(143176,1,4,0),
  t(143393,0,4,0),t(143393,7,3,0),t(143611,1,5,0),t(143828,3,4,0),
  t(143901,6,1,0),t(144046,3,5,0),t(144118,5,4,0),t(144263,6,4,0),
  t(144408,3,3,0),t(144480,4,3,0),t(144698,4,5,0),t(144843,3,4,0),
  t(144915,4,5,0),t(145133,5,5,0),t(145350,5,3,0),t(145567,6,4,0),
  t(145785,5,4,0),t(145930,3,3,0),t(146002,5,3,0),t(146220,5,5,0),
  t(146437,5,4,0),t(146654,3,4,0),t(146872,1,4,0),t(147089,0,5,0),
  t(147307,1,4,0),t(147524,2,5,0),t(147741,5,4,0),t(147886,3,4,0),
  t(147959,4,5,0),t(148176,3,3,0),t(148249,1,3,0),f(148394,1,4),
  t(148828,0,4,0),t(149046,1,3,0),t(149263,0,4,0),t(149481,0,3,0),
  t(149698,1,3,0),t(149988,3,4,0),t(150060,7,3,0),t(150350,5,4,0),
  t(150568,5,5,0),t(150785,7,3,0),t(151002,6,4,0),t(151220,5,4,0),
  t(151292,4,1,0),t(151437,5,3,0),t(151510,6,4,0),t(151655,3,4,0),
  t(151872,5,4,0),t(151945,1,3,0),t(152089,2,3,0),h(152307,4,1,153031,0,[[152307,4,1],[152524,4,2],[152814,3,4],[153031,2,5]]),
  t(153176,5,4,0),t(153394,5,5,0),t(153611,5,4,0),t(154046,0,4,0),
  t(154046,7,3,0),t(154191,1,8,0),s(154263,155423,[[154263,3,4],[154408,3,4],[154553,4,3],[154698,4,3],[154843,4,3],[154916,4,3],[154988,4,3],[155061,4,3],[155133,4,2],[155278,4,2],[155423,4,2]]),t(155495,1,3,0),
  t(155785,5,4,0),t(156003,1,3,0),t(156003,7,3,0),f(156220,6,4),
// </six-eternel-beat-v3-hard-notes>
])(mhTap,mhHoldV2,mhFlick,mhSlideV2);
const sixEternelBeatExpertNotes=((t,h,f,s)=>[
// <six-eternel-beat-v3-expert-notes>
  t(2157,0,3,0),t(2302,2,1,0),t(2447,3,3,0),f(2591,5,3),
  t(3026,7,3,0),t(3171,6,1,0),t(3316,3,3,0),t(3606,5,3,0),
  t(3823,7,3,0),s(4548,5200,[[4548,2,4],[4621,2,3],[4693,1,3],[4765,0.5,3],[4838,0.5,2],[4910,0.5,2],[4983,0.5,3],[5055,1,3],[5128,1.5,3],[5200,3,4]],1),t(4838,7,3,0),s(5490,6070,[[5490,0.5,3],[5708,1,3],[5925,2.5,3],[6070,3.5,3]]),
  t(6505,3,3,0),t(6867,1,3,0),t(7157,0,3,0),t(7302,2,1,0),
  t(7592,1,8,0),h(8244,3,3,8606),t(8679,6,1,0),t(8751,2,5,0),
  t(8896,1,3,0),t(9258,0,2,0),t(9258,4,2,0),t(9548,2,2,0),
  t(9548,6,2,0),t(9838,4,2,0),t(9838,8,2,0),t(10273,4,1,0),
  t(10635,4,5,0),t(11142,5,4,0),t(11432,5,5,0),t(11577,1,2,0),
  t(11577,5,2,0),t(11867,3,2,0),t(11867,7,2,0),t(12157,1,2,0),
  t(12157,5,2,0),t(12302,3,4,0),t(12592,6,4,0),t(13027,3,4,0),
  t(13172,5,4,0),h(13461,2,1,14114,1,[[13461,2,1],[13824,1,3],[14114,0,5]]),f(14621,5,4),t(15201,4,1,0),
  t(15490,1,3,0),t(15635,0,3,0),t(15708,1,3,0),t(16143,4,1,0),
  h(16215,2,1,16722),t(16795,4,1,0),h(17882,5,3,18462),t(18534,2,1,0),
  t(18679,6,1,0),t(19186,4,1,0),t(19259,7,3,0),t(19766,5,4,0),
  t(19838,6,4,0),t(20128,0,2,0),t(20128,4,2,0),t(20563,2,2,0),
  t(20563,6,2,0),t(20998,4,2,0),t(20998,8,2,0),t(21143,3,4,0),
  t(21433,5,4,0),t(21578,6,4,0),t(21723,3,4,0),t(21867,6,4,0),
  t(22302,3,4,0),t(22375,5,5,0),t(22520,5,4,0),t(22737,6,4,0),
  t(23172,5,4,0),t(23244,7,3,0),t(23607,0,5,0),t(23752,5,4,0),
  t(23824,3,4,0),t(23897,8,1,0),t(24041,3,4,0),t(24259,4,5,0),
  f(24476,5,5),t(24911,6,4,0),t(24911,0,3,0),t(25128,1,3,0),
  t(25128,7,3,0),t(25563,3,3,0),t(25636,5,3,0),t(25781,6,4,0),
  t(25926,5,4,0),t(26071,1,2,0),t(26071,5,2,0),t(26360,3,2,0),
  t(26360,7,2,0),t(26650,1,2,0),t(26650,5,2,0),t(27085,0,5,0),
  t(27302,5,4,0),t(27520,2,5,0),t(27955,6,4,0),h(28172,4,5,28752),
  t(28824,2,5,0),t(28897,5,4,0),t(29259,3,4,0),t(29404,4,5,0),
  t(29476,1,3,0),t(29694,3,4,0),t(29839,5,1,0),t(29911,5,5,0),
  t(30129,2,5,0),t(30274,5,3,0),t(30563,5,5,0),t(30636,4,5,0),
  t(30853,3,3,0),t(30926,4,5,0),t(30998,6,4,0),t(31216,4,5,0),
  f(31433,0,5),t(31868,0,5,1),t(32303,0,5,0),t(32737,0,4,0),
  t(32955,0,3,0),t(33172,3,4,0),t(33390,1,3,0),t(33607,5,4,0),
  h(34042,2,5,34694),t(34911,1,4,0),t(34984,3,4,0),t(35346,5,4,0),
  t(35781,5,5,0),t(36216,5,4,0),t(36433,7,3,0),h(36651,4,5,37158,1),
  t(37520,0,5,0),t(37665,1,3,0),h(37955,0,5,38462),t(38535,0,5,0),
  t(38825,3,4,0),t(39259,5,4,0),t(39332,3,3,0),t(39404,1,4,0),
  t(39694,0,4,0),s(39839,40491,[[39839,1.5,4],[40057,1.5,3],[40201,1.5,3],[40346,2.5,2],[40419,3,2],[40491,3.5,2]]),t(40129,4,4,0),f(40564,5,4),
  t(40854,5,4,0),t(40999,6,4,0),t(41216,5,4,0),t(41288,2,8,0),
  t(41433,5,4,0),t(41868,3,5,0),t(41941,5,4,0),t(42086,5,5,0),
  t(42303,3,4,0),t(42520,4,5,0),t(42738,5,5,0),t(42883,6,1,0),
  t(43173,3,4,0),h(43607,5,5,44187,0,[[43607,5,5],[43897,6,3],[44187,7,1]]),t(44260,3,4,0),t(44477,0,5,0),
  t(44694,0,3,0),t(44767,1,3,0),t(44912,3,4,0),h(45129,1,5,45854,1),
  t(45564,1,3,0),t(46216,4,5,0),t(46651,2,5,0),t(47086,0,5,0),
  t(47303,0,3,0),t(47521,2,4,0),t(47593,0,5,0),t(47955,2,5,0),
  t(48028,5,4,0),t(48173,7,3,0),t(48390,5,5,0),t(48608,3,3,0),
  f(48825,0,5),t(49115,0,4,0),t(49260,1,4,0),t(49477,2,5,0),
  t(49550,0,5,0),t(49695,0,5,0),t(49912,0,5,0),t(50129,0,4,0),
  t(50347,0,5,0),t(50564,2,5,0),t(50999,1,4,0),t(51071,4,1,0),
  t(51216,4,5,0),t(51434,2,5,0),s(51651,52811,[[51651,2.5,4],[51796,1.5,4],[52013,0.5,4],[52376,0.5,4],[52811,0,4]]),t(52303,1,5,0),
  t(52521,2,5,0),t(52956,5,3,0),t(53173,4,3,0),t(53245,5,4,0),
  t(53390,6,4,0),t(53390,0,3,0),t(53608,4,5,0),t(53825,6,4,0),
  t(53898,5,4,0),t(53970,3,4,0),f(54043,0,5),t(54405,0,4,0),
  t(54477,1,4,0),t(54622,3,4,0),t(54695,1,4,0),t(54912,0,5,0),
  s(55130,56289,[[55130,1,4],[55274,1,4],[55419,1.5,3],[55564,2,3],[55709,2.5,3],[55782,3,3],[55854,3,3],[55999,1,2],[56144,1,2],[56289,2.5,2]],1),t(55564,0,4,0),t(55782,0,5,0),t(55999,5,1,0),
  t(56651,2,5,0),t(56724,1,3,0),t(57014,3,4,0),t(57304,1,4,0),
  t(57521,0,5,0),t(57738,2,3,0),t(57811,0,4,0),t(57956,1,4,0),
  t(58028,0,4,0),t(58173,0,4,0),t(58391,0,3,0),t(58608,1,3,0),
  t(58825,1,3,0),t(59043,3,4,0),h(59260,5,5,59912),t(60130,4,5,0),
  t(60347,3,4,0),t(60492,2,4,0),t(60564,0,5,0),t(60782,0,5,0),
  t(60999,0,5,0),t(61217,0,5,0),t(61434,1,4,0),t(61651,4,5,0),
  t(61869,2,5,0),t(62086,1,4,0),t(62159,0,4,0),t(62304,3,4,0),
  h(62521,2,1,63318,0,[[62521,2,1],[62811,1,4],[63028,1,4],[63318,2,1]]),f(62956,0,4),t(63391,0,5,0),t(63608,0,3,0),
  t(63681,3,4,0),t(63825,3,4,0),t(63970,6,4,0),t(64043,5,3,0),
  t(64115,7,3,0),t(64478,4,5,0),t(64550,1,3,0),t(64912,1,8,0),
  t(65057,6,4,0),t(65057,0,3,0),t(65275,4,4,0),t(65347,5,4,0),
  t(65637,6,4,0),t(65710,5,3,0),t(65782,6,4,0),t(65999,3,5,0),
  t(66072,5,4,0),t(66217,3,3,0),t(66434,1,5,0),t(66507,0,4,0),
  t(66652,0,3,0),t(66869,1,3,0),t(67086,0,4,0),t(67159,1,4,0),
  t(67376,3,4,0),t(67449,5,4,0),f(67521,3,3),t(67884,1,3,0),
  t(67956,0,3,0),t(68391,2,5,0),t(68463,1,4,0),t(68826,4,5,0),
  t(69043,7,3,0),t(69260,5,4,0),t(69695,5,5,0),t(69985,5,4,0),
  t(70130,3,4,0),t(70420,0,3,0),t(70565,2,5,0),h(70782,5,5,71507),
  t(71652,4,5,0),t(71869,5,5,0),t(72304,4,5,0),t(72377,6,4,0),
  t(72594,5,3,0),t(72739,6,4,0),t(72884,5,4,0),t(72956,7,3,0),
  t(73101,3,4,0),h(73174,5,5,73753,1),t(74043,0,5,0),t(74188,4,1,0),
  t(74261,5,3,0),t(74478,6,4,0),t(74695,3,3,0),f(74913,4,5),
  t(75203,7,3,0),t(75275,5,3,0),t(75348,6,4,0),t(75782,3,4,0),
  t(76000,0,3,0),t(76217,1,4,0),t(76435,0,4,0),t(76435,7,3,0),
  s(76652,77304,[[76652,1.5,4],[76724,1,4],[76869,1,3],[77014,1.5,3],[77159,3,2],[77232,3,2],[77304,3,2]]),t(77522,4,5,0),t(77667,3,4,0),t(77739,1,3,0),
  t(77956,0,5,0),t(78174,1,4,0),t(78391,0,5,0),h(78464,1,5,79116,0,[[78464,1,5],[78826,3,1],[79116,1,5]]),
  t(78826,0,4,2),t(79261,0,3,0),t(79333,3,4,0),t(79696,5,5,0),
  t(79768,2,4,0),t(79841,3,4,0),t(79913,4,5,0),t(80130,3,3,0),
  t(80275,2,1,0),t(80348,3,4,0),t(80420,5,4,0),t(80565,3,3,0),
  t(80783,3,5,0),t(80855,5,4,0),t(81000,5,3,0),t(81217,6,4,0),
  t(81435,7,3,0),t(81507,4,5,0),t(81652,3,4,0),t(81870,1,3,0),
  t(82087,0,3,0),t(82159,0,5,0),f(82304,3,4),t(82739,1,5,0),
  t(82812,0,5,0),s(83174,83826,[[83174,1,2],[83246,0.5,3],[83319,1,3],[83391,1.5,4],[83464,2.5,4],[83536,1.5,4],[83609,2.5,4],[83681,1.5,3],[83754,1,3],[83826,1,2]]),t(83536,4,4,0),t(84044,5,4,0),
  t(84261,6,4,0),t(84478,5,4,0),t(84696,7,3,0),t(84768,6,1,0),
  t(84841,8,1,0),t(84913,2,5,0),t(85131,5,3,0),t(85276,8,1,0),
  t(85348,4,5,0),s(85638,86797,[[85638,2,2],[85783,3,3],[85928,3,3],[86073,3.5,4],[86218,3.5,4],[86362,4,4],[86435,4,4],[86507,3.5,3],[86580,3.5,3],[86652,2.5,3],[86797,2.5,2]]),t(86218,0,5,0),t(86435,2,5,0),
  t(86870,8,1,0),t(87015,4,4,0),t(87087,2,5,0),t(87522,0,4,0),
  t(87594,1,4,0),t(87667,0,8,0),f(87812,0,3),t(88174,1,3,0),
  t(88392,3,4,0),t(88609,6,3,0),t(88609,0,3,0),t(88826,2,5,0),
  t(88899,5,4,0),t(89044,2,5,0),t(89261,1,4,0),t(89479,1,3,0),
  t(89696,0,5,0),t(89913,1,3,0),t(89986,0,3,0),t(90131,2,5,0),
  t(90203,1,4,0),t(90348,0,3,0),t(90566,0,5,0),t(90783,0,3,0),
  t(90928,0,5,0),t(91000,2,5,0),t(91218,5,4,0),t(91435,5,5,0),
  t(91653,5,3,0),t(91870,3,4,0),t(92087,1,3,0),t(92305,0,5,0),
  t(92522,3,4,0),t(92667,1,3,0),t(92740,5,4,0),f(93174,6,4),
  t(93609,5,4,0),t(93754,3,4,0),t(93827,5,4,0),t(94044,2,5,0),
  t(94261,0,4,0),t(94334,3,4,0),t(94479,3,5,0),t(94551,5,3,0),
  t(94696,6,4,0),t(94914,5,3,0),s(95131,95566,[[95131,3,2],[95203,3,3],[95276,3.5,4],[95348,4,4],[95421,4,4],[95493,2.5,3],[95566,1.5,2]]),t(95783,0,5,0),
  t(96218,2,5,3),t(96653,5,3,0),t(96870,8,1,0),t(97088,3,4,0),
  t(97160,6,1,0),t(97377,5,3,0),t(97522,5,3,0),t(97595,1,3,0),
  t(97812,5,3,0),t(97957,3,4,0),t(98102,7,3,0),t(98392,5,5,0),
  f(98537,7,3),t(98827,4,5,0),t(98899,6,4,0),t(99044,5,3,0),
  t(99262,5,5,0),t(99479,1,3,0),t(99479,7,3,0),t(99696,5,4,0),
  t(99914,6,4,0),t(100131,4,5,0),t(100204,1,4,0),t(100348,1,3,0),
  t(100566,1,4,0),t(100638,0,4,0),t(100783,3,3,0),t(101001,0,3,0),
  t(101073,3,4,0),t(101435,6,4,0),t(101653,2,5,0),t(101870,5,3,0),
  t(102015,3,3,0),h(102088,1,3,102740),h(102957,2,1,103682,1,[[102957,2,1],[103175,0,4],[103465,0,4],[103682,2,1]]),t(104044,0,4,0),
  t(104117,1,4,0),t(104189,3,3,0),t(104262,5,3,0),t(104479,4,5,0),
  t(104552,6,4,0),t(104696,5,3,0),t(104914,5,5,0),t(104986,3,4,0),
  t(105349,5,3,0),t(105566,7,3,0),t(105783,5,4,0),t(106001,0,5,0),
  t(106218,0,5,0),t(106436,3,4,0),t(106653,2,5,0),t(106870,0,5,0),
  t(107088,5,3,0),t(107305,3,4,0),t(107523,5,3,0),t(107740,6,4,0),
  t(107957,5,3,0),f(108175,1,4),t(108610,3,4,0),t(108682,5,4,0),
  t(108827,7,3,0),t(109044,3,3,0),t(109117,5,4,0),t(109262,3,3,0),
  t(109334,1,4,0),t(109479,5,3,0),t(109697,1,3,0),t(109914,1,3,0),
  t(109914,7,3,0),t(110131,0,4,0),t(110349,1,3,0),t(110566,1,4,0),
  t(110711,5,1,0),t(110784,0,8,0),t(111001,3,4,0),t(111436,0,4,0),
  t(111871,1,4,0),t(111943,2,4,0),t(112016,0,5,0),t(112305,0,5,0),
  s(112740,113537,[[112740,2.5,4],[112813,1.5,4],[112885,1.5,4],[112958,1.5,3],[113030,1.5,3],[113103,0.5,3],[113175,0.5,3],[113247,0.5,3],[113320,0.5,3],[113392,0.5,2],[113465,0,2],[113537,0.5,2]]),f(113175,2,4),t(113610,5,4,0),t(113827,2,5,0),
  t(114045,5,5,0),t(114262,5,3,0),t(114479,3,4,0),t(114914,1,4,0),
  t(115059,2,4,0),t(115132,0,5,0),t(115349,1,4,0),t(115494,3,3,0),
  t(115784,1,4,0),t(116001,0,5,0),t(116219,0,5,0),t(116653,1,4,0),
  t(117088,0,5,4),t(117523,1,4,0),t(117740,0,5,0),t(117958,2,5,0),
  t(118030,1,4,0),t(118393,0,4,0),t(118538,1,4,0),t(118682,2,5,0),
  t(118827,1,4,0),s(119262,120204,[[119262,0.5,3],[119480,0,3],[119697,0.5,3],[119914,2,3],[120132,3.5,3],[120204,4,3]]),t(119697,4,5,0),t(119914,7,3,0),
  h(120349,6,3,121509),s(120639,121799,[[120639,2.5,2],[121799,1.5,2]]),t(121654,0,3,0),f(121871,3,4),
  t(122306,5,5,0),t(122523,2,5,0),t(122668,0,3,0),t(122741,2,5,0),
  t(122958,5,5,0),t(123175,2,5,0),t(123393,2,5,0),t(123610,0,5,0),
  t(123828,0,3,0),t(123973,0,5,0),t(124045,3,4,0),t(124190,1,4,0),
  t(124480,4,5,0),t(124697,3,4,0),t(124770,1,4,0),t(124915,3,4,0),
  t(124987,5,3,0),t(125349,5,5,0),t(125567,2,5,0),t(125784,6,4,0),
  t(125784,0,3,0),t(126002,1,3,0),t(126219,0,3,0),t(126291,3,4,0),
  f(126364,1,4),t(126654,5,4,0),t(126871,5,3,0),t(127089,5,5,0),
  t(127306,4,5,0),t(127523,5,5,0),t(127741,5,3,0),t(127958,5,5,0),
  t(128176,5,4,0),t(128320,4,4,0),t(128393,5,5,0),t(128610,6,1,0),
  t(128683,7,3,0),t(128828,5,4,0),t(129045,2,5,0),t(129263,6,4,0),
  t(129480,5,4,0),t(129697,5,5,0),t(129842,5,4,0),t(130132,5,5,0),
  t(130277,4,5,0),t(130350,6,4,0),t(130567,6,4,0),t(130784,4,5,0),
  t(130929,4,1,0),t(131002,1,4,0),t(131364,0,1,0),t(131437,0,5,0),
  t(131509,3,4,0),t(131726,5,4,0),t(131871,3,4,0),t(132089,1,4,0),
  t(132234,0,4,0),t(132306,1,4,0),h(132668,2,1,133176,0,[[132668,2,1],[132958,1,3],[133176,0,5]]),t(133248,3,3,0),
  t(133466,3,3,0),t(133611,0,4,0),f(133683,3,4),t(134045,3,5,0),
  t(134118,5,4,0),t(134263,5,5,0),t(134480,5,3,0),t(134698,6,4,0),
  t(134842,3,4,0),t(134915,2,8,0),t(134987,2,5,0),t(135132,0,4,0),
  t(135132,7,3,0),t(135350,2,5,0),t(135495,2,3,0),t(135567,3,4,0),
  t(135640,1,3,0),t(135785,2,5,0),t(136002,0,5,0),t(136147,0,4,0),
  t(136219,2,5,0),t(136292,2,3,0),t(136437,2,5,0),t(136509,5,5,0),
  t(136654,5,3,0),t(136727,5,5,0),t(136872,4,5,0),t(137016,6,4,0),
  t(137379,5,3,0),t(137524,3,4,0),t(137741,1,4,0),t(138103,1,4,0),
  t(138176,0,3,0),t(138321,3,3,0),f(138393,0,5),t(138828,5,4,0),
  t(139045,3,3,0),t(139263,5,5,0),t(139408,5,4,0),h(139480,6,4,140132),
  t(140350,0,5,0),t(140567,5,4,0),f(140712,3,3),t(141002,7,3,0),
  t(141147,6,1,0),t(141219,6,4,0),t(141437,4,5,0),t(141582,6,4,0),
  t(141654,3,5,0),t(141727,5,3,0),t(141872,1,3,0),t(142089,3,3,0),
  t(142234,0,4,0),t(142306,1,4,0),t(142451,3,3,0),t(142524,1,4,0),
  t(142741,0,5,0),t(142959,2,1,0),t(143104,0,4,0),t(143176,1,4,0),
  t(143393,0,4,0),t(143611,0,5,0),t(143828,5,4,0),t(143901,4,1,0),
  t(144046,5,5,0),t(144118,3,4,0),t(144263,6,4,0),t(144263,0,3,0),
  t(144408,2,3,0),t(144480,0,3,0),t(144698,0,5,0),t(144843,0,4,0),
  t(144915,2,5,0),t(145133,5,5,0),t(145350,3,3,0),t(145567,3,4,0),
  t(145785,3,4,0),t(145930,3,3,0),t(146002,7,3,0),t(146220,4,5,0),
  t(146437,1,4,0),t(146654,3,4,0),t(146872,0,4,0),t(147089,0,5,0),
  t(147307,1,4,0),t(147524,2,5,0),t(147741,5,4,0),t(147886,4,4,0),
  t(147959,5,5,0),t(148176,5,3,0),t(148249,7,3,0),t(148394,6,4,0),
  t(148828,5,4,0),t(149046,7,3,0),t(149263,5,4,0),t(149481,3,3,0),
  s(149698,150350,[[149698,4,3],[149915,3,3],[150133,1.5,3],[150350,0,3]]),t(149988,6,4,0),t(150568,2,5,0),t(150785,1,3,0),
  t(151002,3,4,0),t(151220,1,4,0),t(151292,4,1,0),t(151437,1,3,0),
  t(151510,5,4,0),t(151655,3,4,0),t(151872,1,4,0),t(151945,0,3,0),
  t(152089,0,3,0),h(152307,1,5,153031,0,[[152307,1,5],[152524,1,4],[152814,2,2],[153031,2,1]]),t(152669,0,4,0),t(153176,0,4,0),
  t(153394,0,5,0),t(153611,1,4,0),t(154046,0,4,0),t(154191,0,5,0),
  s(154263,155423,[[154263,2,4],[154408,2,4],[154553,3,3],[154698,3.5,3],[154843,4,3],[154916,4,3],[154988,4,3],[155061,4,3],[155133,4,2],[155278,4,2],[155423,4,2]]),t(154698,1,4,0),t(154843,0,4,0),t(155133,0,4,0),
  t(155495,0,3,0),t(155785,0,4,0),t(155785,7,3,0),t(156003,3,3,0),
  t(156148,2,1,0),t(156220,3,4,0),f(156655,3,4),
// </six-eternel-beat-v3-expert-notes>
])(mhTap,mhHoldV2,mhFlick,mhSlideV2);
const sixEternelBeatMasterNotes=((t,h,f,s)=>[
// <six-eternel-beat-v3-master-notes>
  t(1939,2,2,0),t(2157,4,2,0),t(2302,6,1,0),t(2447,8,2,0),
  t(2591,6,2,0),f(2736,8,2),t(3026,6,2,0),t(3171,8,1,0),
  t(3244,6,1,0),t(3316,8,2,0),t(3606,6,2,0),t(3823,8,2,0),
  t(3968,6,2,0),t(4113,4,2,0),t(4476,1,1,0),s(4548,5200,[[4548,2,3],[4621,2,2],[4693,1,2],[4765,0.5,2],[4838,0.5,2],[4910,0.5,2],[4983,0.5,2],[5055,1,2],[5128,1.5,2],[5200,3,3]]),
  t(4838,6,2,0),t(5418,3,6,0),s(5490,6070,[[5490,1.5,2],[5708,1.5,2],[5925,2.5,2],[5997,3,3],[6070,3.5,3]],1),t(6505,4,2,0),
  t(6722,0,3,0),t(6867,4,2,0),t(7157,8,2,0),t(7302,4,1,0),
  t(7592,0,4,0),h(8244,2,2,8606),t(8679,4,1,0),t(8751,1,4,0),
  t(8896,4,2,0),t(9258,1,3,0),t(9548,6,1,0),t(9766,3,3,0),
  t(9838,8,2,0),t(10273,4,1,0),t(10345,6,2,0),t(10635,3,4,0),
  f(11142,1,3),t(11432,0,4,0),t(11577,3,3,0),t(11867,0,4,0),
  t(11940,3,3,0),t(12157,5,3,0),t(12229,3,4,0),t(12302,1,3,0),
  t(12592,0,3,0),t(13027,3,3,0),t(13172,5,3,0),h(13461,3,1,14114,1,[[13461,3,1],[13824,2,3],[14114,1,4]]),
  t(14548,0,3,0),t(14621,1,3,0),t(15201,0,1,0),t(15273,2,1,0),
  t(15490,4,2,0),t(15635,2,2,0),t(15708,0,2,0),t(16143,2,1,0),
  h(16215,0,1,16722),t(16795,2,1,0),t(17012,4,1,0),t(17592,2,1,0),
  h(17809,0,3,18462),t(18534,2,1,0),t(18679,5,1,0),t(19186,4,1,0),
  f(19259,8,2),t(19766,5,3,0),t(19838,7,3,0),t(20128,5,4,0),
  t(20128,0,3,0),t(20563,7,3,4),t(20998,1,3,0),t(21143,3,3,0),
  t(21433,5,3,0),t(21578,7,3,0),t(21723,3,3,0),t(21867,7,3,0),
  t(22230,3,3,0),t(22302,7,3,0),t(22375,3,4,0),t(22520,5,3,0),
  t(22737,7,3,0),t(22954,5,3,0),t(23172,3,3,0),t(23244,6,2,0),
  t(23389,3,3,0),t(23607,5,4,0),t(23752,1,3,0),t(23824,5,3,0),
  t(23897,4,1,0),t(24041,1,2,0),t(24041,5,2,0),t(24259,4,2,0),
  t(24259,0,2,0),t(24476,1,2,0),t(24476,5,2,0),t(24694,4,2,0),
  t(24694,8,2,0),t(24911,5,3,0),t(24911,0,3,0),f(25128,4,2),
  t(25563,6,2,0),t(25636,4,2,0),t(25781,5,3,0),t(25926,7,3,0),
  t(25998,5,3,0),t(26071,4,2,0),t(26360,1,4,0),t(26433,0,2,0),
  t(26650,3,4,0),t(26723,2,2,0),t(27085,5,4,0),t(27302,3,3,0),
  t(27520,6,4,0),t(27592,4,1,0),t(27955,5,3,0),h(28172,1,4,28752),
  t(28824,2,4,0),t(28897,1,3,0),t(29259,0,3,0),t(29332,2,3,0),
  t(29404,0,4,0),t(29476,2,2,0),t(29694,0,3,0),t(29839,2,1,0),
  t(29911,3,4,0),t(30056,5,3,0),t(30129,3,4,0),f(30274,2,2),
  t(30563,0,4,0),t(30636,2,6,0),t(30781,0,3,0),t(30853,4,2,0),
  t(30926,1,4,0),t(30998,0,3,0),t(31216,1,4,0),t(31433,2,4,0),
  t(31506,1,3,0),t(31650,0,1,0),t(31868,1,4,0),t(32230,0,1,0),
  t(32303,0,4,0),t(32737,1,3,0),t(32810,4,1,0),t(32955,0,2,0),
  t(32955,4,2,0),t(33172,1,2,0),t(33172,5,2,0),t(33390,3,2,0),
  t(33390,7,2,0),t(33607,4,2,0),t(33607,8,2,0),h(34042,5,4,34694),
  t(34911,5,3,0),t(34984,7,3,0),t(35346,5,3,1),t(35781,6,4,0),
  f(35926,6,2),t(36216,7,3,0),t(36433,4,2,0),h(36651,6,4,37158,1,[[36651,6,4],[36940,7,3],[37158,8,1]]),
  t(37520,1,4,0),t(37665,4,2,0),t(37738,6,2,0),h(37955,6,4,38462),
  t(38535,5,4,0),t(38607,8,2,0),t(38825,5,3,0),t(38897,7,3,0),
  t(39259,3,3,0),t(39332,6,2,0),t(39404,3,3,0),t(39694,1,3,0),
  t(39694,6,3,0),s(39839,40491,[[39839,0.5,3],[40057,0.5,2],[40201,0.5,2],[40346,1.5,2],[40419,2,2],[40491,2.5,2]]),t(40129,2,3,0),t(40564,0,3,0),
  t(40636,1,3,0),t(40854,0,3,0),t(40999,3,3,0),t(41216,1,3,0),
  t(41288,5,4,0),t(41433,1,3,0),t(41868,3,4,0),t(41941,5,3,0),
  t(42086,2,2,0),t(42086,6,2,0),t(42303,2,2,0),t(42303,7,2,0),
  t(42520,1,2,0),t(42520,7,2,0),t(42738,1,2,0),t(42738,8,2,0),
  t(42883,6,1,0),t(42955,2,2,0),f(43173,3,3),t(43535,1,3,0),
  h(43607,3,4,44187),t(44260,5,3,0),t(44477,3,4,0),t(44694,2,2,0),
  t(44767,0,2,0),t(44839,4,1,0),t(44912,1,3,0),h(45129,2,4,45854,1),
  t(45419,1,3,0),t(45564,4,2,0),t(46216,1,4,0),t(46651,1,2,0),
  t(46651,5,2,0),t(46868,4,2,0),t(46868,8,2,0),t(47086,1,2,0),
  t(47086,5,2,0),t(47303,4,2,0),t(47303,8,2,0),t(47521,3,3,0),
  f(47593,5,4),t(47955,6,4,0),t(48028,5,3,0),t(48173,8,2,0),
  t(48390,5,4,0),t(48608,4,2,0),t(48825,1,4,0),t(48897,0,3,0),
  t(49042,0,3,0),t(49115,1,3,0),t(49260,3,3,0),t(49477,1,4,0),
  t(49550,0,4,0),t(49695,1,4,0),t(49912,3,4,0),t(50057,6,1,0),
  t(50129,1,3,0),t(50347,3,4,0),t(50564,5,4,0),t(50782,6,4,0),
  t(50999,7,3,0),t(51071,6,1,0),t(51216,1,4,0),t(51216,7,3,0),
  t(51434,5,4,0),s(51651,52811,[[51651,3,3],[51796,2,3],[52013,1,3],[52376,1,3],[52811,0.5,3]]),t(52303,3,4,0),t(52521,4,6,0),
  t(52956,8,2,0),t(53173,6,2,0),t(53245,3,3,0),t(53390,5,3,0),
  t(53608,3,4,0),t(53825,5,3,0),t(53898,3,3,0),t(53970,2,3,0),
  f(54043,0,4),t(54405,0,3,0),t(54477,3,3,0),t(54622,4,3,0),
  t(54695,3,3,0),t(54912,1,4,0),t(54912,7,3,0),s(55130,56289,[[55130,1,3],[55274,1,3],[55419,1.5,2],[55564,2,2],[55709,2.5,2],[55782,3,2],[55854,3,2],[55999,1,2],[56144,1,2],[56289,2.5,2]],1),
  t(55564,1,3,0),t(55782,1,4,0),t(55999,5,1,0),t(56651,6,4,0),
  t(56724,6,2,0),f(57014,7,3),t(57304,5,3,0),t(57521,3,4,0),
  t(57738,6,2,0),t(57811,3,3,0),t(57956,2,3,0),t(58028,0,3,0),
  t(58173,0,2,0),t(58173,4,2,0),t(58391,1,2,0),t(58391,5,2,0),
  t(58608,3,2,0),t(58608,7,2,0),t(58825,4,2,0),t(58825,8,2,0),
  t(59043,3,3,0),h(59260,8,1,59912,0,[[59260,8,1],[59622,6,4],[59912,8,1]]),t(60130,5,4,0),t(60347,7,3,0),
  t(60492,5,3,0),t(60564,6,4,0),t(60782,2,2,0),t(60782,6,2,0),
  t(60999,2,2,0),t(60999,7,2,0),t(61217,1,2,0),t(61217,7,2,0),
  t(61434,1,2,0),t(61434,8,2,0),t(61651,5,4,0),t(61869,1,4,0),
  t(61869,7,3,0),t(62086,1,3,0),t(62159,3,3,0),t(62304,5,3,0),
  h(62521,3,4,63318),t(62956,7,3,0),t(63391,0,4,0),t(63608,0,2,0),
  t(63681,3,3,0),t(63825,7,3,0),t(63825,2,3,0),t(63970,7,3,0),
  t(64043,6,2,0),t(64115,8,2,0),t(64478,5,4,0),t(64550,2,2,0),
  t(64912,3,4,0),t(65057,5,3,0),t(65275,7,3,0),f(65347,5,3),
  t(65637,7,3,0),t(65710,6,2,0),t(65782,7,3,0),t(65999,6,4,0),
  t(66072,5,3,0),t(66217,4,2,0),t(66434,1,4,0),t(66507,0,3,0),
  t(66652,0,2,0),t(66869,2,2,0),t(67086,0,3,0),t(67159,1,3,0),
  t(67376,3,3,0),t(67449,5,3,0),t(67521,4,2,0),t(67884,2,2,0),
  t(67956,0,2,0),t(68391,3,4,0),t(68463,1,3,0),t(68826,5,4,0),
  t(68826,0,3,0),t(69043,8,2,0),t(69260,5,3,0),t(69695,6,4,0),
  t(69985,5,3,0),f(70130,3,3),t(70420,0,2,0),t(70565,3,4,0),
  h(70782,6,4,71507),t(71652,6,4,0),s(71869,72377,[[71869,3,3],[71942,3,2],[72014,3,2],[72087,1,2],[72159,1,2],[72232,3,2],[72304,3.5,2],[72377,3.5,3]]),t(72594,2,2,0),
  t(72739,3,3,0),t(72884,5,3,0),t(72956,7,2,0),t(73101,3,3,0),
  h(73174,6,4,73753,1,[[73174,6,4],[73463,8,1],[73753,6,4]]),t(74043,0,6,0),t(74188,4,1,0),t(74261,6,2,0),
  t(74478,7,3,0),t(74695,4,2,0),t(74913,5,4,0),h(75203,8,2,75637),
  h(75782,5,3,76362),t(76435,2,3,0),s(76652,77304,[[76652,0,2],[76869,0.5,2],[77087,2.5,2],[77304,4,2]]),t(77522,1,4,0),
  t(77667,0,3,0),t(77739,2,2,0),t(77956,0,4,0),t(78174,1,3,0),
  t(78174,6,3,0),t(78391,2,4,0),h(78464,1,3,79116),t(78826,0,3,2),
  t(79261,0,2,0),f(79333,3,3),t(79696,6,4,0),t(79768,3,3,0),
  t(79841,5,3,0),t(79913,6,4,0),t(80130,4,2,0),t(80275,4,1,0),
  t(80348,0,3,0),t(80420,1,3,0),t(80565,0,2,0),t(80783,1,4,0),
  t(80855,0,3,0),t(81000,0,2,0),t(81217,0,3,0),t(81435,0,2,0),
  t(81507,1,4,0),t(81652,0,3,0),t(81870,2,2,0),t(82087,0,2,0),
  t(82159,1,4,0),t(82304,3,3,0),t(82739,1,4,0),t(82812,0,4,0),
  s(83174,83826,[[83174,0,2],[83391,2,2],[83609,3.5,2],[83826,1.5,2]]),f(83536,7,3),t(84044,5,3,0),t(84261,7,3,0),
  t(84478,5,3,0),t(84696,8,2,0),t(84768,6,1,0),t(84841,8,1,0),
  t(84913,3,4,0),t(85131,6,2,0),t(85276,8,1,0),t(85348,5,4,0),
  s(85638,86797,[[85638,2,2],[85783,3,2],[85928,3,2],[86073,3.5,3],[86218,3.5,3],[86362,4,3],[86435,4,3],[86507,3.5,2],[86580,3.5,2],[86652,2.5,2],[86797,2.5,2]]),t(86218,0,4,0),t(86435,3,4,0),t(86870,8,1,0),
  t(87015,3,3,0),t(87087,5,4,0),t(87522,1,3,0),t(87594,3,3,0),
  t(87667,0,4,0),f(87812,0,2),t(88174,2,2,0),t(88392,0,3,0),
  t(88609,2,2,0),t(88826,3,4,0),t(88899,5,3,0),t(89044,1,4,0),
  t(89044,7,3,0),t(89261,2,3,0),t(89479,2,2,0),t(89696,0,4,0),
  t(89913,2,2,0),t(89986,0,2,0),t(90131,1,4,0),t(90203,3,3,0),
  t(90348,6,2,0),t(90566,6,4,0),t(90783,4,2,0),t(90928,5,4,0),
  t(91000,6,4,0),t(91073,5,3,0),t(91218,7,3,0),t(91435,5,4,0),
  t(91653,4,2,0),t(91870,5,3,0),t(92087,8,2,0),t(92087,4,2,0),
  t(92305,5,4,0),t(92522,7,3,0),t(92667,6,2,0),t(92740,7,3,0),
  t(93174,5,3,0),t(93609,3,3,0),t(93754,1,3,0),t(93827,0,3,0),
  t(94044,3,4,0),t(94261,0,3,0),t(94334,3,3,0),t(94479,3,4,0),
  t(94551,6,2,0),t(94696,7,3,0),t(94914,6,2,0),s(95131,95566,[[95131,3,2],[95203,3,2],[95276,3.5,3],[95348,4,3],[95421,4,3],[95493,2.5,2],[95566,1.5,2]]),
  t(95783,0,6,0),f(96218,3,4),t(96653,6,2,0),t(96870,8,1,0),
  t(97088,3,3,0),t(97160,6,1,0),s(97377,97957,[[97377,1.5,3],[97450,1.5,2],[97522,1.5,2],[97595,1.5,2],[97667,2,2],[97740,0.5,2],[97812,2,2],[97885,2,2],[97957,2.5,3]]),s(97377,97957,[[97377,3,2],[97957,4,2]]),
  t(98102,0,2,0),t(98392,0,4,0),t(98537,4,2,0),t(98827,1,4,0),
  t(98899,0,3,0),t(99044,2,2,0),t(99262,0,4,0),t(99479,4,2,0),
  t(99696,7,3,0),t(99914,3,3,0),t(100131,1,4,0),t(100204,0,3,0),
  t(100348,2,2,0),t(100566,0,3,0),t(100638,1,3,0),t(100783,4,2,0),
  t(101001,2,2,0),f(101073,0,3),t(101435,0,3,0),t(101653,1,4,0),
  t(101870,0,2,0),t(102015,2,2,0),h(102088,0,2,102740),h(102957,0,3,103682,1),
  t(104044,1,3,0),t(104117,3,3,0),t(104189,6,2,0),t(104262,8,2,0),
  t(104479,5,4,0),t(104552,7,3,0),t(104696,6,2,0),t(104914,6,4,0),
  t(104986,3,3,0),t(105349,6,2,0),t(105566,8,2,0),t(105783,5,3,0),
  t(106001,5,4,0),t(106218,5,4,0),t(106436,7,3,0),t(106653,6,4,0),
  t(106870,3,4,0),t(107088,8,2,0),t(107305,3,3,0),t(107523,6,2,0),
  t(107740,7,3,0),t(107957,6,2,0),f(108175,1,3),t(108610,3,3,0),
  t(108682,5,3,0),t(108827,8,2,0),t(108827,4,2,0),t(109044,4,2,0),
  t(109117,0,3,0),t(109262,4,2,0),t(109334,0,3,0),t(109479,4,2,0),
  t(109697,2,2,0),t(109697,6,2,0),t(109914,4,2,0),t(109914,8,2,0),
  t(110131,1,3,0),t(110349,0,2,0),t(110566,1,3,0),t(110639,5,3,0),
  t(110711,4,1,0),t(110784,6,4,0),t(111001,7,3,0),t(111218,5,4,0),
  t(111436,3,3,0),t(111581,6,2,0),t(111871,7,3,0),t(111943,3,3,0),
  t(112016,5,4,0),t(112088,2,1,0),t(112305,0,4,0),s(112740,113537,[[112740,2,3],[112813,1,3],[112885,1,3],[112958,1,2],[113030,1,2],[113103,0.5,2],[113175,0.5,2],[113247,0.5,2],[113320,0,2],[113392,0.5,2],[113465,0,2],[113537,0.5,2]]),
  f(113175,2,3),t(113610,3,3,0),t(113827,5,4,0),t(114045,6,4,0),
  t(114262,6,2,0),t(114407,7,3,0),t(114479,5,3,0),t(114697,3,4,0),
  t(114842,4,1,0),t(114914,5,3,0),t(115059,3,3,0),t(115132,6,4,0),
  t(115349,7,3,0),t(115494,6,2,0),t(115566,6,4,0),t(115784,5,3,0),
  t(116001,6,4,0),t(116219,4,6,0),t(116436,6,2,0),t(116653,3,3,0),
  t(117088,1,4,3),t(117523,0,3,0),t(117595,1,3,0),t(117740,3,4,0),
  t(117958,3,4,0),t(118030,7,3,0),t(118175,5,3,0),t(118393,7,3,0),
  t(118538,5,3,0),t(118682,6,4,0),f(118827,5,3),s(119262,120204,[[119262,0.5,2],[119480,0,2],[119697,0.5,2],[119914,2,2],[120132,3.5,2],[120204,4,2]]),
  t(119697,5,4,0),t(119914,8,2,0),h(120349,7,1,121509,0,[[120349,7,1],[120639,6,2],[120929,5,3],[121219,5,3],[121509,4,4]]),t(120784,8,2,0),
  t(121001,6,4,0),t(121219,7,3,0),t(121654,0,2,0),t(121871,3,3,0),
  t(122306,6,4,0),t(122523,3,4,0),t(122668,0,2,0),t(122741,3,4,0),
  t(122958,6,4,0),t(123175,1,4,0),t(123175,7,3,0),t(123393,0,4,0),
  t(123610,1,4,0),t(123828,4,2,0),t(123973,1,4,0),t(124045,3,3,0),
  t(124190,1,3,0),t(124480,5,4,0),t(124697,3,3,0),t(124770,0,3,0),
  t(124915,3,3,0),f(124987,0,2),t(125349,5,4,0),t(125567,1,4,0),
  t(125784,3,3,0),t(126002,0,2,0),t(126219,0,2,0),t(126291,3,3,0),
  t(126364,1,3,0),t(126654,5,3,0),t(126871,2,2,0),t(127089,3,4,0),
  t(127306,5,4,0),t(127523,6,4,0),t(127741,6,2,0),t(127958,6,4,0),
  t(128176,5,3,0),t(128320,7,3,0),t(128393,5,4,0),t(128610,2,1,0),
  t(128683,4,2,0),t(128828,0,3,0),t(129045,0,4,0),t(129263,0,3,0),
  t(129480,0,3,0),t(129697,3,4,0),t(129842,1,3,0),t(130132,5,4,0),
  t(130277,3,4,0),t(130350,7,3,0),t(130567,7,3,0),t(130784,5,4,0),
  t(130929,8,1,0),f(131002,5,3),t(131364,2,1,0),t(131437,3,4,0),
  t(131509,5,3,0),t(131726,7,3,0),t(131871,3,3,0),t(132089,1,3,0),
  t(132234,0,3,0),t(132306,1,3,0),h(132668,0,4,133176,0,[[132668,0,4],[132958,0,3],[133176,1,1]]),t(133248,6,2,0),
  t(133466,4,2,0),t(133611,0,3,0),t(133683,3,3,0),t(134045,6,4,0),
  t(134118,5,3,0),t(134263,6,4,0),t(134480,6,2,0),t(134698,7,3,0),
  t(134842,3,3,0),t(134915,5,4,0),t(134987,3,4,0),t(135132,1,3,0),
  t(135132,6,3,0),t(135350,3,4,0),t(135495,2,2,0),t(135567,0,3,0),
  t(135640,2,2,0),t(135785,3,4,0),t(136002,1,4,0),t(136002,7,3,0),
  t(136147,5,3,0),t(136219,0,6,0),t(136292,4,2,0),t(136437,5,4,0),
  t(136509,6,4,0),t(136654,6,2,0),t(136727,3,4,0),t(136872,1,4,0),
  f(137016,0,3),t(137379,2,2,0),t(137524,0,3,0),t(137741,1,3,0),
  t(138103,0,3,0),t(138176,2,2,0),t(138321,4,2,0),t(138393,5,4,0),
  t(138828,7,3,0),t(139045,6,2,0),t(139263,6,4,0),t(139408,3,3,0),
  h(139480,7,3,140132),t(140350,1,4,0),t(140567,5,3,0),f(140712,4,2),
  t(141002,8,2,0),t(141147,6,1,0),t(141219,7,3,0),t(141437,5,4,0),
  t(141582,7,3,0),t(141654,5,4,0),t(141727,4,2,0),t(141872,2,2,0),
  t(142089,4,2,0),t(142234,1,3,0),t(142306,3,3,0),t(142451,5,2,0),
  t(142524,3,3,0),t(142741,1,4,0),t(142959,6,1,0),t(143104,3,3,0),
  t(143176,1,3,0),t(143393,0,3,0),t(143611,1,4,0),t(143828,5,3,0),
  t(143901,4,1,0),t(144046,6,4,0),t(144118,3,3,0),t(144263,5,3,0),
  t(144408,2,2,0),t(144480,4,2,0),t(144698,0,4,0),t(144843,0,3,0),
  t(144915,3,4,0),t(145133,6,4,0),t(145350,4,2,0),t(145567,3,3,0),
  t(145785,1,3,0),t(145930,0,2,0),t(146002,2,2,0),t(146220,5,4,0),
  t(146437,1,3,0),t(146654,3,3,0),t(146872,0,3,0),t(147089,0,4,0),
  t(147307,1,3,0),t(147524,0,4,0),t(147741,1,3,0),t(147886,3,3,0),
  t(147959,4,4,0),t(148176,4,2,0),t(148249,2,2,0),f(148394,5,3),
  t(148828,1,3,0),t(148828,6,3,0),t(149046,4,2,0),t(149263,0,3,0),
  t(149481,0,2,0),s(149698,150350,[[149698,4,2],[149915,3,2],[150133,1.5,2],[150350,0,2]]),t(149988,0,3,0),t(150568,1,4,0),
  t(150785,0,2,0),t(151002,3,3,0),t(151220,0,3,0),t(151292,4,1,0),
  t(151437,4,2,0),t(151510,5,3,0),t(151655,3,3,0),t(151872,1,3,0),
  t(151945,0,2,0),t(152089,0,2,0),h(152307,1,1,153031,0,[[152307,1,1],[152524,0,3],[152814,0,3],[153031,1,1]]),t(152669,1,3,0),
  t(153176,1,3,0),t(153394,5,4,0),t(153611,3,3,0),t(154046,1,3,0),
  t(154191,3,4,0),s(154263,155423,[[154263,3,3],[154408,3,3],[154553,4,2],[154698,4,2],[154843,4,2],[154916,4,2],[154988,4,2],[155061,4,2],[155133,4,2],[155278,4,2],[155423,4,2]]),t(154698,1,3,0),t(154843,0,3,0),
  t(155495,0,2,0),t(155785,1,3,0),t(155785,6,3,0),t(156003,4,2,0),
  t(156148,2,1,0),t(156220,3,3,0),f(156655,7,3),
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
  t(2559,5,3,0),t(4035,0,10,0),t(4773,4,6,0),h(5880,6,3,6710,0,[[5880,6,3],[6341,5,4],[6710,4,6]]),
  t(7724,2,6,0),t(8462,2,6,0),t(9200,4,6,0),h(9938,5,4,11413),
  t(12151,6,4,0),h(13627,4,6,15102),t(15840,2,6,0),t(16209,4,6,0),
  h(16578,2,6,18054),t(19529,0,6,0),t(19898,0,3,0),t(19898,7,3,0),
  h(20267,0,6,21282),t(21743,3,4,0),t(22112,4,6,0),t(22480,2,6,0),
  t(23218,0,6,0),t(23587,3,4,0),t(23956,4,6,0),t(25063,0,4,0),
  t(25432,1,4,0),t(25801,3,4,0),t(26538,4,6,0),t(26907,4,6,0),
  t(28383,4,6,0),t(28567,4,6,0),t(28936,5,4,0),t(29121,4,6,0),
  t(29859,4,6,0),t(30596,2,6,0),t(30781,0,6,0),t(31334,0,6,0),
  t(32072,0,6,1),t(32441,2,6,0),t(32810,0,6,0),t(33917,3,4,0),
  t(35023,0,6,0),t(35392,2,6,0),t(35761,1,4,0),t(36499,2,6,0),
  t(36868,4,6,0),h(37237,2,6,38528),t(38713,0,6,0),h(39819,0,4,41110),
  t(41295,0,4,0),t(41664,0,10,0),t(42771,3,4,0),t(43508,0,6,0),
  t(44246,0,4,0),t(45353,0,6,0),t(45722,1,4,0),t(46091,2,6,0),
  t(46829,4,6,0),t(47197,6,4,0),t(48304,4,6,0),t(48673,5,4,0),
  t(49042,2,6,0),t(49780,4,6,0),t(50149,6,4,0),t(51255,4,6,0),
  t(51624,5,4,0),t(51993,4,6,0),t(53100,5,4,0),t(54022,2,6,0),
  t(54207,0,6,0),h(54945,0,6,56236,0,[[54945,0,6],[55313,0,6],[55590,1,4],[55959,1,4],[56236,2,3]]),t(56420,0,6,0),t(57158,2,6,0),
  t(57527,7,3,0),t(57527,0,3,0),t(58449,3,4,0),t(58634,4,6,0),
  t(59003,4,6,0),t(59371,4,6,0),t(60109,4,6,0),t(60478,5,4,0),
  t(60847,2,6,2),t(61216,4,6,0),t(61954,6,4,0),t(62323,5,4,0),
  t(62876,0,6,0),t(63061,2,6,0),t(63429,5,4,0),t(63798,6,4,0),
  t(64905,6,4,0),t(65274,6,4,0),t(66750,4,6,0),t(67119,6,4,0),
  t(67487,4,6,0),t(67856,4,6,0),t(68410,2,6,0),t(69332,1,4,0),
  t(69701,2,6,0),t(70439,0,10,0),t(70808,3,4,0),t(71177,4,6,0),
  t(71914,2,6,0),t(72283,1,4,0),t(72652,2,6,0),t(73206,1,4,0),
  t(73390,0,6,0),t(73759,0,3,0),t(73759,7,3,0),t(74128,0,6,0),
  t(74866,0,6,0),h(75604,4,3,76895,0,[[75604,4,3],[75972,3,4],[76249,2,6],[76618,3,4],[76895,4,3]]),t(77079,4,6,0),t(77817,4,6,0),
  t(78186,3,4,0),t(78555,4,6,0),t(78924,5,4,0),t(79662,3,4,0),
  t(80399,1,4,0),h(80584,0,4,81598),t(82059,0,4,0),t(82613,1,4,0),
  t(82982,0,6,0),t(83351,0,6,0),t(83720,0,6,0),h(84088,1,4,85380),
  t(85564,3,4,0),t(85933,0,6,0),t(86671,2,6,0),t(87040,1,4,0),
  t(87409,2,6,0),t(87962,1,4,0),t(88515,0,4,0),t(88884,1,4,0),
  t(89438,3,4,0),t(89622,0,6,0),t(89991,3,4,0),t(90360,4,6,3),
  t(90913,6,4,0),t(91098,4,6,0),t(91467,4,6,0),t(91651,2,6,0),
  t(92204,1,4,0),t(92942,0,4,0),t(93865,0,4,0),t(94049,0,6,0),
  t(94418,0,4,0),t(95525,0,10,0),t(95894,0,3,0),t(95894,7,3,0),
  t(96262,0,6,0),t(96816,0,4,0),t(97000,0,6,0),t(97369,0,4,0),
  t(97738,0,6,0),t(98476,0,6,0),t(98845,1,4,0),t(99214,0,6,0),
  t(99952,4,6,0),t(100320,2,6,0),t(100689,0,6,0),t(101243,0,4,0),
  t(101427,0,6,0),t(101796,1,4,0),h(102903,2,6,104286,0,[[102903,2,6],[103272,3,4],[103641,4,3],[103917,3,4],[104286,2,6]]),t(105670,2,6,0),
  t(106039,4,6,0),t(106592,4,6,0),t(107699,4,6,0),t(108990,2,6,0),
  t(109543,5,4,0),t(109912,3,4,0),t(110650,5,4,0),t(111388,4,6,0),
  t(112126,6,4,0),t(112495,4,6,0),h(113232,4,6,114708),t(115077,1,4,0),
  t(115446,3,4,0),t(115815,5,4,0),t(116553,6,4,0),t(116921,5,4,0),
  t(117290,5,4,0),t(118766,6,4,0),t(119135,4,6,0),t(119504,3,4,4),
  t(119873,0,6,0),t(120242,0,6,0),t(120611,0,6,0),t(120979,1,4,0),
  t(121717,0,3,0),t(121717,7,3,0),t(122086,0,6,0),t(122455,3,4,0),
  t(122824,5,4,0),t(123562,6,4,0),t(123931,5,4,0),t(124669,6,4,0),
  t(125037,5,4,0),t(125406,6,4,0),t(125591,0,10,0),t(126144,4,6,0),
  t(126882,3,4,0),t(127066,5,4,0),t(127435,3,4,0),t(127989,5,3,0),
  t(128358,6,4,0),t(128727,4,6,0),t(129464,4,6,0),t(129833,6,4,0),
  t(130202,4,6,0),t(130756,4,6,0),t(130940,4,6,0),t(131309,5,4,0),
  t(132416,0,6,0),t(132785,3,4,0),t(133153,5,4,0),t(133338,6,4,0),
  t(133891,4,6,0),t(134076,2,6,0),h(134629,2,3,135828,0,[[134629,2,3],[134998,0,6],[135459,1,4],[135828,2,3]]),t(136105,0,6,0),
  t(136474,0,6,0),t(136843,0,6,0),t(137211,1,4,0),t(138318,0,6,0),
  t(138503,0,6,0),t(139056,0,6,0),t(139425,0,6,0),t(139794,0,4,0),
  t(140163,1,4,0),t(140532,3,4,0),t(140901,7,3,0),t(140901,0,3,0),
  t(141454,6,4,0),t(142192,4,6,0),t(142561,4,6,0),t(144221,2,6,0),
  t(144959,4,6,0),t(145328,2,6,0),t(146434,1,4,0),t(146619,0,4,0),
  t(147172,0,6,0),t(147910,0,6,0),t(148094,0,6,0),t(148648,0,10,0),
// </six-eternel-remix-beat-v3-easy-notes>
])(mhTap,mhHoldV2,mhFlick,mhSlideV2);
const sixEternelRemixBeatNormalNotes=((t,h,f,s)=>[
// <six-eternel-remix-beat-v3-normal-notes>
  t(2559,6,2,0),t(4035,0,10,0),f(4773,4,6),t(5511,3,3,0),
  h(5880,2,2,6710,1,[[5880,2,2],[6341,1,4],[6710,0,6]]),t(7724,0,6,0),t(8462,0,6,0),t(9200,0,6,0),
  h(9938,0,3,11413),t(12151,1,3,0),t(12335,2,6,0),h(13627,4,6,15102),
  t(15840,2,6,0),t(16209,4,6,0),h(16578,4,6,18054),t(18422,4,6,0),
  t(19529,2,6,0),t(19898,0,3,0),t(19898,7,3,0),h(20267,0,6,21282,1),
  t(21743,1,3,0),t(22112,2,6,0),t(22480,4,6,0),t(23218,2,6,0),
  f(23587,3,3),t(23956,4,6,0),t(24694,0,3,0),t(24694,7,3,0),
  t(25063,1,3,0),t(25432,3,3,0),t(25801,1,3,0),t(26538,2,6,0),
  t(26907,4,6,0),t(27645,1,4,0),t(28383,4,6,0),t(28936,3,4,0),
  t(29121,4,6,0),t(29859,4,6,0),t(30412,2,6,0),t(30596,0,6,0),
  t(30781,0,6,0),t(31334,0,6,0),t(32072,2,6,1),t(32441,4,6,0),
  t(32810,4,6,0),t(33179,2,6,0),f(33917,6,4),t(35023,0,6,0),
  t(35392,2,6,0),t(35761,6,4,0),t(36499,2,6,0),t(36868,0,6,0),
  h(37237,2,6,38528),t(38713,2,6,0),t(39450,0,6,0),h(39819,0,4,41110),
  t(41295,0,4,0),t(41664,0,10,0),t(42771,3,4,0),t(43508,0,6,0),
  t(44246,3,4,0),t(44431,1,4,0),t(45353,0,6,0),t(45722,1,4,0),
  t(46091,2,6,0),t(46829,4,6,0),f(47197,6,4),t(48304,4,6,0),
  t(48673,5,4,0),t(49042,2,6,0),t(49780,4,6,0),t(50149,6,4,0),
  t(51071,5,4,0),t(51255,2,6,0),t(51624,1,4,0),t(51993,0,6,0),
  t(52731,0,6,0),t(53100,5,4,0),t(54022,2,6,0),t(54207,4,6,0),
  h(54945,4,6,56236,0,[[54945,4,6],[55313,5,4],[55590,5,4],[55959,6,3],[56236,6,2]]),t(56420,0,6,0),t(57158,2,6,0),t(57527,7,3,0),
  t(57527,0,3,0),t(58449,5,4,0),t(58634,4,6,0),t(59003,0,6,0),
  t(59187,5,4,0),f(59371,2,6),t(60109,4,6,0),t(60478,3,4,0),
  t(60847,4,6,2),t(61216,4,6,0),t(61585,5,3,0),t(61954,3,4,0),
  t(62323,0,3,0),t(62323,7,3,0),t(62876,0,6,0),t(63061,0,6,0),
  t(63429,0,4,0),t(63798,1,4,0),t(64905,3,4,0),t(65274,6,4,0),
  t(65643,6,4,0),t(66750,4,6,0),t(67119,6,4,0),t(67487,4,6,0),
  t(67856,4,6,0),f(68410,4,6),t(69332,3,4,0),t(69701,4,6,0),
  t(70254,3,4,0),t(70439,0,10,0),t(70808,6,4,0),t(71177,4,6,0),
  t(71914,2,6,0),t(72283,1,3,0),t(72652,0,6,0),t(73206,1,4,0),
  t(73390,0,6,0),t(73759,1,4,0),t(74128,2,6,0),t(74866,4,6,0),
  t(75235,6,4,0),h(75604,6,2,76895,0,[[75604,6,2],[75972,5,4],[76249,4,6],[76618,5,4],[76895,6,2]]),t(77079,4,6,0),t(77817,4,6,0),
  t(78186,3,4,0),f(78555,4,6),t(78924,5,4,0),t(79293,4,6,0),
  t(80399,3,3,0),h(80584,7,3,81598),t(81875,0,3,0),t(82059,1,4,0),
  t(82428,3,4,0),t(82613,5,4,0),t(83351,4,6,0),t(83720,4,6,0),
  h(84088,6,4,85380),t(85564,0,4,0),t(85933,0,6,0),t(86302,3,4,0),
  t(86671,4,6,0),t(87040,6,4,0),t(87409,4,6,0),t(87962,3,4,0),
  h(88515,1,4,89438),t(89622,0,6,0),f(89991,1,4),t(90360,2,6,3),
  t(90913,1,4,0),t(91098,0,6,0),t(91467,0,6,0),t(91651,0,6,0),
  t(91836,0,6,0),t(92204,0,4,0),t(92942,0,4,0),t(93865,0,4,0),
  t(94049,0,6,0),t(94418,1,4,0),t(94787,0,6,0),t(95525,2,6,0),
  t(95894,6,4,0),t(96262,4,6,0),t(96816,5,3,0),t(97000,0,10,0),
  t(97369,7,3,0),t(97369,0,3,0),t(97738,2,6,0),t(98291,1,4,0),
  f(98476,2,6),t(98845,1,4,0),t(99214,0,6,0),t(99767,1,4,0),
  t(99952,2,6,0),t(100320,4,6,0),t(100689,0,6,0),t(101427,4,6,0),
  t(101796,3,4,0),h(102534,4,6,104010,0,[[102534,4,6],[102903,6,4],[103272,7,2],[103641,6,4],[104010,4,6]]),t(104194,3,3,0),t(104378,7,3,0),
  t(105301,4,6,0),t(105670,4,6,0),t(106039,4,6,0),t(106592,4,6,0),
  t(107699,4,6,0),t(108990,0,6,0),t(109543,3,3,0),f(109912,5,4),
  t(110650,6,4,0),t(111388,0,6,0),t(111757,2,6,0),t(112126,7,3,0),
  t(112495,2,6,0),h(113232,4,6,114708,1),t(115077,3,3,0),t(115446,5,3,0),
  t(115815,6,4,0),t(116553,7,3,0),t(116553,0,3,0),t(116921,3,3,0),
  t(117290,1,3,0),t(117475,0,6,0),t(117659,1,3,0),t(118766,0,3,0),
  t(119135,2,6,0),t(119504,1,4,4),t(119873,4,6,0),t(120242,2,6,0),
  t(120611,4,6,0),f(120979,3,4),t(121348,6,4,0),t(121717,5,4,0),
  t(122086,0,6,0),t(122455,3,4,0),t(122824,0,3,0),t(123562,0,4,0),
  t(123931,1,4,0),t(124669,3,3,0),t(125037,5,3,0),t(125406,6,4,0),
  t(125591,0,10,0),t(125775,4,6,0),t(126144,4,6,0),t(126513,6,4,0),
  t(126882,3,3,0),t(127066,5,4,0),t(127435,7,3,0),h(127989,6,2,128911),
  t(129095,1,3,0),f(129464,4,6),t(129833,3,4,0),t(130202,0,6,0),
  t(130756,4,6,0),t(130940,2,6,0),t(131309,7,3,0),t(131309,0,3,0),
  t(131678,2,6,0),t(132231,5,4,0),t(132416,2,6,0),t(132785,5,3,0),
  t(133338,0,4,0),t(133522,0,3,0),t(133891,0,6,0),t(134076,0,6,0),
  t(134260,0,3,0),h(134629,4,2,135828,0,[[134629,4,2],[134998,3,4],[135459,3,4],[135828,4,2]]),t(136105,0,6,0),t(136474,2,6,0),
  t(137211,5,3,0),t(137580,4,6,0),t(138318,4,6,0),t(138503,2,6,0),
  f(138687,1,4),t(139056,0,6,0),t(139425,0,6,0),t(139794,1,3,0),
  t(140163,3,3,0),t(140532,1,4,0),t(140901,3,4,0),t(141454,7,3,0),
  t(142192,4,6,0),t(142561,4,6,0),t(143298,5,3,0),t(144221,2,6,0),
  t(144959,4,6,0),t(145328,2,6,0),t(146434,5,3,0),t(146619,3,3,0),
  t(146803,0,3,0),t(146803,7,3,0),t(147172,0,6,0),t(147910,0,6,0),
  f(148094,0,6),t(148648,0,10,0),
// </six-eternel-remix-beat-v3-normal-notes>
])(mhTap,mhHoldV2,mhFlick,mhSlideV2);
const sixEternelRemixBeatHardNotes=((t,h,f,s)=>[
// <six-eternel-remix-beat-v3-hard-notes>
  t(2283,1,3,0),t(2559,6,1,0),f(2928,7,3),t(4035,2,8,0),
  t(4773,2,5,0),t(5511,1,3,0),h(5880,4,1,6710,1,[[5880,4,1],[6341,3,3],[6710,2,5]]),t(7078,3,3,0),
  t(7355,4,5,0),h(7724,2,5,8277),t(8462,0,5,0),t(9200,2,5,0),
  s(9938,11413,[[9938,3,4],[10122,1.5,4],[10214,1,4],[10399,1,4],[10860,1.5,4],[11413,1.5,4]]),t(12151,7,3,0),t(12335,5,5,0),h(13627,4,5,15102),
  t(15840,2,5,0),t(16025,2,5,0),t(16209,4,5,0),h(16578,4,5,18054),
  t(18238,2,5,0),t(18422,5,5,0),t(19529,0,5,0),t(19898,6,4,0),
  t(19898,0,3,0),t(20083,3,4,0),h(20267,5,5,21282,1),f(21743,1,3),
  t(22112,2,5,0),t(22480,4,5,0),t(22849,7,3,0),t(22849,1,3,0),
  t(23034,2,5,0),t(23218,4,5,0),t(23587,7,3,0),t(23956,4,5,0),
  t(24325,3,3,0),t(24694,5,3,0),t(25063,3,3,0),t(25247,0,5,0),
  t(25432,0,3,0),t(25801,1,3,0),t(25985,0,5,0),t(26538,0,5,0),
  t(26723,2,5,0),t(26907,0,5,0),t(27645,3,4,0),t(28383,0,5,0),
  t(28567,1,5,0),t(28660,0,5,0),t(28936,0,4,0),t(28936,7,3,0),
  t(29121,0,5,0),f(29305,0,5),t(29859,0,5,0),t(30043,2,5,0),
  t(30412,4,5,0),t(30596,2,5,0),t(30781,4,5,0),t(30873,2,5,0),
  t(31334,0,5,0),t(31519,0,5,0),t(32072,0,5,1),t(32441,2,5,0),
  t(32810,0,5,0),t(33179,2,5,0),t(33363,5,3,0),t(33917,3,4,0),
  s(34286,35577,[[34286,3,4],[34378,3,4],[34747,3,3],[35208,4,3],[35485,4,2],[35577,4,2]]),t(35761,5,4,0),t(36499,2,8,0),f(36868,5,5),
  h(37237,5,5,38528),t(38713,4,5,0),t(39450,2,5,0),s(39819,41110,[[39819,1,4],[40004,1,3],[40188,1,3],[40373,0,2],[40465,0,2],[40557,1,2],[40742,1,3],[40926,1.5,3],[41110,2,4]]),
  t(41295,3,4,0),h(41664,0,5,42217,0,[[41664,0,5],[41940,1,3],[42217,2,1]]),t(42402,2,5,0),t(42771,6,4,0),
  t(43139,2,5,0),h(43508,0,5,44338),t(44431,1,4,0),t(44615,2,5,0),
  t(45353,4,5,0),t(45722,6,4,0),t(46091,4,5,0),t(46829,2,5,0),
  t(47013,0,5,0),t(47197,3,4,0),t(47566,5,5,0),t(48120,3,4,0),
  t(48304,0,5,0),f(48673,3,4),t(49042,0,5,0),h(49411,4,5,50149,1),
  t(50518,3,3,0),t(50887,1,3,0),t(51071,3,4,0),t(51255,0,5,0),
  t(51624,0,4,0),t(51993,0,5,0),t(52731,0,5,0),t(53100,1,4,0),
  t(53469,2,5,0),t(54022,4,5,0),t(54207,2,5,0),t(54576,1,4,0),
  s(54945,56236,[[54945,1,2],[55129,3,3],[55313,3,4],[55406,3,4],[55498,1.5,4],[55682,1.5,4],[55867,1.5,4],[55959,1,3],[56051,1,3],[56236,1,2]]),t(56420,0,5,0),s(56789,57988,[[56789,1,2],[56881,1,2],[56974,1,2],[57066,1,2],[57158,1,3],[57250,1,3],[57342,1,3],[57435,1,3],[57527,2.5,3],[57619,3,3],[57711,3,4],[57804,3,4],[57896,2.5,4],[57988,3,4]],1),t(58449,3,4,0),
  t(58541,5,4,0),t(59003,5,5,0),t(59187,0,4,0),t(59187,7,3,0),
  f(59371,5,5),t(59925,3,4,0),t(60109,5,5,0),t(60294,5,3,0),
  t(60478,3,4,0),t(60847,0,5,2),t(61216,2,5,0),t(61400,1,4,0),
  t(61585,0,3,0),t(61954,1,4,0),t(62138,0,4,0),t(62323,1,3,0),
  t(62507,3,3,0),t(62876,2,8,0),h(63061,5,5,63798,1),t(64167,3,4,0),
  t(64536,5,4,0),t(64905,6,4,0),t(65274,5,4,0),t(65643,1,4,0),
  t(66012,4,5,0),f(66381,2,5),t(66750,5,5,0),t(67119,5,4,0),
  t(67487,0,5,0),t(67672,0,4,0),t(67672,7,3,0),t(67856,5,5,0),
  t(68410,2,5,0),t(68594,0,3,0),t(68963,3,3,0),t(69332,5,4,0),
  t(69701,2,5,0),t(70070,1,3,0),t(70254,0,4,0),t(70439,0,5,0),
  t(70808,3,4,0),h(71177,6,1,71914,0,[[71177,6,1],[71546,4,5],[71914,6,1]]),t(72099,0,5,0),t(72283,3,3,0),
  t(72652,5,5,0),t(72837,2,5,0),t(73021,0,4,0),t(73206,3,4,0),
  f(73390,0,5),t(73759,3,4,0),t(73943,0,5,0),t(74128,4,5,0),
  t(74681,3,4,0),t(74866,5,5,0),t(75235,5,4,0),s(75604,76895,[[75604,3,4],[75696,3,4],[75788,3,4],[75880,3,4],[75972,3,3],[76157,3,3],[76341,4,3],[76526,4,3],[76710,4,2],[76895,4,2]]),
  t(77079,2,5,0),t(77633,5,4,0),t(77817,5,5,0),t(78001,4,5,0),
  t(78186,3,4,0),t(78555,2,5,0),t(78924,0,4,0),t(79108,3,4,0),
  t(79293,5,5,0),t(79662,3,3,0),t(80030,0,4,0),t(80215,1,4,0),
  t(80399,5,3,0),s(80584,81598,[[80584,3,4],[80768,3,3],[80953,2,3],[81137,2,2],[81229,1.5,3],[81322,1,3],[81414,1,3],[81598,3,4]]),t(81875,0,3,0),t(81875,6,3,0),
  f(82059,3,4),t(82428,6,4,0),t(82613,3,4,0),t(82982,0,5,0),
  t(83351,2,5,0),t(83535,1,4,0),t(83720,4,5,0),t(83904,2,5,0),
  h(84088,6,4,85380),t(85564,5,4,0),t(85933,1,8,0),h(86302,1,4,86947),
  t(87040,0,4,0),t(87409,0,5,3),t(87962,3,4,0),t(88146,2,5,0),
  t(88331,0,5,0),t(88515,3,4,0),t(88700,6,4,0),f(88884,3,3),
  t(89253,0,4,0),t(89438,3,4,0),t(89622,0,5,0),t(89991,1,4,0),
  t(90175,3,4,0),t(90360,0,5,0),s(90729,92204,[[90729,1,2],[91282,1.5,3],[91743,2.5,3],[92020,3,4],[92112,3,4],[92204,3,4]]),t(92297,1,4,0),
  t(92942,5,4,0),t(93311,1,3,0),t(93496,5,4,0),t(93865,1,4,0),
  t(94049,4,5,0),t(94418,6,4,0),t(94787,4,5,0),t(95340,3,4,0),
  t(95525,0,5,0),t(95709,1,3,0),t(95709,7,3,0),h(95894,5,5,96631,0,[[95894,5,5],[96262,7,1],[96631,5,5]]),
  t(96816,7,3,0),f(96908,5,4),t(97369,6,4,0),t(97554,5,4,0),
  t(97738,5,5,0),t(98291,5,4,0),t(98476,2,5,0),h(98660,1,4,99398),
  t(99583,0,3,0),t(99767,3,4,0),t(99952,5,5,0),t(100320,2,5,0),
  t(100505,0,4,0),t(100689,2,5,0),t(100874,4,5,0),h(101243,5,4,101981),
  t(102165,5,4,0),s(102534,104010,[[102534,3,4],[102718,1.5,4],[102903,1.5,3],[103087,1,3],[103180,1,3],[103272,1.5,3],[103456,1.5,3],[103641,1.5,2],[103825,1.5,2],[104010,1.5,2]]),t(104194,3,3,0),t(104378,3,3,0),
  t(104563,5,3,0),t(105301,4,5,0),t(105670,5,5,0),t(106039,5,5,0),
  f(106592,2,5),t(106961,0,3,0),t(107330,3,3,0),t(107699,5,5,0),
  t(108252,2,5,0),t(108990,0,5,0),t(109359,0,5,0),t(109543,3,3,0),
  t(109912,5,4,0),t(110650,6,4,0),t(111019,5,3,0),t(111388,1,8,0),
  t(111757,4,5,0),t(112126,7,3,0),t(112495,0,5,0),t(112863,5,3,0),
  s(113232,114708,[[113232,1,4],[113786,2.5,3],[114247,2.5,3],[114524,3,2],[114708,3,2]]),t(114892,0,4,0),t(115077,1,3,0),h(115446,3,3,116184),
  t(116276,0,5,0),f(116553,1,4),t(116921,3,3,0),t(117290,5,3,0),
  t(117475,5,5,0),t(117659,5,3,0),t(117844,7,3,0),t(118028,3,4,0),
  t(118766,1,3,0),t(119135,0,5,4),t(119504,1,4,0),t(119688,0,5,0),
  t(119873,2,5,0),t(120242,4,5,0),t(120426,2,5,0),t(120611,0,5,0),
  t(120795,0,3,0),t(120979,0,4,0),t(121348,1,4,0),t(121717,0,4,0),
  t(122086,2,5,0),t(122271,1,3,0),t(122455,5,4,0),f(122824,3,3),
  t(123193,7,3,0),t(123377,5,3,0),t(123562,1,4,0),t(123931,3,4,0),
  t(124300,0,4,0),t(124669,0,3,0),t(125037,1,3,0),t(125222,0,5,0),
  t(125406,0,4,0),t(125406,7,3,0),t(125591,4,5,0),t(125775,2,5,0),
  t(125960,1,3,0),t(126144,0,5,0),t(126329,0,3,0),t(126513,1,4,0),
  t(126882,0,3,0),t(126974,1,3,0),t(127435,3,3,0),t(127897,1,3,0),
  t(127989,0,1,0),t(128358,1,3,0),t(128542,5,4,0),f(128727,2,5),
  t(129095,5,3,0),t(129280,6,4,0),t(129464,4,5,0),t(129833,3,4,0),
  t(130018,1,3,0),t(130202,0,8,0),t(130387,1,3,0),t(130756,0,5,0),
  t(130940,0,5,0),t(131124,5,3,0),t(131309,3,3,0),t(131678,5,5,0),
  t(131862,3,3,0),t(132231,6,4,0),f(132416,2,5),t(132785,7,3,0),
  t(132969,5,3,0),t(133153,7,3,0),t(133338,5,4,0),t(133522,7,3,0),
  t(133707,3,4,0),t(133891,4,5,0),t(134076,2,5,0),t(134168,5,3,0),
  t(134445,7,3,0),t(134445,1,3,0),t(134629,5,3,0),t(135090,7,3,0),
  t(135367,5,5,0),t(135551,7,3,0),t(135736,5,3,0),t(135920,5,3,0),
  t(136105,5,5,0),t(136474,5,5,0),t(136658,5,4,0),t(136843,5,5,0),
  t(137211,5,3,0),t(137396,7,3,0),t(137580,4,5,0),t(138226,7,3,0),
  h(138318,6,1,138964,0,[[138318,6,1],[138687,5,3],[138964,4,5]]),f(139056,5,5),t(139425,4,5,0),t(139794,7,3,0),
  t(139886,5,4,0),t(140163,7,3,0),t(140439,4,5,0),t(140532,6,4,0),
  t(140808,5,3,0),t(140901,3,4,0),t(141454,1,3,0),t(141546,3,4,0),
  t(142192,4,5,0),t(142468,7,3,0),t(142561,2,5,0),t(143298,7,3,0),
  t(144221,5,5,0),t(144959,5,5,0),t(145328,5,5,0),t(146434,1,3,0),
  t(146619,3,3,0),t(146803,5,3,0),t(146988,7,3,0),t(146988,1,3,0),
  f(147172,2,5),t(147910,4,5,0),t(148094,2,5,0),t(148187,0,5,0),
  t(148463,0,5,0),t(148648,0,8,0),
// </six-eternel-remix-beat-v3-hard-notes>
])(mhTap,mhHoldV2,mhFlick,mhSlideV2);
const sixEternelRemixBeatExpertNotes=((t,h,f,s)=>[
// <six-eternel-remix-beat-v3-expert-notes>
  t(2283,1,3,0),t(2559,6,1,0),s(2928,3758,[[2928,2.5,3],[3205,4,3],[3482,2,3],[3758,0,3]]),t(4035,2,8,0),
  f(4404,3,3),t(4773,0,5,0),t(5511,3,3,0),h(5787,0,2,6894),
  t(7355,2,5,0),h(7724,2,5,8277),t(8462,4,5,0),t(9200,4,5,0),
  s(9938,11413,[[9938,2,4],[10122,0.5,4],[10214,0,4],[10399,0,4],[10860,0.5,4],[11413,0.5,4]],1),s(9938,11413,[[9938,4,2],[11413,3,2]]),t(12059,2,5,0),t(12151,5,3,0),
  t(12335,2,5,0),h(13627,3,5,15102,1),t(13996,5,3,0),t(14364,4,5,0),
  t(14733,4,5,0),t(15840,0,5,0),t(16025,2,5,0),f(16209,5,5),
  h(16578,3,5,18054),t(17131,0,5,0),t(17316,2,5,0),t(17685,0,5,0),
  t(18238,4,5,0),t(18422,0,5,0),t(19529,0,5,0),t(19898,0,4,0),
  t(19898,7,3,0),t(20083,0,4,0),t(20083,7,3,0),h(20267,4,5,21282,1),
  t(20636,3,3,0),t(20820,5,5,0),t(21743,0,2,0),t(21743,4,2,0),
  t(22112,2,2,0),t(22112,6,2,0),t(22480,4,2,0),t(22480,8,2,0),
  t(22849,5,3,0),t(23034,0,5,0),t(23218,2,5,0),t(23587,5,3,0),
  t(23956,5,5,0),t(24325,3,3,0),f(24694,5,3),t(25063,3,3,0),
  t(25247,0,5,0),t(25432,1,3,0),t(25801,0,3,0),t(25985,0,5,0),
  t(26354,0,3,0),t(26538,0,5,0),t(26723,0,5,0),t(26907,1,2,0),
  t(26907,5,2,0),t(27645,3,2,0),t(27645,7,2,0),t(28383,1,2,0),
  t(28383,5,2,0),t(28567,4,5,0),t(28660,2,5,0),t(28936,6,4,0),
  t(28936,0,3,0),t(29121,2,5,0),t(29305,4,5,0),t(29859,5,5,0),
  f(30043,4,5),t(30412,5,5,0),t(30596,4,5,0),t(30781,2,5,0),
  t(30873,1,5,0),t(30965,0,4,0),t(31334,0,5,0),t(31519,1,5,0),
  t(31611,0,5,0),t(32072,0,2,0),t(32072,4,2,0),t(32441,2,2,0),
  t(32441,6,2,0),t(32810,4,2,0),t(32810,8,2,0),t(33179,0,8,0),
  t(33363,0,3,0),t(33917,1,4,1),s(34286,35577,[[34286,2,4],[34378,2,4],[34747,2,3],[35208,3,3],[35485,4,2],[35577,4,2]]),s(34839,35577,[[34839,0,2],[35577,1,2]]),
  t(35761,3,4,0),t(36499,5,5,0),t(36868,2,5,0),h(37237,3,5,38528,0,[[37237,3,5],[37606,4,4],[37882,4,3],[38251,5,2],[38528,5,1]]),
  t(37790,5,5,0),f(37975,5,5),t(38713,5,5,0),t(39450,0,5,0),
  s(39819,41110,[[39819,2,3],[40096,2,3],[40373,0.5,3],[40649,1.5,3],[40926,3,3],[41110,3.5,3]]),t(40188,0,5,0),t(41295,6,4,0),h(41664,4,5,42217),
  t(42402,1,2,0),t(42402,5,2,0),t(42771,3,2,0),t(42771,7,2,0),
  t(43139,1,2,0),t(43139,5,2,0),h(43508,1,5,44338),t(43877,0,5,0),
  t(44431,1,4,0),t(44615,0,5,0),t(45353,0,5,0),t(45722,3,4,0),
  t(46091,4,5,0),t(46829,2,5,0),t(47013,0,5,0),t(47197,3,4,0),
  f(47566,4,5),t(48120,6,4,0),t(48304,5,5,0),t(48673,4,4,0),
  t(48765,5,5,0),t(49042,2,5,0),h(49411,5,5,50149,1),t(49780,2,5,0),
  t(50887,3,3,0),t(51071,0,4,0),t(51255,2,5,0),t(51624,6,4,0),
  t(51993,2,5,0),t(52547,0,4,0),t(52731,0,5,0),t(53100,3,4,0),
  t(53469,5,5,0),t(53838,3,3,0),t(54022,0,5,0),t(54207,2,5,0),
  t(54576,1,4,0),s(54945,56236,[[54945,2,2],[55129,4,3],[55313,4,4],[55406,4,4],[55498,2.5,4],[55682,2.5,4],[55867,2.5,4],[55959,2,3],[56051,2,3],[56236,2,2]]),t(55498,6,4,0),f(55682,5,5),
  t(56420,4,5,0),s(56789,57988,[[56789,1.5,2],[56881,1.5,2],[56974,1.5,2],[57066,1.5,2],[57158,1.5,3],[57250,1.5,3],[57342,1.5,3],[57435,1.5,3],[57527,3,3],[57619,3.5,3],[57711,3.5,4],[57804,3.5,4],[57896,3,4],[57988,3.5,4]],1),t(57158,4,5,0),t(57527,3,4,0),
  t(58449,1,4,0),t(58541,3,4,0),t(58634,4,5,0),t(59003,5,5,0),
  t(59187,0,4,0),t(59187,7,3,0),t(59371,5,5,0),t(59925,3,4,0),
  t(60109,5,5,0),t(60294,5,3,0),t(60478,3,4,0),t(60847,0,5,2),
  t(61216,2,5,0),t(61400,1,4,0),t(61585,0,3,0),t(61769,0,8,0),
  t(61954,0,4,0),t(62138,0,4,0),t(62323,1,3,0),f(62507,3,3),
  t(62876,0,5,0),h(63061,4,1,63798,0,[[63061,4,1],[63429,2,5],[63798,4,1]]),t(63429,6,4,0),t(63983,2,5,0),
  h(64167,5,4,64905,1),t(64536,3,4,0),t(65274,6,4,0),t(65643,1,4,0),
  t(66012,4,5,0),t(66381,2,5,0),t(66750,5,5,0),t(67119,5,4,0),
  t(67487,2,5,0),t(67672,5,4,0),t(67856,5,5,0),t(68410,4,5,0),
  f(68594,3,3),t(68963,5,3,0),t(69332,0,4,0),t(69332,7,3,0),
  t(69701,2,5,0),t(70070,5,3,0),t(70254,6,4,0),t(70439,5,5,0),
  t(70808,5,4,0),t(70992,5,5,0),h(71177,4,5,71914),h(72099,5,5,72652),
  t(72837,5,5,0),t(73021,6,4,0),t(73021,0,3,0),t(73206,6,4,0),
  t(73390,4,5,0),t(73759,6,4,0),t(73943,4,5,0),t(74128,5,5,0),
  t(74681,3,4,0),t(74866,4,5,0),f(75235,6,4),s(75604,76895,[[75604,0,3],[75880,0,3],[76157,1,3],[76434,2.5,3],[76710,3.5,3],[76895,4,3]]),
  t(76157,3,4,0),t(76341,4,5,0),t(77079,2,5,0),t(77633,5,4,0),
  t(77817,5,5,0),t(78001,2,5,0),t(78186,0,4,0),t(78370,0,4,0),
  t(78555,0,5,0),t(78924,0,4,0),t(79108,3,4,0),t(79293,0,5,0),
  t(79662,5,3,0),t(80030,0,4,0),t(80215,3,4,0),t(80399,7,3,0),
  s(80584,81598,[[80584,2.5,4],[80768,2.5,3],[80953,1.5,3],[81137,1.5,2],[81229,1,3],[81322,0.5,3],[81414,0.5,3],[81598,2.5,4]]),t(81137,4,4,0),t(81875,1,3,0),f(82059,0,4),
  t(82428,0,4,0),t(82613,1,4,0),t(82982,2,5,0),t(83351,4,5,0),
  t(83535,0,4,0),t(83535,7,3,0),t(83720,4,5,0),t(83904,0,5,0),
  h(84088,0,5,85380,0,[[84088,0,5],[84457,1,3],[84734,2,1],[85103,1,3],[85380,0,5]]),t(85564,0,4,0),t(85933,0,8,0),h(86302,0,4,86947),
  t(87040,1,4,0),t(87409,4,5,3),t(87778,3,4,0),t(87962,5,4,0),
  t(88146,4,5,0),t(88331,5,5,0),t(88515,6,4,0),t(88700,5,4,0),
  f(88884,3,3),t(89253,1,4,0),t(89438,0,4,0),t(89622,0,5,0),
  t(89991,1,4,0),t(90175,3,4,0),t(90360,0,5,0),s(90729,92204,[[90729,1.5,2],[91282,2,3],[91743,3.5,3],[92020,3.5,4],[92112,4,4],[92204,4,4]]),
  t(91098,4,5,0),t(91282,0,4,0),t(91467,0,5,0),t(91651,0,5,0),
  t(91836,3,5,0),t(92297,6,4,0),t(92481,3,4,0),t(92942,6,4,0),
  t(93311,3,3,0),f(93496,6,4),t(93865,6,4,0),t(93865,0,3,0),
  t(94049,5,5,0),t(94418,6,4,0),t(94787,5,5,0),t(95340,5,4,0),
  t(95525,2,5,0),t(95709,1,3,0),h(95894,0,4,96631),t(96262,2,5,0),
  t(96816,2,3,0),t(96908,3,4,0),t(97000,0,5,0),t(97369,0,4,0),
  t(97554,3,4,0),t(97738,0,5,0),f(97923,3,4),t(98291,1,4,0),
  t(98476,4,5,0),h(98660,3,4,99398),t(99583,0,3,0),t(99767,1,4,0),
  t(99952,0,5,0),t(100136,1,3,0),t(100320,2,5,0),t(100689,0,5,0),
  t(100874,0,5,0),h(101243,0,4,101981),t(102165,1,4,0),s(102534,104010,[[102534,4,3],[102811,2,3],[103087,0.5,3],[103364,0,3],[103641,0.5,3],[103917,0.5,3],[104010,0.5,3]]),
  t(102903,3,5,0),t(103087,2,4,0),t(103272,1,5,0),t(103456,2,3,0),
  t(103641,2,3,0),t(104194,1,3,0),t(104378,0,3,0),t(104563,1,3,0),
  t(104747,3,4,0),t(105301,4,5,0),t(105670,2,5,0),f(106039,4,5),
  t(106592,5,5,0),t(106961,5,3,0),t(107699,2,8,0),t(108252,5,5,0),
  t(108990,4,5,0),t(109359,5,5,0),t(109543,5,3,0),t(109912,6,4,0),
  t(110097,5,4,0),t(110650,6,4,0),t(111019,0,3,0),t(111203,0,5,0),
  t(111388,2,5,0),t(111757,4,5,0),t(112126,7,3,0),t(112495,4,5,0),
  t(112863,1,3,0),s(113232,114708,[[113232,1.5,4],[113786,2.5,3],[114247,2.5,3],[114524,2.5,2],[114708,2.5,2]]),t(113601,6,3,0),t(113786,5,5,0),
  t(113970,5,5,0),t(114155,7,3,0),f(114339,6,3),t(114892,6,4,0),
  t(114892,0,3,0),t(115077,5,3,0),h(115446,8,1,116184,0,[[115446,8,1],[115815,7,3],[116184,5,5]]),t(115815,5,4,0),
  t(116276,2,5,0),t(116553,1,4,0),t(116737,0,4,0),t(116921,1,3,0),
  t(117290,5,3,0),t(117475,2,5,0),t(117659,5,3,0),t(117844,7,3,0),
  t(118028,3,4,0),t(118766,1,3,0),t(119135,0,5,4),t(119504,1,4,0),
  t(119688,0,5,0),f(119873,2,5),t(120242,4,5,0),t(120426,2,5,0),
  t(120611,0,5,0),t(120795,0,3,0),t(120979,0,4,0),t(121348,1,4,0),
  t(121717,3,4,0),t(121902,1,3,0),t(122086,0,5,0),t(122271,1,3,0),
  t(122455,3,4,0),t(122824,5,3,0),t(123193,7,3,0),t(123377,5,3,0),
  t(123562,3,4,0),t(123931,1,4,0),t(124300,3,4,0),t(124392,1,3,0),
  f(124669,3,3),t(125037,1,3,0),t(125222,2,5,0),t(125406,5,4,0),
  t(125591,5,5,0),t(125775,4,5,0),t(126144,2,5,0),t(126329,5,3,0),
  t(126513,6,4,0),t(126513,0,3,0),t(126882,3,3,0),t(126974,5,3,0),
  t(127066,3,4,0),t(127343,1,4,0),t(127435,3,3,0),t(127897,1,3,0),
  t(127989,0,1,0),t(128358,1,3,0),t(128450,5,4,0),t(128542,3,4,0),
  t(128727,0,8,0),t(129095,3,3,0),t(129280,6,4,0),f(129464,2,5),
  t(129833,0,4,0),t(130018,1,3,0),t(130202,0,5,0),t(130387,1,3,0),
  t(130756,0,5,0),t(130940,0,5,0),t(131124,5,3,0),t(131309,3,3,0),
  t(131678,5,5,0),t(131862,3,3,0),t(132231,6,4,0),t(132416,2,5,0),
  t(132785,7,3,0),t(132969,5,3,0),t(133153,7,3,0),t(133338,5,4,0),
  t(133522,7,3,0),t(133707,6,4,0),t(133891,5,5,0),t(134076,5,5,0),
  t(134168,7,3,0),t(134260,4,3,0),t(134445,7,3,0),t(134445,1,3,0),
  s(134629,135828,[[134629,2,2],[134721,2,3],[134814,0,3],[134906,1,3],[134998,1,4],[135090,1,4],[135182,1,4],[135275,1.5,4],[135367,2,4],[135459,2,4],[135551,2.5,3],[135644,2,3],[135736,2,3],[135828,2,2]]),t(135090,5,3,0),t(135275,4,4,0),t(135920,1,3,0),
  t(136105,2,5,0),t(136474,0,5,0),t(136658,0,4,0),t(136843,0,5,0),
  t(137211,3,3,0),t(137396,5,3,0),t(137580,5,5,0),t(138226,1,3,0),
  h(138318,4,5,138964,0,[[138318,4,5],[138687,5,3],[138964,6,1]]),t(139056,2,5,0),t(139333,7,3,0),f(139425,4,5),
  t(139794,7,3,0),t(139886,5,4,0),t(139978,7,3,0),t(140163,3,3,0),
  t(140439,4,5,0),t(140532,3,4,0),t(140808,1,3,0),t(140901,3,4,0),
  t(141454,0,3,0),t(141546,3,4,0),t(142192,5,5,0),t(142468,5,3,0),
  t(142561,0,5,0),t(142653,3,3,0),t(143298,0,3,0),t(144221,0,5,0),
  t(144959,0,5,0),t(145328,0,5,0),t(146434,3,3,0),t(146619,1,3,0),
  t(146803,0,3,0),t(146803,6,3,0),t(146988,1,3,0),f(147172,2,5),
  t(147910,4,5,0),t(148094,2,5,0),t(148187,0,5,0),t(148463,2,5,0),
  t(148648,2,8,0),
// </six-eternel-remix-beat-v3-expert-notes>
])(mhTap,mhHoldV2,mhFlick,mhSlideV2);
const sixEternelRemixBeatMasterNotes=((t,h,f,s)=>[
// <six-eternel-remix-beat-v3-master-notes>
  t(2283,2,2,0),t(2559,6,1,0),s(2928,3758,[[2928,2.5,2],[3205,4,2],[3482,2,2],[3758,0,2]]),t(4035,4,6,0),
  f(4404,4,2),t(4773,1,4,0),t(5142,0,2,0),t(5511,2,2,0),
  h(5787,0,2,6894),t(7078,2,2,0),t(7355,1,4,0),h(7724,1,4,8277),
  t(8462,1,4,0),t(9200,1,4,0),t(9476,1,3,0),s(9938,11413,[[9938,1.5,3],[10122,0,3],[10214,0,3],[10399,0,3],[10860,0,3],[11413,0,3]],1),
  s(9938,11413,[[9938,4,2],[11413,2,2]]),t(12059,5,4,0),t(12151,4,2,0),t(12335,1,4,0),
  t(12612,0,2,0),h(13627,2,4,15102,1),t(13996,7,2,0),t(14180,3,4,0),
  f(14364,1,4),t(14733,3,4,0),t(15840,1,4,0),t(16025,3,4,0),
  t(16209,5,4,0),h(16578,6,4,18054),t(16947,5,4,0),t(17131,3,4,0),
  t(17316,5,4,0),t(17685,5,4,0),t(18238,6,4,0),t(18422,6,4,0),
  t(19529,1,4,0),t(19529,7,3,0),t(19714,7,3,0),t(19714,2,3,0),
  t(19898,3,3,0),t(20083,7,3,0),h(20267,3,4,21282,1),t(20636,8,2,0),
  t(20820,7,3,0),f(21743,2,2),t(22112,3,4,0),t(22480,5,4,0),
  t(22849,8,2,0),t(23034,5,4,0),t(23218,6,4,0),t(23403,5,4,0),
  t(23587,0,2,0),t(23587,4,2,0),t(23956,4,2,0),t(23956,8,2,0),
  t(24325,0,2,0),t(24325,4,2,0),t(24694,4,2,0),t(24694,8,2,0),
  t(24878,5,4,0),t(25063,4,2,0),t(25247,5,4,0),t(25432,4,2,0),
  t(25801,2,2,0),t(25985,0,4,0),t(26354,2,2,0),t(26538,0,4,0),
  t(26723,0,4,0),t(26907,0,4,0),t(26907,6,3,0),f(27184,0,4),
  t(27645,1,3,0),t(28383,5,4,0),t(28567,3,4,0),t(28660,6,4,0),
  t(28936,3,3,0),t(29121,1,4,0),t(29305,3,4,0),t(29674,5,4,0),
  t(29859,5,4,0),t(30043,4,6,0),t(30320,5,4,0),t(30412,6,4,0),
  t(30596,5,4,0),t(30781,6,4,0),t(30873,5,4,0),t(30965,7,3,0),
  t(31334,1,4,0),t(31519,5,4,0),f(31611,3,4),t(32072,6,4,0),
  t(32072,1,3,0),t(32441,5,4,1),t(32810,3,4,0),t(33179,1,4,0),
  t(33363,4,2,0),t(33917,1,3,0),s(34286,35577,[[34286,1.5,3],[34378,1,3],[34747,1,2],[35208,2,2],[35485,3,2],[35577,3,2]]),t(34839,3,4,0),
  t(35023,4,4,0),t(35208,0,4,0),t(35761,3,3,0),t(35946,5,3,0),
  t(36499,6,4,0),t(36868,6,4,0),h(37237,6,4,38528,0,[[37237,6,4],[37606,7,3],[37882,7,3],[38251,7,2],[38528,8,1]]),t(37790,5,4,0),
  t(37975,5,4,0),t(38713,1,4,0),t(39266,5,4,0),f(39450,3,4),
  s(39819,41110,[[39819,2,2],[40096,2.5,2],[40373,0,2],[40649,1,2],[40926,3.5,2],[41110,4,2]]),t(40188,5,4,0),t(40557,3,4,0),t(41295,1,3,0),
  h(41664,1,4,42217),t(42402,0,4,0),t(42771,1,3,0),t(43139,0,4,0),
  h(43508,5,4,44338),t(43877,1,4,0),t(44431,3,3,0),t(44615,0,2,0),
  t(44615,4,2,0),t(44984,1,2,0),t(44984,5,2,0),t(45353,3,2,0),
  t(45353,7,2,0),t(45722,4,2,0),t(45722,8,2,0),t(46091,3,4,0),
  t(46644,1,3,0),t(46829,5,4,0),t(47013,3,4,0),f(47197,1,3),
  t(47566,0,4,0),t(48120,3,3,0),t(48304,1,4,0),t(48396,0,2,0),
  t(48673,1,3,0),t(48765,3,4,0),t(49042,1,4,0),h(49411,5,4,50149,1),
  t(49780,3,4,0),t(50518,8,2,0),t(50887,8,2,0),t(51071,7,3,0),
  t(51255,6,4,0),t(51624,7,3,0),t(51993,5,4,0),t(52178,6,4,0),
  t(52547,5,3,0),f(52731,6,4),t(53100,5,3,0),t(53469,2,6,0),
  t(53838,2,2,0),t(54022,0,4,0),t(54207,0,4,0),t(54576,3,3,0),
  s(54945,56236,[[54945,1,2],[55129,2.5,2],[55313,2.5,3],[55406,2.5,3],[55498,1.5,3],[55682,1.5,3],[55867,1.5,3],[55959,0.5,2],[56051,1,2],[56236,1,2]]),t(55498,5,3,0),t(55682,4,4,0),t(55867,5,4,0),
  t(56420,6,4,0),t(56420,1,3,0),s(56789,57988,[[56789,3,2],[56881,3,2],[56974,2.5,2],[57066,2.5,2],[57158,2.5,2],[57250,2.5,2],[57342,3,2],[57435,3,2],[57527,4,2],[57619,4,2],[57711,4,3],[57804,4,3],[57896,4,3],[57988,4,3]]),t(57158,6,4,0),
  t(57527,3,3,0),t(58080,0,4,0),s(58173,59279,[[58173,2.5,3],[58265,2,3],[58357,2.5,3],[58449,3,2],[58541,3,2],[58634,4,2],[58726,4,2],[58818,2,2],[58910,2,2],[59003,2,2],[59095,3,2],[59187,3,2],[59279,3,2]]),t(58541,0,3,0),
  t(59371,3,4,0),f(59464,5,3),t(59925,7,3,0),t(59925,2,3,0),
  t(60109,5,4,0),t(60294,8,2,0),t(60478,5,3,0),t(60847,0,4,2),
  t(61216,3,4,0),t(61400,7,3,0),t(61585,4,2,0),t(61769,5,4,0),
  t(61954,2,3,0),t(61954,7,3,0),t(62138,1,3,0),t(62323,0,2,0),
  t(62507,0,2,0),t(62599,1,4,0),t(62876,0,4,0),t(63061,1,4,0),
  h(63337,0,3,63798),t(63983,1,4,0),h(64167,4,1,64905,1,[[64167,4,1],[64536,3,4],[64905,4,1]]),f(64536,5,3),
  t(65274,2,2,0),t(65274,6,2,0),t(65643,2,2,0),t(65643,7,2,0),
  t(66012,1,2,0),t(66012,8,2,0),t(66381,0,2,0),t(66381,8,2,0),
  t(66750,0,4,0),t(67119,0,3,0),t(67303,1,3,0),t(67487,0,4,0),
  t(67487,6,3,0),t(67672,0,3,0),t(67856,3,4,0),t(68225,8,2,0),
  t(68410,2,4,0),t(68594,0,2,0),t(68594,4,2,0),t(68963,4,2,0),
  t(68963,8,2,0),t(69332,0,2,0),t(69332,4,2,0),t(69701,4,2,0),
  t(69701,8,2,0),t(69885,5,3,0),t(70070,8,2,0),t(70254,3,3,0),
  f(70439,6,4),t(70808,3,3,0),t(70992,6,4,0),h(71177,3,4,71914),
  h(72099,0,4,72652),t(72837,0,2,0),t(72837,4,2,0),t(73021,1,2,0),
  t(73021,5,2,0),t(73206,3,2,0),t(73206,7,2,0),t(73390,4,2,0),
  t(73390,8,2,0),t(73759,0,3,0),t(73943,1,4,0),t(74128,0,4,0),
  t(74681,1,3,0),t(74866,2,6,0),t(75050,5,4,0),t(75235,7,3,0),
  s(75604,76895,[[75604,0,2],[75880,0,2],[76157,1,2],[76434,2.5,2],[76710,3.5,2],[76895,4,2]]),t(75972,7,3,0),t(76157,5,3,0),f(76341,6,4),
  t(77079,3,4,0),t(77633,5,3,0),t(77817,6,4,0),t(78001,5,4,0),
  t(78186,2,3,0),t(78186,7,3,0),t(78370,1,3,0),t(78555,5,4,0),
  t(78739,1,3,0),t(78924,5,3,0),t(79108,1,3,0),t(79293,3,4,0),
  t(79662,6,2,0),t(79846,7,3,0),t(80030,7,3,0),t(80215,5,3,0),
  t(80399,8,2,0),s(80584,81598,[[80584,2.5,3],[80768,2.5,2],[80953,1.5,2],[81137,1.5,2],[81229,1,2],[81322,0.5,2],[81414,0.5,2],[81598,2.5,3]]),t(81137,4,3,0),t(81691,1,3,0),
  t(81875,0,2,0),f(82059,0,3),t(82428,1,3,0),t(82613,0,3,0),
  t(82797,1,4,0),t(82982,3,4,0),t(83351,1,4,0),t(83535,0,3,0),
  t(83720,1,4,0),t(83904,3,4,0),h(84088,1,4,85380,0,[[84088,1,4],[84457,1,3],[84734,2,1],[85103,1,3],[85380,1,4]]),t(84457,3,4,0),
  t(84642,7,3,0),t(84826,4,2,0),t(85011,0,3,0),t(85564,0,3,0),
  t(85749,0,2,0),t(85933,0,4,0),t(86117,0,2,0),h(86302,1,3,86947),
  f(87040,3,3),t(87409,5,4,0),t(87778,7,3,0),t(87962,5,3,0),
  t(88146,5,4,0),t(88331,6,4,0),h(88331,1,2,89438),s(88515,89438,[[88515,3,3],[88884,2.5,2],[89161,2.5,2],[89345,3.5,2],[89438,4,2]]),
  t(89622,5,4,3),t(89991,7,3,0),t(90083,5,3,0),t(90175,4,3,0),
  t(90360,5,4,0),s(90729,92204,[[90729,2,2],[91282,2.5,2],[91743,4,2],[92020,4,3],[92112,4,3],[92204,4,3]]),t(91098,1,4,0),t(91282,1,3,0),
  t(91467,0,4,0),t(91651,1,4,0),f(91836,4,4),t(92297,7,3,0),
  t(92481,2,3,0),t(92481,7,3,0),t(92942,7,3,0),t(93311,4,2,0),
  t(93496,7,3,0),t(93865,1,3,0),t(94049,4,6,0),t(94326,3,3,0),
  t(94418,1,3,0),t(94787,0,4,0),t(95340,1,3,0),t(95525,0,4,0),
  t(95709,0,2,0),t(95894,1,3,0),h(95986,3,3,96631),t(96816,4,2,0),
  t(96908,5,3,0),f(97000,3,4),t(97369,1,3,0),t(97554,0,3,0),
  t(97738,1,4,0),t(97923,3,3,0),t(98015,5,3,0),t(98291,1,3,0),
  t(98476,5,4,0),t(98476,0,3,0),h(98660,3,3,99398),t(99583,0,2,0),
  t(99767,3,3,0),t(99952,6,4,0),t(100136,4,2,0),t(100320,0,4,0),
  t(100505,3,3,0),t(100689,0,4,0),t(100874,0,4,0),h(101243,0,3,101981),
  f(102165,1,3),t(102534,0,3,0),t(102534,5,3,0),s(102718,104194,[[102718,3.5,3],[102811,3.5,3],[102903,3.5,2],[102995,3.5,2],[103087,2,2],[103180,2,2],[103272,2,2],[103364,2.5,2],[103456,2.5,2],[103548,2.5,2],[103641,2.5,2],[103733,2.5,2],[103825,2.5,2],[103917,2.5,2],[104010,2.5,2],[104102,2.5,3],[104194,2.5,3]]),
  t(103087,0,3,0),t(103272,0,4,0),t(103456,0,2,0),t(103641,2,2,0),
  t(103825,1,3,0),t(104286,4,2,0),t(104378,6,2,0),t(104563,4,2,0),
  t(104747,1,3,0),t(105301,3,4,0),t(105670,5,4,0),t(106039,1,4,0),
  t(106592,2,2,0),t(106592,6,2,0),t(106961,2,2,0),t(106961,7,2,0),
  t(107330,1,2,0),t(107330,8,2,0),t(107699,0,2,0),t(107699,8,2,0),
  t(108252,5,4,0),h(108621,3,4,109359),t(108990,7,3,0),f(109543,2,2),
  t(109912,7,3,0),t(110097,5,3,0),t(110650,7,3,0),t(111019,6,2,0),
  t(111203,3,4,0),t(111388,0,4,0),t(111757,3,4,0),t(112126,8,2,0),
  t(112495,3,4,0),t(112863,6,2,0),t(113048,2,2,0),s(113232,114708,[[113232,3,3],[113786,4,2],[114247,4,2],[114524,4,2],[114708,4,2]]),
  t(113601,4,2,0),t(113786,1,4,0),t(113970,0,6,0),t(114155,0,2,0),
  t(114339,2,2,0),t(114892,0,3,0),t(114985,1,3,0),f(115077,0,2),
  h(115446,2,1,116184,0,[[115446,2,1],[115815,1,3],[116184,1,4]]),t(115815,0,3,0),t(116276,0,4,0),t(116553,0,3,0),
  t(116553,5,3,0),t(116737,1,3,0),t(116921,4,2,0),t(117290,2,2,0),
  t(117475,0,4,0),t(117659,2,2,0),t(117844,6,2,0),t(118028,5,3,0),
  t(118397,7,3,0),t(118766,0,2,0),t(119135,3,4,4),t(119504,7,3,0),
  t(119688,3,4,0),f(119873,0,4),t(120242,1,4,0),t(120426,0,4,0),
  t(120611,1,4,0),t(120795,0,2,0),t(120979,1,3,0),t(121348,5,3,0),
  t(121717,7,3,0),t(121809,5,3,0),t(121902,8,2,0),t(122086,5,4,0),
  t(122271,4,2,0),t(122271,8,2,0),t(122455,5,3,0),t(122824,2,2,0),
  t(123193,6,2,0),t(123285,3,3,0),t(123377,8,2,0),t(123562,5,3,0),
  f(123931,7,3),t(124300,5,3,0),t(124392,4,2,0),t(124669,2,2,0),
  t(124853,4,1,0),t(125037,2,2,0),t(125222,3,4,0),t(125406,5,3,0),
  t(125591,6,4,0),t(125775,5,4,0),t(125960,4,2,0),t(126144,1,4,0),
  t(126329,0,2,0),t(126513,1,3,0),h(126882,0,2,127343),t(127435,4,2,0),
  t(127897,2,2,0),t(127989,6,1,0),t(128358,4,2,0),t(128450,7,3,0),
  t(128542,5,3,0),t(128727,1,4,0),t(128727,7,3,0),t(129095,6,2,0),
  t(129280,7,3,0),f(129464,5,4),t(129833,3,3,0),t(129926,1,3,0),
  t(130018,4,2,0),t(130110,2,2,0),t(130202,0,4,0),t(130387,0,2,0),
  t(130756,2,6,0),t(130940,5,4,0),t(131124,4,2,0),t(131309,2,2,0),
  t(131493,0,3,0),t(131678,1,4,0),t(131862,0,2,0),t(132231,1,3,0),
  f(132416,0,4),t(132785,0,2,0),t(132877,1,3,0),t(132969,0,2,0),
  t(133153,2,2,0),t(133338,5,3,0),t(133522,8,2,0),t(133522,4,2,0),
  t(133707,5,3,0),t(133799,8,2,0),t(133891,3,4,0),t(134076,5,4,0),
  t(134168,4,2,0),t(134260,6,2,0),t(134445,8,2,0),s(134629,135828,[[134629,3,2],[134721,3,2],[134814,1,2],[134906,2,2],[134998,2,3],[135090,2,3],[135182,2,3],[135275,2.5,3],[135367,3,3],[135459,3,3],[135551,3.5,2],[135644,3,2],[135736,3,2],[135828,3,2]]),
  t(135090,8,2,0),t(135275,7,3,0),t(135920,2,2,0),t(136105,3,4,0),
  t(136289,6,2,0),t(136474,6,4,0),t(136658,5,3,0),f(136843,3,4),
  t(137211,6,2,0),t(137396,8,2,0),t(137488,3,3,0),t(137580,5,4,0),
  t(138226,4,2,0),h(138318,5,4,138964,0,[[138318,5,4],[138687,6,3],[138964,7,1]]),t(139056,1,4,0),t(139240,4,1,0),
  t(139333,6,2,0),t(139425,6,4,0),t(139794,8,2,0),t(139886,5,3,0),
  t(139978,8,2,0),t(140163,6,2,0),t(140255,4,2,0),t(140439,5,4,0),
  t(140532,3,3,0),t(140808,6,2,0),t(140901,7,3,0),t(141454,6,2,0),
  f(141546,3,3),t(142192,5,4,0),t(142468,8,2,0),t(142561,5,4,0),
  t(142653,5,2,0),t(143298,2,2,0),t(144221,3,4,0),t(144959,5,4,0),
  t(145328,3,4,0),t(146434,2,2,0),t(146619,4,2,0),t(146803,6,2,0),
  t(146988,8,2,0),t(147172,5,4,0),t(147910,6,4,0),t(147910,1,3,0),
  t(148094,5,4,0),t(148187,6,4,0),t(148463,6,4,0),t(148463,1,3,0),
  t(148648,4,6,0),f(148832,7,3),
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
  t(1852,5,4,0),t(4499,0,10,0),t(5381,5,4,0),t(5734,5,4,0),
  t(6440,4,6,0),t(8382,3,4,0),t(9264,0,6,0),t(9970,2,6,0),
  t(10676,4,6,0),t(12088,2,6,0),t(12441,7,3,0),t(12441,0,3,0),
  t(13853,6,4,0),t(14206,5,4,0),t(14911,2,6,0),t(16323,0,6,0),
  t(18441,0,4,0),h(19147,1,3,19941,0,[[19147,1,3],[19588,0,4],[19941,0,6]]),t(21265,0,6,0),t(21971,0,6,0),
  t(23383,2,6,0),t(24441,5,4,0),t(26206,2,6,0),t(27265,1,3,0),
  t(27618,2,6,0),t(28677,5,4,0),t(31324,4,6,0),t(31854,4,6,0),
  t(32560,3,4,0),t(33265,0,6,0),t(34677,0,6,0),t(35736,1,4,0),
  t(36089,0,6,0),t(37501,2,6,0),t(39619,4,6,0),t(40325,4,6,0),
  t(41207,2,6,0),t(42442,2,6,0),t(43148,0,6,0),h(43854,0,6,44825),
  t(45443,0,10,0),t(46149,3,4,0),t(48090,5,4,0),t(49325,6,4,0),
  t(49678,4,6,0),t(49855,3,4,0),t(51796,1,4,0),t(52678,0,6,0),
  h(53384,0,4,54443),t(54796,0,3,0),t(54796,7,3,0),t(55326,5,4,0),
  t(55679,3,4,0),t(57620,5,4,1),t(58149,6,4,0),t(59032,4,6,0),
  t(59208,6,4,0),t(60973,5,4,0),t(61149,6,4,0),t(61855,5,4,0),
  t(63444,2,6,0),t(63797,1,4,0),t(63973,2,6,0),t(64679,1,4,0),
  t(66444,0,4,0),t(67503,2,6,0),t(67856,0,6,0),t(68209,0,4,0),
  t(69268,0,6,0),t(69621,0,4,0),t(70326,0,6,0),t(74033,2,6,0),
  h(75974,5,4,77209),t(78092,3,4,0),t(79680,0,6,0),t(80386,0,10,0),
  t(81621,1,4,0),t(81974,3,4,0),t(82504,5,4,0),t(83210,6,4,0),
  t(84445,6,4,0),t(85327,6,4,0),t(85504,6,4,0),t(87269,7,3,0),
  t(87269,0,3,0),t(89033,4,6,0),t(90445,3,4,0),t(91151,4,6,0),
  t(91857,4,6,0),h(93269,4,6,94063,0,[[93269,4,6],[93710,5,4],[94063,6,3]]),t(94681,2,6,0),t(96093,0,6,0),
  t(97505,2,6,0),t(98210,4,6,0),t(98916,2,6,0),t(100328,0,6,0),
  t(101034,1,4,0),t(101740,2,6,0),t(102446,4,6,0),h(103152,4,6,104387),
  t(105623,4,6,0),t(105976,6,4,0),t(107564,4,6,0),h(108093,4,6,108976),
  t(109682,4,6,0),t(110564,3,4,2),t(111094,4,6,0),t(112329,6,4,0),
  t(113741,5,4,0),t(114623,3,4,0),t(114800,2,6,0),t(116741,0,6,0),
  t(117270,0,3,0),t(117270,7,3,0),t(117623,0,6,0),t(118682,0,4,0),
  t(119035,0,6,0),t(120447,0,10,0),t(120977,2,6,0),t(122918,5,4,0),
  t(123624,6,4,0),t(124683,4,6,0),t(126094,4,6,0),t(127506,6,4,0),
  h(129271,5,3,130683),t(132448,3,4,0),t(133154,5,4,0),t(133683,3,4,0),
  t(134036,4,6,0),t(134742,6,4,0),t(135448,4,6,0),t(135977,2,6,0),
  t(136860,1,4,0),h(138272,2,3,139684,0,[[138272,2,3],[138625,1,4],[138978,0,6],[139331,1,4],[139684,2,3]]),t(139860,0,6,0),t(140389,2,6,0),
  t(140566,1,3,0),t(141801,0,4,0),t(142507,0,4,0),t(143213,1,4,0),
  t(143919,0,6,0),t(145331,0,6,0),t(145507,1,4,0),t(146037,0,4,0),
  t(148155,0,6,0),t(148684,1,3,0),h(149037,2,6,150449),t(151508,5,4,0),
  t(151861,6,4,0),t(153978,4,6,0),t(154155,2,6,0),t(154684,0,6,0),
  t(155743,0,3,0),t(155743,7,3,0),t(156449,0,3,0),t(157155,0,10,0),
  t(157332,1,3,0),t(159096,2,6,0),t(159626,5,4,0),t(160332,4,6,0),
  t(161214,6,4,0),t(161391,6,4,0),h(161744,4,6,163155),t(163332,5,4,0),
  h(164038,4,6,165273),t(165450,5,4,0),t(165979,4,6,3),t(167391,4,6,0),
  t(167568,4,6,0),t(169509,3,3,0),h(169685,4,6,170921,0,[[169685,4,6],[170038,5,4],[170303,6,3],[170656,5,4],[170921,4,6]]),t(171627,4,6,0),
  t(172332,4,6,0),t(173391,4,6,0),t(176215,4,6,0),t(177627,2,6,0),
  t(179039,0,6,0),t(179745,2,6,0),t(181157,5,4,0),t(183274,2,6,0),
  t(183980,1,4,0),t(184686,0,6,0),t(185392,0,6,0),t(186804,0,4,0),
  t(187686,3,3,0),t(188392,0,6,0),t(189098,0,6,0),t(190334,0,6,0),
  t(191039,0,3,0),t(191039,7,3,0),t(192098,2,6,0),t(193157,4,6,0),
  t(194040,0,10,0),t(194216,5,4,0),t(195981,3,4,0),t(196334,3,4,0),
  t(197569,1,4,0),h(197746,0,6,199158),t(199687,0,6,0),t(200569,3,4,0),
  t(201099,0,6,0),t(201628,0,4,0),t(202511,0,6,0),t(203393,2,6,0),
  t(203570,4,6,0),t(204099,6,4,0),t(205334,4,6,0),t(205511,4,6,0),
  h(207629,5,4,208511),t(209041,4,6,0),t(209570,6,4,0),t(210452,5,4,0),
  t(210805,6,4,0),t(211864,4,6,0),t(212747,5,4,0),t(212923,3,4,0),
  t(213276,1,4,0),t(214335,0,4,0),t(214688,0,6,0),t(215394,3,4,4),
  t(216276,3,4,0),t(216629,4,6,0),t(217159,0,3,0),t(217159,7,3,0),
  h(218394,6,3,219718,0,[[218394,6,3],[218747,4,6],[219100,6,3],[219365,4,6],[219718,6,3]]),t(219806,7,3,0),t(220512,4,6,0),t(221394,5,4,0),
  h(221924,4,6,223336),t(224571,0,6,0),t(224747,0,10,0),t(225277,0,6,0),
  t(225453,0,6,0),t(226336,2,6,0),t(228983,5,4,0),t(229512,6,4,0),
  t(231101,5,4,0),t(233395,3,4,0),t(235160,1,4,0),t(235336,0,6,0),
  t(236219,3,4,0),h(237983,5,4,238954),t(239042,6,4,0),t(240454,5,4,0),
  t(241866,2,6,0),t(243631,1,4,0),t(243807,3,4,0),t(244337,5,4,0),
  t(244690,6,4,0),t(246102,5,4,0),t(246807,4,6,0),t(247513,4,6,0),
  t(248925,6,4,0),t(249631,5,4,0),t(250337,2,6,0),t(251043,0,6,0),
  t(251749,0,4,0),t(253161,0,4,0),t(254573,0,3,0),t(254573,7,3,0),
  t(255102,0,4,0),t(256867,0,6,0),t(258279,2,6,0),t(258985,1,4,0),
  t(259691,0,6,0),t(260220,1,4,0),t(262514,0,6,0),t(263926,0,10,0),
  h(265162,4,3,266573,0,[[265162,4,3],[265514,3,4],[265867,3,4],[266220,2,6],[266573,2,6]]),t(266750,5,4,0),t(267985,3,4,0),t(270809,1,4,0),
  t(271515,3,4,0),
// </pandora-boss-v3-easy-notes>
])(mhTap,mhHoldV2,mhFlick,mhSlideV2);
const pandoraBossNormalNotes=((t,h,f,s)=>[
// <pandora-boss-v3-normal-notes>
  f(1852,1,4),t(4323,0,3,0),t(4499,0,10,0),t(5381,3,4,0),
  t(6440,0,6,0),t(6970,5,4,0),t(8382,3,4,0),t(9264,0,6,0),
  t(9970,2,6,0),t(10676,4,6,0),t(11558,4,6,0),t(12088,2,6,0),
  t(12441,0,3,0),t(12441,7,3,0),t(13853,0,4,0),t(14206,3,4,0),
  t(14911,4,6,0),t(15794,3,4,0),t(16323,4,6,0),t(18441,5,3,0),
  h(19147,8,2,19941,1,[[19147,8,2],[19588,6,4],[19941,4,6]]),h(20559,6,2,21794),f(21971,2,6),t(23383,0,6,0),
  t(24441,3,4,0),t(26206,0,6,0),t(26912,2,6,0),t(27618,4,6,0),
  t(28677,7,3,0),h(29030,6,4,30177),t(31324,0,6,0),t(31854,4,6,0),
  t(32560,3,3,0),t(33265,4,6,0),t(34677,4,6,0),t(35383,7,3,0),
  t(35736,3,4,0),t(36089,4,6,0),f(37501,4,6),t(39619,2,6,0),
  t(40325,2,6,0),t(41207,0,6,0),h(41737,4,6,42972),t(43148,2,6,0),
  h(43854,4,6,44825),t(45443,2,6,0),t(46149,5,4,0),t(46502,7,3,0),
  t(48090,5,3,0),t(49325,3,4,0),t(49678,0,10,0),t(49855,0,3,0),
  t(49855,7,3,0),t(51090,0,6,0),t(51796,5,3,0),f(52678,4,6),
  t(54620,5,4,0),t(54796,3,4,0),t(55326,5,3,0),t(55679,3,3,0),
  t(57620,1,3,1),t(58149,3,4,0),t(59032,4,6,0),t(59208,5,4,0),
  t(60444,1,3,0),t(60973,3,4,0),t(61149,5,3,0),t(61855,6,4,0),
  t(63444,4,6,0),t(63797,3,4,0),t(63973,0,6,0),t(64679,0,3,0),
  t(64679,7,3,0),f(66444,0,3),t(66797,4,2,0),t(67503,4,6,0),
  t(67856,2,6,0),t(68209,0,3,0),h(68562,2,6,69444,0,[[68562,2,6],[68826,3,4],[69179,4,3],[69444,4,2]]),t(69621,5,3,0),
  t(70326,4,6,0),t(74033,4,6,0),t(75444,2,6,0),h(75974,6,4,77209),
  t(78092,5,4,0),t(78268,4,6,0),t(79680,4,6,0),t(80386,4,6,0),
  t(81092,3,4,0),t(81621,1,4,0),f(81974,0,4),t(82504,1,4,0),
  t(83210,3,4,0),t(84445,1,4,0),t(85327,0,4,0),t(85504,0,4,0),
  t(87269,0,3,0),t(87269,7,3,0),t(89033,0,10,0),t(90445,5,3,0),
  t(91151,2,6,0),t(91857,0,6,0),h(93269,0,4,94063,1),t(94681,0,6,0),
  t(96093,2,6,0),t(97328,4,6,0),t(97505,4,6,0),t(98210,4,6,0),
  f(98916,4,6),t(100328,2,6,0),t(101034,5,4,0),t(101387,3,4,0),
  t(101740,0,6,0),t(102446,2,6,0),h(103152,6,2,104387,0,[[103152,6,2],[103505,5,4],[103770,4,6],[104123,5,4],[104387,6,2]]),t(105623,2,6,0),
  t(105976,1,4,0),t(106329,0,4,0),t(107564,2,6,0),t(108093,4,6,0),
  t(108799,1,3,2),t(109682,0,6,0),t(110564,1,3,0),t(111094,2,6,0),
  t(112329,5,4,0),f(112505,4,6),t(113564,3,4,0),t(113741,7,3,0),
  t(113741,0,3,0),t(114623,3,3,0),t(114800,4,6,0),t(116741,2,6,0),
  t(117270,5,4,0),t(117623,4,6,0),t(118682,3,4,0),t(119035,4,6,0),
  t(119212,4,6,0),t(120447,0,10,0),t(120977,4,6,0),t(122918,3,4,0),
  t(123624,6,4,0),t(124683,2,6,0),t(125389,5,3,0),f(126094,0,6),
  t(127506,0,3,0),h(129271,0,2,130683),t(131389,0,4,0),t(132448,0,3,0),
  t(133154,1,4,0),t(133683,0,4,0),t(134036,0,6,0),t(134742,3,4,0),
  t(135448,0,6,0),t(135977,2,6,0),t(136860,5,3,0),h(138272,2,6,139684),
  t(139860,0,6,0),t(140389,0,6,0),t(140566,0,2,0),t(141801,0,4,0),
  f(142507,1,4),t(143213,0,3,0),t(143919,0,6,0),t(144448,0,3,0),
  t(144448,7,3,0),t(145331,4,6,0),t(145507,7,3,0),t(146037,5,3,0),
  t(148155,4,6,0),t(148684,8,2,0),h(149037,4,6,150449,0,[[149037,4,6],[149390,5,4],[149743,6,2],[150096,5,4],[150449,4,6]]),t(151508,5,3,0),
  t(151861,7,3,0),t(152214,5,4,0),t(153978,4,6,0),t(154155,4,6,0),
  t(154331,2,6,0),t(154684,0,6,0),f(155390,3,4),t(155743,5,4,0),
  t(156449,8,2,0),t(156626,6,4,0),t(157155,0,10,0),t(157508,4,6,0),
  t(159096,4,6,0),t(159626,7,3,0),t(159626,0,3,0),t(160155,7,3,0),
  t(160332,4,6,0),t(161214,3,3,0),t(161391,5,4,0),h(161744,2,6,163155),
  t(163332,1,3,0),h(163685,6,2,165097,1),t(165450,5,3,0),t(165979,4,6,3),
  f(166862,7,3),t(167391,4,6,0),t(167568,4,6,0),t(169509,4,2,0),
  h(169685,4,6,170921),t(171627,2,6,0),t(172332,4,6,0),t(173391,4,6,0),
  t(175333,2,6,0),t(176215,0,6,0),t(177627,2,6,0),t(179039,4,6,0),
  t(179745,4,6,0),t(181157,7,3,0),t(181862,4,6,0),t(183274,0,6,0),
  t(183980,5,3,0),f(184686,2,6),t(185392,0,6,0),h(186098,6,2,187069,0,[[186098,6,2],[186451,5,4],[186716,5,4],[187069,6,2]]),
  t(188392,2,6,0),t(189098,4,6,0),t(189275,4,2,0),t(190334,0,6,0),
  t(191039,0,3,0),t(191039,7,3,0),t(192098,2,6,0),t(192451,4,6,0),
  t(193157,0,6,0),t(194040,0,10,0),t(194216,7,3,0),t(195981,5,3,0),
  t(196334,6,4,0),t(197569,6,4,0),h(197746,4,6,199158),f(199687,2,6),
  t(200393,0,6,0),t(200569,0,3,0),t(201099,0,6,0),t(201628,3,4,0),
  t(202511,0,6,0),t(203393,4,6,0),t(203570,2,6,0),t(204099,1,3,0),
  t(204805,0,4,0),t(205334,0,6,0),t(205511,2,6,0),h(207629,5,3,208511),
  t(209041,2,6,0),t(209570,6,4,0),t(210452,7,3,0),t(210452,0,3,0),
  f(210805,5,3),t(211864,0,6,0),t(212394,5,4,0),t(212747,3,3,0),
  t(212923,6,4,0),t(213276,5,4,0),t(214335,5,3,0),t(214688,4,6,0),
  t(215394,7,3,0),t(216276,3,3,0),t(216629,0,6,0),t(217159,3,3,4),
  t(217512,1,3,0),h(218218,0,3,219629),t(219806,0,2,0),t(220512,2,6,0),
  t(221394,0,3,0),t(221394,7,3,0),h(221924,2,2,223336,1,[[221924,2,2],[222277,2,3],[222630,1,4],[222983,1,4],[223336,0,6]]),f(223865,0,4),
  t(224571,0,6,0),t(224747,0,10,0),t(225277,0,6,0),t(225453,2,6,0),
  t(226336,4,6,0),t(228983,5,3,0),t(229512,6,4,0),t(231101,5,3,0),
  t(232865,2,6,0),t(233395,7,3,0),t(235160,7,3,0),t(235336,4,6,0),
  t(236219,7,3,0),h(237983,5,4,238954),t(239042,3,4,0),f(240101,0,4),
  t(240454,0,4,0),t(241337,2,2,0),t(241866,2,6,0),t(243631,0,4,0),
  t(244337,1,4,0),t(244690,0,4,0),t(245749,0,4,0),t(246102,1,3,0),
  t(246807,2,6,0),t(247513,4,6,0),t(248396,0,6,0),t(248925,1,3,0),
  t(249631,3,3,0),t(250337,4,6,0),t(251043,4,6,0),t(251749,5,3,0),
  f(252631,4,6),t(253161,6,4,0),t(254573,0,3,0),t(254573,7,3,0),
  t(255102,6,4,0),t(256867,4,6,0),t(257573,2,6,0),t(258279,0,6,0),
  t(259691,0,6,0),t(260220,0,4,0),t(260926,0,4,0),t(262514,0,6,0),
  t(263220,1,3,0),t(263926,0,10,0),h(265162,0,6,266573,0,[[265162,0,6],[265514,0,4],[265867,0,4],[266220,0,3],[266573,1,2]]),t(266750,0,3,0),
  t(267985,1,4,0),t(270456,3,4,0),f(270809,6,4),
// </pandora-boss-v3-normal-notes>
])(mhTap,mhHoldV2,mhFlick,mhSlideV2);
const pandoraBossHardNotes=((t,h,f,s)=>[
// <pandora-boss-v3-hard-notes>
  f(1852,1,4),t(2558,5,4,0),t(4323,1,3,0),t(4499,1,8,0),
  t(4676,5,4,0),t(5381,6,4,0),t(5734,5,4,0),t(6440,2,5,0),
  t(6970,0,4,0),t(6970,7,3,0),t(8382,0,4,0),t(8382,7,3,0),
  t(9264,0,5,0),t(9617,1,3,0),t(9970,2,5,0),t(10235,4,5,0),
  t(10676,5,5,0),t(11558,4,5,0),t(11823,5,5,0),t(12088,4,5,0),
  t(12441,6,4,0),f(13147,5,4),t(13853,6,4,0),t(14206,5,4,0),
  t(14911,5,5,0),t(15794,0,4,0),t(15794,7,3,0),t(16323,2,5,0),
  t(16853,5,5,0),t(17735,5,4,0),t(18441,5,3,0),t(20118,2,5,0),
  t(21265,4,5,0),t(21529,2,5,0),t(21971,0,5,0),t(22500,2,5,0),
  t(23383,4,5,0),t(24088,5,3,0),t(24441,3,4,0),t(24971,7,3,0),
  f(26206,4,5),t(26912,5,5,0),t(27265,6,1,0),t(27618,5,5,0),
  t(28677,3,3,0),t(28942,4,5,0),t(29030,6,4,0),t(31324,0,5,0),
  t(31854,4,5,0),t(32560,3,3,0),t(32824,5,5,0),t(32913,3,4,0),
  t(33265,5,5,0),t(34677,4,5,0),h(35119,7,1,35913,0,[[35119,7,1],[35560,6,3],[35913,5,5]]),t(36089,4,5,0),
  t(36530,4,5,0),t(37501,2,5,0),f(38913,0,5),t(39354,4,5,0),
  t(39619,1,8,0),t(40325,5,5,0),t(41207,2,5,0),s(41737,42972,[[41737,3,4],[42178,4,3],[42442,4,3],[42619,4,3],[42884,4,2],[42972,4,2]]),
  t(43148,4,5,0),t(43854,2,5,0),t(44560,1,4,0),t(45443,0,5,0),
  t(46149,1,4,0),t(46502,3,3,0),t(47031,5,3,0),h(47825,5,5,48355,1),
  t(49237,4,5,0),t(49678,4,5,0),t(49855,6,4,0),t(49855,0,3,0),
  t(50208,8,1,0),f(51090,2,5),t(51531,4,5,0),t(51796,1,3,0),
  t(52678,0,5,1),s(53384,54443,[[53384,1,2],[53473,1,2],[53826,2.5,3],[54090,2.5,3],[54355,3,4],[54443,3,4]]),t(54620,5,4,0),t(54796,3,4,0),
  t(55326,1,3,0),t(55679,0,3,0),t(57443,0,3,0),t(57620,1,3,0),
  t(58149,3,4,0),t(59032,0,5,0),t(59120,5,4,0),t(60444,0,3,0),
  t(60973,3,4,0),t(61149,7,3,0),t(61855,3,4,0),f(62385,0,4),
  s(62826,64061,[[62826,3.5,3],[63091,3.5,3],[63355,2.5,3],[63620,1,3],[63885,1,3],[64061,1,3]]),t(64679,1,3,0),t(65032,3,3,0),t(65650,0,5,0),
  h(66444,0,3,66885),h(67503,0,5,68032),t(68209,0,3,0),t(68209,6,3,0),
  h(68562,1,4,69444),t(69621,0,3,0),t(70326,0,5,0),t(70679,3,4,0),
  h(71121,6,1,72532),h(73062,8,1,73944),t(74033,4,5,0),t(75444,1,8,0),
  h(75974,6,4,77209),f(77386,3,4),t(78092,5,4,0),t(78268,2,5,0),
  t(78974,0,5,0),t(79503,3,4,0),t(79680,4,5,0),t(80386,0,5,0),
  t(81092,3,4,0),t(81621,5,4,0),t(81798,6,4,0),t(81974,5,4,0),
  t(82504,3,4,0),t(83210,1,4,0),h(83474,3,5,84092,1,[[83474,3,5],[83827,4,3],[84092,5,1]]),t(84445,1,4,0),
  t(85327,0,4,0),t(85504,3,4,0),t(86916,5,3,0),t(87269,6,4,0),
  t(87269,0,3,0),f(89033,5,5),t(89739,5,3,0),t(90445,3,3,0),
  t(91151,0,5,0),t(91857,0,5,0),t(92828,0,5,0),t(93269,1,4,0),
  t(93975,3,3,0),t(94681,4,5,0),t(95387,3,4,0),t(96093,0,5,0),
  t(97328,2,5,0),t(97505,4,5,0),t(98210,2,5,0),t(98563,1,4,0),
  t(98916,2,5,0),t(100328,0,5,0),t(100681,1,4,0),f(101034,0,4),
  t(101387,1,4,0),t(101740,2,5,0),t(102446,0,5,2),t(103152,0,5,0),
  t(103328,1,3,0),t(104034,2,5,0),t(104211,4,5,0),h(104564,5,5,105270),
  t(105446,5,5,0),t(105623,2,5,0),h(105976,2,1,106682,0,[[105976,2,1],[106329,0,5],[106682,2,1]]),t(107123,2,8,0),
  t(107564,4,5,0),t(107829,2,5,0),t(108093,0,5,0),t(108799,0,3,0),
  t(108799,6,3,0),f(109682,0,5),h(110564,0,3,110917),t(111094,0,5,0),
  t(111535,2,5,0),t(111623,1,4,0),t(112329,3,4,0),t(112505,0,5,0),
  t(112947,0,5,0),t(113476,0,5,0),t(113741,5,3,0),t(114623,7,3,0),
  t(114800,2,5,0),t(115329,0,5,0),t(116476,0,5,0),t(116741,2,5,0),
  t(117182,4,5,0),h(117623,5,5,118418),t(118682,0,4,0),t(119035,2,5,0),
  f(119212,5,5),t(119741,1,3,0),t(119741,7,3,0),t(120447,0,5,0),
  h(120977,2,5,121594,1),t(122830,4,5,0),t(123271,7,3,0),t(123624,5,4,0),
  t(124683,0,5,0),t(125389,3,3,0),t(125653,4,5,0),t(126094,5,5,0),
  t(126536,4,5,0),t(126712,3,4,0),t(127506,1,3,0),t(127859,5,4,0),
  s(129271,130683,[[129271,3.5,3],[129536,3.5,3],[129801,2,3],[130065,0.5,3],[130330,1,3],[130595,1.5,3],[130683,2,3]]),t(131389,1,4,0),t(132183,0,5,0),f(132448,0,3),
  t(133154,0,4,0),t(133595,2,5,0),t(133683,1,4,0),t(134036,2,5,0),
  t(134389,5,3,0),t(134742,6,4,0),t(135448,4,5,0),t(135977,2,8,0),
  t(136860,3,3,0),t(137566,5,3,0),t(137830,5,5,0),s(138272,139684,[[138272,3,4],[138448,2,4],[138713,1,3],[138801,1,3],[139154,1,3],[139684,1,2]]),
  t(139860,2,5,0),t(140389,4,5,0),t(140478,4,1,0),h(141095,0,5,142507,0,[[141095,0,5],[141448,1,3],[141801,2,1],[142154,1,3],[142507,0,5]]),
  f(143213,0,3),t(143919,0,5,0),t(144184,0,3,0),t(144184,6,3,0),
  t(144448,1,4,0),t(145331,0,5,0),t(145507,1,3,0),t(146037,3,3,0),
  t(146390,5,4,0),t(148155,4,5,0),t(148684,8,1,0),s(149037,150449,[[149037,3,2],[149213,3,3],[149302,3,3],[149390,3,3],[149566,4,4],[149743,4,4],[149919,4,4],[150096,4,3],[150272,4,3],[150449,4,2]],1),
  t(151155,0,3,0),t(151508,3,3,0),t(151861,7,3,0),t(152214,3,4,0),
  t(152831,0,5,0),t(152920,5,4,0),t(153978,2,5,0),t(154155,0,5,0),
  f(154331,0,5),t(154684,4,5,0),t(154861,3,4,0),t(155390,1,4,0),
  t(155743,0,4,0),h(156449,2,1,157067),t(157155,4,5,0),t(157243,3,3,0),
  t(157508,5,5,0),t(159096,2,5,0),t(159361,5,4,0),t(159626,6,4,0),
  t(160067,4,5,0),t(160155,7,3,0),t(160332,5,5,0),t(161214,5,3,0),
  t(161391,5,4,0),t(161567,7,3,0),s(161744,163155,[[161744,3,2],[161920,4,3],[162008,4,3],[162097,2,3],[162273,2,4],[162450,2,4],[162626,2,4],[162803,2,3],[162979,2,3],[163155,2,2]]),f(163332,3,3),
  s(163685,165097,[[163685,1.5,3],[163950,0,3],[164214,1,3],[164479,1,3],[164744,2.5,3],[165009,4,3],[165097,4,3]]),t(165450,5,3,0),t(165979,2,8,3),t(166420,5,3,0),
  t(166862,3,3,0),t(167391,0,5,0),t(167568,2,5,0),t(169156,2,1,0),
  t(169509,3,1,0),s(169597,170921,[[169597,3,2],[169685,3,2],[170038,2.5,3],[170391,1.5,3],[170832,1,4],[170921,1,4]]),t(172244,2,5,0),h(172332,5,5,173127),
  t(173215,4,5,0),t(173391,5,5,0),h(175333,4,5,175862),f(176215,2,5),
  t(177627,0,5,0),t(177803,0,5,0),t(178862,0,5,0),t(179039,0,5,0),
  t(179745,2,5,0),t(180451,4,5,0),t(181157,7,3,0),t(183098,3,3,0),
  t(183274,5,5,0),t(183980,5,3,0),t(184686,5,5,0),t(184951,4,5,0),
  h(185392,4,5,186098,1),t(186539,2,5,0),t(186804,6,3,0),t(186804,0,3,0),
  t(187686,0,1,0),f(188392,2,5),t(189098,5,5,0),t(189275,6,1,0),
  t(189628,7,3,0),t(190334,4,5,0),t(191039,7,3,0),t(192098,0,5,0),
  t(192363,1,5,0),t(192451,0,5,0),t(192628,0,5,0),t(193157,2,5,0),
  t(194040,0,5,0),t(194216,1,3,0),t(195099,0,4,0),t(195981,0,3,0),
  t(196334,1,4,0),t(197569,0,4,0),t(197746,2,5,0),s(197834,199246,[[197834,1,4],[198010,1,4],[198275,0.5,3],[198716,0,3],[199158,0,2],[199246,0,2]]),
  f(199687,5,5),t(200393,2,8,0),t(200569,3,3,0),t(201099,0,5,0),
  t(201628,0,4,0),t(202511,0,5,0),t(203393,0,5,0),h(203570,2,1,204187,0,[[203570,2,1],[203923,1,3],[204187,0,5]]),
  t(204805,0,4,0),t(205334,0,5,0),t(205511,0,5,0),t(206040,0,5,0),
  t(207187,0,5,0),h(207629,1,3,208511,1),t(209041,2,5,0),t(209570,6,4,0),
  t(210452,0,3,0),t(210805,3,3,0),t(211158,8,1,0),f(211864,2,5),
  t(212394,1,4,0),t(212747,5,3,0),t(212923,3,4,0),t(213276,6,4,0),
  t(213453,5,4,0),t(214158,3,3,0),t(214335,1,3,0),t(214688,0,5,0),
  t(214864,2,5,0),t(215394,1,3,0),t(215394,7,3,0),t(215659,4,5,0),
  t(216276,1,3,0),t(216629,4,5,0),t(217070,2,5,0),t(217159,7,3,0),
  f(217512,3,3),s(218218,219629,[[218218,0,3],[218482,0,3],[218747,0.5,3],[219012,1.5,3],[219276,3,3],[219541,3.5,3],[219629,4,3]]),t(220247,4,5,0),t(220512,5,5,0),
  t(221218,5,5,0),t(221394,6,4,0),s(221924,223336,[[221924,3,2],[222012,3,3],[222100,3,3],[222188,3,3],[222277,4,3],[222365,4,4],[222453,4,4],[222541,4,4],[222630,2.5,4],[222718,2.5,4],[222806,2.5,4],[222894,2.5,4],[222983,2.5,3],[223071,2.5,3],[223159,3,3],[223247,3,3],[223336,3,2]]),t(223865,0,4,4),
  t(224394,2,1,0),t(224571,2,5,0),t(224747,4,5,0),t(225277,5,5,0),
  t(225453,4,5,0),t(226336,5,5,0),t(227571,3,3,0),s(228100,229512,[[228100,3,4],[228189,2.5,4],[228277,1,3],[228365,1,3],[228453,1.5,3],[228542,1.5,3],[228630,1.5,3],[228718,1.5,2],[228806,1,2],[228895,1,2],[228983,2,3],[229071,2,3],[229159,1.5,3],[229248,1.5,3],[229336,1.5,3],[229424,2,4],[229512,2,4]]),
  t(231101,5,3,0),t(231542,2,8,0),t(232865,4,5,0),f(234366,0,5),
  t(234807,0,1,0),t(235160,1,3,0),t(235336,0,5,0),t(236219,0,3,0),
  h(236925,0,5,237542,0,[[236925,0,5],[237278,0,3],[237542,1,1]]),t(237983,0,4,0),t(238160,3,3,0),t(238866,5,5,0),
  t(239042,3,4,0),h(239748,0,3,240719,1),t(241337,2,1,0),t(241866,4,5,0),
  t(243631,1,4,0),t(243719,4,5,0),t(244337,0,4,0),t(244337,7,3,0),
  t(244690,6,4,0),t(245749,5,4,0),f(246102,7,3),t(246807,4,5,0),
  t(247160,3,4,0),t(247513,4,5,0),t(247690,6,4,0),t(248396,0,5,0),
  t(248925,3,3,0),t(249366,5,4,0),t(249631,7,3,0),t(250337,4,5,0),
  t(251043,2,5,0),t(251220,0,5,0),t(251749,5,3,0),t(252631,2,5,0),
  t(253161,6,4,0),t(253161,0,3,0),t(254573,0,4,0),t(254573,7,3,0),
  t(255014,4,5,0),t(255102,3,4,0),f(256867,0,5),t(258279,2,5,0),
  t(258720,4,5,0),t(259249,0,5,0),t(259691,2,5,0),t(260220,6,4,0),
  t(261544,4,5,0),t(261632,6,4,0),t(262514,5,5,0),h(263661,8,1,264367,0,[[263661,8,1],[264014,5,5],[264367,8,1]]),
  t(264456,6,4,0),s(265162,266573,[[265162,3,2],[265691,4,3],[266132,4,3],[266220,4,3],[266397,4,4],[266573,4,4]]),t(266662,2,8,0),t(267985,3,4,0),
  t(268515,5,4,0),t(269044,3,4,0),t(270456,0,4,0),t(270809,1,4,0),
  f(271515,0,4),
// </pandora-boss-v3-hard-notes>
])(mhTap,mhHoldV2,mhFlick,mhSlideV2);
const pandoraBossExpertNotes=((t,h,f,s)=>[
// <pandora-boss-v3-expert-notes>
  f(1852,1,4),t(2558,5,4,0),t(3970,3,4,0),t(4323,5,3,0),
  t(4499,2,8,0),t(5381,5,4,0),t(5734,5,4,0),t(6440,5,5,0),
  t(6970,6,4,0),t(6970,0,3,0),t(8382,5,4,0),t(9264,0,2,0),
  t(9264,4,2,0),t(9617,2,2,0),t(9617,6,2,0),t(9970,4,2,0),
  t(9970,8,2,0),t(10235,0,5,0),t(10676,0,5,0),t(11029,1,4,0),
  t(11558,2,5,0),t(11823,4,5,0),f(12088,0,5),t(12441,1,2,0),
  t(12441,5,2,0),t(13147,3,2,0),t(13147,7,2,0),t(13853,1,2,0),
  t(13853,5,2,0),t(14206,6,4,0),t(14206,0,3,0),t(14911,4,5,0),
  t(15794,1,4,0),t(15882,4,5,0),t(16323,2,5,0),t(16853,5,5,0),
  t(17735,5,4,0),t(18441,5,3,0),t(20118,0,5,0),s(20559,21794,[[20559,3,3],[20824,3,3],[21088,3.5,3],[21353,3.5,3],[21618,1.5,3],[21794,0.5,3]]),
  t(21265,2,5,0),t(21971,4,5,0),f(22500,5,5),t(23383,4,5,0),
  t(24088,5,3,0),t(24441,3,4,0),t(24971,5,3,0),t(26206,2,5,0),
  t(26912,0,2,0),t(26912,4,2,0),t(27265,2,2,0),t(27265,6,2,0),
  t(27618,4,2,0),t(27618,8,2,0),t(28324,7,3,0),t(28677,3,3,0),
  t(29030,6,4,0),t(30883,0,5,0),t(31324,2,5,0),t(31854,4,5,0),
  t(32560,7,3,0),t(32824,4,5,0),f(32913,3,4),t(33265,4,5,0),
  t(33795,2,5,0),t(34677,0,5,0),h(35119,4,1,35913,0,[[35119,4,1],[35560,3,3],[35913,2,5]]),t(36089,0,5,0),
  t(36530,5,5,0),t(37501,4,5,0),t(38383,2,5,0),t(39354,0,5,0),
  t(39619,4,5,0),t(40325,1,2,0),t(40325,5,2,0),t(40766,3,2,0),
  t(40766,7,2,0),t(41207,1,2,0),t(41207,5,2,0),s(41737,42972,[[41737,0,3],[42001,1.5,3],[42266,3,3],[42531,4,3],[42795,4,3],[42972,4,3]]),
  t(42266,0,8,0),f(42442,0,5),t(43148,4,5,0),t(43325,4,1,0),
  t(43854,0,5,0),t(44560,0,4,0),t(45443,0,5,0),t(46149,3,4,0),
  t(46502,5,3,0),t(47031,7,3,0),h(47825,5,5,48355,1),t(49237,4,5,0),
  t(49678,4,5,0),t(49855,6,4,0),t(49855,0,3,0),t(50208,8,1,0),
  t(51090,2,5,0),t(51531,4,5,0),t(51796,1,3,0),t(52502,0,4,0),
  f(52678,0,5),s(53384,54443,[[53384,2,2],[53473,2,2],[53826,3.5,3],[54090,3.5,3],[54355,4,4],[54443,4,4]]),s(53384,54443,[[53384,0,2],[54443,2,2]]),t(54620,1,4,0),
  t(54796,0,4,0),t(55326,1,3,0),t(55679,0,3,0),t(57443,0,3,0),
  t(57620,1,3,0),t(58149,3,4,0),t(59032,2,5,0),t(59120,5,4,0),
  t(59208,3,4,0),s(60091,61502,[[60091,0,3],[60355,0.5,3],[60620,1.5,3],[60885,2.5,3],[61149,3.5,3],[61414,4,3],[61502,4,3]]),t(60444,3,3,1),t(60973,3,4,0),
  t(61149,5,3,0),f(61855,5,4),t(62385,0,4,0),t(62385,7,3,0),
  s(62826,64061,[[62826,3,4],[62914,3,4],[63003,3,3],[63091,3,3],[63179,3,3],[63267,3,3],[63355,3,2],[63444,3,2],[63532,1,2],[63620,2,3],[63708,2,3],[63797,2,3],[63885,2,3],[63973,2,4],[64061,2,4]]),t(63267,0,1,0),t(63444,1,5,0),t(64150,8,1,0),
  t(64679,3,3,0),t(65032,0,3,0),t(65650,2,5,0),h(66444,5,3,66885),
  h(67503,4,5,68032),t(68209,7,3,0),h(68562,6,4,69444),t(68915,5,4,0),
  t(69621,3,3,0),t(70150,1,4,0),t(70326,0,5,0),f(70679,1,4),
  h(71121,4,1,72532),h(73062,2,1,73944),t(74033,0,5,0),t(75444,0,5,0),
  h(75974,4,5,77209,0,[[75974,4,5],[76327,4,4],[76592,5,3],[76945,5,2],[77209,6,1]]),t(76327,3,4,0),t(76592,1,8,0),t(76856,0,5,0),
  t(77386,0,4,0),t(77562,0,4,0),t(78092,0,4,0),t(78092,7,3,0),
  t(78268,2,5,0),t(78974,4,5,0),t(79503,6,4,0),f(79680,2,5),
  t(80386,4,5,0),t(80651,5,5,0),t(81092,5,4,0),t(81621,0,2,0),
  t(81621,4,2,0),t(81798,2,2,0),t(81798,6,2,0),t(81974,4,2,0),
  t(81974,8,2,0),t(82504,1,4,0),t(83210,0,4,0),h(83474,3,4,84092,1),
  t(84445,5,4,0),t(85327,5,4,0),t(85504,6,4,0),t(86386,3,4,0),
  t(86916,5,3,0),t(87269,6,4,0),t(89033,0,5,0),f(89739,3,3),
  t(90445,5,3,0),t(90887,5,5,0),t(91151,4,5,0),t(91857,2,5,0),
  t(92828,0,5,0),t(93269,3,4,0),t(93975,7,3,0),t(94681,2,5,0),
  t(95387,0,4,0),t(96093,2,5,0),t(97063,4,5,0),t(97328,2,5,0),
  t(97505,0,5,0),t(98210,0,5,0),t(98916,0,5,0),t(99622,2,5,0),
  f(100328,0,5),t(100681,0,4,0),t(100681,7,3,0),t(101034,1,4,0),
  t(101387,0,4,0),t(101740,0,5,0),t(102446,2,5,0),t(102622,4,5,0),
  t(103152,5,5,0),t(103328,5,3,0),s(104034,105446,[[104034,2,2],[105446,1,2]]),t(104211,4,5,2),
  h(104564,7,1,105270,0,[[104564,7,1],[104917,5,5],[105270,7,1]]),t(105446,2,5,0),t(105623,1,5,0),t(105711,0,5,0),
  h(105976,1,4,106682,1),t(107123,5,5,0),t(107564,2,8,0),t(107829,2,5,0),
  f(108093,0,5),t(108799,0,3,0),t(108799,6,3,0),t(109682,0,5,0),
  t(109858,0,4,0),h(110564,1,3,110917),t(111094,0,5,0),t(111535,2,5,0),
  t(111623,5,4,0),h(112329,1,4,112770),t(112947,2,5,0),t(113476,5,5,0),
  t(113741,3,3,0),t(114358,4,5,0),t(114623,7,3,0),t(114800,0,5,0),
  f(115329,5,5),t(116476,2,5,0),t(116741,4,5,0),t(117182,5,5,0),
  h(117623,4,5,118418),t(118682,0,4,0),t(119035,2,5,0),t(119212,5,5,0),
  t(119741,3,3,0),t(120447,0,5,0),h(120977,2,5,121594,0,[[120977,2,5],[121329,4,1],[121594,2,5]]),t(122830,0,5,0),
  t(122918,3,4,0),t(123271,1,3,0),t(123624,0,4,0),t(124683,0,5,0),
  t(125389,3,3,0),f(125653,0,5),t(126094,4,5,0),t(126536,2,5,0),
  t(126712,6,4,0),t(126712,0,3,0),t(127506,3,3,0),t(127859,6,4,0),
  s(129271,130683,[[129271,3,4],[129448,2.5,3],[129624,3,3],[129801,1,3],[129977,1,2],[130154,1,3],[130330,1,3],[130418,1,3],[130506,2,3],[130683,2,4]],1),t(129801,4,5,0),t(129977,3,4,0),t(130330,4,5,0),
  t(131389,3,4,0),t(132183,0,5,0),t(132448,0,3,0),t(133154,0,4,0),
  t(133595,2,5,0),t(133683,1,4,0),t(134036,2,5,0),f(134389,5,3),
  t(134742,6,4,0),t(135448,2,5,0),t(135977,5,5,0),t(136860,7,3,0),
  t(137830,4,5,0),s(138272,139684,[[138272,4,3],[138536,2.5,3],[138801,0.5,3],[139066,0,3],[139331,0,3],[139595,0,3],[139684,0,3]]),t(139242,1,8,0),t(139860,2,5,0),
  t(140389,0,5,0),t(140478,0,1,0),t(140566,2,1,0),h(141095,3,3,142507),
  t(141801,6,4,0),t(142154,6,4,0),f(143213,3,3),t(143919,4,5,0),
  t(144184,1,3,0),t(144184,7,3,0),t(144448,5,4,0),s(144713,146125,[[144713,3,4],[144801,2.5,4],[144890,3,3],[144978,3,3],[145066,3.5,3],[145154,3.5,3],[145243,1.5,3],[145331,1.5,2],[145419,1.5,2],[145507,3,2],[145596,3,3],[145684,3,3],[145772,3,3],[145860,3,3],[145949,3,3],[146037,3,4],[146125,2.5,4]]),
  t(145331,3,5,0),t(145507,7,3,0),t(146390,5,4,0),t(148155,2,5,0),
  t(148684,6,1,0),s(149037,150449,[[149037,3,2],[149213,2.5,3],[149302,2.5,3],[149390,2.5,3],[149566,4,4],[149743,4,4],[149919,4,4],[150096,4,3],[150272,4,3],[150449,4,2]]),t(149743,4,5,0),t(150008,5,3,0),
  t(151155,7,3,0),t(151508,5,3,0),h(151861,7,3,152390,1),t(152831,2,5,0),
  f(152920,6,4),t(153802,3,4,0),t(153978,4,5,0),t(154155,5,5,0),
  t(154331,4,5,0),t(154684,0,5,0),t(154861,3,4,0),t(155390,6,4,0),
  t(155743,0,4,0),t(155743,7,3,0),h(156449,2,1,157067),t(157155,4,5,0),
  t(157243,3,3,0),t(157332,8,1,0),t(157508,4,5,0),t(159096,0,5,0),
  t(159361,3,4,0),f(159626,5,4),h(160067,5,5,160597),t(161214,7,3,0),
  t(161391,6,4,0),t(161567,7,3,0),s(161744,163155,[[161744,3,2],[161920,3.5,3],[162008,3.5,3],[162097,2,3],[162273,2,4],[162450,2,4],[162626,2,4],[162803,1.5,3],[162979,2,3],[163155,2,2]]),t(162185,0,5,0),
  t(163332,7,3,0),s(163685,165097,[[163685,2.5,4],[163861,0,3],[163950,0,3],[164038,0.5,3],[164391,1,2],[164656,1,3],[164920,2.5,3],[165009,2.5,4],[165097,2.5,4]]),t(164038,2,5,0),t(164214,2,4,0),
  t(164391,3,4,0),t(164744,5,3,0),t(165450,3,3,0),t(165979,2,8,3),
  f(166420,7,3),t(166862,5,3,0),t(167038,3,4,0),t(167391,0,5,0),
  t(167568,0,5,0),t(169156,0,1,0),t(169509,4,1,0),t(169597,2,1,0),
  t(169685,4,5,0),t(170391,7,3,0),t(170391,1,3,0),t(170568,5,5,0),
  t(170921,6,4,0),t(171627,5,5,0),s(171980,173038,[[171980,2,2],[173038,0,2]]),t(172244,4,5,0),
  t(173215,2,5,0),t(173391,5,5,0),h(175333,6,1,175862,1,[[175333,6,1],[175597,5,3],[175862,4,5]]),f(176215,0,5),
  t(176921,1,3,0),t(177627,0,5,0),t(177803,0,5,0),t(179039,0,5,0),
  t(179745,4,5,0),t(180451,0,5,0),t(181157,0,3,0),t(181862,0,5,0),
  t(183098,3,3,0),t(183274,5,5,0),t(183980,7,3,0),t(184686,5,5,0),
  t(184951,0,5,0),h(185392,5,5,186098),t(186539,4,5,0),f(186804,7,3),
  t(187686,0,1,0),t(187951,2,5,0),t(188392,5,5,0),t(188922,4,1,0),
  t(189098,0,5,0),t(189275,4,1,0),t(189628,0,3,0),t(189628,6,3,0),
  t(190334,2,5,0),t(191039,7,3,0),t(192098,4,5,0),t(192363,5,5,0),
  t(192451,4,5,0),t(192628,5,5,0),t(192804,5,4,0),t(193157,4,5,0),
  t(194040,0,5,0),f(194216,1,3),t(195099,0,4,0),t(195981,0,3,0),
  t(196334,1,4,0),t(197569,5,4,0),t(197746,3,5,0),s(197834,199246,[[197834,1.5,4],[198010,1,4],[198275,0.5,3],[198716,0,3],[199158,0,2],[199246,0,2]],1),
  t(198275,1,5,0),t(199687,0,8,0),t(200216,6,1,0),t(200393,4,5,0),
  t(200569,7,3,0),t(201099,4,5,0),t(201628,6,4,0),t(202511,5,5,0),
  t(203393,4,5,0),h(203570,5,5,204187),f(204805,5,4),t(205334,5,5,0),
  t(205511,4,5,0),t(206040,5,5,0),t(207187,2,5,0),h(207629,5,5,208511,0,[[207629,5,5],[207893,6,4],[208246,8,2],[208511,8,1]]),
  t(209041,4,5,0),t(209570,6,4,0),t(209570,0,3,0),t(210452,3,3,0),
  t(210805,0,3,0),t(210982,3,4,0),t(211158,8,1,0),t(211864,2,5,0),
  t(212394,0,4,0),t(212747,0,3,0),f(212923,1,4),t(213276,0,4,0),
  t(213453,1,4,0),t(214335,0,3,4),t(214688,2,5,0),t(214864,0,5,0),
  t(215394,5,3,0),t(215659,0,5,0),t(215923,1,3,0),t(216276,3,3,0),
  t(216629,2,5,0),t(217070,0,5,0),t(217159,5,3,0),t(217512,6,3,0),
  t(217512,0,3,0),s(218218,219629,[[218218,2,2],[218482,2,2],[218747,2.5,3],[219188,3.5,3],[219453,3.5,4],[219541,4,4],[219629,4,4]],1),s(218218,219629,[[218218,0,2],[219629,2,2]]),t(220247,0,5,0),
  t(220512,0,5,0),f(220777,1,3),t(221218,4,5,0),t(221394,3,4,0),
  s(221924,223336,[[221924,1.5,2],[222012,1,3],[222100,1,3],[222188,1.5,3],[222277,2.5,3],[222365,2.5,4],[222453,2.5,4],[222541,2.5,4],[222630,0.5,4],[222718,0.5,4],[222806,0.5,4],[222894,0.5,4],[222983,0.5,3],[223071,1,3],[223159,1,3],[223247,1.5,3],[223336,1.5,2]]),t(222630,4,5,0),t(223865,0,4,0),t(224394,2,1,0),
  t(224571,2,5,0),t(224747,4,5,0),t(225277,5,5,0),t(225453,4,5,0),
  t(225894,0,5,0),t(226336,5,5,0),t(227571,5,3,0),s(228100,229512,[[228100,3,4],[228189,2.5,4],[228277,0.5,3],[228365,0.5,3],[228453,0.5,3],[228542,0.5,3],[228630,1,3],[228718,0.5,2],[228806,0.5,2],[228895,0.5,2],[228983,1.5,3],[229071,1.5,3],[229159,1,3],[229248,0.5,3],[229336,0.5,3],[229424,1.5,4],[229512,1.5,4]]),
  f(228983,4,3),t(231101,1,3,0),t(231542,2,8,0),t(232865,0,5,0),
  t(233395,7,3,0),t(234366,0,5,0),t(234807,0,1,0),t(235160,1,3,0),
  t(235336,0,5,0),h(235336,8,2,242660),t(236219,0,3,0),h(236925,4,1,237542,0,[[236925,4,1],[237278,2,5],[237542,4,1]]),
  t(237983,0,4,0),t(238160,3,3,0),t(238866,5,5,0),t(239042,3,4,0),
  h(239748,0,3,240719,1),t(241337,2,1,0),t(241866,5,5,0),t(242572,2,1,0),
  t(243631,0,4,0),t(243719,2,5,0),t(243807,1,4,0),t(244337,6,4,0),
  t(244337,0,3,0),t(244690,3,4,0),t(245749,0,4,0),t(246102,1,3,0),
  t(246807,2,5,0),t(247160,1,4,0),t(247513,4,5,0),t(247690,3,4,0),
  t(248396,0,5,0),t(248925,0,3,0),t(249366,0,4,0),t(249455,3,4,0),
  f(249631,1,3),t(250337,4,5,0),t(251043,2,5,0),t(251220,4,5,0),
  t(251749,3,3,0),t(252631,0,5,0),t(253161,6,4,0),t(254220,3,4,0),
  t(254573,6,4,0),t(254573,0,3,0),t(255014,2,5,0),t(255102,1,4,0),
  t(256867,0,5,0),t(258279,0,5,0),t(258720,2,5,0),t(259249,0,5,0),
  f(259691,0,5),t(260220,5,4,0),t(261544,4,5,0),t(261632,6,4,0),
  t(262514,0,5,0),t(262603,5,4,0),t(263220,3,3,0),h(263661,5,5,264367,0,[[263661,5,5],[264014,8,1],[264367,5,5]]),
  t(264456,5,4,0),s(265162,266573,[[265162,2,2],[265691,2.5,3],[266132,3,3],[266220,3,3],[266397,3,4],[266573,3,4]]),t(265514,6,4,0),t(266662,1,8,0),
  t(267985,0,4,0),t(268515,0,4,0),t(269044,0,4,0),t(270456,0,4,0),
  t(270809,1,4,0),f(271515,0,4),
// </pandora-boss-v3-expert-notes>
])(mhTap,mhHoldV2,mhFlick,mhSlideV2);
const pandoraBossMasterNotes=((t,h,f,s)=>[
// <pandora-boss-v3-master-notes>
  f(1852,0,3),t(2558,3,3,0),t(3087,8,2,0),t(3970,5,3,0),
  t(4323,8,2,0),t(4499,4,6,0),t(4676,5,3,0),t(5381,3,3,0),
  t(5734,1,3,0),t(6440,0,4,0),t(6440,6,3,0),t(6970,1,3,0),
  t(8382,0,3,0),t(9264,0,2,0),t(9264,4,2,0),t(9617,4,2,0),
  t(9617,8,2,0),t(9970,0,2,0),t(9970,4,2,0),t(10146,3,3,0),
  t(10235,5,4,0),f(10676,3,4),t(11029,5,3,0),t(11558,3,4,0),
  t(11823,0,4,0),t(12088,1,4,0),t(12088,7,3,0),t(12441,3,3,0),
  t(13147,5,3,0),t(13323,7,3,0),t(13853,0,3,0),t(14206,3,3,0),
  t(14911,6,4,0),t(14911,1,3,0),t(15794,5,3,0),t(15882,6,4,0),
  t(16323,5,4,0),t(16853,6,4,0),t(17735,5,3,0),t(18441,4,2,0),
  f(18706,1,4),t(20118,0,4,0),s(20559,21794,[[20559,3,2],[20824,3,2],[21088,3.5,2],[21353,3.5,2],[21618,1.5,2],[21794,0,2]]),t(21265,3,4,0),
  t(21971,1,4,0),t(22412,3,4,0),t(22500,6,4,0),t(23383,5,4,0),
  t(24088,0,2,0),t(24088,4,2,0),t(24441,2,2,0),t(24441,6,2,0),
  t(24794,4,2,0),t(24794,8,2,0),t(24971,4,2,0),t(26206,1,4,0),
  t(26912,2,2,0),t(26912,6,2,0),t(27265,1,2,0),t(27265,7,2,0),
  t(27618,0,2,0),t(27618,8,2,0),f(27971,5,3),t(28324,4,2,0),
  t(28677,2,2,0),t(28942,0,4,0),s(29030,30177,[[29030,2,3],[29118,2,3],[29206,2,2],[29295,2.5,2],[29383,2.5,2],[29471,1,2],[29559,1,2],[29648,1,2],[29736,3,2],[29824,3,2],[29912,3,2],[30001,2.5,2],[30089,2.5,3],[30177,2.5,3]],1),s(29736,30177,[[29736,1,2],[30177,0,2]]),
  t(30883,5,4,0),t(31059,5,4,0),t(31324,5,4,0),t(31854,5,4,0),
  t(32560,0,2,0),t(32824,1,4,0),t(32913,3,3,0),t(33265,5,4,0),
  t(33795,4,6,0),t(34677,5,4,0),h(35119,8,1,35913,0,[[35119,8,1],[35560,7,3],[35913,6,4]]),f(36089,1,4),
  t(36530,6,4,0),t(37501,5,4,0),t(38383,3,4,0),t(38472,5,4,0),
  t(38913,3,4,0),t(39354,5,4,0),t(39619,6,4,0),t(40325,0,2,0),
  t(40325,4,2,0),t(40766,4,2,0),t(40766,8,2,0),t(41207,0,2,0),
  t(41207,4,2,0),s(41737,42972,[[41737,1.5,3],[42178,2.5,2],[42442,3.5,2],[42619,3.5,2],[42884,3.5,2],[42972,3.5,2]]),s(41737,42972,[[41737,0,2],[42972,2,2]]),t(43148,0,4,0),
  t(43325,2,1,0),f(43854,5,4),t(44560,3,3,0),t(44737,5,4,0),
  t(45443,6,4,0),t(46060,3,3,0),t(46149,5,3,0),t(46502,8,2,0),
  t(47031,6,2,0),h(47825,3,4,48355),t(48531,6,4,0),t(49237,0,4,0),
  t(49678,1,4,0),t(49855,2,3,0),t(49855,7,3,0),t(50031,5,3,0),
  t(50208,8,1,0),f(51090,3,4),t(51531,5,4,0),t(51796,2,2,0),
  t(52502,0,3,0),t(52502,5,3,0),t(52678,1,4,0),s(53031,54443,[[53031,2,3],[53120,2,3],[53208,2.5,2],[53296,2,2],[53384,0.5,2],[53473,0.5,2],[53561,0.5,2],[53649,1.5,2],[53737,1.5,2],[53826,1.5,2],[53914,1.5,2],[54002,1.5,2],[54090,1.5,2],[54178,1.5,2],[54267,1.5,2],[54355,1.5,3],[54443,2,3]]),
  t(53384,3,2,1),t(54620,3,3,0),t(54796,1,3,0),t(55326,4,2,0),
  t(55679,2,2,0),t(57443,0,2,0),t(57620,2,2,0),t(58149,3,3,0),
  t(59032,2,6,0),t(59120,5,3,0),f(59208,3,3),s(60091,61502,[[60091,0,2],[60355,0.5,2],[60620,1.5,2],[60885,2.5,2],[61149,3.5,2],[61414,4,2],[61502,4,2]]),
  t(60444,8,2,0),t(60620,6,2,0),t(60973,7,3,0),t(61149,4,2,0),
  t(61855,5,3,0),t(62385,7,3,0),t(62385,2,3,0),s(62826,64061,[[62826,3,3],[62914,3,3],[63003,3,2],[63091,3,2],[63179,2.5,2],[63267,2.5,2],[63355,2.5,2],[63444,2.5,2],[63532,1,2],[63620,2,2],[63708,1.5,2],[63797,2,2],[63885,1.5,2],[63973,1.5,3],[64061,1.5,3]]),
  t(63267,8,1,0),t(63444,6,4,0),t(64150,4,1,0),t(64679,2,2,0),
  t(65032,0,2,0),t(65561,0,2,0),t(65650,3,4,0),h(66444,6,2,66885),
  h(67503,3,4,68032),t(68209,6,2,0),h(68473,6,4,69444),f(68915,5,3),
  t(69621,4,2,0),t(70150,1,3,0),t(70326,0,4,0),t(70679,1,3,0),
  h(71121,4,1,72532,1),h(73062,2,1,73944),t(74033,0,4,0),t(75444,1,4,0),
  h(75974,0,4,77209,0,[[75974,0,4],[76327,0,3],[76592,0,3],[76945,1,2],[77209,1,1]]),t(76327,3,3,0),t(76592,3,4,0),f(76856,1,4),
  t(77386,0,3,0),t(77386,5,3,0),t(77562,1,3,0),t(78092,0,3,0),
  t(78268,1,4,0),t(78974,0,2,0),t(78974,4,2,0),t(79239,2,2,0),
  t(79239,6,2,0),t(79503,4,2,0),t(79503,8,2,0),t(79680,5,4,0),
  t(80386,3,4,0),t(80651,1,4,0),t(81092,0,3,0),t(81621,1,3,0),
  t(81798,3,3,0),t(81974,1,3,0),t(82504,3,3,0),t(83210,5,3,0),
  h(83474,3,3,84092,1),f(84445,5,3),t(85327,3,3,0),t(85504,7,3,0),
  t(86386,1,3,0),t(86739,4,2,0),t(86739,8,2,0),t(86916,6,2,0),
  t(87269,7,3,0),t(89033,4,6,0),t(89739,6,2,0),t(90445,4,2,0),
  t(90710,2,2,0),t(91151,0,4,0),t(91857,0,4,0),t(92563,1,3,0),
  t(92828,0,4,0),f(93269,3,3),t(93710,6,4,0),t(93975,0,2,0),
  t(93975,4,2,0),t(94681,4,2,0),t(94681,8,2,0),t(95387,0,2,0),
  t(95387,4,2,0),t(96093,4,2,0),t(96093,8,2,0),t(97063,6,4,0),
  t(97328,5,4,0),t(97505,3,4,0),t(98210,5,4,0),t(98563,7,3,0),
  t(98916,6,4,0),t(99181,6,4,0),t(99181,1,3,0),t(99622,6,4,0),
  t(100328,6,4,0),t(100681,5,3,0),t(101034,3,3,0),t(101211,5,4,0),
  f(101387,1,3),t(101740,3,4,0),t(102446,5,4,0),t(102622,6,4,0),
  t(103152,3,4,0),t(103328,6,2,0),t(104034,3,4,0),s(104034,105446,[[104034,1,2],[105446,2,2]]),
  t(104211,5,4,0),t(104564,6,4,0),h(104740,7,1,105270,0,[[104740,7,1],[105005,5,4],[105270,7,1]]),t(105446,6,4,0),
  t(105623,5,4,0),t(105711,6,4,0),h(105976,3,3,106682,1),t(106329,7,3,0),
  f(107123,3,4),t(107564,5,4,0),t(107564,0,3,0),t(107829,3,4,0),
  t(107917,1,3,0),t(108093,0,4,0),t(108799,6,2,2),t(109682,6,4,0),
  t(109858,5,3,0),h(110564,4,2,110917),t(111094,1,4,0),t(111535,3,4,0),
  t(111623,5,3,0),h(112329,1,3,112770),t(112947,0,6,0),t(113476,3,4,0),
  t(113741,0,2,0),t(114358,3,4,0),t(114623,8,2,0),f(114800,3,4),
  t(115329,5,4,0),t(115506,8,1,0),t(116476,0,4,0),t(116741,1,4,0),
  t(116741,7,3,0),t(117182,3,4,0),t(117270,1,3,0),h(117623,0,4,118418,0,[[117623,0,4],[118065,2,1],[118418,0,4]]),
  t(118682,0,3,0),t(119035,3,4,0),t(119212,6,4,0),t(119741,4,2,0),
  t(120447,0,4,0),h(120977,3,4,121594,1),t(122830,3,4,0),f(122918,5,3),
  t(123271,4,2,0),t(123624,1,3,0),t(124153,0,3,0),t(124683,1,4,0),
  t(125389,0,2,0),t(125653,1,4,0),t(126094,0,4,0),t(126536,0,4,0),
  t(126712,1,3,0),t(127418,2,1,0),t(127506,4,2,0),t(127859,2,3,0),
  t(127859,7,3,0),s(129271,130683,[[129271,4,2],[129536,4,2],[129801,2,2],[130065,0,2],[130330,0.5,2],[130595,1.5,2],[130683,2,2]]),t(129801,0,4,0),s(129977,130330,[[129977,2.5,2],[130330,1.5,2]]),
  t(130859,3,3,0),t(131389,0,3,0),t(132183,1,4,0),t(132271,3,3,0),
  t(132448,2,2,0),t(133154,0,3,0),t(133330,1,3,0),t(133595,1,4,0),
  t(133683,0,3,0),t(134036,0,4,0),t(134389,4,2,0),t(134742,1,3,0),
  t(135448,0,4,0),t(135977,1,4,0),f(136860,0,2),t(137566,4,2,0),
  t(137830,4,6,0),s(138272,139684,[[138272,2,3],[138448,1,3],[138713,0,2],[138801,0,2],[139154,0,2],[139684,0,2]]),s(138272,139684,[[138272,4,2],[139684,2,2]]),t(139860,5,4,0),
  t(139860,0,3,0),t(140389,6,4,0),t(140478,6,1,0),t(140566,8,1,0),
  h(141095,5,1,142507,1,[[141095,5,1],[141448,3,4],[141801,5,1],[142154,3,4],[142507,5,1]]),t(141801,9,1,0),t(142154,5,3,0),t(143213,2,2,0),
  t(143919,5,4,0),t(144184,4,2,0),t(144448,7,3,0),s(144713,146125,[[144713,3,3],[144801,2.5,3],[144890,3,2],[144978,3,2],[145066,3.5,2],[145154,3.5,2],[145243,1.5,2],[145331,1.5,2],[145419,1.5,2],[145507,3,2],[145596,3,2],[145684,3,2],[145772,3,2],[145860,3,2],[145949,3,2],[146037,3,3],[146125,2.5,3]]),
  t(145331,4,4,0),f(145507,8,2),t(146390,7,3,0),t(147096,8,2,0),
  t(148155,1,4,0),t(148684,4,1,0),s(149037,150449,[[149037,3,2],[149213,2.5,2],[149302,2.5,2],[149390,2.5,2],[149566,4,3],[149743,4,3],[149919,4,3],[150096,4,2],[150272,4,2],[150449,4,2]]),s(149037,150449,[[149037,1,2],[150449,2,2]]),
  t(151155,6,2,0),t(151155,2,2,0),t(151508,4,2,0),h(151861,2,2,152390),
  t(152831,0,4,0),t(152920,3,3,0),s(153714,155126,[[153714,3,3],[153890,3,3],[154067,3,2],[154243,4,2],[154331,2.5,2],[154420,2.5,2],[154596,3,2],[154773,4,2],[154949,4,2],[155126,4,2]]),s(153714,155126,[[153714,1,2],[155126,0,2]]),
  t(155390,7,3,0),t(155743,5,3,0),h(156449,2,1,157067),t(157155,5,4,0),
  t(157243,4,2,0),t(157332,8,1,0),t(157508,5,4,0),t(159096,1,4,0),
  t(159361,3,3,0),t(159626,5,3,0),h(160067,6,4,160597,1),t(161214,2,2,0),
  t(161214,6,2,0),t(161391,5,3,0),t(161479,4,2,0),t(161567,8,2,0),
  s(161744,163155,[[161744,3,2],[161920,3.5,2],[162008,3.5,2],[162097,2,2],[162273,2,3],[162450,2,3],[162626,2,3],[162803,1.5,2],[162979,2,2],[163155,2,2]]),s(161744,163155,[[161744,1,2],[163155,0,2]]),t(163332,6,2,0),s(163685,165097,[[163685,2,3],[163861,0,2],[163950,0,2],[164038,0.5,2],[164391,0.5,2],[164656,1,2],[164920,2,2],[165009,2,3],[165097,2,3]]),
  s(164038,164744,[[164038,4,2],[164744,3,2]]),t(165450,0,2,0),t(165979,1,4,3),t(166420,2,2,0),
  t(166509,0,1,0),t(166862,2,2,0),f(167038,0,3),t(167391,0,4,0),
  t(167568,3,4,0),t(168273,8,2,0),t(168273,4,2,0),t(169156,0,1,0),
  t(169509,4,1,0),t(169597,2,1,0),s(169685,170921,[[169685,3,3],[169774,2.5,3],[170038,2.5,2],[170479,1,2],[170832,1,2],[170921,1,2]],1),t(170391,8,2,0),
  t(170568,6,4,0),t(171627,0,4,0),t(172244,3,4,0),h(172332,8,1,173127,0,[[172332,8,1],[172774,7,3],[173127,6,4]]),
  t(173215,3,4,0),t(173391,6,4,0),h(175333,5,4,175862),t(176039,6,4,0),
  f(176215,5,4),t(176921,8,2,0),t(177627,5,4,0),t(177803,6,4,0),
  t(178862,1,4,0),t(179039,0,4,0),t(179745,1,4,0),t(180098,0,1,0),
  t(180451,0,2,0),t(180451,4,2,0),t(181157,1,2,0),t(181157,5,2,0),
  t(181862,3,2,0),t(181862,7,2,0),t(182568,4,2,0),t(182568,8,2,0),
  t(183098,4,2,0),t(183274,1,4,0),t(183980,6,2,0),t(184686,3,4,0),
  f(184951,1,4),h(185392,1,4,186098),t(186274,5,4,0),t(186274,0,3,0),
  t(186539,1,4,0),t(186804,4,2,0),t(186980,0,3,0),t(187686,2,1,0),
  t(187951,0,4,0),t(188392,1,4,0),t(188922,0,1,0),t(189098,0,6,0),
  t(189275,6,1,0),h(189628,2,2,190157),t(190334,5,4,0),f(191039,4,2),
  h(191481,6,4,192010,0,[[191481,6,4],[191745,7,3],[192010,9,1]]),t(192098,1,4,0),t(192275,5,3,0),t(192363,3,4,0),
  t(192451,6,4,0),t(192628,1,4,0),t(192628,7,3,0),t(192804,5,3,0),
  t(193157,1,4,0),t(194040,0,4,0),t(194216,0,2,0),t(195099,1,3,0),
  t(195981,4,2,0),t(196334,7,3,0),t(197569,7,3,0),t(197746,3,4,0),
  s(197834,199246,[[197834,3,3],[198010,2.5,3],[198275,2,2],[198716,1,2],[199158,0.5,2],[199246,0.5,2]],1),t(198275,5,4,0),t(198452,5,2,0),f(198716,5,4),
  t(199687,6,4,0),t(200216,8,1,0),t(200393,5,4,0),t(200569,8,2,0),
  t(201099,5,4,0),t(201628,7,3,0),t(202511,5,4,0),t(203393,3,4,0),
  h(203570,6,4,204187),t(204805,1,3,0),t(204805,6,3,0),t(205334,3,4,0),
  t(205511,5,4,0),t(206040,6,4,0),t(207187,5,4,0),h(207629,8,2,208511,1),
  t(209041,5,4,0),h(209129,8,1,210541,0,[[209129,8,1],[209482,7,3],[209835,6,4],[210188,7,3],[210541,8,1]]),f(209570,5,3),t(210805,6,2,0),
  t(210982,3,3,0),t(211158,2,1,0),t(211864,0,4,0),t(212394,0,3,0),
  t(212747,4,2,0),t(212923,1,3,0),t(213276,5,3,0),t(213453,7,3,0),
  t(214158,4,2,0),t(214335,0,2,0),t(214688,0,4,0),t(214864,2,6,0),
  t(215394,2,2,0),t(215394,6,2,0),t(215659,5,4,0),f(215923,4,2),
  t(216276,6,2,0),t(216541,3,4,0),t(216629,1,4,0),t(217070,0,4,0),
  t(217159,2,2,0),t(217512,4,2,4),s(218218,219629,[[218218,0,2],[218482,0,2],[218747,0.5,2],[219012,1.5,2],[219276,3,2],[219541,3.5,2],[219629,4,2]]),t(218923,4,3,0),
  t(219100,1,2,0),t(219806,8,1,0),t(220247,3,4,0),t(220512,0,4,0),
  t(220777,4,2,0),t(221218,1,4,0),f(221394,0,3),s(221924,223336,[[221924,1.5,2],[222012,1,2],[222100,1,2],[222188,1.5,2],[222277,2.5,2],[222365,2.5,3],[222453,2.5,3],[222541,2.5,3],[222630,0.5,3],[222718,0.5,3],[222806,0.5,3],[222894,0.5,3],[222983,0.5,2],[223071,1,2],[223159,1,2],[223247,1.5,2],[223336,1.5,2]],1),
  t(222277,1,4,0),s(222630,222983,[[222630,4,2],[222983,3,2]]),t(223865,2,3,0),t(223865,7,3,0),
  t(224394,6,1,0),t(224483,4,1,0),t(224571,1,4,0),t(224747,3,4,0),
  t(225277,1,4,0),t(225453,2,2,0),t(225453,6,2,0),t(225894,2,2,0),
  t(225894,7,2,0),t(226336,1,2,0),t(226336,8,2,0),t(226777,0,2,0),
  t(226777,8,2,0),t(227571,4,2,0),s(228100,229512,[[228100,3,3],[228189,2.5,3],[228277,0.5,2],[228365,0.5,2],[228453,0.5,2],[228542,0.5,2],[228630,1,2],[228718,0.5,2],[228806,0.5,2],[228895,0.5,2],[228983,1.5,2],[229071,1.5,2],[229159,1,2],[229248,0.5,2],[229336,0.5,2],[229424,1.5,3],[229512,1.5,3]]),f(228983,6,2),
  t(229689,8,2,0),t(231101,8,2,0),t(231542,6,4,0),t(232865,1,4,0),
  t(233042,6,2,0),t(233395,4,2,0),t(234366,5,4,0),t(234807,2,1,0),
  t(235160,4,2,0),t(235336,0,4,0),t(236219,0,2,0),h(236925,4,2,237542),
  t(237630,7,3,0),t(237983,3,3,0),t(238160,0,2,0),t(238866,3,4,0),
  f(239042,5,3),h(239748,6,4,240719,1,[[239748,6,4],[240101,8,2],[240366,8,2],[240719,6,4]]),t(240101,5,3,0),t(241337,8,1,0),
  t(241513,6,1,0),t(241866,4,6,0),t(242572,6,1,0),t(243631,3,3,0),
  t(243719,0,4,0),t(243807,3,3,0),t(244337,7,3,0),t(244337,2,3,0),
  t(244513,5,3,0),t(244690,7,3,0),t(245749,3,3,0),t(246102,6,2,0),
  t(246631,7,3,0),f(246807,5,4),t(247160,1,3,0),t(247513,1,4,0),
  t(247513,7,3,0),t(247690,5,3,0),t(248219,8,1,0),t(248396,3,4,0),
  t(248925,0,2,0),t(249366,3,3,0),t(249455,7,3,0),t(249631,4,2,0),
  t(250337,5,4,0),t(251043,3,4,0),t(251220,1,4,0),t(251749,0,2,0),
  t(252278,1,3,0),t(252631,3,4,0),f(253161,1,3),t(254220,1,3,0),
  t(254573,3,3,0),t(255014,1,4,0),t(255102,0,3,0),t(255455,1,4,0),
  t(256867,3,4,0),t(257573,5,4,0),t(258279,1,4,0),t(258720,6,4,0),
  t(258720,1,3,0),t(259249,0,4,0),t(259691,0,4,0),t(260132,1,4,0),
  t(260220,3,3,0),t(260926,5,3,0),t(261544,3,4,0),f(261632,7,3),
  t(262514,1,4,0),t(262603,5,3,0),t(263220,4,2,0),h(263661,8,2,264367),
  t(264456,5,3,0),t(264632,7,3,0),s(265162,266573,[[265162,3,2],[265691,3.5,2],[266132,4,2],[266220,4,2],[266397,4,3],[266573,4,3]]),t(265514,4,3,0),
  t(266662,4,6,0),t(266750,8,2,0),t(267985,7,3,0),t(268515,7,3,0),
  t(269044,7,3,0),t(270103,1,3,0),t(270456,3,3,0),t(270809,5,3,0),
  f(271515,7,3),
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
  t(2124,0,10,0),t(4446,2,6,0),h(4833,6,3,6382,0,[[4833,6,3],[5220,5,4],[5607,5,4],[5994,4,6],[6382,4,6]]),t(6575,4,6,0),
  t(7156,6,4,0),t(8123,4,6,0),t(8897,4,6,0),t(9865,0,3,0),
  t(9865,7,3,0),t(10252,5,4,0),t(10446,4,6,0),t(12188,5,4,0),
  t(12575,4,6,0),h(12962,2,6,14510),t(14897,0,6,0),h(15671,2,6,17219),
  t(17994,4,6,0),t(18768,2,6,0),t(18961,1,4,0),t(19929,0,4,0),
  t(20703,0,6,0),t(23026,0,6,0),t(23413,0,6,0),t(24574,2,6,0),
  t(25348,4,6,0),h(27477,4,6,28348),t(28638,2,6,0),t(28832,5,4,0),
  t(29606,2,6,0),t(31154,0,6,0),t(31541,2,6,0),t(32702,4,6,0),
  h(34638,6,4,35702),t(35799,4,6,0),t(37541,2,6,0),t(38702,0,6,0),
  t(39089,0,6,0),t(40444,3,4,0),t(41218,5,4,0),t(43153,3,4,0),
  t(43347,0,10,0),t(43927,3,4,0),t(45089,0,6,0),t(45476,0,3,0),
  t(45476,7,3,0),h(46250,4,6,47121),t(48379,4,6,0),h(50508,4,6,51765),
  t(51862,5,3,0),t(52830,3,3,1),t(54185,5,4,0),t(54959,3,4,0),
  t(55346,1,4,0),h(55926,0,6,57088,0,[[55926,0,6],[56314,1,4],[56701,1,4],[57088,2,3]]),t(57281,0,6,0),t(58055,1,4,0),
  t(58249,3,3,0),t(58830,3,4,0),t(59991,4,6,0),t(60765,5,4,0),
  t(61926,4,6,0),t(62894,5,4,0),t(63474,2,6,0),t(64055,5,4,0),
  t(64829,3,4,0),t(66377,0,6,0),t(66571,2,6,0),t(67152,4,6,0),
  t(67539,3,4,0),t(68313,1,4,0),t(69280,0,6,0),t(70635,0,6,0),
  t(71409,3,3,0),t(72958,4,6,0),t(73538,5,4,0),t(73925,3,4,0),
  t(74312,0,6,0),t(74699,0,4,0),t(75861,0,10,0),t(76248,3,4,0),
  t(76441,5,4,0),t(77215,6,4,0),t(78570,4,6,0),t(78957,5,4,0),
  t(79344,6,4,0),t(79925,7,3,0),t(79925,0,3,0),t(80699,2,6,0),
  t(80892,4,6,0),t(82054,5,4,0),t(82247,4,6,0),t(82634,4,6,0),
  t(83408,4,6,0),t(84183,2,6,0),t(84570,4,6,0),t(84957,4,6,0),
  t(85731,5,4,0),t(86118,3,4,0),t(86505,2,6,0),t(86892,1,4,0),
  t(87279,3,4,0),t(87666,4,6,0),t(88247,4,6,0),t(88440,4,6,0),
  h(89021,4,6,90472),t(90956,4,6,0),h(92118,4,6,93666),h(94246,4,3,95795,0,[[94246,4,3],[94633,3,4],[95021,2,6],[95408,3,4],[95795,4,3]]),
  t(96182,1,4,0),t(96569,3,4,0),t(96956,0,3,0),t(96956,7,3,0),
  t(98117,4,6,0),t(98891,2,6,0),t(99665,0,6,0),t(100440,0,6,0),
  t(100827,1,4,0),t(101601,3,3,0),t(103536,4,6,0),t(104117,0,10,0),
  t(104891,4,6,0),t(106246,4,6,2),t(106633,4,6,0),t(107213,4,6,0),
  t(107794,6,4,0),t(109342,4,6,0),h(110116,4,6,111665),t(112052,5,4,0),
  t(113213,2,6,0),t(113987,4,6,0),t(115535,4,6,0),t(116309,4,6,0),
  t(117084,4,6,0),t(118632,4,6,0),t(119019,4,6,0),h(119406,4,6,120567,0,[[119406,4,6],[119793,6,4],[120180,6,4],[120567,4,6]]),
  t(121535,2,6,0),t(122309,5,4,0),t(122503,4,6,0),t(125018,5,4,0),
  t(126180,3,4,0),t(127147,1,4,0),t(127534,3,4,0),t(128115,5,4,0),
  t(128502,0,4,0),t(128889,1,4,0),t(129276,0,4,0),t(129663,0,6,0),
  t(129857,0,4,0),t(130437,1,4,0),t(130825,3,4,0),t(131212,1,4,0),
  t(131986,0,6,0),t(132179,0,4,0),t(132760,1,4,0),t(133147,0,10,0),
  t(134115,6,4,0),t(134889,5,4,0),t(135469,3,4,0),t(136244,1,4,0),
  t(137018,0,6,0),t(138179,0,4,0),t(138566,0,6,0),t(138953,0,4,0),
  t(140695,0,3,0),t(140695,7,3,0),t(141856,0,6,0),t(142243,0,6,0),
  t(143017,3,4,0),t(143404,4,6,0),t(143791,2,6,0),t(144178,1,4,0),
  t(144566,0,4,0),t(145920,0,6,0),t(146114,0,6,0),t(146888,2,6,0),
  t(147275,5,4,0),t(147662,5,4,0),t(148049,4,6,0),t(148436,5,4,0),
  t(149210,6,4,0),t(149597,6,4,0),t(149984,6,4,0),t(150372,4,6,0),
  h(150759,6,4,152113),t(153081,3,4,0),t(153468,1,4,0),h(153855,3,4,155403),
  t(156565,1,4,0),t(156952,1,4,3),t(158113,0,4,0),t(159274,0,6,0),
  t(160629,2,6,0),t(160822,4,6,0),t(161210,4,6,0),t(163532,0,10,0),
  t(163919,4,6,0),t(165080,4,6,0),t(165467,4,6,0),t(165854,5,4,0),
  h(167403,2,6,168951),h(169338,2,3,170886,0,[[169338,2,3],[169725,0,6],[170112,2,3],[170499,0,6],[170886,2,3]]),t(172241,0,6,0),t(172435,0,6,0),
  t(173596,0,3,0),t(173596,7,3,0),t(173983,0,6,0),t(174370,0,6,0),
  t(174951,0,6,0),t(175144,2,6,0),t(175531,0,6,0),t(175918,3,4,0),
  t(176692,5,4,0),t(177079,4,6,0),t(177466,4,6,0),t(177854,4,6,0),
  t(178241,4,6,0),t(178628,0,4,0),t(179015,0,4,0),t(179402,1,4,0),
  t(180176,1,4,0),t(180369,2,6,0),t(180950,4,6,0),t(181337,3,4,0),
  t(182111,1,4,0),t(182498,0,6,0),t(182885,1,4,0),t(183079,0,6,0),
  t(183660,1,4,0),t(184047,3,4,0),t(184434,1,4,0),t(184821,0,6,0),
  t(185595,0,6,0),t(185982,0,6,0),t(186369,0,10,0),t(187143,3,4,0),
  t(187337,4,6,0),t(187917,7,3,0),t(187917,0,3,0),t(188304,5,4,0),
  t(188498,2,6,0),t(189079,1,4,0),t(189466,0,4,0),t(189853,1,4,0),
  t(190046,0,6,0),t(190627,0,6,0),t(191014,0,6,0),t(191207,3,4,0),
  t(191788,0,6,0),t(192562,2,6,0),t(192949,0,6,0),t(193336,0,4,0),
  t(193723,1,4,0),t(194110,0,6,0),t(194498,1,4,0),t(194885,3,4,0),
  t(195659,5,4,0),t(196046,4,6,0),t(196433,4,6,0),t(196626,2,6,0),
  t(197207,4,6,0),t(197594,3,4,0),t(197981,5,4,0),t(198755,2,6,0),
  t(199142,0,6,0),h(199917,2,3,201271,0,[[199917,2,3],[200304,1,4],[200594,1,4],[200981,0,6],[201271,0,6]]),t(201465,4,6,0),t(201852,5,4,0),
  t(202239,3,4,0),t(202626,1,4,0),t(203013,0,6,0),t(203207,0,6,0),
  t(203787,0,4,0),t(204174,1,4,0),t(204561,0,3,0),t(204561,7,3,0),
  t(204948,0,10,0),h(205336,3,4,206593),t(206884,0,6,0),t(207464,2,6,0),
  t(207658,5,4,0),t(208045,4,6,0),t(208432,6,4,0),t(208819,6,4,4),
  h(209206,4,6,210754),t(211142,5,4,0),t(211916,4,6,0),t(212303,4,6,0),
  h(212690,4,6,213851),t(214238,2,6,0),t(214625,5,4,0),t(215012,6,4,0),
  t(215399,0,6,0),t(215786,2,6,0),t(216173,5,4,0),t(216561,6,4,0),
  t(216948,5,4,0),t(217335,6,4,0),t(217722,5,4,0),t(218109,6,4,0),
  t(218496,5,4,0),t(218689,4,6,0),t(219657,3,4,0),t(220431,2,6,0),
  t(220818,4,6,0),t(221205,5,4,0),t(221592,6,4,0),t(221980,6,4,0),
  h(223141,4,6,224689,0,[[223141,4,6],[223528,4,6],[223915,5,4],[224302,5,4],[224689,6,3]]),t(225076,3,4,0),t(225463,5,4,0),t(225850,3,4,0),
  t(226237,1,4,0),t(226624,3,4,0),t(227786,0,3,0),t(227786,7,3,0),
  t(228173,0,10,0),t(229721,5,4,0),t(230495,6,4,0),t(231269,5,4,0),
  t(231850,4,6,0),t(233592,3,4,0),t(233785,4,6,0),t(234366,6,4,0),
  t(236108,5,4,0),t(236495,5,4,0),t(237656,3,4,0),t(238043,5,4,0),
  t(239011,3,4,0),t(239398,5,4,0),t(239785,3,4,0),h(241720,1,4,243268),
  t(243462,0,4,0),t(244236,1,4,0),t(244623,3,4,0),t(245784,6,4,0),
  t(246171,4,6,0),t(246946,2,6,0),t(247720,0,6,0),t(248494,0,6,0),
  t(248881,1,4,0),t(249268,3,4,0),t(250042,4,6,0),t(250429,0,4,0),
  t(251203,1,4,0),t(251590,2,6,0),t(252365,1,4,0),h(252752,2,3,254203,0,[[252752,2,3],[253139,1,4],[253526,0,6],[253816,1,4],[254203,2,3]]),
  t(255848,0,6,0),t(257783,0,6,0),t(258558,2,6,0),t(259332,0,10,0),
  t(260299,0,3,0),t(260299,7,3,0),
// </eiki-boss-v3-easy-notes>
])(mhTap,mhHoldV2,mhFlick,mhSlideV2);
const eikiBossNormalNotes=((t,h,f,s)=>[
// <eiki-boss-v3-normal-notes>
  t(2124,0,10,0),f(3672,0,6),t(4446,0,6,0),h(4833,4,2,6382,0,[[4833,4,2],[5220,4,3],[5607,3,4],[5994,3,4],[6382,2,6]]),
  t(6575,0,6,0),t(7156,5,4,0),t(8123,2,6,0),t(8897,4,6,0),
  t(9672,2,6,0),t(9865,0,3,0),t(9865,7,3,0),t(10252,3,4,0),
  t(10446,0,6,0),t(12188,0,4,0),t(12575,0,6,0),h(12962,0,6,14510),
  t(14704,2,6,0),t(14897,4,6,0),h(15671,4,6,17219,1),f(17994,4,6),
  t(18768,2,6,0),t(18961,1,3,0),t(19929,0,4,0),t(20703,0,6,0),
  t(23026,2,6,0),t(23413,2,6,0),t(24574,0,6,0),t(25348,4,6,0),
  t(26509,4,2,0),h(27477,0,6,28348),t(28832,0,4,0),t(29606,0,6,0),
  t(30380,2,6,0),t(31154,4,6,0),t(31541,4,6,0),f(32702,4,6),
  h(33476,5,3,34347),h(34638,3,3,35702),t(35799,0,6,0),t(37541,2,6,0),
  t(38702,4,6,0),t(39089,2,6,0),t(39670,1,4,0),t(40444,0,4,0),
  t(41218,3,4,0),t(43153,3,4,0),t(43347,0,10,0),t(43927,7,3,0),
  t(43927,0,3,0),t(44701,4,6,0),t(45089,2,6,0),t(45476,5,4,0),
  h(46250,0,6,47121),f(48379,0,6),h(50508,0,6,51765),t(51862,4,2,0),
  t(52830,6,2,1),t(54185,3,4,0),t(54959,1,4,0),t(55346,0,4,0),
  h(55926,0,6,57088,0,[[55926,0,6],[56314,1,4],[56701,2,3],[57088,2,2]]),t(57281,0,6,0),t(58055,0,4,0),t(58249,2,2,0),
  t(58830,1,4,0),t(59991,2,6,0),t(60765,6,4,0),t(61926,4,6,0),
  t(62894,7,3,0),t(62894,0,3,0),t(63474,4,6,0),f(64055,3,4),
  h(64829,1,4,65603),h(65990,0,4,67539),t(68313,1,3,0),t(69280,2,6,0),
  t(70635,4,6,0),t(71409,8,2,0),t(72958,4,6,0),t(73538,3,4,0),
  t(74312,4,6,0),t(74699,3,4,0),t(75086,1,4,0),t(75861,4,6,0),
  t(76248,3,4,0),t(76441,6,4,0),t(76635,5,4,0),t(77215,6,4,0),
  f(77796,5,4),t(78570,0,10,0),t(78957,6,4,0),t(79344,5,4,0),
  t(79925,0,3,0),t(79925,7,3,0),t(80699,4,6,0),t(80892,4,6,0),
  t(82054,1,4,0),t(82247,2,6,0),t(82634,4,6,0),t(83021,6,4,0),
  t(83408,4,6,0),t(84183,2,6,0),t(84570,0,6,0),t(84957,0,6,0),
  t(85344,0,6,0),t(85731,1,4,0),f(86118,3,4),t(86505,0,6,0),
  t(86892,0,4,0),t(87279,1,4,0),t(87666,0,6,0),t(88247,0,6,0),
  t(88440,0,6,0),t(88634,4,6,0),h(89021,4,2,90472,0,[[89021,4,2],[89408,3,4],[89795,2,6],[90085,3,4],[90472,4,2]]),t(90956,0,6,0),
  t(91343,4,6,0),h(92118,2,6,93666),h(94246,0,6,95795,1),t(96182,3,4,0),
  t(96569,5,4,0),t(96956,0,3,0),t(96956,7,3,0),t(98117,4,6,0),
  f(98891,2,6),t(99665,0,6,0),t(100052,0,4,0),t(100440,0,6,0),
  t(100827,3,4,0),t(101601,6,2,0),t(103149,5,3,0),t(103536,4,6,0),
  t(104117,2,6,0),t(104891,4,6,0),t(106246,0,10,2),t(106633,2,6,0),
  t(107213,4,6,0),t(107794,7,3,0),t(108568,4,6,0),t(109342,2,6,0),
  h(110116,0,6,111665),f(112052,0,4),t(113213,0,6,0),t(113987,0,6,0),
  t(115535,0,6,0),t(116309,0,6,0),t(117084,2,6,0),t(118632,2,6,0),
  t(119019,4,6,0),h(119406,4,6,120567,0,[[119406,4,6],[119793,5,3],[120180,5,3],[120567,4,6]]),t(121148,1,4,0),t(121535,4,6,0),
  t(122309,3,4,0),t(122503,4,6,0),t(125018,7,3,0),t(126180,6,4,0),
  t(127147,0,3,0),t(127147,7,3,0),t(127534,1,4,0),f(127728,3,4),
  t(128115,5,4,0),t(128502,7,3,0),t(128889,5,3,0),t(129276,6,4,0),
  t(129663,4,6,0),t(129857,6,4,0),t(130437,5,4,0),t(130825,3,4,0),
  t(131212,1,4,0),t(131986,0,6,0),t(132179,0,4,0),t(132760,0,3,0),
  t(133147,0,6,0),t(134115,3,4,0),t(134889,1,4,0),f(135469,3,3),
  t(136244,1,3,0),t(137018,0,6,0),t(138179,1,4,0),t(138566,0,10,0),
  t(138953,6,4,0),t(140695,7,3,0),t(140695,0,3,0),t(141856,4,6,0),
  t(142243,4,6,0),t(143017,5,4,0),t(143404,4,6,0),t(143791,0,6,0),
  t(144178,3,4,0),t(144566,5,4,0),t(145340,6,4,0),t(145920,0,6,0),
  t(146114,2,6,0),f(146888,4,6),t(147275,6,4,0),t(147662,1,4,0),
  t(148049,4,6,0),t(148436,3,4,0),t(148823,6,4,0),t(149210,5,4,0),
  t(149597,6,4,0),t(149984,5,4,0),t(150372,2,6,0),h(150759,4,2,152113,0,[[150759,4,2],[151146,2,6],[151436,4,2],[151823,2,6],[152113,4,2]]),
  t(152694,5,3,0),t(153081,7,3,0),t(153081,0,3,0),t(153468,6,4,0),
  h(153855,6,4,155403,1),t(156565,3,4,0),t(156952,6,4,3),f(158113,6,4),
  t(159274,4,6,0),t(160629,2,6,0),t(160822,4,6,0),t(161210,4,6,0),
  t(163532,4,6,0),t(163919,4,6,0),t(165080,4,6,0),t(165467,4,6,0),
  t(165854,5,4,0),t(166048,4,6,0),h(167403,4,6,168951),h(169338,4,2,170886,0,[[169338,4,2],[169725,4,3],[170112,3,4],[170499,3,4],[170886,2,6]]),
  t(171660,0,10,0),t(172241,0,6,0),t(172435,0,6,0),t(173596,0,4,0),
  f(173983,2,6),t(174370,4,6,0),t(174951,2,6,0),t(175144,4,6,0),
  t(175531,4,6,0),t(175918,6,4,0),t(176112,4,6,0),t(176692,7,3,0),
  t(176692,0,3,0),t(177079,4,6,0),t(177466,2,6,0),t(177660,0,6,0),
  t(177854,2,6,0),t(178241,4,6,0),t(178628,0,4,0),t(179015,0,4,0),
  f(179402,1,4),t(180176,1,4,0),t(180369,0,6,0),t(180563,0,6,0),
  t(180950,0,6,0),t(181337,0,3,0),t(181724,5,3,0),t(182111,3,4,0),
  t(182305,0,6,0),t(182498,0,6,0),t(182885,0,4,0),t(183079,0,6,0),
  t(183273,0,4,0),t(183660,0,3,0),t(184047,3,4,0),t(184434,1,4,0),
  t(184821,0,6,0),t(185595,0,6,0),f(185982,0,6),t(186369,0,6,0),
  t(187143,0,3,0),t(187143,7,3,0),t(187337,4,6,0),t(187530,0,10,0),
  t(187917,5,4,0),t(188304,6,4,0),t(188498,4,6,0),t(188691,6,4,0),
  t(189079,5,4,0),t(189466,3,4,0),t(189853,1,4,0),t(190046,0,6,0),
  t(190240,0,4,0),t(190627,0,6,0),t(191014,0,6,0),t(191207,1,4,0),
  f(191401,0,4),t(191788,0,6,0),t(191982,0,6,0),t(192175,1,4,0),
  t(192562,2,6,0),t(192949,0,6,0),t(193336,0,4,0),t(193723,1,4,0),
  t(194110,0,6,0),t(194498,1,4,0),t(194885,3,4,0),t(195659,0,3,0),
  t(195659,7,3,0),t(196046,2,6,0),t(196433,0,6,0),t(196626,2,6,0),
  t(196820,7,3,0),t(197207,4,6,0),f(197594,7,3),t(197981,7,3,0),
  t(198562,6,4,0),t(198755,2,6,0),t(199142,4,6,0),h(199723,0,6,201271,0,[[199723,0,6],[200110,1,4],[200497,1,4],[200884,1,3],[201271,2,2]]),
  t(201465,2,6,0),t(201852,6,4,0),t(202045,2,6,0),t(202239,0,4,0),
  t(202626,0,4,0),t(203013,0,6,0),t(203207,2,6,0),t(203400,0,10,0),
  t(203787,6,4,0),t(204174,6,4,0),t(204368,5,4,0),f(204561,3,4),
  t(204948,0,6,0),h(205723,0,4,206593),t(206884,0,6,0),t(207271,1,4,0),
  t(207464,0,6,0),t(207658,0,3,0),t(207658,7,3,0),t(208045,2,6,0),
  t(208432,1,4,0),t(208819,0,4,4),h(209206,0,6,210754,1),t(211142,0,4,0),
  t(211916,2,6,0),t(212109,4,6,0),t(212303,2,6,0),h(212690,0,6,213851),
  f(214238,4,6),t(214625,3,4,0),t(215012,0,4,0),t(215399,2,6,0),
  t(215786,0,6,0),t(216173,0,3,0),t(216561,1,4,0),t(216948,0,4,0),
  t(217335,1,4,0),t(217528,3,4,0),t(217722,5,4,0),t(218109,3,4,0),
  t(218496,5,4,0),t(218689,0,6,0),t(219657,0,4,0),t(220044,1,4,0),
  t(220431,2,6,0),f(220818,4,6),t(221205,0,3,0),t(221205,7,3,0),
  t(221592,1,4,0),t(221980,0,4,0),h(223141,2,2,224689,0,[[223141,2,2],[223528,1,4],[223915,0,6],[224302,1,4],[224689,2,2]]),t(225076,0,4,0),
  t(225463,0,4,0),t(225850,1,4,0),t(226237,1,4,0),t(226624,3,4,0),
  t(227786,3,4,0),t(228173,0,10,0),t(229721,0,4,0),t(230495,1,4,0),
  t(231269,3,4,0),t(231850,4,6,0),f(232043,6,4),t(233592,5,4,0),
  t(233785,4,6,0),t(234366,5,4,0),t(236108,3,3,0),t(236495,3,3,0),
  t(236882,5,3,0),t(237656,5,3,0),t(238043,6,4,0),t(239011,5,4,0),
  t(239398,6,4,0),t(239785,7,3,0),t(239785,0,3,0),h(241720,3,4,243268),
  t(243462,0,3,0),t(244236,1,4,0),t(244623,3,3,0),t(245397,5,4,0),
  f(245784,7,3),t(246171,4,6,0),t(246946,2,6,0),t(247720,0,6,0),
  t(248494,0,6,0),t(248881,0,3,0),t(249268,0,3,0),t(250042,0,6,0),
  t(250429,0,4,0),t(250816,0,4,0),t(251590,0,6,0),t(252365,0,4,0),
  h(252752,0,6,254203,1,[[252752,0,6],[253139,1,4],[253526,2,2],[253816,1,4],[254203,0,6]]),t(255848,0,6,0),t(257783,2,6,0),t(258558,4,6,0),
  t(259332,0,10,0),f(260299,5,4),
// </eiki-boss-v3-normal-notes>
])(mhTap,mhHoldV2,mhFlick,mhSlideV2);
const eikiBossHardNotes=((t,h,f,s)=>[
// <eiki-boss-v3-hard-notes>
  t(2124,0,8,0),s(2898,4446,[[2898,3,4],[2995,3,4],[3091,1.5,3],[3188,1.5,3],[3285,1.5,3],[3382,1.5,3],[3478,1,3],[3575,1,2],[3672,1,2],[3769,2,2],[3866,2,3],[3962,1.5,3],[4059,1.5,3],[4156,1.5,3],[4253,1.5,3],[4349,1.5,4],[4446,1.5,4]],1),h(4833,7,1,6382,0,[[4833,7,1],[5220,7,2],[5607,6,3],[5994,6,4],[6382,5,5]]),t(7059,4,5,0),
  f(7156,3,4),t(7930,0,4,0),t(7930,7,3,0),t(8123,0,5,0),
  t(8897,0,5,0),t(8994,4,5,0),t(9672,2,5,0),t(9865,6,4,0),
  t(9865,0,3,0),t(10059,4,5,0),t(10252,5,4,0),t(10446,4,5,0),
  t(12188,3,4,0),t(12575,4,5,0),s(12962,14510,[[12962,2,4],[13058,2,4],[13155,3.5,4],[13252,3.5,4],[13349,3,3],[13446,3,3],[13542,3,3],[13639,3,3],[13736,2.5,3],[13833,3,3],[13929,3,3],[14026,3,3],[14123,2.5,2],[14220,2.5,2],[14316,3.5,2],[14413,3.5,2],[14510,4,2]]),t(14704,0,5,0),
  t(14897,2,5,0),h(15671,4,5,17219),t(17994,2,5,0),t(18574,4,5,0),
  t(18768,2,5,0),h(19639,0,5,20413),t(20703,0,5,0),f(20993,2,5),
  t(22348,2,5,0),t(23026,4,5,0),t(23316,2,5,0),t(23413,0,5,0),
  t(24574,0,5,0),t(25348,0,5,0),t(25735,2,5,0),t(26509,6,1,0),
  h(27477,5,5,28348),t(28638,5,5,0),t(28832,6,4,0),s(29606,30380,[[29606,1,3],[29896,1,3],[30186,2.5,3],[30380,3.5,3]]),
  t(31154,2,5,0),t(31541,4,5,0),t(31928,5,5,0),f(32702,4,5),
  h(33476,3,3,34347),h(34638,1,3,35702),t(35799,0,5,0),t(37541,0,5,0),
  t(37637,2,5,0),t(38702,0,5,0),t(39089,2,8,0),t(39670,3,4,0),
  t(40057,1,4,0),t(40444,3,4,0),t(41218,5,4,0),t(41798,5,5,0),
  t(43153,5,4,0),t(43347,5,5,0),t(43927,6,4,0),t(43927,0,3,0),
  t(44314,5,5,0),t(44701,4,5,0),t(45089,2,5,1),f(45476,1,4),
  h(46250,0,5,47121),h(47411,1,4,48379),t(49153,2,5,0),h(50508,4,5,51765),
  h(52153,5,5,52733,0,[[52153,5,5],[52443,6,3],[52733,7,1]]),t(52830,6,1,0),t(52927,2,5,0),t(54088,2,5,0),
  t(54475,5,4,0),t(54862,3,4,0),t(54959,1,4,0),t(55926,0,5,0),
  s(56217,57088,[[56217,2,4],[56314,2,4],[56507,2.5,3],[56701,3.5,3],[56894,3.5,2],[56991,4,2],[57088,4,2]]),t(57281,4,5,0),t(57959,3,5,0),t(58055,5,4,0),
  t(58346,5,5,0),f(58830,3,4),t(59313,4,5,0),t(59700,0,5,0),
  t(59991,0,5,0),t(60281,4,5,0),h(60571,4,1,61249,1),t(61926,0,5,0),
  t(62507,0,4,0),t(62507,7,3,0),t(62894,1,4,0),t(63474,4,5,0),
  t(64055,3,4,0),h(64829,6,4,65603),s(65990,67539,[[65990,3,4],[66184,3,3],[66377,1,3],[66571,2,3],[66764,3,2],[66958,3,3],[67152,3,3],[67345,3,3],[67539,3,4]]),t(67732,3,4,0),
  t(68313,7,3,0),h(68893,7,3,69861),f(70151,3,3),t(70538,4,4,0),
  t(70635,5,5,0),t(70925,2,8,0),t(71409,4,1,0),t(72474,0,4,0),
  t(72474,7,3,0),t(72861,3,4,0),t(72958,0,5,0),t(74022,0,4,0),
  t(74216,0,5,0),h(74409,2,1,74990,0,[[74409,2,1],[74699,0,5],[74990,2,1]]),t(75183,0,4,0),t(75377,0,5,0),
  t(75764,0,5,0),t(75861,2,5,0),t(76344,5,5,0),t(76441,3,4,0),
  t(77119,6,4,0),t(77215,5,4,0),f(77796,3,4),t(78280,5,4,0),
  t(78570,2,5,0),t(78957,3,4,0),t(79247,2,3,0),t(79344,0,4,0),
  t(79925,1,4,0),s(80602,81376,[[80602,2,2],[80699,2,3],[80796,2.5,3],[80892,3,4],[80989,2,4],[81086,2,4],[81183,1,3],[81280,1,3],[81376,2,2]]),t(81667,1,4,0),t(82054,3,4,0),
  t(82247,0,5,0),t(82634,2,5,0),t(83021,5,4,0),t(83408,5,5,0),
  t(83602,4,5,0),t(83796,1,3,0),t(83796,7,3,0),t(84183,0,5,0),
  t(84570,0,5,0),f(84957,0,5),t(85344,0,5,0),t(85537,2,5,0),
  t(85731,1,4,0),t(86118,0,4,0),t(86505,0,5,0),t(86699,0,5,0),
  t(86892,1,4,0),t(87279,3,4,0),t(87666,4,5,0),t(88053,5,4,0),
  t(88247,5,5,0),t(88440,4,5,0),t(88634,2,8,0),t(88924,3,4,0),
  s(89021,90472,[[89021,3,4],[89214,2.5,4],[89311,2.5,4],[89408,3,3],[89602,3,3],[89795,4,3],[89892,4,3],[90085,4,3],[90279,4,2],[90376,4,2],[90472,4,2]]),t(90956,4,5,0),f(91343,5,5),s(92118,93666,[[92118,3,2],[92311,3,3],[92505,3,3],[92698,3.5,4],[92892,4,4],[93085,4,4],[93279,3.5,3],[93472,2,3],[93666,2,2]],1),
  s(94150,95698,[[94150,2,4],[94246,1,4],[94343,1,3],[94537,2,3],[94730,2,3],[94924,3,2],[95117,3,3],[95311,3,3],[95504,3,3],[95601,3,4],[95698,3,4]]),t(95795,0,5,0),t(96182,3,4,0),t(96279,1,4,0),
  t(96569,0,4,0),t(96956,0,4,0),t(97343,0,4,0),t(97343,7,3,0),
  t(98117,0,5,0),t(98504,1,4,0),t(98891,5,5,0),t(99278,5,4,0),
  t(99665,2,5,0),t(100052,1,4,0),t(100440,0,5,0),t(101601,0,1,0),
  t(102278,0,5,0),f(103149,3,3),t(103536,5,5,0),t(103826,5,5,0),
  t(104117,5,5,0),t(104891,4,5,0),t(105665,6,4,0),s(106246,107020,[[106246,3,4],[106536,3,3],[106826,4,2],[106923,4,2],[107020,4,2]]),
  t(107213,2,5,0),h(107794,4,5,108471,0,[[107794,4,5],[108181,6,1],[108471,4,5]]),t(108568,2,5,2),t(109342,4,5,0),
  t(109536,5,5,0),s(110116,111665,[[110116,3,4],[110310,1,4],[110503,1,3],[110600,1,3],[111084,1,3],[111665,1.5,2]]),t(111858,3,4,0),t(112052,6,4,0),
  t(113019,7,3,0),t(113213,4,5,0),t(113987,5,5,0),t(114761,4,5,0),
  h(115535,2,5,116116),f(116309,4,5),t(117084,2,5,0),t(117374,4,5,0),
  h(118148,3,4,118922),t(119019,0,5,0),h(119406,3,3,120567),t(121245,4,5,0),
  t(121535,1,8,0),t(121632,4,5,0),t(122503,4,5,0),t(123180,6,4,0),
  t(123180,0,3,0),t(123567,5,5,0),t(123954,5,5,0),t(125018,3,3,0),
  t(125115,5,3,0),t(125502,5,5,0),t(125696,5,4,0),t(125889,4,5,0),
  t(126180,3,4,0),t(126470,1,4,0),f(126664,0,5),t(127051,3,4,0),
  t(127147,1,3,0),t(127438,2,5,0),t(127534,1,4,0),t(127825,2,5,0),
  t(128405,4,5,0),h(128502,7,3,129179),t(129276,4,4,0),t(129373,5,5,0),
  t(129663,4,5,0),t(129857,6,4,0),h(130341,5,4,130728,1),t(131115,6,4,0),
  t(131212,5,4,0),f(131502,5,5),t(131986,0,5,0),t(132179,0,4,0),
  t(132179,7,3,0),t(132470,0,5,0),t(132760,0,3,0),t(133147,0,5,0),
  t(133437,0,5,0),t(133631,2,5,0),t(134018,4,5,0),t(134115,3,4,0),
  t(134405,0,5,0),t(134792,2,5,0),h(134889,1,4,135663),t(135760,4,5,0),
  t(136244,3,3,0),t(136340,0,5,0),h(136534,0,5,137405),t(138082,2,5,0),
  f(138179,0,4),t(138566,1,8,0),t(138856,5,5,0),t(139630,5,3,0),
  t(139824,7,3,0),t(140695,6,4,0),t(141856,2,5,0),t(141953,7,3,0),
  t(142243,2,5,0),t(143017,5,4,0),t(143404,5,5,0),t(143598,4,5,0),
  t(143791,0,5,0),t(143985,0,5,0),t(144178,0,4,0),t(144178,7,3,0),
  t(144566,0,4,0),t(145340,3,4,0),t(145727,1,4,0),t(145920,0,5,0),
  f(146114,0,5),t(146888,0,5,0),h(147275,1,4,147856),t(148049,2,5,0),
  t(148243,5,5,0),t(148436,6,4,0),t(148630,5,3,0),t(148823,6,4,0),
  t(149017,4,5,0),t(149210,3,4,0),t(149597,5,4,0),t(149984,1,4,0),
  t(150372,0,5,0),s(150759,152113,[[150759,1,4],[150855,1,4],[151146,1,3],[151630,0,3],[151823,0,2],[152113,0,2]]),t(152307,3,4,0),t(152694,1,3,0),
  t(153081,0,4,0),t(153081,7,3,0),f(153468,1,4),h(153855,3,4,155403),
  h(155791,7,1,157339,0,[[155791,7,1],[156178,6,2],[156565,6,3],[156952,5,4],[157339,5,5]]),t(158113,3,4,3),t(158887,5,5,0),t(159274,4,5,0),
  t(160629,0,5,0),t(160822,2,5,0),t(161210,5,5,0),t(161984,2,5,0),
  t(162758,0,4,0),t(163532,2,5,0),t(163919,5,5,0),t(165080,2,8,0),
  t(165467,5,5,0),t(165854,5,4,0),f(166048,5,5),s(167403,168951,[[167403,0,3],[167693,1.5,3],[167983,3,3],[168274,4,3],[168564,4,3],[168854,4,3],[168951,4,3]]),
  h(169338,5,5,170886,1),t(171467,0,5,0),t(171660,2,5,0),t(172241,5,5,0),
  t(172435,2,5,0),t(173209,0,4,0),t(173596,3,4,0),t(173789,2,5,0),
  t(173983,4,5,0),t(174370,0,5,0),t(174951,0,5,0),t(175144,2,5,0),
  t(175338,0,5,0),t(175531,2,5,0),t(175918,6,4,0),t(176112,2,5,0),
  t(176499,0,5,0),h(176692,3,5,177660,0,[[176692,3,5],[176983,3,4],[177370,4,2],[177660,5,1]]),t(177854,0,5,0),t(178047,0,5,0),
  f(178241,2,5),t(178628,0,4,0),t(178628,7,3,0),t(179015,0,4,0),
  t(179208,0,5,0),t(179402,3,4,0),t(179789,5,4,0),t(180176,5,4,0),
  t(180369,2,5,0),t(180563,0,5,0),t(180950,0,5,0),t(181144,0,5,0),
  t(181337,1,3,0),t(181531,0,5,0),t(181724,1,3,0),t(182111,1,4,0),
  t(182305,0,5,0),f(182498,0,5),t(182885,0,4,0),t(183079,0,5,0),
  t(183273,3,4,0),t(183563,4,5,0),t(183660,7,3,0),t(183853,1,8,0),
  t(184047,6,4,0),t(184434,3,4,0),t(184627,5,5,0),t(184821,2,5,0),
  t(185401,5,5,0),t(185595,2,5,0),t(185982,5,5,0),t(186369,0,5,0),
  t(186756,6,4,0),t(186756,0,3,0),t(186950,3,4,0),t(187143,6,4,0),
  t(187337,4,5,0),f(187530,0,5),t(187917,0,4,0),t(188111,0,5,0),
  t(188304,0,4,0),t(188498,0,5,0),t(188691,1,4,0),t(188885,3,4,0),
  t(188982,0,5,0),t(189272,0,4,0),t(189466,1,4,0),t(189659,0,4,0),
  t(189853,1,4,0),t(190046,2,5,0),t(190240,1,4,0),t(190433,3,4,0),
  t(190627,4,5,0),t(190820,6,4,0),t(191014,5,5,0),t(191207,6,4,0),
  t(191401,6,4,0),t(191595,7,3,0),t(191788,4,5,0),t(191982,4,5,0),
  t(192175,6,4,0),t(192369,7,3,0),f(192562,4,5),t(192949,2,5,0),
  t(193336,1,4,0),t(193723,0,4,0),t(193917,0,5,0),t(194110,2,5,0),
  t(194498,6,4,0),t(194885,3,4,0),t(195078,0,5,0),t(195272,0,4,0),
  f(195659,0,4),t(196046,0,8,0),t(196433,2,5,0),t(196626,0,5,0),
  t(196820,0,3,0),t(197013,1,4,0),t(197207,2,5,0),t(197594,1,3,0),
  t(197788,0,3,0),t(197981,3,3,0),t(198562,0,4,0),t(198755,2,5,0),
  t(199142,5,5,0),h(199723,4,1,201271,0,[[199723,4,1],[200110,3,3],[200497,2,5],[200884,3,3],[201271,4,1]]),f(201465,4,5),h(201852,5,5,202626,0,[[201852,5,5],[202239,7,1],[202626,5,5]]),
  t(202820,2,5,0),t(203013,5,5,0),t(203207,4,5,0),t(203400,5,5,0),
  t(203594,5,4,0),t(203690,3,3,0),t(204174,0,4,0),t(204174,7,3,0),
  t(204368,3,4,0),t(204561,1,4,0),t(204755,0,5,0),t(204948,0,5,0),
  s(205336,206593,[[205336,2,4],[205529,0.5,3],[205626,0,3],[205723,0,3],[205819,0,3],[205916,0.5,2],[206013,0.5,2],[206206,0.5,3],[206400,1,3],[206593,1.5,4]]),t(206884,0,5,0),t(207271,3,4,0),t(207464,5,5,0),
  t(207658,3,4,0),t(208045,0,5,4),t(208432,3,4,0),t(208626,2,5,0),
  t(208819,5,4,0),t(209013,5,5,0),s(209206,210754,[[209206,3,4],[209400,3,4],[209690,3,3],[209980,1,3],[210174,1,3],[210754,1,2]],1),f(211142,3,4),
  t(211529,5,4,0),t(211916,5,5,0),t(212109,4,5,0),t(212303,2,5,0),
  t(212496,0,4,0),s(212690,213851,[[212690,1,2],[212787,1,3],[212883,1,3],[212980,1,3],[213077,1,4],[213174,1,4],[213270,3,4],[213367,3,4],[213464,1,4],[213561,1,3],[213658,1,3],[213754,1,3],[213851,1,2]],1),t(214238,0,5,0),t(214432,1,8,0),
  t(214625,6,4,0),t(215012,3,4,0),t(215206,0,3,0),t(215206,6,3,0),
  t(215399,2,5,0),t(215593,0,5,0),f(215786,2,5),t(216173,1,3,0),
  t(216367,5,4,0),t(216561,3,4,0),t(216948,6,4,0),t(217335,0,4,0),
  t(217528,3,4,0),t(217722,6,4,0),t(218109,3,4,0),t(218496,0,4,0),
  t(218689,2,5,0),t(218883,3,3,0),t(219270,0,4,0),t(219657,3,4,0),
  t(220044,6,4,0),t(220431,2,5,0),t(220818,0,5,0),t(221012,0,5,0),
  t(221205,3,4,0),f(221592,6,4),t(221980,3,4,0),t(222754,0,4,0),
  s(223141,224689,[[223141,2,4],[223334,2,4],[223625,2,3],[224108,2,3],[224689,2,2]]),t(225076,0,4,0),t(225463,1,4,0),t(225850,3,4,0),
  t(226237,5,4,0),t(226624,6,4,0),t(226624,0,3,0),t(227398,5,4,0),
  t(227786,3,4,0),t(228173,0,5,0),t(229721,3,4,0),t(229818,4,5,0),
  t(230495,3,4,0),t(231269,1,4,0),t(231850,0,5,0),t(232043,1,4,0),
  f(232140,2,5),t(232527,4,5,0),t(233592,5,4,0),t(233785,5,5,0),
  t(234366,5,4,0),t(235430,2,8,0),t(236108,5,3,0),t(236495,7,3,0),
  t(236978,5,4,0),t(237172,2,5,0),t(237946,5,5,0),t(238527,6,4,0),
  t(239011,5,4,0),t(239398,3,4,0),t(239494,0,5,0),t(239785,0,4,0),
  t(240849,0,5,0),t(241623,3,4,0),h(241720,3,1,243268,0,[[241720,3,1],[242107,1,5],[242494,3,1],[242881,1,5],[243268,3,1]]),f(243462,3,3),
  t(244236,6,4,0),t(244236,0,3,0),t(244623,3,3,0),t(244720,1,4,0),
  t(244913,0,5,0),t(245300,0,5,0),t(245688,0,5,0),t(246171,0,5,0),
  t(246946,2,5,0),t(247816,0,5,0),t(248204,0,5,0),t(248494,2,5,0),
  t(248784,4,5,0),t(248978,5,5,0),t(250042,5,5,0),t(250332,2,5,0),
  t(250719,0,5,0),f(250913,0,5),t(251590,0,5,0),t(252074,0,5,0),
  t(252268,0,5,0),t(252461,0,5,0),t(252655,4,5,0),s(252752,254203,[[252752,2,4],[252848,2,4],[253235,2,3],[253332,2,3],[253622,1.5,3],[254106,0,2],[254203,0,2]],1),
  t(255171,0,5,0),t(255558,2,5,0),t(255848,1,5,0),t(255945,0,4,0),
  t(256526,0,5,0),t(257783,5,5,0),t(258074,4,5,0),t(258558,2,5,0),
  t(258848,0,5,0),t(259041,0,5,0),t(259332,0,8,0),f(260299,0,4),
// </eiki-boss-v3-hard-notes>
])(mhTap,mhHoldV2,mhFlick,mhSlideV2);
const eikiBossExpertNotes=((t,h,f,s)=>[
// <eiki-boss-v3-expert-notes>
  t(2124,0,8,0),s(2898,4446,[[2898,3,4],[2995,3,4],[3091,1,3],[3188,1,3],[3285,1,3],[3382,1,3],[3478,0.5,3],[3575,0.5,2],[3672,0.5,2],[3769,2,2],[3866,2,3],[3962,1,3],[4059,1,3],[4156,1,3],[4253,1,3],[4349,1,4],[4446,1,4]],1),f(3672,5,5),s(3962,4446,[[3962,3,2],[4446,4,2]]),
  h(4833,6,1,6382,0,[[4833,6,1],[5220,6,2],[5607,5,3],[5994,5,4],[6382,4,5]]),t(5801,8,2,0),t(5994,4,4,0),t(6865,0,5,0),
  t(7059,2,5,0),t(7156,1,4,0),h(7930,3,4,8510),s(8897,9478,[[8897,1.5,4],[8994,0.5,4],[9091,0.5,3],[9188,1.5,3],[9285,1.5,3],[9381,1.5,2],[9478,2.5,2]]),
  t(9672,5,5,0),t(9865,0,4,0),t(9865,7,3,0),t(10059,1,2,0),
  t(10059,5,2,0),t(10252,3,2,0),t(10252,7,2,0),t(10446,4,2,0),
  t(10446,8,2,0),t(11026,6,4,0),t(12188,3,4,0),t(12575,5,5,0),
  s(12962,14510,[[12962,1,4],[13058,1,4],[13155,2.5,4],[13252,2.5,4],[13349,1.5,3],[13446,1.5,3],[13542,1.5,3],[13639,1.5,3],[13736,1.5,3],[13833,1.5,3],[13929,1.5,3],[14026,1.5,3],[14123,1.5,2],[14220,1.5,2],[14316,2.5,2],[14413,2.5,2],[14510,3,2]]),t(13349,3,5,0),t(13736,5,4,0),f(14123,6,4),
  t(14704,4,5,0),t(14897,2,5,0),h(15671,1,5,17219),t(16542,0,5,0),
  t(16832,0,1,0),t(17994,0,5,0),t(18574,2,5,0),t(18768,4,5,0),
  h(19639,5,5,20413),t(20703,2,5,0),t(20993,5,5,0),t(22348,2,5,0),
  t(23026,4,5,0),t(23316,2,5,0),t(23413,0,5,0),t(24574,0,5,0),
  t(25348,0,5,0),f(25735,0,5),t(26509,2,1,0),t(27380,2,5,0),
  h(27477,4,5,28348),t(28638,5,5,0),t(28832,6,4,0),s(29606,30380,[[29606,3,4],[29702,2.5,3],[29799,2,3],[29896,2,3],[29993,3,2],[30090,3,3],[30186,3,3],[30283,3.5,3],[30380,4,4]],1),
  s(29606,30380,[[29606,0,2],[30380,1,2]]),t(31154,1,2,0),t(31154,5,2,0),t(31541,3,2,0),
  t(31541,7,2,0),t(31928,1,2,0),t(31928,5,2,0),t(32702,2,5,0),
  t(33283,0,5,0),h(33476,3,3,34347),h(34638,0,5,35702,0,[[34638,0,5],[35025,1,4],[35315,2,2],[35702,2,1]]),t(35799,0,5,0),
  t(35992,2,5,0),t(37541,4,5,0),f(37637,5,5),t(38702,0,5,0),
  t(39089,2,8,0),t(39670,0,2,0),t(39670,4,2,0),t(40444,2,2,0),
  t(40444,6,2,0),t(41218,4,2,0),t(41218,8,2,0),t(41798,2,5,0),
  t(42573,0,5,0),t(43153,3,4,0),t(43347,5,5,0),t(43927,0,4,0),
  t(43927,7,3,0),t(44314,1,2,0),t(44314,5,2,0),t(44701,3,2,0),
  t(44701,7,2,0),t(45089,1,2,0),t(45089,5,2,0),t(45476,5,4,0),
  t(45863,6,4,1),h(46250,4,5,47121),f(46637,3,4),h(47411,1,4,48379),
  t(49153,2,5,0),h(50508,1,5,51765),t(50991,4,5,0),t(51185,2,5,0),
  h(52153,0,5,52733),t(52830,6,1,0),t(52927,2,5,0),t(54088,0,5,0),
  t(54475,1,4,0),t(54862,3,4,0),t(54959,5,4,0),t(55346,6,4,0),
  s(55926,57088,[[55926,2,3],[56217,0,3],[56507,1,3],[56797,3,3],[57088,4,3]]),t(56507,3,4,0),t(56701,0,5,0),t(57281,0,5,0),
  f(57572,0,5),t(57959,1,5,0),t(58055,0,4,0),t(58249,4,1,0),
  t(58346,0,5,0),t(58830,6,4,0),t(58830,0,3,0),t(59313,4,5,0),
  t(59700,1,2,0),t(59700,5,2,0),t(59991,2,2,0),t(59991,6,2,0),
  t(60281,3,2,0),t(60281,7,2,0),h(60571,2,1,61249),t(61926,0,5,0),
  t(62507,5,4,0),t(62894,0,4,0),t(62894,7,3,0),t(63474,5,5,0),
  f(64055,3,4),h(64829,2,1,65603,1,[[64829,2,1],[65216,0,5],[65603,2,1]]),s(65990,67539,[[65990,3.5,4],[66184,3,3],[66377,2,3],[66571,2,3],[66764,3.5,2],[66958,3.5,3],[67152,3.5,3],[67345,3.5,3],[67539,3.5,4]]),t(66377,0,5,0),
  t(66571,0,5,0),t(66764,0,5,0),t(67152,2,5,0),t(67732,1,4,0),
  t(67926,3,4,0),t(68313,7,3,0),t(69280,2,8,0),t(70151,3,3,0),
  t(70538,4,4,0),t(70635,5,5,0),t(70925,4,5,0),t(71409,2,1,0),
  t(72087,3,4,0),t(72474,5,4,0),t(72861,4,4,0),t(72958,5,5,0),
  f(73635,5,4),t(74022,3,4,0),t(74216,2,5,0),h(74409,0,5,74990),
  t(75183,0,4,0),t(75183,7,3,0),t(75377,0,5,0),t(75764,1,5,0),
  t(75861,0,5,0),t(76344,2,5,0),t(76441,1,4,0),t(77119,0,4,0),
  t(77215,1,4,0),t(77312,2,5,0),t(77699,5,3,0),t(77796,6,4,0),
  t(78280,5,4,0),f(78570,2,5),t(78957,1,4,0),t(79247,3,3,0),
  t(79344,5,4,0),h(79635,2,5,80409,0,[[79635,2,5],[80022,4,1],[80409,2,5]]),s(80602,81376,[[80602,3,3],[80892,3.5,3],[81183,1.5,3],[81376,0.5,3]]),t(81667,5,4,0),
  t(82054,6,4,0),t(82247,1,2,0),t(82247,5,2,0),t(82634,3,2,0),
  t(82634,7,2,0),t(83021,1,2,0),t(83021,5,2,0),t(83408,5,5,0),
  t(83602,4,5,0),t(83796,3,3,0),t(84183,4,5,0),t(84376,3,4,0),
  t(84570,4,5,0),f(84957,5,5),t(85344,0,2,0),t(85344,4,2,0),
  t(85537,2,2,0),t(85537,6,2,0),t(85731,4,2,0),t(85731,8,2,0),
  t(86118,6,4,0),t(86505,4,5,0),t(86699,0,5,0),t(86892,0,4,0),
  t(86892,7,3,0),t(87086,5,3,0),t(87279,6,4,0),t(87666,4,5,0),
  t(88053,5,4,0),t(88247,5,5,0),t(88440,2,8,0),t(88634,5,5,0),
  t(88924,5,4,0),s(89021,90472,[[89021,2,4],[89214,1.5,4],[89311,1.5,4],[89408,2,3],[89602,2,3],[89795,3,3],[89892,3,3],[90085,3.5,3],[90279,3.5,2],[90376,3.5,2],[90472,3.5,2]]),t(89795,0,5,0),t(90569,0,3,0),
  f(90956,0,5),t(91343,0,5,0),s(92118,93666,[[92118,2,2],[92311,2,3],[92505,2,3],[92698,2.5,4],[92892,3,4],[93085,3,4],[93279,2.5,3],[93472,1,3],[93666,1,2]],1),t(92795,6,4,0),
  t(93085,0,5,0),s(94150,95698,[[94150,2,4],[94246,0.5,4],[94343,0.5,3],[94537,1.5,3],[94730,2,3],[94924,2.5,2],[95117,2.5,3],[95311,2.5,3],[95504,2.5,3],[95601,2.5,4],[95698,2.5,4]]),t(94827,0,5,0),t(95021,0,4,0),
  t(95795,0,5,0),t(96182,0,4,0),t(96569,0,4,0),t(96956,0,4,0),
  t(97343,0,4,0),t(97343,7,3,0),t(98117,4,5,0),t(98214,2,5,0),
  t(98504,1,4,0),f(98891,0,5),t(99278,0,4,0),t(99665,0,5,0),
  t(100052,1,4,0),t(100440,0,5,0),t(100827,1,4,0),t(101601,4,1,0),
  t(102278,4,5,0),t(103149,3,3,0),t(103536,5,5,0),t(103826,4,5,0),
  t(104117,2,5,0),t(104504,0,5,0),t(104891,0,5,0),t(105665,1,4,0),
  s(106246,107020,[[106246,0,3],[106536,1,3],[106826,3,3],[107020,4,3]]),t(106633,4,5,2),f(107213,0,5),h(107794,3,3,108471),
  t(108568,4,5,0),t(109342,5,5,0),t(109536,4,5,0),s(109729,111665,[[109729,4,2],[111665,3,2]]),
  s(110116,111665,[[110116,2,4],[110310,0,4],[110503,0,3],[110600,0,3],[111084,0,3],[111665,0.5,2]]),t(111858,6,4,0),t(112052,6,4,0),t(113213,0,5,0),
  t(113406,3,4,0),t(113987,4,5,0),t(114761,5,5,0),h(115535,4,5,116116),
  t(116309,2,5,0),t(117084,0,5,0),t(117374,1,8,0),h(118148,5,4,118922),
  f(119019,5,5),h(119406,4,3,120567,1),t(119793,8,2,0),t(119987,5,4,0),
  t(121245,2,5,0),t(121535,4,5,0),t(121632,2,5,0),t(122503,0,5,0),
  t(123180,0,4,0),t(123180,7,3,0),t(123567,0,5,0),t(123954,0,5,0),
  h(124341,0,5,124922),t(125018,3,3,0),t(125115,4,3,0),t(125502,5,5,0),
  t(125696,5,4,0),t(125889,2,5,0),t(126180,1,4,0),t(126470,0,4,0),
  f(126664,0,5),t(127051,5,4,0),t(127147,3,3,0),t(127438,5,5,0),
  t(127534,3,4,0),t(127825,5,5,0),t(128115,6,4,0),t(128115,0,3,0),
  t(128405,4,5,0),h(128502,3,3,129179),t(129276,5,4,0),t(129373,0,5,0),
  t(129663,4,5,0),t(129857,3,4,0),t(130147,6,4,0),t(130341,5,4,0),
  t(130437,3,4,0),f(130534,1,5),t(131115,1,4,0),t(131212,0,4,0),
  t(131502,2,5,0),t(131986,2,5,0),t(132179,5,4,0),t(132276,2,5,0),
  t(132470,0,5,0),t(132760,3,3,0),t(133147,0,5,0),t(133437,0,5,0),
  t(133631,0,5,0),t(134018,3,5,0),t(134115,5,4,0),t(134405,2,5,0),
  t(134792,1,5,0),h(134889,0,4,135663),f(135760,2,5),t(136147,0,5,0),
  t(136244,3,3,0),t(136340,2,8,0),h(136534,7,1,137405,1,[[136534,7,1],[137018,6,3],[137405,5,5]]),t(136921,2,5,0),
  t(138082,1,5,0),t(138179,3,4,0),t(138276,0,5,0),t(138566,0,5,0),
  t(138856,2,5,0),t(138953,1,4,0),t(139630,1,3,0),t(139630,7,3,0),
  t(139824,7,3,0),t(140695,6,4,0),t(141856,4,5,0),t(141953,7,3,0),
  f(142243,2,5),t(143017,5,4,0),t(143404,5,5,0),t(143598,4,5,0),
  t(143791,5,5,0),t(143985,4,5,0),t(144178,6,4,0),t(144566,5,4,0),
  t(145340,3,4,0),t(145727,5,4,0),h(145920,0,5,146501),t(146888,0,5,0),
  h(147275,3,4,147856),t(148049,4,5,0),t(148243,5,5,0),t(148436,3,4,0),
  t(148630,6,3,0),t(148630,0,3,0),t(148823,6,4,0),s(149017,149791,[[149017,3,4],[149114,2.5,4],[149307,2.5,3],[149597,2.5,2],[149694,2.5,2],[149791,4,2]]),
  s(149017,149791,[[149017,1,2],[149791,0,2]]),f(149984,0,4),t(150372,2,5,0),s(150759,152113,[[150759,4,4],[150855,4,4],[151146,3.5,3],[151630,2.5,3],[151823,1.5,2],[152113,1.5,2]]),
  t(151146,3,4,0),t(151339,0,5,0),t(151533,1,5,0),t(152307,5,4,0),
  t(152694,3,3,0),t(153081,1,4,0),t(153468,0,4,0),h(153855,1,4,155403),
  t(154242,3,4,0),t(155016,0,4,0),h(155791,0,4,157339,1),f(156565,1,4),
  t(156952,1,4,3),t(158113,3,4,0),t(158887,5,5,0),t(159274,5,5,0),
  t(159661,6,4,0),t(160629,0,5,0),t(160822,2,5,0),t(161210,5,5,0),
  t(161984,1,8,0),t(162758,0,4,0),t(163532,2,5,0),t(163919,0,5,0),
  t(164306,0,5,0),t(165080,0,5,0),t(165467,0,5,0),t(165854,3,4,0),
  f(166048,0,5),s(167403,168951,[[167403,0,3],[167693,1.5,3],[167983,3,3],[168274,4,3],[168564,4,3],[168854,4,3],[168951,4,3]]),t(167790,0,4,0),t(168177,3,4,0),
  t(168564,4,4,0),h(169338,3,5,170886,0,[[169338,3,5],[169725,4,4],[170112,4,3],[170499,5,2],[170886,5,1]]),t(170112,5,4,0),t(170499,3,4,0),
  t(171660,0,5,0),t(172241,0,5,0),t(172435,2,5,0),t(173209,6,4,0),
  t(173209,0,3,0),t(173596,6,4,0),t(173789,2,5,0),f(173983,4,5),
  t(174370,5,5,0),t(174660,4,5,0),t(174757,3,4,0),t(174951,4,5,0),
  t(175144,2,5,0),t(175338,5,5,0),h(175531,4,5,176112,1),t(176499,2,5,0),
  h(176692,4,1,177660,0,[[176692,4,1],[176983,2,4],[177370,2,4],[177660,4,1]]),t(177079,0,2,0),t(177273,0,5,0),t(177854,0,5,0),
  t(178047,2,5,0),t(178241,5,5,0),t(178628,0,4,0),t(178628,7,3,0),
  t(179015,3,4,0),t(179208,4,5,0),t(179402,6,4,0),t(179789,5,4,0),
  t(179982,0,5,0),t(180176,3,4,0),t(180369,4,5,0),f(180563,5,5),
  t(180950,4,5,0),t(181144,5,5,0),t(181337,5,3,0),t(181531,5,5,0),
  t(181724,7,3,0),t(181918,4,5,0),t(182111,6,4,0),t(182305,4,5,0),
  t(182498,0,5,0),t(182885,5,4,0),t(183079,1,8,0),t(183273,6,4,0),
  t(183563,2,5,0),t(183660,5,3,0),t(183853,2,5,0),f(184047,1,4),
  t(184434,0,4,0),t(184434,7,3,0),t(184627,0,5,0),t(184821,0,5,0),
  t(185401,0,5,0),t(185595,0,5,0),t(185982,4,5,0),t(186369,0,5,0),
  t(186756,6,4,0),t(186950,3,4,0),t(187143,5,4,0),t(187337,0,5,0),
  t(187434,5,4,0),f(187530,2,5),t(187917,1,4,0),t(188111,0,5,0),
  t(188304,1,4,0),t(188498,4,5,0),t(188691,3,4,0),t(188885,4,4,0),
  t(188982,2,5,0),t(189079,5,4,0),t(189272,6,4,0),t(189466,5,4,0),
  t(189659,3,4,0),t(189853,5,4,0),t(190046,3,5,0),t(190143,5,4,0),
  t(190240,3,4,0),t(190433,0,4,0),t(190627,0,5,0),t(190820,0,4,0),
  t(191014,0,5,0),t(191207,0,4,0),t(191401,3,4,0),t(191595,1,3,0),
  t(191595,7,3,0),t(191788,4,5,0),t(191982,2,5,0),t(192078,4,5,0),
  t(192175,3,4,0),t(192369,1,3,0),f(192562,2,5),t(192949,0,5,0),
  t(193336,0,4,0),t(193723,1,4,0),t(193917,0,5,0),t(194110,0,5,0),
  t(194304,0,4,0),t(194498,1,4,0),t(194885,0,4,0),t(195078,0,5,0),
  t(195272,0,4,0),f(195659,0,4),t(196046,0,8,0),t(196239,5,4,0),
  t(196433,2,5,0),t(196626,5,5,0),t(196820,5,3,0),t(197013,6,4,0),
  t(197207,2,5,0),t(197594,7,3,0),t(197788,5,3,0),t(197981,3,3,0),
  t(198562,0,4,0),t(198562,7,3,0),t(198755,0,5,0),t(199142,0,5,0),
  t(199723,3,3,0),h(199820,5,5,201271,0,[[199820,5,5],[200207,6,3],[200594,7,1],[200884,6,3],[201271,5,5]]),t(200304,3,4,0),t(200497,0,4,0),
  t(200691,1,5,0),f(200884,4,5),t(201465,5,5,0),h(201852,5,4,202626),
  t(202239,6,4,0),t(202820,4,5,0),t(203013,2,5,0),t(203110,4,4,0),
  t(203207,5,5,0),t(203400,4,5,0),s(203594,204368,[[203594,2,4],[203690,1.5,3],[203787,1.5,3],[203884,1.5,3],[203981,0.5,2],[204078,0.5,3],[204174,0.5,3],[204271,1.5,3],[204368,2.5,4]]),t(204561,0,4,0),
  t(204755,0,5,0),t(204948,0,5,0),s(205336,206593,[[205336,1.5,4],[205529,0,3],[205626,0,3],[205723,0,3],[205819,0,3],[205916,0,2],[206013,0,2],[206206,0,3],[206400,0.5,3],[206593,1,4]]),t(205723,1,4,0),
  f(206110,1,4),t(206884,2,5,0),t(207077,4,5,0),t(207271,6,4,0),
  t(207464,4,5,0),t(207658,1,4,0),t(207851,2,5,0),t(208045,4,5,0),
  t(208432,6,4,0),t(208626,4,5,0),t(208819,0,4,0),t(208819,7,3,0),
  t(209013,0,5,0),s(209206,210754,[[209206,2,4],[209400,2,4],[209690,2,3],[209980,0,3],[210174,0,3],[210754,0,2]]),t(209593,6,4,4),t(209980,3,3,0),
  t(210367,1,4,0),t(210948,3,3,0),t(211142,0,4,0),f(211529,1,4),
  t(211916,2,5,0),t(212109,4,5,0),t(212303,5,5,0),t(212496,3,4,0),
  s(212690,213851,[[212690,2,2],[212787,2,3],[212883,2,3],[212980,2,3],[213077,2,4],[213174,2,4],[213270,4,4],[213367,4,4],[213464,2,4],[213561,2,3],[213658,2,3],[213754,2,3],[213851,2,2]],1),t(213077,0,4,0),t(213270,0,8,0),t(213464,0,4,0),
  t(214238,0,5,0),t(214432,2,5,0),t(214625,5,4,0),t(215012,6,4,0),
  t(215206,5,3,0),t(215399,0,5,0),t(215593,2,5,0),f(215786,4,5),
  t(216173,7,3,0),t(216367,5,4,0),t(216561,3,4,0),t(216754,5,4,0),
  t(216948,6,4,0),t(217335,0,4,0),t(217335,7,3,0),t(217528,0,4,0),
  t(217722,3,4,0),t(217915,6,4,0),t(218109,3,4,0),t(218496,0,4,0),
  t(218689,2,5,0),t(218883,1,3,0),t(219270,3,4,0),t(219657,1,4,0),
  t(220044,0,4,0),t(220238,0,5,0),f(220431,0,5),t(220818,0,5,0),
  h(221012,0,5,221592,1),t(221980,0,4,0),t(222754,1,4,0),s(223141,224689,[[223141,1.5,4],[223334,1.5,4],[223625,1.5,3],[224108,1.5,3],[224689,1.5,2]],1),
  t(223721,4,3,0),t(223915,5,4,0),t(224302,5,4,0),t(225076,6,4,0),
  t(225270,6,4,0),t(225463,1,4,0),t(225850,6,4,0),t(226237,1,4,0),
  t(226624,6,4,0),t(227398,1,4,0),t(227786,6,4,0),t(228173,0,5,0),
  t(229721,3,4,0),f(229818,4,5),t(230495,0,4,0),t(230495,7,3,0),
  t(231269,1,4,0),t(231850,0,5,0),t(232043,1,4,0),t(232140,2,5,0),
  t(232527,4,5,0),t(233592,5,4,0),t(233785,5,5,0),t(234366,5,4,0),
  t(235237,2,8,0),t(235430,4,5,0),t(236108,7,3,0),t(236495,5,3,0),
  t(236978,3,4,0),t(237172,0,5,0),t(237946,0,5,0),f(238527,0,4),
  t(239011,3,4,0),t(239398,6,4,0),t(239494,2,5,0),t(239785,4,4,0),
  t(239881,5,5,0),t(240849,4,5,0),t(241623,4,4,0),h(241720,7,1,243268,0,[[241720,7,1],[242107,6,2],[242494,6,3],[242881,5,4],[243268,5,5]]),
  t(242591,3,3,0),t(242785,3,4,0),t(243462,7,3,0),t(244236,6,4,0),
  t(244236,0,3,0),t(244623,7,3,0),t(244720,5,4,0),t(244913,2,5,0),
  f(245300,0,5),t(245688,4,5,0),t(246075,2,5,0),t(246171,5,5,0),
  t(246946,4,5,0),t(247720,5,5,0),t(247816,4,5,0),t(248204,5,5,0),
  t(248494,2,5,0),t(248784,5,5,0),t(248978,4,5,0),t(250042,5,5,0),
  t(250332,2,5,0),t(250719,0,5,0),t(250913,0,5,0),f(251590,0,5),
  t(252074,0,5,0),t(252268,0,5,0),t(252461,0,5,0),t(252655,2,5,0),
  s(252752,254203,[[252752,3,4],[252848,3,4],[253235,3,3],[253332,3,3],[253622,2.5,3],[254106,1,2],[254203,1,2]],1),t(255558,0,5,0),t(255848,2,5,0),t(255945,1,4,0),
  t(256526,0,5,0),t(256719,0,5,0),t(257783,5,5,0),t(258074,4,5,0),
  t(258558,2,5,0),t(258848,0,5,0),t(259041,0,5,0),t(259332,0,8,0),
  t(260299,0,4,0),f(260396,3,4),
// </eiki-boss-v3-expert-notes>
])(mhTap,mhHoldV2,mhFlick,mhSlideV2);
const eikiBossMasterNotes=((t,h,f,s)=>[
// <eiki-boss-v3-master-notes>
  t(1930,0,6,0),f(2124,3,4),s(2898,4446,[[2898,3,3],[2995,3,3],[3091,1,2],[3188,1,2],[3285,1,2],[3382,1,2],[3478,0.5,2],[3575,0.5,2],[3672,0.5,2],[3769,2,2],[3866,2,2],[3962,1,2],[4059,1,2],[4156,1,2],[4253,1,2],[4349,1,3],[4446,1,3]],1),s(3382,4059,[[3382,4,2],[4059,3,2]]),
  h(4833,7,1,6382,0,[[4833,7,1],[5220,6,2],[5607,6,3],[5994,6,3],[6382,5,4]]),t(5801,9,1,0),t(5994,5,3,0),t(6575,6,4,0),
  t(6865,3,4,0),t(7059,5,4,0),t(7156,3,3,0),h(7930,1,3,8510),
  s(8897,9478,[[8897,1.5,3],[8994,0.5,3],[9091,0.5,2],[9188,1.5,2],[9285,1.5,2],[9381,1.5,2],[9478,2.5,2]]),t(9672,1,4,0),t(9672,7,3,0),t(9865,1,2,0),
  t(9865,5,2,0),t(10059,3,2,0),t(10059,7,2,0),t(10252,1,2,0),
  t(10252,5,2,0),t(10446,3,2,0),t(10446,7,2,0),t(10736,5,4,0),
  f(11026,5,3),t(12188,5,3,0),t(12381,6,4,0),t(12575,5,4,0),
  s(12962,14510,[[12962,2,3],[13058,2,3],[13155,3.5,3],[13252,3.5,3],[13349,3,2],[13446,3,2],[13542,3,2],[13639,3,2],[13736,2.5,2],[13833,3,2],[13929,3,2],[14026,3,2],[14123,2.5,2],[14220,2.5,2],[14316,3.5,2],[14413,3.5,2],[14510,4,2]]),h(12962,0,2,13833),t(14123,6,3,0),t(14704,6,4,0),
  t(14897,5,4,0),t(15478,8,1,0),h(15671,5,4,17219),t(16542,3,4,0),
  t(16832,8,1,0),t(17994,3,4,0),t(18284,5,4,0),t(18574,6,4,0),
  t(18574,1,3,0),h(18768,5,4,19445),h(19639,3,4,20413),t(20606,1,4,0),
  t(20703,3,4,0),f(20993,5,4),t(22348,3,4,0),t(23026,5,4,0),
  t(23316,3,4,0),t(23413,1,4,0),s(23800,24380,[[23800,1.5,3],[23896,1,3],[24090,0,2],[24284,0,2],[24380,0,2]]),s(23800,24380,[[23800,3,2],[24380,4,2]]),
  t(24574,3,4,0),t(25348,5,4,0),t(25735,6,4,0),t(26509,6,1,0),
  t(27380,3,4,0),h(27477,5,4,28348),t(28638,3,4,0),f(28832,3,3),
  s(29606,30380,[[29606,3,3],[29702,2.5,2],[29799,2,2],[29896,2,2],[29993,3,2],[30090,3,2],[30186,3,2],[30283,3.5,2],[30380,4,3]],1),s(29606,30380,[[29606,0,2],[30380,1,2]]),t(31154,0,4,0),t(31541,3,4,0),
  t(31928,6,4,0),t(32702,3,4,0),t(33283,0,4,0),h(33476,4,2,34347),
  h(34638,1,4,35702,0,[[34638,1,4],[35025,2,3],[35315,2,2],[35702,3,1]]),t(35799,0,4,0),t(35992,3,4,0),t(37541,5,4,0),
  t(37637,6,4,0),t(38702,5,4,0),t(39089,3,4,0),f(39670,1,3),
  t(40057,0,3,0),t(40444,1,3,0),t(41218,3,3,0),t(41508,5,4,0),
  s(41798,42379,[[41798,4,2],[42089,2.5,2],[42379,0,2]]),t(42573,1,4,0),t(43153,0,3,0),t(43347,1,4,0),
  t(43927,2,3,0),t(43927,7,3,0),t(44314,5,4,0),t(44701,0,4,1),
  t(45089,3,4,0),t(45282,6,4,0),t(45476,3,3,0),t(45863,0,3,0),
  t(45863,5,3,0),h(46250,3,4,47121),f(46637,5,3),s(47024,48185,[[47024,4,2],[48185,3,2]]),
  t(47411,3,3,0),h(47604,1,4,48379),t(49153,0,4,0),h(50508,2,4,51765),
  t(50991,5,4,0),t(51185,3,4,0),h(52153,1,4,52733),t(52830,6,1,0),
  t(52927,3,4,0),t(54088,1,4,0),t(54475,3,3,0),t(54862,5,3,0),
  t(54959,3,3,0),t(55346,1,3,0),t(55926,3,4,0),s(56217,57088,[[56217,1.5,3],[56314,1,3],[56507,2,2],[56701,3,2],[56894,3.5,2],[56991,3.5,2],[57088,3.5,2]]),
  f(56701,1,4),t(57281,1,4,0),t(57281,7,3,0),t(57572,5,4,0),
  t(57765,6,4,0),t(57959,5,4,0),t(58055,7,3,0),t(58249,5,1,0),
  t(58346,4,6,0),t(58830,7,3,0),s(59313,59991,[[59313,3,2],[59410,2.5,2],[59507,2.5,3],[59604,2.5,3],[59700,4,3],[59797,4,3],[59894,4,2],[59991,2.5,2]]),s(59313,59991,[[59313,1,2],[59991,0,2]]),
  t(60281,5,4,0),h(60571,8,1,61249,1),t(61926,1,4,0),t(62507,3,3,0),
  t(62894,5,3,0),f(63474,6,4),t(64055,5,3,0),t(64248,3,3,0),
  h(64829,1,3,65603,1),s(65990,67539,[[65990,4,3],[66184,3.5,2],[66377,2.5,2],[66571,2.5,2],[66764,4,2],[66958,4,2],[67152,4,2],[67345,4,2],[67539,4,3]]),t(66377,1,4,0),t(66571,0,4,0),
  t(66764,1,4,0),t(67152,3,4,0),t(67732,1,3,0),t(67732,6,3,0),
  t(67926,3,3,0),t(68313,8,2,0),h(68893,7,1,69861,0,[[68893,7,1],[69184,6,3],[69571,6,3],[69861,7,1]]),t(69280,9,1,0),
  t(70151,4,2,0),t(70538,5,3,0),t(70635,6,4,0),f(70925,5,4),
  t(71409,2,1,0),t(72087,3,3,0),t(72474,5,3,0),t(72861,7,3,0),
  t(72958,5,4,0),t(73635,3,3,0),t(74022,1,3,0),t(74216,1,4,0),
  t(74312,0,4,0),h(74409,1,4,74990),t(75183,0,3,0),t(75377,0,4,0),
  t(75377,6,3,0),t(75764,1,4,0),t(75861,0,4,0),t(76344,1,4,0),
  t(76441,3,3,0),f(76635,7,3),t(77119,3,3,0),t(77215,5,3,0),
  t(77312,6,4,0),t(77699,6,2,0),t(77796,1,3,0),t(78183,0,1,0),
  t(78280,1,3,0),t(78570,0,4,0),t(78957,0,3,0),t(79247,2,2,0),
  t(79344,0,3,0),h(79635,1,4,80409,0,[[79635,1,4],[80022,3,1],[80409,1,4]]),s(80602,81376,[[80602,3,2],[80892,3.5,2],[81183,1,2],[81376,0,2]]),f(81667,1,3),
  t(82054,5,3,0),t(82247,4,6,0),t(82634,6,4,0),t(83021,5,3,0),
  t(83021,0,3,0),t(83408,6,4,0),t(83505,6,2,0),t(83602,3,4,0),
  t(83796,8,2,0),t(83796,4,2,0),t(83989,1,2,0),t(83989,5,2,0),
  t(84183,3,2,0),t(84183,7,2,0),t(84376,4,2,0),t(84376,8,2,0),
  t(84570,0,4,0),t(84957,1,4,0),t(85344,3,4,0),t(85537,5,4,0),
  f(85731,3,3),t(86118,5,3,0),t(86311,2,2,0),t(86311,6,2,0),
  t(86505,2,2,0),t(86505,7,2,0),t(86699,1,2,0),t(86699,7,2,0),
  t(86892,1,2,0),t(86892,8,2,0),t(87086,2,2,0),t(87279,0,3,0),
  t(87666,0,4,0),t(88053,1,3,0),t(88247,1,4,0),t(88440,5,4,0),
  t(88634,1,4,0),t(88634,7,3,0),t(88924,5,3,0),s(89021,90472,[[89021,2,3],[89214,1.5,3],[89311,1.5,3],[89408,1.5,2],[89602,1.5,2],[89795,2.5,2],[89892,2.5,2],[90085,3.5,2],[90279,3.5,2],[90376,3.5,2],[90472,3.5,2]]),
  t(89505,0,2,0),t(89795,1,4,0),t(90569,4,2,0),f(90956,5,4),
  t(91343,1,4,0),s(92118,93666,[[92118,1.5,2],[92311,1,2],[92505,1,2],[92698,2,3],[92892,2.5,3],[93085,2,3],[93279,1.5,2],[93472,0.5,2],[93666,0.5,2]],1),t(92795,1,3,0),t(93085,0,4,0),
  s(94150,95698,[[94150,1.5,3],[94246,0,3],[94343,0,2],[94537,1,2],[94730,1.5,2],[94924,2,2],[95117,2,2],[95311,2,2],[95504,2,2],[95601,2,3],[95698,2,3]]),t(94827,0,4,0),t(95021,0,3,0),t(95795,1,4,0),
  t(96182,3,3,0),t(96279,1,3,0),t(96569,0,3,0),t(96956,1,3,0),
  t(96956,6,3,0),f(97343,5,3),t(98117,1,4,0),t(98214,5,4,0),
  t(98504,3,3,0),t(98891,4,6,0),t(99182,3,4,0),t(99278,1,3,0),
  t(99569,5,4,0),t(99665,3,4,0),t(100052,1,3,0),t(100440,0,4,0),
  t(100827,1,3,0),t(101601,6,1,0),t(102278,3,4,0),t(103149,8,2,0),
  t(103536,6,4,0),t(103826,3,4,0),t(104117,6,4,0),f(104504,3,4),
  t(104891,6,4,0),t(105665,3,3,0),s(106246,107020,[[106246,0,2],[106536,1,2],[106826,3.5,2],[107020,4,2]]),t(106633,0,4,2),
  t(107213,1,4,0),h(107794,4,2,108471),t(108568,5,4,0),t(109342,6,4,0),
  t(109536,5,4,0),s(110116,111665,[[110116,2,3],[110310,0,3],[110503,0,2],[110600,0,2],[111084,0,2],[111665,0.5,2]]),s(110116,111665,[[110116,4,2],[111665,3,2]]),t(111858,7,3,0),
  t(112052,7,3,0),t(113019,8,2,0),t(113213,5,4,0),f(113406,3,3),
  t(113987,1,4,0),t(114761,0,4,0),h(115535,1,4,116116),t(116309,1,4,0),
  t(116309,7,3,0),t(117084,1,4,0),t(117374,3,4,0),t(117567,5,4,0),
  h(118148,7,3,118922),t(119019,5,4,0),h(119406,4,2,120567,1),t(119793,7,2,0),
  t(119987,5,3,0),t(121245,1,4,0),t(121245,7,3,0),t(121535,3,4,0),
  f(121632,1,4),t(122309,0,3,0),t(122503,0,4,0),t(123180,0,3,0),
  t(123567,0,4,0),t(123954,0,4,0),h(124341,0,4,124922),t(125018,2,2,0),
  f(125115,0,2),t(125502,0,6,0),t(125696,5,3,0),t(125889,3,4,0),
  t(126180,1,3,0),t(126470,0,3,0),t(126664,1,4,0),t(126857,3,3,0),
  t(127051,5,3,0),t(127147,8,2,0),t(127438,6,4,0),t(127534,5,3,0),
  t(127631,3,4,0),t(127825,5,4,0),t(127825,0,3,0),t(128115,3,3,0),
  t(128405,0,4,0),h(128502,4,2,129179),t(129276,7,3,0),t(129373,3,4,0),
  t(129663,6,4,0),t(129857,3,3,0),t(130147,7,3,0),t(130341,5,3,0),
  t(130437,3,3,0),t(130534,1,4,0),t(130825,0,3,0),t(131115,1,3,0),
  t(131212,5,3,0),f(131502,3,4),t(131986,5,4,0),t(132179,7,3,0),
  t(132276,5,4,0),t(132470,3,4,0),t(132760,2,2,0),t(132760,6,2,0),
  t(133147,2,4,0),t(133244,1,3,0),t(133437,0,4,0),t(133631,0,4,0),
  t(134018,3,4,0),t(134115,7,3,0),t(134405,3,4,0),t(134792,5,4,0),
  h(134889,8,1,135663,0,[[134889,8,1],[135276,7,3],[135663,6,4]]),f(135760,6,4),t(136147,5,4,0),t(136244,8,2,0),
  t(136340,5,4,0),h(136534,5,4,137405,1),t(136921,3,4,0),t(138082,1,4,0),
  t(138179,0,3,0),t(138276,1,4,0),t(138566,1,4,0),t(138663,0,3,0),
  t(138856,2,6,0),t(138953,7,3,0),t(139630,4,2,0),t(139630,8,2,0),
  f(139824,8,2),t(140695,7,3,0),t(141856,5,4,0),t(141953,8,2,0),
  t(142243,3,4,0),t(143017,5,3,0),t(143404,1,2,0),t(143404,5,2,0),
  t(143598,3,2,0),t(143598,7,2,0),t(143791,1,2,0),t(143791,5,2,0),
  t(143985,3,2,0),t(143985,7,2,0),t(144178,3,3,0),t(144372,6,4,0),
  t(144566,3,3,0),t(144953,0,3,0),t(145340,1,3,0),t(145727,3,3,0),
  h(145920,0,4,146501,1),f(146888,1,4),h(147275,7,3,147856),t(148049,5,4,0),
  t(148243,6,4,0),t(148243,1,3,0),t(148436,5,3,0),t(148630,8,2,0),
  t(148727,3,2,0),t(148823,4,3,0),s(149017,149791,[[149017,0,2],[149307,0.5,2],[149597,2.5,2],[149791,4,2]]),t(149404,4,3,0),
  t(149984,5,3,0),t(150372,6,4,0),s(150759,152113,[[150759,3,3],[150855,3,3],[151146,2.5,2],[151630,1.5,2],[151823,0.5,2],[152113,0.5,2]]),t(151146,7,3,0),
  t(151339,5,4,0),t(151533,4,4,0),f(152307,1,3),t(152694,4,2,0),
  t(152888,6,4,0),t(153081,5,3,0),t(153081,0,3,0),t(153371,3,4,0),
  t(153468,5,3,0),s(153662,155016,[[153662,2,2],[155016,1,2]]),h(153855,6,4,155403,0,[[153855,6,4],[154242,7,3],[154629,7,3],[155016,8,2],[155403,8,1]]),h(155791,0,3,157339,1),
  t(156178,3,3,0),t(156565,7,3,0),t(156952,3,3,3),h(157726,0,3,158306,1),
  t(158887,1,4,0),t(159274,3,4,0),t(159661,0,3,0),t(160629,1,4,0),
  f(160822,3,4),t(161210,4,6,0),t(161984,6,4,0),t(162371,6,4,0),
  t(162758,5,3,0),t(163532,3,4,0),t(163919,1,4,0),t(164306,0,4,0),
  t(165080,1,4,0),t(165467,0,4,0),t(165854,1,3,0),t(166048,3,4,0),
  t(166435,1,4,0),s(167403,168951,[[167403,1.5,3],[167983,3,2],[168467,3.5,2],[168757,3.5,2],[168951,3.5,2]],1),s(167403,168951,[[167403,0,2],[168951,2,2]]),h(169338,4,4,170886),
  t(170112,1,3,0),t(170499,3,3,0),t(171177,5,4,0),t(171467,6,4,0),
  t(171660,6,4,0),t(172241,6,4,0),t(172241,1,3,0),t(172435,6,4,0),
  t(173209,5,3,0),t(173596,7,3,0),t(173789,5,4,0),f(173983,6,4),
  t(174370,5,4,0),t(174563,8,2,0),t(174660,6,4,0),t(174757,4,3,0),
  t(174951,0,4,0),t(175144,0,4,0),t(175338,0,4,0),h(175531,0,4,176112),
  t(176305,2,3,0),t(176305,7,3,0),t(176499,6,4,0),t(176692,3,3,0),
  h(176886,7,1,177660,0,[[176886,7,1],[177273,5,4],[177660,7,1]]),t(177273,9,1,0),t(177854,0,2,0),t(177854,4,2,0),
  t(178047,1,2,0),t(178047,5,2,0),t(178241,3,2,0),t(178241,7,2,0),
  t(178434,4,2,0),t(178434,8,2,0),t(178628,1,3,0),t(179015,0,3,0),
  t(179208,0,4,0),f(179402,0,3),t(179789,0,3,0),t(179982,0,4,0),
  t(180176,1,3,0),t(180369,0,4,0),t(180563,1,4,0),t(180757,0,6,0),
  t(180950,2,2,0),t(180950,6,2,0),t(181144,2,2,0),t(181144,7,2,0),
  t(181337,1,2,0),t(181337,7,2,0),t(181531,1,2,0),t(181531,8,2,0),
  t(181724,8,2,0),t(181724,4,2,0),t(181918,3,4,0),t(182111,5,3,0),
  t(182305,1,4,0),f(182498,0,4),t(182885,3,3,0),t(183079,6,4,0),
  t(183176,3,4,0),t(183273,5,3,0),t(183563,6,4,0),t(183660,6,2,0),
  t(183853,6,4,0),t(184047,5,3,0),t(184337,1,4,0),t(184434,3,3,0),
  t(184627,0,4,0),t(184821,1,4,0),t(185111,5,4,0),t(185401,3,4,0),
  t(185595,6,4,0),t(185982,1,4,0),f(186369,5,4),t(186756,2,3,0),
  t(186756,7,3,0),t(186950,7,3,0),t(187143,5,3,0),t(187337,6,4,0),
  t(187434,3,3,0),t(187530,5,4,0),t(187724,8,2,0),t(187917,5,3,0),
  t(188111,6,4,0),t(188208,5,4,0),t(188304,7,3,0),t(188498,5,4,0),
  t(188691,3,3,0),t(188885,5,3,0),t(188982,3,4,0),t(189079,2,3,0),
  t(189175,3,3,0),t(189272,0,3,0),t(189466,3,3,0),t(189659,7,3,0),
  t(189853,3,3,0),t(190046,5,4,0),t(190143,4,3,0),t(190240,5,3,0),
  t(190433,5,3,0),t(190433,0,3,0),t(190627,5,4,0),t(190820,5,3,0),
  t(191014,4,6,0),t(191207,3,3,0),t(191304,5,3,0),t(191401,6,3,0),
  t(191595,6,2,0),t(191788,3,4,0),t(191982,1,4,0),t(192078,3,4,0),
  t(192175,5,3,0),t(192369,8,2,0),t(192562,5,4,0),t(192756,6,4,0),
  f(192949,3,4),t(193336,1,2,0),t(193336,5,2,0),t(193530,3,2,0),
  t(193530,7,2,0),t(193723,1,2,0),t(193723,5,2,0),t(193917,3,2,0),
  t(193917,7,2,0),t(194110,1,4,0),t(194304,2,3,0),t(194304,7,3,0),
  f(194498,5,3),t(194885,1,3,0),t(195078,5,4,0),t(195272,3,3,0),
  t(195465,6,4,0),t(195659,3,3,0),t(195852,0,2,0),t(195852,4,2,0),
  t(196046,1,2,0),t(196046,5,2,0),t(196239,3,2,0),t(196239,7,2,0),
  t(196433,4,2,0),t(196433,8,2,0),t(196626,3,4,0),t(196820,2,2,0),
  t(197013,0,3,0),f(197207,1,4),t(197594,0,2,0),t(197788,2,2,0),
  t(197981,0,2,0),t(198562,3,3,0),f(198755,1,4),t(199142,5,4,0),
  t(199433,2,3,0),t(199433,7,3,0),t(199723,8,2,0),h(199820,3,4,201271,0,[[199820,3,4],[200207,4,3],[200594,5,1],[200884,4,3],[201271,3,4]]),
  h(200110,2,2,201852),t(201465,0,4,0),t(201658,4,3,0),h(201852,7,3,202626),
  f(202239,3,3),t(202820,0,4,0),t(203013,3,4,0),t(203110,7,3,0),
  t(203207,3,4,0),t(203400,0,6,0),s(203594,204368,[[203594,2,3],[203690,1.5,2],[203787,1.5,2],[203884,1.5,2],[203981,0.5,2],[204078,0.5,2],[204174,0.5,2],[204271,1.5,2],[204368,2.5,3]]),t(204561,2,2,0),
  t(204561,6,2,0),t(204755,2,2,0),t(204755,7,2,0),t(204948,2,2,0),
  t(204948,7,2,0),t(205142,1,2,0),t(205142,7,2,0),t(205336,1,3,0),
  s(205529,206593,[[205529,2,3],[205626,1,3],[205723,1,3],[205819,1,2],[205916,1.5,2],[206110,1.5,2],[206206,2,2],[206400,2.5,2],[206497,3,2],[206593,3,2]]),t(206110,0,3,0),t(206884,0,4,0),t(206884,6,3,0),
  t(207077,1,2,0),t(207077,5,2,0),t(207271,3,2,0),t(207271,7,2,0),
  t(207464,1,2,0),t(207464,5,2,0),t(207658,3,2,0),t(207658,7,2,0),
  t(207851,6,4,0),t(208045,5,4,0),t(208239,1,3,0),t(208432,3,3,0),
  t(208626,0,4,0),t(208819,1,3,0),t(209013,3,4,0),s(209206,210754,[[209206,3,3],[209400,3,3],[209690,3,2],[209980,1,2],[210174,1,2],[210754,1,2]]),
  f(209593,7,3),t(209980,6,2,4),t(210367,5,3,0),t(210948,8,2,0),
  t(211142,7,3,0),t(211238,3,3,0),t(211529,5,3,0),t(211916,6,4,0),
  t(212109,5,4,0),t(212303,1,4,0),t(212303,7,3,0),t(212496,3,3,0),
  s(212690,213851,[[212690,1.5,2],[212787,1.5,2],[212883,1.5,2],[212980,1.5,2],[213077,1.5,3],[213174,1.5,3],[213270,3.5,3],[213367,3.5,3],[213464,1.5,3],[213561,1.5,2],[213658,1.5,2],[213754,1.5,2],[213851,1.5,2]],1),t(213077,0,3,0),t(213270,1,4,0),f(213464,0,3),
  t(214238,1,4,0),t(214432,3,4,0),t(214625,5,3,0),t(214819,6,4,0),
  t(215012,3,3,0),t(215206,6,2,0),t(215399,6,4,0),t(215593,5,4,0),
  t(215786,6,4,0),t(215980,5,3,0),t(216173,8,2,0),t(216367,5,3,0),
  t(216561,3,3,0),t(216754,1,3,0),t(216948,5,3,0),t(217141,1,3,0),
  t(217335,3,3,0),t(217528,5,3,0),t(217528,0,3,0),t(217722,7,3,0),
  t(217915,3,3,0),f(218109,7,3),t(218496,3,3,0),t(218689,0,6,0),
  t(218883,2,2,0),t(219270,5,3,0),t(219464,3,4,0),t(219657,7,3,0),
  t(220044,0,3,0),t(220238,3,4,0),f(220431,6,4),t(220818,3,4,0),
  h(221012,2,1,221592,1,[[221012,2,1],[221302,1,3],[221592,0,4]]),t(221980,1,3,0),t(222560,0,4,0),t(222754,1,3,0),
  s(223141,224689,[[223141,2,3],[223334,2,3],[223625,2,2],[224108,2,2],[224689,2,2]],1),t(223721,0,2,0),t(223915,1,3,0),t(224302,1,3,0),
  t(225076,2,3,0),t(225076,7,3,0),t(225270,3,3,0),t(225463,0,3,0),
  t(225850,1,3,0),t(226237,3,3,0),t(226624,5,3,0),t(227011,7,3,0),
  f(227398,5,3),t(227786,7,3,0),t(228173,6,4,0),s(229431,230979,[[229431,1,3],[229624,1,3],[229914,1,3],[230398,1,3],[230882,3,3],[230979,1,3]]),
  t(229818,5,4,0),t(230495,4,3,0),t(231269,1,3,0),t(231850,0,4,0),
  t(232043,3,3,0),t(232140,6,4,0),t(232527,3,4,0),t(233592,3,3,0),
  t(233785,5,4,0),t(234366,7,3,0),t(235237,5,4,0),t(235430,1,4,0),
  f(236108,4,2),t(236495,0,2,0),t(236882,2,2,0),t(236978,5,3,0),
  t(237172,3,4,0),t(237946,6,4,0),t(238333,6,4,0),t(238527,7,3,0),
  t(239011,7,3,0),t(239011,2,3,0),t(239398,7,3,0),t(239494,2,6,0),
  t(239785,5,3,0),t(239881,1,4,0),t(240849,0,4,0),t(241236,5,4,0),
  t(241623,3,3,0),h(241720,6,4,243268,0,[[241720,6,4],[242107,7,3],[242494,7,3],[242881,8,2],[243268,8,1]]),t(242591,6,2,0),f(242785,5,3),
  t(243462,4,2,0),t(243946,1,3,0),t(244236,2,3,0),t(244236,7,3,0),
  t(244526,1,3,0),t(244623,0,2,0),t(244720,1,3,0),t(244913,1,4,0),
  t(245300,3,4,0),t(245688,3,4,0),t(246075,1,4,0),t(246171,5,4,0),
  t(246946,3,4,0),t(247720,6,4,0),f(247816,3,4),t(248204,5,4,0),
  t(248494,6,4,0),t(248784,5,4,0),t(248978,5,4,0),t(249171,6,4,0),
  t(250042,5,4,0),t(250332,3,4,0),t(250526,1,4,0),t(250719,0,4,0),
  t(250913,3,4,0),t(251590,6,4,0),t(251881,6,4,0),t(252074,5,4,0),
  t(252268,6,4,0),t(252461,3,4,0),t(252655,3,4,0),s(252752,254203,[[252752,3,3],[252848,3,3],[253235,3,2],[253332,3,2],[253622,2.5,2],[254106,1,2],[254203,1,2]],1),
  t(255171,1,4,0),t(255558,3,4,0),t(255848,1,4,0),t(255945,0,3,0),
  t(256526,0,4,0),t(256719,0,4,0),t(257783,1,4,0),t(258074,3,4,0),
  t(258558,1,4,0),t(258654,0,4,0),t(258848,0,4,0),t(259041,1,4,0),
  t(259332,0,6,0),f(260299,0,3),
// </eiki-boss-v3-master-notes>
])(mhTap,mhHoldV2,mhFlick,mhSlideV2);
const eikiBossCharts=Object.freeze({
  EASY:mhChart(1,eikiBossEasyNotes,EIKI_BOSS_DURATION_MS),
  NORMAL:mhChart(3,eikiBossNormalNotes,EIKI_BOSS_DURATION_MS),
  HARD:mhChart(5,eikiBossHardNotes,EIKI_BOSS_DURATION_MS),
  EXPERT:mhChart(7,eikiBossExpertNotes,EIKI_BOSS_DURATION_MS),
  MASTER:mhChart(9,eikiBossMasterNotes,EIKI_BOSS_DURATION_MS),
});

// 風がそよぐ場所（全尺1分40秒）。ほかの5曲より易しめの1曲として足した。譜面はV3パイプラインが入れる。
const KAZE_GA_SOYOGU_DURATION_MS=99216;
const kazeGaSoyoguEasyNotes=((t,h,f,s)=>[
// <kaze-ga-soyogu-v3-easy-notes>
  t(2733,0,10,0),t(4751,4,6,0),t(6770,4,6,0),t(7780,4,6,0),
  t(9798,2,6,0),t(10303,7,3,0),t(10303,0,3,0),t(10808,4,6,0),
  t(13836,4,6,0),t(14846,4,6,0),t(16360,2,6,0),t(17874,0,6,0),
  t(18883,0,6,0),t(21912,2,6,1),t(22921,4,6,0),t(24435,2,6,0),
  t(24940,4,6,0),t(26959,4,6,0),t(28473,4,6,0),t(30492,2,6,0),
  t(30996,0,6,0),t(33015,0,6,0),t(35034,0,6,0),t(36548,2,6,0),
  t(37053,2,6,0),t(38819,4,6,0),t(39072,4,6,0),t(41091,4,6,2),
  t(41595,5,4,0),t(42100,2,6,0),t(42605,0,6,0),t(43109,0,6,0),
  t(44623,0,6,0),t(45128,2,6,0),t(46642,0,6,0),t(47652,2,6,0),
  t(48156,4,6,0),t(48661,2,6,0),t(50680,0,6,0),t(51185,0,10,0),
  t(52194,2,6,0),t(52699,4,6,0),t(53204,4,6,0),t(54718,4,6,0),
  t(56232,2,6,0),t(56737,2,6,0),t(58251,2,6,0),t(58755,0,6,0),
  t(59765,0,6,3),h(61279,2,3,62162,0,[[61279,2,3],[61784,1,4],[62162,0,6]]),t(63298,2,6,0),t(64307,0,6,0),
  t(64812,0,3,0),t(64812,7,3,0),t(65317,1,4,0),t(66831,0,4,0),
  t(67840,1,4,0),t(68850,2,6,0),t(70364,0,6,0),t(71373,2,6,0),
  t(72383,0,6,0),t(72887,2,6,0),t(73897,4,6,0),t(75411,4,6,0),
  h(76420,4,6,78061),t(78439,4,6,4),t(79448,4,6,0),t(80963,4,6,0),
  t(81467,4,6,0),t(82981,2,6,0),t(83991,3,4,0),t(86010,0,3,0),
  t(86010,7,3,0),h(87524,2,6,88659,0,[[87524,2,6],[88155,3,4],[88659,4,3]]),t(89038,4,6,0),t(89543,4,6,0),
  t(92066,4,6,0),t(93580,4,6,0),t(94590,0,10,0),t(97113,5,4,0),
// </kaze-ga-soyogu-v3-easy-notes>
])(mhTap,mhHoldV2,mhFlick,mhSlideV2);
const kazeGaSoyoguNormalNotes=((t,h,f,s)=>[
// <kaze-ga-soyogu-v3-normal-notes>
  t(2733,0,10,0),f(4751,0,6),t(5761,0,6,0),t(6770,2,6,0),
  t(8789,0,6,0),t(9798,2,6,0),t(10303,7,3,0),t(10303,0,3,0),
  t(10808,2,6,0),t(13836,4,6,0),t(14846,4,6,0),t(16360,4,6,0),
  t(17874,2,6,0),t(18883,0,6,0),t(20397,0,6,0),t(21912,0,6,1),
  t(22921,4,6,0),f(24435,4,6),t(26454,4,6,0),t(26959,4,6,0),
  t(28473,2,6,0),t(30492,0,6,0),t(30996,0,6,0),t(33015,2,6,0),
  t(35034,4,6,0),t(36043,2,6,0),t(36548,0,6,0),t(37053,2,6,0),
  t(38819,0,6,0),t(39072,2,6,0),t(41091,4,6,2),f(41595,3,4),
  t(42100,4,6,0),t(42605,2,6,0),t(43109,0,6,0),t(44623,0,6,0),
  t(45128,2,6,0),t(45885,0,6,0),t(46642,2,6,0),t(47652,0,6,0),
  t(48156,2,6,0),t(48661,0,6,0),t(49166,2,6,0),t(50680,0,10,0),
  f(52194,4,6),t(52699,4,6,0),t(53204,4,6,0),t(54718,0,6,0),
  t(55727,0,3,0),t(55727,7,3,0),t(56232,4,6,0),t(56737,4,6,0),
  t(58251,4,6,0),t(58755,2,6,0),t(59260,0,6,3),t(59765,0,6,0),
  h(61279,2,2,62162,1,[[61279,2,2],[61784,1,4],[62162,0,6]]),t(63298,2,6,0),t(64307,0,6,0),f(64812,0,4),
  t(65317,0,3,0),t(65317,7,3,0),t(66831,5,4,0),t(67335,3,4,0),
  t(67840,1,4,0),t(68850,0,6,0),t(70364,0,6,0),t(71373,0,6,0),
  t(72383,0,6,0),t(72887,0,6,0),t(73897,2,6,0),t(75411,4,6,0),
  h(76420,4,6,78061,0,[[76420,4,6],[76925,5,4],[77556,6,3],[78061,6,2]]),t(78439,2,6,4),f(79448,2,6),t(80458,4,6,0),
  t(80963,4,6,0),t(81467,4,6,0),t(82981,2,6,0),t(83991,7,3,0),
  t(83991,0,3,0),t(85505,4,6,0),t(86010,3,4,0),h(87524,2,2,88659,0,[[87524,2,2],[88155,0,6],[88659,2,2]]),
  t(89038,0,6,0),t(91562,0,6,0),t(92066,0,6,0),t(94590,2,6,0),
  t(95599,0,10,0),f(97113,6,4),
// </kaze-ga-soyogu-v3-normal-notes>
])(mhTap,mhHoldV2,mhFlick,mhSlideV2);
const kazeGaSoyoguHardNotes=((t,h,f,s)=>[
// <kaze-ga-soyogu-v3-hard-notes>
  t(2733,2,8,0),f(4247,3,4),t(4751,4,5,0),t(5761,2,5,0),
  t(6770,4,5,0),t(7780,2,5,0),t(8284,5,4,0),t(8789,2,5,0),
  t(9798,4,5,0),t(10303,0,4,0),t(10303,7,3,0),t(10808,4,5,0),
  t(11817,5,5,0),t(12322,5,4,0),t(13836,2,5,0),t(14846,5,5,0),
  t(16360,4,5,0),t(17874,0,5,0),f(18883,4,5),t(19893,2,5,0),
  t(20397,5,5,0),t(20902,4,5,0),t(21912,5,5,1),t(22921,2,5,0),
  t(24435,0,5,0),t(24940,2,5,0),t(26454,4,5,0),t(26959,2,5,0),
  t(28473,0,5,0),t(28977,0,5,0),t(29987,2,5,0),t(30492,4,5,0),
  t(30996,5,5,0),f(33015,0,5),t(34025,2,5,0),t(35034,4,5,0),
  t(36043,5,5,0),t(36548,4,5,0),t(37053,2,5,0),t(37810,2,5,0),
  t(38819,4,5,0),t(39072,2,5,0),t(39324,0,5,0),t(39829,1,8,0),
  t(41091,5,5,2),t(41595,5,4,0),t(42100,2,5,0),t(42605,0,5,0),
  f(43109,0,5),t(43614,0,5,0),t(44119,0,5,0),t(44623,0,5,0),
  t(45128,0,5,0),t(45633,1,3,0),t(45885,2,5,0),t(46642,0,5,0),
  t(47147,0,4,0),t(47147,7,3,0),t(47652,0,5,0),t(48156,2,5,0),
  t(48661,0,5,0),t(49166,0,5,0),t(50680,0,5,0),t(51185,0,5,0),
  f(51689,0,4),t(52194,0,5,0),t(52699,0,5,0),t(53204,0,5,0),
  t(54213,0,5,0),t(54718,0,5,0),t(55222,3,4,0),t(55727,6,4,0),
  t(56232,2,5,0),t(56737,5,5,0),t(57241,2,5,0),t(58251,5,5,0),
  t(58755,2,5,0),t(59260,5,5,3),t(59765,0,5,0),t(60269,2,5,0),
  f(60774,5,4),s(61279,62162,[[61279,3,3],[61531,3,3],[61784,4,3],[62036,4,3],[62162,4,3]],1),t(62793,0,5,0),t(63298,2,5,0),
  t(64307,2,8,0),t(64812,6,4,0),t(64812,0,3,0),t(65317,5,4,0),
  t(65821,3,4,0),t(66831,5,4,0),t(67335,3,4,0),t(67840,1,4,0),
  t(68597,0,3,0),t(68850,0,5,0),t(69859,2,5,0),t(70364,0,5,0),
  f(70868,1,3),t(71373,2,5,0),t(72383,4,5,0),t(72887,5,5,0),
  t(73897,4,5,0),t(74401,4,5,0),t(75411,5,5,0),t(75916,0,4,0),
  t(75916,7,3,0),s(76420,78061,[[76420,3,3],[76673,4,3],[76925,4,3],[77177,4,3],[77430,4,3],[77682,4,3],[77934,4,3],[78061,4,3]]),t(78439,5,5,4),t(79448,4,5,0),
  t(80458,2,5,0),t(80963,0,5,0),t(81467,0,5,0),t(82477,0,5,0),
  f(82981,2,5),t(83991,5,4,0),t(84496,4,5,0),t(85000,3,3,0),
  t(85505,0,5,0),t(86010,0,4,0),t(86010,7,3,0),s(87524,88659,[[87524,1,3],[87776,0,3],[88029,0,3],[88281,0,3],[88533,0,3],[88659,0,3]]),
  t(89038,2,5,0),t(89543,4,5,0),t(91562,2,5,0),t(92066,4,5,0),
  t(92571,2,5,0),t(93580,0,5,0),t(94590,2,5,0),t(95599,2,8,0),
  f(97113,3,4),
// </kaze-ga-soyogu-v3-hard-notes>
])(mhTap,mhHoldV2,mhFlick,mhSlideV2);
const kazeGaSoyoguExpertNotes=((t,h,f,s)=>[
// <kaze-ga-soyogu-v3-expert-notes>
  t(2733,0,8,0),f(3742,4,5),t(4247,0,4,0),t(4247,7,3,0),
  t(4751,0,2,0),t(4751,4,2,0),t(5761,2,2,0),t(5761,6,2,0),
  t(6770,4,2,0),t(6770,8,2,0),t(7275,0,5,0),t(7780,4,5,0),
  t(8284,1,4,0),t(8789,5,5,0),t(9798,1,2,0),t(9798,5,2,0),
  t(10303,3,2,0),t(10303,7,2,0),t(10808,1,2,0),t(10808,5,2,0),
  t(11817,5,5,0),t(12322,1,4,0),t(12827,5,5,0),t(13836,4,5,0),
  f(14846,5,5),t(15855,4,5,0),t(16360,5,5,0),t(16864,4,5,0),
  t(17874,5,5,0),t(18883,4,5,0),t(19893,5,5,0),t(20397,4,5,0),
  t(20902,4,5,1),t(21912,2,5,0),t(22921,0,5,0),t(23930,2,5,0),
  t(24435,0,5,0),t(24940,2,5,0),t(25445,0,5,0),f(26454,2,5),
  t(26959,0,5,0),t(28473,2,5,0),t(28977,4,5,0),t(29987,2,5,0),
  t(30492,0,5,0),t(30996,2,5,0),t(32006,4,5,0),t(33015,0,5,0),
  t(34025,2,5,0),t(35034,4,5,0),t(35286,6,4,0),t(36043,4,5,0),
  t(36548,2,5,0),t(36800,0,5,0),f(37053,2,5),t(37810,0,5,0),
  t(38819,2,5,0),t(39072,0,5,0),t(39324,2,5,0),t(39829,0,8,0),
  t(41091,0,5,2),t(41595,0,4,0),t(41595,7,3,0),t(41848,0,5,0),
  t(42100,0,5,0),t(42352,3,3,0),t(42605,2,5,0),t(43109,4,5,0),
  t(43614,4,5,0),t(44119,2,5,0),f(44623,2,5),t(45128,0,5,0),
  t(45381,0,5,0),t(45633,0,3,0),t(45633,6,3,0),t(45885,0,5,0),
  t(46642,2,5,0),t(47147,5,4,0),t(47399,3,3,0),t(47652,0,5,0),
  t(48156,2,5,0),t(48661,4,5,0),t(49166,2,5,0),t(50175,0,5,0),
  t(50680,2,5,0),t(51185,4,5,0),f(51689,6,4),t(52194,4,5,0),
  t(52446,2,5,0),t(52699,0,5,0),t(53204,2,5,0),t(53708,5,4,0),
  t(54213,2,5,0),t(54718,0,5,0),t(55222,3,4,0),t(55727,6,4,0),
  t(55727,0,3,0),t(56232,2,5,0),t(56737,0,5,0),t(57241,5,5,0),
  t(57746,4,5,0),t(58251,2,5,3),f(58755,0,5),t(59260,0,5,0),
  t(59765,0,5,0),t(60269,2,5,0),t(60522,4,5,0),t(60774,3,4,0),
  s(61279,62162,[[61279,3,3],[61531,3,3],[61784,4,3],[62036,4,3],[62162,4,3]]),t(62288,5,5,0),t(62793,4,5,0),t(63298,0,5,0),
  t(63802,1,3,0),t(64307,1,8,0),t(64812,5,4,0),t(65317,6,4,0),
  f(65821,5,4),t(66831,6,4,0),t(67083,5,4,0),t(67335,6,4,0),
  t(67840,5,4,0),t(68597,3,3,0),t(68850,4,5,0),t(69354,1,4,0),
  t(69859,2,5,0),t(70364,4,5,0),t(70868,7,3,0),t(70868,1,3,0),
  t(71373,4,5,0),t(71625,2,5,0),t(72383,0,5,0),t(72887,0,5,0),
  t(73392,0,5,0),f(73897,2,5),t(74401,0,5,0),t(75411,0,5,0),
  t(75916,0,4,0),s(76420,78061,[[76420,0.5,3],[76799,3.5,3],[77177,3.5,3],[77556,1.5,3],[77934,1.5,3],[78061,1.5,3]]),t(76925,4,4,4),t(77430,1,5,0),
  t(78439,4,5,0),t(78944,2,5,0),t(79448,0,5,0),t(80458,2,5,0),
  t(80963,0,5,0),t(81467,0,5,0),t(82477,0,5,0),f(82981,0,5),
  h(83486,3,4,84117),t(84496,0,5,0),t(85000,0,3,0),t(85505,2,5,0),
  t(86010,0,4,0),t(86010,7,3,0),t(86514,4,5,0),s(87524,88659,[[87524,2,3],[87776,0,3],[88029,0,3],[88281,0,3],[88533,0,3],[88659,0,3]]),
  t(89038,2,5,0),t(89543,5,5,0),t(91562,0,5,0),t(92066,5,5,0),
  t(92571,0,5,0),t(93076,5,5,0),t(93580,0,5,0),t(94590,5,5,0),
  f(95094,1,4),t(95599,2,8,0),
// </kaze-ga-soyogu-v3-expert-notes>
])(mhTap,mhHoldV2,mhFlick,mhSlideV2);
const kazeGaSoyoguMasterNotes=((t,h,f,s)=>[
// <kaze-ga-soyogu-v3-master-notes>
  t(2733,0,6,0),f(3742,3,4),t(4247,5,3,0),t(4247,0,3,0),
  t(4751,6,4,0),t(5256,5,3,0),t(5761,3,4,0),t(6770,0,2,0),
  t(6770,4,2,0),t(7275,4,2,0),t(7275,8,2,0),t(7780,0,2,0),
  t(7780,4,2,0),t(8284,4,2,0),t(8284,8,2,0),t(8789,1,4,0),
  t(9798,3,4,0),t(10303,3,3,0),t(10808,5,4,0),t(11060,4,2,0),
  f(11817,1,4),t(12322,3,3,0),t(12827,0,2,0),t(12827,4,2,0),
  t(13836,1,2,0),t(13836,5,2,0),t(14846,3,2,0),t(14846,7,2,0),
  t(15855,4,2,0),t(15855,8,2,0),t(16360,5,4,0),t(16864,6,4,0),
  t(17874,5,4,0),t(18883,0,4,0),t(19893,5,4,0),t(20397,1,4,0),
  t(20397,7,3,0),t(20902,6,4,1),f(21407,3,4),t(21912,0,4,0),
  t(22921,5,4,0),t(23930,2,2,0),t(23930,6,2,0),t(24435,2,2,0),
  t(24435,7,2,0),t(24940,1,2,0),t(24940,8,2,0),t(25445,0,2,0),
  t(25445,8,2,0),t(26454,3,4,0),t(26959,1,4,0),t(27968,3,4,0),
  t(28473,5,4,0),t(28977,6,4,0),t(28977,1,3,0),f(29987,5,4),
  t(30492,3,4,0),t(30996,3,4,0),t(32006,5,4,0),t(32510,4,2,0),
  t(33015,1,4,0),t(34025,3,4,0),t(35034,5,4,0),t(36043,6,4,0),
  t(36548,5,4,0),t(36800,6,4,0),t(37053,5,4,0),t(37810,3,4,0),
  f(38062,5,4),t(38819,0,4,0),t(39072,3,4,0),t(39324,1,4,0),
  t(39829,4,6,0),t(40081,3,4,0),t(41091,6,4,2),t(41595,7,3,0),
  t(41595,2,3,0),t(41848,5,4,0),t(42100,3,4,0),t(42352,2,2,0),
  t(42605,0,4,0),t(43109,1,4,0),f(43614,0,4),t(44119,1,4,0),
  t(44623,3,4,0),t(44876,6,2,0),t(45128,6,4,0),t(45381,5,4,0),
  t(45633,2,2,0),t(45885,3,4,0),t(46642,5,4,0),t(47147,7,3,0),
  t(47399,6,2,0),t(47652,3,4,0),t(48156,5,4,0),f(48661,6,4),
  t(49166,5,4,0),t(49166,0,3,0),t(49671,3,3,0),t(50175,5,4,0),
  t(50680,6,4,0),t(51185,3,4,0),t(51689,5,3,0),t(52194,3,4,0),
  t(52446,5,4,0),t(52699,6,4,0),t(53204,5,4,0),t(53708,5,3,0),
  f(54213,3,4),t(54718,1,4,0),t(55222,0,3,0),t(55727,1,3,0),
  t(55979,4,2,0),t(56232,1,4,0),t(56737,0,4,0),t(57241,1,4,0),
  t(57746,1,4,0),t(57746,7,3,0),t(58251,1,4,3),t(58755,0,4,0),
  t(59008,3,3,0),t(59260,1,4,0),f(59765,3,4),t(60269,1,4,0),
  t(60522,0,4,0),t(60774,1,3,0),s(61279,62162,[[61279,2,2],[61531,2,2],[61784,4,2],[62036,4,2],[62162,4,2]]),t(62288,1,4,0),
  t(62793,3,4,0),t(63298,1,4,0),t(63802,0,2,0),t(64307,0,6,0),
  t(64812,0,3,0),t(65317,1,3,0),f(65821,3,3),t(66578,5,4,0),
  t(66831,2,3,0),t(66831,7,3,0),t(67083,1,3,0),t(67335,3,3,0),
  t(67840,1,3,0),t(68092,3,3,0),t(68597,2,2,0),t(68850,0,4,0),
  t(69354,1,3,0),t(69859,0,4,0),t(70364,1,4,0),t(70868,4,2,0),
  t(71373,5,4,0),f(71625,6,4),t(72383,5,4,0),t(72887,3,4,0),
  t(73392,5,4,0),t(73897,3,4,0),t(74401,5,4,0),t(74906,7,3,0),
  t(75411,5,4,0),t(75411,0,3,0),t(75916,5,3,0),s(76420,78061,[[76420,3,2],[76673,4,2],[76925,4,2],[77177,4,2],[77430,4,2],[77682,3.5,2],[77934,3.5,2],[78061,4,2]]),
  t(76925,6,3,4),t(77430,5,4,0),t(78187,7,3,0),f(78439,5,4),
  t(78944,3,4,0),t(79448,5,4,0),t(80458,0,4,0),t(80963,3,4,0),
  t(81467,6,4,0),t(82477,3,4,0),t(82981,0,4,0),h(83486,3,3,84117),
  t(84496,6,4,0),t(85000,4,2,0),t(85505,0,4,0),f(86010,3,3),
  t(86514,6,4,0),t(86514,1,3,0),s(87524,88659,[[87524,4,2],[87902,0.5,2],[88281,0.5,2],[88659,0.5,2]]),t(88029,2,4,0),
  t(89038,3,4,0),t(89543,5,4,0),t(91057,7,3,0),t(91562,6,4,0),
  t(92066,6,4,0),t(92571,6,4,0),t(93076,6,4,0),t(93580,6,4,0),
  t(94590,6,4,0),f(95094,7,3),t(95599,4,6,0),
// </kaze-ga-soyogu-v3-master-notes>
])(mhTap,mhHoldV2,mhFlick,mhSlideV2);
// Close To Your Heart（全尺2分00秒）。譜面はV3パイプラインが入れる。
const CLOSE_TO_YOUR_HEART_DURATION_MS=120204;
const closeToYourHeartEasyNotes=((t,h,f,s)=>[
// <close-to-your-heart-v3-easy-notes>
  h(2879,2,3,3687,0,[[2879,2,3],[3340,1,4],[3687,0,6]]),t(3802,0,10,0),h(4264,1,4,5880),t(6803,0,4,0),
  t(8880,3,4,0),t(9342,5,4,0),h(10265,2,6,10958,0,[[10265,2,6],[10612,3,4],[10958,4,3]]),t(13035,5,4,0),
  t(15113,1,4,0),t(15805,3,4,0),t(16728,4,6,0),t(17652,4,6,0),
  t(18113,4,6,0),t(19037,2,6,0),t(19498,0,6,0),t(20883,0,6,0),
  t(21345,0,6,0),t(22730,0,6,0),t(23192,0,6,0),t(24115,2,6,0),
  t(24577,7,3,0),t(24577,0,3,0),t(25038,4,6,0),t(25500,5,4,0),
  t(25962,2,6,1),t(26423,0,6,0),t(27347,4,6,0),t(27808,4,6,0),
  t(28270,2,6,0),t(28731,0,6,0),t(29655,0,6,0),t(30116,0,6,0),
  t(30578,2,6,0),t(31040,4,6,0),t(31963,2,6,0),t(32425,4,6,0),
  t(32886,2,6,0),t(33810,4,6,0),t(34271,2,6,0),t(34733,4,6,0),
  t(35195,2,6,0),t(35656,5,4,0),t(36118,0,6,0),t(37041,0,6,0),
  t(37503,2,6,0),t(37965,4,6,0),t(38426,4,6,0),t(39811,0,6,0),
  t(40273,0,6,0),t(40735,2,6,0),t(41196,0,10,0),t(41658,4,6,0),
  t(42119,4,6,0),t(42581,2,6,0),t(43043,0,3,0),t(43043,7,3,0),
  t(43504,4,6,0),t(43966,4,6,0),t(44889,2,6,0),t(45351,0,6,0),
  t(45813,0,6,0),t(47198,0,4,0),t(47659,0,6,0),t(48121,2,6,0),
  t(48583,0,6,0),t(49044,0,6,2),t(50429,0,6,0),t(50891,0,6,0),
  t(51814,0,4,0),t(52276,0,6,0),t(52738,2,6,0),t(53661,0,6,0),
  t(55046,2,6,0),t(55507,4,6,0),t(55969,2,6,0),t(57354,0,6,0),
  t(57816,2,6,0),t(58739,4,6,0),t(59201,4,6,0),t(59662,4,6,0),
  t(60124,3,4,0),t(60586,0,6,0),t(61509,0,6,0),t(61971,2,6,0),
  t(62894,0,6,0),t(63356,2,6,0),t(63817,0,6,0),t(64048,0,6,0),
  t(65202,0,6,0),t(65664,0,6,0),t(66126,2,6,0),t(67049,0,10,0),
  t(67511,4,6,0),t(67972,7,3,0),t(67972,0,3,0),t(68895,2,6,0),
  t(69357,0,6,0),t(69819,4,6,0),t(70280,4,6,0),t(70742,2,6,0),
  t(71204,0,6,0),t(71665,0,6,0),t(72127,0,6,0),t(72589,2,6,3),
  t(73050,4,6,0),t(73512,2,6,0),t(73974,4,6,0),t(74435,4,6,0),
  t(74897,4,6,0),t(76744,4,6,0),t(77205,4,6,0),t(78129,2,6,0),
  t(78590,1,4,0),t(79052,2,6,0),t(79514,5,4,0),t(79975,4,6,0),
  t(81360,4,6,0),t(81822,4,6,0),h(82283,6,3,83091,0,[[82283,6,3],[82745,4,6],[83091,6,3]]),h(83668,6,4,84592),
  h(85053,4,6,86554),t(87362,2,6,0),t(87823,5,4,0),t(88285,3,4,0),
  t(89208,5,4,0),t(89670,4,6,0),t(90132,4,6,0),t(91055,4,6,0),
  t(91517,4,6,0),t(92902,3,4,0),t(93363,2,6,0),t(93825,5,4,0),
  t(94748,0,10,4),t(95671,7,3,0),t(95671,0,3,0),t(96364,6,4,0),
  t(96595,4,6,0),t(97287,6,4,0),t(97518,6,4,0),t(98211,6,4,0),
  t(98441,4,6,0),t(98903,6,4,0),t(99365,4,6,0),t(99826,5,4,0),
  t(100288,4,6,0),t(100750,5,4,0),t(101211,0,6,0),t(101673,0,6,0),
  t(102135,0,6,0),t(102596,0,4,0),t(102827,0,4,0),t(103289,0,6,0),
  t(103981,0,6,0),t(104212,0,6,0),t(104905,3,4,0),t(105366,1,4,0),
  h(106290,0,6,106982),h(107213,0,6,108252),t(108598,0,6,0),t(109059,0,4,0),
  t(109290,0,4,0),t(109752,0,6,0),t(110444,3,4,0),h(110906,1,4,111599),
  t(111829,0,4,0),t(113214,0,4,0),t(113676,0,4,0),h(114138,0,6,114946),
  t(115061,0,4,0),t(115523,0,4,0),t(115984,0,6,0),h(116908,0,6,117716,0,[[116908,0,6],[117369,2,3],[117716,0,6]]),
  t(117831,0,10,0),t(118754,0,3,0),t(118754,7,3,0),
// </close-to-your-heart-v3-easy-notes>
])(mhTap,mhHoldV2,mhFlick,mhSlideV2);
const closeToYourHeartNormalNotes=((t,h,f,s)=>[
// <close-to-your-heart-v3-normal-notes>
  h(2879,6,2,3687,0,[[2879,6,2],[3340,5,4],[3687,4,6]]),t(3802,0,10,0),h(4264,5,3,5880,1),f(6803,3,3),
  t(7265,7,3,0),t(8880,3,4,0),t(9342,5,3,0),h(10265,2,6,10958,0,[[10265,2,6],[10612,3,4],[10958,4,2]]),
  t(12343,5,4,0),t(13035,1,3,0),t(15113,0,4,0),h(15805,1,4,16267),
  t(16728,0,6,0),t(17190,0,6,0),t(17652,0,6,0),t(18113,0,6,0),
  t(19037,0,6,0),t(19498,0,6,0),t(20883,2,6,0),t(21345,2,6,0),
  t(22730,0,6,0),t(23192,2,6,0),t(24115,4,6,0),f(24577,3,4),
  t(25038,0,6,1),t(25500,7,3,0),t(25500,0,3,0),t(25962,2,6,0),
  t(26192,4,6,0),t(26423,2,6,0),t(27347,4,6,0),t(27808,4,6,0),
  t(28270,4,6,0),t(28731,4,6,0),t(29193,2,6,0),t(29655,4,6,0),
  t(30116,0,6,0),t(30578,0,6,0),t(31040,0,6,0),t(31501,2,6,0),
  t(31963,4,6,0),t(32425,4,6,0),t(32886,4,6,0),f(33810,2,6),
  t(34271,4,6,0),t(34733,4,6,0),t(35195,4,6,0),t(35656,0,3,0),
  t(35656,7,3,0),t(36118,0,6,0),t(36580,3,4,0),t(37041,4,6,0),
  t(37503,2,6,0),t(37965,0,6,0),t(38426,2,6,0),t(39811,4,6,0),
  t(40042,4,6,0),t(40273,4,6,0),t(40735,4,6,0),t(41196,0,10,0),
  t(41658,4,6,0),t(42119,2,6,0),t(42581,4,6,0),f(43043,5,4),
  t(43504,0,6,0),t(43966,2,6,0),t(44659,0,6,0),t(44889,0,6,0),
  t(45351,2,6,0),t(45813,4,6,0),t(47198,3,4,0),t(47659,4,6,0),
  t(48121,2,6,0),t(48583,4,6,0),t(49044,2,6,2),t(49506,4,6,0),
  t(50429,2,6,0),t(50891,4,6,0),t(51814,0,3,0),t(51814,7,3,0),
  t(52276,4,6,0),t(52738,2,6,0),t(53199,1,4,0),f(53661,2,6),
  t(55046,0,6,0),t(55507,2,6,0),t(55969,4,6,0),t(56892,2,6,0),
  t(57354,0,6,0),t(57816,2,6,0),t(58739,4,6,0),t(59201,4,6,0),
  t(59662,0,6,0),t(60124,5,4,0),t(60586,2,6,0),t(61509,4,6,0),
  t(61971,4,6,0),t(62201,2,6,0),t(62894,4,6,0),t(63356,2,6,0),
  t(63817,0,6,0),t(64048,0,6,0),f(64279,0,6),t(65202,0,6,0),
  t(65664,0,6,0),t(66126,0,6,0),t(66587,0,10,0),t(67049,4,6,0),
  t(67511,4,6,0),t(67972,7,3,0),t(67972,0,3,0),t(68434,5,4,0),
  t(68895,4,6,0),t(69357,4,6,0),t(69819,2,6,0),t(70280,4,6,0),
  t(70742,2,6,0),t(71204,0,6,0),t(71665,2,6,0),t(72127,4,6,0),
  t(72589,2,6,3),t(73050,0,6,0),f(73512,0,6),t(73974,0,6,0),
  t(74205,0,6,0),t(74435,2,6,0),t(74897,0,6,0),t(75359,0,6,0),
  t(76744,2,6,0),t(77205,0,6,0),t(77667,3,4,0),t(78129,4,6,0),
  t(79052,2,6,0),t(79514,0,3,0),t(79514,7,3,0),t(79975,2,6,0),
  t(81360,4,6,0),t(81822,4,6,0),h(82283,6,2,83091,0,[[82283,6,2],[82745,4,6],[83091,6,2]]),h(83668,5,4,84592),
  h(85053,2,6,86554,1),t(87362,0,6,0),t(87823,1,4,0),f(88285,0,4),
  t(89208,1,4,0),t(89670,2,6,0),t(90132,0,6,0),t(91055,4,6,0),
  t(91517,4,6,0),t(91978,6,4,0),t(92902,6,4,0),t(93363,4,6,0),
  t(93825,6,4,0),t(94748,0,10,0),t(94979,6,2,0),t(95671,6,4,4),
  t(96364,5,4,0),t(96595,4,6,0),t(97287,5,4,0),t(97518,3,4,0),
  t(97749,2,2,0),t(98211,0,3,0),f(98441,0,6),t(98903,0,4,0),
  t(99365,0,6,0),t(99826,0,4,0),t(100288,0,6,0),t(100750,0,4,0),
  t(100981,1,3,0),t(101211,0,6,0),t(101673,0,6,0),t(102135,0,6,0),
  t(102365,0,3,0),t(102596,0,4,0),t(103289,0,6,0),t(103981,2,6,0),
  t(104212,4,6,0),t(104905,6,4,0),t(105135,4,6,0),f(105366,6,4),
  h(106290,4,6,106982),h(107213,4,6,108252),t(108367,1,3,0),t(108598,2,6,0),
  t(109059,5,4,0),t(109290,6,4,0),t(109521,4,6,0),t(110444,6,4,0),
  h(110906,6,4,111599),t(111829,6,4,0),t(112753,5,4,0),t(113214,3,4,0),
  t(113676,1,4,0),h(114138,0,6,114946),t(115061,1,4,0),t(115523,0,3,0),
  t(115523,7,3,0),t(115984,0,6,0),t(116677,0,6,0),h(116908,0,6,117716,0,[[116908,0,6],[117369,2,2],[117716,0,6]]),
  t(117831,0,10,0),f(118754,1,4),
// </close-to-your-heart-v3-normal-notes>
])(mhTap,mhHoldV2,mhFlick,mhSlideV2);
const closeToYourHeartHardNotes=((t,h,f,s)=>[
// <close-to-your-heart-v3-hard-notes>
  h(2879,2,1,3687,0,[[2879,2,1],[3340,1,3],[3687,0,5]]),t(3802,0,8,0),h(4264,1,3,5880,1),f(6341,0,4),
  t(6803,0,3,0),t(7265,1,3,0),s(7957,9804,[[7957,1,3],[8303,1,3],[8649,1,3],[8996,1,3],[9342,1,3],[9688,1,3],[9804,3,3]]),s(10265,10958,[[10265,2,3],[10496,2,3],[10727,3,3],[10958,4,3]]),
  t(12343,5,4,0),s(12804,14651,[[12804,3,3],[13151,4,3],[13497,4,3],[13843,4,3],[14189,4,3],[14536,4,3],[14651,4,3]]),t(15113,1,4,0),h(15805,3,4,16267,1),
  t(16728,4,5,0),t(16959,5,5,0),t(17190,4,5,0),t(17652,2,5,0),
  t(18113,2,5,0),t(18575,4,5,0),h(19037,2,5,19729,1),h(20422,4,5,21691),
  t(21807,3,4,0),h(22268,4,5,23076,0,[[22268,4,5],[22730,5,3],[23076,6,1]]),t(23192,2,5,0),t(23653,4,5,0),
  f(24115,5,5),t(24577,6,4,0),t(24577,0,3,0),t(24807,1,3,0),
  t(25038,2,5,0),t(25500,5,4,0),t(25731,5,5,0),t(25962,4,5,0),
  t(26192,2,5,0),t(26423,0,5,0),t(26885,2,5,1),t(27347,0,5,0),
  t(27577,4,5,0),t(27808,2,5,0),t(28270,5,5,0),t(28731,2,5,0),
  t(29193,4,5,0),t(29424,2,5,0),t(29655,0,5,0),t(29886,2,5,0),
  t(30116,4,5,0),t(30578,2,5,0),t(30809,0,5,0),f(31040,2,5),
  t(31501,4,5,0),t(31963,2,5,0),t(32425,0,5,0),t(32886,0,5,0),
  t(33117,0,5,0),t(33348,2,5,0),t(33810,4,5,0),t(34271,2,5,0),
  t(34733,0,5,0),t(34964,2,5,0),t(35195,2,5,0),t(35425,4,5,0),
  t(35656,6,4,0),t(35656,0,3,0),t(36118,5,5,0),t(36349,5,5,0),
  t(36580,5,4,0),t(36810,2,5,0),t(37041,0,5,0),f(37503,0,5),
  t(37965,0,5,0),t(38195,2,5,0),t(38426,0,5,0),t(38657,2,5,0),
  t(39811,0,5,0),t(40042,4,5,0),t(40273,2,5,0),t(40619,5,5,0),
  t(40735,2,5,0),t(40965,4,5,0),t(41196,2,8,0),t(41658,4,5,0),
  t(41889,0,5,0),t(42119,2,5,0),t(42581,4,5,0),t(43043,6,4,0),
  t(43504,4,5,0),t(43851,0,5,0),t(43966,2,5,0),t(44197,0,5,0),
  t(44659,4,5,0),f(44889,2,5),t(45351,0,5,0),t(45813,0,5,0),
  t(46044,0,5,0),t(46274,0,4,0),t(46274,7,3,0),t(46967,3,3,0),
  t(47198,1,4,0),t(47659,2,5,0),t(48121,4,5,0),t(48352,2,5,0),
  t(48583,0,5,0),t(49044,4,5,2),t(49506,2,5,0),t(49968,1,4,0),
  t(50429,0,5,0),t(50660,2,5,0),t(50891,0,5,0),t(51583,0,5,0),
  t(51814,1,4,0),t(52276,0,5,0),f(52738,0,5),t(53199,3,4,0),
  t(53661,4,5,0),t(54353,5,5,0),t(54815,8,1,0),t(55046,5,5,0),
  t(55507,5,5,0),t(55854,4,5,0),t(55969,5,5,0),t(56892,4,5,0),
  t(57354,5,5,0),t(57816,4,5,0),t(58277,5,4,0),t(58739,5,5,0),
  t(58970,5,5,0),t(59201,4,5,0),t(59662,2,5,0),t(60124,1,4,0),
  t(60355,2,5,0),t(60586,0,5,0),h(60817,2,1,62201,0,[[60817,2,1],[61278,1,4],[61740,1,4],[62201,2,1]]),t(62432,0,4,0),
  t(62432,7,3,0),t(62663,2,5,0),f(62894,0,5),t(63356,0,5,0),
  t(63586,0,5,0),t(63817,2,5,0),t(64048,2,5,0),t(64279,2,5,0),
  t(64741,5,4,0),t(65202,4,5,0),t(65664,5,5,0),t(66126,5,5,0),
  t(66587,0,8,0),t(67049,2,5,0),t(67280,4,5,0),t(67511,5,5,0),
  t(67741,4,5,0),t(67972,3,4,0),t(68203,0,5,0),f(68434,3,4),
  t(68895,5,5,0),t(69126,2,5,0),t(69357,0,5,0),t(69588,2,5,0),
  t(69819,0,5,0),t(70050,0,5,0),t(70280,0,5,0),t(70742,2,5,0),
  t(71204,0,5,0),t(71435,0,5,0),t(71665,0,5,0),t(72127,2,5,3),
  h(72589,0,5,73281),t(73512,4,5,0),t(73743,2,5,0),t(73974,5,5,0),
  t(74205,5,5,0),t(74435,4,5,0),t(74666,5,5,0),t(74897,4,5,0),
  t(75128,2,5,0),f(75359,4,5),t(76282,0,4,0),t(76282,7,3,0),
  t(76744,5,5,0),t(77205,2,5,0),t(77667,6,4,0),t(78129,2,5,0),
  t(78359,5,5,0),t(78590,6,4,0),t(79052,4,5,0),t(79514,3,4,0),
  t(79975,0,5,0),t(80899,0,5,0),t(81360,0,5,0),t(81822,4,5,0),
  s(82283,83091,[[82283,2,3],[82514,1.5,3],[82745,1,3],[82976,0,3],[83091,0,3]]),t(83207,1,4,0),t(83668,0,4,0),s(83899,84592,[[83899,1,3],[84130,1,3],[84361,3,3],[84592,3,3]]),
  t(84823,2,5,0),s(85053,86554,[[85053,3,3],[85284,2.5,3],[85515,1.5,3],[85746,1.5,3],[85977,1.5,3],[86208,1.5,3],[86438,1.5,3],[86554,3.5,3]],1),t(87362,2,5,0),t(87593,4,5,0),
  f(87823,3,4),t(88285,5,4,0),s(88747,89785,[[88747,3,3],[88977,3,3],[89208,3,3],[89439,3,3],[89670,4,3],[89785,4,3]]),t(90132,4,5,0),
  t(90362,2,5,0),t(90593,0,4,0),t(90593,7,3,0),t(91055,0,5,0),
  t(91517,0,5,0),t(91978,1,4,0),t(92902,0,4,0),t(93363,0,5,4),
  t(93825,0,4,0),t(93940,0,4,0),t(94287,1,4,0),t(94748,2,8,0),
  t(94979,2,1,0),t(95556,4,5,0),t(95671,1,4,0),t(95902,4,1,0),
  t(96364,5,4,0),f(96595,5,5),t(97287,6,4,0),t(97403,4,5,0),
  t(97749,4,1,0),t(97864,5,4,0),t(98211,1,3,0),t(98441,2,5,0),
  t(98672,4,5,0),t(98903,6,4,0),t(99134,3,4,0),t(99365,4,5,0),
  t(99826,6,4,0),t(100288,4,5,0),t(100519,7,3,0),t(100750,6,4,0),
  t(100981,7,3,0),t(101211,5,5,0),t(101442,0,4,0),t(101442,7,3,0),
  f(101673,4,5),h(102135,5,5,102712),t(102827,5,3,0),t(103289,2,5,0),
  t(103750,1,4,0),t(103866,0,3,0),t(104212,0,5,0),t(104328,0,4,0),
  t(104674,3,4,0),t(104905,0,4,0),t(105135,2,5,0),t(105366,5,4,0),
  t(105828,3,4,0),t(106059,2,1,0),h(106290,2,5,106982,0,[[106290,2,5],[106636,4,1],[106982,2,5]]),h(107213,4,5,108252),
  t(108367,5,3,0),t(108598,5,5,0),t(108944,5,4,0),t(109059,6,4,0),
  t(109290,5,4,0),t(109521,2,5,0),f(109752,0,5),t(110214,0,4,0),
  t(110444,0,4,0),s(110675,111599,[[110675,1,3],[110906,1,3],[111137,3,3],[111368,3,3],[111599,3,3]]),t(111829,5,4,0),t(112291,3,4,0),
  h(112522,0,5,113099),t(113214,0,4,0),t(113445,0,5,0),t(113676,1,4,0),
  t(113907,2,5,0),h(114138,4,5,114946),t(115061,1,4,0),t(115523,6,4,0),
  t(115523,0,3,0),t(115753,3,3,0),t(115869,5,5,0),t(116677,5,5,0),
  h(116908,4,5,117716),t(117831,2,8,0),t(118293,5,4,0),f(118754,3,4),
// </close-to-your-heart-v3-hard-notes>
])(mhTap,mhHoldV2,mhFlick,mhSlideV2);
const closeToYourHeartExpertNotes=((t,h,f,s)=>[
// <close-to-your-heart-v3-expert-notes>
  h(2879,2,1,3687,0,[[2879,2,1],[3340,1,3],[3687,0,5]]),t(3802,0,8,0),h(4264,3,3,5880,1),t(4956,6,4,0),
  t(5187,5,4,0),f(5418,5,3),t(6341,0,2,0),t(6341,4,2,0),
  t(6803,2,2,0),t(6803,6,2,0),t(7265,4,2,0),t(7265,8,2,0),
  s(7957,9804,[[7957,2,3],[8303,2,3],[8649,2,3],[8996,2,3],[9342,2,3],[9688,2.5,3],[9804,4,3]],1),t(8880,0,4,0),t(9342,2,3,0),s(10265,10958,[[10265,0,3],[10612,1.5,3],[10958,4,3]]),
  t(12343,3,4,0),s(12804,14651,[[12804,3,3],[13151,4,3],[13497,4,3],[13843,4,3],[14189,4,3],[14536,4,3],[14651,4,3]],1),t(14189,5,4,0),t(15113,6,4,0),
  h(15805,5,4,16267,1),t(16728,5,5,0),t(16959,4,5,0),h(17190,4,5,17883),
  t(18113,4,5,0),t(18575,4,5,0),h(19037,2,5,19729),t(19960,3,4,0),
  h(20422,4,5,21691),f(20883,3,5),t(21807,3,4,0),h(22268,4,5,23076,0,[[22268,4,5],[22730,5,3],[23076,6,1]]),
  t(23192,5,5,0),t(23653,1,2,0),t(23653,5,2,0),t(23884,3,2,0),
  t(23884,7,2,0),t(24115,1,2,0),t(24115,5,2,0),t(24577,6,4,0),
  t(24577,0,3,0),t(24807,7,3,0),t(24807,1,3,0),t(25038,2,5,0),
  t(25500,6,4,0),t(25500,0,3,0),t(25731,2,5,0),t(25962,0,5,0),
  t(26192,4,5,0),t(26423,2,5,0),t(26885,0,5,1),t(27347,0,2,0),
  t(27347,4,2,0),t(27577,2,2,0),t(27577,6,2,0),t(27808,4,2,0),
  t(27808,8,2,0),t(28039,2,5,0),t(28270,0,5,0),t(28501,5,3,0),
  f(28731,2,5),t(29193,0,5,0),t(29424,0,5,0),t(29655,0,5,0),
  t(29886,2,5,0),t(30116,0,5,0),t(30578,0,5,0),t(30809,0,5,0),
  t(31040,2,5,0),t(31501,4,5,0),t(31963,5,5,0),t(32425,5,5,0),
  t(32771,5,5,0),t(32886,5,5,0),t(33117,5,5,0),f(33348,4,5),
  t(33810,5,5,0),t(33925,4,5,0),t(34271,5,5,0),t(34733,4,5,0),
  t(34964,2,5,0),t(35195,0,5,0),t(35425,2,5,0),t(35656,0,4,0),
  t(35656,7,3,0),t(36118,0,5,0),t(36349,2,5,0),t(36580,5,4,0),
  t(36810,0,5,0),t(37041,2,5,0),t(37503,4,5,0),t(37965,5,5,0),
  t(38195,4,5,0),t(38311,4,5,0),t(38426,5,5,0),f(38657,5,5),
  t(39811,4,5,0),t(40042,4,5,0),t(40273,4,5,0),t(40619,4,5,0),
  t(40735,2,5,0),t(40965,0,5,0),t(41196,2,5,0),t(41427,0,5,0),
  t(41658,0,5,0),t(41889,0,8,0),t(42119,2,5,0),t(42581,4,5,0),
  t(42812,2,5,0),t(43043,5,4,0),t(43504,5,5,0),t(43851,4,5,0),
  t(43966,2,5,0),t(44197,4,5,0),t(44659,2,5,0),f(44889,0,5),
  t(45351,0,5,0),t(45582,0,5,0),t(45813,0,5,0),t(46044,0,5,0),
  t(46274,0,4,0),t(46274,7,3,0),t(46967,3,3,0),t(47198,5,4,0),
  t(47659,5,5,0),t(48121,5,5,0),t(48352,4,5,0),t(48583,5,5,0),
  t(49044,4,5,2),t(49506,2,5,0),t(49968,1,4,0),t(50198,2,5,0),
  t(50429,4,5,0),t(50660,4,5,0),t(50891,5,5,0),t(51583,4,5,0),
  t(51814,6,4,0),f(52276,2,5),t(52738,4,5,0),t(53199,6,4,0),
  t(53430,4,5,0),t(53661,2,5,0),t(54353,4,5,0),t(54815,4,1,0),
  t(55046,4,5,0),t(55507,0,5,0),t(55854,4,5,0),t(55969,2,5,0),
  t(56200,5,5,0),t(56892,0,5,0),t(57354,2,5,0),t(57816,4,5,0),
  t(58277,6,4,0),t(58739,2,5,0),t(58970,0,5,0),t(59201,2,5,0),
  f(59662,4,5),t(60124,6,4,0),t(60124,0,3,0),t(60355,5,5,0),
  t(60586,5,5,0),h(60817,7,1,62201,0,[[60817,7,1],[61278,6,4],[61740,6,4],[62201,7,1]]),t(61278,9,1,0),t(61509,3,5,0),
  t(62432,0,4,0),t(62663,0,5,0),t(62894,0,5,0),t(63125,0,4,0),
  t(63356,0,5,0),t(63586,0,5,0),t(63817,4,5,0),t(64048,2,5,0),
  t(64279,0,5,0),t(64741,0,4,0),t(65202,0,5,0),t(65433,2,5,0),
  t(65664,0,5,0),t(65895,2,5,0),f(66126,2,5),t(66587,0,5,0),
  t(67049,0,5,0),t(67280,0,8,0),t(67511,0,5,0),t(67741,0,5,0),
  t(67972,0,4,0),t(67972,7,3,0),t(68203,4,5,0),h(68434,6,4,68895),
  t(69126,5,5,0),t(69357,4,5,0),t(69588,4,5,0),t(69819,2,5,0),
  t(70050,0,5,0),t(70280,0,5,0),t(70511,1,4,0),t(70742,2,5,0),
  t(70973,0,5,0),t(71204,2,5,0),t(71435,0,5,0),f(71665,0,5),
  t(72127,0,5,3),h(72589,0,5,73281,0,[[72589,0,5],[72935,2,1],[73281,0,5]]),t(73512,0,5,0),t(73743,0,5,0),
  t(73974,2,5,0),t(74205,4,5,0),t(74435,2,5,0),t(74666,0,5,0),
  t(74897,2,5,0),t(75128,4,5,0),t(75359,5,5,0),t(76282,5,4,0),
  t(76744,2,5,0),t(77205,0,5,0),f(77667,0,4),t(78129,0,5,0),
  t(78359,4,5,0),t(78590,3,4,0),t(78821,4,1,0),t(79052,0,5,0),
  t(79514,0,4,0),t(79975,0,5,0),s(80437,81129,[[80437,2,3],[80668,2.5,3],[80899,0,3],[81129,0,3]]),t(81360,4,5,0),
  t(81822,4,5,0),t(82053,5,5,0),s(82283,83091,[[82283,3,3],[82514,2,3],[82745,1,3],[82976,0.5,3],[83091,0.5,3]]),t(83207,0,4,0),
  t(83207,7,3,0),t(83668,5,4,0),s(83899,84592,[[83899,1.5,3],[84130,1.5,3],[84361,3.5,3],[84592,4,3]],1),s(85053,86554,[[85053,1.5,3],[85284,0.5,3],[85515,0,3],[85746,0,3],[85977,0,3],[86208,0,3],[86438,0,3],[86554,2,3]]),
  t(85515,1,5,0),t(85977,1,4,0),t(86900,0,4,0),t(87362,0,5,0),
  t(87593,0,5,0),f(87823,1,4),t(88285,3,4,0),t(88516,4,5,0),
  s(88747,89785,[[88747,0.5,3],[89093,0.5,3],[89439,1,3],[89785,3.5,3]]),t(89208,5,4,0),t(90132,5,5,0),t(90362,5,5,0),
  t(90593,5,4,0),t(91055,2,5,0),t(91517,4,5,0),t(91978,6,4,0),
  t(92440,5,4,0),t(92902,6,4,0),t(93363,4,5,4),t(93825,6,4,0),
  t(93940,6,4,0),t(94287,6,4,0),t(94633,8,1,0),t(94748,5,5,0),
  t(94979,6,1,0),t(95441,8,1,0),t(95556,2,8,0),t(95671,6,4,0),
  t(95902,8,1,0),t(96364,5,4,0),f(96595,5,5),t(97287,5,4,0),
  t(97403,4,5,0),t(97518,3,4,0),t(97749,2,1,0),t(97864,0,4,0),
  t(98211,0,3,0),t(98441,0,5,0),t(98672,2,5,0),t(98903,5,4,0),
  t(99134,1,4,0),f(99365,0,5),t(99826,1,4,0),t(100173,0,5,0),
  t(100288,0,5,0),t(100519,0,3,0),t(100750,0,4,0),t(100981,0,3,0),
  t(101211,0,5,0),t(101442,3,4,0),t(101673,0,5,0),t(102019,0,5,0),
  h(102135,2,5,102712),t(102827,1,3,0),t(103289,4,5,0),t(103404,5,4,0),
  t(103750,6,4,0),t(103866,5,3,0),t(103981,5,5,0),t(104212,2,5,0),
  t(104328,5,4,0),t(104674,6,4,0),t(104905,6,4,0),t(104905,0,3,0),
  t(105135,2,5,0),f(105366,1,4),t(105828,1,4,0),t(106059,0,1,0),
  h(106290,0,5,106982),h(107213,0,5,108252),t(107675,1,5,0),t(107790,2,4,0),
  t(108367,1,3,0),t(108598,4,5,0),t(108944,1,4,0),t(109059,3,4,0),
  t(109290,0,4,0),t(109521,0,5,0),t(109752,0,5,0),t(110214,0,4,0),
  t(110444,0,4,0),s(110675,111599,[[110675,0,3],[111022,2.5,3],[111368,4,3],[111599,4,3]]),t(111137,4,1,0),f(111829,1,4),
  t(112291,0,4,0),h(112522,0,5,113099),t(113214,3,4,0),t(113445,4,5,0),
  t(113561,6,4,0),t(113676,3,4,0),t(113907,4,5,0),h(114138,5,5,114946),
  t(115061,5,4,0),t(115523,3,4,0),t(115753,1,3,0),t(115869,0,5,0),
  t(115984,0,5,0),t(116215,6,1,0),t(116561,3,4,0),t(116677,0,5,0),
  h(116908,0,5,117716),t(117831,1,8,0),t(118293,5,4,0),f(118754,3,4),
// </close-to-your-heart-v3-expert-notes>
])(mhTap,mhHoldV2,mhFlick,mhSlideV2);
const closeToYourHeartMasterNotes=((t,h,f,s)=>[
// <close-to-your-heart-v3-master-notes>
  h(2879,3,1,3687,0,[[2879,3,1],[3340,2,3],[3687,1,4]]),t(3802,0,6,0),h(4264,4,2,5880,1),t(4956,7,3,0),
  t(5187,5,3,0),f(5418,6,2),t(6341,0,3,0),t(6803,4,2,0),
  t(7265,8,2,0),s(7957,9804,[[7957,2,2],[8303,2,2],[8649,2,2],[8996,2,2],[9342,2,2],[9688,2.5,2],[9804,4,2]],1),t(8880,0,3,0),t(9342,2,2,0),
  s(10265,10958,[[10265,3,2],[10496,3,2],[10727,3.5,2],[10958,4,2]],1),t(11881,4,2,0),t(12343,7,3,0),s(12804,14651,[[12804,3,2],[13151,4,2],[13497,4,2],[13843,4,2],[14189,4,2],[14536,4,2],[14651,4,2]],1),
  t(14189,3,3,0),t(15113,5,3,0),h(15805,7,3,16267),t(16498,5,3,0),
  t(16728,6,4,0),t(16959,5,4,0),h(17190,6,4,17883),t(18113,5,4,0),
  f(18575,5,4),h(19037,5,4,19729),t(19960,5,3,0),h(20422,3,4,21691),
  t(20883,7,3,0),t(21807,5,3,0),h(22268,5,4,23076,0,[[22268,5,4],[22730,6,3],[23076,7,1]]),t(23192,3,4,1),
  t(23653,5,4,0),t(23884,6,4,0),t(24115,5,4,0),t(24577,1,3,0),
  t(24577,6,3,0),t(24692,5,4,0),t(24807,4,2,0),t(24807,8,2,0),
  t(25038,6,4,0),t(25384,5,4,0),t(25500,7,3,0),t(25731,1,2,0),
  t(25731,5,2,0),t(25962,4,2,0),t(25962,8,2,0),t(26192,1,2,0),
  t(26192,5,2,0),t(26423,4,2,0),t(26423,8,2,0),t(26654,5,4,0),
  f(26885,3,4),t(27347,1,4,0),t(27577,3,4,0),t(27808,5,4,0),
  t(28039,3,4,0),t(28270,5,4,0),t(28501,2,2,0),t(28731,3,4,0),
  t(29193,0,2,0),t(29193,4,2,0),t(29424,1,2,0),t(29424,5,2,0),
  t(29655,3,2,0),t(29655,7,2,0),t(29886,4,2,0),t(29886,8,2,0),
  t(30116,0,4,0),t(30578,1,4,0),t(30809,1,4,0),t(30809,7,3,0),
  f(31040,5,4),t(31501,6,4,0),t(31732,5,4,0),t(31963,3,4,0),
  t(32425,1,4,0),t(32771,0,4,0),t(32886,2,2,0),t(32886,6,2,0),
  t(33117,2,2,0),t(33117,7,2,0),t(33348,1,2,0),t(33348,7,2,0),
  t(33579,1,2,0),t(33579,8,2,0),t(33810,5,4,0),t(33925,6,4,0),
  t(34271,5,4,0),t(34618,6,4,0),t(34733,3,4,0),t(34964,5,4,0),
  t(35195,6,4,0),t(35425,5,4,0),f(35656,3,3),t(36118,1,2,0),
  t(36118,5,2,0),t(36349,4,2,0),t(36349,8,2,0),t(36580,1,2,0),
  t(36580,5,2,0),t(36810,4,2,0),t(36810,8,2,0),t(37041,1,4,0),
  t(37272,0,4,0),t(37272,6,3,0),t(37503,0,6,0),t(37965,0,4,0),
  t(38195,1,4,0),t(38311,3,4,0),t(38426,5,4,0),t(38657,6,4,0),
  t(39811,1,4,0),t(39927,5,3,0),t(40042,3,4,0),t(40273,6,4,0),
  t(40504,6,1,0),t(40619,6,4,0),t(40735,5,4,0),t(40965,0,2,0),
  t(40965,4,2,0),t(41196,1,2,0),t(41196,5,2,0),t(41427,3,2,0),
  t(41427,7,2,0),t(41658,4,2,0),t(41658,8,2,0),t(41889,6,4,0),
  f(42119,5,4),t(42581,3,4,0),t(42812,1,4,0),t(43043,3,3,0),
  t(43504,5,4,0),t(43735,2,1,0),t(43851,3,4,0),t(43966,0,4,0),
  t(44197,1,4,0),t(44659,0,4,0),t(44889,1,4,0),t(45120,0,2,0),
  t(45351,1,4,0),t(45582,3,4,0),t(45813,5,4,0),t(46044,6,4,0),
  f(46274,7,3),t(46967,8,2,0),t(47198,7,3,0),t(47429,8,1,0),
  t(47659,3,4,0),t(48121,5,4,0),t(48352,6,4,0),t(48583,5,4,0),
  t(49044,6,4,2),t(49506,3,4,0),t(49968,5,3,0),t(50198,1,4,0),
  t(50429,1,4,0),t(50660,0,4,0),f(50891,1,4),t(51583,0,4,0),
  t(51583,6,3,0),t(51814,0,3,0),t(52045,0,3,0),t(52276,0,4,0),
  t(52738,0,4,0),t(53084,1,3,0),t(53199,0,3,0),t(53199,5,3,0),
  t(53430,1,4,0),t(53661,0,4,0),t(54353,0,4,0),t(54815,0,1,0),
  t(55046,1,4,0),t(55507,1,4,0),t(55854,0,4,0),t(55969,3,4,0),
  t(56200,1,4,0),f(56892,5,4),t(57354,2,6,0),t(57585,5,3,0),
  t(57816,6,4,0),t(58047,5,4,0),t(58277,1,3,0),t(58739,5,4,0),
  t(58970,3,4,0),t(59201,6,4,0),t(59662,5,4,0),t(59662,0,3,0),
  t(60124,7,3,0),t(60355,5,4,0),t(60586,6,4,0),h(60817,7,1,62201,0,[[60817,7,1],[61278,6,3],[61740,6,3],[62201,7,1]]),
  t(61278,9,1,0),t(61509,4,4,0),f(61740,8,2),t(62432,3,3,0),
  t(62663,1,4,0),t(62894,3,4,0),t(63125,1,3,0),t(63356,1,4,0),
  t(63586,0,4,0),t(63817,1,4,0),t(64048,0,4,0),t(64279,1,4,0),
  t(64510,0,4,0),t(64741,1,3,0),t(65202,0,4,0),t(65433,1,4,0),
  t(65664,0,4,0),t(65895,1,4,0),t(66126,0,4,0),t(66126,6,3,0),
  f(66587,3,4),t(67049,1,4,0),t(67280,0,4,0),t(67511,1,4,0),
  t(67741,0,4,0),t(67972,3,3,0),t(68088,2,1,0),t(68203,5,4,0),
  h(68434,7,3,68895),t(69126,6,4,0),t(69357,6,4,0),t(69588,6,4,0),
  t(69819,5,4,0),t(70050,6,4,0),t(70280,5,4,0),t(70511,7,3,0),
  t(70742,5,4,0),t(70973,6,4,0),t(71204,5,4,0),t(71435,6,4,0),
  t(71665,5,4,0),t(71896,6,4,0),f(72127,5,4),h(72589,6,4,73281,0,[[72589,6,4],[72935,8,1],[73281,6,4]]),
  t(73512,5,4,0),t(73627,7,3,0),t(73743,5,4,0),t(73974,6,4,0),
  t(74205,3,4,0),t(74435,1,4,0),t(74666,3,4,0),t(74897,1,4,0),
  t(75128,5,4,0),t(75359,1,4,0),t(75589,4,1,0),t(76051,0,3,0),
  t(76282,5,3,0),t(76744,2,6,3),t(77205,1,4,0),f(77667,0,3),
  t(78129,1,4,0),t(78359,5,4,0),t(78590,3,3,0),t(78821,0,1,0),
  t(79052,3,4,0),t(79283,0,1,0),h(79514,3,3,79975,1),s(80437,81129,[[80437,4,2],[80783,2.5,2],[81129,0,2]]),
  t(81360,0,4,0),t(81360,6,3,0),t(81822,0,4,0),t(82053,0,4,0),
  s(82283,83091,[[82283,1.5,2],[82514,0.5,2],[82745,0,2],[82976,0,2],[83091,0,2]]),t(83207,0,3,0),t(83668,0,3,0),s(83899,84592,[[83899,1.5,2],[84130,1.5,2],[84361,3.5,2],[84592,4,2]]),
  t(84823,0,4,0),s(85053,86554,[[85053,1.5,2],[85284,0.5,2],[85515,0,2],[85746,0,2],[85977,0,2],[86208,0,2],[86438,0,2],[86554,2,2]]),t(85515,1,4,0),t(85977,3,3,0),
  t(86900,3,3,0),t(87362,1,4,0),t(87593,1,4,0),t(87593,7,3,0),
  f(87823,5,3),t(88285,7,3,0),t(88516,5,4,0),s(88747,89785,[[88747,3,2],[88977,2.5,2],[89208,2.5,2],[89439,2.5,2],[89670,4,2],[89785,4,2]]),
  t(89208,6,3,0),t(89901,8,2,0),t(90016,5,4,0),t(90132,3,4,0),
  t(90362,5,4,0),t(90593,3,3,0),t(91055,5,4,0),t(91517,1,4,0),
  t(91517,7,3,0),t(91978,3,3,0),t(92209,1,4,0),t(92440,0,3,0),
  t(92902,1,3,0),t(93363,0,4,4),t(93825,1,3,0),t(93940,3,3,0),
  f(94287,1,3),t(94748,3,4,0),t(94979,2,1,0),t(95441,6,1,0),
  t(95556,3,4,0),t(95671,7,3,0),t(95902,8,1,0),t(96018,8,2,0),
  t(96364,7,3,0),t(96595,6,4,0),t(96941,5,3,0),t(97172,2,2,0),
  t(97287,3,3,0),t(97403,0,4,0),t(97518,1,3,0),t(97749,0,1,0),
  t(97864,1,3,0),t(98211,0,2,0),t(98441,1,4,0),t(98672,3,4,0),
  t(98903,5,3,0),t(99134,7,3,0),t(99365,4,6,0),t(99596,4,1,0),
  t(99826,1,3,0),t(100173,0,4,0),t(100288,1,4,0),t(100519,4,2,0),
  t(100634,5,3,0),t(100750,7,3,0),t(100981,4,2,0),t(101211,6,4,0),
  t(101442,3,3,0),t(101673,6,4,0),t(102019,5,4,0),h(102135,6,4,102712),
  f(102827,6,2),t(103289,6,4,0),t(103404,3,3,0),t(103750,0,3,0),
  t(103866,5,2,0),t(103981,6,4,0),t(103981,1,3,0),t(104212,5,4,0),
  t(104328,1,3,0),t(104674,3,3,0),t(104789,0,2,0),t(104905,0,3,0),
  t(105135,3,4,0),t(105366,1,3,0),t(105712,1,3,0),t(105828,1,3,0),
  t(106059,2,1,0),h(106290,0,4,106982),h(107213,1,4,108252),t(107675,3,4,0),
  f(107790,3,3),t(108367,0,2,0),t(108598,1,4,0),t(108713,0,3,0),
  t(108944,1,3,0),t(109059,0,3,0),t(109290,1,3,0),t(109521,1,4,0),
  f(109752,3,4),t(110214,3,3,0),t(110329,5,3,0),t(110444,7,3,0),
  s(110675,111599,[[110675,3,2],[110906,3,2],[111137,4,2],[111368,4,2],[111599,4,2]]),t(111137,6,1,0),f(111829,5,3),t(112291,3,3,0),
  h(112522,1,4,113099),t(113214,0,3,0),t(113445,3,4,0),t(113561,0,3,0),
  t(113676,3,3,0),t(113907,6,4,0),h(114138,3,4,114946),t(115061,5,3,0),
  t(115523,3,3,0),t(115753,2,2,0),t(115869,1,4,0),t(115984,0,4,0),
  t(116215,2,1,0),t(116561,0,3,0),t(116561,5,3,0),t(116677,1,4,0),
  h(116908,2,1,117716,0,[[116908,2,1],[117369,1,3],[117716,0,4]]),t(117831,0,6,0),t(118062,0,1,0),t(118293,3,3,0),
  t(118754,5,3,0),t(118754,0,3,0),f(118870,4,2),
// </close-to-your-heart-v3-master-notes>
])(mhTap,mhHoldV2,mhFlick,mhSlideV2);
// 綺季一閃 ～花雪に舞う詠姫～ battle remix（全尺3分38秒）。譜面はV3パイプラインが入れる。
// 元の曲とは別の曲として扱う(自己ベストもランキングも別に貯まる)。
const EIKI_BOSS_REMIX_DURATION_MS=218050;
const eikiBossRemixEasyNotes=((t,h,f,s)=>[
// <eiki-boss-remix-v3-easy-notes>
  t(2938,0,10,0),t(3328,4,6,0),t(4495,4,6,0),t(6052,2,6,0),
  t(7220,1,4,0),t(8387,2,6,0),t(8776,3,4,0),t(9944,4,6,0),
  t(10333,4,6,0),t(11501,4,6,0),t(12279,4,6,0),t(12668,2,6,0),
  t(13447,4,6,0),t(14225,2,6,0),t(15393,0,6,0),t(16560,0,6,0),
  t(17339,0,6,0),t(19090,0,6,0),t(19285,2,6,0),t(19674,4,6,0),
  h(21620,6,3,22593,0,[[21620,6,3],[21912,5,4],[22301,5,4],[22593,4,6]]),t(23955,4,6,0),t(24344,4,6,0),t(25512,4,6,0),
  t(25901,2,6,0),t(26679,4,6,0),t(27458,0,3,0),t(27458,7,3,0),
  t(28236,0,6,0),t(28431,1,4,0),t(29988,0,4,0),t(30182,0,6,0),
  t(31350,0,6,0),t(31739,2,6,0),t(32128,4,6,0),h(32907,4,6,34366),
  t(35242,5,4,0),t(36799,2,6,0),t(37188,4,6,0),h(37577,4,6,38745),
  t(39134,4,6,0),t(39523,0,10,0),t(40496,6,4,0),t(40885,5,4,0),
  t(41080,2,6,0),t(41469,1,4,0),t(41858,0,6,0),t(42053,1,4,0),
  t(43026,3,4,0),t(43999,5,4,0),t(44193,2,6,0),t(44582,0,6,0),
  t(45750,0,6,1),t(46139,0,4,0),h(47307,0,6,48864),t(49253,2,6,0),
  t(49642,4,6,0),t(50031,2,6,0),t(50810,5,4,0),t(51199,6,4,0),
  t(51588,4,6,0),t(53145,4,6,0),t(53534,4,6,0),t(55091,4,6,0),
  t(56258,2,6,0),t(56648,2,6,0),h(57815,0,6,59177,0,[[57815,0,6],[58204,0,6],[58496,1,4],[58885,1,4],[59177,2,3]]),t(59956,2,6,0),
  t(60539,4,6,0),t(61707,2,6,0),t(62096,5,4,0),t(62485,3,4,0),
  t(64042,0,6,0),t(64431,0,6,0),t(65210,0,6,0),t(65988,0,6,0),
  t(66377,0,3,0),t(66377,7,3,0),t(66961,2,6,0),t(67934,4,6,0),
  t(68323,4,6,0),t(68907,5,4,0),t(69491,6,4,0),t(70464,5,4,0),
  t(70659,0,10,0),t(71437,4,6,0),t(72605,0,4,0),t(72994,0,6,0),
  t(73383,2,6,0),t(74161,4,6,0),t(74940,6,4,0),t(75718,4,6,0),
  t(76497,2,6,0),t(77275,0,6,0),t(78443,2,6,0),t(78832,1,4,0),
  t(79221,0,6,0),t(80388,1,4,0),t(81361,3,4,0),t(81556,0,6,0),
  t(81945,0,4,0),t(82334,0,6,0),t(83502,0,4,0),t(84280,0,6,0),
  t(85059,3,4,0),t(85448,4,6,0),t(85837,2,6,0),t(86616,1,4,0),
  t(87783,3,4,2),t(88172,4,6,0),t(88951,2,6,0),t(90508,5,4,0),
  t(90897,7,3,0),t(90897,0,3,0),t(91286,6,4,0),t(91675,6,4,0),
  t(93232,4,6,0),t(94010,2,6,0),t(94400,0,6,0),t(94789,0,6,0),
  t(95178,1,4,0),t(96735,3,4,0),t(97124,3,4,0),t(97513,1,4,0),
  t(97902,1,4,0),t(99070,0,4,0),t(99848,1,4,0),t(100627,3,4,0),
  t(101016,1,4,0),t(102183,0,4,0),t(102573,0,10,0),t(103740,0,4,0),
  t(104519,0,6,0),h(105297,4,3,106854,0,[[105297,4,3],[105686,3,4],[106075,2,6],[106465,3,4],[106854,4,3]]),t(108411,4,6,0),t(109967,6,4,0),
  t(110940,4,6,0),t(111524,6,4,0),t(113081,4,6,0),t(114249,4,6,0),
  t(114638,4,6,0),t(116195,4,6,0),t(117168,4,6,0),t(118140,4,6,0),
  h(119308,6,4,120865),t(122422,7,3,0),t(122422,0,3,0),t(123395,6,4,0),
  t(123589,4,6,0),t(123978,3,4,0),t(124368,0,6,0),h(125146,0,6,126703),
  t(126897,0,6,0),h(127092,0,6,128454,0,[[127092,0,6],[127481,1,4],[127773,2,3],[128162,1,4],[128454,0,6]]),t(128649,3,4,0),t(129038,4,6,0),
  t(130206,4,6,3),t(130595,4,6,0),t(131762,2,6,0),t(132152,4,6,0),
  t(132930,2,6,0),t(134098,0,6,0),t(134876,1,4,0),t(135265,2,6,0),
  t(136044,4,6,0),t(136433,6,4,0),t(136822,4,6,0),t(137600,0,10,0),
  t(137989,1,4,0),t(138962,2,6,0),t(139546,1,4,0),t(139935,0,6,0),
  t(140908,0,6,0),t(141103,0,4,0),t(141492,0,6,0),t(142854,0,6,0),
  t(143049,0,6,0),t(143438,2,6,0),t(144217,5,4,0),t(144606,2,6,0),
  h(145773,5,4,146552),t(146941,0,3,0),t(146941,7,3,0),h(148109,0,6,149665),
  t(150444,0,6,0),t(152390,2,6,0),t(152779,0,6,0),t(153557,0,6,0),
  t(155893,0,6,0),t(156282,2,6,0),t(156671,4,6,0),h(158228,4,6,159784),
  h(160174,6,4,161147),t(161341,3,4,0),t(161730,5,4,0),t(162120,6,4,0),
  t(162509,4,6,0),h(162898,3,4,164358),t(164455,2,6,0),t(164844,1,4,0),
  t(165233,0,6,0),h(165622,0,6,166790),h(167568,0,6,168249),t(168347,0,6,0),
  t(168736,0,6,0),t(169125,3,4,0),t(169514,5,4,0),t(170293,4,6,0),
  t(170682,0,10,0),t(171071,2,6,4),h(171460,0,6,173017),t(173796,0,6,0),
  t(174379,0,6,0),t(174574,0,6,0),t(175352,1,4,0),t(176131,0,3,0),
  t(176131,7,3,0),t(176520,4,6,0),t(176909,3,4,0),t(177298,1,4,0),
  t(178077,0,6,0),t(178466,1,4,0),t(178855,2,6,0),t(179633,4,6,0),
  t(180023,5,4,0),t(180801,6,4,0),t(181190,4,6,0),t(181579,4,6,0),
  t(181969,4,6,0),t(182747,2,6,0),t(182942,0,6,0),t(183525,0,6,0),
  t(183915,2,6,0),t(184693,1,4,0),t(185082,0,6,0),t(185471,0,6,0),
  t(185861,0,6,0),t(186250,0,6,0),t(187028,0,6,0),t(187807,3,4,0),
  t(188196,0,6,0),t(188974,0,4,0),t(189363,1,4,0),t(189753,0,4,0),
  t(190336,0,6,0),t(190531,0,4,0),t(190920,1,4,0),t(191309,0,6,0),
  t(191699,0,6,0),h(192088,2,3,193547,0,[[192088,2,3],[192477,1,4],[192866,1,4],[193158,0,6],[193547,0,6]]),t(193645,0,10,0),t(194034,7,3,0),
  t(194034,0,3,0),h(194423,2,6,195493),t(195591,4,6,0),t(195980,6,4,0),
  t(196369,4,6,0),t(196758,4,6,0),t(197147,6,4,0),t(197536,4,6,0),
  t(198315,4,6,0),t(198704,4,6,0),t(199093,4,6,0),t(199482,4,6,0),
  t(200650,4,6,0),t(201039,4,6,0),t(201428,0,6,0),t(202207,1,4,0),
  t(202596,2,6,0),t(202985,4,6,0),t(203374,6,4,0),t(203764,4,6,0),
  t(204153,2,6,0),t(204542,0,6,0),t(204931,4,6,0),t(205320,4,6,0),
  t(205710,3,4,0),t(206099,0,6,0),t(206488,0,6,0),t(206877,0,6,0),
  t(207656,2,6,0),t(208045,5,4,0),t(208434,2,6,0),t(208823,7,3,0),
  t(208823,0,3,0),t(209212,2,6,0),h(209602,4,6,210769,0,[[209602,4,6],[209991,5,4],[210380,5,4],[210769,6,3]]),t(211158,2,6,0),
  t(211742,4,6,0),t(211937,4,6,0),t(213494,4,6,0),t(213883,4,6,0),
  t(214272,0,10,0),
// </eiki-boss-remix-v3-easy-notes>
])(mhTap,mhHoldV2,mhFlick,mhSlideV2);
const eikiBossRemixNormalNotes=((t,h,f,s)=>[
// <eiki-boss-remix-v3-normal-notes>
  t(2938,0,10,0),f(3328,4,6),t(4495,2,6,0),t(5274,4,6,0),
  t(6052,4,6,0),t(7220,5,4,0),t(8387,2,6,0),t(8776,3,4,0),
  t(9944,0,6,0),t(10333,4,6,0),t(11501,2,6,0),t(12279,4,6,0),
  t(12668,4,6,0),t(13058,6,4,0),t(13447,4,6,0),t(14225,4,6,0),
  t(15393,4,6,0),t(16171,2,6,0),t(16560,0,6,0),f(17339,0,6),
  t(19285,2,6,0),t(19674,4,6,0),t(20063,2,6,0),h(21620,6,2,22593,1,[[21620,6,2],[21912,6,3],[22301,5,4],[22593,4,6]]),
  t(23566,0,6,0),t(23955,4,6,0),t(24344,2,6,0),t(25512,0,6,0),
  t(25901,0,6,0),t(26290,0,6,0),t(26679,0,6,0),t(27458,0,3,0),
  t(27458,7,3,0),t(28236,0,6,0),t(28431,0,4,0),t(29988,1,4,0),
  t(30182,4,6,0),f(31350,2,6),t(31739,4,6,0),t(32128,2,6,0),
  h(32907,4,6,34366),t(34853,4,6,0),t(35242,5,4,0),t(36799,2,6,0),
  t(37188,4,6,0),h(37577,4,6,38745),t(39134,4,6,0),t(39328,6,4,0),
  t(39523,0,10,0),t(40496,1,4,0),t(40885,5,4,0),t(41080,2,6,0),
  t(41469,6,4,0),t(41858,2,6,0),f(42053,6,4),t(43026,0,4,0),
  t(43609,1,4,0),t(43999,3,4,0),t(44193,4,6,0),t(44582,4,6,0),
  t(45555,5,4,0),t(45750,2,6,0),t(46139,1,4,1),h(47307,0,6,48864),
  t(49253,0,6,0),t(49642,0,6,0),t(50031,2,6,0),t(50810,5,4,0),
  t(51199,3,4,0),t(51588,0,6,0),t(53145,2,6,0),f(53534,4,6),
  h(54702,4,6,55383),t(56258,2,6,0),t(56648,2,6,0),h(57815,1,4,59177),
  t(59956,2,6,0),t(60539,4,6,0),h(60929,4,6,62485,0,[[60929,4,6],[61318,6,4],[61707,6,4],[62096,7,3],[62485,7,2]]),t(64042,4,6,0),
  t(64431,4,6,0),t(64821,4,6,0),t(65210,4,6,0),t(65988,2,6,0),
  t(66377,7,3,0),t(66377,0,3,0),t(66961,2,6,0),t(67350,6,4,0),
  t(67934,2,6,0),f(68323,4,6),t(68907,3,4,0),t(69491,6,4,0),
  t(70464,5,4,0),t(70659,4,6,0),t(71048,4,6,0),t(71437,0,10,0),
  t(72994,4,6,0),t(73383,2,6,0),t(74161,0,6,0),t(74940,3,4,0),
  t(75329,0,6,0),t(75718,0,6,0),t(76497,0,6,0),t(76691,1,4,0),
  t(77275,2,6,0),t(78443,0,6,0),f(78832,3,4),t(79221,4,6,0),
  t(79999,2,6,0),t(80388,7,3,0),t(80388,0,3,0),t(81556,4,6,0),
  t(81945,6,4,0),t(82334,4,6,0),h(83113,6,2,84183,0,[[83113,6,2],[83502,5,4],[83794,5,4],[84183,6,2]]),t(84280,0,6,0),
  t(85059,0,4,0),t(85448,0,6,0),t(85837,0,6,0),t(86616,0,4,0),
  t(87005,0,3,0),t(87783,0,4,0),t(88172,0,6,2),t(88951,0,6,0),
  f(90508,0,4),t(90897,1,4,0),t(91286,3,4,0),t(91675,5,4,0),
  t(92454,4,6,0),t(93232,4,6,0),t(94010,2,6,0),t(94400,0,6,0),
  t(94789,2,6,0),t(95178,7,3,0),t(95178,0,3,0),t(95567,4,6,0),
  t(96735,5,4,0),t(97124,5,4,0),t(97513,6,4,0),t(97902,6,4,0),
  t(99070,0,4,0),t(99848,1,4,0),f(100237,3,4),t(100627,5,4,0),
  t(101016,6,4,0),t(102183,5,4,0),t(102573,0,10,0),t(103740,3,4,0),
  t(104129,4,6,0),t(104519,0,6,0),t(106075,6,4,0),t(106854,5,4,0),
  t(107632,3,4,0),t(108411,0,6,0),h(109189,0,4,110259,1),t(111524,1,4,0),
  t(111913,3,4,0),t(113081,4,6,0),t(114249,2,6,0),f(114638,4,6),
  t(116195,4,6,0),t(117168,2,6,0),t(117751,5,4,0),t(118140,4,6,0),
  h(119308,4,6,120865,0,[[119308,4,6],[119697,6,4],[120086,7,2],[120476,6,4],[120865,4,6]]),t(121643,4,6,0),t(122422,7,3,0),t(122422,0,3,0),
  t(123395,5,4,0),t(123589,2,6,0),t(123784,1,4,0),t(124368,2,6,0),
  h(125146,4,6,126703),t(126897,2,6,0),h(127092,4,6,128454),t(128649,1,4,0),
  t(129038,4,6,0),f(129427,3,4),t(130206,0,6,0),t(130595,4,6,3),
  t(131762,2,6,0),t(132152,2,6,0),t(132541,1,4,0),t(132930,0,6,0),
  t(134098,0,6,0),t(134876,0,4,0),t(135265,0,6,0),t(135849,0,4,0),
  t(136044,2,6,0),t(136433,0,3,0),t(136433,7,3,0),t(136822,0,6,0),
  t(137600,0,10,0),t(137989,3,4,0),t(138962,0,6,0),f(139546,3,4),
  t(139935,4,6,0),t(140908,2,6,0),t(141103,5,4,0),t(141492,4,6,0),
  t(142271,4,6,0),t(142854,2,6,0),t(143049,4,6,0),t(143438,0,6,0),
  t(144217,3,4,0),t(144606,4,6,0),t(144995,3,4,0),h(145773,0,4,146552),
  t(146941,1,4,0),h(148109,2,6,149665),t(150055,0,6,0),t(150444,0,6,0),
  f(152390,0,6),t(152779,0,6,0),t(153557,0,6,0),t(154336,0,6,0),
  t(155893,0,6,0),t(156282,4,6,0),t(156671,2,6,0),h(158228,4,6,159784),
  h(160174,3,4,161147),t(161341,0,3,0),t(161341,7,3,0),t(161730,5,4,0),
  t(162120,3,4,0),t(162509,4,6,0),h(162898,5,4,164358),t(164455,4,6,0),
  t(164844,5,4,0),f(165233,2,6),h(165622,0,6,166790,1),h(167374,0,6,168249),
  t(168347,0,6,0),t(168736,4,6,0),t(169125,3,4,0),t(169514,6,4,0),
  t(170293,2,6,0),t(170487,4,6,0),t(170682,2,6,0),t(171071,0,10,0),
  h(171460,2,2,173017,0,[[171460,2,2],[171850,2,3],[172239,1,4],[172628,1,4],[173017,0,6]]),t(173796,0,6,4),t(174379,0,6,0),t(174574,0,6,0),
  t(174769,1,4,0),t(175352,7,3,0),t(175352,0,3,0),t(175742,3,4,0),
  f(176131,1,4),t(176520,0,6,0),t(176909,3,4,0),t(177298,1,4,0),
  t(178077,0,6,0),t(178466,1,4,0),t(178855,0,6,0),t(179244,1,4,0),
  t(179633,2,6,0),t(180023,5,4,0),t(180412,5,4,0),t(180801,6,4,0),
  t(181190,4,6,0),t(181579,4,6,0),t(181969,4,6,0),t(182747,2,6,0),
  t(182942,0,6,0),f(183136,0,4),t(183525,0,6,0),t(183915,0,6,0),
  t(184693,0,3,0),t(184693,7,3,0),t(185082,0,6,0),t(185471,0,6,0),
  t(185861,0,6,0),t(186250,2,6,0),t(187028,4,6,0),t(187807,6,4,0),
  t(188196,4,6,0),t(188585,3,4,0),t(188974,1,4,0),t(189363,0,4,0),
  t(189753,0,3,0),t(190336,0,6,0),f(190531,1,4),t(190920,1,4,0),
  t(191115,2,6,0),t(191309,0,6,0),t(191699,0,10,0),h(192088,0,6,193547,0,[[192088,0,6],[192477,1,4],[192866,1,4],[193158,2,3],[193547,2,2]]),
  t(193645,2,6,0),t(194034,5,4,0),h(194423,2,6,195493),t(195591,0,6,0),
  t(195980,0,4,0),t(196369,0,6,0),t(196758,0,6,0),t(197147,0,4,0),
  t(197536,0,6,0),t(197926,0,3,0),t(197926,7,3,0),t(198315,0,6,0),
  t(198704,0,6,0),f(199093,0,6),t(199482,4,6,0),t(199872,0,6,0),
  t(200650,2,6,0),t(201039,0,6,0),t(201428,0,6,0),t(201818,0,4,0),
  t(202207,1,4,0),t(202596,0,6,0),t(202985,4,6,0),t(203374,3,4,0),
  t(203764,0,6,0),t(204153,0,6,0),t(204542,0,6,0),t(204737,2,6,0),
  t(204931,0,6,0),t(205320,2,6,0),f(205710,5,4),t(206099,0,6,0),
  t(206488,2,6,0),t(206877,0,6,0),t(207656,0,6,0),t(208045,1,4,0),
  t(208434,0,6,0),t(208823,0,3,0),t(208823,7,3,0),t(209212,2,6,0),
  t(209407,4,6,0),h(209602,7,2,210769,1,[[209602,7,2],[209991,6,4],[210380,6,4],[210769,7,2]]),t(211158,2,6,0),t(211742,4,6,0),
  t(211937,2,6,0),t(213494,0,6,0),t(213883,0,6,0),t(214272,0,10,0),
  f(216023,0,4),
// </eiki-boss-remix-v3-normal-notes>
])(mhTap,mhHoldV2,mhFlick,mhSlideV2);
const eikiBossRemixHardNotes=((t,h,f,s)=>[
// <eiki-boss-remix-v3-hard-notes>
  t(2938,0,8,0),f(3328,4,5),t(3717,0,5,0),t(4495,4,5,0),
  t(4884,3,4,0),t(5274,4,5,0),t(6052,5,5,0),t(6830,4,5,0),
  t(7220,5,4,0),h(7609,4,1,9166,1,[[7609,4,1],[7998,4,2],[8387,3,3],[8776,3,4],[9166,2,5]]),t(9944,0,5,0),t(10333,2,5,0),
  t(10722,0,5,0),t(11501,2,5,0),t(12279,0,5,0),t(12668,4,5,0),
  t(13058,1,4,0),t(13447,2,5,0),t(14225,4,5,0),t(14614,5,5,0),
  f(15393,4,5),s(15782,17339,[[15782,0,3],[16074,0,3],[16366,0.5,3],[16658,1.5,3],[16950,3,3],[17241,4,3],[17339,4,3]]),t(17728,2,5,0),t(18896,1,4,0),
  t(19090,0,5,0),t(19285,2,5,0),t(19674,2,5,0),t(20063,4,5,0),
  t(21231,3,4,0),h(21620,4,5,22593),t(22787,1,4,0),t(23566,2,5,0),
  t(23955,4,5,0),t(24344,5,5,0),t(25123,4,5,0),t(25512,2,5,0),
  t(25901,0,5,0),t(26290,4,5,0),t(26485,5,5,0),f(26679,4,5),
  t(27458,0,4,0),t(27458,7,3,0),t(28236,0,5,0),t(28431,0,4,0),
  t(28431,7,3,0),t(28625,4,5,0),t(29015,6,4,0),t(29015,0,3,0),
  t(29988,5,4,0),t(30182,2,5,0),t(30571,5,4,0),t(31350,2,5,0),
  t(31739,0,5,0),t(32128,0,8,0),h(32907,0,5,34366),t(34463,0,5,0),
  t(34853,0,5,0),t(35242,3,4,0),t(35631,5,5,0),f(36799,4,5),
  t(37188,5,5,0),t(37382,5,4,0),h(37577,4,5,38745),t(38939,3,4,0),
  t(39134,0,5,0),t(39328,3,4,0),t(39523,0,5,0),t(39718,0,5,0),
  t(40301,1,3,0),t(40496,0,4,0),t(40885,1,4,0),t(41080,2,5,0),
  t(41469,5,4,0),t(41858,2,5,0),t(42053,1,4,0),t(42247,0,4,0),
  t(42442,3,4,0),t(43026,6,4,0),t(43318,3,4,0),f(43609,0,4),
  t(43999,3,4,0),t(44193,0,5,0),t(44582,2,5,1),t(44972,4,5,0),
  s(45166,46723,[[45166,3,4],[45264,2.5,4],[45361,3,4],[45555,2,3],[45750,1.5,3],[45945,1,3],[46042,1,3],[46139,1,3],[46334,1.5,2],[46528,1.5,2],[46723,1.5,2]]),s(47307,48864,[[47307,3,4],[47501,3,4],[47793,2.5,3],[48280,2,3],[48864,1,2]],1),t(49253,0,5,0),t(49642,0,5,0),
  t(49837,3,4,0),t(50031,4,5,0),t(50226,6,4,0),t(50810,5,4,0),
  t(51199,3,4,0),t(51588,4,5,0),t(52172,0,5,0),t(53145,0,5,0),
  t(53339,0,5,0),t(53534,0,5,0),t(53729,0,5,0),f(54702,0,5),
  t(55091,2,5,0),t(56258,4,5,0),t(56453,2,5,0),t(56648,0,5,0),
  t(57426,1,8,0),s(57815,59177,[[57815,3,4],[57912,3,4],[58010,3,4],[58107,4,4],[58204,3.5,3],[58302,4,3],[58399,4,3],[58496,4,3],[58594,4,3],[58691,4,3],[58788,4,3],[58885,4,2],[58983,4,2],[59080,4,2],[59177,4,2]]),t(59372,0,5,0),t(59956,2,5,0),
  t(60539,4,5,0),h(60929,5,5,62485,0,[[60929,5,5],[61318,6,4],[61707,7,3],[62096,7,2],[62485,8,1]]),t(62680,5,4,0),t(62875,7,3,0),
  t(63653,4,5,0),t(64042,2,5,0),t(64431,0,5,0),t(64821,2,5,0),
  t(65210,5,5,0),t(65794,2,5,0),f(65988,0,5),t(66377,6,4,0),
  t(66767,5,4,0),t(66961,2,5,0),t(67350,1,4,0),t(67934,0,5,0),
  t(68323,0,5,0),t(68907,0,4,0),t(69102,2,5,0),t(69491,6,4,0),
  t(70075,3,4,0),t(70464,0,4,0),t(70659,2,5,0),t(71048,4,5,0),
  h(71437,6,1,72215,0,[[71437,6,1],[71826,4,5],[72215,6,1]]),t(72605,6,4,0),t(72994,4,5,0),t(73383,5,5,0),
  f(73772,4,5),t(74161,2,5,0),t(74551,4,5,0),t(74940,6,4,0),
  t(74940,0,3,0),t(75329,2,5,0),t(75718,0,5,0),t(76302,0,5,0),
  t(76497,0,5,0),t(76691,3,4,0),t(77275,2,5,0),t(77664,0,5,0),
  t(78248,3,4,0),t(78443,5,5,0),t(78832,3,4,0),t(79221,0,5,0),
  t(79999,0,5,0),t(80388,3,4,0),t(80778,2,8,0),t(81361,6,4,0),
  f(81556,4,5),t(81945,3,4,0),t(82334,4,5,0),s(83113,84183,[[83113,3,2],[83210,3.5,3],[83307,4,3],[83405,3.5,4],[83502,2.5,4],[83599,2.5,4],[83697,2.5,4],[83794,2.5,4],[83891,2.5,4],[83989,2.5,3],[84086,2.5,3],[84183,2.5,2]]),
  t(84280,4,5,0),t(84475,2,5,0),t(84670,0,5,0),t(85059,0,4,0),
  t(85253,0,5,0),t(85448,2,5,0),t(85837,2,5,0),t(86616,0,4,0),
  t(87005,1,3,0),t(87005,7,3,0),t(87199,6,4,0),t(87783,3,4,0),
  t(88172,0,5,2),t(88951,0,5,0),h(89729,4,5,91286,1),t(91675,6,4,0),
  f(92064,5,4),t(92454,2,5,0),t(92843,0,5,0),t(93232,0,5,0),
  t(94010,0,5,0),t(94400,2,5,0),t(94594,0,5,0),t(94789,0,5,0),
  t(95178,0,4,0),t(95178,7,3,0),t(95567,0,5,0),t(95956,3,4,0),
  t(96346,0,4,0),t(96735,3,4,0),t(97124,0,4,0),t(97513,3,4,0),
  t(97902,0,4,0),t(98875,0,5,0),t(99070,3,4,0),f(99459,6,4),
  t(99848,3,4,0),t(100237,0,4,0),t(100627,3,4,0),t(101016,6,4,0),
  t(101016,0,3,0),h(101794,5,5,102573),s(102962,104519,[[102962,3,4],[103546,3,3],[104032,3.5,3],[104227,4,2],[104324,4,2],[104519,4,2]]),t(104908,5,5,0),
  h(105297,5,5,106854,0,[[105297,5,5],[105686,7,3],[106075,8,1],[106465,7,3],[106854,5,5]]),t(107243,5,5,0),t(107632,5,4,0),t(108411,2,8,0),
  s(109189,110259,[[109189,3,4],[109481,3,3],[109578,3,3],[109967,4,3],[110162,4,2],[110259,4,2]]),t(110940,0,5,0),t(111524,5,4,0),t(111913,3,4,0),
  s(112303,113373,[[112303,3.5,3],[112594,2,3],[112886,0.5,3],[113178,1,3],[113373,1.5,3]]),t(114249,4,5,0),f(114638,2,5),h(115416,1,4,115903),
  h(116195,0,5,116681),t(117168,2,5,0),t(117557,0,5,0),t(117751,0,4,0),
  h(118140,0,5,118919),s(119308,120865,[[119308,1,4],[119892,1.5,3],[120378,2.5,3],[120670,3,2],[120865,3,2]],1),t(121643,0,5,0),t(122422,3,4,0),
  t(122811,4,5,0),h(123200,6,4,123784),t(123978,5,4,0),t(124368,2,5,0),
  t(124951,1,4,0),s(125146,126703,[[125146,3,4],[125341,3,4],[125633,3,3],[126119,3,3],[126703,1,2]]),t(126897,4,5,0),h(127092,5,5,128454),
  t(128649,6,4,0),t(128649,0,3,0),t(129038,4,5,0),f(129427,3,4),
  t(129816,0,5,3),t(130206,0,5,0),t(130400,0,5,0),t(130595,0,5,0),
  t(131568,0,5,0),t(131762,2,5,0),t(131957,6,4,0),t(132152,2,5,0),
  t(132541,0,4,0),t(132930,2,5,0),t(133319,0,5,0),t(134098,2,5,0),
  t(134876,5,4,0),t(135265,5,5,0),t(135849,5,4,0),t(136044,2,5,0),
  t(136238,3,4,0),t(136433,0,4,0),t(136627,3,4,0),f(136822,5,5),
  t(137600,2,5,0),t(137989,0,4,0),t(138379,0,5,0),t(138962,1,8,0),
  t(139157,0,5,0),t(139546,5,4,0),t(139935,2,5,0),t(140325,6,4,0),
  t(140325,0,3,0),t(140714,4,5,0),h(140908,5,5,141687),t(141881,6,4,0),
  h(142271,5,5,143244),t(143438,4,5,0),t(143827,5,5,0),t(144217,5,4,0),
  t(144411,3,4,0),h(144606,4,5,145482),t(145773,3,4,0),t(145968,1,4,0),
  f(146163,0,4),t(146941,1,4,0),t(147136,3,4,0),s(148109,149665,[[148109,1,4],[148206,3,4],[148303,3,4],[148400,3,4],[148498,3,3],[148595,3,3],[148692,1,3],[148790,1,3],[148887,1,3],[148984,3,3],[149082,3,3],[149179,3,3],[149276,3,2],[149373,1,2],[149471,1,2],[149568,1,2],[149665,3,2]]),
  t(150055,2,5,0),t(150444,0,5,0),s(150833,152390,[[150833,1,4],[150930,1,4],[151028,0,3],[151125,0,3],[151222,0,3],[151319,1,3],[151417,1,3],[151514,1,2],[151611,1,2],[151709,1,2],[151806,0,3],[151903,0,3],[152001,0,3],[152098,1,3],[152195,1,3],[152292,1,4],[152390,1,4]],1),t(152779,0,5,0),
  t(153557,4,5,0),t(154336,0,5,0),t(154725,4,5,0),t(155503,0,5,0),
  t(155893,4,5,0),t(156282,0,5,0),t(156671,4,5,0),t(157060,4,5,0),
  f(157449,5,5),s(158228,159784,[[158228,3,4],[158422,3,4],[158714,3,3],[158811,3,3],[159201,3,3],[159784,1,2]]),t(159979,0,3,0),t(160174,3,4,0),
  t(160368,7,3,0),t(160563,3,4,0),t(160952,0,4,0),t(161147,3,3,0),
  t(161341,6,4,0),t(161730,6,4,0),t(162120,5,4,0),t(162314,3,4,0),
  t(162509,0,5,0),t(162703,0,4,0),s(162898,164358,[[162898,1,4],[162995,1,4],[163093,1,4],[163190,1,4],[163287,0,3],[163385,0,3],[163482,1,3],[163579,1,3],[163676,0,3],[163774,0,3],[163871,0,3],[163968,0,3],[164066,0,2],[164163,0,2],[164260,0,2],[164358,0,2]]),t(164455,5,5,0),
  t(164844,5,4,0),t(165039,3,4,0),t(165233,0,8,0),t(165622,0,5,0),
  t(165817,2,5,0),f(166012,1,4),t(166401,0,4,0),t(166790,0,4,0),
  t(166790,7,3,0),t(167179,0,5,0),t(167374,0,5,0),t(167568,2,5,0),
  t(167763,4,5,0),t(167958,5,5,0),t(168347,0,5,0),t(168736,4,5,0),
  t(168931,2,5,0),t(169125,6,4,0),t(169514,5,4,0),t(169904,0,4,0),
  t(169904,7,3,0),t(170098,1,4,0),t(170293,0,5,0),t(170487,0,5,0),
  t(170682,0,5,0),t(170877,1,5,0),f(170974,0,5),h(171460,4,1,173017,1,[[171460,4,1],[171850,4,2],[172239,3,3],[172628,3,4],[173017,2,5]]),
  t(173796,4,5,0),t(173990,6,4,0),t(174087,4,5,0),t(174379,2,5,0),
  t(174574,0,5,0),t(174769,0,4,0),t(175352,1,4,4),t(175742,1,4,0),
  t(176131,0,4,0),t(176520,0,5,0),t(176714,1,4,0),t(176909,1,4,0),
  t(177298,0,4,0),t(177687,0,4,0),t(177882,0,5,0),f(178077,0,5),
  t(178466,1,4,0),t(178660,0,4,0),t(178855,0,5,0),t(179244,0,4,0),
  t(179633,0,5,0),t(179828,1,4,0),t(180023,0,4,0),t(180023,7,3,0),
  h(180412,1,4,181190),t(181385,0,4,0),t(181579,2,5,0),t(181969,2,8,0),
  t(182163,2,5,0),t(182358,0,4,0),t(182747,2,5,0),t(182942,0,5,0),
  t(183136,5,4,0),t(183331,2,5,0),t(183525,0,5,0),t(183720,3,4,0),
  f(183915,4,5),t(184304,5,5,0),t(184693,5,4,0),t(184888,3,4,0),
  t(185082,5,5,0),t(185471,4,5,0),t(185666,2,5,0),t(185861,4,5,0),
  t(186250,5,5,0),t(187028,5,5,0),t(187417,4,5,0),f(187807,6,4),
  h(188196,4,5,188780),t(188974,3,4,0),t(189169,5,4,0),h(189363,1,4,189947),
  t(190142,3,4,0),t(190336,4,5,0),t(190531,6,4,0),t(190531,0,3,0),
  t(190726,5,4,0),t(190920,3,4,0),t(191115,2,5,0),t(191309,0,5,0),
  t(191504,2,5,0),t(191699,5,5,0),t(191893,2,5,0),h(192088,0,5,193547,0,[[192088,0,5],[192477,1,4],[192866,1,3],[193158,2,2],[193547,2,1]]),
  t(193645,0,5,0),t(193839,0,4,0),t(194034,1,4,0),h(194423,0,5,195493),
  t(195591,2,5,0),t(195785,5,4,0),h(195980,3,4,196855),t(196953,1,4,0),
  f(197147,3,4),t(197536,4,5,0),t(197731,6,4,0),t(197926,5,4,0),
  t(198315,5,5,0),t(198509,4,5,0),t(198704,2,8,0),t(199093,0,5,0),
  t(199288,4,5,0),t(199482,2,5,0),t(199872,5,5,0),t(200261,1,4,0),
  t(200650,4,5,0),t(201039,2,5,0),t(201428,5,5,0),t(201623,6,4,0),
  t(201818,6,4,0),t(202207,6,4,0),t(202401,5,5,0),t(202596,4,5,0),
  t(202791,5,5,0),f(202985,4,5),t(203374,3,4,0),t(203764,4,5,0),
  t(204153,5,5,0),t(204347,4,5,0),t(204542,4,5,0),t(204737,5,5,0),
  t(204931,4,5,0),t(205223,5,5,0),t(205320,2,5,0),t(205515,5,4,0),
  t(205710,3,4,0),t(205904,1,4,0),t(206099,0,5,0),t(206488,0,5,0),
  f(206877,2,5),t(207461,5,4,0),t(207656,5,5,0),t(207850,5,4,0),
  t(208045,6,4,0),t(208239,4,5,0),t(208434,5,5,0),t(208629,5,4,0),
  t(208823,6,4,0),t(208823,0,3,0),t(209212,2,5,0),t(209407,5,5,0),
  h(209602,7,1,210769,1,[[209602,7,1],[209991,5,4],[210380,5,4],[210769,7,1]]),t(211158,2,5,0),t(211742,4,5,0),t(211937,5,5,0),
  t(212326,4,5,0),t(213494,2,5,0),t(213883,4,5,0),t(214077,2,5,0),
  t(214272,0,5,0),t(214856,1,8,0),f(216023,1,4),
// </eiki-boss-remix-v3-hard-notes>
])(mhTap,mhHoldV2,mhFlick,mhSlideV2);
const eikiBossRemixExpertNotes=((t,h,f,s)=>[
// <eiki-boss-remix-v3-expert-notes>
  t(2938,0,8,0),f(3328,4,5),t(3717,0,5,0),t(4495,0,2,0),
  t(4495,4,2,0),t(4884,2,2,0),t(4884,6,2,0),t(5274,4,2,0),
  t(5274,8,2,0),t(6052,5,5,0),t(6830,4,5,0),t(7220,5,4,0),
  h(7609,5,1,9166,1,[[7609,5,1],[7998,5,2],[8387,4,3],[8776,4,4],[9166,3,5]]),t(8387,6,4,0),t(8776,3,4,0),h(9749,1,4,11014),
  t(10333,4,5,0),t(11501,2,5,0),t(12279,1,2,0),t(12279,5,2,0),
  t(12668,3,2,0),t(12668,7,2,0),t(13058,1,2,0),t(13058,5,2,0),
  t(13447,2,5,0),t(14031,4,5,0),f(14225,5,5),t(14614,4,5,0),
  t(15393,4,5,0),s(15782,17339,[[15782,0,3],[16074,0,3],[16366,0.5,3],[16658,1.5,3],[16950,3,3],[17241,4,3],[17339,4,3]]),t(16171,1,5,0),t(16560,3,5,0),
  t(17728,0,5,0),t(18896,0,2,0),t(18896,4,2,0),t(19090,2,2,0),
  t(19090,6,2,0),t(19285,4,2,0),t(19285,8,2,0),t(19674,0,5,0),
  t(20063,2,5,0),t(21231,1,4,0),h(21620,5,5,22593),t(22009,1,4,0),
  t(23566,2,5,0),t(23955,0,5,0),f(24344,2,5),t(25123,0,5,0),
  t(25512,1,2,0),t(25512,5,2,0),t(25706,3,2,0),t(25706,7,2,0),
  t(25901,1,2,0),t(25901,5,2,0),t(26290,2,5,0),t(26485,2,5,0),
  t(26679,0,5,0),t(27458,0,4,0),t(27458,7,3,0),t(28236,0,2,0),
  t(28236,4,2,0),t(28431,2,2,0),t(28431,6,2,0),t(28625,4,2,0),
  t(28625,8,2,0),t(29015,3,4,0),t(29988,6,4,0),t(30182,4,5,0),
  t(30377,3,4,0),t(30571,1,4,0),f(31350,0,5),t(31739,0,5,0),
  t(32128,2,5,0),h(32907,0,5,34366),t(33296,2,5,0),t(33685,0,8,0),
  t(34463,5,2,0),t(34853,3,2,0),t(34853,7,2,0),t(35242,1,2,0),
  t(35242,5,2,0),h(35631,0,5,36312,1,[[35631,0,5],[36020,1,3],[36312,2,1]]),t(36799,0,5,0),h(36799,8,2,39231),
  t(37188,2,5,0),t(37382,0,4,0),h(37577,0,5,38745),t(38939,4,4,0),
  t(39134,5,5,0),t(39328,5,4,0),t(39523,5,5,0),f(39718,4,5),
  t(40301,7,3,0),t(40496,5,4,0),t(40885,0,4,0),t(40885,7,3,0),
  t(41080,4,5,0),t(41469,6,4,0),t(41858,4,5,0),t(42053,3,4,0),
  t(42247,1,4,0),t(42442,3,4,0),t(42831,4,5,0),t(43026,1,4,0),
  t(43318,3,4,0),t(43609,5,4,0),t(43999,6,4,0),t(44193,4,5,0),
  f(44582,2,5),t(44972,5,5,0),s(45166,46723,[[45166,2.5,4],[45264,2,4],[45361,2.5,4],[45555,1.5,3],[45750,0.5,3],[45945,0.5,3],[46042,0.5,3],[46139,0.5,3],[46334,0.5,2],[46528,0.5,2],[46723,0.5,2]]),t(45555,4,4,0),
  s(45750,46723,[[45750,3,2],[46723,4,2]]),s(47307,48864,[[47307,1.5,4],[47501,1.5,4],[47793,0.5,3],[48280,0,3],[48864,0,2]]),s(47307,48864,[[47307,3,2],[48864,4,2]]),t(49253,0,5,0),
  t(49642,0,5,0),t(49837,3,4,0),t(50031,4,5,0),t(50226,6,4,0),
  t(50810,5,4,0),t(51199,0,4,0),t(51199,7,3,0),t(51393,5,5,0),
  f(51588,2,5),t(52172,5,5,0),t(53145,4,5,0),t(53339,4,5,0),
  t(53534,4,5,0),t(53729,4,5,0),s(54702,55383,[[54702,2,2],[54799,2,3],[54896,3,4],[54993,3,4],[55091,2.5,4],[55188,2,4],[55285,0.5,3],[55383,0.5,2]],1),t(56258,0,5,0),
  t(56453,0,5,0),t(56648,2,5,0),t(56842,2,5,0),s(57815,59177,[[57815,0,3],[58107,1,3],[58399,2.5,3],[58691,4,3],[58983,4,3],[59177,4,3]]),
  t(58204,2,8,0),t(58399,0,5,0),t(59372,0,5,0),t(59956,0,5,0),
  t(60539,0,5,0),h(60929,2,1,62485,0,[[60929,2,1],[61318,1,3],[61707,0,5],[62096,1,3],[62485,2,1]]),f(61318,3,3),t(61707,0,1,0),
  t(62096,3,4,0),t(62680,0,4,0),t(62875,3,3,0),t(63653,5,5,0),
  t(64042,2,5,0),t(64431,0,5,0),t(64821,2,5,0),t(65210,5,5,0),
  t(65794,2,5,0),t(65988,0,5,0),t(66183,2,5,0),t(66377,0,4,0),
  t(66377,7,3,0),t(66961,2,5,0),t(67350,1,4,0),t(67934,0,5,0),
  f(68323,0,5),t(68907,0,4,0),t(69102,0,5,0),t(69296,3,4,0),
  t(69491,5,4,0),t(70075,3,4,0),t(70464,1,4,0),t(70659,0,5,0),
  t(70853,0,5,0),t(71048,0,5,0),h(71437,0,5,72215),t(72605,6,4,0),
  t(72994,4,5,0),t(73383,2,5,0),t(73772,0,5,0),t(74161,0,5,0),
  t(74551,0,5,0),t(74940,3,4,0),f(75329,0,5),t(75718,2,5,0),
  t(76302,5,5,0),t(76497,2,5,0),t(76691,0,4,0),t(76691,7,3,0),
  t(77275,4,5,0),t(77664,2,5,0),t(78248,1,4,0),t(78443,0,5,0),
  t(78832,1,4,0),t(79221,2,5,0),t(79805,0,4,0),t(79999,2,5,0),
  t(80388,6,4,0),t(80778,2,5,0),t(81361,0,4,0),t(81556,1,8,0),
  f(81945,6,4),t(82334,5,5,0),s(83113,84183,[[83113,2,2],[83210,2.5,3],[83307,3.5,3],[83405,2.5,4],[83502,1.5,4],[83599,1,4],[83697,1.5,4],[83794,1,4],[83891,1.5,4],[83989,1,3],[84086,1,3],[84183,1,2]]),t(83502,5,4,0),
  t(84280,0,5,0),t(84475,2,5,0),t(84670,0,5,0),t(85059,3,4,0),
  t(85253,4,5,0),t(85448,0,5,0),t(85837,5,5,0),t(86616,5,4,0),
  t(87005,3,3,0),t(87199,1,4,0),t(87394,0,3,0),t(87394,6,3,0),
  t(87783,1,4,2),t(88172,2,5,0),f(88951,0,5),h(89729,4,5,91286,1,[[89729,4,5],[90118,5,3],[90508,6,1],[90897,5,3],[91286,4,5]]),
  t(90118,0,5,0),t(90508,1,4,0),t(90897,3,4,0),t(91675,5,4,0),
  t(92064,6,4,0),t(92454,4,5,0),t(92843,2,5,0),t(93232,4,5,0),
  t(93816,5,5,0),t(94010,4,5,0),t(94400,5,5,0),t(94594,5,5,0),
  t(94789,4,5,0),t(94983,2,5,0),t(95178,5,4,0),t(95567,2,5,0),
  f(96346,5,4),t(96735,3,4,0),t(97124,1,4,0),t(97513,3,4,0),
  t(97902,5,4,0),t(98681,2,5,0),t(98875,0,5,0),t(99070,3,4,0),
  t(99459,6,4,0),t(99459,0,3,0),t(99848,3,4,0),t(100237,0,4,0),
  t(100627,0,4,0),t(101016,3,4,0),h(101794,5,5,102573),t(102183,3,4,0),
  s(102962,104519,[[102962,0,3],[103254,0,3],[103546,0,3],[103838,0.5,3],[104129,2,3],[104421,4,3],[104519,4,3]]),t(103351,2,5,0),f(103740,2,4),t(104129,4,5,0),
  h(105297,2,4,106854),t(105686,5,4,0),t(106075,3,4,0),t(107243,2,8,0),
  t(107632,3,4,0),t(108411,0,5,0),s(109189,110259,[[109189,1.5,4],[109481,1,3],[109578,1,3],[109967,3,3],[110162,3,2],[110259,3,2]],1),t(110940,0,5,0),
  t(111524,5,4,0),t(111913,3,4,0),s(112303,113373,[[112303,3,4],[112497,1.5,3],[112692,1.5,3],[112789,1,2],[112886,1,2],[112984,1,3],[113081,1,3],[113178,1.5,3],[113373,1.5,4]]),h(113665,5,5,114054),
  t(114249,4,5,0),t(114638,2,5,0),h(115416,5,4,115903),h(116195,5,5,116681),
  f(117168,0,5),t(117557,2,5,0),t(117751,1,4,0),h(118140,4,5,118919),
  t(118530,2,5,0),s(119308,120865,[[119308,1.5,4],[119892,1.5,3],[120378,2.5,3],[120670,2.5,2],[120865,2.5,2]]),t(119697,4,4,0),t(120086,4,5,0),
  t(120476,5,5,0),t(121643,0,5,0),t(122422,0,4,0),t(122422,7,3,0),
  t(122811,5,5,0),h(123200,3,4,123784),t(123978,0,4,0),t(124368,2,5,0),
  t(124951,0,4,0),t(125146,0,5,0),s(125341,126800,[[125341,2.5,4],[125438,2.5,4],[125827,2,3],[126216,2.5,3],[126703,1,2],[126800,1,2]]),f(125924,0,5),
  t(126897,0,5,0),h(127092,1,5,128454),t(127481,0,5,0),t(127676,0,4,0),
  t(128065,0,4,0),t(128649,1,4,0),t(129038,2,5,0),t(129427,1,4,3),
  t(130206,4,5,0),t(130400,5,5,0),t(130595,5,5,0),t(131568,0,5,0),
  t(131762,2,5,0),t(131957,6,4,0),t(131957,0,3,0),t(132152,2,5,0),
  f(132541,0,4),t(132930,2,5,0),t(133125,0,5,0),t(133319,2,5,0),
  t(134098,0,5,0),t(134876,5,4,0),t(135265,2,5,0),t(135654,6,4,0),
  t(135849,3,4,0),t(136044,4,5,0),t(136238,3,4,0),t(136433,5,4,0),
  t(136627,6,4,0),t(136822,2,8,0),t(137600,5,5,0),t(137989,5,4,0),
  t(138379,2,5,0),t(138962,0,5,0),f(139157,2,5),t(139546,5,4,0),
  t(139935,4,5,0),t(140325,5,4,0),t(140714,5,5,0),h(140908,5,5,141687),
  t(141881,6,4,0),t(141881,0,3,0),h(142271,0,5,143244),t(142660,6,4,0),
  t(142854,5,5,0),t(143438,4,5,0),t(143827,5,5,0),t(144217,5,4,0),
  t(144411,3,4,0),h(144606,6,1,145482,0,[[144606,6,1],[145092,5,3],[145482,4,5]]),t(144995,0,4,0),s(145773,146552,[[145773,1.5,4],[145871,1,4],[145968,1,3],[146260,0,3],[146357,0,2],[146552,0,2]],1),
  s(145773,146552,[[145773,4,2],[146552,2,2]]),t(146941,5,4,0),t(147136,6,4,0),s(148109,149665,[[148109,2,4],[148206,3,4],[148303,3,4],[148400,3,4],[148498,3,3],[148595,3,3],[148692,2,3],[148790,2,3],[148887,2,3],[148984,3,3],[149082,3,3],[149179,3,3],[149276,3,2],[149373,2,2],[149471,2,2],[149568,2,2],[149665,3,2]]),
  t(148498,3,5,0),t(148887,5,5,0),t(150055,4,5,0),t(150444,2,5,0),
  s(150833,152390,[[150833,1.5,4],[150930,1.5,4],[151028,0,3],[151125,0,3],[151222,0,3],[151319,1.5,3],[151417,1.5,3],[151514,1.5,2],[151611,1.5,2],[151709,1.5,2],[151806,0,3],[151903,0,3],[152001,0,3],[152098,1,3],[152195,1,3],[152292,1.5,4],[152390,1.5,4]],1),t(152779,0,5,0),t(153557,0,5,0),t(154336,0,5,0),
  t(154725,0,5,0),t(155503,0,5,0),t(155893,0,5,0),t(156282,0,5,0),
  t(156671,0,5,0),t(157060,0,5,0),f(157449,0,5),s(158228,159784,[[158228,2,4],[158422,2,4],[158714,2,3],[158811,2,3],[159201,2,3],[159784,0,2]]),
  t(158617,0,4,0),t(159006,5,4,0),t(159395,4,4,0),t(159979,1,3,0),
  t(159979,7,3,0),t(160174,0,4,0),t(160368,0,3,0),t(160563,1,4,0),
  t(160952,3,4,0),t(161147,5,3,0),t(161341,6,4,0),t(161730,6,4,0),
  t(162120,5,4,0),t(162314,3,4,0),t(162509,4,5,0),t(162703,1,4,0),
  s(162898,164358,[[162898,2,4],[162995,2,4],[163093,2,4],[163190,2,4],[163287,0.5,3],[163385,0.5,3],[163482,2,3],[163579,2,3],[163676,0.5,3],[163774,0.5,3],[163871,0.5,3],[163968,0.5,3],[164066,0.5,2],[164163,0.5,2],[164260,0,2],[164358,0,2]]),t(163287,3,4,0),t(163482,3,7,0),f(163676,5,4),
  t(164455,5,5,0),t(164844,6,4,0),t(165039,5,4,0),t(165233,2,5,0),
  t(165428,0,4,0),t(165428,7,3,0),t(165622,1,5,0),s(165817,166790,[[165817,2,4],[165914,0,4],[166012,0,4],[166109,0,3],[166401,0,3],[166790,1,2]],1),
  s(166012,168833,[[166012,4,2],[168833,3,2]]),t(167179,0,5,0),t(167374,0,5,0),t(167568,2,5,0),
  t(167763,0,5,0),t(167958,2,5,0),t(168152,3,4,0),f(168347,2,5),
  t(168736,2,5,0),t(168931,5,5,0),t(169125,5,4,0),t(169514,6,4,0),
  t(169904,3,4,0),t(170098,5,4,0),t(170293,5,5,0),t(170487,4,5,0),
  t(170682,5,5,0),t(170877,4,5,0),t(170974,5,5,0),t(171071,2,5,0),
  h(171460,4,5,173017,1,[[171460,4,5],[171850,5,4],[172239,5,3],[172628,6,2],[173017,6,1]]),t(171850,0,5,4),f(172239,5,5),t(173601,4,5,0),
  t(173796,5,5,0),t(173990,5,4,0),t(174087,2,5,0),t(174379,0,5,0),
  t(174574,0,5,0),t(174769,0,4,0),t(174769,7,3,0),t(175352,0,4,0),
  t(175742,0,4,0),t(176131,1,4,0),t(176325,0,4,0),t(176520,0,5,0),
  t(176714,3,4,0),t(176909,5,4,0),t(177298,6,4,0),t(177687,5,4,0),
  t(177882,4,5,0),f(178077,4,5),t(178466,6,4,0),t(178660,6,4,0),
  t(178855,5,5,0),t(179244,6,4,0),t(179633,2,8,0),t(179828,5,4,0),
  t(180023,6,4,0),h(180412,5,4,181190),t(180801,6,4,0),t(181385,6,4,0),
  t(181579,4,5,0),t(181969,2,5,0),t(182163,0,5,0),t(182358,0,4,0),
  t(182747,0,5,0),t(182942,0,5,0),t(183136,0,4,0),t(183136,7,3,0),
  t(183331,0,5,0),t(183525,0,5,0),t(183720,1,4,0),f(183915,2,5),
  t(184304,0,5,0),t(184693,1,4,0),t(184888,0,4,0),t(185082,0,5,0),
  t(185471,0,5,0),t(185666,0,5,0),t(185861,0,5,0),t(186055,3,4,0),
  t(186250,4,5,0),t(187028,0,5,0),t(187417,4,5,0),f(187807,3,4),
  h(188196,5,5,188780),t(188974,3,4,0),t(189169,6,4,0),h(189363,5,4,189947),
  t(190142,5,4,0),t(190336,5,5,0),t(190531,6,4,0),t(190726,5,4,0),
  t(190920,0,4,0),t(190920,7,3,0),t(191115,2,5,0),t(191309,0,5,0),
  t(191504,0,5,0),t(191699,2,5,0),h(192088,3,1,193547,0,[[192088,3,1],[192477,2,3],[192866,1,5],[193158,2,3],[193547,3,1]]),t(192477,0,1,0),
  t(192866,0,5,0),t(193061,0,5,0),t(193645,0,5,0),t(193839,0,4,0),
  f(194034,1,4),h(194423,2,5,195493),t(194812,1,4,0),t(195007,0,4,0),
  t(195591,0,5,0),t(195785,1,4,0),h(195980,1,4,196855),t(196369,2,5,0),
  t(196953,5,4,0),t(197147,3,4,0),t(197536,0,5,0),t(197731,1,4,0),
  t(197926,5,4,0),t(198120,3,4,0),t(198315,0,8,0),t(198509,2,5,0),
  t(198704,4,5,0),t(199093,5,5,0),t(199288,5,5,0),f(199482,4,5),
  t(199872,2,5,0),t(200261,6,4,0),t(200261,0,3,0),t(200650,4,5,0),
  t(201039,5,5,0),t(201428,5,5,0),t(201623,6,4,0),t(201818,6,4,0),
  t(202207,6,4,0),t(202401,5,5,0),t(202596,4,5,0),t(202791,5,5,0),
  t(202985,4,5,0),f(203374,1,4),t(203764,2,5,0),t(203958,5,4,0),
  t(204153,5,5,0),t(204347,5,5,0),t(204542,5,5,0),t(204737,4,5,0),
  t(204931,4,5,0),t(205223,4,5,0),t(205320,5,5,0),t(205515,5,4,0),
  t(205710,6,4,0),t(205904,3,4,0),t(206099,4,5,0),t(206488,5,5,0),
  t(206877,4,5,0),t(207461,3,4,0),t(207656,4,5,0),t(207850,6,4,0),
  t(208045,6,4,0),t(208045,0,3,0),t(208239,0,5,0),t(208434,2,5,0),
  t(208629,5,4,0),t(208726,6,4,0),f(208823,5,4),t(209212,2,5,0),
  t(209407,0,5,0),h(209602,2,5,210769,1,[[209602,2,5],[209991,3,2],[210380,3,2],[210769,2,5]]),t(209991,0,5,0),t(210380,2,1,0),
  t(211158,0,5,0),t(211450,0,5,0),t(211742,0,5,0),t(211937,2,5,0),
  t(212326,0,5,0),t(213494,2,5,0),t(213883,4,5,0),t(214077,2,5,0),
  f(214272,0,5),t(214856,1,8,0),
// </eiki-boss-remix-v3-expert-notes>
])(mhTap,mhHoldV2,mhFlick,mhSlideV2);
const eikiBossRemixMasterNotes=((t,h,f,s)=>[
// <eiki-boss-remix-v3-master-notes>
  t(2549,4,6,0),f(2938,3,4),t(3328,1,4,0),t(3717,1,4,0),
  t(4495,0,2,0),t(4495,4,2,0),t(4884,4,2,0),t(4884,8,2,0),
  t(5274,0,2,0),t(5274,4,2,0),t(5663,4,2,0),t(5663,8,2,0),
  t(6052,3,4,0),t(6830,5,4,0),t(7220,3,3,0),h(7609,5,1,9166,1,[[7609,5,1],[7998,4,2],[8387,4,3],[8776,4,3],[9166,3,4]]),
  t(8387,7,3,0),t(8776,7,3,0),h(9749,3,3,11014),t(10333,6,4,0),
  t(11501,6,4,0),h(12085,5,3,13447),t(12474,3,3,0),f(12668,1,4),
  t(13058,0,3,0),t(14031,1,4,0),t(14225,5,4,0),t(14614,3,4,0),
  h(15004,5,2,16366),t(15393,5,4,0),s(15782,17339,[[15782,0,2],[16074,0,2],[16366,0.5,2],[16658,1.5,2],[16950,3,2],[17241,4,2],[17339,4,2]]),t(16560,3,4,0),
  t(17728,1,4,0),s(18117,19285,[[18117,1.5,3],[18214,1.5,3],[18312,1.5,3],[18409,2,2],[18506,1,2],[18604,1,2],[18701,1,2],[18798,1,2],[18896,1,2],[18993,1,2],[19090,1,2],[19187,0,2],[19285,1,2]],1),s(18117,19285,[[18117,3,2],[19285,4,2]]),t(19674,1,4,0),
  t(20063,0,4,0),t(20841,3,4,0),f(21231,1,3),h(21620,5,4,22593),
  t(22009,3,3,0),t(22787,5,3,0),t(23566,6,4,0),t(23955,5,4,0),
  t(24344,0,4,0),t(25123,1,4,0),t(25512,3,4,0),t(25901,5,4,0),
  t(25901,0,3,0),t(26290,6,4,0),t(26485,5,4,0),t(26679,3,4,0),
  t(27069,1,4,0),f(27458,0,3),t(28236,3,4,0),t(28431,5,3,0),
  t(28625,3,4,0),t(28723,1,3,0),t(29015,3,3,0),t(29988,0,2,0),
  t(29988,4,2,0),t(30182,1,2,0),t(30182,5,2,0),t(30377,3,2,0),
  t(30377,7,2,0),t(30571,4,2,0),t(30571,8,2,0),t(31350,5,4,0),
  t(31739,4,6,0),t(31934,3,4,0),t(32128,5,4,0),t(32517,6,4,0),
  h(32907,5,4,34366),t(33296,3,4,0),t(33685,1,4,0),f(34463,3,4),
  t(34853,1,4,0),t(35242,3,3,0),h(35631,1,4,36312),t(36409,0,4,0),
  t(36799,1,4,0),h(36799,0,2,39231),t(37188,3,4,0),t(37382,5,3,0),
  h(37577,6,4,38745,0,[[37577,6,4],[37966,7,3],[38355,7,2],[38745,8,1]]),t(38939,7,3,0),t(39134,5,4,0),t(39328,7,3,0),
  t(39426,3,3,0),t(39523,6,4,0),t(39718,5,4,0),f(39912,3,3),
  t(40301,6,2,0),t(40496,3,3,0),t(40885,1,3,0),t(41080,3,4,0),
  t(41469,5,3,0),t(41858,3,4,0),t(42053,5,3,0),t(42053,0,3,0),
  t(42247,7,3,0),t(42442,5,3,0),t(42831,6,4,0),t(43026,5,3,0),
  t(43220,7,3,0),t(43318,5,3,0),t(43609,7,3,0),t(43999,5,3,0),
  f(44193,5,4),t(44582,6,4,0),t(44777,7,3,0),t(44972,6,4,0),
  s(45166,46723,[[45166,2.5,3],[45264,2,3],[45361,2.5,3],[45555,1.5,2],[45750,0.5,2],[45945,0.5,2],[46042,0.5,2],[46139,0.5,2],[46334,0.5,2],[46528,0.5,2],[46723,0.5,2]],1),t(45555,4,3,0),s(45750,46723,[[45750,3,2],[46723,4,2]]),s(47307,48864,[[47307,2,3],[47501,2,3],[47793,1.5,2],[48280,1,2],[48864,0,2]],1),
  s(47307,48864,[[47307,4,2],[48864,2,2]]),h(49253,0,4,49837),t(50031,0,4,0),t(50031,6,3,0),
  t(50226,3,3,0),f(50810,7,3),t(51199,3,3,0),t(51393,0,4,0),
  t(51588,2,6,0),t(51977,6,2,0),t(52172,6,4,0),t(53145,2,2,0),
  t(53145,6,2,0),t(53339,2,2,0),t(53339,7,2,0),t(53534,1,2,0),
  t(53534,7,2,0),t(53729,1,2,0),t(53729,8,2,0),s(54702,55383,[[54702,3,2],[54799,3,2],[54896,3.5,3],[54993,3.5,3],[55091,3,3],[55188,2.5,3],[55285,1.5,2],[55383,1.5,2]],1),
  t(56258,1,2,0),t(56258,5,2,0),t(56453,3,2,0),t(56453,7,2,0),
  t(56648,1,2,0),t(56648,5,2,0),t(56842,3,2,0),t(56842,7,2,0),
  t(57426,1,4,0),s(57815,59177,[[57815,0,2],[58107,1,2],[58399,2.5,2],[58691,4,2],[58983,4,2],[59177,4,2]]),t(58204,4,4,0),f(58399,6,4),
  t(59372,6,4,0),t(59761,6,2,0),t(59956,3,4,0),t(60539,1,4,0),
  h(60929,2,1,62485,0,[[60929,2,1],[61318,1,3],[61707,1,4],[62096,1,3],[62485,2,1]]),t(61318,4,2,0),t(61707,6,4,0),t(61902,3,3,0),
  t(62096,0,3,0),t(62680,2,3,0),t(62680,7,3,0),t(62875,6,2,0),
  t(63653,6,4,0),t(64042,3,4,0),t(64431,0,4,0),f(64821,3,4),
  t(65210,6,4,0),t(65794,0,2,0),t(65794,4,2,0),t(65988,1,2,0),
  t(65988,5,2,0),t(66183,3,2,0),t(66183,7,2,0),t(66377,4,2,0),
  t(66377,8,2,0),t(66767,3,3,0),t(66961,6,4,0),t(67350,3,3,0),
  t(67740,0,4,0),t(67740,6,3,0),t(67934,0,4,0),t(68323,1,4,0),
  t(68907,2,2,0),t(68907,6,2,0),t(69102,2,2,0),t(69102,7,2,0),
  t(69296,1,2,0),t(69296,7,2,0),t(69491,1,2,0),t(69491,8,2,0),
  f(70075,0,3),t(70464,1,3,0),t(70659,3,4,0),t(70853,5,4,0),
  t(71048,3,4,0),t(71437,1,4,0),h(71632,0,4,72215,1),t(72605,3,3,0),
  t(72994,1,4,0),t(73383,3,4,0),t(73578,1,3,0),t(73772,0,4,0),
  t(74161,1,4,0),t(74551,0,6,0),t(74940,3,3,0),t(75329,1,4,0),
  t(75329,7,3,0),f(75718,5,4),t(76107,1,2,0),t(76107,5,2,0),
  t(76302,3,2,0),t(76302,7,2,0),t(76497,1,2,0),t(76497,5,2,0),
  t(76691,3,2,0),t(76691,7,2,0),t(77275,3,4,0),t(77664,5,4,0),
  t(78248,7,3,0),h(78443,5,4,79026,0,[[78443,5,4],[78734,7,1],[79026,5,4]]),t(79221,6,4,0),t(79805,5,3,0),
  t(79999,3,4,0),t(80388,1,3,0),t(80778,3,4,0),t(81361,5,3,0),
  t(81556,3,4,0),f(81945,5,3),t(82334,3,4,0),s(82918,84183,[[82918,3,2],[83016,3,2],[83113,4,2],[83210,4,2],[83307,4,3],[83405,4,3],[83502,3,3],[83599,3,3],[83697,3,3],[83794,3,3],[83891,3.5,2],[83989,3,2],[84086,3,2],[84183,3,2]]),
  t(83307,3,4,0),t(83502,0,3,0),t(84280,3,4,0),t(84475,6,4,0),
  t(84475,1,3,0),t(84670,3,4,0),t(85059,0,3,0),t(85253,0,4,0),
  t(85448,0,2,0),t(85448,4,2,0),t(85837,1,2,0),t(85837,5,2,0),
  t(86226,3,2,0),t(86226,7,2,0),t(86616,4,2,0),t(86616,8,2,0),
  t(87005,2,2,0),t(87199,0,3,0),f(87394,2,2),t(87783,3,3,2),
  t(88172,1,4,0),t(88951,0,4,0),t(89145,1,3,0),h(89729,3,4,91286,1),
  t(90118,7,3,0),t(90508,7,3,0),t(90897,1,3,0),t(91675,7,3,0),
  t(92064,1,3,0),t(92454,6,4,0),t(92843,1,4,0),t(92843,7,3,0),
  t(93232,0,4,0),t(93816,1,4,0),f(94010,3,4),t(94400,5,4,0),
  t(94594,6,4,0),t(94789,5,4,0),t(94983,3,4,0),t(95178,1,3,0),
  t(95567,0,4,0),t(95762,0,6,0),t(95956,1,3,0),t(96346,1,3,0),
  t(96735,3,3,0),t(97124,3,3,0),t(97513,7,3,0),t(97902,5,3,0),
  t(98681,3,4,0),t(98875,1,4,0),t(99070,0,3,0),f(99459,1,3),
  t(99848,5,3,0),t(100237,2,3,0),t(100237,7,3,0),t(100627,1,3,0),
  t(101016,0,3,0),t(101600,1,3,0),h(101794,3,4,102573,1),t(102183,7,3,0),
  s(102962,104519,[[102962,2,3],[103546,2,2],[104032,2.5,2],[104227,4,2],[104324,3.5,2],[104519,3.5,2]]),t(103351,0,4,0),t(103740,1,3,0),t(104129,3,4,0),
  t(104713,1,3,0),t(104908,5,4,0),t(104908,0,3,0),h(105297,3,3,106854,1),
  t(105686,1,3,0),f(106075,0,3),t(107243,1,4,0),t(107632,0,3,0),
  t(108411,1,4,0),s(109189,110259,[[109189,1.5,3],[109481,1,2],[109578,1,2],[109967,3,2],[110162,3,2],[110259,3,2]]),s(109870,110259,[[109870,1,2],[110259,0,2]]),t(110940,1,4,0),
  t(111330,5,4,0),t(111524,3,3,0),t(111913,7,3,0),s(112303,113373,[[112303,4,2],[112594,2,2],[112886,0,2],[113178,1,2],[113373,1.5,2]]),
  h(113665,6,4,114054),t(114249,5,4,0),t(114638,3,4,0),h(115416,5,3,115903),
  h(116195,6,4,116681,1),t(117168,3,4,0),t(117557,6,4,0),f(117751,3,3),
  h(118140,6,4,118919),t(118530,3,4,0),s(119308,120865,[[119308,0.5,3],[119892,0.5,2],[120378,1.5,2],[120670,1.5,2],[120865,1.5,2]],1),t(119697,2,3,0),
  t(119892,3,4,0),t(120086,5,4,0),t(120476,6,4,0),t(121643,5,4,0),
  t(122422,5,3,0),t(122811,5,4,0),h(123103,5,3,123784),t(123978,0,3,0),
  f(124368,3,4),t(124951,7,3,0),t(124951,2,3,0),t(125146,3,4,0),
  s(125341,126800,[[125341,2,3],[125438,2,3],[125827,1.5,2],[126216,2,2],[126703,0.5,2],[126800,0.5,2]]),t(125924,3,6,0),t(126314,0,2,0),t(126897,1,4,0),
  h(127092,5,1,128454,0,[[127092,5,1],[127481,4,2],[127773,4,3],[128162,4,3],[128454,3,4]]),t(127481,7,3,0),t(127676,5,3,0),t(128649,3,3,0),
  t(129038,0,4,0),t(129233,3,4,0),t(129427,7,3,0),t(129816,3,4,3),
  t(130206,0,4,0),t(130400,1,4,0),f(130595,5,4),t(131568,5,4,0),
  t(131762,5,4,0),t(131957,7,3,0),t(132152,6,4,0),t(132541,5,3,0),
  t(132930,1,4,0),t(132930,7,3,0),t(133125,1,4,0),t(133319,0,4,0),
  t(134098,1,4,0),t(134487,0,4,0),t(134876,1,3,0),t(135265,0,4,0),
  t(135557,1,3,0),t(135654,3,3,0),t(135849,1,3,0),t(136044,0,4,0),
  t(136238,1,3,0),t(136433,0,3,0),t(136627,1,3,0),f(136822,0,4),
  t(137600,5,4,0),t(137795,1,3,0),t(137989,3,3,0),t(138379,0,4,0),
  t(138962,1,4,0),t(139157,3,4,0),t(139546,5,3,0),t(139935,6,4,0),
  t(139935,1,3,0),t(140325,7,3,0),t(140519,5,3,0),t(140714,3,4,0),
  h(140908,5,4,141687),f(141881,3,3),t(142271,5,4,0),h(142465,1,4,143244),
  t(142854,6,4,0),t(143438,5,4,0),t(143827,3,4,0),t(144217,1,3,0),
  t(144411,0,3,0),h(144606,1,4,145482,0,[[144606,1,4],[145092,2,3],[145482,3,1]]),t(144995,0,3,0),s(145773,146552,[[145773,1.5,3],[145871,1,3],[145968,1,2],[146260,0,2],[146357,0,2],[146552,0,2]]),
  s(145773,146552,[[145773,4,2],[146552,2,2]]),t(146746,5,3,0),t(146941,7,3,0),t(147136,5,3,0),
  t(147136,0,3,0),s(148109,149665,[[148109,0.5,3],[148206,2.5,3],[148303,2.5,3],[148400,2.5,3],[148498,2.5,2],[148595,2.5,2],[148692,0.5,2],[148790,0.5,2],[148887,0.5,2],[148984,2.5,2],[149082,2.5,2],[149179,2.5,2],[149276,2.5,2],[149373,0.5,2],[149471,0.5,2],[149568,0.5,2],[149665,2.5,2]],1),t(148498,1,6,0),f(148887,6,4),
  t(150055,3,4,0),t(150444,5,4,0),s(150833,152390,[[150833,3,3],[150930,3,3],[151028,1,2],[151125,1,2],[151222,1,2],[151319,3,2],[151417,3,2],[151514,3,2],[151611,3,2],[151709,3,2],[151806,1,2],[151903,1,2],[152001,1,2],[152098,2.5,2],[152195,2.5,2],[152292,3,3],[152390,3,3]],1),t(151222,5,4,0),
  t(152779,5,4,0),t(153168,6,4,0),t(153557,1,4,0),t(154336,3,4,0),
  t(154725,5,4,0),t(155114,6,4,0),t(155503,5,4,0),t(155893,6,4,0),
  t(156282,5,4,0),t(156671,6,4,0),f(157449,6,4),s(158228,159784,[[158228,2,3],[158422,2,3],[158714,2,2],[158811,2,2],[159201,2,2],[159784,0,2]]),
  t(158617,7,3,0),t(158811,6,4,0),t(159006,5,3,0),t(159395,4,3,0),
  t(159979,2,2,0),t(159979,6,2,0),s(160174,161147,[[160174,1.5,3],[160271,2.5,3],[160368,3,3],[160466,3,2],[160563,3,2],[160660,3,2],[160757,3,2],[160855,4,2],[160952,4,2],[161049,3.5,2],[161147,3.5,2]]),t(161244,1,4,0),
  t(161341,3,3,0),t(161536,1,4,0),t(161730,3,3,0),t(162120,1,3,0),
  t(162314,0,3,0),t(162509,1,4,0),t(162703,0,3,0),s(162898,164358,[[162898,3,3],[162995,3,3],[163093,3,3],[163190,3,3],[163287,2,2],[163385,2,2],[163482,3,2],[163579,3,2],[163676,2,2],[163774,2,2],[163871,2,2],[163968,2,2],[164066,2,2],[164163,1.5,2],[164260,1,2],[164358,1,2]]),
  t(163287,5,3,0),t(163482,2,4,0),t(163676,5,3,0),f(163871,5,3),
  t(164455,3,4,0),t(164747,5,4,0),t(164844,3,3,0),t(165039,1,3,0),
  t(165233,0,4,0),t(165428,0,3,0),t(165622,1,4,0),s(165817,166790,[[165817,2,3],[165914,0,3],[166012,0,3],[166109,0,2],[166401,0,2],[166790,1,2]]),
  s(165817,166790,[[165817,4,2],[166790,3,2]]),t(166985,0,3,0),t(166985,5,3,0),t(167179,1,4,0),
  s(167374,168249,[[167374,2,2],[167471,3,2],[167568,2,2],[167666,2,3],[167763,2,3],[167860,2,3],[167958,1.5,3],[168055,1,2],[168152,1.5,2],[168249,0.5,2]]),f(167763,0,4),t(168347,3,4,0),t(168541,7,3,0),
  t(168736,5,4,0),t(168931,6,4,0),t(169125,5,3,0),t(169320,4,6,0),
  t(169514,5,3,0),t(169904,3,3,0),t(170098,1,3,0),t(170293,0,4,0),
  t(170487,1,4,0),t(170682,3,4,0),t(170877,5,4,0),t(170974,6,4,0),
  t(171071,3,4,0),t(171266,6,1,0),h(171460,3,4,173017),f(171850,5,4),
  t(172239,6,4,4),t(173309,6,4,0),t(173309,1,3,0),t(173601,6,4,0),
  t(173796,6,4,0),t(173990,5,3,0),t(174087,6,4,0),t(174379,6,4,0),
  t(174574,6,4,0),t(174769,7,3,0),f(175352,7,3),t(175742,5,3,0),
  t(176033,3,4,0),t(176131,5,3,0),t(176325,1,3,0),t(176520,3,4,0),
  t(176714,5,3,0),t(176909,7,3,0),t(177298,3,3,0),t(177687,5,3,0),
  t(177882,6,4,0),t(178077,5,4,0),t(178466,7,3,0),t(178660,5,3,0),
  t(178660,0,3,0),t(178855,3,4,0),t(179050,5,3,0),t(179244,3,3,0),
  t(179439,5,3,0),t(179633,6,4,0),t(179828,5,3,0),f(180023,5,3),
  h(180412,6,1,181190,0,[[180412,6,1],[180801,5,4],[181190,6,1]]),t(180801,8,2,0),t(181385,7,3,0),t(181579,5,4,0),
  t(181774,1,3,0),t(181969,3,4,0),t(182163,0,4,0),t(182358,3,3,0),
  t(182747,1,4,0),t(182942,3,4,0),t(183136,1,3,0),t(183331,0,4,0),
  t(183525,0,4,0),t(183720,3,3,0),t(183915,4,6,0),t(184109,2,3,0),
  t(184109,7,3,0),f(184304,5,4),t(184693,5,3,0),t(184888,7,3,0),
  t(185082,6,4,0),t(185277,8,1,0),t(185471,6,4,0),t(185666,6,4,0),
  t(185861,6,4,0),t(186055,7,3,0),t(186250,5,4,0),t(186834,6,4,0),
  t(187028,5,4,0),t(187417,0,4,0),f(187807,1,3),s(188098,189266,[[188098,0,2],[189266,1,2]]),
  t(188974,5,3,0),t(189169,7,3,0),h(189363,5,3,189947),t(190142,5,3,0),
  t(190336,6,4,0),t(190531,7,3,0),t(190726,5,3,0),t(190726,0,3,0),
  t(190920,1,3,0),t(191115,3,4,0),t(191309,0,4,0),t(191504,0,4,0),
  t(191699,1,4,0),t(191893,3,4,0),t(192088,5,4,0),h(192282,5,3,193547),
  t(192672,7,3,0),t(192866,3,4,0),f(193061,1,4),t(193645,0,4,0),
  t(193839,3,3,0),t(194034,1,3,0),t(194423,5,4,0),h(194618,5,4,195493,0,[[194618,5,4],[195104,7,1],[195493,5,4]]),
  t(195007,4,3,0),t(195591,6,4,0),t(195785,7,3,0),t(195980,5,3,0),
  t(195980,0,3,0),h(196174,5,3,196855),t(196953,7,3,0),f(197147,7,3),
  t(197536,5,4,0),t(197731,1,3,0),t(197926,3,3,0),t(198120,0,3,0),
  t(198315,1,4,0),t(198509,3,4,0),t(198704,1,4,0),t(198996,1,4,0),
  t(199093,0,4,0),t(199288,1,4,0),t(199482,3,4,0),t(199872,5,4,0),
  t(200261,1,3,0),t(200650,0,6,0),t(200845,1,4,0),f(201039,0,4),
  t(201428,1,4,0),t(201623,0,3,0),t(201818,1,3,0),t(202012,0,4,0),
  t(202207,1,3,0),t(202207,6,3,0),t(202401,0,4,0),t(202596,1,4,0),
  t(202791,0,4,0),t(202985,1,4,0),t(203180,0,4,0),f(203374,1,3),
  t(203764,0,4,0),t(203958,0,3,0),t(204153,0,4,0),t(204347,0,4,0),
  t(204542,0,4,0),t(204737,3,4,0),t(204931,6,4,0),t(205126,4,1,0),
  t(205223,0,4,0),t(205320,1,4,0),t(205515,1,3,0),t(205710,0,3,0),
  t(205904,0,3,0),t(206099,0,4,0),t(206293,1,3,0),t(206488,1,4,0),
  t(206488,7,3,0),f(206877,1,4),t(207461,0,3,0),t(207656,1,4,0),
  t(207850,0,3,0),t(208045,1,3,0),t(208239,0,4,0),t(208434,1,4,0),
  t(208629,3,3,0),t(208726,5,3,0),t(208823,1,3,0),t(209018,6,1,0),
  t(209212,3,4,0),t(209407,6,4,0),h(209602,4,1,210769,0,[[209602,4,1],[209991,3,3],[210380,3,3],[210769,4,1]]),t(209991,8,2,0),
  t(210380,6,1,0),t(210964,8,1,0),t(211158,5,4,0),t(211450,6,4,0),
  t(211742,5,4,0),t(211937,3,4,0),t(212326,1,4,0),t(212521,5,4,0),
  t(212521,0,3,0),f(213494,3,4),t(213883,0,4,0),t(214077,3,4,0),
  t(214272,6,4,0),t(214564,3,4,0),t(214856,0,6,0),
// </eiki-boss-remix-v3-master-notes>
])(mhTap,mhHoldV2,mhFlick,mhSlideV2);
// Stay With Me ～Locked Fate～ remix（全尺3分19秒）。譜面はV3パイプラインが入れる。
const PANDORA_BOSS_REMIX_DURATION_MS=199480;
const pandoraBossRemixEasyNotes=((t,h,f,s)=>[
// <pandora-boss-remix-v3-easy-notes>
  t(2308,1,4,0),t(3792,0,4,0),t(5276,1,4,0),t(6760,3,4,0),
  t(7502,1,4,0),t(8244,0,4,0),t(9357,1,4,0),t(9728,3,4,0),
  t(10841,7,3,0),t(10841,0,3,0),t(11583,0,10,0),t(12696,3,4,0),
  h(13438,6,3,14922,0,[[13438,6,3],[13809,5,4],[14180,5,4],[14551,4,6],[14922,4,6]]),t(16406,3,4,0),h(16592,2,6,17705),t(19189,0,6,0),
  t(19375,2,6,0),t(19746,5,4,0),t(19931,4,6,0),t(21601,4,6,0),
  t(21972,4,6,0),t(23456,3,4,0),t(23641,4,6,0),t(25867,6,4,0),
  t(29949,5,4,0),t(30320,6,4,0),t(32175,5,4,0),t(32917,6,4,0),
  t(33659,5,4,0),t(34401,7,3,0),t(35514,1,4,0),t(35885,3,4,0),
  t(36441,5,4,0),t(36627,6,4,0),t(38667,5,4,0),t(38853,3,4,0),
  t(39410,1,4,1),t(40337,0,6,0),h(40708,1,4,41728),t(42563,3,4,0),
  t(44047,5,4,0),t(44418,3,4,0),t(44604,5,4,0),t(45346,0,3,0),
  t(45346,7,3,0),t(46088,1,4,0),t(46830,3,4,0),t(47572,1,4,0),
  h(48314,3,4,49520),t(49798,5,4,0),t(50169,0,10,0),t(51282,3,4,0),
  t(51653,4,6,0),h(52766,3,4,53972),t(54065,1,4,0),t(55363,0,6,0),
  t(55734,1,4,0),h(56476,3,4,57404),t(58331,3,4,0),t(59073,4,6,0),
  h(59815,4,6,61300,0,[[59815,4,6],[60186,4,6],[60557,6,4],[60929,6,4],[61300,7,3]]),t(62227,4,6,0),t(62598,4,6,0),t(62784,4,6,0),
  t(64268,3,4,0),t(64824,5,4,0),t(67236,4,6,0),t(68720,4,6,0),
  t(69091,6,4,0),t(70204,5,4,0),t(70575,5,4,0),t(72801,3,4,0),
  t(75955,1,3,0),t(76697,1,4,0),t(79850,0,4,2),t(80407,1,4,0),
  t(80963,0,3,0),t(80963,7,3,0),t(81334,5,4,0),t(82633,6,4,0),
  t(84303,5,4,0),t(84674,6,4,0),t(87642,5,4,0),t(88755,0,10,0),
  t(89126,5,4,0),t(90053,6,4,0),t(92094,6,4,0),t(93021,6,4,0),
  t(93393,6,4,0),t(94506,6,4,0),h(95433,6,4,96175),t(97659,6,4,0),
  t(98587,5,4,0),t(102297,3,4,0),t(102853,3,4,0),t(103224,5,4,0),
  t(103595,5,4,0),t(104338,6,4,0),t(104523,4,6,0),t(105080,6,4,0),
  t(105822,5,4,0),t(106935,2,6,0),t(107120,4,6,0),t(107677,6,4,0),
  t(108790,6,4,0),h(109161,6,4,110645),h(111572,6,3,113056,0,[[111572,6,3],[111943,5,4],[112314,4,6],[112685,5,4],[113056,6,3]]),t(113798,5,4,0),
  t(114169,6,4,0),t(115097,3,4,0),t(115283,0,6,0),t(115839,0,10,0),
  t(116210,0,3,0),t(116210,7,3,0),t(116952,0,4,0),t(117323,1,4,0),
  t(118436,0,4,3),t(118807,1,4,0),t(118993,0,4,0),t(119920,0,4,0),
  t(120291,1,4,0),t(120662,0,4,0),t(121775,0,4,0),t(122146,1,4,0),
  t(122888,3,4,0),t(123259,5,4,0),t(123630,6,4,0),t(124187,5,4,0),
  t(124743,3,4,0),t(125114,1,4,0),t(125485,0,4,0),t(125857,1,4,0),
  t(126599,3,4,0),t(127341,4,6,0),t(127712,6,4,0),t(128454,5,4,0),
  t(128825,3,4,0),h(129196,1,4,130680),t(131051,0,4,0),h(131793,1,4,133277),
  t(133648,0,3,0),t(133648,7,3,0),h(134019,0,4,135503),t(135874,0,4,0),
  t(137358,1,4,0),t(139584,3,4,0),t(140512,4,6,0),t(141439,3,4,0),
  t(142552,0,6,0),t(143665,0,6,0),t(144036,0,6,0),t(145520,2,6,0),
  t(146633,5,4,0),t(147004,0,10,0),t(147376,3,4,0),t(147561,3,4,0),
  t(149231,0,4,0),t(149602,0,4,0),t(149973,0,4,0),t(150344,0,4,0),
  t(150715,0,4,0),t(151457,0,4,0),t(151828,0,4,0),t(152199,0,4,0),
  h(152941,0,6,153776,0,[[152941,0,6],[153405,2,3],[153776,0,6]]),t(154054,1,4,0),t(154425,2,6,0),t(154796,1,4,0),
  t(155167,0,4,0),h(155538,1,4,156651),t(157764,3,4,4),t(159063,5,4,0),
  t(159248,6,4,0),t(160361,3,4,0),t(160547,5,4,0),t(161103,7,3,0),
  t(161103,0,3,0),t(161474,5,4,0),t(161845,3,4,0),t(162216,5,4,0),
  t(162587,3,4,0),t(163329,5,4,0),t(163700,3,4,0),t(164071,3,4,0),
  t(165184,1,4,0),t(165555,2,6,0),t(165741,4,6,0),t(166668,0,10,0),
  t(167039,5,4,0),t(167410,6,4,0),t(167781,6,4,0),t(168152,5,4,0),
  t(168523,6,4,0),t(169266,5,4,0),t(169451,6,4,0),t(170008,6,4,0),
  t(170379,6,4,0),t(171492,6,4,0),t(171863,5,4,0),t(172234,6,4,0),
  t(172605,4,6,0),t(172976,4,6,0),t(173347,3,4,0),t(174089,1,4,0),
  t(174460,0,4,0),t(175202,1,4,0),t(175573,3,4,0),t(175944,5,4,0),
  t(177057,0,3,0),t(177057,7,3,0),t(178170,0,6,0),t(178541,0,4,0),
  t(178912,1,4,0),t(180025,0,4,0),h(180396,1,3,181880,0,[[180396,1,3],[180767,0,6],[181138,1,3],[181509,0,6],[181880,1,3]]),t(182808,0,6,0),
  t(182993,3,4,0),t(185034,5,4,0),t(186703,6,4,0),t(188744,4,6,0),
  t(189671,3,4,0),t(190785,0,10,0),t(191156,1,4,0),t(193011,3,4,0),
  t(194866,5,4,0),t(196350,6,4,0),
// </pandora-boss-remix-v3-easy-notes>
])(mhTap,mhHoldV2,mhFlick,mhSlideV2);
const pandoraBossRemixNormalNotes=((t,h,f,s)=>[
// <pandora-boss-remix-v3-normal-notes>
  f(2308,5,3),t(3792,6,4,0),t(5276,3,3,0),t(5832,7,3,0),
  t(6760,3,4,0),t(7502,5,4,0),t(8244,6,4,0),t(9357,5,4,0),
  t(10841,0,3,0),t(10841,7,3,0),t(11212,7,3,0),t(11212,0,3,0),
  t(11583,0,10,0),t(12696,1,4,0),h(13438,4,2,14922,1,[[13438,4,2],[13809,4,3],[14180,3,4],[14551,3,4],[14922,2,6]]),t(16406,1,4,0),
  h(16592,4,6,17705),t(17891,6,4,0),t(19189,4,6,0),f(19375,4,6),
  t(19746,5,3,0),t(19931,4,6,0),t(21044,5,3,0),t(21601,4,6,0),
  t(21972,4,6,0),t(23456,3,4,0),t(23641,4,6,0),t(25867,6,4,0),
  t(29207,1,4,0),t(29949,5,4,0),t(30320,3,4,0),t(32175,1,4,0),
  t(32917,3,4,0),t(33659,5,4,0),t(34401,8,2,0),t(35143,3,3,0),
  f(35514,5,4),t(35885,3,4,0),t(36441,5,3,0),t(36627,6,4,0),
  t(38667,5,4,0),t(38853,3,4,0),t(39410,1,3,1),t(40337,0,6,0),
  h(40708,1,3,41728),t(42563,3,3,0),t(44047,1,4,0),t(44418,0,4,0),
  t(44604,1,4,0),t(45346,0,4,0),t(46088,0,4,0),t(46830,1,4,0),
  t(47572,3,4,0),f(47757,5,4),h(48314,6,4,49520),t(49798,0,4,0),
  t(50169,0,10,0),t(50540,6,4,0),t(50911,2,6,0),t(51282,0,4,0),
  t(51653,2,6,0),h(52766,4,6,53972,0,[[52766,4,6],[53137,5,4],[53601,6,3],[53972,6,2]]),t(54065,6,4,0),t(54250,4,6,0),
  t(54621,3,4,0),t(55363,0,6,0),t(55734,0,3,0),t(57218,0,3,0),
  t(57218,7,3,0),t(58146,0,4,0),f(58331,1,4),t(59073,0,6,0),
  h(59815,1,4,61300),t(62227,2,6,0),t(62598,2,6,0),t(62784,2,6,0),
  t(64268,3,3,0),t(64824,5,4,0),t(65195,1,4,0),t(67236,0,6,0),
  t(68720,0,6,0),t(69091,5,4,0),t(69462,1,3,0),t(70204,5,4,0),
  t(70575,1,4,0),t(72801,3,4,0),t(75955,6,2,0),f(76697,6,4),
  t(79850,1,4,2),t(80407,3,3,0),t(80963,5,4,0),t(81334,7,3,0),
  t(82633,5,4,0),t(84303,3,4,0),t(84674,0,3,0),t(84674,7,3,0),
  t(87642,1,4,0),t(88755,0,10,0),t(89126,6,4,0),t(90053,7,3,0),
  t(91723,5,4,0),t(92094,6,4,0),t(93021,5,4,0),t(93393,7,3,0),
  f(94506,5,4),h(95433,4,2,96175,0,[[95433,4,2],[95804,2,6],[96175,4,2]]),t(97659,1,4,0),t(98587,3,3,0),
  t(102297,1,3,0),t(102853,3,4,0),t(103224,5,4,0),t(103410,4,6,0),
  t(103595,5,4,0),t(104338,6,4,0),t(104523,4,6,0),t(104709,6,4,0),
  t(105080,3,4,0),t(105822,6,4,0),t(106378,3,4,0),t(106935,4,6,0),
  t(107120,4,6,0),f(107677,5,4),t(108604,2,6,0),t(108790,7,3,0),
  t(108790,0,3,0),h(109161,1,4,110645),h(111572,0,6,113056),t(113613,1,3,0),
  t(113798,3,4,0),t(114169,1,4,0),t(115097,5,4,0),t(115283,2,6,0),
  t(115839,0,10,0),t(116210,0,4,0),t(116581,1,4,0),t(116952,3,4,0),
  t(117323,1,4,0),t(118436,0,4,3),t(118807,1,4,0),t(118993,3,4,0),
  f(119178,5,4),t(119920,6,4,0),t(120291,5,4,0),t(120662,6,4,0),
  t(121775,3,4,0),t(122146,6,4,0),t(122888,3,4,0),t(123259,6,4,0),
  t(123630,1,4,0),t(124001,4,6,0),t(124187,3,4,0),t(124743,6,4,0),
  t(125114,3,4,0),t(125485,7,3,0),t(125485,0,3,0),t(125857,3,4,0),
  f(126599,5,4),h(126970,4,6,128083,1,[[126970,4,6],[127341,7,3],[127712,7,3],[128083,4,6]]),t(128454,3,4,0),t(128825,1,4,0),
  h(129196,3,4,130680),t(131051,1,4,0),h(131793,3,4,133277),t(133648,5,4,0),
  h(134019,5,4,135503),t(135874,6,4,0),t(137358,5,3,0),t(139028,3,3,0),
  t(139584,7,3,0),t(140512,4,6,0),t(141439,3,4,0),t(142552,0,6,0),
  t(143665,0,6,0),f(144036,0,6),t(145149,0,6,0),t(145520,0,10,0),
  t(146633,0,4,0),t(147004,0,6,0),t(147376,5,4,0),t(147561,3,4,0),
  t(147747,1,4,0),t(148489,0,4,0),t(149231,0,3,0),t(149231,7,3,0),
  t(149602,1,4,0),t(149973,0,4,0),t(150344,1,4,0),t(150715,3,4,0),
  t(151457,0,4,0),t(151828,3,4,0),t(152199,6,4,0),f(152570,3,4),
  h(152941,4,6,153776),t(154054,3,4,0),t(154425,2,6,0),t(154796,5,4,0),
  t(155167,5,4,0),h(155538,7,2,156651,0,[[155538,7,2],[155909,6,4],[156280,6,4],[156651,7,2]]),t(157393,5,4,4),t(157764,5,4,0),
  t(159063,3,4,0),t(159248,5,4,0),t(160361,3,4,0),t(160547,0,4,0),
  t(160732,3,4,0),t(161103,6,4,0),t(161474,3,4,0),h(161845,0,4,162587),
  f(163329,5,4),t(163700,3,4,0),t(164071,1,4,0),t(164813,0,3,0),
  t(164813,7,3,0),t(165184,1,4,0),t(165555,0,6,0),t(165741,0,10,0),
  t(165926,0,4,0),t(166668,0,6,0),t(167039,0,4,0),t(167410,0,4,0),
  h(167781,0,4,168523),t(169266,5,4,0),t(169451,1,4,0),t(169637,3,4,0),
  t(170008,0,4,0),f(170379,0,4),t(170750,0,4,0),t(171492,1,4,0),
  t(171863,1,4,0),t(172234,0,4,0),t(172605,0,6,0),t(172976,4,6,0),
  t(173347,3,4,0),t(173718,1,4,0),t(174089,0,4,0),t(174460,1,4,0),
  t(174645,5,4,0),t(175202,3,4,0),t(175573,6,4,0),t(175944,5,4,0),
  t(177057,0,3,0),t(177057,7,3,0),f(177799,5,4),t(178170,2,6,0),
  t(178541,6,4,0),t(178912,5,4,0),t(180025,3,4,0),h(180396,7,2,181880,1,[[180396,7,2],[180767,7,3],[181138,6,4],[181509,6,4],[181880,4,6]]),
  t(182808,4,6,0),t(182993,6,4,0),t(185034,5,4,0),t(185219,5,4,0),
  t(186703,3,4,0),t(188744,0,6,0),t(189671,0,4,0),t(190785,0,10,0),
  t(191156,3,3,0),t(193011,5,4,0),t(194866,6,4,0),f(195979,5,4),
// </pandora-boss-remix-v3-normal-notes>
])(mhTap,mhHoldV2,mhFlick,mhSlideV2);
const pandoraBossRemixHardNotes=((t,h,f,s)=>[
// <pandora-boss-remix-v3-hard-notes>
  f(2308,1,3),t(2864,5,4,0),t(3792,6,4,0),t(4998,2,8,0),
  t(5276,5,3,0),t(5832,5,3,0),t(6760,1,4,0),t(7502,3,4,0),
  t(8244,5,4,0),t(8522,5,5,0),t(9357,5,4,0),t(9728,6,4,0),
  t(10841,1,4,0),t(10934,4,5,0),t(11212,0,4,0),t(11212,7,3,0),
  t(11583,5,5,0),t(12325,5,3,0),t(12696,6,4,0),s(13438,14922,[[13438,3,4],[13531,2.5,4],[13624,2.5,3],[13717,2.5,3],[13809,2.5,3],[13902,2.5,3],[13995,1,3],[14088,1,2],[14180,2,2],[14273,2,2],[14366,2.5,3],[14459,2,3],[14551,1,3],[14644,1,3],[14737,2,3],[14830,3,4],[14922,2.5,4]],1),
  h(15850,4,1,16499,0,[[15850,4,1],[16221,3,3],[16499,2,5]]),f(16592,5,5),t(17334,2,5,0),t(17519,5,5,0),
  t(17891,3,4,0),t(19189,0,5,0),t(19375,0,5,0),t(19560,2,5,0),
  t(19746,5,3,0),t(19931,5,5,0),t(20580,5,4,0),t(21044,1,3,0),
  t(21601,2,5,0),t(21972,4,5,0),t(22157,5,5,0),h(23085,5,3,23549),
  t(23641,5,5,0),t(25033,5,4,0),f(25218,6,4),t(25867,5,4,0),
  t(26888,3,4,0),t(27073,4,5,0),h(27259,3,4,27722),t(28557,0,5,0),
  t(29207,0,4,0),t(29670,1,4,0),t(29949,0,4,0),t(30320,1,4,0),
  t(30412,3,4,0),t(31154,5,4,0),t(31711,6,4,0),t(31711,0,3,0),
  t(32175,5,4,0),t(32824,6,4,0),t(33195,5,4,0),t(33659,6,4,0),
  t(34865,4,5,0),f(35514,6,4),t(35885,5,4,0),t(35978,2,8,0),
  t(36349,0,5,0),t(36441,3,3,0),t(36627,6,4,0),t(38575,5,3,0),
  t(38667,3,4,0),t(38853,1,4,0),t(39410,0,3,0),t(39595,0,5,0),
  t(40337,2,5,0),t(41357,0,5,0),t(41728,0,5,0),t(42285,0,5,0),
  t(42563,1,3,0),t(43398,1,4,0),t(44047,5,4,0),h(44418,3,4,44789),
  f(45346,5,4),t(45717,7,3,1),t(46088,3,4,0),t(46644,6,3,0),
  t(46644,0,3,0),t(46830,3,4,0),t(47572,5,4,0),t(47757,6,4,0),
  s(48314,49520,[[48314,3,4],[48407,3,4],[48499,3,3],[48592,3,3],[48685,1,3],[48778,1,3],[48870,3,2],[48963,3,2],[49056,3,3],[49149,2.5,3],[49241,2.5,3],[49334,2,3],[49427,1.5,4],[49520,2,4]]),t(49798,5,4,0),t(50169,2,5,0),t(50540,1,4,0),
  t(50726,0,4,0),t(50911,0,5,0),t(51282,3,4,0),t(51653,0,5,0),
  f(52395,5,3),h(52766,6,4,53972),t(54065,5,4,0),t(54250,2,5,0),
  t(54436,5,4,0),t(54621,3,4,0),t(55363,0,5,0),t(55734,0,3,0),
  t(56476,1,4,0),t(57218,3,3,0),h(57960,3,3,58610,1),t(59073,0,5,0),
  s(59815,61300,[[59815,3.5,3],[60094,2,3],[60372,1,3],[60650,1,3],[60929,1.5,3],[61207,1,3],[61300,0.5,3]]),t(62227,2,5,0),t(62598,2,8,0),t(62784,2,5,0),
  t(63897,0,5,0),t(64268,3,3,0),t(64824,5,4,0),t(65195,6,4,0),
  t(65195,0,3,0),f(65659,5,4),s(66030,67143,[[66030,3,4],[66215,2.5,4],[66401,2.5,3],[66587,2.5,3],[66772,2,3],[66958,1,2],[67050,1,2],[67143,1.5,2]]),t(67236,5,5,0),
  t(68256,0,4,0),t(68720,2,5,0),t(69091,6,4,0),t(69462,3,3,0),
  t(70204,0,4,0),t(70575,3,4,0),h(70946,5,5,72152,0,[[70946,5,5],[71317,6,4],[71781,7,2],[72152,8,1]]),t(72523,4,5,0),
  t(72801,3,4,0),t(72894,0,5,0),t(73636,0,5,0),t(74563,0,4,0),
  t(74749,0,5,0),t(74934,3,4,0),t(75491,4,5,0),f(76697,0,4),
  t(77346,3,4,0),t(77532,6,4,0),t(78459,2,5,0),t(78645,4,5,0),
  t(79016,3,4,0),t(79850,0,4,2),t(80407,2,3,0),t(80500,0,4,0),
  t(80871,1,4,0),t(80963,3,4,0),t(81334,6,3,0),t(81334,0,3,0),
  t(82355,2,5,0),t(82540,6,4,0),t(82633,3,4,0),s(83653,84674,[[83653,1,4],[83746,1,4],[83839,0,4],[83932,0,3],[84024,0,3],[84117,0,3],[84210,0,3],[84303,0,3],[84395,0,3],[84488,0,2],[84581,0,2],[84674,0,2]]),
  t(84952,0,4,0),t(85137,0,5,0),f(85508,1,4),t(86621,2,5,0),
  t(87363,4,5,0),t(87642,1,4,0),t(88755,0,5,0),t(89126,1,4,0),
  t(89590,1,8,0),t(89961,4,5,0),t(90703,0,5,0),t(91723,0,4,0),
  t(92094,3,4,0),t(92558,0,5,0),t(93021,5,4,0),t(93300,2,5,0),
  t(94227,1,4,0),t(94506,5,4,0),t(94969,3,4,0),t(95433,6,4,0),
  f(97103,5,4),t(97659,6,4,0),t(98587,5,3,0),t(99793,2,5,0),
  t(100071,6,4,0),t(102297,0,3,0),t(102853,0,4,0),t(102853,7,3,0),
  t(103224,3,4,0),t(103410,4,5,0),t(103595,6,4,0),t(103781,5,4,0),
  t(104338,3,4,0),t(104523,0,5,0),t(104709,3,4,0),t(105080,1,4,0),
  t(105265,0,4,0),t(105451,1,4,0),t(105822,0,4,0),f(106378,3,4),
  t(106749,1,4,0),t(106935,4,5,0),t(107120,2,5,0),t(107677,6,4,0),
  h(108604,6,1,109161,0,[[108604,6,1],[108882,4,5],[109161,6,1]]),s(109346,110645,[[109346,3,4],[109439,3,4],[109717,3,3],[110181,2,3],[110552,1,2],[110645,1,2]],1),s(111572,113056,[[111572,0.5,3],[111851,1,3],[112129,2.5,3],[112407,3,3],[112685,3,3],[112964,1.5,3],[113056,1,3]]),t(113613,0,3,0),
  t(113798,3,4,0),t(114169,6,4,0),t(114912,3,4,0),t(115097,0,4,0),
  t(115283,2,5,0),t(115654,0,4,0),t(115839,0,8,0),t(116210,1,4,0),
  t(116581,1,4,0),t(116952,0,4,0),t(116952,7,3,0),f(117323,3,4),
  t(117694,0,4,0),t(118065,1,4,0),t(118436,3,4,3),t(118807,5,4,0),
  h(118993,5,5,119642,0,[[118993,5,5],[119364,8,1],[119642,5,5]]),t(119920,6,4,0),t(120291,5,4,0),t(120662,3,4,0),
  t(121033,1,4,0),t(121775,0,4,0),t(121961,1,4,0),t(122146,3,4,0),
  t(122517,3,4,0),t(122888,0,4,0),t(123259,3,4,0),t(123630,6,4,0),
  t(124001,2,5,0),f(124187,0,4),t(124743,0,4,0),t(124929,1,4,0),
  t(125114,3,4,0),t(125485,5,4,0),t(125857,6,4,0),t(126228,5,4,0),
  t(126599,6,4,0),t(126970,5,4,0),t(127341,2,5,0),t(127712,1,4,0),
  h(128083,0,4,128917),s(129196,130680,[[129196,1,2],[129381,1.5,3],[129567,1.5,3],[129659,1.5,4],[129752,1,4],[129938,0,4],[130030,0,4],[130123,0,4],[130309,0.5,3],[130494,0.5,3],[130680,0.5,2]],1),t(131051,0,4,0),t(131051,7,3,0),
  t(131236,0,5,0),s(131793,133277,[[131793,2,2],[131886,2,3],[131978,3,3],[132071,4,3],[132164,4,3],[132257,4,4],[132349,3.5,4],[132442,3,4],[132535,3.5,4],[132628,3,4],[132720,3.5,4],[132813,3,4],[132906,3,3],[132999,3,3],[133091,3.5,3],[133184,3.5,3],[133277,3.5,2]]),t(133648,5,4,0),t(133833,6,4,0),
  s(134019,135503,[[134019,3,4],[134204,2,4],[134483,2,3],[134946,1.5,3],[135317,1,2],[135503,1,2]]),f(135874,3,4),t(136616,7,3,0),t(137358,5,3,0),
  h(137729,2,1,139213,0,[[137729,2,1],[138100,0,5],[138471,2,1],[138842,0,5],[139213,2,1]]),t(139584,0,3,0),h(140512,0,5,140975),t(141439,1,4,0),
  t(141810,0,4,0),t(142552,0,8,0),t(143665,2,5,0),t(144036,0,5,0),
  t(144222,3,4,0),t(144407,5,5,0),t(145149,2,5,0),t(145520,0,5,0),
  t(146633,0,4,0),f(147004,0,5),t(147376,3,4,0),t(147561,1,4,0),
  t(147747,3,4,0),t(147932,1,4,0),t(148489,0,4,0),t(148860,1,4,0),
  t(149231,5,4,0),t(149602,0,4,0),t(149602,7,3,0),t(149973,1,4,0),
  h(150344,0,4,150900),t(151086,1,4,0),t(151457,3,4,0),h(151828,3,4,152384),
  t(152570,5,4,0),h(152941,2,5,153776),t(153868,0,5,0),t(154054,1,4,0),
  f(154425,2,5),t(154796,5,4,0),t(154981,6,4,0),t(155167,5,4,0),
  h(155538,3,4,156651,1),t(157393,0,4,4),t(157764,3,4,0),t(158321,6,4,0),
  t(159063,3,4,0),t(159248,0,4,0),h(159805,5,1,161289,0,[[159805,5,1],[160176,4,2],[160547,4,3],[160918,3,4],[161289,3,5]]),t(161474,1,4,0),
  t(161845,3,4,0),t(162031,5,4,0),t(162216,6,4,0),t(162587,5,4,0),
  t(162773,3,4,0),t(163329,1,4,0),t(163700,3,4,0),f(164071,0,4),
  t(164442,0,4,0),t(164442,7,3,0),t(164813,6,4,0),t(165184,3,4,0),
  t(165555,0,8,0),t(165741,0,5,0),t(165926,1,4,0),t(166668,2,5,0),
  h(166854,4,5,167410),t(167596,6,4,0),t(167781,3,4,0),t(168152,5,4,0),
  t(168523,3,4,0),t(168895,5,4,0),t(169266,6,4,0),t(169451,5,4,0),
  t(169637,6,4,0),t(170008,5,4,0),f(170379,3,4),t(170750,1,4,0),
  s(171121,172605,[[171121,3.5,3],[171399,3.5,3],[171677,3.5,3],[171955,3,3],[172234,2,3],[172512,1,3],[172605,0.5,3]]),t(172976,0,5,0),t(173161,0,5,0),t(173347,1,4,0),
  h(173718,0,4,174460),t(174645,0,4,0),t(175202,3,4,0),t(175387,1,4,0),
  t(175573,5,4,0),t(175944,3,4,0),t(176315,6,4,0),t(177057,3,4,0),
  t(177799,6,4,0),t(177799,0,3,0),t(178170,2,5,0),t(178541,6,4,0),
  h(178912,3,5,179654,1,[[178912,3,5],[179283,4,3],[179654,5,1]]),f(180025,0,4),t(180396,1,4,0),s(180582,182066,[[180582,1,4],[180674,1,4],[180767,1,3],[180860,1,3],[180953,1,3],[181045,1,3],[181138,1,3],[181231,1,2],[181324,1,2],[181416,1,2],[181509,1,3],[181602,0,3],[181695,0,3],[181787,0,3],[181880,0,3],[181973,1,4],[182066,1,4]]),
  t(182251,1,4,0),t(182808,4,5,0),t(182993,3,4,0),t(185034,1,4,0),
  t(185219,3,4,0),t(185961,5,4,0),t(186703,6,4,0),t(188744,0,5,0),
  t(189486,5,4,0),t(189671,3,4,0),t(190785,0,8,0),t(191156,5,3,0),
  t(193011,6,4,0),t(193567,6,4,0),t(194866,5,4,0),f(195979,6,4),
// </pandora-boss-remix-v3-hard-notes>
])(mhTap,mhHoldV2,mhFlick,mhSlideV2);
const pandoraBossRemixExpertNotes=((t,h,f,s)=>[
// <pandora-boss-remix-v3-expert-notes>
  f(2308,1,3),t(2864,5,4,0),t(3792,6,4,0),t(4998,2,8,0),
  t(5276,5,3,0),t(5832,5,3,0),t(6760,0,4,0),t(6946,1,4,0),
  t(7502,3,4,0),t(8244,5,4,0),t(8522,5,5,0),t(9357,5,4,0),
  t(9728,6,4,0),t(10841,1,4,0),t(10934,4,5,0),t(11212,0,4,0),
  t(11212,7,3,0),t(11398,6,4,0),t(11583,4,5,0),f(12696,6,4),
  s(13438,14922,[[13438,4,4],[13531,3,4],[13624,3,3],[13717,3,3],[13809,3,3],[13902,3,3],[13995,2,3],[14088,2,2],[14180,3,2],[14273,3,2],[14366,3,3],[14459,3,3],[14551,2,3],[14644,2,3],[14737,3,3],[14830,4,4],[14922,3,4]],1),t(14180,3,3,0),t(14366,0,5,0),t(14551,0,5,0),
  t(15850,2,5,0),t(16406,0,4,0),s(16592,17705,[[16592,3.5,3],[16870,3,3],[17148,1,3],[17427,0.5,3],[17705,0.5,3]]),t(17148,7,3,0),
  t(17334,3,5,0),t(17891,0,4,0),t(19189,0,2,0),t(19189,4,2,0),
  t(19375,2,2,0),t(19375,6,2,0),t(19560,4,2,0),t(19560,8,2,0),
  t(19746,5,3,0),t(19931,5,5,0),t(20580,5,4,0),f(21044,3,3),
  t(21601,5,5,0),t(21972,2,5,0),t(22157,5,5,0),t(22899,2,5,0),
  h(23085,7,3,23549),t(23641,2,5,0),t(25033,1,2,0),t(25033,5,2,0),
  t(25218,3,2,0),t(25218,7,2,0),t(25404,1,2,0),t(25404,5,2,0),
  t(25867,3,4,0),t(26888,6,4,0),t(26888,0,3,0),h(27259,6,4,27722),
  h(28372,5,4,28836),t(29207,3,4,0),t(29670,1,4,0),t(29949,3,4,0),
  t(30320,1,4,0),f(30412,0,4),t(31154,1,4,0),t(31711,3,4,0),
  t(32175,1,4,0),t(32824,3,4,0),t(33195,5,4,0),t(33380,3,4,0),
  t(33659,1,4,0),t(34865,0,5,0),t(35514,1,4,0),t(35885,2,4,0),
  t(35978,0,5,0),t(36349,2,8,0),t(36441,3,3,0),t(36627,6,4,0),
  t(38575,5,3,0),t(38667,3,4,0),f(38853,1,4),t(39410,0,3,0),
  t(39595,0,5,0),t(40337,5,5,0),t(41357,4,5,0),t(41728,4,5,0),
  t(42285,4,5,0),t(42563,5,3,0),t(43398,0,4,0),t(43398,7,3,0),
  t(43769,1,4,0),t(44047,3,4,0),h(44418,1,4,44789),t(45346,0,2,0),
  t(45346,4,2,0),t(45717,2,2,0),t(45717,6,2,0),t(46088,4,2,0),
  t(46088,8,2,0),t(46644,3,3,0),t(46830,1,4,0),t(47572,3,4,0),
  f(47757,5,4),s(48314,49520,[[48314,2,4],[48407,2,4],[48499,2,3],[48592,2,3],[48685,0,3],[48778,0,3],[48870,2,2],[48963,2,2],[49056,2,3],[49149,1.5,3],[49241,1.5,3],[49334,1,3],[49427,0.5,4],[49520,1,4]]),s(48685,49520,[[48685,4,2],[49520,3,2]]),t(49798,1,2,0),
  t(49798,5,2,0),t(50169,3,2,0),t(50169,7,2,0),t(50540,1,2,0),
  t(50540,5,2,0),t(50911,4,5,1),t(51282,1,4,0),t(51653,2,5,0),
  t(52024,5,4,0),t(52395,7,3,0),h(52766,2,1,53972,0,[[52766,2,1],[53137,1,2],[53601,0,4],[53972,0,5]]),t(53137,0,1,0),
  t(53508,5,4,0),t(54065,3,4,0),t(54250,0,5,0),t(54436,3,4,0),
  f(54621,1,4),t(55178,5,4,0),t(55363,0,5,0),t(55734,6,3,0),
  t(55734,0,3,0),t(56476,3,4,0),t(57218,5,3,0),h(57960,3,3,58610,1),
  t(59073,2,5,0),t(59444,5,4,0),s(59815,61300,[[59815,4,3],[60094,2,3],[60372,1,3],[60650,1,3],[60929,1,3],[61207,0.5,3],[61300,0,3]]),t(60186,4,4,0),
  t(60557,3,4,0),t(62042,2,1,0),t(62227,0,5,0),t(62598,2,5,0),
  f(62784,2,5),t(63897,2,8,0),t(64268,7,3,0),t(64824,5,4,0),
  t(65195,6,4,0),t(65659,5,4,0),s(66030,67143,[[66030,3,4],[66215,2.5,4],[66401,2.5,3],[66587,2.5,3],[66772,2,3],[66958,0.5,2],[67050,0.5,2],[67143,1,2]]),t(66401,6,4,0),
  t(67236,2,5,0),t(68256,1,4,0),t(68720,2,5,0),t(68998,5,4,0),
  t(69091,6,4,0),t(69462,7,3,0),t(70204,5,4,0),t(70575,6,4,0),
  t(70575,0,3,0),h(70946,5,4,72152,1),t(72523,5,5,0),t(72801,5,4,0),
  f(72894,2,5),t(73636,0,5,0),t(74563,0,4,0),t(74749,0,5,0),
  t(74934,3,4,0),t(75491,0,5,0),t(76697,0,4,0),t(77161,1,4,0),
  t(77346,3,4,0),t(77532,5,4,0),t(78459,2,5,0),t(78645,4,5,0),
  t(79016,3,4,0),t(79850,0,4,2),s(80314,81242,[[80314,1.5,2],[80407,2.5,3],[80500,2.5,3],[80592,1,4],[80685,1,4],[80778,1,4],[80871,2.5,4],[80963,2.5,4],[81056,0.5,3],[81149,0.5,3],[81242,0.5,2]]),t(80871,0,4,0),
  f(81334,1,3),t(82355,0,5,0),t(82540,1,4,0),t(82633,0,4,0),
  s(83653,84674,[[83653,4,3],[83932,2,3],[84210,0.5,3],[84488,0,3],[84674,0.5,3]]),t(84303,2,4,0),t(84952,0,4,0),t(85508,1,4,0),
  t(86621,2,5,0),t(87363,4,5,0),t(87642,1,4,0),t(88755,2,5,0),
  t(89033,1,5,0),t(89126,0,4,0),t(89590,0,5,0),t(89961,2,5,0),
  t(90703,4,5,0),h(91074,2,5,91630,0,[[91074,2,5],[91352,3,3],[91630,4,1]]),f(91723,1,4),t(92094,5,4,0),
  t(92558,2,5,0),t(93021,6,4,0),t(93021,0,3,0),t(93300,4,5,0),
  t(94227,5,4,0),t(94506,6,4,0),t(95433,5,4,0),t(95897,2,8,0),
  h(96175,5,4,97103),t(97659,3,4,0),t(98587,1,3,0),t(99793,2,5,0),
  t(100071,6,4,0),t(102297,1,3,0),f(102853,3,4),t(103224,5,4,0),
  t(103410,5,5,0),t(103595,5,4,0),t(103781,6,4,0),t(104338,5,4,0),
  t(104523,2,5,0),t(104709,1,4,0),t(105080,3,4,0),t(105265,5,4,0),
  t(105451,3,4,0),t(105822,1,4,0),t(105914,5,4,0),t(106378,3,4,0),
  t(106749,6,4,0),t(106749,0,3,0),t(106935,2,5,0),t(107120,4,5,0),
  f(107677,1,4),h(108604,2,1,109161,0,[[108604,2,1],[108882,0,5],[109161,2,1]]),s(109346,110645,[[109346,3,4],[109439,3,4],[109717,3,3],[110181,1.5,3],[110552,1.5,2],[110645,1.5,2]],1),t(109903,1,4,0),
  t(110088,4,5,0),t(110274,3,5,0),t(111387,3,4,0),s(111572,113056,[[111572,0,3],[111851,0.5,3],[112129,2,3],[112407,3,3],[112685,2.5,3],[112964,0.5,3],[113056,0,3]]),
  t(112129,5,4,0),t(112314,2,5,0),t(113427,0,4,0),t(113613,3,3,0),
  t(113798,6,4,0),t(114169,3,4,0),t(114912,0,4,0),t(115097,3,4,0),
  t(115283,0,5,0),t(115654,3,4,0),t(115839,5,5,0),f(116210,3,4),
  t(116581,0,4,0),t(116767,2,5,0),t(116952,0,4,0),t(117323,3,4,0),
  t(117694,6,4,0),t(118065,3,4,0),t(118436,0,4,3),t(118807,0,4,0),
  t(118807,7,3,0),h(118993,0,4,119642),t(119735,0,4,0),t(119920,1,4,0),
  t(120291,1,4,0),t(120662,3,4,0),t(121033,3,4,0),t(121775,1,4,0),
  t(122146,5,4,0),f(122517,3,4),t(122888,0,4,0),t(123259,3,4,0),
  t(123445,6,4,0),t(123630,3,4,0),t(124001,0,8,0),t(124187,1,4,0),
  t(124558,2,5,0),t(124743,5,4,0),t(124929,6,4,0),t(125114,5,4,0),
  t(125485,3,4,0),t(125857,0,4,0),t(126228,3,4,0),t(126599,6,4,0),
  t(126970,3,4,0),t(127155,0,4,0),f(127341,2,5),t(127712,1,4,0),
  h(128083,5,5,128917,0,[[128083,5,5],[128546,7,1],[128917,5,5]]),t(128454,0,4,0),s(129196,130680,[[129196,1.5,2],[129381,2,3],[129567,1.5,3],[129659,1.5,4],[129752,1,4],[129938,0,4],[130030,0,4],[130123,0.5,4],[130309,0.5,3],[130494,0.5,3],[130680,0.5,2]],1),t(129567,4,4,0),
  t(129752,4,5,0),t(129938,6,4,0),t(130123,5,4,0),t(130309,6,4,0),
  t(131051,6,4,0),t(131051,0,3,0),t(131236,5,5,0),t(131607,5,4,0),
  s(131793,133277,[[131793,2,2],[131886,2,3],[131978,3.5,3],[132071,4,3],[132164,4,3],[132257,4,4],[132349,3.5,4],[132442,3.5,4],[132535,3.5,4],[132628,3.5,4],[132720,3.5,4],[132813,3.5,4],[132906,3.5,3],[132999,3.5,3],[133091,4,3],[133184,4,3],[133277,4,2]]),s(131793,133277,[[131793,0,2],[133277,2,2]]),t(133648,3,4,0),t(133833,1,4,0),
  s(134019,135503,[[134019,1.5,4],[134204,0,4],[134483,0,3],[134946,0,3],[135317,0,2],[135503,0,2]]),s(134390,135132,[[134390,4,2],[135132,2,2]]),t(135874,1,4,0),t(136616,3,3,0),
  t(137358,5,3,0),h(137729,1,3,139213),t(139584,0,3,0),h(140512,0,5,140975,1),
  t(141439,0,4,0),t(141810,0,4,0),t(142552,0,5,0),t(142738,0,4,0),
  t(142738,7,3,0),f(143665,4,5),t(144036,1,8,0),t(144407,0,5,0),
  t(145149,0,5,0),t(145520,0,5,0),t(145891,3,4,0),t(146633,6,4,0),
  t(147004,2,5,0),t(147376,6,4,0),t(147561,6,4,0),t(147747,5,4,0),
  t(147932,6,4,0),t(148489,5,4,0),t(148860,3,4,0),t(149045,0,5,0),
  t(149231,0,4,0),t(149602,1,4,0),f(149973,1,4),h(150344,0,4,150900),
  t(151086,1,4,0),t(151457,0,4,0),t(151642,0,4,0),h(151828,0,4,152384),
  t(152570,0,4,0),h(152941,2,5,153776),t(153312,1,4,0),t(153868,2,5,0),
  t(154054,5,4,0),t(154239,6,4,0),t(154425,4,5,0),t(154796,5,4,0),
  t(154981,6,4,0),t(155167,6,4,0),t(155167,0,3,0),h(155538,4,4,156651),
  t(155909,6,4,0),t(156094,5,4,0),f(156280,5,4),t(156744,6,4,0),
  t(157393,6,4,4),t(157764,6,4,0),t(158321,6,4,0),t(159063,5,4,0),
  t(159248,3,4,0),t(159341,1,4,0),h(159805,6,1,161289,0,[[159805,6,1],[160176,5,2],[160547,5,3],[160918,4,4],[161289,4,5]]),t(160361,0,1,0),
  t(160547,1,4,0),t(160732,3,4,0),t(161474,1,4,0),t(161845,0,4,0),
  t(162031,1,4,0),t(162216,0,4,0),t(162587,1,4,0),f(162773,1,4),
  t(163329,5,4,0),t(163515,3,4,0),t(163700,6,4,0),t(164071,1,4,0),
  t(164442,3,4,0),t(164813,5,4,0),t(165184,6,4,0),t(165555,2,8,0),
  t(165741,2,5,0),t(165926,1,4,0),t(166297,0,4,0),t(166668,2,5,0),
  h(166854,4,5,167410),t(167596,0,4,0),t(167596,7,3,0),f(167781,0,4),
  t(168152,1,4,0),t(168245,0,4,0),t(168523,1,4,0),t(168895,3,4,0),
  t(169266,1,4,0),t(169451,0,4,0),t(169637,1,4,0),t(170008,5,4,0),
  t(170379,3,4,0),t(170750,1,4,0),s(171121,172605,[[171121,1.5,4],[171306,1,4],[171584,1,3],[172048,1,3],[172605,0,2]],1),s(171121,172605,[[171121,4,2],[172605,2,2]]),
  t(172976,0,5,0),t(173161,0,5,0),f(173347,0,4),h(173718,1,4,174460),
  t(174089,0,4,0),t(174645,5,4,0),t(175202,1,4,0),t(175387,3,4,0),
  t(175573,0,4,0),t(175944,1,4,0),t(176315,3,4,0),t(176686,5,4,0),
  t(177057,6,4,0),t(177799,6,4,0),t(177799,0,3,0),t(178170,2,5,0),
  t(178541,1,4,0),h(178912,0,5,179654,0,[[178912,0,5],[179283,1,3],[179654,2,1]]),t(180025,0,4,0),t(180211,0,5,0),
  t(180396,3,4,0),s(180582,182066,[[180582,1.5,4],[180674,1,4],[180767,1,3],[180860,1,3],[180953,1,3],[181045,1,3],[181138,1,3],[181231,1,2],[181324,1,2],[181416,1,2],[181509,1,3],[181602,0,3],[181695,0,3],[181787,0,3],[181880,0,3],[181973,1,4],[182066,1.5,4]],1),s(180582,182715,[[180582,3,2],[182715,4,2]]),t(182808,4,5,0),
  f(182993,6,4),t(184292,5,4,0),t(185034,6,4,0),t(185219,3,4,0),
  t(186703,1,4,0),t(188002,5,4,0),t(188744,2,5,0),t(189486,1,4,0),
  t(189671,0,4,0),t(190785,0,8,0),t(191156,5,3,0),t(192454,1,4,0),
  t(193011,6,4,0),t(193567,1,4,0),t(194866,0,4,0),f(196350,0,4),
// </pandora-boss-remix-v3-expert-notes>
])(mhTap,mhHoldV2,mhFlick,mhSlideV2);
const pandoraBossRemixMasterNotes=((t,h,f,s)=>[
// <pandora-boss-remix-v3-master-notes>
  f(2308,2,2),t(2864,5,3,0),t(3792,7,3,0),t(4719,3,3,0),
  t(4998,4,6,0),t(5276,8,2,0),t(5832,6,2,0),t(6760,3,3,0),
  t(6946,5,3,0),t(7502,3,3,0),t(8244,5,3,0),t(8522,6,4,0),
  t(8708,5,4,0),t(9357,3,3,0),t(9543,5,3,0),t(9728,7,3,0),
  t(10841,1,3,0),t(10934,5,4,0),t(11212,2,3,0),t(11212,7,3,0),
  t(11398,7,3,0),f(11583,3,4),t(12325,6,2,0),t(12696,7,3,0),
  s(13438,14922,[[13438,2.5,3],[13531,1.5,3],[13624,1.5,2],[13717,1.5,2],[13809,1.5,2],[13902,1.5,2],[13995,0.5,2],[14088,0.5,2],[14180,1.5,2],[14273,1.5,2],[14366,1.5,2],[14459,1.5,2],[14551,0.5,2],[14644,0.5,2],[14737,1.5,2],[14830,2.5,3],[14922,1.5,3]],1),t(14180,5,2,0),t(14366,6,4,0),t(14551,3,4,0),
  t(15850,5,4,0),t(16221,3,3,0),t(16406,1,3,0),s(16592,17705,[[16592,1.5,3],[16685,1.5,3],[16777,1.5,2],[16870,1.5,2],[16963,0.5,2],[17056,0.5,2],[17148,0,2],[17241,0,2],[17334,0.5,2],[17427,0.5,2],[17519,0,2],[17612,0,3],[17705,0.5,3]]),
  s(16592,17705,[[16592,3,2],[17705,4,2]]),f(17891,5,3),h(18818,3,1,19467,0,[[18818,3,1],[19189,2,3],[19467,1,4]]),t(19560,3,4,0),
  t(19746,6,2,0),t(19931,6,4,0),t(20580,5,3,0),t(21044,8,2,0),
  t(21137,5,3,0),t(21601,6,4,0),t(21601,1,3,0),t(21786,3,4,0),
  t(21972,5,4,0),t(22157,6,4,0),t(22899,5,4,0),h(23085,4,2,23549),
  t(23641,6,4,0),t(25033,1,3,0),t(25218,3,3,0),t(25404,5,3,0),
  f(25867,7,3),t(26888,5,3,0),t(27073,3,4,0),h(27259,1,3,27722),
  h(28372,1,3,28836),t(28928,0,3,0),t(29207,1,3,0),t(29670,0,3,0),
  t(29949,3,3,0),t(30320,1,3,0),t(30412,0,3,0),t(31154,1,3,0),
  t(31711,2,3,0),t(31711,7,3,0),t(32175,5,3,0),t(32824,7,3,0),
  t(33009,4,6,0),t(33195,7,3,0),t(33380,5,3,0),f(33659,3,3),
  t(34123,1,4,0),t(34865,0,4,0),t(35514,1,3,0),t(35885,5,3,0),
  t(35978,3,4,0),t(36349,6,4,0),t(36441,4,2,0),t(36627,7,3,0),
  s(37091,38575,[[37091,3,2],[37276,3,2],[37462,3,2],[37647,3,3],[37833,2.5,3],[38018,4,3],[38111,4,3],[38204,3,2],[38389,2.5,2],[38575,1.5,2]]),t(38667,3,3,0),t(38853,0,3,0),t(39410,4,2,0),
  t(39595,6,4,0),t(39873,3,4,0),t(40337,0,4,0),f(40615,3,4),
  t(41357,1,4,0),t(41728,1,4,0),t(42285,1,4,0),t(42285,7,3,0),
  t(42563,2,2,0),t(43398,1,3,0),t(43769,0,3,0),t(44047,1,3,0),
  h(44418,0,3,44789,1),t(45346,1,3,1),t(45717,6,2,0),t(46088,5,3,0),
  t(46644,8,2,0),t(46737,5,3,0),t(46830,7,3,0),t(47572,3,3,0),
  f(47757,5,3),s(48314,49520,[[48314,2.5,3],[48407,2.5,3],[48499,2.5,2],[48592,2.5,2],[48685,0.5,2],[48778,0.5,2],[48870,2.5,2],[48963,2.5,2],[49056,2.5,2],[49149,2,2],[49241,2,2],[49334,1.5,2],[49427,1,3],[49520,1.5,3]]),t(48870,2,3,0),t(49056,1,3,0),
  h(49798,3,3,50262),t(50540,5,3,0),t(50726,7,3,0),t(50911,5,4,0),
  t(50911,0,3,0),t(51282,1,2,0),t(51282,5,2,0),t(51653,3,2,0),
  t(51653,7,2,0),t(52024,1,2,0),t(52024,5,2,0),t(52395,3,2,0),
  t(52395,7,2,0),t(52581,0,3,0),h(52766,3,3,53972),t(53137,6,4,0),
  f(53508,0,3),t(54065,0,3,0),t(54250,0,4,0),t(54436,1,3,0),
  t(54621,0,3,0),t(55178,1,3,0),t(55363,0,6,0),t(55549,1,3,0),
  t(55734,4,2,0),t(56105,1,3,0),t(56476,5,3,0),t(57218,8,2,0),
  h(57960,8,2,58610),t(59073,3,4,0),t(59444,5,3,0),t(59444,0,3,0),
  s(59815,61300,[[59815,1.5,3],[59908,1.5,3],[60001,0,3],[60094,0,3],[60186,0,2],[60279,0,2],[60372,0,2],[60465,0,2],[60557,0,2],[60650,0,2],[60743,0,2],[60836,0,2],[60929,0,2],[61021,0.5,2],[61114,0,2],[61207,0,2],[61300,0,2]],1),s(59815,61300,[[59815,4,2],[61300,2,2]]),t(62042,4,1,0),t(62227,0,4,0),
  t(62598,3,4,0),t(62784,6,4,0),t(63526,4,1,0),t(63897,0,4,0),
  t(64268,4,2,0),t(64824,5,3,0),t(65195,1,3,0),t(65659,0,3,0),
  s(66030,67143,[[66030,1.5,3],[66215,1,3],[66401,1,2],[66587,1,2],[66772,0.5,2],[66958,0,2],[67050,0,2],[67143,0,2]]),t(66401,3,3,0),t(67236,5,4,0),t(67700,1,4,0),
  t(68256,3,3,0),t(68720,0,4,0),t(68998,1,3,0),f(69091,0,3),
  t(69462,2,2,0),t(69462,6,2,0),t(70204,0,3,0),t(70575,0,3,0),
  h(70946,1,4,72152,0,[[70946,1,4],[71317,1,3],[71781,2,2],[72152,2,1]]),s(71224,71874,[[71224,4,2],[71874,3,2]]),h(72523,1,4,72987),t(73636,3,4,0),
  t(74378,0,2,0),t(74378,4,2,0),t(74563,1,2,0),t(74563,5,2,0),
  t(74749,3,2,0),t(74749,7,2,0),t(74934,4,2,0),t(74934,8,2,0),
  t(75305,5,3,0),t(75491,3,4,0),f(76697,1,3),t(77161,2,2,0),
  t(77161,6,2,0),t(77346,2,2,0),t(77346,7,2,0),t(77532,1,2,0),
  t(77532,7,2,0),t(77717,1,2,0),t(77717,8,2,0),t(78459,3,4,0),
  t(78645,5,4,0),t(79016,7,3,0),t(79850,2,3,0),t(79850,7,3,0),
  s(80314,81242,[[80314,3,2],[80407,4,2],[80500,4,2],[80592,2.5,3],[80685,2.5,3],[80778,2.5,3],[80871,4,3],[80963,4,3],[81056,2,2],[81149,2,2],[81242,2,2]]),t(80871,1,3,0),t(81334,8,2,2),s(82169,83004,[[82169,3,3],[82448,3.5,2],[82633,3.5,2],[82819,4,2],[82911,4,2],[83004,4,2]],1),
  t(82540,5,3,0),s(83653,84674,[[83653,4,2],[83932,2,2],[84210,0.5,2],[84488,0,2],[84674,0.5,2]]),t(84303,3,3,0),t(84952,1,3,0),
  t(85137,0,6,0),t(85323,1,3,0),f(85508,3,3),t(86621,1,4,0),
  t(87363,5,4,0),t(87642,1,3,0),t(88755,5,4,0),t(89033,3,4,0),
  t(89126,2,3,0),t(89219,0,4,0),t(89590,1,4,0),t(89961,3,4,0),
  h(91074,6,4,91630),t(91723,7,3,0),t(92094,7,3,0),t(92558,6,4,0),
  t(92558,1,3,0),t(93021,3,3,0),t(93300,6,4,0),f(93393,6,2),
  t(94227,0,3,0),t(94506,3,3,0),t(94969,7,3,0),t(95433,5,3,0),
  h(96175,8,1,97103,0,[[96175,8,1],[96453,7,3],[96824,7,3],[97103,8,1]]),t(97659,7,3,0),t(98587,8,2,0),t(99793,6,4,0),
  t(100071,7,3,0),t(102297,4,2,0),t(102853,5,3,0),t(102946,3,3,0),
  t(103224,1,3,0),t(103410,0,4,0),t(103595,1,3,0),f(103781,3,3),
  t(104152,5,3,0),t(104152,0,3,0),t(104338,7,3,0),t(104523,5,4,0),
  t(104709,3,3,0),t(105080,1,3,0),t(105265,0,3,0),t(105358,3,3,0),
  t(105451,1,3,0),t(105822,5,3,0),t(105914,3,3,0),t(106378,5,3,0),
  t(106749,7,3,0),t(106935,5,4,0),t(107120,1,4,0),f(107677,5,3),
  t(108419,3,3,0),h(108604,6,4,109161),s(109346,110645,[[109346,4,3],[109439,4,3],[109717,4,2],[110181,2.5,2],[110552,1.5,2],[110645,1.5,2]],1),t(109903,3,3,0),
  t(110088,0,6,0),t(110274,0,4,0),t(111387,0,3,0),t(111387,5,3,0),
  s(111572,113056,[[111572,1.5,2],[111758,1.5,2],[111943,1.5,2],[112129,2.5,3],[112314,2.5,3],[112500,3.5,3],[112685,2.5,2],[112871,1.5,2],[113056,1.5,2]]),s(112036,112685,[[112036,0,2],[112685,1,2]]),t(113427,0,3,0),h(113613,4,2,114077),
  t(114169,7,3,0),h(114540,4,3,116025),t(114912,0,3,0),t(115097,3,3,0),
  t(115283,6,4,0),f(115654,3,3),t(116210,1,2,0),t(116210,5,2,0),
  t(116396,3,2,0),t(116396,7,2,0),t(116581,1,2,0),t(116581,5,2,0),
  t(116767,3,2,0),t(116767,7,2,0),t(116952,0,3,0),t(117323,3,3,0),
  t(117694,7,3,3),t(118065,3,3,0),t(118251,0,3,0),t(118436,3,3,0),
  t(118807,1,3,0),t(118807,6,3,0),h(118993,1,4,119642,0,[[118993,1,4],[119364,2,1],[119642,1,4]]),t(119735,3,3,0),
  t(119920,3,3,0),t(120291,5,3,0),t(120662,5,3,0),f(121033,7,3),
  t(121775,5,3,0),t(121961,3,3,0),t(122146,1,3,0),t(122517,3,3,0),
  t(122703,0,3,0),t(122888,3,3,0),t(123259,7,3,0),t(123445,3,3,0),
  t(123630,0,3,0),t(124001,0,4,0),t(124187,3,3,0),t(124558,0,2,0),
  t(124558,4,2,0),t(124743,1,2,0),t(124743,5,2,0),t(124929,3,2,0),
  t(124929,7,2,0),t(125114,4,2,0),t(125114,8,2,0),f(125485,0,3),
  t(125857,1,3,0),t(126042,1,4,0),t(126042,7,3,0),t(126228,5,3,0),
  t(126599,7,3,0),s(126970,128083,[[126970,3,3],[127062,0.5,3],[127155,0.5,2],[127248,0.5,2],[127341,0.5,2],[127433,0.5,2],[127526,0.5,2],[127619,0.5,2],[127712,0.5,2],[127804,0.5,2],[127897,0.5,2],[127990,1,3],[128083,1.5,3]],1),t(127341,1,6,0),t(127712,3,3,0),
  t(128454,7,3,0),t(128639,3,3,0),t(128825,0,3,0),s(129196,130680,[[129196,3.5,2],[129474,4,2],[129752,2.5,2],[130030,0.5,2],[130309,1,2],[130587,0.5,2],[130680,1,2]]),
  t(129567,4,3,0),t(129752,1,4,0),t(129938,5,3,0),t(130123,5,3,0),
  t(130309,7,3,0),t(131051,5,3,0),f(131236,3,4),t(131607,0,3,0),
  t(131793,3,3,0),s(131978,133462,[[131978,3,2],[132071,4,2],[132164,4,2],[132257,4,2],[132349,3,2],[132442,3,3],[132535,3,3],[132628,2.5,3],[132720,3.5,3],[132813,3,3],[132906,3,3],[132999,3,3],[133091,3.5,2],[133184,3.5,2],[133277,3.5,2],[133370,3.5,2],[133462,3.5,2]]),s(131978,133462,[[131978,1,2],[133462,0,2]]),t(133648,0,3,0),
  t(133648,5,3,0),t(133833,3,3,0),s(134019,135503,[[134019,3,3],[134204,1.5,3],[134483,1.5,2],[134946,1,2],[135317,0.5,2],[135503,0.5,2]],1),t(134390,4,3,0),
  t(134575,4,4,0),t(134761,4,3,0),t(135132,5,3,0),t(135874,3,3,0),
  t(136059,1,3,0),t(136616,0,2,0),f(137358,4,2),h(137729,1,1,139213,1,[[137729,1,1],[138100,0,4],[138471,1,1],[138842,0,4],[139213,1,1]]),
  t(139584,0,2,0),t(140326,2,2,0),t(140512,0,4,0),t(141439,0,3,0),
  t(141810,0,3,0),t(142552,1,4,0),t(142738,1,3,0),t(142738,6,3,0),
  t(143109,5,3,0),t(143665,3,4,0),t(144036,1,4,0),t(144222,0,3,0),
  t(144407,3,4,0),t(145149,1,4,0),t(145520,0,4,0),t(145891,1,3,0),
  f(146633,3,3),t(147004,5,4,0),t(147376,2,2,0),t(147376,6,2,0),
  t(147561,2,2,0),t(147561,7,2,0),t(147747,1,2,0),t(147747,7,2,0),
  t(147932,1,2,0),t(147932,8,2,0),t(148118,5,3,0),t(148489,7,3,0),
  t(148860,5,3,0),t(149045,2,6,0),t(149231,1,3,0),t(149416,3,3,0),
  t(149602,1,3,0),t(149973,0,3,0),h(150344,2,1,150900,0,[[150344,2,1],[150622,1,3],[150900,1,4]]),f(151086,0,3),
  t(151457,0,3,0),t(151642,0,3,0),t(151642,5,3,0),h(151828,0,3,152384),
  t(152570,0,3,0),h(152941,2,4,153776),t(153312,1,3,0),t(153868,5,2,0),
  t(154054,3,2,0),t(154054,7,2,0),t(154239,1,2,0),t(154239,5,2,0),
  t(154425,3,2,0),t(154425,7,2,0),t(154610,1,3,0),t(154796,0,3,0),
  t(154981,0,3,0),t(155167,1,3,0),h(155538,2,3,156651),t(155909,1,3,0),
  t(156094,0,3,0),f(156280,0,3),t(156744,1,3,0),t(157393,3,3,4),
  t(157764,1,3,0),t(157857,0,3,0),t(158321,2,3,0),t(158321,7,3,0),
  t(159063,1,3,0),t(159248,0,3,0),t(159341,1,3,0),h(159805,0,3,161289),
  t(160361,1,3,0),t(160547,3,3,0),t(160732,5,3,0),t(161474,7,3,0),
  t(161845,5,3,0),t(162031,7,3,0),f(162216,5,3),t(162587,7,3,0),
  t(162773,5,3,0),t(162958,7,3,0),t(163329,5,3,0),t(163515,7,3,0),
  t(163700,7,3,0),t(164071,7,3,0),t(164442,7,3,0),t(164813,7,3,0),
  t(165184,7,3,0),t(165555,5,4,0),t(165741,6,4,0),t(165741,1,3,0),
  f(165926,5,3),t(166297,3,3,0),t(166483,5,3,0),t(166668,3,4,0),
  h(166854,5,4,167410,0,[[166854,5,4],[167132,6,3],[167410,7,1]]),t(167596,7,3,0),t(167781,5,3,0),t(167967,4,6,0),
  t(168152,5,3,0),t(168245,7,3,0),t(168523,5,3,0),t(168709,7,3,0),
  t(168895,5,3,0),t(169266,7,3,0),t(169451,3,3,0),t(169637,7,3,0),
  t(170008,5,3,0),t(170193,3,3,0),f(170379,5,3),t(170750,7,3,0),
  t(170935,5,3,0),t(170935,0,3,0),s(171121,172605,[[171121,2.5,3],[171306,2,3],[171584,2,2],[172048,2,2],[172605,0.5,2]],1),t(171492,5,3,0),
  t(171677,7,3,0),t(171863,7,3,0),t(172234,4,3,0),t(172976,6,4,0),
  t(173161,6,4,0),t(173347,5,3,0),h(173718,3,3,174460),t(174089,7,3,0),
  t(174645,0,3,0),t(174831,0,3,0),t(175202,0,3,0),t(175387,0,3,0),
  t(175573,0,3,0),t(175944,1,3,0),f(176315,1,3),t(176686,1,3,0),
  t(177057,1,3,0),t(177428,3,3,0),t(177799,5,3,0),t(178170,6,4,0),
  t(178355,5,3,0),t(178355,0,3,0),t(178541,5,3,0),h(178912,8,1,179654,1,[[178912,8,1],[179283,6,4],[179654,8,1]]),
  t(180025,1,3,0),t(180211,3,4,0),t(180396,5,3,0),s(180582,182066,[[180582,3,3],[180674,2.5,3],[180767,2.5,2],[180860,2.5,2],[180953,2.5,2],[181045,2.5,2],[181138,2.5,2],[181231,2.5,2],[181324,2.5,2],[181416,2.5,2],[181509,2.5,2],[181602,1,2],[181695,1,2],[181787,1,2],[181880,1,2],[181973,2.5,3],[182066,3,3]]),
  t(182251,1,3,0),t(182808,5,4,0),t(182993,3,3,0),f(184292,0,3),
  t(185034,1,3,0),t(185219,3,3,0),t(185961,1,3,0),t(186703,0,3,0),
  t(188002,1,3,0),t(188744,0,4,0),t(189486,1,3,0),t(189671,0,3,0),
  t(190785,1,4,0),t(190970,4,6,0),t(191156,4,2,0),t(192454,1,3,0),
  t(193011,7,3,0),t(193567,1,3,0),t(194866,0,3,0),t(195979,0,3,0),
  f(196350,1,3),
// </pandora-boss-remix-v3-master-notes>
])(mhTap,mhHoldV2,mhFlick,mhSlideV2);
const eikiBossRemixCharts=Object.freeze({
  EASY:mhChart(1,eikiBossRemixEasyNotes,EIKI_BOSS_REMIX_DURATION_MS),
  NORMAL:mhChart(3,eikiBossRemixNormalNotes,EIKI_BOSS_REMIX_DURATION_MS),
  HARD:mhChart(5,eikiBossRemixHardNotes,EIKI_BOSS_REMIX_DURATION_MS),
  EXPERT:mhChart(7,eikiBossRemixExpertNotes,EIKI_BOSS_REMIX_DURATION_MS),
  MASTER:mhChart(9,eikiBossRemixMasterNotes,EIKI_BOSS_REMIX_DURATION_MS),
});
const pandoraBossRemixCharts=Object.freeze({
  EASY:mhChart(1,pandoraBossRemixEasyNotes,PANDORA_BOSS_REMIX_DURATION_MS),
  NORMAL:mhChart(3,pandoraBossRemixNormalNotes,PANDORA_BOSS_REMIX_DURATION_MS),
  HARD:mhChart(5,pandoraBossRemixHardNotes,PANDORA_BOSS_REMIX_DURATION_MS),
  EXPERT:mhChart(7,pandoraBossRemixExpertNotes,PANDORA_BOSS_REMIX_DURATION_MS),
  MASTER:mhChart(9,pandoraBossRemixMasterNotes,PANDORA_BOSS_REMIX_DURATION_MS),
});

// デュラハンテーマ（全尺3分34秒）。譜面はV3パイプラインが入れる。
// 音源はバトルのBGMとして既にある bgm-dullahan.mp3 をそのまま使う(音源の追加は0バイト)。
// 音源は3分34秒あるが、モンビーでは曲の区切り(2分8.6秒)までを譜面にして、そこで終わる。
// 音源そのものは切っていない(バトルのBGMと同じファイルのため)。
// 譜面の作り直しは tools/mode/authoring/rhythm-song-registry.json の playEndMs が持っている。
const DULLAHAN_DURATION_MS=128603;
const dullahanEasyNotes=((t,h,f,s)=>[
// <dullahan-v3-easy-notes>
  t(2203,0,10,0),t(2603,4,6,0),t(3403,4,6,0),t(3803,4,6,0),
  t(4203,7,3,0),t(4203,0,3,0),t(5003,4,6,0),t(5803,4,6,0),
  t(6203,4,6,0),t(6603,4,6,0),t(7003,2,6,0),t(7603,0,6,0),
  t(8603,0,4,0),t(9403,0,6,0),t(9803,2,6,0),t(10203,0,6,0),
  t(10803,0,6,0),t(11803,0,4,0),h(12203,1,4,12603),t(13003,2,6,0),
  t(13403,4,6,0),t(14203,6,4,0),t(14603,4,6,0),t(15003,2,6,0),
  t(15403,0,6,0),t(16203,2,6,0),t(16603,0,6,0),t(17003,0,6,0),
  t(17803,0,6,0),t(18203,2,6,0),t(19403,0,6,0),t(19803,2,6,0),
  t(20203,4,6,0),t(20603,4,6,0),t(21003,4,6,0),t(21803,4,6,0),
  t(22603,4,6,0),t(22803,4,6,0),t(23803,5,4,0),t(24203,3,4,0),
  t(24603,4,6,0),t(25003,2,6,0),t(25403,0,6,0),t(26203,2,6,0),
  t(26603,0,6,0),t(27003,2,6,1),t(27803,0,6,0),t(28203,2,6,0),
  t(28603,4,6,0),t(29403,4,6,0),t(29803,4,6,0),t(30203,2,6,0),
  t(31003,0,6,0),t(31403,0,4,0),t(32203,0,6,0),t(32603,0,6,0),
  t(33003,0,6,0),t(33203,0,6,0),t(33603,2,6,0),t(33803,5,4,0),
  t(34203,4,6,0),t(34403,4,6,0),t(35003,0,3,0),t(35003,7,3,0),
  t(35803,2,6,0),t(36203,4,6,0),t(36403,0,10,0),t(37403,4,6,0),
  t(37603,2,6,0),t(38003,0,6,0),t(38203,3,4,0),t(38603,0,6,0),
  t(38803,2,6,0),h(40203,6,3,41003,0,[[40203,6,3],[40603,5,4],[41003,4,6]]),t(41403,4,6,0),t(41803,4,6,0),
  t(42203,2,6,0),t(43003,4,6,0),t(43403,4,6,0),t(43803,4,6,0),
  t(44403,4,6,0),t(44603,4,6,0),t(45003,4,6,0),t(45403,4,6,0),
  t(46203,4,6,0),t(46603,5,4,0),t(46803,4,6,0),t(47403,4,6,0),
  t(47803,4,6,0),t(48003,4,6,0),h(49003,2,6,50103),t(50203,4,6,0),
  t(50603,2,6,0),t(51003,0,6,0),t(51403,0,6,0),t(51803,0,6,2),
  t(52603,0,6,0),t(53003,0,6,0),t(53403,0,6,0),t(53803,0,6,0),
  t(54203,2,6,0),t(54603,4,6,0),t(55003,2,6,0),t(55803,4,6,0),
  t(56203,4,6,0),t(56603,4,6,0),t(57003,4,6,0),t(57403,0,6,0),
  t(57803,2,6,0),h(58203,4,6,58703),t(59003,4,6,0),t(59403,4,6,0),
  t(59803,4,6,0),t(60203,4,6,0),t(60603,4,6,0),t(61003,4,6,0),
  t(61403,4,6,0),t(61803,2,6,0),t(62203,2,6,0),t(62603,0,6,0),
  t(63003,0,6,0),t(63403,0,6,0),t(63603,0,6,0),t(64203,0,6,0),
  t(64403,2,6,0),t(65003,4,6,0),t(65203,4,6,0),t(66203,2,6,0),
  t(66603,0,10,0),t(67003,2,6,0),t(67403,0,6,0),t(67803,0,3,0),
  t(67803,7,3,0),t(68203,0,6,0),t(68403,0,6,0),t(69403,4,6,0),
  t(69603,2,6,0),t(70203,0,6,0),t(71003,0,6,0),t(71403,1,4,0),
  t(71603,3,4,0),t(72003,4,6,0),t(72403,4,6,0),t(72603,6,4,0),
  t(73003,4,6,0),t(73403,6,4,0),t(74203,5,4,0),t(74603,2,6,0),
  t(75003,5,4,0),t(75203,2,6,0),t(75803,4,6,0),t(76003,4,6,0),
  t(76603,4,6,0),t(76803,2,6,0),t(77203,0,6,0),t(77403,0,6,0),
  t(77803,0,6,3),t(78203,2,6,0),t(78603,0,6,0),t(79003,0,6,0),
  t(79403,0,6,0),t(80203,2,6,0),t(80603,4,6,0),t(81003,2,6,0),
  t(81803,4,6,0),t(82203,4,6,0),t(82603,4,6,0),t(83003,2,6,0),
  t(83403,4,6,0),h(84203,4,6,85803,0,[[84203,4,6],[84603,4,6],[85003,5,4],[85403,5,4],[85803,6,3]]),t(86203,0,6,0),t(86603,0,6,0),
  t(87003,0,6,0),t(87403,0,6,0),t(87803,2,6,0),h(88203,0,6,89203),
  t(89403,2,6,0),t(89603,0,6,0),t(90003,0,6,0),t(90203,0,6,0),
  t(91003,0,6,0),t(91403,0,6,0),t(91603,0,6,0),t(92203,0,6,0),
  t(92603,0,6,0),t(93003,0,6,0),t(93203,0,6,0),t(94203,0,6,0),
  t(94603,2,6,0),t(94803,4,6,0),t(95403,4,6,0),t(96203,4,6,0),
  t(96603,0,10,0),t(97003,4,6,0),t(97203,4,6,0),t(98203,2,6,0),
  t(98603,0,6,0),t(99003,2,6,0),t(99403,0,6,0),t(99603,0,6,0),
  t(100403,0,6,0),t(100603,0,6,0),h(101403,2,3,102203,0,[[101403,2,3],[101803,0,6],[102203,2,3]]),t(102403,0,6,0),
  t(102603,0,6,0),t(103003,2,6,4),h(103403,3,4,104003),t(104203,4,6,0),
  t(104603,2,6,0),t(105003,0,6,0),t(105403,0,6,0),t(105803,0,6,0),
  t(106203,0,6,0),t(106603,2,6,0),t(107003,4,6,0),t(107403,4,6,0),
  t(107803,4,6,0),t(108203,4,6,0),t(108603,4,6,0),t(108803,4,6,0),
  t(109403,4,6,0),t(109803,7,3,0),t(109803,0,3,0),t(110203,6,4,0),
  t(110403,4,6,0),t(111003,4,6,0),t(111803,4,6,0),t(112203,2,6,0),
  t(112603,0,6,0),h(113003,2,6,114003),h(114203,4,6,115303),t(115403,4,6,0),
  t(116203,4,6,0),t(116603,4,6,0),t(117003,4,6,0),t(117403,2,6,0),
  t(117603,4,6,0),h(118203,4,6,118703),t(119003,4,6,0),t(119403,0,3,0),
  t(119403,7,3,0),t(119803,0,6,0),t(120203,0,6,0),h(120603,0,6,122003,0,[[120603,0,6],[121003,1,4],[121303,2,3],[121703,1,4],[122003,0,6]]),
  t(122203,0,6,0),t(122603,0,6,0),t(122803,0,6,0),t(123203,0,6,0),
  t(123403,0,6,0),t(123803,2,6,0),t(124003,4,6,0),t(124603,4,6,0),
  t(125003,4,6,0),t(125403,4,6,0),t(125603,4,6,0),t(126203,4,6,0),
  t(126603,2,6,0),t(126803,0,10,0),
// </dullahan-v3-easy-notes>
])(mhTap,mhHoldV2,mhFlick,mhSlideV2);
const dullahanNormalNotes=((t,h,f,s)=>[
// <dullahan-v3-normal-notes>
  t(2203,0,10,0),f(2603,4,6),t(3003,0,6,0),t(3403,4,6,0),
  t(3803,0,6,0),t(4203,5,4,0),t(5003,0,6,0),t(5803,4,6,0),
  t(6203,2,6,0),t(6603,4,6,0),t(7003,2,6,0),t(7603,4,6,0),
  t(8603,1,3,0),t(9003,3,3,0),t(9403,4,6,0),t(9803,4,6,0),
  t(10203,4,6,0),t(10803,2,6,0),h(12203,1,3,12603,1),t(13003,2,6,0),
  t(13403,4,6,0),t(14203,6,4,0),t(14603,2,6,0),t(15003,4,6,0),
  t(15403,2,6,0),t(15803,1,4,0),t(16203,0,6,0),t(16603,2,6,0),
  f(17003,0,6),t(17803,2,6,0),t(18203,4,6,0),t(18803,2,6,0),
  t(19403,0,6,0),t(19803,0,6,0),t(20203,0,6,0),t(20603,2,6,0),
  t(21003,4,6,0),t(21803,4,6,0),t(22603,4,6,0),t(22803,4,6,0),
  t(23003,4,6,0),t(23403,5,3,0),t(23803,7,3,0),t(24203,3,3,0),
  t(24603,4,6,0),t(25003,0,6,0),t(25403,0,6,0),t(26203,0,6,0),
  t(26603,0,6,0),t(27003,0,6,1),t(27803,4,6,0),t(28203,2,6,0),
  t(28603,0,6,0),f(29403,0,6),t(29803,4,6,0),t(30203,2,6,0),
  t(31003,0,6,0),t(31403,0,4,0),t(31603,0,6,0),t(32203,0,6,0),
  t(32603,2,6,0),t(33003,0,6,0),t(33203,0,6,0),t(33403,0,6,0),
  t(33803,0,3,0),t(33803,7,3,0),t(34203,0,6,0),t(34403,0,6,0),
  t(34603,4,6,0),t(35003,3,4,0),t(35803,4,6,0),t(36203,4,6,0),
  t(36403,2,6,0),t(36603,0,10,0),t(37403,0,6,0),t(37603,0,6,0),
  t(37803,0,4,0),t(38203,0,4,0),t(38603,0,6,0),t(38803,0,6,0),
  f(39003,2,6),h(40203,6,2,41003,0,[[40203,6,2],[40603,5,4],[41003,4,6]]),t(41403,0,6,0),t(42203,0,6,0),
  t(42803,2,6,0),t(43003,4,6,0),t(43403,4,6,0),t(43803,0,6,0),
  t(44403,4,6,0),t(44603,2,6,0),t(45003,4,6,0),t(45403,4,6,0),
  t(46203,4,6,0),t(46603,7,3,0),t(46603,0,3,0),t(46803,4,6,0),
  t(47403,4,6,0),t(47803,4,6,0),t(48003,4,6,0),t(48203,4,6,0),
  h(49003,4,6,50103),t(50203,0,6,0),t(50603,2,6,0),t(51403,4,6,0),
  t(51803,4,6,0),t(52203,3,4,2),t(52603,0,6,0),f(53003,2,6),
  t(53403,4,6,0),t(53803,2,6,0),t(54203,4,6,0),t(54603,4,6,0),
  t(55003,4,6,0),t(55403,2,6,0),t(55803,0,6,0),t(56203,2,6,0),
  t(56603,4,6,0),t(57403,0,6,0),t(57803,2,6,0),h(58203,4,6,58703),
  t(59003,4,6,0),h(59403,4,6,60003),t(60203,4,6,0),t(60603,4,6,0),
  t(61003,4,6,0),t(61403,4,6,0),t(61603,4,6,0),t(61803,4,6,0),
  t(62203,4,6,0),t(62603,2,6,0),t(63003,4,6,0),t(63403,2,6,0),
  t(63603,0,6,0),f(63803,0,6),t(64203,0,6,0),t(64403,0,6,0),
  t(64603,0,6,0),t(65003,0,6,0),t(65203,2,6,0),t(65403,0,6,0),
  t(66203,4,6,0),t(66603,4,6,0),t(66803,4,6,0),t(67003,4,6,0),
  t(67403,4,6,0),t(67803,7,3,0),t(67803,0,3,0),t(68203,0,10,0),
  t(68403,4,6,0),t(68603,2,6,0),t(69403,0,6,0),t(69603,4,6,0),
  t(69803,1,4,0),t(70203,4,6,0),t(71003,0,6,0),t(71403,5,4,0),
  t(71603,3,3,0),t(71803,4,6,0),t(72403,2,6,0),t(72603,0,4,0),
  f(72803,2,6),t(73403,6,4,0),t(74203,5,4,0),t(74603,4,6,0),
  t(75003,5,4,0),t(75203,4,6,0),t(75803,4,6,0),t(76003,0,6,0),
  t(76203,7,3,0),t(76203,0,3,0),t(76603,0,6,0),t(76803,0,6,0),
  t(77203,2,6,0),t(77403,0,6,0),t(77803,4,6,3),t(78203,4,6,0),
  t(78603,4,6,0),t(79003,4,6,0),t(79403,4,6,0),t(80203,0,6,0),
  t(80603,2,6,0),t(81003,4,6,0),t(81403,4,6,0),t(81803,4,6,0),
  t(82603,4,6,0),t(83003,4,6,0),f(83403,4,6),t(83803,2,6,0),
  h(84203,4,6,85803,1,[[84203,4,6],[84603,5,4],[85003,5,4],[85403,6,3],[85803,6,2]]),t(86203,0,6,0),t(86603,2,6,0),t(87003,4,6,0),
  t(87403,2,6,0),t(87803,0,6,0),h(88203,2,6,89203),t(89403,0,6,0),
  t(89603,4,6,0),t(89803,2,6,0),t(90203,4,6,0),t(90603,7,3,0),
  t(90603,0,3,0),t(91003,2,6,0),t(91403,4,6,0),t(91603,2,6,0),
  t(91803,0,6,0),t(92203,2,6,0),t(92603,0,6,0),t(93003,0,6,0),
  t(93203,0,6,0),t(93403,2,6,0),t(93803,0,6,0),t(94203,2,6,0),
  t(94603,4,6,0),t(94803,0,6,0),f(95003,2,6),t(95403,0,6,0),
  t(95603,2,6,0),t(96203,0,6,0),t(96603,0,6,0),t(97003,0,6,0),
  t(97203,0,10,0),t(97403,0,6,0),t(98203,0,6,0),t(98603,0,6,0),
  t(99003,2,6,0),t(99403,4,6,0),t(99603,4,6,0),t(99803,4,6,0),
  t(100403,4,6,0),t(100603,4,6,0),h(101403,6,2,102203,1,[[101403,6,2],[101803,4,6],[102203,6,2]]),t(102603,4,6,4),
  t(103003,4,6,0),h(103403,6,4,104003),t(104203,4,6,0),t(104403,4,6,0),
  t(104603,4,6,0),t(105003,4,6,0),t(105403,4,6,0),f(105803,2,6),
  t(106203,0,6,0),t(106603,2,6,0),t(107003,4,6,0),t(107403,2,6,0),
  t(107603,4,6,0),t(107803,2,6,0),t(108203,4,6,0),t(108603,0,6,0),
  t(108803,0,6,0),t(109003,0,6,0),t(109403,0,6,0),t(109803,0,3,0),
  t(109803,7,3,0),t(110203,0,4,0),t(110603,0,6,0),t(111003,0,6,0),
  t(111403,2,6,0),t(111803,0,6,0),t(112203,2,6,0),t(112603,0,6,0),
  h(113003,0,6,114003),h(114203,0,6,115303),t(115403,0,6,0),t(116203,0,6,0),
  t(116603,0,6,0),f(117003,0,6),t(117403,0,6,0),t(117603,0,6,0),
  t(117803,2,6,0),h(118203,0,6,118703),t(119003,0,6,0),t(119203,2,6,0),
  t(119403,0,3,0),t(119403,7,3,0),t(119803,4,6,0),t(120203,2,6,0),
  h(120603,4,6,122003,0,[[120603,4,6],[121003,5,4],[121303,6,2],[121703,5,4],[122003,4,6]]),t(122203,2,6,0),t(122603,4,6,0),t(122803,4,6,0),
  t(123203,4,6,0),t(123403,4,6,0),t(123803,4,6,0),t(124003,4,6,0),
  t(124203,4,6,0),t(124603,2,6,0),t(125003,4,6,0),t(125403,2,6,0),
  t(125603,0,6,0),t(125803,4,6,0),t(126203,2,6,0),t(126403,4,6,0),
  f(126603,2,6),t(127003,4,6,0),t(127203,0,10,0),
// </dullahan-v3-normal-notes>
])(mhTap,mhHoldV2,mhFlick,mhSlideV2);
const dullahanHardNotes=((t,h,f,s)=>[
// <dullahan-v3-hard-notes>
  t(1803,0,8,0),f(2203,2,5),t(2603,4,5,0),t(3003,5,5,0),
  t(3403,4,5,0),t(3803,2,5,0),t(4203,3,4,0),t(4403,5,4,0),
  t(5003,2,5,0),t(5803,0,5,0),t(6203,2,5,0),t(6603,4,5,0),
  t(6803,2,5,0),t(7003,4,5,0),t(7303,5,5,0),t(7603,4,5,0),
  h(8203,4,1,9803,1,[[8203,4,1],[8603,4,2],[9003,3,3],[9403,3,4],[9803,2,5]]),t(10203,0,5,0),t(10503,0,5,0),t(10803,0,5,0),
  t(11803,0,3,0),h(12203,1,3,12603,1),t(13003,2,5,0),t(13203,4,5,0),
  t(13403,2,5,0),t(13803,5,3,0),t(14203,3,4,0),t(14603,0,5,0),
  t(15003,2,5,0),t(15403,0,5,0),f(15803,3,4),t(16203,4,5,0),
  t(16603,5,5,0),t(17003,4,5,0),t(17203,5,5,0),t(17403,5,4,0),
  t(17503,0,5,0),t(17803,2,5,0),t(18203,4,5,0),t(18803,5,5,0),
  t(19403,2,5,0),t(19803,4,5,0),t(20203,5,5,0),t(20603,3,5,0),
  t(20703,4,5,0),t(21003,5,5,0),t(21503,4,5,0),t(21803,5,5,0),
  t(22103,4,5,0),t(22303,2,5,0),t(22603,4,5,0),t(22803,2,5,0),
  t(23003,0,5,0),t(23403,5,3,0),t(23803,7,3,0),t(24203,5,3,0),
  t(24603,2,5,0),t(25003,0,5,0),f(25403,2,5),t(25803,1,3,0),
  t(26203,2,5,0),t(26603,4,5,1),t(27003,0,5,0),t(27203,2,5,0),
  t(27603,4,5,0),t(27803,5,5,0),t(28203,2,5,0),t(28403,4,5,0),
  t(28603,5,5,0),t(29403,4,5,0),t(29603,4,5,0),t(29803,2,5,0),
  t(30003,0,5,0),t(30203,0,5,0),t(31003,0,5,0),t(31403,1,4,0),
  t(31603,0,5,0),t(31803,1,4,0),t(32203,0,5,0),t(32603,0,5,0),
  t(32803,1,8,0),t(33003,4,5,0),t(33203,0,5,0),t(33403,2,5,0),
  t(33603,4,5,0),t(33803,6,4,0),t(33803,0,3,0),t(34003,2,5,0),
  t(34203,4,5,0),t(34403,5,5,0),t(34603,4,5,0),t(34803,0,5,0),
  f(35003,0,4),t(35603,0,5,0),t(35803,0,5,0),t(36003,0,5,0),
  t(36203,2,5,0),t(36403,4,5,0),t(36603,5,5,0),t(36803,5,5,0),
  t(37203,5,5,0),t(37403,5,5,0),t(37603,5,5,0),t(37803,5,4,0),
  t(38003,0,5,0),t(38203,3,4,0),t(38503,2,4,0),t(38603,0,5,0),
  t(38803,4,5,0),t(39003,2,5,0),t(39303,5,5,0),t(39803,2,5,0),
  s(40203,41003,[[40203,3,4],[40303,1,4],[40403,1.5,3],[40703,1,3],[40903,1,2],[41003,1,2]],1),t(41403,4,5,0),f(41803,5,5),t(42203,4,5,0),
  t(42503,4,5,0),t(42803,2,5,0),t(43003,4,5,0),t(43403,0,5,0),
  t(43803,0,5,0),t(44003,0,5,0),t(44403,0,5,0),t(44603,0,5,0),
  t(44903,4,5,0),t(45003,2,5,0),t(45403,0,5,0),t(45703,0,5,0),
  t(46103,1,5,0),t(46203,0,5,0),t(46603,1,3,0),t(46603,7,3,0),
  t(46803,4,5,0),t(47403,4,5,0),t(47703,6,4,0),t(47803,4,5,0),
  t(48003,5,5,0),t(48203,2,5,0),t(48503,4,5,0),h(49003,2,5,50103),
  t(50203,0,5,0),t(50603,2,5,0),t(51003,0,5,0),t(51403,0,5,0),
  t(51603,0,5,0),f(51803,0,5),t(52203,3,4,2),t(52603,4,5,0),
  t(52803,5,5,0),t(53003,4,5,0),t(53403,2,5,0),t(53803,0,5,0),
  t(54003,4,5,0),t(54203,2,5,0),t(54403,0,5,0),t(54603,0,5,0),
  t(55003,0,5,0),t(55403,0,5,0),t(55803,2,5,0),t(56003,0,5,0),
  t(56203,0,8,0),t(56603,0,5,0),t(57003,0,5,0),t(57403,0,5,0),
  t(57803,0,5,0),t(58003,0,5,0),h(58203,0,5,58703),t(59003,0,5,0),
  h(59403,0,5,60003,0,[[59403,0,5],[59703,1,3],[60003,2,1]]),t(60203,0,5,0),t(60403,0,5,0),t(60603,0,5,0),
  t(60803,0,5,0),f(61003,2,5),t(61403,0,5,0),t(61603,0,5,0),
  t(61803,0,5,0),t(62203,0,5,0),t(62403,0,5,0),t(62603,0,5,0),
  t(63003,2,5,0),t(63303,4,5,0),t(63403,5,5,0),t(63603,5,5,0),
  t(63803,5,5,0),t(64003,6,4,0),t(64103,5,4,0),t(64303,5,5,0),
  t(64403,4,5,0),t(64603,5,5,0),t(65003,0,5,0),t(65203,2,5,0),
  t(65403,4,5,0),t(65603,5,5,0),t(65903,4,5,0),t(66203,4,5,0),
  t(66403,5,5,0),t(66603,5,5,0),t(66803,5,5,0),t(67003,5,5,0),
  t(67203,5,5,0),f(67403,5,5),t(67803,6,4,0),t(67803,0,3,0),
  t(68203,2,5,0),t(68403,0,5,0),t(68603,0,5,0),t(68803,0,5,0),
  t(69203,0,5,0),t(69403,2,5,0),t(69603,0,5,0),t(69803,3,4,0),
  t(70003,5,5,0),t(70203,2,5,0),t(70803,4,5,0),t(71003,2,5,0),
  t(71203,1,3,0),t(71403,5,4,0),t(71603,3,3,0),t(71803,0,5,0),
  t(72003,0,5,0),t(72403,0,5,0),t(72603,3,4,0),t(72803,4,5,0),
  t(73003,5,5,0),t(73203,2,5,0),t(73403,6,4,0),t(73403,0,3,0),
  t(73603,5,5,0),f(74203,5,4),t(74603,0,5,0),t(74803,2,5,0),
  t(75003,5,4,0),t(75203,5,5,0),t(75603,0,5,0),t(75803,2,5,0),
  t(76003,4,5,0),t(76203,6,4,0),t(76403,3,4,0),h(76603,4,5,77103),
  t(77403,2,5,3),t(77803,0,8,0),t(78203,4,5,0),t(78603,2,5,0),
  t(78803,0,5,0),t(79003,0,5,0),t(79403,4,5,0),t(79803,2,5,0),
  t(80203,0,5,0),t(80603,0,5,0),t(81003,0,5,0),t(81403,2,5,0),
  t(81603,4,5,0),t(81803,5,5,0),t(82003,4,5,0),t(82203,2,5,0),
  t(82603,0,5,0),t(82803,0,5,0),t(83003,0,5,0),f(83403,0,5),
  t(83803,0,5,0),s(84203,85803,[[84203,1,4],[84403,1,4],[84703,1,3],[84803,2,3],[85203,0.5,3],[85603,0,2],[85803,1,2]],1),t(86203,0,5,0),t(86603,2,5,0),
  t(87003,5,5,0),t(87203,2,5,0),t(87403,0,5,0),t(87803,2,5,0),
  h(88203,7,1,89203,0,[[88203,7,1],[88503,6,4],[88903,6,4],[89203,7,1]]),t(89403,5,5,0),t(89603,5,5,0),t(89803,5,5,0),
  t(90003,5,5,0),t(90203,2,5,0),t(90603,6,4,0),t(90603,0,3,0),
  t(91003,5,5,0),t(91303,4,5,0),t(91403,5,5,0),t(91603,4,5,0),
  t(91803,2,5,0),t(92003,1,4,0),t(92203,0,5,0),t(92603,2,5,0),
  t(92803,0,5,0),t(92903,4,5,0),t(93203,2,5,0),t(93403,4,5,0),
  f(93803,5,5),t(94203,4,5,0),t(94603,0,5,0),t(94803,2,5,0),
  t(95003,4,5,0),t(95403,5,5,0),t(95603,2,5,0),t(95803,4,5,0),
  t(96203,2,5,0),t(96403,0,4,0),t(96403,7,3,0),t(96603,0,5,0),
  t(97003,2,5,0),t(97203,0,5,0),t(97403,2,5,0),t(97603,4,5,0),
  t(97803,2,5,0),t(98203,0,5,0),t(98603,0,5,0),t(98803,0,5,0),
  t(99003,0,5,0),t(99403,2,5,0),t(99603,5,5,0),t(99803,4,5,0),
  t(100003,5,5,0),t(100203,4,5,0),t(100403,5,5,0),t(100603,5,5,0),
  f(100803,5,5),t(101403,5,5,0),h(101703,5,5,102203),t(102403,2,5,0),
  t(102603,4,5,0),t(102803,2,8,0),t(103003,4,5,0),h(103403,5,5,104003,0,[[103403,5,5],[103703,8,1],[104003,5,5]]),
  t(104203,5,5,0),t(104403,5,5,0),t(104603,5,5,0),t(104803,4,5,0),
  t(105003,5,5,0),t(105203,4,5,0),t(105403,5,5,0),t(105803,4,5,4),
  t(106203,2,5,0),t(106603,0,5,0),t(106803,2,5,0),t(107003,2,5,0),
  t(107203,0,5,0),h(107403,0,5,107903),t(108003,0,5,0),t(108203,0,5,0),
  t(108403,0,5,0),t(108603,0,5,0),t(108803,0,5,0),t(109003,0,5,0),
  t(109403,4,5,0),t(109703,2,5,0),f(109803,6,4),t(110203,6,4,0),
  t(110203,0,3,0),t(110403,4,5,0),t(110603,5,5,0),t(110803,5,5,0),
  t(111003,4,5,0),t(111203,2,5,0),t(111403,0,5,0),t(111603,0,5,0),
  t(111803,0,5,0),t(112203,0,5,0),t(112603,0,5,0),t(113003,0,5,0),
  h(113203,2,5,114003),h(114203,4,5,115303),t(115403,0,5,0),t(115803,0,5,0),
  h(116203,2,5,116703),t(117003,4,5,0),t(117203,5,5,0),t(117403,4,5,0),
  t(117603,2,5,0),t(117803,5,5,0),h(118003,2,5,118703),t(118803,5,5,0),
  t(119003,2,5,0),t(119203,5,5,0),t(119403,3,4,0),t(119603,4,5,0),
  f(119803,5,5),t(120203,4,5,0),h(120403,4,1,122003,0,[[120403,4,1],[120803,2,5],[121203,4,1],[121603,2,5],[122003,4,1]]),t(122203,0,5,0),
  t(122603,2,5,0),t(122803,0,5,0),t(123203,0,5,0),t(123403,0,5,0),
  t(123703,1,5,0),t(123803,0,5,0),t(124003,0,5,0),t(124203,0,5,0),
  t(124403,0,5,0),t(124603,0,5,0),t(124803,0,4,0),t(124803,7,3,0),
  t(125003,0,5,0),t(125203,0,5,0),t(125403,2,5,0),t(125603,4,5,0),
  t(125803,5,5,0),t(126003,2,5,0),t(126203,4,5,0),t(126403,5,5,0),
  t(126603,4,5,0),t(126803,2,5,0),t(127003,2,8,0),f(127103,3,3),
// </dullahan-v3-hard-notes>
])(mhTap,mhHoldV2,mhFlick,mhSlideV2);
const dullahanExpertNotes=((t,h,f,s)=>[
// <dullahan-v3-expert-notes>
  t(1803,0,8,0),f(2203,2,5),t(2603,4,5,0),t(3003,0,2,0),
  t(3003,4,2,0),t(3203,2,2,0),t(3203,6,2,0),t(3403,4,2,0),
  t(3403,8,2,0),t(3803,4,5,0),t(4203,6,4,0),t(4403,4,4,0),
  t(4503,5,5,0),t(5003,4,5,0),t(5803,1,2,0),t(5803,5,2,0),
  t(6203,3,2,0),t(6203,7,2,0),t(6603,1,2,0),t(6603,5,2,0),
  t(6803,5,5,0),t(7003,5,5,0),t(7303,2,5,0),t(7603,5,5,0),
  t(7803,5,4,0),h(8203,7,1,9803,1,[[8203,7,1],[8603,7,2],[9003,6,3],[9403,6,4],[9803,5,5]]),t(8603,8,2,0),t(8803,5,3,0),
  t(9003,3,3,0),t(9403,4,5,0),t(10203,0,2,0),t(10203,4,2,0),
  t(10503,2,2,0),t(10503,6,2,0),t(10803,4,2,0),t(10803,8,2,0),
  f(11803,5,3),h(12203,3,3,12603),t(12803,1,3,0),t(13003,0,5,0),
  t(13203,0,5,0),t(13403,2,5,0),t(13803,5,3,0),t(14003,6,4,0),
  t(14203,5,4,0),t(14603,2,5,0),t(15003,0,5,0),t(15403,2,5,0),
  t(15803,1,4,0),t(16203,2,5,0),t(16403,0,5,0),t(16603,0,5,0),
  t(17003,0,5,0),t(17203,0,5,0),t(17403,2,4,0),t(17503,0,5,0),
  t(17803,0,5,0),t(18203,4,5,0),t(18803,0,5,0),t(19403,5,5,0),
  t(19603,4,5,0),t(19803,2,5,0),f(20203,0,5),t(20603,1,5,0),
  t(20703,0,5,0),t(21003,2,5,0),t(21203,0,5,0),t(21503,2,5,0),
  t(21803,4,5,0),t(22103,5,5,0),t(22303,4,5,0),t(22603,5,5,0),
  t(22803,4,5,0),t(23003,2,5,0),t(23203,1,3,0),t(23403,0,3,0),
  t(23803,1,3,0),t(24203,5,3,0),t(24603,2,5,0),t(25003,0,5,0),
  t(25403,0,5,0),t(25603,1,4,0),t(25803,3,3,0),t(26203,4,5,0),
  t(26603,2,5,1),t(27003,4,5,0),t(27203,2,5,0),t(27603,0,5,0),
  f(27803,0,5),t(28203,2,5,0),t(28403,4,5,0),t(28603,2,5,0),
  t(29203,0,5,0),t(29403,4,5,0),t(29603,2,5,0),t(29803,0,5,0),
  t(30003,0,5,0),t(30203,0,5,0),t(31003,0,5,0),t(31203,0,5,0),
  t(31403,0,4,0),t(31603,0,5,0),t(31803,3,4,0),t(32203,4,5,0),
  t(32603,2,8,0),t(32803,2,5,0),t(33003,4,5,0),t(33203,5,5,0),
  t(33403,4,5,0),t(33603,0,5,0),t(33803,5,4,0),t(33903,3,4,0),
  t(34003,5,5,0),t(34203,5,5,0),t(34403,5,5,0),t(34603,5,5,0),
  t(34803,5,5,0),t(35003,6,4,0),t(35003,0,3,0),t(35203,4,5,0),
  t(35503,5,5,0),t(35603,4,5,0),t(35803,0,5,0),t(36003,2,5,0),
  t(36203,4,5,0),t(36403,5,5,0),t(36603,4,5,0),f(36803,0,5),
  t(37203,2,5,0),t(37403,0,5,0),t(37603,0,5,0),t(37703,2,5,0),
  t(37803,4,4,0),t(38003,5,5,0),t(38203,3,4,0),t(38303,4,5,0),
  t(38503,3,4,0),t(38603,0,5,0),t(38803,2,5,0),t(39003,0,5,0),
  t(39303,0,5,0),t(39803,0,5,0),f(40203,4,5),t(40603,2,5,0),
  s(41003,42603,[[41003,2.5,3],[41303,3.5,3],[41603,2.5,3],[41903,0.5,3],[42203,1.5,3],[42503,1.5,3],[42603,1,3]]),t(41403,0,5,0),s(41803,42603,[[41803,3,2],[42603,4,2]]),t(42803,0,5,0),
  t(43003,2,5,0),t(43403,4,5,0),t(43803,4,5,0),t(44003,5,5,0),
  t(44403,4,5,0),t(44603,5,5,0),t(44903,5,5,0),t(45003,4,5,0),
  t(45403,5,5,0),t(45703,4,5,0),t(46103,2,5,0),t(46203,4,5,0),
  t(46303,3,4,0),t(46603,1,3,0),t(46603,7,3,0),t(46803,0,5,0),
  t(47403,0,5,0),t(47703,2,4,0),t(47803,0,5,0),t(48003,0,5,0),
  t(48203,0,5,0),t(48403,0,3,0),t(48503,1,5,0),f(48603,0,4),
  h(49003,1,5,50103),t(49403,0,5,0),t(49603,0,5,0),t(50203,2,5,0),
  t(50603,0,5,0),t(51003,0,5,2),t(51403,0,5,0),t(51603,4,5,0),
  t(51803,2,5,0),t(52203,1,4,0),t(52403,0,5,0),t(52603,2,5,0),
  t(52803,4,5,0),t(53003,2,5,0),t(53203,0,5,0),t(53403,4,5,0),
  t(53803,2,5,0),t(54203,0,5,0),t(54403,0,5,0),t(54603,0,5,0),
  f(55003,2,5),t(55403,4,5,0),t(55603,5,5,0),t(55803,5,5,0),
  t(56003,5,5,0),t(56203,5,5,0),t(56603,5,5,0),t(57003,1,8,0),
  t(57303,4,5,0),t(57403,2,5,0),t(57803,0,5,0),t(58003,0,5,0),
  h(58203,0,5,58703),t(58803,0,5,0),t(59003,0,5,0),t(59203,0,5,0),
  h(59403,0,5,60003,0,[[59403,0,5],[59703,1,3],[60003,2,1]]),t(60203,2,5,0),t(60403,4,5,0),t(60603,5,5,0),
  t(60803,5,5,0),t(61003,5,5,0),t(61403,5,5,0),t(61603,4,5,0),
  t(61803,4,5,0),t(62003,5,5,0),t(62203,5,5,0),t(62403,4,5,0),
  f(62603,5,5),t(63003,4,5,0),t(63103,6,4,0),t(63303,4,5,0),
  t(63403,2,5,0),t(63603,4,5,0),t(63803,2,5,0),t(64003,1,4,0),
  t(64103,3,4,0),t(64203,0,5,0),t(64303,2,5,0),t(64403,0,5,0),
  t(64603,2,5,0),t(64803,4,5,0),t(65003,5,5,0),t(65203,5,5,0),
  t(65403,5,5,0),t(65603,5,5,0),t(65903,5,5,0),t(66203,4,5,0),
  t(66403,4,5,0),t(66603,5,5,0),t(66803,5,5,0),t(67003,2,5,0),
  t(67203,4,5,0),t(67403,5,5,0),t(67603,4,5,0),t(67803,6,4,0),
  t(68003,4,5,0),t(68203,2,5,0),t(68403,0,5,0),t(68603,0,5,0),
  f(68803,0,5),t(69203,2,5,0),t(69403,4,5,0),t(69603,2,5,0),
  t(69803,5,4,0),t(70003,0,5,0),t(70203,0,5,0),t(70403,0,5,0),
  t(70803,2,5,0),t(71003,0,5,0),t(71203,3,3,0),t(71403,5,4,0),
  t(71603,3,3,0),t(71803,0,5,0),t(72003,2,5,0),t(72103,1,4,0),
  t(72303,2,4,0),t(72403,0,5,0),t(72603,5,4,0),t(72803,2,5,0),
  t(73003,0,5,0),t(73203,0,5,0),t(73403,1,4,0),f(73603,0,5),
  t(74203,1,4,0),t(74403,0,4,0),t(74603,0,5,0),t(74803,2,5,0),
  t(75003,5,4,0),t(75203,5,5,0),t(75603,2,5,0),t(75803,4,5,0),
  t(76003,5,5,0),t(76203,5,4,0),t(76303,1,4,0),t(76403,5,4,0),
  h(76603,2,5,77103),t(77203,5,5,0),t(77403,2,5,0),t(77803,4,5,3),
  t(78203,5,5,0),t(78603,4,5,0),t(78803,2,8,0),t(79003,2,5,0),
  t(79403,0,5,0),f(79803,0,5),t(80203,0,5,0),t(80403,2,5,0),
  t(80603,4,5,0),t(80803,7,3,0),t(80803,1,3,0),t(81003,2,5,0),
  t(81403,0,5,0),t(81603,2,5,0),t(81803,4,5,0),t(82003,0,5,0),
  t(82203,2,5,0),t(82603,4,5,0),t(82803,5,5,0),t(83003,4,5,0),
  t(83403,5,5,0),t(83803,4,5,0),s(84203,85803,[[84203,2.5,4],[84403,2.5,4],[84703,2,3],[84803,3.5,3],[85203,1.5,3],[85603,1.5,2],[85803,2,2]],1),t(84603,5,5,0),
  t(84803,2,5,0),t(85003,0,5,0),t(85203,3,5,0),t(85403,3,5,0),
  t(86203,0,5,0),t(86403,0,5,0),t(86603,0,5,0),t(87003,0,5,0),
  t(87203,0,5,0),t(87403,0,5,0),f(87803,0,5),h(88203,3,1,89203,0,[[88203,3,1],[88503,2,4],[88903,2,4],[89203,3,1]]),
  t(88603,0,1,0),t(88803,0,5,0),t(89403,0,5,0),t(89603,0,5,0),
  t(89803,0,5,0),t(90003,0,5,0),t(90203,0,5,0),t(90603,0,4,0),
  t(90603,7,3,0),t(90803,4,5,0),t(91003,5,5,0),t(91203,5,3,0),
  t(91303,2,5,0),t(91403,0,5,0),t(91603,0,5,0),t(91803,0,5,0),
  t(92003,1,4,0),t(92203,2,5,0),t(92603,0,5,0),t(92803,0,5,0),
  t(92903,2,5,0),t(93003,0,5,0),t(93203,4,5,0),f(93403,2,5),
  t(93803,0,5,0),t(94003,2,5,0),t(94203,4,5,0),t(94503,2,5,0),
  t(94603,4,5,0),t(94803,2,5,0),t(95003,4,5,0),t(95403,2,5,0),
  t(95603,0,5,0),t(95803,0,5,0),t(96203,0,5,0),t(96403,6,4,0),
  t(96403,0,3,0),t(96603,2,5,0),t(97003,0,5,0),t(97203,0,5,0),
  t(97403,0,5,0),t(97603,0,5,0),t(97803,0,5,0),t(98003,0,5,0),
  t(98203,0,5,0),t(98603,0,5,0),t(98803,0,5,0),t(99003,0,5,0),
  t(99203,2,5,0),t(99403,0,5,0),t(99603,4,5,0),t(99803,0,5,0),
  t(100003,4,5,0),t(100203,2,5,0),t(100403,5,5,0),t(100603,2,5,0),
  f(100803,4,5),t(101203,2,5,0),t(101403,0,5,0),h(101703,0,5,102203),
  t(102303,1,5,0),t(102403,0,5,0),t(102603,0,8,0),t(102803,4,5,0),
  t(103003,2,5,0),t(103203,0,4,0),t(103203,7,3,0),h(103403,0,5,104003,0,[[103403,0,5],[103703,2,1],[104003,0,5]]),
  t(104203,0,5,0),t(104403,0,5,0),t(104603,2,5,0),t(104803,0,5,0),
  t(105003,0,5,0),t(105203,2,5,0),t(105403,5,5,0),t(105603,0,4,0),
  t(105603,7,3,0),f(105803,2,5),t(106203,4,5,0),t(106403,3,4,0),
  t(106603,0,5,0),t(106803,0,5,0),t(107003,0,5,0),t(107203,0,5,0),
  h(107403,0,5,107903),t(108003,4,5,0),t(108203,2,5,0),t(108403,0,5,0),
  t(108603,0,5,0),t(108803,0,5,0),t(109003,1,5,0),t(109103,0,5,0),
  t(109403,0,5,0),t(109603,3,3,0),t(109703,5,5,0),t(109803,3,4,0),
  t(110203,6,4,0),t(110203,0,3,0),t(110403,4,5,0),t(110603,4,5,0),
  t(110803,5,5,0),t(111003,5,5,0),t(111203,5,5,0),t(111403,5,5,0),
  t(111603,5,5,0),t(111803,5,5,0),f(112203,4,5),t(112603,5,5,4),
  t(113003,4,5,0),h(113203,2,5,114003),h(114203,1,5,115303),t(114603,0,5,0),
  t(114803,0,5,0),t(115403,0,5,0),t(115803,0,5,0),h(116203,0,5,116703),
  h(117003,0,5,117403),t(117603,0,5,0),t(117803,4,5,0),t(118003,5,5,0),
  h(118103,4,5,118703),t(118803,5,5,0),t(119003,2,5,0),t(119203,4,5,0),
  t(119403,6,4,0),t(119403,0,3,0),t(119603,4,5,0),t(119803,0,5,0),
  t(120003,3,4,0),t(120203,4,5,0),h(120403,7,1,122003,0,[[120403,7,1],[120803,7,2],[121203,6,3],[121603,6,4],[122003,5,5]]),t(120803,9,1,0),
  t(121003,3,5,0),f(121403,0,5),h(122203,2,5,122703),t(122803,0,5,0),
  t(123103,4,5,0),t(123203,2,5,0),t(123403,5,5,0),t(123703,5,5,0),
  t(123803,4,5,0),t(124003,5,5,0),t(124203,4,5,0),t(124403,5,5,0),
  t(124603,2,5,0),t(124803,6,4,0),t(124803,0,3,0),t(125003,0,5,0),
  t(125203,0,5,0),t(125403,2,5,0),t(125603,0,5,0),t(125703,1,5,0),
  t(125803,2,5,0),t(126003,4,5,0),t(126203,5,5,0),t(126403,4,5,0),
  t(126603,2,5,0),t(126703,0,3,0),t(126803,2,5,0),t(126903,3,5,0),
  t(127003,2,5,0),t(127203,2,8,0),
// </dullahan-v3-expert-notes>
])(mhTap,mhHoldV2,mhFlick,mhSlideV2);
const dullahanMasterNotes=((t,h,f,s)=>[
// <dullahan-v3-master-notes>
  t(1803,0,6,0),f(2203,3,4),t(2603,5,4,0),t(3003,1,2,0),
  t(3003,5,2,0),t(3203,3,2,0),t(3203,7,2,0),t(3403,1,2,0),
  t(3403,5,2,0),t(3603,3,2,0),t(3603,7,2,0),t(3803,6,4,0),
  t(4203,5,3,0),t(4403,7,3,0),t(4503,5,4,0),t(5003,6,4,0),
  t(5803,0,2,0),t(5803,4,2,0),t(6003,1,2,0),t(6003,5,2,0),
  t(6203,3,2,0),t(6203,7,2,0),t(6403,4,2,0),t(6403,8,2,0),
  t(6603,1,4,0),t(6803,3,4,0),t(7003,1,4,0),t(7303,3,4,0),
  t(7603,5,4,0),h(7703,1,2,10103),h(8203,5,1,9803,0,[[8203,5,1],[8603,4,2],[9003,4,3],[9403,4,3],[9803,3,4]]),t(10003,6,2,0),
  t(10203,3,4,0),t(10503,6,4,0),t(10803,5,4,0),t(11403,4,2,0),
  t(11803,2,2,0),h(12203,0,2,12603),t(12803,2,2,0),t(13003,3,4,0),
  t(13203,5,4,0),t(13403,3,4,0),t(13503,1,4,0),t(13803,4,2,0),
  t(14003,5,3,0),t(14203,2,2,0),t(14203,6,2,0),t(14603,2,2,0),
  t(14603,7,2,0),t(15003,1,2,0),t(15003,8,2,0),t(15403,0,2,0),
  t(15403,8,2,0),t(15803,3,3,0),t(15903,5,4,0),t(16203,3,4,0),
  t(16403,1,4,0),f(16603,0,4),t(17003,0,4,0),t(17203,1,4,0),
  t(17403,0,3,0),t(17503,1,4,0),t(17803,0,4,0),t(18203,3,4,0),
  t(18503,6,4,0),t(18803,3,4,0),t(19403,5,4,0),t(19603,6,4,0),
  t(19803,5,4,0),t(20203,6,4,0),t(20503,5,4,0),t(20603,6,4,0),
  t(20703,5,4,0),t(21003,6,4,0),t(21203,0,2,0),t(21203,4,2,0),
  t(21503,4,2,0),t(21503,8,2,0),t(21803,0,2,0),t(21803,4,2,0),
  t(22103,4,2,0),t(22103,8,2,0),t(22303,0,4,0),t(22603,1,4,0),
  t(22803,0,4,0),t(22903,3,4,0),t(23003,1,4,0),h(23203,0,2,23603),
  f(23803,2,2),t(24203,0,2,0),t(24203,4,2,0),t(24603,1,2,0),
  t(24603,5,2,0),t(25003,3,2,0),t(25003,7,2,0),t(25403,4,2,0),
  t(25403,8,2,0),t(25603,1,3,0),t(25803,4,2,0),t(26003,5,3,0),
  t(26203,3,4,0),t(26603,5,4,0),t(26803,3,4,0),t(27003,1,4,0),
  t(27203,0,4,0),t(27603,3,4,0),t(27803,5,4,0),t(28203,2,6,0),
  t(28403,1,4,0),t(28603,3,4,0),t(28803,1,4,0),t(29203,3,4,0),
  t(29403,5,4,0),t(29603,1,4,0),t(29803,3,4,0),t(30003,5,4,0),
  f(30203,6,4),t(31003,5,4,0),t(31203,6,4,0),t(31403,5,3,0),
  t(31603,6,4,0),f(31803,3,3),t(32203,5,4,0),t(32403,6,4,0),
  t(32603,5,4,0),t(32603,0,3,0),t(32803,3,4,0),t(33003,5,4,0),
  t(33203,3,4,0),t(33403,1,4,0),t(33603,0,4,0),t(33703,1,4,0),
  t(33803,0,3,0),t(33903,2,3,0),t(34003,0,4,0),t(34203,1,4,0),
  t(34403,3,4,0),t(34603,5,4,0),t(34803,6,4,0),t(35003,5,3,0),
  t(35203,3,4,0),t(35303,1,4,0),t(35503,0,4,0),t(35603,3,4,0),
  t(35803,1,4,0),t(36003,5,4,0),t(36203,5,4,0),t(36303,6,4,0),
  t(36403,5,4,0),t(36603,6,4,0),t(36803,3,4,0),t(36903,6,4,0),
  t(37203,3,4,0),t(37403,6,4,0),t(37403,1,3,0),t(37603,5,4,0),
  t(37703,3,4,0),t(37803,5,3,0),t(37903,3,3,0),t(38003,5,4,0),
  t(38203,3,3,0),t(38303,1,4,0),t(38503,0,3,0),t(38603,1,4,0),
  t(38803,5,4,0),t(39003,3,4,0),f(39303,6,4),t(39803,6,4,1),
  t(40203,5,4,0),t(40603,3,4,0),s(41003,42603,[[41003,3,2],[41103,4,2],[41203,4,2],[41303,4,2],[41403,4,2],[41503,4,3],[41603,4,3],[41703,4,3],[41803,3,3],[41903,3,3],[42003,3,3],[42103,3,3],[42203,4,2],[42303,4,2],[42403,4,2],[42503,3,2],[42603,3,2]]),s(41403,42603,[[41403,2,2],[42603,0,2]]),
  t(42803,6,4,0),t(43003,5,4,0),t(43403,6,4,0),t(43603,5,4,0),
  t(43803,3,4,0),t(44003,1,4,0),t(44403,1,4,0),t(44603,0,4,0),
  t(44903,1,4,0),t(45003,0,4,0),t(45103,1,4,0),t(45403,2,4,0),
  t(45503,1,3,0),f(45703,0,4),t(46103,0,4,0),t(46203,1,4,0),
  t(46303,0,3,0),t(46603,2,2,0),t(46603,6,2,0),t(46803,3,4,0),
  t(47403,5,4,0),t(47503,3,3,0),t(47703,1,3,0),t(47803,5,4,0),
  t(48003,1,4,0),t(48003,7,3,0),t(48203,0,6,0),t(48403,0,2,0),
  t(48503,0,4,0),t(48603,3,3,0),h(49003,0,4,50103,0,[[49003,0,4],[49403,1,3],[49703,1,2],[50103,2,1]]),t(49403,3,4,0),
  t(49603,3,4,0),t(50203,5,4,0),t(50603,6,4,0),t(51003,5,4,2),
  t(51403,1,4,0),t(51503,5,4,0),t(51603,3,4,0),t(51703,7,3,0),
  f(51803,3,4),t(52203,1,3,0),t(52403,0,4,0),t(52603,1,4,0),
  t(52803,0,4,0),t(53003,1,4,0),t(53203,3,4,0),t(53403,5,4,0),
  t(53803,6,4,0),t(54003,5,4,0),t(54203,3,4,0),t(54403,1,4,0),
  t(54603,3,4,0),t(54803,5,4,0),t(55003,3,4,0),t(55403,1,4,0),
  t(55603,0,4,0),t(55803,1,4,0),t(56003,3,4,0),t(56203,5,4,0),
  f(56603,5,4),t(57003,6,4,0),t(57303,5,4,0),t(57403,6,4,0),
  t(57703,5,4,0),t(57803,1,4,0),t(58003,3,4,0),h(58203,0,4,58703),
  t(58803,1,4,0),t(59003,3,4,0),t(59203,5,4,0),t(59403,6,4,0),
  h(59503,3,4,60003),t(60203,5,4,0),t(60403,6,4,0),t(60603,5,4,0),
  t(60803,6,4,0),t(60903,5,4,0),f(61003,3,4),t(61403,5,4,0),
  t(61603,6,4,0),t(61803,6,4,0),t(62003,6,4,0),t(62203,6,4,0),
  t(62403,6,4,0),t(62503,5,4,0),t(62603,6,4,0),t(62803,5,4,0),
  t(63003,1,4,0),t(63103,3,3,0),t(63303,5,4,0),t(63403,6,4,0),
  t(63603,1,4,0),t(63603,7,3,0),t(63803,5,4,0),t(63903,3,4,0),
  t(64003,2,3,0),t(64103,3,3,0),t(64203,1,4,0),t(64303,3,4,0),
  t(64403,1,4,0),t(64603,0,4,0),t(64803,1,4,0),t(65003,3,4,0),
  t(65203,1,4,0),t(65403,3,4,0),t(65603,6,4,0),t(65603,1,3,0),
  t(65903,3,4,0),t(66003,6,4,0),t(66203,5,4,0),t(66403,5,4,0),
  t(66603,6,4,0),t(66803,6,4,0),t(67003,3,4,0),t(67203,5,4,0),
  t(67403,6,4,0),t(67503,4,6,0),t(67603,2,4,0),t(67803,3,3,0),
  t(68003,5,4,0),t(68203,6,4,0),t(68403,3,4,0),t(68603,5,4,0),
  t(68803,3,4,0),t(69103,1,4,0),t(69203,0,4,0),t(69403,3,4,0),
  t(69603,0,4,0),t(69803,3,3,0),t(70003,0,4,0),t(70203,3,4,0),
  t(70403,0,4,0),t(70703,3,3,0),t(70803,0,4,0),t(71003,2,4,0),
  t(71103,1,3,0),t(71203,0,2,0),t(71403,1,3,0),t(71403,6,3,0),
  t(71603,2,2,0),t(71803,0,4,0),t(72003,1,4,0),t(72103,0,3,0),
  t(72303,2,3,0),t(72403,0,4,0),t(72603,1,3,0),t(72803,0,4,0),
  t(73003,0,4,0),t(73203,1,4,0),t(73403,0,3,0),f(73603,1,4),
  t(74003,5,4,0),t(74203,3,3,0),t(74403,1,3,0),t(74603,0,4,0),
  t(74803,1,4,0),t(75003,0,3,0),t(75203,1,4,0),t(75503,2,4,0),
  t(75603,3,4,0),t(75803,5,4,0),t(76003,6,4,0),t(76003,1,3,0),
  t(76203,5,3,0),t(76303,3,3,0),t(76403,1,3,0),h(76603,3,4,77103),
  t(77203,6,4,0),t(77303,4,1,0),f(77403,4,4),t(77803,3,4,0),
  t(78003,6,4,0),t(78203,5,4,0),t(78403,3,4,0),t(78603,1,4,0),
  t(78803,0,4,0),f(79003,3,4),t(79403,1,4,3),t(79803,0,4,0),
  t(80203,1,4,0),t(80403,0,4,0),t(80603,1,4,0),t(80803,4,2,0),
  t(81003,5,4,0),t(81403,6,4,0),t(81603,5,4,0),t(81703,3,3,0),
  t(81803,5,4,0),t(82003,3,4,0),f(82203,5,4),t(82603,3,4,0),
  t(82803,1,4,0),t(83003,3,4,0),t(83203,1,4,0),t(83403,3,4,0),
  t(83803,5,4,0),s(84203,85803,[[84203,3,3],[84403,3,3],[84703,2.5,2],[84803,4,2],[85203,2,2],[85603,2,2],[85803,2.5,2]],1),t(84603,6,4,0),t(84803,4,4,0),
  s(85003,85803,[[85003,1,2],[85803,0,2]]),t(86203,6,4,0),t(86203,1,3,0),t(86403,6,4,0),
  t(86603,3,4,0),t(87003,5,4,0),t(87203,6,4,0),t(87403,5,4,0),
  t(87803,4,6,0),t(88003,5,4,0),h(88203,2,4,89203),t(88603,7,3,0),
  f(88803,3,4),t(89303,2,3,0),t(89403,0,4,0),t(89603,1,4,0),
  t(89803,3,4,0),t(90003,1,4,0),t(90103,0,4,0),t(90203,1,4,0),
  t(90603,3,3,0),t(90803,5,4,0),t(91003,6,4,0),t(91103,5,4,0),
  t(91203,8,2,0),t(91303,5,4,0),t(91403,6,4,0),t(91603,1,4,0),
  t(91603,7,3,0),t(91803,5,4,0),t(92003,7,3,0),t(92203,5,4,0),
  t(92403,2,2,0),t(92603,5,4,0),t(92803,3,4,0),t(92903,6,4,0),
  t(93003,5,4,0),t(93203,3,4,0),t(93403,1,4,0),t(93603,0,3,0),
  t(93803,1,4,0),t(94003,3,4,0),t(94203,5,4,0),t(94503,6,4,0),
  t(94603,3,4,0),t(94803,5,4,0),f(95003,6,4),t(95403,5,4,0),
  t(95603,1,4,0),t(95803,5,4,0),t(95903,3,4,0),t(96203,6,4,0),
  t(96403,7,3,0),t(96603,6,4,0),t(96803,6,4,0),t(97003,6,4,0),
  t(97203,5,4,0),t(97403,6,4,0),t(97603,5,4,0),t(97803,6,4,0),
  t(97803,1,3,0),t(98003,3,4,0),t(98203,5,4,0),t(98403,6,4,0),
  t(98603,5,4,0),t(98803,3,4,0),t(99003,6,4,0),t(99203,3,4,0),
  t(99403,6,4,0),t(99603,3,4,0),t(99803,1,4,0),t(100003,0,4,0),
  t(100203,1,4,0),t(100403,0,4,0),t(100603,1,4,0),f(100803,0,4),
  t(101203,1,4,0),t(101403,3,4,0),h(101603,6,1,102203,0,[[101603,6,1],[101903,5,4],[102203,6,1]]),t(102303,6,4,0),
  t(102403,5,4,0),t(102603,6,4,0),t(102803,5,4,0),t(103003,5,4,0),
  t(103203,7,3,0),h(103403,6,4,104003,0,[[103403,6,4],[103703,8,1],[104003,6,4]]),t(104203,1,4,0),t(104403,3,4,0),
  t(104603,5,4,0),t(104803,6,4,0),t(105003,1,4,0),t(105003,7,3,0),
  t(105203,5,4,0),t(105403,6,4,0),t(105603,5,3,0),t(105803,5,4,0),
  t(106003,3,3,0),t(106203,1,4,0),t(106403,0,3,0),t(106603,0,6,0),
  t(106803,0,4,0),t(107003,0,4,0),t(107203,0,4,0),t(107303,1,4,0),
  h(107403,0,4,107903),t(108003,1,4,0),t(108203,1,4,0),t(108303,0,4,0),
  t(108403,3,4,0),t(108603,1,4,0),t(108803,5,4,0),t(109003,6,4,0),
  t(109103,5,4,0),t(109203,6,4,0),t(109403,5,4,0),t(109603,4,2,0),
  t(109703,6,4,0),t(109803,3,3,0),t(109903,8,2,0),t(110203,7,3,0),
  t(110403,6,4,0),t(110603,6,4,0),t(110603,1,3,0),t(110803,6,4,0),
  t(111003,3,4,0),t(111203,1,4,0),t(111303,3,4,0),t(111403,5,4,0),
  t(111603,5,4,0),f(111803,5,4),t(112203,6,4,4),t(112603,6,4,0),
  t(113003,3,4,0),h(113203,6,4,114003),f(113603,3,4),h(114203,6,4,115303),
  t(114603,0,4,0),t(114803,0,4,0),f(115403,0,4),t(115803,0,4,0),
  h(116203,5,4,116703),h(117003,3,4,117403),t(117603,1,4,0),t(117803,0,4,0),
  t(117903,0,2,0),t(118003,3,4,0),h(118103,1,4,118703),t(118803,5,4,0),
  t(119003,1,4,0),t(119203,3,4,0),t(119403,5,3,0),t(119603,6,4,0),
  t(119803,5,4,0),t(119803,0,3,0),t(120003,3,3,0),t(120203,1,4,0),
  t(120403,0,4,0),h(120503,5,1,122003,0,[[120503,5,1],[120903,4,2],[121303,4,3],[121603,4,3],[122003,3,4]]),t(121003,7,3,0),t(121203,5,4,0),
  f(121403,1,4),h(122203,3,4,122703),t(122803,0,4,0),t(123103,1,4,0),
  t(123203,0,4,0),t(123403,1,4,0),t(123703,5,4,0),t(123803,1,4,0),
  t(124003,3,4,0),t(124203,0,4,0),t(124403,0,4,0),t(124603,3,4,0),
  t(124803,0,3,0),t(125003,3,4,0),t(125103,1,3,0),t(125203,5,4,0),
  t(125403,3,4,0),t(125603,6,4,0),t(125703,5,4,0),t(125803,6,4,0),
  t(126003,5,4,0),t(126103,8,2,0),t(126203,3,4,0),t(126403,1,4,0),
  t(126403,7,3,0),t(126603,3,4,0),t(126703,2,2,0),t(126803,0,4,0),
  t(126903,3,4,0),t(127003,0,4,0),t(127103,4,2,0),t(127203,0,6,0),
// </dullahan-v3-master-notes>
])(mhTap,mhHoldV2,mhFlick,mhSlideV2);
// トリコ（1分19秒）。譜面はV3パイプラインが入れる。
// ユーザーからmp4で受け取った曲。映像はまっ黒だったので音源だけを取り出し、
// 32kHz/96kbpsのmp3にしてある(0.91MB)。切り出しはしていないので全尺で遊ぶ。
const TORIKO_DURATION_MS=79380;
const torikoEasyNotes=((t,h,f,s)=>[
// <toriko-v3-easy-notes>
  t(2477,0,10,0),t(4477,0,6,0),t(6699,1,4,0),t(8699,2,6,0),
  t(10033,4,6,0),t(10700,4,6,0),t(13366,5,4,0),t(15144,2,6,0),
  t(17811,0,6,1),t(19144,2,6,0),t(20478,4,6,0),t(21811,4,6,0),
  h(23145,6,3,23923,0,[[23145,6,3],[23589,5,4],[23923,4,6]]),t(24034,5,4,0),t(26701,2,6,0),t(28478,0,6,0),
  t(29367,0,3,0),t(29367,7,3,0),t(31145,4,6,0),t(33368,4,6,2),
  t(34034,6,4,0),t(35368,4,6,0),t(36701,3,4,0),t(39368,1,4,0),
  t(40701,2,6,0),t(41146,4,6,0),t(41813,4,6,0),t(43368,5,4,0),
  t(44702,3,4,0),t(46035,0,6,0),t(47368,2,6,0),t(48480,5,4,3),
  t(49813,4,6,0),h(50702,4,6,51258),t(52480,4,6,0),t(53813,2,6,0),
  t(55147,0,6,0),t(56036,3,4,0),t(56480,0,6,0),t(57814,2,6,0),
  t(58703,5,4,0),t(60480,2,6,0),t(61369,5,4,0),t(63147,2,6,4),
  t(63814,4,6,0),t(64036,6,4,0),t(65814,4,6,0),t(66259,3,4,0),
  h(66703,1,4,67147),t(68481,0,6,0),t(69370,0,4,0),t(71148,0,3,0),
  t(71148,7,3,0),h(71592,0,6,72259,0,[[71592,0,6],[71926,1,4],[72259,2,3]]),h(73370,2,6,73926),t(76481,0,10,0),
  t(77370,6,4,0),
// </toriko-v3-easy-notes>
])(mhTap,mhHoldV2,mhFlick,mhSlideV2);
const torikoNormalNotes=((t,h,f,s)=>[
// <toriko-v3-normal-notes>
  t(2477,0,10,0),f(3144,5,4),t(6699,6,4,0),t(8477,4,6,0),
  t(8699,4,6,0),t(10033,4,6,0),t(10700,4,6,0),t(13366,3,4,0),
  t(15144,0,6,0),t(16033,3,4,0),t(17811,4,6,1),t(19144,4,6,0),
  t(20478,4,6,0),t(21811,2,6,0),h(23145,2,2,23923,0,[[23145,2,2],[23589,1,4],[23923,0,6]]),t(24034,5,4,0),
  t(25145,4,6,0),t(26701,4,6,0),f(28478,2,6),t(29367,7,3,0),
  t(29367,0,3,0),t(31145,4,6,0),t(31812,4,6,0),t(33368,2,6,2),
  t(34034,5,4,0),t(35368,4,6,0),t(36701,5,4,0),t(38479,2,6,0),
  t(39368,6,4,0),t(40701,2,6,0),t(41146,4,6,0),t(41813,4,6,0),
  t(43368,6,4,0),t(44702,5,4,0),f(45146,4,6),t(46035,4,6,0),
  t(47368,2,6,0),t(48480,1,4,3),t(49146,0,6,0),t(49813,0,6,0),
  h(50702,0,6,51258,1),t(52480,0,6,0),h(53147,4,6,54036),t(55147,2,6,0),
  t(56036,5,4,0),t(56480,4,6,0),t(57814,4,6,0),t(58703,6,4,0),
  t(60036,7,3,0),t(60036,0,3,0),t(60480,2,6,0),f(61369,5,4),
  t(63147,0,6,4),t(63814,4,6,0),t(64036,3,4,0),t(64481,4,6,0),
  t(65814,4,6,0),t(66259,3,4,0),h(66703,1,4,67147),t(68481,2,6,0),
  t(69370,1,4,0),t(69814,0,6,0),t(71148,0,3,0),t(71148,7,3,0),
  h(71592,0,6,72259,0,[[71592,0,6],[71926,1,4],[72259,2,2]]),t(72481,0,6,0),h(73370,0,6,73926),t(76481,0,10,0),
  f(77370,6,4),
// </toriko-v3-normal-notes>
])(mhTap,mhHoldV2,mhFlick,mhSlideV2);
const torikoHardNotes=((t,h,f,s)=>[
// <toriko-v3-hard-notes>
  t(2477,0,8,0),f(3144,5,4),t(4477,5,5,0),t(6699,5,4,0),
  t(7144,5,5,0),t(8477,4,5,0),t(8699,4,5,0),t(10033,2,5,0),
  t(10700,5,5,0),t(11811,2,5,0),h(12477,4,5,12922,1),t(13366,3,4,0),
  t(15144,0,5,0),t(16033,3,4,0),t(17811,4,5,1),t(18478,4,5,0),
  t(19144,5,5,0),t(19811,4,5,0),t(20478,2,5,0),t(21367,0,4,0),
  t(21367,7,3,0),f(21811,0,5),s(23145,23923,[[23145,1,4],[23256,1,4],[23367,0,3],[23478,0,3],[23589,1.5,3],[23700,1.5,3],[23811,0,2],[23923,0,2]]),t(24034,5,4,0),
  t(25145,0,5,0),t(25812,4,5,0),t(26701,2,5,0),h(28145,4,5,28590),
  t(29367,3,4,0),s(30812,31923,[[30812,1,4],[30923,0,4],[31034,0,4],[31145,0,3],[31256,0,3],[31367,0,3],[31479,0,3],[31590,0,3],[31701,0,2],[31812,0,2],[31923,0,2]]),t(32034,0,4,2),t(33368,0,5,0),
  t(34034,3,4,0),t(35368,4,5,0),t(35812,4,5,0),t(36479,6,1,0),
  t(36701,5,4,0),t(38479,2,5,0),h(38812,5,5,39368),f(40701,5,5),
  t(41146,5,5,0),t(41813,5,5,0),t(42035,6,4,0),t(43368,5,4,0),
  t(43813,2,5,0),t(44035,5,3,0),t(44702,0,4,0),t(44702,7,3,0),
  t(45146,0,5,0),t(46035,2,5,0),t(46480,4,5,0),t(47368,2,5,0),
  t(48146,0,5,0),t(48480,0,4,0),t(49480,0,5,0),t(49813,0,5,0),
  h(50480,4,1,51258,0,[[50480,4,1],[50924,3,3],[51258,2,5]]),t(52480,0,5,3),t(53147,4,5,0),f(53369,2,5),
  t(53813,4,5,0),t(55147,2,5,0),t(55591,5,4,0),t(56036,6,4,0),
  t(56480,4,5,0),t(57369,2,5,0),t(57480,4,5,0),t(57814,2,5,0),
  t(58703,6,4,0),t(58703,0,3,0),t(60036,0,4,0),t(60480,0,5,0),
  t(61147,2,5,0),t(61369,5,4,0),t(61814,5,5,4),t(63147,0,5,0),
  t(63814,2,5,0),t(64036,1,4,0),f(64481,4,5),t(64925,3,4,0),
  t(65481,5,5,0),t(65814,5,5,0),t(66259,3,4,0),h(66703,0,4,67147,1),
  t(68481,4,5,0),t(68814,3,4,0),t(69370,1,4,0),t(69814,0,5,0),
  t(71148,0,4,0),t(71148,7,3,0),s(71592,72259,[[71592,1,4],[71926,1,3],[72148,1,2],[72259,3,2]]),t(72481,2,5,0),
  t(72814,4,5,0),h(73370,2,5,73926),t(74148,0,5,0),s(74703,76370,[[74703,1,2],[74815,1.5,3],[74926,1.5,3],[75037,1.5,3],[75370,0.5,4],[75815,0.5,4],[76259,0,3],[76370,0,2]]),
  t(76481,0,8,0),f(77370,1,4),
// </toriko-v3-hard-notes>
])(mhTap,mhHoldV2,mhFlick,mhSlideV2);
const torikoExpertNotes=((t,h,f,s)=>[
// <toriko-v3-expert-notes>
  t(2477,2,8,0),f(3144,3,4),t(3588,0,5,0),t(4477,0,5,0),
  t(6699,1,4,0),t(7144,2,5,0),t(8477,0,5,0),t(8699,2,5,0),
  t(9144,4,5,0),t(10033,0,2,0),t(10033,4,2,0),t(10366,2,2,0),
  t(10366,6,2,0),t(10700,4,2,0),t(10700,8,2,0),h(12477,0,5,12922),
  t(13144,4,5,0),t(13366,3,4,0),t(13811,2,5,0),t(15144,2,5,0),
  t(16033,5,4,0),h(16478,2,5,16922,1),f(17811,5,5),t(18700,5,4,1),
  t(19144,2,5,0),t(19811,0,5,0),t(20478,0,5,0),t(21367,0,4,0),
  t(21367,7,3,0),t(21811,0,5,0),t(22034,0,5,0),t(22811,2,5,0),
  s(23145,23923,[[23145,3,4],[23256,3,4],[23367,1.5,3],[23478,1.5,3],[23589,3.5,3],[23700,3.5,3],[23811,1.5,2],[23923,1.5,2]]),t(24034,6,4,0),t(25145,4,5,0),t(25812,2,5,0),
  t(26701,0,5,0),t(27145,0,5,0),h(28145,0,5,28590),t(29367,3,4,0),
  f(29812,2,5),s(30812,31923,[[30812,3,4],[30923,1,4],[31034,1,4],[31145,1.5,3],[31256,1.5,3],[31367,1.5,3],[31479,1,3],[31590,1,3],[31701,1,2],[31812,1,2],[31923,1.5,2]]),s(30923,31479,[[30923,4,2],[31479,3,2]]),t(32034,3,4,2),
  t(33368,0,5,0),t(33479,4,5,0),t(34034,1,4,0),t(35368,0,5,0),
  t(35812,0,5,0),t(36479,2,1,0),t(36701,1,4,0),t(38035,3,4,0),
  t(38479,4,5,0),h(38812,5,5,39368),t(39812,0,5,0),t(40479,4,1,0),
  t(40701,4,5,0),f(41146,5,5),t(41813,4,5,0),t(42035,3,4,0),
  t(43146,4,1,0),t(43368,1,4,0),t(43813,2,5,0),t(44035,1,3,0),
  t(44035,7,3,0),t(44702,0,4,0),t(45146,0,5,0),t(46035,2,5,0),
  t(46480,4,5,0),t(46813,0,5,0),t(47368,0,5,0),t(47813,0,5,0),
  t(48146,2,5,0),t(48480,6,4,0),t(49480,2,5,0),f(49813,4,5),
  h(50480,7,1,51258,0,[[50480,7,1],[50924,6,3],[51258,5,5]]),t(51813,4,5,0),t(52480,4,5,3),t(53147,2,5,0),
  t(53369,4,5,0),t(53813,2,5,0),t(54147,5,5,0),t(55147,0,5,0),
  t(55591,3,4,0),t(56036,5,4,0),t(56480,5,5,0),t(56702,4,5,0),
  t(57369,5,5,0),t(57480,4,5,0),t(57814,5,5,0),t(58703,3,4,0),
  f(59147,4,5),t(60036,6,4,0),t(60036,0,3,0),t(60480,4,5,0),
  t(61147,2,5,0),t(61369,5,4,0),t(61703,3,4,0),t(61814,4,5,0),
  t(63147,0,5,4),t(63592,1,4,0),t(63814,2,5,0),t(64036,5,4,0),
  t(64481,5,5,0),t(64703,4,5,0),t(64925,1,4,0),t(65481,4,5,0),
  t(65814,2,5,0),t(66259,6,4,0),h(66703,5,4,67147,1),f(67814,2,5),
  t(68481,4,5,0),t(68814,1,4,0),t(69370,3,4,0),t(69814,4,5,0),
  t(70259,6,4,0),t(70703,5,4,0),t(71148,6,4,0),s(71592,72259,[[71592,3,4],[71926,2.5,3],[72148,2.5,2],[72259,4,2]]),
  s(71592,72259,[[71592,1,2],[72259,0,2]]),t(72481,5,5,0),t(72814,4,5,0),t(72926,6,4,0),
  t(72926,0,3,0),h(73370,4,5,73926),t(74148,5,5,0),s(74703,76370,[[74703,3,2],[74815,3.5,3],[74926,3.5,3],[75037,3,3],[75370,2,4],[75815,2,4],[76259,1,3],[76370,1,2]]),
  t(76481,0,8,0),f(77370,6,4),
// </toriko-v3-expert-notes>
])(mhTap,mhHoldV2,mhFlick,mhSlideV2);
const torikoMasterNotes=((t,h,f,s)=>[
// <toriko-v3-master-notes>
  t(2477,4,6,0),f(3144,3,3),t(3588,1,4,0),t(4477,0,4,0),
  t(5810,1,3,0),t(6699,3,3,0),t(7144,5,4,0),t(8477,1,4,0),
  t(8477,7,3,0),t(8699,3,4,0),t(9144,5,4,0),t(10033,6,4,0),
  t(10366,5,4,0),t(10700,3,4,0),t(11811,5,4,0),h(12477,6,4,12922,1),
  t(13366,5,3,0),t(13811,6,4,0),t(14478,5,4,0),f(15144,6,4),
  t(16033,5,3,1),h(16478,6,4,16922),t(17811,0,2,0),t(17811,4,2,0),
  t(18478,4,2,0),t(18478,8,2,0),t(19144,0,2,0),t(19144,4,2,0),
  t(19811,4,2,0),t(19811,8,2,0),t(20478,5,4,0),t(21145,3,4,0),
  t(21367,1,3,0),t(21811,3,4,0),t(22034,0,4,0),t(22811,1,4,0),
  s(23145,23923,[[23145,2,3],[23256,2,3],[23367,0.5,2],[23478,0.5,2],[23589,2.5,2],[23700,2.5,2],[23811,1,2],[23923,1,2]]),t(24034,5,3,0),t(24034,0,3,0),t(24478,6,4,0),
  t(25145,5,4,0),f(25812,1,4),t(26701,5,4,0),t(27145,3,4,0),
  h(28145,5,4,28590),t(29367,3,3,0),t(29812,6,4,0),s(30812,31923,[[30812,3,3],[30923,1,3],[31034,1,3],[31145,1.5,2],[31256,1.5,2],[31367,1.5,2],[31479,1,2],[31590,1,2],[31701,1,2],[31812,1,2],[31923,1.5,2]]),
  s(31479,31923,[[31479,3,2],[31923,4,2]]),t(32034,1,3,0),t(32479,5,4,2),t(33368,3,4,0),
  t(33479,6,4,0),t(34034,5,3,0),t(35368,0,4,0),t(35812,1,4,0),
  h(36479,4,1,36923),t(37146,5,4,0),f(38035,7,3),t(38479,5,4,0),
  h(38812,3,4,39368,1),t(39812,0,4,0),t(40479,4,1,0),t(40701,6,4,0),
  t(40701,1,3,0),t(41146,3,4,0),t(41813,0,4,0),t(42035,3,3,0),
  t(42479,5,4,0),t(43146,4,1,0),t(43368,1,3,0),t(43813,0,4,0),
  t(44035,2,2,0),t(44702,3,3,0),t(45146,0,6,0),t(45813,2,1,0),
  f(46035,3,4),t(46480,5,4,0),t(46813,6,4,0),t(47368,3,4,0),
  t(47813,6,4,0),t(48146,3,4,0),t(48480,5,3,0),t(49146,3,4,0),
  t(49480,5,4,0),t(49813,6,4,0),h(50480,7,1,51258,1,[[50480,7,1],[50924,6,3],[51258,5,4]]),t(52480,1,4,0),
  t(52702,6,2,0),t(53147,1,4,0),t(53147,7,3,0),s(53369,54036,[[53369,1.5,3],[53480,1.5,3],[53702,0,2],[53813,0,2],[54036,0,2]]),
  s(53369,54036,[[53369,3,2],[54036,4,2]]),t(54147,6,4,0),f(55147,5,4),t(55591,3,3,3),
  t(56036,1,3,0),t(56369,0,4,0),t(56480,1,4,0),t(56702,0,4,0),
  t(57369,1,4,0),t(57480,0,4,0),t(57814,0,4,0),t(58703,1,3,0),
  t(59147,3,4,0),t(59814,1,4,0),t(60036,0,3,0),t(60480,1,4,4),
  t(61147,3,4,0),t(61369,5,3,0),t(61703,5,3,0),f(61814,6,4),
  t(63147,1,4,0),t(63481,5,4,0),t(63592,3,3,0),t(63814,6,4,0),
  t(63814,1,3,0),t(64036,0,3,0),t(64481,5,4,0),t(64925,1,3,0),
  t(65481,6,4,0),t(65814,5,4,0),t(66147,3,3,0),t(66259,5,3,0),
  h(66703,3,3,67147),t(67481,1,3,0),t(67814,0,4,0),t(68481,1,4,0),
  f(68814,0,3),t(69370,0,3,0),t(69703,1,3,0),t(69814,0,2,0),
  t(69814,4,2,0),t(70259,1,2,0),t(70259,5,2,0),t(70703,3,2,0),
  t(70703,7,2,0),t(71148,4,2,0),t(71148,8,2,0),s(71592,72259,[[71592,3,3],[71926,2.5,2],[72148,2.5,2],[72259,4,2]]),
  t(72481,5,4,0),t(72814,3,4,0),t(72926,1,3,0),h(73370,0,4,73926),
  t(74148,0,4,0),t(74148,6,3,0),s(74703,76370,[[74703,1.5,2],[74815,2,2],[74926,2,2],[75037,1.5,2],[75370,0.5,3],[75815,0.5,3],[76259,0,2],[76370,0,2]]),s(74703,76370,[[74703,4,2],[76370,2,2]]),
  t(76481,0,6,0),f(77370,7,3),
// </toriko-v3-master-notes>
])(mhTap,mhHoldV2,mhFlick,mhSlideV2);

// 4U ～ひたすら～（2分00秒）。譜面はV3パイプラインが入れる。
// こちらもmp4から音源だけを取り出したもの(1.38MB)。全尺で遊ぶ。
const FOUR_U_DURATION_MS=120490;
const fourUEasyNotes=((t,h,f,s)=>[
// <4u-hitasura-v3-easy-notes>
  t(2064,5,4,0),t(3926,7,3,0),t(6822,5,4,0),h(8271,4,3,9098,0,[[8271,4,3],[8685,3,4],[9098,2,6]]),
  t(11167,1,4,0),t(12202,3,4,0),t(13030,5,4,0),t(17168,6,4,0),
  t(20064,0,10,0),t(20892,2,6,0),t(21720,0,6,0),t(23375,0,6,0),
  t(23789,0,6,0),t(24202,2,6,0),t(24616,0,6,0),t(25030,0,6,1),
  t(26685,0,6,0),t(27099,0,6,0),t(27927,0,3,0),t(27927,7,3,0),
  t(28754,4,6,0),t(29582,6,4,0),t(30410,4,6,0),t(31237,2,6,0),
  t(32065,0,6,0),h(33720,2,6,34444),t(34962,4,6,0),t(36203,2,6,0),
  t(37031,4,6,0),t(37858,4,6,0),t(39514,2,6,0),t(40341,4,6,0),
  t(41169,4,6,0),t(42824,2,6,0),t(43652,4,6,0),t(44479,4,6,0),
  t(44893,4,6,0),t(46134,2,6,0),t(47790,0,6,2),t(48617,2,6,0),
  t(50686,4,6,0),t(51100,4,6,0),t(52755,4,6,0),t(53583,4,6,0),
  t(54825,4,6,0),t(56066,2,6,0),t(56894,0,6,0),t(57721,0,10,0),
  t(58135,0,6,0),t(59376,0,6,0),t(59790,0,6,0),t(61032,0,6,0),
  t(61239,2,6,0),h(62687,0,6,63308),t(63515,2,6,0),t(64342,4,6,0),
  t(65377,0,6,0),t(65997,0,6,0),t(66825,2,6,0),t(67653,4,6,0),
  t(68480,4,6,0),t(68894,7,3,0),t(68894,0,3,0),t(69722,2,6,0),
  h(70549,0,6,71377),t(72618,4,6,3),t(73032,2,6,0),t(73860,0,6,0),
  t(74274,0,4,0),t(75101,0,6,0),t(75929,2,6,0),t(76343,4,6,0),
  t(77584,4,6,0),h(78412,4,6,79033,0,[[78412,4,6],[78722,5,4],[79033,6,3]]),t(79239,2,6,0),t(79653,0,6,0),
  t(80067,0,6,0),t(80895,0,6,0),t(81722,2,6,0),t(82136,4,6,0),
  t(82550,2,6,0),h(82964,3,4,83378),t(84205,0,6,0),t(85033,2,6,0),
  t(85860,0,10,0),t(86274,6,4,0),t(87102,7,3,0),t(87102,0,3,0),
  t(87516,2,6,0),t(88757,0,6,0),t(89171,0,6,0),t(89999,2,6,0),
  t(90412,4,6,0),t(90826,4,6,0),t(91861,2,6,0),t(92481,4,6,0),
  t(93309,2,6,0),t(93723,1,4,0),t(94137,0,6,4),t(94551,1,4,0),
  t(94964,0,6,0),h(95792,0,6,96413),h(96620,0,6,97240),t(97447,0,6,0),
  t(98068,0,6,0),t(98275,0,4,0),t(99102,0,6,0),t(99516,1,4,0),
  t(99930,0,6,0),t(101171,0,4,0),t(101999,0,6,0),t(102413,2,6,0),
  t(102827,4,6,0),t(104068,4,6,0),t(104482,4,6,0),t(105723,0,6,0),
  t(106137,2,6,0),t(106551,4,6,0),t(107379,4,6,0),t(108206,4,6,0),
  t(109034,2,6,0),t(109862,0,6,0),t(111103,0,6,0),t(111517,0,10,0),
  t(112344,0,3,0),t(112344,7,3,0),t(113172,0,4,0),t(113379,0,4,0),
  h(114000,2,3,115655,0,[[114000,2,3],[114413,1,4],[114827,0,6],[115241,1,4],[115655,2,3]]),t(116276,3,4,0),t(117310,5,4,0),
// </4u-hitasura-v3-easy-notes>
])(mhTap,mhHoldV2,mhFlick,mhSlideV2);
const fourUNormalNotes=((t,h,f,s)=>[
// <4u-hitasura-v3-normal-notes>
  f(2064,1,3),t(3926,0,2,0),t(5167,2,2,0),t(6822,3,3,0),
  h(8271,6,2,9098,1,[[8271,6,2],[8685,5,4],[9098,4,6]]),t(11167,3,3,0),t(13030,1,3,0),h(15099,0,3,16754),
  t(17168,1,3,0),t(18823,3,3,0),t(20064,0,10,0),t(21720,2,6,0),
  t(22133,4,6,0),t(23375,2,6,0),t(23789,4,6,0),t(24202,4,6,0),
  t(24616,4,6,0),t(25030,2,6,1),t(26272,0,6,0),f(26685,2,6),
  t(27099,4,6,0),t(27927,7,3,0),t(27927,0,3,0),t(28754,2,6,0),
  t(29582,7,3,0),t(29582,0,3,0),t(30410,2,6,0),t(31237,4,6,0),
  t(32065,4,6,0),t(32272,4,6,0),h(33720,4,6,34444),t(34962,2,6,0),
  t(36203,4,6,0),t(37031,4,6,0),t(37858,2,6,0),t(38686,0,6,0),
  t(39514,0,6,0),f(41169,0,6),t(41996,2,6,0),t(42824,0,6,0),
  t(43652,0,6,0),t(44479,0,6,0),t(44893,2,6,0),t(46134,4,6,0),
  t(46962,0,6,0),t(47790,4,6,2),t(48617,0,6,0),t(50686,0,6,0),
  t(51100,0,6,0),t(51514,2,6,0),t(52755,4,6,0),t(54411,2,6,0),
  f(54825,4,6),t(56066,2,6,0),t(56894,4,6,0),t(57721,0,10,0),
  t(58135,4,6,0),t(59376,2,6,0),t(59790,0,6,0),t(60618,2,6,0),
  t(61032,0,6,0),t(61239,0,6,0),h(62687,0,6,63308,0,[[62687,0,6],[62997,1,4],[63308,2,2]]),t(63515,2,6,0),
  h(63928,6,4,64653),t(65377,2,6,0),t(65997,4,6,0),t(66825,2,6,0),
  f(67653,4,6),t(68480,2,6,0),t(68894,7,3,0),t(68894,0,3,0),
  t(69722,2,6,0),h(70549,4,6,71377),h(71791,0,6,72308),t(72618,2,6,3),
  t(73032,4,6,0),t(73653,4,6,0),t(73860,2,6,0),t(74274,5,3,0),
  t(75101,4,6,0),t(75929,4,6,0),t(76343,2,6,0),t(77584,0,6,0),
  t(78205,0,6,0),h(78412,2,2,79033,0,[[78412,2,2],[78722,0,6],[79033,2,2]]),f(79239,0,6),t(79653,2,6,0),
  t(80067,4,6,0),t(80895,2,6,0),t(81515,0,6,0),t(81722,0,6,0),
  t(82136,0,6,0),h(82964,0,4,83378),t(84205,4,6,0),t(84619,2,6,0),
  t(85033,0,6,0),t(85860,0,6,0),t(86274,7,3,0),t(86274,0,3,0),
  t(87102,3,4,0),t(87516,0,10,0),f(88343,0,6),t(88757,0,6,0),
  t(89171,2,6,0),t(89999,4,6,0),t(90412,2,6,0),t(90826,4,6,0),
  t(91654,6,4,0),t(91861,4,6,0),t(92481,4,6,0),t(93309,4,6,0),
  t(93723,7,3,0),t(93723,0,3,0),t(94137,4,6,4),t(94551,5,4,0),
  t(94964,2,6,0),t(95792,4,6,0),f(96206,3,4),h(96620,4,6,97240),
  t(97447,2,6,0),t(98068,4,6,0),t(98275,7,3,0),t(99102,4,6,0),
  t(99516,6,4,0),t(99930,4,6,0),t(100758,4,6,0),t(101171,7,3,0),
  t(101171,0,3,0),t(101585,4,6,0),t(101999,4,6,0),t(102413,4,6,0),
  t(102827,4,6,0),t(104068,2,6,0),t(104482,4,6,0),f(105723,0,6),
  t(106137,0,6,0),t(106551,2,6,0),t(107379,4,6,0),t(108206,4,6,0),
  t(109034,4,6,0),t(109448,2,6,0),t(109862,0,6,0),t(111103,0,6,0),
  t(111517,0,10,0),t(112344,1,4,0),t(113172,0,4,0),t(113379,0,4,0),
  t(113793,3,4,0),h(114000,4,6,115655,1,[[114000,4,6],[114413,6,4],[114827,7,2],[115241,6,4],[115655,4,6]]),t(116276,5,4,0),f(117310,3,4),
// </4u-hitasura-v3-normal-notes>
])(mhTap,mhHoldV2,mhFlick,mhSlideV2);
const fourUHardNotes=((t,h,f,s)=>[
// <4u-hitasura-v3-hard-notes>
  f(2064,1,3),t(4650,0,3,0),t(5167,2,1,0),t(6822,3,3,0),
  h(8271,6,1,9098,1,[[8271,6,1],[8685,5,3],[9098,4,5]]),t(10133,4,1,0),t(11167,1,3,0),t(12202,0,3,0),
  t(13030,0,3,0),s(15099,16754,[[15099,1,2],[15306,3,3],[15512,3,3],[15719,3,4],[15823,3,4],[15926,3,4],[16133,3,4],[16340,3,3],[16443,3,3],[16547,2,3],[16754,1.5,2]]),t(17168,3,3,0),t(20064,1,8,0),
  t(20892,4,5,0),t(21306,1,3,0),t(21306,7,3,0),t(21720,0,5,0),
  t(22133,2,5,0),t(22961,5,3,0),f(23375,0,5),t(23789,2,5,0),
  t(24202,4,5,0),t(24616,5,5,0),t(25030,4,5,0),t(25444,2,5,1),
  t(26272,4,5,0),t(26685,2,5,0),t(27099,0,5,0),t(27513,0,4,0),
  t(27927,1,3,0),t(28341,3,4,0),t(28754,0,5,0),t(29168,3,3,0),
  t(29582,1,3,0),t(30410,2,5,0),t(31237,4,5,0),f(31651,3,3),
  t(32065,4,5,0),t(32272,5,5,0),t(33513,6,4,0),t(33513,0,3,0),
  h(33720,5,5,34444),t(34548,5,5,0),t(34962,5,5,0),t(36203,2,5,0),
  t(37031,5,5,0),t(37858,2,5,0),t(38686,5,5,0),t(39100,2,5,0),
  t(39514,5,5,0),t(40341,2,5,0),t(41169,5,5,0),t(41996,0,5,0),
  f(42410,2,5),t(42824,4,5,0),t(43238,5,5,0),t(43652,4,5,0),
  t(44479,2,5,0),t(44893,0,5,0),t(46134,0,5,0),t(46548,0,8,0),
  t(46962,2,5,0),t(47790,4,5,0),t(48617,5,5,2),t(49859,2,5,0),
  t(50686,0,5,0),t(51100,2,5,0),t(51514,4,5,0),t(51928,2,5,0),
  t(52755,0,5,0),f(53583,0,5),t(54411,0,5,0),t(54825,0,5,0),
  t(55238,0,5,0),t(56066,2,5,0),t(56894,0,5,0),t(57721,0,5,0),
  t(58135,0,5,0),t(58549,2,5,0),t(59376,4,5,0),t(59790,2,5,0),
  h(60204,0,5,60928),t(61032,2,5,0),t(61239,4,5,0),t(62480,0,5,0),
  h(62687,2,5,63308),f(63515,4,5),s(63928,64653,[[63928,3.5,3],[64239,2.5,3],[64549,1,3],[64653,0.5,3]]),t(65377,2,5,0),
  t(65997,5,5,0),t(66411,0,4,0),t(66411,7,3,0),t(66825,5,5,0),
  t(67239,3,4,0),t(67653,5,5,0),t(68480,2,5,0),t(68894,6,4,0),
  t(69308,2,5,0),t(69722,4,5,0),t(70136,5,5,3),h(70549,4,5,71377,1,[[70549,4,5],[70963,5,3],[71377,6,1]]),
  h(71791,2,5,72308),t(72412,5,4,0),t(72618,2,5,0),f(73032,4,5),
  t(73653,2,8,0),t(73860,4,5,0),t(74274,7,3,0),t(74274,1,3,0),
  t(74688,4,5,0),t(75101,2,5,0),t(75515,0,5,0),t(75929,0,5,0),
  t(76343,0,5,0),t(76757,2,5,0),t(77584,4,5,0),t(77998,3,4,0),
  t(78205,0,5,0),h(78412,2,5,79033),t(79239,4,5,0),t(79653,2,5,0),
  t(79860,2,5,0),f(80067,4,5),t(80481,5,3,0),t(80895,5,5,0),
  t(81309,7,3,0),t(81515,5,5,0),t(81722,4,5,0),t(82136,5,5,0),
  t(82550,4,5,0),h(82964,3,4,83378),t(83791,4,5,0),t(84205,0,5,0),
  t(84619,0,5,0),t(85033,2,5,0),t(85447,5,4,0),t(85860,5,5,0),
  t(86274,5,4,0),f(86688,3,3),t(87102,6,4,0),t(87102,0,3,0),
  t(87516,2,5,0),t(88136,0,5,0),t(88343,2,5,0),t(88757,4,5,0),
  t(89171,0,5,0),t(89585,2,5,0),t(89999,4,5,0),t(90412,5,5,0),
  t(90826,4,5,0),t(91240,2,5,0),t(91447,0,5,0),t(91654,1,4,0),
  t(91861,0,8,0),t(92481,0,5,0),f(92895,3,4),t(93309,0,5,0),
  t(93723,5,4,0),t(94137,2,5,0),t(94551,1,4,4),t(94964,0,5,0),
  t(95171,0,5,0),s(95792,96413,[[95792,2,4],[96102,3,3],[96309,3,2],[96413,4,2]]),h(96620,2,1,97240,0,[[96620,2,1],[96930,0,5],[97240,2,1]]),t(97447,2,5,0),
  t(97861,6,1,0),t(98068,5,5,0),t(98275,3,3,0),t(98896,0,4,0),
  t(99102,2,5,0),t(99516,6,4,0),t(99516,0,3,0),t(99930,2,5,0),
  f(100344,0,3),t(100758,0,5,0),t(101171,3,4,0),t(101378,1,4,0),
  t(101585,0,5,0),t(101999,0,5,0),t(102413,2,5,0),t(102827,0,5,0),
  t(103241,2,5,0),t(104068,4,5,0),t(104482,5,5,0),t(104896,4,5,0),
  t(105723,2,5,0),t(106137,0,5,0),t(106551,0,5,0),t(106965,0,5,0),
  f(107379,0,5),t(108206,2,5,0),t(108620,1,4,0),t(109034,4,5,0),
  t(109448,2,5,0),t(109862,0,5,0),t(110275,0,4,0),t(110689,1,4,0),
  t(111103,2,5,0),t(111517,2,8,0),h(111931,5,5,112655,0,[[111931,5,5],[112344,8,1],[112655,5,5]]),t(113172,1,4,0),
  t(113379,3,4,0),t(113793,6,4,0),t(113793,0,3,0),s(114000,115655,[[114000,3,4],[114207,3,4],[114413,4,3],[114517,4,3],[115034,4,3],[115655,2.5,2]],1),
  t(116276,5,4,0),t(117310,3,4,0),f(118138,6,4),
// </4u-hitasura-v3-hard-notes>
])(mhTap,mhHoldV2,mhFlick,mhSlideV2);
const fourUExpertNotes=((t,h,f,s)=>[
// <4u-hitasura-v3-expert-notes>
  f(2064,5,3),t(4650,3,3,0),t(5167,6,1,0),t(6822,3,3,0),
  t(7236,7,3,0),h(8271,6,1,9098,1,[[8271,6,1],[8685,5,3],[9098,4,5]]),s(8271,10340,[[8271,1,2],[10340,0,2]]),t(10133,4,1,0),
  t(11167,1,3,0),t(12202,3,3,0),t(13030,3,3,0),t(13236,3,3,0),
  s(15099,16754,[[15099,1.5,3],[15409,3.5,3],[15719,3.5,3],[16030,3.5,3],[16340,3,3],[16650,1,3],[16754,0.5,3]]),s(15616,16340,[[15616,0,2],[16340,1,2]]),t(17168,7,3,0),t(18823,5,3,0),
  t(20064,0,8,0),t(20892,2,5,0),t(21306,6,3,0),t(21306,0,3,0),
  t(21720,5,5,0),f(22133,4,5),t(22961,3,3,0),t(23375,0,2,0),
  t(23375,4,2,0),t(23582,2,2,0),t(23582,6,2,0),t(23789,4,2,0),
  t(23789,8,2,0),t(24202,0,5,0),t(24616,2,5,0),t(25030,4,5,0),
  t(25444,2,5,1),t(26272,1,2,0),t(26272,5,2,0),t(26685,3,2,0),
  t(26685,7,2,0),t(27099,1,2,0),t(27099,5,2,0),t(27306,6,4,0),
  t(27513,5,4,0),t(27927,0,3,0),t(28341,3,4,0),f(28754,0,5),
  t(29168,5,3,0),t(29582,3,3,0),t(30410,0,2,0),t(30410,4,2,0),
  t(30823,2,2,0),t(30823,6,2,0),t(31237,4,2,0),t(31237,8,2,0),
  t(31444,5,4,0),t(31651,7,3,0),t(32065,4,5,0),t(32272,2,5,0),
  t(33513,0,4,0),t(33513,7,3,0),h(33720,2,5,34444),t(34548,0,5,0),
  t(34962,0,5,0),t(35375,0,5,0),t(36203,2,5,0),t(37031,0,5,0),
  f(37858,0,5),t(38686,0,5,0),t(39100,0,5,0),t(39514,2,5,0),
  t(40341,0,5,0),t(40755,0,5,0),t(41169,2,5,0),t(41996,0,5,0),
  t(42410,4,5,0),t(42824,2,5,0),t(43238,5,5,0),t(43652,2,5,0),
  t(44065,4,5,0),t(44479,5,5,0),t(44893,4,5,0),t(46134,0,5,0),
  t(46548,2,8,0),f(46962,0,5),t(47790,5,5,0),t(48617,0,5,2),
  t(49031,5,5,0),t(49445,0,5,0),t(49859,5,5,0),t(50686,2,5,0),
  t(51100,4,5,0),t(51514,5,5,0),t(52755,2,5,0),t(53583,4,5,0),
  t(53997,2,5,0),t(54411,0,5,0),t(54825,2,5,0),t(55238,4,5,0),
  t(56066,0,5,0),t(56480,2,5,0),f(56894,4,5),t(57721,5,5,0),
  t(58135,4,5,0),t(58549,2,5,0),t(59376,5,5,0),t(59790,4,5,0),
  t(59997,0,4,0),t(59997,7,3,0),h(60204,0,5,60928,0,[[60204,0,5],[60618,1,3],[60928,2,1]]),t(61032,0,5,0),
  t(61239,0,5,0),h(62066,2,5,62687,1),t(63101,3,4,0),t(63515,0,5,0),
  s(63928,64653,[[63928,4,3],[64239,2.5,3],[64549,0.5,3],[64653,0,3]]),t(64963,5,5,0),t(65377,0,5,0),f(65997,4,5),
  t(66411,0,4,0),t(66825,2,5,0),t(67239,1,4,0),t(67653,0,5,0),
  t(68067,1,4,0),t(68480,0,5,0),t(68894,0,4,0),t(68894,7,3,0),
  t(69308,0,5,0),t(69722,0,5,0),t(70136,0,5,0),h(70549,1,5,71377,1),
  t(70963,0,5,3),h(71791,0,5,72308),t(72412,1,4,0),t(72618,2,5,0),
  t(72825,5,4,0),f(73032,5,5),t(73653,2,8,0),t(73860,2,5,0),
  t(74067,1,4,0),t(74274,0,3,0),t(74688,0,5,0),t(75101,0,5,0),
  t(75515,0,5,0),t(75929,0,5,0),t(76343,0,5,0),t(76757,0,5,0),
  t(77584,2,5,0),t(77998,1,4,0),t(78205,2,5,0),h(78412,6,1,79033,0,[[78412,6,1],[78722,4,5],[79033,6,1]]),
  f(79239,2,5),t(79653,0,5,0),t(79860,4,5,0),t(80067,2,5,0),
  t(80274,0,5,0),t(80481,0,3,0),t(80481,6,3,0),t(80895,0,5,0),
  t(81309,3,3,0),t(81515,4,5,0),t(81722,5,5,0),t(82136,4,5,0),
  t(82446,6,4,0),t(82550,4,5,0),h(82964,6,4,83378,1),t(83791,5,5,0),
  t(84205,4,5,0),t(84619,2,5,0),t(85033,4,5,0),t(85240,3,4,0),
  f(85447,1,4),t(85860,0,5,0),t(86067,0,5,0),t(86274,0,4,0),
  t(86688,1,3,0),t(87102,3,4,0),t(87516,0,5,0),t(88136,0,5,0),
  t(88343,0,5,0),t(88757,2,5,0),t(89171,4,5,0),t(89585,2,5,0),
  t(89792,5,4,0),t(89999,2,5,0),t(90412,0,5,0),t(90619,6,4,0),
  t(90619,0,3,0),f(90826,2,5),t(91240,0,5,0),t(91447,0,5,0),
  t(91654,0,4,0),t(91861,0,8,0),t(92481,2,5,0),t(92895,1,4,0),
  t(93309,0,5,0),t(93723,0,4,0),t(94137,0,5,0),t(94551,0,4,4),
  t(94964,2,5,0),t(95171,0,5,0),f(95378,3,3),t(95792,4,5,0),
  h(95999,1,4,96413),h(96620,2,5,97240,0,[[96620,2,5],[96930,4,1],[97240,2,5]]),t(97447,4,5,0),t(97654,6,4,0),
  t(97861,6,1,0),t(98068,5,5,0),t(98275,7,3,0),t(98896,6,4,0),
  t(99102,5,5,0),t(99309,6,4,0),t(99516,5,4,0),t(99930,4,5,0),
  t(100344,7,3,0),t(100758,5,5,0),t(101171,3,4,0),t(101378,6,4,0),
  t(101378,0,3,0),t(101585,5,5,0),t(101999,4,5,0),t(102413,2,5,0),
  f(102827,4,5),t(103241,5,5,0),t(103654,5,4,0),t(104068,2,5,0),
  t(104482,0,5,0),t(104896,0,5,0),t(105310,0,5,0),t(105723,0,5,0),
  t(106137,0,5,0),t(106551,2,5,0),t(106965,4,5,0),t(107379,5,5,0),
  t(107792,5,4,0),t(108206,2,5,0),t(108620,5,4,0),t(109034,2,5,0),
  f(109448,4,5),t(109862,5,5,0),t(110275,5,4,0),t(110689,3,4,0),
  t(111103,4,5,0),t(111517,2,5,0),t(111724,0,8,0),h(111931,0,3,112655),
  t(112758,0,1,0),t(113172,1,4,0),t(113379,1,4,0),t(113793,0,4,0),
  t(113793,7,3,0),s(114000,115655,[[114000,1.5,4],[114207,1.5,4],[114413,2.5,3],[114517,2.5,3],[115034,2.5,3],[115655,0.5,2]],1),t(114413,0,4,0),t(116276,1,4,0),
  t(117103,3,4,0),t(117310,5,4,0),f(118138,6,4),
// </4u-hitasura-v3-expert-notes>
])(mhTap,mhHoldV2,mhFlick,mhSlideV2);
const fourUMasterNotes=((t,h,f,s)=>[
// <4u-hitasura-v3-master-notes>
  f(2064,2,2),t(4650,0,2,0),t(5167,2,1,0),t(6822,4,2,0),
  t(7236,8,2,0),h(8271,7,1,9098,1,[[8271,7,1],[8685,6,3],[9098,5,4]]),s(8271,10340,[[8271,0,2],[10340,1,2]]),t(10133,5,1,0),
  t(11167,2,2,0),t(12202,4,2,0),t(13030,4,2,0),t(13236,4,2,0),
  t(14685,2,2,0),s(15099,16754,[[15099,3,2],[15306,4,2],[15512,4,2],[15719,4,3],[15823,4,3],[15926,4,3],[16133,4,3],[16340,4,2],[16443,4,2],[16547,4,2],[16754,3.5,2]],1),s(15099,16754,[[15099,1,2],[16754,0,2]]),t(17168,6,2,0),
  t(18823,4,2,0),t(20064,0,6,0),f(20375,3,4),t(20892,5,4,0),
  t(20892,0,3,0),t(21306,0,2,0),t(21306,4,2,0),t(21720,4,2,0),
  t(21720,8,2,0),t(22133,0,2,0),t(22133,4,2,0),t(22547,4,2,0),
  t(22547,8,2,0),t(22961,6,2,0),t(23375,3,4,0),t(23582,1,4,0),
  t(23789,3,4,0),t(24202,5,4,0),t(24616,3,4,1),t(25030,5,4,0),
  t(25237,3,3,0),t(25444,5,4,0),t(26272,6,4,0),f(26685,5,4),
  t(27099,0,4,0),t(27306,3,3,0),t(27513,1,3,0),t(27927,6,2,0),
  t(28341,3,3,0),t(28754,6,4,0),t(28754,1,3,0),t(28961,5,4,0),
  t(29168,8,2,0),t(29582,6,2,0),t(30410,3,4,0),t(30823,5,4,0),
  t(31237,6,4,0),t(31444,3,3,0),t(31651,6,2,0),t(32065,6,4,0),
  f(32272,5,4),t(33513,2,3,0),t(33513,7,3,0),h(33720,3,4,34444),
  t(34548,0,2,0),t(34962,1,2,0),t(34962,5,2,0),t(35375,3,2,0),
  t(35375,7,2,0),t(35789,4,2,0),t(35789,8,2,0),t(36203,3,4,0),
  t(37031,5,4,0),t(37444,3,4,0),t(37858,5,4,0),t(38686,6,4,0),
  t(39100,5,4,0),t(39514,3,4,0),f(40341,1,4),t(40755,2,6,0),
  t(41169,1,4,0),t(41996,2,2,0),t(41996,6,2,0),t(42410,2,2,0),
  t(42410,7,2,0),t(42824,1,2,0),t(42824,8,2,0),t(43238,0,2,0),
  t(43238,8,2,0),t(43652,3,4,0),t(44065,1,4,0),t(44479,3,4,0),
  t(44893,5,4,0),t(45307,1,4,0),t(46134,3,4,0),t(46548,5,4,0),
  t(46755,6,4,0),t(46962,5,4,0),f(47790,3,4),t(48617,0,2,0),
  t(48617,4,2,0),t(49031,4,2,0),t(49031,8,2,0),t(49445,0,2,0),
  t(49445,4,2,0),t(49859,4,2,0),t(49859,8,2,0),t(50686,3,4,2),
  t(51100,6,4,0),t(51514,3,4,0),t(51928,5,4,0),t(52755,3,4,0),
  t(53583,5,4,0),t(53997,6,4,0),t(54411,5,4,0),t(54825,3,4,0),
  t(55238,5,4,0),f(56066,3,4),t(56480,1,4,0),t(56894,3,4,0),
  t(57721,5,4,0),t(58135,1,4,0),t(58549,3,4,0),t(58963,5,4,0),
  t(59376,6,4,0),t(59376,1,3,0),t(59790,5,4,0),t(59997,3,3,0),
  h(60204,1,4,60928,0,[[60204,1,4],[60618,2,3],[60928,3,1]]),t(61032,3,4,0),t(61239,5,4,0),h(62066,6,4,62687,1),
  f(63101,1,3),t(63515,5,4,0),t(63515,0,3,0),t(63722,2,6,0),
  s(63928,64653,[[63928,4,2],[64239,2.5,2],[64549,0.5,2],[64653,0,2]]),t(64963,6,4,0),t(65377,1,4,0),t(65997,5,4,0),
  t(66411,0,3,0),t(66825,5,4,0),t(67239,3,3,0),t(67653,1,4,0),
  t(67653,7,3,0),t(68067,0,3,0),t(68273,0,3,0),t(68480,1,4,0),
  t(68894,0,3,0),t(69308,1,4,0),t(69722,5,4,0),f(70136,1,4),
  h(70549,3,4,71377,1),s(70549,71274,[[70549,1,2],[71274,0,2]]),h(71791,5,4,72308),t(72412,3,3,0),
  t(72618,1,4,0),t(72825,0,3,0),t(73032,1,4,0),t(73653,3,4,0),
  t(73860,5,4,0),t(74067,7,3,0),t(74274,8,2,0),t(74688,5,4,0),
  t(75101,6,4,0),t(75101,1,3,0),t(75515,5,4,0),f(75929,3,4),
  t(76343,5,4,0),t(76757,6,4,0),t(76963,6,2,0),t(77170,3,4,0),
  t(77584,1,4,0),t(77998,0,3,0),t(78205,1,4,0),h(78412,2,1,79033,0,[[78412,2,1],[78722,0,4],[79033,2,1]]),
  t(79239,0,4,0),t(79446,0,3,0),t(79653,0,4,0),t(79860,1,4,0),
  t(80067,0,4,0),t(80274,1,4,0),t(80481,0,2,0),f(80895,1,4),
  t(81309,4,2,0),t(81309,8,2,0),t(81515,4,6,0),t(81722,6,4,0),
  t(82136,1,4,0),t(82446,5,3,0),t(82550,3,4,0),h(82964,7,3,83378,1),
  t(83791,5,4,0),t(83998,3,4,0),t(84205,1,4,0),t(84619,0,4,0),
  t(85033,3,4,0),t(85240,1,3,0),f(85447,0,3),t(85860,1,4,0),
  t(86067,3,4,0),t(86274,3,3,0),t(86688,6,2,0),t(87102,7,3,0),
  t(87309,5,3,0),t(87516,6,4,0),t(87723,5,3,0),t(87723,0,3,0),
  t(88136,6,4,0),t(88343,5,4,0),t(88757,3,4,0),t(89171,1,4,0),
  t(89585,0,4,0),t(89792,1,3,0),f(89999,5,4),t(90412,3,4,0),
  t(90619,1,3,0),t(90826,0,4,0),t(91240,0,4,0),t(91447,1,4,0),
  t(91654,0,3,0),t(91861,1,4,0),t(92481,0,4,0),t(92688,0,2,0),
  t(92895,1,3,0),t(93309,1,4,0),t(93723,5,3,0),t(93723,0,3,0),
  t(94137,3,4,4),f(94551,1,3),t(94964,0,4,0),t(95171,0,4,0),
  t(95378,2,2,0),t(95585,0,3,0),t(95792,0,6,0),h(95999,0,3,96413),
  h(96516,1,2,97344),t(97447,6,4,0),t(97654,3,3,0),t(97861,6,1,0),
  t(98068,6,4,0),t(98275,6,2,0),t(98482,3,3,0),t(98896,1,3,0),
  t(99102,3,4,0),t(99309,0,3,0),t(99516,0,3,0),f(99930,1,4),
  t(100344,2,2,0),t(100344,6,2,0),t(100758,0,4,0),t(101171,1,3,0),
  t(101378,3,3,0),t(101585,5,4,0),t(101999,3,4,0),t(102206,5,3,0),
  t(102413,3,4,0),t(102827,1,4,0),t(103241,0,4,0),t(103654,1,3,0),
  t(104068,3,4,0),t(104482,5,4,0),t(104689,6,4,0),f(104896,5,4),
  t(105310,6,4,0),t(105723,5,4,0),t(106137,3,4,0),t(106344,1,4,0),
  t(106551,1,4,0),t(106551,7,3,0),t(106965,5,4,0),t(107379,6,4,0),
  t(107792,5,3,0),t(108206,3,4,0),t(108620,1,3,0),t(109034,0,4,0),
  t(109448,1,4,0),t(109862,3,4,0),t(110275,1,3,0),t(110689,5,3,0),
  t(110896,3,3,0),f(111103,1,4),t(111517,0,4,0),t(111724,0,6,0),
  h(111931,4,2,112655),t(112758,2,1,0),t(112965,0,3,0),t(113172,0,3,0),
  t(113379,1,3,0),t(113793,0,3,0),t(113793,5,3,0),s(114000,115655,[[114000,2,3],[114207,2,3],[114413,3,2],[114517,3,2],[115034,3,2],[115655,1,2]],1),
  t(114413,3,3,0),t(116276,0,3,0),t(117103,3,3,0),t(117310,7,3,0),
  f(118138,3,3),
// </4u-hitasura-v3-master-notes>
])(mhTap,mhHoldV2,mhFlick,mhSlideV2);

// 禁断のレジスタンス（2分43秒）。譜面はV3パイプラインが入れる。
// ユーザーからmp4で受け取った曲。映像を落として音源だけを取り出し、
// ほかのBGMと同じ 32kHz/96kbps のmp3にしてある(1.87MB)。切り出しはしていないので全尺で遊ぶ。
const KINDAN_NO_RESISTANCE_DURATION_MS=163440;
const kindanNoResistanceEasyNotes=((t,h,f,s)=>[
// <kindan-no-resistance-v3-easy-notes>
  t(2743,1,4,0),t(3076,0,10,0),t(3743,4,6,0),t(4410,2,6,0),
  t(5743,0,6,0),t(6076,0,3,0),t(6076,7,3,0),t(6576,5,4,0),
  t(6743,4,6,0),t(7410,4,6,0),t(8076,4,6,0),t(9743,2,6,0),
  t(10076,4,6,0),t(10410,2,6,0),h(11076,2,3,11576,0,[[11076,2,3],[11326,1,4],[11576,0,6]]),t(12076,0,4,0),
  t(12743,1,4,0),t(13410,2,6,0),t(13743,1,4,0),t(14743,2,6,0),
  t(15076,3,4,0),t(15910,4,6,0),t(17076,2,6,0),t(17743,5,4,0),
  t(18743,2,6,0),t(19076,5,4,0),t(20076,3,4,0),t(22076,1,4,0),
  h(23410,0,4,24077),h(25077,0,6,25493),t(26077,3,4,0),t(27077,0,6,0),
  t(27577,2,6,0),t(28077,4,6,0),t(28743,2,6,0),t(28910,0,6,0),
  t(30077,0,6,0),t(30410,0,6,0),h(30743,0,6,31327),t(31410,0,6,0),
  t(32577,4,6,0),t(32743,5,4,0),t(33077,2,6,0),t(33410,1,4,0),
  h(34077,0,4,34410),t(34743,0,6,1),t(35410,2,6,0),h(35743,5,4,36327),
  t(36743,6,4,0),t(37743,5,4,0),t(38077,4,6,0),t(38410,4,6,0),
  t(38577,4,6,0),t(38910,4,6,0),h(39410,4,6,39910),t(40077,4,6,0),
  t(41077,2,6,0),t(41577,0,10,0),t(42077,0,6,0),t(43410,0,6,0),
  t(44077,0,6,0),t(44744,2,6,0),t(45077,4,6,0),t(45410,4,6,0),
  t(46410,2,6,0),t(46744,4,6,0),t(47077,2,6,0),h(48077,1,4,48410),
  t(49077,0,6,0),t(49244,1,4,0),t(49744,0,4,0),t(49910,0,6,0),
  t(51410,7,3,0),t(51410,0,3,0),t(51744,2,6,0),t(52244,0,6,0),
  t(52744,0,6,0),t(53244,0,6,0),t(53410,1,4,0),t(53744,0,4,0),
  t(54077,1,4,0),t(54744,2,6,0),t(54910,2,6,0),t(55410,2,6,0),
  t(56410,4,6,0),t(56744,2,6,0),t(57077,5,4,0),t(57410,2,6,0),
  t(57744,4,6,0),t(58077,2,6,0),t(58744,0,6,0),t(59410,0,6,0),
  t(59744,0,6,0),t(60077,0,6,0),t(60410,0,6,0),t(60577,0,4,0),
  t(62077,0,6,0),t(62411,2,6,0),t(62744,1,4,0),t(63411,2,6,0),
  t(63577,1,4,0),t(64411,0,6,0),t(64744,1,4,0),t(65077,2,6,0),
  t(65411,4,6,0),t(65577,2,6,0),t(66077,4,6,2),t(66744,6,4,0),
  t(67077,5,4,0),t(67411,7,3,0),t(67411,0,3,0),t(67744,4,6,0),
  t(68077,2,6,0),t(68411,0,10,0),t(69077,0,6,0),t(69411,0,6,0),
  t(69744,0,6,0),t(69911,1,4,0),t(70411,2,6,0),t(70744,1,4,0),
  t(71077,0,4,0),t(71911,0,6,0),h(72077,0,6,72661,0,[[72077,0,6],[72411,0,4],[72661,1,3]]),t(73077,0,6,0),
  t(73411,0,4,0),t(74077,0,6,0),t(74244,0,4,0),t(75077,0,6,0),
  t(75244,0,6,0),t(75744,0,4,0),t(76077,1,4,0),t(76411,0,6,0),
  t(76744,1,4,0),t(77411,2,6,0),t(78077,4,6,0),t(78411,4,6,0),
  t(79411,4,6,0),t(79744,4,6,0),t(80078,4,6,0),t(80244,5,4,0),
  t(80744,6,4,0),t(81411,4,6,0),t(82411,4,6,0),t(82744,4,6,0),
  t(83411,2,6,0),t(83744,0,6,0),t(84411,4,6,0),t(84744,2,6,0),
  t(85411,0,6,0),t(86078,0,4,0),t(86411,0,6,0),t(86744,3,4,0),
  t(87244,4,6,0),t(88078,4,6,0),t(88911,2,6,0),t(89078,5,4,0),
  t(89411,4,6,0),t(90078,2,6,0),t(90744,4,6,0),t(91078,4,6,0),
  t(91411,7,3,0),t(91411,0,3,0),t(93078,4,6,0),t(93411,4,6,0),
  t(93744,4,6,0),t(94244,4,6,0),t(95411,4,6,0),t(95578,4,6,0),
  t(96744,0,6,0),t(96911,0,10,0),t(97411,2,6,0),t(97744,4,6,0),
  t(98078,4,6,3),t(99578,4,6,0),t(99745,4,6,0),t(100411,2,6,0),
  t(101411,0,6,0),t(101745,2,6,0),t(103745,4,6,0),t(105078,4,6,0),
  t(106411,2,6,0),t(106745,0,6,0),t(107411,2,6,0),t(108411,0,6,0),
  t(108745,0,6,0),t(109411,2,6,0),t(109911,4,6,0),t(110245,4,6,0),
  t(110745,5,4,0),t(111078,3,4,0),t(112411,0,6,0),t(113078,2,6,0),
  t(113411,4,6,0),t(113578,4,6,0),t(114745,2,6,0),t(115411,2,6,0),
  t(115745,4,6,0),t(116078,4,6,0),t(116745,4,6,0),t(117745,4,6,0),
  h(118078,4,6,118495),t(118745,2,6,0),t(119078,0,6,0),t(119412,0,6,0),
  t(120078,0,6,0),t(120412,3,4,0),t(122078,0,6,0),t(122912,0,6,0),
  t(123745,0,6,0),t(124245,2,6,0),t(124745,1,4,0),t(125412,2,6,0),
  t(125578,4,6,0),h(127745,6,3,128495,0,[[127745,6,3],[128162,4,6],[128495,6,3]]),t(129078,4,6,0),t(129745,4,6,4),
  h(130412,4,6,130828),t(131078,7,3,0),t(131078,0,3,0),t(131745,6,4,0),
  t(132245,4,6,0),t(132745,6,4,0),t(133245,4,6,0),t(133745,5,4,0),
  t(134078,6,4,0),t(134412,0,10,0),t(134745,4,6,0),t(134912,4,6,0),
  t(135245,6,4,0),t(135412,4,6,0),t(136412,5,4,0),t(136745,6,4,0),
  t(137079,4,6,0),t(137412,6,4,0),t(137579,4,6,0),t(137912,4,6,0),
  t(138079,2,6,0),t(139412,0,6,0),t(139745,3,4,0),t(140079,4,6,0),
  t(140412,4,6,0),t(140745,4,6,0),t(141079,4,6,0),t(141412,4,6,0),
  t(141745,6,4,0),t(142412,4,6,0),t(142745,6,4,0),t(143079,6,4,0),
  h(143579,4,6,144162,0,[[143579,4,6],[143912,6,3],[144162,4,6]]),t(145079,3,4,0),t(145412,5,4,0),t(146079,4,6,0),
  t(146579,4,6,0),t(146745,5,4,0),t(147079,2,6,0),t(147412,0,6,0),
  t(147745,0,6,0),t(148079,0,6,0),t(148579,0,6,0),t(148745,0,6,0),
  t(149412,0,6,0),t(149579,0,6,0),t(150079,0,3,0),t(150079,7,3,0),
  t(150745,2,6,0),t(151245,0,6,0),t(151745,0,6,0),t(152079,0,6,0),
  t(153079,0,6,0),t(153245,1,4,0),t(154245,0,6,0),h(154579,0,6,155329),
  t(155579,2,6,0),t(155746,0,6,0),h(156412,2,3,157329,0,[[156412,2,3],[156746,0,6],[156996,1,4],[157329,2,3]]),t(157746,0,6,0),
  t(158579,0,6,0),t(159079,0,6,0),t(160412,0,6,0),t(161079,0,10,0),
  t(161912,0,4,0),
// </kindan-no-resistance-v3-easy-notes>
])(mhTap,mhHoldV2,mhFlick,mhSlideV2);
const kindanNoResistanceNormalNotes=((t,h,f,s)=>[
// <kindan-no-resistance-v3-normal-notes>
  f(2743,1,4),t(3076,0,10,0),t(3743,4,6,0),t(4076,2,6,0),
  t(4410,0,6,0),t(5743,0,6,0),t(6076,0,3,0),t(6076,7,3,0),
  t(6743,0,6,0),t(7076,3,4,0),t(7410,0,6,0),t(8076,2,6,0),
  t(8743,0,3,0),t(9743,0,6,0),t(10410,2,6,0),t(10743,4,6,0),
  h(11076,6,2,11576,1,[[11076,6,2],[11326,5,4],[11576,4,6]]),t(12076,3,3,0),t(12743,5,3,0),t(13410,2,6,0),
  t(13743,1,4,0),t(14076,3,3,0),t(14743,4,6,0),t(15910,2,6,0),
  t(16076,5,3,0),f(17076,2,6),t(17743,6,4,0),t(18743,4,6,0),
  t(19076,5,3,0),t(20076,3,3,0),t(22076,1,3,0),h(23077,3,3,24077),
  h(25077,4,6,25493),t(27077,4,6,0),t(27243,4,6,0),t(27577,4,6,0),
  t(28077,4,6,0),t(28577,4,6,0),t(28743,4,6,0),t(28910,4,6,0),
  t(30077,2,6,0),t(30410,0,6,0),h(30743,2,6,31327),t(31410,0,6,0),
  t(32077,0,3,0),t(32577,0,6,0),t(32743,0,3,0),f(33077,0,6),
  t(33410,0,3,0),t(33410,7,3,0),h(34077,3,3,34410),t(34743,0,6,1),
  t(35410,4,6,0),h(35743,3,4,36327),t(36410,6,4,0),t(36743,5,3,0),
  t(37743,3,4,0),t(38077,4,6,0),t(38410,2,6,0),t(38577,4,6,0),
  t(38910,4,6,0),h(39410,4,6,39910,0,[[39410,4,6],[39660,5,4],[39910,6,2]]),t(40077,4,6,0),t(41077,2,6,0),
  t(41577,4,6,0),t(42077,4,6,0),t(43410,0,10,0),t(43744,3,4,0),
  t(44077,0,6,0),t(44744,4,6,0),t(45077,2,6,0),f(45410,4,6),
  t(46410,2,6,0),t(46744,4,6,0),t(47077,2,6,0),h(48077,1,3,48410),
  t(48744,3,3,0),t(49077,0,6,0),t(49244,3,4,0),t(49410,4,6,0),
  t(49744,7,3,0),t(49910,2,6,0),t(50077,6,4,0),t(51410,7,3,0),
  t(51410,0,3,0),t(51744,2,6,0),t(52244,4,6,0),t(52744,2,6,0),
  t(52910,0,6,0),t(53244,2,6,0),t(53410,5,3,0),t(53744,7,3,0),
  t(54077,5,3,0),t(54744,4,6,0),f(54910,4,6),t(55410,4,6,0),
  t(55744,6,4,0),t(56410,4,6,0),t(56744,2,6,0),t(57077,1,4,0),
  t(57410,0,6,0),t(57744,0,6,0),t(57910,0,6,0),t(58077,0,6,0),
  t(58744,0,6,0),t(59410,0,6,0),t(59744,0,6,0),t(60077,2,6,0),
  t(60410,0,6,0),t(60577,3,3,0),t(60744,7,3,0),t(61911,4,6,0),
  t(62077,4,6,0),t(62411,4,6,0),t(62744,7,3,0),t(63411,4,6,0),
  f(63577,7,3),t(63911,4,6,0),t(64411,4,6,0),t(64744,0,3,0),
  t(64744,7,3,0),t(65077,4,6,0),t(65411,2,6,0),t(65577,4,6,0),
  t(66077,4,6,2),t(66744,3,3,0),t(67077,1,3,0),t(67411,0,4,0),
  t(67744,0,6,0),t(68077,0,6,0),t(68411,0,10,0),t(69077,0,6,0),
  t(69411,0,6,0),t(69744,0,6,0),t(69911,0,4,0),t(70077,1,3,0),
  t(70411,4,6,0),t(70744,3,3,0),t(71077,1,4,0),f(71411,0,3),
  t(71911,0,6,0),h(72077,6,2,72661,1,[[72077,6,2],[72411,4,6],[72661,6,2]]),t(73077,4,6,0),t(73411,5,4,0),
  t(74077,4,6,0),t(74244,5,4,0),t(74577,3,3,0),t(75077,4,6,0),
  t(75244,2,6,0),t(75744,5,4,0),t(76077,3,3,0),t(76411,0,6,0),
  t(76744,0,3,0),t(77411,0,6,0),t(78077,0,6,0),t(78411,0,6,0),
  t(78744,2,6,0),t(79411,4,6,0),t(79744,4,6,0),t(80078,4,6,0),
  t(80244,6,4,0),f(80411,4,6),t(80744,0,3,0),t(80744,7,3,0),
  t(81411,4,6,0),t(82411,0,6,0),t(82744,4,6,0),t(83411,2,6,0),
  t(83744,4,6,0),t(84411,0,6,0),t(84744,0,6,0),t(85078,2,6,0),
  t(85411,4,6,0),t(86078,7,3,0),t(86411,4,6,0),t(86744,3,3,0),
  t(87244,0,6,0),t(88078,0,6,0),t(88911,0,6,0),t(89078,0,3,0),
  t(89078,7,3,0),t(89411,2,6,0),t(89744,4,6,0),t(90078,4,6,0),
  t(90744,2,6,0),t(91078,4,6,0),f(92078,4,6),t(93078,4,6,0),
  t(93411,4,6,0),t(93744,4,6,0),t(94244,4,6,0),t(95411,4,6,0),
  t(95578,4,6,0),t(96744,0,6,0),t(96911,0,10,0),t(97244,4,6,0),
  t(97411,4,6,0),t(97744,2,6,0),t(98078,4,6,3),t(99578,0,6,0),
  t(99745,4,6,0),t(100411,2,6,0),t(101078,4,6,0),t(101411,4,6,0),
  t(103745,2,6,0),t(104078,4,6,0),t(105078,2,6,0),t(105745,4,6,0),
  f(106411,4,6),t(106745,4,6,0),t(107411,2,6,0),t(108745,0,6,0),
  t(109411,0,6,0),t(109911,0,6,0),t(110245,0,6,0),t(110745,0,3,0),
  t(111078,1,3,0),h(111411,3,3,111828),t(112078,4,6,0),t(112411,0,6,0),
  t(113078,4,6,0),t(113411,2,6,0),t(113578,4,6,0),t(114745,2,6,0),
  t(115411,4,6,0),t(115745,2,6,0),t(116078,0,6,0),t(116745,2,6,0),
  t(117745,4,6,0),h(118078,4,6,118495),f(118745,2,6),t(119078,0,6,0),
  t(119412,0,6,0),t(120078,0,6,0),t(120412,0,3,0),t(120412,7,3,0),
  h(120745,4,6,121495,0,[[120745,4,6],[121162,6,2],[121495,4,6]]),t(122078,2,6,0),t(122912,4,6,0),t(123745,0,6,0),
  t(124245,0,6,0),t(124745,3,4,0),t(125412,4,6,0),t(125578,4,6,0),
  t(127412,4,6,0),h(127745,4,6,128495),t(129078,4,6,0),t(129412,2,6,0),
  t(129745,0,6,4),h(130412,0,6,130828),t(131078,0,4,0),t(131745,3,4,0),
  t(132245,4,6,0),t(132578,5,4,0),f(132745,7,3),t(133245,4,6,0),
  t(133745,6,4,0),t(134078,5,3,0),t(134412,0,10,0),t(134745,4,6,0),
  t(134912,4,6,0),t(135245,3,4,0),t(135412,0,6,0),t(136078,3,3,0),
  t(136412,7,3,0),t(136745,3,3,0),t(137079,0,6,0),t(137412,0,3,0),
  t(137412,7,3,0),t(137579,0,6,0),t(137912,0,6,0),t(138079,0,6,0),
  t(138745,3,3,0),t(139412,4,6,0),t(139745,5,4,0),t(140079,4,6,0),
  t(140412,4,6,0),f(140745,4,6),t(141079,4,6,0),t(141412,4,6,0),
  t(141745,3,4,0),t(142412,0,6,0),t(142745,3,3,0),t(143079,1,4,0),
  h(143579,0,6,144162),t(144745,0,6,0),t(145079,0,4,0),t(145412,0,3,0),
  t(146079,0,6,0),t(146579,0,6,0),t(146745,0,3,0),t(147079,0,6,0),
  t(147412,0,6,0),t(147745,0,6,0),t(148079,0,6,0),t(148579,2,6,0),
  t(148745,4,6,0),t(149245,0,6,0),t(149412,4,6,0),f(149579,2,6),
  t(150079,6,4,0),t(150412,3,4,0),t(150745,4,6,0),t(151745,2,6,0),
  t(152079,0,6,0),t(152412,0,3,0),t(152412,7,3,0),t(153079,0,6,0),
  t(153245,0,4,0),t(153412,2,6,0),t(153912,1,3,0),t(154245,4,6,0),
  h(154579,2,6,155329),t(155579,2,6,0),t(155746,4,6,0),h(156412,2,2,157329,1,[[156412,2,2],[156746,2,3],[156996,1,4],[157329,0,6]]),
  t(157746,0,6,0),t(158579,2,6,0),t(159079,0,6,0),t(159579,0,6,0),
  t(160412,0,6,0),t(161079,0,10,0),f(161912,6,4),
// </kindan-no-resistance-v3-normal-notes>
])(mhTap,mhHoldV2,mhFlick,mhSlideV2);
const kindanNoResistanceHardNotes=((t,h,f,s)=>[
// <kindan-no-resistance-v3-hard-notes>
  t(2076,0,8,0),f(3076,0,5),t(3743,0,5,0),t(4076,2,5,0),
  t(4410,4,5,0),h(4743,8,1,5660,0,[[4743,8,1],[5076,8,2],[5326,6,4],[5660,5,5]]),t(5743,0,5,0),t(6076,0,4,0),
  t(6076,7,3,0),t(6576,6,4,0),t(6576,0,3,0),t(6743,5,5,0),
  t(7076,5,4,0),t(7410,2,5,0),t(7910,3,4,0),t(8076,4,5,0),
  t(8743,3,3,0),t(9410,1,3,0),t(9743,2,5,0),t(10076,4,5,0),
  t(10410,2,5,0),t(10743,4,5,0),h(11076,2,5,11576),t(11743,5,4,0),
  t(12076,7,3,0),t(12743,5,3,0),t(13410,0,5,0),f(13743,3,4),
  t(14076,1,3,0),t(14243,4,5,0),t(14743,2,5,0),t(15076,6,4,0),
  t(15410,5,3,0),t(15910,5,5,0),t(16076,5,3,0),t(17076,2,5,0),
  t(17743,5,4,0),s(18076,19243,[[18076,1,4],[18160,0,4],[18243,0,3],[18326,0,3],[18410,0,3],[18493,0,3],[18576,0,2],[18660,0,2],[18743,0,2],[18826,0,3],[18910,0,3],[18993,0,3],[19076,0,3],[19160,0,4],[19243,0,4]],1),t(20076,0,3,0),t(20743,3,3,0),
  t(22076,1,3,0),t(22410,3,3,0),s(23077,24077,[[23077,0,3],[23327,0.5,3],[23577,2,3],[23827,3.5,3],[24077,4,3]]),h(25077,5,5,25493),
  t(26077,5,3,0),t(27077,2,5,0),t(27160,5,4,0),t(27577,2,5,0),
  t(27910,4,5,0),t(28077,2,5,0),t(28577,4,5,0),t(28743,5,5,0),
  f(28910,4,5),t(29243,5,5,0),t(29410,5,5,0),t(30077,5,5,0),
  t(30410,5,5,0),t(30743,4,5,0),h(30910,3,4,31327),t(31410,4,5,0),
  t(32077,1,3,0),t(32077,7,3,0),t(32577,2,5,0),t(32743,1,3,0),
  t(33077,0,5,0),t(33243,1,4,0),t(33410,0,3,0),t(33577,3,3,0),
  h(34077,0,3,34410,1),t(34743,2,5,0),t(34910,1,3,0),t(35243,3,4,0),
  t(35410,2,8,0),h(35743,6,4,36327),t(36410,5,4,1),f(36743,7,3),
  t(37243,5,4,0),t(37410,7,3,0),t(37577,5,4,0),t(37743,3,4,0),
  t(38077,0,5,0),t(38410,0,5,0),h(38577,0,5,39077),t(39243,0,5,0),
  h(39410,0,5,39910,0,[[39410,0,5],[39660,1,3],[39910,2,1]]),t(40077,0,5,0),t(40743,4,5,0),t(41077,0,5,0),
  t(41577,2,5,0),t(42077,0,5,0),h(42410,1,3,42744),t(43327,0,5,0),
  t(43410,2,5,0),t(43744,1,4,0),t(44077,4,5,0),h(44744,2,5,45077,1),
  t(45410,5,5,0),t(45744,2,5,0),t(46410,5,5,0),t(46744,4,5,0),
  t(47077,5,5,0),f(47244,5,3),h(47910,7,1,48410,0,[[47910,7,1],[48160,5,5],[48410,7,1]]),t(48577,6,3,0),
  t(48577,0,3,0),t(48744,3,3,0),h(49077,0,5,49494),t(49577,0,4,0),
  t(49744,0,3,0),t(49910,0,5,0),t(50077,3,4,0),t(50160,5,3,0),
  t(50327,6,4,0),t(51410,7,3,0),t(51660,4,5,0),t(51744,5,5,0),
  t(51910,4,5,0),t(52244,2,5,0),t(52744,4,5,0),t(52910,4,5,0),
  t(53244,3,5,0),t(53327,5,4,0),t(53744,7,3,0),t(54077,5,3,0),
  t(54577,3,4,0),h(54744,0,5,55077,1),t(55410,0,5,0),t(55577,0,3,0),
  f(55744,1,4),t(56077,3,3,0),t(56244,1,3,0),t(56410,2,5,0),
  t(56744,0,5,0),t(57077,0,4,0),t(57077,7,3,0),t(57410,0,5,0),
  t(57577,0,5,0),t(57744,0,5,0),t(57910,0,5,0),t(58077,0,5,0),
  t(58744,0,5,0),t(59244,1,3,0),t(59410,2,5,0),t(59577,5,3,0),
  t(59744,5,5,0),t(60077,4,5,0),t(60410,2,5,0),t(60494,4,5,0),
  t(60744,3,3,0),t(61244,1,3,0),f(61411,5,3),t(61911,1,8,0),
  t(62077,0,5,0),t(62411,0,5,0),t(62744,1,3,0),t(62911,3,4,0),
  t(63411,4,5,0),t(63577,7,3,0),t(63911,0,5,0),t(64077,3,3,0),
  t(64411,4,5,0),t(64744,7,3,0),t(65077,2,5,0),t(65411,4,5,0),
  t(65577,5,5,0),t(66077,4,5,2),t(66411,3,4,0),t(66577,4,5,0),
  t(66744,3,3,0),t(66994,1,4,0),t(67077,0,3,0),t(67244,1,3,0),
  t(67411,3,4,0),t(67744,4,5,0),f(68077,5,5),t(68411,5,5,0),
  t(68577,5,5,0),t(69077,5,5,0),t(69411,2,5,0),t(69744,4,5,0),
  t(69911,6,4,0),t(69911,0,3,0),t(70077,5,3,0),t(70244,6,4,0),
  t(70411,4,5,0),h(70661,3,4,70994),t(71077,1,4,0),t(71244,0,4,0),
  t(71411,3,3,0),t(71911,0,5,0),s(71994,72661,[[71994,3,4],[72077,2,3],[72161,2,3],[72244,1,3],[72327,1,2],[72411,1,3],[72494,2,3],[72577,2.5,3],[72661,2.5,4]],1),t(73077,2,5,0),
  t(73411,6,4,0),t(73827,3,4,0),t(73994,5,4,0),t(74077,2,5,0),
  t(74244,1,4,0),t(74577,0,3,0),t(75077,0,5,0),f(75244,2,5),
  t(75744,5,4,0),t(75827,3,4,0),t(76077,5,3,0),t(76411,5,5,0),
  t(76744,5,3,0),t(76911,7,3,0),t(77077,5,4,0),t(77411,2,5,0),
  t(77744,0,5,0),t(78077,2,5,0),t(78411,4,5,0),t(78744,2,5,0),
  t(79077,0,5,0),t(79411,0,5,0),t(79744,0,5,0),t(80078,0,5,0),
  t(80244,0,4,0),t(80411,0,5,0),t(80578,1,3,0),t(80744,0,4,0),
  t(80911,1,3,0),t(81411,0,5,0),t(82078,0,5,0),t(82411,1,8,0),
  f(82744,0,5),t(83078,0,4,0),t(83244,1,3,0),t(83411,2,5,0),
  t(83744,4,5,0),t(84078,0,5,0),t(84411,2,5,0),t(84744,5,5,0),
  t(85078,2,5,0),t(85411,0,5,0),t(85828,0,4,0),t(86078,1,3,0),
  t(86411,1,5,0),t(86494,0,4,0),t(86744,3,3,0),t(87244,4,5,0),
  t(87578,2,5,0),t(88078,0,5,0),t(88744,0,3,0),t(88911,0,5,0),
  t(89078,3,4,0),t(89411,4,5,0),t(89744,5,5,0),f(90078,4,5),
  t(90578,5,5,0),t(90744,4,5,0),t(91078,5,5,0),t(91411,7,3,0),
  t(91911,4,5,0),t(92078,5,5,0),t(93078,0,5,0),t(93411,4,5,0),
  t(93744,2,5,0),t(93911,5,5,0),t(94244,4,5,0),t(95078,0,4,0),
  t(95078,7,3,0),t(95411,2,5,0),t(95578,4,5,0),t(95911,5,5,0),
  t(96744,0,5,0),t(96911,0,5,0),t(97244,2,5,0),t(97411,4,5,0),
  t(97578,5,5,0),t(97744,4,5,0),t(97911,2,5,0),t(98078,5,5,0),
  t(99578,4,5,0),f(99745,2,5),t(100411,0,5,0),t(100578,0,3,0),
  t(101078,0,5,3),t(101411,2,5,0),t(101745,4,5,0),t(103411,0,5,0),
  t(103745,0,5,0),t(104078,0,5,0),t(105078,0,5,0),t(105745,2,5,0),
  t(106411,0,5,0),t(106745,0,5,0),t(107411,0,5,0),t(107745,2,5,0),
  t(108078,0,5,0),t(108411,0,5,0),t(108745,2,5,0),t(109411,4,5,0),
  t(109911,5,5,0),t(110078,5,3,0),t(110245,1,8,0),t(110745,5,3,0),
  f(111078,3,3),h(111411,5,3,111828),t(111911,5,5,0),t(112078,4,5,0),
  t(112411,2,5,0),t(113078,0,5,0),t(113411,4,5,0),t(113578,0,5,0),
  t(114078,2,5,0),t(114245,6,4,0),t(114245,0,3,0),t(114745,5,5,0),
  t(115411,4,5,0),t(115745,2,5,0),t(116078,0,5,0),t(116745,0,5,0),
  t(117245,0,5,0),t(117411,2,1,0),t(117745,2,5,0),h(117912,2,5,118495,0,[[117912,2,5],[118245,4,1],[118495,2,5]]),
  t(118745,0,5,0),t(119078,2,5,0),t(119412,5,5,0),t(119578,2,5,0),
  f(120078,0,5),t(120412,3,4,0),t(120578,1,3,0),s(120745,121495,[[120745,3,4],[120828,3,4],[120912,3,4],[120995,4,3],[121078,3,3],[121162,4,3],[121245,3,3],[121328,4,2],[121412,3,2],[121495,4,2]]),
  t(121578,2,5,0),t(122078,4,5,0),t(122912,0,5,0),t(123412,1,4,0),
  t(123745,2,5,0),t(124245,4,5,0),t(124578,5,5,0),t(124745,5,4,0),
  t(125412,2,5,0),t(125578,4,5,0),t(126078,0,5,0),t(127412,0,5,0),
  h(127745,0,5,128495),t(128745,2,5,0),t(129078,0,5,0),t(129412,2,5,0),
  t(129745,4,5,4),t(130078,2,5,0),h(130412,4,5,130828),t(131078,6,4,0),
  t(131078,0,3,0),t(131245,5,4,0),t(131412,0,5,0),f(131745,3,4),
  t(132078,5,3,0),t(132245,5,5,0),t(132578,1,4,0),t(132745,3,3,0),
  t(133245,4,5,0),t(133662,3,5,0),t(133745,5,4,0),t(134078,7,3,0),
  t(134412,4,5,0),t(134745,5,5,0),t(134828,3,4,0),t(135245,5,4,0),
  t(135412,5,5,0),t(135995,5,4,0),t(136078,3,3,0),t(136412,5,3,0),
  t(136745,3,3,0),t(137079,1,5,0),t(137162,0,4,0),t(137412,3,3,0),
  t(137579,5,5,0),t(137912,2,5,0),t(138079,2,8,0),t(138245,3,3,0),
  f(138412,1,4),t(138745,0,3,0),t(138912,0,5,0),t(139412,0,5,0),
  t(139745,1,4,0),t(140079,0,5,0),t(140412,0,5,0),t(140579,3,3,0),
  t(140745,0,5,0),t(141079,2,5,0),t(141245,3,4,0),t(141412,0,5,0),
  t(141745,0,4,0),t(141745,7,3,0),t(141912,0,5,0),t(142412,2,5,0),
  t(142745,1,3,0),t(143079,0,4,0),t(143412,1,3,0),h(143579,2,1,144162,0,[[143579,2,1],[143912,1,3],[144162,0,5]]),
  t(144245,0,5,0),t(144745,0,5,0),t(145079,0,4,0),f(145412,0,3),
  t(145912,2,3,0),t(145995,0,4,0),t(146579,0,5,0),t(146745,3,3,0),
  t(146912,1,3,0),t(147079,0,5,0),t(147412,0,5,0),t(147745,0,5,0),
  t(147829,2,5,0),t(148079,0,5,0),t(148245,4,5,0),t(148579,5,5,0),
  t(148745,2,5,0),t(149245,4,5,0),t(149412,0,5,0),t(149579,0,5,0),
  t(149745,0,5,0),t(150079,3,4,0),t(150245,4,5,0),t(150412,6,4,0),
  t(150745,5,5,0),t(150912,5,5,0),t(151245,5,5,0),t(151745,4,5,0),
  f(152079,5,5),t(152412,5,3,0),t(152912,3,4,0),t(153079,0,5,0),
  t(153245,0,4,0),t(153412,0,5,0),t(153662,3,3,0),t(153912,6,3,0),
  t(153912,0,3,0),t(154162,5,5,0),t(154245,4,5,0),t(154579,5,5,0),
  s(154745,155329,[[154745,3,4],[154829,3,3],[154912,3,3],[154995,2,2],[155079,3.5,2],[155162,3.5,3],[155245,4,3],[155329,4,4]]),t(155579,2,5,0),t(155746,4,5,0),s(156412,157329,[[156412,1,4],[156496,1,4],[156579,1,3],[156662,0,3],[156746,1,3],[156829,0,2],[156912,0,2],[156996,0,3],[157079,0,3],[157162,1,3],[157246,0,4],[157329,1.5,4]]),
  t(157579,5,5,0),t(157746,4,5,0),t(158412,2,5,0),t(158579,0,5,0),
  t(159079,0,5,0),t(159579,0,5,0),t(160246,0,5,0),t(160412,0,5,0),
  t(161079,1,8,0),f(161662,5,4),
// </kindan-no-resistance-v3-hard-notes>
])(mhTap,mhHoldV2,mhFlick,mhSlideV2);
const kindanNoResistanceExpertNotes=((t,h,f,s)=>[
// <kindan-no-resistance-v3-expert-notes>
  t(2076,2,8,0),h(2743,5,4,3076,1),f(3743,5,5),t(4076,4,5,0),
  t(4410,2,5,0),h(4743,2,1,5660,0,[[4743,2,1],[5076,2,2],[5326,1,4],[5660,0,5]]),t(5743,1,5,0),t(5826,1,3,0),
  t(6076,0,4,0),t(6076,7,3,0),t(6576,0,4,0),t(6576,7,3,0),
  t(6743,0,5,0),t(7076,3,4,0),t(7410,4,5,0),t(7910,6,4,0),
  t(8076,1,2,0),t(8076,5,2,0),t(8410,3,2,0),t(8410,7,2,0),
  t(8743,4,2,0),t(8743,8,2,0),t(9410,5,3,0),t(9743,2,5,0),
  t(10076,4,5,0),t(10410,2,5,0),t(10743,0,5,0),h(11076,4,5,11576),
  t(11743,3,4,0),t(12076,1,3,0),f(12410,0,5),t(12743,1,3,0),
  t(13410,1,2,0),t(13410,5,2,0),t(13743,3,2,0),t(13743,7,2,0),
  t(14076,1,2,0),t(14076,5,2,0),t(14243,2,5,0),t(14576,5,3,0),
  t(14743,5,5,0),t(15076,5,4,0),t(15410,1,3,0),t(15410,7,3,0),
  t(15910,2,5,0),t(16076,5,3,0),t(16243,6,4,0),t(17076,0,5,0),
  t(17743,5,4,0),s(18076,19243,[[18076,1.5,4],[18160,0.5,4],[18243,0,3],[18326,0,3],[18410,0,3],[18493,0,3],[18576,0,2],[18660,0,2],[18743,0,2],[18826,0.5,3],[18910,0.5,3],[18993,0,3],[19076,0,3],[19160,0,4],[19243,0.5,4]],1),s(18076,19243,[[18076,3,2],[19243,4,2]]),t(19743,5,3,0),
  t(20076,7,3,0),t(20743,5,3,0),t(22076,3,3,0),t(22410,5,3,0),
  s(23077,24077,[[23077,1,2],[23493,2.5,3],[23743,2.5,3],[23993,3,4],[24077,3,4]],1),f(23410,6,3),t(24743,3,3,0),h(25077,5,5,25493,1),
  t(26077,5,3,0),t(26410,3,3,0),t(27077,4,5,0),t(27160,3,4,0),
  t(27243,1,5,0),t(27577,2,5,0),t(27910,4,5,0),t(28077,5,5,0),
  t(28577,0,2,0),t(28577,4,2,0),t(28743,2,2,0),t(28743,6,2,0),
  t(28910,4,2,0),t(28910,8,2,0),t(29243,4,5,0),t(29410,5,5,0),
  t(29910,5,5,0),t(30077,5,5,0),t(30410,5,5,1),t(30743,4,5,0),
  h(30910,3,4,31327),t(31410,4,5,0),f(31577,2,5),t(32077,1,3,0),
  t(32243,1,4,0),t(32577,2,5,0),t(32743,3,3,0),t(33077,4,5,0),
  t(33243,3,4,0),t(33410,1,3,0),t(33577,0,3,0),h(34077,1,3,34410),
  t(34660,3,4,0),t(34743,4,5,0),t(34910,7,3,0),t(35243,3,4,0),
  t(35410,2,8,0),h(35743,3,5,36327,0,[[35743,3,5],[36077,4,3],[36327,5,1]]),t(36410,6,4,0),t(36577,6,4,0),
  t(36743,7,3,0),t(37243,6,4,0),t(37410,7,3,0),t(37410,1,3,0),
  t(37577,5,4,0),t(37743,6,4,0),t(37910,5,3,0),f(38077,5,5),
  t(38410,0,5,0),h(38577,2,5,39077),t(39243,4,5,0),h(39410,7,1,39910,0,[[39410,7,1],[39660,5,5],[39910,7,1]]),
  t(40077,4,5,0),t(40243,5,5,0),t(40743,4,5,0),t(41077,2,5,0),
  t(41577,0,5,0),t(41910,0,5,0),t(42077,0,5,0),h(42410,5,3,42744,1),
  t(43327,0,5,0),t(43410,4,5,0),t(43744,3,4,0),t(44077,5,5,0),
  t(44244,6,1,0),h(44744,5,5,45077,1),t(45410,4,5,0),t(45744,5,5,0),
  f(46077,2,5),t(46410,1,2,0),t(46410,5,2,0),t(46744,3,2,0),
  t(46744,7,2,0),t(47077,1,2,0),t(47077,5,2,0),t(47244,1,3,0),
  h(47910,2,5,48410,0,[[47910,2,5],[48160,4,1],[48410,2,5]]),t(48577,5,3,0),t(48744,7,3,0),t(48994,5,4,0),
  h(49077,2,5,49494),t(49577,1,4,0),t(49744,0,3,0),t(49910,1,5,0),
  t(49994,1,3,0),t(50077,2,4,0),t(50160,1,3,0),t(50327,0,4,0),
  t(50327,7,3,0),t(51410,1,3,0),t(51660,1,5,0),t(51744,0,5,0),
  t(51910,0,5,0),f(52244,0,5),t(52744,2,5,0),t(52910,0,5,0),
  t(53160,3,4,0),t(53244,4,5,0),t(53327,3,4,0),t(53410,2,3,0),
  t(53744,3,3,0),t(54077,5,3,0),t(54494,6,4,0),t(54577,5,4,0),
  h(54744,5,5,55077),t(55244,5,4,0),t(55410,5,5,0),t(55577,3,3,0),
  t(55744,0,4,0),t(55827,3,4,0),t(56077,7,3,0),t(56244,7,3,0),
  t(56410,4,5,0),t(56744,2,5,0),f(57077,1,4),t(57410,0,5,0),
  t(57577,0,5,0),t(57744,0,5,0),t(57910,0,5,0),t(58077,0,5,0),
  t(58244,7,3,0),t(58744,2,5,0),t(59244,0,3,0),t(59410,0,5,0),
  t(59577,1,3,0),t(59744,2,5,0),t(60077,4,5,0),t(60410,5,5,0),
  t(60494,4,5,0),t(60577,3,3,0),t(60744,1,3,0),t(60744,7,3,0),
  s(60994,61494,[[60994,1.5,4],[61077,1.5,4],[61161,1.5,3],[61244,3,3],[61327,1,3],[61411,3,2],[61494,3,2]]),t(61577,0,4,0),t(61911,0,8,0),t(62077,0,5,0),
  t(62411,2,5,0),t(62744,1,3,0),t(62911,0,4,0),t(63244,1,4,0),
  t(63411,0,5,0),f(63577,1,3),t(63911,2,5,0),t(64077,1,3,0),
  t(64327,5,3,0),t(64411,0,5,0),t(64744,3,3,0),t(65077,0,5,0),
  t(65411,0,5,0),t(65577,0,5,0),t(66077,2,5,2),t(66411,4,4,0),
  t(66494,3,4,0),t(66577,5,5,0),t(66744,5,3,0),t(66994,6,4,0),
  t(67077,3,3,0),t(67244,5,3,0),t(67411,6,4,0),t(67744,4,5,0),
  t(67827,3,4,0),t(68077,2,5,0),t(68411,2,5,0),t(68577,2,5,0),
  f(68744,1,3),t(69077,2,5,0),t(69411,4,5,0),t(69744,5,5,0),
  t(69911,5,4,0),t(70077,7,3,0),t(70244,5,4,0),t(70411,5,5,0),
  h(70661,5,4,70994),t(71077,6,4,0),t(71161,2,4,0),t(71244,3,4,0),
  t(71411,3,3,0),t(71911,4,5,0),t(71994,5,5,0),s(72077,72661,[[72077,2.5,4],[72161,2,3],[72244,1,3],[72327,1,2],[72411,1,2],[72494,2,3],[72577,3,3],[72661,3,4]]),
  t(72911,3,3,0),t(73077,4,5,0),t(73411,1,4,0),t(73827,3,4,0),
  t(73994,5,4,0),t(74077,2,5,0),f(74244,1,4),t(74577,0,3,0),
  t(74911,1,4,0),t(75077,2,5,0),t(75244,1,5,0),t(75327,0,4,0),
  t(75744,3,4,0),t(75827,1,4,0),t(76077,5,3,0),t(76411,2,5,0),
  t(76744,1,3,0),t(76911,0,3,0),t(77077,1,4,0),t(77411,2,5,0),
  t(77744,0,5,0),t(78077,2,5,0),t(78411,4,5,0),t(78577,5,3,0),
  t(78744,5,5,0),t(79077,4,5,0),t(79411,5,5,0),t(79577,3,3,0),
  f(79744,0,5),t(80078,0,5,0),t(80244,0,4,0),t(80244,7,3,0),
  t(80411,0,5,0),t(80578,0,3,0),t(80744,1,4,0),t(80911,0,3,0),
  t(81411,0,5,0),t(81744,2,5,0),t(82078,0,8,0),t(82411,0,5,0),
  t(82744,0,5,0),t(83078,1,4,0),t(83244,0,3,0),t(83411,0,5,0),
  t(83744,0,5,0),t(84078,2,5,0),t(84411,0,5,0),t(84744,4,5,0),
  t(84828,5,5,0),f(85078,5,5),t(85411,5,5,0),t(85661,7,3,0),
  t(85828,5,4,0),t(86078,7,3,0),t(86411,4,5,0),t(86494,6,4,0),
  t(86744,3,3,0),t(86911,5,3,0),t(87244,0,5,0),t(87578,0,5,0),
  t(88078,0,5,0),t(88578,2,5,0),t(88744,5,3,0),h(88911,0,5,89328),
  t(89411,2,5,0),t(89744,5,5,0),t(90078,2,5,0),t(90578,0,5,0),
  t(90744,2,5,0),t(91078,5,5,0),t(91411,7,3,0),t(91411,1,3,0),
  t(91911,4,5,0),t(92078,2,5,0),f(92411,0,5),t(93078,0,5,0),
  t(93411,0,5,0),t(93661,3,4,0),t(93744,0,5,0),t(93911,4,5,0),
  t(94244,2,5,0),t(95078,0,4,0),t(95411,0,5,0),t(95578,2,5,0),
  t(95911,4,5,0),t(96078,6,4,0),t(96744,4,5,0),t(96911,2,5,0),
  t(97244,4,5,0),t(97411,2,5,0),t(97578,0,5,0),t(97744,2,5,0),
  t(97911,4,5,0),t(98078,0,5,0),t(98661,6,4,0),t(99578,0,5,0),
  t(99745,2,5,0),f(99828,1,4),t(100411,0,5,3),t(101078,2,5,0),
  t(101411,4,5,0),t(101745,0,5,0),t(102411,5,5,0),t(103411,0,5,0),
  t(103745,0,5,0),t(104078,2,5,0),t(104578,4,5,0),t(105078,5,5,0),
  t(105745,4,5,0),t(106411,0,5,0),t(106745,2,5,0),t(107078,4,5,0),
  t(107411,5,5,0),t(107745,4,5,0),t(108078,2,5,0),t(108411,0,5,0),
  t(108745,0,5,0),f(109411,2,5),t(109745,5,4,0),t(109911,5,5,0),
  t(110078,5,3,0),t(110245,2,5,0),t(110745,6,3,0),t(110745,0,3,0),
  t(111078,3,3,0),h(111411,5,3,111828),t(111911,2,8,0),t(112078,4,5,0),
  t(112411,4,5,0),t(112745,0,5,0),t(113078,2,5,0),t(113411,0,5,0),
  t(113578,0,5,0),t(114078,0,5,0),t(114245,3,4,0),t(114745,4,5,0),
  t(114911,5,5,0),t(115245,5,4,0),t(115411,2,5,0),t(115745,4,5,0),
  t(116078,2,5,0),f(116745,0,5),t(117245,2,5,0),t(117411,6,1,0),
  t(117745,2,5,0),h(117912,5,5,118495),t(118745,2,5,0),t(119078,2,5,0),
  t(119412,4,5,0),t(119578,4,5,0),t(119912,5,5,0),t(120078,5,5,0),
  t(120412,3,4,0),t(120578,7,3,0),t(120578,1,3,0),s(120745,121495,[[120745,2,4],[120828,2,4],[120912,2,4],[120995,4,3],[121078,2,3],[121162,4,3],[121245,2,3],[121328,4,2],[121412,2,2],[121495,4,2]]),
  t(121578,0,5,0),t(121912,0,5,0),t(122078,2,5,0),t(122912,0,5,0),
  t(123412,1,4,0),t(123745,2,5,0),t(123912,4,5,0),t(124245,5,5,0),
  t(124578,4,5,0),f(124745,5,4),t(125412,5,5,0),t(125578,4,5,0),
  t(126078,5,5,0),t(127078,2,5,0),t(127412,4,5,0),h(127745,2,1,128495,0,[[127745,2,1],[128162,1,3],[128495,0,5]]),
  t(128078,0,1,0),t(128745,2,5,0),t(128912,0,5,0),t(129078,0,5,0),
  t(129412,0,5,4),t(129745,0,5,0),t(129912,0,5,0),t(130078,2,5,0),
  h(130412,4,5,130828),t(131078,3,4,0),t(131245,5,4,0),t(131412,2,5,0),
  t(131745,1,4,0),t(132078,5,3,0),t(132245,0,5,0),t(132578,3,4,0),
  t(132745,0,3,0),f(132912,3,4),t(133245,5,5,0),t(133662,2,5,0),
  t(133745,0,4,0),t(133912,0,4,0),t(134078,1,3,0),t(134078,7,3,0),
  t(134412,2,5,0),t(134745,1,5,0),t(134828,0,4,0),t(134912,2,5,0),
  t(134995,1,4,0),t(135245,5,4,0),t(135412,0,5,0),t(135995,3,4,0),
  t(136078,5,3,0),t(136412,7,3,0),t(136745,5,3,0),t(137079,2,5,0),
  t(137162,1,4,0),t(137245,0,3,0),t(137412,1,3,0),t(137495,0,3,0),
  f(137579,0,5),t(137912,0,5,0),t(138079,1,8,0),t(138245,1,3,0),
  t(138412,0,4,0),t(138745,1,3,0),t(138912,4,5,0),t(139412,0,5,0),
  t(139745,3,4,0),t(139912,0,4,0),t(140079,0,5,0),t(140245,6,1,0),
  t(140412,2,5,0),t(140579,1,3,0),t(140745,0,5,0),t(140912,2,1,0),
  t(141079,2,5,0),t(141245,5,4,0),t(141412,5,5,0),t(141745,5,4,0),
  t(141912,4,5,0),t(142412,5,5,0),f(142745,7,3),t(143079,3,4,0),
  t(143412,6,3,0),t(143412,0,3,0),h(143579,5,5,144162,0,[[143579,5,5],[143912,6,3],[144162,7,1]]),t(144245,4,5,0),
  t(144662,3,4,0),t(144745,4,5,0),t(145079,3,4,0),t(145412,1,3,0),
  t(145912,0,3,0),t(145995,2,4,0),t(146079,0,5,0),t(146579,0,5,0),
  t(146745,1,3,0),t(146912,0,3,0),t(147079,0,5,0),t(147245,0,4,0),
  t(147412,0,5,0),t(147745,2,5,0),t(147829,0,5,0),t(148079,4,5,0),
  t(148245,2,5,0),t(148329,6,4,0),t(148579,2,5,0),t(148745,5,5,0),
  f(148912,2,5),t(149245,4,5,0),t(149412,5,5,0),t(149579,4,5,0),
  t(149745,2,5,0),t(150079,1,4,0),t(150245,0,5,0),t(150412,1,4,0),
  t(150579,0,4,0),t(150745,0,5,0),t(150912,0,5,0),t(151245,0,5,0),
  t(151745,0,5,0),t(152079,0,5,0),t(152245,3,4,0),t(152412,1,3,0),
  t(152912,0,4,0),t(153079,0,5,0),t(153245,3,4,0),t(153412,4,5,0),
  t(153662,6,3,0),t(153662,0,3,0),t(153912,7,3,0),t(153995,5,3,0),
  t(154162,5,5,0),f(154245,4,5),t(154579,2,5,0),s(154745,155329,[[154745,1.5,4],[154829,1,3],[154912,1,3],[154995,0.5,2],[155079,1.5,2],[155162,1.5,3],[155245,2.5,3],[155329,2.5,4]]),
  t(155579,0,5,0),t(155746,2,5,0),s(156412,157329,[[156412,2.5,4],[156496,2.5,4],[156579,2.5,3],[156662,1,3],[156746,2,3],[156829,1.5,2],[156912,1.5,2],[156996,1.5,3],[157079,1,3],[157162,2.5,3],[157246,1,4],[157329,3,4]]),t(156912,3,5,0),
  t(157579,0,5,0),t(157746,2,5,0),t(158412,5,5,0),t(158579,4,5,0),
  t(158912,2,5,0),t(159079,0,5,0),t(159579,0,5,0),t(160246,0,5,0),
  t(160412,2,5,0),t(160579,4,5,0),t(161079,1,8,0),f(161662,1,4),
// </kindan-no-resistance-v3-expert-notes>
])(mhTap,mhHoldV2,mhFlick,mhSlideV2);
const kindanNoResistanceMasterNotes=((t,h,f,s)=>[
// <kindan-no-resistance-v3-master-notes>
  t(2076,0,6,0),h(2743,3,3,3076),f(3243,5,3),t(3743,6,4,0),
  t(4076,5,4,0),t(4410,3,4,0),h(4743,3,1,5660,0,[[4743,3,1],[5076,2,2],[5326,2,3],[5660,1,4]]),t(5743,0,4,0),
  t(5826,4,2,0),t(5910,2,2,0),t(6076,5,3,0),t(6076,0,3,0),
  t(6576,1,3,0),t(6743,3,4,0),t(7076,5,3,0),t(7410,6,4,0),
  t(7910,5,3,0),t(8076,3,4,0),t(8410,1,3,0),t(8743,0,2,0),
  t(8993,1,4,0),t(9410,0,2,0),t(9410,4,2,0),t(9743,4,2,0),
  t(9743,8,2,0),t(10076,0,2,0),t(10076,4,2,0),t(10410,4,2,0),
  t(10410,8,2,0),f(10743,5,4),h(11076,3,4,11576),t(11743,1,3,0),
  t(12076,6,2,0),t(12410,3,4,0),t(12576,1,4,0),t(12743,0,2,0),
  t(13410,1,4,0),t(13743,3,3,0),t(14076,6,2,0),t(14243,6,4,0),
  t(14576,4,2,0),t(14743,5,4,0),t(15076,7,3,0),t(15326,6,2,0),
  t(15410,4,2,0),t(15910,5,4,0),t(15910,0,3,0),t(16076,4,2,0),
  t(16243,1,3,0),t(17076,3,4,0),t(17743,5,3,0),s(18076,19243,[[18076,1.5,3],[18160,0.5,3],[18243,0,2],[18326,0,2],[18410,0,2],[18493,0,2],[18576,0,2],[18660,0,2],[18743,0,2],[18826,0.5,2],[18910,0.5,2],[18993,0,2],[19076,0,2],[19160,0,3],[19243,0.5,3]],1),
  s(18076,19243,[[18076,3,2],[19243,4,2]]),t(19743,6,2,0),t(20076,8,2,0),t(20743,6,2,0),
  s(21743,22493,[[21743,0,2],[21993,0,2],[22243,1.5,2],[22493,4,2]]),t(22076,4,2,0),s(23077,24077,[[23077,1.5,2],[23493,2.5,2],[23743,3,2],[23993,3.5,3],[24077,3.5,3]],1),s(23077,24077,[[23077,0,2],[24077,2,2]]),
  t(24743,4,2,0),h(25077,6,4,25493,1),t(26077,8,2,0),t(26743,6,2,0),
  t(27077,6,4,0),t(27160,5,3,0),t(27243,3,4,0),t(27577,3,4,0),
  t(27910,5,4,0),t(28077,6,4,0),t(28410,0,2,0),t(28410,4,2,0),
  t(28577,1,2,0),t(28577,5,2,0),t(28743,3,2,0),t(28743,7,2,0),
  t(28910,4,2,0),t(28910,8,2,0),t(29077,3,3,0),t(29243,5,4,0),
  f(29410,3,4),t(29910,1,4,0),t(30077,1,4,0),t(30077,7,3,0),
  t(30410,0,4,1),t(30743,0,6,0),h(30910,0,3,31327),t(31410,1,4,0),
  t(31577,3,4,0),t(31910,5,4,0),t(32077,8,2,0),t(32243,5,3,0),
  t(32577,3,4,0),t(32743,2,2,0),t(32910,0,2,0),t(33077,1,4,0),
  t(33243,0,3,0),t(33410,2,2,0),f(33577,0,2),h(34077,0,2,34410),
  t(34660,2,3,0),t(34743,0,4,0),t(34910,2,2,0),t(35243,3,3,0),
  t(35410,5,4,0),t(35743,7,3,0),h(35827,5,4,36327,0,[[35827,5,4],[36077,5,3],[36327,6,1]]),t(36410,3,3,0),
  t(36577,5,3,0),t(36743,6,2,0),t(37243,7,3,0),t(37410,8,2,0),
  t(37577,5,3,0),t(37743,7,3,0),t(37910,6,2,0),t(37910,2,2,0),
  t(38077,6,4,0),t(38410,1,4,0),t(38577,3,4,0),h(38660,5,3,39077),
  t(39243,6,4,0),h(39410,3,4,39910),t(40077,5,4,0),f(40243,1,4),
  t(40743,1,4,0),t(41077,0,4,0),t(41243,1,4,0),t(41577,0,4,0),
  t(42077,0,4,0),h(42410,2,2,42744),h(42910,0,2,43327),t(43410,1,4,0),
  t(43744,0,3,0),t(44077,1,4,0),t(44244,4,1,0),h(44744,5,4,45077),
  t(45244,8,2,0),t(45410,5,4,0),t(45744,2,2,0),t(45744,6,2,0),
  t(46077,2,2,0),t(46077,7,2,0),t(46410,1,2,0),t(46410,8,2,0),
  t(46744,0,2,0),t(46744,8,2,0),t(47077,1,4,0),t(47244,4,2,0),
  f(47577,2,2),h(47910,5,1,48410,0,[[47910,5,1],[48160,3,4],[48410,5,1]]),t(48494,5,3,0),t(48577,4,2,0),
  t(48744,6,2,0),t(48744,2,2,0),t(48994,7,3,0),h(49077,5,4,49494),
  t(49577,7,3,0),t(49744,6,2,0),t(49827,2,2,0),t(49910,5,4,0),
  t(49994,5,2,0),t(50077,7,3,0),t(50160,4,2,0),t(50327,5,3,0),
  h(50994,6,4,51494,0,[[50994,6,4],[51244,8,1],[51494,6,4]]),s(50994,51494,[[50994,1,2],[51494,2,2]]),t(51660,4,6,0),t(51744,6,4,0),
  t(51910,5,4,0),f(52244,3,4),t(52660,2,3,0),t(52744,0,4,0),
  t(52910,1,4,0),t(53160,0,3,0),t(53244,1,4,0),t(53327,0,3,0),
  t(53410,2,2,0),t(53577,4,2,0),t(53744,6,2,0),t(54077,8,2,0),
  t(54494,5,3,0),t(54577,7,3,0),h(54744,5,4,55077),t(55244,2,3,0),
  t(55244,7,3,0),t(55410,5,4,0),t(55577,8,2,0),t(55744,5,3,0),
  t(55827,3,3,0),t(56077,6,2,0),t(56244,4,2,0),t(56410,1,4,0),
  f(56744,5,4),t(57077,3,3,0),t(57244,1,3,0),t(57410,0,4,0),
  t(57577,0,4,0),t(57744,1,4,0),t(57827,0,3,0),t(57910,1,4,0),
  t(58077,3,4,0),t(58244,2,2,0),t(58744,3,4,0),t(59160,1,3,0),
  t(59244,0,2,0),t(59410,1,4,0),t(59577,0,2,0),t(59744,1,4,0),
  t(60077,5,4,0),t(60410,3,4,0),t(60494,1,4,0),t(60577,6,2,0),
  t(60660,4,2,0),t(60744,6,2,0),s(60994,61494,[[60994,2,3],[61077,2,3],[61161,2,2],[61244,3.5,2],[61327,2,2],[61411,4,2],[61494,4,2]]),t(61577,1,3,0),
  t(61911,5,4,0),t(61911,0,3,0),f(62077,3,4),t(62411,1,4,0),
  t(62577,0,3,0),t(62744,2,2,0),t(62911,5,3,0),t(62994,3,3,0),
  t(63244,7,3,0),t(63411,3,4,0),t(63577,6,2,0),t(63911,6,4,0),
  t(64077,6,2,0),t(64327,6,2,0),t(64411,6,4,0),t(64661,5,3,0),
  t(64744,8,2,0),t(65077,1,4,2),t(65411,3,4,0),f(65577,5,4),
  t(66077,6,4,0),t(66244,6,2,0),t(66411,7,3,0),t(66494,4,3,0),
  t(66577,4,6,0),t(66744,4,2,0),t(66994,0,3,0),t(67077,4,2,0),
  t(67244,7,2,0),t(67411,3,3,0),t(67744,0,4,0),t(67827,3,3,0),
  t(68077,6,4,0),t(68077,1,3,0),t(68244,5,4,0),t(68411,6,4,0),
  t(68577,5,4,0),t(68744,8,2,0),t(69077,5,4,0),t(69411,3,4,0),
  t(69744,1,4,0),t(69911,0,3,0),t(69994,1,3,0),t(70077,3,2,0),
  t(70244,1,3,0),t(70411,3,4,0),h(70661,3,3,70994),t(71077,7,3,0),
  t(71161,5,3,0),t(71244,7,3,0),f(71411,6,2),t(71911,5,4,0),
  t(71994,3,4,0),s(72077,72661,[[72077,3,3],[72161,2.5,2],[72244,1.5,2],[72327,1.5,2],[72411,1.5,2],[72494,2.5,2],[72577,3.5,2],[72661,3.5,3]]),t(72911,4,2,0),t(73077,5,4,0),
  t(73411,1,3,0),t(73827,3,3,0),t(73994,5,3,0),t(74077,3,4,0),
  t(74244,1,3,0),t(74577,0,2,0),t(74911,1,3,0),t(75077,1,4,0),
  t(75077,7,3,0),t(75244,5,4,0),t(75327,1,3,0),t(75744,5,3,0),
  t(75827,3,3,0),f(76077,8,2),t(76411,6,4,0),t(76494,5,3,0),
  t(76744,8,2,0),t(76911,6,2,0),t(77077,1,3,0),t(77411,3,4,0),
  t(77577,6,2,0),t(77744,6,4,0),t(78077,5,4,0),t(78411,6,4,0),
  t(78577,6,2,0),t(78744,6,4,0),t(79077,5,4,0),t(79411,3,4,0),
  t(79577,2,2,0),t(79744,0,4,0),t(80078,5,4,0),t(80161,1,3,0),
  t(80244,3,3,0),t(80411,0,4,0),t(80578,2,2,0),t(80744,0,3,0),
  f(80911,2,2),t(81411,3,4,0),t(81744,1,4,0),t(82078,1,4,0),
  t(82078,7,3,0),t(82244,6,2,0),t(82411,6,4,0),t(82744,2,6,0),
  t(82911,2,2,0),t(83078,0,3,0),t(83244,2,2,0),t(83411,0,2,0),
  t(83411,4,2,0),t(83744,4,2,0),t(83744,8,2,0),t(84078,0,2,0),
  t(84078,4,2,0),t(84411,4,2,0),t(84411,8,2,0),t(84744,3,4,0),
  t(84828,5,4,0),t(85078,3,4,0),t(85161,1,3,0),t(85411,5,4,0),
  t(85661,2,2,0),t(85828,3,3,0),f(86078,0,2),t(86411,0,4,0),
  t(86494,3,3,0),t(86744,2,2,0),t(86911,6,2,0),t(86994,3,3,0),
  t(87244,6,4,0),t(87578,1,4,0),t(88078,3,4,0),t(88578,5,4,0),
  t(88744,8,2,0),t(88911,5,4,0),h(88994,7,3,89328),t(89411,5,4,0),
  t(89744,6,4,0),t(89744,1,3,0),t(89911,3,4,0),t(90078,1,4,0),
  t(90578,0,4,0),t(90744,1,4,0),t(91078,3,4,0),t(91411,6,2,0),
  f(91578,3,4),t(91911,1,4,0),h(92078,0,4,92578,1),t(93078,0,4,0),
  t(93411,3,4,0),t(93661,1,3,0),t(93744,5,4,0),t(93911,5,4,0),
  t(93994,7,3,0),t(94244,5,4,0),t(95078,1,3,3),t(95411,3,4,0),
  t(95578,5,4,0),t(95911,6,4,0),t(96078,3,3,0),t(96744,5,4,0),
  t(96911,3,4,0),t(96994,1,3,0),t(97244,1,2,0),t(97244,5,2,0),
  t(97411,2,2,0),t(97411,6,2,0),t(97578,2,2,0),t(97578,6,2,0),
  t(97744,3,2,0),t(97744,7,2,0),t(97911,0,4,0),f(98078,1,4),
  t(98661,2,3,0),t(98661,7,3,0),t(99328,5,3,0),t(99578,6,4,0),
  t(99745,5,4,0),t(99828,7,3,0),t(100411,5,4,0),t(100578,0,2,0),
  t(101078,5,4,0),t(101411,1,4,0),t(101745,6,4,0),t(102411,3,4,0),
  t(103411,0,4,0),t(103745,1,4,0),t(104078,3,4,0),t(104578,0,6,0),
  t(104745,0,2,0),t(105078,1,4,0),t(105745,3,4,0),t(106411,5,4,0),
  f(106745,3,4),t(107078,2,2,0),t(107078,6,2,0),t(107411,2,2,0),
  t(107411,7,2,0),t(107745,1,2,0),t(107745,8,2,0),t(108078,0,2,0),
  t(108078,8,2,0),t(108411,1,4,0),t(108745,0,4,0),t(108911,1,4,0),
  t(109411,0,4,0),t(109745,3,3,0),t(109911,1,4,0),t(110078,6,2,0),
  t(110245,1,4,0),t(110578,5,4,0),t(110745,4,2,0),t(110745,8,2,0),
  t(111078,8,2,0),h(111411,4,2,111828),t(111911,5,4,0),t(112078,3,4,0),
  t(112411,1,4,0),t(112578,2,4,0),t(112661,4,3,0),f(112745,0,4),
  t(113078,1,4,0),t(113411,3,4,0),t(113578,1,4,0),t(114078,5,4,0),
  t(114245,3,3,0),t(114745,6,4,0),t(114911,6,4,0),t(115245,7,3,0),
  t(115411,6,4,0),t(115745,6,4,0),t(116078,5,4,0),t(116245,6,2,0),
  t(116745,6,4,0),t(117245,6,4,0),t(117411,6,1,0),t(117745,6,4,0),
  t(117828,5,3,0),h(117912,8,1,118495,0,[[117912,8,1],[118245,7,3],[118495,6,4]]),t(118745,3,4,0),t(118912,2,3,0),
  t(118912,7,3,0),f(119078,5,4),t(119412,5,4,0),t(119578,6,4,0),
  t(119912,6,4,0),t(120078,3,4,0),t(120412,7,3,0),t(120578,4,2,0),
  s(120745,121495,[[120745,3,3],[120828,3,3],[120912,3,3],[120995,4,2],[121078,2.5,2],[121162,4,2],[121245,2.5,2],[121328,4,2],[121412,3,2],[121495,4,2]]),t(121578,3,4,0),t(121912,5,4,0),t(122078,6,4,0),
  t(122912,5,4,0),t(123412,7,3,0),t(123745,5,4,0),t(123912,6,4,0),
  t(124245,3,4,0),t(124578,5,4,0),t(124745,7,3,0),t(125078,6,2,0),
  t(125412,1,4,0),t(125578,5,4,0),t(126078,3,4,0),f(126412,7,3),
  t(126912,5,4,0),t(127078,6,4,0),t(127412,4,6,0),h(127745,6,4,128495,0,[[127745,6,4],[128162,7,3],[128495,8,1]]),
  t(128078,5,4,0),t(128745,3,4,0),t(128912,1,4,0),t(129078,0,4,0),
  t(129412,0,4,4),t(129745,1,4,0),t(129912,3,4,0),t(130078,5,4,0),
  h(130412,1,4,130828),t(131078,2,3,0),t(131078,7,3,0),t(131245,5,3,0),
  t(131412,6,4,0),t(131745,0,3,0),t(131912,4,2,0),t(132078,7,2,0),
  t(132245,3,4,0),t(132328,0,3,0),t(132578,3,3,0),t(132662,0,3,0),
  t(132745,4,2,0),f(132912,6,3),t(133245,3,4,0),t(133662,5,4,0),
  t(133745,3,3,0),t(133912,1,3,0),t(134078,0,2,0),t(134412,0,4,0),
  t(134745,1,4,0),t(134828,3,3,0),t(134912,6,4,0),t(134995,5,3,0),
  t(135245,7,3,0),t(135328,5,3,0),t(135412,6,4,0),t(135995,5,3,0),
  t(136078,8,2,0),t(136245,6,1,0),f(136412,8,2),t(136745,2,2,0),
  t(136745,6,2,0),t(136995,0,2,0),t(137079,1,4,0),t(137162,0,3,0),
  t(137245,4,2,0),t(137412,2,2,0),t(137495,0,2,0),t(137579,2,4,0),
  t(137662,1,3,0),t(137912,0,4,0),t(138079,1,4,0),t(138245,4,2,0),
  t(138412,0,3,0),t(138745,2,2,0),t(138912,0,4,0),t(139412,1,4,0),
  t(139745,0,3,0),t(139912,3,3,0),t(140079,1,4,0),t(140245,4,1,0),
  t(140412,1,4,0),t(140579,0,2,0),t(140662,1,3,0),t(140745,2,4,0),
  t(140912,2,1,0),t(141079,0,4,0),t(141245,1,3,0),t(141245,6,3,0),
  f(141412,1,4),t(141745,0,3,0),t(141829,2,3,0),t(141912,0,4,0),
  t(142412,5,4,0),t(142745,4,2,0),t(143079,0,3,0),t(143162,0,6,0),
  t(143412,2,2,0),h(143579,5,1,144162,0,[[143579,5,1],[143912,3,4],[144162,5,1]]),t(144245,1,4,0),t(144662,0,3,0),
  t(144745,3,4,0),t(145079,7,3,0),t(145162,3,3,0),t(145412,0,2,0),
  t(145912,2,2,0),t(145995,5,3,0),f(146079,3,4),t(146579,6,4,0),
  t(146745,6,2,0),t(146912,2,2,0),t(147079,3,4,0),t(147245,0,3,0),
  t(147412,1,4,0),t(147745,0,4,0),t(147829,1,4,0),t(147912,0,2,0),
  t(148079,0,4,0),t(148245,1,4,0),t(148329,0,3,0),t(148579,1,4,0),
  t(148662,0,3,0),t(148745,3,4,0),f(148912,1,4),t(149245,5,4,0),
  t(149245,0,3,0),t(149412,6,4,0),t(149579,5,4,0),t(149745,3,4,0),
  t(149912,6,2,0),t(149995,8,2,0),t(150079,5,3,0),t(150245,3,4,0),
  t(150412,1,3,0),t(150579,0,3,0),t(150745,0,4,0),t(150912,0,4,0),
  t(151245,1,4,0),t(151329,0,3,0),t(151745,1,4,0),t(152079,0,4,0),
  t(152162,2,2,0),t(152245,3,3,0),t(152412,6,2,0),t(152912,7,3,0),
  t(153079,5,4,0),t(153245,3,3,0),t(153412,5,4,0),t(153662,4,2,0),
  t(153912,2,2,0),t(153995,4,2,0),t(154162,0,4,0),f(154245,3,4),
  t(154579,6,4,0),t(154579,1,3,0),s(154745,155329,[[154745,2,3],[154829,2,2],[154912,2,2],[154995,1,2],[155079,2.5,2],[155162,2.5,2],[155245,3,2],[155329,3,3]]),t(155579,0,4,0),
  t(155746,3,4,0),t(156246,6,4,0),s(156412,157329,[[156412,3,3],[156496,3,3],[156579,3,2],[156662,1.5,2],[156746,3,2],[156829,2,2],[156912,2,2],[156996,2,2],[157079,2,2],[157162,3,2],[157246,2,3],[157329,3.5,3]]),t(156912,0,4,0),
  t(157579,3,4,0),t(157746,3,4,0),t(158412,6,4,0),t(158579,3,4,0),
  t(158912,6,4,0),t(159079,3,4,0),t(159579,6,4,0),t(160246,6,4,0),
  t(160412,5,4,0),t(160579,3,4,0),t(161079,0,6,0),t(161662,0,3,0),
  f(161912,1,3),
// </kindan-no-resistance-v3-master-notes>
])(mhTap,mhHoldV2,mhFlick,mhSlideV2);

// crossing field（1分29秒）。譜面はV3パイプラインが入れる。
// ユーザーからmp4で受け取った曲。映像を落として音源だけを取り出し、
// ほかのBGMと同じ 32kHz/96kbps・-14 LUFS へそろえたmp3にしてある(1.02MB)。全尺で遊ぶ。
// 自動判定は 134.23BPM/3拍子だったが、格子への乗りが76%と低い。178.97BPM/4拍子(=4/3倍)を
// 指定すると±43msで100%に乗るので、そちらを正とした。
const CROSSING_FIELD_DURATION_MS=89208;
const crossingFieldEasyNotes=((t,h,f,s)=>[
// <crossing-field-v3-easy-notes>
  t(2804,0,10,0),t(3475,2,6,0),t(4145,4,6,0),t(4816,6,4,0),
  t(6157,5,4,0),t(6827,6,4,0),t(7162,5,4,0),t(8168,2,6,0),
  t(8503,4,6,0),t(9174,3,4,0),t(9509,0,6,0),t(10515,0,4,0),
  t(10683,0,4,0),h(11521,2,3,12191,0,[[11521,2,3],[11856,1,4],[12191,0,6]]),t(12527,2,6,0),t(12862,1,4,0),
  t(13532,0,6,0),t(14538,0,6,0),t(15879,2,6,0),t(16214,0,6,0),
  t(16885,0,6,0),h(17555,1,4,18896),t(19567,0,4,1),t(20237,0,6,0),
  t(20573,2,6,0),h(20908,1,4,21411),t(21578,2,6,0),t(22249,0,6,0),
  t(22584,0,4,0),t(23590,1,4,0),t(24260,1,4,0),t(25266,0,6,0),
  t(25937,0,6,0),t(26272,3,4,0),t(26942,4,6,0),t(27278,4,6,0),
  t(27613,4,6,0),t(27948,2,6,0),t(28283,0,3,0),t(28283,7,3,0),
  t(29289,2,6,0),t(29624,5,4,0),t(30965,3,4,0),t(31133,5,4,0),
  t(31803,3,4,0),t(32306,5,4,0),t(32642,3,4,0),t(32977,3,4,0),
  h(34318,1,4,34653),t(34988,0,4,0),t(35324,1,4,0),t(35659,0,6,2),
  t(37000,0,4,0),t(37503,0,6,0),t(38006,2,6,0),t(38341,4,6,0),
  t(38676,6,4,0),t(40352,4,6,0),t(40688,4,6,0),t(41023,4,6,0),
  t(41358,6,4,0),t(41526,4,6,0),t(42029,6,4,0),t(42364,3,4,0),
  t(42699,5,4,0),t(43034,4,6,0),t(43705,4,6,0),h(44711,2,6,45297,0,[[44711,2,6],[45046,3,4],[45297,4,3]]),
  t(45716,0,6,0),t(46052,0,6,0),t(46722,3,4,0),t(47057,5,4,0),
  t(47393,4,6,0),t(47728,5,4,0),t(48063,3,4,0),t(48398,0,6,0),
  t(48734,3,4,0),t(49069,3,4,0),t(50075,0,10,0),t(50410,6,4,0),
  t(51416,5,4,0),t(51751,3,4,0),t(52086,1,4,0),t(52421,0,6,0),
  t(52757,1,4,0),t(53092,0,6,3),t(53427,0,4,0),t(53762,0,6,0),
  t(54433,1,4,0),t(54768,3,4,0),t(55103,5,4,0),t(55606,3,4,0),
  t(55942,1,4,0),t(56109,3,4,0),t(56444,5,4,0),t(56780,6,4,0),
  t(57115,5,4,0),t(57450,6,4,0),t(58121,4,6,0),t(58456,7,3,0),
  t(58456,0,3,0),t(58791,5,4,0),t(59126,3,4,0),t(59462,0,6,0),
  t(59797,0,4,0),t(60132,0,4,0),t(60467,1,4,0),h(60803,0,4,61725),
  t(62144,0,6,0),t(62479,0,6,0),t(62814,0,6,0),t(63149,0,6,0),
  t(63485,0,6,0),t(63820,0,6,0),t(64155,0,6,0),t(64491,0,6,0),
  t(65161,0,6,0),t(65496,0,6,0),t(65832,3,4,0),t(65999,5,4,0),
  t(67005,6,4,0),t(67173,4,6,0),h(67508,4,3,68346,0,[[67508,4,3],[67759,3,4],[68094,3,4],[68346,4,3]]),t(68514,0,4,0),
  t(68849,0,6,0),t(69184,3,4,0),t(69519,4,6,4),t(70022,6,4,0),
  t(70357,5,4,0),h(70860,3,4,71279),t(71363,1,4,0),t(72369,2,6,0),
  t(72537,4,6,0),t(73207,2,6,0),t(73878,5,4,0),t(74213,6,4,0),
  t(74548,5,4,0),t(74716,6,4,0),t(75721,5,4,0),t(75889,2,6,0),
  t(76224,1,4,0),t(76895,0,6,0),t(77565,0,6,0),t(77901,2,6,0),
  t(78236,5,4,0),t(78571,6,4,0),t(78906,2,6,0),t(79242,1,4,0),
  t(79912,3,4,0),t(80247,5,4,0),t(80583,5,4,0),t(80918,5,4,0),
  t(81253,6,4,0),t(81588,6,4,0),t(81924,3,4,0),t(82594,5,4,0),
  t(82929,0,10,0),t(83265,7,3,0),t(83265,0,3,0),t(83767,6,4,0),
  t(83935,6,4,0),t(85108,5,4,0),t(86282,3,4,0),t(86617,5,4,0),
// </crossing-field-v3-easy-notes>
])(mhTap,mhHoldV2,mhFlick,mhSlideV2);
const crossingFieldNormalNotes=((t,h,f,s)=>[
// <crossing-field-v3-normal-notes>
  t(2804,0,10,0),f(3475,2,6),t(4145,4,6,0),t(4816,3,4,0),
  t(5151,1,4,0),t(6157,0,4,0),t(6492,1,4,0),t(6827,3,4,0),
  t(7162,5,4,0),t(8168,2,6,0),t(8503,4,6,0),t(9174,3,4,0),
  t(9509,0,6,0),t(10515,0,3,0),t(10683,3,4,0),h(11521,6,2,12191,1,[[11521,6,2],[11856,5,4],[12191,4,6]]),
  t(12527,4,6,0),t(12862,5,4,0),t(13532,2,6,0),t(14538,0,6,0),
  t(15209,1,4,0),t(15879,2,6,0),t(16214,4,6,0),t(16885,4,6,0),
  h(17555,5,4,18896),t(19232,2,6,0),t(19567,0,4,1),h(20237,2,6,20656),
  h(20908,6,4,21411),f(21578,2,6),t(22249,0,6,0),t(22584,3,4,0),
  t(23590,1,4,0),t(24260,5,4,0),t(25266,4,6,0),t(25601,6,4,0),
  t(25937,4,6,0),t(26272,6,4,0),t(26942,4,6,0),t(27278,4,6,0),
  t(27613,4,6,0),t(27948,4,6,0),t(28283,7,3,0),t(28283,0,3,0),
  t(29289,2,6,0),t(29624,5,4,0),t(29960,4,6,0),t(30630,4,6,0),
  t(30965,3,4,0),t(31133,5,4,0),t(31803,1,4,0),t(32642,0,4,0),
  t(32977,1,4,0),h(33983,2,6,34653,1),t(34988,5,3,0),f(35324,3,3),
  t(35659,0,6,0),t(36665,0,6,2),t(37000,3,4,0),t(38006,0,6,0),
  t(38341,0,6,0),t(38676,3,4,0),t(39011,5,4,0),t(39682,6,4,0),
  t(40352,4,6,0),t(40688,2,6,0),t(41023,0,6,0),t(41358,0,4,0),
  t(41526,0,6,0),t(41693,0,4,0),t(42029,1,4,0),t(42364,3,4,0),
  t(42699,5,4,0),t(43034,4,6,0),t(43705,4,6,0),t(44208,4,6,0),
  h(44711,4,6,45297,0,[[44711,4,6],[45046,6,4],[45297,7,2]]),t(45381,4,6,0),t(45716,4,6,0),t(46052,0,6,0),
  t(46722,0,3,0),t(46722,7,3,0),f(47057,5,4),t(47393,4,6,0),
  t(47728,3,4,0),t(48063,5,4,0),t(48398,2,6,0),t(48734,1,4,0),
  t(49069,0,4,0),t(49739,1,4,0),t(50075,0,10,0),t(50410,1,4,0),
  t(51080,5,4,0),t(51416,3,4,0),t(51751,1,4,0),t(52421,0,6,0),
  t(52757,5,4,0),t(53092,2,6,3),t(53427,1,4,0),t(53762,0,6,0),
  t(54098,1,4,0),t(54433,3,4,0),t(54768,5,4,0),t(55103,6,4,0),
  t(55271,5,4,0),t(55606,6,4,0),t(55942,5,4,0),f(56109,7,3),
  t(56444,1,4,0),t(56780,5,4,0),t(57115,3,4,0),t(57450,6,4,0),
  t(57785,7,3,0),t(57785,0,3,0),t(58121,4,6,0),t(58456,5,4,0),
  t(58791,6,4,0),t(59126,3,4,0),t(59462,4,6,0),t(59629,3,4,0),
  t(59797,6,4,0),t(60132,3,4,0),t(60467,5,4,0),h(60803,6,4,61725),
  t(61808,3,4,0),t(62144,4,6,0),t(62479,4,6,0),t(62814,4,6,0),
  t(63149,0,6,0),t(63485,2,6,0),t(63820,4,6,0),t(64155,4,6,0),
  t(64491,0,6,0),t(65161,4,6,0),f(65496,2,6),t(65832,6,4,0),
  t(65999,3,4,0),t(66334,5,4,0),t(67005,3,4,0),t(67173,4,6,0),
  h(67508,7,2,68346,0,[[67508,7,2],[67759,6,4],[68094,6,4],[68346,7,2]]),t(68514,5,4,0),t(68849,4,6,0),t(69184,5,4,0),
  t(69519,4,6,4),t(70022,5,4,0),t(70357,6,4,0),h(70860,5,3,71279),
  t(71363,6,4,0),t(72201,0,3,0),t(72201,7,3,0),t(72369,4,6,0),
  t(72537,2,6,0),t(73207,4,6,0),t(73878,5,4,0),t(74213,3,4,0),
  t(74548,1,4,0),t(74716,3,4,0),t(74883,5,4,0),t(75721,1,4,0),
  t(75889,0,6,0),f(76224,1,4),t(76727,0,4,0),t(76895,0,6,0),
  t(77230,1,4,0),t(77565,2,6,0),t(77901,0,6,0),t(78236,5,4,0),
  t(78571,3,4,0),t(78906,0,6,0),t(79242,0,4,0),t(79912,1,4,0),
  t(80247,3,4,0),t(80583,1,4,0),t(80918,0,4,0),t(81253,3,4,0),
  t(81588,1,4,0),t(81924,0,4,0),t(82594,1,4,0),t(82929,0,10,0),
  t(83097,1,4,0),t(83265,0,4,0),t(83600,0,3,0),t(83600,7,3,0),
  t(83767,2,4,0),t(83935,6,4,0),t(85108,5,4,0),t(86282,3,4,0),
  f(86617,3,4),
// </crossing-field-v3-normal-notes>
])(mhTap,mhHoldV2,mhFlick,mhSlideV2);
const crossingFieldHardNotes=((t,h,f,s)=>[
// <crossing-field-v3-hard-notes>
  h(2134,1,3,2469,1),t(2804,1,8,0),f(3475,4,5),t(4145,5,5,0),
  t(4816,5,4,0),t(5151,3,4,0),t(5486,3,3,0),t(6157,5,4,0),
  t(6324,3,4,0),t(6492,1,4,0),t(6827,3,4,0),t(7162,5,4,0),
  t(7833,3,4,0),t(8168,4,5,0),t(8503,2,5,0),t(8839,5,4,0),
  t(9174,6,4,0),t(9509,4,5,0),t(10515,3,3,0),t(10683,5,4,0),
  h(11521,4,1,12191,1,[[11521,4,1],[11856,3,3],[12191,2,5]]),t(12527,4,5,0),t(12862,3,4,0),t(13197,0,5,0),
  t(13532,0,5,0),t(14538,0,5,0),t(15209,1,4,0),t(15544,3,4,0),
  t(15879,4,5,0),t(16214,5,5,0),f(16885,4,5),h(17388,2,5,18729),
  t(18896,0,4,0),t(18896,7,3,0),t(19064,5,4,0),t(19232,0,5,0),
  t(19567,3,4,1),t(19902,4,5,0),h(20237,5,5,20656),h(20908,5,4,21411),
  t(21578,2,5,0),t(22249,0,5,0),t(22584,3,4,0),t(22919,1,4,0),
  t(23255,3,4,0),t(23590,5,4,0),t(23925,2,5,0),t(24260,0,4,0),
  t(24931,1,4,0),t(25266,2,5,0),t(25601,5,4,0),t(25937,5,5,0),
  t(26272,5,4,0),t(26942,2,5,0),t(27278,0,5,0),t(27613,2,5,0),
  t(27948,5,5,0),t(28283,3,4,0),t(28451,0,4,0),t(28451,7,3,0),
  f(28619,1,4),t(29121,3,4,0),t(29289,4,5,0),t(29624,6,4,0),
  t(29960,4,5,0),t(30630,2,5,0),t(30965,5,4,0),t(31133,3,4,0),
  t(31468,0,5,0),t(31803,0,4,0),t(32306,1,4,0),t(32642,3,4,0),
  t(32977,5,4,0),t(33815,2,5,0),h(33983,5,5,34653,1),t(34988,1,3,0),
  t(35324,5,3,0),t(35659,2,5,2),t(36497,1,4,0),t(36665,2,5,0),
  t(37000,5,4,0),t(37503,2,5,0),t(38006,0,5,0),t(38341,0,5,0),
  t(38676,0,4,0),t(38676,7,3,0),t(38844,0,8,0),t(39011,0,4,0),
  t(39682,3,4,0),f(40017,1,4),t(40352,4,5,0),t(40688,4,5,0),
  t(41023,4,5,0),t(41358,6,4,0),t(41526,5,5,0),t(41693,3,4,0),
  t(41861,5,3,0),t(42029,6,4,0),t(42196,5,4,0),t(42364,6,4,0),
  t(42699,6,4,0),t(43034,5,5,0),t(43537,5,5,0),t(43705,2,5,0),
  t(44208,4,5,0),t(44543,3,4,0),h(44711,1,5,45297,0,[[44711,1,5],[45046,2,3],[45297,3,1]]),t(45381,0,5,0),
  t(45549,1,4,0),h(45716,0,5,46135),t(46387,1,4,0),t(46722,3,4,0),
  t(46806,6,4,0),t(47057,5,4,0),t(47393,4,5,0),t(47728,6,4,0),
  f(48063,6,4),t(48398,4,5,0),t(48566,3,3,0),t(48734,1,4,0),
  t(48901,0,4,0),t(49069,1,4,0),t(49739,0,4,0),t(49739,7,3,0),
  t(50075,4,5,0),t(50410,6,4,0),t(50745,1,4,0),t(51080,5,4,0),
  t(51416,3,4,0),t(51751,6,4,0),t(52086,5,4,0),t(52254,5,4,0),
  t(52421,5,5,0),t(52757,6,4,3),t(53092,4,5,0),t(53176,6,4,0),
  t(53427,5,4,0),t(53595,5,5,0),t(53762,5,5,0),t(54098,6,4,0),
  t(54433,6,4,0),t(54768,6,4,0),t(55103,3,4,0),t(55271,5,4,0),
  t(55439,7,3,0),f(55606,5,4),t(55942,1,4,0),t(56109,3,3,0),
  t(56444,5,4,0),t(56612,6,4,0),t(56780,5,4,0),t(56947,7,3,0),
  t(57115,5,4,0),t(57450,6,4,0),t(57618,5,4,0),t(57785,3,4,0),
  t(58121,0,5,0),t(58456,0,4,0),t(58791,0,4,0),t(59126,2,4,0),
  t(59210,0,5,0),t(59462,0,5,0),t(59629,3,4,0),t(59713,0,5,0),
  t(59965,0,4,0),t(60132,1,4,0),t(60467,0,4,0),s(60803,61725,[[60803,2,4],[60887,1.5,4],[61054,2.5,3],[61222,2.5,3],[61389,1.5,3],[61557,0.5,2],[61725,0.5,2]]),
  t(61808,0,4,0),t(62144,1,8,0),t(62479,0,5,0),t(62814,4,5,0),
  t(62982,3,3,0),f(63149,5,5),t(63485,0,5,0),t(63652,1,3,0),
  t(63820,2,5,0),t(64155,4,5,0),t(64491,5,5,0),t(64826,5,4,0),
  t(65161,2,5,0),t(65329,0,4,0),t(65496,2,5,0),t(65832,6,4,0),
  t(65999,3,4,0),t(66167,0,4,0),t(66334,0,4,0),t(66670,1,4,0),
  t(66837,0,3,0),t(67005,1,4,0),t(67173,2,5,0),h(67508,3,1,68346,0,[[67508,3,1],[67759,1,4],[68094,1,4],[68346,3,1]]),
  t(68514,0,4,0),t(68849,0,5,4),t(69184,1,4,0),t(69352,0,5,0),
  t(69519,0,5,0),t(69687,1,4,0),t(70022,3,4,0),t(70190,5,3,0),
  f(70357,3,4),h(70860,5,3,71279),t(71363,6,4,0),t(71531,5,3,0),
  t(72201,7,3,0),t(72369,5,5,0),t(72537,5,5,0),t(72704,6,4,0),
  t(73039,6,4,0),t(73039,0,3,0),t(73207,4,5,0),t(73542,6,4,0),
  t(73878,6,4,0),t(74045,2,5,0),t(74213,5,4,0),t(74548,6,4,0),
  t(74716,5,4,0),t(74883,0,4,0),t(74967,1,4,0),t(75638,1,4,0),
  t(75721,0,4,0),t(75889,0,5,0),t(76224,0,4,0),t(76392,0,5,0),
  t(76560,0,3,0),t(76727,1,4,0),t(76895,2,5,0),t(77230,5,4,0),
  t(77398,6,4,0),t(77565,5,5,0),f(77901,5,5),t(78236,6,4,0),
  t(78571,6,4,0),t(78906,0,5,0),t(79242,3,4,0),t(79577,5,4,0),
  t(79912,6,4,0),t(80247,3,4,0),t(80583,5,4,0),t(80750,6,4,0),
  t(80918,5,4,0),t(81253,3,4,0),t(81588,3,4,0),t(81924,3,4,0),
  t(82259,3,3,0),t(82426,3,3,0),t(82594,1,4,0),t(82762,0,4,0),
  t(82929,0,8,0),t(83097,5,4,0),t(83265,0,4,0),t(83265,7,3,0),
  t(83600,1,3,0),t(83767,0,4,0),t(83935,0,4,0),t(84438,1,4,0),
  t(85108,0,4,0),t(85444,1,4,0),t(86282,3,4,0),f(86617,5,4),
// </crossing-field-v3-hard-notes>
])(mhTap,mhHoldV2,mhFlick,mhSlideV2);
const crossingFieldExpertNotes=((t,h,f,s)=>[
// <crossing-field-v3-expert-notes>
  h(2134,1,3,2469,1),t(2804,1,8,0),f(3475,4,5),t(3810,7,3,0),
  t(4145,4,5,0),t(4816,0,2,0),t(4816,4,2,0),t(5151,2,2,0),
  t(5151,6,2,0),t(5486,4,2,0),t(5486,8,2,0),t(6157,3,4,0),
  t(6324,1,4,0),t(6492,3,4,0),t(6827,5,4,0),t(7162,3,4,0),
  t(7330,5,3,0),t(7833,1,2,0),t(7833,5,2,0),t(8168,3,2,0),
  t(8168,7,2,0),t(8503,1,2,0),t(8503,5,2,0),t(8839,5,4,0),
  t(9174,3,4,0),t(9509,4,5,0),t(10347,3,4,0),t(10515,5,3,0),
  t(10683,3,4,0),h(11521,2,1,12191,1,[[11521,2,1],[11856,1,3],[12191,0,5]]),t(11856,0,1,0),t(12527,0,5,0),
  t(12862,0,4,0),f(13197,0,5),t(13532,0,5,0),t(13868,1,4,0),
  h(14203,3,4,14789,1),t(15209,0,4,0),t(15544,3,4,0),t(15879,5,5,0),
  t(16214,2,5,0),t(16885,0,5,0),t(17220,1,3,0),t(17220,7,3,0),
  h(17388,0,5,18729),t(17723,3,4,0),t(17891,5,3,0),t(18896,5,4,0),
  t(19064,3,4,0),t(19232,0,5,0),t(19567,3,4,1),t(19902,0,5,0),
  h(20237,4,5,20656),h(20908,3,4,21411),t(21578,5,5,0),t(21914,0,4,0),
  t(22249,0,5,0),t(22584,3,4,0),f(22919,5,4),t(23255,6,4,0),
  t(23590,5,4,0),t(23925,2,5,0),t(24260,5,4,0),t(24931,3,4,0),
  t(25266,4,5,0),t(25601,6,4,0),t(25769,4,5,0),t(25937,0,5,0),
  t(26272,3,4,0),t(26607,4,5,0),t(26942,5,5,0),t(27278,4,5,0),
  t(27613,2,5,0),t(27948,0,5,0),t(28283,3,4,0),t(28451,1,4,0),
  t(28619,0,4,0),t(28786,1,4,0),t(29121,3,4,0),t(29289,0,5,0),
  t(29624,0,4,0),t(29624,7,3,0),t(29960,2,5,0),f(30630,4,5),
  t(30965,6,4,0),t(31133,5,4,0),t(31468,2,5,0),t(31803,5,4,0),
  t(31971,3,3,0),t(32306,5,4,0),t(32642,6,4,0),t(32977,5,4,0),
  t(33815,5,5,0),h(33983,4,5,34653,1,[[33983,4,5],[34318,5,3],[34653,6,1]]),t(34318,3,4,0),t(34988,1,3,0),
  t(35324,0,3,0),t(35659,0,5,2),t(36497,0,4,0),t(36665,0,5,0),
  t(37000,3,4,0),t(37503,4,5,0),t(37670,0,4,0),t(38006,4,5,0),
  t(38341,0,8,0),t(38676,6,4,0),t(38844,4,5,0),t(39011,6,4,0),
  f(39682,5,4),t(40017,6,4,0),t(40352,0,5,0),t(40688,4,5,0),
  t(40855,3,3,0),t(41023,5,5,0),t(41191,5,3,0),t(41358,5,4,0),
  t(41526,5,5,0),t(41693,6,4,0),t(41861,5,3,0),t(42029,3,4,0),
  t(42196,1,4,0),t(42364,0,4,0),t(42615,2,5,0),t(42699,1,4,0),
  t(43034,0,5,0),t(43537,0,5,0),t(43705,0,5,0),t(44208,0,5,0),
  t(44543,0,4,0),h(44711,2,1,45297,0,[[44711,2,1],[45046,0,5],[45297,2,1]]),t(45381,3,5,0),t(45549,0,4,0),
  t(45549,7,3,0),h(45716,4,5,46135),t(46303,3,5,0),f(46387,5,4),
  t(46722,6,4,0),t(46806,5,4,0),t(47057,3,4,0),t(47393,4,5,0),
  t(47476,3,3,0),t(47728,1,4,0),t(48063,5,4,0),t(48398,2,5,0),
  t(48566,1,3,0),t(48734,0,4,0),t(48901,1,4,0),t(49069,5,4,0),
  t(49739,1,4,0),t(50075,4,5,0),t(50410,1,4,0),t(50745,5,4,0),
  t(50913,3,4,0),t(51080,6,4,0),t(51416,6,4,0),t(51751,5,4,3),
  t(52086,6,4,0),t(52254,5,4,0),f(52421,5,5),t(52757,6,4,0),
  t(52924,7,3,0),t(53092,5,5,0),t(53176,3,4,0),t(53427,6,4,0),
  t(53595,2,5,0),t(53762,5,5,0),t(53846,5,3,0),t(54098,5,4,0),
  t(54433,6,4,0),t(54768,6,4,0),t(54936,5,4,0),t(55103,6,4,0),
  t(55271,5,4,0),t(55439,7,3,0),t(55439,1,3,0),t(55606,5,4,0),
  t(55942,6,4,0),t(56025,5,4,0),t(56109,7,3,0),t(56444,3,4,0),
  t(56612,1,4,0),t(56780,3,4,0),t(56947,1,3,0),f(57115,0,4),
  t(57450,3,4,0),t(57618,5,4,0),t(57785,3,4,0),t(58121,0,5,0),
  t(58456,0,4,0),t(58791,1,4,0),t(58875,0,4,0),t(59126,2,4,0),
  t(59210,0,5,0),t(59462,0,5,0),t(59629,5,4,0),t(59713,2,5,0),
  t(59797,5,4,0),t(59965,3,4,0),t(60132,1,4,0),t(60467,3,4,0),
  s(60803,61725,[[60803,2.5,4],[60887,2,4],[61054,2.5,3],[61222,2.5,3],[61389,2,3],[61557,1,2],[61725,1,2]]),t(61138,1,4,0),t(61808,0,4,0),t(61976,2,1,0),
  t(62144,2,8,0),f(62479,2,5),t(62814,0,5,0),t(62982,0,3,0),
  t(63149,0,5,0),t(63317,0,4,0),t(63485,0,5,0),t(63652,0,3,0),
  t(63820,2,5,0),t(64155,0,5,0),t(64323,0,5,0),t(64491,0,5,0),
  t(64826,0,4,0),t(64826,7,3,0),t(65161,0,5,0),t(65329,1,4,0),
  t(65496,0,5,0),t(65832,0,4,0),t(65999,1,4,0),t(66167,3,4,0),
  t(66334,5,4,0),t(66670,6,4,0),t(66837,7,3,0),t(67005,5,4,0),
  t(67173,4,5,0),t(67508,3,4,0),h(67592,5,5,68346,0,[[67592,5,5],[68011,7,1],[68346,5,5]]),t(68011,3,4,0),
  t(68514,5,4,4),f(68849,5,5),t(69184,6,4,0),t(69352,5,5,0),
  t(69519,5,5,0),t(69687,5,4,0),t(70022,6,4,0),t(70190,5,3,0),
  t(70357,6,4,0),h(70860,1,3,71279),t(71363,3,4,0),t(71531,5,3,0),
  t(71698,6,4,0),t(72034,5,4,0),t(72201,5,3,0),t(72369,5,5,0),
  t(72537,5,5,0),t(72704,3,4,0),t(73039,1,4,0),t(73207,2,5,0),
  t(73542,1,4,0),t(73878,0,4,0),t(74045,0,5,0),t(74213,3,4,0),
  t(74548,1,4,0),t(74716,6,4,0),t(74716,0,3,0),t(74883,3,4,0),
  f(74967,1,4),t(75302,0,4,0),t(75638,0,4,0),t(75721,1,4,0),
  t(75805,2,4,0),t(75889,0,5,0),t(76224,0,4,0),t(76392,0,5,0),
  t(76560,1,3,0),t(76727,1,4,0),t(76895,0,5,0),t(77230,0,4,0),
  t(77398,0,4,0),t(77565,0,5,0),t(77733,1,4,0),t(77901,2,5,0),
  t(78236,5,4,0),t(78571,6,4,0),t(78906,2,5,0),t(79242,5,4,0),
  t(79409,6,4,0),t(79577,5,4,0),t(79912,1,4,0),t(79996,5,4,0),
  f(80247,3,4),t(80583,6,4,0),t(80750,5,4,0),t(80918,3,4,0),
  t(81253,1,4,0),t(81588,0,4,0),t(81924,0,4,0),t(82259,0,3,0),
  t(82426,0,3,0),t(82594,0,4,0),t(82762,1,4,0),t(82929,0,5,0),
  t(83097,1,4,0),t(83265,0,4,0),t(83432,1,3,0),t(83516,2,8,0),
  t(83600,3,3,0),t(83767,6,4,0),t(83767,0,3,0),t(83935,1,4,0),
  t(84438,3,4,0),t(85108,5,4,0),t(85444,6,4,0),t(86282,3,4,0),
  t(86617,6,4,0),f(86701,3,4),
// </crossing-field-v3-expert-notes>
])(mhTap,mhHoldV2,mhFlick,mhSlideV2);
const crossingFieldMasterNotes=((t,h,f,s)=>[
// <crossing-field-v3-master-notes>
  h(2134,2,2,2469,1),t(2804,2,6,0),f(3475,5,4),t(3810,4,2,0),
  t(4145,1,4,0),t(4816,3,3,0),t(4983,5,4,0),t(5151,7,3,0),
  t(5486,6,2,0),t(6157,3,3,0),t(6324,1,3,0),t(6492,0,3,0),
  t(6827,1,3,0),t(6911,5,3,0),t(7162,3,3,0),t(7330,8,2,0),
  t(7833,0,2,0),t(7833,4,2,0),t(8168,4,2,0),t(8168,8,2,0),
  t(8503,0,2,0),t(8503,4,2,0),t(8839,4,2,0),t(8839,8,2,0),
  t(9174,3,3,0),t(9509,5,4,0),t(9844,3,3,0),t(10347,1,3,0),
  t(10515,0,2,0),t(10683,1,3,0),t(10850,3,3,0),h(11521,7,1,12191,1,[[11521,7,1],[11856,6,3],[12191,5,4]]),
  f(11856,3,3),t(12527,0,2,0),t(12527,4,2,0),t(12862,1,2,0),
  t(12862,5,2,0),t(13197,3,2,0),t(13197,7,2,0),t(13532,4,2,0),
  t(13532,8,2,0),t(13868,7,3,0),h(14203,3,3,14789),t(14873,5,3,0),
  t(15209,2,2,0),t(15209,6,2,0),t(15544,2,2,0),t(15544,7,2,0),
  t(15879,1,2,0),t(15879,8,2,0),t(16214,0,2,0),t(16214,8,2,0),
  t(16885,1,4,0),t(16885,7,3,0),t(17220,0,2,0),t(17220,4,2,0),
  h(17388,2,4,18729),t(17723,0,3,0),t(17891,2,2,0),t(18896,5,3,0),
  t(19064,3,3,0),t(19232,5,4,0),t(19399,5,3,0),f(19567,5,3),
  t(19902,5,4,1),h(20237,6,4,20656),h(20908,5,3,21411),t(21578,3,4,0),
  t(21914,1,3,0),t(22249,0,4,0),t(22584,1,3,0),t(22919,0,3,0),
  t(23087,1,3,0),t(23255,0,3,0),t(23590,5,3,0),t(23925,1,4,0),
  t(24260,7,3,0),t(24596,5,3,0),t(24931,3,3,0),t(25266,1,4,0),
  t(25601,3,3,0),t(25769,1,4,0),t(25937,3,4,0),t(26104,5,4,0),
  t(26272,7,3,0),t(26607,5,4,0),f(26942,5,4),t(27278,6,4,0),
  t(27445,7,3,0),t(27613,1,4,0),t(27613,7,3,0),t(27780,5,3,0),
  t(27948,6,4,0),t(28283,5,3,0),t(28451,3,3,0),t(28619,5,3,0),
  t(28786,3,3,0),t(29121,1,3,0),t(29289,0,6,0),t(29624,1,3,0),
  t(29792,3,3,0),t(29960,5,4,0),t(30462,5,3,0),t(30630,6,4,0),
  t(30965,5,3,0),t(31133,7,3,0),t(31468,6,4,0),t(31803,7,3,0),
  t(31971,8,2,0),t(32306,7,3,0),t(32474,5,4,0),t(32642,7,3,0),
  f(32977,5,3),t(33815,6,4,0),h(33983,5,4,34653,1,[[33983,5,4],[34318,6,3],[34653,7,1]]),s(33983,35072,[[33983,1.5,2],[35072,0.5,2]]),
  t(34988,3,2,0),t(35156,0,3,0),t(35324,2,2,0),t(35659,3,4,2),
  t(36497,1,3,0),t(36665,3,4,0),t(37000,5,3,0),t(37335,8,2,0),
  t(37503,5,4,0),t(37670,3,3,0),t(37838,1,3,0),t(38006,0,4,0),
  t(38341,0,4,0),t(38341,6,3,0),t(38676,1,3,0),t(38844,0,4,0),
  t(39011,1,3,0),t(39682,3,3,0),f(40017,1,3),t(40352,0,4,0),
  t(40436,2,2,0),t(40688,3,4,0),t(40855,0,2,0),t(41023,2,4,0),
  t(41107,7,3,0),t(41191,6,2,0),t(41358,7,3,0),t(41526,5,4,0),
  t(41610,8,2,0),t(41693,3,3,0),t(41861,6,2,0),t(42029,7,3,0),
  t(42196,5,3,0),t(42364,3,3,0),t(42615,5,4,0),t(42699,3,3,0),
  t(43034,1,4,0),t(43034,7,3,0),t(43286,0,3,0),t(43537,1,4,0),
  t(43705,3,4,0),t(44208,5,4,0),t(44543,7,3,0),h(44711,6,1,45297,0,[[44711,6,1],[45046,5,4],[45297,6,1]]),
  t(45381,3,4,0),t(45549,1,3,0),h(45716,0,4,46135),t(46303,3,4,0),
  f(46387,7,3),t(46722,3,3,0),t(46806,0,3,0),t(47057,0,3,0),
  t(47393,1,4,0),t(47476,0,2,0),t(47728,1,3,0),t(48063,3,3,0),
  t(48147,1,3,0),t(48398,3,4,0),t(48566,2,2,0),t(48734,5,3,0),
  t(48901,3,3,0),t(49069,1,3,0),t(49404,0,3,0),t(49739,0,3,0),
  t(50075,0,6,0),t(50242,0,2,0),t(50410,1,3,0),t(50745,0,3,0),
  t(50913,3,3,0),t(51080,1,3,0),t(51416,5,3,3),f(51751,7,3),
  t(52086,5,3,0),t(52254,7,3,0),t(52421,5,4,0),t(52589,3,3,0),
  t(52757,1,3,0),t(52924,4,2,0),t(53092,1,4,0),t(53176,0,3,0),
  t(53427,3,3,0),t(53595,0,4,0),t(53762,3,4,0),t(53846,8,2,0),
  t(54098,7,3,0),t(54433,7,3,0),t(54768,7,3,0),t(54936,5,3,0),
  t(55103,7,3,0),t(55271,5,3,0),t(55439,8,2,0),t(55606,5,3,0),
  t(55690,7,3,0),t(55942,5,3,0),t(56025,7,3,0),t(56109,4,2,0),
  t(56361,6,2,0),t(56444,3,3,0),t(56612,1,3,0),t(56780,0,3,0),
  t(56780,5,3,0),t(56947,2,2,0),f(57115,0,3),h(57450,1,3,57869),
  t(58121,3,4,0),t(58456,1,3,0),t(58791,3,3,0),t(58875,1,3,0),
  t(59126,0,3,0),t(59210,1,4,0),t(59462,0,4,0),t(59629,2,3,0),
  t(59713,0,4,0),t(59797,3,3,0),t(59965,1,3,0),t(60132,0,3,0),
  t(60216,1,3,0),t(60384,3,3,0),t(60467,5,3,0),s(60803,61725,[[60803,2,3],[60887,1.5,3],[61054,2.5,2],[61222,2.5,2],[61389,1.5,2],[61557,0.5,2],[61725,0.5,2]]),
  t(61138,1,3,0),t(61808,5,3,0),t(61976,4,1,0),t(62144,5,4,0),
  t(62479,6,4,0),t(62647,5,3,0),t(62814,3,4,0),t(62982,2,2,0),
  t(63149,0,4,0),t(63317,1,3,0),t(63485,0,4,0),t(63652,2,2,0),
  t(63652,6,2,0),t(63820,3,4,0),t(64155,1,4,0),t(64323,0,4,0),
  t(64491,1,4,0),t(64826,0,3,0),t(64993,3,3,0),t(65161,6,4,0),
  t(65329,3,3,0),t(65496,3,4,0),t(65832,5,3,0),t(65999,7,3,0),
  t(66083,5,3,0),t(66167,4,3,0),f(66334,3,3),t(66670,5,3,0),
  t(66837,8,2,0),t(67005,5,3,0),t(67173,4,6,0),t(67424,5,3,0),
  t(67508,7,3,0),h(67592,3,3,68346),t(68011,7,3,0),t(68514,3,3,0),
  t(68597,7,3,0),h(68849,5,4,69268),t(69352,3,4,0),t(69519,1,4,0),
  t(69687,0,3,0),t(70022,1,3,0),t(70190,0,2,0),t(70190,4,2,0),
  t(70357,1,3,0),t(70441,0,3,0),h(70693,0,4,71279,0,[[70693,0,4],[71028,1,1],[71279,0,4]]),t(71363,1,3,0),
  t(71531,4,2,0),f(71698,1,3),t(72034,5,3,0),t(72201,4,2,0),
  t(72369,1,4,0),t(72537,0,4,0),t(72704,1,3,0),t(73039,0,3,0),
  t(73207,1,4,0),t(73542,0,3,0),t(73710,0,3,0),t(73878,0,3,0),
  t(74045,1,4,0),t(74213,1,3,0),t(74548,3,3,0),t(74716,5,3,0),
  t(74883,3,3,0),f(74967,5,3),t(75302,5,3,0),t(75470,8,2,0),
  t(75638,5,3,0),t(75721,7,3,0),t(75805,5,3,0),t(75889,6,4,0),
  t(76057,6,2,0),t(76224,7,3,0),t(76392,5,4,0),t(76560,6,2,0),
  t(76727,7,3,0),t(76895,6,4,0),t(76895,1,3,0),t(77062,5,4,0),
  t(77230,3,3,0),t(77398,5,3,0),t(77565,3,4,0),t(77733,1,3,0),
  t(77901,5,4,0),t(78152,3,4,0),t(78236,7,3,0),t(78571,7,3,4),
  t(78906,5,4,0),t(79242,7,3,0),t(79409,5,3,0),t(79577,3,3,0),
  t(79744,5,3,0),t(79912,3,3,0),t(79996,5,3,0),t(80247,5,3,0),
  t(80499,7,3,0),t(80583,5,3,0),t(80750,7,3,0),f(80918,3,3),
  t(81253,5,3,0),t(81588,7,3,0),t(81756,5,3,0),t(81924,7,3,0),
  t(82259,6,2,0),t(82426,4,2,0),t(82594,1,3,0),t(82762,3,3,0),
  t(82929,5,4,0),t(83097,2,3,0),t(83097,7,3,0),t(83265,1,3,0),
  t(83432,0,2,0),t(83516,0,6,0),t(83600,0,2,0),t(83684,2,2,0),
  t(83767,0,3,0),t(83935,1,3,0),t(84438,0,3,0),t(85108,1,3,0),
  t(85444,0,3,0),t(86114,3,3,0),t(86282,1,3,0),t(86617,5,3,0),
  f(86701,3,3),
// </crossing-field-v3-master-notes>
])(mhTap,mhHoldV2,mhFlick,mhSlideV2);

// Nothing Without You（3分09秒）。譜面はV3パイプラインが入れる。
// ユーザーからmp4で受け取った曲。映像を落として音源だけを取り出し、
// ほかのBGMと同じ 32kHz/96kbps・-14 LUFS へそろえたmp3にしてある(2.17MB)。全尺で遊ぶ。
// テンポは自動判定の 194.005BPM/4拍子。97BPM(半分)も試したが格子への乗りが67%と低く、
// 194BPMなら±43msで100%・拍に音が乗る率も94%(偶奇ほぼ均等)なので、そちらを正とした。
const NOTHING_WITHOUT_YOU_DURATION_MS=189504;
const nothingWithoutYouEasyNotes=((t,h,f,s)=>[
// <nothing-without-you-v3-easy-notes>
  t(2557,0,10,0),t(4104,4,6,0),t(5341,4,6,0),t(6578,2,6,0),
  t(7506,0,6,0),t(9671,2,6,0),t(10289,4,6,0),t(10598,4,6,0),
  t(11526,2,6,0),t(11835,4,6,0),t(12145,4,6,0),t(12454,4,6,0),
  t(13072,2,6,0),t(14000,2,6,0),t(14619,4,6,0),t(14928,2,6,0),
  t(15547,0,6,0),t(16474,4,6,0),t(17093,4,6,0),t(17402,2,6,0),
  t(18021,0,6,0),t(18639,0,6,0),t(18949,0,6,0),t(19567,2,6,0),
  t(21114,4,6,0),t(21732,4,6,0),t(22969,2,6,0),t(23588,4,6,0),
  t(24206,4,6,0),t(25443,4,6,0),t(26062,2,6,0),t(26680,0,6,0),
  t(27608,0,6,0),t(28536,0,6,0),h(29155,0,6,29541),t(29773,0,6,0),
  h(30082,0,6,30469),t(31010,2,6,0),t(32247,2,6,0),t(32866,4,6,0),
  t(33484,2,6,0),t(35031,4,6,0),h(35340,6,3,36113,0,[[35340,6,3],[35572,5,4],[35881,5,4],[36113,4,6]]),h(36577,4,6,37814),
  t(38433,4,6,0),t(39979,2,6,1),t(40288,4,6,0),t(40907,4,6,0),
  t(41835,4,6,0),t(42144,0,10,0),t(42453,4,6,0),t(43381,2,6,0),
  t(44000,4,6,0),t(44618,2,6,0),t(44927,0,6,0),t(45855,2,6,0),
  t(46474,0,6,0),t(47092,2,6,0),t(47402,4,6,0),t(48329,0,6,0),
  t(48948,2,6,0),t(49257,4,6,0),t(49566,4,6,0),t(50494,4,6,0),
  t(51422,2,6,0),t(51731,4,6,0),t(52041,4,6,0),t(52350,4,6,0),
  t(53278,4,6,0),t(54206,4,6,0),t(54824,4,6,0),t(55752,4,6,0),
  t(56680,4,6,0),t(56989,4,6,0),t(57298,4,6,0),t(58226,2,6,0),
  t(58535,4,6,0),t(58845,4,6,0),t(59772,4,6,0),t(60082,2,6,0),
  h(60700,0,6,61087),h(61628,0,6,62169,0,[[61628,0,6],[61937,1,4],[62169,2,3]]),t(62556,2,6,0),t(63174,0,6,0),
  t(63793,0,6,0),t(64721,0,6,0),t(65030,2,6,0),t(65649,0,6,0),
  t(66576,0,6,0),t(66886,0,6,0),t(68123,0,6,0),t(69051,2,6,0),
  t(69669,0,6,0),t(69978,2,6,0),t(70597,4,6,0),t(71525,4,6,0),
  t(71834,4,6,0),t(72143,0,10,0),t(73071,4,6,0),t(74617,0,6,0),
  t(74927,0,6,0),t(75545,0,6,0),t(76164,0,6,0),t(76473,0,6,2),
  t(77092,0,6,0),t(77401,0,6,0),t(78019,0,6,0),t(78638,0,6,0),
  t(78947,0,6,0),t(79257,0,6,0),t(79566,0,6,0),t(80803,2,6,0),
  t(81421,4,6,0),t(82040,2,6,0),t(82349,0,6,0),t(82968,2,6,0),
  t(83586,4,6,0),t(84514,2,6,0),t(84823,0,6,0),t(85133,0,6,0),
  t(85442,0,6,0),t(86060,2,6,0),t(86988,0,6,0),t(87298,2,6,0),
  t(87916,4,6,0),t(88535,4,6,0),t(89462,0,6,0),t(89772,0,6,0),
  t(90081,2,6,0),t(90390,4,6,0),t(91009,4,6,0),t(91318,4,6,0),
  t(91937,2,6,0),t(92246,0,6,0),t(92555,2,6,0),t(92864,0,6,0),
  t(93483,0,6,0),t(94411,0,6,0),t(94720,0,6,0),t(95029,2,6,0),
  t(95339,0,6,0),t(95957,0,6,0),t(96885,4,6,0),t(97194,4,6,0),
  t(97813,2,6,0),t(98431,0,10,0),h(98741,0,6,99282),t(99359,0,6,0),
  t(99668,2,6,0),t(100287,4,6,0),t(100906,2,6,0),t(101215,4,6,0),
  t(101833,2,6,0),t(102143,0,6,0),t(102452,2,6,0),t(102761,4,6,0),
  t(104926,4,6,0),t(105235,4,6,0),h(107246,4,6,108173),t(108328,2,6,0),
  t(109565,0,6,0),t(110184,0,6,0),h(112349,0,6,113199),t(114204,0,6,3),
  t(115751,2,6,0),h(117606,6,3,118611,0,[[117606,6,3],[117915,5,4],[118302,5,4],[118611,6,3]]),h(120080,2,6,120931),t(122245,0,6,0),
  t(122554,0,6,0),t(123482,4,6,0),t(123792,2,6,0),t(124410,0,6,0),
  t(125029,0,6,0),t(125647,0,6,0),t(125956,2,6,0),t(126266,4,6,0),
  t(127503,0,6,0),t(128121,2,6,0),t(128431,4,6,0),t(129049,4,6,0),
  t(129977,2,6,0),t(130596,4,6,0),t(131214,4,6,0),t(131523,4,6,0),
  t(132142,2,6,0),t(133379,0,6,0),t(133688,0,6,0),t(133998,0,6,0),
  t(135544,2,6,0),t(135853,0,6,0),t(136162,0,6,0),t(136472,0,6,0),
  t(137400,0,6,0),t(138018,0,10,0),t(138327,2,6,0),t(138637,4,6,0),
  t(138946,4,6,0),h(139255,4,6,139796),t(139874,2,6,0),t(140492,0,6,0),
  t(141420,2,6,0),t(142039,0,6,0),t(142348,2,6,0),t(142966,4,6,0),
  h(143894,4,6,144513),t(144822,4,6,0),t(146059,2,6,0),t(146368,4,6,0),
  t(147296,4,6,0),t(147915,4,6,0),t(148224,2,6,0),t(148843,0,6,0),
  t(149152,0,6,0),t(149770,0,6,0),t(150389,2,6,0),t(150698,4,6,4),
  t(151007,2,6,0),h(151317,4,6,152013,0,[[151317,4,6],[151703,6,3],[152013,4,6]]),t(152245,4,6,0),t(152863,4,6,0),
  t(153172,2,6,0),t(153791,0,6,0),t(154100,2,6,0),t(154409,4,6,0),
  t(155337,0,6,0),t(155647,2,6,0),t(156265,4,6,0),t(156574,4,6,0),
  t(157811,0,6,0),t(158121,0,6,0),t(158739,2,6,0),t(159048,4,6,0),
  t(159667,4,6,0),t(159976,4,6,0),t(160595,2,6,0),t(160904,0,6,0),
  t(161213,0,6,0),t(161832,0,6,0),t(162760,4,6,0),t(163069,2,6,0),
  t(163378,0,6,0),t(163533,0,10,0),t(163997,4,6,0),t(164615,2,6,0),
  t(164925,0,3,0),t(164925,7,3,0),t(165234,0,6,0),t(165852,0,6,0),
  t(166162,0,6,0),t(166471,2,6,0),t(167090,0,6,0),t(167708,0,6,0),
  t(168636,2,6,0),t(168945,0,6,0),t(169254,0,6,0),t(169564,0,6,0),
  t(170182,2,6,0),t(171110,4,6,0),t(171419,4,6,0),t(171729,4,6,0),
  t(172038,4,6,0),t(172347,4,6,0),t(172656,4,6,0),t(172966,4,6,0),
  t(173584,4,6,0),t(173894,4,6,0),t(174512,2,6,0),t(174821,0,6,0),
  t(175131,0,6,0),t(176058,0,6,0),t(176368,0,6,0),t(176677,0,6,0),
  t(176986,0,6,0),t(177295,2,6,0),t(177605,2,6,0),t(178533,4,6,0),
  t(179151,2,6,0),t(179460,0,6,0),t(180079,0,6,0),t(180388,0,6,0),
  t(181007,2,6,0),t(181625,4,6,0),t(182553,2,6,0),t(182862,4,6,0),
  t(183481,2,6,0),t(183790,4,6,0),t(184099,4,6,0),h(184409,4,6,185259),
  h(185955,6,3,186806,0,[[185955,6,3],[186264,4,6],[186496,5,4],[186806,6,3]]),t(187501,4,6,0),t(187811,0,10,0),
// </nothing-without-you-v3-easy-notes>
])(mhTap,mhHoldV2,mhFlick,mhSlideV2);
const nothingWithoutYouNormalNotes=((t,h,f,s)=>[
// <nothing-without-you-v3-normal-notes>
  t(2557,0,10,0),f(4104,0,6),t(5341,0,6,0),t(6578,2,6,0),
  t(7196,4,6,0),t(7506,4,6,0),t(9671,2,6,0),t(9980,4,6,0),
  t(10289,4,6,0),t(10598,4,6,0),t(11526,2,6,0),t(11835,4,6,0),
  t(12145,2,6,0),t(12454,0,6,0),t(13072,2,6,0),t(14000,4,6,0),
  t(14619,4,6,0),t(14928,2,6,0),t(15237,0,6,0),t(15547,0,6,0),
  t(16474,4,6,0),t(17093,4,6,0),t(17402,2,6,0),t(18021,0,6,0),
  f(18639,0,6),t(18949,0,6,0),t(19567,2,6,0),t(20804,7,3,0),
  t(20804,0,3,0),t(21114,4,6,0),t(22351,2,6,0),t(22969,4,6,0),
  t(23588,2,6,0),t(24206,4,6,0),t(24825,2,6,0),t(25443,4,6,0),
  t(26062,2,6,0),t(26680,4,6,0),t(27608,4,6,0),t(28536,2,6,0),
  h(29155,4,6,29541),t(29773,2,6,0),h(30082,4,6,30469,1),t(31010,0,6,0),
  t(31629,4,6,0),t(32247,2,6,0),t(32866,4,6,0),f(33484,4,6),
  t(34721,2,6,0),t(35031,4,6,0),h(35340,4,2,36113,0,[[35340,4,2],[35572,4,3],[35881,3,4],[36113,2,6]]),t(37196,0,6,0),
  t(37505,0,6,0),t(38433,0,6,0),t(39051,2,6,0),t(39979,0,6,1),
  t(40288,2,6,0),t(40907,4,6,0),t(41525,0,10,0),t(41835,4,6,0),
  t(42453,2,6,0),t(43381,0,6,0),t(44000,0,6,0),t(44309,2,6,0),
  t(44618,4,6,0),t(44927,4,6,0),t(45855,0,6,0),t(46474,0,6,0),
  t(46783,2,6,0),f(47092,4,6),t(47402,4,6,0),t(48329,2,6,0),
  t(48948,4,6,0),t(49257,2,6,0),t(49566,0,6,0),t(50494,0,6,0),
  t(50804,0,6,0),t(51422,2,6,0),t(51731,4,6,0),t(52041,2,6,0),
  t(52350,0,6,0),t(53278,2,6,0),t(54206,4,6,0),t(54515,2,6,0),
  t(54824,0,6,0),t(55752,0,6,0),t(56370,0,6,0),t(56680,2,6,0),
  t(56989,4,6,0),t(57298,4,6,0),t(58226,2,6,0),t(58535,4,6,0),
  f(58845,4,6),t(59772,2,6,0),t(60082,4,6,0),h(60700,4,6,61087),
  h(61628,4,6,62169),t(62556,2,6,0),t(62865,4,6,0),h(63174,4,6,63561),
  t(63793,4,6,0),t(64721,4,6,0),t(65030,4,6,0),t(65649,2,6,0),
  t(66576,0,6,0),t(66886,0,6,0),t(67504,0,6,0),t(68123,0,6,0),
  t(69051,0,6,0),t(69669,2,6,0),t(69978,0,6,0),t(70597,2,6,0),
  t(71215,0,6,0),t(71525,0,10,0),f(71834,0,6),t(72143,2,6,0),
  t(73071,4,6,0),t(74308,4,6,0),t(74617,4,6,0),t(74927,4,6,0),
  t(75545,4,6,0),t(76164,4,6,0),t(76473,4,6,2),t(77092,4,6,0),
  t(77401,4,6,0),t(78019,2,6,0),t(78638,2,6,0),t(78947,4,6,0),
  t(79257,4,6,0),t(79566,4,6,0),t(80803,2,6,0),t(81112,0,6,0),
  t(81421,0,6,0),t(82040,0,6,0),t(82349,0,6,0),f(82968,2,6),
  t(83432,0,6,0),t(83586,4,6,0),t(84514,2,6,0),t(84823,0,6,0),
  t(85133,2,6,0),t(85442,4,6,0),t(86060,2,6,0),t(86988,0,6,0),
  t(87298,0,6,0),t(87607,0,6,0),t(87916,0,6,0),t(88535,0,6,0),
  t(89153,0,6,0),t(89462,0,6,0),t(89772,0,6,0),t(90081,0,6,0),
  t(90390,0,6,0),t(91009,0,6,0),t(91318,0,6,0),t(91937,0,6,0),
  t(92246,0,6,0),t(92555,0,6,0),f(92864,0,6),t(93483,0,6,0),
  t(94411,0,6,0),t(94720,2,6,0),t(95029,4,6,0),t(95339,4,6,0),
  t(95648,4,6,0),t(95957,2,6,0),t(96885,4,6,0),t(97194,4,6,0),
  t(97813,4,6,0),t(98431,0,10,0),h(98741,2,6,99282,0,[[98741,2,6],[99050,3,4],[99282,4,2]]),t(99359,0,6,0),
  t(99668,2,6,0),t(99978,4,6,0),t(100287,4,6,0),t(100751,4,6,0),
  t(100906,4,6,0),t(101215,4,6,0),t(101833,4,6,0),t(102143,4,6,0),
  f(102452,4,6),h(102761,4,6,103070),t(104307,2,6,0),t(104926,4,6,0),
  t(105235,4,6,0),h(107246,4,6,108173),t(108328,2,6,0),t(109565,0,6,0),
  t(110184,4,6,0),h(112349,4,6,113199),t(114204,4,6,3),t(115751,4,6,0),
  t(116678,2,6,0),h(117606,2,2,118611,1,[[117606,2,2],[117915,1,4],[118302,1,4],[118611,2,2]]),t(119153,2,6,0),h(120080,4,6,120931),
  t(121627,4,6,0),t(122245,4,6,0),t(122554,2,6,0),t(123482,0,6,0),
  t(123792,0,6,0),t(124101,0,6,0),f(124410,0,6),t(125029,0,6,0),
  t(125647,0,6,0),t(126266,0,6,0),t(126575,0,6,0),t(127503,4,6,0),
  t(128121,4,6,0),t(128431,2,6,0),t(128740,0,6,0),t(129049,0,6,0),
  t(129977,0,6,0),t(130596,0,6,0),t(131214,2,6,0),t(131523,0,6,0),
  t(132451,4,6,0),t(133070,4,6,0),t(133379,2,6,0),t(133688,0,6,0),
  t(133998,0,6,0),t(135544,2,6,0),t(135853,0,6,0),t(136162,0,6,0),
  f(136472,0,6),t(137400,0,10,0),t(138018,2,6,0),t(138327,0,6,0),
  t(138482,4,6,0),t(138637,2,6,0),t(138946,4,6,0),h(139255,4,6,139796),
  t(139874,4,6,0),t(140492,2,6,0),t(141420,0,6,0),t(141729,0,6,0),
  t(142039,2,6,0),t(142348,4,6,0),t(142966,4,6,0),h(143894,4,6,144513,0,[[143894,4,6],[144203,6,2],[144513,4,6]]),
  t(144822,4,6,0),t(145750,4,6,0),t(146059,4,6,0),t(146368,4,6,0),
  t(147296,0,6,0),t(147915,0,6,0),f(148224,0,6),t(148843,0,6,0),
  t(149152,0,6,0),t(149770,0,6,0),t(150389,0,6,0),t(150698,0,6,4),
  t(151007,2,6,0),h(151317,4,6,152013),t(152245,0,6,0),t(152863,0,6,0),
  t(153172,2,6,0),t(153791,4,6,0),t(154100,4,6,0),t(154409,4,6,0),
  t(154719,2,6,0),t(155337,0,6,0),t(155647,2,6,0),t(156265,0,6,0),
  t(156574,2,6,0),t(156884,4,6,0),t(157811,0,6,0),t(158121,2,6,0),
  t(158739,4,6,0),f(159048,4,6),t(159667,4,6,0),t(159976,2,6,0),
  t(160595,0,6,0),t(160904,0,6,0),t(161213,0,6,0),t(161523,0,6,0),
  t(161832,2,6,0),h(162141,1,4,162605),t(162760,0,6,0),t(163069,0,6,0),
  t(163378,0,10,0),t(163533,0,6,0),t(163688,0,3,0),t(163688,7,3,0),
  t(164615,4,6,0),t(164925,7,3,0),t(164925,0,3,0),t(165234,2,6,0),
  t(165543,0,3,0),t(165543,7,3,0),t(165852,0,6,0),t(166162,0,6,0),
  t(166471,2,6,0),t(167090,4,6,0),f(167399,2,6),t(167708,4,6,0),
  t(168636,4,6,0),t(168945,4,6,0),t(169254,2,6,0),t(169564,4,6,0),
  t(170182,0,6,0),t(170492,2,6,0),t(171110,4,6,0),t(171419,4,6,0),
  t(171729,2,6,0),t(172038,4,6,0),t(172347,4,6,0),t(172656,4,6,0),
  t(172966,2,6,0),t(173584,4,6,0),t(173894,2,6,0),t(174203,0,6,0),
  t(174512,0,6,0),t(174821,0,6,0),t(175131,0,6,0),t(175595,1,4,0),
  f(176058,0,6),t(176677,0,6,0),t(176986,0,6,0),t(177295,0,6,0),
  t(177450,0,6,0),t(177605,4,6,0),t(178533,2,6,0),t(179151,4,6,0),
  t(179460,4,6,0),t(179924,4,6,0),t(180079,0,6,0),t(180388,2,6,0),
  t(181007,4,6,0),t(181625,4,6,0),t(182553,4,6,0),t(182862,2,6,0),
  t(183172,0,6,0),t(183481,0,6,0),t(183790,0,6,0),t(184099,2,6,0),
  h(184409,4,6,185259),h(185955,6,2,186806,1,[[185955,6,2],[186264,6,3],[186496,5,4],[186806,4,6]]),f(187501,2,6),t(187811,0,10,0),
// </nothing-without-you-v3-normal-notes>
])(mhTap,mhHoldV2,mhFlick,mhSlideV2);
const nothingWithoutYouHardNotes=((t,h,f,s)=>[
// <nothing-without-you-v3-hard-notes>
  t(2557,0,8,0),f(3176,4,5),t(4104,5,5,0),t(5341,4,5,0),
  t(5650,5,5,0),t(6578,2,5,0),t(7196,4,5,0),t(7506,5,5,0),
  t(9052,0,5,0),t(9671,2,5,0),t(9980,4,5,0),t(10289,5,5,0),
  t(10598,4,5,0),t(10753,2,5,0),t(11217,2,5,0),t(11526,4,5,0),
  t(11835,2,5,0),t(12145,0,5,0),t(12454,2,5,0),t(13072,4,5,0),
  t(13691,2,5,0),t(14000,4,5,0),t(14310,2,5,0),t(14619,4,5,0),
  f(14928,5,5),t(15237,4,5,0),t(15547,0,5,0),t(15856,2,5,0),
  t(16474,0,5,0),t(16784,4,5,0),t(17093,2,5,0),t(17402,5,5,0),
  t(17712,5,5,0),t(18021,2,5,0),t(18639,4,5,0),t(18949,0,5,0),
  t(19258,2,5,0),t(19567,0,5,0),t(20804,0,3,0),t(21114,0,5,0),
  t(21732,0,5,0),t(22351,0,5,0),t(22660,0,5,0),t(22969,0,5,0),
  t(23588,0,5,0),t(24206,0,5,0),t(24825,2,5,0),f(25134,2,5),
  t(25443,4,5,0),t(26062,4,5,0),t(26680,5,5,0),t(27608,2,5,0),
  h(27918,7,1,28613,1,[[27918,7,1],[28304,6,3],[28613,5,5]]),h(29155,4,5,29541),t(29773,2,5,0),h(30082,4,5,30469),
  t(31010,2,5,0),t(31629,4,5,0),t(32247,2,5,0),t(32557,4,5,0),
  t(32866,2,5,0),t(33484,4,5,0),t(34103,2,5,0),t(34721,4,5,0),
  t(35031,2,8,0),s(35340,36113,[[35340,3,4],[35417,3,4],[35495,3.5,4],[35572,3.5,3],[35649,3.5,3],[35727,3.5,3],[35804,3,3],[35881,4,3],[35959,4,2],[36036,4,2],[36113,4,2]]),s(36577,37814,[[36577,3,4],[37041,3,3],[37273,1.5,3],[37428,1.5,3],[37660,2.5,2],[37814,3.5,2]]),t(38433,2,5,0),
  t(39051,5,5,1),f(39979,2,5),t(40288,4,5,0),t(40598,2,5,0),
  t(40907,0,5,0),t(41371,1,3,0),t(41371,7,3,0),t(41525,4,5,0),
  t(41835,2,5,0),t(42144,4,5,0),t(42453,2,5,0),t(43381,0,5,0),
  h(43845,0,5,44232),t(44309,0,5,0),t(44618,0,5,0),t(44927,2,5,0),
  t(45237,0,5,0),t(45855,5,5,0),t(46165,4,5,0),t(46474,2,5,0),
  t(46783,0,5,0),t(47092,0,5,0),t(47402,0,5,0),t(47711,2,5,0),
  f(48329,0,5),t(48639,2,5,0),t(48948,0,5,0),t(49257,0,5,0),
  t(49566,0,5,0),t(49876,0,5,0),t(50494,0,5,0),t(50804,2,5,0),
  t(51422,4,5,0),t(51731,2,5,0),t(52041,0,5,0),t(52350,2,5,0),
  t(52659,4,5,0),t(53278,2,5,0),t(53896,0,5,0),t(54206,2,5,0),
  t(54515,4,5,0),t(54824,2,5,0),t(55133,4,5,0),t(55752,2,5,0),
  t(56216,4,5,0),t(56370,5,5,0),f(56680,4,5),t(56989,2,5,0),
  t(57298,4,5,0),t(58226,2,5,0),t(58381,5,4,0),t(58535,5,5,0),
  t(58690,4,5,0),t(58845,2,5,0),t(59772,0,5,0),t(60082,2,5,0),
  h(60700,0,5,61087),t(61319,0,5,0),h(61628,0,5,62169,1),t(62556,0,5,0),
  t(62865,2,5,0),h(63174,0,5,63561),t(63793,1,8,0),t(64102,0,5,0),
  t(64721,2,5,0),t(65030,0,5,0),t(65649,2,5,0),t(66267,4,5,0),
  t(66576,5,5,0),f(66886,4,5),t(67195,5,5,0),t(67504,4,5,0),
  t(68123,5,5,0),t(68432,4,5,0),t(69051,5,5,0),t(69669,0,5,0),
  t(69978,0,5,0),t(70288,2,5,0),h(70597,4,5,70984),t(71215,5,5,0),
  t(71525,4,5,0),t(71834,2,5,0),t(72143,0,5,0),t(72762,0,5,0),
  h(73071,0,5,73458),t(73690,0,5,0),t(74308,0,5,0),h(74617,2,5,74927,1),
  t(75545,0,5,0),t(75855,0,5,0),t(76009,0,5,0),f(76164,0,5),
  t(76473,2,5,0),t(76782,2,5,2),t(77092,0,5,0),t(77401,2,5,0),
  t(78019,0,5,0),t(78329,0,5,0),t(78483,1,3,0),t(78483,7,3,0),
  t(78638,2,5,0),t(78947,0,5,0),t(79257,0,5,0),t(79566,0,5,0),
  t(80803,0,5,0),t(81112,0,5,0),t(81421,0,5,0),t(81731,0,5,0),
  t(81885,2,5,0),t(82040,0,5,0),t(82349,0,5,0),t(82968,0,5,0),
  t(83432,2,5,0),t(83586,4,5,0),f(84205,3,4),t(84514,0,5,0),
  t(84823,2,5,0),t(85133,0,5,0),t(85442,2,5,0),t(85751,0,5,0),
  t(85906,0,5,0),t(86060,0,5,0),t(86988,2,5,0),t(87298,0,5,0),
  t(87607,2,5,0),t(87916,0,5,0),t(88225,0,5,0),t(88535,0,8,0),
  t(88844,0,4,0),t(88844,7,3,0),t(89153,2,5,0),t(89308,1,4,0),
  t(89462,0,5,0),t(89772,0,5,0),t(90081,0,5,0),t(90390,0,5,0),
  t(90700,2,5,0),t(91009,4,5,0),f(91318,5,5),t(91627,4,5,0),
  t(91937,2,5,0),t(92246,4,5,0),t(92555,5,5,0),t(92864,4,5,0),
  t(93174,2,5,0),t(93483,4,5,0),s(93870,94333,[[93870,3,4],[94102,4,3],[94256,4,2],[94333,4,2]]),t(94411,2,5,0),
  t(94720,5,5,0),t(95029,2,5,0),t(95339,5,5,0),t(95648,2,5,0),
  t(95803,5,5,0),t(95957,2,5,0),t(96885,5,5,0),t(97194,4,5,0),
  t(97504,5,5,0),t(97813,4,5,0),t(98122,2,5,0),f(98431,4,5),
  h(98741,5,5,99282,0,[[98741,5,5],[99050,6,3],[99282,7,1]]),t(99359,4,5,0),t(99668,2,5,0),t(99978,0,5,0),
  t(100287,2,5,0),t(100442,4,5,0),t(100751,4,5,0),t(100906,5,5,0),
  t(101215,4,5,0),t(101524,2,5,0),t(101679,4,5,0),t(101833,5,5,0),
  t(102143,5,5,0),t(102452,5,5,0),h(102761,5,5,103070,1),t(104307,0,5,0),
  t(104926,2,5,0),t(105235,4,5,0),t(105854,5,5,0),t(107091,3,3,0),
  h(107246,7,1,108173,0,[[107246,7,1],[107555,6,4],[107864,6,4],[108173,7,1]]),t(108328,4,5,0),f(109565,2,5),t(110184,0,5,0),
  t(110802,0,5,0),h(112349,0,5,113199),t(113276,0,5,3),t(114204,0,5,0),
  h(114977,0,5,116137),t(116678,0,5,0),s(117606,118611,[[117606,1,4],[117683,1,4],[117761,1,4],[117838,0.5,4],[117915,0,3],[117993,0,3],[118070,0,3],[118147,0,3],[118225,0,3],[118302,0,3],[118379,0,2],[118457,0,2],[118534,0,2],[118611,0,2]]),t(119153,0,8,0),
  h(120080,0,5,120931,1),t(122245,0,5,0),t(122554,2,5,0),t(123018,1,3,0),
  t(123018,7,3,0),t(123173,0,5,0),t(123482,0,5,0),t(123792,2,5,0),
  t(124101,0,5,0),t(124410,2,5,0),t(124719,6,1,0),t(125029,5,5,0),
  t(125647,4,5,0),t(125956,2,5,0),f(126266,2,5),t(126575,2,5,0),
  t(126884,4,5,0),t(127503,4,5,0),t(128121,5,5,0),t(128431,5,5,0),
  t(128740,4,5,0),t(129049,4,5,0),t(129358,2,5,0),t(129977,2,5,0),
  t(130596,0,5,0),t(130905,0,5,0),t(131214,0,5,0),t(131523,0,5,0),
  t(131833,0,5,0),t(132142,2,5,0),t(132451,0,5,0),t(133070,0,5,0),
  t(133379,0,5,0),t(133688,2,5,0),t(133998,4,5,0),t(134307,5,5,0),
  f(134925,4,5),t(135544,2,5,0),t(135853,4,5,0),t(136162,2,5,0),
  t(136472,0,5,0),t(136781,0,5,0),t(137400,0,5,0),t(138018,2,5,0),
  t(138327,0,5,0),t(138482,0,5,0),t(138637,0,5,0),t(138946,0,5,0),
  s(139255,139796,[[139255,2,4],[139410,2,3],[139487,2,3],[139642,3,3],[139719,3.5,2],[139796,4,2]]),t(139874,0,5,0),t(140183,2,5,0),t(140492,5,5,0),
  t(140647,6,4,0),t(140647,0,3,0),t(141420,5,5,0),t(141729,4,5,0),
  t(142039,2,5,0),t(142348,0,5,0),t(142966,0,5,0),f(143276,0,5),
  t(143585,2,5,0),h(143894,4,5,144513,1,[[143894,4,5],[144203,6,1],[144513,4,5]]),t(144822,4,5,0),t(145441,5,5,0),
  t(145750,4,5,0),t(146059,5,5,0),t(146368,2,8,0),t(146678,5,5,0),
  t(147296,4,5,0),t(147605,5,5,0),t(147915,2,5,0),t(148224,5,5,0),
  t(148533,2,5,0),t(148843,5,5,0),t(149152,2,5,0),t(149770,5,5,0),
  t(150080,2,5,0),t(150389,5,5,0),t(150698,5,5,4),t(151007,4,5,0),
  h(151317,5,5,152013),f(152245,5,5),t(152554,5,5,0),t(152863,5,5,0),
  t(153172,5,5,0),t(153482,0,5,0),t(153791,2,5,0),t(154100,4,5,0),
  t(154409,5,5,0),t(154641,4,5,0),t(154719,5,5,0),t(155028,6,4,0),
  t(155028,0,3,0),t(155337,5,5,0),t(155647,5,5,0),t(156265,4,5,0),
  t(156574,5,5,0),t(156884,4,5,0),t(157502,1,4,0),t(157811,2,5,0),
  t(158121,4,5,0),t(158430,5,5,0),t(158739,0,5,0),t(159048,2,5,0),
  t(159512,4,5,0),f(159667,5,5),t(159976,4,5,0),t(160595,5,5,0),
  t(160904,4,5,0),t(161213,5,5,0),t(161523,4,5,0),t(161677,0,4,0),
  t(161677,7,3,0),t(161832,0,5,0),t(162064,3,5,0),h(162141,3,1,162605,0,[[162141,3,1],[162373,2,3],[162605,1,5]]),
  t(162760,0,5,0),t(163069,0,5,0),t(163378,0,5,0),t(163533,0,5,0),
  t(163688,0,4,0),t(163688,7,3,0),t(163997,2,5,0),t(164306,4,5,0),
  t(164615,5,5,0),t(164925,5,4,0),t(165234,2,5,0),t(165543,1,3,0),
  t(165852,0,5,0),f(166162,0,5),t(166471,2,5,0),t(166780,4,5,0),
  t(166935,1,3,0),t(166935,7,3,0),t(167090,2,8,0),t(167399,5,5,0),
  t(167553,4,5,0),t(167708,2,5,0),t(168327,5,4,0),t(168636,2,5,0),
  t(168945,0,5,0),t(169254,4,5,0),t(169564,2,5,0),t(170028,0,5,0),
  t(170182,0,5,0),t(170492,4,5,0),t(170801,2,5,0),t(171110,0,5,0),
  t(171419,0,5,0),t(171729,0,5,0),t(172038,0,5,0),f(172347,2,5),
  t(172656,4,5,0),t(172734,1,4,0),t(172966,4,5,0),t(173043,3,4,0),
  t(173275,5,5,0),t(173584,2,5,0),t(173894,4,5,0),t(174203,5,5,0),
  t(174512,4,5,0),t(174821,2,5,0),t(175131,4,5,0),t(175208,2,5,0),
  t(175595,0,4,0),t(175595,7,3,0),t(175749,0,5,0),t(176058,0,5,0),
  t(176368,2,5,0),t(176677,4,5,0),t(176986,5,5,0),t(177295,4,5,0),
  t(177450,2,5,0),t(177605,0,5,0),t(178069,0,5,0),t(178533,0,5,0),
  f(178842,2,5),t(179151,0,5,0),t(179460,0,5,0),t(179770,0,4,0),
  t(179770,7,3,0),t(179924,2,5,0),t(180079,4,5,0),t(180388,4,5,0),
  t(181007,5,5,0),t(181316,4,5,0),t(181625,5,5,0),t(181935,4,5,0),
  t(182244,3,3,0),t(182553,0,5,0),t(182862,0,5,0),t(183172,0,5,0),
  t(183481,0,5,0),t(183790,2,5,0),t(184099,0,5,0),h(184409,0,5,185259),
  t(185491,0,4,0),t(185491,7,3,0),h(185955,0,5,186806,0,[[185955,0,5],[186264,1,4],[186496,2,2],[186806,2,1]]),t(186883,2,5,0),
  f(187501,0,5),t(187811,0,8,0),
// </nothing-without-you-v3-hard-notes>
])(mhTap,mhHoldV2,mhFlick,mhSlideV2);
const nothingWithoutYouExpertNotes=((t,h,f,s)=>[
// <nothing-without-you-v3-expert-notes>
  t(2248,0,8,0),f(2557,2,5),t(3176,0,5,0),t(4104,0,5,0),
  t(5341,0,5,0),t(5650,4,5,0),t(6578,0,5,0),t(7196,2,5,0),
  t(7506,4,5,0),t(8124,5,5,0),t(9671,0,2,0),t(9671,4,2,0),
  t(9980,2,2,0),t(9980,6,2,0),t(10289,4,2,0),t(10289,8,2,0),
  t(10598,0,5,0),t(10753,2,5,0),t(10908,6,3,0),t(10908,0,3,0),
  t(11217,0,5,0),t(11526,2,5,0),t(11681,5,4,0),t(11835,5,5,0),
  t(12145,1,2,0),t(12145,5,2,0),t(12454,3,2,0),t(12454,7,2,0),
  t(12763,1,2,0),t(12763,5,2,0),t(13072,2,5,0),f(13691,0,5),
  t(14000,2,5,0),t(14310,4,5,0),t(14619,0,2,0),t(14619,4,2,0),
  t(14928,2,2,0),t(14928,6,2,0),t(15237,4,2,0),t(15237,8,2,0),
  t(15547,0,5,0),t(15701,4,5,0),t(15856,2,5,0),t(16474,5,5,0),
  t(16784,5,5,0),t(17093,1,2,0),t(17093,5,2,0),t(17402,3,2,0),
  t(17402,7,2,0),t(17712,1,2,0),t(17712,5,2,0),t(18021,0,5,0),
  t(18175,0,5,0),t(18639,0,5,0),t(18949,0,5,0),t(19258,2,5,0),
  t(19567,4,5,0),h(19722,7,1,20959,0,[[19722,7,1],[20031,7,2],[20340,6,3],[20650,6,4],[20959,5,5]]),t(21114,0,5,0),t(21732,0,5,0),
  f(22041,2,5),t(22351,0,2,0),t(22351,4,2,0),t(22660,2,2,0),
  t(22660,6,2,0),t(22969,4,2,0),t(22969,8,2,0),t(23588,2,5,0),
  t(24206,0,5,0),t(24516,0,5,0),t(24825,0,5,0),t(25134,0,5,0),
  t(25443,0,5,0),t(26062,0,5,0),t(26680,0,5,0),t(26990,0,5,0),
  t(27608,0,5,0),h(27918,0,5,28613),t(28845,2,5,0),h(29155,0,5,29541),
  t(29773,0,5,0),h(30082,0,5,30469,1),t(31010,2,5,0),t(31629,5,5,0),
  t(32247,2,5,0),f(32557,5,5),t(32866,2,5,0),t(33484,5,5,0),
  t(34103,2,5,0),t(34412,5,5,0),t(34721,0,5,0),t(35031,2,5,0),
  s(35340,36113,[[35340,0.5,3],[35572,1,3],[35804,1.5,3],[36036,3,3],[36113,3.5,3]]),t(35649,2,8,0),s(36577,37814,[[36577,1.5,4],[37041,1,3],[37273,0,3],[37428,0,3],[37660,0.5,2],[37814,2,2]],1),t(37196,2,5,0),
  t(37505,1,5,0),h(38123,1,5,38819),t(38433,0,5,0),t(39051,0,5,0),
  t(39670,0,5,1),t(39979,0,5,0),t(40288,2,5,0),t(40598,4,5,0),
  t(40907,5,5,0),t(41371,6,3,0),t(41371,0,3,0),t(41525,0,5,0),
  f(41835,2,5),t(42144,4,5,0),t(42453,5,5,0),t(42763,0,5,0),
  t(43381,5,5,0),h(43845,0,5,44232),t(44309,5,5,0),t(44618,2,5,0),
  t(44927,4,5,0),t(45237,2,5,0),t(45546,4,5,0),t(45855,5,5,0),
  t(46165,4,5,0),t(46474,2,5,0),t(46783,0,5,0),t(47092,0,5,0),
  t(47402,0,5,0),t(47711,2,5,0),t(48020,4,5,0),t(48329,2,5,0),
  t(48639,4,5,0),t(48948,2,5,0),t(49257,0,5,0),f(49566,0,5),
  t(49876,0,5,0),t(50185,0,5,0),t(50494,2,5,0),t(50804,4,5,0),
  t(51113,2,5,0),t(51422,4,5,0),t(51731,2,5,0),t(52041,0,5,0),
  t(52350,0,5,0),t(52659,0,5,0),t(53278,0,5,0),t(53587,0,5,0),
  t(53896,0,5,0),t(54206,0,5,0),t(54515,2,5,0),t(54824,4,5,0),
  t(55133,2,5,0),t(55752,4,5,0),t(56216,5,5,0),t(56370,4,5,0),
  t(56680,5,5,0),f(56989,4,5),t(57298,2,5,0),t(57608,0,5,0),
  t(58226,2,5,0),t(58381,6,4,0),t(58381,0,3,0),t(58535,2,5,0),
  t(58690,0,5,0),t(58845,4,5,0),t(59463,3,4,0),t(59772,0,5,0),
  t(60082,0,5,0),t(60391,0,5,0),h(60700,0,5,61087),t(61319,0,5,0),
  h(61628,0,5,62169,0,[[61628,0,5],[61937,1,3],[62169,2,1]]),t(62247,2,5,0),t(62556,4,5,0),t(62865,5,5,0),
  h(63174,4,5,63561),t(63793,2,8,0),t(64102,4,5,0),t(64412,2,5,0),
  f(64721,0,5),t(65030,2,5,0),t(65339,4,5,0),t(65649,2,5,0),
  t(66267,0,5,0),t(66576,0,5,0),t(66886,0,5,0),t(67195,2,5,0),
  t(67504,4,5,0),t(68123,2,5,0),t(68432,4,5,0),t(68741,5,5,0),
  t(69051,4,5,0),t(69669,0,5,0),t(69978,2,5,0),t(70288,4,5,0),
  h(70597,5,5,70984),t(71215,4,5,0),t(71525,2,5,0),t(71834,0,5,0),
  t(72143,0,5,0),h(72453,4,5,72994),t(73071,0,5,0),f(73690,4,5),
  t(74308,0,5,0),t(74617,0,5,0),t(74927,0,5,0),t(75236,0,5,0),
  t(75545,0,5,0),t(75855,0,5,0),t(76009,0,5,0),t(76164,0,5,0),
  t(76473,0,5,2),t(76782,2,5,0),t(77092,0,5,0),t(77401,2,5,0),
  t(78019,4,5,0),t(78097,2,5,0),t(78329,4,5,0),t(78483,7,3,0),
  t(78483,1,3,0),t(78638,4,5,0),t(78947,4,5,0),t(79257,4,5,0),
  t(79566,5,5,0),f(79875,5,5),h(80494,3,1,81035,0,[[80494,3,1],[80803,1,5],[81035,3,1]]),t(81112,2,5,0),
  t(81421,4,5,0),t(81731,5,5,0),t(81885,4,5,0),t(82040,2,5,0),
  t(82349,0,5,0),t(82968,0,5,0),t(83277,0,5,0),t(83432,0,5,0),
  t(83586,2,5,0),t(84205,0,4,0),t(84205,7,3,0),t(84360,3,4,0),
  t(84514,4,5,0),t(84823,5,5,0),t(85133,4,5,0),t(85442,2,5,0),
  t(85751,4,5,0),t(85906,2,5,0),t(86060,0,5,0),t(86679,0,5,0),
  t(86988,0,5,0),f(87298,2,5),t(87607,4,5,0),t(87916,5,5,0),
  t(88225,4,5,0),t(88535,2,5,0),t(88844,0,4,0),t(88844,7,3,0),
  t(89153,1,8,0),t(89308,1,4,0),t(89462,2,5,0),t(89617,5,4,0),
  t(89772,0,5,0),t(90081,2,5,0),t(90390,4,5,0),t(90700,5,5,0),
  t(91009,2,5,0),t(91318,4,5,0),t(91627,5,5,0),t(91937,4,5,0),
  t(92246,5,5,0),t(92555,4,5,0),t(92787,2,5,0),t(92864,0,5,0),
  t(92942,3,4,0),f(93174,4,5),t(93483,2,5,0),s(93870,94333,[[93870,1.5,4],[94102,2.5,3],[94256,3.5,2],[94333,3.5,2]]),
  t(94411,0,5,0),t(94565,0,4,0),t(94565,7,3,0),t(94720,0,5,0),
  t(95029,0,5,0),t(95339,0,5,0),t(95648,0,5,0),t(95803,0,5,0),
  t(95957,2,5,0),t(96576,0,5,0),t(96885,2,5,0),t(97194,4,5,0),
  t(97504,5,5,0),t(97813,2,5,0),t(98122,4,5,0),t(98277,5,5,0),
  t(98431,4,5,0),h(98741,5,5,99282,0,[[98741,5,5],[99050,7,1],[99282,5,5]]),t(99359,4,5,0),t(99668,2,5,0),
  f(99978,0,5),t(100287,2,5,0),t(100442,4,5,0),t(100596,3,3,0),
  t(100751,0,5,0),t(100906,0,5,0),t(101215,0,5,0),t(101524,2,5,0),
  t(101679,0,5,0),t(101833,2,5,0),t(102143,2,5,0),t(102452,4,5,0),
  h(102761,4,5,103070,1),t(103380,5,5,0),t(104307,4,5,0),t(104926,5,5,0),
  t(105235,4,5,0),t(105854,5,5,0),t(107091,5,3,0),h(107246,5,5,108173),
  t(107709,0,5,0),t(108328,2,5,0),f(108792,5,5),s(109256,110261,[[109256,2,4],[109333,2.5,4],[109410,2.5,4],[109488,2.5,4],[109565,2,3],[109642,1,3],[109720,1,3],[109797,1,3],[109874,1,3],[109952,0.5,3],[110029,0.5,2],[110106,0.5,2],[110184,1,2],[110261,1,2]],1),
  t(109565,0,5,0),t(110802,0,5,0),h(112349,0,5,113199),t(112658,4,5,0),
  t(113276,2,5,0),t(114204,4,5,3),h(114977,5,5,116137,1),t(115751,4,5,0),
  t(116678,5,5,0),s(117606,118611,[[117606,3,4],[117683,3,4],[117761,2.5,4],[117838,2,4],[117915,1,3],[117993,1,3],[118070,1.5,3],[118147,1.5,3],[118225,1.5,3],[118302,1,3],[118379,1.5,2],[118457,1,2],[118534,1,2],[118611,1,2]],1),s(117915,118611,[[117915,3,2],[118611,4,2]]),t(119153,5,5,0),
  h(120080,6,1,120931,1,[[120080,6,1],[120390,5,4],[120622,5,4],[120931,6,1]]),t(120390,8,2,0),t(121627,1,8,0),t(122245,4,5,0),
  t(122554,5,5,0),t(123018,6,3,0),t(123018,0,3,0),t(123173,4,5,0),
  t(123482,2,5,0),f(123792,0,5),t(124101,0,5,0),t(124410,0,5,0),
  t(124719,0,1,0),t(125029,0,5,0),t(125338,0,5,0),t(125647,4,5,0),
  t(125956,2,5,0),t(126266,0,5,0),t(126575,0,5,0),t(126884,2,5,0),
  t(127503,0,5,0),t(127967,0,5,0),t(128121,0,5,0),t(128431,0,5,0),
  t(128740,0,5,0),t(129049,2,5,0),t(129358,4,5,0),t(129977,2,5,0),
  t(130286,4,5,0),t(130596,2,5,0),t(130905,0,5,0),f(131214,0,5),
  t(131523,0,5,0),t(131833,2,5,0),t(132142,4,5,0),t(132451,2,5,0),
  t(133070,4,5,0),t(133379,5,5,0),t(133534,4,5,0),t(133688,5,5,0),
  t(133998,4,5,0),t(134307,2,5,0),t(134925,0,5,0),t(135544,2,5,0),
  t(135853,0,5,0),t(136008,2,5,0),t(136162,4,5,0),t(136472,5,5,0),
  t(136781,4,5,0),t(137400,2,5,0),t(137554,4,5,0),t(137709,4,1,0),
  f(138018,0,5),t(138327,0,5,0),t(138482,0,5,0),t(138637,2,5,0),
  t(138946,0,5,0),s(139255,139796,[[139255,2,4],[139410,2,3],[139487,2,3],[139642,3,3],[139719,3.5,2],[139796,4,2]]),t(139874,4,5,0),t(140183,5,5,0),
  t(140492,4,5,0),t(140647,6,4,0),t(140647,0,3,0),t(141111,5,4,0),
  t(141420,4,5,0),t(141729,2,5,0),t(142039,0,5,0),t(142348,0,5,0),
  t(142657,4,5,0),t(142966,2,5,0),t(143276,0,5,0),t(143585,0,5,0),
  h(143894,1,5,144513,1),t(144203,0,5,0),t(144822,0,5,0),t(145131,0,5,0),
  t(145441,4,5,0),f(145750,2,5),t(146059,0,5,0),t(146368,0,5,0),
  t(146678,1,8,0),t(147296,0,5,0),t(147605,0,5,0),t(147760,0,5,0),
  t(147915,0,5,0),t(148224,0,5,0),t(148533,2,5,0),t(148843,4,5,0),
  t(149152,4,5,0),t(149461,5,5,0),t(149770,4,5,0),t(150080,5,5,0),
  t(150389,4,5,4),t(150698,5,5,0),t(150853,4,5,0),t(151007,2,5,0),
  h(151317,4,1,152013,0,[[151317,4,1],[151703,3,3],[152013,2,5]]),t(151626,6,4,0),f(152245,0,5),t(152554,5,5,0),
  t(152708,5,5,0),t(152863,4,5,0),t(153172,2,5,0),t(153482,4,5,0),
  t(153791,0,5,0),t(154100,0,5,0),t(154409,0,5,0),t(154641,0,5,0),
  t(154719,2,5,0),t(155028,0,4,0),t(155028,7,3,0),t(155337,0,5,0),
  t(155647,0,5,0),t(155801,4,5,0),t(155956,2,5,0),t(156265,0,5,0),
  t(156574,0,5,0),t(156884,0,5,0),t(157270,2,5,0),t(157502,0,4,0),
  t(157502,7,3,0),t(157811,0,5,0),t(158121,0,5,0),f(158430,2,5),
  t(158739,4,5,0),t(159048,5,5,0),t(159512,5,5,0),t(159667,4,5,0),
  t(159976,2,5,0),t(160286,4,5,0),t(160595,4,5,0),t(160904,2,5,0),
  t(161213,0,5,0),t(161523,0,5,0),t(161677,0,4,0),t(161832,0,5,0),
  t(162064,2,5,0),t(162141,1,4,0),h(162219,3,4,162605),t(162760,5,5,0),
  t(163069,4,5,0),t(163146,6,4,0),t(163378,4,5,0),t(163533,2,5,0),
  t(163688,5,4,0),t(163765,6,4,0),f(163997,4,5),t(164306,2,5,0),
  t(164615,0,5,0),t(164925,0,4,0),t(164925,7,3,0),t(165234,4,5,0),
  t(165543,3,3,0),t(165698,0,5,0),t(165852,0,5,0),t(166162,2,5,0),
  t(166471,0,5,0),t(166780,0,5,0),t(166935,1,3,0),t(167012,5,4,0),
  t(167090,1,8,0),t(167399,4,5,0),t(167553,5,5,0),t(167708,4,5,0),
  t(168172,5,5,0),t(168327,5,4,0),t(168636,2,5,0),t(168945,4,5,0),
  t(169254,2,5,0),f(169564,0,5),t(170028,0,5,0),t(170182,0,5,0),
  t(170492,2,5,0),t(170646,0,5,0),t(170801,0,5,0),t(171110,0,5,0),
  t(171265,0,5,0),t(171419,2,5,0),t(171729,0,5,0),t(172038,2,5,0),
  t(172347,0,5,0),t(172656,2,5,0),t(172734,5,4,0),t(172966,4,5,0),
  t(173043,6,4,0),t(173275,4,5,0),t(173584,5,5,0),t(173894,5,5,0),
  t(174203,4,5,0),t(174512,3,5,0),t(174589,5,4,0),f(174821,2,5),
  t(175131,5,5,0),t(175208,2,5,0),t(175595,6,4,0),t(175595,0,3,0),
  t(175749,4,5,0),t(176058,4,5,0),t(176368,5,5,0),t(176677,5,5,0),
  t(176986,4,5,0),t(177218,5,5,0),t(177295,4,5,0),t(177450,5,5,0),
  t(177605,2,5,0),t(178069,0,5,0),t(178533,0,5,0),t(178842,0,5,0),
  t(179151,0,5,0),t(179460,0,5,0),t(179615,3,4,0),t(179770,5,4,0),
  t(179924,2,5,0),t(180079,4,5,0),t(180388,2,5,0),f(180543,0,5),
  t(181007,4,5,0),t(181316,2,5,0),t(181625,0,5,0),t(181935,0,5,0),
  t(182244,1,3,0),t(182553,0,5,0),t(182862,0,5,0),t(183172,0,5,0),
  t(183404,1,4,0),t(183481,4,5,0),h(183558,0,2,185182),t(183790,2,5,0),
  t(184099,5,5,0),t(184331,2,5,0),t(185491,6,4,0),t(185491,0,3,0),
  t(185646,4,5,0),h(185955,4,1,186806,0,[[185955,4,1],[186264,3,4],[186496,3,4],[186806,4,1]]),t(186264,0,5,0),t(186883,0,5,0),
  t(187501,0,5,0),f(187811,0,5),t(188120,0,8,0),
// </nothing-without-you-v3-expert-notes>
])(mhTap,mhHoldV2,mhFlick,mhSlideV2);
const nothingWithoutYouMasterNotes=((t,h,f,s)=>[
// <nothing-without-you-v3-master-notes>
  t(2248,4,6,0),f(2557,6,4),t(3176,5,4,0),t(4104,1,4,0),
  t(4722,3,4,0),t(5341,5,4,0),t(5650,6,4,0),t(6578,3,4,0),
  t(7196,5,4,0),t(7506,3,4,0),t(8124,1,4,0),t(9052,0,4,0),
  t(9671,1,4,0),t(9980,0,4,0),t(9980,6,3,0),t(10289,1,4,0),
  t(10289,7,3,0),t(10598,3,4,0),t(10753,1,4,0),t(10908,0,2,0),
  t(11062,2,2,0),t(11217,3,4,0),t(11526,5,4,0),t(11681,3,3,0),
  t(11835,1,4,0),f(12145,0,4),t(12454,3,4,0),t(12763,1,4,0),
  t(13072,5,4,0),t(13227,3,4,0),t(13691,0,2,0),t(13691,4,2,0),
  t(14000,4,2,0),t(14000,8,2,0),t(14310,0,2,0),t(14310,4,2,0),
  t(14619,4,2,0),t(14619,8,2,0),t(14928,1,4,0),t(15237,3,4,0),
  t(15547,5,4,0),t(15701,3,4,0),t(15856,5,4,0),t(16011,1,4,0),
  t(16011,7,3,0),t(16165,5,4,0),t(16474,0,2,0),t(16474,4,2,0),
  t(16784,1,2,0),t(16784,5,2,0),t(17093,3,2,0),t(17093,7,2,0),
  t(17402,4,2,0),t(17402,8,2,0),t(17712,5,4,0),t(18021,1,4,0),
  f(18175,3,4),t(18639,0,4,0),t(18949,0,4,0),t(19258,1,4,0),
  t(19413,3,4,0),t(19567,5,4,0),h(19722,8,1,20959,0,[[19722,8,1],[20031,7,2],[20340,7,3],[20650,7,3],[20959,6,4]]),t(21114,1,4,0),
  t(21577,3,4,0),t(21732,2,2,0),t(21732,6,2,0),t(22041,2,2,0),
  t(22041,7,2,0),t(22351,1,2,0),t(22351,8,2,0),t(22660,0,2,0),
  t(22660,8,2,0),t(22969,1,4,0),t(23588,3,4,0),t(24206,0,2,0),
  t(24206,4,2,0),t(24516,4,2,0),t(24516,8,2,0),t(24825,0,2,0),
  t(24825,4,2,0),t(25134,4,2,0),t(25134,8,2,0),t(25443,1,4,0),
  h(25675,5,2,26526),t(26680,0,2,0),t(26680,4,2,0),t(26990,1,2,0),
  t(26990,5,2,0),t(27299,3,2,0),t(27299,7,2,0),t(27608,4,2,0),
  t(27608,8,2,0),h(27918,6,4,28613),t(28845,5,4,0),h(29155,3,4,29541),
  t(29773,1,4,0),h(30082,3,4,30469,1),t(31010,0,4,0),t(31629,1,4,0),
  t(31938,0,6,0),t(32247,1,4,0),t(32557,0,4,0),t(32866,1,4,0),
  h(33175,0,4,33794,1),t(33484,1,4,0),t(34103,0,4,0),t(34412,1,4,0),
  t(34721,3,4,0),f(35031,5,4),s(35340,36113,[[35340,3,3],[35417,3,3],[35495,3.5,3],[35572,3.5,2],[35649,3.5,2],[35727,3.5,2],[35804,3,2],[35881,4,2],[35959,4,2],[36036,4,2],[36113,4,2]],1),s(35340,36113,[[35340,1,2],[36113,0,2]]),
  s(36422,37660,[[36422,4,2],[36654,3.5,2],[36886,2.5,2],[37118,1.5,2],[37350,0.5,2],[37582,0.5,2],[37660,1,2]]),t(37196,3,4,0),t(37814,5,4,0),h(38123,6,4,38819),
  t(38433,5,4,0),t(39051,5,4,1),h(39361,6,4,39824),t(39979,6,4,0),
  t(39979,1,3,0),t(40288,3,4,0),t(40598,5,4,0),t(40907,6,4,0),
  t(41371,6,2,0),t(41525,3,4,0),t(41835,5,4,0),t(41989,1,4,0),
  t(41989,7,3,0),t(42144,1,4,0),t(42453,0,4,0),t(42763,1,4,0),
  f(43381,3,4),t(43690,6,1,0),h(43845,6,4,44232),t(44309,2,2,0),
  t(44618,2,2,0),t(44618,7,2,0),t(44927,1,2,0),t(44927,8,2,0),
  t(45237,0,2,0),t(45237,8,2,0),t(45546,5,4,0),t(45855,1,4,0),
  t(46165,0,4,0),t(46319,1,4,0),t(46474,3,4,0),t(46783,1,4,0),
  t(46938,0,4,0),t(47092,0,2,0),t(47092,4,2,0),t(47402,4,2,0),
  t(47402,8,2,0),t(47711,0,2,0),t(47711,4,2,0),t(48020,4,2,0),
  t(48020,8,2,0),t(48329,5,4,0),t(48639,6,4,0),t(48793,5,4,0),
  f(48948,3,4),t(49257,5,4,0),t(49566,3,4,0),t(49876,1,4,0),
  t(50185,1,4,0),t(50185,7,3,0),t(50494,1,4,0),t(50804,3,4,0),
  t(51113,5,4,0),t(51267,6,4,0),t(51422,5,4,0),t(51731,3,4,0),
  t(52041,1,4,0),t(52350,0,4,0),t(52659,1,4,0),t(52968,0,4,0),
  t(53278,1,4,0),t(53587,3,4,0),t(53896,5,4,0),t(54206,6,4,0),
  t(54515,5,4,0),t(54824,6,4,0),f(55133,5,4),t(55752,3,4,0),
  t(56061,1,3,0),t(56216,3,4,0),t(56370,5,4,0),t(56680,2,6,0),
  t(56989,1,4,0),t(57298,1,4,0),t(57608,0,4,0),t(57917,1,4,0),
  t(58226,0,4,0),t(58303,2,3,0),t(58381,1,3,0),t(58535,0,4,0),
  t(58535,6,3,0),t(58690,1,4,0),t(58845,0,4,0),t(59772,1,4,0),
  t(60082,0,4,0),t(60391,1,4,0),h(60700,3,4,61087),t(61164,6,4,0),
  f(61319,6,4),h(61628,6,4,62169,0,[[61628,6,4],[61937,7,3],[62169,8,1]]),t(62247,6,4,0),t(62556,5,4,0),
  t(62865,3,4,0),t(63020,6,2,0),h(63174,6,4,63561),t(63793,5,4,0),
  t(64102,6,4,0),t(64412,5,4,0),t(64721,3,4,0),t(65030,1,4,0),
  t(65339,3,4,0),t(65649,5,4,0),t(65958,6,4,0),t(66267,5,4,0),
  t(66576,6,4,0),t(66886,5,4,0),t(67195,3,4,0),t(67504,1,4,0),
  t(67813,0,4,0),t(68123,1,4,0),f(68432,3,4),t(69051,1,4,0),
  t(69051,7,3,0),t(69360,5,4,0),t(69669,6,4,0),t(69978,5,4,0),
  t(70133,6,4,0),t(70288,5,4,0),t(70597,3,4,0),t(70906,1,4,0),
  t(71215,5,4,0),t(71525,3,4,0),t(71834,1,4,0),t(72143,0,4,0),
  h(72453,2,1,72994,0,[[72453,2,1],[72762,0,4],[72994,2,1]]),t(73071,1,4,0),t(73535,0,4,0),t(73690,1,4,0),
  t(74308,0,4,0),t(74617,0,4,0),t(74927,0,4,0),t(75236,0,4,0),
  f(75545,1,4),t(75855,0,4,0),t(76009,1,4,0),t(76164,3,4,0),
  t(76473,5,4,0),t(76628,3,4,0),t(76782,1,4,0),t(77092,3,4,2),
  t(77401,1,4,0),t(77710,5,4,0),t(77710,0,3,0),t(78019,3,4,0),
  t(78097,6,4,0),t(78329,3,4,0),t(78483,6,2,0),t(78638,6,4,0),
  t(78947,5,4,0),t(79257,5,4,0),t(79566,5,4,0),t(79875,4,6,0),
  t(80184,7,3,0),h(80494,1,3,81035),f(81112,3,4),t(81421,5,4,0),
  t(81731,6,4,0),t(81885,5,4,0),t(82040,6,4,0),t(82117,5,4,0),
  t(82349,6,4,0),t(82968,5,4,0),t(83277,6,4,0),t(83432,5,4,0),
  t(83586,3,4,0),t(84050,1,3,0),t(84205,3,3,0),t(84360,5,3,0),
  t(84514,3,4,0),t(84823,5,4,0),t(85133,3,4,0),t(85442,5,4,0),
  t(85751,6,4,0),t(85751,1,3,0),t(85906,3,4,0),f(86060,5,4),
  t(86524,6,4,0),t(86679,5,4,0),t(86911,5,4,0),t(86988,6,4,0),
  t(87298,5,4,0),t(87607,6,4,0),t(87916,1,4,0),t(87993,5,3,0),
  t(88225,3,4,0),t(88535,6,4,0),t(88844,1,3,0),t(89153,3,4,0),
  t(89308,5,3,0),t(89462,6,4,0),t(89617,5,3,0),t(89772,3,4,0),
  t(90081,1,4,0),t(90390,0,4,0),t(90700,3,4,0),t(90854,1,4,0),
  t(91009,0,4,0),f(91318,1,4),t(91627,0,4,0),t(91859,3,4,0),
  t(91937,1,4,0),t(92246,5,4,0),t(92555,5,4,0),t(92555,0,3,0),
  t(92787,6,4,0),t(92864,5,4,0),t(92942,7,3,0),t(93174,1,4,0),
  t(93483,3,4,0),s(93870,94333,[[93870,3,3],[94102,4,2],[94256,4,2],[94333,4,2]]),t(94411,6,4,0),t(94565,5,3,0),
  t(94720,3,4,0),t(95029,1,4,0),t(95339,0,4,0),t(95648,0,4,0),
  t(95803,1,4,0),t(95957,3,4,0),t(96421,1,3,0),t(96576,3,4,0),
  f(96885,5,4),t(97194,3,4,0),t(97504,1,4,0),t(97813,0,4,0),
  t(98122,0,4,0),t(98277,0,4,0),t(98431,0,4,0),h(98741,5,4,99282,0,[[98741,5,4],[99050,7,1],[99282,5,4]]),
  t(99359,3,4,0),t(99668,1,4,0),t(99978,0,6,0),t(100287,3,4,0),
  t(100442,1,4,0),t(100596,0,2,0),t(100596,4,2,0),t(100751,1,4,0),
  t(100906,5,4,0),t(101215,1,4,0),t(101369,3,3,0),t(101524,0,4,0),
  t(101679,1,4,0),t(101833,3,4,0),t(101988,1,3,0),f(102143,0,4),
  t(102452,1,4,0),h(102684,5,4,103070,1),t(103380,6,4,0),t(104307,3,4,0),
  t(104926,5,4,0),t(105235,1,4,0),t(105854,6,4,0),t(106318,0,4,0),
  t(107091,0,2,0),h(107246,1,4,108173),t(107709,0,4,0),t(108328,3,4,0),
  t(108792,6,4,0),s(109256,110261,[[109256,2,3],[109333,2.5,3],[109410,2.5,3],[109488,2.5,3],[109565,2,2],[109642,1,2],[109720,1,2],[109797,1,2],[109874,1,2],[109952,0.5,2],[110029,0.5,2],[110106,0.5,2],[110184,1,2],[110261,1,2]],1),s(109256,110261,[[109256,4,2],[110261,3,2]]),t(110802,1,4,0),
  t(111421,6,4,0),h(112349,3,4,113199),t(112658,6,4,0),f(113276,5,4),
  t(114204,6,4,3),h(114977,5,4,116137,1),t(115751,3,4,0),t(116678,1,4,0),
  t(116833,5,4,0),s(117606,118611,[[117606,3,3],[117683,3,3],[117761,2.5,3],[117838,2,3],[117915,1,2],[117993,1,2],[118070,1.5,2],[118147,1.5,2],[118225,1.5,2],[118302,1,2],[118379,1.5,2],[118457,1,2],[118534,1,2],[118611,1,2]],1),s(117915,118611,[[117915,3,2],[118611,4,2]]),t(119153,5,4,0),
  t(119462,8,2,0),h(120080,7,1,120931,1,[[120080,7,1],[120390,6,3],[120622,6,3],[120931,7,1]]),t(120390,9,1,0),t(121627,5,4,0),
  t(121627,0,3,0),t(122245,3,4,0),t(122554,1,4,0),t(122864,0,1,0),
  t(123018,2,2,0),t(123173,3,4,0),t(123482,5,4,0),t(123792,6,4,0),
  t(123946,3,3,0),f(124101,5,4),t(124410,6,4,0),t(124719,6,1,0),
  t(125029,3,4,0),t(125338,5,4,0),t(125493,3,4,0),t(125647,1,4,0),
  t(125956,5,4,0),t(126266,3,4,0),t(126575,1,4,0),t(126884,0,4,0),
  t(127503,1,4,0),t(127503,7,3,0),t(127812,0,1,0),t(127967,1,4,0),
  t(128121,3,4,0),t(128431,5,4,0),t(128740,6,4,0),t(129049,5,4,0),
  t(129358,3,4,0),t(129977,0,4,0),t(130286,1,4,0),t(130441,3,4,0),
  f(130596,1,4),t(130905,3,4,0),t(131214,0,6,0),t(131523,3,4,0),
  t(131833,5,4,0),t(132142,1,4,0),t(132451,3,4,0),t(132915,6,2,0),
  t(133070,6,4,0),t(133379,3,4,0),t(133534,5,4,0),t(133688,6,4,0),
  t(133998,5,4,0),t(134307,5,4,0),t(134925,3,4,0),t(135235,2,1,0),
  t(135544,0,4,0),t(135853,5,4,0),t(136008,3,4,0),t(136162,1,4,0),
  t(136162,7,3,0),f(136472,0,4),t(136781,0,4,0),t(137090,1,4,0),
  t(137400,0,4,0),t(137554,1,4,0),t(137709,4,1,0),t(138018,5,4,0),
  t(138327,6,4,0),t(138482,5,4,0),t(138637,3,4,0),t(138946,1,4,0),
  t(139101,3,3,0),s(139255,139796,[[139255,3,3],[139410,2.5,2],[139487,2.5,2],[139642,4,2],[139719,4,2],[139796,4,2]]),t(139874,1,4,0),t(140183,0,4,0),
  t(140492,1,4,0),t(140647,0,3,0),t(141033,1,3,0),t(141111,0,3,0),
  t(141420,1,4,0),f(141729,0,4),t(142039,5,4,0),t(142271,1,4,0),
  t(142348,3,4,0),t(142657,0,4,0),t(142966,0,4,0),t(143276,1,4,0),
  t(143585,1,4,0),t(143585,7,3,0),h(143894,1,4,144513),s(143894,144358,[[143894,3,2],[144358,4,2]]),
  t(144667,0,4,0),t(144822,1,4,0),t(145131,0,4,0),t(145441,1,4,0),
  t(145750,0,4,0),t(146059,1,4,0),t(146368,3,4,0),t(146678,5,4,0),
  t(146987,6,4,0),t(147296,5,4,0),t(147605,3,4,0),t(147760,1,4,0),
  f(147915,3,4),t(148224,5,4,0),t(148533,6,4,0),t(148843,5,4,0),
  t(149152,6,4,0),t(149461,5,4,0),t(149616,6,4,0),t(149770,3,4,0),
  t(150080,5,4,0),t(150389,6,4,4),t(150698,5,4,0),t(150853,5,4,0),
  t(151007,1,4,0),t(151007,7,3,0),h(151317,3,1,152013,0,[[151317,3,1],[151703,2,3],[152013,1,4]]),t(151626,0,2,0),
  t(152167,0,4,0),t(152245,1,4,0),t(152554,0,6,0),t(152708,1,4,0),
  t(152863,3,4,0),t(153172,5,4,0),f(153482,3,4),t(153791,1,4,0),
  t(153946,6,2,0),t(154100,3,4,0),t(154409,1,4,0),t(154641,0,4,0),
  t(154719,1,4,0),t(155028,3,3,0),t(155337,5,4,0),t(155647,6,4,0),
  t(155724,5,4,0),t(155801,6,4,0),t(155956,5,4,0),t(156265,6,4,0),
  t(156574,3,4,0),t(156884,5,4,0),t(157270,6,4,0),t(157502,5,3,0),
  t(157811,6,4,0),t(158121,5,4,0),t(158430,3,4,0),t(158739,1,4,0),
  f(159048,0,4),t(159358,0,1,0),t(159512,1,4,0),t(159667,1,4,0),
  t(159976,3,4,0),t(160131,6,2,0),t(160286,6,4,0),t(160595,5,4,0),
  t(160904,6,4,0),t(161059,5,3,0),t(161136,3,4,0),t(161213,6,4,0),
  t(161523,1,4,0),t(161677,3,3,0),t(161832,5,4,0),t(162064,6,4,0),
  t(162141,5,3,0),h(162219,7,3,162605),t(162760,5,4,0),f(163069,6,4),
  t(163378,1,4,0),t(163533,5,4,0),t(163688,3,3,0),t(163765,7,3,0),
  t(163997,5,4,0),t(164229,1,3,0),t(164306,3,4,0),t(164615,1,4,0),
  t(164693,0,3,0),t(164925,1,3,0),t(165234,1,4,0),t(165234,7,3,0),
  t(165543,2,2,0),t(165621,0,3,0),t(165698,1,4,0),t(165852,0,4,0),
  t(166162,1,4,0),t(166471,0,4,0),t(166780,3,4,0),t(166935,8,2,0),
  t(167012,3,3,0),t(167090,4,4,0),t(167167,7,3,0),t(167399,3,4,0),
  t(167553,6,4,0),f(167708,5,4),t(168172,3,4,0),t(168327,1,3,0),
  t(168636,0,4,0),t(168945,3,4,0),t(169177,0,4,0),t(169254,3,4,0),
  t(169564,4,6,0),t(170028,3,4,0),t(170182,5,4,0),t(170492,6,4,0),
  t(170646,5,4,0),t(170801,1,4,0),t(171110,5,4,0),t(171187,3,3,0),
  t(171265,6,4,0),t(171419,5,4,0),t(171729,1,4,0),t(171729,7,3,0),
  t(172038,5,4,0),f(172347,6,4),t(172656,3,4,0),t(172734,0,3,0),
  t(172966,3,4,0),t(173043,7,3,0),t(173275,6,4,0),t(173584,6,4,0),
  t(173739,7,3,0),t(173894,6,4,0),t(174203,6,4,0),t(174512,5,4,0),
  t(174589,7,3,0),t(174821,5,4,0),t(175131,1,4,0),t(175208,0,4,0),
  t(175517,1,3,0),t(175595,0,3,0),t(175749,0,4,0),t(176058,0,4,0),
  t(176368,1,4,0),t(176600,1,4,0),f(176677,5,4),t(176986,1,4,0),
  t(177218,3,4,0),t(177295,0,4,0),t(177450,3,4,0),t(177605,1,4,0),
  t(178069,0,4,0),t(178223,1,4,0),t(178223,7,3,0),t(178533,1,4,0),
  t(178842,1,4,0),t(179151,0,4,0),t(179383,0,4,0),t(179460,1,4,0),
  t(179770,3,3,0),t(179924,1,4,0),t(180079,0,4,0),t(180388,3,4,0),
  t(180543,1,4,0),t(180697,0,4,0),t(181007,1,4,0),t(181316,0,4,0),
  t(181548,2,2,0),f(181625,0,4),t(181935,1,4,0),t(182244,0,2,0),
  t(182553,1,4,0),t(182862,3,4,0),t(183172,5,4,0),t(183404,5,3,0),
  t(183481,6,4,0),h(183558,3,2,185182),t(183790,5,4,0),t(184099,6,4,0),
  t(184331,5,4,0),h(184486,5,4,185259,0,[[184486,5,4],[184718,5,3],[185027,6,2],[185259,6,1]]),t(185491,7,3,0),t(185491,2,3,0),
  t(185646,5,4,0),h(185955,5,1,186806,0,[[185955,5,1],[186264,4,3],[186496,4,3],[186806,5,1]]),t(186264,7,3,0),t(186883,0,4,0),
  t(187501,1,4,0),t(187656,0,4,0),f(187811,0,4),t(188120,0,6,0),
// </nothing-without-you-v3-master-notes>
])(mhTap,mhHoldV2,mhFlick,mhSlideV2);

// 呪われた騎士の時計仕掛け（全尺4分52秒）。譜面はV3パイプラインが入れる。
// こちらも既存の bgm-dullahan-clockwork.mp3 を使い回す。
// 音源は4分52秒あるが、モンビーでは曲の区切り(2分1.7秒)までを譜面にして、そこで終わる。
// 音源そのものは切っていない(バトルのBGMと同じファイルのため)。
const DULLAHAN_CLOCKWORK_DURATION_MS=121675;
const dullahanClockworkEasyNotes=((t,h,f,s)=>[
// <dullahan-clockwork-v3-easy-notes>
  t(2073,0,10,0),t(3258,4,6,0),t(4442,4,6,0),t(4837,4,6,0),
  t(5231,4,6,0),t(6021,4,6,0),t(6416,7,3,0),t(6416,0,3,0),
  t(6810,4,6,0),t(7600,4,6,0),t(7994,4,6,0),t(8389,0,6,0),
  t(9179,0,6,0),t(9968,3,4,0),t(10758,4,6,0),t(11152,6,4,0),
  t(11547,5,4,0),t(11942,2,6,0),t(12731,0,6,0),h(15889,2,3,17468,0,[[15889,2,3],[16284,1,4],[16679,1,4],[17073,0,6],[17468,0,6]]),
  t(18652,1,4,0),t(19047,0,6,0),t(20231,2,6,0),t(21810,4,6,0),
  h(22994,3,4,24573),t(24968,0,6,0),t(25363,0,6,1),t(26547,0,4,0),
  t(26942,0,6,0),h(28521,2,6,29310),t(31284,4,6,0),t(31678,4,6,0),
  h(32863,4,6,34145),t(34836,0,6,0),t(35428,2,6,0),t(36020,4,6,0),
  t(36415,4,6,0),t(36810,4,6,0),t(37205,2,6,0),t(37994,0,10,0),
  t(38981,3,4,0),t(39178,0,6,0),t(39573,0,4,0),t(39968,0,6,0),
  t(40757,2,6,0),t(41152,4,6,0),t(41547,4,6,0),t(42731,4,6,0),
  t(43126,4,6,0),t(43915,4,6,0),t(44310,7,3,0),t(44310,0,3,0),
  t(44705,4,6,0),t(45494,4,6,0),t(45889,4,6,0),t(46283,4,6,0),
  t(47073,4,6,0),t(47862,6,4,0),h(48652,4,6,49540,0,[[48652,4,6],[49145,5,4],[49540,6,3]]),h(49836,2,6,50329),
  t(50625,2,6,2),t(51810,0,6,0),h(52204,3,4,52797),t(54968,4,6,0),
  t(55757,5,4,0),t(56546,6,4,0),t(56941,4,6,0),t(58125,4,6,0),
  h(58520,6,3,60000,0,[[58520,6,3],[58915,5,4],[59310,4,6],[59606,5,4],[60000,6,3]]),t(60099,4,6,0),t(61283,2,6,0),t(62467,0,6,0),
  t(63257,0,4,0),t(64046,1,4,0),t(65231,2,6,0),t(66415,5,4,0),
  t(67599,2,6,0),t(67994,4,6,0),t(69573,0,10,0),t(69967,3,4,0),
  h(71152,0,6,71842),t(72336,0,3,0),t(72336,7,3,0),t(72730,0,6,3),
  t(73125,0,6,0),t(73323,0,6,0),t(73915,2,6,0),t(74309,4,6,0),
  t(74704,4,6,0),t(75099,4,6,0),t(76480,6,4,0),h(77467,5,4,78651),
  t(79046,3,4,0),t(79836,5,4,0),t(82007,6,4,0),t(82994,3,4,0),
  t(83388,4,6,0),h(83586,4,6,84178,0,[[83586,4,6],[83882,6,3],[84178,4,6]]),t(85362,2,6,0),t(85757,5,4,0),
  t(86546,3,4,0),t(88125,1,4,0),t(89309,0,6,0),t(89704,0,6,0),
  t(90099,0,6,0),t(91283,0,6,0),t(91678,0,6,0),t(92072,2,6,0),
  t(92862,4,6,0),t(93651,4,6,0),t(94441,4,6,0),t(94835,2,6,0),
  t(95230,0,6,0),t(96020,4,6,0),t(96414,4,6,4),t(96809,2,6,0),
  t(97599,0,6,0),t(97993,0,4,0),t(98388,0,10,0),t(99178,2,6,0),
  t(99572,4,6,0),t(100756,2,6,0),t(101151,0,3,0),t(101151,7,3,0),
  t(101546,0,4,0),t(101941,0,6,0),t(104112,0,4,0),t(104309,0,6,0),
  t(104704,0,6,0),t(105493,0,6,0),t(105888,0,6,0),t(106283,0,6,0),
  t(107072,2,6,0),t(107467,2,6,0),t(108651,0,6,0),t(109046,3,4,0),
  t(109441,4,6,0),t(110230,4,6,0),t(110625,3,4,0),t(111019,4,6,0),
  t(111809,4,6,0),t(112204,4,6,0),t(112598,4,6,0),t(113388,4,6,0),
  t(113783,2,6,0),t(114177,0,6,0),t(114967,0,6,0),t(115362,0,4,0),
  t(115954,1,4,0),t(116151,0,6,0),t(116546,4,6,0),t(116940,3,4,0),
  t(117335,1,4,0),t(118125,0,6,0),t(118519,0,4,0),t(118914,0,6,0),
  t(119704,0,10,0),t(120098,0,3,0),t(120098,7,3,0),
// </dullahan-clockwork-v3-easy-notes>
])(mhTap,mhHoldV2,mhFlick,mhSlideV2);
const dullahanClockworkNormalNotes=((t,h,f,s)=>[
// <dullahan-clockwork-v3-normal-notes>
  t(2073,0,10,0),f(2863,2,6),t(3258,4,6,0),t(4442,4,6,0),
  t(4837,4,6,0),t(5231,4,6,0),t(6021,4,6,0),t(6416,0,3,0),
  t(6416,7,3,0),t(6810,2,6,0),t(7600,2,6,0),t(7994,2,6,0),
  t(8389,4,6,0),t(8981,3,4,0),t(9179,0,6,0),t(9968,0,3,0),
  t(9968,7,3,0),t(10758,0,6,0),t(11152,3,4,0),t(11547,5,4,0),
  t(11942,2,6,0),f(12731,4,6),t(13521,6,4,0),h(15889,6,2,17468,1,[[15889,6,2],[16284,6,3],[16679,5,4],[17073,5,4],[17468,4,6]]),
  t(18652,3,4,0),t(19047,4,6,0),t(20231,4,6,0),t(20626,4,6,0),
  h(21810,2,6,22896),t(23389,0,6,0),t(23784,4,6,0),t(24968,2,6,0),
  t(25363,4,6,1),t(26547,3,4,0),t(26942,4,6,0),h(28521,4,6,29310),
  t(30494,2,6,0),t(31284,0,6,0),f(31678,0,6),h(32863,0,6,34145),
  t(34836,0,6,0),t(35231,3,4,0),t(35428,0,6,0),t(36020,4,6,0),
  t(36415,0,6,0),t(36810,2,6,0),t(37205,4,6,0),t(37994,0,10,0),
  t(38981,5,4,0),t(39178,4,6,0),t(39573,5,4,0),t(39770,6,4,0),
  t(39968,4,6,0),t(40757,2,6,0),t(41152,0,6,0),t(41547,0,6,0),
  f(42731,0,6),t(43126,4,6,0),t(43520,2,6,0),t(43915,4,6,0),
  t(44310,5,4,0),t(45494,4,6,0),t(45889,4,6,0),t(46086,3,4,0),
  t(46283,4,6,0),t(47073,0,6,0),t(47862,3,4,0),t(48257,5,4,2),
  h(48652,4,6,49540,0,[[48652,4,6],[49145,5,4],[49540,6,2]]),h(49836,4,6,50329),t(50625,4,6,0),t(51810,2,6,0),
  h(52204,6,4,52797),t(53586,5,4,0),f(54968,2,6),t(55757,3,3,0),
  t(56546,3,4,0),t(56941,2,6,0),t(58125,0,6,0),h(58520,2,2,60000,0,[[58520,2,2],[58915,1,4],[59310,0,6],[59606,1,4],[60000,2,2]]),
  t(60099,2,6,0),t(61283,4,6,0),t(62467,4,6,0),t(62862,4,6,0),
  t(63257,0,3,0),t(63257,7,3,0),t(64046,1,4,0),t(65231,0,6,0),
  t(66415,1,4,0),t(67599,0,6,0),t(67994,0,6,0),t(69178,0,10,0),
  f(69573,0,6),t(69967,0,4,0),h(71152,0,6,71842),t(72336,0,4,0),
  t(72730,0,6,3),t(73125,0,6,0),t(73323,0,6,0),t(73915,0,6,0),
  t(74309,2,6,0),t(74704,0,6,0),t(74902,5,4,0),t(75099,2,6,0),
  t(76480,5,3,0),h(77467,2,6,78651,0,[[77467,2,6],[77862,4,3],[78257,4,3],[78651,2,6]]),t(79046,1,3,0),t(79836,1,4,0),
  t(82007,0,4,0),f(82994,1,3),t(83388,2,6,0),t(83586,0,6,0),
  h(83783,2,6,84178,1),t(84967,0,3,0),t(84967,7,3,0),t(85362,2,6,0),
  t(85757,5,4,0),t(86546,6,4,0),t(88125,5,4,0),t(89112,0,6,0),
  t(89309,4,6,0),t(89704,2,6,0),t(90099,4,6,0),t(91283,2,6,0),
  t(91678,4,6,0),t(92072,2,6,0),t(92862,4,6,0),t(93257,3,4,0),
  f(93651,4,6),t(94441,2,6,0),t(94835,4,6,0),t(95230,0,6,0),
  t(96020,0,6,0),t(96414,2,6,4),t(96809,4,6,0),t(97599,4,6,0),
  t(97993,5,4,0),t(98388,0,10,0),t(98783,1,4,0),t(99178,0,6,0),
  t(99572,0,6,0),t(99967,3,4,0),t(100756,4,6,0),t(101151,3,4,0),
  t(101546,0,3,0),t(101546,7,3,0),f(101941,0,6),t(104112,0,3,0),
  t(104309,0,6,0),t(104704,0,6,0),t(105493,0,6,0),t(105888,0,6,0),
  t(106283,0,6,0),t(107072,0,6,0),t(107467,0,6,0),t(107862,0,6,0),
  t(108651,2,6,0),t(109046,5,4,0),t(109441,4,6,0),t(110230,2,6,0),
  t(110625,5,4,0),t(111019,4,6,0),t(111612,5,4,0),t(111809,4,6,0),
  f(112204,4,6),t(112598,4,6,0),t(113388,4,6,0),t(113783,4,6,0),
  t(114177,4,6,0),t(114967,4,6,0),t(115362,6,4,0),t(115756,4,6,0),
  t(115954,6,4,0),t(116151,4,6,0),t(116546,4,6,0),t(116940,5,4,0),
  t(117335,5,3,0),t(118125,2,6,0),t(118519,0,3,0),t(118519,7,3,0),
  t(118914,0,6,0),t(119506,0,4,0),t(119704,0,10,0),f(120098,0,4),
// </dullahan-clockwork-v3-normal-notes>
])(mhTap,mhHoldV2,mhFlick,mhSlideV2);
const dullahanClockworkHardNotes=((t,h,f,s)=>[
// <dullahan-clockwork-v3-hard-notes>
  t(2073,0,8,0),t(2666,0,4,0),t(2666,7,3,0),f(2863,4,5),
  t(3258,5,5,0),t(4442,4,5,0),t(4837,2,5,0),t(5231,4,5,0),
  t(5626,2,5,0),t(5823,0,4,0),t(5823,7,3,0),t(6021,2,5,0),
  t(6416,6,4,0),t(6810,4,5,0),t(7205,3,4,0),h(7402,1,4,7896),
  t(7994,0,5,0),t(8389,0,5,0),t(8981,6,4,0),t(9179,2,5,0),
  t(9968,5,4,0),t(10165,0,5,0),t(10363,3,4,0),f(10758,0,5),
  t(11152,1,4,0),t(11350,2,5,0),t(11547,5,4,0),t(11942,5,5,0),
  t(12731,4,5,0),t(13521,3,4,0),t(14310,1,3,0),s(15889,17468,[[15889,2,2],[15988,2,3],[16086,2,3],[16185,2,3],[16284,2,3],[16382,4,4],[16481,4,4],[16580,4,4],[16679,2,4],[16777,2,4],[16876,2,4],[16975,2,4],[17073,2,3],[17172,2,3],[17271,2,3],[17369,2,3],[17468,2,2]],1),
  t(18652,6,4,0),t(19047,4,5,0),t(19442,2,5,0),t(20231,0,5,0),
  t(20626,0,5,0),t(21810,0,5,0),h(22994,5,1,24573,0,[[22994,5,1],[23389,4,2],[23784,4,3],[24178,3,4],[24573,3,5]]),t(24968,4,5,0),
  t(25363,5,5,1),t(26547,5,4,0),f(26942,4,5),t(27731,4,5,0),
  h(28521,4,5,29310),t(30494,2,5,0),t(31284,0,5,0),t(31678,0,5,0),
  t(32468,1,4,0),h(32863,2,5,34145,0,[[32863,2,5],[33257,3,4],[33751,4,2],[34145,4,1]]),t(34441,5,5,0),t(34836,4,5,0),
  t(35231,0,4,0),t(35231,7,3,0),t(35428,0,5,0),t(35626,0,3,0),
  t(36020,0,5,0),t(36415,2,5,0),t(36613,5,4,0),t(36810,2,5,0),
  t(37007,1,4,0),f(37205,2,5),t(37994,4,5,0),t(38784,0,5,0),
  t(38981,3,4,0),t(39178,2,8,0),t(39573,6,4,0),t(39770,5,4,0),
  t(39968,2,5,0),t(40757,0,5,0),t(40955,2,5,0),t(41152,0,5,0),
  t(41547,2,5,0),t(42336,4,5,0),t(42731,2,5,0),t(42928,0,4,0),
  t(42928,7,3,0),t(43126,0,5,0),t(43520,2,5,0),t(43915,4,5,0),
  f(44310,6,4),t(44705,4,5,0),t(45297,3,4,0),t(45494,4,5,0),
  t(45889,2,5,0),t(46086,1,4,0),t(46283,2,5,0),t(46876,5,4,0),
  t(47073,2,5,0),t(47862,5,4,0),t(48060,5,5,0),t(48257,5,4,0),
  h(48652,4,1,49540,0,[[48652,4,1],[49145,2,5],[49540,4,1]]),h(49836,0,5,50329),t(50625,2,5,2),t(51810,0,5,0),
  h(52204,5,4,52797,1),t(53586,6,4,0),s(54573,56152,[[54573,1,3],[54869,0.5,3],[55165,2,3],[55461,2,3],[55757,3.5,3],[56053,3,3],[56152,2.5,3]]),f(56546,0,4),
  t(56941,0,5,0),t(57731,3,4,0),t(58125,4,5,0),h(58520,5,5,60000),
  t(60099,4,5,0),t(60494,5,5,0),t(61283,4,5,0),t(62467,0,5,0),
  t(62862,0,5,0),t(63257,0,4,0),t(64046,0,4,0),t(64046,7,3,0),
  t(64441,0,5,0),t(65231,0,5,0),h(65625,0,5,66316,0,[[65625,0,5],[66020,2,1],[66316,0,5]]),t(66415,1,4,0),
  t(67599,0,5,0),t(67994,0,5,0),f(68388,3,4),t(69178,4,5,0),
  t(69573,5,5,0),t(69967,5,4,0),t(70362,3,4,0),h(71152,4,5,71842),
  t(71941,3,4,3),t(72336,1,4,0),t(72533,1,8,0),t(72730,4,5,0),
  t(73125,0,5,0),t(73323,2,5,0),t(73520,5,4,0),t(73915,5,5,0),
  t(74112,5,4,0),t(74309,2,5,0),t(74507,1,4,0),t(74704,2,5,0),
  t(74902,5,4,0),f(75099,5,5),t(76480,3,3,0),t(76776,5,3,0),
  h(77467,3,1,78651,1,[[77467,3,1],[77862,1,4],[78257,1,4],[78651,3,1]]),t(79046,0,3,0),t(79836,3,4,0),t(81217,5,4,0),
  t(82007,6,4,0),t(82204,6,1,0),t(82303,6,4,0),t(82994,1,3,0),
  t(83388,2,5,0),t(83586,4,5,0),h(83783,5,5,84178,1),t(84967,0,3,0),
  t(85362,0,5,0),f(85757,3,4),t(86151,5,3,0),t(86349,6,4,0),
  t(86546,5,4,0),t(87040,3,4,0),t(88125,1,4,0),t(89112,5,5,0),
  t(89309,4,5,0),t(89507,2,5,0),t(89704,0,5,0),t(89901,0,3,0),
  t(90099,0,5,0),t(91283,2,5,0),t(91678,4,5,0),t(92072,2,5,0),
  t(92664,1,4,0),t(92862,2,5,0),t(93257,5,4,0),t(93651,2,5,0),
  t(94243,2,5,0),f(94441,4,5),t(94835,4,5,0),t(95230,5,5,4),
  t(95822,6,4,0),t(95822,0,3,0),t(96020,2,5,0),t(96217,5,5,0),
  t(96414,2,5,0),t(96809,5,5,0),t(97105,3,4,0),t(97401,5,5,0),
  t(97599,2,5,0),t(97993,1,4,0),t(98388,1,8,0),t(98783,5,4,0),
  t(98980,3,4,0),t(99178,0,5,0),t(99572,0,5,0),t(99967,1,4,0),
  f(100756,2,5),t(101151,5,4,0),t(101349,2,5,0),t(101546,1,4,0),
  t(101941,0,5,0),s(102335,103914,[[102335,1,4],[102533,1,4],[102829,0,3],[103322,0,3],[103717,0,2],[103914,0,2]]),t(104112,0,3,0),t(104309,0,5,0),
  t(104506,1,4,0),t(104704,0,5,0),t(105296,3,4,0),t(105493,2,5,0),
  t(105888,0,5,0),t(106283,2,5,0),t(107072,0,5,0),t(107270,0,4,0),
  t(107467,0,5,0),t(107862,2,5,0),t(108454,1,4,0),f(108651,2,5),
  t(109046,6,4,0),t(109046,0,3,0),t(109441,5,5,0),t(110033,4,5,0),
  t(110230,2,5,0),t(110625,0,4,0),t(110822,1,4,0),t(111019,0,5,0),
  t(111316,1,4,0),t(111612,3,4,0),t(111809,0,5,0),t(112204,0,5,0),
  t(112598,2,5,0),t(113191,1,4,0),t(113388,4,5,0),t(113783,2,5,0),
  t(114177,5,5,0),f(114375,2,5),t(114769,2,5,0),t(114967,4,5,0),
  t(115362,5,4,0),t(115559,5,5,0),t(115756,5,5,0),t(115954,3,4,0),
  t(116151,2,5,0),t(116546,4,5,0),t(116940,5,4,0),t(117138,6,4,0),
  t(117335,7,3,0),t(117927,6,4,0),t(118125,4,5,0),t(118519,3,4,0),
  t(118914,0,5,0),t(119309,0,4,0),t(119309,7,3,0),t(119506,1,4,0),
  t(119704,0,8,0),f(120098,0,4),
// </dullahan-clockwork-v3-hard-notes>
])(mhTap,mhHoldV2,mhFlick,mhSlideV2);
const dullahanClockworkExpertNotes=((t,h,f,s)=>[
// <dullahan-clockwork-v3-expert-notes>
  t(2073,0,8,0),t(2666,0,4,0),t(2666,7,3,0),f(2863,2,5),
  t(3258,4,5,0),t(3652,5,5,0),t(4442,0,2,0),t(4442,4,2,0),
  t(4837,2,2,0),t(4837,6,2,0),t(5231,4,2,0),t(5231,8,2,0),
  t(5626,5,5,0),t(5823,5,4,0),t(6021,2,5,0),t(6218,4,5,0),
  t(6416,6,4,0),t(6810,4,5,0),t(7205,3,4,0),h(7402,1,4,7896),
  t(7994,5,2,0),t(8192,3,2,0),t(8192,7,2,0),t(8389,1,2,0),
  t(8389,5,2,0),t(8784,5,4,0),t(8981,3,4,0),f(9179,0,5),
  t(9968,0,4,0),t(10165,0,5,0),t(10758,0,5,0),t(11152,0,2,0),
  t(11152,4,2,0),t(11350,2,2,0),t(11350,6,2,0),t(11547,4,2,0),
  t(11547,8,2,0),t(11942,2,5,0),t(12336,1,3,0),t(12534,0,4,0),
  t(12534,7,3,0),t(12731,4,5,0),t(13521,6,4,0),s(15889,17468,[[15889,3,2],[15988,3,3],[16086,3,3],[16185,3,3],[16284,3,3],[16382,4,4],[16481,4,4],[16580,4,4],[16679,3,4],[16777,2.5,4],[16876,2.5,4],[16975,2.5,4],[17073,2.5,3],[17172,2.5,3],[17271,2.5,3],[17369,2.5,3],[17468,2.5,2]],1),
  s(15889,18948,[[15889,1,2],[18948,0,2]]),t(18652,3,4,0),t(19047,0,5,0),f(19442,2,5),
  t(20231,0,5,0),t(20626,0,5,0),t(21810,0,5,0),t(22600,7,3,0),
  h(22994,3,1,24573,0,[[22994,3,1],[23389,2,2],[23784,2,3],[24178,1,4],[24573,1,5]]),t(23389,0,2,0),t(23784,0,5,0),t(24178,7,3,0),
  t(24968,0,5,0),t(25363,5,5,0),t(25757,2,5,1),t(26547,0,4,0),
  t(26942,2,5,0),t(27731,5,5,0),h(28521,2,5,29310,1),t(28915,0,5,0),
  t(30494,4,5,0),f(31284,2,5),t(31678,0,5,0),t(32468,0,4,0),
  h(32863,0,5,34145,0,[[32863,0,5],[33257,1,4],[33751,2,2],[34145,2,1]]),t(33257,2,5,0),t(33652,4,5,0),t(34441,2,5,0),
  t(34836,4,5,0),t(35231,3,4,0),t(35428,0,5,0),t(35626,3,3,0),
  t(36020,0,5,0),t(36415,2,5,0),t(36613,5,4,0),t(36810,5,5,0),
  t(37007,5,4,0),t(37205,1,8,0),t(37599,3,4,0),f(37994,4,5),
  t(38389,3,3,0),t(38784,0,5,0),t(38981,3,4,0),t(39178,4,5,0),
  t(39573,0,4,0),t(39573,7,3,0),t(39770,5,4,0),t(39968,2,5,0),
  t(40757,4,5,0),t(40955,5,5,0),t(41152,4,5,0),t(41349,2,5,0),
  t(41547,4,5,0),t(41941,2,5,0),t(42336,4,5,0),t(42731,5,5,0),
  t(42928,5,4,0),t(43126,2,5,0),f(43520,4,5),t(43915,2,5,0),
  t(44112,4,5,0),t(44310,6,4,0),t(44705,4,5,0),t(45297,3,4,0),
  t(45494,4,5,0),t(45889,2,5,0),t(46086,1,4,0),t(46283,2,5,0),
  t(46579,4,5,0),t(46876,1,4,0),t(47073,2,5,0),t(47862,5,4,0),
  t(48060,5,5,0),t(48257,6,4,0),t(48257,0,3,0),h(48652,4,1,49540,0,[[48652,4,1],[49145,2,5],[49540,4,1]]),
  f(49047,0,4),h(49836,0,5,50329),t(50428,3,4,0),t(50625,4,5,0),
  t(51020,6,4,2),t(51810,4,5,0),h(52204,3,4,52797,1),t(53586,1,4,0),
  s(54573,56152,[[54573,0.5,3],[54869,0,3],[55165,1.5,3],[55461,1.5,3],[55757,3,3],[56053,2.5,3],[56152,2,3]]),t(54968,2,5,0),t(55362,0,3,0),s(55560,56152,[[55560,1,2],[56152,0,2]]),
  t(56546,0,4,0),t(56941,0,5,0),t(57731,0,4,0),t(58125,0,5,0),
  h(58520,0,5,60000),t(60099,0,5,0),t(60494,2,5,0),f(60889,5,4),
  t(61283,5,5,0),t(62467,5,5,0),t(62862,4,5,0),t(63257,6,4,0),
  t(64046,5,4,0),t(64441,2,5,0),t(65231,4,5,0),h(65625,3,5,66316,0,[[65625,3,5],[66020,5,1],[66316,3,5]]),
  t(66415,5,4,0),t(66810,2,5,0),t(67599,4,5,0),t(67994,5,5,0),
  t(68388,5,4,0),t(69178,2,5,0),t(69573,2,8,0),t(69967,3,4,0),
  t(70362,1,4,0),f(70757,3,4),h(71152,4,5,71842),t(71941,0,4,3),
  t(72336,0,4,0),t(72336,7,3,0),t(72533,2,5,0),t(72730,4,5,0),
  t(72928,6,4,0),t(73125,4,5,0),t(73323,0,5,0),t(73520,3,4,0),
  t(73915,4,5,0),t(74112,6,4,0),t(74309,4,5,0),t(74507,3,4,0),
  t(74704,0,5,0),t(74902,3,4,0),t(75099,4,5,0),f(75494,7,3),
  t(76480,7,3,0),t(76776,5,3,0),h(77467,5,1,78651,1,[[77467,5,1],[77862,3,4],[78257,3,4],[78651,5,1]]),t(77961,1,4,0),
  t(79046,0,3,0),t(79836,0,4,0),t(80329,0,4,0),t(81217,1,4,0),
  t(82007,5,4,0),t(82204,4,1,0),t(82303,6,4,0),t(82994,3,3,0),
  t(83388,4,5,0),t(83586,5,5,0),h(83783,4,5,84178,1),t(84967,0,3,0),
  t(85362,0,5,0),t(85559,0,4,0),f(85757,1,4),t(86151,1,3,0),
  t(86151,7,3,0),t(86349,1,4,0),t(86546,0,4,0),t(87040,3,4,0),
  t(88125,5,4,0),t(88421,3,4,0),t(89112,0,5,0),t(89309,0,5,0),
  t(89507,0,5,0),t(89704,2,5,0),t(89901,1,3,0),t(90099,2,5,0),
  t(91086,0,5,0),t(91283,2,5,0),t(91678,4,5,0),f(92072,5,5),
  t(92664,3,4,0),t(92862,4,5,0),t(93059,3,4,0),t(93257,1,4,0),
  t(93651,2,5,0),t(94046,0,5,0),t(94243,0,5,0),t(94441,0,5,0),
  t(94835,0,5,0),t(95230,0,5,4),t(95822,0,4,0),t(96020,0,5,0),
  t(96217,0,5,0),t(96414,2,5,0),t(96809,4,5,0),t(97105,6,4,0),
  t(97105,0,3,0),t(97401,2,8,0),t(97599,2,5,0),f(97993,1,4),
  t(98388,0,5,0),t(98783,1,4,0),t(98881,2,5,0),t(98980,1,4,0),
  t(99178,0,5,0),t(99572,4,5,0),t(99967,3,4,0),t(100362,1,4,0),
  t(100756,0,5,0),t(101151,0,4,0),t(101349,0,5,0),t(101546,3,4,0),
  t(101941,0,5,0),s(102335,103914,[[102335,4,3],[102631,2.5,3],[102927,1,3],[103224,1,3],[103520,0.5,3],[103816,0,3],[103914,0,3]]),t(104112,0,3,0),t(104309,0,5,0),
  t(104506,1,4,0),f(104704,0,5),t(105296,3,4,0),t(105493,2,5,0),
  t(105888,4,5,0),t(106283,5,5,0),t(106875,5,4,0),t(107072,2,5,0),
  t(107270,5,4,0),t(107467,5,5,0),t(107664,3,4,0),t(107862,4,5,0),
  t(108454,3,4,0),t(108651,4,5,0),t(109046,6,4,0),t(109243,5,4,0),
  t(109441,0,5,0),t(110033,2,5,0),f(110230,4,5),t(110625,6,4,0),
  t(110625,0,3,0),t(110822,5,4,0),t(111019,2,5,0),t(111316,0,4,0),
  t(111612,3,4,0),t(111809,0,5,0),t(112204,4,5,0),t(112401,3,4,0),
  t(112598,5,5,0),t(113191,0,4,0),t(113388,0,5,0),t(113783,2,5,0),
  t(114177,4,5,0),t(114375,5,5,0),t(114572,5,4,0),t(114769,2,5,0),
  f(114967,2,5),t(115362,5,4,0),t(115559,4,5,0),t(115756,5,5,0),
  t(115954,6,4,0),t(116151,4,5,0),t(116546,2,5,0),t(116743,0,5,0),
  t(116940,0,4,0),t(117138,1,4,0),t(117335,3,3,0),t(117927,3,4,0),
  t(118125,0,5,0),t(118519,3,4,0),t(118914,0,5,0),t(119309,0,4,0),
  t(119506,1,4,0),t(119704,0,8,0),t(119901,1,4,0),t(120098,0,4,0),
  t(120098,7,3,0),f(120296,5,3),
// </dullahan-clockwork-v3-expert-notes>
])(mhTap,mhHoldV2,mhFlick,mhSlideV2);
const dullahanClockworkMasterNotes=((t,h,f,s)=>[
// <dullahan-clockwork-v3-master-notes>
  t(2073,0,6,0),t(2666,1,3,0),t(2666,6,3,0),f(2863,3,4),
  t(3258,5,4,0),t(3652,6,4,0),t(4244,5,4,0),t(4442,0,2,0),
  t(4442,4,2,0),t(4837,4,2,0),t(4837,8,2,0),t(5231,0,2,0),
  t(5231,4,2,0),t(5626,4,2,0),t(5626,8,2,0),t(5823,3,3,0),
  t(6021,5,4,0),t(6218,6,4,0),t(6416,5,3,0),t(6613,3,3,0),
  t(6810,1,4,0),t(7205,0,3,0),h(7402,1,3,7896),t(7994,0,4,0),
  t(8192,3,3,0),f(8389,0,4),t(8784,3,3,0),t(8981,0,3,0),
  t(9179,3,4,0),t(9968,1,3,0),t(10165,3,4,0),t(10363,5,3,0),
  t(10758,6,4,0),t(11152,5,3,0),t(11152,0,3,0),t(11350,3,4,0),
  t(11547,0,3,0),t(11942,1,4,0),t(12336,4,2,0),t(12534,5,3,0),
  t(12731,6,4,0),t(13521,5,3,0),f(13915,4,2),s(15889,17468,[[15889,3,2],[15988,3,2],[16086,3,2],[16185,3,2],[16284,3,2],[16382,4,3],[16481,4,3],[16580,4,3],[16679,3,3],[16777,2.5,3],[16876,2.5,3],[16975,2.5,3],[17073,2.5,2],[17172,2.5,2],[17271,2.5,2],[17369,2.5,2],[17468,2.5,2]],1),
  s(15889,18948,[[15889,0,2],[18948,1,2]]),t(18060,3,3,0),t(18652,3,3,0),t(19047,0,4,0),
  t(19442,1,4,0),t(20231,0,4,0),t(20626,1,4,0),t(21415,0,4,0),
  t(21810,1,4,0),h(22994,3,1,24573,1,[[22994,3,1],[23389,3,2],[23784,2,3],[24178,2,3],[24573,2,4]]),t(23389,6,4,0),t(23784,3,4,0),
  t(24178,6,2,0),t(24968,6,4,0),t(25165,6,2,0),f(25363,3,4),
  t(25757,0,4,1),t(26547,3,3,0),t(26942,6,4,0),t(27731,3,4,0),
  t(28126,0,4,0),h(28521,1,4,29310),t(28915,5,4,0),h(30099,6,4,30790,1),
  t(31284,3,4,0),t(31678,4,6,0),h(31777,0,2,33948),t(32468,7,3,0),
  h(32863,5,4,34145,0,[[32863,5,4],[33257,6,3],[33751,6,2],[34145,7,1]]),f(34441,5,4),t(34836,6,4,0),t(34836,1,3,0),
  t(35231,5,3,0),t(35428,5,4,0),t(35626,6,2,0),t(36020,5,4,0),
  t(36316,3,3,0),t(36415,5,4,0),t(36613,2,3,0),t(36613,7,3,0),
  t(36810,1,4,0),t(37007,0,3,0),t(37106,2,3,0),t(37205,0,4,0),
  t(37599,0,2,0),t(37599,4,2,0),t(37994,1,2,0),t(37994,5,2,0),
  t(38389,3,2,0),t(38389,7,2,0),t(38784,4,2,0),t(38784,8,2,0),
  t(38981,5,3,0),f(39178,5,4),t(39573,7,3,0),t(39672,5,4,0),
  t(39770,7,3,0),t(39968,3,4,0),t(40757,2,2,0),t(40757,6,2,0),
  t(40955,2,2,0),t(40955,7,2,0),t(41152,1,2,0),t(41152,7,2,0),
  t(41349,1,2,0),t(41349,8,2,0),t(41547,5,4,0),t(41941,3,4,0),
  t(42336,1,4,0),t(42731,0,4,0),t(42928,0,3,0),t(42928,5,3,0),
  t(43126,0,4,0),f(43520,0,4),t(43915,1,4,0),t(44112,3,4,0),
  t(44310,5,3,0),t(44705,6,4,0),t(45001,3,4,0),t(45297,5,3,0),
  t(45494,6,4,0),t(45889,5,4,0),t(46086,3,3,0),t(46283,5,4,0),
  t(46579,3,4,0),t(46777,1,4,0),t(46876,3,3,0),t(47073,1,4,0),
  t(47468,3,4,0),t(47862,5,3,0),t(48060,1,4,0),t(48060,7,3,0),
  f(48257,3,3),h(48652,7,1,49540,0,[[48652,7,1],[49145,5,4],[49540,7,1]]),t(49047,7,3,2),t(49639,4,2,0),
  h(49836,5,4,50329),t(50428,7,3,0),t(50625,5,4,0),t(51020,3,3,0),
  t(51810,0,6,0),h(52204,0,4,52797,1,[[52204,0,4],[52500,1,1],[52797,0,4]]),t(53586,3,3,0),t(53783,0,2,0),
  s(54573,56152,[[54573,3,3],[54770,2.5,3],[54869,1.5,3],[55066,3,2],[55461,3.5,2],[55560,2,2],[56152,2.5,2]],1),t(54968,6,4,0),t(55362,4,2,0),s(55560,56152,[[55560,3,2],[56152,4,2]]),
  t(56546,0,3,0),f(56941,0,4),t(57336,2,2,0),t(57731,1,3,0),
  t(58125,3,4,0),h(58520,3,4,60000),t(60099,1,4,0),t(60494,3,4,0),
  t(61283,5,4,0),h(62073,6,4,62566),t(62862,3,4,0),t(63257,5,3,0),
  t(64046,7,3,0),t(64441,5,4,0),t(64441,0,3,0),t(65231,3,4,0),
  h(65625,1,3,66316),t(66415,0,3,0),t(66810,1,4,0),f(67204,0,3),
  t(67599,1,4,0),t(67994,0,4,0),t(68388,1,3,0),t(69178,0,2,0),
  t(69178,4,2,0),t(69573,4,2,0),t(69573,8,2,0),t(69967,0,2,0),
  t(69967,4,2,0),t(70362,4,2,0),t(70362,8,2,0),t(70757,0,3,0),
  h(71152,1,4,71842),t(71941,3,3,3),t(72336,0,2,0),t(72336,4,2,0),
  t(72533,1,2,0),t(72533,5,2,0),t(72730,3,2,0),t(72730,7,2,0),
  t(72928,4,2,0),t(72928,8,2,0),t(73125,6,4,0),t(73323,3,4,0),
  f(73520,5,3),t(73915,6,4,0),t(74112,5,3,0),t(74309,6,4,0),
  t(74309,1,3,0),t(74507,3,3,0),t(74704,5,4,0),t(74902,1,3,0),
  t(75099,0,4,0),t(75494,2,2,0),s(75790,77270,[[75790,2.5,2],[76086,1,2],[76382,0,2],[76678,1,2],[76974,2.5,2],[77270,4,2]]),s(76382,76875,[[76382,3,2],[76875,4,2]]),
  h(77467,6,1,78651,1,[[77467,6,1],[77862,6,2],[78257,5,3],[78651,5,4]]),t(77961,3,3,0),t(79046,0,2,0),f(79836,0,3),
  t(80329,0,3,0),t(81217,0,3,0),t(81908,1,3,0),t(82007,0,3,0),
  t(82204,2,1,0),t(82303,5,3,0),t(82895,7,3,0),t(82994,6,2,0),
  t(83388,4,6,0),t(83586,3,4,0),h(83783,6,4,84178,1),t(84671,0,3,0),
  t(84671,5,3,0),t(84967,2,2,0),t(85362,3,4,0),t(85559,5,3,0),
  f(85757,7,3),t(86151,6,2,0),t(86349,3,3,0),t(86546,5,3,0),
  t(87040,7,3,0),t(88026,5,3,0),t(88125,7,3,0),t(88421,5,3,0),
  t(89112,6,4,0),t(89309,6,4,0),t(89507,5,4,0),t(89704,6,4,0),
  t(89901,6,2,0),t(90099,3,4,0),t(90493,5,4,0),t(91086,6,4,0),
  t(91283,5,4,0),t(91678,6,4,0),f(92072,5,4),t(92664,3,3,0),
  t(92862,1,4,0),t(92862,7,3,0),t(93059,3,3,0),t(93257,1,3,0),
  t(93651,3,4,0),t(94046,5,4,0),t(94243,5,4,0),t(94441,5,4,0),
  t(94835,6,4,0),t(95230,6,4,0),t(95526,7,3,0),t(95822,7,3,0),
  t(96020,6,4,0),t(96217,6,4,0),f(96414,5,4),t(96809,3,4,0),
  t(97007,1,4,0),t(97105,3,3,0),t(97401,1,4,0),t(97599,3,4,0),
  t(97993,1,3,4),t(98388,0,4,0),t(98684,2,4,0),t(98783,0,3,0),
  t(98881,2,4,0),t(98980,1,3,0),t(99178,1,4,0),t(99178,7,3,0),
  t(99572,1,4,0),t(99967,3,3,0),t(100362,1,3,0),t(100756,0,4,0),
  t(101151,1,3,0),t(101349,3,4,0),f(101546,5,3),t(101941,2,6,0),
  s(102335,103914,[[102335,4,2],[102631,2.5,2],[102927,1,2],[103224,1,2],[103520,0.5,2],[103816,0,2],[103914,0,2]]),t(104112,4,2,0),t(104210,2,3,0),t(104309,3,4,0),
  t(104408,1,3,0),t(104506,0,3,0),t(104704,0,4,0),t(105296,0,3,0),
  t(105493,0,4,0),t(105888,0,4,0),t(106283,0,4,0),t(106875,1,3,0),
  t(107072,1,4,0),t(107270,5,3,0),t(107467,3,4,0),t(107664,1,3,0),
  t(107664,6,3,0),f(107862,0,4),t(108454,3,3,0),t(108651,1,4,0),
  t(109046,0,3,0),t(109243,1,3,0),t(109441,0,4,0),t(109737,1,3,0),
  t(110033,3,4,0),t(110230,5,4,0),t(110625,1,3,0),t(110822,3,3,0),
  t(111019,5,4,0),t(111316,7,3,0),t(111612,5,3,0),t(111809,1,4,0),
  t(112006,4,2,0),t(112204,0,4,0),t(112401,0,3,0),t(112598,1,4,0),
  t(112894,3,3,0),t(113191,1,3,0),f(113388,0,4),t(113783,1,4,0),
  t(114177,1,4,0),t(114177,7,3,0),t(114375,5,4,0),t(114572,7,3,0),
  t(114769,6,4,0),t(114967,6,4,0),t(115362,7,3,0),t(115559,5,4,0),
  t(115756,5,4,0),t(115954,7,3,0),f(116151,6,4),t(116546,1,4,0),
  t(116743,5,4,0),t(116940,3,3,0),t(117138,7,3,0),t(117335,6,2,0),
  t(117533,7,3,0),t(117631,5,3,0),t(117927,7,3,0),t(118125,1,4,0),
  t(118519,3,3,0),t(118914,5,4,0),t(119309,7,3,0),t(119506,7,3,0),
  t(119704,4,6,0),t(119901,3,3,0),t(120098,1,3,0),t(120098,6,3,0),
  f(120296,0,2),
// </dullahan-clockwork-v3-master-notes>
])(mhTap,mhHoldV2,mhFlick,mhSlideV2);
const dullahanCharts=Object.freeze({
  EASY:mhChart(1,dullahanEasyNotes,DULLAHAN_DURATION_MS),
  NORMAL:mhChart(3,dullahanNormalNotes,DULLAHAN_DURATION_MS),
  HARD:mhChart(5,dullahanHardNotes,DULLAHAN_DURATION_MS),
  EXPERT:mhChart(7,dullahanExpertNotes,DULLAHAN_DURATION_MS),
  MASTER:mhChart(9,dullahanMasterNotes,DULLAHAN_DURATION_MS),
});
const dullahanClockworkCharts=Object.freeze({
  EASY:mhChart(1,dullahanClockworkEasyNotes,DULLAHAN_CLOCKWORK_DURATION_MS),
  NORMAL:mhChart(3,dullahanClockworkNormalNotes,DULLAHAN_CLOCKWORK_DURATION_MS),
  HARD:mhChart(5,dullahanClockworkHardNotes,DULLAHAN_CLOCKWORK_DURATION_MS),
  EXPERT:mhChart(7,dullahanClockworkExpertNotes,DULLAHAN_CLOCKWORK_DURATION_MS),
  MASTER:mhChart(9,dullahanClockworkMasterNotes,DULLAHAN_CLOCKWORK_DURATION_MS),
});

const torikoCharts=Object.freeze({
  EASY:mhChart(1,torikoEasyNotes,TORIKO_DURATION_MS),
  NORMAL:mhChart(3,torikoNormalNotes,TORIKO_DURATION_MS),
  HARD:mhChart(5,torikoHardNotes,TORIKO_DURATION_MS),
  EXPERT:mhChart(7,torikoExpertNotes,TORIKO_DURATION_MS),
  MASTER:mhChart(9,torikoMasterNotes,TORIKO_DURATION_MS),
});

const fourUCharts=Object.freeze({
  EASY:mhChart(1,fourUEasyNotes,FOUR_U_DURATION_MS),
  NORMAL:mhChart(3,fourUNormalNotes,FOUR_U_DURATION_MS),
  HARD:mhChart(5,fourUHardNotes,FOUR_U_DURATION_MS),
  EXPERT:mhChart(7,fourUExpertNotes,FOUR_U_DURATION_MS),
  MASTER:mhChart(9,fourUMasterNotes,FOUR_U_DURATION_MS),
});

const kindanNoResistanceCharts=Object.freeze({
  EASY:mhChart(1,kindanNoResistanceEasyNotes,KINDAN_NO_RESISTANCE_DURATION_MS),
  NORMAL:mhChart(3,kindanNoResistanceNormalNotes,KINDAN_NO_RESISTANCE_DURATION_MS),
  HARD:mhChart(5,kindanNoResistanceHardNotes,KINDAN_NO_RESISTANCE_DURATION_MS),
  EXPERT:mhChart(7,kindanNoResistanceExpertNotes,KINDAN_NO_RESISTANCE_DURATION_MS),
  MASTER:mhChart(9,kindanNoResistanceMasterNotes,KINDAN_NO_RESISTANCE_DURATION_MS),
});

const crossingFieldCharts=Object.freeze({
  EASY:mhChart(1,crossingFieldEasyNotes,CROSSING_FIELD_DURATION_MS),
  NORMAL:mhChart(3,crossingFieldNormalNotes,CROSSING_FIELD_DURATION_MS),
  HARD:mhChart(5,crossingFieldHardNotes,CROSSING_FIELD_DURATION_MS),
  EXPERT:mhChart(7,crossingFieldExpertNotes,CROSSING_FIELD_DURATION_MS),
  MASTER:mhChart(9,crossingFieldMasterNotes,CROSSING_FIELD_DURATION_MS),
});

const nothingWithoutYouCharts=Object.freeze({
  EASY:mhChart(1,nothingWithoutYouEasyNotes,NOTHING_WITHOUT_YOU_DURATION_MS),
  NORMAL:mhChart(3,nothingWithoutYouNormalNotes,NOTHING_WITHOUT_YOU_DURATION_MS),
  HARD:mhChart(5,nothingWithoutYouHardNotes,NOTHING_WITHOUT_YOU_DURATION_MS),
  EXPERT:mhChart(7,nothingWithoutYouExpertNotes,NOTHING_WITHOUT_YOU_DURATION_MS),
  MASTER:mhChart(9,nothingWithoutYouMasterNotes,NOTHING_WITHOUT_YOU_DURATION_MS),
});

const closeToYourHeartCharts=Object.freeze({
  EASY:mhChart(1,closeToYourHeartEasyNotes,CLOSE_TO_YOUR_HEART_DURATION_MS),
  NORMAL:mhChart(3,closeToYourHeartNormalNotes,CLOSE_TO_YOUR_HEART_DURATION_MS),
  HARD:mhChart(5,closeToYourHeartHardNotes,CLOSE_TO_YOUR_HEART_DURATION_MS),
  EXPERT:mhChart(7,closeToYourHeartExpertNotes,CLOSE_TO_YOUR_HEART_DURATION_MS),
  MASTER:mhChart(9,closeToYourHeartMasterNotes,CLOSE_TO_YOUR_HEART_DURATION_MS),
});

const kazeGaSoyoguCharts=Object.freeze({
  EASY:mhChart(1,kazeGaSoyoguEasyNotes,KAZE_GA_SOYOGU_DURATION_MS),
  NORMAL:mhChart(3,kazeGaSoyoguNormalNotes,KAZE_GA_SOYOGU_DURATION_MS),
  HARD:mhChart(5,kazeGaSoyoguHardNotes,KAZE_GA_SOYOGU_DURATION_MS),
  EXPERT:mhChart(7,kazeGaSoyoguExpertNotes,KAZE_GA_SOYOGU_DURATION_MS),
  MASTER:mhChart(9,kazeGaSoyoguMasterNotes,KAZE_GA_SOYOGU_DURATION_MS),
});


// Monster Hero -Another-。本編BGMに既にある別テイクをそのまま使う。
// 音源を複製せず、V3がこの音源そのものを解析して作った譜面。
const MONSTER_HERO_ANOTHER_DURATION_MS=154720;
const monsterHeroAnotherEasyNotes=((t,h,f,s)=>[
// <monster-hero-theme-alt-v3-easy-notes>
  t(2320,1,4,0),t(3372,0,4,0),h(3723,1,3,4512,0,[[3723,1,3],[4161,0,4],[4512,0,6]]),t(4775,1,4,0),
  t(5652,3,4,0),t(5827,5,4,0),t(7756,6,4,0),t(10035,5,4,0),
  t(11438,3,4,0),t(11789,5,4,0),t(12139,6,4,0),t(13717,5,4,0),
  t(13893,5,4,0),t(14769,0,10,0),t(16172,4,6,0),t(16873,3,4,0),
  t(17399,0,6,0),t(18802,3,4,0),t(20205,1,4,0),t(20906,3,4,0),
  t(21608,5,4,0),t(22309,2,6,0),t(23361,4,6,0),t(23712,4,6,0),
  t(25114,5,4,0),t(25465,5,4,0),t(26517,3,4,0),t(27043,3,4,0),
  t(28621,0,6,0),t(28972,1,4,0),t(30024,3,4,0),t(31427,1,4,0),
  t(31777,0,4,0),t(32128,0,6,0),t(32829,0,4,1),t(34232,0,6,0),
  t(34583,2,6,0),h(34933,4,6,35985),t(36336,2,6,0),t(37037,5,4,0),
  t(37739,6,4,0),t(38265,5,4,0),t(39142,3,4,0),h(39843,4,6,40544),
  t(41246,3,4,0),h(41772,3,4,42298),t(43174,0,6,0),h(43876,2,6,44314),
  h(44577,5,4,45454),h(45804,6,4,46769),t(46856,5,4,0),t(47558,2,6,0),
  t(47908,4,6,0),t(48259,0,3,0),t(48259,7,3,0),t(48961,5,4,0),
  t(49662,0,10,0),t(50013,1,4,0),t(50539,0,4,0),t(50714,0,6,0),
  t(51065,0,4,0),t(52117,0,4,0),t(52467,1,4,0),t(52818,3,4,0),
  t(53169,1,4,0),t(53519,2,6,0),t(53870,0,6,0),t(54571,3,4,0),
  t(55097,0,6,0),t(55974,0,4,0),t(56325,0,6,0),t(56675,2,6,0),
  t(57903,0,6,0),t(58253,2,6,0),t(58779,5,4,0),t(59481,6,4,0),
  t(60182,5,4,0),t(60358,3,4,0),t(60708,1,4,0),t(61585,3,4,0),
  t(61936,0,6,0),t(62286,0,4,0),t(62988,1,4,2),t(63689,0,4,0),
  t(64040,1,4,0),t(64390,0,4,0),t(65092,1,4,0),t(65442,0,6,0),
  t(65793,0,3,0),t(65793,7,3,0),t(66319,0,4,0),t(66670,5,4,0),
  t(67196,3,4,0),t(67546,0,6,0),t(67897,0,4,0),t(68598,1,4,0),
  t(68774,2,6,0),t(69475,0,10,0),t(70001,6,4,0),t(70703,3,4,0),
  t(71053,5,4,0),t(71579,3,4,0),t(71930,4,6,0),t(72105,4,6,0),
  h(72982,4,6,73859,0,[[72982,4,6],[73245,6,4],[73596,6,4],[73859,7,3]]),t(74034,1,4,0),t(74385,3,4,0),t(74911,5,4,0),
  t(75612,6,4,0),t(76313,5,4,0),t(76839,2,6,0),t(77541,0,6,0),
  t(78417,5,4,0),t(79119,3,4,0),t(79469,1,4,0),t(79820,0,6,0),
  t(81574,1,4,0),t(81924,3,4,0),t(82275,5,4,0),h(82976,4,6,83853),
  t(84028,6,4,0),t(85080,4,6,0),t(85431,4,6,0),h(87886,7,3,88587,0,[[87886,7,3],[88236,4,6],[88587,7,3]]),
  t(89288,7,3,0),t(89288,0,3,0),t(89814,6,4,0),t(90165,5,4,0),
  t(90341,6,4,0),t(91568,6,4,0),t(91919,5,4,0),t(92620,3,4,0),
  t(93146,1,4,3),t(93847,0,4,0),t(94724,3,4,0),t(95250,5,4,0),
  t(95425,3,4,0),t(96302,5,4,0),t(97354,6,4,0),t(97529,5,4,0),
  t(98055,6,4,0),t(98231,5,4,0),t(98757,3,4,0),t(99809,1,4,0),
  t(99984,3,4,0),t(100335,5,4,0),t(101212,5,4,0),t(101387,6,4,0),
  t(101738,0,10,0),t(104017,6,4,0),t(104718,5,4,0),t(105069,3,4,0),
  t(106121,1,4,0),t(107173,0,3,0),t(107173,7,3,0),t(107699,1,3,0),
  t(107874,3,4,0),h(108225,0,6,109365,0,[[108225,0,6],[108576,1,4],[109014,1,4],[109365,0,6]]),t(110855,3,4,0),t(111907,5,4,0),
  t(113135,2,6,0),t(113661,4,6,0),t(113836,6,4,0),t(115589,4,6,0),
  t(115765,6,4,0),t(116466,5,4,0),t(116817,6,4,0),t(117167,5,3,0),
  t(117869,3,4,0),t(118570,5,4,0),t(119096,2,6,0),t(119447,0,6,0),
  t(119973,2,6,0),t(120849,4,6,0),t(121376,6,4,0),t(121551,4,6,0),
  t(122077,6,4,0),t(122428,5,4,0),t(122603,2,6,0),t(123129,1,4,0),
  t(123304,3,4,0),t(123830,3,4,0),t(124006,1,4,0),t(124707,0,4,4),
  t(125584,1,4,0),t(125759,0,4,0),t(126110,0,10,0),t(126460,0,4,0),
  t(126811,1,4,0),t(127162,1,4,0),t(128038,2,6,0),t(128564,0,6,0),
  t(128740,0,4,0),t(129266,0,3,0),t(129266,7,3,0),t(129616,1,4,0),
  t(130318,0,4,0),t(130493,0,6,0),h(131545,0,4,132597),t(133123,2,6,0),
  t(133474,4,6,0),t(133649,3,4,0),t(134701,4,6,0),t(134877,5,4,0),
  t(135753,2,6,0),t(135929,5,4,0),t(136455,6,4,0),t(137682,5,4,0),
  h(138559,2,6,139961),t(140137,3,4,0),t(140663,1,4,0),t(140838,0,4,0),
  h(141890,2,3,143293,0,[[141890,2,3],[142241,0,6],[142592,2,3],[142942,0,6],[143293,2,3]]),t(144871,0,4,0),t(145222,1,4,0),t(145397,0,4,0),
  t(146098,1,4,0),t(146274,3,4,0),t(146800,5,4,0),t(147676,6,4,0),
  t(149430,3,4,0),t(149605,5,4,0),t(149956,6,4,0),t(150306,5,4,0),
  t(150657,0,6,0),t(151183,2,6,0),t(151709,4,6,0),t(152235,0,10,0),
  t(153463,7,3,0),t(153463,0,3,0),
// </monster-hero-theme-alt-v3-easy-notes>
])(mhTap,mhHoldV2,mhFlick,mhSlideV2);
const monsterHeroAnotherNormalNotes=((t,h,f,s)=>[
// <monster-hero-theme-alt-v3-normal-notes>
  f(2320,1,3),t(3197,3,4,0),t(3372,5,4,0),h(3723,2,2,4512,0,[[3723,2,2],[4161,1,4],[4512,0,6]]),
  t(4775,0,4,0),t(5652,1,3,0),t(5827,5,3,0),t(7756,7,3,0),
  t(10035,5,4,0),t(10737,6,4,0),t(11789,5,4,0),t(12139,5,4,0),
  t(13717,3,4,0),t(13893,5,4,0),t(14769,0,10,0),t(16172,2,6,0),
  t(16873,5,4,0),t(17399,4,6,0),t(18802,0,4,0),t(19504,1,4,0),
  t(20205,3,4,0),f(20906,5,4),t(21608,6,4,0),t(22309,4,6,0),
  t(23361,2,6,0),t(23712,4,6,0),t(25114,5,4,0),h(25465,6,4,25991,1),
  t(26517,5,4,0),t(27043,5,4,0),t(28621,0,6,0),t(28972,5,4,0),
  t(29323,3,4,0),t(30024,6,4,0),t(31427,5,4,0),t(31777,3,4,0),
  h(32128,4,6,32654),t(32829,3,4,1),t(34232,0,6,0),f(34583,4,6),
  h(34933,0,6,35985),t(36336,0,6,0),t(37037,1,4,0),t(37739,3,4,0),
  t(37914,4,6,0),t(38265,6,4,0),t(39142,5,3,0),h(39843,4,6,40544),
  t(41246,6,4,0),h(41772,6,4,42298),t(43174,2,6,0),h(43876,4,6,44314),
  h(44577,7,3,45454),h(45804,4,6,46769,0,[[45804,4,6],[46155,5,4],[46418,6,3],[46769,6,2]]),t(47558,0,6,0),t(47908,4,6,0),
  t(48259,0,3,0),t(48259,7,3,0),t(48610,7,3,0),t(48610,0,3,0),
  t(48961,5,4,0),f(49136,6,4),t(49662,4,6,0),t(50013,6,4,0),
  t(50539,5,3,0),t(50714,0,10,0),t(51065,3,4,0),t(52117,1,3,0),
  t(52467,3,4,0),t(52818,5,3,0),t(53169,3,4,0),t(53519,4,6,0),
  t(53870,4,6,0),t(54571,3,4,0),t(54747,1,4,0),t(54922,0,3,0),
  t(55974,0,4,0),t(56325,2,6,0),t(56675,4,6,0),t(57903,4,6,0),
  f(58779,5,4),t(59130,2,6,0),t(59481,5,4,0),t(60182,3,4,0),
  t(60358,1,4,0),t(60708,3,4,0),t(61585,7,3,0),t(61585,0,3,0),
  t(61936,0,6,0),t(62286,3,4,0),t(62637,0,3,2),t(62988,0,4,0),
  t(63689,1,4,0),t(64040,3,4,0),t(64390,5,4,0),t(64566,6,4,0),
  t(65092,5,4,0),t(65442,4,6,0),t(65793,5,4,0),t(66319,6,4,0),
  f(66670,5,4),t(67196,3,4,0),t(67546,0,6,0),t(67897,0,4,0),
  t(68248,0,6,0),t(68774,0,6,0),t(69475,0,6,0),t(70001,3,4,0),
  t(70177,6,4,0),t(70703,0,4,0),t(71053,0,3,0),t(71053,7,3,0),
  t(71579,3,4,0),t(71930,0,10,0),t(72105,4,6,0),t(72982,5,4,0),
  h(73157,7,3,73859),t(74034,0,4,0),t(74385,1,4,0),t(74911,3,4,0),
  f(75612,5,4),t(76313,6,4,0),t(76839,4,6,0),t(77541,2,6,0),
  t(77891,1,4,0),t(78417,0,4,0),t(79119,3,4,0),t(79469,1,4,0),
  t(79820,4,6,0),t(80872,0,6,0),t(81574,1,4,0),t(81924,3,4,0),
  t(82275,5,4,0),h(82976,6,2,83853,0,[[82976,6,2],[83239,5,4],[83590,5,4],[83853,6,2]]),t(84028,5,4,0),t(85080,2,6,0),
  t(85431,0,6,0),h(86132,0,6,86746),h(87886,1,4,88587,1),f(89288,0,4),
  t(89814,1,4,0),t(90165,0,4,0),t(90341,1,4,0),t(91568,0,4,0),
  t(91919,3,4,0),t(92620,1,4,0),t(93146,5,4,3),t(93847,3,4,0),
  t(94724,1,4,0),t(95250,1,4,0),t(95425,1,4,0),t(96302,0,3,0),
  t(97354,3,3,0),t(97529,1,4,0),t(98055,3,3,0),t(98231,1,4,0),
  t(98757,0,4,0),t(99809,1,3,0),f(99984,3,4),t(100335,1,4,0),
  t(100686,3,4,0),t(101212,3,3,0),t(101387,7,3,0),t(101738,0,10,0),
  t(104017,6,4,0),t(104718,3,4,0),t(105069,0,4,0),t(106121,0,3,0),
  t(106121,7,3,0),t(106998,6,2,0),t(107173,3,4,0),t(107699,2,2,0),
  t(107874,0,4,0),t(108926,0,4,0),t(110855,0,4,0),t(111907,0,4,0),
  t(113135,2,6,0),t(113661,4,6,0),f(113836,1,3),t(115589,0,6,0),
  t(115765,1,4,0),t(116466,0,3,0),t(116817,1,4,0),t(117167,4,2,0),
  t(117869,1,3,0),t(118570,3,3,0),t(119096,0,6,0),t(119447,0,6,0),
  t(119973,0,6,0),t(120674,0,3,0),t(120849,0,6,0),t(121376,3,3,0),
  t(121551,4,6,0),t(121726,3,4,0),t(122077,5,3,0),t(122428,6,4,0),
  f(122603,4,6),t(123129,3,4,0),t(123304,5,4,0),t(123480,1,3,0),
  t(123830,0,4,0),t(124006,1,4,0),t(124532,0,3,0),t(124707,1,4,0),
  t(125584,5,3,0),t(125759,3,3,0),t(125934,1,4,0),t(126460,0,4,4),
  t(126811,1,4,0),t(127162,0,3,0),t(127512,1,4,0),t(128038,0,10,0),
  t(128564,0,6,0),t(128740,1,4,0),t(128915,0,4,0),t(129266,1,4,0),
  f(129616,5,4),t(129967,1,3,0),t(130318,0,3,0),t(130318,7,3,0),
  t(130493,0,6,0),t(130668,0,6,0),h(131545,0,6,132597,0,[[131545,0,6],[131896,1,3],[132247,1,3],[132597,0,6]]),t(133123,0,6,0),
  t(133474,0,6,0),t(133649,1,4,0),t(134000,1,4,0),t(134701,2,6,0),
  t(134877,6,4,0),t(135753,4,6,0),t(135929,6,4,0),t(136455,5,4,0),
  t(136805,7,3,0),t(137682,5,4,0),h(138559,2,6,139961),f(140137,7,3),
  t(140663,3,4,0),t(140838,0,4,0),h(141890,2,2,143293,1,[[141890,2,2],[142241,0,6],[142592,2,2],[142942,0,6],[143293,2,2]]),t(143819,3,4,0),
  t(144871,1,4,0),t(145222,3,4,0),t(145397,5,4,0),t(146098,6,4,0),
  t(146274,3,3,0),t(146800,7,3,0),t(147676,5,4,0),t(149430,3,4,0),
  t(149605,5,3,0),t(149956,7,3,0),t(149956,0,3,0),t(150306,7,3,0),
  t(150306,0,3,0),t(150657,4,6,0),t(151183,4,6,0),t(151709,2,6,0),
  t(152235,0,10,0),f(153463,0,3),
// </monster-hero-theme-alt-v3-normal-notes>
])(mhTap,mhHoldV2,mhFlick,mhSlideV2);
const monsterHeroAnotherHardNotes=((t,h,f,s)=>[
// <monster-hero-theme-alt-v3-hard-notes>
  f(2320,5,3),t(3197,3,4,0),t(3372,6,4,0),t(3723,3,3,0),
  t(4424,6,4,0),t(4775,3,4,0),t(5652,1,3,0),t(5827,3,3,0),
  t(6265,1,3,0),t(7142,0,8,0),t(7756,1,3,0),h(9597,5,1,10298,1,[[9597,5,1],[9948,4,3],[10298,3,5]]),
  t(11438,3,3,0),t(11789,5,4,0),t(12139,1,4,0),t(13717,0,4,0),
  t(13805,3,4,0),t(14156,5,3,0),t(14769,4,5,0),t(16172,5,5,0),
  t(16435,4,5,0),t(17136,2,5,0),f(17399,4,5),t(18452,3,4,0),
  t(18802,5,4,0),t(19504,3,4,0),t(20205,5,4,0),t(20906,3,4,0),
  t(21608,5,4,0),t(22309,2,5,0),t(23010,5,4,0),t(23361,2,5,0),
  t(23712,2,5,0),t(24062,5,4,0),t(24413,5,4,0),t(25114,6,4,0),
  h(25465,6,4,25991),t(26517,3,4,0),t(27043,5,4,0),t(27394,3,4,0),
  t(28621,4,5,0),t(28972,3,4,0),f(29323,1,4),h(29673,0,4,30287),
  t(31427,3,4,0),t(31777,1,4,0),t(32128,2,5,0),t(32829,1,4,1),
  t(33180,0,4,0),t(34232,0,5,0),t(34583,4,5,0),h(34933,0,5,35985),
  t(36336,0,5,0),t(36511,3,4,0),t(37037,6,4,0),t(37739,3,4,0),
  t(37914,0,5,0),t(38265,3,4,0),t(38616,1,4,0),t(39142,5,3,0),
  t(39843,2,5,0),t(40194,7,3,0),f(41246,5,4),t(41772,3,4,0),
  t(42298,0,5,0),t(43174,0,5,0),t(43350,1,4,0),h(43876,2,5,44314),
  s(44577,45454,[[44577,3.5,3],[44840,2.5,3],[45103,1,3],[45366,0.5,3],[45454,0.5,3]]),h(45804,3,4,46769),t(46856,0,4,0),t(47207,3,4,0),
  t(47558,2,8,0),t(47908,0,5,0),t(48259,0,4,0),t(48259,7,3,0),
  t(48610,6,4,0),t(48610,0,3,0),t(48961,3,4,0),t(49136,0,4,0),
  t(49487,3,4,0),t(49662,4,5,0),t(50013,3,4,0),f(50188,0,5),
  t(50539,0,3,0),t(50714,0,5,0),t(51065,3,4,0),t(51415,5,3,0),
  t(51766,3,3,0),h(52117,0,5,52818,0,[[52117,0,5],[52467,1,3],[52818,2,1]]),t(53169,0,4,0),t(53344,1,4,0),
  t(53519,2,5,0),t(53870,4,5,0),t(54221,3,3,0),t(54571,1,4,0),
  t(54747,3,4,0),t(54922,5,3,0),t(55097,5,5,0),h(55974,3,4,56325,1),
  t(56675,5,5,0),t(57903,0,5,0),t(58253,2,5,0),t(58779,6,4,0),
  f(59130,2,5),t(59481,0,4,0),t(59481,7,3,0),t(59656,3,4,0),
  t(60182,6,4,0),t(60358,3,4,0),t(60708,6,4,0),t(61059,3,4,0),
  t(61585,7,3,0),t(61936,2,5,0),t(62286,6,4,2),t(62637,0,3,0),
  t(62812,3,3,0),t(62988,1,4,0),t(63163,5,4,0),t(63338,3,3,0),
  t(63689,6,4,0),t(64040,1,4,0),t(64390,3,4,0),t(64566,5,4,0),
  f(65092,6,4),t(65442,2,8,0),t(65793,3,4,0),t(65968,0,4,0),
  t(66319,3,4,0),t(66670,6,4,0),t(66845,3,3,0),t(67196,0,4,0),
  t(67371,3,4,0),t(67546,4,5,0),t(67897,0,4,0),t(67897,7,3,0),
  t(68248,0,5,0),t(68598,0,4,0),h(68774,0,5,69212),t(69475,2,5,0),
  t(70001,1,4,0),t(70177,3,4,0),t(70703,0,4,0),t(71053,1,3,0),
  t(71229,3,4,0),t(71404,5,3,0),f(71579,6,4),t(71930,4,5,0),
  t(72105,2,5,0),t(72982,5,4,0),t(73070,2,5,0),t(73508,0,5,0),
  t(74034,0,4,0),t(74385,1,4,0),t(74911,0,4,0),t(75086,1,4,0),
  t(75437,0,4,0),t(75612,0,4,0),t(76313,1,4,0),t(76839,0,5,0),
  t(77541,0,5,0),t(77891,1,4,0),t(78067,3,4,0),t(78417,6,4,0),
  t(78417,0,3,0),t(79119,6,4,0),t(79206,5,4,0),f(79469,6,4),
  t(79820,4,5,0),t(80872,5,5,0),t(81223,5,4,0),t(81574,3,4,0),
  t(81924,1,4,0),t(82275,0,4,0),t(82626,1,4,0),h(82976,4,1,83853,0,[[82976,4,1],[83239,3,4],[83590,3,4],[83853,4,1]]),
  t(84028,1,4,0),t(84116,4,5,0),t(85080,5,5,0),t(85431,2,5,0),
  t(86132,0,5,3),h(87272,0,5,87710),h(87886,1,4,88587),t(88762,3,4,0),
  t(89201,2,8,0),f(89288,6,4),t(90165,5,4,0),t(90341,6,4,0),
  s(90604,91568,[[90604,3,4],[90779,2,3],[90867,2,3],[90954,3,3],[91130,3.5,2],[91217,3.5,3],[91393,4,3],[91568,4,4]]),t(91831,3,4,0),t(91919,1,4,0),t(92532,0,4,0),
  t(92532,7,3,0),t(93058,1,5,0),t(93146,0,4,0),h(93760,1,5,94724,1,[[93760,1,5],[94110,2,2],[94373,2,2],[94724,1,5]]),
  h(95162,5,4,95513),h(95864,2,5,96214),t(96302,1,3,0),t(96565,0,4,0),
  t(96740,3,4,0),t(97091,5,4,0),t(97354,1,3,0),t(97968,1,4,0),
  t(98055,0,3,0),t(98669,1,5,0),f(98757,0,4),s(99546,100335,[[99546,1,4],[99633,1,3],[99721,1,3],[99809,0,3],[99896,0,2],[99984,0,2],[100072,0,3],[100159,0,3],[100247,0,3],[100335,0,4]]),
  t(101212,5,3,0),t(101387,7,3,0),t(101475,4,5,0),t(101738,5,5,0),
  t(102527,0,5,0),t(103228,3,4,0),t(103579,5,4,0),t(104017,6,4,0),
  t(104718,5,4,0),t(104981,2,5,0),t(105069,1,4,0),t(105332,0,5,0),
  t(106033,1,5,0),t(106121,1,3,0),t(106384,0,5,0),t(106735,0,4,0),
  t(106735,7,3,0),h(107085,2,5,107611),t(107874,1,4,0),t(108137,3,4,0),
  s(108225,109365,[[108225,3,4],[108313,3,4],[108400,3,4],[108488,3,4],[108576,3,3],[108663,4,3],[108751,4,3],[108839,4,3],[108926,4,3],[109014,4,3],[109102,4,2],[109189,4,2],[109277,4,2],[109365,4,2]]),f(109540,3,4),t(109891,0,4,0),t(110241,3,4,0),
  t(110417,5,5,0),t(110592,3,4,0),t(110855,0,4,0),t(111118,0,4,0),
  h(111294,2,1,112521,1,[[111294,2,1],[111644,0,5],[111907,2,1],[112258,0,5],[112521,2,1]]),t(113135,0,5,0),t(113573,1,4,0),t(113661,2,5,0),
  t(113836,5,3,0),t(114099,1,8,0),t(114450,7,3,0),t(115589,2,5,0),
  t(115765,5,4,0),t(116028,6,4,0),t(116203,5,4,0),t(116466,3,3,0),
  f(116817,1,4),t(117167,6,1,0),t(117255,3,3,0),t(117430,7,3,0),
  t(117430,1,3,0),t(117869,7,3,0),s(117956,118921,[[117956,3,4],[118044,3,4],[118132,3,4],[118219,2,3],[118307,1.5,3],[118395,1.5,3],[118482,1,3],[118570,1,3],[118658,1,3],[118745,1,2],[118833,1,2],[118921,1.5,2]]),t(119096,5,5,0),
  t(119447,4,5,0),t(119973,5,5,0),t(120148,5,3,0),t(120674,3,3,0),
  t(120849,4,5,0),t(121288,3,4,0),t(121376,1,3,0),t(121551,0,5,0),
  t(121726,3,4,0),t(121814,1,4,0),t(122077,5,3,0),t(122428,6,4,0),
  t(122603,5,5,0),f(122778,7,3),t(123129,6,4,0),t(123304,5,4,0),
  t(123480,7,3,0),t(123743,3,4,0),t(123830,6,4,0),t(124006,3,4,0),
  t(124181,7,3,0),t(124532,1,3,0),t(124707,3,4,0),t(124882,5,3,0),
  t(125321,6,4,0),t(125321,0,3,0),t(125584,5,3,0),t(125759,3,3,0),
  t(125934,1,4,0),t(126110,0,5,0),t(126460,1,4,4),t(126811,0,4,0),
  t(127162,1,3,0),t(127337,0,4,0),t(127512,3,4,0),f(127688,0,5),
  t(128038,0,5,0),t(128564,0,8,0),t(128740,0,4,0),t(128915,3,4,0),
  t(129266,1,4,0),t(129616,5,4,0),t(129967,3,3,0),t(130142,5,4,0),
  t(130318,6,4,0),t(130493,4,5,0),t(130668,2,5,0),t(131019,5,3,0),
  t(131545,6,4,0),t(131721,3,4,0),t(131896,7,3,0),t(132071,3,4,0),
  t(132422,5,4,0),s(132597,134000,[[132597,1,2],[132773,2.5,3],[132948,2.5,3],[133036,2,4],[133123,0.5,4],[133299,0.5,4],[133386,0.5,4],[133474,1,4],[133649,1,3],[133825,1,3],[134000,1,2]]),t(134526,0,4,0),t(134701,0,5,0),
  t(134877,3,4,0),f(135052,5,4),h(135753,7,1,136279,0,[[135753,7,1],[136016,6,3],[136279,5,5]]),t(136455,5,4,0),
  t(136805,3,3,0),t(137682,5,4,0),t(137857,6,4,0),s(138559,139961,[[138559,3,4],[138646,3,4],[138734,3,4],[138822,3,4],[138909,3,3],[138997,3.5,3],[139085,3.5,3],[139172,4,3],[139260,4,3],[139348,4,3],[139435,4,3],[139523,4,3],[139611,4,2],[139698,4,2],[139786,4,2],[139874,4,2],[139961,4,2]]),
  t(140137,7,3,0),t(140312,5,4,0),t(140663,3,4,0),t(140838,1,4,0),
  t(141101,0,5,0),s(141890,143293,[[141890,1,4],[141978,1,4],[142066,1,4],[142153,1,4],[142241,0,4],[142329,0,4],[142416,0,4],[142504,0,4],[142592,0,4],[142679,0.5,4],[142767,0.5,4],[142855,0,4],[142942,0,4],[143030,0,4],[143118,0,4],[143205,0,4],[143293,0,4]]),t(143468,1,4,0),t(143819,3,4,0),
  s(144433,145835,[[144433,1,2],[144871,1,3],[144959,1,3],[145397,3,3],[145660,2.5,4],[145835,3,4]]),t(146098,0,4,0),f(146274,1,3),t(146800,0,3,0),
  t(146887,1,3,0),t(147238,0,3,0),t(147589,3,4,0),t(147676,1,4,0),
  t(148290,5,4,0),t(148816,7,3,0),t(148816,1,3,0),s(148991,150306,[[148991,3,2],[149079,4,3],[149167,3,3],[149254,3,3],[149342,3,4],[149430,3,4],[149517,3,4],[149605,4,4],[149693,4,4],[149780,4,4],[149868,4,4],[149956,4,4],[150043,4,3],[150131,3.5,3],[150219,4,3],[150306,4,2]],1),
  t(150657,4,5,0),t(150745,5,5,0),t(150920,4,5,0),t(151183,2,5,0),
  t(151271,0,5,0),t(151446,2,5,0),t(151709,1,5,0),t(151797,0,5,0),
  t(152235,0,5,0),t(152323,4,5,0),t(152849,2,5,0),t(153200,2,8,0),
  f(153463,5,3),
// </monster-hero-theme-alt-v3-hard-notes>
])(mhTap,mhHoldV2,mhFlick,mhSlideV2);
const monsterHeroAnotherExpertNotes=((t,h,f,s)=>[
// <monster-hero-theme-alt-v3-expert-notes>
  f(2320,1,3),t(3197,0,4,0),t(3372,3,4,0),s(3723,4512,[[3723,0.5,3],[3986,0.5,3],[4249,2.5,3],[4512,4,3]]),
  t(4074,4,3,0),t(4775,0,4,0),t(5652,1,3,0),t(5827,3,3,0),
  t(6265,5,3,0),t(6616,6,4,0),t(7142,2,8,0),t(7756,3,3,0),
  s(8545,10561,[[8545,2,2],[10561,1,2]]),h(9597,7,1,10298,1,[[9597,7,1],[9948,6,3],[10298,5,5]]),t(11263,1,4,0),t(11438,0,2,0),
  t(11438,4,2,0),t(11789,2,2,0),t(11789,6,2,0),t(12139,4,2,0),
  t(12139,8,2,0),t(13717,6,4,0),t(13805,5,4,0),t(13893,3,4,0),
  t(14156,1,3,0),f(14769,0,5),t(16172,2,5,0),t(16435,1,2,0),
  t(16435,5,2,0),t(16786,3,2,0),t(16786,7,2,0),t(17136,1,2,0),
  t(17136,5,2,0),t(17399,2,5,0),t(18452,1,4,0),t(18802,6,4,0),
  t(19504,0,2,0),t(19504,4,2,0),t(19854,2,2,0),t(19854,6,2,0),
  t(20205,4,2,0),t(20205,8,2,0),t(20906,6,4,0),t(21608,1,4,0),
  t(22309,5,5,0),t(23010,1,2,0),t(23010,5,2,0),t(23361,3,2,0),
  t(23361,7,2,0),t(23712,1,2,0),t(23712,5,2,0),t(24062,6,4,0),
  t(24413,3,4,0),f(25114,6,4),h(25465,3,4,25991),t(26517,1,4,0),
  t(27043,1,4,0),t(27394,3,4,0),t(27569,2,5,0),t(28621,4,5,0),
  t(28972,3,4,0),t(29323,1,4,0),h(29673,0,4,30287),t(31076,3,3,0),
  t(31427,1,4,0),t(31777,0,4,0),t(32128,0,5,0),t(32479,3,4,1),
  t(32829,1,4,0),t(33180,5,4,0),t(34232,2,5,0),t(34583,0,5,0),
  h(34933,2,5,35985),f(35635,6,4),t(36336,0,5,0),t(36511,3,4,0),
  t(37037,5,4,0),t(37388,6,4,0),t(37739,5,4,0),t(37914,2,5,0),
  t(38265,1,4,0),t(38616,0,4,0),t(39142,1,3,0),t(39843,2,5,0),
  t(40194,5,3,0),t(40369,6,4,0),t(41246,6,4,0),t(41772,5,4,0),
  t(42298,5,5,0),t(43174,2,8,0),t(43350,3,4,0),h(43876,0,5,44314),
  s(44577,45454,[[44577,4,3],[44840,2.5,3],[45103,0.5,3],[45366,0,3],[45454,0,3]]),f(45103,2,4),h(45804,3,4,46769),t(46155,7,3,0),
  t(46856,3,4,0),t(47207,6,4,0),t(47558,2,5,0),t(47733,0,4,0),
  t(47733,7,3,0),t(47908,2,5,0),t(48259,5,4,0),t(48610,6,4,0),
  t(48961,5,4,0),t(49136,3,4,0),t(49487,1,4,0),t(49662,4,5,0),
  t(50013,1,4,0),t(50188,4,5,0),t(50539,1,3,0),t(50714,4,5,0),
  t(51065,1,4,0),t(51415,3,3,0),t(51591,5,3,0),f(51766,7,3),
  h(52117,0,5,52818,0,[[52117,0,5],[52467,0,3],[52818,1,1]]),t(52467,3,4,0),t(52993,7,3,0),t(53169,3,4,0),
  t(53344,0,4,0),t(53519,2,5,0),t(53870,4,5,0),t(54221,3,3,0),
  t(54571,1,4,0),t(54747,0,4,0),t(54922,1,3,0),t(55097,2,5,0),
  h(55974,0,4,56325,1),t(56675,4,5,0),t(57026,0,5,0),t(57377,6,4,0),
  t(57377,0,3,0),t(57903,0,5,0),t(58253,2,5,0),f(58779,5,4),
  t(59130,5,5,0),t(59481,5,4,0),t(59656,3,4,0),t(60182,1,4,0),
  t(60358,0,4,0),t(60533,3,3,0),t(60708,6,4,0),t(61059,3,4,0),
  t(61585,0,3,0),t(61936,2,5,0),t(62286,0,4,2),t(62637,3,3,0),
  t(62812,1,3,0),t(62988,5,4,0),t(63163,3,4,0),t(63338,7,3,0),
  t(63514,3,3,0),t(63689,5,4,0),f(64040,3,4),t(64390,5,4,0),
  t(64566,6,4,0),t(64741,5,4,0),t(65092,6,4,0),t(65092,0,3,0),
  t(65442,2,8,0),t(65793,3,4,0),t(65968,1,4,0),t(66319,3,4,0),
  t(66670,5,4,0),t(66845,3,3,0),t(67196,0,4,0),t(67371,3,4,0),
  t(67546,5,5,0),t(67897,3,4,0),t(68248,0,5,0),t(68423,0,3,0),
  t(68598,1,4,0),h(68774,2,5,69212),f(69475,4,5),t(70001,6,4,0),
  t(70177,5,4,0),s(70352,71492,[[70352,3,4],[70527,0.5,3],[70703,0.5,3],[70878,0.5,2],[70966,0.5,2],[71141,1,3],[71316,1.5,3],[71492,1.5,4]]),s(70615,71141,[[70615,4,2],[71141,3,2]]),t(71579,1,4,0),
  t(71755,3,4,0),t(71930,4,5,0),t(72105,5,5,0),t(72982,5,4,0),
  t(73070,2,5,0),t(73157,2,3,0),t(73508,0,5,0),t(74034,0,4,0),
  t(74034,7,3,0),t(74385,0,4,0),t(74911,1,4,0),t(75086,3,4,0),
  t(75437,5,4,0),t(75612,5,4,0),t(75787,6,4,0),t(76313,6,4,0),
  f(76489,6,4),t(76839,5,5,0),t(77541,5,5,0),t(77891,6,4,0),
  t(78417,1,4,0),t(79119,3,4,0),t(79206,5,4,0),t(79469,6,4,0),
  t(79820,4,5,0),t(80171,6,4,0),t(80522,5,4,0),t(80872,5,5,0),
  t(81223,3,4,0),t(81574,5,4,0),t(81924,6,4,0),t(82275,5,4,0),
  t(82626,0,4,0),t(82626,7,3,0),h(82976,6,1,83853,0,[[82976,6,1],[83239,5,4],[83590,5,4],[83853,6,1]]),t(83327,8,2,0),
  t(84028,6,4,0),f(84116,4,5),t(85080,2,5,0),t(85431,0,5,0),
  t(86132,0,5,3),h(87272,0,5,87710),t(87886,2,4,0),h(87973,0,5,88587,0,[[87973,0,5],[88324,0,1],[88587,0,5]]),
  t(88762,1,4,0),t(89201,4,5,0),t(89288,1,4,0),t(89814,5,4,0),
  t(90165,6,4,0),t(90341,6,4,0),s(90604,91568,[[90604,0.5,3],[90867,0,3],[91130,2,3],[91393,3.5,3],[91568,4,3]]),t(90954,6,4,0),
  t(91831,5,4,0),t(91919,3,4,0),t(92532,1,4,0),t(93058,0,8,0),
  f(93146,0,4),h(93760,1,4,94724,1),h(95162,1,4,95513),h(95864,0,5,96214),
  t(96302,1,3,0),t(96565,0,4,0),t(96740,1,4,0),t(97091,3,4,0),
  t(97354,0,3,0),t(97354,6,3,0),h(97968,1,4,98406),t(98669,4,5,0),
  t(98757,3,4,0),s(99546,100335,[[99546,1.5,4],[99633,1.5,3],[99721,1,3],[99809,0,3],[99896,0,2],[99984,0,2],[100072,0,3],[100159,0,3],[100247,0,3],[100335,0.5,4]],1),s(99546,100335,[[99546,3,2],[100335,4,2]]),t(101212,3,3,0),
  t(101387,5,3,0),t(101475,2,5,0),t(101738,0,5,0),t(101825,0,3,0),
  h(102527,4,5,103140),f(103228,1,4),t(103579,6,4,0),t(103929,6,4,0),
  t(104017,5,4,0),t(104718,6,4,0),t(104981,4,5,0),t(105069,3,4,0),
  t(105332,4,5,0),t(106033,2,5,0),t(106121,5,3,0),t(106384,2,5,0),
  t(106735,5,4,0),h(107085,0,5,107611),t(107874,0,4,0),t(108137,1,4,0),
  s(108225,109365,[[108225,2,4],[108313,2,4],[108400,2,4],[108488,1.5,4],[108576,1.5,3],[108663,3,3],[108751,3,3],[108839,2.5,3],[108926,2.5,3],[109014,3,3],[109102,3,2],[109189,3,2],[109277,3,2],[109365,3,2]]),t(108926,6,4,0),t(109540,6,4,0),t(109540,0,3,0),
  f(109891,6,4),t(110241,6,4,0),t(110417,5,5,0),t(110592,6,4,0),
  t(110855,6,4,0),t(111118,5,4,0),t(111294,5,5,0),h(111469,8,1,112521,1,[[111469,8,1],[111820,7,2],[112170,6,4],[112521,5,5]]),
  t(111907,5,4,0),t(112170,1,4,0),t(113135,0,5,0),t(113573,3,4,0),
  t(113661,1,5,0),t(113748,3,4,0),t(113836,0,3,0),t(114099,0,5,0),
  t(114450,3,3,0),t(115589,0,8,0),t(115765,1,4,0),t(116028,3,4,0),
  t(116203,1,4,0),f(116466,0,3),t(116817,0,4,0),t(117167,4,1,0),
  t(117255,1,3,0),t(117430,6,3,0),t(117430,0,3,0),t(117869,5,3,0),
  s(117956,118921,[[117956,1.5,4],[118044,1.5,4],[118132,1.5,4],[118219,0,3],[118307,0,3],[118395,0,3],[118482,0,3],[118570,0,3],[118658,0,3],[118745,0,2],[118833,0,2],[118921,0,2]]),t(118482,1,4,0),t(119096,0,5,0),t(119271,0,3,0),
  t(119447,0,5,0),t(119973,0,5,0),t(120148,0,3,0),t(120674,0,3,0),
  t(120849,0,5,0),t(121288,1,4,0),t(121376,0,3,0),t(121551,0,5,0),
  t(121726,0,4,0),t(121814,1,4,0),f(122077,3,3),t(122428,5,4,0),
  t(122515,1,4,0),t(122603,2,5,0),t(122778,5,3,0),t(123129,3,4,0),
  t(123217,1,4,0),t(123304,0,4,0),t(123480,3,3,0),t(123743,5,4,0),
  t(123830,3,4,0),t(124006,1,4,0),t(124093,3,4,0),t(124181,0,3,0),
  t(124532,1,3,0),t(124532,7,3,0),t(124707,3,4,0),f(124882,5,3),
  t(125321,6,4,0),t(125584,5,3,0),t(125759,3,3,0),t(125934,1,4,0),
  t(126110,0,5,0),t(126460,1,4,4),t(126811,0,4,0),t(126986,1,3,0),
  t(127162,0,3,0),t(127337,0,4,0),t(127512,0,4,0),t(127688,0,5,0),
  t(128038,0,5,0),t(128389,0,3,0),t(128564,0,5,0),t(128740,0,4,0),
  t(128915,1,4,0),t(129266,3,4,0),t(129616,5,4,0),t(129967,7,3,0),
  t(130142,5,4,0),t(130318,1,4,0),t(130493,4,5,0),f(130668,2,5),
  t(131019,7,3,0),t(131019,1,3,0),t(131370,3,3,0),t(131545,0,4,0),
  t(131721,0,4,0),t(131896,1,3,0),t(132071,0,4,0),t(132422,1,4,0),
  s(132597,134000,[[132597,0.5,2],[132773,2,3],[132948,2,3],[133036,2,4],[133123,0,4],[133299,0,4],[133386,0,4],[133474,0,4],[133649,0.5,3],[133825,0.5,3],[134000,0.5,2]],1),t(132948,5,4,0),t(133123,2,8,0),t(133474,2,5,0),
  t(133649,2,4,0),t(134351,3,4,0),t(134701,4,5,0),t(134877,6,4,0),
  f(135052,5,4),h(135753,4,5,136279,0,[[135753,4,5],[136016,5,3],[136279,6,1]]),t(136455,6,4,0),t(136805,5,3,0),
  t(137507,6,4,0),t(137682,3,4,0),t(137857,6,4,0),s(138559,139961,[[138559,0.5,4],[138646,0,4],[138734,0,4],[138822,0,4],[138909,0.5,3],[138997,0.5,3],[139085,1,3],[139172,1,3],[139260,1.5,3],[139348,1.5,3],[139435,1.5,3],[139523,2,3],[139611,1.5,2],[139698,2,2],[139786,1.5,2],[139874,2,2],[139961,1.5,2]]),
  t(138909,3,4,0),t(139085,5,4,0),t(139260,6,4,0),t(139611,4,4,0),
  t(140137,6,3,0),t(140137,0,3,0),t(140312,6,4,0),t(140575,5,4,0),
  t(140663,3,4,0),t(140838,5,4,0),t(141101,2,5,0),s(141890,143293,[[141890,1.5,4],[141978,1.5,4],[142066,1.5,4],[142153,1.5,4],[142241,0.5,4],[142329,0.5,4],[142416,0,4],[142504,0,4],[142592,0,4],[142679,0.5,4],[142767,0.5,4],[142855,0,4],[142942,0,4],[143030,0,4],[143118,0,4],[143205,0,4],[143293,0,4]]),
  t(142592,5,4,0),t(143468,5,4,0),t(143819,1,4,0),s(144433,145835,[[144433,0.5,3],[144696,0,3],[144959,0,3],[145222,1,3],[145485,3,3],[145748,3.5,3],[145835,3.5,3]]),
  t(144871,1,4,0),t(145222,3,4,0),t(145397,1,4,0),t(146098,3,4,0),
  t(146186,1,4,0),t(146274,3,3,0),t(146800,5,3,0),t(146887,7,3,0),
  t(147238,1,3,0),t(147589,5,4,0),t(147676,3,4,0),f(148290,6,4),
  t(148641,5,3,0),t(148816,1,3,0),t(148816,7,3,0),s(148991,150306,[[148991,2,2],[149079,3.5,3],[149167,1.5,3],[149254,1.5,3],[149342,1.5,4],[149430,1.5,4],[149517,2,4],[149605,4,4],[149693,4,4],[149780,4,4],[149868,3.5,4],[149956,3.5,4],[150043,3.5,3],[150131,2.5,3],[150219,3,3],[150306,3,2]],1),
  t(149342,0,3,0),t(149517,1,3,0),t(149693,0,3,0),t(149956,1,4,0),
  t(150657,1,5,0),t(150745,0,5,0),t(150920,0,5,0),t(151183,0,5,0),
  t(151271,2,5,0),t(151446,0,5,0),t(151709,1,5,0),t(151797,0,5,0),
  t(152235,4,5,0),t(152323,2,5,0),t(152674,5,5,0),t(152849,2,5,0),
  t(153200,2,8,0),f(153463,7,3),
// </monster-hero-theme-alt-v3-expert-notes>
])(mhTap,mhHoldV2,mhFlick,mhSlideV2);
const monsterHeroAnotherMasterNotes=((t,h,f,s)=>[
// <monster-hero-theme-alt-v3-master-notes>
  f(2320,8,2),t(2846,4,2,0),t(3197,0,3,0),t(3372,1,3,0),
  s(3723,4512,[[3723,0.5,2],[3986,0.5,2],[4249,2.5,2],[4512,4,2]]),t(4074,4,2,0),t(4775,7,3,0),t(5652,2,2,0),
  t(5827,4,2,0),t(6265,6,2,0),t(6616,7,3,0),t(7142,4,6,0),
  t(7756,4,2,0),s(8545,10561,[[8545,2.5,2],[10561,1.5,2]]),t(9246,1,3,0),h(9597,7,1,10298,1,[[9597,7,1],[9948,6,3],[10298,6,4]]),
  t(11263,0,3,0),t(11438,2,2,0),t(11789,3,3,0),f(12139,5,3),
  t(12753,6,4,0),t(13717,7,3,0),t(13805,5,3,0),t(13893,4,3,0),
  t(14156,2,2,0),t(14769,0,4,0),t(16172,3,4,0),t(16435,1,4,0),
  t(16786,0,4,0),t(17136,1,4,0),t(17399,3,4,0),t(18452,1,3,0),
  t(18802,3,3,0),t(18978,2,2,0),t(19504,0,2,0),t(19504,4,2,0),
  t(20205,4,2,0),t(20205,8,2,0),t(20906,0,2,0),t(20906,4,2,0),
  t(21608,4,2,0),t(21608,8,2,0),f(21958,1,3),t(22309,3,4,0),
  t(22660,5,3,0),t(23010,7,3,0),t(23361,0,2,0),t(23361,4,2,0),
  t(23712,1,2,0),t(23712,5,2,0),t(24062,3,2,0),t(24062,7,2,0),
  t(24413,4,2,0),t(24413,8,2,0),t(25114,1,3,0),h(25465,3,3,25991),
  t(26166,5,3,0),t(26517,3,3,0),t(27043,3,3,0),t(27394,3,3,0),
  t(28271,2,2,0),t(28271,6,2,0),t(28621,2,2,0),t(28621,7,2,0),
  t(28972,1,2,0),t(28972,8,2,0),t(29323,0,2,0),t(29323,8,2,0),
  h(29673,5,3,30287),f(30550,6,4),t(31076,0,2,0),t(31076,4,2,0),
  t(31427,4,2,0),t(31427,8,2,0),t(31777,0,2,0),t(31777,4,2,0),
  t(32128,4,2,0),t(32128,8,2,0),t(32479,5,3,1),t(32829,1,3,0),
  t(33180,7,3,0),t(33531,1,3,0),t(34232,6,4,0),t(34583,1,4,0),
  h(34933,6,4,35985,1),t(35635,1,3,0),t(36336,0,4,0),t(36511,1,3,0),
  t(37037,3,3,0),f(37388,5,3),t(37739,0,2,0),t(37739,4,2,0),
  t(37914,1,2,0),t(37914,5,2,0),t(38089,3,2,0),t(38089,7,2,0),
  t(38265,4,2,0),t(38265,8,2,0),t(38616,7,3,0),t(39142,4,2,0),
  t(39843,0,6,0),t(40194,4,2,0),t(40369,1,3,0),h(40895,5,4,41333),
  s(41772,42298,[[41772,2,3],[42035,3.5,2],[42122,4,2],[42210,4,2],[42298,4,2]],1),s(41772,42298,[[41772,0,2],[42298,2,2]]),t(42824,0,4,0),t(43174,3,4,0),
  h(43876,6,4,44314),s(44577,45454,[[44577,3,3],[44665,3,3],[44840,3,3],[45015,1,3],[45103,1,3],[45454,1,3]],1),s(45015,45454,[[45015,3,2],[45454,4,2]]),h(45804,6,4,46769,0,[[45804,6,4],[46155,7,3],[46418,8,2],[46769,8,1]]),
  t(46155,5,3,0),t(46856,3,3,0),f(47207,5,3),t(47558,6,4,0),
  t(47558,1,3,0),t(47733,5,3,0),t(47733,0,3,0),t(47908,6,4,0),
  t(48259,5,3,0),t(48610,7,3,0),t(48785,5,4,0),t(48961,7,3,0),
  t(49136,5,3,0),t(49224,7,3,0),t(49487,5,3,0),t(49662,6,4,0),
  t(50013,5,3,0),t(50188,6,4,0),t(50539,2,2,0),t(50714,3,4,0),
  f(51065,5,3),t(51415,8,2,0),t(51591,4,2,0),t(51766,6,2,0),
  t(51941,7,3,0),h(52117,7,1,52818,0,[[52117,7,1],[52467,5,4],[52818,7,1]]),t(52467,9,1,0),t(52993,4,2,0),
  t(53169,7,3,0),t(53169,2,3,0),t(53344,3,3,0),t(53519,1,4,0),
  t(53870,0,4,0),t(54221,2,2,0),t(54571,0,3,0),t(54747,0,3,0),
  t(54922,2,2,0),t(55097,3,4,0),t(55448,5,3,0),t(55623,0,2,0),
  h(55974,5,3,56325,1),t(56675,1,4,0),f(57026,6,4),t(57377,3,3,0),
  t(57903,5,4,0),t(58253,6,4,0),t(58779,5,3,0),t(58955,6,4,0),
  t(59130,3,4,0),t(59481,7,3,0),t(59656,2,3,0),t(59656,7,3,0),
  t(60182,7,3,0),t(60358,5,3,0),t(60533,8,2,0),t(60708,5,3,0),
  t(61059,7,3,0),t(61585,6,2,0),t(61760,4,2,0),t(61936,4,6,0),
  f(62286,3,3),t(62637,6,2,0),t(62812,4,2,0),t(62988,1,3,0),
  t(63163,0,3,0),t(63338,2,2,0),t(63514,0,2,0),t(63689,1,3,0),
  t(63864,0,2,0),t(64040,1,3,0),t(64390,3,3,0),t(64566,5,3,0),
  t(64741,3,3,0),t(65092,5,3,0),t(65092,0,3,0),t(65442,1,4,0),
  t(65618,3,3,0),t(65793,0,3,0),t(65968,1,3,0),f(66319,3,3),
  t(66670,5,3,0),t(66845,8,2,0),t(67020,8,2,0),t(67196,5,3,0),
  t(67371,7,3,0),t(67546,5,4,0),t(67897,3,3,2),t(68248,5,4,0),
  t(68423,4,2,0),t(68598,5,3,0),h(68774,1,4,69212),t(69475,5,4,0),
  t(70001,3,3,0),t(70177,7,3,0),t(70177,2,3,0),s(70352,71492,[[70352,2,3],[70527,0,2],[70703,0,2],[70878,0,2],[70966,0,2],[71141,0,2],[71316,0.5,2],[71492,0.5,3]]),
  t(70703,7,3,0),t(70878,5,3,0),t(71053,4,2,0),t(71579,1,3,0),
  t(71755,0,3,0),t(71930,0,4,0),f(72105,1,4),t(72982,3,3,0),
  t(73070,0,4,0),s(73157,73859,[[73157,1.5,2],[73420,1.5,2],[73683,3,2],[73771,3,3],[73859,3.5,3]]),t(73508,0,4,0),t(74034,0,3,0),
  t(74385,0,3,0),t(74735,0,3,0),t(74911,1,3,0),t(75086,5,3,0),
  t(75437,5,3,0),t(75612,5,3,0),t(75787,7,3,0),t(76313,7,3,0),
  t(76839,5,4,0),t(77541,6,4,0),t(77891,5,3,0),t(78067,7,3,0),
  t(78242,3,3,0),f(78417,5,3),t(79119,7,3,0),t(79206,5,3,0),
  t(79469,1,3,0),t(79820,2,6,0),t(80171,2,2,0),t(80171,6,2,0),
  t(80522,2,2,0),t(80522,7,2,0),t(80872,1,2,0),t(80872,8,2,0),
  t(81223,0,2,0),t(81223,8,2,0),t(81574,3,3,0),t(81924,1,3,0),
  t(82275,5,3,0),t(82450,3,4,0),t(82626,1,3,0),t(82626,6,3,0),
  h(82976,1,4,83853,0,[[82976,1,4],[83239,2,2],[83590,2,2],[83853,1,4]]),t(83327,0,3,0),t(84028,2,3,0),f(84116,0,4),
  t(85080,6,4,0),t(85431,1,4,0),t(86132,5,4,3),t(86571,0,4,0),
  h(87272,1,4,87710),h(87798,5,2,88938),h(87973,2,1,88587),t(88762,0,3,0),
  t(89201,3,4,0),t(89288,1,3,0),t(89814,5,3,0),t(90165,7,3,0),
  t(90341,7,3,0),s(90604,91568,[[90604,3,3],[90779,1.5,2],[90867,1.5,2],[90954,2.5,2],[91130,3.5,2],[91217,3.5,2],[91393,3.5,2],[91568,4,3]]),t(90954,7,3,0),t(91831,5,3,0),
  f(91919,3,3),t(92357,1,3,0),t(92357,6,3,0),t(92532,0,3,0),
  t(92620,1,3,0),t(93058,2,4,0),t(93146,1,3,0),h(93760,0,3,94724,1),
  h(95162,5,3,95513),h(95864,1,4,96214),t(96302,4,2,0),t(96565,0,3,0),
  t(96740,1,3,0),t(97091,3,3,0),t(97354,0,2,0),h(97968,7,3,98406),
  t(98669,5,4,0),t(98757,3,3,0),t(98844,2,3,0),s(99546,100335,[[99546,4,2],[99809,1.5,2],[100072,0,2],[100335,0.5,2]]),
  t(99896,3,4,0),f(100598,0,3),h(100949,0,3,101299),t(101387,0,2,0),
  t(101475,1,4,0),t(101738,0,4,0),t(101825,2,2,0),h(102527,0,4,103140),
  t(103228,3,3,0),t(103579,1,3,0),t(103579,6,3,0),t(103929,0,3,0),
  t(104017,1,3,0),t(104280,3,3,0),t(104718,5,3,0),t(104981,2,6,0),
  t(105069,1,3,0),t(105332,0,4,0),t(106033,1,4,0),t(106121,0,2,0),
  f(106384,1,4),t(106735,7,3,0),h(107085,3,4,107611),t(107787,0,3,0),
  t(107874,1,3,0),t(108137,5,3,0),s(108225,109365,[[108225,2,3],[108313,2,3],[108400,2,3],[108488,2,3],[108576,2,2],[108663,3.5,2],[108751,3.5,2],[108839,3,2],[108926,3,2],[109014,4,2],[109102,4,2],[109189,4,2],[109277,4,2],[109365,4,2]]),s(108839,109365,[[108839,1,2],[109365,0,2]]),
  t(109540,3,3,0),t(109891,5,3,0),t(110241,7,3,0),t(110417,6,4,0),
  t(110417,1,3,0),t(110592,7,3,0),t(110768,7,3,0),t(110855,3,3,0),
  t(111118,5,3,0),t(111294,1,4,0),h(111469,2,1,112521,1,[[111469,2,1],[111820,2,2],[112170,1,3],[112521,1,4]]),t(111820,0,1,0),
  t(111995,0,3,0),f(112170,0,3),t(113135,1,4,0),t(113573,3,3,0),
  t(113661,1,4,0),t(113748,0,3,0),t(113836,4,2,0),t(114099,5,4,0),
  t(114450,2,2,0),t(115589,0,4,0),t(115765,1,3,0),t(116028,3,3,0),
  t(116203,5,3,0),t(116203,0,3,0),t(116466,8,2,0),t(116817,3,3,0),
  t(117167,0,1,0),t(117255,4,2,0),f(117430,7,2),t(117869,8,2,0),
  s(117956,118921,[[117956,3,3],[118044,3,3],[118132,3,3],[118219,1.5,2],[118307,1.5,2],[118395,1,2],[118482,1,2],[118570,1,2],[118658,1,2],[118745,1,2],[118833,1,2],[118921,1.5,2]]),t(118482,5,3,0),t(119096,6,4,0),t(119271,4,2,0),
  t(119447,0,4,0),t(119622,1,3,0),t(119973,5,4,0),t(120148,2,2,0),
  t(120674,6,2,0),t(120849,5,4,0),t(120937,7,3,0),t(121288,5,3,0),
  t(121376,8,2,0),t(121551,5,4,0),t(121726,7,3,0),t(121814,5,3,0),
  f(122077,8,2),t(122428,3,3,0),t(122515,7,3,0),t(122603,2,6,0),
  t(122778,6,2,0),t(123129,3,3,0),t(123217,1,3,0),t(123304,0,3,0),
  t(123480,0,2,0),t(123743,3,3,0),t(123830,1,3,0),t(124006,0,3,0),
  t(124093,1,3,0),t(124181,0,2,0),t(124444,1,3,0),t(124532,0,2,0),
  t(124707,1,3,0),f(124882,4,2),t(125321,7,3,0),t(125584,6,2,0),
  t(125584,2,2,0),t(125759,4,2,0),t(125934,1,3,0),t(126022,0,3,0),
  t(126110,1,4,0),t(126285,0,2,0),t(126460,1,3,0),t(126811,0,3,0),
  t(126986,4,2,0),t(127162,2,2,0),t(127337,0,3,0),t(127512,1,3,0),
  t(127688,0,4,0),t(128038,1,4,0),t(128389,4,2,0),t(128564,5,4,0),
  t(128740,3,3,0),t(128915,5,3,0),t(129090,8,2,0),f(129266,5,3),
  t(129616,5,3,0),t(129792,6,2,0),t(129967,8,2,0),t(129967,4,2,0),
  t(130142,7,3,0),t(130318,3,3,0),t(130493,6,4,0),t(130668,5,4,0),
  t(131019,8,2,4),t(131370,4,2,0),t(131545,0,3,0),t(131721,1,3,0),
  t(131896,6,2,0),t(132071,1,3,0),t(132422,3,3,0),t(132510,2,3,0),
  s(132597,134000,[[132597,0.5,2],[132773,2,2],[132948,2,2],[133036,2,3],[133123,0,3],[133299,0,3],[133386,0,3],[133474,0,3],[133649,0.5,2],[133825,0.5,2],[134000,0.5,2]],1),t(132948,5,3,0),t(133123,6,4,0),t(133474,3,4,0),
  f(133649,5,3),t(134351,1,3,0),t(134526,3,3,0),t(134701,4,6,0),
  t(134877,7,3,0),t(134877,2,3,0),t(135052,5,3,0),t(135578,8,2,0),
  h(135753,5,4,136279,0,[[135753,5,4],[136016,6,3],[136279,7,1]]),t(136455,7,3,0),t(136805,2,2,0),t(137507,5,3,0),
  t(137682,3,3,0),t(137857,7,3,0),s(138559,139961,[[138559,0,2],[138822,0,2],[139085,1.5,2],[139348,3,2],[139611,3.5,2],[139874,4,2],[139961,4,2]]),t(138909,3,3,0),
  t(139085,0,3,0),f(139260,0,3),t(139611,0,3,0),t(140137,4,2,0),
  t(140312,7,3,0),t(140575,3,3,0),t(140663,5,3,0),t(140838,5,3,0),
  t(141101,6,4,0),t(141101,1,3,0),t(141276,8,1,0),s(141890,143293,[[141890,3,3],[141978,3,3],[142066,3,3],[142153,3,3],[142241,2,3],[142329,2,3],[142416,0.5,3],[142504,0.5,3],[142592,0.5,3],[142679,2,3],[142767,2,3],[142855,1.5,3],[142942,0.5,3],[143030,0.5,3],[143118,0.5,3],[143205,0.5,3],[143293,0.5,3]]),
  t(142592,7,3,0),t(143381,7,3,0),t(143468,3,3,0),t(143819,7,3,0),
  s(144433,145835,[[144433,2,2],[144871,2,2],[144959,2,2],[145397,4,2],[145660,4,3],[145835,4,3]]),s(144433,145835,[[144433,0,2],[145835,2,2]]),t(146098,7,3,0),t(146186,5,3,0),
  t(146274,8,2,0),t(146800,6,2,0),t(146887,8,2,0),t(147238,6,2,0),
  t(147589,7,3,0),t(147676,5,3,0),t(148290,7,3,0),t(148641,2,2,0),
  t(148816,0,2,0),t(148816,4,2,0),s(148991,150306,[[148991,2,2],[149079,3.5,2],[149167,1.5,2],[149254,1.5,2],[149342,1.5,3],[149430,1.5,3],[149517,2,3],[149605,4,3],[149693,4,3],[149780,4,3],[149868,3.5,3],[149956,3.5,3],[150043,3.5,2],[150131,2.5,2],[150219,3,2],[150306,3,2]]),t(149342,0,2,0),
  t(149517,0,2,0),t(150394,1,3,0),t(150657,3,4,0),t(150745,5,4,0),
  t(150920,3,4,0),t(151183,5,4,0),t(151271,3,4,0),t(151446,1,4,0),
  t(151709,0,4,0),t(151797,3,4,0),t(152235,1,4,0),t(152323,5,4,0),
  t(152498,6,4,0),t(152674,5,4,0),t(152849,1,4,0),t(152849,7,3,0),
  t(153024,1,4,0),t(153024,7,3,0),t(153200,0,6,0),f(153463,2,2),
// </monster-hero-theme-alt-v3-master-notes>
])(mhTap,mhHoldV2,mhFlick,mhSlideV2);
const monsterHeroAnotherCharts=Object.freeze({
  EASY:mhChart(1,monsterHeroAnotherEasyNotes,MONSTER_HERO_ANOTHER_DURATION_MS),
  NORMAL:mhChart(3,monsterHeroAnotherNormalNotes,MONSTER_HERO_ANOTHER_DURATION_MS),
  HARD:mhChart(5,monsterHeroAnotherHardNotes,MONSTER_HERO_ANOTHER_DURATION_MS),
  EXPERT:mhChart(7,monsterHeroAnotherExpertNotes,MONSTER_HERO_ANOTHER_DURATION_MS),
  MASTER:mhChart(9,monsterHeroAnotherMasterNotes,MONSTER_HERO_ANOTHER_DURATION_MS),
});

// MF × ICHIKA MIX（元「あつ杯テーマ」）。先行公開の1曲。譜面はV3パイプラインが入れる。
const ATSU_CUP_THEME_V3_DURATION_MS=144640;
const atsuCupThemeV3EasyNotes=((t,h,f,s)=>[
// <atsu-cup-theme-v3-easy-notes>
  t(2525,0,10,0),t(3590,4,6,0),t(5010,5,4,0),t(5365,2,6,0),
  t(5898,1,4,0),t(6431,0,6,0),t(6786,0,3,0),t(6786,7,3,0),
  t(7318,0,4,0),t(7851,1,4,0),t(9271,3,4,0),t(9448,5,4,0),
  t(11401,6,4,0),h(12644,6,3,13265,0,[[12644,6,3],[12999,5,4],[13265,4,6]]),t(13709,3,4,0),t(14419,3,4,0),
  t(15129,5,4,0),t(15306,5,4,0),t(15839,6,4,0),t(17081,5,4,0),
  t(20809,3,4,0),t(21164,3,4,0),h(22052,1,4,23383),t(26312,3,4,0),
  t(26845,3,4,0),t(28442,5,4,0),t(29152,6,4,0),t(30040,5,4,0),
  t(30395,5,4,0),t(31638,3,4,1),t(32525,1,4,0),t(32703,0,6,0),
  t(34123,3,4,0),t(34300,4,6,0),t(35188,6,4,0),t(36431,5,4,0),
  t(37673,3,4,0),t(38738,1,4,0),t(39093,3,4,0),h(41401,5,4,42377),
  t(45839,0,10,0),t(46016,4,6,0),t(46549,6,4,0),t(47081,4,6,0),
  h(47969,5,4,48502),t(51164,3,4,0),t(51519,0,3,0),t(51519,7,3,0),
  t(53294,1,4,0),t(53472,3,4,0),t(56490,5,4,0),t(56667,5,4,0),
  t(58087,4,6,0),t(58620,6,4,2),t(60395,5,4,0),t(61105,6,4,0),
  h(62170,4,6,63235,0,[[62170,4,6],[62525,5,4],[62880,5,4],[63235,6,3]]),t(63590,3,4,0),t(63768,5,4,0),t(64655,6,4,0),
  t(65543,5,4,0),t(66253,3,4,0),t(66431,1,4,0),t(68028,0,4,0),
  t(69448,0,4,0),t(69981,0,4,0),t(70868,0,4,0),t(71046,1,4,0),
  t(71933,2,6,0),t(72466,4,6,0),t(73886,6,4,0),t(74241,6,4,0),
  t(76194,3,4,0),t(76371,5,4,0),t(77081,7,3,0),t(77081,0,3,0),
  t(78502,4,6,0),t(80454,3,4,0),t(80632,4,6,0),t(81697,0,10,0),
  t(82229,5,4,0),h(82584,4,3,84005,0,[[82584,4,3],[82939,3,4],[83294,2,6],[83649,3,4],[84005,4,3]]),t(85247,0,6,0),t(85957,2,6,0),
  t(86667,4,6,3),t(87377,4,6,0),t(87732,4,6,0),t(88442,2,6,0),
  t(89862,2,6,0),t(90218,0,6,0),t(90573,2,6,0),h(91283,1,4,91815),
  t(91993,0,6,0),h(92348,0,6,93058),t(94123,0,6,0),t(94655,0,6,0),
  t(95188,2,6,0),t(96608,4,6,0),t(97496,3,4,0),t(98028,4,6,0),
  t(99093,2,6,0),t(99448,1,4,0),t(99981,0,4,0),t(101046,0,4,0),
  t(101578,0,4,0),t(103354,1,4,0),t(104774,3,4,0),h(106371,5,4,107348),
  t(109034,0,6,0),t(109389,1,4,0),t(110099,3,4,0),h(110454,4,6,111076,0,[[110454,4,6],[110809,6,3],[111076,4,6]]),
  t(111164,6,4,0),t(111519,5,4,0),t(112584,3,4,0),h(114005,1,4,114360),
  t(114715,0,10,4),t(115425,5,4,0),t(115780,3,4,0),t(116845,1,4,0),
  t(117555,0,3,0),t(117555,7,3,0),t(117910,1,4,0),t(118087,0,4,0),
  t(119330,0,4,0),t(119685,1,4,0),t(121460,0,4,0),t(121993,0,4,0),
  t(123413,0,6,0),t(123590,0,4,0),t(124833,0,6,0),t(125365,1,4,0),
  t(125720,0,4,0),t(126431,1,4,0),t(126786,3,4,0),t(127141,1,4,0),
  t(128206,3,4,0),t(128916,1,4,0),t(129271,0,4,0),t(129981,1,4,0),
  t(130336,3,4,0),t(131223,0,6,0),t(131756,2,6,0),t(132111,4,6,0),
  t(132821,6,4,0),t(133176,0,6,0),t(133531,3,4,0),t(134064,4,6,0),
  t(134241,4,6,0),t(135661,4,6,0),t(136371,4,6,0),t(136726,4,6,0),
  t(136904,4,6,0),t(137436,4,6,0),t(137791,4,6,0),t(138857,5,4,0),
  t(139389,5,4,0),t(140277,0,10,0),t(140632,5,4,0),t(140987,0,3,0),
  t(140987,7,3,0),t(142229,1,4,0),t(142762,3,4,0),t(143117,5,4,0),
// </atsu-cup-theme-v3-easy-notes>
])(mhTap,mhHoldV2,mhFlick,mhSlideV2);
const atsuCupThemeV3NormalNotes=((t,h,f,s)=>[
// <atsu-cup-theme-v3-normal-notes>
  t(2525,0,10,0),f(3235,2,6),t(3590,0,6,0),t(5010,1,4,0),
  t(5365,4,6,0),t(5898,3,4,0),t(6431,0,6,0),t(6786,0,3,0),
  t(6786,7,3,0),t(7318,3,3,0),t(7851,5,4,0),t(8028,6,4,0),
  t(9271,3,3,0),t(9448,6,4,0),t(11401,5,3,0),h(12644,4,2,13265,1,[[12644,4,2],[12999,3,4],[13265,2,6]]),
  t(13709,1,4,0),t(14419,1,4,0),t(15129,3,4,0),t(15306,3,4,0),
  t(15839,5,3,0),f(17081,6,4),t(18324,5,4,0),t(20809,3,4,0),
  t(21164,5,4,0),h(22052,7,3,23383),t(26312,5,4,0),t(26845,5,4,0),
  t(28442,3,4,0),t(29152,6,4,0),t(30040,5,4,0),t(30395,6,4,0),
  t(31638,5,4,1),t(32525,1,4,0),t(32703,4,6,0),t(33413,3,4,0),
  t(34123,6,4,0),t(34300,4,6,0),t(35188,6,4,0),f(36431,6,4),
  t(37673,5,4,0),t(38738,3,4,0),t(39093,5,4,0),t(39271,6,4,0),
  h(41401,5,4,42377),t(45839,2,6,0),t(46016,0,10,0),t(46549,7,3,0),
  t(46549,0,3,0),t(47081,4,6,0),t(47436,3,4,0),h(47969,7,3,48502),
  h(49212,5,4,49567),t(51164,3,4,0),t(51519,5,4,0),t(52052,1,4,0),
  t(53294,0,4,0),t(56490,1,4,0),t(56667,1,3,0),f(56845,1,3),
  t(58087,2,6,0),t(58620,5,4,2),t(60395,3,4,0),t(61105,6,4,0),
  h(62170,4,6,63235,0,[[62170,4,6],[62525,5,4],[62880,5,3],[63235,6,2]]),t(63590,3,4,0),t(63768,3,4,0),t(64123,5,4,0),
  t(64655,5,4,0),t(66253,6,4,0),t(66431,6,4,0),t(68028,5,4,0),
  t(68561,6,4,0),t(69448,3,4,0),t(69981,6,4,0),t(70868,5,4,0),
  f(71046,5,3),t(71933,2,6,0),t(72466,4,6,0),t(73886,0,3,0),
  t(73886,7,3,0),t(74241,6,4,0),t(76194,3,4,0),t(76371,5,4,0),
  t(77081,7,3,0),t(78502,4,6,0),t(79212,5,4,0),t(80454,3,4,0),
  t(80632,4,6,0),t(81697,4,6,0),t(82229,5,4,0),h(82584,6,2,84005,0,[[82584,6,2],[82939,5,4],[83294,4,6],[83649,5,4],[84005,6,2]]),
  t(85247,0,10,0),t(85425,4,6,0),t(85957,0,6,0),f(86667,0,6),
  t(87377,2,6,3),t(87732,0,6,0),t(88442,0,6,0),t(89507,0,4,0),
  t(89862,0,6,0),t(90218,0,6,0),t(90573,0,6,0),h(91283,0,4,91815),
  t(91993,0,6,0),h(92348,0,6,93058),t(94123,0,6,0),t(94655,2,6,0),
  t(95188,4,6,0),t(95543,3,4,0),t(96253,0,3,0),t(96253,7,3,0),
  t(96608,2,6,0),t(97496,1,4,0),t(98028,4,6,0),f(99093,2,6),
  t(99448,5,3,0),t(99981,6,4,0),t(101046,5,3,0),t(101578,7,3,0),
  t(103354,5,3,0),t(104774,3,4,0),t(104951,2,6,0),h(105484,3,4,106016),
  h(106371,1,4,107348),t(108324,3,4,0),t(109034,4,6,0),t(109389,3,4,0),
  t(109744,5,4,0),t(110099,6,4,0),h(110454,4,6,111076,0,[[110454,4,6],[110809,6,2],[111076,4,6]]),t(111519,6,4,0),
  t(112584,0,4,0),f(112939,3,4),t(113472,6,4,0),h(114005,3,4,114360,1),
  t(114715,0,10,4),t(115425,3,4,0),t(115780,6,4,0),t(116845,1,4,0),
  t(117555,0,4,0),t(117910,1,4,0),t(118087,0,4,0),t(119330,1,4,0),
  t(119685,5,4,0),t(121460,5,4,0),t(121993,6,4,0),t(123413,4,6,0),
  t(123590,7,3,0),t(123590,0,3,0),t(123768,4,6,0),t(124833,4,6,0),
  f(125365,5,4),t(125720,6,4,0),t(126431,6,4,0),t(126786,5,4,0),
  t(127141,3,4,0),t(127851,1,4,0),t(128206,0,4,0),t(128916,0,4,0),
  t(129271,0,4,0),t(129981,0,4,0),t(130336,0,4,0),t(131046,3,4,0),
  t(131223,0,6,0),t(131756,4,6,0),t(132111,2,6,0),t(132466,1,4,0),
  t(132821,0,4,0),t(133176,0,6,0),f(133531,0,4),t(134064,0,6,0),
  t(134241,0,6,0),t(135661,0,6,0),t(136194,0,6,0),t(136371,0,6,0),
  t(136726,0,6,0),t(136904,0,6,0),t(137436,0,6,0),t(137791,2,6,0),
  t(138324,4,6,0),t(138857,3,4,0),t(139389,6,4,0),t(140277,0,10,0),
  t(140632,6,4,0),t(140987,7,3,0),t(140987,0,3,0),t(142229,3,4,0),
  t(142762,5,4,0),f(143117,3,4),
// </atsu-cup-theme-v3-normal-notes>
])(mhTap,mhHoldV2,mhFlick,mhSlideV2);
const atsuCupThemeV3HardNotes=((t,h,f,s)=>[
// <atsu-cup-theme-v3-hard-notes>
  f(1815,1,4),t(2525,1,8,0),t(3235,4,5,0),t(3590,2,5,0),
  t(4567,5,4,0),t(5365,2,5,0),t(5898,6,4,0),t(5898,0,3,0),
  t(6253,3,4,0),t(6431,0,5,0),t(6786,3,4,0),t(7318,7,3,0),
  t(7851,3,4,0),t(8028,0,4,0),t(9182,1,4,0),t(9271,3,3,0),
  t(9448,1,4,0),t(11401,3,3,0),t(12200,5,4,0),h(12555,7,1,13265,1,[[12555,7,1],[12910,6,3],[13265,5,5]]),
  f(13620,3,4),h(13975,6,4,14419),t(15040,1,4,0),t(15129,3,4,0),
  t(15306,5,4,0),t(15395,6,4,0),t(15928,5,4,0),t(16460,3,4,0),
  t(16815,5,4,0),t(17081,3,4,0),t(17170,0,5,0),t(17880,2,5,0),
  t(18768,3,4,0),t(19478,0,4,0),t(20188,2,5,0),t(20365,6,4,0),
  t(20809,3,4,0),t(21164,0,4,0),t(21608,1,4,0),h(22052,5,3,23383),
  t(23561,3,4,0),f(23916,5,4),t(24448,5,5,0),t(25336,6,4,0),
  t(25336,0,3,0),h(25868,6,4,26223),t(26312,5,4,0),t(26845,3,4,0),
  t(27289,1,4,0),t(27821,0,4,0),t(28176,1,4,0),t(28442,5,4,0),
  t(28531,1,4,0),t(29951,3,4,0),t(30040,5,4,0),t(30395,6,4,0),
  t(31638,1,4,1),t(32081,3,4,0),t(32525,5,4,0),t(32703,5,5,0),
  t(33413,5,4,0),f(33590,3,3),t(34123,1,4,0),t(34300,2,5,0),
  t(35188,1,4,0),t(35454,0,8,0),h(36431,0,4,36874),t(37673,1,4,0),
  h(38117,5,4,38561),t(38738,3,4,0),t(39093,6,4,0),h(39271,5,4,39803),
  h(40070,5,5,40780,0,[[40070,5,5],[40425,7,3],[40780,8,1]]),s(41401,42377,[[41401,0,3],[41667,1.5,3],[41933,3,3],[42200,4,3],[42377,4,3]]),h(44862,4,1,45484,1,[[44862,4,1],[45218,2,5],[45484,4,1]]),t(45839,4,5,0),
  t(46016,2,5,0),t(46549,0,4,0),t(46549,7,3,0),t(47081,0,5,0),
  f(47436,1,4),t(47969,3,3,0),t(48147,5,4,0),t(48324,7,3,0),
  t(48590,5,4,0),t(51164,5,4,0),t(51431,6,4,0),h(51519,5,4,52052),
  h(52851,5,5,53916,0,[[52851,5,5],[53206,7,2],[53561,7,2],[53916,5,5]]),s(54271,55158,[[54271,3,4],[54360,1.5,4],[54537,1.5,3],[54803,1,3],[54892,1,3],[55158,1,2]]),t(56401,3,4,0),t(56490,5,4,0),
  t(56845,3,3,0),t(58087,0,5,0),t(58176,2,5,0),t(58620,5,4,2),
  s(59419,60839,[[59419,3,4],[59596,3,3],[59774,2.5,3],[59862,2.5,3],[59951,3,3],[60129,3,2],[60306,3,3],[60395,3,3],[60484,3.5,3],[60661,4,3],[60839,4,4]]),t(61105,6,4,0),t(62170,3,3,0),s(62259,63235,[[62259,3,2],[62348,2,3],[62436,2,3],[62525,3,4],[62614,4,4],[62703,4,4],[62791,3,4],[62880,3,4],[62969,3,4],[63058,3,3],[63147,3,3],[63235,3,2]]),
  t(63590,5,4,0),t(64567,2,5,0),f(64655,6,4),t(65454,1,4,0),
  t(65632,4,5,0),t(66253,3,4,0),t(66431,6,4,0),t(67052,5,4,0),
  t(68028,6,4,0),t(68561,6,4,0),t(69448,5,4,0),h(69981,6,4,70425),
  t(70868,6,4,0),t(71046,5,3,0),t(71401,3,3,0),t(71933,0,5,0),
  t(72466,0,5,0),t(73886,0,4,0),t(73886,7,3,0),t(74241,5,4,0),
  t(75040,5,4,0),t(75573,5,4,0),f(75750,6,4),t(76194,6,4,0),
  t(76371,3,4,0),t(76993,5,4,0),t(77081,3,3,0),t(77525,0,5,0),
  t(78413,0,4,0),t(78502,1,8,0),t(79212,1,4,0),t(79833,5,4,0),
  t(80632,5,5,0),t(81519,5,4,0),t(81697,5,5,0),t(82229,5,4,0),
  s(82584,84005,[[82584,3,4],[82673,3,4],[82762,1.5,4],[82939,1.5,3],[83117,2,3],[83294,1.5,3],[83383,1.5,3],[83472,2,3],[83561,2,3],[83649,2,2],[83827,1.5,2],[83916,1,2],[84005,1,2]],1),t(84537,2,5,0),t(85247,4,5,0),t(85425,5,5,0),
  t(85957,0,5,0),f(86667,2,5),t(87022,5,5,3),t(87377,2,5,0),
  t(87732,0,5,0),t(88442,2,5,0),t(89330,3,4,0),t(89507,0,4,0),
  t(89507,7,3,0),t(89862,0,5,0),t(90218,0,5,0),t(90573,0,5,0),
  t(91283,1,4,0),t(91904,1,5,0),t(91993,0,5,0),s(92348,93058,[[92348,2,4],[92436,2,4],[92525,2,3],[92614,2,3],[92703,2,3],[92791,4,3],[92880,2,2],[92969,4,2],[93058,4,2]]),
  t(93324,0,5,0),t(93679,0,5,0),t(94123,2,5,0),t(94300,4,5,0),
  t(94655,5,5,0),f(95188,4,5),t(95543,3,4,0),t(96253,1,4,0),
  t(96608,2,5,0),t(96963,1,4,0),t(97496,0,4,0),t(98028,0,5,0),
  t(98383,3,3,0),t(99093,0,5,0),t(99448,0,3,0),t(99981,1,4,0),
  t(101578,0,3,0),t(102022,1,4,0),s(102821,104241,[[102821,3.5,3],[103087,3,3],[103354,2,3],[103620,0.5,3],[103886,1.5,3],[104152,2.5,3],[104241,2,3]]),t(104774,5,4,0),
  t(104951,5,5,0),t(105484,5,4,0),s(106371,107348,[[106371,2,2],[106460,2,3],[106549,2,3],[106638,2,4],[106726,4,4],[106815,4,4],[106904,4,4],[106993,3,4],[107081,3,4],[107170,3,3],[107259,3,3],[107348,3,2]]),t(108324,1,4,0),
  t(108857,4,5,0),f(109034,0,5),t(109389,5,4,0),t(109744,0,4,0),
  t(109744,7,3,0),t(110099,5,4,0),h(110454,4,5,111076),t(111164,6,4,0),
  t(111519,5,4,0),t(112584,3,4,0),t(112939,5,4,0),t(113472,3,4,0),
  h(114005,5,4,114360,1),t(114715,2,8,4),t(115070,5,4,0),t(115425,3,4,0),
  t(115780,1,4,0),t(116490,0,4,0),t(116845,1,4,0),t(117555,0,4,0),
  t(117910,3,4,0),f(118087,6,4),t(118709,2,5,0),t(119330,0,4,0),
  t(119685,3,4,0),t(121460,1,4,0),t(121993,5,4,0),t(122969,0,5,0),
  t(123413,0,5,0),t(123590,0,3,0),t(123768,0,5,0),t(124389,2,5,0),
  t(124833,0,5,0),t(125365,5,4,0),t(125720,3,4,0),t(126431,1,4,0),
  t(126786,0,4,0),t(127141,1,4,0),t(127673,2,5,0),t(127851,0,4,0),
  t(127851,7,3,0),f(128206,3,4),t(128916,6,4,0),t(129271,3,4,0),
  t(129448,0,5,0),t(129626,3,4,0),t(129981,6,4,0),t(130336,1,4,0),
  t(131046,3,4,0),t(131223,4,5,0),t(131756,5,5,0),t(132111,4,5,0),
  t(132466,3,4,0),t(132644,0,5,0),t(132821,1,4,0),t(133176,2,5,0),
  t(133531,5,4,0),t(134064,2,5,0),t(134241,0,5,0),t(134774,0,5,0),
  f(135661,0,5),t(136194,0,5,0),t(136371,2,5,0),t(136726,4,5,0),
  t(136904,5,5,0),t(137259,4,5,0),t(137436,5,5,0),t(137791,4,5,0),
  t(138324,5,5,0),t(138590,4,5,0),t(138857,3,4,0),t(139389,5,4,0),
  t(140277,0,5,0),t(140632,3,4,0),t(140987,6,4,0),t(140987,0,3,0),
  t(141431,2,8,0),t(142229,3,4,0),t(142762,5,4,0),t(142939,6,4,0),
  f(143117,5,4),
// </atsu-cup-theme-v3-hard-notes>
])(mhTap,mhHoldV2,mhFlick,mhSlideV2);
const atsuCupThemeV3ExpertNotes=((t,h,f,s)=>[
// <atsu-cup-theme-v3-expert-notes>
  f(1815,1,4),t(2525,1,8,0),t(3235,4,5,0),t(3590,2,5,0),
  t(4567,5,4,0),t(5365,2,5,0),t(5632,6,4,0),t(5898,0,4,0),
  t(5898,7,3,0),t(6253,5,4,0),t(6431,2,5,0),t(6786,5,4,0),
  t(7318,7,3,0),t(7673,0,2,0),t(7673,4,2,0),t(7851,2,2,0),
  t(7851,6,2,0),t(8028,4,2,0),t(8028,8,2,0),t(9182,3,4,0),
  t(9271,5,3,0),t(9448,6,4,0),t(11401,5,3,0),f(12200,3,4),
  h(12555,8,1,13265,1,[[12555,8,1],[12910,7,3],[13265,5,5]]),t(13620,5,4,0),t(13709,3,4,0),h(13975,1,4,14419),
  t(15040,0,4,0),t(15129,1,4,0),t(15306,0,4,0),t(15395,1,4,0),
  t(15839,3,3,0),t(15928,1,4,0),t(16460,3,4,0),t(16815,1,4,0),
  t(17081,2,4,0),t(17170,0,5,0),t(17880,2,5,0),t(18768,1,2,0),
  t(18768,5,2,0),t(19478,3,2,0),t(19478,7,2,0),t(20188,1,2,0),
  t(20188,5,2,0),t(20365,0,4,0),f(20809,1,4),t(21164,3,4,0),
  t(21608,3,4,0),h(22052,0,3,23383),t(22407,3,3,0),t(23028,6,4,0),
  t(23561,0,4,0),t(23561,7,3,0),t(23916,0,4,0),t(24448,2,5,0),
  t(25336,5,4,0),t(25513,2,5,0),h(25868,1,4,26223),t(26312,5,4,0),
  t(26845,1,4,0),t(27289,3,4,0),t(27821,0,4,0),t(28176,1,4,0),
  t(28442,3,4,0),f(28531,1,4),t(29152,3,4,1),t(29596,1,4,0),
  t(29951,5,4,0),t(30040,3,4,0),t(30395,6,4,0),t(31638,0,2,0),
  t(31638,4,2,0),t(32081,2,2,0),t(32081,6,2,0),t(32525,4,2,0),
  t(32525,8,2,0),t(32703,5,5,0),t(33413,5,4,0),t(33590,3,3,0),
  t(34123,3,4,0),t(34300,2,8,0),h(34922,2,5,35720),h(36431,5,4,36874),
  t(37673,3,4,0),h(38117,6,4,38561),f(38738,3,4),t(39093,6,4,0),
  t(39271,3,4,0),h(40070,1,4,40780),s(41401,42377,[[41401,0,3],[41667,1.5,3],[41933,3,3],[42200,4,3],[42377,4,3]]),h(44862,0,5,45484,0,[[44862,0,5],[45218,1,3],[45484,2,1]]),
  t(45839,2,5,0),t(46016,2,5,0),t(46371,6,4,0),t(46371,0,3,0),
  t(46549,5,4,0),t(47081,5,5,0),t(47436,6,4,0),t(47969,3,3,0),
  t(48147,5,4,0),t(48324,7,3,0),t(48590,5,4,0),h(49212,3,4,49567,1),
  t(51164,0,4,0),t(51431,1,4,0),f(51519,0,4),t(52052,1,4,0),
  h(52851,2,1,53916,0,[[52851,2,1],[53206,0,4],[53561,0,4],[53916,2,1]]),t(53294,0,1,0),s(54271,55158,[[54271,1.5,4],[54360,0,4],[54537,0,3],[54803,0,3],[54892,0,3],[55158,0,2]]),h(54271,5,2,55070),
  t(55691,3,4,0),t(56401,1,4,0),t(56490,0,4,0),t(56667,1,3,0),
  t(56845,3,3,0),t(58087,2,5,0),t(58176,4,5,0),t(58620,1,4,2),
  s(59419,60839,[[59419,2.5,4],[59596,2,3],[59774,1.5,3],[59862,1.5,3],[59951,2,3],[60129,2.5,2],[60306,2,3],[60395,2,3],[60484,3,3],[60661,3.5,3],[60839,4,4]]),t(60129,0,4,0),t(60395,0,4,0),f(61105,0,4),
  t(61904,0,4,0),t(61904,7,3,0),t(62170,4,3,0),s(62259,63235,[[62259,1.5,2],[62348,0.5,3],[62436,0.5,3],[62525,1.5,4],[62614,2.5,4],[62703,2.5,4],[62791,1.5,4],[62880,1.5,4],[62969,1.5,4],[63058,1.5,3],[63147,1.5,3],[63235,1.5,2]]),
  t(62791,4,4,0),t(63590,5,4,0),t(63679,6,4,0),t(64567,4,5,0),
  t(64655,6,4,0),t(65099,5,4,0),t(65454,3,4,0),t(65632,0,5,0),
  t(66253,5,4,0),t(66431,3,4,0),t(67052,6,4,0),t(68028,3,4,0),
  t(68561,6,4,0),t(69448,5,4,0),t(69981,6,4,0),h(70336,4,5,71046,0,[[70336,4,5],[70691,6,1],[71046,4,5]]),
  f(71933,0,5),t(72466,5,5,0),t(73797,5,4,0),t(73886,6,4,0),
  t(74241,5,4,0),t(74685,6,4,0),t(75040,5,4,0),t(75573,5,4,0),
  t(75750,6,4,0),t(76194,6,4,0),t(76371,3,4,0),t(76993,5,4,0),
  t(77081,3,3,0),t(77525,0,5,0),t(77880,1,4,0),t(78413,0,4,0),
  t(78502,0,8,0),t(79212,0,4,0),t(79212,7,3,0),f(79833,0,4),
  t(80454,1,4,0),t(80632,0,5,0),t(81519,0,4,0),t(81697,0,5,0),
  t(82229,0,4,0),s(82584,84005,[[82584,1.5,4],[82673,1.5,4],[82762,0,4],[82939,0,3],[83117,0,3],[83294,0,3],[83383,0,3],[83472,0,3],[83561,0,3],[83649,0,2],[83827,0,2],[83916,0,2],[84005,0,2]],1),s(82584,84005,[[82584,3,2],[84005,4,2]]),t(84537,2,5,0),
  t(85247,4,5,0),t(85425,0,5,0),t(85957,0,5,3),t(86667,0,5,0),
  t(86845,3,4,0),t(87022,4,5,0),t(87377,5,5,0),t(87732,4,5,0),
  t(88265,4,5,0),f(88442,5,5),t(89330,3,4,0),t(89507,5,4,0),
  t(89862,5,5,0),t(90040,5,4,0),t(90218,0,5,0),t(90573,2,5,0),
  t(91283,5,4,0),t(91904,5,5,0),t(91993,2,5,0),s(92348,93058,[[92348,0,3],[92614,1,3],[92880,3,3],[93058,3.5,3]]),
  t(93324,2,5,0),t(93679,4,5,0),t(94123,2,5,0),t(94300,4,5,0),
  t(94655,5,5,0),t(95010,5,4,0),t(95188,5,5,0),t(95543,6,4,0),
  t(95543,0,3,0),f(96253,3,4),t(96608,0,5,0),t(96963,0,4,0),
  t(97496,1,4,0),t(98028,0,5,0),t(98383,3,3,0),t(98561,5,5,0),
  t(99093,2,5,0),t(99448,0,3,0),t(99626,3,3,0),t(99981,6,4,0),
  t(101046,3,3,0),t(101578,7,3,0),t(102022,6,4,0),t(103354,5,3,0),
  t(104419,7,3,0),t(104774,5,4,0),f(104951,2,5),s(105484,106016,[[105484,1.5,4],[105750,1.5,3],[105928,2,2],[106016,3.5,2]],1),
  s(106371,107348,[[106371,2,2],[106460,2,3],[106549,2,3],[106638,2,4],[106726,3.5,4],[106815,4,4],[106904,3.5,4],[106993,2.5,4],[107081,2.5,4],[107170,2.5,3],[107259,2.5,3],[107348,2.5,2]]),t(106726,0,5,0),t(106904,3,4,0),t(107436,4,5,0),
  t(108324,0,4,0),t(108857,2,5,0),t(109034,0,5,0),t(109389,5,4,0),
  t(109744,3,4,0),t(110099,6,4,0),t(110454,1,8,0),h(110632,6,4,111076),
  t(111164,3,4,0),t(111519,6,4,0),t(112229,3,4,0),t(112584,6,4,0),
  t(112939,0,4,0),t(112939,7,3,0),t(113472,5,4,0),h(113649,3,4,114360),
  f(114005,5,4),t(114715,5,5,4),t(115070,5,4,0),t(115425,1,4,0),
  t(115780,3,4,0),t(116490,5,4,0),t(116667,7,3,0),t(116845,6,4,0),
  t(117555,5,4,0),t(117910,3,4,0),t(118087,1,4,0),t(118709,0,5,0),
  t(119330,1,4,0),t(119685,3,4,0),t(121460,1,4,0),t(121993,6,4,0),
  f(122969,4,5),t(123413,5,5,0),t(123590,5,3,0),t(123768,2,5,0),
  s(124389,125099,[[124389,4,3],[124655,3,3],[124922,1,3],[125099,0,3]]),t(125365,0,4,0),t(125720,3,4,0),h(126076,6,4,126519),
  t(126786,3,4,0),t(126963,0,4,0),t(127141,3,4,0),t(127673,2,5,0),
  t(127851,0,4,0),t(128206,3,4,0),t(128561,6,4,0),t(128916,3,4,0),
  t(129271,0,4,0),t(129448,0,5,0),t(129626,0,4,0),t(129626,7,3,0),
  t(129981,3,4,0),f(130336,5,4),t(130691,6,4,0),t(131046,5,4,0),
  t(131223,2,5,0),t(131756,4,5,0),t(132111,5,5,0),t(132466,6,4,0),
  t(132644,2,5,0),t(132821,5,4,0),t(133176,0,5,0),t(133354,2,5,0),
  t(133531,0,4,0),t(134064,0,5,0),t(134241,0,5,0),t(134774,0,5,0),
  h(135306,0,5,135750,1),t(136194,0,5,0),t(136371,0,5,0),t(136726,2,5,0),
  f(136904,4,5),t(137259,5,5,0),t(137436,4,5,0),t(137791,5,5,0),
  t(138324,4,5,0),t(138590,5,5,0),t(138857,5,4,0),t(139123,3,4,0),
  t(139389,5,4,0),t(140188,2,4,0),t(140277,0,5,0),t(140632,0,4,0),
  t(140987,1,4,0),t(141431,0,8,0),t(141874,0,4,0),t(141874,7,3,0),
  t(142229,3,4,0),t(142762,5,4,0),t(142939,3,4,0),f(143117,6,4),
// </atsu-cup-theme-v3-expert-notes>
])(mhTap,mhHoldV2,mhFlick,mhSlideV2);
const atsuCupThemeV3MasterNotes=((t,h,f,s)=>[
// <atsu-cup-theme-v3-master-notes>
  f(1815,0,3),t(2525,0,6,0),t(3235,3,4,0),t(3590,5,4,0),
  h(4123,6,4,4478),t(4567,5,3,0),t(5010,3,3,0),t(5365,5,4,0),
  t(5632,1,3,0),t(5898,0,3,0),t(5898,5,3,0),t(6253,1,3,0),
  t(6431,0,4,0),t(6786,1,3,0),t(7318,4,2,0),t(7673,1,3,0),
  t(7851,3,3,0),t(8028,5,3,0),t(9182,3,3,0),t(9271,8,2,0),
  f(9448,3,3),t(11401,2,2,0),t(12200,0,3,0),h(12555,1,1,13265,1,[[12555,1,1],[12910,0,3],[13265,0,4]]),
  t(13620,1,3,0),t(13709,5,3,0),h(13975,3,3,14419),t(14507,7,3,0),
  t(15040,1,3,0),t(15129,3,3,0),t(15306,5,3,0),t(15395,7,3,0),
  t(15839,6,2,0),t(15928,3,3,0),t(16460,5,3,0),t(16815,2,3,0),
  t(16815,7,3,0),t(17081,0,3,0),f(17170,3,4),t(17880,6,4,0),
  t(18768,3,3,0),t(19478,7,3,0),t(19655,3,3,0),t(20188,6,4,0),
  t(20365,7,3,0),t(20809,7,3,0),t(21164,7,3,0),t(21608,7,3,0),
  h(22052,6,2,23383),t(22407,8,2,0),t(22939,7,3,0),t(23561,1,3,0),
  t(23916,7,3,0),t(24448,1,4,0),f(25336,0,3),h(25868,1,3,26223),
  t(26312,3,3,0),t(26401,1,3,0),t(26756,0,3,0),t(26845,1,3,0),
  t(27289,0,3,0),t(27289,5,3,0),t(27821,1,3,0),t(28176,0,3,0),
  t(28442,1,3,0),t(28531,3,3,0),t(29152,3,3,1),t(29596,3,3,0),
  t(29951,3,3,0),t(30040,5,3,0),t(30395,7,3,0),t(31638,1,3,0),
  f(32081,3,3),t(32525,5,3,0),t(32703,4,6,0),t(33413,5,3,0),
  t(33590,4,2,0),t(34123,3,3,0),t(34300,5,4,0),h(34922,3,4,35720),
  h(36431,5,3,36874),t(37673,3,3,0),h(38117,7,3,38561),t(38738,3,3,0),
  t(39093,7,3,0),t(39271,3,3,0),h(40070,1,4,40780,0,[[40070,1,4],[40425,1,3],[40780,2,1]]),s(41401,42377,[[41401,0,2],[41667,1.5,2],[41933,3,2],[42200,4,2],[42377,4,2]]),
  h(44862,3,1,45484,0,[[44862,3,1],[45218,1,4],[45484,3,1]]),t(45839,1,4,0),t(45839,7,3,0),f(46016,3,4),
  t(46371,5,3,0),t(46549,5,3,0),t(47081,6,4,0),t(47436,7,3,0),
  s(47969,48502,[[47969,3,2],[48058,2.5,2],[48235,2.5,2],[48413,4,3],[48502,4,3]]),t(48590,3,3,0),h(49212,1,3,49567,1),t(51164,0,3,0),
  t(51431,1,3,0),t(51519,0,3,0),t(52052,1,3,0),h(52851,1,4,53916,0,[[52851,1,4],[53206,2,2],[53561,2,2],[53916,1,4]]),
  t(53294,0,3,0),s(54271,55158,[[54271,1.5,3],[54360,0,3],[54537,0,2],[54803,0,2],[54892,0,2],[55158,0,2]],1),h(54271,5,2,55070),f(55691,3,3),
  t(56401,1,3,0),t(56490,0,3,0),t(56667,2,2,0),t(56845,4,2,0),
  t(57999,1,3,0),t(58087,3,4,0),t(58176,4,4,0),t(58620,7,3,0),
  t(58620,2,3,0),s(59419,60839,[[59419,1.5,3],[59596,1,2],[59774,0.5,2],[59862,0.5,2],[59951,1,2],[60129,1.5,2],[60306,1,2],[60395,1,2],[60484,2,2],[60661,2.5,2],[60839,3,3]]),t(59951,5,3,0),t(60129,4,3,0),
  t(60395,7,3,0),t(61105,7,3,2),t(61904,3,3,0),t(62170,6,2,0),
  s(62259,63235,[[62259,2,2],[62348,1,2],[62436,1,2],[62525,2,3],[62614,3,3],[62703,3,3],[62791,2,3],[62880,2,3],[62969,2,3],[63058,2,2],[63147,2,2],[63235,2,2]]),f(62791,5,3),t(63324,7,3,0),t(63590,3,3,0),
  t(63679,7,3,0),t(64567,3,4,0),t(64655,5,3,0),t(65099,2,3,0),
  t(65099,7,3,0),t(65454,1,3,0),t(65543,3,3,0),t(65632,0,6,0),
  t(66253,0,3,0),t(66431,1,3,0),t(67052,3,3,0),t(68028,5,3,0),
  t(68561,5,3,0),t(69448,7,3,0),t(69981,5,3,0),t(70336,8,2,0),
  h(70513,6,2,71046,1),f(71401,4,2),t(71933,5,4,0),t(72466,6,4,0),
  t(73797,3,3,0),t(73886,5,3,0),t(74241,3,3,0),t(74685,1,3,0),
  t(75040,0,3,0),t(75573,0,3,0),t(75750,1,3,0),t(76194,1,3,0),
  t(76371,0,3,0),t(76993,3,3,0),t(77081,2,2,0),t(77348,5,3,0),
  t(77525,1,4,0),t(77525,7,3,0),s(77880,78413,[[77880,1.5,3],[77969,0.5,3],[78058,0,2],[78147,0,2],[78235,0,2],[78324,0,2],[78413,0,2]]),f(78502,5,4),
  t(79212,1,3,0),t(79833,5,3,0),t(80188,3,3,0),t(80454,5,3,0),
  t(80632,1,4,0),t(81519,0,3,0),t(81697,1,4,0),t(82229,3,3,0),
  s(82584,84005,[[82584,4,2],[82851,2,2],[83117,2,2],[83383,2,2],[83649,2,2],[83916,0,2],[84005,0,2]]),t(83117,5,4,0),t(83294,8,2,0),t(84182,3,3,0),
  t(84537,6,4,0),t(85247,5,4,0),t(85425,5,4,0),t(85780,0,4,0),
  f(85957,1,4),t(86667,3,4,0),t(86845,5,3,0),t(87022,6,4,0),
  t(87377,5,4,3),t(87732,1,4,0),t(87732,7,3,0),t(88265,5,4,0),
  t(88442,3,4,0),t(89330,3,3,0),t(89507,5,3,0),t(89862,6,4,0),
  t(90040,5,3,0),t(90129,1,3,0),t(90218,5,4,0),t(90573,3,4,0),
  t(91105,7,3,0),f(91283,5,3),t(91904,6,4,0),t(91993,5,4,0),
  s(92348,93058,[[92348,3,3],[92436,3,3],[92525,2.5,2],[92614,2.5,2],[92703,2.5,2],[92791,4,2],[92880,2.5,2],[92969,4,2],[93058,4,2]]),s(92348,93058,[[92348,1,2],[93058,0,2]]),t(93324,0,4,0),t(93679,0,6,0),
  t(94123,3,4,0),t(94300,0,2,0),t(94300,4,2,0),t(94655,4,2,0),
  t(94655,8,2,0),t(95010,0,2,0),t(95010,4,2,0),t(95188,6,4,0),
  t(95543,5,3,0),t(95720,3,3,0),t(96253,1,3,0),t(96253,6,3,0),
  t(96608,0,4,0),t(96963,1,3,0),t(97141,3,3,0),t(97496,1,3,0),
  f(98028,3,4),t(98383,2,2,0),t(98561,0,4,0),t(99093,1,4,0),
  t(99448,4,2,0),t(99626,6,2,0),t(99981,3,3,0),t(101046,2,2,0),
  t(101578,6,2,0),t(101756,2,2,0),t(102022,5,3,0),t(103354,8,2,0),
  t(104419,8,2,0),t(104774,5,3,0),t(104951,3,4,0),s(105129,106016,[[105129,1.5,3],[105484,1.5,2],[105750,1.5,2],[105928,2,2],[106016,3.5,2]],1),
  f(105484,0,3),s(106371,107348,[[106371,1.5,2],[106460,1.5,2],[106549,1.5,2],[106638,1.5,3],[106726,3,3],[106815,3.5,3],[106904,3,3],[106993,2,3],[107081,2,3],[107170,2,2],[107259,2,2],[107348,2,2]]),t(106726,1,4,0),t(106904,3,3,0),
  t(107436,5,4,0),t(108147,1,4,0),t(108147,7,3,0),t(108324,1,3,0),
  t(108857,0,4,0),t(109034,0,2,0),t(109034,4,2,0),t(109389,4,2,0),
  t(109389,8,2,0),t(109744,0,2,0),t(109744,4,2,0),t(110099,4,2,0),
  t(110099,8,2,0),t(110454,1,4,0),h(110632,0,3,111076),t(111164,3,3,0),
  t(111519,1,3,0),t(112052,5,3,0),t(112229,3,3,0),f(112584,7,3),
  t(112939,0,3,0),t(113472,1,3,0),h(113649,4,1,114360,1,[[113649,4,1],[114005,3,3],[114360,3,4]]),t(114005,7,3,0),
  t(114715,0,2,0),t(114715,4,2,0),t(114892,2,2,0),t(114892,6,2,0),
  t(115070,4,2,0),t(115070,8,2,0),t(115425,5,3,4),t(115780,3,3,0),
  t(116312,1,3,0),t(116312,6,3,0),t(116490,5,3,0),t(116667,4,2,0),
  t(116845,7,3,0),t(117555,5,3,0),t(117910,3,3,0),t(118087,1,3,0),
  t(118709,0,6,0),f(119330,1,3),t(119685,3,3,0),t(121460,1,3,0),
  t(121993,7,3,0),t(122969,3,4,0),t(123413,3,4,0),t(123590,6,2,0),
  t(123768,5,4,0),s(124389,125099,[[124389,4,2],[124655,3,2],[124922,1,2],[125099,0,2]]),t(125365,0,3,0),t(125720,3,3,0),
  h(126076,7,3,126519),t(126786,3,3,0),t(126963,0,3,0),t(127141,3,3,0),
  t(127673,5,4,0),t(127851,2,3,0),t(127851,7,3,0),f(128206,1,3),
  t(128561,0,3,0),t(128916,1,3,0),t(129271,0,2,0),t(129271,4,2,0),
  t(129448,1,2,0),t(129448,5,2,0),t(129626,3,2,0),t(129626,7,2,0),
  t(129803,4,2,0),t(129803,8,2,0),t(129981,7,3,0),t(130336,3,3,0),
  t(130513,0,4,0),t(130691,1,3,0),t(131046,3,3,0),t(131223,5,4,0),
  t(131756,6,4,0),f(132111,5,4),t(132466,3,3,0),t(132644,5,4,0),
  t(132821,7,3,0),t(132999,5,4,0),t(133176,3,4,0),t(133354,5,4,0),
  t(133531,7,3,0),t(133709,3,4,0),t(134064,1,4,0),t(134064,7,3,0),
  t(134241,5,4,0),t(134774,5,4,0),h(135306,6,4,135750,1),t(136194,5,4,0),
  t(136371,6,4,0),t(136726,5,4,0),t(136904,6,4,0),t(137170,5,3,0),
  t(137259,6,4,0),f(137436,5,4),t(137791,6,4,0),t(137969,6,4,0),
  t(138324,2,2,0),t(138324,6,2,0),t(138590,2,2,0),t(138590,7,2,0),
  t(138857,1,2,0),t(138857,8,2,0),t(139123,0,2,0),t(139123,8,2,0),
  t(139389,7,3,0),t(140188,1,3,0),t(140277,5,4,0),t(140632,3,3,0),
  t(140809,7,3,0),t(140987,3,3,0),t(141431,4,6,0),t(141874,7,3,0),
  t(141874,2,3,0),t(142229,5,3,0),t(142762,3,3,0),t(142939,5,3,0),
  f(143117,7,3),
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
  atsu_cup_theme_test:Object.freeze({EASY:10,NORMAL:6,HARD:6}),
  width_test:Object.freeze({EASY:9,NORMAL:7,MASTER:2}),
  wide_width_test:Object.freeze({EASY:10,HARD:2}),
  end_flick_test:Object.freeze({EASY:4,HARD:3}),
  monster_note_test:Object.freeze({EASY:4}),
  monster_hero_theme_candidate:Object.freeze({EASY:5,NORMAL:7,HARD:10}),
  monster_hero_theme_candidate_v2:Object.freeze({EASY:7,NORMAL:9,HARD:14,EXPERT:21,MASTER:24}),
  monster_hero_theme_candidate_v3:Object.freeze({EASY:8,NORMAL:10,HARD:16,EXPERT:22,MASTER:30}),
  six_eternel_remix_beat:Object.freeze({EASY:7,NORMAL:9,HARD:14,EXPERT:20,MASTER:26}),
  mf_ichika_mix:Object.freeze({EASY:6,NORMAL:7,HARD:9,EXPERT:14,MASTER:22}),
  monster_hero:Object.freeze({EASY:8,NORMAL:10,HARD:16,EXPERT:22,MASTER:30}),
  monster_hero_another:Object.freeze({EASY:7,NORMAL:9,HARD:14,EXPERT:18,MASTER:23}),
  six_eternel_beat:Object.freeze({EASY:10,NORMAL:11,HARD:23,EXPERT:29,MASTER:38}),
  six_eternel_remix:Object.freeze({EASY:7,NORMAL:9,HARD:14,EXPERT:20,MASTER:26}),
  stay_with_me:Object.freeze({EASY:5,NORMAL:6,HARD:8,EXPERT:14,MASTER:17}),
  kiki_issen:Object.freeze({EASY:6,NORMAL:8,HARD:12,EXPERT:19,MASTER:29}),
  kaze_ga_soyogu:Object.freeze({EASY:4,NORMAL:5,HARD:7,EXPERT:12,MASTER:15}),
  close_to_your_heart:Object.freeze({EASY:7,NORMAL:8,HARD:11,EXPERT:20,MASTER:28}),
  eiki_boss_remix:Object.freeze({EASY:6,NORMAL:8,HARD:12,EXPERT:16,MASTER:23}),
  pandora_boss_remix:Object.freeze({EASY:6,NORMAL:7,HARD:10,EXPERT:15,MASTER:23}),
  dullahan:Object.freeze({EASY:8,NORMAL:10,HARD:15,EXPERT:20,MASTER:29}),
  dullahan_clockwork:Object.freeze({EASY:6,NORMAL:7,HARD:11,EXPERT:17,MASTER:26}),
  toriko:Object.freeze({EASY:4,NORMAL:5,HARD:7,EXPERT:11,MASTER:16}),
  '4u_hitasura':Object.freeze({EASY:5,NORMAL:7,HARD:9,EXPERT:16,MASTER:18}),
  kindan_no_resistance:Object.freeze({EASY:7,NORMAL:9,HARD:13,EXPERT:20,MASTER:28}),
  crossing_field:Object.freeze({EASY:9,NORMAL:11,HARD:14,EXPERT:20,MASTER:27}),
  nothing_without_you:Object.freeze({EASY:6,NORMAL:8,HARD:13,EXPERT:20,MASTER:26}),
  atsu_cup_theme_debug_short:Object.freeze({HARD:9}),
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
  // DEBUG ONLY: V3が自動で作った譜面なので、耳確認前は正式導線へ出さない。
  // 音源は「曲の頭からサビの終わりまで」を切り出したショート版（2分30秒）。
  Object.freeze({
    songId:'six_eternel_remix_beat',
    displayName:'SIX ÉTERNEL ドパガキリミックス',
    debugDescription:'SIX ÉTERNEL ドパガキリミックス（モンビー用ショート2分30秒・EASY〜MASTER・耳確認前）',
    bgmTrackId:'six_eternel_remix_beat',
    difficulties:Object.freeze(Object.fromEntries(RHYTHM_DIFFICULTIES.map(({id})=>[
      id,sixEternelRemixBeatCharts[id]||emptyRhythmChart()
    ])))
  }),
  // ---- 先行公開する7曲 ----
  // 体験版の曲えらびへ出すのはここから下の7曲だけ(RHYTHM_DEMO_SONG_IDS)。
  // 上のデバッグ曲と役割を分けているので、デバッグ曲を足しても曲えらびは増えない。
  Object.freeze({
    songId:'mf_ichika_mix',
    displayName:'MF × ICHIKA MIX',
    bgmTrackId:'atsu_cup_theme',
    artwork:'images/song-art/mf-ichika-mix.jpg?v=c2ae53aa90ca',
    difficulties:Object.freeze(Object.fromEntries(RHYTHM_DIFFICULTIES.map(({id})=>[
      id,atsuCupThemeV3Charts[id]||emptyRhythmChart()
    ])))
  }),
  Object.freeze({
    songId:'monster_hero',
    displayName:'Monster Hero',
    bgmTrackId:'monster_hero_theme',
    artwork:'images/song-art/monster-hero.jpg?v=8f7d0efd07fd',
    difficulties:Object.freeze(Object.fromEntries(RHYTHM_DIFFICULTIES.map(({id})=>[
      id,monsterHeroV3Charts[id]||emptyRhythmChart()
    ])))
  }),
  Object.freeze({
    songId:'monster_hero_another',
    displayName:'Monster Hero -Another-',
    bgmTrackId:'monster_hero_theme_alt',
    // ユーザー指示: ジャケットは「Monster Hero」と同じ絵を使う。
    artwork:'images/song-art/monster-hero.jpg?v=8f7d0efd07fd',
    difficulties:Object.freeze(Object.fromEntries(RHYTHM_DIFFICULTIES.map(({id})=>[
      id,monsterHeroAnotherCharts[id]||emptyRhythmChart()
    ])))
  }),
  // 2026-09-12、ユーザー指示で原曲を公開。それまでDEBUG扱いだった。
  // 譜面は新しい生成器で作り直したもの（SLIDEの太さの変化・ジグザグ・緩急が入る）。
  Object.freeze({
    songId:'six_eternel_beat',
    displayName:'SIX ÉTERNEL',
    subtitle:'―愛はひとつじゃない―',
    artwork:'images/song-art/six-eternel-ai-wa-hitotsu-janai.jpg?v=e71044bbd526',
    bgmTrackId:'six_eternel_beat',
    difficulties:Object.freeze(Object.fromEntries(RHYTHM_DIFFICULTIES.map(({id})=>[
      id,sixEternelBeatCharts[id]||emptyRhythmChart()
    ])))
  }),
  // 2026-09-12、原曲(six_eternel_beat)を公開したので表示名を正した。
  // それまで**リミックスのほうが原曲の名前「―愛はひとつじゃない―」を名乗っていた**ため、
  // 原曲を出すと同じ名前が2つ並ぶ状態だった。songId は変えない(ランキングのキーになるため)。
  Object.freeze({
    songId:'six_eternel_remix',
    displayName:'SIX ÉTERNEL',
    subtitle:'ドパガキリミックス',
    artwork:'images/song-art/six-eternel.jpg?v=25486603b6de',
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
    artwork:'images/song-art/stay-with-me.jpg?v=0a8784f80cf1',
    difficulties:Object.freeze(Object.fromEntries(RHYTHM_DIFFICULTIES.map(({id})=>[
      id,pandoraBossCharts[id]||emptyRhythmChart()
    ])))
  }),
  Object.freeze({
    songId:'kiki_issen',
    displayName:'綺季一閃',
    subtitle:'～花雪に舞う詠姫～',
    bgmTrackId:'eiki_boss',
    artwork:'images/song-art/kiki-issen.jpg?v=49bfb0c27729',
    difficulties:Object.freeze(Object.fromEntries(RHYTHM_DIFFICULTIES.map(({id})=>[
      id,eikiBossCharts[id]||emptyRhythmChart()
    ])))
  }),
  Object.freeze({
    songId:'kaze_ga_soyogu',
    displayName:'風がそよぐ場所',
    bgmTrackId:'kaze_ga_soyogu',
    artwork:'images/song-art/kaze-ga-soyogu.jpg?v=25522a7fcde0',
    difficulties:Object.freeze(Object.fromEntries(RHYTHM_DIFFICULTIES.map(({id})=>[
      id,kazeGaSoyoguCharts[id]||emptyRhythmChart()
    ])))
  }),
  Object.freeze({
    songId:'close_to_your_heart',
    displayName:'Close To Your Heart',
    bgmTrackId:'close_to_your_heart',
    // 絵は「風がそよぐ場所」と同じものを使う(2026-09-05・ユーザー指示)。
    // 曲ごとの絵ができたら、その曲の artwork だけを差し替える。
    artwork:'images/song-art/kaze-ga-soyogu.jpg?v=25522a7fcde0',
    difficulties:Object.freeze(Object.fromEntries(RHYTHM_DIFFICULTIES.map(({id})=>[
      id,closeToYourHeartCharts[id]||emptyRhythmChart()
    ])))
  }),
  Object.freeze({
    songId:'eiki_boss_remix',
    displayName:'綺季一閃',
    subtitle:'～花雪に舞う詠姫～ battle remix',
    bgmTrackId:'eiki_boss_remix',
    // ジャケットはオリジナルと同じものを使う(2026-09-05・ユーザー指示)
    artwork:'images/song-art/kiki-issen.jpg?v=49bfb0c27729',
    difficulties:Object.freeze(Object.fromEntries(RHYTHM_DIFFICULTIES.map(({id})=>[
      id,eikiBossRemixCharts[id]||emptyRhythmChart()
    ])))
  }),
  Object.freeze({
    songId:'pandora_boss_remix',
    displayName:'Stay With Me',
    subtitle:'～Locked Fate～ remix',
    bgmTrackId:'pandora_boss_remix',
    artwork:'images/song-art/stay-with-me.jpg?v=0a8784f80cf1',
    difficulties:Object.freeze(Object.fromEntries(RHYTHM_DIFFICULTIES.map(({id})=>[
      id,pandoraBossRemixCharts[id]||emptyRhythmChart()
    ])))
  }),
  Object.freeze({
    songId:'dullahan',
    displayName:'デュラハンテーマ',
    bgmTrackId:'original_dullahan',
    artwork:'images/song-art/dullahan.jpg?v=59f1f7e412a3',
    difficulties:Object.freeze(Object.fromEntries(RHYTHM_DIFFICULTIES.map(({id})=>[
      id,dullahanCharts[id]||emptyRhythmChart()
    ])))
  }),
  Object.freeze({
    songId:'dullahan_clockwork',
    displayName:'呪われた騎士の時計仕掛け',
    bgmTrackId:'melo_dullahan_clockwork',
    artwork:'images/song-art/dullahan-clockwork.jpg?v=2227eb23f4d0',
    difficulties:Object.freeze(Object.fromEntries(RHYTHM_DIFFICULTIES.map(({id})=>[
      id,dullahanClockworkCharts[id]||emptyRhythmChart()
    ])))
  }),
  Object.freeze({
    songId:'toriko',
    displayName:'トリコ',
    bgmTrackId:'melo_toriko',
    artwork:'images/song-art/toriko.jpg?v=6958512f6e28',
    difficulties:Object.freeze(Object.fromEntries(RHYTHM_DIFFICULTIES.map(({id})=>[
      id,torikoCharts[id]||emptyRhythmChart()
    ])))
  }),
  Object.freeze({
    songId:'4u_hitasura',
    displayName:'4U ～ひたすら～',
    bgmTrackId:'melo_4u_hitasura',
    artwork:'images/song-art/4u-hitasura.jpg?v=9e61d34cf67f',
    difficulties:Object.freeze(Object.fromEntries(RHYTHM_DIFFICULTIES.map(({id})=>[
      id,fourUCharts[id]||emptyRhythmChart()
    ])))
  }),
  Object.freeze({
    songId:'kindan_no_resistance',
    displayName:'禁断のレジスタンス',
    bgmTrackId:'melo_kindan_no_resistance',
    artwork:'images/song-art/kindan-no-resistance.jpg?v=2003d7a9424a',
    difficulties:Object.freeze(Object.fromEntries(RHYTHM_DIFFICULTIES.map(({id})=>[
      id,kindanNoResistanceCharts[id]||emptyRhythmChart()
    ])))
  }),
  Object.freeze({
    songId:'crossing_field',
    displayName:'crossing field',
    bgmTrackId:'melo_crossing_field',
    artwork:'images/song-art/crossing-field.jpg?v=7062766e0099',
    difficulties:Object.freeze(Object.fromEntries(RHYTHM_DIFFICULTIES.map(({id})=>[
      id,crossingFieldCharts[id]||emptyRhythmChart()
    ])))
  }),
  Object.freeze({
    songId:'nothing_without_you',
    displayName:'Nothing Without You',
    bgmTrackId:'melo_nothing_without_you',
    artwork:'images/song-art/nothing-without-you.jpg?v=44f9c91f5487',
    difficulties:Object.freeze(Object.fromEntries(RHYTHM_DIFFICULTIES.map(({id})=>[
      id,nothingWithoutYouCharts[id]||emptyRhythmChart()
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
// ============================================================================
// 操作を覚えるためのチュートリアル譜面
// ============================================================================
// 【2026-09-05・ユーザー指示】
// 「初回チュートリアルモードを作ったのに実装されてなかったからいれて／チュートリアル追加／
//   実際の音ゲー画面でやり方や各ノーツの操作方法などまで作って」
//
// それまでのチュートリアルは曲えらびの画面で助手が説明するだけで、
// **実際に叩いて覚える場所が無かった**。ここは演奏画面をそのまま使い、
// ノーツの種類を1つずつ、間を空けて出す専用の譜面。
//
// ・曲は「MF × ICHIKA MIX」(atsu_cup_theme)の頭を使う。拍(355.03ms)に合わせて置くので、
//   練習でも曲に乗って叩ける。専用の音源は増やさない
// ・スコア・自己ベスト・全国ランキングには**一切残さない**(遊びの記録ではないため)
// ・ライフは減っても失敗にならない。何度でも通せる
// ・説明はノーツが出る前に画面へ出し、叩く番になったら消える
const RHYTHM_TUTORIAL_TRACK_ID='atsu_cup_theme';
const RHYTHM_TUTORIAL_BEAT_MS=355.0295857988166;   // rhythm-timing.js の atsu_cup_theme と同じ値
const RHYTHM_TUTORIAL_BEAT_ZERO_MS=40;
// 拍番号 → ミリ秒。ここを1か所にしておかないと、説明とノーツがずれる
const rhythmTutorialMs=beat=>Math.round(RHYTHM_TUTORIAL_BEAT_ZERO_MS+beat*RHYTHM_TUTORIAL_BEAT_MS);
const rhythmTutorialNotes=(()=>{
  const t=rhythmTutorialMs;
  return [
    // ① タップ … いちばん基本。真ん中で幅を広めにして、まず「重なったら叩く」を覚える
    mhTap(t(6),3,4,0), mhTap(t(8),3,4,0), mhTap(t(10),3,4,0), mhTap(t(12),3,4,0),
    // ② 同時押し … 左右の端へ1つずつ。指2本で押す形
    mhTap(t(17),0,3,0), mhTap(t(17),7,3,0),
    mhTap(t(19),0,3,0), mhTap(t(19),7,3,0),
    // ③ ホールド … 押さえたまま、終わりのバーが来たら離す
    mhHoldV2(t(24),3,4,t(27)),
    mhHoldV2(t(29),3,4,t(32)),
    // ④ スライド … 押さえたまま帯をなぞる。左から右へ
    mhSlideV2(t(37),t(41),[[t(37),0,3],[t(39),2,3],[t(41),4,3]]),
    // ⑤ フリック … 上へ払う
    mhFlick(t(46),3,4), mhFlick(t(48),3,4),
    // ⑥ 終点フリック … 離す代わりに、そのまま上へ払って終わる
    mhHoldV2(t(53),3,4,t(56),1),
    // ⑦ モンスターノーツ … 設定していれば絵が出る。設定が無ければただのタップとして流れる
    mhTap(t(61),3,4,1),
  ];
})();
const RHYTHM_TUTORIAL_END_MS=rhythmTutorialMs(66);
const RHYTHM_TUTORIAL_CHART=Object.freeze({
  level:1,notes:Object.freeze(rhythmTutorialNotes),
  totalNotes:rhythmTutorialNotes.length,durationMs:RHYTHM_TUTORIAL_END_MS,
});
// 画面へ出す説明。fromMs から次の説明までのあいだ出しっぱなしにする。
// ノーツが来る2拍前には出し終えているので、読んでから構えられる
const RHYTHM_TUTORIAL_STEPS=Object.freeze([
  {fromMs:0,             title:'まずは「タップ」',       text:'ノーツが下の判定ラインに重なった瞬間に、画面を叩きます。'},
  {fromMs:rhythmTutorialMs(14), title:'2つ同時に「同時押し」', text:'左右に1つずつ出ます。指を2本置いて、同時に叩きます。'},
  {fromMs:rhythmTutorialMs(22), title:'押さえ続ける「ホールド」', text:'叩いたまま押さえて、終わりの光る横棒が判定ラインへ来たら離します。'},
  {fromMs:rhythmTutorialMs(34), title:'なぞる「スライド」',   text:'押さえたまま、帯の道すじを指でなぞります。途中で指を離さないように。'},
  {fromMs:rhythmTutorialMs(43), title:'払う「フリック」',     text:'緑のノーツは、叩いたあと指を上へ払います。向きは上だけです。'},
  {fromMs:rhythmTutorialMs(50), title:'「終点フリック」',     text:'終わりの横棒が緑で上向きの矢印が付いているホールドは、離さずにそのまま上へ払って終わります。'},
  {fromMs:rhythmTutorialMs(58), title:'「モンスターノーツ」', text:'金色のノーツです。GREATより良い判定で取ると、設定したマスモンの能力が出ます。'},
  {fromMs:rhythmTutorialMs(63), title:'ここまで！',           text:'おつかれさま。あとは曲をえらんで遊んでみてください。'},
]);
// いまの時刻に出す説明。曲が始まる前(マイナス)でも先頭を出す
const rhythmTutorialStepAt=songTimeMs=>{
  const now=Number(songTimeMs);
  let found=RHYTHM_TUTORIAL_STEPS[0];
  for(const step of RHYTHM_TUTORIAL_STEPS){
    if(Number.isFinite(now)&&now>=step.fromMs)found=step;
  }
  return found;
};
const RHYTHM_TUTORIAL_SONG=Object.freeze({
  songId:'rhythm_tutorial',
  displayName:'あそびかた練習',
  bgmTrackId:RHYTHM_TUTORIAL_TRACK_ID,
  playDurationMs:RHYTHM_TUTORIAL_END_MS,
  difficulties:Object.freeze({TUTORIAL:RHYTHM_TUTORIAL_CHART}),
});
// 練習の満点は EASY と同じ値にしておく。スコアは記録に残さないが、
// ランクのゲージや「→次のランク」の表示が満点を分母に使うので、0や1にすると壊れる
const RHYTHM_TUTORIAL_DIFFICULTY=Object.freeze({id:'TUTORIAL',maxScore:600000,label:'れんしゅう'});

// ===== タップのタイミング合わせ(2026-09-13・ユーザー指示) =====
// 「今の仕様はみにくすぎるし実用性がない / 特に横画面は終わってる /
//   普通に実際の画面を使ってやればいい / そこで判定も合わせて出して調整するのが1番合うとおもう」。
// ★それまでは**専用の小さな画面**(1本のレーンに目印が降りるだけ)で測っていた。
//   本番と見た目も指の置き方も違ううえ、横持ちでは器の回転を考えていなかった。
// ★なので「れんしゅう」と同じく**演奏画面をそのまま使う**。曲と譜面だけを差し替える。
//   判定もFAST/SLOWもいつもどおり出るので、合っているかを見ながら叩ける。
// 譜面は2拍ごとの単押しを、レーンを順ぐりに動かしながら並べる。
// 片方の手だけで追えるよう、端から端へ飛ばさず隣のレーンへ動かす。
const RHYTHM_CALIBRATION_TAP_COUNT=16;     // 数に入れる回数
const RHYTHM_CALIBRATION_WARMUP_COUNT=4;   // 数えはじめる前の助走
const RHYTHM_CALIBRATION_LANE_ORDER=Object.freeze([2,1,2,3,2,1,2,3]);
const rhythmCalibrationNotes=(()=>{
  const notes=[];
  // 最初の4拍は数に入れない助走。画面にも「かまえて」を出す
  for(let index=0;index<RHYTHM_CALIBRATION_TAP_COUNT+RHYTHM_CALIBRATION_WARMUP_COUNT;index++){
    notes.push({type:'TAP',lane:RHYTHM_CALIBRATION_LANE_ORDER[index%RHYTHM_CALIBRATION_LANE_ORDER.length],
      timeMs:rhythmTutorialMs(4+index*2)});
  }
  return Object.freeze(notes);
})();
const RHYTHM_CALIBRATION_END_MS=rhythmTutorialMs(4+(RHYTHM_CALIBRATION_TAP_COUNT+RHYTHM_CALIBRATION_WARMUP_COUNT)*2+4);
const RHYTHM_CALIBRATION_CHART=Object.freeze({
  level:1,notes:rhythmCalibrationNotes,
  totalNotes:rhythmCalibrationNotes.length,durationMs:RHYTHM_CALIBRATION_END_MS,
});
const RHYTHM_CALIBRATION_SONG=Object.freeze({
  songId:'rhythm_calibration',
  displayName:'タイミング合わせ',
  bgmTrackId:RHYTHM_TUTORIAL_TRACK_ID,
  playDurationMs:RHYTHM_CALIBRATION_END_MS,
  difficulties:Object.freeze({TUTORIAL:RHYTHM_CALIBRATION_CHART}),
});
const RHYTHM_CALIBRATION_DIFFICULTY=Object.freeze({id:'TUTORIAL',maxScore:600000,label:'タイミング合わせ'});

const RHYTHM_SONGS = Object.freeze(RHYTHM_SONG_ENTRIES.map(song=>Object.freeze({...song,
  difficulties:Object.freeze(Object.fromEntries(RHYTHM_DIFFICULTIES.map(({id})=>
    [id,rhythmChartWithLevel(song.songId,id,song.difficulties[id])])))})));

// 先行公開する「音ゲー体験版」で遊べる範囲。ここに書いた曲・難易度だけを体験版の画面へ出す。
// デバッグ画面の曲一覧(RHYTHM_SONGS)とは役割を分ける。デバッグ用の曲を体験版へ出さないため。
// 2026-09-05、ユーザー指示で先行公開の5曲・5難易度になり、同日「風がそよぐ場所」「Close To Your Heart」を足して7曲になった。
// 曲の絵(ジャケット)。**絵がある曲だけ**が絵になり、無い曲は曲idから決まる色のタイルに
// 頭文字が出る(2026-09-05・ユーザー指示「いまのジャケ画は風がそよぐ場所にだけあてはめて」。
// はじめは1枚を全曲の既定にしていたが、それだと曲の見分けがつかなくなるためやめた)。
// 絵を足すときは、その曲のデータへ artwork（images/song-art/ 以下のパス）を1行書く。
// 実体は monster-hero/images/ 以下に置き、ここにはパスだけを書く(base64で埋め戻さない)。
// キャッシュキー(?v=…)は tools/build.js が付け直す。
const rhythmSongArtSrc=song=>{
  const own=song&&typeof song.artwork==='string'?song.artwork.trim():'';
  return own||'';
};

const RHYTHM_DEMO_SONG_IDS=Object.freeze([
  'mf_ichika_mix',
  'monster_hero',
  // 2026-09-08追加。本編BGMの別テイク。ジャケットはMonster Heroと共通。
  'monster_hero_another',
  'six_eternel_remix',
  'stay_with_me',
  'kiki_issen',
  // 2026-09-05 追加。ほかの5曲より譜面をやさしめにしてある1曲。
  // 先頭は全国ランキングの既定を指すので、並びの意味を変えないよう末尾へ足す。
  'kaze_ga_soyogu',
  'close_to_your_heart',
  // 2026-09-05 追加。ボス戦2曲のリミックス。元の曲とは別の曲として並ぶ。
  'eiki_boss_remix',
  'pandora_boss_remix',
  // 2026-09-12 追加。原曲。これまでDEBUG扱いで出していなかった。
  'six_eternel_beat',
  // 2026-09-05 追加。バトルのBGMとして既にあった2曲を、モンビーの曲としても遊べるようにした。
  'dullahan',
  'dullahan_clockwork',
  // 2026-09-06 追加。ユーザーからmp4で受け取った新曲2曲。
  'toriko',
  '4u_hitasura',
  // 2026-09-07 追加。ユーザーからmp4で受け取った新曲。
  'kindan_no_resistance',
  // 2026-09-08 追加。ユーザーからmp4で受け取った新曲。
  'crossing_field',
  // 2026-09-10 追加。ユーザーからmp4で受け取った新曲。
  'nothing_without_you',
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

// ブリーダー別 全曲合算ランキング(2026-09-11)。
// 「曲ごとのベスト1件(難易度は問わない)を全曲ぶん足した合計」で競う
// (docs/spec/RHYTHM_RANKING.md §3)。集計そのものはSupabase側のビューが行うので、
// ここにあるのは画面に出す「全体でどこまで来たか」を出すための道具だけ。
//
// ★曲数をどこにも書かない(docs/spec/RHYTHM_RANKING.md §5.1)。
//   公開曲を1行足したら、分母も達成率も自動で付いてくる。数字を書き写した場所を作らない。
const rhythmTotalRankingSongCount=(songs)=>rhythmDemoSongs(songs||[]).length;
// 全曲すべてでMASTER満点を取ったときの合計(公開曲数 × MASTERの満点)
const rhythmTotalRankingMaxScore=(songs)=>rhythmTotalRankingSongCount(songs)
  *RHYTHM_DIFFICULTIES.reduce((max,d)=>Math.max(max,Number(d.maxScore)||0),0);
// 理論満点に対してどこまで来たか(%)。曲が増えると誰の値も下がるが、それが正しい
// (まだ遊んでいない曲があるということなので)
const rhythmTotalRankingProgress=(totalScore,songs)=>{
  const max=rhythmTotalRankingMaxScore(songs);
  if(!(max>0))return 0;
  return Math.max(0,Math.min(100,(Number(totalScore)||0)/max*100));
};

const installRhythmGestureVisuals=()=>{
  if(typeof document==='undefined'||typeof MutationObserver==='undefined')return;
  if(document.documentElement.dataset.rhythmGestureVisuals==='ready')return;
  document.documentElement.dataset.rhythmGestureVisuals='ready';
  const style=document.createElement('style');
  style.textContent=`
    /* ★ノーツの見た目は必ず [data-rhythm-note-head](粒)を名指しで指す。span:last-child で書くと、
       マスモンの絵が入るノーツでは最後の子が絵(data-rhythm-monster-face)になるため、
       色も矢印も幅広の縁取りも「絵」のほうへ付いてしまう。実際に
       「モンスターノーツとフリックノーツによく分からない縦線がある」という不具合になった(2026-09-07)。 */
    /* FLICKは緑。ヘルプ・終点フリックの終端バー・練習の説明がいずれも「緑」で揃えてあるのに、
       ここだけピンク(#ec4899)になっていて、紫のSLIDE・ピンクのTAPと見分けにくかった。 */
    [data-rhythm-note][data-note-type="FLICK"] > [data-rhythm-note-head]{background:linear-gradient(180deg,#bbf7d0,#22c55e 52%,#15803d)!important;border-color:rgba(220,252,231,.98)!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.8),0 0 16px rgba(34,197,94,.7)!important}
    [data-rhythm-note][data-note-type="SLIDE"] > [data-rhythm-note-head]{background:linear-gradient(180deg,#ddd6fe,#a855f7 58%,#6d28d9)!important;border-color:rgba(221,214,254,.95)!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.82),0 0 16px rgba(168,85,247,.64)!important}
    /* 上へ払う矢印。文字(▲)の疑似要素だと幅広ノーツの縁取り(::before/::after)と場所を取り合ううえ、
       端末のフォントで大きさが変わる。実体のある要素へ切り出し、clip-path で三角を描く。
       --rhythm-note-cap-scale は発熱対策(粒を scaleX で縮める案・撤回済み)の名残で、いまは書かれないので 1 のまま。 */
    [data-rhythm-flick-arrow]{position:absolute;left:50%;bottom:calc(100% + 2px);z-index:2;width:24px;height:17px;
      transform:translateX(-50%) scaleX(calc(1 / var(--rhythm-note-cap-scale,1)));transform-origin:50% 100%;
      background:linear-gradient(180deg,#f0fdf4,#4ade80 60%,#16a34a);
      clip-path:polygon(50% 0,100% 100%,0 100%);
      filter:drop-shadow(0 0 4px rgba(34,197,94,.95)) drop-shadow(0 1px 2px rgba(2,6,23,.85));pointer-events:none}
    /* 終点フリックの終端バー。「ここで弾く」ことが一目で分かるよう、単発FLICKと同じ緑・同じ矢印に揃える。
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
    [data-rhythm-note][data-rhythm-clear] > [data-rhythm-note-head],[data-rhythm-note][data-rhythm-clear] > [data-rhythm-monster-face]{animation:rhythm-clear-pop .26s ease-out forwards}
    [data-rhythm-note][data-rhythm-clear] > [data-rhythm-hold-body],[data-rhythm-note][data-rhythm-clear] > [data-rhythm-end-bar]{opacity:0}
    @keyframes rhythm-clear-pop{from{transform:scale(1);opacity:.95}to{transform:scale(2.1);opacity:0}}
    [data-rhythm-end-bar][data-rhythm-end-flick]{background-image:linear-gradient(90deg,#22c55e,#f0fdf4 50%,#22c55e)!important;border-color:rgba(220,252,231,.98)!important}
    /* 終点フリックの矢印も、単発FLICKと同じ大きさ・同じ形(clip-pathの三角)にそろえる。
       文字(⇧)のままだと端末のフォント次第で細く小さく出るため、実体のある三角にする。 */
    [data-rhythm-end-bar][data-rhythm-end-flick]::after{content:"";position:absolute;left:50%;bottom:calc(100% + 2px);width:24px;height:17px;
      transform:translateX(-50%) scaleX(calc(1 / var(--rhythm-end-width-scale, 1))) scaleY(calc(1 / var(--rhythm-end-depth-scale, 1)));transform-origin:50% 100%;
      background:linear-gradient(180deg,#f0fdf4,#4ade80 60%,#16a34a);clip-path:polygon(50% 0,100% 100%,0 100%);
      filter:drop-shadow(0 0 4px rgba(34,197,94,.95)) drop-shadow(0 1px 2px rgba(2,6,23,.85));pointer-events:none}
    svg[data-rhythm-slide-body]{position:absolute;inset:0;height:var(--rhythm-slide-area-height,0px)!important;overflow:visible;pointer-events:none;filter:drop-shadow(0 0 5px rgba(168,85,247,.38))}
    /* ポリゴンの継ぎ目は遠近へ沿わせるための10等分で、判定とは無関係。線としては描かない。
       2026-09-12・ユーザー指摘「スライドの判定って目の細かさでわかるようになってる？」
       直す前はこの継ぎ目に縁取りが付いていたため、判定と無関係な横線が帯じゅうに出ていた。 */
    [data-rhythm-slide-segment]{fill:rgba(168,85,247,.48);stroke:none}
    /* 帯のふち。継ぎ目を描くのをやめたぶん、外周だけを1本の線でなぞって輪郭を保つ。 */
    [data-rhythm-slide-edge]{fill:none;stroke:rgba(233,213,255,.56);stroke-width:1;stroke-linejoin:round}
    /* チェックポイント＝そこで判定が入るところ。ここだけはっきり見せる。
       目の細かさがそのまま「判定の細かさ」になるので、見た目と判定が一致する。 */
    [data-rhythm-slide-checkpoint]{stroke:rgba(233,213,255,.85);stroke-width:2;stroke-linecap:round}
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
    // ここでHUDの表記を 'MIX TEST' へ書き換えていた(デバッグ画面で譜面の種類を見るためのもの)。
    // FLICK/SLIDEを含む譜面ならいつでも書き換えていたので、
    // 体験版から入ったプレイヤーの画面にも「MIX TEST」と出ていた
    // (2026-09-05・実機の指摘「ここがデバッグのままになってる」)。
    // 表記はReact側(data-rhythm-mode-label)が譜面から決めるので、ここでは触らない。
  };
  // decorate() は area 配下の全ノーツを引き直すので、DOMのどんな変化でも走ると重い。
  // (スコア・コンボ・判定表示の書き換えなど、ノーツと無関係な変化でも呼ばれていた)
  // ノーツ・プレイエリア・モード表記が増減したときだけ走らせる。やることは変えない。
  const RHYTHM_DECORATE_TARGET='[data-rhythm-note],[data-rhythm-play-area]';
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
    /* canvas でノーツを描くとき(2026-09-07)。canvas はノーツと同じ層に置く。
       マスモンの絵だけは DOM の要素のまま canvas の上へ重ね、tick が transform で動かす(絵の染色を触らないため)。 */
    [data-rhythm-note-canvas]{position:absolute;left:0;top:0;pointer-events:none;z-index:5}
    [data-rhythm-canvas-face]{position:absolute;left:0;top:0;width:42px;height:42px;pointer-events:none;z-index:6;will-change:transform}
    [data-rhythm-canvas-face]>[data-rhythm-canvas-face-art]{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;transform:scale(var(--rhythm-face-scale,1));filter:drop-shadow(0 1px 2px rgba(0,0,0,.58)) drop-shadow(0 0 4px rgba(253,224,71,.55))}
    [data-rhythm-canvas-face][data-rhythm-clear="1"]>[data-rhythm-canvas-face-art]{animation:rhythm-clear-pop .26s ease-out forwards;filter:none}
    [data-rhythm-canvas-face]>[data-rhythm-canvas-face-art]>*{border:0!important;outline:0!important;border-radius:0!important;background:transparent!important;box-shadow:none!important;clip-path:none!important}
    [data-rhythm-lane][data-pressed="true"]{background:linear-gradient(180deg,rgba(34,211,238,.10),rgba(34,211,238,.22) 54%,rgba(217,70,239,.30) 100%)!important;box-shadow:inset 0 0 30px rgba(103,232,249,.48),inset 0 -72px 64px rgba(6,182,212,.34),0 0 15px rgba(34,211,238,.24)!important;border:0!important;filter:none!important}
    /* --rhythm-note-depth-brightness は落下中まいフレーム書き換えている。そこへ40msの
       transitionを付けると、目標値が毎フレーム置き換わるので補間はほぼ働かず、
       それでいて「動いている遷移」を全ノーツぶん抱え続けることになる。
       実測(デスクトップChromium・266ノーツ/同時表示5)で、毎フレームの
       style+layoutが 0.786ms → 0.332ms と半分以下になった。
       明るさは元から位置の関数として滑らかに変わるため、見た目は変えていない。 */
    [data-rhythm-note]>[data-rhythm-note-head]{transform:scale(var(--rhythm-note-size-scale,1)) scaleY(var(--rhythm-note-depth-scale,1));transform-origin:center;filter:brightness(var(--rhythm-note-depth-brightness,1))}
    /* 幅広ノーツ(5サブレーン以上)は、丸い粒を横に引き伸ばした形だと「どこからどこまでか」が
       読み取りにくい。プロセカ・チュウニズムの幅広ノーツと同じく、角を落とした棒にして
       両端へ明るい縁を置く。塗りは静的なCSSだけで作るので、毎フレームの負担は増えない。 */
    [data-rhythm-note][data-rhythm-note-wide="1"]>[data-rhythm-note-head]{border-radius:7px!important}
    [data-rhythm-note][data-rhythm-note-wide="1"]>[data-rhythm-note-head]::before,
    [data-rhythm-note][data-rhythm-note-wide="1"]>[data-rhythm-note-head]::after{
      content:"";position:absolute;top:1px;bottom:1px;width:3px;border-radius:3px;
      background:linear-gradient(180deg,rgba(255,255,255,.95),rgba(255,255,255,.55));pointer-events:none}
    [data-rhythm-note][data-rhythm-note-wide="1"]>[data-rhythm-note-head]::before{left:1px}
    [data-rhythm-note][data-rhythm-note-wide="1"]>[data-rhythm-note-head]::after{right:1px}
    [data-rhythm-note][data-rhythm-failed="true"]{filter:grayscale(1) brightness(.72)!important}
    [data-rhythm-note][data-rhythm-failed="true"]>[data-rhythm-note-head]{box-shadow:none!important;border-color:rgba(148,163,184,.6)!important}
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
    /* 粒の色は1つずつ変えられるようにしておく(MARVELOUSの虹)。
       ふだんは全部 --rhythm-hit-color と同じ値が入るので、見た目は変わらない */
    [data-rhythm-hit-effect]>u{left:50%;top:0;width:7px;height:7px;margin:-3.5px 0 0 -3.5px;
      background:var(--rhythm-hit-color,#fff)}
    [data-rhythm-hit-effect]>u:nth-of-type(1){background:var(--rhythm-spark-color-1,var(--rhythm-hit-color,#fff))}
    [data-rhythm-hit-effect]>u:nth-of-type(2){background:var(--rhythm-spark-color-2,var(--rhythm-hit-color,#fff))}
    [data-rhythm-hit-effect]>u:nth-of-type(3){background:var(--rhythm-spark-color-3,var(--rhythm-hit-color,#fff))}
    [data-rhythm-hit-effect]>u:nth-of-type(4){background:var(--rhythm-spark-color-4,var(--rhythm-hit-color,#fff))}
    [data-rhythm-hit-effect]>u:nth-of-type(5){background:var(--rhythm-spark-color-5,var(--rhythm-hit-color,#fff))}
    /* ぴったりのMARVELOUSだけ、横へ広がるフラッシュと上へ抜ける光の柱も虹にする。
       ふつうのMARVELOUSは金(--rhythm-hit-color)のまま(2026-09-12・ユーザー指示で
       虹はジャストマーベラス専用にした) */
    [data-rhythm-hit-effect][data-hit-precise="1"]>i{
      background:linear-gradient(90deg,#f87171,#fbbf24,#a3e635,#22d3ee,#a78bfa,#f472b6)}
    [data-rhythm-hit-effect][data-hit-precise="1"]>b{
      background:linear-gradient(to top,#f472b6 0%,#a78bfa 24%,#22d3ee 46%,#a3e635 64%,rgba(251,191,36,.35) 82%,rgba(255,255,255,0) 100%)}
    /* 上の判定ほど光を明るくする(2026-09-12・ユーザー指示
       「色合い発光を判定が上がるたびにもっときれいにめだつように」) */
    [data-rhythm-hit-effect][data-hit-judgment="MARVELOUS"]>i,
    [data-rhythm-hit-effect][data-hit-judgment="MARVELOUS"]>b{filter:brightness(1.22) saturate(1.15)}
    [data-rhythm-hit-effect][data-hit-judgment="EXCELLENT"]>i,
    [data-rhythm-hit-effect][data-hit-judgment="EXCELLENT"]>b{filter:brightness(1.12) saturate(1.1)}
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
    /* ★倍率(--mh-combo-scale)を掛けたうえで弾ませる。素の scale(1) へ戻すと、
       段が上がって大きくしたコンボ数が跳ねるたびに一瞬だけ元の大きさへ縮む(2026-09-12)。 */
    @keyframes mhRhythmComboPop{
      0%{transform:scale(calc(var(--mh-combo-scale,1)*1.34))}
      55%{transform:scale(calc(var(--mh-combo-scale,1)*.97))}
      100%{transform:scale(var(--mh-combo-scale,1))}}
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
  
    /* --- 装飾を個別に切る(デバッグ限定) ---
       data-rhythm-strip に書いた語だけを切る。ふだんは属性そのものが付かないので何も起きない。
       実機で「何が重いか」を総当たりするための逃げ道。見た目は変わるが、判定には一切関わらない。 */
    [data-rhythm-play-area][data-rhythm-strip~="glow"]::after{content:none!important}
    [data-rhythm-play-area][data-rhythm-strip~="grid"]::before{content:none!important}
    [data-rhythm-play-area][data-rhythm-strip~="bg"]{background:#050817!important;box-shadow:none!important}
    [data-rhythm-play-area][data-rhythm-strip~="lane"] [data-rhythm-lane]{filter:none!important;box-shadow:none!important}
    [data-rhythm-play-area][data-rhythm-strip~="lane"] [data-rhythm-lane]::before{content:none!important}
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
// ===== 判定ごとの色(2026-09-12・ユーザー指示) =====
// 「もっと色分けをして良い判定ならそれだけ派手にしたい / マーベラスは虹など」。
//
// ★**判定文字も、判定ラインで弾ける光も、ここ1か所から取る。**
//   前は文字がTailwindのクラス(30-rhythm-play.jsx)、光がここ、と2か所に分かれていて、
//   同じ判定でも微妙に色が違っていた(MARVELOUSが文字 #fae8ff / 光 #f5d0fe など)。
//   しかも上位2つ(MARVELOUS・EXCELLENT)が白に近く、下位のほうがはっきり見えていた。
//
// 上へ行くほど派手にする。
//   MARVELOUS … 虹(流れる)      ← いちばん派手
//   EXCELLENT … 金
//   GREAT     … 水色
//   GOOD      … 黄緑
//   BAD       … 橙
//   MISS      … 灰(光は出さない)
// ★MARVELOUSだけは単色ではなく虹。ここへ置くのは「虹にできない場所で使う代表の色」で、
//   虹そのものは data-judgment を見たCSSが描く(文字のグラデーション・粒の色分け)。
// ★色の入れ替え(2026-09-12・ユーザー指示)
//   「普通のマーベラスとエクセレントの色の違いがあまりわからない」
//   「マーベラスを金 / エクセレントをピンク紫系にかえよう」
//   虹は**ジャストマーベラス(ぴったり)だけのもの**にした。ふつうのMARVELOUSが虹だと、
//   流れる途中で金の瞬間があり、金のEXCELLENTと見分けが付かなかった。
// ★GREATが赤なのはユーザー指示「グレートは赤系のほうが強く見える」。
//   BADはその赤からいちばん遠い青へ逃がしてある(冷たい色＝良くないの読みにも合う)。
//
// 色相: MARVELOUS 43° / EXCELLENT 292° / GREAT 0° / GOOD 85° / BAD 213°。
// いちばん近い組(MARVELOUS-GOOD)でも42度あり、ノーツの色分けと同じ約束(40度以上)を満たす。
//
// ここが持つのは**判定ラインで弾ける光に使う単色**で、判定文字のグラデーションは
// index.html が data-judgment ごとに持つ。**文字のグラデーションには必ずこの色を含める**
// (rhythm-hit-effect-check.js が、表の色が文字のCSSに入っているかを突き合わせる)。
const RHYTHM_JUDGMENT_COLORS=Object.freeze({
  MARVELOUS:'#fbbf24',EXCELLENT:'#e879f9',GREAT:'#f87171',GOOD:'#a3e635',BAD:'#60a5fa',MISS:'#94a3b8',
});
const rhythmJudgmentColor=judgment=>RHYTHM_JUDGMENT_COLORS[String(judgment||'')]||'#e2e8f0';
// ジャストマーベラスの虹を作る色。文字のグラデーションと、はじける粒の色分けに使う
const RHYTHM_JUDGMENT_RAINBOW=Object.freeze(['#f87171','#fbbf24','#a3e635','#22d3ee','#a78bfa','#f472b6']);
// ===== ぴったりのMARVELOUS(2026-09-12・ユーザー指示) =====
// 「マーベラスをさらに完璧なタイミングで踏んだマーベラスを判定の見ためだけさらによくしたい /
//   scoreはかわらず」。
//
// ★**見た目だけ。** 判定の名前・スコア・コンボ・ライフ・判定数・FAST/SLOWの数え方・
//   自己ベスト・全国ランキングのどれにも一切関わらない。ここで決まるのは
//   「その1回の表示を強くするか」だけで、run には何も残さない。
// MARVELOUSの窓は±55ms。その中でも±20msに収まったときを「ぴったり」とする。
// 判定タイミング調整(judgmentTimingOffsetMs)を通したあとのズレを見るので、
// 自分で合わせた人の手元でもそのまま効く。
const RHYTHM_JUDGMENT_PRECISE_MS = 20;
const rhythmJudgmentIsPrecise=(judgment,deltaMs)=>{
  if(judgment!=='MARVELOUS')return false;
  // ★null / undefined / 空文字は Number() では0(=ぴったり)になってしまう。
  //   ズレが分からないときに「ぴったり」を名乗らせない
  if(deltaMs===null||deltaMs===undefined||deltaMs==='')return false;
  const delta=Number(deltaMs);
  return Number.isFinite(delta)&&Math.abs(delta)<=RHYTHM_JUDGMENT_PRECISE_MS;
};
// 判定ラインで弾ける光の色。MISSでは光を出さないので、そこは使われない
const rhythmHitEffectColor=judgment=>rhythmJudgmentColor(judgment);
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
// ── CSSアニメーションの「流し直し」を、1フレームに1回のレイアウトで済ませる ──────────
//
// 【2026-09-12・ユーザー指摘】
// 「モンスターノーツでかくつきがまた出てきた / 曲もあわせて遅くなる(重くなる？)ときもある」
//
// 同じ要素へ同じ印を付け直しても、CSSアニメーションは頭から流れ直さない。そこで
// 「印を外す → void el.offsetWidth → 印を付ける」という書き方をしていた。
// この offsetWidth の読み取りが**ページ全体のレイアウトをその場で計算し直させる**
// (強制同期レイアウト)。箇所ごとに書いていたので、モンスターノーツを取った1フレームで
// 5回も計算し直していた(ふつうのノーツは3回)。
//
//   ヒット演出 / 画面フラッシュ / サイドのマスモンの歓声 / 判定文字 / コンボ数
//
// 外す→読む→付ける の「読む」は1回で足りる。まとめて外し、1回だけ読み、まとめて付ける。
// **見た目も再生の始まる時刻も変わらない**(同じ処理の中で終わるため)。
const rhythmRestartAnimations=entries=>{
  const list=(Array.isArray(entries)?entries:[]).filter(entry=>entry&&entry.el&&entry.attr);
  if(!list.length)return 0;
  for(const entry of list)entry.el.dataset[entry.attr]='';
  // ここ1回だけ。印を外したことを確定させるためにレイアウトを読む
  void list[0].el.offsetWidth;
  for(const entry of list)entry.el.dataset[entry.attr]=entry.value===undefined?'1':entry.value;
  return list.length;
};
// defer:true を渡すと、印を付けずに「付けるべき印」だけを返す。
// 呼び出し側が rhythmRestartAnimations へまとめて渡すことで、レイアウトの読み取りを1回にできる。
const rhythmSpawnHitEffect=(area,{centerRatio,widthRatio,judgment,monster=false,precise=false,defer=false})=>{
  const layer=rhythmEnsureHitEffects(area);
  if(!layer||!layer._rhythmPool.length)return null;
  const item=layer._rhythmPool[layer._rhythmNext%layer._rhythmPool.length];
  layer._rhythmNext=(layer._rhythmNext+1)%layer._rhythmPool.length;
  const kind=monster?'MONSTER':'NORMAL';
  const width=Math.max(.06,Math.min(1,Number(widthRatio)||.1))*(monster?1.5:1.15);
  item.style.setProperty('--rhythm-hit-center',`${(Math.max(0,Math.min(1,Number(centerRatio)||.5))*100).toFixed(2)}%`);
  item.style.setProperty('--rhythm-hit-width',`${(width*100).toFixed(2)}%`);
  item.style.setProperty('--rhythm-hit-color',monster?'#fde047':rhythmHitEffectColor(judgment));
  // MARVELOUSだけ、はじける粒を1つずつ違う色にして虹にする(2026-09-12)。
  // 単色のまま虹に見せる手が無いので、粒そのものの色をCSS変数で配る。
  // ★モンスターノーツは金色を優先する(そちらが特別扱いなので、虹で上書きしない)
  const rainbowHit=!monster&&precise&&judgment==='MARVELOUS';
  RHYTHM_JUDGMENT_RAINBOW.forEach((color,index)=>{
    item.style.setProperty(`--rhythm-spark-color-${index+1}`,
      rainbowHit?color:'var(--rhythm-hit-color,#fff)');
  });
  // 判定ごとに光の強さを変えられるようにする(上の判定ほど明るく)。モンスターノーツは別扱い
  item.dataset.hitJudgment=monster?'':String(judgment||'');
  item.dataset.hitPrecise=rainbowHit?'1':'';
  item.style.setProperty('--rhythm-hit-ms',`${RHYTHM_HIT_EFFECT_MS[kind]}ms`);
  // ぴったりのMARVELOUSは粒を遠くまで飛ばす(見た目だけ・2026-09-12)。
  // モンスターノーツの2.1倍はそのまま優先する(そちらが特別扱いのため)
  item.style.setProperty('--rhythm-spark-scale',monster?'2.1':(rainbowHit?'1.45':'1'));
  // 同じ要素をすぐ使い回すときは、アニメーションを一度切らないと最初から再生されない。
  // defer なら「切って付け直す」を呼び出し側のまとめ処理へ譲る(レイアウトの読み取りを1回にするため)。
  if(defer)return {el:item,attr:'rhythmHitKind',value:kind};
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
// プレイエリア**高さ**に対する最大の大きさ。
// 幅だけで決めていたころ、横持ちは幅が広く高さが低いので、同じ「幅の17%」でも
// 画面の半分近くを占めてしまい、とくに上の段が巨大に見えていた
// (2026-09-07・ユーザー報告「縦画面だと普通だけど横画面だと上側のマスモンがでかい」)。
// 上下2段を置いても重ならず、縦持ちの見え方(高さの約9%)と近くなる値。
const RHYTHM_SIDE_MONSTER_HEIGHT_RATIO=.20;
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
  // ★幅だけでなく高さでも頭打ちにする。横持ちは幅が広く高さが低いので、
  //   幅だけで決めると画面の半分近くを占めてしまう(2026-09-07・ユーザー報告)
  const heightCap=height>0?height*RHYTHM_SIDE_MONSTER_HEIGHT_RATIO:Infinity;
  const sizeFor=free=>Math.max(24,Math.min(Math.min(RHYTHM_SIDE_MONSTER_MAX_RATIO,free*RHYTHM_SIDE_MONSTER_FILL)*width,heightCap));
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
  const rect=RHYTHM_VIEW_ROTATION.rectOf(area);
  if(!(rect&&rect.width>0&&rect.height>0))return;
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
  const rect=RHYTHM_VIEW_ROTATION.rectOf(area);
  if(!(rect&&rect.width>0&&rect.height>0))return;
  Array.from(area.querySelectorAll('[data-rhythm-lane]')).forEach((lane,index)=>{
    lane.style.clipPath=rhythmLanePolygon(index);
    lane.style.setProperty('--rhythm-boundary-clip',rhythmBoundaryLinePolygon(index));
    if(index===RHYTHM_LANE_COUNT-1)lane.style.setProperty('--rhythm-right-clip',rhythmBoundaryLinePolygon(RHYTHM_LANE_COUNT,-1));
    const label=lane.querySelector('span');
    if(label){
      const labelRect=RHYTHM_VIEW_ROTATION.rectOf(label),labelY=rhythmClamp01((labelRect.top-rect.top+labelRect.height/2)/rect.height),at=rhythmProjectLane(index,labelY);
      label.style.left=`${at.center*100}%`;
      label.style.transform='translateX(-50%)';
    }
  });
  Array.from(area.querySelectorAll('[data-rhythm-sublane-boundary]')).forEach((boundary,index)=>{
    boundary.style.setProperty('--rhythm-sub-clip',rhythmBoundaryLinePolygon(index+.5));
  });
  rhythmLayoutSideMonsters(area);
  const line=area.querySelector('[data-rhythm-judgment-line]'),lineRect=RHYTHM_VIEW_ROTATION.rectOf(line);
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
  // 外周(ふち)の点列も同じループで作る。あとからもう一度投影し直すと、
  // 画面に出ているSLIDEのぶんだけ毎フレームの計算が倍になるため。
  const head=from,rights=[],lefts=[];
  for(let index=Math.max(1,firstIndex);index<source.length;index++){
    const toPoint=source[index],fromTime=Number(fromPoint.timeMs),toTime=Number(toPoint.timeMs),spanMs=toTime-fromTime;
    for(let step=1;step<=RHYTHM_SLIDE_SEGMENT_STEPS;step++){
      const ratio=step/RHYTHM_SLIDE_SEGMENT_STEPS,timeMs=fromTime+spanMs*ratio;
      const to=step===RHYTHM_SLIDE_SEGMENT_STEPS?project(toPoint):project({timeMs,lane:rhythmSlideExpectedLane(note,timeMs)});
      segments.push(`${from.left.toFixed(2)},${from.y.toFixed(2)} ${from.right.toFixed(2)},${from.y.toFixed(2)} ${to.right.toFixed(2)},${to.y.toFixed(2)} ${to.left.toFixed(2)},${to.y.toFixed(2)}`);
      rights.push(`${to.right.toFixed(2)},${to.y.toFixed(2)}`);
      lefts.push(`${to.left.toFixed(2)},${to.y.toFixed(2)}`);
      from=to;
    }
    fromPoint=toPoint;
  }
  // 右のふちを手前から奥へ、左のふちを奥から手前へ。閉じた輪郭になる。
  segments.outline=rights.length
    ?`${head.right.toFixed(2)},${head.y.toFixed(2)} ${rights.join(' ')} ${lefts.reverse().join(' ')} ${head.left.toFixed(2)},${head.y.toFixed(2)}`
    :'';
  return segments;
};
// チェックポイントを横線として置く場所。帯と同じ手順で投影する。
// まだ来ていない(判定ラインより先の)ぶんだけ描く。通り過ぎたぶんは帯自体が描かれない。
const rhythmSlideCheckpointLines=(note,chartNowMs,travel,rect,noteHalfHeight=Number(travel.noteHalfHeight)||0)=>{
  const times=note?._rhythmSlideCheckpoints;
  if(!Array.isArray(times)||!times.length||!rect||!(rect.height>0))return [];
  const now=Number(chartNowMs)||0,lines=[];
  for(let index=0;index<times.length;index++){
    const at=Number(times[index]);
    if(!Number.isFinite(at)||at<=now)continue;
    const progress=1-(at-Number(travel.visualTime))/Number(travel.travelMs);
    const y=Number(travel.spawnY)+rhythmProjectTravelProgress(progress)*Number(travel.travelPx)+noteHalfHeight;
    if(!Number.isFinite(y)||y<-rect.height||y>rect.height)continue;
    const yRatio=rhythmClamp01(y/rect.height);
    const span=rhythmProjectSlideSpan(rhythmSlideExpectedLane(note,at),note,yRatio,at);
    const half=rect.width*span.width*RHYTHM_BODY_WIDTH_RATIO/2;
    lines.push({x1:rect.width*span.center-half,x2:rect.width*span.center+half,y});
  }
  return lines;
};
// SVGの中を「帯(fill)」と「チェックポイントの線(marks)」の2つのグループへ分ける。
// 1つの親へ混ぜると、childNodes[index] の使い回しで polygon と line が入れ違う。
// 見つけた結果は body へ覚えるので、毎フレームの querySelector にはならない。
const RHYTHM_SLIDE_GROUP_ATTRS=Object.freeze({fill:'data-rhythm-slide-fill',edge:'data-rhythm-slide-edge-layer',marks:'data-rhythm-slide-marks'});
const RHYTHM_SLIDE_GROUP_CACHE_KEYS=Object.freeze({fill:'_rhythmSlideFill',edge:'_rhythmSlideEdge',marks:'_rhythmSlideMarks'});
const rhythmSlideGroup=(body,kind)=>{
  const attr=RHYTHM_SLIDE_GROUP_ATTRS[kind]||RHYTHM_SLIDE_GROUP_ATTRS.fill;
  const cacheKey=RHYTHM_SLIDE_GROUP_CACHE_KEYS[kind]||RHYTHM_SLIDE_GROUP_CACHE_KEYS.fill;
  const cached=body[cacheKey];
  if(cached&&cached.parentNode===body)return cached;
  // 検査の簡易DOMのように querySelector を持たない相手でも落ちないようにする。
  // 見つからなければ作るだけなので、無い場合はそのまま作る側へ進んでよい。
  let group=typeof body.querySelector==='function'?body.querySelector(`[${attr}]`):null;
  if(!group){
    group=document.createElementNS('http://www.w3.org/2000/svg','g');
    group.setAttribute(attr,'');
    body.appendChild(group);
  }
  body[cacheKey]=group;
  return group;
};
// 2026-09-07: 「幅は scaleX・帯は scaleY・明るさは影の層」で描く発熱対策を試したが、iPhone(WebKit)で
// 以前よりカクつく・モンスターノーツを取ったあとに飛ぶ、という報告が続いたため、描き方はこの版(0c3a016)へ戻した。
// 発熱の対策は canvas 化で仕切り直す(docs/spec/RHYTHM_MODE.md「演奏中の発熱対策」)。
const rhythmLayoutNoteVisual=(el,note,yPx,visualLane,area,releaseYpx=null,slideTravel=null,frameLayout=null)=>{
  if(!el||!area)return;
  // フレーム共有のrectが渡っていればlayout readは発生しない。渡っていない場合だけ数える
  if(!frameLayout?.rect)RHYTHM_PERF.layoutRead();
  const rect=frameLayout?.rect||RHYTHM_VIEW_ROTATION.rectOf(area);
  if(!(rect&&rect.width>0&&rect.height>0))return;
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
    // 呼ぶ順がそのまま重なり順になる(帯 → ふち → チェックポイント)。
    const fill=rhythmSlideGroup(body,'fill'),edge=rhythmSlideGroup(body,'edge'),marks=rhythmSlideGroup(body,'marks');
    const polygons=slideTravel?rhythmSlideSegmentPolygons(note,slideTravel.chartNowMs,slideTravel,rect,noteHeight/2):[];
    RHYTHM_PERF.slidePolygons(polygons.length);
    polygons.forEach((points,index)=>{
      let segment=fill.childNodes[index];
      if(!segment){segment=document.createElementNS('http://www.w3.org/2000/svg','polygon');segment.dataset.rhythmSlideSegment='';fill.appendChild(segment);}
      segment.style.display='';
      if(segment._rhythmPoints!==points){segment.setAttribute('points',points);segment._rhythmPoints=points;}
    });
    for(let index=polygons.length;index<fill.childNodes.length;index++)fill.childNodes[index].style.display='none';
    // 帯のふち。継ぎ目を描かなくなったぶん、外周だけをなぞって輪郭を保つ。
    const outline=polygons.outline||'';
    let edgeShape=edge.firstChild;
    if(outline){
      if(!edgeShape){edgeShape=document.createElementNS('http://www.w3.org/2000/svg','polygon');edgeShape.dataset.rhythmSlideEdge='';edge.appendChild(edgeShape);}
      edgeShape.style.display='';
      if(edgeShape._rhythmPoints!==outline){edgeShape.setAttribute('points',outline);edgeShape._rhythmPoints=outline;}
    }else if(edgeShape)edgeShape.style.display='none';
    // チェックポイントの横線。ここで判定が入るので、帯の継ぎ目より濃く出す。
    const checkpointLines=slideTravel?rhythmSlideCheckpointLines(note,slideTravel.chartNowMs,slideTravel,rect,noteHeight/2):[];
    checkpointLines.forEach((line,index)=>{
      let mark=marks.childNodes[index];
      if(!mark){mark=document.createElementNS('http://www.w3.org/2000/svg','line');mark.dataset.rhythmSlideCheckpoint='';marks.appendChild(mark);}
      mark.style.display='';
      const key=`${line.x1.toFixed(1)}/${line.x2.toFixed(1)}/${line.y.toFixed(1)}`;
      if(mark._rhythmLineKey!==key){
        mark.setAttribute('x1',line.x1.toFixed(2));mark.setAttribute('y1',line.y.toFixed(2));
        mark.setAttribute('x2',line.x2.toFixed(2));mark.setAttribute('y2',line.y.toFixed(2));
        mark._rhythmLineKey=key;
      }
    });
    for(let index=checkpointLines.length;index<marks.childNodes.length;index++)marks.childNodes[index].style.display='none';
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

// ===================== ノーツを canvas 1枚へ描く(2026-09-07) =====================
// 演奏中の発熱対策。DOM のまま軽くする案(幅を scaleX・帯を scaleY・明るさを影の層)は iPhone(WebKit)で
// 逆効果だったため撤回し、ノーツ・HOLD帯・SLIDE帯・終わりの横棒・矢印・モンスターノーツの光を、
// プレイエリアと同じ大きさの canvas 1枚へ毎フレーム描き直す。
// ブラウザ側の「どこが変わったか」の調べ直し・要素ごとの塗り直し・レイヤーの合成が、canvas 1枚ぶんで済む。
//
// 変わらないもの: 判定・入力・スコア・譜面・投影(rhythmProjectLane など)。座標は DOM 版と同じ式から出す。
// 変わるもの: ぼかし(box-shadow / drop-shadow)は毎フレーム計算せず、種類ごとに一度だけ描いた画像(3分割)を貼る。
// マスモンの絵(染色済み・透明部分あり)だけは DOM の要素のまま、canvas の上へ重ねて transform で動かす。
// 公開フラグ RELEASE_FLAGS.rhythmCanvasNotes と、デバッグ画面の上書き(mh_rhythm_canvas_v1)で DOM 版と切り替える。
const RHYTHM_CANVAS_KEY='mh_rhythm_canvas_v1';
const rhythmCanvasNotesPreference=()=>{try{if(typeof localStorage==='undefined')return '';const value=localStorage.getItem(RHYTHM_CANVAS_KEY);return value==='canvas'||value==='dom'?value:'';}catch{return '';}};
const rhythmCanvasNotesSetPreference=value=>{
  const next=value==='canvas'||value==='dom'?value:'';
  try{if(typeof localStorage!=='undefined'){if(next)localStorage.setItem(RHYTHM_CANVAS_KEY,next);else localStorage.removeItem(RHYTHM_CANVAS_KEY);}}catch{}
  return next;
};
// 公開フラグが立っていれば canvas。デバッグ画面の上書き('canvas' / 'dom')があればそちらが勝つ(実機で交互に比べるため)
const rhythmCanvasNotesActive=flagOn=>{const pref=rhythmCanvasNotesPreference();if(pref==='canvas')return true;if(pref==='dom')return false;return flagOn===true;};

// SLIDE の帯の区切り。rhythmSlideSegmentPolygons と同じ手順で、文字列ではなく数値で返す(canvas 用)。
const rhythmSlideSegmentQuads=(note,chartNowMs,travel,rect,noteHalfHeight=Number(travel.noteHalfHeight)||0)=>{
  const source=note?._rhythmSlideRenderPoints||rhythmSlidePoints(note),start=Number(source[0]?.timeMs)||0,end=Number(source[source.length-1]?.timeMs)||start;
  const now=Math.max(start,Math.min(end,Number(chartNowMs)||start));
  const project=point=>{
    const progress=1-(Number(point.timeMs)-Number(travel.visualTime))/Number(travel.travelMs),y=Number(travel.spawnY)+rhythmProjectTravelProgress(progress)*Number(travel.travelPx)+noteHalfHeight,yRatio=rhythmClamp01(y/rect.height),span=rhythmProjectSlideSpan(point.lane,note,yRatio,point.timeMs),half=rect.width*span.width*RHYTHM_BODY_WIDTH_RATIO/2;
    return {y,left:rect.width*span.center-half,right:rect.width*span.center+half};
  };
  let firstIndex=0;
  while(firstIndex<source.length&&Number(source[firstIndex].timeMs)<=now)firstIndex++;
  const quads=[];
  const startPoint=now>start?{timeMs:now,lane:rhythmSlideExpectedLane(note,now)}:source[0];
  let fromPoint=startPoint,from=project(startPoint);
  for(let index=Math.max(1,firstIndex);index<source.length;index++){
    const toPoint=source[index],fromTime=Number(fromPoint.timeMs),toTime=Number(toPoint.timeMs),spanMs=toTime-fromTime;
    for(let step=1;step<=RHYTHM_SLIDE_SEGMENT_STEPS;step++){
      const ratio=step/RHYTHM_SLIDE_SEGMENT_STEPS,timeMs=fromTime+spanMs*ratio;
      const to=step===RHYTHM_SLIDE_SEGMENT_STEPS?project(toPoint):project({timeMs,lane:rhythmSlideExpectedLane(note,timeMs)});
      quads.push({l0:from.left,r0:from.right,y0:from.y,l1:to.left,r1:to.right,y1:to.y});
      from=to;
    }
    fromPoint=toPoint;
  }
  return quads;
};

// ノーツ1個ぶんの「描く座標」(プレイエリア基準の px)。DOM 版 rhythmLayoutNoteVisual と同じ投影・同じ式。
// 判定には使わない(描くためだけ)。tools/mode/rhythm-canvas-geometry-check.js が投影と突き合わせる。
//   head: 粒の中心(cx,cy)・幅 w・高さ h(ノーツ要素の高さ)・奥行き scale
//   band: HOLD 帯の外周(右の縁を上→下、左の縁を下→上)
//   slide: SLIDE 帯の区切り(四角形の並び)
//   end:  終わりの横棒の中心・幅・奥行き
const rhythmNoteCanvasGeometry=(note,yPx,visualLane,rect,noteHeight,releaseYpx=null,slideTravel=null,bodyHeight=0)=>{
  const lane=Number(visualLane),centerY=Number(yPx)+noteHeight/2,yRatio=rhythmClamp01(centerY/rect.height);
  const chartNowMs=slideTravel?.chartNowMs;
  const projected=rhythmNoteIsSlide(note)?rhythmProjectSlideSpan(lane,note,yRatio,chartNowMs):rhythmNoteVisualSpan(note,lane,yRatio,chartNowMs);
  const projectedWidth=rect.width*projected.width,width=Math.min(projectedWidth,Math.max(4,projectedWidth*RHYTHM_NOTE_WIDTH_RATIO));
  const out={centerY,yRatio,scale:projected.scale,head:{cx:rect.width*projected.center,cy:centerY,w:width,h:noteHeight},band:null,slide:null,checkpoints:null,end:null};
  const height=Math.max(0,Number(bodyHeight)||0);
  if(rhythmNoteIsSlide(note)){
    if(slideTravel){
      out.slide=rhythmSlideSegmentQuads(note,slideTravel.chartNowMs,slideTravel,rect,noteHeight/2);
      out.checkpoints=rhythmSlideCheckpointLines(note,slideTravel.chartNowMs,slideTravel,rect,noteHeight/2);
    }
  }else if(rhythmNoteIsHold(note)&&height>0){
    // 帯の上端(画面外でも可)から下端までを一定間隔でサンプルし、投影の曲線へ沿わせる(DOM 版の clipPath と同じ点)
    const bodyTopY=centerY-height;
    const variableHold=rhythmNoteHasVariableSpan(note),bodyRatio=variableHold?RHYTHM_NOTE_WIDTH_RATIO:RHYTHM_BODY_WIDTH_RATIO;
    const holdAnchors=variableHold&&rhythmNoteHasHoldPoints(note)&&slideTravel&&Number(slideTravel.travelMs)>0
      ?(()=>{
        const travelMs=Number(slideTravel.travelMs),visualTime=Number(slideTravel.visualTime);
        const yAtMs=timeMs=>Number(slideTravel.spawnY)+rhythmProjectTravelProgress(1-(Number(timeMs)-visualTime)/travelMs)*Number(slideTravel.travelPx)+noteHeight/2;
        const headMs=Math.max(Number(note.timeMs)||0,Number(slideTravel.chartNowMs)||0),endMs=rhythmReleaseTargetMs(note);
        const times=[endMs,...note.holdPoints.map(point=>Number(point.timeMs)),headMs]
          .filter(timeMs=>Number.isFinite(timeMs)&&timeMs>=Math.min(headMs,endMs)&&timeMs<=Math.max(headMs,endMs));
        const anchors=times.map(timeMs=>({ratio:rhythmClamp01((yAtMs(timeMs)-bodyTopY)/height),span:rhythmHoldSpanAt(note,timeMs)})).sort((a,b)=>a.ratio-b.ratio);
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
      return {y:bodyTopY+height*ratio,left:rect.width*(span.center-half),right:rect.width*(span.center+half)};
    };
    const topEdgeRatio=(0-bodyTopY)/height;
    const extraRatios=[
      ...(topEdgeRatio>1e-6&&topEdgeRatio<1-1e-6?[topEdgeRatio]:[]),
      ...(holdAnchors?holdAnchors.map(anchor=>anchor.ratio).filter(ratio=>ratio>1e-6&&ratio<1-1e-6):[]),
    ];
    const bodyRatios=extraRatios.length?[...rhythmProjectionEdgeRatios(),...extraRatios].sort((a,b)=>a-b):rhythmProjectionEdgeRatios();
    out.band=bodyRatios.map(edgeAt);
  }
  if(rhythmNoteHasBody(note)&&Number.isFinite(Number(releaseYpx))&&releaseYpx!==null){
    const endY=rhythmClamp01((Number(releaseYpx)+noteHeight/2)/rect.height);
    const end=rhythmNoteHasVariableSpan(note)&&rhythmNoteIsHold(note)?rhythmNoteVisualSpan(note,lane,endY,rhythmReleaseTargetMs(note)):rhythmNoteIsSlide(note)?rhythmProjectSlideSpan(rhythmReleaseLane(note),note,endY,rhythmReleaseTargetMs(note)):rhythmProjectLane(rhythmReleaseLane(note),endY);
    out.end={cx:rect.width*end.center,cy:Number(releaseYpx)+noteHeight/2,w:Math.max(10,rect.width*end.width*RHYTHM_NOTE_WIDTH_RATIO),scale:end.scale};
  }
  return out;
};

// 描画そのもの。色は DOM 版(index.html / Tailwind / rhythm-mode.js の CSS)と同じ値。
const RHYTHM_CANVAS_RENDERER=(()=>{
  const HEAD_H=12;          // 粒の高さ(ノーツ要素 20px から inset 4px 0 を引いた値)
  const GLOW=20;            // 光の画像の余白(px)。いちばん広い光(18px)が収まる
  const CAP=28;             // 3分割画像の両端の幅(角丸7px + 縁取り + 余白)
  const MID=8;              // 3分割画像の中央の幅(横に伸ばす)
  const easeOut=t=>1-(1-t)*(1-t);
  const HEADS={
    TAP:    {radius:5,gradient:['#fde68a','#d946ef'],border:'rgba(255,255,255,.72)',inset:'rgba(255,255,255,.58)',glow:[[12,'rgba(217,70,239,.32)'],[6,'rgba(255,255,255,.20)'],[10,'rgba(217,70,239,.18)']]},
    HOLD:   {radius:5,gradient:['#ecfeff','#22d3ee'],border:'rgba(207,250,254,.86)',inset:'rgba(255,255,255,.72)',glow:[[13,'rgba(34,211,238,.42)'],[6,'rgba(255,255,255,.20)'],[10,'rgba(217,70,239,.18)']]},
    FLICK:  {radius:5,gradient:['#f0fdf4',['#86efac',.34],['#22c55e',.62],'#15803d'],border:'rgba(220,252,231,.98)',inset:'rgba(255,255,255,.95)',glow:[[10,'rgba(34,197,94,.92)'],[18,'rgba(21,128,61,.62)'],[6,'rgba(255,255,255,.20)']]},
    SLIDE:  {radius:5,gradient:['#ddd6fe',['#a855f7',.58],'#6d28d9'],border:'rgba(221,214,254,.95)',inset:'rgba(255,255,255,.82)',glow:[[16,'rgba(168,85,247,.64)'],[6,'rgba(255,255,255,.20)'],[10,'rgba(217,70,239,.18)']]},
    MONSTER:{radius:5,gradient:['#fef3c7','#f59e0b'],border:'rgba(255,255,255,.72)',inset:'rgba(255,255,255,.58)',ring:'#fde68a',glow:[[12,'rgba(217,70,239,.32)'],[5,'rgba(253,224,71,.72)'],[10,'rgba(217,70,239,.42)'],[14,'rgba(34,211,238,.24)']]},
    FAILED: {radius:5,gradient:['#94a3b8','#475569'],border:'rgba(148,163,184,.6)',inset:'rgba(255,255,255,.3)',glow:[]},
  };
  let canvas=null,ctx=null,dpr=1,cssW=0,cssH=0,frameNow=0,effect='FULL',lightweight=false,sizeScale=1,drawn=0;
  const sprites=new Map();
  const roundRectPath=(c,x,y,w,h,r)=>{
    const rr=Math.max(0,Math.min(r,w/2,h/2));
    c.beginPath();c.moveTo(x+rr,y);c.lineTo(x+w-rr,y);c.arcTo(x+w,y,x+w,y+rr,rr);c.lineTo(x+w,y+h-rr);c.arcTo(x+w,y+h,x+w-rr,y+h,rr);
    c.lineTo(x+rr,y+h);c.arcTo(x,y+h,x,y+h-rr,rr);c.lineTo(x,y+rr);c.arcTo(x,y,x+rr,y,rr);c.closePath();
  };
  const makeSpriteCanvas=(w,h)=>{const c=document.createElement('canvas');c.width=Math.max(1,Math.ceil(w*dpr));c.height=Math.max(1,Math.ceil(h*dpr));const g=c.getContext('2d');g.scale(dpr,dpr);return {canvas:c,ctx:g,w,h};};
  // 光の画像(3分割)。角丸の四角の外側へ box-shadow 相当のぼかしを一度だけ描く。
  // 高さは HEAD_H(+余白)で固定し、貼るときに奥行きぶんだけ縦へ伸縮する。
  const glowSprite=(key,radius,glows,outsetX=0,outsetY=0)=>{
    const id=`glow:${key}:${dpr}`;
    if(sprites.has(id))return sprites.get(id);
    const w=CAP*2+MID,h=HEAD_H+GLOW*2,s=makeSpriteCanvas(w,h);
    const c=s.ctx;
    // 形は余白(GLOW)の内側に置く。貼るときは「粒の左端 - GLOW」から貼るので、形が粒にぴったり重なる
    const shape=()=>roundRectPath(c,GLOW-outsetX,GLOW-outsetY,w-GLOW*2+outsetX*2,HEAD_H+outsetY*2,radius+outsetX);
    for(const [blur,color] of glows){
      c.save();c.shadowBlur=blur;c.shadowColor=color;c.fillStyle=color;shape();c.fill();c.restore();
    }
    // 形の中身は消して、外へにじむ光だけを残す(粒の本体は毎フレーム別に描く)
    c.save();c.globalCompositeOperation='destination-out';c.fillStyle='#000';shape();c.fill();c.restore();
    const sprite={...s,capL:CAP,capR:CAP,mid:MID,glow:GLOW};sprites.set(id,sprite);return sprite;
  };
  // 3分割画像を、幅 w・高さ h(粒の高さ)の箱へ貼る。両端は幅そのまま、中央だけ横へ伸ばす。縦は h/HEAD_H で伸縮。
  const draw3Slice=(sprite,cx,cy,w,h,alpha=1)=>{
    const sy=h/HEAD_H,marginY=sprite.glow*sy,top=cy-h/2-marginY,height=h+marginY*2;
    const left=cx-w/2-sprite.glow,right=cx+w/2+sprite.glow,total=right-left;
    const capW=sprite.capL,mid=sprite.mid,srcH=sprite.h;
    ctx.globalAlpha=alpha;
    if(total<=capW*2){
      // 粒がとても細いときは全体を横へ縮める
      ctx.drawImage(sprite.canvas,0,0,sprite.w*dpr,srcH*dpr,left,top,total,height);
    }else{
      ctx.drawImage(sprite.canvas,0,0,capW*dpr,srcH*dpr,left,top,capW,height);
      ctx.drawImage(sprite.canvas,capW*dpr,0,mid*dpr,srcH*dpr,left+capW,top,total-capW*2,height);
      ctx.drawImage(sprite.canvas,(capW+mid)*dpr,0,capW*dpr,srcH*dpr,right-capW,top,capW,height);
    }
    ctx.globalAlpha=1;
  };
  // 矢印(FLICK / 終点フリック)。三角に緑の光。
  const arrowSprite=(key,w,h,glows,gradientStops)=>{
    const id=`arrow:${key}:${dpr}`;
    if(sprites.has(id))return sprites.get(id);
    const margin=14,s=makeSpriteCanvas(w+margin*2,h+margin*2),c=s.ctx;
    const tri=()=>{c.beginPath();c.moveTo(margin+w/2,margin);c.lineTo(margin+w,margin+h);c.lineTo(margin,margin+h);c.closePath();};
    for(const [blur,color] of glows){c.save();c.shadowBlur=blur;c.shadowColor=color;c.fillStyle=color;tri();c.fill();c.restore();}
    const g=c.createLinearGradient(0,margin,0,margin+h);gradientStops.forEach(([offset,color])=>g.addColorStop(offset,color));
    c.fillStyle=g;tri();c.fill();
    const sprite={...s,margin,tw:w,th:h};sprites.set(id,sprite);return sprite;
  };
  // モンスターノーツの外周の光(::before / ::after 相当)。粒の箱に対する内外の差(dx,dy)で描く。
  const auraSprite=(key,dx,dy,radius,border,glows,dots)=>{
    const id=`aura:${key}:${dpr}`;
    if(sprites.has(id))return sprites.get(id);
    const w=CAP*2+MID,h=HEAD_H+GLOW*2,s=makeSpriteCanvas(w,h),c=s.ctx;
    const x=GLOW-dx,y=GLOW-dy,bw=w-GLOW*2+dx*2,bh=HEAD_H+dy*2;
    for(const [blur,color] of glows){c.save();c.shadowBlur=blur;c.shadowColor=color;c.strokeStyle=color;c.lineWidth=1;roundRectPath(c,x,y,bw,bh,radius);c.stroke();c.restore();}
    c.strokeStyle=border;c.lineWidth=1;roundRectPath(c,x+.5,y+.5,bw-1,bh-1,radius);c.stroke();
    (dots||[]).forEach(([px,py,color])=>{c.fillStyle=color;c.beginPath();c.arc(x+bw*px,y+bh*py,1,0,Math.PI*2);c.fill();});
    const sprite={...s,capL:CAP,capR:CAP,mid:MID,glow:GLOW};sprites.set(id,sprite);return sprite;
  };
  // ── 光の「作り方」は毎フレーム変わらないので、ここで1度だけ作る ──────────────
  //
  // 【2026-09-12・ユーザー指摘】
  // 「モンスターノーツでかくつきがまた出てきた / 曲もあわせて遅くなる(重くなる？)ときもある」
  //
  // glowSprite / auraSprite / arrowSprite は id でキャッシュしてあり、2回目からは
  // `if(sprites.has(id))return sprites.get(id);` で即返る。ところが**呼ぶ側**が、
  // その引数の配列を毎フレーム作り直していた。使われるのは初回だけなのに、
  // モンスターノーツ1個につき毎フレーム12個の配列ができていた
  // (表示中3体・60fpsで毎秒2,160個)。FLICKと終端バーも同じ形。
  // 捨てられるだけのゴミなので、ここへ出して作り直さないようにする。**見た目は変わらない。**
  const AURA_OUTER_GLOWS=Object.freeze([[8,'rgba(217,70,239,.45)'],[12,'rgba(34,211,238,.28)']]);
  const AURA_OUTER_DOTS=Object.freeze([[.08,.45,'rgba(255,255,255,.85)'],[.93,.58,'rgba(103,232,249,.85)'],[.20,.88,'rgba(253,224,71,.8)'],[.78,.08,'rgba(232,121,249,.82)']]);
  const AURA_INNER_GLOWS=Object.freeze([[5,'rgba(253,224,71,.92)'],[9,'rgba(232,121,249,.58)'],[13,'rgba(34,211,238,.34)']]);
  const FLICK_ARROW_GLOWS=Object.freeze([[5,'rgba(34,197,94,.95)'],[11,'rgba(21,128,61,.7)'],[2,'rgba(2,6,23,.9)']]);
  const FLICK_ARROW_FILL=Object.freeze([[0,'#ffffff'],[.38,'#bbf7d0'],[1,'#22c55e']]);
  const END_BAR_GLOWS_LOW=Object.freeze([[7,'#67e8f9']]);
  const END_BAR_GLOWS=Object.freeze([[10,'#67e8f9'],[18,'#d946ef']]);
  const END_FLICK_ARROW_GLOWS=Object.freeze([[4,'rgba(34,197,94,.95)'],[2,'rgba(2,6,23,.85)']]);
  const END_FLICK_ARROW_FILL=Object.freeze([[0,'#f0fdf4'],[.6,'#4ade80'],[1,'#16a34a']]);
  const headStyle=(note,failed,monster)=>failed?HEADS.FAILED:monster?HEADS.MONSTER:HEADS[rhythmNoteVisualType(note)]||HEADS.TAP;
  const fillGradient=(x,y,h,stops)=>{
    const g=ctx.createLinearGradient(0,y,0,y+h);
    stops.forEach((stop,index)=>{const offset=Array.isArray(stop)?stop[1]:index/(stops.length-1);const color=Array.isArray(stop)?stop[0]:stop;g.addColorStop(offset,color);});
    return g;
  };
  const drawHead=(note,geo,opts)=>{
    const {failed,monster,wide,brightness,depthScale,alpha,pop,pressed}=opts;
    const style=headStyle(note,failed,monster);
    const sizeMul=sizeScale*(pop?1+1.1*easeOut(pop):1);
    const w=geo.head.w*sizeMul,h=HEAD_H*depthScale*sizeMul,cx=geo.head.cx,cy=geo.head.cy,radius=(wide?7:style.radius)*sizeMul;
    const x=cx-w/2,y=cy-h/2;
    ctx.globalAlpha=alpha;
    if(style.glow.length&&!failed)draw3Slice(glowSprite(monster?'MONSTER':note.type,style.radius,style.glow),cx,cy,w,h,alpha);
    if(monster&&!failed){
      // 外側の光(::after)は 1.15 秒で薄く・濃くを繰り返す(opacity だけ)。内側(::before)は固定
      const pulse=.40+(.82-.40)*(0.5-0.5*Math.cos((frameNow/1150)*Math.PI));
      draw3Slice(auraSprite('outer',6,4,9999,'rgba(216,180,254,.62)',AURA_OUTER_GLOWS,AURA_OUTER_DOTS),cx,cy,w,h,alpha*pulse);
      draw3Slice(auraSprite('inner',1,-2,9999,'rgba(255,250,205,.98)',AURA_INNER_GLOWS),cx,cy,w,h,alpha);
    }
    ctx.globalAlpha=alpha;
    if(style.ring){ctx.lineWidth=2*sizeMul;ctx.strokeStyle=style.ring;roundRectPath(ctx,x-1*sizeMul,y-1*sizeMul,w+2*sizeMul,h+2*sizeMul,radius+1);ctx.stroke();}
    roundRectPath(ctx,x,y,w,h,radius);
    ctx.fillStyle=fillGradient(x,y,h,style.gradient);ctx.fill();
    ctx.lineWidth=1;ctx.strokeStyle=style.border;ctx.stroke();
    // 上端の白い筋(inset 0 1px 0)
    ctx.fillStyle=style.inset;ctx.fillRect(x+radius/2,y+1,Math.max(0,w-radius),1);
    if(wide&&!monster){
      const bar=ctx.createLinearGradient(0,y,0,y+h);bar.addColorStop(0,'rgba(255,255,255,.95)');bar.addColorStop(1,'rgba(255,255,255,.55)');
      ctx.fillStyle=bar;ctx.fillRect(x+1,y+1,3,h-2);ctx.fillRect(x+w-4,y+1,3,h-2);
    }
    if(rhythmNoteIsHold(note)&&!monster){ctx.fillStyle='rgba(8,47,73,.55)';ctx.fillRect(x+w*.24,cy-1,w*.52,2);}
    // 奥ほど暗い(filter:brightness 相当。不透明な粒の上では黒を (1-明るさ) の濃さで重ねると同じ色になる)
    if(brightness<1){roundRectPath(ctx,x,y,w,h,radius);ctx.fillStyle=`rgba(2,6,23,${(1-brightness).toFixed(3)})`;ctx.fill();}
    if(pressed){roundRectPath(ctx,x,y,w,h,radius);ctx.fillStyle='rgba(255,255,255,.22)';ctx.fill();}
    if(rhythmNoteVisualType(note)==='FLICK'&&!failed){
      const sprite=arrowSprite('flick',26,19,FLICK_ARROW_GLOWS,FLICK_ARROW_FILL);
      const aw=(sprite.tw+sprite.margin*2)*sizeMul,ah=(sprite.th+sprite.margin*2)*sizeMul*depthScale;
      ctx.drawImage(sprite.canvas,cx-aw/2,y-3*sizeMul*depthScale-(sprite.th+sprite.margin)*sizeMul*depthScale,aw,ah);
    }
    ctx.globalAlpha=1;
  };
  const drawBand=(geo,opts)=>{
    const {failed,alpha,pressed}=opts,band=geo.band;
    if(!band||band.length<2)return;
    const top=band[0].y,bottom=band[band.length-1].y;
    ctx.globalAlpha=alpha;
    ctx.beginPath();
    band.forEach((edge,index)=>{if(index===0)ctx.moveTo(edge.right,edge.y);else ctx.lineTo(edge.right,edge.y);});
    for(let index=band.length-1;index>=0;index--)ctx.lineTo(band[index].left,band[index].y);
    ctx.closePath();
    // 帯のまわりの光(ノーツ全体の drop-shadow 相当)は、外周の太い半透明の線で出す
    if(!failed&&effect!=='MINIMAL'&&!lightweight){ctx.lineWidth=5;ctx.strokeStyle='rgba(180,240,255,.16)';ctx.lineJoin='round';ctx.stroke();}
    const g=ctx.createLinearGradient(0,bottom,0,top);
    if(failed){g.addColorStop(0,'rgba(120,130,145,.9)');g.addColorStop(1,'rgba(150,160,175,.7)');}
    else{g.addColorStop(0,'rgba(6,182,212,.9)');g.addColorStop(1,'rgba(165,243,252,.7)');}
    ctx.fillStyle=g;ctx.fill();
    if(pressed&&!failed){ctx.fillStyle='rgba(255,255,255,.22)';ctx.fill();}
    ctx.globalAlpha=1;
  };
  const drawSlide=(geo,opts)=>{
    const {failed,alpha}=opts,quads=geo.slide;
    if(!quads||!quads.length)return;
    ctx.globalAlpha=alpha;
    if(!failed&&effect!=='MINIMAL'&&!lightweight){
      // ぼかし(drop-shadow 5px)の代わりに、外周をなぞる太い半透明の線
      ctx.beginPath();
      ctx.moveTo(quads[0].r0,quads[0].y0);
      quads.forEach(q=>ctx.lineTo(q.r1,q.y1));
      for(let index=quads.length-1;index>=0;index--)ctx.lineTo(quads[index].l1,quads[index].y1);
      ctx.lineTo(quads[0].l0,quads[0].y0);ctx.closePath();
      ctx.lineWidth=6;ctx.lineJoin='round';ctx.strokeStyle='rgba(168,85,247,.16)';ctx.stroke();
    }
    ctx.fillStyle=failed?'rgba(120,120,135,.48)':'rgba(168,85,247,.48)';
    // 継ぎ目(10等分の境目)は判定と無関係なので線を引かない。塗りだけ。
    quads.forEach(q=>{ctx.beginPath();ctx.moveTo(q.l0,q.y0);ctx.lineTo(q.r0,q.y0);ctx.lineTo(q.r1,q.y1);ctx.lineTo(q.l1,q.y1);ctx.closePath();ctx.fill();});
    // 帯のふち。DOM版の[data-rhythm-slide-edge]と同じ濃さで外周だけをなぞる。
    ctx.beginPath();
    ctx.moveTo(quads[0].r0,quads[0].y0);
    quads.forEach(q=>ctx.lineTo(q.r1,q.y1));
    for(let index=quads.length-1;index>=0;index--)ctx.lineTo(quads[index].l1,quads[index].y1);
    ctx.lineTo(quads[0].l0,quads[0].y0);ctx.closePath();
    ctx.lineWidth=1;ctx.lineJoin='round';ctx.strokeStyle=failed?'rgba(190,190,200,.5)':'rgba(233,213,255,.56)';ctx.stroke();
    // チェックポイント＝そこで判定が入るところ。DOM版の[data-rhythm-slide-checkpoint]と同じ見た目。
    const checkpoints=geo.checkpoints;
    if(checkpoints&&checkpoints.length){
      ctx.strokeStyle=failed?'rgba(190,190,200,.6)':'rgba(233,213,255,.85)';ctx.lineWidth=2;ctx.lineCap='round';
      checkpoints.forEach(line=>{ctx.beginPath();ctx.moveTo(line.x1,line.y);ctx.lineTo(line.x2,line.y);ctx.stroke();});
      ctx.lineCap='butt';
    }
    ctx.globalAlpha=1;
  };
  const drawEndBar=(note,geo,opts)=>{
    const {failed,alpha}=opts,end=geo.end;
    if(!end)return;
    // DOM 版: top = releaseY + noteH/2 - 4、高さ 8px を scaleY(0.52+0.48*奥行き) で中心基準に伸縮 → 中心は end.cy のまま
    const flick=note.endFlick===true,h=8*(0.52+end.scale*.48),w=end.w,x=end.cx-w/2,top=end.cy-h/2;
    ctx.globalAlpha=alpha;
    if(!failed&&effect!=='MINIMAL'&&!lightweight){
      const sprite=glowSprite(flick?'endFlick':'end',4,effect==='LOW'?END_BAR_GLOWS_LOW:END_BAR_GLOWS);
      draw3Slice(sprite,end.cx,end.cy,w,h,alpha);
    }
    roundRectPath(ctx,x,top,w,h,h/2);
    const g=ctx.createLinearGradient(x,0,x+w,0);
    if(failed){g.addColorStop(0,'#94a3b8');g.addColorStop(.5,'#e2e8f0');g.addColorStop(1,'#94a3b8');}
    else if(flick){g.addColorStop(0,'#22c55e');g.addColorStop(.5,'#f0fdf4');g.addColorStop(1,'#22c55e');}
    else{g.addColorStop(0,'#e879f9');g.addColorStop(.5,'#cffafe');g.addColorStop(1,'#e879f9');}
    ctx.fillStyle=g;ctx.fill();
    ctx.lineWidth=1;ctx.strokeStyle=failed?'rgba(148,163,184,.6)':flick?'rgba(220,252,231,.98)':'rgba(255,255,255,.8)';ctx.stroke();
    if(flick&&!failed){
      const sprite=arrowSprite('endFlick',24,17,END_FLICK_ARROW_GLOWS,END_FLICK_ARROW_FILL);
      const aw=sprite.tw+sprite.margin*2,ah=sprite.th+sprite.margin*2;
      ctx.drawImage(sprite.canvas,end.cx-aw/2,top-2-(sprite.th+sprite.margin),aw,ah);
    }
    ctx.globalAlpha=1;
  };
  return {
    attach(next){canvas=next||null;ctx=canvas?canvas.getContext('2d'):null;},
    // ── 演奏が始まる前に、光のスプライトを焼いておく ──────────────────────────
    //
    // 【2026-09-12・ユーザーとのやりとり】
    // 「演奏前に事前ダウンロードみたいな機能をいれて終わってから演奏開始とか意味ない？」
    //
    // ダウンロードするものは残っていない(音源は await 済み・ジャケットは曲えらび・
    // 譜面は起動時)。残っていたのは**描画の準備**で、光のスプライトを
    // 「その種類のノーツが曲の中で初めて出た瞬間」に作っていた。
    // 実測(dpr2・演出FULL)で、いちばん最初の1回が46ms(canvasの初期化込み)、
    // 種類が増えるごとに約3ms、合計およそ60ms。60fpsのフレーム3.6本ぶんで、
    // モンスターノーツは3枚まとめて作るのでいちばん重い。
    //
    // READY→3→2→1 のカウントダウンが3.2秒あるので、そこへ黙って寄せれば見えない。
    // 同じ考え方はヒットエフェクトの器で既にやっている(rhythmEnsureHitEffects)。
    //
    // ★ここで渡す値は、実際に描くときと**同じ**でなければならない。スプライトの
    //   キャッシュのキーは「種類と画素密度」だけなので、違う色・太さで焼くと
    //   そのまま曲の終わりまで使われてしまう。
    // ★画素密度も begin() と同じやり方で決める。ここで違う値にすると、最初の begin() が
    //   食い違いを見て sprites.clear() を呼び、焼いたぶんが丸ごと捨てられる。
    warmSprites(options={}){
      if(typeof document==='undefined')return 0;
      const nextDpr=Math.min(Number(options.dpr)||(typeof devicePixelRatio==='number'?devicePixelRatio:1)||1,options.lightweight?2:3);
      if(nextDpr!==dpr){dpr=nextDpr;sprites.clear();}
      effect=options.effect||'FULL';
      const before=sprites.size;
      // 粒のまわりの光。種類ごとに1枚。FAILED は glow が空なので作らない(描くときも作らない)
      for(const [type,style] of Object.entries(HEADS)){
        if(style.glow&&style.glow.length)glowSprite(type,style.radius,style.glow);
      }
      // モンスターノーツのアウラ(外は脈打つ・内は固定)
      auraSprite('outer',6,4,9999,'rgba(216,180,254,.62)',AURA_OUTER_GLOWS,AURA_OUTER_DOTS);
      auraSprite('inner',1,-2,9999,'rgba(255,250,205,.98)',AURA_INNER_GLOWS);
      // FLICKの矢印
      arrowSprite('flick',26,19,FLICK_ARROW_GLOWS,FLICK_ARROW_FILL);
      // 終端バーの光と、終点フリックの矢印
      const endGlows=effect==='LOW'?END_BAR_GLOWS_LOW:END_BAR_GLOWS;
      glowSprite('end',4,endGlows);
      glowSprite('endFlick',4,endGlows);
      arrowSprite('endFlick',24,17,END_FLICK_ARROW_GLOWS,END_FLICK_ARROW_FILL);
      return sprites.size-before;
    },
    release(){canvas=null;ctx=null;sprites.clear();},
    get drawn(){return drawn;},
    // 焼いてあるスプライトの枚数(検査で「曲の中で増えないこと」を見るために使う)
    spriteCount(){return sprites.size;},
    // 毎フレームの最初に呼ぶ。プレイエリアの大きさ・画素密度が変わっていたら canvas を作り直し、全面を消す
    begin(rect,options={}){
      if(!canvas||!ctx||!rect||!(rect.width>0&&rect.height>0))return false;
      const nextDpr=Math.min(Number(options.dpr)||(typeof devicePixelRatio==='number'?devicePixelRatio:1)||1,options.lightweight?2:3);
      if(nextDpr!==dpr){dpr=nextDpr;sprites.clear();}
      if(cssW!==rect.width||cssH!==rect.height||canvas.width!==Math.round(rect.width*dpr)||canvas.height!==Math.round(rect.height*dpr)){
        cssW=rect.width;cssH=rect.height;
        canvas.width=Math.round(cssW*dpr);canvas.height=Math.round(cssH*dpr);
        canvas.style.width=`${cssW}px`;canvas.style.height=`${cssH}px`;
      }
      ctx.setTransform(dpr,0,0,dpr,0,0);
      ctx.clearRect(0,0,cssW,cssH);
      frameNow=Number(options.nowMs)||0;effect=options.effect||'FULL';lightweight=!!options.lightweight;sizeScale=Number(options.sizeScale)||1;drawn=0;
      return true;
    },
    // ノーツ1個。geo は rhythmNoteCanvasGeometry の結果。opts: {failed,monster,wide,pressed,alpha,pop(0..1|null),depthScale,brightness,hideBody}
    drawNote(note,geo,opts){
      if(!ctx||!geo)return;
      drawn++;
      const o={failed:false,monster:false,wide:false,pressed:false,alpha:1,pop:null,depthScale:1,brightness:1,...opts};
      if(o.pop===null){
        if(geo.band)drawBand(geo,o);
        if(geo.slide)drawSlide(geo,o);
        drawEndBar(note,geo,o);
      }
      const headOpts=o.pop===null?o:{...o,alpha:o.alpha*.95*(1-easeOut(o.pop)),brightness:1};
      drawHead(note,geo,headOpts);
    },
    end(){},
    clear(){if(ctx&&cssW&&cssH){ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,cssW,cssH);}},
  };
})();

// レーンのDOMが入れ替わった時だけ静的形状を設定する。ノーツはプレイ本体の1本のrAFから直接配置する。
const installRhythmPerspectiveNoteVisuals=()=>{
  if(typeof document==='undefined'||typeof MutationObserver==='undefined')return;
  if(document.documentElement.dataset.rhythmPerspectiveNotes==='ready')return;
  document.documentElement.dataset.rhythmPerspectiveNotes='ready';

  let area=null,laidOutWidth=0,laidOutHeight=0,sizeWatcher=null;
  const layoutFor=next=>{
    area=next;
    const rect=RHYTHM_VIEW_ROTATION.rectOf(next);
    laidOutWidth=rect?.width||0;laidOutHeight=rect?.height||0;
    rhythmLayoutPlayArea(next);
    watchSize(next);
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
    const rect=RHYTHM_VIEW_ROTATION.rectOf(next);
    if(!(rect&&rect.width>0&&rect.height>0))return;
    if(next===area&&rect.width===laidOutWidth&&rect.height===laidOutHeight)return;
    layoutFor(next);
  };
  // プレイエリア「そのもの」の大きさが変わったときも測り直す。
  // window の resize は起きないのに箱だけが変わる場面が実際にある(2026-09-05・実機の指摘
  // 「初回演奏開始時の表示バグが直ってない」)。
  //   ・遅れて届いたCDNのCSS(Tailwind)がやっと効いた
  //   ・セーフエリア(ノッチ)や端末のUIの高さが確定した
  //   ・上下のHUD・絵の読み込みが終わって箱の高さが縮んだ
  // 以前はこれを取りこぼしていたので、**その回の演奏のあいだずっと**
  // 組み上がる前の大きさで計算した位置が残った。サイドのマスモンは
  // px で置くため、実測で 390px の箱に対して top=953px、つまり画面の外へ出ていた。
  // リスタートで直っていたのは、そのときプレイエリアの要素ごと作り直されて
  // MutationObserver 側の scan() が改めて測っていたからにすぎない。
  //
  // 監視するのはプレイエリア1つだけで、書き換えるのはその**中身**の style。
  // 観測している箱自身は触らないので自己ループにならず、
  // relayout 側も「同じ要素・同じ大きさなら何もしない」で二重に止めている。
  const watchSize=next=>{
    if(typeof ResizeObserver==='undefined')return;
    if(!sizeWatcher)sizeWatcher=new ResizeObserver(()=>relayout());
    sizeWatcher.disconnect();
    if(next)sizeWatcher.observe(next);
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

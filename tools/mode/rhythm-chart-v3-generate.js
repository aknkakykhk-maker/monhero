#!/usr/bin/env node
// 自動譜面制作V3: 音の種類・音の高さ・形の語彙から譜面を組み立てる。
//
//   node tools/mode/rhythm-chart-v3-generate.js                     # 内訳を表示するだけ
//   node tools/mode/rhythm-chart-v3-generate.js --write             # authoring/ へ書き出す
//   node tools/mode/rhythm-chart-v3-generate.js --difficulty HARD
//   node tools/mode/rhythm-chart-v3-generate.js --explain HARD      # どう組み立てたかを並べて見る
//
// 入力: tools/mode/authoring/<track>-v3-audio.json
//       （V3音源解析ひとつ。テンポ・拍子・区切り・盛り上がり・打点・音の高さが全部入っている）
// 出力: tools/mode/authoring/<track>-v3-chart-<難易度>.json
//
// 作り方の根拠はすべて docs/spec/RHYTHM_CHART_DESIGN.md にある。
// V2（rhythm-chart-v2-step3-generate.js）は残したまま、別系統として作る。
//
// 【V2から変えた4つ】
// 1. 拾う音を「強さの順位」ではなく**音の種類**で決める（レイヤリング）
// 2. レーンを「使用回数が少ない順」ではなく**形の語彙**で決める（読める譜面にする）
// 3. HOLDの長さ・SLIDEの経路を**実際の音**（伸びている区間・音の高さの動き）から決める
// 4. 難易度を独立に作らず、**同じ優先順位の上位から何個取るか**だけで分ける
//    （EASYで覚えた形がそのまま上位難易度にも出る＝学習曲線になる）
'use strict';
const fs=require('fs');
const path=require('path');
const vm=require('vm');
const {HAND_MODEL,fingerPairFeasible,noteTouchLane,noteTouchSpan,usableTouchSpan,separationRange}=require('./rhythm-hand-model.js');
const {simulateNotes}=require('./rhythm-hand-simulate.js');
const {LANES,PATTERN_BY_ID,mirror,fitToLanes,maxStepOf,shapeCandidatesFor,rankShapes,hash32,heldPairShapeCandidates,heldPairMoveScale}=require('./rhythm-chart-v3-patterns.js');

const ROOT=path.resolve(__dirname,'..','..');
const arg=(name,fallback=null)=>{const i=process.argv.indexOf(name);return i>=0&&i+1<process.argv.length?process.argv[i+1]:fallback;};
const write=process.argv.includes('--write');
const only=arg('--difficulty');
const explain=arg('--explain');
const trackId=arg('--track','monster_hero_theme');
const outputDir=arg('--output-dir',null);
const inputDir=arg('--input-dir',null);
// ── 候補ちがい（同じ曲から別の譜面を作る） ──────────────────────────────────
//
// 【2026-09-12】V3には「複数候補を作って自動で批評する」段が無かった
// (V2のSTEP5に相当。docs/spec/RHYTHM_ROADMAP.md に2回「まだ無い」と書かれていた)。
// いまは1回生成して検査に通れば出荷なので、「検査は通るが面白くない」譜面が出うる。
//
// 同点を崩す種へこの番号を混ぜると、形の選ばれ方だけが変わって別の譜面になる。
// ★variant 0 は**今までと1音も変わらない**(種の文字列に何も足さない)。
//   既存曲の譜面を変えないため、既定は必ず0(運用ルール ⑩-2)。
const variant=Math.max(0,Math.floor(Number(arg('--variant',0))||0));
const variantSeed=variant>0?`:v${variant}`:'';
// 種を変えるだけだと、形の選ばれ方が入れ替わるだけで**点数がほとんど動かなかった**
// (候補4本で6軸の合計が572.0〜572.2、差0.2点)。品質の軸をまたぐ差を作るには、
// 「どんな形を好むか」も候補ごとに変える必要がある。
//
// 変えるのは**好み(prefer)の強さだけ**。難易度の設定(PROFILES)には触らない。
// 触ると候補どうしで難易度が変わってしまい、比べる意味が無くなる。
//   driftTurnAfter … 同じ向きへ何回続いたら「逆向きを前へ出す」か（小さいほどよく折り返す）
const VARIANT_STYLES=Object.freeze([
  Object.freeze({driftTurnAfter:2}),   // v0 = いまと同じ
  Object.freeze({driftTurnAfter:1}),   // よく折り返す（流れが変わりやすい）
  Object.freeze({driftTurnAfter:3}),   // 同じ向きへ長く流す
  Object.freeze({driftTurnAfter:2}),   // v0と同じ好みで、種だけ別
  Object.freeze({driftTurnAfter:1}),
  Object.freeze({driftTurnAfter:4}),   // かなり長く流す
  Object.freeze({driftTurnAfter:3}),
  Object.freeze({driftTurnAfter:1}),
]);
const variantStyle=VARIANT_STYLES[variant%VARIANT_STYLES.length];
const DIFFICULTIES=['EASY','NORMAL','HARD','EXPERT','MASTER'];

// ============================================================================
// 音の拾い方（レイヤリング）
// ============================================================================
// 音の種類ごとの重み。曲の背骨（大きな一発・重い打点）から先に拾い、
// 装飾（軽い音）は上の難易度でだけ拾われる。
// docs/spec/RHYTHM_CHART_DESIGN.md 7章「拾う音の選び方」。
const CHARACTER_WEIGHT=Object.freeze({FULL:1,PUNCH:.72,BODY:.66,LIGHT:.30});
// 拍の中のどこか。拍の頭がいちばん大事で、16分の裏はいちばん後回し。
const POSITION_WEIGHT=Object.freeze([.95,0,.5,0]);
const STRENGTH_WEIGHT=1.15;
const SUSTAIN_BONUS=.22;          // 伸びる音は「押さえる価値がある」ので少し優先する
// 音程のある音（メロディ・歌）は譜面の顔になる。打楽器ばかりの譜面にしないため少し優先する。
const PITCHED_BONUS=.18;
// 「拍の頭の音 ÷ 16分裏の音」がこれを下回る曲は、打点の強弱で拍が立っていないとみなす。
// 実測: Monster Hero 1.49 / ドパガキリ(ショート) 1.63 / 綺季一閃 1.18 /
//       Stay With Me 1.03 / MF × ICHIKA MIX 0.98。
// 1.10 は「Stay With Me と MF × ICHIKA MIX だけが当てはまる」ところに置いてある。
const BEAT_CLARITY_MIN=1.10;
// 拍が立っていない曲で、16分裏のうち強いほうから何割を残すか。
// 残しすぎると直らず、切りすぎると譜面が単調になる。1/3ほどが目安。
const OFF_BEAT_KEEP=.35;

// 難易度ごとの方針。**できること**だけを持つ。量は DENSITY_TARGET が曲ごとに決める。
// 拾う順番はすべての難易度で同じなので、下の難易度は上の難易度の部分集合になる。
//
// 【同時押しについて】
// 同時押しは「2つ同時に押すこと」自体が難しいわけではない。指は2本あるので、
// 離れた2か所を同時に押すのは、1か所を押すのとほとんど変わらない。
// 難しさは**置き方**で決まる。だからEASYから出す。かわりに下の難易度ほど
//   ・拍の頭にだけ置く   ・前後を大きく空ける   ・左右を大きく離す
//   ・太いノーツで作る   ・数を少なくする
// という条件を付け、上へ行くほどこの条件をゆるめる（chord の中身）。
//
// tapDuringHold は別もので、こちらは「押さえっぱなしの指が1本ふさがった状態で
// もう1本を動かす」ので本当に難しい。EXPERT以上に置く。
//
// 【大きく動かす3つの見せ場について】(2026-09-05・「バリエーションが少ない」という指摘で足した)
// sweep    … 端から端まで動くSLIDE。SLIDEを持つHARD以上。追従の速さ(maxLaneSpeed)で精査する
// chordRun … 同時押しの連なり。ペアごと右左へ振る「くねくね」。EXPERT以上
//             （EASY〜HARDは「大きく離す・太くする」条件で5レーンが埋まり、動かす余地が無い）
// cross    … 押さえっぱなしより外側を叩かせて指を交差させる。EXPERTで少し、MASTERで中心に
// slideFan … スライドの分岐・合流。親の途中から2本目が生える／2本目が親へ吸い込まれる。
//             EXPERT以上。データ形式は変えず、2本のSLIDEの端をそろえて出す。詳しくは「--- 15.7 ---」
// doubleSlide … 2本のSLIDEをいちどになぞる（同時スライド）。EXPERT以上。
//             15.5（同時押さえ）はベースと旋律の重なり待ちで曲によって0箇所になるため、
//             こちらは譜面にある強いSLIDEへ**狙って**2本目を足す。詳しくは「--- 15.6 ---」
const PROFILES=Object.freeze({
  EASY:Object.freeze({level:1,lattice:2,maxLaneStep:1,maxRun:2,
    types:['TAP','HOLD'],widths:[3,4,6],narrowRate:0,tapDuringHold:false,
    holdPerMinute:5.6,slidePerMinute:0,flickPerMinute:0,endFlickPerMinute:0,
    chord:Object.freeze({perMinute:2.4,minGapLanes:2,onBeat:true,clearGrids:3,minWidth:3,spacingGrids:16,edge:true}),
    sweep:null,chordRun:null,crossPerMinute:0,heldPair:null,doubleSlide:null,slideFan:null,
    glideSlide:null,accentWidth:10,accentPerMinute:2.4}),
  NORMAL:Object.freeze({level:3,lattice:2,maxLaneStep:2,maxRun:3,
    types:['TAP','HOLD','FLICK'],widths:[2,3,4,6],narrowRate:0,tapDuringHold:false,
    holdPerMinute:6.4,slidePerMinute:0,flickPerMinute:5.6,endFlickPerMinute:1.2,
    chord:Object.freeze({perMinute:3.2,minGapLanes:2,onBeat:true,clearGrids:2,minWidth:3,spacingGrids:12,edge:true}),
    sweep:null,chordRun:null,crossPerMinute:0,heldPair:null,doubleSlide:null,slideFan:null,
    glideSlide:null,accentWidth:10,accentPerMinute:2.4}),
  HARD:Object.freeze({level:5,lattice:1,maxLaneStep:2,maxRun:2,
    types:['TAP','HOLD','FLICK','SLIDE'],widths:[1,2,3,4,5],narrowRate:.04,tapDuringHold:false,
    holdPerMinute:7.2,slidePerMinute:4,flickPerMinute:7.2,endFlickPerMinute:2,
    chord:Object.freeze({perMinute:4,minGapLanes:1.5,onBeat:false,clearGrids:2,minWidth:3,spacingGrids:8,edge:false}),
    sweep:Object.freeze({perMinute:1.6,minGrids:6,minSpanLanes:2.5,maxLaneSpeed:6,clearBeats:1}),
    chordRun:null,crossPerMinute:0,heldPair:null,doubleSlide:null,slideFan:null,
    glideSlide:Object.freeze({perMinute:.6,minOnsets:4,maxGapGrids:2,maxGrids:12,
      minHeightRange:.11,minMoves:3,spacingGrids:48}),
    accentWidth:8,accentPerMinute:2.8}),
  EXPERT:Object.freeze({level:7,lattice:1,maxLaneStep:3,maxRun:5,
    types:['TAP','HOLD','FLICK','SLIDE'],widths:[1,2,3,4,5],narrowRate:.12,tapDuringHold:true,
    holdPerMinute:8,slidePerMinute:4.8,flickPerMinute:8.8,endFlickPerMinute:2.8,
    chord:Object.freeze({perMinute:4.8,minGapLanes:1.25,onBeat:false,clearGrids:1,minWidth:2,spacingGrids:6,edge:false}),
    sweep:Object.freeze({perMinute:2.4,minGrids:6,minSpanLanes:3,maxLaneSpeed:8,clearBeats:.5}),
    chordRun:Object.freeze({perMinute:1.6,maxLength:3,minStepMs:165,maxLaneSpeed:8,
      width:2,shapes:['parallel','swing'],spacingGrids:24}),
    crossPerMinute:1.2,
    heldPair:Object.freeze({perMinute:.8,minOverlapGrids:8,minGapLanes:1.5}),
    doubleSlide:Object.freeze({perMinute:.5,minGrids:6,minPartnerSpanLanes:.5,minOwnSpanLanes:1,
      minGapLanes:1.5,maxLaneSpeed:8,minStrength:.6,minIntensity:.6,maxCoveredNotes:4,spacingGrids:48}),
    slideFan:Object.freeze({perMinute:.5,minParentGrids:9,minOwnGrids:5,minGapLanes:1.5,
      minOwnSpanLanes:1,minOpenLanes:.5,maxLaneSpeed:8,maxCoveredNotes:2,spacingGrids:48}),
    glideSlide:Object.freeze({perMinute:.4,minOnsets:4,maxGapGrids:2,maxGrids:14,
      minHeightRange:.11,minMoves:3,spacingGrids:40}),
    accentWidth:8,accentPerMinute:2.8}),
  MASTER:Object.freeze({level:9,lattice:1,maxLaneStep:4,maxRun:8,
    types:['TAP','HOLD','FLICK','SLIDE'],widths:[1,2,3,4],narrowRate:.2,tapDuringHold:true,
    holdPerMinute:8.8,slidePerMinute:5.6,flickPerMinute:10.4,endFlickPerMinute:3.6,
    chord:Object.freeze({perMinute:7.2,minGapLanes:1,onBeat:false,clearGrids:1,minWidth:2,spacingGrids:6,edge:false}),
    sweep:Object.freeze({perMinute:3.2,minGrids:5,minSpanLanes:3.5,maxLaneSpeed:10,clearBeats:.5}),
    chordRun:Object.freeze({perMinute:2.4,maxLength:4,minStepMs:140,maxLaneSpeed:10,
      width:2,shapes:['swing','parallel','open'],spacingGrids:20}),
    crossPerMinute:2.4,
    heldPair:Object.freeze({perMinute:1.6,minOverlapGrids:6,minGapLanes:1.25}),
    doubleSlide:Object.freeze({perMinute:1.2,minGrids:5,minPartnerSpanLanes:.5,minOwnSpanLanes:1,
      minGapLanes:1.25,maxLaneSpeed:10,minStrength:.5,minIntensity:.5,maxCoveredNotes:4,spacingGrids:32}),
    slideFan:Object.freeze({perMinute:1,minParentGrids:8,minOwnGrids:4,minGapLanes:1.25,
      minOwnSpanLanes:1,minOpenLanes:.5,maxLaneSpeed:10,maxCoveredNotes:2,spacingGrids:32}),
    glideSlide:Object.freeze({perMinute:.6,minOnsets:4,maxGapGrids:2,maxGrids:16,
      minHeightRange:.11,minMoves:3,spacingGrids:32}),
    accentWidth:6,accentPerMinute:3.2}),
});
// HOLD・SLIDE・FLICK・同時押し・区切りの一発は、曲の長さに比例させる。
// 「1曲に何個」で持つと、30秒の曲では多すぎ、6分の曲では足りなくなる（実際そうなった）。

// 盛り上がりで小節あたりの取り分を持ち上げる幅。
// 「その小節に実際にある音の数」を土台にし、音量だけで増やさない。
const MUSICAL_LIFT=Object.freeze([.45,1.35]);

// --- 曲ごとに自動でそろえる、譜面の量の目標 ---
// 前は「その曲の打点の何割を拾うか」で決めていた。これは1曲に合わせた数字で、
// 打点の多い曲・少ない曲で仕上がりの量がまるで変わってしまい、曲を変えるたびに調整が要った。
//
// いまは**1拍あたり何個**を目標にし、テンポの速い曲・遅い曲で極端にならないよう
// 毎秒の下限・上限で挟む。こうすると、どの曲でも「遊んだ感じの忙しさ」がそろう。
// 数字は、耳で確認して通した Monster Hero の仕上がり（EASY 1.57 〜 MASTER 3.43 毎秒）から取った。
// 【下限について】(2026-09-06)
// 下限は「これ以下だと間延びして拍が取れない」ための線で、歯ごたえでは動かさない。
// ただし線そのものが高すぎた。実測すると、いちばんゆったりした2曲
// (風がそよぐ場所・Stay With Me)は EASY から MASTER まで**全部この下限に張り付いて**いて、
// 曲の性格がまったく譜面へ出ていなかった。EASYのレベル幅が Lv.5〜8 のまま動かなかったのは
// これが理由(ユーザー指摘「どの曲も難易度が似たりよったり」)。
// そこで下限を2割下げた。BPM119の曲のEASYで毎秒0.72＝1拍半に1つなので、
// 拍が取れなくなるほどではない。この値にしたところ、
// **先行公開の11曲はどれも下限に当たらなくなった**（＝下限は本来の安全柵に戻った）。
// hardMaxPerSecond は「曲によらない上限」。maxPerSecond のほうは歯ごたえ(challenge.factor、
// 最大1.9倍)を掛けるので、**速い曲では上限として働かない**。実測で SIX ÉTERNEL(BPM207)の
// EXPERTが毎秒4.56になり、EXPERTの maxPerSecond(4.0)どころか MASTER の4.6に迫っていた
// (2026-09-12)。
//
// ★ただし、ここを帯の真ん中へ絞ってはいけない。ユーザー指示「どの曲も難易度が似たりよったり /
//   もっと振れ幅がほしい」(2026-09-06)で曲どうしの差をわざと強めてあるので、
//   上限を下げるとその差をまた潰す。そこで**品質レポートが減点を始める線**へ置く。
//   rhythm-chart-quality-report.js の BANDS.density の上端 ＋ 許容(slack 0.6)。
//   いまの全17曲はこの線の内側なので、**この柵で変わる曲は1曲も無い**
//   (＝いまの難易度は動かない。運用ルール⑥-3の「難易度は聞く」に触れない)。
//   将来「帯から出るほど詰まった譜面」が出たときだけ効く安全柵。
// ⚠️ 数字はレポートの帯と1対1で対応する。ずれると意味が無くなるので
//   rhythm-density-ceiling-check.js が突き合わせる。
const DENSITY_TARGET=Object.freeze({
  EASY:  Object.freeze({perBeat:.54,minPerSecond:.72,maxPerSecond:2.0,hardMaxPerSecond:2.7}),
  NORMAL:Object.freeze({perBeat:.62,minPerSecond:.88,maxPerSecond:2.4,hardMaxPerSecond:3.1}),
  HARD:  Object.freeze({perBeat:.85,minPerSecond:1.28,maxPerSecond:3.2,hardMaxPerSecond:3.9}),
  EXPERT:Object.freeze({perBeat:1.03,minPerSecond:1.68,maxPerSecond:4.0,hardMaxPerSecond:4.7}),
  MASTER:Object.freeze({perBeat:1.19,minPerSecond:1.92,maxPerSecond:4.6,hardMaxPerSecond:5.4}),
});

// --- 曲ごとの歯ごたえ（曲の性格を譜面の量に出す） ---
// 【なぜ要るか】
// 上の DENSITY_TARGET だけだと、量を決めるのは実質「1拍あたり何個 × テンポ」だけになる。
// テンポは曲によって155〜173しか違わないので、**どの曲もほとんど同じ量**になり、
// 先行公開の5曲は EASY が全部Lv.8、HARDが15〜16、EXPERTが22〜23と団子になった
// (2026-09-05・ユーザー指摘「5曲ともレベルが似たりよったり」)。
// 曲が違えば難しさも違うはずで、その差が出ないと選ぶ楽しみがない。
//
// そこで「その曲がどれだけ譜面を詰められるか」を音源から出し、量に掛ける。
//   1. テンポ         … 速い曲ほど16分が詰まって忙しい
//   2. 音の詰まり具合 … 毎秒いくつ音が鳴っているか。音が多い曲ほど詰められる
//   3. 拍のはっきりさ … ドラムで拍が立っている曲は詰めても気持ちよく叩ける。
//                       立っていない曲は詰めるほど「曲に合っていない」感じになるので薄くする
//                       （この値は rhythm-audio-analyze-v3.js の beatClarity.ratio）
// 3つを掛け合わせ、極端にならないよう上下で挟む。
// 基準は「ふつうの曲」として固定値で持つ。曲が増えても平均を取り直さずに済み、
// 昔作った譜面が新しい曲のせいで変わることもない。
const CHALLENGE_REFERENCE=Object.freeze({bpm:170,onsetsPerSecond:7.0,beatClarity:1.30});
const CHALLENGE_EXPONENT=Object.freeze({bpm:.7,onsets:1,beatClarity:.55});
// --- 差の出し方（2026-09-06・ユーザー指摘「どの曲も難易度が似たりよったり。もっと振れ幅がほしい」）---
// 上の3つ（テンポ・音の詰まり具合・拍のはっきりさ）は、同じジャンルの曲だと**似た値になる**。
// 実測すると11曲の生の値は 0.793〜1.656 に固まっていて、しかも 0.78〜1.26 で
// 切り落としていたため、譜面の量は EASY で1.9倍しか違わなかった。
// これでは「どの曲も似たりよったり」になる。
//
// そこで、測った差を**そのまま**ではなく**強めて**使う。生の値を CHALLENGE_GAIN 乗する。
// 1.0 のときは今までどおり。1より大きいと、1.0から離れている曲ほど大きく離れる
// （0.85→0.75、1.25→1.48 のように、濃い曲はより濃く、薄い曲はより薄くなる）。
// 「測り方を変える」のではなく「測れた差を素直に見せる」ための一手。
const CHALLENGE_GAIN=1.8;
// 3つのうち1つだけが暴れても、そこで全部が決まらないようにする。
// 実測で Close To Your Heart の「拍のはっきりさ」だけが 4.73 と出た(ほかの曲は0.98〜1.88)。
// この曲は同じ解析で「拍のところに音が無い拍が多い」とも言われていて、
// **音が少なくてその少ない音がぴったり拍に乗っている**ため、割り算の下が小さくなって
// 比が跳ね上がっただけだった。強めて使う以上、こういう跳ねをそのまま乗せてはいけない。
// そこで、掛け合わせる前に1項目ずつ挟む。
const CHALLENGE_RATIO_RANGE=Object.freeze({min:.75,max:1.40});
// 挟み込みは「おかしな音源が来たときの安全柵」であって、曲どうしの差を潰すためのものではない。
// 強めたぶん柵も広げる。ここが狭いと、せっかく強めた差がまた潰れる。
const CHALLENGE_RANGE=Object.freeze({min:.60,max:1.90});
// 歯ごたえを「中身」へ効かせるときの控えめさ。
// 量(ノーツ数)は factor をそのまま掛けるが、中身は factor^この値 で効かせる。
// 1にすると、量と中身の両方が同じだけ動いて難しさが二乗で開き、EASYがEASYでなくなる。
const CHALLENGE_VOCABULARY_EXPONENT=.7;
// --- 自動で出た歯ごたえが曲と合わないとき（2026-09-08・ユーザー指摘「crossing field は
// ちょっと難しすぎるかも / 曲の雰囲気的にそんな難しいのが合わない / マスターを27ぐらいに」）---
// 上の3つは「音源から測れること」しか見ない。**曲の雰囲気は測れない**ので、
// 測った値が正しくても、遊ぶ人の感じ方と食い違うことがある。
// 実際に crossing field は 拍の立ち 2.419（ほかの曲は0.98〜1.88）が1項目の上限へ張り付き、
// 歯ごたえ 1.86（上限1.90のすぐ下）になって MASTER Lv.38・EASY Lv.11 まで行った。
// 既存曲の MASTER は 15〜32、EASY は 4〜8 なので、EASYが既存のHARDより重い状態だった。
//
// そこで**その曲だけ**歯ごたえを人が決められるようにする。曲の一覧
// (tools/mode/authoring/rhythm-song-registry.json) の challengeFactor に数字を書くと、
// 測った値のかわりにそれを使う。
//   ・**測り方そのものは変えない。** ここをいじると、ほかの曲の譜面まで作り直したときに変わる
//   ・書いた曲だけに効く。書いていない曲は今までどおり自動
//   ・なぜその数字なのかは docs/spec/RHYTHM_MODE.md に残す（数字だけが残ると誰も直せない）
// 見張りは tools/mode/rhythm-song-challenge-check.js。
const songChallengeFactor=(audio)=>{
  const seconds=Number(audio.durationMs)/1000;
  const summary=audio.summary||{};
  const bpm=Number(audio.timing&&audio.timing.bpm);
  const onsetsPerSecond=seconds>0?Number(summary.onsetCount)/seconds:NaN;
  const clarity=Number(summary.beatClarity&&summary.beatClarity.ratio);
  // どれか測れなければ、その項目は「ふつう」として1倍にする（昔の解析でも動くように）。
  const ratio=(value,reference,exponent)=>{
    if(!(Number.isFinite(value)&&value>0))return 1;
    return Math.max(CHALLENGE_RATIO_RANGE.min,
      Math.min(CHALLENGE_RATIO_RANGE.max,Math.pow(value/reference,exponent)));
  };
  // 人が決めた値があるときは、測った3つより優先する（挟み込みだけは通す）。
  const pinned=Number(audio.challengeFactor);
  if(Number.isFinite(pinned)&&pinned>0){
    const factor=Math.max(CHALLENGE_RANGE.min,Math.min(CHALLENGE_RANGE.max,pinned));
    return {factor,raw:factor,gained:factor,pinned:true,bpm,onsetsPerSecond,beatClarity:clarity};
  }
  const raw=ratio(bpm,CHALLENGE_REFERENCE.bpm,CHALLENGE_EXPONENT.bpm)
    *ratio(onsetsPerSecond,CHALLENGE_REFERENCE.onsetsPerSecond,CHALLENGE_EXPONENT.onsets)
    *ratio(clarity,CHALLENGE_REFERENCE.beatClarity,CHALLENGE_EXPONENT.beatClarity);
  // 測れた差を強めてから挟む。
  const gained=Math.pow(raw,CHALLENGE_GAIN);
  const factor=Math.max(CHALLENGE_RANGE.min,Math.min(CHALLENGE_RANGE.max,gained));
  return {factor,raw,gained,bpm,onsetsPerSecond,beatClarity:clarity};
};

const COMMON=Object.freeze({
  minTimeMs:1800,
  endPaddingMs:1200,
  maxAbsPeakOffsetMs:30,
  earReviewMaxOffsetMs:43,
  monsterSlots:4,
  monsterTargets:[.2,.4,.6,.8],
  monsterClearGrids:4,
  runGapGrids:9,          // これ以上あいたら別の「かたまり」にする（2拍ぶん）
  chunkFast:4,            // 16分が並ぶところは4個ずつの形にする（1拍ぶん）
  chunkMedium:6,          // 8分が並ぶところは6個まで
  chunkSlow:8,            // ゆっくりのところは8個まで
  slideMinGrids:6,
  slideMinMove:.10,       // 音の高さがこれだけ動いていればSLIDEにする
  holdMinGrids:4,
  laneStepFastMax:2,      // 8分より速い間隔では、歩幅いっぱいに跳ばない
  shapeAvoidRecent:3,     // 直近この数だけの形は、同じくらいふさわしい候補があれば後回しにする
});

// ============================================================================
// 読み込み
// ============================================================================
const readJson=file=>JSON.parse(fs.readFileSync(path.isAbsolute(file)?file:path.join(ROOT,file),'utf8'));
const authoring=file=>inputDir?path.join(path.resolve(ROOT,inputDir),file):`tools/mode/authoring/${file}`;
const dashed=trackId.replace(/_/g,'-');
// V3の解析だけを入力にする。テンポも区切りも盛り上がりもこの1つに入っているので、
// 別系統の道具（ffmpegを使うV2のSTEP1/STEP2）に頼らない＝どんな曲でも作れる。
const audio=readJson(authoring(`${dashed}-v3-audio.json`));
// 曲ごとに歯ごたえを人が決めているならここで合流させる（無ければ自動のまま）。
// 置き場所は曲の一覧のほう。解析のJSONは「測った結果」なので、人の判断を混ぜない。
{
  const registryFile=path.join(ROOT,'tools/mode/authoring/rhythm-song-registry.json');
  if(fs.existsSync(registryFile)){
    const entry=(JSON.parse(fs.readFileSync(registryFile,'utf8')).songs||{})[trackId];
    const pinned=Number(entry&&entry.challengeFactor);
    if(Number.isFinite(pinned)&&pinned>0)audio.challengeFactor=pinned;
  }
}
if(audio.analysisType!=='rhythm-audio-v3')throw new Error('V3音源解析のJSONではありません');
if(!audio.structure)throw new Error('V3音源解析が古い形です。rhythm-audio-analyze-v3.js を通し直してください');
const structure=audio.structure;
const timing=audio.timing;
const gridMs=timing.gridMs;
const gridTimeMs=grid=>timing.beatZeroMs+grid*gridMs;
const BEAT=timing.subdivisionsPerBeat;
const BAR=BEAT*timing.beatsPerBar;
// --- 曲の途中で終わらせる指定（2026-09-06・ユーザー指示「長すぎるから2分ぐらいで
//     ちょうどいいとこで終わるような作りにして」）---
// 音源そのものは切らない。デュラハンの2曲はバトルのBGMと同じファイルを使っているので、
// 切るとバトルの曲まで短くなってしまう（CLAUDE.md ⑥-2「既にある音源が使えるならコピーを作らない」）。
// かわりに**譜面のほうを途中までにする**。ここで終わりを決めておくと、
// 量・盛り上がりの配り方・マスモンの出る位置（2割/4割/6割/8割）も、
// 短くしたぶんに合わせて作り直される（後ろを切り落とすのとは仕上がりが違う）。
//
// 終わりの時刻は曲の一覧（rhythm-song-registry.json）の playEndMs に書く。
// --end で上書きもできるが、書いておけば次に作り直すときも同じところで終わる
// （引数を覚えていないと元に戻ってしまうため）。
const registryPlayEndMs=(()=>{
  try{
    const registry=readJson('tools/mode/authoring/rhythm-song-registry.json');
    const value=Number(registry?.songs?.[trackId]?.playEndMs);
    return Number.isFinite(value)&&value>0?value:null;
  }catch{return null;}
})();
const endArgMs=Number(arg('--end',NaN));
const chartEndMs=Math.min(Number(audio.durationMs),
  Number.isFinite(endArgMs)&&endArgMs>0?endArgMs
    :registryPlayEndMs!==null?registryPlayEndMs:Number(audio.durationMs));
const minGrid=Math.ceil((COMMON.minTimeMs-timing.beatZeroMs)/gridMs);
const maxGrid=Math.floor((chartEndMs-COMMON.endPaddingMs-timing.beatZeroMs)/gridMs);
const minBar=Math.floor(minGrid/BAR),maxBar=Math.floor(maxGrid/BAR);
if(chartEndMs<Number(audio.durationMs)){
  console.log(`※ 譜面は ${(chartEndMs/1000).toFixed(1)}秒 までで作ります`
    +`（音源は ${(Number(audio.durationMs)/1000).toFixed(1)}秒。音源そのものは切りません）`);
}

// 打点をグリッドごとに1つへまとめる（同じ位置に2つ以上あれば強いほうを残す）
const onsetByGrid=new Map();
for(const onset of audio.onsets){
  if(onset.grid<minGrid||onset.grid>maxGrid)continue;
  if(Math.abs(onset.gridOffsetMs)>COMMON.earReviewMaxOffsetMs)continue;
  const prev=onsetByGrid.get(onset.grid);
  if(!prev||onset.strength>prev.strength)onsetByGrid.set(onset.grid,onset);
}
const allOnsets=[...onsetByGrid.values()].sort((a,b)=>a.grid-b.grid);
const heightByGrid=new Map();
for(const point of audio.pitchCurve)if(point.height!=null)heightByGrid.set(point.grid,point.height);

// 区切りと盛り上がり（V3の解析がそのまま持っている）
const sectionForBar=bar=>structure.sections.find(s=>bar>=s.startBar&&bar<s.endBarExclusive)||null;
const barIntensityMap=new Map(structure.bars.map(entry=>[entry.bar,entry.intensity]));
// 小節そのものの盛り上がりと、その区切り全体の盛り上がりを半分ずつ混ぜる。
// 小節だけだと1小節ごとに濃さが暴れ、区切りだけだと中の起伏が消えるため。
const intensityPosition=bar=>{
  const own=barIntensityMap.has(bar)?barIntensityMap.get(bar):.5;
  const section=sectionForBar(bar);
  const sectionValue=section?section.intensity:own;
  return Math.max(0,Math.min(1,own*.5+sectionValue*.5));
};
// 繰り返しの区切り（形を使い回すのに使う）
const repeatSourceBar=bar=>{
  const section=sectionForBar(bar);
  if(!section||section.repeatOf==null)return null;
  return section.repeatOf+(bar-section.startBar);
};
const musicalOnsetsInBar=bar=>allOnsets.filter(o=>o.grid>=bar*BAR&&o.grid<(bar+1)*BAR).length;

// --- 区切りの役割(場面) ---
// 構造解析は「サビ」「Aメロ」の名前を付けない(外すと譜面まで外れるため)。ここでも名前は付けず、
// 譜面づくりに要る3つだけを出す。
//   intro  … 曲の頭の、盛り上がりが低い区切り(読みやすく・語彙を絞る)
//   climax … 盛り上がりが上位の区切り(開き・幅・端振りを前へ出す)
//   outro  … 曲の終わりの、盛り上がりが落ちた区切り(収束)
//   body   … それ以外(基本の語彙)
// 実際の曲にその構造が無ければ、該当なし(body)のままになる。固定の型は押し付けない。
const sectionRoles=(()=>{
  const list=Array.isArray(structure.sections)?structure.sections:[];
  const roles=new Map();
  if(!list.length)return roles;
  const sorted=list.map(s=>s.intensity).sort((a,b)=>a-b);
  const high=sorted[Math.floor(sorted.length*.7)]??1;
  list.forEach((section,index)=>{
    let role='body';
    if(index===0&&section.intensity<.5)role='intro';
    else if(index===list.length-1&&section.intensity<.5&&list.length>=3)role='outro';
    else if(section.intensity>=high&&section.intensity>=.5)role='climax';
    roles.set(section,role);
  });
  return roles;
})();
const sectionRoleForBar=bar=>{const section=sectionForBar(bar);return section?sectionRoles.get(section)||'body':'body';};
// 場面ごとの「形の好み」。点数を引くほど前へ出る(rankShapes の prefer.ids)。
// 音との合いかたが同じくらいの候補の中でしか効かないので、サビだからといって音に合わない形は出ない。
const SECTION_SHAPE_PREFERENCE=Object.freeze({
  intro:Object.freeze({alternate2:.6,stair_up:.4,stair_down:.4,fold_up:.3,bounce:.3}),
  climax:Object.freeze({expand:.8,out_in_out:.8,in_out_in:.5,edge_swing:.6,alternate3:.4,cross_step_up:.3,cross_step_down:.3}),
  outro:Object.freeze({contract:.8,fold_down:.4,stair_down:.3,in_out_in:.3}),
  body:Object.freeze({}),
});
// フレーズの指紋: 刻み(相対グリッド)と音の高さの上下(±1/0)を並べたもの。
// 区切りの繰り返し(repeatOf)が取れなかった曲でも、同じリズム・同じ動きのフレーズには
// 同じ形を当てられる(2回目は左右反転)。
const motifKeyOf=(grids,heights)=>{
  const gaps=grids.slice(1).map((g,i)=>g-grids[i]);
  const contour=[];
  for(let i=1;i<heights.length;i++){
    const a=heights[i-1],b=heights[i];
    contour.push(a==null||b==null?'?':(b-a>.04?'+':(a-b>.04?'-':'='))); 
  }
  return `${grids.length}|${gaps.join(',')}|${contour.join('')}`;
};

// ============================================================================
// 優先順位（すべての難易度で共通。ここが「同じ骨格の濃淡」の土台）
// ============================================================================
const priorityOf=onset=>{
  const position=((onset.grid%BEAT)+BEAT)%BEAT;
  const sustained=onset.sustainMs>=140?SUSTAIN_BONUS:0;
  return (CHARACTER_WEIGHT[onset.character]??.4)
    +onset.strength*STRENGTH_WEIGHT
    +(POSITION_WEIGHT[position]??0)
    +sustained
    +(onset.pitchHz>0?PITCHED_BONUS:0);
};
const priorityByGrid=new Map(allOnsets.map(onset=>[onset.grid,priorityOf(onset)]));

// ============================================================================
// 1つの難易度を組み立てる
// ============================================================================
const buildChart=(difficulty,options={})=>{
  const densityAdjust=Number(options.densityAdjust)||1;
  // 難易度の方針を、この曲の歯ごたえで少しだけ動かす。
  //
  // 【なぜ要るか】(2026-09-06・ユーザー指摘「どの曲も難易度が似たりよったり。もっと振れ幅がほしい」)
  // これまで曲ごとに変わるのは**量(ノーツ数)だけ**で、中身は全曲まったく同じだった。
  // 実測すると、EASYは11曲すべてが「細いノーツ0% / 押しながら0 / フリック0」で、
  // 違うのは同時押しの数(8〜24)とノーツ数だけ。密度は1.9倍違うのに Lv. は5〜8に団子だった。
  // レベルは「詰まり具合 × 横の移動 × 細さ × 種類 × 経路」で決まるので、
  // 量しか動かないと、いくら密度を振っても Lv. は広がらない。
  //
  // 【何を動かして、何を動かさないか】
  // 動かすのは**割合(1分あたり何個・細いノーツの率)だけ**。
  // 「できること」(使える種類・使える幅・格子・レーンの飛び幅・連続の上限・
  // 押さえながら叩くか・同時押しの置き方の条件)は難易度の身分そのものなので**動かさない**。
  // こうしないと「EASYなのにEXPERTの形が出る」ことになり、遊べるかどうかの保証も崩れる。
  const challengeForProfile=songChallengeFactor(audio).factor;
  // **減らす方向にだけ効かせる。** 増やす方向にも効かせると、
  // 難易度ごとに決めてある置き方（跳びの上限・同時押しの置き場所・クロスの外側）を
  // 置く側が守りきれなくなり、実測で「EASYで1.5レーン跳ぶ」「HARDの同時押しが
  // NORMALより少ない」「クロスが押さえっぱなしの内側に来る」が同時に出た(2026-09-06)。
  // 濃い曲はその難易度の既定どおりにし、薄い曲だけ中身もやさしくする。
  const vocab=Math.min(1,Math.pow(challengeForProfile,CHALLENGE_VOCABULARY_EXPONENT));
  const scaleRate=value=>Number.isFinite(value)&&value>0?value*vocab:value;
  const P=(()=>{
    const base=PROFILES[difficulty];
    return Object.freeze({...base,
      holdPerMinute:scaleRate(base.holdPerMinute),
      slidePerMinute:scaleRate(base.slidePerMinute),
      flickPerMinute:scaleRate(base.flickPerMinute),
      endFlickPerMinute:scaleRate(base.endFlickPerMinute),
      accentPerMinute:scaleRate(base.accentPerMinute),
      crossPerMinute:scaleRate(base.crossPerMinute),
      // 細いノーツの率（vocab は1以下なので、減る方向にしか動かない）
      narrowRate:base.narrowRate*vocab,
      chord:base.chord?Object.freeze({...base.chord,perMinute:scaleRate(base.chord.perMinute)}):base.chord,
      sweep:base.sweep?Object.freeze({...base.sweep,perMinute:scaleRate(base.sweep.perMinute)}):base.sweep,
      chordRun:base.chordRun?Object.freeze({...base.chordRun,perMinute:scaleRate(base.chordRun.perMinute)}):base.chordRun,
    });
  })();
  let notes=[];
  // 分あたりの割合を、この曲の長さぶんの個数へ直す
  const playableMinutes=Math.max(.25,(gridTimeMs(maxGrid)-gridTimeMs(minGrid))/60000);
  const countOf=perMinute=>perMinute>0?Math.max(1,Math.round(perMinute*playableMinutes)):0;
  const holdMax=countOf(P.holdPerMinute),slideMax=countOf(P.slidePerMinute),
    flickMax=countOf(P.flickPerMinute),endFlickMax=countOf(P.endFlickPerMinute),
    chordMax=countOf(P.chord?P.chord.perMinute:0),accentMax=countOf(P.accentPerMinute);
  const log=[];
  // log は「かたまりごとにどの形を当てたか」だけを入れる。
  // 出来事の説明（同時押しを何組置いたか等）は混ぜず、notice へ分ける
  // （混ぜると「使った形」の集計に文章が数えられてしまう）。
  const notice=[];

  // --- 1. 拾う音を決める（小節ごとに、優先順位の上位から） ---
  // 拍が立っていない曲では、16分裏の弱い音を拾わない。
  //
  // 【2026-09-05・「全然テンポにあった譜面になってない」という指摘から】
  // Stay With Me は格子そのものは曲の頭から終わりまで±7ms以内で合っていた。
  // ずれていたのではなく、**拾う音**が悪かった。この曲は打点の半分が16分裏にあり、
  // その強さが拍の頭とほとんど同じ（0.393 対 0.405）。ドラムで拍が刻まれておらず、
  // ストリングスや持続音の立ち上がりを16分裏として拾っていた。
  // 結果、HARDで35%・MASTERで42%のノーツが16分裏に乗り、
  // 曲の聞こえるリズムと関係ない場所を叩かされていた（Monster Heroは3〜5%）。
  //
  // そこで「拍の頭の音 ÷ 16分裏の音」の比を見て、拍が立っていない曲では
  // 16分裏は**拍の頭の平均より強い音だけ**にする。数を減らすのではなく、
  // 拾う場所を拍の骨格へ寄せる。拍がはっきりしている曲では比が大きいので何も変わらない。
  const onBeatOrEighth=onset=>((onset.grid%BEAT)+BEAT)%BEAT%2===0;
  // しきい値は「拍の頭の平均」ではなく、**その曲の16分裏の中での上位いくつか**にする。
  // 拍の頭の平均を使うと、拍が立っていない曲ほどその値も低くなるので絞れない
  // （MF × ICHIKA MIX は拍の頭0.480に対して16分裏0.489で、ほとんど落ちなかった）。
  // 「16分裏のうち強いほうから OFF_BEAT_KEEP だけ残す」なら、曲によらず確実に効く。
  const offBeatFloor=(()=>{
    const clarity=audio.summary?.beatClarity;
    if(!clarity||!(clarity.ratio>0)||clarity.ratio>=BEAT_CLARITY_MIN)return 0;
    const strengths=allOnsets.filter(onset=>!onBeatOrEighth(onset))
      .map(onset=>onset.strength).sort((a,b)=>a-b);
    if(!strengths.length)return 0;
    return strengths[Math.floor(strengths.length*(1-OFF_BEAT_KEEP))]??0;
  })();
  // ★大きい一発(FULL)だけは、格子からのずれをもう少し許す。
  //   30msで切っていたため、格子と噛み合わせが悪い曲では**大きい一発の半分が落ちていた**
  //   （実測: MF × ICHIKA MIX は大事な音320個のずれが中央25ms・p90 39msで、157個が25msを超える。
  //     Monster Hero は中央9msなのでほとんど落ちない）。
  //   落としてしまうと「曲の山なのにノーツが来ない」になる。いちばん良い判定(MARVELOUS)の窓は
  //   ±55msなので、43msずれた音を格子へ寄せて置いても**まだ最良の判定の中**に入る。
  //   43msという線は、耳で確かめるときの許容(earReviewMaxOffsetMs)と同じものを使う。
  const peakOffsetAllowance=onset=>onset.character==='FULL'
    ?COMMON.earReviewMaxOffsetMs:COMMON.maxAbsPeakOffsetMs;
  const pool=allOnsets.filter(onset=>
    onset.grid%P.lattice===0&&Math.abs(onset.gridOffsetMs)<=peakOffsetAllowance(onset)
    &&(offBeatFloor<=0||onBeatOrEighth(onset)||onset.strength>=offBeatFloor));
  // 全体で何個置くかを先に決める（1拍あたりの目標を、毎秒の下限・上限で挟む）。
  // これで曲が変わっても、遊んだ感じの忙しさがそろう。
  const [liftMin,liftMax]=MUSICAL_LIFT;
  const target=DENSITY_TARGET[difficulty];
  const beatsPerSecond=1000/timing.beatMs;
  const playableMs=gridTimeMs((maxBar+1)*BAR)-gridTimeMs(minBar*BAR);
  // 曲の歯ごたえで量を上下させる。
  // 上限は一緒に動かす（濃い曲がそこで頭打ちになると差が消える）が、
  // **下限は動かさない**。下限は「これ以下だと間延びして拍が取れない」ための線なので、
  // 薄い曲だからといって下げてよいものではない。
  const challenge=songChallengeFactor(audio);
  // hardMaxPerSecond は factor を掛けない（掛けたら上限にならない。上の但し書きを参照）
  const notesPerSecond=Math.max(target.minPerSecond,
    Math.min(target.hardMaxPerSecond,
      target.maxPerSecond*challenge.factor,target.perBeat*beatsPerSecond*challenge.factor));
  const targetCount=Math.round(notesPerSecond*playableMs/1000);
  // 小節ごとの取り分は「その小節にある音の数 × 盛り上がりの持ち上げ」の比で配る。
  // どれだけ盛り上がっても、その小節に無い音は叩かせない。
  const weights=new Map();
  let weightSum=0;
  for(let bar=minBar;bar<=maxBar;bar++){
    const position=intensityPosition(bar);
    const weight=musicalOnsetsInBar(bar)*(liftMin+(liftMax-liftMin)*position);
    weights.set(bar,weight);
    weightSum+=weight;
  }
  const scale=weightSum>0?targetCount*densityAdjust/weightSum:0;
  const picked=[];
  let carry=0;
  for(let bar=minBar;bar<=maxBar;bar++){
    carry+=weights.get(bar)*scale;
    const limit=Math.floor(carry+1e-9);
    carry-=limit;
    if(limit<=0)continue;
    const inBar=pool.filter(onset=>onset.grid>=bar*BAR&&onset.grid<(bar+1)*BAR)
      .sort((a,b)=>priorityByGrid.get(b.grid)-priorityByGrid.get(a.grid)||a.grid-b.grid);
    const taken=[];
    for(const onset of inBar){
      if(taken.length>=limit)break;
      // 同じ小節の中で近すぎる音は取らない
      if(taken.some(t=>Math.abs(t.grid-onset.grid)<P.lattice))continue;
      taken.push(onset);
    }
    picked.push(...taken);
  }
  picked.sort((a,b)=>a.grid-b.grid);

  // --- 1b. 出だしが空きすぎないようにする ---
  //
  // 小節ごとの取り分は「その小節にある音の数 × 盛り上がり」の比で配るので、
  // 静かなイントロは取り分が1に満たず、繰り上がるまでノーツが1つも置かれない。
  // そのため「曲は鳴っているのにノーツだけ来ない」時間が頭にできる。
  // 実際に Close To Your Heart は最初のノーツが 3.8秒後だった
  // (2026-09-05・ユーザー指摘「風がそよぐ場所の最初の無音が長いのが気になる」)。
  //
  // 決定を押してからカウントダウンに3.2秒かかるので、そこへ3秒以上足すと待たされすぎる。
  // 出だしに叩ける音があるなら、そのうちいちばん強いものを1つだけ置く。
  // **音の無いところへ置くことはしない**（pool は実際に鳴っている音しか持っていない）。
  const firstNoteLimitMs=3000;
  if(picked.length){
    const firstMs=gridTimeMs(picked[0].grid);
    if(firstMs>firstNoteLimitMs){
      const early=pool.filter(onset=>{
        const ms=gridTimeMs(onset.grid);
        return ms>=0&&ms<=firstNoteLimitMs;
      });
      if(early.length){
        // いちばん優先度の高い音を1つ。同点なら早いほうを選ぶ
        const head=early.slice().sort((a,b)=>
          (priorityByGrid.get(b.grid)-priorityByGrid.get(a.grid))||(a.grid-b.grid))[0];
        picked.unshift(head);
      }
    }
  }

  // --- 2. 最短の刻みの連なりを難易度なりの長さで止める ---
  // --- 2b. 息継ぎ ---
  // 最短の刻みがその難易度の上限(maxRun)まで続いたら、そのあと半拍〜1拍は
  // 装飾の音(拍の頭でない・大きな一発でない)を拾わない。難所のあとに手を休ませるため。
  // 背骨(拍の頭・大きな一発)はそのまま残すので、曲を叩いている感じは消えない。
  // (外部の公開基準にも「速い連なりのあとにはフレーズごとに休みを置く」がある。
  //  docs/spec/RHYTHM_CHART_DESIGN.md 5章)
  const breathGrids=P.lattice>1?BEAT:Math.round(BEAT/2);
  const isBackbone=onset=>((onset.grid%BEAT)+BEAT)%BEAT===0||onset.character==='FULL';
  const spaced=[];
  let run=1,breathUntil=-Infinity;
  for(const onset of picked){
    const last=spaced[spaced.length-1];
    if(onset.grid<breathUntil&&!isBackbone(onset))continue;
    if(last&&onset.grid-last.grid<=P.lattice){
      if(run>=P.maxRun){breathUntil=onset.grid+breathGrids;continue;}
      run++;
    }else run=1;
    spaced.push(onset);
  }

  // --- 3. 伸びる音・動く音を HOLD / SLIDE として先に確保する ---
  // 「音が伸びている長さぶん押さえる」「音の高さの動きに沿ってなぞる」を、実際の解析から作る。
  const reserved=[];
  const usedGrids=new Set();
  const spacedGrids=new Set(spaced.map(o=>o.grid));
  if(P.types.includes('HOLD')||P.types.includes('SLIDE')){
    const spans=audio.sustains
      .filter(span=>span.startGrid>=minGrid&&span.endGrid<=maxGrid&&span.grids>=COMMON.holdMinGrids)
      .filter(span=>[0,1,-1,2,-2].some(shift=>spacedGrids.has(span.startGrid+shift)))
      .sort((a,b)=>b.grids-a.grids);
    let holds=0,slides=0;
    for(const span of spans){
      // 始点は、採用済みの打点にいちばん近いところへ寄せる
      const startGrid=[0,-1,1,-2,2].map(shift=>span.startGrid+shift).find(g=>spacedGrids.has(g));
      if(startGrid==null)continue;
      const endGrid=Math.min(span.endGrid,startGrid+Math.round(BEAT*4));
      const grids=endGrid-startGrid;
      if(grids<COMMON.holdMinGrids)continue;
      // 押さえノーツどうしは重ねない。
      // 旋律の sustains は pitchCurve(1グリッドに1つの音高)から作るので原理的に重ならず、
      // ここで重なりを許しても一度も発火しなかった(全20曲・2702件で重なり0件)。
      // 同時押さえは「--- 15.5 同時押さえ ---」がベースの伸び(bassSustains)から作る。
      if(reserved.some(r=>startGrid<=r.endGrid+1&&endGrid>=r.startGrid-1))continue;
      const moves=span.moves??0;
      const wantSlide=P.types.includes('SLIDE')&&moves>=COMMON.slideMinMove&&grids>=COMMON.slideMinGrids;
      if(wantSlide){
        if(slides>=slideMax)continue;
        reserved.push({type:'SLIDE',startGrid,endGrid,span});slides++;
      }else{
        if(!P.types.includes('HOLD')||holds>=holdMax)continue;
        reserved.push({type:'HOLD',startGrid,endGrid,span});holds++;
      }
    }
    // --- 3b. 走る音（アルペジオ・トレモロ）もSLIDEの材料にする ---
    //
    // 【2026-09-12・ユーザー指示】「スライドにする材料を広げる」
    //
    // ここまでのSLIDEの材料は**伸びている音**(audio.sustains)だけだった。
    // 音階を駆け上がる／行き来するアルペジオ・トレモロは、1音ずつ短いので sustains にならず、
    // **全部単押しになっていた**。設計書 §3.1.8 に「ジグザグをもっと増やしたいなら
    // SLIDEにする材料そのものを広げるしかない」と残っていた項目。
    //
    // 素は「速く並んでいて、音の高さが実際に動いている打点の連なり」。
    // 1音ずつ鳴っているところをなぞらせるので、**幽霊ノーツ(§2.1)にはならない**
    // （経路の中継点はその打点の音の高さそのもの）。本物の音ゲーでも、
    // グリッサンドや駆け上がりはスライドで書く。
    //
    // ⚠️ 単押しの連なりが1本のSLIDEになるので、**ノーツの数が減り、難しさの質が変わる**。
    //    そのため1分あたりの本数で絞る（glideSlide.perMinute）。減ったぶんは
    //    量の目標のやり直し（buildChart の外の densityAdjust）が別の音で埋める。
    if(P.glideSlide&&P.glideSlide.perMinute>0&&P.types.includes('SLIDE')){
      const G=P.glideSlide;
      const glideMax=countOf(G.perMinute);
      // ★探すのは **pool（鳴っている音）** のほう。spaced（打点として採用したぶん）から
      //   探していたら、格子・連なりの上限で間引かれて連なりが切れており、
      //   4個以上つながる速い連なりがほとんど残っていなかった
      //   （実測: Stay With Me MASTER は速い連なり428本のうち422本が「短い」で落ちた）。
      //   「音が走っている」のは曲の性質で、打点として何個採ったかとは別。
      //   連なりの中の打点は、このSLIDEが押さえるので usedGrids で自然に落ちる。
      const runs=[];
      let current=[];
      for(const onset of pool){
        if(!(onset.grid>=minBar*BAR&&onset.grid<(maxBar+1)*BAR))continue;
        const last=current[current.length-1];
        if(last&&onset.grid-last.grid<=G.maxGapGrids)current.push(onset);
        else{if(current.length)runs.push(current);current=[onset];}
      }
      if(current.length)runs.push(current);
      const candidates=[];
      for(const run of runs){
        if(run.length<G.minOnsets)continue;
        // ★長すぎる連なりは**捨てずに頭から切って使う**（サビをまるごと1本にしない）。
        //   長さで弾いていたら、速い連なりが長い曲でかえって0本になった
        //   （禁断のレジスタンスが2本→0本になった・2026-09-12）。
        const list=[];
        for(const onset of run){
          if(list.length&&onset.grid-run[0].grid>G.maxGrids)break;
          list.push(onset);
        }
        if(list.length<G.minOnsets)continue;
        const startGrid=list[0].grid,endGrid=list[list.length-1].grid;
        if(endGrid-startGrid<COMMON.slideMinGrids)continue;
        // 音の高さが取れていて、実際に動いていること
        const heights=list.map(onset=>heightByGrid.has(onset.grid)?heightByGrid.get(onset.grid):null);
        if(heights.filter(height=>height!=null).length<Math.ceil(list.length*.75))continue;
        const known=heights.filter(height=>height!=null);
        const range=Math.max(...known)-Math.min(...known);
        if(range<G.minHeightRange)continue;
        // ジッタではなく本当に動いていること（HEIGHT_TURN_MIN を超える動きが何回あるか）
        let moves=0;
        for(let i=1;i<heights.length;i++){
          if(heights[i]==null||heights[i-1]==null)continue;
          if(Math.abs(heights[i]-heights[i-1])>=HEIGHT_TURN_MIN)moves++;
        }
        if(moves<G.minMoves)continue;
        // すでに押さえノーツが入っているところへは重ねない
        if(reserved.some(item=>startGrid<=item.endGrid+1&&endGrid>=item.startGrid-1))continue;
        // ★ベースの2声が取れている場所は避ける。そこは同時押さえ(15.5)の材料で、
        //   「本当に2声鳴っている」いちばん筋の良い形だから、こちらが先に取ってはいけない。
        //   避けずに置いたら、同時押さえが4組→1組へ減った(2026-09-12)。
        //   指は2本しかないので、長く押さえる形どうしは必ず取り合いになる。
        if(Array.isArray(audio.bassSustains)&&audio.bassSustains.some(span=>
          startGrid<=span.endGrid&&endGrid>=span.startGrid))continue;
        candidates.push({startGrid,endGrid,list,range,moves});
      }
      // 良いもの（よく動くもの）から、曲全体へ散らして採る
      const byGrid=new Map();
      for(const candidate of candidates.slice().sort((a,b)=>b.range-a.range||b.moves-a.moves)){
        if(!byGrid.has(candidate.startGrid))byGrid.set(candidate.startGrid,candidate);
      }
      let glides=0;
      for(const grid of spreadPick([...byGrid.keys()],glideMax,G.spacingGrids)){
        const candidate=byGrid.get(grid);
        if(reserved.some(item=>candidate.startGrid<=item.endGrid+1&&candidate.endGrid>=item.startGrid-1))continue;
        reserved.push({type:'SLIDE',startGrid:candidate.startGrid,endGrid:candidate.endGrid,
          glide:true,span:{startGrid:candidate.startGrid,endGrid:candidate.endGrid,
            grids:candidate.endGrid-candidate.startGrid,moves:candidate.range,clarity:1}});
        glides++;
      }
      if(glides)notice.push(`走る音をなぞるSLIDE ${glides}本`
        +`（狙い${glideMax}本・置ける場所${byGrid.size}箇所）`);
    }
    reserved.sort((a,b)=>a.startGrid-b.startGrid);
    for(const item of reserved)for(let g=item.startGrid+1;g<=item.endGrid;g++)usedGrids.add(g);
  }
  // 押さえている最中の打点は落とす（低い難易度では指が足りない）
  const events=[];
  for(const onset of spaced){
    if(usedGrids.has(onset.grid)&&!P.tapDuringHold)continue;
    if(usedGrids.has(onset.grid)&&P.tapDuringHold){
      // 上位難易度でも「押さえながら別を叩く」は指が1本しか残らない。
      //   ・同時に押さえているHOLD/SLIDEが2本あるときは置かない（指が足りない）
      //   ・始点の直後と終点の直前は避ける（押さえ始め・離しに指を使うため）
      const covering=reserved.filter(r=>onset.grid>r.startGrid&&onset.grid<=r.endGrid);
      if(covering.length!==1)continue;
      const owner=covering[0];
      if(onset.grid-owner.startGrid<BEAT)continue;
      if(owner.endGrid-onset.grid<BEAT)continue;
    }
    events.push({kind:'TAP',grid:onset.grid,onset});
  }
  for(const item of reserved){
    const onset=onsetByGrid.get(item.startGrid);
    const index=events.findIndex(e=>e.grid===item.startGrid);
    if(index>=0)events.splice(index,1);
    events.push({kind:item.type,grid:item.startGrid,onset,reserved:item});
  }
  events.sort((a,b)=>a.grid-b.grid);

  // --- 4. かたまり（フレーズ）へ分ける ---
  // まず「間があいたところ」で切り、そのあと**長すぎるかたまりを形の単位へ割る**。
  // 16分が並ぶ区間を1つの形で塗ると、8個ぶんずっと同じ交互になって読み飽きる。
  // 本物の譜面は、長い連なりを4個ずつくらいの形（階段・折り返し・トリル）の並びで書く。
  const rawRuns=[];
  for(const event of events){
    const current=rawRuns[rawRuns.length-1];
    if(current&&event.grid-current[current.length-1].grid<COMMON.runGapGrids){
      current.push(event);
    }else{
      rawRuns.push([event]);
    }
  }
  const runs=[];
  for(const list of rawRuns){
    const gapsAll=list.slice(1).map((e,i)=>e.grid-list[i].grid);
    const shortest=gapsAll.length?Math.min(...gapsAll):Infinity;
    // 細かい刻みほど短く割る（16分なら1拍ぶん＝4個、8分なら2拍ぶん）
    const chunk=shortest<=P.lattice?COMMON.chunkFast
      :shortest<=BEAT/2?COMMON.chunkMedium:COMMON.chunkSlow;
    // 音の高さの向きが変わるところを優先して割る
    const turnAt=new Set();
    const heights=list.map(e=>heightByGrid.has(e.grid)?heightByGrid.get(e.grid):null);
    for(let i=1;i<list.length-1;i++){
      const before=heights[i-1],here=heights[i],after=heights[i+1];
      if(before==null||here==null||after==null)continue;
      const a=here-before,b=after-here;
      if(a*b<0&&Math.abs(a)>.04&&Math.abs(b)>.04)turnAt.add(i+1);
    }
    let start=0;
    while(start<list.length){
      let end=Math.min(list.length,start+chunk);
      for(let i=start+2;i<Math.min(list.length,start+chunk+2);i++){
        if(turnAt.has(i)&&i-start>=2){end=i;break;}
      }
      if(list.length-end===1&&end-start>2)end=list.length;   // 1個だけ余らせない
      runs.push({events:list.slice(start,end)});
      start=end;
    }
  }

  // --- 5. かたまりごとに形を当てる ---
  // 同じフレーズが繰り返されるときは同じ形を使い、2回目以降は左右を反転する。
  const shapeMemory=new Map();
  // フレーズの指紋 → 使った形(区切りの繰り返しが取れない曲でも、同じフレーズは同じ形にする)
  const motifMemory=new Map();
  // 直近に使った形。同じ形が続かないよう、形を選ぶときに後回しにする材料にする。
  const recentShapes=[];
  // その曲でそれぞれの形を使った回数(語彙を均すため。多く使った形ほど後回しになる)
  const shapeUsage=new Map();
  // 直前のかたまりの並び(つなぎの向きを見る)と、同じ向きへ流れ続けた回数
  let lastOffsets=null,driftCount=0,lastDirection=0;
  const laneUse=[0,0,0,0,0];
  let lastLane=2,lastPlacedGrid=-Infinity;
  const placed=[];
  const placeable=(subLane,width,grid)=>{
    const candidate={subLane,subLaneWidth:width};
    for(let i=placed.length-1;i>=0;i--){
      const before=placed[i];
      const deltaMs=(grid-before.grid)*gridMs;
      if(deltaMs>=HAND_MODEL.restrikeLimitMs)break;
      if(deltaMs<=0)continue;
      if(!fingerPairFeasible(candidate,before,deltaMs).ok)return false;
    }
    return true;
  };
  // 幅は「その難易度で使える幅の中の順位」で決める。狙いの数値で決めると、
  // 幅の種類が少ない難易度（MASTERは1〜4）で重い音と軽い音が同じ幅になってしまう。
  //   重い一発ほど太く、軽い音ほど細く（docs/spec/RHYTHM_CHART_DESIGN.md 2章）
  const widthFor=(onset,kind)=>{
    const available=[...P.widths].sort((a,b)=>a-b);
    const at=ratio=>available[Math.max(0,Math.min(available.length-1,Math.round(ratio*(available.length-1))))];
    if(!onset)return at(.5);
    if(kind==='SLIDE')return at(.4);
    switch(onset.character){
      case 'FULL':  return available[available.length-1];
      case 'PUNCH': return at(.66);
      case 'BODY':  return at(.4);
      case 'LIGHT': return available[0];
      default:      return at(.5);
    }
  };
  const centeredSubLane=(lane,width)=>Math.max(0,Math.min(10-width,lane*2+1-Math.ceil(width/2)));
  // 跳びの上限。難易度の歩幅(maxLaneStep)だけでなく、**その時間で指が動ける距離**でも抑える。
  // MASTERの歩幅4は「1拍あれば4レーン動ける」の意味で、97msで4レーンは限界(18レーン毎秒)を超える。
  // 同時押し・連なり・クロスは形を決めたあとに中心を動かすので、ここで時間も見る
  // (実測: クロスで外側へ寄せたTAPの97ms後に反対の端のTAPが来て、自動修正でも直らなかった)。
  const stepLimitLanes=deltaGrids=>Math.min(P.maxLaneStep,HAND_MODEL.laneSpeedLimit*(Math.abs(deltaGrids)*gridMs/1000)*.9);

  for(const runGroup of runs){
    const list=runGroup.events;
    const length=list.length;
    const grids=list.map(e=>e.grid);
    const heights=grids.map(g=>heightByGrid.has(g)?heightByGrid.get(g):null);
    const gaps=grids.slice(1).map((g,i)=>g-grids[i]);
    const minGap=gaps.length?Math.min(...gaps):Infinity;
    const fastest=minGap<=P.lattice;
    const allowJack=minGap===Infinity||minGap*gridMs>=HAND_MODEL.restrikeLimitMs;
    const maxStep=minGap<BEAT?Math.min(P.maxLaneStep,COMMON.laneStepFastMax):P.maxLaneStep;

    // 反復フレーズなら、前に使った形を思い出す
    // 繰り返しの区切りなら、前に使った形を思い出す（同じフレーズは同じ形で来る）
    const bar=Math.floor(grids[0]/BAR);
    const section=sectionForBar(bar);
    const sourceBar=repeatSourceBar(bar);
    // 形を覚える鍵は「**どの小節の**どの位置の、いくつ分のかたまりか」。
    // ★ここは `bar-(bar-section.startBar)` と書いてあり、式が `section.startBar` へ潰れていた
    //   （意図は `section.startBar+(bar-section.startBar)` ＝ `bar`）。
    //   そのため元の区切りは**どの小節のかたまりも区切りの先頭の番号で保存**され、
    //   繰り返しの区切りは `repeatOf+(bar-startBar)` で引くので、
    //   **区切りの先頭の小節しか一致しない**。実測で「区切りの繰り返しの一致」は
    //   monster_hero EXPERT 0/8・MASTER 0/6 のようにほぼ全曲で0だった(2026-09-12)。
    //   指紋(motifKey)のほうは効いていた(11/14)ので、片方だけ死んでいたことに気づけなかった。
    const memoryKey=section
      ?`${sourceBar!=null?sourceBar:bar}:${grids[0]-bar*BAR}:${length}`
      :null;
    const motifKey=motifKeyOf(grids,heights);
    const remembered=(memoryKey?shapeMemory.get(memoryKey):null)||(length>=3?motifMemory.get(motifKey):null)||null;
    const chunkIndex=runs.indexOf(runGroup);
    const role=sectionRoleForBar(bar);

    // --- 形の候補を作る ---
    // 覚えている形(同じフレーズ)があればそれを先頭に、続けて音に合う順(＋文法の点数)の候補を並べる。
    // 先頭の形が「起点をどこに置いても指の条件を満たさない」ときは次の候補を試す。
    // 以前は先頭だけを試して、置けなければ1音ずつ逃がす fallback へ落ちていた。
    // fallback は形にならない(読めない)うえ、左端から順に空きを探すので継ぎ目で大きく跳んでいた
    // (実測: MASTERで8%が fallback、HARDで継ぎ目に3レーンの跳び)。
    const attempts=[];
    let rememberedAttempt=null;
    if(remembered&&remembered.offsets.length===length){
      // 同じフレーズは同じ形で。2回目は左右反転、3回目は「少し発展」(文法で選び直す＝直前を避けた別の形)、
      // 4回目は元へ…と3つで一巡させる。ずっと同じ形だと、左右対称の形(トリル・縦連・ゆれ)は
      // 反転しても見た目が変わらず、同じフレーズが続く曲で7回同じ形が並んだ(実測)。
      const count=(remembered.count||1)+1;
      const develop=count%3===0;
      const mirroredNow=!develop&&count%2===0;
      const offsetsNow=mirroredNow?mirror(remembered.offsets):remembered.offsets.slice();
      if(develop)remembered.count=count;
      else if(maxStepOf(offsetsNow)<=maxStep)rememberedAttempt={offsets:offsetsNow,patternId:remembered.patternId,mirrored:mirroredNow,fromMemory:true,count};
    }
    if(rememberedAttempt)attempts.push(rememberedAttempt);
    {
      // 音の高さが取れないときは、刻みの細かさから形を選ぶ
      const rhythmShape=minGap<=P.lattice?'fast':(minGap<=BEAT?'beat':'slow');
      const candidates=shapeCandidatesFor({length,heights,maxStep,fastest,allowJack,
        rhythmShape,rotate:chunkIndex,recent:recentShapes.slice(-COMMON.shapeAvoidRecent)});
      // 音との合いかたが同じくらいの候補の中で、つなぎ・使用回数・場面・決定的な散らしで選ぶ(譜面文法)
      const ranked=rankShapes(candidates,{usage:shapeUsage,previousOffsets:lastOffsets,
        prefer:{ids:SECTION_SHAPE_PREFERENCE[role]||{},turn:driftCount>=variantStyle.driftTurnAfter},
        seed:`${trackId}:${difficulty}:${chunkIndex}${variantSeed}`,maxStep});
      for(const chosen of ranked.slice(0,6))attempts.push({offsets:chosen.offsets.slice(),patternId:chosen.pattern.id,mirrored:false,fromMemory:false});
      if(!attempts.length)attempts.push({offsets:Array.from({length},()=>0),patternId:null,mirrored:false,fromMemory:false});
    }

    const widths=list.map(event=>widthFor(event.onset,event.kind));
    const pattern0=null;
    let best=null,offsets=null,patternId=null,mirrored=false,motifSource=null;
    for(const attempt of attempts){
      offsets=attempt.offsets;patternId=attempt.patternId;mirrored=attempt.mirrored;
      const pattern=patternId?PATTERN_BY_ID[patternId]:null;
      const min=Math.min(...offsets),max=Math.max(...offsets);
      const bases=[];
      for(let base=-min;base<=LANES-1-max;base++)bases.push(base);
      const score=base=>{
        const lanes=fitToLanes(offsets,base);
        if(!lanes)return null;
        let cost=0;
        // 前のかたまりからの続き（近いほどよい。ただし同じ場所に張り付かない）
        const step=Math.abs(lanes[0]-lastLane);
        cost+=Math.abs(step-1)*2;
        // かたまりの継ぎ目でも、1拍未満で続くなら跳びはその難易度の上限まで
        // (形の中だけ守っても、継ぎ目で3レーン跳んでは意味が無い)
        if(grids[0]-lastPlacedGrid<BEAT&&step>maxStep+1e-9)return null;
        // 手の流れ: 直前のかたまりが右へ抜けたなら右隣から、左へ抜けたなら左隣から始めると自然。
        // ただし同じ向きへ3かたまり以上流れ続けると端に張り付くので、そのときは折り返す側を好む
        const direction=Math.sign(lanes[0]-lastLane);
        if(lastDirection!==0&&direction!==0)cost+=(driftCount>=2?direction===lastDirection:direction!==lastDirection)?1.5:0;
        // 中央前提の形は中央へ
        if(pattern&&pattern.centered)cost+=Math.abs(base-2)*3;
        // 同じフレーズの3回目以降は、起点を1つずらして「少し発展」させる(HARD以上)
        if(attempt.fromMemory&&attempt.count>=3&&P.level>=5&&remembered.base!=null)cost+=Math.abs(Math.abs(base-remembered.base)-1)*.8;
        // レーンの偏りをならす
        for(const lane of lanes)cost+=laneUse[lane]*.05;
        // 同点のときの決定的な散らし(乱数は使わない)
        cost+=(hash32(`${trackId}:${difficulty}:${chunkIndex}:${base}`)%10)/20;
        return {lanes,cost};
      };
      for(const base of bases){
        const scored=score(base);
        if(!scored)continue;
        // 指の条件を満たすか、置きながら確かめる
        let ok=true;
        const trial=[];
        for(let i=0;i<length;i++){
          const width=widths[i];
          const subLane=centeredSubLane(scored.lanes[i],width);
          const previous=placed.concat(trial);
          // 種類も持たせる。押さえるノーツ(HOLD/SLIDE)は帯の端まで指を寄せられない(heldTouchSpan)ので、
          // 種類が無いと「叩くノーツ」として甘く見積もり、置いたあとで「押せない」が出ていた
          // (実測: 先行公開の2曲のMASTER/EXPERTに1件ずつ残っていた)
          const candidate={type:list[i].kind==='TAP'?'TAP':list[i].kind,subLane,subLaneWidth:width,grid:grids[i],
            ...(list[i].reserved?{durationGrids:list[i].reserved.endGrid-list[i].reserved.startGrid}:{})};
          let feasible=true;
          for(let k=previous.length-1;k>=0;k--){
            const before=previous[k];
            const deltaMs=(grids[i]-before.grid)*gridMs;
            if(deltaMs>=HAND_MODEL.restrikeLimitMs)break;
            if(deltaMs<=0)continue;
            if(!fingerPairFeasible(candidate,before,deltaMs).ok){feasible=false;break;}
          }
          if(!feasible){ok=false;break;}
          trial.push(candidate);
        }
        if(!ok)continue;
        // 指の太さだけでは「4レーンを217msで動けない」のような**届かない**配置を拾えない。
        // 直近2拍ぶんの置いた音といっしょに両手をシミュレートし、この試しの音に「押せない」が
        // 出る起点は捨てる(実測: 207BPMの曲のMASTERで、SLIDEの始点が届かず自動修正でも直らなかった)。
        // 窓の外の指は自由と見なすので甘めだが、自動修正が最後にもう一度全体を見る。
        const windowFrom=grids[0]-BEAT*2;
        const recentPlaced=placed.filter(note=>note.grid>=windowFrom);
        const sim=simulateNotes(recentPlaced.concat(trial),timing,{beam:4});
        if(sim.issues.some(issue=>issue.severity==='impossible'&&issue.noteIndex>=recentPlaced.length)){continue;}
        if(!best||scored.cost<best.cost)best={...scored,base,trial};
      }
      if(best){
        if(attempt.fromMemory){remembered.count=attempt.count;motifSource=remembered.firstGrid;}
        else{
          const memo={patternId,offsets:offsets.slice(),mirrored:false,count:1,firstGrid:grids[0],base:best.base};
          if(memoryKey&&!shapeMemory.has(memoryKey))shapeMemory.set(memoryKey,memo);
          if(length>=3&&!motifMemory.has(motifKey))motifMemory.set(motifKey,memo);
        }
        break;
      }
    }
    if(patternId&&best){recentShapes.push(patternId);shapeUsage.set(patternId,(shapeUsage.get(patternId)||0)+1);}
    if(!best){
      // どの形・どの起点でも置けないときは、1つずつ逃がす（まれ）。
      // 逃がす先は左端からではなく、**直前のノーツに近い順**に探す(継ぎ目で大きく跳ばないため)
      const lanes=[];
      let fromLane=lastLane;
      const windowFrom=grids[0]-BEAT*2;
      const trialSoFar=[];
      for(let i=0;i<length;i++){
        const width=widths[i];
        const center=centeredSubLane(fromLane,width);
        const order=[];
        for(let sub=0;sub<=10-width;sub++)order.push(sub);
        order.sort((a,b)=>Math.abs(a-center)-Math.abs(b-center)||a-b);
        let chosen=null;
        for(const sub of order){
          if(!placeable(sub,width,grids[i]))continue;
          // ここでも両手をシミュレートして「届く」場所だけを採る
          const candidate={type:list[i].kind==='TAP'?'TAP':list[i].kind,subLane:sub,subLaneWidth:width,grid:grids[i],
            ...(list[i].reserved?{durationGrids:list[i].reserved.endGrid-list[i].reserved.startGrid}:{})};
          const recentPlaced=placed.filter(note=>note.grid>=windowFrom).concat(trialSoFar);
          const sim=simulateNotes(recentPlaced.concat([candidate]),timing,{beam:4});
          if(sim.issues.some(issue=>issue.severity==='impossible'&&issue.noteIndex===recentPlaced.length))continue;
          chosen=sub;trialSoFar.push(candidate);break;
        }
        if(chosen==null)chosen=center;
        lanes.push(chosen);
        fromLane=Math.floor(chosen/2);
      }
      best={lanes:lanes.map(sub=>Math.floor(sub/2)),cost:0,base:null,
        trial:lanes.map((sub,i)=>({type:list[i].kind==='TAP'?'TAP':list[i].kind,subLane:sub,subLaneWidth:widths[i],grid:grids[i]}))};
      patternId='fallback';mirrored=false;
      offsets=lanes.map(sub=>Math.floor(sub/2));
    }
    lastOffsets=offsets.slice();

    if(remembered&&remembered.base==null&&best.base!=null)remembered.base=best.base;
    {
      const firstLane=best.lanes?best.lanes[0]:Math.floor(best.trial[0].subLane/2);
      const lastOf=best.lanes?best.lanes[best.lanes.length-1]:Math.floor(best.trial[best.trial.length-1].subLane/2);
      const direction=Math.sign(lastOf-firstLane)||Math.sign(firstLane-lastLane);
      driftCount=direction!==0&&direction===lastDirection?driftCount+1:0;
      if(direction!==0)lastDirection=direction;
    }
    list.forEach((event,i)=>{
      const item=best.trial[i];
      const lane=Math.floor(item.subLane/2);
      laneUse[Math.max(0,Math.min(4,best.lanes?best.lanes[i]:lane))]++;
      lastLane=best.lanes?best.lanes[i]:lane;
      lastPlacedGrid=grids[i];
      placed.push({type:event.kind==='TAP'?'TAP':event.kind,grid:grids[i],subLane:item.subLane,subLaneWidth:item.subLaneWidth,
        ...(event.reserved?{durationGrids:event.reserved.endGrid-event.reserved.startGrid}:{})});
      const note={type:event.kind==='TAP'?'TAP':event.kind,grid:grids[i],
        lane:Math.floor(item.subLane/2),subLane:item.subLane,subLaneWidth:item.subLaneWidth,
        sourceStrength:event.onset?Math.round(event.onset.strength*100)/100:0,
        sourcePeakOffsetMs:event.onset?event.onset.gridOffsetMs:0,
        sourceCharacter:event.onset?event.onset.character:'NONE'};
      if(event.kind==='HOLD'){
        note.durationGrids=event.reserved.endGrid-event.reserved.startGrid;
      }else if(event.kind==='SLIDE'){
        note.durationGrids=event.reserved.endGrid-event.reserved.startGrid;
        note.slidePoints=slidePathFor(event.reserved,best.lanes?best.lanes[i]:lane,item.subLaneWidth,P,event.onset);
        note.lane=note.slidePoints[0].lane;
        note.endLane=note.slidePoints[note.slidePoints.length-1].lane;
        // 走る音をなぞるSLIDE（3b）は印を残す。譜面だけを見ても区別できるようにしておくと、
        // 検査がスイープ（端から端まで動くSLIDE）と取り違えない
        if(event.reserved.glide===true)note.glideSlide=true;
        delete note.subLane;
      }
      notes.push(note);
    });
    log.push({fromGrid:grids[0],toGrid:grids[length-1],length,pattern:patternId,mirrored,
      lanes:best.lanes?best.lanes.slice():null,
      heights:heights.map(h=>h==null?null:Math.round(h*100)/100),
      motifKey,motifSource,role});
  }

  notes.sort((a,b)=>a.grid-b.grid);

  // --- 6. 区切りの一発（アクセント幅） ---
  // 大きな一発（FULL）のうち、いちばん強いものだけを幅広にする。
  // どこにでも出すと画面が幅広ノーツだらけになり、幅の段階が意味を失う。
  {
    const candidates=notes
      .map((note,index)=>({note,index}))
      .filter(({note})=>note.type==='TAP'&&note.sourceCharacter==='FULL'
        &&!notes.some(other=>other!==note&&other.grid===note.grid))
      .sort((a,b)=>b.note.sourceStrength-a.note.sourceStrength);
    const chosen=spreadPick(candidates.map(c=>c.index),accentMax,8);
    for(const index of chosen){
      const note=notes[index];
      const width=Math.max(1,Math.min(10,P.accentWidth));
      const center=(note.subLane+note.subLaneWidth/2);
      note.subLane=Math.max(0,Math.min(10-width,Math.round(center-width/2)));
      note.subLaneWidth=width;
      note.lane=Math.floor(note.subLane/2);
      note.sectionAccent=true;
    }
  }

  // --- 7. FLICK（切れる音・フレーズの終わり） ---
  // 本物の譜面は、歌の切れ目やしゃくりにフリックを置く。
  // ここでは「かたまりの最後で、そのあと1拍以上あく音」を選ぶ。
  if(flickMax>0&&P.types.includes('FLICK')){
    const candidates=[];
    notes.forEach((note,index)=>{
      if(note.type!=='TAP'||note.sectionAccent)return;
      const next=notes[index+1];
      if(next&&next.grid-note.grid<BEAT)return;
      if(note.sourceCharacter==='LIGHT')return;
      candidates.push(index);
    });
    for(const index of spreadPick(candidates,flickMax,4))notes[index].type='FLICK';
  }

  // --- 8. 終点フリック（HOLD/SLIDEの終わりで弾く） ---
  // 弾いたあと指を戻す時間が要るので、終わりの前後に1拍以上の余裕があるものだけ。
  if(endFlickMax>0){
    const candidates=[];
    notes.forEach((note,index)=>{
      if(note.type!=='HOLD'&&note.type!=='SLIDE')return;
      const endGrid=note.grid+(Number(note.durationGrids)||0);
      if(notes.some(other=>other!==note&&Math.abs(other.grid-endGrid)<BEAT))return;
      candidates.push(index);
    });
    for(const index of spreadPick(candidates,endFlickMax,3))notes[index].endFlick=true;
  }

  // --- 9. 同時押し ---
  // 同時押しそのものは難しくない。指は2本あるので、離れた2か所を同時に押すのは
  // 1か所を押すのとほとんど変わらない。難しさは**置き方**で決まる。
  // だからEASYから出し、下の難易度ほど置き方を易しくする。
  //   ・拍の頭にだけ置く（onBeat）
  //   ・前後を空ける（clearGrids）… 直前直後に別のノーツが無い場所を選ぶ
  //   ・左右を大きく離す（minGapLanes）… 触る場所どうしの距離
//   ・いちばん易しい形は「左端と右端」（edge）。EASY・NORMALはこの形だけを作る
  //   ・太いノーツで作る（minWidth）… 細いノーツの同時押しは狙いが要る
  //   ・数を少なく、間隔をあけて置く（perMinute / spacingGrids）
  // 押さえっぱなしの最中には作らない（指が3本要る形になるため）。
  let chordCount=0;
  const CHORD=P.chord;
  if(CHORD&&chordMax>0){
    const sustainSpans=notes.filter(note=>note.type==='HOLD'||note.type==='SLIDE')
      .map(note=>({startGrid:note.grid,endGrid:note.grid+(Number(note.durationGrids)||0)}));
    const gridCount=new Map();
    for(const note of notes)gridCount.set(note.grid,(gridCount.get(note.grid)||0)+1);
    // 「指がふさがっている時刻」は、ほかのノーツが**始まる**ところだけではない。
    // HOLD・SLIDEが**終わる**ところも、その指が離れて戻ってくるまで使えない。
    // (2026-09-05・全尺の Stay With Me HARD で、SLIDEが終わった88ms後に同時押しが来て
    //  どこへ動かしても直せない「押せない」が1件残った。開始しか見ていなかったのが原因)
    const nearestOther=note=>{
      let best=Infinity;
      const consider=grid=>{
        const distance=Math.abs(grid-note.grid);
        if(distance>0&&distance<best)best=distance;
      };
      for(const other of notes){
        if(other===note)continue;
        consider(other.grid);
        const duration=Number(other.durationGrids)||0;
        if((other.type==='HOLD'||other.type==='SLIDE')&&duration>0)consider(other.grid+duration);
      }
      return best;
    };
    // 同時押しは指を2本とも使う。だから直前・直後に別のノーツがあると、
    // どちらかの指を叩き直すしかなく、restrikeLimitMs より短い間隔では物理的に押せない。
    // （置き場所をどう動かしても直らないので、置く前にここで外す）
    const restrikeGrids=HAND_MODEL.restrikeLimitMs/gridMs;
    const candidates=notes
      .map((note,index)=>({note,index}))
      .filter(({note})=>note.type==='TAP'&&!note.sectionAccent
        &&note.subLaneWidth>=CHORD.minWidth&&note.subLaneWidth<=4
        &&(!CHORD.onBeat||note.grid%BEAT===0)
        &&(gridCount.get(note.grid)||0)===1
        &&nearestOther(note)>=CHORD.clearGrids
        &&nearestOther(note)>=restrikeGrids
        &&!sustainSpans.some(span=>span.startGrid<note.grid&&note.grid<=span.endGrid))
      .map(entry=>entry.index);
    // 選んだ場所が「置いてみたら条件に合わなかった」ときは、そのぶんを取り戻す。
    // (2026-09-06) ここは元は spreadPick で狙いの数ちょうどを選び、
    // 置けなかったぶんはそのまま欠けていた。譜面が濃くなると欠ける数が増え、
    // 「HARDのほうがNORMALより同時押しが少ない」という逆転が実際に起きた。
    // 置ける場所はまだ残っているので、狙いの数に届くまで選び直す。
    // 同時押しは「決めの一発」なので、盛り上がっている小節を優先する(静かな区切りには置きにくくする)。
    // 置ける場所が足りないときだけ、静かな小節も使う。
    const intense=candidates.filter(index=>intensityPosition(Math.floor(notes[index].grid/BAR))>=.4);
    const preferred=intense.length>=chordMax*1.5?new Set(intense):null;
    const tried=new Set();
    const nextBatch=()=>{
      const rest=candidates.filter(index=>!tried.has(index)&&(!preferred||preferred.has(index)||tried.size>=intense.length));
      if(!rest.length)return [];
      const picked=spreadPick(rest,chordMax-chordCount,CHORD.spacingGrids);
      for(const index of picked)tried.add(index);
      return picked;
    };
    const queue=[];
    for(let round=0;round<8&&chordCount<chordMax;round++){
      const batch=nextBatch();
      if(!batch.length)break;
      queue.length=0;queue.push(...batch);
    for(const index of queue){
      if(chordCount>=chordMax)break;
      const note=notes[index];
      // 相方の幅。細いノーツの同時押しは狙いが要るので、難易度ごとの下限を守る。
      const width=Math.max(CHORD.minWidth,Math.min(3,note.subLaneWidth));
      const baseWidth=CHORD.edge?width:Math.max(CHORD.minWidth,Math.min(4,note.subLaneWidth));
      // レーンは5つ（サブレーン10）しかない。2つ置いたときに空けられる最大の隙間はここまで。
      const room=10-baseWidth-width;
      const need=Math.round(CHORD.minGapLanes*2);
      if(room<need)continue;
      // EASY・NORMALは目いっぱい離す（左端と右端）。上位はその難易度の最低限だけ離す。
      const gapSub=CHORD.edge?room:need;
      // 元のノーツも動かす。同時押しは決めの一発なので位置を動かしてよく、
      // 真ん中に置いたままでは5レーンの中で十分に離せない。動きの少ないほうを選ぶ。
      const leftBase=Math.max(0,Math.min(10-width-gapSub-baseWidth,note.subLane));
      const rightBase=Math.max(gapSub+width,Math.min(10-baseWidth,note.subLane));
      const plans=[
        {base:leftBase,partner:leftBase+baseWidth+gapSub,move:Math.abs(leftBase-note.subLane)},
        {base:rightBase,partner:rightBase-gapSub-width,move:Math.abs(rightBase-note.subLane)},
      ].filter(plan=>plan.partner>=0&&plan.partner<=10-width)
       .sort((a,b)=>a.move-b.move);
      if(!plans.length)continue;
      const plan=plans[0];
      const base={subLane:plan.base,subLaneWidth:baseWidth};
      // 同時押しのために動かした結果、前後のノーツとの跳びがその難易度の上限を
      // 超えてはいけない（1拍未満で並ぶノーツだけを見る。1拍あけば跳びではない）。
      const stepOk=candidate=>notes.every(other=>{
        if(other===note)return true;
        if(other.grid===note.grid)return true;
        if(Math.abs(other.grid-note.grid)>=BEAT)return true;
        return separationRange(usableTouchSpan(candidate),usableTouchSpan(other)).min<=stepLimitLanes(other.grid-note.grid)+1e-9;
      });
      if(!stepOk(base)||!stepOk({subLane:plan.partner,subLaneWidth:width}))continue;
      const partner={type:'TAP',grid:note.grid,lane:Math.floor(plan.partner/2),
        subLane:plan.partner,subLaneWidth:width,
        sourceStrength:note.sourceStrength,sourcePeakOffsetMs:note.sourcePeakOffsetMs,
        sourceCharacter:note.sourceCharacter,chord:true};
      if(separationRange(noteTouchSpan(partner),noteTouchSpan(base)).min<CHORD.minGapLanes)continue;
      if(!fingerPairFeasible(partner,base,1).ok)continue;
      note.subLane=plan.base;note.subLaneWidth=baseWidth;note.lane=Math.floor(plan.base/2);
      notes.push(partner);
      chordCount++;
    }
    }
    notice.push(`同時押し ${chordCount}組（狙い${chordMax}組・置ける場所${candidates.length}箇所）`);
    notes.sort((a,b)=>a.grid-b.grid);
  }

  // --- 10. 同時押しの連なり（右左くねくね） ---
  // 単発の同時押しは「決めの一発」だが、それだけだと同時押しがいつも点で終わる。
  // 等間隔に並んだ単押しをまとめて同時押しの列に変え、**ペアごと**動かすと
  // 「右・左・右」と振られる見せ場になる。
  //
  // 【なぜEXPERT以上なのか】
  // 5レーン（サブレーン10）しかないので、EASY〜HARDの同時押しの条件
  // （太いノーツ・大きく離す）を満たすと、2つで場所を使い切って**動かす余地が残らない**。
  //   EASY/NORMAL: 幅3+幅3+間隔4 = 10（余り0）  HARD: 幅3+幅3+間隔3 = 9（余り1＝0.5レーン）
  // 動けないものを「連なり」と呼んでも意味が無いので、下の難易度には置かない。
  // EXPERT/MASTER は幅2で作れるため、余り4サブレーン＝2レーンぶん振れる。
  let chordRunCount=0,chordRunNoteCount=0;
  const RUN=P.chordRun;
  if(RUN&&RUN.perMinute>0){
    const runMax=countOf(RUN.perMinute);
    const width=RUN.width;
    // 2つのあいだに空けるサブレーン数。その難易度の「最低限離す」を満たす最小値を使い、
    // 残りぜんぶを動ける幅（room）に回す。
    const spanOf=sub=>usableTouchSpan({subLane:sub,subLaneWidth:width});
    // 見た目にも1レーンは空ける（サブレーン2つ）。数字のうえで指が入っても、
    // ぴったり隣り合っていると「同時押し」に見えないため。
    let gapSub=null;
    for(let g=2;g<=10-2*width;g++){
      if(separationRange(spanOf(0),spanOf(width+g)).min+1e-9>=P.chord.minGapLanes){gapSub=g;break;}
    }
    if(gapSub!=null){
      const room=10-2*width-gapSub;
      const sustainSpans=notes.filter(note=>note.type==='HOLD'||note.type==='SLIDE')
        .map(note=>({startGrid:note.grid,endGrid:note.grid+(Number(note.durationGrids)||0)}));
      const gridCount=new Map();
      for(const note of notes)gridCount.set(note.grid,(gridCount.get(note.grid)||0)+1);
      const usable=note=>note.type==='TAP'&&!note.chord&&!note.sectionAccent&&!note.monsterSlot
        &&(gridCount.get(note.grid)||0)===1
        &&!sustainSpans.some(span=>span.startGrid<note.grid&&note.grid<=span.endGrid);
      // 等間隔に並んだ単押しの並びを探す（間隔がそろっていないと「列」に見えない）
      const ordered=notes.slice().sort((a,b)=>a.grid-b.grid);
      const chains=[];
      for(let i=0;i<ordered.length;i++){
        if(!usable(ordered[i]))continue;
        for(let j=i+1;j<ordered.length&&j-i<RUN.maxLength;j++){
          if(!usable(ordered[j]))break;
          const step=ordered[i+1].grid-ordered[i].grid;
          if(ordered[j].grid-ordered[j-1].grid!==step)break;
          if(step*gridMs<RUN.minStepMs)break;
          if(step>BEAT*2)break;
          if(j-i>=2)chains.push({start:i,length:j-i+1,step});
        }
      }
      // 長いものを優先し、曲全体へ散らす
      chains.sort((a,b)=>b.length-a.length||a.start-b.start);
      const taken=[];
      // 形。amp は「ペアが動ける幅（サブレーン）」で、大きいほど大きく振れる。
      //   swing    … 左のはし ↔ 右のはし を行き来する（右左くねくね）
      //   parallel … ペアごと、はしからはしへ流れる
      //   open     … 2つの間隔を広げていく（内から外へ開く）
      const shapeAt=(shape,index,length,amp)=>{
        const last=Math.max(1,length-1);
        const slack=room-amp;
        if(shape==='swing')return {offset:Math.round(slack/2)+(index%2===0?0:amp),gap:gapSub};
        if(shape==='open'){
          const grow=Math.round(amp*index/last);
          return {offset:Math.round((room-grow)/2),gap:gapSub+grow};
        }
        return {offset:Math.round(slack/2)+Math.round(amp*index/last),gap:gapSub};
      };
      for(const chain of chains){
        if(chordRunCount>=runMax)break;
        const members=[];
        for(let k=0;k<chain.length;k++)members.push(ordered[chain.start+k]);
        if(members.some(note=>taken.some(other=>Math.abs(other.grid-note.grid)<RUN.spacingGrids)))continue;
        if(members.some(note=>note.chord||note.chordRun))continue;
        const shape=RUN.shapes[chordRunCount%RUN.shapes.length];
        const stepMs=chain.step*gridMs;
        // 振り幅は大きいほど見せ場になるが、そのぶん指が速く動く。
        // いちばん大きいところから1サブレーンずつ落として、最初に条件を満たしたものを採る。
        let plan=null;
        for(let amp=room;amp>=2;amp--){
          const draft=members.map((note,index)=>{
            const {offset,gap}=shapeAt(shape,index,chain.length,amp);
            return {note,left:offset,right:offset+width+gap};
          });
          if(draft.some(entry=>entry.left<0||entry.right+width>10))continue;
          // 指の移動速度（ペアごと動くので、左右それぞれの移動を見る）
          const tooFast=draft.some((entry,index)=>{
            if(index===0)return false;
            const before=draft[index-1];
            const move=Math.max(Math.abs(entry.left-before.left),Math.abs(entry.right-before.right))/2;
            return move/(stepMs/1000)>RUN.maxLaneSpeed+1e-9;
          });
          if(tooFast)continue;
          // 隣り合う同時押しのあいだで、指が動く距離がその難易度の上限を超えないか
          const laneStepOk=draft.every((entry,index)=>{
            if(index===0)return true;
            const before=draft[index-1];
            return separationRange(spanOf(before.right),spanOf(entry.left)).min<=stepLimitLanes(chain.step)+1e-9;
          });
          if(!laneStepOk)continue;
          // 列の外側（直前・直後のノーツ）ともつながるか
          const outsideOk=[[chain.start-1,draft[0].left,0],
            [chain.start+chain.length,draft[draft.length-1].right,chain.length-1]]
            .every(([index,sub,memberIndex])=>{
              const other=ordered[index];
              if(!other)return true;
              const delta=Math.abs(other.grid-members[memberIndex].grid);
              if(delta===0||delta>=BEAT)return true;
              return separationRange(spanOf(sub),usableTouchSpan(other)).min<=stepLimitLanes(delta)+1e-9;
            });
          if(!outsideOk)continue;
          // 同時押しは指を2本とも使うので、その前後に別のノーツがあると押せない。
          // 列の中の隣どうしは minStepMs（restrikeLimitMs より長い）で並ぶので、
          // 見るのは「列に入っていないノーツ」だけ。
          const inPlan=new Set(members);
          const restrikeGrids=HAND_MODEL.restrikeLimitMs/gridMs;
          const clearOk=members.every(member=>!ordered.some(other=>
            !inPlan.has(other)&&other.grid!==member.grid
            &&Math.abs(other.grid-member.grid)<restrikeGrids));
          if(!clearOk)continue;
          plan=draft;break;
        }
        if(!plan)continue;
        for(const entry of plan){
          const note=entry.note;
          note.subLane=entry.left;note.subLaneWidth=width;note.lane=Math.floor(entry.left/2);
          note.chordRun=shape;
          notes.push({type:'TAP',grid:note.grid,lane:Math.floor(entry.right/2),
            subLane:entry.right,subLaneWidth:width,
            sourceStrength:note.sourceStrength,sourcePeakOffsetMs:note.sourcePeakOffsetMs,
            sourceCharacter:note.sourceCharacter,chord:true,chordRun:shape});
          taken.push(note);
          chordRunNoteCount++;
        }
        chordRunCount++;
      }
      notice.push(`同時押しの連なり ${chordRunCount}本（狙い${runMax}本・${chordRunNoteCount}組）`);
      notes.sort((a,b)=>a.grid-b.grid);
    }
  }

  // --- 11. 端から端まで動くSLIDE（スイープ） ---
  // これまでSLIDEの移動幅は「その難易度の歩幅ぶん」に抑えていたので、実測で最大2.5レーン。
  // 5レーンの端から端まで走る大きな一本が一度も出ず、SLIDEがどれも同じ大きさに見えていた。
  //
  // ここでは経路を作り直すのではなく、**すでに音の高さから作った経路をそのまま引き伸ばす**。
  // 引き伸ばしは向きを変えない写像なので、「SLIDEの向きが音の高さと合っている」という
  // 約束は保たれたまま、移動幅だけが大きくなる。
  // 難易度の精査は「指がレーンを横切る速さ」で行う（maxLaneSpeed）。
  let sweepCount=0;
  const SWEEP=P.sweep;
  if(SWEEP&&SWEEP.perMinute>0){
    const sweepMax=countOf(SWEEP.perMinute);
    const ordered=notes.slice().sort((a,b)=>a.grid-b.grid);
    const clearGrids=Math.round(SWEEP.clearBeats*BEAT);
    const candidates=[];
    notes.forEach((note,index)=>{
      if(note.type!=='SLIDE'||!Array.isArray(note.slidePoints)||note.slidePoints.length<2)return;
      const duration=Number(note.durationGrids)||0;
      if(duration<SWEEP.minGrids)return;
      const lanes=note.slidePoints.map(point=>Number(point.lane));
      if(Math.max(...lanes)-Math.min(...lanes)<.5)return;   // 動いていない経路は伸ばしても意味が無い
      if(note.endFlick===true)return;                       // 終点で弾くものは、端で弾かせない
      // 前後に指を運ぶ余裕があるものだけ（端まで走ったあと、すぐ次を叩けない）
      const before=ordered.filter(other=>other.grid<note.grid).pop();
      const after=ordered.find(other=>other.grid>note.grid+duration);
      if(before&&note.grid-before.grid<clearGrids)return;
      if(after&&after.grid-(note.grid+duration)<clearGrids)return;
      candidates.push(index);
    });
    for(const index of spreadPick(candidates,sweepMax,BEAT*8)){
      const note=notes[index];
      const path=sweepPathFor(note,SWEEP,Number(note.subLaneWidth)||2);
      if(!path)continue;
      const lanes=path.map(point=>point.lane);
      // 引き伸ばした始点・終点が、直前・直後のノーツから指の限界の速さで届くこと。
      // 前後の空き(clearBeats)は時間の条件でしかなく、207BPMの曲では半拍が145msしか無い。
      // 端まで走る始点が4レーン先にあると、同じ指では217msでも届かない(実測で自動修正でも直らなかった)
      const before=ordered.filter(other=>other.grid<note.grid).pop();
      const after=ordered.find(other=>other.grid>note.grid+(Number(note.durationGrids)||0));
      const reachable=(other,lane,gapGrids)=>!other||Math.abs(noteTouchLane(other)-lane)<=HAND_MODEL.laneSpeedLimit*(gapGrids*gridMs/1000)*.9;
      if(!reachable(before,lanes[0],before?note.grid-before.grid:0))continue;
      if(!reachable(after,lanes[lanes.length-1],after?after.grid-(note.grid+(Number(note.durationGrids)||0)):0))continue;
      note.slidePoints=path;
      note.lane=path[0].lane;
      note.endLane=path[path.length-1].lane;
      note.sweep=true;
      note.sweepSpanLanes=Math.round((Math.max(...lanes)-Math.min(...lanes))*10)/10;
      sweepCount++;
    }
    notice.push(`端から端まで動くSLIDE ${sweepCount}本（狙い${sweepMax}本・置ける場所${candidates.length}箇所）`);
  }

  // --- 12. HOLDの途中で太さが変わる形 ---
  if(P.types.includes('HOLD')){
    const shapes=[
      {id:'open', at:t=>t},
      {id:'close',at:t=>1-t},
      {id:'swell',at:t=>1-Math.abs(1-2*t)},
      {id:'pinch',at:t=>Math.abs(1-2*t)},
      {id:'pulse',at:t=>(1-Math.cos(t*Math.PI*4))/2},
    ];
    const widthsAsc=[...P.widths].sort((a,b)=>a-b);
    const candidates=notes.map((note,index)=>({note,index}))
      .filter(({note})=>note.type==='HOLD'&&Number(note.durationGrids)>=6).map(c=>c.index);
    spreadPick(candidates,Math.max(2,Math.round(holdMax/3)),2).forEach((index,ordinal)=>{
      const note=notes[index];
      const duration=Number(note.durationGrids);
      const shape=shapes[ordinal%shapes.length];
      const count=Math.max(3,Math.min(9,Math.round(duration/BEAT)+1));
      const center=note.subLane+note.subLaneWidth/2;
      const points=[];
      const seen=new Set();
      for(let i=0;i<count;i++){
        const t=i/(count-1);
        const grid=note.grid+Math.round(duration*t);
        if(seen.has(grid))continue;
        seen.add(grid);
        const width=widthsAsc[Math.max(0,Math.min(widthsAsc.length-1,
          Math.round(shape.at(t)*(widthsAsc.length-1))))];
        points.push({grid,subLane:Math.max(0,Math.min(10-width,Math.round(center-width/2))),subLaneWidth:width});
      }
      if(points.length<2)return;
      points[points.length-1].grid=note.grid+duration;
      if(new Set(points.map(p=>p.subLaneWidth)).size<2)return;
      note.subLaneWidth=points[0].subLaneWidth;
      note.subLane=points[0].subLane;
      note.lane=Math.floor(note.subLane/2);
      note.holdPoints=points;
      note.holdTaper=shape.id;
    });
  }

  // --- 13. モンスターノーツ（曲の20/40/60/80%あたりへ1体ずつ） ---
  const monsterSlotGrids=[];
  {
    const first=notes[0].grid,last=notes[notes.length-1].grid;
    const used=new Set();
    COMMON.monsterTargets.forEach((ratio,slot)=>{
      const target=first+(last-first)*ratio;
      let bestIndex=-1,bestDistance=Infinity;
      notes.forEach((note,index)=>{
        if(note.type!=='TAP'||used.has(index)||note.chord)return;
        if(note.grid%BEAT!==0)return;
        const before=index>0?note.grid-notes[index-1].grid:Infinity;
        const after=index<notes.length-1?notes[index+1].grid-note.grid:Infinity;
        if(before<COMMON.monsterClearGrids||after<COMMON.monsterClearGrids)return;
        const distance=Math.abs(note.grid-target);
        if(distance<bestDistance){bestDistance=distance;bestIndex=index;}
      });
      if(bestIndex>=0){notes[bestIndex].monsterSlot=slot+1;used.add(bestIndex);monsterSlotGrids.push(notes[bestIndex].grid);}
    });
  }

  // --- 14. 指の条件の最終確認 ---
  // アクセント幅・同時押し・同時押しの連なり・太さの変わるHOLDは、レーンを決めたあとに中心を動かす。
  // 最後にもう一度全部を見て、「指が2本入らない近さなのに速すぎる」組み合わせが
  // 残っていたら、動かせるノーツ（TAP/FLICK）を左右へ寄せて直す。
  {
    const ordered=notes.slice().sort((a,b)=>a.grid-b.grid);
    const conflicts=(note,candidate)=>{
      for(const other of ordered){
        if(other===note)continue;
        const deltaMs=(note.grid-other.grid)*gridMs;
        if(Math.abs(deltaMs)>=HAND_MODEL.restrikeLimitMs)continue;
        if(deltaMs===0)continue;
        if(!fingerPairFeasible(candidate,other,Math.abs(deltaMs)).ok)return true;
      }
      return false;
    };
    for(const note of ordered){
      if(note.type!=='TAP'&&note.type!=='FLICK')continue;
      if(!conflicts(note,note))continue;
      const width=Number(note.subLaneWidth)||2;
      let bestSub=null,bestDistance=Infinity;
      for(let sub=0;sub<=10-width;sub++){
        if(conflicts(note,{subLane:sub,subLaneWidth:width}))continue;
        const distance=Math.abs(sub-Number(note.subLane));
        if(distance<bestDistance){bestDistance=distance;bestSub=sub;}
      }
      if(bestSub===null)continue;
      note.subLane=bestSub;
      note.lane=Math.floor(bestSub/2);
    }
  }

  // --- 15. 指を交差させる置き方（クロス） ---
  // 押さえっぱなしのHOLDより**さらに外側**を叩かせると、空いているほうの指が
  // 押さえている指を越えて取りに行くことになる。これが「指をクロスする配置」。
  //
  // 【なぜ押さえっぱなしと組にするのか】
  // ただの単押しの並びでは、どちらの指でどこを取るかは遊ぶ人の自由なので、
  // 譜面の側から交差を強いることはできない。片方の指が1か所に固定されて初めて
  // 「もう1本が、その外側まで行くしかない」という形が作れる。
  //
  // 【難易度】EXPERTで少し、MASTERで中心に。HARD以下には置かない
  // （HARD以下は tapDuringHold が無く、押さえながら別を叩く形そのものを使わないため）。
  // 動かすのはレーンだけで、音の位置（grid）は動かさない。
  let crossCount=0;
  if(P.crossPerMinute>0&&P.tapDuringHold){
    const crossMax=countOf(P.crossPerMinute);
    // 経路が動くSLIDEは、その瞬間に指がどこにあるかが変わるので相手にしない。
    // 押さえた場所が動かないHOLDだけを使う。
    const holds=notes.filter(note=>note.type==='HOLD');
    const gridCount=new Map();
    for(const note of notes)gridCount.set(note.grid,(gridCount.get(note.grid)||0)+1);
    const ordered=notes.slice().sort((a,b)=>a.grid-b.grid);
    const conflictsWith=(note,candidate)=>ordered.some(other=>{
      if(other===note)return false;
      const deltaMs=(note.grid-other.grid)*gridMs;
      if(deltaMs===0)return false;
      if(Math.abs(deltaMs)>=HAND_MODEL.restrikeLimitMs)return false;
      return !fingerPairFeasible(candidate,other,Math.abs(deltaMs)).ok;
    });
    const stepOkWith=(note,candidate)=>ordered.every(other=>{
      if(other===note||other.grid===note.grid)return true;
      if(Math.abs(other.grid-note.grid)>=BEAT)return true;
      return separationRange(usableTouchSpan(candidate),usableTouchSpan(other)).min<=stepLimitLanes(other.grid-note.grid)+1e-9;
    });
    const candidates=[];
    notes.forEach((note,index)=>{
      if(note.type!=='TAP'||note.chord||note.chordRun||note.sectionAccent||note.monsterSlot)return;
      if((gridCount.get(note.grid)||0)!==1)return;
      const covering=holds.filter(hold=>hold.grid<note.grid
        &&note.grid<=hold.grid+(Number(hold.durationGrids)||0));
      if(covering.length!==1)return;
      candidates.push({index,hold:covering[0]});
    });
    // 置ける場所は狭い(押さえている指の外側で、前後から届く範囲)ので、狙いの数だけ選んで
    // 置けなければ終わり、ではなく、曲全体へ散らした候補を順に試して狙いの数まで置く
    for(const pick of spreadPick(candidates.map(entry=>entry.index),candidates.length,BEAT*4)){
      if(crossCount>=crossMax)break;
      const entry=candidates.find(item=>item.index===pick);
      if(!entry)continue;
      const note=notes[pick];
      const hold=entry.hold;
      const holdCenter=noteTouchLane(hold);
      // 押さえている指が画面の左寄りなら、その**さらに左**を叩かせる（右の指が越える）。
      const toLeft=holdCenter<=(LANES-1)/2;
      // 押さえているノーツの外側は狭い。太いままでは入らないので、
      // その難易度で使える細さまで落としてよい（交差は狙って取る一発なので、細いほうが理にかなう）。
      const widthOptions=[...new Set([Number(note.subLaneWidth)||2,...P.widths])]
        .filter(value=>value<=(Number(note.subLaneWidth)||2)).sort((a,b)=>b-a);
      let placed=null;
      for(const width of widthOptions){
        const order=[];
        if(toLeft)for(let sub=0;sub<=10-width;sub++)order.push(sub);
        else for(let sub=10-width;sub>=0;sub--)order.push(sub);
        for(const sub of order){
          const candidate={subLane:sub,subLaneWidth:width};
          // 押さえている指より外側にあること（内側では交差にならない）
          const center=noteTouchLane(candidate);
          if(toLeft?center>=holdCenter:center<=holdCenter)continue;
          // 指が2本入る離れかたであること
          if(separationRange(usableTouchSpan(candidate),usableTouchSpan(hold)).min
            <HAND_MODEL.fingerMinGapLanes-1e-9)continue;
          if(conflictsWith(note,candidate))continue;
          if(!stepOkWith(note,candidate))continue;
          placed={sub,width};break;
        }
        if(placed)break;
      }
      if(!placed)continue;
      note.subLane=placed.sub;
      note.subLaneWidth=placed.width;
      note.lane=Math.floor(placed.sub/2);
      note.cross=true;
      crossCount++;
    }
    notice.push(`指を交差させる置き方 ${crossCount}箇所（狙い${crossMax}箇所・置ける場所${candidates.length}箇所）`);
  }

  // --- 15.5 / 15.6 のための共通の道具 ---
  // 「押さえノーツの横へもう1本置けるか」を測る道具は、同時押さえ(15.5)と
  // 同時スライド(15.6)で同じものを使う。片方だけ直して食い違うのを防ぐため、
  // ここへ1つ出しておく。
  const heldNotesNow=()=>notes.filter(note=>note.type==='HOLD'||note.type==='SLIDE');
  const heldSpanOf=note=>({start:note.grid,end:note.grid+(Number(note.durationGrids)||0)});
  const heldPathOf=note=>{
    if(note.type==='SLIDE'&&Array.isArray(note.slidePoints)&&note.slidePoints.length>=2){
      const lanes=note.slidePoints.map(point=>Number(point.lane));
      return {from:lanes[0],to:lanes[lanes.length-1]};
    }
    const lane=noteTouchLane(note);
    return {from:lane,to:lane};
  };
  // そのグリッドで、そのノーツを押さえている指が居るレーン。
  // SLIDEは中継点(slidePoints)で折れるので、端どうしを直線で結んで済ませない
  // （折れた経路を直線で見ると、途中で相方とぶつかる形を見逃す）。
  const heldLaneAt=(note,grid)=>{
    const duration=Number(note.durationGrids)||0;
    if(note.type!=='SLIDE'||duration<=0)return noteTouchLane(note);
    const points=Array.isArray(note.slidePoints)&&note.slidePoints.length>=2?note.slidePoints:null;
    if(!points){
      const from=Number(note.lane),to=Number(note.endLane??note.lane);
      const t=Math.max(0,Math.min(1,(grid-note.grid)/duration));
      return from+(to-from)*t;
    }
    if(grid<=Number(points[0].grid))return Number(points[0].lane);
    for(let i=1;i<points.length;i++){
      const a=points[i-1],b=points[i];
      const ag=Number(a.grid),bg=Number(b.grid);
      if(grid<=bg){
        const t=bg>ag?(grid-ag)/(bg-ag):0;
        return Number(a.lane)+(Number(b.lane)-Number(a.lane))*t;
      }
    }
    return Number(points[points.length-1].lane);
  };
  // 物差しは本家(rhythm-runtime-notes.js の overlapConflicts)とそろえる。
  // 「帯の中心どうしの距離」ではなく **2本の指をいちばん離して置いたときの距離**。
  // 押さえている指は帯の中心から動かせない(SLIDEは経路に沿う)ので、
  // 幅ぶんの半分だけ外へ置ける。
  const heldSeparationAt=(ownLane,otherLane,otherIsSlide,otherWidthLanes)=>{
    const otherShift=otherIsSlide?0:Math.min(otherWidthLanes/4,HAND_MODEL.holdShiftLanes);
    return Math.max(ownLane-(otherLane-otherShift),(otherLane+otherShift)-ownLane);
  };
  // 2本目を lanes の経路で ownStart〜ownEnd のあいだ置いたときの、
  // 同じ時間に重なっている押さえノーツすべてとの**いちばん近い**指の間隔。
  // ★相方だけを見てはいけない。相方しか見ていなかったため、別のHOLDと間隔0.00レーンになる
  //   組を通してしまった(2026-09-12・MASTERの converge で実際に起きた)。
  // ★端だけでなく重なっているあいだを刻んで見る。途中で交差する形を通さないため。
  const heldPairNearestGap=(lanes,ownStart,ownEnd)=>{
    const ownLaneAt=grid=>{
      const t=ownEnd>ownStart?Math.max(0,Math.min(1,(grid-ownStart)/(ownEnd-ownStart))):0;
      return lanes.from+(lanes.to-lanes.from)*t;
    };
    let nearest=Infinity;
    for(const other of heldNotesNow()){
      const otherSpan=heldSpanOf(other);
      const from=Math.max(ownStart,otherSpan.start),to=Math.min(ownEnd,otherSpan.end);
      if(to<=from)continue;
      const otherWidthLanes=(Number(other.subLaneWidth)||2)/2;
      const steps=Math.max(4,Math.min(24,to-from));
      for(let step=0;step<=steps;step++){
        const grid=from+(to-from)*(step/steps);
        nearest=Math.min(nearest,heldSeparationAt(
          ownLaneAt(grid),heldLaneAt(other,grid),other.type==='SLIDE',otherWidthLanes));
      }
    }
    return nearest;
  };
  // 「指の本数を超える瞬間のノーツを外す」だけを取り出したもの（中身は16と同じ）。
  // 同時スライド(15.6)は置いてよいか試すときに**16を通したあとの譜面**で確かめたいので、
  // 16の本体をここへ出して使い回す。二重管理にしないため16はこれを呼ぶだけにする。
  const dropOverflowFingers=list=>{
    const sustains=list.filter(note=>note.type==='HOLD'||note.type==='SLIDE').map(note=>({
      note,
      startMs:note.grid*gridMs,
      endMs:(note.grid+(Number(note.durationGrids)||0))*gridMs
        +(note.endFlick===true?HAND_MODEL.endFlickReleaseMs:0)+HAND_MODEL.releaseMarginMs,
    }));
    const byGrid=new Map();
    for(const note of list){
      if(!byGrid.has(note.grid))byGrid.set(note.grid,[]);
      byGrid.get(note.grid).push(note);
    }
    const dropped=new Set();
    const heldCountAt=grid=>sustains.filter(span=>
      span.startMs<grid*gridMs&&grid*gridMs<=span.endMs&&!dropped.has(span.note)).length;
    for(const [grid,group] of [...byGrid.entries()].sort((a,b)=>a[0]-b[0])){
      // その瞬間より前に始まって、まだ離していない伸びるノーツ
      const room=HAND_MODEL.hands-heldCountAt(grid);
      const alive=group.filter(note=>!dropped.has(note));
      if(alive.length<=room)continue;
      // 残すのは「同時押しの相方でないもの」を優先し、そこから幅の広い（＝主役の）ノーツを残す
      const ordered=alive.slice().sort((a,b)=>
        (a.chord===true?1:0)-(b.chord===true?1:0)
        ||(Number(b.subLaneWidth)||0)-(Number(a.subLaneWidth)||0));
      for(const note of ordered.slice(Math.max(0,room)))dropped.add(note);
    }
    // ② 押さえっぱなしで指が1本ふさがっているあいだの打点は、**残った1本で全部叩く**。
    //    1本の指は restrikeLimitMs より短い間隔で叩き直せないので、それより詰まっていたら押せない。
    // ★ここが抜けていた。手のモデルが「少し動くなら速く叩ける」と数えていたので
    //   （0.5レーンずれた2打を28msで押せる扱い＝毎秒36打）成立しているように見えていた。
    //   モデルを直したら、生成→自動修正のあとでも40譜面のうち13譜面が押せなくなった
    //   (2026-09-12)。押さえ中の打点はここで間隔を確かめる。
    {
      const pressGrids=[...byGrid.keys()].sort((a,b)=>a-b);
      let lastPress=-Infinity;
      for(const grid of pressGrids){
        const alive=byGrid.get(grid).filter(note=>!dropped.has(note));
        if(!alive.length)continue;
        if(heldCountAt(grid)<HAND_MODEL.hands-1){lastPress=grid;continue;}   // 指が2本空いていれば交互で取れる
        if((grid-lastPress)*gridMs+1e-6<HAND_MODEL.restrikeLimitMs){
          // 直前の打点から詰まりすぎ。残った1本では叩けないので、こちらを落とす
          for(const note of alive)dropped.add(note);
          continue;
        }
        lastPress=grid;
      }
    }
    return {kept:dropped.size?list.filter(note=>!dropped.has(note)):list,dropped:dropped.size};
  };
  // 両手のシミュレートにかけて「押せない」ところを拾う。
  // ★同時スライドを置いてよいかは、自分で作った物差し（指の間隔）では足りない。
  //   間隔だけ見て通した結果、品質レポートの「押せない」が0→2件へ増えた曲が8つ出た
  //   (2026-09-12)。出荷を止めるのはこのシミュレート(rhythm-hand-simulate.js)なので、
  //   置く前と置いたあとをかけて、増えないことを確かめてから採る。
  // ★曲の一部だけを切り出してかけてはいけない。指の割り当ては先読み(ビーム)で決まるので、
  //   前を切ると**そこまでの割り当てが変わり**、切った側だけ押せなくなることがある。
  //   前後8小節に切って「前も1件・後も1件だから増えていない」と通した結果、
  //   曲全体では0→1件に増えた(2026-09-12・pandora_boss MASTER・eiki_boss MASTER・
  //   pandora_boss_remix MASTER)。**曲全体**でかける。
  // ★件数ではなく「どこが押せないか」の集合で比べる。曲によっては元から
  //   押せない箇所があり（あとの自動修正で直る）、件数だけだと入れ替わりを見逃す。
  const impossibleKeysOf=list=>{
    const keys=new Set();
    if(!list.length)return keys;
    for(const issue of simulateNotes(list,timing).issues){
      if(issue.severity!=='impossible')continue;
      keys.add(`${issue.grid}:${issue.type}:${issue.kind}`);
    }
    return keys;
  };
  // その瞬間に、もう1本ぶんの指が空いているか（16の数え方とそろえる）。
  // ここで確かめておかないと、置いたあと16で落とされて
  // 「置いた数と譜面に残る数が食い違う」に戻る。
  const heldFreeAtStart=(grid,partner)=>{
    const sameGrid=notes.filter(note=>note.grid===grid);
    if(sameGrid.some(note=>note!==partner))return false;
    return !notes.some(note=>{
      if(note===partner)return false;
      if(note.type!=='HOLD'&&note.type!=='SLIDE')return false;
      const span=heldSpanOf(note);
      return span.start<grid&&grid<=span.end;
    });
  };
  // 同時押さえ(15.5)の2本目を組み立てる。
  //
  // ★HOLDとSLIDEで**座標の単位が違う**。HOLDはサブレーン(0〜9)で位置が決まり、
  //   SLIDEは lane が経路の中心線。ランタイムへ書く h(...) が読むのは subLane なので、
  //   レーン単位の値を lane へ入れただけでは subLane が無いまま出てしまう。
  //   実際に h(…,undefined,…) と [時刻,レーン,undefined] を公開してしまった
  //   （2026-09-13・作り直した15曲でHOLD20件・SLIDEの中継点46点）。
  // ★確かめる用と譜面へ入れる用で2回書いていたのが原因なので、ここへ1つにまとめる。
  // ★HOLDは整数のサブレーンへ載るため、丸めで中心が最大0.5レーン動く。
  //   動いたあとの中心を返して、指の間隔はその値で測り直す。
  const buildHeldPairNote=(lanes,startGrid,endGrid,extra)=>{
    const width=2,durationGrids=endGrid-startGrid;
    if(lanes.from!==lanes.to){
      return {lanes,note:{type:'SLIDE',grid:startGrid,durationGrids,
        lane:lanes.from,endLane:lanes.to,subLaneWidth:width,
        slidePoints:[{grid:startGrid,lane:lanes.from,subLaneWidth:width},
          {grid:endGrid,lane:lanes.to,subLaneWidth:width}],...extra}};
    }
    const subLane=Math.max(0,Math.min(10-width,Math.round(lanes.from*2-width/2)));
    const center=subLane/2+width/4;
    return {lanes:{from:center,to:center},
      note:{type:'HOLD',grid:startGrid,durationGrids,
        lane:Math.floor(subLane/2),subLane,subLaneWidth:width,...extra}};
  };

  // --- 15.5 同時押さえ（HOLD/SLIDEを2本いちどに押さえる） ---
  //
  // 【2026-09-12・ユーザー指示】
  // 「スライドとかホールドの同時系もなかったっけ？」
  // 「ノーツの置き方は曲のタイプや難易度でそれに見合った形に置くようにするようにして /
  //   決めごとがあるとつまんなくなる / バリエーションが大事」
  //
  // 2本目の素は**ベースの伸びる区間**（解析の bassSustains）。実際に鳴っている音なので
  // 幽霊ノーツ（§2.1）にならない。旋律の押さえノーツと重なっているところへ足す。
  //
  // 置き方は1つに決めない。語彙（HELD_PAIR_SHAPES）から、
  // **その場の2本の動き量と難易度**で点数を付けて選ぶ。使った形にはペナルティが付き、
  // 直前と同じ形は出ない。同点は種で崩すので、曲ごとに並びが変わる。
  //
  // このパスは「指の本数を超える瞬間を作らない」(16)より**前**に置く。
  // 2本押さえているあいだのTAPは、そこが指の数で数えて落としてくれる。
  let heldPairPlaced=0,heldPairReport=null;
  const heldPairShapeUsage=new Map();
  const HELD_PAIR=P.heldPair;
  if(HELD_PAIR&&HELD_PAIR.perMinute>0&&Array.isArray(audio.bassSustains)&&audio.bassSustains.length){
    const heldPairMaxLate=countOf(HELD_PAIR.perMinute);
    const room=LANES-1;
    const gapLanes=Math.max(1,Math.ceil(HELD_PAIR.minGapLanes));
    const candidates=[];
    for(const span of audio.bassSustains){
      if(!(span.startGrid>=minGrid&&span.endGrid<=maxGrid))continue;
      if(span.grids<COMMON.holdMinGrids)continue;
      // ★2本目の頭は、**実際に鳴っている打点**へ寄せる。
      //   ベースの伸びの開始位置をそのまま使っていたため、そこに打点が無いと
      //   パイプラインの「鳴っていない場所へ置いたノーツ」で止まった
      //   （2026-09-13・既存15曲を作り直したら5曲がこれで止まった）。
      //   伸びる音の予約(3)が spacedGrids へ寄せているのと同じ考え方。
      const startGrid=[0,1,-1,2,-2].map(shift=>span.startGrid+shift)
        .find(grid=>grid>=minGrid&&onsetByGrid.has(grid));
      if(startGrid==null)continue;
      if(span.endGrid-startGrid<COMMON.holdMinGrids)continue;
      // 重なっている押さえノーツが**ちょうど1本**のときだけ（2本目までにする）
      const overlapping=heldNotesNow().filter(note=>{
        const s=heldSpanOf(note);
        return Math.min(span.endGrid,s.end)-Math.max(startGrid,s.start)>=HELD_PAIR.minOverlapGrids;
      });
      if(overlapping.length!==1)continue;
      candidates.push({span,partner:overlapping[0],startGrid});
    }
    let previousShapeId=null;
    // ★spreadPick は「グリッド位置」を渡す関数（minGap もグリッド）。
    //   配列の添字を渡すと、添字0と1の差が1しか無いのに minGap(=8拍ぶん)と比べられて
    //   2組目以降が全部はじかれる。実際にそうなって1組しか置けていなかった。
    const candidateByGrid=new Map();
    for(const candidate of candidates){
      if(!candidateByGrid.has(candidate.startGrid))candidateByGrid.set(candidate.startGrid,candidate);
    }
    let baseImpossible=null;   // 採用済みの譜面の「押せない」ところ。1本採るたびに測り直す
    for(const grid of spreadPick([...candidateByGrid.keys()],heldPairMaxLate,BEAT*8)){
      const {span,partner,startGrid:ownStartGrid}=candidateByGrid.get(grid);
      // すでに相方を持っている帯へ3本目を足さない（この周回で足したぶんも見る）
      if(partner._heldPairUsed)continue;
      const path=heldPathOf(partner);
      // ★生の moves をそのまま渡すと、形の目安(倍率)と桁が合わない。
      //   heldPairMoveScale で「SLIDEになる下限を1.0」へそろえてから渡す。
      const bassMove=heldPairMoveScale(span.moves);
      // 相方の動きは、譜面の上で実際に何レーン動くかで見る（音の高さではなく指の移動量）。
      // レーン差1つぶんをSLIDEの下限1.0と見なす
      const melodyMove=Math.min(3,Math.abs(path.to-path.from));
      const shapes=heldPairShapeCandidates({level:P.level,bassMove,melodyMove,
        usage:heldPairShapeUsage,previousId:previousShapeId,seed:`${trackId}:${span.startGrid}${variantSeed}`});
      let placed=null;
      for(const shape of shapes){
        const lanes=shape.place({partnerFrom:path.from,partnerTo:path.to,room,gap:gapLanes});
        // ★自分で動く形(follows:'own')が、端で潰れて動かなくなったら採らない。
        //   採ってしまうと「crossを選んだのに2本目は動かないHOLD」になり、
        //   形の名前と中身が食い違う(2026-09-12に実際そうなった)。
        if(shape.follows==='own'&&lanes.from===lanes.to)continue;
        // 並んで動く形は、相方が動いているのに自分が動かないのはおかしい
        if(shape.follows==='partner'&&path.from!==path.to&&lanes.from===lanes.to)continue;
        const ownStart=ownStartGrid,ownEnd=Math.min(span.endGrid,maxGrid);
        // ★先にノーツを組み立てる。HOLDはサブレーンへ丸めるぶん中心が動くので、
        //   間隔もシミュレートも**丸めたあとの位置**で測る（同じものを譜面へ入れる）。
        const built=buildHeldPairNote(lanes,ownStart,ownEnd);
        // 指2本が入る下限(HAND_MODEL.fingerMinGapLanes)に、難易度ごとの余裕を乗せる
        if(heldPairNearestGap(built.lanes,ownStart,ownEnd)
          <Math.max(HAND_MODEL.fingerMinGapLanes,HELD_PAIR.minGapLanes))continue;
        // ★最後に、出荷を止めるのと同じ両手のシミュレートで確かめる。
        //   この確認は15.6・15.7へは入れたのに、**この段だけ抜けていた**。
        //   ベースの解析が無くて一度も動いていなかったので気づけず、既存15曲を
        //   作り直したときに7曲が「押せない」で止まった（2026-09-13）。
        //   押さえノーツは16.5でも取り除けない（骨格として残す側）ので、ここで弾く。
        const trial=notes.concat([built.note]);
        if(baseImpossible===null)baseImpossible=impossibleKeysOf(dropOverflowFingers(notes).kept);
        const after=impossibleKeysOf(dropOverflowFingers(trial).kept);
        if([...after].some(key=>!baseImpossible.has(key)))continue;
        placed={shape,lanes,built};
        break;
      }
      if(!placed)continue;
      const {shape}=placed;
      if(placed.built.note.durationGrids<COMMON.holdMinGrids)continue;
      // ★確かめたのと同じノーツを入れる（別に書き起こすと座標の単位を取り違える）
      const note={...placed.built.note,heldPair:true,heldPairShape:shape.id};
      notes.push(note);
      partner._heldPairUsed=true;
      heldPairShapeUsage.set(shape.id,(heldPairShapeUsage.get(shape.id)||0)+1);
      previousShapeId=shape.id;
      heldPairPlaced++;
      baseImpossible=null;   // 譜面が変わったので測り直す
    }
    // ★お知らせは、ここでは出さない。この後の「指の本数を超える瞬間を作らない」(16)で
    //   落ちることがあり、置いた数と譜面に残る数が食い違う
    //   (実際に「4組」と報告して譜面には3組しか無かった)。16のあとで数え直して出す。
    heldPairReport={placed:heldPairPlaced,aim:heldPairMaxLate,candidates:candidates.length};
    notes.sort((a,b)=>a.grid-b.grid);
  }

  // --- 15.6 同時スライド（2本のSLIDEをいちどになぞる） ---
  //
  // 【2026-09-12・ユーザー指示】
  // 「同時スライドは結構重要な譜面だから入る仕組みを構築してほしい /
  //   むずかしい側にはなるとおもうけど」
  //
  // 15.5（同時押さえ）は2本目の素をベースの伸び(bassSustains)から取るので、
  // **ベースと旋律が同時に、どちらもSLIDEになるだけ動いている場所**が要る。
  // 実測ではその場所が曲ごとに0〜3箇所しか無く、SLIDE＋SLIDEの組は一度も出なかった
  // （Monster Hero 1箇所 / SIX ÉTERNEL 3箇所 / かぜがそよぐ 0箇所）。
  // 「運よく重なったら出る」では、大事な形が曲によって丸ごと欠ける。
  //
  // そこで同時スライドは**狙って置く**。素は「いま譜面にある、長くてよく動くSLIDE」で、
  // その横へ必ず動く2本目を足す。1つの音に2本置く理由づけは同時押し(9)と同じで、
  // **強い一音には2本ぶんの重さがある**。幽霊ノーツ(§2.1)にしないため、
  // 置く場所は次のどれかに当たるところだけに限る。
  //   ・ベースの伸びが重なっている（本当に2声ある。いちばん良い）
  //   ・打点が強い（sourceStrength）
  //   ・盛り上がりが高い（intensityPosition）／サビに当たる区切り（climax）
  // 形は15.5と同じ語彙から選ぶ。ただし**動かない形(follows:'none')は外す**ので、
  // 2本目は必ずSLIDEになる。左右対称(mirror)は同時スライドのために足した形。
  //
  // 難しい置き方なので EXPERT と MASTER だけ（PROFILES.doubleSlide）。
  let doubleSlideReport=null;
  const DOUBLE_SLIDE=P.doubleSlide;
  if(DOUBLE_SLIDE&&DOUBLE_SLIDE.perMinute>0&&P.types.includes('SLIDE')){
    const aim=countOf(DOUBLE_SLIDE.perMinute);
    const room=LANES-1;
    const gapLanes=Math.max(1,Math.ceil(DOUBLE_SLIDE.minGapLanes));
    const bassSpans=Array.isArray(audio.bassSustains)?audio.bassSustains:[];
    // その帯にベースの伸びが重なっているか（重なっていれば本当に2声ある）
    const bassOverlapOf=(start,end)=>{
      let best=null;
      for(const span of bassSpans){
        const overlap=Math.min(span.endGrid,end)-Math.max(span.startGrid,start);
        if(overlap<COMMON.holdMinGrids)continue;
        if(!best||overlap>best.overlap)best={span,overlap};
      }
      return best;
    };
    // 手を離してから次を押すまでに要るぶん（16の数え方とそろえる）
    const releaseGrids=Math.max(1,Math.ceil(HAND_MODEL.releaseMarginMs/gridMs));
    const candidates=[];
    for(const note of notes){
      if(note.type!=='SLIDE')continue;
      if(note.heldPair===true||note._heldPairUsed)continue;
      const span=heldSpanOf(note);
      if(span.end-span.start<DOUBLE_SLIDE.minGrids)continue;
      const path=heldPathOf(note);
      const partnerSpan=Math.abs(path.to-path.from);
      // 相方は少しでも動いていればよい（0.5レーンしか動かないSLIDEも相方になる）。
      // 「同時スライドらしさ」は2本目がしっかり動くことで作る（minOwnSpanLanes）。
      if(partnerSpan<DOUBLE_SLIDE.minPartnerSpanLanes)continue;
      // ★端から端まで動くSLIDE（sweep）は相方にできない。レーンを全部使ってしまうので
      //   2本目をどこへ置いても途中で交差する（実測: 4→0の相方に対し、どの形でも
      //   いちばん近いところで0.00〜0.50レーンしか空かなかった）。
      //   2本目ぶんの間隔が片側に残る幅までに限る。
      if(partnerSpan>room-gapLanes)continue;
      const bar=Math.floor(note.grid/BAR);
      const bass=bassOverlapOf(span.start,span.end);
      const strength=Number(note.sourceStrength)||0;
      const intensity=intensityPosition(bar);
      const climax=sectionRoleForBar(bar)==='climax';
      const source=bass?'bass'
        :strength>=DOUBLE_SLIDE.minStrength?'strength'
        :(intensity>=DOUBLE_SLIDE.minIntensity||climax)?'intensity':null;
      if(!source)continue;   // 強い場所でなければ置かない（幽霊ノーツにしない）
      // 2本目を足すと、そのあいだは指が2本ふさがる＝中の打点は16で落ちる。
      // 密なところへそのまま置くと、同時スライド1組のために打点が何個も消える
      // （実測でEXPERTのTAPが3個消えた）。上限を超えるぶんは消さず、
      // **2本目を先に離す**（頭はそろえたまま尻を切る）。同時スライドの見せ場は
      // 2本そろって始まるところなので、終わりがずれても形は保てる。
      const coveredGrids=notes.filter(other=>other!==note
        &&other.grid>span.start&&other.grid<span.end).map(other=>other.grid).sort((a,b)=>a-b);
      let ownEnd=span.end;
      if(coveredGrids.length>DOUBLE_SLIDE.maxCoveredNotes){
        ownEnd=Math.min(ownEnd,coveredGrids[DOUBLE_SLIDE.maxCoveredNotes]-releaseGrids);
      }
      if(ownEnd-span.start<DOUBLE_SLIDE.minGrids)continue;
      const covered=coveredGrids.filter(g=>g<ownEnd).length;
      candidates.push({note,path,span,ownEnd,bass,strength,intensity,source,covered});
    }
    // 良い場所（2声ある→盛り上がっている→打点が強い）から順に見る。
    // ただし同じグリッドに2つは要らないので、1グリッド1つへ絞る。
    const byGrid=new Map();
    for(const candidate of candidates.slice().sort((a,b)=>
      (b.bass?1:0)-(a.bass?1:0)||a.covered-b.covered
      ||b.intensity-a.intensity||b.strength-a.strength)){
      if(!byGrid.has(candidate.span.start))byGrid.set(candidate.span.start,candidate);
    }
    // ★spreadPick へ渡すのは「グリッド位置」（15.5で添字を渡して1組しか置けなかった）
    let placedCount=0,previousShapeId=null;
    // 採用済みの譜面の「押せない」ところ。1本採るたびに測り直す（同じ譜面では測り直さない）
    let baseImpossible=null;
    const usage=new Map();
    // ★置けなかった理由を数える。「0組（置ける場所13箇所）」だけでは、
    //   相方を取られたのか形が入らないのか押せないのかが分からず、直しようがない
    //   （2026-09-13・作り直しで2曲が0組になったとき、ここから調べ直した）。
    const skipped={partner:0,fingers:0,shape:0,speed:0,gap:0,impossible:0};
    // ★狙いの数だけ置けるまで、**次の候補へ進む**。
    //   spreadPick が返した数（＝狙いの数）だけ試して終わりにしていたので、
    //   選ばれた候補がどれも形が入らないと**1組も置けなかった**。
    //   置ける場所が15箇所あるのに0組という状態が実際に起きた
    //   （2026-09-13・既存15曲の解析をやり直して15.5が動き出したあと、
    //     eiki_boss と six_eternel_beat で同時スライドが丸ごと消えた。
    //     理由の内訳は「指2本が入らない」78件＝相方の経路と交差する形ばかり引いていた）。
    //   まず spreadPick の順で散らして試し、足りなければ良い順に残りも試す。
    //   間隔（spacingGrids）は置いたグリッドと自分で比べて守る。
    const ranked=[...byGrid.keys()];
    const firstPicks=spreadPick(ranked,aim,DOUBLE_SLIDE.spacingGrids);
    const order=[...firstPicks,...ranked.filter(grid=>!firstPicks.includes(grid))];
    const placedGrids=[];
    for(const grid of order){
      if(placedCount>=aim)break;
      if(placedGrids.some(other=>Math.abs(other-grid)<DOUBLE_SLIDE.spacingGrids))continue;
      const candidate=byGrid.get(grid);
      const partner=candidate.note;
      if(partner._heldPairUsed){skipped.partner++;continue;}
      // 16で落とされないところだけへ置く（置いた数と残る数を食い違わせない）
      if(!heldFreeAtStart(candidate.span.start,partner)){skipped.fingers++;continue;}
      // 2本目がどれだけ動くと似合うか。
      // ベースの伸びが重なっていればその実測を使い（本当に鳴っている動き）、
      // 無ければ**その場の盛り上がり**で決める。盛り上がるほど大きく動く形が前へ出る。
      const bassMove=candidate.bass
        ?Math.max(1,heldPairMoveScale(candidate.bass.span.moves))
        :Math.min(3,1+candidate.intensity*2);
      const melodyMove=Math.min(3,Math.abs(candidate.path.to-candidate.path.from));
      const shapes=heldPairShapeCandidates({level:P.level,bassMove,melodyMove,
        usage,previousId:previousShapeId,seed:`${trackId}:double:${grid}${variantSeed}`})
        .filter(shape=>shape.follows!=='none');   // 2本目も必ず動く＝同時スライドになる
      const startGrid=candidate.span.start,endGrid=candidate.ownEnd;
      // 形へ渡す「相方からどれだけ離すか」は1つに決めない。レーンは5本しか無いので、
      // 離しかたを1通りに固定すると相方が中央寄りのときどの形も入らなくなる
      // （実測: EXPERTで置ける場所が9箇所あって1組も入らなかった）。
      // 近い順に試し、**本家と同じ物差しで間隔を確かめてから**採る。
      const gapTries=[gapLanes,gapLanes+1,Math.max(1,gapLanes-1)]
        .filter((value,index,list)=>list.indexOf(value)===index);
      const minGapNeeded=Math.max(HAND_MODEL.fingerMinGapLanes,DOUBLE_SLIDE.minGapLanes);
      const spanMs=(endGrid-startGrid)*gridMs;
      let chosen=null;
      for(const shape of shapes){
        if(spanMs<=0)break;
        for(const gap of gapTries){
          const lanes=shape.place({partnerFrom:candidate.path.from,partnerTo:candidate.path.to,room,gap});
          // 2本目は必ずしっかり動く。端で潰れて動かなくなったら同時スライドにならないので
          // その形は採らず次へ回す（名前と中身を食い違わせない）
          if(Math.abs(lanes.to-lanes.from)<DOUBLE_SLIDE.minOwnSpanLanes){skipped.shape++;continue;}
          // 追従の速さ。速すぎる経路は指が追いつかない（sweepと同じ物差し）
          if(Math.abs(lanes.to-lanes.from)/(spanMs/1000)>DOUBLE_SLIDE.maxLaneSpeed){skipped.speed++;continue;}
          if(heldPairNearestGap(lanes,startGrid,endGrid)<minGapNeeded){skipped.gap++;continue;}
          // ★最後に、出荷を止めるのと同じ物差し（両手のシミュレート）で確かめる。
          //   自分で作った物差しだけで通すと「押せない」が増える（この段のコメント参照）。
          const trial=notes.concat([{type:'SLIDE',grid:startGrid,durationGrids:endGrid-startGrid,
            lane:lanes.from,endLane:lanes.to,subLaneWidth:2,
            slidePoints:[{grid:startGrid,lane:lanes.from,subLaneWidth:2},
              {grid:endGrid,lane:lanes.to,subLaneWidth:2}]}]);
          if(baseImpossible===null)baseImpossible=impossibleKeysOf(dropOverflowFingers(notes).kept);
          const after=impossibleKeysOf(dropOverflowFingers(trial).kept);
          if([...after].some(key=>!baseImpossible.has(key))){skipped.impossible++;continue;}
          chosen={shape,lanes};
          break;
        }
        if(chosen)break;
      }
      if(!chosen)continue;
      const {shape,lanes}=chosen;
      const note={
        type:'SLIDE',
        grid:startGrid,durationGrids:endGrid-startGrid,
        lane:lanes.from,endLane:lanes.to,subLaneWidth:2,
        // ★中継点にも太さを書く。ランタイムは書いていなければノーツの太さへ落とすので
        //   画面は正しく出るが、譜面を読む検査が点ごとの太さを見ているため
        //   NaN になって落ちる（2026-09-12・rhythm-slide-shape-variety-check）。
        //   ほかのSLIDE（slidePathFor が作るもの）は点ごとに持っているので、そろえる。
        slidePoints:[{grid:startGrid,lane:lanes.from,subLaneWidth:2},
          {grid:endGrid,lane:lanes.to,subLaneWidth:2}],
        heldPair:true,heldPairShape:shape.id,doubleSlide:true,doubleSlideSource:candidate.source,
      };
      notes.push(note);
      partner._heldPairUsed=true;
      partner._doubleSlidePartner=true;
      usage.set(shape.id,(usage.get(shape.id)||0)+1);
      previousShapeId=shape.id;
      placedCount++;
      placedGrids.push(grid);
      baseImpossible=null;   // 譜面が変わったので測り直す
    }
    // お知らせは16のあとで数え直す（15.5と同じ理由）
    doubleSlideReport={placed:placedCount,aim,candidates:byGrid.size,skipped};
    notes.sort((a,b)=>a.grid-b.grid);
  }

  // --- 15.7 スライドの分岐・合流 ---
  //
  // 【2026-09-12・ユーザー指示】「すすめて」（§3.1.8 の「まだやっていないこと」の消し込み）
  //
  // ★データ形式は変えない。 §3.1.8 では「分岐・合流は slidePoints が1本道なので形式から要る」と
  //   書いていたが、それは**1本のノーツの中で経路が割れる**形（maimai の扇）を考えていたため。
  //   実際に遊ぶ形として要るのは「1本だったものが2本になる／2本だったものが1本になる」で、
  //   これは**2本のSLIDEの端をそろえる**だけで出せる。既存の譜面の読み込みにも影響しない。
  //
  //   分岐: 親の途中から2本目が生えて、離れていく（親はそのまま最後まで続く）
  //   合流: 2本目が親へ近づいていって、途中で消える（親はそのまま最後まで続く）
  //
  //   指は2本なので、分岐点・合流点でも最低 fingerMinGapLanes だけ離す。
  //   帯の幅があるので、1レーン差でも「くっついて割れた」ように見える。
  //
  // ★幽霊ノーツ(§2.1)にしないための足場は15.6より強い。
  //   2本目の**始まりを、親の伸びの中にある実際の打点**へ合わせる（その音が2本目の頭になる）。
  //   そこに既にTAPが置かれていたら、**そのTAPを2本目に置き換える**（同じ音を叩く代わりに
  //   なぞる）。増やすのでも消すのでもないので、譜面の量も変わらない。
  //
  // 難しい置き方なので EXPERT と MASTER だけ（PROFILES.slideFan）。
  let slideFanReport=null;
  const SLIDE_FAN=P.slideFan;
  if(SLIDE_FAN&&SLIDE_FAN.perMinute>0&&P.types.includes('SLIDE')){
    const aim=countOf(SLIDE_FAN.perMinute);
    const room=LANES-1;
    const gapLanes=Math.max(1,Math.ceil(SLIDE_FAN.minGapLanes));
    const minGapNeeded=Math.max(HAND_MODEL.fingerMinGapLanes,SLIDE_FAN.minGapLanes);
    const releaseGrids=Math.max(1,Math.ceil(HAND_MODEL.releaseMarginMs/gridMs));
    const clampLane=lane=>Math.max(0,Math.min(room,Math.round(lane)));
    // 親になれるSLIDEを集める
    const candidates=[];
    for(const note of notes){
      if(note.type!=='SLIDE')continue;
      if(note._heldPairUsed||note.heldPair===true||note.doubleSlide===true)continue;
      const span=heldSpanOf(note);
      if(span.end-span.start<SLIDE_FAN.minParentGrids)continue;
      // 親の経路が使う幅。2本目ぶんの間隔が片側に残る幅までに限る（15.6と同じ理由）
      const path=heldPathOf(note);
      if(Math.abs(path.to-path.from)>room-gapLanes)continue;
      // 親の伸びの中にある打点。ここが2本目の頭になる。
      // 端をどれだけ空けるかは形ごとに違う（分岐は頭、合流は終わり）ので、
      // ここでは「親の中にある打点」だけを集めて、条件は形ごとに見る。
      const inner=[];
      for(let grid=span.start+1;grid<span.end;grid++){
        if(onsetByGrid.has(grid))inner.push(grid);
      }
      if(!inner.length)continue;
      candidates.push({note,span,path,inner,
        strength:Number(note.sourceStrength)||0,
        intensity:intensityPosition(Math.floor(note.grid/BAR))});
    }
    // 良い場所（長い親・強い打点）から見て、1グリッド1つへ絞る
    const byGrid=new Map();
    for(const candidate of candidates.slice().sort((a,b)=>
      (b.span.end-b.span.start)-(a.span.end-a.span.start)
      ||b.intensity-a.intensity||b.strength-a.strength)){
      if(!byGrid.has(candidate.span.start))byGrid.set(candidate.span.start,candidate);
    }
    let placedCount=0,previousKind=null;
    const usage=new Map();
    // 採用済みの譜面の「押せない」ところ。1本採るたびに測り直す
    let baseImpossible=null;
    for(const grid of spreadPick([...byGrid.keys()],aim,SLIDE_FAN.spacingGrids)){
      const candidate=byGrid.get(grid);
      const parent=candidate.note;
      if(parent._heldPairUsed)continue;
      const parentEnd=candidate.span.end;
      // 親のその瞬間のレーン
      const parentLaneAt=at=>heldLaneAt(parent,at);
      // 分岐と合流を、使った回数と直前のぶんで順番を入れ替えながら試す
      // （決めごと1つに戻さない。§3.1.9 と同じ考え方）
      const kinds=['out','in'].sort((a,b)=>{
        const score=kind=>(usage.get(kind)||0)*2+(previousKind===kind?1:0)
          +(hash32(`${trackId}:fan:${grid}:${kind}${variantSeed}`)%10)/10;
        return score(a)-score(b);
      });
      let chosen=null;
      for(const kind of kinds){
        for(const anchor of candidate.inner){
          // 2本目の受け持つ区間。
          //   分岐 … 生えたところから親の終わりまで。**頭側に1拍**空ける
          //           （親が1本で見えている時間が無いと「割れた」ように見えない）
          //   合流 … 生えたところから、親の終わりより1拍前まで。**終わり側に1拍**空ける
          //           （合流したあと親が1本で続く時間が無いと「合わさった」ように見えない）
          const ownStart=anchor;
          const ownEnd=kind==='out'?parentEnd
            :Math.min(parentEnd-BEAT,anchor+Math.max(SLIDE_FAN.minOwnGrids,BEAT*2));
          if(ownEnd-ownStart<SLIDE_FAN.minOwnGrids)continue;
          if(kind==='out'&&ownStart-candidate.span.start<BEAT)continue;
          if(kind==='in'&&parentEnd-ownEnd<BEAT)continue;
          // 親の外へ出ない
          if(ownEnd>parentEnd||ownStart<=candidate.span.start)continue;
          // 分岐点／合流点は、親にくっついて見える側の端
          const joinGrid=kind==='out'?ownStart:ownEnd;
          const farGrid=kind==='out'?ownEnd:ownStart;
          const side=parentLaneAt(joinGrid)<=room/2?1:-1;
          const joinLane=clampLane(parentLaneAt(joinGrid)+side*gapLanes);
          // もう片方の端は、**その時刻の親のレーンから**さらに離したところ。
          // ★分岐点のレーンからの足し算にしてはいけない。親が2本目と同じ側へ動いていると
          //   遠い端のほうが親に**近くなる**（実測 −0.21レーン。開きが逆転して
          //   「割れて見えない」形になった・2026-09-12）。必ず親の位置を基準に取る。
          for(const extra of [2,1,3]) {
            if(extra<SLIDE_FAN.minOwnSpanLanes)continue;
            const farLane=clampLane(parentLaneAt(farGrid)+side*(gapLanes+extra));
            if(Math.abs(farLane-joinLane)<SLIDE_FAN.minOwnSpanLanes)continue;
            // 遠い端のほうが親から離れていること（＝ほんとうに割れて／合わさって見える）
            const joinGap=Math.abs(joinLane-parentLaneAt(joinGrid));
            const farGap=Math.abs(farLane-parentLaneAt(farGrid));
            if(farGap-joinGap<SLIDE_FAN.minOpenLanes)continue;
            const lanes=kind==='out'?{from:joinLane,to:farLane}:{from:farLane,to:joinLane};
            // 追従の速さ（sweepと同じ物差し）
            const spanMs=(ownEnd-ownStart)*gridMs;
            if(spanMs<=0)continue;
            if(Math.abs(lanes.to-lanes.from)/(spanMs/1000)>SLIDE_FAN.maxLaneSpeed)continue;
            // 2本目の頭にTAPが置かれていたら、それを置き換える（同じ音をなぞる）
            const replaced=notes.filter(other=>other.grid===ownStart&&other.type==='TAP');
            const rest=notes.filter(other=>!replaced.includes(other));
            // 2本目の頭に、ほかの押さえノーツが重なっていないこと
            const heldThere=rest.filter(other=>{
              if(other===parent)return false;
              if(other.type!=='HOLD'&&other.type!=='SLIDE')return false;
              const that=heldSpanOf(other);
              return that.start<ownStart&&ownStart<=that.end;
            }).length;
            if(heldThere>0)continue;
            // 頭に置き換えなかった別のノーツが残っていたら、指が3本要る
            if(rest.some(other=>other.grid===ownStart))continue;
            // 2本押さえているあいだに落ちる打点の数
            const covered=rest.filter(other=>other!==parent
              &&other.grid>ownStart&&other.grid<ownEnd).length;
            if(covered>SLIDE_FAN.maxCoveredNotes)continue;
            // 指2本が入るか（重なるすべての押さえノーツと総当たり。15.6と同じ道具）
            if(heldPairNearestGap(lanes,ownStart,ownEnd)<minGapNeeded)continue;
            // 最後に、出荷を止めるのと同じ両手のシミュレートで確かめる（15.6と同じ理由）
            const note={type:'SLIDE',grid:ownStart,durationGrids:ownEnd-ownStart,
              lane:lanes.from,endLane:lanes.to,subLaneWidth:2,
              slidePoints:[{grid:ownStart,lane:lanes.from,subLaneWidth:2},
                {grid:ownEnd,lane:lanes.to,subLaneWidth:2}]};
            if(baseImpossible===null)baseImpossible=impossibleKeysOf(dropOverflowFingers(notes).kept);
            const after=impossibleKeysOf(dropOverflowFingers(rest.concat([note])).kept);
            if([...after].some(key=>!baseImpossible.has(key)))continue;
            chosen={kind,note,replaced,ownStart,ownEnd,joinGrid,lanes};
            break;
          }
          if(chosen)break;
        }
        if(chosen)break;
      }
      if(!chosen)continue;
      const onset=onsetByGrid.get(chosen.ownStart);
      Object.assign(chosen.note,{
        slideFan:chosen.kind,slideFanAt:chosen.joinGrid,
        sourceStrength:onset?Math.round(onset.strength*100)/100:0,
        sourcePeakOffsetMs:onset?onset.gridOffsetMs:0,
        sourceCharacter:onset?onset.character:'NONE',
      });
      if(chosen.replaced.length)notes=notes.filter(other=>!chosen.replaced.includes(other));
      notes.push(chosen.note);
      parent._heldPairUsed=true;
      parent._slideFanParent=chosen.kind;
      usage.set(chosen.kind,(usage.get(chosen.kind)||0)+1);
      previousKind=chosen.kind;
      placedCount++;
      baseImpossible=null;   // 譜面が変わったので測り直す
    }
    // お知らせは16のあとで数え直す（15.5・15.6と同じ理由）
    slideFanReport={placed:placedCount,aim,candidates:byGrid.size};
    notes.sort((a,b)=>a.grid-b.grid);
  }

  // --- 16. 指の本数を超える瞬間を作らない ---
  // 指は2本しかない。ある瞬間に「押さえっぱなしのHOLD/SLIDE」と「そこで新しく押すノーツ」を
  // 足して2本を超えると、どうやっても押せない。レーンを動かしても直らないので
  // （14番の直し方では拾えない）、ここであふれたぶんを取り除く。
  // 実測: 速い曲のMASTERで、HOLDを押さえたまま同時押しが来る形が5件出た。
  {
    const {kept,dropped}=dropOverflowFingers(notes);
    if(dropped){
      notice.push(`指が足りない瞬間のノーツを${dropped}件外した（押さえっぱなし＋同時押しで3本以上になる形）`);
      notes=kept;
    }
  }

  // --- 16.5 押せない瞬間を残さない（最後の取りこぼし） ---
  // 16は「指の本数」と「押さえ中の叩き直し」の2つを見るが、それでも取りこぼしが出る。
  // 実測で、押さえノーツが無いところでも
  //   ・2.50レーンを99msで移動できない
  //   ・同じレーンを83msで叩き直せない
  // が85譜面のうち5譜面に1件ずつ残った(2026-09-12)。指2本を交互に使っても、
  // レーンの離れかたによっては届かない瞬間がある。
  //
  // 形を変えて直すのは自動修正(rhythm-chart-v2-step7-autofix.js)の仕事だが、
  // あちらはレーンを動かすだけなので**時間の詰まりは直せない**。ここで取り除く。
  // 物差しは出荷を止めるのと同じ両手のシミュレート。落ちたら必ずお知らせへ出す。
  {
    let removed=0;
    for(let pass=0;pass<3;pass++){
      const sim=simulateNotes(notes,timing);
      if(!sim.impossible)break;
      const blame=new Set();
      for(const issue of sim.issues){
        if(issue.severity!=='impossible')continue;
        const note=notes[issue.noteIndex];
        // 押さえノーツは譜面の骨格なので、そちらではなく打点のほうを落とす
        if(note&&note.type!=='HOLD'&&note.type!=='SLIDE')blame.add(note);
      }
      if(!blame.size)break;
      notes=notes.filter(note=>!blame.has(note));
      removed+=blame.size;
    }
    if(removed)notice.push(`押せない瞬間のノーツを${removed}件外した（指2本を交互に使っても届かない形）`);
  }

  // 同時押さえのお知らせは、指の本数の段で落ちたぶんを引いた**実際に残った数**で出す。
  // 使われた形も、残ったノーツから数え直す（落ちた組の形を数えない）。
  if(heldPairReport){
    // ★同時スライド(15.6)も heldPair:true を持つので、ここで数えると二重に数える
    //   （狙い2組なのに「3組」と報告した・2026-09-12）。この段で置いたぶんだけを数える。
    const survived=notes.filter(note=>note.heldPair===true&&note.doubleSlide!==true);
    const shapes=new Map();
    for(const note of survived)shapes.set(note.heldPairShape,(shapes.get(note.heldPairShape)||0)+1);
    const moving=survived.filter(note=>note.type==='SLIDE').length;
    const used=[...shapes.entries()].map(([id,n])=>`${id}${n}`).join(' / ')||'なし';
    const droppedPairs=heldPairReport.placed-survived.length;
    notice.push(`押さえノーツの同時押さえ ${survived.length}組`
      +`（狙い${heldPairReport.aim}組・置ける場所${heldPairReport.candidates}箇所`
      +`${droppedPairs>0?`・指が足りず${droppedPairs}組は落ちた`:''}`
      +`・2本目が動くもの${moving}組・形 ${used}）`);
  }
  // 同時スライドも同じく、16のあとで残ったぶんだけを数えて出す。
  if(doubleSlideReport){
    const survived=notes.filter(note=>note.doubleSlide===true);
    const shapes=new Map();
    for(const note of survived)shapes.set(note.heldPairShape,(shapes.get(note.heldPairShape)||0)+1);
    const sources=new Map();
    for(const note of survived)sources.set(note.doubleSlideSource,(sources.get(note.doubleSlideSource)||0)+1);
    const used=[...shapes.entries()].map(([id,n])=>`${id}${n}`).join(' / ')||'なし';
    const from=[...sources.entries()].map(([id,n])=>`${id}${n}`).join(' / ')||'なし';
    const droppedPairs=doubleSlideReport.placed-survived.length;
    notice.push(`同時スライド ${survived.length}組`
      +`（狙い${doubleSlideReport.aim}組・置ける場所${doubleSlideReport.candidates}箇所`
      +`${droppedPairs>0?`・指が足りず${droppedPairs}組は落ちた`:''}`
      +`・形 ${used}・素 ${from}`
      +`${survived.length<doubleSlideReport.aim?`・置けなかった理由 ${
        Object.entries(doubleSlideReport.skipped).filter(([,count])=>count>0)
          .map(([key,count])=>`${{partner:'相方が使用済み',fingers:'指が空いていない',
            shape:'2本目が動かない',speed:'追従が速すぎる',gap:'指2本が入らない',
            impossible:'押せなくなる'}[key]}${count}`).join(' / ')||'なし'}`:''}）`);
  }
  // 分岐・合流も、16のあとで残ったぶんだけを数えて出す。
  if(slideFanReport){
    const survived=notes.filter(note=>note.slideFan==='out'||note.slideFan==='in');
    const out=survived.filter(note=>note.slideFan==='out').length;
    const into=survived.length-out;
    const droppedFans=slideFanReport.placed-survived.length;
    notice.push(`スライドの分岐・合流 ${survived.length}箇所`
      +`（狙い${slideFanReport.aim}箇所・置ける場所${slideFanReport.candidates}箇所`
      +`${droppedFans>0?`・指が足りず${droppedFans}箇所は落ちた`:''}`
      +`・分岐${out} / 合流${into}）`);
  }

  // 段どうしの受け渡しに使った一時フィールド（_で始まるもの）は譜面に持ち出さない。
  // 残すと生成物のJSONへそのまま載り、あとで「これは何だ」になる。
  for(const note of notes)for(const key of Object.keys(note))if(key.charCodeAt(0)===95)delete note[key];

  return {notes,log,notice,profile:P,runs:runs.length,chordCount,chordRunCount,sweepCount,crossCount,monsterSlotGrids,
    targetCount,notesPerSecondTarget:round3(notesPerSecond),
    counts:{holdMax,slideMax,flickMax,endFlickMax,chordMax,accentMax,
      playableMinutes:round3(playableMinutes)}};
};
const round3=value=>Math.round(value*1000)/1000;

// 候補を曲全体へ散らして選ぶ（かたまって出ないように）
function spreadPick(candidates,count,minGap){
  const chosen=[];
  const rest=candidates.slice().sort((a,b)=>a-b);
  if(!rest.length||count<=0)return chosen;
  for(let k=0;k<count&&rest.length;k++){
    const first=rest[0],last=rest[rest.length-1];
    const target=first+(last-first)*(count>1?k/(count-1):0);
    let bestPos=-1,bestDistance=Infinity;
    rest.forEach((index,pos)=>{
      if(chosen.some(taken=>Math.abs(taken-index)<minGap))return;
      const distance=Math.abs(index-target);
      if(distance<bestDistance){bestDistance=distance;bestPos=pos;}
    });
    if(bestPos<0)break;
    chosen.push(rest[bestPos]);
    rest.splice(bestPos,1);
  }
  return chosen.sort((a,b)=>a-b);
}

// スイープの中継点の上限。多いほど経路はなめらかだが、譜面データも大きくなる。
const SWEEP_MAX_POINTS=20;
// 高さをならす幅（前後いくつぶんの平均を取るか）と、中継点の間隔（グリッド）。
// 【実測でこの2つに決めた】3曲・全難易度で「端まで走る一本」が何本置けたかを数えると
//   ならし1/間隔2 → 7本   ならし2/間隔2 → 15本   ならし2/間隔3 → 24本   ならし3/間隔4 → 28本
// 細かく刻むほど1区間の動きが**大きく**なる（ならす前の段差がそのまま出る）ので、
// 「細かいほど良い」ではない。ならしを強くしすぎると音の高さから離れるため、
// 24本取れる ならし2/間隔3 を採る。
const SWEEP_SMOOTH=2;
const SWEEP_STRIDE=3;
// --- 端から端まで動くSLIDE（スイープ）の経路を作る ---
// ふつうのSLIDEは「その難易度の歩幅ぶん」しか動かさないので、実測で最大2.5レーンだった。
// スイープは同じ音の高さの動きを**画面いっぱいへ写す**。作り方の違いは2つだけ。
//   ・高さを3点の移動平均でなめらかにする（大きく走らせるので、細かい上下は経路に写さない）
//   ・中継点を細かく取る（2グリッドおき。粗いと点と点のあいだで指が瞬間移動することになる）
// 写像は「高さが上がればレーンも上がる」向きを変えないので、
// 「SLIDEの向きが音の高さと合っている」という約束はスイープでも保たれる。
// どこまで大きくするかは、**区間ごとの指の速さが上限を超えない、いちばん大きい倍率**で決める。
function sweepPathFor(note,SWEEP,width){
  const startGrid=note.grid,endGrid=note.grid+(Number(note.durationGrids)||0);
  const raw=[];
  for(let grid=startGrid;grid<=endGrid;grid++)raw.push(heightByGrid.has(grid)?heightByGrid.get(grid):null);
  for(let i=0;i<raw.length;i++){
    if(raw[i]!=null)continue;
    let before=null,after=null;
    for(let k=i-1;k>=0;k--)if(raw[k]!=null){before=raw[k];break;}
    for(let k=i+1;k<raw.length;k++)if(raw[k]!=null){after=raw[k];break;}
    raw[i]=before!=null&&after!=null?(before+after)/2:(before??after??.5);
  }
  const smooth=raw.map((_,i)=>{
    const from=Math.max(0,i-SWEEP_SMOOTH),to=Math.min(raw.length-1,i+SWEEP_SMOOTH);
    let sum=0,count=0;
    for(let k=from;k<=to;k++){sum+=raw[k];count++;}
    return sum/count;
  });
  const lo=Math.min(...smooth),hi=Math.max(...smooth);
  if(hi-lo<1e-6)return null;
  // 中継点は細かいほど、1区間あたりの指の動きが小さくなる（＝大きく伸ばせる）。
  // いちばん細かい1グリッドおきを基本にし、点が増えすぎるときだけ間引く。
  let stride=SWEEP_STRIDE;
  while((smooth.length-1)/stride>SWEEP_MAX_POINTS)stride++;
  const sampled=[];
  for(let i=0;i<smooth.length;i+=stride)sampled.push({index:i,height:smooth[i]});
  if(sampled[sampled.length-1].index!==smooth.length-1)
    sampled.push({index:smooth.length-1,height:smooth[smooth.length-1]});
  if(sampled.length<2)return null;
  let scale=(LANES-1)/(hi-lo);
  for(let i=1;i<sampled.length;i++){
    const move=Math.abs(sampled[i].height-sampled[i-1].height);
    const deltaMs=(sampled[i].index-sampled[i-1].index)*gridMs;
    if(move<1e-9)continue;
    if(deltaMs<=0)return null;
    scale=Math.min(scale,SWEEP.maxLaneSpeed*(deltaMs/1000)/move);
  }
  // 中継点は0.5レーン刻みへそろえる。そろえたぶんだけ区間の動きが増えることがあるので、
  // **そろえたあとの経路**でもう一度速さを測り、超えていたら倍率を落として測り直す。
  // （倍率だけで判断すると、0.4レーンの動きが0.5レーンへ丸められて上限を超える）
  const buildAt=value=>{
    const span=value*(hi-lo);
    if(!(span>=SWEEP.minSpanLanes))return null;
    const base=(LANES-1-span)/2-lo*value;
    const points=sampled.map(entry=>({grid:startGrid+entry.index,
      lane:Math.max(0,Math.min(LANES-1,Math.round((entry.height*value+base)*2)/2)),
      subLaneWidth:width}));
    const lanes=points.map(point=>point.lane);
    if(Math.max(...lanes)-Math.min(...lanes)<SWEEP.minSpanLanes-1e-9)return null;
    for(let i=1;i<points.length;i++){
      const deltaMs=(points[i].grid-points[i-1].grid)*gridMs;
      if(deltaMs<=0)return null;
      if(Math.abs(lanes[i]-lanes[i-1])/(deltaMs/1000)>SWEEP.maxLaneSpeed+1e-9)return null;
    }
    return points;
  };
  for(let value=scale;value>0;value*=.92){
    const points=buildAt(value);
    if(points)return points;
    if(value*(hi-lo)<SWEEP.minSpanLanes)break;
  }
  return null;
}

// --- SLIDEの経路を「音の高さの動き」から作る ---
// SLIDEの「形」の語彙。太さの変え方だけを持ち、経路は音の高さに従わせたまま。
//
// 【2026-09-12・ユーザー指摘「バリエーションが少ない」】
// それまで slidePathFor が全中継点へ同じ width を入れていたため、配信譜面のSLIDE 552本が
// **全本単一幅**（HARD/EXPERT=幅3 / MASTER=幅2）だった。データ形式（点ごとの subLaneWidth）も
// ランタイム（rhythmSlideWidthAt の線形補間）も可変幅に対応済みなので、ここだけで足りる。
//
// 当てどころは音ゲー各作の定石に合わせた（プロセカは中継点ごとに幅を持ち、制作者は
// 「幅が小さいほど落ち着き、大きいほど盛り上がり」として使う。CHUNITHMの「イカすSLIDE」も
// 始点と終点で幅を変える）。t は 0（始点）〜1（終点）。
const SLIDE_WIDTH_SHAPES=Object.freeze({
  // 一定。伸ばした1音・ロングトーン
  steady:t=>1,
  // 末広がり。クレッシェンド、ライザー、サビへの助走
  widen:t=>.55+.45*t,
  // 先細り。ディミヌエンド、リバーブの減衰、フレーズの終わり
  taper:t=>1-.45*t,
  // ふくらむ。ひと山ある伸ばし、ビブラートの深い山
  swell:t=>.6+.4*Math.sin(Math.PI*t),
  // しぼんで戻る。抜けたあと戻ってくる音
  pinch:t=>1-.35*Math.sin(Math.PI*t),
});
// その音にどの形を当てるか。**上から順に見て、先に当たったものを使う。**
//
//   1. 伸びの途中に山がある → swell ／ 谷がある → pinch   （実測で約4割がここで決まる）
//   2. onset.character が FULL / PUNCH（強い頭） → taper
//   3. LIGHT（軽い頭） → widen
//   4. それ以外は、終わりが始まりより高ければ widen、でなければ steady（約1割）
//
// 山/谷を character より先に見るのは、音の形のほうが太さの表現に直結するため。
// そのぶん「PUNCH なのに swell」のような組み合わせが3割ほど出るが、これは想定どおり。
// 乱数は使わない（この生成器は再実行で同じ譜面になることを前提にしている）。
const slideWidthShapeFor=(onset,heights,allowed)=>{
  const pick=name=>allowed.includes(name)?name:'steady';
  if(!Array.isArray(heights)||heights.length<2)return 'steady';
  const head=heights[0],tail=heights[heights.length-1];
  const lo=Math.min(...heights),hi=Math.max(...heights);
  const span=hi-lo;
  // 山/谷と見なすのに要る出っぱりの大きさ。
  // **相対(span*.2)だけでは足りない。** 全体が0.5半音しか動いていない平らな音でも
  // 0.31半音の凸があれば「ひと山ある伸ばし」になってしまう(実測: 4u-hitasura grid1088)。
  // これは HEIGHT_TURN_MIN で直したのと同じ誤りで、ジッタを音の形として読んでいた。
  // 絶対の下限(≒1半音)を併用する。
  const bump=Math.max(span*.2,HEIGHT_SHAPE_MIN);
  const peakInside=span>1e-6&&Math.max(...heights.slice(1,-1).concat([-Infinity]))>Math.max(head,tail)+bump;
  const dipInside=span>1e-6&&Math.min(...heights.slice(1,-1).concat([Infinity]))<Math.min(head,tail)-bump;
  if(peakInside)return pick('swell');
  if(dipInside)return pick('pinch');
  const character=onset?onset.character:'NONE';
  // 強い頭でだんだん静まる音は先細り、軽い頭からせり上がる音は末広がり
  if(character==='FULL'||character==='PUNCH')return pick('taper');
  if(character==='LIGHT')return pick('widen');
  return tail>head?pick('widen'):pick('steady');
};
// 音の高さの曲線が、どれだけ細かく揺れているか（0〜1）。
// 隣り合う差の符号が変わる回数を数える。ビブラートのように行き来する音ほど1へ近づく。
//
// 【しきい値が要る】(2026-09-12・生成結果の検証で判明)
// はじめ 1e-6（実質ゼロ）で符号の変化を数えたら、**音の揺れではなくピッチ推定のジッタ**を
// 拾っていた。数えた折れ165回のうち72%が0.5半音未満（中央値0.29半音）で、
// 結果として「中継点の数」と「音の動きの大きさ」が**逆相関(r=-0.30)**になった
// (8.2半音動くメロディが5点・折れ0回 / 0.5半音の伸ばし音が17点・折れ7回)。
// はじめ 0.04 にしたが、これは**約0.73半音**に相当し(1半音 ≒ height 0.055)、
// 本物のビブラート・こぶし・往復するメロディまで削っていた。
// 解析データを測ると、確度(clarity)0.7以上の区間では0.5半音以上の折れが平均1.20回、
// 0.7未満では0.47回。**0.5半音で切ると、本物の揺れとジッタが2.5倍差で分かれる**。
// SLIDEになる伸び40件のうち9件(23%)が「0.5半音で2回以上折れる」＝はっきり揺れている。
const HEIGHT_TURN_MIN=.028;   // ≒0.5半音
// 「伸びの途中に山/谷がある」と見なすのに要る出っぱりの大きさ（絶対の下限）。
// 相対のしきい値(span*.2)だけだと、平らな音の中のジッタを山と読んでしまう。
const HEIGHT_SHAPE_MIN=.055;  // ≒1半音
const heightWaviness=heights=>{
  if(!Array.isArray(heights)||heights.length<3)return 0;
  let turns=0,moves=0,previous=0;
  for(let i=1;i<heights.length;i++){
    const delta=heights[i]-heights[i-1];
    if(Math.abs(delta)<HEIGHT_TURN_MIN)continue;   // ジッタは動きとして数えない
    moves++;
    const sign=delta>0?1:-1;
    if(previous&&sign!==previous)turns++;
    previous=sign;
  }
  // 「動いた回数のうち、何回向きが変わったか」。長さで割ると、まっすぐ長く動く音ほど
  // 小さくなってしまい「大きく動く音ほど点が減る」という逆転を起こす。
  return moves<2?0:Math.min(1,turns/(moves-1));
};
function slidePathFor(reserved,startLane,width,P,onset){
  const points=[];
  const {startGrid,endGrid}=reserved;
  const heights=[];
  for(let grid=startGrid;grid<=endGrid;grid++)heights.push(heightByGrid.has(grid)?heightByGrid.get(grid):null);
  // 取れなかった位置は前後から埋める
  for(let i=0;i<heights.length;i++){
    if(heights[i]!=null)continue;
    let before=null,after=null;
    for(let k=i-1;k>=0;k--)if(heights[k]!=null){before=heights[k];break;}
    for(let k=i+1;k<heights.length;k++)if(heights[k]!=null){after=heights[k];break;}
    heights[i]=before!=null&&after!=null?(before+after)/2:(before??after??.5);
  }
  const lo=Math.min(...heights),hi=Math.max(...heights);
  const range=Math.max(1e-6,hi-lo);
  // 音の動きの幅を、その難易度で許す歩幅ぶんのレーンへ写す。
  //
  // 【2026-09-12】以前は reach=min(2.5,maxLaneStep) の固定で、音がどれだけ動いても
  // 同じ移動量になっていた（配信譜面の移動量が2.0/2.5に張り付いていた原因）。
  // 実際の音の動きの大きさ(range)へ比例させ、ちょこっと動く音は小さく、
  // 大きく動く音は上限まで使う。上限(歩幅)は難易度の約束なので超えない。
  const reachMax=Math.max(1,Math.min(2.5,P.maxLaneStep));
  // range は高さの差。0.25 で上限へ届く。
  //
  // 【下限は1.8レーン】(2026-09-12・生成結果の検証で判明)
  // 下限0.5 → 移動量の中央値が1.5→0.5レーンまで縮み、半分がほぼHOLDになった。
  // 下限1.0 → 今度は「指を止めたままでも通るSLIDE」が35→44/67本へ増えた。
  //   追従の許容は幅と難易度と速さで ±0.75〜1.4レーンあり、経路の振れ幅の半分が
  //   それ以下だと、動かなくても許容の内側に居続けられる。カクカクは増えるが
  //   操作を要求しない「見た目だけの形」になる。
  // 下限1.8 → まだMASTERで 6→11本 に増えた。原因は**0.5レーン刻みの丸め**
  //   (laneAt が Math.round(lane*2)/2 するので 1.8 は 1.5 に丸まり、
  //    振れ幅の半分0.75 が MASTER の許容0.82 を下回る)。
  // 下限2.0 なら丸めても2.0が残り、半分の1.0が許容0.82を超える。
  // 変更前の実質値(HARD 2.0 / EXPERT・MASTER 2.5)と同じ下限なので、
  // 「止めたままでも通る本数」は変更前より増えない。
  // 形のバリエーションは太さの変え方と刻みの細かさで出しており、そちらは効いたまま。
  const reach=Math.max(2,Math.min(reachMax,reachMax*Math.min(1,range/.25)));
  // 中心を画面へ収めるための寄せは、**その難易度の上限(reachMax)**で見る。
  // reach(実際の移動量)で見ると、音の動きが小さくて reach が縮んだときに中心まで動いてしまい、
  // 同時に流れてくるTAPとの隙間が変わる(品質レポートの「押せる」が3譜面で下がった)。
  // 上限で見れば、移動量が変わっても中心は動かない。
  const centerLane=Math.max(reachMax/2,Math.min(LANES-1-reachMax/2,startLane));
  const laneAt=height=>{
    const ratio=(height-lo)/range;      // 0〜1
    const lane=centerLane+(ratio-(heights[0]-lo)/range)*reach;
    return Math.max(0,Math.min(LANES-1,Math.round(lane*2)/2));
  };
  // 中継点の刻み。
  //
  // 【2026-09-12・ユーザー指摘「カクカクとか…そういうのもほしい」】
  // 以前は長さに関わらず常に約6分割で、どのSLIDEも7点前後になっていた。
  // これが**音の細かい揺れを平らに均していた**のが「形が単調」の正体。
  // 音の高さが行き来している(ビブラート・トレモロ・うねるベース)ほど細かく刻んで
  // 折れ線として見せ、まっすぐ伸びている音は粗く刻んで素直な直線にする。
  // 経路そのものは音の高さに従ったままなので、「音と合っていない幽霊スライド」にはならない
  // (docs/spec/RHYTHM_CHART_DESIGN.md 2.1 の禁止事項)。
  const waviness=heightWaviness(heights);
  const divisions=Math.round(4+waviness*10);            // 揺れていないと4分割、揺れていると14分割
  const step=Math.max(1,Math.min(6,Math.round((endGrid-startGrid)/Math.max(2,divisions))));
  // 太さの変え方。1本の中で t(0〜1) に沿って PROFILES.widths の段へ写す。
  const available=[...P.widths].sort((a,b)=>a-b);
  const shapeName=slideWidthShapeFor(onset,heights,Object.keys(SLIDE_WIDTH_SHAPES));
  const shape=SLIDE_WIDTH_SHAPES[shapeName]||SLIDE_WIDTH_SHAPES.steady;
  // 基準の太さ(width)を最大として、形に応じて細くする。太くする方向へは出さない
  // (幅は widthFor が難易度ごとの上限つきで決めているので、そこを超えない)。
  // 【下限は2】(2026-09-12・生成結果の検証で判明)
  // 下限を available[0](=1) にしたら、幅1の中継点が **MASTERだけ** に出た
  // (MASTER 24本中18本・押さえている時間の36%が幅1 / HARD・EXPERTは0本)。
  // 幅1は追従の許容がいちばん狭い(±0.57レーン)ので、2026-09-11に直したばかりの
  // 「MASTERがいちばん厳しい」状態がそのまま戻る。
  // 基準の太さが1のノーツ(細いSLIDE)だけは1のままにする。
  const floorWidth=Math.min(width,2);
  // 【太る方向へも1段だけ出す】(2026-09-12・実曲で確かめて判明)
  // 細くする方向だけだと、基準の太さが下限と同じ難易度では**1本も変化が出ない**。
  // 実際 six_eternel_beat の MASTER は基準幅2＝下限2で、SLIDE 14本すべて太さ一定だった
  // (HARD 8/10本・EXPERT 8/12本は変化していた)。
  // 太くなる向きは追従の許容が広がる側なので、難しくはならない。
  // 上限はその難易度が持っている太さの範囲(PROFILES.widths)の中で基準+1段まで。
  const ceilWidth=Math.min(available[available.length-1],width+1);
  // shape は 0.55〜1.0 を返す。真ん中(0.775)を基準の太さに合わせ、
  // 上下へ同じだけ振る。こうすると steady 以外は必ず細い側と太い側の両方を使う。
  const SHAPE_MID=.775;
  const widthAt=t=>{
    const shaped=shape(Math.max(0,Math.min(1,t)));
    const scaled=width+(shaped-SHAPE_MID)/(1-SHAPE_MID);
    let best=available[0];
    for(const candidate of available)if(Math.abs(candidate-scaled)<Math.abs(best-scaled))best=candidate;
    return Math.max(floorWidth,Math.min(ceilWidth,best));
  };
  const lastIndex=heights.length-1;
  // 刻みを粗くすると、音がいちばん高い/低いところを飛び越えてしまい、
  // 書いたつもりの移動量(reach)より実際の振れ幅が小さく出る。
  // 振れ幅が追従の許容より小さいと「指を止めたままでも通るSLIDE」になるので、
  // **山と谷の位置は必ず点として通す**(2026-09-12・生成結果の検証で判明)。
  const peakIndex=heights.indexOf(hi),valleyIndex=heights.indexOf(lo);
  // 【加速・減速】(2026-09-12)
  // 中継点の間隔を等間隔ではなく、だんだん詰める／広げる。
  // ドラムフィル・スネアロール・加速するライザー、rit./accel. のテンポ表現に当てる。
  // 音の高さが**片道で**動いている(行き来していない)ときだけ使う。
  // 行き来している音は折り返し点そのものが形なので、間隔をいじると読めなくなる。
  //   accel … 後半ほど詰まる（せり上がって最後に畳みかける音）
  //   decel … 後半ほど広がる（着地して伸びる音）
  // どちらも合計の長さは変えないので、譜面のタイミングはずれない。
  const oneWay=waviness<.2;
  const rising=heights[heights.length-1]>heights[0];
  const paceName=!oneWay?'even':rising?'accel':'decel';
  // 0..1 を、詰まる/広がる向きへ曲げる。even はそのまま
  const pace=t=>paceName==='accel'?1-Math.pow(1-t,1.7)
    :paceName==='decel'?Math.pow(t,1.7)
    :t;
  const sampled=new Set();
  {
    // 等間隔で何点取るかは今までどおり step から決め、置く位置だけを pace で曲げる
    const count=Math.max(2,Math.ceil((heights.length-1)/step)+1);
    for(let k=0;k<count;k++){
      const t=count>1?k/(count-1):0;
      sampled.add(Math.max(0,Math.min(heights.length-1,Math.round(pace(t)*(heights.length-1)))));
    }
  }
  sampled.add(peakIndex);sampled.add(valleyIndex);
  // 【ジグザグ(カクカク)を出すのはここ】(2026-09-12)
  // 等間隔で刻むだけだと、音が行って戻る「折り返し点」をまたいでしまい、
  // 往復が1本の直線に均される。実測で、刻みを細かくしても経路の折り返しは
  // 15%のまま増えなかった(太さと点の数だけが増えていた)。
  // **音が向きを変えた位置そのものを点として置く**と、はじめてジグザグになる。
  // 経路は音の高さに従ったままなので、音と無関係な形にはならない。
  // 点が増えすぎると帯が読めなくなるので上限を置く(スイープの SWEEP_MAX_POINTS と同じ考え)。
  const turningPoints=[];
  {
    let previousSign=0,lastTurnIndex=-Infinity;
    for(let i=1;i<heights.length;i++){
      const delta=heights[i]-heights[i-1];
      if(Math.abs(delta)<HEIGHT_TURN_MIN)continue;
      const sign=delta>0?1:-1;
      // 向きが変わったのは「ひとつ前の点」。そこが山または谷になる
      if(previousSign&&sign!==previousSign&&i-1-lastTurnIndex>=2){
        turningPoints.push(i-1);lastTurnIndex=i-1;
      }
      previousSign=sign;
    }
  }
  const SLIDE_MAX_POINTS=20;
  for(const index of turningPoints){
    if(sampled.size>=SLIDE_MAX_POINTS)break;
    sampled.add(index);
  }
  for(const i of [...sampled].sort((a,b)=>a-b)){
    points.push({grid:startGrid+i,lane:laneAt(heights[i]),subLaneWidth:widthAt(lastIndex?i/lastIndex:0)});
  }
  // 終点を足す。ただし直前の点が近すぎると、**最後の区間だけ極端に短く**なり
  // 「いちばん速くていちばん細い区間が、離す瞬間に来る」形が生まれる
  // (実測: 他の区間が266msなのに最後だけ89msで1.5レーン＝16.9レーン/秒。全区間の最悪値)。
  // 半歩ぶんより近ければ、足さずに最後の点を終点へ動かす。
  const lastPoint=points[points.length-1];
  const endValue={grid:endGrid,lane:laneAt(heights[lastIndex]),subLaneWidth:widthAt(1)};
  if(!lastPoint)points.push(endValue);
  else if(lastPoint.grid!==endGrid){
    if(endGrid-lastPoint.grid<Math.max(1,Math.floor(step/2))&&points.length>1)points[points.length-1]=endValue;
    else points.push(endValue);
  }
  return points;
}

// ============================================================================
// 実行
// ============================================================================
const targets=only?[only]:DIFFICULTIES;
const results={};
for(const difficulty of targets){
  if(!PROFILES[difficulty]){console.error(`未知の難易度です: ${difficulty}`);process.exit(1);}
  // 小節ごとの取り分は切り捨てで配るうえ、格子・連なりの上限でも落ちるので、
  // 実際の数は目標より少なくなる。足りないぶんを補って数回だけやり直す（乱数は使わない）。
  let result=buildChart(difficulty);
  let adjust=1;
  for(let pass=0;pass<4;pass++){
    const ratio=result.targetCount/Math.max(1,result.notes.length);
    if(Math.abs(ratio-1)<=.02)break;
    adjust*=Math.max(.7,Math.min(1.6,ratio));
    const retry=buildChart(difficulty,{densityAdjust:adjust});
    if(Math.abs(retry.notes.length-retry.targetCount)>=Math.abs(result.notes.length-result.targetCount))break;
    result=retry;
  }
  results[difficulty]=result;
}

for(const difficulty of targets){
  const {notes,profile,runs}=results[difficulty];
  const typeCounts=notes.reduce((acc,n)=>{acc[n.type]=(acc[n.type]||0)+1;return acc;},{});
  // 15.5〜15.7 で足した押さえノーツは打点から作らないので出どころが無い。
  // そのまま数えると「undefined1」と出るため、打点の無いノーツと同じ NONE へ入れる。
  const characterCounts=notes.reduce((acc,n)=>{const key=n.sourceCharacter||'NONE';acc[key]=(acc[key]||0)+1;return acc;},{});
  const spanMs=gridTimeMs(notes[notes.length-1].grid)-gridTimeMs(notes[0].grid);
  console.log(`${difficulty}: ${notes.length}ノーツ (${Object.entries(typeCounts).map(([k,v])=>`${k}${v}`).join(' / ')})`);
  console.log(`  ${(gridTimeMs(notes[0].grid)/1000).toFixed(1)}s〜${(gridTimeMs(notes[notes.length-1].grid)/1000).toFixed(1)}s / ${(notes.length/(spanMs/1000)).toFixed(2)}ノーツ毎秒 / かたまり${runs}個`);
  console.log(`  拾った音: ${Object.entries(characterCounts).sort((a,b)=>b[1]-a[1]).map(([k,v])=>`${k}${v}`).join(' / ')}`);
  const patterns=results[difficulty].log.reduce((acc,entry)=>{acc[entry.pattern||'—']=(acc[entry.pattern||'—']||0)+1;return acc;},{});
  console.log(`  使った形: ${Object.entries(patterns).sort((a,b)=>b[1]-a[1]).map(([k,v])=>`${k}${v}`).join(' / ')}`);
  for(const line of results[difficulty].notice||[])console.log(`  ${line}`);
}

if(explain&&results[explain]){
  console.log(`\n${explain} の組み立て（最初の24かたまり）:`);
  for(const entry of results[explain].log.slice(0,24)){
    console.log(`  grid${String(entry.fromGrid).padStart(4)}〜${String(entry.toGrid).padStart(4)} ${String(entry.length)}個 `
      +`${String(entry.pattern).padEnd(12)}${entry.mirrored?'(反転)':'      '} レーン ${entry.lanes?entry.lanes.join('→'):'—'}`
      +`   高さ ${entry.heights.map(h=>h==null?' — ':h.toFixed(2)).join(' ')}`);
  }
}

if(write){
  for(const difficulty of targets){
    const {notes,profile,log}=results[difficulty];
    const typeCounts=notes.reduce((acc,n)=>{acc[n.type]=(acc[n.type]||0)+1;return acc;},{});
    const spanMs=gridTimeMs(notes[notes.length-1].grid)-gridTimeMs(notes[0].grid);
    const report={
      schemaVersion:1,
      analysisType:'rhythm-chart-v3-chart',
      trackId,difficulty,
      candidateVersion:'v3',
      status:'draft',
      reviewRequired:true,
      runtimeConnected:false,
      bpm:timing.bpm,beatZeroMs:timing.beatZeroMs,subdivisionsPerBeat:timing.subdivisionsPerBeat,
      beatsPerBar:timing.beatsPerBar,timingSource:timing.source,
      // 譜面としての終わり。音源より短いことがある（playEndMs / --end）。
      chartEndMs,audioDurationMs:Number(audio.durationMs),
      source:{audio:`tools/mode/authoring/${dashed}-v3-audio.json`,

        design:'docs/spec/RHYTHM_CHART_DESIGN.md'},
      policy:{...profile,characterWeight:CHARACTER_WEIGHT,positionWeight:POSITION_WEIGHT,
        musicalLift:MUSICAL_LIFT,densityTarget:DENSITY_TARGET[difficulty],
        songChallenge:songChallengeFactor(audio),
        counts:results[difficulty].counts},
      level:profile.level,
      noteCount:notes.length,
      typeCounts,
      densityPerSecond:Math.round(notes.length/(spanMs/1000)*100)/100,
      shapes:log,
      notes,
    };
    const dir=outputDir?path.resolve(ROOT,outputDir):path.join(ROOT,'tools/mode/authoring');
    const out=path.join(dir,`${dashed}-v3-chart-${difficulty.toLowerCase()}.json`);
    fs.writeFileSync(out,JSON.stringify(report,null,1)+'\n');
    console.log(`書き出し: ${path.relative(ROOT,out)}`);
  }
}else{
  console.log('\n（--write を付けると tools/mode/authoring/ へ書き出します。ランタイムへは接続しません）');
}

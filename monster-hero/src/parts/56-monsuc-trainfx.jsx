// ===== モンヒロサクセスのトレーニングの決めの演出: 友情タッグ・大成功・重なり(2026-11-15 社長 r1115-067〜069・案 docs/progress/r1115-067/plan.md を社長 OK) =====
// 何も保存しない・公開の印は持たない(MsxTrainAct と結果の画面の中からだけ呼ぶ)。数は芯の act の結果(out.result・out.card.tags・out.card.tag・out.gain)だけを使う。
//   友情タッグ(tag)   … 桃と水色。光の糸 → 仲間の光の玉が入って光の輪が重なる「タッグフィニッシュ!」。揺らさない。2.1秒
//   大成功(great)     … 金色。暗くなって溜める「ゴゴゴ…!」→ 閃光と衝撃の輪・画面が揺れる「ドォン!!」→「大成功」の叩きつけ。2.3秒
//   重なり(both)      … 仲間の光が集まって金色に変わる → 虹色の輪の「絆の大爆発!!」・揺れ →「大成功」の叩きつけ(ふちが虹色)。2.5秒
//   msxTfxKind(o) / msxTfxMs(o) … どの演出か・場面の長さ(ふつう 2.0秒)
//   MsxTrainFinish({ run, o })   … MsxTrainAct の場面に重ねる決めの部分(音も時間を合わせて鳴らす)
//   MsxTrainResFx({ run, o })    … 結果の画面の場面に重ねる飾り(放射線・ハート・顔つきのリボン・「伸び ×1.5」の札)
//   msxTfxResSound(o)            … 結果の画面の音(重なりは大きい方のファンファーレ、タッグの成功もファンファーレ。ほかは今までどおり)
// 軽さ: 端末の「動きを減らす」は場面を出さない(MsxTrainAct が見る)・結果の飾りは止め絵で出す。
//   設定の画面の軽さが「軽め」「最軽量」なら粒を減らしてぼかしを使わない。「画面の揺れ」がオフなら揺らさない(どちらも読むだけ・mh_battle_fx_v1)
const MSX_TFX_MS = Object.freeze({ base: 2000, tag: 2100, great: 2300, both: 2500 });
// 決めの部分で鳴らす音(場面の id と、場面に入ってからのミリ秒)。はじめのカットインの friendTag は MsxActCrew が鳴らす
// 2026-11-18 社長「友情タッグや大成功はSEも激しく」: 決めの瞬間に、衝撃(当たる音・爆発の連打)と閃光・きらめきを重ねた。新しい音源は入れていない
const MSX_TFX_SE = Object.freeze({
  tag: [['actTagJoin', 1300], ['actTagFin', 1560], ['actHit', 1560], ['actTagSpark', 1640]],
  great: [['actGreatCharge', 1200], ['actGreatBoom', 1500], ['actGreatFlash', 1500], ['actGreatBoom', 1590], ['actHit', 1780], ['actGreatSpark', 1840]],
  both: [['actTagJoin', 1200], ['actGreatCharge', 1300], ['actComboBoom', 1550], ['actGreatBoom', 1580], ['actGreatBoom', 1670], ['actHit', 1920], ['actGreatSpark', 1980]],
});
const msxTfxKind = (o) => {
  if (!o || !o.result) return 'base';
  const tag = !!(o.card && Array.isArray(o.card.tags) && o.card.tags.length > 0);
  const great = o.result === 'great';
  return great && tag ? 'both' : great ? 'great' : tag && o.result !== 'sab' ? 'tag' : 'base';
};
const msxTfxMs = (o) => MSX_TFX_MS[msxTfxKind(o)] || MSX_TFX_MS.base;
const msxTfxResSound = (o) => (msxTfxKind(o) === 'both' ? 'trainGreatTag' : msxTfxKind(o) === 'tag' && o && o.result === 'ok' ? 'trainTag' : null);
// 設定の軽さ(読むだけ。無い・壊れているときは豪華・揺れあり)
const msxTfxOpt = () => {
  let load = 'RICH'; let shake = true;
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem('mh_battle_fx_v1') : null;
    const v = raw ? JSON.parse(raw) : null;
    if (v && typeof v === 'object') { if (typeof v.load === 'string') load = v.load; if (v.shake === 'OFF') shake = false; }
  } catch (e) { /* 読めなければ既定 */ }
  const calm = typeof msxFxCalm === 'function' && msxFxCalm();
  return { lite: calm || load === 'LIGHT' || load === 'MINIMAL', shake: shake && !calm, calm };
};
// タッグの子の置き場所(MsxActCrew と同じ表)から、光の糸・玉の出どころ(場面の % )を作る
const msxTfxFrom = (s, card) => {
  const tags = Array.isArray(card && card.tags) ? card.tags : [];
  const team = s && Array.isArray(s.team) ? s.team : [];
  const ms = (Array.isArray(card && card.members) ? card.members : []).filter((i) => Number.isInteger(i) && team[i] && tags.includes(i));
  const aid = Boolean(card && (card.aid || tags.includes('aid')));
  const SP = typeof MSX_CREW_SPOT_TAG !== 'undefined' ? (aid ? MSX_CREW_SPOT_TAG_AID : MSX_CREW_SPOT_TAG) : [{ left: '22%', bottom: '12%' }, { left: '78%', bottom: '12%' }];
  const pts = ms.slice(0, SP.length).map((_, n) => ({ x: parseFloat(SP[n].left), y: 100 - parseFloat(SP[n].bottom) - 10 }));
  if (tags.includes('aid')) pts.push({ x: 86, y: 66 }); // 助手(右下の全身の絵の胸のあたり)
  if (!pts.length) pts.push({ x: 18, y: 78 });
  return pts.slice(0, 5);
};
const MSX_TFX_COLS = ['#f472b6', '#67e8f9', '#f9a8d4', '#a5f3fc', '#fbcfe8'];
const MSX_TFX_CX = 50; const MSX_TFX_CY = 58; // 育てる子の胸のあたり(場面の %)

const MSX_TFX_CSS = `
.msx .msx-act.tfx-tag .tagcut,.msx .msx-act.tfx-both .tagcut{background:linear-gradient(90deg,#9d174dee,#f472b6f2 28%,#fdf2f8f5 50%,#67e8f9f2 72%,#0e7490ee);border-top-color:#fff;border-bottom-color:#fff;box-shadow:0 0 24px #f9a8d4,0 0 30px #67e8f9aa}
.msx .msx-act.tfx-both .tagcut{border-top-color:#fde047;border-bottom-color:#fde047;box-shadow:0 0 26px #fde047,0 0 34px #f9a8d4;animation-duration:1.05s}
.msx .msx-act.tfx-tag .tagcut .fc,.msx .msx-act.tfx-both .tagcut .fc{border-color:#fff;box-shadow:0 0 0 2px #db2777,0 0 12px #fff}
.msx .msx-act.tfx-tag .tagcut .x,.msx .msx-act.tfx-both .tagcut .x{color:#fff;text-shadow:0 0 6px #db2777}
.msx .msx-act.tfx-tag .tagcut b,.msx .msx-act.tfx-both .tagcut b{-webkit-text-stroke-color:#831843;text-shadow:0 3px 0 #831843,0 0 12px #fff}
.msx .msx-act.tfx-tag .tagcut b small,.msx .msx-act.tfx-both .tagcut b small{color:#831843}
.msx .msx-act.tfx-tag .tagglow,.msx .msx-act.tfx-both .tagglow{background:radial-gradient(circle at 50% 60%,#f9a8d455,#67e8f922 45%,transparent 70%)}
.msx .msx-act.tfx-tag .crew .cm.tag img,.msx .msx-act.tfx-both .crew .cm.tag img{filter:drop-shadow(0 0 6px #f9a8d4) drop-shadow(0 0 12px #67e8f9) drop-shadow(0 3px 0 #0007)}
.msx .msx-act.tfx-tag .crew .cm .tg,.msx .msx-act.tfx-both .crew .cm .tg{color:#831843;background:linear-gradient(#fdf2f8,#f9a8d4)}
.msx .msx-act.tfx-tag .tagstar,.msx .msx-act.tfx-both .tagstar{filter:drop-shadow(0 0 6px #f472b6) drop-shadow(0 0 4px #67e8f9)}
.msx .msx-act.tfx-shake{animation:msxTfxShake .36s linear var(--sk,1.5s) both}
.msx .msx-act.tfx-shake.sk2{animation:msxTfxShake .36s linear var(--sk,1.5s) both,msxTfxShake2 .24s linear var(--sk2,1.75s) both}
.msx .tfx{position:absolute;inset:0;z-index:7;pointer-events:none;overflow:hidden}
.msx .tfx .dim{position:absolute;inset:0;opacity:0;animation:msxTfxDim var(--dd,.8s) ease-out var(--d,1.3s) both}
.msx .tfx .thread{position:absolute;inset:0;width:100%;height:100%;opacity:0;animation:msxTfxThread .8s ease-out .5s both}
.msx .tfx .thread path{fill:none;stroke-linecap:round;vector-effect:non-scaling-stroke;stroke-dasharray:6 1000;stroke-dashoffset:0}
.msx .tfx .thread .glow{stroke-width:9;opacity:.75}
.msx .tfx .thread .core{stroke:#fff;stroke-width:3}
.msx .tfx .hrt{position:absolute;font-style:normal;font-size:var(--fs,18px);opacity:0;filter:drop-shadow(0 0 5px #fff);animation:msxTfxHeart 1.1s ease-out var(--d,.5s) both}
.msx .tfx .orb{position:absolute;width:30px;height:30px;margin:-15px 0 0 -15px;border-radius:50%;opacity:0;background:radial-gradient(#fff 20%,var(--c) 70%);box-shadow:0 0 18px var(--c),0 0 6px #fff;animation:msxTfxOrb .32s ease-in var(--d,1.3s) both}
.msx .tfx .orb.gold{animation-name:msxTfxOrbGold}
.msx .tfx .ring{position:absolute;left:${MSX_TFX_CX}%;top:${MSX_TFX_CY}%;border-radius:50%;opacity:0;transform:translate(-50%,-50%) scale(.2)}
.msx .tfx .ring.kz{width:70vmin;height:70vmin;max-width:330px;max-height:330px;border:6px solid #fff;box-shadow:0 0 22px #f472b6,inset 0 0 22px #67e8f9;animation:msxTfxRing .75s cubic-bezier(.2,.8,.3,1) var(--d,1.6s) both}
.msx .tfx .ring.kz.b{border-color:#fbcfe8;box-shadow:0 0 22px #67e8f9,inset 0 0 18px #f472b6}
.msx .tfx .ring.halo{width:80vmin;height:80vmin;max-width:380px;max-height:380px;background:conic-gradient(#f472b6,#67e8f9,#fff,#f472b6,#67e8f9,#fff,#f472b6);filter:blur(8px);animation:msxTfxHalo .8s ease-out var(--d,1.6s) both}
.msx .tfx .ring.shock{width:86vmin;height:86vmin;max-width:400px;max-height:400px;border:14px solid #fde047;box-shadow:0 0 30px #f59e0b,inset 0 0 30px #fff;animation:msxTfxShock .55s cubic-bezier(.1,.8,.3,1) var(--d,1.5s) both}
.msx .tfx .ring.shock.w{border-width:4px;border-color:#fff9;box-shadow:none;animation-duration:.75s}
.msx .tfx .ring.rainbow{width:90vmin;height:90vmin;max-width:420px;max-height:420px;background:conic-gradient(#fde047,#f472b6,#67e8f9,#fde047,#f472b6,#67e8f9,#fde047);-webkit-mask:radial-gradient(circle,transparent 60%,#000 61%,#000 71%,transparent 72%);mask:radial-gradient(circle,transparent 60%,#000 61%,#000 71%,transparent 72%);animation:msxTfxShock .6s cubic-bezier(.1,.8,.3,1) var(--d,1.55s) both}
.msx .tfx .aura{position:absolute;left:${MSX_TFX_CX}%;top:${MSX_TFX_CY}%;width:64%;height:62%;transform:translate(-50%,-50%);border-radius:50%;opacity:0;background:radial-gradient(#fde047cc,#f59e0b66 45%,transparent 70%);mix-blend-mode:screen;animation:msxTfxAura .3s ease-in var(--d,1.2s) both}
.msx .tfx .aura.mix{background:radial-gradient(#fde047bb,#f472b655 45%,transparent 70%)}
.msx .tfx .speed{position:absolute;inset:-30%;opacity:0;background:repeating-conic-gradient(from 0deg at 50% ${MSX_TFX_CY}%,#000a 0 3deg,#0000 3deg 9deg);-webkit-mask:radial-gradient(circle at 50% ${MSX_TFX_CY}%,transparent 30%,#000 62%);mask:radial-gradient(circle at 50% ${MSX_TFX_CY}%,transparent 30%,#000 62%);animation:msxTfxSpeed .32s linear var(--d,1.2s) both}
.msx .tfx .flash{position:absolute;inset:0;opacity:0;background:radial-gradient(circle at 50% ${MSX_TFX_CY}%,#fff,#fef9c3dd 30%,#fde04766 55%,transparent 80%);animation:msxTfxFlash .45s ease-out var(--d,1.5s) both}
.msx .tfx .flash.mix{background:radial-gradient(circle at 50% ${MSX_TFX_CY}%,#fff,#fde047dd 25%,#f9a8d499 45%,#67e8f966 60%,transparent 82%)}
.msx .tfx .bit{position:absolute;left:${MSX_TFX_CX}%;top:${MSX_TFX_CY}%;font-style:normal;font-size:20px;opacity:0;animation:msxTfxBit .6s cubic-bezier(.1,.7,.3,1) var(--d,1.5s) both}
.msx .tfx .word{position:absolute;left:0;right:0;text-align:center;font-weight:900;white-space:nowrap;opacity:0;line-height:1.1}
.msx .tfx .word.kz{top:6%;font-size:min(38px,9.8vw);letter-spacing:-.04em;font-style:italic;color:#fff;-webkit-text-stroke:2px #831843;paint-order:stroke fill;text-shadow:0 0 14px #f472b6,0 0 22px #67e8f9;animation:msxTfxWord .55s cubic-bezier(.2,1.4,.4,1) var(--d,1.6s) both}
.msx .tfx .word.gg{top:7%;font-size:min(30px,7.6vw);color:#fde047;text-shadow:0 0 10px #f59e0b,0 3px 0 #7c2d12;animation:msxTfxGogo var(--wd,.3s) linear var(--d,1.2s) both}
.msx .tfx .word.don{top:5%;font-size:min(46px,11.6vw);color:#fff;-webkit-text-stroke:3px #9a3412;paint-order:stroke fill;text-shadow:0 0 20px #fde047;animation:msxTfxDon var(--wd,.28s) ease-out var(--d,1.5s) both}
.msx .tfx .word.don.mix{font-size:min(40px,10vw);text-shadow:0 0 18px #fde047,0 0 26px #f472b6}
.msx .tfx .word.mn{top:7%;font-size:min(24px,6.2vw);color:#fff;text-shadow:0 0 10px #f472b6,0 0 14px #fde047,0 2px 0 #0008;animation:msxTfxGogo var(--wd,.35s) linear var(--d,1.2s) both}
.msx .tfx .slam{position:absolute;left:0;right:0;top:9%;text-align:center;font-size:min(80px,20vw);font-weight:900;letter-spacing:.06em;line-height:1;white-space:nowrap;color:#fde047;-webkit-text-stroke:3px #9a3412;paint-order:stroke fill;text-shadow:0 6px 0 #9a3412,0 0 40px #fde047;opacity:0;animation:msxTfxSlam .6s cubic-bezier(.3,0,.3,1) var(--d,1.7s) both}
.msx .tfx .slam.mix{text-shadow:0 6px 0 #9a3412,0 0 26px #f472b6,0 0 40px #67e8f9,0 0 50px #fde047}
.msx .tfx .rays{position:absolute;inset:-40%;opacity:0;background:repeating-conic-gradient(from 6deg at 50% 50%,#fde047a0 0 7deg,#0000 7deg 15deg);animation:msxTfxRays .6s ease-out var(--d,1.7s) both}
.msx .tfx.lite .ring.halo,.msx .tfx.lite .thread .glow{filter:none;display:none}
@keyframes msxTfxDim{to{opacity:1}}
@keyframes msxTfxThread{0%{opacity:0}25%{opacity:1}85%{opacity:1}100%{opacity:0}}
@keyframes msxTfxHeart{0%{opacity:0;transform:scale(.3)}30%{opacity:1;transform:scale(1.15)}100%{opacity:0;transform:translateY(-34px) scale(.8)}}
@keyframes msxTfxOrb{0%{opacity:0;transform:scale(.4)}25%{opacity:1;transform:scale(1.1)}100%{opacity:1;left:${MSX_TFX_CX}%;top:${MSX_TFX_CY}%;transform:scale(.6)}}
@keyframes msxTfxOrbGold{0%{opacity:0;transform:scale(.4)}25%{opacity:1;transform:scale(1.1)}100%{opacity:1;left:${MSX_TFX_CX}%;top:${MSX_TFX_CY}%;transform:scale(.7);background:radial-gradient(#fff 20%,#fde047 70%);box-shadow:0 0 22px #fde047}}
@keyframes msxTfxRing{0%{opacity:0;transform:translate(-50%,-50%) scale(.15)}25%{opacity:1}100%{opacity:0;transform:translate(-50%,-50%) scale(1.1)}}
@keyframes msxTfxHalo{0%{opacity:0;transform:translate(-50%,-50%) scale(.3) rotate(0)}35%{opacity:.6}100%{opacity:0;transform:translate(-50%,-50%) scale(1.15) rotate(120deg)}}
@keyframes msxTfxShock{0%{opacity:1;transform:translate(-50%,-50%) scale(.1)}70%{opacity:.9}100%{opacity:0;transform:translate(-50%,-50%) scale(1.3)}}
@keyframes msxTfxAura{0%{opacity:0;transform:translate(-50%,-50%) scale(.6)}100%{opacity:1;transform:translate(-50%,-50%) scale(1.05)}}
@keyframes msxTfxSpeed{0%{opacity:0;transform:scale(1.25)}100%{opacity:1;transform:scale(1)}}
@keyframes msxTfxFlash{0%{opacity:0}15%{opacity:1}100%{opacity:0}}
@keyframes msxTfxBit{0%{opacity:1;transform:translate(-50%,-50%) scale(.6)}100%{opacity:0;transform:translate(calc(-50% + var(--x)),calc(-50% + var(--y))) rotate(var(--r)) scale(1)}}
@keyframes msxTfxWord{0%{opacity:0;transform:scale(.4)}60%{opacity:1;transform:scale(1.08)}85%{opacity:1;transform:scale(1)}100%{opacity:1}}
@keyframes msxTfxGogo{0%{opacity:0;transform:translateX(-3px)}15%{opacity:1;transform:translateX(3px)}30%{transform:translateX(-3px)}45%{transform:translateX(3px)}60%{transform:translateX(-2px)}85%{opacity:1;transform:none}100%{opacity:0}}
@keyframes msxTfxDon{0%{opacity:0;transform:scale(2.2)}30%{opacity:1;transform:scale(.95)}45%{transform:scale(1)}85%{opacity:1}100%{opacity:0;transform:scale(1.15)}}
@keyframes msxTfxSlam{0%{opacity:0;transform:rotate(-4deg) scale(2.6)}35%{opacity:1;transform:rotate(-4deg) scale(.92)}50%{transform:rotate(-4deg) scale(1.04)}100%{opacity:1;transform:rotate(-4deg) scale(1)}}
@keyframes msxTfxRays{0%{opacity:0;transform:rotate(0)}100%{opacity:1;transform:rotate(14deg)}}
@keyframes msxTfxShake{0%,100%{translate:0 0}10%{translate:9px -6px}25%{translate:-8px 5px}40%{translate:7px 4px}55%{translate:-6px -5px}70%{translate:4px 3px}85%{translate:-2px -2px}}
@keyframes msxTfxShake2{0%,100%{translate:0 0}25%{translate:-5px 4px}50%{translate:4px -3px}75%{translate:-2px 2px}}
/* 結果の画面の飾り */
.msx .v-tfx{position:absolute;inset:0;z-index:0;pointer-events:none;overflow:hidden}
.msx .v-tfx .grays{position:absolute;inset:-40%;background:repeating-conic-gradient(from 6deg at 50% 46%,#fde04770 0 7deg,#0000 7deg 15deg);animation:msxTfxSpin 18s linear infinite}
.msx .v-tfx .pastel{position:absolute;inset:0;background:radial-gradient(circle at 50% 46%,#f9a8d455,#67e8f933 50%,transparent 76%)}
.msx .v-tfx .gstar{position:absolute;font-style:normal;color:#fef9c3;font-size:18px;text-shadow:0 0 8px #fde047,0 0 16px #f59e0b;animation:msxTfxTwinkle 1.4s ease-in-out infinite alternate;animation-delay:calc(var(--i) * .17s)}
.msx .v-tfx .rhrt{position:absolute;font-style:normal;font-size:var(--fs,18px);filter:drop-shadow(0 0 5px #fff);animation:msxTfxFloat 2.4s ease-in-out infinite alternate;animation-delay:calc(var(--i) * .23s)}
.msx .v-tfxtop{position:absolute;inset:0;z-index:4;pointer-events:none}
.msx .v-tfx-rib{position:absolute;left:0;right:0;margin:0 auto;width:max-content;top:calc(9% + 66px);transform:rotate(-3deg);display:flex;align-items:center;gap:6px;max-width:calc(100% - 20px);padding:4px 14px 4px 5px;border-radius:99px;background:linear-gradient(90deg,#db2777,#f9a8d4 45%,#67e8f9 55%,#0891b2);border:2.5px solid #fff;box-shadow:0 0 16px #f9a8d4,0 3px 0 #0006;color:#fff;font-weight:900;font-size:15px;white-space:nowrap;text-shadow:0 1px 0 #831843,0 0 4px #831843;animation:msxTfxRib .45s cubic-bezier(.2,1.4,.4,1) .15s both}
.msx .v-tfx-rib.both{border-color:#fde047;box-shadow:0 0 16px #fde047,0 0 22px #f9a8d4,0 3px 0 #0006}
.msx .v-tfx-rib .fcs{display:flex;flex:none}
.msx .v-tfx-rib .fcs img{width:34px;height:34px;border-radius:50%;object-fit:cover;background:#fff;border:2px solid #fff;margin-right:-8px;box-shadow:0 0 0 1.5px #db2777}
.msx .v-tfx-rib .fcs img:last-child{margin-right:0}
.msx .v-tfx-rib .t{overflow:hidden;text-overflow:ellipsis;min-width:0}
.msx .v-tfx-rib .pct{margin-left:3px;padding:0 8px;border-radius:99px;background:#831843c9;font-size:16px;text-shadow:none;white-space:nowrap}
/* 結果を開いた瞬間の大きな名乗り(2026-11-18 社長: タッグの見せ方を大きく)。軽減時は出さない(呼ぶ側で抑え、静かなリボンだけ残る) */
.msx .v-tfx-flash{position:absolute;left:0;right:0;top:30%;z-index:6;text-align:center;font-size:min(43px,10.8vw);font-weight:900;font-style:italic;letter-spacing:.02em;color:#fff;-webkit-text-stroke:2px #831843;paint-order:stroke fill;text-shadow:0 0 16px #f472b6,0 0 26px #67e8f9,0 4px 0 #831843;opacity:0;pointer-events:none;animation:msxTfxTagWord 1.3s cubic-bezier(.2,1.3,.4,1) .12s both}
@keyframes msxTfxTagWord{0%{opacity:0;transform:scale(2.3) rotate(-5deg)}16%{opacity:1;transform:scale(.95) rotate(-3deg)}26%{transform:scale(1) rotate(-3deg)}76%{opacity:1}100%{opacity:0;transform:scale(1.03) rotate(-3deg) translateY(-8px)}}
.msx .v-tfx-badge{position:absolute;right:12px;top:calc(9% - 6px);font-weight:900;color:#7c2d12;background:linear-gradient(#fef9c3,#facc15 60%,#f59e0b);border:2.5px solid #fff;border-radius:10px;padding:1px 9px;font-size:15px;line-height:1.35;white-space:nowrap;box-shadow:0 0 14px #fde047,0 3px 0 #0007;transform:rotate(8deg);animation:msxTfxBadge .4s cubic-bezier(.2,1.6,.4,1) .3s both}
.msx .v-stamp.tfx-gold{font-size:60px;animation:msx-popin .35s cubic-bezier(.2,1.4,.4,1),msxTfxStampGlow 1.6s ease-in-out .4s infinite alternate}
.msx .v-stamp.tfx-both{-webkit-text-stroke:2px #9a3412;text-shadow:0 4px 0 #9a3412,0 0 18px #f472b6,0 0 30px #67e8f9,0 0 46px #fde047}
@keyframes msxTfxSpin{to{transform:rotate(360deg)}}
@keyframes msxTfxTwinkle{from{opacity:.25;transform:scale(.7)}to{opacity:1;transform:scale(1.15)}}
@keyframes msxTfxFloat{from{transform:translateY(0)}to{transform:translateY(-10px)}}
@keyframes msxTfxRib{from{opacity:0;transform:rotate(-3deg) scale(.5)}to{opacity:1;transform:rotate(-3deg)}}
@keyframes msxTfxBadge{from{opacity:0;transform:rotate(8deg) scale(2)}to{opacity:1;transform:rotate(8deg)}}
@keyframes msxTfxStampGlow{from{filter:brightness(1)}to{filter:brightness(1.18) drop-shadow(0 0 10px #fde047)}}
.msx .v-tfx.calm *,.msx .v-tfxtop.calm *,.msx .v-stamp.tfx-gold.calm{animation:none!important}
`;
let msxTfxCssDone = false;
const msxTfxEnsureCss = () => {
  if (msxTfxCssDone || typeof document === 'undefined') return;
  msxTfxCssDone = true;
  const el = document.createElement('style'); el.setAttribute('data-msx-tfx-css', '1'); el.textContent = MSX_TFX_CSS; document.head.appendChild(el);
};
// MsxTrainAct の外側の箱に足す class と style(色替え・揺れ)
const msxTfxActProps = (o) => {
  const k = msxTfxKind(o); if (k === 'base') return { cls: '', style: undefined };
  const op = msxTfxOpt();
  const shake = op.shake && (k === 'great' || k === 'both');
  return { cls: ` tfx-${k}${shake ? ' tfx-shake sk2' : ''}`, style: shake ? (k === 'both' ? { '--sk': '1.55s', '--sk2': '1.92s' } : { '--sk': '1.5s', '--sk2': '1.78s' }) : undefined };
};
const msxTfxHearts = (n, d0, y0) => Array.from({ length: n }, (_, i) => (
  <i key={`h${i}`} className="hrt" style={{ left: `${8 + ((i * 37) % 84)}%`, top: `${y0 + ((i * 23) % 40)}%`, '--fs': `${15 + (i % 3) * 5}px`, '--d': `${(d0 + i * 0.07).toFixed(2)}s` }}>{i % 2 ? '💞' : '💗'}</i>));
const msxTfxBits = (n, d, em) => Array.from({ length: n }, (_, i) => {
  const a = (i / n) * Math.PI * 2; const r = 120 + (i % 3) * 30;
  return <i key={`b${i}`} className="bit" style={{ '--x': `${Math.round(Math.cos(a) * r)}px`, '--y': `${Math.round(Math.sin(a) * r)}px`, '--r': `${(i * 67) % 180}deg`, '--d': `${d}s` }}>{em[i % em.length]}</i>;
});

function MsxTrainFinish({ run, o }) {
  msxTfxEnsureCss();
  const k = msxTfxKind(o);
  const op = msxTfxOpt();
  if (typeof msxUseTimedSe === 'function') msxUseTimedSe(op.calm ? [] : (MSX_TFX_SE[k] || []), []);
  if (k === 'base' || op.calm) return null;
  const pts = k === 'great' ? [] : msxTfxFrom(run && run.s, o.card);
  const lite = op.lite;
  const threads = pts.length ? (
    <svg className="thread" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
      {pts.map((p, i) => { const c = MSX_TFX_COLS[i % MSX_TFX_COLS.length]; const d = `M${p.x} ${p.y} Q${(p.x + MSX_TFX_CX) / 2} ${Math.min(p.y, MSX_TFX_CY) - 18} ${MSX_TFX_CX} ${MSX_TFX_CY}`; return (
        <g key={i}><path className="glow" d={d} stroke={c}/><path className="core" d={d}/></g>); })}
    </svg>) : null;
  const orbs = (d, gold) => pts.map((p, i) => <i key={`o${i}`} className={`orb${gold ? ' gold' : ''}`} style={{ left: `${p.x}%`, top: `${p.y}%`, '--c': MSX_TFX_COLS[i % MSX_TFX_COLS.length], '--d': `${(d + i * 0.04).toFixed(2)}s` }}/>);
  let body = null;
  if (k === 'tag') {
    body = (<>
      {threads}{msxTfxHearts(lite ? 3 : 6, 0.55, 30)}
      <span className="dim" style={{ background: '#1e0b2e8c', '--d': '1.3s', '--dd': '.3s' }}/>
      {orbs(1.3, false)}
      {lite ? null : <span className="ring halo" style={{ '--d': '1.56s' }}/>}
      <span className="ring kz" style={{ '--d': '1.56s' }}/><span className="ring kz b" style={{ '--d': '1.72s' }}/>
      <b className="word kz" style={{ '--d': '1.56s' }}>タッグフィニッシュ!</b>
      {msxTfxHearts(lite ? 2 : 5, 1.62, 52)}
    </>);
  } else if (k === 'great') {
    body = (<>
      <span className="dim" style={{ background: '#000b', '--d': '1.2s', '--dd': '.25s' }}/>
      <span className="speed" style={{ '--d': '1.2s' }}/>
      <span className="aura" style={{ '--d': '1.2s' }}/>
      <b className="word gg" style={{ '--d': '1.2s' }}>ゴゴゴゴ…!</b>
      <span className="flash" style={{ '--d': '1.5s' }}/>
      <span className="ring shock" style={{ '--d': '1.5s' }}/>{lite ? null : <span className="ring shock w" style={{ '--d': '1.55s' }}/>}
      {msxTfxBits(lite ? 5 : 10, 1.5, ['🪨', '✨', '💥'])}
      <b className="word don" style={{ '--d': '1.5s' }}>ドォン!!</b>
      <span className="rays" style={{ '--d': '1.78s' }}/>
      <b className="slam" style={{ '--d': '1.78s' }}>大成功</b>
    </>);
  } else {
    body = (<>
      {threads}
      <span className="dim" style={{ background: '#000a', '--d': '1.2s', '--dd': '.3s' }}/>
      <span className="speed" style={{ '--d': '1.2s' }}/>
      <span className="aura mix" style={{ '--d': '1.25s' }}/>
      {orbs(1.2, true)}
      <b className="word mn" style={{ '--d': '1.2s', '--wd': '.35s' }}>みんなの力が 1つに…!</b>
      <span className="flash mix" style={{ '--d': '1.55s' }}/>
      <span className="ring rainbow" style={{ '--d': '1.55s' }}/>{lite ? null : <span className="ring shock" style={{ '--d': '1.6s' }}/>}
      {msxTfxBits(lite ? 5 : 10, 1.55, ['💗', '✨', '💥', '💞'])}
      <b className="word don mix" style={{ '--d': '1.55s', '--wd': '.37s' }}>絆の大爆発!!</b>
      <span className="rays" style={{ '--d': '1.92s' }}/>
      <b className="slam mix" style={{ '--d': '1.92s' }}>大成功</b>
    </>);
  }
  return <div className={`tfx${lite ? ' lite' : ''}`} aria-hidden="true" data-msx-tfx={k}>{body}</div>;
}

// 結果の画面: 場面の奥(放射線・ハート・星)と手前(リボン・札)。判子の字は呼ぶ側
function MsxTrainResFx({ run, o, layer }) {
  msxTfxEnsureCss();
  const k = msxTfxKind(o);
  if (k === 'base') return null;
  const op = msxTfxOpt();
  const s = run && run.s; const card = (o && o.card) || {};
  const tags = Array.isArray(card.tags) ? card.tags : [];
  const calm = op.calm ? ' calm' : '';
  if (layer === 'back') {
    return (
      <div className={`v-tfx${calm}`} aria-hidden="true" data-msx-tfx-res={k}>
        {k !== 'tag' ? <span className="grays"/> : null}
        {k !== 'great' ? <span className="pastel"/> : null}
        {k !== 'tag' ? Array.from({ length: op.lite ? 4 : 9 }, (_, i) => <i key={`s${i}`} className="gstar" style={{ '--i': i, left: `${6 + ((i * 41) % 86)}%`, top: `${26 + ((i * 29) % 44)}%` }}>✦</i>) : null}
        {k !== 'great' ? Array.from({ length: op.lite ? 3 : 6 }, (_, i) => <i key={`h${i}`} className="rhrt" style={{ '--i': i, '--fs': `${14 + (i % 3) * 5}px`, left: `${5 + ((i * 53) % 88)}%`, top: `${30 + ((i * 31) % 42)}%` }}>{i % 2 ? '💞' : '💗'}</i>) : null}
      </div>);
  }
  // 手前: 顔つきのリボン(タッグ)・「伸び ×1.5」の札(大成功)。数は芯の結果から
  const team = s && Array.isArray(s.team) ? s.team : [];
  const thumb = (sp) => (typeof msxMonThumb === 'function' ? msxMonThumb(sp) : typeof msxMonImg === 'function' ? msxMonImg(sp) : '');
  // リボンの顔は切り取り方式で出す(染色も全身絵から焼く)。部品が無いときは今までどおり顔アイコンの絵
  const faceNode = (sp, colors) => (!sp || !thumb(sp) ? null : (typeof MsxMonFace === 'function' ? <MsxMonFace species={sp} colors={colors}/> : <img src={thumb(sp)} alt=""/>));
  const faces = [faceNode(s && s.species, run && run.colors)].concat(tags.filter((i) => Number.isInteger(i) && team[i]).slice(0, 3).map((i) => faceNode(team[i].species, team[i].colors)));
  if (tags.includes('aid') && typeof msxFace === 'function' && s) { const af = msxFace(s.aid, 'happy'); if (af) faces.push(<img src={af} alt=""/>); }
  const tagPct = Number.isFinite(card.tag) ? Math.round(card.tag * 100) : 0;
  const R = typeof msxSuc !== 'undefined' && msxSuc && msxSuc.SUC && msxSuc.SUC.RESULTS ? msxSuc.SUC.RESULTS : null;
  const gm = R && R.great && Number.isFinite(R.great.mult) ? R.great.mult : 1.5;
  return (
    <div className={`v-tfxtop${calm}`} data-msx-tfx-top={k}>
      {!op.calm && k !== 'great' ? <div className="v-tfx-flash" aria-hidden="true">🤝 友情タッグ！</div> : null}
      {k !== 'great' ? <div className={`v-tfx-rib${k === 'both' ? ' both' : ''}`} data-msx-tfx-rib={tags.length}><span className="fcs">{faces.filter(Boolean).slice(0, 5).map((f, i) => <React.Fragment key={i}>{f}</React.Fragment>)}</span><span className="t">🤝 友情タッグ ×{tags.length}</span>{tagPct > 0 ? <b className="pct">伸び +{tagPct}%</b> : null}</div> : null}
      {k !== 'tag' ? <div className="v-tfx-badge" data-msx-tfx-badge={gm}>伸び ×{gm}</div> : null}
    </div>);
}

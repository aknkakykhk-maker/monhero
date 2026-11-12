// ===== 試合の画面: 場 MsaStage(共通)と モンヒロサクセスの MonsucArena(2026-11-12 社長「モンサクは自分操作にして」) =====
// 社長「バトルはモンバトやバトルカードの画面をある程度流用して、距離とかうまく使ったほうがいい。攻撃アクションとかもそのまま使えるはず」。
//   ・場は横長。手前の子(A)が左・相手(B)が右に立ち、距離 零・近・中・遠 の4つの立ち位置で、実際に間が開いたり詰まったりする
//   ・技の動きは 24-battle-fx.jsx の SkillFxMotion・SKILL_MOTION_SETS をそのまま使う(新しい動きは作らない)。
//     モンヒロに同じ名前の技があればその子の動き、無ければカードバトルと同じ決まった動き(85 の cardMotionTiered)
//   ・受ける・防ぐ・よける・倒れるは、カードバトルの CSS(mh-card-hit / guard / dodge / ko)。止まっている間は待機アニメ(withMonsterIdleArt)
//   ・自分で操作する試合は、芯 createMatch を進める useMsxManualMatch と帯 MsxManualBar(56-monhero-success-manual.jsx)を下に差す。
//     手を選ぶ → 伸びた記録(自分の手 → 相手の手)を1行ずつ見せる → 見せ終わったら次の手番(見せている間、帯は押せない)
//   ・記録だけ渡されたとき(回3の結果・オート)は、同じ画面で記録を再生する
//   ・動きを減らす設定(端末の prefers-reduced-motion)では、技の動き・揺れ・間合いの移動を止め、1行の間も短くする
//   ・2026-11-12 社長「音もないし音楽もホームの音楽だし味気なさすぎる。ちゃんとバトル部分作りこんで」:
//     場は共通の部品 MsaStage にして、助手マスモン対戦 β の観戦も同じ場を使う。効果音(Audio_.fgSe)・バトルの曲(useMhBattleBgmHold → 60-app)・
//     技の名前の帯に命中%・大技(消費ガッツ40以上)の金の帯と揺れ・会心の白い光・ガッツの増減・KO・勝ち/負けの印
//   ・2026-11-12 社長「バトル演出はもっとアクセントもつけて迫力とか見ごたえとかあるようにして」:
//     大技の前のため(場が暗くなり溜めの光・一瞬の静止)/当たった瞬間のヒットストップ(場の動きを数十ミリ秒止める)と揺れの強弱/
//     ダメージ数字の大きさを威力で変える/会心は白い閃光とカットイン/とどめはスローと「K.O.」/間合いの移動に土煙/
//     ガッツが尽きかけたら息切れ/勝ち負けの印を大きく。動きを減らす設定では、ため・止め・揺れ・閃光・土煙を出さない(音は鳴る)
// 計算・保存には触れない(勝ち負けを onEnd で返すだけ)。公開の印 monheroSuccess の後ろで使う。
const MSA_GAP = [0.13, 0.32, 0.5, 0.68];            // 距離ごとの、2体の間(場の幅に対する割合)。零は触れ合うほど
const MSA_SPEEDS = Object.freeze([{ id: 'x1', label: '×1', f: 1 }, { id: 'x2', label: '×2', f: 0.55 }, { id: 'x4', label: '×4', f: 0.3 }]);
const MSA_CSS = `
.msa{display:flex;flex-direction:column;gap:6px}
.msa-stage{position:relative;height:clamp(200px,34vh,290px);border-radius:16px;overflow:hidden;background:#2a2147 center/cover no-repeat}
.msa-stage::after{content:'';position:absolute;inset:0;z-index:0;background:linear-gradient(180deg,rgba(20,16,38,.05),rgba(20,16,38,.5));pointer-events:none}
.msa-floor{position:absolute;left:4%;right:4%;bottom:30px;height:2px;background:linear-gradient(90deg,#fff0,#ffffff55 20%,#ffffff55 80%,#fff0);z-index:1}
.msa-spot{position:absolute;bottom:23px;width:16px;height:16px;margin-left:-8px;border-radius:50%;border:2px solid #ffffff40;background:#0f0b2280;z-index:1;transition:all .35s}
.msa-spot.on{border-color:#fde047;background:#fde04766;box-shadow:0 0 10px #fde047aa}
.msa-f{position:absolute;bottom:30px;width:96px;margin-left:-48px;height:120px;display:flex;align-items:flex-end;justify-content:center;z-index:3;transition:left .45s cubic-bezier(.3,.8,.4,1)}
.msa-f.act{z-index:6}
.msa-f img.msa-img{max-width:96px;max-height:112px;object-fit:contain;filter:drop-shadow(0 6px 5px rgba(0,0,0,.55))}
.msa-f .msa-flip{transform:scaleX(-1)}
.msa-f .msa-shadow{position:absolute;bottom:-5px;left:50%;width:62px;height:11px;margin-left:-31px;border-radius:50%;background:#0008;z-index:-1}
.msa-f.down img.msa-img{filter:grayscale(1) brightness(.6)}
.msa-dmg{position:absolute;z-index:8;top:24%;left:50%;width:130px;margin-left:-65px;text-align:center;font-size:30px;font-weight:900;color:#fde047;line-height:.95;text-shadow:0 2px 0 #b91c1c,0 0 8px #f97316;animation:msaPop .55s ease-out both;pointer-events:none}
.msa-dmg small{display:block;font-size:12px;color:#fff;margin-bottom:2px}
.msa-dmg.miss{color:#e2e8f0;font-size:20px;text-shadow:0 2px 0 #0f172a}
.msa-tag{position:absolute;z-index:8;top:-4px;left:50%;transform:translateX(-50%);white-space:nowrap;border-radius:99px;padding:2px 9px;font-size:11.5px;font-weight:900;background:#0f172acc;border:1px solid #fde04788;color:#fde68a;animation:msaPop .4s ease-out both}
.msa-charge{animation:msaCharge .7s ease-out both}
.msa-aura{position:absolute;left:50%;bottom:0;width:90px;height:90px;margin-left:-45px;border-radius:50%;background:radial-gradient(circle,#fde04788 0,#f9731644 45%,#f9731600 70%);animation:msaAura .7s ease-out both;z-index:-1;pointer-events:none}
.msa-sulk{animation:msaSulk .7s ease-in-out both}
.msa-step{animation:msaStep .45s ease-out both}
.msa-in{animation:msaIn .45s ease-out both}
.msa-dist{position:absolute;left:0;right:0;bottom:4px;display:flex;justify-content:center;gap:5px;z-index:2}
.msa-dist span{font-size:11px;font-weight:900;padding:1px 9px;border-radius:99px;background:#0f0b2299;color:#94a3b8;transition:all .3s}
.msa-dist span.cur{background:#fde047;color:#422006}
.msa-round{position:absolute;left:8px;top:6px;z-index:2;font-size:11px;font-weight:900;color:#fde68a;background:#0f0b2299;border-radius:99px;padding:1px 8px}
.msa-say{min-height:22px;font-size:12.5px;font-weight:800;text-align:center;color:#fff}
.msa-tools{display:flex;gap:5px;align-items:center}
.msa-tools button{flex:1;min-height:34px;border-radius:10px;border:1px solid #4c4680;background:#2b2650;color:#fff;font-weight:900;font-size:12px}
.msa-tools button.on{background:#fde047;color:#422006;border-color:#fde047}
.msa-wait{font-size:11.5px;color:#cbd5e1;text-align:center}
.msa-gtag{position:absolute;z-index:8;bottom:-16px;left:50%;transform:translateX(-50%);white-space:nowrap;border-radius:99px;padding:0 7px;font-size:10.5px;font-weight:900;line-height:16px;animation:msaPop .45s ease-out both}
.msa-gtag.up{background:#facc15;color:#422006}.msa-gtag.down{background:#334155;color:#e2e8f0}
.msa-ko{--msa-tx:-50%;--msa-r:-8deg;position:absolute;z-index:8;top:28%;left:50%;transform:translateX(-50%) rotate(-8deg);font-size:30px;font-weight:900;color:#fff;letter-spacing:.06em;-webkit-text-stroke:2px #b91c1c;text-shadow:0 3px 0 #7f1d1d;animation:msaStamp .5s cubic-bezier(.2,1.6,.4,1) both;pointer-events:none}
.msa-shk{position:absolute;inset:0;z-index:1}
.msa-shk.shake{animation:msaShake .42s ease-out both}
.msa-flash{position:absolute;inset:0;z-index:7;background:#fff;opacity:0;pointer-events:none;animation:msaFlash .32s ease-out both}
.ambw-cut.big{top:6px;left:-6px;right:-6px;padding:6px 18px;background:linear-gradient(90deg,#f59e0b00,#f59e0b 12%,#b45309 50%,#f59e0b 88%,#f59e0b00)!important;text-align:center;border-top:2px solid #fde68a;border-bottom:2px solid #fde68a}
.ambw-cut.big b{font-size:24px;color:#fff;-webkit-text-stroke:1px #78350f}
.msa-end{position:absolute;inset:0;z-index:9;display:flex;flex-direction:column;align-items:center;justify-content:center;background:radial-gradient(circle,#000b,#0004 75%);pointer-events:none}
.msa-end b{font-size:46px;font-weight:900;letter-spacing:.08em;animation:msaStamp .55s cubic-bezier(.2,1.6,.4,1) both}
.msa-end.w b{color:#fde047;-webkit-text-stroke:2px #92400e;text-shadow:0 0 18px #fde047aa,0 4px 0 #92400e}
.msa-end.l b{color:#e2e8f0;-webkit-text-stroke:2px #334155;text-shadow:0 4px 0 #1e293b}
.msa-end small{margin-top:4px;font-size:12px;font-weight:900;color:#fff;background:#0f172acc;border-radius:99px;padding:2px 10px}
/* ---- アクセント(2026-11-12 社長「迫力とか見ごたえとか」) ---- */
.msa-dim{position:absolute;inset:0;z-index:2;background:radial-gradient(circle at var(--msa-cx,30%) 70%,#0000 0,#0003 16%,#000d 55%);pointer-events:none;animation:msaDim var(--msa-pre,420ms) ease-out both}
.msa-aura.big{width:150px;height:150px;margin-left:-75px;background:radial-gradient(circle,#fff7 0,#fde047aa 22%,#f97316 45%,#f9731600 70%);animation:msaAuraBig var(--msa-pre,420ms) ease-in both}
.msa-chargebig{animation:msaChargeBig var(--msa-pre,420ms) ease-in both}
.msa-dmg.t1{font-size:22px}.msa-dmg.t2{font-size:30px}.msa-dmg.t3{font-size:40px;animation-name:msaPopBig}
.msa-dmg.t4{font-size:52px;color:#fff;text-shadow:0 3px 0 #b91c1c,0 0 14px #f97316,0 0 26px #fde047;animation-name:msaPopBig}
.msa-dmg.t4 small{font-size:14px;color:#fde047}
.msa-shk.shake.s1{animation-name:msaShake1}.msa-shk.shake.s3{animation:msaShake3 .6s ease-out both}
.msa-critcut{position:absolute;z-index:8;left:-10%;right:-10%;top:38%;height:46px;display:flex;align-items:center;justify-content:center;transform:rotate(-7deg);background:linear-gradient(90deg,#fff0,#fff 18%,#fef08a 50%,#fff 82%,#fff0);pointer-events:none;animation:msaCritCut .75s cubic-bezier(.2,.9,.3,1) both}
.msa-critcut b{font-size:28px;font-weight:900;color:#b91c1c;letter-spacing:.12em;-webkit-text-stroke:1px #7f1d1d;text-shadow:0 2px 0 #fff}
.msa-flash.big{animation:msaFlashBig .5s ease-out both}
.msa-flash.fin{animation:msaFlashFin .45s ease-out both}
@keyframes msaFlashFin{0%{opacity:.55}100%{opacity:0}}
.msa-fin{position:absolute;inset:0;z-index:2;pointer-events:none;background:radial-gradient(circle,#fff0 30%,#7f1d1d66 100%);animation:msaFin .9s ease-out both}
.msa-ko.big{font-size:54px;top:22%;-webkit-text-stroke:3px #b91c1c;text-shadow:0 4px 0 #7f1d1d,0 0 22px #f97316}
.msa-burst{position:absolute;z-index:7;left:50%;top:44%;width:260px;height:260px;margin:-130px 0 0 -130px;border-radius:50%;background:repeating-conic-gradient(#fde04700 0 7deg,#fde04799 7deg 10deg);-webkit-mask:radial-gradient(circle,#0000 22%,#000 30%,#0000 70%);mask:radial-gradient(circle,#0000 22%,#000 30%,#0000 70%);pointer-events:none;animation:msaBurst .8s ease-out both}
.msa-f.slowko .mh-card-ko{animation-duration:1.5s!important}
.msa-dust{position:absolute;z-index:4;bottom:-4px;width:34px;height:18px;border-radius:50%;background:radial-gradient(circle,#e7d7b8cc,#e7d7b800 70%);pointer-events:none;animation:msaDust .6s ease-out both}
.msa-pant{position:absolute;z-index:7;top:6px;right:-6px;font-size:10.5px;font-weight:900;color:#bae6fd;background:#0f172acc;border-radius:99px;padding:0 6px;line-height:16px;white-space:nowrap;animation:msaPant 1.2s ease-in-out infinite}
.msa-f.tired img.msa-img{animation:msaTired 1.4s ease-in-out infinite}
.msa-end b{font-size:64px}
.msa-end .msa-rays{position:absolute;left:50%;top:50%;width:420px;height:420px;margin:-210px 0 0 -210px;border-radius:50%;background:repeating-conic-gradient(#fde04700 0 9deg,#fde04733 9deg 18deg);-webkit-mask:radial-gradient(circle,#000 20%,#0000 68%);mask:radial-gradient(circle,#000 20%,#0000 68%);animation:msaRays 6s linear infinite;z-index:-1}
.msa-end.l .msa-rays{display:none}
.msa-end .msa-ribbon{margin-top:2px;font-size:13px;font-weight:900;letter-spacing:.3em;color:#422006;background:linear-gradient(90deg,#fde04700,#fde047 20%,#fde047 80%,#fde04700);padding:2px 40px;animation:msaIn .5s .25s ease-out both}
.msa-end.l .msa-ribbon{color:#e2e8f0;background:linear-gradient(90deg,#33415500,#334155 20%,#334155 80%,#33415500)}
@keyframes msaDim{0%{opacity:0}35%{opacity:1}85%{opacity:1}100%{opacity:0}}
@keyframes msaAuraBig{0%{opacity:0;transform:scale(1.6)}70%{opacity:1;transform:scale(.8)}88%{opacity:1;transform:scale(.8)}100%{opacity:0;transform:scale(1.9)}}
@keyframes msaChargeBig{0%{transform:none}60%{transform:translateY(5px) scale(1.08,.9)}85%{transform:translateY(5px) scale(1.08,.9)}100%{transform:none}}
@keyframes msaPopBig{0%{opacity:0;transform:translateY(14px) scale(.4)}30%{opacity:1;transform:translateY(-10px) scale(1.35)}50%{transform:translateY(-4px) scale(.95)}70%{transform:translateY(-12px) scale(1.06)}100%{opacity:1;transform:translateY(-14px) scale(1)}}
@keyframes msaShake1{0%,100%{transform:none}30%{transform:translate(-3px,1px)}60%{transform:translate(2px,-1px)}}
@keyframes msaShake3{0%,100%{transform:none}10%{transform:translate(-12px,5px) scale(1.03)}25%{transform:translate(10px,-5px) scale(1.03)}40%{transform:translate(-8px,3px)}55%{transform:translate(6px,-2px)}70%{transform:translate(-4px,1px)}85%{transform:translate(2px,0)}}
@keyframes msaCritCut{0%{opacity:0;transform:rotate(-7deg) scaleY(0)}18%{opacity:1;transform:rotate(-7deg) scaleY(1.15)}30%{transform:rotate(-7deg) scaleY(1)}80%{opacity:1}100%{opacity:0;transform:rotate(-7deg) translateX(30px)}}
@keyframes msaFlashBig{0%{opacity:1}30%{opacity:.7}100%{opacity:0}}
@keyframes msaFin{0%{opacity:0}20%{opacity:1}100%{opacity:0}}
@keyframes msaBurst{0%{opacity:0;transform:scale(.3) rotate(0)}30%{opacity:1}100%{opacity:0;transform:scale(1.3) rotate(25deg)}}
@keyframes msaDust{0%{opacity:0;transform:translateX(0) scale(.4)}25%{opacity:1}100%{opacity:0;transform:translateX(var(--msa-dx,-18px)) translateY(-6px) scale(1.5)}}
@keyframes msaPant{0%,100%{transform:translateY(0)}50%{transform:translateY(-3px)}}
@keyframes msaTired{0%,100%{transform:none}50%{transform:translateY(2px) scale(1.02,.97)}}
@keyframes msaRays{to{transform:rotate(360deg)}}
@keyframes msaStamp{0%{opacity:0;transform:translateX(var(--msa-tx,0)) scale(2.2) rotate(var(--msa-r,0deg))}100%{opacity:1;transform:translateX(var(--msa-tx,0)) scale(1) rotate(var(--msa-r,0deg))}}
@keyframes msaFlash{0%{opacity:.85}100%{opacity:0}}
@keyframes msaShake{0%,100%{transform:none}20%{transform:translate(-6px,2px)}40%{transform:translate(5px,-2px)}60%{transform:translate(-3px,1px)}80%{transform:translate(2px,0)}}
@keyframes msaPop{0%{opacity:0;transform:translateY(10px) scale(.7)}35%{opacity:1;transform:translateY(-4px) scale(1.12)}100%{opacity:1;transform:translateY(-12px) scale(1)}}
@keyframes msaCharge{0%,100%{transform:none}30%{transform:translateY(4px) scale(1.05,.92)}60%{transform:translateY(-6px) scale(.97,1.06)}}
@keyframes msaAura{0%{opacity:0;transform:scale(.4)}40%{opacity:1}100%{opacity:0;transform:scale(1.5)}}
@keyframes msaSulk{0%,100%{transform:none}30%,70%{transform:rotate(-8deg) translateX(-4px)}}
@keyframes msaStep{0%{transform:none}45%{transform:translateY(-14px)}100%{transform:none}}
@keyframes msaIn{0%{opacity:0;transform:translateY(16px) scale(.8)}100%{opacity:1;transform:none}}
@media (max-height:420px) and (orientation:landscape){.msa-stage{height:180px}.msa-f{height:100px}.msa-f img.msa-img{max-height:92px}}
@media (prefers-reduced-motion: reduce){
  .msa *,.msa *::before,.msa *::after{animation:none!important;transition:none!important}
}
`;

const msaReduce = () => {
  try { return typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (_) { return false; }
};

// ---- 音(2026-11-12 社長「音もないし音楽もホームの音楽だし味気なさすぎる」) ----
// 効果音は今あるバトルの音(Audio_.fgSe。カードバトルと同じ、裏の周回の音止めに巻き込まれない口)をそのまま使う。消音の設定はそのまま効く
const msaSe = (k) => { try { if (typeof Audio_ !== 'undefined' && Audio_.fgSe && typeof Audio_.fgSe[k] === 'function') Audio_.fgSe[k](); } catch (_) {} };
// 試合の画面が開いている間は、BGMアレンジの「バトル」の曲にする(60-app の bgmKeyForState が見る口)。閉じたら元の曲へ戻る
const MH_BATTLE_BGM = { n: 0, on: false, subs: new Set() };
const mhBattleBgmEmit = () => { const on = MH_BATTLE_BGM.n > 0; if (on === MH_BATTLE_BGM.on) return; MH_BATTLE_BGM.on = on; MH_BATTLE_BGM.subs.forEach((f) => { try { f(on); } catch (_) {} }); };
const mhBattleBgmHold = () => { MH_BATTLE_BGM.n++; mhBattleBgmEmit(); let done = false; return () => { if (done) return; done = true; MH_BATTLE_BGM.n = Math.max(0, MH_BATTLE_BGM.n - 1); mhBattleBgmEmit(); }; };
// 部品が使う: on のあいだバトルの曲
function useMhBattleBgmHold(on) { useEffect(() => (on ? mhBattleBgmHold() : undefined), [on]); }
// 60-app が使う: いまバトルの曲にするか
function useMhBattleBgmOverlay() {
  const [on, setOn] = useState(MH_BATTLE_BGM.on);
  useEffect(() => { MH_BATTLE_BGM.subs.add(setOn); setOn(MH_BATTLE_BGM.on); return () => { MH_BATTLE_BGM.subs.delete(setOn); }; }, []);
  return on;
}

// 技 → SkillFxMotion の動きの名前。① モンヒロに同じ名前の技(SKILL_MOTION_SETS の通常技・固有技) ② カードバトルと同じ決まった動き
const msaMotionKind = (species, tech) => {
  if (!tech) return null;
  const has = (k) => (typeof skillFxSpecOf === 'function' && skillFxSpecOf(k) ? k : null);
  const names = typeof HERO_ATK_NAMES !== 'undefined' ? HERO_ATK_NAMES[species] : null;
  const set = typeof SKILL_MOTION_SETS !== 'undefined' ? SKILL_MOTION_SETS[species] : null;
  const i = Array.isArray(names) ? names.indexOf(tech.name) : -1;
  if (i >= 0 && set && set.normal && set.normal[i] && set.normal[i] !== SKM_SIG) { const k = has(`${species}-n${i}`); if (k) return k; }
  const u = typeof ALL_PLAYER_MONSTERS !== 'undefined' && ALL_PLAYER_MONSTERS[species] ? ALL_PLAYER_MONSTERS[species].unique : null;
  const ui = u && Array.isArray(u.names) ? u.names.indexOf(tech.name) : -1;
  if (ui >= 0 && set && set.unique && set.unique[ui] && set.unique[ui] !== SKM_SIG) { const k = has(`${species}-u${ui}`); if (k) return k; }
  const base = tech.kind === 'pow' ? 'cardBash' : 'cardOrb';
  const g = Number(tech.guts) || 0;
  const tier = g >= 40 ? 'L' : g >= 25 ? 'M' : 'S';
  return has(typeof cardMotionTiered === 'function' ? cardMotionTiered(base, tier) : base) || has(base);
};
// 記録の行の技(1行目の aMoves・bMoves から)。行の guts は「撃ったあとのガッツ」なので、技の重さ(消費ガッツ)はここから引く
const msaTechOf = (log, e) => {
  if (!e || e.ev !== 'tech' || !Array.isArray(log)) return null;
  const st = log[0] || {}; const all = (e.side === 'A' ? st.aMoves : st.bMoves) || [];
  const list = all[Number.isFinite(e.i) ? e.i : 0] || [];
  return list.find((m) => m.id === e.move) || null;
};
const msaTechInfo = (log, e) => { const t = msaTechOf(log, e); return { name: e.name, kind: e.kind, guts: t ? t.guts : 0 }; };
const msaMotionMs = (kind) => {
  const sp = kind && typeof skillFxSpecOf === 'function' ? skillFxSpecOf(kind) : null;
  return { ms: (sp && sp.ms) || 650, hit: (sp && sp.hit) || 300 };
};

// 技の行のアクセント(ため・止め・とどめ)。動きを減らす設定では、どれも 0(待ち時間を足さない)
//   pre … 大技(消費ガッツ40以上)の前のため/stop … 当たった瞬間に場を止める長さ(ヒットストップ)/fin … この技でとどめ(次の行が相手の KO)
const MSA_GUTS_TIRED = 15; // ガッツがこれより少ないと息切れの表示
const msaFxOf = (log, e, reduce) => {
  const z = { pre: 0, stop: 0, fin: false, big: false };
  if (!e || e.ev !== 'tech') return z;
  const big = (Number(msaTechInfo(log, e).guts) || 0) >= 40;
  const idx = Array.isArray(log) ? log.indexOf(e) : -1;
  const nx = idx >= 0 ? log[idx + 1] : null;
  const fin = Boolean(e.hit && nx && nx.ev === 'ko' && nx.side && nx.side !== e.side);
  if (reduce) return { ...z, fin, big };
  const stop = !e.hit ? 0 : fin ? 230 : e.crit || big ? 130 : e.guarded ? 40 : 70;
  return { pre: big ? 460 : 0, stop, fin, big };
};
// ダメージの数字の大きさ(1〜4)。威力 = 相手のはじめの体力に対する割合。会心・大技・とどめはいちばん大きく
const msaDmgTier = (dmg, maxHp, e, fx) => {
  if (e.crit || fx.big || fx.fin) return 4;
  const r = maxHp > 0 ? (Number(dmg) || 0) / maxHp : 0;
  return r >= 0.25 ? 3 : r >= 0.1 ? 2 : 1;
};

// 1行を見せる長さ(ミリ秒・×1)。技は動きの長さ+数字を読む間
const msaStepMs = (e, team, reduce, log) => {
  if (!e) return 300;
  if (reduce) return e.ev === 'tech' ? 900 : e.ev === 'start' || e.ev === 'enter' ? 250 : 650;
  if (e.ev === 'tech') { const m = (team && team.members && team.members[e.i]) || {}; const fx = msaFxOf(log, e, reduce); return msaMotionMs(msaMotionKind(m.species, msaTechInfo(log, e))).ms + 520 + fx.pre + fx.stop + (fx.fin ? 450 : 0); }
  return { start: 700, enter: 350, move: 650, guard: 750, charge: 800, swap: 700, ko: 1500, end: 600 }[e.ev] || 500;
};

// 実況の1行
const msaSay = (e, nm) => {
  if (!e) return '';
  if (e.ev === 'tech') return e.hit ? `${nm(e.side, e.i)}の ${e.name}!${e.crit ? ' 会心の一撃!' : e.guarded ? ' …ガードされた' : ''}` : `${nm(e.side, e.i)}の ${e.name} … よけられた`;
  if (e.ev === 'move') return `${nm(e.side, e.i)}が ${AMBW_DIST[e.to] || ''}の間合いへ`;
  if (e.ev === 'charge') return e.why === 'sulk' ? `${nm(e.side, e.i)}は そっぽを向いた…` : `${nm(e.side, e.i)}は ガッツをためた`;
  if (e.ev === 'guard') return `${nm(e.side, e.i)}は 身を守った`;
  if (e.ev === 'swap') return `${nm(e.side, e.i)}に 交代!`;
  if (e.ev === 'ko') return `${e.name} は たおれた`;
  if (e.ev === 'start') return '試合開始!';
  return '';
};

// ---- 場の1体 ----
//   gd … この行での自分のガッツの増減(ためる +・技を撃つ −・ガッツを削られた −)
function MsaFighter({ side, member, x, e, foeX, hpNow, reduce, idleOk, gd, fx, motionOn = true, maxHp = 0, gutsNow = null }) {
  fx = fx || { pre: 0, stop: 0, fin: false, big: false };
  const sp = member ? member.species : '';
  const src = mscMonImg(sp);
  const img = <img className={`msa-img ${side === 'A' ? 'msa-flip' : ''}`} src={src} alt={member ? member.name : ''} draggable={false}/>;
  const down = hpNow <= 0;
  const me = e && e.side === side;
  const foe = e && e.side && e.side !== side;
  const tech = e && e.ev === 'tech';
  let body = null; let cls = ''; const extra = [];
  let style = { left: `${x * 100}%` };
  if (tech && me && !reduce && !motionOn) {
    // 大技の前のため: 身をかがめて光を集める(このあいだ場が暗くなる)
    body = <div key={`pre-${e.k}`} className="flex items-end justify-center msa-chargebig" style={{ '--msa-pre': `${fx.pre}ms` }}>{img}</div>;
    extra.push(<span key={`ab-${e.k}`} className="msa-aura big" aria-hidden="true" style={{ '--msa-pre': `${fx.pre}ms` }}/>);
  } else if (tech && me && !reduce) {
    // 攻める: 相手の位置まで(--atk-dx)。モンヒロのバトルと同じ動き
    const kind = msaMotionKind(sp, e.tech);
    if (kind) {
      const w = foeX.w; const dx = (foeX.x - x) * w;
      style = { ...style, ...(typeof attackAimVars === 'function' ? attackAimVars(dx, -8) : { '--atk-dx': `${Math.round(dx)}px`, '--atk-dy': '-8px' }) };
      body = <SkillFxMotion key={`m-${e.k}`} kind={kind} image={img}/>;
    }
  }
  const delay = tech ? (reduce ? 0 : fx.pre + msaMotionMs(msaMotionKind(e.atkSp, e.tech)).hit) : 0;
  if (tech && foe) {
    const pose = !e.hit ? 'mh-card-dodge' : e.guarded ? 'mh-card-guard' : 'mh-card-hit';
    body = <div key={`p-${e.k}`} className={`flex items-end justify-center ${pose}`} style={{ animationDelay: `${delay}ms` }}>{img}</div>;
    if (!e.hit) extra.push(<div key={`a-${e.k}`} className="mh-card-afterimage" aria-hidden="true" style={{ animationDelay: `${delay}ms` }}>{img}</div>);
    if (e.guarded && e.hit) extra.push(<span key="s" className="mh-card-shield" aria-hidden="true" style={{ animationDelay: `${delay}ms` }}/>);
    extra.push(e.hit
      ? <div key={`d-${e.k}`} className={`msa-dmg t${msaDmgTier(e.dmg, maxHp, e, fx)}`} data-msa-dmg={e.dmg} data-msa-tier={msaDmgTier(e.dmg, maxHp, e, fx)} style={{ animationDelay: `${delay}ms` }}>{e.crit ? <small>会心!</small> : e.guarded ? <small>ガード!</small> : null}−{e.dmg}</div>
      : <div key={`d-${e.k}`} className="msa-dmg miss" style={{ animationDelay: `${delay}ms` }}>よけた!</div>);
  }
  if (me && e.ev === 'guard') { cls = 'mh-card-guard'; extra.push(<span key="s" className="mh-card-shield" aria-hidden="true"/>); }
  if (me && e.ev === 'charge') {
    if (e.why === 'sulk') { cls = 'msa-sulk'; extra.push(<span key="t" className="msa-tag">そっぽ…</span>); }
    else { cls = 'msa-charge'; extra.push(<span key="a" className="msa-aura" aria-hidden="true"/>); }
  }
  if (me && e.ev === 'move') {
    cls = 'msa-step';
    if (!reduce) [0, 1, 2].forEach((j) => extra.push(<i key={`du-${e.k}-${j}`} className="msa-dust" aria-hidden="true" style={{ left: `${18 + j * 22}%`, animationDelay: `${j * 60}ms`, '--msa-dx': `${(j - 1) * 16}px` }}/>));
  }
  if (me && (e.ev === 'swap' || e.ev === 'enter')) cls = 'msa-in';
  const koNow = e && e.ev === 'ko' && e.side === side;
  if (down) cls = koNow ? 'mh-card-ko' : '';
  if (koNow) {
    extra.push(<div key={`k-${e.k}`} className="msa-ko big" data-msa-ko={side}>K.O.!</div>);
    if (!reduce) extra.push(<i key={`bu-${e.k}`} className="msa-burst" aria-hidden="true"/>);
  }
  // 息切れ: ガッツが尽きかけ(ためている行は出さない)
  const tired = !down && Number.isFinite(gutsNow) && gutsNow < MSA_GUTS_TIRED && !(me && e.ev === 'charge');
  if (tired) extra.push(<span key="pant" className="msa-pant" data-msa-tired={side}>💦 息切れ</span>);
  // ガッツの増減(ためた・撃った・削られた)。削られたのは当たる瞬間に出す
  if (Number.isFinite(gd) && Math.round(gd) !== 0 && !down) {
    const n = Math.round(gd);
    extra.push(<span key={`g-${e ? e.k : 0}`} className={`msa-gtag ${n > 0 ? 'up' : 'down'}`} data-msa-guts={n} style={{ animationDelay: `${tech && foe ? delay : 0}ms` }}>ガッツ {n > 0 ? `+${n}` : `−${-n}`}</span>);
  }
  if (!body) {
    const still = !cls && !down && idleOk && !reduce && typeof withMonsterIdleArt === 'function' ? withMonsterIdleArt(sp, img) : img;
    body = <div key={`b-${e ? e.k : 0}-${cls}`} className={`flex items-end justify-center ${cls}`}>{still}</div>;
  }
  return (
    <div className={`msa-f ${down ? 'down' : ''} ${tech && me ? 'act' : ''} ${koNow ? 'slowko' : ''} ${tired && !reduce ? 'tired' : ''}`} style={style} data-msa-fighter={side}>
      <span className="msa-shadow" aria-hidden="true"/>
      {body}
      {extra}
    </div>
  );
}

// 1行ぶんの効果音。pos が前へ進んだときだけ鳴らす(見返しで戻した・止めているときは鳴らさない)
function useMsaSfx(log, pos, teams, reduce, on) {
  const lastRef = useRef(-1);
  const timers = useRef([]);
  useEffect(() => () => { timers.current.forEach(clearTimeout); timers.current = []; }, []);
  useEffect(() => {
    const prev = lastRef.current; lastRef.current = pos;
    if (!on || pos <= prev) return;
    const e = log[pos]; if (!e) return;
    const later = (ms, k) => { if (ms <= 0) { msaSe(k); return; } timers.current.push(setTimeout(() => msaSe(k), ms)); };
    if (e.ev === 'tech') {
      const m = (teams[e.side] && teams[e.side].members && teams[e.side].members[e.i]) || {};
      const hitMs = reduce ? 0 : msaFxOf(log, e, reduce).pre + msaMotionMs(msaMotionKind(m.species, msaTechInfo(log, e))).hit;
      if ((Number(msaTechInfo(log, e).guts) || 0) >= 40) msaSe('special');      // 大技は出だしに溜めの音
      later(hitMs, !e.hit ? 'trainingMove' : e.crit ? 'crit' : e.guarded ? 'guard' : e.side === 'A' ? 'attack' : 'enemyAttack');
    } else if (e.ev === 'guard') msaSe('guard');
    else if (e.ev === 'charge') msaSe(e.why === 'sulk' ? 'trainingBad' : 'trainingGood');
    else if (e.ev === 'move') msaSe('trainingMove');
    else if (e.ev === 'swap') msaSe('join');
    else if (e.ev === 'ko') msaSe('enemyCharge');
    else if (e.ev === 'start') msaSe('trainingDecide');
  }, [pos, on]);
}

// ---- 場(試合の画面の共通の部品。MonsucArena と 助手マスモン対戦 β の観戦が使う) ----
//   log・frames(ambwFramesOf)・pos … いま見せている行 / teams … { A, B }(members に species・name)
//   ended … 決着を見せる(勝ち負けの印と音) / win … 'A' | 'B' | 'draw' / endSub … 印の下の小さい字
//   sound … 効果音を鳴らすか(止めて見返しているときなどは false)
function MsaStage({ log, frames, pos, teams, venueImg, ended = false, win = null, endSub = '', sound = true }) {
  const reduce = useMemo(() => msaReduce(), []);
  const [stageW, setStageW] = useState(340);
  const stageRef = useRef(null);
  useEffect(() => {
    const el = stageRef.current; if (!el) return undefined;
    const fit = () => setStageW(el.clientWidth || 340);
    fit();
    if (typeof ResizeObserver === 'undefined') { window.addEventListener('resize', fit); return () => window.removeEventListener('resize', fit); }
    const ro = new ResizeObserver(fit); ro.observe(el); return () => ro.disconnect();
  }, []);
  useMsaSfx(log, pos, teams, reduce, sound);
  const endSaid = useRef(false);
  useEffect(() => {
    if (!ended || endSaid.current) return;
    endSaid.current = true;
    if (sound) msaSe(win === 'A' ? 'victory' : 'trainingFail');
  }, [ended]);
  // 大技のため: ため終わるまで技の動きを出さない(pos ごとに数え直す)
  const [preAt, setPreAt] = useState(-1);
  const fxNow = msaFxOf(log, log[pos], reduce);
  useEffect(() => {
    if (!fxNow.pre) return undefined;
    const t = setTimeout(() => setPreAt(pos), fxNow.pre); return () => clearTimeout(t);
  }, [pos, fxNow.pre]);
  // ヒットストップ: 当たった瞬間に、場の中の動きをまとめて止めて、少しあとで動かす
  useEffect(() => {
    const e1 = log[pos]; const el = stageRef.current;
    if (!e1 || e1.ev !== 'tech' || !e1.hit || !fxNow.stop || !el || typeof el.getAnimations !== 'function') return undefined;
    const m = (teams[e1.side] && teams[e1.side].members && teams[e1.side].members[e1.i]) || {};
    const at = fxNow.pre + msaMotionMs(msaMotionKind(m.species, msaTechInfo(log, e1))).hit;
    let back = null;
    const t = setTimeout(() => {
      // 止めるのは選手の動きと揺れだけ(閃光・数字・帯は止めない。閃光が白いまま残らないように)
      const inFighter = (a) => { const t = a.effect && a.effect.target; return !!(t && t.closest && (t.closest('.msa-f') || t.classList.contains('msa-shk'))); };
      let list = []; try { list = el.getAnimations({ subtree: true }).filter((a) => a.playState === 'running' && inFighter(a)); } catch (_) {}
      list.forEach((a) => { try { a.pause(); } catch (_) {} });
      back = setTimeout(() => list.forEach((a) => { try { a.play(); } catch (_) {} }), fxNow.stop);
    }, at);
    return () => { clearTimeout(t); if (back) clearTimeout(back); };
  }, [pos]);
  const f = frames[Math.min(pos, frames.length - 1)] || frames[0];
  if (!f) return null;
  const pf = frames[Math.max(0, Math.min(pos, frames.length - 1) - 1)] || f;
  const e0 = log[pos] || {};
  const memberOf = (side, i) => { const t = teams[side]; const ms = (t && t.members) || []; return ms[Number.isFinite(i) ? i : f.act[side]] || ms[0] || null; };
  const e = { ...e0, k: pos, atkSp: e0.side ? (memberOf(e0.side, e0.i) || {}).species : '', tech: msaTechInfo(log, e0) };
  const gap = MSA_GAP[f.d] != null ? MSA_GAP[f.d] : MSA_GAP[1];
  const xA = 0.5 - gap / 2; const xB = 0.5 + gap / 2;
  const spots = MSA_GAP.map(g => [0.5 - g / 2, 0.5 + g / 2]);
  const hpOf = (side) => (f.hp[side] || [])[f.act[side]];
  // ガッツの増減は、手を打った行(技・ためる)と、ガッツを削られた行だけ出す
  const gdOf = (side) => {
    if (!pos || !e.side) return null;
    if (e.side === side && e.ev === 'tech') return e.tech.guts ? -e.tech.guts : null;            // 撃った: 技の消費ガッツ
    if (e.side === side && e.ev === 'charge' && e.why !== 'sulk') return f.g[side] - pf.g[side];  // ためた: 増えた分
    if (e.side !== side && e.ev === 'tech' && e.hit && (Number(e.gd) || 0) > 0) return -Math.round(Number(e.gd)); // 削られた
    return null;
  };
  const fx = msaFxOf(log, e0, reduce);
  const big = e.ev === 'tech' && (Number(e.tech.guts) || 0) >= 40;
  const hitMs = e.ev === 'tech' && !reduce ? fx.pre + msaMotionMs(msaMotionKind(e.atkSp, e.tech)).hit : 0;
  const foeSide = e.side === 'A' ? 'B' : 'A';
  const maxHpOf = (side) => { const f0 = frames[0]; return f0 && f0.hp && f0.hp[side] ? Number(f0.hp[side][f.act[side]]) || 0 : 0; };
  const tier = e.ev === 'tech' && e.hit ? msaDmgTier(e.dmg, maxHpOf(foeSide), e, fx) : 0;
  // 揺れの強弱: 小さい当たりは揺らさない/中は弱く/大きい当たりはふつう/会心・大技・とどめは強く
  const shakeLv = reduce || !e.hit || e.ev !== 'tech' ? 0 : tier >= 4 ? 3 : tier >= 3 ? 2 : tier >= 2 ? 1 : 0;
  const shake = shakeLv > 0;
  const p = Number.isFinite(e.p) ? Math.round(e.p) : null;
  const gutsOf = (side) => (f.g && Number.isFinite(Number(f.g[side])) ? Number(f.g[side]) : null);
  return (
    <div className="msa-stage" ref={stageRef} data-msa-stage style={{ backgroundImage: venueImg ? `url(${venueImg})` : undefined }}>
     <div className={`msa-shk ${shake ? `shake s${shakeLv}` : ''}`} key={shake ? `sh-${pos}` : 'st'} style={shake ? { animationDelay: `${hitMs}ms` } : undefined}>
      {e.ev !== 'tech' ? <div className="msa-round">ラウンド {f.r || 1}</div> : null}
      <div className="msa-floor" aria-hidden="true"/>
      {spots.map(([a, b], d) => <React.Fragment key={d}><i className={`msa-spot ${d === f.d ? 'on' : ''}`} style={{ left: `${a * 100}%` }}/><i className={`msa-spot ${d === f.d ? 'on' : ''}`} style={{ left: `${b * 100}%` }}/></React.Fragment>)}
      {e.ev === 'tech' && fx.pre > 0 && preAt !== pos && <i key={`dim-${pos}`} className="msa-dim" aria-hidden="true" style={{ '--msa-pre': `${fx.pre}ms`, '--msa-cx': `${(e.side === 'A' ? xA : xB) * 100}%` }}/>}
      <MsaFighter side="A" member={memberOf('A')} x={xA} e={e} foeX={{ x: xB, w: stageW }} hpNow={hpOf('A')} reduce={reduce} idleOk gd={gdOf('A')} fx={fx} motionOn={!fx.pre || preAt === pos} maxHp={maxHpOf('A')} gutsNow={gutsOf('A')}/>
      <MsaFighter side="B" member={memberOf('B')} x={xB} e={e} foeX={{ x: xA, w: stageW }} hpNow={hpOf('B')} reduce={reduce} idleOk gd={gdOf('B')} fx={fx} motionOn={!fx.pre || preAt === pos} maxHp={maxHpOf('B')} gutsNow={gutsOf('B')}/>
      <div className="msa-dist">{AMBW_DIST.map((n, d) => <span key={d} className={d === f.d ? 'cur' : ''}>{n}</span>)}</div>
      {e.ev === 'tech' && <div key={`c-${pos}`} className={`ambw-cut ${e.kind} ${e.side === 'B' ? 'B' : ''} ${big ? 'big' : ''}`} style={{ zIndex: 7 }} data-msa-cut={p == null ? '' : p}>
        <small>{e.kind === 'pow' ? '💪 ちから技' : '🧠 かしこさ技'}{p != null ? `・命中 ${p}%` : ''}{big ? '・大技!' : ''}</small><b>{e.name}</b></div>}
      {e.ev === 'tech' && e.hit && (e.crit || fx.fin) && !reduce && <i key={`fl-${pos}`} className={`msa-flash ${e.crit ? 'big' : 'fin'}`} aria-hidden="true" style={{ animationDelay: `${hitMs}ms` }}/>}
      {e.ev === 'tech' && e.hit && e.crit && !reduce && <div key={`cc-${pos}`} className="msa-critcut" data-msa-critcut style={{ animationDelay: `${hitMs + fx.stop}ms` }}><b>会心の一撃!</b></div>}
      {e.ev === 'tech' && fx.fin && !reduce && <i key={`fin-${pos}`} className="msa-fin" aria-hidden="true" style={{ animationDelay: `${hitMs}ms` }}/>}
     </div>
      {ended && <div className={`msa-end ${win === 'A' ? 'w' : 'l'}`} data-msc-end={win === 'A' ? 'win' : win === 'draw' ? 'draw' : 'lose'}>{!reduce && <i className="msa-rays" aria-hidden="true"/>}<b>{win === 'A' ? '勝ち!' : win === 'draw' ? '引き分け' : '負け…'}</b><span className="msa-ribbon">{win === 'A' ? 'WIN' : win === 'draw' ? 'DRAW' : 'LOSE'}</span>{endSub ? <small>{endSub}</small> : null}</div>}
    </div>
  );
}

// ---- 試合の画面(モンヒロサクセス) ----
//   input … 芯 createMatch に渡す入力(simulate と同じ形)。あれば自分で操作する
//   watch … { r, teamA, teamB }(記録だけ。オートの結果を見せる)
//   onEnd(won, { choices, auto, result }) … 決着を見せ終わったら1回だけ
function MonsucArena({ s, info, engine, input, watch, onEnd }) {
  const reduce = useMemo(() => msaReduce(), []);
  const manual = Boolean(input && engine && typeof engine.createMatch === 'function');
  const mm = useMsxManualMatch(manual ? engine : null, manual ? input : null, null, info.seed);
  const log = manual ? mm.log : (watch && watch.r && Array.isArray(watch.r.log) ? watch.r.log : []);
  const teams = manual ? { A: input.teamA, B: input.teamB } : { A: watch && watch.teamA, B: watch && watch.teamB };
  const [pos, setPos] = useState(0);
  const [speed, setSpeed] = useState('x1');
  const [auto, setAuto] = useState(!manual);
  const [ended, setEnded] = useState(false);
  const endRef = useRef(false);
  useMhBattleBgmHold(true);
  const frames = useMemo(() => (log.length ? ambwFramesOf(log) : []), [log.length, manual ? mm.tick : 0]);
  const last = log.length - 1;
  const done = manual ? mm.done : log.length > 0;
  const result = manual ? mm.result : (watch && watch.r) || null;
  const busy = pos < last;
  // 1行ずつ進める。追いついたら、手番を待つ(自分操作)か、決着を見せる
  useEffect(() => {
    if (!log.length || ended) return undefined;
    if (pos < last) {
      const cur = log[pos] || {};
      const sp = MSA_SPEEDS.find(x => x.id === speed) || MSA_SPEEDS[0];
      const t = setTimeout(() => setPos(p => Math.min(last, p + 1)), Math.round(msaStepMs(cur, teams[cur.side], reduce, log) * sp.f));
      return () => clearTimeout(t);
    }
    if (done) { const t = setTimeout(() => setEnded(true), reduce ? 300 : 900); return () => clearTimeout(t); }
    return undefined;
  }, [pos, last, speed, done, ended]);
  const won = Boolean(result && result.winner === 'A');
  // 手を選ぶ帯が出たら、帯が見える所まで入れ物(縦にだけ動く)を送る(横向きでは場の下に隠れるため)。横へは動かさない
  const barRef = useRef(null);
  const barOn = Boolean(manual && !auto && pos >= last && !ended && mm.pending);
  useEffect(() => {
    const el = barRef.current; if (!barOn || !el) return;
    const box = el.closest ? el.closest('[data-msc-root]') : null; if (!box) return;
    const r = el.getBoundingClientRect(); const b = box.getBoundingClientRect();
    const over = r.bottom - b.bottom + 8;
    if (over > 0) box.scrollTop += Math.min(over, Math.max(0, r.top - b.top - 8));
  }, [barOn, pos]);
  useEffect(() => {
    if (!ended || endRef.current) return undefined;
    const t = setTimeout(() => { if (endRef.current) return; endRef.current = true; if (onEnd) onEnd(won, { choices: manual ? mm.choices : null, auto, result }); }, 1700);
    return () => clearTimeout(t);
  }, [ended]);
  if (!log.length) return <div className="msc-wrap"><p className="msc-note" style={{ textAlign: 'center', marginTop: 40 }}>試合の準備をしています…</p></div>;
  const f = frames[Math.min(pos, frames.length - 1)] || frames[0];
  const e = log[pos] || {};
  const st = log[0] || {};
  const maxHp = { A: st.aHp || [], B: st.bHp || [] };
  const nm = (side, i) => { const t = teams[side]; const ms = (t && t.members) || []; const m = ms[Number.isFinite(i) ? i : f.act[side]] || ms[0]; return (m && m.name) || ''; };
  const pick = (c) => { if (busy || !manual) return; msaSe('tap'); if (mm.pick(c)) setPos(p => p + 1); }; // 選んだ手の行からすぐ見せる
  const goAuto = () => { if (!manual) return; msaSe('tap'); mm.toAuto(); setAuto(true); setSpeed('x2'); };
  const skip = () => { if (manual && !done) return; msaSe('tap'); setPos(last); };
  const showBar = Boolean(manual && !auto && !busy && !ended && mm.pending);
  return (
    <div className="msc-wrap msa" data-msc-match data-msa-pos={pos} data-msa-mode={manual ? (auto ? 'auto' : 'manual') : 'watch'}>
      <style>{MSA_CSS}</style>
      <div className="msc-top"><b>{info.title} {MSC_STARS(info.star)}</b></div>
      <MscPanel side="B" team={teams.B} frame={f} maxHp={maxHp} info={info} s={s}/>
      <MsaStage log={log} frames={frames} pos={pos} teams={teams} venueImg={MSC_VENUE_IMG[info.venue] || MSC_VENUE_IMG.cup} ended={ended} win={result ? result.winner : null}/>
      <MscPanel side="A" team={teams.A} frame={f} maxHp={maxHp} info={info} s={s} buffed={Boolean(info.buffs)}/>
      <div className="msa-say" data-msa-say>{msaSay(e, nm)}</div>
      <div ref={barRef}>{showBar ? <MsxManualBar opt={mm.pending} onPick={pick} onAuto={goAuto} busy={busy}/> : null}</div>
      {manual && !auto && busy && !ended ? <div className="msa-wait">{e.side === 'B' ? '相手の番…' : ' '}</div> : null}
      {(!manual || auto) && !ended ? (
        <div className="msa-tools">
          {MSA_SPEEDS.map(x => <button key={x.id} type="button" className={speed === x.id ? 'on' : ''} onClick={() => { msaSe('tap'); setSpeed(x.id); }}>{x.label}</button>)}
          <button type="button" data-msc-skip onClick={skip}>⏭ とばす</button>
        </div>
      ) : null}
      {manual && !auto && !ended ? (
        <div className="msa-tools">
          {MSA_SPEEDS.slice(0, 2).map(x => <button key={x.id} type="button" className={speed === x.id ? 'on' : ''} onClick={() => { msaSe('tap'); setSpeed(x.id); }}>見せる速さ {x.label}</button>)}
        </div>
      ) : null}
    </div>
  );
}

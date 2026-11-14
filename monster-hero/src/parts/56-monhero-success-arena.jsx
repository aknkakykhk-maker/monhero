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
const MSA_GAP = [0.13, 0.32, 0.5, 0.68];
const MSA_C_LIM = 0.24;  // 2体のまん中が場のまん中から離れてよい幅(場の幅に対する割合。離れているときは2体が場に収まる所まで)
const MSA_PAN_K = 0.35;  // カメラがまん中を追う割合(1 で真ん中に戻しきる。追いすぎると動いていない相手まで流れて見えるので、少しだけ追う)            // 距離ごとの、2体の間(場の幅に対する割合)。零は触れ合うほど
const MSA_SPEEDS = Object.freeze([{ id: 'x1', label: '×1', f: 1 }, { id: 'x2', label: '×2', f: 0.55 }, { id: 'x4', label: '×4', f: 0.3 }]);
// 試合の場の背景(2026-11-14 社長「背景は参考資料のバトル中にならって。サッカー場みたいのもオプションで選べるように」)
//   闘技場(既定・tools/battle/msa-arena-art.js が描く)/スタジアム(前からの会場の絵 MSC_VENUE_IMG)。選んだ方は mh_monsuc_arena_bg_v1 に 'arena' | 'stadium' で持つ
//   (新しいキー。無い・読めない値は闘技場)。大会の入り・勝ち負けの画面の絵はいままでどおり MSC_VENUE_IMG
const MSA_ARENA_IMG = Object.freeze({
  debut: 'images/success/arena/arena-debut.png', cup: 'images/success/arena/arena-cup.png',
  hero: 'images/success/arena/arena-hero.png', summit: 'images/success/arena/arena-summit.png',
});
const MSA_BG_KEY = 'mh_monsuc_arena_bg_v1';
const msaBgNorm = (v) => (v === 'stadium' ? 'stadium' : 'arena');
const msaBgRead = () => { try { return msaBgNorm(localStorage.getItem(MSA_BG_KEY)); } catch (_) { return 'arena'; } };
const msaBgWrite = (v) => { try { localStorage.setItem(MSA_BG_KEY, msaBgNorm(v)); } catch (_) {} };
const msaVenueBg = (venue, mode) => {
  if (msaBgNorm(mode) === 'stadium' && typeof MSC_VENUE_IMG !== 'undefined') return MSC_VENUE_IMG[venue] || MSC_VENUE_IMG.cup;
  return MSA_ARENA_IMG[venue] || MSA_ARENA_IMG.cup;
};
const MSA_BG_LABEL = Object.freeze({ arena: '🏛️ 闘技場', stadium: '🏟️ スタジアム' });
// 背景の切り替え(試合の下の帯に置く)。押すたびに闘技場 ⇄ スタジアム
function MsaBgToggle({ bg, onChange }) {
  const next = msaBgNorm(bg) === 'arena' ? 'stadium' : 'arena';
  return <button type="button" className="msa-bgsw" data-msa-bg={msaBgNorm(bg)} aria-label={`背景を${MSA_BG_LABEL[next].slice(3)}にする`} onClick={() => { msaSe('tap'); msaBgWrite(next); onChange(next); }}>背景 {MSA_BG_LABEL[msaBgNorm(bg)]}</button>;
}
// 試合の操作(2026-11-14 社長「バトルがオートだった。基本マニュアルで、オートにもできるようにして」)
//   モンサクの大会と助手マスモン対戦の試合で共通の新しいキー。'manual'(既定)/'auto'。無い・知らない値は手動として読み、消さない
const MSA_CTL_KEY = 'mh_monsuc_arena_ctl_v1';
const msaCtlNorm = (v) => (v === 'auto' ? 'auto' : 'manual');
const msaCtlRead = () => { try { return msaCtlNorm(localStorage.getItem(MSA_CTL_KEY)); } catch (_) { return 'manual'; } };
const msaCtlWrite = (v) => { try { localStorage.setItem(MSA_CTL_KEY, msaCtlNorm(v)); } catch (_) {} };
// オートのときに選ぶ手(芯のおすすめ hint。交代の番は出せる先頭の子)。無ければ null
const msaAutoChoice = (opt) => {
  if (!opt) return null;
  if (opt.kind === 'enter') { const x = (opt.enter || []).find((y) => y && y.ok); return x ? { type: 'enter', to: x.to } : null; }
  return opt.hint && opt.hint.type ? { ...opt.hint } : null;
};
// 手動 ⇄ オートの切り替え(試合の下の帯に置く)。保存はここ(save=false なら保存しない)
function MsaCtlToggle({ ctl, onChange, save = true }) {
  const now = msaCtlNorm(ctl); const next = now === 'auto' ? 'manual' : 'auto';
  return <button type="button" className="msa-ctlsw" data-msa-ctl={now} aria-label={next === 'auto' ? 'オートにする' : '手動にする'} onClick={() => { msaSe('tap'); if (save) msaCtlWrite(next); onChange(next); }}>{now === 'auto' ? '🤖 オート中' : '🎮 手動'}<small>{next === 'auto' ? 'オートへ' : '手動へ'}</small></button>;
}
const MSA_CSS = `
.msa{display:flex;flex-direction:column;gap:6px}
.msa-stage{position:relative;height:clamp(200px,34vh,290px);border-radius:16px;overflow:hidden;background:#2a2147 center/cover no-repeat}
.msa-floor{position:absolute;left:4%;right:4%;bottom:30px;height:2px;background:linear-gradient(90deg,#fff0,#ffffff55 20%,#ffffff55 80%,#fff0);z-index:1}
.msa-spot{position:absolute;bottom:23px;width:16px;height:16px;margin-left:-8px;border-radius:50%;border:2px solid #ffffff40;background:#0f0b2280;z-index:1;transition:all .35s}
.msa-spot.on{border-color:#fde047;background:#fde04766;box-shadow:0 0 10px #fde047aa}
.msa-f{position:absolute;bottom:30px;width:96px;margin-left:-48px;height:120px;display:flex;align-items:flex-end;justify-content:center;z-index:3;transition:left .64s cubic-bezier(.45,.05,.35,1)}
.msa-f.act{z-index:6}
.msa-f img.msa-img{max-width:96px;max-height:112px;object-fit:contain;filter:drop-shadow(0 6px 5px rgba(0,0,0,.55))}
.msa-f .msa-flip{transform:scaleX(-1)}
.msa-f .msa-shadow{position:absolute;bottom:-5px;left:50%;width:62px;height:11px;margin-left:-31px;border-radius:50%;background:#0008;z-index:-1}
.msa-f.down img.msa-img{filter:grayscale(1) brightness(.6)}
.msa-dmgwrap{position:absolute;bottom:30px;width:96px;margin-left:-48px;height:120px;z-index:9;pointer-events:none}
.msa-dmg{position:absolute;z-index:8;top:4%;left:50%;width:130px;margin-left:-65px;text-align:center;font-size:30px;font-weight:900;color:#fde047;line-height:.95;text-shadow:0 2px 0 #b91c1c,0 0 8px #f97316;animation:msaPop .55s ease-out both;pointer-events:none}
.msa-dmg small{display:block;font-size:12px;color:#fff;margin-bottom:2px}
.msa-dmg.miss{color:#e2e8f0;font-size:20px;text-shadow:0 2px 0 #0f172a}
.msa-tag{position:absolute;z-index:8;top:-4px;left:50%;transform:translateX(-50%);white-space:nowrap;border-radius:99px;padding:2px 9px;font-size:11.5px;font-weight:900;background:#0f172acc;border:1px solid #fde04788;color:#fde68a;animation:msaPop .4s ease-out both}
.msa-charge{animation:msaCharge .7s ease-out both}
.msa-aura{position:absolute;left:50%;bottom:0;width:90px;height:90px;margin-left:-45px;border-radius:50%;background:radial-gradient(circle,#fde04788 0,#f9731644 45%,#f9731600 70%);animation:msaAura .7s ease-out both;z-index:-1;pointer-events:none}
.msa-sulk{animation:msaSulk .7s ease-in-out both}
.msa-step{transform-origin:50% 100%;animation:msaWalk .64s linear both}
.msa-pan{position:absolute;inset:0;transition:transform .64s cubic-bezier(.45,.05,.35,1);will-change:transform}
/* 横に送っても背景の端が見えないよう、絵は左右に広げて描く(広げるのは ::before だけ。要素の枠は場の中のまま) */
.msa-pan .msa-bg{background-size:0 0}
.msa-pan .msa-bg::before{content:'';position:absolute;top:0;bottom:0;left:-24%;right:-24%;background-color:#2a2147;background-image:inherit;background-size:cover;background-position:center;background-repeat:no-repeat}
.msa-in{animation:msaIn .45s ease-out both}
.msa-dist{position:absolute;left:0;right:0;bottom:4px;display:flex;justify-content:center;gap:5px;z-index:2}
.msa-dist span{font-size:11px;font-weight:900;padding:1px 9px;border-radius:99px;background:#0f0b2299;color:#94a3b8;transition:all .3s}
.msa-dist span.cur{background:#fde047;color:#422006}
.msa-round{position:absolute;left:8px;top:6px;z-index:2;font-size:11px;font-weight:900;color:#fde68a;background:#0f0b2299;border-radius:99px;padding:1px 8px}
.msa-say{min-height:22px;font-size:12.5px;font-weight:800;text-align:center;color:#fff}
.msa-tools{display:flex;gap:5px;align-items:center}
.msa-tools button{flex:1;min-height:34px;border-radius:10px;border:1px solid #4c4680;background:#2b2650;color:#fff;font-weight:900;font-size:12px}
.msa-tools button.on{background:#fde047;color:#422006;border-color:#fde047}
.msx .msa-tools button{text-align:center}
.msa-tools button.msa-ctlsw{flex:1.3;font-size:11.5px;white-space:nowrap;background:#3b1d5e;border-color:#a78bfa;line-height:1.05}.msa-tools button.msa-ctlsw small{display:block;font-size:9.5px;color:#ddd6fe}.msa-tools button.msa-ctlsw[data-msa-ctl=auto]{background:#14532d;border-color:#4ade80}
.msa-tools button.msa-bgsw{flex:1.4;font-size:11px;white-space:nowrap;background:#1e1b3a;border-color:#6b64a8}
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
.msa-end.w b{color:#fde047;text-shadow:2px 0 0 #92400e,-2px 0 0 #92400e,0 -2px 0 #92400e,0 4px 0 #92400e,0 0 18px #fde047aa}
.msa-end.l b{color:#e2e8f0;text-shadow:2px 0 0 #334155,-2px 0 0 #334155,0 -2px 0 #334155,0 4px 0 #1e293b}
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
.msa-critcut b{font-size:28px;font-weight:900;color:#b91c1c;letter-spacing:.12em;text-shadow:0 2px 0 #fff,0 0 1px #7f1d1d}
.msa-flash.big{animation:msaFlashBig .38s ease-out both}
.msa-flash.fin{animation:msaFlashFin .45s ease-out both}
@keyframes msaFlashFin{0%{opacity:0}1%{opacity:.55}100%{opacity:0}}
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
@keyframes msaFlashBig{0%{opacity:0}1%{opacity:.6}25%{opacity:.35}100%{opacity:0}}
@keyframes msaFin{0%{opacity:0}20%{opacity:1}100%{opacity:0}}
@keyframes msaBurst{0%{opacity:0;transform:scale(.3) rotate(0)}30%{opacity:1}100%{opacity:0;transform:scale(1.3) rotate(25deg)}}
@keyframes msaDust{0%{opacity:0;transform:translateX(0) scale(.4)}25%{opacity:1}100%{opacity:0;transform:translateX(var(--msa-dx,-18px)) translateY(-6px) scale(1.5)}}
@keyframes msaPant{0%,100%{transform:translateY(0)}50%{transform:translateY(-3px)}}
@keyframes msaTired{0%,100%{transform:none}50%{transform:translateY(2px) scale(1.02,.97)}}
@keyframes msaRays{to{transform:rotate(360deg)}}
@keyframes msaStamp{0%{opacity:0;transform:translateX(var(--msa-tx,0)) scale(2.2) rotate(var(--msa-r,0deg))}100%{opacity:1;transform:translateX(var(--msa-tx,0)) scale(1) rotate(var(--msa-r,0deg))}}
@keyframes msaFlash{0%{opacity:0}1%{opacity:.85}100%{opacity:0}}
@keyframes msaShake{0%,100%{transform:none}20%{transform:translate(-6px,2px)}40%{transform:translate(5px,-2px)}60%{transform:translate(-3px,1px)}80%{transform:translate(2px,0)}}
@keyframes msaPop{0%{opacity:0;transform:translateY(10px) scale(.7)}35%{opacity:1;transform:translateY(-4px) scale(1.12)}100%{opacity:1;transform:translateY(-12px) scale(1)}}
@keyframes msaCharge{0%,100%{transform:none}30%{transform:translateY(4px) scale(1.05,.92)}60%{transform:translateY(-6px) scale(.97,1.06)}}
@keyframes msaAura{0%{opacity:0;transform:scale(.4)}40%{opacity:1}100%{opacity:0;transform:scale(1.5)}}
@keyframes msaSulk{0%,100%{transform:none}30%,70%{transform:rotate(-8deg) translateX(-4px)}}
@keyframes msaStep{0%{transform:none}45%{transform:translateY(-14px)}100%{transform:none}}
/* 歩いて寄る: 3歩の弾み(上がる→着く)と前のめり/のけぞり。最後は元の姿勢へ */
@keyframes msaWalk{0%{transform:none;animation-timing-function:ease-out}14%{transform:translateY(-10px) rotate(var(--msa-lean,0deg));animation-timing-function:ease-in}28%{transform:translateY(0) rotate(var(--msa-lean,0deg)) scale(1.04,.95);animation-timing-function:ease-out}45%{transform:translateY(-11px) rotate(var(--msa-lean,0deg));animation-timing-function:ease-in}60%{transform:translateY(0) rotate(var(--msa-lean,0deg)) scale(1.04,.95);animation-timing-function:ease-out}76%{transform:translateY(-6px) rotate(calc(var(--msa-lean,0deg) * .5));animation-timing-function:ease-in}90%{transform:translateY(0) scale(1.05,.94)}100%{transform:none}}
@keyframes msaIn{0%{opacity:0;transform:translateY(16px) scale(.8)}100%{opacity:1;transform:none}}
/* ---- 2026-11-13 社長「参考動画を見てもっと改良して」: 入り・カメラ・技の札・効果の帯・DAMAGE ---- */
/* 白飛びの直し: 閃光(msa-flash)は animation-delay の待ちの間も 0% のコマが当たる(fill both)。0% を透明にして当たる瞬間から光らせる */
.msa-stage{background-color:#2a2147}
.msa-cam{position:absolute;inset:0;transform-origin:50% 78%;will-change:transform}
.msa-bg{position:absolute;inset:0;z-index:0;background:#2a2147 center/cover no-repeat}
.msa-rnd{position:absolute;left:50%;top:3px;transform:translateX(-50%);z-index:8;display:flex;flex-direction:column;align-items:center;line-height:1;pointer-events:none}
.msa-rnd small{font-size:9px;font-weight:900;color:#fde68a;letter-spacing:.12em;background:#0f0b22aa;border-radius:99px;padding:1px 7px}
.msa-rnd b{font-size:25px;font-weight:900;color:#fff;-webkit-text-stroke:1px #1e1b4b;text-shadow:0 2px 0 #1e1b4b}
.msa-bands{position:absolute;top:6px;z-index:8;display:flex;flex-direction:column;gap:3px;max-width:38%;pointer-events:none}
.msa-bands.A{left:0;align-items:flex-start}.msa-bands.B{right:0;align-items:flex-end}
.msa-band{font-size:10.5px;font-weight:900;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%;line-height:16px}
.msa-bands.A .msa-band{padding:1px 14px 1px 6px;background:linear-gradient(90deg,#1d4ed8f0,#1d4ed8b0 75%,#1d4ed800);border-left:3px solid #93c5fd;animation:msaBandL .34s ease-out both}
.msa-bands.B .msa-band{padding:1px 6px 1px 14px;background:linear-gradient(270deg,#b91c1cf0,#b91c1cb0 75%,#b91c1c00);border-right:3px solid #fca5a5;animation:msaBandR .34s ease-out both}
.msa-band.old{opacity:.62}
.msa-plate{position:absolute;bottom:3px;z-index:8;max-width:74%;padding:3px 18px 4px;background:linear-gradient(90deg,#0f172af2,#1e293be8);border:1.5px solid #94a3b8;pointer-events:none}
.msa-plate>div{transform:skewX(12deg)}
.msa-plate.A{left:5px;padding-left:22px;border-left:none;transform:skewX(-12deg);animation:msaPlateL .3s cubic-bezier(.2,.9,.3,1) both}
.msa-plate.B{right:5px;padding-right:22px;border-right:none;text-align:right;transform:skewX(-12deg);animation:msaPlateR .3s cubic-bezier(.2,.9,.3,1) both}
.msa-plate.pow{border-color:#fb923c}.msa-plate.wise{border-color:#67e8f9}
.msa-plate small{display:block;font-size:10px;font-weight:900;color:#cbd5e1;white-space:nowrap}
.msa-plate b{display:block;font-size:19px;font-weight:900;color:#fff;letter-spacing:.04em;white-space:nowrap;line-height:1.1}
.msa-plate.big{background:linear-gradient(90deg,#78350ff4,#b45309ee 60%,#f59e0be0);border-color:#fde68a}
.msa-plate.big.B{background:linear-gradient(270deg,#78350ff4,#b45309ee 60%,#f59e0be0)}
.msa-plate.big b{font-size:24px;text-shadow:0 2px 0 #78350f,0 0 6px #78350f}
.msa-plate.big small{color:#fef3c7}
.msa-plate .msa-bigtag{display:inline-block;margin:0 5px;font-size:10px;line-height:14px;padding:0 5px;border-radius:4px;background:#fde047;color:#78350f;vertical-align:4px;-webkit-text-stroke:0;letter-spacing:0}
.msa-dmg{width:150px;margin-left:-75px}
.msa-dmg em{display:block;font-style:normal;font-size:11px;line-height:1.25;letter-spacing:.24em;color:#fff;margin-top:2px;text-shadow:0 1px 0 #7f1d1d,0 0 4px #000}
.msa-dmg i{display:block;font-style:normal;font-size:11px;line-height:1.3;color:#bae6fd;text-shadow:0 1px 0 #0f172a,0 0 4px #000}
.msa-dmg.miss{font-size:13px}
.msa-dmg.miss b{display:block;font-size:34px;letter-spacing:.08em;color:#e2e8f0;-webkit-text-stroke:1.5px #334155;text-shadow:0 3px 0 #1e293b}
.msa-intro{position:absolute;inset:0;z-index:10;overflow:hidden;pointer-events:none;background:radial-gradient(circle at 50% 55%,#312e81e0,#0b0820f5 75%);animation:msaFadeOut .3s 2.3s ease-in both}
.msa-intro .ph1{position:absolute;inset:0;animation:msaPh1 1.2s ease-in both}
.msa-intro .ttl{position:absolute;left:0;right:0;top:9%;text-align:center;font-size:32px;font-weight:900;color:#fde047;letter-spacing:.06em;text-shadow:0 3px 0 #7c2d12,0 -1px 0 #7c2d12,2px 0 0 #7c2d12,-2px 0 0 #7c2d12,0 0 18px #f59e0b;animation:msaTtl .55s cubic-bezier(.2,1.5,.4,1) both}
.msa-intro .pa,.msa-intro .pb{position:absolute;bottom:8%;width:40%;display:flex;flex-direction:column;align-items:center}
.msa-intro .pa{left:3%;animation:msaInL .45s .2s ease-out both}.msa-intro .pb{right:3%;animation:msaInR .45s .2s ease-out both}
.msa-intro .pa img,.msa-intro .pb img{height:min(110px,34vh);max-width:100%;object-fit:contain;filter:drop-shadow(0 4px 6px #000a)}
.msa-intro .pa img{transform:scaleX(-1)}
.msa-intro .nm{max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:12px;font-weight:900;color:#fff;background:#0f172acc;border-radius:99px;padding:1px 10px;margin-top:3px}
.msa-intro .pa .nm{border:1.5px solid #93c5fd}.msa-intro .pb .nm{border:1.5px solid #fca5a5}
.msa-intro .vs{--msa-tx:-50%;position:absolute;left:50%;bottom:30%;transform:translateX(-50%);font-size:42px;font-weight:900;font-style:italic;color:#fff;-webkit-text-stroke:2px #b91c1c;text-shadow:0 3px 0 #7f1d1d,0 0 16px #ef4444aa;animation:msaStamp .4s .5s cubic-bezier(.2,1.6,.4,1) both}
.msa-word{position:absolute;left:50%;top:50%;font-size:50px;font-weight:900;letter-spacing:.08em;white-space:nowrap;color:#fff;-webkit-text-stroke:2px #1e3a8a;text-shadow:0 4px 0 #1e3a8a,0 0 20px #60a5fa;transform:translate(-50%,-50%);opacity:0;animation:msaWord .7s 1.1s ease-out both}
.msa-word.go{color:#fde047;-webkit-text-stroke-color:#9a3412;text-shadow:0 4px 0 #9a3412,0 0 24px #f97316;animation:msaWord .7s 1.75s ease-out both}
@keyframes msaBandL{0%{transform:translateX(-105%)}100%{transform:none}}
@keyframes msaBandR{0%{transform:translateX(105%)}100%{transform:none}}
@keyframes msaPlateL{0%{opacity:0;transform:skewX(-12deg) translateX(-70%)}100%{opacity:1;transform:skewX(-12deg)}}
@keyframes msaPlateR{0%{opacity:0;transform:skewX(-12deg) translateX(70%)}100%{opacity:1;transform:skewX(-12deg)}}
@keyframes msaFadeOut{0%{opacity:1}100%{opacity:0}}
@keyframes msaPh1{0%,82%{opacity:1}100%{opacity:0}}
@keyframes msaTtl{0%{opacity:0;transform:scale(2.6)}100%{opacity:1;transform:none}}
@keyframes msaInL{0%{opacity:0;transform:translateX(-120%)}100%{opacity:1;transform:none}}
@keyframes msaInR{0%{opacity:0;transform:translateX(120%)}100%{opacity:1;transform:none}}
@keyframes msaWord{0%{opacity:0;transform:translate(-50%,-50%) scale(2.4)}22%{opacity:1;transform:translate(-50%,-50%) scale(1)}80%{opacity:1;transform:translate(-50%,-50%) scale(1)}100%{opacity:0;transform:translate(-50%,-50%) scale(1.15)}}
/* ---- 場の中のライフ・ガッツの棒(2026-11-13 社長「ライフ、ガッツの変動演出とか」) ---- */
.msa-hud{position:absolute;top:4px;z-index:8;width:39%;pointer-events:none;display:flex;flex-direction:column;gap:2px}
.msa-hud.A{left:6px}.msa-hud.B{right:6px;align-items:flex-end}
.msa-hud .nm{font-size:10.5px;font-weight:900;color:#fff;text-shadow:0 1px 2px #000,0 0 3px #000;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;line-height:1.2}
.msa-g{display:flex;align-items:center;gap:4px;width:100%}
.msa-hud.B .msa-g{flex-direction:row-reverse}
.msa-gbar{position:relative;flex:1;height:10px;border-radius:5px;background:#0f0b22e6;border:1px solid #ffffff66;overflow:hidden}
.msa-g.gt .msa-gbar{height:6px;border-radius:4px}
.msa-gbar i{position:absolute;top:0;bottom:0;left:0}
.msa-hud.B .msa-gbar i{left:auto;right:0}
.msa-gbar i.lag{background:#fff1f2;transition:width .5s ease-in}
.msa-gbar i.cur{background:linear-gradient(180deg,#86efac,#16a34a);transition:width .2s ease-out}
.msa-g.gt .msa-gbar i.cur{background:linear-gradient(180deg,#fde68a,#f59e0b)}
.msa-g.gt .msa-gbar i.lag{background:#fca5a5}
.msa-g.low .msa-gbar i.cur{background:linear-gradient(180deg,#fca5a5,#dc2626);animation:msaLow .7s ease-in-out infinite}
.msa-g b{min-width:28px;font-size:12px;font-weight:900;color:#fff;text-shadow:0 1px 2px #000,0 0 3px #000;font-variant-numeric:tabular-nums;line-height:1}
.msa-hud.A .msa-g b{text-align:left}.msa-hud.B .msa-g b{text-align:right}
.msa-g.low b{color:#fca5a5}
.msa-g.gt b{font-size:10px;color:#fde68a}
.msa-gbar.hurt{animation:msaBarHit .35s ease-out}
.msa-gbar.hurt.big{animation:msaBarShake .45s ease-out}
.msa-gbar.gain{animation:msaBarGlow .7s ease-out}
.msa-gtags{display:flex;flex-wrap:wrap;gap:3px;min-height:14px}
.msa-hud.B .msa-gtags{justify-content:flex-end}
.msa-gt{font-size:9.5px;font-weight:900;line-height:14px;padding:0 5px;border-radius:99px;white-space:nowrap;animation:msaTagIn .35s ease-out both}
@keyframes msaTagIn{0%{opacity:0;transform:scale(.6)}60%{opacity:1;transform:scale(1.12)}100%{opacity:1;transform:none}}
.msa-gt.up{background:#facc15;color:#422006}.msa-gt.down{background:#475569;color:#f1f5f9}
.msa-bands{top:70px}
@keyframes msaLow{50%{opacity:.45}}
@keyframes msaBarShake{0%,100%{transform:none;box-shadow:0 0 10px #ef4444}20%{transform:translate(-4px,1px)}40%{transform:translate(4px,-1px)}60%{transform:translate(-2px,0)}80%{transform:translate(1px,0)}}
@keyframes msaBarHit{0%{box-shadow:0 0 8px #f87171}100%{box-shadow:0 0 0 #f8717100}}
@keyframes msaBarGlow{0%{box-shadow:0 0 0 #fde04700}30%{box-shadow:0 0 10px #fde047,inset 0 0 4px #fff}100%{box-shadow:0 0 0 #fde04700}}
/* ---- 撃つ前の構えの一拍(2026-11-13 社長「攻撃前にもう1アクセントほしいね」) ---- */
.msa-wind{animation:msaWind var(--msa-pre,380ms) ease-in both}
.msa-aura.wind{width:130px;height:130px;margin-left:-65px;bottom:-6px;animation:msaAuraWind var(--msa-pre,380ms) ease-out both}
@keyframes msaAuraWind{0%{opacity:0;transform:scale(1.5)}25%{opacity:1;transform:scale(.95)}85%{opacity:1;transform:scale(.85)}100%{opacity:0;transform:scale(1.7)}}
.msa-aura.wind.pow{background:radial-gradient(circle,#fff6 0,#fb923caa 25%,#ef444455 50%,#ef444400 70%)}
.msa-aura.wind.wise{background:radial-gradient(circle,#fff6 0,#67e8f9aa 25%,#818cf855 50%,#818cf800 70%)}
.msa-aura.big.wise{background:radial-gradient(circle,#fff7 0,#a5f3fcaa 22%,#6366f1 45%,#6366f100 70%)}
.msa-focus{position:absolute;inset:0;z-index:2;pointer-events:none;background:repeating-conic-gradient(from 0deg at var(--msa-cx,30%) 70%,#fff0 0 5deg,var(--msa-fc,#fde68a) 5deg 6deg);-webkit-mask:radial-gradient(circle at var(--msa-cx,30%) 70%,#0000 0 16%,#000 34%);mask:radial-gradient(circle at var(--msa-cx,30%) 70%,#0000 0 16%,#000 34%);animation:msaFocus var(--msa-pre,380ms) ease-out both}
.msa-focus.pow{--msa-fc:#fdba7499}.msa-focus.wise{--msa-fc:#a5f3fc99}
.msa-aim{position:absolute;bottom:58px;width:58px;height:58px;margin-left:-29px;z-index:5;border-radius:50%;border:2px solid var(--msa-ac,#fb923c);box-shadow:0 0 8px var(--msa-ac,#fb923c),inset 0 0 6px var(--msa-ac,#fb923c);pointer-events:none;animation:msaAim calc(var(--msa-pre,380ms) + 260ms) ease-out both}
.msa-aim::before,.msa-aim::after{content:'';position:absolute;left:50%;top:50%;background:var(--msa-ac,#fb923c)}
.msa-aim::before{width:76px;height:2px;margin:-1px 0 0 -38px}.msa-aim::after{width:2px;height:76px;margin:-38px 0 0 -1px}
.msa-aim.pow{--msa-ac:#fb923c}.msa-aim.wise{--msa-ac:#22d3ee}
@keyframes msaWind{0%{transform:none;filter:none}55%{transform:translateY(4px) scale(1.06,.9);filter:brightness(1.25)}85%{transform:translateY(4px) scale(1.06,.9);filter:brightness(1.35)}100%{transform:none;filter:none}}
@keyframes msaFocus{0%{opacity:0;transform:scale(1.25)}40%{opacity:1}85%{opacity:1;transform:scale(1)}100%{opacity:0;transform:scale(1)}}
@keyframes msaAim{0%{opacity:0;transform:scale(2.2) rotate(-60deg)}45%{opacity:1;transform:scale(1) rotate(0)}80%{opacity:1;transform:scale(.92)}100%{opacity:0;transform:scale(.6)}}
.msa-stage.fill{height:100%;min-height:220px}
.msa-stage.fill .msa-f,.msa-stage.fill .msa-dmgwrap{width:140px;margin-left:-70px;height:176px}
.msa-stage.fill .msa-f img.msa-img{max-width:140px;max-height:166px}
.msa-stage.fill .msa-f .msa-shadow{width:80px;margin-left:-40px}
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
const MSA_GUTS_TIRED = 10; // ガッツがこれより少ないと息切れの表示
// 2026-11-13 社長「攻撃前にもう1アクセントほしいね」: どの技にも撃つ前の構えの一拍(大技は長め)。sf … 見せる速さ(×2 は 0.55。×4 はふつうの技の一拍を省く)
const MSA_WIND_MS = 380;
const MSA_WIND_BIG_MS = 620;
const msaFxOf = (log, e, reduce, sf = 1) => {
  const z = { pre: 0, stop: 0, fin: false, big: false };
  if (!e || e.ev !== 'tech') return z;
  const big = (Number(msaTechInfo(log, e).guts) || 0) >= 40;
  const idx = Array.isArray(log) ? log.indexOf(e) : -1;
  const nx = idx >= 0 ? log[idx + 1] : null;
  const fin = Boolean(e.hit && nx && nx.ev === 'ko' && nx.side && nx.side !== e.side);
  if (reduce) return { ...z, fin, big };
  const stop = !e.hit || (Number(sf) || 1) <= MSA_FAST_F ? 0 : fin ? 230 : e.crit || big ? 130 : e.guarded ? 40 : 70;
  const f = Number(sf) || 1;
  const pre = big ? Math.round(MSA_WIND_BIG_MS * f) : f <= 0.35 ? 0 : Math.round(MSA_WIND_MS * f);
  return { pre, stop, fin, big };
};
// ダメージの数字の大きさ(1〜4)。威力 = 相手のはじめの体力に対する割合。会心・大技・とどめはいちばん大きく
const msaDmgTier = (dmg, maxHp, e, fx) => {
  if (e.crit || fx.big || fx.fin) return 4;
  const r = maxHp > 0 ? (Number(dmg) || 0) / maxHp : 0;
  return r >= 0.25 ? 3 : r >= 0.1 ? 2 : 1;
};

// 1行を見せる長さ(ミリ秒・×1)。技は動きの長さ+数字を読む間。始まりの行は入りの演出(題字・VS・READY・FIGHT)の長さ
const MSA_INTRO_MS = 2600;
const MSA_AFTER_HIT = 1250;  // 当たってから次の手まで(×1)
const MSA_AFTER_MISS = 800;
const MSA_FAST_F = 0.35;     // これ以下の速さ(×4)は早送り: 当たったあとの間と入りの演出を省く
const msaStepMs = (e, team, reduce, log, sf = 1) => {
  if (!e) return 300;
  if (reduce) return e.ev === 'tech' ? 900 : e.ev === 'start' || e.ev === 'enter' ? 250 : 650;
  // 技: 当たってから、数字が出てライフの棒が減りきるまでの間(MSA_AFTER_HIT)をとってから次の手へ(2026-11-13 社長「相手がすぐ動き出す」)
  //   sf を渡すと、その速さで実際にかかる長さ ÷ sf を返す(呼ぶ側が sf を掛ける)。技の動きそのものは縮まないので、当たるところまでは必ず見せる
  if (e.ev === 'start' && (Number(sf) || 1) <= MSA_FAST_F) return 700; // ×4 は入りの VS・READY・FIGHT を省く
  if (e.ev === 'tech') {
    const f = Number(sf) || 1; const m = (team && team.members && team.members[e.i]) || {}; const fx = msaFxOf(log, e, reduce, f); const mm = msaMotionMs(msaMotionKind(m.species, msaTechInfo(log, e)));
    // ×4(早送り): 技の動きの終わりを待たず、当たって数字が見えたらすぐ次へ(main の 1.3倍以内。窓口 2026-11-13)
    const real = f <= MSA_FAST_F ? fx.pre + mm.hit + (e.hit ? 90 : 60) + (fx.fin ? 150 : 0)
      : fx.pre + Math.max((mm.ms + 300) * Math.max(f, 0.6), mm.hit + (e.hit ? MSA_AFTER_HIT : MSA_AFTER_MISS) * f) + fx.stop + (fx.fin ? 450 * f : 0);
    return real / f;
  }
  return { start: MSA_INTRO_MS, enter: 350, move: 820, guard: 750, charge: 800, swap: 700, ko: 1500, end: 600 }[e.ev] || 500;
};

// ダメージの数字(場の上の層。守る側の立ち位置に置く)
function MsaDmgLayer({ e, x, delay, tier }) {
  if (!e || e.ev !== 'tech') return null;
  return (
    <div className="msa-dmgwrap" style={{ left: `${x * 100}%` }} aria-hidden="true">
      {e.hit
        ? <div key={`d-${e.k}`} className={`msa-dmg t${tier}`} data-msa-dmg={e.dmg} data-msa-tier={tier} style={{ animationDelay: `${delay}ms` }}>
            {e.crit ? <small>会心!</small> : e.guarded ? <small>ガード!</small> : null}{e.dmg}<em>DAMAGE</em>
            {(Number(e.gd) || 0) > 0 ? <i data-msa-gd={Math.round(Number(e.gd))}>ガッツ −{Math.round(Number(e.gd))}</i> : null}</div>
        : <div key={`d-${e.k}`} className="msa-dmg miss" data-msa-miss style={{ animationDelay: `${delay}ms` }}><b>MISS</b>よけた!</div>}
    </div>
  );
}

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
function MsaFighter({ side, member, x, e, foeX, hpNow, reduce, idleOk, gd, fx, motionOn = true, maxHp = 0, gutsNow = null, lean = 0 }) {
  fx = fx || { pre: 0, stop: 0, fin: false, big: false };
  const sp = member ? member.species : '';
  const src = mscMonImg(sp);
  // 染めた色(member.colors。モンサクの育てるモンスターだけ。芯へは渡さない見せる用の値)があれば染めた絵
  const img = member && Array.isArray(member.colors) && member.colors.some(Boolean) && typeof DyedMonsterImage === 'function'
    ? <DyedMonsterImage baseId={sp} src={src} masuColors={member.colors} alt={member.name || ''} draggable={false} className={`msa-img ${side === 'A' ? 'msa-flip' : ''}`}/>
    : <img className={`msa-img ${side === 'A' ? 'msa-flip' : ''}`} src={src} alt={member ? member.name : ''} draggable={false}/>;
  const down = hpNow <= 0;
  const me = e && e.side === side;
  const foe = e && e.side && e.side !== side;
  const tech = e && e.ev === 'tech';
  let body = null; let cls = ''; const extra = [];
  let style = { left: `${x * 100}%` };
  if (tech && me && !reduce && !motionOn) {
    // 撃つ前の構え: 身を沈めて、技種の色(ちから=橙・かしこさ=青)の光を集める。大技は大きく(このあいだ場が暗くなる)
    const kd = e.tech && e.tech.kind === 'wise' ? 'wise' : 'pow';
    body = <div key={`pre-${e.k}`} className={`flex items-end justify-center ${fx.big ? 'msa-chargebig' : 'msa-wind'}`} style={{ '--msa-pre': `${fx.pre}ms` }}>{img}</div>;
    extra.push(<span key={`ab-${e.k}`} className={`msa-aura ${fx.big ? 'big' : 'wind'} ${kd}`} aria-hidden="true" style={{ '--msa-pre': `${fx.pre}ms` }}/>);
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
    // ダメージの数字は場の上の層(msa-dmgwrap・MsaStage)に出す。撃つ側の当たりの光より前に出して、数字が隠れないように
  }
  if (me && e.ev === 'guard') { cls = 'mh-card-guard'; extra.push(<span key="s" className="mh-card-shield" aria-hidden="true"/>); }
  if (me && e.ev === 'charge') {
    if (e.why === 'sulk') { cls = 'msa-sulk'; extra.push(<span key="t" className="msa-tag">そっぽ…</span>); }
    else { cls = 'msa-charge'; extra.push(<span key="a" className="msa-aura" aria-hidden="true"/>); }
  }
  let bodyStyle;
  if (me && e.ev === 'move') {
    cls = 'msa-step'; bodyStyle = { '--msa-lean': `${lean}deg` };
    if (!reduce) [0, 1, 2].forEach((j) => extra.push(<i key={`du-${e.k}-${j}`} className="msa-dust" aria-hidden="true" style={{ left: `${18 + j * 22}%`, animationDelay: `${120 + j * 190}ms`, '--msa-dx': `${(lean >= 0 ? -1 : 1) * (side === 'A' ? 1 : -1) * 16}px` }}/>));
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
    const still0 = !cls && !down && idleOk && !reduce && typeof withMonsterIdleArt === 'function' ? withMonsterIdleArt(sp, img) : img;
    // 覚醒した自分の側はキラ(超覚醒はレアキラ)をまとう。バトルカードと同じ光(84 の cardKiraWrap)
    const kira = side === 'A' && member && member.awake && !down && typeof msxKiraOf === 'function' ? msxKiraOf(member.awake) : null;
    const still = kira && typeof cardKiraWrap === 'function' ? cardKiraWrap(kira, still0, { src, calm: reduce }) : still0;
    body = <div key={`b-${e ? e.k : 0}-${cls}`} className={`flex items-end justify-center ${cls}`} style={bodyStyle}>{still}</div>;
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
function useMsaSfx(log, pos, teams, reduce, on, sf = 1) {
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
      const hitMs = reduce ? 0 : msaFxOf(log, e, reduce, sf).pre + msaMotionMs(msaMotionKind(m.species, msaTechInfo(log, e))).hit;
      if ((Number(msaTechInfo(log, e).guts) || 0) >= 40) msaSe('special');      // 大技は出だしに溜めの音
      later(hitMs, !e.hit ? 'trainingMove' : e.crit ? 'crit' : e.guarded ? 'guard' : e.side === 'A' ? 'attack' : 'enemyAttack');
    } else if (e.ev === 'guard') msaSe('guard');
    else if (e.ev === 'charge') msaSe(e.why === 'sulk' ? 'trainingBad' : 'trainingGood');
    else if (e.ev === 'move') msaSe('trainingMove');
    else if (e.ev === 'swap') msaSe('join');
    else if (e.ev === 'ko') msaSe('enemyCharge');
    else if (e.ev === 'start') { if (reduce || sf <= MSA_FAST_F) msaSe('trainingDecide'); else { msaSe('card'); later(1750, 'trainingDecide'); } }
  }, [pos, on]);
}

// ---- 場の中のライフ・ガッツの棒(2026-11-13 社長「片側が攻撃してから相手がすぐ動き出すから、もう少しなんかほしい。ライフ、ガッツの変動演出とか」) ----
//   減るとき: 減った分が淡く残り、少し遅れて追いかけて縮む(二段)。数字はカウントダウン。大きく減ると棒が揺れる。残りが少ないと赤く点滅
//   増えるとき: 光って伸びる。delay … 変わり始めるまで(当たる瞬間)/sf … 見せる速さ(×2 なら 0.55。遅れも縮める)
function MsaGauge({ value, max, kind, delay = 0, sf = 1, reduce = false }) {
  const v = Math.max(0, Number(value) || 0); const mx = Math.max(1, Number(max) || 1);
  const [shown, setShown] = useState(v); const [lag, setLag] = useState(v); const [num, setNum] = useState(v);
  const [fx, setFx] = useState(''); const [fk, setFk] = useState(0);
  const prev = useRef(v);
  useEffect(() => {
    const from = prev.current; const to = v; prev.current = to;
    if (from === to) return undefined;
    if (reduce) { setShown(to); setLag(to); setNum(to); return undefined; }
    const timers = []; let raf = 0;
    timers.push(setTimeout(() => {
      setShown(to);
      if (to < from) { setFx(from - to >= mx * 0.15 ? 'hurt big' : 'hurt'); timers.push(setTimeout(() => setLag(to), Math.round(420 * sf))); }
      else { setLag(to); setFx('gain'); }
      setFk((x) => x + 1);
      const t0 = (typeof performance !== 'undefined' ? performance.now() : Date.now()); const dur = Math.max(150, Math.round(600 * sf));
      const tick = (t) => { const p = Math.min(1, (t - t0) / dur); setNum(Math.round(from + (to - from) * p)); if (p < 1) raf = requestAnimationFrame(tick); };
      raf = requestAnimationFrame(tick);
    }, Math.max(0, Math.round(delay))));
    return () => { timers.forEach(clearTimeout); if (raf) cancelAnimationFrame(raf); setShown(to); setLag(to); setNum(to); };
  }, [v]);
  const low = kind === 'hp' && shown > 0 && shown / mx <= 0.25;
  const w = (x) => `${Math.max(0, Math.min(100, x / mx * 100))}%`;
  return (
    <div className={`msa-g ${kind} ${low ? 'low' : ''}`} data-msa-gauge={kind} data-msa-gauge-v={v}>
      <div key={fk} className={`msa-gbar ${fx}`}><i className="lag" style={{ width: w(Math.max(lag, shown)) }}/><i className="cur" style={{ width: w(shown) }}/></div>
      <b>{num}</b>
    </div>
  );
}

// 種ごとの毎ラウンドの自然回復を記録から読む(ラウンドの最初の行で、手を打っていない側の増えた分。上限で止まった行は数えない)
const msaRegenOf = (log, frames) => {
  const seen = {};
  for (let k = 1; k < frames.length; k++) {
    const f = frames[k]; const pf = frames[k - 1]; const r = log[k] || {};
    if (!(f.r > pf.r)) continue;
    ['A', 'B'].forEach((s) => {
      if (r.side === s || f.act[s] !== pf.act[s] || f.g[s] >= 100) return;
      const d = f.g[s] - pf.g[s] + (r.ev === 'tech' && r.side !== s && r.hit ? Number(r.gd) || 0 : 0);
      if (d > 0) { const key = `${s}${f.act[s]}`; (seen[key] = seen[key] || {})[d] = (seen[key][d] || 0) + 1; }
    });
  }
  const out = {};
  Object.keys(seen).forEach((key) => { out[key] = Number(Object.entries(seen[key]).sort((a, b) => b[1] - a[1])[0][0]); });
  return out;
};

// その行のガッツの増減の札(棒の下)。[{ t, cls, delay }]
const msaGutsTagsOf = (log, frames, pos, side, regen, hitMs) => {
  const f = frames[pos]; const pf = frames[pos - 1]; const r = log[pos] || {};
  if (!f || !pf || pos < 1 || f.act[side] !== pf.act[side] || !((f.hp[side] || [])[f.act[side]] > 0)) return [];
  const out = [];
  const R = f.r > pf.r ? (regen[`${side}${f.act[side]}`] || 0) : 0;
  if (R > 0) out.push({ t: `自動 +${R}`, cls: 'up', delay: 0 });
  const d = f.g[side] - pf.g[side];
  if (r.side === side) {
    const x = d - R;
    if (r.ev === 'tech') { const t = msaTechOf(log, r); if (t && t.guts) out.push({ t: `技 −${t.guts}`, cls: 'down', delay: 0 }); }
    else if (x > 0) out.push({ t: `${r.ev === 'move' ? '移動' : r.ev === 'guard' ? 'ガード' : 'ためる'} +${x}`, cls: 'up', delay: 0 });
  } else if (r.ev === 'tech' && r.hit && (Number(r.gd) || 0) > 0) out.push({ t: `削られた −${Math.round(Number(r.gd))}`, cls: 'down', delay: hitMs });
  return out;
};

// 上下の欄に出すコマ: 技の行は、当たる瞬間までは前のコマ(ライフ・ガッツが先に減って見えないように)
function useMsaShownFrame(log, frames, pos, teams, sf = 1, lite = false) {
  const reduce = useMemo(() => !!lite || msaReduce(), [lite]);
  const [hitAt, setHitAt] = useState(-1);
  const e = (log && log[pos]) || {};
  const m = e.side && teams && teams[e.side] && teams[e.side].members ? teams[e.side].members[e.i] || {} : {};
  const at = e.ev === 'tech' && !reduce ? msaFxOf(log, e, reduce, sf).pre + msaMotionMs(msaMotionKind(m.species, msaTechInfo(log, e))).hit : 0;
  useEffect(() => { if (!at) return undefined; const t = setTimeout(() => setHitAt(pos), at); return () => clearTimeout(t); }, [pos, at]);
  const k = Math.min(pos, frames.length - 1);
  return frames[at && hitAt !== pos && k > 0 ? k - 1 : k] || frames[0];
}

// 効果の帯(参考動画: 効果が出るたびに左右から細い帯がすべり込む)。行 k で出る帯 [{ side, t }]
const msaBandsOf = (log, frames, k) => {
  const r = log[k]; const f = frames[k]; const pf = frames[k - 1];
  if (!r || !f || !pf || k < 1) return [];
  const out = [];
  if (r.ev === 'guard') out.push({ side: r.side, t: '🛡 守りの構え' });
  else if (r.ev === 'charge') out.push({ side: r.side, t: r.why === 'sulk' ? '💢 そっぽを向いた' : '⚡ ガッツをためた' });
  else if (r.ev === 'move') out.push({ side: r.side, t: `👣 間合い ${AMBW_DIST[pf.d] || ''}→${AMBW_DIST[f.d] || ''}` });
  else if (r.ev === 'swap') out.push({ side: r.side, t: `🔁 ${r.name || ''} に交代` });
  else if (r.ev === 'tech' && r.hit && r.guarded) out.push({ side: r.side === 'A' ? 'B' : 'A', t: '🛡 ガードで軽減' });
  ['A', 'B'].forEach((sd) => {
    if (Number(f.g[sd]) < MSA_GUTS_TIRED && Number(pf.g[sd]) >= MSA_GUTS_TIRED && (f.hp[sd] || [])[f.act[sd]] > 0) out.push({ side: sd, t: '💦 息切れ' });
  });
  return out.map((b, j) => ({ ...b, k, j }));
};

// カメラ(参考動画: 攻め手に寄る → 当たる瞬間に受け手へ振る)。場の中身(.msa-cam)を寄せる。動きを減らす設定では動かさない
//   x … 立ち位置(場の幅に対する割合) / s … 寄せる倍率。寄せた子が少しまん中へ来るように横へずらす
// 横へのずらしは、寄せた分(はみ出した背景)の中に収める(場の端の外が見えない・背景を大きくしなくてよい)
const msaCamAt = (x, s, w) => { const lim = Math.max(0, (s - 1) * w * 0.5 - 2); const t = Math.max(-lim, Math.min(lim, (0.5 - x) * w * s * 0.55)); return `translate(${Math.round(t)}px,0px) scale(${s})`; };
const msaCamFrames = (pts, total) => {
  // pts … [[ms, transform]]。はじめと終わりは寄せない。時刻は詰まりすぎないように前から順にそろえる
  const out = [{ offset: 0, transform: 'none' }]; let last = 0;
  pts.forEach(([ms, tf]) => {
    const o = Math.min(0.96, Math.max(last + 0.02, ms / total));
    if (o <= last || o >= 0.98) return;
    out.push({ offset: o, transform: tf, easing: 'cubic-bezier(.25,.8,.35,1)' }); last = o;
  });
  out.push({ offset: 1, transform: 'none' });
  return out;
};

// ---- 場(試合の画面の共通の部品。MonsucArena と 助手マスモン対戦 β の観戦が使う) ----
//   log・frames(ambwFramesOf)・pos … いま見せている行 / teams … { A, B }(members に species・name)
//   ended … 決着を見せる(勝ち負けの印と音) / win … 'A' | 'B' | 'draw' / endSub … 印の下の小さい字
//   sound … 効果音を鳴らすか(止めて見返しているときなどは false)
//   introTitle … 試合の入りの題字(無ければ「試合開始」) / speedF … 見せる速さ(1行の長さに掛ける。×2 は 0.55)
// fill … 親の高さいっぱいに広げる(助手マスモン対戦 β の観戦・2026-11-13 段2「場を画面いっぱいに」)/ lite … 演出を少なめ(端末の動きを減らす設定と同じ扱い)
function MsaStage({ log, frames, pos, teams, venueImg, ended = false, win = null, endSub = '', sound = true, introTitle = '', speedF = 1, fill = false, lite = false }) {
  const reduce = useMemo(() => !!lite || msaReduce(), [lite]);
  const [stageW, setStageW] = useState(340);
  const stageRef = useRef(null);
  const camRef = useRef(null);
  useEffect(() => {
    const el = stageRef.current; if (!el) return undefined;
    const fit = () => setStageW(el.clientWidth || 340);
    fit();
    if (typeof ResizeObserver === 'undefined') { window.addEventListener('resize', fit); return () => window.removeEventListener('resize', fit); }
    const ro = new ResizeObserver(fit); ro.observe(el); return () => ro.disconnect();
  }, []);
  useMsaSfx(log, pos, teams, reduce, sound, Number(speedF) || 1);
  const endSaid = useRef(false);
  useEffect(() => {
    if (!ended || endSaid.current) return;
    endSaid.current = true;
    if (sound) msaSe(win === 'A' ? 'victory' : 'trainingFail');
  }, [ended]);
  // 大技のため: ため終わるまで技の動きを出さない(pos ごとに数え直す)
  const [preAt, setPreAt] = useState(-1);
  const fxNow = msaFxOf(log, log[pos], reduce, Number(speedF) || 1);
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
      // 止めるのは選手の動きと揺れだけ(閃光・数字・帯・カメラは止めない。閃光が白いまま残らないように)
      const inFighter = (a) => { const t = a.effect && a.effect.target; return !!(t && t.closest && (t.closest('.msa-f') || t.classList.contains('msa-shk'))); };
      let list = []; try { list = el.getAnimations({ subtree: true }).filter((a) => a.playState === 'running' && inFighter(a)); } catch (_) {}
      list.forEach((a) => { try { a.pause(); } catch (_) {} });
      back = setTimeout(() => list.forEach((a) => { try { a.play(); } catch (_) {} }), fxNow.stop);
    }, at);
    return () => { clearTimeout(t); if (back) clearTimeout(back); };
  }, [pos]);
  const f = frames[Math.min(pos, frames.length - 1)] || frames[0];
  const pf = f ? (frames[Math.max(0, Math.min(pos, frames.length - 1) - 1)] || f) : null;
  const e0 = log[pos] || {};
  const memberOf = (side, i) => { const t = teams[side]; const ms = (t && t.members) || []; return ms[Number.isFinite(i) ? i : (f ? f.act[side] : 0)] || ms[0] || null; };
  const e = { ...e0, k: pos, atkSp: e0.side ? (memberOf(e0.side, e0.i) || {}).species : '', tech: msaTechInfo(log, e0) };
  // 零でも2体の体と顔が見えるように、絵の幅の6割はあける(2026-11-13 社長「重なりを直して」。小さい子が大きい子の後ろに隠れた)
  const gapOf = (d) => { const g = MSA_GAP[d] != null ? MSA_GAP[d] : MSA_GAP[1]; return d === 0 ? Math.max(g, Math.min(MSA_GAP[1] - 0.04, ((fill ? 140 : 96) * 0.6) / Math.max(200, stageW))) : g; };
  // 立ち位置(2026-11-14 社長「距離の移動が違和感」): 間合いを変えた子だけが歩いて動き、相手はその場に残る。
  // 2体のまん中(c)は行ごとに前から順に決める(動いた子の相手の位置を残す)。端に寄りすぎないよう c は 0.5±MSA_C_LIM・2体が場の内側に収まる範囲に収める
  const cs = useMemo(() => {
    const out = [0.5]; let c = 0.5;
    for (let k = 1; k < frames.length; k++) {
      const r = log[k] || {}; const g0 = gapOf(frames[k - 1] ? frames[k - 1].d : 1); const g1 = gapOf(frames[k] ? frames[k].d : 1);
      if (r.ev === 'move' && (r.side === 'A' || r.side === 'B') && g0 !== g1) c = r.side === 'A' ? (c + g0 / 2) - g1 / 2 : (c - g0 / 2) + g1 / 2;
      c = Math.max(Math.max(0.5 - MSA_C_LIM, 0.09 + g1 / 2), Math.min(Math.min(0.5 + MSA_C_LIM, 0.91 - g1 / 2), c)); // 2体とも場の内側(端から9%)に収まる範囲
      out.push(c);
    }
    return out;
  }, [log, frames, stageW, fill]);
  const gap = gapOf(f ? f.d : 1);
  const cNow = cs[Math.min(pos, cs.length - 1)] != null ? cs[Math.min(pos, cs.length - 1)] : 0.5;
  const xA = cNow - gap / 2; const xB = cNow + gap / 2;
  // カメラの横の追いかけ: 2体のまん中が画面のまん中へ来るよう、場の中身を横へ送る(歩くのと同じ速さ・同じゆるみ)
  const panX = reduce ? 0 : (0.5 - cNow) * stageW * MSA_PAN_K;
  const scrX = (x) => x + (reduce ? 0 : (0.5 - cNow) * MSA_PAN_K); // 画面の上での位置(カメラの寄せの中心に使う)
  // 歩く向き: 間合いを詰める=前のめり / 下がる=のけぞる(A は右向き・B は左向き)
  const walkLean = e0.ev === 'move' && pf && f && e0.side ? (f.d < pf.d ? 1 : -0.6) * (e0.side === 'A' ? 1 : -1) * 7 : 0;
  const fx = msaFxOf(log, e0, reduce, Number(speedF) || 1);
  const hitMs = e.ev === 'tech' && !reduce ? fx.pre + msaMotionMs(msaMotionKind(e.atkSp, e.tech)).hit : 0;
  // カメラ: 行ごとに1回。技は攻め手へ寄る → 当たる瞬間に受け手へ振る/KO は倒れた子へ/守る・ためる・動くは軽く寄る
  useEffect(() => {
    const el = camRef.current; const e1 = log[pos];
    if (reduce || ended || !el || !e1 || typeof el.animate !== 'function') return undefined;
    const total = Math.round(msaStepMs(e1, teams[e1.side], reduce, log, Number(speedF) || 1) * (Number(speedF) || 1));
    const w = el.clientWidth || stageW;
    const sx = (sd) => scrX(sd === 'A' ? xA : xB);
    let kf = null;
    if (e1.ev === 'tech' && e1.side) {
      if (total < hitMs + 300) return undefined; // 速くしていて間に合わないときは寄せない
      const s1 = fx.big ? 1.34 : 1.2; const ax = sx(e1.side); const dx = sx(e1.side === 'A' ? 'B' : 'A');
      const sw = fx.big ? 1.5 : 1.36; // 構えの一拍は攻め手にぐっと寄る
      kf = msaCamFrames([
        ...(fx.pre > 0 ? [[Math.max(110, fx.pre * 0.5), msaCamAt(ax, sw, w)], [fx.pre, msaCamAt(ax, sw, w)]] : []),
        [fx.pre > 0 ? fx.pre + 90 : Math.min(280, Math.max(120, hitMs * 0.45)), msaCamAt(ax, s1, w)],
        [hitMs - 60, msaCamAt(ax * 0.55 + dx * 0.45, s1, w)],
        [hitMs + 110, msaCamAt(dx, e1.hit ? s1 + 0.08 : s1, w)],
        [total - 280, msaCamAt(dx, s1 - 0.04, w)],
      ], total);
    } else if (e1.ev === 'ko' && e1.side) {
      kf = msaCamFrames([[260, msaCamAt(sx(e1.side), 1.28, w)], [total - 320, msaCamAt(sx(e1.side), 1.3, w)]], total);
    } else if ((e1.ev === 'guard' || e1.ev === 'charge' || e1.ev === 'swap') && e1.side) { // 歩く行は寄せない(場の横送りが位置について行く)
      kf = msaCamFrames([[220, msaCamAt(sx(e1.side), 1.1, w)], [total - 260, msaCamAt(sx(e1.side), 1.1, w)]], total);
    }
    if (!kf) return undefined;
    let a = null; try { a = el.animate(kf, { duration: total, fill: 'none' }); } catch (_) { a = null; }
    return () => { try { if (a) a.cancel(); } catch (_) {} };
  }, [pos, ended]);
  const regen = useMemo(() => msaRegenOf(log, frames), [log, frames]);
  if (!f) return null;
  const spots = MSA_GAP.map((_, d) => { const g = gapOf(d); return [cNow - g / 2, cNow + g / 2]; });
  const hpOf = (side) => (f.hp[side] || [])[f.act[side]];
  // ガッツの増減(足元の小さい札)は、ためた行だけ。技で使った分は技の札・削られた分は DAMAGE の下に出す
  const gdOf = (side) => {
    if (!pos || !e.side) return null;
    if (e.side === side && e.ev === 'charge' && e.why !== 'sulk') return f.g[side] - pf.g[side];
    return null;
  };
  const big = e.ev === 'tech' && (Number(e.tech.guts) || 0) >= 40;
  const foeSide = e.side === 'A' ? 'B' : 'A';
  const maxHpOf = (side) => { const f0 = frames[0]; return f0 && f0.hp && f0.hp[side] ? Number(f0.hp[side][f.act[side]]) || 0 : 0; };
  const tier = e.ev === 'tech' && e.hit ? msaDmgTier(e.dmg, maxHpOf(foeSide), e, fx) : 0;
  // 揺れの強弱: 小さい当たりは揺らさない/中は弱く/大きい当たりはふつう/会心・大技・とどめは強く
  const shakeLv = reduce || !e.hit || e.ev !== 'tech' ? 0 : tier >= 4 ? 3 : tier >= 3 ? 2 : tier >= 2 ? 1 : 0;
  const shake = shakeLv > 0;
  const p = Number.isFinite(e.p) ? Math.round(e.p) : null;
  const gutsOf = (side) => (f.g && Number.isFinite(Number(f.g[side])) ? Number(f.g[side]) : null);
  // 効果の帯: 直近の数行から、左右それぞれ新しい2本まで
  const bands = { A: [], B: [] };
  if (pos > 0 && !ended) {
    for (let k = Math.max(1, pos - 3); k <= pos; k++) if ((frames[k] || {}).r === f.r) msaBandsOf(log, frames, k).forEach((b) => { if (bands[b.side]) bands[b.side].push(b); });
    ['A', 'B'].forEach((sd) => { bands[sd] = bands[sd].slice(-2).reverse(); });
  }
  const intro = pos === 0 && e.ev === 'start' && !reduce && !ended && (Number(speedF) || 1) > MSA_FAST_F;
  const sf = Number(speedF) || 1;
  const hud = (sd) => {
    const m = memberOf(sd); const foe = e.ev === 'tech' && e.side && e.side !== sd;
    const tags = msaGutsTagsOf(log, frames, Math.min(pos, frames.length - 1), sd, regen, hitMs);
    return (
      <div key={sd} className={`msa-hud ${sd}`} data-msa-hud={sd}>
        <div className="nm">{m ? m.name : ''}</div>
        <MsaGauge kind="hp" value={hpOf(sd)} max={maxHpOf(sd)} delay={foe ? hitMs : 0} sf={sf} reduce={reduce}/>
        <MsaGauge kind="gt" value={gutsOf(sd)} max={typeof window !== 'undefined' && window.ASSISTANT_MASMON_BATTLE && window.ASSISTANT_MASMON_BATTLE.GUTS_MAX ? window.ASSISTANT_MASMON_BATTLE.GUTS_MAX : 99} delay={foe ? hitMs : 0} sf={sf} reduce={reduce}/>
        <div className="msa-gtags">{tags.map((t, j) => <span key={`${pos}-${j}`} className={`msa-gt ${t.cls}`} data-msa-gtag={t.t} style={{ animationDelay: `${t.delay}ms` }}>{t.t}</span>)}</div>
      </div>
    );
  };
  const mA = memberOf('A'); const mB = memberOf('B');
  return (
    <div className={`msa-stage${fill ? ' fill' : ''}`} ref={stageRef} data-msa-stage>
     <div className={`msa-shk ${shake ? `shake s${shakeLv}` : ''}`} key={shake ? `sh-${pos}` : 'st'} style={shake ? { animationDelay: `${hitMs}ms` } : undefined}>
      <div className="msa-cam" ref={camRef} data-msa-cam>
      <div className="msa-pan" style={{ transform: `translateX(${Math.round(panX)}px)` }} data-msa-pan>
      <div className="msa-bg" aria-hidden="true" style={{ backgroundImage: venueImg ? `linear-gradient(180deg,rgba(20,16,38,.05),rgba(20,16,38,.5)),url(${venueImg})` : undefined }}/>
      <div className="msa-floor" aria-hidden="true"/>
      {spots.map(([a, b], d) => <React.Fragment key={d}><i className={`msa-spot ${d === f.d ? 'on' : ''}`} style={{ left: `${a * 100}%` }}/><i className={`msa-spot ${d === f.d ? 'on' : ''}`} style={{ left: `${b * 100}%` }}/></React.Fragment>)}
      {e.ev === 'tech' && fx.pre > 0 && preAt !== pos && <i key={`fo-${pos}`} className={`msa-focus ${e.kind}`} aria-hidden="true" data-msa-wind style={{ '--msa-pre': `${fx.pre}ms`, '--msa-cx': `${(e.side === 'A' ? xA : xB) * 100}%` }}/>}
      {e.ev === 'tech' && fx.pre > 0 && <i key={`aim-${pos}`} className={`msa-aim ${e.kind}`} aria-hidden="true" style={{ left: `${(e.side === 'A' ? xB : xA) * 100}%`, '--msa-pre': `${fx.pre}ms` }}/>}
      {e.ev === 'tech' && fx.big && fx.pre > 0 && preAt !== pos && <i key={`dim-${pos}`} className="msa-dim" aria-hidden="true" style={{ '--msa-pre': `${fx.pre}ms`, '--msa-cx': `${(e.side === 'A' ? xA : xB) * 100}%` }}/>}
      <MsaFighter side="A" lean={e0.side === 'A' ? walkLean : 0} member={mA} x={xA} e={e} foeX={{ x: xB, w: stageW }} hpNow={hpOf('A')} reduce={reduce} idleOk gd={null} fx={fx} motionOn={!fx.pre || preAt === pos} maxHp={maxHpOf('A')} gutsNow={gutsOf('A')}/>
      <MsaFighter side="B" lean={e0.side === 'B' ? walkLean : 0} member={mB} x={xB} e={e} foeX={{ x: xA, w: stageW }} hpNow={hpOf('B')} reduce={reduce} idleOk gd={null} fx={fx} motionOn={!fx.pre || preAt === pos} maxHp={maxHpOf('B')} gutsNow={gutsOf('B')}/>
      {e.ev === 'tech' && <MsaDmgLayer key={`dl-${pos}`} e={e} x={e.side === 'A' ? xB : xA} delay={hitMs} tier={tier || 1}/>}
      {e.ev === 'tech' && fx.fin && !reduce && <i key={`fin-${pos}`} className="msa-fin" aria-hidden="true" style={{ animationDelay: `${hitMs}ms` }}/>}
      </div>
      </div>
     </div>
      {/* ここから上の層(カメラ・揺れの外。字が読めるように動かさない) */}
      {!intro && !ended && ['A', 'B'].map(hud)}
      {!intro && <div className="msa-rnd" data-msa-round={f.r || 0}><small>ラウンド</small><b>{f.r || 1}</b></div>}
      {['A', 'B'].map((sd) => (bands[sd].length ? <div key={sd} className={`msa-bands ${sd}`}>{bands[sd].map((b, j) => <span key={`${b.k}-${b.j}`} className={`msa-band ${j ? 'old' : ''}`} data-msa-band={sd}>{b.t}</span>)}</div> : null))}
      {e.ev !== 'tech' && <div className="msa-dist">{AMBW_DIST.map((n, d) => <span key={d} className={d === f.d ? 'cur' : ''}>{n}</span>)}</div>}
      {e.ev === 'tech' && <div key={`c-${pos}`} className={`msa-plate ${e.side === 'B' ? 'B' : 'A'} ${e.kind} ${big ? 'big' : ''}`} data-msa-cut={p == null ? '' : p}>
        <div><small>{e.kind === 'pow' ? '💪 ちから技' : '🧠 かしこさ技'}{p != null ? `・命中 ${p}%` : ''}{e.tech.guts ? `・ガッツ −${e.tech.guts}` : ''}</small>
          <b>{big && e.side === 'B' ? <span className="msa-bigtag">大技</span> : null}{e.name}{big && e.side !== 'B' ? <span className="msa-bigtag">大技</span> : null}</b></div></div>}
      {e.ev === 'tech' && e.hit && (e.crit || fx.fin) && !reduce && <i key={`fl-${pos}`} className={`msa-flash ${e.crit ? 'big' : 'fin'}`} aria-hidden="true" style={{ animationDelay: `${hitMs}ms` }}/>}
      {e.ev === 'tech' && e.hit && e.crit && !reduce && <div key={`cc-${pos}`} className="msa-critcut" data-msa-critcut style={{ animationDelay: `${hitMs + fx.stop}ms` }}><b>会心の一撃!</b></div>}
      {intro && (
        <div className="msa-intro" data-msa-intro aria-hidden="true">
          <div className="ph1">
            <div className="ttl">{introTitle || '試合開始'}</div>
            <div className="pa">{mA ? (Array.isArray(mA.colors) && mA.colors.some(Boolean) && typeof DyedMonsterImage === 'function' ? <DyedMonsterImage baseId={mA.species} src={mscMonImg(mA.species)} masuColors={mA.colors} alt="" draggable={false}/> : <img src={mscMonImg(mA.species)} alt=""/>) : null}<span className="nm">{mA ? mA.name : ''}</span></div>
            <div className="pb">{mB ? <img src={mscMonImg(mB.species)} alt=""/> : null}<span className="nm">{mB ? mB.name : ''}</span></div>
            <div className="vs">VS</div>
          </div>
          <div className="msa-word">READY</div>
          <div className="msa-word go">FIGHT!</div>
        </div>
      )}
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
  const [bg, setBg] = useState(msaBgRead);
  const [ctl, setCtl] = useState(msaCtlRead);   // 手動が基本。オートを選んだら保存して次の試合でも使う
  const auto = !manual || ctl === 'auto';
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
      const t = setTimeout(() => setPos(p => Math.min(last, p + 1)), Math.round(msaStepMs(cur, teams[cur.side], reduce, log, sp.f) * sp.f));
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
  // オートの手番: 芯のおすすめの手を少し置いて選ぶ(いつでも手動へ戻せるよう、1手ずつ進める)
  const autoWait = Boolean(manual && ctl === 'auto' && pos >= last && !ended && mm.pending);
  useEffect(() => {
    if (!autoWait) return undefined;
    const t = setTimeout(() => { const c = msaAutoChoice(mm.pending); if (c && mm.pick(c)) setPos(p => p + 1); else { mm.toAuto(); } }, reduce ? 60 : 220);
    return () => clearTimeout(t);
  }, [autoWait, pos, mm.tick]);
  useEffect(() => {
    if (!ended || endRef.current) return undefined;
    const t = setTimeout(() => { if (endRef.current) return; endRef.current = true; if (onEnd) onEnd(won, { choices: manual ? mm.choices : null, auto, result }); }, 1700);
    return () => clearTimeout(t);
  }, [ended]);
  // 場に出す両チーム: 育てるモンスターに染めた色(info.colors)を足す。芯の入力(input)は変えない
  const stageTeams = useMemo(() => {
    const c = info && Array.isArray(info.colors) && info.colors.some(Boolean) ? info.colors : null;
    if (!c || !teams.A || !Array.isArray(teams.A.members)) return teams;
    return { ...teams, A: { ...teams.A, members: teams.A.members.map((m, i) => (i === 0 && m ? { ...m, colors: c } : m)) } };
  }, [teams.A, teams.B, info && info.colors]);
  const fShowH = useMsaShownFrame(log, frames, pos, teams, (MSA_SPEEDS.find(x => x.id === speed) || MSA_SPEEDS[0]).f);
  if (!log.length) return <div className="msc-wrap"><p className="msc-note" style={{ textAlign: 'center', marginTop: 40 }}>試合の準備をしています…</p></div>;
  const f = frames[Math.min(pos, frames.length - 1)] || frames[0];
  const fShow = fShowH || f;
  const e = log[pos] || {};
  const st = log[0] || {};
  const maxHp = { A: st.aHp || [], B: st.bHp || [] };
  const nm = (side, i) => { const t = teams[side]; const ms = (t && t.members) || []; const m = ms[Number.isFinite(i) ? i : f.act[side]] || ms[0]; return (m && m.name) || ''; };
  const pick = (c) => { if (busy || !manual) return; msaSe('tap'); if (mm.pick(c)) setPos(p => p + 1); }; // 選んだ手の行からすぐ見せる
  const goAuto = () => { if (!manual) return; msaSe('tap'); msaCtlWrite('auto'); setCtl('auto'); };
  // とばす: 手動の試合は残りをオートで決めてから最後へ
  const skip = () => { msaSe('tap'); if (manual && !done) { mm.toAuto(); const n = mm.match ? mm.match.log.length : 0; setPos(Math.max(0, n - 1)); return; } setPos(last); };
  const showBar = Boolean(manual && !auto && !busy && !ended && mm.pending);
  return (
    <div className="msc-wrap msa" data-msc-match data-msa-pos={pos} data-msa-mode={manual ? (auto ? 'auto' : 'manual') : 'watch'}>
      <style>{MSA_CSS}</style>
      <div className="msc-top"><b>{info.title} {MSC_STARS(info.star)}</b></div>
      <MscPanel side="B" team={teams.B} frame={fShow} maxHp={maxHp} info={info} s={s}/>
      <MsaStage log={log} frames={frames} pos={pos} teams={stageTeams} venueImg={msaVenueBg(info.venue, bg)} ended={ended} win={result ? result.winner : null} introTitle={info.title} speedF={(MSA_SPEEDS.find(x => x.id === speed) || MSA_SPEEDS[0]).f}/>
      <MscPanel side="A" team={teams.A} frame={fShow} maxHp={maxHp} info={info} s={s} buffed={Boolean(info.buffs)}/>
      <div className="msa-say" data-msa-say>{msaSay(e, nm)}</div>
      <div ref={barRef}>{showBar ? <MsxManualBar opt={mm.pending} onPick={pick} onAuto={goAuto} busy={busy}/> : null}</div>
      {manual && !auto && busy && !ended ? <div className="msa-wait">{e.side === 'B' ? '相手の番…' : ' '}</div> : null}
      {(!manual || auto) && !ended ? (
        <div className="msa-tools">
          {MSA_SPEEDS.map(x => <button key={x.id} type="button" className={speed === x.id ? 'on' : ''} onClick={() => { msaSe('tap'); setSpeed(x.id); }}>{x.label}</button>)}
          <button type="button" data-msc-skip onClick={skip}>⏭ とばす</button>
          {!manual ? <MsaBgToggle bg={bg} onChange={setBg}/> : null}
        </div>
      ) : null}
      {manual && !auto && !ended ? (
        <div className="msa-tools">
          {MSA_SPEEDS.slice(0, 2).map(x => <button key={x.id} type="button" className={speed === x.id ? 'on' : ''} onClick={() => { msaSe('tap'); setSpeed(x.id); }}>見せる速さ {x.label}</button>)}
        </div>
      ) : null}
      {manual && !ended ? <div className="msa-tools" data-msa-tools2><MsaCtlToggle ctl={ctl} onChange={setCtl}/><MsaBgToggle bg={bg} onChange={setBg}/></div> : null}
    </div>
  );
}

// ---- 試合の見せ方の共通部品(2026-11-14 社長「助手バトルの方もモンサクバトルと同じにしてね。基本バトルシステムは同じ。見た目とかも」) ----
//   助手マスモン対戦β(#6045)で作った物を、モンサクの試合でも使える形でここへ置く。助手の台詞などは使う側が渡す
const MSA_SHOW_CSS = `
.msa-next{position:absolute;inset:0;z-index:12;pointer-events:none;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;background:radial-gradient(circle,#0009,#0003 75%);animation:msaSNext 1.5s ease-in-out both}
.msa-next-band{width:100%;text-align:center;padding:6px 0;background:linear-gradient(90deg,#0000,#ec4899 18%,#ec4899 82%,#0000);transform:skewY(-4deg)}
.msa-next.B .msa-next-band{background:linear-gradient(90deg,#0000,#0284c7 18%,#0284c7 82%,#0000)}
.msa-next-band small{display:block;font-size:11px;font-weight:900;letter-spacing:.4em;color:#fde68a}
.msa-next-band b{display:block;font-size:22px;font-weight:900;text-shadow:0 2px 0 #0008}
.msa-next-left{display:flex;gap:14px;font-size:11.5px;font-weight:900;background:#0f172acc;border-radius:99px;padding:3px 12px}
.msa-next-left span{display:flex;align-items:center;gap:4px}
.msa-next-left u{display:inline-block;width:9px;height:9px;border-radius:50%;background:#64748b;text-decoration:none}
.msa-next-left .A u.on{background:#f472b6}.msa-next-left .B u.on{background:#38bdf8}
.msa-next-talk{display:flex;align-items:center;gap:6px;max-width:92%;background:#fff;color:#1e1b4b;border-radius:12px;padding:4px 10px 4px 4px;font-size:12px}
.msa-next-talk img{width:30px;height:30px;border-radius:50%;object-fit:cover;object-position:top;flex:none}
.msa-call{margin:0 0 4px;padding:3px 8px;border-radius:8px;background:linear-gradient(90deg,#7c3aed55,#0000);font-size:12px;font-weight:900;color:#fde68a;animation:msaSCall .35s ease-out both;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.msa-call.crit,.msa-call.big{color:#fde047;background:linear-gradient(90deg,#b4530999,#0000)}
.msa-call.ko,.msa-call.pinch{color:#fecaca;background:linear-gradient(90deg,#b91c1c99,#0000)}
.msa-call.rev,.msa-call.last{color:#a5f3fc;background:linear-gradient(90deg,#0e749099,#0000)}
.msa-final{position:fixed;inset:0;z-index:9700;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;padding:16px;background:#160f2e center/cover no-repeat;color:#fff;cursor:pointer;overflow:hidden;animation:msaSFade .35s ease-out both}
.msa-final:before{content:"";position:absolute;inset:0;background:radial-gradient(circle at 50% 45%,#0000 0,#0009 70%)}
.msa-final.l:before{background:linear-gradient(180deg,#0f172acc,#020617ee)}
.msa-final>*{position:relative}
.msa-final-rays{position:absolute!important;left:50%;top:44%;width:640px;height:640px;margin:-320px 0 0 -320px;border-radius:50%;background:repeating-conic-gradient(#fde04700 0 9deg,#fde04740 9deg 18deg);-webkit-mask:radial-gradient(circle,#000 18%,#0000 66%);mask:radial-gradient(circle,#000 18%,#0000 66%);animation:msaSSpin 8s linear infinite}
.msa-final-big{font-size:58px;font-weight:900;font-style:italic;letter-spacing:.04em;color:#fde047;text-shadow:3px 0 0 #92400e,-3px 0 0 #92400e,0 -3px 0 #92400e,0 5px 0 #92400e,0 0 24px #fde047aa;animation:msaSStamp .6s .15s cubic-bezier(.2,1.6,.4,1) both}
.msa-final.l .msa-final-big{color:#cbd5e1;text-shadow:3px 0 0 #334155,-3px 0 0 #334155,0 -3px 0 #334155,0 5px 0 #1e293b;animation:msaSDrop .7s .1s ease-out both}
.msa-final.d .msa-final-big{color:#e2e8f0;text-shadow:0 4px 0 #475569}
.msa-final-sub{font-size:12px;font-weight:900;background:#0f172acc;border-radius:99px;padding:3px 14px;animation:msaSFade .4s .5s both}
.msa-final-hero{text-align:center;animation:msaSHero .7s .35s cubic-bezier(.2,1.4,.4,1) both}
.msa-final-hero img{display:block;width:200px;height:200px;object-fit:contain;margin:0 auto;filter:drop-shadow(0 8px 14px #000a)}
.msa-final.w .msa-final-hero img{animation:msaSHop 1.1s 1.1s ease-in-out infinite}
.msa-final.l .msa-final-hero img{filter:grayscale(.5) brightness(.75) drop-shadow(0 8px 14px #000a)}
.msa-final-hero em{display:inline-block;margin-top:2px;font-style:normal;font-size:14px;font-weight:900;background:#0f172acc;border-radius:99px;padding:2px 14px}
.msa-final-talk{display:flex;align-items:center;gap:8px;max-width:420px;width:100%;background:#fff;color:#1e1b4b;border-radius:14px;padding:6px 10px 6px 6px;font-size:13px;line-height:1.45;animation:msaSInL .45s 1s ease-out both}
.msa-final-talk img{width:48px;height:48px;border-radius:50%;object-fit:cover;object-position:top;flex:none;background:#ede9fe}
.msa-final-talk b{display:block;font-size:11px;color:#be185d}
@keyframes msaSFade{from{opacity:0}to{opacity:1}}
@keyframes msaSDrop{0%{opacity:0;transform:translateY(-30px) scale(1.3)}100%{opacity:1;transform:none}}
@keyframes msaSInL{from{opacity:0;transform:translateX(-60px)}to{opacity:1;transform:none}}
@keyframes msaSStamp{0%{opacity:0;transform:scale(2.6)}60%{opacity:1;transform:scale(.9)}100%{opacity:1;transform:scale(1)}}
@keyframes msaSBlink{0%,100%{opacity:.35}50%{opacity:1}}
@keyframes msaSNext{0%{opacity:0}12%{opacity:1}82%{opacity:1}100%{opacity:0}}
@keyframes msaSCall{from{opacity:0;transform:translateX(-14px)}to{opacity:1;transform:none}}
@keyframes msaSSpin{to{transform:rotate(360deg)}}
@keyframes msaSHero{0%{opacity:0;transform:translateY(40px) scale(.6)}100%{opacity:1;transform:none}}
@keyframes msaSHop{0%,100%{transform:none}30%{transform:translateY(-14px)}50%{transform:none}}
.msa-tap{text-align:center;font-size:12px;font-weight:900;color:#fde68a;margin-top:6px;animation:msaSBlink 1.2s 2s ease-in-out infinite both}
@media (prefers-reduced-motion:reduce){.msa-final,.msa-final *,.msa-next,.msa-call{animation:none!important}}
@media (max-height:640px){.msa-final-hero img{width:140px;height:140px}.msa-final-big{font-size:44px}}
`;
// 倒れたあとに次のモンスターが出る所(NEXT の区切りを出す・少し間を取る)
const msaIsNext = (log, k) => { const e = log[k]; if (!e || e.ev !== 'enter' || !e.side) return false; for (let j = k - 1; j >= 1; j--) if (log[j].ev === 'ko') return true; return false; };
const MSA_NEXT_MS = 1500;
// 実況の1行(会心・大ダメージ・あとがない・ダウン・最後の1体・逆転)。無ければ null。who(side, i) … 名前
const msaCallOf = (log, frames, k, maxHp, who) => {
  const e = log[k] || {}, f = frames[k], pf = frames[k - 1];
  if (!e.side || !f) return null;
  const left = (sd) => (f.hp[sd] || []).filter(h => h > 0).length;
  const many = (sd) => (maxHp[sd] || []).length > 1;
  const ratio = (fr, sd) => { const mx = (maxHp[sd] || []).reduce((a, b) => a + (Number(b) || 0), 0) || 1; return (fr.hp[sd] || []).reduce((a, h) => a + Math.max(0, Number(h) || 0), 0) / mx; };
  if (e.ev === 'ko') { const n = left(e.side); return { k: 'ko', t: n ? `${e.name}、ダウン! のこりは ${n}体!` : `${e.name}、ダウン! 勝負あり!` }; }
  if (e.ev === 'enter' && msaIsNext(log, k) && many(e.side) && left(e.side) === 1) return { k: 'last', t: `最後の1体、${who(e.side, e.i)}が出てきた!` };
  if (e.ev === 'swap') return { k: 'swap', t: `ここで交代! ${who(e.side, e.i)}が前へ!` };
  if (e.ev !== 'tech' || !e.hit) return null;
  const foe = e.side === 'A' ? 'B' : 'A';
  if (pf && k > 3) {
    const a0 = ratio(pf, 'A') - ratio(pf, 'B'), a1 = ratio(f, 'A') - ratio(f, 'B');
    if (a0 * a1 < 0 && Math.abs(a1) > 0.04) return { k: 'rev', t: `逆転! ${e.name}で 形勢が入れかわった!` };
  }
  if (e.crit) return { k: 'crit', t: `会心の一撃! ${who(e.side, e.i)}の${e.name}!` };
  const ti = Number.isFinite(e.ti) ? e.ti : f.act[foe];
  const mx = (maxHp[foe] || [])[ti] || 1, hp = (f.hp[foe] || [])[ti];
  if (e.dmg >= mx * 0.3) return { k: 'big', t: `大きい! ${e.name}で ${e.dmg}ダメージ!` };
  if (hp > 0 && hp <= mx * 0.2) return { k: 'pinch', t: `${who(foe, ti)}、あとがない!` };
  return null;
};
// 倒れたあと次のモンスターが出る所の区切り(NEXT の帯・のこりの数・ひとこと)。場の上に重ねる(場の入れ物は position:relative)
function MsaNext({ side, name, hp, names, face, line }) {
  return (
    <div className={`msa-next ${side}`} data-msa-next={side}>
      <div className="msa-next-band"><small>NEXT</small><b>{name}</b></div>
      <div className="msa-next-left">{['A', 'B'].map(x => <span key={x} className={x}>{(names || {})[x] || ''} {((hp || {})[x] || []).map((h, k) => <u key={k} className={h > 0 ? 'on' : ''}/>)}</span>)}</div>
      {line ? <div className="msa-next-talk">{face ? <img src={face} alt=""/> : null}<span>{line}</span></div> : null}
    </div>
  );
}
// 決着の大写し: 勝者・WIN/LOSE のリボン・光・音・育てた人(助手)のひとこと。タップか7秒で次へ
//   coach … { face, name, line }(無ければ出さない)。hero … 大きく映す側のモンスター { species, name }
function MsaFinish({ win, hero, rounds, reason, coach, venueImg, onGo }) {
  const done = useRef(false);
  const go = () => { if (done.current) return; done.current = true; onGo(); };
  useEffect(() => {
    msaSe(win === 'A' ? 'victory' : 'trainingFail');
    const f = win === 'A' ? setTimeout(() => msaSe('rankFanfare'), 650) : null;
    const t = setTimeout(go, 7000);
    return () => { clearTimeout(t); if (f) clearTimeout(f); };
  }, []);
  const k = win === 'A' ? 'w' : win === 'draw' ? 'd' : 'l';
  return (
    <div className={`msa-final ${k}`} data-msa-finish={k === 'w' ? 'win' : k === 'd' ? 'draw' : 'lose'} onClick={go} role="button" aria-label="結果を見る" style={venueImg ? { backgroundImage: `url(${venueImg})` } : null}>
      {k === 'w' && <i className="msa-final-rays" aria-hidden="true"/>}
      <div className="msa-final-big">{k === 'w' ? 'WIN!' : k === 'd' ? 'DRAW' : 'LOSE…'}</div>
      <div className="msa-final-sub">{k === 'w' ? '勝利!' : k === 'd' ? '引き分け' : '敗北'}・{rounds} ラウンド・{reason === 'judge' ? '判定' : '全滅で決着'}</div>
      {hero && <div className="msa-final-hero"><img src={mscMonImg(hero.species)} alt=""/><em>{k === 'w' ? 'MVP' : '勝者'} {hero.name}</em></div>}
      {coach && coach.line ? <div className="msa-final-talk">{coach.face ? <img src={coach.face} alt=""/> : null}<p>{coach.name ? <b>{coach.name}</b> : null}{coach.line}</p></div> : null}
      <div className="msa-tap">タップで結果へ ▶</div>
    </div>
  );
}

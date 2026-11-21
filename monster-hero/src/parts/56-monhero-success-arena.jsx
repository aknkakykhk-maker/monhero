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
// カメラがまん中を追う割合。2026-11-19 社長「距離感が機能していない」で 0.35 → 0: 移動の行では動いた子だけが動いて見えるよう、場を横へ送らない。
//   片寄りは、守る・ためる等の行で 2体のまん中をそっと場のまん中へ戻して直す(MSA_RECENTER)
const MSA_PAN_K = 0;
const MSA_RECENTER = 0.5; // 守る・ためる・交代などの行で、2体のまん中を場のまん中へ戻す割合(技・移動・吹き飛ばし・KO の行では戻さない)
// モンサクの大きな場(wide)の大きさと間合い(2026-11-19 社長 r1119-008「今の案はモンスターがでかい」「距離感がよわい。横幅をいかせていない」・
//   見本 docs/progress/monsuc-battle-redesign/size-maai-r1119-008.jpg)。どちらも場の幅に対する割合で、零・近・中・遠の順。
//   絵の大きさは距離で変わる(カメラが寄る・引くように見せる。背景も同じ割合で寄せる)。零は2体が触れ合う
// 2026-11-21 社長の選択 r1119-061(r1119-052 ④の見直し): 遠で小さくしすぎない。遠 10%→14%(零・近・中も少し上げる)・中心の間は遠でも両端で切れない 72%
const MSA_FIG_W = [0.22, 0.19, 0.16, 0.14]; // 絵の幅
const MSA_GAP_W = [0.22, 0.38, 0.55, 0.72]; // 2体の中心の間
const MSA_BG_ZOOM = 0.6; // 背景を寄せる強さ(遠を 1 倍として、絵の倍率の 6 割だけ背景を寄せる。零で約1.6倍)
const MSA_SAFE = 12;     // 場の内側の安全域(px。2026-11-17 仕上げ): モンスターの絵・ダメージの数字・札が場の縁で切れないよう、端からこのぶん内側に収める。寸法の棚卸しは ~/workspace/msa-stage-finish/PLAN.md の付録
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
  const cur = next === 'arena' ? 'stadium' : 'arena'; // いまの背景(2026-11-20 再点検 バ-50: 「背景を替える」と、いまの背景を小さく)
  return <button type="button" className="msa-bgsw" data-msa-bg={cur} aria-label={`背景を${MSA_BG_LABEL[next].slice(3)}にする`} onClick={() => { msaBgWrite(next); onChange(next); }}>背景を替える<small>{MSA_BG_LABEL[cur]}</small></button>;
}
// 試合の操作(2026-11-14 社長「バトルがオートだった。基本マニュアルで、オートにもできるようにして」)
//   モンサクの大会と助手マスモン対戦の試合で共通の新しいキー。'manual'(既定)/'auto'。無い・知らない値は手動として読み、消さない
const MSA_CTL_KEY = 'mh_monsuc_arena_ctl_v1';
const msaCtlNorm = (v) => (v === 'auto' ? 'auto' : 'manual');
const msaCtlRead = () => { try { return msaCtlNorm(localStorage.getItem(MSA_CTL_KEY)); } catch (_) { return 'manual'; } };
const msaCtlWrite = (v) => { try { localStorage.setItem(MSA_CTL_KEY, msaCtlNorm(v)); } catch (_) {} };
// モンサクの試合の手動/オートは「その育成の中だけ」覚える(2026-11-14 社長)。新しい育成は手動から始まる。
//   新しいキー mh_monsuc_arena_ctl_run_v1 = { id: 育成の id, ctl }。前のキー mh_monsuc_arena_ctl_v1 は消さず、モンサクの試合はもう読まない(助手マスモン対戦βは今までどおり使う)
const MSA_CTL_RUN_KEY = 'mh_monsuc_arena_ctl_run_v1';
const msaCtlRunRead = (runId) => { try { const o = JSON.parse(localStorage.getItem(MSA_CTL_RUN_KEY) || 'null'); return o && typeof o === 'object' && runId != null && String(o.id) === String(runId) ? msaCtlNorm(o.ctl) : 'manual'; } catch (_) { return 'manual'; } };
const msaCtlRunWrite = (runId, v) => { try { if (runId != null) localStorage.setItem(MSA_CTL_RUN_KEY, JSON.stringify({ id: String(runId), ctl: msaCtlNorm(v) })); } catch (_) {} };
// オートのときに選ぶ手(芯のおすすめ hint。交代の番は出せる先頭の子)。無ければ null
const msaAutoChoice = (opt) => {
  if (!opt) return null;
  if (opt.kind === 'enter') { const x = (opt.enter || []).find((y) => y && y.ok); return x ? { type: 'enter', to: x.to } : null; }
  return opt.hint && opt.hint.type ? { ...opt.hint } : null;
};
// 手動 ⇄ オートの切り替え(試合の下の帯に置く)。保存はここ(save=false なら保存しない)
function MsaCtlToggle({ ctl, onChange, save = true }) {
  const now = msaCtlNorm(ctl); const next = now === 'auto' ? 'manual' : 'auto';
  // 2026-11-20 再点検 バ-50・61: いまの状態と押したあとが1つに書かれていて分かりにくい → いまの状態だけを出す切り替え(オート 入/切)
  return <button type="button" role="switch" aria-checked={now === 'auto'} className="msa-ctlsw" data-msa-ctl={now} aria-label={next === 'auto' ? 'オートにする' : '手動にする'} onClick={() => { if (save) msaCtlWrite(next); onChange(next); }}><span className="msa-sw-em" aria-hidden="true">🤖</span>オート<i className="msa-sw" aria-hidden="true"><u/></i><b>{now === 'auto' ? '入' : '切'}</b></button>;
}
const MSA_CSS = `
.msa{display:flex;flex-direction:column;gap:6px}
.msa-stage{position:relative;height:clamp(200px,34vh,290px);border-radius:16px;overflow:hidden;background:#2a2147 center/cover no-repeat}
.msa-floor{position:absolute;left:4%;right:4%;bottom:30px;height:2px;background:linear-gradient(90deg,#fff0,#ffffff55 20%,#ffffff55 80%,#fff0);z-index:1}
.msa-spot{position:absolute;bottom:23px;width:16px;height:16px;margin-left:-8px;border-radius:50%;border:2px solid #ffffff40;background:#0f0b2280;z-index:1;transition:all .35s}
.msa-spot.on{border-color:#fde047;background:#fde04766;box-shadow:0 0 10px #fde047aa}
.msa-stage.big .msa-bg{transform-origin:50% 75%;transition:transform .64s cubic-bezier(.45,.05,.35,1)}
.msa-stage.fill.big .msa-f{transition:left .64s cubic-bezier(.45,.05,.35,1),width .64s cubic-bezier(.45,.05,.35,1),height .64s cubic-bezier(.45,.05,.35,1),margin-left .64s cubic-bezier(.45,.05,.35,1)}
.msa-stage.fill.big .msa-f img.msa-img{transition:max-width .64s cubic-bezier(.45,.05,.35,1),max-height .64s cubic-bezier(.45,.05,.35,1)}
.msa-spot.on.lb::after{content:none;position:absolute;top:14px;left:50%;transform:translateX(-50%);font-size:10px;font-weight:900;font-style:normal;color:#fde047;text-shadow:0 1px 2px #000,0 0 3px #000;white-space:nowrap}
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
.msa-tag{--msa-tx:-50%;position:absolute;z-index:8;top:-4px;left:50%;transform:translateX(-50%);white-space:nowrap;border-radius:99px;padding:2px 9px;font-size:11.5px;font-weight:900;background:#0f172acc;border:1px solid #fde04788;color:#fde68a;animation:msaPop .4s ease-out both}
.msa-charge{animation:msaCharge .7s ease-out both}
.msa-aura{position:absolute;left:50%;bottom:0;width:90px;height:90px;margin-left:-45px;border-radius:50%;background:radial-gradient(circle,#fde04788 0,#f9731644 45%,#f9731600 70%);animation:msaAura .7s ease-out both;z-index:-1;pointer-events:none}
.msa-sulk{animation:msaSulk .7s ease-in-out both}
.msa-step{transform-origin:50% 100%;animation:msaWalk .64s linear both}
.msa-pan{position:absolute;inset:0;transition:transform .64s cubic-bezier(.45,.05,.35,1);will-change:transform}
/* 横に送っても背景の端が見えないよう、絵は左右に広げて描く(広げるのは ::before だけ。要素の枠は場の中のまま) */
.msa-pan .msa-bg{background-size:0 0}
.msa-pan .msa-bg::before{content:'';position:absolute;top:0;bottom:0;left:-24%;right:-24%;background-color:#2a2147;background-image:inherit;background-size:cover;background-position:center;background-repeat:no-repeat}
/* 2026-11-20 再点検 バ-23: 登場のときに透けて「影」のように見えた(試合の前の画面で相手が誰か分からない)→ 透けさせず、下から弾んで出るだけにする */
.msa-in{animation:msaInSolid .45s ease-out both}
@keyframes msaInSolid{0%{transform:translateY(16px) scale(.8)}100%{transform:none}}
.msa-dist{position:absolute;left:0;right:0;bottom:4px;display:flex;justify-content:center;gap:5px;z-index:2}
.msa-dist span{font-size:11px;font-weight:900;padding:1px 9px;border-radius:99px;background:#0f0b2299;color:#94a3b8;transition:all .3s}
.msa-dist span.cur{background:#fde047;color:#422006}
/* 技の行でも零近中遠を出す(2026-11-19 段1)。技名の札(左下=A・右下=B)と反対の側へ寄せる */
.msa-dist.sA{justify-content:flex-end;padding-right:8px}
.msa-dist.sB{justify-content:flex-start;padding-left:8px}
.msa-round{position:absolute;left:8px;top:6px;z-index:2;font-size:11px;font-weight:900;color:#fde68a;background:#0f0b2299;border-radius:99px;padding:1px 8px}
.msa-say{min-height:22px;font-size:12.5px;font-weight:800;text-align:center;color:#fff}
/* 実況はステージの上に重ねる(2026-11-18 社長: 大会画面を極力1画面に。縦の行を返して操作に回す)。
   間合いピル(下端 6px)の上に置き、押せない飾りにする */
.msa-say.over{position:absolute;left:6px;right:6px;bottom:25px;z-index:9;min-height:0;padding:3px 10px;border-radius:9px;background:#0a0820c9;text-shadow:0 1px 2px #000;pointer-events:none}
.msa-say.over .msa-call{margin:0;padding:0;background:none;text-shadow:0 1px 3px #000}
.msa-tools{display:flex;gap:5px;align-items:center}
.msa-tools button{flex:1;min-height:44px;border-radius:10px;border:1px solid #4c4680;background:#2b2650;color:#fff;font-weight:900;font-size:12px}
.msa-tools button.on{background:#fde047;color:#422006;border-color:#fde047}
.msx .msa-tools button{text-align:center}
.msa-tools button.msa-ctlsw{flex:1.3;font-size:11.5px;white-space:nowrap;background:#3b1d5e;border-color:#a78bfa;line-height:1.05}.msa-tools button.msa-ctlsw small{display:block;font-size:9.5px;color:#ddd6fe}.msa-tools button.msa-ctlsw[data-msa-ctl=auto]{background:#14532d;border-color:#4ade80}
.msa-tools button.msa-bgsw{flex:1.4;font-size:11px;white-space:nowrap;background:#1e1b3a;border-color:#6b64a8;line-height:1.1}.msa-tools button.msa-bgsw small{display:block;font-size:10px;color:#cbd5e1}
.msa-tools button.msa-ctlsw{display:flex;align-items:center;justify-content:center;gap:4px;font-size:12px}
@media (max-width:379.98px){.msa-tools button.msa-ctlsw .msa-sw-em{display:none}.msa-tools button.msa-ctlsw{gap:3px;font-size:11px}.msa-sw{width:24px}.msa-ctlsw[data-msa-ctl=auto] .msa-sw u{left:10px}}.msa-tools button.msa-ctlsw b{font-size:12px}
.msa-sw{position:relative;display:inline-block;width:28px;height:16px;border-radius:99px;background:#475569;flex:none}.msa-sw u{position:absolute;top:2px;left:2px;width:12px;height:12px;border-radius:50%;background:#fff;transition:left .2s}
.msa-ctlsw[data-msa-ctl=auto] .msa-sw{background:#22c55e}.msa-ctlsw[data-msa-ctl=auto] .msa-sw u{left:14px}
.msa-wait{font-size:11.5px;color:#cbd5e1;text-align:center}
.msa-tools button.msa-pause{flex:.55;min-width:44px}
/* 手動の道具行は1行に集約(2026-11-18 社長: 極力1画面に)。速さは短い札、切替に幅を回す */
.msa[data-msa-mode=manual] .msa-tools>button{flex:.8}
.msa[data-msa-mode=manual] .msa-tools button.msa-pause{flex:.55}
.msa[data-msa-mode=manual] .msa-tools .msa-ctlsw{flex:1.8}
.msa[data-msa-mode=manual] .msa-tools .msa-bgsw{flex:1.6}
.msa-tools .msa-ctl,.msa-tools .msa-bgt{white-space:nowrap}
.msa-tools button{min-width:0;padding-left:2px;padding-right:2px}
.msa-cardsrow{flex:none}
/* 段2(2026-11-19・docs/progress/monsuc-battle-redesign/layout2): 相手の技の枠/場/実況/自分の技の枠。どちらの枠も零近中遠に1技ずつ(同じ形) */
.msa-rowh{display:flex;align-items:baseline;gap:6px;font-size:11px;font-weight:900;color:#cbd5e1;margin:0 2px 2px}
.msa-rowh small{font-size:9.5px;font-weight:700;color:#94a3b8;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.msa-foe{flex:none}
.msa-foe .msa-dc-c{border-color:#155e75;background:#0f2530}
/* 相手の、いまの間合いの枠を光らせる。危なさの段は光の強さだけで分ける(字は出さない) */
.msa-foe .msa-dc-c.now{border-color:#f43f5e;background:#3b1424;color:#fff;box-shadow:0 0 0 1px #f43f5e88 inset,0 0 6px #f43f5e66}
.msa-foe[data-msa-danger="2"] .msa-dc-c.now{box-shadow:0 0 0 2px #f43f5e inset,0 0 12px #f43f5eaa}
.msa-foe[data-msa-danger="3"] .msa-dc-c.now{box-shadow:0 0 0 2px #fb7185 inset,0 0 18px #f43f5e;animation:msaDanger 1.1s ease-in-out infinite}
@keyframes msaDanger{50%{box-shadow:0 0 0 2px #fda4af inset,0 0 26px #f43f5e}}
@media (prefers-reduced-motion:reduce){.msa-foe .msa-dc-c.now{animation:none!important}}
.msa-foe .msa-dc-c.now .msa-dc-h em{background:#f43f5e;color:#fff}
.msa-foe[data-msa-danger="0"] .msa-dc-c.now{border-color:#64748b;background:#1b1733;box-shadow:none;animation:none}
/* 使った技は、そのモンスターが次に技を出すまで札に白い点線の印を残す */
.msa-dc-c.use{outline:2px dashed #ffffffcc;outline-offset:-3px}
/* 実況は場の外・場のすぐ下の1行(技名の札・数字に重ならない) */
.msa.msa-mv>.msa-main>.msa-say,.msa.msa-mv .msa-main .msa-say{min-height:24px;padding:3px 8px;border-radius:9px;background:#0a0820c9;display:flex;align-items:center;justify-content:center;overflow:hidden}
.msa.msa-mv .msa-say .msa-call{margin:0;padding:0;background:none;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
/* 技名の札は場の上(体力の帯の下)へ。零近中遠の字はいつも下のまん中 */
.msa-stage.big .msa-plate{bottom:auto;top:62px}
.msa-stage.big .msa-dist.sA,.msa-stage.big .msa-dist.sB{justify-content:center;padding:0}
.msa-gtag{--msa-tx:-50%;position:absolute;z-index:8;bottom:-16px;left:50%;transform:translateX(-50%);white-space:nowrap;border-radius:99px;padding:0 7px;font-size:10.5px;font-weight:900;line-height:16px;animation:msaPop .45s ease-out both}
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
/* 大きな場では、オーラの箱を絵の幅に合わせる(小さな絵で場いっぱいに広がりすぎないように。2026-11-17 仕上げ) */
.msa-stage.big .msa-aura.big{width:var(--msa-ab,150px);height:var(--msa-ab,150px);margin-left:calc(var(--msa-ab,150px) / -2)}
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
@keyframes msaPop{0%{opacity:0;transform:translateX(var(--msa-tx,0)) translateY(10px) scale(.7)}35%{opacity:1;transform:translateX(var(--msa-tx,0)) translateY(-4px) scale(1.12)}100%{opacity:1;transform:translateX(var(--msa-tx,0)) translateY(-12px) scale(1)}}
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
.msa-g b .msa-gl{font-size:9.5px;margin-right:2px;color:#fde68a}.msa-g b .msa-gl.hp{color:#bbf7d0}
.msa-g.hp b{min-width:58px}
.msa-rnd b .mx{font-size:12px;color:#cbd5e1;-webkit-text-stroke:0;margin-left:1px}
/* 2026-11-20 API: 名前が 11px で観客席に埋もれる → 13px・暗い下地 */
.msa-hud .nm{font-size:13px;background:#0f0b22b3;border-radius:6px;padding:0 6px;width:max-content}
.msa-g.gt b{min-width:52px;font-size:11px}
/* 2026-11-20 再点検 バ-10: 決着の字が2体の上に重なって絵を隠していた → 字は場の上の方へ。負けの姿も見えるように暗くするのは上だけ */
.msa-end{justify-content:flex-start;padding-top:18%;background:linear-gradient(180deg,#000b,#0004 45%,#0000 70%)}
.msa-end .msa-endgo{pointer-events:auto;position:absolute;left:50%;bottom:12px;transform:translateX(-50%);min-width:160px;min-height:44px;border-radius:12px;border:2px solid #fde047;background:#422006e6;color:#fde047;font-size:15px;font-weight:900;font-family:inherit;animation:msaIn .4s .9s ease-out both}
.msa-sulkstamp small.why{display:block;width:max-content;max-width:100%;margin:3px auto 0;background:#1e1b4bdd;color:#e0e7ff;font-size:11px}
/* 2026-11-20 再点検 バ-51: ラウンドの数字に背景の赤い飾りが重なって読みにくい → 数字に暗い下地を敷く */
.msa-rnd b{background:#0f0b22cc;border-radius:10px;padding:2px 8px 3px;min-width:34px;text-align:center}
.msa-gbar.hurt{animation:msaBarHit .35s ease-out}
.msa-gbar.hurt.big{animation:msaBarShake .45s ease-out}
.msa-gbar.gain{animation:msaBarGlow .7s ease-out}
.msa-gtags{display:flex;flex-wrap:wrap;gap:3px;min-height:14px}
.msa-hud.B .msa-gtags{justify-content:flex-end}
.msa-gt{font-size:9.5px;font-weight:900;line-height:14px;padding:0 5px;border-radius:99px;white-space:nowrap;animation:msaTagIn .35s ease-out both}
@keyframes msaTagIn{0%{opacity:0;transform:scale(.6)}60%{opacity:1;transform:scale(1.12)}100%{opacity:1;transform:none}}
.msa-gt.up{background:#facc15;color:#422006}.msa-gt.down{background:#475569;color:#f1f5f9}
/* モンサクの画面の大きな浮き文字 .msx .up(56-monhero-success-css)が、ガッツの増減の小札 .up にも当たって大きく浮き、体力の数字を隠していた(r1115-202 M13)。小札の形に戻す */
.msa-hud .msa-gt.up,.msa-hud .msa-gt.down{position:static;font-size:9.5px;line-height:14px;text-shadow:none;color:#422006}
.msa-hud .msa-gt.down{color:#f1f5f9}
.msa-stage .msa-gtag.up,.msa-stage .msa-gtag.down{position:absolute;font-size:10.5px;line-height:16px;text-shadow:none;color:#422006}
.msa-stage .msa-gtag.down{color:#e2e8f0}
.msa-bands{top:70px}
@keyframes msaLow{50%{opacity:.45}}
@keyframes msaBarShake{0%,100%{transform:none;box-shadow:0 0 10px #ef4444}20%{transform:translate(-4px,1px)}40%{transform:translate(4px,-1px)}60%{transform:translate(-2px,0)}80%{transform:translate(1px,0)}}
@keyframes msaBarHit{0%{box-shadow:0 0 8px #f87171}100%{box-shadow:0 0 0 #f8717100}}
@keyframes msaBarGlow{0%{box-shadow:0 0 0 #fde04700}30%{box-shadow:0 0 10px #fde047,inset 0 0 4px #fff}100%{box-shadow:0 0 0 #fde04700}}
/* ---- 撃つ前の構えの一拍(2026-11-13 社長「攻撃前にもう1アクセントほしいね」) ---- */
.msa-wind{animation:msaWind var(--msa-pre,380ms) ease-in both}
.msa-aura.wind{width:130px;height:130px;margin-left:-65px;bottom:-6px;animation:msaAuraWind var(--msa-pre,380ms) ease-out both}
.msa-stage.big .msa-aura.wind{width:var(--msa-aw,130px);height:var(--msa-aw,130px);margin-left:calc(var(--msa-aw,130px) / -2)}
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
/* モンサクの試合の場の入れ物(2026-11-14 社長「バトルの画面が小さい」)。オートは縦の6割ほど、手動は手番の帯が入るぶんだけ低く(それでも画面の半分ほど) */
/* 縦は 帯 → 場 → 札 → ボタン列。場が残りの高さを全部もらう(画面の決まり docs/spec/MONSUC_UI.md ①)。手番の帯が高くて入らないときだけ画面ごと送る */
/* 試合の画面の並べ方はここ1か所(MsaMatchView・段3b r1119-070)。モンサクの大会・助手マスモン対戦βが同じ並べ方を使う */
.msa.msa-mv{display:flex;flex-direction:column;gap:8px;min-width:0;height:100%;min-height:0}
.msa-mv .msa-why{display:flex;align-items:flex-start;gap:6px;margin-top:-2px}
.msa-mv .msa-why img{width:24px;height:24px;border-radius:50%;object-fit:cover;object-position:top;flex:none;background:#ede9fe}
.msa-mv .msa-why p{position:relative;margin:0;min-width:0;padding:3px 9px;border-radius:10px;background:#fff;color:#1e1b4b;font-size:11.5px;font-weight:700;line-height:1.35}
.msa-mv .msa-why p:before{content:"";position:absolute;left:-5px;top:7px;border:5px solid transparent;border-left:0;border-right-color:#fff}
.msa-mv .msa-seek{flex:none}
.msa-stagebox{flex:1 1 auto;min-height:300px;position:relative}
/* 手動の試合(2026-11-15 社長 r1115-050② 案L1): 操作欄はいつも出したまま(演出中は押せない形)にして、場の高さを番ごとに変えない。場は残りの高さに合わせて縮み、下限(当初220px)を下回る低い画面は縦に流す(r1115-193 案③)。下限は 2026-11-17 の場の仕上げで 240px に広げた(安全域ぶん。低い縦画面で場を固定する 200px の規則 r1115-202 M14 はそのまま) */
.msa.msa-mv[data-msa-mode=manual]{height:auto;min-height:100%}
/* 2026-11-17 社長「バトル画面が小さすぎてみにくすぎる」: 手動の場は「残りの高さ」を待つ作りをやめ、画面の高さの46%を先に取る(下限300px・上限520px)。広がったぶん操作欄は下へ送るが、場面は上に留まる(下の portrait の規則)ので、送っても場・体力の帯・実況はいつも見える。絵の大きさは場の高さから決まる(bigFh)ため、モンスターも一緒に大きくなる */
/* 2026-11-18 社長「極力1画面に」: 実況を場の上に重ね・道具行を1行に集約・操作欄を圧縮したうえで、場は 42.5% に戻して 390×844 で主要操作までスクロールなしに収める(場は拡大前の作りよりなお大きい) */
.msa[data-msa-mode=manual] .msa-stagebox{flex:none;height:clamp(300px,42.5vh,520px);min-height:300px}
/* 2026-11-19 段1(P3): オートでも手動と同じ高さにする。操作の切り替えで場の高さ・絵の大きさが変わらないように(オートは残りの高さを全部もらって 520px まで伸びていた) */
.msa.msa-mv .msa-stagebox,.msa.msa-mv[data-msa-mode=manual] .msa-stagebox{flex:none;height:clamp(300px,50vh,420px);min-height:300px}
/* 縦は部品どうしのすき間を 8→5px に詰め、手動でも下の道具の段まで1画面に入れる(2026-11-20 API の点検 r3-MA1: 札の字を上げた分) */
@media (orientation:portrait){.msa.msa-mv{gap:5px}}
/* 2026-11-20 再点検 バ-24・32・35・44: 縦 390×844・PC 1280×800 で下のボタン列が画面の外に出ていた → 場の高さは MonsucArena が画面に残る高さを測って決める(上限 420px・下限 260px。インラインの height) */
.msa-stage.fill.big .msa-f,.msa-stage.fill.big .msa-dmgwrap{width:var(--msa-fw);margin-left:calc(var(--msa-fw) / -2);height:var(--msa-fh);bottom:25%}
.msa-stage.fill.big .msa-f img.msa-img{max-width:var(--msa-fw);max-height:calc(var(--msa-fh) - 10px)}
.msa-stage.fill.big .msa-f .msa-shadow{width:calc(var(--msa-fw) * .56);margin-left:calc(var(--msa-fw) * -.28)}
.msa-stage.big .msa-floor{bottom:25%}
.msa-stage.big .msa-spot{bottom:calc(25% - 7px)}
.msa-stage.big .msa-aim{bottom:calc(25% + 28px)}
/* 大きな場では、ダメージの数字を場の上端(体力の棒)にかからない高さへ下げる(r1115-157 ミハリの気づき) */
.msa-stage.big .msa-dmg{top:24%}
.msa-stage.big .msa-hx{bottom:calc(25% + var(--msa-fh,170px) * .5);transform:scale(1.15)}
.msa-stage.big .msa-tr{bottom:calc(25% + var(--msa-fh,170px) * .5)}
.msa-topline{flex-wrap:wrap;row-gap:2px}
.msa-topline b.msc-ttl{flex:0 1 auto;font-size:13px;padding:2px 12px} /* バ-42: 見出しは組み合わせ表・受付と同じ形 */
.msa-topline .msc-buff{font-style:normal;font-size:10.5px}
.msa-topline .msa-breeder{font-size:11px;color:#cbd5e1;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:55%}
/* 場の側(帯・場・実況)と操作の側(札・手番の帯・ボタン)。縦では入れ物を作らず(display:contents)今までの並びのまま */
.msa-main,.msa-side{display:contents}
/* 横向き(r1115-202 H3): 場面(左)+ 札(右)の2列。場面は左に留めたまま、右の札だけを縦に送る(体力の帯と札が同時に見える) */
@media (max-height:500px) and (orientation:landscape){
  .msa.msa-mv{height:auto;max-width:none;flex-direction:row;align-items:flex-start;gap:10px}
  /* 2026-11-19 社長の選択 A①: 場を画面の約 2/3 に広げ、操作は右の 1/3 に詰める(以前は 1.1:1 で場が半分) */
  .msa-main{display:flex;flex-direction:column;gap:6px;flex:2 1 0;min-width:0;position:sticky;top:0;height:calc(var(--mh-vh) - 66px);min-height:240px}
  .msa-side{display:flex;flex-direction:column;gap:8px;flex:1 1 0;min-width:0}
  .msa-stagebox,.msa[data-msa-mode=manual] .msa-stagebox,.msa.msa-mv .msa-stagebox{flex:1 1 0;height:auto;min-height:0}
  .msa-main .msa-say{flex:none}
  /* 段2(2026-11-19): 自分の技の枠と操作(左)/場(まん中)/相手の技の枠(右)。枠は4つを縦に並べる */
  .msa.msa-mv .msa-side{order:-1;flex:0 0 clamp(100px,14.5vw,128px)}
  .msa.msa-mv .msa-main{flex:1 1 0;display:grid;grid-template-columns:minmax(0,1fr) clamp(100px,14.5vw,128px);grid-template-rows:auto minmax(0,1fr) auto auto;column-gap:6px;row-gap:4px}
  .msa.msa-mv .msa-main>.msa-topline{grid-column:1/3}
  .msa.msa-mv .msa-main>.msa-stagebox,.msa.msa-mv[data-msa-mode=manual] .msa-main>.msa-stagebox{grid-column:1;grid-row:2;height:auto;min-height:0}
  .msa.msa-mv .msa-main>.msa-say{grid-column:1;grid-row:3}
  .msa.msa-mv .msa-main>.msa-foe{grid-column:2;grid-row:2/5;overflow:auto}
  .msa.msa-mv .msa-main>.msa-why{grid-column:1;grid-row:4;margin-top:0}
  .msa.msa-mv .msa-side .msa-seek{margin-top:2px}
  .msa.msa-mv .msa-dc{grid-template-columns:minmax(0,1fr);gap:3px}
  .msa.msa-mv .msa-dc-c{min-height:0;padding:2px 4px}
  /* 横は枠の列を細くするため、札のダメージ・移る間合いの行を省く(ミハリ #6883: 場を画面の約2/3に) */
  .msa.msa-mv .msa-dc-c small.dmg,.msa.msa-mv .msa-dc-c small.mv{display:none}
  .msa.msa-mv .msa-side .msa-tools>*{font-size:10.5px}
  .msa.msa-mv .msxm-row.cc,.msa.msa-mv .msxm-row.cc.n5{grid-template-columns:repeat(2,minmax(0,1fr))}
  .msa.msa-mv .msa-rowh small{display:none}
  .msa.msa-mv .msa-side .msa-tools{flex-wrap:wrap;gap:3px}
  .msa.msa-mv .msa-side .msa-tools>*{flex:1 1 30%;min-width:0;font-size:11px;padding:4px 2px;white-space:nowrap}
  .msa.msa-mv .msxm.c .msxm-all{font-size:10px;padding:2px 6px;border-radius:8px}
  .msa.msa-mv .msxm.c .msxm-h{flex-wrap:wrap}
}
/* 小さい横(高さ340px以下): 札はダメージの行を省き、技名の札を小さく上へ寄せる */
@media (max-height:340px) and (orientation:landscape){
  .msa.msa-mv .msa-dc-c small.dmg,.msa.msa-mv .msa-dc-c small.mv{display:none}
  .msa.msa-mv .msa-dc-c{padding:2px 4px}
  .msa-stage.big .msa-plate{top:48px;padding:2px 12px 3px}
  .msa-stage.big .msa-plate b{font-size:15px}
  .msa-stage.big .msa-plate.big b{font-size:17px}
  .msa.msa-mv .msxm-row.cc .msxm-btn{min-height:30px;font-size:11px}
  .msa.msa-mv .msxm-row.cc .msxm-btn small{display:none}
  .msa.msa-mv .msxm.c .msxm-foot .msxm-none{display:none}
  .msa.msa-mv .msa-side .msa-tools>*{flex:1 1 22%;min-height:26px;padding:2px 1px;font-size:10px}
  .msa.msa-mv .msa-stage.fill{min-height:0}
}
/* 小さい横(568×320 など)は 2:1 だと手動の札の字が1字ずつ折り返して潰れるので 3:2 にとどめる(札の作り直しは段2) */
@media (max-height:500px) and (orientation:landscape) and (max-width:739px){
  .msa-main{flex:1.5 1 0}
}
/* 手動の縦画面は場面を上に留める(2026-11-17: r1115-202 M14 の留め方を、低い画面だけでなく縦画面全てへ広げた。場を画面の46%まで広げたので、操作欄を下へ送る間も場・体力の帯・実況が見えるように) */
@media (orientation:portrait){
  .msa[data-msa-mode=manual] .msa-main{display:block;position:sticky;top:0;z-index:6;background:#191331;padding-bottom:4px}
  .msa[data-msa-mode=manual] .msa-main .msa-topline{margin-bottom:4px}
  .msa[data-msa-mode=manual] .msa-main .msa-say{margin-top:4px}
}
/* 低い縦の画面(320×568 など・r1115-202 M14): 場面を低くして上に留め、札の所まで送っても体力の帯と場面が見えるように。画面は縦に少し流す決まりのまま */
@media (max-height:700px) and (orientation:portrait){
  .msa[data-msa-mode=manual] .msa-main{display:block;position:sticky;top:0;z-index:6;background:#191331;padding-bottom:4px}
  .msa[data-msa-mode=manual] .msa-main .msa-topline{margin-bottom:4px}
  .msa[data-msa-mode=manual] .msa-stagebox,.msa.msa-mv .msa-stagebox{height:200px;min-height:0}
  .msa[data-msa-mode=manual] .msa-main .msa-say{margin-top:4px}
}
.msa-stage.fill .msa-f,.msa-stage.fill .msa-dmgwrap{width:140px;margin-left:-70px;height:176px}
.msa-stage.fill .msa-f img.msa-img{max-width:140px;max-height:166px}
.msa-stage.fill .msa-f .msa-shadow{width:80px;margin-left:-40px}
@media (max-height:420px) and (orientation:landscape){.msa-stage{height:180px}.msa-f{height:100px}.msa-f img.msa-img{max-height:92px}}
/* ---- 技のランクの演出(r1115-157) ---- */
.msa-cut{position:absolute;inset:0;z-index:12;pointer-events:none;overflow:hidden;--k1:#fb923c;--k2:#dc2626;--k3:#fde047;animation:msaCutOut var(--cut,1000ms) linear both}
.msa-cut.wise{--k1:#67e8f9;--k2:#7c3aed;--k3:#e0e7ff}
.msa-cut>*{position:absolute;pointer-events:none}
.msa-cut .cs{inset:0;background:radial-gradient(ellipse at 50% 50%,#0f0b2299,#020208e6);animation:msaCutShade var(--cut,1000ms) ease-out both}
.msa-cut .cr{left:50%;top:50%;width:200%;padding-top:200%;margin:-100% 0 0 -100%;border-radius:50%;background:repeating-conic-gradient(from 0deg,#fff0 0 5deg,var(--k1) 5deg 6.5deg,#fff0 6.5deg 11deg);-webkit-mask:radial-gradient(circle,#0000 14%,#000 22%,#000 60%,#0000 70%);mask:radial-gradient(circle,#0000 14%,#000 22%,#000 60%,#0000 70%);opacity:.55;animation:msaCutRays var(--cut,1000ms) linear both}
.msa-cut .cb{left:-12%;right:-12%;top:30%;height:40%;display:flex;align-items:center;gap:6px;padding:0 14%;transform:skewY(-8deg);background:linear-gradient(90deg,var(--k2),var(--k1) 45%,var(--k2));box-shadow:0 0 0 3px #fff,0 0 24px var(--k1);overflow:hidden;animation:msaCutBandA var(--cut,1000ms) cubic-bezier(.2,.9,.3,1) both}
.msa-cut.B .cb{flex-direction:row-reverse;text-align:right;animation-name:msaCutBandB}
.msa-cut.band .cb{top:33%;height:34%;transform:skewY(-6deg)}
.msa-cut.band .cr{opacity:.4}
.msa-cut.full .cb{top:27%;height:46%}
.msa-cut .cl{inset:0;background:repeating-linear-gradient(90deg,#fff0 0 18px,#ffffff2e 18px 20px);animation:msaCutLines .35s linear infinite}
.msa-cut .ca{position:relative;flex:0 0 40%;height:118%;align-self:flex-end;display:flex;align-items:flex-end;justify-content:center;transform:skewY(8deg);animation:msaCutArt var(--cut,1000ms) cubic-bezier(.2,.9,.3,1) both}
.msa-cut.band .ca{flex-basis:30%;height:100%;align-self:center}
.msa-cut .ca img,.msa-cut .ca canvas{max-height:100%;max-width:100%;width:auto;height:auto;object-fit:contain;filter:drop-shadow(0 0 6px #fff) drop-shadow(0 4px 0 #0006)}
.msa-cut .ca .msa-flip{transform:scaleX(-1)}
.msa-cut .ct{position:relative;flex:1 1 auto;min-width:0;transform:skewY(8deg);color:#fff;line-height:1.05}
.msa-cut .ct small{display:block;font-size:11px;font-weight:900;color:var(--k3);letter-spacing:.06em;white-space:nowrap}
.msa-cut .ct .st{margin-left:6px;color:#fde047;letter-spacing:0;text-shadow:0 0 4px #f59e0b}
.msa-cut .ct b{display:block;font-weight:900;white-space:nowrap;color:#fff;text-shadow:2px 0 0 #1e1b4b,-2px 0 0 #1e1b4b,0 2px 0 #1e1b4b,0 -2px 0 #1e1b4b,0 4px 0 #0008,0 0 12px var(--k1);animation:msaCutName var(--cut,1000ms) cubic-bezier(.2,1.4,.4,1) both}
.msa-cut .ct small,.msa-cut .ct em{text-shadow:0 1px 2px #1e1b4b,0 0 3px #1e1b4b}
.msa-cut.wise .ct small{color:#fff}
/* 技の種類と★は、帯の色に沈まないよう暗い札に載せる(r1115-157 ミハリの気づき) */
.msa-cut .ct small{display:inline-block;color:#fff;background:#0f172ad9;border-radius:99px;padding:1px 9px 2px;text-shadow:none}
.msa-cut .ct small .st{text-shadow:0 0 3px #f59e0b}
.msa-cut .ct em{display:block;font-style:normal;font-size:11px;font-weight:800;color:#ffffffd9;margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.msa-cut .cf{inset:0;background:#fff;opacity:0;animation:msaCutFlash var(--cut,1000ms) linear both}
@keyframes msaCutOut{0%,92%{opacity:1}100%{opacity:0}}
@keyframes msaCutShade{0%{opacity:0}12%,85%{opacity:1}100%{opacity:0}}
@keyframes msaCutRays{0%{opacity:0;transform:rotate(0) scale(.6)}15%{opacity:.55}100%{opacity:.4;transform:rotate(40deg) scale(1.1)}}
@keyframes msaCutBandA{0%{clip-path:inset(0 100% 0 0)}14%,86%{clip-path:inset(0 0 0 0)}100%{clip-path:inset(0 0 0 100%)}}
@keyframes msaCutBandB{0%{clip-path:inset(0 0 0 100%)}14%,86%{clip-path:inset(0 0 0 0)}100%{clip-path:inset(0 100% 0 0)}}
@keyframes msaCutLines{to{background-position:20px 0}}
@keyframes msaCutArt{0%{transform:skewY(8deg) translateX(-60%) scale(.9);opacity:0}16%{transform:skewY(8deg) translateX(0) scale(1.06);opacity:1}80%{transform:skewY(8deg) translateX(6%) scale(1.1)}100%{transform:skewY(8deg) translateX(10%) scale(1.12);opacity:1}}
.msa-cut.B .ca{animation-name:msaCutArtB}
@keyframes msaCutArtB{0%{transform:skewY(8deg) translateX(60%) scale(.9);opacity:0}16%{transform:skewY(8deg) translateX(0) scale(1.06);opacity:1}80%{transform:skewY(8deg) translateX(-6%) scale(1.1)}100%{transform:skewY(8deg) translateX(-10%) scale(1.12);opacity:1}}
@keyframes msaCutName{0%,10%{opacity:0;transform:scale(1.8)}22%{opacity:1;transform:scale(.96)}30%,100%{opacity:1;transform:scale(1)}}
@keyframes msaCutFlash{0%,84%{opacity:0}90%{opacity:.85}100%{opacity:0}}
.msa-sl{position:absolute;z-index:2;left:var(--msa-cx,30%);top:62%;width:520px;height:520px;margin:-260px 0 0 -260px;border-radius:50%;pointer-events:none;background:repeating-conic-gradient(#fff0 0 3deg,#ffffffee 3deg 5deg,#fff0 5deg 8deg);-webkit-mask:radial-gradient(circle,#0000 18%,#000 30%,#000 60%,#0000 75%);mask:radial-gradient(circle,#0000 18%,#000 30%,#000 60%,#0000 75%);animation:msaSl var(--msa-pre,500ms) linear both}
.msa-sl.pow{filter:drop-shadow(0 0 2px #fb923c)}.msa-sl.wise{filter:drop-shadow(0 0 2px #67e8f9)}
@keyframes msaSl{0%{opacity:.6;transform:scale(1.25) rotate(0)}25%{opacity:1}100%{opacity:.8;transform:scale(.8) rotate(10deg)}}
.msa-tr{position:absolute;z-index:5;bottom:88px;height:10px;margin-top:-5px;border-radius:99px;pointer-events:none;transform-origin:left center;background:linear-gradient(90deg,#fff0,var(--k1,#fb923c) 40%,#fff);box-shadow:0 0 12px var(--k1,#fb923c);opacity:0;animation:msaTr var(--tr,240ms) ease-in both}
.msa-tr.wise{--k1:#67e8f9}.msa-tr.rev{transform-origin:right center;background:linear-gradient(270deg,#fff0,var(--k1,#fb923c) 40%,#fff)}
.msa-tr.r4,.msa-tr.r5{height:18px;margin-top:-9px}
@keyframes msaTr{0%{opacity:0;transform:scaleX(0)}30%{opacity:1}85%{opacity:1;transform:scaleX(1)}100%{opacity:0;transform:scaleX(1)}}
.msa-hx{position:absolute;z-index:8;bottom:90px;width:0;height:0;pointer-events:none;--k1:#fb923c;--k2:#dc2626;--k3:#fde047}
.msa-hx.wise{--k1:#67e8f9;--k2:#7c3aed;--k3:#e0e7ff}
.msa-hx>i{position:absolute;left:0;top:0;pointer-events:none;opacity:0}
.msa-hx .core{width:56px;height:56px;margin:-28px 0 0 -28px;border-radius:50%;background:radial-gradient(circle,#fff 0,var(--k3) 25%,var(--k1) 50%,#fff0 72%);animation:msaHxCore .45s ease-out}
.msa-hx.l2 .core{width:96px;height:96px;margin:-48px 0 0 -48px}.msa-hx.l2 .ring{width:100px;height:100px;margin:-50px 0 0 -50px;border-width:4px}
.msa-hx.l3 .core{width:150px;height:150px;margin:-75px 0 0 -75px}
.msa-hx.l4 .core{width:200px;height:200px;margin:-100px 0 0 -100px;animation-duration:.6s}
.msa-hx.l5 .core{width:250px;height:250px;margin:-125px 0 0 -125px;animation:msaHxCore5 .95s ease-out;background:radial-gradient(circle,#fff 0,#fff 14%,var(--k3) 26%,var(--k1) 44%,var(--k2) 58%,#fff0 72%)}
.msa-hx .ring{width:56px;height:56px;margin:-28px 0 0 -28px;border-radius:50%;border:3px solid var(--k3);box-shadow:0 0 10px var(--k1),inset 0 0 8px var(--k1);animation:msaHxRing .5s ease-out}
.msa-hx.l3 .ring{width:130px;height:130px;margin:-65px 0 0 -65px;border-width:5px}
.msa-hx.l4 .ring,.msa-hx.l5 .ring{width:170px;height:170px;margin:-85px 0 0 -85px;border-width:7px}
.msa-hx .ring.r3{width:240px;height:240px;margin:-120px 0 0 -120px;border-width:9px;animation:msaHxRing .8s ease-out;border-color:#fff}
.msa-hx .core.c2{width:180px;height:180px;margin:-90px 0 0 -90px;animation:msaHxCore .6s ease-out}
.msa-hx .ring.r2{animation:msaHxRing .7s ease-out;border-color:var(--k1)}
.msa-hx .rays{width:280px;height:280px;margin:-140px 0 0 -140px;border-radius:50%;background:repeating-conic-gradient(#fff0 0 8deg,var(--k3) 8deg 11deg,#fff0 11deg 22deg);-webkit-mask:radial-gradient(circle,#0000 16%,#000 26%,#0000 68%);mask:radial-gradient(circle,#0000 16%,#000 26%,#0000 68%);animation:msaHxRays .6s ease-out}
.msa-hx.l4 .rays{width:340px;height:340px;margin:-170px 0 0 -170px}
.msa-hx.l5 .rays{width:440px;height:440px;margin:-220px 0 0 -220px;animation-duration:.9s}
.msa-hx .wave{width:220px;height:30px;margin:52px 0 0 -110px;border-radius:50%;border:3px solid var(--k3);box-shadow:0 0 12px var(--k1);animation:msaHxWave .65s ease-out}
.msa-hx.l5 .wave{width:380px;margin-left:-190px}
.msa-hx .pillar{width:120px;height:520px;margin:-420px 0 0 -60px;background:linear-gradient(0deg,#fff0,var(--k1) 20%,#fff 50%,var(--k1) 80%,#fff0);filter:blur(1px);animation:msaHxPillar .9s ease-out}
.msa-hx .circle{width:200px;height:200px;margin:-100px 0 0 -100px;border-radius:50%;border:3px dashed var(--k3);box-shadow:0 0 0 8px #fff0,0 0 0 10px var(--k1),0 0 16px var(--k2);animation:msaHxCircle 1s ease-out}
.msa-hx .bit{width:12px;height:12px;margin:-6px 0 0 -6px;background:var(--k3);box-shadow:0 0 6px var(--k1);border-radius:2px;animation:msaHxBit .62s cubic-bezier(.15,.8,.3,1)}
.msa-hx.wise .bit{border-radius:0;clip-path:polygon(50% 0,62% 38%,100% 50%,62% 62%,50% 100%,38% 62%,0 50%,38% 38%);width:16px;height:16px;margin:-8px 0 0 -8px;background:#fff}
.msa-hx.l4 .bit{width:14px;height:14px}
.msa-hx.l5 .bit{width:18px;height:18px;animation-duration:.9s}
@keyframes msaHxCore{0%{opacity:0;transform:scale(.2)}12%{opacity:1;transform:scale(1)}100%{opacity:0;transform:scale(1.5)}}
@keyframes msaHxCore5{0%{opacity:0;transform:scale(.15)}10%{opacity:1;transform:scale(.9)}35%{opacity:1;transform:scale(1.15)}100%{opacity:0;transform:scale(1.6)}}
@keyframes msaHxRing{0%{opacity:0;transform:scale(.2)}15%{opacity:1}100%{opacity:0;transform:scale(2.2)}}
@keyframes msaHxRays{0%{opacity:0;transform:scale(.3) rotate(0)}20%{opacity:1}100%{opacity:0;transform:scale(1.25) rotate(30deg)}}
@keyframes msaHxWave{0%{opacity:0;transform:scaleX(.2)}20%{opacity:1}100%{opacity:0;transform:scaleX(1.5)}}
@keyframes msaHxPillar{0%{opacity:0;transform:scaleX(.1)}15%{opacity:1;transform:scaleX(1.1)}60%{opacity:.8;transform:scaleX(.8)}100%{opacity:0;transform:scaleX(.2)}}
@keyframes msaHxCircle{0%{opacity:0;transform:scale(.3) rotate(0)}20%{opacity:1;transform:scale(1) rotate(30deg)}100%{opacity:0;transform:scale(1.5) rotate(120deg)}}
@keyframes msaHxBit{0%{opacity:0;transform:rotate(var(--a)) translateX(0) scale(1.2)}10%{opacity:1}100%{opacity:0;transform:rotate(var(--a)) translateX(var(--r)) scale(.4)}}
.msa-rbg{position:absolute;inset:0;z-index:0;pointer-events:none;opacity:0;animation:msaRbg 2.6s ease-out both}
.msa-rbg.pow{background:radial-gradient(ellipse at 50% 110%,#fde047cc 0,#f97316bb 22%,#b91c1ccc 48%,#3b0a0aee 80%),repeating-linear-gradient(100deg,#0000 0 30px,#fb923c22 30px 34px)}
.msa-rbg.wise{background:radial-gradient(1.5px 1.5px at 12% 20%,#fff,#fff0),radial-gradient(2px 2px at 30% 12%,#e0e7ff,#fff0),radial-gradient(1.5px 1.5px at 52% 26%,#fff,#fff0),radial-gradient(2px 2px at 72% 10%,#c4b5fd,#fff0),radial-gradient(1.5px 1.5px at 88% 30%,#fff,#fff0),radial-gradient(1.5px 1.5px at 40% 40%,#a5f3fc,#fff0),radial-gradient(ellipse at 50% 100%,#22d3ee88 0,#4c1d95dd 40%,#0b0626f2 80%)}
/* 当たった瞬間の場全体の光と、ランク5の大揺れ */
.msa-rf{position:absolute;inset:0;z-index:11;pointer-events:none;opacity:0;background:radial-gradient(circle,#fff 0,#fde68a 35%,#fb923c 100%);mix-blend-mode:screen;animation:msaRf .5s ease-out both}
.msa-rf.wise{background:radial-gradient(circle,#fff 0,#a5f3fc 35%,#8b5cf6 100%)}
@keyframes msaRf{0%{opacity:0}6%{opacity:var(--rf,.5)}100%{opacity:0}}
.msa-shk.shake.s4{animation:msaShake4 .95s ease-out both}
@keyframes msaShake4{0%,100%{transform:none}6%{transform:translate(-18px,8px) scale(1.06)}14%{transform:translate(16px,-8px) scale(1.06)}24%{transform:translate(-14px,6px) scale(1.04)}36%{transform:translate(12px,-5px) scale(1.03)}50%{transform:translate(-8px,3px)}64%{transform:translate(6px,-2px)}80%{transform:translate(-3px,1px)}}
@keyframes msaRbg{0%{opacity:0}18%,80%{opacity:1}100%{opacity:.85}}
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
const MH_BATTLE_BGM = { n: 0, on: false, val: false, stack: [], subs: new Set() };
// 保持が曲名(track)つきなら、アレンジの「バトル」ではなくその曲にする(助手マスモン対戦βの試合を、モンサクの試合の曲 cupMatch にそろえる。2026-11-14 社長)
const mhBattleBgmEmit = () => {
  const on = MH_BATTLE_BGM.n > 0; const top = MH_BATTLE_BGM.stack.length ? MH_BATTLE_BGM.stack[MH_BATTLE_BGM.stack.length - 1].track : null;
  const val = on ? (top || true) : false; MH_BATTLE_BGM.on = on;
  if (val === MH_BATTLE_BGM.val) return; MH_BATTLE_BGM.val = val; MH_BATTLE_BGM.subs.forEach((f) => { try { f(val); } catch (_) {} });
};
const mhBattleBgmHold = (track = null) => {
  MH_BATTLE_BGM.n++; const tok = { track: typeof track === 'string' && track ? track : null }; MH_BATTLE_BGM.stack.push(tok); mhBattleBgmEmit(); let done = false;
  return () => { if (done) return; done = true; MH_BATTLE_BGM.n = Math.max(0, MH_BATTLE_BGM.n - 1); MH_BATTLE_BGM.stack = MH_BATTLE_BGM.stack.filter((x) => x !== tok); mhBattleBgmEmit(); };
};
// 部品が使う: on のあいだバトルの曲(track を渡すと、その曲)
function useMhBattleBgmHold(on, track = null) { useEffect(() => (on ? mhBattleBgmHold(track) : undefined), [on, track]); }
// 60-app が使う: いまバトルの曲にするか(曲名の文字列 か true か false)
function useMhBattleBgmOverlay() {
  const [val, setVal] = useState(MH_BATTLE_BGM.val);
  useEffect(() => { MH_BATTLE_BGM.subs.add(setVal); setVal(MH_BATTLE_BGM.val); return () => { MH_BATTLE_BGM.subs.delete(setVal); }; }, []);
  return val;
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
const msaTechInfo = (log, e) => { const t = msaTechOf(log, e); return { id: e.move, name: e.name, kind: e.kind, guts: t ? t.guts : 0 }; };
// モンサク大会の技IDから、モンバトで使うモーションを指定する(表示名の違いに依存しない)。
const MONSUC_MOCCHI_MOTIONS = Object.freeze({
  'sk-0400': skm('roll', { c:'mocchi', over:'wave', ms:640, burst:'dust' }), // ローリンモッチ
  'sk-0401': 'Mocchi-n1', // もちき
  'sk-0402': skm('hop', { c:'mocchi', over:'fist', ms:520 }), // もんた
  'sk-0403': skm('cast', { c:'mocchi', line:'ray', fx:skmFx('shot', 'spark', 1), over:'boom' }), // モッチ砲
  'sk-0404': 'Mocchi-n5', // さくら吹雪
  'sk-0405': skm('lick', { c:'pink', line:'tongue', burst:'heart' }), // ぺろりん
  'sk-0406': 'Mocchi-n2', // ガッチョ
  'sk-0407': skm('roll', { c:'gold', line:'arc', over:'wave', burst:'dust', hit2:true }), // 超ローリンモッチ
  'sk-0408': 'Mocchi-n3', // もっちゃん
  'sk-0409': 'Mocchi-n4', // ガッチャー
  'sk-0410': skm('gather', { c:'mocchi', hit:610, ms:1020, line:'ray', fx:skmFx('shot', 'spark', 3, { start:310, step:38 }), over:'wave', burst:'star' }), // 大モッチ砲
  'sk-0411': 'Mocchi-n7', // 枝垂ざくら
  'sk-0412': 'Mocchi-n8', // もっさま
  'sk-0413': skm('dive', { c:'mocchi', over:'boom', burst:'dust', hit2:true }), // 超ガッチョ
  'sk-0414': skm('cast', { c:'gold', line:'ray', fx:skmFx('shot', 'spark', 5, { start:420, step:35, s:1.4 }), over:'pillar', burst:'star', hit2:true }), // 超モッチ砲
  'sk-0415': skm('float', { c:'dark', hit:375, ms:980, fx:skmFx('rise', 'sakura', 12, { start:300, h:[315,335] }), over:'bloom', burst:'petal' }), // 宵闇ざくら
  'sk-0416': skm('flip', { c:'gold', line:'arc', over:'pillar', burst:'star', hit2:true }), // もっさまん
});
// 大会の共有技は技IDで一度だけ定義し、使い手の専用モーションを先に選ぶ。
const MONSUC_SHARED_MOTIONS = {
  'eiki_o01': skm('dash', { c:'sakura', over:'claw', fx:skmFx('shot', 'sakura', 2) }), // 桜牙
  'eiki_o18': skm('warp', { c:'blood', over:'xslash', line:'arc', fx:skmFx('fall', 'sakura', 12), burst:'petal', hit2:true }), // 絶華緋閃・零桜
  'kenshimocchi_o05': skm('slash', { c:'red', over:'xslash', line:'arc', burst:'spark', hit2:true }), // ガッチャー・クロス
  'kenshimocchi_o18': skm('dash', { c:'cosmic', over:'xslash', line:'arc', fx:skmFx('orbit', 'star', 9), burst:'star', hit2:true }), // スターバースト・ストリーム
  'kuromy_o19': skm('cast', { c:'dark', over:'shadow', fx:skmFx('shot', 'note', 4) }), // ドクロ音符ショット
  'kuromy_o20': skm('dash', { c:'dark', over:'boom', burst:'dust' }), // バク突進ずつき
  'melody_o19': skm('float', { c:'pink', over:'bloom', fx:skmFx('fall', 'note', 9) }), // 音符シャワー
  'melody_o20': skm('jump', { c:'pink', over:'boom', fx:skmFx('rise', 'heart', 4) }), // ぞうさんスタンプ
  'pandora_o03': skm('cast', { c:'dark', over:'thunder', fx:skmFx('fall', 'bolt', 5) }), // ナイトサンダー
  'pandora_o10': skm('cast', { c:'cosmic', over:'boom', fx:skmFx('shot', 'fire', 2), burst:'spark', hit2:true }), // デュアルバン
  'pandora_o19': skm('jab', { c:'dark', over:'fist', burst:'spark', hit2:true }), // ダブルはり手
  'pandora_o20': skm('kick', { c:'dark', over:'shadow', fx:skmFx('rise', 'orb', 5) }), // アビスヒールレイド
  'pandora_o21': skm('toss', { c:'holy', over:'wave', fx:skmFx('lob', 'feather', 4) }), // セラフ投げ飛ばし
  'pandora_o22': skm('spin', { c:'dark', over:'tornado', fx:skmFx('orbit', 'ghost', 7) }), // カオスファイトクラウド
  'pandora_o23': skm('kick', { c:'holy', over:'bloom', line:'arc' }), // セラフハイキック
  'pandora_o24': skm('cast', { c:'holy', over:'boom', fx:skmFx('shot', 'star', 3) }), // ルミナスバン
  'pandora_o25': skm('gather', { c:'dark', over:'boom', fx:skmFx('rise', 'orb', 8) }), // カオスビッグバン
  'pandora_o26': skm('float', { c:'cosmic', over:'pillar', fx:skmFx('fall', 'meteor', 10) }), // ノヴァコズミックバン
  'sk-0001': skm('warp', { c:'holy', over:'aurora' }), // 神域移動
  'sk-0002': skm('dive', { c:'wind', over:'tornado', fx:skmFx('rise', 'feather', 8) }), // 八嵐天衝
  'sk-0018': skm('float', { c:'pink', over:'bloom', fx:skmFx('orbit', 'heart', 4) }), // ゆうわく
  'sk-0043': skm('cast', { c:'sky', fx:skmFx('shot', 'spark', 4) }), // アサルトアロー
  'sk-0046': skm('warp', { c:'dark', over:'claw', line:'arc' }), // アサシンクロウ
  'sk-0048': skm('float', { c:'dark', over:'shadow', fx:skmFx('orbit', 'note', 6) }), // ノクターン
  'sk-0049': skm('spin', { c:'sky', over:'sword', line:'arc' }), // ブレードダンス
  'sk-0051': skm('gather', { c:'dark', over:'shadow', line:'ray', fx:skmFx('fall', 'note', 8) }), // レクイエムエンド
  'sk-0053': skm('toss', { c:'fire', over:'boom', fx:skmFx('lob', 'fire', 1) }), // グレネード
  'sk-0054': skm('dive', { c:'gold', over:'sword', line:'arc' }), // バスターソード
  'sk-0064': skm('bash', { c:'sky', over:'wave' }), // シールドバッシュ
  'sk-0074': skm('jab', { c:'sky', over:'fist', line:'arc', burst:'dust', hit2:true }), // コンビネーション
  'sk-0078': skm('toss', { c:'cosmic', fx:skmFx('shot', 'star', 1) }), // カード
  'sk-0112': skm('cast', { c:'holy', over:'pillar', line:'ray' }), // 神光よ汚れを祓え
  'sk-0113': skm('slash', { c:'holy', over:'sword', line:'arc', fx:skmFx('shot', 'spark', 3) }), // 翔べ震律の刃よ
  'sk-0117': skm('float', { c:'holy', over:'aurora', fx:skmFx('rise', 'star', 5) }), // 導け神光の道標
  'sk-0122': skm('gather', { c:'holy', over:'bloom', fx:skmFx('orbit', 'star', 6) }), // 聖光よ奇跡を灯せ
  'sk-0123': skm('float', { c:'holy', over:'bloom', fx:skmFx('fall', 'feather', 8) }), // 天の慈悲よ示されよ
  'sk-0124': skm('cast', { c:'fire', over:'pillar', fx:skmFx('rise', 'fire', 8) }), // 灰よ還りて聖火となれ
  'sk-0129': skm('gather', { c:'gold', over:'aurora', line:'ray', fx:skmFx('fall', 'star', 10) }), // 黎明よ終焉を照らせ
  'sk-0258': skm('cast', { c:'holy', over:'wave', line:'ray' }), // レイ
  'sk-0259': skm('cast', { c:'thunder', over:'thunder', fx:skmFx('fall', 'bolt', 3) }), // サンダー
  'sk-0260': skm('jab', { c:'pink', over:'fist' }), // はり手
  'sk-0261': skm('gather', { c:'holy', over:'boom', line:'ray' }), // メガレイ
  'sk-0265': skm('cast', { c:'fire', over:'boom', fx:skmFx('shot', 'fire', 1) }), // バン
  'sk-0266': skm('kick', { c:'pink', over:'bloom', fx:skmFx('rise', 'heart', 4) }), // ヒールレイド
  'sk-0267': skm('float', { c:'holy', over:'pillar', line:'ray', fx:skmFx('shot', 'spark', 4) }), // ギガレイ
  'sk-0269': skm('gather', { c:'cosmic', over:'boom', fx:skmFx('rise', 'star', 8) }), // ビッグバン
  'sk-0270': skm('toss', { c:'wind', over:'wave', line:'arc' }), // 投げ飛ばし
  'sk-0271': skm('float', { c:'cosmic', over:'pillar', line:'ray', fx:skmFx('orbit', 'star', 5) }), // アストラルレイ
  'sk-0272': skm('cast', { c:'cosmic', over:'boom', fx:skmFx('fall', 'star', 8) }), // コズミックバン
  'sk-0273': skm('spin', { c:'wind', over:'tornado', fx:skmFx('orbit', 'dust', 6) }), // ファイトクラウド
  'sk-0292': skm('jab', { c:'rock', over:'fist', line:'whip' }), // のびーるパンチ
  'sk-0295': skm('bash', { c:'rock', over:'wave', fx:skmFx('rise', 'rock', 5) }), // 地震
  'sk-0296': skm('spin', { c:'rock', over:'boom', line:'arc' }), // 大ビンタ
  'sk-0297': skm('jump', { c:'gold', over:'fist' }), // アッパー
  'sk-0298': skm('jab', { c:'rock', over:'slash', line:'arc' }), // ビンタ
  'sk-0302': skm('dive', { c:'rock', over:'boom' }), // ハエたたき
  'sk-0307': skm('bash', { c:'gold', over:'wave' }), // 掌打
  'sk-0339': skm('jab', { c:'gold', over:'fist', burst:'dust', hit2:true }), // ワン・ツー
  'sk-0347': skm('toss', { c:'gas', over:'gas', fx:skmFx('shot', 'gas', 6) }), // 大砲屁
  'sk-0350': skm('spin', { c:'gold', over:'fist', line:'arc' }), // 超バックナックル
  'sk-0384': skm('dash', { c:'rock', over:'boom' }), // 体当たり
  'sk-0385': skm('slash', { c:'white', over:'claw' }), // ひっかき
  'sk-0386': skm('dash', { c:'gold', over:'bite' }), // かみつき
  'sk-0389': skm('jab', { c:'white', over:'fist', burst:'star', hit2:true }), // ワンツー
  'sk-0394': skm('jab', { c:'thunder', over:'thunder', fx:skmFx('fall', 'bolt', 4), burst:'spark', hit2:true }), // 雷撃コンボ
  'sk-0399': skm('gather', { c:'thunder', over:'wave', fx:skmFx('orbit', 'bolt', 6) }), // 終狼咆哮
  'sk-0448': skm('cast', { c:'plant', fx:skmFx('rise', 'leaf', 3) }), // 根っこ
  'sk-0450': skm('toss', { c:'gold', over:'bloom', fx:skmFx('lob', 'orb', 3) }), // ミツ
  'sk-0452': skm('cast', { c:'plant', over:'wave', fx:skmFx('rise', 'leaf', 7), burst:'leaf', hit2:true }), // 連続根っこ
  'sk-0454': skm('cast', { c:'sakura', over:'bloom', fx:skmFx('fall', 'sakura', 9) }), // 花吹雪
  'sk-0455': skm('jab', { c:'plant', over:'claw', burst:'leaf', hit2:true }), // 連続つっつき
  'sk-0463': skm('gather', { c:'psy', over:'eye' }), // テレパシー
  'sk-0466': skm('cast', { c:'fire', over:'eye', line:'ray' }), // 熱視線
  'sk-0473': skm('hop', { c:'pink', over:'bloom', fx:skmFx('orbit', 'heart', 5) }), // ラブインパクト
  'sk-0480': skm('lick', { c:'blue', over:'bloom', fx:skmFx('shot', 'heart', 3) }), // アクアキッス
  'sk-0481': skm('cast', { c:'blue', over:'wave', fx:skmFx('rise', 'water', 5) }), // スプラッシュ
  'sk-0482': skm('cast', { c:'ice', over:'ice', fx:skmFx('fall', 'ice', 9) }), // クリスタルレイン
  'sk-0487': skm('cast', { c:'blue', over:'boom', fx:skmFx('shot', 'water', 6) }), // アクアブラスト
  'sk-0488': skm('spin', { c:'ice', over:'tornado', fx:skmFx('orbit', 'snow', 9) }), // ホワイトストーム
  'sk-0489': skm('gather', { c:'blue', over:'wave', fx:skmFx('rise', 'water', 8) }), // アクアウォール
  'sk-0511': skm('shake', { c:'psy', over:'wave', fx:skmFx('shot', 'orb', 2) }), // おんば
  'sk-0512': skm('dive', { c:'rock', over:'wave' }), // たおれこみ
  'sk-0513': skm('dash', { c:'rock', over:'boom' }), // 体当たり
  'sk-0516': skm('slash', { c:'white', over:'claw' }), // ひっかき
  'sk-0517': skm('dash', { c:'sky', over:'claw', line:'arc' }), // 針ぶっさし
  'sk-0520': skm('cast', { c:'psy', over:'aurora', fx:skmFx('shot', 'orb', 6) }), // 超おんば
  'sk-0521': skm('dash', { c:'dark', over:'claw', line:'arc', fx:skmFx('shot', 'spark', 3) }), // 超針ぶっさし
  'sk-0523': skm('roll', { c:'sky', over:'tornado', line:'arc' }), // ドリルアタック
  'sk-0524': skm('warp', { c:'cosmic', over:'aurora', fx:skmFx('orbit', 'star', 6) }), // オーロラゲート
  'sk-0526': skm('bash', { c:'red', over:'boom', fx:skmFx('rise', 'fire', 5) }), // クリムゾンブレイク
  'sk-0573': 'ygAirDive', // 空中脳天撃
  'sk-0574': 'ygGreenLight', // グリーンライト
  'sk-0575': 'ygStarBomb', // スターボム
  'sk-0576': 'ygHeadbutt', // 頭突き
  'sk-0577': 'ygWonderBlaze', // ワンダーブレイズ
  'sk-0578': 'ygTongue', // ぴろぴろ舌
  'sk-0579': 'ygManyWing', // メニーウィング
  'sk-0580': 'ygMoonDrop', // 月面水爆
  'sk-0581': 'ygRoll', // 大玉転がし
  'sk-0582': 'ygMeteor', // メテオストーム
  'sk-0583': 'ygHeavyRain', // ヘビーレイン
  'sk-0584': 'ygPapillon', // パピヨンバースト
  'sk-0585': 'ygCandy', // キャンディボム
  'sk-0586': 'ygStrawberry', // 苺大噴
  'sk-0587': 'ygShadow', // シャドウレギオン
  'sk-0588': 'ygEternalArc', // エターナルアーク
  'sk-0589': 'ygCosmo', // コスモフルーツ
  'sk-0590': 'ygAurora', // オーロラハック
  'sk-0593': skm('dash', { c:'thunder', over:'thunder', line:'arc' }), // スタナーブリッツ
  'sk-0596': skm('dive', { c:'red', over:'claw', line:'arc' }), // アサルトレイド
  'sk-0785': skm('spin', { c:'plant', over:'bloom', fx:skmFx('orbit', 'leaf', 9) }), // メニーウィング・翠
  'sk-0787': 'ygRiceShower', // ライスシャワー
  'sk-0788': 'ygCakeCut', // ケーキ入刀
  'sk-0797': skm('cast', { c:'sky', fx:skmFx('shot', 'spark', 1) }), // シングルショット
  'sk-0799': skm('warp', { c:'dark', over:'xslash', line:'arc' }), // フォルターブリッツ
  'sk-0824': skm('gather', { c:'dark', over:'bloom', fx:skmFx('rise', 'sakura', 8) }), // デスブルーム
};
const MONSUC_SPECIES_MOTIONS = {
  Mocchi: MONSUC_MOCCHI_MOTIONS,
  MelWhip: {},
  Yggdrasil: {},
  Suezo: {
    'sk-0461': 'Suezo-n1', // ツバはき
    'sk-0462': 'Suezo-n0', // しっぽアタック
    'sk-0460': 'Suezo-n2', // テレポート
    'sk-0464': 'Suezo-n5', // かみつき
    'sk-0465': 'Suezo-n4', // キッス
    'sk-0468': 'Suezo-n3', // なめる
    'sk-0467': 'Suezo-u0', // サイコキネシス
    'sk-0469': 'Suezo-n8', // ベロビンタ
    'sk-0470': 'Suezo-u4', // 歌う
    'sk-0471': 'Suezo-u3', // クロノキネシス
    'sk-0472': 'Suezo-u2', // 食う
    'sk-0474': 'Suezo-u5', // 超熱視線
  },
  Golem: {
    'sk-0293': 'Golem-n0', // でこぴん
    'sk-0294': 'Golem-n2', // キック
    'sk-0301': 'Golem-u0', // 合掌
    'sk-0300': 'Golem-u1', // フライングプレス
    'sk-0299': 'Golem-n5', // 大でこぴん
    'sk-0303': 'Golem-u2', // 竜巻アタック
    'sk-0305': 'Golem-n8', // 大ハエタタキ
    'sk-0306': 'Golem-n7', // 大キック
    'sk-0304': 'Golem-u3', // ぐるぐるアタック
  },
  Tiger: {
    'sk-0390': 'Tiger-u0', // 雷撃
    'sk-0387': 'Tiger-n4', // 影撃
    'sk-0388': 'Tiger-u1', // 冷気弾
    'sk-0393': 'Tiger-u2', // 超雷撃
    'sk-0392': 'Tiger-n8', // コンビネーション
    'sk-0391': 'Tiger-n5', // 空中回転アタック
    'sk-0395': 'Tiger-u3', // ブリザード
    'sk-0396': 'Tiger-u4', // 突き刺し
    'sk-0397': 'Tiger-u5', // 落雷共鳴
    'sk-0398': 'Tiger-u7', // ライジングブースト
  },
  Ham: {
    'sk-0340': 'Ham-n3', // 正拳
    'sk-0338': 'Ham-n1', // 飛び蹴り
    'sk-0343': 'Ham-u0', // おなら
    'sk-0341': 'Ham-n2', // バックナックル
    'sk-0342': 'Ham-n4', // 後ろ蹴り
    'sk-0346': 'Ham-n6', // ドラゴンパンチ
    'sk-0344': 'Ham-n7', // 超飛び蹴り
    'sk-0345': 'Ham-n5', // 回し蹴り
    'sk-0348': 'Ham-u1', // 瞬撃
    'sk-0349': 'Ham-n8', // ドラゴンキック
    'sk-0351': 'Ham-u3', // 暗けい
  },
  Pixie: {
    'sk-0260': 'Pixie-n0', // はり手
    'sk-0259': 'Pixie-n2', // サンダー
    'sk-0258': 'Pixie-n1', // レイ
    'sk-0263': 'Pixie-n3', // ハイキック
    'sk-0262': 'Pixie-n5', // ライトニング
    'sk-0261': 'Pixie-n6', // メガレイ
    'sk-0264': 'Pixie-n7', // なげキッス
    'sk-0266': 'Pixie-n4', // ヒールレイド
    'sk-0267': 'Pixie-u1', // ギガレイ
    'sk-0268': 'Pixie-u2', // ギガサンダー
    'sk-0269': 'Pixie-u3', // ビッグバン
    'sk-0274': 'Pixie-u4', // ギガライトニング
  },
  Mia: {
    'sk-0263': 'Mia-n3', // ハイキック
    'sk-0262': 'Mia-n5', // ライトニング
    'sk-0264': 'Mia-n7', // なげキッス
    'sk-0268': 'Mia-u2', // ギガサンダー
    'sk-0274': 'Mia-u4', // ギガライトニング
  },
  Monol: {
    'sk-0514': 'Monol-n3', // わらわら
    'sk-0515': 'Monol-u0', // トリオビームX
    'sk-0519': 'Monol-n2', // 大たおれこみ
    'sk-0518': 'Monol-u2', // トリオビームY
    'sk-0522': 'Monol-u6', // トリオビームZ
    'sk-0525': 'Monol-u8', // トリオビーム∞
  },
  Oboro: {
    'sk-0447': 'Oboro-n1', // つっつき
    'sk-0448': 'Oboro-n2', // 根っこ
    'sk-0446': 'Oboro-u0', // 種ガン
    'sk-0449': 'Oboro-u4', // 種マシンガン
    'sk-0451': 'Oboro-u1', // 葉っぱブレード
    'sk-0453': 'Oboro-u5', // フラワービーム
    'sk-0459': 'Oboro-u7', // 蒼花爆散
    'sk-0458': 'Oboro-n3', // コンビネーション
    'sk-0456': 'Oboro-u6', // 乱れ咲き
    'sk-0457': 'Oboro-n4', // 捕食
  },
  Plant: {
    'sk-0447': 'Plant-n1', // つっつき
    'sk-0446': 'Plant-u0', // 種ガン
    'sk-0449': 'Plant-u4', // 種マシンガン
    'sk-0451': 'Plant-u1', // 葉っぱブレード
    'sk-0453': 'Plant-u5', // フラワービーム
    'sk-0459': 'Plant-u7', // 蒼花爆散
    'sk-0458': 'Plant-n3', // コンビネーション
    'sk-0456': 'Plant-u6', // 乱れ咲き
    'sk-0457': 'Plant-n4', // 捕食
  },
  Zan: {
    'sk-0591': 'Zan-n1', // ミラージュシフト
    'sk-0592': 'Zan-n3', // レッグアーク
    'sk-0594': 'Zan-n4', // ソニックナイフ
    'sk-0595': 'Zan-n5', // ダブルサマー
    'sk-0798': 'Zan-u2', // メテオドライブ
    'sk-0597': 'Zan-u4', // ライジングレイヴ
    'sk-0599': 'Zan-u6', // ダークホウスト
    'sk-0598': 'Zan-u5', // アクシズバレット
  },
  Mitarashi: {
    'sk-0402': MONSUC_MOCCHI_MOTIONS['sk-0402'], // もんた
    'sk-0400': MONSUC_MOCCHI_MOTIONS['sk-0400'], // ローリンモッチ
    'sk-0401': 'Mitarashi-n1', // もちき
    'sk-0405': MONSUC_MOCCHI_MOTIONS['sk-0405'], // ぺろりん
    'sk-0406': 'Mitarashi-n2', // ガッチョ
    'sk-0403': skm('cast', { c:'fire', line:'ray', fx:skmFx('shot', 'fire', 1), over:'boom' }), // モッチ砲
    'sk-0404': 'Mitarashi-n5', // さくら吹雪
    'sk-0409': 'Mitarashi-n4', // ガッチャー
    'sk-0408': 'Mitarashi-n3', // もっちゃん
    'sk-0407': MONSUC_MOCCHI_MOTIONS['sk-0407'], // 超ローリンモッチ
    'sk-0413': MONSUC_MOCCHI_MOTIONS['sk-0413'], // 超ガッチョ
    'sk-0410': 'Mitarashi-u1', // 大モッチ砲
    'sk-0411': 'Mitarashi-n7', // 枝垂ざくら
    'sk-0412': 'Mitarashi-n8', // もっさま
    'sk-0416': MONSUC_MOCCHI_MOTIONS['sk-0416'], // もっさまん
    'sk-0415': 'Mitarashi-u5', // 宵闇ざくら
    'sk-0414': 'Mitarashi-u2', // 超モッチ砲
  },
  Ark: {
    'sk-0125': 'Ark-n2', // 神剣よ断罪を下せ
    'sk-0111': 'Ark-n0', // 我が瞳の真理を見よ
    'sk-0110': 'Ark-n4', // 世界を揺らせ
    'sk-0114': 'Ark-n6', // 白き誓い切なる願い
    'sk-0115': 'Ark-u2', // 今こそ真なる目醒め
    'sk-0118': 'Ark-n8', // 蒼き荊よ咎を穿て
    'sk-0116': 'Ark-u1', // 裁きの光よ下れ
    'sk-0120': 'Ark-u4', // 熾天の剣よ降り立て
    'sk-0119': 'Ark-u0', // 祈れ輪廻の環よ
    'sk-0121': 'Ark-u6', // 終焉に救いを与えよ
  },
  Iblis: {
    'sk-0125': 'Iblis-n2', // 神剣よ断罪を下せ
    'sk-0111': 'Iblis-n0', // 我が瞳の真理を見よ
    'sk-0110': 'Iblis-n4', // 世界を揺らせ
    'sk-0113': skm('slash', { c:'dark', over:'sword', line:'arc', fx:skmFx('shot', 'spark', 3) }), // 翔べ震律の刃よ
    'sk-0114': 'Iblis-n6', // 白き誓い切なる願い
    'sk-0112': skm('cast', { c:'dark', over:'pillar', line:'ray' }), // 神光よ汚れを祓え
    'sk-0115': 'Iblis-u2', // 今こそ真なる目醒め
    'sk-0118': 'Iblis-n8', // 蒼き荊よ咎を穿て
    'sk-0117': skm('float', { c:'dark', over:'aurora', fx:skmFx('rise', 'star', 5) }), // 導け神光の道標
    'sk-0116': 'Iblis-u1', // 裁きの光よ下れ
    'sk-0120': 'Iblis-u4', // 熾天の剣よ降り立て
    'sk-0119': 'Iblis-u0', // 祈れ輪廻の環よ
    'sk-0122': skm('gather', { c:'dark', over:'bloom', fx:skmFx('orbit', 'star', 6) }), // 聖光よ奇跡を灯せ
    'sk-0124': skm('cast', { c:'fire', over:'pillar', fx:skmFx('rise', 'fire', 8) }), // 灰よ還りて聖火となれ
    'sk-0123': skm('float', { c:'dark', over:'bloom', fx:skmFx('fall', 'feather', 8) }), // 天の慈悲よ示されよ
    'sk-0121': 'Iblis-u6', // 終焉に救いを与えよ
    'sk-0129': skm('gather', { c:'dark', over:'aurora', line:'ray', fx:skmFx('fall', 'star', 10) }), // 黎明よ終焉を照らせ
  },
  Snegurochka: {
    'sk-0477': 'Snegurochka-n0', // アイスブレード
    'sk-0475': 'Snegurochka-n2', // アクアウェイブ
    'sk-0476': 'Snegurochka-n1', // アクアウィップ
    'sk-0478': 'Snegurochka-u1', // ダブルバレッド
    'sk-0742': 'Snegurochka-u3', // プレゼントキッス
    'sk-0479': 'Snegurochka-u0', // アイスアロー
    'sk-0484': 'Snegurochka-n6', // ドルフィンブロー
    'sk-0483': 'Snegurochka-u2', // アイスコフィン
    'sk-0485': 'Snegurochka-n7', // ブラッドミスト
    'sk-0743': 'Snegurochka-n8', // ジングルベル
    'sk-0486': 'Snegurochka-u4', // クリスタルアロー
    'sk-0744': 'Snegurochka-u8', // メリークリスマス
    'sk-0491': 'Snegurochka-u7', // アクアドーム
    'sk-0490': 'Snegurochka-u6', // ホワイトエレジー
  },
  Undine: {
    'sk-0477': 'Undine-n0', // アイスブレード
    'sk-0475': 'Undine-n2', // アクアウェイブ
    'sk-0476': 'Undine-n1', // アクアウィップ
    'sk-0478': 'Undine-u1', // ダブルバレッド
    'sk-0479': 'Undine-u0', // アイスアロー
    'sk-0480': 'Undine-u3', // アクアキッス
    'sk-0484': 'Undine-n6', // ドルフィンブロー
    'sk-0483': 'Undine-u2', // アイスコフィン
    'sk-0485': 'Undine-n7', // ブラッドミスト
    'sk-0486': 'Undine-u4', // クリスタルアロー
    'sk-0491': 'Undine-u7', // アクアドーム
    'sk-0490': 'Undine-u6', // ホワイトエレジー
  },
  Yaobikuni: {
    'sk-0477': 'Yaobikuni-n0', // アイスブレード
    'sk-0475': 'Yaobikuni-n2', // アクアウェイブ
    'sk-0476': 'Yaobikuni-n1', // アクアウィップ
    'sk-0478': 'Yaobikuni-u1', // ダブルバレッド
    'sk-0479': 'Yaobikuni-u0', // アイスアロー
    'sk-0480': 'Yaobikuni-u3', // アクアキッス
    'sk-0484': 'Yaobikuni-n6', // ドルフィンブロー
    'sk-0483': 'Yaobikuni-u2', // アイスコフィン
    'sk-0485': 'Yaobikuni-n7', // ブラッドミスト
    'sk-0486': 'Yaobikuni-u4', // クリスタルアロー
    'sk-0491': 'Yaobikuni-u7', // アクアドーム
    'sk-0490': 'Yaobikuni-u6', // ホワイトエレジー
  },
  Ghost: {
    'sk-0065': 'Ghost-n1', // ソウルビーム
    'sk-0066': 'Ghost-n0', // ピコピコハンマー
    'sk-0077': 'Ghost-n2', // ハトのおとしもの
    'sk-0068': 'Ghost-n3', // びっくり
    'sk-0069': 'Ghost-n4', // 体当たり
    'sk-0078': 'Ghost-n5', // カード
    'sk-0067': 'Ghost-n6', // すてきステッキ
    'sk-0070': 'Ghost-u0', // 連続カード
    'sk-0071': 'Ghost-u1', // ドクロビーム
    'sk-0072': 'Ghost-n7', // 大パンチ
    'sk-0073': 'Ghost-u2', // 大きなおとしもの
    'sk-0080': 'Ghost-u3', // びっくりドクロ
    'sk-0079': 'Ghost-u4', // スリーセブン
    'sk-0074': 'Ghost-n8', // コンビネーション
    'sk-0075': 'Ghost-u5', // Woフォーチュン
    'sk-0084': 'Ghost-u6', // RSF
    'sk-0076': 'Ghost-u7', // 運命のコイン
  },
  Spooky: {
    'sk-0065': 'Spooky-n1', // ソウルビーム
    'sk-0066': 'Spooky-n0', // ピコピコハンマー
    'sk-0077': 'Spooky-n2', // ハトのおとしもの
    'sk-0068': 'Spooky-n3', // びっくり
    'sk-0069': 'Spooky-n4', // 体当たり
    'sk-0067': 'Spooky-n6', // すてきステッキ
    'sk-0082': 'Spooky-n5', // カード・クラブ
    'sk-0070': 'Spooky-u0', // 連続カード
    'sk-0071': 'Spooky-u1', // ドクロビーム
    'sk-0072': 'Spooky-n7', // 大パンチ
    'sk-0073': 'Spooky-u2', // 大きなおとしもの
    'sk-0080': 'Spooky-u3', // びっくりドクロ
    'sk-0079': 'Spooky-u4', // スリーセブン
    'sk-0083': 'Spooky-n8', // グリンネーション
    'sk-0075': 'Spooky-u5', // Woフォーチュン
    'sk-0084': 'Spooky-u6', // RSF
    'sk-0076': 'Spooky-u7', // 運命のコイン
  },
  Illumine: {
    'sk-0040': 'Illumine-n0', // プラズマ
    'sk-0039': 'Illumine-n1', // ヴェノムエッジ
    'sk-0064': 'Illumine-n2', // シールドバッシュ
    'sk-0041': 'Illumine-u0', // エーテルアイス
    'sk-0042': 'Illumine-n4', // モーニングスター
    'sk-0045': 'Illumine-n3', // ストレート
    'sk-0046': 'Illumine-n5', // アサシンクロウ
    'sk-0044': 'Illumine-u1', // アルカナフレア
    'sk-0043': 'Illumine-n6', // アサルトアロー
    'sk-0047': 'Illumine-u2', // アルスマグナ
    'sk-0048': 'Illumine-u3', // ノクターン
    'sk-0049': 'Illumine-n7', // ブレードダンス
    'sk-0054': 'Illumine-n8', // バスターソード
    'sk-0050': 'Illumine-u5', // クリムゾンノヴァ
    'sk-0052': 'Illumine-u4', // ミラージュクロウ
    'sk-0051': 'Illumine-u8', // レクイエムエンド
  },
  Dreamy: {
    'sk-0040': 'Dreamy-n0', // プラズマ
    'sk-0039': 'Dreamy-n1', // ヴェノムエッジ
    'sk-0055': 'Dreamy-u0', // おもちゃの爆弾
    'sk-0041': 'Dreamy-u1', // エーテルアイス
    'sk-0042': 'Dreamy-n4', // モーニングスター
    'sk-0045': 'Dreamy-n3', // ストレート
    'sk-0044': 'Dreamy-u2', // アルカナフレア
    'sk-0047': 'Dreamy-u3', // アルスマグナ
    'sk-0050': 'Dreamy-u6', // クリムゾンノヴァ
    'sk-0052': 'Dreamy-u5', // ミラージュクロウ
  },
  Kyubi: {
    'sk-0005': 'Kyubi-n0', // ひっかき
    'sk-0003': 'Kyubi-n2', // 狐火
    'sk-0004': 'Kyubi-n1', // ひのこ
    'sk-0010': 'Kyubi-n3', // 下駄蹴り
    'sk-0008': 'Kyubi-n5', // 提灯落とし
    'sk-0009': 'Kyubi-n4', // 提灯投げ
    'sk-0018': 'Kyubi-u0', // ゆうわく
    'sk-0015': 'Kyubi-u2', // 超狐火
    'sk-0017': 'Kyubi-u1', // なめろう
    'sk-0016': 'Kyubi-n6', // 火炎車
    'sk-0026': 'Kyubi-u5', // 陽炎
    'sk-0027': 'Kyubi-n7', // 神光石火
    'sk-0028': 'Kyubi-n8', // 九重神眼
    'sk-0025': 'Kyubi-u3', // 神狐蒼火
    'sk-0037': 'Kyubi-u6', // 煉獄九尾陣
    'sk-0036': 'Kyubi-u7', // 天河天翔
    'sk-0002': 'Kyubi-u4', // 八嵐天衝
    'sk-0035': 'Kyubi-u8', // 炸裂気泡陣
  },
  Orihime: {
    'sk-0005': 'Orihime-n0', // ひっかき
    'sk-0003': 'Orihime-n2', // 狐火
    'sk-0004': 'Orihime-n1', // ひのこ
    'sk-0010': 'Orihime-n3', // 下駄蹴り
    'sk-0008': 'Orihime-n5', // 提灯落とし
    'sk-0009': 'Orihime-n4', // 提灯投げ
    'sk-0496': 'Orihime-u0', // 求愛
    'sk-0023': 'Orihime-u2', // 超狐火・星
    'sk-0015': 'cardOrihime905', // 超狐火
    'sk-0017': 'cardOrihime906', // なめろう
    'sk-0016': 'Orihime-n6', // 火炎車
    'sk-0026': 'Orihime-u3', // 陽炎
    'sk-0027': 'Orihime-n7', // 神光石火
    'sk-0028': 'Orihime-n8', // 九重神眼
    'sk-0025': 'cardOrihime909', // 神狐蒼火
    'sk-0037': 'Orihime-u7', // 煉獄九尾陣
    'sk-0036': 'Orihime-u8', // 天河天翔
    'sk-0035': 'Orihime-u6', // 炸裂気泡陣
  },
  Pandora: {
    'pandora_o01': 'Pandora-n0', // デュアルスラップ
    'pandora_o02': 'Pandora-n1', // ルミナスレイ
    'pandora_o04': 'Pandora-n3', // セラフキック
    'pandora_o05': 'Pandora-n4', // アビスレイド
    'pandora_o06': 'Pandora-n5', // ホーリーライトニング
    'pandora_o07': 'Pandora-n6', // カオスメガレイ
    'pandora_o08': 'Pandora-n7', // エクリプスキッス
    'pandora_o09': 'Pandora-n8', // デュアルキッス
    'pandora_o11': 'Pandora-u1', // セイクリッドレイ
    'pandora_o12': 'Pandora-u2', // アビスサンダー
    'pandora_o13': 'Pandora-u3', // ツインビッグバン
    'pandora_o14': 'Pandora-u4', // ダークライトニング
    'pandora_o15': 'Pandora-u5', // カオスコズミック
    'pandora_o16': 'Pandora-u6', // アストラルクロスレイ
    'pandora_o17': 'Pandora-u7', // エクリプスノヴァ
    'pandora_o18': 'Pandora-u8', // ダイスキライライ
  },
  Eiki: {
    'eiki_o02': 'Eiki-n1', // 花裂き
    'eiki_o03': 'Eiki-n2', // 桜風刃
    'eiki_o04': 'Eiki-n3', // 花霞斬
    'eiki_o05': 'Eiki-n4', // 桜月輪
    'eiki_o06': 'Eiki-n5', // 桜嵐刃
    'eiki_o07': 'Eiki-n6', // 千花連刃
    'eiki_o08': 'Eiki-n7', // 桜閃爪
    'eiki_o09': 'Eiki-n8', // 桜華絶閃爪
    'eiki_o10': 'Eiki-u0', // 華影緋閃
    'eiki_o11': 'Eiki-u1', // 氷花一閃
    'eiki_o12': 'Eiki-u2', // 桜月斬華
    'eiki_o13': 'Eiki-u3', // 緋雪乱刃
    'eiki_o14': 'Eiki-u4', // 花氷双牙
    'eiki_o15': 'Eiki-u5', // 千華氷嵐
    'eiki_o16': 'Eiki-u6', // 緋桜六華閃
    'eiki_o17': 'Eiki-u7', // 絶影桜華乱舞
  },
  KenshiMocchi: {
    'kenshimocchi_o01': 'KenshiMocchi-n0', // エッジもんた
    'kenshimocchi_o02': 'KenshiMocchi-n1', // もちき・リープ
    'kenshimocchi_o03': 'KenshiMocchi-n2', // ガッチョスラント
    'kenshimocchi_o04': 'KenshiMocchi-n3', // エアリアルもっちゃん
    'kenshimocchi_o06': 'KenshiMocchi-n5', // 黒桜吹雪
    'kenshimocchi_o07': 'KenshiMocchi-n6', // もっさんスピン
    'kenshimocchi_o08': 'KenshiMocchi-n7', // 枝垂れクロス
    'kenshimocchi_o09': 'KenshiMocchi-n8', // バーストもっさま
    'kenshimocchi_o10': 'KenshiMocchi-u0', // ソニック・リープ
    'kenshimocchi_o11': 'KenshiMocchi-u1', // ホリゾンタル・スクエア
    'kenshimocchi_o12': 'KenshiMocchi-u2', // ヴォーパル・ストライク
    'kenshimocchi_o13': 'KenshiMocchi-u3', // デュアル・サーキュラー
    'kenshimocchi_o14': 'KenshiMocchi-u4', // ブラック・テンペスト
    'kenshimocchi_o15': 'KenshiMocchi-u5', // ブラック・チェイン
    'kenshimocchi_o16': 'KenshiMocchi-u6', // ナイトメア・レイド
    'kenshimocchi_o17': 'KenshiMocchi-u7', // ジ・エクリプス
  },
  Melody: {
    'melody_o01': 'Melody-n0', // ぞうさん頭突き
    'melody_o02': 'Melody-n1', // ピアノパラソル脳天撃
    'melody_o03': 'Melody-n2', // メロディタクトライト
    'melody_o04': 'Melody-n3', // ぞうさんぴろぴろ鼻
    'melody_o05': 'Melody-n4', // マリーランド大玉転がし
    'melody_o06': 'Melody-n5', // ムーンサルトメロディー
    'melody_o07': 'Melody-n6', // メロディキャンディボム
    'melody_o08': 'Melody-n7', // メロディ苺クッキー
    'melody_o09': 'Melody-n8', // ドリームパワー
    'melody_o10': 'Melody-u0', // メロメロハート
    'melody_o11': 'Melody-u1', // ピアノワルツ
    'melody_o12': 'Melody-u2', // リボンウィング
    'melody_o13': 'Melody-u3', // パウンドメテオ
    'melody_o14': 'Melody-u4', // ピンクバースト
    'melody_o15': 'Melody-u5', // キャンディレイン
    'melody_o16': 'Melody-u6', // マリーランドアーチ
    'melody_o17': 'Melody-u7', // メロディタクト
    'melody_o18': 'Melody-u8', // スウィートパレード
  },
  Kuromy: {
    'kuromy_o01': 'Kuromy-n0', // バク頭突き
    'kuromy_o02': 'Kuromy-n1', // バク空中落下プレス
    'kuromy_o03': 'Kuromy-n2', // ブラックノートライト
    'kuromy_o04': 'Kuromy-n3', // バクパタパタ耳
    'kuromy_o05': 'Kuromy-n4', // 巨大雪だるま転がし
    'kuromy_o06': 'Kuromy-n5', // KUROMI'S5アタック
    'kuromy_o07': 'Kuromy-n6', // ナイトメアらっきょうボム
    'kuromy_o08': 'Kuromy-n7', // バコ・ベリースプラッシュ
    'kuromy_o09': 'Kuromy-n8', // ダークパワー
    'kuromy_o10': 'Kuromy-u0', // ドクロボム
    'kuromy_o11': 'Kuromy-u1', // クロミーズ5突撃
    'kuromy_o12': 'Kuromy-u2', // 夢くいウィング
    'kuromy_o13': 'Kuromy-u3', // 恨み帳メテオ
    'kuromy_o14': 'Kuromy-u4', // 黒音符バースト
    'kuromy_o15': 'Kuromy-u5', // らっきょう大雨
    'kuromy_o16': 'Kuromy-u6', // ナイトメアアーク
    'kuromy_o17': 'Kuromy-u7', // ダークオーロラ
    'kuromy_o18': 'Kuromy-u8', // 悪夢フィナーレ
  },
};
const monsucMotionKind = (species, tech) => {
  const id = tech?.id;
  const own = MONSUC_SPECIES_MOTIONS[species];
  if (!own || !id) return msaMotionKind(species, tech);
  const motion = own[id] || MONSUC_SHARED_MOTIONS[id];
  if (!motion || (typeof motion !== 'string' && !motion.body)) return msaMotionKind(species, tech);
  if (typeof motion === 'string') return skillFxSpecOf(motion) ? motion : msaMotionKind(species, tech);
  const kind = 'monsuc-' + species + '-' + id;
  if (!SKILL_FX_SPEC_CACHE[kind]) SKILL_FX_SPEC_CACHE[kind] = skmNormalize(motion);
  return kind;
};
const msaMotionMs = (kind) => {
  const sp = kind && typeof skillFxSpecOf === 'function' ? skillFxSpecOf(kind) : null;
  return { ms: (sp && sp.ms) || 650, hit: (sp && sp.hit) || 300 };
};

// ---- 技のランク(1〜5)ごとの演出(2026-11-15 r1115-157 社長「技演出はさっぱりしすぎてるからランク毎にもっと派手にしたい。カットイン付きとか」) ----
//   見た目だけ。試合の芯(assistant-masmon-battle.js)の計算は読まない・変えない。ランクは技表(ASSISTANT_MASMON_TECHS)の rank を見せる側で引く
//   2026-11-15 r1115-163 社長「もっと派手に」(とくに4・5。1〜3も段の差が分かるように)・短くするのは速さで決める・ランク5は毎回全画面
//   cut … 撃つ前のカットイン(0 なし / 'band' 帯 / 'full' 全画面)・cutMs … その長さ(×1)/hit … 当たりの光の段(1〜5)/shake … 揺れの最低の段(4 = ランク5だけの大揺れ)
//   flash … 当たった瞬間に場全体が技の色に光る強さ/bg … 背景が変わる
const MSA_RANK_FX = Object.freeze({
  1: { cut: 0, cutMs: 0, hit: 1, shake: 1, flash: 0, bg: false },
  2: { cut: 0, cutMs: 0, hit: 2, shake: 1, flash: 0.22, bg: false },
  3: { cut: 0, cutMs: 0, hit: 3, shake: 2, flash: 0.4, bg: false },
  4: { cut: 'band', cutMs: 900, hit: 4, shake: 3, flash: 0.6, bg: false },
  5: { cut: 'full', cutMs: 1400, hit: 5, shake: 4, flash: 0.9, bg: true },
});
let MSA_RANK_MAP = null; // 技 id → ランク(種をまたいで同じ id は同じ技)
const msaRankOf = (log, e, species) => {
  if (!e || e.ev !== 'tech') return 0;
  const T = typeof ASSISTANT_MASMON_TECHS !== 'undefined' ? ASSISTANT_MASMON_TECHS : null;
  if (!T || !T.species) return 1;
  const own = species && Array.isArray(T.species[species]) ? T.species[species].find((t) => t.id === e.move) : null;
  if (own && Number.isFinite(own.rank)) return Math.max(1, Math.min(5, own.rank));
  if (!MSA_RANK_MAP) { MSA_RANK_MAP = {}; Object.values(T.species).forEach((list) => (Array.isArray(list) ? list : []).forEach((t) => { if (t && t.id && !(t.id in MSA_RANK_MAP) && Number.isFinite(t.rank)) MSA_RANK_MAP[t.id] = t.rank; })); }
  const r = MSA_RANK_MAP[e.move];
  return Number.isFinite(r) ? Math.max(1, Math.min(5, r)) : 1;
};
// カットインの長さ(見せる速さ sf を掛けた実際の長さ)。早送り(×4)と動きを減らす設定では出さない
const msaCutMs = (rank, sf, reduce) => {
  const R = MSA_RANK_FX[rank] || MSA_RANK_FX[1]; const f = Number(sf) || 1;
  if (reduce || !R.cut || f <= MSA_FAST_F) return 0;
  return Math.round(R.cutMs * (f < 1 ? 0.7 : 1));
};

// 技の行のアクセント(ため・止め・とどめ)。動きを減らす設定では、どれも 0(待ち時間を足さない)
//   pre … 大技(消費ガッツ40以上)の前のため/stop … 当たった瞬間に場を止める長さ(ヒットストップ)/fin … この技でとどめ(次の行が相手の KO)
const MSA_GUTS_TIRED = 10; // ガッツがこれより少ないと息切れの表示
// 2026-11-13 社長「攻撃前にもう1アクセントほしいね」: どの技にも撃つ前の構えの一拍(大技は長め)。sf … 見せる速さ(×2 は 0.55。×4 はふつうの技の一拍を省く)
const MSA_WIND_MS = 380;
const MSA_WIND_BIG_MS = 620;
const msaFxOf = (log, e, reduce, sf = 1) => {
  const z = { pre: 0, stop: 0, fin: false, big: false, rank: 0, cut: 0 };
  if (!e || e.ev !== 'tech') return z;
  const rank = msaRankOf(log, e);
  const big = (Number(msaTechInfo(log, e).guts) || 0) >= 40 || rank >= 4;
  const idx = Array.isArray(log) ? log.indexOf(e) : -1;
  const nx = idx >= 0 ? log[idx + 1] : null;
  const fin = Boolean(e.hit && nx && nx.ev === 'ko' && nx.side && nx.side !== e.side);
  if (reduce) return { ...z, fin, big, rank };
  const stop = !e.hit || (Number(sf) || 1) <= MSA_FAST_F ? 0 : fin ? 230 : rank >= 5 ? 200 : e.crit || big || rank >= 4 ? 150 : rank >= 3 ? 110 : e.guarded ? 40 : 70;
  const f = Number(sf) || 1;
  // カットイン(ランク4・5)は構えの前。pre はカットイン+構えの長さ
  const cut = msaCutMs(rank, f, reduce);
  const pre = cut + (big ? Math.round(MSA_WIND_BIG_MS * f) : f <= 0.35 ? 0 : Math.round(MSA_WIND_MS * f));
  return { pre, stop, fin, big, rank, cut };
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
const msaStepMs = (e, team, reduce, log, sf = 1, motionKindOf = msaMotionKind) => {
  if (!e) return 300;
  if (reduce) return e.ev === 'tech' ? 900 : e.ev === 'start' || e.ev === 'enter' ? 250 : 650;
  // 技: 当たってから、数字が出てライフの棒が減りきるまでの間(MSA_AFTER_HIT)をとってから次の手へ(2026-11-13 社長「相手がすぐ動き出す」)
  //   sf を渡すと、その速さで実際にかかる長さ ÷ sf を返す(呼ぶ側が sf を掛ける)。技の動きそのものは縮まないので、当たるところまでは必ず見せる
  if (e.ev === 'start' && (Number(sf) || 1) <= MSA_FAST_F) return 700; // ×4 は入りの VS・READY・FIGHT を省く
  if (e.ev === 'tech') {
    const f = Number(sf) || 1; const m = (team && team.members && team.members[e.i]) || {}; const fx = msaFxOf(log, e, reduce, f); const mm = msaMotionMs(motionKindOf(m.species, msaTechInfo(log, e)));
    // ×4(早送り): 技の動きの終わりを待たず、当たって数字が見えたらすぐ次へ(main の 1.3倍以内。窓口 2026-11-13)
    const real = f <= MSA_FAST_F ? fx.pre + mm.hit + (e.hit ? 90 : 60) + (fx.fin ? 150 : 0)
      : fx.pre + Math.max((mm.ms + 300) * Math.max(f, 0.6), mm.hit + (e.hit ? MSA_AFTER_HIT : MSA_AFTER_MISS) * f) + fx.stop + (fx.fin ? 450 * f : 0);
    return real / f;
  }
  if (e.ev === 'charge' && e.why === 'sulk') return 1700; // 意味不明な行動の番は読める長さ見せる
  return { start: MSA_INTRO_MS, enter: 350, move: 820, guard: 750, charge: 800, swap: 700, ko: 1500, end: 600 }[e.ev] || 500;
};

// ---- 技のランクの演出の部品(r1115-157)。どれも見せるだけ(押せない・場の時間は msaFxOf の pre・stop が決める) ----
const MSA_RANK_STARS = (r) => '★'.repeat(Math.max(1, Math.min(5, r))) + '☆'.repeat(5 - Math.max(1, Math.min(5, r)));
const msaFxImg = (member, cls) => {
  if (!member) return null;
  const src = mscMonImg(member.species);
  return Array.isArray(member.colors) && member.colors.some(Boolean) && typeof DyedMonsterImage === 'function'
    ? <DyedMonsterImage baseId={member.species} src={src} masuColors={member.colors} alt="" draggable={false} className={cls}/>
    : <img className={cls} src={src} alt="" draggable={false}/>;
};
// 撃つ前のカットイン。band(ランク4)= 横の帯に顔と技名/full(ランク5)= 暗転・集中線・斜めの大きな帯に立ち絵と技名
function MsaCutin({ e, rank, member, ms }) {
  if (!e || !ms) return null;
  const R = MSA_RANK_FX[rank] || {}; const kd = e.kind === 'wise' ? 'wise' : 'pow'; const sd = e.side === 'B' ? 'B' : 'A';
  const nm = String(e.name || ''); const fs = Math.max(R.cut === 'full' ? 17 : 15, Math.min(R.cut === 'full' ? 32 : 24, Math.floor((R.cut === 'full' ? 175 : 165) / Math.max(1, nm.length))));
  return (
    <div className={`msa-cut ${R.cut} ${kd} ${sd}`} style={{ '--cut': `${ms}ms` }} data-msa-cutin={R.cut} data-msa-rank={rank} aria-hidden="true">
      <i className="cs"/>
      <i className="cr"/>
      <div className="cb">
        <i className="cl"/>
        <div className="ca">{msaFxImg(member, sd === 'A' ? 'msa-flip' : '')}</div>
        <div className="ct">
          <small>{kd === 'pow' ? 'ちから技' : 'かしこさ技'}<span className="st">{MSA_RANK_STARS(rank)}</span></small>
          <b style={{ fontSize: `${fs}px` }}>{nm}</b>
          <em>{member ? member.name : ''}</em>
        </div>
      </div>
      {R.cut === 'full' && <i className="cf"/>}
    </div>
  );
}
// 構えのあいだの集中線(ランク3から)。攻め手のまわりに線が集まる
function MsaSpeedLines({ x, kind, pre, at = 0, rank }) {
  return <i className={`msa-sl ${kind === 'wise' ? 'wise' : 'pow'} r${rank}`} aria-hidden="true" style={{ '--msa-cx': `${x * 100}%`, '--msa-pre': `${pre}ms`, animationDelay: `${at}ms` }}/>;
}
// 間合いが中・遠のときの弾の筋(ランク2から)。攻め手から受け手へ走る
function MsaTrail({ x0, x1, kind, delay, dur, rank }) {
  const l = Math.min(x0, x1); const w = Math.abs(x1 - x0);
  return <i className={`msa-tr ${kind === 'wise' ? 'wise' : 'pow'} ${x1 < x0 ? 'rev' : ''} r${rank}`} aria-hidden="true" style={{ left: `${l * 100}%`, width: `${w * 100}%`, animationDelay: `${delay}ms`, '--tr': `${dur}ms` }}/>;
}
// 当たりの光(ランクの段 1〜5)。ちから=橙と赤の衝撃・破片/かしこさ=水色と紫の輪・星
function MsaHitFx({ x, kind, lv, delay, hit }) {
  if (!hit) return null;
  const kd = kind === 'wise' ? 'wise' : 'pow';
  const n = lv >= 5 ? 16 : lv >= 4 ? 12 : lv >= 3 ? 10 : lv >= 2 ? 6 : 3;
  const d = { animationDelay: `${delay}ms` }; // 当たる瞬間まで待つ(クラスの animation の一括指定に負けないよう、1つずつに付ける)
  return (
    <div className={`msa-hx ${kd} l${lv}`} style={{ left: `${x * 100}%` }} aria-hidden="true" data-msa-hitfx={lv}>
      <i className="core" style={d}/>
      <i className="ring" style={d}/>
      {lv >= 3 && <i className="rays" style={d}/>}
      {lv >= 4 && <i className="ring r2" style={{ animationDelay: `${delay + 120}ms` }}/>}
      {lv >= 4 && <i className="wave" style={d}/>}
      {lv >= 5 && <i className="pillar" style={d}/>}
      {lv >= 5 && <i className="core c2" style={{ animationDelay: `${delay + 240}ms` }}/>}
      {lv >= 5 && <i className="ring r3" style={{ animationDelay: `${delay + 260}ms` }}/>}
      {lv >= 5 && kd === 'wise' && <i className="circle" style={d}/>}
      {Array.from({ length: n }, (_, j) => <i key={j} className="bit" style={{ ...d, '--a': `${Math.round(j * 360 / n + (j % 2) * 13)}deg`, '--r': `${(lv >= 5 ? 150 : lv >= 4 ? 120 : lv >= 3 ? 92 : lv >= 2 ? 64 : 40) + (j % 3) * 16}px` }}/>)}
    </div>
  );
}
// 当たった瞬間に場全体が技の色に光る(ランク2から。強さは表の flash)
function MsaRankFlash({ kind, a, delay }) {
  return <i className={`msa-rf ${kind === 'wise' ? 'wise' : 'pow'}`} aria-hidden="true" style={{ '--rf': a, animationDelay: `${delay}ms` }}/>;
}
// ランク5の背景の変化(カットインのあと、その行のあいだ)。ちから=燃える赤い空/かしこさ=星の夜空
function MsaRankBg({ kind, at }) {
  return <i className={`msa-rbg ${kind === 'wise' ? 'wise' : 'pow'}`} aria-hidden="true" style={{ animationDelay: `${at}ms` }}/>;
}

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

// 技の勢いで間合いが動いた行(why:'techMove')の、その技の名前。記録のすぐ前にある、その技を使った行から引く(r1115-156②)
const msaTechMoveName = (log, e) => {
  if (!Array.isArray(log) || !e || !e.byTech) return '';
  for (let i = log.indexOf(e) - 1; i >= 0 && i >= log.indexOf(e) - 3; i--) { const r = log[i]; if (r && r.ev === 'tech' && r.side === e.side && r.move === e.byTech) return r.name || ''; }
  return '';
};
// 技の勢いで動いた間合いの文。近づく向き(step −1)は使った側が移る・遠ざかる向き(step +1)は相手を飛ばす(msxTechMoveTxt と同じ考え)
const msaTechMoveSay = (e, n, tech, distName) => (e.step > 0
  ? `${n}の ${tech || '技'}で 相手は ${distName}へ飛ばされた`
  : `${n}は ${tech || '技'}の勢いで ${distName}へ移った`);
// 実況の1行(log を渡すと、技の勢いで動いたときに技の名前を出す)
const msaSay = (e, nm, log = null) => {
  if (!e) return '';
  if (e.ev === 'tech') return e.hit ? `${nm(e.side, e.i)}の ${e.name}!${e.crit ? ' 会心の一撃!' : e.guarded ? ' …ガードされた' : ''}` : `${nm(e.side, e.i)}の ${e.name} … よけられた`;
  if (e.ev === 'move' && e.why === 'blown') return `${nm(e.side, e.i)}は 吹き飛ばされて 遠の間合いへ!`;
  if (e.ev === 'move' && e.why === 'techMove') return msaTechMoveSay(e, nm(e.side, e.i), msaTechMoveName(log, e), `${AMBW_DIST[e.to] || ''}の間合い`);
  if (e.ev === 'move') return `${nm(e.side, e.i)}が ${AMBW_DIST[e.to] || ''}の間合いへ`;
  if (e.ev === 'blow') return `${nm(e.side, e.i)}の 吹き飛ばし! ${nm(e.side === 'A' ? 'B' : 'A')}は 次の手のあと 遠へ飛ばされる`; // 誰が飛ばされるか分かるように(2026-11-20 API)
  if (e.ev === 'charge') return e.why === 'sulk' ? `${nm(e.side, e.i)}は 意味不明な行動をした…` : `${nm(e.side, e.i)}は ガッツをためた`;
  if (e.ev === 'guard') return `${nm(e.side, e.i)}は 身を守った`;
  if (e.ev === 'swap') return `${nm(e.side, e.i)}に 交代!`;
  if (e.ev === 'ko') return `${e.name} は たおれた`;
  if (e.ev === 'start') return '試合開始!';
  return '';
};

// ---- 場の1体 ----
//   gd … この行での自分のガッツの増減(ためる +・技を撃つ −・ガッツを削られた −)
function MsaFighter({ side, member, x, prevX, sf = 1, e, foeX, fwPx = 96, hpNow, reduce, idleOk, gd, fx, motionOn = true, maxHp = 0, gutsNow = null, lean = 0 }) {
  fx = fx || { pre: 0, stop: 0, fin: false, big: false };
  const rootRef = useRef(null);
  // 吹き飛ばし(2026-11-17 社長「演出がなくいきなり遠距離に行く」): 位置の移り変わり(left の transition)だけに頼らず、
  // カメラと同じ WAAPI で「前の立ち位置から弧を描いて飛ぶ」動きを必ず付ける。判定・間合いは変えない(見た目だけ)
  const blownRow = !!(e && e.side === side && e.ev === 'move' && e.why === 'blown');
  useEffect(() => {
    if (!blownRow || reduce) return undefined;
    const root = rootRef.current; if (!root || typeof root.animate !== 'function') return undefined;
    const bodyEl = root.querySelector('[data-msa-body]'); if (!bodyEl) return undefined;
    const w = (foeX && foeX.w) || 340;
    const dx = Math.round(((Number(prevX) || 0) - (Number(x) || 0)) * w);
    if (!dx) return undefined;
    const dur = Math.max(200, Math.min(680, Math.round(640 * (Number(sf) || 1)))); // 見せる速さに合わせる(行の長さ 820ms×速さ に収める)
    const arc = Math.round(Math.min(70, 20 + Math.abs(dx) * 0.18));
    const spin = -Math.sign(dx) * 15; // 頭が飛ぶ向きの逆に残る倒れ方
    let a = null;
    try {
      a = bodyEl.animate([
        { transform: `translate(${dx}px,0px) rotate(0deg)`, offset: 0 },
        { transform: `translate(${Math.round(dx * 0.45)}px,${-arc}px) rotate(${spin}deg)`, offset: 0.55 },
        { transform: `translate(${Math.round(dx * 0.12)}px,${-Math.round(arc * 0.25)}px) rotate(${Math.round(spin * 0.35)}deg)`, offset: 0.82 },
        { transform: 'translate(0px,0px) rotate(0deg)', offset: 1 },
      ], { duration: dur, easing: 'cubic-bezier(.3,.6,.35,1)', fill: 'none' });
    } catch (_) { a = null; }
    return () => { try { if (a) a.cancel(); } catch (_) {} };
  }, [blownRow ? e.k : -1]);
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
    body = <div key={`pre-${e.k}`} className={`flex items-end justify-center ${fx.big ? 'msa-chargebig' : 'msa-wind'}`} style={{ '--msa-pre': `${fx.pre - (fx.cut || 0)}ms`, animationDelay: `${fx.cut || 0}ms` }}>{img}</div>;
    extra.push(<span key={`ab-${e.k}`} className={`msa-aura ${fx.big ? 'big' : 'wind'} ${kd}`} aria-hidden="true" style={{ '--msa-pre': `${fx.pre - (fx.cut || 0)}ms`, animationDelay: `${fx.cut || 0}ms` }}/>);
  } else if (tech && me && !reduce) {
    // 攻める: 相手の位置まで(--atk-dx)。モンヒロのバトルと同じ動き
    const kind = e.motionKind;
    if (kind) {
      const w = foeX.w; const rawDx = (foeX.x - x) * w;
      // 突進系の動きは相手の中心を最大で 1.2 倍ぶん越える(70-bootstrap の skfxDash)。受け手が端にいると攻め手が場の外へ出てしまうので、
      // 進んだ先の中心が「場の端 −(絵の幅×0.65 + 安全域)」に収まるよう dx を抑える(×0.65 は当たりの瞬間の横つぶれ最大1.3倍ぶん。当たりの位置そのものは相手の所のまま)
      const half = (Number(fwPx) || 96) * 0.65; const cxPx = x * w;
      let dx = rawDx;
      if (dx > 0) dx = Math.min(dx, Math.max(0, (w - half - MSA_SAFE - cxPx) / 1.2));
      else if (dx < 0) dx = Math.max(dx, Math.min(0, (half + MSA_SAFE - cxPx) / 1.2));
      style = { ...style, ...(typeof attackAimVars === 'function' ? attackAimVars(dx, -8) : { '--atk-dx': `${Math.round(dx)}px`, '--atk-dy': '-8px' }) };
      body = <SkillFxMotion key={`m-${e.k}`} kind={kind} image={img}/>;
    }
  }
  const delay = tech ? (reduce ? 0 : fx.pre + msaMotionMs(e.motionKind).hit) : 0;
  if (tech && foe) {
    const pose = !e.hit ? 'mh-card-dodge' : e.guarded ? 'mh-card-guard' : 'mh-card-hit';
    body = <div key={`p-${e.k}`} className={`flex items-end justify-center ${pose}`} style={{ animationDelay: `${delay}ms` }}>{img}</div>;
    if (!e.hit) extra.push(<div key={`a-${e.k}`} className="mh-card-afterimage" aria-hidden="true" style={{ animationDelay: `${delay}ms` }}>{img}</div>);
    if (e.guarded && e.hit) extra.push(<span key="s" className="mh-card-shield" aria-hidden="true" style={{ animationDelay: `${delay}ms` }}/>);
    // ダメージの数字は場の上の層(msa-dmgwrap・MsaStage)に出す。撃つ側の当たりの光より前に出して、数字が隠れないように
  }
  if (me && e.ev === 'guard') { cls = 'mh-card-guard'; extra.push(<span key="s" className="mh-card-shield" aria-hidden="true"/>); }
  if (me && e.ev === 'charge') {
    // 意味不明のときは場の真ん中のスタンプ(msa-sulkstamp)が言うので、頭の上の札は出さない(2026-11-15 r1115-050 札とスタンプ・ガッツの数が重なった)
    if (e.why === 'sulk') { cls = 'msa-sulk'; }
    else { cls = 'msa-charge'; extra.push(<span key="a" className="msa-aura" aria-hidden="true"/>); }
  }
  let bodyStyle;
  if (me && e.ev === 'move') {
    // 吹き飛ばしは歩く格好(msa-step)にしない。飛ぶ動きは上の WAAPI が付ける
    cls = blownRow ? 'msa-blown' : 'msa-step'; bodyStyle = blownRow ? undefined : { '--msa-lean': `${lean}deg` };
    if (!reduce) [0, 1, 2].forEach((j) => extra.push(<i key={`du-${e.k}-${j}`} className="msa-dust" aria-hidden="true" style={{ left: `${18 + j * 22}%`, animationDelay: `${120 + j * 190}ms`, '--msa-dx': `${(lean >= 0 ? -1 : 1) * (side === 'A' ? 1 : -1) * 16}px` }}/>));
  }
  if (me && (e.ev === 'swap' || e.ev === 'enter')) cls = 'msa-in';
  const koNow = e && e.ev === 'ko' && e.side === side;
  if (down) cls = koNow ? 'mh-card-ko' : '';
  if (koNow) {
    // K.O. の印(54px の字で幅 約144px)は小さな絵より幅が広く、端の子では場の外へ出る。中心を安全域の内側へ寄せる(2026-11-17 仕上げ)
    const w2 = Math.max(200, (foeX && foeX.w) || 340); const koHalf = 72; const koCx = x * w2;
    const koShift = Math.max(MSA_SAFE, Math.min(w2 - MSA_SAFE - koHalf * 2, koCx - koHalf)) - (koCx - koHalf);
    extra.push(<div key={`k-${e.k}`} className="msa-ko big" data-msa-ko={side} style={koShift ? { marginLeft: `${Math.round(koShift)}px` } : undefined}>K.O.!</div>);
    if (!reduce) extra.push(<i key={`bu-${e.k}`} className="msa-burst" aria-hidden="true"/>);
  }
  // 息切れ: ガッツが尽きかけ(ためている行は出さない)
  const tired = !down && Number.isFinite(gutsNow) && gutsNow < MSA_GUTS_TIRED && !(me && e.ev === 'charge');
  // 息切れの札は絵の右上に出る決まりだが、右側(B)の子ではそのまま場の外へ出てしまうので、B は内側(左)へ反転する(2026-11-17 仕上げ)
  // 2026-11-20 再点検 バ-13: 頭の上の吹き出しは絵に重なり、効き目も分からない → 絵の上には出さず、上の帯に「息切れ(ガッツ残りわずか)」と出す(MsaStage の bands)。絵の揺れ(tired)は残す
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
    body = <div key={`b-${e ? e.k : 0}-${cls}`} data-msa-body={side} className={`flex items-end justify-center ${cls}`} style={bodyStyle}>{still}</div>;
  }
  // 吹き飛ばしの行は left の transition を止める(飛ぶ動きは WAAPI が受け持つ。二重に動くと行き過ぎて戻る形になる)
  if (blownRow && !reduce) style = { ...style, transition: 'none' };
  return (
    <div ref={rootRef} className={`msa-f ${down ? 'down' : ''} ${tech && me ? 'act' : ''} ${koNow ? 'slowko' : ''} ${tired && !reduce ? 'tired' : ''}`} style={style} data-msa-fighter={side}>
      <span className="msa-shadow" aria-hidden="true"/>
      {body}
      {extra}
    </div>
  );
}

// 1行ぶんの効果音。pos が前へ進んだときだけ鳴らす(見返しで戻した・止めているときは鳴らさない)
function useMsaSfx(log, pos, teams, reduce, on, sf = 1, motionKindOf = msaMotionKind) {
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
      const hitMs = reduce ? 0 : msaFxOf(log, e, reduce, sf).pre + msaMotionMs(motionKindOf(m.species, msaTechInfo(log, e))).hit;
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
      <b>{kind === 'gt' ? <small className="msa-gl">ガッツ</small> : <small className="msa-gl hp">ライフ</small>}{num}</b>
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
  if (R > 0) out.push({ t: `ガッツ +${R}(回復)`, cls: 'up', delay: 0 });
  const d = f.g[side] - pf.g[side];
  if (r.side === side) {
    const x = d - R;
    // 2026-11-20 再点検 バ-47・64・65: 「+9」「移動 −5」だけでは何の数か分からない → どれも「ガッツ」と書く
    if (r.ev === 'tech') { const t = msaTechOf(log, r); if (t && t.guts) out.push({ t: `ガッツ −${t.guts}(技)`, cls: 'down', delay: 0 }); }
    else if ((r.ev === 'move' || r.ev === 'blow') && r.why !== 'blown' && (Number(r.cost) || 0) > 0) out.push({ t: `ガッツ −${Math.round(Number(r.cost))}(${r.ev === 'blow' ? '吹き飛ばし' : '移動'})`, cls: 'down', delay: 0 });
    else if (x > 0) out.push({ t: `ガッツ +${x}(${r.ev === 'move' ? '移動' : r.ev === 'guard' ? 'ガード' : 'ためる'})`, cls: 'up', delay: 0 });
  } else if (r.ev === 'tech' && r.hit && (Number(r.gd) || 0) > 0) out.push({ t: `ガッツ −${Math.round(Number(r.gd))}(削られた)`, cls: 'down', delay: hitMs });
  return out;
};

// 上下の欄に出すコマ: 技の行は、当たる瞬間までは前のコマ(ライフ・ガッツが先に減って見えないように)
function useMsaShownFrame(log, frames, pos, teams, sf = 1, lite = false, motionKindOf = msaMotionKind) {
  const reduce = useMemo(() => !!lite || msaReduce(), [lite]);
  const [hitAt, setHitAt] = useState(-1);
  const e = (log && log[pos]) || {};
  const m = e.side && teams && teams[e.side] && teams[e.side].members ? teams[e.side].members[e.i] || {} : {};
  const at = e.ev === 'tech' && !reduce ? msaFxOf(log, e, reduce, sf).pre + msaMotionMs(motionKindOf(m.species, msaTechInfo(log, e))).hit : 0;
  useEffect(() => { if (!at) return undefined; const t = setTimeout(() => setHitAt(pos), at); return () => clearTimeout(t); }, [pos, at]);
  const k = Math.min(pos, frames.length - 1);
  return frames[at && hitAt !== pos && k > 0 ? k - 1 : k] || frames[0];
}

// 効果の帯(参考動画: 効果が出るたびに左右から細い帯がすべり込む)。行 k で出る帯 [{ side, t }]
const msaBandsOf = (log, frames, k) => {
  const r = log[k]; const f = frames[k]; const pf = frames[k - 1];
  if (!r || !f || !pf || k < 1) return [];
  const out = [];
  // 2026-11-20 再点検 バ-14・15・36: ためた・間合い・吹き飛ばし・交代は下の実況の文と同じ中身で二重・三重だった → 帯は「続く状態」だけにする
  //   (ガードで軽減・息切れ)。間合いは場の下の零/近/中/遠の札1つで見せる
  if (r.ev === 'tech' && r.hit && r.guarded) out.push({ side: r.side === 'A' ? 'B' : 'A', t: '🛡 ガードで軽減' });
  ['A', 'B'].forEach((sd) => {
    if (Number(f.g[sd]) < MSA_GUTS_TIRED && Number(pf.g[sd]) >= MSA_GUTS_TIRED && (f.hp[sd] || [])[f.act[sd]] > 0) out.push({ side: sd, t: '💦 息切れ(ガッツ残りわずか)' });
  });
  return out.map((b, j) => ({ ...b, k, j }));
};

// カメラ(参考動画: 攻め手に寄る → 当たる瞬間に受け手へ振る)。場の中身(.msa-cam)を寄せる。動きを減らす設定では動かさない
//   x … 立ち位置(場の幅に対する割合) / s … 寄せる倍率。寄せた子が少しまん中へ来るように横へずらす
// 横へのずらしは、寄せた分(はみ出した背景)の中に収める(場の端の外が見えない・背景を大きくしなくてよい)
//   ext … { l, r } 寄せ先の中心から、2体の両端(絵の半分+安全域)までの距離(px・倍率を掛ける前)。
//   寄せた先で2体とも場に収まるよう、背景の被覆(lim)の範囲でずらしを足す(2026-11-18 あっくん「アップすぎて技ではみだす」)
const msaCamAt = (x, s, w, ext) => {
  const lim = Math.max(0, (s - 1) * w * 0.5 - 2);
  let t = Math.max(-lim, Math.min(lim, (0.5 - x) * w * s * 0.55));
  if (ext && w > 0) {
    const c = 0.5 + (x - 0.5) * s + t / w; // 寄せ先の中心(画面上の割合)
    const lo = ext.l * s / w; const hi = 1 - ext.r * s / w;
    if (c < lo) t += Math.min((lo - c) * w, lim - t);
    else if (c > hi) t -= Math.min((c - hi) * w, t + lim);
  }
  return `translate(${Math.round(t)}px,0px) scale(${s})`;
};
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
function MsaStage({ log, frames, pos, teams, venueImg, ended = false, win = null, endSub = '', sound = true, introTitle = '', speedF = 1, fill = false, lite = false, wide = false, liveGuts = null, motionKindOf = msaMotionKind, onEndGo = null, roundMax = 0 }) {
  const reduce = useMemo(() => !!lite || msaReduce(), [lite]);
  const [stageW, setStageW] = useState(340);
  const [stageH, setStageH] = useState(300);
  // wide … モンサクの大きな場(2026-11-14 社長「零で2体が重なる」「上半分が背景だけ」): 絵の大きさを場の高さから決め、足もとを場の高さの75%に置き(r1119-008 で 64%→75%。見本どおり床を広く見せる)、
  //   間合い4段の幅を絵の幅に合わせて取り直す(零でも2体の顔と体が見分けられる)
  // 2026-11-19 r1119-008: 絵の幅は距離ごとに場の幅の割合(MSA_FIG_W)。以前は場の幅の51%まで1つの大きさで、2体で場の8〜9割を占めていた。
  //   低い場(横・小さい横)で零の絵が上の帯にかかるときだけ、4段とも同じ割合で小さくする(距離による大きさの比は保つ)
  const figK = Math.min(1, (Math.max(60, Math.min(stageH * 0.5, stageH * 0.75 - 72)) * 0.82) / Math.max(1, stageW * MSA_FIG_W[0]));
  const fwOfD = (d) => Math.max(24, Math.round(stageW * MSA_FIG_W[Math.max(0, Math.min(3, Number.isFinite(d) ? d : 1))] * figK));
  const stageRef = useRef(null);
  const camRef = useRef(null);
  useEffect(() => {
    const el = stageRef.current; if (!el) return undefined;
    const fit = () => { setStageW(el.clientWidth || 340); setStageH(el.clientHeight || 300); };
    fit();
    if (typeof ResizeObserver === 'undefined') { window.addEventListener('resize', fit); return () => window.removeEventListener('resize', fit); }
    const ro = new ResizeObserver(fit); ro.observe(el); return () => ro.disconnect();
  }, []);
  useMsaSfx(log, pos, teams, reduce, sound, Number(speedF) || 1, motionKindOf);
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
    const at = fxNow.pre + msaMotionMs(motionKindOf(m.species, msaTechInfo(log, e1))).hit;
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
  const tech = msaTechInfo(log, e0);
  const atkSp = e0.side ? (memberOf(e0.side, e0.i) || {}).species : '';
  const e = { ...e0, k: pos, tech, motionKind: e0.ev === 'tech' ? motionKindOf(atkSp, tech) : null };
  // 大きな場の絵の大きさは、いまの行の間合いで決まる(r1119-008。間合いが変わると、絵も背景も寄る・引く)
  const bigFw = fwOfD(f ? f.d : 1);
  const bigFh = Math.round(bigFw / 0.82);
  // 背景も間合いで寄せる・引く(遠=1倍。絵の倍率の MSA_BG_ZOOM 分だけ)。足もとの高さを中心に寄せるので、床の位置は動かない
  const bgZoom = 1 + (MSA_FIG_W[Math.max(0, Math.min(3, f && Number.isFinite(f.d) ? f.d : 1))] / MSA_FIG_W[3] - 1) * MSA_BG_ZOOM;
  // 零でも2体の体と顔が見えるように、絵の幅の6割はあける(2026-11-13 社長「重なりを直して」。小さい子が大きい子の後ろに隠れた)
  const gapOf = (d) => {
    // 大きな場: 中心の間 = 場の幅 × MSA_GAP_W(r1119-008。以前は零で絵の幅の72%=重なり・零→遠の差が絵1体より小さかった)。両端の絵+安全域が場に収まる所まで
    if (wide) { const W1 = Math.max(200, stageW); const k = Math.max(0, Math.min(3, Number.isFinite(d) ? d : 1)); const gMax = Math.max(0.05, 1 - (fwOfD(k) + 2 * MSA_SAFE) / W1); return Math.min(gMax, MSA_GAP_W[k]); }
    // 大きな場(big)でなくても、絵の大きさに対して間合いが広すぎると両端の絵が場の外へ出る(助手バトルの fill は絵が140pxで eM が 9% 固定だった)。
    //   big と同じ考え方で、間合いの上限を「2体とも絵の半分+安全域が場に収まる幅」に抑える(2026-11-17 仕上げ)
    const fwPx = fill ? 140 : 96; const W2 = Math.max(200, stageW); const k = Math.max(0, Math.min(3, Number.isFinite(d) ? d : 1));
    const g0 = Math.max(MSA_GAP[0], Math.min(MSA_GAP[1] - 0.04, (fwPx * 0.6) / W2));
    const gMax = Math.max(g0, 1 - 2 * (fwPx / 2 + MSA_SAFE) / W2);
    return Math.min(gMax, Math.max(MSA_GAP[k], g0 + (gMax - g0) * k / 3)); };
  // 立ち位置(2026-11-14 社長「距離の移動が違和感」): 間合いを変えた子だけが歩いて動き、相手はその場に残る。
  // 2体のまん中(c)は行ごとに前から順に決める(動いた子の相手の位置を残す)。端に寄りすぎないよう c は 0.5±MSA_C_LIM・2体が場の内側に収まる範囲に収める
  const cs = useMemo(() => {
    const out = [0.5]; let c = 0.5;
    for (let k = 1; k < frames.length; k++) {
      const r = log[k] || {}; const g0 = gapOf(frames[k - 1] ? frames[k - 1].d : 1); const g1 = gapOf(frames[k] ? frames[k].d : 1);
      if (r.ev === 'move' && (r.side === 'A' || r.side === 'B') && g0 !== g1) c = r.side === 'A' ? (c + g0 / 2) - g1 / 2 : (c - g0 / 2) + g1 / 2;
      // 片寄りを直すのは、技・移動・吹き飛ばし・KO 以外の行だけ(動いていない子が技の最中に流れて見えないように。2026-11-19 段1)
      else if (r.ev && r.ev !== 'tech' && r.ev !== 'move' && r.ev !== 'blow' && r.ev !== 'ko') c += (0.5 - c) * MSA_RECENTER;
      // 端からの余白は「絵の半分+安全域(MSA_SAFE)」(2026-11-17 仕上げ。以前は big が絵の半分+1%・それ以外は 9% 固定で、大きな絵では端で切れていた)
      const eM = Math.max(0.09, ((wide ? fwOfD(frames[k] ? frames[k].d : 1) : fill ? 140 : 96) / 2 + MSA_SAFE) / Math.max(200, stageW));
      // 横送り(pan)まで含めた画面の上での位置でも同じ余白を保つ範囲。pan は 2体のまん中を画面のまん中へ寄せるので、広い間合いでは端の子がさらに端へ寄る
      const lo = Math.max(0.5 - MSA_C_LIM, eM + g1 / 2, (eM + g1 / 2 - 0.5 * MSA_PAN_K) / (1 - MSA_PAN_K));
      const hi = Math.min(0.5 + MSA_C_LIM, 1 - eM - g1 / 2, (1 - eM - g1 / 2 - 0.5 * MSA_PAN_K) / (1 - MSA_PAN_K));
      c = lo > hi ? 0.5 : Math.max(lo, Math.min(hi, c)); // どうしても収まらない間合いは、はみ出しが左右均等になる真ん中へ(以前は左端に寄っていた)
      out.push(c);
    }
    return out;
  }, [log, frames, stageW, fill, wide, figK]);
  const gap = gapOf(f ? f.d : 1);
  const cNow = cs[Math.min(pos, cs.length - 1)] != null ? cs[Math.min(pos, cs.length - 1)] : 0.5;
  const xA = cNow - gap / 2; const xB = cNow + gap / 2;
  // 1つ前の行での立ち位置(吹き飛ばされた子が「前の場所から飛ぶ」動きを作るため。2026-11-17)
  const gapPf = gapOf(pf ? pf.d : 1);
  const cPf = pos > 0 && cs[pos - 1] != null ? cs[pos - 1] : cNow;
  const xAPf = cPf - gapPf / 2; const xBPf = cPf + gapPf / 2;
  // カメラの横の追いかけ: 2体のまん中が画面のまん中へ来るよう、場の中身を横へ送る(歩くのと同じ速さ・同じゆるみ)
  const panX = reduce ? 0 : (0.5 - cNow) * stageW * MSA_PAN_K;
  const scrX = (x) => x + (reduce ? 0 : (0.5 - cNow) * MSA_PAN_K); // 画面の上での位置(カメラの寄せの中心に使う)
  // ダメージの数字(幅150px)の中心: 受け手が端にいても、数字が安全域の内側に収まる所まで寄せる(2026-11-17 仕上げ)
  const dmgX = (x) => { const m = (75 + MSA_SAFE) / Math.max(200, stageW); return Math.max(m, Math.min(1 - m, x)); };
  // 歩く向き: 間合いを詰める=前のめり / 下がる=のけぞる(A は右向き・B は左向き)
  const walkLean = e0.ev === 'move' && pf && f && e0.side ? (f.d < pf.d ? 1 : -0.6) * (e0.side === 'A' ? 1 : -1) * 7 : 0;
  const fx = msaFxOf(log, e0, reduce, Number(speedF) || 1);
  const hitMs = e.ev === 'tech' && !reduce ? fx.pre + msaMotionMs(e.motionKind).hit : 0;
  // カメラ: 行ごとに1回。技は攻め手へ寄る → 当たる瞬間に受け手へ振る/KO は倒れた子へ/守る・ためる・動くは軽く寄る
  useEffect(() => {
    const el = camRef.current; const e1 = log[pos];
    if (reduce || ended || !el || !e1 || typeof el.animate !== 'function') return undefined;
    const total = Math.round(msaStepMs(e1, teams[e1.side], reduce, log, Number(speedF) || 1, motionKindOf) * (Number(speedF) || 1));
    const w = el.clientWidth || stageW;
    const sx = (sd) => scrX(sd === 'A' ? xA : xB);
    // 画角の上限(2026-11-18 あっくん「アップすぎて技ではみだす」): 寄せる倍率は「2体とも(絵の半分+安全域)が場に収まる」所まで。
    //   大きな場では頭が場の上端で切れない所まで(寄せの中心は場の高さの78%)。間合いが広い・絵が大きいほど寄せは小さくなる
    const fwPx2 = wide ? bigFw : fill ? 140 : 96;
    const hwPx = fwPx2 / 2 + MSA_SAFE;
    const spanPx = Math.abs(sx('B') - sx('A')) * w + hwPx * 2;
    let sCap = spanPx > 0 ? w / spanPx : 1;
    if (wide && stageH > 0) { const topF = 0.75 - bigFh / stageH; if (topF < 0.7) sCap = Math.min(sCap, 0.78 / Math.max(0.2, 0.78 - topF)); }
    // 大きな場(r1119-008): 技の演出では使った子に寄る(参考の対戦動画の見せ方)。絵が小さいので2体を画面に入れる上限はかけず、
    //   寄せた先の子(絵の半分+安全域)と頭の上(上の topF)だけが場に収まるようにする
    if (wide) { let tCap = 1.6; if (stageH > 0) { const topF = 0.75 - bigFh / stageH; if (topF < 0.7) tCap = Math.min(tCap, 0.78 / Math.max(0.2, 0.78 - topF)); } sCap = Math.max(1, tCap); }
    else sCap = Math.max(0.85, Math.min(1.6, sCap));
    const cap = (v) => Math.min(v, sCap);
    const extAt = (x) => (wide ? { l: hwPx, r: hwPx } : { l: (x - Math.min(sx('A'), sx('B'))) * w + hwPx, r: (Math.max(sx('A'), sx('B')) - x) * w + hwPx });
    let kf = null;
    if (e1.ev === 'tech' && e1.side) {
      if (total < hitMs + 300) return undefined; // 速くしていて間に合わないときは寄せない
      const s1 = cap(fx.big ? 1.34 : 1.2); const ax = sx(e1.side); const dx = sx(e1.side === 'A' ? 'B' : 'A');
      const sw = cap(fx.big ? 1.5 : 1.36); // 構えの一拍は攻め手にぐっと寄る
      const mid = ax * 0.55 + dx * 0.45;
      kf = msaCamFrames([
        ...(fx.pre > 0 ? [[Math.max(110, fx.pre * 0.5), msaCamAt(ax, sw, w, extAt(ax))], [fx.pre, msaCamAt(ax, sw, w, extAt(ax))]] : []),
        [fx.pre > 0 ? fx.pre + 90 : Math.min(280, Math.max(120, hitMs * 0.45)), msaCamAt(ax, s1, w, extAt(ax))],
        [hitMs - 60, msaCamAt(mid, s1, w, extAt(mid))],
        [hitMs + 110, msaCamAt(dx, e1.hit ? cap(s1 + 0.08) : s1, w, extAt(dx))],
        [total - 280, msaCamAt(dx, s1 - 0.04, w, extAt(dx))],
      ], total);
    } else if (e1.ev === 'ko' && e1.side) {
      kf = msaCamFrames([[260, msaCamAt(sx(e1.side), cap(1.28), w, extAt(sx(e1.side)))], [total - 320, msaCamAt(sx(e1.side), cap(1.3), w, extAt(sx(e1.side)))]], total);
    } else if ((e1.ev === 'guard' || e1.ev === 'charge' || e1.ev === 'swap' || e1.ev === 'blow') && e1.side) { // 歩く行は寄せない(場の横送りが位置について行く)
      kf = msaCamFrames([[220, msaCamAt(sx(e1.side), cap(1.1), w, extAt(sx(e1.side)))], [total - 260, msaCamAt(sx(e1.side), cap(1.1), w, extAt(sx(e1.side)))]], total);
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
  const rkFx = MSA_RANK_FX[fx.rank] || MSA_RANK_FX[1];
  const shakeLv = reduce || !e.hit || e.ev !== 'tech' ? 0 : Math.max(rkFx.shake || 0, tier >= 4 ? 3 : tier >= 3 ? 2 : tier >= 2 ? 1 : 0);
  const shake = shakeLv > 0;
  const p = Number.isFinite(e.p) ? Math.round(e.p) : null;
  // liveGuts … 手番待ちのあいだの「いまの」ガッツ { A, B }。新しいラウンドの自動回復は記録の行に残らないので、上の帯を下の操作欄にそろえる(r1115-187)
  const liveOf = (side) => (liveGuts && Number.isFinite(Number(liveGuts[side])) ? Number(liveGuts[side]) : null);
  const gutsOf = (side) => (liveOf(side) != null ? liveOf(side) : f.g && Number.isFinite(Number(f.g[side])) ? Number(f.g[side]) : null);
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
    const tags0 = msaGutsTagsOf(log, frames, Math.min(pos, frames.length - 1), sd, regen, hitMs);
    const lv = liveOf(sd); const lvUp = lv != null && f.g && Number.isFinite(Number(f.g[sd])) ? Math.round(lv - Number(f.g[sd])) : 0;
    const tags = lvUp > 0 ? [...tags0, { t: `ガッツ +${lvUp}(回復)`, cls: 'up', delay: 0 }] : tags0; // 自動回復の分
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
    <div className={`msa-stage${fill ? ' fill' : ''}${wide ? ' big' : ''}`} ref={stageRef} data-msa-stage style={wide ? { '--msa-fw': `${bigFw}px`, '--msa-fh': `${bigFh}px`, '--msa-ab': `${Math.min(150, Math.round(bigFw * 1.15))}px`, '--msa-aw': `${Math.min(130, Math.round(bigFw * 1.05))}px` } : undefined}>
     <div className={`msa-shk ${shake ? `shake s${shakeLv}` : ''}`} key={shake ? `sh-${pos}` : 'st'} style={shake ? { animationDelay: `${hitMs}ms` } : undefined}>
      <div className="msa-cam" ref={camRef} data-msa-cam>
      <div className="msa-pan" style={{ transform: `translateX(${Math.round(panX)}px)` }} data-msa-pan>
      <div className="msa-bg" aria-hidden="true" data-msa-bgzoom={wide ? bgZoom.toFixed(2) : undefined} style={{ backgroundImage: venueImg ? `linear-gradient(180deg,rgba(20,16,38,.05),rgba(20,16,38,.5)),url(${venueImg})` : undefined, ...(wide ? { transform: `scale(${bgZoom.toFixed(3)})` } : null) }}/>
      {e.ev === 'tech' && !reduce && rkFx.bg && fx.cut > 0 && <MsaRankBg key={`rb-${pos}`} kind={e.kind} at={fx.cut}/>}
      <div className="msa-floor" aria-hidden="true"/>
      {spots.map(([a, b], d) => <React.Fragment key={d}><i className={`msa-spot ${d === f.d ? 'on' : ''}`} style={{ left: `${a * 100}%` }}/><i className={`msa-spot ${d === f.d ? 'on lb' : ''}`} data-n={AMBW_DIST[d]} style={{ left: `${b * 100}%` }}/></React.Fragment>)}
      {e.ev === 'tech' && fx.pre > 0 && preAt !== pos && <i key={`fo-${pos}`} className={`msa-focus ${e.kind}`} aria-hidden="true" data-msa-wind style={{ '--msa-pre': `${fx.pre - (fx.cut || 0)}ms`, animationDelay: `${fx.cut || 0}ms`, '--msa-cx': `${(e.side === 'A' ? xA : xB) * 100}%` }}/>}
      {e.ev === 'tech' && fx.pre > 0 && <i key={`aim-${pos}`} className={`msa-aim ${e.kind}`} aria-hidden="true" style={{ left: `${(e.side === 'A' ? xB : xA) * 100}%`, '--msa-pre': `${fx.pre - (fx.cut || 0)}ms`, animationDelay: `${fx.cut || 0}ms` }}/>}
      {e.ev === 'tech' && fx.big && fx.pre > 0 && preAt !== pos && <i key={`dim-${pos}`} className="msa-dim" aria-hidden="true" style={{ '--msa-pre': `${fx.pre - (fx.cut || 0)}ms`, animationDelay: `${fx.cut || 0}ms`, '--msa-cx': `${(e.side === 'A' ? xA : xB) * 100}%` }}/>}
      <MsaFighter side="A" lean={e0.side === 'A' ? walkLean : 0} member={mA} x={xA} prevX={xAPf} sf={sf} e={e} foeX={{ x: xB, w: stageW }} fwPx={wide ? bigFw : fill ? 140 : 96} hpNow={hpOf('A')} reduce={reduce} idleOk gd={null} fx={fx} motionOn={!fx.pre || preAt === pos} maxHp={maxHpOf('A')} gutsNow={gutsOf('A')}/>
      <MsaFighter side="B" lean={e0.side === 'B' ? walkLean : 0} member={mB} x={xB} prevX={xBPf} sf={sf} e={e} foeX={{ x: xA, w: stageW }} fwPx={wide ? bigFw : fill ? 140 : 96} hpNow={hpOf('B')} reduce={reduce} idleOk gd={null} fx={fx} motionOn={!fx.pre || preAt === pos} maxHp={maxHpOf('B')} gutsNow={gutsOf('B')}/>
      {e.ev === 'tech' && !reduce && fx.rank >= 3 && fx.pre > fx.cut && preAt !== pos && <MsaSpeedLines key={`sl-${pos}`} x={e.side === 'A' ? xA : xB} kind={e.kind} pre={fx.pre - fx.cut} at={fx.cut} rank={fx.rank}/>}
      {e.ev === 'tech' && !reduce && fx.rank >= 2 && pf && pf.d >= 2 && <MsaTrail key={`tr-${pos}`} x0={e.side === 'A' ? xA : xB} x1={e.side === 'A' ? xB : xA} kind={e.kind} rank={fx.rank} delay={Math.max(fx.pre, hitMs - 240)} dur={Math.min(300, Math.max(140, hitMs - fx.pre))}/>}
      {e.ev === 'tech' && !reduce && <MsaHitFx key={`hx-${pos}`} x={e.side === 'A' ? xB : xA} kind={e.kind} lv={rkFx.hit} delay={hitMs} hit={!!e.hit}/>}
      {e.ev === 'tech' && <MsaDmgLayer key={`dl-${pos}`} e={e} x={dmgX(e.side === 'A' ? xB : xA)} delay={hitMs} tier={tier || 1}/>}
      {e.ev === 'tech' && fx.fin && !reduce && <i key={`fin-${pos}`} className="msa-fin" aria-hidden="true" style={{ animationDelay: `${hitMs}ms` }}/>}
      </div>
      </div>
     </div>
      {/* ここから上の層(カメラ・揺れの外。字が読めるように動かさない) */}
      {!intro && !ended && ['A', 'B'].map(hud)}
      {!intro && (() => { const rn = liveGuts && Number.isFinite(Number(liveGuts.r)) && Number(liveGuts.r) > 0 ? Number(liveGuts.r) : (f.r || 0); return <div className="msa-rnd" data-msa-round={rn}><small>ラウンド</small><b>{rn || 1}{roundMax ? <small className="mx">/{roundMax}</small> : null}</b></div>; })()}
      {['A', 'B'].map((sd) => (bands[sd].length ? <div key={sd} className={`msa-bands ${sd}`}>{bands[sd].map((b, j) => <span key={`${b.k}-${b.j}`} className={`msa-band ${j ? 'old' : ''}`} data-msa-band={sd}>{b.t}</span>)}</div> : null))}
      {e.ev === 'charge' && e.why === 'sulk' && !intro && !ended && <div key={`sk-${pos}`} className={`msa-sulkstamp ${e.side === 'B' ? 'B' : 'A'}`} data-msa-sulk={e.side}><b>💢 意味不明!</b><small>{e.side === 'A' ? '' : '相手は'}言うことを聞かず、<wbr/>何もしなかった</small><small className="why">忠誠度が100より低いと、<wbr/>ときどき命令を聞きません</small></div>}
      <div className={`msa-dist ${e.ev === 'tech' && (e.side === 'A' || e.side === 'B') ? `s${e.side}` : ''}`} data-msa-dist>{AMBW_DIST.map((n, d) => <span key={d} className={d === f.d ? 'cur' : ''}>{n}</span>)}</div>
      {e.ev === 'tech' && fx.cut > 0 && <MsaCutin key={`ci-${pos}`} e={e} rank={fx.rank} member={memberOf(e.side, e.i)} ms={fx.cut}/>}
      {e.ev === 'tech' && <div key={`c-${pos}`} className={`msa-plate ${e.side === 'B' ? 'B' : 'A'} ${e.kind} ${big ? 'big' : ''}`} data-msa-cut={p == null ? '' : p} data-msa-rank={fx.rank || 1} style={fx.cut ? { animationDelay: `${fx.cut}ms` } : undefined}>
        <div><small>{e.kind === 'pow' ? '🏋️ ちから技' : '📖 かしこさ技'}{p != null ? `・命中 ${p}%` : ''}{e.tech.guts ? `・ガッツ −${e.tech.guts}` : ''}</small>
          <b>{big && e.side === 'B' ? <span className="msa-bigtag">大技</span> : null}{e.name}{big && e.side !== 'B' ? <span className="msa-bigtag">大技</span> : null}</b></div></div>}
      {e.ev === 'tech' && e.hit && !reduce && rkFx.flash > 0 && <MsaRankFlash key={`rf-${pos}`} kind={e.kind} a={rkFx.flash} delay={hitMs}/>}
      {e.ev === 'tech' && e.hit && (e.crit || fx.fin) && !reduce && <i key={`fl-${pos}`} className={`msa-flash ${e.crit ? 'big' : 'fin'}`} aria-hidden="true" style={{ animationDelay: `${hitMs}ms` }}/>}
      {e.ev === 'tech' && e.hit && e.crit && !reduce && <div key={`cc-${pos}`} className="msa-critcut" data-msa-critcut style={{ animationDelay: `${hitMs + fx.stop}ms` }}><b>会心の一撃!</b></div>}
      {intro && (
        <div className="msa-intro" data-msa-intro aria-hidden="true">
          <div className="ph1">
            <div className="ttl">{introTitle || '試合開始'}</div>
            <div className="pa">{mA ? (Array.isArray(mA.colors) && mA.colors.some(Boolean) && typeof DyedMonsterImage === 'function' ? <DyedMonsterImage baseId={mA.species} src={mscMonImg(mA.species)} masuColors={mA.colors} alt="" draggable={false}/> : <img src={mscMonImg(mA.species)} alt=""/>) : null}<span className="nm">{mA ? mA.name : ''}</span></div>
            <div className="pb">{mB ? (Array.isArray(mB.colors) && mB.colors.some(Boolean) && typeof DyedMonsterImage === 'function' ? <DyedMonsterImage baseId={mB.species} src={mscMonImg(mB.species)} masuColors={mB.colors} alt="" draggable={false}/> : <img src={mscMonImg(mB.species)} alt=""/>) : null}<span className="nm">{mB ? mB.name : ''}</span></div>
            <div className="vs">VS</div>
          </div>
          <div className="msa-word">READY</div>
          <div className="msa-word go">FIGHT!</div>
        </div>
      )}
      {ended && <div className={`msa-end ${win === 'A' ? 'w' : 'l'}`} data-msc-end={win === 'A' ? 'win' : win === 'draw' ? 'draw' : 'lose'}>{!reduce && <i className="msa-rays" aria-hidden="true"/>}<b>{win === 'A' ? '勝ち!' : win === 'draw' ? '引き分け' : '負け…'}</b>{endSub ? <small>{endSub}</small> : null}{onEndGo ? <button type="button" className="msa-endgo" data-msa-endgo onClick={onEndGo}>次へ ▶</button> : null}</div>}
    </div>
  );
}

// ---- 試合の画面(モンヒロサクセス) ----
//   input … 芯 createMatch に渡す入力(simulate と同じ形)。あれば自分で操作する
//   watch … { r, teamA, teamB }(記録だけ。オートの結果を見せる)
//   onEnd(won, { choices, auto, result }) … 決着を見せ終わったら1回だけ
// 相手の技の枠の共通の決まり(2026-11-19 段2・段3。モンサクの試合と助手マスモン対戦の両方で使う)
//   msaLastTechOf … その側が最後に使った技 id(次にその側が技を出すまで札に印を残す。交代したら消す)
//   msaFoeDangerOf … いまの間合いの代表の技の危なさ(0=届く技なし / 1〜3)。命中×威力を、その子のいちばん強い技との割合で3段に分ける
const msaLastTechOf = (log, pos, side) => { for (let k = pos; k >= 1; k--) { const r = log[k] || {}; if (r.ev === 'tech' && r.side === side) return r.move || null; if (r.ev === 'swap' && r.side === side) return null; } return null; };
const msaFoeDangerOf = (items, d, hitAt) => {
  if (!Array.isArray(items) || !items.length || typeof msaRepOf !== 'function') return 0;
  const t = msaRepOf(items, d, null); if (!t) return 0;
  const sc = (x) => (Number(hitAt ? hitAt(x, d) : x.hit) || 0) * (Number(x.power) || 0);
  const r = sc(t) / Math.max(1, ...items.map(sc));
  return r >= 0.75 ? 3 : r >= 0.45 ? 2 : 1;
};
// ---- 試合の画面の並べ方(段3b・r1119-070) ----
//   モンサクの大会の試合・助手マスモン対戦βが、この1つで並べる(縦: 見出し → 相手の技の枠 → 場 → 実況1行(+助手の「なぜ」の吹き出し)→ 自分の技の枠 → 手動の操作 → 道具の段。
//   横の低い画面: 自分の枠と操作(左)/場(まん中)/相手の枠(右))。並べ方の CSS は MSA_CSS の .msa.msa-mv の所だけ。計算・保存は持たない
//   foe / mine … { list, rep, dist, guts, hitAt, lastMove, onOpen, danger, note, extra, attrs }(MsaDistCards に渡す。extra は見出しの右・控えの顔など)
//   tools … 道具の段の中身(配列なら1つ1列)。after … 道具の段の下(見返しの帯など)。overlay … 窓・判定・始まり・決着(上に重ねるだけ)
function MsaDistRow({ side, row, title, note }) {
  const a = row.attrs || {};
  return (
    <div className={side === 'B' ? 'msa-foe' : 'msa-cardsrow'} {...(side === 'B' ? { 'data-msa-foe': '', 'data-msa-danger': row.danger || 0 } : { 'data-msa-cards': '' })} {...a}>
      <div className="msa-rowh">{title}{(row.note != null ? row.note : note) ? <small>{row.note != null ? row.note : note}</small> : null}{row.extra || null}</div>
      <MsaDistCards list={row.list} rep={row.rep} dist={row.dist} guts={row.guts} lastMove={row.lastMove} dataSide={side} hitAt={row.hitAt} onOpen={row.onOpen}/>
    </div>
  );
}
function MsaMatchView({ className = '', mode = 'watch', attrs = null, head = null, foe = null, stage = null, say = null, why = null, mine = null, controls = null, tools = null, after = null, overlay = null, fit = true, fitMin = 260 }) {
  // 場の高さを、下のボタン列まで1画面に収まる高さにする(2026-11-20 再点検 バ-24・32・35・44)。上限は決めた 420px(r1119-007)・下限 260px。
  //   入れ物の下端(スクロールする箱か画面の下)からはみ出た分だけ場を縮め、余れば 420px まで戻す。横向きの低い画面(2列)は今までどおり CSS
  const wrapRef = useRef(null);
  const [stagePx, setStagePx] = useState(null);
  const [vh, setVh] = useState(() => (typeof window !== 'undefined' ? window.innerHeight : 0));
  useEffect(() => { const on = () => setVh(window.innerHeight); window.addEventListener('resize', on); return () => window.removeEventListener('resize', on); }, []);
  React.useLayoutEffect(() => {
    const wrap = wrapRef.current; if (!wrap || typeof window === 'undefined' || !fit) return;
    if (window.innerHeight <= 500 && window.innerWidth > window.innerHeight) { if (stagePx != null) setStagePx(null); return; }
    const box = wrap.querySelector('[data-msa-stagebox]'); if (!box) return;
    const root = wrap.closest('[data-msc-root],[data-ambb-root]');
    const bottomLine = Math.min(window.innerHeight, root ? root.getBoundingClientRect().bottom : window.innerHeight);
    const contentBottom = wrap.getBoundingClientRect().top + wrap.scrollHeight;
    const cur = box.getBoundingClientRect().height;
    const next = Math.round(Math.max(fitMin, Math.min(420, cur - (contentBottom - bottomLine) - 4)));
    if (Math.abs(next - cur) > 2) setStagePx(next);
  });
  const rows = (Array.isArray(tools) ? tools : [tools]).filter(Boolean);
  return (
    <div ref={wrapRef} className={`msa msa-mv${className ? ` ${className}` : ''}`} data-msa-mv data-msa-mode={mode} data-msa-vh={vh} {...(attrs || {})}>
      <style>{MSA_CSS}{typeof MSA_SHOW_CSS === 'string' ? MSA_SHOW_CSS : ''}</style>
      {/* 2026-11-14 社長「肝心のバトルの画面が小さい」: 上下の大きな札をやめ、試合の場を主役に。名前・体力・ガッツ・ラウンドは場の上の帯(MsaStage)にある */}
      <div className="msa-main" data-msa-main>
        {/* 2026-11-20 再点検 バ-34: 相手の名前は体力の帯の上と二重だった → 見出しは大会名だけ */}
        {head ? <div className="msc-top msa-topline">{head}</div> : null}
        {foe && foe.list && foe.list.length ? <MsaDistRow side="B" row={foe} title="相手の技" note="押すと、その間合いの技が見られます"/> : null}
        <div className="msa-stagebox" data-msa-stagebox data-msa-fit={stagePx || ''} style={stagePx ? { height: `${stagePx}px`, minHeight: 0, flex: 'none' } : undefined}>{stage}</div>
        {say != null ? <div className="msa-say" data-msa-say>{say}</div> : null}
        {why}
      </div>
      <div className="msa-side" data-msa-side>
        {mine && mine.list && mine.list.length ? <MsaDistRow side="A" row={mine} title="自分の技"/> : null}
        {controls}
        {rows.map((r, i) => <div key={i} className="msa-tools" data-msa-tools={i + 1}>{r}</div>)}
        {after}
      </div>
      {overlay}
    </div>
  );
}

function MonsucArena({ s, info, engine, input, watch, onEnd }) {
  const reduce = useMemo(() => msaReduce(), []);
  const manual = Boolean(input && engine && typeof engine.createMatch === 'function');
  const mm = useMsxManualMatch(manual ? engine : null, manual ? input : null, null, info.seed);
  const log = manual ? mm.log : (watch && watch.r && Array.isArray(watch.r.log) ? watch.r.log : []);
  const teams = manual ? { A: input.teamA, B: input.teamB } : { A: watch && watch.teamA, B: watch && watch.teamB };
  const [pos, setPos] = useState(0);
  const [speed, setSpeed] = useState('x1');
  const [bg, setBg] = useState(msaBgRead);
  const [ctl, setCtl] = useState(() => msaCtlRunRead(s && s.id));   // 手動が基本。オートを選んだら保存して次の試合でも使う
  const auto = !manual || ctl === 'auto';
  const [ended, setEnded] = useState(false);
  const [endTap, setEndTap] = useState(0); // 決着の「次へ」を押した(待たずに進む。2026-11-20 再点検 バ-46)
  const [judgeOk, setJudgeOk] = useState(false);   // 判定の画面(MsaJudge)を見終えた
  const judgeIdx = useMemo(() => log.findIndex(x => x && x.ev === 'judge' && x.mode === 'three'), [log.length]);
  const [paused, setPaused] = useState(false);   // ⏸ 試合を止める(段C 2026-11-14: 助手マスモン対戦と同じ操作)
  const [techSheet, setTechSheet] = useState(null); // 技の札を押して開く、いまの間合いの一覧(見るだけ)
  const [foeSheet, setFoeSheet] = useState(null); // 相手の技の枠を押して開く、その間合いの相手の技の一覧(見るだけ。2026-11-19 段2)
  const endRef = useRef(false);
  useMhBattleBgmHold(true);
  const frames = useMemo(() => (log.length ? ambwFramesOf(log) : []), [log.length, manual ? mm.tick : 0]);
  const last = log.length - 1;
  const done = manual ? mm.done : log.length > 0;
  const result = manual ? mm.result : (watch && watch.r) || null;
  const busy = pos < last;
  // 1行ずつ進める。追いついたら、手番を待つ(自分操作)か、決着を見せる
  useEffect(() => {
    if (!log.length || ended || paused) return undefined;
    if (pos < last) {
      const cur = log[pos] || {};
      const sp = MSA_SPEEDS.find(x => x.id === speed) || MSA_SPEEDS[0];
      // 見せ場だけ: 次の見せ場(技・たおれる)まで飛ばす
      const nextPos = (p) => { let n = Math.min(last, p + 1); if (speed === 'hl' && typeof ambwIsHighlight === 'function') { const st0 = log[0] || {}; const mx = { A: st0.aHp || [], B: st0.bHp || [] }; while (n < last && !ambwIsHighlight(log[n], mx)) n++; } return n; };
      // 2026-11-20 再点検 バ-11: オートで何も起きない行(ためる・守る・歩く)が続くと待ちが長い → 見るだけの番(オート・記録)はその行を短く見せる。技・ダウン・交代はふつうの速さ
      const quiet = auto && (cur.ev === 'charge' || cur.ev === 'guard' || cur.ev === 'move') && cur.why !== 'sulk' && cur.why !== 'blown';
      const t = setTimeout(() => setPos(nextPos), Math.round(msaStepMs(cur, teams[cur.side], reduce, log, sp.f, monsucMotionKind) * sp.f * (quiet ? 0.55 : 1)));
      return () => clearTimeout(t);
    }
    if (done && (judgeIdx < 0 || judgeOk)) { const t = setTimeout(() => setEnded(true), reduce ? 300 : 900); return () => clearTimeout(t); }
    return undefined;
  }, [pos, last, speed, done, ended, paused, judgeOk, judgeIdx]);
  const won = Boolean(result && result.winner === 'A');
  // 手を選ぶ帯が出たら、帯が見える所まで入れ物(縦にだけ動く)を送る(横向きでは場の下に隠れるため)。横へは動かさない
  const barRef = useRef(null);
  const barOn = Boolean(manual && !auto && pos >= last && !ended && mm.pending);
  useEffect(() => {
    const el = barRef.current; if (!barOn || !el) return;
    const box = el.closest ? el.closest('[data-msc-root]') : null; if (!box) return;
    const r = el.getBoundingClientRect(); const b = box.getBoundingClientRect();
    // 場面を上に留める画面(低い縦・r1115-202 M14)では、留めた場面の下端までしか送らない(帯の頭が場面の下に隠れないように)
    const mainEl = box.querySelector('[data-msa-main]'); const pinned = mainEl && typeof getComputedStyle === 'function' && getComputedStyle(mainEl).position === 'sticky' && getComputedStyle(mainEl).display === 'block';
    const topLine = pinned ? mainEl.getBoundingClientRect().bottom : b.top;
    const over = r.bottom - b.bottom + 8;
    if (over > 0) box.scrollTop += Math.min(over, Math.max(0, r.top - topLine - 8));
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
    const t = setTimeout(() => { if (endRef.current) return; endRef.current = true; if (onEnd) onEnd(won, { choices: manual ? mm.choices : null, auto, result }); }, endTap ? 0 : 1700);
    return () => clearTimeout(t);
  }, [ended, endTap]);
  // 場に出す両チーム: 育てるモンスターと、相手(ライバルなら その子の染めた色)を足す。芯の入力(input)は変えない
  const stageTeams = useMemo(() => {
    const cA = info && Array.isArray(info.colors) && info.colors.some(Boolean) ? info.colors : null;
    const cB = info && info.opp && Array.isArray(info.opp.colors) && info.opp.colors.some(Boolean) ? info.opp.colors : null;
    if ((!cA && !cB) || !teams.A || !Array.isArray(teams.A.members)) return teams;
    return { ...teams,
      ...(cA ? { A: { ...teams.A, members: teams.A.members.map((m, i) => (i === 0 && m ? { ...m, colors: cA } : m)) } } : {}),
      ...(cB && teams.B && Array.isArray(teams.B.members) ? { B: { ...teams.B, members: teams.B.members.map((m, i) => (i === 0 && m ? { ...m, colors: cB } : m)) } } : {}) };
  }, [teams.A, teams.B, info && info.colors, info && info.opp && info.opp.colors]);
  const fShowH = useMsaShownFrame(log, frames, pos, teams, (MSA_SPEEDS.find(x => x.id === speed) || MSA_SPEEDS[0]).f, false, monsucMotionKind);
  if (!log.length) return <div className="msc-wrap"><p className="msc-note" style={{ textAlign: 'center', marginTop: 40 }}>試合の準備をしています…</p></div>;
  const f = frames[Math.min(pos, frames.length - 1)] || frames[0];
  const fShow = fShowH || f;
  // 手番待ち: 上の帯のガッツを、新しいラウンドの自動回復のあとの値(下の操作欄と同じ)に合わせる。相手は記録から見積もった回復の分を足す(r1115-187)
  const liveGuts = (() => {
    const op = barOn ? mm.pending : null;
    if (!op || op.kind !== 'act' || !Number.isFinite(Number(op.guts)) || !f || !f.g) return null;
    const out = { A: Number(op.guts), r: Number(op.round) || 0 }; // r … いまのラウンド(上の帯のラウンドの数字も、新しいラウンドに合わせる)
    if (Number.isFinite(Number(op.round)) && Number(op.round) > (Number(f.r) || 0) && typeof msaRegenOf === 'function') {
      const rg = Number(msaRegenOf(log, frames)[`B${f.act ? f.act.B : 0}`]) || 0;
      const gMax = typeof window !== 'undefined' && window.ASSISTANT_MASMON_BATTLE && window.ASSISTANT_MASMON_BATTLE.GUTS_MAX ? window.ASSISTANT_MASMON_BATTLE.GUTS_MAX : 99;
      if (rg > 0 && Number.isFinite(Number(f.g.B))) out.B = Math.min(gMax, Number(f.g.B) + rg);
    }
    return out;
  })();
  const e = log[pos] || {};
  const st = log[0] || {};
  const maxHp = { A: st.aHp || [], B: st.bHp || [] };
  const nm = (side, i) => { const t = teams[side]; const ms = (t && t.members) || []; const m = ms[Number.isFinite(i) ? i : f.act[side]] || ms[0]; return (m && m.name) || ''; };
  const pick = (c) => { if (busy || !manual) return; if (mm.pick(c)) setPos(p => p + 1); }; // 選んだ手の行からすぐ見せる
  const goAuto = () => { if (!manual) return; msaCtlRunWrite(s && s.id, 'auto'); setCtl('auto'); };
  // 飛ばす: 手動の試合は残りをオートで決めてから最後へ
  const skip = () => { if (manual && !done) { mm.toAuto(); const n = mm.match ? mm.match.log.length : 0; setPos(Math.max(0, n - 1)); return; } setPos(last); };
  const showBar = Boolean(manual && !auto && !ended && mm.pending); // 演出中(busy)も出したまま押せない形にする(r1115-050② 案L1)
  // 実況: いまから2手前までの見せ場の1行
  let call = null;
  if (typeof msaCallOf === 'function') for (let k = pos; k >= Math.max(1, pos - 2) && !call; k--) { const c = msaCallOf(log, frames, k, maxHp, nm); if (c) call = { ...c, at: k }; }
  // 間合いごとの技の札(自分の側の4枚・いまの間合いに「いま」)。自分で選ぶ帯が出ているあいだは帯の札を使う
  const catalog = input && input.catalog ? input.catalog : null;
  const mvA = (st.aMoves || [])[f.act.A], mbA = teams.A && teams.A.members ? teams.A.members[f.act.A] : null;
  const itemsA = typeof ambwTechItems === 'function' && Array.isArray(mvA) ? ambwTechItems(catalog, mbA, mvA) : null;
  const hitAtA = (t, d) => { const v = catalog && typeof ambwHitPct === 'function' ? ambwHitPct(catalog, teams, 'A', { ...f, d }, t.id) : null; return v != null ? v : t.hit; };
  const cardsOn = Boolean(itemsA && itemsA.length && typeof MsaDistCards === 'function' && !ended && !showBar);
  // 相手の技の枠(2026-11-19 段2・社長「相手の技が分からないと、その距離が危険かどうか分からない」): 零近中遠に1技ずつ・いつも出す。
  //   いまの間合いの枠を光らせ、光の強さで危なさを3段に分ける(字は出さない r1119 B②)。使った技は次にその子が技を出すまで札に残す
  const mvB = (st.bMoves || [])[f.act.B], mbB = teams.B && teams.B.members ? teams.B.members[f.act.B] : null;
  const itemsB = typeof ambwTechItems === 'function' && Array.isArray(mvB) ? ambwTechItems(catalog, mbB, mvB) : null;
  const hitAtB = (t, d) => { const v = catalog && typeof ambwHitPct === 'function' ? ambwHitPct(catalog, teams, 'B', { ...f, d }, t.id) : null; return v != null ? v : t.hit; };
  const lastTechOf = (side) => msaLastTechOf(log, pos, side);
  // 実況の欄を空にしない(2026-11-20 再点検 バ-17・59): いまの行に言うことが無いときは、直前の文を残す。始まる前は大会名で「開始!」
  //   始まりの1行で、決着がつかないときの決まり(何ラウンドで判定か)も知らせる(2026-11-20 再点検 バ-09)
  const rLimit = (input && Number(input.roundLimit)) || 30 * Math.max(1, ((teams.A && teams.A.members) || []).length, ((teams.B && teams.B.members) || []).length);
  const opening = `${info.title ? `${info.title}、` : ''}試合開始!(${rLimit}ラウンドで判定)`;
  const sayNow = (() => { for (let k = pos; k >= Math.max(0, pos - 4); k--) { const t = msaSay(log[k], nm, log); if (t) return k <= 2 && (log[k] || {}).ev !== 'tech' ? opening : t; } return opening; })();
  const foeOn = Boolean(itemsB && itemsB.length && typeof MsaDistCards === 'function' && !ended);
  const foeDanger = foeOn ? msaFoeDangerOf(itemsB, f.d, hitAtB) : 0;
  const ctlSw = <MsaCtlToggle ctl={ctl} save={false} onChange={(v) => { msaCtlRunWrite(s && s.id, v); setCtl(v); }}/>;
  const pauseBtn = <button type="button" className="msa-pause" data-msc-pause aria-label={paused ? 'つづける' : '一時停止'} onClick={() => { setPaused(v => !v); }}>{paused ? '▶' : '⏸'}</button>;
  // 道具の段(丸いボタンの並び・MsaMatchView の tools。1つ1列)。中身は見るだけ/オート/手動で替える
  const tools = ended ? null : manual && !auto ? [(
    <>
      {pauseBtn}
      {MSA_SPEEDS.slice(0, 2).map(x => <button key={x.id} type="button" className={speed === x.id ? 'on' : ''} aria-label={`見せる速さ ${x.label}`} onClick={() => { setSpeed(x.id); }}>{x.label}</button>)}
      {ctlSw}
      <MsaBgToggle bg={bg} onChange={setBg}/>
    </>
  )] : [(
    <>
      {pauseBtn}
      {MSA_SPEEDS.map(x => <button key={x.id} type="button" className={speed === x.id ? 'on' : ''} onClick={() => { setSpeed(x.id); }}>{x.label}</button>)}
      <button type="button" data-msc-hl className={speed === 'hl' ? 'on' : ''} aria-label="見せ場(技・ダウン)だけを見る" onClick={() => { setSpeed(v => (v === 'hl' ? 'x1' : 'hl')); }}>★見せ場だけ</button>
      <button type="button" data-msc-skip onClick={skip}>⏭ 飛ばす</button>
      {!manual ? <MsaBgToggle bg={bg} onChange={setBg}/> : null}
    </>
  ), manual ? <>{ctlSw}<MsaBgToggle bg={bg} onChange={setBg}/></> : null];
  return (
    <MsaMatchView className="msc-wrap" mode={manual ? (auto ? 'auto' : 'manual') : 'watch'} attrs={{ 'data-msc-match': '', 'data-msa-pos': pos }}
      head={<><b className="msc-ttl">{info.title} {MSC_STARS(info.star)}</b>{info.buffs ? <i className="msc-buff">✨ 特別な1話</i> : null}</>}
      foe={foeOn ? { list: itemsB, rep: msaRepIds(itemsB, null), dist: f.d, guts: f.g.B, lastMove: lastTechOf('B'), hitAt: hitAtB, danger: foeDanger, onOpen: (d) => setFoeSheet(d) } : null}
      stage={<MsaStage log={log} frames={frames} pos={pos} teams={stageTeams} venueImg={msaVenueBg(info.venue, bg)} ended={ended} win={result ? result.winner : null} introTitle={info.title} speedF={(MSA_SPEEDS.find(x => x.id === speed) || MSA_SPEEDS[0]).f} fill wide liveGuts={liveGuts} motionKindOf={monsucMotionKind} onEndGo={ended ? () => setEndTap(1) : null} roundMax={rLimit} endSub={judgeIdx >= 0 ? `${(log[judgeIdx] || {}).limit || rLimit}ラウンドで決着つかず・判定${won ? '勝ち' : '負け'}` : ''}/>}
      say={call ? <div key={`call-${call.at}`} className={`msa-call ${call.k}`} data-msa-call={call.k}>🎙 {call.t}</div> : sayNow}
      mine={cardsOn ? { list: itemsA, rep: msaRepIds(itemsA, null), dist: f.d, guts: f.g.A, lastMove: lastTechOf('A'), hitAt: hitAtA, note: '命中はガッツで上下(▲▼)', onOpen: (d) => setTechSheet(d) } : null}
      controls={<><div ref={barRef}>{showBar ? <MsxManualBar opt={mm.pending} onPick={pick} onAuto={goAuto} busy={busy} look="c"/> : null}</div>
        {manual && !auto && busy && !ended && !showBar ? <div className="msa-wait">{e.side === 'B' ? '相手の番…' : ' '}</div> : null}</>}
      tools={tools}
      overlay={<>
        {judgeIdx >= 0 && pos >= judgeIdx && !judgeOk ? <MsaJudge row={log[judgeIdx]} names={{ A: nm('A'), B: nm('B') }} onGo={() => setJudgeOk(true)}/> : null}
        {foeSheet != null && itemsB && typeof MsaTechSheet === 'function' ? <MsaTechSheet title={`${nm('B')}(相手)の${AMBW_DIST[foeSheet]}の技`} list={itemsB} d={foeSheet} dist={f.d} rep={msaRepIds(itemsB, null)} hitAt={hitAtB} onClose={() => setFoeSheet(null)}/> : null}
        {techSheet != null && itemsA && typeof MsaTechSheet === 'function' ? <MsaTechSheet title={`${nm('A')} の${AMBW_DIST[techSheet]}の技`} list={itemsA} d={techSheet} dist={f.d} rep={msaRepIds(itemsA, null)} hitAt={hitAtA} onClose={() => setTechSheet(null)}/> : null}
      </>}/>
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
.msa-call.sulk{color:#fecaca;background:linear-gradient(90deg,#be123c99,#0000)}
.msa-sulkstamp{--msa-tx:-50%;--msa-r:-4deg;position:absolute;z-index:9;left:50%;top:30%;width:max-content;max-width:calc(100% - 20px);transform:translateX(-50%) rotate(-4deg);text-align:center;pointer-events:none;animation:msaSStamp .45s ease-out both}
.msa-sulkstamp b{display:block;font-size:26px;font-weight:900;color:#fff;white-space:nowrap;-webkit-text-stroke:2px #9f1239;paint-order:stroke fill;text-shadow:0 3px 0 #4c0519,0 0 18px #fb7185}
.msa-sulkstamp small{display:inline-block;max-width:100%;margin-top:4px;padding:2px 10px;border-radius:10px;background:#4c0519dd;color:#fecdd3;font-size:11.5px;font-weight:900;white-space:normal;word-break:keep-all;overflow-wrap:normal;line-height:1.3}
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
/* 真ん中に置く札(left:50%+translateX(-50%))の出る動きは transform を上書きするので、横のずらしは --msa-tx・傾きは --msa-r で動きの中にも入れる(2026-11-15 r1115-050 文が右へずれて切れた) */
@keyframes msaSStamp{0%{opacity:0;transform:translateX(var(--msa-tx,0)) rotate(var(--msa-r,0deg)) scale(2.6)}60%{opacity:1;transform:translateX(var(--msa-tx,0)) rotate(var(--msa-r,0deg)) scale(.9)}100%{opacity:1;transform:translateX(var(--msa-tx,0)) rotate(var(--msa-r,0deg)) scale(1)}}
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
  if (e.ev === 'ko') { const n = left(e.side); return { k: 'ko', t: n ? `${e.name}、ダウン! 残りは ${n}体!` : `${e.name}、ダウン! 勝負あり!` }; }
  if (e.ev === 'enter' && msaIsNext(log, k) && many(e.side) && left(e.side) === 1) return { k: 'last', t: `最後の1体、${who(e.side, e.i)}が出てきた!` };
  if (e.ev === 'charge' && e.why === 'sulk') return { k: 'sulk', t: `${who(e.side, e.i)}は 意味不明! 言うことを聞かない…` };
  if (e.ev === 'swap') return { k: 'swap', t: `ここで交代! ${who(e.side, e.i)}が前へ!` };
  if (e.ev === 'move' && e.why === 'blown') return { k: 'blown', t: `${who(e.side, e.i)}、遠くへ 吹き飛ばされた!` };
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
// 判定の画面(2026-11-15 r1115-058 社長): 30ターンで決着がつかなかったときの「判定!」。試合の配置とは別の独立した部品(画面いっぱいに重ねる)
//   row … 芯の判定の行 { rows:[{key,a,b,win}], winsA, winsB, by, hpA, hpB, limit }。names … { A, B }。onGo … タップか9秒で次へ
const MSA_JUDGE_LABEL = { pct: ['❤️', '残ライフ'], dmg: ['⚔️', '与えたダメージ'], guts: ['🔥', '消費ガッツ'] };
const MSA_JUDGE_BY = { hp: '勝ち数が同じなので、残ライフの量(実数)で決着', pct: '残ライフの量も同じなので、残ライフ%で決着', dmg: 'ここまで同じなので、与えたダメージで決着', tie: '全て同じなので、引き分けにせず負け扱い' };
const MSA_JUDGE_CSS = `
.msa-judge{position:fixed;inset:0;z-index:9650;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;padding:max(12px,env(safe-area-inset-top)) 12px max(12px,env(safe-area-inset-bottom));background:#0b0820f2;color:#fff;overflow-y:auto;font-family:inherit}
.msa-judge>*{flex:none;width:100%;max-width:420px}
.msa-judge-big{text-align:center;font-size:40px;font-weight:900;font-style:italic;color:#fde047;text-shadow:0 3px 0 #92400e,0 0 18px #fde047aa;line-height:1.1}
.msa-judge-sub{text-align:center;font-size:11.5px;color:#cbd5e1;word-break:auto-phrase}
.msa-judge-head,.msa-judge-row{display:grid;grid-template-columns:minmax(0,1.5fr) minmax(0,1fr) minmax(0,1fr) 50px;gap:4px;align-items:center}
.msa-judge-head{font-size:10.5px;font-weight:900;color:#94a3b8;text-align:center}
.msa-judge-head span:first-child{text-align:left}
.msa-judge-head b{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.msa-judge-row{background:#1e1a36;border:1px solid #3b3566;border-radius:12px;padding:6px 8px;min-height:44px;font-size:12px}
.msa-judge-row .nm{font-weight:900;font-size:11.5px;line-height:1.25;word-break:auto-phrase}
.msa-judge-row .v{text-align:center;font-weight:900;font-size:15px;color:#cbd5e1}
.msa-judge-row .v.w{color:#fde047}
.msa-judge-row .v small{display:block;font-size:10px;font-weight:700;color:#94a3b8;line-height:1.2}
.msa-judge-row .v.w small{color:#fde68a}
.msa-judge-row .r{text-align:center;font-size:10.5px;font-weight:900;border-radius:99px;padding:2px 0;background:#334155;color:#e2e8f0}
.msa-judge-row .r.A{background:#db2777;color:#fff}.msa-judge-row .r.B{background:#0369a1;color:#fff}
.msa-judge-res{text-align:center;background:#1e1a36;border:1px solid #fde047;border-radius:14px;padding:8px}
.msa-judge-res b{display:block;font-size:20px;font-weight:900;color:#fde047}
.msa-judge-res.l b{color:#cbd5e1}
.msa-judge-res small{display:block;margin-top:2px;font-size:11px;line-height:1.5;color:#e2e8f0;word-break:auto-phrase}
.msa-judge-go{min-height:44px;border:0;border-radius:99px;font-weight:900;font-size:13px;color:#fff;background:linear-gradient(90deg,#ec4899,#f97316);cursor:pointer}
@media (max-height:440px){.msa-judge{gap:4px;padding-top:6px;padding-bottom:6px}.msa-judge-big{font-size:26px}.msa-judge-sub{font-size:10.5px}.msa-judge-row{min-height:36px;padding:3px 8px}.msa-judge-res{padding:4px}.msa-judge-res b{font-size:16px}.msa-judge-res small{font-size:10.5px;line-height:1.35}.msa-judge-go{min-height:40px}}
@media (min-width:700px) and (max-height:440px){.msa-judge{padding-left:64px;padding-right:64px}}
`;
function MsaJudge({ row, names, onGo }) {
  const done = useRef(false);
  const go = () => { if (done.current) return; done.current = true; onGo(); };
  useEffect(() => { msaSe('tap'); const t = setTimeout(go, 9000); return () => clearTimeout(t); }, []);
  const fmt = (k, v) => (k === 'pct' ? `${v}%` : String(v));
  const rows = Array.isArray(row.rows) ? row.rows : [];
  const win = row.winner === 'A';
  const by = MSA_JUDGE_BY[row.by];
  return (
    <div className="msa-judge" data-msa-judge={win ? 'win' : 'lose'} onClick={go} role="button" aria-label="結果へ">
      <style>{MSA_JUDGE_CSS}</style>
      <div className="msa-judge-big">判定!</div>
      <div className="msa-judge-sub">{row.limit || 30}ラウンドで決着がつかなかったので、3つの比べで決めます</div>
      <div className="msa-judge-head"><span>比べる物</span><span><b>{(names && names.A) || '自分'}</b></span><span><b>{(names && names.B) || '相手'}</b></span><span>勝ち</span></div>
      {rows.map((r) => {
        const lb = MSA_JUDGE_LABEL[r.key] || ['', r.key];
        return (
          <div key={r.key} className="msa-judge-row" data-msa-judge-row={r.key}>
            <span className="nm">{lb[0]}{lb[1]}</span>
            <span className={`v ${r.win === 'A' ? 'w' : ''}`}>{fmt(r.key, r.a)}{r.key === 'pct' && row.mxA ? <small>{row.hpA}/{row.mxA}</small> : null}</span>
            <span className={`v ${r.win === 'B' ? 'w' : ''}`}>{fmt(r.key, r.b)}{r.key === 'pct' && row.mxB ? <small>{row.hpB}/{row.mxB}</small> : null}</span>
            <span className={`r ${r.win || ''}`}>{r.win === 'A' ? '自分' : r.win === 'B' ? '相手' : '同じ'}</span>
          </div>
        );
      })}
      <div className={`msa-judge-res ${win ? 'w' : 'l'}`}>
        <b>{win ? '判定勝ち!' : '判定負け…'}</b>
        <small>自分 {row.winsA}勝 ・ 相手 {row.winsB}勝{by ? <><br/>{by}{row.by === 'hp' ? `(自分 ${row.hpA} ・ 相手 ${row.hpB})` : ''}</> : null}</small>
      </div>
      <button type="button" className="msa-judge-go" onClick={(ev) => { ev.stopPropagation(); go(); }}>結果へ ▶</button>
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

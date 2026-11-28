// ===== クリスマスのミステリーノベル「聖夜の名探偵」の再生画面(台帳 r1126-022) =====
// 進め方の計算は 79-xmas-novel-engine.jsx、台本のデータは 79-xmas-novel-script.jsx(tools/novel/xmas-novel-build.js が SCRIPT.md から作る)。
// 入口は openXmasNovel(opts) の関数1つ(イベントページの物語タブなどから呼ぶ)。App の状態は使わず、自分で body に重ねて開き、閉じたら片づける。
//   opts.playerName … 台詞の {name} に入れる名前 / opts.onClose() … 閉じたあと / opts.force … 期間の外でも開く(デバッグ・検査だけ)
//   遊べるのはイベントの期間中だけ(xmasNovelPlayableAt)。期間の外は開かずに false を返す。保存の記録は消さない
// 保存は新しいキー mh_xmas_novel_v1 と、分岐の地図の読み直しの mh_xmas_novel_route_v1(r1126-102)だけ(⑦)。ほかに読むのは、台詞の {name} に入れるブリーダー名(mh_breeder_name)だけ。形は xmasNovelNormalize。
// 見た目: 暗めの紺と雪・金の細い縁・明朝寄りの見出し。縦・横・タブレットで、立ち絵と文の箱の置き方を変える。動きは prefers-reduced-motion で止める

const XMAS_NOVEL_CSS = `
.mh-nv { position: fixed; inset: 0; z-index: 140; background: #02050d; color: #eef2ff; overflow: hidden; user-select: none; -webkit-user-select: none;
  font-family: 'Hiragino Kaku Gothic ProN', 'Noto Sans JP', sans-serif; -webkit-tap-highlight-color: transparent; }
.mh-nv-serif { font-family: 'Hiragino Mincho ProN', 'Yu Mincho', 'YuMincho', 'Noto Serif JP', 'Shippori Mincho', serif; }
.mh-nv-stage { position: absolute; inset: 0; }
.mh-nv-bg { position: absolute; inset: 0; background-size: cover; background-position: center; transition: opacity .6s ease; }
.mh-nv-bg[data-xmas-novel-bg="past"] { filter: sepia(.75) saturate(.7) contrast(.92) brightness(.92); }
.mh-nv-bg::after { content: ''; position: absolute; inset: 0; background: linear-gradient(180deg, transparent 55%, rgba(0,0,0,.42) 100%), radial-gradient(130% 90% at 50% 40%, transparent 40%, rgba(0,0,0,.72) 100%); }
.mh-nv-snow { position: absolute; inset: -10% 0 0 0; pointer-events: none; opacity: .55;
  background-image: radial-gradient(1.6px 1.6px at 10% 20%, #fff 50%, transparent 51%), radial-gradient(1.2px 1.2px at 30% 70%, #fff 50%, transparent 51%),
    radial-gradient(2px 2px at 55% 35%, #fff 50%, transparent 51%), radial-gradient(1.3px 1.3px at 75% 80%, #fff 50%, transparent 51%),
    radial-gradient(1.8px 1.8px at 90% 15%, #fff 50%, transparent 51%), radial-gradient(1.1px 1.1px at 45% 90%, #fff 50%, transparent 51%);
  background-size: 260px 260px; animation: mh-nv-snow 14s linear infinite; }
.mh-nv-snow.b { background-size: 170px 170px; opacity: .35; animation-duration: 9s; }
@keyframes mh-nv-snow { from { background-position: 0 0; } to { background-position: 40px 260px; } }
/* 立ち絵の置き場(r1126-067)。上の端から文字の箱の上(名札の上)までの帯で、絵はその中に場面の見せ方(寄り・ふだん・引き)で置き、下の縁で切ってぼかす。
   大きさと位置は useXmasNovelPlace が決める(置くまでは見せない) */
.mh-nv-fig { position: absolute; left: 0; right: 0; top: 0; height: 78%; overflow: hidden; pointer-events: none;
  -webkit-mask-image: linear-gradient(180deg, #000 calc(100% - 26px), transparent); mask-image: linear-gradient(180deg, #000 calc(100% - 26px), transparent); }
.mh-nv-fig:not([data-placed]) > * { visibility: hidden; }
.mh-nv-fig img { position: absolute; object-fit: contain; filter: drop-shadow(0 6px 18px rgba(0,0,0,.6)); animation: mh-nv-in .35s ease; }
.mh-nv-fig.face img { border-radius: 50%; }
.mh-nv-fig.dim img, .mh-nv-fig.dim svg { filter: brightness(.55) drop-shadow(0 6px 18px rgba(0,0,0,.6)); }
@keyframes mh-nv-in { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } }
.mh-nv-box { position: absolute; left: 50%; transform: translateX(-50%); bottom: max(10px, env(safe-area-inset-bottom)); width: min(calc(100% - 20px), 880px); min-height: 132px;
  border-radius: 14px; padding: 22px 18px 14px; background: linear-gradient(180deg, rgba(10,20,48,.92), rgba(5,10,28,.95));
  box-shadow: 0 0 0 1px rgba(232,196,106,.75), 0 0 0 4px rgba(10,20,48,.9), 0 0 0 5px rgba(232,196,106,.35), 0 12px 30px rgba(0,0,0,.55); }
.mh-nv-name { position: absolute; top: -15px; left: 16px; padding: 3px 16px; border-radius: 6px; font-size: 15px; font-weight: 800; letter-spacing: .08em;
  background: linear-gradient(180deg, #1b2c5c, #0c1636); color: #f8e3a4; box-shadow: 0 0 0 1px rgba(232,196,106,.85); }
.mh-nv-text { font-size: 17px; line-height: 1.75; font-weight: 600; white-space: pre-wrap; min-height: 3.5em; text-align: left; word-break: normal; line-break: normal; overflow-wrap: anywhere; text-wrap: wrap; }
.mh-nv-plain { text-align: left; word-break: normal; line-break: normal; overflow-wrap: anywhere; text-wrap: wrap; }
/* 章の札・題の札の文も左寄せ(事件簿の中の文は左寄せ・r1126-048。折るのは文節の切れ目だけ・XmasNovelWrap・r1126-071。飾りの見出しは起動画面の題字とエンドの札だけ) */
.mh-nv-cardtext { width: min(100%, 560px); }
.mh-nv-cardtext .mh-nv-rule { margin: 14px 0; }
.mh-nv-text.say .mh-nv-say-body { display: block; padding-left: 1em; text-indent: -1em; }
.mh-nv-text.say .mh-nv-say-lead { display: block; font-size: 13px; color: #b9c6e8; line-height: 1.5; margin-bottom: 2px; }
.mh-nv-text.say .mh-nv-say-lead.only { font-size: inherit; color: #d6def5; margin: 0; }
.mh-nv-text.se { text-align: center; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px; }
.mh-nv-se-sound { display: block; font-size: 21px; font-weight: 800; letter-spacing: .14em; color: #f3e6c0; text-shadow: 0 0 12px rgba(232,196,106,.35); }
.mh-nv-se-note { display: block; font-size: 12px; font-weight: 600; letter-spacing: .02em; color: #a9b6da; line-height: 1.55; }
.mh-nv-text.band { text-align: left; color: #c9d3ee; font-style: normal; }
.mh-nv-text.band.letter { color: #ff8a8a; }
/* 予告の手紙(帯の頭の「(手紙)」・r1126-058): 紙に赤い字。にじみながら、ゆっくり浮かぶ */
.mh-nv-letter { position: absolute; left: 50%; top: 18%; width: min(80vw, 420px); padding: 24px 22px; z-index: 4; border-radius: 3px;
  background: radial-gradient(120% 90% at 50% 40%, #f4ecd8 0%, #e7d8b4 70%, #cdb88c 100%); box-shadow: 0 14px 34px rgba(0,0,0,.65);
  color: #a3080e; font-weight: 900; font-size: clamp(17px, 4.6vw, 22px); line-height: 1.9; letter-spacing: .08em; white-space: pre-line;
  text-shadow: 0 0 1px rgba(140,0,0,.7), 0 1px 7px rgba(170,0,0,.45); transform: translateX(-50%) rotate(-1.5deg); animation: mhNvLetterIn 2.4s ease both; }
@keyframes mhNvLetterIn { 0% { opacity: 0; filter: blur(7px); transform: translate(-50%, 14px) rotate(-3deg); } 55% { opacity: 1; filter: blur(1.5px); } 100% { opacity: 1; filter: none; transform: translateX(-50%) rotate(-1.5deg); } }
.mh-nv-note { margin-top: 2px; font-size: 11px; color: #9fb0d8; }
.mh-nv-next { position: absolute; right: 14px; bottom: 8px; width: 0; height: 0; border-left: 7px solid transparent; border-right: 7px solid transparent; border-top: 9px solid #e8c46a; animation: mh-nv-bob 1s ease-in-out infinite; }
@keyframes mh-nv-bob { 50% { transform: translateY(4px); } }
.mh-nv-top { position: absolute; top: max(8px, env(safe-area-inset-top)); left: 8px; right: 8px; display: flex; align-items: center; gap: 6px; z-index: 6; }
.mh-nv-where { min-width: 0; flex: 1; font-size: 12px; color: #c9d4f2; text-shadow: 0 1px 3px #000; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
/* 縦では、章と場面の題を2行に分ける(1行だと「第七章　ひとつ…」と章の名前まで切れた・2026-11-28 総点検 4番)。それぞれ入らないときだけ「…」 */
/* 縦では、題をボタンの段の下に1段で出し、画面の幅いっぱいを使う(右のボタン5つに押されて「第一章 ペンシ…」と切れた・台帳 r1126-091)。
   いちばん長い題(「第一章　ペンション・シュプール　/　ホールのもみの木」26字)も 12px で1行に入る。入らない端末だけ「…」 */
@media (orientation: portrait) {
  .mh-nv-top { flex-wrap: wrap; row-gap: 4px; }
  .mh-nv-top > .mh-nv-where { order: 2; flex: 0 0 100%; font-size: 12px; padding: 0 2px; }
  .mh-nv-top > .mh-nv-where + .mh-nv-btn { margin-left: auto; }
}
.mh-nv-btn { min-height: 38px; min-width: 38px; padding: 0 10px; border-radius: 10px; display: inline-flex; align-items: center; justify-content: center; gap: 4px; font-size: 12px; font-weight: 800;
  color: #f3e3b0; background: rgba(8,16,40,.82); box-shadow: 0 0 0 1px rgba(232,196,106,.55); }
.mh-nv-btn[data-on] { background: #b8892e; color: #1a1205; }
.mh-nv-btn:active { transform: scale(.95); }
.mh-nv-btn.wide { min-height: 50px; width: 100%; font-size: 15px; border-radius: 12px; }
.mh-nv-btn:disabled { opacity: .4; }
.mh-nv-fx { position: absolute; inset: 0; pointer-events: none; z-index: 4; }
.mh-nv-fx.dark { background: #000; animation: mh-nv-fade .5s ease both; }
.mh-nv-fx.white { background: #fff; animation: mh-nv-flash .9s ease both; }
.mh-nv-fx.red { background: #b0101a; mix-blend-mode: screen; animation: mh-nv-flash .45s ease both; }
.mh-nv-fx.light { background: #fff; animation: mh-nv-flash 1.4s ease both; }
@keyframes mh-nv-fade { from { opacity: 0; } to { opacity: 1; } }
@keyframes mh-nv-flash { 0% { opacity: 0; } 25% { opacity: .9; } 100% { opacity: 0; } }
.mh-nv-shake { animation: mh-nv-shake .5s ease; }
@keyframes mh-nv-shake { 10%, 90% { transform: translate(-2px, 1px); } 20%, 80% { transform: translate(4px, -2px); } 30%, 50%, 70% { transform: translate(-6px, 2px); } 40%, 60% { transform: translate(6px, -1px); } }
.mh-nv-card { position: absolute; inset: 0; z-index: 7; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; padding: 24px;
  background: radial-gradient(120% 70% at 50% 45%, rgba(18,32,72,.9), rgba(2,5,14,.97)); animation: mh-nv-fade .6s ease both; }
.mh-nv-rule { width: min(70vw, 360px); height: 1px; background: linear-gradient(90deg, transparent, #e8c46a, transparent); margin: 14px auto; }
.mh-nv-gold { color: #f3d98e; text-shadow: 0 0 12px rgba(232,196,106,.35), 0 2px 2px rgba(0,0,0,.6); }
.mh-nv-sheet { position: absolute; inset: 0; z-index: 9; display: flex; align-items: flex-end; justify-content: center; background: rgba(0,0,0,.6); animation: mh-nv-fade .2s ease both; }
.mh-nv-panel { width: min(100%, 720px); max-height: 92%; display: flex; flex-direction: column; border-radius: 16px 16px 0 0; padding: 14px 14px max(14px, env(safe-area-inset-bottom));
  background: linear-gradient(180deg, #13214a, #070e26); box-shadow: 0 0 0 1px rgba(232,196,106,.7); }
@media (min-width: 700px), (orientation: landscape) { .mh-nv-sheet { align-items: center; } .mh-nv-panel { border-radius: 16px; max-height: 88%; } }
.mh-nv-scroll { overflow-y: auto; -webkit-overflow-scrolling: touch; min-height: 0; }
.mh-nv-clue { border-radius: 10px; padding: 10px 12px; background: rgba(4,10,30,.75); box-shadow: 0 0 0 1px rgba(232,196,106,.35); text-align: left; width: 100%; }
.mh-nv-clue[data-pick] { box-shadow: 0 0 0 2px #e8c46a; }
.mh-nv-get { position: absolute; left: 50%; top: 22%; transform: translateX(-50%); z-index: 8; width: min(86vw, 380px); padding: 14px 16px; border-radius: 12px; text-align: center;
  background: linear-gradient(180deg, #1c2d61, #0a1435); box-shadow: 0 0 0 1px #e8c46a, 0 0 30px rgba(232,196,106,.35); animation: mh-nv-get .7s cubic-bezier(.2,1.4,.4,1) both; }
@keyframes mh-nv-get { from { opacity: 0; transform: translate(-50%, -20px) scale(.85); } to { opacity: 1; transform: translate(-50%, 0) scale(1); } }
.mh-nv-cast { display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); gap: 6px; }
.mh-nv-person { position: relative; display: flex; flex-direction: column; align-items: center; gap: 2px; padding: 4px 2px; border-radius: 10px; background: rgba(4,10,30,.6); box-shadow: 0 0 0 1px rgba(232,196,106,.3); font-size: 10px; font-weight: 800; }
.mh-nv-person .ph { width: 100%; aspect-ratio: 1; border-radius: 8px; overflow: hidden; background: #0b1533; display: flex; align-items: center; justify-content: center; }
.mh-nv-person .ph img { width: 100%; height: 100%; object-fit: cover; object-position: top; }
.mh-nv-person[data-st='missing'] .ph { filter: grayscale(1) brightness(.75); }
.mh-nv-person[data-st='dead'] .ph { filter: grayscale(1) brightness(.3); }
.mh-nv-person .stamp { position: absolute; top: 34%; left: 50%; transform: translateX(-50%) rotate(-12deg); padding: 0 4px; border: 2px solid #d33; color: #f55; font-size: 9px; background: rgba(0,0,0,.4); white-space: nowrap; }
.mh-nv-person .tag { position: absolute; top: 4px; right: 4px; padding: 0 4px; border-radius: 4px; background: #f0f0f0; color: #a11; font-size: 9px; }
.mh-nv-person[data-st='santa'] .ph { filter: grayscale(1) brightness(.25); }
.mh-nv-person .santa { position: absolute; top: 12%; left: 50%; width: 70%; transform: translateX(-50%) rotate(-10deg); }
.mh-nv-person[data-fresh] { animation: mh-nv-fresh 1.1s ease; box-shadow: 0 0 0 2px #e8c46a; }
.mh-nv-person[data-fresh] .stamp, .mh-nv-person[data-fresh] .santa { animation: mh-nv-stamp .5s cubic-bezier(.2,1.6,.4,1) both; }
@keyframes mh-nv-fresh { 0% { transform: scale(1); } 30% { transform: scale(1.08); } 100% { transform: scale(1); } }
@keyframes mh-nv-stamp { from { opacity: 0; scale: 2.2; } to { opacity: 1; scale: 1; } }
.mh-nv-fig.laugh svg, .mh-nv-fig.laugh .mh-nv-boss { animation: mh-nv-laugh .25s ease-in-out 6; }
@keyframes mh-nv-laugh { 50% { transform: translateY(-4px) scaleY(1.03); } }
.mh-nv-person .cross { position: absolute; left: 4%; top: 3%; width: 92%; aspect-ratio: 1; pointer-events: none; filter: drop-shadow(0 0 2px rgba(0,0,0,.6)); }
.mh-nv-person[data-fresh] .cross .s1, .mh-nv-person[data-fresh] .cross .s2 { stroke-dasharray: 100; stroke-dashoffset: 100; animation: mh-nv-cross-draw .38s ease-out forwards; }
.mh-nv-person[data-fresh] .cross .s2 { animation-delay: .42s; }
.mh-nv-person[data-fresh] .cross .drip { opacity: 0; animation: mh-nv-cross-drip .9s ease-in .85s forwards; }
@keyframes mh-nv-cross-draw { to { stroke-dashoffset: 0; } }
@keyframes mh-nv-cross-drip { 0% { opacity: 0; transform: translateY(-4px); } 40% { opacity: 1; } 100% { opacity: 1; transform: translateY(0); } }
@media (prefers-reduced-motion: reduce) { .mh-nv-person[data-fresh] .cross .s1, .mh-nv-person[data-fresh] .cross .s2, .mh-nv-person[data-fresh] .cross .drip { animation: none; stroke-dashoffset: 0; opacity: 1; } }
.mh-nv-choice { width: 100%; min-height: 52px; padding: 10px 14px; border-radius: 12px; font-size: 15px; font-weight: 800; color: #fff3d0; text-align: left; word-break: normal; line-break: normal; overflow-wrap: anywhere; text-wrap: wrap;
  background: linear-gradient(180deg, rgba(27,44,92,.95), rgba(10,20,52,.95)); box-shadow: 0 0 0 1px #e8c46a, 0 6px 16px rgba(0,0,0,.45); }
.mh-nv-choice:active { transform: scale(.98); }
.mh-nv-curtain { position: absolute; inset: 0; z-index: 4; pointer-events: none; transform: translateY(-102%);
  background: repeating-linear-gradient(90deg, #5a0710 0px, #9e1424 22px, #c62a3a 34px, #9e1424 46px, #5a0710 68px);
  box-shadow: inset 0 -26px 0 #c99a3c, inset 0 -30px 0 #6b4a14, 0 10px 30px rgba(0,0,0,.6); }
.mh-nv-curtain::before { content: ''; position: absolute; left: 0; right: 0; top: 0; height: 14%; background: linear-gradient(180deg, #4a050c, #8e1220 70%, #c99a3c 72%, #6b4a14 76%, transparent 77%); }
.mh-nv-curtain[data-st='down'] { animation: mh-nv-curtain-down 1.6s cubic-bezier(.45,.05,.3,1) both; }
.mh-nv-curtain[data-st='up'] { animation: mh-nv-curtain-up 1.6s cubic-bezier(.45,.05,.3,1) both; }
@keyframes mh-nv-curtain-down { from { transform: translateY(-102%); } to { transform: translateY(0); } }
@keyframes mh-nv-curtain-up { from { transform: translateY(0); } to { transform: translateY(-102%); } }
@media (prefers-reduced-motion: reduce) { .mh-nv-curtain[data-st='down'] { animation: none; transform: none; } .mh-nv-curtain[data-st='up'] { animation: none; } }
.mh-nv-fx.bleed { background:
    radial-gradient(60% 45% at 0% 10%, rgba(150,0,12,.85), transparent 70%), radial-gradient(55% 40% at 100% 30%, rgba(130,0,10,.8), transparent 70%),
    radial-gradient(70% 45% at 15% 100%, rgba(140,0,12,.85), transparent 70%), radial-gradient(50% 35% at 95% 95%, rgba(120,0,8,.75), transparent 70%);
  animation: mh-nv-bleed 2.4s ease-out both; }
@keyframes mh-nv-bleed { 0% { opacity: 0; transform: scale(1.35); filter: blur(6px); } 25% { opacity: 1; transform: scale(1); filter: blur(0); } 70% { opacity: .9; } 100% { opacity: 0; } }
.mh-nv-fallen { position: absolute; left: 50%; bottom: 24%; width: min(80vw, 520px); transform: translateX(-50%); z-index: 4; filter: drop-shadow(0 0 2px rgba(190,200,230,.35)); pointer-events: none; animation: mh-nv-fade 1.2s ease both; }
.mh-nv-body { position: absolute; inset: 0; z-index: 4; pointer-events: none; }
.mh-nv-body.noblood .pool { display: none; }
.mh-nv-body-dim { position: absolute; inset: 0; -webkit-backdrop-filter: grayscale(.9) brightness(.55); backdrop-filter: grayscale(.9) brightness(.55);
  background: radial-gradient(70% 34% at var(--fx, 50%) var(--fy, 74%), rgba(120,0,14,.42), rgba(120,0,14,0) 72%), radial-gradient(120% 90% at 50% 40%, rgba(6,10,34,.35), rgba(0,0,4,.88)); animation: mh-nv-fade 1.4s ease both; }
.mh-nv-body-lie { position: absolute; }
.mh-nv-body-lie > img { position: absolute; left: 50%; top: 50%; max-width: none; object-fit: fill; transform: translate(-50%, -50%) rotate(-90deg); animation: mh-nv-body-in 1.6s ease-out both !important;
  filter: brightness(0) drop-shadow(0 0 1px rgba(210,30,40,.75)) drop-shadow(0 0 16px rgba(110,0,12,.6)) !important; }
.mh-nv-body-lie > img.cut { -webkit-mask-image: linear-gradient(180deg, #000 50%, transparent 88%); mask-image: linear-gradient(180deg, #000 50%, transparent 88%); }
.mh-nv-body-lie.sit > img { left: 0; top: 0; transform: none; transform-origin: 50% 100%; -webkit-mask-image: linear-gradient(180deg, #000 62%, transparent 100%); mask-image: linear-gradient(180deg, #000 62%, transparent 100%); }
.mh-nv-body-lie .ground { position: absolute; left: -12%; right: -12%; bottom: -10%; height: 34%; border-radius: 50%; background: radial-gradient(50% 50% at 50% 50%, rgba(0,0,0,.72), rgba(0,0,0,0) 100%); }
.mh-nv-body-lie .drift { position: absolute; left: -45%; bottom: -12%; width: 190%; height: 52%; pointer-events: none; filter: blur(1.5px); animation: mh-nv-body-in 1.6s ease-out both; }
.mh-nv-body-lie.sit.prone .pool { left: -55%; bottom: -6%; width: 120%; height: 30%; }
.mh-nv-body-lie .pool { position: absolute; left: -20%; bottom: -14%; width: 82%; height: 46%; transform-origin: 30% 50%; filter: drop-shadow(0 0 6px rgba(140,0,16,.55));
  animation: mh-nv-pool 3.2s cubic-bezier(.2,.6,.3,1) .5s both; }
.mh-nv-body-lie.sit .pool { left: -30%; bottom: -8%; width: 160%; height: 22%; transform-origin: 50% 50%; }
@keyframes mh-nv-body-in { from { opacity: 0; } to { opacity: 1; } }
@keyframes mh-nv-pool { from { transform: scale(.08, .05); opacity: .6; } to { transform: scale(1); opacity: 1; } }
.mh-nv-body.again .mh-nv-body-dim, .mh-nv-body.again img, .mh-nv-body.again .pool { animation-duration: .25s !important; animation-delay: 0s !important; }
@media (prefers-reduced-motion: reduce) { .mh-nv-body-dim, .mh-nv-body-lie img, .mh-nv-body-lie .pool { animation: none !important; } }
.mh-nv-boss { position: relative; height: 86%; aspect-ratio: 985 / 1347; max-width: 100%; }
.mh-nv-boss img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: contain; filter: brightness(0) drop-shadow(0 0 10px rgba(180,0,20,.55)) !important; animation: none !important; }
.mh-nv-boss .eye { position: absolute; top: 34.5%; width: 7%; height: 3.2%; border-radius: 50%; transform: translate(-50%, -50%);
  background: radial-gradient(circle, #fff3f3 0%, #ff2a3a 35%, rgba(255,0,30,.0) 75%); box-shadow: 0 0 18px 6px rgba(255,20,40,.75); animation: mh-nv-eye 2.6s ease-in-out infinite; }
@keyframes mh-nv-eye { 0%, 100% { opacity: .85; } 50% { opacity: 1; } 92% { opacity: .1; } }
@media (prefers-reduced-motion: reduce) { .mh-nv-fx.bleed { animation-duration: .01s; } .mh-nv-boss .eye { animation: none; } }
.mh-nv-card:has(.mh-nv-gameover) { background: radial-gradient(120% 70% at 50% 45%, rgba(70,0,8,.92), rgba(4,0,2,.98)); }
.mh-nv-gameover-title { font-family: 'Hiragino Mincho ProN', 'Yu Mincho', serif; font-size: min(44px, 10vw); white-space: nowrap; font-weight: 900; letter-spacing: .08em; color: #e0192e;
  text-shadow: 0 0 18px rgba(255,0,30,.6), 2px 0 rgba(255,80,80,.4), -2px 0 rgba(120,0,0,.6); margin-bottom: 10px; animation: mh-nv-gameover 1.6s ease both; }
@keyframes mh-nv-gameover { 0% { opacity: 0; filter: blur(6px); transform: scale(1.3); } 60% { opacity: 1; filter: blur(0); transform: none; } }
.mh-nv-red { color: #ff5a64; text-shadow: 0 0 12px rgba(255,0,30,.45), 0 2px 2px rgba(0,0,0,.6); }
.mh-nv-boot { background: #030407; }
.mh-nv-noise { position: absolute; inset: -20%; pointer-events: none; opacity: .13; z-index: 1;
  background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='2' stitchTiles='stitch'/></filter><rect width='160' height='160' filter='url(%23n)' opacity='.9'/></svg>");
  animation: mh-nv-noise .35s steps(3) infinite; }
@keyframes mh-nv-noise { 0% { transform: translate(0, 0); } 33% { transform: translate(-7%, 4%); } 66% { transform: translate(5%, -6%); } 100% { transform: translate(0, 0); } }
.mh-nv-scan { position: absolute; inset: 0; pointer-events: none; z-index: 2; background: repeating-linear-gradient(0deg, rgba(0,0,0,.38) 0 1px, transparent 1px 3px); }
.mh-nv-boot > .absolute { z-index: 3; }
.mh-nv-boot .mh-nv-top { z-index: 6; } /* 閉じるボタンを本文の層より上に(押せるように) */
.mh-nv-boot-logo { animation: mh-nv-flicker 4s infinite; }
.mh-nv-boot-series { font-size: 40px; font-weight: 900; letter-spacing: .08em; color: #ece6d6; line-height: 1.15;
  text-shadow: 2px 0 rgba(255,20,60,.55), -2px 0 rgba(0,200,255,.45), 0 0 18px rgba(255,255,255,.25); }
.mh-nv-boot-title { margin-top: 6px; font-size: 15px; font-weight: 800; letter-spacing: .12em; color: #c9b38a; }
.mh-nv-boot-sub { font-size: 26px; font-weight: 900; letter-spacing: .2em; color: #f3d98e; text-shadow: 0 0 14px rgba(232,196,106,.4); }
.mh-nv-boot-press { color: #9aa3b8; animation: mh-nv-blink 1.4s steps(2) infinite; }
.mh-nv-boot-btn { background: rgba(0,0,0,.65); color: #ece6d6; box-shadow: 0 0 0 1px rgba(200,180,130,.6); }
@keyframes mh-nv-flicker { 0%, 92%, 100% { opacity: 1; transform: none; } 93% { opacity: .55; transform: translateX(2px); } 95% { opacity: 1; transform: translateX(-1px); } 97% { opacity: .8; } }
@keyframes mh-nv-blink { 50% { opacity: .2; } }
.mh-nv-history { padding: 10px 12px; }
.mh-nv-crt { position: absolute; inset: 0; pointer-events: none; z-index: 3; background: repeating-linear-gradient(0deg, rgba(0,0,0,.18) 0 1px, transparent 1px 3px);
  box-shadow: inset 0 0 90px rgba(0,0,0,.55); }
.mh-nv-transit { position: absolute; inset: 0; z-index: 8; pointer-events: none; overflow: hidden; background: #000; }
.mh-nv-transit .scr { position: absolute; left: 50%; top: 45%; width: 70vmin; height: 52vmin; transform: translate(-50%, -50%); border-radius: 10px;
  background: radial-gradient(circle, rgba(200,230,255,.9), rgba(60,90,140,.6) 60%, rgba(0,0,0,.9)); box-shadow: 0 0 0 6px #222, 0 0 40px rgba(150,200,255,.5); }
.mh-nv-transit[data-dir='in'] { animation: mh-nv-tin 1.1s ease both; }
.mh-nv-transit[data-dir='in'] .scr { animation: mh-nv-zoom-in 1.1s cubic-bezier(.6,0,.4,1) both; }
.mh-nv-transit[data-dir='out'] { animation: mh-nv-tin 1.1s ease both; }
.mh-nv-transit[data-dir='out'] .scr { animation: mh-nv-zoom-out 1.1s cubic-bezier(.6,0,.4,1) both; }
@keyframes mh-nv-tin { 0% { opacity: 0; } 15% { opacity: 1; } 80% { opacity: 1; } 100% { opacity: 0; } }
@keyframes mh-nv-zoom-in { 0% { transform: translate(-50%, -50%) scale(.6); } 100% { transform: translate(-50%, -50%) scale(4); opacity: .2; } }
@keyframes mh-nv-zoom-out { 0% { transform: translate(-50%, -50%) scale(4); opacity: .2; } 100% { transform: translate(-50%, -50%) scale(.6); opacity: 1; } }
@media (prefers-reduced-motion: reduce) { .mh-nv-noise, .mh-nv-boot-logo, .mh-nv-boot-press { animation: none; } .mh-nv-transit { animation-duration: .01s !important; } }
@media (orientation: landscape) and (max-height: 560px) {
  /* 選択肢・推理の窓・GAME OVER の札は、上の帯(ボタンの列)の下から出す(上のボタンに重なった・2026-11-28 総点検 9番) */
  .mh-nv-sheet { padding-top: calc(max(8px, env(safe-area-inset-top)) + 46px); }
  .mh-nv-sheet .mh-nv-panel { max-height: 100%; }
  .mh-nv-card { padding-top: calc(max(8px, env(safe-area-inset-top)) + 48px); padding-bottom: 12px; justify-content: safe center; overflow-y: auto; }
  .mh-nv-fig { left: 0; right: auto; width: min(42vw, 460px); }
  .mh-nv-box { left: auto; right: 10px; transform: none; width: min(calc(60vw - 10px), 760px); min-height: 110px; padding-top: 20px; }
  .mh-nv-text { font-size: 15px; line-height: 1.65; }
  .mh-nv-cast { grid-template-columns: repeat(12, minmax(0, 1fr)); }
  /* 起動画面: 背の低い横では題の上と「一発で当てた数」が画面の端で切れた(#7857 点検の8)。字とボタンを縮め、上下中央は余るときだけにする */
  .mh-nv-boot > .absolute { justify-content: flex-start; padding-top: 10px; padding-bottom: 10px; }
  .mh-nv-boot > .absolute > * { margin-top: auto; margin-bottom: auto; }
  .mh-nv-boot-series { font-size: 28px; }
  .mh-nv-boot-title { margin-top: 2px; font-size: 13px; }
  .mh-nv-boot .mh-nv-rule { margin: 6px auto; }
  .mh-nv-boot-sub { font-size: 20px; }
  .mh-nv-boot [data-xmas-novel-title] .mh-nv-boot-press { margin-top: 8px; }
  .mh-nv-boot [data-xmas-novel-title] .mh-nv-btn.wide { min-height: 40px; }
  .mh-nv-boot [data-xmas-novel-perfect] { margin-top: 8px; }
}
@media (min-width: 900px) and (min-height: 700px) { .mh-nv-text { font-size: 19px; } .mh-nv-box { min-height: 150px; } }
/* ---- 場面の切り替えと人物の登場の演出(台帳 r1126-094)。暗い側に合わせ、光らせない・跳ねさせない ----
   切り替え(.mh-nv-sw): place=場所が替わる(暗い幕が横に流れて明ける) / time=時間が飛ぶ(暗転して、ゆっくり明ける) /
   past=過去編へ入る(色あせた光がにじんで、古い写真の色になる) / open=章の札のあと・読み始め(黒から明ける)。
   既読・オートは .fast で短く、スキップ中は出さない。札(.mh-nv-place)は場所の名前 */
.mh-nv-sw { position: absolute; inset: 0; z-index: 4; pointer-events: none; }
.mh-nv-sw.place { background: linear-gradient(90deg, transparent 0%, rgba(0,0,0,.85) 14%, #000 26%, #000 100%); animation: mh-nv-sw-wipe 1.15s cubic-bezier(.55,.05,.35,1) both; }
@keyframes mh-nv-sw-wipe { 0% { transform: translateX(-26%); opacity: 1; } 100% { transform: translateX(105%); opacity: 1; } }
.mh-nv-sw.time { background: #000; animation: mh-nv-sw-time 2.1s ease-in both; }
@keyframes mh-nv-sw-time { 0%, 30% { opacity: 1; } 100% { opacity: 0; } }
.mh-nv-sw.open { background: #000; animation: mh-nv-sw-time 1.5s ease-in both; }
.mh-nv-sw.past { background: radial-gradient(80% 70% at 50% 45%, rgba(214,182,128,.55) 0%, rgba(90,60,24,.8) 60%, rgba(12,7,2,1) 100%); animation: mh-nv-sw-past 2.6s ease-out both; }
.mh-nv-sw.past::after { content: ''; position: absolute; inset: 0; background: repeating-linear-gradient(90deg, rgba(0,0,0,.18) 0 1px, transparent 1px 7px); animation: mh-nv-sw-film .18s steps(2) 8; }
@keyframes mh-nv-sw-past { 0% { opacity: 1; filter: blur(10px); } 35% { opacity: .92; filter: blur(4px); } 100% { opacity: 0; filter: none; } }
@keyframes mh-nv-sw-film { 50% { transform: translateX(3px); opacity: .5; } }
.mh-nv-sw.fast { animation-duration: .45s; }
.mh-nv-sw.fast.place { animation-duration: .5s; }
.mh-nv-sw.fast::after { animation: none; }
/* 背景の絵は、替わったときにゆっくり寄る(押し込みすぎない) */
.mh-nv-bg.in-place { animation: mh-nv-bg-push 2.2s ease-out both; }
.mh-nv-bg.in-time, .mh-nv-bg.in-open { animation: mh-nv-bg-push 3s ease-out both; }
.mh-nv-bg.in-past { animation: mh-nv-bg-push 3.4s ease-out both; }
.mh-nv-bg.fast { animation-duration: .5s; }
@keyframes mh-nv-bg-push { from { transform: scale(1.06); } to { transform: none; } }
.mh-nv-place { position: absolute; left: 14px; top: calc(max(8px, env(safe-area-inset-top)) + 50px); z-index: 5; pointer-events: none; max-width: calc(100% - 28px);
  padding: 6px 14px 6px 12px; border-left: 2px solid rgba(232,196,106,.8); background: linear-gradient(90deg, rgba(0,0,0,.72), rgba(0,0,0,0));
  color: #e6dcc0; font-size: 14px; font-weight: 800; letter-spacing: .14em; text-shadow: 0 1px 3px #000; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  animation: mh-nv-place 3.2s ease both; }
.mh-nv-place.past { border-left-color: rgba(196,150,90,.85); color: #e2cfa6; }
.mh-nv-place.fast { animation-duration: 1.4s; }
@keyframes mh-nv-place { 0% { opacity: 0; transform: translateX(-12px); } 18% { opacity: 1; transform: none; } 78% { opacity: 1; } 100% { opacity: 0; } }
@media (orientation: portrait) { .mh-nv-place { top: calc(max(8px, env(safe-area-inset-top)) + 72px); } }
/* 章の札: 黒から明けて、章の名前が字の間を詰めながら浮かび、線が中から伸び、題がにじみから浮かぶ */
.mh-nv-card.open { animation: mh-nv-fade 1s ease both; background: radial-gradient(110% 70% at 50% 45%, rgba(26,22,40,.92), rgba(1,2,6,.99)); }
.mh-nv-card.open .mh-nv-card-label { animation: mh-nv-card-label 1.6s ease-out both; }
.mh-nv-card.open .mh-nv-rule { animation: mh-nv-card-rule 1.1s ease-out .35s both; }
.mh-nv-card.open .mh-nv-card-title { animation: mh-nv-card-title 1.5s ease-out .6s both; }
.mh-nv-card.open .mh-nv-card-hint { animation: mh-nv-fade .8s ease 1.9s both; }
.mh-nv-card.open .mh-nv-card-ghost { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; pointer-events: none; overflow: hidden;
  font-size: min(26vw, 220px); font-weight: 900; color: rgba(160,20,30,.08); letter-spacing: -.02em; white-space: nowrap; animation: mh-nv-card-ghost 4s ease-out both; }
.mh-nv-cardtext { position: relative; }
@keyframes mh-nv-card-label { from { opacity: 0; letter-spacing: 1.2em; } to { opacity: 1; letter-spacing: .5em; } }
@keyframes mh-nv-card-rule { from { transform: scaleX(0); opacity: 0; } to { transform: none; opacity: 1; } }
@keyframes mh-nv-card-title { 0% { opacity: 0; filter: blur(8px); transform: translateY(8px); } 100% { opacity: 1; filter: none; transform: none; } }
@keyframes mh-nv-card-ghost { from { opacity: 0; transform: scale(1.08); } to { opacity: 1; transform: none; } }
/* 人物の登場: first=その人が初めて出る(影の姿から浮かぶ) / swap=話し手が替わる(少し寄って出る) / face=表情だけ替わる(すっと替わる)。fast は短く */
.mh-nv-fig.enter-first img { animation: mh-nv-enter-first 1.5s ease-out both; }
.mh-nv-fig.enter-swap img { animation: mh-nv-enter-swap .5s cubic-bezier(.2,.7,.3,1) both; }
.mh-nv-fig.enter-face img { animation: mh-nv-enter-face .22s ease both; }
.mh-nv-fig.fast img { animation-duration: .3s; }
@keyframes mh-nv-enter-first {
  0% { opacity: 0; transform: translateY(10px) scale(.985); filter: brightness(0) blur(4px) drop-shadow(0 6px 18px rgba(0,0,0,.6)); }
  40% { opacity: 1; transform: none; filter: brightness(0) blur(1px) drop-shadow(0 0 6px rgba(180,190,220,.35)); }
  100% { opacity: 1; transform: none; filter: brightness(1) blur(0) drop-shadow(0 6px 18px rgba(0,0,0,.6)); } }
@keyframes mh-nv-enter-swap { from { opacity: 0; transform: translateX(-16px) scale(.97); filter: brightness(.7) drop-shadow(0 6px 18px rgba(0,0,0,.6)); } to { opacity: 1; transform: none; filter: brightness(1) drop-shadow(0 6px 18px rgba(0,0,0,.6)); } }
@keyframes mh-nv-enter-face { from { opacity: .55; } to { opacity: 1; } }
/* 初めて出る人の名札: 立ち絵の左上に、金の線が左から伸びてから肩書きと名前が浮かぶ。しばらくして消える */
.mh-nv-intro { position: absolute !important; left: 6%; top: 18%; display: flex; flex-direction: column; align-items: flex-start; gap: 2px; padding: 0 18px 8px 2px; pointer-events: none; z-index: 2;
  animation: mh-nv-intro 3.6s ease both; }
.mh-nv-intro .bar { position: absolute; left: 0; right: 0; bottom: 0; height: 1px; background: linear-gradient(90deg, #e8c46a, rgba(232,196,106,.6) 70%, transparent); transform-origin: left; animation: mh-nv-intro-bar .7s ease-out both; }
.mh-nv-intro .nm { font-size: clamp(24px, 6.4vw, 32px); font-weight: 900; letter-spacing: .16em; line-height: 1.2; color: #f1e6c8; white-space: nowrap; text-shadow: 0 0 12px rgba(0,0,0,.95), 0 2px 3px #000; animation: mh-nv-intro-nm 1.1s ease-out .3s both; }
.mh-nv-intro .role { font-size: 12px; font-weight: 800; letter-spacing: .3em; color: #d2b272; white-space: nowrap; text-shadow: 0 0 8px #000, 0 1px 3px #000; animation: mh-nv-intro-nm .9s ease-out .15s both; }
.mh-nv-intro.fast { animation-duration: 1.6s; }
.mh-nv-intro.fast .bar, .mh-nv-intro.fast .nm, .mh-nv-intro.fast .role { animation-duration: .3s; animation-delay: 0s; }
@keyframes mh-nv-intro { 0% { opacity: 1; } 82% { opacity: 1; } 100% { opacity: 0; } }
@keyframes mh-nv-intro-bar { from { transform: scaleX(0); } to { transform: none; } }
@keyframes mh-nv-intro-nm { from { opacity: 0; filter: blur(6px); transform: translateX(-10px); } to { opacity: 1; filter: none; transform: none; } }
@media (orientation: landscape) and (max-height: 560px) { .mh-nv-intro { left: 4%; top: 22%; } .mh-nv-intro .nm { font-size: 24px; } }
/* 遺体・倒れた影を見つける行(台帳 r1126-094 追記1): 文のあいだは暗転(dark)、文が出きって一拍おいてから、ゆっくり明ける(show)。影はその下から浮かぶ */
.mh-nv-veil { position: absolute; inset: 0; z-index: 4; pointer-events: none; background: #000; }
.mh-nv-veil.dark { animation: mh-nv-fade .35s ease both; }
.mh-nv-veil.show { animation: mh-nv-veil-lift 1.8s ease-in both; }
.mh-nv-veil.fast.show { animation-duration: .5s; }
@keyframes mh-nv-veil-lift { 0%, 15% { opacity: 1; } 100% { opacity: 0; } }
/* 血を見せない影(白瀬など)は、真っ黒で見えなかった(社長「白瀬の死亡シーンって出てた？」)。冷たい光を当て、縁を白く光らせて形を見せる */
.mh-nv-body.noblood .mh-nv-body-dim { background: radial-gradient(42% 30% at var(--fx, 50%) var(--fy, 74%), rgba(150,180,235,.30), rgba(150,180,235,0) 75%), radial-gradient(120% 90% at 50% 40%, rgba(6,10,34,.35), rgba(0,0,4,.88)) !important; }
.mh-nv-body.noblood .mh-nv-body-lie img { filter: brightness(0) drop-shadow(0 0 1.5px rgba(225,235,255,.95)) drop-shadow(0 0 3px rgba(200,215,250,.6)) drop-shadow(0 0 20px rgba(140,170,230,.55)) !important; }
/* 大事な選択の「選んだ状態」と決定の札(台帳 r1126-113)。光らせすぎず、真鍮の縁と赤い印で示す */
.mh-nv-person[data-pick] { box-shadow: 0 0 0 2px #e8c46a, 0 0 16px rgba(232,196,106,.35); background: rgba(40,30,10,.8); }
.mh-nv-person[data-pick]::after { content: '✓'; position: absolute; top: 2px; left: 4px; width: 18px; height: 18px; border-radius: 50%; background: #b0101a; color: #fff; font-size: 11px; line-height: 18px; text-align: center; }
.mh-nv-clue[data-pick] { box-shadow: 0 0 0 2px #e8c46a, 0 0 16px rgba(232,196,106,.25); }
.mh-nv-choice[data-pick] { box-shadow: 0 0 0 2px #e8c46a, 0 0 18px rgba(232,196,106,.3); background: linear-gradient(180deg, rgba(60,44,14,.95), rgba(24,18,8,.95)); }
.mh-nv-decide { margin-top: 10px; padding-top: 10px; border-top: 1px solid rgba(232,196,106,.35); }
.mh-nv-decide-what { margin-bottom: 6px; font-size: 13px; font-weight: 800; color: #f3e3b0; text-align: left; word-break: normal; overflow-wrap: anywhere; }
/* 背の低い横では、窓の全体を1つに流し(人の並び・手がかりが0の高さにつぶれた)、決定の札は下に貼りつける */
@media (orientation: landscape) and (max-height: 560px) {
  .mh-nv-sheet .mh-nv-panel { overflow-y: auto; -webkit-overflow-scrolling: touch; }
  .mh-nv-sheet .mh-nv-panel > .mh-nv-scroll { flex: none; overflow: visible; }
  .mh-nv-decide { position: sticky; bottom: calc(-1 * max(14px, env(safe-area-inset-bottom))); z-index: 2; margin-left: -14px; margin-right: -14px; padding: 8px 14px 10px; background: #0b1430; }
  .mh-nv-decide .mh-nv-btn.wide { min-height: 42px; }
}
.mh-nv-decide .mh-nv-btn:not(:disabled) { background: #8f1d24; color: #fff3e0; box-shadow: 0 0 0 1px #e8c46a; }
/* 人物の並びの置き場(登場人物の行・カーテンコール): 上の帯(ボタンと章の題)と文字の箱のあいだの、まん中(台帳 r1126-094 追記4。上に寄せた枠が章の題の帯にかぶっていた) */
.mh-nv-panelwrap { position: absolute; left: 0; right: 0; top: calc(max(8px, env(safe-area-inset-top)) + 54px); bottom: 172px; z-index: 5; display: flex; align-items: center; justify-content: center; padding: 0 3vw; pointer-events: none; }
.mh-nv-panelin { width: min(100%, 640px); max-height: 100%; }
.mh-nv-panelbox { border-radius: 16px; padding: 12px 12px 14px; background: radial-gradient(120% 90% at 50% 30%, rgba(14,20,44,.92), rgba(3,5,14,.95)); box-shadow: 0 0 0 1px rgba(232,196,106,.75), 0 18px 40px rgba(0,0,0,.6); }
.mh-nv-panelhead { text-align: center; font-size: 17px; font-weight: 900; letter-spacing: .5em; padding-left: .5em; }
.mh-nv-panelrule { height: 1px; margin: 8px auto 10px; width: 70%; background: linear-gradient(90deg, transparent, #e8c46a, transparent); }
.mh-nv-cast.big .mh-nv-person { font-size: 11px; }
@media (orientation: portrait) {
  .mh-nv-panelwrap { top: calc(max(8px, env(safe-area-inset-top)) + 80px); }
  .mh-nv-cast.big { grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px; }
  .mh-nv-cast.big .mh-nv-person { font-size: 12px; padding: 5px 3px 6px; }
}
@media (orientation: landscape) and (max-height: 560px) { .mh-nv-panelwrap { bottom: 132px; padding: 0 2vw; } .mh-nv-panelin { width: min(100%, 760px); } .mh-nv-panelbox { padding: 8px 10px 10px; } .mh-nv-panelhead { font-size: 14px; } .mh-nv-panelrule { margin: 5px auto 7px; } }
/* 紹介の動き: 枠が暗がりから開き → 見出しの字の間が詰まり → 1人ずつ(0.16秒おき)影の姿から色が戻って名前と入る → そろったら全員に金の光が1度走る */
.mh-nv-panelbox.intro { animation: mh-nv-panel-open .7s ease-out both; }
.mh-nv-panelbox.intro .mh-nv-panelhead { animation: mh-nv-card-label 1.1s ease-out both; }
.mh-nv-panelbox.intro .mh-nv-panelrule { animation: mh-nv-card-rule .9s ease-out .25s both; }
.mh-nv-panelbox.intro .mh-nv-person { animation: mh-nv-cast-in .75s cubic-bezier(.2,.7,.3,1) calc(.55s + var(--i, 0) * .16s) both, mh-nv-cast-glow 1.2s ease-out 2.75s both; }
.mh-nv-panelbox.intro .mh-nv-person .ph img { animation: mh-nv-cast-face .75s ease-out calc(.55s + var(--i, 0) * .16s) both; }
.mh-nv-panelbox.intro.fast .mh-nv-person { animation: mh-nv-cast-in .3s ease-out calc(.1s + var(--i, 0) * .04s) both, mh-nv-cast-glow .8s ease-out .7s both; }
.mh-nv-panelbox.intro.fast .mh-nv-person .ph img { animation: mh-nv-cast-face .3s ease-out calc(.1s + var(--i, 0) * .04s) both; }
.mh-nv-panelbox.intro.fast, .mh-nv-panelbox.intro.fast .mh-nv-panelhead, .mh-nv-panelbox.intro.fast .mh-nv-panelrule { animation-duration: .3s; animation-delay: 0s; }
.mh-nv-panelbox.intro.done, .mh-nv-panelbox.intro.done *, .mh-nv-panelbox.intro.done .mh-nv-person .ph img { animation: none !important; }
@keyframes mh-nv-panel-open { from { opacity: 0; transform: scale(.96); filter: brightness(.3); } to { opacity: 1; transform: none; filter: none; } }
@keyframes mh-nv-cast-in { 0% { opacity: 0; transform: translateY(12px) scale(.94); } 60% { opacity: 1; } 100% { opacity: 1; transform: none; } }
@keyframes mh-nv-cast-face { 0% { filter: brightness(0) blur(3px); } 45% { filter: brightness(0) blur(0); } 100% { filter: none; } }
@keyframes mh-nv-cast-glow { 0% { box-shadow: 0 0 0 1px rgba(232,196,106,.3); } 35% { box-shadow: 0 0 0 1px rgba(232,196,106,.95), 0 0 14px rgba(232,196,106,.35); } 100% { box-shadow: 0 0 0 1px rgba(232,196,106,.3); } }
@media (prefers-reduced-motion: reduce) {
  .mh-nv-panelbox.intro, .mh-nv-panelbox.intro * { animation: none !important; }
  .mh-nv-veil { animation-duration: .01s !important; }
  .mh-nv-sw, .mh-nv-sw::after, .mh-nv-bg.in-place, .mh-nv-bg.in-time, .mh-nv-bg.in-open, .mh-nv-bg.in-past, .mh-nv-card.open *, .mh-nv-fig.enter-first img, .mh-nv-fig.enter-swap img, .mh-nv-fig.enter-face img, .mh-nv-intro, .mh-nv-intro * { animation-duration: .01s !important; animation-delay: 0s !important; }
}
@media (prefers-reduced-motion: reduce) { .mh-nv-snow, .mh-nv-next, .mh-nv-shake, .mh-nv-get, .mh-nv-fig img { animation: none !important; } }

/* ===================== ホラーの見た目(台帳 r1126-112 追記3・社長が選んだホラー案 #8082) =====================
   墨の黒・暗い紙・にじむ暗い赤・ちらつき・傷んだ紙・ゆっくり寄る黒いサンタの影。字の大きさ・押せる大きさは変えない(色・縁・背景・動きだけ)。
   明るく光らせない(r1126-093 追記1)。動きを減らす設定では、ちらつき・影の寄り・垂れる赤・闇の息・ざらつきの動きを止める */
.mh-nv { --hr-ink: #030304; --hr-paper: #120e0b; --hr-paper2: #18120f; --hr-bone: #e2d9c4; --hr-bone2: #a59c87; --hr-red: #6d0b12; --hr-red2: #a3161f; background: var(--hr-ink); }
.mh-nv::before { content: ''; position: absolute; inset: -10%; z-index: 30; pointer-events: none; opacity: .14;
  background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='2'/></filter><rect width='160' height='160' filter='url(%23n)'/></svg>");
  animation: mh-hr-grain .45s steps(3) infinite; }
@keyframes mh-hr-grain { 33% { transform: translate(-2%, 1%); } 66% { transform: translate(1%, -2%); } }
.mh-nv-stage::after { content: ''; position: absolute; inset: 0; z-index: 3; pointer-events: none;
  background: linear-gradient(180deg, rgba(0,0,0,.5), transparent 28%, transparent 62%, rgba(0,0,0,.6)), radial-gradient(40% 25% at 0% 0%, rgba(110,8,14,.30), transparent 70%), radial-gradient(45% 30% at 100% 100%, rgba(110,8,14,.26), transparent 70%);
  animation: mh-hr-breathe 7s ease-in-out infinite; }
@keyframes mh-hr-breathe { 50% { opacity: .7; } }
.mh-nv-bg { filter: saturate(.45) brightness(.62) contrast(1.1) sepia(.18); }
.mh-nv-bg[data-xmas-novel-bg="past"] { filter: sepia(.85) saturate(.55) contrast(.92) brightness(.72); }
.mh-nv-bg::after { background: linear-gradient(180deg, transparent 50%, rgba(0,0,0,.55) 100%), radial-gradient(120% 85% at 50% 40%, transparent 34%, rgba(0,0,0,.86) 100%); }
/* 字の色: 金 → 古い紙の白、にじむ暗い赤 */
.mh-nv-gold { color: var(--hr-bone); text-shadow: 0 0 1px rgba(163,22,31,.85), 0 2px 6px rgba(109,11,18,.8), 1px 0 0 rgba(109,11,18,.55); }
.mh-nv-red { color: #c7323b; text-shadow: 0 0 1px rgba(80,0,6,.9), 0 2px 8px rgba(109,11,18,.85); }
.mh-nv-rule { background: linear-gradient(90deg, transparent, var(--hr-red2), transparent); }
.mh-hr-flick { animation: mh-hr-flick 5s steps(1) infinite; }
@keyframes mh-hr-flick { 0%, 88%, 92%, 100% { opacity: 1; } 89% { opacity: .35; } 90% { opacity: .9; } 91% { opacity: .2; } }
/* 傷んだ紙(しみ)・欠けた縁 */
.mh-hr-stain { background-image: radial-gradient(18% 12% at 22% 30%, rgba(70,20,12,.38), transparent 70%), radial-gradient(10% 7% at 80% 64%, rgba(60,16,10,.42), transparent 70%), radial-gradient(28% 16% at 60% 90%, rgba(20,10,6,.5), transparent 70%); }
.mh-hr-torn { clip-path: polygon(0 3%, 6% 0, 14% 2%, 23% 0, 31% 1.5%, 44% 0, 52% 2%, 63% .5%, 74% 2.5%, 86% 0, 94% 1.5%, 100% 0, 100% 97%, 93% 100%, 81% 98%, 70% 100%, 57% 98.5%, 45% 100%, 33% 98%, 20% 100%, 9% 98.5%, 0 100%); }
.mh-hr-drip { position: absolute; width: 3px; background: linear-gradient(180deg, var(--hr-red), #3a0508); border-radius: 0 0 3px 3px; transform-origin: top; pointer-events: none; animation: mh-hr-drip 5s ease-in infinite; }
@keyframes mh-hr-drip { 0%, 30% { transform: scaleY(.2); } 100% { transform: scaleY(1); } }
/* ゆっくり寄る黒いサンタの影(レイドのボスの絵を黒く塗る。目だけ暗い赤) */
.mh-hr-stalker { position: absolute; pointer-events: none; z-index: 0; }
.mh-hr-stalker img { width: 100%; display: block; opacity: .7; filter: brightness(0) drop-shadow(0 0 2px rgba(130,12,20,.75)) drop-shadow(0 0 18px rgba(90,6,12,.5)); }
.mh-hr-stalker { animation: mh-hr-creep 14s ease-in-out infinite alternate; }
.mh-hr-stalker .eye { position: absolute; top: 34.5%; width: 3.2%; height: 1.4%; border-radius: 50%; background: #7a0d14; box-shadow: 0 0 6px 2px rgba(122,13,20,.55); animation: mh-hr-blink 6s steps(1) infinite; }
@keyframes mh-hr-creep { from { transform: translateX(-10px) scale(.97); } to { transform: translateX(6px) scale(1.03); } }
@keyframes mh-hr-blink { 0%, 93%, 100% { opacity: 1; } 94%, 96% { opacity: 0; } }
/* 上の帯のボタン */
.mh-nv-btn { color: var(--hr-bone); background: rgba(6,4,4,.82); box-shadow: 0 0 0 1px rgba(109,11,18,.75); }
.mh-nv-btn[data-on] { background: var(--hr-red); color: var(--hr-bone); }
.mh-nv-where { color: var(--hr-bone2); }
/* 文字の窓: 墨の黒、上だけ暗い赤の細い線。名札は左に赤い刻み */
.mh-nv-box { border-radius: 4px; background: linear-gradient(180deg, rgba(16,11,10,.95), rgba(4,3,3,.97));
  box-shadow: 0 -1px 0 rgba(109,11,18,.95), inset 0 1px 0 rgba(0,0,0,.6), 0 3px 0 -2px rgba(109,11,18,.35), 0 18px 40px rgba(0,0,0,.75); }
.mh-nv-box::before { content: ''; position: absolute; inset: 0; pointer-events: none; border-radius: inherit; background-image: radial-gradient(18% 30% at 82% 70%, rgba(60,16,10,.28), transparent 70%), radial-gradient(12% 40% at 10% 20%, rgba(40,12,8,.3), transparent 70%); }
.mh-nv-name { border-radius: 2px; background: #120d0b; color: var(--hr-bone); box-shadow: 0 0 0 1px rgba(109,11,18,.9); padding-left: 20px; }
.mh-nv-name::before { content: ''; position: absolute; left: 0; top: 0; bottom: 0; width: 5px; background: var(--hr-red2); }
.mh-nv-name::after { content: ''; position: absolute; left: 7px; top: 100%; width: 3px; height: 16px; background: linear-gradient(180deg, var(--hr-red), #3a0508); border-radius: 0 0 3px 3px; transform-origin: top; animation: mh-hr-drip 5s ease-in infinite; }
.mh-nv-text, .mh-nv-text.say .mh-nv-say-lead.only { color: var(--hr-bone); }
.mh-nv-text.band { color: #c8bfab; }
.mh-nv-text.say .mh-nv-say-lead { color: var(--hr-bone2); }
.mh-nv-se-sound { color: var(--hr-bone); text-shadow: 0 0 1px rgba(163,22,31,.85), 0 2px 8px rgba(109,11,18,.8); }
.mh-nv-se-note { color: var(--hr-bone2); }
.mh-nv-next { border-top-color: var(--hr-red2); animation: mh-nv-bob 1s ease-in-out infinite, mh-hr-flick 2.2s steps(1) infinite; }
.mh-nv-place { border-left-color: var(--hr-red2); color: var(--hr-bone2); }
/* 選ぶ窓(行動・突きつけ・名指し): 墨の板。札は左に赤い線と欠けた縁 */
.mh-nv-sheet { background: rgba(2,1,1,.74); }
.mh-nv-panel { position: relative; background: linear-gradient(180deg, #120d0b, #060404); box-shadow: 0 0 0 1px rgba(109,11,18,.85), 0 -10px 40px rgba(0,0,0,.6); }
.mh-nv-panel > * { position: relative; z-index: 1; }
.mh-nv-choice { border-radius: 3px; color: var(--hr-bone); background: linear-gradient(180deg, #19120f, #0b0807); box-shadow: inset 3px 0 0 var(--hr-red2), 0 0 0 1px rgba(109,11,18,.55), 0 6px 16px rgba(0,0,0,.5); }
.mh-nv-choice[data-pick] { background: linear-gradient(180deg, #2a0d0f, #120506); box-shadow: inset 3px 0 0 var(--hr-red2), 0 0 0 2px var(--hr-red2), inset 0 0 24px rgba(109,11,18,.4); }
.mh-nv-clue { border-radius: 3px; background: rgba(14,9,8,.85); box-shadow: inset 3px 0 0 var(--hr-red), 0 0 0 1px rgba(109,11,18,.45); }
.mh-nv-clue[data-pick] { box-shadow: inset 3px 0 0 var(--hr-red2), 0 0 0 2px var(--hr-red2); }
.mh-nv-person { background: rgba(14,9,8,.8); box-shadow: 0 0 0 1px rgba(109,11,18,.45); }
.mh-nv-person .ph img { filter: saturate(.6) contrast(1.05) brightness(.9) sepia(.12); }
.mh-nv-person[data-pick] { background: rgba(48,8,12,.9); box-shadow: 0 0 0 2px var(--hr-red2), inset 0 0 16px rgba(109,11,18,.45); }
.mh-nv-decide { border-top-color: rgba(109,11,18,.6); }
.mh-nv-decide-what { color: var(--hr-bone); }
.mh-nv-decide .mh-nv-btn:not(:disabled) { background: var(--hr-red); color: var(--hr-bone); box-shadow: 0 0 0 1px var(--hr-red2); }
.mh-nv-q { background: rgba(70,6,12,.4) !important; box-shadow: 0 0 0 1px rgba(163,22,31,.7) !important; }
.mh-nv-qtag { display: inline-block; margin-bottom: 4px; padding: 1px 8px; font-size: 11px; letter-spacing: .3em; color: var(--hr-bone); background: var(--hr-red); }
.mh-nv-get { background: linear-gradient(180deg, #19110e, #080505); box-shadow: 0 0 0 1px var(--hr-red2), 0 14px 34px rgba(0,0,0,.6); }
/* 人物紹介 */
.mh-nv-panelbox { background: radial-gradient(120% 90% at 50% 30%, rgba(20,12,10,.94), rgba(3,2,2,.96)); box-shadow: 0 0 0 1px rgba(109,11,18,.8), 0 18px 40px rgba(0,0,0,.65); }
.mh-nv-panelrule { background: linear-gradient(90deg, transparent, var(--hr-red2), transparent); }
@keyframes mh-nv-cast-glow { 0% { box-shadow: 0 0 0 1px rgba(109,11,18,.45); } 35% { box-shadow: 0 0 0 1px rgba(163,22,31,.95), inset 0 0 14px rgba(109,11,18,.5); } 100% { box-shadow: 0 0 0 1px rgba(109,11,18,.45); } }
/* 章の札・題の札 */
.mh-nv-card { background: radial-gradient(90% 60% at 50% 45%, rgba(24,10,10,.95), rgba(2,1,1,.995)); }
.mh-nv-card.open { background: radial-gradient(90% 60% at 50% 45%, rgba(24,10,10,.95), rgba(2,1,1,.995)); }
.mh-nv-card.open .mh-nv-card-ghost { color: rgba(109,11,18,.16); filter: blur(1px); }
[data-xmas-novel-title] > *:not(.mh-hr-stalker) { position: relative; z-index: 1; }
.mh-nv-sheet-stalker { left: 50%; top: 4%; width: min(80vw, 360px); margin-left: calc(min(80vw, 360px) / -2); }
.mh-nv-card-stalker { right: -70px; bottom: 6%; width: min(62vw, 300px); opacity: .9; }
/* エンドの札: 上から赤が垂れ、斜めの「記録終了」の判 */
.mh-nv-card:has(.mh-nv-gameover) { background: radial-gradient(90% 60% at 50% 40%, rgba(40,4,6,.95), rgba(2,1,1,.995)); }
.mh-nv-card[data-xmas-novel-card="ending"] { background: radial-gradient(90% 60% at 50% 40%, rgba(34,4,6,.95), rgba(2,1,1,.995)); }
.mh-hr-stamp { display: inline-block; margin-bottom: 14px; padding: 4px 14px; border: 3px solid var(--hr-red); color: var(--hr-red2); font-size: 20px; font-weight: 900; letter-spacing: .3em; transform: rotate(-6deg); filter: blur(.3px); animation: mh-hr-stamp .5s cubic-bezier(.2,1.6,.4,1) .2s both; }
@keyframes mh-hr-stamp { from { opacity: 0; transform: rotate(-6deg) scale(1.8); } to { opacity: .92; transform: rotate(-6deg) scale(1); } }
.mh-nv-gameover-title { color: #b8121f; text-shadow: 0 0 1px rgba(60,0,4,.9), 0 3px 10px rgba(109,11,18,.85), 2px 0 rgba(120,0,0,.5); }
.mh-hr-drips { position: absolute; left: 0; right: 0; top: 0; height: 0; pointer-events: none; }
/* 起動画面: 傷んだ事件ファイルの表紙と、番号つきの目次 */
.mh-nv-boot { background: radial-gradient(90% 60% at 50% 30%, #1a1310, #030304 70%); }
.mh-hr-folder { position: relative; padding: 30px 22px 24px; text-align: left; background: linear-gradient(180deg, #1a1410, #0e0b09); box-shadow: 0 0 0 1px rgba(109,11,18,.55), 0 30px 60px rgba(0,0,0,.6), inset 0 0 60px rgba(0,0,0,.5); }
.mh-hr-tab { display: inline-block; margin-bottom: -1px; padding: 4px 12px; font-size: 11px; letter-spacing: .3em; color: var(--hr-bone2); background: #18120f; box-shadow: 0 0 0 1px rgba(109,11,18,.55); }
.mh-hr-seal { position: absolute; right: 14px; bottom: 12px; width: 64px; height: 64px; border: 3px solid var(--hr-red); border-radius: 50%; display: grid; place-items: center; color: var(--hr-red2); font-size: 15px; font-weight: 900; letter-spacing: .1em; transform: rotate(-12deg); opacity: .85; filter: blur(.3px); }
.mh-nv-boot .mh-nv-boot-series { color: var(--hr-bone); text-shadow: 0 0 1px rgba(163,22,31,.85), 0 2px 6px rgba(109,11,18,.8), 1px 0 0 rgba(109,11,18,.55); letter-spacing: .04em; }
.mh-nv-boot .mh-nv-boot-title { color: var(--hr-bone2); }
.mh-nv-boot .mh-nv-boot-sub { color: var(--hr-bone); text-shadow: 0 2px 6px rgba(109,11,18,.7); letter-spacing: .12em; }
.mh-nv-boot .mh-nv-rule { margin-left: 0; background: linear-gradient(90deg, var(--hr-red2), transparent); }
.mh-nv-boot-btn { justify-content: flex-start; gap: 12px; border-radius: 2px; color: var(--hr-bone); background: transparent; box-shadow: none; border-bottom: 1px solid rgba(109,11,18,.45); }
.mh-nv-boot-btn .no { width: 18px; color: var(--hr-red2); font-size: 13px; }
.mh-nv-boot-btn .lead { flex: 1; align-self: center; border-bottom: 1px dotted rgba(165,156,135,.35); }
.mh-nv-boot-btn .cnt { font-size: 12px; color: var(--hr-bone2); }
.mh-nv-boot-btn:disabled { opacity: .45; }
.mh-nv-boot-press { color: var(--hr-bone2); }
.mh-hr-scratch { position: absolute; height: 1px; pointer-events: none; background: linear-gradient(90deg, transparent, rgba(226,217,196,.22), transparent); }
.mh-nv-boot-stalker { left: 38%; top: 30%; width: min(90vw, 420px); }
@media (orientation: landscape) and (max-height: 560px) {
  .mh-hr-folder { padding: 14px 16px 14px; }
  .mh-hr-seal { width: 48px; height: 48px; font-size: 12px; }
  .mh-nv-boot-stalker { left: 55%; top: 5%; width: min(50vw, 330px); }
}
@media (orientation: landscape) and (max-height: 420px) {
  .mh-hr-tab { display: none; }
  .mh-hr-folder { padding: 8px 14px 8px; }
  .mh-hr-seal { width: 40px; height: 40px; font-size: 11px; right: 10px; bottom: 8px; }
  .mh-nv-boot .mh-nv-boot-press { display: none; }
  .mh-nv-card-stalker { width: min(32vw, 220px); }
}
@media (prefers-reduced-motion: reduce) {
  .mh-nv::before, .mh-nv-stage::after, .mh-hr-flick, .mh-hr-drip, .mh-hr-stalker, .mh-hr-stalker .eye, .mh-nv-name::after, .mh-hr-stamp { animation: none !important; }
  .mh-nv-next { animation: none !important; }
}
`;
const useXmasNovelCss = () => {
  useEffect(() => {
    if (typeof document === 'undefined' || document.getElementById('mh-xmas-novel-css')) return;
    const tag = document.createElement('style');
    tag.id = 'mh-xmas-novel-css';
    tag.textContent = XMAS_NOVEL_CSS;
    document.head.appendChild(tag);
  }, []);
};

// ---- 背景 ----
//  台本の「背景: ◯◯」の名前から。今ある絵の名前(monhero_plaza など)は images/story-bg の絵。
//  ペンションの中・雪山は、チャッピーで作った16枚(r1126-035・元の絵は tools/art-sources/promo/xmas-2026/received/novel-bg/)。
//  朝・夜・ろうそく・停電は、絵の上に色と暗さをかぶせて出し分ける(tint)。上から順に、名前に当たった最初の行を使う
const XMAS_NOVEL_BG_IMG = Object.freeze({
  hall_day: 'images/story-bg/xmas_hall_day.jpg', hall_night: 'images/story-bg/xmas_hall_night.jpg',
  backdoor: 'images/story-bg/xmas_backdoor.jpg', attic: 'images/story-bg/xmas_attic.jpg',
  attic_party: 'images/story-bg/xmas_attic_party.jpg', dining: 'images/story-bg/xmas_dining.jpg',
  kitchen: 'images/story-bg/xmas_kitchen.jpg', locked_room: 'images/story-bg/xmas_locked_room.jpg',
  mirror_hall: 'images/story-bg/xmas_mirror_hall.jpg', snowfield_cliff: 'images/story-bg/xmas_snowfield_cliff.jpg',
  secret_passage: 'images/story-bg/xmas_secret_passage.jpg', mountain_road: 'images/story-bg/xmas_mountain_road.jpg',
  study: 'images/story-bg/xmas_study.jpg', stairs_candle: 'images/story-bg/xmas_stairs_candle.jpg',
  guest_room: 'images/story-bg/xmas_guest_room.jpg', corridor_2f: 'images/story-bg/xmas_corridor_2f.jpg',
});
//  かぶせる色。morning=朝の白い光 / night=昼の絵を夜にする / candle=ろうそくの灯りだけ / storm=吹雪の青 / blackout=停電(ほぼ真っ暗)
const XMAS_NOVEL_TINT = Object.freeze({
  morning: 'linear-gradient(180deg, rgba(214,230,255,.30) 0%, rgba(255,244,228,.14) 55%, rgba(255,244,228,0) 100%)',
  night: 'linear-gradient(180deg, rgba(6,12,38,.62) 0%, rgba(8,12,34,.5) 100%)',
  candle: 'radial-gradient(60% 55% at 50% 45%, rgba(255,170,70,.16) 0%, rgba(20,10,4,.35) 55%, rgba(4,2,1,.7) 100%)',
  storm: 'linear-gradient(180deg, rgba(40,70,130,.28) 0%, rgba(10,20,50,.18) 100%)',
  blackout: 'radial-gradient(45% 35% at 50% 40%, rgba(2,4,12,.8) 0%, rgba(0,0,0,.94) 70%)',
  // 12年前(過去編・r1126-046): 古い写真の色。ふちを暗くして、色あせた茶色をかぶせる
  past: 'radial-gradient(80% 70% at 50% 45%, rgba(120,84,40,.18) 0%, rgba(70,44,18,.38) 70%, rgba(30,18,6,.72) 100%)',
});
const XMAS_NOVEL_BG = Object.freeze([
  { re: /停電|まっくら|真っ暗|暗転/, img: 'hall_night', tint: 'blackout' },
  { re: /山道|外観/, img: 'mountain_road', snow: true },
  { re: /薪小屋/, img: 'secret_passage' }, // 薪小屋の絵は無いので、板壁の暗い小部屋(通り道の絵)で出す(r1126-065 追記2)
  { re: /雪原|雪の庭|庭|森|足あと|崖/, img: 'snowfield_cliff', snow: true },
  { re: /屋根裏の会場|会場/, img: 'attic_party' },
  { re: /屋根裏|暗がり/, img: 'attic' },
  { re: /通り道|壁の中|はしご/, img: 'secret_passage' },
  { re: /鏡/, img: 'mirror_hall', pos: '58% center' },
  { re: /開かずの部屋/, img: 'locked_room' },
  { re: /2階の廊下|二階の廊下|廊下/, img: 'corridor_2f' },
  { re: /裏口/, img: 'backdoor' },
  { re: /台所/, img: 'kitchen' },
  { re: /食堂/, img: 'dining', day: true },
  { re: /書斎/, img: 'study' },
  { re: /階段/, img: 'stairs_candle' },
  { re: /客室|部屋/, img: 'guest_room', day: true },
  { re: /夜のホール|ホール.*(夜|ろうそく|停電)|暖炉/, img: 'hall_night' },
  { re: /ホール|柱時計|時計/, img: 'hall_day' },
]);
const XMAS_NOVEL_BG_DEFAULT = { grad: 'radial-gradient(120% 80% at 50% 0%, #17305f 0%, #0b1733 50%, #050a1a 100%)', snow: true };
//  時間の言葉 → かぶせる色。昼の絵(day)だけ夜で暗くする(夜の絵にはかぶせない)
const xmasNovelTintOf = (n, b) => {
  if (/12年前/.test(n)) return 'past';
  if (b.tint) return b.tint;
  if (/ろうそく/.test(n) && b.img !== 'hall_night') return 'candle';
  if (/夜/.test(n) && b.day) return 'night';
  if (/朝/.test(n)) return 'morning';
  if (/吹雪/.test(n)) return 'storm';
  return '';
};
const xmasNovelBgOf = (name) => {
  const n = String(name || '').split('→')[0]; // 「A→B」は A から始める(B へ変わる行は XMAS_NOVEL_BG_SHIFT)
  // 「monhero_plaza(画面のわくの中)」のように、絵の名前のうしろに説明が付く物も、頭の絵の名前で出す(無地になっていた・2026-11-26 窓口)
  const raw = n.match(/^([a-z0-9_]+)(?=$|[(（])/);
  if (raw) return { img: `images/story-bg/${raw[1]}.jpg` };
  // 外側の場面「ゲーム機をかこむ助手たち」は、台本の最初の外側の場面(monhero_plaza_evening)と同じ広場で出す。夜は夜の広場
  if (/ゲーム機をかこむ/.test(n)) return { img: `images/story-bg/${/夜/.test(n) ? 'monhero_night' : 'monhero_plaza_evening'}.jpg` };
  const b = XMAS_NOVEL_BG.find((x) => x.re.test(n));
  if (!b) return XMAS_NOVEL_BG_DEFAULT;
  const tint = xmasNovelTintOf(n, b);
  return { img: XMAS_NOVEL_BG_IMG[b.img], key: b.img, pos: b.pos, tint: tint ? XMAS_NOVEL_TINT[tint] : '', tintKind: tint, snow: !!(b.snow || /吹雪/.test(n)) };
};
//  1つの場面の途中で背景が変わる所(台本の「A→B」)。場面ID → [その行から先, 背景の名前]
const XMAS_NOVEL_BG_SHIFT = Object.freeze({
  'C10-3': [['10-3-4', 'ペンションのホール(朝)'], ['10-3-7', '朝の雪原(裏口の外)'], ['10-3-12', 'ペンションのホール(朝)']],
  // 亡くなっているのが見つかる行は、文の場所の絵にする(r1126-065 追記2・社長「倒れてる位置が絵とあってない」)
  'C5-4': [['5-4-5', '鏡の裏の通り道']],
  'C10-2': [['10-2-7', '朝の通り道(はしごの下)']],
  'C2-X': [['2-X-6a', '夜の裏口(ろうそく)']],
  'C6-X': [['6-X-10a', '明け方の雪原(裏口の外・吹雪)']],
  'C2-Y': [['2-Y-10', '裏の階段(夜)'], ['2-Y-11', '夜のホール'], ['2-Y-13a', '裏の階段の下']],
  'END-M2': [['M2-2', '朝の暖炉の前'], ['M2-3', '朝の雪原'], ['M2-4', '朝の薪小屋の中']],
  'END-G': [['G-10', '屋根裏の会場']],
  // r1126-108 第2弾の強制バッド: 影を追ってホールへ・明け方の雪原・開かずの部屋の中
  'C1-X': [['1-X-4', '夜のホール'], ['1-X-7', 'ペンションのホール(柱時計)']],
  'C3-X': [['3-X-6', '朝の雪原(崖)']],
  'C4-X': [['4-X-3', '開かずの部屋']],
});
const xmasNovelSceneBgName = (scene, idx) => {
  if (!scene) return '';
  const shifts = XMAS_NOVEL_BG_SHIFT[scene.id];
  let name = scene.bg || '';
  if (!shifts || !Array.isArray(scene.rows)) return name;
  const at = Number.isFinite(idx) ? idx : 0;
  shifts.forEach(([rowId, bg]) => {
    const i = scene.rows.findIndex((r) => r && r.id === rowId);
    if (i >= 0 && at >= i) name = bg;
  });
  return name;
};

// ---- 場面の切り替えの演出(台帳 r1126-094) ----
//  背景の名前の移り変わりから、どの切り替えかを決める(純粋な計算。検査からも呼ぶ)
//  '' = 出さない / 'open' = 読み始め / 'past' = 過去編(12年前)へ入る / 'time' = 時間が飛ぶ・過去編から戻る / 'place' = 場所が替わる
const xmasNovelTimeOf = (n) => (/12年前/.test(n) ? 'past' : /明け方|朝/.test(n) ? 'morning' : /夜|ろうそく|停電|暗転/.test(n) ? 'night' : 'day');
const xmasNovelSwitchKind = (prevName, nextName) => {
  const a = String(prevName || '').split('→')[0];
  const b = String(nextName || '').split('→')[0];
  const tb = xmasNovelTimeOf(b);
  if (prevName == null) return tb === 'past' ? 'past' : 'open';
  if (a === b) return '';
  const ta = xmasNovelTimeOf(a);
  if (tb === 'past' && ta !== 'past') return 'past';
  if (ta !== tb) return 'time';
  const ia = xmasNovelBgOf(a);
  const ib = xmasNovelBgOf(b);
  if ((ia.img || ia.grad) === (ib.img || ib.grad) && (ia.tint || '') === (ib.tint || '')) return '';
  return 'place';
};
//  場所の札に出す名前(「夜の裏口(吹雪」→「夜の裏口　吹雪」)。外側の広場など、絵の名前そのままの物は出さない
const xmasNovelPlaceLabel = (name) => {
  const n = String(name || '').split('→')[0].trim();
  if (!n || /^[a-z0-9_]+(?=$|[(（])/.test(n) || /ゲーム機をかこむ/.test(n)) return '';
  const m = n.match(/^([^(（]+)(?:[(（]([^)）]*)[)）]?)?/);
  if (!m) return n;
  const base = m[1].trim();
  const inner = (m[2] || '').trim();
  return inner ? `${base}　${inner}` : base;
};

//  人ごとに、台本でいちばん初めに話す行(名札と「影から浮かぶ」はこの行だけ。つづきから読んでも、もう出た人には出さない)
const XMAS_NOVEL_FIRST_LINE_CACHE = new WeakMap();
const xmasNovelFirstLines = (script) => {
  if (!script || typeof script !== 'object') return {};
  if (XMAS_NOVEL_FIRST_LINE_CACHE.has(script)) return XMAS_NOVEL_FIRST_LINE_CACHE.get(script);
  const out = {};
  (Array.isArray(script.scenes) ? script.scenes : []).forEach((s) => (Array.isArray(s.rows) ? s.rows : []).forEach((r) => {
    if (r && r.t === 'line' && r.w && r.n !== '？？？' && !out[r.w]) out[r.w] = r.id;
  }));
  XMAS_NOVEL_FIRST_LINE_CACHE.set(script, out);
  return out;
};

// ---- 先の展開が分かる題を伏せる(台帳 r1126-094 追記3・社長「ところどころのタイトルで展開が見えるから出し方かえたほうがいい」) ----
//  場面の題: その場面を1度読み終えるまでは出さない(上の帯は章だけ。場所は場所の札で分かる)
//  章の題: 先が分かる章(遺体が見つかる・最初の推理がはずれる・人が減っていく)は、その先の章を読むまで別の題で出す
const XMAS_NOVEL_CHAPTER_VEIL = Object.freeze({ C3: '白い朝', C8: 'ひとつずつ', C10: '長い夜' });
const XMAS_NOVEL_CH_KEYS_CACHE = new WeakMap();
const xmasNovelChapterDone = (script, ch, read) => {
  if (!script || !ch) return false;
  let keys = XMAS_NOVEL_CH_KEYS_CACHE.get(script);
  if (!keys) {
    keys = {};
    (Array.isArray(script.scenes) ? script.scenes : []).forEach((s) => { (keys[s.chapter] = keys[s.chapter] || []).push(...(Array.isArray(s.rows) ? s.rows : []).map((r) => r && r.k).filter(Boolean)); });
    XMAS_NOVEL_CH_KEYS_CACHE.set(script, keys);
  }
  const set = read instanceof Set ? read : new Set(Array.isArray(read) ? read : []);
  return (Array.isArray(script.chapters) ? script.chapters : []).some((c) => c && !c.past && !c.outside && c.no > ch.no && c.no < 90 && (keys[c.id] || []).some((k) => set.has(k)));
};
const xmasNovelChapterTitle = (script, ch, read) => {
  if (!ch) return '';
  const veil = XMAS_NOVEL_CHAPTER_VEIL[ch.id];
  return veil && !xmasNovelChapterDone(script, ch, read) ? veil : (ch.title || '');
};
const xmasNovelSceneDone = (scene, read) => {
  const rows = scene && Array.isArray(scene.rows) ? scene.rows : [];
  const last = [...rows].reverse().find((r) => r && r.k);
  return !!(last && Array.isArray(read) && read.includes(last.k));
};
// ---- 場面ごとの揺れ(台帳 r1126-094 追記3・社長「場面場面の振動とかそういうのちゃんとして」) ----
//  行ID → 強さ(1 小さく / 2 ふつう / 3 強く)。音の帯は音と同時、遺体を見つける行は暗転が明けるときに 1。
//  端末の振動は、navigator.vibrate がある端末(Android)だけ短く。iPhone は画面の揺れと音で伝える。動きを減らす設定の端末では、どちらも出さない
const XMAS_NOVEL_SHAKE = Object.freeze({
  '1-3-1': 2, '2-1-10': 1, '2-3-4': 1, '2-3-7': 1, '2-3-9b': 1, '2-3-9c': 2, '2-5-1': 2, '5-4-4': 1, '6-5-1': 3, '6-7-4b': 2,
  '7-P1-13': 1, '7-P3-11': 1, '7-P3-12': 1, '7-W-8': 1, '9-1-4': 1, '10-2-6': 2,
  '2-X-2': 3, '5-X-3': 3, '6-X-4': 3, '6-X-5': 2, '6-X-8': 2, '2-Y-9': 3, '2-Y-17': 1, '10-X-8': 3,
  'B-2': 1, 'B-3': 1, 'B-4': 2, 'B-13': 2, '1-O-22': 1, '12-3-2': 1, '12-4-2': 1, '12-4-5': 1,
});
const XMAS_NOVEL_SHAKE_PX = [0, 2.5, 5, 9];
const XMAS_NOVEL_BUZZ = [0, 20, 45, [70, 40, 90]];
const xmasNovelQuake = (el, lv) => {
  const a = XMAS_NOVEL_SHAKE_PX[lv] || 0;
  if (!a) return;
  try { if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return; } catch (e) { /* 分からなければ揺らす */ }
  if (el && typeof el.animate === 'function') {
    try {
      el.animate([{ transform: 'none' }, { transform: `translate(${-a}px, ${a / 2}px)` }, { transform: `translate(${a}px, ${-a / 3}px)` }, { transform: `translate(${-a * 0.6}px, ${a / 3}px)` },
        { transform: `translate(${a * 0.35}px, 0)` }, { transform: 'none' }], { duration: 240 + lv * 100, easing: 'ease-out' });
    } catch (e) { /* 揺れなくても続ける */ }
  }
  try { if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') navigator.vibrate(XMAS_NOVEL_BUZZ[lv]); } catch (e) { /* ふるえなくても続ける */ }
};

// ---- 立ち絵 ----
//  助手はサンタのきせかえの立ち絵(stand-santa。ドラは顔の絵なので santa の顔)。イチーカ・もちまるは絵が1枚。謎の客2人・？？？は影
const XMAS_NOVEL_FACES = Object.freeze(['normal', 'happy', 'wink', 'surprise', 'troubled', 'angry', 'crying', 'excited']);
const xmasNovelFigureSrc = (who, e) => {
  const c = xmasNovelCastOf(who);
  if (!c) return null;
  // 眠った顔(sleep)はドラの顔の絵だけにある(santa/dra_sleep.PNG・r1126-077 眠りのドラ)。ほかの人は normal に戻す
  const face = XMAS_NOVEL_FACES.includes(e) || (who === 'dra' && e === 'sleep') ? e : 'normal';
  if (c.kind === 'assistant') {
    const dir = typeof STORY_OUTFIT_DIRS !== 'undefined' && STORY_OUTFIT_DIRS && STORY_OUTFIT_DIRS.santa ? STORY_OUTFIT_DIRS.santa : '';
    if (!dir) return null;
    if (who === 'dra') return { src: typeof assistantArtFile === 'function' ? assistantArtFile(`${dir}/dra_${face}.PNG`) : `${dir}/dra_${face}.PNG`, face: true };
    const art = (p) => (typeof assistantArtFile === 'function' ? assistantArtFile(p) : p); // 重い絵は WebP(r1126-095)
    return { src: art(`${dir.replace(/\/santa$/, '/stand-santa')}/${who}_${face}.png`), fallback: art(`${dir}/${who}_${face}.PNG`) };
  }
  if (c.kind === 'monster' || c.kind === 'guest') return { src: c.art };
  return null;
};
const XmasNovelShadow = ({ tone = '#2a3350', label = '', hat = false }) => (
  <svg viewBox="0 0 200 300" style={{ height: '92%', maxWidth: '100%' }} aria-label={label}>
    <defs>
      <radialGradient id="mh-nv-shadow-g" cx="50%" cy="30%" r="70%"><stop offset="0%" stopColor={tone} /><stop offset="100%" stopColor="#05070e" /></radialGradient>
    </defs>
    <circle cx="100" cy="78" r="44" fill="url(#mh-nv-shadow-g)" stroke="rgba(232,196,106,.35)" strokeWidth="1.5" />
    {hat && <><path d="M54 66 C70 18 120 6 150 40 L146 52 C130 40 116 44 108 58 Z" fill="#05070e" stroke="rgba(200,40,40,.55)" strokeWidth="1.5" /><circle cx="152" cy="44" r="9" fill="#05070e" stroke="rgba(200,40,40,.55)" strokeWidth="1.5" /></>}
    <path d="M20 300 C24 200 60 140 100 136 C140 140 176 200 180 300 Z" fill="url(#mh-nv-shadow-g)" stroke="rgba(232,196,106,.35)" strokeWidth="1.5" />
  </svg>
);
const XmasNovelLaptop = () => (
  <svg viewBox="0 0 240 170" style={{ width: 'min(54vw, 260px)', marginBottom: '22%' }} aria-label="ワトソンくん">
    <rect x="30" y="10" width="180" height="118" rx="8" fill="#0b1430" stroke="#e8c46a" strokeWidth="2" />
    <rect x="40" y="20" width="160" height="98" rx="4" fill="#123a5c" />
    <text x="120" y="66" textAnchor="middle" fontSize="20" fill="#9ee7ff" fontWeight="700">W</text>
    <rect x="70" y="80" width="100" height="4" rx="2" fill="#9ee7ff" opacity=".6"><animate attributeName="opacity" values=".2;.8;.2" dur="1.6s" repeatCount="indefinite" /></rect>
    <path d="M8 140 L232 140 L218 158 L22 158 Z" fill="#1b2a52" stroke="#e8c46a" strokeWidth="2" />
  </svg>
);
// シルエットの笑い(名前を伏せた声で「ふふ」「あはは」)。笑い声は audio/se-xmas-novel-laugh.mp3(XMAS_NOVEL_LAUGH_SE)で鳴らす
const xmasNovelIsSilhouette = (row) => !!(row && /黒いサンタのシルエット|黒いサンタの影/.test(row.x || ''));
const xmasNovelIsLaugh = (row) => !!(row && /ふふ|あはは|ははは/.test(row.x || ''));
// ---- 立ち絵の見せ方(r1126-067) ----
//  寄り(close): 胸から上を大きく / ふだん(normal): 頭から腰 / 引き(far): 全身を小さめ。台本の〔立ち:寄り〕〔立ち:引き〕の印(行 f > 場面 frame > ふだん)。
//  絵ごとに描かれている範囲が違う(助手は頭〜太もも、謎の客2人とモンスターは全身)ので、絵の上から何割の所に胸・腰があるか(chest・waist)と、
//  左右の透明な余白を除いた絵の範囲(l・r)を持つ。文字の箱の上の縁(名札の上)で絵を切って下をぼかすので、箱の裏に体が透けず、名札も手や顔にかからない。
//  横長の画面で箱が右に寄り重ならないときは、画面の下の縁で切る。絵の縦横の比率は変えない
const XMAS_NOVEL_FRAMES = Object.freeze(['close', 'normal', 'far']);
const XMAS_NOVEL_MARKS = Object.freeze({
  atsu: { chest: 0.62, waist: 0.9, l: 0.15, r: 0.76 },
  myua: { chest: 0.6, waist: 0.82, l: 0.03, r: 0.97 },
  sorashido: { chest: 0.6, waist: 0.86, l: 0.01, r: 0.84 },
  kiki: { chest: 0.6, waist: 0.81, l: 0.01, r: 0.93 },
  momosuke: { chest: 0.62, waist: 0.76, l: 0.12, r: 0.93 },
  kyuko: { chest: 0.6, waist: 0.77, l: 0.28, r: 0.9 },
  erubin: { chest: 0.65, waist: 0.94, l: 0.09, r: 0.76 },
  kuroba: { chest: 0.22, waist: 0.42, l: 0.04, r: 0.96 }, // 謎の客2人は全身の絵(r1126-076。胸から上の *_stand.png は事件簿では使わない)
  shirase: { chest: 0.24, waist: 0.38, l: 0.03, r: 0.97 },
  ichika: { chest: 0.42, waist: 0.66, l: 0.32, r: 0.68 },
  mochimaru: { chest: 0.5, waist: 0.75, l: 0.18, r: 0.82 },
  dra: { chest: 1, waist: 1, l: 0.1, r: 0.9 },
  shadow: { chest: 0.58, waist: 0.82, l: 0.1, r: 0.9 },
  boss: { chest: 0.5, waist: 0.72, l: 0.05, r: 0.95 },
  watson: { chest: 1, waist: 1, l: 0.05, r: 0.95 },
});
// 見せ方ごとの「切れ目(絵の上から何割)」・見える高さ(箱の上の空きに対する割合)・絵の幅の上限(置き場の幅に対する割合)
const XMAS_NOVEL_FRAME_FIT = Object.freeze({
  close: { cut: 'chest', vis: 0.84, maxW: 1.12 },
  normal: { cut: 'waist', vis: 0.74, maxW: 0.94 },
  far: { cut: 'all', vis: 0.6, maxW: 0.66 },
});
const xmasNovelFrameOf = (row, scene) => {
  const f = (row && row.f) || (scene && scene.frame) || 'normal';
  return XMAS_NOVEL_FRAMES.includes(f) ? f : 'normal';
};
// 置き場(.mh-nv-fig)の大きさと文字の箱から、絵の大きさと位置を決める(純粋な計算。検査からも呼ぶ)
//   stageW/H: 置き場の幅・画面の高さ / top: 上のボタン列の下 / cutY: 絵を切る高さ / ar: 絵の 幅÷高さ
const xmasNovelPlaceFig = ({ stageW, top, cutY, ar, mark, frame }) => {
  const fit = XMAS_NOVEL_FRAME_FIT[frame] || XMAS_NOVEL_FRAME_FIT.normal;
  const m = mark || XMAS_NOVEL_MARKS.shadow;
  const cutF = fit.cut === 'all' ? 1 : Math.min(1, Math.max(0.2, m[fit.cut]));
  const avail = Math.max(60, cutY - top);
  const span = Math.max(0.2, (m.r - m.l)); // 透明な余白を除いた絵の幅(絵の幅に対する割合)
  let h = (avail * fit.vis) / cutF;
  const maxH = (stageW * fit.maxW) / (ar * span);
  if (h > maxH) h = maxH;
  if (h * cutF > avail) h = avail / cutF; // 頭が上のボタン列にかからない
  const w = h * ar;
  const left = stageW / 2 - w * ((m.l + m.r) / 2); // 描かれている所の真ん中を置き場の真ん中に
  return { w: Math.round(w), h: Math.round(h), left: Math.round(left), top: Math.round(cutY - h * cutF) };
};
const useXmasNovelPlace = (who, frame, artKey) => {
  const ref = useRef(null);
  useEffect(() => {
    const fig = ref.current;
    if (!fig) return undefined;
    let raf = 0;
    const fit = () => {
      raf = 0;
      const art = fig.firstElementChild;
      const stage = fig.parentElement;
      if (!art || !stage) return;
      let ar = 0;
      if (art.tagName === 'IMG') { if (!art.naturalWidth || !art.naturalHeight) return; ar = art.naturalWidth / art.naturalHeight; }
      else {
        const vb = art.tagName === 'svg' && art.viewBox && art.viewBox.baseVal;
        ar = vb && vb.width && vb.height ? vb.width / vb.height : (art.classList.contains('mh-nv-boss') ? 985 / 1347 : 0.7);
      }
      const s = stage.getBoundingClientRect();
      const f = fig.getBoundingClientRect();
      const box = document.querySelector('[data-xmas-novel-box]');
      const bar = document.querySelector('.mh-nv-top');
      const b = box ? box.getBoundingClientRect() : null;
      const overlapX = b && b.height ? Math.min(f.right, b.right) - Math.max(f.left, b.left) > f.width * 0.3 : false;
      // 名札は箱の上の縁から 15px はみ出るので、その上で切る
      const cutY = overlapX ? b.top - s.top - 20 : s.height;
      const top = bar ? bar.getBoundingClientRect().bottom - s.top + 8 : 56;
      const p = xmasNovelPlaceFig({ stageW: f.width, top, cutY, ar, mark: XMAS_NOVEL_MARKS[who], frame });
      fig.style.height = `${Math.max(0, Math.round(cutY))}px`;
      Object.assign(art.style, { position: 'absolute', left: `${p.left}px`, top: `${p.top}px`, width: `${p.w}px`, height: `${p.h}px`, maxWidth: 'none', maxHeight: 'none', margin: '0' });
      fig.setAttribute('data-placed', '');
      fig.setAttribute('data-xmas-novel-frame', frame);
    };
    const later = () => { if (!raf) raf = requestAnimationFrame(fit); };
    later();
    const art = fig.firstElementChild;
    if (art && art.tagName === 'IMG') art.addEventListener('load', later);
    const box = document.querySelector('[data-xmas-novel-box]');
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(later) : null;
    if (ro) { if (box) ro.observe(box); if (fig.parentElement) ro.observe(fig.parentElement); }
    window.addEventListener('resize', later);
    return () => {
      if (raf) cancelAnimationFrame(raf);
      if (art && art.tagName === 'IMG') art.removeEventListener('load', later);
      if (ro) ro.disconnect();
      window.removeEventListener('resize', later);
    };
  }, [who, frame, artKey]);
  return ref;
};
const XmasNovelFigure = (props) => {
  const { row } = props;
  const who = !row ? '' : (row.t === 'band' ? 'boss' : (row.n === '？？？' ? 'boss' : (row.w || '')));
  return <XmasNovelFigureArt {...props} who={who} frame={xmasNovelFrameOf(row, props.scene)} key={`${who}-${(row && row.e) || ''}`} />;
};
//  初めて出る人の名札。肩書きは台本で本人や周りが名乗る物だけ(助手たちは名前だけ)。名前は名札と同じ呼び名(フルネームは本人が名乗るまで出さない)
const XMAS_NOVEL_INTRO_ROLE = Object.freeze({ ichika: 'ペンションのオーナー', mochimaru: 'ペンションの世話役', kuroba: '招かれざる客', shirase: '招かれざる客' });
const XmasNovelIntro = ({ c, fast }) => (c ? (
  <div className={`mh-nv-intro mh-nv-serif${fast ? ' fast' : ''}`} data-xmas-novel-intro={c.id}>
    {XMAS_NOVEL_INTRO_ROLE[c.id] && <span className="role">{XMAS_NOVEL_INTRO_ROLE[c.id]}</span>}
    <span className="nm">{c.name}</span>
    <span className="bar" />
  </div>
) : null);
const XmasNovelFigureArt = ({ row, dim = false, who = '', frame = 'normal', enter = null }) => {
  const [broken, setBroken] = useState(0);
  const ek = enter && enter.kind ? ` enter-${enter.kind}${enter.fast ? ' fast' : ''}` : '';
  const ref = useXmasNovelPlace(who, frame, `${row ? row.id : ''}-${broken}`);
  if (row && row.t === 'band' && xmasNovelIsSilhouette(row)) return <div ref={ref} className={`mh-nv-fig${dim ? ' dim' : ''}`} key={`band-${row.id}`}><XmasNovelBossShadow /></div>;
  if (!row || row.t !== 'line') return null;
  const key = `${row.w || row.n}-${row.e || ''}`;
  const laugh = row.n === '？？？' && xmasNovelIsLaugh(row);
  if (row.n === '？？？' || !row.w) return row.n === '？？？' ? <div ref={ref} className={`mh-nv-fig${dim ? ' dim' : ''}${laugh ? ' laugh' : ''}`} key={key}><XmasNovelBossShadow />{/* 名前を伏せた話し手は、いつも黒いサンタの影(丸い頭の影はやめた・台帳 r1126-094 追記2) */}</div> : null;
  if (row.w === 'watson') return <div ref={ref} className="mh-nv-fig" key={key}><XmasNovelLaptop /></div>;
  const c = xmasNovelCastOf(row.w);
  const fig = xmasNovelFigureSrc(row.w, row.e);
  const intro = enter && enter.kind === 'first' && enter.intro ? <XmasNovelIntro c={c} fast={enter.fast} /> : null;
  if (!fig || broken >= 2) return <div ref={ref} className={`mh-nv-fig${dim ? ' dim' : ''}`} key={key}><XmasNovelShadow tone={(c && c.tone) || '#2a3350'} label={c ? c.name : ''} />{intro}</div>;
  const src = broken === 1 && fig.fallback ? fig.fallback : fig.src;
  return (
    <div ref={ref} className={`mh-nv-fig${fig.face ? ' face' : ''}${dim ? ' dim' : ''}${ek}`} key={key} data-xmas-novel-enter={enter && enter.kind ? enter.kind : undefined}>
      <img src={src} alt={c ? c.name : ''} draggable={false} onError={() => setBroken((b) => (b === 0 && fig.fallback ? 1 : 2))} />
      {intro}
    </div>
  );
};
const xmasNovelFaceOf = (id) => {
  const c = xmasNovelCastOf(id);
  if (!c) return '';
  if (c.kind === 'assistant') {
    const dir = typeof STORY_OUTFIT_DIRS !== 'undefined' && STORY_OUTFIT_DIRS && STORY_OUTFIT_DIRS.santa ? STORY_OUTFIT_DIRS.santa : '';
    return dir ? `${dir}/face/${id}_normal.PNG` : '';
  }
  return c.face || '';
};

// ---- 人の並び(パネル・人を選ぶ問い) ----
// 倒れた影(死ぬ場面。死体の絵は使わず、人型の影が横たわる)
const XmasNovelFallen = () => (
  <svg className="mh-nv-fallen" viewBox="0 0 300 80" aria-label="倒れた影" data-xmas-novel-fallen>
    <defs><radialGradient id="mh-nv-fallen-g" cx="50%" cy="60%" r="60%"><stop offset="0%" stopColor="rgba(0,0,0,.95)" /><stop offset="100%" stopColor="rgba(0,0,0,.55)" /></radialGradient></defs>
    <ellipse cx="150" cy="66" rx="140" ry="12" fill="rgba(0,0,0,.45)" />
    <circle cx="42" cy="46" r="17" fill="url(#mh-nv-fallen-g)" />
    <path d="M60 40 C90 30 160 30 200 38 L262 44 C274 46 274 56 262 58 L200 60 C160 66 92 66 60 56 Z" fill="url(#mh-nv-fallen-g)" />
    <path d="M110 58 C120 70 150 72 165 66" stroke="rgba(0,0,0,.8)" strokeWidth="9" fill="none" strokeLinecap="round" />
  </svg>
);
// 亡くなっているのが見つかる行(台本の〔遺体:黒羽〕・r1126-065)。その人の絵を真っ黒の影にして横に倒し、床に血だまりが広がる。
//   色を持つのは血だけ(手本の作品の見せ方・r1126-065 追記1)。背景は暗く冷たくし、床の近くだけ赤くさす。新しい絵は作らない。
//   助手はサンタのきせかえの全身の絵、謎の客2人・もちまるはいまの画面の絵。lead / partner は A1 で選んだ方 / 選ばなかった方
let xmasNovelBodyLast = { k: '', at: -9 };
const xmasNovelBodyWho = (body, flags) => {
  const lead = flags && flags.f_A1 === 2 ? 'sorashido' : 'atsu';
  if (body === 'lead') return lead;
  if (body === 'partner') return lead === 'atsu' ? 'sorashido' : 'atsu';
  return body || '';
};
const xmasNovelBodySrc = (who) => {
  const c = xmasNovelCastOf(who);
  if (!c) return '';
  if (c.kind === 'assistant') {
    const dir = typeof STORY_OUTFIT_DIRS !== 'undefined' && STORY_OUTFIT_DIRS && STORY_OUTFIT_DIRS.santa ? STORY_OUTFIT_DIRS.santa : '';
    return dir ? (typeof assistantArtFile === 'function' ? assistantArtFile(`${dir}/${who}_normal.PNG`) : `${dir}/${who}_normal.PNG`) : '';
  }
  return c.art || '';
};
// 背景の絵ごとの床(r1126-065 追記2・社長「倒れてる位置が絵とあってない」)。絵(1536×1024)の中の割合で、
//   x = 倒れている所の左右の中ほど / y = 床・地面の線(体の下がここに来る) / s = 大きさ(奥なら小さく)。
//   画面は絵を cover で敷くので、縦と横で切り取られ方が違う。置く所は XmasNovelBody が画面の大きさから計算し、
//   見えない所・文字の枠の下に入るときは、同じ床の上で左右・上へずらす
const XMAS_NOVEL_BODY_FLOOR = Object.freeze({
  backdoor: { x: 0.5, y: 0.83 }, kitchen: { x: 0.5, y: 0.84 },
  snowfield_cliff: { x: 0.5, y: 0.82, snow: true }, mountain_road: { x: 0.5, y: 0.86, snow: true },
  secret_passage: { x: 0.52, y: 0.84 }, mirror_hall: { x: 0.5, y: 0.88, s: 0.9 },
  guest_room: { x: 0.57, y: 0.64, s: 0.8, lift: true }, // えるびんはベッドの上(横は文字の枠に隠れるので、枕のほうへ上げる)
  study: { x: 0.5, y: 0.82, desk: { x: 0.47, y: 0.585 } }, // 机に突っ伏す人は天板の上 stairs_candle: { x: 0.36, y: 0.82 }, corridor_2f: { x: 0.5, y: 0.86 },
  hall_day: { x: 0.5, y: 0.86 }, hall_night: { x: 0.5, y: 0.86 }, attic: { x: 0.5, y: 0.86 }, attic_party: { x: 0.5, y: 0.86 },
  dining: { x: 0.5, y: 0.86 }, locked_room: { x: 0.5, y: 0.86 },
});
const XMAS_NOVEL_BODY_FLOOR_DEFAULT = { x: 0.5, y: 0.84 };
//  倒れ方。sit = 壁にもたれて座りこんでいる(白瀬・名指しエンド M5)/ slump = 机に突っ伏している(書斎)。ほかは横たわる
const XMAS_NOVEL_BODY_POSE = Object.freeze({ 'C5-4': 'sit', 'END-M5': 'sit', 'C5-X': 'slump' });
const xmasNovelBodyPlace = ({ W, H, bg, pose, kind, ar }) => {
  const f = (bg && XMAS_NOVEL_BODY_FLOOR[bg.key]) || XMAS_NOVEL_BODY_FLOOR_DEFAULT;
  const land = W > H;
  const sc = Math.max(W / 1536, H / 1024);
  const dw = 1536 * sc; const dh = 1024 * sc;
  const pxm = String((bg && bg.pos) || '').match(/^(\d+)%/);
  const px = pxm ? Number(pxm[1]) / 100 : 0.5;
  const ox = (W - dw) * px; const oy = (H - dh) / 2;
  const k = f.s || 1;
  let w; let h;
  if (pose === 'slump') {
    // 机に突っ伏している: 頭と肩(絵の上の3割)だけを、机の天板の上に伏せて見せる。下は机の手前の板に隠れる
    const d = f.desk || { x: f.x, y: f.y };
    h = Math.min(0.55 * dh * k, H * (land ? 1.1 : 0.62));
    w = h * ar;
    return { ...xmasNovelBodyClamp({ X: ox + d.x * dw, Y: oy + d.y * dh, w, hv: h * 0.22, W, H, land, lift: true }), w, h, vis: 0.22, snow: false };
  }
  if (pose === 'sit') {
    const vis = kind === 'guest' ? 0.95 : 0.45; // 半身の絵はほぼ全部、全身の絵は腰から上だけ見せる(下は床の暗がりに沈める)
    h = (kind === 'guest' ? 0.27 : 0.5) * dh * k; // 絵の全体の高さ
    h = Math.min(h, H * (land ? 0.62 : 0.34) / vis);
    w = h * ar;
    return { ...xmasNovelBodyClamp({ X: ox + f.x * dw, Y: oy + f.y * dh, w, hv: h * vis, W, H, land }), w, h, vis, snow: !!f.snow };
  }
  if (kind === 'guest') {
    // 胸から上の絵で横たわる人(黒羽): 横に倒さず、頭と肩だけを手前に向けて低くつぶして見せる(うつ伏せの頭と肩)。
    //   胸の切れ目は、雪の吹きだまり(外)か床の暗がり(中)に沈める(r1126-065 追記3)
    h = Math.min(0.26 * dh * k, H * (land ? 0.5 : 0.3));
    w = h * ar;
    return { ...xmasNovelBodyClamp({ X: ox + f.x * dw, Y: oy + f.y * dh, w, hv: h * 0.5, W, H, land }), w, h, vis: 0.5, snow: !!f.snow };
  }
  const len = (kind === 'monster' ? 0.17 : 0.27) * dw * k;
  w = Math.min(len, W * (land ? 0.36 : 0.82));
  h = w * ar; // 横に倒すので、絵の幅が体の厚み
  return { ...xmasNovelBodyClamp({ X: ox + f.x * dw, Y: oy + f.y * dh, w, hv: h, W, H, land, lift: f.lift }), w, h, vis: 1, snow: !!f.snow };
};
const xmasNovelBodyClamp = ({ X, Y, w, hv, W, H, land, lift }) => {
  const boxTop = H - (land ? 140 : 170); // 文字の枠の上の端(だいたい)
  let y = Math.min(Y, land && !lift ? H - 10 : boxTop);
  let x = X;
  if (land && y > boxTop) x = Math.min(x, W * 0.4 - w / 2 - 6); // 横は文字の枠が右側。床の高さはそのままで左へ
  x = Math.max(w / 2 + 8, Math.min(W - w / 2 - 8, x));
  y = Math.max(hv + 50, y);
  return { left: x - w / 2, bottom: H - y };
};
// noBlood: 血だまりと床の赤みを出さない(台本の〔血なし〕。凍えて・首を絞められて亡くなった場面・2026-11-28 総点検 5番)
const XmasNovelBody = ({ who, scene = '', at = 0, bg = null, noBlood = false }) => {
  const k = `${scene}:${who}`;
  // 同じ場面で同じ人の影がすぐまた出るとき(間に台詞が1〜2行)は、血が広がり直さないようにする
  const [again] = useState(() => xmasNovelBodyLast.k === k && Math.abs(at - xmasNovelBodyLast.at) <= 4);
  const [ar, setAr] = useState(0);
  const [broken, setBroken] = useState(false);
  const [vp, setVp] = useState(() => ({ W: typeof window !== 'undefined' ? window.innerWidth : 390, H: typeof window !== 'undefined' ? window.innerHeight : 844 }));
  useEffect(() => { xmasNovelBodyLast = { k, at }; }, [k, at]);
  useEffect(() => {
    const on = () => setVp({ W: window.innerWidth, H: window.innerHeight });
    window.addEventListener('resize', on);
    return () => window.removeEventListener('resize', on);
  }, []);
  const c = xmasNovelCastOf(who);
  const src = xmasNovelBodySrc(who);
  // 謎の客2人も全身の絵になったので、倒れ方は助手と同じ(r1126-076)。胸から上の絵の扱い(bust)は、全身の絵が無い客のときだけ
  const bust = !!(c && c.kind === 'guest' && !/_full\.png$/.test(c.art || ''));
  const kind = c ? (c.kind === 'guest' && !bust ? 'assistant' : c.kind) : '';
  const pose = XMAS_NOVEL_BODY_POSE[scene] || 'lie';
  const slump = pose === 'slump';
  const sit = pose === 'sit';
  const prone = slump || (!sit && bust);
  const r = ar || (bust ? 1 : kind === 'monster' ? 1 : 0.4);
  const p = xmasNovelBodyPlace({ W: vp.W, H: vp.H, bg, pose, kind, ar: r });
  const boxH = sit || prone ? p.h * p.vis : p.h;
  const fx = `${Math.round(((p.left + p.w / 2) / vp.W) * 100)}%`;
  const fy = `${Math.round(((vp.H - p.bottom) / vp.H) * 100)}%`;
  const fade = sit ? `linear-gradient(180deg, #000 ${Math.round(p.vis * 70)}%, transparent ${Math.round(p.vis * 100)}%)` : '';
  return (
    <div className={`mh-nv-body${again ? ' again' : ''}${noBlood ? ' noblood' : ''}`} data-xmas-novel-fallen data-xmas-novel-body={who} data-xmas-novel-body-pose={pose} aria-label={c ? `${c.name}の倒れた影` : '倒れた影'} style={{ '--fx': fx, '--fy': fy }}>
      <div className="mh-nv-body-dim" />
      <div className={`mh-nv-body-lie${sit ? ' sit' : prone ? ' sit prone' : ''}`} style={{ left: p.left, bottom: p.bottom, width: p.w, height: boxH }}>
        <div className="ground" />
        <svg className="pool" viewBox="0 0 300 60" preserveAspectRatio="none" aria-hidden="true">
          <defs>
            <radialGradient id="mh-nv-pool-g" cx="30%" cy="42%" r="70%"><stop offset="0%" stopColor="#9a0716" /><stop offset="45%" stopColor="#6a020e" /><stop offset="100%" stopColor="#300006" /></radialGradient>
          </defs>
          <path d="M14 30 C8 20 30 14 52 16 C64 8 96 6 118 13 C136 9 160 12 170 19 C188 17 204 22 198 28 C214 27 246 30 262 33 C274 35 272 39 258 39 C236 40 214 38 200 40 C206 48 184 54 160 51 C146 57 112 58 92 53 C70 58 38 55 30 48 C16 46 6 38 14 30 Z" fill="url(#mh-nv-pool-g)" />
        </svg>
        {src && !broken && (
          <img src={src} alt="" draggable={false}
            style={sit
              ? { width: p.w, height: p.h, transform: `rotate(${pose === 'slump' ? 16 : 5}deg)`, WebkitMaskImage: fade, maskImage: fade }
              : slump ? { width: p.w, height: p.h, transformOrigin: '50% 0', transform: 'scaleY(.7) rotate(-3deg)', WebkitMaskImage: 'linear-gradient(180deg, #000 20%, transparent 31%)', maskImage: 'linear-gradient(180deg, #000 20%, transparent 31%)' }
              : prone ? { width: p.w, height: p.h, transformOrigin: '50% 0', transform: 'scaleY(.62) rotate(-4deg)', WebkitMaskImage: 'linear-gradient(180deg, #000 48%, transparent 74%)', maskImage: 'linear-gradient(180deg, #000 48%, transparent 74%)' }
              // モンスターの絵(もっち)は左右に余白が多く、倒すと体が床から浮くので、余白のぶん床へ下ろす
              : { width: p.h, height: p.w, ...(kind === 'monster' ? { transform: `translateY(${Math.round(p.h * 0.17)}px) translate(-50%, -50%) rotate(-90deg)` } : {}) }}
            onLoad={(e) => { const im = e.currentTarget; if (im.naturalWidth && im.naturalHeight) setAr(im.naturalWidth / im.naturalHeight); }}
            onError={() => setBroken(true)} />
        )}
        {(!src || broken) && <XmasNovelFallen />}
        {prone && !slump && (
          // 胸から上の絵の切れ目(体の右の端)は、雪の吹きだまり(外)か床の暗がり(中)に沈めて隠す(r1126-065 追記3)
          <svg className="drift" viewBox="0 0 100 40" preserveAspectRatio="none" aria-hidden="true">
            <defs>
              <linearGradient id="mh-nv-drift-g" x1="0" y1="0" x2="0" y2="1">
                {p.snow
                  ? <><stop offset="0%" stopColor="#5f6574" stopOpacity="0" /><stop offset="22%" stopColor="#5f6574" /><stop offset="100%" stopColor="#3c404b" /></>
                  : <><stop offset="0%" stopColor="#000" stopOpacity=".2" /><stop offset="40%" stopColor="#000" stopOpacity=".9" /><stop offset="100%" stopColor="#000" stopOpacity="0" /></>}
              </linearGradient>
            </defs>
            <path d="M0 40 C10 30 22 22 36 20 C46 16 56 16 66 19 C80 22 92 30 100 40 Z" fill="url(#mh-nv-drift-g)" />
          </svg>
        )}
      </div>
    </div>
  );
};
// ゆっくり寄る黒いサンタの影(ホラーの見た目・台帳 r1126-112 追記3)。レイドのボスの絵を黒く塗り、目だけ暗い赤。絵が無ければ出さない
const XmasNovelStalker = ({ className = '', eyes = true }) => {
  const src = typeof RAID_XMAS_BOSS_IMG !== 'undefined' ? RAID_XMAS_BOSS_IMG : '';
  if (!src) return null;
  return (
    <div className={`mh-hr-stalker ${className}`} aria-hidden="true" data-xmas-novel-stalker>
      <img src={src} alt="" draggable={false} />
      {eyes && <><span className="eye" style={{ left: '41%' }} /><span className="eye" style={{ left: '58%' }} /></>}
    </div>
  );
};
// 黒いサンタの影(バッドエンドのシルエット)。レイドのボスの絵を黒く塗りつぶし、目だけ赤く光らせる。絵が無ければ簡単な影
const XmasNovelBossShadow = () => {
  const src = typeof RAID_XMAS_BOSS_IMG !== 'undefined' ? RAID_XMAS_BOSS_IMG : '';
  if (!src) return <XmasNovelShadow tone="#000" hat label="黒いサンタ" />;
  return (
    <div className="mh-nv-boss" data-xmas-novel-boss-shadow aria-label="黒いサンタの影">
      <img src={src} alt="" draggable={false} />
      <span className="eye" style={{ left: '41%' }} /><span className="eye" style={{ left: '58%' }} />
    </div>
  );
};
// 黒いサンタの判(バッドエンド。赤い丸の中に、黒いサンタの影)
const XmasNovelSantaStamp = () => (
  <svg viewBox="0 0 40 40" width="100%" height="100%" aria-hidden="true">
    <circle cx="20" cy="20" r="17" fill="none" stroke="#d22" strokeWidth="3" />
    <path d="M12 17 L22 7 L28 15 Z" fill="#0a0a0a" /><circle cx="28" cy="15" r="2.4" fill="#0a0a0a" />
    <circle cx="20" cy="20" r="5" fill="#0a0a0a" /><path d="M11 33 C12 25 16 24 20 24 C24 24 28 25 29 33 Z" fill="#0a0a0a" />
  </svg>
);
// 亡くなった人の印: 暗いパネルに、血でなぞったような赤いバツ(台帳 r1126-053・追記1)。色は赤いにじみ(.mh-nv-fx.bleed)にそろえる。
//  かすれ・にじみは SVG のゆらぎで、線の端から滴が垂れる。付いた行では1本ずつ引かれる(.mh-nv-person[data-fresh])
const XmasNovelBloodCross = () => (
  <svg viewBox="0 0 100 100" width="100%" height="100%" aria-hidden="true">
    <defs>
      <filter id="mh-nv-blood-rough" x="-10%" y="-10%" width="120%" height="130%">
        <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="7" result="n" />
        <feDisplacementMap in="SourceGraphic" in2="n" scale="5" xChannelSelector="R" yChannelSelector="G" result="d" />
        <feGaussianBlur in="d" stdDeviation="0.5" />
      </filter>
    </defs>
    <g filter="url(#mh-nv-blood-rough)" strokeLinecap="round" fill="none">
      <path className="s1" pathLength="100" d="M15 15 C 30 28, 44 44, 52 52 S 74 72, 84 83" stroke="rgba(110,0,8,.92)" strokeWidth="11" />
      <path className="s1" pathLength="100" d="M17 17 C 32 30, 45 45, 53 53 S 73 71, 82 81" stroke="rgba(160,6,16,.75)" strokeWidth="4.5" />
      <path className="s2" pathLength="100" d="M85 14 C 72 28, 58 42, 50 50 S 28 72, 16 85" stroke="rgba(110,0,8,.92)" strokeWidth="10" />
      <path className="s2" pathLength="100" d="M83 16 C 70 30, 57 43, 49 51 S 29 71, 18 83" stroke="rgba(160,6,16,.75)" strokeWidth="4" />
    </g>
    <g className="drip" fill="rgba(110,0,8,.95)" filter="url(#mh-nv-blood-rough)">
      <path d="M82 84 C 82 88, 84 92, 83.5 96 C 83 99, 80.5 99, 80.6 96 C 80.8 92, 80 88, 80 84 Z" />
      <circle cx="82" cy="97" r="2.6" />
      <path d="M15 86 C 15 89, 16.5 92, 16 94 C 15.6 96, 13.6 96, 13.8 94 C 14 91, 13 89, 13 86 Z" />
      <path d="M50 52 C 50.5 56, 51.5 59, 51 61 C 50.6 63, 48.8 63, 49 61 C 49.2 59, 48.6 56, 48.5 53 Z" />
    </g>
  </svg>
);
const XmasNovelCast = ({ states = {}, changed = [], onPick = null, big = false, picked = '' }) => (
  <div className={`mh-nv-cast${big ? ' big' : ''}`}>
    {XMAS_NOVEL_CAST.map((c, i) => {
      const st = states[c.id] || '';
      const fresh = changed.includes(c.id);
      const face = xmasNovelFaceOf(c.id);
      const inner = (
        <>
          <span className="ph">{face ? <img src={face} alt="" draggable={false} /> : <XmasNovelShadow tone={c.tone} />}</span>
          <span className="mh-nv-serif" style={{ lineHeight: 1.2 }}>{c.name}</span>
          {st === 'missing' && <span className="stamp">行方不明</span>}
          {st === 'hurt' && <span className="tag">けが</span>}
          {st === 'dead' && <span className="cross" aria-label="赤いバツ"><XmasNovelBloodCross /></span>}
          {st === 'santa' && <span className="santa" aria-label="黒いサンタの判"><XmasNovelSantaStamp /></span>}
        </>
      );
      return onPick
        ? <button type="button" key={c.id} data-xmas-novel-person={c.id} data-st={st || undefined} data-pick={picked === c.id ? '' : undefined} aria-pressed={picked === c.id} className="mh-nv-person active:scale-95" onClick={() => onPick(c.id)}>{inner}</button>
        : <div key={c.id} data-xmas-novel-cast={c.id} data-st={st || undefined} data-fresh={fresh ? '' : undefined} className="mh-nv-person" style={{ '--i': i }}>{inner}</div>;
    })}
  </div>
);
// 古い書き方(行方不明: きゅうこ / 亡くなった: 黒羽)の行は、その行の分も重ねる
const xmasNovelPanelStates = (panel, row) => {
  const s = { ...(panel || {}) };
  if (!row) return s;
  (row.missing || []).forEach((id) => { s[id] = 'missing'; });
  (row.hurt || []).forEach((id) => { s[id] = 'hurt'; });
  (row.dead || []).forEach((id) => { s[id] = 'dead'; });
  return s;
};

// ---- 小さな部品 ----
const XMAS_NOVEL_KANJI = ['〇', '一', '二', '三', '四', '五', '六', '七', '八', '九', '十'];
const xmasNovelChapterLabel = (ch) => {
  if (!ch) return '';
  if (ch.outside) return ''; // 外側(ゲームの外)は章の名前を出さない
  if (ch.disp) return ch.disp;
  if (ch.id === 'END') return 'エンディング';
  if (ch.no === 0) return '序章';
  if (ch.no === 9 && /終章/.test(ch.label)) return '終章';
  return `第${XMAS_NOVEL_KANJI[ch.no] || ch.no}章`;
};
const xmasNovelNameOf = (row) => {
  if (!row || row.t !== 'line') return '';
  if (row.n) return row.n;
  const c = xmasNovelCastOf(row.w);
  return c ? c.name : '';
};
// {name} … プレイヤーの名前 / {犯人にした人} … 推理で選んだ人(xmasNovelFillCtx で渡す)
let xmasNovelFillCtx = { accused: '' };
const xmasNovelFill = (text, playerName) => String(text || '').replace(/\{name\}/g, playerName || 'あなた').replace(/\{犯人にした人\}/g, xmasNovelFillCtx.accused || '……');
// シルエットの笑い声(tools/novel/xmas-novel-laugh.py で合成した音・鳴らすときに初めて読む)
const XMAS_NOVEL_LAUGH_SE = 'audio/se-xmas-novel-laugh.mp3';
const xmasNovelSe = (kind) => {
  try {
    if (typeof Audio_ === 'undefined' || !Audio_ || !Audio_.se) return;
    // 表の画面の音の口(fgSe・fgPlaySeFile)から鳴らす。裏クイックが回っているあいだは裏のバトルの音を止める印が立つので、
    //   se・playSeFile だと事件簿の音まで消える(r1126-072)。口が無い古い作りなら今までの口へ
    const playFile = typeof Audio_.fgPlaySeFile === 'function' ? Audio_.fgPlaySeFile : Audio_.playSeFile;
    if (kind === 'laugh' && typeof playFile === 'function') { void playFile(XMAS_NOVEL_LAUGH_SE); return; }
    // 2026-11-28 社長「SEとかも明るすぎる」(台帳 r1126-093 追記1): 明るい・軽い音をやめ、手持ちの低く重い・静かな音へ。
    //   物音(tap・clap)= 低いこもった「コトッ」(trainingDice)/ オルゴール(music)= 下がっていく2音(trainingFail)/ 手がかり = 低い2音(enemyMove)/
    //   正解 = 重い「ドン」(attack。前の victory はファンファーレで、曲まで止めていた)/ はずれ = 低いうなり(trainingBad)/ 衝撃 = 今のまま(enemyAttack)
    const map = { clap: 'trainingDice', laugh: 'enemySpecial', impact: 'enemyAttack', music: 'trainingFail', tap: 'trainingDice', clue: 'enemyMove', ok: 'attack', ng: 'trainingBad' };
    const fn = (Audio_.fgSe || Audio_.se)[map[kind] || 'trainingDice'];
    if (typeof fn === 'function') fn();
  } catch (e) { /* 音が出せなくても読み進める */ }
};
// 台本の〔音:鐘〕〔音:時計〕〔音:手紙〕の行の音(r1126-066)。手持ちの効果音だけを使う(新しい音は作らない)。
//   鐘 = 金属の音(guard)に、低く下がる余韻(trainingFail)を重ねた「ボーン」/ 時計・手紙は下の表(r1126-093 追記1 で暗い音へ替えた)。
//   効果音の音量(seBus)を通るので設定どおりの大きさ。BGM は止めない。
//   連打しても重ねない: 次の行へ進んだら残りの回数は鳴らさず、同じ音を前の音のすぐあと(hold の間)には鳴らし直さない
const XMAS_NOVEL_SE_SEQ = Object.freeze({
  bell: { gap: 1150, hold: 900, play: ['guard', 'trainingFail'] },
  //   r1126-093 追記2(雰囲気): 時計 = 柱時計のチク(nvTick)/ 手紙 = 不穏な一音(nvDread)。下は帯の文から選び直した音(xmasNovelSeKindOf)。
  //   play の1つは '名前' か [名前, 引数, 遅らせるミリ秒]。音そのものは 14-audio.jsx の fgSe.nv*(その場で合成・小さく低い)
  tick: { gap: 520, hold: 300, play: [['nvTick', true]] },
  letter: { gap: 0, hold: 1500, play: ['nvDread'] },
  knock: { gap: 460, hold: 300, play: ['nvThud'] },
  thud: { gap: 420, hold: 250, play: ['nvThud'] },
  creak: { gap: 0, hold: 800, play: ['nvCreak'] },
  creakGlass: { gap: 0, hold: 1200, play: ['nvCreak', ['nvGlass', undefined, 650]] },
  glass: { gap: 0, hold: 500, play: ['nvGlass'] },
  windGlass: { gap: 0, hold: 1500, play: ['nvWind', ['nvGlass', undefined, 500], ['nvGlass', undefined, 1100]] },
  slamLock: { gap: 0, hold: 700, play: ['nvThud', ['nvTick', true, 380], ['nvTick', false, 470]] },
  lock: { gap: 0, hold: 400, play: [['nvTick', true], ['nvTick', false, 90]] },
  rustle: { gap: 0, hold: 400, play: ['nvRustle'] },
  dread: { gap: 0, hold: 1500, play: ['nvDread'] },
  lightsOut: { gap: 0, hold: 1500, play: ['nvThud', ['nvDread', undefined, 120]] },
  musicbox: { gap: 0, hold: 1800, play: ['nvMusicBox'] },
  clap: { gap: 0, hold: 1200, play: ['nvRustle', ['nvRustle', undefined, 650]] },
  fire: { gap: 0, hold: 1500, play: ['nvFire'] },
  wind: { gap: 0, hold: 2500, play: ['nvWind'] },
  //   r1126-093 追記3: 足音・駆ける・殴られる・倒れる・悲鳴の手前の息・扉・吹きこむ風
  steps: { gap: 0, hold: 1500, play: ['nvStep'] },
  run: { gap: 0, hold: 1300, play: ['nvRun'] },
  hit: { gap: 0, hold: 500, play: ['nvHit'] },
  hitFall: { gap: 0, hold: 1200, play: ['nvHit', ['nvFall', undefined, 420]] },
  fall: { gap: 0, hold: 1000, play: ['nvFall'] },
  scream: { gap: 0, hold: 1500, play: ['nvGasp', ['nvDread', undefined, 260]] },
  door: { gap: 0, hold: 900, play: ['nvDoor'] },
  doorGust: { gap: 0, hold: 1500, play: ['nvDoor', ['nvGust', undefined, 200]] },
  gust: { gap: 0, hold: 1500, play: ['nvGust'] },
  glassKnock: { gap: 380, hold: 300, play: ['nvGlass'] },
  winding: { gap: 330, hold: 250, play: [['nvTick', true], ['nvTick', false, 120]] },
});
//  効果音の印の無い帯にも、文に合わせて1回鳴らす所(r1126-093 追記3)。行ID → [音, 回数]。a/s の2つある行は両方に書く
const XMAS_NOVEL_SE_ROW = Object.freeze({
  '2-L-12': ['knock', 2], '2-M-15': ['windGlass'], '2-5-2': ['doorGust'], '2-5-6b': ['gust'],
  '4-4-1': ['winding', 3], '4-M-16': ['steps'], '5-4-1': ['knock', 2],
  '5-X-4a': ['run'], '5-X-4s': ['run'], '6-X-6': ['run'], '2-Y-7': ['steps'], '2-Y-10': ['hitFall'], '2-Y-11': ['fall'],
  '6-7-4': ['doorGust'], '7-P1-8': ['doorGust'], '9-1-2': ['winding', 2], '9-1-5': ['doorGust'], '6-X-1a': ['doorGust'], '6-X-1s': ['doorGust'],
  '10-3-9': ['fall'], 'M5-2': ['steps'], 'B-13': ['fall'], 'G-3': ['winding', 3], 'N-3': ['winding', 2], '1-O-19': ['winding', 2],
  '12-2-9': ['lock'], '12-3-6': ['knock', 3], '12-5-3': ['glassKnock', 3],
});
//  帯の効果音を、文に合わせて選び直す(台本データの印は 物音(tap)・衝撃(impact)・拍手・オルゴールの4つだけで、どれも同じ音だった・r1126-093 追記2)
const xmasNovelSeKindOf = (kind, row) => {
  if (kind === 'bell' || kind === 'tick' || kind === 'letter') return kind;
  if (kind === 'music') return 'musicbox';
  if (kind === 'clap') return 'clap';
  const x = String((row && row.x) || '');
  if (/声|悲鳴|叫び|きゃ|うわ|っ！/.test(x)) return 'scream';
  if (/ピー/.test(x)) return 'dread';
  if (/ブツン|停電/.test(x)) return 'lightsOut';
  if (/(ギィ|ギシ)[\s\S]*(ガシャン|割れ)/.test(x)) return 'creakGlass';
  if (/吹雪[\s\S]*ガラス|ガラス[\s\S]*吹雪/.test(x)) return 'windGlass';
  if (/ギィ|ギシ|きしむ|開く音/.test(x)) return 'creak';
  if (/ガシャン|ガラス|カシャ|割れ/.test(x)) return 'glass';
  if (/バタン[\s\S]*(カチャリ|鍵)/.test(x)) return 'slamLock';
  if (/カチリ|カチャリ|留め金|鍵の音/.test(x)) return 'lock';
  if (/封|カサ|プシュッ/.test(x)) return 'rustle';
  if (/叩く|打ちつける|ドン、ドン|コン、コン/.test(x)) return 'knock';
  if (/ガタッ[\s\S]*ゴッ/.test(x)) return 'hitFall';
  if (/ドサッ/.test(x)) return 'fall';
  if (/^ゴッ|ゴッ[(（]|鈍い音/.test(x)) return 'hit';
  if (/ドサッ|ゴッ|ゴトン|ガタ|重い|ドン/.test(x)) return 'thud';
  return kind === 'impact' ? 'impact' : 'thud';
};
//  叩く音の回数は、文の「ドン」「コン」の数(3回まで)
const xmasNovelSeTimesOf = (kind, row, times) => {
  if (Number.isFinite(times)) return times;
  if (kind !== 'knock' && kind !== 'thud') return 1;
  const m = String((row && row.x) || '').match(/ドン|コン/g);
  return kind === 'knock' && m ? Math.min(3, m.length) : 1;
};
let xmasNovelSeTimers = [];
let xmasNovelSeLast = { kind: '', at: 0 };
const xmasNovelSeStop = () => { xmasNovelSeTimers.forEach((t) => clearTimeout(t)); xmasNovelSeTimers = []; };
const xmasNovelSeFn = (name) => { try { const fn = (Audio_.fgSe || Audio_.se)[name]; return typeof fn === 'function' ? fn : null; } catch (e) { return null; } };
const xmasNovelSeHit = (kind) => {
  try {
    if (typeof Audio_ === 'undefined' || !Audio_ || !Audio_.se) return;
    const seq = XMAS_NOVEL_SE_SEQ[kind];
    xmasNovelSeLast = { kind, at: Date.now() };
    // 表の画面の口(fgSe)から鳴らす(裏クイックの音を止める印を受けない・r1126-072。上の xmasNovelSe と同じ)
    seq.play.forEach((item) => {
      const [name, arg, delay] = Array.isArray(item) ? item : [item];
      const fn = xmasNovelSeFn(name);
      if (!fn) return;
      if (delay > 0) xmasNovelSeTimers.push(setTimeout(() => fn(arg), delay)); else fn(arg);
    });
  } catch (e) { /* 音が出せなくても読み進める */ }
};
//  既読飛ばしの間は、帯の1回の音を鳴らさない(つぎつぎ重なるため・r1126-093 追記3)。画面が skip に合わせて立てる
let xmasNovelSeQuiet = false;
const xmasNovelRowSe = (kindIn, times, row) => {
  xmasNovelSeStop();
  if (xmasNovelSeQuiet) return;
  const kind = xmasNovelSeKindOf(kindIn, row);
  const seq = XMAS_NOVEL_SE_SEQ[kind];
  if (!seq) { xmasNovelSe(kind); return; }
  const n = Math.max(1, Math.min(3, xmasNovelSeTimesOf(kind, row, times)));
  const wait = xmasNovelSeLast.kind === kind ? Math.max(0, seq.hold - (Date.now() - xmasNovelSeLast.at)) : 0;
  for (let i = 0; i < n; i += 1) {
    const at = wait + i * seq.gap;
    if (at <= 0) xmasNovelSeHit(kind);
    else xmasNovelSeTimers.push(setTimeout(() => xmasNovelSeHit(kind), at));
  }
};
//  場所の環境音(ずっと小さく鳴る・r1126-093 追記3)。背景の名前で決め、場面・背景が替わったらつなぎ目なく替える(14-audio.jsx の nvAmbient)
//    外側(助手たちの前)・エンドの札(背景なし)は鳴らさない。下の表は背景と話が合わない所だけ
const XMAS_NOVEL_AMBIENT_SCENE = Object.freeze({ 'C2-M': 'wind', 'C12-2': 'wind', 'C2-L': 'clock', 'C1-6': 'clock' });
const xmasNovelAmbientOf = (scene, bgName) => {
  if (!scene || scene.outside) return 'none';
  if (Object.prototype.hasOwnProperty.call(XMAS_NOVEL_AMBIENT_SCENE, scene.id)) return XMAS_NOVEL_AMBIENT_SCENE[scene.id];
  const bg = String(bgName || scene.bg || '');
  if (!bg || /助手たち|monhero_/.test(bg)) return 'none';
  if (/吹雪/.test(bg)) return 'blizzard';
  if (/雪原|雪の山道|崖/.test(bg)) return 'wind';
  if (/暖炉/.test(bg)) return 'fire';
  if (/柱時計|ホール/.test(bg)) return 'clock';
  return 'room';
};
const xmasNovelSetAmbient = (kind) => { try { if (typeof Audio_ !== 'undefined' && Audio_ && typeof Audio_.nvAmbient === 'function') void Audio_.nvAmbient(kind || 'none'); } catch (e) { /* 音が出せなくても読み進める */ } };
//  事件簿の曲(2026-11-28 社長「音楽で声有りはやめて」「ちゃんとばめんにあったやつに」「音無しとかばめんによって」「全体的に暗く」・台帳 r1126-093)。
//    歌(声)の入った曲は使わない。声の有無は声の分離器で測った(表と測り方: docs/progress/event-xmas-2026/NOVEL-BGM-R1126-093.md)。
//    r1126-093 追記3(社長「BGM を明るいとこ以外は極力静かなやつか音無しにいれて SE で表現」): 明るい場面と静かな曲(ピアノ・プロフィール・ゲームオーバー)だけ残し、
//    不穏・怖い・推理の曲は音無しにして、場所の環境音(xmasNovelAmbientOf)と帯の音で表す。
//    'silence' は曲を止める(死の場面・張りつめた所・静かな独白)。台本データ(79-xmas-novel-script.jsx)の曲より、この表が勝つ
const XMAS_NOVEL_BGM_SCENE = Object.freeze({
  'OUT-0-1': 'original_profile', 'OUT-0-2': 'silence', 'C0-1': 'original_profile', 'C0-2': 'original_profile',
  'OUT-1': 'silence', 'C1-1': 'original_profile', 'C1-2': 'original_profile', 'C1-3': 'silence',
  'C1-4': 'silence', 'C1-5': 'close_to_your_heart_alt', 'C1-6': 'silence', 'C1-M': 'silence',
  'C2-1': 'silence', 'C2-L': 'silence', 'C2-M': 'silence', 'C2-2': 'original_profile',
  'C2-3': 'silence', 'C2-4': 'silence', 'C2-5': 'silence', 'C3-1': 'silence',
  'C3-2': 'silence', 'C3-3': 'silence', 'C3-4': 'silence', 'C3-5': 'melo_erfolg_piano',
  'C3-M': 'melo_erfolg_piano', 'C4-1': 'silence', 'C4-2': 'silence', 'C4-3': 'silence',
  'C4-4': 'silence', 'C4-5': 'silence', 'C4-M': 'silence', 'C5-1': 'melo_erfolg_piano',
  'C5-2': 'silence', 'C5-3': 'silence', 'C5-4': 'silence', 'C5-5': 'silence',
  'C5-M': 'silence', 'C6-1': 'silence', 'C6-2': 'silence',
  'C6-3': 'silence', 'C6-4': 'silence', 'C6-5': 'silence',
  'C6-6': 'silence', 'C6-7': 'silence', 'C6-8': 'melo_erfolg_piano', 'C6-9': 'silence',
  'C6-M': 'melo_erfolg_piano', 'C7-1': 'silence', 'C7-2': 'silence', 'C7-A': 'melo_erfolg_piano',
  'C7-B': 'silence', 'C7-P1': 'silence', 'C7-P2': 'melo_erfolg_piano', 'C7-P3': 'silence',
  'C7-4a': 'melo_erfolg_piano', 'C7-4b': 'silence', 'C7-5a': 'melo_erfolg_piano', 'C7-5b': 'silence',
  'C7-W': 'silence', 'C8-1': 'silence', 'C8-2': 'silence', 'C8-3': 'melo_erfolg_piano',
  'C9-1': 'silence', 'C9-2': 'close_to_your_heart_alt', 'C10-1': 'silence', 'C10-2': 'silence',
  'C10-3': 'silence', 'C10-4': 'silence', 'C11-1': 'silence',
  'C11-N': 'melo_erfolg_piano', 'C11-A': 'melo_erfolg_piano', 'C11-B': 'silence', 'C2-X': 'silence',
  'END-X1': 'original_game_over', 'C5-X': 'silence', 'END-X2': 'original_game_over', 'C6-X': 'silence',
  'END-X3': 'original_game_over', 'C2-Y': 'silence', 'END-X4': 'original_game_over', 'C10-X': 'silence',
  'END-X5': 'original_game_over', 'END-M1': 'original_game_over', 'END-M2': 'silence', 'END-M3': 'silence',
  'END-M4': 'original_game_over', 'END-M5': 'silence', 'END-G': 'melo_erfolg_piano', 'OUT-G': 'close_to_your_heart_alt',
  'END-N': 'melo_erfolg_piano', 'OUT-N': 'melo_erfolg_piano', 'END-A': 'silence', 'OUT-A': 'silence',
  'END-B': 'silence', 'OUT-B': 'silence', 'C1-O': 'original_profile', 'END-O': 'original_profile',
  'OUT-O': 'original_profile', 'END-O2': 'close_to_your_heart_alt', 'OUT-O2': 'close_to_your_heart_alt', 'C12-1': 'close_to_your_heart_alt',
  'C12-2': 'melo_erfolg_piano', 'C12-3': 'silence', 'C12-4': 'silence', 'C12-5': 'silence',
  'C12-6': 'silence', 'C12-7': 'melo_erfolg_piano',
});
//  場面の途中で曲を変える・止める所。場面ID → [その行から先, 曲の鍵](a/s の2つある行は、前の方の行に付ける)
const XMAS_NOVEL_BGM_SHIFT = Object.freeze({
  'C2-3': [['2-3-7', 'silence']],
  'C5-4': [['5-4-5', 'silence']],
  'C6-5': [['6-5-3', 'silence']],
  'C7-1': [['7-1-3a', 'silence']],
  'C7-W': [['7-W-14', 'silence']],
  'C10-1': [['10-1-5', 'silence']],
  'C10-2': [['10-2-7', 'silence']],
  'C10-3': [['10-3-7', 'silence']],
  'C2-X': [['2-X-6a', 'silence']],
  'C5-X': [['5-X-4a', 'silence']],
  'C6-X': [['6-X-8', 'silence']],
  'C2-Y': [['2-Y-10', 'silence']],
  'C10-X': [['10-X-8', 'silence']],
  'END-M2': [['M2-4', 'silence']],
  'END-M5': [['M5-5a', 'silence']],
  'END-B': [['B-3', 'silence']],
  'END-G': [['G-10', 'close_to_your_heart_alt']],
  'C12-4': [['12-4-5', 'silence']],
});
//  歌の入った曲を、まちがって鳴らさないための網(台本データの古い曲の鍵が残っていても、声の無い曲へ替える)
const XMAS_NOVEL_VOCAL_BGM = Object.freeze({
  kaze_ga_soyogu: 'original_profile', melo_kiss_mystery: 'melo_dullahan_steel_ghost_alt', melo_kiss_mystery_short: 'melo_dullahan_steel_ghost_alt',
  melo_sad_song: 'melo_erfolg_piano', melo_sad_song_short: 'melo_erfolg_piano', melo_dear_santa: 'close_to_your_heart_alt', melo_dear_santa_short: 'close_to_your_heart_alt',
  melo_winter_fall: 'close_to_your_heart_alt', melo_winter_fall_short: 'close_to_your_heart_alt', close_to_your_heart: 'close_to_your_heart_alt',
});
//  いまの行で鳴らす曲: 場面の曲(上の表 → 台本データ)→ その場面のいまの行までの切り替え(あとのものが勝つ)。
//    上の表にある場面は、台本データの行の曲(歌の入った新曲を指していた)を使わない
const xmasNovelBgmAt = (scene, idx) => {
  if (!scene) return '';
  const fixed = Object.prototype.hasOwnProperty.call(XMAS_NOVEL_BGM_SCENE, scene.id);
  let key = fixed ? XMAS_NOVEL_BGM_SCENE[scene.id] : (scene.bgm || '');
  const rows = Array.isArray(scene.rows) ? scene.rows : [];
  const at = Number.isFinite(idx) ? idx : 0;
  const shifts = XMAS_NOVEL_BGM_SHIFT[scene.id] || [];
  for (let i = 0; i <= at && i < rows.length; i += 1) {
    const r = rows[i];
    if (!fixed && r && r.bgm) key = r.bgm;
    shifts.forEach(([rowId, k]) => { if (r && r.id === rowId) key = k; });
  }
  return XMAS_NOVEL_VOCAL_BGM[key] || key;
};
const xmasNovelBgm = (keyIn) => {
  let key = keyIn;
  try {
    if (typeof Audio_ === 'undefined' || !Audio_) return;
    if (!key) return;
    key = XMAS_NOVEL_VOCAL_BGM[key] || key; // 歌の入った曲は鳴らさない(r1126-093)
    if (key === 'silence') { Audio_.stopBGM(); return; }
    if (typeof Audio_.fadeToBGM === 'function') Audio_.fadeToBGM(key, 700); else Audio_.playBGM(key);
  } catch (e) { /* 曲が鳴らせなくても読み進める */ }
};
// ==== 改行の位置(台帳 r1126-071)ここから。検査 tools/novel/xmas-novel-wrap-check.js がこの間をそのまま取り出して使う ====
//  社長「改行位置がめちゃくちゃ、きになる。特にセリフじゃない部分」(「灰色のコー／トの影が」「染みこんでい／く」「黒いサン／タ」)。
//  前の決め(r1126-048)の「1文字単位で折る」をやめ、文節(言葉のまとまり)の切れ目だけで折る。左寄せ・ぶら下げ・音の行の中央(r1126-052)はそのまま。
//  ・折ってよい所は、ほかの画面と同じ部品 jaWrapPoints(41-screen-ui.jsx)が決める所と空白
//  ・そのうえで、名前・固有名詞・手がかりの名前・かぎかっこの中の短い名前・日時・数と単位・「……」の中では折らない
//  ・折ってよい所と所のあいだは、折らない枠(white-space: nowrap)で包む。ブラウザがほかの所で折れないようにするため
//  ・文字送りの途中も、文の全部を置いて、まだの字を見えなくするだけ(字が出るたびに改行の位置が動かない)
const XMAS_NOVEL_KEEP_BASE = [
  '黒いサンタ', '聖夜のロンド', '十三番目の鐘', '十二の鐘', 'ペンション・シュプール', '聖夜の名探偵', '名探偵', '手がかり帳', '12年前の聖夜', '12年前', '12年後',
  'ワトソンくん', 'エンドヒストリー', 'セーブデータ', 'ノートパソコン', 'メリークリスマス', 'クリスマス会', 'クリスマス', 'モンヒロ', 'オルゴール', 'ミステリーノベル',
  '呪いのセーブデータ', 'モンヒロ事件簿', 'ポロロン', 'ローズ色', '銀の音符', '懐中時計', '子守歌', '招待状', 'サンタの帽子',
  // お知らせの吹き出しでも使う(2026-11-28 r1126 ミハリの総点検「MF／バトルカード」)
  'MFバトルカード', 'モンヒロビート', 'モンヒロバトル', 'ビートP', 'カードポイント',
];
// 長い枠は1行に入らず、字が枠の外へ出る。包むのはこの字数まで(縦の台詞で1行約18.6字・お知らせの吹き出しで約19字。2026-11-28 16→18)
const XMAS_NOVEL_KEEP_MAX = 18;
let _xmasNovelKeepWords = null;
const xmasNovelKeepWords = () => {
  if (_xmasNovelKeepWords) return _xmasNovelKeepWords;
  const set = new Set(XMAS_NOVEL_KEEP_BASE);
  try {
    // 台本から: 手がかりの名前・章の題・エンドの名前・人の名前(フルネームも)
    const S = typeof XMAS_NOVEL_SCRIPT !== 'undefined' ? XMAS_NOVEL_SCRIPT : null;
    if (S) {
      (S.chapters || []).forEach((c) => { if (c && c.title) set.add(c.title); });
      (S.scenes || []).forEach((sc) => {
        if (sc && sc.ending && sc.ending.name) set.add(sc.ending.name);
        (sc && sc.rows || []).forEach((r) => { if (r && r.t === 'clue' && r.clue) set.add(r.clue); });
      });
    }
    if (typeof XMAS_NOVEL_CAST !== 'undefined') XMAS_NOVEL_CAST.forEach((c) => { if (c.name) set.add(c.name); if (c.full) set.add(c.full); });
  } catch (e) { /* 一覧が作れなくても、決まりの分だけで折る */ }
  _xmasNovelKeepWords = [...set].filter((w) => typeof w === 'string' && [...w].length >= 2 && [...w].length <= XMAS_NOVEL_KEEP_MAX).sort((a, b) => b.length - a.length);
  return _xmasNovelKeepWords;
};
// 形で決まる「割らない所」
const XMAS_NOVEL_KEEP_RES = [
  // 日時(11/28(土) 10:00・12/25・0:00)
  /\d{1,2}\/\d{1,2}(?:[(（][月火水木金土日](?:・祝)?[)）])?(?:[ 　]?\d{1,2}:\d{2})?/g,
  /\d{1,2}:\d{2}/g,
  // かぎかっこの中の短い名前は、かっこごと(「黒いサンタ」『聖夜のロンド』【二通目の招待状】)
  //   長さは使う所の枠(max)で決める(見た目の幅で数える。「Kissからはじまるミステリー」2026-11-28)
  /[「『【][^「」『』【】\n]{1,24}[」』】]/g,
  // 数と単位(30センチ・3人・0じ)。前の「約」「第」「残り 」も
  //   続いた単位(4分12秒・1時間30分)もひとかたまり
  /(?:約|第|残り[ 　]?)?(?:[0-9０-９]+(?:[.．][0-9０-９]+)?[ 　]?(?:センチ|メートル|キロ|ミリ|時間|人目|番目|通目|号室|人|年|時|分|秒|個|つ|回|日|月|歳|才|枚|本|通|度|階|号|じ|倍|cm|m|%|％))+/g,
  // 数とそのあとのカタカナの言葉(2バージョン・3ステージ)
  /[0-9０-９]+[ァ-ヶー]{2,}/g,
  // 英字の並び(BPM 170・short ver.・Dear Santa)。空白をはさんでもひとかたまり(枠に入る長さのときだけ)
  /[A-Za-z][A-Za-z0-9#.'&!?-]*(?:[ ][A-Za-z0-9#.'&!?-]+)+/g,
  /[一二三四五六七八九十百千]+(?:番目|人目|通目|時間|人|年|つ|回|度|階|日|分|時|本|枚|個|通)/g,
  // 三点リーダー・ダッシュの並び(「……」「——」)と、そのすぐあとの句読点
  /(?:…|‥|—|―){2,}[、。！？!?]*/g,
  // 「〜届いたゲーム〜」のような題の飾り
  /[〜～][^〜～\s]{1,12}[〜～]/g,
];
// 文の組み立てで切れ目になる所(助詞のあと・「て」のあと・「です」「ように」「こと」の手前など)。ひらがなの続きの中でも、ここなら折ってよい
const xmasNovelGramBreak = (s, i) => {
  const b = s.slice(0, i), a = s.slice(i);
  return (/て$/.test(b) && /^[^るたはぁぃぅぇぉっゃゅょー]/.test(a))
    || /[A-Za-z0-9０-９ァ-ヶー」』）)一-龯々][はがをにもへとでのや]$/.test(b)
    || (/^[はがをにもへのとや]/.test(a) && /[ぁ-ゖー]{2}$/.test(b) && !/[はがをにもへ]$/.test(b)) || (/で$/.test(b) && /^[^すしきもはるぁぃぅぇぉっゃゅょー]/.test(a))
    // 「って」は引用の「って」だけ(漢字のすぐあとの「入って|る」は動詞の途中・r1126 総点検)
    || /(?:から|まで|けど|ので|のに|ても|でも|には|では|とは|(?<![一-龯々])って|たら|れば|ながら|けれど|より|だけ|ほど|など|ように|ような|という|か|を)$/.test(b)
    || /^(?:です|でし|でしょ|だっ|だった|だよ|だね|だろ|じゃ|ように|ような|こと|もの|ため|わけ|はず|べき|かも|かな|なの|なん|ちゃん|くん|さん|ん[だでじ]|の(?:た|に|で|だ|か))/.test(a)
    || (/[くし]$/.test(b) && /^(?:な[るりっられ]|し[たてよま])/.test(a))
    || (/^[おご]/.test(a) && /[ぁ-ゖ一-龯]/.test(s[i + 1] || ''));
};
// かっこの名前を守るか: すぐあとの句読点(離せない)も合わせて枠(max)に入るとき
const xmasNovelBracketFits = (s, m, max) => { let e = m.index + m[0].length; while (e < s.length && /[、。！？!?]/.test(s[e])) e++; return xmasNovelWidth(s.slice(m.index, e)) <= max; };
const xmasNovelWidth = (t) => [...String(t)].reduce((n, c) => n + (/[\x20-\x7e]/.test(c) ? 0.55 : 1), 0);
const xmasNovelIsKana = (s, i) => /[ぁ-ゖゝゞ]/.test(s[i] || '') || (s[i] === 'ー' && i > 0 && /[ぁ-ゖ]/.test(s[i - 1]));
// 道具(Intl.Segmenter)の言葉の区切り。Map(始まりの位置 → 言葉)。道具が無い端末では空(決まりの分だけで見る)
let _xmasNovelSeg;
const xmasNovelSegments = (s) => {
  const m = new Map();
  try {
    if (_xmasNovelSeg === undefined) _xmasNovelSeg = (typeof Intl !== 'undefined' && Intl.Segmenter) ? new Intl.Segmenter('ja', { granularity: 'word' }) : null;
    if (_xmasNovelSeg) for (const x of _xmasNovelSeg.segment(s)) m.set(x.index, x.segment);
  } catch (e) { /* 区切りが取れなくても折れる */ }
  return m;
};
// ここで折ると言葉の途中になるか: 道具の言葉の切れ目でない所(「巻いて|いない」の「てい」)・ひらがなの言葉の途中(「しまいこ|まれて」)・
//   漢字・カタカナ・閉じかっこのすぐあとの助詞の手前(「暖炉の前|の」「スピーカー|から、」「(カノン)|と、」。助詞は前の言葉と同じ文節・r1126-077 の点検)
const xmasNovelBadBreak = (s, b, segAt) => {
  if (segAt && segAt.size && !segAt.has(b)) return true;
  if (xmasNovelIsKana(s, b - 1) && xmasNovelIsKana(s, b) && !xmasNovelGramBreak(s, b)) return true;
  const w = segAt && segAt.get(b);
  return /[一-龯々ァ-ヶー」』）)A-Za-z0-9０-９]$/.test(s.slice(0, b)) && !!w && /^(?:の|は|が|を|に|へ|と|で|も|や|から|まで|より)$/.test(w);
};
const XMAS_NOVEL_PLAN_CACHE = new Map();
// 文を「折らない枠」に分ける。[{ t: 字, keep: 包むか, space: 空白か }]。max は1つの枠の字数の上限(1行に入る字数より少なく。大きい字の札は小さく)
const xmasNovelWrapPlan = (text, max = XMAS_NOVEL_KEEP_MAX) => {
  const s = String(text ?? '');
  if (!s) return [];
  const ck = `${max}|${s}`;
  const hit = XMAS_NOVEL_PLAN_CACHE.get(ck);
  if (hit) return hit;
  const br = new Set();
  let marked = s;
  try { marked = typeof jaWrapPoints === 'function' ? jaWrapPoints(s) : s; } catch (e) { marked = s; }
  if (typeof marked !== 'string' || marked.replace(/\u200B/g, '') !== s) marked = s;
  let pos = 0;
  for (const ch of marked) { if (ch === '\u200B') br.add(pos); else pos += ch.length; }
  for (const m of s.matchAll(/\s+/g)) { br.add(m.index); br.add(m.index + m[0].length); }
  // 長さは見た目の幅で数える(半角の英数字・記号は全角の約半分。「「Battle #5」を追加しました。」2026-11-28 総点検)
  const len = (a, b) => xmasNovelWidth(s.slice(a, b));
  const spans = [];
  // かぎかっこの中の名前は、枠(max)に入るときだけかっこごと包む。入らないときは、名前の一覧と言葉の切れ目に任せる
  for (const re of XMAS_NOVEL_KEEP_RES) for (const m of s.matchAll(re)) if (!/^[「『【]/.test(m[0]) || xmasNovelBracketFits(s, m, max)) spans.push([m.index, m.index + m[0].length]);
  for (const w of xmasNovelKeepWords()) if ([...w].length <= max) for (let i = s.indexOf(w); i >= 0; i = s.indexOf(w, i + 1)) spans.push([i, i + w.length]);
  for (const b of [...br]) if (b <= 0 || b >= s.length || spans.some(([a, e]) => b > a && b < e)) br.delete(b);
  const segAt = xmasNovelSegments(s);
  // ひらがなの続きの途中(「しまいこ|まれてた」「いてく|れた」)は、文の組み立ての切れ目でなければ外す。つないでも枠に入るときだけ(迷ったら折らない)
  for (const b of [...br].sort((x, y) => x - y)) {
    if (!xmasNovelBadBreak(s, b, segAt)) continue;
    const sorted = [0, ...[...br].sort((x, y) => x - y), s.length];
    const k = sorted.indexOf(b), lo = sorted[k - 1], hi = sorted[k + 1];
    if (len(lo, hi) <= max) { br.delete(b); continue; }
    // つなぐと長すぎるときは、同じかたまりの中の文の組み立ての切れ目(「ねじを|巻いていない」)へ移す。どちらの側も枠に入る所のうち、元の所にいちばん近い所
    let best = -1;
    for (let q = lo + 1; q < hi; q++) {
      if (q === b || spans.some(([x, e]) => q > x && q < e) || /^[、。，．,.」』）)】〕〉》…‥ー〜～・：；ぁぃぅぇぉっゃゅょゎァィゥェォッャュョヮヵヶ！？!?]/.test(s.slice(q)) || /[「『（(]$/.test(s.slice(0, q))) continue;
      if (xmasNovelBadBreak(s, q, segAt)) continue;
      if (len(lo, q) > max || len(q, hi) > max) continue;
      if (best < 0 || Math.abs(q - b) < Math.abs(best - b)) best = q;
    }
    if (best >= 0) { br.delete(b); br.add(best); }
  }
  // 枠(max)より長いかたまりは、中の言葉の切れ目で枠に入る長さずつに分ける(ブラウザの好きな所で折らせない・r1126-078 の点検「「お気に入りの魔／法」」)
  //   分ける所が無いとき(守るかっこの名前とあとの字で枠を超える「『〜みなさまへ』でつ」)だけ、かっこの中の言葉の切れ目でも分ける
  const NO_START = /^[、。，．,.」』）)】〕〉》…‥ー〜～・：；ぁぃぅぇぉっゃゅょゎァィゥェォッャュョヮヵヶ！？!?]/;
  const okAt = (q, inSpanOk) => segAt.has(q) && !xmasNovelBadBreak(s, q, segAt) && !NO_START.test(s.slice(q)) && !/[「『（(【]$/.test(s.slice(0, q))
    && !spans.some(([x, e]) => q > x && q < e && (!inSpanOk || !/^[「『【]/.test(s.slice(x, e))));
  for (const inSpanOk of [false, true]) {
    const sorted = [0, ...[...br].sort((x, y) => x - y), s.length];
    for (let k = 1; k < sorted.length; k++) {
      const lo = sorted[k - 1], hi = sorted[k];
      if (len(lo, hi) <= max || /^\s+$/.test(s.slice(lo, hi))) continue;
      // 分ける所は、句読点のあと・文の組み立ての切れ目(lastGood)を先に選ぶ。無ければ言葉の切れ目(lastOk)
      let start = lo, lastOk = -1, lastGood = -1;
      const pick = () => (lastGood > start ? lastGood : lastOk);
      for (let q = lo + 1; q < hi; q++) {
        if (len(start, q) > max) { const c = pick(); if (c > start) { br.add(c); start = c; } else break; }
        if (okAt(q, inSpanOk)) { lastOk = q; if (/[、。！？!?」』）)]$/.test(s.slice(0, q)) || xmasNovelGramBreak(s, q)) lastGood = q; }
      }
      // 最後の字で初めて枠を超えるとき(「「0時の鐘、なんだか早かったっちー」。」)も分ける
      if (len(start, hi) > max) { const c = pick(); if (c > start) br.add(c); }
    }
  }
  const cuts = [0, ...[...br].sort((a, b) => a - b), s.length];
  const plan = [];
  for (let i = 1; i < cuts.length; i++) {
    const t = s.slice(cuts[i - 1], cuts[i]);
    if (!t) continue;
    if (/^\s+$/.test(t)) plan.push({ t, keep: false, space: true });
    else plan.push({ t, keep: xmasNovelWidth(t) <= max, space: false });
  }
  if (XMAS_NOVEL_PLAN_CACHE.size > 600) XMAS_NOVEL_PLAN_CACHE.clear();
  XMAS_NOVEL_PLAN_CACHE.set(ck, plan);
  return plan;
};
// ==== 改行の位置ここまで ====
const XMAS_NOVEL_NOWRAP = Object.freeze({ whiteSpace: 'nowrap' });
const XMAS_NOVEL_HIDE = Object.freeze({ visibility: 'hidden' });
//  shown: 見せる字の数(文字送り)。省くと全部
const XmasNovelWrap = ({ text, shown, max }) => {
  const plan = xmasNovelWrapPlan(text, max);
  const lim = typeof shown === 'number' && Number.isFinite(shown) ? shown : Infinity;
  let pos = 0;
  return plan.map((p, i) => {
    const a = pos; pos += p.t.length;
    const vis = Math.max(0, Math.min(p.t.length, lim - a));
    const body = vis >= p.t.length ? p.t : (<>{p.t.slice(0, vis)}<span style={XMAS_NOVEL_HIDE}>{p.t.slice(vis)}</span></>);
    const prev = plan[i - 1];
    return (<React.Fragment key={i}>{i > 0 && !p.space && !(prev && prev.space) && <wbr />}{p.keep ? <span data-nv-keep="" style={XMAS_NOVEL_NOWRAP}>{body}</span> : body}</React.Fragment>);
  });
};
// 大きい字の札(章の札・題の札・エンドの札)は1行に入る字が少ないので、枠を小さく(縦 390 で 30px の字は約11字)
const xmasNovelWrap = (text, max) => <XmasNovelWrap text={text} max={max} />;
// ---- 文の置き方(台帳 r1126-052): 台詞・地の文・効果音で分ける ----
//  効果音の帯(台本の「(効果音)」の印 = fx に se): 真ん中寄せ・大きめ・字間をあける。うしろの(説明書き)は小さい2行目に
const xmasNovelIsSeRow = (row) => !!(row && row.t === 'band' && Array.isArray(row.fx) && row.fx.includes('se'));
const xmasNovelSplitSe = (s) => {
  const i = String(s || '').search(/[(（]/);
  if (i < 0) return [String(s || ''), ''];
  return [s.slice(0, i), s.slice(i + 1).replace(/[)）]\s*$/, '')];
};
const XmasNovelSeText = ({ text, shown }) => {
  const [sound, note] = xmasNovelSplitSe(text);
  const vis = Math.max(0, shown);
  return (<>
    {sound && <span className="mh-nv-se-sound"><XmasNovelWrap text={sound} shown={vis} /></span>}
    {note && vis > sound.length && <span className="mh-nv-se-note"><XmasNovelWrap text={note} shown={vis - sound.length - 1} /></span>}
  </>);
};
//  台詞: 「」の中身として出し、2行目からは「の分だけ下げてそろえる(ぶら下げ)。頭の(しぐさ)は小さい前置きの行に。全部が(しぐさ)なら「」を付けない
const xmasNovelSplitLead = (s) => {
  const m = String(s || '').match(/^[(（][^)）]*[)）]/);
  return m ? [m[0], s.slice(m[0].length)] : ['', String(s || '')];
};
const XmasNovelSayText = ({ text, shown }) => {
  const [lead, body] = xmasNovelSplitLead(text);
  const vis = Math.max(0, shown);
  if (!body.trim()) return <span className="mh-nv-say-lead only"><XmasNovelWrap text={text} shown={vis} /></span>;
  const bodyVis = body.slice(0, Math.max(0, vis - lead.length));
  // 「」も文といっしょに置き、まだの字と閉じかっこは見えなくしておく(改行の位置が字送りの途中で動かない・r1126-071)
  return (<>
    {lead && <span className="mh-nv-say-lead"><XmasNovelWrap text={lead} shown={vis} /></span>}
    {(bodyVis || !lead || vis > lead.length) && <span className="mh-nv-say-body"><XmasNovelWrap text={`「${body}」`} shown={vis >= text.length ? Infinity : 1 + bodyVis.length} /></span>}
  </>);
};
const XmasNovelIcon = ({ d, size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" dangerouslySetInnerHTML={{ __html: d }} />
);
const XMAS_NOVEL_ICONS = {
  auto: '<polygon points="6 4 16 12 6 20 6 4"/><line x1="19" y1="5" x2="19" y2="19"/>',
  skip: '<polygon points="4 5 12 12 4 19 4 5"/><polygon points="12 5 20 12 12 19 12 5"/>',
  log: '<line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><circle cx="4" cy="6" r="1"/><circle cx="4" cy="12" r="1"/><circle cx="4" cy="18" r="1"/>',
  book: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/><circle cx="12" cy="10" r="3"/><line x1="14.2" y1="12.2" x2="16.5" y2="14.5"/>',
  map: '<polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21 3 6"/><line x1="9" y1="3" x2="9" y2="18"/><line x1="15" y1="6" x2="15" y2="21"/>',
  menu: '<line x1="4" y1="7" x2="20" y2="7"/><line x1="4" y1="12" x2="20" y2="12"/><line x1="4" y1="17" x2="20" y2="17"/>',
};

// ---- 保存 ----
const xmasNovelLoad = async (script = XMAS_NOVEL_SCRIPT) => {
  try { return xmasNovelNormalize(await storeGet(XMAS_NOVEL_STORAGE_KEY, null, false), script); }
  catch (e) { return xmasNovelNormalize(null, script); }
};
const xmasNovelStore = async (save, script = XMAS_NOVEL_SCRIPT) => {
  try { await storeSet(XMAS_NOVEL_STORAGE_KEY, xmasNovelNormalize(save, script), false); return true; } catch (e) { return false; }
};
// 分岐の地図の読み直し(r1126-102): 新しいキー mh_xmas_novel_route_v1。形は xmasNovelRouteNormalize
const xmasNovelRouteLoad = async (script = XMAS_NOVEL_SCRIPT) => {
  try { return xmasNovelRouteNormalize(await storeGet(XMAS_NOVEL_ROUTE_KEY, null, false), script); }
  catch (e) { return xmasNovelRouteNormalize(null, script); }
};
const xmasNovelRouteStore = async (route, script = XMAS_NOVEL_SCRIPT) => {
  try { await storeSet(XMAS_NOVEL_ROUTE_KEY, xmasNovelRouteNormalize(route, script), false); return true; } catch (e) { return false; }
};
// ほかの画面から読む口: 見たエンディング(日時つき)・一発で当てた数(記録だけ)
const xmasNovelRecordState = async () => {
  const save = await xmasNovelLoad();
  return { endings: save.endings, endAt: save.endAt, count: xmasNovelPerfectCount(XMAS_NOVEL_SCRIPT, save), total: xmasNovelScoreGroups(XMAS_NOVEL_SCRIPT).length };
};
// エンドヒストリーの日時(日本時間 2026/12/03 21:15)
const xmasNovelDateText = (iso) => {
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return '';
  const d = new Date(ms + 9 * 3600000);
  const p2 = (n) => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}/${p2(d.getUTCMonth() + 1)}/${p2(d.getUTCDate())} ${p2(d.getUTCHours())}:${p2(d.getUTCMinutes())}`;
};

// ---- 画面 ----
const XMAS_NOVEL_AUTO_MS = [0, 1800, 1000];
// script … 検査で仮の台本を渡すときだけ(ふだんは渡さない)
const XmasNovelScreen = ({ playerName: playerNameProp = '', onClose, script = null, rankOff = false }) => {
  useXmasNovelCss();
  // 台詞の {name}: 渡されなければブリーダー名を読むだけ(書かない)
  const [playerName, setPlayerName] = useState(playerNameProp);
  useEffect(() => {
    if (playerNameProp) return undefined;
    let alive = true;
    storeGet('mh_breeder_name', '', false).then((n) => { if (alive && typeof n === 'string' && n.trim()) setPlayerName(n.trim().slice(0, 24)); }).catch(() => {});
    return () => { alive = false; };
  }, [playerNameProp]);
  const S = script || XMAS_NOVEL_SCRIPT;
  // ランキング(r1126-107): 開いたときに、ためていた分と、ランキングを入れる前の記録(1回だけ)を送る。待たない・落ちない
  useEffect(() => { if (!rankOff && typeof xmasNovelRankFlush === 'function') void xmasNovelRankFlush(S); }, []);
  const [save, setSave] = useState(null);
  const [mode, setMode] = useState('title'); // title / read / endings / chapters / ranking(r1126-107)
  const [st, setSt] = useState(null); // xmasNovelSettle の結果(いまの行)
  const [reply, setReply] = useState(null); // { list:[行], i, then, q } 問いの返しを読んでいるところ
  const [shown, setShown] = useState(0); // 文字送りで出した字数
  const [fx, setFx] = useState(null); // { kind, n }
  const [curtain, setCurtain] = useState(null);
  const [transit, setTransit] = useState(null); // { dir:'in'|'out', n } 外側⇔ゲームの中の切り替え(画面に吸い込まれる/画面から引く) // 'down'(下りて閉じたまま)/ 'up'(上がっていく)
  const replayRef = useRef(false);
  const lastSceneRef = useRef(null); // エンディングの記録から見返している(進み具合・記録は書かない)
  const [cards, setCards] = useState([]); // 札の並び { kind:'chapter'|'title'|'band'|'ending', ... }。先頭を出す
  const card = cards[0] || null;
  const setCard = (c) => setCards((list) => (c ? [...list, c] : []));
  const [sheet, setSheet] = useState(null); // 'book' / 'log' / 'menu' / { kind:'present'|'person'|'action', q }
  // 選択肢・推理の問い・名指しを待っている間は、柱時計のチク・タクを小さく繰り返す。選ぶ・窓を閉じると止まる(社長「選択肢の待ち時間はチクタクって時計おとが流れる」・r1126-093 追記2)
  useEffect(() => {
    if (!sheet || typeof sheet !== 'object' || !sheet.q) return undefined;
    let high = true;
    const tick = () => { const fn = xmasNovelSeFn('nvTick'); if (fn) fn(high); high = !high; };
    const id = setInterval(tick, 640);
    const first = setTimeout(tick, 250);
    return () => { clearInterval(id); clearTimeout(first); };
  }, [sheet]);
  const [got, setGot] = useState(null); // 手に入れた手がかり { n, d, add }
  const [skip, setSkip] = useState(false);
  const [log, setLog] = useState([]);
  const [confirmNew, setConfirmNew] = useState(false);
  const saveRef = useRef(null);
  const [route, setRoute] = useState(null); // 分岐の地図の読み直し(mh_xmas_novel_route_v1・r1126-102)
  const routeRef = useRef(null);
  const lastBgm = useRef(null);
  const lastChapter = useRef(null);
  const prevBgm = useRef(null);
  const storeTimer = useRef(null);
  const unreadRef = useRef(false); // いまの行が、着く前はまだ読んでいなかったか(既読スキップを止める)
  // 場面の切り替えと人物の登場の演出(台帳 r1126-094)
  const [sw, setSw] = useState(null); // { kind:'place'|'time'|'past'|'open', fast, place, n } 背景が替わった所
  const [figEnter, setFigEnter] = useState(null); // { kind:'first'|'swap'|'face', fast, intro, n } 立ち絵の出かた
  const lastBgRef = useRef(null); // 前の行の背景の名前(null = 読み始め)
  const pendingSwRef = useRef(null); // 章の札を閉じたあとに出す切り替え
  const seenWhoRef = useRef(new Set()); // この読み始めから立ち絵が出た人
  const lastWhoRef = useRef('');
  // 出すタイミング(台帳 r1126-094 追記1): 「文が出る → 一拍 → 演出」。遺体の影は、見つける文のあいだ暗転させ、文が出きってから明けて出す
  const [reveal, setReveal] = useState(null); // { id, stage:'dark'|'show' } 遺体・倒れた影を見つける行
  const pendingFxRef = useRef(null); // 文が出きってから出す演出 { id, vis, bleedAfter, shake }
  const lastBodyRef = useRef('');
  const fireFx = (p) => {
    if (!p) return;
    if (p.bleedAfter) setTimeout(() => setFx({ kind: 'bleed', n: Date.now() }), 380); // 赤く光ってから、にじむ
    setFx(p.vis ? { kind: p.vis, n: Date.now() } : null);
    if (p.shake) xmasNovelQuake(stageRef.current, 2);
  };
  const stageRef = useRef(null);
  const pendingQuakeRef = useRef(0);
  // 大事な選択は「押して選ぶ → 決定で確かめる」(台帳 r1126-113)。{ qid, key, label }
  const [pick, setPick] = useState(null);
  const [panelIntro, setPanelIntro] = useState(null); // { id, fast, done, at } 人物紹介の行
  const [titleOk, setTitleOk] = useState(false); // いまの場面を前に読み終えているか(場面の題を出すか)
  const fxFast = (unread) => !unread || !!(saveRef.current && saveRef.current.auto);
  const fireSw = (v) => {
    if (!v) { setSw(null); return; }
    const n = Date.now();
    setSw({ ...v, n });
    setTimeout(() => setSw((x) => (x && x.n === n ? null : x)), v.fast ? 1500 : 3400);
  };

  useEffect(() => {
    let alive = true;
    try { prevBgm.current = typeof Audio_ !== 'undefined' && Audio_.currentBgmKey ? Audio_.currentBgmKey() : null; } catch (e) { prevBgm.current = null; }
    xmasNovelLoad(S).then((s) => {
      if (!alive) return;
      saveRef.current = s; setSave(s);
      // 分岐の地図の読み直し(r1126-102): 別のキーから読み、地図より前に通った分かれ道は今の保存から1回だけ作る
      xmasNovelRouteLoad(S).then((r) => {
        if (!alive) return;
        const seeded = r.seeded === 1 ? r : xmasNovelRouteSeed(S, s, r);
        routeRef.current = seeded; setRoute(seeded);
        if (seeded !== r) void xmasNovelRouteStore(seeded, S);
      });
    });
    xmasNovelBgm('silence'); // 開いた所(題の画面)は曲なしで、柱時計の環境音(r1126-093 追記3)。前: 呪われた騎士の時計仕掛け。歌の入った Kiss からはじまるミステリーをやめ、柱時計の不穏な曲に(r1126-093)
    return () => { alive = false; xmasNovelSeStop(); if (storeTimer.current) clearTimeout(storeTimer.current); };
  }, []);
  const putRoute = (next) => {
    if (!next) return;
    routeRef.current = next; setRoute(next);
    void xmasNovelRouteStore(next, S);
  };
  // 地図の「↺ ここから読み直す」: 読み直す前の続きを back に逃がしてから(すでにあれば、一番はじめの続きを残す)、その分かれ道の状態で始める
  const redoFrom = (cur) => {
    const r = routeRef.current || xmasNovelRouteNormalize(null, S);
    const now = saveRef.current && saveRef.current.cur;
    putRoute({ ...r, back: r.back || now || null });
    setSheet(null);
    start(cur);
  };
  const backFromRedo = () => {
    const r = routeRef.current;
    if (!r || !r.back) return;
    const b = r.back;
    putRoute({ ...r, back: null });
    setSheet(null);
    start(b);
  };
  // 既読飛ばしの間は帯の1回の音を止める(r1126-093 追記3)
  useEffect(() => { xmasNovelSeQuiet = !!skip; if (skip) xmasNovelSeStop(); }, [skip]);
  // 場所の環境音: 読んでいる場面の背景で決め、題の画面は柱時計。選択肢を待つ間のチクタクとかぶる柱時計は、その間だけ止める。
  //   既読飛ばしで場面がつぎつぎ替わっても重ねないよう、0.35 秒落ち着いてから替える。閉じたら止める
  const ambSceneId = st && st.scene ? st.scene.id : '';
  const ambBg = st && st.scene ? xmasNovelSceneBgName(st.scene, st.cur ? st.cur.idx : 0) : '';
  const ambWait = !!(sheet && typeof sheet === 'object' && sheet.q);
  useEffect(() => {
    let kind = mode === 'read' ? xmasNovelAmbientOf(st && st.scene, ambBg) : mode === 'title' ? 'clock' : 'none';
    if (ambWait && kind === 'clock') kind = 'none';
    const id = setTimeout(() => xmasNovelSetAmbient(kind), 350);
    return () => clearTimeout(id);
  }, [mode, ambSceneId, ambBg, ambWait]);
  useEffect(() => () => { xmasNovelSeQuiet = false; xmasNovelSetAmbient('none'); }, []);
  const persist = (next, now = false) => {
    saveRef.current = next; setSave(next);
    if (replayRef.current) return; // 見返しは保存しない
    if (storeTimer.current) clearTimeout(storeTimer.current);
    if (now) { void xmasNovelStore(next, S); return; }
    storeTimer.current = setTimeout(() => { void xmasNovelStore(saveRef.current, S); }, 400);
  };
  const close = () => {
    if (storeTimer.current) { clearTimeout(storeTimer.current); void xmasNovelStore(saveRef.current, S); }
    try { if (prevBgm.current && typeof Audio_ !== 'undefined') Audio_.playBGM(prevBgm.current); } catch (e) { /* 戻せなくても閉じる */ }
    onClose && onClose();
  };

  // 台詞の {犯人にした人}: いちばんあとの「人を選ぶ」推理で選んだ人の名前
  { const acc = st && st.cur ? xmasNovelAccusedOf(S, st.cur) : null; const c = acc ? xmasNovelCastOf(acc) : null; xmasNovelFillCtx = { accused: c ? c.name : '' }; }
  // いまの行(返しを読んでいる間は返しの行)
  const row = reply ? reply.list[reply.i] : st && st.row;
  const text = row ? xmasNovelFill(row.x, playerName) : '';
  const typing = row && (row.t === 'line' || row.t === 'band') && shown < text.length;

  // 行に着いたとき: 読んだ印・演出・手がかり・ログ
  const arriveRow = (r, base, opts = {}) => {
    if (!r) return base;
    let s = base;
    unreadRef.current = !!(r.k && !s.read.includes(r.k));
    if (r.k && !s.read.includes(r.k)) s = { ...s, read: [...s.read, r.k] };
    if (r.t === 'band' && r.se) xmasNovelRowSe(r.se, r.seN, r); else xmasNovelSeStop();
    if (!opts.quiet && r.t === 'band' && !r.se && XMAS_NOVEL_SE_ROW[r.id]) xmasNovelRowSe(XMAS_NOVEL_SE_ROW[r.id][0], XMAS_NOVEL_SE_ROW[r.id][1], r); // 文に合わせた1回の音(r1126-093 追記3)
    else if (!opts.quiet && !xmasNovelSeQuiet && r.t === 'band' && !r.se && Array.isArray(r.fx) && r.fx.includes('fallen')) xmasNovelSeHit('dread'); // 倒れた人が見つかった帯に、不穏な一音(r1126-093 追記2)
    // 章の札の下で着いた行は、札を閉じてから揺らす(札に隠れて見えなかった)
    pendingQuakeRef.current = 0;
    if (XMAS_NOVEL_SHAKE[r.id] && !skip) { if (opts.held) pendingQuakeRef.current = XMAS_NOVEL_SHAKE[r.id]; else xmasNovelQuake(stageRef.current, XMAS_NOVEL_SHAKE[r.id]); }
    if (r.t === 'band' && Array.isArray(r.fx)) {
      const vis = r.fx.find((f) => ['dark', 'white', 'red', 'light', 'bleed'].includes(f));
      const p = { id: r.id, vis, bleedAfter: r.fx.includes('bleed') && r.fx.includes('red'), shake: r.fx.includes('shake') };
      // 音の行(ドン・ギィ など)と暗転は文と同時。様子を書いた行の赤・にじみ・揺れは、文が出きって一拍おいてから
      if (xmasNovelIsSeRow(r) || vis === 'dark' || skip || (!vis && !p.shake)) { pendingFxRef.current = null; fireFx(p); } else { pendingFxRef.current = p; setFx(null); }
      if (r.fx.includes('curtainDown')) setCurtain('down');
      if (r.fx.includes('curtainUp')) { setCurtain('up'); setTimeout(() => setCurtain((c) => (c === 'up' ? null : c)), 1700); }
      if (r.fx.includes('title') || r.fx.includes('chapter')) { setCard({ kind: r.fx.includes('title') ? 'title' : 'band', text: r.x }); setShown(99999); return s; }
    } else { pendingFxRef.current = null; setFx((f) => (f && f.kind === 'dark' ? null : f)); }
    // 遺体・倒れた影が初めて出る行: 文のあいだは暗転、出きってから明けて出す(同じ人が続く行はそのまま)
    {
      const bodyKey = r.t === 'band' ? (r.body || (Array.isArray(r.fx) && r.fx.includes('fallen') ? `fallen-${r.id}` : '')) : '';
      if (bodyKey && bodyKey !== lastBodyRef.current) setReveal({ id: r.id, stage: skip ? 'show' : 'dark', fast: !unreadRef.current, n: Date.now() });
      else setReveal(null);
      if (bodyKey) lastBodyRef.current = bodyKey; // 台詞をはさんで同じ人の影に戻るときは、暗転させない(場面が替わったら忘れる)
    }
    // 行の曲(台本データ)は、返しの行のときだけここで鳴らす。本筋の行は下の xmasNovelBgmAt(場面の曲の表)が決める(r1126-093)
    if (opts.quiet && r.bgm && (XMAS_NOVEL_VOCAL_BGM[r.bgm] || r.bgm) !== lastBgm.current) { lastBgm.current = XMAS_NOVEL_VOCAL_BGM[r.bgm] || r.bgm; xmasNovelBgm(r.bgm); }
    // 人物紹介(印の付かない「登場人物」の行): 1人ずつ入る。既読・オートは短く、スキップ中はそろった所から
    if (r.t === 'panel' && !r.stamp && /登場人物/.test(String(r.x || ''))) setPanelIntro({ id: r.id, fast: !unreadRef.current || !!(saveRef.current && saveRef.current.auto), done: !!skip, at: Date.now() });
    else if (r.t !== 'panel') setPanelIntro(null);
    if (r.t === 'clue') { setGot({ n: r.clue, d: r.x, add: !!r.add }); xmasNovelSe('clue'); }
    if (r.t === 'line' && r.n === '？？？' && xmasNovelIsLaugh(r)) xmasNovelSe('laugh');
    if (r.t === 'line') {
      // 立ち絵の出かた: その人が初めて出る / 話し手が替わる / 表情だけ替わる。スキップ中は演出なし
      const who = r.n === '？？？' ? '？？？' : (r.w || '');
      const first = !!(who && who !== '？？？' && who !== 'watson' && !seenWhoRef.current.has(who) && xmasNovelFirstLines(S)[who] === r.id);
      if (who) seenWhoRef.current.add(who);
      const kind = first ? 'first' : who !== lastWhoRef.current ? 'swap' : 'face';
      lastWhoRef.current = who;
      setFigEnter(skip ? null : { kind, fast: fxFast(unreadRef.current), intro: first, n: Date.now() });
    } else if (r.t === 'band') lastWhoRef.current = '';
    if (r.t === 'line' || r.t === 'band') setLog((l) => [...l.slice(-299), { who: r.t === 'line' ? xmasNovelNameOf(r) : '', text: xmasNovelFill(r.x, playerName) }]);
    if (r.t === 'q' && !opts.quiet && !opts.held) setSheet({ kind: r.kind, q: r });
    setShown(opts.instant ? 99999 : 0);
    return s;
  };
  // 場所が決まった(settle の結果)。場面の曲・章の札・エンディング・保存
  const arrive = (next, baseSave) => {
    let s = baseSave || saveRef.current;
    setReply(null);
    if (!next.row && next.ending) {
      const scene = next.scene;
      const ending = next.ending;
      // 「選び直す」はエンディングの「次」が問いの行(Q7a)のときだけ。場面(カーテンコール)へは settle が続けて入る
      const after = !replayRef.current && scene && scene.next && !xmasNovelSceneById(S, scene.next) && xmasNovelFindRow(S, scene.next) ? xmasNovelJump(S, next.cur, scene.next) : null;
      if (replayRef.current) { setSt(next); setSkip(false); setSheet(null); setCard({ kind: 'ending', ending, replay: true }); return; }
      const firstTime = !s.endings.includes(ending.id);
      s = { ...xmasNovelRecordEnding(s, ending.id, new Date().toISOString()), cur: after };
      if (typeof xmasNovelRankNote === 'function') xmasNovelRankNote({ k: 'end', id: ending.id }, { off: rankOff, script: S }); // ランキング(r1126-107)。見返すときは通らない
      persist(s, true);
      setSt(next); setSkip(false); setSheet(null);
      setCard({ kind: 'ending', ending, retry: !!after, fresh: firstTime, count: xmasNovelPerfectCount(S, s), total: xmasNovelScoreGroups(S).length });
      return;
    }
    if (!next.row) { persist({ ...s, cur: null }, true); setSt(null); setMode('title'); return; }
    const scene = next.scene;
    let chapterCard = false;
    // 外側(助手たち本人)⇔ゲームの中が切り替わったら、画面に吸い込まれる/画面から引く
    if (lastSceneRef.current !== (scene || null)) { lastBodyRef.current = ''; setTitleOk(xmasNovelSceneDone(scene, s.read)); }
    const transitNow = !!(scene && lastSceneRef.current && !!lastSceneRef.current.outside !== !!scene.outside);
    if (transitNow) { setTransit({ dir: scene.outside ? 'out' : 'in', n: Date.now() }); xmasNovelSe('tap'); }
    // カーテンコールの場面を出たら、下りていた幕を上げる
    if (scene && lastSceneRef.current && lastSceneRef.current.curtain && !scene.curtain) { setCurtain((c) => (c === 'down' ? 'up' : c)); setTimeout(() => setCurtain((c) => (c === 'up' ? null : c)), 1700); }
    lastSceneRef.current = scene || null;
    if (scene && scene.curtain) setCurtain((c) => c || 'down'); // カーテンコールは幕の前(途中から読んでも幕を下ろしておく)
    { const want = xmasNovelBgmAt(scene, next.cur ? next.cur.idx : 0); if (want && want !== lastBgm.current) { lastBgm.current = want; xmasNovelBgm(want); } }
    if (scene && scene.chapter !== lastChapter.current) {
      const ch = xmasNovelChapters(S).find((c) => c.id === scene.chapter);
      const opening = lastChapter.current !== null || next.cur.idx === 0;
      lastChapter.current = scene.chapter;
      if (ch && ch.id !== 'END' && !ch.outside) {
        if (!s.snaps[ch.id] || next.cur.idx === 0) s = { ...s, snaps: { ...s.snaps, [ch.id]: { scene: scene.id, idx: 0, flags: next.cur.flags, clues: next.cur.clues, ans: next.cur.ans, panel: next.cur.panel || {} } } };
        if (opening) { setCard({ kind: 'chapter', label: xmasNovelChapterLabel(ch), title: xmasNovelChapterTitle(S, ch, s.read) }); setSkip(false); chapterCard = true; }
      }
    }
    // 背景が替わった所の切り替え(外側⇔ゲームの中は吸い込まれる演出があるので出さない・章の札のあとは札を閉じてから)
    {
      const bgNow = xmasNovelSceneBgName(scene, next.cur ? next.cur.idx : 0);
      const kind = xmasNovelSwitchKind(lastBgRef.current, bgNow);
      lastBgRef.current = bgNow;
      const unread = !!(next.row && next.row.k && !s.read.includes(next.row.k));
      const bodyRow = !!(next.row && next.row.t === 'band' && (next.row.body || (Array.isArray(next.row.fx) && next.row.fx.includes('fallen'))));
      const v = kind && !skip && !bodyRow ? { kind, fast: fxFast(unread), place: scene && !scene.outside ? xmasNovelPlaceLabel(bgNow) : '' } : null;
      if (chapterCard) { pendingSwRef.current = v ? { ...v, kind: v.kind === 'place' ? 'open' : v.kind } : { kind: 'open', fast: false, place: '' }; fireSw(null); } else if (v && !transitNow) fireSw(v);
    }
    let cur = next.cur;
    let panelChanged = [];
    if (next.row.t === 'clue' || next.row.t === 'flag' || next.row.t === 'panel') {
      cur = xmasNovelApplyRow(cur, next.row);
      if (next.row.t === 'panel') { panelChanged = xmasNovelPanelChanged(next.cur.panel, cur.panel); if (next.row.stamp) xmasNovelSe('impact'); }
    }
    const settled = { ...next, cur, panelChanged };
    if (next.row.t === 'q' && !replayRef.current && routeRef.current) putRoute(xmasNovelRouteRecord(routeRef.current, S, cur)); // 分かれ道の状態(r1126-102)
    s = arriveRow(next.row, { ...s, cur }, { held: chapterCard });
    setSt(settled);
    persist(s);
    // フラグの行は見せずに次へ
    if (next.row.t === 'flag') setTimeout(() => arrive(xmasNovelStep(S, cur)), 0);
  };
  const start = (cur, replay = false) => {
    replayRef.current = replay;
    setCurtain(null); setTransit(null);
    lastBgm.current = null; lastChapter.current = null;
    setLog([]); setCard(null); setSheet(null); setGot(null); setFx(null); setSkip(false);
    lastBgRef.current = null; pendingSwRef.current = null; seenWhoRef.current = new Set(); lastWhoRef.current = ''; setSw(null); setFigEnter(null);
    setReveal(null); pendingFxRef.current = null; lastBodyRef.current = ''; setPanelIntro(null);
    setMode('read');
    arrive(xmasNovelSettle(S, cur));
  };

  // すすめる(タップ・オート・スキップ)
  const advance = () => {
    if (card) {
      if (card.kind === 'ending') return;
      setCards((list) => list.slice(1));
      // 章の札を閉じたら、黒から場面が明ける(既読スキップ中は出さない)
      if (card.kind === 'chapter' && cards.length === 1 && pendingSwRef.current) { const v = pendingSwRef.current; pendingSwRef.current = null; if (!skip) fireSw(v); }
      if (cards.length === 1 && pendingQuakeRef.current) { const lv = pendingQuakeRef.current; pendingQuakeRef.current = 0; if (!skip) setTimeout(() => xmasNovelQuake(stageRef.current, lv), 250); }
      // 題字・帯の札は、その行そのもの。札を閉じたら次の行へ(章の札は行ではないので、閉じるだけ)
      if ((card.kind === 'title' || card.kind === 'band') && cards.length === 1) goNext();
      return;
    }
    goNext();
  };
  const goNext = () => {
    if (sheet || !row) return;
    if (typing) { setShown(text.length); if (sw && !sw.fast) setSw(null); return; }
    if (panelIntro && row && panelIntro.id === row.id && !panelIntro.done && Date.now() - panelIntro.at < (panelIntro.fast ? 900 : 3200)) { setPanelIntro({ ...panelIntro, done: true }); return; } // 人物紹介の途中は、まず全員そろえる
    if (!reply && reveal && row && reveal.id === row.id && reveal.stage === 'dark') { setReveal({ ...reveal, stage: 'show' }); xmasNovelQuake(stageRef.current, 1); return; } // 暗いままで進めない(見つける所を必ず見せる)
    if (got) setGot(null);
    if (reply) {
      if (reply.i + 1 < reply.list.length) {
        const r = reply.list[reply.i + 1];
        const cur = xmasNovelApplyRow(st.cur, r);
        setSt({ ...st, cur });
        setReply({ ...reply, i: reply.i + 1 });
        arriveRow(r, saveRef.current, { quiet: true });
        return;
      }
      finishReply(reply.then, reply.q, st.cur);
      return;
    }
    if (row.t === 'q') { setSheet({ kind: row.kind, q: row }); return; }
    arrive(xmasNovelStep(S, st.cur));
  };
  const finishReply = (then, q, cur) => {
    setReply(null);
    if (then === 'retry') { setSheet({ kind: q.kind, q }); setShown(99999); return; }
    if (then && then.to) { arrive(xmasNovelSettle(S, xmasNovelJump(S, cur, then.to))); return; }
    arrive(xmasNovelStep(S, cur));
  };
  // 答える
  const answer = (q, pick) => {
    setPick(null);
    const res = xmasNovelAnswer(S, st.cur, q, pick, (saveRef.current && saveRef.current.endings) || []);
    let s = saveRef.current;
    if (q.score) {
      if (!(s.first && s.first[q.id]) && typeof xmasNovelRankNote === 'function') xmasNovelRankNote({ k: 'first', id: q.id, ok: !!res.ok }, { off: rankOff, script: S }); // 一番はじめの答えだけ(r1126-107)
      s = xmasNovelRecordFirst(s, q.id, res.ok); xmasNovelSe(res.ok ? 'ok' : 'ng');
    }
    setSheet(null);
    persist({ ...s, cur: res.cur });
    const list = (res.replies || []);
    if (!list.length) { setSt({ ...st, cur: res.cur }); finishReply(res.then, q, res.cur); return; }
    const cur = xmasNovelApplyRow(res.cur, list[0]);
    setSt({ ...st, cur });
    setReply({ list, i: 0, then: res.then, q });
    arriveRow(list[0], saveRef.current, { quiet: true });
  };

  // 文字送り
  useEffect(() => {
    if (!typing) return undefined;
    const id = setTimeout(() => setShown((n) => Math.min(text.length, n + (skip ? 99999 : 2))), skip ? 0 : 38);
    return () => clearTimeout(id);
  }, [typing, shown, text, skip]);
  // 文が出きったら: 一拍おいて遺体の影を明ける / 様子の演出を出す
  const rowKey = row ? row.id : '';
  const revealDark = !!(reveal && reveal.id === rowKey && reveal.stage === 'dark');
  useEffect(() => {
    if (mode !== 'read' || !rowKey || typing) return undefined;
    if (revealDark) {
      const id = setTimeout(() => { setReveal((v) => (v && v.id === rowKey && v.stage === 'dark' ? { ...v, stage: 'show' } : v)); if (!skip) xmasNovelQuake(stageRef.current, 1); }, reveal.fast || skip ? 150 : 700);
      return () => clearTimeout(id);
    }
    const p = pendingFxRef.current;
    if (p && p.id === rowKey) {
      const id = setTimeout(() => { if (pendingFxRef.current === p) { pendingFxRef.current = null; fireFx(p); } }, reveal && reveal.id === rowKey ? 1300 : 300);
      return () => clearTimeout(id);
    }
    return undefined;
  }, [mode, rowKey, typing, revealDark]);
  // オート・スキップ(スキップは読んだ行だけ。まだ読んでいない行・問い・札で止まる)
  const autoLevel = save ? save.auto : 0;
  useEffect(() => {
    if (mode !== 'read' || !row || sheet || typing) return undefined;
    if (card && card.kind === 'ending') return undefined;
    if (revealDark && !skip) return undefined; // 明けるのを待つ
    if (card && !skip) return undefined;
    if (skip) {
      if ((row.t === 'q' && !reply) || (unreadRef.current && !reply)) { setSkip(false); return undefined; }
      const id = setTimeout(() => advance(), card ? 120 : 60);
      return () => clearTimeout(id);
    }
    if (!autoLevel || card || row.t === 'q') return undefined;
    const ms = XMAS_NOVEL_AUTO_MS[autoLevel] + Math.min(2400, text.length * 45);
    const id = setTimeout(() => advance(), ms);
    return () => clearTimeout(id);
  });
  // 既読スキップ: 押した行が既読のときだけ動く(まだ読んでいない行で押しても進まない)
  const toggleSkip = () => { if (skip) { setSkip(false); return; } if (!unreadRef.current || reply) { setSkip(true); setShown(99999); } };

  if (!save) return <div className="mh-nv" data-xmas-novel="loading"><div className="mh-nv-card"><div className="mh-nv-serif mh-nv-gold">読み込み中…</div></div></div>;

  const scene = st && st.scene;
  const bgName = xmasNovelSceneBgName(scene, st && st.cur ? st.cur.idx : 0);
  const bg = xmasNovelBgOf(bgName);
  const chapter = scene ? xmasNovelChapters(S).find((c) => c.id === scene.chapter) : null;
  const clues = (st && st.cur && st.cur.clues) || [];
  const endingsAll = xmasNovelScenes(S).filter((s) => s.ending).map((s) => s.ending);
  const perfectTotal = xmasNovelScoreGroups(S).length;
  const inside = !!(scene && !scene.outside); // ゲームの中の場面(外側は助手たち本人)

  // ---- 起動画面(届いたゲーム)・エンドヒストリー・章 ----
  //  古いゲームの起動画面: 黒地・走査線・ちらつくノイズ・シリーズ名+副題(XMAS_NOVEL_GAME を差し替えて使い回す)
  if (mode !== 'read') {
    const seenCount = endingsAll.filter((e) => save.endings.includes(e.id)).length;
    return (
      <div className="mh-nv mh-nv-boot" data-xmas-novel={mode}>
        <div className="mh-nv-noise" /><div className="mh-nv-scan" />
        <div className="mh-nv-top"><span className="mh-nv-where" /><button type="button" className="mh-nv-btn" data-xmas-novel-close onClick={close} aria-label="閉じる"><X size={18} /></button></div>
        {/* 長い一覧(エンドヒストリー15件など)が上ではみ出さないよう、中央寄せは子の my-auto で(justify-center だと上が切れてスクロールで戻れない) */}
        <div className="absolute inset-0 flex flex-col items-center overflow-y-auto px-4 py-16">
          {mode === 'title' && (
            <div className="relative my-auto w-full max-w-sm text-left" data-xmas-novel-title>
              {/* ホラーの見た目(台帳 r1126-112 追記3): 傷んだ事件ファイルの表紙。後ろに黒いサンタの影がゆっくり寄る */}
              <XmasNovelStalker className="mh-nv-boot-stalker" />
              <div className="mh-hr-tab mh-nv-serif">事件記録　No.13</div>
              <div className="mh-nv-boot-logo mh-hr-folder mh-hr-torn mh-hr-stain" data-xmas-novel-game={XMAS_NOVEL_GAME.series}>
                <div className="mh-nv-serif mh-nv-boot-series mh-hr-flick">{XMAS_NOVEL_GAME.series}</div>
                <div className="mh-nv-serif mh-nv-boot-title">{XMAS_NOVEL_GAME.title}</div>
                <div className="mh-nv-rule" />
                <div className="mh-nv-serif mh-nv-boot-sub">{XMAS_NOVEL_GAME.sub}</div>
                <div className="mh-hr-seal mh-nv-serif" aria-hidden="true">記録</div>
              </div>
              <div className="mh-nv-boot-press mt-5 text-[11px] tracking-[0.3em]">SELECT</div>
              <div className="mt-3 space-y-2.5">
                {(() => {
                  // 目次: 番号・項目・点線・数(押せる大きさは前のまま)
                  const items = [
                    save.cur ? { key: 'continue', label: 'つづきから', attr: { 'data-xmas-novel-continue': '' }, on: () => start(save.cur) } : null,
                    { key: 'new', label: 'はじめから', attr: { 'data-xmas-novel-new': '' }, on: () => (save.cur ? setConfirmNew(true) : start(xmasNovelFreshCur(S))) },
                    { key: 'chapters', label: '章から', attr: { 'data-xmas-novel-chapters': '' }, off: !Object.keys(save.snaps).length, on: () => setMode('chapters') },
                    { key: 'endings', label: 'エンドヒストリー', cnt: `${seenCount} / ${endingsAll.length}`, attr: { 'data-xmas-novel-endings': '' }, on: () => setMode('endings') },
                    typeof XmasNovelRank === 'function' ? { key: 'ranking', label: 'ランキング', attr: { 'data-xmas-novel-ranking': '' }, on: () => setMode('ranking') } : null,
                  ].filter(Boolean);
                  return items.map((it, i) => (
                    <button type="button" key={it.key} className="mh-nv-btn wide mh-nv-serif mh-nv-boot-btn" {...it.attr} disabled={!!it.off} onClick={it.on}>
                      <span className="no">{i + 1}</span><span>{it.label}</span><span className="lead" />{it.cnt ? <span className="cnt">{it.cnt}</span> : null}
                    </button>
                  ));
                })()}
              </div>
              <div data-xmas-novel-perfect className="mt-4 text-[10px] text-slate-400">推理の問い 一発で当てた数 {xmasNovelPerfectCount(S, save)} / {perfectTotal}</div>
              {confirmNew && (
                <div className="mh-nv-sheet" onClick={() => setConfirmNew(false)}>
                  <div className="mh-nv-panel mb-auto mt-auto max-w-sm text-center" onClick={(e) => e.stopPropagation()}>
                    <div className="mh-nv-serif mh-nv-gold mb-2 text-[17px] font-black">はじめから遊びますか？</div>
                    <p className="mh-nv-plain mb-3 text-[12px] leading-relaxed text-slate-200">{xmasNovelWrap('いまの続きの場所は消えます。エンドヒストリー・一発で当てた記録・読んだ印はそのまま残ります')}</p>
                    <div className="space-y-2">
                      <button type="button" className="mh-nv-btn wide" data-xmas-novel-new-ok onClick={() => { setConfirmNew(false); start(xmasNovelFreshCur(S)); }}>はじめから</button>
                      <button type="button" className="mh-nv-btn wide" onClick={() => setConfirmNew(false)}>やめる</button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
          {mode === 'ranking' && typeof XmasNovelRank === 'function' && <XmasNovelRank script={S} off={rankOff} onBack={() => setMode('title')} />}
          {mode === 'endings' && (
            <div className="my-auto w-full max-w-md" data-xmas-novel-ending-list>
              <div className="mh-nv-serif mh-nv-gold text-center text-[22px] font-black tracking-widest">エンドヒストリー</div>
              <div className="mh-nv-rule" />
              <ul className="space-y-2">
                {endingsAll.map((e) => {
                  const seen = save.endings.includes(e.id);
                  const kind = { ...(XMAS_NOVEL_ENDING_KINDS[e.kind] || XMAS_NOVEL_ENDING_KINDS.normal), ...(e.label ? { label: e.label } : {}) };
                  const at = save.endAt && save.endAt[e.id];
                  return (
                    <li key={e.id} data-xmas-novel-ending={e.id} data-seen={seen ? '' : undefined} className="mh-nv-clue mh-nv-history" style={seen ? { boxShadow: `0 0 0 1px ${kind.tone}` } : undefined}>
                      <div className="flex items-center gap-2">
                        <span className="mh-nv-serif shrink-0 rounded px-2 py-0.5 text-[10px] font-black" style={{ color: '#0a0f20', background: seen ? kind.tone : '#3a4466' }}>{seen ? kind.label : '？？？'}</span>
                        {seen && at && <span className="ml-auto text-[10px] font-bold text-slate-300" data-xmas-novel-ending-at>{xmasNovelDateText(at)}</span>}
                      </div>
                      <div className="mh-nv-serif mt-1 text-[17px] font-black leading-snug" style={{ color: seen ? kind.tone : '#5b6585' }}>{seen ? xmasNovelWrap(`「${e.name}」`) : '？？？'}</div>
                      {seen && <button type="button" className="mh-nv-btn mt-2" data-xmas-novel-replay={e.id}
                        onClick={() => start({ ...xmasNovelFreshCur(S), scene: e.id, idx: 0 }, true)}>見返す</button>}
                    </li>
                  );
                })}
              </ul>
              <button type="button" className="mh-nv-btn wide mt-4" onClick={() => setMode('title')}>戻る</button>
            </div>
          )}
          {mode === 'chapters' && (
            <div className="my-auto w-full max-w-md" data-xmas-novel-chapter-list>
              <div className="mh-nv-serif mh-nv-gold text-center text-[22px] font-black">章から</div>
              <p className="mh-nv-plain mt-1 text-[11px] text-slate-300">{xmasNovelWrap('その章に入ったときの手がかりと選んだことから、読み直せます')}</p>
              <div className="mh-nv-rule" />
              <ul className="space-y-2">
                {xmasNovelChapters(S).filter((c) => c.id !== 'END' && !c.outside).map((c) => {
                  // 過去編は、真グッドを見たら開く(はじめの場面から読む・r1126-046)
                  const pastFirst = c.past ? xmasNovelScenes(S).find((x) => x.chapter === c.id) : null;
                  const snap = c.past ? (save.endings.includes('END-G') && pastFirst ? { ...xmasNovelFreshCur(S), scene: pastFirst.id } : null) : save.snaps[c.id];
                  return (
                    <li key={c.id}>
                      <button type="button" data-xmas-novel-chapter={c.id} disabled={!snap} className="mh-nv-clue flex items-center gap-3 disabled:opacity-40"
                        onClick={() => snap && start({ ...snap, idx: 0 })}>
                        <span className="mh-nv-serif mh-nv-gold w-14 shrink-0 text-[14px] font-black">{xmasNovelChapterLabel(c)}</span>
                        <span className="mh-nv-serif min-w-0 flex-1 truncate text-[15px] font-black">{snap ? xmasNovelChapterTitle(S, c, save.read) : '？？？'}</span>
                        {snap ? <ChevronRight size={16} className="text-amber-200" /> : <Lock size={14} />}
                      </button>
                    </li>
                  );
                })}
              </ul>
              <button type="button" className="mh-nv-btn wide mt-4" onClick={() => setMode('title')}>戻る</button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ---- 読む画面 ----
  const isBand = row && row.t === 'band';
  const isLine = row && row.t === 'line';
  const darkNow = fx && fx.kind === 'dark';
  const name = isLine ? xmasNovelNameOf(row) : '';
  const q = sheet && typeof sheet === 'object' ? sheet.q : null;
  // 大事な選択(人を名指し・手がかりを突きつける・一発で当てる/やり直せない行動)は、押すと選んだ状態になり、下の「決定」で確かめる(台帳 r1126-113)
  const picked = pick && q && pick.qid === q.id ? pick : null;
  const choose = (key, label) => setPick({ qid: q.id, key, label });
  const decideBar = (verb) => (
    <div className="mh-nv-decide" data-xmas-novel-decide-bar>
      <div className="mh-nv-decide-what mh-nv-serif">{picked ? `「${picked.label}」${verb}` : '選んでから、決定を押そう'}</div>
      <button type="button" className="mh-nv-btn wide mh-nv-serif" data-xmas-novel-decide disabled={!picked} onClick={() => { if (picked) answer(q, picked.key); }}>決定</button>
    </div>
  );
  const presentList = q && q.kind === 'present' ? xmasNovelPresentable(q, clues) : clues; // 候補を絞る問い(r1126-099 追記1)
  return (
    <div className="mh-nv" data-xmas-novel="read" data-scene={scene ? scene.id : ''} data-row={row ? row.id : ''}>
      <div ref={stageRef} className="mh-nv-stage" onClick={advance}>
        <div className={`mh-nv-bg${sw ? ` in-${sw.kind}${sw.fast ? ' fast' : ''}` : ''}`} key={bgName || (scene ? scene.id : 'bg')} data-xmas-novel-bg={bg.tintKind || ''} style={bg.img ? { backgroundImage: `${bg.tint ? `${bg.tint}, ` : ''}url(${bg.img})`, backgroundPosition: bg.pos || 'center' } : { background: bg.grad }} />
        {(bg.snow || !bg.img) && <><div className="mh-nv-snow" />{bg.snow && <div className="mh-nv-snow b" />}</>}
        {!darkNow && (isLine || (isBand && xmasNovelIsSilhouette(row))) && <XmasNovelFigure row={row} scene={scene} enter={isLine ? figEnter : null} />}
        {sw && <div key={`sw-${sw.n}`} className={`mh-nv-sw ${sw.kind}${sw.fast ? ' fast' : ''}`} data-xmas-novel-switch={sw.kind} />}
        {sw && sw.place && <div key={`place-${sw.n}`} className={`mh-nv-place mh-nv-serif${sw.kind === 'past' ? ' past' : ''}${sw.fast ? ' fast' : ''}`} data-xmas-novel-place>{sw.place}</div>}
        {isBand && row.body && !revealDark && <XmasNovelBody key={`body-${row.body}`} bg={bg} who={xmasNovelBodyWho(row.body, st && st.cur && st.cur.flags)} scene={scene ? scene.id : ''} at={st && st.cur && Number.isFinite(st.cur.idx) ? st.cur.idx : 0} noBlood={!!row.noBlood} />}
        {isBand && !row.body && !revealDark && Array.isArray(row.fx) && row.fx.includes('fallen') && <XmasNovelFallen />}
        {reveal && reveal.id === rowKey && <div key={`veil-${reveal.n}`} className={`mh-nv-veil ${reveal.stage}${reveal.fast ? ' fast' : ''}`} data-xmas-novel-veil={reveal.stage} />}
        {fx && <div key={fx.n} className={`mh-nv-fx ${fx.kind}`} />}
        {isBand && Array.isArray(row.fx) && row.fx.includes('letter') && <div key={`letter-${row.id}`} className="mh-nv-letter mh-nv-serif" data-xmas-novel-letter>{String(text).replace(/／/g, '\n')}</div>}
        {inside && <div className="mh-nv-crt" data-xmas-novel-inside />}
        {transit && <div key={transit.n} className="mh-nv-transit" data-dir={transit.dir} data-xmas-novel-transit={transit.dir} onAnimationEnd={(e) => { if (e.target === e.currentTarget) setTransit(null); }}><div className="scr" /><div className="mh-nv-noise" /><div className="mh-nv-scan" /></div>}
        {curtain && <div key={`curtain-${curtain}`} className="mh-nv-curtain" data-st={curtain} data-xmas-novel-curtain={curtain} />}
        {scene && scene.curtain && curtain === 'down' && !(row && row.t === 'panel') && (
          <div className="mh-nv-panelwrap" data-xmas-novel-lineup>
            <div className="mh-nv-panelin"><XmasNovelCast states={{}} big /></div>
          </div>
        )}
        {row && row.t === 'panel' && (
          <div className="mh-nv-panelwrap">
            {/* 人物紹介(「登場人物 12人」の行・台帳 r1126-094 追記4): まん中に、1人ずつ影から浮かんで名前と入り、最後に全員がそろって光る。タップで全員そろった所へ */}
            <div key={`panel-${row.id}`} className={`mh-nv-panelin mh-nv-panelbox${panelIntro && panelIntro.id === row.id ? ` intro${panelIntro.fast ? ' fast' : ''}${panelIntro.done ? ' done' : ''}` : ''}`} data-xmas-novel-panel data-xmas-novel-intro-panel={panelIntro && panelIntro.id === row.id ? (panelIntro.done ? 'done' : 'play') : undefined}>
              <div className="mh-nv-panelhead mh-nv-serif mh-nv-gold">登場人物</div>
              <div className="mh-nv-panelrule" />
              <XmasNovelCast states={xmasNovelPanelStates(st && st.cur && st.cur.panel, row)} changed={(st && st.panelChanged) || []} big />
            </div>
          </div>
        )}
        {(isLine || isBand || (row && (row.t === 'clue' || row.t === 'panel' || row.t === 'q'))) && !(card && card.kind !== 'band') && (
          <div className="mh-nv-box" style={{ zIndex: 5 }} data-xmas-novel-box>
            {name && <div className="mh-nv-name mh-nv-serif">{name}</div>}
            <div className={`mh-nv-text${isBand ? (xmasNovelIsSeRow(row) ? ' se mh-nv-serif' : ` band mh-nv-serif${Array.isArray(row.fx) && row.fx.includes('letter') ? ' letter' : ''}`) : ''}${isLine ? ' say' : ''}`} data-xmas-novel-text data-xmas-novel-kind={isBand ? (xmasNovelIsSeRow(row) ? 'se' : 'band') : isLine ? 'line' : row.t}>
              {row.t === 'clue' ? xmasNovelWrap(`手がかり帳に「${row.clue}」を書きとめた`)
                : row.t === 'panel' ? xmasNovelWrap(row.x || (row.stamp ? '……' : '登場人物'))
                : row.t === 'q' ? xmasNovelWrap(xmasNovelFill(row.x, playerName))
                : isBand && xmasNovelIsSeRow(row) ? <XmasNovelSeText text={text} shown={shown} />
                : isLine ? <XmasNovelSayText text={text} shown={shown} />
                : isBand && Array.isArray(row.fx) && row.fx.includes('letter') ? <XmasNovelWrap text={text.replace(/／/g, '　')} shown={shown} />
                : <XmasNovelWrap text={text} shown={shown} />}
            </div>
            {isLine && row.note && !typing && <div className="mh-nv-note">({row.note})</div>}
            {!typing && row.t !== 'q' && <span className="mh-nv-next" />}
          </div>
        )}
      </div>
      <div className="mh-nv-top">
        <span className="mh-nv-where mh-nv-serif" data-xmas-novel-where>{/* エンドの場面のあいだは章名だけ(場面名がエンド名を先に明かす・台帳 r1126-087「結末まで伏せる」) */}{/* 場面の題は、その場面を1度読み終えてから(先の展開が題で分かる・台帳 r1126-094 追記3)。章の題も先が分かる物は伏せる */}{(() => {
          const chTitle = chapter && !chapter.outside ? xmasNovelChapterTitle(S, chapter, save.read) : '';
          const showScene = !!(titleOk && scene && scene.title && !(scene.ending || (chapter && chapter.id === 'END') || /^END-/.test(String(scene.next || ''))));
          return <>{chapter && !chapter.outside ? <span className="ch">{`${xmasNovelChapterLabel(chapter)}${chTitle ? `　${chTitle}` : ''}`}{showScene ? <span className="sep">　/　</span> : null}</span> : null}{showScene ? <span className="sc">{scene.title}</span> : null}</>;
        })()}</span>
        <button type="button" className="mh-nv-btn" data-xmas-novel-open-book onClick={() => setSheet('book')} aria-label="手がかり帳"><XmasNovelIcon d={XMAS_NOVEL_ICONS.book} /><span className="hidden sm:inline">手がかり帳</span><b className="text-[11px]">{clues.length}</b></button>
        <button type="button" className="mh-nv-btn" data-xmas-novel-log onClick={() => setSheet('log')} aria-label="ログ"><XmasNovelIcon d={XMAS_NOVEL_ICONS.log} /><span className="hidden sm:inline">ログ</span></button>
        <button type="button" className="mh-nv-btn" data-xmas-novel-auto data-on={autoLevel ? '' : undefined} onClick={() => persist({ ...saveRef.current, auto: (autoLevel + 1) % 3 }, true)} aria-label="オート">
          <XmasNovelIcon d={XMAS_NOVEL_ICONS.auto} /><span>{autoLevel === 2 ? 'はやい' : 'オート'}</span>
        </button>
        <button type="button" className="mh-nv-btn" data-xmas-novel-skip data-on={skip ? '' : undefined} onClick={toggleSkip} aria-label="既読スキップ"><XmasNovelIcon d={XMAS_NOVEL_ICONS.skip} /><span className="hidden sm:inline">スキップ</span></button>
        <button type="button" className="mh-nv-btn" data-xmas-novel-open-map onClick={() => setSheet('map')} aria-label="地図"><XmasNovelIcon d={XMAS_NOVEL_ICONS.map} /><span>地図</span></button>
        <button type="button" className="mh-nv-btn" data-xmas-novel-menu onClick={() => setSheet('menu')} aria-label="メニュー"><XmasNovelIcon d={XMAS_NOVEL_ICONS.menu} /></button>
      </div>

      {got && (
        <div className="mh-nv-get" data-xmas-novel-got={got.n} onClick={() => setGot(null)}>
          <div className="text-[11px] font-black tracking-widest text-amber-200">{got.add ? '手がかり帳に書き足した' : '手がかりを手に入れた'}</div>
          <div className="mh-nv-serif mh-nv-gold mt-1 text-[20px] font-black">【{got.n}】</div>
          <p className="mh-nv-plain mt-1 whitespace-pre-wrap text-[12px] leading-relaxed text-slate-100">{xmasNovelWrap(got.d)}</p>
        </div>
      )}

      {card && (
        <div key={`card-${card.kind}-${card.label || card.text || ''}`} className={`mh-nv-card${card.kind !== 'ending' ? ' open' : ''}`} data-xmas-novel-card={card.kind} onClick={advance}>
          {card.kind === 'chapter' && card.label && <div className="mh-nv-card-ghost mh-nv-serif" aria-hidden="true">{card.label}</div>}
          {card.kind === 'chapter' && <XmasNovelStalker className="mh-nv-card-stalker" eyes={false} />}
          {card.kind === 'chapter' && (<div className="mh-nv-plain mh-nv-cardtext">
            <div className="mh-nv-card-label mh-nv-serif text-[15px] tracking-[0.5em] text-slate-200">{card.label}</div>
            <div className="mh-nv-rule" />
            <div className="mh-nv-card-title mh-hr-flick mh-nv-serif mh-nv-gold text-[30px] font-black leading-tight sm:text-[38px]">{xmasNovelWrap(card.title, 10)}</div>
            <div className="mh-nv-rule" />
            <div className="mh-nv-card-hint mt-6 text-[11px] text-slate-400">タップで進む</div>
          </div>)}
          {(card.kind === 'title' || card.kind === 'band') && (<div className="mh-nv-plain mh-nv-cardtext">
            <div className="mh-nv-rule" />
            <div className="mh-nv-card-title mh-nv-serif mh-nv-gold text-[30px] font-black leading-tight sm:text-[40px]">{xmasNovelWrap(card.text, 10)}</div>
            <div className="mh-nv-rule" />
          </div>)}
          {card.kind === 'ending' && (() => {
            const kind = { ...(XMAS_NOVEL_ENDING_KINDS[card.ending.kind] || XMAS_NOVEL_ENDING_KINDS.normal), ...(card.ending.label ? { label: card.ending.label } : {}) };
            return (
              <div className={`w-full max-w-sm${card.ending.kind === 'forced' ? ' mh-nv-gameover' : ''}`} data-xmas-novel-ending-card={card.ending.id}>
                <div className="mh-hr-drips" aria-hidden="true">{[[8, 120, 0], [26, 70, .8], [74, 160, 2], [90, 60, 1.2]].map(([x, hgt, d]) => <span key={x} className="mh-hr-drip" style={{ left: `${x}%`, height: hgt, animationDelay: `${d}s` }} />)}</div>
                <div className="mh-hr-stamp mh-nv-serif" data-xmas-novel-stamp>記録終了</div>
                {card.ending.kind === 'forced' && <div className="mh-nv-gameover-title" data-xmas-novel-gameover>GAME OVER</div>}
                <div className="mh-nv-serif text-[13px] tracking-[0.4em]" style={{ color: kind.tone }}>{/エンド$/.test(kind.label) ? kind.label : `${kind.label} END`}</div>
                <div className="mh-nv-rule" />
                <div className={`mh-nv-serif text-[28px] font-black leading-tight ${card.ending.kind === 'forced' ? 'mh-nv-red' : 'mh-nv-gold'}`}>{xmasNovelWrap(`「${card.ending.name}」`, 10)}</div>
                <div className="mh-nv-rule" />
                {!card.replay && <div className="text-[12px] text-slate-200">{card.fresh ? 'エンドヒストリーに記録しました' : 'エンドヒストリーに記録ずみ'}</div>}
                {!card.replay && <div className="mt-1 text-[11px] text-slate-300">推理の問い 一発で当てた数 {card.count} / {card.total}</div>}
                {!card.replay && card.ending.id === 'END-G' && xmasNovelChapters(S).some((c) => c.past) && <div className="mh-nv-serif mh-nv-gold mt-3 text-[13px] font-black" data-xmas-novel-past-open style={JA_LABEL_STYLE}>{jaWrap('過去編「12年前の聖夜」が、「章から」で読めるようになりました')}</div>}
                <div className="mt-5 space-y-2">
                  {card.retry && <button type="button" className="mh-nv-btn wide mh-nv-serif" data-xmas-novel-retry onClick={() => { setCard(null); start(saveRef.current.cur); }}>{card.ending && card.ending.kind === 'forced' ? '選択の直前からやり直す' : '選び直す'}</button>}
                  {card.replay
                    ? <button type="button" className="mh-nv-btn wide mh-nv-serif" data-xmas-novel-to-endings onClick={() => { setCard(null); setSt(null); replayRef.current = false; xmasNovelLoad(S).then((v) => { saveRef.current = v; setSave(v); }); setMode('endings'); }}>エンドヒストリーへ</button>
                    : <button type="button" className="mh-nv-btn wide mh-nv-serif" data-xmas-novel-to-title onClick={() => { setCard(null); setSt(null); setMode('title'); }}>タイトルへ</button>}
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {sheet === 'map' && save && (
        <XmasNovelMap script={S} save={save} route={route} playerName={playerName} onRedo={redoFrom} onBack={backFromRedo} onClose={() => setSheet(null)} />
      )}
      {sheet && sheet !== 'map' && (
        <div className="mh-nv-sheet" data-xmas-novel-sheet={typeof sheet === 'string' ? sheet : sheet.kind}
          onClick={() => { if (typeof sheet === 'string') setSheet(null); }}>
          {q && <XmasNovelStalker className="mh-nv-sheet-stalker" />}
          <div className="mh-nv-panel" onClick={(e) => e.stopPropagation()}>
            {sheet === 'log' && (<>
              <div className="mh-nv-serif mh-nv-gold mb-2 text-[18px] font-black">ログ</div>
              <div className="mh-nv-scroll flex-1 space-y-2 pr-1" ref={(el) => { if (el) el.scrollTop = el.scrollHeight; }}>
                {log.length ? log.map((l, i) => (
                  <div key={i} className="text-[13px] leading-relaxed">
                    {l.who && <div className="mh-nv-serif text-[11px] font-black text-amber-200">{l.who}</div>}
                    <div className={`mh-nv-plain ${l.who ? 'text-slate-100' : 'text-slate-300'}`}>{xmasNovelWrap(l.text)}</div>
                  </div>
                )) : <div className="text-[12px] text-slate-400">まだありません</div>}
              </div>
              <button type="button" className="mh-nv-btn wide mt-3" onClick={() => setSheet(null)}>閉じる</button>
            </>)}
            {(sheet === 'book' || (q && q.kind === 'present')) && (<>
              <div className="mh-nv-serif mh-nv-gold text-[18px] font-black">手がかり帳 <span className="text-[12px] text-slate-300">{presentList.length}個</span></div>
              {q && <div data-xmas-novel-question={q.id} className="mh-nv-q mt-2 rounded-lg p-2 text-[13px] font-bold leading-relaxed" style={{ background: 'rgba(120,20,30,.35)', boxShadow: '0 0 0 1px rgba(232,120,120,.6)' }}>
                {q.label && <div className="mh-nv-serif text-[11px] font-black text-rose-200">{q.label}</div>}
                {xmasNovelWrap(xmasNovelFill(q.x, playerName))}
                <div className="mt-1 text-[11px] text-rose-100">{presentList.length < clues.length ? `候補を${presentList.length}つに絞った。突きつける手がかりを1つ選ぼう` : '突きつける手がかりを1つ選ぼう'}</div>
                {q.pass && <div data-xmas-novel-pass className="mh-nv-plain mt-1 text-[11px] text-rose-200">外しても、仲間が拾って話は進む。一発で当てると成績に残る</div>}
              </div>}
              <div className="mh-nv-scroll mt-2 flex-1 space-y-2 pr-1">
                {presentList.length ? presentList.map((c) => (
                  <div key={c.n} className="mh-nv-clue" data-xmas-novel-clue={c.n} data-pick={picked && picked.key === c.n ? '' : undefined}>
                    <div className="flex items-center gap-2">
                      <div className="mh-nv-serif mh-nv-gold min-w-0 flex-1 text-[15px] font-black">【{c.n}】</div>
                      {q && <button type="button" className="mh-nv-btn shrink-0" data-xmas-novel-present={c.n} data-on={picked && picked.key === c.n ? '' : undefined} aria-pressed={!!(picked && picked.key === c.n)} onClick={() => choose(c.n, c.n)}>{picked && picked.key === c.n ? '選んだ' : 'これを選ぶ'}</button>}
                    </div>
                    <p className="mh-nv-plain mt-1 whitespace-pre-wrap text-[12px] leading-relaxed text-slate-200">{xmasNovelWrap(c.d)}</p>
                  </div>
                )) : <div className="text-[12px] text-slate-400">まだ手がかりはありません</div>}
              </div>
              {!q && <button type="button" className="mh-nv-btn wide mt-3" onClick={() => setSheet(null)}>閉じる</button>}
              {q && decideBar('を突きつける')}
              {q && <button type="button" className="mh-nv-btn wide mt-2" onClick={() => { setPick(null); setSheet(null); }}>話をもう1度見る</button>}
            </>)}
            {q && q.kind === 'person' && (<>
              <div data-xmas-novel-question={q.id} className="mh-nv-q mb-3 rounded-lg p-2 text-[13px] font-bold leading-relaxed" style={{ background: 'rgba(120,20,30,.35)', boxShadow: '0 0 0 1px rgba(232,120,120,.6)' }}>
                {q.label && <div className="mh-nv-serif text-[11px] font-black text-rose-200">{q.label}</div>}
                {xmasNovelWrap(xmasNovelFill(q.x, playerName))}
              </div>
              <div className="mh-nv-scroll"><XmasNovelCast picked={picked ? picked.key : ''} onPick={(id) => { const c = xmasNovelCastOf(id); choose(id, c ? c.name : id); }} /></div>
              {(q.extra || []).map((x) => (
                <button type="button" key={x.key} className="mh-nv-choice mh-nv-serif mt-2" data-xmas-novel-extra={x.key} data-pick={picked && picked.key === x.key ? '' : undefined} aria-pressed={!!(picked && picked.key === x.key)} onClick={() => choose(x.key, String(x.x || '').replace(/[「」]/g, ''))}>{xmasNovelWrap(x.x)}</button>
              ))}
              {q.once && <div className="mh-nv-plain mt-2 text-[11px] font-bold text-rose-200">決定したら、やり直しはできません</div>}
              {decideBar(q.extra && q.extra.some((x) => picked && picked.key === x.key) ? 'に決める' : 'を名指しする')}
              <button type="button" className="mh-nv-btn wide mt-2" onClick={() => { setPick(null); setSheet(null); }}>話をもう1度見る</button>
            </>)}
            {q && q.kind === 'action' && (<>
              <div data-xmas-novel-question={q.id} className="mh-nv-plain mh-nv-serif mh-nv-gold mb-3 text-[17px] font-black">{xmasNovelWrap(xmasNovelFill(q.x, playerName))}</div>
              <div className="space-y-2.5">
                {xmasNovelOptionsOf(q, xmasNovelCtx(S, st.cur, save.endings)).map((o) => {
                  // 一度見た強制バッドの選択肢には「見たエンド」の印(r1126-099 追記1)
                  const endAhead = !q.once && o.to ? xmasNovelEndingAhead(S, o.to) : null;
                  const seenEnd = endAhead && Array.isArray(save.endings) && save.endings.includes(endAhead) ? xmasNovelSceneById(S, endAhead) : null;
                  return (
                    <button type="button" key={o.i} className="mh-nv-choice mh-nv-serif" data-xmas-novel-option={o.i} data-pick={picked && picked.key === o.i ? '' : undefined} aria-pressed={!!(picked && picked.key === o.i)}
                      onClick={() => (q.score || q.once ? choose(o.i, xmasNovelFill(o.x, playerName)) : answer(q, o.i))}>
                      {xmasNovelWrap(xmasNovelFill(o.x, playerName))}
                      {seenEnd && <span data-xmas-novel-seen-end={endAhead} className="mh-nv-plain mt-1 block text-[11px] font-bold text-rose-200">見たエンド: {seenEnd.ending && seenEnd.ending.name ? `「${seenEnd.ending.name}」` : 'バッドエンド'}</span>}
                    </button>
                  );
                })}
              </div>
              {q.once && <div className="mh-nv-plain mt-2 text-[11px] font-bold text-rose-200">決定したら、やり直しはできません</div>}
              {(q.score || q.once) && decideBar('に決める')}
            </>)}
            {sheet === 'menu' && (<>
              <div className="mh-nv-serif mh-nv-gold mb-3 text-center text-[18px] font-black">メニュー</div>
              <div className="space-y-2">
                <button type="button" className="mh-nv-btn wide" onClick={() => setSheet(null)}>続きを読む</button>
                <button type="button" className="mh-nv-btn wide" data-xmas-novel-menu-title onClick={() => { setSheet(null); persist(saveRef.current, true); setSt(null); setMode('title'); }}>タイトルへ(続きは残ります)</button>
                <button type="button" className="mh-nv-btn wide" data-xmas-novel-menu-close onClick={close}>閉じる(続きは残ります)</button>
              </div>
            </>)}
          </div>
        </div>
      )}
    </div>
  );
};

// ---- 入口(イベントページの物語タブなどから呼ぶ関数1つ) ----
//  App の画面の上に重ねて開く。2回呼んでも1つだけ。閉じたら片づけて opts.onClose を呼ぶ
let xmasNovelHost = null;
// 開いているか・最後に人が触れた時刻(r1126-072)。App はこれを見て、裏クイックを3倍にする・事件簿の曲を触らない。
//   触れた = 人の操作(タップ・キー・ホイール。isTrusted)だけ。オート送り・スキップで勝手に進むあいだは数えない。保存はしない
const xmasNovelPresence = { open: false, touchedAt: 0 };
const XMAS_NOVEL_PRESENCE_EVENT = 'mh-xmas-novel-presence';
const xmasNovelPresenceEmit = () => {
  try { if (typeof window !== 'undefined') window.dispatchEvent(new Event(XMAS_NOVEL_PRESENCE_EVENT)); } catch (e) { /* 知らせられなくても読み進める */ }
};
const openXmasNovel = (opts = {}) => {
  if (typeof document === 'undefined' || typeof ReactDOM === 'undefined' || !ReactDOM.createRoot) return false;
  if (xmasNovelHost) return true;
  if (!opts.force && !xmasNovelPlayableAt(Date.now())) return false; // 期間の外は開かない(記録は残る)
  const el = document.createElement('div');
  el.setAttribute('data-xmas-novel-host', '');
  document.body.appendChild(el);
  const root = ReactDOM.createRoot(el);
  const touch = (e) => { if (e && e.isTrusted) xmasNovelPresence.touchedAt = Date.now(); };
  const TOUCH_EVENTS = ['pointerdown', 'keydown', 'wheel'];
  TOUCH_EVENTS.forEach((t) => { try { document.addEventListener(t, touch, { capture: true, passive: true }); } catch (e) { /* 数えられなくても読める */ } });
  xmasNovelHost = { el, root };
  xmasNovelPresence.open = true; xmasNovelPresence.touchedAt = Date.now();
  xmasNovelPresenceEmit();
  const done = () => {
    const h = xmasNovelHost; xmasNovelHost = null;
    TOUCH_EVENTS.forEach((t) => { try { document.removeEventListener(t, touch, { capture: true }); } catch (e) { /* 同上 */ } });
    xmasNovelPresence.open = false;
    xmasNovelPresenceEmit();
    setTimeout(() => { try { h.root.unmount(); } catch (e) { /* 片づけに失敗しても画面は消す */ } try { h.el.remove(); } catch (e) { /* 同上 */ } }, 0);
    try { opts.onClose && opts.onClose(); } catch (e) { /* 呼び出し元の失敗は持ちこまない */ }
  };
  root.render(<XmasNovelScreen playerName={opts.playerName || ''} onClose={done} script={opts.script || null} rankOff={!!opts.force} />);
  return true;
};

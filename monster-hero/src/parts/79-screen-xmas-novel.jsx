// ===== クリスマスのミステリーノベル「聖夜の名探偵」の再生画面(台帳 r1126-022) =====
// 進め方の計算は 79-xmas-novel-engine.jsx、台本のデータは 79-xmas-novel-script.jsx(tools/novel/xmas-novel-build.js が SCRIPT.md から作る)。
// 入口は openXmasNovel(opts) の関数1つ(イベントページの物語タブなどから呼ぶ)。App の状態は使わず、自分で body に重ねて開き、閉じたら片づける。
//   opts.playerName … 台詞の {name} に入れる名前 / opts.onClose() … 閉じたあと / opts.onPerfect(info) … 推理の問いを全部一発で当てたとき(称号の受け渡し口)。
//     onPerfect が true を返したら「渡した」と保存して、2回目からは呼ばない
// 保存は新しいキー mh_xmas_novel_v1 だけ(ほかのキーは読まない・書かない・⑦)。形は xmasNovelNormalize。
// 見た目: 暗めの紺と雪・金の細い縁・明朝寄りの見出し。縦・横・タブレットで、立ち絵と文の箱の置き方を変える。動きは prefers-reduced-motion で止める

const XMAS_NOVEL_CSS = `
.mh-nv { position: fixed; inset: 0; z-index: 140; background: #02050d; color: #eef2ff; overflow: hidden; user-select: none; -webkit-user-select: none;
  font-family: 'Hiragino Kaku Gothic ProN', 'Noto Sans JP', sans-serif; -webkit-tap-highlight-color: transparent; }
.mh-nv-serif { font-family: 'Hiragino Mincho ProN', 'Yu Mincho', 'YuMincho', 'Noto Serif JP', 'Shippori Mincho', serif; }
.mh-nv-stage { position: absolute; inset: 0; }
.mh-nv-bg { position: absolute; inset: 0; background-size: cover; background-position: center; transition: opacity .6s ease; }
.mh-nv-bg::after { content: ''; position: absolute; inset: 0; background: radial-gradient(130% 90% at 50% 40%, transparent 40%, rgba(0,0,0,.72) 100%); }
.mh-nv-snow { position: absolute; inset: -10% 0 0 0; pointer-events: none; opacity: .55;
  background-image: radial-gradient(1.6px 1.6px at 10% 20%, #fff 50%, transparent 51%), radial-gradient(1.2px 1.2px at 30% 70%, #fff 50%, transparent 51%),
    radial-gradient(2px 2px at 55% 35%, #fff 50%, transparent 51%), radial-gradient(1.3px 1.3px at 75% 80%, #fff 50%, transparent 51%),
    radial-gradient(1.8px 1.8px at 90% 15%, #fff 50%, transparent 51%), radial-gradient(1.1px 1.1px at 45% 90%, #fff 50%, transparent 51%);
  background-size: 260px 260px; animation: mh-nv-snow 14s linear infinite; }
.mh-nv-snow.b { background-size: 170px 170px; opacity: .35; animation-duration: 9s; }
@keyframes mh-nv-snow { from { background-position: 0 0; } to { background-position: 40px 260px; } }
.mh-nv-fig { position: absolute; left: 50%; bottom: 0; transform: translateX(-50%); height: 78%; width: min(92vw, 560px); display: flex; align-items: flex-end; justify-content: center; pointer-events: none; }
.mh-nv-fig img { max-height: 100%; max-width: 100%; object-fit: contain; object-position: bottom; filter: drop-shadow(0 6px 18px rgba(0,0,0,.6)); animation: mh-nv-in .35s ease; }
.mh-nv-fig.face img { max-height: 46%; margin-bottom: 30%; border-radius: 50%; }
.mh-nv-fig.dim img, .mh-nv-fig.dim svg { filter: brightness(.55) drop-shadow(0 6px 18px rgba(0,0,0,.6)); }
@keyframes mh-nv-in { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } }
.mh-nv-box { position: absolute; left: 50%; transform: translateX(-50%); bottom: max(10px, env(safe-area-inset-bottom)); width: min(calc(100% - 20px), 880px); min-height: 132px;
  border-radius: 14px; padding: 22px 18px 14px; background: linear-gradient(180deg, rgba(10,20,48,.92), rgba(5,10,28,.95));
  box-shadow: 0 0 0 1px rgba(232,196,106,.75), 0 0 0 4px rgba(10,20,48,.9), 0 0 0 5px rgba(232,196,106,.35), 0 12px 30px rgba(0,0,0,.55); }
.mh-nv-name { position: absolute; top: -15px; left: 16px; padding: 3px 16px; border-radius: 6px; font-size: 15px; font-weight: 800; letter-spacing: .08em;
  background: linear-gradient(180deg, #1b2c5c, #0c1636); color: #f8e3a4; box-shadow: 0 0 0 1px rgba(232,196,106,.85); }
.mh-nv-text { font-size: 17px; line-height: 1.75; font-weight: 600; white-space: pre-wrap; min-height: 3.5em; word-break: normal; line-break: strict; overflow-wrap: anywhere; }
.mh-nv-text.band { text-align: center; color: #dfe6ff; font-style: normal; }
.mh-nv-note { margin-top: 2px; font-size: 11px; color: #9fb0d8; }
.mh-nv-next { position: absolute; right: 14px; bottom: 8px; width: 0; height: 0; border-left: 7px solid transparent; border-right: 7px solid transparent; border-top: 9px solid #e8c46a; animation: mh-nv-bob 1s ease-in-out infinite; }
@keyframes mh-nv-bob { 50% { transform: translateY(4px); } }
.mh-nv-top { position: absolute; top: max(8px, env(safe-area-inset-top)); left: 8px; right: 8px; display: flex; align-items: center; gap: 6px; z-index: 6; }
.mh-nv-where { min-width: 0; flex: 1; font-size: 12px; color: #c9d4f2; text-shadow: 0 1px 3px #000; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
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
.mh-nv-person[data-fresh] .stamp, .mh-nv-person[data-fresh] .santa, .mh-nv-person[data-fresh] .flower { animation: mh-nv-stamp .5s cubic-bezier(.2,1.6,.4,1) both; }
@keyframes mh-nv-fresh { 0% { transform: scale(1); } 30% { transform: scale(1.08); } 100% { transform: scale(1); } }
@keyframes mh-nv-stamp { from { opacity: 0; scale: 2.2; } to { opacity: 1; scale: 1; } }
.mh-nv-fig.laugh svg { animation: mh-nv-laugh .25s ease-in-out 6; }
@keyframes mh-nv-laugh { 50% { transform: translateY(-4px) scaleY(1.03); } }
.mh-nv-person .flower { position: absolute; top: 30%; left: 50%; transform: translateX(-50%); font-size: 16px; color: #fff; text-shadow: 0 0 6px #fff; }
.mh-nv-choice { width: 100%; min-height: 52px; padding: 10px 14px; border-radius: 12px; font-size: 15px; font-weight: 800; color: #fff3d0; text-align: center;
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
@media (orientation: landscape) and (max-height: 560px) {
  .mh-nv-fig { left: 4%; transform: none; height: 96%; width: min(40vw, 420px); }
  .mh-nv-box { left: auto; right: 10px; transform: none; width: min(calc(60vw - 10px), 760px); min-height: 110px; padding-top: 20px; }
  .mh-nv-text { font-size: 15px; line-height: 1.65; }
  .mh-nv-cast { grid-template-columns: repeat(12, minmax(0, 1fr)); }
}
@media (min-width: 900px) and (min-height: 700px) { .mh-nv-text { font-size: 19px; } .mh-nv-box { min-height: 150px; } }
@media (prefers-reduced-motion: reduce) { .mh-nv-snow, .mh-nv-next, .mh-nv-shake, .mh-nv-get, .mh-nv-fig img { animation: none !important; } }
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
//  台本の「背景: ◯◯」の名前から。今ある絵の名前(monhero_plaza など)は images/story-bg の絵、
//  雪山・ペンションの絵はまだ無いので、名前の言葉で色の重なり(紺・雪・灯り)を描く。絵が来たら img を足すだけ
const XMAS_NOVEL_BG = Object.freeze([
  { re: /停電|まっくら|真っ暗|暗転/, grad: 'radial-gradient(60% 40% at 50% 30%, #0d1428 0%, #02040a 70%)' },
  { re: /山道|外観/, grad: 'linear-gradient(180deg, #6f86b8 0%, #b9c9e8 45%, #eef3fb 70%, #c9d6ec 100%)', snow: true },
  { re: /雪原|雪の庭|庭|森|足あと/, grad: 'linear-gradient(180deg, #0f1d44 0%, #2d4378 45%, #9fb2d8 72%, #dfe8f6 100%)', snow: true },
  { re: /屋根裏の会場|会場/, grad: 'radial-gradient(70% 60% at 50% 40%, #6b3a1c 0%, #2e160c 60%, #130804 100%)', warm: true },
  { re: /屋根裏|暗がり/, grad: 'radial-gradient(40% 30% at 50% 35%, #3b2a18 0%, #120c08 60%, #050302 100%)' },
  { re: /通り道|壁の中|はしご/, grad: 'linear-gradient(90deg, #07060a 0%, #2a2116 50%, #07060a 100%)' },
  { re: /鏡/, grad: 'linear-gradient(90deg, #0c1530 0%, #3a4a72 18%, #0c1530 30%, #3a4a72 48%, #0c1530 60%, #3a4a72 78%, #0c1530 100%)' },
  { re: /廊下|開かずの部屋/, grad: 'linear-gradient(180deg, #120f1d 0%, #2a2033 50%, #0b0910 100%)' },
  { re: /台所|食堂/, grad: 'radial-gradient(80% 60% at 50% 30%, #5a3d22 0%, #2a1a0e 70%, #120a05 100%)', warm: true },
  { re: /書斎|客室|部屋/, grad: 'radial-gradient(80% 60% at 40% 30%, #3e2a1a 0%, #1b120b 70%, #0a0604 100%)', warm: true },
  { re: /柱時計|時計/, grad: 'radial-gradient(50% 60% at 50% 40%, #4a3520 0%, #1a1009 70%, #070402 100%)' },
  { re: /ホール/, grad: 'radial-gradient(90% 70% at 50% 35%, #3a2a3e 0%, #171329 55%, #070812 100%)', warm: true },
]);
const XMAS_NOVEL_BG_DEFAULT = { grad: 'radial-gradient(120% 80% at 50% 0%, #17305f 0%, #0b1733 50%, #050a1a 100%)', snow: true };
const xmasNovelBgOf = (name) => {
  const n = String(name || '');
  if (/^[a-z0-9_]+$/.test(n)) return { img: `images/story-bg/${n}.jpg` };
  return XMAS_NOVEL_BG.find((b) => b.re.test(n)) || XMAS_NOVEL_BG_DEFAULT;
};

// ---- 立ち絵 ----
//  助手はサンタのきせかえの立ち絵(stand-santa。ドラは顔の絵なので santa の顔)。イチーカ・もちまるは絵が1枚。謎の客2人・？？？は影
const XMAS_NOVEL_FACES = Object.freeze(['normal', 'happy', 'wink', 'surprise', 'troubled', 'angry', 'crying', 'excited']);
const xmasNovelFigureSrc = (who, e) => {
  const c = xmasNovelCastOf(who);
  if (!c) return null;
  const face = XMAS_NOVEL_FACES.includes(e) ? e : 'normal';
  if (c.kind === 'assistant') {
    const dir = typeof STORY_OUTFIT_DIRS !== 'undefined' && STORY_OUTFIT_DIRS && STORY_OUTFIT_DIRS.santa ? STORY_OUTFIT_DIRS.santa : '';
    if (!dir) return null;
    if (who === 'dra') return { src: `${dir}/dra_${face}.PNG`, face: true };
    return { src: `${dir.replace(/\/santa$/, '/stand-santa')}/${who}_${face}.png`, fallback: `${dir}/${who}_${face}.PNG` };
  }
  if (c.kind === 'monster') return { src: c.art };
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
// シルエットの笑い(名前を伏せた声で「ふふ」「あはは」)。笑い声の音源はまだ無いので、いまはボスの技の音で代える
const xmasNovelIsSilhouette = (row) => !!(row && /黒いサンタのシルエット|黒いサンタの影/.test(row.x || ''));
const xmasNovelIsLaugh = (row) => !!(row && /ふふ|あはは|ははは/.test(row.x || ''));
const XmasNovelFigure = ({ row, dim = false }) => {
  const [broken, setBroken] = useState(0);
  if (row && row.t === 'band' && xmasNovelIsSilhouette(row)) return <div className={`mh-nv-fig${dim ? ' dim' : ''}`} key={`band-${row.id}`}><XmasNovelShadow tone="#000" hat label="黒いサンタ" /></div>;
  if (!row || row.t !== 'line') return null;
  const key = `${row.w || row.n}-${row.e || ''}`;
  const laugh = row.n === '？？？' && xmasNovelIsLaugh(row);
  if (row.n === '？？？' || !row.w) return row.n === '？？？' ? <div className={`mh-nv-fig${dim ? ' dim' : ''}${laugh ? ' laugh' : ''}`} key={key}><XmasNovelShadow tone={laugh ? '#000' : '#1c2240'} hat={laugh} label="？？？" /></div> : null;
  if (row.w === 'watson') return <div className="mh-nv-fig" key={key}><XmasNovelLaptop /></div>;
  const c = xmasNovelCastOf(row.w);
  const fig = xmasNovelFigureSrc(row.w, row.e);
  if (!fig || broken >= 2) return <div className={`mh-nv-fig${dim ? ' dim' : ''}`} key={key}><XmasNovelShadow tone={(c && c.tone) || '#2a3350'} label={c ? c.name : ''} /></div>;
  const src = broken === 1 && fig.fallback ? fig.fallback : fig.src;
  return (
    <div className={`mh-nv-fig${fig.face ? ' face' : ''}${dim ? ' dim' : ''}`} key={key}>
      <img src={src} alt={c ? c.name : ''} draggable={false} onError={() => setBroken((b) => (b === 0 && fig.fallback ? 1 : 2))} />
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
// 黒いサンタの判(バッドエンド。赤い丸の中に、黒いサンタの影)
const XmasNovelSantaStamp = () => (
  <svg viewBox="0 0 40 40" width="100%" height="100%" aria-hidden="true">
    <circle cx="20" cy="20" r="17" fill="none" stroke="#d22" strokeWidth="3" />
    <path d="M12 17 L22 7 L28 15 Z" fill="#0a0a0a" /><circle cx="28" cy="15" r="2.4" fill="#0a0a0a" />
    <circle cx="20" cy="20" r="5" fill="#0a0a0a" /><path d="M11 33 C12 25 16 24 20 24 C24 24 28 25 29 33 Z" fill="#0a0a0a" />
  </svg>
);
const XmasNovelCast = ({ states = {}, changed = [], onPick = null }) => (
  <div className="mh-nv-cast">
    {XMAS_NOVEL_CAST.map((c) => {
      const st = states[c.id] || '';
      const fresh = changed.includes(c.id);
      const face = xmasNovelFaceOf(c.id);
      const inner = (
        <>
          <span className="ph">{face ? <img src={face} alt="" draggable={false} /> : <XmasNovelShadow tone={c.tone} />}</span>
          <span className="mh-nv-serif" style={{ lineHeight: 1.2 }}>{c.name}</span>
          {st === 'missing' && <span className="stamp">行方不明</span>}
          {st === 'hurt' && <span className="tag">けが</span>}
          {st === 'dead' && <span className="flower" aria-label="白い花">✿</span>}
          {st === 'santa' && <span className="santa" aria-label="黒いサンタの判"><XmasNovelSantaStamp /></span>}
        </>
      );
      return onPick
        ? <button type="button" key={c.id} data-xmas-novel-person={c.id} data-st={st || undefined} className="mh-nv-person active:scale-95" onClick={() => onPick(c.id)}>{inner}</button>
        : <div key={c.id} data-xmas-novel-cast={c.id} data-st={st || undefined} data-fresh={fresh ? '' : undefined} className="mh-nv-person">{inner}</div>;
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
const xmasNovelFill = (text, playerName) => String(text || '').replace(/\{name\}/g, playerName || 'あなた');
const xmasNovelSe = (kind) => {
  try {
    if (typeof Audio_ === 'undefined' || !Audio_ || !Audio_.se) return;
    const map = { laugh: 'enemySpecial', bell: 'levelUp', impact: 'enemyAttack', music: 'heal', tap: 'tap', clue: 'card', ok: 'victory', ng: 'guard' };
    const fn = Audio_.se[map[kind] || 'tap'];
    if (typeof fn === 'function') fn();
  } catch (e) { /* 音が出せなくても読み進める */ }
};
const xmasNovelBgm = (key) => {
  try {
    if (typeof Audio_ === 'undefined' || !Audio_) return;
    if (!key) return;
    if (key === 'silence') { Audio_.stopBGM(); return; }
    if (typeof Audio_.fadeToBGM === 'function') Audio_.fadeToBGM(key, 700); else Audio_.playBGM(key);
  } catch (e) { /* 曲が鳴らせなくても読み進める */ }
};
const XmasNovelIcon = ({ d, size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" dangerouslySetInnerHTML={{ __html: d }} />
);
const XMAS_NOVEL_ICONS = {
  auto: '<polygon points="6 4 16 12 6 20 6 4"/><line x1="19" y1="5" x2="19" y2="19"/>',
  skip: '<polygon points="4 5 12 12 4 19 4 5"/><polygon points="12 5 20 12 12 19 12 5"/>',
  log: '<line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><circle cx="4" cy="6" r="1"/><circle cx="4" cy="12" r="1"/><circle cx="4" cy="18" r="1"/>',
  book: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/><circle cx="12" cy="10" r="3"/><line x1="14.2" y1="12.2" x2="16.5" y2="14.5"/>',
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
// 称号の口のための読み口: 全部一発で当てたか・何問か・称号を渡したか(ほかの画面からも呼べる)
const xmasNovelPerfectState = async () => {
  const save = await xmasNovelLoad();
  return { perfect: xmasNovelIsPerfect(XMAS_NOVEL_SCRIPT, save), count: xmasNovelPerfectCount(XMAS_NOVEL_SCRIPT, save), total: xmasNovelScoreGroups(XMAS_NOVEL_SCRIPT).length, titleSent: save.titleSent, endings: save.endings };
};

// エンディングのあとにカーテンコールの場面がつながっているか
const xmasNovelHasCurtain = (script, endingId) => {
  const sc = xmasNovelSceneById(script, endingId);
  const nx = sc && sc.next ? xmasNovelSceneById(script, sc.next) : null;
  return !!(nx && nx.curtain);
};

// ---- 画面 ----
const XMAS_NOVEL_AUTO_MS = [0, 1800, 1000];
// script … 検査で仮の台本を渡すときだけ(ふだんは渡さない)
const XmasNovelScreen = ({ playerName = '', onClose, onPerfect, script = null }) => {
  useXmasNovelCss();
  const S = script || XMAS_NOVEL_SCRIPT;
  const [save, setSave] = useState(null);
  const [mode, setMode] = useState('title'); // title / read / endings / chapters
  const [st, setSt] = useState(null); // xmasNovelSettle の結果(いまの行)
  const [reply, setReply] = useState(null); // { list:[行], i, then, q } 問いの返しを読んでいるところ
  const [shown, setShown] = useState(0); // 文字送りで出した字数
  const [fx, setFx] = useState(null); // { kind, n }
  const [shake, setShake] = useState(0);
  const [curtain, setCurtain] = useState(null); // 'down'(下りて閉じたまま)/ 'up'(上がっていく)
  const replayRef = useRef(false); // エンディングの記録から見返している(進み具合・記録は書かない)
  const [cards, setCards] = useState([]); // 札の並び { kind:'chapter'|'title'|'band'|'ending', ... }。先頭を出す
  const card = cards[0] || null;
  const setCard = (c) => setCards((list) => (c ? [...list, c] : []));
  const [sheet, setSheet] = useState(null); // 'book' / 'log' / 'menu' / { kind:'present'|'person'|'action', q }
  const [got, setGot] = useState(null); // 手に入れた手がかり { n, d, add }
  const [skip, setSkip] = useState(false);
  const [log, setLog] = useState([]);
  const [confirmNew, setConfirmNew] = useState(false);
  const saveRef = useRef(null);
  const lastBgm = useRef(null);
  const lastChapter = useRef(null);
  const prevBgm = useRef(null);
  const storeTimer = useRef(null);
  const unreadRef = useRef(false); // いまの行が、着く前はまだ読んでいなかったか(既読スキップを止める)

  useEffect(() => {
    let alive = true;
    try { prevBgm.current = typeof Audio_ !== 'undefined' && Audio_.currentBgmKey ? Audio_.currentBgmKey() : null; } catch (e) { prevBgm.current = null; }
    xmasNovelLoad(S).then((s) => { if (alive) { saveRef.current = s; setSave(s); } });
    xmasNovelBgm('melo_kiss_mystery');
    return () => { alive = false; if (storeTimer.current) clearTimeout(storeTimer.current); };
  }, []);
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
    if (r.t === 'band' && Array.isArray(r.fx)) {
      const vis = r.fx.find((f) => ['dark', 'white', 'red', 'light'].includes(f));
      setFx(vis ? { kind: vis, n: Date.now() } : null);
      if (r.fx.includes('shake')) setShake((n) => n + 1);
      if (r.fx.includes('curtainDown')) setCurtain('down');
      if (r.fx.includes('curtainUp')) { setCurtain('up'); setTimeout(() => setCurtain((c) => (c === 'up' ? null : c)), 1700); }
      if (r.se) xmasNovelSe(r.se);
      if (r.fx.includes('title') || r.fx.includes('chapter')) { setCard({ kind: r.fx.includes('title') ? 'title' : 'band', text: r.x }); setShown(99999); return s; }
    } else setFx((f) => (f && f.kind === 'dark' ? null : f));
    if (r.bgm && r.bgm !== lastBgm.current) { lastBgm.current = r.bgm; xmasNovelBgm(r.bgm); }
    if (r.t === 'clue') { setGot({ n: r.clue, d: r.x, add: !!r.add }); xmasNovelSe('clue'); }
    if (r.t === 'line' && r.n === '？？？' && xmasNovelIsLaugh(r)) xmasNovelSe('laugh');
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
      s = { ...s, endings: s.endings.includes(ending.id) ? s.endings : [...s.endings, ending.id], cur: after };
      let perfectNow = false;
      if (!s.titleSent && xmasNovelIsPerfect(S, s)) {
        perfectNow = true;
        try {
          const sent = onPerfect ? onPerfect({ count: xmasNovelPerfectCount(S, s), endings: s.endings }) : false;
          if (sent === true) s = { ...s, titleSent: true };
        } catch (e) { /* 口の先で失敗しても読み進める */ }
      }
      persist(s, true);
      setSt(next); setSkip(false); setSheet(null);
      setCard({ kind: 'ending', ending, retry: !!after, perfect: perfectNow, count: xmasNovelPerfectCount(S, s), total: xmasNovelScoreGroups(S).length });
      return;
    }
    if (!next.row) { persist({ ...s, cur: null }, true); setSt(null); setMode('title'); return; }
    const scene = next.scene;
    let chapterCard = false;
    if (scene && scene.bgm && scene.bgm !== lastBgm.current) { lastBgm.current = scene.bgm; xmasNovelBgm(scene.bgm); }
    if (scene && scene.chapter !== lastChapter.current) {
      const ch = xmasNovelChapters(S).find((c) => c.id === scene.chapter);
      const opening = lastChapter.current !== null || next.cur.idx === 0;
      lastChapter.current = scene.chapter;
      if (ch && ch.id !== 'END') {
        if (!s.snaps[ch.id] || next.cur.idx === 0) s = { ...s, snaps: { ...s.snaps, [ch.id]: { scene: scene.id, idx: 0, flags: next.cur.flags, clues: next.cur.clues, ans: next.cur.ans, panel: next.cur.panel || {} } } };
        if (opening) { setCard({ kind: 'chapter', label: xmasNovelChapterLabel(ch), title: ch.title }); setSkip(false); chapterCard = true; }
      }
    }
    let cur = next.cur;
    let panelChanged = [];
    if (next.row.t === 'clue' || next.row.t === 'flag' || next.row.t === 'panel') {
      cur = xmasNovelApplyRow(cur, next.row);
      if (next.row.t === 'panel') { panelChanged = xmasNovelPanelChanged(next.cur.panel, cur.panel); if (next.row.stamp) xmasNovelSe('impact'); }
    }
    const settled = { ...next, cur, panelChanged };
    s = arriveRow(next.row, { ...s, cur }, { held: chapterCard });
    setSt(settled);
    persist(s);
    // フラグの行は見せずに次へ
    if (next.row.t === 'flag') setTimeout(() => arrive(xmasNovelStep(S, cur)), 0);
  };
  const start = (cur, replay = false) => {
    replayRef.current = replay;
    setCurtain(null);
    lastBgm.current = null; lastChapter.current = null;
    setLog([]); setCard(null); setSheet(null); setGot(null); setFx(null); setSkip(false);
    setMode('read');
    arrive(xmasNovelSettle(S, cur));
  };

  // すすめる(タップ・オート・スキップ)
  const advance = () => {
    if (card) {
      if (card.kind === 'ending') return;
      setCards((list) => list.slice(1));
      // 題字・帯の札は、その行そのもの。札を閉じたら次の行へ(章の札は行ではないので、閉じるだけ)
      if ((card.kind === 'title' || card.kind === 'band') && cards.length === 1) goNext();
      return;
    }
    goNext();
  };
  const goNext = () => {
    if (sheet || !row) return;
    if (typing) { setShown(text.length); return; }
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
    const res = xmasNovelAnswer(S, st.cur, q, pick);
    let s = saveRef.current;
    if (q.score) { s = xmasNovelRecordFirst(s, q.id, res.ok); xmasNovelSe(res.ok ? 'ok' : 'ng'); }
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
  // オート・スキップ(スキップは読んだ行だけ。まだ読んでいない行・問い・札で止まる)
  const autoLevel = save ? save.auto : 0;
  useEffect(() => {
    if (mode !== 'read' || !row || sheet || typing) return undefined;
    if (card && card.kind === 'ending') return undefined;
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
  const bg = xmasNovelBgOf(scene ? scene.bg : '');
  const chapter = scene ? xmasNovelChapters(S).find((c) => c.id === scene.chapter) : null;
  const clues = (st && st.cur && st.cur.clues) || [];
  const endingsAll = xmasNovelScenes(S).filter((s) => s.ending).map((s) => s.ending);
  const perfectTotal = xmasNovelScoreGroups(S).length;

  // ---- タイトル・エンディング一覧・章 ----
  if (mode !== 'read') {
    return (
      <div className="mh-nv" data-xmas-novel={mode}>
        <div className="mh-nv-bg" style={{ background: XMAS_NOVEL_BG_DEFAULT.grad }} />
        <div className="mh-nv-snow" /><div className="mh-nv-snow b" />
        <div className="mh-nv-top"><span className="mh-nv-where" /><button type="button" className="mh-nv-btn" data-xmas-novel-close onClick={close} aria-label="閉じる"><X size={18} /></button></div>
        <div className="absolute inset-0 flex flex-col items-center justify-center overflow-y-auto px-4 py-16">
          {mode === 'title' && (
            <div className="w-full max-w-sm text-center" data-xmas-novel-title>
              <div className="mh-nv-serif text-[13px] tracking-[0.4em] text-slate-300">MYSTERY NOVEL</div>
              <div className="mh-nv-rule" />
              <h1 className="mh-nv-serif mh-nv-gold text-[34px] font-black leading-tight sm:text-[42px]">聖夜の名探偵</h1>
              <div className="mh-nv-serif mt-1 text-[13px] text-slate-200">〜雪山ペンションと消えたプレゼント〜</div>
              <div className="mh-nv-rule" />
              <div className="mt-6 space-y-2.5">
                {save.cur && <button type="button" className="mh-nv-btn wide mh-nv-serif" data-xmas-novel-continue onClick={() => start(save.cur)}>つづきから</button>}
                <button type="button" className="mh-nv-btn wide mh-nv-serif" data-xmas-novel-new onClick={() => (save.cur ? setConfirmNew(true) : start(xmasNovelFreshCur(S)))}>最初から</button>
                <button type="button" className="mh-nv-btn wide mh-nv-serif" data-xmas-novel-chapters disabled={!Object.keys(save.snaps).length} onClick={() => setMode('chapters')}>章を選んで読む</button>
                <button type="button" className="mh-nv-btn wide mh-nv-serif" data-xmas-novel-endings onClick={() => setMode('endings')}>エンディングの記録 {save.endings.filter((id) => endingsAll.some((e) => e.id === id)).length} / {endingsAll.length}</button>
              </div>
              <div className="mt-4 text-[11px] text-slate-300">推理の問い 一発で当てた数 {xmasNovelPerfectCount(S, save)} / {perfectTotal}</div>
              {confirmNew && (
                <div className="mh-nv-sheet" onClick={() => setConfirmNew(false)}>
                  <div className="mh-nv-panel mb-auto mt-auto max-w-sm text-center" onClick={(e) => e.stopPropagation()}>
                    <div className="mh-nv-serif mh-nv-gold mb-2 text-[17px] font-black">最初から読みますか？</div>
                    <p className="mb-3 text-[12px] leading-relaxed text-slate-200" style={JA_LABEL_STYLE}>{jaWrap('いまの続きの場所は消えます。見たエンディング・一発で当てた記録・読んだ印はそのまま残ります')}</p>
                    <div className="space-y-2">
                      <button type="button" className="mh-nv-btn wide" data-xmas-novel-new-ok onClick={() => { setConfirmNew(false); start(xmasNovelFreshCur(S)); }}>最初から</button>
                      <button type="button" className="mh-nv-btn wide" onClick={() => setConfirmNew(false)}>やめる</button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
          {mode === 'endings' && (
            <div className="w-full max-w-md" data-xmas-novel-ending-list>
              <div className="mh-nv-serif mh-nv-gold text-center text-[22px] font-black">エンディングの記録</div>
              <div className="mh-nv-rule" />
              <ul className="space-y-2">
                {endingsAll.map((e) => {
                  const seen = save.endings.includes(e.id);
                  const kind = { ...(XMAS_NOVEL_ENDING_KINDS[e.kind] || XMAS_NOVEL_ENDING_KINDS.normal), ...(e.label ? { label: e.label } : {}) };
                  return (
                    <li key={e.id} data-xmas-novel-ending={e.id} data-seen={seen ? '' : undefined} className="mh-nv-clue flex flex-wrap items-center gap-3">
                      <span className="mh-nv-serif shrink-0 rounded px-2 py-0.5 text-[11px] font-black" style={{ color: '#0a0f20', background: seen ? kind.tone : '#3a4466' }}>{seen ? kind.label : '？？？'}</span>
                      <span className="mh-nv-serif min-w-0 flex-1 truncate text-[15px] font-black">{seen ? `「${e.name}」` : '――まだ見ていない結末'}</span>
                      {seen && <button type="button" className="mh-nv-btn shrink-0" data-xmas-novel-replay={e.id}
                        onClick={() => start({ ...xmasNovelFreshCur(S), scene: e.id, idx: 0 }, true)}>{xmasNovelHasCurtain(S, e.id) ? '見返す(カーテンコールまで)' : '見返す'}</button>}
                    </li>
                  );
                })}
              </ul>
              <button type="button" className="mh-nv-btn wide mt-4" onClick={() => setMode('title')}>戻る</button>
            </div>
          )}
          {mode === 'chapters' && (
            <div className="w-full max-w-md" data-xmas-novel-chapter-list>
              <div className="mh-nv-serif mh-nv-gold text-center text-[22px] font-black">章を選んで読む</div>
              <p className="mt-1 text-center text-[11px] text-slate-300" style={JA_LABEL_STYLE}>{jaWrap('その章に入ったときの手がかりと選んだことから、読み直せます')}</p>
              <div className="mh-nv-rule" />
              <ul className="space-y-2">
                {xmasNovelChapters(S).filter((c) => c.id !== 'END').map((c) => {
                  const snap = save.snaps[c.id];
                  return (
                    <li key={c.id}>
                      <button type="button" data-xmas-novel-chapter={c.id} disabled={!snap} className="mh-nv-clue flex items-center gap-3 disabled:opacity-40"
                        onClick={() => snap && start({ ...snap, idx: 0 })}>
                        <span className="mh-nv-serif mh-nv-gold w-14 shrink-0 text-[14px] font-black">{xmasNovelChapterLabel(c)}</span>
                        <span className="mh-nv-serif min-w-0 flex-1 truncate text-[15px] font-black">{snap ? c.title : '？？？'}</span>
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
  return (
    <div className="mh-nv" data-xmas-novel="read" data-scene={scene ? scene.id : ''} data-row={row ? row.id : ''}>
      <div key={`stage-${shake}`} className={`mh-nv-stage${shake ? ' mh-nv-shake' : ''}`} onClick={advance}>
        <div className="mh-nv-bg" key={scene ? scene.bg || scene.id : 'bg'} style={bg.img ? { backgroundImage: `url(${bg.img})` } : { background: bg.grad }} />
        {(bg.snow || !bg.img) && <><div className="mh-nv-snow" />{bg.snow && <div className="mh-nv-snow b" />}</>}
        {!darkNow && (isLine || (isBand && xmasNovelIsSilhouette(row))) && <XmasNovelFigure row={row} />}
        {fx && <div key={fx.n} className={`mh-nv-fx ${fx.kind}`} />}
        {curtain && <div key={`curtain-${curtain}`} className="mh-nv-curtain" data-st={curtain} data-xmas-novel-curtain={curtain} />}
        {row && row.t === 'panel' && (
          <div className="absolute inset-x-0 top-[12%] z-[5] mx-auto w-[min(94vw,640px)] rounded-2xl p-3" data-xmas-novel-panel style={{ background: 'rgba(4,8,22,.88)', boxShadow: '0 0 0 1px #e8c46a' }}>
            <div className="mh-nv-serif mh-nv-gold mb-2 text-center text-[15px] font-black">登場人物</div>
            <XmasNovelCast states={xmasNovelPanelStates(st && st.cur && st.cur.panel, row)} changed={(st && st.panelChanged) || []} />
          </div>
        )}
        {(isLine || isBand || (row && (row.t === 'clue' || row.t === 'panel' || row.t === 'q'))) && !(card && card.kind !== 'band') && (
          <div className="mh-nv-box" style={{ zIndex: 5 }} data-xmas-novel-box>
            {name && <div className="mh-nv-name mh-nv-serif">{name}</div>}
            <div className={`mh-nv-text${isBand ? ' band mh-nv-serif' : ''}`} data-xmas-novel-text>
              {row.t === 'clue' ? `手がかり帳に「${row.clue}」を書きとめた`
                : row.t === 'panel' ? (row.x || (row.stamp ? '……' : '登場人物'))
                : row.t === 'q' ? xmasNovelFill(row.x, playerName)
                : text.slice(0, shown)}
            </div>
            {isLine && row.note && !typing && <div className="mh-nv-note">({row.note})</div>}
            {!typing && row.t !== 'q' && <span className="mh-nv-next" />}
          </div>
        )}
      </div>
      <div className="mh-nv-top">
        <span className="mh-nv-where mh-nv-serif">{chapter ? `${xmasNovelChapterLabel(chapter)}　${chapter.title}` : ''}{scene && scene.title ? `　/　${scene.title}` : ''}</span>
        <button type="button" className="mh-nv-btn" data-xmas-novel-open-book onClick={() => setSheet('book')} aria-label="手がかり帳"><XmasNovelIcon d={XMAS_NOVEL_ICONS.book} /><span className="hidden sm:inline">手がかり帳</span><b className="text-[11px]">{clues.length}</b></button>
        <button type="button" className="mh-nv-btn" data-xmas-novel-log onClick={() => setSheet('log')} aria-label="ログ"><XmasNovelIcon d={XMAS_NOVEL_ICONS.log} /><span className="hidden sm:inline">ログ</span></button>
        <button type="button" className="mh-nv-btn" data-xmas-novel-auto data-on={autoLevel ? '' : undefined} onClick={() => persist({ ...saveRef.current, auto: (autoLevel + 1) % 3 }, true)} aria-label="オート">
          <XmasNovelIcon d={XMAS_NOVEL_ICONS.auto} /><span>{autoLevel === 2 ? 'はやい' : 'オート'}</span>
        </button>
        <button type="button" className="mh-nv-btn" data-xmas-novel-skip data-on={skip ? '' : undefined} onClick={toggleSkip} aria-label="既読スキップ"><XmasNovelIcon d={XMAS_NOVEL_ICONS.skip} /><span className="hidden sm:inline">スキップ</span></button>
        <button type="button" className="mh-nv-btn" data-xmas-novel-menu onClick={() => setSheet('menu')} aria-label="メニュー"><XmasNovelIcon d={XMAS_NOVEL_ICONS.menu} /></button>
      </div>

      {got && (
        <div className="mh-nv-get" data-xmas-novel-got={got.n} onClick={() => setGot(null)}>
          <div className="text-[11px] font-black tracking-widest text-amber-200">{got.add ? '手がかり帳に書き足した' : '手がかりを手に入れた'}</div>
          <div className="mh-nv-serif mh-nv-gold mt-1 text-[20px] font-black">【{got.n}】</div>
          <p className="mt-1 text-[12px] leading-relaxed text-slate-100" style={JA_LABEL_STYLE}>{jaWrap(got.d)}</p>
        </div>
      )}

      {card && (
        <div className="mh-nv-card" data-xmas-novel-card={card.kind} onClick={advance}>
          {card.kind === 'chapter' && (<>
            <div className="mh-nv-serif text-[15px] tracking-[0.5em] text-slate-200">{card.label}</div>
            <div className="mh-nv-rule" />
            <div className="mh-nv-serif mh-nv-gold text-[30px] font-black leading-tight sm:text-[38px]">{card.title}</div>
            <div className="mh-nv-rule" />
            <div className="mt-6 text-[11px] text-slate-400">タップで進む</div>
          </>)}
          {(card.kind === 'title' || card.kind === 'band') && (<>
            <div className="mh-nv-rule" />
            <div className="mh-nv-serif mh-nv-gold text-[30px] font-black leading-tight sm:text-[40px]" style={JA_LABEL_STYLE}>{jaWrap(card.text)}</div>
            <div className="mh-nv-rule" />
          </>)}
          {card.kind === 'ending' && (() => {
            const kind = { ...(XMAS_NOVEL_ENDING_KINDS[card.ending.kind] || XMAS_NOVEL_ENDING_KINDS.normal), ...(card.ending.label ? { label: card.ending.label } : {}) };
            return (
              <div className="w-full max-w-sm" data-xmas-novel-ending-card={card.ending.id}>
                <div className="mh-nv-serif text-[13px] tracking-[0.4em]" style={{ color: kind.tone }}>{/エンド$/.test(kind.label) ? kind.label : `${kind.label} END`}</div>
                <div className="mh-nv-rule" />
                <div className="mh-nv-serif mh-nv-gold text-[28px] font-black leading-tight">「{card.ending.name}」</div>
                <div className="mh-nv-rule" />
                {!card.replay && <div className="text-[12px] text-slate-200">エンディングの記録に残しました</div>}
                {!card.replay && <div className="mt-1 text-[11px] text-slate-300">推理の問い 一発で当てた数 {card.count} / {card.total}</div>}
                {card.perfect && <div data-xmas-novel-perfect className="mh-nv-serif mh-nv-gold mt-3 text-[15px] font-black">全部の問いを一発で当てた名探偵</div>}
                <div className="mt-5 space-y-2">
                  {card.retry && <button type="button" className="mh-nv-btn wide mh-nv-serif" data-xmas-novel-retry onClick={() => { setCard(null); start(saveRef.current.cur); }}>選び直す</button>}
                  {card.replay
                    ? <button type="button" className="mh-nv-btn wide mh-nv-serif" data-xmas-novel-to-endings onClick={() => { setCard(null); setSt(null); replayRef.current = false; xmasNovelLoad(S).then((v) => { saveRef.current = v; setSave(v); }); setMode('endings'); }}>エンディングの記録へ</button>
                    : <button type="button" className="mh-nv-btn wide mh-nv-serif" data-xmas-novel-to-title onClick={() => { setCard(null); setSt(null); setMode('title'); }}>タイトルへ</button>}
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {sheet && (
        <div className="mh-nv-sheet" data-xmas-novel-sheet={typeof sheet === 'string' ? sheet : sheet.kind}
          onClick={() => { if (typeof sheet === 'string') setSheet(null); }}>
          <div className="mh-nv-panel" onClick={(e) => e.stopPropagation()}>
            {sheet === 'log' && (<>
              <div className="mh-nv-serif mh-nv-gold mb-2 text-[18px] font-black">ログ</div>
              <div className="mh-nv-scroll flex-1 space-y-2 pr-1" ref={(el) => { if (el) el.scrollTop = el.scrollHeight; }}>
                {log.length ? log.map((l, i) => (
                  <div key={i} className="text-[13px] leading-relaxed">
                    {l.who && <div className="mh-nv-serif text-[11px] font-black text-amber-200">{l.who}</div>}
                    <div className={l.who ? 'text-slate-100' : 'text-center text-slate-300'}>{l.text}</div>
                  </div>
                )) : <div className="text-[12px] text-slate-400">まだありません</div>}
              </div>
              <button type="button" className="mh-nv-btn wide mt-3" onClick={() => setSheet(null)}>閉じる</button>
            </>)}
            {(sheet === 'book' || (q && q.kind === 'present')) && (<>
              <div className="mh-nv-serif mh-nv-gold text-[18px] font-black">手がかり帳 <span className="text-[12px] text-slate-300">{clues.length}個</span></div>
              {q && <div data-xmas-novel-question={q.id} className="mt-2 rounded-lg p-2 text-[13px] font-bold leading-relaxed" style={{ background: 'rgba(120,20,30,.35)', boxShadow: '0 0 0 1px rgba(232,120,120,.6)' }}>
                {q.label && <div className="mh-nv-serif text-[11px] font-black text-rose-200">{q.label}</div>}
                {xmasNovelFill(q.x, playerName)}
                <div className="mt-1 text-[11px] text-rose-100">突きつける手がかりを1つ選ぼう</div>
              </div>}
              <div className="mh-nv-scroll mt-2 flex-1 space-y-2 pr-1">
                {clues.length ? clues.map((c) => (
                  <div key={c.n} className="mh-nv-clue" data-xmas-novel-clue={c.n}>
                    <div className="flex items-center gap-2">
                      <div className="mh-nv-serif mh-nv-gold min-w-0 flex-1 text-[15px] font-black">【{c.n}】</div>
                      {q && <button type="button" className="mh-nv-btn shrink-0" data-xmas-novel-present={c.n} onClick={() => answer(q, c.n)}>突きつける</button>}
                    </div>
                    <p className="mt-1 whitespace-pre-wrap text-[12px] leading-relaxed text-slate-200">{c.d}</p>
                  </div>
                )) : <div className="text-[12px] text-slate-400">まだ手がかりはありません</div>}
              </div>
              {!q && <button type="button" className="mh-nv-btn wide mt-3" onClick={() => setSheet(null)}>閉じる</button>}
              {q && <button type="button" className="mh-nv-btn wide mt-3" onClick={() => setSheet(null)}>話をもう一度見る</button>}
            </>)}
            {q && q.kind === 'person' && (<>
              <div data-xmas-novel-question={q.id} className="mb-3 rounded-lg p-2 text-[13px] font-bold leading-relaxed" style={{ background: 'rgba(120,20,30,.35)', boxShadow: '0 0 0 1px rgba(232,120,120,.6)' }}>
                {q.label && <div className="mh-nv-serif text-[11px] font-black text-rose-200">{q.label}</div>}
                {xmasNovelFill(q.x, playerName)}
              </div>
              <div className="mh-nv-scroll"><XmasNovelCast onPick={(id) => answer(q, id)} /></div>
              {(q.extra || []).map((x) => (
                <button type="button" key={x.key} className="mh-nv-choice mh-nv-serif mt-2" data-xmas-novel-extra={x.key} onClick={() => answer(q, x.key)}>{x.x}</button>
              ))}
              {q.once && <div className="mt-2 text-center text-[11px] font-bold text-rose-200">選んだら、やり直しはできません</div>}
              <button type="button" className="mh-nv-btn wide mt-3" onClick={() => setSheet(null)}>話をもう一度見る</button>
            </>)}
            {q && q.kind === 'action' && (<>
              <div data-xmas-novel-question={q.id} className="mh-nv-serif mh-nv-gold mb-3 text-center text-[17px] font-black" style={JA_LABEL_STYLE}>{jaWrap(xmasNovelFill(q.x, playerName))}</div>
              <div className="space-y-2.5">
                {xmasNovelOptionsOf(q, xmasNovelCtx(S, st.cur)).map((o) => (
                  <button type="button" key={o.i} className="mh-nv-choice mh-nv-serif" data-xmas-novel-option={o.i} onClick={() => answer(q, o.i)}>{xmasNovelFill(o.x, playerName)}</button>
                ))}
              </div>
              {q.once && <div className="mt-2 text-center text-[11px] font-bold text-rose-200">選んだら、やり直しはできません</div>}
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
const openXmasNovel = (opts = {}) => {
  if (typeof document === 'undefined' || typeof ReactDOM === 'undefined' || !ReactDOM.createRoot) return false;
  if (xmasNovelHost) return true;
  const el = document.createElement('div');
  el.setAttribute('data-xmas-novel-host', '');
  document.body.appendChild(el);
  const root = ReactDOM.createRoot(el);
  xmasNovelHost = { el, root };
  const done = () => {
    const h = xmasNovelHost; xmasNovelHost = null;
    setTimeout(() => { try { h.root.unmount(); } catch (e) { /* 片づけに失敗しても画面は消す */ } try { h.el.remove(); } catch (e) { /* 同上 */ } }, 0);
    try { opts.onClose && opts.onClose(); } catch (e) { /* 呼び出し元の失敗は持ちこまない */ }
  };
  root.render(<XmasNovelScreen playerName={opts.playerName || ''} onClose={done} onPerfect={opts.onPerfect} script={opts.script || null} />);
  return true;
};

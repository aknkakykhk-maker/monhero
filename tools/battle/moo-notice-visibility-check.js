const TOOLS_DIR = require('path').join(__dirname, '..'); // tools/ 直下。分類フォルダから見た1つ上
// ラスボス戦で「何をする技か」の札が、巨大な立ち絵の裏へ回っていないかを実際のブラウザで測る。
//
//   node tools/battle/moo-notice-visibility-check.js
//
// 【なぜ道具にするか】
// 見た目だけの部品なので、裏に回っていても例外は出ない。WAVE10まで進めて目で見るまで
// 分からないのに、**同じ原因で3回**起きている。
//   1回目 移動の吹き出しを丸枠の中に置いた(tools/battle/move-hint-layout-check.js)
//   2回目 技の札を丸枠の右上へ absolute で置いた(2026-09-22「ムー戦の吹き出しが見えない」)
//   3回目 技の札を position:fixed へ変えたが**丸枠の中に残した**
//         (2026-09-22「吹き出しが裏に回ってる」)
//
// 【何が起きていたか】
// 丸枠(敵の円)には間合いごとの光り方(RANGE_STYLES の drop-shadow)が掛かっている。
// これはCSSの filter なので、transform と同じく**独自の重ね順の島**を作る。
// 島の中に置いた札は、z-index をいくつ上げても島の中での順位しか持てない。
// 島そのものは z-index を持たないので、枠の外へ fixed・z-index 30 で巨大に描く
// ムーの立ち絵に負ける。**position:fixed にしても島からは出られない**ので、
// 2回目の直し方(fixed にする)では止まらなかった。
//
// 【この道具の測り方】
// ① 札が丸枠より前(＝丸枠の外)に書かれているかを、ソースの並びで見る
// ② 丸枠がほんとうに filter を持つ(＝島を作る)かを RANGE_STYLES から読む
// ③ 位置と重なり順は**本体のソースからそのまま読み**、同じ条件の小さなページを作って
//    document.elementFromPoint で「札の真ん中にいちばん手前にあるのは何か」を見る
// ④ 昔の置き方(丸枠の中の fixed)なら裏に回ることも同じページで確かめ、
//    この測り方そのものが不具合を拾えることを示す
const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.resolve(TOOLS_DIR, '..');
const src = fs.readFileSync(path.join(REPO_ROOT, 'monster-hero/src/parts/71-screen-battle.jsx'), 'utf8');
const rangeSrc = fs.readFileSync(path.join(REPO_ROOT, 'monster-hero/src/parts/18-points-and-auto.jsx'), 'utf8');

// ヘッダーと敵のライフ帯の下端は、画面の高さの約15.5%(move-hint-layout-check.js と同じ実測値)。
// 札がこれより上へ出ると、ライフ帯と重なって読めなくなる
const HEADER_BOTTOM_RATIO = 0.155;
// 遊ぶ列の幅。広い画面でも列の外へ飛ばさない(本体の translateX が min(50vw,300px) で寄せている)
const COLUMN_HALF_MAX = 300;

let failed = 0;
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failed++;
};

// ★位置と重なり順は本体から読む。検査へ書き写すと、本体を変えたとき検査だけ古くなる
const art = src.match(/<div className="fixed left-1\/2 pointer-events-none flex items-center justify-center" style=\{\{top:'([^']+)',transform:'translate\(-50%,-50%\)',zIndex:focusedCard\?5:(\d+),width:'([^']+)',height:'([^']+)'\}\}>/);
check('立ち絵の置き方を読み取れる', !!art, art ? `top ${art[1]} / z ${art[2]} / ${art[3]}` : '見つからない');
const notice = src.match(/data-enemy-notice-moo className="fixed left-1\/2 pointer-events-none"\s*\n\s*style=\{\{top:'([^']+)',transform:'([^']+)',zIndex:focusedCard\?5:(\d+)\}\}/);
check('札の置き方を読み取れる', !!notice, notice ? `top ${notice[1]} / z ${notice[3]}` : '見つからない');

// ①札は丸枠より前に書く。丸枠の中に入れると、下でどれだけ z-index を上げても効かない
// ★丸枠の塗りは 2026-09-22 に bg-black/35 へ落とした(濃い塗りだと「丸い板」に見えて、
//   敵が背景から浮いていた)。間合いの色は輪(border)が持っている
// ★新しい盤面の飾り(2026-09-24)で data-enemy-ring を足した。あってもなくても読めるようにする
const frameAt = src.search(/<div (?:data-enemy-ring=\{enemyDist\} )?className=\{`rounded-full transition-all duration-500 border-4 relative bg-black\/35 \$\{RANGE_STYLES\[enemyDist\]\.border\}/);
check('丸枠の書き出しを読み取れる', frameAt >= 0);
const noticeAt = src.indexOf('data-enemy-notice-moo');
check('札は丸枠の外に置いてある', noticeAt >= 0 && frameAt >= 0 && noticeAt < frameAt,
  noticeAt >= 0 && frameAt >= 0 ? `札 ${noticeAt}文字目 / 丸枠 ${frameAt}文字目` : '');

// ②丸枠は本当に「重ね順の島」を作るのか。作らないなら、この検査の前提ごと変わっている
const glow = (rangeSrc.match(/\n\s*1: \{[^}]*glow: "([^"]+)"/) || [])[1] || '';
check('丸枠の光り方(RANGE_STYLES の glow)を読み取れる', !!glow, glow);
check('丸枠の光り方は filter(drop-shadow) ＝ 重ね順の島を作る', glow.startsWith('drop-shadow-['), glow);
if (!art || !notice || !glow) { console.log(`\n${failed}件のNGがあります`); process.exit(1); }

const [, artTop, artZ, artW, artH] = art;
const [, noticeTop, noticeTransform, noticeZ] = notice;
check('札の重なり順が立ち絵より上', Number(noticeZ) > Number(artZ), `札 ${noticeZ} / 立ち絵 ${artZ}`);
// drop-shadow-[0_0_15px_rgba(234,179,8,0.9)] → drop-shadow(0 0 15px rgba(234,179,8,0.9))
const frameFilter = `drop-shadow(${glow.replace(/^drop-shadow-\[/, '').replace(/\]$/, '').replace(/_/g, ' ')})`;

const page = `<!doctype html><meta charset="utf-8"><style>
 html,body{margin:0;height:100%;font-family:-apple-system,sans-serif;background:#111}
 /* ラスボスの立ち絵。丸枠の外へ fixed で巨大に出る */
 #art{position:fixed;left:50%;top:${artTop};transform:translate(-50%,-50%);z-index:${artZ};
      width:${artW};height:${artH};background:#4c1d95}
 /* 敵のエリア(mt-1 relative flex flex-col items-center) */
 #area{position:relative;margin-top:4px;display:flex;flex-direction:column;align-items:center}
 /* 丸枠(台座)。間合いごとの光り方＝filter が掛かるので、中は重ね順の島になる */
 #frame{position:relative;top:3dvh;border-radius:9999px;border:4px solid #eab308;
        padding:clamp(6px,1.5dvh,16px);filter:${frameFilter}}
 #inner{width:clamp(92px,16dvh,142px);height:clamp(86px,15dvh,132px)}
 /* いまの置き方: 丸枠の外。遊ぶ列の右端へ寄せる */
 #moo{position:fixed;left:50%;top:${noticeTop};transform:${noticeTransform};z-index:${noticeZ}}
 /* 昔の置き方: 丸枠の中に fixed。島から出られないので立ち絵の裏へ回る */
 #old{position:fixed;top:${noticeTop};right:6px;z-index:${noticeZ}}
 .card{max-width:170px;border:2px solid #fecaca;border-radius:16px;padding:2px 8px;font-size:11px;
       font-weight:900;line-height:1.2;background:#dc2626;color:#fff;display:flex;gap:4px;align-items:center;white-space:nowrap}
</style><body>
 <div id="art"></div>
 <div id="area">
   <div id="moo"><div class="card" id="newcard"><span>🎯</span><span>貫通撃！</span></div></div>
   <div id="frame"><div id="inner"></div>
     <div id="old"><div class="card" id="oldcard"><span>🎯</span><span>貫通撃！</span></div></div>
   </div>
 </div>
</body>`;

(async () => {
  let playwright;
  try { playwright = require('playwright'); } catch { console.log('SKIP: playwright がありません'); process.exit(failed ? 1 : 0); }
  const browser = await playwright.chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  try {
    for (const vp of [{ width: 360, height: 640, name: '小さい端末' }, { width: 390, height: 844, name: 'ふつうの端末' },
      { width: 430, height: 932, name: '大きい端末' }, { width: 1280, height: 1500, name: '縦に長い画面' }]) {
      const tab = await browser.newPage({ viewport: { width: vp.width, height: vp.height } });
      await tab.setContent(page);
      const r = await tab.evaluate(() => {
        const box = (sel) => { const b = document.querySelector(sel).getBoundingClientRect(); return { x: b.x, y: b.y, w: b.width, h: b.height, right: b.right, bottom: b.bottom }; };
        const topmostIn = (sel) => {
          const b = document.querySelector(sel).getBoundingClientRect();
          const hit = document.elementFromPoint(b.x + b.width / 2, b.y + b.height / 2);
          return !!hit && !!hit.closest(sel);
        };
        return { card: box('#newcard'), newOnTop: topmostIn('#newcard'), oldOnTop: topmostIn('#oldcard'),
          frameIsland: getComputedStyle(document.querySelector('#frame')).filter !== 'none',
          w: window.innerWidth, h: window.innerHeight };
      });
      console.log(`[${vp.name} ${vp.width}x${vp.height}] 札 ${Math.round(r.card.x)},${Math.round(r.card.y)} ${Math.round(r.card.w)}x${Math.round(r.card.h)}`);
      check(`${vp.name}: 札が立ち絵より手前に出ている`, r.newOnTop);
      check(`${vp.name}: 画面からはみ出さない`,
        r.card.x >= 0 && r.card.right <= r.w && r.card.y >= 0 && r.card.bottom <= r.h,
        `右端 ${Math.round(r.card.right)} / 画面幅 ${r.w}`);
      // 広い画面では画面の右端ではなく、遊ぶ列(最大600px)の右端に付く
      const columnRight = r.w / 2 + Math.min(r.w / 2, COLUMN_HALF_MAX);
      check(`${vp.name}: 遊ぶ列の中に収まる`, r.card.right <= columnRight + 1,
        `右端 ${Math.round(r.card.right)} / 列の右端 ${Math.round(columnRight)}`);
      check(`${vp.name}: ヘッダーと敵のライフ帯に重ならない`, r.card.y >= vp.height * HEADER_BOTTOM_RATIO,
        `札の上端 ${Math.round(r.card.y)} / ライフ帯の下端 ${Math.round(vp.height * HEADER_BOTTOM_RATIO)}`);
      // ★この測り方そのものが不具合を拾えることを示す。
      //   昔の置き方(filter が掛かった丸枠の中の fixed)は立ち絵に隠れる
      check(`${vp.name}: 丸枠が重ね順の島になっている`, r.frameIsland);
      check(`${vp.name}: 昔の置き方なら裏に回ることも確かめられる`, !r.oldOnTop);
      await tab.close();
    }
  } finally {
    await browser.close();
  }
  console.log(failed ? `\n${failed}件のNGがあります` : '\nすべてOK');
  process.exitCode = failed ? 1 : 0;
})();

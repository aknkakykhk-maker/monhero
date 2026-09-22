const TOOLS_DIR = require('path').join(__dirname, '..'); // tools/ 直下。分類フォルダから見た1つ上
// ラスボス戦で「何をする技か」の吹き出しが、巨大な立ち絵の下に隠れていないかを実際のブラウザで測る。
//
//   node tools/battle/moo-notice-visibility-check.js
//
// 【なぜ道具にするか】
// 見た目だけの部品なので、隠れていても例外は出ない。WAVE10まで進めて目で見るまで分からない
// (2026-09-22 ユーザー指摘「ムー戦の吹き出しが見えない」)。しかも**同じ原因で2回目**で、
// 1回目は移動の吹き出しだった(tools/battle/move-hint-layout-check.js の頭に書いてある
// 「丸枠の中に置いたため、枠外へ巨大に描くムーの裏へ回っていた」)。
//
// 【何が起きていたか】
// ラスボスの本体は丸枠の外へ position:fixed・z-index 30 で画面いっぱいに描く。
// 吹き出しは丸枠の中に z-index 9000 で置いていたが、丸枠には transform が掛かっていて
// **新しいスタッキング文脈**を作るため、9000 はその中だけの順位になる。
// 外から見ると丸枠は z-index auto なので、z-index 30 の立ち絵のほうが上に来る。
//
// 【この道具の測り方】
// 位置と重なり順は**本体のソースからそのまま読み**、同じ条件の小さなページを作って
// document.elementFromPoint で「吹き出しの真ん中にいちばん手前にあるのは何か」を見る。
// あわせて、昔の置き方(transform の中の z-index 9000)なら隠れることも同じページで確かめ、
// この測り方そのものが不具合を拾えることを示す。
const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.resolve(TOOLS_DIR, '..');
const src = fs.readFileSync(path.join(REPO_ROOT, 'monster-hero/src/parts/71-screen-battle.jsx'), 'utf8');

// ヘッダーと敵のライフ帯の下端は、画面の高さの約15.5%(move-hint-layout-check.js と同じ実測値)。
// 吹き出しがこれより上へ出ると、ライフ帯と重なって読めなくなる
const HEADER_BOTTOM_RATIO = 0.155;

let failed = 0;
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failed++;
};

// ★位置と重なり順は本体から読む。検査へ書き写すと、本体を変えたとき検査だけ古くなる
const art = src.match(/<div className="fixed left-1\/2 pointer-events-none flex items-center justify-center" style=\{\{top:'([^']+)',transform:'translate\(-50%,-50%\)',zIndex:focusedCard\?5:(\d+),width:'([^']+)',height:'([^']+)'\}\}>/);
check('立ち絵の置き方を読み取れる', !!art, art ? `top ${art[1]} / z ${art[2]} / ${art[3]}` : '見つからない');
const notice = src.match(/data-enemy-notice-moo[\s\S]{0,200}?style=\{\{position:'fixed',top:'([^']+)',right:'([^']+)',zIndex:focusedCard\?5:(\d+)\}\}/);
check('吹き出しの置き方を読み取れる', !!notice, notice ? `top ${notice[1]} / right ${notice[2]} / z ${notice[3]}` : '見つからない');
if (!art || !notice) { console.log(`\n${failed}件のNGがあります`); process.exit(1); }

const [, artTop, artZ, artW, artH] = art;
const [, noticeTop, noticeRight, noticeZ] = notice;
check('吹き出しの重なり順が立ち絵より上', Number(noticeZ) > Number(artZ), `吹き出し ${noticeZ} / 立ち絵 ${artZ}`);

const page = `<!doctype html><meta charset="utf-8"><style>
 html,body{margin:0;height:100%;font-family:-apple-system,sans-serif;background:#111}
 /* ラスボスの立ち絵。丸枠の外へ fixed で巨大に出る */
 #art{position:fixed;left:50%;top:${artTop};transform:translate(-50%,-50%);z-index:${artZ};
      width:${artW};height:${artH};background:#4c1d95}
 /* 丸枠(台座)。ラスボスのときは 3dvh ぶん下へずらす。★transform ではなく top で */
 #frame{position:relative;top:3dvh;left:50%;margin-left:-90px;width:180px;height:180px;border-radius:50%;
        border:4px solid #666;transform:translateY(0)}
 /* 昔の置き方: 丸枠の中に z-index 9000。transform を掛けた入れ物の中なので閉じ込められる */
 #oldwrap{position:absolute;inset:0;z-index:9000}
 #old{position:absolute;top:-12px;right:-8px}
 .card{max-width:170px;border:2px solid #fff;border-radius:16px;padding:2px 8px;font-size:11px;
       font-weight:900;line-height:1.2;background:#dc2626;color:#fff;display:flex;gap:4px;align-items:center;white-space:nowrap}
 #notice{position:fixed;top:${noticeTop};right:${noticeRight};z-index:${noticeZ}}
</style><body>
 <div id="art"></div>
 <div style="position:absolute;left:0;right:0;top:30%"><div id="frame" style="transform:translateY(3dvh)">
   <div id="oldwrap"><div id="old"><div class="card" id="oldcard"><span>🎯</span><span>全体攻撃！</span></div></div></div>
 </div></div>
 <div id="notice"><div class="card" id="newcard"><span>🎯</span><span>全体攻撃！</span></div></div>
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
          w: window.innerWidth, h: window.innerHeight };
      });
      console.log(`[${vp.name} ${vp.width}x${vp.height}] 吹き出し ${Math.round(r.card.x)},${Math.round(r.card.y)} ${Math.round(r.card.w)}x${Math.round(r.card.h)}`);
      check(`${vp.name}: 吹き出しが立ち絵より手前に出ている`, r.newOnTop);
      check(`${vp.name}: 画面からはみ出さない`,
        r.card.x >= 0 && r.card.right <= r.w && r.card.y >= 0 && r.card.bottom <= r.h,
        `右端 ${Math.round(r.card.right)} / 画面幅 ${r.w}`);
      check(`${vp.name}: ヘッダーと敵のライフ帯に重ならない`, r.card.y >= vp.height * HEADER_BOTTOM_RATIO,
        `吹き出しの上端 ${Math.round(r.card.y)} / ライフ帯の下端 ${Math.round(vp.height * HEADER_BOTTOM_RATIO)}`);
      // ★この測り方そのものが不具合を拾えることを示す。
      //   昔の置き方(transform を掛けた丸枠の中の z-index 9000)は立ち絵に隠れる
      check(`${vp.name}: 昔の置き方なら隠れることも確かめられる`, !r.oldOnTop);
      await tab.close();
    }
  } finally {
    await browser.close();
  }
  console.log(failed ? `\n${failed}件のNGがあります` : '\nすべてOK');
  process.exitCode = failed ? 1 : 0;
})();

const TOOLS_DIR = require('path').join(__dirname, '..'); // tools/ 直下。分類フォルダから見た1つ上
// 敵の「移動しようとしている」吹き出しの大きさと位置を、実際のブラウザで測る。
//
// 【なぜ道具にするか】
// 見た目だけの部品なので、大きすぎても位置がずれても例外は出ず、
// 遊んでいて「敵の絵が見えない」と気付くまで分からない。実際に
//   ・font のまとめ書きで font-family に inherit を書いてしまい、指定ごと無効になって
//     文字が大きいまま出ていた(幅308px。画面の8割を占めて敵を隠していた)
//   ・丸枠の中に置いたため、枠外へ巨大に描くムーの裏へ回っていた
// という不具合を出した。CSSだけを取り出して実寸を測れば、どちらも数値で拾える。
const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.resolve(TOOLS_DIR, '..');
const src = fs.readFileSync(path.join(REPO_ROOT, 'monster-hero/src/game-system.jsx'), 'utf8');

// 画面下の行動予告バッジと同じくらいの大きさに収めたい。
// 高さはこの差の範囲、幅は遊ぶ列(最大600px)のこの割合まで
const MAX_HEIGHT_DIFF = 6;   // px
const MAX_WIDTH_RATIO = 0.55; // 遊ぶ列の幅に対して
// 敵の丸枠(180px)と重なってよい面積の割合
const MAX_OVERLAP_RATIO = 0.12;
// 敵のまわりのボタンは**舞台の四隅**へ置いてある(2026-09-22 ユーザー指示「解析ボタンを
// 右欄に置けばいい」「ログは左上」「ステータスは左エリアのバフ帯の上」)。
// 左は ログ(上)・ステータス(下)、右は 解析(上)・行動予測(下)。
// この吹き出しは画面の上から22%・右端に出るので、ぶつかる相手は**右上の解析**になる。
// 実物を描けない環境なので、位置の計算だけをここで確かめる。
const SIDE_COLUMN_LEFT = 8;      // left-2
const SIDE_COLUMN_WIDTH = 62;    // ボタンの幅
const SCAN_BUTTON_HEIGHT = 48;   // アイコン17 + 字10 + 余白と枠(実測)
// 舞台の上端 = ヘッダー(42px) + 敵のライフ帯(38px)。実測は 844→80px / 667→77px
const STAGE_TOP = 77;
const REM = 16;

let failed = 0;
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failed++;
};

const css = src.slice(src.indexOf('.mh-enemy-move-hint {'), src.indexOf('@keyframes moveHintBob'));
check('吹き出しのCSSを取り出せる', css.includes('.mh-enemy-move-hint'));
// 「解析」は右上(top-NN)。Tailwindの top-NN は NN/4 rem
const scanTopMatch = src.match(/setShowEnemyInfo\(true\)[^\n]{0,120}?className="absolute right-2 top-(\d+)/);
check('解析ボタンの高さを読み取れる', !!scanTopMatch, scanTopMatch ? `top-${scanTopMatch[1]}` : '見つからない');
// 左の2つ(ログ・ステータス)が左端にあること
check('ログは左上にある', /data-battle-log-button[^\n]{0,400}?absolute left-2 top-1\b/.test(src));
check('ステータスは左下にある', /setShowHeroInfo\(true\)[^\n]{0,400}?absolute left-2 bottom-1\b/.test(src));
const sideWidth = src.match(/<button[^\n]{0,400}?absolute (?:left|right)-2 [a-z0-9-\[\]]+ z-20 flex w-\[(\d+)px\]/);
check('四隅のボタンの幅を読み取れる', !!sideWidth && Number(sideWidth[1]) === SIDE_COLUMN_WIDTH,
  sideWidth ? `w-[${sideWidth[1]}px]` : '見つからない');
// 画面側が使っている寄せ方をそのまま持ってくる(ここが変わったら測る位置も変える)
const shiftMatch = src.match(/transform:'(translateX\(calc\([^']+\))'/);
check('右へ寄せる指定を読み取れる', !!shiftMatch, shiftMatch ? shiftMatch[1] : '見つからない');
if (!css || !shiftMatch) { console.log('\n2件のNGがあります'); process.exit(1); }
const shift = shiftMatch[1];

const page = `<!doctype html><meta charset="utf-8"><style>
 html,body{margin:0;height:100%;font-family:-apple-system,sans-serif}
 #col{width:100%;height:100%;max-width:600px;margin:0 auto;position:relative;background:#111}
 /* 敵の丸枠。画面の上から30%を中心に置いている */
 #enemy{position:fixed;left:50%;top:30%;transform:translate(-50%,-50%);width:180px;height:180px;border-radius:50%}
 /* 画面下の行動予告バッジ。大きさを比べる相手 */
 #intent{position:fixed;left:50%;transform:translateX(-50%);bottom:20%;padding:4px 16px;border-radius:999px;border:1px solid #f00;font-size:9px;font-weight:1000;line-height:1.4;white-space:nowrap}
 ${css}
</style><body><div id="col">
 <div id="enemy"></div>
 <div id="intent">つうじょうこうげき (予測: 1234)</div>
 <div id="wrap" style="position:fixed;left:50%;top:22%;transform:${shift};z-index:65000">
   <div class="mh-enemy-move-hint"><span>🏃</span><span>近距離に移動しようとしている…？</span></div>
 </div>
</div></body>`;

(async () => {
  let playwright;
  try { playwright = require('playwright'); } catch { console.log('SKIP: playwright がありません'); process.exit(failed ? 1 : 0); }
  const browser = await playwright.chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  try {
    for (const vp of [{ width: 360, height: 780, name: '小さい端末' }, { width: 390, height: 844, name: 'ふつうの端末' }, { width: 1280, height: 900, name: '広い画面' }]) {
      const tab = await browser.newPage({ viewport: { width: vp.width, height: vp.height } });
      await tab.setContent(page);
      const r = await tab.evaluate(() => {
        const g = (s) => { const b = document.querySelector(s).getBoundingClientRect(); return { x: b.x, y: b.y, w: b.width, h: b.height, right: b.right, bottom: b.bottom }; };
        return { hint: g('.mh-enemy-move-hint'), intent: g('#intent'), enemy: g('#enemy'), col: g('#col') };
      });
      const ow = Math.max(0, Math.min(r.hint.right, r.enemy.right) - Math.max(r.hint.x, r.enemy.x));
      const oh = Math.max(0, Math.min(r.hint.bottom, r.enemy.bottom) - Math.max(r.hint.y, r.enemy.y));
      const overlap = (ow * oh) / (r.enemy.w * r.enemy.h);
      console.log(`[${vp.name} ${vp.width}px] 吹き出し ${Math.round(r.hint.w)}x${Math.round(r.hint.h)} / 行動予告 ${Math.round(r.intent.w)}x${Math.round(r.intent.h)} / 敵と重なる ${Math.round(overlap * 100)}%`);
      check(`${vp.name}: 行動予告と同じくらいの高さ`, Math.abs(r.hint.h - r.intent.h) <= MAX_HEIGHT_DIFF,
        `差 ${Math.round(Math.abs(r.hint.h - r.intent.h))}px (上限 ${MAX_HEIGHT_DIFF}px)`);
      check(`${vp.name}: 幅が広がりすぎない`, r.hint.w <= r.col.w * MAX_WIDTH_RATIO,
        `${Math.round(r.hint.w)}px / 遊ぶ列 ${Math.round(r.col.w)}px の${Math.round(r.hint.w / r.col.w * 100)}%`);
      check(`${vp.name}: 遊ぶ列からはみ出さない`, r.hint.right <= r.col.right && r.hint.x >= r.col.x,
        `右端 ${Math.round(r.hint.right)} / 列の右端 ${Math.round(r.col.right)}`);
      // 狭い端末では吹き出しの幅の都合で左端が中央を越えないので、中心の位置で見る。
      // 見たいのは「中央に居座って敵を隠していないか」なので、これで足りる
      const hintCenter = r.hint.x + r.hint.w / 2, colCenter = r.col.x + r.col.w / 2;
      check(`${vp.name}: 右へ寄っている`, hintCenter > colCenter + r.col.w * 0.1,
        `吹き出しの中心 ${Math.round(hintCenter)} / 列の中央 ${Math.round(colCenter)}`);
      check(`${vp.name}: 敵の絵をほとんど隠さない`, overlap <= MAX_OVERLAP_RATIO,
        `${Math.round(overlap * 100)}% (上限 ${Math.round(MAX_OVERLAP_RATIO * 100)}%)`);
      // 左のボタン(ログ・ステータス)と重ならないこと
      const columnRight = r.col.x + SIDE_COLUMN_LEFT + SIDE_COLUMN_WIDTH;
      check(`${vp.name}: 左のボタンと重ならない`, r.hint.x >= columnRight,
        `吹き出しの左端 ${Math.round(r.hint.x)} / 左のボタンの右端 ${Math.round(columnRight)}`);
      // ★右上の「解析」と重ならないこと。吹き出しのほうが下に来るので、
      //   解析の**下端**が吹き出しの上端より上にあるかを見る
      //   (2026-09-22 に解析を右へ戻すまでは、解析が吹き出しの下にあった)
      if (scanTopMatch) {
        const scanBottom = STAGE_TOP + (Number(scanTopMatch[1]) / 4) * REM + SCAN_BUTTON_HEIGHT;
        check(`${vp.name}: 解析ボタンが吹き出しと重ならない`, scanBottom <= r.hint.y,
          `解析の下端 ${Math.round(scanBottom)} / 吹き出しの上端 ${Math.round(r.hint.y)}`);
      }
      await tab.close();
    }
  } finally {
    await browser.close();
  }
  console.log(failed ? `\n${failed}件のNGがあります` : '\nすべてOK');
  process.exitCode = failed ? 1 : 0;
})();

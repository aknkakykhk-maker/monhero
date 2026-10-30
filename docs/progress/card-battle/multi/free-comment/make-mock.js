// 自由文コメントの見本の絵(1案1画面1枚)。本物の画面の写真の上に、案の部品を重ねる
const path = require('path');
const fs = require('fs');
const { chromium } = require('playwright') // 使い方: node make-mock.js <作業場所> <本物の画面の写真のフォルダ> <出力先>;
const SHOT = process.argv[3];
const OUT = process.argv[4];
fs.mkdirSync(OUT, { recursive: true });
const img = (n) => 'data:image/png;base64,' + fs.readFileSync(path.join(SHOT, n)).toString('base64');
const css = `
*{box-sizing:border-box}body{margin:0;background:#0b0820;font-family:"Noto Sans CJK JP","Noto Sans JP",sans-serif;color:#fff;width:390px}
.ph{position:relative;width:390px;height:844px;background-size:390px 844px;overflow:hidden}
.cap{padding:10px 12px 14px;background:#111827;border-top:3px solid #fbbf24}
.cap h1{margin:0 0 4px;font-size:17px;color:#fde68a}.cap p{margin:2px 0;font-size:13px;line-height:1.55;color:#e2e8f0}
.dim{position:absolute;inset:0;background:rgba(2,6,23,.55)}
.sheet{position:absolute;left:0;right:0;bottom:0;background:#0f172a;border-top:2px solid #38bdf8;border-radius:18px 18px 0 0;padding:10px 10px 0}
.stamps{display:grid;grid-template-columns:repeat(3,1fr);gap:5px;margin-bottom:8px}.stamps b{display:block;text-align:center;font-size:11.5px;background:rgba(255,255,255,.1);border-radius:9px;padding:8px 2px}
.inrow{display:flex;gap:6px;align-items:center}.in{flex:1;min-height:44px;border:2px solid #38bdf8;border-radius:12px;background:#020617;padding:10px;font-size:15px}
.in i{display:inline-block;width:2px;height:18px;background:#38bdf8;vertical-align:middle;margin-left:1px}
.send{min-height:44px;border-radius:12px;background:#fbbf24;color:#111;font-weight:900;font-size:14px;padding:0 14px;display:flex;align-items:center}
.cnt{font-size:11px;color:#94a3b8;margin:4px 2px 6px;display:flex;justify-content:space-between}
.kb{height:250px;background:#d1d5db;margin:0 -10px;display:grid;grid-template-columns:repeat(10,1fr);gap:5px;padding:8px 4px}.kb span{background:#fff;border-radius:5px;height:40px}
.bub{position:absolute;max-width:250px;background:#fff;color:#0f172a;border-radius:14px;padding:6px 10px;font-size:14px;font-weight:800;box-shadow:0 4px 14px rgba(0,0,0,.5)}
.bub small{display:block;font-size:10.5px;color:#64748b;font-weight:700}
.bub.me{background:#bae6fd}
.tag{position:absolute;background:#ef4444;color:#fff;font-size:12px;font-weight:900;border-radius:999px;padding:3px 9px;border:2px solid #fff}
.ar{position:absolute;color:#fbbf24;font-size:26px;font-weight:900;text-shadow:0 2px 4px #000}
.cbtn{position:absolute;display:flex;align-items:center;gap:6px;background:#0f172a;border:2px solid #38bdf8;border-radius:14px;padding:0 12px;height:44px;font-size:14px;font-weight:800;color:#bae6fd}
.flow{position:absolute;white-space:nowrap;font-size:17px;font-weight:900;color:#fff;text-shadow:0 0 3px #000,0 0 3px #000,0 2px 4px #000}
.flow small{font-size:11px;color:#fde68a;margin-right:4px}
.log{position:absolute;left:8px;right:8px;background:rgba(2,6,23,.88);border:2px solid #a78bfa;border-radius:14px;padding:6px 8px}
.log p{margin:0;padding:4px 2px;font-size:13px;border-bottom:1px solid rgba(255,255,255,.08);line-height:1.35}.log p b{color:#c4b5fd;margin-right:6px;font-size:12px}
.log h4{margin:0 0 2px;font-size:11px;color:#c4b5fd;display:flex;justify-content:space-between}
.wbub{position:absolute;right:10px;background:rgba(255,255,255,.95);color:#0f172a;border-radius:12px 12px 2px 12px;padding:5px 9px;font-size:13px;font-weight:800;max-width:230px;box-shadow:0 4px 12px rgba(0,0,0,.45)}
.wbub small{font-size:10px;color:#7c3aed;margin-right:4px;font-weight:900}
.mute{position:absolute;background:#1e293b;border:2px solid #f87171;border-radius:12px;padding:8px 10px;font-size:13px;width:210px}
.mute b{display:block;padding:7px 4px;border-bottom:1px solid #334155}.mute b:last-child{border:0}
`;
const page = (bg, inner, h1, lines) => `<!doctype html><html lang="ja"><head><meta charset="utf-8"><style>${css}</style></head><body>
<div class="ph" style="background-image:url(${img(bg)})">${inner}</div>
<div class="cap"><h1>${h1}</h1>${lines.map((l) => `<p>${l}</p>`).join('')}</div></body></html>`;
const STAMPS = ['よろしく！', 'ナイス！', 'うまい！', '考え中…', 'ありがとう！', 'もう1回やろ！'];
const kb = `<div class="kb">${'<span></span>'.repeat(30)}</div>`;
const shots = [
  ['今-01-対戦中のひとこと.png', page('watch-03-host.png', `<div class="tag" style="left:96px;top:6px">いまは 💬 で定型文だけ</div><div class="ar" style="left:62px;top:28px">↖</div>`,
    '今: 対戦中(マルチ)', ['左上の 💬 から、決まった6つのひとこと(よろしく！・ナイス！など)だけ送れる。', '相手のひとことは、相手側に吹き出しで少し出て消える。観戦の人には見えない。'])],
  ['今-02-観戦中.png', page('watch-02-screen.png', `<div class="tag" style="left:40px;top:290px">観戦中は、ひとことを送る所も見る所も無い</div>`,
    '今: 観戦中', ['見ている人どうし・対戦している2人とは、何もやりとりできない。'])],
  ['対戦-案A-打つ所.png', page('watch-03-host.png', `<div class="dim"></div><div class="sheet">
      <div class="cnt"><span>定型のひとこと(押すとすぐ送る)</span><span>✕ 閉じる</span></div>
      <div class="stamps">${STAMPS.map((s) => `<b>${s}</b>`).join('')}</div>
      <div class="inrow"><div class="in">いまのは効いた〜<i></i></div><div class="send">送る</div></div>
      <div class="cnt"><span>自分で打つ(30字まで・URLや連絡先は送れません)</span><span>8/30</span></div>${kb}</div>`,
    '対戦・案A: 💬 から「定型」と「自分で打つ」を1枚で', ['今の 💬 を押すと、下から板が出る。上に定型の6つ(今と同じ)、下に打つ欄と「送る」。', '持ち時間は止まらない(打っているあいだも時計は進む)。続けて送れるのは3秒あけてから。'])],
  ['対戦-案A-出方.png', page('watch-03-host.png', `<div class="bub" style="left:110px;top:150px"><small>ビー</small>いまのは効いた〜 やるね</div>
      
      <div class="bub me" style="left:100px;top:404px;"><small>あなた</small>ありがとう！ 次は負けないよ</div>
      <div class="mute" style="right:10px;top:200px;"><b>🔇 ビーさんのコメントを消す</b><b>🚩 通報する</b></div>
      <div class="ar" style="right:230px;top:208px">→</div>`,
    '対戦・案A: 出方(吹き出し)', ['相手のコメントは相手の名前の下、自分のは自分の場の上に、吹き出しで4秒出て消える(今の定型と同じ出方)。', '吹き出しを長押しで「🔇 コメントを消す」(この試合のあいだ相手のを出さない)・「🚩 通報する」。', '過去のコメントは左上の「記録」の一覧に並ぶ。'])],
  ['観戦-案A-吹き出し.png', page('watch-02-screen.png', `
      <div class="wbub" style="top:238px"><small>シー</small>ディノ粘るなぁ</div>
      <div class="wbub" style="top:278px"><small>ディー</small>ナーガ強い！</div>
      <div class="wbub" style="top:318px"><small>イー</small>ここで守り来るか？</div>
      
      <div class="cbtn" style="left:10px;top:368px;height:36px;font-size:13px">💬 コメントする</div>`,
    '観戦・案A: 吹き出し(まん中の空き)', ['見ている人のコメントは、まん中の空きに右から3つまで積み、5秒で消える。名前つき。', 'モンスターと手札には重ねない。左の「💬 コメントする」で打つ板(対戦・案Aと同じ形)。'])],
  ['観戦-案B-流れる.png', page('watch-02-screen.png', `
      <div class="flow" style="left:150px;top:236px"><small>シー</small>ディノ粘るなぁ</div>
      <div class="flow" style="left:30px;top:268px;opacity:.9"><small>ディー</small>ナーガ強い！</div>
      <div class="flow" style="left:230px;top:300px"><small>イー</small>ここで守り来るか？</div>
      <div class="flow" style="left:-40px;top:332px;opacity:.85"><small>エフ</small>いけー！</div>
      <div class="cbtn" style="left:10px;top:368px;height:36px;font-size:13px">💬 コメントする</div>`,
    '観戦・案B: 流れる', ['コメントが、まん中の空きを右から左へ5秒かけて流れる(4段まで)。にぎやかに見える。', '数が多いと見づらいので、1秒に流すのは2つまで(あふれた分は流さない)。設定で「流さない」も選べる。'])],
  ['観戦-案C-ログ.png', page('watch-02-screen.png', `
      <div class="log" style="top:228px"><h4><span>💬 観戦のコメント(新しいのが下)</span><span>▼ たたむ</span></h4>
        <p><b>シー</b>ディノ粘るなぁ</p><p><b>ディー</b>ナーガ強い！</p><p><b>イー</b>ここで守り来るか？</p><p><b>エフ</b>いけー！</p></div>
      <div class="cbtn" style="right:12px;top:196px;height:30px;font-size:12px;padding:0 10px">💬 コメントする</div>`,
    '観戦・案C: ログ(一覧の欄)', ['まん中の空きに、コメントの一覧を4行。新しいのが下に足され、古いのは上へ流れる。たためる。', 'あとから読み返せる。一番落ち着いて見えるが、動きは少ない。'])],
];
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 390, height: 1000 }, deviceScaleFactor: 2 });
  for (const [name, html] of shots) {
    await p.setContent(html, { waitUntil: 'load' });
    await p.screenshot({ path: path.join(OUT, name), fullPage: true });
  }
  await b.close();
  console.log('ok', shots.length);
})();

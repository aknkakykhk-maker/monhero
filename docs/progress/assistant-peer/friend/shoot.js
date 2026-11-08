// 助手ライフ「フレンドの家へ遊びに行く/遊びに来る」の止め絵(本物の画面に案の部品を重ねて撮る)
const path = require('path'), fs = require('fs'), http = require('http');
const root = '/home/user/monhero';
const T = path.join(root, 'tools');
const { MIME, STORY_IDS, seed, toHome, finishTalk, waitFaces } = require(path.join(T, 'assistant/life-browser-shared.js'));
const { quietBootSeed, updateNoticeSeed, oneTimeNoticeSeed } = require(path.join(T, 'boot/quiet-boot-seed'));
const OUT = process.argv[2] || path.join(__dirname, 'raw');
fs.mkdirSync(OUT, { recursive: true });
const PORT = 8817;
const { chromium } = require('/opt/node-tools/node_modules/playwright/index.js');

const CSS = `
.fvx{font-family:inherit;color:#e2e8f0;box-sizing:border-box}
.fvx *{box-sizing:border-box}
.fv-tag{position:absolute;left:8px;top:8px;z-index:5;background:#fde047;color:#1e1b4b;font-weight:900;font-size:13px;padding:3px 10px;border-radius:10px;border:2px solid #a16207;white-space:nowrap}
.fv-sheet{position:absolute;left:6px;right:6px;bottom:6px;background:#1c1b3b;border:1px solid #ffffff2e;border-radius:18px;padding:12px;box-shadow:0 -8px 30px #0009}
.fv-sheet.top{top:auto}
.fv-h{display:flex;align-items:center;gap:8px;margin-bottom:8px}
.fv-h i{font-style:normal;font-size:24px}
.fv-h b{display:block;font-size:16px;font-weight:900;color:#fff;white-space:nowrap}
.fv-h small{display:block;font-size:11px;color:#c4b5fd;font-weight:700}
.fv-row{display:flex;align-items:center;gap:8px;background:#ffffff0f;border:1px solid #ffffff1a;border-radius:12px;padding:7px 8px;margin-bottom:6px}
.fv-row.off{opacity:.45}
.fv-av{width:34px;height:34px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:900;font-size:15px;color:#fff;flex:none;border:2px solid #fff6}
.fv-mid{flex:1;min-width:0}
.fv-mid b{display:block;font-size:13px;font-weight:900;color:#fff;white-space:nowrap}
.fv-mid small{display:block;font-size:10.5px;color:#cbd5e1;white-space:nowrap}
.fv-faces{display:flex;gap:2px;margin-top:2px}
.fv-faces img{width:18px;height:18px;border-radius:50%;object-fit:cover;border:1px solid #fff8;background:#0008}
.fv-btn{flex:none;font-size:12px;font-weight:900;color:#fff;padding:7px 11px;border-radius:10px;background:linear-gradient(#34d399,#059669);white-space:nowrap;border:none}
.fv-btn.gray{background:#475569;color:#cbd5e1}
.fv-big{display:block;width:100%;text-align:center;font-size:14px;font-weight:900;color:#fff;padding:10px;border-radius:12px;background:linear-gradient(#34d399,#059669);margin-top:6px;white-space:nowrap}
.fv-big.orange{background:linear-gradient(#fb923c,#ea580c)}
.fv-note{font-size:10.5px;color:#cbd5e1;line-height:1.45;margin-top:6px}
.fv-gain{display:flex;align-items:center;justify-content:space-between;font-size:12.5px;font-weight:900;padding:4px 2px;border-bottom:1px dashed #ffffff1f;white-space:nowrap}
.fv-gain em{font-style:normal;font-size:10.5px;padding:1px 7px;border-radius:8px;margin-right:6px}
.fv-pink{color:#f9a8d4}.fv-orange{color:#fdba74}.fv-sky{color:#7dd3fc}.fv-yel{color:#fde047}
.fv-chip{display:inline-flex;flex-direction:column;align-items:center;gap:2px;width:62px;padding:5px 2px;border-radius:12px;background:#ffffff10;border:1px solid #ffffff22;font-size:10.5px;font-weight:900;white-space:nowrap}
.fv-chip img{width:34px;height:34px;border-radius:50%;object-fit:cover;border:2px solid #fff6}
.fv-chip.on{background:linear-gradient(#f472b655,#f472b622);border-color:#f9a8d4}
.fv-chip.off{opacity:.4}
.fv-chips{display:flex;flex-wrap:wrap;gap:5px}
.fv-say,.fv-note,.fv-mid small,.fv-h small{word-break:auto-phrase}
.fv-say{background:#fff;color:#1e1b4b;border-radius:12px;padding:6px 9px;margin-bottom:5px;font-size:12.5px;font-weight:700;line-height:1.4}
.fv-say u{display:block;text-decoration:none;font-size:10px;font-weight:900;color:#db2777}
.fv-banner{width:max-content;position:absolute;left:50%;transform:translateX(-50%);background:#0f172ae6;border:1px solid #fde04788;color:#fef9c3;font-size:12px;font-weight:900;padding:5px 12px;border-radius:999px;white-space:nowrap}
.fv-toast{width:max-content;position:absolute;left:50%;transform:translateX(-50%);display:flex;align-items:center;gap:7px;background:linear-gradient(#fdf2f8,#fce7f3);color:#831843;border:2px solid #f9a8d4;border-radius:16px;padding:5px 12px 5px 6px;font-size:12.5px;font-weight:900;white-space:nowrap;box-shadow:0 6px 18px #0007}
.fv-toast img{width:28px;height:28px;border-radius:50%;object-fit:cover;border:2px solid #f472b6}
.fv-sw{flex:none;width:40px;height:22px;border-radius:999px;background:#10b981;position:relative}
.fv-sw:after{content:'';position:absolute;right:3px;top:3px;width:16px;height:16px;border-radius:50%;background:#fff}
.fv-sw.off{background:#475569}.fv-sw.off:after{right:auto;left:3px}
.fv-cols{display:flex;gap:8px}.fv-cols>div{flex:1;min-width:0}
`;

const html = {};
const face = (id) => `<img src="${'__F_' + id}">`;
const av = (ch, c) => `<span class="fv-av" style="background:${c}">${ch}</span>`;
html.pick = (land) => `
<div class="fv-sheet" style="${land ? 'left:auto;right:6px;top:6px;width:430px' : ''}">
  <div class="fv-h"><i>🏘</i><div><b>フレンドとの行き来</b><small>助手が自分で出かける ・ 今日あと1回出かけるかも</small></div></div>
  <div style="font-size:11px;font-weight:900;color:#f9a8d4;margin:2px 0 4px">いま</div>
  <div class="fv-row"><div class="fv-faces" style="margin:0">${face('mua')}${face('kiki')}</div><div class="fv-mid"><b>みゅあ・きき → あおいさんの家</b><small>🍰 おやつ ・ 昼の区切りで帰ってくる</small></div></div>
  <div class="fv-row"><div class="fv-faces" style="margin:0">${face('momosuke')}</div><div class="fv-mid"><b>ゆうとさんのももすけ が来ている</b><small>居間でひと休み ・ 14:20から</small></div><span class="fv-btn">見る</span></div>
  <div style="font-size:11px;font-weight:900;color:#f9a8d4;margin:6px 0 4px">今日の行き来</div>
  <div class="fv-row"><div class="fv-faces" style="margin:0">${face('atsu')}</div><div class="fv-mid"><b>あつ → こはるさんの家(帰ってきた)</b><small>朝 ・ 🎁 写真1枚・100P</small></div><span class="fv-btn">場面</span></div>
  ${land ? '' : `<div class="fv-row"><div class="fv-faces" style="margin:0">${face('sorashido')}</div><div class="fv-mid"><b>あおいさんのソラシド が来た</b><small>11:05 ・「お茶ごちそうさま」</small></div><span class="fv-btn gray">済み</span></div>`}
  <div class="fv-note">どの家へいつ行くかは助手が決める(1日3回まで・同じ家は1日1回・寝ている助手とけんか中の助手は行かない)。</div>
</div>`;
html.who = (land) => `
<div class="fv-sheet" style="${land ? 'left:auto;right:6px;top:6px;width:430px' : ''}">
  <div class="fv-h"><i>📒</i><div><b>行ったことのある家</b><small>この7日 ・ 助手が行きたがる順</small></div></div>
  <div class="fv-row">${av('あ', '#f472b6')}<div class="fv-mid"><b>あおいさんの家</b><small>🟢 いま遊んでいる ・ 行った4回・来た2回</small><div class="fv-faces">${face('dra')}${face('kyuko')}${face('erubin')}</div></div></div>
  <div class="fv-row">${av('ゆ', '#60a5fa')}<div class="fv-mid"><b>ゆうとさんの家</b><small>📷 きのう 21:10 ・ 行った1回・来た3回</small><div class="fv-faces">${face('momosuke')}${face('sorashido')}</div></div></div>
  <div class="fv-row">${av('こ', '#a78bfa')}<div class="fv-mid"><b>こはるさんの家</b><small>📷 今日 7:40 ・ 行った2回</small><div class="fv-faces">${face('mua')}</div></div></div>
  <div class="fv-gain"><span><em style="background:#38bdf833" class="fv-sky">🤝 顔なじみ</em>みゅあ と あおいさんのドラ</span><span class="fv-sky">5回</span></div>
  <div class="fv-note">家を押すと、その家での写真と場面を見返せる。行ってほしくない家は「⋯」から外せる。</div>
</div>`;
html.visit = (land) => `
<div class="fv-banner" style="${land ? 'top:12px;left:300px' : 'top:118px'}">📷 きのう 21:10 の様子(控え)</div>
<div class="fv-sheet" style="${land ? 'left:auto;right:6px;top:6px;width:430px' : ''}">
  <div class="fv-h"><i>🍰</i><div><b>あおいさんの家で遊んだ</b><small>みゅあ・きき ＋ あおいさんのドラ</small></div></div>
  <div class="fv-say"><u>みゅあ</u>あおいさんのドラ、部屋にトロフィー飾ってるぢゃん！まぢすごくない？</div>
  <div class="fv-say"><u style="color:#ea580c">あおいさんのドラ</u>へへっ、カード部屋で勝ちまくった分だ。おまえらのとこのドラにもよろしくな！</div>
  <div class="fv-say"><u style="color:#7c3aed">きき</u>おじゃましました。テストさんにも、楽しかったと伝えておきますね。</div>
  <div class="fv-note">相手の家の部屋・家具・助手の気分は、相手が最後に開いたときの控え。見るだけで、相手の家は変わらない。</div>
</div>`;
html.pvisit = (land) => `
<div class="fv-banner" style="${land ? 'top:12px;left:300px' : 'top:118px'}">🚪 訪ねている ・ 📷 きのう 21:10 の控え</div>
<div class="fv-sheet" style="${land ? 'left:auto;right:6px;top:auto;bottom:6px;width:430px' : ''}">
  <div class="fv-h"><i>🏘</i><div><b>あおいさんの家を訪ねている</b><small>部屋を押すと、家にいる助手に声をかけられる ・ 今日あと2軒</small></div></div>
  <div class="fv-cols"><span class="fv-btn gray" style="text-align:center">📒 家の写真</span><span class="fv-btn orange" style="text-align:center;background:linear-gradient(#fb923c,#ea580c)">✉️ 置き手紙を残して帰る</span></div>
</div>`;
html.ptalk = (land) => `
<div class="fv-sheet" style="${land ? 'left:auto;right:6px;top:6px;width:430px' : ''}">
  <div class="fv-h">${face('dra').replace('<img', '<img class="fv-av" style="padding:0"')}<div><b>あおいさんのドラ</b><small>カードの本を読んでいる ・ 顔なじみ 2回目</small></div></div>
  <div class="fv-say"><u style="color:#ea580c">あおいさんのドラ</u>おっ、テストか！ あおいなら今いないぞ。オレの新しいデッキでも見ていくか？</div>
  <div style="font-size:11px;font-weight:900;color:#f9a8d4;margin:6px 0 4px">返事を選ぶ</div>
  <div class="fv-row" style="margin-bottom:4px"><div class="fv-mid"><b>見せて！</b></div></div>
  <div class="fv-row" style="margin-bottom:4px"><div class="fv-mid"><b>あおいさんによろしくね</b></div></div>
  <div class="fv-row" style="margin-bottom:4px"><div class="fv-mid"><b>うちのドラも元気だよ</b></div></div>
  <div class="fv-note">返事は決まった文だけ。相手の助手の仲良し度は変わらない(相手のセーブには書かない)。</div>
</div>`;
html.pleave = (land) => `
<div class="fv-sheet" style="${land ? 'left:auto;right:6px;top:6px;width:430px' : ''}">
  <div class="fv-h"><i>✉️</i><div><b>置き手紙を残して帰る</b><small>あおいさんが次に開いたとき「テストさんが訪ねてくれた」と出る</small></div></div>
  <div class="fv-chips">
    <span class="fv-chip on" style="width:auto;padding:5px 9px">また来るね！</span><span class="fv-chip" style="width:auto;padding:5px 9px">お部屋すてき！</span>
    <span class="fv-chip" style="width:auto;padding:5px 9px">ドラによろしく</span><span class="fv-chip" style="width:auto;padding:5px 9px">こんど一緒に遊ぼう</span>
  </div>
  <div style="margin-top:8px">
    <div class="fv-gain"><span><em style="background:#38bdf833" class="fv-sky">📷 写真</em>「あおいさんの家で」(初めての家)</span><span class="fv-sky">1枚</span></div>
    <div class="fv-gain"><span><em style="background:#fde04733" class="fv-yel">🎁 おみやげ</em>ビートP(助手の分と合わせて1日300Pまで)</span><span class="fv-yel">50P</span></div>
  </div>
  <span class="fv-big orange">「また来るね！」を残して帰る</span>
</div>`;
html.pletters = (land) => `
<div class="fv-sheet" style="${land ? 'left:auto;right:6px;top:6px;width:430px' : ''}">
  <div class="fv-h"><i>✉️</i><div><b>留守のあいだに来てくれた</b><small>相手の画面(あおいさん側)・ 今日 2件</small></div></div>
  <div class="fv-row">${av('テ', '#f59e0b')}<div class="fv-mid"><b>テストさんが訪ねてくれた</b><small>21:40 ・「また来るね！」・ドラと話した</small></div><span class="fv-btn">お礼</span></div>
  <div class="fv-row">${face('mua').replace('<img', '<img class="fv-av" style="padding:0"')}<div class="fv-mid"><b>テストさんのみゅあ・きき</b><small>19:10 ・ 自分で遊びに来た</small></div><span class="fv-btn gray">済み</span></div>
  <div class="fv-note">お礼は決まった文から選ぶだけ。訪ねた人には、次に開いたとき「あおいさんからお礼が届いた」と出る。</div>
</div>`;
html.back = (land) => `
<div class="fv-sheet" style="${land ? 'left:auto;right:6px;top:6px;width:430px' : ''}">
  <div class="fv-h"><i>🏡</i><div><b>おかえり！</b><small>みゅあ と きき が 自分で あおいさんの家へ行っていた</small></div></div>
  <div class="fv-gain"><span><em style="background:#f472b633" class="fv-pink">♥ 仲良し度</em>みゅあ・きき</span><span class="fv-pink">+10 ずつ</span></div>
  <div class="fv-gain"><span><em style="background:#fb923c33" class="fv-orange">🤝 友情Lv</em>みゅあ・きき</span><span class="fv-orange">+4</span></div>
  <div class="fv-gain"><span><em style="background:#38bdf833" class="fv-sky">📷 写真</em>アルバム「あおいさんの家で」</span><span class="fv-sky">1枚</span></div>
  <div class="fv-gain"><span><em style="background:#fde04733" class="fv-yel">🎁 おみやげ</em>ビートP</span><span class="fv-yel">100P</span></div>
  <div class="fv-note">おみやげのビートPは1日300Pまで。道具・家具・ダイヤは配らない。</div>
  <span class="fv-big orange">アルバムで写真を見る</span>
</div>`;
html.letters = (land) => `
<div class="fv-sheet" style="${land ? 'left:auto;right:6px;top:6px;width:430px' : ''}">
  <div class="fv-h"><i>✉️</i><div><b>留守のあいだに来てくれた</b><small>今日 2人 ・ 来てもらえるのは1日2人まで</small></div></div>
  <div class="fv-row">${face('momosuke').replace('<img', '<img class="fv-av" style="padding:0"')}<div class="fv-mid"><b>ゆうとさんのももすけ</b><small>14:20 ・「また遊びに来るね！」</small></div><span class="fv-btn">お礼</span></div>
  <div class="fv-row">${face('sorashido').replace('<img', '<img class="fv-av" style="padding:0"')}<div class="fv-mid"><b>あおいさんのソラシド</b><small>11:05 ・「お茶ごちそうさま」</small></div><span class="fv-btn gray">済み</span></div>
  <div class="fv-gain"><span><em style="background:#f472b633" class="fv-pink">♥ 仲良し度</em>迎えたあつ</span><span class="fv-pink">+6</span></div>
  <div class="fv-note">一言は決まった文から選ぶだけ(自由に書けない)。お礼を返すと相手の置き手紙に一言が並ぶ。</div>
  <div class="fv-row" style="margin-top:6px"><div class="fv-mid"><b style="color:#fca5a5">🚫 この人の助手は来ないようにする</b><small>相手には知らせない ・ いつでも戻せる</small></div></div>
</div>`;
html.guard = (land) => `
<div class="fv-sheet" style="${land ? 'left:auto;right:6px;top:6px;width:430px' : ''}">
  <div class="fv-h"><i>🛡️</i><div><b>フレンドとの行き来の設定</b><small>🏘 フレンド →「設定」</small></div></div>
  <div class="fv-row"><div class="fv-mid"><b>フレンドの助手が遊びに来る</b><small>切にすると、だれも来ない</small></div><span class="fv-sw"></span></div>
  <div class="fv-row"><div class="fv-mid"><b>家の様子をフレンドに見せる</b><small>切にすると控えを送らず、訪ねられない</small></div><span class="fv-sw"></span></div>
  <div class="fv-row"><div class="fv-mid"><b>来ないようにした人</b><small>1人 ・ いつでも戻せる</small></div><span class="fv-btn gray">一覧</span></div>
  <div class="fv-note">フレンド(承認済み)だけ。解除・ブロックした人とは行き来しない。見せるのは呼び名・助手・部屋・家具・気分だけ。</div>
</div>`;

async function main() {
  const server = http.createServer((req, res) => {
    const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, ''), file = path.join(root, rel);
    if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream' }); fs.createReadStream(file).pipe(res);
  });
  await new Promise(r => server.listen(PORT, r));
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const open = async (w, h) => {
    const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 2 });
    page.on('pageerror', e => console.log('pageerror', String(e).slice(0, 200)));
    await page.addInitScript(() => { window.__mhSupabaseStubbed = true; });
    await page.addInitScript(quietBootSeed());
    await page.addInitScript(updateNoticeSeed());
    await page.addInitScript(oneTimeNoticeSeed());
    await page.addInitScript(seed, { storyIds: STORY_IDS, life: true, intro: false, bondAll: null });
    await page.route(/supabase|functions\/v1/, r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
    await page.goto(`http://localhost:${PORT}/monster-hero/index.html`, { waitUntil: 'domcontentloaded' });
    await toHome(page);
    await waitFaces(page); await finishTalk(page); await page.waitForTimeout(600);
    return page;
  };
  const faceMap = (page) => page.evaluate(() => { const o = {}; for (const id of ['mua', 'kiki', 'momosuke', 'dra', 'atsu', 'kyuko', 'sorashido', 'erubin']) { try { o[id] = assistantFaceSrc(assistantById(id), null); } catch { o[id] = ''; } } return o; });
  const openHouse = async (page) => { await page.locator('[data-home-assistant-life]').click({ timeout: 20000 }); await page.locator('[data-assistant-life-screen]').waitFor({ timeout: 5000 }); await page.locator('[data-assistant-life-intro]').waitFor({ state: 'detached', timeout: 5000 }).catch(() => {}); await page.waitForTimeout(500); };
  // 家の本物の DOM に案の部品を足す(5つ目のアイコン・みゅあときききの行き先・居間の来客・掲示板)
  const houseMods = (page, F) => page.evaluate((F) => {
    if (document.querySelector('[data-fv-icon]')) return;
    const icons = document.querySelector('[data-assistant-life-icons]');
    if (icons) { const b = icons.lastElementChild.cloneNode(true); b.setAttribute('data-fv-icon', '1'); b.className = ''; b.innerHTML = '<i>🏘</i>フレンド'; b.style.position = 'relative'; const n = document.createElement('span'); n.textContent = '2'; n.style.cssText = 'position:absolute;top:2px;right:6px;background:#ef4444;color:#fff;font-size:9px;border-radius:999px;padding:0 5px;line-height:15px'; b.appendChild(n); icons.appendChild(b); }
    for (const id of ['mua', 'kiki']) { const a = document.querySelector(`[data-assistant-life-room-away="${id}"]`); if (!a) continue; const b = a.querySelector('b'), s = a.querySelector('small'); if (b) b.textContent = '🏘 あおいさんの家へ'; if (s) s.textContent = '2人で遊びに'; a.style.outline = '2px solid #f472b6'; }
    const liv = document.querySelector('[data-assistant-life-living]');
    if (liv) {
      const door = liv.querySelector('.mhl-door'); const dl = parseFloat(door.style.left);
      const v = document.createElement('div'); v.style.cssText = `position:absolute;left:${dl + 2}px;bottom:4px;display:flex;flex-direction:column;align-items:center;z-index:3`;
      v.innerHTML = `<img src="${F.momosuke}" style="width:30px;height:30px;border-radius:50%;object-fit:cover;border:2px solid #f472b6;background:#0006"><span style="position:absolute;right:-8px;top:-6px;font-size:11px;background:#fce7f3;border:1px solid #f9a8d4;border-radius:999px;padding:0 2px;line-height:15px">🏘</span>`;
      liv.appendChild(v);
      const p = liv.querySelector('[data-assistant-life-board] p'); if (p) p.textContent = '14:20 🏘 ゆうとさんのももすけが来た';
    }
  }, F);
  const overlay = (page, inner, { rotFrame = false } = {}) => page.evaluate(({ inner, CSS, rotFrame }) => {
    document.querySelectorAll('.fv-root').forEach(e => e.remove());
    if (!document.getElementById('fv-css')) { const s = document.createElement('style'); s.id = 'fv-css'; s.textContent = CSS; document.head.appendChild(s); }
    const d = document.createElement('div'); d.className = 'fvx fv-root';
    const host = rotFrame ? (document.querySelector('[data-mh-view-rotation="true"]') || document.body) : document.body;
    d.style.cssText = `position:${rotFrame ? 'absolute' : 'fixed'};inset:0;z-index:2147483000;pointer-events:none`;
    d.innerHTML = inner; host.appendChild(d);
  }, { inner, CSS, rotFrame });
  const fill = (s, F) => s.replace(/__F_(\w+)/g, (_, id) => F[id] || '');
  const dim = '<div style="position:absolute;inset:0;background:#0007"></div>';
  const shot = async (page, name) => { await page.waitForTimeout(400); await page.screenshot({ path: path.join(OUT, name + '.png') }); console.log('shot', name); };

  for (const v of [{ id: 'tate', w: 390, h: 844, land: false }, { id: 'yoko', w: 844, h: 390, land: true }]) {
    const page = await open(v.w, v.h); const F = await faceMap(page);
    // HOME に来客の知らせ
    {
      await page.waitForTimeout(3500);
      const r = await page.evaluate(() => { const el = document.querySelector('.mh-home-facility.life'); if (!el) return null; const b = el.getBoundingClientRect(); return { x: b.right, y: b.top }; });
      await overlay(page, fill(`<span class="fv-tag">⑤ HOME: 来てくれた知らせ</span><div class="fv-toast" style="top:${v.land ? 150 : 735}px">${face('momosuke')}ゆうとさんのももすけが来ています</div>` + (r ? `<span style="position:absolute;left:${r.x - 14}px;top:${r.y - 16}px;background:#f472b6;color:#fff;font-size:11px;font-weight:900;border-radius:999px;padding:1px 7px;border:2px solid #fff">🏘 1</span>` : ''), F));
      await shot(page, `${v.id}-5-home`);
    }
    await openHouse(page); await houseMods(page, F);
    await overlay(page, '<span class="fv-tag">① 家: 行き来が家に出る</span>'); await shot(page, `${v.id}-1-house`);
    await overlay(page, fill(dim + '<span class="fv-tag">② いまの行き来・今日の記録</span>' + html.pick(v.land), F)); await shot(page, `${v.id}-2-pick`);
    await overlay(page, fill(dim + '<span class="fv-tag">③ 行ったことのある家</span>' + html.who(v.land), F)); await shot(page, `${v.id}-3-who`);
    // フレンドの家(控え): 題を差しかえ、部屋の札を相手の様子に
    const undo = await page.evaluate((F) => {
      const keep = [];
      const t = document.querySelector('[data-assistant-life-title] .mhl-ti'); if (t) { keep.push([t, t.textContent]); t.textContent = 'あおいさんの家'; }
      const sign = [...document.querySelectorAll('[data-assistant-life-screen] *')].find(e => e.children.length <= 1 && /^\s*🏡?\s*助手の家\s*$/.test(e.textContent)); if (sign) { keep.push([sign, sign.innerHTML, 'html']); sign.textContent = '🏘 あおいさんの家'; }
      const home = { dra: 'カードの本を読む', kyuko: 'お茶をいれる', erubin: 'ひと休み' };
      for (const room of document.querySelectorAll('[data-assistant-life-room]')) {
        const id = room.getAttribute('data-assistant-life-room');
        room.querySelectorAll('[data-assistant-life-room-away],[data-assistant-life-room-face],[data-assistant-life-room-bub],.bb,[data-assistant-life-room-with]').forEach(e => { keep.push([e, e.style.display, 'disp']); e.style.display = 'none'; });
        const d = document.createElement('div'); d.className = 'fv-room'; d.style.cssText = 'position:absolute;inset:0;display:flex;align-items:center;justify-content:center;gap:6px;z-index:4';
        if (home[id]) d.innerHTML = `<img src="${F[id]}" style="width:40px;height:40px;border-radius:50%;object-fit:cover;border:2px solid #fb923c;background:#0006"><span style="font-size:10px;font-weight:900;color:#78350f;background:#fef3c7;border:1px solid #f59e0b;border-radius:8px;padding:2px 6px;white-space:nowrap">${home[id]}</span>`;
        else d.innerHTML = `<span style="font-size:10px;font-weight:900;color:#475569;background:#f1f5f9cc;border:1px solid #94a3b8;border-radius:8px;padding:2px 6px;white-space:nowrap">おでかけ中</span>`;
        room.appendChild(d);
      }
      const liv = document.querySelector('[data-assistant-life-living]');
      if (liv) { const bp = liv.querySelector('[data-assistant-life-board] p'); if (bp) { keep.push([bp, bp.textContent]); bp.textContent = '🏘 みゅあ・ききが遊びに来ている'; }
        liv.querySelectorAll('div[style*="flex-direction:column"]').forEach(e => { keep.push([e, e.style.display, 'disp']); e.style.display = 'none'; });
        const door = liv.querySelector('.mhl-door'); const dl = parseFloat(door.style.left);
        const g = document.createElement('div'); g.className = 'fv-room'; g.style.cssText = `position:absolute;left:${dl - 26}px;bottom:4px;display:flex;gap:2px;z-index:4`;
        g.innerHTML = ['mua', 'kiki'].map(id => `<img src="${F[id]}" style="width:28px;height:28px;border-radius:50%;object-fit:cover;border:2px solid #f472b6;background:#0006">`).join('');
        liv.appendChild(g); }
      window.__fvKeep = keep; return true;
    }, F);
    await page.evaluate(() => document.querySelectorAll('[data-fv-icon]').forEach(e => e.style.display = 'none'));
    await overlay(page, fill('<span class="fv-tag">④ 場面: フレンドの家(控え)で</span>' + html.visit(v.land), F)); await shot(page, `${v.id}-4-visit`);
    // プレイヤーが自分で訪ねる(P1〜P3)
    await page.evaluate(() => { const liv = document.querySelector('[data-assistant-life-living]'); if (liv) { liv.querySelectorAll('.fv-room,div[style*="flex-direction:column"],div[style*="flex-direction: column"]').forEach(e => e.style.display = 'none'); const bp = liv.querySelector('[data-assistant-life-board] p'); if (bp) bp.textContent = '🚪 テストさんが訪ねている'; } const r = document.querySelector('[data-assistant-life-room="dra"]'); if (r) r.style.outline = '3px solid #fde047'; });
    await overlay(page, fill('<span class="fv-tag">P1 自分で訪ねる(控えの家)</span>' + html.pvisit(v.land), F)); await shot(page, `${v.id}-p1-visit`);
    await overlay(page, fill(dim + '<span class="fv-tag">P2 相手の助手に声をかける</span>' + html.ptalk(v.land), F)); await shot(page, `${v.id}-p2-talk`);
    await overlay(page, fill(dim + '<span class="fv-tag">P3 置き手紙を残して帰る</span>' + html.pleave(v.land), F)); await shot(page, `${v.id}-p3-leave`);
    await page.evaluate(() => { const r = document.querySelector('[data-assistant-life-room="dra"]'); if (r) r.style.outline = ''; });
    await page.evaluate(() => { for (const [e, v, k] of window.__fvKeep || []) { if (k === 'html') e.innerHTML = v; else if (k === 'disp') e.style.display = v; else e.textContent = v; } document.querySelectorAll('.fv-room').forEach(e => e.remove()); document.querySelectorAll('[data-fv-icon]').forEach(e => e.style.display = ''); });
    await overlay(page, fill(dim + '<span class="fv-tag">⑥ 帰ってきた・おみやげ</span>' + html.back(v.land), F)); await shot(page, `${v.id}-6-back`);
    await overlay(page, fill(dim + '<span class="fv-tag">⑦ 置き手紙(来てくれた人)</span>' + html.letters(v.land), F)); await shot(page, `${v.id}-7-letters`);
    await overlay(page, fill(dim + '<span class="fv-tag">⑧ 守り(設定)</span>' + html.guard(v.land), F)); await shot(page, `${v.id}-8-guard`);
    await overlay(page, fill(dim + '<span class="fv-tag">P4 訪ねられた側の置き手紙</span>' + html.pletters(v.land), F)); await shot(page, `${v.id}-p4-letters`);
    await page.close();
  }
  // 🔄横: モンヒロビートの中で回したときの知らせ(器の中に出す)
  for (const v of [{ id: 'rot390', w: 390, h: 844 }, { id: 'rot375', w: 375, h: 667 }]) {
    const page = await open(v.w, v.h); const F = await faceMap(page);
    await page.locator('.mh-home-facility.rhythm').click({ timeout: 10000 });
    await page.getByRole('button', { name: '戻る' }).first().waitFor({ timeout: 15000 });
    await page.evaluate(() => RHYTHM_VIEW_ROTATION.set(90)); await page.waitForTimeout(1200);
    const ok = await page.evaluate(() => !!document.querySelector('[data-mh-view-rotation="true"]'));
    console.log('rot frame', ok);
    await overlay(page, fill(`<span class="fv-tag">🔄横: モンヒロビートの中の知らせ</span><div class="fv-toast" style="top:46px">${face('momosuke')}ゆうとさんのももすけが遊びに来ています</div>`, F), { rotFrame: true });
    await shot(page, `${v.id}-beat-toast`);
    await overlay(page, fill(`<span class="fv-tag">🔄横: 訪ねてくれた知らせ</span><div class="fv-toast" style="top:46px"><span class="fv-av" style="width:28px;height:28px;background:#f472b6;font-size:13px">あ</span>あおいさんが訪ねてくれました</div>`, F), { rotFrame: true });
    await shot(page, `${v.id}-beat-toast2`);
    // 戻ると HOME は回さずに描く(家も回らない)
    await page.getByRole('button', { name: '戻る' }).first().click({ timeout: 5000 });
    await page.locator('.mh-home-player').waitFor({ timeout: 15000 }); await page.waitForTimeout(800);
    console.log('rot after back', await page.evaluate(() => RHYTHM_VIEW_ROTATION.active()));
    await page.close();
  }
  await browser.close(); server.close();
}
main().catch(e => { console.error(e); process.exit(1); });

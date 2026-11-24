// モードえらびの助手の枠(モンヒロバトル・MFバトルカード・モンヒロビート)で、立ち絵の顔の大きさを前後で測って撮る(助手部ナカヨシ・ゲームは変えない)
//   2026-11-24 r1119-153 追記4: #7449 で立ち絵を新しい全身絵(羽まで横に広い)から切り出したら、枠の中で顔が小さくなった(社長「モンバト助手の立ち絵こんなだったっけ？」)。
//   顔が #7449 の前より小さくならないことを、全助手・全服・縦横で確かめる
//   node tools/assistant/mode-select-stand-face-shots.js [--rev d57a7212^] [--views tate,tate-hikui,yoko] [--out docs/progress/assistant-art/r1119-153-switch/frame] [--only mua,kiki] [--screens battle,card,rhythm] [--no-shots]
//   前 = --rev の版(手元と違うファイルだけ git から配る)/後 = 手元
//   測るもの: 顔(目の線〜顎の先)の画面での長さ(px。頭のてっぺんは帽子・耳で点がぶれるので使わない)・枠の高さに対する割合・顔(目〜顎)が枠の中に入っているか
//   書き出し: <out>/mode-select-face.json(数字)・<out>/README.md(突き合わせ表。--table-only で数字から表だけ作り直す)・<out>/ms-<画面>-<向き>-<助手>.jpg(前後を左右に並べた枠の切り抜き)
//   最後の行: OK(全部、後の顔が前の 0.97 倍以上か元の絵の上限で、顔(目〜顎)が枠からはみ出していない)/NG
const http = require('http'), fs = require('fs'), path = require('path'), { execFileSync } = require('child_process');
const root = path.resolve(__dirname, '..', '..'), PORT = 9293;
const arg = (k, d) => { const i = process.argv.indexOf(k); return i >= 0 ? process.argv[i + 1] : d; };
const REV = arg('--rev', 'd57a7212^');
const OUT = path.resolve(root, arg('--out', 'docs/progress/assistant-art/r1119-153-switch/frame'));
const SHOTS = !process.argv.includes('--no-shots');
const SCREENS = arg('--screens', 'battle,card,rhythm').split(',');
// 助手 × 服(衣装の id・空はふだんの服)
const ALL = [
  ['mua', ''], ['mua', 'mua_halloween_2026'], ['mua', 'mua_card_master_v1'],
  ['kiki', ''], ['kiki', 'kiki_halloween_2026'], ['kiki', 'kiki_twintail_v1'],
  ['momosuke', ''], ['momosuke', 'momosuke_halloween_2026'],
  ['atsu', ''], ['kyuko', ''], ['kyuko', 'kyuko_winter_v1'],
  ['sorashido', ''], ['sorashido', 'sorashido_hosei_v1'], ['erubin', ''], ['erubin', 'erubin_sekiyuou_v1'],
];
const ONLY = arg('--only', '');
const LIST = ONLY ? ALL.filter(([w]) => ONLY.split(',').includes(w)) : ALL;
// tate-hikui … 縦で、助手の枠を高さ 150px に詰めたもの(社長の写真 frame/shacho-monbattle-select.png は、下に「いま〜にいる助手」の欄が出て枠が低かった)
const VIEWS = [{ tag: 'tate', w: 390, h: 844 }, { tag: 'tate-hikui', w: 390, h: 844, low: 150 }, { tag: 'yoko', w: 844, h: 390 }].filter(v => !arg('--views', '') || arg('--views', '').split(',').includes(v.tag));

// 数字では前の 0.97 倍に届かないが、止め絵を目で見て前と同じ大きさ以上だった組(前の版の顔の表が前の絵と合っていない・表情が違う)。キーは 画面/向き/助手。理由を書く
const EYE_OK = Object.freeze({
  'card/yoko/sorashido_hosei': '止め絵では前とほぼ同じ大きさ(前の版の表の目・顎の点が前の絵とずれている・表情が違う)',
});
const eyeOk = (r) => !!EYE_OK[`${r.screen}/${r.view}/${r.who}`];
// 突き合わせ表(<out>/README.md)。決めごとの行ごとに、止め絵のどこで満たすかと、組ごとの数字
const writeTable = (rows) => {
  const VN = { tate: '縦', 'tate-hikui': '縦・低い枠', yoko: '横' }, SN = { battle: 'モンヒロバトル', card: 'MFバトルカード', rhythm: 'モンヒロビート' };
  const bad = rows.filter(r => !((r.ratio >= 0.97) || r.capped || eyeOk(r)) || !r.inside), eyed = rows.filter(r => eyeOk(r) && !(r.ratio >= 0.97)), capped = rows.filter(r => r.capped && !(r.ratio >= 0.97));
  const min = (k) => Math.min(...rows.filter(r => r.ratio).map(r => r.ratio));
  const L = [];
  L.push('# モードえらびの枠の立ち絵: #7449 の前と後の顔の大きさ(r1119-153 追記4・追跡 r1124-012)', '');
  L.push('作り方: `node tools/assistant/mode-select-stand-face-shots.js`(前 = `' + REV + '`・後 = この枝)。顔 = 目の線〜顎の先の画面での長さ(px)。', '');
  L.push('前の版の顔の表は前の絵と合っていない所があり(例: きき ツインテール)、「前」の数字は目安。止め絵(`ms-<画面>-<向き>-<助手>.jpg`・左が前・右が後)で目でも確かめた。', '');
  L.push('## 決めごととの突き合わせ', '');
  L.push('| 決めごと | 満たし方 | どの止め絵で見るか |', '| --- | --- | --- |');
  L.push(`| r1119-153 追記4「顔が前より小さくならないように寄せ方を直す」 | 立ち絵を顔の位置と大きさで寄せる。${rows.length}組のうち前の0.97倍未満は ${bad.length}組${eyed.length ? `(ほかに数字は届かないが目で確かめた ${eyed.length}組: ${eyed.map(r => `${SN[r.screen]} ${VN[r.view]} ${r.who} ×${r.ratio} … ${EYE_OK[`${r.screen}/${r.view}/${r.who}`]}`).join('・')})` : ''}${capped.length ? `(ほかに元の絵が小さく上限で止めた ${capped.length}組: ${capped.map(r => `${SN[r.screen]} ${VN[r.view]} ${r.who} ×${r.ratio}`).join('・')})` : ''}。いちばん小さい倍率 ×${min()} | 全部の \`ms-*.jpg\`。社長の写真と同じ低い枠は \`ms-battle-tate-hikui-mua_halloween.jpg\` |`);
  L.push('| 同「絵は新しいまま・引き伸ばさない」 | 絵のファイルは替えない。画面での拡大は元の絵の顔の1.5倍まで(あつ・えるびん石油王のように元の絵が小さい組はそこで止める) | `ms-card-tate-atsu.jpg` |');
  L.push('| 同「モンヒロバトル・MFバトルカード・モンヒロビートのモード選びなど」 | 3画面とも同じ部品(ModeSelectAssistantPanel)なので、1か所の直しで3画面に効く | `ms-battle-*`・`ms-card-*`・`ms-rhythm-*` |');
  L.push('| 同「全助手・全服で前後を撮って確かめる」 | 全身絵からの立ち絵がある15組 × 3画面 × 縦・縦の低い枠・横 = ' + rows.length + '組 | 下の表 |');
  L.push('| r1115-143・r1119-153「色を減らさない・古い絵は消さない」 | 絵のファイルに触れていない | — |');
  L.push('| 顔が枠からはみ出さない | 顔(目〜顎)はどの組も枠の中' + (rows.some(r => !r.inside) ? '(★の組を除く)' : '') + '。背の低い枠では帽子・耳の先は切れてよいとした | `ms-*-tate-hikui-*.jpg` |', '');
  L.push('## 残り', '', '- きき ツインテール: 数字では前とほぼ同じだが、止め絵ではどの画面も1割ほど小さめに見える。大きなリボンが顔の約4倍の高さまであり、リボンを上で切れないようにする決まり(`assistant-art-scenes-check.js` の「上が切れる」10%まで)と両立する寄せ方では、ここまで。リボンを切ってよいかは判断が要る(窓口へ)', '');
  L.push('## 組ごとの数字', '', '| 画面 | 向き | 助手・服 | 枠の高さ | 前 | 後 | 倍 |', '| --- | --- | --- | --- | --- | --- | --- |');
  for (const r of rows) L.push(`| ${SN[r.screen]} | ${VN[r.view]} | ${r.who} | ${r.after ? r.after.frame.h : '-'} | ${r.before ? r.before.head : '-'} | ${r.after ? r.after.head : '-'} | ×${r.ratio}${r.inside ? '' : ' ★枠の外'}${r.capped && !(r.ratio >= 0.97) ? '(元の絵の上限)' : ''}${eyeOk(r) && !(r.ratio >= 0.97) ? '(目で確かめた)' : ''} |`);
  fs.writeFileSync(path.join(OUT, 'README.md'), L.join('\n') + '\n');
};
if (process.argv.includes('--table-only')) { writeTable(JSON.parse(fs.readFileSync(path.join(OUT, 'mode-select-face.json'), 'utf8')).rows); console.log('表を書いた'); process.exit(0); }

(async () => {
  let chromium;
  try { ({ chromium } = require('playwright')); } catch { console.log('SKIP: playwright が入っていないので撮れません'); process.exit(0); }
  const { quietBootSeed, updateNoticeSeed, oneTimeNoticeSeed } = require(path.resolve(__dirname, '..', 'boot/quiet-boot-seed'));
  const { MIME, STORY_IDS, seed, toHome, finishTalk } = require(path.resolve(__dirname, 'life-browser-shared'));
  const changed = new Set(execFileSync('git', ['diff', '--name-only', REV, '--', 'monster-hero'], { cwd: root, encoding: 'utf8' }).split('\n').filter(Boolean));
  let mode = 'after';
  const server = http.createServer((req, res) => {
    const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, ''), file = path.join(root, rel);
    if (!file.startsWith(root)) { res.writeHead(404); res.end(); return; }
    const type = MIME[path.extname(file).toLowerCase()] || 'application/octet-stream';
    if (mode === 'before' && changed.has(rel)) {
      try { const buf = execFileSync('git', ['show', `${REV}:${rel}`], { cwd: root, maxBuffer: 1 << 30 }); res.writeHead(200, { 'Content-Type': type }); res.end(buf); }
      catch { res.writeHead(404); res.end(); }
      return;
    }
    if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'Content-Type': type }); fs.createReadStream(file).pipe(res);
  });
  await new Promise(r => server.listen(PORT, r));
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ executablePath: fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined });
  const errors = [], rows = [], shots = [];
  const open = async (who, costume, view) => {
    const ctx = await browser.newContext({ viewport: { width: view.w, height: view.h }, deviceScaleFactor: 2, serviceWorkers: 'block' });
    const page = await ctx.newPage();
    page.on('pageerror', e => errors.push(`${mode} ${who}${costume ? ':' + costume : ''}: ${e.message}`));
    await page.addInitScript(() => { window.__mhSupabaseStubbed = true; });
    await page.addInitScript(quietBootSeed()); await page.addInitScript(updateNoticeSeed()); await page.addInitScript(oneTimeNoticeSeed());
    await page.addInitScript(seed, { storyIds: STORY_IDS, life: true, intro: false, bondAll: 130 });
    await page.addInitScript(({ who, costume }) => {
      if (localStorage.getItem('mh_check_ms_face') !== null) return;
      localStorage.setItem('mh_check_ms_face', '1');
      localStorage.setItem('mh_assistant_selected_v1', JSON.stringify(who));
      if (costume) {
        const owned = JSON.parse(localStorage.getItem('mh_assistant_costume_owned_v1') || '[]');
        localStorage.setItem('mh_assistant_costume_owned_v1', JSON.stringify([...new Set([...owned, costume])]));
        localStorage.setItem('mh_assistant_costume_worn_v1', JSON.stringify({ [who]: costume }));
      }
    }, { who, costume });
    await page.route(/supabase|functions\/v1/, r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
    await page.goto(`http://localhost:${PORT}/monster-hero/index.html`, { waitUntil: 'domcontentloaded' });
    await toHome(page); await finishTalk(page);
    for (let i = 0; i < 6; i++) { const sk = page.getByRole('button', { name: /^スキップ$/ }); if (!(await sk.count())) break; await sk.first().click({ timeout: 2000 }).catch(() => {}); await page.waitForTimeout(600); }
    await toHome(page); await finishTalk(page);
    return { ctx, page };
  };
  // 枠の中の絵と顔の点から、頭の画面での位置を出す(顔の点は 56-assistant-life-house.jsx の表・見えている体はその場で測る)
  const measure = (page) => page.evaluate(async () => {
    const img = document.querySelector('img[data-rhythm-mode-assistant-art]');
    const boxEl = document.querySelector('[data-rhythm-mode-assistant-art-box]');
    if (!img || !boxEl) return null;
    if (!img.complete) await new Promise(r => { img.onload = r; setTimeout(r, 3000); });
    await new Promise(r => setTimeout(r, 300));
    const src = img.getAttribute('src') || '';
    const m = /\/assistant\/[^/]+\/([a-z]+)_/i.exec(src);
    const who = (typeof ASSISTANTS !== 'undefined' ? ASSISTANTS : []).find(a => m && a.imagePrefix === m[1]);
    const pid = who ? who.id : '';
    const face = assistantLifeStandFace(pid, src);
    const box = await assistantLifeStandBox(src);
    const r = img.getBoundingClientRect(), b = boxEl.getBoundingClientRect();
    const vy = (f) => r.top + r.height * (box.t + (box.b - box.t) * f);
    const headTop = vy(face.top), eye = vy(face.eye), chin = vy(face.chin);
    return { src: src.replace(/\?.*$/, ''), pid, frame: { w: Math.round(b.width), h: Math.round(b.height), x: b.left, y: b.top },
      img: { w: Math.round(r.width), h: Math.round(r.height) }, head: +(chin - eye).toFixed(1), nat: +(img.naturalHeight * (box.b - box.t) * (face.chin - face.eye)).toFixed(1), headTop: +(headTop - b.top).toFixed(1), eye: +(eye - b.top).toFixed(1), chin: +(chin - b.top).toFixed(1) };
  });
  const goto = async (page, screen) => {
    await page.locator(`[data-home-fac="${screen}"]`).first().click({ timeout: 8000 });
    if (screen === 'card') {
      // はじめてのMFバトルカードは、最初のデッキえらびと練習を通ってからトップへ(tools/card/card-assistant-deck-view-browser-check.js と同じ手順)
      const starter = page.locator('[data-card-top="starter"]');
      await Promise.race([starter.waitFor({ timeout: 15000 }), page.locator('[data-card-top="top"]').waitFor({ timeout: 15000 })]).catch(() => {});
      if (await starter.count()) {
        await page.locator('[data-card-kit="powerful"]').click();
        await page.getByRole('button', { name: /にする$/ }).click();
        await require(path.resolve(__dirname, '..', 'card', 'lib', 'starter-open-pass.js'))(page);
        await page.locator('[data-card-tutor]').waitFor({ timeout: 20000 });
        await page.locator('[data-card-quit]').click();
        await page.locator('[data-confirm-sheet]').locator('xpath=..').getByRole('button', { name: '飛ばす' }).click();
        await page.getByRole('button', { name: 'トップへ' }).click();
        await page.locator('[data-card-top="top"]').waitFor({ timeout: 20000 });
      }
    }
    await page.locator('img[data-rhythm-mode-assistant-art]').first().waitFor({ timeout: 10000 });
    await page.waitForTimeout(1200);
  };
  try {
    for (const view of VIEWS) for (const screen of SCREENS) for (const [who, costume] of LIST) {
      const tag = `${who}${costume ? '_' + costume.replace(/^[a-z]+_|_v1$|_2026$/g, '') : ''}`;
      const pair = {};
      for (mode of ['before', 'after']) {
        let ctx = null;
        try {
          const o = await open(who, costume, view); ctx = o.ctx;
          await goto(o.page, screen);
          if (view.low) { await o.page.addStyleTag({ content: `[data-rhythm-mode-assistant]{flex:none!important;height:${view.low}px!important;min-height:0!important}` }); await o.page.waitForTimeout(600); }
          // 表情は台詞で変わるので、測るのは normal の範囲(どの表情も同じ枠)。表情は前後で同じとは限らない
          pair[mode] = await measure(o.page);
          if (SHOTS && pair[mode]) {
            const f = pair[mode].frame, file = path.join(OUT, `ms-${screen}-${view.tag}-${tag}-${mode}.png`);
            await o.page.screenshot({ path: file, clip: { x: Math.max(0, f.x - 4), y: Math.max(0, f.y - 4), width: f.w + 8, height: f.h + 8 } });
            shots.push(file);
          }
        } catch (e) { errors.push(`${mode} ${screen} ${view.tag} ${tag}: ${e.message.split('\n')[0]}`); }
        if (ctx) await ctx.close();
      }
      const b = pair.before, a = pair.after;
      const ratio = b && a ? +(a.head / b.head).toFixed(3) : null;
      // 顔(目の線〜顎)が枠の中か(背の低い枠では帽子・耳の先は切れてよい)。capped … 元の絵の顔の 1.45 倍以上(引き伸ばしの上限で止めた)
      const inside = a ? a.eye >= -2 && a.chin <= a.frame.h + 2 : false;
      const capped = !!(a && a.nat > 0 && a.head >= a.nat * 1.45);
      rows.push({ screen, view: view.tag, who: tag, before: b, after: a, ratio, inside, capped });
      console.log(`${screen.padEnd(6)} ${view.tag} ${tag.padEnd(22)} 顔 前${b ? b.head : '-'}px 後${a ? a.head : '-'}px ×${ratio} 枠${a ? a.frame.h : '-'} ${inside ? '' : '★顔が枠の外'}${capped ? '(元の絵の上限)' : ''}`);
    }
  } catch (e) { console.log('NG: 途中で止まった —', e.message.split('\n').slice(0, 3).join(' ')); }
  await browser.close(); server.close();
  fs.writeFileSync(path.join(OUT, 'mode-select-face.json'), JSON.stringify({ rev: REV, rows }, null, 1) + '\n');
  writeTable(rows);
  // 前・後を左右に並べる
  const pairs = shots.filter(f => f.endsWith('-before.png')).filter(f => fs.existsSync(f.replace('-before.png', '-after.png')));
  if (pairs.length) {
    execFileSync('python3', ['-I', '-c', `
import sys
from PIL import Image, ImageDraw, ImageFont
fnt = None
for fp in ('/usr/share/fonts/truetype/fonts-japanese-gothic.ttf', '/usr/share/fonts/truetype/wqy/wqy-zenhei.ttc', '/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc'):
    try:
        fnt = ImageFont.truetype(fp, 28); break
    except Exception:
        pass
for b in sys.argv[1:]:
    a = b.replace('-before.png', '-after.png')
    ib, ia = Image.open(b).convert('RGB'), Image.open(a).convert('RGB')
    W, H = ib.width + ia.width + 16, max(ib.height, ia.height) + 44
    out = Image.new('RGB', (W, H), (30, 30, 40)); out.paste(ib, (0, 44)); out.paste(ia, (ib.width + 16, 44))
    d = ImageDraw.Draw(out)
    d.text((10, 6), '前(#7449 の前)', fill=(255, 255, 255), font=fnt); d.text((ib.width + 26, 6), '後(手元)', fill=(255, 230, 120), font=fnt)
    s = 0.5; out = out.resize((int(out.width * s), int(out.height * s)), Image.LANCZOS)
    out.save(b.replace('-before.png', '.jpg'), quality=85, optimize=True)
`, ...pairs]);
    for (const f of shots) if (fs.existsSync(f)) fs.unlinkSync(f);
  }
  const bad = rows.filter(r => !((r.ratio >= 0.97) || r.capped || eyeOk(r)) || !r.inside);
  const cappedRows = rows.filter(r => r.capped && !(r.ratio >= 0.97));
  if (cappedRows.length) console.log(`元の絵が小さく上限で止めた(数えない): ${cappedRows.map(r => `${r.screen}/${r.view}/${r.who}×${r.ratio}`).join(' ')}`);
  if (errors.length) console.log('エラー: ' + errors.slice(0, 4).join(' / '));
  console.log(`${rows.length}組を測った・顔が前より小さい/枠の外: ${bad.length}組${bad.length ? ' ' + bad.slice(0, 8).map(r => `${r.screen}/${r.view}/${r.who}×${r.ratio}`).join(' ') : ''}`);
  const ok = !errors.length && rows.length && !bad.length;
  console.log(ok ? 'OK' : 'NG');
  process.exit(ok ? 0 : 1);
})();

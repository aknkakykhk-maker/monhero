#!/usr/bin/env node
// プロフィール画面と、アイコン・フレーム・好きなモンスターの選択画面(PickerSheet)を、実際のブラウザで確かめる。
//
//   node tools/profile/profile-pickers-check.js
//
// 背景(2026-10-03・ユーザー指摘): 「プロフィール画面を使いやすく、見やすく」「アイコンとフレーム設定が見にくい。
// 今の状態だと数が増えれば増えるほど分かりにくくなる」「好きなモンスター設定も見やすく」。
// 見張ること:
//  ① プロフィール: 名刺・設定タイル(アイコン/フレーム/ひとこと/好きなモンスター)・持ちもの・フレンドとアイテムの入口が並ぶ。
//     フレンドの入口は、バトル記録より前(開いてすぐ見える)。バトル記録は2列。横にはみ出さない
//  ② アイコン選択: いまの選択が上に固定され、名前で探せて、「はじめから/購入ずみ」で絞れて、一覧だけスクロールする。選ぶと保存して閉じる
//  ③ フレーム選択: 全フレームが並び(検査が前提にしている data 属性・「閉じる」・「フレーム：」の文言も保つ)、色の枠と助手の枠が見出しで分かれ、
//     鍵の説明が一覧の下に出て(スクロールしなくても見える)、選ぶと保存される
//  ④ 好きなモンスター: 名前で探せて、並べ替えができて、選ぶと保存される
//  ⑤ 実行時エラーが出ない
const fs = require('fs'), path = require('path'), http = require('http');
const ROOT = path.resolve(__dirname, '../..');
let failed = 0;
const ok = (name, cond, detail = '') => { console.log(`${cond ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`); if (!cond) failed++; };

const PORT = 9195;
const MIME = { '.html':'text/html', '.js':'text/javascript', '.json':'application/json', '.css':'text/css',
  '.png':'image/png', '.jpg':'image/jpeg', '.webp':'image/webp', '.svg':'image/svg+xml', '.mp3':'audio/mpeg', '.ico':'image/x-icon' };
const serve = () => new Promise(resolve => {
  const server = http.createServer((req, res) => {
    const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, ''), file = path.join(ROOT, rel);
    if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end(); return; }
    if (rel.endsWith('game-system.compiled.js')) {   // フレンドの項目(ひとこと・好きなモンスター)も見るため、公開フラグを開いた状態で配信する
      res.writeHead(200, { 'Content-Type': 'text/javascript' });
      res.end(fs.readFileSync(file, 'utf8').replace(/const FRIENDS_PUBLIC_RELEASE = (true|false)/, 'const FRIENDS_PUBLIC_RELEASE = true'));
      return;
    }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  });
  server.listen(PORT, () => resolve(server));
});

(async () => {
  let playwright;
  try { playwright = require('playwright'); }
  catch { console.log('SKIP: playwright が入っていないのでブラウザでの確認はできません'); process.exit(0); }
  const server = await serve();
  let browser;
  try {
    browser = await playwright.chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    const errors = [];
    page.on('pageerror', e => errors.push(String(e && e.message ? e.message : e)));
    await page.route('https://zrzevudkbgtxlbvmuziy.supabase.co/**', r => r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '[]' }));
    const monsterIds = ['Mocchi', 'Suezo', 'Golem', 'Tiger', 'Ham', 'Pixie', 'Mia', 'Pandora', 'Monol', 'Oboro', 'Plant', 'Zan', 'Eiki', 'KenshiMocchi', 'Mitarashi', 'Ark'];
    const marketIcons = ['mia_icon', 'pandora_icon', 'plant_icon', 'zan_icon', 'eiki_icon', 'kenshi_mocchi_icon', 'mitarashi_icon', 'ark_icon', 'iblis_icon', 'snegurochka_icon'];
    await page.addInitScript(([ids, icons]) => {
      const put = (k, v) => localStorage.setItem(k, JSON.stringify(v));
      put('mh_breeder_name', 'テスト'); put('mh_breeder_icon', 'Mocchi'); put('mh_intro_done', true); put('mh_onboarded', true);
      put('mh_tutorial_seen_v1', true); put('mh_battle_tutorial_seen_v1', true); put('mh_battle_tutorial_guide_shown_v1', true);
      put('mh_assistant_selected_v1', 'mua'); put('mh_assistant_unlock_seen_v1', true); put('mh_update_notice_seen_v1', true);
      put('mh_rhythm_tutorial_seen_v1', true); put('mh_breeder_id_v1', 'self-user');
      put('mh_masu_mons', ids.map((b, i) => ({ id: 1000 + i, baseId: b, bondXp: (i + 1) * 500 }))); put('mh_masu_migrated', true);
      put('mh_market_icons', icons);
    }, [monsterIds, marketIcons]);
    const clickText = async (pattern) => page.evaluate((source) => {
      const rx = new RegExp(source);
      const b = [...document.querySelectorAll('button')].filter(x => rx.test((x.innerText || '').replace(/\s+/g, ' ').trim()))[0];
      if (!b) return false; b.click(); return true;
    }, pattern);
    const dismiss = async () => { for (let i = 0; i < 12; i++) { if (!(await clickText('^(受け取る|閉じる|OK|確認|あとで|次へ|はじめる|決定|スキップ)$'))) break; await page.waitForTimeout(250); } };
    await page.goto(`http://localhost:${PORT}/monster-hero/index.html`, { waitUntil: 'load', timeout: 60000 });
    await page.waitForFunction(() => document.body?.innerText.includes('TAP TO START'), { timeout: 40000 });
    await page.getByRole('button', { name: 'TAP TO START' }).click({ force: true });
    await page.getByRole('button', { name: 'トップ画面へ進む' }).click({ timeout: 30000 });
    await page.waitForFunction(() => document.body.innerText.includes('モンヒロビート'), { timeout: 40000 });
    await dismiss();
    await page.evaluate(() => document.querySelector('.mh-home-player')?.click());
    await page.waitForSelector('[data-profile-battle-records]', { timeout: 15000 });
    await dismiss();
    await page.waitForTimeout(500);

    // ① プロフィール
    const layout = await page.evaluate(() => {
      const q = (s) => document.querySelector(s);
      const pos = (s) => { const e = q(s); return e ? e.getBoundingClientRect().top : null; };
      const records = q('[data-profile-battle-records]');
      const grid = records && records.querySelector('.grid');
      const cols = grid ? getComputedStyle(grid).gridTemplateColumns.split(' ').length : 0;
      return {
        card: !!q('[data-profile-card]'), tiles: [...document.querySelectorAll('[data-profile-settings] > button')].length,
        icon: !!q('[data-profile-tile=icon]'), frame: !!q('[data-profile-tile=frame]'), message: !!q('[data-profile-message]'), fav: !!q('[data-profile-favorite-masu]'),
        stats: !!q('[data-profile-stats]'), links: !!q('[data-profile-links]'), friends: !!q('[data-profile-friends]'),
        friendsTop: pos('[data-profile-friends]'), recordsTop: pos('[data-profile-battle-records]'), vh: window.innerHeight,
        cols, overflowX: document.documentElement.scrollWidth > window.innerWidth + 1,
        frameText: (q('[data-profile-tile=frame]') || {}).textContent || '', playtime: !!q('[data-profile-playtime]'),
      };
    });
    ok('プロフィールに名刺・設定タイル4つ・持ちもの・入口が並ぶ', layout.card && layout.tiles === 4 && layout.icon && layout.frame && layout.message && layout.fav && layout.stats && layout.links, JSON.stringify(layout));
    ok('フレンドの入口は、開いてすぐ見える位置(画面の中)で、バトル記録より前にある', layout.friends && layout.friendsTop < layout.vh && layout.friendsTop < layout.recordsTop, `${layout.friendsTop} / ${layout.recordsTop} / ${layout.vh}`);
    ok('バトル記録は2列で並ぶ', layout.cols === 2, `${layout.cols}列`);
    ok('フレームのボタンは「フレーム：◯◯」の文言を保つ(既存の検査が前提にしている)', /フレーム：フレームなし/.test(layout.frameText), layout.frameText);
    ok('プレイ時間のくわしい記録(今日・遊んだ日・数え始めた日)は残っている', layout.playtime);
    ok('プロフィールが横にはみ出さない', layout.overflowX === false);

    // ② アイコン選択
    await page.evaluate(() => document.querySelector('[data-profile-tile=icon]').click());
    await page.waitForSelector('[data-picker-sheet=icon]', { timeout: 5000 });
    const ic = await page.evaluate(() => {
      const sheet = document.querySelector('[data-picker-sheet=icon]');
      const body = sheet.querySelector('[data-picker-body]');
      const chips = [...sheet.querySelectorAll('[data-picker-chip]')].map(c => c.innerText.replace(/\s+/g, ' ').trim());
      return {
        preview: !!sheet.querySelector('[data-picker-preview]'), search: !!sheet.querySelector('[data-picker-search]'), chips,
        options: sheet.querySelectorAll('[data-icon-option]').length,
        labeled: [...sheet.querySelectorAll('[data-icon-option]')].every(b => (b.innerText || '').trim().length > 0),
        scrolls: body.scrollHeight > body.clientHeight, headFixed: getComputedStyle(body).overflowY === 'auto',
        closeText: [...sheet.querySelectorAll('button')].some(b => (b.innerText || '').trim() === '閉じる'),
        overflowX: document.documentElement.scrollWidth > window.innerWidth + 1,
      };
    });
    ok('アイコン選択: いまの選択・検索・絞り込みチップ・「閉じる」がある', ic.preview && ic.search && ic.chips.length === 3 && ic.closeText, JSON.stringify(ic.chips));
    // 購入したのは10個。同じキャラのまとめは「どれか1つでも持っていれば全部持っている」ので、中身(円盤石アイコン・覚醒など)6個ぶん増えて16個になる(2026-10-03)
    ok('アイコン選択: 全部のアイコンが名前つきで並ぶ(はじめから8+購入16=まとめの中身を含む)', ic.options === 24 && ic.labeled, `${ic.options}個`);
    ok('アイコン選択: チップに件数が出る', /すべて\s*24/.test(ic.chips[0]) && /はじめから\s*8/.test(ic.chips[1]) && /購入ずみ\s*16/.test(ic.chips[2]), ic.chips.join(' / '));
    ok('アイコン選択: 一覧だけがスクロールする', ic.scrolls && ic.headFixed);
    await page.fill('[data-picker-sheet=icon] [data-picker-search]', 'ミーア');
    await page.waitForTimeout(300);
    ok('アイコン選択: 名前で探すと絞られる', (await page.evaluate(() => [...document.querySelectorAll('[data-picker-sheet=icon] [data-icon-option]')].map(b => b.getAttribute('data-icon-option')).join(','))) === 'mia_icon,mia_disc_icon');
    await page.fill('[data-picker-sheet=icon] [data-picker-search]', '');
    await page.evaluate(() => document.querySelector('[data-picker-sheet=icon] [data-picker-chip=market]').click());
    await page.waitForTimeout(300);
    ok('アイコン選択: 「購入ずみ」で絞れる', (await page.evaluate(() => document.querySelectorAll('[data-picker-sheet=icon] [data-icon-option]').length)) === 16);
    await page.evaluate(() => document.querySelector('[data-icon-option=zan_icon]').click());
    await page.waitForTimeout(500);
    ok('アイコン選択: 選ぶと保存して閉じる', (await page.evaluate(() => localStorage.getItem('mh_breeder_icon'))) === '"zan_icon"' && (await page.evaluate(() => !document.querySelector('[data-picker-sheet]'))));

    // ③ フレーム選択
    await page.evaluate(() => document.querySelector('[data-profile-tile=frame]').click());
    await page.waitForSelector('[data-picker-sheet=frame]', { timeout: 5000 });
    const fr = await page.evaluate(() => {
      const sheet = document.querySelector('[data-picker-sheet=frame]');
      const opts = [...sheet.querySelectorAll('[data-profile-frame-option]')];
      return {
        total: opts.length, locked: opts.filter(o => o.getAttribute('data-profile-frame-locked') === 'yes').length,
        chips: [...sheet.querySelectorAll('[data-picker-chip]')].map(c => c.innerText.replace(/\s+/g, ' ').trim()),
        groups: [...sheet.querySelectorAll('h4')].map(h => h.innerText.trim()), search: !!sheet.querySelector('[data-picker-search]'),
        gold: (opts.find(o => o.getAttribute('data-profile-frame-option') === 'gold') || {}).textContent || '',
      };
    });
    ok('フレーム選択: 全フレームが並ぶ(鍵つきも)', fr.total >= 20 && fr.locked >= 1, `${fr.total}枚 / 鍵 ${fr.locked}`);
    ok('フレーム選択: 色の枠と助手の枠が見出しで分かれる', fr.groups.some(g => /色の枠/.test(g)) && fr.groups.some(g => /助手の枠/.test(g)), fr.groups.join(' / '));
    ok('フレーム選択: 「すべて/使える/もらう前」で絞れて、検索もある', fr.chips.length === 3 && /使える/.test(fr.chips[1]) && /もらう前/.test(fr.chips[2]) && fr.search, fr.chips.join(' / '));
    ok('フレーム選択: ボタンの文字は名前だけ(既存の検査が前提にしている)', fr.gold.trim() === 'ゴールド', `「${fr.gold.trim()}」`);
    await page.evaluate(() => document.querySelector('[data-picker-sheet=frame] [data-picker-chip=locked]').click());
    await page.waitForTimeout(300);
    ok('フレーム選択: 「もらう前」で、鍵つきだけに絞れる', await page.evaluate(() => { const o = [...document.querySelectorAll('[data-profile-frame-option]')]; return o.length > 0 && o.every(x => x.getAttribute('data-profile-frame-locked') === 'yes'); }));
    await page.evaluate(() => document.querySelector('[data-profile-frame-locked=yes]').click());
    await page.waitForTimeout(400);
    const info = await page.evaluate(() => {
      const e = document.querySelector('[data-profile-frame-locked-info]');
      if (!e) return null;
      const r = e.getBoundingClientRect();
      return { text: e.innerText.replace(/\s+/g, ' ').trim(), inView: r.top >= 0 && r.bottom <= window.innerHeight };
    });
    ok('フレーム選択: 鍵を押すと条件と進み具合が出て、スクロールしなくても見える', !!info && /でもらえます/.test(info.text) && /いまは Lv/.test(info.text) && info.inView, info ? `${info.text.slice(0, 40)} / inView=${info.inView}` : '出ない');
    await page.evaluate(() => document.querySelector('[data-picker-sheet=frame] [data-picker-chip=all]').click());
    await page.waitForTimeout(300);
    await page.evaluate(() => document.querySelector('[data-profile-frame-option=gold]').click());
    await page.waitForTimeout(500);
    ok('フレーム選択: 選ぶと保存される(開いたまま見比べられる)', (await page.evaluate(() => localStorage.getItem('mh_profile_frame_v1'))) === '"gold"' && (await page.evaluate(() => !!document.querySelector('[data-picker-sheet=frame]'))));
    await clickText('^閉じる$');
    await page.waitForTimeout(400);
    ok('フレームを閉じたら、プロフィールのタイルが「ゴールド」になる', (await page.evaluate(() => document.querySelector('[data-profile-tile=frame]').textContent)).includes('フレーム：ゴールド'));

    // ④ 好きなモンスター
    await page.evaluate(() => document.querySelector('[data-profile-favorite-masu]').click());
    await page.waitForSelector('[data-picker-sheet=favorite]', { timeout: 5000 });
    const fv = await page.evaluate(() => {
      const sheet = document.querySelector('[data-picker-sheet=favorite]');
      return { chips: [...sheet.querySelectorAll('[data-picker-chip]')].map(c => c.innerText.replace(/\s+/g, ' ').trim()), search: !!sheet.querySelector('[data-picker-search]'),
        options: sheet.querySelectorAll('[data-favorite-option]').length };
    });
    ok('好きなモンスター: 並べ替えのチップと検索がある', fv.chips.length === 3 && /絆Lv/.test(fv.chips[0]) && /総合力/.test(fv.chips[1]) && /名前/.test(fv.chips[2]) && fv.search, fv.chips.join(' / '));
    ok('好きなモンスター: 手持ち全員と「設定しない」が並ぶ', fv.options === monsterIds.length + 1, `${fv.options}件`);
    await page.fill('[data-picker-sheet=favorite] [data-picker-search]', 'ゴーレム');
    await page.waitForTimeout(300);
    ok('好きなモンスター: 名前で探せる', (await page.evaluate(() => [...document.querySelectorAll('[data-picker-sheet=favorite] [data-favorite-option]')].filter(b => b.getAttribute('data-favorite-option') !== 'none').length)) === 1);
    await page.evaluate(() => document.querySelector('[data-picker-sheet=favorite] [data-picker-chip=power]').click());
    await page.waitForTimeout(400);
    ok('好きなモンスター: 総合力順にすると、総合力が出る', /総合力\s*[\d,]+/.test(await page.evaluate(() => document.querySelector('[data-picker-sheet=favorite]').innerText)));
    await page.fill('[data-picker-sheet=favorite] [data-picker-search]', '');
    await page.evaluate(() => [...document.querySelectorAll('[data-favorite-option]')].find(b => b.getAttribute('data-favorite-option') !== 'none').click());
    await page.waitForTimeout(500);
    ok('好きなモンスター: 選ぶと保存して閉じる', /^"\d+"$/.test((await page.evaluate(() => localStorage.getItem('mh_favorite_masu_v1'))) || '') && (await page.evaluate(() => !document.querySelector('[data-picker-sheet]'))));
    ok('好きなモンスター: プロフィールのタイルに選んだ子が出る', !/まだ選んでいません/.test(await page.evaluate(() => document.querySelector('[data-profile-favorite-masu]').innerText)));

    // ⑤ 全体
    ok('選択画面を開いても、横にはみ出さない', ic.overflowX === false);
    ok('実行時エラーが出ていない', errors.length === 0, errors.slice(0, 2).join(' / ') || 'なし');
  } finally {
    if (browser) await browser.close();
    server.close();
  }
  console.log(failed ? `\n${failed}件のNGがあります` : '\nすべてOK');
  process.exit(failed ? 1 : 0);
})().catch((error) => { console.error(error); process.exit(1); });

#!/usr/bin/env node
// フレンド画面(プロフィール →「フレンド」)を、実際のブラウザで通しで確かめる。
//
//   node tools/friends/friends-screen-check.js
//
// 公開フラグ(FRIENDS_PUBLIC_RELEASE)は、配信時に見たい状態(true / false)へ書き換えて開く(本物のファイルは変えない)。
// Supabase への通信はすべて偽サーバー(fake-friends-server.js)へ差し替える。本物にはつながない。
//
// 見張ること:
//  ① 公開前(フラグ false)は、プロフィールに入口が出ない
//  ② 自分のフレンドコードが出る(登録も偽サーバーへ1回だけ)
//  ③ コードを入れて申請 → 「送った申請」に出る / 届いた申請を承認 → フレンド一覧に出る
//  ④ フレンドのプロフィールを開ける。解除は確認を挟み、行は消えず removed になる
//  ⑤ 表が無い環境(SQL未適用)では「準備中」と出て、画面は落ちない
//  ⑥ 実行時エラーが出ない
const fs = require('fs'), path = require('path'), http = require('http');
const { createFakeFriendsServer } = require('./fake-friends-server');
const ROOT = path.resolve(__dirname, '../..');
let failed = 0;
const ok = (name, cond, detail = '') => { console.log(`${cond ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`); if (!cond) failed++; };

const PORT = 9187;
const MIME = { '.html':'text/html', '.js':'text/javascript', '.json':'application/json', '.css':'text/css',
  '.png':'image/png', '.jpg':'image/jpeg', '.webp':'image/webp', '.svg':'image/svg+xml', '.mp3':'audio/mpeg', '.ico':'image/x-icon' };
const serve = (flagOn) => new Promise(resolve => {
  const server = http.createServer((req, res) => {
    const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, ''), file = path.join(ROOT, rel);
    if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end(); return; }
    if (rel.endsWith('game-system.compiled.js')) {
      // 本物のファイルのフラグがどちらでも、この検査が見たい状態(flagOn)へ書き換えて配信する
      const text = fs.readFileSync(file, 'utf8');
      const rx = /const FRIENDS_PUBLIC_RELEASE = (true|false)/;
      if (!rx.test(text)) { console.log('NG: 公開フラグの書き換え対象が見つかりません'); failed++; }
      res.writeHead(200, { 'Content-Type': 'text/javascript' });
      res.end(text.replace(rx, `const FRIENDS_PUBLIC_RELEASE = ${flagOn ? 'true' : 'false'}`));
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

  const runScenario = async (flagOn, { tablesMissing = false } = {}) => {
    const fake = createFakeFriendsServer();
    if (tablesMissing) { delete fake.db.friend_codes; delete fake.db.friend_links; }
    // 相手のぶんを仕込んでおく。コードは AAAA2222(友だち)・BBBB3333(申請を送ってくる人)
    if (!tablesMissing) {
      fake.db.friend_codes.push({ breeder_id: 'other-friend', friend_code: 'AAAA2222', created_at: fake.tick() });
      fake.db.friend_codes.push({ breeder_id: 'other-incoming', friend_code: 'BBBB3333', created_at: fake.tick() });
    }
    fake.db.friend_profiles.push({ breeder_id: 'other-friend', place: 'rhythm', started_on: '2026-09-01', play_seconds: 5 * 3600, best_bond: 20, best_bond_mon: 'Mocchi', best_power: 12345, best_power_mon: 'Pixie',
      favorite: { monsterId: 'Mocchi', name: 'モッチー', bondLevel: 20, power: 9876, detail: { v: 6, n: 'Mocchi' } }, updated_at: fake.tick() });
    fake.db.breeder_profiles.push({ breeder_id: 'other-friend', user_name: 'ともだちの子', icon: null, profile_frame: null, updated_at: new Date().toISOString() });
    fake.db.breeder_profiles.push({ breeder_id: 'other-incoming', user_name: 'とどいた子', icon: null, profile_frame: null, updated_at: new Date().toISOString() });

    const server = await serve(flagOn);
    let browser, result = {};
    try {
      browser = await playwright.chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--autoplay-policy=no-user-gesture-required'] });
      const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
      const errors = [];
      page.on('pageerror', e => errors.push(String(e && e.message ? e.message : e)));
      // Supabase への通信: フレンドの表だけ偽サーバーが答え、ほかは空で返す(記録・ランキングは空でよい)
      await page.route('https://zrzevudkbgtxlbvmuziy.supabase.co/**', async (route) => {
        const request = route.request();
        const url = request.url();
        if (/\/rest\/v1\/(friend_codes|friend_links|friend_profiles)/.test(url) || (/\/rest\/v1\/breeder_profiles/.test(url) && request.method() === 'GET' && /breeder_id=in\./.test(url))) {
          const out = fake.handle(url, request.method(), request.postData());
          await route.fulfill({ status: out.status, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' },
            body: out.body === undefined ? '' : JSON.stringify(out.body) });
          return;
        }
        if (request.method() === 'OPTIONS') { await route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' } }); return; }
        await route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '[]' });
      });
      await page.addInitScript(() => {
        const put = (k, v) => localStorage.setItem(k, JSON.stringify(v));
        put('mh_breeder_name', 'テスト'); put('mh_breeder_icon', '🐣'); put('mh_intro_done', true); put('mh_onboarded', true);
        put('mh_tutorial_seen_v1', true); put('mh_battle_tutorial_seen_v1', true); put('mh_battle_tutorial_guide_shown_v1', true);
        put('mh_assistant_selected_v1', 'mua'); put('mh_assistant_unlock_seen_v1', true); put('mh_update_notice_seen_v1', true);
        put('mh_rhythm_tutorial_seen_v1', true);
        put('mh_breeder_id_v1', 'self-user');
      });
      const clickText = async (pattern, nth = 0) => page.evaluate(([source, index]) => {
        const rx = new RegExp(source);
        const list = [...document.querySelectorAll('button')].filter(b => rx.test((b.innerText || '').replace(/\s+/g, ' ').trim()));
        if (!list[index]) return false;
        list[index].click();
        return true;
      }, [pattern, nth]);
      // FRIENDS_SHOT_DIR を渡すと、主な画面の写真をそこへ書き出す(見た目の確認用。渡さなければ何もしない)
      const shot = async (name) => { if (process.env.FRIENDS_SHOT_DIR) await page.screenshot({ path: path.join(process.env.FRIENDS_SHOT_DIR, `${name}.png`) }); };
      const bodyText = () => page.evaluate(() => document.body.innerText.replace(/\s+/g, ' '));
      await page.goto(`http://localhost:${PORT}/monster-hero/index.html`, { waitUntil: 'load', timeout: 60000 });
      await page.waitForFunction(() => document.body?.innerText.includes('TAP TO START'), { timeout: 40000 });
      await page.getByRole('button', { name: 'TAP TO START' }).click({ force: true });
      await page.getByRole('button', { name: 'トップ画面へ進む' }).click({ timeout: 30000 });
      await page.waitForFunction(() => document.body.innerText.includes('モンヒロビート'), { timeout: 40000 });
      for (let i = 0; i < 14; i++) {
        if (!(await clickText('^(受け取る|閉じる|OK|確認|あとで|次へ|はじめる|決定|スキップ)$'))) break;
        await page.waitForTimeout(250);
      }
      await page.evaluate(() => document.querySelector('.mh-home-player')?.click());
      await page.waitForSelector('[data-profile-battle-records]', { timeout: 15000 });
      await page.waitForTimeout(400);
      result.hasEntry = await page.evaluate(() => !!document.querySelector('[data-profile-friends]'));
      result.favoriteRow = await page.evaluate(() => (document.querySelector('[data-profile-favorite-masu]') || {}).innerText || '');
      result.friendsFirst = await page.evaluate(() => { const f = document.querySelector('[data-profile-friends]'); const b = document.querySelector('[data-profile-battle-records]'); return !!(f && b && (f.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING)); });
      if (!result.hasEntry) { result.errors = errors; return { result, fake }; }
      await page.evaluate(() => document.querySelector('[data-profile-friends]').click());
      await page.waitForSelector('[data-friends-phase]', { timeout: 15000 });
      await page.waitForFunction(() => document.querySelector('[data-friends-phase]')?.getAttribute('data-friends-phase') !== 'loading', { timeout: 15000 });
      result.phase = await page.evaluate(() => document.querySelector('[data-friends-phase]')?.getAttribute('data-friends-phase'));
      result.preparingText = (await bodyText()).includes('準備中');
      if (result.phase !== 'ready') { result.errors = errors; return { result, fake }; }

      // ② 自分のコード
      await clickText('^追加$');
      await page.waitForSelector('[data-friend-code]', { timeout: 5000 });
      await shot('1-add');
      result.myCode = await page.evaluate(() => document.querySelector('[data-friend-code]').innerText.replace('-', ''));
      result.registered = fake.db.friend_codes.filter(r => r.breeder_id === 'self-user').length;
      // ③ コードで申請
      await page.fill('input[aria-label="友だちのフレンドコード"]', 'aaaa-2222');
      await clickText('フレンド申請を送る');
      await page.waitForFunction(() => document.body.innerText.includes('申請を送りました'), { timeout: 8000 });
      result.sentStatus = fake.db.friend_links.find(r => r.requester_id === 'self-user' && r.target_id === 'other-friend')?.status;   // 送った直後の状態を控える
      await clickText('^申請');
      await page.waitForTimeout(300);
      result.outgoingShown = (await bodyText()).includes('ともだちの子');
      // 相手が承認したことにする(サーバー側で承認し、画面を開き直して読み込ませる)
      fake.db.friend_links.find(r => r.target_id === 'other-friend').status = 'accepted';
      // 届いた申請を1件つくる(相手から)
      fake.db.friend_links.push({ requester_id: 'other-incoming', target_id: 'self-user', status: 'pending', blocked_by: null, created_at: fake.tick(), updated_at: fake.tick() });
      await page.evaluate(() => document.querySelector('button[aria-label="プロフィールへ戻る"]')?.click());
      await page.waitForSelector('[data-profile-friends]', { timeout: 8000 });
      await page.evaluate(() => document.querySelector('[data-profile-friends]').click());
      await page.waitForFunction(() => document.querySelector('[data-friends-phase]')?.getAttribute('data-friends-phase') === 'ready', { timeout: 15000 });
      result.friendTab = (await bodyText()).includes('ともだちの子');
      await clickText('^申請');
      await page.waitForTimeout(300);
      await shot('2-requests');
      result.incomingShown = (await bodyText()).includes('とどいた子');
      await clickText('^承認$');
      await page.waitForTimeout(800);
      result.acceptedRow = fake.db.friend_links.find(r => r.requester_id === 'other-incoming')?.status;
      // ④ プロフィール閲覧と解除
      await clickText('^フレンド');
      await page.waitForTimeout(300);
      await shot('3-friends');
      result.presenceOnline = await page.evaluate(() => [...document.querySelectorAll('[data-friend-presence=online]')].map(e => e.innerText).join('|'));
      result.twoFriends = ((await bodyText()).match(/プロフィール ›/g) || []).length;
      // 見せる情報を仕込んだ「ともだちの子」の行のボタンを押す(先頭の人とは限らない)
      await page.evaluate(() => {
        const row = [...document.querySelectorAll('div')].filter(d => /ともだちの子/.test(d.innerText || '') && d.querySelector('button')).pop();
        [...row.querySelectorAll('button')].find(b => /プロフィール/.test(b.innerText))?.click();
      });
      await page.waitForSelector('[data-friends-profile]', { timeout: 5000 });
      await shot('4-profile');
      result.profileText = await bodyText();
      result.favoriteDetailButton = await page.evaluate(() => !!document.querySelector('[data-friend-favorite-detail]'));
      // 自分の「見せる情報」が、起動してしばらくすると送られている(最初の送信は3秒以上あと)
      for (let i = 0; i < 48 && !fake.db.friend_profiles.find(r => r.breeder_id === 'self-user'); i++) await page.waitForTimeout(250);
      result.selfRow = fake.db.friend_profiles.find(r => r.breeder_id === 'self-user') || null;
      await clickText('フレンドを解除');
      await page.waitForSelector('[data-confirm-sheet]', { timeout: 5000 });
      await clickText('^解除する$');
      await page.waitForTimeout(800);
      const target = fake.db.friend_links.filter(r => /other-(friend|incoming)/.test(r.requester_id + r.target_id) && r.status === 'removed');
      result.removedCount = target.length;
      result.afterRemoveText = await bodyText();
      result.deletes = fake.calls.deletes;
      result.crashed = await page.evaluate(() => document.body.innerText.includes('問題が発生しました'));
      result.errors = errors;
    } finally {
      if (browser) await browser.close();
      server.close();
    }
    return { result, fake };
  };

  // ① 公開前は入口が出ない
  const before = await runScenario(false);
  ok('公開前(フラグ false)は、プロフィールに入口が出ない', before.result.hasEntry === false);
  ok('公開前は実行時エラーが出ていない', before.result.errors.length === 0, before.result.errors.slice(0, 2).join(' / ') || 'なし');

  // ②〜④
  const run = await runScenario(true);
  const r = run.result;
  ok('公開後は、プロフィールに入口が出る', r.hasEntry === true);
  ok('フレンド画面が読み込めて ready になる', r.phase === 'ready', `${r.phase}`);
  ok('自分のフレンドコードが8文字で出る', /^[A-HJ-NP-Z2-9]{8}$/.test(r.myCode || ''), `${r.myCode}`);
  ok('自分のコードは1回だけ登録される', r.registered === 1, `${r.registered}件`);
  ok('コードを入れて申請すると、行が pending で作られる', r.sentStatus === 'pending');
  ok('「送った申請」に相手の名前が出る', r.outgoingShown === true);
  ok('承認された相手がフレンド一覧に出る', r.friendTab === true);
  ok('届いた申請が一覧に出る', r.incomingShown === true);
  ok('承認すると accepted になる', r.acceptedRow === 'accepted', `${r.acceptedRow}`);
  ok('フレンドが2人並ぶ', r.twoFriends === 2, `${r.twoFriends}人`);
  ok('プロフィールに相手の名前が出る', /ともだちの子|とどいた子/.test(r.profileText || '') && (r.profileText || '').includes('モンヒロビートの記録'));
  ok('プロフィールの一番上(バトル記録より前)にフレンドの入口がある', r.friendsFirst === true);
  ok('プロフィールに「好きなモンスター」の行がある', /好きなモンスター/.test(r.favoriteRow || '') && /まだ選んでいません/.test(r.favoriteRow || ''), `${r.favoriteRow}`);
  ok('フレンド一覧に、いまの場所(モンヒロビートで遊び中)が出る', /モンヒロビートで遊び中/.test(r.presenceOnline || ''), `${r.presenceOnline}`);
  ok('プロフィールにプレイ時間・遊びはじめ・最高絆Lv・最高総合力が出る', /5時間00分/.test(r.profileText || '') && /2026年9月1日/.test(r.profileText || '') && /Lv\.20/.test(r.profileText || '') && /12,345/.test(r.profileText || '') && /ピクシー/.test(r.profileText || ''));
  ok('プロフィールに好きなモンスターと「詳細」が出る', /好きなモンスター/.test(r.profileText || '') && /モッチー/.test(r.profileText || '') && r.favoriteDetailButton === true);
  ok('自分の見せる情報が、起動後に friend_profiles へ送られる', !!r.selfRow && ['home','battle','rhythm','multi','masu','market','other'].includes(r.selfRow.place), JSON.stringify(r.selfRow && r.selfRow.place));
  ok('解除すると removed になり、行は消えない', r.removedCount >= 1, `${r.removedCount}件`);
  ok('解除後は一覧に戻る', (r.afterRemoveText || '').includes('プロフィール ›') || (r.afterRemoveText || '').includes('まだフレンドがいません'));
  ok('DELETE を一度も使っていない', r.deletes === 0);
  ok('画面が落ちていない', r.crashed === false);
  ok('実行時エラーが出ていない', r.errors.length === 0, r.errors.slice(0, 2).join(' / ') || 'なし');

  // ⑦ マルチへの招待(部屋の中から招く / 入口で招待を受けて参加する)
  const runInviteScenario = async () => {
    const fake = createFakeFriendsServer();
    const looks = (id, name) => fake.db.breeder_profiles.push({ breeder_id: id, user_name: name, icon: null, profile_frame: null, updated_at: new Date().toISOString() });
    looks('friend-1', 'さそう子'); looks('friend-2', 'さそわれる子');
    // 自分(self-user)は friend-1・friend-2 の両方と承認済み
    fake.db.friend_links.push({ requester_id: 'self-user', target_id: 'friend-1', status: 'accepted', blocked_by: null, created_at: fake.tick(), updated_at: fake.tick() });
    fake.db.friend_links.push({ requester_id: 'friend-2', target_id: 'self-user', status: 'accepted', blocked_by: null, created_at: fake.tick(), updated_at: fake.tick() });
    // 承認していない人(stranger)からの招待は出ない
    fake.db.friend_invites.push({ sender_id: 'stranger', target_id: 'self-user', room_code: 'ZZ99', created_at: fake.tick() });
    const server = await serve(true);
    let browser; const out = {};
    try {
      browser = await playwright.chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--autoplay-policy=no-user-gesture-required'] });
      const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
      const errors = [];
      page.on('pageerror', e => errors.push(String(e && e.message ? e.message : e)));
      await page.route('https://zrzevudkbgtxlbvmuziy.supabase.co/**', async (route) => {
        const request = route.request(); const url = request.url();
        if (/\/rest\/v1\/(friend_codes|friend_links|friend_invites|friend_profiles)/.test(url) || (/\/rest\/v1\/breeder_profiles/.test(url) && request.method() === 'GET' && /breeder_id=in\./.test(url))) {
          const res = fake.handle(url, request.method(), request.postData());
          await route.fulfill({ status: res.status, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: res.body === undefined ? '' : JSON.stringify(res.body) });
          return;
        }
        if (request.method() === 'OPTIONS') { await route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' } }); return; }
        await route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '[]' });
      });
      await page.addInitScript(() => {
        const put = (k, v) => localStorage.setItem(k, JSON.stringify(v));
        put('mh_breeder_name', 'テスト'); put('mh_breeder_icon', '🐣'); put('mh_intro_done', true); put('mh_onboarded', true);
        put('mh_tutorial_seen_v1', true); put('mh_battle_tutorial_seen_v1', true); put('mh_battle_tutorial_guide_shown_v1', true);
        put('mh_assistant_selected_v1', 'mua'); put('mh_assistant_unlock_seen_v1', true); put('mh_update_notice_seen_v1', true);
        put('mh_rhythm_tutorial_seen_v1', true); put('mh_breeder_id_v1', 'self-user');
      });
      const clickText = async (pattern, nth = 0) => page.evaluate(([source, index]) => {
        const rx = new RegExp(source);
        const list = [...document.querySelectorAll('button')].filter(b => rx.test((b.innerText || '').replace(/\s+/g, ' ').trim()));
        if (!list[index]) return false;
        list[index].click();
        return true;
      }, [pattern, nth]);
      await page.goto(`http://localhost:${PORT}/monster-hero/index.html`, { waitUntil: 'load', timeout: 60000 });
      await page.waitForFunction(() => document.body?.innerText.includes('TAP TO START'), { timeout: 40000 });
      await page.getByRole('button', { name: 'TAP TO START' }).click({ force: true });
      await page.getByRole('button', { name: 'トップ画面へ進む' }).click({ timeout: 30000 });
      await page.waitForFunction(() => document.body.innerText.includes('モンヒロビート'), { timeout: 40000 });
      for (let i = 0; i < 14; i++) {
        if (!(await clickText('^(受け取る|閉じる|OK|確認|あとで|次へ|はじめる|決定|スキップ)$'))) break;
        await page.waitForTimeout(250);
      }
      // ホーム → モンヒロビート(最初にモードえらび。フレンドの招待もここに出る。2026-10-03)
      await page.evaluate(() => document.querySelector('.mh-home-facility.rhythm')?.click());
      await page.waitForSelector('[data-rhythm-mode-select]', { timeout: 20000 });
      // 入口: 招待が出る(フレンドからだけ。知らない人の招待は出ない)。まだ招待は無いので、最初は出ない
      await page.waitForTimeout(1500);
      out.noInviteYet = await page.evaluate(() => !document.querySelector('[data-rhythm-multi-friend-invites]'));
      // friend-2 から招待が届く
      fake.db.friend_invites.push({ sender_id: 'friend-2', target_id: 'self-user', room_code: 'AB23', created_at: fake.tick() });
      await page.waitForSelector('[data-rhythm-multi-friend-invites]', { timeout: 15000 });
      out.inviteText = await page.evaluate(() => document.querySelector('[data-rhythm-multi-friend-invites]').innerText.replace(/\s+/g, ' '));
      if (process.env.FRIENDS_SHOT_DIR) await page.screenshot({ path: path.join(process.env.FRIENDS_SHOT_DIR, '5-multi-invite.png') });
      // 参加すると、その部屋コードに入る
      await page.evaluate(() => document.querySelector('[data-rhythm-multi-friend-join]').click());
      await page.waitForSelector('[data-rhythm-multi-room-code]', { timeout: 10000 });
      out.joinedCode = await page.evaluate(() => document.querySelector('[data-rhythm-multi-room-code]').innerText.trim());
      // 部屋の中から招く(プライベートの部屋なので出る)
      await page.evaluate(() => document.querySelector('[data-rhythm-multi-friend-invite-toggle]').click());
      await page.waitForSelector('[data-rhythm-multi-friend-row]', { timeout: 10000 });
      out.rosterRows = await page.evaluate(() => document.querySelectorAll('[data-rhythm-multi-friend-row]').length);
      if (process.env.FRIENDS_SHOT_DIR) await page.screenshot({ path: path.join(process.env.FRIENDS_SHOT_DIR, '6-multi-room-invite.png') });
      await page.evaluate(() => document.querySelector('[data-rhythm-multi-friend-send]').click());
      await page.waitForTimeout(800);
      out.sent = fake.db.friend_invites.filter(r => r.sender_id === 'self-user');
      out.sentLabel = await page.evaluate(() => document.querySelector('[data-rhythm-multi-friend-send]').innerText.trim());
      out.crashed = await page.evaluate(() => document.body.innerText.includes('問題が発生しました'));
      out.errors = errors;
    } finally {
      if (browser) await browser.close();
      server.close();
    }
    return out;
  };
  const inv = await runInviteScenario();
  ok('招待が無いあいだは、入口に何も出ない', inv.noInviteYet === true);
  ok('承認済みのフレンドからの招待だけが入口に出る', /さそわれる子さんが部屋に誘っています/.test(inv.inviteText || '') && !/ZZ99|stranger/.test(inv.inviteText || ''), `${inv.inviteText}`);
  ok('「参加する」でその部屋コードの部屋に入る', inv.joinedCode === 'AB23', `${inv.joinedCode}`);
  ok('部屋の中のフレンド名簿に、承認済みの2人が並ぶ', inv.rosterRows === 2, `${inv.rosterRows}人`);
  ok('「招待する」で friend_invites に部屋コードが書かれる', Array.isArray(inv.sent) && inv.sent.length === 1 && /^[A-HJ-NP-Z2-9]{4}$/.test(inv.sent[0].room_code) && inv.sent[0].room_code === 'AB23', JSON.stringify((inv.sent || []).map(r => `${r.target_id}:${r.room_code}`)));
  ok('招待したあとはボタンが「招待ずみ」になる', inv.sentLabel === '招待ずみ', `${inv.sentLabel}`);
  ok('マルチの画面が落ちていない', inv.crashed === false);
  ok('マルチの招待で実行時エラーが出ていない', inv.errors.length === 0, inv.errors.slice(0, 2).join(' / ') || 'なし');

  // ⑧ 届いた申請の目立たせ方(HOME・プロフィールのバッジ / 起動時の助手の知らせ / 「申請」タブを先に開く)
  const runBadgeScenario = async () => {
    const fake = createFakeFriendsServer();
    fake.db.breeder_profiles.push({ breeder_id: 'other-incoming', user_name: 'とどいた子', icon: null, profile_frame: null, updated_at: new Date().toISOString() });
    fake.db.friend_links.push({ requester_id: 'other-incoming', target_id: 'self-user', status: 'pending', blocked_by: null, created_at: fake.tick(), updated_at: fake.tick() });
    const server = await serve(true);
    let browser; const out = {};
    try {
      browser = await playwright.chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--autoplay-policy=no-user-gesture-required'] });
      const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
      const errors = [];
      page.on('pageerror', e => errors.push(String(e && e.message ? e.message : e)));
      await page.route('https://zrzevudkbgtxlbvmuziy.supabase.co/**', async (route) => {
        const request = route.request(); const url = request.url();
        if (/\/rest\/v1\/(friend_codes|friend_links|friend_profiles|friend_invites)/.test(url) || (/\/rest\/v1\/breeder_profiles/.test(url) && request.method() === 'GET' && /breeder_id=in\./.test(url))) {
          const res = fake.handle(url, request.method(), request.postData());
          await route.fulfill({ status: res.status, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: res.body === undefined ? '' : JSON.stringify(res.body) });
          return;
        }
        if (request.method() === 'OPTIONS') { await route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' } }); return; }
        await route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '[]' });
      });
      await page.addInitScript(() => {
        const put = (k, v) => localStorage.setItem(k, JSON.stringify(v));
        put('mh_breeder_name', 'テスト'); put('mh_breeder_icon', '🐣'); put('mh_intro_done', true); put('mh_onboarded', true);
        put('mh_tutorial_seen_v1', true); put('mh_battle_tutorial_seen_v1', true); put('mh_battle_tutorial_guide_shown_v1', true);
        put('mh_assistant_selected_v1', 'mua'); put('mh_assistant_unlock_seen_v1', true); put('mh_update_notice_seen_v1', true);
        put('mh_rhythm_tutorial_seen_v1', true); put('mh_breeder_id_v1', 'self-user');
      });
      const clickText = async (pattern, nth = 0) => page.evaluate(([source, index]) => {
        const rx = new RegExp(source);
        const list = [...document.querySelectorAll('button')].filter(b => rx.test((b.innerText || '').replace(/\s+/g, ' ').trim()));
        if (!list[index]) return false;
        list[index].click();
        return true;
      }, [pattern, nth]);
      await page.goto(`http://localhost:${PORT}/monster-hero/index.html`, { waitUntil: 'load', timeout: 60000 });
      await page.waitForFunction(() => document.body?.innerText.includes('TAP TO START'), { timeout: 40000 });
      await page.getByRole('button', { name: 'TAP TO START' }).click({ force: true });
      await page.getByRole('button', { name: 'トップ画面へ進む' }).click({ timeout: 30000 });
      await page.waitForFunction(() => document.body.innerText.includes('モンヒロビート'), { timeout: 40000 });
      // 割り込む別の案内だけを閉じる(フレンドの知らせの「あとで」は押さない)
      for (let round = 0; round < 40; round++) {
        if (await page.evaluate(() => !!document.querySelector('[data-friend-request-notice]'))) break;
        await clickText('^(受け取る|閉じる|OK|確認|次へ|はじめる|決定|スキップ)$');
        await page.waitForTimeout(400);
      }
      out.noticeShown = await page.evaluate(() => !!document.querySelector('[data-friend-request-notice]'));
      out.noticeText = await page.evaluate(() => (document.querySelector('[data-friend-request-notice]') || {}).innerText || '');
      if (process.env.FRIENDS_SHOT_DIR) await page.screenshot({ path: path.join(process.env.FRIENDS_SHOT_DIR, '7-request-notice.png') });
      // 「あとで」で閉じても申請は残り、HOMEの赤いバッジに件数が出る
      await page.evaluate(() => document.querySelector('[data-friend-notice-later]')?.click());
      await page.waitForTimeout(400);
      out.noticeClosed = await page.evaluate(() => !document.querySelector('[data-friend-request-notice]'));
      out.homeBadge = await page.evaluate(() => (document.querySelector('[data-home-friend-badge]') || {}).innerText || '');
      if (process.env.FRIENDS_SHOT_DIR) await page.screenshot({ path: path.join(process.env.FRIENDS_SHOT_DIR, '8-home-badge.png') });
      await page.evaluate(() => document.querySelector('.mh-home-player')?.click());
      await page.waitForSelector('[data-profile-battle-records]', { timeout: 15000 });
      out.profileBadge = await page.evaluate(() => (document.querySelector('[data-friend-badge]') || {}).innerText || '');
      out.profileText = await page.evaluate(() => (document.querySelector('[data-profile-friends]') || {}).innerText || '');
      if (process.env.FRIENDS_SHOT_DIR) await page.screenshot({ path: path.join(process.env.FRIENDS_SHOT_DIR, '9-profile-badge.png') });
      await page.evaluate(() => document.querySelector('[data-profile-friends]').click());
      await page.waitForFunction(() => document.querySelector('[data-friends-phase]')?.getAttribute('data-friends-phase') === 'ready', { timeout: 15000 });
      await page.waitForTimeout(300);
      // 申請が届いているので、最初から「申請」のタブが開いていて、承認ボタンが見える
      out.requestsFirst = await page.evaluate(() => [...document.querySelectorAll('button')].some(b => /^承認$/.test((b.innerText || '').trim())));
      // 承認すると、バッジが消える
      await clickText('^承認$');
      await page.waitForTimeout(800);
      await page.evaluate(() => document.querySelector('button[aria-label="プロフィールへ戻る"]')?.click());
      await page.waitForSelector('[data-profile-friends]', { timeout: 8000 });
      out.badgeAfter = await page.evaluate(() => !!document.querySelector('[data-friend-badge]'));
      out.crashed = await page.evaluate(() => document.body.innerText.includes('問題が発生しました'));
      out.errors = errors;
    } finally {
      if (browser) await browser.close();
      server.close();
    }
    return out;
  };
  const badge = await runBadgeScenario();
  ok('申請が届いていると、起動後のHOMEで助手が知らせる', badge.noticeShown === true && /とどいた子さんからフレンド申請/.test(badge.noticeText), `${badge.noticeText}`);
  ok('「あとで」で知らせを閉じられる', badge.noticeClosed === true);
  ok('HOME左上のプロフィールに、申請の件数の赤いバッジが出る', badge.homeBadge === '1', `${badge.homeBadge}`);
  ok('プロフィールのフレンドのボタンにも赤いバッジと文言が出る', badge.profileBadge === '1' && /フレンド申請が1件届いています/.test(badge.profileText), `${badge.profileBadge} / ${badge.profileText}`);
  ok('申請が届いているときは、最初から「申請」のタブが開く', badge.requestsFirst === true);
  ok('承認すると、プロフィールのバッジが消える', badge.badgeAfter === false);
  ok('バッジの画面が落ちていない', badge.crashed === false);
  ok('バッジの画面で実行時エラーが出ていない', badge.errors.length === 0, badge.errors.slice(0, 2).join(' / ') || 'なし');

  // ⑤ 表が無い環境
  const missing = await runScenario(true, { tablesMissing: true });
  ok('表が無い環境では「準備中」と出る', missing.result.phase === 'notready' && missing.result.preparingText === true, `${missing.result.phase}`);
  ok('表が無い環境でも実行時エラーが出ない', missing.result.errors.length === 0, missing.result.errors.slice(0, 2).join(' / ') || 'なし');

  console.log(failed ? `\n${failed}件のNGがあります` : '\nすべてOK');
  process.exit(failed ? 1 : 0);
})().catch((error) => { console.error(error); process.exit(1); });

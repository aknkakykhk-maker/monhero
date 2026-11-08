#!/usr/bin/env node
// モードえらびの「いまモンヒロビートにいる人」(2026-11-08 社長「モンビーにいる場合どこで一緒にやれるかとかわかりやすくしてほしい」・決めごとは全部 A)。
//
//   node tools/ui/rhythm-beat-presence-check.js
//   SHOT_DIR=<フォルダ> を付けると、縦・横・🔄横で、帯・助手の窓・フリーマッチのシートを撮る
//
// 実際のブラウザで、Supabase(フレンドの名簿・今)とフリーマッチの部屋の知らせ(Realtime)を、この検査の中だけ作り物にして確かめる。
//   ① 帯: 練習中の助手(🎤 呼べる)と、フレンド(🏠 部屋あり → 💌 誘える → 🎮 部屋で遊び中 の順)が並ぶ。「部屋で待ち中」だけの人(カードの部屋かもしれない)は出さない
//   ② 助手の顔: 「フリーマッチかプライベートの部屋で呼ぶと…ソロライブには来られません」の1行と「部屋を作って呼ぶ」
//   ③ 部屋を作って呼ぶ: フリーマッチの部屋ができ、呼ぶ窓が助手のタブで、その助手に印が付いて開く
//   ④ フレンドの顔(部屋あり)は「入る」・(遊び中)はボタンなし
//   ⑤ フリーマッチのシートの先頭に「🤝 フレンドがいます」(部屋あり=入る/いる=作って誘う)
//   ⑥ だれもいなければ帯は出ない ⑦ 画面の外に出ない・画面のエラーが無い
const fs = require('fs');
const path = require('path');
const http = require('http');
const ROOT = path.resolve(__dirname, '..', '..');
const SHOT_DIR = process.env.SHOT_DIR || '';
let failed = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`); if (!ok) failed++; };
let chromium;
try { ({ chromium } = require(path.join(ROOT, 'tools', 'node_modules', 'playwright'))); } catch (e) { console.log('SKIP: playwright が入っていないので確かめられません'); process.exit(0); }
const { quietBootSeed, updateNoticeSeed } = require(path.resolve(__dirname, '..', 'boot', 'quiet-boot-seed'));
const PORT = 8964;
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.PNG': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.json': 'application/json', '.mp3': 'audio/mpeg' };
const SELF = 'selfbreeder01';
const FRIENDS = [
  { id: 'friendroom01', name: 'ぴよ', place: 'rhythm', frame: 'gold' },          // 部屋を開いている(部屋の知らせで見つかる)・色の輪のフレーム
  { id: 'friendhere01', name: 'タロウ', place: 'rhythm', frame: 'frame_mocchi' }, // いる・部屋はまだ・絵のフレーム
  { id: 'friendbusy01', name: 'ハナ', place: 'multi' },          // 部屋で遊び中・フレームなし(今の枠のまま)
  { id: 'friendpriv01', name: 'ミツ', place: 'other', pl: 'roomPrivate' }, // 合言葉の部屋にいる(🔑 プライベート中)
  { id: 'friendcard01', name: 'カード', place: 'other', pl: 'room' }, // 部屋で待ち中だけ(カードの部屋かもしれない)→ 出さない
  { id: 'friendhome01', name: 'ホーム', place: 'home' },         // ホーム → 出さない
];
const json = (route, body) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
(async () => {
  const server = await new Promise((r) => { const s = http.createServer((req, res) => {
    const f = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
    if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res); }); s.listen(PORT, () => r(s)); });
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const errors = [];
  const open = async (vp, { friends = true, assistants = true } = {}) => {
    const page = await browser.newPage({ viewport: vp });
    page.on('pageerror', (e) => errors.push(String(e && e.message || e)));
    page.on('console', (m) => { if (m.type() === 'error' && /screen-error|Error/.test(m.text())) errors.push(m.text().slice(0, 300)); });
    const now = new Date().toISOString();
    await page.route('**/rest/v1/**', (route) => {
      const u = route.request().url();
      if (!friends) return json(route, []);
      if (/friend_links/.test(u)) return json(route, FRIENDS.map((f) => ({ requester_id: SELF, target_id: f.id, status: 'accepted', updated_at: now, created_at: now })));
      if (/breeder_profiles/.test(u)) return json(route, FRIENDS.map((f) => ({ breeder_id: f.id, user_name: f.name, icon: 'Mocchi', profile_frame: f.frame || null, updated_at: now })));
      if (/friend_profiles/.test(u) && route.request().method() === 'GET') return json(route, FRIENDS.map((f) => ({ breeder_id: f.id, place: f.place, records: f.pl ? { pl: f.pl } : null, updated_at: now })));
      return json(route, []);
    });
    // Realtime の作り物: フリーマッチの受付には、ぴよの部屋の知らせを1秒ごとに流す。部屋に入る通信は ok を返すだけ
    await page.addInitScript(({ withRoom }) => {
      class FakeWS {
        constructor() { this.readyState = 0; setTimeout(() => { this.readyState = 1; this.onopen && this.onopen(); }, 30); }
        send(raw) {
          let m = null; try { m = JSON.parse(raw); } catch (_) { return; }
          if (m.event === 'phx_join') {
            this.topic = m.topic;
            setTimeout(() => this.onmessage && this.onmessage({ data: JSON.stringify({ topic: m.topic, event: 'phx_reply', ref: '1', payload: { status: 'ok' } }) }), 20);
            if (withRoom && /mhb-lobby-.*free$/.test(m.topic)) this.timer = setInterval(() => this.onmessage && this.onmessage({ data: JSON.stringify({ topic: m.topic, event: 'broadcast', payload: { event: 'msg', payload: { t: 'room', code: 'PQRS', n: 2, hn: 'ぴよ', hi: '', hr: 5, ph: 'select', hb: 'friendroom01' } } }) }), 1000);
          }
        }
        close() { this.readyState = 3; if (this.timer) clearInterval(this.timer); setTimeout(() => this.onclose && this.onclose(), 0); }
      }
      window.WebSocket = FakeWS;
    }, { withRoom: friends });
    await page.addInitScript((self) => { const put = (k, v) => localStorage.setItem(k, JSON.stringify(v)); put('mh_breeder_name', 'けんさ'); put('mh_breeder_icon', 'Mocchi'); put('mh_onboarded', true); put('mh_tutorial_seen_v1', true); put('mh_battle_tutorial_seen_v1', true); put('mh_battle_tutorial_guide_shown_v1', true); put('mh_rhythm_tutorial_seen_v1', true); localStorage.setItem('mh_breeder_id_v1', JSON.stringify(self)); }, SELF);
    await page.addInitScript(quietBootSeed()); await page.addInitScript(updateNoticeSeed());
    await page.goto(`http://localhost:${PORT}/monster-hero/index.html`, { waitUntil: 'load', timeout: 90000 });
    await page.waitForFunction(() => document.body.innerText.includes('TAP TO START'), undefined, { timeout: 90000 });
    await page.getByRole('button', { name: 'TAP TO START' }).click({ force: true });
    await page.getByRole('button', { name: 'トップ画面へ進む' }).click({ timeout: 30000 });
    await page.waitForTimeout(2500);
    for (let i = 0; i < 12; i++) { const hit = await page.evaluate(() => { const x = [...document.querySelectorAll('button')].find((e) => e.offsetParent && /^(スキップ|受け取る|閉じる|OK)$/.test((e.innerText || '').trim())); if (x) { x.click(); return true; } return false; }); if (!hit) break; await page.waitForTimeout(300); }
    await patchLife(page, assistants);
    await page.evaluate(() => { const x = [...document.querySelectorAll('button')].find((e) => e.offsetParent && /モンヒロビート/.test(e.innerText || '')); if (x) x.click(); });
    await page.waitForSelector('[data-rhythm-mode-select]', { timeout: 30000 });
    await page.waitForTimeout(3500);
    return page;
  };
    // 助手ライフの「いまの様子」で、みゅあ・ききを練習中(モンヒロビートにいる)にする
  const patchLife = (page, assistants) => page.evaluate((on) => {
      const life = ASSISTANT_LIFE_STORE.state.life; if (!life || !Array.isArray(life.groups)) return;
      const ids = on ? ['mua', 'kiki'] : [];
      life.groups = life.groups.map((g) => ({ ...g, ids: g.ids.filter((id) => !ids.includes(id)) })).filter((g) => g.ids.length);
      // ほかの練習中の組は外す(時刻によって、もともと練習中の助手がいる)
      life.groups = life.groups.map((g) => (g.doing === 'practice' ? { ...g, doing: 'snack', place: 'cafe' } : g));
      // ひとりで練習している助手(life.solo)も外す
      if (life.solo && typeof life.solo === 'object') Object.keys(life.solo).forEach((id) => { if (life.solo[id] && life.solo[id].doing === 'practice') life.solo[id] = { ...life.solo[id], doing: 'snack', place: 'cafe' }; if (ids.includes(id)) delete life.solo[id]; });
      if (ids.length) life.groups.push({ ids, doing: 'practice', place: 'beat' });
  }, assistants);
  const shot = async (page, name) => { if (SHOT_DIR) { fs.mkdirSync(SHOT_DIR, { recursive: true }); await page.screenshot({ path: path.join(SHOT_DIR, `${name}.png`) }); } };
  const inside = (page, sel) => page.evaluate((q) => { const el = document.querySelector(q); if (!el) return false; const r = el.getBoundingClientRect(); return r.top >= -1 && r.left >= -1 && r.bottom <= innerHeight + 1 && r.right <= innerWidth + 1; }, sel);
  // 顔は見出しの「いる人」ボタンから開く一覧の中にある。開いていなければ開いてから押す(2026-11-08 帯をボタン+一覧へ)
  const openList = async (page) => {
    if (await page.evaluate(() => !!document.querySelector('[data-rhythm-beat-presence-list]'))) return;
    await page.evaluate(() => { const b = document.querySelector('[data-rhythm-beat-presence-open]'); b && b.click(); });
    await page.waitForTimeout(400);
  };
  const tapFace = async (page, sel) => { await openList(page); await page.evaluate((q) => { const e = document.querySelector(q); e && e.click(); }, sel); };
  try {
    for (const [vp, name, rot] of [[{ width: 390, height: 844 }, 'tate', false], [{ width: 844, height: 390 }, 'yoko', false], [{ width: 390, height: 844 }, 'rot', true], [{ width: 320, height: 568 }, 'small', false]]) {
      const page = await open(vp);
      if (rot) { await page.evaluate(() => { try { RHYTHM_VIEW_ROTATION.set(90); } catch (e) {} }); await page.waitForTimeout(1200); }
      // 検査のあいだに助手ライフの様子が作り直されることがあるので、読む直前にもう一度合わせる
      await patchLife(page, true); await page.waitForTimeout(600);
      check(`${name}: 見出しの「いる人」ボタンが画面の中に入る`, await inside(page, '[data-rhythm-beat-presence-open]'));
      check(`${name}: 「いる人」ボタンの数が一覧の人数と同じ(助手2+フレンド4)`, await page.evaluate(() => /6/.test((document.querySelector('[data-rhythm-beat-presence-open]') || {}).innerText || '')));
      // 「いる人」ボタンで見出しの「モードえらび」が切れない(320幅で「モードえ…」になった)
      const titleCut = await page.evaluate(() => { const t = document.querySelector('[data-rhythm-mode-select] .mhms-title'); return t ? t.scrollWidth > t.clientWidth + 1 : true; });
      check(`${name}: 見出しの「モードえらび」が切れない`, !titleCut);
      await shot(page, `presence-button-${name}`);
      await openList(page);
      const strip = await page.evaluate(() => ({
        a: [...document.querySelectorAll('[data-rhythm-beat-presence-assistant]')].map((e) => e.getAttribute('data-rhythm-beat-presence-assistant')),
        f: [...document.querySelectorAll('[data-rhythm-beat-presence-friend]')].map((e) => `${e.getAttribute('data-rhythm-beat-presence-friend')}:${e.getAttribute('data-rhythm-beat-presence-kind')}`),
      }));
      check(`${name}: 帯に練習中の助手が出る(🎤 呼べる)`, strip.a.join(',') === 'mua,kiki', strip.a.join(','));
      check(`${name}: フレンドは「部屋あり → 誘える → 部屋で遊び中 → 🔑 プライベート中」の順。部屋で待ち中だけ・ホームの人は出ない`, strip.f.join(',') === 'friendroom01:room,friendhere01:here,friendbusy01:busy,friendpriv01:private', strip.f.join(','));
      check(`${name}: 一覧の窓が画面の中に入る`, await inside(page, '[data-rhythm-beat-presence-list] > div'));
      // 助手とフレンド(プレイヤー)は見出し・札・枠の形で見分けられる(2026-11-08 社長「助手とプレイヤーで区別つくようにして」。同じ名前の人がいる)
      const marks = await page.evaluate(() => {
        const g = (k) => document.querySelector(`[data-rhythm-beat-presence-group="${k}"]`);
        const bad = [];
        if (!g('assistant') || !/助手/.test(g('assistant').querySelector('h4')?.innerText || '')) bad.push('助手の見出しが無い');
        if (!g('friend') || !/フレンド/.test(g('friend').querySelector('h4')?.innerText || '')) bad.push('フレンドの見出しが無い');
        document.querySelectorAll('[data-rhythm-beat-presence-assistant]').forEach((b) => {
          if (!g('assistant')?.contains(b)) bad.push(`助手${b.dataset.rhythmBeatPresenceAssistant}がフレンドの側にいる`);
          if ((b.querySelector('[data-rhythm-beat-presence-mark]')?.innerText || '') !== '助手') bad.push(`助手${b.dataset.rhythmBeatPresenceAssistant}に「助手」の札が無い`);
          if (b.querySelector('[data-rhythm-beat-presence-face]')?.getAttribute('data-rhythm-beat-presence-face') !== 'assistant') bad.push('助手の枠が助手用でない');
        });
        document.querySelectorAll('[data-rhythm-beat-presence-friend]').forEach((b) => {
          if (!g('friend')?.contains(b)) bad.push(`フレンド${b.dataset.rhythmBeatPresenceFriend}が助手の側にいる`);
          if ((b.querySelector('[data-rhythm-beat-presence-mark]')?.innerText || '') !== 'フレンド') bad.push(`フレンド${b.dataset.rhythmBeatPresenceFriend}に「フレンド」の札が無い`);
          if (b.querySelector('[data-rhythm-beat-presence-face]')?.getAttribute('data-rhythm-beat-presence-face') !== 'friend') bad.push('フレンドの枠がフレンド用でない');
        });
        // 札と名前が顔の幅からはみ出さない
        document.querySelectorAll('[data-rhythm-beat-presence-mark]').forEach((m) => { const r = m.getBoundingClientRect(); const p = m.parentElement.getBoundingClientRect(); if (r.left < p.left - 1 || r.right > p.right + 1) bad.push(`札「${m.innerText}」が枠からはみ出す`); });
        return bad.join(' / ');
      });
      check(`${name}: 助手とフレンドに印が付いている(見出し・札・枠)`, marks === '', marks);
      // フレンドの顔はプロフィールの顔アイコン+フレーム(2026-11-08 社長「プレイヤー側は顔アイコンとフレームもリンクさせて」)。届かない人は今の枠
      const frames = await page.evaluate(() => {
        const of = (id) => document.querySelector(`[data-rhythm-beat-presence-friend="${id}"] [data-rhythm-beat-presence-face]`);
        const bad = [];
        const piyo = of('friendroom01'); if (!piyo || piyo.getAttribute('data-rhythm-beat-presence-framed') !== 'gold' || !piyo.querySelector('.mh-profile-frame-ring')) bad.push('ぴよ(ゴールド)の輪が無い');
        const taro = of('friendhere01'); if (!taro || taro.getAttribute('data-rhythm-beat-presence-framed') !== 'frame_mocchi' || !taro.querySelector('img.mh-profile-frame-image')) bad.push('タロウ(モッチーの絵)の枠が無い');
        const hana = of('friendbusy01'); if (!hana || hana.hasAttribute('data-rhythm-beat-presence-framed') || hana.querySelector('.mh-profile-frame')) bad.push('ハナ(フレームなし)が今の枠でない');
        document.querySelectorAll('[data-rhythm-beat-presence-assistant] .mh-profile-frame').forEach(() => bad.push('助手にフレームが付いた'));
        // 枠ごと顔の大きさ(44px)に収まる
        [piyo, taro].forEach((e) => { if (!e) return; const r = e.getBoundingClientRect(); if (r.width > 46 || r.height > 46) bad.push(`顔の枠が大きすぎる ${Math.round(r.width)}px`); });
        return bad.join(' / ');
      });
      check(`${name}: フレンドの顔がプロフィールのアイコン+フレーム(なしの人は今の枠・助手はそのまま)`, frames === '', frames);
      await shot(page, `presence-strip-${name}`);
      // 助手の顔
      await tapFace(page, '[data-rhythm-beat-presence-assistant="mua"]');
      await page.waitForTimeout(500);
      const line = await page.evaluate(() => (document.querySelector('[data-rhythm-beat-presence-line]') || {}).innerText || '');
      check(`${name}: 助手の窓に「どこで一緒に演奏できるか」の1行`, /フリーマッチかプライベートの部屋で「呼ぶ」と/.test(line.replace(/\s+/g, '')) && /ソロライブには来られません/.test(line.replace(/\s+/g, '')), line.slice(0, 80));
      check(`${name}: 助手の窓に「🤖 助手」の札`, await page.evaluate(() => /助手/.test(document.querySelector('[data-rhythm-beat-presence-sheet-mark="assistant"]')?.innerText || '')));
      check(`${name}: 助手の窓が画面の中に入る`, await inside(page, '[data-rhythm-beat-presence-sheet] > div'));
      await shot(page, `presence-assistant-${name}`);
      await page.evaluate(() => { const x = [...document.querySelectorAll('[data-rhythm-beat-presence-sheet] button')].find((e) => /とじる/.test(e.innerText)); x && x.click(); });
      await page.waitForTimeout(300);
      // フレンドの顔(部屋あり・遊び中)
      await tapFace(page, '[data-rhythm-beat-presence-friend="friendroom01"]');
      await page.waitForTimeout(400);
      check(`${name}: 部屋を開いているフレンドは「入る」`, await page.evaluate(() => (document.querySelector('[data-rhythm-beat-presence-go]') || {}).innerText === '入る'));
      await page.evaluate(() => { const x = [...document.querySelectorAll('[data-rhythm-beat-presence-sheet] button')].find((e) => /とじる/.test(e.innerText)); x && x.click(); });
      await tapFace(page, '[data-rhythm-beat-presence-friend="friendbusy01"]');
      await page.waitForTimeout(400);
      check(`${name}: 部屋で遊び中のフレンドはボタンなし(いまは入れない)`, await page.evaluate(() => !document.querySelector('[data-rhythm-beat-presence-go]') && /いまは入れません/.test((document.querySelector('[data-rhythm-beat-presence-line]') || {}).innerText || '')));
      await page.evaluate(() => { const x = [...document.querySelectorAll('[data-rhythm-beat-presence-sheet] button')].find((e) => /とじる/.test(e.innerText)); x && x.click(); });
      await tapFace(page, '[data-rhythm-beat-presence-friend="friendpriv01"]');
      await page.waitForTimeout(400);
      check(`${name}: 合言葉の部屋の人は「🔑 プライベート中」でボタンなし`, await page.evaluate(() => !document.querySelector('[data-rhythm-beat-presence-go]') && /合言葉/.test((document.querySelector('[data-rhythm-beat-presence-line]') || {}).innerText || '') && /プライベート中/.test((document.querySelector('[data-rhythm-beat-presence-sheet]') || {}).innerText || '')));
      if (name === 'tate') await shot(page, 'presence-private-tate');
      await page.evaluate(() => { const x = [...document.querySelectorAll('[data-rhythm-beat-presence-sheet] button')].find((e) => /とじる/.test(e.innerText)); x && x.click(); });
      // フリーマッチのシート
      await page.evaluate(() => document.querySelector('[data-rhythm-multi-free]').click());
      await page.waitForTimeout(2500);
      const free = await page.evaluate(() => [...document.querySelectorAll('[data-rhythm-free-friend]')].map((e) => `${e.getAttribute('data-rhythm-free-friend')}:${e.getAttribute('data-rhythm-free-friend-kind')}`));
      check(`${name}: フリーマッチのシートの先頭に「フレンドがいます」(部屋あり・いる人)`, free.join(',') === 'friendroom01:room,friendhere01:here', free.join(','));
      check(`${name}: 「フレンドがいます」が画面の中に入る`, await inside(page, '[data-rhythm-free-friends]'));
      await shot(page, `presence-free-${name}`);
      // 部屋を作って呼ぶ(縦だけ)
      if (name === 'tate') {
        await page.evaluate(() => { const b = document.querySelector('[data-rhythm-mode-free-sheet] button[aria-label="閉じる"]'); b && b.click(); });
        await page.waitForTimeout(400);
        await tapFace(page, '[data-rhythm-beat-presence-assistant="kiki"]');
        await page.waitForTimeout(300);
        await page.evaluate(() => document.querySelector('[data-rhythm-beat-presence-go]').click());
        await page.waitForTimeout(6000);
        const called = await page.evaluate(() => ({ multi: !!document.querySelector('[data-rhythm-multi]'), sheet: !!document.querySelector('[data-rhythm-assist-card="kiki"][data-picked="1"]'), text: document.body.innerText.replace(/\s+/g, ' ').slice(0, 160) }));
        await shot(page, 'presence-call-tate');
        check('部屋を作って呼ぶ: フリーマッチの部屋に入り、呼ぶ窓が助手のタブで、その助手に印が付いて開く', called.multi && called.sheet, JSON.stringify(called).slice(0, 220));
      }
      await page.close();
    }
    // だれもいないとき
    const page = await open({ width: 390, height: 844 }, { friends: false, assistants: false });
    check('だれもいなければ「いる人」ボタンは出ない', await page.evaluate(() => !document.querySelector('[data-rhythm-beat-presence-open]') && !document.querySelector('[data-rhythm-beat-presence]')), await page.evaluate(() => { const e = document.querySelector('[data-rhythm-beat-presence]'); return e ? e.innerText.replace(/\s+/g, ' ').slice(0, 120) + ' / ' + JSON.stringify((ASSISTANT_LIFE_STORE.state.life || {}).groups || []).slice(0, 200) : ''; }));
    await page.close();
    // 送る側: 合言葉の部屋にいるあいだ friendsSetRoomPrivate を立てる(フレンドの一覧で「🔑 プライベート中」になる)
    const multiSrc = fs.readFileSync(path.join(ROOT, 'monster-hero', 'src', 'parts', '77-screen-rhythm-multi.jsx'), 'utf8');
    check('合言葉の部屋の出入りで friendsSetRoomPrivate を呼ぶ', /view\.mode === 'private'/.test(multiSrc) && /friendsSetRoomPrivate\(inPrivate\)/.test(multiSrc));
    check('画面のエラーが無い', errors.length === 0, errors.slice(0, 3).join(' / '));
  } catch (e) { check('最後まで通る', false, String(e && e.message || e).slice(0, 300)); }
  finally { await browser.close(); server.close(); }
  console.log(failed ? `${failed}件のNGがあります` : 'すべてOK');
  process.exit(failed ? 1 : 0);
})();

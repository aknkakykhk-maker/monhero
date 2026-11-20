// 助手ライフの画面の検査で使う下ごしらえ(種・HOME へ進む・掛け合いを流し切る・HOME の顔の列の見張り)。
//   assistant-life-browser-check.js と assistant-life-home-layout-check.js が使う
const path = require("path"), fs = require("fs");
const root = path.resolve(__dirname, "..", "..");
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.mp3': 'audio/mpeg', '.m4a': 'audio/mp4', '.woff2': 'font/woff2' };
// お話・紹介の既読は、本体から読む共通の種(quiet-boot-seed.js)と同じものを入れる。手で書き写すと、新しいお話が増えたときに先に流れて落ちる
const { eventStoryIds, introStoryKeys } = require('../boot/quiet-boot-seed');
const STORY_IDS = eventStoryIds();
const INTRO_KEYS = introStoryKeys();
const seed = ({ storyIds, introKeys = [], life, intro = false, bondAll = null }) => {
  const put = (k, v) => localStorage.setItem(k, JSON.stringify(v));
  // 助手ライフの画面: 新UIが既定(2026-11-11)。ここを使う検査は前の画面(旧UI)を前提にしているので、決めていなければ前の画面で見る。
  //   新UIを見る検査(assistant-life-ux-check・ux3-check・life-walkthrough)は、先に true を入れる(保存なしを見るときは window.__mhLifeUiNoSeed)
  if (localStorage.getItem('mh_assistant_life_ui_v2') === null && !window.__mhLifeUiNoSeed) { localStorage.setItem('mh_assistant_life_ui_v2', 'false'); localStorage.setItem('mh_assistant_life_ui_v2_default_v1', 'true'); }
  if (localStorage.getItem('mh_breeder_name') === null) {
    put('mh_breeder_name', 'テスト'); put('mh_breeder_icon', 'Mocchi'); put('mh_onboarded', true);
    for (const k of ['mh_tutorial_seen_v1','mh_battle_tutorial_seen_v1','mh_battle_tutorial_guide_shown_v1','mh_rhythm_tutorial_seen_v1','mh_masu_migrated','mh_kiki_intro_seen_v1','mh_momosuke_intro_seen_v1','mh_tactics_intro_seen_v1','mh_rhythm_hell_story_seen_v1','mh_story_assistant_chat_seen_v1','mh_story_tactics_types_seen_v1','mh_story_card_battle_seen_v1','mh_inherited_unique_level_compensation_v1']) put(k, true);
    put('mh_inherited_unique_level_compensation_pending_v1', false);
    put('mh_assistant_selected_v1', 'mua'); put('mh_rhythm_event_story_v1', storyIds);
    for (const k of introKeys) localStorage.setItem(k, 'true');
    const d = new Date(), pad = (n) => String(n).padStart(2, '0');
    put('mh_daily_masu_advice_date_v1', `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`);
    put('mh_login_bonus_last_v1', `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`);
    // 友情Lv をいろいろに(Lv3 友だち・Lv4 いい友だち・Lv5 名コンビ…)
    put('mh_assistant_peer_bond_v1', { 'kiki-mua': 460, 'dra-momosuke': 260, 'atsu-sorashido': 130, 'erubin-kyuko': 130, 'kiki-kyuko': 60, 'dra-mua': 720 });
    // にぎわい「にぎやか」(朝4時区切りの今日)
    const day = new Date(Date.now() + 5 * 3600000).toISOString().slice(0, 10);
    put('mh_assistant_life_play_v1', { day, points: 70, counts: { rhythm: 40, card: 30 }, lastDay: null, streak: 1 });
    // 2人にあげる道具(差し入れ2・友情のしるし1)。はじめての案内は intro のときだけ出す
    let owned = {}; try { owned = JSON.parse(localStorage.getItem('mh_owned_items')) || {}; } catch {}
    put('mh_owned_items', { ...owned, peer_gift: 2, peer_token: 1 });
    if (!intro) put('mh_assistant_life_item_intro_v1', true);
    if (!intro) put('mh_assistant_life_guide_seen_v1', true); // 初めて開いた人への1枚(intro のときだけ出す)
  }
  // 公開の印はページの中だけで切り替える(本体は 2026-11-07 から真)。偽の確かめのときは偽に戻す
  { const t = setInterval(() => { try { if (typeof RELEASE_FLAGS !== 'undefined') { RELEASE_FLAGS.assistantLife = !!life; clearInterval(t); } } catch {} }, 2); }
  // いまの時間の様子を決めて入れておく(様子は時間帯と種で変わり、組やひとりの助手ができないことがあるため。印が偽の確かめでは入れない)
  if (life && localStorage.getItem('mh_check_life_seeded') === null) {
    localStorage.setItem('mh_check_life_seeded', '1');
    const t = Date.now() + 9 * 3600000, h = new Date(t).getUTCHours();
    const i = [0, 5, 10, 14, 18, 21].filter(x => h >= x).length - 1, ids = ['late', 'morning', 'noon', 'afternoon', 'evening', 'night'];
    const base = { v: 2, salt: 'check', abs: Math.floor(t / 86400000) * 12 + Math.floor(h / 2), slot: ids[i], recent: [], nudges: { invite: [], introduce: [] }, watched: [] };
    put('mh_assistant_life_v1', bondAll != null
      ? { ...base, moods: {}, solo: {}, groups: [{ ids: ['kiki', 'mua'], doing: 'snack', place: 'cafe' }, { ids: ['dra', 'momosuke'], doing: 'walk', place: 'plaza' }, { ids: ['atsu', 'kyuko'], doing: 'cards', place: 'library' }, { ids: ['erubin', 'sorashido'], doing: 'cards', place: 'cardroom' }] }
      : { ...base, moods: { atsu: 'lonely', kyuko: 'happy', momosuke: 'lonely' },
        groups: [{ ids: ['kiki', 'mua'], doing: 'snack', place: 'cafe' }, { ids: ['dra', 'erubin', 'sorashido'], doing: 'cards', place: 'cardroom' }],
        solo: { atsu: { doing: 'idle', place: 'home', reason: 'lonely' }, kyuko: { doing: 'read', place: 'library', reason: 'mypace' }, momosuke: { doing: 'practice', place: 'studio', reason: 'lonely' } } });
  }
  if (bondAll != null && localStorage.getItem('mh_check_bond_all') === null) { localStorage.setItem('mh_check_bond_all', '1'); const b = {}; const ids = ['mua', 'kiki', 'momosuke', 'dra', 'atsu', 'kyuko', 'sorashido', 'erubin']; for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) b[[ids[i], ids[j]].sort().join('-')] = bondAll; put('mh_assistant_peer_bond_v1', b); }
};
const toHome = async (page) => {
  for (let i = 0; i < 60; i++) {
    if (await page.locator('.mh-home-player').count()) break;
    await page.getByRole('button', { name: /TAP TO START|トップ画面へ進む/ }).first().click({ timeout: 800 }).catch(() => {});
    await page.waitForTimeout(500);
  }
  for (let i = 0; i < 12; i++) { const c = await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find(x => x.offsetParent && /^(受け取る|閉じる|OK|(?:分|わ)かった！?|とじる)$/.test((x.innerText || '').trim())); if (b) { b.click(); return true; } return false; }); if (!c) break; await page.waitForTimeout(400); }
  // 部屋の「できること」は、話す・贈る・誘う のほかを「もっと見る」に畳んだ(2026-11-20 総点検 F-5)。
  //   畳んだ行を押す検査が多いので、ここで開いた状態にしておく(ページの中の値だけ・保存しない)。見た目を撮る道具は window.__mhKeepRoomFold で閉じたまま
  await page.evaluate(() => { try { if (!window.__mhKeepRoomFold && typeof ASSISTANT_LIFE_ROOM_MORE === 'object') ASSISTANT_LIFE_ROOM_MORE.open = true; } catch (_) {} }).catch(() => {});
};
const finishTalk = async (page) => { for (let i = 0; i < 24; i++) { const n = await page.locator('[data-assistant-peer-talk]').count(); if (!n) break; await page.locator('[data-assistant-peer-talk]').first().click({ timeout: 800 }).catch(() => {}); await page.waitForTimeout(250); } };
// HOME のドックと顔バッジの見張り(2026-11-17 ホーム一新で、旧 homeFacesProblems=「札の下の顔の列」から置き換え)。
//   見るもの: ドックのボタンが画面の中にあり・ボタンどうしが重ならない／顔バッジがその施設のボタンの右上にあり・
//   画面の外に出ない・隣のボタンの真ん中を隠さない・顔がバッジからはみ出さない／期間ものの細バナー・右端スタック・
//   吹き出し・上の帯がドックや互いに重ならない。🔄横では器の中の向きで測る(RHYTHM_VIEW_ROTATION.rectOf)。
//   homeFacesProblems の名前で呼ぶ検査が残っているため、旧名はこの関数の別名として残す
const homeDockProblems = (page) => page.evaluate(() => {
  const rot = typeof RHYTHM_VIEW_ROTATION !== 'undefined' && RHYTHM_VIEW_ROTATION.active();
  const R = (el) => (rot ? RHYTHM_VIEW_ROTATION.rectOf(el) : el.getBoundingClientRect());
  const W = rot ? window.innerHeight : window.innerWidth, H = rot ? window.innerWidth : window.innerHeight;
  const vis = (e) => !!e && !!e.offsetParent;
  const hit = (a, b) => Math.min(a.right, b.right) - Math.max(a.left, b.left) > 1 && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 1;
  const ng = [];
  const btns = [...document.querySelectorAll('[data-home-fac],[data-home-monhero-success]')].filter(vis)
    .map(e => ({ el: e, k: e.getAttribute('data-home-fac') || 'success', r: R(e) }));
  for (const b of btns) {
    if (b.r.left < -1 || b.r.right > W + 1 || b.r.top < -1 || b.r.bottom > H + 1) ng.push(`${b.k}: ドックのボタンが画面の外`);
    if (b.r.width < 30 || b.r.height < 24) ng.push(`${b.k}: ドックのボタンが小さすぎる(${Math.round(b.r.width)}×${Math.round(b.r.height)})`);
  }
  for (let i = 0; i < btns.length; i++) for (let j = i + 1; j < btns.length; j++) if (hit(btns[i].r, btns[j].r)) ng.push(`ドックのボタンが重なる: ${btns[i].k} × ${btns[j].k}`);
  const dock = document.querySelector('.mh-home-dock');
  const dockR = vis(dock) ? R(dock) : null;
  if (!dockR) ng.push('ドックが無い'); else if (dockR.bottom > H + 1 || dockR.left < -1 || dockR.right > W + 1) ng.push('ドックが画面の外');
  for (const box of document.querySelectorAll('[data-assistant-life-home-faces]')) {
    const k = box.getAttribute('data-assistant-life-home-faces');
    const btn = btns.find(b => b.k === k);
    const f = R(box);
    if (!btn) { ng.push(`${k}: バッジの施設のボタンが無い`); continue; }
    const r = btn.r;
    if (f.right < r.right - 34 || f.right > r.right + 10) ng.push(`${k}: バッジがボタンの右上にない(ボタンの右 ${Math.round(r.right)}・バッジの右 ${Math.round(f.right)})`);
    const cy = (f.top + f.bottom) / 2;
    if (cy < r.top - 14 || cy > r.top + r.height * 0.6) ng.push(`${k}: バッジがボタンの上の方にない`);
    if (f.left < -10 || f.right > W + 10 || f.top < -10 || f.bottom > H + 1) ng.push(`${k}: バッジが画面の外`);
    for (const o of btns) { if (o.k === k) continue; const cx = (o.r.left + o.r.right) / 2, cyy = (o.r.top + o.r.bottom) / 2; if (cx > f.left && cx < f.right && cyy > f.top && cyy < f.bottom) ng.push(`${k}のバッジ×${o.k}のボタンの真ん中`); }
    for (const face of box.querySelectorAll('[data-assistant-life-home-face]')) {
      const fr = R(face);
      if (fr.left < f.left - 2 || fr.right > f.right + 2 || fr.top < f.top - 2 || fr.bottom > f.bottom + 2) ng.push(`${k}の顔: バッジからはみ出す`);
      if (fr.width < 18 || fr.width > 30) ng.push(`${k}の顔: 大きさがおかしい(${Math.round(fr.width)})`);
    }
  }
  const parts = [];
  const strip = document.querySelector('.mh-home-event-strip'); if (vis(strip)) parts.push({ c: '細バナー', r: R(strip) });
  for (const e of document.querySelectorAll('.mh-home-side-btn')) if (vis(e)) parts.push({ c: '右端ボタン', r: R(e) });
  const bubble = document.querySelector('.mh-home-assistant'); if (vis(bubble)) parts.push({ c: '吹き出し', r: R(bubble) });
  const player = document.querySelector('.mh-home-player'); if (vis(player)) parts.push({ c: '上の帯', r: R(player) });
  for (const p of parts) {
    if (p.r.left < -1 || p.r.right > W + 1 || p.r.top < -1 || p.r.bottom > H + 1) ng.push(`${p.c}が画面の外`);
    if (dockR && hit(p.r, dockR)) ng.push(`${p.c}×ドック`);
  }
  for (let i = 0; i < parts.length; i++) for (let j = i + 1; j < parts.length; j++) if (hit(parts[i].r, parts[j].r)) ng.push(`${parts[i].c}×${parts[j].c}`);
  for (const box of document.querySelectorAll('[data-assistant-life-home-faces]')) {
    const k = box.getAttribute('data-assistant-life-home-faces'); const f = R(box);
    for (const p of parts) if (hit(f, p.r)) ng.push(`${k}のバッジ×${p.c}`);
  }
  return ng;
});
const homeFacesProblems = homeDockProblems;
const waitFaces = async (page) => { for (let i = 0; i < 60 && !(await page.locator('[data-assistant-life-home-face]').count()); i++) { await finishTalk(page); await page.waitForTimeout(500); } };

module.exports = { MIME, STORY_IDS, INTRO_KEYS, seed, toHome, finishTalk, homeFacesProblems, homeDockProblems, waitFaces };

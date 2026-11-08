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
  }
  // 公開の印はページの中だけで切り替える(本体は 2026-11-07 から真)。偽の確かめのときは偽に戻す
  { const t = setInterval(() => { try { if (typeof RELEASE_FLAGS !== 'undefined') { RELEASE_FLAGS.assistantLife = !!life; clearInterval(t); } } catch {} }, 2); }
  // いまの時間の様子を決めて入れておく(様子は時間帯と種で変わり、組やひとりの助手ができないことがあるため。印が偽の確かめでは入れない)
  if (life && localStorage.getItem('mh_check_life_seeded') === null) {
    localStorage.setItem('mh_check_life_seeded', '1');
    const t = Date.now() + 9 * 3600000, h = new Date(t).getUTCHours();
    const i = [0, 5, 10, 14, 18, 21].filter(x => h >= x).length - 1, ids = ['late', 'morning', 'noon', 'afternoon', 'evening', 'night'];
    const base = { salt: 'check', abs: Math.floor(t / 86400000) * 6 + i, slot: ids[i], recent: [], nudges: { invite: [], introduce: [] }, watched: [] };
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
  for (let i = 0; i < 12; i++) { const c = await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find(x => x.offsetParent && /^(受け取る|閉じる|OK|わかった！?|とじる)$/.test((x.innerText || '').trim())); if (b) { b.click(); return true; } return false; }); if (!c) break; await page.waitForTimeout(400); }
};
const finishTalk = async (page) => { for (let i = 0; i < 24; i++) { const n = await page.locator('[data-assistant-peer-talk]').count(); if (!n) break; await page.locator('[data-assistant-peer-talk]').first().click({ timeout: 800 }).catch(() => {}); await page.waitForTimeout(250); } };
// HOME の顔の列: どの札でも札(名前)の下にあり、札・ほかのボタン・画面の端に重ならない(2026-11-07 社長「アイコンってコンテンツ名の下に表示じゃなかったっけ？」)
// HOME の顔の列: どの札でも札(名前)の下にあり、札・ほかのボタン・画面の端に重ならない(2026-11-07 社長「アイコンってコンテンツ名の下に表示じゃなかったっけ？」)。
//   🔄横(端末は縦のまま、器を90度回す)では、器の中の向きで測る(RHYTHM_VIEW_ROTATION.rectOf)。
//   また、施設の札どうし・みゅあの吹き出しと札・「開催中」の札が重ならないことも見る(横 667×375 で吹き出しが長いと M/B管理とモンヒロビートが重なった)
const homeFacesProblems = (page) => page.evaluate(() => {
  const rot = typeof RHYTHM_VIEW_ROTATION !== 'undefined' && RHYTHM_VIEW_ROTATION.active();
  const R = (el) => (rot ? RHYTHM_VIEW_ROTATION.rectOf(el) : el.getBoundingClientRect());
  const W = rot ? window.innerHeight : window.innerWidth, H = rot ? window.innerWidth : window.innerHeight;
  const sel = { rhythm: '.mh-home-facility.rhythm', card: '.mh-home-card-battle', management: '.mh-home-facility.management', market: '.mh-home-facility.market', life: '.mh-home-facility.life' };
  const obs = [...document.querySelectorAll('.mh-home-facility,.mh-home-card-battle,.mh-home-event-banner,.mh-home-tour-banner,.mh-home-mission,.mh-home-gift,.mh-home-event-badge,.mh-home-assistant,.mh-home-player,.mh-home-wallet,.mh-home-update,.mh-home-settings')].filter(e => e.offsetParent).map(e => ({ el: e, c: e.className.slice(0, 28), r: R(e) }));
  const hit = (a, b) => Math.min(a.right, b.right) - Math.max(a.left, b.left) > 1 && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 1;
  const ng = [];
  for (const box of document.querySelectorAll('[data-assistant-life-home-faces]')) {
    const k = box.getAttribute('data-assistant-life-home-faces'); const f = R(box.firstElementChild);
    const el = document.querySelector(sel[k]); if (!el) continue; const r = R(el);
    if (f.top < r.bottom - 1 || f.top > r.bottom + 6) ng.push(`${k}: 札の下にない(札の下 ${Math.round(r.bottom)}・顔の上 ${Math.round(f.top)})`);
    if (f.left < r.left - 1 - 140 || f.right > r.right + 1 + 140) ng.push(`${k}: 札から離れている`);
    if (f.left < -1 || f.right > W + 1 || f.bottom > H + 1 || f.top < -1) ng.push(`${k}: 画面の外`);
    for (const o of obs) if (hit(f, o.r)) ng.push(`${k}の顔×${o.c}`);
  }
  // 施設の札(押す所)どうし・吹き出しと札
  const labels = [...document.querySelectorAll('.mh-home-facility>span,.mh-home-card-battle,.mh-home-assistant,.mh-home-mission,.mh-home-gift,.mh-home-event-badge,.mh-home-event-banner')].filter(e => e.offsetParent).map(e => ({ el: e, c: (e.closest('.mh-home-facility') || e).className.slice(0, 28), r: R(e) }));
  for (let i = 0; i < labels.length; i++) for (let j = i + 1; j < labels.length; j++) {
    const a = labels[i], b = labels[j]; if (a.el.contains(b.el) || b.el.contains(a.el)) continue;
    if (hit(a.r, b.r)) ng.push(`札が重なる: ${a.c} × ${b.c}`);
  }
  for (const a of labels) if (a.r.left < -1 || a.r.right > W + 1 || a.r.bottom > H + 1) ng.push(`札が画面の外: ${a.c}`);
  return ng;
});
const waitFaces = async (page) => { for (let i = 0; i < 60 && !(await page.locator('[data-assistant-life-home-face]').count()); i++) { await finishTalk(page); await page.waitForTimeout(500); } };

module.exports = { MIME, STORY_IDS, INTRO_KEYS, seed, toHome, finishTalk, homeFacesProblems, waitFaces };

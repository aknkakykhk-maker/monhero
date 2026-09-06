const TOOLS_DIR = require('path').join(__dirname, '..'); // tools/ 直下。分類フォルダから見た1つ上
// 旧形式のセーブデータ(マスモン導入前・各種一度きり移行の前)を localStorage に入れて実際に起動し、
// 起動時の移行が「1回だけ」「既存の値を壊さず」行われることを確かめる。
//
//   node tools/boot/legacy-save-boot-check.js
//   (配信 serve.py はこの検査が自分で立てる)
//
// 【なぜ要るか】
// 保存層(storeGet / storeSet)と起動時の読込・移行(docs/refactor/REFACTOR_MASTER_PLAN.md STEP 3)を
// 整理する前に、「旧データで起動 → 移行 → もう一度起動しても二重に適用されない」を通しで固定しておく。
// 個々の移行は masu/* の検査が見ているが、実ブラウザで localStorage から通す検査は無かった。
//
// 【見ているもの】
// ① 1回目の起動: 旧 mh_bond_xp からマスモンが作られ(mh_masu_migrated)、ポイント補填のフラグが立ち、
//    既存プレイヤーとして扱われる(mh_onboarded=true、新規キャンペーンのギフトは付かない)。
//    旧キー(mh_bond_xp など)は消えず、ダイヤ・XP は変わらない
// ② 2回目の起動(再読み込み): マスモン・ギフト・ダイヤ・ポイント・補填フラグが1回目とまったく同じ
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { chromium } = require('playwright');

const PORT = 8899;
const PAGE_URL = process.env.SMOKE_URL || `http://localhost:${PORT}/monster-hero/index.html`;
let failed = 0;
const check = (label, ok, detail = '') => { console.log(`${ok ? 'OK' : 'NG'}: ${label}${detail ? ` — ${detail}` : ''}`); if (!ok) failed++; };

// 旧形式のセーブ。mh_masu_mons も各種 *_migrated も無い、マスモン導入前のプレイヤーを模す。
// 2回目の起動でも addInitScript は走るので、旧キーが既に無い(=移行済み)ときは何もしない
const seedLegacy = () => {
  if (localStorage.getItem('mh_bond_xp') !== null) return; // 2回目以降
  const put = (k, v) => localStorage.setItem(k, JSON.stringify(v));
  put('mh_breeder_name', 'レガシー');
  put('mh_breeder_icon', 'Mocchi');
  put('mh_breeder_xp', 5000);
  put('mh_gold', 1234);
  put('mh_owned_items', { psyche: 3 });
  put('mh_unlocked_monsters', ['Mocchi', 'Suezo', 'Ham', 'Golem', 'Pixie', 'Tiger', 'Oboro', 'Zan']);
  put('mh_bond_xp', { Mocchi: 300, Suezo: 50, NoSuchMonster: 10 });
  put('mh_dist_apt_points', { Mocchi: 2 });
  put('mh_dist_apt_overrides', { Mocchi: ['B', 'C', 'C', 'D'] });
  put('mh_hs_Normal', 4321);
  put('mh_tutorial_seen_v1', true);
  put('mh_battle_tutorial_seen_v1', true);
  put('mh_battle_tutorial_guide_shown_v1', true);
};

const WATCH_KEYS = ['mh_masu_mons', 'mh_gifts', 'mh_gold', 'mh_breeder_xp', 'mh_breeder_points', 'mh_breeder_points_granted',
  'mh_owned_items', 'mh_bond_xp', 'mh_dist_apt_points', 'mh_dist_apt_overrides', 'mh_hs_Normal', 'mh_unlocked_monsters',
  'mh_masu_migrated', 'mh_points_migrated', 'mh_points_base_granted', 'mh_onboarded'];

(async () => {
  const server = spawn('python3', [path.join(TOOLS_DIR, 'serve.py'), String(PORT)], { stdio: 'ignore' });
  await new Promise(r => setTimeout(r, 800));
  let browser;
  const errors = [];
  try {
    browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    page.on('pageerror', (e) => errors.push(String(e)));
    await page.addInitScript(seedLegacy);
    await page.route('**cdn.tailwindcss.com**', r => r.abort()).catch(() => {});

    const bootAndSnapshot = async () => {
      await page.goto(PAGE_URL, { waitUntil: 'load', timeout: 60000 });
      // 起動時の読込・移行は画面のタップを待たずに走る。最後のほうで立つフラグを待ってから、少し余裕を置く
      await page.waitForFunction(() => localStorage.getItem('mh_masu_migrated') === 'true' && localStorage.getItem('mh_points_base_granted') === 'true', { timeout: 60000 });
      await page.waitForFunction(() => document.body.innerText.includes('TAP TO START'), { timeout: 60000 }).catch(() => {});
      await page.waitForTimeout(2500);
      return page.evaluate((keys) => Object.fromEntries(keys.map(k => [k, localStorage.getItem(k)])), WATCH_KEYS);
    };
    const parse = (v) => { try { return JSON.parse(v); } catch { return undefined; } };

    // --- ① 1回目 ---
    const first = await bootAndSnapshot();
    const masu = parse(first.mh_masu_mons) || [];
    check('旧 mh_bond_xp からマスモンが作られる(知らない種は除く)', masu.length === 2 && masu.some(m => m.id === 'masu_migrated_Mocchi') && masu.some(m => m.id === 'masu_migrated_Suezo'), `${masu.length}体: ${masu.map(m => m.id).join(', ')}`);
    const mocchi = masu.find(m => m.id === 'masu_migrated_Mocchi') || {};
    // 未使用の適性ポイントは、起動時に「絆Lvから得られるはずの総点」との不足分だけ補われる(SAVE_DATA.md §3)ので、
    // 旧値(2)より増えることはあっても減らない
    check('絆XP・適性・適性ポイント(不足分の補填で増えるが減らない)が引き継がれる', mocchi.bondXp === 300 && mocchi.distAptPoints >= 2 && Array.isArray(mocchi.distApt) && mocchi.distApt[0] === 'B' && mocchi.distApt[3] === 'D', JSON.stringify({ bondXp: mocchi.bondXp, distAptPoints: mocchi.distAptPoints, distApt: mocchi.distApt }));
    check('移行フラグが立つ(mh_masu_migrated / mh_points_migrated / mh_points_base_granted)', first.mh_masu_migrated === 'true' && first.mh_points_migrated === 'true' && first.mh_points_base_granted === 'true');
    check('旧キー(mh_bond_xp / mh_dist_apt_points / mh_dist_apt_overrides)は消さない', first.mh_bond_xp !== null && first.mh_dist_apt_points !== null && first.mh_dist_apt_overrides !== null);
    // 所持アイテムは一度きりの配布(限界突破の補償など)で増えることがあるので、持っていた分が減っていないことを見る
    check('ダイヤ・ブリーダーXP・ハイスコア・持っていたアイテムは変わらない', parse(first.mh_gold) === 1234 && parse(first.mh_breeder_xp) === 5000 && parse(first.mh_hs_Normal) === 4321 && (parse(first.mh_owned_items) || {}).psyche === 3, `gold=${first.mh_gold} xp=${first.mh_breeder_xp} hs=${first.mh_hs_Normal} items=${first.mh_owned_items}`);
    check('名前とXPがあるので既存プレイヤーとして扱われる(mh_onboarded=true)', first.mh_onboarded === 'true', String(first.mh_onboarded));
    const gifts = parse(first.mh_gifts) || [];
    check('新規プレイヤーキャンペーンのギフトは付かない', !gifts.some(g => g && g.id === 'monhiro_beat_preopen_new_player_v1'), `gifts=${gifts.map(g => g && g.id).join(', ') || '(なし)'}`);
    check('ブリーダーLvぶんのポイント補填が1回行われる(mh_breeder_points_granted が数値)', Number.isFinite(parse(first.mh_breeder_points_granted)), String(first.mh_breeder_points_granted));

    // --- ② 2回目(再読み込み) ---
    const second = await bootAndSnapshot();
    const same = (k) => first[k] === second[k];
    const compareKeys = ['mh_masu_mons', 'mh_gifts', 'mh_gold', 'mh_breeder_xp', 'mh_breeder_points', 'mh_breeder_points_granted', 'mh_owned_items', 'mh_bond_xp', 'mh_hs_Normal', 'mh_onboarded'];
    const changed = compareKeys.filter(k => !same(k));
    check('もう一度起動しても、マスモン・ギフト・ダイヤ・ポイント・補填が1回目と同じ(二重適用なし)', changed.length === 0, changed.length ? `変わった: ${changed.map(k => `${k}: ${first[k]} → ${second[k]}`).join(' / ')}` : '');
    check('起動中に致命的な JS エラーが出ない', errors.length === 0, errors.slice(0, 2).join(' / '));
  } catch (e) {
    check('実ブラウザで確認できた', false, String(e && e.message || e));
  } finally {
    if (browser) await browser.close().catch(() => {});
    server.kill();
  }
  console.log(failed ? `${failed}件のNGがあります` : 'すべてOK');
  process.exit(failed ? 1 : 0);
})();

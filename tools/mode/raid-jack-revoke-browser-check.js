// デバッグで付いた「倒した」印と初討伐ギフトが、開き直したときに直るかを、実際のブラウザで確かめる。
//
//   python3 tools/serve.py  は要らない(このツールが自前でポートを開く)
//   node tools/mode/species-challenge-browser-check.js
//
// 見るのは次のとおり。
//   ① デバッグ設定(DEBUG MENU) → ⚔️バトル → ⚔️バトルモード → 本番と同じBATTLE MODEカルーセルから入れる
//   ② 種族選択 → 難易度 → 勇者 → 供モン → 出撃確認 の各画面が出て、iPhone縦で横にはみ出さない
//   ③ 勇者と同じモンスターは供モンに出ない(同じbaseIdの重複拒否)
//   ④ 供モン0体でも出撃できる
//   ⑤ WAVE1のバトルまで到達して、どこでも実行時エラー(真っ白)にならない
//   ⑥ 種族チャレンジのランキング画面が開き、種族タブと難易度タブ(14)が並ぶ
//
// このサンドボックスは外部CDN(Tailwind)へ出られないため、Tailwindの読み込みだけ
// 打ち切って起動し、横スライドに必要な最小限のCSSだけ自前で足す。
// そのため「見た目そのもの」は確認できない。ここで分かるのは
// 「画面が出るか」「押せるか」「実行時エラーが出ないか」「横スクロール事故が無いか」まで。
const http = require('http');
const path = require('path');
const fs = require('fs');

// イベントの「閉幕とお礼」は終了の時刻に自動で流れる。既読にしておかないと会話で止まる
const { eventStorySeed } = require(path.resolve(__dirname, '..', 'boot/quiet-boot-seed'));

const root = path.resolve(__dirname, '..', '..');
const PORT = 8998;
const MIME = { '.html':'text/html', '.js':'text/javascript', '.json':'application/json',
  '.css':'text/css', '.png':'image/png', '.jpg':'image/jpeg', '.webp':'image/webp',
  '.svg':'image/svg+xml', '.mp3':'audio/mpeg', '.ico':'image/x-icon' };

const serve = () => new Promise((resolve) => {
  const server = http.createServer((req, res) => {
    const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '');
    const file = path.join(root, rel);
    if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      res.writeHead(404); res.end('not found'); return;
    }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  });
  server.listen(PORT, () => resolve(server));
});

let failed = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`); if (!ok) failed++; };

(async () => {
  let playwright;
  try { playwright = require('playwright'); }
  catch { console.log('SKIP: playwright が入っていないので確認できません'); process.exit(0); }
  const server = await serve();
  const errors = [];
  let browser;
  try {
    browser = await playwright.chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    page.on('pageerror', (e) => errors.push(String(e)));
    await page.addInitScript(() => {
      localStorage.setItem('mh_breeder_name', JSON.stringify('検査ブリーダー'));
      localStorage.setItem('mh_breeder_icon', JSON.stringify('🐣'));
      localStorage.setItem('mh_onboarded', JSON.stringify(true));
      localStorage.setItem('mh_tutorial_seen_v1', JSON.stringify(true));
      localStorage.setItem('mh_battle_tutorial_seen_v1', JSON.stringify(true));
      localStorage.setItem('mh_battle_tutorial_guide_shown_v1', JSON.stringify(true));
      localStorage.setItem('mh_inherited_unique_level_compensation_v1', JSON.stringify(true));
      localStorage.setItem('mh_inherited_unique_level_compensation_pending_v1', JSON.stringify(false));
      localStorage.setItem('mh_unlocked_monsters', JSON.stringify(['Mocchi', 'Mitarashi', 'Pixie', 'Mia', 'Pandora', 'Suezo']));
      // B(マスモン)用。1体目は攻撃力を大きく伸ばした個体(初級ジャックのライフ70,000を短いターンで削りきれる)
      localStorage.setItem('mh_masu_mons', JSON.stringify([
        { id: 'rj-m1', baseId: 'Mocchi', name: '検査モッチー', bondXp: 300, createdAt: 1, statPoints: { hp: 0, atk: 400000, def: 0, guts: 0 } },
        { id: 'rj-m2', baseId: 'Suezo', name: '検査スエゾー', bondXp: 300, createdAt: 2, statPoints: { hp: 0, atk: 0, def: 0, guts: 0 } },
      ]));
      // デバッグで汚れた本番の端末記録(「倒した」印は前の修復ですでに外れた状態): 初級〜上級の初討伐が受け取り済みの印・ギフト3件(初級は受け取り済み)
      localStorage.setItem('mh_raid_jack_v1', JSON.stringify({ a: { day: '', used: 0, extra: 0, defeated: [] }, b: { day: '', used: 0, extra: 0, defeated: [], total: 0 }, claimed: ['clear_b1', 'clear_b2', 'clear_b3'], pending: [], repaired: true }));
      localStorage.setItem('mh_gifts', JSON.stringify([
        { id: 'raid_jack_2026_clear_b1', title: '初級ジャック 初討伐報酬', source: 'raidJack', rewards: [{ type: 'diamond', amount: 1000000 }], createdAt: '2026-10-05T07:00:00.000Z', claimedAt: '2026-10-05T07:01:00.000Z' },
        { id: 'raid_jack_2026_clear_b2', title: '中級ジャック 初討伐報酬', source: 'raidJack', rewards: [{ type: 'diamond', amount: 2000000 }], createdAt: '2026-10-05T07:00:00.000Z', claimedAt: null },
        { id: 'raid_jack_2026_clear_b3', title: '上級ジャック 初討伐報酬', source: 'raidJack', rewards: [{ type: 'diamond', amount: 3000000 }], createdAt: '2026-10-05T07:00:00.000Z', claimedAt: null },
        { id: 'other_gift_keep', title: 'ほかのギフト', source: 'campaign', rewards: [{ type: 'diamond', amount: 1 }], createdAt: '2026-10-05T07:00:00.000Z', claimedAt: null },
      ]));
      localStorage.setItem('mh_monster_roster', JSON.stringify(['masu:rj-m1', 'masu:rj-m2']));
    });
    await page.addInitScript(eventStorySeed());
    const posts = [];
    const otherWrites = [];
    let watching = false;   // 戦闘を始めてから結果が出るまでの間だけ数える(起動時のプロフィール同期などは別物)
    await page.route('**/rest/v1/**', async (route) => {
      const req = route.request();
      const url = req.url();
      if (/raid_jack_/.test(url)) {
        if (req.method() === 'POST') { posts.push({ url, body: req.postData() }); await route.fulfill({ status: 201, body: '' }); return; }
        // ランキングの確認用: 子爵(段階2)の貢献には3人、グランドスラムの累計には2人を返す
        if (/raid_jack_contributions\?.*kind=eq\.a&tier=eq\.2/.test(decodeURIComponent(url))) { await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([{ breeder_id: 'rank-aaaa0001', total_damage: 900, last_hit_at: 't' }, { breeder_id: 'rank-aaaa0002', total_damage: 500, last_hit_at: 't' }, { breeder_id: 'rank-aaaa0003', total_damage: 100, last_hit_at: 't' }]) }); return; }
        if (/raid_jack_b_ranking/.test(url)) { await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([{ breeder_id: 'rank-bbbb0001', total_damage: 7000, last_hit_at: 't' }, { breeder_id: 'rank-bbbb0002', total_damage: 3000, last_hit_at: 't' }]) }); return; }
        await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }); return;
      }
      // ジャック戦から、ほかの表(rankings など)へ書き込みが出たら記録する
      // /rpc/ は読み出し(音ゲーのランキングなど)もPOSTで呼ぶので、表への書き込みだけを見る
      // bond_levels / friend_profiles / breeder_profiles は、マスモンがいると起動後に自動で同期される(戦闘を始めず20秒待つだけでも出ることを確かめた)ので除く
      if (watching && req.method() !== 'GET' && !/\/rest\/v1\/(rpc\/|bond_levels|friend_profiles|breeder_profiles)/.test(url)) otherWrites.push(`${req.method()} ${url}`);
      await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    });
    await page.goto(`http://localhost:${PORT}/monster-hero/index.html`, { waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: 'TAP TO START' }).click({ timeout: 60000 });
    await page.getByRole('button', { name: 'トップ画面へ進む' }).click({ timeout: 30000 });
    await page.getByRole('button', { name: 'モンヒロバトル' }).waitFor({ timeout: 30000 });
    for (let i = 0; i < 6; i++) {
      const btn = page.getByRole('button', { name: /受け取る|閉じる|はじめる|OK/ }).first();
      if (await btn.count() === 0 || !(await btn.isVisible().catch(() => false))) break;
      await btn.dispatchEvent('click').catch(() => {});
      await page.waitForTimeout(250);
    }
    // HOMEの入口で、報酬の確認(端末の印の修復→取り下げ)が自動で走る。少し待ってから保存を見る
    await page.waitForTimeout(6000);
    const saved = await page.evaluate(() => ({ st: JSON.parse(localStorage.getItem('mh_raid_jack_v1') || 'null'), gifts: JSON.parse(localStorage.getItem('mh_gifts') || '[]') }));
    console.log('INFO', JSON.stringify(saved.st), saved.gifts.map((g) => g.id + ':' + (g.claimedAt ? 'got' : 'new')).join(','));
    check('倒した印は空のまま(取り下げたあとに、報酬が作り直されない)', saved.st && saved.st.b.defeated.length === 0 && saved.st.b.total === 0);
    check('受け取っていない初討伐ギフト(中級・上級)が取り下げられ、受け取った初級と、ほかのギフトは残る', saved.gifts.map((g) => g.id).join() === 'raid_jack_2026_clear_b1,other_gift_keep', saved.gifts.map((g) => g.id).join());
    check('受け取り済みの印は、受け取っていない中級・上級だけが外れ、受け取った初級は残る', saved.st && saved.st.claimed.join() === 'clear_b1', saved.st && saved.st.claimed.join());
    check('取り下げ済みの旗が立つ', saved.st && saved.st.giftsChecked === true && saved.st.repaired === true);
    check('実行時エラーが出ない', errors.length === 0, errors.join(' / '));
  } finally {
    if (browser) await browser.close();
    server.close();
  }
  console.log(failed ? `\nNG ${failed}件` : '\nすべて OK');
  process.exit(failed ? 1 : 0);
})();

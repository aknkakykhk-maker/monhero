// MFバトルカード 紹介動画 第3弾 FEATURE 05「戦術カード」の撮り直し(2026-11-06 社長「戦術カードの部分がよわい」・ビート部テンポ)。
//   node tools/card/card-tactic-feature-video.js [出力フォルダ]   既定: docs/progress/card-intro-video-3/
//   縦 390×844・deviceScaleFactor 3(1170×2532)・音なしの mp4。録画と偽のデータは card-tactic-video.js の部品を使う
//
// 撮るもの(組む → 決まる が同じ文でつながるように、t1 で組んだ作戦を、t2 で相手役が使う)
//   a-t1-build.mp4  … モンヒロ太郎がデッキ登録で作戦を1つ組む(モンスターの欄 → 作戦を足す → 条件のカード → 行動のカード)
//   a-t2-attack.mp4 … ブリーダーA(遊ぶ人)が、モンヒロ太郎の登録デッキと戦う。t1 の攻めの作戦が帯で出て、技が決まる
//   a-t3-guard.mp4  … 守りの作戦が帯で出て、守りが決まる
//   a-t4-other.mp4  … 3つ目の種類の作戦が帯で出る
//   a-t5-smart.mp4  … 確かめの欄の「賢さ GRAND MASTER 相当」
// 本物の Supabase には行かない。デバッグのボタン・合言葉の欄は、書き出した動画には映らない
process.env.CARD_VIDEO_DSF = process.env.CARD_VIDEO_DSF || '3';
const path = require('path');
const fs = require('fs');
const V = require('./card-tactic-video');

const OUT = path.resolve(process.argv[2] || path.join(V.root, 'docs/progress/card-intro-video-3'));
const SHOTS = process.env.CARD_VIDEO_SHOTS || '';
const ME = 'モンヒロ太郎', FOE = 'ブリーダーA';
const DECK = 'dra'; // モンヒロ太郎のデッキの形(ドラの MASTER のデッキ。守りの札が多く、守りの作戦が出やすい)。t1 と t2〜t4 で同じデッキ
const shot = async (page, name) => { if (SHOTS) { fs.mkdirSync(SHOTS, { recursive: true }); await page.screenshot({ path: path.join(SHOTS, `${name}.png`) }); } };

// t1 の始まり: カードランク12・戦術カードを全部持つ・基本2枚(仕留め型・守り型)・モンスターの作戦はまだ無い
const seedBuild = () => {
  let xp = 0;
  for (let r = 1; r < 12; r++) xp += playerRankNeed(r);
  localStorage.setItem('mh_card_level_v1', JSON.stringify({ v: 1, xp, day: '', dayWin: false, got: Array.from({ length: 11 }, (_, i) => i + 2) }));
  const id = (g) => (CARD_TACTIC_CARDS.find((c) => c.g === g) || {}).id;
  const own = {};
  CARD_TACTIC_CARDS.forEach((c) => { own[c.id] = 1; });
  localStorage.setItem('mh_card_tactics_v1', JSON.stringify({ ...cardNormalizeTactics(null), own, frames: { base: [id('tFinish'), id('tGuard'), null], breeder: [], mons: [[], [], []] } }));
  localStorage.removeItem('mh_card_tactics_by_deck_v1');
  return { ko: id('ko'), atk: id('atk') };
};

// モンヒロ太郎の登録デッキ(t1 の画面と同じデッキ)。作戦は t1 で組んだ「倒せる相手 → いちばん良い技で攻撃する」と、
//   「3ダメージ以上の攻撃を受けたとき → いちばん良い守り方で守る」(3体とも)、ブリーダーのガッツの作戦(3つ目の種類)
const meEntry = ([me, deckHabit]) => {
  const db = CARD_BATTLE_DATA;
  const d = cardAiBuildDeck(db, deckHabit, 'master', cardAiSeededRand('tactic-video-mine'));
  const id = (g, v) => (CARD_TACTIC_CARDS.find((c) => c.g === g && (v === undefined || c.v === v)) || {}).id;
  const rows = [{ c: id('ko'), a: id('atk'), on: true }, { c: id('incoming', 3), a: id('guard'), on: true }];
  const breeder = [{ c: id('any'), a: id('gutsOrder', '使えない札'), on: true }, { c: id('any'), a: id('save'), on: true }];
  const frames = cardTacticNormalizeFrames({ base: [id('tFinish'), id('tGuard'), null], breeder, mons: [rows, rows, rows] });
  return { owner_id: 'tacticvideo02', user_name: me, icon: '🛡️', profile_frame: null, deck: { monsters: d.monsters, cards: d.cards },
    tactics: { name: 'わたしのデッキ', habit: deckHabit, aces: [], f: cardTacticPackFrames(frames) }, version: 1, active: true, battles: 5, deck_wins: 3, rents: 0, updated_at: new Date().toISOString() };
};
const KINDS = [
  { name: 'a-t2-attack.mp4', re: /倒せる相手/ },
  { name: 'a-t3-guard.mp4', re: /守り方で守る/ },
  { name: 'a-t4-other.mp4', re: /ガッツ|置く|ためる/ },
];

(async () => {
  const playwright = require('playwright');
  fs.mkdirSync(OUT, { recursive: true });
  const server = await V.serve();
  const browser = await playwright.chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const gap = (p) => p.waitForTimeout(900); // 1手のあいだ(読める速さ)
  try {
    // ---- t1: 組む ----
    {
      const B = await V.boot(browser, { name: ME });
      const ids = await B.page.evaluate(seedBuild);
      await B.page.evaluate(V.mountRegister, DECK);
      const R = (sel) => B.page.locator(`#__reg ${sel}`);
      await R('[data-card-reg-deck]').first().waitFor({ timeout: 20000 });
      await R('[data-card-reg-deck]').first().click(); await B.sleep(500);
      await R('[data-card-reg-next]').click(); await B.sleep(500);
      await R('[data-card-reg-style="custom"]').click(); await B.sleep(1200);
      const t0 = Date.now();
      await gap(B.page);
      await R('[data-card-reg-mon="0"]').click(); await gap(B.page);
      await R('[data-card-reg-add="0"]').click(); await gap(B.page);
      await R('[data-card-reg-custom]').click(); await gap(B.page); await gap(B.page);
      await R(`[data-card-tactic="${ids.ko}"]`).first().click(); await gap(B.page); await gap(B.page);
      await R(`[data-card-tactic="${ids.atk}"]`).first().click();
      await B.sleep(2500);
      await shot(B.page, 't1-done');
      const t1 = Date.now();
      await B.rec.stop(); await B.context.close();
      V.mp4(B.rec, path.join(OUT, 'a-t1-build.mp4'), t0, t1);
      console.log(`書き出し: a-t1-build.mp4(${((t1 - t0) / 1000).toFixed(1)}秒)`);
    }
    // ---- t2〜t4: ブリーダーA がモンヒロ太郎の登録デッキと戦う(オート)----
    {
      const A = await V.boot(browser, { name: FOE });
      const { page, sleep, dismiss } = A;
      await page.locator('[data-home-card-battle]').click();
      await page.locator('[data-card-top]').first().waitFor({ timeout: 20000 });
      await sleep(800); await dismiss();
      await V.starter(page);
      A.state.entry = await page.evaluate(meEntry, [ME, DECK]);
      await page.locator('[data-card-cpu]').click();
      await page.locator('[data-card-mode-assistant]').click();
      await sleep(1200); await dismiss();
      await page.locator('[data-card-foe-tab="breeder"]').click();
      await sleep(1500); await dismiss();
      await page.locator('[data-card-share-fight="tacticvideo02"]').click();
      await page.locator('[data-card-deck-pick]').first().waitFor({ timeout: 15000 });
      await sleep(800); await dismiss();
      await page.locator('[data-card-deck-pick-mode="auto"]').click();
      await sleep(400);
      await page.locator('[data-card-deck-pick-go]').click();
      const glows = [];
      const until = Date.now() + 300000;
      let seen = '';
      while (Date.now() < until && KINDS.some((k) => !k.done)) {
        const g = await page.locator('[data-card-tactic-glow]').first().textContent({ timeout: 300 }).catch(() => null);
        if (g && g !== seen) { glows.push({ at: Date.now(), text: g }); seen = g; console.log(`帯: ${g}`); }
        if (!g) seen = '';
        for (const k of KINDS) {
          const x = !k.done && glows.find((y) => k.re.test(y.text));
          if (x && Date.now() - x.at > 7500) { V.mp4(A.rec, path.join(OUT, k.name), x.at - 4000, x.at + 7000); k.done = true; console.log(`書き出し: ${k.name}(${x.text})`); }
        }
        await sleep(150);
      }
      KINDS.filter((k) => !k.done).forEach((k) => console.log(`${k.name}: 帯が出なかったので撮れない`));
      if (A.errors.length) console.log(`実行時エラー: ${A.errors.slice(0, 3).join(' / ')}`);
      await A.rec.stop(); await A.context.close();
    }
    // ---- t5: 確かめの欄の賢さ(GRAND MASTER 相当・次の HELL まで)----
    {
      const B = await V.boot(browser, { name: ME });
      await B.page.evaluate(V.seedSmart);
      await B.page.evaluate(V.mountRegister, DECK);
      const R = (sel) => B.page.locator(`#__reg ${sel}`);
      await R('[data-card-reg-deck]').first().waitFor({ timeout: 20000 });
      const t0 = Date.now();
      await B.sleep(900);
      await R('[data-card-reg-deck]').first().click(); await B.sleep(700);
      await R('[data-card-reg-next]').click(); await B.sleep(700);
      await R('[data-card-reg-style="custom"]').click(); await B.sleep(500);
      await R('[data-card-reg-next]').click();
      await R('[data-card-reg-smart]').waitFor({ timeout: 10000 });
      await B.sleep(600);
      await R('[data-card-reg-smart]').evaluate((el) => el.scrollIntoView({ block: 'center', behavior: 'smooth' }));
      console.log((await R('[data-card-reg-smart]').innerText()).replace(/\s+/g, ' '));
      await B.sleep(6000);
      const t1 = Date.now();
      await B.rec.stop(); await B.context.close();
      V.mp4(B.rec, path.join(OUT, 'a-t5-smart.mp4'), t0, t1);
      console.log(`書き出し: a-t5-smart.mp4(${((t1 - t0) / 1000).toFixed(1)}秒)`);
    }
  } finally { await browser.close(); server.close(); }
})().catch((e) => { console.error(e.message || e); process.exit(1); });

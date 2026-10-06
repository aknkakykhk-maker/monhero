#!/usr/bin/env node
// ゴースト種(ゴースト・スプーキー)を実際のブラウザで遊んで、効き目が画面に出るか・止まらないかを確かめる(2026-10-05)。
//
//   node tools/monster/ghost-browser-check.js
//
// ユーザー指示「新しい要素が多いから何回も確認して不具合のないように」。式の形は ghost-effects-check.js が見る。
// ここは「本当に遊べるか」を見る。タクティクスプロでゴーストを勇者モンにして、攻撃カードでターンを進める。
//   ① 勇者特性「トリックスタート」: 1ターン目と4ターン目に抽選が出る / 攻撃が当たるとガッツが戻る
// 土台は tools/mode/tactics-ex-skills-browser-check.js(起動・難易度・勇者えらび・配置の進め方)をそのまま写した
const TOOLS_DIR = require('path').join(__dirname, '..'); // tools/ 直下。分類フォルダから見た1つ上
// タクティクス専用 EXスキル(STEP1: 共通基盤)を、実際のブラウザで操作して確かめる。
// 設計の正本: docs/spec/TACTICS_EX_SKILLS.md
//
//   node tools/mode/tactics-ex-skills-browser-check.js
//
// 公開前(TACTICS_EX_SKILLS_RELEASE=false)は、デバッグのバトルモード入口からだけ出る。
// ① ゴーレムを勇者モンにしてタクティクスプロを始める
//    距離枠をタップ → 詳細が開く(発動はしない) → 使用 → 残り 3→2 → カードを選べない
//    → 「ターンを進める」で敵の番へ → 次のターンはカードを選べる
// ② あきらめて、モノリスで新しいランを始める
//    残りが 3/3 から始まる(前のランの回数を持ち越さない) → 使っても同じターンにカードを選べる
// ③ 本番の入口(デバッグでない)のタクティクスプロでは、距離枠をタップしても何も開かない
const http = require('http');
const path = require('path');
const fs = require('fs');

const root = path.resolve(TOOLS_DIR, '..');
const PORT = 8996;
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
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failed++;
};
const released = /const TACTICS_EX_SKILLS_RELEASE = true/.test(
  fs.readFileSync(path.join(root, 'monster-hero/src/parts/10-core.jsx'), 'utf8'));

(async () => {
  let playwright;
  try { playwright = require('playwright'); }
  catch { console.log('SKIP: playwright が入っていないので確認できません'); process.exit(0); }

  const server = await serve();
  const errors = [];
  let browser;
  try {
    browser = await playwright.chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
    const page = await browser.newPage({ viewport: { width: 375, height: 667 } });
    page.on('pageerror', (e) => errors.push(String(e)));
    await page.addInitScript(() => {
      localStorage.setItem('mh_breeder_name', JSON.stringify('検査ブリーダー'));
      localStorage.setItem('mh_breeder_icon', JSON.stringify('🐣'));
      localStorage.setItem('mh_onboarded', JSON.stringify(true));
      localStorage.setItem('mh_tutorial_seen_v1', JSON.stringify(true));
      localStorage.setItem('mh_battle_tutorial_seen_v1', JSON.stringify(true));
      localStorage.setItem('mh_battle_tutorial_guide_shown_v1', JSON.stringify(true));
      localStorage.setItem('mh_masu_migrated', JSON.stringify(true));
      localStorage.setItem('mh_inherited_unique_level_compensation_v1', JSON.stringify(true));
      localStorage.setItem('mh_inherited_unique_level_compensation_pending_v1', JSON.stringify(false));
      localStorage.setItem('mh_tactics_intro_seen_v1', JSON.stringify(true));
      // 剣士モッチー(円盤石で解放するレア)も勇者モンに選べるようにする。検査のまっさらなデータだけの話
      localStorage.setItem('mh_unlocked_monsters', JSON.stringify(['Mocchi','Suezo','Golem','Tiger','Ham','Pixie','Monol','Oboro','KenshiMocchi','Mia','Snegurochka','Undine','Yaobikuni','Pandora','Ghost','Spooky']));
      // すぐ消える表示(ポップアップ)は、出た瞬間に文を拾ってためる
      document.addEventListener('DOMContentLoaded', () => {
        window.__pops = [];
        // 運しだいの結果は画面上の帯(data-battle-luck-banner)に出る。「帯:見出し 結果」の形でためる(2026-10-06)
        new MutationObserver((ms) => { for (const m of ms) for (const n of m.addedNodes) { if (n.nodeType === 1) n.querySelectorAll?.('[data-battle-luck-banner]').forEach(b => { if (!b.__seen) { b.__seen = true; window.__pops.push(`帯:${b.querySelector('[data-battle-luck-title]')?.textContent} ${b.querySelector('[data-battle-luck-result]')?.textContent}`); window.__bannerGeo = window.__bannerGeo || []; const r = b.getBoundingClientRect(), res = b.querySelector('[data-battle-luck-result]'); window.__bannerGeo.push({ left: r.left, right: r.right, top: r.top, bottom: r.bottom, vw: innerWidth, vh: innerHeight, cut: !!res && res.scrollWidth > res.clientWidth + 1 }); } }); if (n.nodeType === 1 && n.matches?.('[data-battle-luck-banner]') && !n.__seen) { n.__seen = true; window.__pops.push(`帯:${n.querySelector('[data-battle-luck-title]')?.textContent} ${n.querySelector('[data-battle-luck-result]')?.textContent}`); window.__bannerGeo = window.__bannerGeo || []; const r = n.getBoundingClientRect(), res = n.querySelector('[data-battle-luck-result]'); window.__bannerGeo.push({ left: r.left, right: r.right, top: r.top, bottom: r.bottom, vw: innerWidth, vh: innerHeight, cut: !!res && res.scrollWidth > res.clientWidth + 1 }); } const t = (n.textContent || '').trim(); if (t && t.length < 120 && /🎩|トリックスタート|コイン|運命の輪|乱心|オフリィアボイド|トリックコンフューズ|完全回避|意味不明/.test(t)) window.__pops.push(t); } })
          .observe(document.documentElement, { childList: true, subtree: true });
      });
    });
    // ★ランキングへは何も送らない(本番の入口でも途中で読み込み直すだけで、降参しない)
    await page.route(/supabase\.co/, (route) => route.abort());
    const boot = async () => {
      await page.goto(`http://localhost:${PORT}/monster-hero/index.html`, { waitUntil: 'domcontentloaded' });
      await page.getByRole('button', { name: 'TAP TO START' }).click({ timeout: 60000 });
      await page.getByRole('button', { name: 'トップ画面へ進む' }).click({ timeout: 30000 });
      await page.getByRole('button', { name: 'モンヒロバトル' }).waitFor({ timeout: 30000 });
    };
    await boot();
    const closePopups = async () => {
      for (let i = 0; i < 8; i += 1) {
        const btn = page.getByRole('button', { name: /受け取る|閉じる|はじめる|OK|スキップ/ }).first();
        if (await btn.count() === 0 || !(await btn.isVisible().catch(() => false))) break;
        await btn.dispatchEvent('click').catch(() => {});
        await page.waitForTimeout(300);
      }
    };
    await closePopups();
    const text = () => page.evaluate(() => document.body.innerText.replace(/\s+/g, ' '));

    // 難易度選択 → 勇者モン(名前で名指し) → 配置 → アシストカード → バトル
    // ★見つからなければその場で止める(押せるものを押して進めない。設計 11.2)
    // heroStyle … 配置の画面で選ぶ初期スタイル(剣士モッチーのとき)
    const startTacticsPro = async (heroName, heroStyle = null) => {
      await page.getByText('BATTLE MODE').first().waitFor({ timeout: 15000 });
      const opened = await page.evaluate(() => {
        const cards = [...document.querySelectorAll('[data-battle-mode="tacticsPro"]')];
        const card = cards[Math.floor(cards.length / 2)] || cards[0];
        const b = card && [...card.querySelectorAll('button')].find(x => x.textContent.includes('難易度を選ぶ'));
        if (!b || b.disabled) return false;
        b.click(); return true;
      });
      if (!opened) return 'タクティクスプロの「難易度を選ぶ」が押せない';
      await page.waitForTimeout(1500);
      const go = await page.evaluate(() => {
        const b = [...document.querySelectorAll('button')].find(x => x.textContent.includes('この難易度で挑戦') && !x.disabled);
        if (b) b.click(); return !!b;
      });
      if (!go) return '「この難易度で挑戦」が押せない';
      await page.waitForTimeout(1500);
      const hero = await page.evaluate((name) => {
        const b = [...document.querySelectorAll('button')].find(x => !x.disabled && x.offsetParent
          && x.textContent.trim().replace(/^前回/, '') === name && !/DEBUG/.test(x.textContent)); // 勇者えらびは顔アイコンのグリッド。タイルの文字は名前だけ(上の絞り込みタブは名前+数、前回使った子には「前回」が付く)
        if (b) b.click(); return !!b;
      }, heroName);
      if (!hero) return `勇者モンに ${heroName} が並んでいない: ` + await page.evaluate(() => [...document.querySelectorAll('button')].filter(x=>x.offsetParent).map(x=>x.textContent.trim().slice(0,30)).join(' | ').slice(0,1500));
      // 顔アイコンのグリッドは、タイルを押すと下の詳細パネルが開き、「この子で挑む」で確定する
      await page.waitForTimeout(500);
      await page.evaluate(() => {
        const b = [...document.querySelectorAll('button')].find(x => !x.disabled && x.offsetParent && /^この子で挑む$/.test(x.textContent.trim()));
        if (b) b.click();
      });
      await page.waitForTimeout(1200);
      if (heroStyle) {
        const b = page.locator(`[data-hero-style="${heroStyle}"]`);
        if (await b.count() === 0) return `配置の画面に初期スタイル(${heroStyle})が出ない`;
        await b.click();
        await page.waitForTimeout(300);
        if (await b.getAttribute('aria-pressed') !== 'true') return `初期スタイル(${heroStyle})を選べない`;
      }
      // 供モン候補5体は「変更」→ 一覧から1体ずつ選ぶ(勇者モンと同じ子は選ばない)
      await page.evaluate(() => { window.__change = 1; });
      for (let i = 0; i < 40; i += 1) {
        if (/WAVE 1\/10/.test(await text())) break;
        const step = await page.evaluate((heroName) => {
          const live = [...document.querySelectorAll('button')].filter(x => !x.disabled && x.offsetParent);
          const pick = (re) => live.find(x => re.test(x.textContent.trim()));
          const go = pick(/出撃|バトル開始|この編成で|この子で挑む|供モン\d*にする|^決定$|^確定$/); if (go) { go.click(); return 'go'; }
          const confirm = pick(/^(習得する|強化する)$/); if (confirm) { confirm.click(); return 'confirm'; }
          const teaching = pick(/新規習得|強化後/); if (teaching) { teaching.click(); return 'teach'; }
          const slot = pick(/^(零|近|中|遠)距離/); if (slot) { slot.click(); return 'slot'; }
          const mons = live.filter(x => /ライフ\s*\d+/.test(x.textContent) && !x.textContent.trim().startsWith(heroName)
            && x.textContent.trim() !== '詳細を見る' && !/DEBUG/.test(x.textContent));
          if (mons.length) { mons[0].click(); return 'mon'; }
          const changes = live.filter(x => x.textContent.trim() === '変更');
          if (changes.length && window.__change < changes.length) { changes[window.__change].click(); window.__change += 1; return 'change'; }
          const start = pick(/はじめる|この子で/); if (start) { start.click(); return 'start'; }
          return null;
        }, heroName);
        if (!step) break;
        await page.waitForTimeout(900);
      }
      return /WAVE 1\/10/.test(await text()) ? 'ok' : `バトルまで進めない: ${(await text()).slice(0, 600)} || ` + await page.evaluate(() => [...document.querySelectorAll('button')].filter(x=>x.offsetParent).map(x=>(x.disabled?'[x]':'')+x.textContent.trim().slice(0,24)).join(' | ').slice(0,1200));
    };
    // 勇者モンが立っている枠(WAVE1は1体だけ)
    const heroSlot = () => page.evaluate(() => {
      const b = [...document.querySelectorAll('button[data-slot-index]')].find(x => /[^-\s]/.test((x.textContent || '').replace(/---/g, '')) && x.querySelector('img'));
      return b ? Number(b.getAttribute('data-slot-index')) : null;
    });
    // ★行動中(敵の番の演出中)は枠が押せない。押せるようになるまで待ってから押す
    const tapSlot = async (i) => {
      const slot = page.locator(`button[data-slot-index="${i}"]`);
      for (let k = 0; k < 40 && await slot.isDisabled().catch(() => false); k += 1) await page.waitForTimeout(500);
      await slot.click({ timeout: 10000 }).catch(async (e) => {
        const why = await page.evaluate((n) => { const el = document.querySelector(`button[data-slot-index="${n}"]`); const r = el.getBoundingClientRect(); const top = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2); return `disabled=${el.disabled} 上にあるもの=${top && (top.outerHTML || '').slice(0, 200)}`; }, i);
        throw new Error(`枠${i}を押せない: ${why} / ${(await text()).slice(0, 200)}`);
      });
      await page.waitForTimeout(500);
    };
    const panel = () => page.evaluate(() => {
      const p = document.querySelector('[data-tactics-ex-panel]');
      if (!p) return null;
      const t = (sel) => (p.querySelector(sel)?.textContent || '').trim();
      const useBtn = p.querySelector('[data-tactics-ex-use]');
      return {
        slot: Number(p.getAttribute('data-tactics-ex-panel')), mon: t('[data-tactics-ex-mon]'), name: t('[data-tactics-ex-name]'),
        uses: t('[data-tactics-ex-uses]'), withCards: p.querySelector('[data-tactics-ex-with-cards]')?.getAttribute('data-tactics-ex-with-cards'),
        dev: !!p.querySelector('[data-tactics-ex-dev]'), why: t('[data-tactics-ex-why]'),
        canUse: !!useBtn && !useBtn.disabled, text: p.innerText.replace(/\s+/g, ' '),
        // スマホ縦で、使用ボタンが画面の中(ホームインジケーターより上)にあるか
        useBottom: useBtn ? useBtn.getBoundingClientRect().bottom : null, vh: window.innerHeight,
      };
    });
    const closePanel = async () => {
      await page.evaluate(() => document.querySelector('[data-tactics-ex-close]')?.click());
      await page.waitForTimeout(400);
    };
    // 手札のカードを1枚タップして、選べたか(選択中の枚数が増えたか)
    const selectedCount = () => page.evaluate(() => {
      const m = document.body.innerText.match(/Action Cards\s*(\d+)\/(\d+)/i);
      return m ? Number(m[1]) : null;
    });
    // ★手札は抽選なので、先頭のカードがガッツ不足のこともある。「いま使えるカード」を選ぶ
    //   (併用できないEXのターンは全部使えなくなるので、そのときは先頭を押して選べないことを見る)
    let tappedCard = 0;
    const tapFirstCard = async () => {
      const idx = await page.evaluate(() => {
        const cards = [...document.querySelectorAll('[data-hand-card]')];
        // 攻撃カードは「通常技のえらび直し」が開いて枠を覆うことがあるので、守り・支援を先に選ぶ
        const usable = (c) => c.getAttribute('data-card-usable') === 'true';
        let i = cards.findIndex(c => usable(c) && !/atk|unique/.test(c.getAttribute('data-card-type') || ''));
        if (i < 0) i = cards.findIndex(usable);
        return i < 0 ? 0 : i;
      });
      tappedCard = idx;
      await page.locator('[data-hand-card]').nth(idx).click({ timeout: 10000 }).catch(() => {});
      await page.waitForTimeout(700);
      // 通常技のえらび直しが開いたら、いま使っている技をそのまま選んで閉じる
      await page.evaluate(() => {
        const b = [...document.querySelectorAll('button')].find(x => !x.disabled && x.offsetParent && /\(使用中\)/.test(x.textContent));
        if (b) b.click();
      });
      await page.waitForTimeout(500);
    };
    const unselectAll = async () => {
      for (let k = 0; k < 4; k += 1) {
        const n = await selectedCount();
        if (!n) return;
        // tapFirstCard で選んだ1枚をもう一度押すと外れる
        await page.locator('[data-hand-card]').nth(tappedCard).click({ timeout: 10000, force: true }).catch(() => {});
        await page.waitForTimeout(500);
      }
    };

    // 攻撃カードを1枚選んで勇者モンの枠へ置き、行動を押してターンを進める
    const closeExPanel = async () => {
      if (await page.evaluate(() => !!document.querySelector('[data-tactics-ex-panel]'))) {
        await page.evaluate(() => document.querySelector('[data-tactics-ex-close]')?.click());
        await page.waitForTimeout(400);
      }
    };
    const turnNo = async () => { const m = (await text()).match(/TURN (\d+)\/20/); return m ? Number(m[1]) : null; };
    const playAttackTurn = async (attack = true) => {
      const before = await turnNo();
      const s = await heroSlot();
      // attack:false のときはガード・回復・強化・ドローのカード(敵を倒さずにターンだけ進める)
      // attack:'unique' のときは固有技(手札に無ければ、敵を倒さないよう攻撃以外のカードでつなぐ)
      const idx = await page.evaluate((res) => {
        const cards = [...document.querySelectorAll('[data-hand-card]')];
        for (const re of res) {
          const i = cards.findIndex(c => c.getAttribute('data-card-usable') === 'true' && new RegExp(re).test(c.getAttribute('data-card-type') || ''));
          if (i >= 0) return i;
        }
        return -1;
      }, attack === 'unique' ? ['^unique$', '^(guard|weak_guard|heal|buff|draw)$', 'atk'] : attack ? ['atk'] : ['^(guard|weak_guard|heal|buff|draw)$']);
      if (idx >= 0) {
        await page.locator('[data-hand-card]').nth(idx).click({ timeout: 10000 }).catch(() => {});
        await page.waitForTimeout(600);
        await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find(x => !x.disabled && x.offsetParent && /\(使用中\)/.test(x.textContent)); if (b) b.click(); });
        await page.waitForTimeout(400);
        await closeExPanel();
        if (s != null) await tapSlot(s);
      }
      // ★置き先の決まっているカードで枠を押すと、その子のEXの詳細が開くことがある。開いていたら閉じてから進める
      await closeExPanel();
      await page.evaluate(() => document.querySelector('[data-battle-action]')?.click());
      for (let k = 0; k < 60; k += 1) {
        await page.waitForTimeout(500);
        const now = await turnNo();
        if (now != null && before != null && now !== before) break;
        if (/WAVE 2\/10|GAME OVER|クリア/.test(await text())) break;
      }
      await page.waitForTimeout(800);
      return idx >= 0 && (await turnNo()) !== before;
    };
    const pops = () => page.evaluate(() => (window.__pops || []).slice());
    // その枠の子のEXを使う(枠をタップ → 詳細の「使う」)。使えたら true
    const useEx = async (slot) => {
      await tapSlot(slot);
      const can = await page.evaluate(() => { const b = document.querySelector('[data-tactics-ex-use]'); return !!b && !b.disabled; });
      if (!can) { await page.evaluate(() => document.querySelector('[data-tactics-ex-close]')?.click()); return false; }
      await page.locator('[data-tactics-ex-use]').click();
      await page.waitForTimeout(900);
      return true;
    };

    await page.getByRole('button', { name: 'モンヒロバトル' }).dispatchEvent('click', {}, { timeout: 15000 });
    await page.waitForTimeout(600);
    await page.locator('[data-battle-system="systemTactics"]').dispatchEvent('click', {}, { timeout: 15000 });
    const started = await startTacticsPro('ゴースト');
    check('タクティクスプロをゴーストで始められる', started === 'ok', started);
    if (started === 'ok') {
      await page.waitForTimeout(1500);
      await closePopups();
      let p = await pops();
      check('1ターン目にトリックスタートの抽選が出る', p.some(t => /トリックスタート/.test(t)), p.slice(0, 6).join(' / '));
      // EX「オフリィアボイド」: 完全回避を2つもらう。WAVE1はゴースト1体なので、敵の攻撃はゴーストへ来る
      const gSlot = await heroSlot();
      check('ゴーストのEX「オフリィアボイド」を使える', await useEx(gSlot), `枠${gSlot}`);
      check('使うとカットインとポップアップが出る', (await pops()).some(t => /EX オフリィアボイド！/.test(t)), (await pops()).slice(-4).join(' / '));
      const panelText = async () => { await tapSlot(gSlot); const t = await page.evaluate(() => document.querySelector('[data-tactics-ex-panel]')?.innerText.replace(/\s+/g, ' ') || ''); await page.evaluate(() => document.querySelector('[data-tactics-ex-close]')?.click()); await page.waitForTimeout(300); return t; };
      check('使うと残り回数が 4 / 5 になる', /4 \/ 5/.test(await panelText()));
      // 1ターン目で敵を倒すとWAVEが変わって4ターン目まで行けないので、先にカードを置かずに3ターン進める
      for (let k = 0; k < 6 && (await turnNo()) < 4; k += 1) await playAttackTurn(false);
      check('攻撃以外のカードで4ターン目まで進められた', (await turnNo()) === 4, `TURN ${await turnNo()}`);
      p = await pops();
      const rolls = p.filter(t => /^帯:🎩 ゴーストのトリックスタート (当たり！|はずれ…)/.test(t)).length;
      check('4ターン目にもう一度抽選が出る(1・4ターン目で2回)', rolls >= 2 && (await turnNo()) === 4, `${rolls}回 / TURN ${await turnNo()}`);
      check('2・3ターン目には抽選しない(1・4ターン目の2回だけ)', rolls === 2, `${rolls}回`);
      // 3ターンのあいだに敵が殴ってきていれば、完全回避でかわしている(殴られた回数ぶん、2回まで)
      const log = await page.evaluate(() => document.body.innerText);
      const avoided = p.filter(t => /👻 完全回避！/.test(t)).length;
      check('狙われた攻撃を完全回避でかわす(1回ごとに1つ減る)', avoided >= 1 && avoided <= 2 && p.some(t => /完全回避！ (のこり1回|これで最後)/.test(t)),
        `${avoided}回 / ${p.filter(t => /完全回避/.test(t)).join(' / ')}`);
      // 固有技「運命のコイン」: 使うたびに表か裏のどちらかが出る(手札に無いうちはふつうの攻撃)。
      // ★敵を倒すとWAVEの結果画面で止まるので、固有技を先に使う
      let attacked = 0;
      for (let k = 0; k < 10 && !(await pops()).some(t => /運命のコイン/.test(t)); k += 1) {
        if (/GAME OVER|CLEAR/.test(await text())) break;
        await closePopups();
        if (await playAttackTurn('unique')) attacked += 1;
      }
      p = await pops();
      check('攻撃カードでターンを進められた', attacked > 0, `${attacked}回`);
      check('攻撃が当たるとガッツが戻る(🎩 ガッツ +)', p.some(t => /🎩 ガッツ \+\d+/.test(t)), p.slice(0, 10).join(' / '));
      check('ゴーストの固有技で運命のコイン(表・裏)が出る', p.some(t => /^帯:🪙 ゴーストの運命のコイン (表！ ダメージ4倍・連撃\+10%|裏… ダメージ0\.5倍・消費ガッツ\+20%)/.test(t)), p.filter(t => /🪙|コイン/.test(t)).slice(0, 4).join(' / ') || `${(await text()).slice(0, 160)} || ` + await page.evaluate(() => [...document.querySelectorAll('[data-hand-card]')].map(c => `${c.getAttribute('data-card-type')}:${c.getAttribute('data-card-usable')}:${c.getAttribute('data-card-cost')}`).join(' ')));
    }
    // スプーキー: 運命の輪(当てるたびに6つから1つ)
    // ★乱心の表示(意味不明の予告・敵が動かないターン)を見るため、この回だけ敵のライフを40倍にする。
    //   WAVE1の敵はライフ120で、乱心にする攻撃そのもので倒れてしまう。検査の中で読み込むファイルを書き換えるだけ
    await page.route(/data\/enemy-monsters\.js/, async (route) => {
      const res = await route.fetch();
      const body = (await res.text()).replace(/baseHp:(\d+)/g, (m, n) => `baseHp:${Number(n) * 40}`);
      await route.fulfill({ response: res, body });
    });
    await boot();
    await closePopups();
    await page.evaluate(() => { window.__pops = []; });
    await page.getByRole('button', { name: 'モンヒロバトル' }).dispatchEvent('click', {}, { timeout: 15000 });
    await page.waitForTimeout(600);
    await page.locator('[data-battle-system="systemTactics"]').dispatchEvent('click', {}, { timeout: 15000 });
    const started2 = await startTacticsPro('スプーキー');
    check('タクティクスプロをスプーキーで始められる', started2 === 'ok', started2);
    if (started2 === 'ok') {
      await page.waitForTimeout(1500);
      await closePopups();
      check('スプーキーもトリックスタートの抽選が出る', (await pops()).some(t => /スプーキーのトリックスタート/.test(t)));
      const sSlot = await heroSlot();
      let exUsed = false;
      for (let k = 0; k < 10 && !(await pops()).some(t => /運命の輪/.test(t)); k += 1) {
        if (/GAME OVER|CLEAR/.test(await text())) break;
        await closePopups();
        // 固有技が手札に来たターンに、先にEX「トリックコンフューズ」を使う(当てると乱心になる)
        const hasUnique = await page.evaluate(() => [...document.querySelectorAll('[data-hand-card]')].some(c => c.getAttribute('data-card-type') === 'unique' && c.getAttribute('data-card-usable') === 'true'));
        if (hasUnique && !exUsed) exUsed = await useEx(sSlot);
        await playAttackTurn('unique');
      }
      const p2 = await pops();
      check('スプーキーのEX「トリックコンフューズ」を使える', exUsed && p2.some(t => /EX トリックコンフューズ！/.test(t)), p2.slice(-6).join(' / '));
      check('効いているあいだにスプーキーの攻撃を当てると、敵が乱心になる', p2.some(t => /^帯:🌀 スプーキーのトリックコンフューズ 敵が乱心！ 次の3回の行動が、50%で意味不明になる/.test(t)), p2.slice(-6).join(' / '));
      // 乱心の振り方を確かめるため、次の予告を決めるあいだだけ乱数を小さくする(50%未満 → 意味不明)
      if (p2.some(t => /敵が乱心！/.test(t)) && !/CLEAR|GAME OVER/.test(await text())) {
        const confusedShown = await page.evaluate(() => !!document.querySelector('[data-enemy-confused]'));
        // 札はアイコン表示だと文字が短いので、名前は title(aria-label)で見る
        // 2026-10-06 から、乱心の残りターンは敵の帯の下の「敵の状態」の列に出る(味方の強化の札とは別)
        const chip = await page.evaluate(() => { const el = document.querySelector('[data-enemy-debuff="confuse"]'); return !!el && /残り\d+T/.test(el.innerText); });
        check('乱心の残りターンが敵の状態の列に出る', chip || confusedShown);
        if (!confusedShown) {
          await page.evaluate(() => { window.__realRandom = Math.random; Math.random = () => 0.1; });
          await playAttackTurn(false);
          await page.evaluate(() => { if (window.__realRandom) Math.random = window.__realRandom; });
        }
        const intentText = await page.evaluate(() => document.querySelector('[data-enemy-intent]')?.innerText.replace(/\s+/g, ' ') || '');
        check('乱心で「意味不明」になった行動が、次の行動の札に出る', /意味不明/.test(intentText) && /動けない・会心確定/.test(intentText), intentText);
        if (/意味不明/.test(intentText) && !/CLEAR|GAME OVER/.test(await text())) {
          await playAttackTurn(false);
          check('意味不明になったことが帯にも出る', (await pops()).some(t => /^帯:❓ 乱心 敵の次の行動が「意味不明」に！/.test(t)), (await pops()).filter(t => /^帯:/.test(t)).slice(-3).join(' / '));
          check('意味不明のターン、敵は動かない', (await pops()).some(t => /❓ 意味不明！ 敵は動けない/.test(t)), (await pops()).slice(-4).join(' / '));
        }
      }
      check('スプーキーの固有技で運命の輪が出る(6つのどれか)', p2.some(t => /^帯:🎡 スプーキーの運命の輪 (敵の与ダメ−30%\(2ターン\)|敵の被ダメ\+30%\(2ターン\)|ダメージ3倍|ダメージ2倍|連撃\+10%|ちから\+15%)/.test(t)), p2.slice(-6).join(' / '));
    }
    {
      const geo = await page.evaluate(() => window.__bannerGeo || []);
      const bad = geo.filter(g => g.left < 0 || g.right > g.vw || g.top < 0 || g.bottom > g.vh || g.cut);
      check('運しだいの結果の帯は、狭い画面(375px)でも画面の中に収まり、文字が切れない', geo.length > 0 && bad.length === 0, `${geo.length}枚 / はみ出し${bad.length}枚 ${JSON.stringify(bad[0] || {})}`);
    }
    check('実行時エラーが出ていない', errors.length === 0, errors.slice(0, 2).join(' / '));
  } catch (e) {
    check('最後まで確かめられた', false, String(e).slice(0, 300));
  } finally {
    if (browser) await browser.close();
    server.close();
  }
  console.log(failed ? `\n${failed}件のNGがあります` : '\nすべてOK');
  process.exit(failed ? 1 : 0);
})();

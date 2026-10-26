#!/usr/bin/env node
// バトル中のモンスターの詳細と、枠の「マーク×数」の濃さを実際のブラウザで確かめる(2026-10-13 社長の依頼
// 「バトル中のバフ効果札が濃くてモンスターが隠れる。少し薄くして、あとはモンスターをタップすると能力含め詳細バフも見れるようにして」)。
//
//   node tools/battle/unit-detail-browser-check.js        (UD_SHOT=<フォルダ> で静止画を残す)
//
// 土台(起動・タクティクスプロの始め方・カードの進め方)は melody-kuromy-browser-check.js をそのまま写した。
//   ① 枠の「マーク×数」の地が薄い(下の絵が透ける)・字に縁取りがあり読める・枠からはみ出さない
//   ② タクティクス: カードを置く途中でないとき枠を押すと EX の窓が開き(今までどおり)、「能力・効果」へ切り替えると
//      ライフ・ガッツ・ちから・丈夫さ(いまの値と元の値)・この子の効果・味方全員の効果が出る。ちからは「ステータス」と同じ値
//   ③ カードを選んでいる途中の枠のタップは、コードの検査(unit-detail-check.js)で見る
//   ④ 敵を押すと、敵のライフ・攻撃力・かかっている効果が出る。ライフは画面上の帯と同じ値
//   ⑤ クラシックのチャレンジ(タクティクス以外)でも、味方の枠を押すと同じ詳細が開く
//   ⑥ どの窓も幅390で文字がはみ出さない
const TOOLS_DIR = require('path').join(__dirname, '..');
const { pickProParty } = require('./lib/pro-party-pick');
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
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
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
      localStorage.setItem('mh_unlocked_monsters', JSON.stringify(['Mocchi','Suezo','Golem','Tiger','Ham','Pixie','Monol','Oboro','KenshiMocchi','Mia','Snegurochka','Undine','Yaobikuni','Pandora','Ghost','Spooky','Melody','Kuromy']));
      // すぐ消える表示(ポップアップ)は、出た瞬間に文を拾ってためる
      document.addEventListener('DOMContentLoaded', () => {
        window.__pops = [];
        // 運しだいの結果は画面上の帯(data-battle-luck-banner)に出る。「帯:見出し 結果」の形でためる(2026-10-06)
        new MutationObserver((ms) => { for (const m of ms) for (const n of m.addedNodes) { if (n.nodeType === 1) n.querySelectorAll?.('[data-battle-luck-banner]').forEach(b => { if (!b.__seen) { b.__seen = true; window.__pops.push(`帯:${b.querySelector('[data-battle-luck-title]')?.textContent} ${b.querySelector('[data-battle-luck-result]')?.textContent}`); window.__bannerGeo = window.__bannerGeo || []; const r = b.getBoundingClientRect(), res = b.querySelector('[data-battle-luck-result]'); window.__bannerGeo.push({ left: r.left, right: r.right, top: r.top, bottom: r.bottom, vw: innerWidth, vh: innerHeight, cut: !!res && res.scrollWidth > res.clientWidth + 1 }); } }); if (n.nodeType === 1 && n.matches?.('[data-battle-luck-banner]') && !n.__seen) { n.__seen = true; window.__pops.push(`帯:${n.querySelector('[data-battle-luck-title]')?.textContent} ${n.querySelector('[data-battle-luck-result]')?.textContent}`); window.__bannerGeo = window.__bannerGeo || []; const r = n.getBoundingClientRect(), res = n.querySelector('[data-battle-luck-result]'); window.__bannerGeo.push({ left: r.left, right: r.right, top: r.top, bottom: r.bottom, vw: innerWidth, vh: innerHeight, cut: !!res && res.scrollWidth > res.clientWidth + 1 }); } const t = (n.textContent || '').trim(); if (t && t.length < 120 && /🎩|トリックスタート|コイン|運命の輪|乱心|オフリィアボイド|トリックコンフューズ|完全回避|意味不明|混乱中/.test(t)) window.__pops.push(t); } })
          .observe(document.documentElement, { childList: true, subtree: true });
      });
    });
    // ★ランキングへは何も送らない(本番の入口でも途中で読み込み直すだけで、降参しない)
    // 通信を差し替えたので、ゲーム側の「自動操作では書き込まない」止めを外す(26-supabase.jsx)
    await page.addInitScript(() => { window.__mhSupabaseStubbed = true; });
    await page.evaluate(() => { window.__mhSupabaseStubbed = true; }).catch(() => {});
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
      // プロモードの編成: 枠へ入れてから勇者モンを選ぶ(tools/battle/lib/pro-party-pick.js)
      const proPickError = await pickProParty(page, heroName);
      if (proPickError) return proPickError;
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

    // バトル画面の札(勇者特性のスタック)と、敵の状態の列の文
    const bodyText = () => page.evaluate(() => document.body.innerText.replace(/\s+/g, ' '));
    // 敵を倒さないうちにスタックを貯めたいので、敵のライフを40倍にする(検査の中で読み込むファイルを書き換えるだけ)
    await page.route(/data\/enemy-monsters\.js/, async (route) => {
      const res = await route.fetch();
      const body = (await res.text()).replace(/baseHp:(\d+)/g, (m, n) => `baseHp:${Number(n) * 40}`);
      await route.fulfill({ response: res, body });
    });
    const startWith = async (name) => {
      await boot();
      await closePopups();
      // すぐ消える表示(ポップアップ・帯)の文を、起動のたびにその場で見張ってためる
      await page.evaluate(() => {
        window.__pops = [];
        new MutationObserver((ms) => { for (const m of ms) for (const n of m.addedNodes) {
          if (n.nodeType !== 1) continue; const t = (n.textContent || '').trim(); if (t && t.length < 120) window.__pops.push(t);
        } }).observe(document.body, { childList: true, subtree: true });
      });
      await page.getByRole('button', { name: 'モンヒロバトル' }).dispatchEvent('click', {}, { timeout: 15000 });
      await page.waitForTimeout(600);
      await page.locator('[data-battle-system="systemTactics"]').dispatchEvent('click', {}, { timeout: 15000 });
      return startTacticsPro(name);
    };

    const shotDir = process.env.UD_SHOT || '';
    const shot = async (name) => { if (shotDir) await page.screenshot({ path: `${shotDir}/${name}.png` }); };
    // 開いている窓の中で、字が横にはみ出している所(幅390で切れていないか)
    const overflowIn = (sel) => page.evaluate((s) => {
      const box = document.querySelector(s);
      if (!box) return ['窓が無い'];
      const out = [];
      const r = box.getBoundingClientRect();
      if (r.left < 0 || r.right > window.innerWidth + 0.5) out.push(`窓が画面の外 ${Math.round(r.left)}〜${Math.round(r.right)}`);
      box.querySelectorAll('*').forEach((el) => {
        if (el.children.length === 0 && el.scrollWidth > el.clientWidth + 1 && getComputedStyle(el).overflowX !== 'auto') out.push((el.textContent || '').slice(0, 16));
      });
      return out;
    }, sel);

    // ---- タクティクス(メロディー) ----
    const started = await startWith('メロディー');
    check('タクティクスプロをメロディーで始められる', started === 'ok', started);
    if (started === 'ok') {
      const mSlot = await heroSlot();
      for (let k = 0; k < 3; k += 1) await playAttackTurn(true);
      // EXを使って、残りターン(⏳)も枠に出す(クッキーが無ければ使えないので、使えたときだけ)
      await tapSlot(mSlot);
      if (await page.evaluate(() => { const b = document.querySelector('[data-tactics-ex-use]'); return !!b && !b.disabled; })) {
        await page.locator('[data-tactics-ex-use]').click(); await page.waitForTimeout(900);
      } else await closeExPanel();
      // EXのカットインが消えてから見る(静止画に札が写るように)
      await page.waitForFunction(() => !document.querySelector('[data-tactics-ex-cutin]'), null, { timeout: 8000 }).catch(() => {});
      await page.waitForTimeout(2500);
      // ① 札の濃さ
      const marks = await page.evaluate((i) => {
        const box = document.querySelector(`button[data-slot-index="${i}"]`);
        return [...(box ? box.querySelectorAll('[data-stack-mark]') : [])].map((m) => {
          const cs = getComputedStyle(m), a = box.getBoundingClientRect(), b = m.getBoundingClientRect();
          const alpha = Number((cs.backgroundColor.match(/rgba?\(([^)]+)\)/) || [])[1]?.split(',')[3] ?? 1);
          return { kind: m.getAttribute('data-stack-mark'), alpha, shadow: cs.textShadow, inSlot: b.left >= a.left && b.right <= a.right && b.top >= a.top && b.bottom <= a.bottom };
        });
      }, mSlot);
      check('枠に「マーク×数」が出ている', marks.length > 0, JSON.stringify(marks.map((m) => m.kind)));
      check('マーク×数の地は薄い(不透明度0.5以下で、下の絵が透ける)', marks.length > 0 && marks.every((m) => m.alpha <= 0.5), JSON.stringify(marks.map((m) => m.alpha)));
      check('地を薄くしたぶん、字に縁取りがあって読める', marks.length > 0 && marks.every((m) => m.shadow && m.shadow !== 'none'));
      check('マーク×数は枠からはみ出さない', marks.every((m) => m.inSlot));
      await shot('after-marks');
      // ② タップで EX の窓 → 能力・効果
      await tapSlot(mSlot);
      const exOpen = await page.evaluate(() => !!document.querySelector('[data-tactics-ex-panel] [data-tactics-ex-name]'));
      check('枠を押すと、今までどおり EX の窓(EXスキルの側)が開く', exOpen);
      check('EX の窓に「EXスキル」「能力・効果」の切り替えがある', await page.locator('[data-unit-detail-tab="status"]').count() === 1 && await page.locator('[data-unit-detail-tab="ex"]').getAttribute('aria-pressed') === 'true');
      await page.locator('[data-unit-detail-tab="status"]').click();
      await page.waitForTimeout(300);
      const ally = await page.evaluate(() => {
        const p = document.querySelector('[data-tactics-unit-detail]');
        if (!p) return null;
        const num = (k) => (p.querySelector(`[data-unit-stat="${k}"]`)?.innerText || '').replace(/\s+/g, ' ');
        return { text: p.innerText.replace(/\s+/g, ' '), hp: num('hp'), guts: num('guts'), atk: num('atk'), def: num('def'), apt: num('apt'),
          own: p.querySelectorAll('[data-unit-effects="own"] [data-unit-effect]').length, team: p.querySelectorAll('[data-unit-effects="team"] [data-unit-effect]').length,
          ownKinds: [...p.querySelectorAll('[data-unit-effects="own"] [data-unit-effect]')].map((e) => e.getAttribute('data-unit-effect')) };
      });
      check('「能力・効果」にライフ・ガッツ・ちから・丈夫さ・間合い適性が出る', !!ally && /\d+ \/ \d+/.test(ally.hp) && /\d+ \/ \d+/.test(ally.guts) && /元の値 \d/.test(ally.atk) && /元の値 \d/.test(ally.def) && /間合い適性/.test(ally.apt), ally && `${ally.hp} | ${ally.guts} | ${ally.atk} | ${ally.def} | ${ally.apt}`);
      check('この子の効果に、枠のマーク(EXの残りターンなど)が名前と数つきで出る', !!ally && ally.ownKinds.some((k) => /^mark-/.test(k)), ally && ally.ownKinds.join(','));
      check('数が0のマーク(クッキー×0など)は、この子の効果に出さない', !!ally && !/×0(?!\d)/.test(ally.text), ally && ally.text.slice(0, 200));
      check('味方全員の効果(ライフ回復・ガッツ回復など)が出る', !!ally && ally.team >= 2 && /ライフ回復/.test(ally.text), ally && String(ally.team));
      check('能力・効果の窓は幅390で字がはみ出さない', (await overflowIn('[data-tactics-ex-card]')).length === 0, (await overflowIn('[data-tactics-ex-card]')).join(' / '));
      await shot('detail-ally-tactics');
      // ステータス(Hero Scan)のちからと同じ値か(メロディーにはトリックスタート・運命が無いので、同じになるはず)
      const atkNow = Number(((ally && ally.atk) || '').replace(/,/g, '').match(/ちから (\d+)/)?.[1]);
      await closeExPanel();
      await page.locator('button[aria-label="勇者モンのステータス"]').click();
      await page.waitForTimeout(400);
      const scanAtk = await page.evaluate((i) => Number((document.querySelector(`[data-tactics-status-slot="${i}"] [data-tactics-status-stat="atk"]`)?.childNodes[0]?.textContent || '').replace(/,/g, '')), mSlot);
      check('ちからのいまの値は「ステータス」の値と同じ', Number.isFinite(atkNow) && atkNow === scanAtk, `詳細 ${atkNow} / ステータス ${scanAtk}`);
      await page.evaluate(() => [...document.querySelectorAll('button')].find((x) => x.offsetParent && x.textContent.trim() === '戻る')?.click());
      await page.waitForTimeout(400);
      // ③ カードを選んでいるときは、押すとカードが置かれ、詳細は開かない
      // ③ カードを選んでいる途中の枠のタップ(カードの置き場所の操作)は、WAVE1は勇者モン1体でカードがすぐ置かれ、ブラウザでは作れない。
      //   その分岐の順番(置き先の操作が先・詳細は pendingCard が無いときだけ)は unit-detail-check.js がコードで見る
      // ④ 敵を押す
      const enemyHpBar = (await bodyText()).match(/([\d,]+) \/ ([\d,]+)/);
      await page.locator('[data-enemy-tap-detail]').click({ position: { x: 40, y: 40 }, timeout: 10000 });
      await page.waitForTimeout(400);
      const en = await page.evaluate(() => {
        const p = document.querySelector('[data-battle-unit-detail="enemy"]');
        if (!p) return null;
        return { text: p.innerText.replace(/\s+/g, ' '), hp: (p.querySelector('[data-unit-stat="hp"]')?.innerText || '').replace(/\s+/g, ' '), atk: (p.querySelector('[data-unit-stat="atk"]')?.innerText || '').replace(/\s+/g, ' ') };
      });
      check('敵を押すと、敵の詳細(ライフ・攻撃力・かかっている効果)が開く', !!en && /ライフ/.test(en.hp) && /攻撃力/.test(en.atk) && /元の値/.test(en.atk) && /かかっている効果/.test(en.text), en && en.text.slice(0, 120));
      check('敵のライフは画面上の帯と同じ値', !!en && !!enemyHpBar && en.hp.includes(`${enemyHpBar[1]} / ${enemyHpBar[2]}`), `${en && en.hp} / 帯 ${enemyHpBar && enemyHpBar[0]}`);
      check('敵の詳細は幅390で字がはみ出さない', (await overflowIn('[data-battle-unit-detail="enemy"] > div')).length === 0, (await overflowIn('[data-battle-unit-detail="enemy"] > div')).join(' / '));
      await shot('detail-enemy');
      await page.locator('[data-battle-unit-detail-close]').click();
      await page.waitForTimeout(300);
      check('閉じるとバトルへ戻る', await page.locator('[data-battle-unit-detail]').count() === 0);
      check('詳細を見たあともターンを進められる', await playAttackTurn(true));
    }

    // ---- クラシックのチャレンジ(タクティクス以外) ----
    await boot();
    await closePopups();
    await page.getByRole('button', { name: 'モンヒロバトル' }).dispatchEvent('click', {}, { timeout: 15000 });
    await page.waitForTimeout(600);
    await page.locator('[data-battle-system="systemClassic"]').dispatchEvent('click', {}, { timeout: 15000 });
    await page.waitForTimeout(1500);
    await page.evaluate(() => {
      const cards = [...document.querySelectorAll('[data-battle-mode="challenge"]')];
      const card = cards[Math.floor(cards.length / 2)] || cards[0];
      [...(card ? card.querySelectorAll('button') : [])].find((b) => b.textContent.includes('難易度を選ぶ'))?.click();
    });
    await page.waitForTimeout(1500);
    const clickText = (re) => page.evaluate((src) => { const b = [...document.querySelectorAll('button')].find((x) => new RegExp(src).test((x.innerText || '').replace(/\s+/g, ' ').trim())); if (b) b.click(); return !!b; }, re);
    await clickText('この難易度で挑戦'); await page.waitForTimeout(1500);
    await page.evaluate(() => { [...document.querySelectorAll('article,button')].find((x) => /スエゾー/.test(x.textContent))?.click(); });
    await page.waitForTimeout(900);
    await clickText('勇者モンに選ぶ'); await page.waitForTimeout(900);
    await page.evaluate(() => { [...document.querySelectorAll('button')].find((x) => /近距離|中距離|零距離|遠距離/.test(x.textContent))?.click(); });
    await page.waitForTimeout(1300); await closePopups();
    await clickText('新規習得'); await page.waitForTimeout(900);
    await clickText('^習得する$'); await page.waitForTimeout(3500);
    await page.waitForFunction(() => !!document.querySelector('button[data-slot-index]'), null, { timeout: 25000 }).catch(() => {});
    const qSlot = await heroSlot();
    check('クラシック(チャレンジ)のバトルまで進める', qSlot != null, qSlot == null ? (await bodyText()).slice(0, 300) : '');
    if (qSlot != null) {
      await tapSlot(qSlot);
      const q = await page.evaluate(() => {
        const p = document.querySelector('[data-battle-unit-detail]');
        return p ? { slot: p.getAttribute('data-battle-unit-detail'), text: p.innerText.replace(/\s+/g, ' ') } : null;
      });
      check('クラシックでも、味方の枠を押すと能力と効果の詳細が開く', !!q && /ちから/.test(q.text) && /丈夫さ/.test(q.text) && /かかっている効果/.test(q.text), q && q.text.slice(0, 120));
      check('クラシックの詳細も幅390で字がはみ出さない', (await overflowIn('[data-battle-unit-detail] > div')).length === 0, (await overflowIn('[data-battle-unit-detail] > div')).join(' / '));
      await shot('detail-ally-classic');
      await page.locator('[data-battle-unit-detail-close]').click().catch(() => {});
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

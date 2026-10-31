#!/usr/bin/env node
// MFバトルカード: 技カードの動きの段(85 の cardMotionKindOf・案A。2026-10-31 社長「各カードアクションをもっと一新して」→「案Aで入れて」)を、
// 実際のブラウザで確かめる(2026-10-31 ルールくん)
//
//   node tools/card/card-motion-tier-browser-check.js
//
//   ① 段: ダメージ2以下は今の動きのまま・3〜5(全員に当たる技も)は着弾が二段と属性の締め・6以上はさらにオーラと残像
//   ② 攻撃のカード(特殊・ブリーダーを除く)全部に動きがあり、長さは 1.2秒以内
//   ③ 名前から当てる動き: 火炎砲は炎・冥王剣は闇・ボディプレスはプレス・ドラゴンラッシュは連打・パラボラビームはビーム
//   ④ 段のついた動きを実際に出して、締めの絵・オーラが出る / 軽い技には出ない
//   ⑤ 実行時エラーが無い
//   ⑥ 大技のカットイン: 対戦の場で大技だけに出る・オプションで出さないにできる(既定は出す)
const http = require('http'), path = require('path'), fs = require('fs');
const ROOT = path.resolve(__dirname, '..', '..');
const PORT = 8965;
let failed = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`); if (!ok) failed++; };
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.json': 'application/json', '.mp3': 'audio/mpeg', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.PNG': 'image/png' };
const serve = () => new Promise((r) => { const s = http.createServer((req, res) => {
  const f = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
  if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res); }); s.listen(PORT, () => r(s)); });

(async () => {
  let playwright;
  try { playwright = require('playwright'); } catch { console.log('SKIP: playwright が入っていないので確認できません'); process.exit(0); }
  const server = await serve();
  const errors = [];
  let browser;
  try {
    browser = await playwright.chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    page.on('pageerror', (e) => errors.push(String(e)));
    await page.route(/supabase\.co/, (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
    await page.goto(`http://localhost:${PORT}/monster-hero/index.html`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => typeof cardMotionKindOf === 'function' && typeof SkillFxMotion === 'function' && typeof CardBattleBoard === 'function' && typeof CARD_BATTLE_DATA === 'object', null, { timeout: 90000 });
    const r = await page.evaluate(() => {
      const db = CARD_BATTLE_DATA;
      const spec = (no) => { const k = cardMotionKindOf(db, no, null); return { k, s: skillFxSpecOf(k) }; };
      const tier = Object.fromEntries(['261', '018', '357', '264'].map((no) => { const { k, s } = spec(no); return [no, { k, hit2: !!s.hit2, impact: !!s.impact, uex: !!s.uex }]; }));
      const bad = [];
      Object.values(db.cards).filter((c) => cardIsAttackKind(c.kind) && c.kind !== 'spe' && c.user !== 'breeder').forEach((c) => {
        const { k, s } = spec(c.no);
        if (!k || !s || !(s.ms > 0) || s.ms > 1200) bad.push(`${c.no}:${c.name}:${k}:${s && s.ms}`);
      });
      const base = (no) => String(cardMotionKindOf(db, no, null)).replace(/@[A-Z]$/, '');
      return { tier, bad, names: { fire: base('131'), dark: base('242'), press: base('264'), combo: base('232'), beam: base('147') } };
    });
    const t = r.tier;
    check('① ダメージ2以下(グジラのひっかき)は今の動きのまま', !/@/.test(t['261'].k) && !t['261'].impact && !t['261'].uex, JSON.stringify(t['261']));
    check('① 3〜5(ガリの雷)と全員に当たる技(ブリザード)は、着弾が二段と属性の締め', t['018'].hit2 && t['018'].impact && !t['018'].uex && t['357'].impact, `${JSON.stringify(t['018'])} ${JSON.stringify(t['357'])}`);
    check('① 6以上(グジラのボディプレス)は、さらにオーラと残像', t['264'].hit2 && t['264'].uex, JSON.stringify(t['264']));
    check('② 攻撃のカード全部に動きがあり、長さは 1.2秒以内', r.bad.length === 0, r.bad.slice(0, 5).join(' / '));
    check('③ 名前から当てる動き: 火炎砲=炎・冥王剣=闇・ボディプレス=プレス・ドラゴンラッシュ=連打・パラボラビーム=ビーム',
      r.names.fire === 'cardFire' && r.names.dark === 'cardDark' && r.names.press === 'cardPress' && r.names.combo === 'cardCombo' && r.names.beam === 'cardBeam', JSON.stringify(r.names));
    // ④ 実際に出す
    const shown = async (no) => page.evaluate((no) => {
      document.getElementById('__mv')?.remove();
      const d = document.createElement('div'); d.id = '__mv'; d.style.cssText = 'position:fixed;left:100px;top:400px;width:150px;height:150px;z-index:99999;--atk-dx:0px;--atk-dy:-200px';
      document.body.appendChild(d);
      ReactDOM.createRoot(d).render(React.createElement(SkillFxMotion, { kind: cardMotionKindOf(CARD_BATTLE_DATA, no, null), image: React.createElement('img', { src: '', alt: '' }) }));
      return new Promise((res) => setTimeout(() => res({ impact: !!d.querySelector('[data-impact-form]'), form: (d.querySelector('[data-impact-form]') || { getAttribute: () => null }).getAttribute('data-impact-form'), aura: !!d.querySelector('.uex-aura') }), 300));
    }, no);
    const s261 = await shown('261'), s018 = await shown('018'), s264 = await shown('264');
    check('④ 雷は稲妻の締め・ボディプレスはオーラつき・ひっかきは締め無し', s018.impact && s018.form === 'bolt' && !s018.aura && s264.impact && s264.aura && !s261.impact && !s261.aura, JSON.stringify({ s261, s018, s264 }));
    // ⑥ 大技のカットイン(85 の CardCutIn): 対戦の場で、大技(スエゾーのかみつき・ダメージ6)だけに出る。雷(4)には出ない。オプションで出さないにすると出ない
    const board = (cutin) => page.evaluate(async (cutin) => {
      document.getElementById('__bd')?.remove();
      const db = CARD_BATTLE_DATA;
      const demo = cardMotionDemo(db);
      let st = demo.st;
      const W = { handler: null };
      const host = document.createElement('div'); host.id = '__bd';
      host.style.cssText = 'position:fixed;inset:0;z-index:2147483000;display:flex;flex-direction:column;background:#120d2a';
      document.body.appendChild(host);
      const game = { key: `cut-${cutin}`, st, settings: { cutin }, watch: { top: { name: 'エー' }, bottom: { name: 'ビー' }, attach: (h) => { W.handler = h; return () => {}; } } };
      ReactDOM.createRoot(host).render(React.createElement(CardBattleBoard, { db, game, onFinish: () => {} }));
      for (let i = 0; i < 40 && !W.handler; i++) await new Promise((r) => setTimeout(r, 100));
      await new Promise((r) => setTimeout(r, 800));
      const seen = { bite: false, thunder: false };
      const go = async (step, name) => {
        const act = cardMotionDemoAction(db, st, step);
        st = cardApplyAction(db, st, act);
        W.handler.onState(st, false);
        for (let i = 0; i < 20; i++) { if (host.querySelector('[data-card-cutin]')) { seen[name] = host.querySelector('[data-card-cutin]').textContent; break; } await new Promise((r) => setTimeout(r, 50)); }
        await new Promise((r) => setTimeout(r, 1600));
      };
      await go(demo.steps[0], 'bite');
      await go(demo.steps[1], 'pass1');
      await go(demo.steps[2], 'thunder');
      return seen;
    }, cutin);
    const on = await board('ON');
    // 守りの番に入る技は、守りが決まってから攻撃の動きを流す(#4380)ので、カットインもそのとき(相手が守らないを選んだあと)に出る
    check('⑥ 大技(かみつき・ダメージ6)は、守りが決まって攻撃の動きを流すときに、技の名前と「◯◯の大技!」のカットインが出る', on.bite === false && typeof on.pass1 === 'string' && /かみつき/.test(on.pass1) && /スエゾーの大技!/.test(on.pass1), JSON.stringify(on));
    check('⑥ ダメージ4の技(雷)にはカットインを出さない', on.thunder === false, JSON.stringify(on));
    const off = await board('OFF');
    check('⑥ オプション「大技のカットイン」を出さないにすると、大技でも出ない', off.bite === false && off.pass1 === undefined, JSON.stringify(off));
    check('⑥ オプションの既定は「出す」(前からの人も)', await page.evaluate(() => normalizeCardSettings(null).cutin === 'ON' && normalizeCardSettings({ cutin: 'OFF' }).cutin === 'OFF' && CARD_SETTING_GROUPS.some((g) => g.items.some((it) => it.key === 'cutin'))));
    check('⑤ 実行時エラーが無い', errors.length === 0, errors.slice(0, 3).join(' / '));
  } catch (e) {
    check('検査が最後まで回る', false, String(e && e.message || e).slice(0, 300));
  } finally {
    if (browser) await browser.close();
    server.close();
  }
  if (failed) { console.log(`NG: ${failed} 件`); process.exit(1); }
  console.log('OK: 技カードの動きの段');
})();

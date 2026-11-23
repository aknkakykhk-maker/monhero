// ハイスコアを更新したときの演出を、曲を最後まで遊んで確かめる(2026-10-06。2026-11-23 に結果の数え上げへまとめた・台帳 r1119-143 案A)。
//
//   node tools/mode/rhythm-record-fx-check.js              # 約3分
//   SHOT=/tmp/record-fx node tools/mode/rhythm-record-fx-check.js   # 途中の画面写真も撮る(/tmp/record-fx-1.png …)
//
// 社長「数字が上がる演出でじゃん！」「ハイスコアと比較して超えるかどうか」。
// 前のBESTを1点にしておき、曲の前半だけ適当にタップして、最後まで流す。1つでも当たればスコアは1点を超えて「更新」になる。
// 見るもの:
//   ・結果の画面でスコアが0から数え上がり、止まった形では新しいスコアになる(全画面の重ねは出ない)
//   ・自己ベストの印の付いた棒と「前の自己ベストから +○○」が出て、スコアの札が金色・NEW RECORD の札・伸びた点・前回のBESTが残る
//   ・数え終わると data-rhythm-count-anim が done になる
//   ・数え上げを出さない場面(練習・タイミング合わせ・演出量MINIMAL・軽量モード・動きを減らす)の条件
const path = require('path');
const http = require('http');
const fs = require('fs');

const ROOT = path.resolve(__dirname, '..', '..');
const PORT = 9196;
const MIME = { '.html':'text/html', '.js':'text/javascript', '.json':'application/json', '.css':'text/css',
  '.png':'image/png', '.jpg':'image/jpeg', '.webp':'image/webp', '.svg':'image/svg+xml', '.mp3':'audio/mpeg' };
let failed = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`); if (!ok) failed++; };

const SONG = 'mf_ichika_mix';
const seed = (song) => {
  const put = (k, v) => localStorage.setItem(k, JSON.stringify(v));
  put('mh_breeder_name', 'テスト'); put('mh_breeder_icon', '🐣'); put('mh_intro_done', true); put('mh_onboarded', true);
  put('mh_tutorial_seen_v1', true); put('mh_battle_tutorial_seen_v1', true); put('mh_battle_tutorial_guide_shown_v1', true);
  put('mh_assistant_selected_v1', 'mua'); put('mh_assistant_unlock_seen_v1', true); put('mh_update_notice_seen_v1', true);
  put('mh_rhythm_tutorial_seen_v1', true); put('mh_rhythm_play_defaults_restored_v1', true); put('mh_rhythm_six_lane_seen_v1', true);
  put('mh_inherited_unique_level_compensation_v1', true); put('mh_rhythm_look_intro_seen_v1', true);
  put('mh_rhythm_settings_v1', { autoEffectDown: false, effectAmount: 'NORMAL', lightweightMode: false });
  // 前のBESTは1点(1つでも当たれば更新になる)
  put('mh_rhythm_best_v1', { [song]: { EASY: { bestScore: 1, maxCombo: 1, played: true, clear: true } } });
};

// ── 出す条件(文字列) ──
const play = fs.readFileSync(path.join(ROOT, 'monster-hero/src/parts/30-rhythm-play.jsx'), 'utf8');
const html = fs.readFileSync(path.join(ROOT, 'monster-hero/index.html'), 'utf8');
const rhythm = fs.readFileSync(path.join(ROOT, 'monster-hero/data/rhythm-mode.js'), 'utf8');
const cond = play.match(/const countAnim=([^\n]*)\?\{id:/)?.[1] || '';
check('数え上げの条件を取り出せる', cond.length > 0);
check('練習・タイミング合わせでは数え上げない', cond.includes('!tutorial&&!calibrating'));
check('演出量MINIMAL・軽量モード・動きを減らす設定では数え上げない(止まった形)',
  cond.includes('rhythmResultCountAnimOn(settings)') && /const rhythmResultCountAnimOn=settings=>!!settings&&!settings\.lightweightMode&&settings\.effectAmount!=='MINIMAL'\s*&&!\(typeof window!=='undefined'&&typeof window\.matchMedia==='function'&&window\.matchMedia\('\(prefers-reduced-motion: reduce\)'\)\.matches\);/.test(play));
check('アシストモードは更新にならない(これまでどおり記録に残らない)', /const isNewRecord=!assistOn&&score>run\.startBestScore;/.test(play));
check('全画面の重ね(data-rhythm-record-fx)はもう出さない', !play.includes('data-rhythm-record-fx') && !html.includes('data-rhythm-record-fx'));
check('数え上げの effect は印(id)だけを依存にする(結果へ項目が足されても走り直さない)', /\},\[resultCountId\]\);/.test(play));
check('数字は React を通さず、要素の文字を書き換えて数える(毎フレーム描き直さない)', play.includes("if(item.el.textContent!==text)item.el.textContent=text;"));
check('タップで止まった形へ飛び、新記録の音は待たずに鳴らす', play.includes("root.addEventListener('pointerdown',skipCount,{passive:true});") && play.includes('if(recordSeFireRef.current)recordSeFireRef.current();'));
check('新記録の音は、数え上げが前の自己ベストを越える時刻に鳴らす', play.includes('rhythmResultCrossMs(previousBestScore,score)??RHYTHM_RESULT_COUNT.janAt'));
check('専用の効果音(playNewRecord)があり、既存のタップ音と同じ設定(音量・ON/OFF・全体ミュート)を読む',
  rhythm.includes('const playNewRecord=()=>{') && /const playNewRecord=[\s\S]{0,400}if\(!settings\.enabled\|\|settings\.volume<=0\|\|!rhythmAudioGloballyEnabled\(\)\)return false;/.test(rhythm) && /playFullCombo,playNewRecord,/.test(rhythm));
check('結果とお祝いの動きは transform と opacity だけ(ぼかしの半径・大きさ・位置は動かさない)',
  (() => { const frames = [...html.matchAll(/@keyframes mhRhythm(?:Result(?:In|Row|Jan|JanFlash|Stamp|Ribbon)|Celebrate(?:Line|Pillar|Flash|Spin|Ring|Spark|Title|Up))\{[\s\S]*?\}\s*\}/g)].map((m) => m[0]);
    return frames.length >= 14 && frames.every((f) => { const props = [...f.replace(/^@keyframes \w+\{/, '').matchAll(/([a-z-]+)\s*:/g)].map((m) => m[1]); return props.every((x) => x === 'transform' || x === 'opacity'); }); })());
check('動きを減らす設定では、札の弾みを止める', /prefers-reduced-motion:reduce\)\{\s*\[data-rhythm-new-record\]\{animation:none;opacity:1\}/.test(html));

(async () => {
  let playwright;
  try { playwright = require('playwright'); } catch { console.log('SKIP: playwright が入っていないので実際の画面は確認できません'); console.log(failed ? `\n${failed}件のNGがあります` : '\nすべてOK'); process.exit(failed ? 1 : 0); }
  // この検査のためだけに、配る rhythm-mode.js のライフの減りを0にする(本体のファイルは変えない)。
  // 適当なタップではほとんど外れるので、そのままだとライフが0になって「失敗」になり、失敗では祝わない仕様のため演出が出ない
  const LIFE_DELTA_FROM = 'BAD:-20, MISS:-50';
  const server = http.createServer((req, res) => {
    const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, ''), file = path.join(ROOT, rel);
    if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream' });
    if (rel === 'monster-hero/data/rhythm-mode.js') {
      const text = fs.readFileSync(file, 'utf8');
      patched = text.includes(LIFE_DELTA_FROM);
      res.end(text.replace(LIFE_DELTA_FROM, 'BAD:0, MISS:0'));
      return;
    }
    fs.createReadStream(file).pipe(res);
  });
  let patched = false;
  await new Promise((r) => server.listen(PORT, r));
  const browser = await playwright.chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--autoplay-policy=no-user-gesture-required'] });
  try {
    const page = await browser.newPage({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true });
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    // 通信を差し替えたので、ゲーム側の「自動操作では書き込まない」止めを外す(26-supabase.jsx)
    await page.addInitScript(() => { window.__mhSupabaseStubbed = true; });
    await page.evaluate(() => { window.__mhSupabaseStubbed = true; }).catch(() => {});
    await page.route('**/rest/v1/**', (route) => route.fulfill({ status: 201, contentType: 'application/json', body: '[]' }));
    // 助手のおしゃべりの中継(Edge Function)も本物へ届けない。差し替えが無いと本物の中継が AI を呼ぶ(2026-10-27)
    await page.route('**/functions/v1/**', (route) => route.fulfill({ status: 503, contentType: 'application/json', body: '{}' }));
    await page.addInitScript(seed, SONG);
    const clickText = (p) => page.evaluate((s) => { const rx = new RegExp(s); const x = [...document.querySelectorAll('button')].find((b) => rx.test((b.innerText || '').replace(/\s+/g, ' ').trim())); if (!x) return false; x.click(); return true; }, p);
    await page.goto(`http://localhost:${PORT}/monster-hero/index.html`, { waitUntil: 'load', timeout: 60000 });
    await page.getByRole('button', { name: 'TAP TO START' }).click({ force: true, timeout: 60000 });
    await page.getByRole('button', { name: 'トップ画面へ進む' }).click({ timeout: 30000 });
    await page.waitForFunction(() => !!document.querySelector('main.mh-home-scene'), null, { timeout: 40000 });
    for (let i = 0; i < 6; i++) { if (!(await clickText('受け取る|閉じる|OK|とじる'))) break; await page.waitForTimeout(250); }
    await page.evaluate(() => document.querySelector('[data-home-fac="rhythm"]')?.click());
    // 入るとまずモードえらび(2026-10-03)。ソロライブを押して曲えらびへ
    await page.waitForFunction(() => document.body.innerText.includes('ソロライブ'), null, { timeout: 30000 });
    await clickText('ソロライブ');
    await page.waitForSelector('[data-rhythm-demo-start]', { timeout: 30000 });
    for (let i = 0; i < 5; i++) { if (!(await clickText('^確認$|受け取る|閉じる|OK|とじる'))) break; await page.waitForTimeout(300); }
    await page.evaluate(() => document.querySelector('[data-rhythm-demo-start]').click());
    await page.waitForSelector('[data-rhythm-play-area]', { timeout: 30000 });
    await page.waitForTimeout(6500);
    const geo = await page.evaluate(() => { const a = document.querySelector('[data-rhythm-play-area]').getBoundingClientRect(); const l = document.querySelector('[data-rhythm-judgment-line]'); const r = l ? l.getBoundingClientRect() : null; return { l: a.left, w: a.width, y: r ? r.top + r.height / 2 : a.top + a.height * .8 }; });
    const cdp = await page.context().newCDPSession(page);
    // 曲の前半に、5つの道へ順に素早くタップする(どれかは当たる)
    const lanes = [.12, .31, .5, .69, .88];
    const until = Date.now() + 40000;
    for (let i = 0; Date.now() < until; i++) {
      const x = geo.l + geo.w * lanes[i % lanes.length];
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y: geo.y, id: 1, radiusX: 1, radiusY: 1 }] });
      await page.waitForTimeout(35);
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      await page.waitForTimeout(110);
    }
    // 結果が出るまで待つ(曲を最後まで流す)。フルコンボなどの祝いの画面は出ない(BADもMISSもあるため)
    await page.waitForSelector('[data-rhythm-result]', { timeout: 300000 });
    const shot = async (n) => { if (process.env.SHOT) await page.screenshot({ path: `${process.env.SHOT}-${n}.png` }); };
    const read = () => page.evaluate(() => {
      const q = (s) => document.querySelector(s);
      return {
        fx: !!q('[data-rhythm-record-fx]'), anim: q('[data-rhythm-result]')?.getAttribute('data-rhythm-count-anim') || '',
        score: q('[data-rhythm-result-score]')?.textContent || '', cardNew: q('[data-rhythm-result-score-card]')?.getAttribute('data-new-record'),
        wait: q('[data-rhythm-result-score-card]')?.hasAttribute('data-record-wait'), vs: !!q('[data-rhythm-result-vs-best]'), diff: q('[data-rhythm-best-diff]')?.textContent || '',
        badge: q('[data-rhythm-new-record]')?.innerText || '', chip: q('[data-rhythm-record-gain]')?.innerText || '', cardPrev: q('[data-rhythm-record-prev]')?.innerText || '',
      };
    });
    await page.waitForTimeout(200);
    const early = await read(); await shot(1);
    await page.waitForTimeout(700);
    const mid = await read(); await shot(2);
    await page.waitForTimeout(2200);
    const after = await read(); await shot(3);

    check('検査のために、ライフが減らないよう書き換えて配れている(本体の書き方が変わったらここで気づく)', patched);
    const num = (t) => Number(String(t || '').replace(/[^0-9]/g, ''));
    const scoreNum = num(after.score);
    check('全画面の重ねは出ない', !early.fx && !after.fx);
    check('結果が出た直後は数え上げの途中(印が "1"・数字は最後のスコアより小さい)', early.anim === '1' && num(early.score) < scoreNum, `${early.anim} ${early.score} → ${scoreNum}`);
    check('数字が数え上げられていく(途中の値が、最初と最後のあいだにある)', num(mid.score) >= num(early.score) && num(mid.score) <= scoreNum, `${early.score} → ${mid.score} → ${after.score}`);
    check('数え終わると止まった形になる(印が done)', after.anim === 'done', after.anim);
    check('自己ベストの棒と「前の自己ベストから +○○」が出る', after.vs && after.diff.replace(/[^0-9]/g, '') === String(scoreNum - 1) && /前の自己ベストから/.test(after.diff), after.diff);
    check('越えたあとは、スコアのカードが金色・NEW RECORD の札・伸びた点数・前回のBESTが残る',
      after.cardNew === '1' && !after.wait && /NEW RECORD/.test(after.badge) && after.chip.replace(/[^0-9]/g, '') === String(scoreNum - 1) && /前回のベスト\s*1\s*$/.test(after.cardPrev.replace(/\s+/g, ' ')), JSON.stringify({ c: after.cardNew, w: after.wait, b: after.badge, g: after.chip, p: after.cardPrev }));
    check('実行時エラーが出ていない', errors.length === 0, errors[0] || '');
    await page.close();
  } finally {
    await browser.close();
    server.close();
  }
  console.log(failed ? `\n${failed}件のNGがあります` : '\nすべてOK');
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });

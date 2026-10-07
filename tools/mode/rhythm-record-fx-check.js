// ハイスコアを更新したときの演出(結果画面の上に重ねる)を、曲を最後まで遊んで確かめる(2026-10-06)。
//
//   node tools/mode/rhythm-record-fx-check.js              # 約3分
//   SHOT=/tmp/record-fx node tools/mode/rhythm-record-fx-check.js   # 演出の途中の画面写真も撮る(/tmp/record-fx-1.png …)
//
// ユーザー指示「ハイスコア更新したときはもっとちゃんと演出がほしい」。
// 前のBESTを1点にしておき、曲の前半だけ適当にタップして、最後まで流す。1つでも当たればスコアは1点を超えて「更新」になる。
// 見るもの:
//   ・結果が出たとき、画面に重なる演出が出る(題名・数字のカウントアップ・伸びた点数・前回のBEST)
//   ・数字は最後に新しいスコアで止まる。演出はタップを下の画面へ通し、約3秒で外れる
//   ・演出が引いたあとも、スコアのカードに金色の札・伸びた点数・前回のBESTが残る
//   ・結果へ項目があとから足されても(効果音とタイマーが走り直さないよう)演出の印は変わらない
//   ・出さない場面(初めての記録・失敗・練習・タイミング合わせ・演出量MINIMAL・軽量モード)の条件
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
const cond = play.match(/const recordFx=([^\n]*)\n\s*\?\{id:/)?.[1] || '';
check('演出を出す条件を取り出せる', cond.length > 0);
check('更新したとき(前のBESTがあって、それを超えた)だけ出す', cond.includes('isNewRecord&&previousBestScore>0'));
check('失敗(ライフ0のまま完走)では出さない', cond.includes('!failed'));
check('練習・タイミング合わせでは出さない', cond.includes('!tutorial&&!calibrating'));
check('演出量MINIMAL・軽量モードでは出さない(重くしない)', cond.includes('!settings.lightweightMode&&settings.effectAmount!==\'MINIMAL\''));
check('アシストモードは更新にならない(これまでどおり記録に残らない)', /const isNewRecord=!assistOn&&score>run\.startBestScore;/.test(play));
check('効果音・タイマーは、演出の印(id)だけを依存にする(結果へ項目が足されても走り直さない)', /\},\[recordFxId\]\);/.test(play));
check('数字は React を通さず、ref の文字を書き換えて数え上げる(毎フレーム描き直さない)', play.includes('recordScoreRef') && play.includes('el.textContent=Math.round(value).toLocaleString()'));
check('動きを減らす設定では、数え上げず最後の数字をそのまま出す', play.includes("window.matchMedia('(prefers-reduced-motion: reduce)').matches"));
check('演出はタップを通す(下のボタンを待たずに押せる)', /data-rhythm-record-fx aria-hidden="true" className="pointer-events-none/.test(play));
check('専用の効果音(playNewRecord)があり、既存のタップ音と同じ設定(音量・ON/OFF・全体ミュート)を読む',
  rhythm.includes('const playNewRecord=()=>{') && /const playNewRecord=[\s\S]{0,400}if\(!settings\.enabled\|\|settings\.volume<=0\|\|!rhythmAudioGloballyEnabled\(\)\)return false;/.test(rhythm) && /playFullCombo,playNewRecord,/.test(rhythm));
check('光・火花・題名は transform と opacity だけを動かす(ぼかしの半径・サイズ・位置は動かさない)',
  (() => { const body = html.slice(html.indexOf('[data-rhythm-record-fx]{animation'), html.indexOf('@keyframes mhRhythmJudgmentRowRainbow')); const frames = [...body.matchAll(/@keyframes mhRhythmRecord\w+\{[\s\S]*?\}\s*\}/g)].map((m) => m[0]); return frames.length >= 5 && frames.every((f) => !/blur\(|width|height|top:|left:|margin/.test(f)); })());
check('動きを減らす設定では、光の筋・火花を出さず、弾みも止める', /prefers-reduced-motion:reduce\)\{\s*\[data-rhythm-record-fx\]\{animation:none\}\s*\[data-rhythm-record-fx-rays\],\[data-rhythm-record-fx-spark\]\{display:none\}/.test(html));
check('演出量MINIMAL・軽量モードでは、念のためCSSでも隠す', /\[data-rhythm-effect="MINIMAL"\] \[data-rhythm-record-fx\],\s*\n\s*\[data-rhythm-result\]\[data-rhythm-lightweight="true"\] \[data-rhythm-record-fx\]\{display:none\}/.test(html));

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
    await page.addInitScript(seed, SONG);
    const clickText = (p) => page.evaluate((s) => { const rx = new RegExp(s); const x = [...document.querySelectorAll('button')].find((b) => rx.test((b.innerText || '').replace(/\s+/g, ' ').trim())); if (!x) return false; x.click(); return true; }, p);
    await page.goto(`http://localhost:${PORT}/monster-hero/index.html`, { waitUntil: 'load', timeout: 60000 });
    await page.getByRole('button', { name: 'TAP TO START' }).click({ force: true, timeout: 60000 });
    await page.getByRole('button', { name: 'トップ画面へ進む' }).click({ timeout: 30000 });
    await page.waitForFunction(() => document.body.innerText.includes('モンヒロビート'), null, { timeout: 40000 });
    for (let i = 0; i < 6; i++) { if (!(await clickText('受け取る|閉じる|OK|とじる'))) break; await page.waitForTimeout(250); }
    await clickText('モンヒロビート');
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
      const fx = q('[data-rhythm-record-fx]');
      return {
        fx: !!fx, pointer: fx ? getComputedStyle(fx).pointerEvents : null,
        title: q('[data-rhythm-record-fx-title]')?.innerText || '', count: q('[data-rhythm-record-fx-score]')?.textContent || '',
        gain: q('[data-rhythm-record-fx-gain]')?.innerText || '', prev: q('[data-rhythm-record-fx-prev]')?.innerText || '',
        sparks: document.querySelectorAll('[data-rhythm-record-fx-spark]').length,
        score: q('[data-rhythm-result-score]')?.innerText || '', cardNew: q('[data-rhythm-result-score-card]')?.getAttribute('data-new-record'),
        badge: q('[data-rhythm-new-record]')?.innerText || '', chip: q('[data-rhythm-record-gain]')?.innerText || '', cardPrev: q('[data-rhythm-record-prev]')?.innerText || '',
      };
    });
    await page.waitForTimeout(250);
    const early = await read(); await shot(1);
    await page.waitForTimeout(700);
    const mid = await read(); await shot(2);
    await page.waitForTimeout(1500);
    const late = await read(); await shot(3);
    await page.waitForTimeout(1500);
    const after = await read(); await shot(4);

    check('検査のために、ライフが減らないよう書き換えて配れている(本体の書き方が変わったらここで気づく)', patched);
    const scoreNum = Number((after.score || '').replace(/[^0-9]/g, ''));
    check('更新したので、結果の上に演出が重なって出る(題名・火花)', early.fx && /NEW RECORD!/.test(early.title) && early.sparks >= 12, JSON.stringify({ fx: early.fx, title: early.title, sparks: early.sparks }));
    check('演出はタップを下の画面へ通す', early.pointer === 'none', String(early.pointer));
    check('数字は前のBEST(1)から数え始める', /^[0-9,]+$/.test(early.count) && Number(early.count.replace(/,/g, '')) < scoreNum, `${early.count} → ${scoreNum}`);
    check('数字が数え上げられていく(途中の値が、最初と最後のあいだにある)', (() => { const v = Number(mid.count.replace(/,/g, '')); return v >= Number(early.count.replace(/,/g, '')) && v <= scoreNum; })(), `${early.count} → ${mid.count} → ${late.count}`);
    check('数字は最後に新しいスコアで止まる', late.fx && Number(late.count.replace(/,/g, '')) === scoreNum, `${late.count} / ${scoreNum}`);
    check('伸びた点数(+新スコア−1)と前回のBEST(1)を出す', late.gain.replace(/[^0-9]/g, '') === String(scoreNum - 1) && /前回のベスト\s*1\s*$/.test(late.prev.replace(/\s+/g, ' ')), `${late.gain} / ${late.prev}`);
    check('約3秒で演出が外れる', after.fx === false);
    check('演出が引いたあとも、スコアのカードに金色の札・伸びた点数・前回のBESTが残る',
      after.cardNew === '1' && /NEW RECORD/.test(after.badge) && after.chip.replace(/[^0-9]/g, '') === String(scoreNum - 1) && /前回のベスト\s*1\s*$/.test(after.cardPrev.replace(/\s+/g, ' ')), JSON.stringify({ c: after.cardNew, b: after.badge, g: after.chip, p: after.cardPrev }));
    check('結果のスコアの数字は、演出中も最初から新しいスコアで出ている(演出に左右されない)', Number((early.score || '').replace(/[^0-9]/g, '')) === scoreNum);
    check('実行時エラーが出ていない', errors.length === 0, errors[0] || '');
    await page.close();
  } finally {
    await browser.close();
    server.close();
  }
  console.log(failed ? `\n${failed}件のNGがあります` : '\nすべてOK');
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });

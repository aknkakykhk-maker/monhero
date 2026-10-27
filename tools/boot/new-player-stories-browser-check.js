// はじめての人を、印(保存)を何も入れずに最初から通し、HOME に着いたあとに流れるお話を確かめる(2026-10-27)。
//
//   node tools/boot/new-player-stories-browser-check.js
//
// 社長の決定「開催中のイベントだけ出す」: はじめての人には、開催中のイベントのお話だけを出す。
// 昔のお知らせのお話(きゅうこ登場・ことのはの鈴・タイプ・MFバトルカードのはじまり)は流さず、見た扱いにして
// プロフィールのイベント回想からいつでも見られるようにする。カゲあつが印を入れずに遊んで、6本続けて流れるのを見つけた。
//
// 見ること:
//   ・助手えらび → あいさつ → 名前とアイコン → 村の案内、を自動で進めて mh_onboarded が立つ
//   ・そのあと HOME で流れたお話に、昔のお知らせのお話が1本も無い
//   ・ログインボーナスの窓とお話の窓が同時に出ていない(先に一方を閉じてから次)
//   ・続けて流すのは1本まで(2026-10-27 社長)。HOME を離れて戻ると、次の1本が流れる
//   ・はじめての印(mh_story_one_at_a_time_v1)は、はじめての人にだけ付く(前から遊んでいる人には付かない)
//   ・昔のお知らせのお話は「見た」の印が付いている(回想に並ぶ・二重に流れない)
//   ・例外が出ない
const http = require('http');
const path = require('path');
const fs = require('fs');
const root = path.resolve(__dirname, '..', '..');
const PORT = 9197;
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.mp3': 'audio/mpeg', '.m4a': 'audio/mp4', '.woff2': 'font/woff2' };
let failed = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`); if (!ok) failed++; };

const ids = fs.readFileSync(path.join(root, 'monster-hero/src/parts/17-release-changelog-login-missions.jsx'), 'utf8');
const constOf = (name) => (ids.match(new RegExp(`const ${name} = '([^']+)'`)) || [])[1];
const PAST = {
  kyuko: constOf('KYUKO_JOIN_STORY_ID'),
  chat: constOf('ASSISTANT_CHAT_STORY_ID'),
  types: constOf('TACTICS_TYPES_STORY_ID'),
  card: constOf('CARD_BATTLE_INTRO_STORY_ID'),
};
const SEEN_KEYS = [constOf('ASSISTANT_CHAT_STORY_SEEN_KEY'), constOf('TACTICS_TYPES_STORY_SEEN_KEY'), constOf('CARD_BATTLE_INTRO_STORY_SEEN_KEY')];
check('昔のお知らせのお話の id と印のキーを読めた', Object.values(PAST).every(Boolean) && SEEN_KEYS.every(Boolean), JSON.stringify(PAST));

// はじめての案内を進めるボタン(遊び役 tools/playbot/scenarios/new-player.js と同じ考え方)
const FORWARD = /^(TAP TO START|トップ画面へ進む|次へ|つぎへ|はじめる|始める|決定！?|この名前で(始める|決定)?|これにする|この子にする|OK|受け取る|スキップ)$/;
const SETUP = [/^名前を決める$/, /^アイコンを選ぶ$/];

(async () => {
  let playwright;
  try { playwright = require('playwright'); } catch { console.log('SKIP: playwright が入っていないので確認できません'); process.exit(failed ? 1 : 0); }
  const server = http.createServer((req, res) => {
    const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, ''), file = path.join(root, rel);
    if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream' }); fs.createReadStream(file).pipe(res);
  });
  await new Promise((r) => server.listen(PORT, r));
  const browser = await playwright.chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const errors = [];
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    page.on('pageerror', (e) => errors.push(String(e)));
    // 通信は空で返す(ランキングなどへ書かない)。保存の印は何も入れない
    await page.addInitScript(() => { window.__mhSupabaseStubbed = true; });
    await page.route(/supabase|functions\/v1/, (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
    await page.goto(`http://localhost:${PORT}/monster-hero/index.html`, { waitUntil: 'domcontentloaded' });

    const done = new Set();
    let onboarded = false;
    for (let i = 0; i < 160 && !onboarded; i++) {
      onboarded = await page.evaluate(() => { try { return JSON.parse(localStorage.getItem('mh_onboarded') || 'false') === true; } catch { return false; } });
      if (onboarded) break;
      // 空の名前の欄があれば打つ
      const input = page.locator('input[type="text"]:visible').first();
      if (await input.count() && !(await input.inputValue().catch(() => 'x'))) await input.fill('けんさ').catch(() => {});
      // 名前は見えている字、無ければ aria-label(タイトルの「トップ画面へ進む」は字が無い)
      const labels = await page.evaluate(() => [...document.querySelectorAll('button')].filter((b) => b.offsetParent && !b.disabled).map((b) => ((b.innerText || '').trim().split('\n')[0] || b.getAttribute('aria-label') || '').trim()));
      // 名前の窓は「保存」で閉じる。アイコンの一覧が出ていれば、1つ選ぶ(モッチー)
      const save = labels.includes('保存') ? '保存' : null;
      const icon = !save && done.has('アイコンを選ぶ') && !done.has('icon') && labels.includes('モッチー') ? 'モッチー' : null;
      if (icon) done.add('icon');
      const setup = !save && !icon && SETUP.map((re) => labels.find((l) => re.test(l) && !done.has(l))).find(Boolean);
      const pick = save || icon || setup || labels.find((l) => FORWARD.test(l)) || labels.find((l) => l && !/閉じる|戻る|やめる|×|^お知らせ$|^設定$|更新情報|不具合情報/.test(l));
      if (!pick) { await page.waitForTimeout(500); continue; }
      if (setup) done.add(setup);
      // 本物のクリックで押す(TAP TO START などは JS の click では反応しない)。押せなければ JS の click で押す
      const ok = await page.getByRole('button', { name: pick }).first().click({ timeout: 3000 }).then(() => true).catch(() => false);
      if (!ok) await page.evaluate((label) => { const b = [...document.querySelectorAll('button')].find((x) => x.offsetParent && !x.disabled && (((x.innerText || '').trim().split('\n')[0] || x.getAttribute('aria-label') || '').trim()) === label); b && b.click(); }, pick);
      await page.waitForTimeout(350);
    }
    check('はじめての案内を抜けて mh_onboarded が立つ', onboarded);

    // HOME に着いたあと、出てくる窓を順に閉じながら、流れたお話を記録する
    let overlap = 0;
    // お話は1分おきの見回りでも並ぶので、何も出なくなってからも少し(最大 limit 回 × 0.5秒)見続ける
    const watch = async (limit, quietMax) => {
    const played = [];
    let quiet = 0;
    for (let i = 0; i < limit; i++) {
      const state = await page.evaluate(() => ({
        story: document.querySelector('[data-event-story]')?.getAttribute('data-event-story')
          || (document.querySelector('[aria-label^="イベント回想: "]')?.getAttribute('aria-label') || '').replace(/^イベント回想: /, '') || null,
        bonus: !!document.querySelector('[aria-label="ログインボーナス"]'),
      }));
      if (state.story && state.bonus) overlap += 1;
      if (state.story && played[played.length - 1] !== state.story) played.push(state.story);
      const closer = await page.evaluate(() => {
        const b = [...document.querySelectorAll('button')].find((x) => x.offsetParent && /^(スキップ|受け取る|閉じる|あとで読む|あとで|あとでやる|今はいい|いまはいい|今は見ない|わかった！?|OK|見ない|次へ)$/.test((x.innerText || '').trim()));
        if (b) { b.click(); return true; } return false;
      });
      if (process.env.TRACE && (state.story || state.bonus || closer)) console.log('HOME', i, JSON.stringify(state), closer);
      quiet = (!closer && !state.story && !state.bonus) ? quiet + 1 : 0;
      if (quiet > quietMax) break;
      await page.waitForTimeout(500);
    }
    return played;
    };
    const played = await watch(180, 150);
    const firstStay = played.slice();
    // HOME を離れて(プロフィールへ行って)戻ると、待っていた次の1本が流れる
    const goHome = async () => {
      for (let i = 0; i < 6; i++) {
        if (await page.evaluate(() => !!document.querySelector('.mh-home-player'))) return true;
        await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find((x) => x.offsetParent && (/戻る/.test(x.getAttribute('aria-label') || '') || /^(←|戻る)/.test((x.innerText || '').trim()))); b && b.click(); });
        await page.waitForTimeout(600);
      }
      return false;
    };
    await page.evaluate(() => document.querySelector('.mh-home-player')?.click());
    await page.waitForTimeout(1200);
    const back = await goHome();
    const secondStay = back ? await watch(60, 20) : [];
    played.push(...secondStay.filter((id) => !played.includes(id)));
    check('はじめての人の最初の HOME では、お話は1本だけ流れる', firstStay.length === 1, `流れたお話: ${firstStay.join(' → ') || 'なし'}`);
    check('HOME を離れて戻ると、次のお話が1本流れる', back && secondStay.length === 1 && !firstStay.includes(secondStay[0]), `戻れた=${back} 流れたお話: ${secondStay.join(' → ') || 'なし'}`);
    check('はじめての人には印(mh_story_one_at_a_time_v1)が付く', await page.evaluate(() => { try { return JSON.parse(localStorage.getItem('mh_story_one_at_a_time_v1')) === true; } catch { return false; } }));
    // 目印の無い古い作り(直す前)と比べるときのために、題でも見分ける
    const PAST_TITLE = /きゅうこ登場|ことのはの鈴|4人のタイプ|物置の古い箱/;
    const pastPlayed = played.filter((id) => Object.values(PAST).includes(id) || PAST_TITLE.test(id));
    const live = played.filter((id) => /^halloween|^raid_jack|ハロウィン・ナイト/.test(id));
    check('開催中のイベント(ハロウィン・ナイト)のお話は流れる', live.length > 0, `流れたお話: ${played.join(' → ') || 'なし'}`);
    check('HOME のあとに流れたお話に、昔のお知らせのお話が無い', pastPlayed.length === 0, `流れたお話: ${played.join(' → ') || 'なし'}`);
    check('ログインボーナスの窓とお話の窓が同時に出ていない', overlap === 0, overlap ? `${overlap}回重なった` : '');
    const marks = await page.evaluate(({ kyuko, keys }) => {
      const read = (k) => { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } };
      const list = read('mh_rhythm_event_story_v1');
      return { kyuko: Array.isArray(list) && list.includes(kyuko), keys: keys.map((k) => read(k) === true) };
    }, { kyuko: PAST.kyuko, keys: SEEN_KEYS });
    check('昔のお知らせのお話は「見た」の印が付いている(回想に並ぶ・二重に流れない)', marks.kyuko && marks.keys.every(Boolean), JSON.stringify(marks));
    // 流さなかったお話が、プロフィールのイベント回想からいつでも見られる
    await page.evaluate(() => document.querySelector('.mh-home-player')?.click());
    await page.waitForTimeout(1500);
    await page.evaluate(() => [...document.querySelectorAll('button')].find((b) => /イベント回想/.test(b.textContent || ''))?.click());
    await page.waitForTimeout(1000);
    const groups = await page.evaluate(() => [...document.querySelectorAll('[data-event-replay-group]')].map((b) => b.getAttribute('data-event-replay-group')));
    let titles = '';
    for (const g of groups) {
      await page.evaluate((id) => document.querySelector(`[data-event-replay-group="${id}"]`)?.click(), g);
      await page.waitForTimeout(400);
      titles += ' ' + await page.evaluate(() => document.querySelector('[data-event-replay-episodes]')?.innerText || '');
      await page.evaluate(() => document.querySelector('[data-event-replay-back]')?.click());
      await page.waitForTimeout(300);
    }
    const missing = ['きゅうこ登場', 'ことのはの鈴', '4人のタイプ', '物置の古い箱'].filter((t) => !titles.includes(t));
    check('流さなかったお話は、プロフィールのイベント回想に並ぶ', groups.length > 0 && missing.length === 0, missing.length ? `回想に無い: ${missing.join('・')}` : `${groups.length}のまとまり`);
    // 前から遊んでいる人(名前とアイコンがあり、案内を済ませている)には、印を付けない(流し方は今までどおり)
    const old = await browser.newPage({ viewport: { width: 390, height: 844 } });
    old.on('pageerror', (e) => errors.push(String(e)));
    await old.addInitScript(() => { window.__mhSupabaseStubbed = true; const put = (k, v) => localStorage.setItem(k, JSON.stringify(v)); put('mh_breeder_name', 'けんさ'); put('mh_breeder_icon', 'Mocchi'); put('mh_onboarded', true); });
    await old.route(/supabase|functions\/v1/, (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
    await old.goto(`http://localhost:${PORT}/monster-hero/index.html`, { waitUntil: 'domcontentloaded' });
    await old.waitForFunction(() => typeof window.__mhBootPhase !== 'undefined' || document.querySelector('[data-mh-screen], .mh-title-modal, button'), null, { timeout: 30000 }).catch(() => {});
    await old.waitForTimeout(6000);
    const { oldMark, keys } = await old.evaluate(() => ({ oldMark: localStorage.getItem('mh_story_one_at_a_time_v1'), keys: Object.keys(localStorage).filter((k) => k.startsWith('mh_')).length }));
    // 起動の読み込みが進んで保存が増えている(印が無いのは、まだ読み込みの途中だから、ではない)
    check('前から遊んでいる人には印が付かない(続けて流す今までの流し方のまま)', keys > 10 && (oldMark === null || JSON.parse(oldMark) !== true), `印=${oldMark}・保存 ${keys}件`);
    await old.close();
    check('例外が出ない', errors.length === 0, errors.slice(0, 3).join(' / '));
  } catch (e) {
    check('検査の実行', false, String(e).split('\n')[0]);
  } finally {
    await browser.close();
    server.close();
  }
  console.log(failed ? `\n${failed}件 NG` : '\nすべてOK');
  process.exit(failed ? 1 : 0);
})();

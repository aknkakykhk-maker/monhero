// はじめて遊ぶ人の「最初の30分」を、セーブ無しのブラウザでたどって書き出す(2026-11-11・社長「Fableで良くなりそうなのどんどん進めて」)。
//
//   node tools/boot/first-30min-walk.js                 縦と横の両方
//   node tools/boot/first-30min-walk.js --portrait      縦だけ(--landscape で横だけ)
//   node tools/boot/first-30min-walk.js --out <dir>     止め絵と report.json の置き場(既定は OS の一時フォルダ)
//   node tools/boot/first-30min-walk.js --detail        場面ごとの表も出す(既定は気づきの上位と最後の1行だけ)
//
// たどる道筋: 起動 → タイトル → 助手えらび → 名前とアイコン → 村の案内 → れんしゅう(バトルの画面に入るまで)
//             → HOME(勝手に開く窓を順に閉じる) → ギフト・ミッション・マーケット・モンヒロビート・助手ライフ・
//             MFバトルカード・M/B管理・神殿・モンヒロバトル(入口だけ)
//
// 書き出すこと(場面ごと): かかった手数・読む字数・押せるボタンの数・重なっている窓・止め絵。
// 気づきにするもの:
//   [隠れ]   案内が「ここを押して」と光らせている所が、別の窓の下にあって押せない
//   [重なり] 窓が2枚以上同時に出ている
//   [長い]   「次へ」で読むだけの説明が長い(10手以上)
//   [割込]   HOME に着いたとき、頼んでいない窓が続けて開く(3枚以上)
//   [多い]   1画面に押せるボタンが多い(20個以上)
//   [ことば] はじめての人に合わない言い回し(「新しく追加」など、前から遊んでいる人向けの文)
//   [待ち]   押してから次の画面が出るまでが長い(3秒以上)
//   [鍵]     鍵のかかった所に、開け方が書かれていない
//   [行止]   機械が先へ進めなかった所
//
// 保存データ・ランキングには触れない: 保存先は毎回まっさら(新しいブラウザ)、Supabase への通信は全部ふさいで空を返す。
// 最後の1行は OK / NG。NG は「初めての人が進めなくなる気づき([隠れ]・[行止]・画面の例外)」が1つでもあるとき。
// ★調べものの道具。run-checks には入れない(気づきは直すまで NG のままなので、公開を止める検査にはしない)。
const http = require('http');
const path = require('path');
const fs = require('fs');
const os = require('os');

const root = path.resolve(__dirname, '..', '..');
const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const opt = (name) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : null; };
const OUT = path.resolve(opt('--out') || path.join(os.tmpdir(), 'mh-first-30min'));
const DETAIL = flag('--detail');
const ORIENTS = flag('--portrait') ? ['portrait'] : flag('--landscape') ? ['landscape'] : ['portrait', 'landscape'];
const VIEW = { portrait: { width: 390, height: 844 }, landscape: { width: 844, height: 390 } };
// --size=667x375 のように、画面の大きさを決める(小さい横画面で札が重ならないかを見る。向きの指定と一緒に使う)
{ const m = process.argv.map(x => /^--size=(\d+)x(\d+)$/.exec(x)).find(Boolean); if (m) { const v = { width: +m[1], height: +m[2] }; for (const k of ORIENTS) VIEW[k] = v; } }
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.mp3': 'audio/mpeg', '.m4a': 'audio/mp4', '.woff2': 'font/woff2' };

// 読む速さの目安(1秒に10字)と、1手にかかる目安(1.5秒)。機械は速すぎるので、人の時間はこの目安で出す
const CHARS_PER_SEC = 10;
const SEC_PER_TAP = 1.5;
const LONG_TALK = 10;
const MANY_BUTTONS = 20;
const SLOW_MS = 3000;
// はじめての人に合わない言い回し(前から遊んでいる人向けの文)
const STALE_WORDS = /新しく追加|追加されたよ|新しい.{1,8}ができたよ|アップデート|リニューアル|変わりました|新しくなりました/;
// 自分で開く窓(重なりに数えない)
const OWN_SHEETS = /^(アイコンを選ぶ|ブリーダー名を変更)$/;
// 勝手に開いた窓を閉じるボタン
const CLOSERS = /^(スキップ|閉じる|とじる|あとで読む|あとで|あとでやる|今はいい|いまはいい|今は見ない|わかった！?|OK|見ない)$/;

const startServer = () => new Promise((resolve) => {
  const server = http.createServer((req, res) => {
    const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '');
    const file = path.join(root, rel);
    if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  });
  server.listen(0, () => resolve(server));
});

// ページの中で動かす: いま見えている窓・押せるボタン・字
const readState = () => {
  const label = (b) => ((b.innerText || '').trim().split('\n')[0] || b.getAttribute('aria-label') || '').trim();
  const onTop = (el) => {
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height) return false;
    const x = Math.min(Math.max(r.left + r.width / 2, 1), window.innerWidth - 1);
    const y = Math.min(Math.max(r.top + r.height / 2, 1), window.innerHeight - 1);
    const e = document.elementFromPoint(x, y);
    return !!e && (el.contains(e) || e.contains(el));
  };
  const buttons = [...document.querySelectorAll('button,[role="button"]')].filter((b) => b.offsetParent && !b.disabled);
  const dialogs = [...document.querySelectorAll('[role="dialog"]')].filter((d) => d.getBoundingClientRect().height > 0);
  const scope = dialogs.length ? dialogs[dialogs.length - 1] : document.body;
  const text = (scope.innerText || '').replace(/\s+/g, ' ').trim();
  const counter = text.match(/(\d+) ?\/ ?(\d+)/);
  const spots = [...document.querySelectorAll('.is-battle-tutorial-spot')].filter((s) => s.getBoundingClientRect().height > 0);
  const spotButtons = [];
  for (const s of spots) {
    if (s.matches('button,[role="button"]')) spotButtons.push(s);
    spotButtons.push(...s.querySelectorAll('button,[role="button"]'));
  }
  const reachSpot = spotButtons.filter((b) => b.offsetParent && !b.disabled && onTop(b));
  const first = reachSpot[0] && reachSpot[0].getBoundingClientRect();
  const locks = buttons.filter((b) => /🔒|ロック中|未解放/.test(b.innerText || '') && !/Lv|クリア|で開く|で解放|まで/.test(b.innerText || '')).map(label);
  return {
    dialogs: dialogs.map((d) => d.getAttribute('aria-label') || '(名前なし)'),
    reach: buttons.filter(onTop).map(label),
    all: buttons.length,
    text,
    scrollX: document.documentElement.scrollWidth > window.innerWidth + 2,
    counter: counter ? { at: Number(counter[1]), of: Number(counter[2]) } : null,
    spot: { marked: spots.length, reachable: reachSpot.length, x: first ? first.left + first.width / 2 : null, y: first ? first.top + first.height / 2 : null, label: reachSpot[0] ? label(reachSpot[0]) : '' },
    locks,
    home: !!document.querySelector('.mh-home-player'),
    onboarded: (() => { try { return JSON.parse(localStorage.getItem('mh_onboarded') || 'false') === true; } catch { return false; } })(),
  };
};

async function walk(browser, base, orient) {
  const dir = path.join(OUT, orient);
  fs.mkdirSync(dir, { recursive: true });
  const page = await browser.newPage({ viewport: VIEW[orient], deviceScaleFactor: 1 });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e).slice(0, 160)));
  // 通信は空で返す(ランキングなどへ書かない)。保存の印は何も入れない
  await page.addInitScript(() => { window.__mhSupabaseStubbed = true; });
  await page.route(/supabase|functions\/v1/, (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));

  const scenes = [];
  const findings = [];
  let taps = 0, readChars = 0, shotNo = 0;
  const t0 = Date.now();
  const sec = () => Number(((Date.now() - t0) / 1000).toFixed(1));
  const humanSec = () => Math.round(readChars / CHARS_PER_SEC + taps * SEC_PER_TAP);
  const note = (kind, where, what, shot) => {
    if (findings.some((f) => f.kind === kind && f.where === where && f.what === what)) return;
    findings.push({ kind, where, what, shot: shot || (scenes[scenes.length - 1] || {}).shot || '' });
  };
  const state = () => page.evaluate(readState);
  const wait = (ms) => page.waitForTimeout(ms);
  const shot = async (name) => {
    const file = `${String(++shotNo).padStart(2, '0')}-${name}.png`;
    await page.screenshot({ path: path.join(dir, file) }).catch(() => {});
    return `${orient}/${file}`;
  };
  // 場面を1つ書き留める
  const scene = async (name, extra = {}) => {
    const s = await state();
    const rec = { name, botSec: sec(), humanSec: humanSec(), taps, buttons: s.reach.length, chars: s.text.length, dialogs: s.dialogs, shot: await shot(name), ...extra };
    scenes.push(rec);
    // 自分で開いた窓(名前・アイコンの入力)が案内の上に出るのは数えない
    if (s.dialogs.length >= 2 && !s.dialogs.some((d) => OWN_SHEETS.test(d))) note('重なり', name, `窓が${s.dialogs.length}枚同時に出ている(${s.dialogs.join(' ＋ ')})`);
    if (s.reach.length >= MANY_BUTTONS && !s.dialogs.length) note('多い', name, `押せるボタンが${s.reach.length}個ある`);
    if (s.scrollX) note('多い', name, '画面が横にはみ出している');
    if (s.locks.length) note('鍵', name, `開け方の書かれていない鍵: ${s.locks.slice(0, 4).join('・')}`);
    return s;
  };
  // 見えている字で押す(本物のクリック。届かなければ JS の click)
  const tap = async (re, { count = true } = {}) => {
    const hit = await page.evaluate((src) => {
      const re2 = new RegExp(src);
      const label = (b) => ((b.innerText || '').trim().split('\n')[0] || b.getAttribute('aria-label') || '').trim();
      const b = [...document.querySelectorAll('button,[role="button"]')].find((x) => x.offsetParent && !x.disabled && re2.test(label(x)));
      if (!b) return null;
      const r = b.getBoundingClientRect();
      const x = r.left + r.width / 2, y = r.top + r.height / 2;
      const e = document.elementFromPoint(x, y);
      const top = !!e && (b.contains(e) || e.contains(b));
      if (!top) b.click();
      return { x, y, top, label: label(b) };
    }, re.source);
    if (!hit) return null;
    if (hit.top) await page.mouse.click(hit.x, hit.y);
    if (count) taps += 1;
    await wait(420);
    return hit.label;
  };
  // 押してから画面が変わるまでを測る
  const until = async (test, maxMs, where) => {
    const from = Date.now();
    while (Date.now() - from < maxMs) {
      if (await page.evaluate(test).catch(() => false)) {
        const ms = Date.now() - from;
        if (ms >= SLOW_MS && where) note('待ち', where, `次の画面まで ${(ms / 1000).toFixed(1)}秒`);
        return ms;
      }
      await wait(150);
    }
    if (where) note('行止', where, `${Math.round(maxMs / 1000)}秒待っても先へ進まない`);
    return -1;
  };
  // 「次へ」で読むだけの説明を進める。読んだ字数と手数を数える
  const talk = async (where, max = 120) => {
    let n = 0, total = null;
    for (; n < max; n++) {
      const s = await state();
      if (!s.reach.some((l) => /^(次へ|つぎへ)$/.test(l))) break;
      if (s.counter && total == null) total = s.counter.of;
      readChars += s.text.length;
      if (STALE_WORDS.test(s.text)) note('ことば', where, `はじめての人に合わない言い回し: 「${(s.text.match(/[^。！♪ ]*(?:新しく追加|追加されたよ|新しい.{1,8}ができたよ|アップデート|リニューアル|変わりました|新しくなりました)[^。！♪ ]*/) || [''])[0].slice(0, 40)}」`);
      await tap(/^(次へ|つぎへ)$/);
      await wait(120);
    }
    return { taps: n, total };
  };

  // ---- 1. 起動 ----
  await page.goto(`${base}/monster-hero/index.html`, { waitUntil: 'domcontentloaded' });
  const bootMs = await until(() => [...document.querySelectorAll('button')].some((b) => /TAP TO START/.test(b.innerText || '')), 30000, '起動');
  await scene('起動', { bootSec: Number((bootMs / 1000).toFixed(1)) });
  await tap(/^TAP TO START$/);
  await until(() => [...document.querySelectorAll('button')].some((b) => (b.getAttribute('aria-label') || b.innerText || '').includes('トップ画面へ進む')), 15000, 'タイトル');
  await scene('タイトル');
  await tap(/トップ画面へ進む/);

  // ---- 2. 助手えらび ----
  await until(() => /助手を選ぶ/.test(document.body.innerText), 15000, '助手えらび');
  const pick = await scene('助手えらび');
  readChars += pick.text.length;
  if (pick.text.length > 600) note('長い', '助手えらび', `最初の画面で読む字が${pick.text.length}字ある(助手${pick.reach.length}人ぶんの紹介)`);
  // 2026-11-11 案9: 行を押して選び、下の「この助手にする」で決める(はじめから みゅあ が選ばれている)
  await tap(/^この助手にする$/);

  // ---- 3. 名前とアイコン ----
  await until(() => /はじめての設定/.test(document.body.innerText), 10000, '名前とアイコン');
  const hello = await talk('名前とアイコン');
  await scene('名前とアイコン', { talkTaps: hello.taps });
  await tap(/^名前を決める$/);
  await page.locator('input[type="text"]:visible').first().fill('けんさ').catch(() => {});
  await tap(/^保存$/);
  await talk('名前とアイコン');
  await tap(/^アイコンを選ぶ$/);
  await wait(400);
  await scene('アイコンえらび');
  await tap(/^モッチー$/);
  await talk('名前とアイコン');
  await tap(/^決定！?$/);
  const onboardMs = await until(() => { try { return JSON.parse(localStorage.getItem('mh_onboarded') || 'false') === true; } catch { return false; } }, 10000, '名前とアイコン');
  await wait(1200);

  // ---- 4. 村の案内(HOME の建物を指しながら話す) ----
  const tourStart = await scene('村の案内');
  let firstReward = tourStart.dialogs.includes('ログインボーナス') ? { humanSec: humanSec(), taps } : null;
  if (tourStart.dialogs.length >= 2) note('隠れ', '村の案内', `案内が HOME の建物を指して話すあいだ、「${tourStart.dialogs.filter((d) => d !== 'はじめての案内').join('・')}」の窓が HOME を隠している`);
  const tour = await talk('村の案内');
  if (tour.taps >= LONG_TALK) note('長い', '村の案内', `「次へ」が${tour.taps}手続く(全${tour.total || tour.taps}話)`);
  await tap(/^(はじめる！?|わかった！?)$/);
  await wait(700);

  // ---- 5. れんしゅう(バトルのチュートリアル)の誘い ----
  const inviteState = await state();
  let tutorial = null;
  if (/れんしゅう|チュートリアル/.test(inviteState.text)) {
    await scene('れんしゅうの誘い');
    await talk('れんしゅうの誘い');
    if (await tap(/^チュートリアルを見る$/)) {
      await wait(1200);
      const head = await scene('れんしゅうの始まり');
      const total = (head.text.match(/れんしゅう \d+ ?\/ ?(\d+)/) || [])[1];
      tutorial = { total: total ? Number(total) : null, talkBeforeFirstAct: 0, acts: 0, reachedBattle: false };
      if (tutorial.total >= 40) note('長い', 'れんしゅう', `れんしゅうが全${tutorial.total}手ある(最初のバトルの前に通る)`);
      // バトルの画面(カードを出す所)に入るまで進める
      let stuck = 0;
      for (let i = 0; i < 60 && !tutorial.reachedBattle; i++) {
        const t = await talk('れんしゅう');
        if (tutorial.acts === 0) tutorial.talkBeforeFirstAct += t.taps;
        const s = await state();
        if (/ALLY LIFE|ACTION CARDS/.test(await page.evaluate(() => document.body.innerText))) { tutorial.reachedBattle = true; break; }
        if (s.spot.marked && !s.spot.reachable) {
          const cover = s.dialogs.filter((d) => d !== 'バトルチュートリアル');
          if (cover.length) {
            note('隠れ', 'れんしゅう', `「${s.text.replace(/ ?やめる$/, '').slice(0, 20)}」と光らせている所が「${cover.join('・')}」の窓の下にあって押せない`, await shot('れんしゅう-押す所が隠れている'));
            await tap(/^(閉じる|とじる)$/);
            continue;
          }
        }
        const go = await tap(/^(▶ ?)?(習得する|決定|勇者モンに選ぶ|これにする|OK)/);
        if (go) { tutorial.acts += 1; stuck = 0; continue; }
        if (s.spot.reachable) { await page.mouse.click(s.spot.x, s.spot.y); taps += 1; tutorial.acts += 1; stuck = 0; await wait(600); continue; }
        if (++stuck > 6) { note('行止', 'れんしゅう', `機械が先へ進めない(「${s.text.slice(0, 24)}」)`); break; }
        await wait(500);
      }
      if (tutorial.talkBeforeFirstAct >= LONG_TALK) note('長い', 'れんしゅう', `最初に自分で押すまで「次へ」が${tutorial.talkBeforeFirstAct}手続く`);
      await scene('れんしゅうのバトル', { tutorial });
      // 続きは人が遊ぶ所。ここで抜ける(「やめる」→ 確かめの窓があれば進む)
      await tap(/^やめる$/);
      await wait(500);
      await tap(/^(やめる|はい|終わる|OK|れんしゅうをやめる)$/);
      await wait(1200);
    }
  }

  // ---- 6. HOME。頼んでいない窓を順に閉じる ----
  // 案内とれんしゅうのあとに出るログインボーナスの窓(最初のごほうび)を待つ。開き直すと窓は消えるので、ここで見る
  if (!firstReward) {
    const shown = await until(() => !!document.querySelector('[aria-label="ログインボーナス"]'), 4000, '');
    if (shown >= 0) { firstReward = { humanSec: humanSec(), taps }; await scene('ログインボーナス'); await tap(/^(閉じる|とじる)$/); }
    else note('行止', 'ログインボーナス', '案内とれんしゅうが終わっても、ログインボーナスの窓が出ない');
  }
  const goHome = async () => {
    for (let i = 0; i < 5; i++) {
      const s = await state();
      if (s.home && !s.dialogs.length) return true;
      if (!(await tap(/^(←|戻る|もどる|HOME|ホーム|ホームへ|HOMEへ戻る|閉じる|とじる|×|✕)/, { count: false }))) break;
      await wait(500);
    }
    // 戻れなければ開き直す(保存はそのまま)
    await page.goto(`${base}/monster-hero/index.html`, { waitUntil: 'domcontentloaded' });
    await until(() => [...document.querySelectorAll('button')].some((b) => /TAP TO START/.test(b.innerText || '')), 30000, '');
    await tap(/^TAP TO START$/, { count: false });
    await wait(1500);
    await tap(/トップ画面へ進む/, { count: false });
    await wait(2000);
    return (await state()).home;
  };
  const popups = [];
  const drain = async (where, rounds = 40) => {
    let quiet = 0;
    for (let i = 0; i < rounds && quiet < 6; i++) {
      const s = await state();
      if (!s.dialogs.length) { quiet += 1; await wait(500); continue; }
      quiet = 0;
      const top = s.dialogs[s.dialogs.length - 1];
      if (!popups.some((p) => p.name === top && p.where === where)) {
        const rec = { where, name: top, lines: s.counter ? s.counter.of : null, chars: s.text.length, together: s.dialogs.length, shot: await shot(`割り込み-${top.replace(/[^\p{L}\p{N}]+/gu, '').slice(0, 14)}`) };
        popups.push(rec);
        if (s.dialogs.length >= 2) note('重なり', where, `窓が${s.dialogs.length}枚同時に出ている(${s.dialogs.join(' ＋ ')})`, rec.shot);
        if (rec.lines >= LONG_TALK) note('長い', where, `頼んでいないお話「${top.replace(/^イベント回想: /, '')}」が全${rec.lines}話で始まる`, rec.shot);
        if (STALE_WORDS.test(s.text)) note('ことば', where, `はじめての人に合わない言い回しの窓「${top}」`, rec.shot);
      }
      if (!(await tap(CLOSERS))) { if (!(await tap(/^(次へ|つぎへ|受け取る)$/))) await wait(500); }
      await wait(300);
    }
  };
  await goHome();
  await drain('HOME');
  const homePopups = popups.filter((p) => p.where === 'HOME');
  if (homePopups.length >= 3) note('割込', 'HOME', `HOME に着くまでに、頼んでいない窓が${homePopups.length}枚続けて開く(${homePopups.map((p) => p.name.replace(/^イベント回想: /, '')).join(' → ')})`, homePopups[0].shot);
  const home = await scene('HOME');
  const reachedHome = home.home && !home.dialogs.length;
  if (!reachedHome) note('行止', 'HOME', 'HOME に落ち着けない(窓が閉じ切らない)');
  const badges = (home.text.match(/NEW|！|!/g) || []).length;

  // ---- 7. HOME から行ける所を1つずつ開く ----
  const visits = [
    ['ギフト', /^ギフト/], ['ミッション', /^ミッション/], ['マーケット', /^マーケット/], ['モンヒロビート', /モンヒロビート/],
    ['助手ライフ', /^🏡|助手ライフ/], ['MFバトルカード', /MFバトルカード/], ['MB管理', /^M\/B管理/], ['神殿', /^神殿/], ['モンヒロバトル', /^モンヒロバトル/],
  ];
  let giftClaim = null;
  for (const [name, re] of visits) {
    if (!(await goHome())) { note('行止', name, 'HOME に戻れない'); break; }
    await drain('HOME', 6);
    const from = Date.now();
    if (!(await tap(re))) { note('行止', name, `HOME に「${name}」の入口が見つからない`); continue; }
    await wait(1300);
    const first = await state();
    const firstTalk = first.reach.some((l) => /^(次へ|つぎへ)$/.test(l)) ? await talk(name) : { taps: 0 };
    if (firstTalk.taps >= LONG_TALK) note('長い', name, `はじめて開くと「次へ」が${firstTalk.taps}手続く`);
    const s = await scene(name, { openMs: Date.now() - from - 1300, firstTalkTaps: firstTalk.taps });
    readChars += Math.min(s.text.length, 400);
    if (name === 'ギフト') {
      const got = await tap(/^(すべて受け取る|まとめて受け取る|全部受け取る|受け取る)/);
      if (got) { giftClaim = { humanSec: humanSec(), taps, button: got }; await wait(900); await scene('ギフト-受け取ったあと'); await tap(CLOSERS, { count: false }); }
      else note('行止', 'ギフト', '受け取るボタンが見つからない');
    }
    await drain(name, 4);
  }

  await page.close();
  const blockers = findings.filter((f) => f.kind === '隠れ' || f.kind === '行止').length + errors.length;
  return {
    orient, scenes, findings, popups, errors,
    summary: {
      bootSec: scenes[0].bootSec, onboardSec: Number((onboardMs / 1000).toFixed(1)), tourTaps: tour.taps, tutorial,
      firstRewardShown: firstReward, giftClaim, homeButtons: home.reach.length, homeBadges: badges,
      homePopups: homePopups.length, totalTaps: taps, readChars, humanSec: humanSec(), blockers,
    },
  };
}

(async () => {
  let playwright;
  try { playwright = require('playwright'); } catch { console.log('SKIP: playwright が入っていないので確認できません'); console.log('OK'); return; }
  fs.mkdirSync(OUT, { recursive: true });
  const server = await startServer();
  const base = `http://localhost:${server.address().port}`;
  // クラウドの作業場には決まった場所にブラウザが入っている(ほかのブラウザ検査と同じ)。無ければ Playwright の既定
  const PRE = '/opt/pw-browsers/chromium';
  const browser = await playwright.chromium.launch(fs.existsSync(PRE) ? { executablePath: PRE } : {});
  const results = [];
  try {
    for (const orient of ORIENTS) {
      try { results.push(await walk(browser, base, orient)); }
      catch (e) { results.push({ orient, scenes: [], findings: [{ kind: '行止', where: '道具', what: String(e).slice(0, 140), shot: '' }], popups: [], errors: [], summary: { blockers: 1 } }); }
    }
  } finally { await browser.close(); server.close(); }
  fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify({ at: new Date().toISOString(), results }, null, 1));

  const ORDER = ['隠れ', '行止', '重なり', '割込', '長い', 'ことば', '鍵', '多い', '待ち'];
  for (const r of results) {
    const s = r.summary;
    const name = r.orient === 'portrait' ? '縦' : '横';
    if (s.totalTaps != null) {
      const tut = s.tutorial ? `全${s.tutorial.total}手(最初に押すまで「次へ」${s.tutorial.talkBeforeFirstAct}手)` : '出ない';
      console.log(`[${name}] 起動 ${s.bootSec}秒 / 村の案内「次へ」${s.tourTaps}手 / れんしゅう ${tut} / HOME の割り込み ${s.homePopups}枚・ボタン ${s.homeButtons}個`);
      console.log(`[${name}] 最初のごほうび: 見える=${s.firstRewardShown ? `${s.firstRewardShown.taps}手・約${s.firstRewardShown.humanSec}秒` : 'なし'} / 受け取る(れんしゅうのあと)=${s.giftClaim ? `${s.giftClaim.taps}手・約${s.giftClaim.humanSec}秒` : 'できず'} / ひと通り ${s.totalTaps}手・読む字 ${s.readChars}字・人なら約${Math.round(s.humanSec / 60)}分`);
    }
    if (DETAIL) for (const sc of r.scenes) console.log(`   ${sc.name}: ${sc.taps}手め・ボタン${sc.buttons}・字${sc.chars}${sc.dialogs.length ? `・窓[${sc.dialogs.join('＋')}]` : ''} → ${sc.shot}`);
    const sorted = r.findings.slice().sort((a, b) => ORDER.indexOf(a.kind) - ORDER.indexOf(b.kind));
    const shown = DETAIL ? sorted : sorted.slice(0, 8);
    for (const f of shown) console.log(`[${name}] [${f.kind}] ${f.where}: ${f.what}${f.shot ? ` (${f.shot})` : ''}`);
    if (sorted.length > shown.length) console.log(`[${name}] … ほか ${sorted.length - shown.length} 件(--detail で全部)`);
    for (const e of r.errors.slice(0, 2)) console.log(`[${name}] [例外] ${e}`);
  }
  const blockers = results.reduce((a, r) => a + (r.summary.blockers || 0), 0);
  const total = results.reduce((a, r) => a + r.findings.length, 0);
  console.log(`止め絵と report.json: ${OUT}`);
  console.log(blockers ? `NG: 初めての人が進めなくなる気づきが ${blockers} 件(気づき 全${total}件)` : `OK: 進めなくなる所なし(気づき 全${total}件)`);
  process.exit(blockers ? 1 : 0);
})();

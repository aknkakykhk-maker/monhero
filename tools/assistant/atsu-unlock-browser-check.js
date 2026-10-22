// 5人目の助手「あつ」の解放の流れを、実ブラウザで通して確かめる(2026-10-22)。
//
//   python3 tools/serve.py 8899 を起動した状態で
//   node tools/assistant/atsu-unlock-browser-check.js
//   ATSU_SHOTS=<フォルダ> node tools/assistant/atsu-unlock-browser-check.js   画面の写しも撮る
//
// 見ているもの:
//   ① 公開の印(RELEASE_FLAGS.assistantAtsu)が偽のまま … 仲良し度がそろっていても、お話は流れず、助手の一覧にも出ない
//   ② 印が真で、仲良し度が足りない … お話は流れない。一覧には鍵つきの「？？？」
//   ③ 印が真で、みゅあ・きき・ももすけ がそろって Lv5 以上 … HOME でお話が流れる。見終わると一覧で選べる。選ぶと HOME の吹き出しがあつになる
// 印を真・偽にするのは、このページの中だけ(読み込み直後に RELEASE_FLAGS を書き換える)。ファイルの印は変えない
const fs = require('fs');
const path = require('path');
const { chromium } = require(path.join(__dirname, '../node_modules/playwright'));

const PAGE_URL = process.env.SMOKE_URL || 'http://localhost:8899/monster-hero/index.html';
const SHOTS = process.env.ATSU_SHOTS ? path.resolve(process.env.ATSU_SHOTS) : '';
const STORY_ID = 'atsu_join_2026_10_22';
const results = [];
const check = (name, ok, detail = '') => { results.push(ok); console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ' — ' + detail : ''}`); };

// 仲良し度の points(段階の need)。data/assistants.js の ASSISTANT_BOND_LEVELS と同じ値
const NEED = { 1: 0, 5: 800 };
// ほかのお話・告知は見た扱いにする(あつのお話だけが流れるように)。id は実ファイルから読む(書き写さない)
const assistantsSrc = fs.readFileSync(path.join(__dirname, '../../monster-hero/data/assistants.js'), 'utf8');
const changelogSrc = fs.readFileSync(path.join(__dirname, '../../monster-hero/data/changelog.js'), 'utf8');
const replaySrc = assistantsSrc.slice(assistantsSrc.indexOf('const EVENT_REPLAYS = ['));
const STORY_IDS = [...replaySrc.matchAll(/\{ id: '([a-z0-9_]+)'/g)].map(m => m[1]).filter(id => id !== STORY_ID);
const SEEN_NOTICE_IDS = [...changelogSrc.matchAll(/id:\s*'(update_notice_[^']+)'/g)].map(m => m[1]);

const seed = ({ bonds, storyIds, noticeIds, flagOn }) => {
  const put = (k, v) => localStorage.setItem(k, JSON.stringify(v));
  put('mh_breeder_name', 'テスト'); put('mh_breeder_icon', 'Mocchi'); put('mh_onboarded', true);
  put('mh_tutorial_seen_v1', true); put('mh_battle_tutorial_seen_v1', true); put('mh_battle_tutorial_guide_shown_v1', true);
  put('mh_rhythm_tutorial_seen_v1', true); put('mh_masu_migrated', true);
  put('mh_kiki_intro_seen_v1', true); put('mh_momosuke_intro_seen_v1', true); put('mh_tactics_intro_seen_v1', true);
  put('mh_rhythm_hell_story_seen_v1', true); put('mh_story_assistant_chat_seen_v1', true); put('mh_story_tactics_types_seen_v1', true);
  put('mh_assistant_selected_v1', 'mua');
  put('mh_rhythm_event_story_v1', storyIds);
  put('mh_seen_update_notices_v1', noticeIds);
  const d = new Date(); const pad = (n) => String(n).padStart(2, '0');
  put('mh_daily_masu_advice_date_v1', `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`);
  // みゅあのぶんだけ昔からのキー(assistantBondKeyFor)
  put('mh_assistant_bond_v1', { points: bonds.mua, day: null, daily: {}, dailyTotal: 0 });
  put('mh_assistant_bond_kiki_v1', { points: bonds.kiki, day: null, daily: {}, dailyTotal: 0 });
  put('mh_assistant_bond_momosuke_v1', { points: bonds.momosuke, day: null, daily: {}, dailyTotal: 0 });
  // 公開の印は、部品が読み込まれた直後に書き換える(const の中身なので、読み込み前には触れない)。
  // 公開したあと(ファイルの印が真)でも ① の「偽のとき」を確かめられるよう、どちらの向きにも合わせる(2026-10-22 公開)
  const timer = setInterval(() => {
    try { if (typeof RELEASE_FLAGS !== 'undefined') { RELEASE_FLAGS.assistantAtsu = !!flagOn; clearInterval(timer); } } catch {}
  }, 2);
};

const shot = async (page, name) => {
  if (!SHOTS) return;
  fs.mkdirSync(SHOTS, { recursive: true });
  await page.screenshot({ path: path.join(SHOTS, `${name}.png`) });
};
const bodyText = (page) => page.evaluate(() => (document.body.innerText || '').replace(/\s+/g, ' '));
const storyOn = (page) => page.evaluate(() => /W\.o\.F|おかえり、勇者|呼んだ？/.test(document.body.innerText || ''));

// 起動して HOME まで進む。あつのお話が出たらそこで止める(お話の「次へ」「スキップ」は押さない)
const boot = async (page) => {
  await page.goto(PAGE_URL, { waitUntil: 'load', timeout: 60000 });
  await page.waitForFunction(() => document.body.innerText.includes('TAP TO START'), { timeout: 40000 }).catch(() => {});
  await page.evaluate(() => [...document.querySelectorAll('button')].find(x => x.textContent.includes('TAP TO START'))
    ?.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })));
  await page.waitForFunction(() => !!document.querySelector('button[aria-label="トップ画面へ進む"]'), { timeout: 40000 }).catch(() => {});
  await page.evaluate(() => document.querySelector('button[aria-label="トップ画面へ進む"]')
    ?.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })));
  await page.waitForTimeout(3000);
  for (let i = 0; i < 12; i++) {
    if (await storyOn(page)) return;
    const clicked = await page.evaluate(() => {
      const b = [...document.querySelectorAll('button')].find(x => /^(確認|受け取る|閉じる|あとで|OK)$/.test((x.innerText || '').trim()));
      if (b) b.click();
      return !!b;
    });
    await page.waitForTimeout(700);
    if (!clicked) break;
  }
  await page.waitForTimeout(1500);
};
// 上に残っている知らせ(ログインボーナス・仲良し度の案内など)を閉じる
const dismiss = async (page) => {
  for (let i = 0; i < 16; i++) {
    const clicked = await page.evaluate(() => {
      const b = [...document.querySelectorAll('button')].find(x => /^(確認|受け取る|閉じる|あとで|OK|次へ|とじる)$/.test((x.innerText || '').trim()));
      if (b) b.click();
      return !!b;
    });
    await page.waitForTimeout(500);
    if (!clicked) break;
  }
};
// プロフィールの「いっしょに遊ぶ助手」で、選んでいない助手を押すと、鍵つきも含む選ぶ画面が開く
const openAssistantList = async (page) => {
  await dismiss(page);
  await page.evaluate(() => document.querySelector('button[aria-label="プロフィールを開く"]')?.click());
  await page.waitForTimeout(1500);
  await dismiss(page);
  await page.evaluate(() => document.querySelector('button[aria-pressed="false"][class*="min-h-[52px]"]')?.click());
  await page.waitForTimeout(1000);
};
const pickerText = (page) => page.evaluate(() => {
  const h = [...document.querySelectorAll('h3')].find(x => x.textContent.includes('いっしょに遊ぶ助手'));
  return h ? (h.parentElement.innerText || '').replace(/\s+/g, ' ') : '';
});

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const fatal = [];
  const open = async (opts) => {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    page.on('pageerror', (e) => fatal.push(e.message));
    await page.addInitScript(seed, { storyIds: STORY_IDS, noticeIds: SEEN_NOTICE_IDS, ...opts });
    return page;
  };
  const ready = { mua: NEED[5], kiki: NEED[5], momosuke: NEED[5] };
  try {
    // ① 印が偽
    {
      const page = await open({ bonds: ready, flagOn: false });
      await boot(page);
      await page.waitForTimeout(2500);
      check('公開の印が偽なら、仲良し度がそろってもお話は流れない', !(await storyOn(page)));
      await openAssistantList(page);
      const t = await pickerText(page);
      check('公開の印が偽なら、助手の一覧にあつも「？？？」も出ない', !!t && !/あつ/.test(t) && !/会えるかもしれません/.test(t), t.slice(0, 120));
      await page.close();
    }
    // ② 印が真・仲良し度が足りない(ももすけだけ Lv4)
    {
      const page = await open({ bonds: { ...ready, momosuke: NEED[5] - 1 }, flagOn: true });
      await boot(page);
      await page.waitForTimeout(2500);
      check('仲良し度が1人でも足りなければ、お話は流れない', !(await storyOn(page)));
      await openAssistantList(page);
      const t = await pickerText(page);
      check('解放前は、一覧に鍵つきの「？？？」で出る', /会えるかもしれません/.test(t) && !/あつ/.test(t), t.slice(0, 160));
      await shot(page, '01-select-locked');
      await page.close();
    }
    // ③ 印が真・仲良し度がそろった
    {
      const page = await open({ bonds: ready, flagOn: true });
      await boot(page);
      await page.waitForFunction(() => /片づけしてたら|W\.o\.F/.test(document.body.innerText || ''), { timeout: 15000 }).catch(() => {});
      const started = await page.evaluate(() => /片づけしてたら|W\.o\.F/.test(document.body.innerText || ''));
      check('仲良し度がそろうと、HOME でお話が流れる', started);
      // お話を「次へ」で最後まで進める。途中を何枚か写す
      const want = { 4: '02-story-wof', 9: '03-story-friends', 32: '04-story-before', 33: '04b-story-atsu-appears', 50: '05-story-tease', 55: '06-story-name', 83: '07-story-end' };
      let last = '', reachedEnd = false;
      for (let i = 0; i < 160; i++) {
        if (want[i]) await shot(page, want[i]);
        const t = await bodyText(page);
        if (!/次へ|スキップ/.test(t) || !(await storyOn(page) || /パーティ|あつ/.test(t))) break;
        last = t;
        if (/気が向いたら呼んで/.test(t)) reachedEnd = true;
        const ok = await page.evaluate(() => {
          const b = [...document.querySelectorAll('button')].reverse().find(x => /^(次へ|とじる|閉じる|おわる|終わる)$/.test((x.innerText || '').trim()));
          if (b) b.click();
          return !!b;
        });
        if (!ok) break;
        await page.waitForTimeout(350);
      }
      check('お話を最後まで進められる', reachedEnd);
      await page.waitForTimeout(1500);
      const seen = await page.evaluate((id) => { try { return JSON.parse(localStorage.getItem('mh_rhythm_event_story_v1') || '[]').includes(id); } catch { return false; } }, STORY_ID);
      check('見終わると「見た」が既存の並び(mh_rhythm_event_story_v1)に入る', seen);
      await openAssistantList(page);
      await shot(page, '08-select-unlocked');
      const picked = await page.evaluate(() => {
        const h = [...document.querySelectorAll('h3')].find(x => x.textContent.includes('いっしょに遊ぶ助手'));
        const b = h && [...h.parentElement.querySelectorAll('button')].find(x => /あつ/.test(x.innerText || ''));
        if (b) b.click();
        return !!b;
      });
      check('見終わったあと、一覧であつを選べる', picked);
      await page.waitForTimeout(800);
      const selected = await page.evaluate(() => { try { return JSON.parse(localStorage.getItem('mh_assistant_selected_v1')); } catch { return null; } });
      check('選ぶと、選んだ助手があつになる', selected === 'atsu', String(selected));
      await shot(page, '09-profile-atsu');
      // HOME へ戻って吹き出しを見る
      await dismiss(page);
      await page.evaluate(() => (document.querySelector('button[aria-label="ホームへ戻る"]') || document.querySelector('button[aria-label="戻る"]'))?.click());
      await page.waitForTimeout(2000);
      await dismiss(page);
      const homeText = await bodyText(page);
      const onHome = await page.evaluate(() => !!document.querySelector('button[aria-label="プロフィールを開く"]'));
      check('HOME の吹き出しに、あつの名前と顔が出る', onHome && /あつ/.test(homeText) && !!(await page.evaluate(() => document.querySelector('img[src*="atsu_"]'))));
      await shot(page, '10-home-bubble');
      await page.close();
    }
  } catch (e) {
    check('実行中にエラー', false, String(e && e.stack || e));
  } finally {
    check('操作中に致命的なJSエラーが出ない', fatal.length === 0, fatal.slice(0, 2).join(' / '));
    await browser.close();
  }
  const ng = results.filter(r => !r).length;
  console.log(ng ? `\n${ng}件のNGがあります` : '\nOK: あつの解放の流れは正しく動く');
  process.exit(ng ? 1 : 0);
})();

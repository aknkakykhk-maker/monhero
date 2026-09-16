// 助手の仲良し度でもらえる飾り枠を、実ブラウザで通して確かめる。2026-09-16。
//
//   python3 -m http.server 8899 でリポジトリのルートを配信した状態で
//   node ranking/profile-frame-unlock-browser-check.js
//
// 仲良し度を「まだ低い人」と「もう高い人」の2通りで開き、
//   ・低い人 … 鍵が付いて並ぶ。押すと条件と進み具合が出る。選んでも変わらない
//   ・高い人 … 起動しただけで配られている。選べる
// を確かめる。
const { chromium } = require('playwright');

const PAGE_URL = process.env.SMOKE_URL || 'http://localhost:8899/monster-hero/index.html';
const results = [];
const check = (name, ok, detail = '') => { results.push(ok); console.log(`  ${ok ? 'OK' : 'NG'}  ${name}${detail ? ' — ' + detail : ''}`); };

// 仲良し度の保存。points を直接入れて、その状態で起動させる
// 更新の案内のidは data/changelog.js が正本。ここで書き写すと増えたときに古くなるので、
// 実ファイルから読み出して「全部見た」状態にする
const changelogSrc = require('fs').readFileSync(
  require('path').join(__dirname, '../../monster-hero/data/changelog.js'), 'utf8');
const SEEN_NOTICE_IDS = [...changelogSrc.matchAll(/id:\s*'(update_notice_[^']+)'/g)].map(m => m[1]);

const seed = ({ points, seenNoticeIds }) => {
  const put = (k, v) => localStorage.setItem(k, JSON.stringify(v));
  put('mh_breeder_name', 'テスト'); put('mh_breeder_icon', 'Mocchi'); put('mh_onboarded', true);
  put('mh_tutorial_seen_v1', true); put('mh_battle_tutorial_seen_v1', true);
  put('mh_battle_tutorial_guide_shown_v1', true); put('mh_masu_migrated', true);
  put('mh_assistant_selected_v1', 'mua');
  // 助手が加わる会話は、解放の案内より先に出る決まりになっている。
  // ここで見たいのは飾り枠の案内なので、会話は見た扱いにしておく
  put('mh_kiki_intro_seen_v1', true); put('mh_momosuke_intro_seen_v1', true);
  // 更新の案内・日次アドバイスも、飾り枠の案内より先に出る決まり。ここでは見た扱いにしておく
  // (実際の遊び方でも、それらを閉じたあとに飾り枠の案内が出る)
  put('mh_seen_update_notices_v1', seenNoticeIds);
  const d = new Date(); const pad = (n) => String(n).padStart(2, '0');
  put('mh_daily_masu_advice_date_v1', `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`);
  // 仲良し度は助手ごとに別のキー。★みゅあのぶんだけは、既存プレイヤーの進捗を守るために
  //   昔からの mh_assistant_bond_v1 のまま(assistantBondKeyFor)。ほかは mh_assistant_bond_<id>_v1
  put('mh_assistant_bond_v1', { points, day: null, daily: {}, dailyTotal: 0 });
};

const openProfile = async (page) => {
  await page.goto(PAGE_URL, { waitUntil: 'load', timeout: 60000 });
  await page.waitForFunction(() => document.body.innerText.includes('TAP TO START'), { timeout: 40000 }).catch(() => {});
  await page.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find(x => x.textContent.includes('TAP TO START'));
    if (b) b.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
  });
  await page.waitForTimeout(2500);
  await page.waitForFunction(() => !!document.querySelector('button[aria-label="トップ画面へ進む"]'), { timeout: 40000 });
  await page.evaluate(() => document.querySelector('button[aria-label="トップ画面へ進む"]')
    ?.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })));
  await page.waitForTimeout(3000);
  for (let i = 0; i < 8; i++) {
    const clicked = await page.evaluate(() => {
      const b = [...document.querySelectorAll('button')].find(x => /^(確認|受け取る|閉じる|あとで|スキップ|次へ|つぎへ|OK)$/.test(x.textContent.trim()));
      if (b) b.click();
      return !!b;
    });
    await page.waitForTimeout(600);
    if (!clicked) break;
  }
  await page.evaluate(() => document.querySelector('button[aria-label="プロフィールを開く"]')?.click());
  await page.waitForTimeout(1500);
};

const readFrames = (page) => page.evaluate(() => [...document.querySelectorAll('[data-profile-frame-option]')].map(el => ({
  id: el.getAttribute('data-profile-frame-option'),
  locked: el.getAttribute('data-profile-frame-locked') === 'yes',
  text: el.innerText.replace(/\s+/g, ' ').trim(),
})));

async function run() {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const fatal = [];

  // ===== ① まだ仲良し度が低い人(Lv1) =====
  const low = await browser.newPage({ viewport: { width: 390, height: 844 } });
  low.on('pageerror', e => fatal.push(e.message));
  await low.addInitScript(seed, { points: 0, seenNoticeIds: SEEN_NOTICE_IDS });
  await openProfile(low);
  // 案内が出ていたら閉じる(低いLvでは出ないはずだが、出ても先へ進める)
  await low.evaluate(() => [...document.querySelectorAll('button')].find(b => b.textContent.trim() === '閉じる')?.click());
  await low.waitForTimeout(600);
  await low.evaluate(() => [...document.querySelectorAll('button')].find(b => b.textContent.includes('フレーム：'))?.click());
  await low.waitForTimeout(1000);
  const lowFrames = await readFrames(low);
  check('選択画面に枠が並ぶ', lowFrames.length >= 20, `${lowFrames.length}件`);
  const lockedLow = lowFrames.filter(f => f.locked);
  check('Lv1では助手の枠が9枚とも鍵つきで並ぶ', lockedLow.length === 9, `${lockedLow.length}枚`);
  check('鍵つきの枠にも、もらえる条件が出ている',
    lockedLow.every(f => /Lv\d/.test(f.text)), lockedLow.slice(0, 2).map(f => f.text).join(' / '));
  check('色の枠は鍵が付かない', lowFrames.filter(f => !f.locked).length >= 13, `${lowFrames.filter(f => !f.locked).length}枚`);
  // 鍵を押すと条件が出る
  await low.evaluate(() => document.querySelector('[data-profile-frame-option="frame_mua_1"]')?.click());
  await low.waitForTimeout(600);
  const info = await low.evaluate(() => document.querySelector('[data-profile-frame-locked-info]')?.innerText.replace(/\s+/g, ' ').trim() || '');
  check('鍵を押すと条件といまの進み具合が出る', /でもらえます/.test(info) && /いまは Lv/.test(info), info.slice(0, 60));
  check('鍵つきの枠は押しても選ばれない',
    await low.evaluate(() => document.querySelector('[data-profile-frame-option="frame_mua_1"]')?.getAttribute('aria-pressed') !== 'true'));

  // ===== ② もう仲良し度が高い人(Lv7以上) =====
  const high = await browser.newPage({ viewport: { width: 390, height: 844 } });
  high.on('pageerror', e => fatal.push(e.message));
  await high.addInitScript(seed, { points: 2000, seenNoticeIds: SEEN_NOTICE_IDS });   // Lv7(need:1750)を超える
  await openProfile(high);
  // ★案内はログインボーナス・更新の案内より後ろに回る(重ならないようにしてある)。
  //   実際の遊び方と同じで「それらを閉じて、次にプロフィールを開いたとき」に出る
  const closeAll = async (page) => {
    for (let i = 0; i < 12; i++) {
      const clicked = await page.evaluate(() => {
        const b = [...document.querySelectorAll('button')].find(x => /^(確認|受け取る|閉じる|あとで|スキップ|次へ|つぎへ|OK)$/.test(x.textContent.trim()));
        if (b) b.click();
        return !!b;
      });
      await page.waitForTimeout(500);
      if (!clicked) break;
    }
  };
  // ★案内は1件ずつ順番に出る。Lv7では「呼び方を決められるようになったよ」が先に出るので、
  //   それを読み終えたあとに飾り枠の案内が続く(同じ画面で入れ替わる)
  let noticeText = '';
  let sawFrameNotice = false;
  for (let tries = 0; tries < 6; tries++) {
    noticeText = await high.evaluate(() => document.body.innerText.replace(/\s+/g, ' '));
    if (/新しい飾り枠をもらったよ/.test(noticeText)) { sawFrameNotice = true; break; }
    const clicked = await high.evaluate(() => {
      const b = [...document.querySelectorAll('button')].find(x => /^(次へ|つぎへ|閉じる)$/.test(x.textContent.trim()));
      if (b) b.click();
      return !!b;
    });
    await high.waitForTimeout(600);
    if (!clicked) break;
  }
  check('もらったことを助手が知らせる', sawFrameNotice, noticeText.slice(0, 40));
  // 本文は複数ページある。どの枠をもらったかは2ページ目に出るので、めくりながら全部読む
  let noticeAllPages = noticeText;
  for (let i = 0; i < 6; i++) {
    const clicked = await high.evaluate(() => {
      const b = [...document.querySelectorAll('button')].find(x => x.textContent.trim() === '次へ');
      if (b) b.click();
      return !!b;
    });
    await high.waitForTimeout(500);
    noticeAllPages += ' ' + await high.evaluate(() => document.body.innerText.replace(/\s+/g, ' '));
    if (!clicked) break;
  }
  check('どの枠をもらったか名前で言う',
    sawFrameNotice && /みゅあのリボン/.test(noticeAllPages) && /みゅあといっしょ/.test(noticeAllPages),
    sawFrameNotice ? '名前あり' : '(案内が出ていない)');
  check('どこから選べるかも伝える', /フレーム/.test(noticeAllPages) && /選べる/.test(noticeAllPages));
  await closeAll(high);
  check('読み終えたら「知らせ済み」として保存される',
    await high.evaluate(() => {
      const list = JSON.parse(localStorage.getItem('mh_profile_frame_notice_v1') || 'null');
      return Array.isArray(list) && list.length === 3;
    }));
  for (let i = 0; i < 8; i++) {
    const more = await high.evaluate(() => {
      const b = [...document.querySelectorAll('button')].find(x => /^(次へ|つぎへ|閉じる)$/.test(x.textContent.trim()));
      if (b) b.click();
      return !!b;
    });
    await high.waitForTimeout(500);
    if (!more) break;
  }
  const nextFrame = await high.evaluate(() => document.querySelector('[data-assistant-next-frame]')?.getAttribute('data-assistant-next-frame') || '');
  check('全部もらった助手には「次にもらえる」を出さない', nextFrame === '', nextFrame || 'なし');
  await high.evaluate(() => [...document.querySelectorAll('button')].find(b => b.textContent.includes('フレーム：'))?.click());
  await high.waitForTimeout(1000);
  const highFrames = await readFrames(high);
  const mua = highFrames.filter(f => f.id.startsWith('frame_mua_'));
  check('起動しただけで、みゅあの3枚がもらえている(追いつき)',
    mua.length === 3 && mua.every(f => !f.locked), mua.map(f => f.locked ? '鍵' : 'OK').join(' '));
  check('ほかの助手の枠は鍵のまま',
    highFrames.filter(f => f.id.startsWith('frame_kiki_') || f.id.startsWith('frame_momosuke_')).every(f => f.locked));
  await high.evaluate(() => document.querySelector('[data-profile-frame-option="frame_mua_3"]')?.click());
  await high.waitForTimeout(800);
  check('もらった枠は選べる',
    await high.evaluate(() => document.querySelector('[data-profile-frame-option="frame_mua_3"]')?.getAttribute('aria-pressed') === 'true'));
  check('選んだ枠が保存される',
    await high.evaluate(() => JSON.parse(localStorage.getItem('mh_profile_frame_v1') || '""') === 'frame_mua_3'));
  check('もらった記録が新しいキーへ保存される',
    await high.evaluate(() => {
      const owned = JSON.parse(localStorage.getItem('mh_profile_frame_owned_v1') || '[]');
      return Array.isArray(owned) && owned.length === 3 && owned.every(id => id.startsWith('frame_mua_'));
    }));

  check('実行時エラーが出ていない', fatal.length === 0, fatal.slice(0, 2).join(' | '));
  await browser.close();
  const ng = results.filter(r => !r).length;
  console.log(ng === 0 ? '\nすべてOK' : `\n${ng}件のNGがあります`);
  process.exit(ng === 0 ? 0 : 1);
}

run().catch(e => { console.error(e); process.exit(1); });

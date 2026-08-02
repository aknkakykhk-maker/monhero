// バトル周りの仕様を実ブラウザで確認する。
//
//  ① 距離撃の取得 … 従来どおり配置した距離のひとつ手前の距離撃が手に入るか
//  ② 敵撃破のファンファーレ … 鳴っているあいだBGMは止まり、鳴り終わるとBGMが戻るか
//  ③ 固有技の強化フェーズ … 合体で引き継いだ固有技も強化できるか
//
// ③のために、引き継ぎ技を持つマスモンを端末保存(localStorage)に仕込んでから起動する。
//
//   python3 tools/serve.py   でリポジトリのルートを配信した状態で
//   node battle-check.js
const path = require('path');
const { chromium } = require('playwright');

const URL = process.env.SMOKE_URL || 'http://localhost:8899/monster-hero/index.html';
const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok }); console.log(`  ${ok ? 'OK' : 'NG'}  ${name}${detail ? ' — ' + detail : ''}`); };

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const fatal = [];
  page.on('pageerror', (e) => fatal.push(e.message));

  await page.addInitScript(() => {
    const put = (k, v) => localStorage.setItem(k, JSON.stringify(v));
    put('mh_breeder_name', 'テストブリーダー');
    put('mh_intro_done', true);
    // 合体でスエゾーの固有技を引き継いだモッチー(マスモン)を用意する
    put('mh_masu_mons', [{
      id: 'masu_test1', baseId: 'Mocchi', name: 'テストマス', bondXp: 0,
      distAptPoints: 0, distApt: ['C', 'C', 'C', 'C'],
      statPoints: { hp: 0, atk: 0, def: 0, guts: 0 }, createdAt: Date.now(),
      inheritedUniques: [{
        name: 'サイコキネシス', monId: 'Suezo', baseMult: 2.5, baseGuts: 48, evoLevel: 0,
        names: ['サイコキネシス', '熱視線', '食う', 'クロノキネシス', '歌う', '超熱視線', '超食う', '超歌う', '瞬間移動熱視線'],
        effectDesc: '吸収：最大ガッツの50%を回復', sourceMasuName: 'テストスエゾー',
      }],
    }]);
    put('mh_monster_roster', ['masu:masu_test1', 'Suezo', 'Golem', 'Tiger', 'Ham', 'Pixie', 'Monol', 'Oboro']);
  });

  // 画面内のボタンをテキストで押す(CDNのTailwindが無い環境ではレイアウトが崩れて
  // Playwrightのクリックが当たらないため、DOM側で直接クリックする)
  const clickText = async (src, nth = 0) => page.evaluate(([s, n]) => {
    const rx = new RegExp(s);
    const list = [...document.querySelectorAll('button')].filter(x => rx.test((x.innerText || '').replace(/\s+/g, ' ').trim()));
    if (!list[n]) return false;
    list[n].click();
    return true;
  }, [src, nth]);
  const bodyText = () => page.evaluate(() => (document.body ? document.body.innerText.replace(/\s+/g, ' ') : ''));
  const buttons = () => page.evaluate(() => [...document.querySelectorAll('button')].map(b => (b.innerText || '').replace(/\s+/g, ' ').trim()).filter(Boolean));
  // 手札のカードはドラッグ操作で扱うので、pointerdown→pointerup を送ってタップ扱いにする
  // pointerup を拾うリスナーは pointerdown の再描画後に登録されるため、間を空けて送る
  const tapCard = async (src) => {
    const pos = await page.evaluate((s) => {
      const rx = new RegExp(s);
      const btn = [...document.querySelectorAll('button')].find(x => rx.test((x.innerText || '').replace(/\s+/g, ' ').trim()) && x.closest('.flex-1.min-w-0'));
      if (!btn) return null;
      const r = btn.getBoundingClientRect();
      const x = r.left + r.width / 2, y = r.top + r.height / 2;
      const opt = { bubbles: true, cancelable: true, clientX: x, clientY: y, pointerId: 1, pointerType: 'touch', isPrimary: true };
      btn.dispatchEvent(new PointerEvent('pointerdown', opt));
      return { x, y };
    }, src);
    if (!pos) return false;
    await page.waitForTimeout(250);
    await page.evaluate((p) => {
      window.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, cancelable: true, clientX: p.x, clientY: p.y, pointerId: 1, pointerType: 'touch', isPrimary: true }));
    }, pos);
    return true;
  };

  await page.goto(URL, { waitUntil: 'load', timeout: 60000 });
  await page.waitForFunction(() => !!document.body && document.body.innerText.includes('TAP TO START'), { timeout: 40000 }).catch(() => {});
  // 起動画面は実機と同じ本物のクリックで押す(DOMのclick()だけだと pointerdown が起きず、
  // 起動タップの取り扱いが実際の操作と変わってしまうため)
  await page.getByRole('button', { name: 'TAP TO START' }).click({ force: true });
  await page.waitForTimeout(1600);

  // --- ランを開始して、近距離にマスモンを配置する ---
  await clickText('召喚開始'); await page.waitForTimeout(1200);
  await clickText('^テストマス'); await page.waitForTimeout(900);
  await clickText('^決定$'); await page.waitForTimeout(900);
  const placed = await clickText('近距離'); await page.waitForTimeout(1200);
  check('マスモンを近距離に配置できる', placed);
  // ブリーダーカードを1枚習得してバトルへ
  await clickText('おりょうの力'); await page.waitForTimeout(700);
  await clickText('習得する'); await page.waitForTimeout(1800);

  const inBattle = (await bodyText()).includes('WAVE 1/');
  check('バトルが始まる', inBattle);

  // --- 上部ヘッダー ---
  // Reactの状態を進めず、表示中のスコア文字列だけを受け入れ条件の値へ差し替えて
  // 375px幅で全要素と「諦める」のタップ領域がヘッダー内に残ることを測る。
  await page.setViewportSize({ width: 375, height: 812 });
  for (const scoreText of ['0', '9,999', '64,240', '999,999', '1,234,567.89']) {
    const layout = await page.evaluate((value) => {
      const header = document.querySelector('[data-battle-header]');
      const score = document.querySelector('[data-battle-score]');
      const quit = document.querySelector('[data-battle-quit]');
      if (!header || !score || !quit) return null;
      const textNode = [...score.childNodes].find(n => n.nodeType === Node.TEXT_NODE);
      if (textNode) textNode.textContent = ` ${value}`;
      const h = header.getBoundingClientRect();
      const q = quit.getBoundingClientRect();
      const controls = [...header.querySelectorAll('button')].map(button => button.getBoundingClientRect());
      return {
        inside: q.left >= h.left && q.right <= h.right && q.top >= h.top && q.bottom <= h.bottom,
        tappable: q.width >= 28 && q.height >= 28,
        controlsInside: controls.every(r => r.left >= h.left && r.right <= h.right),
        noOverlap: controls.every((r, i) => controls.every((other, j) => i === j || r.right <= other.left || other.right <= r.left)),
      };
    }, scoreText);
    check(`375px・スコア${scoreText}で諦めるを表示して押せる`,
      !!layout && layout.inside && layout.tappable && layout.controlsInside && layout.noOverlap);
  }
  await page.screenshot({ path: path.join(__dirname, 'out', 'battle-header-375.png') }).catch(() => {});
  await page.setViewportSize({ width: 390, height: 844 });

  // --- ① 距離撃 ---
  // 手札は毎ターン入れ替わるので、バトル中に見えた距離撃の名前をすべて集めて判定する
  const seenRange = new Set();
  const collectRange = async () => {
    (await buttons()).forEach(t => { const m = t.match(/([零近中遠])\s*\1?距離撃/); if (m) seenRange.add(m[1]); });
  };
  await collectRange();

  // --- 画面に応じて自動で進める ---
  // WAVE1をクリアし、WAVE2で供モンが加入すると「固有技の強化」画面に入る
  const selectedCount = async () => {
    const m = (await bodyText()).match(/Action Cards (\d+)\/(\d+)/);
    return m ? Number(m[1]) : 0;
  };
  // 攻撃力の高い順に試し、ガッツが足りなければ次の候補へ。最後はガード(消費0)で1ターン流す
  const CANDIDATES = ['モッチ砲|大モッチ砲|超モッチ砲', 'サイコキネシス|熱視線', '距離撃', 'もんた', 'ガード'];
  const audioSnapshot = () => page.evaluate(() => [...document.querySelectorAll('audio')].map(a => ({
    src: (a.src || '').split('/').pop(), paused: a.paused,
  })));
  // ファンファーレの観測結果(撃破の瞬間はバトル進行と同時に起きるので、進行中ずっと見張る)
  let jingleAlone = false, bgmBack = false;
  const watchAudio = async () => {
    const snap = await audioSnapshot();
    const jingle = snap.find(a => a.src.includes('jingle-'));
    const bgmPlaying = snap.filter(a => a.src.startsWith('bgm-') && !a.paused);
    if (jingle && !jingle.paused && bgmPlaying.length === 0) jingleAlone = true;
    else if (jingleAlone && (!jingle || jingle.paused) && bgmPlaying.length > 0) bgmBack = true;
  };

  let wave1Cleared = false, reachedUpgrade = false, gameOver = false;
  for (let step = 0; step < 90 && !reachedUpgrade && !gameOver; step++) {
    const t = await bodyText();
    await watchAudio();
    if (t.includes('固有技の強化')) { reachedUpgrade = true; break; }
    if (t.includes('GAME OVER') || t.includes('ゲームオーバー')) { gameOver = true; break; }

    if (t.includes('Action Cards')) {
      // バトル中: 1枚選んで配置し、Actionを押す
      await collectRange();
      let picked = false;
      for (const name of CANDIDATES) {
        if (!(await tapCard(name))) continue;
        await page.waitForTimeout(250);
        if (await selectedCount() > 0) { picked = true; break; }
      }
      if (picked) {
        await page.evaluate(() => {
          const el = document.querySelector('[data-slot-index="1"]') || document.querySelector('[data-slot-index="2"]');
          if (el) el.click();
        });
        await page.waitForTimeout(350);
      }
      if (!(await clickText('^Action$'))) { await page.waitForTimeout(600); continue; }
      for (let w = 0; w < 14; w++) {
        await page.waitForTimeout(450);
        await watchAudio();
        const t2 = await bodyText();
        if (!t2.includes('Action Cards') || t2.includes('リザルト')) break;
      }
      continue;
    }
    if (t.includes('リザルト')) { wave1Cleared = true; await clickText('^次へ進む$'); await page.waitForTimeout(1000); continue; }
    if (t.includes('攻撃覚醒')) {
      if (!(await clickText('^決定する$'))) { await clickText('攻撃覚醒'); }
      await page.waitForTimeout(1000); continue;
    }
    if (t.includes('ブリーダーカードの継承')) {
      if (!(await clickText('^習得する$|^強化する$'))) await clickText('おりょうの力|あつの挑発');
      await page.waitForTimeout(1200); continue;
    }
    if (t.includes('配置場所を決定')) { await clickText('中距離'); await page.waitForTimeout(1200); continue; }
    if (t.includes('を選択') || t.includes('仲間')) {
      // 供モンの選択画面。1体選んで決定する
      if (!(await clickText('^決定$'))) await clickText('^スエゾー|^ゴーレム|^ライガー|^ハム|^ピクシー|^モノリス|^オボロゲソウ');
      await page.waitForTimeout(1100); continue;
    }
    if (process.env.DEBUG_BATTLE) console.log('  未知の画面:', JSON.stringify(await buttons()).slice(0, 200));
    await page.waitForTimeout(800);
  }

  check('距離撃を手札で確認できた', seenRange.size > 0, [...seenRange].join(','));
  check('近距離に置くと従来どおり「零距離撃」になる', seenRange.size > 0 && [...seenRange].every(v => v === '零'), [...seenRange].join(','));
  check('WAVEをクリアできた', wave1Cleared);
  check('撃破後にファンファーレが鳴る(BGMは止まる)', jingleAlone);
  check('ファンファーレのあとBGMが戻る', bgmBack, (await audioSnapshot()).filter(a => !a.paused).map(a => a.src).join(',') || '(無音)');

  // --- ③ 引き継ぎ技の強化表示 ---
  const upg = await bodyText();
  check('固有技の強化画面へ進める', upg.includes('固有技の強化'));
  check('自分の固有技が並ぶ', upg.includes('モッチ砲'));
  check('引き継いだ固有技も並ぶ', upg.includes('サイコキネシス') && upg.includes('引き継ぎ'));

  // 引き継ぎ技の「＋」を押してレベルが上がるか(ポイントがある場合のみ)
  const before = await page.evaluate(() => {
    const m = (document.body.innerText || '').match(/Remaining Points:\s*(\d+)/);
    return m ? Number(m[1]) : 0;
  });
  if (before > 0) {
    const bumped = await page.evaluate(() => {
      // 「引き継ぎ」バッジを含む行の＋ボタンを押す
      const row = [...document.querySelectorAll('div')].find(d => /引き継ぎ/.test(d.innerText || '') && d.querySelectorAll('button').length === 2);
      if (!row) return false;
      row.querySelectorAll('button')[1].click();
      return true;
    });
    await page.waitForTimeout(600);
    const after = await bodyText();
    check('引き継いだ固有技を強化できる', bumped && /サイコキネシス|熱視線/.test(after) && after.includes('熱視線'), bumped ? '' : '＋ボタンが見つからない');
  } else {
    check('引き継いだ固有技を強化できる', false, '強化ポイントが0のため確認できず');
  }

  check('操作中に致命的なJSエラーが出ない', fatal.length === 0, fatal.slice(0, 2).join(' / '));

  await page.screenshot({ path: path.join(__dirname, 'out', 'battle-check.png') }).catch(() => {});
  const ng = results.filter(r => !r.ok).length;
  console.log(`\n${results.length - ng}/${results.length} 項目OK`);
  await browser.close();
  process.exit(ng ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });

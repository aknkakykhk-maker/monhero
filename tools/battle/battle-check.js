const TOOLS_DIR = require('path').join(__dirname, '..'); // tools/ 直下。分類フォルダから見た1つ上
// バトル周りの仕様を実ブラウザで確認する。
//
//  ① 距離撃の取得 … 従来どおり配置した距離のひとつ手前の距離撃が手に入るか
//  ② 敵撃破のファンファーレ … 鳴っているあいだBGMは止まり、鳴り終わるとBGMが戻るか
//  ③ 固有技の強化フェーズ … 合体で引き継いだ固有技も強化できるか
//
// ③のために、引き継ぎ技を持つマスモンを端末保存(localStorage)に仕込んでから起動する。
//
//   python3 tools/serve.py   でリポジトリのルートを配信した状態で
//   node battle/battle-check.js
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
    put('mh_breeder_icon', 'Mocchi');
    // ★はじめての案内をとばす鍵は mh_intro_done ではなく mh_onboarded。
    //   練習(バトルチュートリアル)の既読も入れておかないと、HOMEで案内が始まってしまう
    put('mh_onboarded', true);
    put('mh_tutorial_seen_v1', true);
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

  // ★起動画面と「はじめる」は pointerdown で拾う作りなので、click() では進まない
  //   (2026-09-07に検査を追随。ほかのブラウザ検査と同じやり方にそろえた)
  const pointerDown = (find) => page.evaluate((f) => {
    const b = f.aria ? document.querySelector(`button[aria-label="${f.aria}"]`)
      : [...document.querySelectorAll('button')].find((x) => x.textContent.includes(f.text));
    if (b) b.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    return !!b;
  }, find);
  // ログインボーナス・ギフト・更新のお知らせが出ていたら閉じる。
  // お知らせは複数ページあるので「次へ」で最後まで送ってから閉じる
  const dismissOverlays = async () => {
    // お知らせは何枚も続けて出る(ログインボーナス → ギフト → 更新 → 助手の告知)。
    // 1枚閉じると次が出てくるので、2回続けて「何も無い」まで送る
    let quiet = 0;
    for (let i = 0; i < 40 && quiet < 2; i++) {
      const closed = await page.evaluate(() => {
        // ダイアログが出ているときは、その中の最後のボタン(閉じる側)を押す。
        // 助手の告知は「◯◯を見る / 今は見ない」のように、閉じる言い方が場面ごとに変わる
        const dialog = document.querySelector('[role="dialog"]');
        if (dialog) {
          const inner = [...dialog.querySelectorAll('button')];
          if (inner.length) { inner[inner.length - 1].click(); return true; }
          dialog.click(); return true;
        }
        const b = [...document.querySelectorAll('button')].find((x) => /^(確認|受け取る|閉じる|とじる|OK|つぎへ|次へ|はじめる|今は見ない|あとで|スキップ|やめる)$/.test((x.innerText || '').trim()));
        if (b) { b.click(); return true; }
        return false;
      });
      if (!closed) { quiet++; await page.waitForTimeout(600); continue; }
      quiet = 0;
      await page.waitForTimeout(400);
    }
  };

  // このサンドボックスへは Tailwind の CDN が届かない。待たされるだけなので先に切る
  await page.route('**cdn.tailwindcss.com**', (r) => r.abort()).catch(() => {});
  await page.goto(URL, { waitUntil: 'load', timeout: 60000 });
  await page.waitForFunction(() => !!document.body && document.body.innerText.includes('TAP TO START'), { timeout: 40000 }).catch(() => {});
  await pointerDown({ text: 'TAP TO START' }); await page.waitForTimeout(2200);
  await pointerDown({ aria: 'トップ画面へ進む' }); await page.waitForTimeout(2200);
  await dismissOverlays();

  // --- ランを開始して、近距離にマスモンを配置する ---
  // ★「召喚開始」でいきなり始まる作りは無くなり、
  //   HOME →「バトル」→ モード選択 → 難易度 → 勇者モン → 距離、の順になった
  await clickText('^バトル$'); await page.waitForTimeout(1600); await dismissOverlays();
  await clickText('難易度を選ぶ'); await page.waitForTimeout(1600);
  await clickText('この難易度で挑戦'); await page.waitForTimeout(1800); await dismissOverlays();
  // ★カードを押すと詳細が開き、確定は「勇者モンに選ぶ」。以前の「決定」ではもう進めない
  await clickText('^テストマス'); await page.waitForTimeout(900);
  await clickText('^勇者モンに選ぶ$'); await page.waitForTimeout(1000);
  const placed = await clickText('近距離'); await page.waitForTimeout(1200);
  check('マスモンを近距離に配置できる', placed);
  // アシストカードを1枚習得してバトルへ
  await clickText('おりょうの力'); await page.waitForTimeout(700);
  await clickText('習得する'); await page.waitForTimeout(1800);

  const inBattle = (await bodyText()).includes('WAVE 1/');
  check('バトルが始まる', inBattle);

  // --- 上部ヘッダー ---
  // ★ここだけは実測なので、Tailwind の CSS が無いと測れない。
  //   このサンドボックスへは CDN が届かず、w-* / p-* / min-w-* がどれも効かないため、
  //   ボタンは 0px 近くまで潰れ、TURN と SCORE の左右関係も崩れる(実装ではなく環境の都合)。
  //   届く環境では今までどおり測る。
  const tailwindReady = await page.evaluate(() => {
    const probe = document.createElement('div');
    probe.className = 'w-12';
    document.body.appendChild(probe);
    const w = probe.getBoundingClientRect().width;
    probe.remove();
    return Math.round(w) === 48;
  });
  if (!tailwindReady) console.log('  --  上部ヘッダーの実測は飛ばす(TailwindのCSSが読めない環境のため)');
  // Reactの状態を進めず、表示中のスコア文字列だけを受け入れ条件の値へ差し替えて、
  // iPhone SE相当の幅でTURN・SCOREと固定操作領域が重ならずヘッダー内に残ることを測る。
  await page.setViewportSize({ width: 375, height: 667 });
  for (const scoreText of (tailwindReady ? ['0', '64,240', '1,273,520', '999,999,999', '1,000,000,000'] : [])) {
    const layout = await page.evaluate((value) => {
      const header = document.querySelector('[data-battle-header]');
      const turn = document.querySelector('[data-battle-turn]');
      const score = document.querySelector('[data-battle-score]');
      const scoreValue = document.querySelector('[data-battle-score-value]');
      const controlsBox = document.querySelector('[data-battle-controls]');
      const quit = document.querySelector('[data-battle-quit]');
      if (!header || !turn || !score || !scoreValue || !controlsBox || !quit) {
        return { missing: ['header','turn','score','scoreValue','controls','quit']
          .filter((k, i) => ![header, turn, score, scoreValue, controlsBox, quit][i]).join(',') };
      }
      scoreValue.textContent = value;
      const h = header.getBoundingClientRect();
      const t = turn.getBoundingClientRect();
      const s = score.getBoundingClientRect();
      const c = controlsBox.getBoundingClientRect();
      const q = quit.getBoundingClientRect();
      const controls = [...header.querySelectorAll('button')].map(button => button.getBoundingClientRect());
      return {
        inside: q.left >= h.left && q.right <= h.right && q.top >= h.top && q.bottom <= h.bottom,
        tappable: q.width >= 28 && q.height >= 28,
        controlsInside: controls.every(r => r.left >= h.left && r.right <= h.right),
        noOverlap: controls.every((r, i) => controls.every((other, j) => i === j || r.right <= other.left || other.right <= r.left)),
        metricsSeparate: t.right <= s.left && s.right <= c.left,
        labelsVisible: turn.innerText.includes('TURN') && score.innerText.includes('SCORE') && score.innerText.includes(value),
      };
    }, scoreText);
    check(`375px・スコア${scoreText}で上部表示と4操作を重ねない`,
      !!layout && layout.inside && layout.tappable && layout.controlsInside && layout.noOverlap
        && layout.metricsSeparate && layout.labelsVisible,
      layout && layout.missing ? `見つからない: ${layout.missing}` : JSON.stringify(layout));
  }
  await page.screenshot({ path: path.join(TOOLS_DIR, 'out', 'battle-header-375.png') }).catch(() => {});
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
    // ★「攻撃覚醒」は #639 で「トレーニング」へ置き換わり、4種類から2つ選ぶ形になった。
    //   2つ選ぶまで決定を押せないので、頭から2つ押してから決定する
    if (t.includes('トレーニング') || t.includes('攻撃覚醒')) {
      for (const name of ['^走り込み', '^ドミノ倒し', '^丸太うけ', '^猛勉強']) {
        if (await clickText(name)) await page.waitForTimeout(250);
        if (/決定する|この2つで決定/.test(await bodyText())) break;
      }
      if (!(await clickText('^決定する$|^この2つで決定$|決定'))) await clickText('^走り込み');
      await page.waitForTimeout(1000); continue;
    }
    if (t.includes('アシストカードの継承')) {
      if (!(await clickText('^習得する$|^強化する$'))) await clickText('おりょうの力|あつの挑発');
      await page.waitForTimeout(1200); continue;
    }
    if (t.includes('配置場所を決定')) { await clickText('中距離'); await page.waitForTimeout(1200); continue; }
    if (t.includes('を選択') || t.includes('仲間')) {
      // 供モンの選択画面。カードを押すと詳細が開き、確定は「供モンに選ぶ」
      // (勇者モン選択と同じ形。以前の「決定」ではもう進めない)
      if (!(await clickText('^この供モンを選ぶ$'))) {
        await clickText('^スエゾー|^ゴーレム|^ライガー|^ハム|^ピクシー|^モノリス|^オボロゲソウ');
        await page.waitForTimeout(500);
        await clickText('^この供モンを選ぶ$');
      }
      await page.waitForTimeout(1100); continue;
    }
    if (process.env.DEBUG_BATTLE) console.log('  未知の画面:', JSON.stringify(await buttons()).slice(0, 200));
    await page.waitForTimeout(800);
  }

  check('距離撃を手札で確認できた', seenRange.size > 0, [...seenRange].join(','));
  // ★仕様が変わった。以前は「配置した距離のひとつ手前」の距離撃だったが、
  //   いまは配置した距離**そのもの**の距離撃が手に入る(実装は const rIdx=idx;)。
  //   近距離に置いたら「近距離撃」。tools/battle/unique-range-check.js が同じ約束を静的に見ている
  check('近距離に置くと「近距離撃」になる', seenRange.size > 0 && [...seenRange].every(v => v === '近'), [...seenRange].join(','));
  check('WAVEをクリアできた', wave1Cleared);
  // ★音は実際に鳴らないと測れない。ヘッドレスのChromiumでは自動再生が止められていて
  //   <audio> がひとつも動かないため、この2つはこの環境では判定できない
  //   (docs/refactor/BASELINE_2026-09.md にも「(無音)」として載っている既知のぶん)。
  //   音源が動く環境では今までどおり測る。
  const audioAlive = (await audioSnapshot()).length > 0;
  if (!audioAlive) {
    console.log('  --  ファンファーレの確認は飛ばす(音を鳴らせない環境のため)');
  } else {
    check('撃破後にファンファーレが鳴る(BGMは止まる)', jingleAlone);
    check('ファンファーレのあとBGMが戻る', bgmBack, (await audioSnapshot()).filter(a => !a.paused).map(a => a.src).join(',') || '(無音)');
  }

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

  await page.screenshot({ path: path.join(TOOLS_DIR, 'out', 'battle-check.png') }).catch(() => {});
  const ng = results.filter(r => !r.ok).length;
  console.log(`\n${results.length - ng}/${results.length} 項目OK`);
  await browser.close();
  process.exit(ng ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });

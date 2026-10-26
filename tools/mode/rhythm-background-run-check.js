// モンビーを開いたままクイック∞周回が続くこと(docs/spec/QUICK_RHYTHM_LINK.md PR4)を
// 実ブラウザで確かめる。
//
//   python3 tools/serve.py を起動した状態で
//   node tools/mode/rhythm-background-run-check.js
//
// 見ているもの:
//   ① ∞周回中のバトル画面に「モンビーへ」の入口が出る
//   ② モンビーへ移っても周回が止まらない(WAVEかターンが進む)
//   ③ 敵を倒しても画面がバトルへ飛び戻らない
//   ④ モンビーからバトルへ戻れる(段階の続きから)
//
// 「止まらないこと」は静的検査では拾えない。条件式が正しくても動かないことがあるので、
// ここは必ず実ブラウザで見る。
// 「演奏中は止まる」「曲が終わると再開する」は、演奏を最後まで通す必要があり
// この環境では時間がかかりすぎるので、battle/run-stage-check.js の静的検査で押さえている
// (RHYTHM_PLAY を裏回しの対象へ入れていないこと・進行が止まること)。
const { chromium } = require('playwright');

const PAGE_URL = process.env.SMOKE_URL || 'http://localhost:8899/monster-hero/index.html';
// 進んだかどうかを見る時間。×1速でもWAVEかターンのどちらかは必ず動く長さ
const WATCH_MS = 12000;
const results = [];
const check = (name, ok, detail = '') => { results.push(ok); console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ' — ' + detail : ''}`); };

const seed = () => {
  const put = (k, v) => localStorage.setItem(k, JSON.stringify(v));
  put('mh_breeder_name', 'テスト');
  put('mh_breeder_icon', 'Mocchi');
  put('mh_onboarded', true);
  put('mh_tutorial_seen_v1', true);
  put('mh_battle_tutorial_seen_v1', true);
  put('mh_battle_tutorial_guide_shown_v1', true);
  put('mh_rhythm_tutorial_seen_v1', true);
  put('mh_monster_roster', ['Suezo', 'Golem', 'Tiger', 'Ham', 'Pixie', 'Monol', 'Oboro', 'Mocchi']);
  put('mh_clears_Beginner', 3);
  put('mh_quick_clears_Beginner', 3);
};

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const fatal = [];
  page.on('pageerror', (e) => fatal.push(e.message));
  await page.addInitScript(seed);
  // 起動直後に流れるお話(きゅうこの加入など)は見たことにする(2026-10-23 きゅうこの公開で、お話が画面を覆って止まった)
  await page.addInitScript(require('../boot/quiet-boot-seed').eventStorySeed());
  // 更新履歴の助手の告知も見たことにする(起動直後の「マーケットを見る」を押して、マーケットへ行ってしまった)
  await page.addInitScript(require('../boot/quiet-boot-seed').updateNoticeSeed());

  const pointerDown = (find) => page.evaluate((f) => {
    const b = f.aria ? document.querySelector(`button[aria-label="${f.aria}"]`)
      : [...document.querySelectorAll('button')].find((x) => x.textContent.includes(f.text));
    if (b) b.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    return !!b;
  }, find);
  const clickExact = (label) => page.evaluate((wanted) => {
    const b = [...document.querySelectorAll('button')].find((x) => (x.innerText || '').trim() === wanted);
    if (b) b.click();
    return !!b;
  }, label);
  const clickMatching = (pattern) => page.evaluate((p) => {
    const b = [...document.querySelectorAll('button')].find((x) => new RegExp(p).test((x.innerText || '').replace(/\s+/g, ' ').trim()));
    if (b) b.click();
    return !!b;
  }, pattern);
  const clickSelector = (selector) => page.evaluate((s) => {
    const b = document.querySelector(s);
    if (b) b.click();
    return !!b;
  }, selector);
  const dismissOverlays = async () => {
    for (let i = 0; i < 12; i++) {
      const closed = await page.evaluate(() => {
        // 「スキップ」… HOME やバトルの上に自動で始まる助手たちの会話(ハロウィン・ナイトなど)。回ごとに既読の印が違い増えていくので、
        //   既読を仕込まずに飛ばす(2026-10-21 会話が HOME をふさぎ、2回目の周回を始められずに落ちていた)
        const b = [...document.querySelectorAll('button')].find((x) => /^(確認|受け取る|閉じる|OK|スキップ)$/.test((x.innerText || '').trim()));
        if (b) { b.click(); return true; }
        const dialog = document.querySelector('[role="dialog"]');
        if (dialog) { (dialog.querySelector('button') || dialog).click(); return true; }
        return false;
      });
      if (!closed) break;
      await page.waitForTimeout(450);
    }
  };
  // AUTO・省エネのように押すたびに切り替わるボタンを、表示が target になるまで押す。
  // 押したら決め打ちで待たず、表示が変わるまで待つ(2026-10-21: 重いときに書き換えが待ち時間に間に合わず、もう一度押して行き過ぎていた)。
  // AUTO ボタンは WAVE を倒した直後の「ステータスアップ！」の画面のあいだ消えるので、出るのを待ってから読む・押す
  const cycleLabelTo = async (prefix, target, tries) => {
    const sel = `button[aria-label^="${prefix}"]`;
    const label = () => page.evaluate((q) => document.querySelector(q)?.getAttribute('aria-label') || null, sel);
    const present = () => page.waitForFunction((q) => !!document.querySelector(q), sel, { timeout: 10000 }).catch(() => {});
    for (let i = 0; i < tries; i++) {
      await present();
      const before = await label();
      if (before === target) return true;
      await page.evaluate((q) => document.querySelector(q)?.click(), sel);
      await page.waitForFunction(([q, b]) => { const x = document.querySelector(q); return !x || x.getAttribute('aria-label') !== b; }, [sel, before], { timeout: 5000 }).catch(() => {});
    }
    await present();
    return (await label()) === target;
  };
  // WAVE と TURN は「ランがどこまで進んだか」の唯一の手がかり。
  // バトル画面を描いていないあいだは読めないので、いったんバトルへ戻してから読む
  const readProgress = () => page.evaluate(() => {
    const text = (document.body ? document.body.innerText : '').replace(/\s+/g, ' ');
    return {
      turn: Number((text.match(/TURN\s*(\d+)/) || [])[1] || 0),
      wave: Number((text.match(/WAVE\s*(\d+)/) || [])[1] || 0),
      // 全部の WAVE 数(WAVE 3/10 の 10)と、何周目か(周回の帯の「2周目」)
      waves: Number((text.match(/WAVE\s*\d+\s*\/\s*(\d+)/) || [])[1] || 0),
      lap: Number((text.match(/(\d+)\s*周目/) || [])[1] || 0),
    };
  });
  // 進んだか: WAVE かターンが増えた・WAVE が1へ戻った(次の周)・周が増えた
  const advanced = (b, a) => a.wave > b.wave || a.turn > b.turn || a.wave < b.wave || a.lap > b.lap;
  const fmt = (p) => `W${p.wave}/T${p.turn}${p.lap ? '・' + p.lap + '周目' : ''}`;
  // 見張る: WATCH_MS 見て進んだかを返す。
  // ★最後の WAVE(ボス)は、次の周へ入るまで 12 秒前後かかり、モンビーの帯には TURN が出ないので、
  //   そのあいだ文字の上では何も変わらない(2026-10-26 W10/T0 → W10/T0 で落ちていた・止まってはいない)。
  //   最後の WAVE から見始めて動かなかったときだけ、もう WATCH_MS 見る(進むことを求めるのは同じ)
  const watchProgress = async () => {
    const b = await readProgress();
    await page.waitForTimeout(WATCH_MS);
    let a = await readProgress();
    if (!advanced(b, a) && b.waves > 0 && b.wave >= b.waves) { await page.waitForTimeout(WATCH_MS); a = await readProgress(); }
    return { ok: advanced(b, a), detail: `${fmt(b)} → ${fmt(a)}` };
  };
  const onRhythmHome = () => page.evaluate(() => !!document.querySelector('[data-rhythm-demo-home]'));

  try {
    await page.goto(PAGE_URL, { waitUntil: 'load', timeout: 60000 });
    await page.waitForFunction(() => document.getElementById('root')?.children.length > 0, { timeout: 60000 });
    await page.waitForFunction(() => document.body.innerText.includes('TAP TO START'), { timeout: 40000 }).catch(() => {});
    await pointerDown({ text: 'TAP TO START' });
    await page.waitForTimeout(2200);
    await pointerDown({ aria: 'トップ画面へ進む' });
    await page.waitForTimeout(2200);
    await dismissOverlays();

    // クイックモードで1ラン始めて、AUTOを∞まで回す。
    // ★HOMEへ戻ったあとの「2回目」でも同じ手順を使うので関数にしてある
    //   (2026-09-14・ユーザー報告「モンビー入る→ホーム戻る→モンビー入る→止まる」)。
    //   1回だけ回す検査では、実行中の印の持ち越しを絶対に拾えない。
    const autoLabel = async () => page.evaluate(() => document.querySelector('button[aria-label^="AUTO"]')?.getAttribute('aria-label'));
    const startQuickInfinityRun = async () => {
    await dismissOverlays();
    await page.evaluate(() => document.querySelector('button[aria-label="モンヒロバトル"]')?.click());
    await page.waitForTimeout(600);
    await page.evaluate(() => document.querySelector('[data-battle-system="systemQuick"]')?.click());
      await page.waitForTimeout(1200);
    // ★クイックは1つ上の入口で選んだ時点で難易度選択へ進んでいる(2026-09-20)。
    //   モード選択のカルーセルには並ばないので、ここでカードを探す必要はない
      await page.waitForTimeout(1300);
      await clickMatching('この難易度で挑戦');
      await page.waitForTimeout(1500);
      await page.evaluate(() => { [...document.querySelectorAll('article,button')].find((x) => /スエゾー/.test(x.textContent))?.click(); });
      await page.waitForTimeout(900);
      await clickMatching('勇者モンに選ぶ');
      await page.waitForTimeout(900);
      await page.evaluate(() => { [...document.querySelectorAll('button')].find((x) => /近距離|中距離|零距離|遠距離/.test(x.textContent))?.click(); });
      await page.waitForTimeout(1300);
      await dismissOverlays();
      await page.evaluate(() => { [...document.querySelectorAll('button')].find((x) => /新規習得/.test(x.textContent))?.click(); });
      await page.waitForTimeout(900);
      await clickExact('習得する');
      await page.waitForTimeout(3500);
    // 一括実行だとブラウザが重く、待ち時間だけでは間に合わないことがある。
      // バトル画面(AUTOボタン)が出るまで待ってから先へ進む
      await page.waitForFunction(() => !!document.querySelector('button[aria-label^="AUTO"]'), { timeout: 25000 }).catch(() => {});
      // AUTO を ∞ まで回す(OFF → ON → ∞)
      return cycleLabelTo('AUTO', 'AUTO ∞', 3);
    };
    check('クイックで∞周回を始められる', await startQuickInfinityRun(), await autoLabel());

    // ---- ① 入口が出る ----
    // 入口はバトル画面(gameState==='BATTLE')のときだけ出る。WAVE の切り替わりのあいだは消えるので、1回だけ見ると
    // その一瞬を引いて落ちていた(2026-10-12・回すたびに別の項目で落ちる)。出るまで待ってから確かめ、押す
    const hasEntry = await page.waitForSelector('[data-quick-to-rhythm]', { timeout: 20000 }).then(() => true).catch(() => false);
    check('∞周回中のバトル画面にモンビーへの入口が出る', hasEntry);

    // ---- ② モンビーへ移っても周回が止まらない ----
    await page.waitForSelector('[data-quick-to-rhythm]', { timeout: 20000 }).catch(() => {});
    const before = await readProgress();
    await clickSelector('[data-quick-to-rhythm]');
    // openRhythmDemo は設定・記録の読み込みを待ってから画面を切り替える。
    // 助手の告知などが重なることもあるので、出るまで待ってから確かめる
    // モンヒロビートは入るとまずモードえらび(2026-10-03)。出ていたらソロライブを押して曲えらびへ
    await page.waitForSelector('[data-rhythm-mode-solo],[data-rhythm-demo-start],[data-rhythm-demo-home]',{timeout:30000}).catch(()=>{});await page.evaluate(()=>document.querySelector('[data-rhythm-mode-solo]')?.click());
    await page.waitForFunction(() => !!document.querySelector('[data-rhythm-demo-home]'), { timeout: 15000 }).catch(() => {});
    await dismissOverlays();
    check('モンビーへ移れる（周回を止めずに）', await onRhythmHome());
    await page.waitForTimeout(WATCH_MS);
    // ★このあいだに敵を何体か倒しているはず。倒したときの段階の切り替えで
    //   画面がバトルへ飛び戻らないことを確かめる。
    //   advanceRunStage が古い値を掴んでいると、ここでモンビーから追い出される
    //   (2026-09-06・ユーザー報告「モンビーを押すと一瞬で戻る」)
    check('敵を倒しても画面がバトルへ飛び戻らない', await onRhythmHome(),
      await page.evaluate(() => (document.body.innerText || '').replace(/\s+/g, ' ').slice(0, 60)));
    // いったんバトルへ戻して、進んだかどうかを読む。
    // ★2026-09-13から、曲えらびの「戻る」はHOMEへ抜ける(周回も終える)ようになったので、
    //   バトルへ戻る導線は周回の帯の詳細にある [data-quick-run-progress-back] を使う
    //   (ユーザー指摘「止めないでもホームに戻れて自動的に周回も終わるようにしたい」)。
    // 周回の進み具合の帯は、今は最初から開いている。閉じているときだけ見出しを押して開く
    // (2026-09-27・開いているのに押して閉じてしまい、「バトルへ戻る」が消えて止まっていた)
    await page.evaluate(() => { const h = document.querySelector('[data-quick-run-progress-header] button, [data-quick-run-progress] button'); if (h && h.getAttribute('aria-expanded') !== 'true') h.click(); });
    await page.waitForTimeout(400);
    await clickSelector('[data-quick-run-progress-back]');
    await page.waitForTimeout(2000);
    const afterRhythm = await readProgress();
    // WAVE10のあと次の周へ入るとWAVEが1へ戻る。「減った」もまた進んだ証拠として数える
    const advancedInRhythm = advanced(before, afterRhythm);
    check('モンビーを開いているあいだも周回が進む', advancedInRhythm,
      `W${before.wave}/T${before.turn} → W${afterRhythm.wave}/T${afterRhythm.turn}`);
    // AUTO ボタンは、WAVE を倒した直後の「ステータスアップ！」の画面が出ているあいだだけ消える(2026-10-21 戻った直後に重なって落ちていた)。
    // 戻れているかは、AUTO が出るまで少し待ってから見る
    check('モンビーからクイックのバトルへ戻れる', await page.waitForFunction(() => !!document.querySelector('button[aria-label^="AUTO"]'), { timeout: 10000 }).then(() => true, () => false));
    // ★戻れるだけでは足りない。戻ったあとも動き続けるかを必ず見る
    //   (2026-09-14・ユーザー報告「モンビークイックからバトルに戻ると
    //    バトルが進行しなくなる / アプリ閉じ直さないと、モンビーに戻っても
    //    オートバトル進んでなかった」)。
    //   画面(gameState)とランの段階(runStage)がずれると runProgressAllowed が
    //   false のまま戻らず、AUTOの3つのループが全部止まる。知らせは何も出ないので、
    //   「戻れた」ところまでの検査では素通りしてしまっていた。
    const afterBackWatch = await watchProgress();
    check('バトルへ戻ったあとも周回が進む（戻ると止まる不具合の再発を見張る）', afterBackWatch.ok, afterBackWatch.detail);
    // 戻ってからもう一度モンビーへ入っても進み続けること。
    // 報告では「モンビーに戻ってもオートバトル進んでなかった」ので、往復でも見る
    await clickSelector('[data-quick-to-rhythm]');
    // 入るとまずモードえらび(2026-10-03)。あとで周回の帯から「バトルへ戻る」を押すので、ソロライブで曲えらびまで進めておく
    await page.waitForSelector('[data-rhythm-mode-solo]', { timeout: 15000 }).catch(() => {});
    await clickSelector('[data-rhythm-mode-solo]');
    await page.waitForTimeout(600);
    const backInRhythmWatch = await watchProgress();
    check('バトルへ戻ったあと、もう一度モンビーへ入っても進む', backInRhythmWatch.ok, backInRhythmWatch.detail);

    // ---- ⑤ 超省エネでもモンビーへ行ける ----
    // 超省エネは画面ごと簡易表示へ差し替わる。入口を通常のバトル画面にしか置いていなかったため
    // 「超省エネではまだいけない」状態だった(2026-09-06・ユーザー報告)
    //
    // ★ここへ来た時点では、直前の往復チェックでモンビーにいる。
    //   省エネボタンはバトル画面にしかないので、先にバトルへ戻す。
    //   戻さずに探していたため「ボタンが見つからない」で2本とも落ち続けていた
    //   (往復チェックを足したときに戻す手順を入れ忘れた。本体は壊れていない)
    // 周回の進み具合の帯は、今は最初から開いている。閉じているときだけ見出しを押して開く
    // (2026-09-27・開いているのに押して閉じてしまい、「バトルへ戻る」が消えて止まっていた)
    await page.evaluate(() => { const h = document.querySelector('[data-quick-run-progress-header] button, [data-quick-run-progress] button'); if (h && h.getAttribute('aria-expanded') !== 'true') h.click(); });
    await page.waitForTimeout(400);
    await clickSelector('[data-quick-run-progress-back]');
    await page.waitForTimeout(2000);
    check('超省エネを試す前に、バトル画面へ戻れている',
      await page.waitForFunction(() => !!document.querySelector('button[aria-label^="AUTO"]'), { timeout: 10000 }).then(() => true, () => false));
    const ecoLabel = () => page.evaluate(() => document.querySelector('button[aria-label^="省エネ"]')?.getAttribute('aria-label'));
    await cycleLabelTo('省エネ', '省エネ 超', 4);
    check('超省エネに切り替えられる', (await ecoLabel()) === '省エネ 超', await ecoLabel());
    check('超省エネの画面にもモンビーへの入口が出る',
      await page.evaluate(() => !!document.querySelector('[data-ultra-battle-view] [data-quick-to-rhythm]')));
    await clickSelector('[data-quick-to-rhythm]');
    // モンヒロビートは入るとまずモードえらび(2026-10-03)。出ていたらソロライブを押して曲えらびへ
    await page.waitForSelector('[data-rhythm-mode-solo],[data-rhythm-demo-start],[data-rhythm-demo-home]',{timeout:30000}).catch(()=>{});await page.evaluate(()=>document.querySelector('[data-rhythm-mode-solo]')?.click());
    await page.waitForFunction(() => !!document.querySelector('[data-rhythm-demo-home]'), { timeout: 15000 }).catch(() => {});
    await dismissOverlays();
    check('超省エネからモンビーへ移れる', await onRhythmHome());
    // 超省エネの暗幕はバトルを見ないためのもの。モンビーでは外れていないと譜面が暗くて遊べない
    check('モンビーでは超省エネの暗幕が外れている',
      await page.evaluate(() => !document.querySelector('[data-ultra-eco-session-dimmer]')));

    // ---- ⑥ 周回を止めずにHOMEへ戻れる(2026-09-13・ユーザー指摘
    //      「止めないでもホームに戻れて自動的に周回も終わるようにしたい」) ----
    // それまでは「⚔ バトルへ戻る」しかできず、バトルで∞を切ってからHOMEへ、という
    // 2工程だった。いまは曲えらびの「戻る」がそのままHOMEで、周回はその場で締まる。
    // 周回を締めてHOMEへ戻るボタンは、2026-10-03にモードえらびの左上へ移った。曲えらびの「←」でモードえらびへ戻ってから押す
    await clickSelector('[data-rhythm-song-select-back]');
    await page.waitForFunction(() => !!document.querySelector('[data-rhythm-mode-select]'), { timeout: 10000 }).catch(() => {});
    check('周回中の戻るボタンが「終わる」と分かる見た目になっている',
      await page.evaluate(() => {
        const back = document.querySelector('[data-rhythm-back]');
        return !!back && back.getAttribute('data-quick-run-finishing') === '1'
          && (back.getAttribute('aria-label') || '').includes('ホームへ戻る');
      }));
    const beforeHome = await readProgress();
    const exitStartedAt = Date.now();
    await clickSelector('[data-rhythm-back]');
    // ★押したらすぐHOMEへ抜ける。やることは報酬の付与と記録だけで、どちらも端末の中で完結する
    //   (クイックは全国ランキング対象外なので、網を待つ処理は入らない)。
    //   進んでいるターンの演出は returnToHome がランの世代を1つ進めて止めるので、待たない
    //   (2026-09-14・ユーザー指摘「待ち時間が長くてストレス / もっと良い方法ない？」。
    //    それまでは終わるのを待っていて、実測で3〜6秒かかっていた)。
    await page.waitForFunction(() => !document.querySelector('[data-rhythm-mode-select]') && !document.querySelector('[data-rhythm-demo-home]'), { timeout: 25000 }).catch(() => {});
    const exitMs = Date.now() - exitStartedAt;
    check('押したらすぐHOMEへ抜ける(待たされない)', exitMs < 2000, `${exitMs}ms`);
    await page.waitForFunction(() => (document.body.innerText || '').includes('モンヒロビート'), { timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(1200);
    check('周回中でもそのままHOMEへ戻れる',
      await page.evaluate(() => !document.querySelector('[data-rhythm-demo-home]')
        && !document.querySelector('[data-rhythm-mode-select]')
        && (document.body.innerText || '').includes('モンヒロビート')),
      await page.evaluate(() => (document.body.innerText || '').replace(/\s+/g, ' ').slice(0, 60)));
    // 戻ったあとに周回が残っていないこと(帯もバトルの段階も消えている)
    check('戻ると周回も終わっている',
      await page.evaluate(() => !document.querySelector('[data-quick-run-progress-header]')
        && !document.querySelector('[data-quick-run-progress]')
        && !document.querySelector('button[aria-label^="AUTO"]')),
      `戻る前 W${beforeHome.wave}/T${beforeHome.turn}`);

    // ---- ⑦ HOMEへ戻ったあと、もう一度周回を始めても回る ----
    // 2026-09-14・ユーザー報告「モンビー入る→ホーム戻る→モンビー入る→止まる→
    //   バトル入ってみる→いないはずの距離枠で攻撃してるモーションを発見」。
    // ★HOMEへ戻ると abandonRunAnimations が世代を進める。すると走っていた
    //   await battleWait は二度と先へ進まず、その先の finally も走らない。
    //   そこで下ろすはずだった「実行中の印」(autoTurnRunningRef など)は ref なので
    //   applyResetAllState でも戻らず、次のランへ持ち越される。
    //   するとAUTOのループが毎回「まだ実行中」と誤解して弾かれ、一度も回らない。
    //   知らせは何も出ないので「バトル画面のまま、ただ動かない」になり、
    //   アプリを閉じ直すまで直らない。**周回を2回始めないと出ない**ので、
    //   1回だけ回す検査では素通りしていた。
    const restarted = await startQuickInfinityRun();
    check('HOMEへ戻ったあと、もう一度クイック∞周回を始められる', restarted);
    if (restarted) {
      const secondWatch = await watchProgress();
      check('2回目の周回もちゃんと進む（実行中の印の持ち越しで止まらない）', secondWatch.ok, secondWatch.detail);
    }

    check('操作中に致命的なJSエラーが出ない', fatal.length === 0, fatal.slice(0, 2).join(' / '));
  } finally {
    await browser.close();
  }

  const ng = results.filter((r) => !r).length;
  console.log(`\n${results.length - ng}/${results.length} 項目OK（見た目の寸法はこの環境では測れないため未確認）`);
  process.exit(ng ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });

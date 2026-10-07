// はじめて遊ぶ人: 何も保存されていないブラウザで開き、名前(モンヒロくん)を入れて、
// 最初の案内を通って HOME へ着くまでを見る。いちばん大事な入口なので、手数と時間を測る。
//
// 進め方は人と同じ: 入力欄があれば名前を打つ / 「次へ」「決定」のような進むボタンを優先して押す /
// それが無ければ、見えているボタンの中から選ぶ(助手を選ぶ画面など)。

const FORWARD = /^(TAP TO START|トップ画面へ進む|次へ|つぎへ|はじめる|始める|決定！?|けってい|OK|保存(する)?|この名前で(始める|決定)?|これにする|この子にする|.+を選ぶ$|選ぶ|えらぶ|スタート|START|進む|すすむ|わかった！?|はい|受け取る|確認)/;
// 「はじめての設定」で、決定より先に済ませること(名前 → アイコン)。押したものは2度押さない
const SETUP = [/^名前を決める$/, /^アイコンを選ぶ$/];
// 進まないボタン。ほかに押せるものがあるときは選ばない
const BACKWARD = /^(キャンセル|閉じる|とじる|戻る|もどる|×)$|話しかける|説明を開く/;

async function newPlayerScenario(s, { maxSteps = 150 } = {}) {
  const { page, rand } = s;
  const t0 = Date.now();
  await s.boot({ toHome: false });
  let reached = false, stepsTaken = 0, typed = 0;
  const done = new Set();
  for (; stepsTaken < maxSteps; stepsTaken++) {
    s.state.step += 1;
    // 「はじめての設定」(名前・アイコン)を終え、案内の会話も抜けたら成功。
    // ★そのあと助手が最初のバトルへ誘導するので、HOME に着くことは条件にしない
    if (await page.evaluate(() => {
      const onboarded = (() => { try { return JSON.parse(localStorage.getItem('mh_onboarded') || 'false') === true; } catch { return false; } })();
      const talking = [...document.querySelectorAll('[role="dialog"]')].some((d) => d.getBoundingClientRect().height > 0);
      return onboarded && !talking;
    })) { reached = true; break; }
    typed += await s.fillEmptyInputs();
    const list = await s.listButtons();
    if (!list.length) { await s.wait(800); continue; }
    const inDialog = await page.evaluate(() => [...document.querySelectorAll('[role="dialog"]')].some((d) => d.getBoundingClientRect().height > 0));
    const setup = !inDialog && SETUP.map((re) => list.find((b) => re.test(b.label) && !done.has(b.label))).find(Boolean);
    const forward = list.filter((b) => FORWARD.test(b.label) && !SETUP.some((re) => re.test(b.label)));
    const others = list.filter((b) => !BACKWARD.test(b.label));
    // 会話は人もスキップすることがある(半分くらい)。全部読むと長い
    const skip = list.find((b) => /^スキップ$/.test(b.label));
    // アイコンを選ぶ画面のように「進む」ボタンが無い一覧では、並んでいるものから1つ選ぶ
    const pick = setup || (skip && rand() < 0.5 ? skip : forward.length ? forward[0]
      : others.length ? others[Math.floor(rand() * others.length)] : list[Math.floor(rand() * list.length)]);
    if (setup) done.add(setup.label);
    await s.tap(pick, 'はじめての案内');
    await s.inspect();
  }
  const ms = Date.now() - t0;
  if (!reached) await s.addIssue('進めない', `はじめての人が ${maxSteps}手押しても「はじめての設定」を終えられない`);
  else if (stepsTaken > 60) await s.addIssue('たどり着けない', `はじめての設定を終えるまで ${stepsTaken}手かかる(長い)`);
  const name = await page.evaluate(() => { try { return JSON.parse(localStorage.getItem('mh_breeder_name') || 'null'); } catch { return null; } });
  if (reached && name !== s.BOT_NAME) await s.addIssue('進めない', `打った名前が保存されていない(保存値: ${JSON.stringify(name)})`);
  await s.shot('new-player-setup-done');
  return { ok: reached, note: reached ? `${stepsTaken}手・${(ms / 1000).toFixed(0)}秒ではじめての設定を終えた(名前を${typed}回入力)` : 'はじめての設定を終えられない', stats: { reached, stepsTaken, ms } };
}

module.exports = { newPlayerScenario };

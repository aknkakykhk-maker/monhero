// ランキング係: 音ゲー係が送った記録(にせの Supabase が受け止めたもの)と、名前の長さがまちまちな
// ほかのプレイヤーの記録を並べた状態でランキングを開き、
//   ・自分(モンヒロくん)の記録が見えるか
//   ・人がたくさん並んでも、名前が長くても、崩れたりはみ出したりしないか
//   ・ランキングの中のタブを切り替えても困らないか
// を見る。並べる記録はボットのブラウザの中だけにあり、本物のランキングへは何も送らない(CLAUDE.md ⑦)。
const { openSoloLive } = require('./rhythm');

// ブリーダー名は10文字まで(60-app.jsx の NameEditModal maxLength={10})。いちばん幅をとる名前も混ぜる
const RIVAL_NAMES = ['ＷＷＷＷＷＷＷＷＷＷ', 'MMMMMMMMMM', 'あいうえおかきくけこ', '🐉🐉🐉🐉🐉', 'モッチー大好き', 'リズムの達人', 'ハム', 'Ｚ', 'すえぞー', 'ゴーレム使い'];

// 自分の記録をもとに、ほかのプレイヤーの記録を作る(列の形はゲームが送ったものと同じにする)
function rivalRows(botRows) {
  const rows = [];
  botRows.forEach((row, k) => {
    const base = Number(row.score) || 1000;
    for (let i = 0; i < 24; i++) {
      const rate = 1 + (12 - i) * 0.02;
      rows.push({ ...row, id: 900000 + k * 100 + i, // 同じ名前は1人にまとめられることがあるので、一巡したあとは番号つきの別人にする
      user_name: i < RIVAL_NAMES.length ? RIVAL_NAMES[i] : `ライバル${i}`,
        score: Math.max(1, Math.round(base * rate)) });
    }
  });
  return rows;
}

async function rankingScenario(s, { rhythm } = {}) {
  const botRows = (rhythm && rhythm.rows) || [];
  const table = s.supabase.tables.get('rankings') || [];
  table.push(...botRows, ...rivalRows(botRows));
  s.supabase.tables.set('rankings', table);
  const picked = await openSoloLive(s, { songName: rhythm && rhythm.song, difficulty: rhythm && rhythm.difficulty });
  if (!picked) return { ok: false, note: '曲えらびまで行けない' };
  if (!(await s.tapLabel(/この曲の全国ランキング/, 2500))) {
    await s.addIssue('進めない', '曲えらびに「この曲の全国ランキング」が見つからない');
    return { ok: false, note: 'ランキングを開けない' };
  }
  await s.dismissOverlays(4);
  await s.wait(1200);
  await s.inspect();
  const text = ((await s.health()) || {}).text || '';
  const showsBot = text.includes(s.BOT_NAME);
  const rivalsShown = RIVAL_NAMES.filter((n) => text.includes(n)).length;
  if (botRows.length && !showsBot) await s.addIssue('ランキングに出ない', `送った記録(${picked.song} ${picked.difficulty})が、この曲の全国ランキングに見えない`);
  if (botRows.length && !rivalsShown) await s.addIssue('ランキングに出ない', 'ほかのプレイヤーの記録を並べたのに、1人も見えない');
  await s.shot('ranking-crowded');
  // ランキングの上に並ぶタブ(この曲・総合・週間・イベント)を1つずつ押す。
  // ★タブは窓ではなく画面の上部にある。戻る・更新・閉じるものは押さない
  const tabs = (await s.listButtons()).filter((b) => b.y < 160 && b.label.length <= 10
    && !/^(閉じる|とじる|×|戻る|もどる|キャンセル|OK|更新|←)$|話しかける|説明|^\(無名|^BUTTON$/.test(b.label));
  const pressed = [];
  for (const b of tabs.slice(0, 8)) {
    s.state.step += 1;
    await s.tap(b, 'ランキングのタブ');
    await s.wait(900);
    await s.inspect();
    pressed.push(b.label);
  }
  await s.backHome();
  const note = botRows.length
    ? `${picked.song} ${picked.difficulty}: 自分の記録が${showsBot ? '見えた' : '見えない'}・ほかの人 ${rivalsShown}/${RIVAL_NAMES.length}種の名前が見えた・タブ ${pressed.length}個`
    : `直前の演奏の記録が無いので、空のランキングを見た(${picked.song} ${picked.difficulty})・タブ ${pressed.length}個`;
  return { ok: !botRows.length || (showsBot && rivalsShown > 0), note, stats: { showsBot, rivalsShown, tabs: pressed } };
}

module.exports = { rankingScenario };

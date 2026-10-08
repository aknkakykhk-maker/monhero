// 反応の点検(feel.js)の途中経過・結果(partial-*.json / feel.json)を、組ごとに項目別の数へまとめる。
//   node tools/playbot/feel-summary.js --tags A-master-r3,A-expert-r3,B-touch-r3,C-cpu4   組(--tag)を指定
//   node tools/playbot/feel-summary.js ... --songs        曲ごとの行も出す
//   node tools/playbot/feel-summary.js ... --suspects     ゲームの不具合かもしれないもの(ずっと範囲内だったのに切れた・受付の端で切れた)の一覧
// 同じ曲が引き継ぎで複数のフォルダにあっても、曲ごとに1回だけ数える。
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..', 'out', 'playbot');
const argOf = (n) => { const i = process.argv.indexOf(`--${n}`); return i >= 0 ? process.argv[i + 1] : ''; };
const tags = String(argOf('tags')).split(',').filter(Boolean);
const shapesFile = argOf('shapes');   // 曲ごとのホールドの形(帯が途中で動く・細くなるか)。"曲|難易度|開始ms" → 1(動く)/0(一定) の JSON
const shapes = shapesFile ? JSON.parse(fs.readFileSync(shapesFile, 'utf8')) : null;
const bySong = process.argv.includes('--songs'), suspects = process.argv.includes('--suspects');
const sum = (rows, k) => rows.reduce((a, r) => a + (Number(r[k]) || 0), 0);
const groups = new Map();
for (const d of fs.existsSync(root) ? fs.readdirSync(root).sort() : []) {
  const m = d.match(/^feel-\d{8}-\d{4}-(.+)$/);
  if (!m) continue;
  // 組の名前(-r2 -r3 などの回し直しの印は外して、同じ種類の組へまとめる)
  // --tags に回し直しの印つきの名前(A-master-r4)を渡すと、その回だけ。印なし(A-master)なら、回し直しをまとめる
  const kind = tags.includes(m[1]) ? m[1] : m[1].replace(/-r\d+$/, '');
  if (tags.length && !tags.some((t) => t === m[1] || (!/-r\d+$/.test(t) && t === kind))) continue;
  for (const f of fs.readdirSync(path.join(root, d)).filter((x) => /^partial-.*\.json$/.test(x))) {
    let rows = []; try { rows = JSON.parse(fs.readFileSync(path.join(root, d, f), 'utf8')); } catch { continue; }
    const g = groups.get(kind) || new Map();
    for (const r of rows) if (r.ok) g.set(r.songId, r);
    groups.set(kind, g);
  }
}
for (const [kind, g] of groups) {
  const rows = [...g.values()];
  const pressed = sum(rows, 'pressed');
  const per = (k) => (pressed ? Math.round((sum(rows, k) / pressed) * 10000) / 10 : 0);
  console.log(`## ${kind}: ${rows.length}曲・${pressed}回押した`);
  console.log(`- 押したのに取れない ${sum(rows, 'tapMissed')}(千回あたり ${per('tapMissed')}) / 早取り ${sum(rows, 'stolen')} / 判定のずれ ${sum(rows, 'driftCount')}(千回あたり ${per('driftCount')})`);
  console.log(`- ホールド ${sum(rows, 'holds')} / 切れた ${sum(rows, 'holdBroken')}(受付の端 ${sum(rows, 'holdBrokenAtEdge')}/${sum(rows, 'edgeProbes')}) / ホールド中に近くを押した回数 ${sum(rows, 'nearPresses')}[同じ帯 ${sum(rows, 'nearSame')}・隣 ${sum(rows, 'nearAdjacent')}・離れた ${sum(rows, 'nearFar')}]`);
  console.log(`- 近くを押して切れた ${sum(rows, 'holdBrokenWithNear')} / 指がずっと受付範囲の中だったのに切れた ${sum(rows, 'holdBrokenAccepted')}(うち近く ${sum(rows, 'holdBrokenAcceptedWithNear')}) / ホールド中に押したタップの取れない ${sum(rows, 'tapMissedDuringHold')}`);
  if (shapes) {
    // 切れたホールドを、帯が一定のもの(指が受付範囲の中にいたのに切れたなら、ゲームの不具合候補)と、帯が途中で動く・細くなるもの(指を動かさない
    // ボットが外れただけ、のことが多い)に分ける
    const cuts = rows.flatMap((r) => (r.samples && r.samples.holdBroken || []).map((x) => ({ ...x, song: r.songId, title: r.title, d: r.difficulty, varying: shapes[`${r.songId}|${r.difficulty}|${Math.round(x.timeMs)}`] === 1 })));
    const constant = cuts.filter((x) => !x.varying), varying = cuts.filter((x) => x.varying);
    console.log(`- 切れたホールドの分け方: 帯が一定 ${constant.length}(うち受付の端 ${constant.filter((x) => x.edgeProbe).length}・指がずっと範囲内 ${constant.filter((x) => x.acceptedAlways).length}・近くを押した ${constant.filter((x) => x.nearPresses > 0).length}) / 帯が動く・細くなる ${varying.length}(うち受付の端 ${varying.filter((x) => x.edgeProbe).length})`);
    constant.forEach((x) => console.log(`  ⚠ 帯が一定なのに切れた ${x.title} ${x.d} ${x.timeMs}〜${x.endTimeMs}ms: ${x.cutAtMs}ms${x.edgeProbe ? '・受付の端' : ''}${x.acceptedAlways ? '・指はずっと範囲内' : ''}${x.nearPresses ? `・近く${x.nearPresses}回` : ''}(x${x.x}, y${x.y})`));
  }
  if (bySong) rows.forEach((r) => console.log(`  ・${r.title} ${r.difficulty}: 押した ${r.pressed} / 取れない ${r.tapMissed} / 早取り ${r.stolen} / ずれ ${r.driftCount} / ホールド ${r.holds} 切れた ${r.holdBroken}(端 ${r.holdBrokenAtEdge}) 近く ${r.nearPresses} 近くで切れた ${r.holdBrokenWithNear} 範囲内なのに切れた ${r.holdBrokenAccepted}`));
  if (suspects) rows.forEach((r) => (r.samples && r.samples.holdBroken || []).forEach((x) => console.log(`  ⚠ ${r.title} ${r.difficulty} ${x.timeMs}〜${x.endTimeMs}ms ${x.type}: ${x.cutAtMs}ms で切れた${x.edgeProbe ? '・受付の端で押さえた' : ''}${x.acceptedAlways ? '・指はずっと受付範囲の中' : ''}${x.nearPresses ? `・近くを${x.nearPresses}回押した(同じ帯${x.nearSame}・隣${x.nearAdjacent}・離れた${x.nearFar})` : ''}(x${x.x}, y${x.y})`)));
}
if (!groups.size) console.log('まとめる途中経過が見つからない');

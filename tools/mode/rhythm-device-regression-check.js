// 実機の記録の比べ(rhythm-device-regression.js)が、同じ端末・同じ曲どうしで「悪くなった」を見つけるかを、作り物の記録で見る(2026-10-07)。
//   ① 同じ曲でMISSが増えたら要注意 ② 難しい曲を多く遊んだだけ(前に無い曲)は比べない ③ ずれの中央値が動いたら要注意 ④ 記録が無くても落ちない
//   node tools/mode/rhythm-device-regression-check.js
const fs = require('fs'), os = require('os'), path = require('path');
const { spawnSync } = require('child_process');
const TOOL = path.join(__dirname, 'rhythm-device-regression.js');
let failed = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? '✓' : '✗'} ${name}${detail ? ` — ${detail}` : ''}`); if (!ok) failed++; };
const NOW = Date.parse('2026-10-07T12:00:00Z');
const row = (id, hoursAgo, song, misses, extra = {}) => ({ id, created_at: new Date(NOW - hoursAgo * 3600e3).toISOString(), device_key: 'devA00xxxx', app_build: 'x',
  platform: 'ios', song_id: song, difficulty: 'MASTER', note_count: 500, stats: { assist: false, misses, noInputMisses: 0, touchOnly: extra.touchOnly || 0, timing: extra.bias != null ? { biasMs: extra.bias } : {} } });
const runWith = (rows) => {
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'devreg-')), 'rows.jsonl');
  fs.writeFileSync(file, rows.map((r) => JSON.stringify(r)).join('\n') + '\n');
  const res = spawnSync('node', [TOOL, '--rows', file, '--now', String(NOW), '--recent', '1', '--base', '3', '--json'], { encoding: 'utf8' });
  return JSON.parse(res.stdout);
};
{
  const r = runWith([row(1, 60, 'songA', 6), row(2, 50, 'songA', 8), row(3, 5, 'songA', 17), row(4, 3, 'songB', 30)]);
  const a = r.compared.find((x) => x.song === 'songA MASTER');
  check('同じ曲でMISSが増えたら要注意', a && a.missWorse === true, a && `${a.missBefore}→${a.missNow}`);
  check('前に遊んでいない曲は比べない(難しい曲を多く遊んだだけで悪く見せない)', !r.compared.some((x) => x.song === 'songB MASTER'));
  check('要注意の数', r.flagged === 1, String(r.flagged));
}
{
  const r = runWith([row(1, 60, 'songA', 6), row(2, 5, 'songA', 7)]);
  check('少しの増え方は要注意にしない', r.flagged === 0);
}
{
  const r = runWith([row(1, 60, 'songA', 6, { bias: -5 }), row(2, 5, 'songA', 6, { bias: -40 })]);
  check('ずれの中央値が20ms以上動いたら要注意', r.compared[0] && r.compared[0].biasMoved === true);
}
{
  const r = runWith([{ id: 1, created_at: 'こわれた' }, { id: 2, stats: 5 }, row(3, 5, 'songA', 3, {}), { ...row(4, 60, 'songA', 3), stats: { assist: true, misses: 99 } }]);
  check('壊れた行・練習の行があっても落ちず、使わない', r.compared.length === 0 && r.plays.base === 0);
}
console.log(failed ? `\n${failed}件のNGがあります` : '\nすべてOK');
process.exit(failed ? 1 : 0);

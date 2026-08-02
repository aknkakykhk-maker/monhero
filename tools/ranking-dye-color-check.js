// ランキングの記録に載せる染色カラーが、実際の染色と同じ部位に付くかを確認する。
//
// colors は「何番目の部位か」を位置で表す配列で、染めていない部位は null が入る。
// 以前は記録を作るときに filter(Boolean) で空きを取り除いており、
// ["青", 未設定, "青"] が ["青","青"] に詰められていた。その結果、
// 2番目の部位(ピクシーなら白い部分)まで青くなり、3番目(体と翼)が元の色のまま残る、
// つまり「実際に染めた色とランキングに出る色が違う」状態になっていた。
//
// 位置がずれると見た目が変わるだけで例外は出ないため、気づけるのは目視だけになる。
// ここで部位を持つ全モンスターぶんを機械的に確かめる。
const fs = require('fs');
const path = require('path');
const { REPO_ROOT, loadDyeModule } = require('./harness');

const { rankingPartyColors, dyeRegionCount, MASU_COLOR_REGION_HUES } = loadDyeModule();

let failed = 0;
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failed++;
};

check('記録用の色を作る関数がある', typeof rankingPartyColors === 'function');

const baseIds = Object.keys(MASU_COLOR_REGION_HUES || {});
check('部位分割を持つモンスターが集まっている', baseIds.length > 0, `${baseIds.length}体`);

// ① 部位数ぶんの長さになること(短いと表示側で部位がずれる)
const wrongLength = baseIds.filter(id => rankingPartyColors(id, ['blue']).length !== dyeRegionCount(id));
check('部位数ぶんの長さにそろう', wrongLength.length === 0, wrongLength.join(', '));

// ② 飛び飛びに染めても位置が変わらないこと(これが今回の不具合そのもの)
const shifted = [];
for (const id of baseIds) {
  const n = dyeRegionCount(id);
  if (n < 3) continue;
  const input = Array.from({ length: n }, (_, i) => (i === 0 || i === n - 1) ? 'blue' : null);
  const out = rankingPartyColors(id, input);
  if (out[0] !== 'blue' || out[n - 1] !== 'blue' || out.slice(1, n - 1).some(Boolean)) {
    shifted.push(`${id}: ${JSON.stringify(input)} → ${JSON.stringify(out)}`);
  }
}
check('染めていない部位を飛ばしても位置がずれない', shifted.length === 0, shifted.slice(0, 4).join(' / '));

// ③ まったく染めていない場合は全部 null(記録側は colors を付けない判断に使う)
const notEmpty = baseIds.filter(id => rankingPartyColors(id, []).some(Boolean));
check('染めていなければ色が入らない', notEmpty.length === 0, notEmpty.join(', '));

// ④ 記録を作る箇所で色を詰めていないこと
const source = fs.readFileSync(path.join(REPO_ROOT, 'monster-hero/src/game-system.jsx'), 'utf8');
const submit = source.slice(source.indexOf('const submitLocalScore'), source.indexOf('const submitLocalScore') + 4000);
check('記録を作る箇所で色を詰めていない', !/colors[^\n]*filter\(Boolean\)/.test(submit),
  '色は rankingPartyColors を通すこと');
check('記録を作る箇所が rankingPartyColors を使っている', submit.includes('rankingPartyColors(s.id, s.colors)'));

console.log(failed ? `\n${failed}件のNGがあります` : '\nすべてOK');
process.exitCode = failed ? 1 : 0;

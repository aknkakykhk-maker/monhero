// ランキングの編成から開くモンスター詳細を確認する。
//
// ランキングの記録には画像を入れず、育て方(ステータス・間合い適性・固有技Lv)も
// 「表示に必要な最小限」だけを送る。技の中身はどの端末も同じデータを持っているので、
// 継承した固有技は元のモンスターIDとレベルだけ送り、見る側で組み立て直す。
// 送る値が欠けていたり、組み立て直しで別の値になったりすると、
// 他人の編成に「実際とは違う育て方」が表示されてしまう(見た目だけなので例外は出ない)。
// そのため往復させて一致を確かめる。
//
// 詳細を送るようになる前の記録には detail が無い。そのときは詳細を開けず
// 「情報なし」と出す決まりなので、その分岐が残っているかも見る。
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { REPO_ROOT, loadDyeModule } = require('./harness');

const web = path.join(REPO_ROOT, 'monster-hero');
const read = (rel) => fs.readFileSync(path.join(web, rel), 'utf8');

const ctx = {};
vm.createContext(ctx);
vm.runInContext([
  read('data/images/images-ally.js'),
  read('data/skills.js'),
  read('data/ally-monsters.js'),
  'globalThis.__x = { ALL_PLAYER_MONSTERS };',
].join('\n'), ctx);
const { ALL_PLAYER_MONSTERS } = ctx.__x;

const { rankingMasuDetail, rankingDetailToMasu, masuBondLevelInfo, getMonsterAptPct, formatAptBonus, DIST_APTITUDE_GRADES } = loadDyeModule();

let failed = 0;
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failed++;
};

check('記録用の詳細を作る関数がある', typeof rankingMasuDetail === 'function' && typeof rankingDetailToMasu === 'function');

// 実在するモンスターから、育て込んだマスモンを組み立てて往復させる
const ids = Object.keys(ALL_PLAYER_MONSTERS).filter(id => ALL_PLAYER_MONSTERS[id]?.unique);
check('固有技を持つモンスターが集まっている', ids.length >= 2, `${ids.length}体`);

const mismatched = [];
const sizes = [];
for (let i = 0; i < ids.length; i++) {
  const baseId = ids[i];
  const otherId = ids[(i + 1) % ids.length];
  const other = ALL_PLAYER_MONSTERS[otherId].unique;
  const masu = {
    id: 'local-1',
    baseId,
    name: `テスト${i}`,
    bondXp: 1234 + i * 77,
    rebirthCount: i % 4,
    levelCap: 30 + (i % 4) * 10,
    statPoints: { hp: 10 + i, atk: 5, def: 15, guts: 0 },
    // 間合い適性はグレードの文字の配列。数値ではない(ここを数値で書いていたために
    // 「文字を数に直すと全部0になる」不具合を取り逃していた)
    distApt: (() => {
      const grades = [...(ALL_PLAYER_MONSTERS[baseId].distAptitude || ['C','C','C','C'])];
      grades[i % 4] = 'M';
      grades[(i + 1) % 4] = 'B';
      return grades;
    })(),
    distAptPoints: 3,
    uniqueSkillLevels: { own: 2, 'inh:0': 4 },
    inheritedUniques: [{ ...other, monId: otherId, evoLevel: 4 }],
    fusionHistory: [{ subName: 'a' }, { subName: 'b' }],
    colors: ['blue', null, 'white'],
  };
  // 実際の通信と同じようにJSONを1往復させる(関数や undefined が混ざっていれば落ちる)
  const sent = JSON.parse(JSON.stringify(rankingMasuDetail(masu)));
  sizes.push(JSON.stringify(sent).length);
  const back = rankingDetailToMasu(baseId, sent, masu.colors);
  if (!back) { mismatched.push(`${baseId}: 組み立て直せない`); continue; }
  const same = (label, a, b) => { if (JSON.stringify(a) !== JSON.stringify(b)) mismatched.push(`${baseId} の${label}: ${JSON.stringify(a)} → ${JSON.stringify(b)}`); };
  same('名前', masu.name, back.name);
  same('絆XP', masu.bondXp, back.bondXp);
  same('転生回数', masu.rebirthCount, back.rebirthCount);
  same('レベル上限', masu.levelCap, back.levelCap);
  same('強化ステータス', masu.statPoints, back.statPoints);
  same('間合い適性', masu.distApt, back.distApt);
  // 画面に出るのはグレードそのものではなく、そこから引いた距離補正(%)。
  // 送り方を間違えると例外は出ず、静かに「全距離0%」になるのでここで直接見る
  same('距離補正(%)', getMonsterAptPct({ distAptitude: masu.distApt }), getMonsterAptPct({ distAptitude: back.distApt }));
  same('合流ボーナスの間合い表示', formatAptBonus({ distAptitude: masu.distApt }), formatAptBonus({ distAptitude: back.distApt }));
  same('強化ポイント', masu.distAptPoints, back.distAptPoints);
  same('固有技Lv', masu.uniqueSkillLevels, back.uniqueSkillLevels);
  same('染色', masu.colors, back.colors);
  same('合体回数', masu.fusionHistory.length, back.fusionHistory.length);
  same('継承した技', [otherId], back.inheritedUniques.map(u => u.monId));
  same('継承した技のLv', [4], back.inheritedUniques.map(u => u.evoLevel));
  // 絆レベルは絆XPから出しているので、往復後も同じレベルになること
  same('絆レベル', masuBondLevelInfo(masu).level, masuBondLevelInfo(back).level);
}
check('育て方が往復しても変わらない', mismatched.length === 0, mismatched.slice(0, 4).join(' / '));

// 記録が重くならないこと(以前ここへ画像を入れて読み込みが終わらなくなったことがある)
const maxSize = Math.max(...sizes);
check('1体ぶんの詳細が十分小さい', maxSize < 600, `最大 ${maxSize} バイト（4体で最大 ${maxSize * 4} バイト）`);

// 壊れた記録・知らないモンスターでも落ちないこと
const robust = [
  ['詳細なし', () => rankingDetailToMasu(ids[0], null, [])],
  ['空の詳細', () => rankingDetailToMasu(ids[0], {}, [])],
  ['知らない血統', () => rankingDetailToMasu('__unknown__', { v: 1 }, [])],
  ['知らない継承技', () => rankingDetailToMasu(ids[0], { v: 1, inherited: [{ monId: '__unknown__', level: 3 }] }, [])],
  ['数値でない値', () => rankingDetailToMasu(ids[0], { v: 1, bondXp: 'x', statPoints: { hp: null }, distApt: 'x', inherited: 'x' }, [])],
];
const threw = [];
for (const [label, run] of robust) { try { run(); } catch (e) { threw.push(`${label}: ${e.message}`); } }
check('壊れた記録でも落ちない', threw.length === 0, threw.join(' / '));
const unknownInherit = rankingDetailToMasu(ids[0], { v: 1, inherited: [{ monId: '__unknown__', level: 3 }] }, []);
check('知らない継承技は出さない', unknownInherit && unknownInherit.inheritedUniques.length === 0);

// 間合い適性がグレードとして読めない記録(数値に潰してしまった初期の記録など)は、
// 「全距離C」という実在しない姿を作らず、血統本来の適性で出す(distAptをnullにする)
const brokenApt = rankingDetailToMasu(ids[0], { v: 1, distApt: [0, 0, 0, 0] }, []);
check('読めない間合い適性は血統本来の値に任せる', brokenApt && brokenApt.distApt === null,
  brokenApt ? JSON.stringify(brokenApt.distApt) : '組み立て直せない');
const goodApt = rankingDetailToMasu(ids[0], { v: 1, distApt: ['M', 'C', 'C', 'C'] }, []);
check('読める間合い適性はそのまま残す', goodApt && JSON.stringify(goodApt.distApt) === JSON.stringify(['M','C','C','C']));

// --- 画面側 ---
const source = read('src/game-system.jsx');
const has = (t) => source.includes(t);
check('記録にマスモンのときだけ詳細を付ける',
  has('const detail = s.masuId ? rankingMasuDetail(getMasuMon(s.masuId)) : null;') && has('...(detail ? { detail } : {})'));
check('編成の各モンスターに詳細ボタンがある',
  has('onClick={()=>{ if (m?.detail) setRankingMonsterDetail(m); }}') && has('disabled={!m?.detail}'));
check('詳細が無い古い記録は押せず、理由が出る', has('情報<br/>なし'));
check('表示はマスモン詳細と同じ共通実装を使う',
  has("statTitle: '現在のステータス(強化分込み)'") && /rankingMonsterDetail&&\(\(\)=>\{[\s\S]{0,4000}renderMonsterDetailInfo\(mon,/.test(source));
check('マスモン名と血統名の両方を出す', /rankingMonsterDetail&&\(\(\)=>\{[\s\S]{0,4000}マスモン・元は\{base\.name\}/.test(source));
// 他人の記録なので、こちらから育て直せてしまってはいけない
const modal = source.slice(source.indexOf('{rankingMonsterDetail&&(()=>{'), source.indexOf('{/* DECK INFO */}'));
check('他人のマスモンを操作できない',
  !modal.includes('setMasuEnhanceFrom') && !modal.includes('setShowMasuRenameModal') && !modal.includes('強化する'));

console.log(failed ? `\n${failed}件のNGがあります` : '\nすべてOK');
process.exitCode = failed ? 1 : 0;

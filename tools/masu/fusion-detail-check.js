// 合体詳細ページと、ランキングへ載せる合体履歴・総合力スナップショットを確認する。
//
// 合体詳細は「その個体がどんな合体を重ねて今に至ったか」を見る場所で、
// モンスター詳細(いまの姿)とは役割を分けてある。自分のマスモンからも、
// ランキングの他人の個体からも、同じ1つの実装へ入る決まり。
//
// いちばん怖いのは「実際には残っていない履歴を、それらしく作って見せてしまう」こと。
// 古いランキングの記録は合体回数しか持っていないので、そこから相手や日時を
// でっち上げないこと・総合力が無いのに0点と出さないことを機械的に確かめる。
const fs = require('fs');
const path = require('path');

const { REPO_ROOT, loadDyeModule } = require('../harness');
const web = path.join(REPO_ROOT, 'monster-hero');
const source = fs.readFileSync(path.join(web, 'src/game-system.jsx'), 'utf8');
const compiled = fs.readFileSync(path.join(web, 'game-system.compiled.js'), 'utf8')
  .replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));

const {
  RANKING_DETAIL_VERSION, RANKING_FUSION_MAX,
  rankingMasuDetail, rankingDetailToMasu,
  normalizeFusionHistory, fusionHistoryHasDetail,
  mergeMasuIntoMon, monsterPowerOf, masuPowerOf,
} = loadDyeModule();

let failed = 0;
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failed++;
};

// ===== 1. 合体履歴の読み取り =====
// 実際に保存されているのは executeMasuFusion が積む6項目だけ
const fusionEntry = (over = {}) => ({
  subName: 'たろう', subBaseId: 'Suezo', subBondLevel: 12, xpGained: 12000,
  inherited: false, timestamp: 1770000000000, ...over,
});
const localMasu = {
  id: 'm1', baseId: 'Golem', name: 'ごれ', bondXp: 40000, levelCap: 40,
  rebirthCount: 2, reincarnateCount: 1, distAptPoints: 3, distApt: ['A', 'E', 'G', 'G'],
  statPoints: { hp: 300, atk: 30, def: 12, guts: 9 }, uniqueSkillLevels: { own: 3, 'inh:0': 4 },
  inheritedUniques: [{ monId: 'Suezo', evoLevel: 4, sourceMasuName: 'じろう', name: 'サイコキネシス' }],
  fusionHistory: [
    fusionEntry({ subName: 'たろう', timestamp: 1770000000000 }),
    fusionEntry({ subName: 'じろう', subBaseId: 'Suezo', inherited: true, xpGained: 8000, subBondLevel: 15, timestamp: 1770100000000 }),
    fusionEntry({ subName: 'さぶろう', subBaseId: 'Ham', xpGained: 5000, subBondLevel: 10, timestamp: 1770200000000 }),
  ],
};

const localHistory = normalizeFusionHistory(localMasu);
check('保存されている合体履歴を全部読める', localHistory.length === 3, `${localHistory.length}件`);
check('古い合体が1、新しい合体が最後', localHistory[0].order === 1 && localHistory[2].order === 3);
check('保存されている項目がそのまま出る',
  localHistory[0].subName === 'たろう' && localHistory[0].subBaseId === 'Suezo'
  && localHistory[0].subBondLevel === 12 && localHistory[0].xpGained === 12000
  && localHistory[0].timestamp === 1770000000000);
check('相手の種の名前を種データから引く', localHistory[2].subBaseName === 'ハム', String(localHistory[2].subBaseName));
check('継承した合体だけ継承技が付く',
  localHistory[1].inherited === true && !!localHistory[1].inheritedUnique
  && localHistory[0].inherited === false && localHistory[0].inheritedUnique === null);
check('継承技は主が持っている継承技から引く', localHistory[1].inheritedUnique.monId === 'Suezo');

// 壊れた履歴・空の履歴でも落ちない
check('壊れた履歴でも落ちない', (() => {
  try {
    const broken = normalizeFusionHistory({ fusionHistory: [null, 'x', {}, { subBaseId: 'NoSuchMon' }, { xpGained: 'あ' }] });
    return broken.length === 5 && broken.every(h => h && typeof h === 'object');
  } catch (e) { return false; }
})());
check('保存が無ければ0件', normalizeFusionHistory({}).length === 0 && normalizeFusionHistory(null).length === 0);
check('中身のある履歴かどうかを見分けられる',
  fusionHistoryHasDetail(localHistory) === true
  && fusionHistoryHasDetail(normalizeFusionHistory({ fusionHistory: [{}, {}, {}] })) === false);
check('知らない種の履歴から名前を作らない', (() => {
  const h = normalizeFusionHistory({ fusionHistory: [{ subBaseId: 'NoSuchMon', inherited: true }] })[0];
  return h.subBaseId === null && h.subBaseName === null && h.inheritedUnique === null;
})());

// ===== 2. ランキングの記録 =====
check('ランキング詳細のバージョンが上がっている', RANKING_DETAIL_VERSION >= 3, `v${RANKING_DETAIL_VERSION}`);
const detail = rankingMasuDetail(localMasu);
check('記録にバージョンが入る', detail.v === RANKING_DETAIL_VERSION);

// --- 総合力スナップショット ---
const livePower = masuPowerOf(localMasu);
check('記録に総合力スナップショットが残る', Number.isFinite(detail.power) && detail.power > 0, String(detail.power));
check('総合力は共通関数と同じ値', detail.power === livePower, `記録=${detail.power} / 共通=${livePower}`);

// --- 合体履歴 ---
check('記録に合体回数が残る', detail.fusionCount === 3);
check('記録に合体履歴の中身が残る', Array.isArray(detail.fusion) && detail.fusion.length === 3, `${detail.fusion.length}件`);
check('合体履歴に絵・技の中身を入れていない', (() => {
  const json = JSON.stringify(detail);
  return !/data:|base64|iconUrl|imgUrl|faceIconUrl|effectDesc|\.png|\.PNG/.test(json);
})(), JSON.stringify(detail).slice(0, 0));
check('合体履歴の項目名は短縮キーだけ', detail.fusion.every(e => Object.keys(e).every(k => ['b', 'n', 'l', 'x', 'i', 't'].includes(k))),
  JSON.stringify(detail.fusion[0]));
check('日時は秒で持つ', detail.fusion[0].t === Math.floor(1770000000000 / 1000));

// --- 上限 ---
const manyMasu = { ...localMasu, fusionHistory: Array.from({ length: 30 }, (_, i) => fusionEntry({ subName: `s${i}`, timestamp: 1770000000000 + i * 1000 })) };
const manyDetail = rankingMasuDetail(manyMasu);
check('合体履歴は上限で切る', manyDetail.fusion.length === RANKING_FUSION_MAX, `${manyDetail.fusion.length}件 / 上限${RANKING_FUSION_MAX}`);
check('上限で切っても合体回数は本当の数', manyDetail.fusionCount === 30);
check('切るのは古いほうから(新しい履歴が残る)', manyDetail.fusion[manyDetail.fusion.length - 1].n === 's29');

// ===== 3. 記録から復元 =====
const restored = rankingDetailToMasu('Golem', detail, []);
check('復元したマスモンに合体履歴が戻る', Array.isArray(restored.fusionHistory) && restored.fusionHistory.length === 3);
const restoredHistory = normalizeFusionHistory(restored);
check('復元した履歴が元と同じ',
  restoredHistory.map(h => [h.subName, h.subBaseId, h.subBondLevel, h.xpGained, h.inherited, h.timestamp].join('|')).join(' / ')
  === localHistory.map(h => [h.subName, h.subBaseId, h.subBondLevel, h.xpGained, h.inherited, h.timestamp].join('|')).join(' / '),
  restoredHistory.map(h => `${h.subName}:${h.xpGained}`).join(','));
check('復元した継承技も戻る', restoredHistory[1].inherited === true && !!restoredHistory[1].inheritedUnique);
check('復元した総合力スナップショットが残る', restored.powerSnapshot === livePower, String(restored.powerSnapshot));
// 転生回数(v3で追加)。詳細の上部サマリーで「転生 +N」を出すのに要る
check('記録に転生回数が残る', detail.reincarnateCount === 1, String(detail.reincarnateCount));
check('復元した転生回数が元と同じ', restored.reincarnateCount === localMasu.reincarnateCount, String(restored.reincarnateCount));
check('限界突破と転生を取り違えていない',
  detail.rebirthCount === localMasu.rebirthCount && detail.reincarnateCount === localMasu.reincarnateCount,
  `限界突破=${detail.rebirthCount} 転生=${detail.reincarnateCount}`);
const restoredMany = rankingDetailToMasu('Golem', manyDetail, []);
check('上限で切った記録でも本当の合体回数が分かる', restoredMany.fusionRecordedCount === 30);

// ===== 4. 古い記録(v1)との互換 =====
// v1 は power も fusion も持たない。合体回数だけが残っている
const oldDetail = { v: 1, name: 'ふるいこ', bondXp: 12000, rebirthCount: 1, levelCap: 35,
  statPoints: { hp: 100, atk: 10, def: 5, guts: 5 }, distApt: ['B', 'C', 'D', 'C'], distAptPoints: 2,
  uniqueLevel: 2, inherited: [{ monId: 'Suezo', level: 3 }], fusionCount: 3 };
let oldRestored = null;
check('古い記録でも落ちない', (() => { try { oldRestored = rankingDetailToMasu('Golem', oldDetail, []); return !!oldRestored; } catch (e) { return false; } })());
check('古い記録には総合力スナップショットが無い(0にしない)', oldRestored.powerSnapshot === null, String(oldRestored.powerSnapshot));
check('転生回数を持たない古い記録は0にする(推測しない)', oldRestored.reincarnateCount === 0, String(oldRestored.reincarnateCount));
check('古い記録でも合体回数は分かる', oldRestored.fusionHistory.length === 3 && oldRestored.fusionRecordedCount === 3);
check('古い記録から架空の合体履歴を作らない',
  fusionHistoryHasDetail(normalizeFusionHistory(oldRestored)) === false,
  JSON.stringify(normalizeFusionHistory(oldRestored)[0]));
check('古い記録でも共通式で総合力を計算できる', (() => {
  const p = monsterPowerOf(mergeMasuIntoMon(oldRestored));
  return Number.isFinite(p) && p > 0;
})());
check('壊れた記録でも落ちない', (() => {
  try {
    for (const bad of [{ v: 2, fusion: 'x' }, { v: 2, fusion: [null, 3, {}] }, { v: 2, power: -5 }, { v: 2, power: 'あ' }, {}]) {
      const r = rankingDetailToMasu('Golem', bad, []);
      if (!r || r.powerSnapshot === 0) return false;
    }
    return true;
  } catch (e) { return false; }
})());
check('総合力が壊れていたらスナップショット無しにする',
  rankingDetailToMasu('Golem', { v: 2, power: -5 }, []).powerSnapshot === null
  && rankingDetailToMasu('Golem', { v: 2, power: 'あ' }, []).powerSnapshot === null);

// ===== 5. 記録の大きさ =====
const v1Like = { ...detail };
delete v1Like.power; delete v1Like.fusion; v1Like.v = 1;
const sizeV1 = JSON.stringify(v1Like).length;
const sizeV2 = JSON.stringify(detail).length;
const sizeMax = JSON.stringify(manyDetail).length;
console.log(`   記録1体ぶんの大きさ: v1相当=${sizeV1}バイト / v2(合体3回)=${sizeV2}バイト / v2(上限まで)=${sizeMax}バイト`);
check('1体ぶんの記録が小さいまま(合体3回で700バイト以内)', sizeV2 <= 700, `${sizeV2}バイト`);
check('合体が上限まであっても1体1.4KB以内', sizeMax <= 1400, `${sizeMax}バイト`);

// ===== 6. 画面の作り =====
for (const [label, code] of [['ソース', source], ['配信用JS', compiled]]) {
  check(`${label}: 合体詳細の共通実装がある`, code.includes('renderFusionDetailModal'));
  check(`${label}: 合体詳細を開く入口は共通のサマリー1か所`,
    (code.match(/setFusionDetail\(\{/g) || []).length === 1,
    `${(code.match(/setFusionDetail\(\{/g) || []).length}か所`);
  check(`${label}: モンスター詳細には合体のサマリーだけを置く`,
    /合体回数 /.test(code) && /合体詳細を見る/.test(code));
  // 合体詳細の本体だけを切り出して、上部サマリーの作りを見る
  const fusionStart = code.indexOf('renderFusionDetailModal');
  const fusionBody = fusionStart > 0 ? code.slice(fusionStart, code.indexOf('合体履歴', fusionStart)) : '';
  check(`${label}: 合体詳細の上部サマリーは詳細と同じ共通実装`, fusionBody.includes('renderMonsterSummaryHeader({'));
  check(`${label}: 合体詳細の総合力も呼び出し元から受け取ったものを使う`,
    /renderMonsterSummaryHeader\(\{[\s\S]{0,300}power[\s\S]{0,120}compact/.test(fusionBody)
    && !/monsterPowerOf/.test(fusionBody),
    fusionBody ? '' : '本体が見つからない');
  check(`${label}: 履歴は新しいものを上に出す`, /\.reverse\(\)/.test(code) && /新しい合体が上/.test(code));
  check(`${label}: 0件の言い回しがある`, code.includes('まだ合体履歴はありません'));
  check(`${label}: 古い記録の言い回しがある`, code.includes('詳細な合体履歴はこの記録には保存されていません'));
  check(`${label}: 合体詳細もSafe Areaを見て高さを決める`,
    /合体詳細[\s\S]{0,2500}safe-area-inset-bottom/.test(code));
  // ランキングは読むだけ。所有者だけの操作を渡していないこと
  const rankStart = code.indexOf('rankingMonsterDetail');
  const rankBlock = rankStart > 0 ? code.slice(code.indexOf('const member = rankingMonsterDetail'), code.indexOf('DECK INFO')) : '';
  check(`${label}: ランキングの詳細は読み取り専用で開く`, /readOnly: true/.test(rankBlock));
  check(`${label}: ランキングの詳細に所有者だけの操作を出さない`,
    !/onRename:/.test(rankBlock) && !/MASU_ENHANCE/.test(rankBlock) && !/deleteMasuMon/.test(rankBlock)
    && !/toggleDraftMonster/.test(rankBlock) && !/setFusionMainId/.test(rankBlock)
    && !/buildMasuBreakthrough/.test(rankBlock) && !/donate/i.test(rankBlock));
  check(`${label}: ランキングは記録時点の総合力を出す`, /powerSnapshot/.test(rankBlock) && /powerNote/.test(rankBlock));
  check(`${label}: 総合力が無い記録は参考値と断る`, code.includes('いまのデータで計算した参考値'));
  check(`${label}: 総合力が分からないときに0を出さない`, /known \? formatMonsterPower\(power\) : '—'/.test(code) || /known\s*\?\s*formatMonsterPower\(power\)\s*:\s*"—"/.test(code));
}

console.log(failed ? `\n${failed}件のNGがあります` : '\nすべてOK');
process.exit(failed ? 1 : 0);

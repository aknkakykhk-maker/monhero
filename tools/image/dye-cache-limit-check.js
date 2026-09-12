const TOOLS_DIR = require('path').join(__dirname, '..'); // tools/ 直下。分類フォルダから見た1つ上
// 染色の2つのキャッシュに上限があり、あふれたら「使っていないものから」捨てることを、
// 実際に入れて確かめる。
//
//   node tools/image/dye-cache-limit-check.js
//
// 【なぜ要るか】
// 染め上がりの画像(_dyeRecolorCache)と部位マスク(_dyeRegionMaskCache)は、どちらも
// 1件がdataURLを持つので重い。とくに部位マスクは1体ぶんで3枚。上限が無いと、
// キーが増え続ける場面(デバッグの染色マスクエディタで位置や倍率を動かすなど)で
// 際限なく積み上がり、iPhoneではメモリ不足で落ちる
// (docs/refactor/TECH_DEBT_AUDIT.md TD-10 / REFACTOR_MASTER_PLAN.md STEP 7)。
//
// 【見かた】
// 上限+1件を順に入れて、いちばん古いものだけが消えること。
// 途中で読んだものは「使った」ことになって新しい側へ回り、次にあふれても残ること。
// 上限そのものは「部位マスクを持つモンスターの数」より大きいこと
// (通常のプレイでは一度も捨てられない＝作り直しが起きない、という前提を守るため)。
const path = require('path');
const { loadDyeModule } = require(path.join(TOOLS_DIR, 'harness'));

const api = loadDyeModule();
let failed = 0;
const check = (label, ok, detail = '') => { console.log(`${ok ? 'OK' : 'NG'}: ${label}${detail ? ` — ${detail}` : ''}`); if (!ok) failed++; };

// 部位マスクを持つモンスターの数。上限はこれより大きくないと、
// ふつうに遊んでいるだけでマスクを作り直すことになる
const maskedMonsters = Object.entries(api.MASU_COLOR_REGION_HUES || {})
  .filter(([, v]) => Array.isArray(v) && v.length > 0).length;

const suites = [
  { name: '部位マスク', max: api.DYE_REGION_MASK_CACHE_MAX, get: api._dyeRegionMaskCacheGet, set: api._dyeRegionMaskCacheSet, needRoom: true },
  { name: '染め上がり', max: api.DYE_RECOLOR_CACHE_MAX, get: api._dyeRecolorCacheGet, set: api._dyeRecolorCacheSet, needRoom: false },
];

for (const suite of suites) {
  const { name, max, get, set } = suite;
  if (!Number.isFinite(max) || typeof get !== 'function' || typeof set !== 'function') {
    check(`${name}のキャッシュに上限と出し入れがある`, false, '上限またはget/setが取り出せません');
    continue;
  }
  check(`${name}のキャッシュに上限がある`, max > 0, `${max}件`);
  if (suite.needRoom) {
    check(`${name}の上限がモンスターの数より大きい(ふだんは作り直さない)`,
      max > maskedMonsters, `上限 ${max} / 部位マスクを持つモンスター ${maskedMonsters}体`);
  }

  // 上限ちょうどまで入れる
  for (let i = 0; i < max; i++) set(`k${i}`, `v${i}`);
  check(`${name}: 上限まではすべて残る`, get('k0') === 'v0' && get(`k${max - 1}`) === `v${max - 1}`);

  // k0 をいま読んだので、k0 は「新しい側」にいる。次に1件あふれさせると、
  // 消えるのは k0 ではなく、その次に古い k1 でなければならない
  set('overflow', 'vx');
  const k0 = get('k0'), k1 = get('k1'), overflow = get('overflow');
  // 無いときに undefined を返すか null を返すかは実装の好み。どちらも「消えた」とみなす
  check(`${name}: あふれたら古いものから捨てる`, k1 == null, k1 == null ? 'k1 が消えた' : `k1 が残っている(${k1})`);
  check(`${name}: 直前に使ったものは残る(使った順に並べ替えている)`, k0 === 'v0', k0 === 'v0' ? '' : 'k0 が消えてしまった');
  check(`${name}: 新しく入れたものは残る`, overflow === 'vx');

  // 同じキーを入れ直しても件数が増えないこと
  const before = max;
  for (let i = 0; i < 5; i++) set('overflow', `vx${i}`);
  check(`${name}: 同じキーの入れ直しで件数が増えない`, get('overflow') === 'vx4', `${before}件のまま`);
}

console.log(failed ? `${failed}件のNGがあります` : 'すべてOK');
process.exit(failed ? 1 : 0);

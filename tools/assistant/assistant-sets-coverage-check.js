// 助手ごとに分かれている表に、全員がそろっているかを見る(2026-10-31)。
// 社長「はじめてやったひとでみゅあ以外を選んでるのにみゅあのセリフをいう。新しく実装した助手を自動でみゅあになるようになってるんじゃない?」
//   → data/assistants.js の「助手ごとの台本」(はじめての設定・最初のあいさつ・村の案内・モンヒロビートの案内・バトルの誘い・呼び方の下書き)に
//     きき・ももすけしか入っておらず、あとから足したドラ・あつ・きゅうこ・ソラシドは、表に無いのでみゅあの台本へ落ちていた。
//
// 見るもの
//   ① data/assistants.js の `const ASSISTANT_..._SETS = {` の表すべてに、みゅあ以外の全助手(ASSISTANTS)の行がある
//      (表を新しく足したときも、名前が _SETS で終われば自動で見張る)
//   ② ふだんのセリフの場面(ASSISTANT_SCENES)に、全助手の行がある(無いとみゅあのセリフへ落ちる)
//   ③ 画面の部品で助手ごとに分けている表(フレンドの知らせ・MFバトルカードの台詞・結果の台詞・好きなモンスター・デッキ)に、全助手の行がある
//   node tools/assistant/assistant-sets-coverage-check.js
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.resolve(__dirname, '..', '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
let failed = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`); if (!ok) failed++; };

const assistantsSrc = read('monster-hero/data/assistants.js');
const ctx = { console: { log() {}, warn() {}, error() {} } };
vm.createContext(ctx);
vm.runInContext('var RELEASE_FLAGS = {};', ctx);
for (const f of ['data/images/images-ally.js', 'data/ally-monsters.js', 'data/breeder.js', 'data/assistants.js']) vm.runInContext(read(`monster-hero/${f}`), ctx, { filename: f });
const ids = vm.runInContext('ASSISTANTS.map(a => a.id)', ctx);
const others = ids.filter((id) => id !== vm.runInContext('DEFAULT_ASSISTANT_ID', ctx));
check('助手の一覧を読める', ids.length >= 7, ids.join(','));

// ① 助手ごとの台本の表
const setNames = [...assistantsSrc.matchAll(/^const (ASSISTANT_[A-Z0-9_]+_SETS) = \{/gm)].map((m) => m[1]);
check('助手ごとの台本の表を見つけられる', setNames.length >= 6, setNames.join(' '));
for (const name of setNames) {
  const table = vm.runInContext(name, ctx);
  const missing = others.filter((id) => !table || !table[id]);
  check(`${name} に全助手の行がある(無いとみゅあの台本になる)`, missing.length === 0, missing.length ? `抜け: ${missing.join(',')}` : '');
}

// ①-2 台本(ページの並び)は、みゅあの台本と骨組みが同じ(行の数・光らせる場所・ヘルプの行き先・誘い/断ったとき)。
//      言い回しだけを変え、案内の中身がずれないようにする。みゅあ以外の台本に「あたしはみゅあ」が混ざらない
const SCRIPT_BASE = { ASSISTANT_INTRO_SETS: 'ASSISTANT_INTRO', ASSISTANT_TUTORIAL_SETS: 'ASSISTANT_TUTORIAL',
  ASSISTANT_RHYTHM_TUTORIAL_SETS: 'ASSISTANT_RHYTHM_TUTORIAL', ASSISTANT_BATTLE_TUTORIAL_GUIDE_SETS: 'ASSISTANT_BATTLE_TUTORIAL_GUIDE' };
for (const [setName, baseName] of Object.entries(SCRIPT_BASE)) {
  const base = vm.runInContext(baseName, ctx), table = vm.runInContext(setName, ctx);
  const bad = [];
  for (const id of others) {
    const pages = table && table[id];
    if (!Array.isArray(pages)) continue;
    if (pages.length !== base.length) { bad.push(`${id}:${pages.length}行(みゅあは${base.length}行)`); continue; }
    pages.forEach((page, i) => {
      for (const key of ['spot', 'help', 'offer', 'declined']) if (JSON.stringify(page[key]) !== JSON.stringify(base[i][key])) bad.push(`${id}:${i + 1}行目の${key}`);
      if (typeof page.t !== 'string' || !page.t.trim()) bad.push(`${id}:${i + 1}行目が空`);
      if (/あたしはみゅあ|みゅあだよ/.test(page.t || '')) bad.push(`${id}:${i + 1}行目がみゅあの名のり`);
    });
  }
  check(`${setName} の骨組みがみゅあの台本と同じ`, bad.length === 0, bad.slice(0, 6).join(' / '));
}
{
  const table = vm.runInContext('ASSISTANT_ONBOARDING_SETS', ctx);
  const bad = others.filter((id) => table[id] && !['intro', 'name', 'icon', 'ready'].every((k) => table[id][k] && typeof table[id][k].t === 'string' && table[id][k].t.trim()));
  check('はじめての設定の台本は、どの助手も intro・name・icon・ready の4つがそろう', bad.length === 0, bad.join(','));
}

// ② ふだんのセリフの場面
const sceneMissing = vm.runInContext(`(() => { const out = [];
  for (const [scene, def] of Object.entries(ASSISTANT_SCENES)) {
    if (!def || !Array.isArray(def.lines) || !def.lines.length) continue;
    for (const id of ${JSON.stringify(others)}) if (!def.lines.some((l) => (l.who || DEFAULT_ASSISTANT_ID) === id)) out.push(scene + ':' + id);
  } return out; })()`, ctx);
check('ふだんのセリフの場面すべてに全助手のセリフがある(無いとみゅあのセリフになる)', sceneMissing.length === 0, sceneMissing.slice(0, 10).join(' '));

// ③ 画面の部品の、助手ごとの表(キーだけを見る)
const partsDir = 'monster-hero/src/parts';
const tables = [
  ['69-screen-home.jsx', 'FRIEND_NOTICE_LINES'],
  ['83-card-battle-lines.jsx', 'CARD_BATTLE_LINES'],
  ['91-card-battle-multi.jsx', 'CARD_PVP_RESULT_LINES'],
  ['82-card-battle-core.jsx', 'CARD_AI_FAVORITE'],
  ['82-card-battle-core.jsx', 'CARD_AI_DECKS'],
];
for (const [file, name] of tables) {
  const src = read(`${partsDir}/${file}`);
  const at = src.indexOf(`const ${name}`);
  if (at < 0) { check(`${file} の ${name} がある`, false); continue; }
  // 表の終わり(行頭の「});」か「};」)までを見る
  const rest = src.slice(at);
  const end = rest.search(/\n\}\)?;/);
  const body = end >= 0 ? rest.slice(0, end) : rest.slice(0, 20000);
  const missing = ids.filter((id) => !new RegExp(`(^|[\\s{,])${id}\\s*:`, 'm').test(body));
  check(`${file} の ${name} に全助手の行がある`, missing.length === 0, missing.length ? `抜け: ${missing.join(',')}` : '');
}

console.log(failed ? `\n${failed}件 NG` : '\nすべてOK');
process.exit(failed ? 1 : 0);

// ジャック(レイド)関係の「数字・名前」が、定義(35-raid-jack.jsx)と、ヘルプ・更新履歴・遊び方の台本・助手のセリフ・設計書で食い違っていないかを見る。
//
//   node tools/mode/raid-jack-consistency-check.js
//
// 仕様の数字は 35-raid-jack.jsx に1回だけ書いてある。文章の側は手で書き写しているので、数字を変えたとき
// 文章の直し忘れが起きやすい。ここで機械的に突き合わせて、直し忘れを見つける(2026-10-04・ユーザー指示「レイド関係のデータを整理して統一性を」)。
//
// 見るもの
//   ① 名前: 「レイドバトル」「グランドスラム」。旧名(みんなで討伐・ダメージ競争)が画面・データに残っていない
//   ② ターン数(20)・無料回数(3)・追加の値段(100P)・EX回数(2)・アシカ枚数(3)・供モン(3体)・バフ(5% / 1.5%)・成長ターン(3・5・8)が、
//      ヘルプ・遊び方の台本・助手のセリフ・更新履歴の現行項目と一致する
//   ③ 段階の名前(男爵・子爵・伯爵・公爵・大王)の並びが、定義・台本・遊び方で同じ
//   ④ 設計書(RAID_BOSS_JACK.md)の「現在の仕様」の数字が定義と同じ
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..', '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
let failed = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`); if (!ok) failed++; };

// ---- 定義 ----
const defsSrc = read('monster-hero/src/parts/35-raid-jack.jsx');
const ctx = { console, Object, Number, Math, Array, JSON, String, Boolean, Date, isNaN };
vm.createContext(ctx);
vm.runInContext(`${defsSrc}\nthis.o={RAID_JACK_TURNS,RAID_JACK_FREE_PER_DAY,RAID_JACK_EXTRA_COST_BEAT_P,RAID_JACK_A_EX_MAX_USES,RAID_JACK_TEACHING_MAX,RAID_JACK_ALLY_MAX,RAID_JACK_TURN_GROWTH,RAID_JACK_TURN_REGEN_STEP,RAID_JACK_LEVEL_UP_TURNS,RAID_JACK_A_TIERS};`, ctx);
const o = ctx.o;
const growthPct = Math.round((o.RAID_JACK_TURN_GROWTH - 1) * 100);           // 5
const regenPct = Math.round(o.RAID_JACK_TURN_REGEN_STEP * 1000) / 10;        // 1.5
const levelUps = o.RAID_JACK_LEVEL_UP_TURNS.join('・');                        // 3・5・8
check('定義の数字が仕様どおり(20ターン / 無料3回 / 追加100P / EX2回 / アシカ3枚 / 供モン3体 / バフ5%・1.5%)',
  o.RAID_JACK_TURNS === 20 && o.RAID_JACK_FREE_PER_DAY === 3 && o.RAID_JACK_EXTRA_COST_BEAT_P === 100 && o.RAID_JACK_A_EX_MAX_USES === 2
  && o.RAID_JACK_TEACHING_MAX === 3 && o.RAID_JACK_ALLY_MAX === 3 && growthPct === 5 && regenPct === 1.5,
  `${o.RAID_JACK_TURNS}/${o.RAID_JACK_FREE_PER_DAY}/${o.RAID_JACK_EXTRA_COST_BEAT_P}/${o.RAID_JACK_A_EX_MAX_USES}/${o.RAID_JACK_TEACHING_MAX}/${o.RAID_JACK_ALLY_MAX}/${growthPct}%/${regenPct}%`);

// ---- 文章の読み出し ----
const help = read('monster-hero/data/help.js');
const hs = help.indexOf("id: 'raid-jack'");
const he = help.indexOf("\n      {", hs + 10) > 0 ? help.indexOf("id: '", hs + 20) : help.length;
const helpRaid = help.slice(hs, he > hs ? he : help.length);
const assistants = read('monster-hero/data/assistants.js');
const hw = assistants.indexOf('const ASSISTANT_RAID_JACK_HOWTO = [');
const howto = assistants.slice(hw, assistants.indexOf('];', hw));
const changelog = read('monster-hero/data/changelog.js');
const ce = changelog.indexOf("title:'カボチャの大王ジャックがあらわれました'");
const clRaid = changelog.slice(ce, changelog.indexOf("\n  },", ce));

// ① 名前
const OLD = /みんなで討伐|ダメージ競争/;
const where = (name, text) => (OLD.test(text) ? name : null);
const oldHits = [where('ヘルプ', helpRaid), where('遊び方の台本', howto), where('更新履歴', clRaid),
  where('助手のセリフ', assistants.slice(assistants.indexOf('raidJackIntro'), assistants.indexOf('raidJackIntro') + 6000)),
  where('画面', read('monster-hero/src/parts/79-screen-raid-jack.jsx')), where('ストーリー台本', read('docs/spec/RAID_JACK_STORY.md'))].filter(Boolean);
check('旧名(みんなで討伐・ダメージ競争)が、画面・ヘルプ・台本・更新履歴・助手のセリフに残っていない', oldHits.length === 0, oldHits.join(', '));
check('ヘルプ・遊び方の台本・更新履歴に、新しい名前(レイドバトル・グランドスラム)が出ている',
  [helpRaid, howto, clRaid].every((t) => /レイドバトル/.test(t) && /グランドスラム/.test(t)));

// ② 数字(現行の文章が、定義と同じ数字を書いているか)
const has = (t, re) => re.test(t);
const nums = [
  ['ターン数', new RegExp(`${o.RAID_JACK_TURNS}ターン`), [['ヘルプ', helpRaid], ['遊び方の台本', howto], ['更新履歴', clRaid]]],
  ['無料の回数', new RegExp(`1日(に)?${o.RAID_JACK_FREE_PER_DAY}回`), [['ヘルプ', helpRaid], ['遊び方の台本', howto], ['更新履歴', clRaid]]],
  ['追加の値段', new RegExp(`${o.RAID_JACK_EXTRA_COST_BEAT_P}P`), [['ヘルプ', helpRaid], ['遊び方の台本', howto]]],
  ['成長のターン', new RegExp(`${o.RAID_JACK_LEVEL_UP_TURNS.join('[・、ターン目]+')}ターン目`), [['ヘルプ', helpRaid], ['遊び方の台本', howto]]],
  ['アシカ枚数', new RegExp(`アシカ[^。]{0,24}${o.RAID_JACK_TEACHING_MAX}(枚|つ)まで`), [['ヘルプ', helpRaid], ['更新履歴', clRaid]]],
  ['供モン', new RegExp(`供モン(\\(|\\()?(最大)?${o.RAID_JACK_ALLY_MAX}体`), [['ヘルプ', helpRaid], ['遊び方の台本', howto]]],
  ['全ステータスの上がり幅', new RegExp(`全ステータスが${growthPct}%`), [['ヘルプ', helpRaid], ['遊び方の台本', howto], ['更新履歴', clRaid]]],
  ['自動回復の上がり幅', new RegExp(`${String(regenPct).replace('.', '\\.')}%`), [['ヘルプ', helpRaid], ['更新履歴', clRaid]]],
  ['EXスキルの回数', new RegExp(`EXスキル[^。]{0,40}${o.RAID_JACK_A_EX_MAX_USES}回`), [['ヘルプ', helpRaid], ['遊び方の台本', howto], ['更新履歴', clRaid]]],
];
for (const [label, re, targets] of nums) {
  const missing = targets.filter(([, t]) => !has(t, re)).map(([n]) => n);
  check(`${label}(${re.source.slice(0, 22)}…)が ${targets.map(([n]) => n).join('・')} に書かれていて、定義と同じ`, missing.length === 0, missing.length ? `書かれていない/食い違い: ${missing.join(', ')}` : '');
}
// 旧い数字が残っていないか
check('旧い数字(10ターン勝負・EXスキルは1回・全ステータス10%ずつ・アシカは1枚まで)が、現行の文章に残っていない',
  !/レイド[^。]{0,40}10ターン|EXスキル[^。]{0,40}1回(まで|しか)|全ステータスが10%|アシカは1枚/.test(helpRaid + howto + clRaid),
  (helpRaid + howto + clRaid).match(/レイド[^。]{0,40}10ターン|EXスキル[^。]{0,40}1回(まで|しか)|全ステータスが10%|アシカは1枚/) ? 'あり' : '');

// ③ 段階の名前
const tierNames = o.RAID_JACK_A_TIERS.map((t) => t.name.replace('ジャック', ''));   // 男爵,子爵,伯爵,公爵,大王
check('段階の名前は 男爵・子爵・伯爵・公爵・大王', tierNames.join(',') === '男爵,子爵,伯爵,公爵,大王', tierNames.join(','));
check('遊び方の台本に 男爵・子爵・伯爵・公爵・大王 の5段階が同じ順に出る', has(howto, /男爵、子爵、伯爵、公爵、大王/));
const story = read('docs/spec/RAID_JACK_STORY.md');
check('ストーリー台本の文書に、爵位の順(男爵→子爵→伯爵→公爵→大王)で第2〜6部が並ぶ',
  story.indexOf('## 第2部') < story.indexOf('## 第3部') && story.indexOf('## 第3部') < story.indexOf('## 第4部') && story.indexOf('## 第5部') < story.indexOf('## 第6部'));

// ④ 設計書(現在の仕様)
const design = read('docs/spec/RAID_BOSS_JACK.md');
const statusStart = design.indexOf('## 実装の状況');
const statusEnd = design.indexOf('### 公開(2026-10-05');
const statusText = design.slice(statusStart, statusEnd);
check('設計書の「実装の状況」に、旧い記述(10ターン・第2〜5部は未)が残っていない', !/10ターン|第2〜5部のお話[^|]*\|[^|]*\|[^|]*未/.test(statusText), (statusText.match(/10ターン|第2〜5部のお話/) || [''])[0]);
check('設計書に「現在の仕様(まとめ)」の節があり、数字が定義と同じ',
  /## 現在の仕様\(まとめ\)/.test(design) && new RegExp(`${o.RAID_JACK_TURNS}ターン`).test(design.slice(design.indexOf('## 現在の仕様(まとめ)'))));

if (failed) { console.log(`\n${failed}件 NG`); process.exit(1); }
console.log('\nすべて OK');

#!/usr/bin/env node
// 助手のマスモンの案(docs/progress/assistant-peer/masmon-plan.json)を、ゲームの部品
// monster-hero/src/parts/56-assistant-life-masmon.jsx の ASSISTANT_MASMON_PLAN へ書き写す。
//   node tools/assistant/assistant-masmon-import.js          … 書き写す
//   node tools/assistant/assistant-masmon-import.js --check  … 食い違っていたら落ちる(書かない)
// 正本は JSON。部品の中の表を手で直さない(直したら次の書き写しで消える)。
const fs = require('fs'), path = require('path');
const root = path.resolve(__dirname, '..', '..');
const planPath = path.join(root, 'docs/progress/assistant-peer/masmon-plan.json');
const partPath = path.join(root, 'monster-hero/src/parts/56-assistant-life-masmon.jsx');
const BEGIN = '// <<< ASSISTANT_MASMON_PLAN(tools/assistant/assistant-masmon-import.js が masmon-plan.json から書く。手で直さない)';
const END = '// >>> ASSISTANT_MASMON_PLAN';

const plan = JSON.parse(fs.readFileSync(planPath, 'utf8')).assistants;
// ゲームで使う項目だけ写す(「あとで加わる」未実装のモンスターは写さない)
const pick = (a) => ({
  id: a.id,
  team: a.team.map(t => ({ monster: t.monster, nick: t.nick, lead: !!t.lead, why: t.why, lv: t.lv, grow: t.grow, dye: { colors: t.dye.colors } })),
  deck: { name: a.deck.name, plan: a.deck.plan },
  likeMon: a.likeMon, dislikeMon: a.dislikeMon, favColors: a.favColors,
});
const body = `const ASSISTANT_MASMON_PLAN = [\n${plan.map(a => '  ' + JSON.stringify(pick(a))).join(',\n')},\n];`;
const block = `${BEGIN}\n${body}\n${END}`;

const src = fs.readFileSync(partPath, 'utf8');
const i = src.indexOf(BEGIN), j = src.indexOf(END);
if (i < 0 || j < 0) { console.error(`✗ ${path.relative(root, partPath)} に書き写す印がありません`); process.exit(1); }
const next = src.slice(0, i) + block + src.slice(j + END.length);
if (process.argv.includes('--check')) {
  if (next !== src) { console.error('✗ ASSISTANT_MASMON_PLAN が masmon-plan.json と食い違っています。node tools/assistant/assistant-masmon-import.js で書き写してください'); process.exit(1); }
  console.log('✓ ASSISTANT_MASMON_PLAN は masmon-plan.json と同じ');
} else {
  fs.writeFileSync(partPath, next);
  console.log(`✓ ${plan.length}人ぶんを書き写しました → ${path.relative(root, partPath)}`);
}

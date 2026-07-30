// ヘルプ(攻略情報局)を検証する。
//
//   ① data/help.js のデータが壊れていない(id重複なし・必須項目あり・本文が空でない)
//   ② 将来の「助手」がそのまま使えるよう、全トピックに助手のひとこととプレーンテキストがある
//   ③ 画面がカテゴリ一覧 → 項目一覧 → 本文 の3階層で組まれ、データから描画している
//   ④ ヘルプに書いた数値が、実際のゲームの計算と食い違っていない
//   ⑤ data/help.js が読めなかったときもヘルプを開くだけで落ちない
const fs = require('fs');
const vm = require('vm');
const path = require('path');

const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'monster-hero/src/game-system.jsx'), 'utf8');
const helpSrc = fs.readFileSync(path.join(root, 'monster-hero/data/help.js'), 'utf8');
const breeder = fs.readFileSync(path.join(root, 'monster-hero/data/breeder.js'), 'utf8');
const indexHtml = fs.readFileSync(path.join(root, 'monster-hero/index.html'), 'utf8');

let failed = 0;
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failed++;
};
const has = (needle) => source.includes(needle);
const grab = (text, a, b) => text.slice(text.indexOf(a), text.indexOf(b));

// --- ① データを実際に読み込む ---
const helpCtx = {};
vm.createContext(helpCtx);
vm.runInContext(`${helpSrc}\nglobalThis.__h={HELP_CATEGORIES,HELP_ASSISTANT,HELP_INTRO,HELP_ASSISTANT_INTRO,helpPlainText,helpBlockPlainText,helpFindCategory,helpFindTopic};`, helpCtx);
const h = helpCtx.__h;
const categories = h.HELP_CATEGORIES;
const topics = categories.flatMap(c => c.topics.map(t => ({ ...t, catId: c.id })));

check('index.htmlがdata/help.jsを読み込んでいる', /<script src="data\/help\.js\?v=[0-9a-f]{12}"><\/script>/.test(indexHtml));
check('カテゴリが複数ある', categories.length >= 4, `${categories.length}カテゴリ / ${topics.length}項目`);
check('カテゴリのidが重複していない', new Set(categories.map(c => c.id)).size === categories.length);
check('カテゴリに必要な項目がそろっている',
  categories.every(c => c.id && c.emoji && c.title && c.summary && c.assistant && /^#[0-9a-f]{6}$/i.test(c.color) && Array.isArray(c.topics) && c.topics.length > 0));
check('項目のidがカテゴリ内で重複していない', categories.every(c => new Set(c.topics.map(t => t.id)).size === c.topics.length));
check('項目に必要な項目がそろっている', topics.every(t => t.id && t.emoji && t.title && Array.isArray(t.blocks) && t.blocks.length > 0));

const BLOCK_TYPES = ['p', 'note', 'list', 'steps', 'kv'];
const blocks = topics.flatMap(t => t.blocks);
check('ブロックの種類が想定内', blocks.every(b => BLOCK_TYPES.includes(b.t)), [...new Set(blocks.map(b => b.t))].join('/'));
check('本文のブロックが空でない', blocks.every(b => {
  if (b.t === 'kv') return b.rows.length > 0 && b.rows.every(r => r.length === 2 && r[0] && r[1]);
  if (b.t === 'list' || b.t === 'steps') return b.items.length > 0 && b.items.every(Boolean);
  return !!b.text;
}));

// --- ② 助手が使える形になっているか ---
check('全カテゴリ・全項目に助手のひとことがある', categories.every(c => c.assistant) && topics.every(t => t.assistant));
check('カテゴリ一覧でも助手が話す内容がある', !!h.HELP_INTRO && !!h.HELP_ASSISTANT_INTRO);
check('助手の名前と見た目を1か所で決めている', !!h.HELP_ASSISTANT.name && !!h.HELP_ASSISTANT.emoji && 'iconUrl' in h.HELP_ASSISTANT);
check('どの項目もプレーンテキストを取り出せる', topics.every(t => h.helpPlainText(t).length > 20));
check('表・箇条書きもプレーンテキストになる',
  h.helpBlockPlainText({ t:'kv', rows:[['A','B']] }) === 'A: B'
    && h.helpBlockPlainText({ t:'list', items:['x','y'] }) === 'x\ny'
    && h.helpBlockPlainText({ t:'note', title:'T', text:'X' }) === 'T: X'
    && h.helpBlockPlainText({ t:'p', text:'X' }) === 'X');
check('idから引ける', h.helpFindCategory('battle')?.id === 'battle' && h.helpFindTopic('battle', 'distance')?.id === 'distance');
check('存在しないidではnullを返す', h.helpFindCategory('nope') === null && h.helpFindTopic('battle', 'nope') === null);

// --- ③ 画面 ---
check('ヘルプはカテゴリ→項目→本文の3階層', has('const [helpCatId, setHelpCatId] = useState(null);') && has('const [helpTopicId, setHelpTopicId] = useState(null);'));
check('ヘルプを開くと必ずカテゴリ一覧から始まる',
  has('const openHelp = () => { setHelpCatId(null); setHelpTopicId(null); setHelpAssistantOpen(true); setShowHelp(true); };')
    && !/onClick=\{\(\)=>setShowHelp\(true\)\}/.test(source));
check('戻るは1階層ずつ戻る', has('const goBack = () => { if(topic) setHelpTopicId(null); else if(cat) setHelpCatId(null); else setShowHelp(false); };'));
check('カテゴリの色をそのまま使う(Tailwindの動的クラスに頼らない)', has('style={{borderColor:c.color,backgroundColor:\'rgba(15,23,42,0.85)\'}}'));
check('画面はデータから作る(本文をJSXに直書きしていない)', has('{HELP_GUIDE.map(c=>(') && has('{cat.topics.map(t=>(') && has('{topic.blocks.map((b,i)=>{'));
check('ブロックの種類ごとに描き分ける', ['b.t===\'note\'', 'b.t===\'list\'', 'b.t===\'steps\'', 'b.t===\'kv\''].every(has));
check('助手ボタンと吹き出しがある', has('aria-label="助手のひとことを開く"') && has('{assistantLine}') && has('{HELP_GUIDE_ASSISTANT.name}'));
check('助手は開いている階層に応じて話す', has('const assistantLine = topic ? topic.assistant : cat ? cat.assistant : HELP_GUIDE_HELLO;'));
check('助手の絵は画像へ差し替えられる', has('{HELP_GUIDE_ASSISTANT.iconUrl?<img src={HELP_GUIDE_ASSISTANT.iconUrl}'));
check('本文から次の項目へ進める', has('const nextTopic = topicIndex>=0 ? cat.topics[topicIndex+1] : null;') && has('次: {nextTopic.title}'));
check('ヘルプは縦スクロールできる', has('<div className="flex-1 min-h-0 overflow-y-auto mh-scroll p-4 bg-black"'));
check('古いタブ形式のヘルプが残っていない', !source.includes('helpTab') && !source.includes('Help Guide'));

// --- ④ 本文の数値が実際の計算と合っているか ---
const calcCtx = {};
vm.createContext(calcCtx);
vm.runInContext([
  grab(source, 'const WAVE_XP_TABLE =', 'const xpForLevel ='),
  grab(source, 'const DIFFICULTY_SETTINGS = {', 'const normalizeBattleDifficulty'),
  grab(source, 'const FUSION_COST_PER_LEVEL', 'const masuFusionCost'),
  'globalThis.__c={goldForWavesCleared,DIFFICULTY_SETTINGS,FUSION_COST_PER_LEVEL,REBIRTH_COST_PER_LEVEL};',
].join('\n'), calcCtx);
const c = calcCtx.__c;
const textOf = (catId, topicId) => h.helpPlainText(h.helpFindTopic(catId, topicId));

check('合体の消費ダイヤがコードと一致', textOf('growth', 'fusion').includes(`×${c.FUSION_COST_PER_LEVEL}`), `×${c.FUSION_COST_PER_LEVEL}`);
check('転生の消費ダイヤがコードと一致', textOf('growth', 'rebirth').includes(`上限Lv × ${c.REBIRTH_COST_PER_LEVEL}`), `上限Lv × ${c.REBIRTH_COST_PER_LEVEL}`);
check('難易度倍率の説明がDIFFICULTY_SETTINGSと一致', (() => {
  const t = textOf('basics', 'difficulty');
  const s = c.DIFFICULTY_SETTINGS;
  return t.includes(`敵${s.Hard.power}倍／スコア${s.Hard.score.toFixed(1)}倍／ダイヤ${s.Hard.gold}倍`)
    && t.includes(`敵${s.Expert.power.toFixed(1)}倍／スコア${s.Expert.score.toFixed(1)}倍／ダイヤ${s.Expert.gold}倍`);
})());
check('1WAVEあたりのダイヤの説明が実際の合計と合う',
  textOf('home', 'currency').includes('Normal基準100ダイヤ/WAVE') && c.goldForWavesCleared(10, 1.0) === 1000);
check('スキップチケットの対応難易度がアイテム定義と一致', (() => {
  const t = textOf('items', 'skip-ticket');
  return /skip_ticket_jo[\s\S]*?skipDifficulty:'Normal'/.test(breeder) && t.includes('スキップチケット・序: Normal で使える')
    && t.includes('スキップチケット・破: Hard で使える') && t.includes('スキップチケット・急: Expert で使える');
})());
check('絆レベルの上限の説明が実際の初期上限と一致',
  textOf('growth', 'masumon').includes(`Lv.${source.match(/const INITIAL_MASU_LEVEL_CAP = (\d+);/)[1]}`));
check('転生の上限アップ量が実際の値と一致',
  textOf('growth', 'rebirth').includes(`上限が+${source.match(/const REBIRTH_LEVEL_CAP_GAIN = (\d+);/)[1]}`));
check('固有技の最大レベルが実際の値と一致',
  textOf('growth', 'rebirth').includes(`上限はLv.${source.match(/const MAX_UNIQUE_SKILL_LEVEL = (\d+);/)[1]}`));
check('絆経験値の配分(勇者=満額/供モン1/2/控え1/4)を説明している',
  textOf('growth', 'masumon').includes('半分') && textOf('growth', 'masumon').includes('4分の1'));

// --- ⑤ 読み込めなかったときの守り ---
check('data/help.jsが読めなくてもヘルプで落ちない',
  has("const HELP_GUIDE = (typeof HELP_CATEGORIES !== 'undefined' && Array.isArray(HELP_CATEGORIES)) ? HELP_CATEGORIES : [];")
    && has('{HELP_GUIDE.length===0&&<div'));

console.log(failed ? `\n${failed}件のNGがあります` : '\nすべてOK');
process.exit(failed ? 1 : 0);

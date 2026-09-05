const TOOLS_DIR = require('path').join(__dirname, '..'); // tools/ 直下。分類フォルダから見た1つ上
// マスモン設定の画面に、モンスターノーツの説明がそろっているかを見る。
//
//   node tools/mode/rhythm-monster-guide-check.js
//
// 【なぜ要るか】
// 実機の指摘(2026-09-05)
//   「マスモン設定のとこをUIやレイアウトを整えて。
//     モンスターノーツが何がつくかとか説明とかその辺の詳細を追加して」
//
// それまでのマスモン設定は名前を並べるだけで、
//   ・設定した子が何番目に出るのか
//   ・その子で何の能力が出るのか
//   ・どの血統がどの能力になるのか
// が画面のどこにも無かった。設定はできるのに、設定した結果が分からない状態だった。
//
// いちばん怖いのは、能力の効果(ライフ+500・6秒・15秒…)を画面へ手で書き写すこと。
// 値を変えたときに画面だけ古いまま残り、しかも誰も気づけない。
// ここでは「実データから作っているか」を強く見張る。
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(TOOLS_DIR, '..');
const web = path.join(root, 'monster-hero');
const game = fs.readFileSync(path.join(web, 'src/game-system.jsx'), 'utf8');
const rhythm = fs.readFileSync(path.join(web, 'data/rhythm-mode.js'), 'utf8');
const assistants = fs.readFileSync(path.join(web, 'data/assistants.js'), 'utf8');

let failed = 0;
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failed++;
};
const grab = (from, to) => {
  const i = game.indexOf(from);
  const j = game.indexOf(to, i);
  return i >= 0 && j > i ? game.slice(i, j) : '';
};

// ---- 実データ側 ----
const context = {};
vm.createContext(context);
vm.runInContext(`${rhythm}\nglobalThis.x={RHYTHM_MONSTER_ABILITIES,RHYTHM_MONSTER_ABILITY_BY_LINEAGE,`
  + `RHYTHM_MONSTER_SLOT_MAX,RHYTHM_MONSTER_ABILITY_JUDGMENTS,rhythmMonsterNoteBaseRatios};`, context);
const { RHYTHM_MONSTER_ABILITIES, RHYTHM_MONSTER_ABILITY_BY_LINEAGE,
        RHYTHM_MONSTER_SLOT_MAX, RHYTHM_MONSTER_ABILITY_JUDGMENTS } = context.x;

// ---- 画面に説明があるか ----
check('マスモン設定にモンスターノーツの説明がある', game.includes('data-rhythm-monster-guide'));
check('説明を画面へ置いている', game.includes('<RhythmMonsterNoteGuide/>'));
check('助手のひとことがある(CLAUDE.md ⑤-4)',
  game.includes('<AssistantBubble scene="rhythmMonsters" compact/>')
  && /rhythmMonsters: \{/.test(assistants));
check('助手のセリフが3人ぶんある',
  (assistants.match(/^\s{4}rhythmMonsters: \[/gm) || []).length === 3,
  `${(assistants.match(/^\s{4}rhythmMonsters: \[/gm) || []).length}人ぶん`);

// ---- 能力の一覧が実データから作られているか ----
const guide = grab('const RhythmMonsterNoteGuide=', 'const RhythmMonsterSlotsPanel=');
check('能力の一覧を実データから作っている',
  guide.includes('rhythmAbilityRows()') && game.includes('Object.values(RHYTHM_MONSTER_ABILITIES).map'));
check('血統の割り当ても実データから引いている',
  game.includes('Object.entries(RHYTHM_MONSTER_ABILITY_BY_LINEAGE)'));
check('血統名は lineageById から出している(手書きしていない)',
  game.includes('.map(([lineageId])=>lineageById(lineageId).name)'));
// 効果の数値を画面へ書き写していないこと。ここが崩れると、値を変えたとき画面だけ古くなる
// 効果の一文はヘルプの表(helpDataRows)より前に置いてある。
// あとに置くと、ヘルプを開いた瞬間に「初期化前の変数を参照した」で真っ白になる
const effectFn = grab('const rhythmAbilityEffectText=', 'const helpDataRows = (id)');
for (const [key, expr] of [['ライフ回復量', 'ability.lifeGain'], ['無敵の秒数', 'ability.durationMs'],
  ['我慢の軽減率', 'ability.reduceRate'], ['根性の復活ライフ', 'ability.reviveLife']]) {
  check(`${key}をデータから出している`, effectFn.includes(expr));
}
check('効果の数値を画面へ直接書いていない',
  !/\+500|6秒のあいだライフが減らない|15秒のあいだ/.test(guide + effectFn));
// ヘルプの表も同じデータから作る(ヘルプにだけ古い数値が残らないようにする)
check('ヘルプの能力一覧も実データから作っている',
  game.includes("case 'rhythmMonsterAbilities': {") && game.includes('rhythmMonsterAbilities: \'モンスターノーツで出る能力\''));
check('効果の一文はヘルプの表より前に置いてある(開いた瞬間に真っ白にならない)',
  game.indexOf('const rhythmAbilityEffectText=') < game.indexOf('const helpDataRows = (id)'));
check('発動する判定もデータから出している',
  guide.includes('RHYTHM_MONSTER_ABILITY_JUDGMENTS.join'));
check('登場のタイミングもデータから出している',
  guide.includes('rhythmMonsterNoteBaseRatios(RHYTHM_MONSTER_SLOT_MAX)'));
check('設定できる体数もデータから出している', guide.includes('{RHYTHM_MONSTER_SLOT_MAX}'));

// ---- 能力が全部出るか(データを足したときに載り漏れない形か) ----
const abilityIds = Object.keys(RHYTHM_MONSTER_ABILITIES);
check('能力を1つずつ手で並べていない(足しても自動で載る)',
  !abilityIds.every(id => guide.includes(`'${id}'`)) || guide.includes('rhythmAbilityRows()'),
  abilityIds.join(' / '));
// 見た目(色・絵文字)だけは能力ごとに決めるので、全部そろっているかを見る
for (const id of abilityIds) {
  check(`${RHYTHM_MONSTER_ABILITIES[id].name}の色と絵文字がある`,
    new RegExp(`abilityId==='${id}'`).test(game));
}

// ---- 設定枠 ----
const panel = grab('const RhythmMonsterSlotsPanel=', '\nconst RhythmTapTest=');
check('枠に「何番目に出るか」を出している', panel.includes('番目'));
check('枠に「その子で何の能力が出るか」を出している',
  panel.includes('data-rhythm-monster-slot-ability') && panel.includes('rhythmSlotAbility(masu)'));
check('枠に主血統を出している', panel.includes('monsterLineageOf(masu.baseId).main'));
check('能力が決まっていない血統でも落ちない(説明へ切り替える)',
  panel.includes('この血統の能力はまだ決まっていません'));
check('マスモン一覧でも能力が分かる', panel.includes('rhythmAbilityEmoji(ability.id)}${ability.name}'));
// 指で触る場所は44px以上(この画面はボタンが小さくなりがち)
check('並べ替え・外すボタンが指で押せる大きさ',
  !/min-h-\[3[0-9]px\]/.test(panel) && panel.includes('min-h-[40px]'));

// ---- レイアウトのゆとり ----
// 「窮屈すぎる」という指摘が繰り返し出ているので、詰めすぎに戻っていないかを見る
check('カードの余白を広げてある(p-3のままにしていない)',
  panel.includes('bg-fuchsia-950/20 p-4'));
check('説明文が9pxまで小さくなっていない',
  !/text-\[9px\][^]{0,200}モンスターノーツ/.test(panel));

console.log(failed === 0 ? '\nすべてOK' : `\n${failed}件のNGがあります`);
process.exit(failed === 0 ? 0 : 1);

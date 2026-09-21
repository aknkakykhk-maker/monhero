#!/usr/bin/env node
// タクティクスバトルの導入会話（イベント回想 tactics_intro）を見る。
//
//   node tools/assistant/tactics-intro-story-check.js
//
// 【なぜ道具にするか】
// この会話は**モードを公開するまで出してはいけない**。回想の一覧は誰でも開けるので、
// 出してしまうと「まだ見せていないモードの名前と中身」がそこから丸ごと見える。
// しかも一覧に並ぶだけなので、**出ていても誰もエラーに気づかない**。
//
// もう1つ、台本に倍率や確率を書かないことも見る。数字は調整のたびに変わるので、
// 会話へ書き写すとそのたびに嘘になる（数字はヘルプとSCAN画面が実データから出す）。
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const EVENT_ID = 'tactics_intro';
const SCRIPT_NAME = 'ASSISTANT_TACTICS_INTRO';
const ASSISTANT_IDS = ['mua', 'kiki', 'momosuke', 'dra'];
let failed = 0;
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failed += 1;
};

const data = fs.readFileSync(path.join(ROOT, 'monster-hero/data/assistants.js'), 'utf8');
const source = fs.readFileSync(path.join(ROOT, 'monster-hero/src/game-system.jsx'), 'utf8');
const compact = source.replace(/\s+/g, '');

// --- ① 台本そのもの ---
const block = (data.match(new RegExp(`const ${SCRIPT_NAME} = \\[([\\s\\S]*?)\\n\\];`)) || [])[1] || '';
check('台本がある', block.length > 0, `${block.split('\n').filter(l => l.includes('who:')).length}行`);
const lines = [...block.matchAll(/\{ *who:'(\w+)', *e:'(\w+)', *t:'([^']*)' *\}/g)]
  .map(m => ({ who: m[1], e: m[2], t: m[3] }));
check('台本の行を読み取れた', lines.length >= 8, `${lines.length}行`);
// 会話として成り立つ長さ。短すぎると説明だけ、長すぎると読み飛ばされる
check('長さがほどよい（8〜24行）', lines.length >= 8 && lines.length <= 24, `${lines.length}行`);
check('助手4人ともしゃべる',
  ASSISTANT_IDS.every(id => lines.some(l => l.who === id)),
  ASSISTANT_IDS.filter(id => !lines.some(l => l.who === id)).join(',') || '');
check('知らない助手が混ざっていない',
  lines.every(l => ASSISTANT_IDS.includes(l.who)),
  [...new Set(lines.filter(l => !ASSISTANT_IDS.includes(l.who)).map(l => l.who))].join(','));
// 表情は助手の画像がある種類だけ。知らない名前を書くと、その行だけ絵が出ない
const EXPRESSIONS = [...new Set([...data.matchAll(/ e:'(\w+)'/g)].map(m => m[1]))];
check('表情が、ほかの会話でも使っているものだけ',
  lines.every(l => EXPRESSIONS.includes(l.e)),
  [...new Set(lines.filter(l => !EXPRESSIONS.includes(l.e)).map(l => l.e))].join(','));
check('同じ人が3回以上続けてしゃべらない',
  !lines.some((l, i) => i >= 2 && l.who === lines[i - 1].who && l.who === lines[i - 2].who),
  lines.filter((l, i) => i >= 2 && l.who === lines[i - 1].who && l.who === lines[i - 2].who).map(l => l.who).join(','));
// ★倍率・確率を会話へ書かない。調整のたびに嘘になる
const withNumbers = lines.filter(l => /[×%]|[0-9]+\.[0-9]|[0-9]+倍/.test(l.t));
check('倍率や確率を台本へ書いていない', withNumbers.length === 0, withNumbers.map(l => l.t.slice(0, 24)).join(' / '));
// 伝えたいことが入っているか（言い回しは変えてよいので、鍵になる語だけ見る）。
// クラシックバトルとの違いは、この4つ
for (const [what, words] of [
  ['ステータスを1体ずつ持つこと', ['ステータスを1体ずつ', 'ステータスは1体ずつ']],
  ['勇者特性が供モンにも効くこと', ['勇者特性']],
  ['ステータスの高さも大事なこと', ['ステータスの高さ', 'ステータスも大事']],
  ['敵の顔ぶれが変わったこと', ['顔ぶれ', '敵が変わ', '入れ替わ']],
  ['敵の技の種類が増えたこと', ['技の種類が増え', '技が増え']],
]) {
  check(`${what}に触れている`, words.some(w => lines.some(l => l.t.includes(w))));
}
// ★**間合いと攻撃予告はクラシックにもある。違いとして挙げてはいけない**
//   (2026-09-21、最初の台本でこの2つを「新しいところ」として書き、ユーザーに
//    「間合いはクラシックにもあった / 攻撃予告もクラシックにはあった」と指摘された)。
//   前からあるものを「新しい」と言うと、遊ぶ人が何が変わったのか分からなくなる
const title = (data.match(new RegExp(`\\{ id: '${EVENT_ID}', title: '([^']*)'`)) || [])[1] || '';
check('タイトルを読み取れた', !!title, title);
// ★**ステータスを2つだけ挙げない**。ライフ・ちから・丈夫さ・ガッツの4つある
//   (2026-09-21 ユーザー指摘「ライフ、ちからじゃなくてステータスを1体ずつね」)
const partialStatus = lines.filter(l => /ライフもちから(も|を)?1体ずつ/.test(l.t));
check('「1体ずつ持つ」の説明で、ステータスを2つだけ挙げていない',
  partialStatus.length === 0, partialStatus.map(l => l.t.slice(0, 26)).join(' / '));
// ★**助手はモンスターではない**。勇者特性は連れていくモンスターのもの
//   (2026-09-21 ユーザー指摘「ももの特性ってなに？ ももはモンスターじゃないよ」)
const ASSISTANT_NAMES = ['もも', 'みゅあ', 'きき', 'ドラ', 'おで'];
const asMonster = lines.filter(l => ASSISTANT_NAMES.some(n => l.t.includes(`${n}の特性`)));
check('助手を、特性を持つモンスターのように扱っていない',
  asMonster.length === 0, asMonster.map(l => l.t.slice(0, 26)).join(' / '));
// ★**分かりにくい呼び名を会話へ出さない**
//   (2026-09-21 ユーザー指摘「薙ぎ払いじゃなんのことか分からない / 技名は種別に設定してる /
//    せめて貫通攻撃や連撃とかにしたほうがいい」)。
//   このあと種別名そのものを直した(薙ぎ払い→間合い攻撃 / 咆哮→攻撃力アップ)ので、
//   ここに並ぶのは**もう使わない古い呼び名**。「貫通撃」は種別名としては残っているが、
//   会話では「貫通攻撃」のほうが分かるのでこちらも避ける
for (const word of ['薙ぎ払い', '咆哮', '貫通撃']) {
  const found = lines.filter(l => l.t.includes(word));
  check(`種別の呼び名「${word}」をそのまま会話へ出していない`,
    found.length === 0, found.map(l => l.t.slice(0, 26)).join(' / '));
}
for (const [what, word] of [['間合い', '間合い'], ['攻撃の予告', '予告']]) {
  const found = lines.filter(l => l.t.includes(word));
  check(`${what}を新しいところとして挙げていない（クラシックにもある）`,
    found.length === 0, found.map(l => l.t.slice(0, 26)).join(' / '));
  // タイトルにも出さない。一覧に並ぶ文字なので、いちばん先に目に入る
  check(`タイトルに「${what}」を入れていない`, !title.includes(word), title);
}

// --- ② 回想への登録 ---
const entry = (data.match(new RegExp(`\\{ id: '${EVENT_ID}'[^}]*\\}`)) || [''])[0];
check('回想の一覧に登録されている', entry.includes(`script: ${SCRIPT_NAME}`), entry.slice(0, 70));
// ★公開フラグが無いと、モードを見せる前に会話だけが一覧へ並ぶ
check("公開フラグ(releaseFlag:'tacticsBattle')が付いている", /releaseFlag: *'tacticsBattle'/.test(entry));

// --- ③ 出し分けの結線 ---
check('公開フラグの対応表に tacticsBattle がある',
  /EVENT_REPLAY_RELEASE_FLAGS=Object\.freeze\(\{tacticsBattle:TACTICS_MODE_PUBLIC_RELEASE\|\|TACTICS_BETA_PRO_RELEASE/.test(compact));
// ★画面が生の EVENT_REPLAYS を直接見ていると、そこだけフィルタを素通りする
const rawUses = (source.match(/typeof EVENT_REPLAYS ?!== ?'undefined' ?&& ?EVENT_REPLAYS/g) || []).length;
check('画面は eventReplayList() を通して一覧を取る（生の配列を直接見ない）',
  rawUses === 1, `生の参照 ${rawUses} か所（定義の1か所だけが正しい）`);
// 呼び出しは3か所（回想の一覧・再生・プロフィール）。定義側は `= () =>` なのでここには数えない
check('一覧・再生・プロフィールの3か所とも同じ入口を使う',
  (compact.match(/eventReplayList\(\)/g) || []).length === 3,
  `${(compact.match(/eventReplayList\(\)/g) || []).length} か所`);

// --- ③-2 会話中に鳴るBGM ---
// 枠を作らないと、会話のあいだ画面のBGMがそのまま鳴り続ける
const EVENT_BGM_SLOT = 'tacticsIntroEvent';
const EVENT_BGM_TRACK = 'close_to_your_heart_alt';
check('会話にBGMの枠が割り当ててある',
  new RegExp(`${EVENT_ID}:'${EVENT_BGM_SLOT}'`).test(compact));
check('枠の既定曲が決まっている', compact.includes(`${EVENT_BGM_SLOT}:'${EVENT_BGM_TRACK}'`));
// ★既定曲が BGM_TRACKS に無いと、会話のあいだ無音になる（見つからない曲は鳴らせない）
const bgmEntry = (compact.match(new RegExp(`\\{id:'${EVENT_BGM_TRACK}'[^}]*\\}`)) || [''])[0];
check('既定曲が曲の一覧に登録されている', bgmEntry.includes(`id:'${EVENT_BGM_TRACK}'`), bgmEntry.slice(0, 80));
const bgmSrc = (bgmEntry.match(/src:'([^']*)'/) || [])[1] || '';
check('既定曲の音源がある', !!bgmSrc && fs.existsSync(path.join(ROOT, 'monster-hero', bgmSrc)), bgmSrc);
// ★BGMアレンジの設定欄へは出さない。項目名から、まだ見せていないモードの名前が見える
const eventTabItems = (compact.match(/id:'event',label:'イベント',items:\[([^\]]*(?:\][^\]]*)*?)\]\}/) || [])[1] || '';
check('BGMアレンジの設定欄には、まだ出していない',
  !eventTabItems.includes(EVENT_BGM_SLOT),
  eventTabItems.includes(EVENT_BGM_SLOT) ? '出ています' : '');

// --- ④ いまは公開していない ---
const released = /const TACTICS_MODE_PUBLIC_RELEASE = true/.test(source)
  || /const TACTICS_BETA_PRO_RELEASE = true/.test(source);
check('公開フラグが立つまで、この会話は一覧に出ない（いまの状態）', !released,
  released ? '公開済み。回想に出ます' : '未公開');

console.log(failed ? `\nNG ${failed}件` : '\nすべてOK');
process.exit(failed ? 1 : 0);

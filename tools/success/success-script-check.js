// モンヒロサクセスの台本(docs/progress/player-raise/script/*.js)の形・口調・言葉を見張る。
//
//   node tools/success/success-script-check.js          … 問題があれば NG と上位だけ出す
//   node tools/success/success-script-check.js --count  … 本数の内訳も出す
//
// 見るもの
//   ① 5つのファイルが読めて、合わせて200本以上ある(1本も拾えていないのに OK にならない)
//   ② id が重ならない・形が「英小文字と数字の . 区切り」・who と表情(e)が決まった値・差しこみ({name} など)が決まった名前だけ
//   ③ みゅあの口調(docs/spec/ASSISTANT_MUA_VOICE.md): 「じゃん」「まじ」を書かない(「ぢゃん」「まぢ」)・ほかの助手の話し方
//      (でつ・まつ・おで)が混ざらない・一人称は「あたし」・絵文字は1本に2つまで・飾り(顔文字・絵文字・ｗ)は全体の15〜50%
//   ④ あつの口調(assistants.js): 最後は必ず「笑」か記号(！？…)か顔文字・笑いに w/ｗ を使わない・自分を「リーダー」と言わない・
//      「S」「ドS」と言わない・一人称は「俺」
//   ⑤ イッサ博士: 一人称は「ぼく」・ていねい語(です・ます)をほぼ使わない
//   ⑥ プレイヤー向けの言葉: 地の文・選択肢の札でモンスターを「子」と呼ばない(助手の「この子」だけ可)・
//      プレイヤーを「ブリーダー」と直に書かない({name})・「スタミナ」「HP」ではなく「体力」・地の文と札に略称「モンサク」を書かない
const fs = require('fs');
const path = require('path');

const DIR = path.resolve(__dirname, '../../docs/progress/player-raise/script');
const FILES = ['turn.js', 'turn-bond12.js', 'turn2.js', 'scenario.js', 'cheer.js', 'issa.js', 'random.js', 'rival.js', 'rival-owner.js', 'events-bond12.js', 'items.js', 'mon.js'];
const SHOW_COUNT = process.argv.includes('--count');

let failed = 0;
const problems = [];
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failed++;
};
const bad = (rule, row) => problems.push(`${rule}: ${row.id} 「${row.t}」`);

const rows = [];
const perFile = {};
for (const f of FILES) {
  const p = path.join(DIR, f);
  if (!fs.existsSync(p)) { check(`${f} がある`, false); continue; }
  const mod = require(p);
  const list = Object.values(mod).find(Array.isArray) || [];
  perFile[f] = list.length;
  for (const r of list) rows.push({ ...r, file: f });
}
check('台本を読めた(200本以上)', rows.length >= 200, `${rows.length}本`);

const ASSTS = new Set(['mua', 'atsu', 'kiki', 'momosuke', 'dra', 'kyuko', 'sorashido', 'erubin']);
const WHO = new Set([...ASSTS, 'issa', 'narr', 'choice', 'mon']);
const EXPR = new Set(['normal', 'happy', 'wink', 'surprise', 'troubled', 'angry', 'crying', 'excited']);
const SLOTS = new Set(['name', 'mon', 'cheer', 'cheer2', 'stat', 'train', 'tech', 'cup', 'food', 'rival', 'owner', 'cry']);
const seen = new Set();
for (const r of rows) {
  if (!r.id || !/^[a-z0-9]+(\.[a-z0-9]+)+$/.test(r.id)) bad('id の形', r);
  if (seen.has(r.id)) bad('id が重なる', r);
  seen.add(r.id);
  if (!WHO.has(r.who)) bad('who が決まった値でない', r);
  if (ASSTS.has(r.who) && !EXPR.has(r.e)) bad('表情が決まった値でない', r);
  if (typeof r.t !== 'string' || !r.t.trim()) { bad('台詞が空', r); continue; }
  for (const m of r.t.matchAll(/\{(\w+)\}/g)) if (!SLOTS.has(m[1])) bad(`知らない差しこみ {${m[1]}}`, r);
  if (/[{}]/.test(r.t.replace(/\{\w+\}/g, ''))) bad('「{」「}」が文字で出る', r);
}

const EMOJI = /\p{Extended_Pictographic}/gu;
const KAOMOJI = /[(（][^()（）]{1,14}[)）]/;
const HALF_KANA = /[ｦ-ﾟ]{2,}/;
const decorated = t => EMOJI.test(t) || KAOMOJI.test(t) || /ｗ/.test(t) || HALF_KANA.test(t);

// ③ みゅあ
const mua = rows.filter(r => r.who === 'mua');
let muaDeco = 0;
for (const r of mua) {
  const t = r.t;
  EMOJI.lastIndex = 0;
  if (/じゃん(?!けん)/.test(t) || /まじ(?!め)/.test(t)) bad('みゅあは「ぢゃん」「まぢ」', r);
  if (/でつ|まつ|おで(?!こ)/.test(t)) bad('みゅあにほかの助手の話し方', r);
  if (/(?<![あ])私|僕|俺|みゅあは/.test(t)) bad('みゅあの一人称は「あたし」', r);
  if ((t.match(EMOJI) || []).length > 2) bad('みゅあの絵文字は1本に2つまで', r);
  if (r.bond && /ｗ|ぢゃん|まぢ/.test(t)) bad('みゅあの Lv1・2 はていねい語', r);
  if (decorated(t)) muaDeco++;
}
const muaRate = mua.length ? muaDeco / mua.length : 0;
check('みゅあの飾りは15〜50%', muaRate >= 0.15 && muaRate <= 0.5, `${Math.round(muaRate * 100)}%(${muaDeco}/${mua.length})`);

// ④ あつ
const atsu = rows.filter(r => r.who === 'atsu');
for (const r of atsu) {
  const t = r.t.trim();
  if (!/(笑|[！？…!?]|[)）ノ])$/.test(t)) bad('あつは最後に「笑」か記号か顔文字', r);
  if (/[wｗＷ]$|[wｗ]\s/.test(t)) bad('あつは w/ｗ を使わない', r);
  if (/リーダー/.test(t)) bad('あつは自分を「リーダー」と言わない', r);
  if (/ドS|(?<![A-Za-z])S(?![A-Za-z])/.test(t)) bad('あつは「S」「ドS」と言わない', r);
  if (/あたし|(?<![あ])私|僕|おで/.test(t)) bad('あつの一人称は「俺」', r);
}

// ⑤ イッサ博士
for (const r of rows.filter(x => x.who === 'issa')) {
  if (/俺|(?<![あ])私|僕|あたし/.test(r.t)) bad('イッサ博士の一人称は「ぼく」', r);
  if (/(です|ます)[。！？\s]|(です|ます)$/.test(r.t)) bad('イッサ博士はていねい語をほぼ使わない', r);
}

// ⑥ プレイヤー向けの言葉
const KO_OK = /調子|様子|子ども|帽子|菓子|団子|椅子|拍子|弟子|息子|格子|扇子|獅子|迷子|甘えんぼ/;
const koOutside = t => t.replace(new RegExp(KO_OK.source, 'g'), '').includes('子');
for (const r of rows) {
  const t = r.t;
  if (r.who === 'narr' || r.who === 'choice') {
    if (koOutside(t)) bad('地の文・札でモンスターを「子」と呼ばない', r);
    if (/モンサク|モンビー/.test(t)) bad('地の文・札は正式名称', r);
  } else if (koOutside(t.replace(/この子/g, ''))) bad('助手が言ってよいのは「この子」だけ', r);
  if (/ブリーダー(?!ライセンス)/.test(t)) bad('プレイヤーは {name}', r);
  if (/スタミナ|ＨＰ|(?<![A-Za-z])HP/.test(t)) bad('「体力」と呼ぶ', r);
}

// ⑦ 第2弾: みゅあの Lv1・2 版がターンごとのことばのみゅあの行を全部うめている・ていねい語になっている
// みゅあの行(シナリオの2話より先は Lv1・2 では見ないので除く)には、id の最後に b を付けた Lv1・2 版がある
const needB = rows.filter(r => r.who === 'mua' && !r.bond && !(r.id.startsWith('scn.') && !r.id.startsWith('scn.mua.ep1.'))).map(r => r.id);
const b12 = rows.filter(r => r.who === 'mua' && Array.isArray(r.bond));
const b12ids = new Set(b12.map(r => r.id));
const missB12 = needB.filter(id => !b12ids.has(id + 'b'));
check('みゅあ Lv1・2 版がそろっている(ターンごとのことば・出来事)', missB12.length === 0, missB12.length ? `足りない ${missB12.length}本: ${missB12.slice(0, 3).join(', ')}` : `${b12.length}本`);
for (const r of b12) {
  if (r.bond.join() !== '1,2') bad('Lv1・2 版には bond:[1,2]', r);
  if (!/です|ます|でした|ました|ません|ましょう|ください|でしょう/.test(r.t)) bad('Lv1・2 版はていねい語', r);
}
// ⑧ モンスターは言葉を話さない(短い声だけ)・30種の鳴き声がある
for (const r of rows.filter(x => x.who === 'mon')) if (r.t.replace(/\{cry\}/g, '◯').length > 16) bad('モンスターの声は短く', r);
check('種ごとの鳴き声が30種', rows.filter(r => r.id.startsWith('mon.cry.')).length === 30);
// ⑨ 出来事の見出し(VIDEO-REF 参考動画2の3種類): どの行も見出しの表のどれかに当たる
const { monsucScriptHeadOf } = require(path.join(DIR, 'heads.js'));
const noHead = rows.filter(r => !monsucScriptHeadOf(r.id));
check('どの行も見出し(育成イベント/編成の子のイベント/メインのお話/なし)に当たる', noHead.length === 0, noHead.slice(0, 3).map(r => r.id).join(', '));

// ⑩ 大会の常連(regulars.js): 種は公開ずみの28種(コラボ・下書きを除く)・大会ごとに常連3+王者1・名前が重ならない
{
  const { MONSUC_REGULAR_CUPS: CUPS, MONSUC_REGULARS: REG } = require(path.join(DIR, 'regulars.js'));
  const OK_SPECIES = new Set(['Mocchi', 'Suezo', 'Golem', 'Tiger', 'Ham', 'Pixie', 'Mia', 'Pandora', 'Monol', 'Oboro', 'Plant', 'Zan', 'Eiki',
    'KenshiMocchi', 'Mitarashi', 'Ark', 'Iblis', 'Snegurochka', 'Undine', 'Yaobikuni', 'Yggdrasil', 'MelWhip', 'Ghost', 'Spooky', 'Illumine', 'Dreamy', 'Kyubi', 'Orihime']);
  const regBad = [];
  const names = new Set();
  for (const r of REG) {
    if (!OK_SPECIES.has(r.species)) regBad.push(`${r.id} 種 ${r.species}`);
    if (!CUPS[r.cup]) regBad.push(`${r.id} 大会 ${r.cup}`);
    if (names.has(r.mon)) regBad.push(`${r.id} 名前が重なる ${r.mon}`);
    names.add(r.mon);
    if (/子/.test((r.mon + r.note).replace(/調子|様子/g, ''))) regBad.push(`${r.id} 「子」`);
  }
  for (const c of Object.keys(CUPS)) {
    const list = REG.filter(r => r.cup === c);
    if (list.filter(r => r.champ).length !== 1 || list.filter(r => !r.champ).length < 3) regBad.push(`${c} は常連3以上+王者1`);
  }
  check('大会の常連(公開ずみの種・大会ごとに常連3+王者1・名前が重ならない)', regBad.length === 0, regBad.length ? regBad.slice(0, 3).join(' / ') : `${Object.keys(CUPS).length}大会・${REG.length}体`);
}

check('id・who・表情・差しこみ・口調・言葉', problems.length === 0, problems.length ? `${problems.length}件` : '');
for (const p of problems.slice(0, 15)) console.log('  ' + p);
if (problems.length > 15) console.log(`  … ほか ${problems.length - 15}件`);

if (SHOW_COUNT) {
  const byWho = {};
  for (const r of rows) byWho[r.who] = (byWho[r.who] || 0) + 1;
  console.log('本数:', JSON.stringify(perFile), '/ だれ:', JSON.stringify(byWho), '/ 合計', rows.length);
}
console.log(failed ? `NG ${failed}件` : 'すべて OK');
process.exit(failed ? 1 : 0);

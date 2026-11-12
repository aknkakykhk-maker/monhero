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
//      プレイヤーを「ブリーダー(さん)」と呼びかけない(話しかけるときは {name}。立場として「ブリーダーの{name}」と書くのはよい・社長 2026-11-12)・
//      「スタミナ」「HP」ではなく「体力」・地の文と札に略称「モンサク」を書かない
//   ⑪ 第4弾: 助手ごとのファイル(asst-<助手>.js)。その助手の口調・シナリオの話がそろっている・あつと同じ場面に行がある
const fs = require('fs');
const path = require('path');

const DIR = path.resolve(__dirname, '../../docs/progress/player-raise/script');
// 第4弾から、残りの助手はひとり1ファイル(asst-<助手>.js)。あるものを全部読む
const ASST_FILES = fs.readdirSync(DIR).filter(f => /^asst-[a-z]+\.js$/.test(f)).sort();
const FILES = ['turn.js', 'turn-bond12.js', 'turn2.js', 'scenario.js', 'cheer.js', 'issa.js', 'random.js', 'rival.js', 'rival-owner.js', 'events-bond12.js', 'items.js', 'mon.js', ...ASST_FILES];
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
  // 「ブリーダー」は立場・肩書きとしてなら書いてよい(「ブリーダーの{name}」)。止めるのは呼びかけの形だけ(社長 2026-11-12「プレイヤーはブリーダー。でも呼び名は名前」)
  if (/ブリーダー(さん|くん|ちゃん|様|殿)|(^|[\s。！？!?「…])ブリーダー(?=[、,！!？?…]|$)/.test(t)) bad('プレイヤーに「ブリーダー」と呼びかけない({name})', r);
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

// ⑪ 第4弾: 助手ごとのファイル(asst-<助手>.js)
//   口調の決まり(assistants.js の speech): 助手ごとに「出ていないといけないくせ」の割合と「出てはいけない言い方」
const VOICE = {
  kiki: { must: /でつ|まつ/, mustRate: 0.5, mustName: '「でつ」「まつ」', ng: /あたし|俺|僕|おで(?!こ)|(?<![いけ])だよ|だね|してよ|ぢゃん|ｗ/, ngName: 'ききは敬語・一人称「私」(タメ口・ほかの助手の話し方にしない)' },
  momosuke: { must: /w|♡|！！/, mustRate: 0.6, mustName: '「w」「♡」「！！」', ng: /私|あたし|俺|僕|おで(?!こ)|でつ(?!か)|まつ|ｗ|ぢゃん|まぢ|笑(?![顔っいわ])/, ngName: 'ももすけは一人称「もも」・笑いは半角の w(ほかの助手の話し方にしない)' },
  dra: { must: /おで|えへへ|くさ|ふむ|なるほど|たしかに|からな|だな|よな|わ(?=[。！？…]|$)/, mustRate: 0.5, mustName: 'ドラのくせ(おで・えへへ・からな・だな…)', ng: /私|あたし|俺|僕|でつ(?!か)|まつ|ｗ|(?<![A-Za-z])w(?![A-Za-z])|♡|ぢゃん|まぢ|ほんま|やな(?![い])|なんよ|んよ/, ngName: 'ドラは一人称「おで」・関西弁と「〜んよ」を使わない(ほかの助手の話し方にしない)' },
  kyuko: { must: /笑(?![顔っいわ])|(?<![A-Za-z])w(?![A-Za-z])|ほい|おけ|ありがとん|ぐぬぬ|[ぇぁぉ](?=[！？。w笑…〜\s]|$)|😭|🤣|🥺|🫂|💦/, mustRate: 0.7, mustName: 'きゅうこのくせ(笑・w・ぇぁぉ・ほい・おけ…)', ng: /私|あたし|僕|おで(?!こ)|でつ(?!か)|まつ|ｗ|♡|ぢゃん|まぢ|笑(?![顔っいわ]).*(?<![A-Za-z])w(?![A-Za-z])|(?<![A-Za-z])w(?![A-Za-z]).*笑(?![顔っいわ])/, ngName: 'きゅうこは一人称「俺」・1本に「笑」と「w」を両方付けない(ほかの助手の話し方にしない)' },
  erubin: { must: /ね|かな|笑(?![顔っいわ])|(?<![A-Za-z])w(?![A-Za-z])|おけ|いいね|さすが|☺️|😊|🤔|💦/u, mustRate: 0.8, mustName: 'えるびんのくせ(〜ね・〜かな・笑・w・おけ…)', ng: /あたし|僕|おで(?!こ)|でつ(?!か)|まつ|ｗ|♡|ぢゃん|まぢ|笑(?![顔っいわ]).*(?<![A-Za-z])w(?![A-Za-z])|(?<![A-Za-z])w(?![A-Za-z]).*笑(?![顔っいわ])/, ngName: 'えるびんは一人称「俺」(丁寧なときは「私」)・1本に「笑」と「w」を両方付けない(ほかの助手の話し方にしない)' },
  // ソラシドは仲良し度で話し方が変わる(Lv1〜3 / Lv4〜8 / Lv9〜15 / Lv16〜)。丁寧語が土台。「俺」「っす」は Lv9〜 の版だけ(下の段ごとの見張り)
  sorashido: { must: /です|ます|でした|ました|ません|ましょう|ください|っす|んす/, mustRate: 0.85, mustName: '丁寧語(Lv9〜 の「っす」も)', ng: /私|あたし|僕|おで(?!こ)|でつ(?!か)|まつ|ｗ|(?<![A-Za-z])w(?![A-Za-z])|♡|ぢゃん|まぢ|だぜ|ぜ(?=[。！？・]|$)/, ngName: 'ソラシドは丁寧語が土台・笑いは全角の「笑」・「〜ぜ」を使わない(ほかの助手の話し方にしない)' },
};
// あつの行がある場面(シナリオを除く)= シナリオの助手が話す場面。あつだけの場面(博士のかけ合いの組・受けて立った)は除く
const sceneOf = id => id.replace(/\.[^.]+$/, '');
const ATSU_ONLY = /^issa\.(tease\.|after\.fire)/;
const needScenes = new Set(rows.filter(r => r.who === 'atsu' && !r.id.startsWith('scn.') && !r.id.startsWith('ev.rival.owner.') && !ATSU_ONLY.test(r.id)).map(r => sceneOf(r.id)));
for (const f of ASST_FILES) {
  const who = f.replace(/^asst-|\.js$/g, '');
  const mine = rows.filter(r => r.file === f && r.who === who);
  const v = VOICE[who];
  const stray = rows.filter(r => r.file === f && !['narr', 'choice', 'issa', who].includes(r.who));
  for (const r of stray) bad(`${f} に ${who} 以外の助手の行`, r);
  let hit = 0;
  for (const r of mine) {
    if (v && v.must.test(r.t)) hit++;
    if (v && v.ng.test(r.t)) bad(v.ngName, r);
  }
  const rate = mine.length ? hit / mine.length : 0;
  const scenes = new Set(mine.map(r => sceneOf(r.id)));
  const miss = [...needScenes].filter(s => !scenes.has(s));
  const scn = ['ep1', 'ep2', 'ep3', 'ep4', 'sp', 'cup1', 'cup2'].filter(k => !rows.some(r => r.file === f && r.id.startsWith(`scn.${who}.${k}.`)));
  const ends = ['good', 'bitter'].filter(k => !rows.some(r => r.file === f && r.id.startsWith(`scn.${who}.ep4.${k}.`)));
  const okAll = (!v || rate >= v.mustRate) && miss.length === 0 && scn.length === 0 && ends.length === 0;
  const detail = [`${mine.length}本`, v ? `${v.mustName} ${Math.round(rate * 100)}%` : '口調の決まりは未登録',
    miss.length ? `場面が足りない ${miss.length}: ${miss.slice(0, 3).join(', ')}` : '',
    scn.length ? `話が足りない: ${scn.join(',')}` : '', ends.length ? `4話の結末が足りない: ${ends.join(',')}` : ''].filter(Boolean).join(' / ');
  check(`${f}(口調・シナリオの話・場面のそろい)`, okAll, detail);
}

// ⑫ ソラシドの段ごとの版(窓口 2026-11-12「仲良し度で話し方が変わる子は段ごとに持つ」)
//   bond の無い行は Lv4〜8 の形。のばし・絵文字・「ほほー」がある行は、Lv1〜3 版(id の最後に b・bond:[1,3])が要る(4話・特別な1話・その大会は Lv5〜 だけなので除く)
//   Lv1〜3 版はのばし・絵文字・「ほほー」なし。一人称「俺」と「っす」は Lv9〜 の版(bond の下が9以上)だけ
//   Lv9〜15 版(c)・Lv16〜 版(d)は、bond の無い行すべてに要る(台本に1本でもあれば、その段のそろいを見る)
{
  const sora = rows.filter(r => r.who === 'sorashido' && r.file.startsWith('asst-'));
  if (sora.length) {
    const STRETCH = /[ねたしす]ー(?=[！。？\s]|$)|[🤔👀💦]|ほほー/u;
    const ids = new Set(sora.map(r => r.id));
    const lowOf = r => Array.isArray(r.bond) ? r.bond[0] : (typeof r.bond === 'number' ? r.bond : 0);
    const missB = sora.filter(r => !r.bond && STRETCH.test(r.t.replace(/ちばりよー/g, '')) && !/^scn\.sorashido\.(ep4|sp|cup2)\./.test(r.id) && !ids.has(r.id + 'b'));
    for (const r of sora) {
      if (Array.isArray(r.bond) && r.bond.join() === '1,3' && STRETCH.test(r.t.replace(/ちばりよー/g, ''))) bad('ソラシドの Lv1〜3 版はのばし・絵文字・「ほほー」なし', r);
      if (lowOf(r) < 9 && /俺|っす/.test(r.t)) bad('ソラシドの「俺」「っす」は Lv9〜 の版だけ', r);
    }
    check('ソラシドの段ごとの版(Lv1〜3 版がそろっている)', missB.length === 0, missB.length ? `足りない ${missB.length}本: ${missB.slice(0, 3).map(r => r.id).join(', ')}` : `Lv1〜3 版 ${sora.filter(r => Array.isArray(r.bond) && r.bond.join() === '1,3').length}本`);
 
    // Lv9〜15 版(id の最後に c・bond:[9,15])と Lv16〜 版(d・bond:16)は、bond の無い行すべてに要る(rival-owner.js のソラシドの行も)
    //   Lv9〜 の版の一人称は「俺」(「自分」は使わない)。Lv9〜15 版は「っす」「んす」がたいてい入る
    const soraAll = rows.filter(r => r.who === 'sorashido');
    const allIds = new Set(soraAll.map(r => r.id));
    const TIERS = [['c', '9,15', 'Lv9〜15'], ['d', '16', 'Lv16〜']].filter(([k]) => soraAll.some(r => r.id.endsWith(k) && r.bond));
    for (const [k, b, name] of TIERS) {
      const miss = soraAll.filter(r => !r.bond && !allIds.has(r.id + k));
      const mine = soraAll.filter(r => r.bond && String(r.bond) === b);
      for (const r of soraAll) if (r.bond && r.id.endsWith(k) && String(r.bond) !== b) bad(`ソラシドの ${name} 版(${k})は bond:${b.includes(',') ? `[${b}]` : b}`, r);
      for (const r of mine) if (/自分/.test(r.t)) bad(`ソラシドの ${name} 版の一人称は「俺」`, r);
      const ssu = mine.filter(r => /っす|んす/.test(r.t)).length;
      const ok = miss.length === 0 && (k !== 'c' || ssu >= mine.length * 0.8);
      check(`ソラシドの段ごとの版(${name} 版がそろっている)`, ok, miss.length ? `足りない ${miss.length}本: ${miss.slice(0, 3).map(r => r.id).join(', ')}` : `${mine.length}本${k === 'c' ? ` /「っす」${Math.round(ssu / Math.max(1, mine.length) * 100)}%` : ''}`);
    }
  }
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

// 6人目の助手「きゅうこ」(2026-10-22 社長の決定)の決まりを見張る。ブラウザは使わない。
//
//   node tools/assistant/kyuko-check.js
//
// 見ているもの(決めごとの正本は docs/rules/PRESIDENT_DECISIONS.md の 2026-10-22 の行):
//   ・口調 … 一人称は「俺」。語尾に「笑」と「w」の両方(1行に両方は付けない)。ほかの助手の一人称・下ネタ・あつのくせ(勇者・パーティ)が混ざらない
//   ・呼び方 … きゅうこ→みゅあ「みゅあねぇ」(2026-10-23 社長。前は「みゅあネキ」)/きき「ききさん」/もも「ももすけ」/ドラ「ドラちゃん」/あつ「あつニキ」、
//              みゅあ→「きゅきゅ」/きき→「きゅうこさん」/もも→「きゅうちゃん」/ドラ・あつ→「きゅうこちゃん」。お話の中でも守る
//   ・解放 … 最初から選べる(ASSISTANT_UNLOCK_STORIES に入れない)。公開の印 assistantKyuko が偽のあいだは一覧にも出ない
//   ・お話 … イルミネ・ドリーミィが出る。きゅうこは登場まで顔を伏せる。Toward the Stars に変わる行で数秒止まる。技名は「おもちゃの爆弾」だけ。モンバトのランカー
//   ・カード「きゅうこの譜面」… ガッツ20・Lv0 -30%2T / Lv1 -45%3T / Lv2 -60%4T・🔥は上げない・単体攻撃だけ使った子へ向ける。
//                               お話を見たあとマーケットで 150000(見たかは既存の「見終えたお話の id」で持つ・新しいキーは作らない)
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '../..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
let failed = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ' — ' + detail : ''}`); if (!ok) failed++; };

const load = (extra = '') => {
  const ctx = { console, Date, Math, JSON, Object, Array, Set, Map, WeakMap, Number, String, RegExp, localStorage: { getItem() { return null; }, setItem() {} }, window: {} };
  vm.createContext(ctx);
  vm.runInContext(`${extra}\n${read('monster-hero/data/assistants.js')}
;globalThis.__a = { ASSISTANTS, ASSISTANT_SCENES, ASSISTANT_LINE_PACKS, ASSISTANT_PEER_CALLS, ASSISTANT_UNLOCK_STORIES, EVENT_REPLAYS, STORY_GUEST_SPEAKERS,
  assistantBondLevelsOf, assistantReleased, assistantUnlockedBy, assistantCallStylesOf, ASSISTANT_CHAT_EXAMPLES, assistantFaceImage, assistantFullImage, assistantSpamLinesOf, eventScriptForPlayer };`, ctx);
  return ctx.__a;
};
const a = load();
const kyuko = a.ASSISTANTS.find(x => x.id === 'kyuko');
check('ASSISTANTS にきゅうこがいる', !!kyuko && kyuko.name === 'きゅうこ' && kyuko.role === '助手' && /俺/.test(kyuko.firstPerson));

// ---- 口調 ----
const lines = Object.entries(a.ASSISTANT_SCENES).flatMap(([k, d]) => [...(d.lines || []), ...Object.values(d.when || {}).flat()]
  .filter(l => l.who === 'kyuko').map(l => ({ k, t: String(l.t) })));
const atsuCount = Object.values(a.ASSISTANT_SCENES).flatMap(d => [...(d.lines || []), ...Object.values(d.when || {}).flat()]).filter(l => l.who === 'atsu').length;
check('きゅうこのセリフが、あつと同じくらいある', lines.length >= 500 && lines.length >= atsuCount - 20, `${lines.length}本(あつ ${atsuCount}本)`);
const packOnly = {};
for (const pack of a.ASSISTANT_LINE_PACKS) for (const [k, list] of Object.entries(pack.lines || {})) {
  if (a.ASSISTANT_SCENES[k] || !Array.isArray(list) || !list.length) continue;
  (packOnly[k] = packOnly[k] || new Set()).add(pack.assistantId || 'mua');
}
const packMissing = Object.entries(packOnly).filter(([, who]) => who.has('atsu') && !who.has('kyuko')).map(([k]) => k);
check('束だけで作る場面にも、きゅうこのセリフがある', packMissing.length === 0, packMissing.join(', '));
const story = a.EVENT_REPLAYS.find(e => e.id === 'kyuko_join_2026_10_22');
const storyLines = story ? story.script : [];
const all = [...lines, ...storyLines.filter(l => l.who === 'kyuko').map(l => ({ k: 'story', t: String(l.t) }))];
const bad = (re) => all.filter(l => re.test(l.t));
const show = (list) => list.slice(0, 3).map(l => `${l.k}:${l.t}`).join(' / ');
check('一人称に、ほかの助手のもの(おで・ワイ・あたし・私・僕・もも)が混ざらない', bad(/おで|ワイ|あたし|私|僕|ももは|ももが|でつ|まつ[。！]/).length === 0, show(bad(/おで|ワイ|あたし|私|僕|ももは|ももが|でつ|まつ[。！]/)));
check('一人称「俺」を使っている', bad(/俺/).length >= 15, `${bad(/俺/).length}本`);
check('語尾に「笑」と「w」をどちらも使う', bad(/笑/).length >= 20 && bad(/(?<![A-Za-z])w(?![A-Za-z])/).length >= 20, `笑${bad(/笑/).length}・w${bad(/(?<![A-Za-z])w(?![A-Za-z])/).length}`);
check('1行に「笑」と「w」の両方は付けない', bad(/笑[\s\S]*(?<![A-Za-z])w(?![A-Za-z])|(?<![A-Za-z])w(?![A-Za-z])[\s\S]*笑/).length === 0, show(bad(/笑[\s\S]*(?<![A-Za-z])w(?![A-Za-z])|(?<![A-Za-z])w(?![A-Za-z])[\s\S]*笑/)));
check('くせが出ている(ほい・おけ・小さい「ぇぁぉ」でのばす)', bad(/ほい/).length >= 5 && bad(/おけ/).length >= 3 && bad(/[ぇぁぉ](?=[！？。w笑…〜 ]|$)/).length >= 20,
  `ほい${bad(/ほい/).length}・おけ${bad(/おけ/).length}・ぇぁぉ${bad(/[ぇぁぉ](?=[！？。w笑…〜 ]|$)/).length}`);
check('下ネタを言わない', bad(/膝枕|おなら|何がとは|何想像|夜の部|下ネタ/).length === 0, show(bad(/膝枕|おなら|何がとは|何想像|夜の部|下ネタ/)));
check('あつのくせ(勇者のたとえ・パーティ・ギルド・上等)を借りない', bad(/勇者(?!モン|の証|特性)|パーティ|ギルド|上等/).length === 0, show(bad(/勇者(?!モン|の証|特性)|パーティ|ギルド|上等/)));
check('自分で「リーダー」と言わない', bad(/(?<!ブ)リーダー/).length === 0, show(bad(/(?<!ブ)リーダー/)));
check('遊ぶ人の腕をけなす言い方をしない', bad(/下手|へたくそ|ヘタ|雑魚|ざこ|センスない|向いてない/).length === 0, show(bad(/下手|へたくそ|ヘタ|雑魚|ざこ|センスない|向いてない/)));
check('連打のセリフ・おしゃべりの見本がある', a.assistantSpamLinesOf('kyuko').some(l => /ぐぬぬ/.test(l.t)) && (a.ASSISTANT_CHAT_EXAMPLES.kyuko || []).length >= 5);

// ---- 呼び方 ----
const pc = a.ASSISTANT_PEER_CALLS;
check('呼び方の表(きゅうこ→ほか)', JSON.stringify(pc.kyuko) === JSON.stringify({ mua: 'みゅあねぇ', kiki: 'ききさん', momosuke: 'ももすけ', dra: 'ドラちゃん', atsu: 'あつニキ', sorashido: 'ソラ' }), JSON.stringify(pc.kyuko));
check('呼び方の表(ほか→きゅうこ)', pc.mua.kyuko === 'きゅきゅ' && pc.kiki.kyuko === 'きゅうこさん' && pc.momosuke.kyuko === 'きゅうちゃん' && pc.dra.kyuko === 'きゅうこちゃん' && pc.atsu.kyuko === 'きゅうこちゃん');
const callBad = storyLines.filter(l => {
  const t = String(l.t).replace(/きゅうこの譜面/g, '');
  if (l.who === 'mua') return /きゅうこ|きゅうちゃん/.test(t);
  if (l.who === 'kiki') return /きゅきゅ|きゅうちゃん|きゅうこちゃん/.test(t);
  if (l.who === 'momosuke') return /きゅきゅ|きゅうこ/.test(t);
  if (l.who === 'dra' || l.who === 'atsu') return /きゅきゅ|きゅうちゃん|きゅうこさん/.test(t);
  if (l.who === 'kyuko') return /みゅあ(?!ねぇ)|もも(?!すけ)|あつ(?!ニキ)|きき(?!さん)/.test(t);
  return false;
});
check('お話の中でも呼び方を守る', callBad.length === 0, callBad.map(l => `${l.who}:${l.t}`).join(' / '));
// 加入のお話は、あつを解放しているかで行が替わる(2026-10-23 社長「あつが解放されてるかどうかの分岐もきゅうこ登場含めて」)
{
  const ar = load('var RELEASE_FLAGS = { assistantAtsu: true, assistantKyuko: true };');
  const st = ar.EVENT_REPLAYS.find(e => e.id === 'kyuko_join_2026_10_22');
  const withAtsu = ar.eventScriptForPlayer(st.script, ['atsu_join_2026_10_22']), noAtsu = ar.eventScriptForPlayer(st.script, []);
  check('加入のお話: あつを解放している人の版は、今までどおりあつが出る(差し替えの行は出ない)', withAtsu.some(l => l.who === 'atsu') && withAtsu.every(l => l.atsu !== 'without') && withAtsu.length === 55, `${withAtsu.length}行`);
  check('加入のお話: 解放していない人の版には、あつが一度も出ない・あつの話も出ない', noAtsu.every(l => l.who !== 'atsu' && l.atsu !== 'with' && !/あつ/.test(String(l.t))) && noAtsu.length === 55, `${noAtsu.length}行`);
  check('加入のお話: きゅうこ→みゅあは「みゅあねぇ」(両方の版)', [withAtsu, noAtsu].every(v => v.some(l => l.who === 'kyuko' && /みゅあねぇに、ききさん/.test(l.t))));
}
// あつを解放していない人への差し替えの行(atsu:'without')も、上の見張りに入っている(2026-10-23)
check('あつなしの差し替えの行も見ている', storyLines.some(l => l.atsu === 'without') && storyLines.filter(l => l.atsu === 'with').length > 0, `差し替え ${storyLines.filter(l => l.atsu === 'without').length}行`);

// ---- お話 ----
check('お話は回想に登録され、公開の印 assistantKyuko で出る', !!story && story.releaseFlag === 'assistantKyuko' && story.unlockedKey === 'kyukoJoinSeen');
check('きゅうこは登場の行まで顔を伏せる', !!story && Array.isArray(story.hideUntilFirstLine) && story.hideUntilFirstLine.includes('kyuko'));
const guests = (a.STORY_GUEST_SPEAKERS || []).map(g => g.id);
check('イルミネ・ドリーミィがお話の話し手として出る', guests.includes('illumine') && guests.includes('dreamy')
  && storyLines.some(l => l.who === 'illumine') && storyLines.some(l => l.who === 'dreamy'));
const firstKyuko = storyLines.findIndex(l => l.who === 'kyuko');
const bgmIdx = storyLines.findIndex(l => l.bgm === 'melo_toward_the_stars_short');
check('きゅうこの登場の前に Toward the Stars へ変わり、数秒止まる', bgmIdx >= 0 && bgmIdx < firstKyuko && Number(storyLines[bgmIdx].holdMs) >= 2000,
  `曲の行 ${bgmIdx}・登場 ${firstKyuko}`);
check('2体が遊んでいるところから始まる(きゅうこより先に2体が出る)', storyLines.findIndex(l => l.who === 'dreamy') < firstKyuko && storyLines.findIndex(l => l.who === 'illumine') < firstKyuko);
const storyText = storyLines.map(l => l.t).join('\n');
check('きゅうこはモンバトのランカー(モンビーのランカーと言わない)', /モンバトのランカー/.test(storyText) && !/モンビーのランカー/.test(storyText));
check('技名は「おもちゃの爆弾」だけ・値段は書かない', /おもちゃの爆弾/.test(storyText) && !/ダイヤ|150,?000|円盤石/.test(storyText));
const bgmSrc = read('monster-hero/src/parts/13-bgm-and-rhythm-settings.jsx');
check('お話の最初の曲はイベントBGM 1(設定で替えられる)', /kyukoJoinStoryEvent:'original_event_01'/.test(bgmSrc) && /kyuko_join_2026_10_22:'kyukoJoinStoryEvent'/.test(bgmSrc));

// ---- 解放・公開前 ----
check('最初から選べる(加入のお話で解放しない)', !a.ASSISTANT_UNLOCK_STORIES.kyuko);
const rel = read('monster-hero/src/parts/17-release-changelog-login-missions.jsx');
const app = read('monster-hero/src/parts/60-app.jsx');
const flagOn = /assistantKyuko:\s*true/.test(rel);
check('公開の印 assistantKyuko が RELEASE_FLAGS にある', /assistantKyuko:\s*(true|false)/.test(rel));
check('印が偽(読めない)ときは選べない', a.assistantReleased('kyuko') === false && a.assistantUnlockedBy('kyuko', []) === false);
const on = load('var RELEASE_FLAGS = { assistantKyuko: true };');
check('印が真なら、お話を見ていなくても選べる', on.assistantUnlockedBy('kyuko', []) === true);
check('ゲーム側のお話の id がデータと同じ', rel.includes("const KYUKO_JOIN_STORY_ID = 'kyuko_join_2026_10_22';"));
check('見たかどうかは既存の「見終えたお話の id」の並びで持つ(新しい保存キーを作らない)',
  /RHYTHM_EVENT_STORY_IDS = \[[^\]]*KYUKO_JOIN_STORY_ID\]/.test(app) && /kyukoJoinSeen: Array\.isArray\(rhythmEventStorySeen\) && rhythmEventStorySeen\.includes\(KYUKO_JOIN_STORY_ID\)/.test(app)
  && !/mh_[a-z_]*kyuko/.test(app + rel + read('monster-hero/data/breeder.js')));
check('お話を流すのは公開の印が立ったときだけ(だれにでも1回)',
  /setKyukoJoinSeenForShop\([\s\S]{0,200}EVENT_REPLAY_RELEASE_FLAGS\.assistantKyuko\) return;[\s\S]{0,200}rhythmEventStorySeen\.includes\(KYUKO_JOIN_STORY_ID\)\) return;/.test(app));
check('holdMs の行はタップしても進まない', /const holdMs=Number\(line\.holdMs\);\s*if\(Number\.isFinite\(holdMs\)&&holdMs>0&&Date\.now\(\)-\(Number\(eventReplay\.shownAt\)\|\|0\)<holdMs\) return;[\s\S]{0,80}shownAt:Date\.now\(\)/.test(app));
const digest = JSON.parse(read('monster-hero/data/assistant-chat-digest.json'));
if (!flagOn) check('公開前は、おしゃべりの材料にきゅうこを入れない(ほかの助手も名前を出さない)', !digest.assistants.kyuko && !/きゅうこ|きゅきゅ|きゅうちゃん/.test(JSON.stringify(digest)));
else check('公開したら、おしゃべりの材料にきゅうこの人柄がある', !!digest.assistants.kyuko);

// ---- カード ----
const bctx = { console, Math, JSON, Object, Array, Number, String, localStorage: { getItem() { return null; }, setItem() {} } };
vm.createContext(bctx);
const breederSrc = read('monster-hero/data/breeder.js');
const pick = (name) => { const i = breederSrc.indexOf(`const ${name} = `); return breederSrc.slice(i, breederSrc.indexOf('\n];', i) + 3).replace(/^const /, 'var '); };
vm.runInContext(`${pick('KYUKO_TIERS')}\n${breederSrc.slice(breederSrc.indexOf('let kyukoJoinSeenForShop'), breederSrc.indexOf('const BREEDER_MARKET_ITEMS'))}
var BREEDER_EVO_NAMES = ${breederSrc.slice(breederSrc.indexOf('const BREEDER_EVO_NAMES = ') + 'const BREEDER_EVO_NAMES = '.length, breederSrc.indexOf('};', breederSrc.indexOf('const BREEDER_EVO_NAMES = ')) + 1)};
globalThis.__b = { KYUKO_TIERS, setKyukoJoinSeenForShop, kyukoCardOnSale, BREEDER_EVO_NAMES };`, bctx);
const b = bctx.__b;
check('効果量は社長の決定どおり(Lv0 -30%2T / Lv1 -45%3T / Lv2 -60%4T)', JSON.stringify(b.KYUKO_TIERS) === JSON.stringify([{ cut: 0.3, turns: 2 }, { cut: 0.45, turns: 3 }, { cut: 0.6, turns: 4 }]));
check('段階の名前は 譜面 → 編曲 → 交響曲', JSON.stringify(b.BREEDER_EVO_NAMES.kyuko) === JSON.stringify(['きゅうこの譜面', 'きゅうこの編曲', 'きゅうこの交響曲']));
check('カードはガッツ20・はじめから持つカードではない', /\{ id:'kyuko', baseName:"きゅうこの譜面", icon:KYUKO_FACE_ICON, type:'buff', subType:'cover_kyuko',[^\n]*guts:20 \}/.test(breederSrc)
  && !/STARTER_TEACHING_IDS = \[[^\]]*'kyuko'/.test(breederSrc));
check('マーケットに 150000 で置く', /\{ id:'kyuko', name:"アシストカード「きゅうこ」", type:'assist', icon:KYUKO_FACE_ICON, cost:150000,/.test(breederSrc));
bctx.RELEASE_FLAGS = { assistantKyuko: false }; b.setKyukoJoinSeenForShop(true);
const offWhenUnreleased = b.kyukoCardOnSale() === false;
bctx.RELEASE_FLAGS = { assistantKyuko: true }; b.setKyukoJoinSeenForShop(false);
const offBeforeStory = b.kyukoCardOnSale() === false;
b.setKyukoJoinSeenForShop(true);
check('マーケットに並ぶのは、公開の印が立ち、お話を見たあとだけ', offWhenUnreleased && offBeforeStory && b.kyukoCardOnSale() === true);
const tac = read('monster-hero/src/parts/32-tactics-units.jsx');
check('🔥は上げない(タクティクスの行動の種類 cover・量0)', /assist: \{[^}]*kyuko: 'cover'/.test(tac) && /action: \{[^}]*cover: 0[,\s]/.test(tac));
const fnSrc = tac.slice(tac.indexOf('const redirectTacticsSingleTarget = '), tac.indexOf('const coverTacticsTargets = '));
const tctx = { tacticsAliveSlots: (units) => units.map((u, i) => (u && u.hp > 0 ? i : -1)).filter(i => i >= 0) };
vm.createContext(tctx); vm.runInContext(fnSrc.replace(/^const /, 'var '), tctx);
const units = [{ hp: 10 }, { hp: 10 }, { hp: 0 }, { hp: 10 }];
const r = tctx.redirectTacticsSingleTarget;
check('単体攻撃だけ使った子へ向く(全体攻撃・倒れた子・使っていないターンはそのまま)',
  JSON.stringify(r([0], { targetSlot: 0 }, 3, units)) === '[3]' && JSON.stringify(r([0, 1, 3], { targetsAll: true }, 3, units)) === '[0,1,3]'
  && JSON.stringify(r([0], { targetSlot: 0 }, 2, units)) === '[0]' && JSON.stringify(r([0], { targetSlot: 0 }, null, units)) === '[0]');
check('ゲーム側: カードの処理・被ダメの倍率・残りターンの減り・説明文がある',
  /card\.subType==='cover_kyuko'/.test(app) && /\*kyukoTakenMultAt\(slotIdx\)\)/.test(app) && /kyukoCutTurns:Math\.max\(0,p\.kyukoCutTurns-1\)/.test(app) && /if\(t\.id==='kyuko'\)\{/.test(app));

// ---- 絵 ----
const exps = ['normal', 'happy', 'wink', 'surprise', 'troubled', 'angry', 'crying', 'excited'];
check('顔の絵・大きい絵が8表情ぶんそろっている', exps.every(e => fs.existsSync(path.join(ROOT, 'monster-hero', a.assistantFaceImage(kyuko, e)))
  && fs.existsSync(path.join(ROOT, 'monster-hero', a.assistantFullImage(kyuko, e)))));
check('フレンド申請の知らせ・対戦画面の絵の寄せ方にもきゅうこがいる',
  /\n  kyuko: \(who\) =>/.test(read('monster-hero/src/parts/69-screen-home.jsx')) && /\n  kyuko: \{ zoom:/.test(read('monster-hero/src/parts/77-screen-rhythm-multi.jsx')));

console.log(failed ? `\n${failed}件のNGがあります` : '\nOK: きゅうこの決まりは守られている');
process.exit(failed ? 1 : 0);

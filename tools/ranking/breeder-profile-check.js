// ランキングに出す「いまの見た目」(breeder_profiles)のしかけを見る。2026-09-16。
//
//   node tools/ranking/breeder-profile-check.js
//
// 【なぜ要るか】
// ランキングは1プレイ=1行で、その瞬間の名前・アイコン・フレームを記録へ写している。
// あとから見た目を変えても過去の行は古いまま、というのが元の姿だった。
// そこを「1人1行の表から引く」へ変えたが、次のどれが崩れても画面はふつうに動いてしまう。
//   ・記録(rankings / bond_levels)を書き換えてしまう(いちばん危ない)
//   ・同名の別人へ他人の見た目を出す
//   ・表がまだ無い環境で、ランキングが開けなくなる
//   ・見た目を変えても送っていない(遊ぶまで変わらない)
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '../..');
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');
const supa = read('monster-hero/src/parts/26-supabase.jsx');
const app = read('monster-hero/src/parts/60-app.jsx');
const rhythm = read('monster-hero/data/rhythm-mode.js');
const compiled = read('monster-hero/game-system.compiled.js');
const applySql = read('docs/sql/rankings/BREEDER_PROFILE_APPLY.sql');

let failed = 0;
const check = (name, ok, detail = '') => {
  console.log(`${ok ? '✓' : '✗'} ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failed++;
};

// ===== ① 引き当ての規則を、実装そのものを動かして確かめる =====
const start = supa.indexOf('const BREEDER_PROFILES_TABLE');
const end = supa.indexOf('\n// ===== ブリーダーを見分けるID');
const block = start >= 0 && end > start ? supa.slice(start, end) : '';
check('引き当ての実装を抽出できる', block.length > 0);
if (!block) { console.log(`\n${failed}件のNGがあります`); process.exit(1); }

const ctx = {
  console, fetch: async () => { throw new Error('この検査では通信しない'); },
  AbortController, setTimeout, clearTimeout, JSON, Date, Math, Map, Error, Promise, Object, Array, String, Number,
  SUPABASE_URL: 'https://example.test', SB_HEADERS: {}, rankingLog: () => {},
  _isMissingTableError: () => false,
  normalizeProfileFrameId: (v) => (v === 'gold' || v === 'pink' || v === 'rainbow') ? v : 'none',
  rankingProfileFrameValue: (v) => (v && v !== 'none') ? v : null,
};
vm.createContext(ctx);
vm.runInContext(`${block}\n this.out={setBreederProfiles,applyLatestBreederProfile,latestBreederProfileFor,BREEDER_PROFILES_SELECT};`, ctx);
const P = ctx.out;

check('取ってくる列は4つだけ(重くしない)',
  P.BREEDER_PROFILES_SELECT === 'breeder_id,user_name,icon,profile_frame', P.BREEDER_PROFILES_SELECT);

const counted = P.setBreederProfiles([
  { breeder_id: 'bd-1', user_name: 'ひとりだけさん', icon: 'Mocchi', profile_frame: 'gold' },
  { breeder_id: 'bd-2', user_name: 'かぶってるさん', icon: 'Suezo', profile_frame: 'pink' },
  { breeder_id: 'bd-3', user_name: 'かぶってるさん', icon: 'Golem', profile_frame: 'rainbow' },
  { breeder_id: '', user_name: 'IDなし', icon: 'Tiger' },
]);
check('IDが空の行は捨てる', counted.ids === 3, `${counted.ids}件`);
check('同じ名前が2人以上いる名前は、名前から引けないようにする',
  counted.names === 1, `名前から引けるのは${counted.names}人`);

// IDで引く
check('① IDが合えば、いまの見た目で出す', (() => {
  const e = P.applyLatestBreederProfile({ breederId: 'bd-1', userName: '昔の名前', icon: 'Golem', profileFrame: 'none' });
  return e.userName === 'ひとりだけさん' && e.icon === 'Mocchi' && e.profileFrame === 'gold';
})());
check('① モンビーの合算・週間・イベントは identityKey から引ける', (() => {
  const e = P.applyLatestBreederProfile({ identityKey: 'bd-2', userName: '昔', icon: null, profileFrame: 'none' });
  return e.icon === 'Suezo' && e.profileFrame === 'pink';
})());
// 名前で引く
check('② IDの無い古い記録は、名前が1人に定まるときだけ引く', (() => {
  const e = P.applyLatestBreederProfile({ userName: 'ひとりだけさん', icon: '昔のアイコン', profileFrame: 'none' });
  return e.icon === 'Mocchi' && e.profileFrame === 'gold';
})());
check('② 同名の別人がいる名前には使わない(他人の見た目を出さない)', (() => {
  const e = P.applyLatestBreederProfile({ userName: 'かぶってるさん', icon: '記録のアイコン', profileFrame: 'none' });
  return e.icon === '記録のアイコン' && e.profileFrame === 'none';
})());
check('② identityKey が name: のときも、名前の規則で引く', (() => {
  const e = P.applyLatestBreederProfile({ identityKey: 'name:ひとりだけさん', userName: 'ひとりだけさん', icon: '昔', profileFrame: 'none' });
  return e.icon === 'Mocchi';
})());
// ③ 受け皿
check('③ 見つからない人は記録に写した値のまま', (() => {
  const e = P.applyLatestBreederProfile({ breederId: 'bd-unknown', userName: '知らない人', icon: '記録の値', profileFrame: 'pink' });
  return e.userName === '知らない人' && e.icon === '記録の値' && e.profileFrame === 'pink';
})());
check('null や壊れた行でも落ちない',
  P.applyLatestBreederProfile(null) === null && P.applyLatestBreederProfile(undefined) === undefined
  && P.setBreederProfiles(null).ids === 0 && P.setBreederProfiles([null, {}, 1]).ids === 0);

// ===== ② 記録を書き換えていないこと(いちばん危ない) =====
check('SQLは新しい表を1つ作るだけ(既存の表をalterしない)',
  !/alter table public\.(rankings|bond_levels)/i.test(applySql));
check('SQLは記録を消したり書き換えたりしない',
  !/(update|delete from|drop table|truncate)\s+public\.(rankings|bond_levels)/i.test(applySql));
check('消す権限は与えない', /revoke delete on public\.breeder_profiles from anon, authenticated;/.test(applySql));
check('1人1行(breeder_id が主キー)', /primary key \(breeder_id\)/.test(applySql));
check('フレームidの形は rankings と同じ検査制約', applySql.includes("profile_frame ~ '^[a-z0-9_]{1,40}$'"));
check('アプリも記録の側へは書かない(上書きするのは breeder_profiles だけ)',
  /sbUpsertBreederProfile = async[\s\S]{0,1600}\$\{BREEDER_PROFILES_TABLE\}\?on_conflict=breeder_id/.test(supa)
  && !/sbUpsertBreederProfile = async[\s\S]{0,1600}rest\/v1\/rankings/.test(supa));

// ===== ③ 表がまだ無い環境でも壊れない =====
check('表が無いと分かったら、そのセッションでは以後さわらない',
  supa.includes('let _breederProfilesUnavailable = false;')
  && /sbFetchBreederProfiles[\s\S]{0,1200}_breederProfilesUnavailable = true/.test(supa)
  && /sbUpsertBreederProfile[\s\S]{0,1800}_breederProfilesUnavailable = true/.test(supa));
check('取得に失敗しても投げない(順位は出る)',
  /ensureBreederProfiles[\s\S]{0,700}catch \(error\)[\s\S]{0,200}console\.error/.test(supa));
check('読み直しは間引く(ランキングを開くたびに読まない)',
  supa.includes('BREEDER_PROFILES_TTL_MS') && /Date\.now\(\) - _breederProfilesFetchedAt < BREEDER_PROFILES_TTL_MS/.test(supa));

// ===== ④ 取得の入口が、組み立て前にそろえていること =====
for (const fn of ['sbFetchRankings', 'sbFetchBondLevels', 'sbFetchRhythmRankings',
                  'sbFetchRhythmTotalRankings', 'sbFetchRhythmEventRows']) {
  check(`${fn} は組み立て前にプロフィールをそろえる`,
    new RegExp(`const ${fn} = async[\\s\\S]{0,700}?await ensureBreederProfiles\\(`).test(supa));
}

// ===== ⑤ 全ランキングが差し替えを通ること =====
for (const [name, src, label] of [
  ['toEntry', app, 'バトルのスコア・ブリーダーLv'],
  ['bondLevelRowToEntry', supa, '絆Lv・総合力'],
  ['rhythmTotalRankingEntryFromRow', supa, 'モンビー全曲合算'],
  ['rhythmEventSongEntryFromRow', supa, 'モンビーイベント(曲別)'],
  ['rhythmEventTotalEntryFromRow', supa, 'モンビーイベント(総合)'],
  ['rhythmWeekTotalEntryFromRow', supa, 'モンビー週間'],
  ['rhythmRankingEntryFromRow', rhythm, 'モンビー曲別'],
]) {
  check(`${label}(${name})が差し替えを通る`,
    new RegExp(`${name}\\s*=\\s*\\(row\\)\\s*=>[\\s\\S]{0,400}?applyLatestBreederProfile`).test(src)
    || new RegExp(`const ${name} = \\(r\\) => applyLatestBreederProfile`).test(src)
    || new RegExp(`const ${name}=\\(row\\)=>\\{[\\s\\S]{0,500}?applyLatestBreederProfile`).test(src));
}

// ===== ⑤-2 「名前 → ブリーダーID」の橋 =====
// 2026-09-16、ここが無くて「ランキングが重複で出てる」を出した。
// モンビーの記録にはIDが付いていて、これまでのバトルの記録には付いていない。
// IDのある行を id で、無い行を名前で束ねると、**同じ人が2行に割れて並ぶ**。
check('一覧のなかで「名前 → ID」の橋を作っている', /const breederIdBridgeFrom = \(entries\)/.test(supa));
check('同じ名前に2つ以上のIDがぶら下がるときは橋を架けない(別人を混ぜない)',
  /breederIdBridgeFrom[\s\S]{0,500}byName\.set\(name, null\)/.test(supa));
check('ブリーダーLvは橋を作ってから束ねる',
  /aggregateBreederLevels[\s\S]{0,600}breederIdBridgeFrom\(rows\)[\s\S]{0,400}resolveBreederIdFor\(r, bridge\)/.test(supa));
check('絆Lv・総合力は正本と旧経路の両方を見てから橋を作る',
  /mergeBondRankingEntries[\s\S]{0,600}breederIdBridgeFrom\(\[\.\.\.\(primaryEntries \|\| \[\]\), \.\.\.\(legacyEntries \|\| \[\]\)\]\)/.test(supa));
check('橋が無いときはプロフィール表の名前を見る(それも無ければ名前で束ねる)',
  /resolveBreederIdFor = \(entry, bridge = null\)[\s\S]{0,500}_breederProfileByName\.get\(name\)/.test(supa));

// ===== ⑤-3 登録がまだ無い人の受け皿(記録から枠を拾う) =====
// 2026-09-16、ここが無くて「過去のランキングにフレームが対応されてない」を出した。
// breeder_profiles に登録があるのはこの版を開いた人だけ。まだ開いていない人は
// 引き当てようが無く、同じ人の行なのに1行だけ枠が出る状態になっていた。
check('取ってきた行から、その人の枠を覚えている', /const rememberLooksFromRows = \(rows\)/.test(supa));
check('枠の入っている行だけを手がかりにする(列を足した後のプレイ＝新しい姿)',
  /rememberLooksFromRows[\s\S]{0,1200}if \(!frame \|\| frame === noneId\) return;/.test(supa));
check('正規化がまだ読めていない場面でも落ちない',
  /rememberLooksFromRows[\s\S]{0,1200}typeof normalizeProfileFrameId === 'function'/.test(supa));
check('時刻が取れるときは新しいほうを採る',
  /rememberLooksFromRows[\s\S]{0,900}at > cur\.at/.test(supa));
check('同じ名前の人が2人以上いるときは使わない(他人の枠を出さない)',
  /const recordFrameFor[\s\S]{0,500}_recordIdByName\.get\(name\) === null\) return null;/.test(supa));
check('プロフィール表に登録がある人は、そちらが優先',
  /const applyLatestBreederProfile[\s\S]{0,700}if \(profile\) \{[\s\S]{0,400}\}\s*\n\s*\/\/[\s\S]{0,200}recordFrameFor\(entry\)/.test(supa));
check('受け皿で変えるのは枠だけ(名前やアイコンは記録のまま)',
  /recordFrameFor\(entry\);\s*\n\s*return \(frame && frame !== entry\.profileFrame\) \? \{ \.\.\.entry, profileFrame: frame \} : entry;/.test(supa));
for (const [label, fn] of [['通常・ブリーダーLv', 'sbFetchRankings'], ['絆Lv・総合力', 'sbFetchBondLevels'],
                           ['モンビー曲別', 'sbFetchRhythmRankings'], ['モンビー合算', 'sbFetchRhythmTotalRankings'],
                           ['モンビーイベント・週間', 'sbFetchRhythmEventRows']]) {
  const block = (supa.split(`const ${fn} = async`)[1] || '').slice(0, 6000);
  check(`${label}(${fn})の取得で枠を覚えている`, block.includes('rememberLooksFromRows'));
}
check('時刻(created_at)は件数の決まっている一覧だけで取る(全件を読むブリーダーLvには足さない)',
  /RANKING_SELECT_FULL = 'user_name,hero,party,score,level,icon,created_at'/.test(supa)
  && /RHYTHM_RANKING_SELECT = '[^']*,created_at'/.test(supa)
  && /RANKING_SELECT_BREEDER = 'user_name,level,icon'/.test(supa));

// ===== ⑥ 「いまの見た目」を送るきっかけ =====
// 2026-09-16。最初は「変えたとき」と「遊んだあと」だけで送っていたが、それだと
// **一度も変えていない人の行が登録されない**。登録が無い人は引き当てようが無いので、
// ランキングはその人を記録に写した当時の見た目で出し続ける(画面ごとに枠が出たり
// 出なかったりして見える)。起動してセーブデータを読み終えた時点でも送るようにした。
const publishEffect = (app.match(/const lastPublishedProfileRef[\s\S]{0,900}?publishBreederProfile\(\);[\s\S]{0,200}?\]\);/) || [''])[0];
check('送るきっかけを決める場所を抽出できる', publishEffect.length > 0);
check('送るのは1か所だけ(ボタンごとに書かない)',
  (app.match(/publishBreederProfile\(/g) || []).length === 1,   // 呼び出しはeffectの1回だけ
  `${(app.match(/publishBreederProfile\(/g) || []).length}か所`);
check('起動してセーブデータを読み終えたら送る(一度も変えていない人も登録される)',
  /dataLoaded/.test(publishEffect) && /if \(!dataLoaded/.test(publishEffect));
check('名前・アイコン・フレームのどれかが変わったら送る',
  ['breederName', 'breederIcon', 'profileFrameId'].every(name => publishEffect.includes(name)));
check('同じ内容は送り直さない(通信を無駄にしない)',
  /lastPublishedProfileRef\.current === signature/.test(publishEffect)
  && /lastPublishedProfileRef\.current = signature/.test(publishEffect));
check('はじめての設定が終わるまでは送らない', /if \(!dataLoaded \|\| !onboarded \|\| onboardingPreview\) return;/.test(publishEffect));
check('「見るだけ」のプレビュー中は送らない',
  /publishBreederProfile = useCallback[\s\S]{0,300}if \(onboardingPreview\) return;/.test(app));
check('IDが作れない端末では送らない(その場合は記録の値で出る)',
  /publishBreederProfile = useCallback[\s\S]{0,600}if \(!breederId\) return;/.test(app));
check('送信に失敗しても進行を止めない',
  /publishBreederProfile = useCallback[\s\S]{0,900}catch \(error\)[\s\S]{0,200}console\.error/.test(app));

// ===== ⑦ 配信用JSにも入っている =====
check('配信用JSにも入っている(build忘れではない)',
  compiled.includes('breeder_profiles') && compiled.includes('applyLatestBreederProfile'));

console.log(failed === 0 ? '\nすべてOK' : `\n${failed}件のNGがあります`);
process.exit(failed === 0 ? 0 : 1);

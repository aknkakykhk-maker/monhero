// プロフィールフレーム(2026-09-15)のしかけをまとめて見る。
//
//   node tools/ranking/profile-frame-check.js
//
// 【なぜ要るか】
// この機能は「壊れても画面がふつうに動いてしまう」ところが多い。
//   ・未公開(released:false)の豪華フレームが、うっかり選択画面やランキングへ出る
//   ・profile_frame の列がまだ無い環境で、スコアが1件も保存できなくなる
//   ・図鑑・マーケット・円盤石にまで枠が付く
//   ・「フレームなし」の見た目が、これまでと変わってしまう
// どれも目で気づきにくいので、機械で見張る。
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '../..');
const read = (file) => fs.readFileSync(path.join(ROOT, file), 'utf8');
const breeder = read('monster-hero/data/breeder.js');
const widgets = read('monster-hero/src/parts/20-market-notices-help.jsx');
const supa = read('monster-hero/src/parts/26-supabase.jsx');
const app = read('monster-hero/src/parts/60-app.jsx');
const profileScreen = read('monster-hero/src/parts/56-screen-profile.jsx');
const homeScreen = read('monster-hero/src/parts/69-screen-home.jsx');
const bootstrap = read('monster-hero/src/parts/70-bootstrap.jsx');
const compiled = read('monster-hero/game-system.compiled.js');
const saveSpec = read('docs/spec/SAVE_DATA.md');

let failed = 0;
const check = (name, ok, detail = '') => {
  console.log(`${ok ? '✓' : '✗'} ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failed++;
};

// ===== ① フレームの定義と正規化(data/breeder.js を実際に動かす) =====
const frameStart = breeder.indexOf('const PROFILE_FRAME_NONE_ID');
const frameEnd = frameStart >= 0
  ? breeder.indexOf('\n', breeder.indexOf('const releasedProfileFrames')) + 1 : -1;
const frameBlock = frameStart >= 0 && frameEnd > frameStart ? breeder.slice(frameStart, frameEnd) : '';
check('フレームの定義を抽出できる', frameBlock.length > 0);
if (!frameBlock) { console.log(`\n${failed}件のNGがあります`); process.exit(1); }

const ctx = {};
vm.createContext(ctx);
vm.runInContext(`${frameBlock}\n this.out={PROFILE_FRAME_NONE_ID,PROFILE_FRAME_KEY,PROFILE_FRAMES,profileFrameById,normalizeProfileFrameId,releasedProfileFrames,rankingProfileFrameValue};`, ctx);
const F = ctx.out;

check('保存キーは新設の mh_profile_frame_v1', F.PROFILE_FRAME_KEY === 'mh_profile_frame_v1', F.PROFILE_FRAME_KEY);
check('既定は「フレームなし」', F.PROFILE_FRAME_NONE_ID === 'none');
const released = F.releasedProfileFrames().map(f => f.id);
check('最初から選べるのは none/silver/gold/blue/pink の5つ',
  JSON.stringify(released) === JSON.stringify(['none', 'silver', 'gold', 'blue', 'pink']), released.join(','));
check('公開フレームは画像を増やさない(kind:none か css だけ)',
  F.releasedProfileFrames().every(f => f.kind === 'none' || f.kind === 'css'));
check('どのフレームにも名前と説明がある',
  F.PROFILE_FRAMES.every(f => typeof f.name === 'string' && f.name && typeof f.desc === 'string' && f.desc));
check('idが重複していない', new Set(F.PROFILE_FRAMES.map(f => f.id)).size === F.PROFILE_FRAMES.length);

// 正規化。ここが唯一の「出してよいか」の判定なので、落ちると未公開が漏れる
check('知らないidはフレームなしへ倒れる', F.normalizeProfileFrameId('no_such_frame') === 'none');
check('null・数値・オブジェクトでも落ちない',
  F.normalizeProfileFrameId(null) === 'none' && F.normalizeProfileFrameId(12) === 'none'
  && F.normalizeProfileFrameId({}) === 'none' && F.normalizeProfileFrameId(undefined) === 'none');
check('公開フレームはそのまま通る', F.normalizeProfileFrameId('gold') === 'gold');
// 未公開の扱い。定義が1件も無いときも、仕組みが効いていることを確かめる
{
  const fake = { id: 'ornate_test', name: 'テスト', kind: 'image', released: false, src: 'x', desc: 'y' };
  const c2 = {};
  vm.createContext(c2);
  vm.runInContext(`${frameBlock.replace('  // ↓ ここへ未公開の豪華フレームを足す', `  ${JSON.stringify(fake)},\n  // ↓`)}\n this.out={normalizeProfileFrameId,releasedProfileFrames,profileFrameById};`, c2);
  check('未公開(released:false)は選択画面に出ない',
    !c2.out.releasedProfileFrames().some(f => f.id === 'ornate_test'));
  check('未公開(released:false)はランキングでも描かれない(noneへ倒れる)',
    c2.out.normalizeProfileFrameId('ornate_test') === 'none');
  check('未公開でも定義そのものは引ける(DEBUGの見た目確認用)',
    c2.out.profileFrameById('ornate_test')?.id === 'ornate_test');
}
check('ランキングへ送る値: フレームなしは null(列ごと付けない)',
  F.rankingProfileFrameValue('none') === null && F.rankingProfileFrameValue(null) === null);
check('ランキングへ送る値: 選んでいればそのid', F.rankingProfileFrameValue('pink') === 'pink');
check('保存キーが SAVE_DATA.md に載っている', saveSpec.includes('mh_profile_frame_v1'));

// ===== ② 共通部品(画面ごとに別実装しない) =====
check('共通部品 ProfileAvatar がある', widgets.includes('const ProfileAvatar = '));
check('既存の BreederIcon を壊していない(そのまま残っている)', widgets.includes('const BreederIcon = '));
check('フレームは BreederIcon の外側の別レイヤー', widgets.includes('const ProfileFrameLayer = '));
check('出してよいかの判定は normalizeProfileFrameId に任せている',
  /const ProfileFrameLayer[\s\S]{0,400}normalizeProfileFrameId/.test(widgets));
check('画像フレームは縦横比を変えない(object-contain)', bootstrap.includes('.mh-profile-frame-image{') && /\.mh-profile-frame-image\{[^}]*object-fit:contain/.test(bootstrap));
check('フレームはタップを食べない(pointer-events:none)', /\.mh-profile-frame\{[^}]*pointer-events:none/.test(bootstrap));
check('フレーム側を overflow で切らない', /\.mh-profile-avatar\{[^}]*overflow:visible/.test(bootstrap));
check('太さは割合で決める(小さいアイコンでもズレない)',
  /\.mh-profile-frame\{[^}]*inset:-\d+%/.test(bootstrap) && /\.mh-profile-frame-ring\{[^}]*closest-side/.test(bootstrap));
check('5色ぶんのCSSがある(silver/gold/blue/pink)',
  ['silver', 'gold', 'blue', 'pink'].every(id => bootstrap.includes(`.mh-profile-frame-${id}{`)));

// ===== ③ 反映先 =====
check('HOMEのプロフィールアイコンに反映する', homeScreen.includes('frameId={profileFrameId}'));
check('プロフィール画面に反映する', profileScreen.includes('<ProfileAvatar') && profileScreen.includes('frameId={profileFrameId}'));
check('プロフィールからフレームを変えられる', profileScreen.includes('onOpenFramePicker') && app.includes('setShowFramePicker(true)'));
check('アイコン設定とフレーム設定は別の入口', app.includes('setShowIconPicker(true)') && app.includes('setShowFramePicker(true)'));
check('選択画面は「いまのアイコン＋候補フレーム」を重ねて見せる',
  /showFramePicker&&[\s\S]{0,3000}<ProfileAvatar src=\{resolveIconUrl\(breederIcon\)\}[\s\S]{0,400}frameId=\{frame\.id\}/.test(app));
check('選んだその場で反映して保存する', app.includes('const selectProfileFrame = useCallback') && app.includes('storeSet(PROFILE_FRAME_KEY'));
check('起動時に読み込んで正規化する', app.includes('setProfileFrameId(normalizeProfileFrameId(await storeGet(PROFILE_FRAME_KEY'));
check('全ランキング画面が共通のアイコン部品を通る',
  /const rankingBreederIcon = entry =>[\s\S]{0,600}<ProfileAvatar/.test(app));
check('ランキングは他プレイヤーのフレームを出す', /const rankingBreederIcon[\s\S]{0,600}frameId=\{entry\?\.profileFrame\}/.test(app));

// ===== ④ 付けない場所(図鑑・マーケット・円盤石・通常のモンスターアイコン) =====
check('図鑑のモンスターアイコンに枠を付けていない', !/const DexMonsterIcon[\s\S]{0,600}ProfileFrameLayer/.test(widgets));
check('マーケットの商品画像に枠を付けていない', !/const MarketProductIcon[\s\S]{0,900}frameId/.test(widgets));
check('円盤石・通常のモンスター画像に枠を付けていない',
  !/DyedMonsterImage[^\n]{0,200}frameId/.test(app) && !/DyedMonsterImage[^\n]{0,200}frameId/.test(widgets));

// ===== ⑤ ランキングの列(SQL適用とアプリ公開の順番が前後しても壊れない) =====
check('取得する列へ足すヘルパーがある', supa.includes('const rankingSelectWithProfileFrame'));
check('「その列は無い」の判定を、通信や権限の失敗と取り違えない',
  /_isMissingProfileFrameError = \(status, body\) => \{[\s\S]{0,400}profile_frame/.test(supa));
check('曲別・全曲合算・週間・イベントのどれも外して取り直せる',
  supa.includes('const askWithProfileFrame') && supa.includes('failure.profileFrameColumnMissing = true'));
check('通常バトルの送信にフレームIDを載せている', app.includes('{ profile_frame: profileFrame }'));
check('モンビーの送信にフレームIDを載せている', app.includes('{ profile_frame: rankingProfileFrameValue(profileFrameId) }'));
check('送れなかった記録の送り直しにも載せている', supa.includes('{ profile_frame: entry.profileFrame }'));
check('順位・スコアの決め方を変えていない(order は元のまま)',
  supa.includes('order=score.desc.nullslast') && supa.includes('order=total_score.desc,last_scored_at.asc'));

// ===== ⑥ 列が無い環境でも記録が落ちないことを、実際に動かして確かめる =====
(async () => {
  const colStart = supa.indexOf("const RANKING_PROFILE_FRAME_COLUMN = 'profile_frame';");
  const colEnd = colStart >= 0 ? supa.indexOf('\n', supa.indexOf('const rankingProfileFrameFromRow')) + 1 : -1;
  const colBlock = colStart >= 0 && colEnd > colStart ? supa.slice(colStart, colEnd) : '';
  const insertStart = supa.indexOf('const sbInsertRhythmScore = async (row) => {');
  const insertEnd = insertStart >= 0 ? supa.indexOf('\n};', insertStart) + 3 : -1;
  const insertBlock = insertStart >= 0 && insertEnd > insertStart ? supa.slice(insertStart, insertEnd) : '';
  check('送信と列まわりのブロックを抽出できる', colBlock.length > 0 && insertBlock.length > 0);
  if (colBlock && insertBlock) {
    const PRELUDE = `
const SUPABASE_URL='https://example.test';
const SB_HEADERS={'apikey':'k','Content-Type':'application/json'};
const rankingLog=()=>{};
const RHYTHM_RANKING_PREFIX='Rhythm';
const RHYTHM_RANKING_SEPARATOR='-';
let _rankingBreederIdUnavailable=false;
const _isMissingBreederIdError=()=>false;
const normalizeProfileFrameId=(v)=>(v==='gold'||v==='pink')?v:'none';
`;
    const make = (responses) => {
      const calls = [];
      const context = {
        console, setTimeout, clearTimeout, AbortController, JSON, Date, Math, Error, Promise, Object, Array, String, Number,
        fetch: async (url, init) => {
          calls.push({ url, body: JSON.parse(init.body) });
          const res = responses[Math.min(calls.length - 1, responses.length - 1)] || { ok: true, status: 201, body: '' };
          return { ok: res.ok, status: res.status, statusText: res.statusText || '', text: async () => res.body || '' };
        },
      };
      vm.createContext(context);
      vm.runInContext(`${PRELUDE}\n${colBlock}\n${insertBlock}\n this.out={sbInsertRhythmScore,rankingProfileFrameUnavailable,rankingProfileFrameFromRow};`, context);
      return { ...context.out, calls };
    };
    const OK_RES = { ok: true, status: 201, body: '' };
    const MISSING = { ok: false, status: 400, statusText: 'Bad Request',
      body: '{"code":"PGRST204","message":"Could not find the \'profile_frame\' column of \'rankings\' in the schema cache"}' };
    const OTHER_400 = { ok: false, status: 400, statusText: 'Bad Request', body: '{"code":"22P02","message":"invalid input syntax"}' };
    const row = (extra) => ({ difficulty: 'Rhythm-monster_hero-EASY', user_name: 'テスト', score: 1, clear_id: 'c-1', ...extra });

    {
      const c = make([OK_RES]);
      const res = await Promise.resolve(c.sbInsertRhythmScore(row({ profile_frame: 'gold' })));
      check('列がある環境では profile_frame を含めて送る',
        res.saved === true && c.calls.length === 1 && c.calls[0].body.profile_frame === 'gold');
    }
    {
      const c = make([MISSING, OK_RES]);
      const res = await Promise.resolve(c.sbInsertRhythmScore(row({ profile_frame: 'gold' })));
      check('列が無い環境でもスコアは必ず保存される(外して送り直す)',
        res.saved === true && c.calls.length === 2 && c.calls[1].body.profile_frame === undefined);
      check('落としたのは飾り枠だけ(スコア・難易度・名前は残る)',
        c.calls[1].body.score === 1 && c.calls[1].body.difficulty === 'Rhythm-monster_hero-EASY' && c.calls[1].body.user_name === 'テスト');
      check('列が無いと気付いたら覚える', c.rankingProfileFrameUnavailable() === true);
      const again = await Promise.resolve(c.sbInsertRhythmScore(row({ clear_id: 'c-2', profile_frame: 'gold' })));
      check('2件目からは最初から外して送る', again.saved === true && c.calls.length === 3 && c.calls[2].body.profile_frame === undefined);
    }
    {
      const c = make([OTHER_400]);
      let threw = false;
      try { await Promise.resolve(c.sbInsertRhythmScore(row({ profile_frame: 'gold' }))); } catch { threw = true; }
      check('別の400では送り直さずエラーにする', threw && c.calls.length === 1);
      check('別の400で「列が無い」と誤って覚えない', c.rankingProfileFrameUnavailable() === false);
    }
    {
      const c = make([OK_RES]);
      check('受け取った行の知らないフレームはフレームなしへ倒れる',
        c.rankingProfileFrameFromRow({ profile_frame: 'ornate_secret' }) === 'none'
        && c.rankingProfileFrameFromRow({ profile_frame: null }) === 'none'
        && c.rankingProfileFrameFromRow({ profile_frame: 'pink' }) === 'pink');
    }
  }

// ===== ⑦ 配信用JSにも入っている(build忘れではない) =====
  check('配信用JSにフレームの描画が入っている', compiled.includes('mh-profile-frame-ring') && compiled.includes('mh-profile-avatar'));
  check('配信用JSに保存キーが入っている', compiled.includes('mh_profile_frame_v1'));

  console.log(failed === 0 ? '\nすべてOK' : `\n${failed}件のNGがあります`);
  process.exit(failed === 0 ? 0 : 1);
})();

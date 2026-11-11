#!/usr/bin/env node
// 復元しても「はじめての人」の印が残る件(2026-11-12・社長の選択 案1「一覧の印だけ消す」)の見張り。
//
//   node tools/boot/restore-first-timer-marks-check.js
//
// 決まり:
//   ① 3か所の復元(data/mhsave-backup.js のファイルから戻す・60-app.jsx のコードから戻す/ファイルから戻す)は、
//      どれも共通の口 window.mhApplyBackupRestore を呼ぶ(自分で localStorage へ書かない)
//   ② 消すのは一覧(MH_FIRST_TIMER_MARK_KEYS)の印のうち、バックアップに無いものだけ。遊んだ記録・一覧の外には触らない
//   ③ 動くのは「バックアップが前から遊んでいる人のもの」かつ「いまの端末が新しく始めた端末」のときだけ
//   ④ 戻したあとの一覧の印はバックアップと同じ(元の端末と同じ扱い)→ お詫び・記念・報酬の「配った印」が
//      バックアップにあれば残る・無ければ元の端末と同じく1回だけ配られる(二重に配られない)。2回戻しても変わらない
//   ⑤ 取りこぼしの見張り: 起動ではじめての人だけに書く印(!wasOnboarded など)・はじめての設定の終わりで書く印が、
//      一覧にあるか、下の「一覧に入れない理由」に書いてあること
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.resolve(__dirname, '../..');
let failed = 0;
const ok = (name, cond, detail = '') => { console.log(`${cond ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`); if (!cond) failed++; };
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const backupSrc = read('monster-hero/data/mhsave-backup.js');
const partsDir = path.join(ROOT, 'monster-hero/src/parts');
const app = read('monster-hero/src/parts/60-app.jsx');
const allParts = fs.readdirSync(partsDir).filter(f => f.endsWith('.jsx')).map(f => fs.readFileSync(path.join(partsDir, f), 'utf8')).join('\n');

// 一覧に入れない印(バックアップに必ずある・または残っても前から遊んでいる人の扱いが変わらないもの)と、その理由
const NOT_MARKS = {
  mh_onboarded: '前から遊んでいる人のバックアップには必ずある(true)',
  mh_breeder_name: '遊んだ記録(プロフィール)。バックアップのものが入る',
  mh_breeder_icon: '遊んだ記録(プロフィール)。バックアップのものが入る',
  mh_gifts: '遊んだ記録(ギフト)。バックアップのものが入る',
  mh_onboarding_step: 'はじめての設定の途中の印。終わると null。前から遊んでいる人は mh_onboarded で設定を飛ばす',
  mh_monhiro_beat_preopen_new_player_campaign_v1: 'はじめての人のキャンペーンを配った印。前から遊んでいる人は対象外の判定(mh_onboarded)なので、残っても配られ方は変わらない',
  mh_seen_update_notices_v1: '前から遊んでいる人のバックアップには必ずある(更新のお知らせの既読)',
};

// ── 共通の口を偽の window で動かす ──
function load(initial) {
  const store = new Map(Object.entries(initial));
  const fakeWin = {
    localStorage: { setItem: (k, v) => store.set(k, String(v)), getItem: (k) => (store.has(k) ? store.get(k) : null), removeItem: (k) => store.delete(k), key: () => null, length: 0 },
    location: { reload() {} },
  };
  const doc = { querySelector: () => null, createElement: () => ({ setAttribute() {}, appendChild() {}, style: {}, addEventListener() {} }), body: { appendChild() {} }, addEventListener() {}, querySelectorAll: () => [], documentElement: {}, readyState: 'loading' };
  const ctx = { window: fakeWin, document: doc, MutationObserver: class { observe() {} }, Array, Object, JSON, setTimeout: () => 0, btoa: (s) => Buffer.from(s, 'binary').toString('base64'), atob: (s) => Buffer.from(s, 'base64').toString('binary'), unescape, escape, encodeURIComponent, decodeURIComponent, console: { error() {} } };
  vm.createContext(ctx);
  vm.runInContext(backupSrc, ctx);
  return { store, apply: fakeWin.mhApplyBackupRestore, list: fakeWin.MH_FIRST_TIMER_MARK_KEYS };
}
const probe = load({});
ok('共通の口と一覧を出している', typeof probe.apply === 'function' && Array.isArray(probe.list) && probe.list.length >= 17, `${probe.list ? probe.list.length : 0}個`);
const LIST = probe.list ? [...probe.list] : [];
const restore = (dev, backup) => { const w = load(dev); const keys = Object.keys(backup); const r = w.apply(backup, keys); return { store: w.store, r }; };

// 新しく始めた端末: 一覧の印が全部ある + 一覧の外の値
const freshDevice = Object.fromEntries(LIST.map(k => [k, k === 'mh_first_steps_v1' ? '1' : 'true']));
freshDevice.mh_onboarded = 'true';
freshDevice.mh_bgm_volume = '0.5';
freshDevice.mh_monhiro_beat_preopen_new_player_campaign_v1 = 'true';
// 前から遊んでいる人のバックアップ: 配った印のうち2つは持っている(お詫びを見送った印・本オープン記念を配った印)
const veteranBackup = { mh_onboarded: 'true', mh_breeder_name: '"テスト"', mh_breeder_icon: '"mocchi"', mh_gifts: '[]', mh_rhythm_grand_open_gift_v1: 'true', mh_compensation_waived_v1: '["x"]' };

// ③ ① 両方そろったとき
{
  const { store, r } = restore(freshDevice, veteranBackup);
  ok('③ 前から遊んでいる人のバックアップ × 新しく始めた端末 → 片づける', r.veteran === true && r.freshDevice === true);
  const leftovers = LIST.filter(k => !(k in veteranBackup) && store.has(k));
  ok('② バックアップに無い一覧の印は消える', leftovers.length === 0, leftovers.join(','));
  ok('② バックアップにある印は残す(配った印を消さない)', store.get('mh_rhythm_grand_open_gift_v1') === 'true' && store.get('mh_compensation_waived_v1') === '["x"]');
  ok('② 一覧の外は触らない', store.get('mh_bgm_volume') === '0.5' && store.get('mh_monhiro_beat_preopen_new_player_campaign_v1') === 'true');
  ok('② 遊んだ記録はバックアップのもの', store.get('mh_breeder_name') === '"テスト"' && store.get('mh_gifts') === '[]');
  const mirror = LIST.every(k => (k in veteranBackup) ? store.get(k) === veteranBackup[k] : !store.has(k));
  ok('④ 戻したあとの一覧の印はバックアップと同じ(元の端末と同じ扱い・二重に配られない)', mirror);
  // 2回戻す: もう新しく始めた端末ではないので何も消さない・結果も同じ
  const w2 = load(Object.fromEntries(store));
  const r2 = w2.apply(veteranBackup, Object.keys(veteranBackup));
  ok('④ 同じバックアップを2回戻しても変わらない', r2.cleared.length === 0 && LIST.every(k => w2.store.get(k) === store.get(k)));
}
// ③ 片方だけのとき
{
  const vetDevice = { mh_onboarded: 'true', mh_kiki_intro_seen_v1: 'true', mh_sorashido_gift_v1: 'true' };
  const { store, r } = restore(vetDevice, veteranBackup);
  ok('③ 前から遊んでいる端末へ戻すときは消さない', r.cleared.length === 0 && store.get('mh_kiki_intro_seen_v1') === 'true' && store.get('mh_sorashido_gift_v1') === 'true');
}
{
  const newBackup = { mh_onboarded: 'true', mh_story_one_at_a_time_v1: 'true', mh_breeder_name: '"a"', mh_breeder_icon: '"b"' };
  const { store, r } = restore(freshDevice, newBackup);
  ok('③ はじめての人のバックアップなら消さない', r.veteran === false && r.cleared.length === 0 && store.get('mh_first_steps_v1') === '1');
}
{
  const halfBackup = { mh_onboarded: 'false', mh_breeder_name: '"a"', mh_breeder_icon: '"b"' };
  const { r } = restore(freshDevice, halfBackup);
  ok('③ はじめての設定を終えていないバックアップなら消さない', r.veteran === false && r.cleared.length === 0);
}
{
  const oldBackup = { mh_breeder_name: '"昔の人"', mh_breeder_icon: '"mocchi"' };
  const { r } = restore(freshDevice, oldBackup);
  const old2 = restore({ ...freshDevice, mh_onboarded: 'false' }, oldBackup);
  ok('③ 印の無い古いバックアップは、名前とアイコンが決まっていれば前から遊んでいる人', r.veteran === true && r.cleared.length > 0);
  ok('③ その道のときだけ、新しい端末の mh_onboarded=false を true にする(次の起動で印を書き戻さない・Fable の留意1)', old2.store.get('mh_onboarded') === 'true');
  ok('③ mh_onboarded のあるバックアップは、バックアップの値のまま', restore({ ...freshDevice, mh_onboarded: 'false' }, veteranBackup).store.get('mh_onboarded') === 'true'
    && restore({ ...freshDevice, mh_onboarded: 'true' }, { mh_onboarded: 'false', mh_breeder_name: '"a"', mh_breeder_icon: '"b"' }).store.get('mh_onboarded') === 'false');
  ok('③ 前から遊んでいる端末へ古いバックアップを戻すときは mh_onboarded に触らない', restore({ mh_onboarded: 'false' }, oldBackup).store.get('mh_onboarded') === 'false');
  const noProfile = { mh_breeder_name: '"名無しのブリーダー"', mh_breeder_icon: '"mocchi"' };
  ok('③ 名前が決まっていない古いバックアップは消さない', restore(freshDevice, noProfile).r.cleared.length === 0);
}
{
  const broken = { ...freshDevice, mh_story_one_at_a_time_v1: '{壊れ' };
  ok('③ 端末の印が壊れていたら、新しく始めた端末とみなさない(消さない)', restore(broken, veteranBackup).r.cleared.length === 0);
}
// 助手の解放の直し(2026-11-11)はそのまま
ok('助手の解放の直しは共通の口でも動く', JSON.parse(restore(freshDevice, veteranBackup).store.get('mh_assistant_partner_v1')).mode === 'all');

// ① 3か所とも共通の口
ok('① 60-app.jsx の2か所(コード・ファイル)は共通の口を呼ぶ', (app.match(/window\.mhApplyBackupRestore\(data, keys\);/g) || []).length === 2);
ok('① .mhsave の補助(restoreValue)も共通の口を呼ぶ', /function restoreValue\(modal, value\)\{[\s\S]{0,200}applyBackupRestore\(data, keys\);/.test(backupSrc));
ok('① ほかに自分で localStorage へ戻す処理が無い', !/keys\.forEach\(\s*k\s*=>\s*window\.localStorage\.setItem\(k, data\[k\]\)\)/.test(allParts));

// ⑤ 取りこぼしの見張り
{
  const consts = {};
  for (const m of allParts.matchAll(/const ([A-Z0-9_]+)\s*=\s*'(mh_[a-z0-9_]+)'/g)) consts[m[1]] = m[2];
  const resolve = (lit, name) => lit || consts[name] || `?${name}`;
  const extract = (appText) => {
  const found = new Map();
  const add = (k, where) => { if (!found.has(k)) found.set(k, where); };
  const app = appText;
  const re = /if \((?:[^()]|\([^()]*\))*!(?:wasOnboarded|everOnboarded|compensationEverPlayed)\b/g;
  let m;
  while ((m = re.exec(app))) {
    const lineEnd = app.indexOf('\n', m.index);
    const brace = app.indexOf('{', m.index);
    let body = app.slice(m.index, lineEnd);
    if (brace >= 0 && brace < lineEnd) {
      let d = 0, k = brace;
      for (; k < app.length; k++) { if (app[k] === '{') d++; else if (app[k] === '}') { d--; if (!d) break; } }
      body = app.slice(brace, k + 1);
    }
    for (const s of body.matchAll(/storeSet\(\s*(?:'(mh_[a-z0-9_]+)'|([A-Z0-9_]+))/g)) add(resolve(s[1], s[2]), '起動のはじめての人の分岐');
    for (const s of body.matchAll(/for \(const \[on, key\] of \[([\s\S]*?)\]\) \{/g)) for (const c of s[1].matchAll(/([A-Z0-9_]+_KEY)\]/g)) add(resolve(null, c[1]), '起動のはじめての人の分岐');
  }
  const fin = (app.match(/const finishOnboarding = [\s\S]*?\n  \};\n/) || [''])[0];
  for (const s of fin.matchAll(/storeSet\(\s*(?:'(mh_[a-z0-9_]+)'|([A-Z0-9_]+))/g)) add(resolve(s[1], s[2]), 'はじめての設定の終わり');
  return { found, finLen: fin.length };
  };
  const { found, finLen } = extract(app);
  ok('⑤ はじめての設定の終わり(finishOnboarding)を取り出せる', finLen > 200);
  // 見張りが本当に効くか: はじめての人の分岐に新しい印を書く行を足した写しで、拾えること
  const injected = app.replace(/(\n      if \(!wasOnboarded\) \{)/, "$1 await storeSet('mh_zz_new_first_mark_v1', true, false);");
  ok('⑤ 試し: 新しい印を足すと見張りが拾う', injected !== app && extract(injected).found.has('mh_zz_new_first_mark_v1'));
  ok('⑤ はじめての人の分岐から印を拾える(10個以上)', found.size >= 10, `${found.size}個`);
  const missing = [...found].filter(([k]) => !LIST.includes(k) && !(k in NOT_MARKS));
  ok('⑤ はじめての人だけに書く印は、全部一覧にある(増やしたら data/mhsave-backup.js の一覧へ足す)', missing.length === 0, missing.map(([k, w]) => `${k}(${w})`).join(' / '));
  const unknown = LIST.filter(k => !new RegExp(`'${k}'`).test(allParts));
  ok('⑤ 一覧のキーは、どれも本体で使っている(打ち間違いが無い)', unknown.length === 0, unknown.join(','));
}

console.log(failed ? `${failed}件のNGがあります` : 'すべてOK');
process.exit(failed ? 1 : 0);

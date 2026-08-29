from pathlib import Path
import re

root = Path('.')
p = root / 'monster-hero/src/game-system.jsx'
s = p.read_text(encoding='utf-8')

# 1) BGMアレンジにAUTO時の2設定を追加。既定はOFF。
old_defaults = "speciesBattle:'original_battle', speciesDullahan:'original_dullahan', speciesMoo:'original_boss', clear:'ichika_clear', kikiIntro:'original_event_01'"
new_defaults = "speciesBattle:'original_battle', speciesDullahan:'original_dullahan', speciesMoo:'original_boss', autoVictoryJingle:'off', autoPostWaveBgm:'off', clear:'ichika_clear', kikiIntro:'original_event_01'"
assert s.count(old_defaults) == 1, 'DEFAULT_BGM_ARRANGEMENT anchor mismatch'
s = s.replace(old_defaults, new_defaults, 1)

# 2) track ID以外のON/OFF設定も同じmh_bgm_arrangementで後方互換に正規化。
old_norm = """const normalizeBgmArrangement = value => Object.fromEntries(Object.entries(DEFAULT_BGM_ARRANGEMENT).map(([scene, fallback]) => {
  const saved = value?.[scene];
  if (BGM_TRACK_BY_ID[saved]) return [scene, saved];
  const legacySaved = value?.[BGM_ARRANGEMENT_LEGACY_FALLBACK[scene]];
  return [scene, BGM_TRACK_BY_ID[legacySaved] ? legacySaved : fallback];
}));"""
new_norm = """const BGM_TOGGLE_SCENES = new Set(['autoVictoryJingle','autoPostWaveBgm']);
const normalizeBgmArrangement = value => Object.fromEntries(Object.entries(DEFAULT_BGM_ARRANGEMENT).map(([scene, fallback]) => {
  const saved = value?.[scene];
  if (BGM_TOGGLE_SCENES.has(scene)) return [scene, saved === 'on' || saved === 'off' ? saved : fallback];
  if (BGM_TRACK_BY_ID[saved]) return [scene, saved];
  const legacySaved = value?.[BGM_ARRANGEMENT_LEGACY_FALLBACK[scene]];
  return [scene, BGM_TRACK_BY_ID[legacySaved] ? legacySaved : fallback];
}));"""
assert s.count(old_norm) == 1, 'normalizeBgmArrangement anchor mismatch'
s = s.replace(old_norm, new_norm, 1)

# 3) BGMアレンジ変更ハンドラをON/OFF設定にも対応。
old_change = """  const changeBgmArrangement = (scene, trackId) => {
    if (!BGM_TRACK_BY_ID[trackId] || bgmArrangement[scene] === trackId) return;
    setBgmArrangement(current => ({ ...current, [scene]:trackId }));
  };"""
new_change = """  const changeBgmArrangement = (scene, trackId) => {
    const validToggle = BGM_TOGGLE_SCENES.has(scene) && (trackId === 'on' || trackId === 'off');
    if ((!validToggle && !BGM_TRACK_BY_ID[trackId]) || bgmArrangement[scene] === trackId) return;
    setBgmArrangement(current => ({ ...current, [scene]:trackId }));
  };"""
assert s.count(old_change) == 1, 'changeBgmArrangement anchor mismatch'
s = s.replace(old_change, new_change, 1)

# 4) AUTO中は既定で敵撃破ファンファーレを鳴らさない。設定ONなら従来通り。
old_jingle = "    Audio_.playJingle('victory');"
new_jingle = "    if (!autoBattleRef.current || bgmArrangement.autoVictoryJingle === 'on') Audio_.playJingle('victory');"
assert s.count(old_jingle) == 1, f'victory jingle anchor count={s.count(old_jingle)}'
s = s.replace(old_jingle, new_jingle, 1)

# 5) AUTO中のWAVE後強化フェーズはBGMを切り替えず、直前の戦闘曲を流し続ける。
old_phase = "    if (RUN_PHASE_STATES.includes(state)) return wavesDone ? 'result' : 'enhance';"
new_phase = """    if (RUN_PHASE_STATES.includes(state)) {
      if (wavesDone && autoBattleRef.current && bgmArrangement.autoPostWaveBgm !== 'on') return '__keep_battle_bgm__';
      return wavesDone ? 'result' : 'enhance';
    }"""
assert s.count(old_phase) == 1, 'RUN_PHASE_STATES BGM anchor mismatch'
s = s.replace(old_phase, new_phase, 1)

old_effect = """    // 音がオフでも、その画面で使う曲は先に読み込んでおく(タップした瞬間に鳴り始めるように)
    if (key) Audio_.preloadBGM(key);
    if (!audioOn) { Audio_.stopBGM(); return; }
    if (key) Audio_.playBGM(key);
    else Audio_.stopBGM();
  }, [bootPhase, gameState, wave, enemy?.id, hp, gaveUp, audioOn, waveHistory.length, bgmArrangement, runMode, eventBgmScene, mainHero?.id]);"""
new_effect = """    // AUTO中のWAVE後は曲を止めたり差し替えたりせず、直前の戦闘BGMをそのまま継続する。
    if (key === '__keep_battle_bgm__') {
      if (!audioOn) Audio_.stopBGM();
      return;
    }
    // 音がオフでも、その画面で使う曲は先に読み込んでおく(タップした瞬間に鳴り始めるように)
    if (key) Audio_.preloadBGM(key);
    if (!audioOn) { Audio_.stopBGM(); return; }
    if (key) Audio_.playBGM(key);
    else Audio_.stopBGM();
  }, [bootPhase, gameState, wave, enemy?.id, hp, gaveUp, audioOn, waveHistory.length, bgmArrangement, runMode, eventBgmScene, mainHero?.id, autoBattle]);"""
assert s.count(old_effect) == 1, 'BGM effect anchor mismatch'
s = s.replace(old_effect, new_effect, 1)

# 6) BGMアレンジ「その他」にAUTO専用ON/OFFを表示。
old_space = '<div className="space-y-4">{items.map(([scene,label])=>'
new_space = """<div className=\"space-y-4\">{selected.id==='other'&&[
      ['autoVictoryJingle','AUTO時 敵撃破ファンファーレ'],
      ['autoPostWaveBgm','AUTO時 強化フェーズBGM'],
    ].map(([scene,label])=><label key={scene} className=\"block text-left\"><span className=\"text-xs font-black text-slate-300\">{label}</span><div className=\"mt-1\"><select aria-label={label} value={bgmArrangement[scene]} onChange={e=>changeBgmArrangement(scene,e.target.value)} className=\"w-full min-h-[44px] bg-slate-950 border border-white/15 rounded-xl px-2 py-3 text-xs text-white\"><option value=\"off\">OFF（戦闘BGMを途切れさせない）</option><option value=\"on\">ON（従来どおり）</option></select></div></label>)}{items.map(([scene,label])=>"""
assert s.count(old_space) == 1, 'BGM arrangement UI anchor mismatch'
s = s.replace(old_space, new_space, 1)

p.write_text(s, encoding='utf-8')

# ヘルプ：AUTOの音楽設定を明記。
hp = root / 'monster-hero/data/help.js'
h = hp.read_text(encoding='utf-8')
help_anchor = "          { t:'note', title:'バトルの進行速度', text:'バトル画面上部の「×1」「×1.5」「×2」「×3」「×4」ボタンをタップすると、カード・攻撃・回復・敵行動・ターン切替などの演出と待機時間を切り替えられます。選んだ速度は端末に保存され、次回のバトルにも引き継がれます。速度を変えてもダメージ、抽選、スコア、経験値、報酬は変わりません。バトルのれんしゅう中は説明を読みやすくするため1倍固定です。' },\n"
help_add = help_anchor + "          { t:'note', title:'AUTO中のBGM', text:'AUTO中は、敵撃破ファンファーレとWAVE後の強化フェーズ用BGMを初期設定では鳴らさず、直前の戦闘BGMをそのまま流し続けます。曲がWAVEごとに途切れないための設定です。タイトル画面の「BGMアレンジ」→「その他」で、それぞれONに戻すこともできます。' },\n"
assert h.count(help_anchor) == 1, 'help battle speed anchor mismatch'
h = h.replace(help_anchor, help_add, 1)
hp.write_text(h, encoding='utf-8')

# 更新情報：必ず先頭へ追加。build.jsがBUILD_DATE/version.json/この先頭日時を同じ値にstampする。
cp = root / 'monster-hero/data/changelog.js'
c = cp.read_text(encoding='utf-8')
marker = 'const CHANGELOG = [\n'
assert c.count(marker) == 1, 'changelog marker mismatch'
entry = """  {
    date: \"2026-08-30 08:40\", type: 'update', title: 'AUTO中のBGMが途切れにくくなりました', status: 'new',
    items: [
      'AUTO中は、敵を倒したあとのファンファーレを初期設定でOFFにしました。',
      'WAVE後の強化フェーズでも別のBGMへ切り替えず、直前の戦闘BGMをそのまま流し続けるため、周回中に曲が毎回途切れにくくなりました。',
      'BGMアレンジの「その他」に「AUTO時 敵撃破ファンファーレ」「AUTO時 強化フェーズBGM」を追加しました。どちらも初期設定はOFFで、従来どおり鳴らしたい場合は個別にONへ戻せます。',
    ],
  },
"""
c = c.replace(marker, marker + entry, 1)
cp.write_text(c, encoding='utf-8')

# 今後の更新漏れ防止を開発ルールへ明文化（既存update-notice-checkを必須にする）。
dp = root / 'DEVELOPMENT.md'
d = dp.read_text(encoding='utf-8')
rule = """\n### 更新バナー・更新情報の必須確認\n\nプレイヤー向けの機能追加・仕様変更・不具合修正を公開する変更では、`monster-hero/data/changelog.js` の先頭へ更新情報を追加してから通常ビルドを実行し、`BUILD_DATE`・`monster-hero/version.json`・最新更新日時を同期させる。`node tools/update-notice-check.js` を必ず通し、上部の新バージョン通知（更新バナー）と「更新履歴」の両方へ届く状態を確認する。更新情報を出さないことが明示された内部変更だけを例外とする。\n"""
if '### 更新バナー・更新情報の必須確認' not in d:
    d = d.rstrip() + '\n' + rule
dp.write_text(d, encoding='utf-8')

# 専用静的チェックを追加。
tp = root / 'tools/audio/auto-bgm-continuity-check.js'
tp.write_text(r"""const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '../..');
const files = ['monster-hero/src/game-system.jsx', 'monster-hero/game-system.compiled.js'];
let failed = 0;
const check = (name, ok) => { console.log(`${ok ? 'OK' : 'NG'}: ${name}`); if (!ok) failed++; };
for (const file of files) {
  const source = fs.readFileSync(path.join(ROOT, file), 'utf8');
  const compact = source.replace(/\s+/g, '');
  check(`${file}: AUTO音設定の既定値は2つともOFF`, compact.includes("autoVictoryJingle:'off',autoPostWaveBgm:'off'"));
  check(`${file}: AUTO中の敵撃破ファンファーレを既定OFF`, /!autoBattleRef\.current\s*\|\|\s*bgmArrangement\.autoVictoryJingle\s*===\s*['\"]on['\"]/.test(source));
  check(`${file}: AUTO中WAVE後は戦闘BGMを継続`, source.includes("return '__keep_battle_bgm__';") && source.includes("if (key === '__keep_battle_bgm__')"));
  check(`${file}: AUTO切替でBGM判定を再実行`, /mainHero\?\.id,\s*autoBattle\]/.test(source));
  check(`${file}: BGMアレンジにAUTO用2項目を表示`, source.includes('AUTO時 敵撃破ファンファーレ') && source.includes('AUTO時 強化フェーズBGM'));
  check(`${file}: AUTO用2項目はON/OFFを保存正規化`, source.includes("BGM_TOGGLE_SCENES = new Set(['autoVictoryJingle','autoPostWaveBgm'])") && source.includes("saved === 'on' || saved === 'off'"));
}
const changelog = fs.readFileSync(path.join(ROOT, 'monster-hero/data/changelog.js'), 'utf8');
const help = fs.readFileSync(path.join(ROOT, 'monster-hero/data/help.js'), 'utf8');
const development = fs.readFileSync(path.join(ROOT, 'DEVELOPMENT.md'), 'utf8');
check('更新情報にAUTO BGM変更を掲載', /AUTO中のBGMが途切れにくくなりました/.test(changelog));
check('ヘルプにAUTO中のBGM説明を掲載', /title:'AUTO中のBGM'/.test(help));
check('今後の更新バナー・更新情報確認を開発ルール化', /更新バナー・更新情報の必須確認/.test(development) && /update-notice-check\.js/.test(development));
if (failed) process.exit(1);
console.log('OK: AUTO中BGM継続の検証に成功しました');
""", encoding='utf-8')

# tools/READMEに専用checkを記録。
rp = root / 'tools/README.md'
r = rp.read_text(encoding='utf-8')
if 'auto-bgm-continuity-check.js' not in r:
    r = r.rstrip() + "\n\n### AUTO中BGM継続チェック\n\n```bash\nnode tools/audio/auto-bgm-continuity-check.js\n```\n\nAUTO中の敵撃破ファンファーレ／WAVE後BGMの既定OFF、戦闘BGM継続、BGMアレンジのON/OFF設定、更新情報・ヘルプ・開発ルールへの反映を確認します。\n"
rp.write_text(r, encoding='utf-8')

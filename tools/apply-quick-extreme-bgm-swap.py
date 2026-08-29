from pathlib import Path
import re

stamp = '2026-08-29 13:36'

p = Path('monster-hero/src/game-system.jsx')
s = p.read_text()
m = re.search(r"const DEFAULT_BGM_ARRANGEMENT = Object\.freeze\(\{([\s\S]*?)\}\);", s)
assert m, 'DEFAULT_BGM_ARRANGEMENT not found'
block = m.group(0)
expected = {
    'quickBattle':'ichika_battle', 'quickDullahan':'melo_dullahan_clockwork', 'quickMoo':'ichika_boss',
    'extremeBattle':'original_battle', 'extremeDullahan':'original_dullahan', 'extremeMoo':'original_boss'
}
replacement = {
    'quickBattle':'original_battle', 'quickDullahan':'original_dullahan', 'quickMoo':'original_boss',
    'extremeBattle':'ichika_battle', 'extremeDullahan':'melo_dullahan_clockwork', 'extremeMoo':'ichika_boss'
}
for key, old in expected.items():
    pat = rf"({key}\s*:\s*)'{re.escape(old)}'"
    block, n = re.subn(pat, rf"\1'{replacement[key]}'", block, count=1)
    assert n == 1, f'default mismatch: {key}'
s = s[:m.start()] + block + s[m.end():]

migration_decl = re.compile(
    r"const migrateDullahanBgmDefaults\s*=\s*\(?arrangement\)?\s*=>\s*migrateBgmDefaults\(arrangement,\s*BGM_DULLAHAN_PREVIOUS_DEFAULTS\);"
)
match = migration_decl.search(s)
assert match, 'migrateDullahanBgmDefaults declaration not found'
addition = match.group(0) + """
// クイックと極限の既定曲を入れ替えたときの、一度きりの移行。
// 以前の既定のままの枠だけを新しい既定へ移し、自分で選んだ曲は残す。
const BGM_QUICK_EXTREME_DEFAULT_MIGRATION_KEY = 'mh_bgm_quick_extreme_default_migrated_v1';
const BGM_QUICK_EXTREME_PREVIOUS_DEFAULTS = Object.freeze({
  quickBattle: 'ichika_battle',
  quickDullahan: 'melo_dullahan_clockwork',
  quickMoo: 'ichika_boss',
  extremeBattle: 'original_battle',
  extremeDullahan: 'original_dullahan',
  extremeMoo: 'original_boss'
});
const migrateQuickExtremeBgmDefaults = arrangement => migrateBgmDefaults(arrangement, BGM_QUICK_EXTREME_PREVIOUS_DEFAULTS);"""
s = s[:match.start()] + addition + s[match.end():]

set_matches = list(re.finditer(r"^(\s*)setBgmArrangement\(savedBgmArrangement\);\s*$", s, re.M))
assert len(set_matches) == 1, f'setBgmArrangement anchor count={len(set_matches)}'
match = set_matches[0]
indent = match.group(1)
migration = f"""{indent}if ((await storeGet(BGM_QUICK_EXTREME_DEFAULT_MIGRATION_KEY, false, false)) !== true) {{
{indent}  const quickExtremeMigration = migrateQuickExtremeBgmDefaults(savedBgmArrangement);
{indent}  if (quickExtremeMigration.changed) savedBgmArrangement = quickExtremeMigration.arrangement;
{indent}  try {{
{indent}    await storeSet(BGM_QUICK_EXTREME_DEFAULT_MIGRATION_KEY, true, false);
{indent}  }} catch {{}}
{indent}}}
"""
s = s[:match.start()] + migration + match.group(0) + s[match.end():]
s, n = re.subn(r'const BUILD_DATE = "[^"]+";', f'const BUILD_DATE = "{stamp}";', s, count=1)
assert n == 1, 'BUILD_DATE not found'
p.write_text(s)

hp = Path('monster-hero/data/help.js')
h = hp.read_text()
old = 'モードごとに最初から入っている曲は次のとおりです。チャレンジと極限チャレンジは通常戦・デュラハン戦・ムー戦ともオリジナルの3曲。クイックは通常戦が「バトルテーマ by いちか」、デュラハン戦が「呪われた騎士の時計仕掛け」、ムー戦が「ボステーマ by いちか」。プロは通常戦が「プロ戦闘BGM 1」、デュラハン戦が「鋼鉄の亡霊」、ムー戦が「プロ戦闘BGM 2」です。'
new = 'モードごとに最初から入っている曲は次のとおりです。チャレンジとクイックは通常戦・デュラハン戦・ムー戦ともオリジナルの3曲。極限チャレンジは通常戦が「バトルテーマ by いちか」、デュラハン戦が「呪われた騎士の時計仕掛け」、ムー戦が「ボステーマ by いちか」。プロは通常戦が「プロ戦闘BGM 1」、デュラハン戦が「鋼鉄の亡霊」、ムー戦が「プロ戦闘BGM 2」です。'
assert h.count(old) == 1, 'help text mismatch'
hp.write_text(h.replace(old, new, 1))

cp = Path('monster-hero/data/changelog.js')
c = cp.read_text()
marker = 'const CHANGELOG = [\n'
assert c.count(marker) == 1
entry = f'''  {{\n    date: "{stamp}", type: 'update', title: 'クイックと極限チャレンジの初期BGMを入れ替えました', status: 'new',\n    items: [\n      'クイックモードは通常戦・デュラハン戦・ムー戦ともオリジナルの3曲、極限チャレンジは「バトルテーマ by いちか」「呪われた騎士の時計仕掛け」「ボステーマ by いちか」が最初の設定になりました。',\n      '以前の初期設定のまま使っていた枠だけ新しい初期設定へ切り替わります。BGMアレンジで自分で選んでいた曲は変更しません。',\n    ],\n  }},\n'''
cp.write_text(c.replace(marker, marker + entry, 1))
Path('monster-hero/version.json').write_text('{"build": "' + stamp + '"}\n')

tp = Path('tools/audio/bgm-arrangement-check.js')
t = tp.read_text()
t = t.replace('// チャレンジと極限はオリジナル3曲のまま(極限に専用曲は用意していないので、チャレンジと同じ)', '// チャレンジ・クイック・種族はオリジナル3曲。極限は旧クイックの3曲')
t, n = re.subn(
    r"  check\(`\$\{file\}: チャレンジ・極限・種族の既定曲がオリジナル3曲のまま`,[\s\S]*?defaults\.speciesMoo === 'original_boss'\);",
    """  check(`${file}: チャレンジ・クイック・種族の既定曲がオリジナル3曲`,
    defaults.battle === 'original_battle' && defaults.dullahan === 'original_dullahan' && defaults.boss === 'original_boss' &&
    defaults.quickBattle === 'original_battle' && defaults.quickDullahan === 'original_dullahan' && defaults.quickMoo === 'original_boss' &&
    defaults.speciesBattle === 'original_battle' && defaults.speciesDullahan === 'original_dullahan' && defaults.speciesMoo === 'original_boss');""",
    t, count=1)
assert n == 1, 'base defaults check mismatch'
t, n = re.subn(
    r"  // クイックはいちか2曲＋デュラハン専用曲。ムー戦はオリジナルではなく「ボステーマ by いちか」\n  check\(`\$\{file\}: クイックの既定曲が いちか通常／時計仕掛け／いちかボス`,[\s\S]*?defaults\.quickMoo === 'ichika_boss'\);",
    """  // 極限は旧クイックの3曲
  check(`${file}: 極限の既定曲が いちか通常／時計仕掛け／いちかボス`,
    defaults.extremeBattle === 'ichika_battle' &&
    defaults.extremeDullahan === 'melo_dullahan_clockwork' &&
    defaults.extremeMoo === 'ichika_boss');""",
    t, count=1)
assert n == 1, 'extreme defaults check mismatch'
anchor2 = '  // 追加した4曲。既定に使う2曲と、既定では使わないが選べる2曲\n'
assert t.count(anchor2) == 1, 'migration check insertion anchor mismatch'
extra = """  check(`${file}: クイック・極限の既定入れ替えは一度きりで、自分で選んだ曲を上書きしない`,
    /mh_bgm_quick_extreme_default_migrated_v1/.test(source) &&
    /BGM_QUICK_EXTREME_PREVIOUS_DEFAULTS/.test(source) &&
    /migrateQuickExtremeBgmDefaults/.test(source) &&
    /if \(next\[scene\] !== previousDefault\) return;/.test(source));
"""
tp.write_text(t.replace(anchor2, extra + anchor2, 1))

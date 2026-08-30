from pathlib import Path

src_path = Path('monster-hero/src/game-system.jsx')
s = src_path.read_text()
if "id:'atsu_cup_theme'" in s or "id: 'atsu_cup_theme'" in s:
    raise SystemExit('atsu_cup_theme already registered')
start = s.find('const BGM_TRACKS = [')
if start < 0:
    raise SystemExit('BGM_TRACKS not found')
end = s.find('\n];', start)
if end < 0:
    raise SystemExit('BGM_TRACKS closing not found')
track = "\n  { id:'atsu_cup_theme', name:'あつ杯テーマ', creator:'オリジナル', src:'audio/bgm-atsu-cup-theme.mp3' },"
s = s[:end] + track + s[end:]
src_path.write_text(s)

changelog_path = Path('monster-hero/data/changelog.js')
c = changelog_path.read_text()
marker = 'const CHANGELOG = [\n'
if marker not in c:
    raise SystemExit('CHANGELOG marker not found')
if 'あつ杯テーマを追加しました' not in c:
    entry = '''  {\n    date: "2026-08-30 10:20", type: 'update', title: '新BGM「あつ杯テーマ」を追加しました', status: 'new',\n    items: [\n      '新しいBGM「あつ杯テーマ」を追加し、BGMアレンジの登録曲一覧から選択・試聴できるようにしました。',\n      '既存のBGMデフォルト設定やバトル中の自動選曲は変更していません。',\n    ],\n  },\n'''
    c = c.replace(marker, marker + entry, 1)
changelog_path.write_text(c)

check_path = Path('tools/audio/atsu-cup-theme-check.js')
check_path.write_text(r'''#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..', '..');
const files = ['monster-hero/src/game-system.jsx', 'monster-hero/game-system.compiled.js'];
let failed = 0;
const check = (name, ok) => { console.log(`${ok ? '✓' : '✗'} ${name}`); if (!ok) failed++; };
for (const file of files) {
  const source = fs.readFileSync(path.join(ROOT, file), 'utf8');
  const compact = source.replace(/\s+/g, '');
  const block = source.match(/const BGM_TRACKS = \[([\s\S]*?)\];/)?.[1] || '';
  const b = block.replace(/\s+/g, '');
  check(`${file}: あつ杯テーマを登録曲一覧へ追加`,
    b.includes("id:'atsu_cup_theme'") && b.includes("name:'あつ杯テーマ'") && b.includes("src:'audio/bgm-atsu-cup-theme.mp3'"));
  check(`${file}: BGMアレンジ共通選択肢を再利用`,
    compact.includes('BGM_TRACKS.map(track=>') && compact.includes('Audio_.previewBGM(trackId)') && compact.includes('BGM_TRACK_BY_ID[saved]'));
  check(`${file}: あつ杯テーマを既定BGMへ勝手に設定していない`,
    !/DEFAULT_BGM_ARRANGEMENT[^;]+atsu_cup_theme/.test(compact));
}
const audioPath = path.join(ROOT, 'monster-hero/audio/bgm-atsu-cup-theme.mp3');
const audio = fs.existsSync(audioPath) ? fs.readFileSync(audioPath) : null;
check('あつ杯テーマMP3が存在し内容を持つ', !!audio && audio.length > 1024 && (audio.slice(0,3).toString() === 'ID3' || audio[0] === 0xff));
const changelog = fs.readFileSync(path.join(ROOT, 'monster-hero/data/changelog.js'), 'utf8');
check('更新履歴にあつ杯テーマ追加を掲載', changelog.includes('新BGM「あつ杯テーマ」を追加しました') && changelog.includes('BGMアレンジの登録曲一覧'));
console.log(failed ? `\n${failed}件のNGがあります` : '\nすべてOK');
process.exit(failed ? 1 : 0);
''')

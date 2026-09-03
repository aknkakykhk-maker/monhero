from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]
src_path = ROOT / 'monster-hero/src/game-system.jsx'
help_path = ROOT / 'monster-hero/data/help.js'
changelog_path = ROOT / 'monster-hero/data/changelog.js'
readme_path = ROOT / 'tools/README.md'
audio_path = ROOT / 'monster-hero/audio/綺季一閃_～花雪に舞う詠姫～.mp3'

if not audio_path.exists() or audio_path.stat().st_size <= 1024:
    raise SystemExit('Eiki BGM audio file is missing or empty')

src = src_path.read_text(encoding='utf-8')
if "id:'eiki_boss'" not in src:
    lines = src.splitlines()
    pandora_idx = next((i for i, line in enumerate(lines) if "id:'pandora_boss'" in line and 'bgm-pandora-boss.mp3' in line), None)
    if pandora_idx is None:
        raise SystemExit('Pandora BGM track line not found')
    pandora_line = lines[pandora_idx]
    eiki_line = pandora_line.replace("id:'pandora_boss'", "id:'eiki_boss'") \
        .replace("name:'Stay With Me ～Locked Fate～'", "name:'綺季一閃 ～花雪に舞う詠姫～'") \
        .replace("src:'audio/bgm-pandora-boss.mp3'", "src:'audio/綺季一閃_～花雪に舞う詠姫～.mp3'")
    if eiki_line == pandora_line:
        raise SystemExit('Failed to derive Eiki BGM track line')
    lines.insert(pandora_idx + 1, eiki_line)
    src = '\n'.join(lines) + ('\n' if src.endswith('\n') else '')

if 'const eikiBossBgmForBattle' not in src:
    helper_match = re.search(r"const pandoraBossBgmForBattle = \(heroId, currentWave, enemyId\) =>\s*[\s\S]*?;", src)
    if not helper_match:
        raise SystemExit('Pandora BGM helper not found')
    pandora_helper = helper_match.group(0)
    eiki_helper = pandora_helper.replace('pandoraBossBgmForBattle', 'eikiBossBgmForBattle') \
        .replace("'Pandora'", "'Eiki'") \
        .replace("'pandora_boss'", "'eiki_boss'")
    if eiki_helper == pandora_helper or "'Eiki'" not in eiki_helper or "'eiki_boss'" not in eiki_helper:
        raise SystemExit('Failed to derive Eiki BGM helper')
    src = src[:helper_match.end()] + '\n' + eiki_helper + src[helper_match.end():]

if 'const eikiBossBgm = eikiBossBgmForBattle' not in src:
    lines = src.splitlines()
    selector_idx = next((i for i, line in enumerate(lines) if 'const pandoraBossBgm = pandoraBossBgmForBattle(mainHero?.id, currentWave, enemyId);' in line), None)
    if selector_idx is None:
        raise SystemExit('Pandora BGM selector not found')
    indent = lines[selector_idx][:len(lines[selector_idx]) - len(lines[selector_idx].lstrip())]
    lines.insert(selector_idx, f"{indent}const eikiBossBgm = eikiBossBgmForBattle(mainHero?.id, currentWave, enemyId);")
    lines.insert(selector_idx + 1, f"{indent}if (eikiBossBgm) return eikiBossBgm;")
    src = '\n'.join(lines) + ('\n' if src.endswith('\n') else '')

src_path.write_text(src, encoding='utf-8')

help_src = help_path.read_text(encoding='utf-8')
if "title:'エイキ専用の最終ボスBGM'" not in help_src:
    pandora_note = "          { t:'note', title:'パンドラ専用の最終ボスBGM', text:'パンドラを勇者モンにしてムー戦へ進むと、モード別のムー戦BGMより優先して専用曲「Stay With Me ～Locked Fate～」が流れます。供モンだけがパンドラの場合や通常戦・デュラハン戦、ほかの勇者モンでは発動せず、これまでどおりBGMアレンジで選んだ曲が流れます。この専用曲もBGMアレンジの全設定欄から選択・試聴できます。' },"
    if pandora_note not in help_src:
        raise SystemExit('Pandora help note not found')
    eiki_note = "          { t:'note', title:'エイキ専用の最終ボスBGM', text:'エイキを勇者モンにしてムー戦へ進むと、モード別のムー戦BGMより優先して専用曲「綺季一閃 ～花雪に舞う詠姫～」が流れます。供モンだけがエイキの場合や通常戦・デュラハン戦、ほかの勇者モンでは発動せず、これまでどおりBGMアレンジで選んだ曲が流れます。この専用曲もBGMアレンジの全設定欄から選択・試聴できます。' },"
    help_src = help_src.replace(pandora_note, pandora_note + '\n' + eiki_note, 1)
    help_path.write_text(help_src, encoding='utf-8')

changelog = changelog_path.read_text(encoding='utf-8')
if "title:'エイキ専用の最終ボスBGMを追加しました'" not in changelog:
    marker = 'const CHANGELOG = [\n'
    if marker not in changelog:
        raise SystemExit('CHANGELOG marker not found')
    entry = "  {\n    date: \"2026-09-03 19:21\", type:'update', title:'エイキ専用の最終ボスBGMを追加しました', status:'new',\n    assistantNotice:{id:'update_notice_eiki_boss_bgm_v1',type:'feature'},\n    items:['エイキを勇者モンにしてムー戦へ進むと、専用曲「綺季一閃 ～花雪に舞う詠姫～」が流れるようになりました。', '供モンだけがエイキの場合や通常戦・デュラハン戦、ほかの勇者モンでは、これまでどおり各モードで設定したBGMが流れます。', 'この曲はBGMアレンジの登録曲一覧から、ほかの曲と同じように選択・試聴できます。'],\n  },\n"
    changelog = changelog.replace(marker, marker + entry, 1)
    changelog_path.write_text(changelog, encoding='utf-8')

readme = readme_path.read_text(encoding='utf-8')
if 'eiki-boss-bgm-check.js' not in readme:
    needle = '| `node audio/pandora-boss-bgm-check.js`'
    idx = readme.find(needle)
    if idx >= 0:
        line_end = readme.find('\n', idx)
        new_row = "\n| `node audio/eiki-boss-bgm-check.js` | エイキを勇者モンにしたムー戦だけで専用曲「綺季一閃 ～花雪に舞う詠姫～」をモード別曲より優先し、通常戦・デュラハン戦・供モンだけがエイキ・他の勇者では既存BGMを維持すること、BGMアレンジから選択・試聴できることを確認する。 |"
        readme = readme[:line_end] + new_row + readme[line_end:]
        readme_path.write_text(readme, encoding='utf-8')

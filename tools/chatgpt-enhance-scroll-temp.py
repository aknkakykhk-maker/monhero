from pathlib import Path

path = Path('monster-hero/src/game-system.jsx')
src = path.read_text()
marker = "gameState==='MASU_TRANSCEND_ENHANCE'&&"
at = src.find(marker)
if at < 0:
    raise SystemExit('MASU_TRANSCEND_ENHANCE marker not found')
start = src.find('<div className="', at)
if start < 0 or start - at > 12000:
    raise SystemExit(f'transcend root div not found near marker: offset={start-at}')
value_start = start + len('<div className="')
value_end = src.find('"', value_start)
if value_end < 0:
    raise SystemExit('transcend root class quote not found')
classes = src[value_start:value_end]
if 'overflow-y-auto' not in classes:
    classes = classes + ' overflow-y-auto'
    src = src[:value_start] + classes + src[value_end:]
path.write_text(src)
print(f'MASU_TRANSCEND_ENHANCE root scrolling ensured: {classes}')

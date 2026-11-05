#!/usr/bin/env python3
# 助手の表情シート(4列×2段・1マス 384x512・背景が塗られた絵)を、1表情ずつの背景透過 PNG に切り分ける(2026-11-05 えるびん)。
#
#   python3 tools/assistant/cut-assistant-sheet.py <シート> <出力フォルダ> <接頭辞> <8つの表情名(左上から右へ・上の段→下の段。カンマ区切り)>
#
# 背景は「マスの外周からつながっている、背景に近い色」だけを抜く(塗りつぶし)。絵の線で囲まれた中は、背景と同じ色でも残る
# (石油王の白い頭布が背景とほぼ同じ色なので、色だけで抜くと頭布まで消える)。
# マスの境目の線(1〜2px)は、内側の画素で埋めてから切る。境目に触れている服はそのまま残る。
import sys
from collections import deque
from PIL import Image

args = [a for a in sys.argv[1:] if not a.startswith('--')]
# --pockets … 外周につながっていない「囲まれた背景」(くせ毛のすき間・腕と体のあいだ)も抜く。
#   白い服(石油王の頭布)がある絵では使わない(頭布まで抜ける)。ふちのなじませも2px・ゆるめにする
POCKETS = '--pockets' in sys.argv
sheet, outdir, prefix, names = args[0], args[1], args[2], args[3].split(',')
assert len(names) == 8, '表情は8つ'
CW, CH, BORDER, TOL, SOFT = 384, 512, 2, 22.0, (70.0 if POCKETS else 30.0)
POCKET_TOL, POCKET_MEAN = 26.0, 12.0
im = Image.open(sheet).convert('RGB')
assert im.size == (CW * 4, CH * 2), f'シートの大きさが違う: {im.size}'

def dist(a, b):
    return ((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2) ** 0.5

import os
os.makedirs(outdir, exist_ok=True)
for k, name in enumerate(names):
    cx, cy = (k % 4) * CW, (k // 4) * CH
    cell = im.crop((cx, cy, cx + CW, cy + CH))
    px = cell.load()
    # 境目の線を内側の画素で埋める
    for y in range(CH):
        for b in range(BORDER):
            px[b, y] = px[BORDER, y]; px[CW - 1 - b, y] = px[CW - 1 - BORDER, y]
    for x in range(CW):
        for b in range(BORDER):
            px[x, b] = px[x, BORDER]; px[x, CH - 1 - b] = px[x, CH - 1 - BORDER]
    # 背景の色 = 上の角の平均
    samples = [px[x, y] for x in list(range(4, 24)) + list(range(CW - 24, CW - 4)) for y in range(4, 24)]
    bg = tuple(sum(s[i] for s in samples) / len(samples) for i in range(3))
    seen = [[False] * CW for _ in range(CH)]
    q = deque()
    for x in range(CW):
        for y in (0, CH - 1):
            if dist(px[x, y], bg) < TOL: q.append((x, y)); seen[y][x] = True
    for y in range(CH):
        for x in (0, CW - 1):
            if not seen[y][x] and dist(px[x, y], bg) < TOL: q.append((x, y)); seen[y][x] = True
    while q:
        x, y = q.popleft()
        for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
            if 0 <= nx < CW and 0 <= ny < CH and not seen[ny][nx] and dist(px[nx, ny], bg) < TOL:
                seen[ny][nx] = True; q.append((nx, ny))
    if POCKETS:
        # 囲まれた背景: 背景に近い色のかたまりで、平均の色が背景にごく近いもの(歯や目の白は、色が少し違うので残る)
        mark = [[False] * CW for _ in range(CH)]
        for y0 in range(CH):
            for x0 in range(CW):
                if seen[y0][x0] or mark[y0][x0] or dist(px[x0, y0], bg) >= POCKET_TOL: continue
                comp, q2 = [(x0, y0)], deque([(x0, y0)]); mark[y0][x0] = True
                while q2:
                    x, y = q2.popleft()
                    for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
                        if 0 <= nx < CW and 0 <= ny < CH and not seen[ny][nx] and not mark[ny][nx] and dist(px[nx, ny], bg) < POCKET_TOL:
                            mark[ny][nx] = True; q2.append((nx, ny)); comp.append((nx, ny))
                mean = tuple(sum(px[x, y][i] for x, y in comp) / len(comp) for i in range(3))
                if dist(mean, bg) < POCKET_MEAN:
                    for x, y in comp: seen[y][x] = True
    # ふち(抜いた所から RING px 以内)
    RING = 2 if POCKETS else 1
    near = [[False] * CW for _ in range(CH)]
    for y in range(CH):
        for x in range(CW):
            if seen[y][x]:
                for dy in range(-RING, RING + 1):
                    for dx in range(-RING, RING + 1):
                        if 0 <= x + dx < CW and 0 <= y + dy < CH: near[y + dy][x + dx] = True
    out = Image.new('RGBA', (CW, CH))
    op = out.load()
    for y in range(CH):
        for x in range(CW):
            r, g, b = px[x, y]
            if seen[y][x]:
                op[x, y] = (r, g, b, 0); continue
            # 抜いた所のとなり(ふち)は、背景からの離れ具合で半透明にして、背景の色を引いておく
            if near[y][x]:
                a = max(0.0, min(1.0, dist((r, g, b), bg) / SOFT))
                if a <= 0.02: op[x, y] = (r, g, b, 0); continue
                c = tuple(int(max(0, min(255, (v - bg[i] * (1 - a)) / a))) for i, v in enumerate((r, g, b)))
                op[x, y] = (*c, int(round(a * 255)))
            else:
                op[x, y] = (r, g, b, 255)
    path = os.path.join(outdir, f'{prefix}_{name}.PNG')
    out.save(path, optimize=True)
    print(path, f'背景 {tuple(round(v) for v in bg)}  抜いた画素 {sum(map(sum, seen))}')

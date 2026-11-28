#!/usr/bin/env python3
# クリスマスのレイドのお話(r1126-090 追記2・社長「ハムとかさんたの顔アイコンがない」)の、赤いサンタ・黒いサンタの顔アイコンを
# 今ある全身の絵(images/enemies/santa-red.png・santa-black.png)から切り出す。新しくは描かない・色や線は変えない(切って縮めるだけ)。
#   python3 tools/battle/raid-xmas-santa-face-icons.py
#   出力: monster-hero/images/monster-icons/face/santa-red.png・santa-black.png(256×256 の透過 PNG。ほかの顔アイコンと同じ大きさ)
#   切る範囲は全身の絵の中の顔のまんなか(cx, cy)と一辺(sz)。帽子のふちから首元の鈴までが丸の枠に入る寄り具合(ハムの顔アイコンにそろえた)
import os
from PIL import Image
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'monster-hero', 'images')
CROPS = {
    'santa-red': (462, 455, 500),
    'santa-black': (490, 455, 500),
}
for name, (cx, cy, sz) in CROPS.items():
    src = Image.open(os.path.join(ROOT, 'enemies', f'{name}.png')).convert('RGBA')
    box = (cx - sz // 2, cy - sz // 2, cx + sz // 2, cy + sz // 2)
    out = src.crop(box).resize((256, 256), Image.LANCZOS)
    path = os.path.join(ROOT, 'monster-icons', 'face', f'{name}.png')
    out.save(path, optimize=True)
    print(f'{path}: {os.path.getsize(path)} bytes')

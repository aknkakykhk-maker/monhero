#!/usr/bin/env python3
"""あつの顔アイコンを、表情の全身画(images/assistant/fullbody/<名前>__<表情>.png)から原画の画素のまま切る(助手部ココロ3)。

2026-11-15 r1115-203 社長「あつのアイコンはそもそもアップにしてなくても荒れてるから、なんかおかしなことしてるんじゃない？」:
  前は、全身画(ふちをぼかし・ふちの色を塗り直した物)の顔の所(一辺 134〜144 画素)を 256 画素へ約 1.9 倍に補間で引き伸ばしていた。
  いまは、同じ範囲(社長が選んだ案C r1115-114・表情ごとに合わせた r1115-117・127)を、原画のままの全身画から、引き伸ばさず・色を減らさずに切る。絵の一辺は 134〜144 画素
  (表示は丸の中に object-cover で入るので、一辺が 256 でなくてよい)。
  ・書き出し: images/assistant/face/<接頭辞>_<表情>.PNG。あつはブリーダーとしての顔(images/breeder-icons/atsu_<表情>.png)にも同じ絵を書く
  ・寝顔(_sleep)はここでは作らない
使い方: python3 tools/assistant/face-from-fullbody.py
BOX … 表情ごとの切り方 (左, 上, 一辺)。全身画の画素。前の顔アイコンを全身画の中で突き合わせて測った値(全身画を作り直して位置が変わったら測り直す)。
"""
import os
from PIL import Image

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
IMG = os.path.join(ROOT, 'monster-hero/images')
BOX = {
    'atsu': {'normal': (60, 7, 140), 'happy': (40, 0, 139), 'wink': (64, 0, 143), 'surprise': (88, 4, 134), 'troubled': (42, 2, 139), 'angry': (45, 0, 142), 'crying': (66, 3, 144), 'excited': (59, 0, 142)},
}
PREFIX = {'atsu': 'atsu'}
EXTRA = {'atsu': 'breeder-icons/atsu_%s.png'}


def main():
    for who, boxes in BOX.items():
        for e, (x, y, side) in boxes.items():
            im = Image.open(os.path.join(IMG, 'assistant/fullbody/%s__%s.png' % (who, e))).convert('RGBA')
            out = Image.new('RGBA', (side, side), (0, 0, 0, 0))
            out.paste(im.crop((x, y, x + side, y + side)), (0, 0))  # 絵の外にはみ出た所は透明のまま
            paths = [os.path.join(IMG, 'assistant/face/%s_%s.PNG' % (PREFIX[who], e))]
            if who in EXTRA:
                paths.append(os.path.join(IMG, EXTRA[who] % e))
            for p in paths:
                out.save(p, optimize=True)
            print('%s %-9s 一辺 %d (%d,%d) → %s' % (who, e, side, x, y, ', '.join(os.path.relpath(p, IMG) for p in paths)))


if __name__ == '__main__':
    main()

#!/usr/bin/env python3
"""助手の絵の顔周りを「原本・今(直す前)・直した後」で並べた比べ絵を作る(助手部ナカヨシ・2026-11-28 r1126-095 追記2)。

  原本は出来上がりと同じ大きさへ Lanczos で広げて並べる(倍率をそろえて縁だけを見比べるため)。暗い背景と明るい背景の2段。
  顔の場所: 体の上から 3〜20% の高さの列で頭の幅を取り、上から 15% を中心にした一辺 20% の正方形・頭の幅の真ん中を中心にした正方形(1人ずつ自動で決める。外れたら --box で指定)
使い方: python3 tools/assistant/art-edge-compare.py <原本> <今の絵> <直した後> <出す先.png> [--box x0,y0,x1,y1(直した後の座標)]
"""
import sys
import numpy as np
from PIL import Image, ImageDraw, ImageFont

FONT = '/usr/share/fonts/opentype/ipafont-gothic/ipag.ttf'


def bbox(a, lim=24):
    ys, xs = np.nonzero(a[..., 3] > lim)
    return xs.min(), ys.min(), xs.max() + 1, ys.max() + 1


def face_box(a):
    x0, y0, x1, y1 = bbox(a)
    h = y1 - y0
    top = a[y0 + int(0.03 * h):y0 + int(0.20 * h), :, 3] > 128
    cols = np.nonzero(top.any(axis=0))[0]
    cx = (cols.min() + cols.max()) // 2
    side = int(0.20 * h)
    cy = y0 + int(0.15 * h)
    return cx - side // 2, cy - side // 2, cx + side // 2, cy + side // 2


def aligned(im, ref):
    """im を ref と同じ体の位置・大きさへ合わせる(体の箱の上端・左右の真ん中と高さで合わせる)"""
    a, r = np.array(im), np.array(ref)
    ax0, ay0, ax1, ay1 = bbox(a)
    rx0, ry0, rx1, ry1 = bbox(r)
    s = (ry1 - ry0) / float(ay1 - ay0)
    im2 = im.resize((max(1, round(im.width * s)), max(1, round(im.height * s))), Image.LANCZOS)
    out = Image.new('RGBA', ref.size, (0, 0, 0, 0))
    dx = round((rx0 + rx1) / 2 - (ax0 + ax1) / 2 * s)
    dy = round(ry0 - ay0 * s)
    out.paste(im2, (dx, dy))
    return out


def main():
    src, now, new, out = sys.argv[1:5]
    N = Image.open(new).convert('RGBA')
    O = aligned(Image.open(src).convert('RGBA'), N)
    C = aligned(Image.open(now).convert('RGBA'), N)
    box = tuple(int(v) for v in sys.argv[sys.argv.index('--box') + 1].split(',')) if '--box' in sys.argv else face_box(np.array(N))
    T = 420
    font = ImageFont.truetype(FONT, 22)
    names = ['原本(同じ大きさに広げた物)', '今(直す前)', '直した後']
    sheet = Image.new('RGB', (3 * (T + 8), 2 * T + 40), 'white')
    d = ImageDraw.Draw(sheet)
    for i, (n, im) in enumerate(zip(names, (O, C, N))):
        d.text((i * (T + 8) + 4, 6), n, fill='black', font=font)
        for j, bg in enumerate([(30, 30, 50), (240, 240, 240)]):
            c = im.crop(box)
            b = Image.new('RGBA', c.size, bg + (255,))
            b.alpha_composite(c)
            sheet.paste(b.resize((T, T), Image.LANCZOS if c.width > T else Image.NEAREST), (i * (T + 8), 36 + j * (T + 4)))
    sheet.save(out)


if __name__ == '__main__':
    main()

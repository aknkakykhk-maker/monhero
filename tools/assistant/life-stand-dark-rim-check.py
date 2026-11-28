#!/usr/bin/env python3
"""助手の立ち絵(stand-*)・顔アイコン(face)・全身画に、元の背景の黒い塊・黒い縁が残っていないかを洗い出す(助手部ナカヨシ)。

経緯: 2026-11-28 r1126-105 社長(モンヒロビートのモード選び・ききのツインテールの立ち絵)「背景透過できてない」。
  髪の外側に元の背景の黒い塊が残っていた(全身画は直してあったのに、立ち絵を切り直していなかった)。
見方: 絵の外側(透明)から R 画素以内にある「暗い不透明な画素」のうち、暗い所が太い(線画の太さを超えて塊になっている)所を数える。
  線画の黒は細いので数えない。黒い髪・黒い服は太い暗い所になるので数に入る → 出た絵は必ず白と暗い背景の上に重ねた止め絵で目で見る
  (--sheet で docs/progress/ ではなく指定のフォルダへ止め絵を書く)。
使い方: python3 tools/assistant/life-stand-dark-rim-check.py [--top N] [--sheet <出力フォルダ>] [--only <語>] [<ファイル…>]
  出力: 太い暗い縁の画素の割合(縁の画素あたり・‰)の大きい順に上位 N(既定 20)
"""
import os, sys, glob
import numpy as np
from PIL import Image

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
A = os.path.join(ROOT, 'monster-hero/images/assistant')


def shift_min(m, r):
    """正方形の窓(2r+1)の最小(= 2値のときは収縮)。numpy だけで回す"""
    out = m.copy()
    h, w = m.shape
    for dy in range(-r, r + 1):
        for dx in range(-r, r + 1):
            s = np.ones_like(m)
            ys, yd = (slice(dy, h), slice(0, h - dy)) if dy >= 0 else (slice(0, h + dy), slice(-dy, h))
            xs, xd = (slice(dx, w), slice(0, w - dx)) if dx >= 0 else (slice(0, w + dx), slice(-dx, w))
            s[yd, xd] = m[ys, xs]
            out &= s
    return out


def dilate(m, r):
    return ~shift_min(~m, r)


def measure(path):
    im = Image.open(path).convert('RGBA')
    scale = im.width / 800.0
    if scale > 1.2:  # 幅の大きい絵は幅 800 へ縮めて測る(全身画の縦長も、立ち絵と同じ太さの目で見る)
        im = im.resize((round(im.width / scale), round(im.height / scale)), Image.LANCZOS)
        scale = 1.0
    a = np.asarray(im).astype(np.int32)
    alpha = a[..., 3]
    lum = (a[..., 0] * 299 + a[..., 1] * 587 + a[..., 2] * 114) // 1000
    opaque = alpha > 96
    outside = alpha < 16
    dark = opaque & (lum < 45)
    k = max(2, round(3 * scale))  # 線画より太い(半径 k の窓に収まる)暗い所
    thick = dilate(shift_min(dark, k), k) & dark
    rim = dilate(outside, max(3, round(6 * scale))) & opaque
    n_rim = int(rim.sum()) or 1
    # 外(透明)と明るい色の体のあいだに挟まった暗い帯だけを見る(黒い髪・黒い服は奥まで暗いので、明るい所から離れる)
    light = opaque & (lum > 110)
    hit = thick & rim & dilate(light, max(4, round(8 * scale)))
    return 1000.0 * hit.sum() / n_rim, im, hit


def sheet(path, im, hit, out_dir):
    os.makedirs(out_dir, exist_ok=True)
    h = 520
    im2 = im.resize((max(1, round(im.width * h / im.height)), h), Image.LANCZOS)
    tiles = []
    for c in [(255, 255, 255), (36, 36, 70)]:
        bg = Image.new('RGBA', im2.size, c + (255,))
        bg.alpha_composite(im2)
        tiles.append(bg.convert('RGB'))
    mk = Image.fromarray((hit * 255).astype(np.uint8)).resize(im2.size)
    red = Image.new('RGB', im2.size, (255, 255, 255))
    red.paste((230, 0, 0), mask=mk)
    tiles.append(red)
    s = Image.new('RGB', (sum(t.width for t in tiles), h), (255, 255, 255))
    x = 0
    for t in tiles:
        s.paste(t, (x, 0)); x += t.width
    name = os.path.relpath(path, A).replace('/', '__')
    s.save(os.path.join(out_dir, os.path.splitext(name)[0] + '.png'))


def main():
    args = sys.argv[1:]
    top = int(args[args.index('--top') + 1]) if '--top' in args else 20
    out_dir = args[args.index('--sheet') + 1] if '--sheet' in args else None
    only = args[args.index('--only') + 1] if '--only' in args else None
    files = [x for x in args if x.lower().endswith('.png') and os.path.exists(x)]
    if not files:
        # 立ち絵(stand-*)・顔(face)・ふだんの絵(助手の直下と服のフォルダ)・全身画(fullbody)
        files = sorted(set(glob.glob(os.path.join(A, '**/*.[pP][nN][gG]'), recursive=True)))
    if only:
        files = [f for f in files if only in f]
    rows = []
    for f in files:
        v, im, hit = measure(f)
        rows.append((v, f, im, hit))
    rows.sort(key=lambda r: -r[0])
    for v, f, im, hit in rows[:top]:
        print('%6.1f‰  %s' % (v, os.path.relpath(f, ROOT)))
        if out_dir:
            sheet(f, im, hit, out_dir)
    print('見た数 %d(太い暗い縁の割合 ‰ の大きい順に上位 %d。黒い髪・黒い服も数に入るので、止め絵で目で見て決める)' % (len(rows), min(top, len(rows))))


if __name__ == '__main__':
    main()

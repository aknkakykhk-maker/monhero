#!/usr/bin/env python3
# 384x512 の胸から上の助手の絵から、吹き出し用の顔アイコン(256px・256色)を作る(2026-11-05 えるびん。まだ助手の一覧に入っていない絵用)。
#   python3 tools/assistant/make-face-from-bust.py <絵のフォルダ> [一辺の割合=0.66] [顔を下げる割合=0.08]
# 一辺 = 輪郭の高さ × 割合。横は「頭の帯」(上端から一辺の 15〜65%)の重心を真ん中に置く。縦は輪郭の上端から始め、顔を丸の真ん中より少し下へ。
# 助手の一覧に入ったら、tools/make-assistant-faces.js の PER_ASSISTANT_BASE へ同じ値を移す
import sys, os, glob
from PIL import Image
d = sys.argv[1]; ratio = float(sys.argv[2]) if len(sys.argv) > 2 else 0.66; drop = float(sys.argv[3]) if len(sys.argv) > 3 else 0.08
os.makedirs(os.path.join(d, 'face'), exist_ok=True)
for f in sorted(glob.glob(os.path.join(d, '*.PNG'))):
    im = Image.open(f).convert('RGBA'); w, h = im.size; a = im.getchannel('A').load()
    top = next(y for y in range(h) if any(a[x, y] >= 24 for x in range(w)))
    side = round((h - top) * ratio)
    xs = [x for y in range(top + int(side * .15), min(h, top + int(side * .65))) for x in range(w) if a[x, y] >= 24]
    cx = sum(xs) / len(xs)
    sx, sy = round(cx - side / 2), round(top - side * drop)
    box = Image.new('RGBA', (side, side)); box.paste(im.crop((max(0, sx), max(0, sy), min(w, sx + side), min(h, sy + side))), (max(0, -sx), max(0, -sy)))
    out = box.resize((256, 256), Image.LANCZOS)
    p = os.path.join(d, 'face', os.path.basename(f))
    out.quantize(256, method=Image.Quantize.FASTOCTREE).save(p, optimize=True)
    print(p, f'一辺 {side} 位置 ({sx},{sy})  {os.path.getsize(p)//1024}KB')

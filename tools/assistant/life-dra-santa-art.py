#!/usr/bin/env python3
"""ドラのクリスマス(顔だけの絵・全身は無い)の配信用の絵を、受け取った原本から作る(助手部ナカヨシ・2026-11-28 r1126-095)。

  原本: tools/art-sources/assistants/dra/santa/received/dra_santa_<表情>.png(1254×1254・加工せずに保管)
  ・半身の置き場 images/assistant/santa/dra_<表情>.webp … 原本の大きさのまま(1254×1254)。外の見えないほど薄いもや(不透明度 6 未満)だけ消す。WebP 画質90(art_webp.py)
    前(2026-11-25)は 384×384 へ縮めた PNG で、事件簿の大きい顔で引き伸ばされて荒かった(社長「助手画像が全部荒い」)
  ・顔アイコン images/assistant/santa/face/dra_<表情>.PNG … 256×256。9枚とも同じ枠(原本の上で左上 134,127・一辺 1021。
    前の顔アイコンの枠を原本の上で測った物なので、顔の位置・大きさは前と同じ。表情を替えても頭が動かない)
使い方: python3 tools/assistant/life-dra-santa-art.py
"""
import os, sys
import numpy as np
from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import art_webp

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
SRC = os.path.join(ROOT, 'tools/art-sources/assistants/dra/santa/received')
OUT = os.path.join(ROOT, 'monster-hero/images/assistant/santa')
EXPR = ['normal', 'happy', 'wink', 'surprise', 'troubled', 'angry', 'crying', 'excited', 'sleep']
FACE_BOX = (134, 127, 1021)  # 原本の上の (左, 上, 一辺)
FACE_PX = 256

for e in EXPR:
    a = np.array(Image.open(os.path.join(SRC, 'dra_santa_%s.png' % e)).convert('RGBA'))
    a[a[..., 3] < 6] = 0
    im = Image.fromarray(a, 'RGBA')
    p = art_webp.save(im, os.path.join(OUT, 'dra_%s.PNG' % e))
    x, y, s = FACE_BOX
    face = im.crop((x, y, x + s, y + s)).resize((FACE_PX, FACE_PX), Image.LANCZOS)
    f = art_webp.save(face, os.path.join(OUT, 'face', 'dra_%s.PNG' % e))
    print('%-28s %5d KB   %-30s %4d KB' % (os.path.relpath(p, ROOT)[29:], os.path.getsize(p) // 1024, os.path.relpath(f, ROOT)[29:], os.path.getsize(f) // 1024))

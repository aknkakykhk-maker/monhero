#!/usr/bin/env python3
"""全身画(images/assistant/fullbody/<名前>__<表情>.png)から、場面用の立ち絵(胸から上)を作る(助手部ココロ)。

元のシートが手元に無い助手(きき・ふだん)や、全身画が仕上がり済みの助手向け。
  ・8表情それぞれを、体のてっぺんをそろえて、顎の位置が「顎の割合 chin_frac」になる所で切る
  ・書き出し: monster-hero/images/assistant/<stand>/<接頭辞>_<表情>.png(減色して軽くする)
  ・顔の表(ASSISTANT_LIFE_STAND_FACE_OUTFIT)に貼る1行を出す
使い方: python3 tools/assistant/life-stand-from-fullbody.py [--only キー]
足すときは下の HEADS に1つ足す。数字は全身画 normal の画素(top=頭のてっぺん/eye=目/chin=顎)。
"""
import os, sys
import numpy as np
from PIL import Image

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
FB = os.path.join(ROOT, 'monster-hero/images/assistant/fullbody')
EXPR = ['normal', 'happy', 'wink', 'surprise', 'troubled', 'angry', 'crying', 'excited']
# key … 助手id(服があれば id:服)。name … 全身画の名前。stand … 立ち絵の置き場。prefix … 画像の接頭辞
HEADS = {
    'kiki': dict(name='kiki', stand='stand-normal', prefix='kiki', top=40, eye=145, chin=185, chin_frac=0.43, above=None),
    'kiki:halloween': dict(name='kiki_halloween', stand='stand-halloween', prefix='kiki', top=70, eye=148, chin=188, chin_frac=0.43, above=0.95),
    'atsu': dict(name='atsu', stand='stand-normal', prefix='atsu', top=30, eye=100, chin=128, chin_frac=0.43, above=None),
    'kyuko': dict(name='kyuko', stand='stand-normal', prefix='kyuko', top=20, eye=100, chin=135, chin_frac=0.43, above=None),
    'sorashido': dict(name='sorashido', stand='stand-normal', prefix='sorashido', top=12, eye=89, chin=131, chin_frac=0.43, above=None),  # 馬骨(2026-11-15)。補正(いままでの絵)は stand-hosei へ移した(作り直さない)
}


def bbox(im):
    a = np.array(im)[..., 3]
    ys, xs = np.nonzero(a > 40)
    return xs.min(), ys.min(), xs.max() + 1, ys.max() + 1


def smooth2x(im):
    """元が小さいので、先に2倍へ補間して輪郭をなめらかにする(life-expression-sheets.py と同じ)。"""
    from PIL import ImageFilter
    w, h = im.size
    rgb = im.convert('RGB').resize((w * 2, h * 2), Image.LANCZOS)
    a = im.getchannel('A').resize((w * 2, h * 2), Image.LANCZOS).filter(ImageFilter.GaussianBlur(0.8))
    out = rgb.convert('RGBA')
    out.putalpha(a)
    return out


def save_png(im, path):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    im.quantize(colors=256, method=Image.Quantize.FASTOCTREE, dither=Image.Dither.NONE).save(path, optimize=True)
    return os.path.getsize(path) // 1024


def run(key, cfg):
    ims = [Image.open(os.path.join(FB, '%s__%s.png' % (cfg['name'], e))).convert('RGBA') for e in EXPR]
    boxes = [bbox(i) for i in ims]
    nb = boxes[0]
    # 顎の位置が chin_frac になる高さ(normal の体のてっぺんから測る)
    H = (cfg['chin'] - nb[1]) / cfg['chin_frac']
    tot = 0
    for e, im, b in zip(EXPR, ims, boxes):
        bottom = int(round(b[1] + H))
        # 左右は切らない(2026-11-15 社長・窓口「左右は詰めずに切らない形で」。端の薄消しの縦筋も出さない)。
        #   並ぶ場面で顔が小さくならないよう、場面の置き方(assistantLifeStandLayout の visW)が体の幅の上限を持つ
        x0, x1 = max(0, b[0] - 4), min(im.width, b[2] + 4)
        c = im.crop((x0, max(0, b[1] - 4), x1, min(im.height, bottom)))
        # 上の端から外へはみ出さないよう、切った絵は体の上端に合わせてある
        c = smooth2x(c)
        tot += save_png(c, os.path.join(ROOT, 'monster-hero/images/assistant', cfg['stand'], '%s_%s.png' % (cfg['prefix'], e)))
    st = ims[0].crop((0, nb[1], ims[0].width, int(round(nb[1] + H))))
    bx0, by0, bx1, by1 = bbox(st)
    vh = by1 - by0
    f = lambda y: round(float((y - nb[1] - by0) / vh), 4)
    cf = (cfg['chin'] - cfg['eye']) / vh
    row = dict(top=f(cfg['top']), eye=f(cfg['eye']), chin=f(cfg['chin']), m=round(float(cf / (0.82 * 0.1639)), 3))
    if cfg['above']:
        row['above'] = cfg['above']
    print('%s: 立ち絵 計%dKB / 見えている体の高さ %d' % (key, tot, vh))
    print('   顔の表(%s): %s: %s' % (cfg['stand'], key.split(':')[0], row))


if __name__ == '__main__':
    only = sys.argv[sys.argv.index('--only') + 1] if '--only' in sys.argv else None
    for k, c in HEADS.items():
        if only and k != only:
            continue
        run(k, c)

#!/usr/bin/env python3
"""全身画(images/assistant/fullbody/<名前>__<表情>.png)から、場面用の立ち絵(胸から上)を作る(助手部ココロ)。

元のシートが手元に無い助手(きき・ふだん)や、全身画が仕上がり済みの助手向け。
  ・8表情それぞれを、体のてっぺんをそろえて、顎の位置が「顎の割合 chin_frac」になる所で切る
  ・書き出し: monster-hero/images/assistant/<stand>/<接頭辞>_<表情>.png(減色して軽くする)
  ・顔の表(ASSISTANT_LIFE_STAND_FACE_OUTFIT)に貼る1行を出す
使い方: python3 tools/assistant/life-stand-from-fullbody.py [--only キー]
2026-11-15 r1115-143(社長「画質を下げなくていい」): 色を減らさない。全身画が元の大きさになった助手(きき)は、拡大せず元の細かさのまま切る
  ref_h … top・eye・chin を測ったときの全身画 normal の高さ。いまの全身画の高さとの比で、数字を読みかえる
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
    'kiki': dict(ref_h=770, name='kiki', stand='stand-normal', prefix='kiki', top=40, eye=145, chin=185, chin_frac=0.43, above=None),
    'kiki:halloween': dict(ref_h=721, name='kiki_halloween', stand='stand-halloween', prefix='kiki', top=70, eye=148, chin=188, chin_frac=0.43, above=0.95),
    'momosuke': dict(ref_h=767, name='momosuke', stand='stand-normal', prefix='momosuke', top=35, eye=147, chin=192, chin_frac=0.43, above=0.7),
    'momosuke:halloween': dict(ref_h=771, name='momosuke_halloween', stand='stand-halloween', prefix='momosuke', top=32, eye=138, chin=188, chin_frac=0.43, above=0.95),
    'erubin': dict(ref_h=715, name='erubin', stand='stand-normal', prefix='erubin', top=12, eye=71, chin=114, chin_frac=0.43, above=None),
    'erubin:sekiyuou': dict(ref_h=769, name='erubin_sekiyuou', stand='stand-sekiyuou', prefix='erubin', top=10, eye=71, chin=116, chin_frac=0.43, above=None),
    'atsu': dict(ref_h=775, name='atsu', stand='stand-normal', prefix='atsu', top=30, eye=100, chin=128, chin_frac=0.43, above=None),
    'kyuko': dict(ref_h=776, name='kyuko', stand='stand-normal', prefix='kyuko', top=20, eye=100, chin=135, chin_frac=0.43, above=None),
    'kyuko:winter': dict(ref_h=2924, name='kyuko_winter', stand='stand-winter', prefix='kyuko', top=25, eye=442, chin=572, chin_frac=0.43, above=None),
    'kiki:twintail': dict(ref_h=2812, name='kiki_twintail', stand='stand-twintail', prefix='kiki', top=322, eye=521, chin=691, chin_frac=0.43, above=0.95),
    'sorashido': dict(ref_h=769, name='sorashido', stand='stand-normal', prefix='sorashido', top=12, eye=89, chin=131, chin_frac=0.43, above=None),  # 馬骨(2026-11-15)。補正(いままでの絵)は stand-hosei へ移した(作り直さない)
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
    im.save(path, optimize=True)  # 色を減らさない(2026-11-15 r1115-143)
    return os.path.getsize(path) // 1024


def run(key, cfg):
    ims = [Image.open(os.path.join(FB, '%s__%s.png' % (cfg['name'], e))).convert('RGBA') for e in EXPR]
    boxes = [bbox(i) for i in ims]
    nb = boxes[0]
    # 全身画が数字を測ったときより大きくなっていれば(元の大きさで作り直した助手)、その比で読みかえる
    k = ims[0].height / float(cfg.get('ref_h') or ims[0].height)
    cfg = dict(cfg, top=cfg['top'] * k, eye=cfg['eye'] * k, chin=cfg['chin'] * k)
    # 顎の位置が chin_frac になる高さ(normal の体のてっぺんから測る)
    H = (cfg['chin'] - nb[1]) / cfg['chin_frac']
    g = int(round(4 * k))
    tot = 0
    for e, im, b in zip(EXPR, ims, boxes):
        bottom = int(round(b[1] + H))
        # 左右は切らない(2026-11-15 社長・窓口「左右は詰めずに切らない形で」。端の薄消しの縦筋も出さない)。
        #   並ぶ場面で顔が小さくならないよう、場面の置き方(assistantLifeStandLayout の visW)が体の幅の上限を持つ
        x0, x1 = max(0, b[0] - g), min(im.width, b[2] + g)
        c = im.crop((x0, max(0, b[1] - g), x1, min(im.height, bottom)))
        # 上の端から外へはみ出さないよう、切った絵は体の上端に合わせてある
        # 拡大しない(2026-11-15 r1115-143 社長の案A: 元の画素のまま切る。前は2倍へ補間していたが、細かさは増えず重さだけ増えるのでやめた)
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

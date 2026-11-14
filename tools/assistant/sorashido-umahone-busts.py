#!/usr/bin/env python3
"""ソラシド『馬骨』(2026-11-15 社長から)の、胸から上の絵(384x512)・顔アイコン(256x256)・寝顔を、全身画から作る(助手部ココロ)。
  ・images/assistant/sorashido_<表情>.PNG … 8表情(全身画 fullbody/sorashido__<表情>.png から、頭が目の位置 0.30・顔の大きさ(目から顎)61px になる倍率で切る)
  ・images/assistant/sorashido_sleep.PNG … 寝顔(受け取った tools/art-sources/assistant-fullbody/received-v1/sorashido-umahone-sleep.png。ZZZ の記号は消す)
  ・images/assistant/face/sorashido_<表情>.PNG・face/sorashido_sleep.PNG … 顔アイコン(顔のまんなかを丸の少し下へ。辺 = 顔の長さの約 5.6 倍)
  補正(いままでの絵)は images/assistant/hosei/ へ移してある(作り直さない)。
使い方: pip install scipy && python3 tools/assistant/sorashido-umahone-busts.py
"""
import os, sys
import numpy as np
from PIL import Image
from scipy import ndimage

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
IMG = os.path.join(ROOT, 'monster-hero/images/assistant')
SLEEP = os.path.join(ROOT, 'tools/art-sources/assistant-fullbody/received-v1/sorashido-umahone-sleep.png')
EXPR = ['normal', 'happy', 'wink', 'surprise', 'troubled', 'angry', 'crying', 'excited']
# 全身画 normal の測り(画素): 髪のてっぺん・目・顎(life-stand-from-fullbody.py の HEADS と同じ)
TOP, EYE, CHIN = 12, 89, 131
F = CHIN - EYE
OUT_W, OUT_H, EYE_Y, F_OUT = 384, 512, 0.30, 61.0
FACE_SIDE_F = 4.6   # 顔アイコンの辺 = 顔の長さ × これ(出力側の画素)
FACE_DOWN = 0.10    # 顔のまんなかを丸のまんなかより 辺の10% 下へ(いままでのソラシドと同じ)


def bbox(a):
    ys, xs = np.nonzero(a[..., 3] > 40)
    return xs.min(), ys.min(), xs.max() + 1, ys.max() + 1


def keep_main(im):
    a = np.array(im)
    lab, n = ndimage.label(a[..., 3] > 40)
    if n > 1:
        sizes = ndimage.sum(np.ones_like(lab), lab, range(1, n + 1))
        keep = lab == (1 + int(np.argmax(sizes)))
        a[..., 3] = np.where(ndimage.binary_dilation(keep, iterations=3), a[..., 3], 0)
    return Image.fromarray(a)


def head_cx(a, top, rows):
    sub = a[top:top + rows, :, 3] > 40
    return float(np.nonzero(sub)[1].mean())


def place(im, top_src, eye_src, f_src, cx_src):
    """全身(または寝顔)の絵を、顔の長さ f_src を F_OUT へ、目を (OUT_H*EYE_Y) へ、頭の真ん中を横の真ん中へ置いた 384x512 にする。"""
    s = F_OUT / f_src
    w, h = im.size
    big = im.resize((max(1, round(w * s)), max(1, round(h * s))), Image.LANCZOS)
    ox = round(OUT_W / 2 - cx_src * s)
    oy = round(OUT_H * EYE_Y - eye_src * s)
    canvas = Image.new('RGBA', (OUT_W, OUT_H), (0, 0, 0, 0))
    canvas.alpha_composite(big, (ox, oy)) if ox >= 0 and oy >= 0 else canvas.paste(big, (ox, oy), big)
    return canvas, (s, ox, oy)


def face_icon(bust, eye_out, cx_out, f_out):
    side = int(round(f_out * FACE_SIDE_F))
    cy = eye_out + 0.35 * f_out  # 目と鼻のあいだ
    x0 = int(round(cx_out - side / 2))
    y0 = int(round(cy - side * (0.5 + FACE_DOWN)))
    canvas = Image.new('RGBA', (side, side), (0, 0, 0, 0))
    canvas.paste(bust.crop((x0, y0, x0 + side, y0 + side)), (0, 0))
    return canvas.resize((256, 256), Image.LANCZOS)


def save(im, path):
    im.quantize(colors=256, method=Image.Quantize.FASTOCTREE, dither=Image.Dither.NONE).save(path, optimize=True)
    return os.path.getsize(path) // 1024


def main():
    os.makedirs(os.path.join(IMG, 'face'), exist_ok=True)
    base = Image.open(os.path.join(IMG, 'fullbody/sorashido__normal.png')).convert('RGBA')
    nb = bbox(np.array(base))
    tot = 0
    for e in EXPR:
        im = Image.open(os.path.join(IMG, 'fullbody/sorashido__%s.png' % e)).convert('RGBA')
        a = np.array(im)
        b = bbox(a)
        # 髪のてっぺんからの距離は normal と同じとみなす(頭の大きさは表情でほぼ変わらない)
        top_src = b[1]
        eye_src = top_src + (EYE - nb[1])
        cx = head_cx(a, top_src, int(F * 3))
        bust, (s, ox, oy) = place(im, top_src, eye_src, F, cx)
        tot += save(bust, os.path.join(IMG, 'sorashido_%s.PNG' % e))
        tot += save(face_icon(bust, OUT_H * EYE_Y, OUT_W / 2, F_OUT), os.path.join(IMG, 'face/sorashido_%s.PNG' % e))
    # 寝顔
    sl = keep_main(Image.open(SLEEP).convert('RGBA'))
    a = np.array(sl)
    b = bbox(a)
    # 受け取った寝顔の測り(画素): 髪のてっぺん・目・顎
    s_top, s_eye, s_chin = 15, 180, 262
    s_top = b[1] + 6
    cx = head_cx(a, b[1], int((s_chin - s_eye) * 3))
    bust, _ = place(sl, s_top, s_eye, s_chin - s_eye, cx)
    tot += save(bust, os.path.join(IMG, 'sorashido_sleep.PNG'))
    tot += save(face_icon(bust, OUT_H * EYE_Y, OUT_W / 2, F_OUT), os.path.join(IMG, 'face/sorashido_sleep.PNG'))
    # 顔の表(胸から上の絵 sorashido_normal.PNG の見えている体の上を0・下を1)
    n = Image.open(os.path.join(IMG, 'sorashido_normal.PNG')).convert('RGBA')
    bx0, by0, bx1, by1 = bbox(np.array(n))
    vh = by1 - by0
    f = lambda y: round(float((y - by0) / vh), 4)
    top_o = OUT_H * EYE_Y - (EYE - TOP) * F_OUT / F
    print('計 %d KB' % tot)
    print('顔の表(ASSISTANT_LIFE_STAND_FACE の sorashido): top=%s eye=%s chin=%s m=%s' % (f(top_o), f(OUT_H * EYE_Y), f(OUT_H * EYE_Y + F_OUT), round(float(F_OUT / vh / (0.82 * 0.1639)), 3)))


if __name__ == '__main__':
    main()

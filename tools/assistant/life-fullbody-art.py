#!/usr/bin/env python3
"""社長の全身画(tools/art-sources/assistant-fullbody/received-v1/)を、配信用の立ち絵に仕上げる(助手部ナカヨシ)。

  ・背景のぼかし(薄い半透明の光・灰色のもや)と、ふちの小さな点(ごみ)を取る
  ・ふちの画素の色を、体の内側の色で塗り直す(白・黒の色のにじみを消す)
  ・体の見える範囲で切り詰め(まわりに少しだけ余白)、512x768 の枠へ縮めて 256 色に減らす
  ・書き出し先: monster-hero/images/assistant/fullbody/<キー>.png

使い方: python3 tools/assistant/life-fullbody-art.py [--sheet 確認用の画像]
絵を足すときは下の ART に1行足して回す(キーは data の ASSISTANT_FULLBODY_ART と同じ)。
"""
import os, sys
import numpy as np
from PIL import Image

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
SRC = os.path.join(ROOT, 'tools/art-sources/assistant-fullbody/received-v1')
OUT = os.path.join(ROOT, 'monster-hero/images/assistant/fullbody')
# キー → 受け取った絵。キーは「助手id」か「助手id:服の名前」。
#   表情の絵(8表情: angry・crying・excited・happy・normal・surprise・troubled・wink)が届いたら、キーの後ろに @表情 を付けて足す
#   (例 'atsu@happy': '…')。書き出し先は atsu__happy.png。表情の絵が無い表情は、表情なしの絵(atsu.png)を出す
ART = {
    'atsu': 'atsu_transparent_fixed.png',
    'kiki': 'kiki_transparent_fixed.png',
    'kiki:halloween': 'kiki_halloween_transparent_fixed.png',
    'kyuko': 'kyuuko_transparent_fixed.png',
    'momosuke': 'msg1-pink-bunny.png',
    'momosuke:halloween': 'msg5-pink-bunny-devil-halloween.png',
    'mua': 'msg2-blonde-angel.png',
    'mua:halloween': 'msg3-blonde-halloween-witch.png',
    'mua:card-master': 'msg4-blonde-blue-cape.png',
    'sorashido': 'msg6-kimono-boy.png',
    'erubin': 'msg7-curly-man-casual.png',
    'erubin:sekiyuou': 'msg8-curly-man-robe.png',
}
OUT_W, OUT_H = 512, 768
MARGIN = 6  # 切り詰めのあとの余白(出力の画素)


def dil(m, r):
    out = m.copy()
    for _ in range(r):
        p = np.pad(out, 1)
        out = (p[1:-1, 1:-1] | p[:-2, 1:-1] | p[2:, 1:-1] | p[1:-1, :-2] | p[1:-1, 2:]
               | p[:-2, :-2] | p[:-2, 2:] | p[2:, :-2] | p[2:, 2:])
    return out


def ero(m, r):
    return ~dil(~m, r)


def label_keep(m, min_frac=0.03):
    """つながった塊のうち、いちばん大きい塊の min_frac 以上のものだけ残す。"""
    h, w = m.shape
    lab = np.zeros((h, w), np.int32)
    sizes = [0]
    n = 0
    ys, xs = np.nonzero(m)
    for y0, x0 in zip(ys, xs):
        if lab[y0, x0]:
            continue
        n += 1
        stack = [(y0, x0)]
        lab[y0, x0] = n
        cnt = 0
        while stack:
            y, x = stack.pop()
            cnt += 1
            for dy in (-1, 0, 1):
                for dx in (-1, 0, 1):
                    yy, xx = y + dy, x + dx
                    if 0 <= yy < h and 0 <= xx < w and m[yy, xx] and not lab[yy, xx]:
                        lab[yy, xx] = n
                        stack.append((yy, xx))
        sizes.append(cnt)
    if n == 0:
        return m
    big = max(sizes)
    keep = np.zeros(n + 1, bool)
    for i in range(1, n + 1):
        keep[i] = sizes[i] >= big * min_frac
    return keep[lab]


def clean(path, min_frac=0.03, arr=None):
    im = (np.array(Image.open(path).convert('RGBA')) if arr is None else arr).astype(np.float32)
    h0, w0 = im.shape[:2]
    # 4の倍数に足りない分は透明で足す(4分の1の大きさで塊を数えるため)
    ph, pw = (-h0) % 4, (-w0) % 4
    if ph or pw:
        im = np.pad(im, ((0, ph), (0, pw), (0, 0)), constant_values=0)
    rgb, a = im[..., :3], im[..., 3]
    # 1) 薄い半透明(光のぼかし・もや)を落とす。残すのは体の本体(アルファ 170 以上)と、その縁
    core = a >= 170
    # 2) 小さな点を落とす: 4分の1の大きさで数え、体から離れた小さな塊を消す
    sm = core[::4, ::4] | core[1::4, 1::4] | core[2::4, 2::4] | core[3::4, 3::4]
    sm = dil(sm, 2)
    keep_s = label_keep(sm, min_frac)
    keep = np.kron(keep_s, np.ones((4, 4), bool))[:core.shape[0], :core.shape[1]]
    keep = dil(keep, 6)  # 縁の細かい所を落とさない
    a2 = np.where(keep & (a >= 40), a, 0)
    # 縁をなめらかに: 薄い所(40〜96)は縁の1〜2画素だけ残す
    inner = ero(core & keep, 2)
    near = dil(core & keep, 2)
    a2 = np.where((a2 > 0) & (inner | near), a2, 0)
    a2 = np.where(a2 >= 170, a2, a2 * (a2 / 170.0))
    a2 = np.clip(a2, 0, 255)
    # 3) ふちの色を内側の色で塗り直す(白・黒のにじみ消し)
    solid = ero(a2 >= 250, 2)
    col = rgb.copy()
    known = solid.copy()
    for _ in range(6):
        w = known.astype(np.float32)
        pc = np.pad(col * w[..., None], ((1, 1), (1, 1), (0, 0)))
        pw = np.pad(w, 1)
        s = sum(pc[1 + dy:pc.shape[0] - 1 + dy, 1 + dx:pc.shape[1] - 1 + dx] for dy in (-1, 0, 1) for dx in (-1, 0, 1))
        c = sum(pw[1 + dy:pw.shape[0] - 1 + dy, 1 + dx:pw.shape[1] - 1 + dx] for dy in (-1, 0, 1) for dx in (-1, 0, 1))
        newk = (~known) & (c > 0)
        col[newk] = s[newk] / c[newk][:, None]
        known = known | newk
    rim = (a2 > 0) & ~solid
    col = np.where(rim[..., None], col, rgb)
    out = np.dstack([np.clip(col, 0, 255), a2]).astype(np.uint8)
    return Image.fromarray(out[:h0, :w0], 'RGBA')


def fit(im):
    a = np.array(im)[..., 3]
    ys, xs = np.nonzero(a > 40)
    box = (xs.min(), ys.min(), xs.max() + 1, ys.max() + 1)
    c = im.crop(box)
    s = min((OUT_W - 2 * MARGIN) / c.width, (OUT_H - 2 * MARGIN) / c.height)
    c = c.resize((max(1, round(c.width * s)), max(1, round(c.height * s))), Image.LANCZOS)
    # 体の大きさのまま、縦横の比を保って、まわりに余白だけ足す(枠いっぱいには引き伸ばさない)
    canvas = Image.new('RGBA', (c.width + 2 * MARGIN, c.height + 2 * MARGIN), (0, 0, 0, 0))
    canvas.paste(c, (MARGIN, MARGIN))
    return canvas


def quant(im):
    # 半透明を保ったまま 256 色へ(既存の立ち絵も 256 色の PNG)
    q = im.quantize(colors=256, method=Image.Quantize.FASTOCTREE, dither=Image.Dither.NONE)
    return q


def main():
    os.makedirs(OUT, exist_ok=True)
    tiles = []
    for key, f in ART.items():
        im = fit(clean(os.path.join(SRC, f)))
        name = key.replace('@', '__').replace(':', '_') + '.png'
        q = quant(im)
        q.save(os.path.join(OUT, name), optimize=True)
        back = q.convert('RGBA')
        tiles.append(back)
        print(name, im.size, os.path.getsize(os.path.join(OUT, name)) // 1024, 'KB')
    if '--sheet' in sys.argv:
        p = sys.argv[sys.argv.index('--sheet') + 1]
        H = 400
        sh = Image.new('RGB', (sum(int(t.width * H / t.height) + 10 for t in tiles), H), (120, 120, 120))
        x = 0
        for t in tiles:
            r = t.resize((int(t.width * H / t.height), H))
            sh.paste(r, (x, 0), r)
            x += r.width + 10
        sh.save(p)


if __name__ == '__main__':
    main()

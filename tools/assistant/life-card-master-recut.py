#!/usr/bin/env python3
"""みゅあのカードマスター全身9枚(土台+8表情)を、マゼンタ背景の生成元(raw)から抜き直す(助手部ナカヨシ・台帳 r1119-137)。

  素材: tools/art-sources/assistant-fullbody/mua-card-master-2026-11-23/
    final/ 完成版(顔・ポーズ・デザインの正解。ただしフチの透過が甘い)
    raw/   生成元(マゼンタ単色の背景・透過前)
  作り方:
    1. 元の絵 = raw。final と raw が違う所(angry の顔・耳の飾りなど)は、final をマゼンタに載せ直した色を使う。
       土台(表情なし)は final が描き直された別の絵(raw と画素がそろわない)なので、全体を final から作る
    2. マゼンタの抜き: 背景色 M と、すぐ内側の体の色 F を使い、画素 C を M と F の混ざりとしてアルファを求める
       (髪の毛先・羽の半透明が残り、2値にならない)。フチの色は M を取り除いた色(混ざりを戻した色)と F を混ぜる
    3. 色の滲み: フチの帯(透明から8画素以内)で、内側の体よりマゼンタ寄りの色を、内側の体の色の傾きまで戻す
    4. 左ポニーテールの後ろに混ざった「ベージュの編み目状の四角い背景装飾」を、絵ごとの多角形(DECOR)で透明にする
    5. 大きさ: いまの公開版と同じ体の高さ(アルファ 24 より大の範囲)にそろえ、まわりの余白は 4+6 画素(life-fullbody-art.py の fit と同じ)
       → 画像の高さ・足元の位置が今の公開版と同じになる(表示は高さ基準の object-contain)
  減色しない(r1115-143)。

使い方: python3 tools/assistant/life-card-master-recut.py [--only <表情|base>] [--out <フォルダ>]
  --out を付けないと monster-hero/images/assistant/fullbody/ へ書く(差し替え)
"""
import os, sys, json
import numpy as np
from PIL import Image, ImageDraw

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
SRC = os.path.join(ROOT, 'tools/art-sources/assistant-fullbody/mua-card-master-2026-11-23')
OUT = os.path.join(ROOT, 'monster-hero/images/assistant/fullbody')
EXPRS = ['', 'angry', 'crying', 'excited', 'happy', 'normal', 'surprise', 'troubled', 'wink']
M_DEFAULT = np.array([252.0, 0.0, 247.0])
MARGIN, PAD = 6, 4

# 体の高さの基準(いまの公開版のアルファ 24 より大の範囲の高さ)。公開版を差し替えたあとも同じ大きさで作り直せるよう、値で持つ
# (2026-11-23 差し替え前の公開版から測った値)
BODY_H = {}
BODY_H_FILE = os.path.join(SRC, 'body-height.json')

# 背景装飾(ベージュの編み目状の四角い板)を消す多角形。元の絵(raw / final)の座標。表情 → [多角形…]
DECOR = {}
DECOR_FILE = os.path.join(SRC, 'decor-mask.json')


def name_of(e):
    return 'mua_card-master' + ('__' + e if e else '')


def box_blur(a, r):
    """a: (H,W) または (H,W,C) の float。半径 r の箱ぼかし(はみ出しは端の値)"""
    if r <= 0:
        return a
    k = 2 * r + 1
    for ax in (0, 1):
        pad = [(0, 0)] * a.ndim
        pad[ax] = (r + 1, r)
        p = np.pad(a, pad, mode='edge')
        c = np.cumsum(p, axis=ax)
        n = a.shape[ax]
        hi = np.take(c, np.arange(k, k + n), axis=ax)
        lo = np.take(c, np.arange(0, n), axis=ax)
        a = (hi - lo) / k
    return a


def gblur(a, sigma):
    r = max(1, int(round(sigma * 0.9)))
    for _ in range(3):
        a = box_blur(a, r)
    return a


def dilate(m, r):
    out = m.copy()
    for _ in range(r):
        p = np.pad(out, 1)
        out = p[1:-1, 1:-1] | p[:-2, 1:-1] | p[2:, 1:-1] | p[1:-1, :-2] | p[1:-1, 2:]
    return out


def erode(m, r):
    return ~dilate(~m, r)


def fill_from(col, known, rounds=40, sigma=2.0):
    """known の画素の色を、まわりへ広げる(正規化したぼかしを繰り返す)。返り値: 全画素の推定色"""
    w = known.astype(float)
    acc = col * w[..., None]
    out = col.copy()
    have = known.copy()
    cw, ca = w, acc
    for _ in range(rounds):
        cw = gblur(cw, sigma)
        ca = gblur(ca, sigma)
        new = (~have) & (cw > 1e-4)
        out[new] = ca[new] / cw[new][:, None]
        have |= new
        if have.all():
            break
    return out


def source_image(e):
    """抜く元の絵(マゼンタ背景の RGB float)を作る。"""
    fin = np.asarray(Image.open(os.path.join(SRC, 'final', name_of(e) + '.png')).convert('RGBA')).astype(float)
    fa = fin[..., 3:] / 255.0
    # final は体の内側まで少し透けている所がある(手袋のアルファ 241 など)。フチから3画素より内側は不透明として扱う
    solid = erode(fin[..., 3] > 90, 3)
    fa = np.where(solid[..., None], 1.0, fa)
    fin_on_m = fin[..., :3] * fa + M_DEFAULT * (1 - fa)
    if not e:
        return fin_on_m, None
    raw = np.asarray(Image.open(os.path.join(SRC, 'raw', name_of(e) + '_raw.webp')).convert('RGB')).astype(float)
    # final と raw が違う所(手直しした所)。差をぼかして塊で拾う(angry の顔のような薄い描き直しも拾う。フチの細い差は拾わない)
    d = np.abs(raw - fin[..., :3]).mean(-1) * (fin[..., 3] > 200)
    rawmag = np.linalg.norm(raw - M_DEFAULT, axis=-1) < 60
    removed = (fin[..., 3] < 10) & (np.linalg.norm(raw - M_DEFAULT, axis=-1) > 150)  # final で消した物(troubled の耳飾りなど)
    changed = (gblur(d, 6) > 14) | erode(removed, 3)
    edit = dilate(changed, 8)
    w = np.clip(gblur(edit.astype(float), 3), 0, 1)[..., None]
    return raw * (1 - w) + fin_on_m * w, edit


def key_magenta(C):
    """マゼンタ背景の RGB から RGBA(float 0..255)を作る。
    アルファは画素ごとの「マゼンタの強さ」s = min(R,B) - G から求める(背景は約 247・体はふつう 0 以下)。
    細い毛先・リストバンドのような細い物でも、まわりの色の推定に頼らずに決まる。"""
    sat = lambda X: np.minimum(X[..., 0], X[..., 2]) - X[..., 1]
    s = sat(C)
    dist0 = np.linalg.norm(C - M_DEFAULT, axis=-1)
    bg = dist0 < 45
    Mloc = fill_from(np.where(bg[..., None], C, M_DEFAULT), bg, rounds=60, sigma=4.0)
    sM = sat(Mloc)
    # 体の色: 背景から遠く、マゼンタの強さが小さい画素(フチの混ざりは s が大きいので入らない)
    far = np.linalg.norm(C - Mloc, axis=-1)
    # 体の色は、フチのピンクを拾わないよう、マゼンタ気の少ない画素を2画素内へ寄せた所から取る
    fg = erode((far > 150) & (s < 15), 2)
    F = fill_from(C, fg, rounds=30, sigma=1.5)
    sF = np.clip(sat(F), -60, 25)
    a = np.clip((sM - s) / np.maximum(sM - sF, 60), 0, 1)
    # 2026-11-23 社長「髪周りがまだ汚くない？」: 半透明の帯を細くする(薄い所 0.22 までは捨て、0.75 で不透明)。暗い背景で明るい輪に見えないように
    a = np.clip((a - 0.22) / 0.53, 0, 1)
    a = a * a * (3 - 2 * a)
    a[(far > 150) & (s < 45)] = 1.0  # 背景から遠い・マゼンタ気が小さい(縞のピンク・赤い手袋など)は不透明
    a[far < 30] = 0.0
    # 色: 混ざりを戻した色。薄い所は体の色へ寄せる
    U = Mloc + (C - Mloc) / np.maximum(a, 0.05)[..., None]
    U = np.clip(U, 0, 255)
    U = F + np.clip(U - F, -70, 70)
    # フチの色は内側の体の色で置き換える(ほぼ不透明の所だけ、混ざりを戻した色を少し使う)
    t = np.clip((a - 0.85) / 0.15, 0, 1)[..., None]
    t = t * t * (3 - 2 * t)
    col = np.where((a >= 0.999)[..., None], C, U * t + F * (1 - t))
    # 色の滲み: 内側の体よりマゼンタ寄りの分を戻す(G を min(R,B) - 体の傾き まで上げる)。フチの帯だけ
    band = dilate(a < 0.98, 6) & (a > 0)
    g_floor = np.minimum(col[..., 0], col[..., 2]) - (np.clip(sF, 0, 8) + 4)  # 細いアホ毛のピンクも戻す(手袋・耳の赤・ピンクは少し明るむだけ)
    g2 = np.where(band, np.maximum(col[..., 1], g_floor), col[..., 1])
    col = np.dstack([col[..., 0], g2, col[..., 2]])
    # 外周の白いにじみ: 透明から2画素以内で、3画素内側の体より明るい画素は、内側の色へ寄せる(暗い背景で白い線に見えない)
    inner = erode(a >= 0.99, 3)
    Fi = fill_from(col, inner, rounds=20, sigma=1.5)
    rim = dilate(a < 0.5, 2) & (a > 0)
    lum = lambda X: X[..., 0] * 0.3 + X[..., 1] * 0.59 + X[..., 2] * 0.11
    lighter = rim & (lum(col) > lum(Fi) + 8)
    col = np.where(lighter[..., None], Fi * 0.85 + col * 0.15, col)
    return np.dstack([np.clip(col, 0, 255), a * 255.0])


def drop_specks(rgba):
    """体から離れた小さな点(背景のノイズ)を消す: 体の芯(不透明を3画素削った所)から、つながっている所だけ残す。"""
    m = rgba[..., 3] > 24  # 薄いかけら(浮いた細い線・点)はつながりに数えない
    keep = erode(rgba[..., 3] > 200, 3) & m
    while True:
        p = np.pad(keep, 1)
        nxt = (p[1:-1, 1:-1] | p[:-2, 1:-1] | p[2:, 1:-1] | p[1:-1, :-2] | p[1:-1, 2:]
               | p[:-2, :-2] | p[:-2, 2:] | p[2:, :-2] | p[2:, 2:]) & m
        if nxt.sum() == keep.sum():
            break
        keep = nxt
    rgba[~keep, 3] = 0
    return rgba


def _old_drop_specks(rgba, min_px=12):
    m = rgba[..., 3] > 8
    H, W = m.shape
    lab = np.zeros((H, W), np.int32)
    # 簡単なラベル付け(4近傍・幅優先)
    ys, xs = np.nonzero(m)
    idx = -np.ones(H * W, np.int64)
    flat = m.ravel()
    seen = np.zeros(H * W, bool)
    for s in (ys * W + xs):
        if seen[s]:
            continue
        stack = [s]
        seen[s] = True
        comp = []
        while stack:
            p = stack.pop()
            comp.append(p)
            y, x = divmod(p, W)
            for q in ((p - W) if y > 0 else -1, (p + W) if y < H - 1 else -1, (p - 1) if x > 0 else -1, (p + 1) if x < W - 1 else -1):
                if q >= 0 and flat[q] and not seen[q]:
                    seen[q] = True
                    stack.append(q)
        if len(comp) < min_px:
            idx[np.array(comp)] = 0
    kill = (idx == 0).reshape(H, W)
    rgba[kill, 3] = 0
    return rgba


def apply_decor(rgba, e):
    """編み目の四角(背景装飾)を、同じ髪の帯の少し先(右上・髪の流れに沿った所)を写して埋める。
    形(アルファ)は変えない(髪の外側の輪郭はそのまま)。箱は [左, 上, 右, 下, 写す元のずれx, ずれy]。"""
    boxes = DECOR.get(e or 'base', [])
    if not boxes:
        return rgba
    H, W = rgba.shape[:2]
    src = rgba[..., :3].copy()
    for b in boxes:
        x0, y0, x1, y1 = b[:4]
        dx, dy = (b[4], b[5]) if len(b) >= 6 else (32, -32)
        mk = np.zeros((H, W))
        mk[y0:y1, x0:x1] = 1.0
        w = np.clip(gblur(mk, 3.0) * 1.6, 0, 1)[..., None]
        moved = np.roll(np.roll(src, dy, axis=0), dx, axis=1)  # moved[y,x] = src[y-dy, x-dx]
        moved = np.roll(np.roll(src, -dy, axis=0), -dx, axis=1)  # moved[y,x] = src[y+dy, x+dx]
        rgba[..., :3] = rgba[..., :3] * (1 - w) + moved * w
    return rgba


def body_box(a):
    ys, xs = np.nonzero(a > 24)
    return xs.min(), ys.min(), xs.max() + 1, ys.max() + 1


def finish(rgba, e):
    """いまの公開版と同じ「画像の高さ・体の上端・体の高さ」にそろえる(足元の位置も同じになる)。
    横は体の幅 + 左右に今の版の左の余白。色はアルファで前掛けしてから縮める(透明部分の色がフチへ混ざらない)。"""
    ref = BODY_H[e or 'base']
    a = rgba[..., 3]
    x0, y0, x1, y1 = body_box(a)
    s = ref['body'] / float(y1 - y0)
    m = 3  # 体の範囲の外の薄いフチ(アルファ 24 以下)も持っていく
    X0, Y0, X1, Y1 = max(0, x0 - m), max(0, y0 - m), min(a.shape[1], x1 + m), min(a.shape[0], y1 + m)
    c = rgba[Y0:Y1, X0:X1]
    pre = np.dstack([c[..., :3] * c[..., 3:] / 255.0, c[..., 3]])
    nw, nh = max(1, round(c.shape[1] * s)), max(1, round(c.shape[0] * s))
    chans = [np.asarray(Image.fromarray(pre[..., i].astype(np.float32), 'F').resize((nw, nh), Image.LANCZOS)) for i in range(4)]
    al = np.clip(chans[3], 0, 255)
    rgb = np.dstack([np.clip(ch / np.maximum(al, 1e-3) * 255.0, 0, 255) for ch in chans[:3]])
    small = np.dstack([rgb, al])
    # 縮めたあとの体の上端・左端(元の座標の y0・x0 の位置)
    oy, ox = (y0 - Y0) * s, (x0 - X0) * s
    W = int(round((x1 - x0) * s)) + 2 * ref['side']
    out = np.zeros((ref['H'], W, 4))
    py, px = int(round(ref['top'] - oy)), int(round(ref['side'] - ox))
    sy0, sx0 = max(0, -py), max(0, -px)
    dy0, dx0 = max(0, py), max(0, px)
    hh, ww = min(nh - sy0, ref['H'] - dy0), min(nw - sx0, W - dx0)
    out[dy0:dy0 + hh, dx0:dx0 + ww] = small[sy0:sy0 + hh, sx0:sx0 + ww]
    out[..., 3] = np.where(out[..., 3] < 1.0, 0, out[..., 3])
    out[out[..., 3] == 0, :3] = 0
    return Image.fromarray(np.round(out).astype(np.uint8), 'RGBA')


def build(e):
    C, edit = source_image(e)
    rgba = key_magenta(C)
    rgba = apply_decor(rgba, e)
    rgba = drop_specks(rgba)
    return rgba


def main():
    global BODY_H, DECOR
    BODY_H = {k: v for k, v in json.load(open(BODY_H_FILE)).items() if not k.startswith('_')}
    DECOR = json.load(open(DECOR_FILE)) if os.path.exists(DECOR_FILE) else {}
    only = sys.argv[sys.argv.index('--only') + 1] if '--only' in sys.argv else None
    out = sys.argv[sys.argv.index('--out') + 1] if '--out' in sys.argv else OUT
    os.makedirs(out, exist_ok=True)
    for e in EXPRS:
        if only is not None and (e or 'base') != only:
            continue
        if '--keyed' in sys.argv:  # 元の絵の大きさのまま(装飾の位置を決めるとき用)
            Image.fromarray(np.round(build(e)).astype(np.uint8), 'RGBA').save(os.path.join(out, name_of(e) + '.keyed.png'))
            continue
        im = finish(build(e), e)
        p = os.path.join(out, name_of(e) + '.png')
        im.save(p, optimize=True)
        print('%-34s %s %5d KB' % (name_of(e) + '.png', im.size, os.path.getsize(p) // 1024))


if __name__ == '__main__':
    main()

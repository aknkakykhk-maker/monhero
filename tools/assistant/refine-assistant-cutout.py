#!/usr/bin/env python3
# 助手の表情シート(4列×2段・1マス 384x512・背景が塗られた絵)から、縁をていねいに抜いた背景透過 PNG を作る(2026-11-05 えるびん。社長「透過の雑さが目立つ」)。
#   python3 tools/assistant/refine-assistant-cutout.py <シート> <出力フォルダ> <接頭辞> <8つの表情名(カンマ区切り)>
#
# cut-assistant-sheet.py(外周から塗りつぶして抜き、ふち1〜2pxだけ半透明)との違い:
#   ① くせ毛のすき間: 背景色のかたまりのうち、まわりが暗い(髪)ものだけを抜く。まわりが白い(石油王の頭布)かたまりは残す
#   ② 毛先: 近くの「はっきり絵の色」と背景の色から、透け具合を求める(細い毛は半透明のまま残る)。背景の色かぶりは引いて落とす
#   ③ 白い布のように背景と色が近い所は、透け具合を色から求めず、輪郭だけを少しなめらかにする(ギザギザと欠けを防ぐ)
#   ④ 肩: マスの左右の端で切れている所は、端から 10px でなじませる
import sys, os
from collections import deque
import numpy as np
from PIL import Image

sheet, outdir, prefix, names = sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4].split(',')
assert len(names) == 8
CW, CH, BORDER = 384, 512, 2
TOL = 22.0            # 外周からつながる背景
POCKET_TOL, POCKET_MEAN, POCKET_RING_LUM = 30.0, 16.0, 125.0
BAND, FG_RADIUS, FG_MIN = 3, 5, 55.0
EDGE_FADE = 10
im = np.asarray(Image.open(sheet).convert('RGB')).astype(np.float32)
assert im.shape[:2] == (CH * 2, CW * 4)

def box_sum(a, r):
    # a: (H,W[,C]) の r 近傍の合計(累積和)
    pad = np.pad(a, ((r + 1, r), (r + 1, r)) + ((0, 0),) * (a.ndim - 2))
    c = pad.cumsum(0).cumsum(1)
    return c[2 * r + 1:, 2 * r + 1:] - c[:-2 * r - 1, 2 * r + 1:] - c[2 * r + 1:, :-2 * r - 1] + c[:-2 * r - 1, :-2 * r - 1]

def dilate(m, r):
    return box_sum(m.astype(np.float32), r) > 0

def blur(a, s):
    # ガウスぼかし(分離可能)
    k = int(s * 3) + 1; x = np.arange(-k, k + 1); w = np.exp(-x * x / (2 * s * s)); w /= w.sum()
    p = np.pad(a, ((k, k), (k, k)), mode='edge')
    p = sum(w[i] * p[:, i:i + a.shape[1] + 0] [:, :] if False else w[i] * p[:, i:i + a.shape[1]] for i in range(2 * k + 1))
    p = sum(w[i] * p[i:i + a.shape[0], :] for i in range(2 * k + 1))
    return p

def flood(cand, seeds):
    H, W = cand.shape; seen = np.zeros_like(cand); q = deque()
    for y, x in zip(*np.nonzero(seeds & cand)): seen[y, x] = True; q.append((y, x))
    while q:
        y, x = q.popleft()
        for ny, nx in ((y + 1, x), (y - 1, x), (y, x + 1), (y, x - 1)):
            if 0 <= ny < H and 0 <= nx < W and cand[ny, nx] and not seen[ny, nx]:
                seen[ny, nx] = True; q.append((ny, nx))
    return seen

def components(cand):
    H, W = cand.shape; lab = np.zeros((H, W), np.int32); n = 0
    for y0, x0 in zip(*np.nonzero(cand)):
        if lab[y0, x0]: continue
        n += 1; q = deque([(y0, x0)]); lab[y0, x0] = n
        while q:
            y, x = q.popleft()
            for ny, nx in ((y + 1, x), (y - 1, x), (y, x + 1), (y, x - 1)):
                if 0 <= ny < H and 0 <= nx < W and cand[ny, nx] and not lab[ny, nx]:
                    lab[ny, nx] = n; q.append((ny, nx))
    return lab, n

os.makedirs(outdir, exist_ok=True)
for k, name in enumerate(names):
    cy, cx = (k // 4) * CH, (k % 4) * CW
    P = im[cy:cy + CH, cx:cx + CW].copy()
    # 境目の線を内側の画素で埋める
    P[:, :BORDER] = P[:, BORDER:BORDER + 1]; P[:, -BORDER:] = P[:, -BORDER - 1:-BORDER]
    P[:BORDER] = P[BORDER:BORDER + 1]; P[-BORDER:] = P[-BORDER - 1:-BORDER]
    corners = np.concatenate([P[4:24, 4:24].reshape(-1, 3), P[4:24, -24:-4].reshape(-1, 3)])
    B = corners.mean(0)
    D = np.sqrt(((P - B) ** 2).sum(2))
    edge = np.zeros((CH, CW), bool); edge[0] = edge[-1] = True; edge[:, 0] = edge[:, -1] = True
    lum = P @ np.array([.299, .587, .114], np.float32)
    sat = (P.max(2) - P.min(2)) / np.maximum(P.max(2), 1)
    # 髪のまわりの白いふち取り(背景より白い)。暗い髪のすぐそばにある白っぽい画素は、背景とつながっていれば背景として抜く
    #   (石油王の白い頭布は、絵の線で背景から切れているので、ここでは抜けない)
    dark = lum < 110
    light = (lum > 205) & (sat < 0.14)
    halo = light & dilate(dark, 3)
    bg = flood((D < TOL) | halo, edge)
    # ① くせ毛のすき間(まわりが暗い、背景色か白っぽいかたまり)
    lab, n = components(((D < POCKET_TOL) | light) & ~bg)
    for i in range(1, n + 1):
        m = lab == i
        if m.sum() < 3: continue
        if not (D[m].mean() < POCKET_MEAN or light[m].mean() > .8): continue
        ring = dilate(m, 2) & ~m & ~bg
        if ring.any() and lum[ring].mean() < POCKET_RING_LUM: bg |= m
    fg = ~bg
    # ② 近くの「はっきり絵の色」(背景から FG_MIN 以上離れた不透明側の画素の平均)
    solid = (fg & (D > FG_MIN)).astype(np.float32)
    cnt = box_sum(solid, FG_RADIUS)
    F = box_sum(P * solid[..., None], FG_RADIUS) / np.maximum(cnt, 1)[..., None]
    FB = F - B; fb2 = (FB ** 2).sum(2)
    a_col = np.clip(((P - B) * FB).sum(2) / np.maximum(fb2, 1), 0, 1)
    band = dilate(bg, BAND) & dilate(fg, BAND)
    contrast = (cnt > 0) & (np.sqrt(fb2) > 60)
    # ③ 色の近い所(白い布)は、抜き方の形を少しぼかしてなめらかにする
    a_shape = np.clip((blur(fg.astype(np.float32), 0.8) - 0.5) * 2.2 + 0.5, 0, 1)
    A = np.where(fg, 1.0, 0.0)
    A = np.where(band & contrast, np.where(fg, np.maximum(a_col, 0.35 * (D > TOL)), a_col * (D > TOL * .6)), A)
    A = np.where(band & ~contrast, a_shape, A)
    # ④ マスの左右の端でなじませる(肩の切れ目)
    ramp = np.clip(np.minimum(np.arange(CW), CW - 1 - np.arange(CW)) / EDGE_FADE, 0, 1)
    A = A * ramp[None, :]
    # 背景の色かぶりを引く(半透明の所)
    a3 = np.maximum(A, 1e-3)[..., None]
    C = np.where((A > 0.06)[..., None], np.clip(B + (P - B) / a3, 0, 255), np.where((cnt > 0)[..., None], F, P))
    C = np.where((A >= 0.999)[..., None], P, C)
    out = np.dstack([C, np.clip(A * 255 + .5, 0, 255)]).astype(np.uint8)
    path = os.path.join(outdir, f'{prefix}_{name}.PNG')
    Image.fromarray(out, 'RGBA').save(path, optimize=True)
    print(path, f'背景 {tuple(int(v) for v in B)}  半透明 {int(((A > 0) & (A < 1)).sum())}px')

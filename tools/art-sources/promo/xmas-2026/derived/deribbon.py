# 告知ポスターの上の赤いリボン(「クリスマスイベント 開催予告」)だけを消す(r1126-061 追記1)。使い方は同じフォルダの README.md
import sys, json, cv2, numpy as np
src, dst = sys.argv[1], sys.argv[2]
cfg = json.loads(sys.argv[3])
bx0, bx1, by1 = cfg['body']; sx0, sx1 = cfg['sample']; f = cfg.get('feather', 24)
orig = cv2.imread(src, cv2.IMREAD_COLOR); img = orig.astype(np.float32)
strip = img[0:by1, sx0:sx1]
W = bx1 - bx0
# 土台: 行ごとの平均の色(横の金の線と空の明るさはそのまま)。模様: 元の帯の細かい所だけを、ずらしながら並べる
base = np.repeat(strip.mean(axis=1, keepdims=True), W, axis=1)
detail = strip - cv2.GaussianBlur(strip, (0, 0), 3)
rng = np.random.default_rng(7); sw = strip.shape[1]; parts = []; got = 0
while got < W:
    k = int(rng.integers(0, sw)); piece = np.roll(detail, k, axis=1); parts.append(piece); got += sw
dw = np.concatenate(parts, axis=1)[:, :W]; dw = np.clip(dw, -18, 18) * 0.7
rep = base + dw
ext = cfg.get('extend', 0)
if ext:
    # 題字の上の端まで伸ばす: 列ごとに、y>=by1 で金色が縦に run 字以上続く最初の所を題字の上の端とみる
    o = orig.astype(np.int32); gold = (o[...,2] > 150) & (o[...,1] > 90) & (o[...,0] < 120) & (o[...,2] > o[...,0] + 60)
    lim = by1 + ext; tops = np.full(W, lim)
    for i in range(W):
        col = gold[by1 - 6:lim + 12, bx0 + i]; run = 0
        for j, v in enumerate(col):
            run = run + 1 if v else 0
            if run >= cfg.get('run', 7): tops[i] = min(lim, by1 - 6 + j - run + 1); break
    by1n = lim
    strip = img[0:by1n, sx0:sx1]
    base = np.repeat(strip.mean(axis=1, keepdims=True), W, axis=1)
    detail = strip - cv2.GaussianBlur(strip, (0, 0), 3); parts = []; got = 0
    while got < W: parts.append(np.roll(detail, int(rng.integers(0, sw)), axis=1)); got += sw
    dw = np.clip(np.concatenate(parts, axis=1)[:, :W], -18, 18) * 0.7; rep = base + dw
    a = np.zeros((by1n, W), np.float32)
    for i in range(W):
        t = max(by1 - 6, int(tops[i]) - 3); a[:t, i] = 1; r_ = np.arange(t, min(by1n, t + 3)); a[r_, i] = np.linspace(1, 0, len(r_) + 1)[:-1]
    a[:, :f] *= np.linspace(0, 1, f)[None, :]; a[:, -f:] *= np.linspace(1, 0, f)[None, :]
    by1 = by1n
else:
  a = np.ones((by1, W), np.float32)
if not ext:
  a[:, :f] *= np.linspace(0, 1, f)[None, :]; a[:, -f:] *= np.linspace(1, 0, f)[None, :]; fb = cfg.get('featherBottom', f); a[-fb:, :] *= np.linspace(1, 0, fb)[:, None]
img[0:by1, bx0:bx1] = img[0:by1, bx0:bx1] * (1 - a[..., None]) + rep * a[..., None]
out = np.clip(img, 0, 255).astype(np.uint8)
full = np.zeros(out.shape[:2], np.uint8)
for (x0, x1, y0, y1, *opt) in cfg['tails']:
    roi = orig[y0:y1, x0:x1].astype(np.int32); b, g, r = roi[...,0], roi[...,1], roi[...,2]
    m = (((r > 70) & (r > g * 1.6) & (r > b * 1.6)) | ((g > r + 15) & (g > b + 5) & (g > 50)))
    if opt and opt[0] == 'gold': m |= (r > 140) & (g > 90) & (b < 110) & (r > b + 60)
    m = m.astype(np.uint8) * 255
    full[y0:y1, x0:x1] |= cv2.dilate(m, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (11, 11)))
out = cv2.inpaint(out, full, 7, cv2.INPAINT_TELEA)
cv2.imwrite(dst, out); cv2.imwrite(dst + '.mask.png', full)

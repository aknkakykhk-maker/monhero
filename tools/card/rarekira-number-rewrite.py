# ウンディーネ・スネグーラチカのレアキラの絵(社長が送った完成カード)の右下の番号だけを、ゲームの番号に合わせて書き換える(2026-11-15 社長)。
#   ウンディーネ No.C-◆02 → ◆03 / スネグーラチカ No.C-◆03 → ◆04。元の絵は加工せず、書き換えた版を別名(-renumbered.jpg)で置く。
#   番号の字は、同じ絵の別の字(「3」)を切り出して使う。「4」は同じ字体の別カード(hybrid/C044.jpg の白い「4」)の形を、字の高さに合わせて写す。
#   使い方: python3 tools/card/rarekira-number-rewrite.py
import numpy as np
from PIL import Image, ImageFilter
D = 'tools/art-sources/card-battle/undine/received-2026-11-15/'
GL = (941, 1382, 975, 1421)   # 最後の字(と、まわりの縁取り)を含む四角 x0,y0,x1,y1(右・下は含まない)
Y0, Y1 = 1389, 1413           # 字の上下(含む)

def lum(a): return a[..., 0] * 0.299 + a[..., 1] * 0.587 + a[..., 2] * 0.114

def glyph_alpha(a, box, light, dark):
    x0, y0, x1, y1 = box
    L = lum(a[y0:y1, x0:x1].astype(float))
    return np.clip((light - L) / (light - dark), 0, 1)

def diffuse_fill(a, mask, it=3000):
    """mask の所を、外側の色からなめらかに広げて埋める"""
    out = a.astype(float).copy()
    m = mask.copy()
    known = ~m
    for _ in range(it):
        p = np.pad(out, ((1, 1), (1, 1), (0, 0)), mode='edge')
        avg = (p[:-2, 1:-1] + p[2:, 1:-1] + p[1:-1, :-2] + p[1:-1, 2:]) / 4
        out[m] = avg[m]
    return out

def dilate(mask, r):
    im = Image.fromarray((mask * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(2 * r + 1))
    return np.array(im) > 127

su = np.array(Image.open(D + 'undine-C-dia02-rarekira.jpg').convert('RGB'))
ss = np.array(Image.open(D + 'snegurachka-C-dia03-rarekira.jpg').convert('RGB'))

# --- 「3」(スネグーラチカの絵の最後の字)の形と色
x0, y0, x1, y1 = GL
reg = ss[y0:y1, x0:x1].astype(float)
Ls = lum(reg)
dark_px = reg[Ls < 70]
dark_col = dark_px.mean(0) if len(dark_px) else np.array([8, 12, 40.0])
# 縁取りの色(字のすぐ外のわっか)
core = Ls < 90
ring = dilate(core, 3) & ~dilate(core, 1)
halo_col = np.median(reg[ring], axis=0)
light = float(lum(halo_col[None, :])[0]); darkv = float(np.percentile(Ls[core], 10)) if core.any() else 20.0
a3 = glyph_alpha(ss, GL, light, darkv)
a3[: Y0 - y0] = 0; a3[Y1 + 1 - y0:] = 0
cols = np.nonzero(a3.max(0) > 0.3)[0]
# 「3」の右の字だけ残す(左の「0」の右はしは x0 の外に出ないよう四角を選んである)

def put(img, alpha, dst_box, dcol, halo_alpha=None, hcol=None):
    out = img.astype(float).copy()
    x0_, y0_, x1_, y1_ = dst_box
    reg_ = out[y0_:y1_, x0_:x1_]
    if halo_alpha is not None:
        reg_[:] = reg_ * (1 - halo_alpha[..., None]) + hcol * halo_alpha[..., None]
    reg_[:] = reg_ * (1 - alpha[..., None]) + dcol * alpha[..., None]
    return np.clip(out, 0, 255).astype(np.uint8)

# --- ウンディーネ: 「2」を消して「3」を置く(地は一面の青で、縁取りは目立たない)
ux = ss.copy()
ua = su.copy()
reg_u = ua[y0:y1, x0:x1]
core_u = lum(reg_u.astype(float)) < 90
core_u[:, :4] = False  # 左の「0」は触らない(0 は x 919〜941・最後の字は 945〜)
mask_u = dilate(core_u, 3)
mask_u[:, :3] = False
full = np.zeros(ua.shape[:2], bool); full[y0:y1, x0:x1] = mask_u
filled = diffuse_fill(ua[y0 - 8:y1 + 8, x0 - 8:x1 + 8], full[y0 - 8:y1 + 8, x0 - 8:x1 + 8])
ua[y0 - 8:y1 + 8, x0 - 8:x1 + 8] = np.clip(filled, 0, 255).astype(np.uint8)
# 「3」を置く: 「2」の右はし(966)に「3」の右はし(965)をそろえる
a3u = np.zeros_like(a3); a3u[:, 1:] = a3[:, :-1]
ua = put(ua, a3u, GL, dark_col)
Image.fromarray(ua).save(D + 'undine-C-dia02-rarekira-renumbered.jpg', quality=96, subsampling=0)

# --- スネグーラチカ: 「3」を消して「4」を置く
sa = ss.copy()
core_s = Ls < 90
core_s[:, :4] = False
mask_s = dilate(core_s, 4)
mask_s[:, :4] = False
full = np.zeros(sa.shape[:2], bool); full[y0:y1, x0:x1] = mask_s
filled = diffuse_fill(sa[y0 - 8:y1 + 8, x0 - 8:x1 + 8], full[y0 - 8:y1 + 8, x0 - 8:x1 + 8])
sa[y0 - 8:y1 + 8, x0 - 8:x1 + 8] = np.clip(filled, 0, 255).astype(np.uint8)
# 「4」の形: 同じ字体の別カード(白い字)から
c44 = np.array(Image.open('tools/art-sources/card-battle/hybrid/C044.jpg').convert('RGB')).astype(float)
cx0, cy0, cx1, cy1 = 642, 960, 680, 996
Lc = lum(c44[cy0:cy1, cx0:cx1])
bg = np.percentile(Lc, 20)
al = np.clip((Lc - (bg + 40)) / (235 - (bg + 40)), 0, 1)
ys, xs = np.nonzero(al > 0.35)
gx0, gx1, gy0, gy1 = xs.min(), xs.max() + 1, ys.min(), ys.max() + 1
# 最後の「4」だけ(右の字): 右から見て、字の幅ぶん
colsum = (al > 0.35).sum(0)
end = gx1
start = end - 1
while start > 0 and colsum[start - 1] > 0: start -= 1
g = al[gy0:gy1, start:end]
gh, gw = g.shape
H = Y1 - Y0 + 1
scale = H / gh
g_img = Image.fromarray((g * 255).astype(np.uint8)).resize((22, H), Image.LANCZOS)  # 「3」と同じ幅(22px)
g4 = np.array(g_img).astype(float) / 255
g4 = np.clip((g4 - 0.08) / 0.4, 0, 1)
canvas = np.zeros((y1 - y0, x1 - x0))
right = 966  # 字の右はし(含む)
cx = right + 1 - g4.shape[1] - x0
canvas[Y0 - y0:Y0 - y0 + H, cx:cx + g4.shape[1]] = g4
hb = np.array(Image.fromarray(((canvas > 0.3) * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(2.2))).astype(float) / 255
halo = np.clip((hb - 0.08) / 0.1, 0, 1)  # 丸い縁取り(字から約3px)
sa = put(sa, canvas, GL, dark_col, halo_alpha=np.clip(halo * 1.0, 0, 1), hcol=halo_col)
Image.fromarray(sa).save(D + 'snegurachka-C-dia03-rarekira-renumbered.jpg', quality=96, subsampling=0)
print('ok', 'halo', halo_col.round(), 'dark', dark_col.round(), '4 size', g4.shape)

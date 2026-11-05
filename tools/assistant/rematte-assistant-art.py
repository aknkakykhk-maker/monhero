# 助手の胸から上の絵(384x512)の切り抜きを、原本のシートから仕上げ直す(描き直さない)。2026-11-05 えるびん(社長「透過の雑さが目立つ」)
#
#   python3 tools/assistant/rematte-assistant-art.py <原本シート> <今の切り抜き> <出力(RGBA)> [--cloth]
#   (配信用は imagequant でディザ付き256色に: pip install imagequant)
#
# やっていること
#   - 縁の近くだけ、「元の背景の塗り色」と「近くの絵の色」の比から透明度を出し直す(毛先の半透明が残り、くせ毛のすき間の背景色が抜ける)
#   - 形の縁は4倍に広げてならし、ギザギザを消す
#   - 半透明の所は背景の色を差し引いて、色かぶり(クリーム色のふち)を落とす
#   - 原本のマスの区切り線(下・左右の端の1列が暗い)を内側の色で置き換える
#   --cloth … 背景とほぼ同じ色の布があるとき(衣装『石油王』の白い頭布)。背景に近い色の所は抜かず、縁をならすだけにする
#   原本のマスは左上(行0・列0=ふつうの表情)
import sys
import numpy as np
from PIL import Image
from scipy import ndimage as nd

sheet, cur, out = sys.argv[1:4]
cloth = '--cloth' in sys.argv  # 背景とほぼ同じ色の布(石油王の頭布)があるとき
r, c = 0, 0
S = np.asarray(Image.open(sheet).convert('RGB')).astype(float)
C = S[r*512:(r+1)*512, c*384:(c+1)*384].copy()
# 原本のマスの区切り線(下・左右の端の1列が暗い)を、内側の色で置き換える
C[-1] = C[-2]; C[:, 0] = C[:, 1]; C[:, -1] = C[:, -2]
A0 = np.asarray(Image.open(cur).convert('RGBA')).astype(float)[..., 3] / 255
H, W = A0.shape
m = A0 > 0.5
# 小さな浮きかけらを落とす
lab, n = nd.label(m)
if n > 1:
    sizes = nd.sum(m, lab, range(1, n + 1))
    m = np.isin(lab, [i + 1 for i, s in enumerate(sizes) if s >= 40])
din = nd.distance_transform_edt(m)
dout = nd.distance_transform_edt(~m)

def nconv(val, w, sigma):
    num = np.stack([nd.gaussian_filter(val[..., k] * w, sigma) for k in range(3)], -1)
    den = nd.gaussian_filter(w, sigma)[..., None]
    return num / np.maximum(den, 1e-6), den[..., 0]

# 背景の色(塗りの色)。切り抜きの外で、縁から離れた所
B, _ = nconv(C, ((~m) & (dout > 2)).astype(float), 18)
B[~np.isfinite(B)] = 0
far = np.linalg.norm(C - B, axis=-1)
# 絵の色(近くの不透明な所)。背景と同じ色のすき間は除く
known_f = (m & (din > 1.2) & (far > 45)).astype(float)
F1, w1 = nconv(C, known_f, 2.0)
F2, _ = nconv(C, known_f, 6.0)
F = np.where((w1 > 0.05)[..., None], F1, F2)
d = F - B
dn2 = (d * d).sum(-1)
a_col = np.clip(((C - B) * d).sum(-1) / np.maximum(dn2, 1), 0, 1)
reliable = dn2 > 80 ** 2

# 布の輪郭線の外に残った背景色の帯を、外から2画素まではがす(輪郭線の茶色で止まる)
if cloth:
    for _ in range(2):
        rim = m & (nd.distance_transform_edt(m) <= 1.5) & (far < 45)
        m = m & ~rim
    din = nd.distance_transform_edt(m)
    dout = nd.distance_transform_edt(~m)
# 形だけの透明度(ギザギザをならす): 4倍に広げてぼかし、0.5で切って、元の大きさへ平均で戻す
k = 4
up = np.asarray(Image.fromarray((m * 255).astype(np.uint8)).resize((W * k, H * k), Image.BILINEAR)).astype(float) / 255
up = nd.gaussian_filter(up, 2.2) > 0.5
geo = up.reshape(H, k, W, k).mean((1, 3))

# 色で出し直す所: 縁の近く・縁の外の少し・中に残った背景色のすき間
pocket = m & (far < 40) & (din <= 40)
pocket = nd.binary_dilation(pocket, iterations=2) & m  # すき間のふちの、髪と混ざった画素も
if cloth:
    pocket[:] = False
zone = ((m & (din <= 6)) | ((~m) & (dout <= 3)) | pocket) & reliable
if cloth:
    zone &= ~(m & (far < 60))  # 中の、背景に近い色(白い布)は抜かない
alpha = geo.copy()
alpha[zone] = a_col[zone]
# 中の深い所は不透明のまま(目の白目などを抜かない)
alpha[m & (din > 6) & ~pocket] = 1
# ノイズを少しならす(縁の帯だけ)
sm = nd.gaussian_filter(alpha, 0.5)
band = (din <= 8) | (dout <= 4) | pocket
alpha = np.where(band, sm, alpha)
alpha[alpha < 0.05] = 0
alpha[alpha > 0.96] = 1
# 画像の下・左右の端に接する所(服の切れ目)は、元のまま不透明にそろえる
edge = np.zeros_like(m); edge[-2:, :] = True; edge[:, :1] = True; edge[:, -1:] = True
alpha[edge & m] = 1

# 色かぶりを落とす: 半透明の所は背景の色を差し引き、薄い所ほど近くの絵の色に寄せる
a3 = np.maximum(alpha, 1e-3)[..., None]
U = np.clip(B + (C - B) / a3, 0, 255)
wgt = np.clip((alpha - 0.15) / 0.6, 0, 1)[..., None]
col = np.where((alpha < 1)[..., None], wgt * U + (1 - wgt) * F, C)
col = np.where(np.isfinite(col), col, C)
outimg = np.dstack([np.clip(col, 0, 255), alpha * 255]).round().astype(np.uint8)
outimg[alpha == 0, :3] = 0
Image.fromarray(outimg, 'RGBA').save(out, optimize=True)
print('半透明の画素', int(((alpha > 0) & (alpha < 1)).sum()), 'すき間', int(pocket.sum()))

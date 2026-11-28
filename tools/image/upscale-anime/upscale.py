# 助手などのアニメ絵を AI で拡大する(Real-ESRGAN アニメ用 x4・ncnn・CPU)
# 使い方(リポジトリの中で):
#   python3.11 -m venv tools/image/upscale-anime/.venv  (.venv はコミットしない)
#   tools/image/upscale-anime/.venv/bin/pip install ncnn pillow numpy realesrgan-ncnn-py
#     realesrgan-ncnn-py は模型の置き場所としてだけ使う(本体は libomp/vulkan が要って読めない)。模型は site-packages/realesrgan_ncnn_py/models/
#   .venv/bin/python tools/image/upscale-anime/upscale.py <模型の置き場所> <元.png> <出す.png> <元に対する倍率(例 2)>
# 4倍にしてから倍率へ縮める。透明は元の透明をなめらかに拡大(Lanczos)。192px ずつ・のりしろ 12px で区切って回す(メモリ節約)
# 2026-11-28 きゅうこのサンタ服(#7949)で使った物
import sys, numpy as np, ncnn
from PIL import Image

MD = sys.argv[1]  # models dir
src, dst, out_scale = sys.argv[2], sys.argv[3], float(sys.argv[4])
net = ncnn.Net()
net.opt.use_vulkan_compute = False
net.opt.num_threads = 4
net.load_param(f"{MD}/realesrgan-x4plus-anime.param")
net.load_model(f"{MD}/realesrgan-x4plus-anime.bin")

im = Image.open(src).convert("RGBA")
W, H = im.size
rgb = np.asarray(im.convert("RGB")).astype(np.float32) / 255.0
# 透明部分は白で埋めると縁に白がにじむので、近い色を残すため黒でなくそのまま使う
T, P, S = 192, 12, 4
out = np.zeros((H * S, W * S, 3), np.float32)
for y in range(0, H, T):
    for x in range(0, W, T):
        x0, y0 = max(0, x - P), max(0, y - P)
        x1, y1 = min(W, x + T + P), min(H, y + T + P)
        tile = np.ascontiguousarray(rgb[y0:y1, x0:x1].transpose(2, 0, 1))
        ex = net.create_extractor()
        ex.input("data", ncnn.Mat(tile))
        _, o = ex.extract("output")
        o = np.array(o).transpose(1, 2, 0)
        ox, oy = (x - x0) * S, (y - y0) * S
        tw, th = (min(x + T, W) - x) * S, (min(y + T, H) - y) * S
        out[y * S:y * S + th, x * S:x * S + tw] = o[oy:oy + th, ox:ox + tw]
up = Image.fromarray((np.clip(out, 0, 1) * 255 + 0.5).astype(np.uint8))
alpha = im.getchannel("A").resize(up.size, Image.LANCZOS)
up.putalpha(alpha)
tw, th = round(W * out_scale), round(H * out_scale)
up.resize((tw, th), Image.LANCZOS).save(dst, optimize=True)
print(src, (W, H), "->", (tw, th))

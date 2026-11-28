"""助手の絵を、原本の縁を削らずに作る口(助手部ナカヨシ・2026-11-28 r1126-095 追記2)。

社長「助手の画質悪い。ソラシド探偵の顔周り」「最近こういうぼやけ加工になってるのが多くて助手全部直したんだけど、
新着替えでまた同じ現象だから実装の仕方が悪いよね」。
#8044 では、原本を AI で2倍にした絵(透けも一緒に広げた物)に、今までの縁の掃除(life-fullbody-art.py の clean())をかけていた。
その掃除の 4) 透けをぼかす・5) 縁の色を内側の色で塗り直す が、外の黒い線を肌色で塗りつぶして
頬〜あごの白い縁取り・外の線の消え・髪先のガタガタを作っていた(止め絵 docs/progress/assistant-art/edge-fix-2026-11-28/)。

ここでの作り方(これだけ。ほかの加工は足さない):
  ・透け方(アルファ)は原本の物を、そのまま Lanczos で出来上がりの大きさへ広げる。AI 拡大の透けは使わない
  ・色は、AI 拡大した絵(tools/image/upscale-anime/upscale.py)があればその色、無ければ原本の色を Lanczos で広げた物
  ・縁は削らない・ぼかさない・塗り直さない。「なめらかにする」「ぼかして馴染ませる」加工は縁にも中身にも入れない
  ・消すのは、体から離れた小さなかけら(ごみ)と、線(不透明度 64 以上)から原本の2画素より外の薄いもや(64 未満)だけ
  ・体の不透明度が 245〜254(原本が 253 などで、ほんの少し透ける)の所は 255 にそろえる(縁の 245 未満には触らない)
出来上がりは tools/assistant/art-edge-check.py が原本と比べて見張る(白い縁取り・外の線の消え・ギザギザ・ぼやけ)。
  compose(orig, color=None, min_frac=0.004) … PIL の RGBA を返す
"""
import numpy as np
from PIL import Image


def _dil(m, r):
    out = m.copy()
    for _ in range(r):
        p = np.pad(out, 1)
        out = (p[1:-1, 1:-1] | p[:-2, 1:-1] | p[2:, 1:-1] | p[1:-1, :-2] | p[1:-1, 2:]
               | p[:-2, :-2] | p[:-2, 2:] | p[2:, :-2] | p[2:, 2:])
    return out


def keep_big(m, min_frac):
    """つながった塊(8方向)のうち、いちばん大きい塊の min_frac 以上の物だけ残す。
    大きい絵でも速いよう、4画素四方を1つにまとめた小さい絵で数えて戻す(小さい絵で同じ塊なら同じ塊とみる)"""
    import importlib.util, os
    spec = importlib.util.spec_from_file_location('fb_label', os.path.join(os.path.dirname(os.path.abspath(__file__)), 'life-fullbody-art.py'))
    fb = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(fb)
    h, w = m.shape
    ph, pw = (-h) % 4, (-w) % 4
    mp = np.pad(m, ((0, ph), (0, pw)))
    sm = mp.reshape(mp.shape[0] // 4, 4, mp.shape[1] // 4, 4).any(axis=(1, 3))
    keep = fb.label_keep(sm, min_frac)
    return m & np.kron(keep, np.ones((4, 4), bool))[:h, :w]


def compose(orig, color=None, min_frac=0.004):
    """orig … 原本(道筋か PIL の絵)。color … AI 拡大した色の絵(道筋か PIL の絵・透けは使わない)。None なら原本の大きさのまま"""
    O = (orig if isinstance(orig, Image.Image) else Image.open(orig)).convert('RGBA')
    if color is None:
        C = O.convert('RGB')
    else:
        C = (color if isinstance(color, Image.Image) else Image.open(color)).convert('RGB')
    size = C.size
    s = size[1] / float(O.height)
    A = O.getchannel('A')
    if size != O.size:
        A = A.resize(size, Image.LANCZOS)
    a = np.array(A).astype(np.int32)
    a = np.where(a >= 245, 255, a)
    # ごみ: 線(64 以上)の塊のうち小さく離れた物を消す。薄いもや: 線から原本の2画素より外の 64 未満を消す
    line = a >= 64
    big = keep_big(line, min_frac)
    r = max(1, int(round(2 * s)))
    a = np.where(_dil(big, r), a, 0)
    a = np.where((a < 64) & ~_dil(big, r), 0, a)
    rgb = np.array(C)
    rgb[a == 0] = 0
    return Image.fromarray(np.dstack([rgb, a.astype(np.uint8)]), 'RGBA')

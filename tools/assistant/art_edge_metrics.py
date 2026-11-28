"""助手の絵の「縁」を原本と比べて数える(助手部ナカヨシ・2026-11-28 r1126-095 追記2)。

社長「助手の画質悪い。ソラシド探偵の顔周り」「全体的に際が荒い」「新着替えでまた同じ現象。実装の仕方が悪い」。
#8044 の作り直しで、縁の掃除(透けをぼかす・縁の色を内側の色で塗り直す)が外の黒い線を肌色で塗りつぶし、
頬〜あごに白い縁取り・外の線の消え・髪先のガタガタを作っていた。それまでの検査は「縁に半透明が多いか」だけを見ていて、
原本と比べていなかったので、ぼかすほど通っていた。ここでは原本と出来上がりを同じ物差しで測り、原本より悪ければ落とす。

測る物(どれも「体の外周の帯」= 不透明(アルファ 128 以上)のうち、透明から原本の 2 画素ぶん以内の画素で測る):
  rim_lift  … 白い縁取り: 帯の明るさ(0〜255 の平均)の、原本からの浮き。原本の外の黒い線が肌色・白に塗られると上がる
  line_loss … 外の線の消え: 帯の中の暗い画素(明るさ 80 未満)の割合の、原本からの減り
  jaggy     … 縁のギザギザ: 体の輪郭の長さ(原本の画素に直した値)の、原本に対する比。髪先がちぎれる・段になると伸びる
  blur      … ぼやけ: 縁の半透明(16〜239)の幅(原本の画素に直した値)の、原本に対する比。ぼかすと広がる
              (幅の増えが原本の 0.4 画素以下なら落とさない。原本の縁が2値の絵で、Lanczos のわずかな半透明を落とさないため)
倍率は体の高さ(アルファ 24 より濃い所の縦の長さ)の比で決め、原本はその倍率へ Lanczos で広げた物を基準にする。出来上がりが原本の一部を切った物(立ち絵・顔)は比べない。
"""
import numpy as np
from PIL import Image

# 落とす線(2026-11-28 に、原本・原本を Lanczos で2倍にした物・AI 拡大の中間・#8044 の配信の絵で決めた。
#   原本の Lanczos 2倍・AI 拡大の中間はどれも余裕で通り、#8044 の配信の絵はソラシドの顔周りなどで落ちる)
LIMITS = {'rim_lift': 10.0, 'line_loss': 0.06, 'jaggy': 1.10, 'blur': 1.20}
LABEL = {'rim_lift': '白い縁取り', 'line_loss': '外の線の消え', 'jaggy': 'ギザギザ', 'blur': 'ぼやけ'}


def load(path_or_arr):
    if isinstance(path_or_arr, np.ndarray):
        return path_or_arr
    return np.array(Image.open(path_or_arr).convert('RGBA'))


def _dil(m, r):
    out = m.copy()
    for _ in range(r):
        p = np.pad(out, 1)
        out = (p[1:-1, 1:-1] | p[:-2, 1:-1] | p[2:, 1:-1] | p[1:-1, :-2] | p[1:-1, 2:]
               | p[:-2, :-2] | p[:-2, 2:] | p[2:, :-2] | p[2:, 2:])
    return out


def body_height(a):
    ys = np.nonzero((a[..., 3] > 24).any(axis=1))[0]
    return float(ys.max() - ys.min() + 1) if len(ys) else 0.0


def measure(a, s=1.0):
    """1枚の縁の数(s = 原本の1画素がこの絵の何画素か)"""
    al = a[..., 3].astype(np.int32)
    rgb = a[..., :3].astype(np.float32)
    lum = rgb @ np.array([0.299, 0.587, 0.114], np.float32)
    solid = al >= 128
    r = max(1, int(round(2 * s)))
    band = solid & _dil(~solid, r)
    n = int(band.sum())
    # 輪郭の長さ: 縦横のとなりで solid が変わる所の数
    per = int((solid[1:, :] != solid[:-1, :]).sum() + (solid[:, 1:] != solid[:, :-1]).sum())
    # 縁の半透明: 輪郭から原本の3画素以内だけ数える(体から離れた光・もやは縁の幅に入れない)
    rz = max(1, int(round(3 * s)))
    zone = _dil(solid, rz) & _dil(~solid, rz)
    semi = int(((al > 16) & (al < 240) & zone).sum())
    return {
        'lum': float(lum[band].mean()) if n else 0.0,
        'dark': float((lum[band] < 80).mean()) if n else 0.0,
        'per': per / s,
        'width': (semi / max(per, 1)) / s,
    }


def compare(src, out, s=None):
    """原本と出来上がりを比べる。返すのは ({rim_lift, line_loss, jaggy, blur}, 倍率)"""
    A, B = load(src), load(out)
    if s is None:
        s = body_height(B) / max(body_height(A), 1.0)
    # 基準は「原本を同じ倍率へ Lanczos で広げた物」(art_edge.compose の透けと同じ作り方)。原本の大きさのままと比べると、
    #   2値に近い縁を広げたときの補間そのものを「ぼやけ」と数えてしまう(きゅうこの冬服で ×1.48 になった)
    if abs(s - 1.0) > 0.05:
        im = Image.fromarray(A)
        A = np.array(im.resize((max(1, round(im.width * s)), max(1, round(im.height * s))), Image.LANCZOS))
        m0 = measure(A, s)
    else:
        m0 = measure(A, 1.0)
    m1 = measure(B, s)
    return {
        'rim_lift': m1['lum'] - m0['lum'],
        'line_loss': m0['dark'] - m1['dark'],
        'jaggy': m1['per'] / max(m0['per'], 1e-6),
        'blur': m1['width'] / max(m0['width'], 1e-6),
        'blur_px': m1['width'] - m0['width'],
    }, s


# ぼやけは比と幅の両方で見る(原本の縁が2値=幅ほぼ0の絵は、比だけだと 1 画素の半透明でも何倍にもなる)
BLUR_PX = 0.4  # 縁の半透明の幅の増え(原本の画素)


def failures(d):
    return [k for k, lim in LIMITS.items() if d[k] > lim and (k != 'blur' or d.get('blur_px', 9) > BLUR_PX)]


def fmt(d):
    return ' '.join('%s %+.1f' % (LABEL[k], d[k]) if k == 'rim_lift' else
                    ('%s %+.3f' % (LABEL[k], d[k]) if k == 'line_loss' else '%s ×%.2f' % (LABEL[k], d[k])) for k in LIMITS)

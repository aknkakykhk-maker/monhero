# 着替えの顔アイコンを、ふだんの顔アイコン(同じ表情)に合わせるための測り(2026-11-25 r1125-040)。
#   ふだんの顔の真ん中(目・鼻・口のあたり)を型にして、着替えの顔アイコンの中を大きさを変えながら探し、
#   「着替えの顔はふだんの何倍で、どこにあるか」を出す。そこから life-stand-cut.json の face.expr.<表情> の数字(zoom・dx・dy)を出す。
# 使い方: python3 -I tools/assistant/life-face-measure.py <助手id>:<服> [--apply]
#   --apply … 出た数字を life-stand-cut.json に書く(今の上書きに重ねる)。そのあと life-stand-from-fullbody.py --only <キー> --face-only で作り直す
#   ずれの目安: 倍率 k が 0.95〜1.05、位置のずれが一辺の 0.02 以内なら「そろっている」。似ている度が 0.6 未満は当てにならないので書かない(目で合わせる)
import sys, os, json
import numpy as np
from PIL import Image
from numpy.lib.stride_tricks import sliding_window_view
ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..'))
A = os.path.join(ROOT, 'monster-hero/images/assistant')
CUT = os.path.join(ROOT, 'tools/assistant/life-stand-cut.json')
EX = ['normal', 'happy', 'wink', 'surprise', 'troubled', 'angry', 'crying', 'excited', 'sleep']
PREFIX = {'mua': 'myua'}
N = 112                       # 測る細かさ(一辺の画素)
REG = tuple(float(v) for v in os.environ.get('FACE_REG', '0.28,0.44,0.72,0.66').split(','))  # ふだんの顔アイコンで型にする所(左・上・右・下。目のあたり)

def gray(path, n):
    im = Image.open(path).convert('RGBA').resize((n, n), Image.LANCZOS)
    bg = Image.new('RGBA', (n, n), (255, 255, 255, 255)); bg.alpha_composite(im)
    # 色で合わせる(同じ子の目の色・肌の色は服が替わっても同じ)。3色を横に並べた1枚にして比べる
    a = np.asarray(bg.convert('RGB'), dtype=np.float32)
    return a

def ncc_best(img, tpl):
    if img.ndim == 3:
        rs = [ncc_map(img[..., c], tpl[..., c]) for c in range(3)]
        if rs[0] is None:
            return -1, 0, 0
        r = sum(rs) / 3.0
        i = np.unravel_index(np.argmax(r), r.shape)
        return float(r[i]), int(i[1]), int(i[0])

def ncc_map(img, tpl):
    th, tw = tpl.shape
    if th > img.shape[0] or tw > img.shape[1]:
        return None
    w = sliding_window_view(img, (th, tw))
    t = tpl - tpl.mean(); tn = np.sqrt((t * t).sum()) + 1e-6
    wc = w - w.mean(axis=(2, 3), keepdims=True)
    return (wc * t).sum(axis=(2, 3)) / (np.sqrt((wc * wc).sum(axis=(2, 3))) * tn + 1e-6)

def _unused(img, tpl):
    th, tw = tpl.shape
    if th > img.shape[0] or tw > img.shape[1]:
        return -1, 0, 0
    w = sliding_window_view(img, (th, tw))
    t = tpl - tpl.mean(); tn = np.sqrt((t * t).sum()) + 1e-6
    wm = w.mean(axis=(2, 3), keepdims=True)
    wc = w - wm
    num = (wc * t).sum(axis=(2, 3))
    den = np.sqrt((wc * wc).sum(axis=(2, 3))) * tn + 1e-6
    r = num / den
    i = np.unravel_index(np.argmax(r), r.shape)
    return float(r[i]), int(i[1]), int(i[0])

def measure(ref_path, img_path):
    img = gray(img_path, N)
    best = (-2, 1.0, 0, 0)
    for k in np.arange(0.62, 1.62, 0.02):
        M = int(round(N * k))          # ふだんの顔アイコンを k 倍にしたときの一辺
        ref = gray(ref_path, M)
        x0, y0, x1, y1 = [int(round(v * M)) for v in REG]
        tpl = ref[y0:y1, x0:x1]
        r, x, y = ncc_best(img, tpl)
        if r > best[0]:
            # 型の真ん中が、着替えの顔アイコンのどこに来たか(一辺の割合)
            cx = (x + (x1 - x0) / 2.0) / N; cy = (y + (y1 - y0) / 2.0) / N
            best = (r, float(k), cx, cy)
    return best

def main():
    key = sys.argv[1]; who, outfit = key.split(':')
    pre = PREFIX.get(who, who)
    tx, ty = (REG[0] + REG[2]) / 2, (REG[1] + REG[3]) / 2   # ふだんの顔アイコンでの型の真ん中
    cut = json.load(open(CUT, encoding='utf-8'))
    face = cut.setdefault(key, {}).setdefault('face', {})
    ex = face.setdefault('expr', {})
    print('%s: 表情 / 似ている度 / 倍率k(1より大きい=着替えのほうが大きい) / 真ん中のずれ(x,y) → 新しい zoom dx dy' % key)
    worst = 0
    for e in EX:
        rp = os.path.join(A, 'face', '%s_%s.PNG' % (pre, e))
        ip = os.path.join(A, outfit, 'face', '%s_%s.PNG' % (pre, e))
        if not (os.path.exists(rp) and os.path.exists(ip)):
            print('  %-9s (絵がない)' % e); continue
        r, k, cx, cy = measure(rp, ip)
        # 今の箱の中で、型は (cx,cy) に k 倍で入っている → (tx,ty) に 1 倍で入るよう、今の箱を zoom k・d だけずらす
        dxl = cx - 0.5 - k * (tx * 1 - 0.5) * 1  # 型の真ん中は ref の k 倍の座標で tx*k ではなく、着替えの箱の中の位置で比べる
        # 着替えの箱で型の真ん中が (cx,cy)、ふだんでは (tx,ty)。新しい箱 = 中心を d ずらし一辺 k 倍 → 新しい位置 0.5 + (c - 0.5 - d)/k = t
        dx = cx - 0.5 - k * (tx - 0.5); dy = cy - 0.5 - k * (ty - 0.5)
        o = ex.get(e, {})
        z0 = o.get('zoom', 1.0)
        n = {'zoom': round(z0 * k, 3), 'dx': round(o.get('dx', 0) + z0 * dx, 3), 'dy': round(o.get('dy', 0) + z0 * dy, 3)}
        off = max(abs(k - 1), abs(cx - tx * 1) if False else abs(dx), abs(dy))
        worst = max(worst, abs(k - 1) / 0.05, max(abs(dx), abs(dy)) / 0.02)
        mark = 'そろっている' if abs(k - 1) <= 0.05 and max(abs(dx), abs(dy)) <= 0.02 else 'ずれ'
        if r < 0.6:
            # 手で顔を隠す・大きく動くポーズの表情は、型が合わず数字が当てにならない。書かずに目で合わせる(並べ絵 life-face-vs-normal.py)
            mark = '当てにならない(似ている度が低い・目で合わせる)'
        print('  %-9s %.2f  k=%.2f  ずれ(%+.3f,%+.3f)  %s → %s' % (e, r, k, dx, dy, mark, n))
        if '--apply' in sys.argv and mark == 'ずれ':
            ex[e] = n
    if '--apply' in sys.argv:
        s = json.dumps(cut, ensure_ascii=False, indent=None)
        # 1行1キーで書く(人が直しやすいように)
        lines = ['{'] + ['  %s: %s,' % (json.dumps(k2, ensure_ascii=False), json.dumps(v, ensure_ascii=False)) for k2, v in cut.items()]
        lines[-1] = lines[-1].rstrip(',')
        open(CUT, 'w', encoding='utf-8').write('\n'.join(lines + ['}']) + '\n')
        print('  → life-stand-cut.json に書いた。作り直し: python3 tools/assistant/life-stand-from-fullbody.py --only %s --face-only' % key)

if __name__ == '__main__':
    main()

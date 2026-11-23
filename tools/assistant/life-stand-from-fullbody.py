#!/usr/bin/env python3
"""全身画(images/assistant/fullbody/<名前>__<表情>.png)から、場面用の立ち絵(胸から上)と顔アイコンを作る(助手部ナカヨシ)。

■ 全身画を替えたあとの作り直し(3行)
  1. python3 tools/assistant/life-stand-from-fullbody.py --only <キー> --write  … 点の測り直し(自動)・立ち絵・顔アイコン・顔の表(56-assistant-life-house.jsx)まで書く
  2. 出た「確かめ絵」で目・顎の線が合っているかを見る(ずれていれば life-stand-marks.json の eye・chin を直してもう一度 1)
  3. node tools/assistant/life-stand-edge-check.js で端の切れが無いのを確かめ、node tools/build.js のあと場面を撮って見る

しくみ
  ・点(頭のてっぺん top・目の線 eye・顎の先 chin)は life-stand-marks.json に全身画 normal の画素で持つ。全身画が替わって目印(大きさ・体の上端と下端)が
    変わると、git の履歴から前の全身画を探して重ね合わせ(倍率と位置)、前の点を新しい絵へ移して書きかえる(手で測り直さなくてよい)
  ・切る枠は透過の外形から決める(2026-11-23 r1119-122 社長「頭とか腕とかが切れないように」): 8表情を体(胸のあたり)で重ね合わせて位置をそろえ、
    8表情ぶんの不透明な画素(髪・耳・飾り・上げた腕・羽)が、枠の上・左・右の端に触れない所まで広げる。下は顎の位置が chin_frac になる所で切る。
    8枚とも同じ大きさ・同じ顔の位置になる(広がった分は透明の余白で吸い、場面は見えている体の範囲で置くので余白で絵は動かない)
  ・色を減らさない・縮めない・引き伸ばさない(2026-11-15 r1115-143)。顔アイコンも全身画の画素のまま切る
  ・顔の表(ASSISTANT_LIFE_STAND_FACE_OUTFIT)の1行を出す(--write で書きこむ)。表情ごとに見えている体の範囲が違って場面で顔がずれるときは「顔のずれ」を出す
使い方: python3 tools/assistant/life-stand-from-fullbody.py [--only キー] [--write] [--marks]   (--marks … 確かめ絵を docs/progress/assistant-art/stand-marks/ へ)
足すときは下の HEADS に1つ足し、life-stand-marks.json に点を足す(初めの1回だけ手で測る。--marks の絵で確かめる)。
"""
import os, sys, json, re, io, subprocess, hashlib
import numpy as np
from PIL import Image, ImageDraw

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
FB = os.path.join(ROOT, 'monster-hero/images/assistant/fullbody')
MARKS = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'life-stand-marks.json')
HOUSE = os.path.join(ROOT, 'monster-hero/src/parts/56-assistant-life-house.jsx')
# 切り出したときの全身画と立ち絵の指紋(2026-11-23 r1119-153: えるびんの全身画を差し替えたのに立ち絵が古いままだった)。
#   life-stand-stale-check.js が今の絵と比べ、全身画だけ替わっている(切り出し直し忘れ)を見つける。この道具を回すたびに書く
MADE = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'life-stand-made.json')
EXPR = ['normal', 'happy', 'wink', 'surprise', 'troubled', 'angry', 'crying', 'excited']
# key … 助手id(服があれば id:服)。name … 全身画の名前。stand … 立ち絵の置き場。prefix … 画像の接頭辞。chin_frac … 切った絵の高さのうち顎の位置
# above … 顔の表の above(大きい飾りが場面の枠で切れないように)。face … 顔アイコンも作る(side=辺が目から顎の何倍か・down=顔を丸の真ん中よりどれだけ下へ)
HEADS = {
    # きき(ふだん・ハロウィン)は 2026-11-23 #7427 で表情ごとにポーズの違う全身画になった。えるびんと同じくそろえる
    'kiki': dict(name='kiki', stand='stand-normal', prefix='kiki', chin_frac=0.43, above=None, match_scale=True, scene_same_frame=True),
    'kiki:halloween': dict(name='kiki_halloween', stand='stand-halloween', prefix='kiki', chin_frac=0.43, above=0.95, match_scale=True, scene_same_frame=True),
    'momosuke': dict(name='momosuke', stand='stand-normal', prefix='momosuke', chin_frac=0.43, above=0.7),
    'momosuke:halloween': dict(name='momosuke_halloween', stand='stand-halloween', prefix='momosuke', chin_frac=0.43, above=0.95),
    # えるびん(2026-11-23 r1119-153 ポーズ違いの全身画から作り直し)。表情ごとに全身画の大きさが違うので match_scale でそろえ、
    #   上げた腕・こぶしで見えている範囲が変わるので、場面はどの表情も normal の範囲で置く(scene_same_frame・56-assistant-life-house.jsx の ASSISTANT_LIFE_STAND_SAME_FRAME)
    'erubin': dict(name='erubin', stand='stand-normal', prefix='erubin', chin_frac=0.43, above=None, match_scale=True, scene_same_frame=True),
    'erubin:sekiyuou': dict(name='erubin_sekiyuou', stand='stand-sekiyuou', prefix='erubin', chin_frac=0.43, above=None, match_scale=True, scene_same_frame=True),
    'atsu': dict(name='atsu', stand='stand-normal', prefix='atsu', chin_frac=0.43, above=None),
    'kyuko': dict(name='kyuko', stand='stand-normal', prefix='kyuko', chin_frac=0.43, above=None),
    'kyuko:winter': dict(name='kyuko_winter', stand='stand-winter', prefix='kyuko', chin_frac=0.43, above=None),
    'kiki:twintail': dict(name='kiki_twintail', stand='stand-twintail', prefix='kiki', chin_frac=0.43, above=0.95),
    # hold … まだこの道具で作っていない(--only で名指ししたときだけ作る)。表情ごとに姿勢が違い(上げた腕)、場面は表情ごとの見えている体の範囲で置くので、
    #   作り直すと顔がずれる表情がある(2026-11-23 窓口に相談中: 場面が同じ組の normal の範囲で置くようにするか)
    'sorashido:hosei': dict(name='sorashido_hosei', stand='stand-hosei', prefix='sorashido', chin_frac=0.43, above=None, hold=True),
    # カードマスター(2026-11-23 r1119-137 全身画を作り直した)。normal だけ手を頭の上へ上げているので、場面はどの表情も normal の見えている範囲で置く
    #   (56-assistant-life-house.jsx の ASSISTANT_LIFE_STAND_SAME_FRAME)。same_frame … 顔のずれを normal の範囲で測る
    'mua:card-master': dict(name='mua_card-master', stand='stand-card-master', prefix='myua', chin_frac=0.43, above=0.75, same_frame=True),
    # 馬骨。補正(いままでの絵)は stand-hosei。顔アイコンは sorashido-umahone-busts.py で作った物のまま(2026-11-23 表情の全身画は元の版に戻ったので作り直さない)。
    #   表情の全身画を作り直したら face=dict(side=3.4, down=0.04) を足して顔アイコンも作る
    'sorashido': dict(name='sorashido', stand='stand-normal', prefix='sorashido', chin_frac=0.43, above=None),
}
ALPHA = 40  # これより濃い画素を「体」とみなす(端の検査 life-stand-edge-check.js と同じ考え)


def load(path):
    return np.asarray(Image.open(path).convert('RGBA'))


def bbox(a, lim=ALPHA):
    ys, xs = np.nonzero(a[..., 3] > lim)
    return int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1


def fingerprint(a):
    b = bbox(a)
    return [a.shape[1], a.shape[0], b[1], b[3]]


def feat(a):
    """重ね合わせに使う2つの面: 不透明さと、明るさ(目・髪の線が効く)。"""
    al = a[..., 3].astype(np.float32) / 255.0
    return np.stack([al, a[..., :3].astype(np.float32).mean(axis=2) / 255.0 * al * 2], -1)


def sample(F, s, tx, ty, ys, xs):
    """F(元の絵)を s 倍して (tx,ty) ずらした絵の、(ys, xs) の画素(外は0)。"""
    yy = np.floor((ys - ty) / s).astype(int)
    xx = np.floor((xs - tx) / s).astype(int)
    vy = (yy >= 0) & (yy < F.shape[0])
    vx = (xx >= 0) & (xx < F.shape[1])
    M = np.zeros((len(ys), len(xs), F.shape[2]), np.float32)
    M[np.ix_(vy, vx)] = F[np.ix_(yy[vy], xx[vx])]
    return M


def register(src, dst, rows, cols, scales, shifts, s0=1.0, t0=(0.0, 0.0), q=2):
    """src を s 倍・(tx,ty) ずらして dst の rows×cols に重ねたとき、いちばん合う (誤差, s, tx, ty)。"""
    S, D = feat(src), feat(dst)
    ys, xs = np.arange(rows[0], rows[1], q), np.arange(cols[0], cols[1], q)
    N = D[np.ix_(ys, xs)]
    best = None
    for s in scales:
        for dy in shifts:
            for dx in shifts:
                b0 = t0(s) if callable(t0) else t0
                tx, ty = b0[0] + dx, b0[1] + dy
                e = float(np.abs(sample(S, s, tx, ty, ys, xs) - N).mean())
                if best is None or e < best[0]:
                    best = (e, float(s), float(tx), float(ty))
    return best


def git_old_normal(rel, fp):
    """git の履歴から、目印 fp の全身画 normal を探す(測ったときの絵)。"""
    try:
        revs = subprocess.run(['git', 'log', '--format=%H', '--', rel], cwd=ROOT, capture_output=True, text=True, check=True).stdout.split()
    except Exception:
        return None
    for r in revs + [r + '^' for r in revs]:
        p = subprocess.run(['git', 'show', '%s:%s' % (r, rel)], cwd=ROOT, capture_output=True)
        if p.returncode:
            continue
        a = np.asarray(Image.open(io.BytesIO(p.stdout)).convert('RGBA'))
        if fingerprint(a) == fp:
            return a
    return None


def remeasure(key, mk, cur):
    """全身画が替わっていれば、前の全身画と重ね合わせて点を移す。替わっていなければそのまま。"""
    fp = fingerprint(cur)
    if mk['fp'] == fp:
        return mk, None
    rel = os.path.relpath(os.path.join(FB, '%s__normal.png' % HEADS[key]['name']), ROOT)
    old = git_old_normal(rel, mk['fp'])
    if old is None:
        sys.exit('%s: 全身画が替わったが、測ったときの絵(目印 %s)が git の履歴に無い。--marks の確かめ絵を見て life-stand-marks.json の top・eye・chin・fp を手で直す' % (key, mk['fp']))
    bo, bn = bbox(old), bbox(cur)
    s0 = (bn[3] - bn[1]) / float(bo[3] - bo[1])
    t0 = ((bn[0] + bn[2]) / 2 - (bo[0] + bo[2]) / 2 * s0, bn[1] - bo[1] * s0)
    f = (mk['chin'] - mk['top']) * s0  # 頭の大きさ(画素)のめやす
    rows = (bn[1], min(cur.shape[0], int(bn[1] + 3.2 * f)))
    cols = (0, cur.shape[1])
    step = max(1, int(round(f / 40)))
    e, s, tx, ty = register(old, cur, rows, cols, np.linspace(s0 * 0.9, s0 * 1.1, 21), range(-12 * step, 12 * step + 1, 2 * step), s0, t0, q=max(2, step))
    e, s, tx, ty = register(old, cur, rows, cols, np.linspace(s * 0.985, s * 1.015, 7), range(-2 * step, 2 * step + 1, max(1, step // 2)), 1.0, (tx, ty), q=max(1, step // 2))
    new = dict(fp=fp, top=round(mk['top'] * s + ty, 1), eye=round(mk['eye'] * s + ty, 1), chin=round(mk['chin'] * s + ty, 1))
    return new, 'ずれの誤差 %.3f・倍率 %.3f' % (e, s)


def align(base, a, mk, cx, from_bottom=False):
    """表情の絵を normal に重ねる位置。頭(髪と顔の輪郭・頭のてっぺんから顎の少し下まで)で合わせ、目の真ん中がそろうようにする。
    表情ごとに描き分けた全身画は大きさ(倍率)が違うことがあるが、引き伸ばさない(r1115-143)。倍率は「注意」に出すだけ。
    返す ((dx, dy), 倍率): a(x+dx, y+dy) が base(x, y) に重なる。"""
    top, eye, chin = mk['top'], mk['eye'], mk['chin']
    hh = chin - top
    rows = (int(max(0, top - 0.1 * hh)), int(min(base.shape[0], chin + 0.15 * hh)))
    cols = (int(max(0, cx - 0.75 * hh)), int(min(base.shape[1], cx + 0.75 * hh)))
    ba, bb = bbox(base), bbox(a)
    s0 = (bb[3] - bb[1]) / float(ba[3] - ba[1])  # 体の高さの比(めやす)
    # 初めの見当: 体の上端と、頭の真ん中(髪の重心)をそろえる
    acx = head_cx(a, bb[1], int(hh * s0))
    t0 = lambda s: (cx - s * acx, ba[1] - s * bb[1])
    scales = np.linspace(0.8, 1.25, 19)
    if from_bottom:
        # normal だけ手を頭の上へ上げている組(カードマスター・2026-11-23 r1119-137)。上げた腕が頭の前を横切り、頭で合わせると外れる。
        #   全身画どうしは同じ大きさ・同じ頭の高さに作ってある(life-card-master-recut.py)ので、縦と倍率はそのまま、横だけ頭(顔のまわり)で合わせる
        S, D = feat(a), feat(base)
        ys = np.arange(int(eye - 0.6 * hh), int(chin + 0.1 * hh), 2)
        xs = np.arange(int(cx - 0.45 * hh), int(cx + 0.45 * hh), 2)
        N = D[np.ix_(ys, xs)]
        best = None
        for dx in range(-int(1.2 * hh) + int(round(acx - cx)), int(1.2 * hh) + int(round(acx - cx)) + 1, 2):
            e = float(np.abs(sample(S, 1.0, -dx, 0.0, ys, xs) - N).mean())
            if best is None or e < best[0]:
                best = (e, dx)
        return (best[1], 0), 1.0
    q = max(2, int(round(hh / 60)))
    r = int(0.35 * hh)
    e, s, tx, ty = register(a, base, rows, cols, scales, range(-r, r + 1, q * 2), 1.0, t0, q=q)
    e, s, tx, ty = register(a, base, rows, cols, np.linspace(s * 0.98, s * 1.02, 5), range(-q * 2, q * 2 + 1, max(1, q // 2)), 1.0, (tx, ty), q=max(1, q // 2))
    # base(x) ≈ a((x - t) / s)。normal の目の真ん中 (cx, eye) が a のどこに来るか
    ax, ay = (cx - tx) / s, (eye - ty) / s
    return (int(round(ax - cx)), int(round(ay - eye))), 1.0 / s


def shrink(a, r):
    """絵を r 倍に縮める(r>=1 ならそのまま)。透明の縁が黒ずまないよう、色に不透明さを掛けてから縮める。"""
    if r >= 0.999:
        return a
    im = Image.fromarray(a).convert('RGBa')
    im = im.resize((max(1, int(round(im.width * r))), max(1, int(round(im.height * r)))), Image.LANCZOS)
    return np.asarray(im.convert('RGBA'))


def head_cx(a, top, rows):
    """頭の横の真ん中。上げた腕・こぶし(肌色)に引かれないよう、髪(暗い色)の重心を使う。"""
    sub = (a[top:top + rows, :, 3] > ALPHA) & (a[top:top + rows, :, :3].astype(int).sum(axis=2) < 3 * 90)
    if sub.sum() < 50:
        sub = a[top:top + rows, :, 3] > ALPHA
    return float(np.nonzero(sub)[1].mean())


def place(a, frame, d):
    """表情の絵 a を、normal の座標の枠 frame(x0, y0, x1, y1)に置いた絵。枠が全身画の外にはみ出た所は透明。"""
    x0, y0, x1, y1 = frame
    out = Image.new('RGBA', (x1 - x0, y1 - y0), (0, 0, 0, 0))
    im = Image.fromarray(a)
    out.paste(im, (-x0 - d[0], -y0 - d[1]))
    return out


def files_hash(paths):
    h = hashlib.sha1()
    for p in paths:
        with open(p, 'rb') as fp:
            h.update(fp.read())
    return h.hexdigest()[:12]


def write_made(key, cfg):
    made = json.load(open(MADE, encoding='utf-8')) if os.path.exists(MADE) else {}
    made[key] = dict(fullbody=files_hash([os.path.join(FB, '%s__%s.png' % (cfg['name'], e)) for e in EXPR]),
                     stand=files_hash([os.path.join(ROOT, 'monster-hero/images/assistant', cfg['stand'], '%s_%s.png' % (cfg['prefix'], e)) for e in EXPR]))
    with open(MADE, 'w', encoding='utf-8') as fp:
        fp.write('{\n' + ',\n'.join('  %s: %s' % (json.dumps(k), json.dumps(v)) for k, v in sorted(made.items())) + '\n}\n')


def save_png(im, path):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    im.save(path, optimize=True)  # 色を減らさない(2026-11-15 r1115-143)
    return os.path.getsize(path) // 1024


def write_face_row(stand, pid, row):
    src = open(HOUSE, encoding='utf-8').read()
    lines = src.split('\n')
    head = "  '%s': {" % stand
    for i, ln in enumerate(lines):
        if ln.startswith(head):
            body = '{ ' + ', '.join('%s: %s' % (k, v) for k, v in row.items()) + ' }'
            pat = re.compile(r'(?<![\w-])%s: \{[^{}]*\}' % re.escape(pid))
            if pat.search(ln):
                lines[i] = pat.sub('%s: %s' % (pid, body), ln, count=1)
            else:
                lines[i] = re.sub(r' \},\s*$', ', %s: %s },' % (pid, body), ln, count=1)
            open(HOUSE, 'w', encoding='utf-8').write('\n'.join(lines))
            return True
    return False


def marks_image(key, a, mk, frame):
    """確かめ絵: normal の頭と、top・eye・chin の線・切る枠。"""
    f = mk['chin'] - mk['eye']
    x0, y0, x1, y1 = frame
    im = Image.new('RGBA', (x1 - x0, y1 - y0), (90, 100, 120, 255))
    im.alpha_composite(place(a, frame, (0, 0)))
    d = ImageDraw.Draw(im)
    for nm, col in (('top', (255, 220, 0)), ('eye', (0, 255, 120)), ('chin', (255, 80, 80))):
        y = mk[nm] - y0
        d.line([(0, y), (im.width, y)], fill=col + (255,), width=max(1, int(f / 40)))
    p = os.path.join(ROOT, 'docs/progress/assistant-art/stand-marks', '%s.png' % key.replace(':', '_'))
    os.makedirs(os.path.dirname(p), exist_ok=True)
    s = min(1.0, 600.0 / im.height)
    im.convert('RGB').resize((int(im.width * s), int(im.height * s)), Image.LANCZOS).save(p)
    return os.path.relpath(p, ROOT)


def run(key, cfg, marks, opts):
    ims = [load(os.path.join(FB, '%s__%s.png' % (cfg['name'], e))) for e in EXPR]
    base = ims[0]
    mk, note = remeasure(key, marks[key], base)
    if note:
        marks[key] = mk
        print('%s: 全身画が替わったので点を測り直した(%s): top=%s eye=%s chin=%s' % (key, note, mk['top'], mk['eye'], mk['chin']))
    nb = bbox(base)
    f = mk['chin'] - mk['eye']
    cx = head_cx(base, nb[1], int(max(8, (mk['chin'] - nb[1]) * 0.8)))
    # 下の切れ目: 顎の位置が chin_frac になる高さ(normal の体のてっぺんから測る)
    bottom = int(round(nb[1] + (mk['chin'] - nb[1]) / cfg['chin_frac']))
    al = al0 = [((0, 0), 1.0)] + [align(base, a, mk, cx, from_bottom=cfg.get('same_frame', False)) for a in ims[1:]]
    if cfg.get('match_scale'):
        # 表情ごとに全身画の大きさが違う組(えるびん・2026-11-23 r1119-153 社長「表情ごとに顔の位置と大きさがそろう」)。
        #   いちばん小さい表情の大きさへ、ほかを縮めてそろえる(引き伸ばさない・r1115-143)。縮めたら重ね合わせを測り直す
        T = min([1.0] + [k for _, k in al])
        ims = [shrink(a, T / k) for a, (_, k) in zip(ims, al)]
        base = ims[0]
        mk = dict(mk, top=mk['top'] * T, eye=mk['eye'] * T, chin=mk['chin'] * T)
        nb = bbox(base)
        f = mk['chin'] - mk['eye']
        cx = head_cx(base, nb[1], int(max(8, (mk['chin'] - nb[1]) * 0.8)))
        bottom = int(round(nb[1] + (mk['chin'] - nb[1]) / cfg['chin_frac']))
        al = [((0, 0), 1.0)] + [align(base, a, mk, cx) for a in ims[1:]]
        print('   大きさをそろえた: normal×%.3f %s' % (T, ' '.join('%s×%.3f' % (e[:2], T / k) for e, (_, k) in zip(EXPR[1:], al0[1:]))))
    ds = [d for d, _ in al]
    big = [(e, k) for e, (_, k) in zip(EXPR, al) if abs(k - 1) > 0.04]
    # 枠: 8表情ぶんの不透明な画素(切れ目より上)が上・左・右の端に触れない所まで。余白 g
    g = max(4, int(round(f * 0.08)))
    X0 = Y0 = 10 ** 9
    X1 = -1
    for a, (dx, dy) in zip(ims, ds):
        al = a[..., 3] > ALPHA
        ys, xs = np.nonzero(al)
        ys = ys - dy
        xs = xs - dx
        keep = ys < bottom
        X0, Y0, X1 = min(X0, int(xs[keep].min())), min(Y0, int(ys[keep].min())), max(X1, int(xs[keep].max()) + 1)
    frame = (X0 - g, Y0 - g, X1 + g, bottom)
    tot = 0
    outs = []
    for e, a, d in zip(EXPR, ims, ds):
        c = place(a, frame, d)
        outs.append(c)
        tot += save_png(c, os.path.join(ROOT, 'monster-hero/images/assistant', cfg['stand'], '%s_%s.png' % (cfg['prefix'], e)))
    # 顔の表(見えている体の上を0・下を1)。normal の絵で測る
    vb = [bbox(np.asarray(c)) for c in outs]
    by0, by1 = vb[0][1], vb[0][3]
    vh = by1 - by0
    fy = lambda y: round(float((y - frame[1] - by0) / vh), 4)
    row = dict(top=fy(mk['top']), eye=fy(mk['eye']), chin=fy(mk['chin']), m=round(float(f / vh / (0.82 * 0.1639)), 3))
    if cfg.get('above'):
        row['above'] = cfg['above']
    # 顔のずれ: 場面は見えている体の範囲で置くので、表情ごとに範囲が違うと顔が動く。顔の長さ(目から顎)の何割かで出す
    worst = (0.0, '')
    for e, (l, t, r, b) in zip(EXPR, [vb[0]] * len(vb) if (cfg.get('same_frame') or cfg.get('scene_same_frame')) else vb):
        ey = ((mk['eye'] - frame[1]) - t) / float(b - t) - row['eye']
        exn = ((l + r) / 2.0 - (vb[0][0] + vb[0][2]) / 2.0) / float(b - t) * vh
        dv = max(abs(ey * vh), abs(exn)) / f
        if dv > worst[0]:
            worst = (dv, e)
    print('%s: 立ち絵 %d×%d 計%dKB / 見えている体の高さ %d / 表情の重ね位置 %s' % (key, frame[2] - frame[0], frame[3] - frame[1], tot, vh, ' '.join('%s%+d%+d' % (e[:2], d[0], d[1]) for e, d in zip(EXPR, ds) if d != (0, 0)) or 'ずれ無し'))
    if big:
        print('   注意: 全身画の大きさが normal と違う表情(場面で顔の大きさが変わる。絵は引き伸ばさない): %s' % ' '.join('%s×%.2f' % b for b in big))
    if worst[0] > 0.1:
        print('   注意: %s は場面で顔が 顔の長さの%d%% ずれる(見えている体の範囲が normal と違う)' % (worst[1], round(worst[0] * 100)))
    print('   顔の表(%s): %s: %s' % (cfg['stand'], key.split(':')[0], row))
    write_made(key, cfg)
    if opts['write']:
        ok = write_face_row(cfg['stand'], key.split(':')[0], row)
        print('   → 56-assistant-life-house.jsx に%s' % ('書いた' if ok else '書けなかった(手で足す)'))
    if opts['marks']:
        print('   確かめ絵: %s' % marks_image(key, base, mk, frame))
    if cfg.get('face'):
        fc = cfg['face']
        side = int(round(f * fc['side']))
        cy = mk['eye'] + 0.35 * f  # 目と鼻のあいだ
        fx0, fy0 = int(round(cx - side / 2.0)), int(round(cy - side * (0.5 + fc['down'])))
        ft = 0
        for e, a, d in zip(EXPR, ims, ds):
            ft += save_png(place(a, (fx0, fy0, fx0 + side, fy0 + side), d), os.path.join(ROOT, 'monster-hero/images/assistant/face', '%s_%s.PNG' % (cfg['prefix'], e)))
        print('   顔アイコン: 一辺 %d 計%dKB' % (side, ft))


if __name__ == '__main__':
    only = sys.argv[sys.argv.index('--only') + 1] if '--only' in sys.argv else None
    opts = dict(write='--write' in sys.argv, marks='--marks' in sys.argv)
    marks = json.load(open(MARKS, encoding='utf-8'))
    before = json.dumps(marks, sort_keys=True)
    for k, c in HEADS.items():
        if (only and k != only) or (not only and c.get('hold')):
            continue
        run(k, c, marks, opts)
    if json.dumps(marks, sort_keys=True) != before:
        with open(MARKS, 'w', encoding='utf-8') as fp:
            fp.write('{\n' + ',\n'.join('  %s: %s' % (json.dumps(k, ensure_ascii=False), json.dumps(v, ensure_ascii=False)) for k, v in marks.items()) + '\n}\n')
        print('life-stand-marks.json を書きかえた')

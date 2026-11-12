#!/usr/bin/env python3
"""社長の全身画(tools/art-sources/assistant-fullbody/received-v1/)を、配信用の立ち絵に仕上げる(助手部ナカヨシ)。

  ・背景のぼかし(薄い半透明の光・灰色のもや)と、ふちの小さな点(ごみ)を取る
  ・ふちの画素の色を、体の内側の色で塗り直す(白・黒の色のにじみを消す)
  ・ふちのアルファは2値に切らない(半透明を残す。元の絵のふちが2値なら高い解像度のうちに少しぼかす)
  ・体の見える範囲で切り詰め(まわりに少しだけ余白)、512x768 の枠へ lanczos で縮めて、libimagequant で 256 色に減らす
  ・みゅあの8表情のシート(life-expression-sheets.py の SHEETS)の全身画も、ここで同じ作り方で作る(全36枚)
  ・書き出し先: monster-hero/images/assistant/fullbody/<キー>.png
  ・ふちが2値に戻っていないかは tools/assistant/life-fullbody-edge-check.js が見張る

使い方: pip install imagequant && python3 tools/assistant/life-fullbody-art.py [--only <名前>] [--sheet 確認用の画像]
絵を足すときは下の ART に1行足して回す(キーは data の ASSISTANT_FULLBODY_ART と同じ)。
"""
import os, sys
import numpy as np
from PIL import Image

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
SRC = os.path.join(ROOT, 'tools/art-sources/assistant-fullbody/received-v1')
OUT = os.path.join(ROOT, 'monster-hero/images/assistant/fullbody')
# キー → 受け取った絵。キーは「助手id」か「助手id:服の名前」。
#   表情の絵(8表情: angry・crying・excited・happy・normal・surprise・troubled・wink)が届いたら、キーの後ろに @表情 を付けて足す
#   (例 'atsu@happy': '…')。書き出し先は atsu__happy.png。表情の絵が無い表情は、表情なしの絵(atsu.png)を出す
ART = {
    'atsu': 'atsu_transparent_fixed.png',
    'kiki': 'kiki_transparent_fixed.png',
    'kiki:halloween': 'kiki_halloween_transparent_fixed.png',
    'kyuko': 'kyuuko_transparent_fixed.png',
    'momosuke': 'msg1-pink-bunny.png',
    'momosuke:halloween': 'msg5-pink-bunny-devil-halloween.png',
    'mua': 'msg2-blonde-angel.png',
    'mua:halloween': 'msg3-blonde-halloween-witch.png',
    'mua:card-master': 'msg4-blonde-blue-cape.png',
    'sorashido': 'msg6-kimono-boy.png',
    'erubin': 'msg7-curly-man-casual.png',
    'erubin:sekiyuou': 'msg8-curly-man-robe.png',
}
# 囲まれた背景の残り(腕と頭のあいだ・両足のあいだなど、外から切り抜いても抜けない白)。
#   キー → 元の絵の上の座標 (x, y) の一覧。その点からつながる白い所を透明にする(服の白は座標を入れないので残る)
POCKETS = {
    'atsu': [(518, 1170), (620, 232), (576, 166)],
}
# 書き出しの大きさ: 画面で出る大きさ(紹介の1人ずつの画面。縦 約 290・横 約 370 CSS px の高さ)× 端末の2倍 ≒ 768。
#   864 も試したが、見た目は変わらず合計が 1 割ほど重くなるので 768。元がこれより小さい絵(みゅあの8表情)は元の大きさのまま
OUT_W, OUT_H = 512, 768
MARGIN = 6  # 切り詰めのあとの余白(出力の画素)


def dil(m, r):
    out = m.copy()
    for _ in range(r):
        p = np.pad(out, 1)
        out = (p[1:-1, 1:-1] | p[:-2, 1:-1] | p[2:, 1:-1] | p[1:-1, :-2] | p[1:-1, 2:]
               | p[:-2, :-2] | p[:-2, 2:] | p[2:, :-2] | p[2:, 2:])
    return out


def ero(m, r):
    return ~dil(~m, r)


def label_keep(m, min_frac=0.03):
    """つながった塊のうち、いちばん大きい塊の min_frac 以上のものだけ残す。"""
    h, w = m.shape
    lab = np.zeros((h, w), np.int32)
    sizes = [0]
    n = 0
    ys, xs = np.nonzero(m)
    for y0, x0 in zip(ys, xs):
        if lab[y0, x0]:
            continue
        n += 1
        stack = [(y0, x0)]
        lab[y0, x0] = n
        cnt = 0
        while stack:
            y, x = stack.pop()
            cnt += 1
            for dy in (-1, 0, 1):
                for dx in (-1, 0, 1):
                    yy, xx = y + dy, x + dx
                    if 0 <= yy < h and 0 <= xx < w and m[yy, xx] and not lab[yy, xx]:
                        lab[yy, xx] = n
                        stack.append((yy, xx))
        sizes.append(cnt)
    if n == 0:
        return m
    big = max(sizes)
    keep = np.zeros(n + 1, bool)
    for i in range(1, n + 1):
        keep[i] = sizes[i] >= big * min_frac
    return keep[lab]


def drop_pockets(arr, seeds, pocket=None):
    """seeds の点からつながる、白に近い所(囲まれた背景の残り)を透明にする。ふちの白いにじみも少し削る。
    pocket … すでに分かっている抜く所(auto_pockets の結果)。seeds と合わせて抜く"""
    a = arr.copy()
    rgb = a[..., :3].astype(int)
    white = (a[..., 3] > 0) & (rgb.min(axis=2) >= 190) & ((rgb.max(axis=2) - rgb.min(axis=2)) <= 30)
    h, w = white.shape
    pocket = np.zeros_like(white) if pocket is None else pocket.copy()
    for sx, sy in seeds or ():
        if not white[sy, sx]:
            raise SystemExit('座標 (%d,%d) が白ではありません' % (sx, sy))
        stack = [(sy, sx)]
        pocket[sy, sx] = True
        while stack:
            y, x = stack.pop()
            for yy, xx in ((y + 1, x), (y - 1, x), (y, x + 1), (y, x - 1)):
                if 0 <= yy < h and 0 <= xx < w and white[yy, xx] and not pocket[yy, xx]:
                    pocket[yy, xx] = True
                    stack.append((yy, xx))
    # 輪郭線とのさかいの、白が混ざった画素も外へ(明るい所だけ・2画素まで)
    grow = dil(pocket, 3)
    mix = grow & ~pocket & (rgb.min(axis=2) >= 120) & ((rgb.max(axis=2) - rgb.min(axis=2)) <= 40)
    a[pocket | mix, 3] = 0
    return a


# 髪の束のすき間などに閉じ込められた白い背景を、範囲を決めて抜く絵。キー → 元の絵の上の範囲 (x0, y0, x1, y1) の一覧。
#   範囲の中で「外(透明)に近く・色がほぼ平ら(背景の白)・小さい」白い塊を抜く。5つ目に False を付けた範囲はその中を抜かない
#   (フリル・羽など、本当の白を守る)。範囲は 2026-11-12 に1塊ずつ拡大して確かめて決めた。
#   ソラシドの着物のふちの白は、紺の輪郭線の内側に描かれた「つや」なので抜かない(確かめ済み)
AUTO_POCKETS = {
    'kiki': [(300, 0, 720, 420)],                               # 髪の左右の束のすき間(靴の白は入れない)
    'kiki:halloween': [(300, 100, 720, 400)],                   # 髪の左右(うさ耳・袖は入れない)
    'kyuko': [(340, 150, 645, 310)],                            # 髪と顔・首のすき間(首ひも・ブラウスのフリルは入れない)
    'momosuke': [(240, 290, 335, 400), (690, 220, 765, 360)],   # 髪の左右の巻き毛のすき間(耳・袖のフリルは入れない)
}
# 外側に「白い縁取り + 薄い灰色の線」が付いたまま切り抜かれた絵(2026-11-12 に元絵の頭・手・服のふちを3倍で見て決めた)。
#   この子たちは、ふちの細い白を、外の灰色の線を越えても取る。ほかの子(ソラシドの着物のつや・みゅあの髪や羽など)は、
#   輪郭線の内側に描かれた白なので、外の透明から明るい画素だけでたどれる白しか取らない
HALO = {'atsu', 'kiki', 'kiki:halloween', 'kyuko', 'momosuke'}
# 白マットを外から塗りつぶしで抜く絵(体に白い所が少なく、外の白が厚い塊で残っている子だけ。白い服・羽の子には当てない)
FLOOD = {'atsu'}
WHITE = 253.0  # 元絵の白マットの色(実測 250〜255・色味 4 以下)


def geo_fill(seed, allow):
    """seed から allow の中を伝って広がる所(4方向)。"""
    cur = seed & allow
    while True:
        p = np.pad(cur, 1)
        nxt = (cur | p[:-2, 1:-1] | p[2:, 1:-1] | p[1:-1, :-2] | p[1:-1, 2:]) & allow
        if (nxt == cur).all():
            return cur
        cur = nxt


def white_comps(white):
    """白い所のつながった塊(4方向)を、画素の座標の配列の一覧で返す。"""
    h, w = white.shape
    lab = np.zeros((h, w), np.int32)
    out = []
    ys, xs = np.nonzero(white)
    for y0, x0 in zip(ys, xs):
        if lab[y0, x0]:
            continue
        lab[y0, x0] = len(out) + 1
        st, pts = [(y0, x0)], []
        while st:
            y, x = st.pop()
            pts.append((y, x))
            for yy, xx in ((y + 1, x), (y - 1, x), (y, x + 1), (y, x - 1)):
                if 0 <= yy < h and 0 <= xx < w and white[yy, xx] and not lab[yy, xx]:
                    lab[yy, xx] = len(out) + 1
                    st.append((yy, xx))
        out.append(np.array(pts))
    return out


def auto_pockets(arr, boxes, k):
    """boxes の範囲の中の、外(透明)に近く・色がほぼ平らで・小さい白い塊(閉じ込められた背景)の印を返す。"""
    rgb = arr[..., :3].astype(int)
    al = arr[..., 3]
    mn, mx = rgb.min(axis=2), rgb.max(axis=2)
    trans = al < 16
    white = ~trans & (mn >= 232) & ((mx - mn) <= 14)
    near = dil(trans, int(round(12 * k)))
    mask = np.zeros(white.shape, bool)
    for P in white_comps(white):
        if len(P) < 10 * k * k or len(P) > 1500 * k * k:
            continue
        cy, cx = P.mean(axis=0)
        inside = any(b[0] <= cx < b[2] and b[1] <= cy < b[3] for b in boxes if len(b) == 4 or b[4])
        outside = any(b[0] <= cx < b[2] and b[1] <= cy < b[3] for b in boxes if len(b) == 5 and not b[4])
        if not inside or outside:
            continue
        if near[P[:, 0], P[:, 1]].mean() > 0.9 and rgb[P[:, 0], P[:, 1]].std() < 5.0:
            mask[P[:, 0], P[:, 1]] = True
    return mask


def dematte(arr, k, flood=False, halo=False):
    """元の絵に残る白い背景(白マット)を取る(2026-11-12 社長「あつもひどいしちゃんと全部確認して直して」)。
    ・ふちの白い細い線: 透明から数画素以内の、明るく色味の少ない画素のうち、細い所(白の所を開くと消える所)を、
      内側の色との混ざりとみて「白に対するアンマルチプライ」をかける(白の分だけアルファを下げ、色は内側の色にする)。
      本当に白い厚い所(羽・ドレス・耳・靴下)は開いても残るので触らない。内側の色が白に近い所(白い服のふち)も触らない。
      ここまでは halo(白い縁取りが付いたまま切り抜かれた子)だけ。ほかの子のふちの白は描き込みなので触らない
    ・flood … 透明の外側から、白い画素を伝って塗りつぶしで抜く(指と頭のあいだの白い塊など)。体の中の白(目・歯)は外につながらないので残る
    k … 元の絵の画素が書き出しの何画素ぶんか(1536 の絵は 2)。返すのは (直した絵, 直した画素の数)"""
    a = arr.copy().astype(np.float32)
    rgb, al = a[..., :3], a[..., 3]
    mn, mx = rgb.min(axis=2), rgb.max(axis=2)
    trans = al < 16
    n = 0
    if flood:
        white = (al >= 16) & (mn >= 228) & ((mx - mn) <= 14)
        out = geo_fill(dil(trans, 1) & white, white)
        # 抜いた塊のまわりの、白が混ざった画素も1〜2画素ぶん下のアンマルチプライで扱う(ここでは塊だけ透明に)
        al[out] = 0
        n += int(out.sum())
        trans = al < 16
    if not halo:
        # 縁取りのない子は、ふちの白は描き込み(つや・クリーム色の布・怒りマークや真珠の白いふち)なので触らない(2026-11-12 に全部見て決めた)
        return np.clip(a, 0, 255).astype(np.uint8), n
    B = max(2, int(round(3.5 * k)))   # ふちから何画素までを見るか(書き出しで約 3.5 画素)
    r = max(1, int(round(1.5 * k)))   # 細い・厚いの境(開く半径。書き出しで約 3 画素の太さより細い白を「線」とみる)
    band = dil(trans, B) & ~trans
    light = (mn >= 150) & ((mx - mn) <= 60) & ~trans
    thick = dil(ero(light, r), r)
    cand = band & light & ~thick
    if not cand.any():
        return np.clip(a, 0, 255).astype(np.uint8), n
    known = ~trans & ~cand & (al >= 200)
    F = fill_colors(rgb, known, 4 * B)
    W = np.float32(WHITE)
    d = W - F
    dd = (d * d).sum(axis=2)
    aw = ((W - rgb) * d).sum(axis=2) / np.maximum(dd, 1.0)
    aw = np.clip(aw, 0.0, 1.0)
    aw = np.where(dd < 60.0 ** 2, 1.0, aw)  # 内側の色が白に近い(白い服のふち): 触らない
    sel = cand & (aw < 0.98)
    al[sel] = al[sel] * aw[sel]
    rgb[sel] = F[sel]
    n += int(sel.sum())
    a[..., 3] = al
    a[..., :3] = rgb
    return np.clip(a, 0, 255).astype(np.uint8), n


def blur(m, sigma):
    """ぼかし(numpy だけで。ガウスを縦横に分けてかける)。"""
    r = max(1, int(round(sigma * 3)))
    k = np.exp(-0.5 * (np.arange(-r, r + 1) / sigma) ** 2)
    k /= k.sum()
    m = m.astype(np.float32)
    p = np.pad(m, ((r, r), (0, 0)), mode='edge')
    m = sum(k[i] * p[i:i + m.shape[0]] for i in range(2 * r + 1))
    p = np.pad(m, ((0, 0), (r, r)), mode='edge')
    return sum(k[i] * p[:, i:i + m.shape[1]] for i in range(2 * r + 1))


def fill_colors(col, known, steps):
    """known の画素の色を、まわりへ steps 画素ぶん広げる(ふち・透明な所の色を、内側の色で埋める)。"""
    col = col.copy()
    known = known.copy()
    for _ in range(steps):
        w = known.astype(np.float32)
        pc = np.pad(col * w[..., None], ((1, 1), (1, 1), (0, 0)))
        pw = np.pad(w, 1)
        s = sum(pc[1 + dy:pc.shape[0] - 1 + dy, 1 + dx:pc.shape[1] - 1 + dx] for dy in (-1, 0, 1) for dx in (-1, 0, 1))
        c = sum(pw[1 + dy:pw.shape[0] - 1 + dy, 1 + dx:pw.shape[1] - 1 + dx] for dy in (-1, 0, 1) for dx in (-1, 0, 1))
        newk = (~known) & (c > 0)
        if not newk.any():
            break
        col[newk] = s[newk] / c[newk][:, None]
        known = known | newk
    return col


def clean(path, min_frac=0.03, arr=None, seeds=None, soft=None, flood=False, stats=None, boxes=None, halo=False):
    """背景のもや・ごみを落とし、ふちの白いにじみを消す。ふちのアルファは2値に切らず、なめらかなまま残す
    (2026-11-12 社長「全身画の透過の荒さ直ってないね」: 前の作りはふちを 0/255 近くへ寄せていた)。
    soft … ふちのアルファをぼかす量(元の絵の画素)。None なら元の絵のふちが2値のときだけ、書き出しで約 0.6 画素になる量でぼかす。"""
    im = (np.array(Image.open(path).convert('RGBA')) if arr is None else arr)
    pk = auto_pockets(im, boxes, max(1.0, im.shape[0] / OUT_H)) if boxes else None
    if seeds or pk is not None:
        im = drop_pockets(im, seeds, pk)  # 抜いた所のふちは2値なので、あとで少しぼかす
    im, nfix = dematte(im, max(1.0, im.shape[0] / OUT_H), flood, halo)  # 白マット取り(元の絵の大きさのうちに)
    if stats is not None:
        stats.append(nfix)
    im = im.astype(np.float32)
    h0, w0 = im.shape[:2]
    # 4の倍数に足りない分は透明で足す(4分の1の大きさで塊を数えるため)
    ph, pw = (-h0) % 4, (-w0) % 4
    if ph or pw:
        im = np.pad(im, ((0, ph), (0, pw), (0, 0)), constant_values=0)
    rgb, a = im[..., :3], im[..., 3]
    # 1) 体の本体(アルファ 170 以上)
    core = a >= 170
    # 2) 小さな点を落とす: 4分の1の大きさで数え、体から離れた小さな塊を消す
    sm = core[::4, ::4] | core[1::4, 1::4] | core[2::4, 2::4] | core[3::4, 3::4]
    sm = dil(sm, 2)
    keep_s = label_keep(sm, min_frac)
    keep = np.kron(keep_s, np.ones((4, 4), bool))[:core.shape[0], :core.shape[1]]
    keep = dil(keep, 6)  # 縁の細かい所を落とさない
    body = core & keep
    # 3) 背景のぼかし(光・もや)を落とす: 体から離れるほど、なだらかに消す(体のふち2画素まではそのまま・そこから約3画素で0へ)。
    #    前は「縁の2画素より外は0」と切っていたので、ふちが段になっていた
    near = blur(dil(body, 2), 1.5)
    a2 = a * np.clip(near * 2.0, 0, 1)
    a2 = np.where(a2 >= 10, a2, 0)
    # 4) 元の絵のふちが2値(ほぼ 0 か 255)なら、少しぼかしてなめらかにする(高い解像度のうちに。縮めると 1 画素ほどの半透明になる)
    edge = (a > 0) & (a < 255) & dil(body, 2) & ~ero(body, 2)
    ring = dil(body, 1) & ~ero(body, 1)
    if soft is None:
        # 量は書き出しで約 0.6 画素になるように(縮める絵ほど元の絵の上では大きく)
        k = max(1.0, h0 / OUT_H)
        soft = 0.6 * k if ring.sum() and edge.sum() < 0.3 * ring.sum() else (0.4 * k if (seeds or pk is not None) else 0.0)
    if soft > 0:
        a2 = np.minimum(blur(a2, soft) * 1.0, np.where(dil(a2 > 0, 3), 255, 0))
    a2 = np.clip(a2, 0, 255)
    # 5) ふちの色を内側の色で塗り直す(白・黒の色のにじみ消し)。透明な所も内側の色で埋めておく(縮めるときに、ふちへ白や黒が混ざらないように)
    solid = ero(a2 >= 250, 1)
    col = fill_colors(rgb, solid, 14)
    rim = ~solid
    col = np.where(rim[..., None], col, rgb)
    out = np.dstack([np.clip(col, 0, 255), a2]).astype(np.uint8)
    return Image.fromarray(out[:h0, :w0], 'RGBA')


def fit(im, out_w=None, out_h=None):
    out_w, out_h = out_w or OUT_W, out_h or OUT_H
    a = np.array(im)[..., 3]
    ys, xs = np.nonzero(a > 24)
    box = (xs.min(), ys.min(), xs.max() + 1, ys.max() + 1)
    pad = 4  # うすいふちを切り落とさない
    box = (max(0, box[0] - pad), max(0, box[1] - pad), min(im.width, box[2] + pad), min(im.height, box[3] + pad))
    c = im.crop(box)
    s = min((out_w - 2 * MARGIN) / c.width, (out_h - 2 * MARGIN) / c.height, 1.0)  # 元より大きくはしない
    if s < 1.0:
        c = c.resize((max(1, round(c.width * s)), max(1, round(c.height * s))), Image.LANCZOS)
    # 体の大きさのまま、縦横の比を保って、まわりに余白だけ足す(枠いっぱいには引き伸ばさない)
    canvas = Image.new('RGBA', (c.width + 2 * MARGIN, c.height + 2 * MARGIN), (0, 0, 0, 0))
    canvas.paste(c, (MARGIN, MARGIN))
    return canvas


def quant(im):
    """半透明を保ったまま 256 色へ。libimagequant(pip の imagequant)で、ふちの半透明の段を細かく残す。
    入っていなければ止める(Pillow の減色はふちのアルファを荒くするので使わない)。"""
    try:
        import imagequant
    except ImportError:
        raise SystemExit('imagequant が入っていません: pip install imagequant')
    return imagequant.quantize_pil_image(im, dithering_level=float(os.environ.get('FULLBODY_DITHER', '0')), max_colors=256, min_quality=0, max_quality=100)


def save(im, path):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    quant(im).save(path, optimize=True)
    return os.path.getsize(path)


def sheet_cells():
    """みゅあの8表情のシート(life-expression-sheets.py の SHEETS)を切って、背景を抜いた8枚ずつを返す。{全身画の名前: [8枚]}"""
    import importlib.util
    spec = importlib.util.spec_from_file_location('sheets', os.path.join(os.path.dirname(os.path.abspath(__file__)), 'life-expression-sheets.py'))
    sh = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(sh)
    return {cfg['name']: list(zip(sh.EXPR, sh.cut_cells(cfg))) for cfg in sh.SHEETS.values()}, sh


def drop_border_bits(im):
    """表情シートの枠の左右の端に触れている、いちばん大きい塊でない塊(となりの枠の手・かけら)を消す
    (2026-11-12 全部見て見つけた: みゅあの泣き・ウインクの右端に、となりの絵の手やかけらが入り込んでいた)。
    汗・びっくりマークなどの小さな絵は枠の端に触れないので残る"""
    a = np.array(im)
    m = a[..., 3] > 8
    comps = white_comps(m)
    if len(comps) < 2:
        return im
    big = max(len(P) for P in comps)
    w = m.shape[1]
    for P in comps:
        if len(P) < big and (P[:, 1].min() <= 1 or P[:, 1].max() >= w - 2):
            a[P[:, 0], P[:, 1], 3] = 0
    return Image.fromarray(a, 'RGBA')


def main():
    """全身画を全部(1人ずつの絵 + みゅあの8表情のシート)作り直す。--only <名前> で1枚だけ(例 kiki・mua__happy)。
    場面用の立ち絵(胸から上)は作らない(それは life-expression-sheets.py)。"""
    os.makedirs(OUT, exist_ok=True)
    only = sys.argv[sys.argv.index('--only') + 1] if '--only' in sys.argv else None
    tiles = []
    total = 0
    jobs = []
    for key, f in ART.items():
        name = key.replace('@', '__').replace(':', '_')
        jobs.append((name, lambda key=key, f=f: clean(os.path.join(SRC, f), seeds=POCKETS.get(key), flood=key in FLOOD, boxes=AUTO_POCKETS.get(key), halo=key in HALO)))
    if not only or '__' in only:
        cells, _ = sheet_cells()
        for base, rows in cells.items():
            for e, c in rows:
                jobs.append(('%s__%s' % (base, e), lambda c=c: drop_border_bits(c)))
    for name, make in jobs:
        if only and name != only:
            continue
        im = fit(make())
        n = save(im, os.path.join(OUT, name + '.png'))
        total += n
        tiles.append(Image.open(os.path.join(OUT, name + '.png')).convert('RGBA'))
        print('%-32s %s %4d KB' % (name + '.png', im.size, n // 1024))
    print('計 %d 枚 %d KB' % (len(tiles), total // 1024))
    if '--sheet' in sys.argv:
        p = sys.argv[sys.argv.index('--sheet') + 1]
        H = 400
        sh = Image.new('RGB', (sum(int(t.width * H / t.height) + 10 for t in tiles), H), (120, 120, 120))
        x = 0
        for t in tiles:
            r = t.resize((int(t.width * H / t.height), H))
            sh.paste(r, (x, 0), r)
            x += r.width + 10
        sh.save(p)


if __name__ == '__main__':
    main()

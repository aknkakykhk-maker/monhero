# クリスマスイベント「聖夜の名探偵」開催予告の予告編を1コマずつ描いて ffmpeg へ流す
import sys, math, random, subprocess
import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageEnhance

REPO, S, OUT = sys.argv[1], sys.argv[2], sys.argv[3]
W, H, FPS, DUR = 720, 1280, 30, 74.5
R = REPO + '/tools/art-sources/promo/xmas-2026/received/'
IMG = REPO + '/monster-hero/images/'
def rgba(p): return Image.open(p).convert('RGBA')
def rgb(p): return Image.open(p).convert('RGB')
def txt(k): return rgba(S + '/txt/' + k + '.png')

def ease(x): x = min(1, max(0, x)); return x * x * (3 - 2 * x)
def lerp(a, b, x): return a + (b - a) * x

def cover(img, scale, cx, cy):
    """img を scale 倍にした時の (cx,cy) 中心の 720x1280 を返す(cx,cy は img の座標)"""
    w, h = W / scale, H / scale
    x0 = min(max(cx - w / 2, 0), img.width - w); y0 = min(max(cy - h / 2, 0), img.height - h)
    return img.resize((W, H), Image.BICUBIC, box=(x0, y0, x0 + w, y0 + h))

def blur_bg(img, dark=0.55, rad=18, tint=None):
    sc = max(W / img.width, H / img.height)
    b = img.resize((int(img.width * sc) + 1, int(img.height * sc) + 1), Image.BICUBIC)
    b = b.crop(((b.width - W) // 2, (b.height - H) // 2, (b.width - W) // 2 + W, (b.height - H) // 2 + H))
    b = b.filter(ImageFilter.GaussianBlur(rad))
    b = ImageEnhance.Brightness(b).enhance(dark)
    if tint: b = Image.blend(b, Image.new('RGB', (W, H), tint), 0.25)
    return b

def paste_a(base, layer, xy, alpha=1.0):
    if alpha <= 0: return
    l = layer
    if alpha < 1:
        l = layer.copy(); a = l.getchannel('A').point(lambda v: int(v * alpha)); l.putalpha(a)
    base.alpha_composite(l, (int(round(xy[0])), int(round(xy[1]))))

def text_at(base, k, t, t0, t1, y, fade=0.5, rise=14):
    if t < t0 or t > t1: return
    a = min(ease((t - t0) / fade), ease((t1 - t) / fade))
    im = TX[k]
    paste_a(base, im, ((W - im.width) / 2, y + (1 - ease((t - t0) / fade)) * rise), a)

TX = {k: txt(k) for k in ['s1', 'band', 's2', 'card', 's3', 's3b', 's4', 's4b', 's5', 's6a', 's6b', 's7', 'v1', 'v2', 'stamp', 'sub7', 'parcel', 'cart', 'crt', 'crt_sub', 'crt_press', 'tv', 'g1']}

# ── 素材 ──
home = rgb(R + 'home-background-xmas_v2.png')
home = home.resize((900, int(home.height * 900 / home.width)), Image.BICUBIC)
title_bg = rgb(R + 'title-screen-xmas.png')
wide = rgb(R + 'xmas-2026-notice-wide.png')
square = rgb(R + 'xmas-2026-notice-square.png')
pension = wide.crop((70, 368, 650, 775))
pension_bg = blur_bg(pension, 0.5, 22)
warm_bg = blur_bg(title_bg, 0.42, 20)
pension_big = blur_bg(wide.crop((60, 360, 720, 760)), 0.7, 7)
night_bg = blur_bg(home, 0.35, 24, tint=(10, 20, 60))
title_logo = square.crop((222, 0, 1052, 214)).convert('RGBA')
m = Image.new('L', title_logo.size, 0); ImageDraw.Draw(m).rounded_rectangle((14, 6, title_logo.width - 14, title_logo.height - 6), 40, fill=255)
_mm = np.array(m.filter(ImageFilter.GaussianBlur(10))).astype(np.float32); _h = _mm.shape[0]
_mm[_h - 22:] *= np.linspace(1, 0, 22)[:, None]  # 下のふち(元の副題の帯の手前)をなだらかに消す
title_logo.putalpha(Image.fromarray(_mm.astype(np.uint8)))
title_logo = title_logo.resize((700, int(title_logo.height * 700 / title_logo.width)), Image.LANCZOS)

def fit_h(im, h): return im.resize((int(im.width * h / im.height), h), Image.LANCZOS)
ichika = fit_h(rgba(IMG + 'monsters/SNEGUROCHKA.PNG').crop((0, 120, 1024, 1536)), 600)
mocchi = fit_h(rgba(IMG + 'monsters/mocchi.png').crop((150, 0, 874, 1024)), 400)
FB = IMG + 'assistant/fullbody/'
cast = [fit_h(rgba(FB + n + '_santa.png'), 640) for n in ['mua', 'atsu', 'kiki', 'sorashido', 'momosuke', 'erubin', 'kyuko']]
# 一列の集合絵(助手7人 + イチーカ + もちまる)
row_items = cast[:4] + [fit_h(ichika, 560), mocchi] + cast[4:]
gap = -30
row_w = sum(i.width for i in row_items) + gap * (len(row_items) - 1)
row = Image.new('RGBA', (row_w, 660), (0, 0, 0, 0)); x = 0
for i in row_items:
    row.alpha_composite(i, (x, 660 - i.height)); x += i.width + gap
det_l = fit_h(rgba(FB + 'atsu_santa.png'), 820)
det_r = fit_h(rgba(FB + 'sorashido_santa.png'), 820)

# ── 空になったプレゼントの箱(描く) ──
def grad_poly(size, poly, c0, c1, y0, y1):
    mask = Image.new('L', size, 0); ImageDraw.Draw(mask).polygon(poly, fill=255)
    g = np.zeros((size[1], size[0], 4), np.uint8)
    ys = np.clip((np.arange(size[1]) - y0) / max(1, (y1 - y0)), 0, 1)[:, None]
    for c in range(3): g[:, :, c] = (c0[c] + (c1[c] - c0[c]) * ys).astype(np.uint8)
    g[:, :, 3] = np.array(mask)
    return Image.fromarray(g, 'RGBA')

def make_box():
    L = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    # 床の影
    sh = Image.new('L', (W, H), 0); ImageDraw.Draw(sh).ellipse((70, 860, 650, 960), fill=170)
    sh = sh.filter(ImageFilter.GaussianBlur(22)); shl = Image.new('RGBA', (W, H), (0, 0, 0, 255)); shl.putalpha(sh); L.alpha_composite(shl)
    fl, fr, bl, br = (150, 690), (570, 690), (200, 610), (520, 610)
    bot = 900
    # 箱の内側(奥の壁と底): 暗い
    L.alpha_composite(grad_poly((W, H), [bl, br, fr, fl], (40, 6, 12), (12, 2, 4), 610, 690))
    L.alpha_composite(grad_poly((W, H), [bl, br, (520, 650), (200, 650)], (120, 20, 30), (50, 8, 14), 610, 650))
    # 前の面
    L.alpha_composite(grad_poly((W, H), [fl, fr, (570, bot), (150, bot)], (200, 30, 42), (110, 12, 22), 690, bot))
    sd = np.zeros((H, W, 4), np.uint8); xs = np.clip((np.arange(W) - 150) / 420, 0, 1); sd[690:bot, :, 3] = (xs * 110)[None, :].astype(np.uint8); sd[:, :150, 3] = 0; sd[:, 571:, 3] = 0
    L.alpha_composite(Image.fromarray(sd, 'RGBA'))
    # 縁の明かり
    d = ImageDraw.Draw(L)
    d.line([fl, fr], fill=(255, 140, 140, 255), width=4)
    d.line([bl, br], fill=(150, 40, 50, 255), width=3)
    d.line([bl, fl], fill=(170, 40, 50, 255), width=3); d.line([br, fr], fill=(170, 40, 50, 255), width=3)
    # 金のリボン(前の面のたて)
    L.alpha_composite(grad_poly((W, H), [(335, 690), (385, 690), (385, bot), (335, bot)], (255, 222, 120), (170, 120, 30), 690, bot))
    # ほどけたリボン(床の上)
    rb = Image.new('RGBA', (W, H), (0, 0, 0, 0)); dr = ImageDraw.Draw(rb)
    pts = [(360 - i * 9, 902 + i * 2.2 + 10 * math.sin(i / 6.0)) for i in range(26)]
    dr.line(pts, fill=(222, 175, 62, 255), width=13, joint='curve')
    cx, cy = pts[-1]
    pts2 = [(cx - 28 + 30 * math.cos(a / 10), cy - 4 + 16 * math.sin(a / 10)) for a in range(0, 50)]
    dr.line(pts2, fill=(205, 158, 52, 255), width=11, joint='curve')
    L.alpha_composite(rb.filter(ImageFilter.GaussianBlur(0.8)))
    # ふた(左に立てかけて傾ける)
    lid = Image.new('RGBA', (330, 84), (0, 0, 0, 0))
    lid.alpha_composite(grad_poly((330, 84), [(0, 0), (330, 0), (330, 84), (0, 84)], (215, 40, 52), (120, 15, 25), 0, 84))
    ImageDraw.Draw(lid).rectangle((140, 0, 188, 84), fill=(235, 195, 90, 255))
    ImageDraw.Draw(lid).rectangle((0, 0, 329, 83), outline=(255, 150, 150, 255), width=3)
    lid = lid.rotate(-70, expand=True, resample=Image.BICUBIC)
    L.alpha_composite(lid, (548, 590))
    # 上からの明かり
    sp = Image.new('L', (W, H), 0); ImageDraw.Draw(sp).polygon([(300, 0), (420, 0), (640, 960), (80, 960)], fill=60)
    sp = sp.filter(ImageFilter.GaussianBlur(40)); spl = Image.new('RGBA', (W, H), (255, 240, 210, 255)); spl.putalpha(sp)
    L.alpha_composite(spl)
    return L
box_layer = make_box()
box_bg = ImageEnhance.Brightness(blur_bg(title_bg, 0.6, 26)).enhance(0.45)

# ── 窓の外の影 ──
shadow_view = wide.crop((1385, 30, 1774, 285))
def make_window():
    fr = Image.new('RGBA', (W, H), (14, 10, 12, 255)); d = ImageDraw.Draw(fr)
    x0, y0, x1, y1 = 60, 300, 660, 760
    d.rectangle((x0, y0, x1, y1), fill=(0, 0, 0, 0))
    wood = (70, 42, 26, 255)
    for r in [(x0 - 22, y0 - 22, x1 + 22, y0), (x0 - 22, y1, x1 + 22, y1 + 30), (x0 - 22, y0, x0, y1), (x1, y0, x1 + 22, y1),
              ((x0 + x1) // 2 - 9, y0, (x0 + x1) // 2 + 9, y1), (x0, (y0 + y1) // 2 - 9, x1, (y0 + y1) // 2 + 9)]:
        d.rectangle(r, fill=wood)
    d.rectangle((x0 - 40, y1 + 30, x1 + 40, y1 + 52), fill=(95, 60, 36, 255))
    # 霜(角を白く)
    fm = Image.new('L', (W, H), 0); dm = ImageDraw.Draw(fm)
    for cx, cy in [(x0, y0), (x1, y0), (x0, y1), (x1, y1), ((x0 + x1) // 2, (y0 + y1) // 2)]:
        dm.ellipse((cx - 70, cy - 70, cx + 70, cy + 70), fill=120)
    fm = fm.filter(ImageFilter.GaussianBlur(30))
    frost = Image.new('RGBA', (W, H), (220, 235, 255, 255)); frost.putalpha(fm)
    hole = Image.new('L', (W, H), 0); ImageDraw.Draw(hole).rectangle((x0, y0, x1, y1), fill=255)
    fa = np.minimum(np.array(fm), np.array(hole)); frost.putalpha(Image.fromarray(fa))
    return fr, frost, (x0, y0, x1, y1)
win_frame, win_frost, WB = make_window()

# ── 雪 ──
rng = random.Random(7)
flakes = [dict(x=rng.uniform(0, W), y=rng.uniform(-H, H), v=rng.uniform(40, 120), r=rng.choice([2, 3, 3, 4, 5, 7]), ph=rng.uniform(0, 6.28)) for _ in range(150)]
spr = {}
for r in {f['r'] for f in flakes}:
    s = Image.new('L', (r * 6, r * 6), 0); ImageDraw.Draw(s).ellipse((r * 2, r * 2, r * 4, r * 4), fill=255)
    s = s.filter(ImageFilter.GaussianBlur(r * 0.7)); im = Image.new('RGBA', s.size, (255, 255, 255, 255)); im.putalpha(s.point(lambda v: int(v * 0.85))); spr[r] = im
def snow(base, t, amt=1.0, wind=20):
    if amt <= 0: return
    for i, f in enumerate(flakes):
        if i > len(flakes) * amt: break
        y = (f['y'] + f['v'] * t) % (H + 60) - 30
        x = (f['x'] + wind * t + 18 * math.sin(t * 0.8 + f['ph'])) % W
        im = spr[f['r']]; base.alpha_composite(im, (int(x) - im.width // 2, int(y) - im.height // 2))

vig = np.zeros((H, W), np.float32)
yy, xx = np.mgrid[0:H, 0:W]
vig = 1 - 0.55 * np.clip(((xx - W / 2) / (W * 0.75)) ** 2 + ((yy - H / 2) / (H * 0.7)) ** 2, 0, 1)
VIG = vig[:, :, None]
_b = np.zeros((H, W, 4), np.uint8); _b[:, :, 3] = (np.clip((np.arange(H) - 820) / 300, 0, 1) * 170)[:, None].astype(np.uint8); _b[:, :, :3] = (8, 12, 35)
BOTTOM = Image.fromarray(_b, 'RGBA')

# ── 場面 ──
def sc1(t):  # 0-5.4 雪の山とペンションの里(上から下へ)
    p = ease(t / 5.4)
    img = home.crop((90, lerp(0, home.height - H, p), 90 + W, lerp(0, home.height - H, p) + H)).convert('RGBA')
    snow(img, t, 0.9); img.alpha_composite(BOTTOM); text_at(img, 's1', t, 1.0, 5.0, 960); return img
def sc2(t):  # 5-9.4 ペンションの外観
    img = pension_bg.copy().convert('RGBA')
    sc = lerp(1.0, 1.1, ease(t / 4.4)); w = int(W * sc); h = int(pension.height * w / pension.width)
    p = pension.resize((w, h), Image.BICUBIC).convert('RGBA')
    m = Image.new('L', p.size, 0); ImageDraw.Draw(m).rectangle((0, 18, w, h - 18), fill=255); p.putalpha(m.filter(ImageFilter.GaussianBlur(16)))
    img.alpha_composite(p, ((W - w) // 2, 640 - h // 2 - 40))
    snow(img, t + 5, 1.0); text_at(img, 'band', t, 0.6, 4.2, 240); return img
def sc3(t):  # 9-14.4 招待状とイチーカ
    img = warm_bg.copy().convert('RGBA'); snow(img, t + 9, 0.5)
    pc = ease((t - 0.2) / 1.2)
    cbig = TX['card'].resize((700, 500), Image.LANCZOS)
    card = cbig.rotate(lerp(-8, -3, pc), expand=True, resample=Image.BICUBIC)
    paste_a(img, card, ((W - card.width) / 2, lerp(900, 250, pc)), min(1, pc * 2))
    pi = ease((t - 1.2) / 1.4)
    paste_a(img, ichika, (lerp(-300, 300, pi) + 6 * math.sin(t * 1.6), 690 + 8 * math.sin(t * 2.1)), pi)
    text_at(img, 's2', t, 0.8, 6.8, 90); return img
def sc4(t, dim=0):  # 14-19.4 みんなが集まる(横に流す)
    img = cover(pension_big, lerp(1.0, 1.06, t / 6.4), pension_big.width / 2, pension_big.height / 2).convert('RGBA')
    x = lerp(60, W - row_w - 60, ease(t / 6.4) * 0.85 + t / 6.4 * 0.15)
    img.alpha_composite(row, (int(x), H - 660 - 20))
    snow(img, t + 14, 0.6)
    d = ease((t - 4.2) / 1.6)
    if d > 0:
        a = np.asarray(img).astype(np.float32); g = a[:, :, :3].mean(axis=2, keepdims=True)
        a[:, :, :3] = (a[:, :, :3] * (1 - d * 0.8) + g * d * 0.8) * (1 - d * 0.55) + np.array([5, 10, 40]) * d * 0.3
        img = Image.fromarray(np.clip(a, 0, 255).astype(np.uint8), 'RGBA')
    text_at(img, 's3', t, 0.5, 4.0, 110); text_at(img, 's3b', t, 4.3, 6.4, 150, fade=0.6); return img
HALL = rgb(S + '/v7/shots/hall.png').crop((0, 110, 720, 980))
HALL = HALL.resize((int(720 * 1280 / 870), 1280), Image.LANCZOS)
def sc5(t):  # 零時の鐘と停電(事件簿の広間の柱時計)
    cx, cy = 370 * HALL.width / 720, (620 - 110) * 1280 / 870
    sc = lerp(1.0, 1.45, ease(t / 7.4)); sh = 0
    for b in (0.6, 1.3, 2.0):
        if 0 <= t - b < 0.25: sh = 6 * (1 - (t - b) / 0.25)
    img = cover(HALL, sc, lerp(HALL.width / 2, cx, ease(t / 3)) + sh * math.sin(t * 80), lerp(640, cy, ease(t / 3)))
    a = np.asarray(img).astype(np.float32)
    lit = 1.0
    if 3.8 <= t < 4.5: lit = [1, .25, .9, .12, .6, .05, .3][int((t - 3.8) / 0.1)]
    elif t >= 4.5: lit = 0.0
    dark = a * np.array([0.22, 0.27, 0.45]) + np.array([2, 4, 14])
    a = a * lit + dark * (1 - lit)
    for b in (0.6, 1.3, 2.0):
        if 0 <= t - b < 0.4: a = a * (1 + 0.12 * (1 - (t - b) / 0.4))
    img = Image.fromarray(np.clip(a, 0, 255).astype(np.uint8)).convert('RGBA')
    text_at(img, 's4', t, 0.4, 3.7, 150, fade=0.4); text_at(img, 's4b', t, 4.6, 7.4, 150, fade=0.4)
    return img
# ── 仲間が、ひとり、またひとり(顔の無い同じ影を 4・4・4 に並べる。台本の並びとは結び付けない) ──
CW, CH = 140, 180
def make_card(gray=False):
    c = Image.new('RGBA', (CW, CH), (0, 0, 0, 0))
    bg = grad_poly((CW, CH), [(0, 0), (CW, 0), (CW, CH), (0, CH)], (44, 58, 110), (16, 22, 50), 0, CH)
    m = Image.new('L', (CW, CH), 0); ImageDraw.Draw(m).rounded_rectangle((0, 0, CW - 1, CH - 1), 12, fill=255)
    c.paste(bg, (0, 0), m)
    sil = Image.new('L', (CW, CH), 0); d = ImageDraw.Draw(sil)
    d.ellipse((CW / 2 - 30, 38, CW / 2 + 30, 104), fill=255); d.ellipse((CW / 2 - 58, 108, CW / 2 + 58, 260), fill=255)
    sil = Image.fromarray(np.minimum(np.array(sil), np.array(m)))
    c.paste(Image.new('RGBA', (CW, CH), (6, 8, 20, 255)), (0, 0), sil)
    ImageDraw.Draw(c).rounded_rectangle((1, 1, CW - 2, CH - 2), 12, outline=(214, 178, 90, 255), width=3)
    if gray:
        a = np.asarray(c).astype(np.float32); g = a[:, :, :3].mean(axis=2, keepdims=True) * 0.45
        a[:, :, :3] = g; c = Image.fromarray(a.astype(np.uint8), 'RGBA')
    return c
CARD, CARD_G = make_card(), make_card(True)
SLOTS = []
for r, (n, y) in enumerate([(4, 300), (4, 500), (4, 700)]):
    x0 = (W - (n * CW + (n - 1) * 16)) / 2
    for i in range(n): SLOTS.append((x0 + i * (CW + 16), y))
STAMPS = [(5, 1.0), (2, 2.6), (8, 4.0)]  # (枠の番号, 暗くなる時刻)。台本のパネルの並び(6人ずつ2段)とは結び付かない
def make_flower():
    f = Image.new('RGBA', (240, 240), (0, 0, 0, 0)); d = ImageDraw.Draw(f)
    d.line([(120, 128), (150, 230)], fill=(70, 120, 70, 255), width=7)
    d.ellipse((140, 170, 185, 195), fill=(80, 135, 80, 255))
    for k in range(6):
        p = Image.new('RGBA', (240, 240), (0, 0, 0, 0)); pd = ImageDraw.Draw(p)
        pd.ellipse((104, 40, 136, 122), fill=(250, 250, 246, 255), outline=(205, 210, 215, 255), width=2)
        f.alpha_composite(p.rotate(k * 60, center=(120, 120), resample=Image.BICUBIC))
    d.ellipse((106, 106, 134, 134), fill=(245, 225, 140, 255))
    f = f.filter(ImageFilter.GaussianBlur(0.6))
    return f.resize((112, 112), Image.LANCZOS).rotate(-18, expand=True, resample=Image.BICUBIC)
FLOWER = make_flower()
def blood_x(seed, tt):
    rr = np.random.default_rng(seed + 11)
    lay = Image.new('RGBA', (CW, CH), (0, 0, 0, 0)); d = ImageDraw.Draw(lay)
    m = 18
    strokes = [((m, m + 8), (CW - m, CH - m - 14)), ((CW - m - 4, m + 4), (m + 6, CH - m - 10))]
    for n, (p0, p1) in enumerate(strokes):
        q = min(1, max(0, (tt - n * 0.32) / 0.26))
        if q <= 0: continue
        e = (p0[0] + (p1[0] - p0[0]) * q, p0[1] + (p1[1] - p0[1]) * q)
        vx, vy = p1[0] - p0[0], p1[1] - p0[1]; ln = math.hypot(vx, vy); nx, ny = -vy / ln, vx / ln
        offs = rr.normal(0, 2.0, 16)
        for o in offs:  # 筆のかすれ: 細い線を少しずつずらして重ねる
            w = int(rr.integers(2, 6)); col = (int(rr.integers(150, 200)), int(rr.integers(8, 22)), int(rr.integers(14, 26)), int(rr.integers(170, 245)))
            a0 = (p0[0] + nx * o, p0[1] + ny * o); a1 = (e[0] + nx * o * (0.6 + 0.4 * q), e[1] + ny * o * (0.6 + 0.4 * q))
            d.line([a0, a1], fill=col, width=w)
        d.line([p0, e], fill=(150, 10, 18, 255), width=8)
        # 滴: 線の途中から下へ垂れる(引いたあとに少しずつ伸びる)
        for f in (0.22, 0.55, 0.83):
            if q < f: continue
            dx, dy = p0[0] + vx * f, p0[1] + vy * f
            grow = min(1, max(0, (tt - n * 0.32 - 0.26 * f - 0.15) / 1.4)) * (18 + 26 * f)
            if grow <= 0: continue
            d.line([(dx, dy), (dx, dy + grow)], fill=(140, 8, 16, 235), width=4)
            d.ellipse((dx - 3.5, dy + grow - 3, dx + 3.5, dy + grow + 5), fill=(135, 8, 14, 245))
    wet = lay.filter(ImageFilter.GaussianBlur(2.2)); wa = wet.getchannel('A').point(lambda v: int(v * 0.6)); wet.putalpha(wa)
    out = Image.new('RGBA', (CW, CH), (0, 0, 0, 0)); out.alpha_composite(wet); out.alpha_composite(lay)
    return out
def sc5b(t):  # 24-29.4 仲間が、ひとり、またひとり
    img = Image.new('RGBA', (W, H), (0, 0, 0, 255)); img.alpha_composite(box_bg.convert('RGBA').point(lambda v: int(v * 0.6)))
    shake = 0
    for k, (x, y) in enumerate(SLOTS):
        st = dict(STAMPS).get(k)
        g = 0 if st is None else ease((t - (st - 0.35)) / 0.3)
        img.alpha_composite(CARD, (int(x), int(y)))
        if g > 0: paste_a(img, CARD_G, (x, y), g)
        if g > 0: paste_a(img, Image.new('RGBA', (CW, CH), (0, 0, 0, 255)), (x, y), 0.35 * g)
        if st is not None and t >= st:  # 血で引いたようなバツを1本ずつ(社長 r1126-053・「血に見えるようにしよう」)
            img.alpha_composite(blood_x(k, t - st), (int(x), int(y)))
            if 0 <= t - st < 0.2 or 0.32 <= t - st < 0.52: shake = max(shake, 4)
    snow(img, t + 24, 0.3, wind=10)
    img = cover(img.convert('RGB'), lerp(1.0, 1.06, ease(t / 6.4)), W / 2 + shake * math.sin(t * 90), 640).convert('RGBA')
    text_at(img, 'v1', t, 1.2, 3.6, 990, fade=0.4); text_at(img, 'v2', t, 3.8, 6.4, 990, fade=0.4)
    return img
def sc6(t):  # 29-33.8 窓の外の黒い影
    x0, y0, x1, y1 = WB
    img = Image.new('RGBA', (W, H), (0, 0, 0, 255))
    view = shadow_view.resize((x1 - x0 + 120, int((x1 - x0 + 120) * shadow_view.height / shadow_view.width)), Image.BICUBIC)
    vy = y0 + (y1 - y0 - view.height) // 2
    img.paste(view, (x0 - 60 + int(10 * math.sin(t * 0.7)), vy))
    # 赤い目の光
    glow = Image.new('L', (W, H), 0)
    ex = x0 - 60 + view.width * (130 / 389) + 10 * math.sin(t * 0.7); ey = vy + view.height * (145 / 255)
    gi = int(150 + 100 * (0.5 + 0.5 * math.sin(t * 5)))
    ImageDraw.Draw(glow).ellipse((ex - 50, ey - 22, ex + 70, ey + 22), fill=gi)
    gl = Image.new('RGBA', (W, H), (255, 30, 30, 255)); gl.putalpha(glow.filter(ImageFilter.GaussianBlur(18)))
    img.alpha_composite(gl)
    bl = Image.new('RGBA', (W, H), (0, 0, 0, 0)); snow(bl, t + 3, 1.0, wind=320); snow(bl, t + 9, 1.0, wind=260)
    hm = Image.new('L', (W, H), 0); ImageDraw.Draw(hm).rectangle((x0, y0, x1, y1), fill=255)
    bl.putalpha(Image.fromarray(np.minimum(np.array(bl.getchannel('A')), np.array(hm)))); img.alpha_composite(bl)
    img.alpha_composite(win_frost); img.alpha_composite(win_frame)
    room = Image.new('RGBA', (W, H), (40, 60, 120, 60)); img.alpha_composite(room)
    sc = lerp(1.0, 1.35, ease(t / 4.8))
    sh = 6 * math.sin(t * 37) * max(0, 1 - t * 2)
    img = cover(img.convert('RGB'), sc, W / 2 + sh, lerp(H / 2, ey, ease(t / 4.8)) ).convert('RGBA')
    text_at(img, 's5', t, 0.8, 4.6, 960); return img
def sc7(t):  # 28.6-33.6 名探偵は、だれだ。
    img = night_bg.copy().convert('RGBA')
    pl = ease(t / 1.0)
    paste_a(img, det_l, (lerp(-360, -20, pl) + t * 6, 470), pl)
    paste_a(img, det_r, (lerp(W + 40, W - det_r.width + 20, pl) - t * 6, 470), pl)
    shade = Image.new('RGBA', (W, H), (0, 0, 0, 0)); a = np.zeros((H, W), np.uint8); a[:, :] = (np.clip((np.arange(H)[:, None] - 0) / 1, 0, 1) * 0).astype(np.uint8)
    snow(img, t + 33, 0.7, wind=60)
    for k, t0, y in [('s6a', 1.2, 110), ('s6b', 2.2, 260)]:
        if t >= t0:
            p = ease((t - t0) / 0.45); im = TX[k]
            s = lerp(1.25, 1.0, p); im2 = im.resize((int(im.width * s), int(im.height * s)), Image.BICUBIC)
            paste_a(img, im2, ((W - im2.width) / 2, y - (im2.height - im.height) / 2), min(1, p * 1.5) * min(1, (5.0 - t) / 0.4))
    return img
# ── 差出人のない小包と、古いゲームの起動画面 ──
nrng = np.random.default_rng(3)
def sc7b(t):  # 38.4-44.0
    if t < 4.0:
        img = Image.new('RGBA', (W, H), (0, 0, 0, 255)); img.alpha_composite(box_bg.convert('RGBA').point(lambda v: int(v * 0.75)))
        sp = Image.new('L', (W, H), 0); ImageDraw.Draw(sp).ellipse((60, 380, 660, 1000), fill=90)
        spl = Image.new('RGBA', (W, H), (255, 225, 170, 255)); spl.putalpha(sp.filter(ImageFilter.GaussianBlur(60))); img.alpha_composite(spl)
        pc = TX['parcel']; px, py = (W - pc.width) // 2, 560
        r = ease((t - 0.9) / 1.4); cs = lerp(0.78, 1.0, r); ct = TX['cart'].resize((int(340 * cs), int(440 * cs)), Image.BICUBIC)
        cy = lerp(py + 140, 150, r)
        if r > 0:
            glow = Image.new('L', (W, H), 0); ImageDraw.Draw(glow).ellipse((W / 2 - 200, cy + 40, W / 2 + 200, cy + ct.height - 40), fill=int(120 * r))
            gl = Image.new('RGBA', (W, H), (255, 70, 60, 255)); gl.putalpha(glow.filter(ImageFilter.GaussianBlur(50))); img.alpha_composite(gl)
            paste_a(img, ct, ((W - ct.width) / 2, cy), min(1, r * 3))
        img.alpha_composite(pc, (px, py))
        img = cover(img.convert('RGB'), lerp(1.0, 1.07, ease(t / 4.0)), W / 2, 640).convert('RGBA')
        text_at(img, 'g1', t, 0.3, 3.95, 1030, fade=0.4)
        if t > 3.75:  # 砂あらしで切り替え
            a = min(1, (t - 3.75) / 0.25); n = nrng.integers(0, 255, (H // 4, W // 4), dtype=np.uint8)
            nz = Image.fromarray(n).resize((W, H), Image.NEAREST).convert('RGBA'); nz.putalpha(int(255 * a)); img.alpha_composite(nz)
        return img
    tt = t - 4.0
    scr = TX['crt'].copy().convert('RGB')
    a = np.asarray(scr).astype(np.float32)
    if tt > 0.6: pass
    sub_a = ease((tt - 0.7) / 0.6)
    s2 = Image.fromarray(a.astype(np.uint8)).convert('RGBA')
    paste_a(s2, TX['crt_sub'], (0, 300), sub_a)
    if tt > 1.5 and int(tt * 2.5) % 2 == 0: s2.alpha_composite(TX['crt_press'], (0, 400))
    a = np.asarray(s2.convert('RGB')).astype(np.float32)
    on = ease(tt / 0.35); a *= on * (0.93 + 0.07 * math.sin(tt * 47))
    a[::3, :, :] *= 0.72  # 走査線
    n = nrng.normal(0, 1, (480, 640, 1)).astype(np.float32) * (18 + 60 * max(0, 1 - tt / 0.5)); a += n
    if tt < 0.5:  # 横ずれ
        for y0 in range(0, 480, 24):
            a[y0:y0 + 24] = np.roll(a[y0:y0 + 24], int(nrng.integers(-30, 30) * (1 - tt / 0.5)), axis=1)
    band = int((tt * 260) % 560) - 40; a[max(0, band):max(0, band + 30)] += 18
    scr = Image.fromarray(np.clip(a, 0, 255).astype(np.uint8)).convert('RGBA')
    img = Image.new('RGBA', (W, H), (4, 3, 6, 255))
    gl = Image.new('L', (W, H), 0); ImageDraw.Draw(gl).rectangle((40, 360, 680, 840), fill=int(110 * on))
    g = Image.new('RGBA', (W, H), (200, 60, 60, 255)); g.putalpha(gl.filter(ImageFilter.GaussianBlur(70))); img.alpha_composite(g)
    img.alpha_composite(scr, (40, 360)); img.alpha_composite(TX['tv'], (0, 320))
    img = cover(img.convert('RGB'), lerp(1.0, 1.03, ease(tt / 2.6)), W / 2, 600).convert('RGBA')
    return img
POSTER2 = rgba(S + '/v7/square_v2.png')  # 社長が確定した新しい告知ポスター(f2a217f5・副題「〜十三番目の鐘が鳴る夜〜」)
POSTER2_BG = blur_bg(POSTER2.convert('RGB'), 0.38, 26)
def sc8(t):  # 新しいポスターと開幕
    img = POSTER2_BG.copy().convert('RGBA')
    snow(img, t + 38, 0.8)
    p = ease(t / 0.9); s_ = lerp(1.06, 1.0, ease(t / 6.5)); w = int(680 * s_)
    pc = POSTER2.resize((w, w), Image.LANCZOS)
    sh = Image.new('L', (W, H), 0); ImageDraw.Draw(sh).rectangle(((W - w) / 2 + 6, 236, (W + w) / 2 + 6, 236 + w + 14), fill=200)
    shl = Image.new('RGBA', (W, H), (0, 0, 0, 255)); shl.putalpha(sh.filter(ImageFilter.GaussianBlur(18)).point(lambda v: int(v * p))); img.alpha_composite(shl)
    paste_a(img, pc, ((W - w) / 2, 230 - (w - 680) / 2), p)
    text_at(img, 's7', t, 1.3, 9.0, 960, fade=0.6)
    return img

# ── 事件簿のゲーム画面を挟む(第5版・r1126-045。360×640 を2倍で撮った実際の画面) ──
GS = S + '/v7/shots/'
GIMG = {k: rgb(GS + k + '.png') for k in ['c1-band', 'clue', 'a1', 'kime-atsu', 'kime-sora']}
def game_frame(im, t, dur):
    img = cover(im, lerp(1.0, 1.04, ease(t / dur)), W / 2, H / 2)
    a = np.asarray(img).astype(np.float32)
    a[::3] *= 0.9  # うすい走査線(ゲームの画面だと分かるように)
    if t < 0.28:  # 入るときの砂あらしと横ずれ
        k = 1 - t / 0.28
        for y0 in range(0, H, 40): a[y0:y0 + 40] = np.roll(a[y0:y0 + 40], int(nrng.integers(-50, 50) * k), axis=1)
        a = a * (1 - 0.6 * k) + nrng.integers(0, 255, (H // 4, W // 4, 1)).repeat(4, 0).repeat(4, 1).astype(np.float32) * 0.6 * k
    return Image.fromarray(np.clip(a, 0, 255).astype(np.uint8)).convert('RGBA')
def gshot(k, dur):
    return lambda t: game_frame(GIMG[k], t, dur)
def gkime(t):  # 決め台詞を2つ続けて(あいだは白く光る)
    im = GIMG['kime-atsu'] if t < 1.6 else GIMG['kime-sora']
    tt = t if t < 1.6 else t - 1.6
    f = game_frame(im, tt + (0.3 if t < 1.6 else 0), 1.6)
    if t < 0.12 or 1.6 <= t < 1.72:
        w = Image.new('RGBA', (W, H), (255, 255, 255, int(200 * (1 - ((t if t < 1.6 else t - 1.6) / 0.12))))); f.alpha_composite(w)
    return f
def gkime(t):  # 決め台詞を2つ続けて(あいだは白く光る)
    first = t < 2.2; tt = t if first else t - 2.2
    f = game_frame(GIMG['kime-atsu' if first else 'kime-sora'], tt + (0.3 if first else 0), 2.2)
    if tt < 0.12:
        w = Image.new('RGBA', (W, H), (255, 255, 255, int(200 * (1 - tt / 0.12)))); f.alpha_composite(w)
    return f
SCENES = [(0.0, 5.4, sc1), (5.0, 9.4, sc2), (9.0, 13.4, gshot('c1-band', 4.4)), (13.0, 20.0, sc3), (19.6, 26.0, sc4), (25.6, 33.0, sc5),
          (32.6, 37.2, gshot('clue', 4.6)), (36.8, 43.2, sc5b), (42.8, 47.6, sc6), (47.4, 52.6, sc7),
          (52.2, 58.2, gshot('a1', 6.0)), (57.8, 62.2, gkime), (61.8, 68.4, sc7b), (68.0, 74.5, sc8)]
T_BELL, T_HIT = 25.6 + 0.6, 47.4  # 柱時計の鐘で曲を切り替え / 名探偵はでサビ
T_DARK = T_BELL

def frame(t):
    act = [(a, b, f) for a, b, f in SCENES if a <= t < b]
    out = None
    for i, (a, b, f) in enumerate(act):
        im = np.asarray(f(t - a).convert('RGB')).astype(np.float32)
        if out is None: out = im
        else:
            x = ease((t - a) / (act[i - 1][1] - a)); out = out * (1 - x) + im * x
    out = out * VIG
    fade = min(1, t / 0.8, (DUR - t) / 0.8)
    if T_HIT <= t < T_HIT + 0.15: out = out + 255 * (1 - (t - T_HIT) / 0.15) * 0.7  # 曲の山で光る
    out = out * max(0, fade)
    return np.clip(out, 0, 255).astype(np.uint8)

if __name__ == '__main__':
    if sys.argv[3] == 'times': print(T_BELL, T_HIT, DUR); sys.exit()
    only = [float(x) for x in sys.argv[4].split(',')] if len(sys.argv) > 4 else None
    if only:
        for t in only: Image.fromarray(frame(t)).save(f'{OUT}_{t:05.1f}.jpg', quality=90)
        sys.exit()
    p = subprocess.Popen(['ffmpeg', '-v', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', f'{W}x{H}', '-r', str(FPS), '-i', '-',
                          '-c:v', 'libx264', '-preset', 'slow', '-crf', '21', '-pix_fmt', 'yuv420p', '-profile:v', 'high', OUT], stdin=subprocess.PIPE)
    n = int(DUR * FPS)
    for i in range(n):
        p.stdin.write(frame(i / FPS).tobytes())
        if i % 150 == 0: print(i, n, flush=True)
    p.stdin.close(); p.wait()

# クリスマスイベント「聖夜の名探偵」開催予告の予告編を1コマずつ描いて ffmpeg へ流す
import sys, math, random, subprocess
import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageEnhance

REPO, S, OUT = sys.argv[1], sys.argv[2], sys.argv[3]
W, H, FPS, DUR = 720, 1280, 30, 38.0
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

TX = {k: txt(k) for k in ['s1', 'band', 's2', 'card', 's3', 's3b', 's4', 's5', 's6a', 's6b', 's7']}

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
title_logo = square.crop((222, 0, 1052, 278)).convert('RGBA')
m = Image.new('L', title_logo.size, 0); ImageDraw.Draw(m).rounded_rectangle((14, 6, title_logo.width - 14, title_logo.height - 6), 40, fill=255)
title_logo.putalpha(m.filter(ImageFilter.GaussianBlur(10)))
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
    text_at(img, 's2', t, 0.8, 5.0, 90); return img
def sc4(t, dim=0):  # 14-19.4 みんなが集まる(横に流す)
    img = cover(pension_big, lerp(1.0, 1.06, t / 5.4), pension_big.width / 2, pension_big.height / 2).convert('RGBA')
    x = lerp(60, W - row_w - 60, ease(t / 5.4) * 0.85 + t / 5.4 * 0.15)
    img.alpha_composite(row, (int(x), H - 660 - 20))
    snow(img, t + 14, 0.6)
    d = ease((t - 3.3) / 1.6)
    if d > 0:
        a = np.asarray(img).astype(np.float32); g = a[:, :, :3].mean(axis=2, keepdims=True)
        a[:, :, :3] = (a[:, :, :3] * (1 - d * 0.8) + g * d * 0.8) * (1 - d * 0.55) + np.array([5, 10, 40]) * d * 0.3
        img = Image.fromarray(np.clip(a, 0, 255).astype(np.uint8), 'RGBA')
    text_at(img, 's3', t, 0.5, 3.3, 110); text_at(img, 's3b', t, 3.5, 5.4, 150, fade=0.6); return img
def sc5(t):  # 19-24.4 空になった箱
    img = box_bg.copy().convert('RGBA'); img.alpha_composite(box_layer)
    fl = 1.0
    if t < 0.9: fl = [0.2, 0.2, 0.8, 0.3, 1, 1, 0.6, 1, 1][int(t * 10)]
    img = cover(img.convert('RGB'), lerp(1.0, 1.13, ease(t / 5.4)), W / 2, 760)
    img = ImageEnhance.Brightness(img).enhance(fl).convert('RGBA')
    text_at(img, 's4', t, 1.0, 5.0, 180); return img
def sc6(t):  # 24-28.8 窓の外の黒い影
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
    img.alpha_composite(gl); img.alpha_composite(win_frost); img.alpha_composite(win_frame)
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
    snow(img, t + 28, 0.7, wind=60)
    for k, t0, y in [('s6a', 1.2, 110), ('s6b', 2.2, 260)]:
        if t >= t0:
            p = ease((t - t0) / 0.45); im = TX[k]
            s = lerp(1.25, 1.0, p); im2 = im.resize((int(im.width * s), int(im.height * s)), Image.BICUBIC)
            paste_a(img, im2, ((W - im2.width) / 2, y - (im2.height - im.height) / 2), min(1, p * 1.5) * min(1, (5.0 - t) / 0.4))
    return img
def sc8(t):  # 33.4-38 題字と開幕
    img = cover(title_bg, lerp(1.12, 1.02, ease(t / 4.6)), title_bg.width / 2, title_bg.height * 0.45)
    img = ImageEnhance.Brightness(img.filter(ImageFilter.GaussianBlur(6))).enhance(0.42).convert('RGBA')
    snow(img, t + 33, 1.0)
    p = ease(t / 0.9); s = lerp(1.15, 1.0, p)
    lg = title_logo.resize((int(title_logo.width * s), int(title_logo.height * s)), Image.BICUBIC)
    paste_a(img, lg, ((W - lg.width) / 2, 380 - (lg.height - title_logo.height) / 2), p)
    text_at(img, 's7', t, 1.3, 9.0, 720, fade=0.6)
    return img

SCENES = [(0.0, 5.4, sc1), (5.0, 9.4, sc2), (9.0, 14.4, sc3), (14.0, 19.4, sc4), (19.0, 24.4, sc5), (24.0, 28.8, sc6), (28.6, 33.8, sc7), (33.4, 38.0, sc8)]

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
    if 28.6 <= t < 28.75: out = out + 255 * (1 - (t - 28.6) / 0.15) * 0.7  # 曲の山で光る
    out = out * max(0, fade)
    return np.clip(out, 0, 255).astype(np.uint8)

if __name__ == '__main__':
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

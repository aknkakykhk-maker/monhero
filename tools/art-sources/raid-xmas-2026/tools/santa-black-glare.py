import sys, math
from PIL import Image, ImageDraw, ImageFilter
src, out, crop = sys.argv[1:4]
im = Image.open(src).convert('RGBA'); px = im.load()
base = im.copy(); bp = base.load()
SS = 4
eyes = [dict(cx=488, cy=471, rx=40, ry=40, inner=+1), dict(cx=644, cy=471, rx=41, ry=40, inner=-1)]
def lid(e, x):
    # 内側ほど下がる直線＋少しの丸み
    t = (x - e['cx']) / e['rx'] * e['inner']   # 内側で +1, 外側で -1
    y = e['cy'] - 4 + 21 * t
    y -= 4 * (1 - t * t)
    return y
# 1) まぶたより上の目を肌で塗る(柔らかい境目)
mask = Image.new('L', (im.width*SS, im.height*SS), 0); md = ImageDraw.Draw(mask)
for e in eyes:
    pts = []
    for i in range(0, 81):
        x = e['cx'] - e['rx'] - 4 + (2*e['rx'] + 8) * i / 80
        pts.append((x*SS, lid(e, x)*SS))
    pts += [((e['cx']+e['rx']+4)*SS, (e['cy']-e['ry']-8)*SS), ((e['cx']-e['rx']-4)*SS, (e['cy']-e['ry']-8)*SS)]
    # 目の楕円の内側だけに限る
    ell = Image.new('L', mask.size, 0); ImageDraw.Draw(ell).ellipse([(e['cx']-e['rx']-3)*SS, (e['cy']-e['ry']-3)*SS, (e['cx']+e['rx']+3)*SS, (e['cy']+e['ry']+3)*SS], fill=255)
    poly = Image.new('L', mask.size, 0); ImageDraw.Draw(poly).polygon(pts, fill=255)
    from PIL import ImageChops
    mask = ImageChops.lighter(mask, ImageChops.multiply(ell, poly))
mask = mask.resize(im.size, Image.LANCZOS).filter(ImageFilter.GaussianBlur(0.8))
mp = mask.load()
for e in eyes:
    for x in range(e['cx']-e['rx']-6, e['cx']+e['rx']+7):
        dxn = (x - e['cx']) / (e['rx'] + 3)
        if abs(dxn) >= 1: continue
        top = e['cy'] - (e['ry'] + 3) * math.sqrt(1 - dxn*dxn)
        sy = int(top - 7)
        c1 = bp[x, sy]; c2 = bp[x, sy-4]
        col = tuple((a+b)//2 for a, b in zip(c1, c2))
        for y in range(int(top)-4, e['cy']+5):
            a = mp[x, y] / 255
            if a <= 0: continue
            # 下へ行くほど少し影を足す
            k = 1 - 0.10 * max(0, min(1, (y - top) / 30))
            o = px[x, y]
            px[x, y] = tuple(int(o[i]*(1-a) + col[i]*k*a) for i in range(3)) + (o[3],)
# 2) まぶたの線(内側が太い・外側に少しはね)
L = Image.new('RGBA', (im.width*SS, im.height*SS), (0,0,0,0)); ld = ImageDraw.Draw(L); shadows = []
for e in eyes:
    n = 60
    xs = [e['cx'] - e['rx'] - 2 + (2*e['rx'] + 4) * i / n for i in range(n+1)]
    for i in range(n):
        x0, x1 = xs[i], xs[i+1]
        t = ((x0 - e['cx']) / e['rx']) * e['inner']
        w = 7.0 + 3.5 * (t + 1) / 2
        ld.line([(x0*SS, lid(e,x0)*SS), (x1*SS, lid(e,x1)*SS)], fill=(38,16,16,255), width=int(w*SS))
        ld.ellipse([x1*SS-w*SS/2, lid(e,x1)*SS-w*SS/2, x1*SS+w*SS/2, lid(e,x1)*SS+w*SS/2], fill=(38,16,16,255))
    # 外側のはね
    xo = e['cx'] - e['inner'] * (e['rx'] + 2); yo = lid(e, xo)
    ld.polygon([((xo + e['inner']*4)*SS, (yo-3)*SS), ((xo - e['inner']*9)*SS, (yo-7)*SS), ((xo + e['inner']*2)*SS, (yo+3)*SS)], fill=(38,16,16,255))
    # まぶたの下の影(目の楕円の内側だけ)
    Sh = Image.new('RGBA', L.size, (0,0,0,0)); sd = ImageDraw.Draw(Sh)
    for i in range(n):
        x0, x1 = xs[i], xs[i+1]
        sd.line([(x0*SS, (lid(e,x0)+6)*SS), (x1*SS, (lid(e,x1)+6)*SS)], fill=(70,10,10,160), width=9*SS)
    em = Image.new('L', L.size, 0); ImageDraw.Draw(em).ellipse([(e['cx']-e['rx']+5)*SS, (e['cy']-e['ry']+5)*SS, (e['cx']+e['rx']-5)*SS, (e['cy']+e['ry']-5)*SS], fill=255)
    from PIL import ImageChops
    Sh.putalpha(ImageChops.multiply(Sh.getchannel('A'), em))
    shadows.append(Sh)
for Sh in shadows: im.alpha_composite(Sh.resize(im.size, Image.LANCZOS))
L = L.resize(im.size, Image.LANCZOS)
im.alpha_composite(L)
im.save(out)
c = im.crop((380,330,770,590)); bg = Image.new('RGBA', c.size, (190,225,250,255)); bg.alpha_composite(c)
bg.resize((c.width*2, c.height*2), Image.LANCZOS).save(crop)

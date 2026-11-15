#!/usr/bin/env python3
# オリジナルモンスター(資料に技アイコンが無い子)の技の絵を作る(2026-11-15 社長 r1115-046「技アイコンが種類別にわけられてない。オリジナルモンスターこそしっかり作りこんで」)。
#   決まり(r1115-003): 資料の技アイコンにならう(同じ灰色の枠・オーラ色の地・ちから=黄/かしこさ=緑の単色の形に暗い縁)。
#   作り方: recipe.json の 技id → [種類, 土台, 地のオーラ色]
#     土台 sk-####   … 同じ種類の資料の絵から「形」だけを抜き出し、地をオーラ色の地に替え、技の種(ちから/かしこさ)の色に塗り替える
#     土台 new:<形>  … 資料に同じ種類が無い技。下の SHAPES の形を、資料と同じ描き方(単色+暗い縁+効果線)で描く
#   地(枠+オーラ色)は、資料のアイコン(123×124)を同じオーラ色ごとに重ね、形の画素を除いた中央値で作る(資料に「何も描いていない地」が無いため)
#   出力: monster-hero/images/success/skill/<技id>.png(96×96・減色PNG)。一覧への登録は tools/success/build-skill-icons.js が行う
#   使い方: python3 tools/success/skill-icons-original/make.py [--sheet <出力png>]  (--sheet で子ごとに並べた見本も作る)
import json, os, sys, colorsys
import numpy as np
from PIL import Image, ImageFilter, ImageDraw, ImageFont

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..'))
REF = os.path.join(ROOT, 'docs', 'reference', 'line-mf', 'monster-skill-data')
OUT = os.path.join(ROOT, 'monster-hero', 'images', 'success', 'skill')
TECHS = os.path.join(ROOT, 'monster-hero', 'data', 'assistant-masmon-techs.js')
SIZE = 96
W, H = 123, 124

def load_ref():
    info = {}
    for f in sorted(os.listdir(os.path.join(REF, 'monster-skills-by-blood'))):
        for s in json.load(open(os.path.join(REF, 'monster-skills-by-blood', f), encoding='utf8'))['skills']:
            info[s['skillId']] = s
    return info

def hsv_of(x):
    h = np.asarray(Image.fromarray(x).convert('HSV')).astype(float)
    return h[..., 0] * 360 / 255, h[..., 1] / 255, h[..., 2] / 255

def fig_guess(x, kind, aura):
    hue, sat, val = hsv_of(x)
    if kind == 'かしこさ': fig = (hue > 60) & (hue < 205) & (sat > 0.15)
    else: fig = (hue > 25) & (hue < 65) & (sat > 0.35)
    if aura != '黒': fig |= (val < 0.42)
    return np.asarray(Image.fromarray((fig * 255).astype('uint8')).filter(ImageFilter.MaxFilter(5))) > 0

def make_plates(info):
    g = {}
    for sid, s in info.items():
        p = os.path.join(REF, 'skill-icons', sid + '.png')
        if not os.path.exists(p): continue
        im = Image.open(p).convert('RGB')
        if im.size != (W, H): continue
        g.setdefault(s['aura'], []).append((s['skillType'], np.asarray(im)))
    plates = {}
    for a, lst in g.items():
        arrs = []
        for want in ('かしこさ', 'ちから'):
            if a == '緑' and want == 'かしこさ': continue  # 緑の地に緑の形は分けられない
            if a == '黄' and want == 'ちから': continue    # 黄の地に黄の形も同じ
            for t, x in lst:
                if t != want: continue
                y = x.astype(float).copy(); y[fig_guess(x, t, a)] = np.nan; arrs.append(y)
        with np.errstate(all='ignore'):
            import warnings; warnings.simplefilter('ignore')
            m = np.nanmedian(np.stack(arrs), axis=0)
        for c in range(3):
            ch = m[..., c]
            for yy in range(ch.shape[0]):
                row = ch[yy]; bad = np.isnan(row)
                if bad.all(): row[:] = ch[yy - 1] if yy > 0 else 200; continue
                if bad.any(): row[bad] = np.interp(np.where(bad)[0], np.where(~bad)[0], row[~bad])
        img = Image.fromarray(np.clip(m, 0, 255).astype('uint8'))
        sm = img.filter(ImageFilter.MedianFilter(11))
        mask = Image.new('L', img.size, 0); dr = ImageDraw.Draw(mask)
        dr.rectangle([8, 8, 114, 92], fill=255); dr.rectangle([40, 92, 114, 114], fill=255)
        img.paste(sm, (0, 0), mask)
        plates[a] = np.asarray(img).astype(float)
    return plates

def fill_holes(m):
    # 形の内側に閉じた穴(白いハイライトなど)を形に含める
    im = Image.fromarray((m * 255).astype('uint8')).convert('L')
    inv = Image.fromarray(((~m) * 255).astype('uint8')).copy()
    ImageDraw.floodfill(inv, (0, 0), 128)
    a = np.asarray(inv)
    return m | (a == 255)

def extract(x, plate):
    # 形の不透明度(地との差)と、地を除いた形の色
    d = np.abs(x - plate).max(axis=2)
    a = np.clip((d - 8) / 38, 0, 1)
    # 枠は地のもの(先に消しておかないと、枠の輪の内側がまるごと「穴」になる)
    a[:6, :] = 0; a[-8:, :] = 0; a[:, :5] = 0; a[:, -5:] = 0
    # 形に囲まれた所: 地と違う色(白いハイライトなど)なら形、地と同じ色なら地のまま(囲まれた地まで塗ると、元の地の色が残る)
    core = fill_holes(a > 0.6)
    a = np.where(core & (d > 14), 1.0, a)
    fg = plate + (x - plate) / np.maximum(a, 0.05)[..., None]
    return a, np.clip(fg, 0, 255)

def recolor(fg, a, to_kind):
    # ちから(黄・縁は茶) ⇔ かしこさ(緑・縁は暗い青緑)。色相だけを写し、明るさ・鮮やかさは元のまま
    out = fg.copy()
    hh, ww = a.shape
    flat = fg.reshape(-1, 3) / 255; af = a.reshape(-1)
    res = out.reshape(-1, 3)
    for i in np.where(af > 0)[0]:
        r, g, b = flat[i]
        h, s, v = colorsys.rgb_to_hsv(r, g, b)
        deg = h * 360
        if s < 0.12: continue
        if to_kind == 'かしこさ':
            nd = 110 + (45 - deg) * (55 / 20) if deg < 70 or deg > 300 else deg
            if deg > 300: nd = 165
            nd = min(175, max(85, nd))
        else:
            nd = 45 - (deg - 110) * (20 / 55) if 70 <= deg <= 200 else deg
            nd = min(58, max(18, nd))
        res[i] = np.array(colorsys.hsv_to_rgb((nd % 360) / 360, s, v)) * 255
    return res.reshape(fg.shape)

# ---- 資料に同じ種類が無い技の形(資料の描き方: 単色の面 + 暗い縁 + 効果線)。座標は 123×124 の上 ----
def _ink(kind):
    return ((122, 214, 116), (24, 92, 70)) if kind == 'かしこさ' else ((247, 205, 76), (110, 66, 10))

def shape_umbrella(d, k, S):
    fill, ink = _ink(k); w = int(3.2 * S)
    P = lambda pts: [(x * S, y * S) for x, y in pts]
    # 開いた傘(斜め)を振り下ろす + 衝撃
    d.pieslice([18 * S, 14 * S, 98 * S, 94 * S], 200, 340, fill=fill, outline=ink, width=w)
    for x in (38, 58, 78):
        d.line(P([(58, 54), (x, 22)]), fill=ink, width=int(2.4 * S))
    d.polygon(P([(18, 54), (31, 50), (44, 54), (58, 50), (72, 54), (85, 50), (98, 54), (58, 34)]), fill=fill)
    d.line(P([(18, 54), (31, 49), (44, 54), (58, 49), (72, 54), (85, 49), (98, 54)]), fill=ink, width=w, joint='curve')
    d.line(P([(58, 50), (58, 98)]), fill=ink, width=int(5 * S))
    d.line(P([(58, 50), (58, 97)]), fill=fill, width=int(2.4 * S))
    d.arc([46 * S, 88 * S, 60 * S, 106 * S], 0, 180, fill=ink, width=int(4.4 * S))
    for p in ([(88, 76), (104, 70)], [(90, 86), (108, 88)], [(86, 96), (100, 106)]):
        d.line(P(p), fill=ink, width=int(3 * S))
    d.polygon(P([(20, 96), (26, 84), (30, 96), (42, 92), (32, 102), (36, 112), (26, 104), (16, 110), (20, 100), (10, 96)]), fill=fill, outline=ink, width=int(2.4 * S))

def shape_cookie(d, k, S):
    fill, ink = _ink(k); w = int(3.2 * S)
    P = lambda pts: [(x * S, y * S) for x, y in pts]
    # 投げたクッキー(星形の型抜き)と苺 + 飛ぶ線
    for p in ([(14, 30), (40, 40)], [(10, 48), (36, 54)], [(16, 66), (38, 66)]):
        d.line(P(p), fill=ink, width=int(3 * S))
    import math
    cx, cy, R, r = 66, 52, 30, 19
    pts = []
    for i in range(16):
        ang = math.pi / 2 + i * math.pi / 8
        rr = R if i % 2 == 0 else r + 4
        pts.append((cx + rr * math.cos(ang), cy - rr * math.sin(ang)))
    d.polygon(P(pts), fill=fill, outline=ink, width=w)
    for x, y in ((58, 44), (74, 46), (64, 60), (76, 62), (54, 58)):
        d.ellipse([(x - 2.6) * S, (y - 2.6) * S, (x + 2.6) * S, (y + 2.6) * S], fill=ink)
    # 苺
    d.polygon(P([(88, 80), (108, 82), (100, 106)]), fill=fill, outline=ink, width=w)
    d.polygon(P([(88, 80), (96, 74), (100, 80), (106, 74), (108, 82)]), fill=ink)
    for x, y in ((96, 88), (102, 90), (99, 97)):
        d.ellipse([(x - 1.6) * S, (y - 1.6) * S, (x + 1.6) * S, (y + 1.6) * S], fill=ink)
    d.polygon(P([(26, 88), (30, 80), (34, 88), (42, 90), (34, 94), (32, 102), (28, 95), (20, 94), (26, 90)]), fill=fill, outline=ink, width=int(2.2 * S))

def shape_piano(d, k, S):
    fill, ink = _ink(k); w = int(3.2 * S)
    P = lambda pts: [(x * S, y * S) for x, y in pts]
    # 斜めの鍵盤から音符が舞い上がる
    base = [(14, 92), (64, 64), (80, 92), (30, 120)]
    d.polygon(P([(14, 92), (64, 64), (80, 92), (30, 114)]), fill=fill, outline=ink, width=w)
    for i in range(1, 6):
        t = i / 6
        x0, y0 = 14 + 50 * t, 92 - 28 * t
        d.line(P([(x0, y0), (x0 + 16 - 0 * t, y0 + 22 - 0)]), fill=ink, width=int(2.4 * S))
    for i in (1, 2, 4, 5):
        t = (i - 0.5) / 6 + 0.04
        x0, y0 = 14 + 50 * t, 92 - 28 * t
        d.polygon(P([(x0 - 3, y0 + 1), (x0 + 3, y0 - 2), (x0 + 11, y0 + 11), (x0 + 5, y0 + 14)]), fill=ink)
    def note(x, y, s, two=False):
        d.ellipse([(x - 7 * s) * S, (y - 5 * s) * S, (x + 7 * s) * S, (y + 5 * s) * S], fill=fill, outline=ink, width=int(2.6 * S))
        d.line(P([(x + 6 * s, y), (x + 6 * s, y - 26 * s)]), fill=ink, width=int(3.4 * S))
        if two:
            d.ellipse([(x + 22 * s - 7 * s) * S, (y - 6 * s - 5 * s) * S, (x + 22 * s + 7 * s) * S, (y - 6 * s + 5 * s) * S], fill=fill, outline=ink, width=int(2.6 * S))
            d.line(P([(x + 28 * s, y - 6 * s), (x + 28 * s, y - 30 * s)]), fill=ink, width=int(3.4 * S))
            d.polygon(P([(x + 6 * s, y - 26 * s), (x + 28 * s, y - 32 * s), (x + 28 * s, y - 25 * s), (x + 6 * s, y - 19 * s)]), fill=ink)
        else:
            d.line(P([(x + 6 * s, y - 26 * s), (x + 15 * s, y - 16 * s)]), fill=ink, width=int(3.4 * S))
    note(60, 50, 1.25, True)
    note(92, 30, 0.9)
    note(30, 40, 0.8)
    for p in ([(84, 60), (100, 52)], [(86, 72), (104, 70)], [(46, 24), (54, 14)]):
        d.line(P(p), fill=ink, width=int(2.6 * S))

def shape_tact(d, k, S):
    fill, ink = _ink(k); w = int(3.2 * S)
    P = lambda pts: [(x * S, y * S) for x, y in pts]
    import math
    # 振り上げたタクトの先から光の帯と音符
    d.arc([10 * S, 10 * S, 112 * S, 112 * S], 200, 300, fill=ink, width=int(9 * S))
    d.arc([12 * S, 12 * S, 110 * S, 110 * S], 202, 298, fill=fill, width=int(4.5 * S))
    d.line(P([(28, 104), (84, 40)]), fill=ink, width=int(7 * S))
    d.line(P([(29, 103), (83, 41)]), fill=fill, width=int(3 * S))
    d.ellipse([20 * S, 98 * S, 36 * S, 114 * S], fill=fill, outline=ink, width=w)
    cx, cy = 88, 36; pts = []
    for i in range(10):
        ang = math.pi / 2 + i * math.pi / 5
        rr = 20 if i % 2 == 0 else 8
        pts.append((cx + rr * math.cos(ang), cy - rr * math.sin(ang)))
    d.polygon(P(pts), fill=fill, outline=ink, width=w)
    for a0 in (-10, 20, 50):
        ang = math.radians(a0)
        d.line(P([(cx + 26 * math.cos(ang), cy + 26 * math.sin(ang)), (cx + 36 * math.cos(ang), cy + 36 * math.sin(ang))]), fill=ink, width=int(3 * S))
    x, y, s = 70, 84, 1.0
    d.ellipse([(x - 7) * S, (y - 5) * S, (x + 7) * S, (y + 5) * S], fill=fill, outline=ink, width=int(2.6 * S))
    d.line(P([(x + 6, y), (x + 6, y - 24)]), fill=ink, width=int(3.4 * S))
    d.line(P([(x + 6, y - 24), (x + 15, y - 14)]), fill=ink, width=int(3.4 * S))

def shape_hearts(d, k, S):
    fill, ink = _ink(k); w = int(3.2 * S)
    P = lambda pts: [(x * S, y * S) for x, y in pts]
    # 大小のハートがふわっと飛んでいく(メロメロ)
    def heart(cx, cy, r):
        d.ellipse([(cx - r) * S, (cy - r * 0.9) * S, (cx + r * 0.1) * S, (cy + r * 0.2) * S], fill=fill)
        d.ellipse([(cx - r * 0.1) * S, (cy - r * 0.9) * S, (cx + r) * S, (cy + r * 0.2) * S], fill=fill)
        d.polygon(P([(cx - r * 0.98, cy - r * 0.2), (cx + r * 0.98, cy - r * 0.2), (cx, cy + r * 1.1)]), fill=fill)
        d.arc([(cx - r) * S, (cy - r * 0.9) * S, (cx + r * 0.1) * S, (cy + r * 0.2) * S], 150, 360, fill=ink, width=w)
        d.arc([(cx - r * 0.1) * S, (cy - r * 0.9) * S, (cx + r) * S, (cy + r * 0.2) * S], 180, 30, fill=ink, width=w)
        d.line(P([(cx - r * 0.95, cy - r * 0.12), (cx, cy + r * 1.1), (cx + r * 0.95, cy - r * 0.12)]), fill=ink, width=w, joint='curve')
        d.ellipse([(cx - r * 0.62) * S, (cy - r * 0.6) * S, (cx - r * 0.32) * S, (cy - r * 0.3) * S], fill=(255, 255, 255))
    heart(54, 64, 26)
    heart(90, 32, 13)
    heart(26, 30, 10)
    for p in ([(84, 62), (102, 58)], [(82, 76), (100, 80)], [(80, 90), (94, 100)], [(16, 58), (24, 50)]):
        d.line(P(p), fill=ink, width=int(3 * S))

SHAPES = {'umbrella': shape_umbrella, 'cookie': shape_cookie, 'piano': shape_piano, 'tact': shape_tact, 'hearts': shape_hearts}

def draw_new(name, kind):
    S = 4
    lay = Image.new('RGBA', (W * S, H * S), (0, 0, 0, 0))
    SHAPES[name](ImageDraw.Draw(lay), kind, S)
    lay = lay.resize((W, H), Image.LANCZOS)
    arr = np.asarray(lay).astype(float)
    return arr[..., 3] / 255, arr[..., :3]

def load_techs():
    import subprocess
    js = subprocess.check_output(['node', '-e', "const {ASSISTANT_MASMON_TECHS:T}=require(process.argv[1]);const o={};for(const l of Object.values(T.species))for(const t of l)o[t.id]={name:t.name,kind:t.kind};console.log(JSON.stringify(o))", TECHS])
    return json.loads(js)

def build_one(tid, rec, techs, info, plates):
    kind = 'かしこさ' if techs[tid]['kind'] == 'wise' else 'ちから'
    base = rec[1]; aura = rec[2] if len(rec) > 2 else None
    if base.startswith('new:'):
        a, fg = draw_new(base[4:], kind)
        plate = plates[aura or '無']
    else:
        s = info[base]
        src = Image.open(os.path.join(REF, 'skill-icons', base + '.png')).convert('RGB')
        if src.size != (W, H):
            # 82×82 の絵(消費ガッツの数字入り)は地を替えられないので、そのまま使う(数字は画面の札がかぶさる)
            if aura and aura != s['aura']: raise SystemExit(f'{tid}: {base} は 82×82 なので地を替えられません')
            if s['skillType'] != kind: raise SystemExit(f'{tid}: {base} は 82×82 なので色を塗り替えられません')
            return src
        x = np.asarray(src).astype(float)
        a, fg = extract(x, plates[s['aura']])
        if s['skillType'] != kind: fg = recolor(fg, a, kind)
        plate = plates[aura or s['aura']]
    out = plate * (1 - a[..., None]) + fg * a[..., None]
    return Image.fromarray(np.clip(out, 0, 255).astype('uint8'))

def main():
    recipe = {k: v for k, v in json.load(open(os.path.join(os.path.dirname(__file__), 'recipe.json'), encoding='utf8')).items() if not k.startswith('_')}
    techs = load_techs(); info = load_ref(); plates = make_plates(info)
    # 同じ子の中で、別の技が同じ土台にならないこと
    seen = {}
    for tid, rec in recipe.items():
        sp = tid.split('_')[0]
        if tid not in techs: raise SystemExit(f'{tid} が技表に無い')
        key = (sp, rec[1])
        if key in seen: raise SystemExit(f'{tid} と {seen[key]} が同じ土台 {rec[1]}')
        seen[key] = tid
    os.makedirs(OUT, exist_ok=True)
    made = {}
    for tid, rec in recipe.items():
        im = build_one(tid, rec, techs, info, plates)
        made[tid] = im
        im.resize((SIZE, SIZE), Image.LANCZOS).quantize(colors=96, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE).save(os.path.join(OUT, tid + '.png'), optimize=True)
    total = sum(os.path.getsize(os.path.join(OUT, t + '.png')) for t in recipe)
    print(f'オリジナルの技の絵: {len(made)}枚({round(total / 1024)}KB)')
    if '--sheet' in sys.argv:
        sheet(sys.argv[sys.argv.index('--sheet') + 1], recipe, techs, made, info, [a for a in sys.argv if a.startswith('--only=')])

JP = {'pandora': 'パンドラ', 'eiki': 'エイキ', 'kenshimocchi': '剣士モッチー', 'melody': 'メロディー', 'kuromy': 'クロミー'}

def sheet(path, recipe, techs, made, info, only):
    font = '/usr/share/fonts/truetype/wqy/wqy-zenhei.ttc'
    F = ImageFont.truetype(font, 13) if os.path.exists(font) else ImageFont.load_default()
    F2 = ImageFont.truetype(font, 11) if os.path.exists(font) else ImageFont.load_default()
    want = only[0].split('=')[1].split(',') if only else None
    sps = []
    for tid in recipe:
        sp = tid.split('_')[0]
        if (want is None or sp in want) and sp not in sps: sps.append(sp)
    cols = 6; cw, ch = 168, 186
    rows = sum((len([t for t in recipe if t.startswith(sp + '_')]) + cols - 1) // cols for sp in sps)
    im = Image.new('RGB', (cols * cw + 20, rows * ch + 34 * len(sps) + 10), (250, 250, 252)); d = ImageDraw.Draw(im)
    y = 6
    for sp in sps:
        d.text((10, y + 6), JP.get(sp, sp) + '(オリジナルの技 18)', fill=(30, 30, 40), font=F); y += 34
        ts = [t for t in recipe if t.startswith(sp + '_')]
        for i, tid in enumerate(ts):
            x = 10 + (i % cols) * cw; yy = y + (i // cols) * ch
            icon = Image.open(os.path.join(OUT, tid + '.png')).convert('RGB').resize((112, 112), Image.LANCZOS)
            im.paste(icon, (x + 24, yy))
            rec = recipe[tid]
            d.text((x + 2, yy + 116), techs[tid]['name'][:12], fill=(20, 20, 30), font=F)
            base = rec[1] if rec[1].startswith('new:') else rec[1][3:] + ' ' + info[rec[1]]['name']
            d.text((x + 2, yy + 134), '種類: ' + rec[0], fill=(70, 70, 90), font=F2)
            d.text((x + 2, yy + 150), ('新しく描く(' + rec[1][4:] + ')') if rec[1].startswith('new:') else ('元: ' + base)[:16], fill=(70, 70, 90), font=F2)
            d.text((x + 2, yy + 166), ('ちから' if techs[tid]['kind'] == 'pow' else 'かしこさ') + (' / 地: ' + rec[2] if len(rec) > 2 else ''), fill=(70, 70, 90), font=F2)
        y += ((len(ts) + cols - 1) // cols) * ch
    im.save(path)

if __name__ == '__main__':
    main()

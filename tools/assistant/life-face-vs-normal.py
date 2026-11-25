# 着替えの顔アイコンを、ふだんの顔アイコンと表情ごとに上下2段で並べる(真ん中の十字線入り)。2026-11-25 r1125-040
# 使い方: python3 tools/assistant/life-face-vs-normal.py <出力.png> <服> <助手の接頭辞> [接頭辞 ...]
import sys, os
from PIL import Image, ImageDraw, ImageFont
A = 'monster-hero/images/assistant/'
EX = ['normal', 'happy', 'wink', 'surprise', 'troubled', 'angry', 'crying', 'excited', 'sleep']
NAMES = {'myua': 'みゅあ', 'kiki': 'きき', 'momosuke': 'ももすけ', 'atsu': 'あつ', 'kyuko': 'きゅうこ', 'sorashido': 'ソラシド', 'erubin': 'えるびん', 'dra': 'ドラ'}
FONT = '/usr/share/fonts/opentype/ipafont-gothic/ipag.ttf'
S, P, L = 120, 8, 120
out, outfit, who = sys.argv[1], sys.argv[2], sys.argv[3:]
font = ImageFont.truetype(FONT, 15) if os.path.exists(FONT) else ImageFont.load_default()
rows = [(n, d, lab) for n in who for d, lab in (('face', 'ふだん'), ('%s/face' % outfit, outfit))]
W = L + len(EX) * (S + P) + P; H = 30 + len(rows) * (S + P) + (len(who) - 1) * 12 + P
o = Image.new('RGB', (W, H), (236, 232, 224)); d = ImageDraw.Draw(o)
for j, e in enumerate(EX):
    d.text((L + j * (S + P), 8), e, fill=(0, 0, 0), font=font)
y = 30
for r, (n, sub, lab) in enumerate(rows):
    d.text((P, y + S / 2 - 8), '%s %s' % (NAMES.get(n, n), lab), fill=(0, 0, 0), font=font)
    for j, e in enumerate(EX):
        p = A + '%s/%s_%s.PNG' % (sub, n, e)
        if not os.path.exists(p):
            continue
        x = L + j * (S + P)
        im = Image.open(p).convert('RGBA').resize((S, S), Image.LANCZOS)
        bg = Image.new('RGBA', (S, S), (255, 250, 240, 255)); bg.alpha_composite(im)
        m = Image.new('L', (S, S), 0); ImageDraw.Draw(m).ellipse((0, 0, S - 1, S - 1), fill=255)
        o.paste(bg.convert('RGB'), (x, y), m)
        d.line((x, y + S / 2, x + S, y + S / 2), fill=(255, 0, 0)); d.line((x + S / 2, y, x + S / 2, y + S), fill=(255, 0, 0))
        for f in (0.4, 0.6):
            d.line((x, y + S * f, x + S, y + S * f), fill=(120, 120, 255))
    y += S + P + (12 if r % 2 == 1 else 0)
o.save(out); print(out)

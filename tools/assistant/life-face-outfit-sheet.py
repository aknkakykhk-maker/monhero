# 着替え1着ぶんの顔アイコンを、助手ごとに1行(8表情+寝顔)・右端に基準(ふだんの normal)で丸く並べる(r1125-040)。
# 新しい着替えを公開する前の点検に使う。手順と合格の目安は docs/progress/assistant-art/face-align/README.md「新しい着替えの点検」
# 使い方: python3 tools/assistant/life-face-outfit-sheet.py <出力.png> <服(例 santa)> [助手の接頭辞 ...]
#   --ref <git の版> を付けると、その版(例 origin/main)の絵で並べる(前後の比べに使う)
import sys, io, os, subprocess
from PIL import Image, ImageDraw, ImageFont
A = 'monster-hero/images/assistant/'
EX = ['normal', 'happy', 'wink', 'surprise', 'troubled', 'angry', 'crying', 'excited', 'sleep']
NAMES = {'myua': 'みゅあ', 'kiki': 'きき', 'momosuke': 'ももすけ', 'atsu': 'あつ', 'kyuko': 'きゅうこ', 'sorashido': 'ソラシド', 'erubin': 'えるびん', 'dra': 'ドラ'}
FONT = '/usr/share/fonts/opentype/ipafont-gothic/ipag.ttf'
S, P, L = 120, 8, 96
args = sys.argv[1:]
ref = None
if '--ref' in args:
    i = args.index('--ref'); ref = args[i + 1]; del args[i:i + 2]
out, outfit = args[0], args[1]
who = args[2:] or [n for n in NAMES if os.path.exists(A + '%s/face/%s_normal.PNG' % (outfit, n))]
font = ImageFont.truetype(FONT, 15) if os.path.exists(FONT) else ImageFont.load_default()

def get(path):
    if ref:
        try:
            return Image.open(io.BytesIO(subprocess.check_output(['git', 'show', '%s:%s' % (ref, A + path)], stderr=subprocess.DEVNULL)))
        except subprocess.CalledProcessError:
            return None
    return Image.open(A + path) if os.path.exists(A + path) else None

def circ(im):
    im = im.convert('RGBA').resize((S, S), Image.LANCZOS)
    bg = Image.new('RGBA', (S, S), (255, 250, 240, 255)); bg.alpha_composite(im)
    m = Image.new('L', (S, S), 0); ImageDraw.Draw(m).ellipse((0, 0, S - 1, S - 1), fill=255)
    return bg.convert('RGB'), m

W = L + (len(EX) + 1) * (S + P) + P
H = 30 + len(who) * (S + P + 4) + P
o = Image.new('RGB', (W, H), (236, 232, 224)); d = ImageDraw.Draw(o)
for j, e in enumerate(EX + ['基準:ふだん']):
    d.text((L + j * (S + P), 8), e, fill=(0, 0, 0), font=font)
for r, n in enumerate(who):
    y = 30 + r * (S + P + 4)
    d.text((P, y + S / 2 - 8), NAMES.get(n, n), fill=(0, 0, 0), font=font)
    for j, e in enumerate(EX + ['ref']):
        x = L + j * (S + P)
        im = Image.open(A + 'face/%s_normal.PNG' % n) if e == 'ref' else get('%s/face/%s_%s.PNG' % (outfit, n, e))
        if im is None:
            continue
        c, m = circ(im); o.paste(c, (x, y), m)
        for f, col in ((0.4, (120, 120, 255)), (0.5, (255, 0, 0)), (0.6, (120, 120, 255))):
            d.line((x, y + S * f, x + S, y + S * f), fill=col)
        d.line((x + S / 2, y, x + S / 2, y + S), fill=(255, 0, 0))
o.save(out)
print(out)

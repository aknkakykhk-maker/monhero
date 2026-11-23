# 撮った止め絵(shoot.js の出力先)を、縦・横・小さい機種ごとに1枚へ並べる
# python3 docs/progress/profile-renewal-b/make-cmp.py <shoot.js の出力先>
import sys, os
from PIL import Image, ImageDraw, ImageFont
SRC = sys.argv[1]; OUT = os.path.dirname(os.path.abspath(__file__))
FONT = ImageFont.truetype('/usr/share/fonts/opentype/ipafont-gothic/ipag.ttf', 18)
NAMES = [('1-top', '名刺のページ'), ('1-top-end', '名刺のページ(下まで)'), ('2-records', '記録'), ('3-assistant', '助手'), ('4-looks', '見た目'),
         ('5-genres', '思い出(ジャンル)'), ('6-genre-event', '期間イベント'), ('7-series', 'シリーズの中'), ('6-genre-assistant', '助手のお話'), ('6-genre-song', '曲のお話'), ('6-genre-play', '遊びの案内')]
for tag, cols in [('tate', 6), ('small', 6), ('yoko', 3)]:
    ims = [(Image.open(os.path.join(SRC, f'{tag}-{n}.png')).convert('RGB'), l) for n, l in NAMES]
    w, h = ims[0][0].size; rows = (len(ims) + cols - 1) // cols
    o = Image.new('RGB', (cols * (w + 10), rows * (h + 30)), 'white'); d = ImageDraw.Draw(o)
    for k, (im, label) in enumerate(ims):
        x, y = (k % cols) * (w + 10), (k // cols) * (h + 30)
        d.text((x + 4, y + 5), label, fill='black', font=FONT); o.paste(im, (x, y + 30))
    if tag == 'yoko': o = o.resize((o.width * 2 // 3, o.height * 2 // 3))
    o.save(os.path.join(OUT, f'b-{tag}.jpg'), quality=78)

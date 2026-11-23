# いまと案を並べた比べ絵を作る(shoot-now.js・shoot-mock.js のあとに python3 make-cmp.py)
from PIL import Image, ImageDraw, ImageFont
FONT = ImageFont.truetype('/usr/share/fonts/opentype/ipafont-gothic/ipag.ttf', 20)
L = ['いま', '案A タブで分ける', '案B 名刺＋扉', '案C 1列のまま整理']
def strip(files, out, grid=False, labels=L):
    ims = [Image.open(f).convert('RGB') for f in files]
    w, h = ims[0].size; cols = 2 if grid else len(ims); rows = (len(ims) + cols - 1) // cols
    o = Image.new('RGB', (cols * w + 12 * (cols - 1), rows * (h + 34)), 'white'); d = ImageDraw.Draw(o)
    for k, i in enumerate(ims):
        x, y = (k % cols) * (w + 12), (k // cols) * (h + 34)
        d.text((x + 6, y + 6), labels[k], fill='black', font=FONT); o.paste(i, (x, y + 34))
    o.save(out, quality=82)
strip(['now/profile-tate-1.png', 'shots/A-top-tate.png', 'shots/B-top-tate.png', 'shots/C-top-tate.png'], 'cmp-profile-tate.jpg')
strip(['now/replay-tate-groups.png', 'shots/A-replay-tate.png', 'shots/B-replay-tate.png', 'shots/C-replay-tate.png'], 'cmp-replay-tate.jpg')
strip(['now/profile-yoko-1.png', 'shots/A-top-yoko.png', 'shots/B-top-yoko.png', 'shots/C-top-yoko.png'], 'cmp-profile-yoko.jpg', True)
strip(['now/replay-yoko-groups.png', 'shots/A-replay-yoko.png', 'shots/B-replay-yoko.png', 'shots/C-replay-yoko.png'], 'cmp-replay-yoko.jpg', True)
strip(['shots/A-rec-tate.png', 'shots/B-song-tate.png'], 'cmp-extra-tate.jpg', labels=['案A 記録のタブ', '案B 曲のお話の中'])

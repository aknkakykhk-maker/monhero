#!/usr/bin/env python3
"""クリスマスの助手の絵の「前・後」の比べ絵を作る(助手部ナカヨシ・2026-11-28 r1126-095。社長に見せる絵)。

  python3 tools/assistant/life-santa-art-compare.py <前の撮影フォルダ> <後の撮影フォルダ> <出す先> --label "<撮った時刻・版>" [--base <前の版の git の名前>]
  撮影は tools/assistant/life-santa-art-shots.js(iPhone 縦・倍率3)。1人1枚(<出す先>/<助手>.jpg):
    1段目 モンヒロバトルの入口(立ち絵がいちばん大きく出る場面)の、立ち絵の枠を画面の画素のまま(前 | 後)
    2段目 会話の顔アイコン9表情(上が前・下が後。iPhone で 40px に出る大きさ×3 = 120px)
    3段目 全身の絵の顔あたり(助手ライフの紹介・全身で出る場面。前 | 後。同じ倍率)
    4段目 HOME と助手ライフの部屋の画面(前 | 後。3分の1)
"""
import io, os, subprocess, sys
from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
FONT = '/usr/share/fonts/opentype/ipafont-gothic/ipag.ttf'
A = 'monster-hero/images/assistant'
EXPR = ['normal', 'happy', 'wink', 'surprise', 'troubled', 'angry', 'crying', 'excited', 'sleep']
PREFIX = {'mua': 'myua'}
FULL = {'mua': 'mua_santa'}
NAME = {'mua': 'みゅあ', 'kiki': 'きき', 'momosuke': 'ももすけ', 'sorashido': 'ソラシド', 'atsu': 'あつ', 'kyuko': 'きゅうこ', 'erubin': 'えるびん', 'dra': 'ドラ'}
BG = (34, 26, 52)


def font(n):
    return ImageFont.truetype(FONT, n)


def git_image(ref, rel):
    for r in (rel, rel.rsplit('.', 1)[0] + '.png', rel.rsplit('.', 1)[0] + '.PNG', rel.rsplit('.', 1)[0] + '.webp'):
        try:
            return Image.open(io.BytesIO(subprocess.check_output(['git', 'show', '%s:%s' % (ref, r)], cwd=ROOT, stderr=subprocess.DEVNULL))).convert('RGBA')
        except subprocess.CalledProcessError:
            continue
    return None


def now_image(rel):
    for ext in ('webp', 'png', 'PNG'):
        p = os.path.join(ROOT, rel.rsplit('.', 1)[0] + '.' + ext)
        if os.path.exists(p):
            return Image.open(p).convert('RGBA')
    return None


def on_bg(im, size=None):
    if size:
        im = im.resize(size, Image.LANCZOS)
    c = Image.new('RGB', im.size, (70, 50, 110))
    c.paste(im, (0, 0), im)
    return c


def pair(a, b, gap=16, title=None):
    h = max(x.height for x in (a, b) if x)
    w = sum(x.width for x in (a, b) if x) + gap
    out = Image.new('RGB', (w, h), BG)
    x = 0
    for im in (a, b):
        if im:
            out.paste(im, (x, 0))
            x += im.width + gap
    return out


def head_crop(im, frac=(0.0, 0.0, 1.0, 0.3)):
    # 全身の絵の上の方(帽子から胸の上まで)。見えている体の範囲で切る
    bb = im.getchannel('A').point(lambda v: 255 if v > 40 else 0).getbbox()
    x0, y0, x1, y1 = bb
    h = y1 - y0
    return im.crop((x0, y0, x1, y0 + int(h * frac[3])))


def main():
    bdir, adir, out = sys.argv[1:4]
    label = sys.argv[sys.argv.index('--label') + 1] if '--label' in sys.argv else ''
    base = sys.argv[sys.argv.index('--base') + 1] if '--base' in sys.argv else 'origin/main'
    who = sys.argv[sys.argv.index('--who') + 1].split(',') if '--who' in sys.argv else ['mua', 'kiki', 'momosuke', 'sorashido', 'atsu', 'kyuko', 'erubin']
    os.makedirs(out, exist_ok=True)
    W = 2400
    for w in who:
        pre, full = PREFIX.get(w, w), FULL.get(w, '%s_santa' % w)
        rows = []
        # 1段目 バトルの入口(立ち絵の枠: 画面の上から y=180〜940 ほど。画面の画素のまま)
        bp, ap = os.path.join(bdir, '%s-4-battle-entry.png' % w), os.path.join(adir, '%s-4-battle-entry.png' % w)
        if os.path.exists(bp) and os.path.exists(ap):
            box = (40, 185, 1130, 935)
            rows.append(('モンヒロバトルの入口の立ち絵(iPhone の画面の画素のまま)', pair(Image.open(bp).convert('RGB').crop(box), Image.open(ap).convert('RGB').crop(box))))
        # 2段目 顔アイコン
        F = 120
        faces = Image.new('RGB', (len(EXPR) * (F + 8), 2 * F + 12), BG)
        for i, e in enumerate(EXPR):
            rel = '%s/santa/face/%s_%s.PNG' % (A, pre, e)
            o, n = git_image(base, rel), now_image(rel)
            if o:
                faces.paste(on_bg(o, (F, F)), (i * (F + 8), 0))
            if n:
                faces.paste(on_bg(n, (F, F)), (i * (F + 8), F + 12))
        rows.append(('会話の顔アイコン 9表情(上が前・下が後。iPhone で 40px の大きさ)', faces))
        # 3段目 全身の顔あたり(同じ高さにそろえる)
        rel = '%s/fullbody/%s__happy.png' % (A, full)
        o, n = git_image(base, rel), now_image(rel)
        if o and n:
            H = 900
            oc, nc = head_crop(o), head_crop(n)
            rows.append(('全身の絵の上の方(同じ大きさにそろえて。前は %d×%d・後は %d×%d の絵)' % (o.width, o.height, n.width, n.height),
                         pair(on_bg(oc, (int(oc.width * H / oc.height), H)), on_bg(nc, (int(nc.width * H / nc.height), H)))))
        # 4段目 HOME・部屋
        shots = []
        for d in (bdir, adir):
            for k in ('1-home', '2-life-room'):
                p = os.path.join(d, '%s-%s.png' % (w, k))
                if os.path.exists(p):
                    im = Image.open(p).convert('RGB')
                    shots.append(im.resize((im.width // 3, im.height // 3), Image.LANCZOS))
        if shots:
            row = Image.new('RGB', (sum(s.width + 16 for s in shots), max(s.height for s in shots)), BG)
            x = 0
            for s in shots:
                row.paste(s, (x, 0))
                x += s.width + 16
            rows.append(('HOME・助手ライフの部屋(左2枚が前・右2枚が後。3分の1)', row))
        # まとめる
        tf = font(34)
        hh = 120 + 34 * (len(label.split(' / ')) - 1) + sum(r.height + 70 for _, r in rows)
        ww = max(W, max(r.width for _, r in rows) + 40)
        sheet = Image.new('RGB', (ww, hh), BG)
        d = ImageDraw.Draw(sheet)
        d.text((20, 16), '%s のクリスマスの絵  前(左・上) / 後(右・下)' % NAME.get(w, w), font=font(46), fill=(255, 236, 180))
        for i, part in enumerate(label.split(' / ')):
            d.text((20, 72 + i * 34), part, font=font(28), fill=(200, 200, 220))
        y = 120 + 34 * (len(label.split(' / ')) - 1)
        for t, r in rows:
            d.text((20, y + 10), t, font=tf, fill=(255, 255, 255))
            sheet.paste(r, (20, y + 60))
            y += r.height + 70
        p = os.path.join(out, '%s.jpg' % w)
        sheet.save(p, quality=85)
        print(p, sheet.size, os.path.getsize(p) // 1024, 'KB')


if __name__ == '__main__':
    main()

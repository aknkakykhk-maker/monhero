#!/usr/bin/env python3
"""立ち絵(胸から上)を、元の絵の細かさのまま作り直す(2026-11-15 r1115-141 社長「全身画を大きく拡大して出す画面で絵が荒い」)。

life-stand-from-fullbody.py は、配信用の全身画(高さ約770px)の胸から上を切って2倍に拡大している。元の絵がもっと大きい助手は、
ここで全身画を元の絵から2倍の大きさ(枠 1024×1536)で作り、同じ範囲を拡大せずに切り出す。
  ・できる立ち絵は、今の立ち絵とまったく同じ大きさ(画面の置き方・絵の範囲の表はそのまま使える)。重さもほぼ同じ
  ・使えるのは、表情ごとに大きい元の絵(1表情1枚・人の高さ1500px 前後)がある助手だけ。いまは きき(ふだんの服 kiki__<表情>.png)だけ
  ・8表情のシート(1人ぶん高さ約770px)しか無い助手は、元の絵が足りないので作れない(社長に大きい原画をお願いする)
使い方: pip install imagequant && python3 tools/assistant/life-stand-hd.py [--only kiki]
作ったあと: node tools/card/card-art-box-build.js → node tools/build.js
"""
import importlib.util, os, sys, tempfile
from PIL import Image

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
HERE = os.path.dirname(os.path.abspath(__file__))


def load(name, file):
    spec = importlib.util.spec_from_file_location(name, os.path.join(HERE, file))
    m = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(m)
    return m


# キー … life-stand-from-fullbody.py の HEADS のキー。値 … life-fullbody-art.py の ART のキーの頭(<値>@<表情> が並んでいること)
HD = {'kiki': 'kiki'}


def run(key, art):
    lfa = load('lfa', 'life-fullbody-art.py')
    lsf = load('lsf', 'life-stand-from-fullbody.py')
    cfg = lsf.HEADS[key]
    tmp = tempfile.mkdtemp(prefix='stand-hd-')
    # ① 全身画を2倍の枠で作る(作り方は配信用の全身画と同じ。書き出し先だけ一時フォルダ)
    lfa.OUT = tmp
    lfa.OUT_W, lfa.OUT_H = lfa.OUT_W * 2, lfa.OUT_H * 2
    for e in lsf.EXPR:
        sys.argv = ['x', '--only', '%s__%s' % (art.replace(':', '_'), e)]
        lfa.main()
    name = cfg['name']
    hi = [Image.open(os.path.join(tmp, '%s__%s.png' % (name, e))).convert('RGBA') for e in lsf.EXPR]
    lo = [Image.open(os.path.join(lsf.FB, '%s__%s.png' % (name, e))).convert('RGBA') for e in lsf.EXPR]
    # ② 今の立ち絵と同じ範囲を、拡大せずに切る(配信用の全身画で決めた高さ H を、2倍の全身画の倍率 k で読みかえる)
    b0, l0 = lsf.bbox(hi[0]), lsf.bbox(lo[0])
    k = (b0[3] - b0[1]) / float(l0[3] - l0[1])
    H = (cfg['chin'] - l0[1]) / cfg['chin_frac'] * k
    tot = 0
    for e, im in zip(lsf.EXPR, hi):
        b = lsf.bbox(im)
        g = round(4 * k)
        c = im.crop((max(0, b[0] - g), max(0, b[1] - g), min(im.width, b[2] + g), min(im.height, int(round(b[1] + H)))))
        out = os.path.join(ROOT, 'monster-hero/images/assistant', cfg['stand'], '%s_%s.png' % (cfg['prefix'], e))
        # 今の立ち絵と1〜2px ちがうことがあるので、今の大きさへぴったりそろえる(画面の置き方・絵の範囲の表をそのまま使う)
        if os.path.exists(out):
            size = Image.open(out).size
            if c.size != size:
                c = c.resize(size, Image.LANCZOS)
        tot += lsf.save_png(c, out)
    print('%s: 元の絵から2倍で作った立ち絵(倍率 %.3f) 計%dKB' % (key, k, tot))


if __name__ == '__main__':
    only = sys.argv[sys.argv.index('--only') + 1] if '--only' in sys.argv else None
    for key, art in HD.items():
        if only and key != only:
            continue
        run(key, art)

#!/usr/bin/env python3
"""社長の「全身画の8表情」シート(1枚に4×2)を、8つに切って背景を抜き、
  ・紹介ページ用の全身画  monster-hero/images/assistant/fullbody/<名前>__<表情>.png
  ・場面で使う立ち絵(胸から上を切り出した絵)  monster-hero/images/assistant/<立ち絵の置き場>/<接頭辞>_<表情>.png
の2種類に仕上げる(助手部ナカヨシ)。

  シートの並び(社長): 上の段=通常・笑顔・ウィンク・驚き / 下の段=困り・怒り・泣き・大喜び
  =normal・happy・wink・surprise / troubled・angry・crying・excited
  使い方: python3 tools/assistant/life-expression-sheets.py [--stage cells|all] [--only <キー>]
  新しい助手・服のシートを足すときは、下の SHEETS に1つ足す。
"""
import importlib.util, os, sys
import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..'))
spec = importlib.util.spec_from_file_location('fb', os.path.join(HERE, 'life-fullbody-art.py'))
fb = importlib.util.module_from_spec(spec)
spec.loader.exec_module(fb)

SRC = os.path.join(ROOT, 'tools/art-sources/assistant-fullbody/received-v1')
EXPR = ['normal', 'happy', 'wink', 'surprise', 'troubled', 'angry', 'crying', 'excited']
SCRATCH = os.environ.get('SHEET_SCRATCH', '/tmp/sheet-scratch')

# key … 全身画の名前(fullbody/<name>__<表情>.png)。stand … 立ち絵の置き場(images/assistant/<stand>/<prefix>_<表情>.png)
# glow_cut … 元の絵が体のまわりに薄い光を描いているシート(体の芯から2画素より外の薄い所を消す)
# pockets … 背景の抜き残りの白い塊を抜く範囲(枠の中の座標。life-fullbody-art.py の AUTO_POCKETS と同じ見方)
# cells … 8つの枠 [x0, y0, x1, y1](シートの画素)。札のあるシートは札を避けて切る
SHEETS = {
    'mua': dict(file='mua-normal-8expressions-sheet.png', name='mua', stand='stand-normal', prefix='myua', bg='alpha', glow_cut=True,
                head=dict(top=50, eye=106, chin=143, chin_frac=0.425, above=None),
                cells=[[round(c * 295.5), r0, round((c + 1) * 295.5), r1] for r0, r1 in ((0, 580), (665, 1245)) for c in range(4)]),
    'mua:halloween': dict(file='mua-halloween-8expressions-sheet.png', name='mua_halloween', stand='stand-halloween', prefix='myua', bg='alpha', glow_cut=True,
                          head=dict(top=45, eye=100, chin=128, chin_frac=0.433, above=0.85),
                          cells=[[c * 384, r * 512, (c + 1) * 384, (r + 1) * 512] for r in range(2) for c in range(4)]),
    'mua:card-master': dict(file='mua-cardmaster-8expressions-sheet.png', name='mua_card-master', stand='stand-card-master', prefix='myua', bg='checker',
                            head=dict(top=50, eye=95, chin=122, chin_frac=0.295, above=0.75),
                            # 市松を抜いた残りの白いもや(髪の左右・左下の巻き毛のわき)。枠の中の座標。帽子・リボン・羽の白は入れない
                            pockets=[(98, 25, 150, 95), (228, 60, 262, 100), (75, 170, 100, 225)],
                            # 左の髪の細い毛のあいだの背景の白い粒(市松を抜くときに一緒に抜く範囲)。右の髪はつやの白とまぎれるので入れない
                            glow=[(90, 40, 145, 105)],
                            cells=[[c * 384, r * 512, (c + 1) * 384, (r + 1) * 512] for r in range(2) for c in range(4)]),
}


def key_checker(rgb, boxes=None):
    """白と灰色の市松模様(絵に描き込まれた背景)を、枠のふちから続く「ほぼ白で色味のない」所として抜く。"""
    a = rgb.astype(np.int16)
    mn, mx = a.min(2), a.max(2)
    light = (mn >= 240) & ((mx - mn) <= 3)  # 市松は無彩色(253前後と245前後の2色)。絵の白(耳の裏地・靴底)はわずかに色味があるので入れない
    h, w = light.shape
    v = mn  # 明るさの目安
    bg = np.zeros((h, w), bool)
    seen = np.zeros((h, w), bool)
    pend = []
    for y0 in range(h):
        for x0 in range(w):
            if not light[y0, x0] or seen[y0, x0]:
                continue
            comp, stack, touch = [], [(y0, x0)], False
            seen[y0, x0] = True
            while stack:
                y, x = stack.pop()
                comp.append((y, x))
                if y in (0, h - 1) or x in (0, w - 1):
                    touch = True
                for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    yy, xx = y + dy, x + dx
                    if 0 <= yy < h and 0 <= xx < w and light[yy, xx] and not seen[yy, xx]:
                        seen[yy, xx] = True
                        stack.append((yy, xx))
            # 枠のふちに続く白は背景。ふちに続かない白は、市松の2色(明るい253前後と暗い245前後)の両方を含む広い塊だけを背景にする
            #   (脚のあいだのすき間。耳の裏地や靴底の白は1色なので残る)
            cy, cx = comp[len(comp) // 2]
            if touch:
                keep_bg = True
            elif boxes and any(b[0] <= cx < b[2] and b[1] <= cy < b[3] for b in boxes):
                pend.append(comp)  # あとで、背景のすぐそばかを見る(下)
                keep_bg = False
            else:
                vals = np.array([v[y, x] for y, x in comp])
                lo = ((vals >= 242) & (vals <= 248)).mean()
                hi = (vals >= 252).mean()
                # 細い毛に囲まれた小さな市松も抜く(2026-11-12 窓口「左の髪に白いもやの塊が残る」。前は 100 画素以上だけ)
                keep_bg = len(comp) >= 24 and lo >= 0.1 and hi >= 0.1 and lo + hi >= 0.8
            if keep_bg:
                for y, x in comp:
                    bg[y, x] = True
    # 髪の細い毛のあいだにはさまれた背景の白(色味0〜3。髪は色味14以上): 範囲の中で、40画素以上あって明るさに市松の2色のばらつき
    #   (±2 以上)があるものだけ抜く。髪の束の中のつや(色味の少ない白)は小さく、明るさがそろっている(±1 前後)ので残る
    #   (2026-11-12 窓口「左の髪に白いもやの塊が残る」。実測: もや 114〜143画素・±2.6〜3.0 / つや 22画素以下・±1.2 以下)
    for comp in pend:
        P = np.array(comp)
        if len(P) >= 40 and v[P[:, 0], P[:, 1]].std() >= 2.0:
            bg[P[:, 0], P[:, 1]] = True
    # さかいの画素は、体の色と市松の混ざりとみて半透明に戻す(2026-11-12 窓口「髪のふちがブロック状にガタガタ」:
    #   前は境目の1画素も背景にして 0/255 で切っていたので、髪・羽・記号のふちが階段状になり、薄い毛と市松の混ざりが白いもやで残った)
    #   背景の色 B … まわり 9×9 の背景の画素の平均(市松の2色のならし)。体の色 F … さかいより内側の体の色を外へ広げたもの。
    #   さかいの画素 C の濃さ = (C−B) を (F−B) へ射影した長さ。体の色が背景に近い(白いリボン・羽の白)所は濃さ 1 のまま
    af = a.astype(np.float32)
    band = fb.dil(bg, 3) & ~bg
    k = 4
    bgf = bg.astype(np.float32)
    def box(m):
        c = np.cumsum(np.cumsum(np.pad(m, ((k + 1, k), (k + 1, k))), 0), 1)
        return c[2 * k + 1:, 2 * k + 1:] - c[:-2 * k - 1, 2 * k + 1:] - c[2 * k + 1:, :-2 * k - 1] + c[:-2 * k - 1, :-2 * k - 1]
    cnt = box(bgf)
    B = np.dstack([box(af[..., i] * bgf) for i in range(3)]) / np.maximum(cnt, 1)[..., None]
    B = np.where((cnt > 0)[..., None], B, 249.0)
    inner = ~bg & ~band
    F = fb.fill_colors(af, inner, 8)
    d = F - B
    dd = (d * d).sum(axis=2)
    al = ((af - B) * d).sum(axis=2) / np.maximum(dd, 1.0)
    al = np.clip(al, 0.0, 1.0)
    al = np.where(dd < 30.0 ** 2, 1.0, al)
    alpha = np.where(bg, 0.0, np.where(band, al * 255.0, 255.0))
    col = np.where(band[..., None], F, af)
    return np.dstack([np.clip(col, 0, 255), alpha]).astype(np.uint8)


def cut_cells(cfg):
    path = os.path.join(SRC, cfg['file'])
    im = Image.open(path)
    out = []
    for x0, y0, x1, y1 in cfg['cells']:
        c = im.crop((x0, y0, x1, y1))
        arr = np.array(c.convert('RGBA'))
        if cfg['bg'] == 'checker':
            arr = key_checker(arr[..., :3], cfg.get('glow'))
        out.append(fb.clean(None, min_frac=0.002, arr=arr, boxes=cfg.get('pockets'), glow_cut=cfg.get('glow_cut', False),
                            # 市松を抜いたふちは、背景に近い淡い色(羽・金色の髪)が背景の隣でいきなり不透明になるので、少しぼかす
                            soft=0.7 if cfg['bg'] == 'checker' else None))
    return out


def main():
    stage = sys.argv[sys.argv.index('--stage') + 1] if '--stage' in sys.argv else 'all'
    only = sys.argv[sys.argv.index('--only') + 1] if '--only' in sys.argv else None
    os.makedirs(SCRATCH, exist_ok=True)
    for key, cfg in SHEETS.items():
        if only and key != only:
            continue
        cells = cut_cells(cfg)
        if stage == 'cells':
            for e, c in zip(EXPR, cells):
                c.save(os.path.join(SCRATCH, '%s__%s.png' % (cfg['name'], e)))
            print(key, 'cells', [c.size for c in cells][:1])
            continue
        write_all(key, cfg, cells)


def bbox(im):
    a = np.array(im)[..., 3]
    ys, xs = np.nonzero(a > 40)
    return xs.min(), ys.min(), xs.max() + 1, ys.max() + 1


def smooth2x(im):
    """場面用の立ち絵は、元の絵が小さいので、先に2倍へ補間して輪郭をなめらかにする(細かさが増えるわけではない。
    画面に大きく出したとき、ブラウザの拡大でギザギザに見えるのを和らげるため)。"""
    from PIL import ImageFilter
    w, h = im.size
    rgb = im.convert('RGB').resize((w * 2, h * 2), Image.LANCZOS)
    a = im.getchannel('A').resize((w * 2, h * 2), Image.LANCZOS).filter(ImageFilter.GaussianBlur(0.8))
    out = rgb.convert('RGBA')
    out.putalpha(a)
    return out


def save_png(im, path):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    im.quantize(colors=256, method=Image.Quantize.FASTOCTREE, dither=Image.Dither.NONE).save(path, optimize=True)
    return os.path.getsize(path) // 1024


def write_all(key, cfg, cells):
    name, stand, prefix, head = cfg['name'], cfg['stand'], cfg['prefix'], cfg['head']
    boxes = [bbox(c) for c in cells]
    ux0, uy0 = min(b[0] for b in boxes), min(b[1] for b in boxes)
    ux1 = max(b[2] for b in boxes)
    # 立ち絵の切り方: 上は体のてっぺん(耳・帽子の先)・下は「顎の位置が今の立ち絵と同じ割合」になる所
    H = (head['chin'] - uy0) / head['chin_frac']
    bottom = int(round(uy0 + H))
    M = 4
    win = (max(0, ux0 - M), max(0, uy0 - M), min(cells[0].width, ux1 + M), min(cells[0].height, bottom))
    tot_full = tot_stand = 0
    for e, c in zip(EXPR, cells):
        # 1) 紹介ページ用の全身(life-fullbody-art.py と同じ作り方: 切り詰め・余白は少し・拡大はしない・ふちの半透明を残して減色)
        tot_full += fb.save(fb.fit(c), os.path.join(fb.OUT, '%s__%s.png' % (name, e))) // 1024
        # 2) 場面用の立ち絵(胸から上)
        st = smooth2x(c.crop(win))
        tot_stand += save_png(st, os.path.join(ROOT, 'monster-hero/images/assistant', stand, '%s_%s.png' % (prefix, e)))
    # 顔の表(normal の切り出しで測る。見えている体の上を0・下を1)
    st = cells[0].crop(win)
    bx0, by0, bx1, by1 = bbox(st)
    vh = by1 - by0
    f = lambda y: round((y - win[1] - by0) / vh, 4)
    cf = (head['chin'] - head['eye']) / vh
    m_ = round(cf / (0.82 * 0.1639), 3)
    row = dict(top=f(head['top']), eye=f(head['eye']), chin=f(head['chin']), m=m_)
    if head['above']:
        row['above'] = head['above']
    print('%s: 切り出し %s 見えている体 %dx%d / 全身 計%dKB・立ち絵 計%dKB' % (key, win, bx1 - bx0, vh, tot_full, tot_stand))
    print('   顔の表: %s' % row)


if __name__ == '__main__':
    main()

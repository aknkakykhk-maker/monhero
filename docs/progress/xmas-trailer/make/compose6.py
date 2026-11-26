# 予告編 第6版(作り直し・r1126-045 追記2): 事件簿のゲーム画面を中心に。部品は compose.py のものを使う
import sys, math, subprocess
import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageEnhance
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import compose as C
W, H, FPS = C.W, C.H, C.FPS
S = C.S
for k in ['k1', 'k2', 'k5', 'k6']: C.TX[k] = C.txt(k)
G = {k: C.rgb(S + '/v5/shots/' + k + '.png') for k in ['p-parcel', 'p-save', 'p-all', 'title', 'c1-band', 'a1', 'bell', 'dark', 'storm', 'clue', 'q3a', 'kime-atsu', 'kime-sora']}
ease, lerp = C.ease, C.lerp

def darken(img, lit):
    a = np.asarray(img.convert('RGB')).astype(np.float32)
    dark = a * np.array([0.2, 0.25, 0.42]) + np.array([2, 4, 14])
    b = a * lit + dark * (1 - lit)
    b[975:] = a[975:]  # 文字の窓は暗くしない
    return Image.fromarray(np.clip(b, 0, 255).astype(np.uint8)).convert('RGBA')

def game(k, dur, lit=None, snowy=False, bells=()):
    def f(t):
        sh = 0
        for b in bells:
            if 0 <= t - b < 0.3: sh = 8 * (1 - (t - b) / 0.3)
        im = G[k]
        img = C.cover(im, lerp(1.0, 1.05, ease(t / dur)), W / 2 + sh * math.sin(t * 90), H / 2).convert('RGBA')
        if lit is not None: img = darken(img, lit(t))
        if snowy:
            C.snow(img, t + 5, 1.0, wind=300); C.snow(img, t + 11, 1.0, wind=240)
        fr = C.game_frame(img.convert('RGB'), t, dur)
        for b in bells:
            if 0 <= t - b < 0.45:
                a = np.asarray(fr).astype(np.float32); a[:, :, :3] *= 1 + 0.18 * (1 - (t - b) / 0.45); fr = Image.fromarray(np.clip(a, 0, 255).astype(np.uint8), 'RGBA')
        return fr
    return f

def card(k, dur):
    def f(t):
        img = Image.new('RGBA', (W, H), (6, 7, 14, 255))
        C.snow(img, t + 50, 0.35, wind=30)
        C.text_at(img, k, t, 0.15, dur - 0.1, 530, fade=0.35, rise=10)
        return img
    return f

def flicker_off(t):  # 停電: ちらついて消える
    if t < 0.5: return 1.0
    if t < 1.1: return [1, .2, .8, .1, .5, .05][int((t - 0.5) / 0.1)]
    return 0.0

def crt(t): return C.sc7b(t + 3.0)  # 第4版の起動画面のカット(後半)

T_BELL, T_HIT = 22.6, 44.5
SCENES = [
    (0.0, 3.4, game('p-parcel', 3.4)), (3.1, 6.5, game('p-save', 3.4)), (6.2, 9.4, game('p-all', 3.2)),
    (9.1, 11.3, card('k1', 2.2)), (11.0, 14.6, game('title', 3.6)), (14.3, 17.5, game('c1-band', 3.2)),
    (17.2, 19.2, card('k2', 2.0)), (18.9, 22.6, game('a1', 3.7)),
    (22.3, 25.4, game('bell', 3.1, bells=(0.3, 1.3, 2.3))), (25.1, 28.3, game('dark', 3.2, lit=flicker_off)),
    (28.0, 31.4, game('storm', 3.4, lit=lambda t: 0.55, snowy=True)), (31.1, 34.9, lambda t: C.sc6(t + 0.2)),
    (34.6, 39.6, C.sc5b), (39.3, 41.1, game('clue', 1.8)), (40.8, 42.8, game('q3a', 2.0)),
    (42.5, 44.6, card('k5', 2.1)), (44.5, 46.3, game('kime-atsu', 1.8)), (46.3, 48.1, game('kime-sora', 1.8)),
    (47.8, 50.0, card('k6', 2.2)), (49.7, 52.6, crt), (52.3, 58.0, lambda t: C.sc8(t)),
]
DUR = 58.0

def frame(t):
    act = [(a, b, f) for a, b, f in SCENES if a <= t < b]
    out = None
    for i, (a, b, f) in enumerate(act):
        im = np.asarray(f(t - a).convert('RGB')).astype(np.float32)
        if out is None: out = im
        else:
            x = ease((t - a) / max(0.01, act[i - 1][1] - a)); out = out * (1 - x) + im * x
    out = out * C.VIG
    for th in (T_HIT, 46.3):
        if th <= t < th + 0.15: out = out + 255 * (1 - (t - th) / 0.15) * 0.75
    out = out * max(0, min(1, t / 0.5, (DUR - t) / 0.8))
    return np.clip(out, 0, 255).astype(np.uint8)

if __name__ == '__main__':
    OUT = sys.argv[3]
    if OUT == 'times': print(T_BELL, T_HIT, DUR); sys.exit()
    if len(sys.argv) > 4:
        for t in [float(x) for x in sys.argv[4].split(',')]: Image.fromarray(frame(t)).save(f'{OUT}_{t:05.1f}.jpg', quality=90)
        sys.exit()
    p = subprocess.Popen(['ffmpeg', '-v', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', f'{W}x{H}', '-r', str(FPS), '-i', '-',
                          '-c:v', 'libx264', '-preset', 'slow', '-crf', '21', '-pix_fmt', 'yuv420p', '-profile:v', 'high', OUT], stdin=subprocess.PIPE)
    n = int(DUR * FPS)
    for i in range(n):
        p.stdin.write(frame(i / FPS).tobytes())
        if i % 300 == 0: print(i, n, flush=True)
    p.stdin.close(); p.wait()

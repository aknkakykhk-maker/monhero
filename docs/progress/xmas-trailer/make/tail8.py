# 予告編 第7版の最後のポスターの場面(70.4秒〜)を、新しいポスター(v3)と新しい字幕で描き直して可逆の動画にする(r1126-063)
#   python3 -I tail8.py <リポジトリ> <作業フォルダ> <出力.mkv> <元の動画> <古いポスター> <新しいポスター>
#   70.4〜70.8秒は前の場面(古いテレビ)と重なるので、元のコマに「新旧のポスターの場面の差 × 重なりの割合 × 周辺減光」を足す。70.8秒からは全部描く
import sys, subprocess
import numpy as np
from PIL import Image
REPO, S, OUT, ORIG, OLD, NEW = sys.argv[1:7]
sys.argv = [sys.argv[0], REPO, S, OUT, 'x']
sys.path.insert(0, '.')
import compose7 as C
def poster(p):
    C.POSTER2 = Image.open(p).convert('RGBA'); C.POSTER2_BG = C.blur_bg(C.POSTER2.convert('RGB'), 0.38, 26)
A, B = 70.4, 70.8
n0, nB, n1 = round(A * C.FPS), round(B * C.FPS), round(C.DUR * C.FPS)
raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', ORIG, '-vf', f'select=between(n\\,{n0}\\,{nB - 1})', '-vsync', '0', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'],
                     capture_output=True, check=True).stdout
orig = np.frombuffer(raw, np.uint8).reshape(-1, C.H, C.W, 3).astype(np.float32)
assert orig.shape[0] == nB - n0, orig.shape
p = subprocess.Popen(['ffmpeg', '-v', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', f'{C.W}x{C.H}', '-r', str(C.FPS), '-i', '-',
                      '-c:v', 'ffv1', OUT], stdin=subprocess.PIPE)
for i in range(n0, nB):
    t = i / C.FPS
    poster(OLD); old = np.asarray(C.sc8(t - A).convert('RGB')).astype(np.float32)
    poster(NEW); new = np.asarray(C.sc8(t - A).convert('RGB')).astype(np.float32)
    x = C.ease((t - A) / (B - A))
    p.stdin.write(np.clip(orig[i - n0] + x * (new - old) * C.VIG, 0, 255).astype(np.uint8).tobytes())
poster(NEW)
for i in range(nB, n1):
    p.stdin.write(C.frame(i / C.FPS).tobytes())
p.stdin.close(); p.wait(); print(n0, nB, n1)

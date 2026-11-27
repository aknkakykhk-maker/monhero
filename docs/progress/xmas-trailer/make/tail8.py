# 予告編 第7版の最後(71.0秒〜)だけを、新しい字幕で描き直して可逆の動画にする
import sys, subprocess
sys.argv = [sys.argv[0], sys.argv[1], sys.argv[2], sys.argv[3], 'x']
sys.path.insert(0, '.')
import compose7 as C
T0 = 71.0
n0, n1 = round(T0 * C.FPS), round(C.DUR * C.FPS)
p = subprocess.Popen(['ffmpeg', '-v', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', f'{C.W}x{C.H}', '-r', str(C.FPS), '-i', '-',
                      '-c:v', 'ffv1', C.OUT], stdin=subprocess.PIPE)
for i in range(n0, n1):
    p.stdin.write(C.frame(i / C.FPS).tobytes())
p.stdin.close(); p.wait(); print(n0, n1)

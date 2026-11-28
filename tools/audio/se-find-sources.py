#!/usr/bin/env python3
# 効果音の素材庫(r1126-121): 曲の中から、効果音の素材になりそうな場所を数値で探す。
#
#   python3 -I tools/audio/se-find-sources.py monster-hero/audio/bgm-xxx.mp3 [--top 5]
#
# 出すもの(どれも「秒」と、その強さの値。上位だけ):
#   crash  … シンバルの一打(高い音域が急に立ち上がり、ゆっくり消える)。ガラス・逆再生のふくらみの素材
#   low    … 低い打撃(低音域だけが急に立ち上がり、直前が静か)。倒れる・扉が閉まるの素材
#   bell   … 鐘・ベルらしい一打(立ち上がりのあと、少ない高さの音が長く残る)。不吉な鐘の素材
#   calm   … 静かで音の高さがはっきりした3秒(ピアノ・弦の和音)。恋の場面・夢のような響きの素材
# 読むだけ。ファイルは何も書かない。ここで見つけた秒を tools/audio/se-library.json に書き、
# tools/audio/se-library-build.py で切り出して加工する。
import subprocess, sys
import numpy as np

SR = 22050
N = 2048
HOP = 512


def decode(path):
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', path, '-ac', '1', '-ar', str(SR), '-f', 'f32le', '-'],
                         stdout=subprocess.PIPE, check=True).stdout
    return np.frombuffer(raw, dtype=np.float32)


def main():
    args = sys.argv[1:]
    top = 5
    if '--top' in args:
        i = args.index('--top'); top = int(args[i + 1]); del args[i:i + 2]
    path = args[0]
    x = decode(path)
    frames = 1 + (len(x) - N) // HOP
    win = np.hanning(N).astype(np.float32)
    idx = np.arange(N)[None, :] + HOP * np.arange(frames)[:, None]
    spec = np.abs(np.fft.rfft(x[idx] * win, axis=1)) + 1e-9
    freqs = np.fft.rfftfreq(N, 1 / SR)
    band = lambda lo, hi: spec[:, (freqs >= lo) & (freqs < hi)].sum(axis=1)
    lowE, midE, hiE = band(30, 160), band(160, 3000), band(5000, 11000)
    tot = spec.sum(axis=1)
    flat = np.exp(np.log(spec).mean(axis=1)) / spec.mean(axis=1)  # 1 に近いほど雑音、0 に近いほど音の高さがはっきり
    t = np.arange(frames) * HOP / SR
    fps = SR / HOP
    s = lambda sec: int(sec * fps)
    rms = np.sqrt((x[idx] ** 2).mean(axis=1))
    med = np.median(rms) + 1e-9
    out = {'crash': [], 'low': [], 'bell': [], 'calm': []}
    for f in range(s(0.4), frames - s(2.5)):
        pre = slice(f - s(0.3), f - 1)
        # シンバル: 高い音域が前の3倍以上に立ち上がり、1秒後もまだ 1/4 以上残る(すぐ切れるハイハットは除く)
        if hiE[f] > 3 * hiE[pre].mean() and hiE[f] >= hiE[f - 1] and hiE[f + s(1.0)] > 0.25 * hiE[f]:
            out['crash'].append((hiE[f] / (hiE[pre].mean() + 1e-9) * (hiE[f + s(1.0)] / hiE[f]), t[f]))
        # 低い打撃: 低音域が前の4倍以上、直前の全体が静か
        if lowE[f] > 4 * lowE[pre].mean() and lowE[f] >= lowE[f - 1] and rms[pre].mean() < 1.2 * med:
            out['low'].append((lowE[f] / (lowE[pre].mean() + 1e-9) / (rms[pre].mean() / med + 0.2), t[f]))
        # 鐘: 全体が立ち上がり、2秒後まで音の高さがはっきりしたまま(flat が小さい)ゆっくり減る
        if tot[f] > 2.5 * tot[pre].mean() and tot[f] >= tot[f - 1]:
            tail = slice(f + s(0.3), f + s(2.0))
            dec = tot[f + s(2.0)] / tot[f]
            if 0.08 < dec < 0.7 and flat[tail].mean() < 0.08:
                out['bell'].append(((1 - flat[tail].mean() * 10) * tot[f] / (tot[pre].mean() + 1e-9), t[f]))
    # 静かな和音: 3秒の窓で、音量が曲の中央値より小さめ・音の高さがはっきり・打楽器(高音域の立ち上がり)が少ない
    w = s(3.0)
    for f in range(0, frames - w, s(0.5)):
        sl = slice(f, f + w)
        r = rms[sl].mean() / med
        if 0.15 < r < 0.9 and flat[sl].mean() < 0.05:
            perc = (np.diff(hiE[sl]) > hiE[sl][:-1] * 2).sum()
            out['calm'].append(((0.05 - flat[sl].mean()) * 100 / (1 + perc), t[f]))
    for k, v in out.items():
        v.sort(reverse=True)
        picked = []
        for score, sec in v:
            if all(abs(sec - p) > 2.0 for _, p in picked):
                picked.append((score, sec))
            if len(picked) >= top:
                break
        print(k.ljust(6), ' '.join('%.2fs(%.1f)' % (p, sc) for sc, p in picked) or '-')


if __name__ == '__main__':
    main()

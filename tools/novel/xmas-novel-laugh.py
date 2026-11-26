#!/usr/bin/env python3
# クリスマスのノベル(台帳 r1126-022)のバッドエンドの「シルエットの笑い」の効果音を、その場で合成して作る。
#   python3 tools/novel/xmas-novel-laugh.py   → monster-hero/audio/se-xmas-novel-laugh.mp3
# 外から音源を持ってこない(窓口 2026-11-26)。低い男の声の「ハ…ハハハ…」を、声帯のパルス+母音「あ」の共鳴(フォルマント)+息の音で作り、
# 低いオクターブ下の声とノイズを少し重ね、残響をかけて不気味にする。乱数は固定なので、何度作っても同じ音になる
import os, subprocess, tempfile, wave
import numpy as np

SR = 44100
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
OUT = os.path.join(ROOT, 'monster-hero', 'audio', 'se-xmas-novel-laugh.mp3')
rng = np.random.default_rng(1226)


def resonator(x, freq, bw):
    """2極の共鳴フィルタ(フォルマント1つ)"""
    r = np.exp(-np.pi * bw / SR)
    th = 2 * np.pi * freq / SR
    a1, a2 = -2 * r * np.cos(th), r * r
    g = 1 - r
    y = np.zeros_like(x)
    y1 = y2 = 0.0
    for i in range(len(x)):
        v = g * x[i] - a1 * y1 - a2 * y2
        y[i] = v
        y2, y1 = y1, v
    return y


def syllable(f0, dur, breath=0.07):
    """「ハ」1つ: 息の音のあと、声の「あ」。f0 は高さ(Hz)"""
    n = int(dur * SR)
    t = np.arange(n) / SR
    # 声帯のパルス(のこぎり波に近い形・高さを少し揺らす)
    vib = 1 + 0.012 * np.sin(2 * np.pi * 5.5 * t) + 0.004 * rng.standard_normal(n).cumsum() / np.sqrt(n)
    phase = np.cumsum(f0 * vib / SR)
    src = 2 * (phase % 1.0) - 1
    src = src - 0.6 * np.roll(src, 1)
    # 母音「あ」(低い男の声)のフォルマント
    v = resonator(src, 650, 90) * 1.0 + resonator(src, 1080, 110) * 0.55 + resonator(src, 2450, 160) * 0.22
    # 息の音(頭の「h」)
    hn = int(breath * SR)
    h = np.zeros(n)
    h[:hn] = rng.standard_normal(hn) * np.linspace(0.0, 1.0, hn) ** 0.5
    h = resonator(h, 1200, 900) * 0.6
    # 包絡: 息 → 声が立ち上がって、すっと切れる
    env = np.clip((t - breath * 0.6) / 0.025, 0, 1) * np.exp(-np.clip(t - dur * 0.45, 0, None) * 9)
    return h + v * env


def place(buf, sig, at):
    i = int(at * SR)
    buf[i:i + len(sig)] += sig[:max(0, len(buf) - i)]


total = 3.4
buf = np.zeros(int(total * SR))
# 「……ふ、ふふ」(低く短く)→ 間 → 「あははは」(だんだん速く、高さは下がる)
plan = [(0.05, 96, 0.20), (0.42, 92, 0.18), (0.62, 90, 0.18),
        (1.25, 118, 0.24), (1.52, 112, 0.22), (1.76, 106, 0.21), (1.98, 100, 0.20), (2.18, 94, 0.21), (2.40, 86, 0.34)]
for at, f0, dur in plan:
    place(buf, syllable(f0, dur), at)
    place(buf, 0.45 * syllable(f0 / 2, dur, breath=0.02), at + 0.006)  # 1オクターブ下の声を重ねて、人でないような低さに

# 薄いノイズ(古いゲーム機の音)
buf += 0.015 * rng.standard_normal(len(buf))
# 残響(遅れをいくつか重ねる)
out = buf.copy()
for d, g in [(0.031, 0.35), (0.047, 0.3), (0.071, 0.25), (0.113, 0.2), (0.173, 0.14), (0.251, 0.1)]:
    k = int(d * SR)
    out[k:] += g * buf[:-k]
# 頭と終わりをなめらかに・大きさを -1 dBFS(ピーク)にそろえる
fade = int(0.3 * SR)
out[-fade:] *= np.linspace(1, 0, fade)
out *= (10 ** (-1 / 20)) / max(1e-9, np.max(np.abs(out)))

with tempfile.TemporaryDirectory() as tmp:
    wav = os.path.join(tmp, 'laugh.wav')
    with wave.open(wav, 'wb') as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes((out * 32767).astype('<i2').tobytes())
    # 44.1kHz / 128kbps ステレオ mp3・タグなし(audio/CLAUDE.md の形)
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', wav, '-ac', '2', '-ar', '44100', '-b:a', '128k', '-map_metadata', '-1', '-vn', OUT], check=True)
print(f'書いた: {os.path.relpath(OUT, ROOT)} ({os.path.getsize(OUT) // 1024}KB)')

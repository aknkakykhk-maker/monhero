#!/usr/bin/env python3
# 効果音の素材庫(台帳 r1126-121・2026-11-28 社長「流用は OK。無いやつはそういう作りで SE 作成して保管しといてほしい。今後も使えるように」)
#
#   python3 -I tools/audio/se-library-build.py            … 全部作り直す
#   python3 -I tools/audio/se-library-build.py --only bell-toll-omen,laugh-echo
#   python3 -I tools/audio/se-library-build.py --check    … 作り直さず、一覧(JSON)とファイルが合っているかだけ見る
#
# 【何をするか】
#   tools/audio/se-library.json に書いた手順どおりに、ゲームの曲(monster-hero/audio/*.mp3)から素材を切り出し、
#   加工(音程・引き延ばし・逆再生・こもらせる・残響・こだま・重ね)して、tools/art-sources/se-library/<id>.mp3 に書く。
#   同じ JSON から同じ音ができる(残響の雑音は id ごとに決まった種から作る)。
# 【置き場】
#   tools/art-sources/ は配信しない場所。monster-hero/audio/ の下に置くと、遊ぶ人の事前ダウンロード
#   (tools/build-asset-manifest.js が audio/ の下を全部拾う)に、まだ使わない音が混ざるため。
#   ゲームで使うときは、その音だけを monster-hero/audio/ へコピーして node tools/build.js を通す。
# 【音量と音質】(docs/rules/ASSETS.md・r1115-143)
#   かける倍率は曲と同じく min(目標LUFS - いまのLUFS, -1 - いまの真のピーク) の1つだけで、圧縮はしない。
#   目標は効果音の既定 -18 LUFS(曲の -14 より少し下。場面の音量はゲームの効果音の音量で決まる)。
#   0.4 秒より短い音は LUFS が測れないので、真のピーク -1 dBTP にだけ合わせる。
#   書き出しは 44.1kHz ステレオ mp3 192kbps(元の曲は 128kbps。加工のあと同じ 128kbps で書くと、もう一段こもるため上げている)。
#   タグは落とす(-map_metadata -1)。
# 【使う道具】ffmpeg(rubberband・highpass/lowpass・ebur128・libmp3lame)と numpy だけ。
import json, os, subprocess, sys, tempfile, hashlib, zlib
import numpy as np

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
SPEC = os.path.join(ROOT, 'tools', 'audio', 'se-library.json')
OUT_DIR = os.path.join(ROOT, 'tools', 'art-sources', 'se-library')
SR = 44100
PCM = ['-f', 'f32le', '-ar', str(SR), '-ac', '2']


def ff_filter(x, af):
    """numpy (n,2) を ffmpeg のフィルタに通して戻す"""
    p = subprocess.run(['ffmpeg', '-v', 'error', *PCM, '-i', '-', '-af', af, *PCM, '-'],
                       input=x.astype(np.float32).tobytes(), stdout=subprocess.PIPE, check=True)
    return np.frombuffer(p.stdout, dtype=np.float32).reshape(-1, 2).copy()


def load(src, at, dur):
    path = os.path.join(ROOT, src)
    args = ['ffmpeg', '-v', 'error', '-ss', str(at)]
    if dur:
        args += ['-t', str(dur)]
    p = subprocess.run(args + ['-i', path, *PCM, '-'], stdout=subprocess.PIPE, check=True)
    return np.frombuffer(p.stdout, dtype=np.float32).reshape(-1, 2).copy()


def fade(x, fin, fout):
    n = len(x)
    if fin:
        k = min(n, int(fin * SR)); x[:k] *= np.linspace(0, 1, k)[:, None] ** 2
    if fout:
        k = min(n, int(fout * SR)); x[n - k:] *= np.linspace(1, 0, k)[:, None] ** 2
    return x


def reverb(x, opt, seed):
    """減っていく雑音を響きにした残響。左右で別の雑音にして広がりを出す(決まった種なので毎回同じ)"""
    sec = float(opt.get('sec', 2.0)); wet = float(opt.get('wet', 0.4)); pre = float(opt.get('pre', 0.02))
    tone = float(opt.get('tone', 5000))
    rng = np.random.default_rng(seed)
    n = int(sec * SR)
    t = np.arange(n) / SR
    env = np.exp(-6.9 * t / sec)  # sec で -60dB
    ir = rng.standard_normal((n, 2)).astype(np.float32) * env[:, None]
    ir = ff_filter(ir, 'lowpass=f=%g:p=2' % tone)
    ir = np.concatenate([np.zeros((int(pre * SR), 2), np.float32), ir])
    ir /= np.sqrt((ir ** 2).sum(axis=0, keepdims=True)) + 1e-9
    m = len(x) + len(ir) - 1
    L = 1 << (m - 1).bit_length()
    y = np.stack([np.fft.irfft(np.fft.rfft(x[:, c], L) * np.fft.rfft(ir[:, c], L), L)[:m] for c in range(2)], axis=1)
    dry = np.concatenate([x, np.zeros((m - len(x), 2), np.float32)])
    return (dry * (1 - wet) + y * wet * 2.2).astype(np.float32)


def echo(x, opt):
    d = int(float(opt.get('delay', 0.3)) * SR); g = float(opt.get('decay', 0.5)); n = int(opt.get('taps', 3))
    lp = opt.get('tone')
    y = np.concatenate([x, np.zeros((d * n, 2), np.float32)])
    tap = x.copy()
    for k in range(1, n + 1):
        if lp:
            tap = ff_filter(tap, 'lowpass=f=%g' % lp)
        side = k % 2  # こだまを左右へ交互に少し寄せる
        w = np.array([1.0, 0.7] if side else [0.7, 1.0], np.float32)
        y[d * k:d * k + len(tap)] += tap * (g ** k) * w
    return y


def mix(base, other, at, gain_db):
    off = int(at * SR)
    n = max(len(base), off + len(other))
    y = np.zeros((n, 2), np.float32)
    y[:len(base)] += base
    y[off:off + len(other)] += other * (10 ** (gain_db / 20))
    return y


def run_steps(x, steps, seed):
    for st in steps:
        op, v = next(iter(st.items()))
        if op == 'hp':
            x = ff_filter(x, ','.join(['highpass=f=%g' % v] * 2))
        elif op == 'lp':
            x = ff_filter(x, ','.join(['lowpass=f=%g' % v] * 2))
        elif op == 'bp':
            x = ff_filter(x, 'highpass=f=%g,highpass=f=%g,lowpass=f=%g,lowpass=f=%g' % (v[0], v[0], v[1], v[1]))
        elif op == 'eq':  # [周波数, 幅(オクターブ), dB]
            x = ff_filter(x, 'equalizer=f=%g:t=o:w=%g:g=%g' % tuple(v))
        elif op == 'pitch':  # 半音。長さは変えない(rubberband)
            x = ff_filter(x, 'rubberband=pitch=%.6f:pitchq=quality' % (2 ** (v / 12)))
        elif op == 'stretch':  # 何倍の長さにするか。音程は変えない
            x = ff_filter(x, 'rubberband=tempo=%.6f:pitchq=quality:window=long' % (1 / v))
        elif op == 'tape':  # テープを遅くしたように、音程と長さを一緒に変える(半音)
            r = 2 ** (v / 12)
            x = ff_filter(x, 'asetrate=%d,aresample=%d' % (round(SR * r), SR))
        elif op == 'reverse':
            x = x[::-1].copy()
        elif op == 'reverb':
            x = reverb(x, v, seed)
        elif op == 'echo':
            x = echo(x, v)
        elif op == 'fade':
            x = fade(x, v[0], v[1])
        elif op == 'trim':
            a = int(v[0] * SR); b = int(v[1] * SR) if v[1] else len(x)
            x = x[a:b].copy()
        elif op == 'pad':
            x = np.concatenate([x, np.zeros((int(v * SR), 2), np.float32)])
        elif op == 'gain':
            x = x * (10 ** (v / 20))
        elif op == 'mono':
            x = np.repeat(x.mean(axis=1, keepdims=True), 2, axis=1)
        elif op == 'width':  # 0=まんなか 1=そのまま
            m = x.mean(axis=1, keepdims=True); x = m + (x - m) * v
        elif op == 'layer':
            y = make(v['from'], seed + 7 * (1 + int(v.get('at', 0) * 1000)))
            x = mix(x, y, float(v.get('at', 0)), float(v.get('gain', 0)))
        elif op == 'repeat':  # 同じ音を間をあけて重ねる {"times":3,"every":2.4,"decay":-3}
            base = x.copy(); y = x
            for k in range(1, int(v['times'])):
                y = mix(y, base, k * float(v['every']), k * float(v.get('decay', 0)))
            x = y
        else:
            raise SystemExit('知らない手順: %s' % op)
    return x


def make(src, seed):
    x = load(src['src'], src.get('at', 0), src.get('dur'))
    return run_steps(x, src.get('steps', []), seed)


def measure(x):
    p = subprocess.run(['ffmpeg', '-nostats', '-hide_banner', *PCM, '-i', '-', '-af', 'ebur128=peak=true', '-f', 'null', '-'],
                       input=x.astype(np.float32).tobytes(), stderr=subprocess.PIPE, stdout=subprocess.DEVNULL, check=True)
    txt = p.stderr.decode('utf-8', 'replace')
    tail = txt[txt.rfind('Summary:'):]
    I = TP = None
    for line in tail.splitlines():
        s = line.strip()
        if s.startswith('I:'):
            I = float(s.split()[1])
        if s.startswith('Peak:'):
            TP = float(s.split()[1])
    return I, TP


def trim_tail(x, db=-70):
    a = np.abs(x).max(axis=1)
    nz = np.where(a > 10 ** (db / 20))[0]
    return x[:nz[-1] + int(0.02 * SR)] if len(nz) else x


def trim_head(x, db=-60):
    # 逆再生の物は頭がほぼ無音になるので、聞こえ始める所(-60dB)から始める
    a = np.abs(x).max(axis=1)
    nz = np.where(a > 10 ** (db / 20))[0]
    return x[max(0, nz[0] - int(0.01 * SR)):] if len(nz) else x


def build(entry):
    seed = zlib.crc32(entry['id'].encode())
    x = make(entry, seed)
    x = trim_head(trim_tail(x))
    x = fade(x, 0.002, min(0.05, len(x) / SR / 4))
    target = float(entry.get('lufs', -18))
    I, TP = measure(x)
    short = len(x) / SR < 0.4 or I is None or I < -69
    g = (-1 - TP) if short else min(target - I, -1 - TP)
    x = x * (10 ** (g / 20))
    I2, TP2 = measure(x)
    out = os.path.join(OUT_DIR, entry['id'] + '.mp3')
    subprocess.run(['ffmpeg', '-v', 'error', '-y', *PCM, '-i', '-', '-map_metadata', '-1', '-c:a', 'libmp3lame', '-b:a', '192k', out],
                   input=x.astype(np.float32).tobytes(), check=True)
    return {'sec': round(len(x) / SR, 2), 'lufs': None if short else round(I2, 1), 'tp': round(TP2, 1), 'bytes': os.path.getsize(out)}


def main():
    args = sys.argv[1:]
    spec = json.load(open(SPEC, encoding='utf-8'))
    entries = spec['sounds']
    if '--check' in args:
        bad = [e['id'] for e in entries if not os.path.exists(os.path.join(OUT_DIR, e['id'] + '.mp3'))]
        extra = sorted(set(f[:-4] for f in os.listdir(OUT_DIR) if f.endswith('.mp3')) - set(e['id'] for e in entries))
        print('OK' if not bad and not extra else 'NG', '一覧 %d 件' % len(entries),
              ('/ ファイルが無い: ' + ','.join(bad)) if bad else '', ('/ 一覧に無いファイル: ' + ','.join(extra)) if extra else '')
        sys.exit(1 if bad or extra else 0)
    only = None
    if '--only' in args:
        only = set(args[args.index('--only') + 1].split(','))
    os.makedirs(OUT_DIR, exist_ok=True)
    idx_path = os.path.join(OUT_DIR, 'index.json')
    idx = json.load(open(idx_path, encoding='utf-8')) if os.path.exists(idx_path) else {}
    for e in entries:
        if only and e['id'] not in only:
            continue
        r = build(e)
        idx[e['id']] = r
        print('%-24s %5.2fs  %s LUFS  TP %s  %d KB' % (e['id'], r['sec'], r['lufs'], r['tp'], r['bytes'] // 1024))
    # 出来上がりの長さ・大きさ(資料と試し聴きのページを作る tools/audio/se-library-page.js が読む)
    idx = {k: idx[k] for k in [e['id'] for e in entries] if k in idx}
    with open(idx_path, 'w', encoding='utf-8') as f:
        f.write(json.dumps(idx, ensure_ascii=False, indent=1) + '\n')


if __name__ == '__main__':
    main()

#!/usr/bin/env python3
# 声だけの音源から「言葉の頭(歌の拍)・音の高さ・伸ばしの長さ」を取り出す(2026-11-22・ビート・台帳 r1119-096/105)。
#
#   python3 -I tools/audio/vocal-notes.py <声だけの wav> <元の mp3> <出力 json>
#
# 【なぜ要るか】
#   Beyond the Same Sky はダブルボーカルの曲で、社長「2人の歌い分けを気持ちよく」。
#   歌っている側の手が言葉の頭を取る譜面にするには、伴奏の混ざった解析(tools/mode/authoring/*-v3-audio.json・作り直さない)
#   ではなく、声だけの立ち上がりが要る。声だけの音源は audio-separator(UVR-MDX-NET-Voc_FT.onnx)で作る。
# 【時刻のずれ】
#   mp3 の読み方の違い(エンコーダーの頭の空き)で、ここで読む時刻と譜面の時刻がずれることがある。
#   元の mp3 の立ち上がりも取り、譜面側(解析ファイルの onsets)と合わせるための値として一緒に書き出す(合わせるのは JS 側)。
import sys, json
import numpy as np
import librosa

SR = 16000
HOP = 128  # 8ms

def onsets_of(y):
    env = librosa.onset.onset_strength(y=y, sr=SR, hop_length=HOP)
    on = librosa.onset.onset_detect(onset_envelope=env, sr=SR, hop_length=HOP, backtrack=False, units='frames',
                                    pre_max=3, post_max=3, pre_avg=10, post_avg=10, delta=0.04, wait=6)
    return env, on

def main():
    vocal_path, mix_path, out_path = sys.argv[1:4]
    y, _ = librosa.load(vocal_path, sr=SR, mono=True)
    mix, _ = librosa.load(mix_path, sr=SR, mono=True)
    env, on = onsets_of(y)
    rms = librosa.feature.rms(y=y, frame_length=1024, hop_length=HOP)[0]
    f0, voiced, prob = librosa.pyin(y, fmin=80, fmax=1100, sr=SR, frame_length=1024, hop_length=HOP)
    n = len(f0)
    loud = rms > max(0.01, np.percentile(rms, 35) * 0.8)
    sing = np.logical_and(voiced.astype(bool), loud[:n] if len(loud) >= n else np.pad(loud, (0, n - len(loud))))
    emax = float(np.percentile(env, 99)) or 1.0
    # 言葉の区切り: ①声が切れる ②高さが0.8半音以上動いて4フレーム続く(なめらかに歌う所の言葉の頭) ③強い立ち上がり(同じ高さの言い直し)
    from scipy.signal import medfilt
    R = min(n, len(rms))
    on_set = set(int(i) for i in on)
    emax = float(np.percentile(env, 99)) or 1.0
    midi = np.where(sing[:R], librosa.hz_to_midi(np.nan_to_num(f0[:R], nan=1.0)), np.nan)
    sm = midi.copy()
    ok = ~np.isnan(midi)
    sm[ok] = medfilt(np.nan_to_num(midi, nan=0.0), 5)[ok]
    segs = []
    i = 0
    from_cut = False
    while i < R:
        if not ok[i]:
            i += 1
            continue
        st = i
        ref = float(np.median(sm[i:i + 4][ok[i:i + 4]]))
        j, miss, cut = i + 1, 0, None
        while j < R:
            if not ok[j]:
                miss += 1
                if miss >= 3:
                    break
                j += 1
                continue
            miss = 0
            if j - st >= 6 and all(ok[j:j + 4]) and all(abs(sm[j:j + 4] - ref) >= 0.8):
                cut = j
                break
            if j - st >= 8 and j in on_set and float(env[j]) / emax >= 0.35:
                cut = j
                break
            j += 1
        end = cut if cut is not None else j - miss
        if end - st >= 6:
            seg = sm[st:end][ok[st:end]]
            segs.append((st, end, float(np.median(seg[:12])), float(np.median(seg[-8:])), from_cut and st not in on_set))
        i = cut if cut is not None else j
        from_cut = cut is not None
    notes = []
    for st, end, semi, semi_end, legato in segs:
        e = float(env[max(0, st - 3):st + 4].max()) / emax
        notes.append({
            'timeMs': round(st * HOP * 1000 / SR),
            'durMs': round((end - st) * HOP * 1000 / SR),
            'semitone': round(semi, 2),
            'semitoneEnd': round(semi_end, 2),
            'strength': round(min(1.0, max(e, 0.3 if legato else e, 0.45 if end - st >= 50 else 0)), 3),
            'legato': bool(legato),
            'rms': round(float(rms[min(st + 4, len(rms) - 1)]), 4),
        })
    _, mon = onsets_of(mix)
    mix_onsets = [round(int(i) * HOP * 1000 / SR) for i in mon]
    json.dump({'source': vocal_path.split('/')[-1], 'sr': SR, 'hop': HOP, 'notes': notes, 'mixOnsetsMs': mix_onsets},
              open(out_path, 'w'), ensure_ascii=False)
    print(f'{len(notes)} 個の言葉の頭・元の音の立ち上がり {len(mix_onsets)} 個 → {out_path}')

if __name__ == '__main__':
    main()

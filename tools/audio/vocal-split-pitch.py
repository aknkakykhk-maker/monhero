# 歌い分け(ダブルボーカル)を声の高さで分ける試み(2026-11-22・台帳 r1119-096 追記)。
#   python3 tools/audio/vocal-split-pitch.py <音源.mp3> <出力.json>
#   python3 tools/audio/vocal-split-pitch.py <声だけの wav> <出力.json> --stem   声の分離器(audio-separator・UVR-MDX-NET-Voc_FT)で抜き出した声を測る(1 を飛ばす)
# 1) 真ん中(L+R)の音から、繰り返す伴奏を似たコマの中央値で引いて声を浮かせる(REPET-SIM・librosa の例と同じ作り)
# 2) 浮かせた声の高さ(pYIN・80〜1000Hz)をコマごとに測る
# 3) 声のあるコマを「区間」(無声が0.25秒以上で切る)にまとめ、区間ごとの高さの中央値・音色(MFCC)を出す
# 解析ファイル(tools/mode/authoring/*-v3-audio.json)は読まない・作り直さない。結果は別のファイルへ書くだけ。
import sys, json, numpy as np, librosa
src, out = sys.argv[1], sys.argv[2]
SR, HOP = 22050, 256
y, _ = librosa.load(src, sr=SR, mono=False)
mid = y.mean(axis=0); side = (y[0]-y[1])/2
if '--stem' in sys.argv:
  voc = mid
else:
  S_full, phase = librosa.magphase(librosa.stft(mid, n_fft=2048, hop_length=HOP))
  S_filter = librosa.decompose.nn_filter(S_full, aggregate=np.median, metric='cosine', width=int(librosa.time_to_frames(2, sr=SR, hop_length=HOP)))
  S_filter = np.minimum(S_full, S_filter)
  mask_v = librosa.util.softmask(S_full - S_filter, 10*S_filter, power=2)
  voc = librosa.istft(mask_v*S_full*phase, hop_length=HOP, length=len(mid))
f0, vflag, vprob = librosa.pyin(voc, fmin=65, fmax=1000, sr=SR, frame_length=2048, hop_length=HOP)
rms = librosa.feature.rms(y=voc, frame_length=2048, hop_length=HOP)[0]
mf = librosa.feature.mfcc(y=voc, sr=SR, n_mfcc=13, hop_length=HOP)
cent = librosa.feature.spectral_centroid(y=voc, sr=SR, hop_length=HOP)[0]
n = min(len(f0), len(rms), mf.shape[1])
t = librosa.frames_to_time(np.arange(n), sr=SR, hop_length=HOP)
thr = np.percentile(rms[:n], 40) if '--stem' not in sys.argv else 0.02*rms[:n].max()
ok = vflag[:n] & (vprob[:n] > 0.35) & (rms[:n] > thr)
json.dump({'sr':SR,'hop':HOP,'t':np.round(t,3).tolist(),'f0':[None if not ok[i] or np.isnan(f0[i]) else round(float(f0[i]),1) for i in range(n)],
  'prob':np.round(vprob[:n],2).tolist(),'rms':np.round(rms[:n]/rms[:n].max(),3).tolist(),'cent':np.round(cent[:n]).tolist(),
  'mfcc':np.round(mf[:, :n].T,1).tolist()}, open(out,'w'))
print('frames', n, 'voiced', int(ok.sum()))

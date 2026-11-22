# 抜き出した声(audio-separator の Vocals)を、声の主の埋め込み(resemblyzer・重みはパッケージに同梱)で2人に分ける(2026-11-22・台帳 r1119-096 追記)。
#   python3 tools/audio/vocal-split-speaker.py <声だけの wav> <高さの json(vocal-split-pitch.py --stem の出力)> <出力.json>
# 0.5秒ごと(窓1.2秒)に、声のある所だけ埋め込みを作り、2つの組へ分ける(k-means)。組の名前は高さの中央が低い方を「低」(男声らしい)、高い方を「高」(女声らしい)にする。
# 出力: 0.5秒ごとの {t, who:'低'|'高'|null, conf, pitch}。歌詞の区切りへの当てはめは vocal-lyrics-align.js がする
import sys, json, numpy as np, librosa
from resemblyzer import VoiceEncoder, preprocess_wav
wavp, pitchp, out = sys.argv[1], sys.argv[2], sys.argv[3]
SR = 16000
y, _ = librosa.load(wavp, sr=SR, mono=True)
P = json.load(open(pitchp)); pt = np.array(P['t']); pf = np.array([np.nan if x is None else x for x in P['f0']])
pm = 12*np.log2(pf/440)+69
enc = VoiceEncoder('cpu', verbose=False)
STEP, WIN = 0.5, 1.2
rows, embs = [], []
for s in np.arange(0, len(y)/SR - WIN, STEP):
  sel = (pt >= s) & (pt < s + WIN); v = pm[sel]; v = v[~np.isnan(v)]
  voiced = len(v) / max(1, sel.sum())
  row = {'t': round(float(s + WIN/2), 2), 'voiced': round(float(voiced), 2), 'pitch': round(float(np.median(v)), 1) if len(v) else None}
  if voiced >= 0.35:
    seg = y[int(s*SR):int((s+WIN)*SR)]
    embs.append(enc.embed_utterance(seg)); row['e'] = len(embs) - 1
  rows.append(row)
E = np.array(embs)
rng = np.random.default_rng(3); best = None
for _ in range(20):
  c = E[rng.choice(len(E), 2, replace=False)]
  for _ in range(100):
    d = E @ c.T; lab = np.argmax(d, 1)
    nc = np.array([E[lab == k].mean(0) for k in range(2)]); nc /= np.linalg.norm(nc, axis=1, keepdims=True)
    if np.allclose(nc, c): break
    c = nc
  score = (E @ c.T).max(1).sum()
  if best is None or score > best[0]: best = (score, lab, c)
_, lab, c = best
d = E @ c.T
pit = [np.nanmedian([r['pitch'] for r in rows if 'e' in r and lab[r['e']] == k and r['pitch'] is not None]) for k in range(2)]
low = int(np.argmin(pit))
for r in rows:
  if 'e' in r:
    k = lab[r['e']]; r['who'] = '低' if k == low else '高'; r['conf'] = round(float(d[r['e'], k] - d[r['e'], 1-k]), 3); del r['e']
  else: r['who'] = None
json.dump({'centerSim': round(float(c[0] @ c[1]), 3), 'pitchLow': round(float(pit[low]), 1), 'pitchHigh': round(float(pit[1-low]), 1), 'rows': rows}, open(out, 'w'), ensure_ascii=False)
print('組の中心の近さ', round(float(c[0] @ c[1]), 3), '低の高さ', round(float(pit[low]), 1), '高の高さ', round(float(pit[1-low]), 1), '低', int((lab == low).sum()), '高', int((lab != low).sum()))

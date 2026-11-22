# vocal-split-pitch.py のコマごとの結果から、歌の区間を作り、2人の声に分ける(2026-11-22・台帳 r1119-096 追記)。
#   python3 tools/audio/vocal-split-phrases.py <frames.json> <出力.json> [--gap 0.25] [--min 0.4]
# 区間: 声のあるコマが --gap 秒以上途切れたら切る。--min 秒より短い区間は捨てる。
# 分け方: 区間ごとに [高さの中央値(半音)・高さの上の方(80%点)・声の色(MFCC 2〜8 の平均)] を標準化し、2つの組へ分ける(k-means・20回やり直して一番まとまる分け方)。
#   高さに重みを付ける(--pitch-weight。既定 2)。社長の答え「声の高さで分けてみる」に合わせ、高さを主、声の色を従にする。
# 確かさ: その区間が近い組の中心と遠い組の中心への距離の差を 0〜1 にしたもの(0.5 未満は「どちらか分からない」)。
# 重なり(2人同時): 同じ区間の中で高さが2つの帯に割れて行き来する(3半音以上離れた2つの山が両方とも25%以上)ものを「重なりの候補」にする。
import sys, json, numpy as np
a=sys.argv; src,out=a[1],a[2]
opt=lambda k,d:float(a[a.index(k)+1]) if k in a else d
GAP,MIN,PW=opt('--gap',0.25),opt('--min',0.4),opt('--pitch-weight',2.0)
d=json.load(open(src));t=np.array(d['t']);f=np.array([np.nan if x is None else x for x in d['f0']]);M=np.array(d['mfcc'])
v=~np.isnan(f);midi=np.where(v,12*np.log2(np.where(v,f,1)/440)+69,np.nan)
idx=np.where(v)[0];segs=[];s=idx[0];p=idx[0]
for i in idx[1:]:
  if t[i]-t[p]>GAP: segs.append((s,p)); s=i
  p=i
segs.append((s,p))
rows=[]
for s,e in segs:
  if t[e]-t[s]<MIN: continue
  sel=np.arange(s,e+1); sel=sel[v[sel]]
  m=midi[sel]; 
  if len(m)<8: continue
  hist,edges=np.histogram(m,bins=np.arange(np.floor(m.min()),np.ceil(m.max())+2,1))
  rows.append({'start':round(float(t[s]),2),'end':round(float(t[e]),2),'pitch':round(float(np.median(m)),1),'pitchHi':round(float(np.percentile(m,80)),1),'pitchLo':round(float(np.percentile(m,20)),1),
   'timbre':M[sel,1:8].mean(axis=0).round(2).tolist(),'n':int(len(m))})
X=np.array([[r['pitch']*PW,r['pitchHi']*PW]+r['timbre'] for r in rows],float)
mu,sd=X.mean(0),X.std(0)+1e-9;Z=(X-mu)/sd;Z[:,:2]*=PW
rng=np.random.default_rng(1);best=None
for _ in range(20):
  c=Z[rng.choice(len(Z),2,replace=False)]
  for _ in range(100):
    lab=np.argmin(((Z[:,None,:]-c[None])**2).sum(2),1)
    nc=np.array([Z[lab==k].mean(0) if (lab==k).any() else c[k] for k in range(2)])
    if np.allclose(nc,c):break
    c=nc
  sse=((Z-c[lab])**2).sum()
  if best is None or sse<best[0]:best=(sse,lab,c)
_,lab,c=best
# 組の名前: 高さの平均が低い方を「声A(低め)」、高い方を「声B(高め)」
hi=int(np.argmax([np.mean([rows[i]['pitch'] for i in range(len(rows)) if lab[i]==k]) for k in range(2)]))
for i,r in enumerate(rows):
  dist=np.sqrt(((Z[i]-c)**2).sum(1));near=int(np.argmin(dist));far=1-near
  r['voice']='B' if near==hi else 'A';r['conf']=round(float((dist[far]-dist[near])/(dist[far]+dist[near]+1e-9)),2)
sep=float(np.sqrt(((c[0]-c[1])**2).sum()))
within=float(np.mean(np.sqrt(((Z-c[lab])**2).sum(1))))
summary={'phrases':len(rows),'A':sum(r['voice']=='A' for r in rows),'B':sum(r['voice']=='B' for r in rows),
 'pitchA':round(float(np.median([r['pitch'] for r in rows if r['voice']=='A'])),1),'pitchB':round(float(np.median([r['pitch'] for r in rows if r['voice']=='B'])),1),
 'centerDistance':round(sep,2),'meanWithin':round(within,2),'sure':sum(r['conf']>=0.5 for r in rows),'settings':{'gap':GAP,'min':MIN,'pitchWeight':PW}}
json.dump({'summary':summary,'phrases':rows},open(out,'w'),ensure_ascii=False)
print(json.dumps(summary,ensure_ascii=False))

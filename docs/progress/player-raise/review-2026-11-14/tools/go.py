#!/usr/bin/env python3
# 1ターンを通す: go.py <行動> [オプション]
#  行動: rest / play / hosp / tr<1-6> / none(進めるだけ)
#  --praise 1|2|3 (褒める/叱る/なにもしない)  --ev 1|2|3 (出来事の選択肢)  --name 札
import sys,json,re,urllib.request,urllib.parse,os,subprocess,time
Q=os.path.dirname(os.path.abspath(__file__))
def get(p,**q):
    u="http://localhost:9555/"+p+("?"+urllib.parse.urlencode(q) if q else "")
    r=urllib.request.urlopen(u,timeout=120).read().decode()
    try: return json.loads(r)
    except Exception: return r
def labs(d): return [re.sub(r"^\d+(×?)\[(.*)\]\(.*$",r"\1\2",x) for x in d["btns"]]
prev=set()
def show(d,cut=330):
    global prev
    lines=[x.strip() for x in d["text"].split("\n") if x.strip()]
    new=[x for x in lines if x not in prev]; prev=set(lines)
    extra="".join(" %s%s"%(k.upper(),d[k]) for k in ("over","lap") if d.get(k))+(" HSCROLL" if d.get("hscroll") else "")
    print("%s | %s | %s%s"%(d.get("shot"),",".join(d.get("snd") or []),(" / ".join(new))[:cut],extra))
def tap(i,wait=800,name="g"):
    d=get("tap",i=i,wait=wait,name=name); show(d); return d
a=sys.argv[1]; opt={"praise":"1","ev":"1","name":a}
for k in range(2,len(sys.argv)-1,2): opt[sys.argv[k].lstrip("-")]=sys.argv[k+1]
N=opt["name"]
d=get("look"); prev=set(x.strip() for x in d["text"].split("\n"))
L=labs(d)
def find(L,pat):
    for i,l in enumerate(L):
        if re.search(pat,l) and not l.startswith("×"): return i
    return -1
if a!="none":
    if find(L,r"^💪 トレーニング")<0: print("メインではない:",L); sys.exit()
    if a=="rest": d=tap(find(L,"^🛌"),700,N)
    elif a=="play": d=tap(find(L,"^🎈"),700,N)
    elif a=="hosp":
        i=find(L,"^🏥")
        if i<0: print("通院は押せない"); sys.exit()
        d=tap(i,700,N)
    elif a.startswith("tr"):
        d=tap(find(L,"^💪 トレーニング"),700,N+"-sel"); d=tap(int(a[2]),500,N+"-sel"); L=labs(d)
        d=tap(find(L,"をする$"),500,N+"-fx"); d=get("wait",ms=1300,name=N+"-fx2"); show(d); d=get("wait",ms=1500,name=N+"-res"); show(d)
for step in range(30):
    r=subprocess.run([Q+"/dis.sh"],capture_output=True,text=True).stdout.strip()
    if r: print("  [説明] "+r.replace("\n"," ")[:500])
    d=get("look"); L=labs(d)
    if find(L,r"^💪 トレーニング")>=0: print("→メイン"); break
    core=[(i,l) for i,l in enumerate(L) if not re.match(r"^(← 中断|⏩ とばす|ℹ)$",l) and not l.startswith("×")]
    if find(L,"^👏 褒める")>=0:
        i=find(L,["^👏 褒める","^📣 叱る","^なにもしない"][int(opt["praise"])-1]); d=tap(i,900,N+"-praise"); continue
    if len(core)==1 and re.search(r"つぎへ|とじる ▶|ごはんへ|TAP|タップ|OK|すすむ|結果へ",core[0][1]):
        d=tap(core[0][0],900,N); continue
    if any(l=="ℹ" for l in L) and len(core)>=1:
        i=core[min(int(opt["ev"]),len(core))-1][0]; print("  [選択肢] "+" / ".join(l for _,l in core)+" → "+L[i]); d=tap(i,900,N+"-ev"); continue
    if not core and "TAP" in d["text"]:
        d=get("xy",x=195,y=420,wait=900,name=N+"-tap"); show(d); continue
    print("止まった: "+" ".join("%d[%s]"%(i,l) for i,l in enumerate(L))); break

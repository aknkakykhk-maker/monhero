import sys,json,os
Q=os.path.dirname(os.path.abspath(__file__))
s=sys.stdin.read()
try: d=json.loads(s)
except Exception:
    print(s); sys.exit()
if isinstance(d,dict) and "btns" in d:
    full=os.environ.get("FULL")
    lines=[x.strip() for x in d["text"].split("\n") if x.strip()]
    pf=os.path.join(Q,"prev.json")
    try: prev=set(json.load(open(pf)))
    except Exception: prev=set()
    json.dump(lines,open(pf,"w"),ensure_ascii=False)
    show=lines if full else [x for x in lines if x not in prev]
    print("VIEW",d["view"],"SHOT",d.get("shot"),"BGM",d.get("bgm"),"SND",d.get("snd"))
    print(("ALL: " if full else "NEW: ")+" | ".join(show))
    import re
    if full: print("\n".join(d["btns"]))
    else: print("BTN: "+" ".join(re.sub(r"\(\d+,\d+ \d+x\d+\)$","",b) for b in d["btns"]))
    for k in ("over","lap","small"):
        if d[k]: print(k.upper(), d[k])
    if d["hscroll"]: print("HSCROLL!")
else: print(json.dumps(d,ensure_ascii=False,indent=1))

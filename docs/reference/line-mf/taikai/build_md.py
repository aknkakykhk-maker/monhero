# tournaments.json と rewards.json から TOURNAMENTS.md と REWARDS.md を作り直す(python3 -I build_md.py)
import json, os
os.chdir(os.path.dirname(os.path.abspath(__file__)))
T = json.load(open("tournaments.json", encoding="utf-8"))["tournaments"]
R = json.load(open("rewards.json", encoding="utf-8"))
eff = {it["item"]: it for it in R["items"]}
# 賞品の「もらえる大会」は大会の表から数え直す(手で書かない)
for it in eff.values(): it["from"] = []
for t in T:
    for r in t["rewards"]:
        it = eff.setdefault(r["item"], {"item": r["item"], "effect": None, "effectSource": None, "from": []})
        it["from"].append(t["period"] + " " + t["name"])
R["items"] = list(eff.values())
json.dump(R, open("rewards.json", "w", encoding="utf-8"), ensure_ascii=False, indent=1)
L = ["# 大会一覧(時期別)", "", "正本は tournaments.json。賞品の効果は REWARDS.md / rewards.json。md は build_md.py で作り直す。", ""]
cur = None
for t in T:
    if t["period"] != cur:
        cur = t["period"]; L += ["", f"## {cur}({t['phase']})", ""]
    rw = "・".join(f"{r['item']}×{r['count']}" for r in t["rewards"])
    en = f" {t['en']}" if t["en"] else ""
    L.append(f"- {t['name']}{en}(格: {t['grade']}) 賞金 {t['prize']:,}G / 賞品 {rw} / 地形 {t['terrain']} / 天気 {t['weather']} / 画像 {t['images']}")
open("TOURNAMENTS.md", "w", encoding="utf-8").write("\n".join(L) + "\n")
M = ["# 大会の報酬(賞品)と効果", "", "正本は rewards.json。効果は賞品を押したときの「アイテム詳細」の文。md は build_md.py で作り直す。", "", "## 効果がわかっているもの", ""]
for it in eff.values():
    if it["effect"]: M.append(f"- {it['item']}: {it['effect']}(画像 {it['effectSource']})\n  - もらえる大会: {'、'.join(it['from']) or 'まだ資料なし'}")
M += ["", "## 効果がまだわからないもの(説明の画像待ち)", ""]
for it in eff.values():
    if not it["effect"]: M.append(f"- {it['item']}\n  - もらえる大会: {'、'.join(it['from'])}")
open("REWARDS.md", "w", encoding="utf-8").write("\n".join(M) + "\n")

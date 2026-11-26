#!/usr/bin/env python3
"""助手画像 正本管理台帳ビルダー.

GitHub の最新 main を基準に、全助手・全衣装・全表情の画像台帳 (registry.json) を作る。

入力:
  - GitHub git tree (main): パス・blob SHA・サイズ
  - tools/image/assistant-art-catalog.json: 組ごとの正本(原本)宣言
  - approvals.json (このフォルダ): 承認状態の人手オーバーレイ。無い組は unknown のまま (勝手に決めない)
  - provenance.json (このフォルダ): 派生画像の参照元記録

各画像について実ファイルをダウンロードし、SHA-256・寸法・アルファ情報を実測する。
ダウンロードは blob SHA を鍵にキャッシュし、変わっていないファイルは再取得しない。

使い方:
  python3 build_registry.py [--cache DIR] [--out registry.json] [--repo owner/name]
"""
import argparse
import concurrent.futures
import hashlib
import io
import json
import os
import re
import sys
import urllib.request

EXPRESSIONS = ["normal", "happy", "wink", "surprise", "troubled", "angry", "crying", "excited", "sleep"]
IMG_PREFIX = "monster-hero/images/assistant/"


def fetch(url):
    req = urllib.request.Request(url, headers={"User-Agent": "assistant-image-registry"})
    with urllib.request.urlopen(req, timeout=60) as r:
        return r.read()


def parse_path(path, who, fullbody_names):
    """images/assistant 配下のパスを (char, outfit, kind, expression) に分解する。"""
    rel = path[len(IMG_PREFIX):]
    parts = rel.split("/")
    fname = parts[-1]
    dirs = parts[:-1]
    stem = re.sub(r"\.(png|PNG|jpg|jpeg)$", "", fname)

    prefix2char = {v["prefix"]: k for k, v in who.items()}
    base2set = {v: k for k, v in fullbody_names.items()}  # "momosuke_halloween" -> "momosuke/halloween"

    def split_expr(s, prefixes):
        for p in sorted(prefixes, key=len, reverse=True):
            if s == p:
                return p, "base"
            if s.startswith(p + "_"):
                e = s[len(p) + 1:]
                if e in EXPRESSIONS:
                    return p, e
        return None, None

    if dirs and dirs[0] == "fullbody":
        if stem in base2set:
            c, o = base2set[stem].split("/", 1)
            return c, o, "fullbody", "base"
        for base, co in sorted(base2set.items(), key=lambda kv: -len(kv[0])):
            if stem.startswith(base + "__"):
                e = stem[len(base) + 2:]
                if e in EXPRESSIONS:
                    c, o = co.split("/", 1)
                    return c, o, "fullbody", e
        return None, None, "fullbody", None

    if dirs and dirs[0].startswith("stand-"):
        outfit = dirs[0][len("stand-"):]
        p, e = split_expr(stem, prefix2char.keys())
        if p:
            return prefix2char[p], outfit, "stand", e
        return None, outfit, "stand", None

    if dirs and dirs[-1] == "face":
        outfit = dirs[0] if len(dirs) > 1 else "normal"
        p, e = split_expr(stem, prefix2char.keys())
        if p:
            return prefix2char[p], outfit, "face", e
        return None, outfit, "face", None

    outfit = dirs[0] if dirs else "normal"
    p, e = split_expr(stem, prefix2char.keys())
    if p:
        return prefix2char[p], outfit, "bust", e
    return None, outfit, "bust", None


def inspect_image(data):
    from PIL import Image
    im = Image.open(io.BytesIO(data))
    w, h = im.size
    has_alpha = im.mode in ("RGBA", "LA") or (im.mode == "P" and "transparency" in im.info)
    alpha_stats = None
    if has_alpha:
        a = im.convert("RGBA").getchannel("A")
        total = w * h
        hist = a.histogram()
        transparent = sum(hist[:16])
        opaque = sum(hist[240:])
        corners = [a.getpixel((0, 0)), a.getpixel((w - 1, 0)), a.getpixel((0, h - 1)), a.getpixel((w - 1, h - 1))]
        alpha_stats = {
            "transparent_ratio": round(transparent / total, 4),
            "opaque_ratio": round(opaque / total, 4),
            "corners_alpha": corners,
        }
    return {"width": w, "height": h, "mode": im.mode, "has_alpha": has_alpha, "alpha": alpha_stats}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--repo", default="aknkakykhk-maker/monhero")
    ap.add_argument("--branch", default="main")
    ap.add_argument("--cache", default=os.path.expanduser("~/workspace/assistant-image-system/cache"))
    ap.add_argument("--out", default="registry.json")
    ap.add_argument("--base", default=os.path.dirname(os.path.abspath(__file__)))
    args = ap.parse_args()

    os.makedirs(args.cache, exist_ok=True)
    tree = json.loads(fetch(f"https://api.github.com/repos/{args.repo}/git/trees/{args.branch}?recursive=1"))
    head_sha = tree["sha"]
    catalog = json.loads(fetch(f"https://raw.githubusercontent.com/{args.repo}/{args.branch}/tools/image/assistant-art-catalog.json"))
    who = catalog["who"]
    fullbody_names = catalog["fullbodyNames"]
    groups = catalog["groups"]

    def load_overlay(name):
        p = os.path.join(args.base, name)
        if os.path.exists(p):
            with open(p, encoding="utf-8") as f:
                return json.load(f)
        return {}

    approvals = load_overlay("approvals.json")
    provenance = load_overlay("provenance.json")

    blobs = [t for t in tree["tree"] if t["type"] == "blob" and t["path"].startswith(IMG_PREFIX)
             and not t["path"].endswith(".gitkeep")]
    print(f"main {head_sha[:12]}: {len(blobs)} assistant images", file=sys.stderr)

    def get_data(t):
        cache_path = os.path.join(args.cache, t["sha"])
        if os.path.exists(cache_path):
            with open(cache_path, "rb") as f:
                return f.read()
        url = f"https://raw.githubusercontent.com/{args.repo}/{args.branch}/" + urllib.request.quote(t["path"])
        data = fetch(url)
        with open(cache_path, "wb") as f:
            f.write(data)
        return data

    entries = {}
    with concurrent.futures.ThreadPoolExecutor(max_workers=8) as ex:
        results = list(ex.map(lambda t: (t, get_data(t)), blobs))
    for t, data in results:
        char, outfit, kind, expr = parse_path(t["path"], who, fullbody_names)
        sha256 = hashlib.sha256(data).hexdigest()
        info = inspect_image(data)
        key = t["path"]
        group_key = f"{char}/{outfit}/{kind}" if char else None
        g = groups.get(group_key, {}) if group_key else {}
        appr = approvals.get(group_key, {}) if group_key else {}
        entries[key] = {
            "id": key,
            "assistant": char,
            "outfit": outfit,
            "kind": kind,
            "expression": expr,
            "path": t["path"],
            "blob_sha": t["sha"],
            "version": t["sha"][:12],
            "size_bytes": len(data),
            "sha256": sha256,
            **info,
            "canonical_source": g.get("master"),
            "how_made": g.get("how"),
            "approval": appr.get("status", "unknown"),
            "approval_note": appr.get("note"),
        }

    # 派生の鮮度判定: provenance に記録された参照元ハッシュと現在の正本ハッシュを比べる
    by_group_expr = {}
    for e in entries.values():
        if e["assistant"]:
            by_group_expr[(e["assistant"], e["outfit"], e["kind"], e["expression"])] = e
    for e in entries.values():
        prov = provenance.get(f"{e['assistant']}/{e['outfit']}/{e['kind']}") if e["assistant"] else None
        if not prov:
            e["freshness"] = "self" if e.get("canonical_source") == "self" else "unknown"
            continue
        src = prov["source_group"]  # 例 momosuke/halloween/fullbody
        sc, so, sk = src.split("/")
        src_entry = by_group_expr.get((sc, so, sk, e["expression"]))
        recorded = (prov.get("recorded_source_sha256") or {}).get(e["expression"])
        if src_entry is None:
            e["freshness"] = "source_missing"
        elif recorded is None:
            e["freshness"] = "unknown"
        elif recorded == src_entry["sha256"]:
            e["freshness"] = "fresh"
        else:
            e["freshness"] = "stale"
        e["derived_from"] = {"group": src, "current_sha256": src_entry["sha256"] if src_entry else None,
                              "recorded_sha256": recorded}

    registry = {
        "schema": 1,
        "repo": args.repo,
        "branch": args.branch,
        "main_head_sha": head_sha,
        "entries": entries,
    }
    with open(args.out, "w", encoding="utf-8") as f:
        json.dump(registry, f, ensure_ascii=False, indent=1, sort_keys=True)
    n_stale = sum(1 for e in entries.values() if e["freshness"] == "stale")
    n_unknown_appr = sum(1 for e in entries.values() if e["approval"] == "unknown")
    print(f"wrote {args.out}: {len(entries)} entries, stale={n_stale}, approval unknown={n_unknown_appr}", file=sys.stderr)


if __name__ == "__main__":
    main()

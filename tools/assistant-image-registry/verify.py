#!/usr/bin/env python3
"""助手画像の機械検証.

人間の目視では代替できない「取り違え・混入・鮮度」の検証を機械で行う。
目視でしか分からない項目 (衣装の一致・表情の正しさ・指の破綻など) は対象外で、
それは比較シートでの目視確認に分ける (README 参照)。

使い方:
  # 台帳全体の集計と重複検出
  python3 verify.py registry --registry registry.json

  # 提示・実装候補フォルダの検証 (旧画像混入・再提出・透過・寸法・参照元の鮮度)
  python3 verify.py candidates <dir> --registry registry.json \
      [--provenance-out provenance-out.json] [--size 256x256] [--json report.json]

終了コード: 問題があれば 1。
"""
import argparse
import hashlib
import io
import json
import os
import sys


def sha256_of(path):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def image_info(path):
    from PIL import Image
    im = Image.open(path)
    info = {"size": list(im.size), "mode": im.mode}
    if im.mode in ("RGBA", "LA") or (im.mode == "P" and "transparency" in im.info):
        a = im.convert("RGBA").getchannel("A")
        total = im.size[0] * im.size[1]
        hist = a.histogram()
        info["opaque_ratio"] = round(sum(hist[240:]) / total, 4)
        info["corners_alpha"] = [a.getpixel((0, 0)), a.getpixel((im.size[0] - 1, 0)),
                                  a.getpixel((0, im.size[1] - 1)), a.getpixel((im.size[0] - 1, im.size[1] - 1))]
    else:
        info["opaque_ratio"] = 1.0
        info["corners_alpha"] = [255, 255, 255, 255]
    return info


def cmd_registry(args):
    reg = json.load(open(args.registry, encoding="utf-8"))
    entries = reg["entries"]
    from collections import Counter
    appr = Counter(e["approval"] for e in entries.values())
    fresh = Counter(e["freshness"] for e in entries.values())
    unparsed = [k for k, e in entries.items() if not e["assistant"]]
    by_hash = {}
    for k, e in entries.items():
        by_hash.setdefault(e["sha256"], []).append(k)
    dups = {h: ks for h, ks in by_hash.items() if len(ks) > 1}
    print(f"entries: {len(entries)}  main: {reg['main_head_sha'][:12]}")
    print(f"approval: {dict(appr)}")
    print(f"freshness: {dict(fresh)}")
    print(f"unparsed paths: {len(unparsed)}")
    for k in unparsed[:10]:
        print(f"  unparsed: {k}")
    print(f"duplicate hash groups (same image in multiple slots): {len(dups)}")
    for h, ks in list(dups.items())[:10]:
        print(f"  dup {h[:12]}: {ks}")
    stale = [k for k, e in entries.items() if e["freshness"] == "stale"]
    print(f"stale derivatives: {len(stale)}")
    for k in stale:
        print(f"  stale: {k}")
    return 0


def cmd_candidates(args):
    reg = json.load(open(args.registry, encoding="utf-8"))
    entries = reg["entries"]
    prov = json.load(open(os.path.join(os.path.dirname(os.path.abspath(args.registry)), "provenance.json"), encoding="utf-8")) \
        if os.path.exists(os.path.join(os.path.dirname(os.path.abspath(args.registry)), "provenance.json")) else {}
    retired = (prov.get("_retired") or {}).get("hashes", {})
    hash2paths = {}
    for k, e in entries.items():
        hash2paths.setdefault(e["sha256"], []).append(k)

    prov_out = {}
    if args.provenance_out:
        prov_out = json.load(open(args.provenance_out, encoding="utf-8"))

    want_size = None
    if args.size:
        w, h = args.size.lower().split("x")
        want_size = [int(w), int(h)]

    problems = []
    seen = {}
    files = sorted(f for f in os.listdir(args.dir) if f.lower().endswith((".png", ".jpg", ".jpeg")))
    if not files:
        print("no image files in", args.dir)
        return 1
    for fname in files:
        path = os.path.join(args.dir, fname)
        h = sha256_of(path)
        info = image_info(path)
        label = fname
        if h in retired:
            problems.append(f"{label}: 旧世代の画像と一致 (混入) — {retired[h]}")
        if h in seen:
            problems.append(f"{label}: フォルダ内で重複 ({seen[h]} と同一)")
        seen[h] = label
        if h in hash2paths:
            problems.append(f"{label}: 現在公開中のファイルと同一 = 旧ファイルの再提出の疑い {hash2paths[h]}")
        if info["opaque_ratio"] > 0.999:
            problems.append(f"{label}: 透過でない (不透明率 {info['opaque_ratio']})")
        if want_size and info["size"] != want_size:
            problems.append(f"{label}: 寸法 {info['size']} != 規格 {want_size}")
        rec = prov_out.get(fname) or prov_out.get(os.path.splitext(fname)[0].split('_')[-1])
        if args.provenance_out:
            if not rec:
                problems.append(f"{label}: 参照元記録が無い (provenance-out に対応なし)")
            else:
                src = entries.get(rec["source_path"])
                if src is None:
                    problems.append(f"{label}: 参照元 {rec['source_path']} が台帳に無い")
                elif src["sha256"] != rec["source_sha256"]:
                    problems.append(f"{label}: 参照元が記録後に変わっている (stale source)")
                elif src["approval"] not in ("approved", "approved_current"):
                    problems.append(f"{label}: 参照元が未承認 (approval={src['approval']})")
        print(f"{label}: sha256={h[:12]} size={info['size']} opaque={info['opaque_ratio']}")
    if problems:
        print("\nNG:")
        for p in problems:
            print(" -", p)
        return 1
    print("\nOK: 全候補が機械検証を通過")
    return 0


def main():
    ap = argparse.ArgumentParser()
    sub = ap.add_subparsers(dest="cmd", required=True)
    r = sub.add_parser("registry")
    r.add_argument("--registry", default="registry.json")
    r.set_defaults(fn=cmd_registry)
    c = sub.add_parser("candidates")
    c.add_argument("dir")
    c.add_argument("--registry", default="registry.json")
    c.add_argument("--provenance-out")
    c.add_argument("--size")
    c.set_defaults(fn=cmd_candidates)
    args = ap.parse_args()
    sys.exit(args.fn(args))


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""顔アイコンの自動切り出し.

原則: AIによる再描画はしない。台帳で承認済みの正本全身絵から、
登録済みランドマーク (目・あご) と画角仕様 (framing.json) で決定的に切り出す。

安全装置:
  - 正本の実ファイルの SHA-256 が台帳と一致しなければ開始しない。
  - ランドマーク記録の SHA-256 が正本と一致しなければ開始しない (正本が差し替わったら再実測が必要)。
  - 正本の承認状態が approved / approved_current でなければ開始しない。
  - 出力には参照元記録 (provenance-out.json) を必ず付ける。

使い方:
  python3 make_face_icons.py --char momosuke --outfit halloween --out <dir> \
      [--registry registry.json] [--expressions happy angry ...]
"""
import argparse
import hashlib
import json
import os
import sys
import urllib.request

BASE = os.path.dirname(os.path.abspath(__file__))
CACHE = os.path.expanduser("~/workspace/assistant-image-system/cache")
REPO = "aknkakykhk-maker/monhero"


def fetch_cached(blob_sha, path):
    cache_path = os.path.join(CACHE, blob_sha)
    if os.path.exists(cache_path):
        return open(cache_path, "rb").read()
    url = f"https://raw.githubusercontent.com/{REPO}/main/" + urllib.request.quote(path)
    req = urllib.request.Request(url, headers={"User-Agent": "assistant-image-registry"})
    with urllib.request.urlopen(req, timeout=60) as r:
        data = r.read()
    os.makedirs(CACHE, exist_ok=True)
    with open(cache_path, "wb") as f:
        f.write(data)
    return data


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--char", required=True)
    ap.add_argument("--outfit", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--registry", default=os.path.join(BASE, "registry.json"))
    ap.add_argument("--landmarks", default=os.path.join(BASE, "landmarks.json"))
    ap.add_argument("--framing", default=os.path.join(BASE, "framing.json"))
    ap.add_argument("--expressions", nargs="*")
    ap.add_argument("--size", type=int, default=256)
    args = ap.parse_args()

    from PIL import Image
    import io

    reg = json.load(open(args.registry, encoding="utf-8"))
    landmarks = json.load(open(args.landmarks, encoding="utf-8"))
    framing_all = json.load(open(args.framing, encoding="utf-8"))
    framing = framing_all.get(f"{args.char}/{args.outfit}") or framing_all["default"]
    entries = reg["entries"]

    fullbody = {e["expression"]: e for e in entries.values()
                if e["assistant"] == args.char and e["outfit"] == args.outfit and e["kind"] == "fullbody"}
    faces = {e["expression"]: e for e in entries.values()
             if e["assistant"] == args.char and e["outfit"] == args.outfit and e["kind"] == "face"}
    exprs = args.expressions or sorted(set(fullbody) & set(faces) - {"base"})
    exprs = [e for e in exprs if e != "base"]

    os.makedirs(args.out, exist_ok=True)
    prov_out = {}
    for expr in exprs:
        src = fullbody.get(expr)
        if src is None:
            print(f"NG {expr}: 正本全身絵が台帳に無い", file=sys.stderr); sys.exit(1)
        if src["approval"] not in ("approved", "approved_current"):
            print(f"NG {expr}: 正本が未承認 (approval={src['approval']}) — 生成を開始しない", file=sys.stderr); sys.exit(1)
        data = fetch_cached(src["blob_sha"], src["path"])
        sha = hashlib.sha256(data).hexdigest()
        if sha != src["sha256"]:
            print(f"NG {expr}: 正本のハッシュが台帳と一致しない — 生成を開始しない", file=sys.stderr); sys.exit(1)
        lm = landmarks.get(src["path"])
        if lm is None or lm.get("sha256") != sha:
            print(f"NG {expr}: ランドマークが無い/正本と一致しない (再実測が必要) — 生成を開始しない", file=sys.stderr); sys.exit(1)
        im = Image.open(io.BytesIO(data)).convert("RGBA")
        (ex, ey), (cx, cy) = lm["eye"], lm["chin"]
        S = (cy - ey) / (framing["chin"] - framing["eye"])
        top = ey - framing["eye"] * S
        center_x = (ex + cx) / 2
        left = center_x - framing["center"] * S
        canvas = Image.new("RGBA", (int(round(S)), int(round(S))), (0, 0, 0, 0))
        canvas.paste(im, (int(round(-left)), int(round(-top))))
        icon = canvas.resize((args.size, args.size), Image.LANCZOS)
        out_name = os.path.basename(faces[expr]["path"]) if expr in faces else f"{expr}.PNG"
        out_path = os.path.join(args.out, out_name)
        icon.save(out_path)
        out_sha = hashlib.sha256(open(out_path, "rb").read()).hexdigest()
        prov_out[out_name] = {
            "expression": expr,
            "source_path": src["path"],
            "source_sha256": sha,
            "source_version": src["version"],
            "framing": framing,
            "output_sha256": out_sha,
        }
        print(f"OK {expr}: {src['path']} (sha {sha[:12]}) -> {out_name} (sha {out_sha[:12]})")
    with open(os.path.join(args.out, "provenance-out.json"), "w", encoding="utf-8") as f:
        json.dump(prov_out, f, ensure_ascii=False, indent=1)
    print(f"provenance-out.json を {args.out} に書いた ({len(prov_out)} 件)")


if __name__ == "__main__":
    main()

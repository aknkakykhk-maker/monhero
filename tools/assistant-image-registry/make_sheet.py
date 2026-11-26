#!/usr/bin/env python3
"""比較一覧シート生成.

1セット分をスマホで確認しやすい縦長シートにする:
各行 = 表情ごとに [正本全身絵 | 現在の顔アイコン | 新規顔アイコン(あれば)]。
各セルに表情名・種別・バージョン (blob短縮)・SHA短縮・承認/鮮度を明記する。
これは確認用シートであり、ゲームへ入れる画像そのものは別ファイルで扱う。

使い方:
  python3 make_sheet.py --char momosuke --outfit halloween --out sheet.png \
      [--new-icons <dir>] [--registry registry.json]
"""
import argparse
import hashlib
import io
import json
import os
import sys
import urllib.request

BASE = os.path.dirname(os.path.abspath(__file__))
CACHE = os.path.expanduser("~/workspace/assistant-image-system/cache")
REPO = "aknkakykhk-maker/monhero"
FONT_CANDIDATES = [
    "/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc",
    "/usr/share/fonts/opentype/noto/NotoSansCJKjp-Regular.otf",
    "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
]
EXPR_ORDER = ["normal", "happy", "angry", "crying", "excited", "surprise", "troubled", "wink", "sleep"]


def font(size):
    from PIL import ImageFont
    for p in FONT_CANDIDATES:
        if os.path.exists(p):
            try:
                return ImageFont.truetype(p, size)
            except Exception:
                continue
    return ImageFont.load_default()


def fetch_cached(blob_sha, path):
    cache_path = os.path.join(CACHE, blob_sha)
    if os.path.exists(cache_path):
        return open(cache_path, "rb").read()
    url = f"https://raw.githubusercontent.com/{REPO}/main/" + urllib.request.quote(path)
    req = urllib.request.Request(url, headers={"User-Agent": "assistant-image-registry"})
    with urllib.request.urlopen(req, timeout=60) as r:
        data = r.read()
    os.makedirs(CACHE, exist_ok=True)
    open(cache_path, "wb").write(data)
    return data


def checker(w, h, s=18):
    from PIL import Image, ImageDraw
    im = Image.new("RGB", (w, h), (255, 255, 255))
    d = ImageDraw.Draw(im)
    for y in range(0, h, s):
        for x in range(0, w, s):
            if (x // s + y // s) % 2:
                d.rectangle([x, y, x + s - 1, y + s - 1], fill=(198, 198, 198))
    return im


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--char", required=True)
    ap.add_argument("--outfit", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--new-icons")
    ap.add_argument("--registry", default=os.path.join(BASE, "registry.json"))
    args = ap.parse_args()

    from PIL import Image, ImageDraw
    reg = json.load(open(args.registry, encoding="utf-8"))
    entries = reg["entries"]
    fullbody = {e["expression"]: e for e in entries.values()
                if e["assistant"] == args.char and e["outfit"] == args.outfit and e["kind"] == "fullbody"}
    faces = {e["expression"]: e for e in entries.values()
             if e["assistant"] == args.char and e["outfit"] == args.outfit and e["kind"] == "face"}
    exprs = [e for e in EXPR_ORDER if e in fullbody or e in faces]

    new_icons = {}
    if args.new_icons:
        for f in os.listdir(args.new_icons):
            if f.lower().endswith(".png"):
                new_icons[f] = os.path.join(args.new_icons, f)

    FB_H, IC = 300, 210
    LABEL_H = 64
    ROW_H = FB_H + LABEL_H + 16
    HEAD_H = 92
    W = 1080
    H = HEAD_H + ROW_H * len(exprs) + 20
    sheet = Image.new("RGB", (W, H), (245, 245, 245))
    d = ImageDraw.Draw(sheet)
    d.rectangle([0, 0, W, HEAD_H - 8], fill=(30, 30, 30))
    d.text((20, 14), f"{args.char} / {args.outfit} — 正本・全身・顔アイコン比較", fill=(255, 255, 255), font=font(34))
    d.text((20, 56), f"main {reg['main_head_sha'][:12]} / 台帳の承認状態とハッシュに基づく", fill=(200, 200, 200), font=font(22))

    for i, expr in enumerate(exprs):
        y0 = HEAD_H + i * ROW_H
        d.text((16, y0 + 4), expr, fill=(20, 20, 20), font=font(30))
        x = 16
        fb = fullbody.get(expr)
        if fb:
            im = Image.open(io.BytesIO(fetch_cached(fb["blob_sha"], fb["path"]))).convert("RGBA")
            w = int(im.size[0] * FB_H / im.size[1])
            cell = checker(max(w, 120), FB_H)
            cell.paste(im.resize((w, FB_H)), (0, 0), im.resize((w, FB_H)))
            sheet.paste(cell, (x, y0 + 40))
            d.text((x, y0 + 40 + FB_H + 6), f"全身 v{fb['version']} sha {fb['sha256'][:8]} {fb['approval']}", fill=(60, 60, 60), font=font(19))
            x += max(w, 120) + 24
        fc = faces.get(expr)
        if fc:
            im = Image.open(io.BytesIO(fetch_cached(fc["blob_sha"], fc["path"]))).convert("RGBA").resize((IC, IC))
            cell = checker(IC, IC)
            cell.paste(im, (0, 0), im)
            sheet.paste(cell, (x, y0 + 40))
            label = f"現行 v{fc['version']} {fc['freshness']}"
            f19 = font(19)
            while d.textlength(label, font=f19) > IC + 18 and len(label) > 4:
                label = label[:-1]
            d.text((x, y0 + 40 + IC + 6), label, fill=(60, 60, 60), font=f19)
            x += IC + 24
        if fc and os.path.basename(fc["path"]) in new_icons:
            p = new_icons[os.path.basename(fc["path"])]
            raw = open(p, "rb").read()
            im = Image.open(io.BytesIO(raw)).convert("RGBA").resize((IC, IC))
            cell = checker(IC, IC)
            cell.paste(im, (0, 0), im)
            sheet.paste(cell, (x, y0 + 40))
            d.text((x, y0 + 40 + IC + 6), f"新規 sha {hashlib.sha256(raw).hexdigest()[:8]}", fill=(0, 110, 60), font=font(19))
    sheet.save(args.out)
    print(f"wrote {args.out} ({sheet.size[0]}x{sheet.size[1]})")


if __name__ == "__main__":
    main()

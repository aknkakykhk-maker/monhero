#!/usr/bin/env python3
"""助手の絵(monster-hero/images/assistant/ 以下)を全部一覧にして、重さ・大きさ・粗さを調べる(助手部ナカヨシ・調べるだけ・絵は変えない)。

経緯: 2026-11-28 r1126-119 社長「助手画像は基本サイズでかめだから確認してみてほしい」。
見るもの
  ・助手 × 服 × 種類(全身・立ち絵・胸像・顔アイコン・そのほか)ごとの 枚数・合計の重さ・縦横・形式
  ・大きすぎ: 絵の中身(透明でない所)の高さが、画面で要る画素(下の NEED)の 2 倍を超える / 透明の余白が 6 割を超える
  ・粗い: 中身の高さが NEED の 6 割に届かない / 256 色に減らしてある / 同じ組の表情どうしで高さが 1.5 倍より違う(世代の混ざり)
  ・WebP にした見込み: 見た目を1画素も変えない(可逆 WebP)/ 見分けのつかない程度(WebP 画質90・今日のクリスマスの絵と同じ)
  ・原本: tools/image/assistant-art-catalog.json の groups の master が残っているか
NEED(画面で要る画素・縦): iPhone の倍率3 × 画面でいちばん大きく出るときの高さ(CSS px のめやす)。
  立ち絵 460(モード選びの縦の枠)/ 全身 600(助手の紹介)/ 胸像 400(お話・表情の一覧)/ 顔 96(大きい丸)
使い方: python3 tools/assistant/assistant-art-size-audit.py [--json 出力.json] [--no-webp] [--top N]
"""
import os, sys, io, re, glob, json
import numpy as np
from PIL import Image

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
A = os.path.join(ROOT, 'monster-hero/images/assistant')
CAT = os.path.join(ROOT, 'tools/image/assistant-art-catalog.json')
NEED_CSS = {'stand': 460, 'fullbody': 600, 'bust': 400, 'face': 96}
DPR = 3
PREFIX = {'myua': 'mua', 'mua': 'mua'}
WHO = ['mua', 'myua', 'kiki', 'momosuke', 'atsu', 'kyuko', 'sorashido', 'erubin', 'dra']


def classify(rel):
    """rel(images/assistant からの相対)→ (助手, 服, 種類)"""
    parts = rel.split('/')
    name = os.path.splitext(parts[-1])[0]
    if parts[0] == 'fullbody':
        base = name.split('__')[0]
        who, _, outfit = base.partition('_')
        return PREFIX.get(who, who), outfit or 'normal', 'fullbody'
    if parts[0].startswith('stand-'):
        who = name.split('_')[0]
        return PREFIX.get(who, who), parts[0][6:], 'stand'
    who = name.split('_')[0]
    if who not in WHO:
        return 'その他', parts[0] if len(parts) > 1 else '-', 'other'
    if len(parts) == 1:
        return PREFIX.get(who, who), 'normal', 'bust'
    if parts[0] == 'face':
        return PREFIX.get(who, who), 'normal', 'face'
    if len(parts) >= 3 and parts[1] == 'face':
        return PREFIX.get(who, who), parts[0], 'face'
    return PREFIX.get(who, who), parts[0], 'bust'


def webp_sizes(im):
    out = []
    for kw in (dict(lossless=True, quality=100, method=4), dict(quality=90, method=4)):
        b = io.BytesIO()
        im.save(b, 'WEBP', **kw)
        out.append(b.tell())
    return out


def master_state(cat, who, outfit, kind):
    g = cat.get('groups', {}).get('%s/%s/%s' % (who, outfit, 'stand' if kind == 'stand' else kind))
    if not g:
        return '?'
    m = g.get('master')
    if m == 'self':
        return 'なし(完成品のみ)'
    pats = m if isinstance(m, list) else [m]
    hit = any(glob.glob(os.path.join(ROOT, p)) for p in pats)
    return 'あり' if hit else 'なし(記録だけ)'


def main():
    args = sys.argv[1:]
    do_webp = '--no-webp' not in args
    top = int(args[args.index('--top') + 1]) if '--top' in args else 15
    cat = json.load(open(CAT, encoding='utf-8'))
    rows = []
    for p in sorted(glob.glob(os.path.join(A, '**/*'), recursive=True)):
        if not os.path.isfile(p) or os.path.splitext(p)[1].lower() not in ('.png', '.webp', '.jpg', '.jpeg'):
            continue
        rel = os.path.relpath(p, A)
        who, outfit, kind = classify(rel)
        im = Image.open(p)
        mode = im.mode
        rgba = im.convert('RGBA')
        a = np.asarray(rgba)[..., 3]
        m = a > 8
        if m.any():
            ys = np.where(m.any(1))[0]; xs = np.where(m.any(0))[0]
            ch, cw = int(ys[-1] - ys[0] + 1), int(xs[-1] - xs[0] + 1)
        else:
            ch = cw = 0
        pad = 1 - (ch * cw) / float(im.width * im.height)
        opaque_bg = float((a < 16).mean()) < 0.01
        r = dict(rel=rel, who=who, outfit=outfit, kind=kind, fmt=os.path.splitext(p)[1].lower().lstrip('.'), mode=mode,
                 w=im.width, h=im.height, cw=cw, ch=ch, pad=round(pad, 3), bytes=os.path.getsize(p), opaque=opaque_bg,
                 master=master_state(cat, who, outfit, kind))
        if do_webp:
            r['webp_lossless'], r['webp_q90'] = webp_sizes(rgba)
        need = NEED_CSS.get(kind)
        r['need'] = need * DPR if need else None
        r['ratio'] = round(ch / float(r['need']), 2) if need and ch else None
        rows.append(r)
    # 世代の混ざり: 同じ組(助手・服・種類)の中身の高さの最大 / 最小
    groups = {}
    for r in rows:
        groups.setdefault((r['who'], r['outfit'], r['kind']), []).append(r)
    for k, rs in groups.items():
        hs = [x['ch'] for x in rs if x['ch']]
        med = float(np.median(hs)) if hs else 0
        for x in rs:
            x['mix'] = round(med / x['ch'], 2) if x['ch'] else None
    if '--json' in args:
        json.dump(rows, open(args[args.index('--json') + 1], 'w', encoding='utf-8'), ensure_ascii=False, indent=0)
    tot = sum(r['bytes'] for r in rows)
    print('助手の絵 %d 枚・合計 %.1f MB' % (len(rows), tot / 1e6))
    if do_webp:
        print('  可逆 WebP にすると %.1f MB / WebP 画質90 にすると %.1f MB' % (
            sum(min(r['bytes'], r['webp_lossless']) if r['fmt'] != 'webp' else r['bytes'] for r in rows) / 1e6,
            sum(r['webp_q90'] if r['fmt'] != 'webp' else r['bytes'] for r in rows) / 1e6))
    big = sorted([r for r in rows if r['ratio'] and r['ratio'] > 2], key=lambda r: -r['bytes'])
    print('大きすぎ(要る画素の2倍超) %d 枚 / 余白6割超 %d 枚 / 粗い(6割未満) %d 枚 / 世代の混ざり %d 枚' % (
        len(big), sum(1 for r in rows if r['pad'] > 0.6), sum(1 for r in rows if r['ratio'] and r['ratio'] < 0.6),
        sum(1 for r in rows if r['mix'] and (r['mix'] > 1.5 or r['mix'] < 1 / 1.5))))
    for r in big[:top]:
        print('  大 %5.2f倍 %6.0fKB %s' % (r['ratio'], r['bytes'] / 1e3, r['rel']))


if __name__ == '__main__':
    main()

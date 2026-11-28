#!/usr/bin/env python3
"""助手の絵の縁を原本と比べる検査(助手部ナカヨシ・2026-11-28 r1126-095 追記2)。

社長「やっぱまだ助手の画質悪い気がする。ソラシド探偵の顔周りとか」「全体的に際が荒い」
「最近こういうぼやけ加工になってるのが多くて助手全部直したんだけど、新着替えでまた同じ現象だから実装の仕方が悪いよね」。
前の検査(life-fullbody-edge-check.js)は出来上がりだけを見て「縁に半透明が多いか」を数えていたので、ぼかすほど通っていた。
ここでは原本と出来上がりを同じ物差し(art_edge_metrics.py)で測り、原本より悪ければ落とす:
  白い縁取り(縁の明るさの浮き)・外の線の消え・ギザギザ(輪郭の長さ)・ぼやけ(縁の半透明の幅)

比べる組(原本と1対1に決まる物すべて):
  ・全身 fullbody/<名前>(__<表情>) … tools/assistant/life-fullbody-art.py の ART(1枚の原本・AI 拡大した物は元の原本)と、
    表情のシート(SEAM/GRID/SPLIT・みゅあの8表情)から切った1マス
  ・半身の置き場 santa/<接頭辞>_<表情> … サンタ服は全身の写し。ドラは原本そのまま
比べない物: 立ち絵・顔アイコン(全身を切って縮めただけ。縁は全身で決まる)、正本が「ゲームで使っているファイルそのもの」の組(原本が無い)。
使い方: python3 tools/assistant/art-edge-check.py [--all] [--only <名前の一部>] [--json 出す先]
  ふつうは落ちた絵だけ出す。--all で全部の数を出す。最後の行が OK / NG
落ちたら: 絵を手で直さない・線をゆるめない。tools/assistant/life-fullbody-art.py で作り直す(新しい服は art_edge.compose を通る)
作り直し待ち: tools/assistant/art-edge-pending.json に載せた絵は、落ちても「待ち」と出すだけ(作り直すまでのあいだ)。
  一覧は減らすだけ。載せた絵が通るようになったら NG(一覧から外す)。新しい絵をここへ足して通すのは禁止
"""
import glob, importlib.util, json, os, sys
import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..'))
sys.path.insert(0, HERE)
import art_edge_metrics as M  # noqa: E402
import art_webp  # noqa: E402
import art_source  # noqa: E402

IMG = os.path.join(ROOT, 'monster-hero/images/assistant')
PENDING = os.path.join(HERE, 'art-edge-pending.json')


def load_tool(name):
    spec = importlib.util.spec_from_file_location(name.replace('-', '_'), os.path.join(HERE, name + '.py'))
    m = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(m)
    return m


def pairs():
    """(配信の絵の道筋, 原本(道筋か配列), 説明) の一覧"""
    fb = load_tool('life-fullbody-art')
    out = []
    for key in fb.ART:
        if art_source.refuse(art_source.group_of(key, 'fullbody')):
            continue
        served = art_webp.existing(os.path.join(fb.OUT, fb.out_name(key) + '.png'))
        if not os.path.exists(served):
            continue
        orig = fb.edge_source(key)[0]
        out.append((served, orig, os.path.relpath(orig, ROOT)))
    # 表情のシートから切った1マス(切り方は道具と同じ関数で)
    cells = []
    for key, sheets in fb.SEAM_SHEETS.items():
        if art_source.refuse(art_source.group_of(key, 'fullbody')):
            continue
        for file, rows, exprs, per_row in sheets:
            cells += [(key, e, a, file) for e, a in zip(exprs, fb.seam_cells(file, rows, per_row))]
    for key, sheets in list(fb.GRID_SHEETS.items()) + list(fb.SPLIT_SHEETS.items()):
        if art_source.refuse(art_source.group_of(key, 'fullbody')):
            continue
        for file, exprs, cy, cx in sheets:
            cells += [(key, e, a, file) for e, a in zip(exprs, fb.split_cells(file, cy, cx))]
    for key, e, a, file in cells:
        served = art_webp.existing(os.path.join(fb.OUT, '%s__%s.png' % (key.replace(':', '_'), e)))
        if os.path.exists(served):
            out.append((served, np.array(a), '%s の1マス(%s)' % (file, e)))
    try:
        cs, _ = fb.sheet_cells()
        for base, rows in cs.items():
            for e, c in rows:
                served = art_webp.existing(os.path.join(fb.OUT, '%s__%s.png' % (base, e)))
                if os.path.exists(served) and not art_source.refuse(art_source.group_of(base.replace('_', ':', 1), 'fullbody')):
                    out.append((served, np.array(c.convert('RGBA')), 'みゅあの8表情のシートの1マス(%s)' % e))
    except SystemExit:
        pass
    # 半身の置き場(サンタ服=全身の写し・ドラ=原本そのまま)
    xm = load_tool('life-xmas-art-remake')
    for key, (name, prefix) in xm.SETS.items():
        if not key.endswith(':santa'):
            continue
        for e in xm.EXPR:
            served = os.path.join(xm.BUST, '%s_%s.webp' % (prefix, e))
            k = '%s@%s' % (key, e)
            if os.path.exists(served) and k in fb.ART:
                orig = fb.edge_source(k)[0]
                out.append((served, orig, os.path.relpath(orig, ROOT)))
    for p in sorted(glob.glob(os.path.join(ROOT, 'tools/art-sources/assistants/dra/santa/received/dra_santa_*.png'))):
        e = os.path.basename(p)[len('dra_santa_'):-4]
        served = os.path.join(IMG, 'santa', 'dra_%s.webp' % e)
        if os.path.exists(served):
            out.append((served, p, os.path.relpath(p, ROOT)))
    return out


def main():
    show_all = '--all' in sys.argv
    only = sys.argv[sys.argv.index('--only') + 1] if '--only' in sys.argv else None
    pending = {}
    if os.path.exists(PENDING):
        with open(PENDING, encoding='utf-8') as fp:
            pending = json.load(fp).get('files', {})
    rows, bad, waiting, cleared = [], [], [], []
    for served, orig, label in pairs():
        rel = os.path.relpath(served, IMG)
        if only and only not in rel:
            continue
        d, s = M.compare(orig, served)
        f = M.failures(d)
        rows.append({'file': rel, 'source': label, 'scale': round(s, 3), **{k: round(v, 4) for k, v in d.items()}, 'fail': f})
        mark = 'NG' if f else 'ok'
        if f and rel in pending:
            waiting.append(rel)
            mark = '待ち'
        elif f:
            bad.append(rows[-1])
        elif rel in pending:
            cleared.append(rel)
            mark = '外す'
        if (f and rel not in pending) or show_all or rel in cleared:
            print('%s %-44s %s  原本 %s' % (mark, rel, M.fmt(d), label))
    if '--json' in sys.argv:
        with open(sys.argv[sys.argv.index('--json') + 1], 'w', encoding='utf-8') as fp:
            json.dump(rows, fp, ensure_ascii=False, indent=1)
    if waiting:
        print('作り直し待ち %d 枚(%s)' % (len(waiting), os.path.relpath(PENDING, ROOT)))
    if cleared:
        print('NG: 作り直し待ちの一覧に載っているが、もう通る絵 %d 枚。一覧から外す: %s' % (len(cleared), ' '.join(cleared)))
        sys.exit(1)
    if bad:
        print('NG: 原本より縁が悪い絵 %d / %d 枚(線: %s)。tools/assistant/life-fullbody-art.py で作り直す(手で直さない・線をゆるめない)'
              % (len(bad), len(rows), ' '.join('%s %s' % (M.LABEL[k], v) for k, v in M.LIMITS.items())))
        sys.exit(1)
    print('OK: 助手の絵の縁は原本より悪くない(%d 枚)' % len(rows))


if __name__ == '__main__':
    main()

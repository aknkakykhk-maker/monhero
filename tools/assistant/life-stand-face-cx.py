"""立ち絵(images/assistant/stand-*/<接頭辞>_normal.png)の顔の横の真ん中 cx を測り、顔の表へ書く(助手部ナカヨシ)。

2026-11-24 r1119-153 追記4: モードえらびの枠(モンヒロバトル・MFバトルカード・モンヒロビート)で、立ち絵を顔の位置と大きさで寄せるのに使う。
  新しい全身絵からの切り出しは、羽・上げた腕まで入るので、絵の真ん中と顔の真ん中が合わない。
  cx … 見えている体(透けていない所)の左を0・右を1とした、顔の横の真ん中。
  測り方は life-stand-from-fullbody.py の顔アイコンと同じ: 目の線の高さで、いちばん長くつながった不透明な所(頭)の真ん中
  (目の大きい絵柄・上げた腕・羽に引かれない)。

使い方: python3 -I tools/assistant/life-stand-face-cx.py [--write]
  --write … 56-assistant-life-house.jsx の ASSISTANT_LIFE_STAND_FACE_OUTFIT の stand-* の行へ cx を書く(無ければ足す・あれば直す)
"""
import os
import re
import sys

import numpy as np
from PIL import Image

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
HOUSE = os.path.join(ROOT, 'monster-hero/src/parts/56-assistant-life-house.jsx')
IMG = os.path.join(ROOT, 'monster-hero/images/assistant')
ALPHA = 40
# 助手id → 絵の接頭辞(data/assistants.js の imagePrefix)
PREFIX = dict(mua='myua', kiki='kiki', momosuke='momosuke', atsu='atsu', kyuko='kyuko', sorashido='sorashido', erubin='erubin')


EXPR = ('normal', 'happy', 'wink', 'surprise', 'troubled', 'angry', 'crying', 'excited')


def face_cx(path, eye):
    """見えている体の中での顔の横の真ん中(0〜1)。eye は見えている体の上を0・下を1とした目の線。
    8表情は normal と同じ枠・同じ顔の位置に重ねてあるので、8枚で測った真ん中の値をとる
    (みゅあ ふだんの normal は上げた腕が目の高さで頭とつながり、1枚だけだと左へずれた)。範囲は normal の見えている体"""
    a = np.asarray(Image.open(path).convert('RGBA'))
    on = a[..., 3] > ALPHA
    ys, xs = np.nonzero(on)
    t, b, l, r = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
    y = int(round(t + (b - t) * eye))
    vals = []
    for e in EXPR:
        pe = path.replace('_normal.png', '_%s.png' % e)
        if not os.path.exists(pe):
            continue
        ae = np.asarray(Image.open(pe).convert('RGBA'))
        if ae.shape[:2] != a.shape[:2]:
            continue
        vals.append(_run_cx(ae[..., 3] > ALPHA, y, (l + r) / 2.0))
    hx = float(np.median(vals)) if vals else (l + r) / 2.0
    return round(float((hx - l) / (r - l)), 4)


def _run_cx(on, y, fallback):
    """目の線の高さで、いちばん長くつながった不透明な所の真ん中(画素)"""
    row = on[min(max(y, 0), on.shape[0] - 1)]
    best, run0 = (0, 0, 0), None
    for x in range(len(row) + 1):
        o = x < len(row) and row[x]
        if o and run0 is None:
            run0 = x
        if not o and run0 is not None:
            if x - run0 > best[0]:
                best = (x - run0, run0, x)
            run0 = None
    return (best[1] + best[2]) / 2.0 if best[0] else fallback


def main():
    write = '--write' in sys.argv
    lines = open(HOUSE, encoding='utf-8').read().split('\n')
    start = next(i for i, ln in enumerate(lines) if ln.startswith('const ASSISTANT_LIFE_STAND_FACE_OUTFIT'))
    n = 0
    for i in range(start + 1, len(lines)):
        ln = lines[i]
        if ln.startswith('});'):
            break
        m = re.match(r"\s*'(stand-[a-z0-9-]+)': \{", ln)
        if not m:
            continue
        stand = m.group(1)
        for pid, body in re.findall(r'(?<![\w-])([a-z]+): \{([^{}]*)\}', ln):
            em = re.search(r'eye: (-?[0-9.]+)', body)
            path = os.path.join(IMG, stand, '%s_normal.png' % PREFIX.get(pid, pid))
            if not em or not os.path.exists(path):
                continue
            cx = face_cx(path, float(em.group(1)))
            nb = re.sub(r', cx: -?[0-9.]+', '', body).rstrip()
            nb = re.sub(r'( m: [0-9.]+)', r'\1, cx: %s' % cx, nb, count=1)
            ln = ln.replace('%s: {%s}' % (pid, body), '%s: {%s }' % (pid, nb), 1)
            print('%s %s: cx=%s' % (stand, pid, cx))
            n += 1
        lines[i] = ln
    if write:
        open(HOUSE, 'w', encoding='utf-8').write('\n'.join(lines))
        print('書いた: %d 組' % n)
    else:
        print('測った: %d 組(--write で表へ書く)' % n)


if __name__ == '__main__':
    main()

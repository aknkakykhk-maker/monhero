#!/usr/bin/env python3
# 譜面の版を左右に並べた比べ絵(PNG)を描く(2026-11-22・ビート・台帳 r1119-105)。
#
#   python3 -I tools/mode/rhythm-chart-compare-png.py <versions.json> <parts-table.json> <full|short> <from秒> <to秒> <出力.png> [題]
#
#   versions.json は rhythm-chart-versions-export.js が書く。時間は下から上へ。レーンは12のサブレーン(左半分=左手・右半分=右手)。
#   色: 地上タップ=水色・フリック=黄・ホールド=緑・スライド=紫・空中=桃色(枠)。押さえ中の交差の秒は赤い帯で示す。
#   左の帯は歌い分け(女声=赤系・男声=青系・2人=紫・間奏=灰)
import sys, json
from PIL import Image, ImageDraw, ImageFont

FONT = '/usr/share/fonts/opentype/ipafont-gothic/ipag.ttf'

def main():
    vpath, ppath, table, t0, t1, outp = sys.argv[1:7]
    title = sys.argv[7] if len(sys.argv) > 7 else ''
    t0, t1 = float(t0) * 1000, float(t1) * 1000
    data = json.load(open(vpath))
    parts = json.load(open(ppath))[table]
    vers = data['versions']
    PX = 0.11  # 1ms あたりの画素
    COLW, LANE, GAP, SIDE, TOP, BOT = 252, 20, 26, 120, 100, 30
    H = int((t1 - t0) * PX) + TOP + BOT
    W = SIDE + len(vers) * (COLW + GAP) + 10
    img = Image.new('RGB', (W, H), (18, 20, 28))
    d = ImageDraw.Draw(img)
    f = ImageFont.truetype(FONT, 17)
    fs = ImageFont.truetype(FONT, 14)
    ft = ImageFont.truetype(FONT, 20)
    y_of = lambda t: H - BOT - (t - t0) * PX
    # 歌い分けの帯
    vc = {'女声': (200, 70, 90), '男声': (60, 110, 210), '女声(男声の低い重ね)': (220, 110, 120), '2人': (150, 80, 190), '間奏': (90, 90, 90)}
    for p in parts:
        a, b = p['start'] * 1000, p['end'] * 1000
        if b < t0 or a > t1:
            continue
        ya, yb = y_of(max(a, t0)), y_of(min(b, t1))
        d.rectangle([6, yb, SIDE - 10, ya], fill=vc.get(p['voice'], (90, 90, 90)))
        label = {'女声(男声の低い重ね)': '女声+低い男声'}.get(p['voice'], p['voice'])
        d.text((10, yb + 3), label, font=fs, fill=(255, 255, 255))
        d.text((10, yb + 20), (p['lyrics'] or '')[:7], font=fs, fill=(230, 230, 230))
    # 秒の目盛り
    s = int(t0 // 1000)
    while s * 1000 <= t1:
        if s * 1000 >= t0:
            y = y_of(s * 1000)
            d.line([SIDE - 8, y, W, y], fill=(40, 44, 56))
            d.text((SIDE - 44, y - 8), f'{s}s', font=fs, fill=(160, 160, 170))
        s += 1
    heads = []
    for k, v in enumerate(vers):
        x0 = SIDE + k * (COLW + GAP)
        cx = lambda sub: x0 + 12 + sub * LANE
        d.rectangle([x0, TOP - 4, x0 + COLW, H - BOT], outline=(70, 74, 90))
        d.line([cx(6), TOP, cx(6), H - BOT], fill=(80, 84, 100), width=2)
        n_in = [n for n in v['notes'] if (n.get('endTimeMs') or n['timeMs']) >= t0 and n['timeMs'] <= t1]
        cr = [c for c in v['crosses'] if t0 <= c <= t1]
        heads.append((x0, v['label'], f"Lv.{v['level']}・この範囲 {len(n_in)}個", f"押さえ中の交差 {len(cr)}", bool(cr)))
        for c in cr:
            y = y_of(c)
            d.rectangle([x0 + 1, y - 5, x0 + COLW - 1, y + 5], fill=(120, 20, 30))
        # 帯を先に
        for n in n_in:
            if n['type'] == 'HOLD':
                a, b = y_of(n['timeMs']), y_of(n['endTimeMs'])
                d.rectangle([cx(n['subLane']) + 3, b, cx(n['subLane'] + n['subLaneWidth']) - 3, a], fill=(40, 120, 70))
            elif n['type'] == 'SLIDE':
                pts = n['slidePoints']
                sky = any((p.get('sky') or 0) > 0 for p in pts)
                col = (220, 90, 170) if sky else (130, 80, 200)
                for p, q in zip(pts, pts[1:]):
                    ca, cb = cx(p['lane'] * 2 + 1), cx(q['lane'] * 2 + 1)
                    wa = p.get('subLaneWidth', 2) * LANE / 2 - 3
                    d.polygon([(ca - wa, y_of(p['timeMs'])), (ca + wa, y_of(p['timeMs'])), (cb + wa, y_of(q['timeMs'])), (cb - wa, y_of(q['timeMs']))], fill=col)
        for n in n_in:
            if n['type'] in ('TAP', 'FLICK', 'HOLD'):
                y = y_of(n['timeMs'])
                a, b = cx(n['subLane']) + 1, cx(n['subLane'] + n['subLaneWidth']) - 1
                sky = n.get('skyHeight')
                col = {'TAP': (90, 200, 240), 'FLICK': (240, 210, 70), 'HOLD': (80, 210, 120)}[n['type']]
                if sky:
                    d.rectangle([a, y - 6, b, y + 6], fill=(255, 120, 190), outline=(255, 255, 255))
                else:
                    d.rectangle([a, y - 5, b, y + 5], fill=col)
            elif n['type'] == 'SLIDE':
                p = n['slidePoints'][0]
                c = cx(p['lane'] * 2 + 1)
                y = y_of(n['timeMs'])
                d.rectangle([c - LANE + 1, y - 5, c + LANE - 1, y + 5], fill=(200, 160, 255))
    # 見出しは最後に(範囲の外へはみ出した帯を隠す)
    d.rectangle([0, 0, W, TOP - 5], fill=(18, 20, 28))
    d.rectangle([0, H - BOT + 1, W, H], fill=(18, 20, 28))
    d.text((10, 8), title, font=ft, fill=(240, 240, 240))
    for x0, label, a, b, bad in heads:
        d.text((x0 + 4, TOP - 66), label, font=f, fill=(255, 255, 255))
        d.text((x0 + 4, TOP - 44), a, font=fs, fill=(200, 200, 210))
        d.text((x0 + 4, TOP - 24), b, font=fs, fill=(255, 150, 150) if bad else (150, 230, 150))
    d.text((10, H - BOT + 6), '水色=タップ 黄=フリック 緑=ホールド 紫=スライド 桃=空中 赤い帯=押さえ中の交差 / 真ん中の線より左=左手・右=右手', font=fs, fill=(170, 170, 180))
    img.save(outp)
    print(outp, img.size)

if __name__ == '__main__':
    main()

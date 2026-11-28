"""重い助手の絵を WebP で書き出す(助手部ナカヨシ・2026-11-28 r1126-095)。

社長「助手画像が全部荒い」→ クリスマスの服を原本から2倍で作り直した。PNG のままだと1枚 3〜4MB になり、
ゲーム内ダウンロード(バトル)が重くなりすぎるので、見た目を落とさない WebP(画質90・透明はそのまま)で置く。
どの絵を WebP にするかは、ゲーム側の assistantArtFile(data/assistants.js の ASSISTANT_WEBP_ART_RE)と同じ決まり:
  ・fullbody/<名前>_santa(__<表情>).png  全身
  ・santa/<接頭辞>_<表情>.PNG             半身の置き場(全身の絵を置く)。顔アイコン santa/face/ は軽いので PNG のまま
  ・stand-santa/<接頭辞>_<表情>.png       立ち絵
  ・きゅうこの冬服の全身 fullbody/kyuko_winter(__<表情>).png と立ち絵 stand-winter/(半身の置き場 winter/ は受け取った絵のままなので PNG)
  served(path) … その絵の配信の道筋(WebP にする絵なら .webp)
  existing(path) … 読むとき: 配信の道筋にあればそれ、無ければ元の道筋
  save(im, path) … 書くとき: WebP にする絵なら .webp で書き、同じ名前の古い PNG を消す。書いた道筋を返す
"""
import os
import re

RULE = re.compile(r'(images/assistant/(?:santa/(?!face/)[^/]+|stand-(?:santa|winter)/[^/]+|fullbody/[a-z]+_(?:santa|winter)(?:__[a-z]+)?))\.(?:PNG|png)$')
QUALITY = 90


def served(path):
    p = path.replace(os.sep, '/')
    return RULE.sub(r'\1.webp', p) if RULE.search(p) else path


def existing(path):
    s = served(path)
    return s if os.path.exists(s) else path


def save(im, path):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    out = served(path)
    if out != path:
        im.save(out, 'WEBP', quality=QUALITY, method=6, alpha_quality=100)
        if os.path.exists(path):
            os.remove(path)
    else:
        im.save(path, optimize=True)  # 色を減らさない(2026-11-15 r1115-143)
    return out

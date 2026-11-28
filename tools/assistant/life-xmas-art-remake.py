#!/usr/bin/env python3
"""クリスマスの助手の絵(サンタ服7人・きゅうこの冬服)を、拡大した原本から作り直す(助手部ナカヨシ・2026-11-28 r1126-095)。

社長「助手画像が全部荒い」→「クリスマスで出したやつは原本全部あるはずだから直して」。
  0. 原本を拡大の道具で2倍に(済み: tools/art-sources/assistants/<キャラ>/santa/upscaled-2026-11-28/received/・kyuko/winter/upscaled-2026-11-28/fullbody/。
     作り方は tools/image/upscale-anime/upscale.py の先頭)
  1. 全身 … tools/assistant/life-fullbody-art.py --only <名前>(縁の掃除・WebP 画質90)
  2. 半身の置き場 santa/<接頭辞>_<表情>.webp … 全身の絵の写し(前からの決まり: 全身の絵をバスト絵の置き場に置く)
  3. 立ち絵・顔アイコン・顔の表 … tools/assistant/life-stand-from-fullbody.py --only <キー> --write
     (目印は全身が替わると自動で移る。顔の切り方は life-stand-cut.json のまま=頭の位置・大きさは前と同じ。冬服は --stand-only で顔を残す)
  ドラ(顔だけの絵)は別の道具 life-dra-santa-art.py
使い方: python3 tools/assistant/life-xmas-art-remake.py [--who kiki,mua]
"""
import os, sys, shutil, subprocess

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
HERE = os.path.dirname(os.path.abspath(__file__))
FB = os.path.join(ROOT, 'monster-hero/images/assistant/fullbody')
BUST = os.path.join(ROOT, 'monster-hero/images/assistant/santa')
EXPR = ['normal', 'happy', 'wink', 'surprise', 'troubled', 'angry', 'crying', 'excited', 'sleep']
# キー(助手id:服) → (全身の名前, 接頭辞)
SETS = {
    'mua:santa': ('mua_santa', 'myua'), 'kiki:santa': ('kiki_santa', 'kiki'), 'momosuke:santa': ('momosuke_santa', 'momosuke'),
    'sorashido:santa': ('sorashido_santa', 'sorashido'), 'atsu:santa': ('atsu_santa', 'atsu'), 'erubin:santa': ('erubin_santa', 'erubin'),
    'kyuko:santa': ('kyuko_santa', 'kyuko'), 'kyuko:winter': ('kyuko_winter', 'kyuko'),
}


def run(*args):
    print('$', ' '.join(args))
    subprocess.run([sys.executable] + list(args), cwd=ROOT, check=True)


def main():
    who = sys.argv[sys.argv.index('--who') + 1].split(',') if '--who' in sys.argv else None
    for key, (name, prefix) in SETS.items():
        if who and key.split(':')[0] not in who and key not in who:
            continue
        run(os.path.join(HERE, 'life-fullbody-art.py'), '--only', name)
        if key.endswith(':santa'):
            for e in EXPR:
                src = os.path.join(FB, '%s__%s.webp' % (name, e))
                if os.path.exists(src):
                    shutil.copyfile(src, os.path.join(BUST, '%s_%s.webp' % (prefix, e)))
                    old = os.path.join(BUST, '%s_%s.PNG' % (prefix, e))
                    if os.path.exists(old):
                        os.remove(old)
        run(os.path.join(HERE, 'life-stand-from-fullbody.py'), '--only', key, '--write', *(['--stand-only'] if key == 'kyuko:winter' else []))


if __name__ == '__main__':
    main()

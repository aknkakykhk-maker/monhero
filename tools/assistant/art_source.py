"""助手の絵の原本の場所を引く・旧版から絵を作らないように断る(2026-11-23 台帳 r1119-124・r1119-128)。

原本はキャラごとのフォルダ tools/art-sources/assistants/<キャラ>/<服>/ にある(目録は各キャラの CATALOG.md)。
旧版は保管庫 archive/old-art/ へ移してあり、道具からは読まない。
  src(name)        … 原本のファイル名から道筋を返す。保管庫にしか無い(=旧版)ときは、理由を出して止める
  is_self(group)   … 目録で、その組(<キャラ>/<服>/<種類>)の正本が「現行のファイルそのもの」か
  refuse(group)    … 正本が「現行のファイルそのもの」の組なら True を返して、作らない理由を出す(道具はその組を飛ばす)
"""
import glob, json, os, sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
SOURCES = os.path.join(ROOT, 'tools/art-sources/assistants')
OLD = os.path.join(ROOT, 'archive/old-art')
CATALOG = os.path.join(ROOT, 'tools/image/assistant-art-catalog.json')
_catalog = None
_told = set()


def _find(base, name):
    return sorted(p for p in glob.glob(os.path.join(base, '**', name), recursive=True) if os.path.isfile(p))


def src(name):
    hit = _find(SOURCES, name)
    if len(hit) == 1:
        return hit[0]
    if len(hit) > 1:
        sys.exit('原本 %s が2か所にある: %s' % (name, ' , '.join(os.path.relpath(p, ROOT) for p in hit)))
    old = _find(OLD, name)
    if old:
        sys.exit('%s は旧版(保管庫 %s)。旧版から絵は作らない。正本は tools/art-sources/assistants/<キャラ>/CATALOG.md で確かめる'
                 % (name, os.path.relpath(os.path.dirname(old[0]), ROOT)))
    sys.exit('原本 %s が tools/art-sources/assistants/ の下に無い' % name)


def catalog():
    global _catalog
    if _catalog is None:
        with open(CATALOG, encoding='utf-8') as f:
            _catalog = json.load(f)
    return _catalog


def group_of(key, kind):
    """道具のキー('mua'・'mua:halloween'・'mua@happy')と種類(fullbody・stand・bust・face)から、目録の組の名前"""
    who, _, outfit = key.split('@')[0].partition(':')
    return '%s/%s/%s' % (who, outfit or 'normal', kind)


def is_self(group):
    g = catalog()['groups'].get(group)
    return bool(g) and g.get('master') == 'self'


def refuse(group):
    if not is_self(group):
        return False
    if group in _told:
        return True
    _told.add(group)
    print('飛ばす: %s の正本は、ゲームで使っているファイルそのもの(完成品を直接入れた物)。道具で作り直さない(目録 tools/art-sources/assistants/%s/CATALOG.md)'
          % (group, group.split('/')[0]))
    return True

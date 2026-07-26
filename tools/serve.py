#!/usr/bin/env python3
"""検証用の簡易HTTPサーバー(リポジトリのルートを配信する)。

    python3 tools/serve.py        # http://localhost:8899 で配信

`python3 -m http.server` は1リクエストずつしか処理できないため、
BGMのmp3(合計約20MB)を読み込んでいるあいだ他のファイルが返せず、
ページの読み込みが止まってしまう。実機やGitHub Pagesは並行して配信するので、
検証環境でも同じ条件になるようスレッド対応のサーバーを使う。
"""
import os
import sys
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8899
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=ROOT, **kwargs)

    def log_message(self, *args):
        pass  # アクセスログは出さない


if __name__ == '__main__':
    print(f'{ROOT} を http://localhost:{PORT} で配信します (Ctrl+C で停止)')
    ThreadingHTTPServer(('127.0.0.1', PORT), Handler).serve_forever()

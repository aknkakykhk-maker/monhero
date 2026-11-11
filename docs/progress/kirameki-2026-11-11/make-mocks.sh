#!/bin/sh
# look-mock.js から、案ごとの写しを作る(先頭に案の名前を足すだけ)
cd "$(dirname "$0")" && for v in A B C C2; do { echo "window.__MH_LOOK='$v';"; cat look-mock.js; } > look-mock-$v.js; done

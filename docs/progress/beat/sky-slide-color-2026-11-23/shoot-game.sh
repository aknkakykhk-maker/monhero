#!/bin/bash
# ゲーム本体の止め絵(前=origin/main・後=今の作業)を3場面×縦横で撮る(台帳 r1119-149)
#   bash docs/progress/beat/sky-slide-color-2026-11-23/shoot-game.sh
cd "$(dirname "$0")/../../../.." || exit 1
D=docs/progress/beat/sky-slide-color-2026-11-23/game
TMP=$(mktemp -d)
for sc in "grievous_lady 12.90" "kiki_issen 37.25" "beyond_the_same_sky 24.50"; do set -- $sc
 for o in yoko tate; do if [ $o = yoko ]; then W=844;H=390; else W=390;H=844; fi
  for v in before after; do REV=""; [ $v = before ] && REV="${BASE_REV:-origin/main}"
   RHYTHM_REV=$REV SONG_ID=$1 DIFF=HELL FROM=$2 TO=$(echo "$2+0.05"|bc) STEP=50 SHOT_EVERY=1 W=$W H=$H OUT=$TMP/$v node tools/mode/rhythm-note-appear-scan.js >/dev/null 2>&1
   f=$(ls -t $TMP/$v/step-*.png 2>/dev/null | head -1); [ -n "$f" ] && mv "$f" $D/$1-$o-$v.png && echo "$D/$1-$o-$v.png"
  done; done; done
rm -rf "$TMP"

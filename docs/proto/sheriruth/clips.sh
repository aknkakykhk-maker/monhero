#!/bin/bash
# 案ごとに自動演奏を録って、空中のタップ(試作の2〜6秒)と2本のスライド(8〜12秒)を切り出した短い動画と、止めた画像を作る
#   clips.sh <出力先> <案> [<案> …]
S=/tmp/claude-0/-home-user-monhero/3709cb08-9b37-5326-a0c5-0e46f2e4f8ed/scratchpad/sheri
FF=$S/../ffwork/node_modules/ffmpeg-static/ffmpeg
OUT=$1; shift
mkdir -p $OUT
cd /home/user/monhero
for st in "$@"; do
  rm -rf $OUT/rec-$st
  zero=$(SKY_STYLE=$st timeout 300 node $S/record-style.js $OUT/rec-$st 2>&1 | grep "曲の0秒" | sed 's/.*録画の \([0-9.]*\) 秒.*/\1/')
  v=$(ls $OUT/rec-$st/*.webm | head -1)
  a=$(echo "$zero + 2.0" | bc); b=$(echo "$zero + 8.0" | bc)
  $FF -v error -y -ss $a -t 4 -i $v -vf "fps=30,scale=390:844" -c:v libx264 -pix_fmt yuv420p -crf 22 $OUT/$st-taps.mp4
  $FF -v error -y -ss $b -t 4 -i $v -vf "fps=30,scale=390:844" -c:v libx264 -pix_fmt yuv420p -crf 22 $OUT/$st-arcs.mp4
  $FF -v error -y -ss $(echo "$zero + 4.2" | bc) -i $v -frames:v 1 $OUT/$st-still.png
  echo "$st 0秒=$zero"
done

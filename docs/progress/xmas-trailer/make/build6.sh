#!/bin/bash
# 予告編 第6版を作る。使い方: build6.sh <リポジトリ> <作業フォルダ>(撮った画面は <作業フォルダ>/v5/shots/)
set -e; REPO=$1; S=$2; A=$REPO/monster-hero/audio; KISS=$A/bgm-kiss-mystery.mp3; cd $S
node work/text.js $S; node work/game.js $S
(cd work && python3 -I compose6.py $REPO $S $S/video6.mp4 | tail -1)
read TB TH DUR < <(cd work && python3 -I compose6.py $REPO $S times)
# 柱時計の鐘(3回)を作る
ffmpeg -v error -y -f lavfi -i "aevalsrc=0.45*(sin(2*PI*196*t)+0.6*sin(2*PI*392.5*t)+0.35*sin(2*PI*588*t)+0.2*sin(2*PI*1034*t))*exp(-1.4*t):s=44100:d=3.2" -ac 2 bell1.wav
AF=$(python3 -I -c "
tb,th,du=$TB,$TH,$DUR; b=[tb,tb+1.0,tb+2.0]
g=th-tb; k=du-th
print(f'[0]atrim=0:{tb+0.4:.2f},afade=t=in:d=0.6,afade=t=out:st={tb-0.6:.2f}:d=0.9[a];'
      f'[1]atrim=0:{g:.2f},volume=0.85,afade=t=in:d=1.4,afade=t=out:st={g-1.0:.2f}:d=0.95,adelay={int(tb*1000)}|{int(tb*1000)}[b];'
      f'[2]atrim=0:{k:.2f},afade=t=in:d=0.03,afade=t=out:st={k-1.6:.2f}:d=1.6,adelay={int(th*1000)}|{int(th*1000)}[c];'
      + ''.join(f'[3]adelay={int(x*1000)}|{int(x*1000)}[d{i}];' for i,x in enumerate(b)) +
      f'[a][b][c][d0][d1][d2]amix=inputs=6:normalize=0,atrim=0:{du},loudnorm=I=-16:TP=-1.5:LRA=11[o]')")
ffmpeg -v error -y -i $KISS -i $A/bgm-dullahan-steel-ghost.mp3 -ss 173.75 -i $KISS -i bell1.wav -filter_complex "$AF" -map "[o]" -ar 44100 -c:a aac -b:a 128k audio6.m4a
ffmpeg -v error -y -i video6.mp4 -c:v libx264 -preset slow -b:v 600k -pass 1 -passlogfile p6 -an -f mp4 /dev/null
ffmpeg -v error -y -i video6.mp4 -i audio6.m4a -c:v libx264 -preset slow -b:v 600k -pass 2 -passlogfile p6 -pix_fmt yuv420p -profile:v high -c:a aac -b:a 96k -shortest -movflags +faststart xmas-2026-trailer-v6.mp4
PT=$(python3 -I -c "print($DUR-1.6)"); ffmpeg -v error -y -ss $PT -i video6.mp4 -frames:v 1 -q:v 3 poster6.jpg

#!/bin/bash
# 使い方: build.sh <リポジトリ> <作業フォルダ>
set -e; REPO=$1; S=$2; A=$REPO/monster-hero/audio; KISS=${KISS:-$A/bgm-kiss-mystery.mp3}; cd $S
node work/text.js $S
node work/game.js $S
python3 -I work/compose.py $REPO $S $S/video.mp4 | tail -1
read TD TH DUR < <(python3 -I work/compose.py $REPO $S times)
AF=$(python3 -I -c "
td,th,du=$TD,$TH,$DUR; gap=th-td; cs=max(13.3,34.4-gap); k2=du-th
print(f'{cs:.2f}|[0]atrim=0:{td+1.5:.2f},afade=t=in:d=0.8,afade=t=out:st={td-0.7:.2f}:d=2.2[a];[1]atrim=0:{gap:.2f},afade=t=in:d=1.2,afade=t=out:st={gap-1.4:.2f}:d=1.4,adelay={int(td*1000)}|{int(td*1000)}[b];[2]atrim=0:{k2:.2f},afade=t=in:d=0.03,afade=t=out:st={k2-1.6:.2f}:d=1.6,adelay={int(th*1000)}|{int(th*1000)}[c];[a][b][c]amix=inputs=3:normalize=0,atrim=0:{du},loudnorm=I=-16:TP=-1.5:LRA=11[o]')")
ffmpeg -v error -y -i $KISS -ss ${AF%%|*} -i $A/bgm-dullahan-clockwork.mp3 -ss 173.75 -i $KISS -filter_complex "${AF#*|}" -map "[o]" -ar 44100 -c:a aac -b:a 128k audio.m4a
ffmpeg -v error -y -i video.mp4 -c:v libx264 -preset slow -b:v 600k -pass 1 -passlogfile p2 -an -f mp4 /dev/null
ffmpeg -v error -y -i video.mp4 -i audio.m4a -c:v libx264 -preset slow -b:v 600k -pass 2 -passlogfile p2 -pix_fmt yuv420p -profile:v high -c:a aac -b:a 96k -shortest -movflags +faststart xmas-2026-trailer.mp4
PT=$(python3 -I -c "print($DUR-1.6)"); ffmpeg -v error -y -ss $PT -i video.mp4 -frames:v 1 -q:v 3 poster.jpg

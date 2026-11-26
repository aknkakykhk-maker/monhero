#!/bin/bash
# 使い方: build.sh <リポジトリ> <作業フォルダ>
set -e; REPO=$1; S=$2; A=$REPO/monster-hero/audio; cd $S
node work/text.js $S
python3 -I work/compose.py $REPO $S $S/video.mp4 | tail -1
ffmpeg -v error -y -i $A/bgm-close-to-your-heart-alt.mp3 -ss 6.9 -i $A/bgm-dullahan-clockwork.mp3 -filter_complex "[0]atrim=0:19,afade=t=in:d=1.0,afade=t=out:st=16.8:d=2.2[a];[1]atrim=0:20.5,afade=t=in:d=1.2,afade=t=out:st=19.0:d=1.5,adelay=17500|17500[b];[a][b]amix=inputs=2:normalize=0,atrim=0:38,loudnorm=I=-16:TP=-1.5:LRA=11[o]" -map "[o]" -ar 44100 -c:a aac -b:a 128k audio.m4a
ffmpeg -v error -y -i video.mp4 -c:v libx264 -preset slow -b:v 700k -pass 1 -passlogfile p2 -an -f mp4 /dev/null
ffmpeg -v error -y -i video.mp4 -i audio.m4a -c:v libx264 -preset slow -b:v 700k -pass 2 -passlogfile p2 -pix_fmt yuv420p -profile:v high -c:a aac -b:a 96k -shortest -movflags +faststart xmas-2026-trailer.mp4
ffmpeg -v error -y -ss 36.4 -i video.mp4 -frames:v 1 -q:v 3 poster.jpg

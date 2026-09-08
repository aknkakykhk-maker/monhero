#!/usr/bin/env node
// モンヒロビートの曲が、どれも同じ大きさで鳴るか。
//
//   node tools/audio/rhythm-loudness-check.js
//   node tools/audio/rhythm-loudness-check.js --ffmpeg <ffmpegのパス>
//
// 【なぜ要るか】(2026-09-08・ユーザー指摘「禁断のレジスタンスの音だけ小さく感じる。
//  他と合わせて。今後実装するときに音量を全部同じにするように覚えといて」)
// 曲ごとに音の大きさが違うと、曲を変えるたびに端末の音量を触ることになる。
// 実際に「禁断のレジスタンス」-22.1 LUFS / 「風がそよぐ場所」-22.1 LUFS に対して
// ほかの曲は -13.3〜-15.2 LUFS と、8.8 LUFS(体感で2倍以上)ひらいていた。
//
// 【なぜファイル側でそろえるのか】
// BGM_TRACKS の gain では直せない。実装(14-audio.jsx の safeTrackGain)が
// 0〜1.25倍にクランプするので、+1.9dB までしか上げられない。必要だったのは +7.7dB。
// なので音源そのものを目標のラウドネスへそろえる。
//
// 【測っているもの】
// ITU-R BS.1770 の統合ラウドネス(LUFS)。ピークではなく「人が感じる大きさ」を測る。
// ffmpeg の loudnorm を1回通して読むだけで、音源には触らない。
//
// ffmpeg が無い環境では SKIP する(このリポジトリの本番CIにはffmpegが無い)。
'use strict';
const fs=require('fs');
const path=require('path');
const vm=require('vm');
const {spawnSync}=require('child_process');

const ROOT=path.resolve(__dirname,'..','..');
const arg=(name,fallback=null)=>{const i=process.argv.indexOf(name);return i>=0&&i+1<process.argv.length?process.argv[i+1]:fallback;};

// 目標。決め方は docs/spec/RHYTHM_MODE.md「曲の音量をそろえる」。
//   -14 LUFS … 既存曲(そろっていた13曲)の中央値がおよそ -14.2 LUFS だったので、そこへ合わせた
//   -1 dBTP … これ以上上げるとクリップする曲が出る。上限に当たったらそこで止める
const TARGET_LUFS=-14.0;
// そろっているとみなす幅。±1.5 LUFS は人がまず聞き分けられない範囲。
// 真のピークの上限に当たって目標へ届かない曲があるので、下側は少し広く取る。
const ALLOW_ABOVE=1.5;
const ALLOW_BELOW=2.5;

const findFfmpeg=()=>{
  const given=arg('--ffmpeg',null);
  if(given&&fs.existsSync(given))return given;
  const probe=spawnSync('ffmpeg',['-version'],{encoding:'utf8'});
  if(probe.status===0)return 'ffmpeg';
  // 作業用に入れた ffmpeg-static があれば使う(リポジトリの依存には入れない)
  for(const base of [process.env.MONHERO_FFMPEG_DIR,path.join(ROOT,'node_modules/ffmpeg-static/ffmpeg')]){
    if(base&&fs.existsSync(base))return base;
  }
  return null;
};

const measure=(ffmpeg,file)=>{
  const r=spawnSync(ffmpeg,['-hide_banner','-i',file,'-af','loudnorm=print_format=json','-f','null','-'],
    {encoding:'utf8',maxBuffer:256*1024*1024});
  const m=(r.stderr||'').match(/\{[^{}]*"input_i"[^{}]*\}/);
  if(!m)return null;
  const d=JSON.parse(m[0]);
  return {lufs:Number(d.input_i),truePeak:Number(d.input_tp)};
};

const ffmpeg=findFfmpeg();
if(!ffmpeg){
  console.log('--  ffmpeg が無いので飛ばす（--ffmpeg <パス> で場所を渡せます）');
  console.log('すべてOK');
  process.exit(0);
}

const context={Object,Number,Math,JSON,Array,String};
vm.runInNewContext(`${fs.readFileSync(path.join(ROOT,'monster-hero/data/rhythm-mode.js'),'utf8')}
this.out={RHYTHM_SONGS,RHYTHM_DEMO_SONG_IDS};`,context);
const {RHYTHM_SONGS,RHYTHM_DEMO_SONG_IDS}=context.out;

// bgmTrackId → 音源のパス（BGM_TRACKS が正本）
const jsx=fs.readFileSync(path.join(ROOT,'monster-hero/src/parts/13-bgm-and-rhythm-settings.jsx'),'utf8');
const trackSrc={},trackGain={};
for(const m of jsx.matchAll(/\{ id:'([^']+)'[^}]*?src:'([^']+)'([^}]*)\}/g)){
  trackSrc[m[1]]=m[2];
  const g=/gain:([0-9.]+)/.exec(m[3]||'');
  trackGain[m[1]]=g?Number(g[1]):1;
}

let failed=0;
const ok=(name,cond,detail='')=>{console.log(`${cond?'OK':'NG'}: ${name}${detail?` — ${detail}`:''}`);if(!cond)failed++;};

const rows=[];
for(const songId of RHYTHM_DEMO_SONG_IDS){
  const song=RHYTHM_SONGS.find(entry=>entry.songId===songId);
  if(!song){ok(`${songId} がランタイムにある`,false);continue;}
  const rel=trackSrc[song.bgmTrackId];
  if(!rel){ok(`${song.displayName} の音源がBGM_TRACKSにある`,false,song.bgmTrackId);continue;}
  const file=path.join(ROOT,'monster-hero',rel);
  if(!fs.existsSync(file)){ok(`${song.displayName} の音源が実在する`,false,rel);continue;}
  const d=measure(ffmpeg,file);
  if(!d){ok(`${song.displayName} のラウドネスを測れた`,false,rel);continue;}
  // 実装のゲイン(0〜1.25にクランプ)も込みで「実際に鳴る大きさ」を見る
  const gain=Math.max(0,Math.min(1.25,trackGain[song.bgmTrackId]??1));
  rows.push({songId,name:song.displayName,file:rel.split('/').pop(),
    lufs:d.lufs,truePeak:d.truePeak,gain,effective:d.lufs+20*Math.log10(gain||1e-9)});
}

console.log('');
console.log('曲'.padEnd(30)+' ラウドネス   真のピーク  ゲイン  実際に鳴る大きさ');
for(const r of [...rows].sort((a,b)=>a.effective-b.effective)){
  console.log(`  ${r.name.slice(0,28).padEnd(28)} ${r.lufs.toFixed(2).padStart(7)} ${r.truePeak.toFixed(2).padStart(8)} ${String(r.gain).padStart(6)} ${r.effective.toFixed(2).padStart(9)} LUFS`);
}
console.log('');

for(const r of rows){
  const diff=r.effective-TARGET_LUFS;
  ok(`${r.name}: 目標の大きさに入っている`,
    diff<=ALLOW_ABOVE&&diff>=-ALLOW_BELOW,
    `${r.effective.toFixed(2)} LUFS（目標 ${TARGET_LUFS} / 許容 +${ALLOW_ABOVE} 〜 -${ALLOW_BELOW}）`);
}

// クリップしないこと。真のピークが 0 を超えると歪む。
for(const r of rows){
  const peak=r.truePeak+20*Math.log10(r.gain||1e-9);
  ok(`${r.name}: 鳴らしてもクリップしない`,peak<=0,`${peak.toFixed(2)} dBTP`);
}

// 曲どうしの開き。ここが広いと「曲を変えるたびに音量を触る」ことになる。
if(rows.length>1){
  const eff=rows.map(r=>r.effective);
  const spread=Math.max(...eff)-Math.min(...eff);
  ok('曲どうしの開きが 4 LUFS 以内',spread<=4,`${spread.toFixed(2)} LUFS`);
}

console.log(failed?`\n${failed}件のNGがあります`:'\nすべてOK');
process.exit(failed?1:0);

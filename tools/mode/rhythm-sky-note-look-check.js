#!/usr/bin/env node
// 設定「空中のノーツの見た目」(2026-10-17・RHYTHM_SKY_NOTE_LOOK)の保存と読み込みを見張る。
//
//   node tools/mode/rhythm-sky-note-look-check.js
//
// 見ること:
//   ・既定・古い値・壊れた値は「いつもの」。「立体」を選んだときだけ新しいキー mh_rhythm_sky_note_look_v1 に '3d' を置く
//   ・段階Aの試作(mh_rhythm_floor3d_proto_v1='a3d')を入れていた端末は、キーが無ければ「立体」。選び直すと試作の 'a3d' だけ消す(ほかの試作の値は残す)
//   ・演奏の描き手は、ほかの試作が入っていないときだけこの設定で立体を描く。WebGL で描いていないときは描かない
//   ・設定画面の「表示」に項目があり、「保存」で書く
'use strict';
const fs=require('fs'),path=require('path');
const ROOT=path.resolve(__dirname,'../..');
const data=fs.readFileSync(path.join(ROOT,'monster-hero/data/rhythm-mode.js'),'utf8');
const screens=fs.readFileSync(path.join(ROOT,'monster-hero/src/parts/29-rhythm-screens.jsx'),'utf8');
let failed=0;const check=(name,ok,detail='')=>{console.log(`${ok?'✓':'✗'} ${name}${detail?` — ${detail}`:''}`);if(!ok)failed++;};

const from=data.indexOf("const RHYTHM_FLOOR3D_KEY="),to=data.indexOf("const RHYTHM_GPU_BAND_KEY=",from);
check('設定の読み書きを切り出せる',from>=0&&to>from);
const store=new Map();
const localStorage={getItem:k=>store.has(k)?store.get(k):null,setItem:(k,v)=>store.set(k,String(v)),removeItem:k=>store.delete(k)};
const api=new Function('localStorage',`${data.slice(from,to)}\nreturn {RHYTHM_SKY_NOTE_LOOK,rhythmFloor3dPreference};`)(localStorage);
const L=api.RHYTHM_SKY_NOTE_LOOK,K='mh_rhythm_sky_note_look_v1',P='mh_rhythm_floor3d_proto_v1';
const reset=(o={})=>{store.clear();for(const [k,v] of Object.entries(o))store.set(k,v);};
reset();check('既定は「いつもの」',L.id==='normal');
for(const bad of ['', 'on', '3D', '{"x":1}', 'null'])reset({[K]:bad}),check(`壊れた値「${bad}」は「いつもの」`,L.id==='normal');
reset({[K]:'3d'});check('保存した「立体」を読む',L.id==='3d');
reset();L.set('3d');check('「立体」を選ぶと新しいキーに 3d を置く',store.get(K)==='3d');
L.set('normal');check('「いつもの」を選ぶとキーを消す(既定はキーを置かない)',!store.has(K)&&L.id==='normal');
L.set('xyz');check('知らない値を渡しても「いつもの」',!store.has(K)&&L.id==='normal');
reset({[P]:'a3d'});check('段階Aの試作を入れていた端末は、キーが無ければ「立体」',L.id==='3d');
L.set('normal');check('選び直すと段階Aの試作の値を消し、「いつもの」に戻せる',!store.has(P)&&L.id==='normal');
reset({[P]:'c3'});L.set('3d');check('ほかの試作の値は消さない',store.get(P)==='c3'&&L.id==='3d');
reset({[P]:'c3'});check('ほかの試作だけ入っているときは「いつもの」',L.id==='normal');

check('演奏の描き手は、ほかの試作が入っていないときだけ設定で立体を描く',/sky3dWanted=f&&f!=='a3d'\?false:RHYTHM_SKY_NOTE_LOOK\.id==='3d';/.test(data));
check('立体は WebGL で描いているときだけ',/const sky3dApi=\(\)=>sky3dWanted&&backend==='webgl'&&ctx\?ctx\.sky3d:null;/.test(data)&&/floor3d3\|\|\(sky3dWanted&&backend==='webgl'\)/.test(data));
check('設定画面の「表示」に項目がある',/field\('空中のノーツの見た目',hellSegments\('skyNote',\[\['normal','いつもの'\],\['3d','立体'\]\]\)/.test(screens));
check('下書きに読み、「保存」で書く',/skyNote:RHYTHM_SKY_NOTE_LOOK\.id/.test(screens)&&/RHYTHM_SKY_NOTE_LOOK\.set\(hellDraft\.skyNote\)/.test(screens));
check('段階Aは確認待ちの試作の一覧から外した',!/on: 'a3d'/.test(fs.readFileSync(path.join(ROOT,'monster-hero/src/parts/81-debug-trials.jsx'),'utf8')));
check('保存キーを資料に書いてある',fs.readFileSync(path.join(ROOT,'docs/spec/SAVE_DATA.md'),'utf8').includes('`mh_rhythm_sky_note_look_v1`'));

console.log(failed?`\n${failed}件のNGがあります`:'\nすべてOK');
process.exit(failed?1:0);

#!/usr/bin/env node
// モンヒロビートの「タッチの診断」を読み、iPhone と Android を比べて、指がどこで消えているかを判定する(2026-09-30)。
// ユーザー報告「iPhoneで両手の高速連打のとき、押しても音も光も出ないことがある」(前からずっと・Androidでは聞かない・
// 同じiPhoneでもほかの音ゲーでは起きない)。ユーザー指示「こっち側に委ねないで調べる仕組みと直せる仕組みを作って」。
// 仕組みの全体: docs/spec/RHYTHM_TOUCH_DIAG.md
//
//   node tools/mode/rhythm-touch-diag.js --fetch            # サーバー(rhythm_touch_diagnostics)から新しい記録を取り、手元へ足す
//   node tools/mode/rhythm-touch-diag.js --import <file>    # サーバーの行と同じ形の JSON / JSONL を取り込む(つながらないとき・検査)
//   node tools/mode/rhythm-touch-diag.js --report [--json] [--days 14]
//
// 手元の置き場所: tools/mode/authoring/touchdiag/rows.jsonl(数だけ。名前・ブリーダーIDは元から入っていない)
'use strict';
const fs=require('fs'),path=require('path'),{spawnSync}=require('child_process');

const ROOT=path.resolve(__dirname,'..','..');
const arg=(name,fallback=null)=>{const i=process.argv.indexOf(name);return i>=0&&i+1<process.argv.length?process.argv[i+1]:fallback;};
const ROWS_FILE=path.resolve(ROOT,arg('--rows','tools/mode/authoring/touchdiag/rows.jsonl'));
const SUPABASE_URL='https://zrzevudkbgtxlbvmuziy.supabase.co';
const SUPABASE_KEY='sb_publishable_D4WJBXJ1xE97amndZarEPw_0M4LAwOp';
const TABLE='rhythm_touch_diagnostics';

const parseRows=text=>{
  const trimmed=String(text||'').trim();
  if(!trimmed)return [];
  if(trimmed.startsWith('['))return JSON.parse(trimmed);
  return trimmed.split('\n').map(line=>line.trim()).filter(Boolean).map(line=>JSON.parse(line));
};
const readRows=()=>fs.existsSync(ROWS_FILE)?parseRows(fs.readFileSync(ROWS_FILE,'utf8')):[];
const writeRows=rows=>{fs.mkdirSync(path.dirname(ROWS_FILE),{recursive:true});fs.writeFileSync(ROWS_FILE,rows.map(row=>JSON.stringify(row)).join('\n')+(rows.length?'\n':''));};
const mergeRows=(old,incoming)=>{
  const byId=new Map();
  [...old,...incoming].forEach((row,index)=>{if(row&&typeof row==='object')byId.set(row.id!=null?`id:${row.id}`:`n:${index}:${row.created_at||''}`,row);});
  return [...byId.values()].sort((a,b)=>(Number(a.id)||0)-(Number(b.id)||0));
};
const fetchRows=afterId=>{
  const rows=[];let last=afterId;
  for(let page=0;page<200;page++){
    const url=`${SUPABASE_URL}/rest/v1/${TABLE}?select=*&id=gt.${last}&order=id.asc&limit=1000`;
    const result=spawnSync('curl',['-sS','-m','30','-H',`apikey: ${SUPABASE_KEY}`,'-w','\n%{http_code}',url],{encoding:'utf8',maxBuffer:64*1024*1024});
    const lines=(result.stdout||'').trimEnd().split('\n');
    const status=Number(lines.pop());
    if(result.status!==0||status!==200){
      const reason=result.status!==0?(result.stderr||'').trim():`HTTP ${status} ${lines.join(' ').slice(0,200)}`;
      throw new Error(`サーバーから記録を取れませんでした(${reason})`);
    }
    const batch=JSON.parse(lines.join('\n')||'[]');
    rows.push(...batch);
    if(batch.length<1000)break;
    last=batch[batch.length-1].id;
  }
  return rows;
};

// ── 集計 ──
const num=value=>Number.isFinite(Number(value))?Number(value):0;
const groupKey=row=>`${row.platform||'other'}${row.standalone?'・ホーム画面':''}`;
const aggregate=(rows,{days=null,now=Date.now()}={})=>{
  const since=days?now-days*86400000:-Infinity;
  const groups=new Map();
  for(const row of rows){
    const at=Date.parse(row.created_at||'');
    if(Number.isFinite(at)&&at<since)continue;
    const s=row.stats&&typeof row.stats==='object'?row.stats:{};
    if(s.assist)continue;   // アシストモードは叩き方が違うので比べない
    for(const key of [row.platform||'other',groupKey(row)]){
      if(!groups.has(key))groups.set(key,{key,plays:0,devices:new Set(),notes:0,taps:0,pointerDowns:0,touchStarts:0,matched:0,pointerOnly:0,touchOnly:0,recovered:0,
        lateStart:0,lateDelivery:0,cancels:0,cancelledTouches:0,misses:0,noInputMisses:0,ignored:0,outside:0,gestures:0,max4:0,max5:0,maxDelayMs:0});
      const g=groups.get(key);
      g.plays++;g.devices.add(row.device_key);g.notes+=num(row.note_count);
      g.taps+=num(s.touchStarts)+num(s.pointerOnly);
      ['pointerDowns','touchStarts','matched','pointerOnly','touchOnly','recovered','lateStart','lateDelivery','cancels','cancelledTouches','misses','noInputMisses','ignored','outside','gestures']
        .forEach(name=>{g[name]+=num(s[name]);});
      if(num(s.maxTouches)>=4)g.max4++;
      if(num(s.maxTouches)>=5)g.max5++;
      if(num(s.maxDelayMs)>g.maxDelayMs)g.maxDelayMs=num(s.maxDelayMs);
    }
  }
  const per=(value,base,unit)=>base>0?value/base*unit:0;
  return [...groups.values()].map(g=>({
    key:g.key,plays:g.plays,devices:g.devices.size,notes:g.notes,taps:g.taps,
    // 1000タッチあたり
    pointerOnlyPer1k:per(g.pointerOnly,g.taps,1000),recoveredPer1k:per(g.recovered,g.taps,1000),touchOnlyPer1k:per(g.touchOnly,g.taps,1000),
    lateStartPer1k:per(g.lateStart,g.taps,1000),lateDeliveryPer1k:per(g.lateDelivery,g.taps,1000),cancelsPer1k:per(g.cancels,g.taps,1000),
    ignoredPer1k:per(g.ignored,g.taps,1000),outsidePer1k:per(g.outside,g.taps,1000),gesturesPer1k:per(g.gestures,g.taps,1000),
    // 1000ノーツあたり
    missPer1k:per(g.misses,g.notes,1000),noInputMissPer1k:per(g.noInputMisses,g.notes,1000),
    max4Share:per(g.max4,g.plays,1),max5Share:per(g.max5,g.plays,1),maxDelayMs:g.maxDelayMs,
    pointerSeen:g.pointerDowns>0,
  })).sort((a,b)=>a.key.localeCompare(b.key));
};

// ── 判定 ──
// iPhone(ios)と Android(android)を比べ、指が消えている段階を言葉で返す。どの行も「根拠の数字」と「次にやること」を持つ。
const MIN_PLAYS=20;   // これより少ないと判定しない(偶然に振り回されないように)
const diagnose=summary=>{
  const ios=summary.find(g=>g.key==='ios'),android=summary.find(g=>g.key==='android');
  const lines=[];
  if(!ios||ios.plays<MIN_PLAYS){lines.push({level:'wait',text:`iPhone の記録がまだ足りません(${ios?ios.plays:0}曲。${MIN_PLAYS}曲そろったら判定します)`});return lines;}
  const base=android&&android.plays>=MIN_PLAYS?android:null;
  const ratio=(a,b)=>b>0?a/b:(a>0?Infinity:1);
  const fmt=x=>Number.isFinite(x)?x.toFixed(2):'∞';
  if(!ios.pointerSeen)lines.push({level:'info',text:'iPhone からポインタが1つも届いていません。突き合わせができないので、取り戻しは動いていません'});
  // ① ブラウザがタッチを落としている(ポインタは届いた)。取り戻しが効いている
  if(ios.pointerOnlyPer1k>=1)
    lines.push({level:'found',text:`iPhone のブラウザがタッチを落としています: 1000タッチに ${fmt(ios.pointerOnlyPer1k)} 回(ポインタだけ届いた)。`
      +`取り戻し ${fmt(ios.recoveredPer1k)} 回。取り戻しでこの分は音も判定も出ています`});
  // ② 指がブラウザより手前で消えている(どちらも届かない)。入力の無いMISSが Android より多い
  if(base&&ios.noInputMissPer1k>=3&&ratio(ios.noInputMissPer1k,base.noInputMissPer1k)>=2)
    lines.push({level:'found',text:`叩いている最中なのに入力が1つも来ないMISSが、iPhone は Android の ${fmt(ratio(ios.noInputMissPer1k,base.noInputMissPer1k))} 倍`
      +`(1000ノーツに iPhone ${fmt(ios.noInputMissPer1k)} / Android ${fmt(base.noInputMissPer1k)})。指がポインタにもタッチにもならずに消えています`});
  // ③ 同時の指の上限(iPhone は5本)
  if(ios.max5Share>=.05)
    lines.push({level:'found',text:`指が同時に5本触れた曲が ${Math.round(ios.max5Share*100)}%。iPhone は6本目を受け付けません。手のひら・指のつけ根が画面に触れている疑い`});
  // ④ 端末に指を取り消された
  if(ios.cancelsPer1k>=1&&(!base||ratio(ios.cancelsPer1k,base.cancelsPer1k)>=2))
    lines.push({level:'found',text:`端末に指を取り消された回数が 1000タッチに ${fmt(ios.cancelsPer1k)} 回${base?`(Android ${fmt(base.cancelsPer1k)})`:''}。システムのジェスチャーに取られています`});
  // ⑤ 処理が詰まって、タッチが遅れて届いている
  if(ios.lateDeliveryPer1k>=20&&(!base||ratio(ios.lateDeliveryPer1k,base.lateDeliveryPer1k)>=2))
    lines.push({level:'found',text:`50ms以上遅れて届いたタッチが 1000タッチに ${fmt(ios.lateDeliveryPer1k)} 回(最大 ${Math.round(ios.maxDelayMs)}ms)。叩いた瞬間の処理が重い疑い`});
  // ⑥ 道の外で無視している
  if(ios.ignoredPer1k>=10)
    lines.push({level:'found',text:`道の外に触れて無視した指が 1000タッチに ${fmt(ios.ignoredPer1k)} 回。端の受け付け範囲が狭い疑い`});
  if(!lines.some(line=>line.level==='found'))
    lines.push({level:'none',text:base?'iPhone と Android のあいだに、はっきりした差はありません':'Android の記録が足りないので比べられません(iPhone だけの数字では差が出たものはありません)'});
  return lines;
};

const report=(rows,{json=false,days=null}={})=>{
  const summary=aggregate(rows,{days});
  const verdict=diagnose(summary);
  if(json){console.log(JSON.stringify({summary,verdict},null,1));return {summary,verdict};}
  console.log(`タッチの診断: ${rows.length}行${days?`(直近${days}日)`:''}`);
  for(const g of summary){
    console.log(`\n[${g.key}] ${g.plays}曲・${g.devices}端末・${g.taps}タッチ・${g.notes}ノーツ`);
    console.log(`  1000タッチあたり: ポインタだけ ${g.pointerOnlyPer1k.toFixed(2)} / 取り戻し ${g.recoveredPer1k.toFixed(2)} / タッチだけ ${g.touchOnlyPer1k.toFixed(2)} / 遅れて見えた ${g.lateStartPer1k.toFixed(2)}`);
    console.log(`                   50ms以上遅れた ${g.lateDeliveryPer1k.toFixed(2)}(最大${Math.round(g.maxDelayMs)}ms) / 取り消し ${g.cancelsPer1k.toFixed(2)} / 道の外 ${g.ignoredPer1k.toFixed(2)} / エリアの外 ${g.outsidePer1k.toFixed(2)} / 二本指 ${g.gesturesPer1k.toFixed(2)}`);
    console.log(`  1000ノーツあたり: MISS ${g.missPer1k.toFixed(1)} / 入力の無いMISS ${g.noInputMissPer1k.toFixed(2)}   同時4本以上の曲 ${Math.round(g.max4Share*100)}% / 5本 ${Math.round(g.max5Share*100)}%`);
  }
  console.log('\n判定:');
  verdict.forEach(line=>console.log(`  ${line.level==='found'?'●':line.level==='wait'?'…':'・'} ${line.text}`));
  return {summary,verdict};
};

module.exports={aggregate,diagnose,parseRows,mergeRows,MIN_PLAYS};

if(require.main===module){
  let rows=readRows();
  if(process.argv.includes('--import')){
    const file=arg('--import');
    const incoming=parseRows(fs.readFileSync(path.resolve(file),'utf8'));
    rows=mergeRows(rows,incoming);writeRows(rows);
    console.log(`取り込み: ${incoming.length}行(手元 ${rows.length}行)`);
  }
  if(process.argv.includes('--fetch')){
    const last=rows.reduce((max,row)=>Math.max(max,Number(row.id)||0),0);
    try{
      const incoming=fetchRows(last);
      rows=mergeRows(rows,incoming);writeRows(rows);
      console.log(`サーバーから ${incoming.length}行(手元 ${rows.length}行)`);
    }catch(error){console.log(`止めました: ${error.message}`);process.exit(2);}
  }
  if(process.argv.includes('--report')){
    const days=arg('--days')?Number(arg('--days')):null;
    report(rows,{json:process.argv.includes('--json'),days});
  }
  if(!['--import','--fetch','--report'].some(flag=>process.argv.includes(flag)))
    console.log('使い方: --fetch / --import <file> / --report [--json] [--days N]');
}

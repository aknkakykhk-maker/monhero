#!/usr/bin/env node
// 遊んだ記録の仕組み(2026-09-28・docs/spec/RHYTHM_PLAY_LOG.md)を見張る。
//   ・ゲーム側: 公開中の曲をふつうに最後まで遊んだときだけ送る(デバッグ・練習・タイミング合わせ・アシストモードは送らない)。
//     縮め方は道具側でほどける。新しい保存キーだけを使う。置き場所が無いと分かったら送るのをやめる
//   ・SQL: 新しい表を作るだけ(ほかの表に触らない)。予行演習は rollback で終わる。ゲームが送る形を表の制約が通す
//   ・道具側: 同じ端末の記録は上限まで・左右反転は数えない。低音の遅れと1本の線は、記録に証拠があるときだけ、その向きへ動く
//   ・生成器: 調整値がすべて0の Rev.17 は Rev.16 と同じ譜面。調整値を入れると譜面が変わる
'use strict';
const fs=require('fs'),os=require('os'),path=require('path'),vm=require('vm');
const {spawnSync}=require('child_process');

const ROOT=path.resolve(__dirname,'..','..');
let failed=0;
const ok=(label,cond,detail='')=>{console.log(`${cond?'OK':'NG'}: ${label}${detail?` — ${detail}`:''}`);if(!cond)failed++;};
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'mh-playlog-'));
process.env.MH_PLAY_TUNING_FILE=path.join(tmp,'tuning-none.json');   // 本物の調整値を読まない・書かない
const log=require('./rhythm-play-log.js');
const {lowLagOf,isLowHit}=require('./rhythm-chart-low-lag.js');
const {RELEASED_TRACKS}=require('./rhythm-runtime-notes.js');

try{
  // ── 1. ゲーム側 ──
  const play=fs.readFileSync(path.join(ROOT,'monster-hero/src/parts/30-rhythm-play.jsx'),'utf8');
  const supa=fs.readFileSync(path.join(ROOT,'monster-hero/src/parts/26-supabase.jsx'),'utf8');
  const encodeSource=(play.match(/const rhythmPlayLogEncode=[\s\S]*?\n\}\)\.join\(''\);/)||[])[0];
  ok('縮める関数がある',!!encodeSource);
  const context={};vm.createContext(context);vm.runInContext(`${encodeSource};globalThis.encode=rhythmPlayLogEncode;`,context);
  const sample=[{_rhythmFinalJudgment:'MARVELOUS',_rhythmDeltaMs:-12.4},{_rhythmFinalJudgment:'MISS'},{},{_rhythmFinalJudgment:'GOOD',_rhythmDeltaMs:900},
    {type:'HOLD',holdJudgment:'GREAT',holdDeltaMs:31,_rhythmFinalJudgment:'GREAT',_rhythmDeltaMs:5},{_rhythmFinalJudgment:'GOOD',_rhythmDeltaMs:null}];
  const encoded=context.encode(sample);
  ok('縮めた文字列を道具がほどける(HOLD は押し始めのずれ・範囲の外は端へ)',JSON.stringify(log.decodeDeltas(encoded))===JSON.stringify([-12,'MISS',null,600,31,null]),`${encoded} → ${JSON.stringify(log.decodeDeltas(encoded))}`);
  ok('縮めた文字は SQL の制約が通す形だけ',/^([0-9a-z]{2}|--|__)*$/.test(encoded)&&encoded.length===sample.length*2);
  ok('送るのはデバッグ・練習・タイミング合わせ・アシストモード以外',/if\(!debugPlay&&!tutorial&&!calibrating&&!assistOn\)rhythmPlayLogSend\(/.test(play));
  ok('送るのは公開中の曲だけ',/RHYTHM_DEMO_SONG_IDS\.includes\(song\?\.songId\)/.test(play));
  ok('保存は新しいキー mh_rhythm_play_log_device_v1 だけ',/const RHYTHM_PLAY_LOG_DEVICE_KEY='mh_rhythm_play_log_device_v1';/.test(play)
    &&!/storeSet\((?!RHYTHM_PLAY_LOG_DEVICE_KEY)[^)]*\)[^;\n]*rhythmPlayLog/.test(play));
  ok('送り先は rhythm_play_logs・置き場所が無い(404)・権限が無いと分かったら送るのをやめる',
    /const RHYTHM_PLAY_LOG_TABLE = 'rhythm_play_logs';/.test(supa)&&/res\.status === 404 \|\| res\.status === 401 \|\| res\.status === 403\) rhythmPlayLogDisabled = true/.test(supa));
  const sendBlock=(play.match(/const rhythmPlayLogSend=[\s\S]*?\n\};/)||[''])[0];
  ok('名前・ブリーダーIDは送らない',!/user_name|breeder|userName|breederId/i.test(sendBlock));

  // ── 2. SQL ──
  const sqlDir=path.join(ROOT,'docs/sql/rankings');
  const apply=fs.readFileSync(path.join(sqlDir,'RHYTHM_PLAY_LOG_APPLY.sql'),'utf8'),test=fs.readFileSync(path.join(sqlDir,'RHYTHM_PLAY_LOG_APPLY_TEST.sql'),'utf8');
  const statements=apply.replace(/--[^\n]*/g,'');
  ok('SQL は rhythm_play_logs だけを作り、ほかの表を変えない',!/\b(alter|drop|delete|update|truncate)\b[^;]*\b(rankings|breeder|bond|rhythm_(?!play_logs))/i.test(statements)
    &&!/\bdrop\s+table\b/i.test(statements)&&/create table if not exists public\.rhythm_play_logs/.test(statements));
  ok('書き換え・削除のポリシーを作らない',!/for\s+(update|delete|all)\b/i.test(statements));
  ok('予行演習は rollback で終わり、本番は commit で終わる',/rollback;\s*$/.test(test)&&!/^commit;/m.test(test)&&/^commit;/m.test(apply));
  ok('ゲームが送る列を、表がすべて持っている',['song_id','difficulty','fingerprint','app_build','device_key','judge_offset_ms','note_count','mirror','cleared','deltas','schema_version']
    .every(column=>new RegExp(`\\b${column}\\b`).test(statements)&&new RegExp(`\\b${column}\\s*[:,}]`).test(sendBlock)));

  // ── 3. 道具側(作り物の記録で) ──
  const songs=['only_my_railgun','kaze_ga_soyogu','close_to_your_heart'];
  let seed=11;const rnd=()=>{seed=(seed*1103515245+12345)&0x7fffffff;return seed/0x7fffffff;};
  const gauss=()=>{let u=0;for(let i=0;i<6;i++)u+=rnd();return u-3;};
  // trueFactor: 解析の遅れの何倍が本当か(低音だけが鳴っている所のノーツで、プレイヤーは本当の低音に合わせて押す)
  // mixNoise: 歌とドラムの線が切り替わるノーツほど押す時刻がばらつく強さ
  const simulate=({trueFactor=0,mixNoise=0,difficulties=['HARD'],devices=6,plays=3})=>{
    const rows=[];let id=1;
    for(const songId of songs)for(const difficulty of difficulties){
      const chart=log.chartFor(songId,difficulty),audio=log.audioFor(songId);
      const lag=lowLagOf(audio).detectedMs,onsets=audio.onsets.slice().sort((a,b)=>a.timeMs-b.timeMs),line=log.lineOfGrid(audio);
      const kinds=chart.notes.map(note=>line(log.gridOf(audio,note.timeMs)));
      for(let d=0;d<devices;d++){
        const device=`dev${songs.indexOf(songId)}${d}abcdefgh`,bias=gauss()*20;
        for(let p=0;p<plays;p++){
          const deltas=chart.notes.map((note,i)=>{
            const near=onsets.filter(o=>Math.abs(o.timeMs-note.timeMs)<=105),low=near.filter(isLowHit),others=near.filter(o=>!isLowHit(o)&&Math.abs(o.timeMs-note.timeMs)<=45);
            let sound=note.timeMs;if(low.length===1&&!others.length)sound=low[0].timeMs-lag*trueFactor;
            if(rnd()<.03)return 'zz';
            const switched=i>0&&kinds[i]&&kinds[i-1]&&kinds[i]!==kinds[i-1];
            const delta=sound-note.timeMs+bias+gauss()*(12+(switched?mixNoise:0));
            return Math.max(0,Math.min(1200,Math.round(delta)+600)).toString(36).padStart(2,'0');
          }).join('');
          rows.push({id:id++,song_id:songId,difficulty,fingerprint:log.fingerprintOf(chart.notes),app_build:'check',device_key:device,judge_offset_ms:0,
            note_count:chart.notes.length,mirror:false,cleared:true,deltas,schema_version:1});
        }
      }
    }
    return rows;
  };
  const summaryOf=rows=>{const summary={schemaVersion:1,cursor:{lastId:0},charts:{}};const counts=log.importRows(summary,rows);return {summary,counts};};
  const measuresOf=summary=>Object.values(summary.charts).map(log.measureChart).filter(m=>m.current);
  {
    const rows=simulate({devices:1,plays:log.MAX_PLAYS_PER_DEVICE+3});
    const {counts}=summaryOf(rows.concat([{...rows[0],id:999,device_key:'mirrorxxxx',mirror:true}]));
    ok('同じ端末の記録は1譜面あたり上限まで・左右反転の回は数えない',counts['device-cap']===3*songs.length&&counts.mirror===1,JSON.stringify(counts));
  }
  const lagWith=factor=>log.learn(measuresOf(summaryOf(simulate({trueFactor:factor})).summary));
  const lag9=lagWith(.9),lag0=lagWith(0);
  ok('低音の遅れが本当なら、差し引く量を増やす',lag9.next.lowLagFactor>=.3&&lag9.changed,lag9.reasons[0]);
  ok('低音の遅れが本物の音のずれなら、差し引く量を動かさない',lag0.next.lowLagFactor===0,lag0.reasons[0]);
  const lineWith=noise=>log.learn(measuresOf(summaryOf(simulate({mixNoise:noise,difficulties:['HARD','EXPERT','MASTER']})).summary));
  const lineHurt=lineWith(40),lineFlat=lineWith(0);
  ok('つまみ食いの多い小節ほど合わせにくいなら、1本の線を強める',lineHurt.next.lineBoost>0,lineHurt.reasons[1]);
  ok('関係が無ければ、1本の線は動かさない',lineFlat.next.lineBoost===0,lineFlat.reasons[1]);

  // ── 4. 生成器 ──
  const generate=(revision,tuning,tag)=>{
    const dir=path.join(tmp,tag);fs.mkdirSync(dir);
    const env={...process.env};
    if(tuning){const file=path.join(tmp,`${tag}.json`);fs.writeFileSync(file,JSON.stringify({schemaVersion:1,revisions:{[revision]:{values:tuning}}}));env.MH_PLAY_TUNING_FILE=file;}
    const r=spawnSync(process.execPath,[path.join(__dirname,'rhythm-chart-v3-generate.js'),'--track','only_my_railgun','--chart-revision',String(revision),'--difficulty','HARD','--write','--output-dir',dir],
      {cwd:ROOT,encoding:'utf8',env,maxBuffer:64*1024*1024});
    return r.status===0?JSON.parse(fs.readFileSync(path.join(dir,'only-my-railgun-v3-chart-hard.json'),'utf8')).notes:null;
  };
  const n16=generate(16,null,'r16'),n17=generate(17,null,'r17'),n17t=generate(17,{lowLagFactor:1,lineBoost:.6,lineDemote:.3},'r17t');
  ok('調整値がすべて0の Rev.17 は Rev.16 と同じ譜面',!!n16&&JSON.stringify(n16)===JSON.stringify(n17));
  ok('調整値を入れると譜面が変わる',!!n17t&&JSON.stringify(n17t)!==JSON.stringify(n16));
  const {CHART_REVISION_CODE_LATEST}=require('./rhythm-chart-v3-revision.js');
  ok('作り方の最新は Rev.17 以上',CHART_REVISION_CODE_LATEST>=17);
  const revisionSource=fs.readFileSync(path.join(__dirname,'rhythm-chart-v3-revision.js'),'utf8');
  ok('調整値を書き足すと、それが最新リビジョンになる',/Math\.max\(CHART_REVISION_CODE_LATEST,latestKnowledgeRevision\(\),latestPlayTuningRevision\(\)\)/.test(revisionSource));
}finally{fs.rmSync(tmp,{recursive:true,force:true});}
console.log(failed?`\n✗ ${failed}件NG`:'\n✓ 遊んだ記録の仕組みは期待どおり');
process.exit(failed?1:0);

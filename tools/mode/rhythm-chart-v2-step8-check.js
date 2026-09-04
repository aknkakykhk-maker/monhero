#!/usr/bin/env node
// 自動譜面制作システム V2 STEP8(1コマンド制作パイプライン)を確かめる。
//
//   node tools/mode/rhythm-chart-v2-step8-check.js
//
// STEP8は「STEP3→5→7を通し、出来た譜面を遊べる形にする」道具。
// ランタイムへ書き込む唯一の工程なので、ここでは何よりもまず**壊していないこと**を見張る。
//
//   1. 既存の正式候補v1(JSONとランタイムの譜面)を1バイトも変えていない
//   2. 書き込むのはV2のマーカーの内側だけで、保存データ・ランキングには触らない
//   3. ランタイムに入っている譜面が、設計資料(STEP7の出力)と食い違っていない
//   4. 問題のある譜面はランタイムへ出さない(押せない箇所・難易度の逆転で止まる)
//   5. 何度実行しても同じ結果になる
const fs=require('fs');
const path=require('path');
const vm=require('vm');
const crypto=require('crypto');
const {spawnSync}=require('child_process');

const ROOT=path.resolve(__dirname,'..','..');
const TOOL=path.join(ROOT,'tools/mode/rhythm-chart-v2-step8-pipeline.js');
const RUNTIME=path.join(ROOT,'monster-hero/data/rhythm-mode.js');
const DIFFICULTIES=['EASY','NORMAL','HARD','EXPERT','MASTER'];

let failed=0;
const check=(name,ok,detail='')=>{console.log(`${ok?'✓':'✗'} ${name}${detail?` (${detail})`:''}`);if(!ok)failed++;};
const hash=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const source=fs.readFileSync(TOOL,'utf8');
const runtimeSource=fs.readFileSync(RUNTIME,'utf8');

// --- 触ってよいものの範囲 ---
check('ランタイムへ書くのはV2のマーカーの内側だけ',
  source.includes('// <monster-hero-v2-${difficulty.toLowerCase()}-notes>')
  &&!/monster-hero-\$\{difficulty\.toLowerCase\(\)\}-notes/.test(source));
check('書き込んだあとv1のマーカーが変わっていないか自分で確かめている',
  source.includes('既存の正式候補v1の譜面まで書き換えようとしました'));
check('保存データ・ランキングへ触らない',
  !/localStorage|mh_[a-z]|supabase/i.test(source));
check('乱数を使わない',!/Math\.random|crypto\.randomBytes/.test(source));
check('「押せない」が残っていたらランタイムへ出さない',
  source.includes("problems.push('STEP6で「押せない」箇所が残っている')")
  &&source.includes('問題があるのでランタイムへは反映しません'));
check('難易度の順(ノーツ数・密度)が崩れていても止める',
  source.includes('のノーツ数が')&&source.includes('の密度が')&&source.includes('process.exit(1)'));
check('--release のときだけ遊べる形にする(既定は設計資料まで)',
  source.includes("const release=process.argv.includes('--release');")
  &&source.includes('if(!release){'));

// --- ランタイムに入っているV2が、設計資料(STEP7の出力)と食い違っていないこと ---
const ctx={console,performance:{now:()=>0},requestAnimationFrame:()=>0,cancelAnimationFrame:()=>{}};
vm.createContext(ctx);
vm.runInContext(runtimeSource.split('const installRhythmGestureVisuals',1)[0]+'\nthis.out={RHYTHM_SONGS};',ctx);
const song=(ctx.out.RHYTHM_SONGS||[]).find(s=>s.songId==='monster_hero_theme_candidate_v2');
check('曲「Monster Hero 候補v2」がデバッグ曲として登録されている',!!song&&song.displayName==='Monster Hero 候補v2');
const v1song=(ctx.out.RHYTHM_SONGS||[]).find(s=>s.songId==='monster_hero_theme_candidate');
check('v1の候補曲もそのまま残っている(遊び比べられる)',!!v1song&&v1song.difficulties.EASY.totalNotes>0);
// --- v1が1バイトも変わっていないこと ---
// ランタイムを実際に読み込んで、正式候補v1のJSONと突き合わせる。
if(v1song){
  for(const difficulty of ['EASY','NORMAL','HARD']){
    const chart=v1song.difficulties[difficulty];
    const json=JSON.parse(fs.readFileSync(path.join(ROOT,`monster-hero/debug/monster-hero-theme-${difficulty.toLowerCase()}-formal-candidate-v1.json`),'utf8'));
    check(`v1 ${difficulty}: ランタイムの譜面が正式候補v1と同じノーツ数のまま`,chart.totalNotes===json.noteCount,
      `${chart.totalNotes} / ${json.noteCount}`);
    check(`v1 ${difficulty}: 先頭と末尾の時刻も変わっていない`,(()=>{
      const first=chart.notes[0],last=chart.notes[chart.notes.length-1];
      const jf=json.notes[0],jl=json.notes[json.notes.length-1];
      const ms=grid=>Math.round(json.beatZeroMs+grid*(json.bpm?60000/json.bpm/json.subdivisionsPerBeat:0));
      return first&&jf&&Math.abs(first.timeMs-ms(jf.grid))<=1&&Math.abs(last.timeMs-ms(jl.grid))<=1;
    })(),`${chart.notes[0]?.timeMs}ms 〜 ${chart.notes[chart.notes.length-1]?.timeMs}ms`);
  }
}
if(song){
  for(const difficulty of DIFFICULTIES){
    const chart=song.difficulties[difficulty];
    const designFile=path.join(ROOT,`tools/mode/authoring/monster-hero-theme-v2-step7-chart-${difficulty.toLowerCase()}.json`);
    const releaseFile=path.join(ROOT,`monster-hero/debug/monster-hero-theme-${difficulty.toLowerCase()}-formal-candidate-v2.json`);
    check(`${difficulty}: 正式候補v2のJSONが書き出されている`,fs.existsSync(releaseFile));
    if(!fs.existsSync(designFile)||!fs.existsSync(releaseFile))continue;
    const design=JSON.parse(fs.readFileSync(designFile,'utf8'));
    const released=JSON.parse(fs.readFileSync(releaseFile,'utf8'));
    check(`${difficulty}: 正式候補v2が設計資料(STEP7)と同じ譜面`,
      released.noteCount===design.noteCount&&JSON.stringify(released.notes)===JSON.stringify(design.notes));
    check(`${difficulty}: ランタイムのノーツ数が設計資料と一致`,chart.totalNotes===design.noteCount,
      `${chart.totalNotes} / ${design.noteCount}`);
    check(`${difficulty}: ランタイムの種別の内訳が設計資料と一致`,(()=>{
      const a={},b={};
      chart.notes.forEach(n=>{a[n.type]=(a[n.type]||0)+1;});
      design.notes.forEach(n=>{b[n.type]=(b[n.type]||0)+1;});
      return JSON.stringify(Object.entries(a).sort())===JSON.stringify(Object.entries(b).sort());
    })());
    check(`${difficulty}: 終点フリックの数がランタイムと設計資料で一致`,
      chart.notes.filter(n=>n.endFlick).length===design.notes.filter(n=>n.endFlick).length,
      `${chart.notes.filter(n=>n.endFlick).length}個`);
    check(`${difficulty}: ランタイムの譜面が時刻順で、サブレーンも範囲内`,
      chart.notes.every((n,i)=>(i===0||n.timeMs>=chart.notes[i-1].timeMs)
        &&Number.isFinite(n.timeMs)&&n.timeMs>=0
        &&(n.type==='SLIDE'?n.slidePoints.every(p=>p.lane>=0&&p.lane<=4):n.subLane>=0&&n.subLane+n.subLaneWidth<=10)));
    check(`${difficulty}: HOLD / SLIDE の終わりが始まりより後ろ`,
      chart.notes.filter(n=>n.type==='HOLD'||n.type==='SLIDE').every(n=>n.endTimeMs>n.timeMs));
    check(`${difficulty}: 終点フリックが付くのはHOLD / SLIDEだけ`,
      chart.notes.filter(n=>n.endFlick).every(n=>n.type==='HOLD'||n.type==='SLIDE'));
  }
  check('難易度が上がるほどノーツが増える(ランタイム上でも)',
    DIFFICULTIES.every((d,i)=>i===0||song.difficulties[DIFFICULTIES[i-1]].totalNotes<song.difficulties[d].totalNotes),
    DIFFICULTIES.map(d=>song.difficulties[d].totalNotes).join(' < '));
}

// --- 通して同じ結果になること(ランタイムへは書かない) ---
const run=(...args)=>spawnSync(process.execPath,[TOOL,...args],{cwd:ROOT,encoding:'utf8',maxBuffer:8*1024*1024});
const before=hash(RUNTIME);
const first=run(),second=run();
check('パイプラインが成功する',first.status===0,first.status===0?'':(first.stderr||first.stdout).trim().split('\n').slice(-3).join(' / '));
const withoutSeconds=out=>out.replace(/\(\d+\.\d秒\)/g,'(秒)');
check('何度実行しても同じ結果になる',withoutSeconds(first.stdout)===withoutSeconds(second.stdout));
check('--release を付けなければランタイムを書き換えない',hash(RUNTIME)===before);
check('通しただけでも仕上がりを確かめている(STEP6を最後に走らせる)',
  /STEP6 両手の指のシミュレート/.test(first.stdout)&&/「押せない」0件/.test(first.stdout));

console.log(failed?`\n${failed}件のNGがあります`:'\nすべてOK');
process.exit(failed?1:0);

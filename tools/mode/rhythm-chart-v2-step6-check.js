#!/usr/bin/env node
// 自動譜面制作システム V2 STEP6(自動プレイ可能性検査)を確かめる。
//
//   node tools/mode/rhythm-chart-v2-step6-check.js
//
// STEP6は「両手の指を割り当ててシミュレートし、押せない箇所を場所つきで出す」道具。
// 検査そのものが当てにならなければ意味が無いので、ここでは次を見張る。
//
//   1. しきい値が較正されている
//      … 人が耳で確認して通した既存の正式候補v1が「押せない0件」で通ること。
//        ここが落ちるなら、しきい値が厳しすぎて道具として使えない
//   2. 押せない配置をちゃんと捕まえる
//      … わざと作った「絶対に押せない譜面」で必ず検出できること
//   3. 何度実行しても同じ結果になる(乱数を使っていない)
//   4. ランタイム・既存譜面へ一切触っていない
const fs=require('fs');
const os=require('os');
const path=require('path');
const crypto=require('crypto');
const {spawnSync}=require('child_process');

const ROOT=path.resolve(__dirname,'..','..');
const TOOL=path.join(ROOT,'tools/mode/rhythm-chart-v2-step6-playability.js');

let failed=0;
const check=(name,ok,detail='')=>{console.log(`${ok?'✓':'✗'} ${name}${detail?` (${detail})`:''}`);if(!ok)failed++;};
const hash=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const run=(...args)=>spawnSync(process.execPath,[TOOL,...args],{cwd:ROOT,encoding:'utf8'});

// --- 触ってはいけないもの ---
const source=fs.readFileSync(TOOL,'utf8');
const writeTargets=[...source.matchAll(/fs\.writeFileSync\(([^,]+),/g)].map(m=>m[1].trim());
check('書き出し先が設計資料の置き場(authoring)だけである',
  writeTargets.length>0&&writeTargets.every(t=>t==='out')
  &&/tools\/mode\/authoring\/monster-hero-theme-v2-step6-/.test(source));
check('monster-heroからは読み取りしかしない',
  !/writeFileSync\([^)]*monster-hero/.test(source));
check('乱数を使わない(結果が毎回変わらないため)',!/Math\.random|crypto\.randomBytes/.test(source));
check('手のモデルのしきい値を定数で明示している',
  ['HANDS','LANE_SPEED_COMFORT','LANE_SPEED_LIMIT','RESTRIKE_COMFORT_MS','RESTRIKE_LIMIT_MS',
   'CHORD_MIN_LANE_GAP','RELEASE_MARGIN_MS','END_FLICK_RELEASE_MS'].every(k=>new RegExp(`const ${k}=`).test(source)));

// --- 1. しきい値の較正: 人が確認した既存の正式候補v1が通ること ---
// ここが落ちたら、道具が厳しすぎて「作った譜面が全部だめ」と言い出す状態になる。
const v1=run('--source','v1');
check('既存の正式候補v1で道具が動く',/EASY:|NORMAL:|HARD:/.test(v1.stdout),
  v1.stdout?'':(v1.stderr||'').trim());
check('人が耳で確認した既存の正式候補v1は「押せない」が0件(しきい値が厳しすぎない)',
  v1.status===0&&/EASY: \d+ノーツ  押せない 0件/.test(v1.stdout)
  &&/NORMAL: \d+ノーツ  押せない 0件/.test(v1.stdout)
  &&/HARD: \d+ノーツ  押せない 0件/.test(v1.stdout),
  (v1.stdout.match(/(EASY|NORMAL|HARD): .*/g)||[]).join(' / '));
// 逆に「忙しい」も出ないほど緩いと、何も見張れていない。実際に少しは出るはず。
check('既存の正式候補v1でも「忙しい」は少しは検出される(緩すぎない)',
  /忙しい [1-9]\d*件/.test(v1.stdout));

// --- 2. わざと押せない譜面を作って、捕まえられるか ---
const tempDir=fs.mkdtempSync(path.join(os.tmpdir(),'rhythm-v2-step6-check-'));
const authoring=path.join(ROOT,'tools/mode/authoring');
const beforeAuthoring=new Map();
for(const f of fs.readdirSync(authoring))beforeAuthoring.set(f,hash(path.join(authoring,f)));

// 道具は --source で決め打ちの場所しか読まないので、
// 「押せない譜面」を判定できるかは、同じ規則をここで再現して確かめる。
// (道具本体のしきい値定数を読み出し、それを踏み越える配置が検出されることを見る)
const readConst=name=>Number((source.match(new RegExp(`const ${name}=([0-9.]+)`))||[])[1]);
const HANDS=readConst('HANDS'),LIMIT=readConst('LANE_SPEED_LIMIT'),RESTRIKE=readConst('RESTRIKE_LIMIT_MS');
check('しきい値を数値として読み出せる',
  Number.isFinite(HANDS)&&Number.isFinite(LIMIT)&&Number.isFinite(RESTRIKE),
  `指${HANDS}本 / 限界${LIMIT}レーン毎秒 / 叩き直し${RESTRIKE}ms`);
check('指の本数が2本(スマホを両手で持って親指で押す前提)',HANDS===2);
check('限界のほうが快適より速い(2段のしきい値が逆転していない)',
  LIMIT>readConst('LANE_SPEED_COMFORT')&&RESTRIKE<readConst('RESTRIKE_COMFORT_MS'));

// 実際の検出力は、道具が読む場所へ「押せない譜面」を置いて確かめる。
// 既存ファイルを壊さないよう、退避してから戻す。
const victim=path.join(authoring,'monster-hero-theme-v2-step5-chart-easy.json');
const hadVictim=fs.existsSync(victim);
const backup=hadVictim?fs.readFileSync(victim):null;
try{
  // 指2本がHOLDで塞がっている最中に、3本目が要るTAPを置く＝絶対に押せない
  const impossible={
    schemaVersion:1,analysisType:'rhythm-chart-v2-step5-chart',trackId:'monster_hero_theme',
    difficulty:'EASY',reviewRequired:true,runtimeConnected:false,noteCount:3,
    typeCounts:{HOLD:2,TAP:1},densityPerSecond:1,
    notes:[
      {type:'HOLD',grid:64,lane:0,subLane:0,subLaneWidth:2,durationGrids:32},
      {type:'HOLD',grid:64,lane:4,subLane:8,subLaneWidth:2,durationGrids:32},
      {type:'TAP', grid:80,lane:2,subLane:4,subLaneWidth:2},
    ],
  };
  fs.writeFileSync(victim,JSON.stringify(impossible,null,1)+'\n');
  const bad=run('--source','step5','--difficulty','EASY');
  check('両手が塞がっている最中のノーツを「押せない」と判定する',
    /押せない [1-9]\d*件/.test(bad.stdout)&&/押せる指がない/.test(bad.stdout),
    (bad.stdout.match(/EASY: .*/)||[''])[0]);
  check('押せない箇所があると終了コードで知らせる(自動修正ループが拾えるように)',bad.status===1);
  check('押せない箇所を場所つきで出す(小節・時刻・レーン)',
    /第\d+小節 レーン\d/.test(bad.stdout),(bad.stdout.match(/×.*/)||[''])[0].trim());

  // 同時押しが同じレーンに重なっている＝指が2本入らない
  const chordTooClose={...impossible,noteCount:2,typeCounts:{TAP:2},
    notes:[{type:'TAP',grid:64,lane:2,subLane:4,subLaneWidth:2},
           {type:'TAP',grid:64,lane:2,subLane:4,subLaneWidth:2}]};
  fs.writeFileSync(victim,JSON.stringify(chordTooClose,null,1)+'\n');
  const chord=run('--source','step5','--difficulty','EASY');
  check('同じレーンに重なった同時押しを「指が2本入らない」と判定する',
    /同時押しが近すぎて指が2本入らない/.test(chord.stdout));

  // 終点フリックは「弾いて戻す」ぶん指の解放が遅れる。同じ譜面で endFlick の有無だけを変え、
  // 遅れが実際に効いていることを対照で確かめる(遅れが効かなければ、押せない譜面を自動で作ってしまう)。
  const endFlickPair=endFlick=>({...impossible,noteCount:3,typeCounts:{HOLD:2,TAP:1},
    notes:[
      // 片方の指を長いHOLDで塞ぐ
      {type:'HOLD',grid:64,lane:4,subLane:8,subLaneWidth:2,durationGrids:64},
      // もう片方は終端の直後に同じレーンのTAPが来る。endFlickが無ければ「忙しい」で済む
      {type:'HOLD',grid:64,lane:0,subLane:0,subLaneWidth:2,durationGrids:32,...(endFlick?{endFlick:true}:{})},
      {type:'TAP',grid:97,lane:0,subLane:0,subLaneWidth:2},
    ]});
  fs.writeFileSync(victim,JSON.stringify(endFlickPair(false),null,1)+'\n');
  const plainEnd=run('--source','step5','--difficulty','EASY');
  check('終点フリックでなければ、終端の直後のノーツは押せる(忙しいだけ)',
    plainEnd.status===0&&/押せない 0件/.test(plainEnd.stdout)&&/忙しい [1-9]/.test(plainEnd.stdout),
    (plainEnd.stdout.match(/EASY: .*/)||[''])[0]);
  fs.writeFileSync(victim,JSON.stringify(endFlickPair(true),null,1)+'\n');
  const flickEnd=run('--source','step5','--difficulty','EASY');
  check('終点フリックにすると、同じ配置が「押せない」になる(弾いた指の戻りを数えている)',
    flickEnd.status===1&&/押せない [1-9]/.test(flickEnd.stdout),
    (flickEnd.stdout.match(/EASY: .*/)||[''])[0]);
  check('終点フリックはHOLD / SLIDEにだけ効く(TAPに書いても解放は遅れない)',(()=>{
    const tapEndFlick={...impossible,noteCount:2,typeCounts:{TAP:2},
      notes:[{type:'TAP',grid:64,lane:0,subLane:0,subLaneWidth:2,endFlick:true},
             {type:'TAP',grid:66,lane:0,subLane:0,subLaneWidth:2}]};
    fs.writeFileSync(victim,JSON.stringify(tapEndFlick,null,1)+'\n');
    const r=run('--source','step5','--difficulty','EASY');
    return r.status===0&&/押せない 0件/.test(r.stdout);
  })());

  // 何の問題もない譜面は素通しすること(誤検出しない)
  const fine={...impossible,noteCount:3,typeCounts:{TAP:3},
    notes:[{type:'TAP',grid:64,lane:0,subLane:0,subLaneWidth:2},
           {type:'TAP',grid:80,lane:2,subLane:4,subLaneWidth:2},
           {type:'TAP',grid:96,lane:4,subLane:8,subLaneWidth:2}]};
  fs.writeFileSync(victim,JSON.stringify(fine,null,1)+'\n');
  const ok=run('--source','step5','--difficulty','EASY');
  check('問題のない譜面を誤って「押せない」と言わない',
    ok.status===0&&/EASY: 3ノーツ  押せない 0件/.test(ok.stdout),
    (ok.stdout.match(/EASY: .*/)||[''])[0]);
}finally{
  if(hadVictim)fs.writeFileSync(victim,backup);
  else if(fs.existsSync(victim))fs.unlinkSync(victim);
}

// --- 3. 決定性 ---
const a=run('--source','v1'),b=run('--source','v1');
check('何度実行しても同じ結果になる',a.stdout===b.stdout);

// --- 4. 書き出しと、既存の成果物を壊さないこと ---
const protectedFiles=[
  'monster-hero/data/rhythm-mode.js','monster-hero/src/game-system.jsx',
  'monster-hero/debug/monster-hero-theme-easy-formal-candidate-v1.json',
  'monster-hero/debug/monster-hero-theme-normal-formal-candidate-v1.json',
  'monster-hero/debug/monster-hero-theme-hard-formal-candidate-v1.json',
];
const protectedBefore=protectedFiles.map(f=>hash(path.join(ROOT,f)));
run('--source','v1','--write');
check('ランタイム・既存の正式候補v1を書き換えない',
  protectedFiles.every((f,i)=>hash(path.join(ROOT,f))===protectedBefore[i]));

const outFile=path.join(authoring,'monster-hero-theme-v2-step6-playability-v1.json');
check('結果JSONが書き出される',fs.existsSync(outFile));
if(fs.existsSync(outFile)){
  const report=JSON.parse(fs.readFileSync(outFile,'utf8'));
  check('結果のスキーマ',report.schemaVersion===1
    &&report.analysisType==='rhythm-chart-v2-step6-playability'
    &&report.reviewRequired===true&&report.runtimeConnected===false);
  check('手のモデルの設定が結果に残る(あとから条件を追える)',
    report.handModel&&report.handModel.hands===HANDS&&report.handModel.laneSpeedLimit===LIMIT
    &&Number.isFinite(report.handModel.endFlickReleaseMs));
  check('STEP7が使えるよう、問題箇所に小節と時刻が入っている',
    Object.values(report.difficulties).every(d=>Array.isArray(d.issues)
      &&d.issues.every(x=>Number.isFinite(x.bar)&&Number.isFinite(x.timeMs)&&x.severity&&x.kind)));
  check('NaN / Infinityがない',!/NaN|Infinity/.test(fs.readFileSync(outFile,'utf8')));
}

// STEP5の成果物へ触っていないこと
const step5Files=fs.readdirSync(authoring).filter(f=>/-v2-step5-/.test(f));
check('STEP5の出力を書き換えない',
  step5Files.every(f=>beforeAuthoring.get(f)===hash(path.join(authoring,f))),
  `${step5Files.length}件`);

fs.rmSync(tempDir,{recursive:true,force:true});
console.log(failed?`\n${failed}件のNGがあります`:'\nすべてOK');
process.exit(failed?1:0);

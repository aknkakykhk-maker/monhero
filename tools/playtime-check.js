#!/usr/bin/env node
// プロフィールの「プレイ時間」を確かめる。
//
//   node tools/playtime-check.js
//
// 遊んだ時間は新しく数え始めたものなので、次を見張る。
//
//   1. 既存の保存(mh_*)を1つも書き換えない。新しいキーへ足すだけ
//   2. 保存値が無い・壊れていても必ず既定へ落ちる(型を確かめてから使う)
//   3. 画面が見えていないあいだ・スリープで飛んだぶんは数えない
//   4. 数えるたびに画面を描き直さない(バトル中や音ゲー中にカクつかせない)
//   5. プロフィールに、時間と「いつから数えているか」が出る
const fs=require('fs');
const path=require('path');
const vm=require('vm');

const ROOT=path.resolve(__dirname,'..');
const game=fs.readFileSync(path.join(ROOT,'monster-hero/src/game-system.jsx'),'utf8');
let failed=0;
const check=(name,ok,detail='')=>{console.log(`${ok?'OK':'NG'}: ${name}${detail?` — ${detail}`:''}`);if(!ok)failed++;};

// --- 関数を取り出して実際に動かす ---
const start=game.indexOf('const PLAYTIME_KEY');
const end=game.indexOf('const missionWeeklyPeriod');
check('プレイ時間の道具がひとまとまりで定義されている',start>=0&&end>start);
const block=game.slice(start,end);
const context={};
vm.createContext(context);
vm.runInContext(`${block}\nthis.out={PLAYTIME_KEY,PLAYTIME_TICK_MS,PLAYTIME_SAVE_MS,PLAYTIME_MAX_STEP_MS,playtimeDayKey,normalizePlaytime,formatPlaytime};`,context);
const {PLAYTIME_KEY,PLAYTIME_TICK_MS,PLAYTIME_SAVE_MS,PLAYTIME_MAX_STEP_MS,playtimeDayKey,normalizePlaytime,formatPlaytime}=context.out;

// --- 1. 既存の保存を壊さない ---
check('新しい保存キーを使う（既存のキーを流用しない）',PLAYTIME_KEY==='mh_playtime_v1');
const otherKeys=[...new Set([...game.matchAll(/'(mh_[a-z0-9_]+)'/g)].map(m=>m[1]))];
check('既存の保存キーと名前がぶつからない',otherKeys.filter(k=>k===PLAYTIME_KEY).length===1,`mh_*キー ${otherKeys.length}個`);
check('プレイ時間の保存は専用キーへだけ書く',
  (game.match(/storeSet\(PLAYTIME_KEY/g)||[]).length>0
  &&!/storeSet\('mh_(?!playtime)[a-z0-9_]*',\s*\{\s*totalMs/.test(game));

// --- 2. 壊れた値でも既定へ落ちる ---
const cases=[
  [null,0,null],[undefined,0,null],[{},0,null],['文字列',0,null],[[1,2],0,null],
  [{totalMs:'abc'},0,null],[{totalMs:-5},0,null],[{totalMs:NaN},0,null],[{totalMs:Infinity},0,null],
  [{totalMs:100,since:'x'},100,null],[{totalMs:100,since:123},100,null],
  [{totalMs:100,since:'2026-09-04'},100,'2026-09-04'],
];
check('保存値が無い・壊れていても既定へ落ちる',cases.every(([input,ms,since])=>{
  const out=normalizePlaytime(input);
  return out.totalMs===ms&&out.since===since;
}),`${cases.length}通りを確認`);
check('負の時間・NaN・Infinityを持ち込まない',
  [normalizePlaytime({totalMs:-1}),normalizePlaytime({totalMs:NaN}),normalizePlaytime({totalMs:Infinity})]
    .every(v=>Number.isFinite(v.totalMs)&&v.totalMs>=0));

// --- 3. 表示 ---
const shown=[[0,'1分未満'],[59000,'1分未満'],[60000,'1分'],[3599000,'59分'],[3600000,'1時間00分'],
  [3660000,'1時間01分'],[45296000,'12時間34分'],[360000000,'100時間00分']];
check('時間の書き方が読みやすい形になっている',shown.every(([ms,want])=>formatPlaytime(ms)===want),
  shown.map(([ms,want])=>`${ms}→${formatPlaytime(ms)}`).join(' / '));
check('おかしな値を渡しても表示が壊れない',
  [null,undefined,NaN,-1,'abc'].every(v=>typeof formatPlaytime(v)==='string'&&formatPlaytime(v).length>0));

// --- 4. 日付は日本時間で区切る ---
check('数え始めた日は日本時間で決める',
  playtimeDayKey(Date.parse('2026-09-04T14:30:00Z'))==='2026-09-04'
  &&playtimeDayKey(Date.parse('2026-09-04T15:30:00Z'))==='2026-09-05',
  `UTC14:30→${playtimeDayKey(Date.parse('2026-09-04T14:30:00Z'))} / UTC15:30→${playtimeDayKey(Date.parse('2026-09-04T15:30:00Z'))}`);

// --- 5. 数え方 ---
check('数える間隔・保存する間隔・1回の上限が定数で見える',
  PLAYTIME_TICK_MS>0&&PLAYTIME_SAVE_MS>=PLAYTIME_TICK_MS&&PLAYTIME_MAX_STEP_MS>=PLAYTIME_TICK_MS,
  `数える${PLAYTIME_TICK_MS/1000}秒 / 保存${PLAYTIME_SAVE_MS/1000}秒 / 上限${PLAYTIME_MAX_STEP_MS/1000}秒`);
check('保存はまとめて行う（数えるたびには書かない）',PLAYTIME_SAVE_MS>PLAYTIME_TICK_MS);
check('画面が見えていないあいだは数えない',
  game.includes("if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return;"));
check('スリープなどで大きく飛んだぶんは数えない',
  game.includes('if (!(delta > 0 && delta <= PLAYTIME_MAX_STEP_MS)) return;'));
check('画面を離れるときに保存する',
  game.includes("document.addEventListener('visibilitychange', onVisibility)")
  &&game.includes('else { accumulate(); persist(); }'));

// --- 6. 数えても画面を描き直さない ---
// 15秒ごとにsetStateすると、バトル中・音ゲー中に毎回描き直しが走ってカクつきの元になる。
check('数えるのはrefだけで、毎回stateを書き換えない',
  game.includes('const playtimeRef = useRef({ totalMs: 0, since: null });')
  &&game.includes('playtimeRef.current = { totalMs: current.totalMs + delta,'));
check('画面へ写すのはプロフィールを開いたときだけ',
  game.includes("if (gameState !== 'PROFILE') return;")
  &&game.includes('setPlaytimeView({ ...playtimeRef.current });'));
const tick=game.slice(game.indexOf('const accumulate = () => {'),game.indexOf('const onVisibility = () => {'));
check('数える処理の中でsetStateを呼ばない',!/set[A-Z]/.test(tick));

// --- 7. プロフィールに出る ---
check('プロフィールにプレイ時間が出る',
  game.includes('<span className="text-[10px] font-black text-indigo-200">プレイ時間</span>')
  &&game.includes('{formatPlaytime(playtimeView.totalMs)}'));
check('いつから数えているかも一緒に出す',
  game.includes('から数えています')&&game.includes('いま数え始めたところです'));

console.log(failed?`\n${failed}件のNGがあります`:'\nすべてOK');
process.exit(failed?1:0);

const TOOLS_DIR = require('path').join(__dirname, '..'); // tools/ 直下。分類フォルダから見た1つ上
// ベースモン一覧・マスモン一覧が、編成画面で外した種別チェックの影響で空にならないか確認する。
const fs=require('fs'),path=require('path'),assert=require('assert');
const src=fs.readFileSync(path.join(TOOLS_DIR,'..','monster-hero','src','game-system.jsx'),'utf8');
let failed=0;
const check=(name,ok)=>{console.log(`${ok?'OK':'NG'}: ${name}`);if(!ok)failed++;};

// 判定関数を本番の定義から取り出して動かす
const a=src.indexOf('  const monsterEntryMatchesDisplayFlags'),b=src.indexOf('\n  // モンスター一覧・マスモン一覧・編成画面のソート',a);
const body=src.slice(a,b).replace(/^\s*const monsterEntryMatchesDisplayFlags/,'const monsterEntryMatchesDisplayFlags');
const match=eval(`(()=>{${body}\nreturn monsterEntryMatchesDisplayFlags;})()`);

const base={type:'base'}, masu={type:'masu'}, rebornMasu={type:'masu',rebirthCount:2};
// 編成画面で「ベースモン」「マスモン」のチェックを外した状態
const offFlags={base:false,masu:false,fused:false,active:false,reborn:false};

check('編成画面では種別チェックどおりに絞る', match(base,offFlags)===false);
check('ベースモン一覧は種別チェックを見ない', match(base,offFlags,{ignoreTypeFlags:true})===true);
check('マスモン一覧も種別チェックを見ない', match(masu,offFlags,{ignoreTypeFlags:true})===true);
check('転生済みは転生チェックが必要', match(rebornMasu,offFlags,{ignoreTypeFlags:true})===false);
check('転生チェックを入れれば出る', match(rebornMasu,{...offFlags,reborn:true},{ignoreTypeFlags:true})===true);
// 従来の動き(種別チェックが入っていれば出る)は変わらない
check('種別チェックが入っていれば従来どおり出る', match(base,{...offFlags,base:true})===true);
check('合体済みチェックのOR条件は維持', match({type:'masu',fusionCount:1},{...offFlags,fused:true})===true);

// 画面側の結線
check('ベースモン一覧が種別無視の一覧を使う', src.includes("unifiedMonsterEntriesSingleType.filter(e=>e.type==='base')"));
check('マスモン一覧が種別無視の一覧を使う', src.includes("unifiedMonsterEntriesSingleType.filter(e=>e.type==='masu')"));
check('種別無視の一覧が定義されている', src.includes('const unifiedMonsterEntriesSingleType = useMemo('));
check('編成画面は従来の絞り込みのまま', src.includes('unifiedMonsterEntriesDraft.map('));

console.log(failed?`\n${failed}件のNGがあります`:'\nすべてOK');
process.exit(failed?1:0);

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');
const write = (rel, text) => fs.writeFileSync(path.join(root, rel), text);
const fail = (message) => { throw new Error(message); };
const replaceOnce = (text, before, after, label) => {
  const i = text.indexOf(before);
  if (i < 0) fail(`置換対象が見つかりません: ${label}`);
  if (text.indexOf(before, i + before.length) >= 0) fail(`置換対象が複数あります: ${label}`);
  return text.slice(0, i) + after + text.slice(i + before.length);
};

// -------------------- game-system.jsx --------------------
const sourcePath = 'monster-hero/src/game-system.jsx';
let source = read(sourcePath);

const applyMarker = `// 強化の下書き(plan)を当てはめた「強化後のマスモン」を、保存データに触れずに作る。`;
if (!source.includes('const directEnhancePointAmount =')) {
  const helper = `// 強化画面の数値直接入力を、0〜その項目へ振れる最大ポイントへ正規化する。\n// inputMode=numeric でも貼り付けでは記号等が入り得るため、整数だけを受け付ける。\nconst directEnhancePointAmount = (rawValue, maxValue) => {\n  const text = String(rawValue ?? '').trim();\n  const max = Math.max(0, Math.floor(Number(maxValue) || 0));\n  if (!/^\\d+$/.test(text)) return 0;\n  const parsed = Number(text);\n  const wanted = Number.isFinite(parsed) ? Math.floor(parsed) : Number.MAX_SAFE_INTEGER;\n  return Math.min(Math.max(0, wanted), max);\n};\n\n`;
  source = replaceOnce(source, applyMarker, helper + applyMarker, 'directEnhancePointAmount');
}

const normalAddMarker = `          const addPlanApt = (idx, direction) => changePlan('apt',idx,direction);\n          const addPlanStat = (key, direction) => changePlan('stat',key,direction);\n          const applyPlan = () => {`;
const normalSetter = `          const addPlanApt = (idx, direction) => changePlan('apt',idx,direction);\n          const addPlanStat = (key, direction) => changePlan('stat',key,direction);\n          const setPlanExact = (kind, target, rawValue) => setBulkPlan(previous => {\n            const q=previous?{apt:[...previous.apt],stat:{...previous.stat}}:{apt:[0,0,0,0],stat:{hp:0,atk:0,def:0,guts:0}};\n            const current=kind==='apt'?q.apt[target]:(q.stat[target]||0);\n            const used=q.apt.reduce((a,b)=>a+b,0)+Object.values(q.stat).reduce((a,b)=>a+b,0);\n            let maxForRow=Math.max(0,points-(used-current));\n            if(kind==='apt'){\n              const baseGradeIndex=DIST_APTITUDE_GRADES.indexOf(resolvedDistAptitude[target]||'C');\n              maxForRow=Math.min(maxForRow,Math.max(0,DIST_APTITUDE_GRADES.length-1-baseGradeIndex));\n            }\n            const next=directEnhancePointAmount(rawValue,maxForRow);\n            if(kind==='apt')q.apt[target]=next;else q.stat[target]=next;\n            return q;\n          });\n          const applyPlan = () => {`;
if (!source.includes('const setPlanExact =')) source = replaceOnce(source, normalAddMarker, normalSetter, '通常強化の直接入力setter');

const normalAptOld = `<span className="text-center text-[9px] font-mono font-black text-amber-300">{added}pt</span>`;
const normalAptNew = `<label className="flex items-center gap-0.5 min-w-0"><input data-direct-point-input="normal-apt" aria-label={\`\${label}距離適性の振り分けポイントを直接入力\`} type="text" inputMode="numeric" pattern="[0-9]*" enterKeyHint="done" autoComplete="off" value={added} onFocus={e=>e.currentTarget.select()} onChange={e=>setPlanExact('apt',idx,e.currentTarget.value)} onKeyDown={e=>{if(e.key==='Enter')e.currentTarget.blur();}} className="w-full min-w-0 h-8 rounded-md border border-amber-500/30 bg-slate-950/80 px-0.5 text-center text-[9px] font-mono font-black text-amber-300 outline-none focus:border-amber-300"/><span className="text-[8px] font-black text-amber-300">P</span></label>`;
if (!source.includes('data-direct-point-input="normal-apt"')) source = replaceOnce(source, normalAptOld, normalAptNew, '通常強化・間合い適性の直接入力');

const normalStatOld = `<span className="text-center text-[9px] font-mono font-black text-amber-300">{n}pt</span>`;
const normalStatNew = `<label className="flex items-center gap-0.5 min-w-0"><input data-direct-point-input="normal-stat" aria-label={\`\${label}の振り分けポイントを直接入力\`} type="text" inputMode="numeric" pattern="[0-9]*" enterKeyHint="done" autoComplete="off" value={n} onFocus={e=>e.currentTarget.select()} onChange={e=>setPlanExact('stat',key,e.currentTarget.value)} onKeyDown={e=>{if(e.key==='Enter')e.currentTarget.blur();}} className="w-full min-w-0 h-8 rounded-md border border-amber-500/30 bg-slate-950/80 px-0.5 text-center text-[9px] font-mono font-black text-amber-300 outline-none focus:border-amber-300"/><span className="text-[8px] font-black text-amber-300">P</span></label>`;
if (!source.includes('data-direct-point-input="normal-stat"')) source = replaceOnce(source, normalStatOld, normalStatNew, '通常強化・ステータスの直接入力');

const transAddMarker = `          const addApt = (idx, direction) => changeTranscendPlan('apt', idx, direction);\n          const addStat = (key, direction) => changeTranscendPlan('stat', key, direction);\n          // 虹のプシュケーの変換シート。ここで欲しいポイント数を決めてから確定する`;
const transSetter = `          const addApt = (idx, direction) => changeTranscendPlan('apt', idx, direction);\n          const addStat = (key, direction) => changeTranscendPlan('stat', key, direction);\n          const setTranscendPlanExact = (kind, target, rawValue) => setTranscendPlan(previous => {\n            const q=previous?{apt:[...previous.apt],stat:{...previous.stat}}:{apt:[0,0,0,0],stat:{hp:0,atk:0,def:0,guts:0}};\n            const current=kind==='apt'?q.apt[target]:(q.stat[target]||0);\n            const used=q.apt.reduce((a,b)=>a+b,0)+Object.values(q.stat).reduce((a,b)=>a+b,0);\n            let maxForRow=Math.max(0,points-(used-current));\n            if(kind==='apt'){\n              const room=DIST_APTITUDE_GRADES.length-1-DIST_APTITUDE_GRADES.indexOf(transcendGrade(target));\n              maxForRow=Math.min(maxForRow,Math.max(0,room));\n            }\n            const next=directEnhancePointAmount(rawValue,maxForRow);\n            if(kind==='apt')q.apt[target]=next;else q.stat[target]=next;\n            return q;\n          });\n          // 虹のプシュケーの変換シート。ここで欲しいポイント数を決めてから確定する`;
if (!source.includes('const setTranscendPlanExact =')) source = replaceOnce(source, transAddMarker, transSetter, '超越強化の直接入力setter');

const transAptOld = `<span className="text-center text-[9px] font-mono font-black text-sky-300">{added}P</span>`;
const transAptNew = `<label className="flex items-center gap-0.5 min-w-0"><input data-direct-point-input="transcend-apt" aria-label={\`\${label}の基礎適性の振り分けポイントを直接入力\`} type="text" inputMode="numeric" pattern="[0-9]*" enterKeyHint="done" autoComplete="off" value={added} onFocus={e=>e.currentTarget.select()} onChange={e=>setTranscendPlanExact('apt',idx,e.currentTarget.value)} onKeyDown={e=>{if(e.key==='Enter')e.currentTarget.blur();}} className="w-full min-w-0 h-8 rounded-md border border-sky-500/30 bg-slate-950/80 px-0.5 text-center text-[9px] font-mono font-black text-sky-300 outline-none focus:border-sky-300"/><span className="text-[8px] font-black text-sky-300">P</span></label>`;
if (!source.includes('data-direct-point-input="transcend-apt"')) source = replaceOnce(source, transAptOld, transAptNew, '超越強化・間合い適性の直接入力');

const transStatOld = `<span className="text-center text-[9px] font-mono font-black text-sky-300">{n}P</span>`;
const transStatNew = `<label className="flex items-center gap-0.5 min-w-0"><input data-direct-point-input="transcend-stat" aria-label={\`\${label}の基礎値の振り分けポイントを直接入力\`} type="text" inputMode="numeric" pattern="[0-9]*" enterKeyHint="done" autoComplete="off" value={n} onFocus={e=>e.currentTarget.select()} onChange={e=>setTranscendPlanExact('stat',key,e.currentTarget.value)} onKeyDown={e=>{if(e.key==='Enter')e.currentTarget.blur();}} className="w-full min-w-0 h-8 rounded-md border border-sky-500/30 bg-slate-950/80 px-0.5 text-center text-[9px] font-mono font-black text-sky-300 outline-none focus:border-sky-300"/><span className="text-[8px] font-black text-sky-300">P</span></label>`;
if (!source.includes('data-direct-point-input="transcend-stat"')) source = replaceOnce(source, transStatOld, transStatNew, '超越強化・ステータスの直接入力');

write(sourcePath, source);

// -------------------- help --------------------
const helpPath = 'monster-hero/data/help.js';
let help = read(helpPath);
const normalHelpOld = `マスモン一覧の詳細画面から振れます。まとめて強化では、全項目共通の1P・5P・10P・MAXから単位を選び、＋／−（長押し対応）で下書きしてから一度に確定できます。MAXの＋は残りポイントと上限の範囲で最大まで配分し、MAXの−はその項目への今回の配分をすべて戻します。`;
const normalHelpNew = `マスモン一覧の詳細画面から振れます。まとめて強化では、全項目共通の1P・5P・10P・MAXから単位を選んで＋／−（長押し対応）で調整できるほか、各項目のpt欄をタップして使いたいポイント数を直接入力できます。直接入力も残りポイントと間合い適性の上限Mを超えない範囲で止まり、下書きしてから一度に確定します。MAXの＋は残りポイントと上限の範囲で最大まで配分し、MAXの−はその項目への今回の配分をすべて戻します。`;
if (!help.includes('各項目のpt欄をタップして使いたいポイント数を直接入力')) help = replaceOnce(help, normalHelpOld, normalHelpNew, '通常強化ヘルプ');
const transHelpOld = `振り分けかたは通常強化と同じで、1P／5P／10P／MAXの単位を選び、＋−は長押しでも動かせます。確定するまで保存データは変わりません。`;
const transHelpNew = `振り分けかたは通常強化と同じで、1P／5P／10P／MAXの単位と＋−の長押しに加え、各項目のP欄をタップして使いたいポイント数を直接入力できます。残りポイントと間合い適性の上限Mを超える入力は自動で上限までに収まり、確定するまで保存データは変わりません。`;
if (!help.includes('各項目のP欄をタップして使いたいポイント数を直接入力')) help = replaceOnce(help, transHelpOld, transHelpNew, '超越強化ヘルプ');
write(helpPath, help);

// -------------------- changelog --------------------
const changelogPath = 'monster-hero/data/changelog.js';
let changelog = read(changelogPath);
if (!changelog.includes('強化ポイントを数値で直接入力できるようにしました')) {
  const marker = `const CHANGELOG = [\n`;
  const entry = `  {\n    date: "2026-08-30 14:30", type: 'update', title: '強化ポイントを数値で直接入力できるようにしました', status: 'new',\n    items: [\n      '通常強化と超越強化の振り分けで、各項目のポイント数を直接入力できるようにしました。大量のポイントも何度も＋を押さずに配分できます。',\n      '直接入力は残りポイントと間合い適性の上限Mを超えない範囲へ自動で調整され、確定するまでは保存されません。従来の1P／5P／10P／MAXと＋／−長押しもそのまま使えます。',\n    ],\n  },\n`;
  changelog = replaceOnce(changelog, marker, marker + entry, '更新履歴');
}
write(changelogPath, changelog);

// -------------------- bulk-enhance browser check --------------------
const bulkCheckPath = 'tools/masu/bulk-enhance-check.js';
let bulkCheck = read(bulkCheckPath);
if (!bulkCheck.includes('数値直接入力で37Pを仮配分できる')) {
  const marker = `  check('1P・5P・10P・MAXの共通切替がある', await page.locator('[aria-label="振り分け単位"] button').count() === 4);\n\n`;
  const extra = `  const directLife = page.locator('input[aria-label="ライフの振り分けポイントを直接入力"]');\n  check('ポイント数の直接入力欄がある', await directLife.count() === 1);\n  await directLife.fill('37'); await page.waitForTimeout(120);\n  allocation = await shownAllocation();\n  check('数値直接入力で37Pを仮配分できる', allocation && allocation.total-allocation.left === 37, allocation?.text);\n  check('直接入力中も確定前はセーブ値が変わらない', JSON.stringify(await stored()) === JSON.stringify(before));\n  await directLife.fill('999'); await page.waitForTimeout(120);\n  allocation = await shownAllocation();\n  check('直接入力は残りポイントを超えず自動で上限に収まる', allocation && allocation.left === 0 && await directLife.inputValue() === '100', allocation?.text);\n  await click('配分をすべて取消');\n  const directApt = page.locator('input[aria-label="零距離適性の振り分けポイントを直接入力"]');\n  await directApt.fill('99'); await page.waitForTimeout(120);\n  allocation = await shownAllocation();\n  check('間合い適性の直接入力はMまでの段階数で止まる', await directApt.inputValue() === '7' && allocation && allocation.total-allocation.left === 7, allocation?.text);\n  await click('配分をすべて取消');\n\n`;
  bulkCheck = replaceOnce(bulkCheck, marker, marker + extra, 'bulk-enhance-checkの直接入力検査');
}
write(bulkCheckPath, bulkCheck);

// -------------------- transcend browser check --------------------
const layerCheckPath = 'tools/masu/masu-enhance-layer-check.js';
let layerCheck = read(layerCheckPath);
if (!layerCheck.includes('超越強化にも8項目の数値直接入力がある')) {
  const marker = `    check('超越強化で詳細が重なっていない', atTranscend.length === 1 && atTranscend[0].startsWith('超越強化'),\n      atTranscend.join(' + ') || 'なし');\n`;
  const extra = `    check('超越強化にも8項目の数値直接入力がある',\n      await page.locator('[data-direct-point-input="transcend-apt"]').count() === 4\n      && await page.locator('[data-direct-point-input="transcend-stat"]').count() === 4);\n`;
  layerCheck = replaceOnce(layerCheck, marker, marker + extra, '超越強化ブラウザ検査');
}
write(layerCheckPath, layerCheck);

// -------------------- static regression check --------------------
const directCheckPath = path.join(root, 'tools/masu/direct-enhance-input-check.js');
const directCheck = `const fs = require('fs');\nconst path = require('path');\n\nconst root = path.resolve(__dirname, '../..');\nconst source = fs.readFileSync(path.join(root, 'monster-hero/src/game-system.jsx'), 'utf8');\nconst help = fs.readFileSync(path.join(root, 'monster-hero/data/help.js'), 'utf8');\nconst changelog = fs.readFileSync(path.join(root, 'monster-hero/data/changelog.js'), 'utf8');\nlet failed = 0;\nconst check = (name, ok, detail='') => { console.log(\`${'${'}ok?'OK':'NG'}: ${'${'}name}${'${'}detail?' — '+detail:''}\`); if(!ok) failed++; };\n\nconst start = source.indexOf('const directEnhancePointAmount =');\nconst end = source.indexOf('// 強化の下書き(plan)を当てはめた', start);\nlet direct = null;\ntry {\n  if (start >= 0 && end > start) direct = new Function(\`${'${'}source.slice(start,end)}\\nreturn directEnhancePointAmount;\`)();\n} catch (e) { check('直接入力の正規化関数を取り出せる', false, e.message); }\ncheck('直接入力の正規化関数がある', typeof direct === 'function');\nif (direct) {\n  check('37Pをそのまま受け付ける', direct('37',100) === 37);\n  check('残り100Pに999を入れると100で止まる', direct('999',100) === 100);\n  check('負数・小数・文字は0にする', direct('-5',100) === 0 && direct('12.5',100) === 0 && direct('abc',100) === 0);\n  check('空欄は0にする', direct('',100) === 0);\n  check('巨大な整数も上限へ安全に収める', direct('999999999999999999999999999999999999',7) === 7);\n}\ncheck('通常強化の能力・適性に直接入力がある', source.includes('data-direct-point-input="normal-stat"') && source.includes('data-direct-point-input="normal-apt"') && source.includes('const setPlanExact ='));\ncheck('超越強化の能力・適性にも直接入力がある', source.includes('data-direct-point-input="transcend-stat"') && source.includes('data-direct-point-input="transcend-apt"') && source.includes('const setTranscendPlanExact ='));\ncheck('スマホで数字キーボードを出す', (source.match(/inputMode="numeric"/g)||[]).length >= 4 && (source.match(/pattern="\\[0-9\\]\\*"/g)||[]).length >= 4);\ncheck('従来の1P/5P/10P/MAXと長押しを残す', source.includes("{[1,5,10,'MAX'].map") && source.includes('PressRepeatButton aria-label={`${label}を増やす`}') && source.includes('PressRepeatButton aria-label={`${label}の基礎値を上げる`}'));\ncheck('ヘルプへ数値直接入力を反映', help.includes('使いたいポイント数を直接入力'));\ncheck('更新履歴へ反映', changelog.includes('強化ポイントを数値で直接入力できるようにしました'));\nconsole.log(failed ? \`\\n${'${'}failed}件のNGがあります\` : '\\nすべてOK');\nprocess.exit(failed ? 1 : 0);\n`;
fs.writeFileSync(directCheckPath, directCheck);

// tools/README.mdへ登録
const toolsReadmePath = 'tools/README.md';
let toolsReadme = read(toolsReadmePath);
if (!toolsReadme.includes('direct-enhance-input-check.js')) {
  const row = `| \`node masu/bulk-enhance-check.js\` | マスモンの「まとめて強化」が正しく動くか確認する。 |`;
  const newRow = `${row}\n| \`node masu/direct-enhance-input-check.js\` | 通常強化・超越強化のポイント数直接入力を確認する。整数だけを受け付け、残りポイントと間合い適性Mの上限で止まること、従来の1P・5P・10P・MAXと長押し操作を残すこと、ヘルプ・更新履歴への反映を見る。 |`;
  toolsReadme = replaceOnce(toolsReadme, row, newRow, 'tools/READMEへの検査登録');
}
write(toolsReadmePath, toolsReadme);

console.log('OK: 強化ポイント直接入力の変更を適用しました');

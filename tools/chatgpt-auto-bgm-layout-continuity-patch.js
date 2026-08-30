const fs=require('fs');
const path=require('path');
const root=path.resolve(__dirname,'..');
const srcPath=path.join(root,'monster-hero/src/game-system.jsx');
const helpPath=path.join(root,'monster-hero/data/help.js');
const logPath=path.join(root,'monster-hero/data/changelog.js');
let src=fs.readFileSync(srcPath,'utf8');
const replaceOnce=(text,from,to,label)=>{const i=text.indexOf(from);if(i<0)throw new Error('missing '+label);if(text.indexOf(from,i+1)>=0)throw new Error('duplicate '+label);return text.slice(0,i)+to+text.slice(i+from.length);};

const topBtn=`{(autoBattle||autoRepeat)&&<button type="button" onClick={()=>setShowAutoBgmPicker(true)} aria-label="AUTO BGMを選ぶ" title="AUTO BGM" className="shrink-0 w-[28px] h-[28px] flex items-center justify-center rounded bg-indigo-800 border border-indigo-400/50 text-[13px] active:scale-90">🎵</button>}`;
if(!src.includes(topBtn)) throw new Error('top AUTO BGM button not found');
src=src.replace(topBtn,'');

const bottomBtn=`{(autoBattle||autoRepeat)&&<button data-auto-bgm-button type="button" onClick={()=>setShowAutoBgmPicker(true)} aria-label="AUTO BGMを選ぶ" title="AUTO BGM" className="shrink-0 min-h-[32px] min-w-[42px] rounded-lg border border-indigo-400/50 bg-indigo-800 px-1.5 text-indigo-100 active:scale-90"><span className="block text-[13px] leading-none">🎵</span><span className="mt-0.5 block text-[7px] font-black leading-none">BGM</span></button>}`;
const ultraView=`<button onClick={()=>setShowDeckInfo(true)} className="flex min-h-[32px] items-center gap-0.5 rounded-lg border border-white/10 bg-white/5 px-2 text-[7px] font-black"><Layers size={9}/>VIEW</button>`;
const normalView=`<button onClick={()=>setShowDeckInfo(true)} className={\`flex items-center gap-0.5 px-1.5 py-1 bg-white/5 rounded-lg border border-white/10 active:scale-95\${battleTutorialSpotClass('deckView')}\`}><Layers size={9}/><span className="text-[7px]">VIEW</span></button>`;
if(!src.includes(ultraView)||!src.includes(normalView)) throw new Error('bottom VIEW anchors not found');
src=src.replace(ultraView,ultraView+bottomBtn);
src=src.replace(normalView,normalView+bottomBtn);

const phaseOld=`if (RUN_PHASE_STATES.includes(state)) {\n      if (wavesDone && autoBattleRef.current && bgmArrangement.autoPostWaveBgm !== 'on') return '__keep_battle_bgm__';`;
const phaseNew=`if (RUN_PHASE_STATES.includes(state)) {\n      // AUTO∞の次周開始時はwaveHistoryが0へ戻る中間フェーズでも、直前のBGMを維持する。\n      // ここでenhance/resultへ一瞬切り替わると、次のBATTLEでAUTO曲が先頭から再生されてしまう。\n      if (autoRepeatRef.current && !wavesDone) return '__keep_battle_bgm__';\n      if (wavesDone && autoBattleRef.current && bgmArrangement.autoPostWaveBgm !== 'on') return '__keep_battle_bgm__';`;
src=replaceOnce(src,phaseOld,phaseNew,'RUN_PHASE continuity');
fs.writeFileSync(srcPath,src);

let help=fs.readFileSync(helpPath,'utf8');
const oldHelp='超省エネは開始時は従来どおり無音ですが、🎵ボタンでBGMを選ぶとBGMだけ再生できます。';
const newHelp='AUTO中の🎵BGMボタンは、スコア表示などと重ならないよう画面下部のVIEW／AUTO付近にあります。超省エネは開始時は従来どおり無音ですが、🎵ボタンでBGMを選ぶとBGMだけ再生できます。AUTO∞では10WAVE終了から次周開始まで同じBGMの再生位置を維持し、次周のたびに曲頭へ戻りません。';
if(!help.includes(oldHelp)) throw new Error('help anchor not found');
help=help.replace(oldHelp,newHelp);
fs.writeFileSync(helpPath,help);

let log=fs.readFileSync(logPath,'utf8');
const marker='const CHANGELOG = [\n';
if(!log.includes(marker)) throw new Error('changelog marker not found');
const entry=`  {\n    date: "2026-08-30 09:28", type: 'fix', title: 'AUTO∞のBGM操作と周回継続を改善しました', status: 'new',\n    items: [\n      'AUTO中のBGM選択ボタンを画面上部から、スコア表示と競合しにくい画面下部のVIEW／AUTO付近へ移動しました。',\n      'AUTO∞で10WAVE終了後に次周へ入るとき、BGMが曲頭へ戻らず同じ再生位置のまま継続するようにしました。',\n      '超省エネ中の「BGMだけ再生／SEはOFF」と「BGMなし」の仕様はそのまま維持します。',\n    ],\n  },\n`;
log=log.replace(marker,marker+entry);
fs.writeFileSync(logPath,log);

const checkPath=path.join(root,'tools/audio/auto-bgm-loop-continuity-check.js');
fs.writeFileSync(checkPath,`const fs=require('fs');\nconst path=require('path');\nconst ROOT=path.resolve(__dirname,'../..');\nconst files=['monster-hero/src/game-system.jsx','monster-hero/game-system.compiled.js'];\nlet failed=0;const check=(n,ok)=>{console.log((ok?'OK':'NG')+': '+n);if(!ok)failed++;};\nfor(const f of files){const s=fs.readFileSync(path.join(ROOT,f),'utf8');\ncheck(f+': BGMボタンを上部コントロールから撤去',!s.includes('w-[28px] h-[28px] flex items-center justify-center rounded bg-indigo-800 border border-indigo-400/50 text-[13px] active:scale-90'));\ncheck(f+': 下部BGMボタン',s.includes('data-auto-bgm-button'));\ncheck(f+': AUTO∞次周の中間フェーズでBGM継続',s.includes("if (autoRepeatRef.current && !wavesDone) return '__keep_battle_bgm__';"));}\nconst help=fs.readFileSync(path.join(ROOT,'monster-hero/data/help.js'),'utf8');const log=fs.readFileSync(path.join(ROOT,'monster-hero/data/changelog.js'),'utf8');\ncheck('ヘルプに配置変更と次周継続を掲載',help.includes('VIEW／AUTO付近')&&help.includes('曲頭へ戻りません'));\ncheck('更新履歴に修正を掲載',log.includes('AUTO∞のBGM操作と周回継続を改善しました'));\nif(failed)process.exit(1);console.log('OK: AUTO BGM layout/loop continuity checks passed');\n`);
console.log('AUTO BGM layout/continuity patch applied');

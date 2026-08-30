#!/usr/bin/env node
const fs=require('fs');
const path=require('path');
const ROOT=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(ROOT,p),'utf8');
const write=(p,s)=>fs.writeFileSync(path.join(ROOT,p),s);
const once=(s,from,to,label)=>{const n=s.split(from).length-1;if(n!==1)throw new Error(`${label}: expected 1 match, got ${n}`);return s.replace(from,to);};

const gamePath='monster-hero/src/game-system.jsx';
let game=read(gamePath);
game=once(game,
  "  const [autoRepeat, setAutoRepeat] = useState(false);\n  const autoRepeatRef = useRef(false);",
  "  const [autoRepeat, setAutoRepeat] = useState(false);\n  const autoRepeatRef = useRef(false);\n  // AUTO中だけ使うBGMの一時上書き。保存済みBGMアレンジは書き換えない。\n  const [autoBgmOverride, setAutoBgmOverride] = useState(null);\n  const [showAutoBgmPicker, setShowAutoBgmPicker] = useState(false);",
  'AUTO runtime BGM states');
game=once(game,
  "    setAutoRepeat(false);\n    setAutoRepeatBattleSpeed(false);\n    setEcoModeSafe('off');",
  "    setAutoRepeat(false);\n    setAutoRepeatBattleSpeed(false);\n    setEcoModeSafe('off');\n    setAutoBgmOverride(null);\n    setShowAutoBgmPicker(false);",
  'AUTO runtime BGM reset');
game=once(game,
  "  const audioMuted = !audioOn;\n  // バトル画面などスペースが限られる場所向けの1タップミュート切替",
  "  const audioMuted = !audioOn;\n  const selectAutoRuntimeBgm = (trackId) => {\n    if (trackId !== '__none__' && !BGM_TRACK_BY_ID[trackId]) return;\n    setAutoBgmOverride(trackId);\n  };\n  // バトル画面などスペースが限られる場所向けの1タップミュート切替",
  'AUTO runtime BGM selector');
game=once(game,
  "      if (autoBattleRef.current) return bgmArrangement.autoBattle;",
  "      if (autoBattleRef.current) {\n        if (autoBgmOverride === '__none__') return '__silence_bgm__';\n        return autoBgmOverride || bgmArrangement.autoBattle;\n      }",
  'AUTO runtime BGM routing');
game=once(game,
  "    if (key === '__keep_battle_bgm__') {\n      if (!audioOn) Audio_.stopBGM();\n      return;\n    }",
  "    if (key === '__keep_battle_bgm__') {\n      if (!audioOn) Audio_.stopBGM();\n      return;\n    }\n    // AUTO中の「BGMなし」はSE設定を触らず、BGMだけ止める。\n    if (key === '__silence_bgm__') {\n      Audio_.stopBGM();\n      return;\n    }",
  'AUTO runtime BGM silence');
game=once(game,
  "  }, [bootPhase, gameState, wave, enemy?.id, hp, gaveUp, audioOn, waveHistory.length, bgmArrangement, runMode, eventBgmScene, mainHero?.id, autoBattle]);",
  "  }, [bootPhase, gameState, wave, enemy?.id, hp, gaveUp, audioOn, waveHistory.length, bgmArrangement, runMode, eventBgmScene, mainHero?.id, autoBattle, autoBgmOverride]);",
  'AUTO runtime BGM effect dependency');
const volumeButton='<button onClick={toggleQuickMute} aria-label="音量" className="shrink-0 p-1.5 bg-slate-800 rounded text-slate-300 active:scale-90 text-[12px] leading-none w-[28px] h-[28px] flex items-center justify-center">{audioMuted?\'🔇\':\'🔊\'}</button>';
game=once(game,
  volumeButton+'<button onClick={()=>openHelp()} aria-label="ヘルプ"',
  volumeButton+"{(autoBattle||autoRepeat)&&<button type=\"button\" onClick={()=>setShowAutoBgmPicker(true)} aria-label=\"AUTO BGMを選ぶ\" title=\"AUTO BGM\" className=\"shrink-0 w-[28px] h-[28px] flex items-center justify-center rounded bg-indigo-800 border border-indigo-400/50 text-[13px] active:scale-90\">🎵</button>}<button onClick={()=>openHelp()} aria-label=\"ヘルプ\"",
  'AUTO BGM picker button');
const overlayAnchor='      {updateNotice}\n      {/* AUTO∞の超省エネ中は、BATTLEから中間画面・CHAMPION・次周まで同じ暗さを保つ。 */}';
const overlay=`      {updateNotice}\n      {showAutoBgmPicker&&(autoBattle||autoRepeat)&&<div data-auto-bgm-picker className="fixed inset-0 flex items-end justify-center bg-black/55 p-3" style={{zIndex:2147483647}} onClick={()=>setShowAutoBgmPicker(false)}><div className="w-full max-w-sm rounded-2xl border border-indigo-300/40 bg-slate-950 p-4 text-left shadow-2xl" onClick={e=>e.stopPropagation()}><div className="flex items-center justify-between gap-2 mb-3"><div><div className="text-sm font-black text-white">AUTO BGM</div><div className="text-[10px] text-slate-400">このAUTOセッションだけ変更</div></div><button type="button" onClick={()=>setShowAutoBgmPicker(false)} className="min-w-[44px] min-h-[44px] rounded-xl bg-slate-800 text-slate-200 font-black">×</button></div><label className="block"><span className="text-xs font-black text-slate-300">再生するBGM</span><select aria-label="AUTO中に再生するBGM" value={autoBgmOverride||bgmArrangement.autoBattle} onChange={e=>selectAutoRuntimeBgm(e.target.value)} className="mt-1 w-full min-h-[48px] rounded-xl border border-white/15 bg-slate-900 px-3 text-sm text-white"><option value="__none__">BGMなし</option>{BGM_TRACKS.map(track=><option key={track.id} value={track.id}>{track.name}</option>)}</select></label><p className="mt-2 text-[10px] leading-relaxed text-slate-400">AUTOを完全に終了すると、この一時選択は解除されます。BGMアレンジの保存内容は変更しません。</p></div></div>}\n      {/* AUTO∞の超省エネ中は、BATTLEから中間画面・CHAMPION・次周まで同じ暗さを保つ。 */}`;
game=once(game,overlayAnchor,overlay,'AUTO BGM picker modal');
write(gamePath,game);

const helpPath='monster-hero/data/help.js';
let help=read(helpPath);
const oldHelp="          { t:'note', title:'AUTO中のBGM', text:'AUTOをオンにすると、BGMアレンジの「AUTOモード BGM」で選んだ曲をバトル中に使います。初期設定は「Monster Hero」です。敵撃破ファンファーレとWAVE後の強化フェーズ用BGMは初期設定ではOFFなので、WAVE間でもAUTOモードBGMが途切れず続きます。AUTO∞では最終リザルトのゲームクリアBGMも初期設定はOFFで、直前のBGMをそのまま継続します。タイトル画面のBGMアレンジ「その他」から各項目をONに戻せます。パンドラ勇者の最終ボス専用BGMはAUTOより優先し、AUTO∞の「超省エネ」は従来どおりミュートです。' },";
const newHelp="          { t:'note', title:'AUTO中のBGM', text:'AUTOをオンにすると、BGMアレンジの「AUTOモード BGM」で選んだ曲をバトル中に使います。初期設定は「Monster Hero」です。AUTO中はバトル画面の🎵ボタンから、そのAUTOセッションだけ別の登録曲へ変更でき、「BGMなし」も選べます。この一時選択はAUTOを完全に終了すると解除され、BGMアレンジの保存内容は変わりません。敵撃破ファンファーレとWAVE後の強化フェーズ用BGMは初期設定ではOFFなので、WAVE間でもAUTOモードBGMが途切れず続きます。AUTO∞では最終リザルトのゲームクリアBGMも初期設定はOFFで、直前のBGMをそのまま継続します。タイトル画面のBGMアレンジ「その他」から各項目をONに戻せます。パンドラ勇者の最終ボス専用BGMはAUTOより優先します。' },";
help=once(help,oldHelp,newHelp,'AUTO picker help');
write(helpPath,help);

const changelogPath='monster-hero/data/changelog.js';
let changelog=read(changelogPath);
const entry=`  {\n    date: "2026-08-30 09:15", type: 'update', title: 'AUTO中にBGMを選べるようにしました', status: 'new',\n    items: [\n      'AUTO中のバトル画面に🎵ボタンを追加し、その場で登録済みBGMへ切り替えられるようにしました。',\n      'BGM選択には「BGMなし」もあり、選ぶとSE設定を変えずにBGMだけ止めます。',\n      'バトル中の選択はそのAUTOセッションだけの一時設定で、AUTOを完全に終了すると解除されます。BGMアレンジの保存内容は変更しません。',\n    ],\n  },\n`;
changelog=once(changelog,'const CHANGELOG = [\n','const CHANGELOG = [\n'+entry,'changelog entry');
write(changelogPath,changelog);

write('tools/audio/auto-bgm-runtime-picker-check.js',`const fs=require('fs');\nconst path=require('path');\nconst ROOT=path.resolve(__dirname,'../..');\nconst files=['monster-hero/src/game-system.jsx','monster-hero/game-system.compiled.js'];\nlet failed=0;const check=(name,ok)=>{console.log((ok?'OK':'NG')+': '+name);if(!ok)failed++;};\nfor(const file of files){const s=fs.readFileSync(path.join(ROOT,file),'utf8');check(file+': AUTO BGM一時上書きstate',s.includes('autoBgmOverride')&&s.includes('showAutoBgmPicker'));check(file+': AUTO停止で一時選択を解除',s.includes('setAutoBgmOverride(null)')&&s.includes('setShowAutoBgmPicker(false)'));check(file+': AUTO中は一時選択を優先',s.includes("if (autoBgmOverride === '__none__') return '__silence_bgm__';")&&s.includes('return autoBgmOverride || bgmArrangement.autoBattle;'));check(file+': BGMなしはBGMだけ停止',s.includes("if (key === '__silence_bgm__')")&&s.includes('Audio_.stopBGM();'));check(file+': AUTO BGM選択ボタン',s.includes('AUTO BGMを選ぶ')&&s.includes('🎵'));check(file+': BGMなしを選択肢に表示',s.includes('<option value="__none__">BGMなし</option>'));check(file+': 登録曲を選択肢に使用',s.includes('BGM_TRACKS.map(track=>'));}\nconst help=fs.readFileSync(path.join(ROOT,'monster-hero/data/help.js'),'utf8');const log=fs.readFileSync(path.join(ROOT,'monster-hero/data/changelog.js'),'utf8');check('ヘルプにAUTO BGM選択を掲載',help.includes('AUTO中はバトル画面の🎵ボタン'));check('更新履歴にAUTO BGM選択を掲載',log.includes('AUTO中にBGMを選べるようにしました'));if(failed)process.exit(1);console.log('OK: AUTO BGM選択の検証に成功しました');\n`);
console.log('AUTO BGM picker patch applied');

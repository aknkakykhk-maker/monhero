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
`  const selectAutoRuntimeBgm = (trackId) => {
    if (trackId !== '__none__' && !BGM_TRACK_BY_ID[trackId]) return;
    setAutoBgmOverride(trackId);
  };`,
`  const selectAutoRuntimeBgm = (trackId) => {
    if (trackId !== '__none__' && !BGM_TRACK_BY_ID[trackId]) return;
    setAutoBgmOverride(trackId);
    // 超省エネは開始時ミュートのまま。ただしユーザーがここで曲を選んだ場合だけBGMを許可する。
    // toggleQuickMute(true) は自動変更扱いなので、超省エネ終了時に開始前のミュート状態へ戻せる。
    if (!ultraEcoSession) return;
    if (trackId === '__none__') {
      if (!quickMuted) toggleQuickMute(true);
      return;
    }
    if (!audioUnlocked) setAudioUnlocked(true);
    if (quickMuted) toggleQuickMute(true);
    Audio_.unlock(true);
  };`,
'AUTO ultra BGM selector');
game=once(game,
`      ultraAudioSessionRef.current={mutedBefore:audioMuted,automaticallyMuted:!audioMuted,manuallyChanged:false};`,
`      ultraAudioSessionRef.current={mutedBefore:audioMuted,quickMutedBefore:quickMuted,automaticallyMuted:!audioMuted,manuallyChanged:false};`,
'ultra audio session snapshot');
game=once(game,
`    if (!session.mutedBefore&&session.automaticallyMuted&&!session.manuallyChanged&&audioMuted) toggleQuickMute(true);`,
`    // BGMピッカーの一時的なON/OFFは手動設定変更として扱わず、開始前のミュート状態へ正確に戻す。
    if (!session.manuallyChanged&&quickMuted!==session.quickMutedBefore) toggleQuickMute(true);`,
'ultra audio restore');
game=once(game,
`  useEffect(() => { Audio_.setSeVolume(seVolume); }, [seVolume]);`,
`  // 超省エネではBGMを選んで鳴らしてもSEだけは常に0。保存済みSE音量そのものは変更しない。
  useEffect(() => { Audio_.setSeVolume(ultraEcoSession ? 0 : seVolume); }, [seVolume, ultraEcoSession]);`,
'ultra SE mute');
game=once(game,
`<div className="text-[10px] text-slate-400">このAUTOセッションだけ変更</div>`,
`<div className="text-[10px] text-slate-400">{ultraEcoSession?'超省エネ中：SEはOFF':'このAUTOセッションだけ変更'}</div>`,
'ultra picker subtitle');
write(gamePath,game);

const helpPath='monster-hero/data/help.js';
let help=read(helpPath);
const oldHelp="          { t:'note', title:'AUTO中のBGM', text:'AUTOをオンにすると、BGMアレンジの「AUTOモード BGM」で選んだ曲をバトル中に使います。初期設定は「Monster Hero」です。AUTO中はバトル画面の🎵ボタンから、そのAUTOセッションだけ別の登録曲へ変更でき、「BGMなし」も選べます。この一時選択はAUTOを完全に終了すると解除され、BGMアレンジの保存内容は変わりません。敵撃破ファンファーレとWAVE後の強化フェーズ用BGMは初期設定ではOFFなので、WAVE間でもAUTOモードBGMが途切れず続きます。AUTO∞では最終リザルトのゲームクリアBGMも初期設定はOFFで、直前のBGMをそのまま継続します。タイトル画面のBGMアレンジ「その他」から各項目をONに戻せます。パンドラ勇者の最終ボス専用BGMはAUTOより優先します。' },";
const newHelp="          { t:'note', title:'AUTO中のBGM', text:'AUTOをオンにすると、BGMアレンジの「AUTOモード BGM」で選んだ曲をバトル中に使います。初期設定は「Monster Hero」です。AUTO中はバトル画面の🎵ボタンから、そのAUTOセッションだけ別の登録曲へ変更でき、「BGMなし」も選べます。この一時選択はAUTOを完全に終了すると解除され、BGMアレンジの保存内容は変わりません。敵撃破ファンファーレとWAVE後の強化フェーズ用BGMは初期設定ではOFFなので、WAVE間でもAUTOモードBGMが途切れず続きます。AUTO∞では最終リザルトのゲームクリアBGMも初期設定はOFFで、直前のBGMをそのまま継続します。超省エネは開始時は従来どおり無音ですが、🎵ボタンでBGMを選ぶとBGMだけ再生できます。超省エネ中は曲を選んでもSEは常に鳴らず、「BGMなし」を選ぶと再び完全無音になります。超省エネを終了すると、開始前のミュート状態と保存済み音量へ戻ります。タイトル画面のBGMアレンジ「その他」から各項目をONに戻せます。パンドラ勇者の最終ボス専用BGMはAUTOより優先します。' },";
help=once(help,oldHelp,newHelp,'ultra BGM help');
write(helpPath,help);

const changelogPath='monster-hero/data/changelog.js';
let changelog=read(changelogPath);
const entry=`  {\n    date: "2026-08-30 09:25", type: 'update', title: '超省エネ中もBGMだけ選べるようにしました', status: 'new',\n    items: [\n      'AUTO∞の「超省エネ」はこれまでどおり開始時は無音ですが、バトル画面の🎵ボタンから好きなBGMを選ぶとBGMだけ再生できるようにしました。',\n      '超省エネ中はBGMを鳴らしてもSEは常にOFFです。「BGMなし」を選べば再び完全無音になります。',\n      'BGM選択はAUTOセッション限定で、超省エネを終了したときは開始前のミュート状態と保存済み音量へ戻ります。',\n    ],\n  },\n`;
changelog=once(changelog,'const CHANGELOG = [\n','const CHANGELOG = [\n'+entry,'changelog entry');
write(changelogPath,changelog);

write('tools/audio/auto-ultra-bgm-check.js',`const fs=require('fs');\nconst path=require('path');\nconst ROOT=path.resolve(__dirname,'../..');\nconst files=['monster-hero/src/game-system.jsx','monster-hero/game-system.compiled.js'];\nlet failed=0;const check=(name,ok)=>{console.log((ok?'OK':'NG')+': '+name);if(!ok)failed++;};\nfor(const file of files){const s=fs.readFileSync(path.join(ROOT,file),'utf8');check(file+': 超省エネのBGM選択で音声を一時許可',s.includes('if (!ultraEcoSession) return;')&&s.includes("if (trackId === '__none__')")&&s.includes('if (quickMuted) toggleQuickMute(true);')&&s.includes('Audio_.unlock(true);'));check(file+': 超省エネ中はSEを常時0',/Audio_\\.setSeVolume\\(ultraEcoSession\\s*\\?\\s*0\\s*:\\s*seVolume\\)/.test(s));check(file+': SE音量effectは超省エネ切替にも追従',/\\[seVolume,\\s*ultraEcoSession\\]/.test(s));check(file+': 超省エネ開始前のミュート状態を保持',s.includes('quickMutedBefore:quickMuted'));check(file+': BGMピッカー操作後も開始前ミュートへ復元',s.includes('!session.manuallyChanged&&quickMuted!==session.quickMutedBefore'));check(file+': BGMなしは引き続き利用可能',s.includes("'__none__'")&&s.includes('BGMなし'));}\nconst help=fs.readFileSync(path.join(ROOT,'monster-hero/data/help.js'),'utf8');const log=fs.readFileSync(path.join(ROOT,'monster-hero/data/changelog.js'),'utf8');check('ヘルプに超省エネBGM/SE仕様を掲載',help.includes('超省エネ中は曲を選んでもSEは常に鳴らず'));check('更新履歴に超省エネBGM選択を掲載',log.includes('超省エネ中もBGMだけ選べるようにしました'));if(failed)process.exit(1);console.log('OK: 超省エネBGM選択の検証に成功しました');\n`);
console.log('AUTO ultra BGM patch applied');

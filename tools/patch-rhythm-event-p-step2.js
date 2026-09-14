// STEP2 をモバイル作業でも安全に当てる一時パッチ。
// 正規ビルドが終わったらこのファイルと build.js の呼び出しは削除する。
const fs=require('fs');
const path=require('path');
const ROOT=path.resolve(__dirname,'..');

const replaceOnce=(text,before,after,file)=>{
  if(text.includes(after))return text;
  const first=text.indexOf(before);
  const last=text.lastIndexOf(before);
  if(first<0||first!==last)throw new Error(`${file}: 置換元が一意に見つかりません`);
  return text.slice(0,first)+after+text.slice(first+before.length);
};
const patch=(file,replacements)=>{
  const abs=path.join(ROOT,file);
  let text=fs.readFileSync(abs,'utf8');
  const original=text;
  for(const [before,after] of replacements)text=replaceOnce(text,before,after,file);
  if(text!==original){fs.writeFileSync(abs,text);console.log(`event P STEP2: ${file} を更新`);}
};

patch('monster-hero/data/rhythm-event.js',[[
`]);\n\n// ===== 回数ボーナス(2026-09-11・ユーザー指示) =====`,
`]);\n\n// ===== イベントP（docs/spec/RHYTHM_EVENT_POINTS.md） =====\n// 初期実装の正式式。ランキング用スコアや回数ボーナスとは完全に分離する。\nconst RHYTHM_EVENT_POINT_TARGET_MULTIPLIER = 1.5;\nconst rhythmEventPointBaseForScore = (score) => {\n  const n = Number(score);\n  const safe = Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0;\n  return Math.floor(safe / 10000 + Math.max(0, safe - 950000) / 500);\n};\nconst rhythmEventPointAwardAt = (nowMs, songId, score) => {\n  const published = (typeof RHYTHM_DEMO_SONG_IDS !== 'undefined' && Array.isArray(RHYTHM_DEMO_SONG_IDS)) ? RHYTHM_DEMO_SONG_IDS : [];\n  const id = typeof songId === 'string' ? songId : '';\n  if (!id || !published.includes(id)) return null;\n  const event = rhythmLimitedEventAt(nowMs);\n  if (!event) return null;\n  const base = rhythmEventPointBaseForScore(score);\n  const target = Array.isArray(event.songIds) && event.songIds.includes(id);\n  const multiplier = target ? RHYTHM_EVENT_POINT_TARGET_MULTIPLIER : 1;\n  return Object.freeze({ eventId:event.id, base, target, multiplier, amount:Math.floor(base * multiplier) });\n};\n\n// ===== 回数ボーナス(2026-09-11・ユーザー指示) =====`
]]);

patch('monster-hero/src/parts/17-release-changelog-login-missions.jsx',[[
`const RHYTHM_WEEKLY_RANKING_PUBLIC_RELEASE = true;\nconst RELEASE_FLAGS = { speciesChallenge: SPECIES_CHALLENGE_PUBLIC_RELEASE, rhythmMode:RHYTHM_MODE_PUBLIC_RELEASE, quickRhythmLink:QUICK_RHYTHM_LINK_PUBLIC_RELEASE, rhythmCanvasNotes:RHYTHM_CANVAS_NOTES_PUBLIC_RELEASE, rhythmTotalRanking:RHYTHM_TOTAL_RANKING_PUBLIC_RELEASE, rhythmWeeklyRanking:RHYTHM_WEEKLY_RANKING_PUBLIC_RELEASE };`,
`const RHYTHM_WEEKLY_RANKING_PUBLIC_RELEASE = true;\n// イベントPは獲得・保存→交換所→表示を段階実装する。全部そろうまでプレイヤーへ公開しない。\n// true にすると獲得処理と、同じ releaseFlag を持つヘルプ・更新履歴・助手告知が同時に有効になる。\nconst RHYTHM_EVENT_POINTS_PUBLIC_RELEASE = false;\nconst RELEASE_FLAGS = { speciesChallenge: SPECIES_CHALLENGE_PUBLIC_RELEASE, rhythmMode:RHYTHM_MODE_PUBLIC_RELEASE, quickRhythmLink:QUICK_RHYTHM_LINK_PUBLIC_RELEASE, rhythmCanvasNotes:RHYTHM_CANVAS_NOTES_PUBLIC_RELEASE, rhythmTotalRanking:RHYTHM_TOTAL_RANKING_PUBLIC_RELEASE, rhythmWeeklyRanking:RHYTHM_WEEKLY_RANKING_PUBLIC_RELEASE, rhythmEventPoints:RHYTHM_EVENT_POINTS_PUBLIC_RELEASE };`
]]);

patch('monster-hero/src/parts/25-storage.jsx',[[
`const storeList = async (prefix, shared=false) => {`,
`// イベントPは通常イベント共通の恒久残高。イベント終了では消さない。\nconst RHYTHM_EVENT_POINTS_KEY='mh_rhythm_event_points_v1';\nconst normalizeRhythmEventPoints=value=>{\n  const n=Number(value);\n  return Number.isFinite(n)?Math.min(Number.MAX_SAFE_INTEGER,Math.max(0,Math.floor(n))):0;\n};\nconst loadRhythmEventPoints=async()=>normalizeRhythmEventPoints(await storeGet(RHYTHM_EVENT_POINTS_KEY,0,false));\nconst addRhythmEventPoints=async amount=>{\n  const requested=normalizeRhythmEventPoints(amount);\n  const before=await loadRhythmEventPoints();\n  if(requested<=0)return {before,after:before,added:0};\n  const after=Math.min(Number.MAX_SAFE_INTEGER,before+requested);\n  const added=after-before;\n  if(added>0)await storeSet(RHYTHM_EVENT_POINTS_KEY,after,false);\n  return {before,after,added};\n};\n\nconst storeList = async (prefix, shared=false) => {`
]]);

patch('monster-hero/src/parts/30-rhythm-play.jsx',[
[
`    const failed=!tutorial&&!calibrating&&run.lifeDepleted===true;\n    // タイミング合わせのときは、貯めたずれから「判定タイミング調整」に入れる値を出す。`,
`    const failed=!tutorial&&!calibrating&&run.lifeDepleted===true;\n    // イベントPは正常に最後まで到達した公開プレイだけ。公開フラグがfalseのSTEP2中は一切付与しない。\n    // finishは先頭で run.finished=true にするため、再描画・画面遷移で同じ結果を二重付与しない。\n    const eventPointAward=(!debugPlay&&!tutorial&&!calibrating\n      &&typeof RELEASE_FLAGS!=='undefined'&&RELEASE_FLAGS?.rhythmEventPoints===true\n      &&typeof rhythmEventPointAwardAt==='function')\n      ?rhythmEventPointAwardAt(Date.now(),song.songId,score):null;\n    // タイミング合わせのときは、貯めたずれから「判定タイミング調整」に入れる値を出す。`
],
[
`    setView(v=>({...v,status:showCelebrate?'celebrate':'result',score,combo:run.combo,maxCombo:run.maxCombo,counts:{...run.counts},fast:run.fast,slow:run.slow,result:{...result,isNewRecord,bestScore:merged.bestScore}}));\n    onComplete(result,merged);`,
`    setView(v=>({...v,status:showCelebrate?'celebrate':'result',score,combo:run.combo,maxCombo:run.maxCombo,counts:{...run.counts},fast:run.fast,slow:run.slow,result:{...result,isNewRecord,bestScore:merged.bestScore,eventPointAward}}));\n    if(eventPointAward&&eventPointAward.amount>0&&typeof addRhythmEventPoints==='function')void addRhythmEventPoints(eventPointAward.amount);\n    onComplete(result,merged);`
],
[
`  },[chart.totalNotes,difficulty.maxScore,onComplete,settings.effectAmount,settings.lightweightMode,stopFrame,tutorial,calibrating]);`,
`  },[chart.totalNotes,difficulty.maxScore,onComplete,settings.effectAmount,settings.lightweightMode,stopFrame,tutorial,calibrating,debugPlay,song.songId]);`
]
]);

patch('docs/spec/SAVE_DATA.md',[[
`| \`mh_rhythm_event_reward_v1\` | string[] / \`[]\` | イベント報酬を受け取り済みのイベントID。二重受取を防ぐためのフラグ(入賞しなかった場合もここへ入れて、問い合わせ直さないようにする。\`docs/spec/RHYTHM_RANKING.md\` §9.1) |`,
`| \`mh_rhythm_event_points_v1\` | number / \`0\` | モンヒロビートの共通イベントP残高。0以上の整数へ正規化し、イベント終了時もリセットせず次回へ持ち越す。\`docs/spec/RHYTHM_EVENT_POINTS.md\` |\n| \`mh_rhythm_event_reward_v1\` | string[] / \`[]\` | イベント報酬を受け取り済みのイベントID。二重受取を防ぐためのフラグ(入賞しなかった場合もここへ入れて、問い合わせ直さないようにする。\`docs/spec/RHYTHM_RANKING.md\` §9.1) |`
]]);

patch('docs/spec/RHYTHM_EVENT_POINTS.md',[[
`具体的な保存キー名は実装時に既存保存設計と照合して確定する。`,
`初期実装の保存キーは \`mh_rhythm_event_points_v1\` とする。値は0以上の整数へ正規化し、欠損・不正値は0として扱う。\n段階実装中は公開フラグ \`RHYTHM_EVENT_POINTS_PUBLIC_RELEASE\` をfalseとし、獲得・交換所・表示がすべて揃ってからtrueへ切り替える。`
]]);

patch('monster-hero/data/help.js',[[
`          {t:'note', releaseFlag:'rhythmWeeklyRanking', title:'回数ボーナス（遊んだぶんだけ加点）'`,
`          {t:'note', releaseFlag:'rhythmEventPoints', title:'イベントP', text:'期間限定イベントの開催中は、公開されている通常のモンヒロビート楽曲を最後まで遊ぶとイベントPを獲得できます。対象曲以外でも獲得でき、イベント対象曲は獲得量が1.5倍になります。イベントPはイベント終了時に消えず、次回以降へ持ち越せます。貯めたPはマーケットの「イベントP交換所」で使え、イベントが開催されていない期間も交換できます。'},\n          {t:'note', releaseFlag:'rhythmWeeklyRanking', title:'回数ボーナス（遊んだぶんだけ加点）'`
]]);

patch('monster-hero/data/changelog.js',[[
`const CHANGELOG = [\n`,
`const CHANGELOG = [\n  {\n    date: \"2026-09-14 23:14\", type:'update', title:'モンヒロビート：イベントPの獲得・保存基盤を実装しました', status:'new', dev:true,\n    items:[\n      '期間限定イベント開催中の正常なプレイ結果から、正式な計算式でイベントPを算出できる基盤を追加しました。',\n      'イベントPは専用の新規保存キーへ0以上の整数として保存し、既存データに項目が無い場合は0Pとして扱います。イベント終了時にはリセットしません。',\n      'DEBUG・あそびかた練習・判定タイミング合わせでは付与しません。同じ1プレイのリザルトを再描画しても二重付与しない経路にしています。',\n      '交換所と所持P表示が揃うまでは公開フラグをOFFにしているため、現時点のプレイヤーにはイベントPを付与しません。',\n    ],\n  },\n`
]]);

patch('tools/mode/rhythm-event-window-check.js',[
[
`  +'rhythmEventSongDivisionId,rhythmEventMaxScore,rhythmEventEntryScore,RHYTHM_EVENT_TOTAL_DIVISION,'`,
`  +'rhythmEventSongDivisionId,rhythmEventMaxScore,rhythmEventEntryScore,RHYTHM_EVENT_TOTAL_DIVISION,'\n  +'RHYTHM_EVENT_POINT_TARGET_MULTIPLIER,rhythmEventPointBaseForScore,rhythmEventPointAwardAt,'`
],
[
`// 適用SQLと仕様書\n`,
`// --- イベントP STEP2（獲得式・保存・二重付与防止） ---\ncheck('イベントPの基本式は確定仕様どおり',\n  [[800000,80],[850000,85],[900000,90],[950000,95],[960000,116],[970000,137],[980000,158],[990000,179],[1000000,200]]\n    .every(([score,want])=>O.rhythmEventPointBaseForScore(score)===want));\ncheck('壊れたスコアは0Pへ倒す',\n  O.rhythmEventPointBaseForScore(null)===0&&O.rhythmEventPointBaseForScore('x')===0&&O.rhythmEventPointBaseForScore(-100)===0);\nif(limited.length){\n  const e=limited[0],mid=(Date.parse(e.startAt)+Date.parse(e.endAt))/2;\n  const target=e.songIds[0];\n  const normal=O.RHYTHM_DEMO_SONG_IDS.find(id=>!e.songIds.includes(id));\n  const targetAward=O.rhythmEventPointAwardAt(mid,target,1000000);\n  const normalAward=normal?O.rhythmEventPointAwardAt(mid,normal,1000000):null;\n  check('イベント対象曲だけ1.5倍になる',!!targetAward&&targetAward.amount===300&&targetAward.multiplier===1.5&&targetAward.target===true\n    &&(!normal||!!normalAward&&normalAward.amount===200&&normalAward.multiplier===1&&normalAward.target===false));\n  check('イベント期間外はイベントPを出さない',O.rhythmEventPointAwardAt(Date.parse(e.endAt),target,1000000)===null);\n  check('DEBUG専用など公開曲でないIDはイベントP対象外',O.rhythmEventPointAwardAt(mid,'atsu_cup_theme_debug_short',1000000)===null);\n}\ncheck('イベントPは新しい後方互換キーへ保存する',\n  game.includes(\"const RHYTHM_EVENT_POINTS_KEY='mh_rhythm_event_points_v1';\")\n  &&game.includes('const normalizeRhythmEventPoints=value=>')\n  &&game.includes('await storeGet(RHYTHM_EVENT_POINTS_KEY,0,false)')\n  &&saveSpec.includes('mh_rhythm_event_points_v1'));\ncheck('イベント終了でイベントPを0へ戻す処理を持たない',!game.includes('storeSet(RHYTHM_EVENT_POINTS_KEY,0'));\ncheck('正常リザルトのfinishでだけイベントP付与を判定する',\n  game.includes('const eventPointAward=(!debugPlay&&!tutorial&&!calibrating')\n  &&game.includes('rhythmEventPointAwardAt(Date.now(),song.songId,score)')\n  &&game.includes('void addRhythmEventPoints(eventPointAward.amount)'));\ncheck('STEP2中は公開フラグOFFで、未完成のまま付与しない',\n  /const RHYTHM_EVENT_POINTS_PUBLIC_RELEASE = false;/.test(flags)\n  &&flags.includes('rhythmEventPoints:RHYTHM_EVENT_POINTS_PUBLIC_RELEASE')\n  &&game.includes('RELEASE_FLAGS?.rhythmEventPoints===true'));\ncheck('finishは二重付与防止のfinished印を先に立てる',(()=>{\n  const from=game.indexOf('const finish=useCallback');\n  const done=game.indexOf('run.finished=true;',from);\n  const award=game.indexOf('addRhythmEventPoints(eventPointAward.amount)',from);\n  return from>=0&&done>from&&award>done;\n})());\ncheck('イベントPのヘルプは公開フラグと一緒に隠す',help.includes(\"releaseFlag:'rhythmEventPoints'\")&&help.includes(\"title:'イベントP'\"));\ncheck('STEP2の更新履歴は開発メモとして残し、未完成機能を告知しない',(()=>{\n  const at=changelog.indexOf('イベントPの獲得・保存基盤を実装しました');\n  if(at<0)return false;\n  const entry=changelog.slice(at,changelog.indexOf('  },',at));\n  return entry.includes('dev:true');\n})());\n\n// 適用SQLと仕様書\n`
]
]);

console.log('event P STEP2 パッチ完了');

#!/usr/bin/env node
// 音ゲー体験版の正式導線（体験版ホーム）を見る。
//
// デバッグ画面をそのまま公開しないために作った最小構成の画面で、
// ロードマップ「6. 体験版用の正式導線」に挙がっている項目がそろっているかを確かめる。
const fs=require('fs');
const path=require('path');
const vm=require('vm');

const ROOT=path.resolve(__dirname,'..','..');
const read=p=>fs.readFileSync(path.join(ROOT,p),'utf8');
let failed=0;
const ok=(name,cond,detail='')=>{console.log(`${cond?'OK':'NG'}: ${name}${detail?` — ${detail}`:''}`);if(!cond)failed++;};

const game=read('monster-hero/src/game-system.jsx');
const rhythm=read('monster-hero/data/rhythm-mode.js');

// --- 体験版で遊べる範囲がデータ側で決まっている ---
const ctx={Object,Number,Math};
vm.createContext(ctx);
vm.runInContext(`${rhythm}\nthis.__o={RHYTHM_SONGS,RHYTHM_DIFFICULTIES,RHYTHM_DEMO_SONG_ID,RHYTHM_DEMO_SONG_IDS,RHYTHM_DEMO_DIFFICULTY_IDS,RHYTHM_DEMO_DIFFICULTY_LABELS,rhythmDemoSong,rhythmDemoDifficulties,rhythmDifficultyUnlocked,rhythmDifficultyUnlockRequirement};`,ctx);
const o=ctx.__o;
const song=o.rhythmDemoSong(o.RHYTHM_SONGS);
const difficulties=o.rhythmDemoDifficulties(song,o.RHYTHM_DIFFICULTIES);

ok('体験版で遊べる範囲をデータ側で決めている',
  typeof o.RHYTHM_DEMO_SONG_ID==='string'&&Array.isArray(o.RHYTHM_DEMO_DIFFICULTY_IDS));
// 2026-09-05、ユーザー指示で先行公開の5曲・5難易度になった(それまでは Monster Hero 1曲・3難易度)。
// 同日に「風がそよぐ場所」を足して6曲になった。
// 見張りたいのは「どこまでを体験版へ出すかをデータ側で決めている」ことなので、
// 曲名を固定で書かない(書くと曲を足すたびにここが落ちるだけで、何も守れない)。
// そのかわり「並んでいる曲が全部実在して、譜面も入っている」ところまで見る。
const DEMO_SONG_IDS=o.RHYTHM_DEMO_SONG_IDS;
ok('体験版の曲がデータ側のリストで決まっている',
  Array.isArray(DEMO_SONG_IDS)&&DEMO_SONG_IDS.length>0,DEMO_SONG_IDS.join(' / '));
ok('体験版の曲がすべて実在する',
  DEMO_SONG_IDS.every(id=>o.RHYTHM_SONGS.some(s=>s.songId===id)),
  DEMO_SONG_IDS.filter(id=>!o.RHYTHM_SONGS.some(s=>s.songId===id)).join(' / ')||'すべてある');
// 先頭は全国ランキングの既定(RHYTHM_DEMO_SONG_ID=RHYTHM_DEMO_SONG_IDS[0])。
// 曲を足すときにうっかり先頭へ入れると、既存プレイヤーが最初に見るランキングが黙って変わる。
// 「先頭と既定が同じ」は定義からいつでも真なので見ても意味がない。曲名のほうを固定で書く
// (ここを変えるのは、ユーザーが既定の曲を変えると決めたときだけ)。
ok('全国ランキングの既定が mf_ichika_mix のまま(曲を足すときは末尾へ)',
  o.RHYTHM_DEMO_SONG_ID==='mf_ichika_mix',o.RHYTHM_DEMO_SONG_ID);
ok('体験版の難易度はEASY〜MASTERの5つ',
  o.RHYTHM_DEMO_DIFFICULTY_IDS.join()==='EASY,NORMAL,HARD,EXPERT,MASTER');
ok('譜面が入っている難易度だけを選べる（押せるのに始まらない状態を作らない）',
  difficulties.length===5&&difficulties.every(d=>song.difficulties[d.id].notes.length>0),
  difficulties.map(d=>`${d.id}(${song.difficulties[d.id].totalNotes})`).join(' / '));
// 並んでいる曲がどれも5難易度そろっていること。1曲だけ譜面が欠けている状態を見逃さない
ok('曲えらびの曲はどれも5難易度そろっている',
  DEMO_SONG_IDS.every(id=>{
    const s=o.RHYTHM_SONGS.find(entry=>entry.songId===id);
    return !!s&&o.RHYTHM_DEMO_DIFFICULTY_IDS.every(d=>s.difficulties[d]&&s.difficulties[d].notes.length>0);
  }),
  DEMO_SONG_IDS.map(id=>{
    const s=o.RHYTHM_SONGS.find(entry=>entry.songId===id);
    return `${id}(${s?o.RHYTHM_DEMO_DIFFICULTY_IDS.filter(d=>s.difficulties[d]&&s.difficulties[d].notes.length>0).length:0})`;
  }).join(' / '));
// EXPERT以上は前の難易度をクリアするまで選べない(2026-09-05・ユーザー指示)
ok('EXPERT以上は前の難易度をクリアで解放される',
  o.rhythmDifficultyUnlocked('monster_hero','EASY',{})===true
  &&o.rhythmDifficultyUnlocked('monster_hero','HARD',{})===true
  &&o.rhythmDifficultyUnlocked('monster_hero','EXPERT',{})===false
  &&o.rhythmDifficultyUnlocked('monster_hero','EXPERT',{monster_hero:{HARD:{clear:true}}})===true
  &&o.rhythmDifficultyUnlocked('monster_hero','MASTER',{monster_hero:{HARD:{clear:true}}})===false
  &&o.rhythmDifficultyUnlocked('monster_hero','MASTER',{monster_hero:{EXPERT:{clear:true}}})===true);
ok('解放は曲ごと（別の曲のクリアでは開かない）',
  o.rhythmDifficultyUnlocked('monster_hero','EXPERT',{stay_with_me:{HARD:{clear:true}}})===false);
ok('記録が壊れていても勝手に開かない',
  o.rhythmDifficultyUnlocked('monster_hero','EXPERT',null)===false
  &&o.rhythmDifficultyUnlocked('monster_hero','EXPERT',{monster_hero:{HARD:{clear:'yes'}}})===false);
ok('難易度ごとの説明を持っている',
  o.RHYTHM_DEMO_DIFFICULTY_IDS.every(id=>{
    const label=o.RHYTHM_DEMO_DIFFICULTY_LABELS[id];
    return label&&typeof label.name==='string'&&typeof label.note==='string'&&label.note.length>=10;
  }));
ok('デバッグ用の曲は体験版へ出さない',
  !o.RHYTHM_SONGS.filter(s=>s.songId!==o.RHYTHM_DEMO_SONG_ID).some(s=>s.songId===o.RHYTHM_DEMO_SONG_ID));

const assistants=read('monster-hero/data/assistants.js');

// --- 画面がそろっている ---
ok('体験版ホームの画面がある',game.includes("gameState==='RHYTHM_DEMO_HOME'")&&game.includes('data-rhythm-demo-home'));
// 2026-09-05、ユーザー指示で「これは体験版です…」の長い断り書きを曲えらびから外した
// (曲を選ぶ画面で読み物が場所を取りすぎるため)。断る場所がチュートリアルへ移っただけで、
// 「体験版であることと、譜面が調整中であることを伝える」という中身は変えていない。
ok('「体験版」であることを画面に出している',
  game.includes('data-rhythm-demo-badge')&&/体験版/.test(game));
ok('体験版であることと譜面が調整中であることをチュートリアルで断っている',(()=>{
  const start=assistants.indexOf('const ASSISTANT_RHYTHM_TUTORIAL =');
  if(start<0)return false;
  const block=assistants.slice(start,assistants.indexOf('assistantRhythmTutorialPages'));
  return /体験版/.test(block)&&/譜面は調整中/.test(block);
})());
// プレオープンで遊べるようになったので、ヘルプの「いまの状態」も
// 「まだ制作中でデバッグ画面からのみ」から「遊べる／調整は続く」へ書き換えた(2026-09-05)。
// 断っている中身(譜面はこれから変わることがある)は変えていない
ok('ヘルプでも譜面の調整が続くことを断っている',/調整が入ることがあります/.test(read('monster-hero/data/help.js')));
ok('曲えらびの上に固定で出すのは助手のひとことだけ(読み物で場所を取らない)',
  /notice=\{<AssistantBubble scene="rhythmHome" compact\/>\}/.test(game)
  &&!game.includes('data-rhythm-demo-notice'));
// 曲そのものの表示は、一覧の行と選んでいる曲の見出しで見る
ok('曲の表示がある',game.includes('data-rhythm-song-row=')&&game.includes('data-rhythm-song-title'));
// 曲えらびは「一覧から曲 → 難易度 → 決定」の3手。2026-09-05に曲選択画面を
// よくある音ゲーの形へ作り直したとき、目印を data-rhythm-song-row / data-rhythm-difficulty /
// data-rhythm-demo-start へ整理した(見ているものは同じ)。
ok('曲を一覧からえらべる',game.includes('data-rhythm-song-row=')&&game.includes('data-rhythm-song-select'));
ok('難易度を選べる',game.includes('data-rhythm-difficulty=')&&game.includes('data-rhythm-demo-start='));
ok('選んでいる曲の絵と大きさが出る',game.includes('const RhythmSongArt=')&&game.includes('data-rhythm-song-art'));
ok('曲えらびは1つの部品にまとまっている（画面ごとに書き分けない）',
  game.includes('const RhythmSongSelect=')&&game.includes('<RhythmSongSelect'));
// 2026-09-05・ユーザー指示で足した4つ。
// 鳴らす場所は曲えらびの中からApp本体へ移した(2026-09-05・ユーザー指示
// 「選んでいた音楽が鳴り続けるようにして」)。ランキングやマスモン設定を開いても止まらない。
// 顔ぶれと鳴らし直さないことは tools/mode/rhythm-preview-continue-check.js が見ている
ok('選んでいる曲を鳴らす（設定でON/OFFできる）',
  game.includes('RHYTHM_PREVIEW_DELAY_MS')&&game.includes('Audio_.startRhythmTrack(rhythmPreviewTrackId')
  &&game.includes('songPreviewEnabled:true')&&game.includes("songPreviewEnabled:bool('songPreviewEnabled')")
  &&game.includes("toggle('songPreviewEnabled','')"));
ok('モンビーを離れる・曲を選び替えると止まる',
  /return\s*\(\)=>\{cancelled=true;clearTimeout\(timer\);if\(handle\)handle\.stop\(\);\}/.test(game));
ok('自己ベストは難易度ごとに出る（全国ランキングの合算とは別）',
  game.includes('data-rhythm-difficulty-best=')
  &&game.includes("rhythmBestRecord(bestRecords,song.songId,item.id)"));
ok('振動は端末が対応していないことを画面に出す',
  game.includes('const RHYTHM_HAPTICS=')&&game.includes('data-rhythm-vibration-unsupported')
  &&game.includes('data-rhythm-vibration-test')&&game.includes("'switch' in input"));
ok('マスモンは出番のあとも動き続ける（歓声の指定を外して別の待機へ戻す）',
  game.includes('RHYTHM_SIDE_CHEER_MS')&&game.includes("el.dataset.rhythmSidePhase='done'")
  &&read('monster-hero/data/rhythm-mode.js').includes('data-rhythm-side-phase="done"')
  &&read('monster-hero/data/rhythm-mode.js').includes('mhRhythmSideSway'));
ok('自己ベストを出している',game.includes('data-rhythm-demo-best')&&game.includes('rhythmBestRecord(rhythmBestRecords'));
ok('自己ベストにランクも出している',game.includes('rhythmRankForScore(best.bestScore)'));
ok('未プレイのときは「まだ遊んでいません」と出す',/まだ遊んでいません/.test(game));
ok('音ゲー設定へ入れる',game.includes('data-rhythm-demo-options'));
ok('マスモン設定へ入れる',game.includes('data-rhythm-demo-monsters')&&game.includes("gameState==='RHYTHM_DEMO_MONSTERS'"));

// --- 導線 ---
// 戻り先は「デバッグ画面から始めたときだけデバッグ画面」。
// あそびかた練習(from:'tutorial')が増えたので、demo かどうかで分けると練習の戻り先を間違える
// (2026-09-05・演奏画面での操作チュートリアルを足した)
ok('体験版から始めたプレイは体験版ホームへ戻る',
  game.includes("setRhythmPlay({song,difficulty,from:'demo'})")
  &&game.includes("const back=rhythmPlay.from==='debug'?'RHYTHM_DEBUG':'RHYTHM_DEMO_HOME'"));
ok('あそびかた練習も曲えらびへ戻る',
  game.includes("from:'tutorial' }")&&!game.includes("from:'tutorial'?'RHYTHM_DEBUG'"));
ok('設定を閉じたとき、開いた画面へ戻る',
  game.includes('const [rhythmOptionsBack,setRhythmOptionsBack]')
  &&game.includes('onBack={()=>setGameState(rhythmOptionsBack)}')
  &&game.includes("setRhythmOptionsBack('RHYTHM_DEMO_HOME')")
  &&game.includes("setRhythmOptionsBack('RHYTHM_DEBUG')"));
ok('マスモン設定を閉じたとき体験版ホームへ戻る',
  game.includes("setRhythmMonsterPickerOpen(false);setGameState('RHYTHM_DEMO_HOME');"));
ok('公開前はデバッグ画面から、公開後はHOMEへ戻る',
  game.includes("setGameState(RHYTHM_MODE_PUBLIC_RELEASE?'HOME':'DEBUG_SETTINGS')"));

// --- マスモン設定は1つの部品を共有する ---
ok('マスモン設定はデバッグ画面と体験版で同じ部品を使う',
  game.includes('const RhythmMonsterSlotsPanel=')
  &&(game.match(/<RhythmMonsterSlotsPanel /g)||[]).length===2);

// --- 既存を壊していない ---
ok('保存キーを増やしていない（設定・BEST・マスモンは既存のまま）',
  game.includes("const RHYTHM_SETTINGS_KEY")&&game.includes("const RHYTHM_BEST_RECORDS_KEY = 'mh_rhythm_best_v1'")
  &&!/mh_rhythm_demo/.test(game));
// 2026-09-05にプレオープンした。デバッグ画面からの入口はそのまま残してある
// (公開フラグを切り替えずに中身を確かめられるようにするため)
ok('体験版の入口はデバッグ画面からも開ける',
  game.includes('data-debug-rhythm-demo')&&game.includes('onClick={openRhythmDemo}'));
ok('プレオープンで公開されている（うっかり非公開へ戻っていない）',
  game.includes('const RHYTHM_MODE_PUBLIC_RELEASE = true'));
// --- HOMEの入口（修行の場所を譲り受けた） ---
// 略称は「モンビー」だが、画面・ヘルプ・説明には正式名称の「モンヒロビート」を使う
// (2026-09-04にユーザーが「モンスタービート」から改称)。
ok('HOMEの施設は「モンヒロビート」になっている',
  game.includes('mh-home-facility rhythm')&&game.includes('🎵 モンヒロビート'));
// デバッグ画面の「修行テスト」は開発用に残す。ここで見るのはHOMEの施設だけ。
ok('修行の施設はHOMEから外した',
  !game.includes('mh-home-facility training')&&!game.includes('aria-label="修行（準備中）"'));
ok('修行のCSSを残さず、位置をそのままモンヒロビートへ引き継いでいる',
  !game.includes('.mh-home-facility.training')
  &&game.includes('.mh-home-facility.rhythm{left:0;top:46%;width:38%;height:25%}'));
ok('公開フラグが立つまではHOMEから遊べず「準備中」の案内を出す',
  game.includes("RHYTHM_MODE_PUBLIC_RELEASE?openRhythmDemo:()=>setGameState('RHYTHM_INFO')")
  &&game.includes("gameState==='RHYTHM_INFO'")
  &&game.includes('data-rhythm-info')
  &&game.includes('モンヒロビートは準備中です'));
ok('準備中の案内は修行のCSSを借りず、自前の見た目にしてある',(()=>{
  // 次の画面まで見てしまうと隣のCSSを拾うので、この画面のぶんだけを切り出す。
  const at=game.indexOf("gameState==='RHYTHM_INFO'");
  const next=game.indexOf("{gameState===",at+10);
  const block=game.slice(at,next>at?next:at+3000);
  return !block.includes('mh-training-')&&block.includes('overflow-y-auto');
})());
ok('準備中の案内にもヘルプの説明がある',
  read('monster-hero/data/help.js').includes("RHYTHM_INFO:      'basics/rhythm-coming-soon'")
  &&read('monster-hero/data/help.js').includes("id:'rhythm-coming-soon'"));
ok('準備中のヘルプ項目は公開フラグで伏せない（いま見えないと案内できないため）',(()=>{
  const help=read('monster-hero/data/help.js');
  const at=help.indexOf("id:'rhythm-coming-soon'");
  return at>=0&&!help.slice(at,at+200).includes('releaseFlag');
})());
ok('体験版ホームに譜面制作UIを出していない',(()=>{
  const start=game.indexOf("gameState==='RHYTHM_DEMO_HOME'");
  const end=game.indexOf("gameState==='RHYTHM_DEMO_MONSTERS'");
  const block=game.slice(start,end>start?end:start+9000);
  return !block.includes('data-rhythm-debug')&&!block.includes('rhythmChartToolsOpened')&&!block.includes('RHYTHM_SONGS.map');
})());

// --- 押しやすさ ---
ok('体験版の操作ボタンはiPhoneで押せる大きさ（44px以上）',(()=>{
  const start=game.indexOf("gameState==='RHYTHM_DEMO_HOME'");
  const end=game.indexOf("gameState==='RHYTHM_DEMO_MONSTERS'");
  const block=game.slice(start,end>start?end:start+9000);
  // onClick={()=>...} の「=>」で切れないよう、直前が「=」でない「>」までを1つのタグとして見る。
  const buttons=[];
  for(let i=block.indexOf('<button');i>=0;i=block.indexOf('<button',i+1)){
    let end=i;
    while(end<block.length){
      end=block.indexOf('>',end+1);
      if(end<0){end=block.length;break;}
      if(block[end-1]!=='=')break;
    }
    buttons.push(block.slice(i,end+1));
  }
  return buttons.length>0&&buttons.every(b=>/min-h-\[(4[4-9]|[5-9]\d|\d{3})px\]/.test(b));
})());

// --- 助手の説明とチュートリアル(2026-09-05・ユーザー指示) ---
// 「初回のバトルと同じようにチュートリアルを入れて、設定している助手が説明する」ため、
// 台本はデータ側(assistants.js)に置き、吹き出しは既存のものを使い回す。
ok('モンビーのチュートリアルの台本がデータ側にある',
  assistants.includes('const ASSISTANT_RHYTHM_TUTORIAL')&&assistants.includes('assistantRhythmTutorialPages'));
ok('助手ごとに言い回しを変えられる',
  assistants.includes('const ASSISTANT_RHYTHM_TUTORIAL_SETS')&&/kiki:\s*\[/.test(assistants.slice(assistants.indexOf('ASSISTANT_RHYTHM_TUTORIAL_SETS'))));
ok('チュートリアルは曲えらびの実際の場所を光らせる',(()=>{
  const start=assistants.indexOf('const ASSISTANT_RHYTHM_TUTORIAL =');
  const block=assistants.slice(start,assistants.indexOf('assistantRhythmTutorialPages'));
  return ['songList','songLevel','achievement','difficulty','monsters','options','help']
    .every(spot=>block.includes(`spot:'${spot}'`));
})());
ok('光らせる場所は画面側にも用意されている',
  ['songList','songLevel','achievement','difficulty'].every(spot=>game.includes(`spot('${spot}')`))
  &&['monsters','options','help'].every(spot=>game.includes(`spotClass('${spot}')`)));
ok('チュートリアルは吹き出しを使い回す（専用の画面を作らない）',
  game.includes("const rhythm=tutorialKind==='rhythm';")&&game.includes('const pages=(rhythm'));
ok('初回だけ自動で始まり、専用の保存キーを使う',
  game.includes("const RHYTHM_TUTORIAL_SEEN_KEY = 'mh_rhythm_tutorial_seen_v1';")
  &&game.includes("if (gameState !== 'RHYTHM_DEMO_HOME' || tutorialStep != null || rhythmTutorialCheckedRef.current) return;")
  &&game.includes("if (kind === 'rhythm')"));
ok('既存のチュートリアルの保存キーを流用していない',
  !/RHYTHM_TUTORIAL_SEEN_KEY\s*=\s*'mh_tutorial_seen_v1'/.test(game));
ok('曲えらびから「遊びかた」を開ける',
  game.includes('data-rhythm-demo-help')&&game.includes("gameState==='RHYTHM_DEMO_HELP'"));
ok('遊びかたの本文はヘルプを参照する（同じ説明を二重に書かない）',
  game.includes("cat.id==='basics'")&&game.includes("String(topic.id||'').startsWith('rhythm-')")
  &&game.includes('renderHelpBlocks(topic.blocks'));
ok('遊びかたからチュートリアルをやり直せる',
  game.includes('data-rhythm-demo-help-tutorial')&&game.includes('const startRhythmTutorial'));
ok('遊びかたの画面がヘルプの対応表に載っている',
  read('monster-hero/data/help.js').includes("RHYTHM_DEMO_HELP:     'basics/rhythm-tutorial'"));

// --- 縦画面のときの横画面案内(2026-09-05・ユーザー指示) ---
ok('縦画面のときだけ横画面対応の案内を出す',
  game.includes('const RhythmLandscapeHint=')&&game.includes('data-rhythm-landscape-hint')
  &&game.includes('hidden portrait:block'));
ok('音ゲー中(プレイ画面)には案内を出さない',(()=>{
  // RhythmTapTest(プレイ本体)の中身と、プレイ画面を出している行の両方に案内が無いこと。
  // 部品の並び順に頼らないよう、その部品の終わりは「次の画面(RHYTHM_DEMO_HOME)の手前」で切る。
  const start=game.indexOf('const RhythmTapTest');
  if(start<0)return false;
  const end=game.indexOf("gameState==='RHYTHM_DEMO_HOME'");
  const block=game.slice(start,end>start?end:game.length);
  const playLine=(game.match(/^.*gameState==='RHYTHM_PLAY'.*$/m)||[''])[0];
  return !block.includes('<RhythmLandscapeHint')&&!playLine.includes('RhythmLandscapeHint');
})());

console.log(failed?`\n${failed}件のNGがあります`:'\nすべてOK');
process.exit(failed?1:0);

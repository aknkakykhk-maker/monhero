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
vm.runInContext(`${rhythm}\nthis.__o={RHYTHM_SONGS,RHYTHM_DIFFICULTIES,RHYTHM_DEMO_SONG_ID,RHYTHM_DEMO_DIFFICULTY_IDS,RHYTHM_DEMO_DIFFICULTY_LABELS,rhythmDemoSong,rhythmDemoDifficulties};`,ctx);
const o=ctx.__o;
const song=o.rhythmDemoSong(o.RHYTHM_SONGS);
const difficulties=o.rhythmDemoDifficulties(song,o.RHYTHM_DIFFICULTIES);

ok('体験版で遊べる範囲をデータ側で決めている',
  typeof o.RHYTHM_DEMO_SONG_ID==='string'&&Array.isArray(o.RHYTHM_DEMO_DIFFICULTY_IDS));
ok('体験版の曲はMonster Hero 1曲だけ',!!song&&song.bgmTrackId==='monster_hero_theme',
  song?song.displayName:'見つからない');
ok('体験版の難易度はEASY / NORMAL / HARDの3つ',
  o.RHYTHM_DEMO_DIFFICULTY_IDS.join()==='EASY,NORMAL,HARD');
ok('EXPERT / MASTER は体験版へ出さない',
  !o.RHYTHM_DEMO_DIFFICULTY_IDS.includes('EXPERT')&&!o.RHYTHM_DEMO_DIFFICULTY_IDS.includes('MASTER'));
ok('譜面が入っている難易度だけを選べる（押せるのに始まらない状態を作らない）',
  difficulties.length===3&&difficulties.every(d=>song.difficulties[d.id].notes.length>0),
  difficulties.map(d=>`${d.id}(${song.difficulties[d.id].totalNotes})`).join(' / '));
ok('難易度ごとの説明を持っている',
  o.RHYTHM_DEMO_DIFFICULTY_IDS.every(id=>{
    const label=o.RHYTHM_DEMO_DIFFICULTY_LABELS[id];
    return label&&typeof label.name==='string'&&typeof label.note==='string'&&label.note.length>=10;
  }));
ok('デバッグ用の曲は体験版へ出さない',
  !o.RHYTHM_SONGS.filter(s=>s.songId!==o.RHYTHM_DEMO_SONG_ID).some(s=>s.songId===o.RHYTHM_DEMO_SONG_ID));

// --- 画面がそろっている ---
ok('体験版ホームの画面がある',game.includes("gameState==='RHYTHM_DEMO_HOME'")&&game.includes('data-rhythm-demo-home'));
ok('「体験版」であることを画面に出している',
  game.includes('data-rhythm-demo-badge')&&game.includes('data-rhythm-demo-notice')&&/体験版/.test(game));
ok('譜面が調整中であることを断っている',/譜面は調整中/.test(game));
ok('曲の表示がある',game.includes('data-rhythm-demo-song'));
ok('難易度を選べる',game.includes('data-rhythm-demo-difficulty=')&&game.includes('data-rhythm-demo-start='));
ok('自己ベストを出している',game.includes('data-rhythm-demo-best')&&game.includes('rhythmBestRecord(rhythmBestRecords'));
ok('自己ベストにランクも出している',game.includes('rhythmRankForScore(best.bestScore)'));
ok('未プレイのときは「まだ遊んでいません」と出す',/まだ遊んでいません/.test(game));
ok('音ゲー設定へ入れる',game.includes('data-rhythm-demo-options'));
ok('マスモン設定へ入れる',game.includes('data-rhythm-demo-monsters')&&game.includes("gameState==='RHYTHM_DEMO_MONSTERS'"));

// --- 導線 ---
ok('体験版から始めたプレイは体験版ホームへ戻る',
  game.includes("setRhythmPlay({song,difficulty,from:'demo'})")
  &&game.includes("const back=rhythmPlay.from==='demo'?'RHYTHM_DEMO_HOME':'RHYTHM_DEBUG'"));
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
ok('体験版の入口はデバッグ画面から開く（公開フラグはまだ false のまま）',
  game.includes('data-debug-rhythm-demo')&&game.includes('onClick={openRhythmDemo}')
  &&game.includes('const RHYTHM_MODE_PUBLIC_RELEASE = false'));
// --- HOMEの入口（修行の場所を譲り受けた） ---
// 略称は「モンビー」だが、画面・ヘルプ・説明には正式名称の「モンスタービート」を使う。
ok('HOMEの施設は「モンスタービート」になっている',
  game.includes('mh-home-facility rhythm')&&game.includes('🎵 モンスタービート'));
// デバッグ画面の「修行テスト」は開発用に残す。ここで見るのはHOMEの施設だけ。
ok('修行の施設はHOMEから外した',
  !game.includes('mh-home-facility training')&&!game.includes('aria-label="修行（準備中）"'));
ok('修行のCSSを残さず、位置をそのままモンスタービートへ引き継いでいる',
  !game.includes('.mh-home-facility.training')
  &&game.includes('.mh-home-facility.rhythm{left:0;top:46%;width:38%;height:25%}'));
ok('公開フラグが立つまではHOMEから遊べず「準備中」の案内を出す',
  game.includes("RHYTHM_MODE_PUBLIC_RELEASE?openRhythmDemo:()=>setGameState('RHYTHM_INFO')")
  &&game.includes("gameState==='RHYTHM_INFO'")
  &&game.includes('data-rhythm-info')
  &&game.includes('モンスタービートは準備中です'));
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

console.log(failed?`\n${failed}件のNGがあります`:'\nすべてOK');
process.exit(failed?1:0);

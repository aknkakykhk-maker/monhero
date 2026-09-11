// モンビー(音ゲー)の「ブリーダー別 全曲合算ランキング」(2026-09-11)を見る。
//
// 集計そのものはSupabase側のビューが行うが、そこへ至る前後は端末側にある。
// ここで見るのは次の3つ。
//
//   ① 曲数をどこにも書き写していないこと(docs/spec/RHYTHM_RANKING.md §5.1)
//      曲を足すたびに直す場所があると、いつか必ず古くなる
//   ② ビューがまだ無い環境(SQL未適用)を「エラー」ではなく「準備中」として扱うこと
//      SQLの適用とアプリの公開の順番が前後しても画面が壊れないようにするため
//   ③ 自分の行の見つけ方(identity_key)が、IDのある人と無い人の両方に効くこと
//
//   node tools/mode/rhythm-total-ranking-check.js
const fs=require('fs'),path=require('path'),vm=require('vm');
const ROOT=path.resolve(__dirname,'../..'),read=file=>fs.readFileSync(path.join(ROOT,file),'utf8');
const data=read('monster-hero/data/rhythm-mode.js');
const supa=read('monster-hero/src/parts/26-supabase.jsx');
const app=read('monster-hero/src/parts/60-app.jsx');
const screen=read('monster-hero/src/parts/58-screen-rhythm.jsx');
const game=read('monster-hero/src/game-system.jsx');
const help=read('monster-hero/data/help.js');
const changelog=read('monster-hero/data/changelog.js');
const assistants=read('monster-hero/data/assistants.js');
const spec=read('docs/spec/RHYTHM_RANKING.md');
const flags=read('monster-hero/src/parts/17-release-changelog-login-missions.jsx');

let failed=0;
const check=(name,ok,detail='')=>{console.log(`${ok?'✓':'✗'} ${name}${detail?` — ${detail}`:''}`);if(!ok)failed++;};

// --- データ層(曲数・理論満点・達成率)を動かす ---
const grab=(a,b)=>data.slice(data.indexOf(a),data.indexOf(b));
const difficulties=grab('const RHYTHM_DIFFICULTIES = Object.freeze([','const RHYTHM_JUDGMENTS');
const demoIds=(data.match(/^const RHYTHM_DEMO_SONG_IDS=Object\.freeze\(\[[\s\S]*?\]\);/m)||[''])[0];
// rhythmDemoSongs は複数行。1行だけ取ると「常に全曲を返す別物」になってしまうので、
// 定義の終わり(.filter(Boolean);)まで取る
const demoSongsStart=data.indexOf('const rhythmDemoSongs=');
const demoSongsEnd=demoSongsStart>=0?data.indexOf('.filter(Boolean);',demoSongsStart)+'.filter(Boolean);'.length:-1;
const demoSongs=demoSongsEnd>demoSongsStart?data.slice(demoSongsStart,demoSongsEnd):'';
const totalBlock=grab('const rhythmTotalRankingSongCount=','const installRhythmGestureVisuals');
check('合算の道具(曲数・理論満点・達成率)を抽出できる',!!difficulties&&!!demoIds&&!!demoSongs&&!!totalBlock);
if(!difficulties||!demoIds||!demoSongs||!totalBlock){console.log(`\n${failed}件のNGがあります`);process.exit(1);}

const context={console};
vm.createContext(context);
vm.runInContext(`${difficulties}\n${demoIds}\n${demoSongs}\n${totalBlock}\n`
  +'this.out={RHYTHM_DEMO_SONG_IDS,rhythmTotalRankingSongCount,rhythmTotalRankingMaxScore,rhythmTotalRankingProgress};',context);
const {RHYTHM_DEMO_SONG_IDS,rhythmTotalRankingSongCount,rhythmTotalRankingMaxScore,rhythmTotalRankingProgress}=context.out;
const songs=RHYTHM_DEMO_SONG_IDS.map(songId=>({songId}));
const published=RHYTHM_DEMO_SONG_IDS.length;

check('曲数は公開曲の一覧から数える',rhythmTotalRankingSongCount(songs)===published,`${published}曲`);
check('理論満点は 曲数 × MASTERの満点',rhythmTotalRankingMaxScore(songs)===published*1000000,
  rhythmTotalRankingMaxScore(songs).toLocaleString());
check('達成率は0〜100に収まる',
  rhythmTotalRankingProgress(0,songs)===0
  &&Math.abs(rhythmTotalRankingProgress(published*1000000,songs)-100)<1e-9
  &&rhythmTotalRankingProgress(published*99999999,songs)===100
  &&rhythmTotalRankingProgress(-100,songs)===0);
check('壊れた値でも落ちない',rhythmTotalRankingProgress(null,songs)===0&&rhythmTotalRankingProgress('x',songs)===0
  &&rhythmTotalRankingSongCount(null)===0&&rhythmTotalRankingMaxScore(null)===0);
// ★曲を1曲足したら、分母も理論満点も自動で付いてくること
{
  const more=[...songs,{songId:'__new_song__'}];
  // rhythmDemoSongs は公開曲の一覧に載っている曲だけを返すので、一覧に無い曲は数に入らない
  check('公開曲の一覧に無い曲は数に入らない',rhythmTotalRankingSongCount(more)===published);
}

// --- 曲数を数字で書き写していないこと ---
const hardCoded=(text,label)=>{
  // 「17曲」「全17曲」のような、曲数を直接書いた表記を探す(ヘルプの例示は 14 / 17曲 の形で
  // 説明しているため、例示であることが分かるものだけは許す)
  const hits=[...text.matchAll(/(\d+)\s*曲/g)].map(m=>m[0])
    .filter(t=>Number(t.replace(/[^\d]/g,''))===published);
  return {label,hits};
};
[[screen,'ランキング画面'],[app,'App本体'],[supa,'Supabase層'],[data,'データ層']].forEach(([text,label])=>{
  const {hits}=hardCoded(text,label);
  check(`${label}に曲数(${published})を書き写していない`,hits.length===0,hits.join(', '));
});
check('画面の分母はデータから作る',screen.includes('rhythmTotalRankingSongCount(RHYTHM_SONGS)'));
check('達成率もデータから作る',screen.includes('rhythmTotalRankingProgress(entry.totalScore,RHYTHM_SONGS)'));

// --- 取得層 ---
check('合算は専用のビューから取る',supa.includes("/rest/v1/rhythm_total_rankings?select=")); 
check('並び順は合計の降順、同点は先に到達したほうが上',
  supa.includes('order=total_score.desc,last_scored_at.asc'));
check('表示件数は50件',/const RHYTHM_TOTAL_RANKING_DISPLAY_LIMIT = 50;/.test(supa));
check('ビューが無いときは「準備中」として扱う(エラーにしない)',
  supa.includes('const rhythmTotalRankingMissing =')&&supa.includes('error.notReady = true;')
  &&app.includes("setRhythmTotalRanking({ status:'notReady'")
  &&screen.includes('data-rhythm-total-not-ready'));
check('自分の行はIDと名前の両方から探す',
  supa.includes('const rhythmTotalRankingSelfKeys =')&&supa.includes("`name:${breederName || '名無しのブリーダー'}`"));
check('壊れた行でも数として扱う',
  supa.includes('totalScore: Number(row?.total_score) || 0')&&supa.includes('songCount: Number(row?.song_count) || 0'));

// --- 画面の結線 ---
// タブの並びは「この曲 / 総合 / イベント」。イベントは週間ランキング(フェーズ3)で足した。
// 出す・出さないはそれぞれの公開フラグが決めるので、並びは配列から作っている
check('タブを出している(この曲 / 総合)',
  screen.includes('data-rhythm-ranking-tabs')&&screen.includes("data-rhythm-ranking-tab={tab.id}")
  &&screen.includes("{id:'song',label:'この曲'},")&&screen.includes("{id:'total',label:'総合'}"));
// ★2026-09-11。押すたびに取り直す形へ変えた(イベントの総合が古いまま残っていたため)
check('総合タブは押すたびに取り直す',
  screen.includes("if(tab==='total')loadRhythmTotalRanking&&loadRhythmTotalRanking();")
  &&!screen.includes("if(tab==='total'&&total.status==='idle')loadRhythmTotalRanking"));
check('更新ボタンは開いているタブのほうを読み直す',screen.includes('else if(totalTabOpen)loadRhythmTotalRanking'));
check('自分の記録を上に固定で出す',screen.includes('あなたの記録')&&screen.includes('total.self'));
check('まだ記録のない曲から曲えらびへ戻れる',screen.includes('data-rhythm-total-remaining'));
check('新しい画面(gameState)を増やしていない',!/'RHYTHM_TOTAL_RANKING'/.test(app)&&!/'RHYTHM_TOTAL_RANKING'/.test(screen));
check('配信用JSにも入っている(build忘れではない)',
  game.includes('rhythmTotalRankingSongCount')&&game.includes('data-rhythm-ranking-tabs'));

// --- 既存を壊していないこと ---
check('この曲のランキングの取得は変えていない',
  supa.includes('const sbFetchRhythmRankings = async (difficultyKeys, limit=RHYTHM_RANKING_FETCH_LIMIT, offset=0,')
  &&app.includes('const keys = rhythmRankingCombinedMembers(song.songId);'));
check('この曲の一覧は総合タブでは出さない',
  screen.includes('const songTab=!totalTabOpen&&!boardTab;')
  &&screen.includes("{songTab&&rhythmRanking.status==='ready'&&rhythmRanking.entries.length>0&&"));

// --- 公開フラグ(機能と案内をまとめて出し入れする) ---
// ★集計はSupabase側のビューが行うので、SQLを適用するまで中身が出せない。
//   機能だけ先に出すと「まだ遊べないのにお知らせだけ出る」ことになる。実際に一度そうしてしまった
//   (2026-09-11・ユーザー指摘)。フラグ1つで、タブ・ヘルプ・更新履歴・助手の告知が同時に動くこと。
const totalReleased=/const RHYTHM_TOTAL_RANKING_PUBLIC_RELEASE = true;/.test(flags);
check('公開フラグを持っている',
  /const RHYTHM_TOTAL_RANKING_PUBLIC_RELEASE = (true|false);/.test(flags)
  &&flags.includes('rhythmTotalRanking:RHYTHM_TOTAL_RANKING_PUBLIC_RELEASE'),
  totalReleased?'公開中':'未公開');
check('画面はフラグでタブごと出し分ける',
  screen.includes('const totalReleased=RELEASE_FLAGS.rhythmTotalRanking===true;')
  &&screen.includes('const totalTab=totalReleased&&')
  &&screen.includes("...(totalReleased?[{id:'total',label:'総合'}]:[]),"));
check('ヘルプの「総合」の説明も同じフラグで出す',(()=>{
  const topic=(help.split("id:'rhythm-ranking'")[1]||'').split('id:\'rhythm-')[0];
  // 助手のひとこと(assistant)はトピック単位なのでフラグを持てない。そちらは
  // 「公開したら助手のひとことも『総合』に触れる」で別に見るため、本文のブロックだけを対象にする。
  // ★週間ランキング(フェーズ3)の説明も本文で「総合」に触れるので、
  //   「どちらかの公開フラグを持っていること」を見る。フラグの無い説明が混ざらないようにする
  const totalNotes=topic.split('\n')
    .filter(line=>line.includes("{t:'"))
    .filter(line=>line.includes('「総合」')||line.includes('同じブリーダー名'));
  return totalNotes.length>0&&totalNotes.every(line=>
    line.includes("releaseFlag:'rhythmTotalRanking'")||line.includes("releaseFlag:'rhythmWeeklyRanking'"));
})());
check('更新履歴も同じフラグで出す',(()=>{
  const at=changelog.indexOf('モンヒロビートに「総合」ランキングを追加しました');
  if(at<0)return false;
  const entry=changelog.slice(at,changelog.indexOf('  },',at));
  return entry.includes("releaseFlag:'rhythmTotalRanking'");
})());
// 公開のときに案内が古いままにならないように。フラグを立てたらここが効く
check('公開したら助手のひとことも「総合」に触れる',(()=>{
  if(!totalReleased)return true;
  const topic=(help.split("id:'rhythm-ranking'")[1]||'').slice(0,400);
  return /assistant:'[^']*総合/.test(topic);
})(),totalReleased?'':'未公開のあいだは対象外');

// --- 案内(CLAUDE.md ⑤) ---
check('ヘルプに総合タブの説明がある',
  help.includes("id:'rhythm-ranking'")&&help.includes('「総合」タブ')&&help.includes('全曲ぶん足し合わせた合計'));
check('ヘルプに曲数を書き写していない',hardCoded(help.split("id:'rhythm-ranking'")[1]||'','ヘルプ').hits.length===0);
check('更新履歴に載せている',changelog.includes('モンヒロビートに「総合」ランキングを追加しました'));
// 更新履歴の本文はそのまま助手の告知にもなる。曲数を書くと、曲が増えたときに
// 助手が古い数字を読み上げることになる(CLAUDE.md ⑤)
check('更新履歴(今回ぶん)に曲数を書き写していない',(()=>{
  const at=changelog.indexOf('モンヒロビートに「総合」ランキングを追加しました');
  if(at<0)return false;
  const entry=changelog.slice(at,changelog.indexOf('  },',at));
  return hardCoded(entry,'更新履歴').hits.length===0;
})());
// 告知のidは、先に出てしまったぶんを見た人にも公開のときに改めて届くよう上げることがある。
// 版の数字には縛らず、告知が付いていることだけを見る
check('助手の告知を付けている(大きい追加)',
  /update_notice_rhythm_total_ranking_v\d+/.test(changelog)&&changelog.includes("type:'content'"));
// ★ランキング画面には説明も吹き出しも置かない(2026-09-11・ユーザー指摘
//   「ランキングページに余計な説明が多くて見にくい」)。順位を見に来る画面なので、
//   読み物は場所を取りすぎる。説明はヘルプ、案内は曲えらびのみゅあの吹き出しにある。
// ★見るのは RhythmRankingScreen の中だけ。遊びかた(ヘルプ)の画面は読み物の場所なので、
//   あちらの横画面の案内まで消さない
const rankingScreenBody=screen.slice(screen.indexOf('function RhythmRankingScreen'));
check('ランキング画面に読み物を置いていない',
  rankingScreenBody.length>0
  &&!rankingScreenBody.includes('<AssistantBubble')
  &&!assistants.includes('rhythmTotalRanking')
  &&!rankingScreenBody.includes('<RhythmLandscapeHint')
  &&!/合計で競うランキングです/.test(rankingScreenBody));
check('仕様書に集計の決めごとがある',
  spec.includes('rhythm_total_rankings')&&spec.includes('identity_key'));

console.log(failed?`\n${failed}件のNGがあります`:'\nすべてOK');
process.exit(failed?1:0);

// モンビー(音ゲー)の全国ランキング(2026-09-04)を見る。
//
// ユーザーから「先行公開時にも全国ランキングがほしい」との明示の指示があり、既存の
// Supabase `rankings` テーブル・列は増やさず、difficulty列へ専用キー
// (Rhythm-<songId>-<難易度id>) を入れるだけで対応した。このファイルはそのキー設計・
// 集約ロジック(データ層)と、既存モードのランキング送受信を一切変更していないこと
// (画面側の結線)の両方を確認する。
//
//   node tools/mode/rhythm-ranking-check.js
const fs=require('fs'),path=require('path'),vm=require('vm');
const ROOT=path.resolve(__dirname,'../..'),read=file=>fs.readFileSync(path.join(ROOT,file),'utf8');
const data=read('monster-hero/data/rhythm-mode.js');
const game=read('monster-hero/src/game-system.jsx');
const help=read('monster-hero/data/help.js');
const changelog=read('monster-hero/data/changelog.js');
const docs=read('docs/spec/RHYTHM_MODE.md');

let failed=0;
const check=(name,ok,detail='')=>{console.log(`${ok?'✓':'✗'} ${name}${detail?` — ${detail}`:''}`);if(!ok)failed++;};

// --- データ層(data/rhythm-mode.js)をVMへ抽出して実行する ---
const grab=(text,a,b)=>text.slice(text.indexOf(a),text.indexOf(b));
const difficultiesBlock=grab(data,'const RHYTHM_DIFFICULTIES = Object.freeze([','const RHYTHM_JUDGMENTS');
const demoIdsLine=(data.match(/^const RHYTHM_DEMO_DIFFICULTY_IDS=.*$/m)||[''])[0];
const rankingStart=data.indexOf("const RHYTHM_RANKING_PREFIX='Rhythm';");
const entryFnStart=data.indexOf('const rhythmRankingEntryFromRow=(row)=>{',rankingStart);
const entryFnEnd=entryFnStart>=0?data.indexOf('\n};',entryFnStart)+3:-1;
const rankingBlock=rankingStart>=0&&entryFnEnd>rankingStart?data.slice(rankingStart,entryFnEnd):'';
check('難易度定義を抽出できる',difficultiesBlock.length>0);
check('体験版難易度idの定数を抽出できる',demoIdsLine.length>0);
check('ランキングのデータ層を抽出できる',rankingBlock.length>0);
if(!difficultiesBlock||!demoIdsLine||!rankingBlock){console.log(`\n${failed}件のNGがあります`);process.exit(1);}

const context={};
vm.createContext(context);
vm.runInContext(
  `${difficultiesBlock}\n${demoIdsLine}\n${rankingBlock}\n`+
  `this.out={RHYTHM_RANKING_PREFIX,RHYTHM_RANKING_SEPARATOR,RHYTHM_DEMO_DIFFICULTY_IDS,rhythmRankingDifficultyKey,parseRhythmRankingDifficultyKey,rhythmRankingCombinedMembers,rhythmRankingDedupeByUser,rhythmRankingEntryFromRow,RHYTHM_RANKING_FETCH_LIMIT,RHYTHM_RANKING_DISPLAY_LIMIT};`,
  context
);
const {RHYTHM_RANKING_PREFIX,RHYTHM_DEMO_DIFFICULTY_IDS,rhythmRankingDifficultyKey,parseRhythmRankingDifficultyKey,rhythmRankingCombinedMembers,rhythmRankingDedupeByUser,rhythmRankingEntryFromRow,RHYTHM_RANKING_FETCH_LIMIT,RHYTHM_RANKING_DISPLAY_LIMIT}=context.out;

check('キーの接頭辞はRhythm',RHYTHM_RANKING_PREFIX==='Rhythm');
check('キー生成: songId+難易度idからRhythm-<song>-<難易度>を作る',
  rhythmRankingDifficultyKey('monster_hero_theme_candidate','HARD')==='Rhythm-monster_hero_theme_candidate-HARD');
check('キー生成: 知らない難易度idはnull',rhythmRankingDifficultyKey('song','UNKNOWN')===null);
check('キー生成: songId無しはnull',!rhythmRankingDifficultyKey('','EASY')&&!rhythmRankingDifficultyKey(null,'EASY'));
check('キー解析: 生成したキーを解析すると同じsongId・難易度idへ戻る',(()=>{
  const key=rhythmRankingDifficultyKey('monster_hero_theme_candidate','NORMAL');
  const parsed=parseRhythmRankingDifficultyKey(key);
  return parsed&&parsed.songId==='monster_hero_theme_candidate'&&parsed.difficultyId==='NORMAL';
})());
check('キー解析: 接頭辞違い・部品数違い・知らない難易度はnull(既存キーと取り違えない)',
  parseRhythmRankingDifficultyKey('Species-Mia-Normal')===null
  &&parseRhythmRankingDifficultyKey('Rhythm-onlytwo')===null
  &&parseRhythmRankingDifficultyKey('Rhythm-song-UNKNOWN')===null
  &&parseRhythmRankingDifficultyKey('')===null
  &&parseRhythmRankingDifficultyKey(undefined)===null);
// 2026-09-05、先行公開が5曲・5難易度になったのでEXPERT/MASTERも合算へ入る。
// 見張りたいのは「体験版で遊べる難易度と合算対象がずれていないこと」なので、
// 数を決め打ちにせず RHYTHM_DEMO_DIFFICULTY_IDS から作った期待値と突き合わせる。
check('合算対象は体験版で遊べる難易度と一致する(ずれたら気づく)',
  JSON.stringify(rhythmRankingCombinedMembers('song'))
  ===JSON.stringify(RHYTHM_DEMO_DIFFICULTY_IDS.map(id=>`Rhythm-song-${id}`)));
check('いまの合算対象はEASY〜MASTERの5難易度',
  JSON.stringify(rhythmRankingCombinedMembers('song'))
  ===JSON.stringify(['Rhythm-song-EASY','Rhythm-song-NORMAL','Rhythm-song-HARD','Rhythm-song-EXPERT','Rhythm-song-MASTER']));
check('取得件数(200)は表示件数(50)より多い(重複ユーザーぶんを見込む)',
  Number(RHYTHM_RANKING_FETCH_LIMIT)>Number(RHYTHM_RANKING_DISPLAY_LIMIT));

check('dedupe: 同じユーザー名は最高得点の1件だけへ畳む(自分のスコアは1件のみ)',(()=>{
  const rows=[{user_name:'A',score:100},{user_name:'A',score:300},{user_name:'A',score:200},{user_name:'B',score:250}];
  const out=rhythmRankingDedupeByUser(rows);
  const a=out.find(r=>r.user_name==='A');
  return out.length===2&&a.score===300;
})());
check('dedupe: スコア降順で並ぶ',(()=>{
  const rows=[{user_name:'A',score:100},{user_name:'B',score:300},{user_name:'C',score:200}];
  const out=rhythmRankingDedupeByUser(rows);
  return out.map(r=>r.user_name).join(',')==='B,C,A';
})());
check('dedupe: user_nameが無い行も名無しのブリーダーとして畳まれ、落ちない',(()=>{
  const rows=[{score:10},{score:20}];
  const out=rhythmRankingDedupeByUser(rows);
  return out.length===1&&out[0].score===20;
})());

// 2026-09-04: party列は既存モードと同じ「配列」の形で送る(スキーマが配列前提でも
// 衝突しない防御)。先頭要素をdetailとして読む
check('entry変換: difficulty列からsongId/難易度idを取り出し、party配列の先頭要素をdetailとして残す',(()=>{
  const row={user_name:'テスト',score:'123456',level:'7',icon:'mia',difficulty:'Rhythm-monster_hero_theme_candidate-HARD',hero:'HARD',party:[{maxCombo:50,judgments:{MARVELOUS:10}}]};
  const entry=rhythmRankingEntryFromRow(row);
  return entry.userName==='テスト'&&entry.score===123456&&entry.level===7&&entry.icon==='mia'
    &&entry.difficultyId==='HARD'&&entry.detail&&entry.detail.maxCombo===50;
})());
check('entry変換: 壊れた値・欠損値でも落ちずに既定値へ倒れる',(()=>{
  const entry=rhythmRankingEntryFromRow({});
  return entry.userName==='名無しのブリーダー'&&entry.score===0&&entry.level===0&&entry.icon===null&&entry.detail===null;
})());
check('entry変換: partyが配列でない、空配列、要素がオブジェクトでない場合はdetailをnullにする(壊れたデータでも安全に倒れる)',(()=>{
  const a=rhythmRankingEntryFromRow({difficulty:'Rhythm-song-EASY',party:{maxCombo:50}});
  const b=rhythmRankingEntryFromRow({difficulty:'Rhythm-song-EASY',party:[]});
  const c=rhythmRankingEntryFromRow({difficulty:'Rhythm-song-EASY',party:['broken']});
  return a.detail===null&&b.detail===null&&c.detail===null;
})());

// --- 画面側の結線・既存モードとの分離(src/game-system.jsx) ---
check('専用の保存先(RHYTHM_RANKING_SELECT)を持ち、difficulty列も取得している(合算表示に必要)',
  game.includes("const RHYTHM_RANKING_SELECT = 'user_name,hero,party,score,level,icon,difficulty';"));
check('専用の送信関数(sbInsertRhythmScore)を持つ',game.includes('const sbInsertRhythmScore = async (row) => {'));
check('送信はclear_id必須(重複防止)',
  /const sbInsertRhythmScore = async \(row\) => \{\s*if \(typeof row\?\.clear_id !== 'string' \|\| !row\.clear_id\.trim\(\)\)/.test(game));
check('送信はRhythm-接頭辞のキーだけを受け付ける(他モードの行を誤って書かない)',
  game.includes('if (!String(row?.difficulty ?? \'\').startsWith(`${RHYTHM_RANKING_PREFIX}${RHYTHM_RANKING_SEPARATOR}`)) {'));
check('専用の取得関数(sbFetchRhythmRankings)を持ち、複数キーをin.(...)でまとめて取得する',
  game.includes('const sbFetchRhythmRankings = async (difficultyKeys')
  &&/difficulty=in\.\(\$\{keys\.map/.test(game));
check('取得はoffsetを受け取れる(ページ送りに使う)',
  /const sbFetchRhythmRankings = async \(difficultyKeys, limit=RHYTHM_RANKING_FETCH_LIMIT, offset=0,/.test(game)
  &&game.includes('&offset=${offset}`;'));
// 2026-09-04、Codexレビュー指摘: 1プレイ=1行のまま増え続けるため、1回の取得を打ち切ると
// 同じプレイヤーの行だけで埋まり、他プレイヤーがユーザー集約後に消えてしまう。
// ユニークな人数が集まるかページが尽きるまで送るループになっているかを確認する
check('loadRhythmRankingは、ユニークな人数(表示件数ぶん)が集まるかページが尽きるまでページ送りする',(()=>{
  const at=game.indexOf('const loadRhythmRanking = useCallback(async (song) => {');
  const end=game.indexOf('submitRhythmRankingScore',at);
  const block=at>=0&&end>at?game.slice(at,end):'';
  return block.includes('for (let page = 0; page < RHYTHM_RANKING_MAX_PAGES; page++) {')
    &&block.includes('page * RHYTHM_RANKING_FETCH_LIMIT')
    &&block.includes('rhythmRankingDedupeByUser(rows).length >= RHYTHM_RANKING_DISPLAY_LIMIT')
    &&block.includes('pageRows.length < RHYTHM_RANKING_FETCH_LIMIT');
})());
check('ページ送りに上限(RHYTHM_RANKING_MAX_PAGES)があり、無限に取得し続けない',
  data.includes('const RHYTHM_RANKING_MAX_PAGES=10;'));
check('sbInsertRhythmScore/sbFetchRhythmRankingsは、既存モードが必ず経由するnormalizeRankingDifficultyを呼んでいない(検証を共有しない)',(()=>{
  const at=game.indexOf('const sbInsertRhythmScore = async (row) => {');
  const end=game.indexOf('const createRunId',0)>=0&&game.indexOf('const createRunId')<at
    ? game.indexOf('難易度に依存しない周回開始処理',at)
    : game.indexOf('難易度に依存しない周回開始処理',at);
  const block=at>=0&&end>at?game.slice(at,end):'';
  return block.length>0&&!block.includes('normalizeRankingDifficulty(')&&!block.includes('sbInsertScore(')&&!block.includes('sbFetchRankings(');
})());
check('既存モードのランキングキー一覧(RANKING_DIFFICULTY_KEYS)にRhythmを混ぜていない(検証を緩めていない)',
  !/RANKING_DIFFICULTY_KEYS = Object\.freeze\(\[[\s\S]{0,400}Rhythm/.test(game));

check('送信の呼び出し(submitRhythmRankingScore)を持つ',game.includes('const submitRhythmRankingScore = useCallback(async (song, difficulty, result) => {'));
check('送信はpersistRankingScoreを再利用し、insertScoreだけモンビー専用に差し替える(送受信の共通の失敗処理は増やさない)',
  /persistRankingScore\(\{\s*row, insertScore: sbInsertRhythmScore,/.test(game));
check('送信に失敗したときだけ専用キー(mh_rhythm_rank_pending_v1)へ退避する。BEST記録のキーとは別',
  game.includes("const RHYTHM_RANKING_PENDING_KEY = 'mh_rhythm_rank_pending_v1';")
  &&game.includes("const RHYTHM_BEST_RECORDS_KEY = 'mh_rhythm_best_v1';")
  &&game.includes('await storeSet(RHYTHM_RANKING_PENDING_KEY,'));
check('退避する記録に上限があり、際限なく増やさない',
  game.includes('const RHYTHM_RANKING_PENDING_MAX = 20;')
  &&game.includes('list.slice(-RHYTHM_RANKING_PENDING_MAX)'));
check('体験版から始めたプレイ(from===demo)のときだけ送信し、デバッグプレイは送信しない',
  /if\(rhythmPlay\.from==='demo'\)submitRhythmRankingScore\(rhythmPlay\.song,rhythmPlay\.difficulty,result\);/.test(game));
check('BEST記録の保存(saveRhythmBestRecord)は送信の有無に関わらず必ず行う(先に呼んでいる)',(()=>{
  const idx=game.indexOf("onComplete={async(result,merged)=>{const records=await saveRhythmBestRecord(");
  const submitIdx=game.indexOf("submitRhythmRankingScore(rhythmPlay.song,rhythmPlay.difficulty,result)");
  return idx>=0&&submitIdx>idx;
})());

// --- 画面(一覧・詳細) ---
check('体験版ホームに全国ランキングへの入口がある',game.includes('data-rhythm-demo-ranking'));
check('入口はloadRhythmRankingを呼んでから専用画面(RHYTHM_RANKING)へ進む',
  /data-rhythm-demo-ranking[\s\S]{0,160}loadRhythmRanking\(song\);setGameState\('RHYTHM_RANKING'\);/.test(game));
check('一覧画面がある',game.includes("gameState==='RHYTHM_RANKING'")&&game.includes('data-rhythm-ranking'));
check('読み込み中・失敗・0件のときの案内をそれぞれ持つ',
  game.includes('data-rhythm-ranking-loading')&&game.includes('data-rhythm-ranking-error')&&game.includes('data-rhythm-ranking-empty'));
check('一覧の各行に順位・アイコン・名前・難易度・スコア・ランクを出す',
  game.includes('data-rhythm-ranking-row')
  &&game.includes('rankingBreederIcon(entry)')
  &&/RHYTHM_RANK_COLORS\[rhythmRankForScore\(entry\.score\)\]/.test(game));
check('詳細ボタンから判定内訳・最大コンボ・達成称号を確認できる',
  game.includes('data-rhythm-ranking-detail')
  &&game.includes('data-rhythm-ranking-detail-modal')
  &&game.includes('rhythmRankingDetail.detail?.maxCombo')
  &&/RHYTHM_JUDGMENT_IDS\.map\(id=>.*rhythmRankingDetail\.detail\?\.judgments\?\.\[id\]/.test(game));
check('詳細が無い行(送信が古い/失敗した記録等)には詳細ボタンを出さない',
  /\{entry\.detail&&<button data-rhythm-ranking-detail/.test(game));
check('一覧・詳細のボタンはiPhoneで押せる大きさ(44px以上)',(()=>{
  const at=game.indexOf("gameState==='RHYTHM_RANKING'");
  const end=game.indexOf("gameState==='RHYTHM_DEBUG'",at);
  const block=at>=0&&end>at?game.slice(at,end):'';
  const heights=[...block.matchAll(/min-h-\[(\d+)px\]/g)].map(m=>Number(m[1]));
  return block.length>0&&heights.length>0&&heights.every(h=>h>=44);
})());

// --- 既存のBEST記録・レーン側・スコア計算には触れていない ---
check('BEST記録の保存形式(RHYTHM_BEST_RECORDS_KEY)は変更していない',
  game.includes("const RHYTHM_BEST_RECORDS_KEY = 'mh_rhythm_best_v1';"));
check('判定窓・スコアの重み・落下時間は変更していない',
  data.includes('const RHYTHM_PROJECTION_TOP_SCALE=.18')
  &&game.includes('const rhythmTravelMsForSpeed=value=>'));

// --- ヘルプ・更新履歴・仕様書 ---
check('ヘルプに全国ランキングの説明がある',help.includes("id:'rhythm-ranking'")&&help.includes('全国ランキング'));
check('画面(RHYTHM_RANKING)がヘルプの対応表に載っている',help.includes("RHYTHM_RANKING:"));
check('更新履歴に記載がある',changelog.includes('全国ランキング')&&changelog.includes('releaseFlag'));
check('仕様書に保存の仕組み(新テーブル・新列なし)を記載',
  docs.includes('全国ランキング')&&docs.includes('Rhythm-<songId>-<難易度id>')&&docs.includes('新テーブル・新列'));

console.log(failed?`\n${failed}件のNGがあります`:'\nすべてOK');
process.exit(failed?1:0);

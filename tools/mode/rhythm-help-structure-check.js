#!/usr/bin/env node
// モンビー(モンヒロビート)のヘルプが「読める形」になっているかを見る。
//
// 2026-09-06、ユーザーから「モンビーのヘルプが終わってる／ただの文章の羅列で見にくすぎる」と
// 指摘を受けた。そのときの中身はこうだった。
//   ・説明の項目が basics(基本ルール・23項目)の中に混ざっていて、本ゲームのヘルプからは埋もれていた
//   ・rhythm-mode が 4300字を1つの段落で持っていた(表も箇条書きも無し)
//   ・モンビー内の「📖 遊びかた」は全項目を展開して縦に並べるだけで、開くと2万字が流れてきた
//
// どれも「気づいたときにはもう読めない」類なので、機械で見張る。
// 文章そのものの良し悪しは測れないが、「1段落に詰め込む」「一覧を手で書き写す」
// 「全部展開して並べる」の3つは形として拾える。
const fs=require('fs');
const path=require('path');
const vm=require('vm');

const ROOT=path.resolve(__dirname,'..','..');
const read=p=>fs.readFileSync(path.join(ROOT,p),'utf8');
let failed=0;
const ok=(name,cond,detail='')=>{console.log(`${cond?'OK':'NG'}: ${name}${detail?` — ${detail}`:''}`);if(!cond)failed++;};

const helpSrc=read('monster-hero/data/help.js');
const game=read('monster-hero/src/game-system.jsx');
const assistants=read('monster-hero/data/assistants.js');

const ctx={};
vm.createContext(ctx);
vm.runInContext(`${helpSrc}\nglobalThis.__h={HELP_CATEGORIES,HELP_SCREEN_COVERAGE,helpFindTopic,helpPlainText};`,ctx);
const {HELP_CATEGORIES:categories,HELP_SCREEN_COVERAGE:coverage,helpFindTopic,helpPlainText}=ctx.__h;

// --- ① モンビー専用のカテゴリがあり、本ゲームのヘルプの1画面目から開ける ---
const rhythm=categories.find(c=>c.id==='rhythm');
ok('モンビー専用のヘルプカテゴリがある',!!rhythm,rhythm?`${rhythm.title} / ${rhythm.topics.length}項目`:'HELP_CATEGORIES に id:"rhythm" がありません');
if(!rhythm){console.log('\n1件以上のNGがあります');process.exit(1);}
// 1画面目はデータ(HELP_GUIDE)をそのまま並べるので、カテゴリがあれば必ず大きなボタンで出る。
// 「本ゲームからもモンビーのヘルプを見れるようにして」への答えがここ
ok('本ゲームのヘルプの1画面目がカテゴリをデータから並べている',game.includes('{HELP_GUIDE.map(c=>('));
ok('モンビーの説明が basics(基本ルール)に残っていない',
  !(categories.find(c=>c.id==='basics')||{topics:[]}).topics.some(t=>String(t.id||'').startsWith('rhythm-')),
  (categories.find(c=>c.id==='basics')||{topics:[]}).topics.filter(t=>String(t.id||'').startsWith('rhythm-')).map(t=>t.id).join(' / ')||'なし');

// --- ② 1つの項目に文章を詰め込んでいない ---
// いちばん長い段落(p / note)がこれを超えたら、表・箇条書き・別項目へ割る。
// 指摘を受けたときの rhythm-mode は 4300字だった。
const PARAGRAPH_LIMIT=1200;
const longBlocks=rhythm.topics.flatMap(t=>(t.blocks||[])
  .filter(b=>(b.t==='p'||b.t==='note')&&String(b.text||'').length>PARAGRAPH_LIMIT)
  .map(b=>`${t.id}(${String(b.text).length}字)`));
ok(`1つの段落が${PARAGRAPH_LIMIT}字を超えていない`,longBlocks.length===0,longBlocks.join(' / ')||`いちばん長い段落 ${Math.max(...rhythm.topics.flatMap(t=>(t.blocks||[]).map(b=>String(b.text||'').length)))}字`);
// 段落だけを並べた項目(表も箇条書きも無い)が無いか。読む側の手がかりが本文しかなくなる
const flat=rhythm.topics.filter(t=>(t.blocks||[]).length>=4&&!(t.blocks||[]).some(b=>b.t==='kv'||b.t==='list'||b.t==='steps'||b.t==='data'));
ok('長い項目には表・箇条書き・実データの表のどれかがある',flat.length===0,flat.map(t=>t.id).join(' / ')||`${rhythm.topics.length}項目`);
ok('どの項目も本文が2つ以上のかたまりに分かれている',
  rhythm.topics.every(t=>(t.blocks||[]).length>=2),
  rhythm.topics.filter(t=>(t.blocks||[]).length<2).map(t=>t.id).join(' / ')||'すべて分かれている');

// --- ③ 一覧はヘルプへ手で書き写さず、実データから作る(CLAUDE.md ⑤-3) ---
const dataIds=rhythm.topics.flatMap(t=>(t.blocks||[]).filter(b=>b.t==='data').map(b=>b.id));
for(const id of ['rhythmDemoSongList','rhythmDifficultyRanks','rhythmMonsterAbilities','rhythmDifficultySpread','rhythmSongArtwork','rhythmDemoSongLevels']){
  ok(`一覧「${id}」を実データから作っている`,dataIds.includes(id),dataIds.includes(id)?'':`data/help.js の rhythm カテゴリに { t:'data', id:'${id}' } がありません`);
}

// --- ④ 項目一覧に小見出しを出す名札(group)がそろっている ---
ok('すべての項目に group(小見出し)が付いている',
  rhythm.topics.every(t=>!!t.group),
  rhythm.topics.filter(t=>!t.group).map(t=>t.id).join(' / ')||[...new Set(rhythm.topics.map(t=>t.group))].join(' / '));
// 同じ group が離れた場所に2回出ると、小見出しが同じ名前で2回出てしまう
const seen=[];const scattered=[];
for(const t of rhythm.topics){
  if(seen[seen.length-1]===t.group)continue;
  if(seen.includes(t.group))scattered.push(t.group);
  seen.push(t.group);
}
ok('同じ group の項目がひとかたまりに並んでいる',scattered.length===0,scattered.join(' / ')||`${seen.length}グループ`);
ok('項目一覧が group の切り替わりで小見出しを出す',
  game.includes('data-help-topic-group')&&game.includes("t.group&&t.group!==(cat.topics[i-1]||{}).group"));

// --- ⑤ 画面とヘルプの対応が新しいカテゴリを指している ---
const rhythmScreens=Object.entries(coverage).filter(([k])=>k.startsWith('RHYTHM_'));
ok('モンビーの画面はすべてモンビーのカテゴリを指している',
  rhythmScreens.every(([,v])=>typeof v==='string'&&v.startsWith('rhythm/')),
  rhythmScreens.filter(([,v])=>!(typeof v==='string'&&v.startsWith('rhythm/'))).map(([k,v])=>`${k}→${v}`).join(' / ')||`${rhythmScreens.length}画面`);
ok('指し先の項目が実在する',
  rhythmScreens.every(([,v])=>helpFindTopic(String(v).split('/')[0],String(v).split('/')[1])),
  rhythmScreens.filter(([,v])=>!helpFindTopic(String(v).split('/')[0],String(v).split('/')[1])).map(([k,v])=>`${k}→${v}`).join(' / '));
ok('助手のヘルプ参照に古い basics/rhythm-* が残っていない',
  !assistants.includes('basics/rhythm-'),
  (assistants.match(/basics\/rhythm-[a-z-]+/g)||[]).join(' / ')||'なし');

// --- ⑥ モンビー内の「📖 遊びかた」が一覧→本文の2階層になっている ---
ok('遊びかたは項目一覧から始まる',
  game.includes('data-rhythm-demo-help-list')&&game.includes('data-rhythm-demo-help-open='),
  '一覧のボタンから項目を開く');
ok('遊びかたは開くたびに項目一覧へ戻る',game.includes('setRhythmHelpTopicId(null);setGameState(\'RHYTHM_DEMO_HELP\')'));
ok('遊びかたの戻るは1階層ずつ戻る',
  game.includes("onClick={()=>{if(topic)setRhythmHelpTopicId(null);else setGameState('RHYTHM_DEMO_HOME');}}"));
ok('遊びかたから次の項目へ進める',game.includes('data-rhythm-demo-help-next'));
ok('遊びかたも group の小見出しを出す',game.includes('data-rhythm-demo-help-group'));
// 全項目を展開して縦に並べる作りへ戻っていないか。ここが元に戻ると指摘された状態に戻る
const helpAt=game.indexOf("gameState==='RHYTHM_DEMO_HELP'");
const helpBlock=game.slice(helpAt,game.indexOf("gameState==='RHYTHM_DEMO_MONSTERS'",helpAt));
ok('遊びかたが全項目を展開して並べていない',
  !/topics\.map\(topic=>\(/.test(helpBlock)&&helpBlock.includes('renderHelpBlocks(topic.blocks'),
  '本文は開いた1項目だけを描く');

// --- ⑦ プレイヤー向けの説明に開発用の話が混ざっていない ---
// 以前の rhythm-mode には「デバッグ画面のWIDTH TESTでは…」がそのまま入っていた(CLAUDE.md ⑤の但し書き)
const devWords=['デバッグ画面','WIDTH TEST','TAPER TEST','暫定値','DEBUG'];
const dirty=rhythm.topics.flatMap(t=>{const text=helpPlainText(t);return devWords.filter(w=>text.includes(w)).map(w=>`${t.id}:${w}`);});
ok('プレイヤー向けの説明に開発用の言葉が混ざっていない',dirty.length===0,dirty.join(' / ')||`${devWords.length}語を確認`);

// --- ⑧ 「📖 遊びかた」を実際にReactで描く ---
// 静的に文字列を探すだけだと「書いてはあるが描くと落ちる」を拾えない。
// ユーザーから指摘を受けたのはまさにこの画面なので、一覧と本文の両方を実際に描いて確かめる。
// このサンドボックスは外部CDN(Tailwind)へ出られずアプリを起動して目で見る確認ができないため、
// 画面のJSXだけを切り出し、状態と外の関数を差し替えて react-dom/server で文字列にする。
(() => {
  const React=require('react');
  const ReactDOMServer=require('react-dom/server');
  const babel=require('@babel/core');
  const PRESET_REACT=require.resolve('@babel/preset-react');
  const START="        {gameState==='RHYTHM_DEMO_HELP'&&(()=>{";
  const from=game.indexOf(START);
  const to=game.indexOf('\n        })()}', from);
  if(from<0||to<0){ok('遊びかたのJSXを切り出せる',false);return;}
  const jsx=game.slice(from,to+'\n        })()}'.length);
  const stub=({size})=>React.createElement('i',{'data-size':size});
  let Screen;
  try{
    const code=babel.transformSync(
      `${helpSrc}\n`
      +'const releasedForPlayers = () => true;\n'
      +'const HELP_GUIDE = HELP_CATEGORIES;\n'
      +"const helpCategoryById = (id) => HELP_GUIDE.find(c => c.id === id) || null;\n"
      // 本文の描き方は本ゲームのヘルプと共通(renderHelpBlocks)。ここでは中身が出たことだけ見たいので
      // 同じ引数で受け取り、ブロックの文字をそのまま並べる差し替えを使う
      +"const renderHelpBlocks = (blocks, accent) => (blocks||[]).map((b,i)=>React.createElement('div',{key:i},"
      +"  b.t==='kv'?b.rows.map(r=>r.join(': ')).join(' / ')"
      +" :(b.t==='list'||b.t==='steps')?b.items.join(' / ')"
      +" :b.t==='data'?`[表:${b.id}]`"
      +" :String(b.title? b.title+': ':'')+String(b.text||'')));\n"
      +"const RhythmLandscapeHint = () => null;\n"
      +"const AssistantBubble = ({scene}) => React.createElement('div',null,`[助手:${scene}]`);\n"
      +'const RhythmHelpScreen = ({ gameState, rhythmHelpTopicId, setRhythmHelpTopicId, setGameState,\n'
      +'  ArrowLeft, ChevronRight, startRhythmPractice, startRhythmTutorial }) => (<>\n'
      +jsx+'\n</>);\nmodule.exports={RhythmHelpScreen};',
      {presets:[[PRESET_REACT,{runtime:'classic'}]],filename:'rhythm-help-structure-check.jsx'});
    const scope={exports:{}};
    new Function('module','exports','React',code.code)(scope,scope.exports,React);
    Screen=scope.exports.RhythmHelpScreen;
  }catch(e){ok('遊びかたの画面を組み立てられる',false,String(e).split('\n')[0]);return;}
  const noop=()=>{};
  const render=state=>ReactDOMServer.renderToStaticMarkup(React.createElement(Screen,{
    gameState:'RHYTHM_DEMO_HELP', rhythmHelpTopicId:null,
    setRhythmHelpTopicId:noop, setGameState:noop,
    ArrowLeft:stub, ChevronRight:stub, startRhythmPractice:noop, startRhythmTutorial:noop, ...state}));
  const plain=html=>html.replace(/<[^>]*>/g,'');
  let list='';
  try{list=render({});}catch(e){ok('遊びかたの項目一覧が描ける',false,String(e).split('\n')[0]);return;}
  const listText=plain(list);
  ok('遊びかたの項目一覧が描ける',
    rhythm.topics.every(t=>listText.includes(t.title)),
    rhythm.topics.filter(t=>!listText.includes(t.title)).map(t=>t.id).join(' / ')||`${rhythm.topics.length}項目`);
  const shownGroups=(list.match(/data-rhythm-demo-help-group[^>]*>([^<]*)</g)||[]).map(m=>m.replace(/.*>/,'').replace(/<$/,''));
  const groups=[...new Set(rhythm.topics.map(t=>t.group))];
  ok('遊びかたの項目一覧に小見出しが出る',
    groups.every(g=>shownGroups.includes(g))&&shownGroups.length===groups.length,
    shownGroups.join(' / ')||'出ていない');
  ok('項目一覧では本文をまだ出さない',
    !listText.includes(rhythm.topics[0].blocks.find(b=>b.t==='p').text.slice(0,30)),
    '開くまで本文は出さない');
  ok('練習とチュートリアルの導線が一覧にある',
    list.includes('data-rhythm-demo-practice')&&list.includes('data-rhythm-demo-help-tutorial'));
  // 全項目の本文を1つずつ開いて、最後まで描けるか
  const bodyNg=[];
  for(const t of rhythm.topics){
    try{
      const body=plain(render({rhythmHelpTopicId:t.id}));
      const missing=(t.blocks||[]).some(b=>{
        if(b.t==='kv')return b.rows.some(r=>!body.includes(r[0])||!body.includes(r[1]));
        if(b.t==='list'||b.t==='steps')return b.items.some(x=>!body.includes(x));
        if(b.t==='data')return !body.includes(`[表:${b.id}]`);
        return !body.includes(String(b.text).slice(0,40));
      });
      if(missing||!body.includes(t.title))bodyNg.push(t.id);
    }catch(e){bodyNg.push(`${t.id}(${String(e).split('\n')[0]})`);}
  }
  ok('全項目の本文が最後まで描ける',bodyNg.length===0,bodyNg.join(' / ')||`${rhythm.topics.length}項目`);
  const first=render({rhythmHelpTopicId:rhythm.topics[0].id});
  ok('本文から次の項目へ進める',first.includes('data-rhythm-demo-help-next')&&plain(first).includes(`次: ${rhythm.topics[1].title}`));
  const last=render({rhythmHelpTopicId:rhythm.topics[rhythm.topics.length-1].id});
  ok('最後の項目では「次:」を出さない',!plain(last).includes('次: '));
})();

console.log(failed?`\n${failed}件のNGがあります`:'\nすべてOK');
process.exit(failed?1:0);

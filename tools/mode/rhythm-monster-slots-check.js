// モンスターノーツ用のマスモン設定(RHYTHM_MODE §3.2 / 実装計画 §3.2〜3.3)を確かめる。
//
// 確定している仕様:
//   ・音ゲー用モンスターはマスモンから設定する
//   ・最大4体。1〜3体でもプレイできる
//   ・1〜4枠目の並び順を保持し、その順番をモンスターノーツの登場順に使う
//   ・同じベースモンスター(同 baseId)は複数枠へ設定できない。別個体でも不可
//   ・別モンスターなら、同じ血統・同じ能力でも同時設定できる
//   ・保存は既存の mh_* を壊さず後方互換を持たせる
//
// とくに大事なのは **保存を壊さないこと**(CLAUDE.md ⑦)。
// マスモン一覧をまだ読めていない時点で「手元にいないから」と消してしまうと、
// プレイヤーの設定が復元できなくなる。保存値は形だけを整え、存在確認は使うときに行う。
//
//   node tools/mode/rhythm-monster-slots-check.js
const fs=require('fs'),path=require('path'),vm=require('vm');
const ROOT=path.resolve(__dirname,'../..'),read=file=>fs.readFileSync(path.join(ROOT,file),'utf8');
const data=read('monster-hero/data/rhythm-mode.js');
const game=read('monster-hero/src/game-system.jsx');

let failed=0;
const check=(name,ok,detail='')=>{console.log(`${ok?'✓':'✗'} ${name}${detail?` — ${detail}`:''}`);if(!ok)failed++;};

// ── 実装を取り出して実際に動かす ────────────────────────────────────────────
const block=data.match(/const RHYTHM_MONSTER_SLOT_KEY=[\s\S]*?const rhythmMonsterNoteBaseRatios=[\s\S]*?\n\};/)?.[0];
check('マスモン設定の実装を抽出できる',!!block);
if(!block)process.exit(1);
const context={};vm.createContext(context);
vm.runInContext(`${block}\nthis.out={RHYTHM_MONSTER_SLOT_KEY,RHYTHM_MONSTER_SLOT_MAX,RHYTHM_MONSTER_SLOT_ISSUE_TEXT,RHYTHM_MONSTER_NOTE_BASE_RATIOS,sanitizeRhythmMonsterSlotIds,resolveRhythmMonsterSlots,rhythmMonsterSlotAddIssue,addRhythmMonsterSlot,removeRhythmMonsterSlot,moveRhythmMonsterSlot,rhythmMonsterNoteBaseRatios};`,context);
const M=context.out;

check('保存キーは新しく分けてある',M.RHYTHM_MONSTER_SLOT_KEY==='mh_rhythm_monsters_v1',M.RHYTHM_MONSTER_SLOT_KEY);
check('設定できるのは最大4体',M.RHYTHM_MONSTER_SLOT_MAX===4,String(M.RHYTHM_MONSTER_SLOT_MAX));

// 手元のマスモン(同じベースモンスターの別個体・同血統の別モンスターを混ぜる)
const OWNED=[
  {id:'u-mia-1',baseId:'mia',name:'ミーアA'},
  {id:'u-mia-2',baseId:'mia',name:'ミーアB'},   // 同じベースの別個体
  {id:'u-pandora',baseId:'pandora',name:'パンドラ'},
  {id:'u-ham',baseId:'ham',name:'ハム'},        // 根性
  {id:'u-zan',baseId:'zan',name:'ザン'},        // 同じく根性の別モンスター
  {id:'u-pixie',baseId:'pixie',name:'ピクシー'},
];
const ids=list=>list.map(masu=>String(masu.id));

// ── 保存値の正規化(形だけ) ─────────────────────────────────────────────────
check('保存が無ければ空',JSON.stringify(M.sanitizeRhythmMonsterSlotIds(undefined))==='[]');
check('壊れた保存でも落ちない',
  JSON.stringify(M.sanitizeRhythmMonsterSlotIds({a:1}))==='[]'
  &&JSON.stringify(M.sanitizeRhythmMonsterSlotIds([null,'',0,{},'u-mia-1']))==='["u-mia-1"]');
check('4体を超える保存値は4体で切る',
  M.sanitizeRhythmMonsterSlotIds(['a','b','c','d','e','f']).length===4);
check('同じIDの重複は落とす',
  JSON.stringify(M.sanitizeRhythmMonsterSlotIds(['a','a','b']))==='["a","b"]');
check('オブジェクト形式の保存(将来の拡張)も読める',
  JSON.stringify(M.sanitizeRhythmMonsterSlotIds([{id:'a'},{id:'b'}]))==='["a","b"]');
check('{slots:[...]} 形式も読める',
  JSON.stringify(M.sanitizeRhythmMonsterSlotIds({slots:['a','b']}))==='["a","b"]');
// ここが後方互換のかなめ。一覧が読めていなくても保存値は減らない
check('マスモン一覧を見ないので、読み込み前でも設定が消えない',
  JSON.stringify(M.sanitizeRhythmMonsterSlotIds(['u-mia-1','u-pandora']))==='["u-mia-1","u-pandora"]');

// ── 使うときの解決 ──────────────────────────────────────────────────────────
check('保存した並び順のまま解決する',
  JSON.stringify(ids(M.resolveRhythmMonsterSlots(['u-pandora','u-mia-1'],OWNED)))==='["u-pandora","u-mia-1"]');
check('手放したマスモンは使うときに落とす(保存は書き換えない)',
  JSON.stringify(ids(M.resolveRhythmMonsterSlots(['u-gone','u-ham'],OWNED)))==='["u-ham"]');
check('同じベースモンスターは使うときも重ねない',
  JSON.stringify(ids(M.resolveRhythmMonsterSlots(['u-mia-1','u-mia-2','u-ham'],OWNED)))==='["u-mia-1","u-ham"]');
check('マスモン一覧が空なら何も解決しない(保存は残る)',
  M.resolveRhythmMonsterSlots(['u-mia-1'],[]).length===0
  &&M.sanitizeRhythmMonsterSlotIds(['u-mia-1']).length===1);

// ── 追加できる / できない ───────────────────────────────────────────────────
check('空の状態からは設定できる',M.rhythmMonsterSlotAddIssue([],'u-mia-1',OWNED)===null);
check('ミーア + ミーア(別個体)は不可',
  M.rhythmMonsterSlotAddIssue(['u-mia-1'],'u-mia-2',OWNED)==='duplicate-base');
check('ミーア + パンドラは可',
  M.rhythmMonsterSlotAddIssue(['u-mia-1'],'u-pandora',OWNED)===null);
check('同じ能力(根性)の別モンスター同士は可',
  M.rhythmMonsterSlotAddIssue(['u-ham'],'u-zan',OWNED)===null);
check('同じ個体をもう一度は不可',
  M.rhythmMonsterSlotAddIssue(['u-mia-1'],'u-mia-1',OWNED)==='duplicate-id');
check('5体目は不可',
  M.rhythmMonsterSlotAddIssue(['u-mia-1','u-pandora','u-ham','u-zan'],'u-pixie',OWNED)==='full');
check('手元にいないマスモンは設定できない',
  M.rhythmMonsterSlotAddIssue([],'u-gone',OWNED)==='missing');
check('設定できない理由には日本語の説明がある',
  ['missing','full','duplicate-id','duplicate-base'].every(key=>typeof M.RHYTHM_MONSTER_SLOT_ISSUE_TEXT[key]==='string'&&M.RHYTHM_MONSTER_SLOT_ISSUE_TEXT[key].length>0));

// ── 追加・削除・並べ替え ────────────────────────────────────────────────────
check('設定は末尾へ足す(足した順が登場順)',
  JSON.stringify(M.addRhythmMonsterSlot(['u-ham'],'u-pandora',OWNED))==='["u-ham","u-pandora"]');
check('設定できないときは並びを変えない',
  JSON.stringify(M.addRhythmMonsterSlot(['u-mia-1'],'u-mia-2',OWNED))==='["u-mia-1"]');
check('外すと詰まる',
  JSON.stringify(M.removeRhythmMonsterSlot(['u-ham','u-pandora','u-mia-1'],'u-pandora'))==='["u-ham","u-mia-1"]');
check('登場順を入れ替えられる',
  JSON.stringify(M.moveRhythmMonsterSlot(['a','b','c'],2,-1))==='["a","c","b"]'
  &&JSON.stringify(M.moveRhythmMonsterSlot(['a','b','c'],0,1))==='["b","a","c"]');
check('端を越える入れ替えは何もしない',
  JSON.stringify(M.moveRhythmMonsterSlot(['a','b'],0,-1))==='["a","b"]'
  &&JSON.stringify(M.moveRhythmMonsterSlot(['a','b'],1,1))==='["a","b"]');
check('1〜3体でも成立する(4体を必須にしない)',
  M.resolveRhythmMonsterSlots(['u-ham'],OWNED).length===1
  &&M.rhythmMonsterSlotAddIssue(['u-ham'],'u-pandora',OWNED)===null);

// ── 1曲あたりの出現回数(§3.3の配置目安) ────────────────────────────────────
check('出現の基本位置は20 / 40 / 60 / 80%',
  JSON.stringify(M.RHYTHM_MONSTER_NOTE_BASE_RATIOS)==='[0.2,0.4,0.6,0.8]');
check('設定した体数ぶんだけ目安を出す(1体につき1回・最大4回)',
  JSON.stringify(M.rhythmMonsterNoteBaseRatios(1))==='[0.2]'
  &&JSON.stringify(M.rhythmMonsterNoteBaseRatios(3))==='[0.2,0.4,0.6]'
  &&JSON.stringify(M.rhythmMonsterNoteBaseRatios(9))==='[0.2,0.4,0.6,0.8]'
  &&JSON.stringify(M.rhythmMonsterNoteBaseRatios(0))==='[]');

// ── 本体への結線 ────────────────────────────────────────────────────────────
check('専用キーへ保存する経路がある',
  /const saveRhythmMonsterSlots = async value => \{\s*\n\s*const normalized=sanitizeRhythmMonsterSlotIds\(value\); await storeSet\(RHYTHM_MONSTER_SLOT_KEY,normalized,false\);/.test(game));
check('音ゲーデバッグへ入るときに読み込む',
  /const monsterSlots=sanitizeRhythmMonsterSlotIds\(await storeGet\(RHYTHM_MONSTER_SLOT_KEY,\[\],false\)\);/.test(game));
check('保存してあるIDから、手元のマスモンを解決して使う',
  /const rhythmMonsterSlots = resolveRhythmMonsterSlots\(rhythmMonsterSlotIds, masuMons\);/.test(game));
// 設定UIは体験版ホームからも開くため、画面へ直接書かずに RhythmMonsterSlotsPanel へまとめてある。
// どちらから開いても中身が同じであること(部品が1つであること)と、
// 音ゲーデバッグ画面では設定タブの中に置かれていることを見る。
check('設定UIは1つの部品にまとまっている',
  game.includes('const RhythmMonsterSlotsPanel=')
  &&game.includes('<section data-rhythm-monster-slots')
  &&(game.match(/<section data-rhythm-monster-slots/g)||[]).length===1);
check('設定UIは音ゲーデバッグ画面の設定タブの中にある',
  /rhythmDebugTab!=='settings'[\s\S]*?<RhythmMonsterSlotsPanel /.test(game));
check('設定UIは体験版ホームからも開ける',
  /gameState==='RHYTHM_DEMO_MONSTERS'[\s\S]*?<RhythmMonsterSlotsPanel /.test(game));
check('4枠を常に並べて、空き枠が分かる',
  /Array\.from\(\{length:RHYTHM_MONSTER_SLOT_MAX\}/.test(game)&&game.includes('未設定'));
check('設定できない相手は押せないようにして、理由を出す',
  /disabled=\{!!issue\}/.test(game)&&game.includes('RHYTHM_MONSTER_SLOT_ISSUE_TEXT[issue]'));
check('マスモンの見た目は既存の染色表示を使い回す(base64で複製しない)',
  /data-rhythm-monster-slots[\s\S]*?<DyedMonsterImage baseId=\{masu\.baseId\} src=\{masuDisplayImageUrl\(base\)\}[\s\S]*?masuColors=\{getMasuColors\(masu\)\}/.test(game));
check('一覧は開いたときだけ組み立てる',
  /\{rhythmMonsterPickerOpen&&<ul data-rhythm-monster-picker/.test(game));

// ── 既存を壊していない ──────────────────────────────────────────────────────
check('既存の音ゲー保存キーはそのまま',
  game.includes("RHYTHM_SETTINGS_KEY = 'mh_rhythm_settings_v1'")
  &&game.includes("RHYTHM_BEST_RECORDS_KEY = 'mh_rhythm_best_v1'"));
// 音ゲー側からマスモン本体を書き換えない(設定は読むだけ)
const slotSection=game.match(/<section data-rhythm-monster-slots[\s\S]*?\n            <\/section>/)?.[0]||'';
const saveFn=game.match(/const saveRhythmMonsterSlots = async value => \{[\s\S]*?\n\};/)?.[0]||'';
check('設定UIと保存処理を抽出できる',!!slotSection&&!!saveFn);
check('マスモン本体の保存キーを触っていない',
  !slotSection.includes('mh_masu_mons')&&!saveFn.includes('mh_masu_mons')
  &&!slotSection.includes('setMasuMons')&&!saveFn.includes('setMasuMons'));
check('保存するのは音ゲー専用キーだけ',
  (saveFn.match(/storeSet\(/g)||[]).length===1&&saveFn.includes('storeSet(RHYTHM_MONSTER_SLOT_KEY'));
check('マスモンの情報を音ゲー側へ複製していない(IDの並びだけ保存する)',
  !/RHYTHM_MONSTER_SLOT_KEY[\s\S]{0,400}baseId:/.test(game));
const judgments=data.match(/const RHYTHM_JUDGMENTS = [\s\S]*?\n\]\);/)?.[0]||'';
check('判定窓は変更していない',
  ['windowMs:40','windowMs:75','windowMs:130','windowMs:170','windowMs:200'].every(w=>judgments.replace(/\s/g,'').includes(w)));
check('スコアの重み(判定90% / コンボ10%)は変更していない',
  /RHYTHM_SCORE_WEIGHTS\s*=\s*Object\.freeze\(\{\s*judgment:\s*\.9\s*,\s*combo:\s*\.1\s*\}\)/.test(data.replace(/\n/g,'')));
check('ライフの値は変更していない',/const RHYTHM_LIFE_MAX = 1000;/.test(data));

console.log(failed?`\n${failed}件のNGがあります`:'\nすべてOK');
process.exit(failed?1:0);

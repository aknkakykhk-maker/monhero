// 修行試作版は通常データ・チケット・ミッションから完全に分離したメモリ内デバッグセッション。
const TRAINING_MAP_ID = 'beginner_debug_v1';
const TRAINING_DIFFICULTIES = Object.freeze({
  BEGINNER:{id:'BEGINNER',label:'BEGINNER',available:true,turns:10,dice:[1,3],spaces:24,summary:'短い安全ルートと、遠回りの報酬ルートが分岐・再合流する試作マップ。'},
  EASY:{id:'EASY',label:'EASY',available:false,turns:10,dice:[1,3],spaces:28,summary:'分岐と妨害が増える予定です。説明のみ確認できます。'},
  NORMAL:{id:'NORMAL',label:'NORMAL',available:false,turns:10,dice:[1,3],spaces:32,summary:'道具の判断が重要になる予定です。説明のみ確認できます。'},
});
const TRAINING_TOOLS = Object.freeze({
 feather:{name:'加速の羽',emoji:'🪽',timing:'サイコロを振る前',mode:'消費型',desc:'次の出目に＋2'}, gale:{name:'疾風の札',emoji:'🌪️',timing:'サイコロを振る前',mode:'消費型',desc:'2回振り、高い出目を採用'}, reroll:{name:'振り直しの石',emoji:'🪨',timing:'出目の確定後・移動前',mode:'消費型',desc:'確定した出目を1回だけ振り直す'}, noReturn:{name:'戻らずのお守り',emoji:'🧿',timing:'取得後は自動待機',mode:'自動発動型',desc:'次に受ける後退効果を1回無効化して消滅'}, sand:{name:'時の砂',emoji:'⏳',timing:'移動していない時',mode:'消費型',desc:'残りターン＋1'}, fixed:{name:'確定サイコロ',emoji:'🎲',timing:'サイコロを振る前',mode:'消費型',desc:'次の出目を1・2・3から選択'}, returnCharm:{name:'帰還のお守り',emoji:'🏮',timing:'取得後は自動待機',mode:'自動発動型',desc:'ゴール失敗時、仮獲得した通常アイテムから1個選んで保護'},
});
const TRAINING_SPACE_TYPES = Object.freeze({
 start:{kind:'start',label:'スタート',emoji:'🚩',color:'#475569',desc:'修行の開始地点'}, xp30:{kind:'xp',value:30,label:'絆EXP',emoji:'💗',color:'#16a34a',desc:'仮獲得絆経験値＋30'}, xp60:{kind:'xp',value:60,label:'大EXP',emoji:'💖',color:'#15803d',desc:'仮獲得絆経験値＋60'}, gem50:{kind:'diamond',value:50,label:'ダイヤ',emoji:'💎',color:'#0891b2',desc:'仮獲得ダイヤ＋50'}, gem100:{kind:'diamond',value:100,label:'大ダイヤ',emoji:'💠',color:'#2563eb',desc:'仮獲得ダイヤ＋100'}, item:{kind:'item',value:'training_ticket',label:'アイテム',emoji:'🎁',color:'#ec4899',desc:'仮獲得通常アイテムを1個追加'}, tool:{kind:'tool',label:'修行道具',emoji:'🎒',color:'#d946ef',desc:'修行専用アイテムをランダム取得'}, forward:{kind:'move',value:1,label:'前進',emoji:'⏩',color:'#16a34a',desc:'1～3マス追加移動（停止マスだけ発動）'}, back:{kind:'move',value:-1,label:'後退',emoji:'⏪',color:'#dc2626',desc:'1～3マス戻る（停止マスだけ発動）'}, turnPlus:{kind:'turn',value:1,label:'ターン＋',emoji:'⏱️',color:'#059669',desc:'残りターン＋1'}, turnMinus:{kind:'turn',value:-1,label:'ターン－',emoji:'⚡',color:'#b91c1c',desc:'残りターン－1'}, boost:{kind:'effect',value:'boost',label:'強化',emoji:'✨',color:'#ca8a04',desc:'次回のサイコロ出目＋1'}, again:{kind:'effect',value:'again',label:'もう一度',emoji:'🔁',color:'#0d9488',desc:'ターンを消費せず再度サイコロ'}, happening:{kind:'happening',label:'ハプニング',emoji:'⁉️',color:'#9333ea',desc:'良い効果または悪い効果が発動'}, goal:{kind:'goal',label:'ゴール',emoji:'🏁',color:'#eab308',desc:'到達または通過で修行成功'},
});
// 接続先を持つ24ノード。3回分岐し、安全な短路と報酬の遠回りが再合流する。
const TRAINING_BEGINNER_NODES = Object.freeze([
 ['n0','start',8,86,['n1']],['n1','xp30',20,78,['n0','n2','n4']],['n2','turnPlus',31,66,['n1','n3']],['n3','gem50',44,58,['n2','n7']],
 ['n4','tool',19,52,['n1','n5']],['n5','gem100',29,40,['n4','n6']],['n6','item',42,37,['n5','n7']],['n7','again',53,52,['n3','n6','n8']],
 ['n8','xp60',62,65,['n7','n9','n11']],['n9','forward',72,74,['n8','n10']],['n10','boost',84,70,['n9','n14']],['n11','tool',61,42,['n8','n12']],
 ['n12','gem100',72,32,['n11','n13']],['n13','happening',85,38,['n12','n14']],['n14','xp30',91,55,['n10','n13','n15']],['n15','back',82,55,['n14','n16','n18']],
 ['n16','turnMinus',73,48,['n15','n17']],['n17','gem50',65,30,['n16','n21']],['n18','xp60',79,78,['n15','n19']],['n19','item',66,88,['n18','n20']],
 ['n20','tool',54,80,['n19','n21']],['n21','happening',49,61,['n17','n20','n22']],['n22','gem100',38,48,['n21','n23']],['n23','goal',27,34,['n22']]
].map(([id,type,x,y,next])=>Object.freeze({id,type,x,y,next:Object.freeze(next)})));
const TRAINING_NODE_BY_ID=Object.freeze(Object.fromEntries(TRAINING_BEGINNER_NODES.map(n=>[n.id,n])));
const trainingEmptyRewards=()=>({bondXp:0,diamonds:0,items:[]});
const trainingSeed=()=>Math.floor(Math.random()*2147483646)+1;
const createTrainingSession=(masuId,difficulty='BEGINNER')=>({status:'playing',masuId:String(masuId),difficulty,mapId:TRAINING_MAP_ID,seed:trainingSeed(),position:'n0',previous:null,remainingTurns:10,rewards:trainingEmptyRewards(),tools:[],effects:{},lastRoll:null,previousRoll:null,rollPending:false,branchOptions:[],movementRemaining:0,routePreview:[],stopPreview:null,forcedMoves:0,eventLog:['修行テスト開始'],message:'サイコロを振ってください'});
const trainingSpaceTiming=space=>space.kind==='goal'?'到達・通過時':space.kind==='start'?'修行開始時':'移動終了後、このマスに止まった時';
const trainingSpaceValue=space=>space.value===undefined?'ランダム':typeof space.value==='number'?`${space.value>0?'+':''}${space.value}`:String(space.value);
const settleTrainingRewards=(session,success)=>({bondXp:Math.floor(session.rewards.bondXp*(success?1:.5))+(success?100:0),diamonds:Math.floor(session.rewards.diamonds*(success?1:.5))+(success?100:0),items:success?[...session.rewards.items,'ゴール報酬']:session.effects.returnCharm&&session.rewards.items.length?[session.rewards.items[0]]:[],goalReward:success?'通常アイテム抽選1個':'なし'});
const trainingDistanceToGoal=start=>{const q=[[start,0]],seen=new Set([start]);while(q.length){const [id,d]=q.shift();if(id==='n23')return d;for(const n of TRAINING_NODE_BY_ID[id].next)if(!seen.has(n)){seen.add(n);q.push([n,d+1]);}}return '-';};

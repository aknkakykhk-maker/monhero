const BASE_ATK_EVOLUTION = [
  {mult:1.0,baseMult:1.0,crit:0.10,icon:"👊",baseGuts:16},
  {mult:1.2,baseMult:1.0,crit:0.125,icon:"⚔️",baseGuts:16},
  {mult:1.5,baseMult:1.0,crit:0.15,icon:"🔨",baseGuts:16},
  {mult:1.8,baseMult:1.0,crit:0.175,icon:"☄️",baseGuts:16},
  {mult:2.2,baseMult:1.0,crit:0.20,icon:"✨",baseGuts:16},
  {mult:2.6,baseMult:1.0,crit:0.225,icon:"🌌",baseGuts:16},
  {mult:3.1,baseMult:1.0,crit:0.25,icon:"☠️",baseGuts:16},
  {mult:3.7,baseMult:1.0,crit:0.275,icon:"🔱",baseGuts:16},
  {mult:4.5,baseMult:1.0,crit:0.30,icon:"👁️‍🗨️",baseGuts:16}
];

const GUARD_EVOLUTION = [
  {name:"ガード",       power:4.0, icon:"🛡️",guts:0},
  {name:"ハイガード",   power:6.0, icon:"🔰",guts:0},
  {name:"鉄壁ガード",   power:8.5, icon:"🏰",guts:0},
  {name:"金剛不壊",     power:11.0,icon:"💎",guts:0},
  {name:"絶対防御",     power:15.0,icon:"🌌",guts:0},
  {name:"聖域展開",     power:22.0,icon:"⛪",guts:0},
  {name:"因果遮断",     power:30.0,icon:"💠",guts:0},
  {name:"不変の真理",   power:45.0,icon:"♾️",guts:0},
  {name:"万象拒絶",     power:70.0,icon:"⛩️",guts:0}
];

const RANGE_EVOLUTION = [
  {name:"距離撃",    mult:1.4,baseMult:1.4,crit:0.10,baseGuts:20},
  {name:"強・距離撃",mult:1.6,baseMult:1.4,crit:0.125,baseGuts:20},
  {name:"極・距離撃",mult:1.9,baseMult:1.4,crit:0.15,baseGuts:20},
  {name:"真・距離撃",mult:2.2,baseMult:1.4,crit:0.175,baseGuts:20},
  {name:"超・距離撃",mult:2.6,baseMult:1.4,crit:0.20,baseGuts:20},
  {name:"銀河距離撃",mult:3.1,baseMult:1.4,crit:0.225,baseGuts:20},
  {name:"次元距離撃",mult:3.7,baseMult:1.4,crit:0.25,baseGuts:20},
  {name:"覇王距離撃",mult:4.4,baseMult:1.4,crit:0.275,baseGuts:20},
  {name:"神罰距離撃",mult:5.3,baseMult:1.4,crit:0.30,baseGuts:20}
];

const TYPE_COLORS = {
  atk:       "from-red-600 to-red-800 border-red-400 text-white",
  range_atk: "from-blue-600 to-blue-800 border-blue-400 text-white",
  unique:    "from-amber-400 to-yellow-600 border-yellow-200 text-black font-black",
  guard:     "from-emerald-600 to-emerald-800 border-emerald-400 text-white",
  weak_guard:"from-emerald-900 to-slate-800 border-emerald-700 text-emerald-200",
  buff:      "from-purple-600 to-purple-800 border-purple-400 text-white",
  debuff:    "from-indigo-600 to-indigo-800 border-indigo-400 text-white",
  heal:      "from-pink-600 to-pink-800 border-pink-400 text-white",
  draw:      "from-slate-600 to-slate-800 border-slate-400 text-white"
};

const TYPE_SOLID = { atk:'#b91c1c', range_atk:'#1d4ed8', unique:'#ca8a04', guard:'#047857', weak_guard:'#064e3b', buff:'#7e22ce', debuff:'#4338ca', heal:'#be185d', draw:'#334155' };

// カードの背景グラデーション・枠線色はTailwindのCDN即時生成(JIT)に頼ると
// 組み合わせによってまれに生成に失敗し透明のまま描画されることがあるため、
// カード本体の見た目に直結するこれらの色は全タイプJIT任せにせずinline styleで確実に反映する。
const TYPE_INLINE_STYLE = {
  atk:        { backgroundImage:'linear-gradient(to bottom, #dc2626, #991b1b)', borderColor:'#f87171', color:'#ffffff' },
  range_atk:  { backgroundImage:'linear-gradient(to bottom, #2563eb, #1e40af)', borderColor:'#60a5fa', color:'#ffffff' },
  unique:     { backgroundImage:'linear-gradient(to bottom, #fbbf24, #ca8a04)', borderColor:'#fef08a', color:'#000000' },
  guard:      { backgroundImage:'linear-gradient(to bottom, #059669, #065f46)', borderColor:'#34d399', color:'#ffffff' },
  weak_guard: { backgroundImage:'linear-gradient(to bottom, #064e3b, #1e293b)', borderColor:'#047857', color:'#a7f3d0' },
  buff:       { backgroundImage:'linear-gradient(to bottom, #9333ea, #6b21a8)', borderColor:'#c084fc', color:'#ffffff' },
  debuff:     { backgroundImage:'linear-gradient(to bottom, #4f46e5, #3730a3)', borderColor:'#818cf8', color:'#ffffff' },
  heal:       { backgroundImage:'linear-gradient(to bottom, #db2777, #9d174d)', borderColor:'#f472b6', color:'#ffffff' },
  draw:       { backgroundImage:'linear-gradient(to bottom, #475569, #1e293b)', borderColor:'#94a3b8', color:'#ffffff' }
};

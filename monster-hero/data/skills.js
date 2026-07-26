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

// ガードの軽減量は「flat(固定値) + 丈夫さ × mult(倍率)」で計算する。
// 以前は「丈夫さ × power」だけだったため、丈夫さが低いうちはほとんど軽減されず、
// 高くなると際限なく伸びて敵の攻撃を完全に無効化してしまっていた。
// 固定値を持たせたことで序盤から確実に効き、倍率の伸びを抑えたことで終盤も壊れない。
//
// ガード=200+(丈夫さ×1.1)、ハイガード=300+(丈夫さ×1.2)を基準に、
// 以降のレベルも同じ比率(固定値は1.5倍ずつ、倍率は約1.09倍ずつ)で上げている。
const GUARD_EVOLUTION = [
  {name:"ガード",       flat:200,  mult:1.10, icon:"🛡️",guts:0},
  {name:"ハイガード",   flat:300,  mult:1.20, icon:"🔰",guts:0},
  {name:"鉄壁ガード",   flat:450,  mult:1.31, icon:"🏰",guts:0},
  {name:"金剛不壊",     flat:675,  mult:1.43, icon:"💎",guts:0},
  {name:"絶対防御",     flat:1010, mult:1.56, icon:"🌌",guts:0},
  {name:"聖域展開",     flat:1520, mult:1.70, icon:"⛪",guts:0},
  {name:"因果遮断",     flat:2280, mult:1.85, icon:"💠",guts:0},
  {name:"不変の真理",   flat:3420, mult:2.02, icon:"♾️",guts:0},
  {name:"万象拒絶",     flat:5130, mult:2.21, icon:"⛩️",guts:0}
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

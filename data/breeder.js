const BREEDER_EVO_NAMES = {
  oryo: ["おりょうの力", "おりょうの気合", "おりょうの憤怒"],
  dra: ["ドラの緑膝", "ドラの黒膝臭", "ドラの毒膝地獄"],
  cadmium: ["かどみうむの計算", "かどみうむの理論", "かどみうむの叡智"],
  mua: ["みゅあの愛", "みゅあの深愛", "みゅあの慈愛"],
  atsu: ["あつの挑発", "あつの暴言", "あつの怒号"],
  myaru: ["みゃるの薬", "みゃるの怪薬", "みゃるの禁薬"]
};

const TEACHING_CARDS = [
  { id:'oryo',    baseName:"おりょうの力",    icon:"🌸", type:'buff',   subType:'atk_buff',    baseValue:0.1, step:0.1,  desc:"攻撃ステータスUP",   evoLevel:0, guts:20 },
  { id:'dra',     baseName:"ドラの緑膝",      icon:"🐉", type:'buff',   subType:'dmg_cut_buff', baseValue:0.03,step:0.03, desc:"被ダメージDOWN",     evoLevel:0, guts:20 },
  { id:'cadmium', baseName:"かどみうむの計算", icon:"🧪", type:'buff',   subType:'guts_buff',   baseValue:1.3, step:0.2,  desc:"ガッツ回復速度UP",   evoLevel:0, guts:20 },
  { id:'mua',     baseName:"みゅあの愛",      icon:"✨", type:'heal',   subType:'heal_mua',    baseValue:0.5, step:0.2,  desc:"回復＆能力永続UP",   evoLevel:0, guts:20 },
  { id:'atsu',    baseName:"あつの挑発",      icon:"🔥", type:'debuff', subType:'stun_atsu',   baseValue:1.5, step:1.5,  desc:"このターン敵行動無効＆攻撃", evoLevel:0, guts:20 },
  { id:'myaru',   baseName:"みゃるの薬",      icon:"🐈", type:'buff',   subType:'buff_myaru',  baseValue:2.0, step:0.5, selfDmg:0.5, dmgStep:0.1, desc:"次ターン攻撃2倍＆自傷", evoLevel:0, guts:20 }
];

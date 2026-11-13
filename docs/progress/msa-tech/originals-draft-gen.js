// オリジナル5種の技の案(名前はモンヒロバトルの技。性能は主血統の分布を目安に、種類ごとの持ち味でずらす)
const G=['G','F','E','D','C','B','A','S','SS'];
const MOT=JSON.parse(require('fs').readFileSync(require('path').join(__dirname,'motions.json'),'utf8'));
// 種類ごとのもとの能力(マスモンの初期値 AMG_INIT の ちから・かしこさ)
const BASE={Pandora:[135,224],Eiki:[170,85],KenshiMocchi:[170,60],Melody:[60,110],Kuromy:[160,110]};
// 動き → ちから寄り(+)/かしこさ寄り(−)の点と、根拠の言葉
const BODY={bash:[2,'体当たり'],kick:[2,'蹴り'],dash:[2,'突進'],jab:[2,'突き'],flip:[2,'宙返りで斬る'],jump:[2,'跳びかかる'],gallop:[2,'駆け寄る'],roll:[2,'転がってぶつかる'],lick:[2,'鼻で打つ'],parasol:[1,'傘で打つ'],warp:[0,'瞬間移動'],spin:[0,'回転'],
  cast:[-2,'放つ'],gather:[-2,'力をためて放つ'],float:[-2,'浮かんで放つ'],toss:[-2,'投げて飛ばす'],split:[-2,'分身して放つ']};
const FORM={slash:[1,'斬撃'],xslash:[1,'十字斬り'],claw:[1,'爪'],fist:[1,'拳'],tongue:[1,'鼻'],ray:[-1,'光線'],bolt:[-1,'雷'],arc:[-1,'光の弧'],ice:[0,'氷'],tornado:[-1,'竜巻'],thunder:[-1,'雷'],aurora:[-1,'オーロラ'],eclipse:[-1,'日食'],nightmare:[-1,'悪夢'],pillar:[-1,'光の柱'],note:[-1,'音符'],bnote:[-1,'黒音符'],heart:[-1,'ハート'],candy:[-1,'キャンディ'],cookie:[-1,'クッキー'],cake:[-1,'ケーキ'],rakkyo:[-1,'らっきょう'],berry:[-1,'ベリー'],skull:[-1,'ドクロ'],book:[-1,'恨み帳'],orb:[-1,'魔力の玉'],star:[-1,'星'],feather:[-1,'羽根'],sakura:[0,'桜'],snow:[0,'雪'],ribbon:[-1,'リボン'],petal:[0,'花びら'],blade:[1,'剣']};
const SIG={pandoraDualThunder:[-3,'光と闇の雷を放つ(専用の動き)'],eikiSakuraCombo:[3,'桜の連続斬り(専用の動き)'],kenshiTwinBlade:[3,'二刀の連続斬り(専用の動き)']};
const motionScore=(desc)=>{ if(desc.startsWith('SIG(')){const k=desc.slice(4,-1);return SIG[k]||[0,'専用の動き'];}
  const parts=desc.split(/[\/:> ]+/).filter(Boolean); let sc=0; const words=[];
  const b=BODY[parts[0]]; if(b){sc+=b[0];words.push(b[1]);}
  for(const w of parts.slice(1)){const f=FORM[w]; if(f){sc+=f[0]; if(words.length<3&&!words.includes(f[1]))words.push(f[1]);}}
  return [sc, words.join('・')]; };
const gr=(i)=>G[Math.max(0,Math.min(G.length-1,Math.round(i)))];
const SP={
 Pandora:{jp:'パンドラ',blood:'ピクシー',flavor:'光と闇の魔力。かしこさ技が主で、当たると大きいが命中はやや低め・会心が高め',dmg:+0.3,acc:-0.6,gd:0,cri:+0.8,
  n:["デュアルスラップ","ルミナスレイ","ナイトサンダー","セラフキック","アビスレイド","ホーリーライトニング","カオスメガレイ","エクリプスキッス","デュアルキッス"],
  u:["デュアルバン","セイクリッドレイ","アビスサンダー","ツインビッグバン","ダークライトニング","カオスコズミック","アストラルクロスレイ","エクリプスノヴァ","ダイスキライライ"]},
 Eiki:{jp:'エイキ',blood:'ザン',flavor:'桜と氷の速い斬撃。ちから技が主で、命中と会心が高めの代わりに一撃はやや軽め',dmg:-0.3,acc:+0.7,gd:-0.3,cri:+0.9,
  n:["桜牙","花裂き","桜風刃","花霞斬","桜月輪","桜嵐刃","千花連刃","桜閃爪","桜華絶閃爪"],
  u:["華影緋閃","氷花一閃","桜月斬華","緋雪乱刃","花氷双牙","千華氷嵐","緋桜六華閃","絶影桜華乱舞","絶華緋閃・零桜"]},
 KenshiMocchi:{jp:'剣士モッチー',blood:'モッチー',flavor:'二刀の連続攻撃。近い間合いのちから技が主で、命中が高く消費ガッツが軽め・一撃は控えめ',dmg:-0.4,acc:+0.9,gd:+0.2,cri:+0.4,gutsMul:0.9,
  n:["エッジもんた","もちき・リープ","ガッチョスラント","エアリアルもっちゃん","ガッチャー・クロス","黒桜吹雪","もっさんスピン","枝垂れクロス","バーストもっさま"],
  u:["ソニック・リープ","ホリゾンタル・スクエア","ヴォーパル・ストライク","デュアル・サーキュラー","ブラック・テンペスト","ブラック・チェイン","ナイトメア・レイド","ジ・エクリプス","スターバースト・ストリーム"]},
 Melody:{jp:'メロディー',blood:'ユグドラシル',flavor:'お菓子と音楽。ガッツダウンが得意で、相手を削って有利を作る。一撃は控えめ',dmg:-0.4,acc:+0.3,gd:+1.2,cri:-0.4,
  n:["ぞうさん頭突き","ピアノパラソル脳天撃","メロディタクトライト","ぞうさんぴろぴろ鼻","マリーランド大玉転がし","ムーンサルトメロディー","メロディキャンディボム","メロディ苺クッキー","ドリームパワー"],
  u:["メロメロハート","ピアノワルツ","リボンウィング","パウンドメテオ","ピンクバースト","キャンディレイン","マリーランドアーチ","メロディタクト","スウィートパレード"]},
 Kuromy:{jp:'クロミー',blood:'ユグドラシル',flavor:'いたずら好き。会心とガッツダウンがやや高く、命中はやや低め',dmg:+0.1,acc:-0.4,gd:+0.6,cri:+0.6,
  n:["バク頭突き","バク空中落下プレス","ブラックノートライト","バクパタパタ耳","巨大雪だるま転がし","KUROMI'S5アタック","ナイトメアらっきょうボム","バコ・ベリースプラッシュ","ダークパワー"],
  u:["ドクロボム","クロミーズ5突撃","夢くいウィング","恨み帳メテオ","黒音符バースト","らっきょう大雨","ナイトメアアーク","ダークオーロラ","悪夢フィナーレ"]},
};
// 名前の意味 → 技種・間合い・移動先
const POW=/頭突き|キック|スラップ|キッス|爪|牙|斬|刃|裂|閃|乱舞|輪|プレス|転がし|突撃|鼻|耳|リープ|スピン|クロス|スラント|ストライク|サーキュラー|スクエア|チェイン|レイド|テンペスト|エッジ|もんた|もちき|もっちゃん|ガッチャー|撃|アタック|ワルツ/;
const WISE=/レイ|ライト|サンダー|ライトニング|ビッグバン|コズミック|ノヴァ|バン$|ボム|バースト|パワー|メテオ|レイン|アーチ|オーロラ|大雨|ハート|ウィング|タクト|パレード|クッキー|吹雪|嵐|フィナーレ|ライライ|スプラッシュ|ノート/;
const NEAR=/頭突き|キック|スラップ|キッス|爪|牙|鼻|耳|プレス|エッジ|もんた|撃/;
const FAR=/レイ$|メテオ|大雨|レイン|オーロラ|コズミック|ノヴァ|アーチ|ライト$/;
const MOVE=[[/リープ|突撃|転がし|空中落下|ソニック|レイド|花霞斬|絶影/,'零'],[/ムーンサルト|ウィング/,'遠']];
// 社長が1つずつ決めた技種(台帳 2026-11-13「オリジナル5種の技種」。90技すべてを社長が確かめ、案から変えたのは黒桜吹雪・枝垂れクロス・キャンディレイン)。動きの点より優先する
const OVERRIDE={'アビスレイド':'ちから','デュアルキッス':'かしこさ','ダークライトニング':'かしこさ','桜嵐刃':'かしこさ','千華氷嵐':'かしこさ',
  'ヴォーパル・ストライク':'ちから','ブラック・テンペスト':'かしこさ','黒桜吹雪':'かしこさ','枝垂れクロス':'かしこさ','ムーンサルトメロディー':'ちから','ドリームパワー':'かしこさ','キャンディレイン':'かしこさ'};
const rows=[];
for(const [id,sp] of Object.entries(SP)){
  const list=[...sp.n.map((nm,i)=>({nm,i,u:false,mo:MOT[id].n[i]})),...sp.u.map((nm,i)=>({nm,i,u:true,mo:MOT[id].u[i]}))];
  const [bp,bw]=BASE[id]; const target=Math.round(18*bp/(bp+bw));
  list.forEach((t,k)=>{const [sc,why]=motionScore(t.mo); t.sc=sc+(k*0.001); t.why=why;});
  // 技種は動きで決める(社長 2026-11-13「オリジナル5種の技種」: 体で当てる=ちから・放つ/投げる=かしこさ。能力の比には合わせない)。
  //   迷う技(社長に1つずつ聞いて決めた10技)は OVERRIDE のとおり。動きの点が 0 で OVERRIDE にも無い技があれば止める
  const powSet=new Set(list.filter(t=>OVERRIDE[t.nm]? OVERRIDE[t.nm]==='ちから' : t.sc>0.5));
  const undecided=list.filter(t=>!OVERRIDE[t.nm] && Math.abs(t.sc)<0.5).map(t=>t.nm);
  if(undecided.length) throw new Error(`${sp.jp}: 技種が決まっていない技 ${undecided.join('・')}(社長に1つずつ聞く)`);
  const nPow=powSet.size;
  sp.ratio=`ちから ${bp}・かしこさ ${bw}(参考)→ ちから技 ${nPow}・かしこさ技 ${18-nPow}(動きで決定)`;
  for(const t of list){
    const lv=(t.u?3:0)+t.i*(t.u?0.62:0.62); // 0〜8.5(ふつうの技 0〜5・固有技 3〜8)
    const kind = powSet.has(t)?'ちから':'かしこさ';
    const why = (OVERRIDE[t.nm] ? '社長が決めた: ' : kind==='ちから'?'体で当てる: ':'放つ: ')+(t.why||'');
    const ranges = kind==='ちから' ? (NEAR.test(t.nm)?['零','近']:['近','中']) : (FAR.test(t.nm)?['中','遠']:['中','遠']);
    const range = ranges[(t.i+(t.u?1:0))%2];
    const mv = MOVE.find(([re])=>re.test(t.nm)); const moveTo = mv? mv[1] : null;
    const guts = Math.round((12 + lv*4.4) * (sp.gutsMul||1));
    const dmg = gr(Math.min(7, 1.3 + lv*0.75 + sp.dmg + (kind==='ちから'&&sp.blood==='ピクシー'?-0.4:0)));
    const acc = gr(5.2 - lv*0.28 + sp.acc + (range==='遠'?-0.4:0));
    const gdBase = /ボム|メテオ|バースト|ハート|クッキー|ワルツ|キャンディ|パレード|スプラッシュ|ノート|耳|鼻/.test(t.nm)?3.6:1.4;
    const gd = gr(gdBase + lv*0.15 + sp.gd);
    const cri = gr(2.6 + (/閃|爪|牙|刃|斬|クロス|キッス|ストライク/.test(t.nm)?1:0) + lv*0.2 + sp.cri);
    rows.push({sp:sp.jp,blood:sp.blood,nm:t.nm,src:t.u?'unique':'normal',kind,why,motion:t.mo,range,moveTo:moveTo||'',guts,dmg,acc,gd,cri});
  }
}
require('fs').writeFileSync(process.argv[2], JSON.stringify({species:Object.fromEntries(Object.entries(SP).map(([k,v])=>[k,{jp:v.jp,blood:v.blood,flavor:v.flavor,ratio:v.ratio}])),rows},null,1));
const by={};rows.forEach(r=>{by[r.sp]=by[r.sp]||{n:0,w:0,mv:0,g:[]};by[r.sp].n++;if(r.kind==='かしこさ')by[r.sp].w++;if(r.moveTo)by[r.sp].mv++;by[r.sp].g.push(r.guts)});
for(const [k,v] of Object.entries(by)) console.log(k,'技',v.n,'かしこさ',v.w,'移動',v.mv,'ガッツ',Math.min(...v.g)+'〜'+Math.max(...v.g));

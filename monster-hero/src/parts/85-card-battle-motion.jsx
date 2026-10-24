// ===== MFバトルカード: 技の動き(設計書 5-4「技と動きの対応表」) =====
// カードの技を出したら、そのモンスターの立ち絵がモンヒロのバトルと同じ動きをする(社長 台帳 #3381「モンヒロのバトルを生かせるところは生かす」)。
// 動きそのものは 24-battle-fx.jsx の SkillFxMotion(体の動き・飛ぶもの・敵に重ねる絵・当たったときの小片)をそのまま使う。
// ここで決めるのは「どのカードに、どの動きを当てるか」だけ。
//   1. モンヒロに同じ名前の技があれば、その子の動き(SKILL_MOTION_SETS)をそのまま使う
//   2. ほかは、技の名前と種類から決まった動きに当てる(下の CARD_MOTION_RULES。当て方はデータなので、1枚ずつ上書きできる: CARD_MOTION_BY_NO)
// 守り・受ける・倒れるの動き(よける・防ぐ・揺れ・倒れる)は CSS の mh-card-dodge / mh-card-guard / mh-card-hit / mh-card-ko(70-bootstrap.jsx)
const CARD_MOTION_SPECS = Object.freeze({
  cardJab:     skm('jab',   { c:'white',   over:'fist',  burst:'star' }),
  cardKick:    skm('kick',  { c:'gold',    burst:'star' }),
  cardDash:    skm('dash',  { c:'white',   burst:'dust' }),
  cardBash:    skm('bash',  { c:'white',   burst:'star' }),
  cardClaw:    skm('slash', { c:'white',   over:'claw' }),
  cardBlade:   skm('slash', { c:'sky',     over:'xslash' }),
  cardBite:    skm('bash',  { c:'red',     over:'bite' }),
  cardThrow:   skm('flip',  { c:'rock',    over:'boom',  burst:'dust' }),
  cardSpin:    skm('spin',  { c:'wind',    over:'tornado' }),
  cardThunder: skm('cast',  { c:'thunder', over:'thunder', fx:skmFx('fall', 'bolt', 3) }),
  cardFire:    skm('cast',  { c:'fire',    fx:skmFx('shot', 'fire', 3),  burst:'spark' }),
  cardIce:     skm('cast',  { c:'ice',     fx:skmFx('shot', 'ice', 3),   over:'ice' }),
  cardWater:   skm('cast',  { c:'blue',    fx:skmFx('shot', 'water', 3), burst:'water' }),
  cardKiss:    skm('lick',  { c:'pink',    line:'tongue', burst:'heart' }),
  cardSong:    skm('cast',  { c:'pink',    fx:skmFx('shot', 'note', 3),  burst:'note' }),
  cardOrb:     skm('cast',  { c:'cosmic',  fx:skmFx('shot', 'orb', 3),   burst:'spark' }),
  cardLight:   skm('float', { c:'holy',    line:'ray',   over:'pillar' }),
  cardRock:    skm('toss',  { c:'rock',    fx:skmFx('lob', 'rock', 3),   burst:'rock' }),
  cardLeaf:    skm('cast',  { c:'plant',   fx:skmFx('shot', 'leaf', 3),  burst:'leaf' }),
  cardGas:     skm('toss',  { c:'gas',     fx:skmFx('lob', 'gas', 3),    over:'gas' }),
  // 全ての相手に当たる技: 上から降らせて、波で広げる
  cardAreaFire:  skm('cast', { c:'fire',    fx:skmFx('fall', 'fire', 8),  over:'wave' }),
  cardAreaIce:   skm('cast', { c:'ice',     fx:skmFx('fall', 'snow', 8),  over:'wave' }),
  cardAreaRock:  skm('jump', { c:'rock',    fx:skmFx('rise', 'rock', 6),  over:'wave', burst:'dust' }),
  cardAreaWind:  skm('spin', { c:'wind',    over:'tornado', fx:skmFx('fall', 'feather', 6) }),
  cardAreaStar:  skm('cast', { c:'gold',    fx:skmFx('fall', 'star', 8),  over:'wave' }),
});
// 動きの表を SkillFxMotion が読む入れ物へ入れておく(skillFxSpecOf は SKILL_FX_SPEC_CACHE を先に見る)
Object.entries(CARD_MOTION_SPECS).forEach(([kind, sp]) => { SKILL_FX_SPEC_CACHE[kind] = skmNormalize(sp); });

// [名前に当たる言葉, 動き]。上から順に見て、最初に当たったものを使う
const CARD_MOTION_RULES = Object.freeze([
  [/キッス|ぺろ|なめ|ベロ|舌/, 'cardKiss'],
  [/歌|うた|ソング|音/, 'cardSong'],
  [/雷|電撃|ライトニング|サンダー|稲妻|放電/, 'cardThunder'],
  [/炎|火|ファイア|フレイム|熱|バーニング/, 'cardFire'],
  [/冷|氷|ブリザード|吹雪|凍/, 'cardIce'],
  [/水|泡|ツバ|しぶき|ウォーター/, 'cardWater'],
  [/光|聖|レーザー|ビーム|ビッグバン/, 'cardLight'],
  [/魔空|ドレイン|弾|玉|波動|念/, 'cardOrb'],
  [/毒|ガス|おなら|胞子/, 'cardGas'],
  [/葉|花|さくら|種|つる/, 'cardLeaf'],
  [/岩|石|地震|ロック/, 'cardRock'],
  [/投げ/, 'cardThrow'],
  [/回転|ぐるぐる|竜巻|スピン|旋風|まわし/, 'cardSpin'],
  [/剣|斬|まっぷたつ|Vの字|居合|カッター/, 'cardBlade'],
  [/かみ|噛|かじ/, 'cardBite'],
  [/ひっかき|爪|ツノ|クロー|突き|つき|くしざし|ヤリ|槍/, 'cardClaw'],
  [/キック|けり|蹴|ひざ/, 'cardKick'],
  [/体当たり|タックル|頭つき|突進|ダッシュ|ころがる|転がる/, 'cardDash'],
  [/パンチ|チョップ|はたき|ソバット|ビンタ|でこぴん|こぶし|殴/, 'cardJab'],
]);
// カード番号ごとの上書き(社長が見て「この技はこう動いてほしい」と言ったら、その1枚だけここに足す)
const CARD_MOTION_BY_NO = Object.freeze({});
const CARD_MOTION_GAME_ID = Object.freeze({ tiger: 'Tiger', golem: 'Golem', suezo: 'Suezo', pixie: 'Pixie', hare: 'Ham', mocchi: 'Mocchi', monol: 'Monol', plant: 'Plant' });

// そのカードの技を、その子が出すときの動き(SkillFxMotion の kind)。特殊技・ブリーダーは体を動かさない(null)
const cardMotionKindOf = (db, cardNo, mon) => {
  const c = cardOf(db, cardNo);
  if (!c || !cardIsAttackKind(c.kind) || c.kind === 'spe' || c.user === 'breeder') return null;
  if (CARD_MOTION_BY_NO[c.no]) return CARD_MOTION_BY_NO[c.no];
  // 1. モンヒロに同じ名前の技がある(スエゾーのかみつき・モッチーのもっちゃん など)
  const id = mon && (CARD_MOTION_GAME_ID[mon.species] || CARD_MOTION_GAME_ID[mon.main]);
  const names = id && typeof HERO_ATK_NAMES !== 'undefined' ? HERO_ATK_NAMES[id] : null;
  const i = Array.isArray(names) ? names.indexOf(c.name) : -1;
  const set = id && typeof SKILL_MOTION_SETS !== 'undefined' ? SKILL_MOTION_SETS[id] : null;
  if (i >= 0 && set && set.normal && set.normal[i] && set.normal[i] !== SKM_SIG && i < 10) return `${id}-n${i}`;
  // 2. 名前と種類から
  const hit = CARD_MOTION_RULES.find(([re]) => re.test(c.name));
  const base = hit ? hit[1] : (c.kind === 'int' ? 'cardOrb' : 'cardBash');
  if (cardHasEff(c, 'area')) {
    if (base === 'cardFire') return 'cardAreaFire';
    if (base === 'cardIce') return 'cardAreaIce';
    if (base === 'cardRock') return 'cardAreaRock';
    if (base === 'cardSpin') return 'cardAreaWind';
    return 'cardAreaStar';
  }
  return base;
};
// 動きの長さ(この長さのあいだ、動いている子の絵を SkillFxMotion に差しかえる)
const cardMotionMs = (kind) => {
  const sp = kind && typeof skillFxSpecOf === 'function' ? skillFxSpecOf(kind) : null;
  return sp && sp.ms ? sp.ms : 650;
};

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
  // 特殊技(設計書 5-4「特殊」): その場で光の輪・音符・目。相手を狙う特殊技は相手へ、狙わないものはその場で
  cardSpeRing:   skm('gather', { c:'holy',   over:'aurora', burst:'spark' }),
  cardSpeSong:   skm('float',  { c:'pink',   fx:skmFx('orbit', 'note', 6), burst:'note' }),
  cardSpeEye:    skm('gather', { c:'gold',   over:'eye' }),
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
// 特殊技の [名前に当たる言葉, 動き]。当たらなければ光の輪(cardSpeRing)
const CARD_SPECIAL_MOTION_RULES = Object.freeze([
  [/歌|うた|ソング|音|笛|おどり|踊/, 'cardSpeSong'],
  [/偵察|にらむ|睨|見|挑発|のぞ|ガン/, 'cardSpeEye'],
]);
// カード番号ごとの上書き(社長が見て「この技はこう動いてほしい」と言ったら、その1枚だけここに足す)
const CARD_MOTION_BY_NO = Object.freeze({});
const CARD_MOTION_GAME_ID = Object.freeze({ tiger: 'Tiger', golem: 'Golem', suezo: 'Suezo', pixie: 'Pixie', hare: 'Ham', mocchi: 'Mocchi', monol: 'Monol', plant: 'Plant' });

// そのカードの技を、その子が出すときの動き(SkillFxMotion の kind)。特殊技・ブリーダーは体を動かさない(null)
const cardMotionKindOf = (db, cardNo, mon) => {
  const c = cardOf(db, cardNo);
  if (!c || !cardIsAttackKind(c.kind) || c.user === 'breeder') return null;
  if (CARD_MOTION_BY_NO[c.no]) return CARD_MOTION_BY_NO[c.no];
  if (c.kind === 'spe') { const sp = CARD_SPECIAL_MOTION_RULES.find(([re]) => re.test(c.name)); return sp ? sp[1] : 'cardSpeRing'; }
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
// ブリーダーのカードか(モンスターは動かず、画面の端に助手・ブリーダーの顔を出す。設計書 5-4)
const cardIsBreederCard = (db, cardNo) => { const c = cardOf(db, cardNo); return !!c && c.user === 'breeder'; };
// よけ方: ジャンプ・舞い上がる・空中になるカードは、上へ跳んで止まる(空中の印つき)。ほかは横へすっと避ける
const cardDodgeIsJump = (c) => !!c && (cardHasEff(c, 'becomeAir') || /ジャンプ|舞い上が|飛び|飛ぶ|浮|空中/.test(c.name));
// 防いだときに盾の横へ出す数字(−3・半分・0)。はね返すカードは「はね返す」
const cardGuardLabel = (c) => {
  if (!c) return '';
  if (cardHasEff(c, 'reflect')) return 'はね返す';
  const r = cardEff(c, 'reduce');
  if (r && r.n) return `−${r.n}`;
  if (cardHasEff(c, 'reduceHalf')) return '半分';
  if (cardHasEff(c, 'reduceAll')) return '0';
  return '';
};
// 動きの長さ(この長さのあいだ、動いている子の絵を SkillFxMotion に差しかえる)
const cardMotionMs = (kind) => {
  const sp = kind && typeof skillFxSpecOf === 'function' ? skillFxSpecOf(kind) : null;
  return sp && sp.ms ? sp.ms : 650;
};

// ---- 動きの見本(デバッグ専用。社長に見せる動画・技の動きの確かめ用) ----
// 決まった場面で、自分の3体が順に攻め、相手はよける・防ぐ・受ける・倒れるを見せる。手で押さずに、決まった順に進む
//   ① スエゾーの「かみつき」(モンヒロに同じ名前の技がある) → ナーガが受ける
//   ② ガリの「雷」(名前から決めた動き) → モッチーが受ける
//   ③ ゴーレムの「竜巻アタック」(全ての相手に) → ライガーは「ジャンプ」で跳んでよける・モッチーは「まるまる」で防ぐ(−3)・ナーガは倒れる(カードが裏返る)
//   ④ ブリーダーの「加勢」(スエゾーで) → モンスターは動かず、まんなかの端にブリーダーの顔
//   ⑤ 相手の番: モッチーの「モッチー砲」→ ガリが「魔法反射」ではね返す(光線)
//   ⑥ 自分の番: スエゾーの「偵察」(特殊・目。その場で)
const cardMotionDemo = (db) => {
  const decks = [
    { monsters: ['C-004', 'C-002', 'C-003'], cards: Array(50).fill('100') },
    { monsters: ['C-001', 'C-009', 'C-007'], cards: Array(50).fill('100') },
  ];
  let st = cardCreateGame(db, { decks, names: ['あなた', 'みゅあ'], seed: 7, first: 0 });
  st = cardApplyAction(db, st, { type: 'setupGuts', hand: [] });
  st.players[0].hand = ['040', '018', '032', '112', '023', '045'];
  st.players[0].guts = Array(20).fill('100');
  st.players[1].hand = ['012', '106', '105'];
  st.players[1].guts = Array(20).fill('100');
  // ナーガは かみつき(6)→ 竜巻アタック(4)で倒れる。モッチーは 雷(4)→ まるまるで防いで残り、はね返されたモッチー砲で倒れる
  st.log = [{ turn: 1, text: '動きの見本(決まった順に進みます)' }];
  const steps = [
    { attack: '040', mon: 0, target: { p: 1, m: 2 } }, { pass: true },
    { attack: '018', mon: 1, target: { p: 1, m: 1 } }, { pass: true },
    { attack: '032', mon: 2 }, { guard: '012' }, { pass: true }, { guard: '106' }, { pass: true }, { pass: true },
    { attack: '112', mon: 0, target: { p: 1, m: 1 } }, { pass: true },
    { act: { type: 'endAttacks' } }, { act: { type: 'guts', hand: [] } },
    { attack: '105', mon: 1, target: { p: 0, m: 1 } }, { guard: '023' }, { pass: true },
    { act: { type: 'endAttacks' } }, { act: { type: 'guts', hand: [] } },
    { attack: '045', mon: 0 },
  ];
  return { st, steps };
};
// 見本の1手を、いまの状態で出せる操作に直す(出せなければ null)
const cardMotionDemoAction = (db, st, step) => {
  if (!step) return null;
  if (step.act) return step.act; // 番の終わり(攻撃おわり・ガッツにしない)はそのまま
  if (step.pass) return st.pending ? { type: 'pass' } : null;
  if (step.guard) {
    const q = st.pending ? st.pending.defender : -1;
    return cardGuardOptions(db, st).find((o) => st.players[q].hand[o.hand] === step.guard) || { type: 'pass' };
  }
  const me = st.players[st.active];
  return cardAttackOptions(db, st).find((o) => me.hand[o.hand[0]] === step.attack && o.mon === step.mon && o.hand.length === 1
    && JSON.stringify(o.target || null) === JSON.stringify(step.target || null)) || null;
};

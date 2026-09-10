#!/usr/bin/env node
// 図鑑の「攻撃アクション」で見せる演出が、本番バトルとまったく同じ動きになっているかを見る。
//
// 実際にあった不具合: ザン・エイキは本番だと固有技でも「共通のタメ → 残像ダッシュ(zanComboDash)」
// へ移るのに、プレビュー側だけ motion を渡す分岐へ入れてしまい specialLunge(ただの突進)になっていた。
// 見た目だけの違いなので構文検査では拾えず、遊んだ人が気づくまで分からない。
//
// 本番の分岐をここへ書き写すと、本番が変わったときに写し間違いへ気づけない。
// そこで processTurn のヒット処理ループを**そのまま切り出して動かし**、
// setAttackAnim に渡る anim を採取して、プレビューの手順と1コマずつ突き合わせる。
const fs = require('fs');
const vm = require('vm');
const babel = require('@babel/core');

const src = fs.readFileSync('monster-hero/src/game-system.jsx', 'utf8');
const ally = fs.readFileSync('monster-hero/data/ally-monsters.js', 'utf8');
let failed = 0;
const check = (label, ok, note='') => { if(!ok) failed++; console.log(`${ok?'OK':'NG'}: ${label}${note?` — ${note}`:''}`); };

// --- 本番バトルのヒット処理ループを切り出す ---
const LOOP_HEAD = '        while (hitIdx < attackHits.length) {';
const LOOP_TAIL = '          hitIdx++;\n        }';
const start = src.indexOf(LOOP_HEAD);
const end = start >= 0 ? src.indexOf(LOOP_TAIL, start) : -1;
check('本番バトルのヒット処理ループを切り出せる', start >= 0 && end > start,
  start >= 0 && end > start ? '' : 'processTurn の while ループの目印が変わっています。この検査の切り出し位置を直してください');
if (start < 0 || end <= start) { console.log('\n1件のNGがあります'); process.exit(1); }
const battleLoop = src.slice(start, end) + LOOP_TAIL;

// --- プレビュー側の手順 ---
const ctx = { WATER_BURST_MOTION_MS:680, ARK_HOLY_RAIN_MOTION_MS:900, MIA_SONG_NOTES_MOTION_MS:760 };
vm.createContext(ctx);
vm.runInContext(src.slice(src.indexOf('const attackMotionAnimation ='), src.indexOf('const rpgMotionName ='))
  + '\nglobalThis.__p={attackMotionAnimation,attackMotionPreviewSequence,attackMotionUniquePreviewSequence};', ctx);
const { attackMotionAnimation:animOf, attackMotionPreviewSequence:normalSeq, attackMotionUniquePreviewSequence:uniqueSeq } = ctx.__p;

// 本番のループを1体ぶんだけ流し、setAttackAnim へ渡った anim を順に集める。
// 表示・音・待ち時間はスタブにする(戦闘の計算には触らない)
const battleAnims = (atkMotion, isUnique) => {
  const anims = [];
  const monId = 'TestMon';
  const env = {
    ALL_PLAYER_MONSTERS: { [monId]: { id:monId, atkMotion } },
    slots: [{ id:monId, atkMotion, name:'テスト', imgUrl:'x' }, null, null, null],
    fallbackSlot: 0,
    hitIdx: 0,
    attackHits: [{ slotIdx:0, monId, isUnique, isSpecial:false, isCrit:false, skillName:isUnique?'固有技':'こうげき', dmg:100 }],
    totalDmg: 100, multiHit: false,
    setAttackAnim: (a) => { if(a) anims.push({...a}); },
    setSlotSkill: ()=>{}, setEnemy: ()=>{}, setEnemyDist: ()=>{}, syncAtkTierForDist: ()=>{},
    addPopup: ()=>{}, triggerShake: ()=>{}, battleWait: async()=>{},
    Audio_: { se: new Proxy({}, { get: () => () => {} }) },
    RANGE_LABELS: ['零','近','中','遠'],
    WATER_BURST_MOTION_MS:680, ARK_HOLY_RAIN_MOTION_MS:900, MIA_SONG_NOTES_MOTION_MS:760,
  };
  vm.createContext(env);
  vm.runInContext(babel.transformSync(`(async()=>{\n${battleLoop}\n})().then(()=>{globalThis.__done=true;},e=>{globalThis.__err=e;});`).code, env);
  return new Promise((resolve, reject) => setImmediate(() => env.__err ? reject(env.__err) : resolve(anims)));
};

// 専用コンポーネント(パンドラ・アーク・水・ミーア)は枠を動かさないので undefined が正解。
// 見分けが付くよう印を付けてから比べる
const shape = (anim) => animOf(anim) || `専用演出(${anim.motion||'-'})`;

(async () => {
  const kinds = [...new Set([...ally.matchAll(/atkMotion:'([A-Za-z]+)'/g)].map(m => m[1]))].sort();
  check('本編のatkMotionを全種そろえて比べている', kinds.length >= 8, kinds.join(' / '));

  for (const kind of kinds) {
    for (const [isUnique, label] of [[false,'通常攻撃'],[true,'固有技']]) {
      const real = (await battleAnims(kind, isUnique)).map(shape);
      const prev = (isUnique ? uniqueSeq(kind) : normalSeq(kind)).map(step => shape(step.anim));
      const same = JSON.stringify(real) === JSON.stringify(prev);
      check(`${kind}: ${label}がバトルと同じ動き`, same,
        same ? '' : `本番 ${JSON.stringify(real)} / プレビュー ${JSON.stringify(prev)}`);
    }
  }

  // 本番の固有技は必ず共通のタメから始まる(PR #1222で直した順番)。プレビューも同じ
  for (const kind of kinds) {
    const real = await battleAnims(kind, true);
    check(`${kind}: 固有技はバトルもプレビューも共通のタメから始まる`,
      real[0]?.charge === true && uniqueSeq(kind)[0]?.anim?.charge === true && uniqueSeq(kind)[0]?.ms === 650);
  }
  check('通常攻撃のプレビューにはタメを入れない',
    kinds.every(kind => normalSeq(kind).every(step => step.anim?.charge !== true)));
  check('どの手順も1コマずつ時間が入っている',
    kinds.every(kind => [...normalSeq(kind), ...uniqueSeq(kind)].every(step => Number(step.ms) > 0)));

  console.log(failed ? `\n${failed}件のNGがあります` : '\nすべてOK');
  process.exit(failed ? 1 : 0);
})().catch(e => { console.error('検査を動かせませんでした:', e.message); process.exit(1); });

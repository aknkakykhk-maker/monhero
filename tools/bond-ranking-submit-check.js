// 絆Lvランキングへ「そのプレイの絆Lvがちゃんと載るか」を確認する。
//
// 絆Lvランキングは、ランキングの記録に入っている party[].bondLevel を集計している。
// つまり載るかどうかは集計側ではなく「送るときに bondLevel を入れているか」で決まる。
//
// 実際に次の2つで載らなくなっていた。
//   ① 勇者モンにベースモンを選んだランは、party 全員の bondLevel が null になり1件も載らない
//      (リザルトでマスモン登録しても、登録はスコア送信より後なのでその記録には入らない)
//   ② マスモンで遊んだランでも、送っていたのは「そのランの絆経験値が入る前」の絆Lv。
//      setMasuMons の反映が非同期なのに、送信側が state を直接読んでいたため1ラン遅れていた
// どちらも例外にならず、画面上も「なんとなく載っていない」としか分からないので機械的に見る。
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'monster-hero/src/game-system.jsx'), 'utf8');
const compiled = fs.readFileSync(path.join(root, 'monster-hero/game-system.compiled.js'), 'utf8')
  .replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));

let failed = 0;
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failed++;
};

// ===== 1. 送るときの作り =====
const submitFrom = source.indexOf('const submitLocalScore');
const submitBody = submitFrom > 0 ? source.slice(submitFrom, source.indexOf('const persistRankingScore', submitFrom) > submitFrom
  ? source.indexOf('const persistRankingScore', submitFrom) : submitFrom + 4000) : '';
check('スコア送信の実装を取り出せる', submitBody.length > 0);

check('マスモンは報酬を配ったあとの個体を見る',
  /const masuForRanking = \(masuId\) => \(postRunMasuMonsRef\.current/.test(submitBody));
check('絆Lvは加算後の個体から出す', /masu \? masuBondLevelInfo\(masu\)\.level/.test(submitBody));
check('加算前のstateを直接読む形に戻っていない',
  !/bondLevel:\s*s\.masuId\s*\?\s*getMasuBondLevel\(/.test(submitBody));
check('育て方(detail)も加算後の個体から作る',
  /const detail = masu \? rankingMasuDetail\(masu\) : null/.test(submitBody)
  && !/rankingMasuDetail\(getMasuMon\(/.test(submitBody));
check('まだマスモンでない勇者モンの絆Lvも送る',
  /index === heroSlotIndex \? runHeroBondLevelRef\.current : null/.test(submitBody));
check('供モンのベースモンには絆Lvを付けない(絆の概念が無いため)',
  /: \(index === heroSlotIndex \? runHeroBondLevelRef\.current : null\)/.test(submitBody));

// ===== 2. 報酬を配る側 =====
const awardFrom = source.indexOf('const awardRunRewards');
const awardBody = awardFrom > 0 ? source.slice(awardFrom, source.indexOf('const SKIP_WAVES', awardFrom)) : '';
check('報酬付与の実装を取り出せる', awardBody.length > 0);
check('加算後のマスモンをその場で作って残す',
  /postRunMasuMonsRef\.current = next/.test(awardBody) && /masuMonsRef\.current = next/.test(awardBody));
check('保存とstate更新も同じ配列で行う',
  /setMasuMons\(next\)/.test(awardBody) && /storeSet\('mh_masu_mons', next, false\)/.test(awardBody));
check('勇者モンがマスモンでないときだけ、このランの絆Lvを残す',
  /runHeroBondLevelRef\.current = \(heroBondGain && heroBondGain\.masuId == null && heroBondGain\.xpGain > 0\)/.test(awardBody));
check('前のランの値が残らないよう配りはじめに空にする',
  /rewardsAwardedRef\.current = true;[\s\S]{0,300}postRunMasuMonsRef\.current = null;[\s\S]{0,120}runHeroBondLevelRef\.current = null;/.test(awardBody));
// WAVEを1つもクリアできなかったランで早期に戻る前に消していること
check('1WAVEも勝てなかったランでも前回の値を持ち越さない',
  awardBody.indexOf('postRunMasuMonsRef.current = null') < awardBody.indexOf('if (wavesCleared <= 0)'),
  `消す位置=${awardBody.indexOf('postRunMasuMonsRef.current = null')} / 早期return=${awardBody.indexOf('if (wavesCleared <= 0)')}`);
// 報酬付与はスコア送信より先に走ること(3つの終わり方すべて)
const orderOk = ['awardRunRewards', 'submitRunScoreOnce'];
const awardCalls = [...source.matchAll(/await awardRunRewards\(/g)].map(m => m.index);
const submitCalls = [...source.matchAll(/await submitRunScoreOnce\(\)/g)].map(m => m.index);
check('終わり方3通りとも報酬付与→スコア送信の順',
  awardCalls.length === 3 && submitCalls.length === 3
  && submitCalls.every((pos, i) => awardCalls[i] < pos),
  `付与${awardCalls.length}か所 / 送信${submitCalls.length}か所`);

// ===== 2.5. 諦めた(リタイア)ときも同じ経路を通るか =====
// 「クリアしたときだけ絆Lvが載る」ようになっていないことを確かめる。
// クリア・敗北・リタイアはどれも awardRunRewards → submitRunScoreOnce を通り、
// 違うのは渡すクリアWAVE数だけ(クリアは10、敗北とリタイアは wave-1)
const giveUpFrom = source.indexOf('const handleGiveUp');
const giveUpBody = giveUpFrom > 0 ? source.slice(giveUpFrom, source.indexOf('const handleRetry', giveUpFrom)) : '';
check('リタイアの実装を取り出せる', giveUpBody.length > 0);
check('リタイアでも報酬付与→スコア送信を通る',
  /await awardRunRewards\(Math\.max\(0, wave - 1\)\)/.test(giveUpBody) && /await submitRunScoreOnce\(\)/.test(giveUpBody));
check('リタイア専用の送信経路を作っていない',
  !/submitLocalScore\(/.test(giveUpBody) && !/rankingMasuDetail\(/.test(giveUpBody));
check('クリアしたときだけ走る絆・ランキング処理が無い',
  !/bondLevel|rankingMasuDetail|submitLocalScore/.test(source.slice(source.indexOf('const recordClearOnce'), source.indexOf('const recordClearOnce') + 1400)));
// クリアWAVEが0のラン(WAVE1で諦めた等)では絆経験値を配らないので postRunMasuMonsRef は空になる。
// そのとき今のマスモンへ落ちないと、諦めたランだけ絆Lvが送られなくなる
check('絆経験値が入らないランでも今のマスモンへ落とす',
  /postRunMasuMonsRef\.current \|\| masuMonsRef\.current \|\| masuMons/.test(submitBody));

// ===== 2.7. 取得の並び順と件数 =====
// 絆Lvは「新しい記録」を見て集計する。以前は order=id.desc だけを使っていたが、
// rankings.id が uuid だと id.desc は作成順にならず、毎回ばらばらの記録を拾ってしまう。
// スコアは score.desc、ブリーダーLvは level.desc なので影響が無く、絆Lvだけが
// 「プレイしても更新されない」ように見えていた
check('絆Lvの取得は記録時刻で並べる',
  /const BOND_RANKING_ORDERS = \['created_at\.desc\.nullslast', 'id\.desc'\];/.test(source));
check('絆Lvの取得が id.desc だけに戻っていない',
  !/levelKind === 'bond' \? 'id\.desc'/.test(source));
check('並べ方が使えない環境では順に試して落とす',
  /for \(const order of orders\)[\s\S]{0,400}sbFetchRankings\(null, levelLimit, order/.test(source));
const limitMatch = source.match(/const RANKING_LEVEL_FETCH_LIMIT = (\d+);/);
check('絆Lvの取得枠が狭すぎない', limitMatch && Number(limitMatch[1]) >= 100, limitMatch ? `${limitMatch[1]}件` : '見つからない');
check('絆Lvだけ編成(party)を取る', /levelKind === 'bond' \? RANKING_SELECT_FULL : RANKING_SELECT_NO_PARTY/.test(source));

// ===== 3. 集計側は送った値をそのまま拾えるか =====
// collectBondRankingEntries を取り出して、実際の記録の形で通す
const from = source.indexOf('const collectBondRankingEntries');
const to = source.indexOf('\nconst ', from + 10);
const ctx = { ALL_PLAYER_MONSTERS: { Golem: { name: 'ゴーレム', emoji: '🗿' }, Suezo: { name: 'スエゾー', emoji: '👁️' } } };
vm.createContext(ctx);
vm.runInContext(`${source.slice(from, to)}\n;globalThis.collect = collectBondRankingEntries;`, ctx);

// ① マスモンで遊んだラン
const withMasu = ctx.collect({ Normal: [{ userName: 'A', party: [
  { role: 'hero', id: 'Golem', baseId: 'Golem', masuId: 'm1', name: 'ゴーレム', bondLevel: 12 }, null, null, null] }] });
check('マスモンで遊んだランが絆Lvランキングに載る', withMasu.length === 1 && withMasu[0].bondLevel === 12,
  JSON.stringify(withMasu.map(e => `${e.monName}:${e.bondLevel}`)));

// ② ベースモンの勇者モンで遊んだラン(masuIdは無いがbondLevelはある)
const withoutMasu = ctx.collect({ Normal: [{ userName: 'A', party: [
  { role: 'hero', id: 'Golem', baseId: 'Golem', masuId: null, name: 'ゴーレム', bondLevel: 5 }, null, null, null] }] });
check('ベースモンの勇者モンで遊んだランも絆Lvランキングに載る',
  withoutMasu.length === 1 && withoutMasu[0].bondLevel === 5,
  JSON.stringify(withoutMasu.map(e => `${e.monName}:${e.bondLevel}`)));

// ③ 絆Lvが無い供モン(ベースモン)は載らない
const allyBase = ctx.collect({ Normal: [{ userName: 'A', party: [
  { role: 'hero', id: 'Golem', baseId: 'Golem', masuId: 'm1', name: 'ゴーレム', bondLevel: 12 },
  { role: 'ally', id: 'Suezo', baseId: 'Suezo', masuId: null, name: 'スエゾー', bondLevel: null }, null, null] }] });
check('絆Lvを持たない供モンのベースモンは載らない', allyBase.length === 1 && allyBase[0].monName === 'ゴーレム');

// ④ 同じ人・同じ種で、登録後(masuIdあり)の記録があれば古いほうへ寄せる
const mixed = ctx.collect({ Normal: [
  { userName: 'A', party: [{ role: 'hero', id: 'Golem', baseId: 'Golem', masuId: null, name: 'ゴーレム', bondLevel: 5 }] },
  { userName: 'A', party: [{ role: 'hero', id: 'Golem', baseId: 'Golem', masuId: 'm1', name: 'ゴーレム', bondLevel: 18 }] },
] });
check('登録前の記録と登録後の記録が二重に並ばない', mixed.length === 1 && mixed[0].bondLevel === 18,
  JSON.stringify(mixed.map(e => `${e.masuId}:${e.bondLevel}`)));

// ===== 4. 配信用JSにも同じ作りが入っているか =====
check('配信用JS: 加算後の個体を見る', /postRunMasuMonsRef\.current \|\| masuMonsRef\.current/.test(compiled));
check('配信用JS: まだマスモンでない勇者モンの絆Lvも送る', /runHeroBondLevelRef\.current/.test(compiled));

console.log(failed ? `\n${failed}件のNGがあります` : '\nすべてOK');
process.exit(failed ? 1 : 0);

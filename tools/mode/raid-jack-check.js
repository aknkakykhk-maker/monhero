// イベント・レイドボス「ジャック」の定義(35-raid-jack.jsx)を確かめる。正本: docs/spec/RAID_BOSS_JACK.md
//
// 見るもの(本物の定義をNodeで動かす)
//   ① A/Bの5段階の名前・倍率・ライフ(35,000×倍率×10)・技の本数(3/4/5/5/5)が設計書どおり
//   ② 期間は見るたびに数え直す(前・中・後)。回数は毎日5:00(JST)で戻る
//   ③ 保存データの正規化(無い・壊れている → 既定値)と、新しい保存キーだけを使う
//   ④ 段階式の解放(前の段階を倒すと次が開く)
//   ⑤ 公開フラグが偽のまま(公開前に出ない)
const fs = require('fs');
const vm = require('vm');
const path = require('path');
const ROOT = path.join(__dirname, '..', '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
let failed = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`); if (!ok) failed++; };

// 開始日時は 17-release-changelog-login-missions.jsx(更新履歴の公開判定)と 35-raid-jack.jsx の2か所にある。食い違うと、更新履歴だけ出ない・出すぎる
{
  const a = /RAID_JACK_START_AT = '([^']+)'/.exec(read('monster-hero/src/parts/17-release-changelog-login-missions.jsx'));
  const b = /startAt: '([^']+)'/.exec(read('monster-hero/src/parts/35-raid-jack.jsx'));
  console.log(`${a && b && a[1] === b[1] ? 'OK' : 'NG'}: 開始日時が 17(RAID_JACK_START_AT)と 35(RAID_JACK_EVENT.startAt)で同じ — ${a && a[1]} / ${b && b[1]}`);
  if (!(a && b && a[1] === b[1])) process.exitCode = 1;
}
const src = read('monster-hero/src/parts/35-raid-jack.jsx');
const ctx = { console, Object, Number, Math, Array, JSON, String, Boolean, Date, isNaN };
vm.createContext(ctx);
vm.runInContext(`${src}\nthis.o={raidJackRhythmDamage,raidJackRhythmDamageOf,RAID_JACK_RHYTHM_DAMAGE_MAX,RAID_JACK_PUMPKIN,raidJackBossDown,raidJackMakeEnemy,RAID_JACK_PUMPKIN_ART_SCALE,RAID_JACK_A_TIERS,RAID_JACK_B_TIERS,RAID_JACK_EVENT,RAID_JACK_STORAGE_KEY,RAID_JACK_ACTION_IDS,RAID_JACK_SKILL_NAMES,raidJackWindowAt,raidJackQuickLoops,RAID_JACK_QUICK_LOOPS_PER_TURN,raidJackGrowthAt,RAID_JACK_LEVEL_UP_TURNS,RAID_JACK_UNIQUE_LEVEL_STEP,RAID_JACK_TEACHING_MAX_LEVEL,raidJackDayKey,raidJackNormalizeState,raidJackDefaultState,raidJackRemaining,raidJackUnlockedCount,raidJackTierAt};`, ctx);
const o = ctx.o;

// ① 段階
const aWant = [['ジャック男爵', 1750000, 3], ['ジャック子爵', 3200000, 4], ['ジャック伯爵', 8000000, 5], ['ジャック公爵', 35000000, 5], ['ジャック大王', 80000000, 5]];
const bWant = [['初級ジャック', 70000, 3], ['中級ジャック', 700000, 4], ['上級ジャック', 3500000, 5], ['超級ジャック', 14000000, 5], ['極級ジャック', 35000000, 5]];
aWant.forEach(([n, hp, ac], i) => { const t = o.RAID_JACK_A_TIERS[i]; check(`A${i + 1} ${n}`, t.name === n && t.hp === hp && t.actionCount === ac, `hp=${t.hp} 技=${t.actionCount}`); });
bWant.forEach(([n, hp, ac], i) => { const t = o.RAID_JACK_B_TIERS[i]; check(`B${i + 1} ${n}`, t.name === n && t.hp === hp && t.actionCount === ac, `hp=${t.hp} 技=${t.actionCount}`); });
// ライフは段階ごとの設定値(2026-10-05・ユーザーが決めた)。倍率 power は hp ÷ 350,000 に合わせてある(Bは今までどおり 35,000×倍率×10)
check('A のライフは 175万 / 320万 / 800万 / 3,500万 / 8,000万(ユーザーが段階ごとに決めた値。伯爵・公爵・大王は2026-10-05に引き上げ)。段階が上がるほど増える', o.RAID_JACK_A_TIERS.map((t) => t.hp).join() === '1750000,3200000,8000000,35000000,80000000' && o.RAID_JACK_A_TIERS.every((t, i, a) => i === 0 || t.hp > a[i - 1].hp));
// モンヒロビート挑戦(2026-10-06・ユーザー指示)。換算は暫定(ユーザー「順に検討」)なので、ここでは形だけ見る(式を変えたらここも直す)
check('モンヒロビート挑戦: ダメージの上限は難易度ごと(EASY 12万 / NORMAL 16.5万 / HARD 21万 / EXPERT 25.5万 / MASTER 30万)。どんなに高くても30万',
  JSON.stringify(Object.values(o.RAID_JACK_RHYTHM_DAMAGE_MAX)) === JSON.stringify([120000, 165000, 210000, 255000, 300000]) && Math.max(...Object.values(o.RAID_JACK_RHYTHM_DAMAGE_MAX)) === 300000);
{
  const d = o.raidJackRhythmDamage;
  const full = (id, max) => d({ score: max, maxCombo: 500, totalNotes: 500, difficultyId: id });
  check('モンヒロビート挑戦: 満点・フルコンボなら、その難易度の上限(MASTER は 30万)', full('EASY', 600000) === 120000 && full('NORMAL', 700000) === 165000 && full('HARD', 800000) === 210000 && full('EXPERT', 900000) === 255000 && full('MASTER', 1000000) === 300000);
  check('モンヒロビート挑戦: スコアの割合 0.7 + コンボの割合 0.3(MASTER でスコア半分・コンボ半分 → 15万 / スコアだけ満点 → 21万 / コンボだけ満点 → 9万)',
    d({ score: 500000, maxCombo: 250, totalNotes: 500, difficultyId: 'MASTER' }) === 150000 && d({ score: 1000000, maxCombo: 0, totalNotes: 500, difficultyId: 'MASTER' }) === 210000 && d({ score: 0, maxCombo: 500, totalNotes: 500, difficultyId: 'MASTER' }) === 90000);
  check('モンヒロビート挑戦: 同じ内容でも難易度が低いほど少ない(EASY < NORMAL < HARD < EXPERT < MASTER)',
    ['EASY', 'NORMAL', 'HARD', 'EXPERT', 'MASTER'].map((id) => d({ score: 480000, maxCombo: 300, totalNotes: 500, difficultyId: id })).every((v, i, a) => i === 0 || v > a[i - 1]));
  check('モンヒロビート挑戦: 上限を超えない(スコアやコンボが範囲外でも30万まで)・不正な値・アシストモードは0',
    d({ score: 9e9, maxCombo: 9e9, totalNotes: 10, difficultyId: 'MASTER' }) === 300000 && d({ score: 1000000, maxCombo: 500, totalNotes: 500, difficultyId: 'MASTER', assist: true }) === 0
    && d({ score: 'abc', maxCombo: NaN, totalNotes: 0, difficultyId: 'MASTER' }) === 0 && d({ score: 500000, maxCombo: 5, totalNotes: 10, difficultyId: 'UNKNOWN' }) === 0 && d(null) === 0 && d(undefined) === 0);
  const r = { score: 900000, maxCombo: 420, judgments: { MARVELOUS: 300, EXCELLENT: 100, GOOD: 70, MISS: 30 } };   // ノーツ500
  check('モンヒロビート挑戦: 演奏の結果から出す(ノーツの数は判定の合計・満点は難易度のもの)', o.raidJackRhythmDamageOf(r, { id: 'MASTER', maxScore: 1000000 }) === Math.floor(300000 * (0.7 * 0.9 + 0.3 * 0.84)) && o.raidJackRhythmDamageOf({ ...r, assist: true }, { id: 'MASTER', maxScore: 1000000 }) === 0);
}
{
  const appSrc = read('monster-hero/src/parts/60-app.jsx');
  check('モンヒロビート挑戦: 演奏の完了は from===\'raid\' で専用の処理だけを通り、自己ベスト・ランキング・周回の報酬へ進まない(return で抜ける)',
    /if\(rhythmPlay\.from==='raid'\)\{void completeRaidJackRhythm\([^)]*\);return;\}/.test(appSrc) && /const completeRaidJackRhythm = async[\s\S]{0,1400}run\.promise = finishRaidJackRhythm\(/.test(appSrc));
  check('モンヒロビート挑戦: 回数はバトルと同じもの(state.a の used / extra・raidJackRemaining)を使い、始めた時点で1回使う',
    /const startRaidJackRhythmPlay = async[\s\S]{0,900}raidJackRemaining\(side, nowMs\) <= 0[\s\S]{0,200}side\.used \+= 1;/.test(appSrc));
  check('モンヒロビート挑戦: 送る先はバトルと同じ表(kind:\'a\'・段階は tierIndex+1)', /const hit = \{ hitId: run\.hitId, kind: 'a', tier: run\.tierIndex \+ 1, damage, defeated \};/.test(appSrc));
}
check('A の倍率 power は hp ÷ 350,000(男爵は 5)', o.RAID_JACK_A_TIERS.every((t) => Math.abs(t.power - t.hp / 350000) < 1e-9) && o.RAID_JACK_A_TIERS[0].power === 5);
// ①-2 大王を倒したあとの「ぱんぷきん」(2026-10-05・ユーザー指示: ライフは設定・毎回ぜんかい / 攻撃力は 700(はじめは子爵と同じ。子爵を 500 に決め直したあとも 700 のまま) / 技名はそのまま)
{
  const p = o.RAID_JACK_PUMPKIN;
  const tier5 = o.RAID_JACK_A_TIERS[4], tier2 = o.RAID_JACK_A_TIERS[1];
  check('ぱんぷきん: 名前は「ぱんぷきん」、ライフは 4,550,000(大王のライフとは連動しない)、技は5本', p.name === 'ぱんぷきん' && p.hp === 4550000 && p.hp !== tier5.hp && p.actionCount === 5, `hp=${p.hp}`);
  check('ぱんぷきん: 攻撃力は 700(子爵の値とは連動しない)', p.atk === 700, `atk=${p.atk} / 子爵 ${tier2.atk}`);
  const totals = (n) => ({ a: { 5: { total: n } } });
  check('大王を倒したか: 共有の合計が大王のライフ以上', o.raidJackBossDown(totals(tier5.hp)) === true && o.raidJackBossDown(totals(tier5.hp - 1)) === false && o.raidJackBossDown(null) === false && o.raidJackBossDown({ a: {} }) === false);
  check('技の名前は今までのまま(ぱんぷきんでも変えない)', Object.keys(o.RAID_JACK_SKILL_NAMES).length === 7 && o.RAID_JACK_SKILL_NAMES.normal === 'カボチャ張り手' && o.RAID_JACK_SKILL_NAMES.allout === 'おばけパレード');
  // 敵を作る(createBattleEnemy は別の部品なので、中身だけ仮に渡す)
  const c2 = { ...ctx, createBattleEnemy: () => ({ id: 'Jack', name: 'カボチャの大王', imgUrl: 'jack.png', poseImgUrl: 'pose.png', hp: 1, maxHp: 1, atk: 1 }), PUMPKIN_ICON_IMG: 'pumpkin.png' };
  vm.createContext(c2);
  vm.runInContext(`${src}\nthis.mk=raidJackMakeEnemy;`, c2);
  const e5 = c2.mk('a', 4, 'raidJackA', { pumpkin: true });
  const jack5 = c2.mk('a', 4, 'raidJackA');
  check('ぱんぷきんの敵: 名前・攻撃力・ライフ・絵(ポーズ絵なし)・id はジャックのまま', e5.name === 'ぱんぷきん' && e5.atk === 700 && e5.hp === 4550000 && e5.maxHp === 4550000 && e5.imgUrl === 'pumpkin.png' && e5.poseImgUrl === null && e5.raidJackPumpkin === true && e5.id === 'Jack' && e5.raidJackTier === 'a5');
  check('ぱんぷきんにならない: 大王(ふつう)・大王以外の段階・グランドスラム', jack5.name === 'ジャック大王' && jack5.atk === tier5.atk && !jack5.raidJackPumpkin
    && !c2.mk('a', 1, 'raidJackA', { pumpkin: true }).raidJackPumpkin && !c2.mk('b', 4, 'raidJackB', { pumpkin: true }).raidJackPumpkin);
  check('ぱんぷきんの絵は、ジャックの通常絵(0.5)より小さい', o.RAID_JACK_PUMPKIN_ART_SCALE < 0.5 && o.RAID_JACK_PUMPKIN_ART_SCALE > 0.2);
}
// レイドバトルの攻撃力は、2026-10-04 は通常バトルの Easy〜Master と同じ倍率だったが、2026-10-05 にユーザーが段階ごとに決め直した(350/500/600/800/1,000)
check('A の攻撃力は 男爵350 / 子爵500 / 伯爵600 / 公爵800 / 大王1,000(ユーザーが段階ごとに決めた値)。倍率は基礎700で割った値', o.RAID_JACK_A_TIERS.map((t) => t.atk).join() === '350,500,600,800,1000' && o.RAID_JACK_A_TIERS.every((t) => Math.abs(t.atkPower * 700 - t.atk) < 1e-6), o.RAID_JACK_A_TIERS.map((t) => `${t.atkPower}/${t.atk}`).join());
check('A の攻撃力は段階が上がるほど増える', o.RAID_JACK_A_TIERS.every((t, i, a) => i === 0 || t.atk > a[i - 1].atk));
check('ぱんぷきんの攻撃力は 700(子爵の値を変えても連動しない)', o.RAID_JACK_PUMPKIN.atk === 700 && o.RAID_JACK_PUMPKIN.atkPower === 1);
check('B の攻撃力は変えない(段階の power のまま)', o.RAID_JACK_B_TIERS.every((t) => t.atkPower === t.power && t.atk === Math.round(700 * t.power)));
check('B の倍率は 0.2/2/10/40/100', o.RAID_JACK_B_TIERS.map((t) => t.power).join() === '0.2,2,10,40,100');
check('技に「再生」が無い', !o.RAID_JACK_ACTION_IDS.includes('regen') && o.RAID_JACK_ACTION_IDS.length === 5);
check('技名がそろっている', ['normal', 'special', 'sweep', 'rush', 'pierce', 'roar', 'allout'].every((k) => typeof o.RAID_JACK_SKILL_NAMES[k] === 'string' && o.RAID_JACK_SKILL_NAMES[k].length >= 5));

// ② 期間と回数
const t = (s) => Date.parse(s);
check('開始前は before(開始は公開日時の 2026-10-05 4:00)', o.raidJackWindowAt(t('2026-10-05T03:59:59+09:00')) === 'before' && o.raidJackWindowAt(t('2026-10-05T04:00:00+09:00')) === 'open');
check('期間中は open', o.raidJackWindowAt(t('2026-10-20T12:00:00+09:00')) === 'open');
check('終了後は after', o.raidJackWindowAt(t('2026-11-01T04:00:00+09:00')) === 'after');
check('5:00前は前日扱い', o.raidJackDayKey(t('2026-10-20T04:59:00+09:00')) === '2026-10-19');
check('5:00から翌日', o.raidJackDayKey(t('2026-10-20T05:00:00+09:00')) === '2026-10-20');
const day = '2026-10-20';
check('無料は1日3回', o.raidJackRemaining({ day, used: 0, extra: 0 }, t('2026-10-20T12:00:00+09:00')) === 3);
check('使った分だけ減る', o.raidJackRemaining({ day, used: 2, extra: 0 }, t('2026-10-20T12:00:00+09:00')) === 1);
check('買い足した分が増える', o.raidJackRemaining({ day, used: 3, extra: 2 }, t('2026-10-20T12:00:00+09:00')) === 2);
check('日が変わると戻る', o.raidJackRemaining({ day, used: 3, extra: 2 }, t('2026-10-21T06:00:00+09:00')) === 3);

// ③ 保存の正規化
const bad = o.raidJackNormalizeState('こわれた');
check('壊れた保存は既定値', JSON.stringify(bad) === JSON.stringify(o.raidJackDefaultState()));
const odd = o.raidJackNormalizeState({ a: { used: -1, extra: 'x', defeated: ['a1', 3] }, b: { total: 'x' }, claimed: 'z' });
check('型が違う値は直る', odd.a.used === 0 && odd.a.extra === 0 && odd.a.defeated.length === 1 && odd.b.total === 0 && odd.claimed.length === 0);
check('保存キーは新しい mh_raid_jack_v1', o.RAID_JACK_STORAGE_KEY === 'mh_raid_jack_v1');

// ④ 段階式の解放
check('最初は1段階だけ', o.raidJackUnlockedCount('b', []) === 1);
check('初級を倒すと中級が開く', o.raidJackUnlockedCount('b', ['b1']) === 2);
check('飛ばしては開かない', o.raidJackUnlockedCount('b', ['b2', 'b3']) === 1);
check('全部倒しても5段階まで', o.raidJackUnlockedCount('b', ['b1', 'b2', 'b3', 'b4', 'b5']) === 5);

// ④-2 クイック周回ぶん(ジャック戦を遊んだぶんを、プロモードと同じ立て付けで経験値などにする・2026-10-05)
check('周回数 = 使ったターン数 × 2(20ターンで40周)', o.raidJackQuickLoops(20) === 40 && o.raidJackQuickLoops(1) === 2 && o.raidJackQuickLoops(7) === 14);
check('0ターンは0周・壊れた値も0周・20ターンを超えても40周まで', o.raidJackQuickLoops(0) === 0 && o.raidJackQuickLoops(-3) === 0 && o.raidJackQuickLoops(NaN) === 0 && o.raidJackQuickLoops(undefined) === 0 && o.raidJackQuickLoops(99) === 40);
{
  const app = read('monster-hero/src/parts/60-app.jsx');
  const fin = app.slice(app.indexOf('const finishRaidJack = async'), app.indexOf('const exitRaidJack'));
  check('クイック周回の報酬は、本番のイベントの戦いだけに配る(デバッグの強制表示には配らない)', /if\(!isDebugRun\)\{ try \{ quickAward=await awardRaidJackQuickLoops/.test(fin));
  check('プロモードと同じ配布の入口(awardBackQuickLoops)を通す・与ダメージの記録は変えない', /const awardRaidJackQuickLoops = async \(turnsUsed\) => awardBackQuickLoops\(raidJackQuickLoops\(turnsUsed\)\)/.test(app) && /const awarded = await awardRhythmPlayRunLoops\(loops, RHYTHM_PLAY_RUN_LOOP_SCALE, \{[\s\S]*?countLoopProgress: false[\s\S]*?recordQuickClear: false/.test(app));
  check('結果画面に「クイック周回ぶん」を別のまとまりで出す', /data-raid-jack-quick-award/.test(app));
}

// ④-4 ターンごとの強化(固有技は3・5・8・11ターン目に2段階ずつ=4回で最大の8段階・アシカは1段階ずつ=3・5ターン目で最大の2段階・2026-10-05)
check('固有技の強化は 3・5・8・11 ターン目の4回・1回2段階 → ちょうど最大の8段階', o.RAID_JACK_LEVEL_UP_TURNS.join(',') === '3,5,8,11' && o.RAID_JACK_UNIQUE_LEVEL_STEP === 2 && o.RAID_JACK_LEVEL_UP_TURNS.length * o.RAID_JACK_UNIQUE_LEVEL_STEP === 8);
check('アシカは1段階ずつ・最大2段階(3・5ターン目で最大)', o.RAID_JACK_TEACHING_MAX_LEVEL === 2 && [3, 5, 8, 11].map((t) => o.raidJackGrowthAt(t).teachingUpNow).join() === 'true,true,false,false');
check('強化の表示(回数)は 4回・次の強化のターンが出る', o.raidJackGrowthAt(1).levelUpMax === 4 && o.raidJackGrowthAt(1).nextLevelUpTurn === 3 && o.raidJackGrowthAt(9).nextLevelUpTurn === 11 && o.raidJackGrowthAt(11).nextLevelUpTurn === null && o.raidJackGrowthAt(11).levelUps === 4);
{
  const app = read('monster-hero/src/parts/60-app.jsx');
  const up = app.slice(app.indexOf('const raidJackLevelUp = (turn) => {'), app.indexOf('// 終わり方(撃破'));
  check('戦闘の強化は、固有技を RAID_JACK_UNIQUE_LEVEL_STEP ずつ・手札と山札と捨て札のカードにも反映する', (up.match(/RAID_JACK_UNIQUE_LEVEL_STEP/g) || []).length >= 3 && /setHand\(prev=>prev\.map\(bumpCard\)\); setDeck\(prev=>prev\.map\(bumpCard\)\); setGraveyard/.test(up));
}

// ④-3 距離適性はタクティクスバトルの仕様(合算しない。その距離に立っている子の適性だけ)・2026-10-05・ユーザー指摘
{
  const app = read('monster-hero/src/parts/60-app.jsx');
  const start = app.slice(app.indexOf('const startRaidJackBattle = (req) => {'), app.indexOf('// 開始の依頼が来て、runMode が依頼のモードへ反映された次の描画で始める'));
  check('ジャック戦の開始で、編成全員の距離適性を合算して渡さない(立っている子の適性だけが効く)', start.length > 0 && !/raidApt/.test(start) && /initBattle\(1,raidSlots,uniques,teachings,raidDef,'Jack',hero,null\)/.test(start));
  check('配置画面の「いまの適性」は、その距離に立っている子のぶんだけ(合計ではない)', /const standing=raidJackPlace\.slots\[dist\]/.test(app) && /perSlotApt=\{true\}/.test(app));
}

// ⑤ 公開フラグ
const rel = read('monster-hero/src/parts/17-release-changelog-login-missions.jsx');
check('公開フラグは true(2026-10-05 4:00 公開)で、RELEASE_FLAGS.raidJack は開始日時までは偽を返す(見るたびに数え直す getter・読み込み時に touch しても落ちない)',
  /const RAID_JACK_PUBLIC_RELEASE = true;/.test(rel) && /get raidJack\(\) \{ try \{ return RAID_JACK_PUBLIC_RELEASE === true && Date\.now\(\) >= Date\.parse\(RAID_JACK_START_AT\); \} catch \(e\) \{ return false; \} \}/.test(rel));
// 公開の瞬間(開始日時)の前後で、実際に旗が切り替わることを、本物の定義で確かめる
{
  const vm2 = require('vm');
  const fl = rel.slice(rel.indexOf('const RELEASE_FLAGS = {'), rel.indexOf('};', rel.indexOf('const RELEASE_FLAGS = {')) + 2);
  const base = { SPECIES_CHALLENGE_PUBLIC_RELEASE: true, TACTICS_MODE_PUBLIC_RELEASE: true, TACTICS_BETA_PRO_RELEASE: true, TACTICS_EX_SKILLS_RELEASE: true, RHYTHM_MODE_PUBLIC_RELEASE: true, RHYTHM_MULTI_PUBLIC_RELEASE: true, FRIENDS_PUBLIC_RELEASE: true,
    QUICK_RHYTHM_LINK_PUBLIC_RELEASE: true, RHYTHM_CANVAS_NOTES_PUBLIC_RELEASE: true, RHYTHM_TOTAL_RANKING_PUBLIC_RELEASE: true, RHYTHM_WEEKLY_RANKING_PUBLIC_RELEASE: true, RHYTHM_EVENT_POINTS_PUBLIC_RELEASE: true, RAID_JACK_PUBLIC_RELEASE: true };
  const at = (ms, withEvent = true) => {
    const c = { ...base, Date: class extends Date { static now() { return ms; } }, Object, Number, Math, Array };
    vm2.createContext(c);
    const pre = withEvent ? "const RAID_JACK_START_AT = '2026-10-05T04:00:00+09:00';\n" : '';
    return vm2.runInContext(`${pre}${fl}\nRELEASE_FLAGS.raidJack`, c);
  };
  check('開始の1ミリ秒前は旗が偽、開始の時刻から真(4:00ちょうどに公開される)', at(Date.parse('2026-10-05T03:59:59.999+09:00')) === false && at(Date.parse('2026-10-05T04:00:00+09:00')) === true);
  // 旗の判定は、更新履歴を作るとき(17が読み込まれるとき)にも呼ばれる。そのとき 35 の RAID_JACK_EVENT はまだ無いので、触ってはいけない
  // (触ると例外 → 「いつも偽」になり、開始を過ぎても更新履歴に出なかった・2026-10-05)
  check('旗の判定は、あとに読み込まれる RAID_JACK_EVENT に頼らない(17の中の RAID_JACK_START_AT だけを見る)', !/get raidJack\(\)[^}]*RAID_JACK_EVENT/.test(rel) && /const RAID_JACK_START_AT = '/.test(rel));
}

// ⑥ 公開の準備(更新履歴・告知・ヘルプ・案内が公開フラグで隠れる)
const changelog = read('monster-hero/data/changelog.js');
const jackAt = changelog.indexOf("title:'【期間限定】レイドボス戦「カボチャのおばけジャック」を開催します'");
const entry = changelog.slice(Math.max(0, jackAt - 200), jackAt + 2500);   // 先頭からの固定の長さではなく、この項目の位置から読む(新しい項目が先頭へ足されても、ずれない)
check('更新履歴の項目は公開フラグ raidJack が立つまで出ない', /releaseFlag:'raidJack'/.test(entry) && /カボチャのおばけジャック/.test(entry));
check('大きい追加なので助手の告知(content)が付く', /assistantNotice:\{ id:'update_notice_raid_jack_v1', type:'content', notifyFrom:'2026-10-05T04:00:00\+09:00'/.test(entry) && /visibleFrom:'2026-10-05T04:00:00\+09:00'/.test(entry));
const help = read('monster-hero/data/help.js');
check('ヘルプの項目は公開フラグが立つまで出ず、助手のひとことがある', /id: 'raid-jack'[^\n]*releaseFlag:'raidJack'/.test(help) && /id: 'raid-jack'[\s\S]{0,400}assistant:/.test(help));
check('画面(RAID_JACK / PREP)はヘルプの項目につながる', /RAID_JACK: 'basics\/raid-jack'/.test(help) && /RAID_JACK_PREP: 'basics\/raid-jack'/.test(help));
check('画面のなかの案内は新しい保存キー mh_raid_jack_guide_seen_v1 で、公開フラグ(または強制表示)でだけ出る', /mh_raid_jack_guide_seen_v1/.test(read('monster-hero/src/parts/60-app.jsx')) && /guideVisible=\{\(RELEASE_FLAGS\.raidJack===true\|\|raidJackDebugForce\)&&!raidJackGuideSeen\}/.test(read('monster-hero/src/parts/60-app.jsx')));

if (failed) { console.log(`\n${failed}件 NG`); process.exit(1); }
console.log('\nすべて OK');

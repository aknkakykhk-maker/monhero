const fs = require('fs');
const vm = require('vm');

const source = fs.readFileSync('monster-hero/src/game-system.jsx', 'utf8');
const start = source.indexOf('const DIFFICULTY_SETTINGS =');
const end = source.indexOf('const SPECIES_CHALLENGE_FIRST_CLEAR_REWARDS =', start);
if (start < 0 || end < 0) throw new Error('種族チャレンジ進行定義が見つかりません');

const lineages = ['mocchi','pixie','golem','dragon','beast','plant','dino','hare','worm','gel','monol'].map(id => ({ id, name:id }));
const context = {
  speciesChallengeLineages:()=>lineages,
  lineageById:(id)=>lineages.find(lineage=>lineage.id===id)||{name:id},
  speciesTranscendFruitItemId:()=>null,
};
vm.createContext(context);
vm.runInContext(`${source.slice(start,end)}\nglobalThis.api={SPECIES_CHALLENGE_DIFFICULTY_IDS,normalizeSpeciesChallengeProgress,speciesChallengeProfileSummary};`,context);
const { api } = context;
const assert = (condition,message) => { if(!condition)throw new Error(message); };

assert(api.SPECIES_CHALLENGE_DIFFICULTY_IDS.length===14,'難易度は既存定義の14件を使う');
const summary=api.speciesChallengeProfileSummary({ species:{
  mocchi:{
    cleared:{Beginner:true,Hard:true},
    firstRewardClaimed:{Expert:true},
    records:{Hard:{bestScore:1234567},Expert:{bestScore:1234567}},
  },
  pixie:{cleared:{Normal:true},records:{Beginner:{bestScore:1234567}}},
  unknown:{cleared:{Beginner:true},records:{Beginner:{bestScore:9999999}}},
} });
assert(summary.totalCount===154,'全11種族×14難易度を154組として集計する');
assert(summary.bestScore===1234567&&summary.bestSpeciesId==='mocchi'&&summary.bestDifficultyId==='Hard','最高scoreと対応する種族・難易度を抽出し、同点は既存順で固定する');
assert(summary.clearedCount===3,'clearedだけを重複なく集計し、firstRewardClaimedや未知種族を数えない');
const empty=api.speciesChallengeProfileSummary(null);
assert(empty.bestScore===0&&empty.bestSpeciesId===null&&empty.bestDifficultyId===null&&empty.clearedCount===0&&empty.totalCount===154,'未記録を安全に0/154へ正規化する');

const profileStart=source.indexOf('{/* 保存済みの各モード記録を読むだけのプロフィール表示。新しい保存キーは作らない。 */}');
const profileEnd=source.indexOf('{/* イベント回想:',profileStart);
const profile=source.slice(profileStart,profileEnd);
assert(profile.includes('SPECIES_CHALLENGE_MODE')&&profile.includes('data-profile-mode={mode.id}'),'プロフィールに種族チャレンジを既存モードカードとして追加する');
assert(profile.includes('speciesChallengeProfileSummary(speciesChallengeProgress)'),'プロフィールは既存の正規化済みローカル進行だけを集計する');
assert(profile.includes("openSpeciesChallengeRecords('PROFILE')"),'タップで既存の全種族ランキングへ進み、プロフィールへ戻れる');
assert(!profile.includes('SPECIES_CHALLENGE_DIFFICULTY_IDS.map'),'プロフィールへ154組を直接描画しない');
assert(!profile.includes('mh_hs_')&&!profile.includes('localRankings')&&!profile.includes('loadRankings('),'通常チャレンジや全国ランキング値をプロフィール集計へ混ぜない');
assert(profile.includes('w-full min-h-[64px]')&&profile.includes('min-w-0 flex-1')&&profile.includes('truncate'),'320〜390pxで横へはみ出さない既存カード構造を維持する');

console.log('種族チャレンジ プロフィール表示確認: PASS');

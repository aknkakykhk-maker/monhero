// モンヒロくんの担当表。
//
// 【担当と部分】(2026-10-07 ユーザー指示「担当名が細かい。やることは同じで人数を減らしたい」で 22人→12人)
//   担当(ROLES・下の GROUPS)は、いくつかの「部分」(PARTS)を順に受け持つ。部分はもとの担当1人ぶんの仕事で、
//   部分ごとに別のブラウザを開き直す(下準備・時計・画面の大きさが部分ごとに違うため)。
//   1つの部分がつまずいても、同じ担当の次の部分は続ける。報告は担当ごとにまとまり、中に部分ごとの行が並ぶ。
//   仕事を足すときは PARTS へ1件足し(中身は scenarios/)、GROUPS のどこかの担当の parts へ入れる。
//
// 部分(PARTS)の項目:
//   id       … --only で部分だけ選ぶときの名前(もとの担当id。名前の「〜係」でも選べる)
//   alone    … true の部分を持つ担当は、ほかの担当が全部終わってから1人で動かす。
//              モンヒロビートは同時に動かすとコマが止まって押すのが遅れる
//              (tools/mode/rhythm-robot-play.js 2026-09-29: 3本並べて 125譜面中8譜面で 67〜264ms 遅れた)
//   prepare  … 遊ぶ前のブラウザの中身。'veteran'(いつもの人)/ 'legacy'(昔のセーブ)/ null(まっさら)
//   boot     … true なら、仕事の前に起動して HOME まで行く(読み込みの秒数も測る)
const { newPlayerScenario } = require('./scenarios/new-player');
const { battleScenario } = require('./scenarios/battle');
const { tacticsScenario } = require('./scenarios/tactics');
const { shopScenario } = require('./scenarios/shop');
const { growScenario } = require('./scenarios/grow');
const { multiScenario } = require('./scenarios/multi');
const { raidScenario, halloweenScenario } = require('./scenarios/event');
const { raidBeatScenario } = require('./scenarios/raidbeat');
const { landscapeScenario } = require('./scenarios/landscape');
const { buddyScenario } = require('./scenarios/buddy');
const { storyTimingScenario, replayScenario } = require('./scenarios/story');
const { offlinePlayScenario, resendScenario, slowScenario } = require('./scenarios/net');
const { smallTourScenario, smallPlayScenario } = require('./scenarios/small');
const { lookScenario } = require('./scenarios/look');
const { doubleTapScenario, reloadMidwayScenario, browserBackScenario, backgroundScenario } = require('./scenarios/mean');
const { rhythmScenario } = require('./scenarios/rhythm');
const { exploreScenario, tourScenario } = require('./scenarios/explore');
const { rankingScenario } = require('./scenarios/ranking');
const { legacyReturnScenario, legacyRebootScenario, legacyPlayScenario } = require('./scenarios/legacy');
const { loginBonusScenario, eventPeriodScenario } = require('./scenarios/clock');

const PARTS = [
  {
    id: 'new', name: '新人係', prepare: null,
    does: 'はじめての設定から、最初のバトルと少しの探索まで',
    run: async (s, { phase, steps, rand, numbers }) => {
      await phase('はじめて遊ぶ', async () => {
        const r = await newPlayerScenario(s);
        numbers['新人係: はじめての設定の手数'] = r.stats.stepsTaken;
        return r;
      });
      await phase('はじめてのバトル', async () => { await s.backHome(); const r = await battleScenario(s, { manualTurns: 4, autoMs: 30000, system: 'systemClassic' }); await s.backHome(); return r; });
      await phase('新人の探索', () => exploreScenario(s, { steps: Math.ceil(steps / 3), rand, report: { clickCount: new Map() } }));
    },
  },
  {
    id: 'battle', name: 'バトル係', prepare: 'veteran', boot: true,
    does: 'クイックモードを手で遊ぶ(カードを選ぶ → 置く → ACTION)',
    run: async (s, { phase, numbers }) => {
      await phase('手で戦う', async () => {
        const r = await battleScenario(s, { manualTurns: 10, autoMs: 0 });
        numbers['バトル係: 手で突破したWAVE'] = r.stats.wavesCleared;
        await s.backHome();
        return r;
      });
    },
  },
  {
    id: 'tactics', name: 'タクティクス係', prepare: 'veteran', boot: true,
    does: 'タクティクスバトルを手で6分遊ぶ。敵の予告で狙われた子が危なければ守りのカードを選ぶ',
    run: async (s, { phase, numbers }) => {
      await phase('タクティクスを手で戦う', async () => {
        const r = await tacticsScenario(s);
        if (r.stats.entered) numbers['バトル係: タクティクスで着いたWAVE'] = r.stats.waveReached;
        await s.backHome();
        return r;
      });
    },
  },
  {
    id: 'auto', name: 'AUTO係', prepare: 'veteran', boot: true,
    does: 'AUTO で3分放っておき、途中で止まらないか見る',
    run: async (s, { phase, numbers }) => {
      await phase('AUTO で放置', async () => {
        const r = await battleScenario(s, { manualTurns: 0, autoMs: 180000 });
        if (Number.isFinite(r.stats.endWave)) numbers['バトル係: AUTOで3分で着いたWAVE'] = r.stats.endWave;
        await s.backHome();
        return r;
      });
    },
  },
  {
    id: 'tour', name: '案内係', prepare: 'veteran', boot: true,
    does: 'HOME の入口を1つずつ開き、中で少し遊んで戻る',
    run: async (s, { phase, rand }) => {
      await phase('HOME の入口ツアー', () => tourScenario(s, { stepsEach: 8, rand, report: { clickCount: new Map() } }));
    },
  },
  {
    id: 'explore', name: '探検係', prepare: 'veteran', boot: true,
    does: 'まだ押していないボタンを優先して押していく(モンキーテスト)',
    run: async (s, { phase, steps, rand }) => {
      await phase('探索', () => exploreScenario(s, { steps, rand, report: { clickCount: new Map() } }));
    },
  },
  {
    id: 'grow', name: '育成係', prepare: 'veteran', boot: true,
    // マスモンは昔のキーから起動時の一度きりの移行で作られる(久しぶり係と同じ道)。ブリーダーXPは強化の上限のため
    storage: { mh_bond_xp: { Mocchi: 3000, Suezo: 800 }, mh_breeder_xp: 50000 },
    does: 'マスモンの強化ポイントを振って確定する(完了は二度押し)。確定前は保存が変わらず、確定後は振った分だけ入るかを見る。編成・図鑑・放牧も開く',
    run: async (s, { phase }) => {
      await phase('マスモンを強化する', () => growScenario(s));
    },
  },
  {
    id: 'shop', name: '買い物係', prepare: 'veteran', boot: true, storage: { mh_gold: 999999 },
    does: 'ダイヤショップで買う・ギフトとミッションの報酬を受け取る。ダイヤと所持数が画面の表示どおりに増減するかを見る',
    run: async (s, { phase }) => {
      await phase('買い物と受け取り', () => shopScenario(s));
    },
  },
  {
    id: 'mean', name: '意地悪係', prepare: 'veteran', boot: true, storage: { mh_gold: 999999 },
    does: '二度押し・途中で読み込み直す・ブラウザの戻る・バトル中に裏へ回す。二重になったり止まったりしないかを見る',
    run: async (s, { phase }) => {
      await phase('二度押し', () => doubleTapScenario(s));
      await phase('買う途中で読み込み直す', () => reloadMidwayScenario(s));
      await phase('ブラウザの戻る', () => browserBackScenario(s));
      await phase('バトル中に裏へ回す', () => backgroundScenario(s));
    },
  },
  {
    id: 'event', name: 'イベント係', prepare: 'veteran', boot: true,
    does: '開催中のレイド(ジャック)にバトルで1回挑戦し、残り回数が1回分だけ減るか・ダメージの記録が送られるかを見る。ハロウィン・ナイトの札も押す',
    run: async (s, { phase }) => {
      await phase('レイドに挑戦', () => raidScenario(s));
      await phase('ハロウィン・ナイトの札', () => halloweenScenario(s));
    },
  },
  {
    // 既読を入れない下準備(quiet: false)で始め、時計を合わせてから起動する(boot はシナリオの中)
    id: 'story', name: 'ストーリー係', prepare: 'veteran', quiet: false,
    does: '時計を開始の前後に合わせて、時刻で流れるストーリーが前は流れず後は流れるかを見る。イベント回想を1つずつ最後まで読む',
    run: async (s, { phase }) => {
      await phase('流れる時刻', () => storyTimingScenario(s));
      await phase('回想を読む', () => replayScenario(s));
    },
  },
  {
    id: 'look', name: '見た目係', prepare: 'veteran', boot: true,
    does: '主な11画面を毎回同じ手順で開いて撮り、前回(baseline/look)と比べて大きく変わった画面だけを、前回と今回を並べた画像つきで知らせる',
    run: async (s, { phase, out }) => {
      await phase('主な画面を撮って比べる', () => lookScenario(s, { out }));
    },
  },
  {
    id: 'legacy', name: '久しぶり係', prepare: 'legacy',
    does: '昔の形のセーブで開き、持ち物が消えない・移行が二重にかからない・そのまま遊べるかを見る',
    run: async (s, { phase, steps, rand }) => {
      let first = null;
      await phase('昔のセーブで開く', async () => { const r = await legacyReturnScenario(s); first = r.stats.first; return r; });
      if (first) await phase('もう一度開く', () => legacyRebootScenario(s, first));
      await phase('そのまま遊ぶ', () => legacyPlayScenario(s, { steps: Math.ceil(steps / 3), rand }));
    },
  },
  {
    id: 'clock', name: '時計係', prepare: 'veteran',
    does: '端末の時計を動かし、ログインボーナスの日付とイベント・キャンペーンの期間を見る',
    run: async (s, { phase }) => {
      await phase('ログインボーナスの日付', () => loginBonusScenario(s));
      await phase('イベントの期間', () => eventPeriodScenario(s));
    },
  },
  {
    id: 'rhythm', name: '音ゲー係', prepare: 'veteran', boot: true, alone: true, measureBoot: true,
    does: 'モンヒロビートで曲と難易度を選び、ノーツに合わせて最後まで演奏する',
    run: async (s, { phase, shared, numbers }) => {
      await phase('モンヒロビート', async () => {
        const r = await rhythmScenario(s);
        const score = Number(String((r.stats.result && r.stats.result.score) || '').replace(/,/g, ''));
        if (Number.isFinite(score) && score > 0) numbers['音ゲー係: スコア'] = score;
        const byType = (r.stats.bot && r.stats.bot.diag && r.stats.bot.diag.byType) || {};
        Object.entries(byType).forEach(([t, e]) => { if (e.n >= 20) numbers[`音ゲー係: ${t}のMISS率(%)`] = Math.round((e.miss / e.n) * 1000) / 10; });
        const tap = r.stats.bot && r.stats.bot.diag && r.stats.bot.diag.tap;
        if (tap && tap.n >= 50) {
          numbers['音ゲー係: タップのMISS率(%)'] = Math.round((tap.miss / tap.n) * 1000) / 10;
          numbers['音ゲー係: 指が帯の中なのにタップMISS(件)'] = tap.missInBand + tap.missInBandCrowded;
        }
        shared.rhythm = { song: r.stats.song, difficulty: r.stats.difficulty,
          rows: s.supabase.writes.filter((w) => w.table === 'rankings').map((w) => w.row) };
        await s.backHome();
        return r;
      });
    },
  },
  {
    id: 'multi', name: 'マルチ係', prepare: 'veteran', boot: true, alone: true,
    storage: { mh_bond_xp: { Mocchi: 3000, Suezo: 800 }, mh_breeder_xp: 50000 },
    does: 'モンヒロビートのプライベートルームを作り、マスモンを呼んで(二度押し)一緒に最後まで演奏する。1人で動かす',
    run: async (s, { phase }) => {
      await phase('マルチでマスモンと演奏', () => multiScenario(s));
    },
  },
  {
    id: 'raidbeat', name: 'レイド音ゲー係', prepare: 'veteran', boot: true, alone: true,
    does: 'レイドに「モンヒロビートで挑戦」し、最後まで演奏する。決定を二度押ししても挑戦回数が1回分だけ増えるか・ダメージの記録が1件送られ、結果画面と同じかを見る。1人で動かす',
    run: async (s, { phase }) => {
      await phase('レイドにモンヒロビートで挑戦', () => raidBeatScenario(s));
    },
  },
  {
    id: 'landscape', name: '横画面係', prepare: 'veteran', boot: true, alone: true,
    does: 'モンヒロビートを横画面にして、遊びかた・記録・オプション・曲えらび・全国ランキング(イベント詳細)・部屋を開き、閉じる/戻るで本当に閉じられるかを見る。横向きのまま1曲演奏する。1人で動かす',
    run: async (s, { phase }) => {
      await phase('横画面で開いて閉じる・演奏する', () => landscapeScenario(s));
    },
  },
  {
    // 時計を差し替えてから起動するので、boot はシナリオの中で行う(時計係と同じ)
    id: 'buddy', name: '相棒係', prepare: 'veteran', alone: true,
    storage: { mh_bond_xp: { Mocchi: 3000, Suezo: 800, Golem: 900, Tiger: 700 }, mh_breeder_xp: 50000, mh_owned_items: { session_ticket: 2 } },
    does: '朝5:00の少し前に、マルチの部屋でマスモンを4体呼ぶ(3体目まで無料・4体目で券が1枚だけ減るか)。1曲遊んで経験値が増えるか。5:10に開き直して無料が3回に戻るか。1人で動かす',
    run: async (s, { phase }) => {
      await phase('相棒の回数・券・朝5:00', () => buddyScenario(s));
    },
  },
  {
    id: 'net', name: '通信不良係', prepare: 'veteran', boot: true, alone: true,
    does: '通信を「つながらない」にして1曲演奏し、記録が端末に取っておかれるか。戻して「いま送る」で送り直されるか。通信が10秒遅いときにランキングが止まらないか。1人で動かす',
    run: async (s, { phase }) => {
      const shared = {};
      await phase('つながらないまま演奏', () => offlinePlayScenario(s, shared));
      await phase('戻して送り直す', () => resendScenario(s, shared));
      await phase('遅い通信', () => slowScenario(s, shared));
    },
  },
  {
    id: 'small', name: '小さい画面係', prepare: 'veteran', boot: true, alone: true,
    viewport: { width: 320, height: 568 }, cpuSlowdown: 4,
    does: '幅320px・CPU 4倍遅いで起動の秒数を測り、HOME の入口を全部回り、1曲演奏する。1人で動かす(CPU を遅くするので、ほかと並べない)',
    run: async (s, { phase, rand, numbers }) => {
      await phase('小さい画面で入口を回る', () => smallTourScenario(s, { rand }));
      await phase('遅い端末で演奏', () => smallPlayScenario(s));
    },
  },
  {
    id: 'ranking', name: 'ランキング係', prepare: 'veteran', boot: true, alone: true,
    does: '直前の演奏の記録と、名前の長い大勢のライバルを並べてランキングを開く',
    run: async (s, { phase, shared }) => {
      await phase('ランキングを見る', () => rankingScenario(s, { rhythm: shared.rhythm }));
    },
  },
];

// 担当(12人)。parts の順に1つずつ動かす。ランキングは音ゲーの記録を使う(shared.rhythm)ので、rhythm の後ろに置く
const GROUPS = [
  { id: 'battle', name: 'バトル係', parts: ['battle', 'auto', 'tactics'],
    does: 'クイックモードを手で遊び、AUTO で3分放っておき、タクティクスバトルを手で6分遊ぶ(狙われた子が危なければ守りを選ぶ)' },
  { id: 'event', name: 'イベント係', parts: ['event'],
    does: '開催中のレイド(ジャック)にバトルで1回挑み、残り回数とダメージの記録を見る。ハロウィン・ナイトの札も押す' },
  { id: 'rhythm', name: '音ゲー係', parts: ['rhythm', 'ranking', 'landscape'],
    does: 'モンヒロビートを最後まで演奏し、その記録でランキングを開き、横画面でも開いて閉じる・1曲演奏する' },
  { id: 'multi', name: 'マルチ係', parts: ['multi', 'buddy'],
    does: 'プライベートルームでマスモンを呼んで一緒に演奏し、朝5:00をまたいで呼べる回数と券の減り方を見る' },
  { id: 'raidbeat', name: 'レイド音ゲー係', parts: ['raidbeat'],
    does: 'レイドに「モンヒロビートで挑戦」し、挑戦回数とダメージの記録が1回分だけか見る' },
  { id: 'new', name: '新人係', parts: ['new'],
    does: 'はじめての設定から、最初のバトルと少しの探索まで' },
  { id: 'walk', name: '見回り係', parts: ['tour', 'explore'],
    does: 'HOME の入口を1つずつ開いて少し遊び、まだ押していないボタンを優先して押していく' },
  { id: 'story', name: 'ストーリー係', parts: ['story'],
    does: '時刻で流れるストーリーが開始の前は流れず後は流れるか。イベント回想を最後まで読む' },
  { id: 'look', name: '見た目係', parts: ['look', 'small'],
    does: '主な11画面を撮って前回と比べ、幅320px・遅い端末でも入口を回って1曲演奏する' },
  { id: 'time', name: '時間と保存係', parts: ['legacy', 'clock'],
    does: '昔のセーブで開いて持ち物が消えない・二重にならないかを見て、時計を動かしてログインボーナスとイベントの期間を見る' },
  { id: 'count', name: '数字係', parts: ['grow', 'shop'],
    does: 'マスモンの強化とダイヤショップ・ギフト・ミッションで、数が表示どおりに増減するかを見る' },
  { id: 'mean', name: '意地悪係', parts: ['mean', 'net'],
    does: '二度押し・読み込み直し・戻る・裏へ回す、通信が切れる・遅いときに、二重になったり止まったりしないかを見る' },
];
const partOf = (id) => {
  const p = PARTS.find((x) => x.id === id);
  if (!p) throw new Error(`roles.js: 担当の部分 ${id} が PARTS に無い`);
  return { ...p, label: p.name.replace(/係$/, '') };
};
const ROLES = GROUPS.map((g) => {
  const parts = g.parts.map(partOf);
  return { ...g, parts, alone: parts.some((p) => p.alone) };
});
// PARTS の入れ忘れ(どの担当にも入っていない部分)は playbot.js が起動時に知らせる

// 毎晩の班分け(2026-10-07 ユーザー指示「担当別にセッションを分けて報告」)。班ごとに別のセッションが
// `--team <id>` で受け持ちの担当だけを動かし、深く調べて報告する(ROUTINE.md「班分け」)。
// ★担当を足したら、どこかの班へ必ず入れる(入れ忘れると毎晩だれも動かさない。playbot.js が起動時に見張る)
const TEAMS = [
  { id: 'battle', name: 'バトル部:部長ブレイブくん', roles: ['battle', 'event'] },
  { id: 'rhythm', name: 'ビート部:部長テンポくん', roles: ['rhythm', 'multi', 'raidbeat'] },
  { id: 'patrol', name: '見回り部:部長マップくん', roles: ['new', 'walk', 'story', 'look'] },
  { id: 'guard', name: '守り部:部長ガードくん', roles: ['time', 'count', 'mean'] },
];

module.exports = { ROLES, TEAMS, PARTS };

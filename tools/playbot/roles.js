// モンヒロくんの担当表。担当ごとに別のブラウザを1つ開き、決まった仕事だけをする。
// 報告は担当ごとにまとまる。担当を足すときは、この表へ1件足し、仕事の中身は scenarios/ に置く。
//
//   id       … --only で選ぶときの名前(日本語の name でも選べる)
//   alone    … true の担当は、ほかの担当が全部終わってから1人で動かす。
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
const { doubleTapScenario, reloadMidwayScenario, browserBackScenario, backgroundScenario } = require('./scenarios/mean');
const { rhythmScenario } = require('./scenarios/rhythm');
const { exploreScenario, tourScenario } = require('./scenarios/explore');
const { rankingScenario } = require('./scenarios/ranking');
const { legacyReturnScenario, legacyRebootScenario, legacyPlayScenario } = require('./scenarios/legacy');
const { loginBonusScenario, eventPeriodScenario } = require('./scenarios/clock');

const ROLES = [
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
        if (r.stats.entered) numbers['タクティクス係: 着いたWAVE'] = r.stats.waveReached;
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
        if (Number.isFinite(r.stats.endWave)) numbers['AUTO係: 3分で着いたWAVE'] = r.stats.endWave;
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
    id: 'ranking', name: 'ランキング係', prepare: 'veteran', boot: true, alone: true,
    does: '音ゲー係の記録と、名前の長い大勢のライバルを並べてランキングを開く',
    run: async (s, { phase, shared }) => {
      await phase('ランキングを見る', () => rankingScenario(s, { rhythm: shared.rhythm }));
    },
  },
];

// 毎晩の班分け(2026-10-07 ユーザー指示「担当別にセッションを分けて報告」)。班ごとに別のセッションが
// `--team <id>` で受け持ちの担当だけを動かし、深く調べて報告する(ROUTINE.md「班分け」)。
// ★ランキング係は音ゲー係の記録を使う(shared.rhythm)ので、同じ班から離さない。
// ★担当を足したら、どこかの班へ必ず入れる(入れ忘れると毎晩だれも動かさない。playbot.js が起動時に見張る)
const TEAMS = [
  { id: 'battle', name: 'バトル班', roles: ['battle', 'tactics', 'auto', 'event'] },
  { id: 'rhythm', name: '音ゲー班', roles: ['rhythm', 'ranking', 'multi', 'raidbeat', 'landscape', 'buddy'] },
  { id: 'patrol', name: 'はじめて・見回り班', roles: ['new', 'tour', 'explore'] },
  { id: 'guard', name: '守り班', roles: ['legacy', 'clock', 'grow', 'shop', 'mean'] },
];

module.exports = { ROLES, TEAMS };

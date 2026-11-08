// ===== 助手とおしゃべり(2026-10-14・社長の決定) =====
// 助手と自由に話せる会話の窓。返事は Claude が作る。ゲームは API キーを持たず、
// 中継役(supabase/functions/assistant-chat)へ送るだけ。仕様: docs/spec/ASSISTANT_CHAT.md
// ★公開の印 RELEASE_FLAGS.assistantChat の後ろ。印が立つまではデバッグ設定からだけ開ける。
// ★会話の中身は端末にだけ置く(新しいキー。既存のキーは触らない)。サーバーへ送るのは直近3往復と今回だけ。
// ★電話番号・住所・メールらしい文字は送る前に止める(回数も使わない)。
const ASSISTANT_CHAT_URL = `${SUPABASE_URL}/functions/v1/assistant-chat`;
const ASSISTANT_CHAT_LOG_KEY = 'mh_assistant_chat_log_v1';   // { [助手id]: [{ role:'user'|'assistant', text, e? }] }
const ASSISTANT_CHAT_MEMO_KEY = 'mh_assistant_chat_memo_v1'; // 前の形 { [助手id]: '120字までの文' }。読むだけで書かない
// 思い出メモを5つの欄に広げた(2026-10-14)。新しいキーに書く。前のキーの文は「前に話した話題」として引き継ぐ(CLAUDE.md ⑦)
const ASSISTANT_CHAT_MEMO_V2_KEY = 'mh_assistant_chat_memo_v2'; // { [助手id]: { likes, goals, events, topics, summary } }
// secret … 「ないしょ」「秘密」と言われたこと(2026-11-07 助手どうしの共有で足した欄)。ほかの助手には渡さない。無い人は空として読む
const ASSISTANT_CHAT_MEMO_FIELDS = { likes:100, goals:100, events:100, topics:100, summary:160, secret:100 };
const ASSISTANT_CHAT_LOG_LIMIT = 60;
// 送る会話は直近10往復まで。10件ずつ区切って送り、前のほうの並びを毎回変えない(中継役でキャッシュが効く)
const ASSISTANT_CHAT_SEND_STEP = 10;
const ASSISTANT_CHAT_SEND_MAX = 21;
// 助手の答えにノーツの見本の絵を出す(2026-10-21 社長「見た目とかちゃんとわかるようにしてほしい」)。
// どの絵を出すかは答えの文に出たノーツの名前から機械で選ぶ(rhythmNoteSwatchKindsInText)。絵は演奏画面と同じ描き方の RhythmNoteSwatch だけなので、作り話の色は出ない。
// 「ボタンをタップ」のような言葉で絵が出ないよう、答えかその前のプレイヤーの発言に「ノーツ」があるときだけ出す
const assistantChatNoteKinds = (text, prevUserText) => {
  if (typeof rhythmNoteSwatchKindsInText !== 'function') return [];
  if (!/ノーツ/.test(`${text || ''}${prevUserText || ''}`)) return [];
  return rhythmNoteSwatchKindsInText(text);
};
// 助手の答えに味方モンスターの絵を出す(2026-10-21 社長「モッチーってどんなモンスター？と聞かれたら、答えと一緒に公式の絵を見せる」)。
// 直前のプレイヤーの発言と答えに出た名前から機械で選び、ゲームにある立ち絵(無ければ顔アイコン)をそのまま出す(染色は使わず元の色)。
// 選ぶのは図鑑に並ぶモンスター(debugOnly でないもの)だけ。長い名前から照らし(「剣士モッチー」を「モッチー」と取り違えない)、
// 前後がカタカナの所は数えない(「ハムスター」の「ハム」)。多くても3体
const ASSISTANT_CHAT_MONSTER_MAX = 3;
const assistantChatMonsterIds = (text, prevUserText) => {
  if (typeof ALL_PLAYER_MONSTERS === 'undefined') return [];
  const mons = Object.values(ALL_PLAYER_MONSTERS).filter(m => m && !m.debugOnly && m.name && (m.imgUrl || m.faceIconUrl)).sort((a, b) => b.name.length - a.name.length);
  const out = [];
  for (const src of [prevUserText, text]) {
    let t = String(src || '');
    const found = [];
    for (const m of mons) {
      let at = t.indexOf(m.name);
      while (at >= 0) {
        const before = t[at - 1] || '', after = t[at + m.name.length] || '';
        if (!/[ァ-ヺー]/.test(before) && !/[ァ-ヺー]/.test(after)) found.push({ id: m.id, at });
        t = t.slice(0, at) + '　'.repeat(m.name.length) + t.slice(at + m.name.length);
        at = t.indexOf(m.name);
      }
    }
    found.sort((a, b) => a.at - b.at).forEach(f => { if (!out.includes(f.id)) out.push(f.id); });
  }
  return out.slice(0, ASSISTANT_CHAT_MONSTER_MAX);
};
// ランキングの話題のとき、中継役に「どのランキングを読むか」の計画を付けて送る(2026-10-21 社長の決定「おしゃべりでランキングの上位を答えられるようにする」)。
// 種類・難易度のキー・曲・イベントの期間は、ランキング画面と同じ関数(rankingDifficultyForMode・rhythmRankingDifficultyKey・rhythmLimitedEventAt ほか)で作る。
// 中継役(supabase/functions/assistant-chat/ranking.js)は形を確かめて読むだけ。話題の判定は中継役の RANKING_TOPIC_RE と同じ式
// 2026-10-22 社長「全部見られるようにして」:
//   ・モードを言ったら、そのモードでランキングがある難易度を全部見る(並べ方はランキング画面の renderScoreRankingBody と同じ)
//   ・「エクストリーム」「極限」は、そのモードの極限の難易度を全部。「全部」「全難易度」は、そのモードの難易度を全部
//   ・その発言にランキングの言葉やモードが無ければ、すぐ前のプレイヤーの発言(2つまで)から話題・モード・難易度を引き継ぐ
//     (中継役も、すぐ前の発言にランキングの言葉があれば読む。ranking.js の rankingTopicOf)
const ASSISTANT_CHAT_RANKING_TOPIC = /ランキング|ランク(?:イン|上位)|順位|何位|なんい|[0-9０-９一二三四五]+位|トップ|上位|首位|一番(?:上|強い|高い)|いちばん(?:上|強い|高い)/;
// 1回に読むランキングの数。チャレンジの全部(通常9+極限12・2026-11-04 EREBUS を足した)が入る数。中継役の RANKING_PLAN_MAX と同じ
const ASSISTANT_CHAT_RANKING_MAX = 21;
// 引き継ぐ前の発言の数
const ASSISTANT_CHAT_RANKING_PREV = 2;
// 「その種類の難易度を全部」の言葉。英字の EXTREME は難易度そのものの名前なので、ここには入れない(カタカナ・漢字だけ)
const ASSISTANT_CHAT_RANKING_EXTREME_WORD = /エクストリーム|極限/;
// 冥界チャレンジ(INFERNO・COCYTUS。2026-11-01)。「冥界のランキング」は冥界の2つ、「極限のランキング」は ETERNAL までの9つを読む
const ASSISTANT_CHAT_RANKING_UNDERWORLD_WORD = /冥界/;
const ASSISTANT_CHAT_RANKING_ALL_WORD = /全部|ぜんぶ|全難易度|全ての難易度|すべての難易度|難易度(?:ごと|別|全部)|全部の難易度/;
const assistantChatRankingPlan = (rawText, prevUserTexts = []) => {
  const text = String(rawText || '');
  const prevs = (Array.isArray(prevUserTexts) ? prevUserTexts : []).slice(0, ASSISTANT_CHAT_RANKING_PREV).map(t => String(t || ''));
  const topicNow = ASSISTANT_CHAT_RANKING_TOPIC.test(text);
  if (!topicNow && !prevs.some(t => ASSISTANT_CHAT_RANKING_TOPIC.test(t))) return null;
  try {
    const norm = (s) => String(s || '').normalize('NFKC').toLowerCase().replace(/\s+/g, '');
    const plan = [];
    const push = (p) => { if (plan.length < ASSISTANT_CHAT_RANKING_MAX && p) plan.push(p); };
    // 種(絆Lv・総合力の絞り込み)。図鑑の種と、その種のモンスターのid
    const lineages = typeof dexMainLineages === 'function' ? dexMainLineages() : [];
    // ── モンヒロビート ──
    const songs = (typeof RHYTHM_DEMO_SONG_IDS !== 'undefined' ? RHYTHM_DEMO_SONG_IDS : [])
      .filter(id => typeof rhythmSongReleased !== 'function' || rhythmSongReleased(id))
      .map(id => (typeof RHYTHM_SONGS !== 'undefined' ? RHYTHM_SONGS.find(s => s.songId === id) : null)).filter(s => s && s.displayName)
      .sort((a, b) => b.displayName.length - a.displayName.length);
    const rhythmDiffs = typeof rhythmScoredDifficultyIds === 'function' ? rhythmScoredDifficultyIds() : [];
    // ── バトルのモード(ランキングがあるモードだけ)と難易度 ──
    const modes = [
      ...(typeof BATTLE_MODES !== 'undefined' ? BATTLE_MODES : []),
      ...[typeof EXTREME_MODE !== 'undefined' ? EXTREME_MODE : null, typeof SPECIES_CHALLENGE_MODE !== 'undefined' ? SPECIES_CHALLENGE_MODE : null,
        typeof TACTICS_MODE !== 'undefined' ? TACTICS_MODE : null, typeof TACTICS_SPECIES_MODE !== 'undefined' ? TACTICS_SPECIES_MODE : null,
        typeof TACTICS_PRO_MODE !== 'undefined' ? TACTICS_PRO_MODE : null].filter(Boolean),
    ].filter(m => m && m.id && modeHasRanking(m.id));
    const extremeMode = typeof EXTREME_MODE !== 'undefined' ? EXTREME_MODE : null;
    // ランキングの無いタクティクス(タクティクスチャレンジ)の呼び名は、ランキングがあるタクティクスプロへ寄せる
    // (2026-10-22 社長「タクティクスの極限のエクストリーム見れないの？」が極限チャレンジに取り違えられた)
    const tacticsPro = typeof TACTICS_PRO_MODE !== 'undefined' && modes.some(m => m.id === TACTICS_PRO_MODE.id) ? TACTICS_PRO_MODE : null;
    const tacticsAlias = tacticsPro && typeof TACTICS_MODE !== 'undefined' && !modes.some(m => m.id === TACTICS_MODE.id)
      ? [TACTICS_MODE.label, TACTICS_MODE.short].filter(Boolean).map(w => ({ w, m: tacticsPro })) : [];
    const modeWords = [...modes.flatMap(m => [m.label, m.short].filter(Boolean).map(w => ({ w, m }))), ...tacticsAlias].sort((a, b) => b.w.length - a.w.length);
    const extremeList = [...(typeof PUBLIC_EXTREME_DIFFICULTIES !== 'undefined' ? PUBLIC_EXTREME_DIFFICULTIES : []),
      ...(typeof EXTREME_DIFFICULTIES !== 'undefined' ? EXTREME_DIFFICULTIES : [])];
    const isExtremeId = (id) => (typeof isExtremeDifficultyId === 'function' ? isExtremeDifficultyId(id) : extremeList.some(st => st.id === id));
    const diffLabel = (id) => (DIFFICULTY_SETTINGS[id] && DIFFICULTY_SETTINGS[id].label) || (extremeList.find(st => st.id === id) || {}).label || id;
    const diffChoices = [
      ...Object.entries(DIFFICULTY_SETTINGS).map(([id, st]) => ({ id, label: st.label })),
      ...extremeList.filter((st, i, all) => all.findIndex(x => x.id === st.id) === i).map(st => ({ id: st.id, label: st.label })),
    ].sort((a, b) => b.label.length - a.label.length);
    // ランキング画面のタブと同じ並べ方(極限の入口は極限だけ・タクティクスは TACTICS_DIFFICULTY_IDS・チャレンジは通常+極限・ほかは通常)
    const rankingDiffIds = (mode) => {
      if (!mode) return [];
      if (extremeMode && mode.id === extremeMode.id) return (typeof PUBLIC_EXTREME_DIFFICULTIES !== 'undefined' ? PUBLIC_EXTREME_DIFFICULTIES : []).map(st => st.id);
      if (isTacticsMode(mode.id)) return typeof TACTICS_DIFFICULTY_IDS !== 'undefined' ? [...TACTICS_DIFFICULTY_IDS] : Object.keys(DIFFICULTY_SETTINGS);
      return [...Object.keys(DIFFICULTY_SETTINGS), ...(mode.id === BATTLE_MODE_CHALLENGE && typeof PUBLIC_EXTREME_DIFFICULTIES !== 'undefined' ? PUBLIC_EXTREME_DIFFICULTIES.map(st => st.id) : [])];
    };
    // 1つの発言から読み取れること
    const read = (raw) => {
      const t = norm(raw);
      const has = (word) => !!word && t.includes(norm(word));
      const song = songs.find(s => has(s.displayName)) || null;
      const rhythm = /モンヒロビート|モンビー|モンビート|音ゲー|リズム|曲/.test(raw) || !!song;
      const rhythmDiff = rhythmDiffs.find(d => new RegExp(`(^|[^a-z])${d.toLowerCase()}([^a-z]|$)`).test(String(raw).normalize('NFKC').toLowerCase())) || null;
      // モードは長い言葉から。「極限」は、ほかのモードと一緒に出たときは「そのモードの極限の難易度」の意味なので、モードとしては数えない
      const hits = modeWords.filter(x => has(x.w));
      const other = hits.find(x => !extremeMode || x.m.id !== extremeMode.id);
      const modeHit = other ? other.m : (hits[0] ? hits[0].m : null);
      const underworld = ASSISTANT_CHAT_RANKING_UNDERWORLD_WORD.test(raw);
      const extreme = ASSISTANT_CHAT_RANKING_EXTREME_WORD.test(raw) || underworld;
      const all = ASSISTANT_CHAT_RANKING_ALL_WORD.test(raw);
      const diffHit = rhythm && !/バトル/.test(raw) ? null : (diffChoices.find(d => has(d.label)) || null);
      const lineage = lineages.find(l => has(`${l.name}種`)) || lineages.find(l => has(l.name)) || null;
      const battle = /バトル|スコア|チャレンジ|難易度/.test(raw) || !!modeHit || !!diffHit || extreme;
      return {
        song, rhythm, rhythmDiff, modeHit, extreme, underworld, all, diffHit, lineage,
        battle: battle && !(rhythm && !modeHit && !diffHit && !extreme),
        week: /週間|今週/.test(raw), event: /イベント/.test(raw), total: /合算|全曲|総合/.test(raw),
        raid: /ジャック|レイド/.test(raw), breeder: /ブリーダー\s*(?:lv|ＬＶ|レベル)|ブリーダーlv/i.test(String(raw).normalize('NFKC')),
        bond: /絆/.test(raw), power: /総合力/.test(raw),
      };
    };
    const now = read(text);
    const before = prevs.map(read);
    const hasKind = (x) => x.rhythm || x.raid || x.breeder || x.bond || x.power || x.battle;
    // 難易度だけ・「全部」だけ・何も無い発言は、すぐ前の話題の続きとして読む
    const selectorOnly = !now.rhythm && !now.raid && !now.breeder && !now.bond && !now.power && !now.modeHit && !/バトル|チャレンジ/.test(text);
    let c = now;
    const ownSelector = !!(now.diffHit || now.extreme || now.all || now.rhythmDiff);
    // ランキングの言葉も難易度の指定も無い発言(「今日は晴れだね」)は、前の話題を引き継がない(毎回は読まない)
    if (selectorOnly && !topicNow && !ownSelector) return null;
    if (selectorOnly) {
      const base = before.find(hasKind);
      if (base) {
        // 前の話題の種類を使い、難易度の指定はいまの発言を優先する(いまの発言に指定が無ければ前のまま)
        const own = ownSelector;
        c = { ...base, lineage: now.lineage || base.lineage,
          diffHit: own ? now.diffHit : base.diffHit, extreme: own ? now.extreme : base.extreme, underworld: own ? now.underworld : base.underworld, all: own ? now.all : base.all,
          rhythmDiff: now.rhythmDiff || base.rhythmDiff, inherited: true };
      } else if (!topicNow && !(ownSelector && prevs.some(t => ASSISTANT_CHAT_RANKING_TOPIC.test(t)))) return null;
      // 前の話題に種類が無くても、ランキングの話の続きで「エクストリーム」「全部」などと言われたら、その指定で読む(モードが無ければ下でバトルの既定へ)
    } else if (!topicNow && !hasKind(now)) return null;
    if (c.battle && !c.modeHit && !selectorOnly) {
      // 「極限」だけなど、モードの言葉が無いバトルの話は、すぐ前に出たモードを引き継ぐ
      const m = before.find(x => x.modeHit);
      if (m) c = { ...c, modeHit: m.modeHit };
    }
    if (!c.lineage) { const l = before.find(x => x.lineage); if (l) c = { ...c, lineage: l.lineage }; }
    const lineage = c.lineage;
    const lineageMonsters = lineage && typeof dexMonsterList === 'function' ? dexMonsterList().filter(m => monsterLineageOf(m.id).main?.id === lineage.id).map(m => m.id) : [];
    // ── モンヒロビート ──
    if (c.song) {
      const diffs = c.rhythmDiff ? [c.rhythmDiff] : rhythmDiffs.filter(d => d === 'MASTER');
      diffs.forEach(d => { const key = rhythmRankingDifficultyKey(c.song.songId, d); if (key) push({ kind:'rhythmSong', keys:[key], label:`モンヒロビート「${c.song.displayName}」${d}` }); });
    }
    if (c.rhythm && c.week) push({ kind:'rhythmWeek', label:'モンヒロビート 週間ランキング' });
    if (c.rhythm && c.event && typeof rhythmLimitedEventAt === 'function') {
      const event = rhythmLimitedEventAt(Date.now());
      const range = event && typeof rhythmEventWindow === 'function' ? rhythmEventWindow(event, null) : null;
      if (event && range) {
        const bonusRates = typeof rhythmEventPlayBonusRates === 'function' ? rhythmEventPlayBonusRates(event) : null;
        push({ kind:'rhythmEvent', label:`モンヒロビート イベント「${event.title || event.name || 'イベント'}」総合`, songIds:[...event.songIds], from:new Date(range.startMs).toISOString(), to:new Date(range.endMs).toISOString(),
          fn: bonusRates ? 'rhythm_event_totals_bonus' : 'rhythm_event_totals', bonusRates: bonusRates || undefined });
      }
    }
    if (c.rhythm && (!c.song || c.total) && !c.week && !c.event) push({ kind:'rhythmTotal', label:'モンヒロビート 全曲の合算' });
    // ── ジャックのレイド ──
    if (c.raid && typeof RAID_JACK_EVENT !== 'undefined') {
      push({ kind:'raid', view:'a', eventId:RAID_JACK_EVENT.id, label:`${RAID_JACK_EVENT.name} レイドバトルの与ダメージ` });
      push({ kind:'raid', view:'b', eventId:RAID_JACK_EVENT.id, label:`${RAID_JACK_EVENT.name} グランドスラムの与ダメージ` });
    }
    // ── ブリーダーLv・絆Lv・総合力 ──
    const lineageLabel = lineage ? `(${lineage.name}種)` : '';
    if (c.breeder) push({ kind:'breeder', label:'ブリーダーLv' });
    if (c.bond) push({ kind:'bond', label:`絆Lv${lineageLabel}`, monsters: lineageMonsters });
    if (c.power) push({ kind:'power', label:`総合力${lineageLabel}`, monsters: lineageMonsters });
    // ── バトルのスコア(モード×難易度) ──
    if (c.battle) {
      // モードが分からない「極限」はエクストリーム(極限チャレンジ)、ほかはチャレンジ
      let mode = c.modeHit || (c.extreme && extremeMode && modes.some(m => m.id === extremeMode.id) ? extremeMode : null)
        || modes.find(m => m.id === BATTLE_MODE_CHALLENGE) || modes[0];
      let tabs = rankingDiffIds(mode);
      // 極限の難易度が無いモードで「極限」と言われたら、極限チャレンジのぶんを見る
      if (c.extreme && !c.diffHit && !tabs.some(isExtremeId) && extremeMode && modes.some(m => m.id === extremeMode.id)) { mode = extremeMode; tabs = rankingDiffIds(mode); }
      let ids;
      if (c.diffHit) ids = [c.diffHit.id];
      else if (c.extreme) {
        // 冥界と言われたら INFERNO・COCYTUS、極限だけなら ETERNAL までの9つ(冥界チャレンジは別のタブなので混ぜない)
        const isUw = (id) => typeof isUnderworldDifficultyId === 'function' && isUnderworldDifficultyId(id);
        ids = tabs.filter(isExtremeId).filter(id => (c.underworld ? isUw(id) : !isUw(id)));
      }
      else if (c.all || c.modeHit) ids = tabs;
      else ids = tabs.filter(id => id === 'Normal' || id === 'Master' || id === 'Legend');
      const isSpecies = mode && (mode.id === BATTLE_MODE_SPECIES_CHALLENGE || mode.id === BATTLE_MODE_TACTICS_SPECIES);
      for (const id of ids) {
        let keys = [];
        if (isSpecies) {
          const species = (typeof speciesChallengeLineages === 'function' ? speciesChallengeLineages() : []).find(l => lineage && l.id === lineage.id);
          keys = species ? [rankingDifficultyForMode(mode.id, id, species.id)] : speciesChallengeAllRankingMembers(id, mode.id);
        } else {
          keys = [rankingDifficultyForMode(isExtremeId(id) && !isTacticsMode(mode.id) && extremeMode ? extremeMode.id : mode.id, id)];
        }
        keys = keys.filter(Boolean);
        if (keys.length) push({ kind:'score', keys, label:`${mode.label}・${diffLabel(id)}${isSpecies ? (lineage ? `・${lineage.name}種` : '・全種族') : ''}のスコア` });
      }
    }
    // 何も絞れなかったときは、全体の様子が分かる基本の5つ
    if (plan.length === 0) {
      push({ kind:'breeder', label:'ブリーダーLv' });
      push({ kind:'bond', label:'絆Lv', monsters: [] });
      push({ kind:'power', label:'総合力', monsters: [] });
      push({ kind:'score', keys:[rankingDifficultyForMode(BATTLE_MODE_CHALLENGE, 'Normal')], label:'チャレンジモード・Normal のスコア' });
      push({ kind:'rhythmTotal', label:'モンヒロビート 全曲の合算' });
    }
    return plan;
  } catch (e) { return null; }
};
const ASSISTANT_CHAT_TEXT_MAX = 200;
const assistantChatSendWindow = (list) => {
  if (list.length <= ASSISTANT_CHAT_SEND_MAX) return list;
  const start = Math.ceil((list.length - ASSISTANT_CHAT_SEND_MAX) / ASSISTANT_CHAT_SEND_STEP) * ASSISTANT_CHAT_SEND_STEP;
  return list.slice(start);
};
const ASSISTANT_CHAT_LINES = {
  sorry: 'ごめん、今うまく話せないや',
  personal: 'それは大事な情報だから、ここには書かないでね',
};
// 中継役(core.js)と同じものを見る。送る前に止めるため
const ASSISTANT_CHAT_PERSONAL_PATTERNS = [
  /0\d{1,4}[-‐ー−\s]?\d{1,4}[-‐ー−\s]?\d{3,4}/,
  /[0-9０-９]{10,11}/,
  /[\w.+-]+@[\w-]+\.[\w.-]+/,
  /〒?\s?\d{3}[-‐ー−]\d{4}/,
  /(都|道|府|県).{0,8}(市|区|町|村).{0,12}\d+[-‐ー−丁番]/,
];
const assistantChatLooksPersonal = (text) => ASSISTANT_CHAT_PERSONAL_PATTERNS.some(re => re.test(String(text || '')));

// 保存値が無い・壊れているときは空にする。助手ごとに最後の30件だけ残す
const normalizeAssistantChatLog = (raw) => {
  const out = {};
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out;
  for (const [id, list] of Object.entries(raw)) {
    if (!Array.isArray(list)) continue;
    out[id] = list
      .filter(m => m && (m.role === 'user' || m.role === 'assistant') && typeof m.text === 'string' && m.text)
      .map(m => ({ role: m.role, text: m.text.slice(0, 700), ...(typeof m.e === 'string' ? { e: m.e } : {}) }))
      .slice(-ASSISTANT_CHAT_LOG_LIMIT);
  }
  return out;
};
// 1人ぶんのメモをそろえる。前の形(文字)は「前に話した話題」へ入れる
const normalizeAssistantChatMemoOne = (memo) => {
  const out = {};
  for (const [k, max] of Object.entries(ASSISTANT_CHAT_MEMO_FIELDS)) out[k] = '';
  if (typeof memo === 'string') out.topics = memo.slice(0, ASSISTANT_CHAT_MEMO_FIELDS.topics);
  else if (memo && typeof memo === 'object' && !Array.isArray(memo)) {
    for (const [k, max] of Object.entries(ASSISTANT_CHAT_MEMO_FIELDS)) if (typeof memo[k] === 'string') out[k] = memo[k].slice(0, max);
  }
  return out;
};
// 新しいキーを優先し、無い助手のぶんだけ前のキーから引き継ぐ
const normalizeAssistantChatMemo = (rawV2, rawV1) => {
  const out = {};
  const v1 = rawV1 && typeof rawV1 === 'object' && !Array.isArray(rawV1) ? rawV1 : {};
  const v2 = rawV2 && typeof rawV2 === 'object' && !Array.isArray(rawV2) ? rawV2 : {};
  for (const [id, memo] of Object.entries(v1)) if (typeof memo === 'string') out[id] = normalizeAssistantChatMemoOne(memo);
  for (const [id, memo] of Object.entries(v2)) out[id] = normalizeAssistantChatMemoOne(memo);
  return out;
};

// ===== 助手どうしの共有(段階1・2026-11-07 社長「ガッツリ作りこんで」「共有は全部」) =====
// おしゃべりのとき、ほかの助手の思い出メモも中継役へ渡す(「みゅあちんから聞きましたよ」と話題にできる)。
// 守り: 「ないしょ」の欄(secret)は渡さない・ないしょ/秘密らしい言葉を含む欄も渡さない・30日話していない助手の分は渡さない。
// 設計: docs/progress/assistant-peer-plan.md。★保存は新しいキーだけ(CLAUDE.md ⑦)
// 助手どうしの「今日」(2026-11-07 社長の決定: ゲーム全体の1日の区切りを朝4時 JST にそろえる)。
//   共通の jstDayKey4(17-release)を使う(前の loginBonusPeriodKey と中身は同じなので、保存した日付はそのまま読める)
const assistantPeerDayKey = (now = Date.now()) => jstDayKey4(now);
const ASSISTANT_CHAT_LAST_KEY = 'mh_assistant_chat_last_v1'; // { [助手id]: 'YYYY-MM-DD' } 最後に返事が来た日(assistantPeerDayKey・朝4時区切り)
const ASSISTANT_PEER_SHARE_DAYS = 30;
const ASSISTANT_PEER_SHARE_FIELDS = ['likes', 'goals', 'events', 'topics', 'summary'];
const ASSISTANT_PEER_SECRET_RE = /ないしょ|内緒|ナイショ|秘密|ひみつ|ヒミツ|だれにも言わ|誰にも言わ|言わないで/;
const normalizeAssistantChatLast = (raw) => {
  const out = {};
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out;
  for (const [id, day] of Object.entries(raw)) if (typeof day === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(day)) out[id] = day;
  return out;
};
const assistantPeerDaysBetween = (a, b) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86400000);
// selfId 以外で、30日以内に話した助手のメモ(ないしょを除く)。中身が無い助手は入れない
const assistantPeerMemosFor = (selfId, memos, last, today = assistantPeerDayKey()) => {
  const out = {};
  for (const [id, memo] of Object.entries(memos || {})) {
    if (id === selfId || !memo || typeof memo !== 'object') continue;
    const day = last && last[id];
    if (!day) continue;
    const gap = assistantPeerDaysBetween(day, today);
    if (!Number.isFinite(gap) || gap < 0 || gap > ASSISTANT_PEER_SHARE_DAYS) continue;
    const one = {};
    for (const k of ASSISTANT_PEER_SHARE_FIELDS) {
      const v = typeof memo[k] === 'string' ? memo[k].trim() : '';
      if (v && !ASSISTANT_PEER_SECRET_RE.test(v) && !assistantChatLooksPersonal(v)) one[k] = v.slice(0, ASSISTANT_CHAT_MEMO_FIELDS[k]);
    }
    if (Object.keys(one).length) out[id] = one;
  }
  return out;
};

// ===== 会話で決まる呼び方・助手へのあだ名(2026-11-08 社長・docs/progress/assistant-peer/AI-TALK-PLAN.md) =====
// 中継役が返す call:{action,value,from}・nick:{action,value} を見て、返事の下に確かめるカードを出す。変わるのは「うん」を押したときだけ。
// 印が無いとき(古い中継役・API が止まったとき)は、端末の読み取り(assistantCallnameDetect)と台本で同じカードを出す
const ASSISTANT_CALLNAME_OFFER_MS = (typeof ASSISTANT_CALLNAME_OFFER_DAYS !== 'undefined' ? ASSISTANT_CALLNAME_OFFER_DAYS : 7) * 86400000;
// 好き嫌いの口(助手部キズナ・助手ライフ)。キズナの部品が読み込まれたら、ここへ関数を入れてもらう
//   ASSISTANT_CHAT_TASTE_HOOKS.of = assistantLifeTasteOf / .onTalk = assistantLifeTasteOnTalk
//   (まだ無い関数の名前を直に書くと、見張り undefined-reference-check が止めるため。入っていなければ何もしない)
const ASSISTANT_CHAT_TASTE_HOOKS = { of: null, onTalk: null };
// 好き嫌いの手がかり。プレイヤーの文にモンスター名と良い言葉があるとき
const ASSISTANT_CHAT_TASTE_GOOD_RE = /好き|すき|かわい|可愛|カワイ|かっこい|カッコい|格好い|強い|つよい|最強|推し|いいよね|いいね|最高|大好き|きれい|綺麗/;
const assistantChatTasteFromText = (text) => {
  const ids = assistantChatMonsterIds(text, '');
  return ids.length && ASSISTANT_CHAT_TASTE_GOOD_RE.test(String(text || '')) ? { monsterId: ids[0], positive: true } : null;
};
const assistantChatTasteFromHint = (hint) => {
  if (!hint || typeof hint !== 'object' || typeof hint.monster !== 'string' || typeof hint.positive !== 'boolean') return null;
  if (typeof ALL_PLAYER_MONSTERS === 'undefined') return null;
  const m = Object.values(ALL_PLAYER_MONSTERS).find(x => x && !x.debugOnly && (x.name === hint.monster || x.id === hint.monster));
  return m ? { monsterId: m.id, positive: hint.positive } : null;
};
// 台本の行を、いまの呼び方・新しい呼び方・あだ名で埋める
const assistantCallnameFillLine = (line, { call, nick, name }) => String(line || '')
  .replace(/\{call\}/g, call || '').replace(/\{nick\}/g, nick || '').replace(/\{name\}/g, name || '');

function AssistantChatWindow({ assistant, playerName, callName, bondLevel, bondTitle, bondTone, callnameKit = null, onExchange, onClose }) {
  const id = assistant && assistant.id;
  const [logs, setLogs] = React.useState({});
  const [memos, setMemos] = React.useState({});
  const [lastDays, setLastDays] = React.useState({});
  const [loaded, setLoaded] = React.useState(false);
  const [input, setInput] = React.useState('');
  const [sending, setSending] = React.useState(false);
  const [remaining, setRemaining] = React.useState(null);
  // 返事の下に出す確かめるカード({ kind:'call'|'nick'|'reset'|'ask', value, from })。閉じると消える(保存しない)
  const [callCard, setCallCard] = React.useState(null);
  const listRef = React.useRef(null);
  React.useEffect(() => {
    let alive = true;
    (async () => {
      const [rawLog, rawMemo, rawMemoV2, rawLast] = await Promise.all([storeGet(ASSISTANT_CHAT_LOG_KEY, {}, false), storeGet(ASSISTANT_CHAT_MEMO_KEY, {}, false), storeGet(ASSISTANT_CHAT_MEMO_V2_KEY, {}, false), storeGet(ASSISTANT_CHAT_LAST_KEY, {}, false)]);
      if (!alive) return;
      setLastDays(normalizeAssistantChatLast(rawLast));
      setLogs(normalizeAssistantChatLog(rawLog));
      setMemos(normalizeAssistantChatMemo(rawMemoV2, rawMemo));
      setLoaded(true);
    })();
    return () => { alive = false; };
  }, []);
  const log = (logs[id] || []);
  // Lv6 から、助手のほうから「なんて呼んだらいい？」と1回だけ聞く(社長 ❶)。もう決めている人には聞かない(聞いたことにする)
  React.useEffect(() => {
    if (!loaded || !callnameKit || callnameKit.asked || !id) return;
    if (!(Number(bondLevel) >= ASSISTANT_CALLNAME_ASK_LEVEL)) return;
    callnameKit.markAsk({ asked: true });
    if (callnameKit.current || callnameKit.customStyle) return;
    const line = assistantCallnameFillLine(assistantCallnameLine(id, 'ask'), { name: callName });
    saveLog([...(logs[id] || []), { role: 'assistant', text: line, e: 'wink' }]);
    setCallCard({ kind: 'ask' });
  }, [loaded, id]);
  React.useEffect(() => { const el = listRef.current; if (el) el.scrollTop = el.scrollHeight; }, [log.length, sending, callCard]);
  const lastExpression = (log.slice().reverse().find(m => m.role === 'assistant') || {}).e || 'happy';

  const saveLog = (next) => {
    setLogs(prev => {
      const all = { ...prev, [id]: next.slice(-ASSISTANT_CHAT_LOG_LIMIT) };
      try { storeSet(ASSISTANT_CHAT_LOG_KEY, all, false); } catch {}
      return all;
    });
  };
  const saveMemo = (memo) => {
    setMemos(prev => {
      const all = { ...prev, [id]: normalizeAssistantChatMemoOne(memo) };
      try { storeSet(ASSISTANT_CHAT_MEMO_V2_KEY, all, false); } catch {}
      return all;
    });
  };

  const saveLastDay = () => {
    setLastDays(prev => {
      const all = { ...prev, [id]: assistantPeerDayKey() };
      try { storeSet(ASSISTANT_CHAT_LAST_KEY, all, false); } catch {}
      return all;
    });
  };

  const send = async () => {
    // ゲームが付ける印(<system-reminder>)はプレイヤーには書けない。送る前に取り除く(中継役でも取り除く)
    const text = input.replace(/<\/?\s*system[-_\s]*reminder[^>]*>/gi, '').trim().slice(0, ASSISTANT_CHAT_TEXT_MAX);
    if (!text || sending || !loaded || !id) return;
    setInput('');
    // 個人情報らしいものは送らず、保存もしない
    if (assistantChatLooksPersonal(text)) {
      saveLog([...log, { role: 'assistant', text: ASSISTANT_CHAT_LINES.personal, e: 'troubled' }]);
      return;
    }
    const withUser = [...log, { role: 'user', text }];
    saveLog(withUser);
    // 呼び方の決まり(Lv1〜2 は性格で断る日がある・助手から持ちかけてよいか)。日と助手で決まる
    const pendingCard = callCard;
    setCallCard(null);
    const shy = !!callnameKit && typeof assistantCallnameShy === 'function' && assistantCallnameShy(id, bondLevel, assistantPeerDayKey());
    const canOffer = !!callnameKit && Number(bondLevel) >= 3 && !pendingCard && (Date.now() - (callnameKit.offeredAt || 0)) >= ASSISTANT_CALLNAME_OFFER_MS;
    const callnameCtx = callnameKit ? {
      shy, canOffer, asking: !!(pendingCard && pendingCard.kind === 'ask'),
      nick: callnameKit.nick || '', hasTalked: !!callnameKit.current,
    } : null;
    let tastes = null; try { tastes = typeof ASSISTANT_CHAT_TASTE_HOOKS.of === 'function' ? ASSISTANT_CHAT_TASTE_HOOKS.of(id) : null; } catch {}
    // ランキングの計画。すぐ前のプレイヤーの発言(新しい順に2つ)から話題・モード・難易度を引き継ぐ
    const rankingPlan = assistantChatRankingPlan(text, log.filter(m => m && m.role === 'user').map(m => m.text).reverse().slice(0, ASSISTANT_CHAT_RANKING_PREV));
    setSending(true);
    let res = null;
    try {
      const breederId = await ensureBreederId();
      const r = await fetch(ASSISTANT_CHAT_URL, {
        method: 'POST',
        headers: SB_HEADERS,
        body: JSON.stringify({
          breederId: breederId || 'unknown',
          assistantId: id,
          messages: assistantChatSendWindow(withUser).map(m => ({ role: m.role, text: m.text })),
          ctx: { playerName, callName, bondLevel, bondTitle, bondTone, memo: memos[id] || null, peerMemos: assistantPeerMemosFor(id, memos, lastDays),
            ...(callnameCtx ? { callname: callnameCtx } : {}), ...(tastes ? { tastes } : {}) },
          // ランキングの話題のときだけ、読むランキングの計画を付ける(それ以外は付けない)
          ...(rankingPlan ? { ranking: rankingPlan } : {}),
        }),
      });
      if (r.ok) res = await r.json();
    } catch {}
    setSending(false);
    let reply = res && typeof res.reply === 'string' && res.reply ? res.reply : ASSISTANT_CHAT_LINES.sorry;
    let e = res && typeof res.expression === 'string' ? res.expression : 'troubled';
    // 呼び方・あだ名のカード。AI の印を先に見て、無ければ端末の読み取り(返事が来なかったときは台本の返事に置きかえる)
    if (callnameKit) {
      const replied = !!(res && res.kind === 'reply');
      const hasMark = !!(res && res.call && typeof res.call === 'object');
      let card = null;
      if (hasMark) {
        const c = res.call, n = res.nick && typeof res.nick === 'object' ? res.nick : null;
        if (c.action === 'confirm' && typeof c.value === 'string') {
          const from = c.from === 'assistant' ? 'assistant' : 'player';
          const v = assistantCallnameGuard(c.value, playerName);
          if (v && !(from === 'player' && shy) && !(from === 'assistant' && !canOffer)) card = { kind: 'call', value: v, from };
          if (card && from === 'assistant') callnameKit.markAsk({ offeredAt: Date.now() });
        } else if (c.action === 'reset' && callnameKit.current) card = { kind: 'reset' };
        else if (c.action === 'ask' && Number(bondLevel) >= ASSISTANT_CALLNAME_ASK_LEVEL) card = { kind: 'ask' };
        if (!card && n && n.action === 'confirm' && !shy) { const v = assistantNicknameGuard(n.value); if (v) card = { kind: 'nick', value: v }; }
      } else {
        const d = assistantCallnameDetect(text) || (pendingCard && pendingCard.kind === 'ask' && text.length <= 12 && !/\s/.test(text) ? { kind: 'call', value: text } : null);
        const v = d && d.kind === 'call' ? assistantCallnameGuard(d.value, playerName) : d && d.kind === 'nick' ? assistantNicknameGuard(d.value) : null;
        let lineKind = null;
        if (d && d.kind === 'reset' && callnameKit.current) { card = { kind: 'reset' }; }
        else if (d && v && shy) lineKind = d.kind === 'nick' ? 'nickShy' : 'shy';
        else if (d && v) { card = d.kind === 'nick' ? { kind: 'nick', value: v } : { kind: 'call', value: v, from: 'player' }; lineKind = d.kind === 'nick' ? 'nickConfirm' : 'confirm'; }
        // 返事が来なかったときだけ、台本の返事に置きかえる(来た返事はそのまま)
        if (!replied && lineKind) {
          reply = assistantCallnameFillLine(assistantCallnameLine(id, lineKind), { call: v ? callnameKit.fill(v) : '', nick: v || '', name: callName });
          e = /hy$/.test(lineKind) ? 'crying' : 'happy';
        }
      }
      setCallCard(card);
    }
    saveLog([...withUser, { role: 'assistant', text: reply, e }]);
    // 好き嫌いの手がかり(助手部キズナの口 assistantLifeTasteOnTalk)。返事が来た1往復だけ、1回だけ渡す。数えるのは向こう
    if (res && res.kind === 'reply' && typeof ASSISTANT_CHAT_TASTE_HOOKS.onTalk === 'function') {
      const taste = Object.prototype.hasOwnProperty.call(res, 'tasteHint') ? assistantChatTasteFromHint(res.tasteHint) : assistantChatTasteFromText(text);
      if (taste) { try { ASSISTANT_CHAT_TASTE_HOOKS.onTalk({ assistantId: id, monsterId: taste.monsterId, positive: taste.positive }); } catch {} }
    }
    if (res && Number.isFinite(res.remainingToday)) setRemaining(res.remainingToday);
    // 本当に返事が来た1往復だけ、思い出メモと仲良し度に数える(断り・失敗は数えない)
    if (res && res.kind === 'reply') {
      if (res.memo && typeof res.memo === 'object') saveMemo(res.memo);
      saveLastDay();
      if (typeof onExchange === 'function') onExchange();
      // 助手たちの今: おしゃべり1往復でにぎわいがたまる(公開の印 assistantLife の後ろ)
      if (typeof assistantLifeAddPlay === 'function') void assistantLifeAddPlay('chat');
    }
  };

  // カードを押したとき。変わるのは「うん」だけ。助手のひとことは台本(API は使わない)
  const sayLine = (kind, vars, expression = 'happy') => saveLog([...(logs[id] || []), { role: 'assistant', text: assistantCallnameFillLine(assistantCallnameLine(id, kind), { name: callName, ...vars }), e: expression }]);
  const noteLine = (text) => saveLog([...(logs[id] || []), { role: 'assistant', text, e: 'happy' }]);
  const answerCallCard = (yes, value) => {
    const card = callCard;
    setCallCard(null);
    if (!card || !callnameKit) return;
    if (card.kind === 'call' || card.kind === 'ask') {
      const v = value || card.value;
      if (yes && v) {
        const saved = callnameKit.setCall(v, card.kind === 'ask' ? 'ask' : card.from === 'assistant' ? 'offer' : 'chat');
        if (saved) sayLine('accept', { call: callnameKit.fill(saved) }, 'happy');
      } else sayLine('keep', {}, 'normal');
    } else if (card.kind === 'reset') {
      if (yes) { callnameKit.setCall(null, 'chat'); noteLine(`${assistant.name}の呼び方を元に戻しました`); }
    } else if (card.kind === 'nick') {
      if (yes) { const saved = callnameKit.setNick(card.value); if (saved) sayLine('nickAccept', { nick: saved }, 'happy'); }
    }
  };
  const callCardChoices = callCard && callCard.kind === 'ask' && callnameKit
    ? assistantCallnameChoices(id, callnameKit.current || callnameKit.customStyle || null).filter(t => callnameKit.fill(t) !== callName).slice(0, 3) : [];

  if (!assistant) return null;
  const accent = assistant.accent || '#f472b6';
  return (
    <div data-assistant-chat className="fixed inset-0 flex items-end sm:items-center justify-center bg-black/60 p-2" style={{ zIndex: 9000, paddingBottom: 'calc(0.5rem + env(safe-area-inset-bottom))' }} onClick={onClose}>
      <div className="w-full max-w-md max-h-[85vh] [[data-mh-view-rotation=true]_&]:max-h-[85vw] flex flex-col rounded-2xl border-2 bg-slate-950 text-slate-100 shadow-2xl" style={{ borderColor: accent }} onClick={ev => ev.stopPropagation()}>
        <div className="flex items-center gap-2 px-3 py-2 border-b border-slate-800 shrink-0">
          <img data-assistant-chat-face={lastExpression} src={assistantFaceSrc(assistant, lastExpression)} alt="" className="h-11 w-11 rounded-full border-2 object-cover bg-slate-900" style={{ borderColor: accent }}/>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-black" style={{ color: accent }}>{assistant.name}とおしゃべり</p>
            <p data-assistant-chat-remaining className="text-[10px] font-bold text-slate-400">{remaining == null ? '1日に話せる回数には上限があります' : `今日あと${remaining}回`}</p>
          </div>
          <button type="button" data-assistant-chat-close onClick={onClose} className="h-9 w-9 rounded-full border border-slate-600 text-slate-300 text-lg font-black active:scale-95" aria-label="閉じる">×</button>
        </div>
        <div ref={listRef} className="flex-1 overflow-y-auto mh-scroll px-3 py-2 space-y-2" style={{ minHeight: 180 }}>
          {log.length === 0 && <p className="text-[11px] text-slate-400 leading-relaxed">{helpWrap(assistant.greeting || '話しかけてみてね')}</p>}
          {log.map((m, i) => (
            <div key={i} data-assistant-chat-msg={m.role} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <p className={`max-w-[80%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-[12px] leading-relaxed ${m.role === 'user' ? 'bg-slate-700 text-white' : 'bg-slate-800/80 text-slate-100 border'}`} style={m.role === 'user' ? undefined : { borderColor: accent }}>{m.text}{m.role !== 'user' && assistantChatNoteKinds(m.text, (log.slice(0, i).reverse().find(x => x.role === 'user') || {}).text).length > 0 && (
                <span data-assistant-chat-notes className="mt-2 flex flex-wrap gap-1.5 whitespace-normal">
                  {assistantChatNoteKinds(m.text, (log.slice(0, i).reverse().find(x => x.role === 'user') || {}).text).map(k => (
                    <span key={k} className="flex flex-col items-center gap-0.5 rounded-lg bg-black/40 px-1 py-1">
                      <RhythmNoteSwatch kind={k} width={44} height={34}/>
                      <span className="text-[9px] font-bold leading-none text-slate-300">{(RHYTHM_NOTE_SWATCH_KINDS.find(x => x.id === k) || {}).label || k}</span>
                    </span>))}
                </span>)}{m.role !== 'user' && assistantChatMonsterIds(m.text, (log.slice(0, i).reverse().find(x => x.role === 'user') || {}).text).length > 0 && (
                <span data-assistant-chat-monsters className="mt-2 flex flex-wrap gap-1.5 whitespace-normal">
                  {assistantChatMonsterIds(m.text, (log.slice(0, i).reverse().find(x => x.role === 'user') || {}).text).map(id => { const mon = ALL_PLAYER_MONSTERS[id]; return (
                    <span key={id} data-assistant-chat-monster={id} className="flex w-[72px] flex-col items-center gap-0.5 rounded-lg bg-black/40 px-1 py-1">
                      <img src={mon.imgUrl || mon.faceIconUrl} alt={mon.name} loading="lazy" decoding="async" className="h-16 w-16 object-contain"/>
                      <span className="w-full truncate text-center text-[9px] font-bold leading-none text-slate-300">{mon.name}</span>
                    </span>); })}
                </span>)}</p>
            </div>
          ))}
          {callCard && callnameKit && !sending && (
            <div data-assistant-callname-card={callCard.kind}>
              <div className="rounded-2xl border-2 px-3 py-2 text-[11px] font-bold leading-relaxed text-pink-50 [word-break:keep-all] [overflow-wrap:anywhere]" style={{ borderColor: accent, background: 'rgba(244,114,182,.12)' }}>
                {callCard.kind === 'call' && <>これから「<b className="text-[13px] text-white">{callnameKit.fill(callCard.value)}</b>」って呼んでいい？</>}
                {callCard.kind === 'nick' && <>{assistant.name}のことを「<b className="text-[13px] text-white">{callCard.value}</b>」って呼ぶ？</>}
                {callCard.kind === 'reset' && <>呼び方を元に戻していい？</>}
                {callCard.kind === 'ask' && <>呼び方をえらぶか、送る欄に書いてね</>}
                {callCard.kind === 'ask' ? (<>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {callCardChoices.map(t => (
                      <button key={t} type="button" data-assistant-callname-choice={t} onClick={() => answerCallCard(true, t)}
                        className="min-h-[32px] rounded-full border bg-slate-900 px-3 text-[11px] font-black text-pink-100 active:scale-95" style={{ borderColor: accent }}>{callnameKit.fill(t)}</button>))}
                  </div>
                  <button type="button" data-assistant-callname-no onClick={() => answerCallCard(false)}
                    className="mt-1.5 min-h-[36px] w-full rounded-xl border border-slate-500 bg-slate-800 px-2 text-[11px] font-black text-slate-200 active:scale-95">いまのまま({callName})</button>
                </>) : (
                  <div className="mt-1.5 flex gap-1.5">
                    <button type="button" data-assistant-callname-yes onClick={() => answerCallCard(true)}
                      className="min-h-[36px] flex-1 rounded-xl px-2 text-[11px] font-black text-white active:scale-95" style={{ background: accent }}>{callCard.kind === 'reset' ? 'うん、戻して' : 'うん、そう呼んで'}</button>
                    <button type="button" data-assistant-callname-no onClick={() => answerCallCard(false)}
                      className="min-h-[36px] flex-1 rounded-xl border border-slate-500 bg-slate-800 px-2 text-[11px] font-black text-slate-200 active:scale-95">いまのままで</button>
                  </div>)}
              </div>
              {callCard.kind !== 'reset' && <p className="mt-1 text-center text-[10px] font-bold text-slate-400 [word-break:keep-all] [overflow-wrap:anywhere]">
                {callCard.kind === 'nick' ? 'おしゃべりの中で使うあだ名です。' : <>{callCard.kind === 'ask' ? 'えらぶと' : '「うん」を押すと'}、<span style={{ color: accent }}>{assistant.name}</span>だけ呼び方が変わります。</>}プロフィールで元に戻せます</p>}
            </div>)}
          {sending && <p data-assistant-chat-sending className="text-[11px] text-slate-400">{assistant.name}が考え中…</p>}
        </div>
        <div className="flex items-end gap-2 border-t border-slate-800 p-2 shrink-0">
          <textarea data-assistant-chat-input value={input} maxLength={ASSISTANT_CHAT_TEXT_MAX} rows={2} onChange={ev => setInput(ev.target.value)}
            placeholder="話しかけてみよう(名前や住所などは書かないでね)" className="flex-1 resize-none rounded-xl border border-slate-700 bg-slate-900 px-2 py-1.5 text-[12px] text-white"/>
          <button type="button" data-assistant-chat-send disabled={sending || !loaded || !input.trim()} onClick={send}
            className="min-h-[44px] rounded-xl px-3 text-[12px] font-black text-white active:scale-95 disabled:opacity-40" style={{ background: accent }}>送る</button>
        </div>
      </div>
    </div>
  );
}

// 呼び方が決まったあと、つぎの画面で1回だけ出す知らせ(2026-11-08)。決めた画面(HOME)では出さず、画面が変わったら4秒だけ出す。
// 🔄横(モンヒロビート)では回した器の中へ出す(rotationAwarePortalTarget)。押しても消える
function AssistantCallnameToast({ assistant, text, screen, onDone }) {
  const [from] = React.useState(screen);
  const [show, setShow] = React.useState(false);
  React.useEffect(() => { if (screen !== from) setShow(true); }, [screen, from]);
  React.useEffect(() => { if (!show) return undefined; const t = setTimeout(() => onDone && onDone(), 4000); return () => clearTimeout(t); }, [show]);
  // 出ているあいだに🔄横へ切り替えられても、回した器へ移る(出し先を見直す)
  const [, setTick] = React.useState(0);
  React.useEffect(() => { if (!show) return undefined; const t = setInterval(() => setTick(n => n + 1), 250); return () => clearInterval(t); }, [show]);
  if (!show || !assistant) return null;
  const accent = assistant.accent || '#f472b6';
  const target = typeof rotationAwarePortalTarget === 'function' ? rotationAwarePortalTarget() : document.body;
  const body = (
    <div data-assistant-callname-toast onClick={() => onDone && onDone()} className="fixed left-1/2 top-[18%] -translate-x-1/2 w-[min(320px,86%)] flex items-center gap-2.5 rounded-2xl border-2 bg-slate-950/95 px-3 py-2.5 shadow-2xl"
      style={{ borderColor: accent, zIndex: 9100 }}>
      <img src={assistantFaceSrc(assistant, 'happy')} alt="" className="h-11 w-11 shrink-0 rounded-full border-2 object-cover bg-slate-900" style={{ borderColor: accent }}/>
      <p className="min-w-0 text-[12px] font-bold leading-relaxed text-pink-50 [word-break:keep-all] [overflow-wrap:anywhere]">
        呼び方が新しくなりました<br/>
        <span className="mt-0.5 inline-block rounded-md px-1.5 text-[10px] font-black text-slate-900" style={{ background: accent }}>{text}</span>
      </p>
    </div>
  );
  return target ? ReactDOM.createPortal(body, target) : body;
}

// ===== ふだんの吹き出しを1日1回まとめて作る(2026-10-14・社長「それでいこう」) =====
// その日最初に HOME を開いたとき、遊んだ記録(数字だけ)と思い出メモを中継役へ送り、いま選んでいる助手の
// ひとことを場面ごとにまとめて作ってもらう。端末にためて、今のセリフに ASSISTANT_DAILY_LINES_RATE の割合でまぜる
// (pickAssistantLine から assistantDailyLinePick を呼ぶ)。出すのは端末からなので、待ち時間なし・電波なしでも出る。
// 作れなかった日・上限・オフラインのときは何もためず、今までどおりのセリフだけになる。
// ★公開の印 RELEASE_FLAGS.assistantDailyLines(社長が試して OK を出すまで偽)。デバッグ設定から試せる(このときは保存の日付に関係なく作り直す)
// ★保存は新しいキーだけ。日付ごとに入れ替え、古い日のものは捨てる(CLAUDE.md ⑦)
const ASSISTANT_DAILY_LINES_KEY = 'mh_assistant_daily_lines_v1'; // { day, assistantId, lines: { [場面]: [{ e, t, n }] } }  n … その日に出した回数
// 今のセリフにまぜる割合(3回に1回くらい)。ここ1か所で変えられる
const ASSISTANT_DAILY_LINES_RATE = 1 / 3;
// 同じひとことを1日に出してよい回数
const ASSISTANT_DAILY_LINE_MAX_SHOWS = 2;
const ASSISTANT_DAILY_SCENES = ['home', 'battleChallenge', 'resultWin', 'resultLose', 'rhythmHome', 'masuList', 'temple'];
const ASSISTANT_DAILY_EXPRESSIONS = ['normal', 'happy', 'wink', 'surprise', 'troubled', 'angry', 'crying', 'excited'];
// いまこの端末でまぜて出している1日ぶん(読み込んだらここへ置く)。デバッグで試しているあいだだけ真にする印も持つ
let assistantDailyLinesState = null;
let assistantDailyLinesDebugOn = false;
const assistantDailyLinesEnabled = () => assistantDailyLinesDebugOn
  || (typeof RELEASE_FLAGS !== 'undefined' && RELEASE_FLAGS.assistantDailyLines === true);
const normalizeAssistantDailyLines = (raw) => {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw) || typeof raw.day !== 'string' || typeof raw.assistantId !== 'string') return null;
  const lines = {};
  for (const scene of ASSISTANT_DAILY_SCENES) {
    const list = raw.lines && Array.isArray(raw.lines[scene]) ? raw.lines[scene] : [];
    const ok = list.filter(l => l && typeof l.t === 'string' && l.t && l.t.length <= 80 && ASSISTANT_DAILY_EXPRESSIONS.includes(l.e))
      .slice(0, 4).map(l => ({ e: l.e, t: l.t, n: Number.isFinite(l.n) ? Math.max(0, Math.floor(l.n)) : 0 }));
    if (ok.length) lines[scene] = ok;
  }
  return { day: raw.day, assistantId: raw.assistantId, lines };
};
// 端末にためた分を読む。違う日のものは捨てる(使わない)
const loadAssistantDailyLines = async () => {
  const saved = normalizeAssistantDailyLines(await storeGet(ASSISTANT_DAILY_LINES_KEY, null, false));
  assistantDailyLinesState = saved && saved.day === assistantBubbleDayKey() ? saved : null;
  return assistantDailyLinesState;
};
const saveAssistantDailyLines = () => { try { if (assistantDailyLinesState) storeSet(ASSISTANT_DAILY_LINES_KEY, assistantDailyLinesState, false); } catch {} };
// pickAssistantLine から呼ぶ。まぜる番なら1つ返す(出した回数がいちばん少ないもの)。まぜない番・無いときは null
// rand は検査から決めた値を渡せるようにしてある
const assistantDailyLinePick = (scene, assistantId, rand = Math.random()) => {
  if (!assistantDailyLinesEnabled()) return null;
  const st = assistantDailyLinesState;
  if (!st || st.day !== assistantBubbleDayKey() || st.assistantId !== assistantId) return null;
  const list = (st.lines[scene] || []).filter(l => l.n < ASSISTANT_DAILY_LINE_MAX_SHOWS);
  if (!list.length || rand >= ASSISTANT_DAILY_LINES_RATE) return null;
  const least = Math.min(...list.map(l => l.n));
  const pool = list.filter(l => l.n === least);
  const picked = pool[Math.floor((rand / ASSISTANT_DAILY_LINES_RATE) * pool.length) % pool.length];
  picked.n += 1;
  saveAssistantDailyLines();
  return { e: picked.e, t: picked.t, daily: true };
};
// 遊んだ記録(数字と短い名前だけ)を組み立てる。会話の本文は入れない
const buildAssistantDailyStats = ({ breederLevel, bondLevel, masuMons, rhythmBestRecords, highScores }) => {
  const songs = (typeof RHYTHM_SONGS !== 'undefined' && Array.isArray(RHYTHM_SONGS)) ? RHYTHM_SONGS : [];
  const songName = (id) => { const s = songs.find(x => x && x.songId === id); return s ? String(s.displayName || s.title || id) : id; };
  const rhythm = [];
  for (const [songId, byDiff] of Object.entries(rhythmBestRecords || {})) {
    for (const [diff, r] of Object.entries(byDiff || {})) {
      if (r && r.played && Number(r.bestScore) > 0) rhythm.push({ 曲: songName(songId), 難易度: diff, 自己ベスト: Math.floor(Number(r.bestScore)), クリア: !!r.clear, フルコンボ: !!r.fullCombo });
    }
  }
  rhythm.sort((a, b) => b.自己ベスト - a.自己ベスト);
  const monsters = (typeof ALL_PLAYER_MONSTERS !== 'undefined' && Array.isArray(ALL_PLAYER_MONSTERS)) ? ALL_PLAYER_MONSTERS : [];
  const masu = (Array.isArray(masuMons) ? masuMons : []).map(m => ({
    名前: String((m && m.name) || '').slice(0, 20),
    種族: String(((monsters.find(x => x && x.id === (m && m.baseId)) || {}).name) || (m && m.baseId) || ''),
    絆Lv: (typeof masuBondLevelInfo === 'function') ? masuBondLevelInfo(m).level : null,
  })).sort((a, b) => (b.絆Lv || 0) - (a.絆Lv || 0));
  const battle = Object.entries(highScores || {}).filter(([, v]) => Number(v) > 0).map(([d, v]) => ({ 難易度: d, ハイスコア: Math.floor(Number(v)) }));
  return {
    ブリーダーLv: Number.isFinite(breederLevel) ? breederLevel : null,
    仲良し度Lv: Number.isFinite(bondLevel) ? bondLevel : null,
    マスモンの数: masu.length,
    よく育てているマスモン: masu.slice(0, 3),
    モンヒロビートの自己ベスト: rhythm.slice(0, 3),
    モンヒロビートで遊んだ譜面の数: rhythm.length,
    バトルのハイスコア: battle.slice(0, 3),
  };
};
// 中継役へ頼んで、その日のぶんをためる。force … デバッグから(日付が同じでも作り直す)
// 戻り値: 'ok' | 'cached' | 'failed'
const fetchAssistantDailyLines = async ({ assistantId, ctx, stats, force = false }) => {
  const day = assistantBubbleDayKey();
  const saved = await loadAssistantDailyLines();
  if (!force && saved && saved.assistantId === assistantId) return 'cached';
  try {
    const breederId = await ensureBreederId();
    const r = await fetch(ASSISTANT_CHAT_URL, {
      method: 'POST', headers: SB_HEADERS,
      body: JSON.stringify({ kind: 'daily_lines', breederId: breederId || 'unknown', assistantId, scenes: ASSISTANT_DAILY_SCENES, ctx, stats }),
    });
    const res = r.ok ? await r.json() : null;
    const next = res && res.ok === true ? normalizeAssistantDailyLines({ day, assistantId, lines: res.lines }) : null;
    if (!next || !Object.keys(next.lines).length) return 'failed';
    assistantDailyLinesState = next;
    saveAssistantDailyLines();
    return 'ok';
  } catch { return 'failed'; }
};
// 思い出メモ(おしゃべりのもの)を、その助手のぶんだけ読む(ひとことの材料に渡す)
const loadAssistantChatMemoFor = async (assistantId) => {
  const [v1, v2] = await Promise.all([storeGet(ASSISTANT_CHAT_MEMO_KEY, {}, false), storeGet(ASSISTANT_CHAT_MEMO_V2_KEY, {}, false)]);
  return normalizeAssistantChatMemo(v2, v1)[assistantId] || null;
};

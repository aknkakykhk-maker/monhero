// モンヒロサクセスの称号の表(2026-11-12 開発部)
// 案: docs/progress/player-raise/TITLES.md(一覧・取り方・決めたこと)/ TOURNAMENT.md §8 / EVENTS.md ②・4-⑥
//
// ★画面なし・保存なし。いまは index.html から読まれず、誰にも見えない(画面は回3)。
// ★称号は「名誉だけ」(持っていても強さは変わらない)。取ったときのごほうびは芯(monhero-success.js)が付ける。
//   reward はそのごほうびの説明文(画面の「称号獲得!!」の札に出す)。数字は芯の表と同じ物差し。
// ★芯は育成中に s.titles へ「文字」を積む(例: 'はじめの一歩'・'mua:お話の結末(いい結末)')。
//   resolve(文字) でこの表の行に引き当てる。保存枠の子(mh_monsuc_box_v1 の titles)には id を入れる(名前を直しても記録が変わらない)。
//   知らない文字はそのまま残し、画面ではその文字を出す(消さない・CLAUDE.md ⑦)。
//
//   group … cup(大会)/ crown(👑)/ conquer(制覇)/ summit(ヒーローズファイナル)/ rival(ライバル)/ story(助手のお話)/ issa(イッサ博士)/ grade(評価)/ feat(育成の記録)
//   how   … 取り方(プレイヤー向けの1行)/ reward … 取ったときに芯が付けるもの(無ければ null)/ effect … 持っている間の効き目(第1弾はすべて null)
//   match … 芯が s.titles に積む文字(いまの芯が積んでいない行は null。芯が積むようになったらこの文字で積む)
//   rare  … 1〜3(札の色: 1 銅・2 銀・3 金)
(function (root) {
  'use strict';

  const ASSIST_NAMES = Object.freeze({ mua: 'みゅあ', kiki: 'きき', momosuke: 'ももすけ', dra: 'ドラ', atsu: 'あつ', kyuko: 'きゅうこ', sorashido: 'ソラシド', erubin: 'えるびん' });
  // 芯の SC_NAME と同じ(シナリオの大会)
  const SC_CUP = Object.freeze({ mua: '笑顔の大会', kiki: '静かな一撃の大会', momosuke: '人気投票の大会', dra: '技くらべの大会', atsu: '格上への挑戦', kyuko: 'ピークの大会', sorashido: '計算どおりの大会', erubin: '見守りの大会' });
  // 助手のお話の結末の称号(いい結末 / ほろ苦い結末)。お話の4話(EVENTS.md ②)にちなむ
  const STORY_TITLE = Object.freeze({
    mua: ['みんなに届いた声', '届きかけた声'],
    atsu: ['約束を果たした子', 'もう一度の約束'],
    kiki: ['静けさを継ぐ子', '静かな背中'],
    momosuke: ['客席いっぱいの拍手', 'いつかの一票'],
    dra: ['ドラの直弟子', 'ドラの宿題'],
    kyuko: ['計画表のその先', '書き直しの計画表'],
    sorashido: ['組み直しの名人', '検証のつづき'],
    erubin: ['ふたつの食卓', '見守られた子'],
  });
  const STORY_REWARD = Object.freeze({
    mua: ['全能力 特大アップ・技「みんなの声」のひらめき', '人気 大アップ'],
    atsu: ['全能力 特大アップ・アシスト能力「試合のはじめのガッツ」のひらめき', '能力ポイント +10'],
    kiki: ['全能力 特大アップ・技「静かな一撃」のひらめき', '丈夫さ 大アップ'],
    momosuke: ['全能力 特大アップ・アシスト能力「見せ場」のひらめき', '人気 大アップ'],
    dra: ['全能力 特大アップ・技「ドラ直伝」のひらめき', '技の熟練アップ'],
    kyuko: ['全能力 特大アップ・アシスト能力「見立て」のひらめき', 'かしこさ 大アップ'],
    sorashido: ['全能力 特大アップ・アシスト能力「検証」のひらめき', '能力ポイント +10'],
    erubin: ['全能力 特大アップ・アシスト能力「見守り」のひらめき', '忠誠度 大アップ'],
  });

  const rows = [];
  const add = (r) => rows.push(Object.freeze({ effect: null, reward: null, match: null, rare: 1, ...r }));

  // ---- 大会(期末の強制大会・芯の FORCED) ----
  add({ id: 'debut', group: 'cup', name: 'はじめの一歩', how: 'デビュー戦に1回目で勝つ', reward: '人気 +3・能力ポイント +5', match: 'はじめの一歩' });
  add({ id: 'debut-late', group: 'cup', name: '遅咲きの一歩', how: 'デビュー戦に負けたあと、再挑戦で勝つ', reward: '人気 +3・能力ポイント +5', match: '遅咲きの一歩' });
  add({ id: 'junior', group: 'cup', name: 'ジュニアの星', how: 'ジュニア期の終わりのヒーローズリーグで優勝する', reward: '全能力 +2・能力ポイント +5・人気 +2', match: 'ジュニアの星' });
  add({ id: 'middle', group: 'cup', name: 'ミドルの星', how: 'ミドル期の終わりのヒーローズリーグで優勝する', reward: '全能力 +3・能力ポイント +10・人気 +4', match: 'ミドルの星', rare: 2 });

  // ---- ★★★ の大会(TOURNAMENT §8: 系統ごと。芯はまだ積んでいない) ----
  const STAR3 = [
    ['str', 'ちから自慢の王者', 'ちから自慢'], ['int', 'かしこさ自慢の王者', 'かしこさ自慢'], ['aim', 'ねらい自慢の王者', 'ねらい自慢'],
    ['dodge', 'かわし自慢の王者', 'かわし自慢'], ['hard', 'かたさ自慢の王者', 'かたさ自慢'], ['life', 'しぶとさ自慢の王者', 'しぶとさ自慢'],
    ['dist0', '零の間合いの名手', '間合い(零)'], ['dist1', '近の間合いの名手', '間合い(近)'], ['dist2', '中の間合いの名手', '間合い(中)'], ['dist3', '遠の間合いの名手', '間合い(遠)'],
    ['attacker', 'アタッカーの誇り', 'タイプ(アタッカー)'], ['tank', 'タンクの誇り', 'タイプ(タンク)'], ['supporter', 'サポーターの誇り', 'タイプ(サポーター)'],
    ['healer', 'ヒーラーの誇り', 'タイプ(ヒーラー)'], ['shadow', 'シャドウの誇り', 'タイプ(シャドウ)'],
  ];
  STAR3.forEach(([cup, name, cupName]) => add({ id: `star3-${cup}`, group: 'cup', name, how: `${cupName}の ★★★ で優勝する`, cup, rare: 2 }));

  // ---- シナリオの大会(芯: ★★★ 以上で優勝すると「<大会名>の優勝」) ----
  Object.keys(SC_CUP).forEach(aid => add({ id: `sc-${aid}`, group: 'cup', name: `${SC_CUP[aid]}の優勝`, how: `${ASSIST_NAMES[aid]}のシナリオの「${SC_CUP[aid]}」(★★★)で優勝する`, match: `${SC_CUP[aid]}の優勝`, aid, rare: 2 }));

  // ---- 👑(ヒーロー記念) ----
  add({ id: 'crown-winter', group: 'crown', name: '冬のヒーロー記念の覇者', how: 'プロ期の終わりのヒーローズリーグで優勝する', reward: '全能力 +4・能力ポイント +20・人気 +8', match: 'ヒーロー記念', rare: 3 });
  add({ id: 'crown-summer', group: 'crown', name: '夏のヒーロー記念の覇者', how: '「夏のヒーロー記念」で優勝する', rare: 3 });

  // ---- 制覇(TOURNAMENT §8。芯はまだ積んでいない) ----
  add({ id: 'conquer-pride', group: 'conquer', name: '六つの自慢', how: '6つの自慢の大会でどれも1回は優勝する(星は問わない)', reward: '全能力 +5・能力ポイント +15・人気 +10', rare: 3 });
  add({ id: 'conquer-season', group: 'conquer', name: '四季を知る子', how: '同じ1年のうちに四季の大会を4つとも優勝する', reward: '全能力 +3・能力ポイント +15・人気 +8', rare: 3 });
  add({ id: 'conquer-dist', group: 'conquer', name: '間合いの達人', how: '零・近・中・遠の間合いの大会をどれも1回は優勝する', reward: '全能力 +3・能力ポイント +15・いちばん低い間合いの適性が1段上がる', rare: 3 });

  // ---- ヒーローズファイナル(芯の SUMMIT_FINAL) ----
  add({ id: 'summit', group: 'summit', name: 'ヒーローズファイナル王者', how: 'ヒーローズファイナルで優勝する', reward: '全能力 +8・能力ポイント +30・人気 +10', match: 'ヒーローズファイナル王者', oldMatch: ['頂に立った子'], rare: 3 }); // 2026-11-14 名前を直した。前の育成・保存枠に積まれた古い文字(oldMatch)も同じ行に引き当てる
  add({ id: 'summit-big', group: 'summit', name: '真のヒーロー', how: '👑 を1つ以上勝つか四大大会を2つ以上勝ったうえで、ヒーローズファイナルで優勝する', reward: '全能力 +15・能力ポイント +60・人気 +20', match: '真のヒーロー', oldMatch: ['ヒーローの頂'], rare: 3 });

  // ---- ライバル(芯の RIVAL) ----
  // 大会の第2版(2026-11-13)
  add({ id: 'derby', group: 'cup', name: '若き挑戦者', how: 'ジュニア期の大一番「モンスターダービー」で優勝する', reward: '体力の最大値 +15・能力ポイント +15・人気 +6', match: '若き挑戦者', rare: 3 });
  add({ id: 'four-done', group: 'conquer', name: '四大の覇者', how: '四大大会(グレイテスト4・M-1グランプリ・ウィナーズ杯・ワールドモンスターズ杯)を4つとも優勝する', reward: '全能力 +15・能力ポイント +40・人気 +15', match: '四大の覇者', rare: 3 });
  add({ id: 'rival', group: 'rival', name: 'ライバルに勝った', how: 'ライバルが出ている大会で優勝する', reward: '全能力 +12・賞金 1.5倍・修行チケット +1', match: 'ライバルに勝った', rare: 2 });

  // ---- 助手のお話(芯: '<aid>:お話の結末(いい結末)' / '(ほろ苦い結末)') ----
  Object.keys(STORY_TITLE).forEach(aid => {
    add({ id: `story-${aid}-good`, group: 'story', name: STORY_TITLE[aid][0], how: `${ASSIST_NAMES[aid]}のお話を、いい結末で見終える`, reward: STORY_REWARD[aid][0], match: `${aid}:お話の結末(いい結末)`, aid, rare: 3 });
    add({ id: `story-${aid}-bitter`, group: 'story', name: STORY_TITLE[aid][1], how: `${ASSIST_NAMES[aid]}のお話を、ほろ苦い結末で見終える`, reward: STORY_REWARD[aid][1], match: `${aid}:お話の結末(ほろ苦い結末)`, aid, rare: 2 });
  });

  // ---- イッサ博士 ----
  add({ id: 'issa-power', group: 'issa', name: '秘めた力', how: 'イッサ博士の「ステータスアップ」の実験が成功する', reward: '全能力 +50', match: '秘めた力', rare: 3 });
  add({ id: 'issa-pupil', group: 'issa', name: '博士の一番弟子', how: '1回の育成でイッサ博士の実験を3回とも成功させる', rare: 3 });

  // ---- 評価(引退のときの育成ランク。いちばん上の1つだけ付く) ----
  const GRADE = [['B', '一人前のヒーロー', 1], ['A', '腕ききヒーロー', 2], ['S', 'スターヒーロー', 2], ['SS', '語りつがれるヒーロー', 3], ['M', 'モンスターヒーロー', 3]];
  GRADE.forEach(([rank, name, rare]) => add({ id: `grade-${rank}`, group: 'grade', name, how: rank === 'SS' ? '育成ランク SS か SSS で引退する' : `育成ランク ${rank}${rank === 'M' ? '' : ' 以上'}で引退する`, rank, rare }));

  // ---- 育成の記録(引退のときに見る) ----
  add({ id: 'feat-loyal', group: 'feat', name: 'ゆるがない絆', how: '忠誠度 100 で引退する', rare: 2 });
  add({ id: 'feat-pop', group: 'feat', name: 'みんなの人気者', how: '人気 100 で引退する', rare: 2 });
  add({ id: 'feat-techs', group: 'feat', name: '技の宝庫', how: '技を8つ覚えて引退する', rare: 2 });

  const TITLES = Object.freeze(rows);
  const BY_ID = Object.freeze(Object.fromEntries(TITLES.map(t => [t.id, t])));
  const BY_MATCH = Object.freeze(Object.fromEntries(TITLES.filter(t => t.match).flatMap(t => [[t.match, t], ...(Array.isArray(t.oldMatch) ? t.oldMatch.map(m => [m, t]) : [])])));
  const GROUPS = Object.freeze([
    ['cup', '大会'], ['crown', 'ヒーロー記念'], ['conquer', '制覇'], ['summit', 'ヒーローズファイナル'], ['rival', 'ライバル'],
    ['story', '助手のお話'], ['issa', 'イッサ博士'], ['grade', '評価'], ['feat', '育成の記録'],
  ].map(([key, name]) => Object.freeze({ key, name })));

  // 芯が積んだ文字 → 表の行(id でも引ける)。知らないものは null
  const resolve = (str) => (typeof str !== 'string' ? null : BY_MATCH[str] || BY_ID[str] || null);

  // 引退のときに付く称号(評価・育成の記録・博士の一番弟子)。ev は芯の evaluate(s)、s は育成の状態
  const RANK_ORDER = ['G', 'F', 'E', 'D', 'C', 'B', 'A', 'S', 'SS', 'SSS', 'M'];
  const atRetire = (ev, s) => {
    const e = ev && typeof ev === 'object' ? ev : {}; const st = s && typeof s === 'object' ? s : {};
    const out = [];
    const ri = RANK_ORDER.indexOf(e.rank);
    const grade = GRADE.slice().reverse().find(([rank]) => ri >= RANK_ORDER.indexOf(rank));
    if (ri >= 0 && grade) out.push(`grade-${grade[0]}`);
    if (Number.isFinite(e.loyal) && e.loyal >= 100) out.push('feat-loyal');
    if (Number.isFinite(e.pop) && e.pop >= 100) out.push('feat-pop');
    if (Number.isFinite(e.techs) && e.techs >= 8) out.push('feat-techs');
    if (Number.isFinite(st.issaWon) && st.issaWon >= 3) out.push('issa-pupil');
    return out;
  };

  // 保存枠の子に書く titles(id の配列・表の順・重なりなし)。表にない文字はそのまま後ろに残す(⑦ 消さない)
  const finalize = (runTitles, ev, s) => {
    const ids = new Set(); const raw = [];
    for (const t of Array.isArray(runTitles) ? runTitles : []) {
      const r = resolve(t);
      if (r) ids.add(r.id); else if (typeof t === 'string' && t && !raw.includes(t)) raw.push(t.slice(0, 64));
    }
    atRetire(ev, s).forEach(id => ids.add(id));
    return [...TITLES.filter(t => ids.has(t.id)).map(t => t.id), ...raw].slice(0, 64);
  };

  // 画面に出す名前(id でも芯の文字でもよい。知らない文字はそのまま)
  const nameOf = (str) => { const r = resolve(str); return r ? r.name : (typeof str === 'string' ? str : ''); };

  const api = Object.freeze({ TITLES, BY_ID, GROUPS, ASSIST_NAMES, resolve, atRetire, finalize, nameOf });
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.MONHERO_SUCCESS_TITLES = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);

// 見た目の点検(r1119-014 PR3): モンヒロ全体の「撮る場面」の一覧。
//
// どの場面も、ボット用のまっさらなブラウザに「しばらく遊んでいる人」の種(tools/playbot/lib/seeds.js の veteranSeed)を入れ、
// HOME から人と同じボタンを押して開く。デバッグの合言葉・DEBUG MENU は使わない。通信はにせの Supabase が受け止める
// (本番の保存・ランキングへは送らない。tools/playbot/lib/session.js)。
//
// 1件 = { id(英数字・止め絵のファイル名), area(画面のまとまり), name(日本語の名前), go(s) … HOME から開く手順 }
//   go は true/false を返す(開けなかったら false。報告に「開けなかった」と出る)。
//   steps(正規表現の並び)だけで足りる場面は via([...]) で書く。
// group: 'monsuc' の場面は既定では撮らない(モンサクは直しの公開のあとに回す。--with-monsuc で撮る)。
// モンサクの奥の画面(育成の途中・大会・合体など約200場面)は、既存の撮影の道具を使う(下の MONSUC_DEEP。visual-shoot.js --monsuc-deep)。
'use strict';

// 正規表現の並びを、HOME から順に押す
// ★小さい横(568×320)ではボタンが画面の下に隠れていることが多いので、見えていなければスクロールして出してから押す
const tapAny = async (s, re) => {
  if (await s.tapLabel(re, 1500)) return true;
  const hit = await s.page.evaluate((src) => {
    const re = new RegExp(src);
    const els = [...document.querySelectorAll('button, [role="button"], a[href]')].filter((el) => !el.disabled && el.getClientRects().length);
    const el = els.find((x) => re.test((x.getAttribute('aria-label') || x.innerText || '').replace(/\s+/g, ' ').trim()));
    if (!el) return false;
    el.scrollIntoView({ block: 'center', inline: 'center' });
    return true;
  }, re.source).catch(() => false);
  if (!hit) return false;
  await s.wait(500);
  return s.tapLabel(re, 1500);
};
// keepLast … 最後に開くのが窓(「閉じる」の付いた更新履歴・音量設定など)のとき。押したあとに重なりを閉じると、
//   開いた窓そのものを閉じて親の画面を撮ってしまう(2026-11-21 r1119-066④。点検で「開いていない」と出た4場面の原因)
const via = (steps, { keepLast = false } = {}) => async (s) => {
  for (let i = 0; i < steps.length; i++) {
    if (!(await tapAny(s, steps[i]))) return false;
    if (keepLast && i === steps.length - 1) { await s.wait(900); break; }
    await s.dismissOverlays(6);
  }
  return true;
};

// イベント回想を開く(プロフィール → イベント回想 → 先頭のまとまり)。end=true なら1話目を再生して締めの「終わり」まで送る
const openReplay = async (s, end) => {
  if (!(await via([/^プロフィールを開く$/])(s))) return false;
  const click = (sel, re) => s.page.evaluate(([q, r]) => { const b = [...document.querySelectorAll(q)].find((x) => !r || new RegExp(r).test(x.innerText || '')); if (!b) return false; b.scrollIntoView({ block: 'center' }); b.click(); return true; }, [sel, re]).catch(() => false);
  // 2026-11-23 プロフィール案B: 扉「思い出」→ ジャンル「期間イベント」→ シリーズ。案B より前の版(撮り比べの main 側)は一番下の「イベント回想」から
  if (!(await click('[data-profile-door="memories"]')) && !(await click('button', 'イベント回想'))) return false;
  await s.wait(900);
  if (await click('[data-event-replay-genre="event"]')) await s.wait(700);
  if (!(await click('[data-event-replay-group]'))) return false;
  await s.wait(900);
  if (!end) return true;
  if (!(await click('[data-event-replay-episodes] button'))) return false;
  await s.wait(1200);
  for (let i = 0; i < 200; i++) {
    if (await s.page.evaluate(() => /終\s*わ\s*り/.test(document.body.innerText)).catch(() => false)) { await s.wait(1500); return true; }
    const title = await s.page.evaluate(() => /タップで始まります/.test(document.body.innerText)).catch(() => false);
    const hit = !title && (await click('button', '^\\s*(次へ|つぎへ|続ける)'));
    if (!hit) await s.page.mouse.click(s.page.viewportSize().width / 2, s.page.viewportSize().height * 0.75).catch(() => {});
    await s.wait(300);
  }
  return false;
};

// HOME の札をラベル(aria-label か文字)で押す
const homeBtn = (label) => async (s) => {
  const ok = await s.page.evaluate((l) => {
    const b = [...document.querySelectorAll('button')].find((x) => (x.getAttribute('aria-label') || x.innerText || '').trim() === l);
    if (b) b.click();
    return !!b;
  }, label);
  await s.wait(1800);
  await s.dismissOverlays(10);
  return ok;
};
const then = (first, steps, opts) => async (s) => (await first(s)) && via(steps, opts)(s);

// モンヒロバトルの仕組み(クラシック・タクティクス・クイック)の画面
const battleSystem = (id) => async (s) => {
  if (!(await homeBtn('モンヒロバトル')(s))) return false;
  const ok = await s.page.evaluate((x) => { const b = document.querySelector(`[data-battle-system="${x}"]`); if (b && !b.disabled) b.click(); return !!b && !b.disabled; }, id);
  await s.wait(1500);
  await s.dismissOverlays(40);
  return ok;
};

// 対戦の画面まで進む(仕組み → モードの「難易度を選ぶ」 → 挑戦できる難易度 → 先頭の子 → 勇者モンに選ぶ → 距離 → アシストカードを1枚覚える)。
// ★playbot の enterQuickBattle は勇者モンの札の探し方が今の画面と合わず(「くわしく見る」が札の中に無い)一覧で止まり、
//   小さい横では画面の外のボタンを押せないので、ここでは全部 tapAny(見えなければスクロールして押す)で進む
const pickMode = (mode) => async (s) => {
  const r = await s.page.evaluate((id) => {
    const cards = [...document.querySelectorAll(`[data-battle-mode="${id}"]`)];
    const card = cards[0];
    if (!card) return 'no-card';
    card.scrollIntoView({ block: 'center', inline: 'center' });
    const b = [...card.querySelectorAll('button')].find((x) => /難易度を選ぶ|遊ぶ|挑戦/.test(x.textContent));
    if (!b) return 'no-button';
    if (b.disabled) return 'locked';
    b.click();
    return 'ok';
  }, mode);
  await s.wait(1500);
  await s.dismissOverlays(10);
  return r === 'ok';
};
// ★横・PC では難易度の札が何枚も並んで見え、選ばれていない札のボタンを押すと「その札を選ぶ」だけで始まらない。
//   選ばれた札(article.on)のボタンを押し、勇者モンの画面へ進んだかを見る。進まなければ前の難易度へ送ってやり直す
const pickDifficulty = async (s) => {
  for (let i = 0; i < 10; i++) {
    const r = await s.page.evaluate(() => {
      const card = document.querySelector('article[data-difficulty-card].on') || document.querySelector('article[data-difficulty-card]');
      const b = card && [...card.querySelectorAll('button')].find((x) => /この難易度で挑戦/.test(x.innerText || ''));
      if (!b) return 'none';
      if (b.disabled) return 'locked';
      b.scrollIntoView({ block: 'center', inline: 'center' });
      b.click();
      return 'ok';
    }).catch(() => 'none');
    if (r === 'none' && !(await tapAny(s, /この難易度で挑戦/))) return false;
    await s.wait(1500);
    await s.dismissOverlays(6);
    if (/勇者モン|編成|枠/.test(await s.screenName()) || (await s.page.evaluate(() => !!document.querySelector('[data-pro-party]')))) return true;
    if (r === 'locked' && !(await tapAny(s, /^前の難易度$/))) return false;
  }
  return false;
};
const startBattle = async (s, system, mode = 'challenge') => {
  if (!(await battleSystem(system)(s))) return false;
  if (system !== 'systemQuick' && !(await pickMode(mode)(s))) return false;
  if (!(await pickDifficulty(s))) return false;
  await s.dismissOverlays(6);
  if (!(await tapAny(s, /総合力/))) return false;
  await tapAny(s, /勇者モンに選ぶ/);
  await tapAny(s, /^(零|近|中|遠)距離/);
  await s.dismissOverlays();
  if (await tapAny(s, /新規習得/)) await tapAny(s, /^習得する$/);
  await s.wait(2500);
  await s.dismissOverlays(6);
  return s.page.evaluate(() => !!document.querySelector('button[aria-label^="AUTO"]'));
};
// タクティクスプロの編成(上の枠へ入れる → 勇者モンを選ぶ → 置き場所・アシストカード)を、playbot の tactics.js と同じ順で押して対戦まで進む
const startTactics = async (s) => {
  if (!(await battleSystem('systemTactics')(s)) || !(await pickMode('tacticsPro')(s)) || !(await pickDifficulty(s))) return false;
  for (let i = 0; i < 40; i++) {
    if (await s.page.evaluate(() => /WAVE 1\/\d+/.test(document.body.innerText) && !!document.querySelector('[data-battle-action]'))) return true;
    await s.dismissOverlays(4);
    const step = await s.page.evaluate(() => {
      const live = [...document.querySelectorAll('button')].filter((x) => x.offsetParent && !x.disabled);
      const pick = (re) => live.find((x) => re.test(x.textContent.trim()));
      if (document.querySelector('[data-pro-party]')) {
        const done = document.querySelector('[data-pro-party-done]');
        if (done) {
          if (!done.disabled) { done.click(); return 'done'; }
          const h = document.querySelector('[data-pro-party-slot][aria-label$="を勇者モンにする"]');
          if (h) { h.click(); return 'hero'; }
        }
        const next = document.querySelector('[data-pro-party-next]');
        if (next && !next.disabled) { next.click(); return 'next'; }
        const put = live.find((x) => /を枠に入れる$/.test(x.getAttribute('aria-label') || ''));
        if (put) { put.click(); return 'put'; }
        const chosen = new Set([...document.querySelectorAll('[data-pro-party-slot][aria-label$="を枠から外す"]')].map((x) => x.getAttribute('aria-label').replace(/を枠から外す$/, '')));
        const t = [...document.querySelectorAll('[data-pro-pick-scroll] button[aria-label$="を見る"]')].find((x) => !x.disabled && !chosen.has(x.getAttribute('aria-label').replace(/を見る$/, '')));
        if (t) { t.click(); return 'focus'; }
      }
      const go = pick(/出撃|バトル開始|この編成で|この子で挑む|供モン\d*にする|(?:始|はじ)める|^決定$|^確定$/); if (go) { go.click(); return 'go'; }
      const c = pick(/^(習得する|強化する)$/) || pick(/新規習得|強化後/) || pick(/^(零|近|中|遠)距離/); if (c) { c.click(); return 'c'; }
      const m = live.find((x) => /総合力/.test(x.textContent) && !/DEBUG/.test(x.textContent)); if (m) { m.click(); return 'mon'; }
      return null;
    }).catch(() => null);
    if (!step) break;
    await s.wait(900);
  }
  return s.page.evaluate(() => /WAVE 1\/\d+/.test(document.body.innerText) && !!document.querySelector('[data-battle-action]'));
};
const heroSelect = async (s) => {
  if (!(await battleSystem('systemClassic')(s)) || !(await pickMode('challenge')(s)) || !(await pickDifficulty(s))) return false;
  await s.dismissOverlays(6);
  return /勇者モン/.test(await s.screenName());
};

// ---- モンサク(HOME の入口から開く場面。2026-11-19 社長「API 通し点検を早く」で足した) ----
// β版のお話(11ページと最後の選択肢)を閉じて、モンサクのホームを出す
const monsucHome = async (s, { keepStory = false } = {}) => {
  if (!(await homeBtn('モンヒロサクセス β')(s))) return false;
  if (keepStory) return s.page.evaluate(() => !!document.querySelector('[data-msx-view="home"]'));
  await s.page.evaluate(async () => {
    for (let i = 0; i < 30; i++) {
      const o = document.querySelector('.msx-beta-ov');
      if (!o) break;
      const b = o.querySelector('button');
      (b || o.querySelector('.msx-beta-card') || o).click();
      await new Promise((r) => setTimeout(r, 400));
    }
  }).catch(() => {});
  await s.wait(800);
  return s.page.evaluate(() => !!document.querySelector('[data-msx-view="home"]') && !document.querySelector('.msx-beta-ov'));
};
// モンサクのホームの札(文字で探す)を押す
const monsucTile = (re, after = []) => async (s) => {
  if (!(await monsucHome(s))) return false;
  const ok = await s.page.evaluate((src) => {
    const b = [...document.querySelectorAll('.msx button')].find((x) => x.getClientRects().length && new RegExp(src).test((x.innerText || '').replace(/\s+/g, ' ')));
    if (b) b.click();
    return !!b;
  }, re.source);
  await s.wait(1500);
  return ok && via(after)(s);
};
// ランキングの偽の行(本番のサーバーへは送らない。にせの Supabase の表に置くだけ)。名前は架空
const RANK_SPECIES = ['Mocchi', 'Golem', 'Tiger', 'Pixie', 'Suezo', 'Undine', 'Kyubi', 'Snegurochka'];
const fakeRankRows = (beta) => RANK_SPECIES.flatMap((sp, i) => [0, 1].map((k) => {
  const n = i * 2 + k;
  const base = 880 - n * 37 - (beta === 1 ? 40 : 0);
  const st = { life: base + 40, pow: base - 20, wise: base - 120, hit: base + 10, eva: base - 60, tough: base + 25 };
  return { run_id: `vis-${beta}-${n}`, user_name: `ブリーダー${String.fromCharCode(0x30a2 + n * 2)}`, child_name: ['もちまる', 'ごろた', 'とらきち', 'ぴくる', 'すえぞう', 'みなも', 'こんこ', 'ゆきな'][i] + (k ? '2' : ''),
    species: sp, lineage: sp, dye: null, stats: st, tech_count: 6 + (n % 4), lv: 40 - n, power: 5200 - n * 180, grade: n < 3 ? 'S' : n < 8 ? 'A' : 'B', place: n + 1, loyal: 80, pop: 60 - n, techs: [] };
}));
const seedRanking = (s) => {
  for (const b of [1, 2]) {
    const rows = fakeRankRows(b);
    const sfx = b === 2 ? '_beta2' : '';
    s.supabase.tables.set(`monsuc_rank_all${sfx}`, rows);
    s.supabase.tables.set(`monsuc_rank_lineage${sfx}`, rows);
  }
};
const monsucRank = (beta, after = []) => async (s) => {
  seedRanking(s);
  if (!(await monsucTile(/ランキング/)(s))) return false;
  if (beta === 1 && !(await tapAny(s, /^β1$/))) return false;
  await s.wait(1500);
  return via(after)(s);
};
// ヘルプの「モンヒロサクセス」のページ(モンヒロバトル → ヘルプ → モンヒロサクセス)
const monsucHelp = (sub) => async (s) => {
  if (!(await homeBtn('モンヒロバトル')(s))) return false;
  await s.page.evaluate(() => { const b = [...document.querySelectorAll('button')].find((x) => x.getClientRects().length && /^📖\s*ヘルプ$/.test(x.textContent.trim())); if (b) b.click(); });
  await s.wait(2000);
  const ok = await s.page.evaluate(() => {
    const bs = [...document.querySelectorAll('button')].filter((x) => x.getClientRects().length && /モンヒロサクセス/.test(x.textContent) && !/モンスターを育てる/.test(x.textContent));
    const b = bs[bs.length - 1];
    if (b) { b.scrollIntoView({ block: 'center' }); b.click(); }
    return !!b;
  });
  await s.wait(1200);
  if (!ok) return false;
  return sub ? tapAny(s, sub) : true;
};

const SCENES = [
  // ---- HOME まわり ----
  { id: 'home', area: 'HOME', name: 'HOME', go: async () => true },
  { id: 'home-changelog', area: 'HOME', name: '更新履歴', go: via([/^更新履歴$/], { keepLast: true }) },
  // 2026-11-24 r1119-155 案A: メニューは無くなり、吹き出しを押すとすぐおしゃべり。この場面は吹き出しの角の「?」が見える HOME のまま撮る
  { id: 'home-assistant-menu', area: 'HOME', name: '助手の吹き出しと「?」(HOME)', go: async () => true },
  { id: 'home-assistant-help', area: 'HOME', name: '助手の説明(HOME)', go: async (s) => (await tapAny(s, /にこの画面の遊び方を聞く$/)) || ((await tapAny(s, /のメニューを開く$/)) && (await tapAny(s, /詳しく見る/))) }, // 撮り比べの相手(前の版)はメニューから開く
  { id: 'profile', area: 'HOME', name: 'プロフィール', go: via([/^プロフィールを開く$/]) },
  // イベント回想(社長の指摘の較正 president-eye: 回想の見出しの絵文字・お話の締めの「終わり」の中心)
  { id: 'replay-list', area: 'HOME', name: 'プロフィール → イベント回想(まとまりを開いた所)', go: (s) => openReplay(s, false) },
  { id: 'replay-end', area: 'HOME', name: 'イベント回想 → お話の締め(終わり)', go: (s) => openReplay(s, true) },
  { id: 'mission', area: 'HOME', name: 'ミッション', go: via([/^ミッション/]) },
  { id: 'gift', area: 'HOME', name: 'ギフト', go: via([/^ギフト/]) },
  { id: 'temple', area: 'HOME', name: '神殿', go: via([/^神殿$/]) },
  // ---- マーケット ----
  { id: 'market', area: 'マーケット', name: 'マーケット', go: via([/^マーケット$/]) },
  { id: 'market-diamond', area: 'マーケット', name: 'ダイヤショップ', go: via([/^マーケット$/, /^ダイヤショップ$/]) },
  // ---- カードバトル(モンヒロバトル) ----
  { id: 'battle-menu', area: 'カードバトル', name: 'モンヒロバトル(仕組みを選ぶ)', go: homeBtn('モンヒロバトル') },
  { id: 'battle-rule', area: 'カードバトル', name: 'クラシックバトルの詳しいルール', go: then(homeBtn('モンヒロバトル'), [/^クラシックバトルの詳しいルール$/]) },
  { id: 'battle-classic', area: 'カードバトル', name: 'クラシック(モード選択)', go: battleSystem('systemClassic') },
  { id: 'battle-quick', area: 'カードバトル', name: 'クイックモード(難易度)', go: battleSystem('systemQuick') },
  { id: 'battle-ranking', area: 'カードバトル', name: 'ランキング', go: then(homeBtn('モンヒロバトル'), [/ランキング$/]) },
  { id: 'battle-hero', area: 'カードバトル', name: '勇者モンを選ぶ', go: heroSelect },
  { id: 'battle-play', area: 'カードバトル', name: 'クラシックの対戦中', go: (s) => startBattle(s, 'systemClassic') },
  { id: 'battle-play-quick', area: 'カードバトル', name: 'クイックの対戦中', go: (s) => startBattle(s, 'systemQuick') },
  // ---- タクティクス ----
  { id: 'tactics-mode', area: 'タクティクス', name: 'タクティクス(モード選択)', go: battleSystem('systemTactics') },
  // タクティクスは「プロ」だけ遊べる(ほかは準備中。2026-11-19)
  { id: 'tactics-diff', area: 'タクティクス', name: 'タクティクスプロ(難易度)', go: async (s) => (await battleSystem('systemTactics')(s)) && pickMode('tacticsPro')(s) },
  { id: 'tactics-play', area: 'タクティクス', name: 'タクティクスプロの対戦中', go: startTactics },
  // ---- モンヒロビート ----
  { id: 'beat-top', area: 'モンヒロビート', name: 'モンヒロビート', go: homeBtn('モンヒロビート') },
  { id: 'beat-songs', area: 'モンヒロビート', name: '曲えらび(ソロライブ)', go: async (s) => {
    if (!(await homeBtn('モンヒロビート')(s))) return false;
    if (!(await s.tapLabel(/ソロライブ/, 2000))) return false;
    await s.dismissOverlays(6);
    for (let k = 0; k < 3 && (await s.tapLabel(/^この案内を閉じる$/, 500)); k++);
    return true;
  } },
  // 🔄横(縦の端末で絵だけ回す)の曲えらび。社長の iPhone はこの形(2026-11-22 r1119-094)。縦の大きさ(tate)で撮る
  { id: 'beat-songs-rot', area: 'モンヒロビート', name: '曲えらび(ソロライブ・🔄横)', go: async (s) => {
    const song = SCENES.find((x) => x.id === 'beat-songs');
    if (!(await song.go(s))) return false;
    if (!(await s.tapLabel(/^(🔄\s*)?横$|横画面に|横向き/, 1500))) return false;
    await s.page.waitForTimeout(6500); // 「絵のほうを横向きにしました」の知らせが消えるまで待つ
    return true;
  } },
  // 原曲・short ver. など版がある曲を選んだ曲えらび(2026-11-22 社長「曲が選べるやつのサイズを考えてない」。版の段のぶん難易度のボタンが
  // 押しつぶされて字が切れたのに、撮影は版が1つの曲だけで気づけなかった)。一覧の「2つの版」の札がある曲を押す
  { id: 'beat-songs-versions', area: 'モンヒロビート', name: '曲えらび(版がある曲)', go: async (s) => {
    const song = SCENES.find((x) => x.id === 'beat-songs');
    if (!(await song.go(s))) return false;
    const hit = await s.page.evaluate(() => { const b = document.querySelector('[data-rhythm-song-row-version-count]'); const btn = b && b.closest('button'); if (btn) btn.click(); return !!btn; });
    if (!hit) return false;
    await s.page.waitForTimeout(800);
    return !!(await s.page.$('[data-rhythm-song-version]'));
  } },
  { id: 'beat-songs-versions-rot', area: 'モンヒロビート', name: '曲えらび(版がある曲・🔄横)', go: async (s) => {
    const song = SCENES.find((x) => x.id === 'beat-songs-versions');
    if (!(await song.go(s))) return false;
    if (!(await s.tapLabel(/^(🔄\s*)?横$|横画面に|横向き/, 1500))) return false;
    await s.page.waitForTimeout(6500);
    return !!(await s.page.$('[data-rhythm-song-version]'));
  } },
  // ---- API 総点検②(2026-11-23): 難易度・演奏中・結果・ランキング・イベント(HOME から人と同じボタンで開く。デバッグは使わない) ----
  { id: 'beat-diff', area: 'モンヒロビート', name: '曲を選んで難易度を選んだ所', group: 'beat-extra', go: async (s) => {
    const song = SCENES.find((x) => x.id === 'beat-songs');
    if (!(await song.go(s))) return false;
    const ok = await s.page.evaluate(() => { const r = document.querySelector('[data-rhythm-song-row]'); if (r) r.click(); return !!r; });
    await s.page.waitForTimeout(800);
    await s.page.evaluate(() => { const d = [...document.querySelectorAll('[data-rhythm-difficulty]')].filter((x) => !x.disabled); const m = d.find((x) => x.getAttribute('data-rhythm-difficulty') === 'MASTER') || d[d.length - 1]; if (m) m.click(); });
    await s.page.waitForTimeout(600);
    return ok;
  } },
  { id: 'beat-play', area: 'モンヒロビート', name: '演奏中(始まって少し)', group: 'beat-extra', go: async (s) => {
    const d = SCENES.find((x) => x.id === 'beat-diff');
    if (!(await d.go(s))) return false;
    const ok = await s.page.evaluate(() => { const b = document.querySelector('[data-rhythm-demo-start]:not([disabled])'); if (b) b.click(); return !!b; });
    if (!ok) return false;
    await s.page.waitForSelector('[data-rhythm-play-area]', { timeout: 15000 }).catch(() => {});
    await s.page.waitForTimeout(9000);
    return !!(await s.page.$('[data-rhythm-play-area]'));
  } },
  { id: 'beat-result', area: 'モンヒロビート', name: '結果(最後まで演奏したあと)', group: 'beat-extra', go: async (s) => {
    const play = SCENES.find((x) => x.id === 'beat-play');
    if (!(await play.go(s))) return false;
    const { installPlayer } = require('../playbot/scenarios/rhythm.js');
    const { touchInputSource } = require('../playbot/lib/touch-input.js');
    const args = { sigma: 0, missRate: 0, seed: 7, human: false, persona: 'center', input: 'ios', dropRate: 0, lateRate: 0, touchSrc: touchInputSource };
    await s.page.evaluate(`(${installPlayer.toString()})(${JSON.stringify(args)})`);
    await s.page.waitForFunction(() => !document.querySelector('[data-rhythm-play-area]'), null, { timeout: 400000, polling: 500 }).catch(() => {});
    await s.page.waitForTimeout(3500);
    if (process.env.BEAT_DEBUG) console.log('RESULT-TEXT', await s.page.evaluate(() => ({ area: !!document.querySelector('[data-rhythm-play-area]'), t: document.body.innerText.slice(0, 300) })));
    return !(await s.page.$('[data-rhythm-play-area]'));
  } },
  { id: 'beat-ranking', area: 'モンヒロビート', name: 'この曲の全国ランキング', group: 'beat-extra', go: async (s) => {
    const d = SCENES.find((x) => x.id === 'beat-diff');
    if (!(await d.go(s))) return false;
    const ok = await s.page.evaluate(() => { const b = document.querySelector('[data-rhythm-demo-ranking]'); if (b) b.click(); return !!b; });
    await s.page.waitForTimeout(1500);
    return ok;
  } },
  { id: 'beat-result-close', area: 'モンヒロビート', name: '結果(ランクアップを閉じたあと)', group: 'beat-extra', go: async (s) => {
    const r = SCENES.find((x) => x.id === 'beat-result');
    if (!(await r.go(s))) return false;
    await s.page.mouse.click(Math.round(s.viewport ? s.viewport.width / 2 : 195), 585).catch(() => {});
    await s.page.evaluate(() => { const e = [...document.querySelectorAll('*')].find((x) => x.children.length === 0 && /押すと閉じる/.test(x.textContent)); if (e) e.click(); });
    await s.page.waitForTimeout(1500);
    return true;
  } },
  // 開催中のイベント(11/23 10:00〜)の見た目。時計を開催中に合わせて開く(保存・ランキングへは何も送らない)
  { id: 'beat-event', area: 'モンヒロビート', name: '曲えらび(イベント開催中の時計)', group: 'beat-extra', go: async (s) => {
    await s.page.clock.setFixedTime(new Date('2026-11-24T03:00:00Z')).catch(() => {});
    const song = SCENES.find((x) => x.id === 'beat-songs');
    return song.go(s);
  } },
  // ---- MFバトルカード ----
  { id: 'card-top', area: 'カードバトル', name: 'MFバトルカード', go: homeBtn('MFバトルカード') },
  // ---- 助手ライフ ----
  { id: 'life-top', area: '助手ライフ', name: '助手ライフ', go: homeBtn('助手ライフ') },
  { id: 'life-chat', area: '助手ライフ', name: 'おしゃべり', go: via([/おしゃべり$/]) },
  // ---- M/B管理・図鑑 ----
  { id: 'mb', area: '図鑑', name: 'M/B管理', go: via([/^M\/B管理$/]) },
  { id: 'mb-base', area: '図鑑', name: 'ベースモン一覧', go: via([/^M\/B管理$/, /^ベースモン一覧/]) },
  { id: 'mb-master', area: '図鑑', name: 'マスモン一覧(バトル)', go: via([/^M\/B管理$/, /^マスモン一覧\(バトル\)/]) },
  { id: 'mb-master-beat', area: '図鑑', name: 'マスモン一覧(モンヒロビート)', go: via([/^M\/B管理$/, /^マスモン一覧\(モンヒロビート\)/]) },
  { id: 'mb-dex', area: '図鑑', name: 'モンスター図鑑', go: via([/^M\/B管理$/, /^モンスター図鑑/]) },
  { id: 'mb-party', area: '図鑑', name: 'モンスター編成', go: via([/^M\/B管理$/, /^モンスター編成/]) },
  { id: 'mb-ranch', area: '図鑑', name: '放牧設定', go: via([/^M\/B管理$/, /^放牧設定/]) },
  { id: 'mb-auto', area: '図鑑', name: 'AUTO設定', go: via([/^M\/B管理$/, /^AUTO設定/]) },
  { id: 'mb-assist', area: '図鑑', name: 'アシストカード', go: via([/^M\/B管理$/, /^アシストカード$/]) },
  // ---- 設定 ----
  { id: 'settings', area: '設定', name: '設定', go: via([/^設定$/]) },
  { id: 'settings-battle', area: '設定', name: 'バトル設定', go: via([/^設定$/, /^バトル設定/]) },
  { id: 'settings-sound', area: '設定', name: '音量設定', go: via([/^設定$/, /^音量設定/], { keepLast: true }) },
  { id: 'settings-bgm', area: '設定', name: 'BGMアレンジ', go: via([/^設定$/, /^BGMアレンジ/], { keepLast: true }) },
  { id: 'settings-title', area: '設定', name: 'タイトル画像アレンジ', go: via([/^設定$/, /^タイトル画像アレンジ/]) },
  { id: 'settings-home', area: '設定', name: 'ホーム画面アレンジ', go: via([/^設定$/, /^ホーム画面アレンジ/]) },
  { id: 'settings-theme', area: '設定', name: '画面テーマ', go: via([/^設定$/, /^画面テーマ/]) },
  // ---- ヘルプ ----
  { id: 'help', area: 'ヘルプ', name: 'ヘルプ(モンヒロバトルから)', go: then(homeBtn('モンヒロバトル'), [/ヘルプ$/], { keepLast: true }) },
  // ---- モンサク(既定では撮らない) ----
  { id: 'monsuc-story', area: 'モンサク', group: 'monsuc', name: 'モンサクの入口(β版のお話の1ページ目)', go: (s) => monsucHome(s, { keepStory: true }) },
  { id: 'monsuc-home', area: 'モンサク', group: 'monsuc', name: 'モンサクのホーム(入口)', go: (s) => monsucHome(s) },
  { id: 'monsuc-new', area: 'モンサク', group: 'monsuc', name: '新しく育成を始める(最初の画面)', go: monsucTile(/新しく育成を始める/) },
  { id: 'monsuc-basemon', area: 'モンサク', group: 'monsuc', name: 'ベースモン(モンサクのホーム)', go: monsucTile(/ベースモン/) },
  { id: 'monsuc-box-empty', area: 'モンサク', group: 'monsuc', name: 'マスモンボックス(空のとき)', go: monsucTile(/マスモンボックス/) },
  { id: 'monsuc-dex', area: 'モンサク', group: 'monsuc', name: 'イベント図鑑(ホームから)', go: monsucTile(/イベント図鑑/) },
  { id: 'monsuc-rank-b2', area: 'モンサク', group: 'monsuc', name: 'ランキング β2(偽の16行)', go: monsucRank(2) },
  { id: 'monsuc-rank-b1', area: 'モンサク', group: 'monsuc', name: 'ランキング β1(偽の16行)', go: monsucRank(1) },
  { id: 'monsuc-rank-lin', area: 'モンサク', group: 'monsuc', name: 'ランキングの血統を選ぶ', go: monsucRank(2, [/選ぶ/]) },
  { id: 'monsuc-rank-detail', area: 'モンサク', group: 'monsuc', name: 'ランキングの1行を押した詳細', go: monsucRank(2, [/もちまる/]) },
  { id: 'monsuc-help', area: 'モンサク', group: 'monsuc', name: 'ヘルプ「モンヒロサクセス」', go: monsucHelp(null) },
  { id: 'monsuc-help-start', area: 'モンサク', group: 'monsuc', name: 'ヘルプ「はじめに(遊びの流れ)」', go: monsucHelp(/はじめに/) },
  { id: 'monsuc-help-beta', area: 'モンサク', group: 'monsuc', name: 'ヘルプ「β版について」', go: monsucHelp(/β版について/) },
  { id: 'monsuc-assistant-help', area: 'モンサク', group: 'monsuc', name: '助手の説明(HOME の助手を押した窓)', go: via([/の説明を開く$/]) },
  { id: 'monsuc-box', area: 'モンサク', group: 'monsuc', name: 'マスモンボックス(M/B管理から)', go: via([/^M\/B管理$/, /^マスモンボックス\(モンサク\)/]) },
];

// 4つの大きさ(依頼文: 縦 390×844・横 844×390・小さい横 568×320・PC 1280×800)
const SIZES = [
  { tag: 'tate', w: 390, h: 844, name: '縦' },
  { tag: 'yoko', w: 844, h: 390, name: '横' },
  { tag: 'yoko-s', w: 568, h: 320, name: '小さい横' },
  { tag: 'pc', w: 1280, h: 800, name: 'PC' },
];

// モンサクの奥の画面は既存の道具で撮る(どれも画面の部品を直接置いて開く。偽のデータでページの中だけ。合言葉は使わない)。
// 大きさは縦 390×844(base)・横 844×390(land)・小さい横 568×320(s568)。s568 は名指ししたときだけ撮る(2026-11-19 足した)
const MONSUC_DEEP = [
  { tool: 'tools/success/success-shoot.js', env: { SHOT_SIZES: 'base,land,s568' }, note: '回2(入口・育成の開始1/6〜6/6・毎ターン・図鑑) 約105場面' },
  { tool: 'tools/success/success-r3-shoot.js', env: { SHOT_SIZES: 'base,land,s568' }, note: '回3(大会・修行・引退・保存枠・合体) 約85場面' },
  { tool: 'tools/success/success-arc-shoot.js', env: { SHOT_SIZES: 'base,land,s568' }, note: 'みゅあ編 16場面' },
];

module.exports = { SCENES, SIZES, MONSUC_DEEP, tapAny };

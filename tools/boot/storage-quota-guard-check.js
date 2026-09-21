const TOOLS_DIR = require('path').join(__dirname, '..'); // tools/ 直下。分類フォルダから見た1つ上
// 端末の保存がいっぱいになったときに、黙って進行が消えないかを確かめる。
//
//   node tools/boot/storage-quota-guard-check.js
//
// 【なぜ要るか】
// 2026-09-21・ユーザー報告「長時間クイックのオート無限周回をやってて急に画面が落ちて
// 数時間前に戻っちゃった」「転生100回分戻るとかダイヤやプシュケーも戻ってるみたい」。
// 書き出してもらったセーブを測ると、保存データ1,678,420文字のうち86%(1,448,151文字)が
// ランキングの控え(mh_ranking_cache)で、localStorage の上限(iPhoneのSafariでおよそ5MB)へ
// 迫っていた。上限に達すると、
//   ・hasLocalStorage() のためし書きが落ちて storeSet が何も書かずに素通りする
//   ・失敗は握りつぶされ、メモリの控え(_memStore)には書かれるので画面は正常に見える
//   ・落ちて読み込み直した瞬間に、最後に書けたところまで全キーが一斉に戻る
// という筋で、ダイヤも転生もプシュケーも同時に巻き戻る。
//
// 【見かた】本番の関数をそのまま切り出して、いっぱいの localStorage で動かす。
//   ① storeSet は失敗を数えて false を返す(黙って素通りしない)
//   ② ランキングの控えは、保存する形だけ軽くする(party[].detail を落とす・難易度に上限)
//   ③ 受け取り済みのギフトは新しいものだけ残す(ログインボーナスと補償は消さない)
//   ④ 書けない状態では∞周回を始めず、回っていれば止める
const path = require('path');
const fs = require('fs');
const { REPO_ROOT, readAppSource } = require(path.join(TOOLS_DIR, 'harness'));

let failed = 0;
const check = (label, ok, detail = '') => { console.log(`${ok ? 'OK' : 'NG'}: ${label}${detail ? ` — ${detail}` : ''}`); if (!ok) failed++; };
const part = (name) => fs.readFileSync(path.join(REPO_ROOT, 'monster-hero/src/parts', name), 'utf8');
const slice = (src, fromMark, toMark, label) => {
  const from = src.indexOf(fromMark);
  const to = src.indexOf(toMark, from + 1);
  if (from < 0 || to < 0) { check(`${label} を切り出せる`, false, `${from < 0 ? fromMark : toMark} が見つかりません`); process.exit(1); }
  return src.slice(from, to);
};

// ===== 偽の localStorage。上限を決められるようにして、いっぱいの状態を作る =====
const fakeLocalStorage = ({ quota = Infinity } = {}) => {
  const map = new Map();
  let used = 0;
  return {
    get length() { return map.size; },
    key(i) { return Array.from(map.keys())[i]; },
    getItem(k) { return map.has(k) ? map.get(k) : null; },
    setItem(k, v) {
      const value = String(v);
      const next = used - (map.has(k) ? map.get(k).length : 0) + value.length;
      if (next > quota) { const e = new Error('The quota has been exceeded.'); e.name = 'QuotaExceededError'; throw e; }
      used = next; map.set(k, value);
    },
    removeItem(k) { if (map.has(k)) { used -= map.get(k).length; map.delete(k); } },
    __used() { return used; },
  };
};

// ===== ① 保存層。本番の 25-storage.jsx をそのまま動かす =====
const storageSource = slice(part('25-storage.jsx'), 'const _memStore = {};', 'const saveRhythmSettings =', '保存層');
const makeStorage = (localStorage) => new Function('window', `${storageSource}
  return { storeSet, storeGet, getStorageHealth, probeStorageWritable, storageUsageReport, setStorageWriteBlocked };`)({ localStorage });

(async () => {
  {
    const store = makeStorage(fakeLocalStorage());
    const ok = await store.storeSet('mh_gold', 1234, false);
    check('①-1 ふつうに書けたら true を返し、失敗として数えない', ok === true && store.getStorageHealth().failures === 0,
      `返り値=${ok} / failures=${store.getStorageHealth().failures}`);
  }
  {
    // 上限ぎりぎり。大きいものを書いたあとは、小さいものすら入らない
    const store = makeStorage(fakeLocalStorage({ quota: 200 }));
    const big = await store.storeSet('mh_ranking_cache', 'x'.repeat(400), false);
    const health = store.getStorageHealth();
    check('①-2 いっぱいで書けなかったら false を返す(黙って素通りしない)', big === false, `返り値=${big}`);
    check('①-3 失敗を数えて手がかりを残す', health.failures >= 1 && /Quota|quota|使えません/.test(health.lastError),
      `failures=${health.failures} / lastError=${health.lastError} / key=${health.lastFailedKey}`);
  }
  {
    // 読み書きができない端末(localStorage そのものが使えない)でも、失敗として数える
    const dead = { get length() { return 0; }, key() { return null; }, getItem() { return null; },
      setItem() { const e = new Error('denied'); e.name = 'SecurityError'; throw e; }, removeItem() {} };
    const store = makeStorage(dead);
    const ok = await store.storeSet('mh_gold', 1, false);
    check('①-4 localStorage が使えない端末でも失敗として数える', ok === false && store.getStorageHealth().failures >= 1,
      `返り値=${ok} / failures=${store.getStorageHealth().failures}`);
  }
  {
    // 初回プレイのプレビュー中は「保存しないのが正しい」。失敗として数えてはいけない
    const store = makeStorage(fakeLocalStorage());
    store.setStorageWriteBlocked(true);
    const ok = await store.storeSet('mh_gold', 1, false);
    store.setStorageWriteBlocked(false);
    check('①-5 プレビュー中の「保存しない」は失敗に数えない', ok === true && store.getStorageHealth().failures === 0,
      `返り値=${ok} / failures=${store.getStorageHealth().failures}`);
  }
  {
    const store = makeStorage(fakeLocalStorage({ quota: 100 }));
    check('①-6 いっぱいならためし書き(probe)が false になる', store.probeStorageWritable() === false);
    const roomy = makeStorage(fakeLocalStorage());
    check('①-7 余裕があればためし書きは true', roomy.probeStorageWritable() === true);
  }
  {
    const ls = fakeLocalStorage();
    ls.setItem('mh_masu_mons', 'x'.repeat(100));
    ls.setItem('other_app_key', 'y'.repeat(999));
    const store = makeStorage(ls);
    const usage = store.storageUsageReport();
    check('①-8 使用量はこのゲームのキー(mh_)だけを数える',
      !!usage && usage.items.length === 1 && usage.items[0].key === 'mh_masu_mons' && usage.total === 100 + 'mh_masu_mons'.length,
      usage ? `件数=${usage.items.length} / 合計=${usage.total}` : '取得できませんでした');
  }

  // ===== ② ランキングの控えを軽くする =====
  const app = readAppSource();
  const compactSource = slice(app, '  const RANKING_CACHE_DIFFICULTY_LIMIT =', '  const saveRankingCache =', 'ランキングの控えを軽くする処理');
  const ranking = new Function(`${compactSource}
    return { compactRankingCacheForSave, compactRankingRowsForSave, rankingCacheNeedsCompaction, mergeRankingScoreForCache, RANKING_CACHE_DIFFICULTY_LIMIT };`)();
  {
    const row = { userName: 'あ', score: 1, party: [{ name: 'エイキ', emoji: '🌸', bondLevel: 479, detail: { bondXp: 7945032, inherited: [1, 2, 3] } }] };
    const compacted = ranking.compactRankingRowsForSave([row]);
    check('②-1 控えからモンスターの詳細(detail)を落とす',
      compacted[0].party[0].detail === undefined && compacted[0].party[0].bondLevel === 479 && compacted[0].userName === 'あ');
    check('②-2 元の行は変えない(画面が使う控えはそのまま)', row.party[0].detail !== undefined);
  }
  {
    const score = {};
    for (let i = 0; i < ranking.RANKING_CACHE_DIFFICULTY_LIMIT + 4; i += 1) score[`diff${i}`] = [{ party: [] }];
    const compacted = ranking.compactRankingCacheForSave({ score, breeder: null, bond: null });
    const kept = Object.keys(compacted.score);
    check('②-3 控える難易度に上限がある', kept.length === ranking.RANKING_CACHE_DIFFICULTY_LIMIT, `残った数=${kept.length}`);
    check('②-4 残るのは新しく見たほう(うしろ)', kept[kept.length - 1] === `diff${ranking.RANKING_CACHE_DIFFICULTY_LIMIT + 3}`, `末尾=${kept[kept.length - 1]}`);
  }
  {
    const merged = ranking.mergeRankingScoreForCache({ a: 1, b: 2 }, { a: 9 });
    check('②-5 見直した難易度はうしろへ回す(上限で切るときに最近見たぶんを捨てない)',
      Object.keys(merged).join(',') === 'b,a' && merged.a === 9, Object.keys(merged).join(','));
  }
  {
    const heavy = { score: { x: [{ party: [{ detail: { a: 1 } }] }] }, breeder: null, bond: null };
    check('②-6 重い形のままなら、起動時に軽くし直す対象になる', ranking.rankingCacheNeedsCompaction(heavy) === true);
    check('②-7 軽い形なら書き戻さない', ranking.rankingCacheNeedsCompaction(ranking.compactRankingCacheForSave(heavy)) === false);
  }

  // ===== ③ 受け取り済みのギフトを積もらせない =====
  const giftSource = slice(part('17-release-changelog-login-missions.jsx'), 'const GIFT_HISTORY_LIMIT =', 'const grantCompensationGifts =', 'ギフト履歴の整理');
  const gift = new Function(`${giftSource} return { pruneGiftHistory, GIFT_HISTORY_LIMIT };`)();
  {
    const at = (d) => new Date(2026, 8, d).toISOString();
    const list = [];
    for (let i = 0; i < gift.GIFT_HISTORY_LIMIT + 30; i += 1) list.push({ id: `m${i}`, source: 'mission', claimedAt: at(1 + (i % 28)) });
    list.push({ id: 'unclaimed', source: 'mission', claimedAt: null });
    list.push({ id: 'login', source: 'loginBonus', claimedAt: at(1) });
    list.push({ id: 'comp', source: 'compensation', claimedAt: at(1) });
    const kept = gift.pruneGiftHistory(list);
    const ids = new Set(kept.map(g => g.id));
    check('③-1 受け取り済みのミッション報酬は上限までにする',
      kept.filter(g => g.source === 'mission' && g.claimedAt).length === gift.GIFT_HISTORY_LIMIT,
      `残った数=${kept.filter(g => g.source === 'mission' && g.claimedAt).length}`);
    check('③-2 まだ受け取っていないギフトは消さない', ids.has('unclaimed'));
    check('③-3 ログインボーナスと補償は消さない(一度きりの付け替えが数え直すため)', ids.has('login') && ids.has('comp'));
    check('③-4 上限より少なければ何も消さない', gift.pruneGiftHistory(list.slice(0, 3)).length === 3);
    check('③-5 並び順は変えない', kept.map(g => g.id).join(',') === list.filter(g => ids.has(g.id)).map(g => g.id).join(','));
  }

  // ===== ④ 書けないときは∞周回を始めない・止める =====
  check('④-1 周回を始める前に、端末へ書けるか確かめる',
    /const storageReadyForRun = \(\) => \{[\s\S]{0,400}?probeStorageWritable\(\)/.test(app)
    && /const startQuickRunFromRhythm = \(\) => \{[\s\S]{0,400}?if \(!storageReadyForRun\(\)\) return false;/.test(app));
  check('④-2 止まった周回を続けるときも確かめる',
    /const resumeQuickRunFromRhythm = \(\) => \{[\s\S]{0,500}?if \(!storageReadyForRun\(\)\) return false;/.test(app));
  check('④-3 書けなくなったら∞周回を止める', /const checkStorageTrouble = \(\) => \{[\s\S]{0,600}?stopAllAuto\('storage'\)/.test(app));
  check('④-4 1周ぶんの報酬を配り終えてから確かめる(そこまでのぶんは端末に残る)',
    /setFinalRewardSummary\(\{ quickMode[\s\S]{0,400}?checkStorageTrouble\(\);/.test(app));
  check('④-5 手で長く遊んでいるあいだも見回る', /setInterval\(\(\) => \{ if \(checkStorageTroubleRef\.current\) checkStorageTroubleRef\.current\(\); \}, 30000\)/.test(app));
  check('④-6 止まった理由を帯に出す', app.includes("storage:'端末に保存できなくなったので周回を止めました"));
  // ★保存できなくて止めたぶんは、アプリへ戻っても自動では続けない(理由が 'hidden' のときだけ続ける)
  check('④-7 保存できずに止めたぶんは、戻ってきても勝手に続けない',
    /const resumeQuickRunAfterVisible = \(\) => \{[\s\S]{0,700}?if \(progress\.reason !== 'hidden'\) return false;/.test(app));
  check('④-8 どの画面にいても知らせが出る(暗幕より上へ)',
    app.includes('data-storage-trouble') && /data-storage-trouble[\s\S]{0,400}?zIndex:2147483647/.test(app)
    && (app.match(/\{storageTroubleNotice\}/g) || []).length >= 4);
  check('④-9 保存できる大きさかを自分で見られる', app.includes('data-storage-usage') && app.includes('storageUsageReport()'));

  console.log(failed ? `\n${failed}件のNGがあります` : '\nすべてOK');
  process.exit(failed ? 1 : 0);
})();

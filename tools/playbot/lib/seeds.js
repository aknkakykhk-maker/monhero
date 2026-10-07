// 担当ごとの「遊ぶ前のブラウザの中身」。どれもボット用のまっさらなブラウザへ入れるだけで、
// 手元・本番のセーブデータには触れない(CLAUDE.md ⑦)。
const { quietBootSeed, updateNoticeSeed } = require('../../boot/quiet-boot-seed');

// 「いつもの」: 最初の案内と、起動直後に重なる会話・告知を済ませた状態
const veteranSeed = (name) => {
  const put = (k, v) => localStorage.setItem(k, JSON.stringify(v));
  if (localStorage.getItem('mh_breeder_name')) return; // 再読み込みのときは上書きしない
  put('mh_breeder_name', name);
  put('mh_breeder_icon', '🤖');
  put('mh_intro_done', true);
  put('mh_onboarded', true);
  put('mh_tutorial_seen_v1', true);
  put('mh_battle_tutorial_seen_v1', true);
  put('mh_battle_tutorial_guide_shown_v1', true);
  put('mh_assistant_selected_v1', 'mua');
  put('mh_assistant_unlock_seen_v1', true);
  put('mh_rhythm_tutorial_seen_v1', true);
  // 新しい助手の紹介(きき・ももすけ)は、しばらく遊んでいる人ならもう見ている
  put('mh_kiki_intro_seen_v1', true);
  put('mh_momosuke_intro_seen_v1', true);
  put('mh_clears_Beginner', 1);
  put('mh_quick_clears_Beginner', 1);
};

async function prepareVeteran(s) {
  await s.page.addInitScript(veteranSeed, s.BOT_NAME);
  // ★種は最初の1回だけ入れる。読み込み直すたびに入れると、既読の一覧が上書きされて、
  //   ボットがそのあと見た会話(レイドのお話など)が「まだ見ていない」に戻り、毎回流れてしまう
  await s.page.addInitScript({ content: `(() => { try { if (localStorage.getItem('__playbot_seeded')) return; ${quietBootSeed().content}\n${updateNoticeSeed().content}\nlocalStorage.setItem('__playbot_seeded', '1'); } catch (e) {} })();` });
}

// 「久しぶり」: マスモン導入前・各種の一度きり移行より前に遊んでいた人のセーブ。
// tools/boot/legacy-save-boot-check.js の seedLegacy と同じ中身(名前だけボットの名前)。
// あちらは移行の数字を細かく確かめる検査、こちらはその人が戻ってきて実際に遊べるかを見る。
// ★告知や会話の既読は入れない。久しぶりに戻った人には、たまったお知らせがそのまま流れる
const legacySeed = (name) => {
  if (localStorage.getItem('__playbot_legacy_seeded')) return; // 2回目以降の起動では入れ直さない
  const put = (k, v) => localStorage.setItem(k, JSON.stringify(v));
  put('mh_breeder_name', name);
  put('mh_breeder_icon', 'Mocchi');
  put('mh_breeder_xp', 5000);
  put('mh_gold', 1234);
  put('mh_owned_items', { psyche: 3 });
  put('mh_unlocked_monsters', ['Mocchi', 'Suezo', 'Ham', 'Golem', 'Pixie', 'Tiger', 'Oboro', 'Zan']);
  put('mh_bond_xp', { Mocchi: 300, Suezo: 50, NoSuchMonster: 10 });
  put('mh_dist_apt_points', { Mocchi: 2 });
  put('mh_dist_apt_overrides', { Mocchi: ['B', 'C', 'C', 'D'] });
  put('mh_hs_Normal', 4321);
  put('mh_tutorial_seen_v1', true);
  put('mh_battle_tutorial_seen_v1', true);
  put('mh_battle_tutorial_guide_shown_v1', true);
  localStorage.setItem('__playbot_legacy_seeded', '1');
};

async function prepareLegacy(s) {
  await s.page.addInitScript(legacySeed, s.BOT_NAME);
}

module.exports = { prepareVeteran, prepareLegacy };

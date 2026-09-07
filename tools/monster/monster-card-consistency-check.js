// マスモン・ベースモンを並べる画面が、どれも同じカードで描かれているかを見張る。
//
//   node tools/monster/monster-card-consistency-check.js
//
// 2026-09-07・ユーザー指示
//   「各モンスター一覧の表示方法を統一してほしい」
//   「説明文が枠を取りすぎて見にくい」
//   「説明を簡易にして閉じたりできるようにする」
//
// 共通のカード(MONSTER_CARD_CLASS ＋ renderMonsterCardBody)は前からあったが、
// 使っていたのは一部の画面だけで、限界突破・転生・寄付・再生・超越は
// それぞれ別のJSXを持っていた。高さも枠も文字の大きさも違うので、
// 画面を移るたびに同じモンスターが違う見た目になっていた。
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..', '..');
const files = [
  path.join(root, 'monster-hero/src/parts/60-app.jsx'),
  path.join(root, 'monster-hero/game-system.compiled.js'),
];

let failed = 0;
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failed++;
};

for (const file of files) {
  const rel = path.relative(root, file);
  const src = fs.readFileSync(file, 'utf8');
  const compact = src.replace(/\s+/g, '');

  // ---- 共通カードを使っている画面の数 ----
  // 増える方向は歓迎なので下限だけ見る(減ったら「また画面ごとに書いた」ということ)
  const bodies = (src.match(/renderMonsterCardBody\(\{/g) || []).length;
  check(`${rel}: 共通のカードで描いている画面がそろっている`, bodies >= 11, `${bodies}か所`);

  // ---- 画面ごとの手書きカードが残っていないか ----
  // 直前まで残っていた書き方(丸アイコンを自分で組む・独自の高さ)を名指しで見る
  check(`${rel}: 限界突破・転生・超越が自前の丸アイコンを組んでいない`,
    !compact.includes('className="relativew-14h-14mx-autorounded-fulloverflow-hidden"')
    && !compact.includes('className="relativew-14h-14mx-autorounded-fulloverflow-visible"'));
  check(`${rel}: 寄付が独自の高さを持っていない`, !compact.includes('min-h-[122px]'));
  check(`${rel}: 再生が独自の高さを持っていない`, !compact.includes('min-h-[104px]'));
  // 高さは1か所(MONSTER_CARD_STYLE)で決める
  check(`${rel}: カードの高さは1か所で決める`, compact.includes("minHeight:'152px'"));

  // ---- 画面の説明をたためる ----
  check(`${rel}: たためる説明の部品がある`,
    /const renderScreenNote\s*=/.test(src) && src.includes('data-screen-note'));
  check(`${rel}: 開いたかどうかを新しいキーへ覚える`,
    compact.includes("constSCREEN_NOTE_OPEN_KEY='mh_screen_note_open_v1';")
    || compact.includes("SCREEN_NOTE_OPEN_KEY='mh_screen_note_open_v1'"));
  check(`${rel}: 既定は閉じている（一覧をすぐ出す）`,
    compact.includes('constopen=screenNoteOpen[id]===true;'));
  // 長文を画面へ直接書き戻していないか(限界突破・転生の本文が地の文で残っていないこと)
  check(`${rel}: 限界突破の長文は畳んだ側にある`,
    !compact.includes('現在のレベル上限に到達したマスモンだけが限界突破できます。30凸までは')
    || compact.includes("renderScreenNote('rebirth'"));
  check(`${rel}: 転生の長文は畳んだ側にある`,
    !/text-\[10px\]text-slate-400mb-3">絆Lv\./.test(compact));
  check(`${rel}: 限界突破と転生が畳める説明を使っている`,
    compact.includes("renderScreenNote('rebirth'") && compact.includes("renderScreenNote('reincarnate'"));
}

console.log(failed ? `\n${failed}件のNGがあります` : '\nすべてOK');
process.exit(failed ? 1 : 0);

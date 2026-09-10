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
const { readAppSource } = require(path.join(__dirname, '..', 'harness'));

const root = path.resolve(__dirname, '..', '..');
// 2026-09-10(STEP 6)から画面は 5x-screen-*.jsx へ移っていく。本体だけを見ると
// 移った画面のカードが数えられなくなるので、本体と切り出した画面をつないだものを「編集元」として見る
const sources = [
  ['monster-hero/src/parts(本体と切り出した画面)', readAppSource()],
  ['monster-hero/game-system.compiled.js', fs.readFileSync(path.join(root, 'monster-hero/game-system.compiled.js'), 'utf8')],
];

let failed = 0;
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failed++;
};

for (const [rel, src] of sources) {
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
  check(`${rel}: 合体が独自の高さを持っていない`, !compact.includes('min-h-[88px]'));
  // 高さは1か所(MONSTER_CARD_STYLE)で決める。
  // 2026-09-07・ユーザー指摘「1枚目 まだ窮屈 / 2枚目 このサイズ感がいい」。
  // 空の行を確保するのをやめ、出す行のぶんだけの高さにしたので下限だけを持つ
  check(`${rel}: カードの高さは1か所で決める`, compact.includes("minHeight:'96px'"));
  // 生成物では `(node) =>` の括弧が外れて `node =>` になるので、どちらでも通る形で見る
  check(`${rel}: 中身の無い行は高さを取らない`,
    /monsterCardStatus=\(?node\)?=>node\?/.test(compact)
    && /monsterCardPower=\(?power\)?=>power==null\?null:/.test(compact));
  // 絆Lvと強化Pは同じ行(別々の行にしていたころは、それだけで17px使っていた)
  // 生成物では `(node||sub)?` の括弧が外れて `node||sub?` になる
  check(`${rel}: 絆Lvと強化Pを同じ行に出す`, /monsterCardInfo=\(node,sub\)=>\(?node\|\|sub\)?\?/.test(compact));
  // ★2026-09-07・ユーザー指摘「3枚目 名前表示がおかしい」。
  //   転生バッジ(.mh-reincarnate-badge)は絵の枠の下へ絶対配置されるが、
  //   一覧カードでは絵のすぐ下が名前の行なので、そのまま重なって名前が読めなかった。
  //   一覧では行の中へふつうに並べる is-inline を使い、badge には渡さない。
  //   (この重なりは実ブラウザ検査では拾えない。基準にしている `relative` も
  //    Tailwind のクラスで、CDNが届かないこの環境では効かないため)
  check(`${rel}: 転生バッジを名前の上へ重ねない`,
    !/badge:<ReincarnateBadge/.test(compact) && !/badge:\/\*#__PURE__\*\/React\.createElement\(ReincarnateBadge/.test(compact));
  check(`${rel}: 一覧の転生バッジは行の中に並べる`,
    compact.includes('<ReincarnateBadgecount={masu.reincarnateCount}className="is-inline"/>')
    || compact.includes('className:"is-inline"'));
  // 「選択中／未選択」の帯はやめ、角のチェックで表す(枠の色と二重になっていて1行ぶん無駄だった)
  check(`${rel}: 選択状態は角のチェックで出す`,
    !compact.includes("{selected?'選択中':'未選択'}")
    && (compact.match(/absolutetop-1left-1z-10w-6h-6rounded-fullbg-(indigo|pink|violet|purple)-500/g) || []).length >= 4);

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
  // 2026-09-07・ユーザー指摘「モンスターの部分がメインなのに他でスペースを取りすぎ」。
  // 合体のルール(5行)と編成の説明も畳んだ側へ移した
  check(`${rel}: 合体のルールを畳んだ側に置いている`,
    compact.includes("renderScreenNote('fusion'")
    && !compact.includes('<divclassName="text-[9px]font-blacktext-violet-300uppercasetracking-wider">合体のルール'));
  check(`${rel}: 編成の説明を畳んだ側に置いている`, compact.includes("renderScreenNote('partyPick'"));
  check(`${rel}: 編成のセット名・コピーも畳める`,
    src.includes('data-party-set-edit-toggle') && compact.includes("toggleScreenNote('partySetEdit')"));
}

console.log(failed ? `\n${failed}件のNGがあります` : '\nすべてOK');
process.exit(failed ? 1 : 0);

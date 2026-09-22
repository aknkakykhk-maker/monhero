#!/usr/bin/env node
// ラスボスの見せ方(丸枠の外の巨大な立ち絵・専用の演出)が、ムーと覚醒ムーの両方へ効くかを確認する。
//
//   node tools/battle/moo-boss-presentation-check.js
//
// 【なぜ道具にするか】
// ラスボスの演出は id を画面のあちこちへ直に書いて出し分けていた(8か所)。
// タクティクスバトルの覚醒ムーは ENEMY_ART_LAYOUT だけムーとそろえてあったのに、
// **演出の分岐からは漏れていて**、丸枠の中に小さく出るだけになっていた
// (2026-09-21 ユーザー指摘「覚醒ムーがしょぼすぎる クラシックのムーの描写を
//  参照してって言ったじゃん」)。
//
// この抜けはエラーにならない。絵は出るし、バトルもふつうに終わる。
// **WAVE10まで進めて目で見るまで気づけない**ので、検査でしか守れない。
//   ・新しいラスボスを足したとき、一覧へ入れ忘れる
//   ・演出の分岐が id の直書きへ戻る(片方だけ抜ける)
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const files = ['monster-hero/src/game-system.jsx', 'monster-hero/game-system.compiled.js'];
let failed = 0;
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failed += 1;
};
const decodeUnicodeEscapes = source => source.replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));

for (const file of files) {
  const source = decodeUnicodeEscapes(fs.readFileSync(path.join(ROOT, file), 'utf8'));
  const compact = source.replace(/\s+/g, '');
  const label = path.basename(file);

  // ★一覧は本体から読む。検査へ id を書き写すと、本体を増やしたときに気づけない
  const ids = ((compact.match(/constMOO_BOSS_IDS=\[([^\]]*)\]/) || [])[1] || '')
    .split(',').map(s => s.trim().replace(/^'|'$/g, '')).filter(Boolean);
  check(`${label}: ラスボスの一覧がある`, ids.length > 0, ids.join(','));
  check(`${label}: クラシックのムーが入っている`, ids.includes('Moo'));
  check(`${label}: タクティクスの覚醒ムーが入っている`, ids.includes('AwakenedMoo'));
  // ★compiled は 1つだけの引数から括弧を外す。どちらの書き方でも同じ1行として見る
  check(`${label}: 見分け方は1か所だけ`,
    /constisMooBoss=\(?id\)?=>MOO_BOSS_IDS\.includes\(String\(id\|\|''\)\)/.test(compact));

  // ★演出の分岐が id の直書きへ戻っていないか。戻ると、足した敵が片方だけ抜ける
  check(`${label}: 演出の分岐に id を直書きしていない`,
    !compact.includes("enemy?.id==='Moo'") && !compact.includes("enemy?.id!=='Moo'")
      && !compact.includes("scanEnemy.id==='Moo'"));

  // ★ラスボスだけの見せ方。どれが欠けても「しょぼい」になる
  // ★compiled はJSXを React.createElement へ変えるので、書き方まで同じにはならない。
  //   「どの分岐が isMooBoss を通るか」だけを見る
  for (const [name, test] of [
    ['丸枠の外に巨大な立ち絵を置く', c => c.includes("isMooBoss(enemy?.id)&&enemy?.imgUrl&&")],
    // 丸枠の中は空(本体は枠外に出す)。空の箱の寸法は丸枠の中身と同じ
    ['丸枠の中は空にする(本体は枠外)',
      c => /isMooBoss\(enemy\?\.id\)\?[^?]{0,120}width:'clamp\(92px,16dvh,142px\)'/.test(c)],
    // 台座のオーラと全画面の演出。どちらも !ecoBattleView && isMooBoss(...) から始まる
    ['丸枠の中に台座のオーラを出す',
      c => (c.match(/!ecoBattleView&&isMooBoss\(enemy\?\.id\)&&/g) || []).length >= 2],
    ['攻撃で全画面の演出を出す', c => c.includes("isMooBoss(enemy?.id)&&enemyAttackFx?.kind==='moo'")],
    ['移動のアニメも専用のものを使う', c => c.includes("isMooBoss(enemy?.id)?'enemyMoveSlideMoo")],
    // ★compiled は外側の括弧を外す
    ['通常攻撃にも予兆を出す',
      c => /\(?isMooBoss\(enemy\?\.id\)&&enemyIntent\.type==='ATTACK'\)/.test(c)],
    ['攻撃の種類をラスボス用にする', c => c.includes("constfxKind=isMooBoss(enemy?.id)?'moo'")],
  ]) {
    check(`${label}: ${name}`, test(compact));
  }

  // ★SCANと全WAVE詳細の絵の大きさもラスボス用にする
  check(`${label}: SCANでも大きく出す`, (compact.match(/isMooBoss\(scanEnemy\.id\)/g) || []).length >= 2);

  // ★絵の拡大率。ムーと覚醒ムーで違うと、片方だけ小さく見える
  const layoutOf = (id) => (compact.match(new RegExp(`${id}:\\{([^}]*)\\}`)) || [])[1] || '';
  check(`${label}: 絵の拡大率がムーと覚醒ムーでそろっている`,
    layoutOf('Moo') !== '' && layoutOf('Moo') === layoutOf('AwakenedMoo'),
    `Moo{${layoutOf('Moo')}} / AwakenedMoo{${layoutOf('AwakenedMoo')}}`);

  // ★技の吹き出し(何をする技か)が、巨大な立ち絵の下に隠れてはいけない
  //   (2026-09-22 ユーザー指摘「ムー戦の吹き出しが見えない」)。
  //   ラスボスの本体は丸枠の外へ fixed で出るので、丸枠の右上へ置くと絵に覆われて1文字も見えない。
  //   ラスボスは画面を覆うので、画面の右上＝そのまま敵の右上になる
  check(`${label}: 技の吹き出しはラスボス用に画面へ固定して出す`,
    /data-enemy-notice-moo[\s\S]{0,240}position:'fixed'/.test(compact));
  // ★重なり順は本体から読む(検査へ数字を書き写すと、本体を変えたとき検査だけ古くなる)
  const mooArtZ = Number((compact.match(/zIndex:focusedCard\?5:(\d+),width:'min\(108vw,560px\)'/) || [])[1]);
  const mooNoticeZ = Number((compact.match(/data-enemy-notice-moo[\s\S]{0,240}?zIndex:focusedCard\?5:(\d+)\}/) || [])[1]);
  check(`${label}: 吹き出しは立ち絵より上に出す`,
    Number.isFinite(mooArtZ) && Number.isFinite(mooNoticeZ) && mooNoticeZ > mooArtZ,
    `絵=${mooArtZ} / 吹き出し=${mooNoticeZ}`);
  // ★丸枠のずらしに transform を使うと、その中の z-index と position:fixed が閉じ込められる。
  //   吹き出しが立ち絵の下へ潜り、必殺技予告の「全画面の危険ビネット」も丸枠の中だけになる。
  //   同じだけずらすなら、スタッキング文脈を作らない top を使う
  check(`${label}: 丸枠のずらしに transform を使わない`,
    !compact.includes("transform:'translateY(3dvh)'")
      && compact.includes("isMooBoss(enemy?.id)?{top:'3dvh'}"));

  // ★立ち絵の読み上げ。「ムー」で固定すると、覚醒ムーのときに違う名前を読む
  // ★compiled は alt={…} を alt:… へ変える。どちらの書き方でも同じものとして見る
  check(`${label}: 立ち絵の説明はその敵の名前で出す`,
    /alt[={:]{1,2}enemy\?\.name\|\|"ムー"/.test(compact) && !/alt[={:]{1,2}"ムー"/.test(compact));
}

console.log(failed ? `\nNG ${failed}件` : '\nすべてOK');
process.exit(failed ? 1 : 0);

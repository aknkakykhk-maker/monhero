#!/usr/bin/env node
// タクティクスバトルの通常戦・中ボス戦・ボス戦に、それぞれ決めたBGMが鳴ることを確認する。
//
//   node tools/audio/tactics-bgm-check.js
//
// 【なぜ道具にするか】
// 曲は3回に分けて決まった（2026-09-21）。
//   ・「曲数が足りないからボス戦だけいれよう」→ ボス戦に1曲
//   ・「中ボス戦は一旦これで」→ すでに入っている The City Beneath the Comets
//   ・「通常曲とボス曲の変更 / 戦場→通常曲 / 魔窟→ボス曲」→ いまの形
// WAVEごとに鳴り分けるので、崩れても**その WAVE まで進めないと気づけない**。
//   ・全WAVEで同じ曲が鳴る
//   ・決めた曲が一度も鳴らない（結線の順番を間違えると、プロや種族の枠へ落ちる）
// のどちらもエラーは出ない。
//
// 結線の順番がとくに危ない。タクティクスの種族チャレンジ・プロは isSpeciesChallengeMode /
// isProMode にも当たるので、isTacticsMode を後ろに置くと**そちらの枠へ落ちる**。
//
// 保存データの決まり（CLAUDE.md ⑦）も見る。新しい枠を
// BGM_ARRANGEMENT_LEGACY_FALLBACK へ入れてはいけない。入れると、チャレンジの曲を
// 自分で選んでいる人にはその曲が引き継がれ、決めた曲が一度も鳴らない。
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
// 枠 → その枠が指す曲。中ボス戦は**すでに入っている曲を指すだけ**（音源のコピーを作らない）
const SLOTS = [
  { slot: 'tacticsBattle', trackId: 'senjou_no_shippuu', audio: 'audio/bgm-senjou-no-shippuu.mp3', label: '通常戦', own: true },
  { slot: 'tacticsMidBoss', trackId: 'melo_the_city_beneath_the_comets', audio: 'audio/bgm-the-city-beneath-the-comets.mp3', label: '中ボス戦', own: false },
  { slot: 'tacticsBoss', trackId: 'makutsu_no_senritsu', audio: 'audio/bgm-makutsu-no-senritsu.mp3', label: 'ボス戦', own: true },
];
const files = ['monster-hero/src/game-system.jsx', 'monster-hero/game-system.compiled.js'];
let failed = 0;
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failed += 1;
};
const decodeUnicodeEscapes = source => source.replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));

// --- ① 音源そのもの ---
let ffmpeg = null;
try { ffmpeg = require('ffmpeg-static'); } catch { /* CIには無い */ }
if (!ffmpeg) console.log('SKIP: ffmpeg が無いので音源の中身(ビットレート・ジャケット)は見ません');
for (const { audio, label, own } of SLOTS) {
  const audioPath = path.join(ROOT, 'monster-hero', audio);
  check(`${label}の音源がある`, fs.existsSync(audioPath), audio);
  if (!fs.existsSync(audioPath)) continue;
  const mb = fs.statSync(audioPath).size / 1048576;
  // 96kbpsで4分なら約2.9MB。5MBを超えていたら、ジャケットかビットレートを落とし忘れている
  check(`${label}の音源が配信向けの大きさに収まっている`, mb > 0.3 && mb < 5, `${mb.toFixed(2)}MB`);
  // ★中身の形をみるのは、このモードのために入れた曲だけ。すでに配信している曲を
  //   流用している枠(中ボス戦)は、モンヒロビートの流儀(32kHz)で入っていて当たり前
  if (!own || !ffmpeg) continue;
  const { execFileSync } = require('child_process');
  let info = '';
  try {
    execFileSync(ffmpeg, ['-hide_banner', '-i', audioPath], { stdio: ['ignore', 'pipe', 'pipe'] });
  } catch (e) { info = String(e.stderr || ''); }
  const stream = (info.match(/Audio: mp3[^\n]*/) || [''])[0];
  const kbps = Number((stream.match(/(\d+) kb\/s/) || [])[1] || 0);
  // BGMの流儀は 96kbps / 44100Hz ステレオ（tools/audio/compress-audio.js の狙い）
  check(`${label}のビットレートがBGMの流儀に収まっている`, kbps > 0 && kbps <= 112, `${kbps}kbps`);
  check(`${label}は 44100Hz ステレオ`, /44100 Hz/.test(stream) && /stereo/.test(stream), stream.slice(0, 50));
  // ★ジャケット画像が残っていると、音しか使わないのに数百KB余分に配る
  check(`${label}にジャケット画像が残っていない`, !/Video:/.test(info));
  // ★曲の頭に無音があると、そのぶん鳴り出しが遅れて聞こえる
  //   (2026-09-21・ユーザー報告「通常バトル曲のBGMの入りが遅い」。頭に0.4秒の無音があった)
  //   バトルは押した瞬間に始まるので、0.1秒の間でも「入りが遅い」と分かる
  // ★ここは正常終了するので、上の -i だけのときと違って catch には入らない。stderr を直接受け取る
  const { spawnSync } = require('child_process');
  const head = String(spawnSync(ffmpeg,
    ['-hide_banner', '-i', audioPath, '-t', '0.05', '-af', 'astats=metadata=1:reset=1', '-f', 'null', '-'],
    { encoding: 'utf8' }).stderr || '');
  const peaks = (head.match(/Peak level dB: (?:-?[\d.]+|-?inf)/g) || []).map(m => Number(m.replace(/[^\d.-]/g, '')) || -999);
  const headPeak = peaks.length ? peaks[peaks.length - 1] : -999;
  check(`${label}の頭に無音がない`, headPeak > -50, `頭0.05秒のピーク ${headPeak}dB`);
}

// --- ② 起動時に読み込まない（開いたときに初めて読む側が正しい） ---
const indexHtml = fs.readFileSync(path.join(ROOT, 'monster-hero/index.html'), 'utf8');
for (const { audio, label } of SLOTS) {
  const base = path.basename(audio, '.mp3');
  check(`${label}の音源が起動時の読み込み一覧に混ざっていない`, !indexHtml.includes(base), base);
}

// --- ②-2 ジャケットはまだ配信しない（モンヒロビートへ入れるときだけ） ---
// 2026-09-21 ユーザー「今後モンビー実装用にジャケットも送っとく」。
// いま images/song-art/ へ置くと、どこからも参照されない絵として image-asset-check が落ちる
for (const name of ['senjou-no-shippuu', 'makutsu-no-senritsu']) {
  check(`${name} のジャケット原本を預かっている`,
    fs.existsSync(path.join(ROOT, 'tools/art-sources/song-art', `${name}.jpg`)));
  check(`${name} のジャケットはまだ配信していない`,
    !fs.existsSync(path.join(ROOT, 'monster-hero/images/song-art', `${name}.jpg`)));
}

// --- ③ 結線 ---
for (const file of files) {
  const source = decodeUnicodeEscapes(fs.readFileSync(path.join(ROOT, file), 'utf8'));
  const compact = source.replace(/\s+/g, '');
  const label = path.basename(file);

  for (const { slot, trackId, audio, label: slotLabel, own } of SLOTS) {
    // ★ブロックを切り出して見ない。compiled はコメントを残したまま1行にまとめるので、
    //   「const BGM_TRACKS = [ 〜 \n];」のような切り出しが効かない
    const entry = (compact.match(new RegExp(`\\{id:'${trackId}'[^}]*\\}`)) || [''])[0];
    check(`${label}: ${slotLabel}の曲が登録されている`,
      entry.includes(`id:'${trackId}'`) && entry.includes(`src:'${audio}'`), entry.slice(0, 80));
    // 音量は音源側でそろえてある。gain で持ち上げようとしない（実装が0〜1.25にクランプする）
    check(`${label}: ${slotLabel}の gain を触っていない`, /gain:1[,}]/.test(entry));
    check(`${label}: ${slotLabel}はループ再生する`, /loop:true/.test(entry));
    check(`${label}: 既定の枠 ${slot} がその曲を指す`, compact.includes(`${slot}:'${trackId}'`));
    // ★すでに入っている曲を使う枠は、音源を増やさない（同じ曲のコピーは配信サイズがそのぶん増える）
    if (!own) {
      check(`${label}: ${slotLabel}は、すでに登録されている曲をそのまま使う`,
        !entry.includes('tactics') && !entry.includes('senjou') && !entry.includes('makutsu'),
        entry.slice(0, 70));
    }
  }

  // ★ここへ入れると、チャレンジの曲を自分で選んでいる人には決めた曲が一度も鳴らない
  const legacy = (source.match(/const BGM_ARRANGEMENT_LEGACY_FALLBACK = Object\.freeze\(\{([^}]*)\}/) || [])[1] || '';
  check(`${label}: タクティクスの枠を引き継ぎの表へ入れていない`,
    SLOTS.every(({ slot }) => !legacy.includes(slot)),
    SLOTS.filter(({ slot }) => legacy.includes(slot)).map(s => s.slot).join(',') || '');

  // ★順番。タクティクスの種族・プロは isSpeciesChallengeMode / isProMode にも当たる
  check(`${label}: BGMを選ぶとき、タクティクスをいちばん先に見る`,
    compact.includes("constmodeBgm=isTacticsMode(runMode)?{normal:'tacticsBattle',dullahan:'tacticsMidBoss',moo:'tacticsBoss'}:isSpeciesChallengeMode(runMode)"));

  // アレンジのタブは、モードを公開するまで出さない（種族チャレンジと同じ扱い）
  // ★括弧の数は書き方しだいで変わる（compiled は外側の括弧を外す）。中身だけを見る
  check(`${label}: アレンジのタブは公開フラグで出し分ける`,
    /\.\.\.\(+TACTICS_MODE_PUBLIC_RELEASE\|\|TACTICS_BETA_PRO_RELEASE\)?\?\[\{id:'tactics',label:'タクティクス',items:\[\['tacticsBattle','通常戦BGM'\],\['tacticsMidBoss','中ボス戦BGM'\],\['tacticsBoss','ボス戦BGM'\]\]\}\]:\[\]\)/.test(compact));
  // ★WAVE9はデュラハンではなくスプラッター。画面に出す呼び名を「デュラハン戦」にしない
  check(`${label}: 中ボス戦の枠を「デュラハン戦」と呼んでいない`,
    !/\['tacticsMidBoss','デュラハン戦/.test(compact));

  // --- ④ 既存5モードのBGM選択を巻き込んで変えていない（回帰） ---
  for (const [name, needle] of [
    ['種族', "isSpeciesChallengeMode(runMode)?{normal:'speciesBattle',dullahan:'speciesDullahan',moo:'speciesMoo'}"],
    ['極限', "extremeRunRef.current?{normal:'extremeBattle',dullahan:'extremeDullahan',moo:'extremeMoo'}"],
    ['プロ', "isProMode(runMode)?{normal:'proBattle',dullahan:'proDullahan',moo:'proMoo'}"],
    ['クイック', "isQuickMode(runMode)?{normal:'quickBattle',dullahan:'quickDullahan',moo:'quickMoo'}"],
    ['チャレンジ', "{normal:'battle',dullahan:'dullahan',moo:'boss'}"],
  ]) {
    check(`${label}: ${name}のBGM選択は今までどおり`, compact.includes(needle));
  }
}

console.log(failed ? `\nNG ${failed}件` : '\nすべてOK');
process.exit(failed ? 1 : 0);

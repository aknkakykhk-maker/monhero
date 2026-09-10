#!/usr/bin/env node
// ミーア専用の攻撃モーション(miaSongNotes)の回帰チェック。
//   ・変えたのはミーアだけで、ピクシー・パンドラを巻き添えにしていないか
//   ・固有技は「共通のタメ(下に沈む)→650ms→専用モーション」の順のままか(PR #1222の修正を壊さない)
//   ・本番バトル・図鑑プレビュー・画像デバッグ・RPGデバッグが同じ演出を使い回しているか
//   ・マイクスタンド・複数の音符・着弾演出がそろっているか
// 演出そのものは目で見るしかないが、「取りこぼし・巻き添え・順番の逆転」はここで機械的に拾う。
const fs = require('fs');
const ally = fs.readFileSync('monster-hero/data/ally-monsters.js', 'utf8');
const game = fs.readFileSync('monster-hero/src/game-system.jsx', 'utf8');

const motionSource = game.slice(game.indexOf('const MIA_SONG_NOTES ='), game.indexOf('const PandoraDualThunder'));
const noteCount = (motionSource.match(/\{ glyph:/g) || []).length;
const atkMotionOf = (id) => ((ally.match(new RegExp(`\\b${id}:\\s*\\{[^\\n]*?atkMotion:'([A-Za-z]+)'`)) || [])[1]);

const checks = [
  // --- 対象はミーアだけ ---
  ['ミーアの atkMotion が miaSongNotes', atkMotionOf('Mia') === 'miaSongNotes', String(atkMotionOf('Mia'))],
  ['ピクシーの atkMotion は default のまま', atkMotionOf('Pixie') === 'default', String(atkMotionOf('Pixie'))],
  ['パンドラの atkMotion は pandoraDualThunder のまま', atkMotionOf('Pandora') === 'pandoraDualThunder', String(atkMotionOf('Pandora'))],
  ['ミーアの性能・固有技には触っていない',
    /Mia:[^\n]*baseHp:300, baseGuts:180, baseAtk:175, baseDef:60/.test(ally)
    && /Mia:[^\n]*plusStats:\{hp:120,atk:30,def:10,guts:65\}/.test(ally)
    && /Mia:[^\n]*distAptitude:\['G','C','A','B'\]/.test(ally)
    && /Mia:[^\n]*name:"バン",icon:MIA_ICON,monId:"Mia",baseMult:2\.1,baseGuts:42/.test(ally)],

  // --- 固有技の順番(specialCharge → 650ms → 専用モーション) ---
  ['固有技の共通タメに専用モーションを混ぜていない',
    game.includes('setAttackAnim({slotIndex: animSlot, charge:true});')
    && !/setAttackAnim\(\{slotIndex: animSlot, charge:true,[^\n]*miaSongNotes/.test(game)
    && game.includes('setMonsterImageDebugMotionPlaying({charge:true});')
    && !/setMonsterImageDebugMotionPlaying\(\{charge:true,[^\n]*miaSongNotes/.test(game)],
  ['タメは全モンスター共通の specialCharge 650ms のまま',
    game.includes("if (anim.charge) return 'specialCharge 650ms ease-out forwards';")
    && /Audio_\.se\.special\(\);\s*await battleWait\(650\);/.test(game)],
  ['タメ明けに専用モーションへ渡している',
    game.includes('setAttackAnim({slotIndex: animSlot, charge:false, motion, twinBlade:isKenshiTwin, sakura:')],
  ['タメ中は歌わない(マイク・音符・着弾を出さない)',
    game.includes('.mia-song-notes--charging .mia-song-notes__mic,')
    && game.includes('.mia-song-notes--charging .mia-song-notes__impact { display:none; }')
    && game.includes('@keyframes miaSongCharge {')],

  // --- 演出の中身 ---
  ['マイクスタンドが出る(頭・支柱・台座)',
    game.includes('mia-song-notes__mic-head') && game.includes('mia-song-notes__mic-pole')
    && game.includes('mia-song-notes__mic-base') && game.includes('@keyframes miaSongMicPop {')],
  ['音符は3つ以上を時間差で飛ばす', noteCount >= 3 && /delay:'\d+ms'/.test(motionSource)
    && game.includes('@keyframes miaSongNoteFly {'), `${noteCount}個`],
  ['音符は敵の方向(上)へはっきり移動する',
    (motionSource.match(/y:'-\d{2,3}px'/g) || []).length >= 3
    && game.includes('--mia-note-y')],
  ['敵側に着弾演出がある(音の輪・光・キラキラ)',
    game.includes('mia-song-notes__impact-core') && game.includes('mia-song-notes__impact-ring')
    && game.includes('mia-song-notes__impact-ring--late') && game.includes('mia-song-notes__spark')],
  ['本体が歌う動きをして元位置へ戻る',
    game.includes('@keyframes miaSongSing {') && game.includes('@keyframes miaSongSingLunge {')
    && /@keyframes miaSongSing \{[\s\S]*?100% \{ transform:translate3d\(0,0,0\) scale\(1\) rotate\(0deg\)/.test(game)],
  ['距離枠は動かさず本体だけを動かす',
    game.includes("if (anim.motion==='miaSongNotes') return undefined")],
  ['動きを減らす設定にも対応している',
    /@media \(prefers-reduced-motion: reduce\) \{[\s\S]*?\.mia-song-notes__monster,/.test(game)
    && game.includes('@keyframes miaSongReduced {')],
  ['攻撃中だけ出す(常時アニメーションを増やしていない)',
    !/\.mia-song-notes[^\n]*animation:[^\n]*infinite/.test(game)],

  // --- 使い回し(専用の別実装を増やしていない) ---
  ['本番バトルで専用演出を描画', game.includes("isAnimating&&attackAnim.motion==='miaSongNotes'")
    && game.includes('<MiaSongNotesMotion')
    && game.includes("motion==='miaSongNotes'?MIA_SONG_NOTES_MOTION_MS")],
  ['図鑑プレビューも同じ MiaSongNotesMotion を使う',
    game.includes("anim?.motion==='miaSongNotes'") && game.includes('<MiaSongNotesMotion image={image}')],
  ['画像デバッグの攻撃モーション確認も同じ演出を使う',
    game.includes("monsterImageDebugMotionPlaying?.motion==='miaSongNotes'")
    && game.includes("atkMotion==='miaSongNotes'?MIA_SONG_NOTES_MOTION_MS")
    && game.includes("atkMotion==='miaSongNotes')?'overflow-visible'")],
  ['演出のコンポーネントは1つだけ(図鑑用の別物を作っていない)',
    (game.match(/const MiaSongNotesMotion = /g) || []).length === 1],
  ['RPGデバッグの対応表に載っている(未対応 atkMotion にならない)',
    /const RPG_MOTION_BY_ATK = Object\.freeze\(\{[^}]*miaSongNotes:'[A-Za-z]+'/.test(game)],
  ['図鑑プレビューの再生時間も専用モーションぶん確保している',
    game.includes("motion==='miaSongNotes'?MIA_SONG_NOTES_MOTION_MS")
    && /const MIA_SONG_NOTES_MOTION_MS = \d{3};/.test(game)],

  // --- 既存モーションの回帰 ---
  ['既存の専用モーションを壊していない',
    game.includes('@keyframes waterBurstAttack {') && game.includes('@keyframes waterBurstLunge {')
    && game.includes('@keyframes arkHolyFloat {')
    && game.includes("motion==='waterBurst'?WATER_BURST_MOTION_MS")
    && game.includes("motion==='arkHolyRain'?ARK_HOLY_RAIN_MOTION_MS")
    && game.includes('const PandoraDualThunder = ({image, compact=false})')
    && game.includes("if (anim.zanCombo) return 'zanComboDash 320ms ease-out forwards';")
    && game.includes("if (anim.twinBlade || anim.motion==='kenshiTwinBlade') return 'kenshiTwinBladeSlash")],
];

let failed = 0;
for (const [label, ok, note] of checks) {
  if (!ok) failed++;
  console.log(`${ok ? 'OK' : 'NG'}: ${label}${note ? ` — ${note}` : ''}`);
}
console.log(failed ? `\n${failed}件のNGがあります` : '\nすべてOK');
process.exit(failed ? 1 : 0);

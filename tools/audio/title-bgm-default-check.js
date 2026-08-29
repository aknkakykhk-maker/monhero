#!/usr/bin/env node
// タイトル画面のデフォルトBGMを「Monster Hero」へ変更したことを確認する。
//   ・新規登録曲がBGMアレンジの共通選択肢(選択・試聴・保存)に含まれる
//   ・タイトルの既定値が新しい曲になっている
//   ・タイトルはこれまでbgmArrangementの対象外だった(=旧保存にtitleキーは無い)ため、
//     新規キーを足すだけで「旧保存のまま = 新しい既定」に自動でなる
//   ・すでに自分でタイトル曲を選んでいる人の保存はそのまま尊重される
//   ・タイトル再生の呼び出し箇所が、決め打ちの'title'ではなくbgmArrangement.titleを使う
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const files = ['monster-hero/src/game-system.jsx', 'monster-hero/game-system.compiled.js'];
let failed = 0;
const check = (name, ok) => {
  console.log(`${ok ? '✓' : '✗'} ${name}`);
  if (!ok) failed++;
};

for (const file of files) {
  const source = fs.readFileSync(path.join(ROOT, file), 'utf8');
  const compact = source.replace(/\s+/g, '');
  const arrangeableBlock = source.match(/const BGM_TRACKS = \[([\s\S]*?)\];/)?.[1] || '';
  const arrangeableCompact = arrangeableBlock.replace(/\s+/g, '');
  const defaultsMatch = source.match(/const DEFAULT_BGM_ARRANGEMENT = Object\.freeze\((\{[^;]+\})\);/);
  const defaults = defaultsMatch ? Function(`return (${defaultsMatch[1]})`)() : {};

  check(`${file}: 新規曲のID・曲名・保存先を登録曲一覧へ追加`,
    arrangeableCompact.includes("id:'monster_hero_theme'") &&
    arrangeableCompact.includes("name:'MonsterHero'") &&
    arrangeableCompact.includes("src:'audio/bgm-monster-hero-theme.mp3'"));
  check(`${file}: 新規曲もBGMアレンジの選択・試聴・保存対象に含める(専用の新しい仕組みを作らない)`,
    arrangeableCompact.includes("id:'monster_hero_theme'") &&
    compact.includes('BGM_TRACKS.map(track=>') &&
    compact.includes('Audio_.previewBGM(trackId)') &&
    !source.includes('mh_title_bgm') && !source.includes('mh_monster_hero_theme'));
  check(`${file}: 旧title(legacyKey)の曲もそのまま残り、いつでも選び直せる`,
    arrangeableCompact.includes("id:'original_title'") && arrangeableCompact.includes("legacyKey:'title'"));
  check(`${file}: タイトルBGMの既定値がMonster Heroになっている`,
    defaults.title === 'monster_hero_theme');
  check(`${file}: タイトル以外の既定値は変更していない`,
    defaults.home === 'original_home' && defaults.management === 'original_profile' &&
    defaults.market === 'original_market' && defaults.temple === 'original_fusion' &&
    defaults.battle === 'original_battle' && defaults.boss === 'original_boss' &&
    defaults.clear === 'ichika_clear');
  check(`${file}: BGMアレンジの基本カテゴリにタイトルの設定欄がある`,
    /id:'basic',label:'基本',items:\[\['home','HOMEBGM'\],\['title','タイトルBGM'\]/.test(compact));
  check(`${file}: 起動時のタイトル再生が決め打ちの'title'ではなくbgmArrangement.titleを使う`,
    compact.includes("bootPhase==='TITLE'||bootPhase==='ENTERING_GAME'?bgmArrangement.title:null") &&
    compact.includes('Audio_.prepareBGM(bgmArrangement.title,5000)') &&
    compact.includes('Audio_.playBGM(bgmArrangement.title)') &&
    compact.includes('Audio_.ensurePlaying(bgmArrangement.title)') &&
    !/Audio_\.(?:prepareBGM|playBGM|ensurePlaying)\('title'/.test(source));
  check(`${file}: 決め打ちのtitle再生を残していない(bgmKeyForState等)`,
    !compact.includes("bootPhase==='TITLE'||bootPhase==='ENTERING_GAME'?'title':null"));
}

// 旧保存互換・移行の確認は normalizeBgmArrangement を実際に切り出して動かす
{
  const source = fs.readFileSync(path.join(ROOT, 'monster-hero/src/game-system.jsx'), 'utf8');
  const trackBlock = source.match(/const BGM_TRACKS = \[[\s\S]*?\n\];/)?.[0];
  const byIdLine = source.match(/const BGM_TRACK_BY_ID = [^\n]+;/)?.[0];
  const byKeyLine = source.match(/const BGM_TRACK_BY_KEY = [^\n]+;/)?.[0];
  const defaultsLine = source.match(/const DEFAULT_BGM_ARRANGEMENT = Object\.freeze\(\{[^;]+\}\);/)?.[0];
  const legacyLine = source.match(/const BGM_ARRANGEMENT_LEGACY_FALLBACK = [^\n]+;/)?.[0];
  const normalizeLine = source.match(/const normalizeBgmArrangement = [\s\S]*?\n\}\)\);/)?.[0];
  check('normalizeBgmArrangementまわりを取り出せる',
    !!(trackBlock && byIdLine && byKeyLine && defaultsLine && legacyLine && normalizeLine));
  let normalizeBgmArrangement = null;
  try {
    normalizeBgmArrangement = Function(`
      ${trackBlock}
      ${byIdLine}
      ${byKeyLine}
      ${defaultsLine}
      ${legacyLine}
      ${normalizeLine}
      return normalizeBgmArrangement;
    `)();
  } catch (e) { console.error(e); }
  check('normalizeBgmArrangementを実行できる', typeof normalizeBgmArrangement === 'function');
  if (normalizeBgmArrangement) {
    check('titleキーが無い旧保存は新しい既定(Monster Hero)へ自動で解決される',
      normalizeBgmArrangement({ home:'original_home' }).title === 'monster_hero_theme');
    check('保存が空(初回起動)でも新しい既定になる',
      normalizeBgmArrangement({}).title === 'monster_hero_theme');
    check('自分でタイトル曲を選んでいる人(旧曲のまま)の保存は上書きされない',
      normalizeBgmArrangement({ title:'original_title' }).title === 'original_title');
    check('自分でMonster Hero以外の曲を選んでいる人の保存も上書きされない',
      normalizeBgmArrangement({ title:'ichika_home' }).title === 'ichika_home');
    check('存在しないtrack idは既定へ正規化される(壊れた保存の保護)',
      normalizeBgmArrangement({ title:'no_such_track' }).title === 'monster_hero_theme');
    check('タイトル以外の項目は今までどおり正規化される(既存の互換を壊していない)',
      normalizeBgmArrangement({ quickMoo:'boss' }).quickMoo === 'original_boss');
  }
}

const audioPath = path.join(ROOT, 'monster-hero/audio/bgm-monster-hero-theme.mp3');
const audio = fs.existsSync(audioPath) ? fs.readFileSync(audioPath) : null;
check('新規MP3が存在し内容を持つ',
  !!audio && audio.length > 1024 && (audio.slice(0, 3).toString() === 'ID3' || audio[0] === 0xff));

const help = fs.readFileSync(path.join(ROOT, 'monster-hero/data/help.js'), 'utf8');
const changelog = fs.readFileSync(path.join(ROOT, 'monster-hero/data/changelog.js'), 'utf8');
check('ヘルプにタイトルBGMの既定変更と既存ユーザー保護を記載',
  /Monster Hero/.test(help) && /タイトル/.test(help) && /BGMアレンジ/.test(help));
check('更新履歴にタイトルBGMの既定変更を記載',
  /Monster Hero/.test(changelog));

console.log(failed ? `\n${failed}件のNGがあります` : '\nすべてOK');
process.exit(failed ? 1 : 0);

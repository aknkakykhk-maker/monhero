const fs = require('fs');

const sourcePath = 'monster-hero/src/game-system.jsx';
const releasePath = 'monster-hero/data/rhythm-step3-release.js';

let src = fs.readFileSync(sourcePath, 'utf8');
const oldShare = "await navigator.share({ files:[file], title:'Monster Hero バックアップ' });";
const newShare = "await navigator.share({ files:[file] });";
if (!src.includes(oldShare)) throw new Error('navigator.share target not found');
src = src.replace(oldShare, newShare);
fs.writeFileSync(sourcePath, src);

let release = fs.readFileSync(releasePath, 'utf8');
release = release.replace(/const RHYTHM_RELEASE_TITLE='[^']+';/, "const RHYTHM_RELEASE_TITLE='iPhoneでバックアップファイル名が変わる問題を修正';");
const oldItems = `        'バックアップ／復元画面に使い方を表示し、iPhoneでの「ファイルに保存」手順と復元手順を画面内で確認できるようにしました。',\n        '保存ファイル名を「MonsterHero_Backup_YYYYMMDD_HHMM.mhsave」に統一しました。従来の引き継ぎコード方式と既存のmh_*セーブデータ形式は変更していません。'`;
const newItems = `        'iPhoneの共有メニューへバックアップファイルだけを渡すようにし、「ファイルに保存」で名前が「テキスト」などへ変わる問題を修正しました。',\n        '保存名は「MonsterHero_Backup_YYYYMMDD_HHMM.mhsave」を維持します。従来の引き継ぎコード方式と既存のmh_*セーブデータ形式は変更していません。'`;
if (!release.includes(oldItems)) throw new Error('release items target not found');
release = release.replace(oldItems, newItems);
fs.writeFileSync(releasePath, release);

console.log('patched iOS mhsave share filename handling');

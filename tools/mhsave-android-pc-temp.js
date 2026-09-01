const fs = require('fs');

const sourcePath = 'monster-hero/src/game-system.jsx';
const helperPath = 'monster-hero/data/mhsave-backup.js';
const changelogPath = 'monster-hero/data/changelog.js';
const saveSpecPath = 'docs/spec/SAVE_DATA.md';

let src = fs.readFileSync(sourcePath, 'utf8');

const oldShareGate = "      if (typeof File !== 'undefined' && navigator.share && navigator.canShare) {";
const newShareGate = "      const isAppleMobile = /iPad|iPhone|iPod/.test(navigator.userAgent || '') || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);\n      if (isAppleMobile && typeof File !== 'undefined' && navigator.share && navigator.canShare) {";
if (!src.includes(oldShareGate)) throw new Error('share gate target not found');
src = src.replace(oldShareGate, newShareGate);

const oldGuide = '<div>2. iPhoneは共有メニューで「ファイルに保存」を選ぶ</div><div>3. iCloud Driveなど、あとで見つけやすい場所へ保存する</div>';
const newGuide = '<div>2. iPhone / iPadは共有メニューで「ファイルに保存」を選ぶ</div><div>3. Android / PCはダウンロードフォルダへ直接保存されます</div><div>4. 端末間で移すときはGoogle Driveなどへ同じファイルを置く</div>';
if (!src.includes(oldGuide)) throw new Error('backup guide target not found');
src = src.replace(oldGuide, newGuide);

const oldDownloadMessage = "      setRestoreMsg('バックアップファイルを保存しました');";
const newDownloadMessage = "      setRestoreMsg('バックアップファイルをダウンロードしました');";
if (!src.includes(oldDownloadMessage)) throw new Error('download message target not found');
src = src.replace(oldDownloadMessage, newDownloadMessage);

fs.writeFileSync(sourcePath, src);

let helper = fs.readFileSync(helperPath, 'utf8');
const oldHelperStamp = "    return `${date.getFullYear()}${pad(date.getMonth()+1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;";
const newHelperStamp = "    return `${date.getFullYear()}${pad(date.getMonth()+1)}${pad(date.getDate())}_${pad(date.getHours())}${pad(date.getMinutes())}`;";
if (!helper.includes(oldHelperStamp)) throw new Error('helper timestamp target not found');
helper = helper.replace(oldHelperStamp, newHelperStamp);
helper = helper.replace("const blob = new Blob([code], { type:'text/plain;charset=utf-8' });", "const blob = new Blob([code], { type:'application/octet-stream' });");
const oldHelperFilename = "      link.download = `monster-hero-backup-${fileStamp(new Date())}${FILE_EXT}`;";
const newHelperFilename = "      link.download = `MonsterHero_Backup_${fileStamp(new Date())}${FILE_EXT}`;";
if (!helper.includes(oldHelperFilename)) throw new Error('helper filename target not found');
helper = helper.replace(oldHelperFilename, newHelperFilename);
const oldHelpText = "        { t:'p', text:'「バックアップファイルを保存（.mhsave）」なら、長い引き継ぎコードをコピーせず端末のファイルとして保管できます。復元するときは「バックアップファイルから復元」を選んで保存した.mhsaveファイルを開きます。' },";
const newHelpText = "        { t:'p', text:'「バックアップファイルを保存（.mhsave）」なら、長い引き継ぎコードをコピーせず端末のファイルとして保管できます。iPhone / iPadは共有メニューから「ファイルに保存」、Android / PCはダウンロードフォルダへ直接保存されます。端末を替えるときは同じ.mhsaveファイルをGoogle Driveなどで受け渡し、「バックアップファイルから復元」で開きます。' },";
if (!helper.includes(oldHelpText)) throw new Error('helper help text target not found');
helper = helper.replace(oldHelpText, newHelpText);
fs.writeFileSync(helperPath, helper);

let changelog = fs.readFileSync(changelogPath, 'utf8');
const changelogTitle = 'Android・PCのバックアップ保存に対応';
if (!changelog.includes(`title:'${changelogTitle}'`)) {
  const marker = 'const CHANGELOG = [\n';
  if (!changelog.includes(marker)) throw new Error('changelog marker not found');
  const entry = `  {\n    date: \"2026-09-01 20:16\", type:'update', title:'${changelogTitle}',\n    items:['バックアップファイル保存を端末別に最適化し、Android ChromeとPC Chromeでは共有メニューを使わず「MonsterHero_Backup_YYYYMMDD_HHMM.mhsave」を直接ダウンロードするようにしました。', 'iPhone / iPadは従来どおり共有メニューから「ファイルに保存」を利用できます。復元は全端末共通で.mhsaveファイルを選択し、従来の引き継ぎコード方式とmh_*保存形式もそのまま維持しています。'],\n  },\n`;
  changelog = changelog.replace(marker, marker + entry);
}
fs.writeFileSync(changelogPath, changelog);

let spec = fs.readFileSync(saveSpecPath, 'utf8');
const oldSpec = '保存ファイル名は `MonsterHero_Backup_YYYYMMDD_HHMM.mhsave`（日時部分は保存時刻）とし、iPhoneでは共有メニューから「ファイルに保存」を選べる。';
const newSpec = '保存ファイル名は `MonsterHero_Backup_YYYYMMDD_HHMM.mhsave`（日時部分は保存時刻）とする。iPhone / iPadでは共有メニューから「ファイルに保存」を選び、Android Chrome / PC Chromeでは共有APIを使わずブラウザのダウンロードとして直接保存する。';
if (!spec.includes(oldSpec)) throw new Error('SAVE_DATA platform sentence target not found');
spec = spec.replace(oldSpec, newSpec);
fs.writeFileSync(saveSpecPath, spec);

const finalSrc = fs.readFileSync(sourcePath, 'utf8');
if (!finalSrc.includes('isAppleMobile && typeof File')) throw new Error('Apple-only share gate missing');
if (!finalSrc.includes('Android / PCはダウンロードフォルダへ直接保存されます')) throw new Error('Android/PC UI guide missing');
if (!finalSrc.includes("a.download = filename")) throw new Error('download filename assignment missing');
console.log('patched Android/PC mhsave download flow');

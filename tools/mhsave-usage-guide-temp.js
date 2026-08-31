const fs = require('fs');

const sourcePath = 'monster-hero/src/game-system.jsx';
const releasePath = 'monster-hero/data/rhythm-step3-release.js';
const saveSpecPath = 'docs/spec/SAVE_DATA.md';

let src = fs.readFileSync(sourcePath, 'utf8');

const oldStamp = "return d.getFullYear() + pad(d.getMonth() + 1) + pad(d.getDate()) + '-' + pad(d.getHours()) + pad(d.getMinutes()) + pad(d.getSeconds());";
const newStamp = "return d.getFullYear() + pad(d.getMonth() + 1) + pad(d.getDate()) + '_' + pad(d.getHours()) + pad(d.getMinutes());";
if (!src.includes(oldStamp)) throw new Error('backup timestamp format target not found');
src = src.replace(oldStamp, newStamp);

const oldFilename = "const filename = 'monster-hero-backup-' + backupFileStamp() + '.mhsave';";
const newFilename = "const filename = 'MonsterHero_Backup_' + backupFileStamp() + '.mhsave';";
if (!src.includes(oldFilename)) throw new Error('backup filename target not found');
src = src.replace(oldFilename, newFilename);

const exportAnchor = `backupTab==='export'?<><button data-mhsave-action="export" className="mh-dialog-choice" onClick={saveBackupFile}>バックアップファイルを保存（.mhsave）</button>`;
const exportGuide = `backupTab==='export'?<><div style={{background:'rgba(15,23,42,.72)',border:'1px solid rgba(255,255,255,.12)',borderRadius:12,padding:'12px 14px',margin:'10px 0',textAlign:'left',fontSize:12,lineHeight:1.65,color:'#e2e8f0'}}><div style={{fontWeight:900,color:'#fff',marginBottom:4}}>使い方</div><div>1. 下の「バックアップファイルを保存」を押す</div><div>2. iPhoneは共有メニューで「ファイルに保存」を選ぶ</div><div>3. iCloud Driveなど、あとで見つけやすい場所へ保存する</div><div style={{marginTop:8,fontWeight:900,color:'#fff'}}>保存ファイル名</div><code style={{display:'block',marginTop:2,wordBreak:'break-all',color:'#c4b5fd'}}>MonsterHero_Backup_YYYYMMDD_HHMM.mhsave</code><div style={{marginTop:6,color:'#94a3b8'}}>※ YYYYMMDD_HHMM は保存した日時に置き換わります。</div></div><button data-mhsave-action="export" className="mh-dialog-choice" onClick={saveBackupFile}>バックアップファイルを保存（.mhsave）</button>`;
if (!src.includes(exportAnchor)) throw new Error('export UI anchor not found');
src = src.replace(exportAnchor, exportGuide);

const importAnchor = `</button></>:<><button data-mhsave-action="import" className="mh-dialog-choice" onClick={restoreFromBackupFile}>バックアップファイルから復元（.mhsave）</button>`;
const importGuide = `</button></>:<><div style={{background:'rgba(15,23,42,.72)',border:'1px solid rgba(255,255,255,.12)',borderRadius:12,padding:'12px 14px',margin:'10px 0',textAlign:'left',fontSize:12,lineHeight:1.65,color:'#e2e8f0'}}><div style={{fontWeight:900,color:'#fff',marginBottom:4}}>使い方</div><div>1. 下の「バックアップファイルから復元」を押す</div><div>2. 保存した <code style={{color:'#c4b5fd'}}>MonsterHero_Backup_....mhsave</code> を選ぶ</div><div>3. 復元後、ゲームは自動で再読み込みされます</div><div style={{marginTop:7,color:'#fbbf24'}}>※ 選んだバックアップ内のデータで現在のセーブが上書きされます。</div></div><button data-mhsave-action="import" className="mh-dialog-choice" onClick={restoreFromBackupFile}>バックアップファイルから復元（.mhsave）</button>`;
if (!src.includes(importAnchor)) throw new Error('import UI anchor not found');
src = src.replace(importAnchor, importGuide);

if (!src.includes("MonsterHero_Backup_YYYYMMDD_HHMM.mhsave")) throw new Error('filename guide missing');
if (!src.includes("const filename = 'MonsterHero_Backup_' + backupFileStamp() + '.mhsave';")) throw new Error('new filename missing');
fs.writeFileSync(sourcePath, src);

let release = fs.readFileSync(releasePath, 'utf8');
release = release.replace(/const RHYTHM_RELEASE_TITLE='[^']+';/, "const RHYTHM_RELEASE_TITLE='バックアップ画面に使い方とファイル名を表示';");
const oldItem1 = "        'データ引き継ぎ画面のReact本体へ「バックアップファイルを保存（.mhsave）」と「バックアップファイルから復元（.mhsave）」を直接追加しました。',";
const oldItem2 = "        'iPhoneでは共有メニューから「ファイルに保存」を選べます。従来の引き継ぎコード方式と既存のmh_*セーブデータ形式もそのまま維持しています。'";
const newItem1 = "        'バックアップ／復元画面に使い方を表示し、iPhoneでの「ファイルに保存」手順と復元手順を画面内で確認できるようにしました。',";
const newItem2 = "        '保存ファイル名を「MonsterHero_Backup_YYYYMMDD_HHMM.mhsave」に統一しました。従来の引き継ぎコード方式と既存のmh_*セーブデータ形式は変更していません。'";
if (!release.includes(oldItem1) || !release.includes(oldItem2)) throw new Error('release item targets not found');
release = release.replace(oldItem1, newItem1).replace(oldItem2, newItem2);
fs.writeFileSync(releasePath, release);

let spec = fs.readFileSync(saveSpecPath, 'utf8');
const oldSpec = 'プロフィールの手動バックアップは、`localStorage` 内の `mh_` で始まる全キーについて「保存済みの生文字列」をオブジェクトにし、JSON→UTF-8互換変換→Base64化する。復元はBase64を逆変換し、`mh_` キーが1つ以上あれば各値をそのまま `localStorage` へ書き、再読み込みする。';
const newSpec = 'プロフィールの手動バックアップは、`localStorage` 内の `mh_` で始まる全キーについて「保存済みの生文字列」をオブジェクトにし、JSON→UTF-8互換変換→Base64化する。従来のコード方式に加えて、この同じBase64文字列を `.mhsave` ファイルとして保存・復元できる。保存ファイル名は `MonsterHero_Backup_YYYYMMDD_HHMM.mhsave`（日時部分は保存時刻）とし、iPhoneでは共有メニューから「ファイルに保存」を選べる。復元はコードまたは `.mhsave` のBase64を逆変換し、`mh_` キーが1つ以上あれば各値をそのまま `localStorage` へ書き、再読み込みする。';
if (!spec.includes(oldSpec)) throw new Error('SAVE_DATA backup paragraph target not found');
spec = spec.replace(oldSpec, newSpec);
fs.writeFileSync(saveSpecPath, spec);

console.log('patched mhsave usage guide and filename');

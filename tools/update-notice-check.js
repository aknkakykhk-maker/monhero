// 新バージョン検知から更新までの退行を静的に検出する。
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'monster-hero', 'src', 'game-system.jsx'), 'utf8');
const stampTool = fs.readFileSync(path.join(__dirname, 'stamp-version.js'), 'utf8');
const checks = [
  ['30秒間隔と画面復帰時にversion.jsonを再確認', source.includes('setInterval(checkVersion, 30 * 1000)') && source.includes("window.addEventListener('pageshow', onVisible)")],
  ['初回検知で自動再読み込みせず更新ボタンを表示', source.includes('setUpdateAvailable(true)') && !source.includes('if (wasFirstCheck) window.location.reload()')],
  ['更新ボタンをbody直下に表示', source.includes('ReactDOM.createPortal(') && source.includes('document.body') && source.includes('z-[100000]')],
  ['更新時にページURLのキャッシュを回避', source.includes("url.searchParams.set('mh_refresh', Date.now().toString())") && source.includes('window.location.replace(url.toString())')],
  ['出荷時に本体JSのキャッシュキーも更新', stampTool.includes("index.replace(/var GAME_BUILD = '[^']*';/") && stampTool.includes("stamp.replace(/[- :]/g, '')")],
];

let failed = 0;
for (const [name, ok] of checks) {
  console.log(`${ok ? 'OK' : 'NG'}: ${name}`);
  if (!ok) failed++;
}
if (failed) process.exit(1);
console.log('OK: 新バージョン通知と更新経路の検証に成功しました');

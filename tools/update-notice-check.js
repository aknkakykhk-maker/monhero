// 新バージョン検知から更新までの退行を静的に検出する。
// 更新バナー用build番号は全出荷で進め、CHANGELOGはユーザー向け変更だけを別管理する。
// 配信対象の更新でversion更新が漏れないこと自体は compiled-check.yml 側でも必須検査する。
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'monster-hero', 'src', 'game-system.jsx'), 'utf8');
const stampTool = fs.readFileSync(path.join(__dirname, 'stamp-version.js'), 'utf8');
const version = JSON.parse(fs.readFileSync(path.join(root, 'monster-hero', 'version.json'), 'utf8'));
const index = fs.readFileSync(path.join(root, 'monster-hero', 'index.html'), 'utf8');
const rhythmRelease = fs.readFileSync(path.join(root, 'monster-hero', 'data', 'rhythm-step3-release.js'), 'utf8');
const calibrationPath = path.join(root, 'monster-hero', 'data', 'rhythm-geometry-calibration.js');
const calibration = fs.existsSync(calibrationPath) ? fs.readFileSync(calibrationPath, 'utf8') : '';
const buildDate = source.match(/const BUILD_DATE = "([^"]+)";/)?.[1];
const releaseDate = rhythmRelease.match(/const RHYTHM_RELEASE_DATE='([^']+)'/)?.[1];
const dataBuild = rhythmRelease.match(/const RHYTHM_DATA_BUILD='([^']+)'/)?.[1];
const compiledBuild = rhythmRelease.match(/const RHYTHM_COMPILED_BUILD='([^']+)'/)?.[1];
const calibrationDataBuild = calibration.match(/const RHYTHM_CALIBRATION_DATA_BUILD='([^']+)'/)?.[1];
const calibrationCompiledBuild = calibration.match(/const RHYTHM_CALIBRATION_COMPILED_BUILD='([^']+)'/)?.[1];
const normalStamp = !!buildDate && buildDate === version.build;
const dataOnlyStamp = !!buildDate
  && dataBuild === version.build
  && releaseDate === version.build
  && compiledBuild === buildDate
  && rhythmRelease.includes("String(rawUrl).includes('version.json')")
  && rhythmRelease.includes('if(data?.build===RHYTHM_DATA_BUILD)')
  && rhythmRelease.includes('build:RHYTHM_COMPILED_BUILD');
const calibrationDataOnlyStamp = !!buildDate
  && calibrationDataBuild === version.build
  && calibrationCompiledBuild === buildDate
  && index.includes('data/rhythm-geometry-calibration.js?v=')
  && calibration.includes("String(rawUrl).includes('version.json')")
  && calibration.includes('if(data?.build===RHYTHM_CALIBRATION_DATA_BUILD)')
  && calibration.includes('build:RHYTHM_CALIBRATION_COMPILED_BUILD');
const validStamp = normalStamp || dataOnlyStamp || calibrationDataOnlyStamp;
const checks = [
  ['BUILD_DATE・version.json、または検証済みdata-only橋渡しが整合', validStamp],
  ['data-only橋渡しは今回versionだけを既存compiledへ写し、将来versionは素通し', normalStamp
    || (dataOnlyStamp && rhythmRelease.includes('if(data?.build===RHYTHM_DATA_BUILD)') && !rhythmRelease.includes('if(data?.build!==RHYTHM_DATA_BUILD)'))
    || (calibrationDataOnlyStamp && calibration.includes('if(data?.build===RHYTHM_CALIBRATION_DATA_BUILD)') && !calibration.includes('if(data?.build!==RHYTHM_CALIBRATION_DATA_BUILD)'))],
  ['デバッグdata-only橋渡しは更新履歴へ追記しない', !calibrationDataOnlyStamp || (!calibration.includes('CHANGELOG.unshift') && !calibration.includes('HELP_CATEGORIES'))],
  ['更新バナー用stampはCHANGELOGを自動変更しない', !stampTool.includes('replacedChangelog') && !stampTool.includes('fs.writeFileSync(changelogPath') && stampTool.includes('CHANGELOGは変更しません')],
  ['30秒間隔・バックグラウンド復帰・ページ再表示時にversion.jsonを再確認', source.includes('setInterval(checkVersion, 30 * 1000)') && source.includes("document.addEventListener('visibilitychange', onVisible)") && source.includes("window.addEventListener('pageshow', onVisible)")],
  ['version.jsonをキャッシュなしで取得', source.includes("fetch('version.json?t=' + Date.now(), { cache: 'no-store' })")],
  ['初回検知で自動再読み込みせず更新ボタンを表示', source.includes('setUpdateAvailable(true)') && !source.includes('if (wasFirstCheck) window.location.reload()')],
  ['更新ボタンをbody直下に表示', source.includes('ReactDOM.createPortal(') && source.includes('document.body') && source.includes('z-[100000]')],
  ['更新時にページURLのキャッシュを回避', source.includes("url.searchParams.set('mh_refresh', Date.now().toString())") && source.includes('window.location.replace(url.toString())')],
  ['出荷時に本体JSのキャッシュキーも更新', stampTool.includes("index.replace(/var GAME_BUILD = '[^']*';/") && stampTool.includes("stamp.replace(/[- :]/g, '')")],
  ['全出荷の更新バナー用versionをBUILD_DATEと一緒に更新', stampTool.includes("version.json") && stampTool.includes('BUILD_DATE、version.json、GAME_BUILD')],
  ['通常ビルドが日時更新を必ず実行', fs.readFileSync(path.join(__dirname, 'build.js'), 'utf8').includes("require('./stamp-version')")],
];

let failed = 0;
for (const [name, ok] of checks) {
  console.log(`${ok ? 'OK' : 'NG'}: ${name}`);
  if (!ok) failed++;
}
if (failed) process.exit(1);
console.log('OK: 新バージョン通知と更新経路の検証に成功しました');

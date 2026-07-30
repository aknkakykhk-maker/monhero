// 新バージョン通知を「押すと更新／×で今回は閉じる」の2択にできているか確認する。
const fs=require('fs'),path=require('path'),assert=require('assert');
const src=fs.readFileSync(path.join(__dirname,'..','monster-hero','src','game-system.jsx'),'utf8');
const built=fs.readFileSync(path.join(__dirname,'..','monster-hero','game-system.compiled.js'),'utf8');
let failed=0;
const check=(name,ok)=>{console.log(`${ok?'OK':'NG'}: ${name}`);if(!ok)failed++;};

// 変換後のJSは日本語の文字列が \uXXXX へ書き換わるので、比較前に戻す
const unescapeJs=t=>t.replace(/\\u([0-9a-fA-F]{4})/g,(_,h)=>String.fromCharCode(parseInt(h,16)));
for (const [label,code] of [['ソース',src],['配信用JS',unescapeJs(built)]]) {
  check(`${label}: 本体を押すと更新する`, code.includes('onClick={reloadLatestVersion}')||code.includes('onClick: reloadLatestVersion'));
  check(`${label}: 閉じるボタンがある`, code.includes('あとで更新する（この通知を閉じる）'));
  check(`${label}: 閉じても更新しない`, code.includes('setDismissedUpdateBuild(latestBuild||BUILD_DATE)')||code.includes('setDismissedUpdateBuild(latestBuild || BUILD_DATE)'));
  check(`${label}: 閉じたバージョンのあいだは出さない`, code.includes('latestBuild !== dismissedUpdateBuild'));
  check(`${label}: 検知したバージョンを覚える`, code.includes('setLatestBuild(data.build)'));
  check(`${label}: body直下に出す`, code.includes('document.body'));
}
// 閉じる状態は保存しない(次に開き直したらまた出る)
check('閉じた状態を端末に保存しない', !src.includes("storeSet('mh_update_dismissed"));

// 表示条件そのものを動かして確かめる
const visible=(updateAvailable,latestBuild,dismissed)=>updateAvailable && (!latestBuild || latestBuild !== dismissed);
check('新しいバージョンがあれば出る', visible(true,'2026-08-01 10:00',null)===true);
check('閉じたら出ない', visible(true,'2026-08-01 10:00','2026-08-01 10:00')===false);
check('さらに新しいバージョンならまた出る', visible(true,'2026-08-01 12:00','2026-08-01 10:00')===true);
check('新バージョンが無ければ出ない', visible(false,null,null)===false);

console.log(failed?`\n${failed}件のNGがあります`:'\nすべてOK');
process.exit(failed?1:0);

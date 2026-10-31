// 立ち絵の体の範囲の表(data/images/images-ally.js の ART_BODY_CENTERS)が、今の絵と合っているか(2026-10-31 ルールくん)。
// 絵を足した・差し替えたのに表を作り直していないと、MFバトルカードのキラ・レアキラの立ち絵の光が体の真ん中からずれる。
// 直し方: node tools/image/make-art-body-centers.js
try {
  require('child_process').execFileSync(process.execPath, [require('path').join(__dirname, 'make-art-body-centers.js'), '--check'], { stdio: 'inherit' });
} catch (e) { process.exit(1); }

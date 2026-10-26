// 立ち絵の中身の範囲の表(data/images/images-ally.js の ART_CONTENT_BOXES)が、今の絵と合っているか(2026-10-27 カード部パックくん)。
// 絵を足した・差し替えたのに表を作り直していないと、MFバトルカードの対戦開始(VS)の画面で大きさがそろわない。
// 直し方: node tools/image/make-art-content-boxes.js
require('child_process').execFileSync(process.execPath, [require('path').join(__dirname, 'make-art-content-boxes.js'), '--check'], { stdio: 'inherit' });

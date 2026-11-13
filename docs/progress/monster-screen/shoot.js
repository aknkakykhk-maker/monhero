// 止め絵を1画面ずつ PNG(縦長・2倍)に撮る: node shoot.js
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const p = await b.newPage({ viewport: { width: 1260, height: 1000 }, deviceScaleFactor: 2 });
  p.on('pageerror', (e) => console.log('エラー', e.message));
  await p.goto('file://' + __dirname + '/mock.html');
  await p.waitForTimeout(600);
  const names = ['fuse-a-door3', 'fuse-a-list', 'fuse-a-detail', 'fuse-b-door4', 'fuse-b-list', 'fuse-b-base-feature', 'door', 'mas-list', 'base-list', 'mas-basic', 'mas-apt', 'base-feature'];
  const phs = await p.$$('.ph');
  for (let i = 0; i < phs.length; i++) await phs[i].screenshot({ path: __dirname + '/lab-' + (names[i] || 'x' + i) + '.png' });
  console.log(phs.length + '枚');
  await b.close();
})();

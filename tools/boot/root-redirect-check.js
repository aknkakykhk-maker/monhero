const fs = require('fs');
const assert = require('assert');
const html = fs.readFileSync('index.html', 'utf8');
assert(/<script>location\.replace\(new URL\('monster-hero\/'/.test(html));
assert(!html.includes('LF Apps'));
assert(!html.includes('モンスターヒーロー選択'));
assert(html.indexOf('location.replace') < html.indexOf('</head>'));
console.log('OK: ルートは描画前にMonster Heroへ履歴を残さず遷移');

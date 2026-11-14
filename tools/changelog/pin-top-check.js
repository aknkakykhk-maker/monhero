#!/usr/bin/env node
// 更新履歴の「一番上に固定」(pinTop)を見張る(2026-11-09)。
//
//   node tools/changelog/pin-top-check.js
//
// 社長「(本オープン記念のお知らせに)本オープンの画像つけて。あと上部に固定も」。
// 固定はもともと「開催中の期間限定イベント(type:'event')」だけのしくみだった。イベント以外のお知らせでも、
// pinTop:{ until } を書けば、出はじめ(visibleFrom)から until まで一番上に固定する。見張るのは:
//   ・本オープン記念のお知らせは 11/9 10:00 から 11/23 3:59 まで固定され、その前後は固定されない
//   ・本オープン記念のお知らせに絵が付いていて、その絵のファイルがある
//   ・pinTop を書いていないイベント以外のお知らせは、今までどおり固定されない
//   ・イベントの固定(assistantNotice の期間・pinUntil)の決めごとは変わらない
//   ・pinTop の until が読めない日時なら固定しない(書き間違いで永久に固定されない)
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..', '..');
const web = path.join(ROOT, 'monster-hero');
const changelogSrc = fs.readFileSync(path.join(web, 'data/changelog.js'), 'utf8');
const partSrc = fs.readFileSync(path.join(web, 'src/parts/17-release-changelog-login-missions.jsx'), 'utf8');

let failed = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`); if (!ok) failed++; };

// 本体の判定(changelogEventLive)をそのまま取り出して動かす
const from = partSrc.indexOf('const changelogEventLive = ');
const to = partSrc.indexOf('\n};\n', from);
check('本体の固定の判定(changelogEventLive)が見つかる', from >= 0 && to > from);
const ctx = {};
vm.createContext(ctx);
vm.runInContext(`${changelogSrc}\n${partSrc.slice(from, to + 3)}\nglobalThis.x = { CHANGELOG, changelogEventLive };`, ctx);
const { CHANGELOG, changelogEventLive } = ctx.x;
const at = (s) => Date.parse(s);

const grand = CHANGELOG.find((e) => e && e.title === 'モンヒロビート本オープン記念のプレゼント');
check('本オープン記念のお知らせがある', !!grand);
if (grand) {
  check('本オープン記念のお知らせに絵が付いている', typeof grand.image === 'string' && /^images\//.test(grand.image), String(grand.image));
  const file = grand.image ? path.join(web, grand.image.split('?')[0]) : '';
  check('その絵のファイルがある', !!file && fs.existsSync(file), file);
  // 固定の札の題は短く(2026-11-10 社長「モンヒロビート本オープン記念 これだけにしといて」)。一覧の行の題はそのまま
  check('固定の札の題は「モンヒロビート本オープン記念」', grand.pinTitle === 'モンヒロビート本オープン記念', String(grand.pinTitle));
  const app = fs.readFileSync(path.join(web, 'src/parts/60-app.jsx'), 'utf8');
  check('固定の札は pinTitle があればそれを出す', /data-changelog-pinned-title[^>]*>\{typeof c\.pinTitle==='string'&&c\.pinTitle\?c\.pinTitle:/.test(app));
  check('固定は 11/23 3:59 まで(周回5倍の終わり)', grand.pinTop && grand.pinTop.until === '2026-11-23T03:59:00+09:00', JSON.stringify(grand.pinTop));
  const cases = [
    ['2026-11-09T09:59:00+09:00', false, '出はじめの前'],
    ['2026-11-09T10:00:00+09:00', true, '出はじめ'],
    ['2026-11-15T12:00:00+09:00', true, '期間中'],
    ['2026-11-23T03:58:59+09:00', true, '終わる直前'],
    ['2026-11-23T03:59:00+09:00', false, '終わった時刻'],
    ['2026-12-01T00:00:00+09:00', false, '終わったあと'],
  ];
  const bad = cases.filter(([t, want]) => changelogEventLive(grand, at(t)) !== want).map(([t, want, label]) => `${label}(${t})で${want ? '固定されない' : '固定される'}`);
  check('本オープン記念のお知らせは 11/9 10:00〜11/23 3:59 だけ一番上に固定される', bad.length === 0, bad.join(' / '));
}

// pinTop を書いていないイベント以外のお知らせは固定しない
const plain = CHANGELOG.filter((e) => e && e.type !== 'event' && !e.pinTop);
const plainPinned = plain.filter((e) => changelogEventLive(e, at('2026-11-15T12:00:00+09:00')));
check('pinTop の無いイベント以外のお知らせは固定されない', plainPinned.length === 0, plainPinned.map((e) => e.title).slice(0, 3).join(' / '));

// イベントの固定の決めごとは今までどおり(告知の期間の中だけ・pinUntil を過ぎたら外れる)
const ev = { type: 'event', visibleFrom: '2026-11-01T00:00:00+09:00', assistantNotice: { notifyFrom: '2026-11-01T00:00:00+09:00', notifyUntil: '2026-11-10T00:00:00+09:00' } };
check('イベントは告知の期間の中だけ固定される(今までどおり)', changelogEventLive(ev, at('2026-11-05T00:00:00+09:00')) === true && changelogEventLive(ev, at('2026-11-11T00:00:00+09:00')) === false);
check('イベントは pinUntil を過ぎたら固定から外れる(今までどおり)', changelogEventLive({ ...ev, pinUntil: '2026-11-03T00:00:00+09:00' }, at('2026-11-05T00:00:00+09:00')) === false);

// 読めない日時なら固定しない
check('pinTop の until が読めないときは固定しない', changelogEventLive({ type: 'update', visibleFrom: '2026-11-01T00:00:00+09:00', pinTop: { until: 'いつか' } }, at('2026-11-05T00:00:00+09:00')) === false);
check('pinTop の until が無いときも固定しない', changelogEventLive({ type: 'update', pinTop: {} }, at('2026-11-05T00:00:00+09:00')) === false);
// days: 項目の日時(JST)から◯日だけ固定(2026-11-14 モンヒロサクセス β公開の帯「公開から2週間」)
check('pinTop の days は項目の日時から数えて、その日数のあいだ固定する', changelogEventLive({ type: 'content', date: '2026-11-20 12:00', pinTop: { days: 14 } }, at('2026-12-04T11:59:00+09:00')) === true
  && changelogEventLive({ type: 'content', date: '2026-11-20 12:00', pinTop: { days: 14 } }, at('2026-12-04T12:00:00+09:00')) === false);
check('pinTop の days は日時が読めないときは固定しない', changelogEventLive({ type: 'content', date: 'いつか', pinTop: { days: 14 } }, at('2026-11-21T00:00:00+09:00')) === false);
{ const beta = CHANGELOG.find((e) => e && e.assistantNotice && e.assistantNotice.id === 'update_notice_monsaku_v1');
  check('モンヒロサクセス β公開の項目は、公開から2週間 上に固定する帯を持つ', !!beta && beta.pinTop && beta.pinTop.days === 14 && beta.pinEmoji === '🌱' && beta.pinTitle === '新しい遊び「モンヒロサクセス」β版がはじまりました!' && beta.releaseFlag === 'monheroSuccess'); }

console.log(failed ? `${failed}件のNGがあります` : 'すべてOK');
process.exit(failed ? 1 : 0);

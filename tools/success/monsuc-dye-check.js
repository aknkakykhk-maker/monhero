// モンヒロサクセスのアシスト染色: 編成の子が持つ染色(colors)が、芯の memberOf・newRun・restore を通っても
//   そのまま残ることを確かめる。部分染色(部位ごとの null)・未染色・ベースモン・同種の別個体・古いセーブ互換
'use strict';
const { load } = require('./load.js');
const { SUC } = load();

let ng = 0;
const ok = (cond, msg) => { if (!cond) { ng += 1; console.log('NG:', msg); } };
const ST = { life: 500, pow: 500, wise: 500, hit: 500, eva: 500, tough: 500 };

// 部分染色(部位ごとに null = 未染色)がそのまま残る
const m1 = SUC.memberOf({ kind: 'raised', species: 'Mocchi', stats: ST, colors: ['#ff0000', null, '#00ff00'] });
ok(m1.colors[0] === '#ff0000' && m1.colors[1] === null && m1.colors[2] === '#00ff00', `部分染色が保持される: ${JSON.stringify(m1.colors)}`);
// 未染色(colors 無し)は空
const m2 = SUC.memberOf({ kind: 'raised', species: 'Mocchi', stats: ST });
ok(Array.isArray(m2.colors) && m2.colors.length === 0, 'colors 無しは空配列');
// ベースモンは染色を持たない
const m3 = SUC.memberOf({ kind: 'base', species: 'Mocchi', colors: ['#ff0000'] });
ok(m3.colors.length === 0, 'ベースモンは colors を持たない');
// 同種の別個体で色が混ざらない
const m4 = SUC.memberOf({ kind: 'raised', species: 'Mocchi', stats: ST, colors: ['#0000ff'] });
ok(m1.colors[0] === '#ff0000' && m4.colors[0] === '#0000ff', '同種の別個体で色が混ざらない');
// 育成の team に残り、保存→再開(restore)でも残る
const run = SUC.newRun({ id: 'dye1', species: 'Pixie', aid: 'mua', team: [{ kind: 'raised', species: 'Mocchi', stats: ST, colors: ['#ff0000', null, '#00ff00'] }] });
ok(run.team[0].colors && run.team[0].colors[0] === '#ff0000' && run.team[0].colors[1] === null && run.team[0].colors[2] === '#00ff00', 'newRun の team に染色が残る');
const re = SUC.restore(JSON.parse(JSON.stringify(run)));
ok(re.team[0].colors && re.team[0].colors[0] === '#ff0000' && re.team[0].colors[2] === '#00ff00', 'restore 後も染色が残る');
// 古いセーブ(team に colors が無い)も読める
const old = JSON.parse(JSON.stringify(run)); old.team.forEach((t) => delete t.colors);
const reOld = SUC.restore(old);
ok(!!reOld && Array.isArray(reOld.team), '古いセーブも読める');

if (ng) { console.log(`monsuc-dye-check: NG ${ng}件`); process.exit(1); }
console.log('monsuc-dye-check: OK');

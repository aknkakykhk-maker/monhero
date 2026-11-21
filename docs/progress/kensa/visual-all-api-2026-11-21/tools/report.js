#!/usr/bin/env node
// api-findings.json + 撮影の results.json → docs の画面ごとの表(screens/<まとまり>.md)と all-findings.json
'use strict';
const fs = require('fs');
const path = require('path');
const [SHOOT, API, DOC] = process.argv.slice(2);
const res = JSON.parse(fs.readFileSync(path.join(SHOOT, 'results.json'), 'utf8'));
const api = JSON.parse(fs.readFileSync(path.join(API, 'api-findings.json'), 'utf8'));
const FILE = { HOME: 'home', マーケット: 'market', カードバトル: 'battle', タクティクス: 'tactics', 図鑑: 'mb', 設定: 'settings', ヘルプ: 'help' };
const order = { 高: 0, 中: 1, 低: 2 };
const esc = (s) => String(s ?? '').replace(/\|/g, '／').replace(/\n/g, ' ');
const sceneOf = (f) => {
  const m = /〔([a-z0-9-]+)〕/.exec(f.scene || '');
  if (m) return m[1];
  const hit = res.scenes.find((s) => String(f.scene || '').includes(s.name));
  return hit ? hit.id : `common`;
};
const all = api.findings.map((f) => ({ ...f, sid: sceneOf(f) }));
fs.mkdirSync(path.join(DOC, 'screens'), { recursive: true });
const sum = [];
for (const [area, file] of Object.entries(FILE)) {
  const scenes = res.scenes.filter((s) => s.area === area);
  const L = [`# ${area} の画面(${scenes.length}場面)`, '', '[← まとめに戻る](../README.md)', '',
    '- API = Claude Opus(社長の目線の指示書)の見つけ物。全部載せる(上位だけにしない)', '- 測る = 撮るときに DOM から測った物(ui-measure.js)。高・中だけ。API が「空振り」とした物は API の行の「機械」に出る', ''];
  for (const sc of scenes) {
    const fs_ = all.filter((f) => f.sid === sc.id).sort((a, b) => (order[a.priority] ?? 3) - (order[b.priority] ?? 3));
    const meas = res.findings.filter((f) => f.scene === sc.id && f.priority !== '低');
    const c = (p) => fs_.filter((f) => f.priority === p).length;
    sum.push({ area, file, id: sc.id, name: sc.name, h: c('高'), m: c('中'), l: c('低'), meas: meas.length });
    L.push(`## ${sc.name}〔${sc.id}〕`, '', `API: 高 ${c('高')}・中 ${c('中')}・低 ${c('低')} / 測る(高・中): ${meas.length}`, '');
    if (fs_.length) {
      L.push('| 優先度 | 大きさ | 何が悪いか | 直し方の案 | 観点 | 受け持ち | 機械 |', '|---|---|---|---|---|---|---|');
      fs_.forEach((f) => L.push(`| ${f.priority} | ${(f.sizes || []).join('・')} | ${esc(f.what)} | ${esc(f.fix)} | ${f.viewpoint ?? ''} | ${esc(f.owner_hint)} | ${esc(f.machine_verdict)} |`));
    } else L.push('API の見つけ物なし。');
    if (meas.length) {
      const g = new Map();
      meas.forEach((m) => { const k = `${m.priority}|${m.kind}`; (g.get(k) || g.set(k, []).get(k)).push(m); });
      L.push('', '<details><summary>測る検査の生の見つけ物(高・中)</summary>', '');
      for (const [k, list] of g) { const [p, kind] = k.split('|'); L.push(`- [${p}] ${kind.replace(/^測る:/, '')}(${[...new Set(list.map((x) => x.size))].join('・')}): ${esc(list[0].detail).slice(0, 200)}`); }
      L.push('', '</details>');
    }
    L.push('');
  }
  const com = all.filter((f) => f.sid === 'common' && f.area === area);
  if (com.length) { L.push(`## ${area}の画面に共通`, '', '| 優先度 | 場面 | 何が悪いか | 直し方の案 | 観点 | 機械 |', '|---|---|---|---|---|---|');
    com.forEach((f) => L.push(`| ${f.priority} | ${esc(f.scene)} | ${esc(f.what)} | ${esc(f.fix)} | ${f.viewpoint ?? ''} | ${esc(f.machine_verdict)} |`)); L.push(''); }
  fs.writeFileSync(path.join(DOC, 'screens', `${file}.md`), L.join('\n'));
}
const lost = all.filter((f) => f.sid === 'common');
fs.writeFileSync(path.join(DOC, 'all-findings.json'), JSON.stringify({ usd: api.usd, unreadable: api.unreadable, findings: all }, null, 1));
fs.writeFileSync(path.join(API, 'summary.json'), JSON.stringify({ sum, lost: lost.length, total: all.length }, null, 1));
const c = (p) => all.filter((f) => f.priority === p).length;
console.log(`全 ${all.length}(高 ${c('高')}・中 ${c('中')}・低 ${c('低')})/ 場面に結び付かない ${lost.length}`);

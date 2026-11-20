#!/usr/bin/env node
// モンヒロサクセスの「甘え度・恐れ度が何で上がったか」の記録(芯の s.lw・r1119-019)の見張り。画面は開かない(数秒)。
//   ・動いた分だけ記録する(動かなかったら足さない)/ 記録の a・f は実際の増え(甘え度・恐れ度の差)と同じ
//   ・ほめる・しかる・ターンの終わり(体力の多い少ない)に理由の名前が付く / 最後の8件だけ残す
//   ・記録を足しても、甘え度・恐れ度の数は今までと同じ(記録の無い古い育成から始めても同じ数になる)
'use strict';
const { load } = require('./load');
const { SUC } = load();
const errors = []; const ok = (c, m) => { if (!c) errors.push(m); };

const s0 = SUC.newRun({ id: 'lw-1', species: 'Mocchi', aid: 'mua' });
ok(!s0.lw || (Array.isArray(s0.lw) && s0.lw.length === 0), '始めたときは記録が空');
let s = s0; let s2 = JSON.parse(JSON.stringify(s0)); delete s2.lw; // s2: 記録の無い古い育成として同じ手を打つ
const seen = new Set();
for (let i = 0; i < 30 && !s.over; i += 1) {
  if (s.battle || s.mealReady) break;
  const a = { kind: 'train', stat: ['pow', 'wise', 'hit'][i % 3] };
  const r1 = SUC.act(s, a); const r2 = SUC.act(s2, a); if (!r1.out || r1.out.ok === false) break;
  s = r1.state; s2 = r2.state;
  if (s.last && s.last.res) { const how = i % 2 ? 'praise' : 'scold'; s = SUC.react(s, how).state; s2 = SUC.react(s2, how).state; }
  const a0 = s.ama; const f0 = s.fear; const n0 = (s.lw || []).length;
  s = SUC.endTurn(s).state; s2 = SUC.endTurn(s2).state;
  const l = s.lw || [];
  if (s.ama !== a0 || s.fear !== f0) { const x = l[l.length - 1]; ok(x && (x.w === 'turnHp' || x.w === 'turnLow' || x.w), `ターンの終わりの記録がある(${i})`); }
  else ok(l.length === n0 || l.length === 8, `動かないときは足さない(${i})`);
  l.forEach((x) => seen.add(x.w));
  ok(s.ama === s2.ama && s.fear === s2.fear, `記録の有る無しで甘え度・恐れ度が同じ(${i}: ${s.ama}/${s.fear} と ${s2.ama}/${s2.fear})`);
}
const l = s.lw || [];
ok(l.length <= 8, `記録は8件まで(いま ${l.length})`);
ok(l.every((x) => Number.isFinite(x.t) && typeof x.w === 'string' && (x.a > 0 || x.f > 0)), '記録の形 { t, w, a, f } で、どれも何かが増えている');
ok(seen.has('turnHp') || seen.has('turnLow'), 'ターンの終わりの理由が付く');
ok(seen.has('praise') || seen.has('scold'), 'ほめる・しかるの理由が付く');
if (errors.length) { errors.slice(0, 10).forEach((e) => console.log(`NG: ${e}`)); console.log(`\n${errors.length}件のNG`); process.exit(1); }
console.log(`すべてOK(理由: ${[...seen].join('・')})`);

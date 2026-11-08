#!/usr/bin/env node
// 助手のマスモンの名前を AI で付ける(assistant-chat の kind:'masmon_names'・2026-11-08 社長の選び ❷B)を、偽物の Claude で確かめる
//   ① 回数を取ってから頼み、よい名前だけ返す(だめな名前・重複・頼んでいない番号は捨てる)
//   ② 1つも残らなければ回数を返して sorry
//   ③ 上限(user・total)・全員の上限 0 では Claude を呼ばない
//   ④ 頼みにプレイヤーの名前・メモを入れない(モンスター名と好きなわけだけ)・知らない助手は捨てる
//   ⑤ 名前の見張り(字の種類・長さ・禁止語・助手の名前そのもの)
'use strict';
const path = require('path');
const fs = require('fs');

const root = path.resolve(__dirname, '..', '..');
const CORE = path.join(root, 'supabase', 'functions', 'assistant-chat', 'core.js');
const DIGEST = JSON.parse(fs.readFileSync(path.join(root, 'monster-hero', 'data', 'assistant-chat-digest.json'), 'utf8'));

let failed = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`); if (!ok) failed++; };
const fakeClient = (respond) => { const calls = []; return { calls, messages: { create: async (p) => { calls.push(p); return respond(p); } } }; };
const okResponse = (obj) => ({ stop_reason: 'end_turn', content: [{ type: 'text', text: JSON.stringify(obj) }], usage: { input_tokens: 100, output_tokens: 50 } });
const counter = (res = { ok: true }) => { const c = { taken: 0, refunded: 0 }; c.takeMasmon = async () => { c.taken++; return res; }; c.refundMasmon = async () => { c.refunded++; }; return c; };
const body = (extra = {}) => ({ kind: 'masmon_names', breederId: 'b-1', playerName: 'たろう', items: [
  { a: 'mua', s: [{ slot: 1, mon: 'モッチー', why: 'まるくてかわいい' }, { slot: 2, mon: 'ピクシー', why: 'キラキラ' }] },
  { a: 'dra', s: [{ slot: 1, mon: 'スエゾー', why: 'ギャグが通じる' }] },
  { a: 'nobody', s: [{ slot: 1, mon: 'ゴーレム' }] },
], ...extra });

(async () => {
  const core = await import(CORE);
  { // ①
    const client = fakeClient(() => okResponse({ names: [
      { a: 'mua', slot: 1, n: 'もちまる' }, { a: 'mua', slot: 2, n: 'もちまる' }, { a: 'dra', slot: 1, n: 'Medama' }, { a: 'dra', slot: 3, n: 'はっぱ' },
    ] }));
    const c = counter();
    const r = await core.handleRequest({ body: body(), digest: DIGEST, client, takeMasmon: c.takeMasmon, refundMasmon: c.refundMasmon });
    check('① よい名前だけ返す(重複・英字・頼んでいない番号は捨てる)', r.json.ok === true && r.json.names.mua && r.json.names.mua[1] === 'もちまる' && !r.json.names.mua[2] && !r.json.names.dra, JSON.stringify(r.json.names));
    check('① 回数を1回取り、返さない', c.taken === 1 && c.refunded === 0, `${c.taken}/${c.refunded}`);
    const ask = client.calls[0].messages[0].content[0].text;
    check('④ 頼みにプレイヤーの名前を入れない・知らない助手は捨てる', !ask.includes('たろう') && !ask.includes('nobody') && ask.includes('モッチー'), ask.slice(0, 80));
    check('① モデルは Haiku・考えない・JSON の形', client.calls[0].model === core.MODEL && client.calls[0].output_config.format.type === 'json_schema');
  }
  { // ②
    const client = fakeClient(() => okResponse({ names: [{ a: 'mua', slot: 1, n: 'ばか' }] }));
    const c = counter();
    const r = await core.handleRequest({ body: body(), digest: DIGEST, client, takeMasmon: c.takeMasmon, refundMasmon: c.refundMasmon });
    check('② 1つも残らなければ回数を返して sorry', r.json.ok === false && r.json.kind === 'sorry' && c.refunded === 1);
    const c2 = counter();
    const r2 = await core.handleRequest({ body: body(), digest: DIGEST, client: fakeClient(() => { throw Object.assign(new Error('x'), { status: 529 }); }), takeMasmon: c2.takeMasmon, refundMasmon: c2.refundMasmon });
    check('② API が落ちても回数を返して sorry', r2.json.kind === 'sorry' && c2.refunded === 1);
  }
  { // ③
    for (const [label, res, limits] of [['user', { ok: false, reason: 'user' }, {}], ['total', { ok: false, reason: 'total' }, {}], ['0で止める', { ok: true }, { masmonTotal: 0 }]]) {
      const client = fakeClient(() => okResponse({ names: [] }));
      const c = counter(res);
      const r = await core.handleRequest({ body: body(), digest: DIGEST, client, takeMasmon: c.takeMasmon, refundMasmon: c.refundMasmon, limits });
      check(`③ 上限(${label})では Claude を呼ばない`, r.json.kind === 'tired' && client.calls.length === 0);
    }
    const r = await core.handleRequest({ body: { kind: 'masmon_names', breederId: 'b', items: [] }, digest: DIGEST, client: fakeClient(() => null), takeMasmon: counter().takeMasmon });
    check('③ 中身が無い頼みは bad_request', r.status === 400);
  }
  { // ⑤
    const names = Object.values(DIGEST.assistants).map(a => a.name);
    const ok = ['もちまる', 'ノア丸', 'ほいっぷ', 'メロ・メロ'], ng = ['a', 'Mochi', 'もち1号', 'ばかもち', 'きゅうこ', 'ダーリン', 'あいうえおかきくけ', '🍡だんご'];
    check('⑤ よい名前は通る', ok.every(n => core.masmonNameOk(n, names)), ok.filter(n => !core.masmonNameOk(n, names)).join(','));
    check('⑤ だめな名前は止める', ng.every(n => !core.masmonNameOk(n, names)), ng.filter(n => core.masmonNameOk(n, names)).join(','));
  }
  console.log(failed ? `\n${failed}件のNGがあります` : '\nすべてOK');
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });

// 作業用(コミットしない): タクティクスの盤面の目印を書き出す
const fs = require('fs');
module.exports = async function probe(s, tag) {
  const { page } = s;
  const snap = () => page.evaluate(() => {
    const t = (el) => (el ? (el.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 160) : null);
    const attrs = (el) => Object.fromEntries([...el.attributes].filter((a) => a.name.startsWith('data-')).map((a) => [a.name, a.value.slice(0, 60)]));
    return {
      slots: [...document.querySelectorAll('[data-slot-index]')].map((el) => ({ a: attrs(el), text: t(el),
        dmg: [...el.querySelectorAll('[data-tactics-damage-preview]')].map((x) => x.getAttribute('data-tactics-damage-preview')),
        guard: [...el.querySelectorAll('[data-tactics-guard-preview]')].map((x) => x.getAttribute('data-tactics-guard-preview')),
        party: [...el.querySelectorAll('[data-tactics-party-slot]')].map(attrs) })),
      enemyBar: t(document.querySelector('[data-enemy-bar]')), enemyBarA: document.querySelector('[data-enemy-bar]') && attrs(document.querySelector('[data-enemy-bar]')),
      notice: t(document.querySelector('[data-enemy-notice]')), intent: t(document.querySelector('[data-enemy-intent]')),
      range: [...document.querySelectorAll('[data-tactics-range-bar],[data-tactics-range-cell]')].map((el) => ({ a: attrs(el), text: t(el) })),
      hand: [...document.querySelectorAll('[data-hand-card]')].map((el) => ({ a: attrs(el), text: t(el), cls: el.className.slice(0, 200) })),
      total: t(document.querySelector('[data-battle-total-preview]')), action: t(document.querySelector('[data-battle-action]')),
      top: (document.body.innerText || '').replace(/\s+/g, ' ').slice(0, 400),
    };
  });
  const out = { tag, before: await snap(), tries: [] };
  const hand = out.before.hand.filter((h) => h.a['data-card-usable'] === 'true');
  for (const h of hand.slice(0, 5)) {
    const i = h.a['data-hand-card'];
    const tapIt = async () => { const b = await page.evaluate((x) => { const r = document.querySelector(`[data-hand-card="${x}"]`).getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, h: r.height, label: 'card' + x }; }, i); await s.tap(b, 'probe'); };
    await tapIt();
    await s.wait(600);
    const sel = await snap();
    await tapIt();
    await s.wait(600);
    const after = await snap();
    out.tries.push({ card: h.text, type: h.a['data-card-type'], sel: { slots: sel.slots.map((x) => ({ i: x.a['data-slot-index'], dmg: x.dmg, guard: x.guard, dis: x.a.disabled })), action: sel.action, total: sel.total, handCls: sel.hand.map((x) => x.cls.slice(0, 90)), top: sel.top.slice(0, 200) }, afterAction: after.action, afterTotal: after.total });
  }
  fs.appendFileSync('/tmp/claude-0/-home-user-monhero/a423a0de-a63f-572f-9f64-ba59ea25b32e/scratchpad/probe.jsonl', JSON.stringify(out) + '\n');
};

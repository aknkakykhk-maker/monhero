// 「好きなモンスター」の顔アイコン(friendsFaceIconOf)が、全モンスターで本番のプロフィールのアイコンと同じ絵・同じ調整の id になるかを確かめる。
//
// 背景: 選択画面やフレンドのプロフィールで絵をそのまま出していたため全身に見えたり、
//   スネグーラチカのようにマーケットの商品が顔アイコンと別の絵を使う子は、調整が掛からず顔の位置がずれた(2026-10-03)。
// 本物のデータ(data/*.js)を流して、全モンスターについて次を見る:
//   ・絵が決まる(null にならない)
//   ・最初から使える8体は モンスターid と顔アイコン(プロフィールのアイコン選びと同じ)
//   ・それ以外は マーケットの「◯◯のアイコン」の id と、その商品の絵(調整はこの id で引かれる)
//   ・調整(MARKET_PROFILE_ICON_STYLES)は BreederIcon が id で引くので、プロフィールと同じ id(商品のid)を返すこと
const fs = require('fs'), vm = require('vm'), path = require('path');
const root = path.resolve(__dirname, '../..');
let failed = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`); if (!ok) failed++; };

const html = fs.readFileSync(path.join(root, 'monster-hero/index.html'), 'utf8');
const files = [...html.matchAll(/<script src="(data\/[^"?]+\.js)(?:\?[^"]*)?"/g)].map((m) => m[1]);
const ctx = {};
vm.createContext(ctx);
for (const f of files) {
  const p = path.join(root, 'monster-hero', f);
  if (fs.existsSync(p)) vm.runInContext(fs.readFileSync(p, 'utf8'), ctx, { filename: f });
}
const api = fs.readFileSync(path.join(root, 'monster-hero/src/parts/34-friends-api.jsx'), 'utf8');
const fnSource = api.slice(api.indexOf('const friendsFaceIconOf ='), api.indexOf('const friendsStatusOf ='));
vm.runInContext(`${fnSource}\nglobalThis.__face = friendsFaceIconOf; globalThis.__d = { M: ALL_PLAYER_MONSTERS, I: BREEDER_MARKET_ITEMS, S: STARTER_MONSTER_IDS };`, ctx);
const face = ctx.__face, { M, I, S } = ctx.__d;
const styles = fs.readFileSync(path.join(root, 'monster-hero/src/parts/20-market-notices-help.jsx'), 'utf8').match(/const MARKET_PROFILE_ICON_STYLES = \{[\s\S]*?\n\};/)[0];
const hasStyle = (id) => new RegExp(`(^|[\\s,{])${id}\\s*:`).test(styles);

const bad = [];
let count = 0;
for (const id of Object.keys(M)) {
  const mon = M[id];
  const got = face(id);
  count += 1;
  if (!got || !got.src) { bad.push(`${id}: 絵が決まらない`); continue; }
  if (S.includes(id)) {
    if (got.id !== id || got.src !== (mon.faceIconUrl || mon.iconUrl)) bad.push(`${id}: 初期モンスターなのにモンスターid・顔アイコンではない`);
    continue;
  }
  const item = I.find((x) => x.type === 'icon' && x.id === got.id);
  if (!item) { bad.push(`${id}: マーケットのアイコンの商品に当たらない(${got.id})`); continue; }
  if (item.name !== `${mon.name}のアイコン`) bad.push(`${id}: 別の子の商品に当たっている(${item.name})`);
  if (item.icon !== got.src) bad.push(`${id}: 商品の絵ではない`);
}
check(`全${count}体の顔アイコンが、プロフィールのアイコンと同じ id・絵になる`, bad.length === 0, bad.join(' / '));
const sn = face('Snegurochka');
check('スネグーラチカは、顔アイコンの絵ではなくマーケットの商品(snegurochka_icon)の絵と調整を使う', sn && sn.id === 'snegurochka_icon' && /SNEGUROCHKA\.PNG/.test(sn.src) && hasStyle('snegurochka_icon'), JSON.stringify(sn));
check('知らないモンスターは null', face('NoSuchMonster') === null);
console.log(failed ? `\n${failed}件のNGがあります` : '\nすべてOK');
process.exit(failed ? 1 : 0);

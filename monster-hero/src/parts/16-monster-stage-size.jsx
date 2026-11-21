// ---- 並んで立つ場面のモンスターの大きさ(2026-11-21 社長 r1119-074「バトル中の画面でモンスターのサイズ感が合っていない」・開発部) ----
//   渡された絵はサイズ別に描いていない(どの子も絵の枠いっぱい)。そこで、1体ずつの「見た目の大きさ」を絵の姿から決めた表をここに置く。
//   使うのは「2体以上が同じ場に並ぶ場面」だけ(いまは試合の場 MsaStage)。立ち絵・アイコン・図鑑・試合の始まりの対面(.msa-intro)・技の窓(.msa-cut)は使わない。
//   あとで助手ライフの家など、並んで立つ場面でも同じ表を引けるように、場面に依らない形(monsterStageSizeOf・monsterStageFit)にしている。
//   計算(SPECIES_TRAITS の z・避ける・受けるダメージ)とは関係しない。見た目だけ。
//
//   値の決め方: ふつう(人の背丈くらいの子)= 1。小さな生き物(モッチー・ゴーストなど)は 0.7〜0.85、大きな巨体(ゴーレム・モノリス)は 1.4 前後。
//   絵の余白の差は、絵の中身の範囲の表 ART_CONTENT_BOXES(tools/image/make-art-content-boxes.js が測る)で消す。表に無い子は 1(ふつう)。
const MONSTER_STAGE_SIZE = Object.freeze({
  // 小さな生き物
  Mocchi: 0.72, Suezo: 0.72, Ghost: 0.75, Plant: 0.8, Ham: 0.82, KenshiMocchi: 0.82, Spooky: 0.82, Ark: 0.85,
  // ふつうより少し小さい・ふつう(人の背丈くらい)
  Tiger: 0.9, Mitarashi: 0.9, Pixie: 0.92, Mia: 0.95, Pandora: 0.95, Snegurochka: 0.98, Dreamy: 0.98,
  Oboro: 1, Undine: 1, Yaobikuni: 1, Illumine: 1, Kyubi: 1, Orihime: 1,
  // 大きめ
  Iblis: 1.05, MelWhip: 1.05, Yggdrasil: 1.1, Eiki: 1.15, Zan: 1.25, Melody: 1.3, Kuromy: 1.3,
  // 巨体
  Monol: 1.4, Golem: 1.45,
});
// 大きさ1の子の中身の高さ = 絵の枠の高さ × これ(大きい子が枠の上へ少し出る余地を残す)。中身の幅は枠の幅 × MONSTER_STAGE_MAX_W まで
const MONSTER_STAGE_REF = 0.8;
const MONSTER_STAGE_MAX_W = 1.5;
const monsterStageSizeOf = (id) => {
  const v = id && Object.prototype.hasOwnProperty.call(MONSTER_STAGE_SIZE, id) ? Number(MONSTER_STAGE_SIZE[id]) : 1;
  return Number.isFinite(v) && v > 0 ? v : 1;
};
// 枠(boxW × boxH px)の中で、その子の絵を描く大きさ。{ w, h … 絵の要素の幅・高さ / mb … 足元の余白を詰める下のずらし / dx … 中身のまんなかを枠のまんなかへ寄せる横のずらし }。
//   絵の中身の範囲が分からない子は null(今までどおり枠に収める)
const monsterStageFit = (id, boxW, boxH) => {
  const W = Number(boxW), H = Number(boxH);
  if (!(W > 0) || !(H > 0)) return null;
  const mon = typeof ALL_PLAYER_MONSTERS === 'object' && ALL_PLAYER_MONSTERS ? ALL_PLAYER_MONSTERS[id] : null;
  const boxes = typeof ART_CONTENT_BOXES === 'object' && ART_CONTENT_BOXES ? ART_CONTENT_BOXES : null;
  const key = mon && typeof mon.imgUrl === 'string' ? mon.imgUrl.split('?')[0].replace(/^images\//, '') : '';
  const b = boxes && key ? boxes[key] : null;
  if (!Array.isArray(b) || b.length < 5) return null;
  const [x0, y0, x1, y1, a] = b.map(Number);
  const ch = y1 - y0, cw = x1 - x0;
  if (!(ch > 0) || !(cw > 0) || !(a > 0)) return null;
  let h = (H * MONSTER_STAGE_REF * monsterStageSizeOf(id)) / ch;
  let w = h * a;
  const wMax = W * MONSTER_STAGE_MAX_W;
  if (cw * w > wMax) { const k = wMax / (cw * w); h *= k; w *= k; }
  return { w: Math.round(w), h: Math.round(h), mb: -Math.round((1 - y1) * h), dx: -Math.round(((x0 + x1) / 2 - 0.5) * w) };
};

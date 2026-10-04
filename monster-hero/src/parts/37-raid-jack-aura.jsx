// ===== ジャックのオーラ(段階1〜5でどんどん派手に・バトル/HOME/段階えらびで共通) =====
// モンヒロビートのフリックで吹き上がる「炎の舌」を参考に、根元から立ちのぼって細くなりながら消える炎を
// 本体のまわりに何本も出す。動かすのは transform と opacity だけ(CSS は 70-bootstrap.jsx の data-jack-aura)。
// 使い方: 親に data-jack-aura={段階の数字} を付け、中に <JackAuraLayer tier={段階の数字} /> を置く。
//   段階えらびの小さな絵では limit で炎の本数を減らす(画面に5つ並ぶので軽くする)。
const RAID_JACK_AURA_TONGUES = Object.freeze([7, 10, 14, 18, 24]);
// 1本ずつの位置・太さ・高さ・遅れ・周期・傾きは添字から決める(描き直しても同じ形。乱数は使わない)。
// 本体の左・右・まんなかへ順に散らす(まんなかは絵の後ろに隠れつつ、輪郭のすきまからゆらめく)
const raidJackAuraTongues = (count) => Array.from({ length: count }, (_, i) => {
  const r = (n) => { const v = Math.sin((i + 1) * 12.9898 + n * 78.233) * 43758.5453; return v - Math.floor(v); };
  const side = i % 3;
  return {
    x: side === 0 ? 4 + r(1) * 26 : side === 1 ? 70 + r(1) * 26 : 34 + r(1) * 32,
    w: 10 + r(2) * 9, h: 50 + r(3) * 40,
    d: -r(4) * 1.6, t: 0.9 + r(5) * 0.7, s: (r(6) - 0.5) * 36, b: r(7) * 22, c: i % 5,
  };
});
const RAID_JACK_AURA_TONGUE_SETS = Object.freeze(RAID_JACK_AURA_TONGUES.map(raidJackAuraTongues));
// 絵そのものの光(drop-shadow)の色。段階が上がるほど濃く・大きく・色が増える。scale は絵の大きさに合わせた倍率
const RAID_JACK_AURA_GLOWS = Object.freeze([
  [[0, 'rgba(251,146,60,.9)', 10]],
  [[0, 'rgba(251,191,36,.95)', 14], [0, 'rgba(249,115,22,.7)', 26]],
  [[0, 'rgba(192,132,252,.95)', 16], [0, 'rgba(251,146,60,.8)', 30]],
  [[0, 'rgba(248,113,113,1)', 18], [0, 'rgba(251,191,36,.9)', 34], [0, 'rgba(239,68,68,.7)', 50]],
  [[0, 'rgba(250,204,21,1)', 18], [0, 'rgba(244,114,182,.95)', 36], [0, 'rgba(56,189,248,.85)', 54]],
]);
const raidJackAuraGlowFilter = (tier, scale = 1) => {
  const n = Math.min(Math.max(Math.floor(Number(tier) || 0), 0), 5);
  if (n < 1) return '';
  return RAID_JACK_AURA_GLOWS[n - 1].map(([, color, blur]) => `drop-shadow(0 0 ${Math.round(blur * scale)}px ${color})`).join(' ');
};
const JackAuraLayer = ({ tier, limit = 99 }) => {
  const n = Math.min(Math.max(Math.floor(Number(tier) || 0), 0), 5);
  if (n < 1) return null;
  return (
    <span aria-hidden="true" data-jack-aura-el>
      <i data-ja="base" /><i data-ja="ring" /><i data-ja="ring2" />
      {RAID_JACK_AURA_TONGUE_SETS[n - 1].slice(0, Math.max(0, limit)).map((t, k) => (
        <ins key={k} data-ja="tongue" data-ja-c={t.c}
          style={{ '--x': `${t.x.toFixed(1)}%`, '--w': `${t.w.toFixed(1)}%`, '--h': `${t.h.toFixed(1)}%`, '--b': `${t.b.toFixed(1)}%`,
            '--d': `${t.d.toFixed(2)}s`, '--t': `${t.t.toFixed(2)}s`, '--s': `${t.s.toFixed(1)}deg` }} />
      ))}
    </span>
  );
};

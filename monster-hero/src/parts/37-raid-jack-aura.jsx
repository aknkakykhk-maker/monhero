// ===== ジャックのオーラ(段階1〜5でどんどん派手に・バトルとHOMEで共通) =====
// モンヒロビートのフリックで吹き上がる「炎の舌」を参考に、根元から立ちのぼって細くなりながら消える炎を
// 本体のまわりに何本も出す。動かすのは transform と opacity だけ(CSS は 70-bootstrap.jsx の data-jack-aura)。
// 使い方: 親に data-jack-aura={段階の数字} を付け、中に <JackAuraLayer tier={段階の数字} /> を置く。
const RAID_JACK_AURA_TONGUES = Object.freeze([5, 8, 11, 15, 20]);
// 1本ずつの位置・太さ・高さ・遅れ・周期・傾きは添字から決める(描き直しても同じ形。乱数は使わない)
const raidJackAuraTongues = (count) => Array.from({ length: count }, (_, i) => {
  const r = (n) => { const v = Math.sin((i + 1) * 12.9898 + n * 78.233) * 43758.5453; return v - Math.floor(v); };
  return {
    x: i % 2 ? 3 + r(1) * 28 : 69 + r(1) * 28, w: 6 + r(2) * 6, h: 30 + r(3) * 26,
    d: -r(4) * 1.6, t: 0.9 + r(5) * 0.7, s: (r(6) - 0.5) * 36, b: 16 + r(7) * 28, c: i % 5,
  };
});
const RAID_JACK_AURA_TONGUE_SETS = Object.freeze(RAID_JACK_AURA_TONGUES.map(raidJackAuraTongues));
const JackAuraLayer = ({ tier }) => {
  const n = Math.min(Math.max(Math.floor(Number(tier) || 0), 0), 5);
  if (n < 1) return null;
  return (
    <span aria-hidden="true" data-jack-aura-el>
      <i data-ja="base" /><i data-ja="ring" />
      {RAID_JACK_AURA_TONGUE_SETS[n - 1].map((t, k) => (
        <ins key={k} data-ja="tongue" data-ja-c={t.c}
          style={{ '--x': `${t.x.toFixed(1)}%`, '--w': `${t.w.toFixed(1)}%`, '--h': `${t.h.toFixed(1)}%`, '--b': `${t.b.toFixed(1)}%`,
            '--d': `${t.d.toFixed(2)}s`, '--t': `${t.t.toFixed(2)}s`, '--s': `${t.s.toFixed(1)}deg` }} />
      ))}
    </span>
  );
};

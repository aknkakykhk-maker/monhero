// ===== ジャックのオーラ(段階1〜5でどんどん派手に・バトル/HOME/段階えらびで共通) =====
// モンヒロビートのフリックで吹き上がる「炎の舌」を参考に、根元から立ちのぼって細くなりながら消える炎を
// 本体のまわりに何本も出す。動かすのは transform と opacity だけ(CSS は 70-bootstrap.jsx の data-jack-aura)。
// 使い方: 親に data-jack-aura={段階の数字} を付け、中に <JackAuraLayer tier={段階の数字} /> を置く。
//   段階えらびの小さな絵では limit で炎の本数を減らす(画面に5つ並ぶので軽くする)。
// 炎の本数は段階で大きく開く(6→34本)。1本ずつの高さも段階で伸びる(CSS の --hs)。
// 段階3からは火の粉(ember)と広がる輪(wave)が加わり、段階が上がるほど数と速さが増える(2026-10-04 ユーザー指摘「難易度別のエフェクトの違いが弱い」)
const RAID_JACK_AURA_TONGUES = Object.freeze([6, 10, 16, 24, 34]);
const RAID_JACK_AURA_EMBERS = Object.freeze([0, 0, 6, 12, 20]);
const RAID_JACK_AURA_WAVES = Object.freeze([0, 0, 1, 2, 3]);
const raidJackAuraEmbers = (count) => Array.from({ length: count }, (_, i) => {
  const r = (n) => { const v = Math.sin((i + 1) * 39.3467 + n * 11.135) * 24634.6345; return v - Math.floor(v); };
  return { x: 6 + r(1) * 88, w: 3 + r(2) * 4, d: -r(3) * 2.4, t: 1.4 + r(4) * 1.4, dx: (r(5) - 0.5) * 30, c: i % 5 };
});
const RAID_JACK_AURA_EMBER_SETS = Object.freeze(RAID_JACK_AURA_EMBERS.map(raidJackAuraEmbers));
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
  [[0, 'rgba(251,146,60,.7)', 8]],
  [[0, 'rgba(251,191,36,.95)', 14], [0, 'rgba(249,115,22,.7)', 28]],
  [[0, 'rgba(192,132,252,1)', 18], [0, 'rgba(251,146,60,.85)', 36], [0, 'rgba(126,34,206,.6)', 56]],
  [[0, 'rgba(248,113,113,1)', 22], [0, 'rgba(251,191,36,.95)', 44], [0, 'rgba(239,68,68,.8)', 68]],
  [[0, 'rgba(250,204,21,1)', 24], [0, 'rgba(244,114,182,1)', 48], [0, 'rgba(56,189,248,.9)', 76], [0, 'rgba(167,139,250,.7)', 100]],
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
      {limit > 12 && Array.from({ length: RAID_JACK_AURA_WAVES[n - 1] }, (_, k) => <i key={`w${k}`} data-ja="wave" style={{ '--d': `${(-k * (2.4 / RAID_JACK_AURA_WAVES[n - 1])).toFixed(2)}s` }} />)}
      {RAID_JACK_AURA_TONGUE_SETS[n - 1].slice(0, Math.max(0, limit)).map((t, k) => (
        <ins key={k} data-ja="tongue" data-ja-c={t.c}
          style={{ '--x': `${t.x.toFixed(1)}%`, '--w': `${t.w.toFixed(1)}%`, '--h': `${t.h.toFixed(1)}%`, '--b': `${t.b.toFixed(1)}%`,
            '--d': `${t.d.toFixed(2)}s`, '--t': `${t.t.toFixed(2)}s`, '--s': `${t.s.toFixed(1)}deg` }} />
      ))}
      {limit > 12 && RAID_JACK_AURA_EMBER_SETS[n - 1].map((e, k) => (
        <b key={`e${k}`} data-ja="ember" data-ja-c={e.c}
          style={{ '--x': `${e.x.toFixed(1)}%`, '--w': `${e.w.toFixed(1)}%`, '--d': `${e.d.toFixed(2)}s`, '--t': `${e.t.toFixed(2)}s`, '--dx': `${e.dx.toFixed(1)}%` }} />
      ))}
    </span>
  );
};

// ===== レイドボス戦の「入り」と「終わり」のアクセント(2026-10-04・ユーザー指示「ぬるっと流れるだけだからアクセントいれて」) =====
// 入り: 通常の WaveIntro(1.5秒の文字だけ)の代わりに、閃光・黒い帯・斜めの光・大きな文字の叩きつけ・段階の星を約2.6秒で出す。色は段階のオーラと同じ。
//   WaveIntro と同じく data-wave-intro を持ち、「レイドバトル」「VS ジャック◯◯」の文字も同じ。操作は止めない(pointer-events: none)。
// 終わり: 結果の幕が開いた瞬間に、大きな文字(VICTORY! / TIME UP / DEFEAT / RETIRE)を叩きつけて、そのあと結果を順に出す。
//   動かすのは transform と opacity だけ。CSS は 70-bootstrap.jsx の mh-rjintro / mh-rjstinger。
const RaidJackIntro = ({ enabled, enemyName, title = 'レイドバトル', tier = 1, friendly = false }) => {
  const [shown, setShown] = React.useState(null);
  const lastRef = React.useRef(null);
  React.useEffect(() => {
    if (!enabled) { lastRef.current = null; setShown(null); return undefined; }
    const key = `${enemyName || ''}:${title}:${tier}`;
    if (lastRef.current === key) return undefined;
    lastRef.current = key;
    setShown({ key: Date.now() });
    try { if (typeof Audio_ !== 'undefined' && Audio_.se && Audio_.se.special) Audio_.se.special(); } catch (e) { /* 音が出なくても演出は出す */ }
    const timer = setTimeout(() => setShown(null), 2600);
    return () => clearTimeout(timer);
  }, [enabled, enemyName, title, tier]);
  if (!shown) return null;
  const n = Math.min(Math.max(Math.floor(Number(tier) || 1), 1), 5);
  return (
    <div key={shown.key} data-wave-intro="1" data-raid-jack-intro data-jack-aura={n} aria-hidden="true" className="mh-rjintro">
      <i className="mh-rjintro-flash" />
      <i className="mh-rjintro-bar mh-rjintro-bar-top" /><i className="mh-rjintro-bar mh-rjintro-bar-bottom" />
      <i className="mh-rjintro-slash mh-rjintro-slash-a" /><i className="mh-rjintro-slash mh-rjintro-slash-b" />
      <div className="mh-rjintro-body">
        <span className="mh-rjintro-sub">{friendly ? '♪ PLAY TIME ♪' : '⚠ BOSS APPEARS ⚠'}</span>
        <b className="mh-rjintro-title">{title}</b>
        {enemyName && <span className="mh-rjintro-name">VS {enemyName}</span>}
        {!friendly && <span className="mh-rjintro-stars">{'★'.repeat(n)}<span className="mh-rjintro-stars-dim">{'★'.repeat(5 - n)}</span></span>}
      </div>
    </div>
  );
};
const RAID_JACK_STINGERS = Object.freeze({
  defeated: { text: 'VICTORY!', tone: 'win' },
  turns: { text: 'TIME UP', tone: 'end' },
  wipe: { text: 'DEFEAT', tone: 'lose' },
  giveup: { text: 'RETIRE', tone: 'end' },
});
const RaidJackResultStinger = ({ reason }) => {
  const def = RAID_JACK_STINGERS[reason] || RAID_JACK_STINGERS.turns;
  React.useEffect(() => {
    if (reason !== 'defeated') return;
    try { if (typeof Audio_ !== 'undefined' && Audio_.se && Audio_.se.victory) Audio_.se.victory(); } catch (e) { /* 音が出なくても演出は出す */ }
  }, [reason]);
  return (
    <div data-raid-jack-stinger={def.tone} aria-hidden="true" className={`mh-rjstinger mh-rjstinger-${def.tone}`}>
      <i className="mh-rjstinger-flash" />
      <i className="mh-rjstinger-ring" />
      {def.tone === 'win' && <EndConfetti count={30} />}
      <b className="mh-rjstinger-text">{def.text}</b>
    </div>
  );
};

// ==================== プレイヤーのランクの見せ方(ビートランク・カードランク共通) ====================
// 2026-10-29 社長: ビートランクとカードランクは対の名前。札・棒・ランクアップの演出・ランキングの行の見せ方をそろえる
// (マルチ部ツナグくんと決めた。カードの画面はこれを使う形に差し替える)。計算は 18-player-rank.jsx の playerRankInfo。
// ★マスモンの「ビートLv」と取り違えないよう、「Lv」の字は使わず「ランク」と数字で書く。色もマスモン(緑)と分ける
const PLAYER_RANK_KINDS = Object.freeze({
  beat: { label: 'ビートランク', icon: '🎵', pill: 'bg-cyan-700 text-cyan-50', accent: 'text-cyan-200', bar: 'from-cyan-400 to-fuchsia-300', border: 'border-cyan-300/50', panel: 'bg-slate-900/85' },
  card: { label: 'カードランク', icon: '🃏', pill: 'bg-amber-700 text-amber-50', accent: 'text-amber-200', bar: 'from-emerald-400 to-amber-300', border: 'border-amber-300/50', panel: 'bg-slate-900/85' },
});
const playerRankKind = (kind) => PLAYER_RANK_KINDS[kind] || PLAYER_RANK_KINDS.beat;

// ランクの帯(2026-10-29 社長「なんかださくない？」→ ブリーダーレベルの札を手本に、ゲームらしいバッジへ。マルチ部ツナグくんの見本どおり)。
// 1〜9 ブロンズ・10〜19 シルバー・20〜29 ゴールド・30〜49 アメジスト・50〜 レインボー
const playerRankTier = (rank) => {
  const r = Math.max(1, Math.floor(Number(rank) || 1));
  if (r >= 50) return { t: 5, name: 'レインボー' };
  if (r >= 30) return { t: 4, name: 'アメジスト' };
  if (r >= 20) return { t: 3, name: 'ゴールド' };
  if (r >= 10) return { t: 2, name: 'シルバー' };
  return { t: 1, name: 'ブロンズ' };
};
// 六角の盾(外側=縁の色・内側=面の色)・上半分の光沢・白い大きな数字と濃い縁取り・帯の色の光。
// ::before/::after と変数を使うので Tailwind ではなく CSS のまま持ち、最初に描いたときに1回だけ <head> へ入れる
const PLAYER_RANK_BADGE_CSS = `
.mh-prb{display:inline-flex;align-items:center;gap:6px}
.mh-prb-shield{position:relative;width:52px;height:58px;flex:none;filter:drop-shadow(0 3px 0 rgba(0,0,0,.45)) drop-shadow(0 0 10px var(--prb-glow))}
.mh-prb-shield::before{content:"";position:absolute;inset:0;clip-path:polygon(50% 0,100% 18%,100% 70%,50% 100%,0 70%,0 18%);background:var(--prb-rim)}
.mh-prb-shield::after{content:"";position:absolute;inset:3px;clip-path:polygon(50% 0,100% 18%,100% 70%,50% 100%,0 70%,0 18%);background:var(--prb-face)}
.mh-prb-gloss{position:absolute;inset:3px 3px 50% 3px;z-index:2;clip-path:polygon(50% 0,100% 18%,100% 100%,0 100%,0 18%);background:linear-gradient(180deg,rgba(255,255,255,.55),rgba(255,255,255,.05))}
.mh-prb-num{position:absolute;inset:-2.7% 0 2.7% 0;z-index:3;display:flex;align-items:center;justify-content:center;font-weight:900;font-size:26px;color:#fff;-webkit-text-stroke:5px var(--prb-ink);paint-order:stroke fill;letter-spacing:-.04em;line-height:1}
.mh-prb-num.mh-prb-w3{font-size:20px}
/* 2026-10-30 社長「数字の位置がセンターずれ」: 字の上下の余白(字体ごとに違う)を切り落として数字そのものを真ん中に置き、
   盾は下が長く尖っていて見た目の重心が箱の真ん中より上(約47%)なので、数字の箱(.mh-prb-num)を盾の高さの2.7%だけ上へずらす。
   字間を詰めた分(最後の字のうしろも詰まる)は右に足して打ち消す */
.mh-prb-digits{display:inline-block;text-box:trim-both cap alphabetic;padding-right:.04em}
.mh-prb-tag{display:flex;flex-direction:column;line-height:1.05}
.mh-prb-kind{white-space:nowrap;font-size:10px;font-weight:900;color:var(--prb-label);letter-spacing:.08em}
.mh-prb-name{white-space:nowrap;font-size:14px;font-weight:900;color:#fff;-webkit-text-stroke:3px var(--prb-ink);paint-order:stroke fill}
.mh-prb.mh-prb-s .mh-prb-shield{width:32px;height:36px}.mh-prb.mh-prb-s .mh-prb-shield::after{inset:2px}
.mh-prb.mh-prb-s .mh-prb-num{font-size:16px;-webkit-text-stroke:3.5px var(--prb-ink)}.mh-prb.mh-prb-s .mh-prb-num.mh-prb-w3{font-size:12px}
.mh-prb.mh-prb-s .mh-prb-name{font-size:12px}.mh-prb.mh-prb-s .mh-prb-kind{display:none}
.mh-prb-t1{--prb-rim:linear-gradient(160deg,#fde2c4,#9a4b1c 55%,#5a250b);--prb-face:linear-gradient(160deg,#e08a4a,#8a3f12);--prb-ink:#3b1406;--prb-glow:rgba(234,138,74,.55);--prb-label:#fbbf8a}
.mh-prb-t2{--prb-rim:linear-gradient(160deg,#ffffff,#94a3b8 55%,#475569);--prb-face:linear-gradient(160deg,#cbd5e1,#64748b);--prb-ink:#1e293b;--prb-glow:rgba(203,213,225,.6);--prb-label:#e2e8f0}
.mh-prb-t3{--prb-rim:linear-gradient(160deg,#fff7c2,#f59e0b 55%,#92400e);--prb-face:linear-gradient(160deg,#fcd34d,#d97706);--prb-ink:#5b2a03;--prb-glow:rgba(251,191,36,.7);--prb-label:#fde68a}
.mh-prb-t4{--prb-rim:linear-gradient(160deg,#f5d0fe,#a21caf 55%,#4a044e);--prb-face:linear-gradient(160deg,#c084fc,#6d28d9);--prb-ink:#2e1065;--prb-glow:rgba(192,132,252,.75);--prb-label:#f0abfc}
.mh-prb-t5{--prb-rim:conic-gradient(from 0deg,#f43f5e,#f59e0b,#84cc16,#06b6d4,#8b5cf6,#f43f5e);--prb-face:linear-gradient(160deg,#1e1b4b,#0f172a);--prb-ink:#000;--prb-glow:rgba(255,255,255,.8);--prb-label:#fff}
`;
const ensurePlayerRankBadgeCss = () => {
  try {
    if (typeof document === 'undefined' || document.getElementById('mh-player-rank-badge-css')) return;
    const el = document.createElement('style');
    el.id = 'mh-player-rank-badge-css';
    el.textContent = PLAYER_RANK_BADGE_CSS;
    document.head.appendChild(el);
  } catch (_) { /* 入れられなくても数字は読める */ }
};

// ランクの札(バッジ)。size: 'lg'(大きい盾+帯の名前+種類の名前)/ 'sm'(小さい盾+種類の名前)。showName=false で盾だけ(ランキングの行)
function PlayerRankBadge({ kind = 'beat', rank = 1, size = 'lg', showName = true }) {
  ensurePlayerRankBadgeCss();
  const k = playerRankKind(kind);
  const r = Math.max(1, Math.floor(Number(rank) || 1));
  const tier = playerRankTier(r);
  const text = r.toLocaleString();
  return (
    <span data-player-rank-badge={kind} data-player-rank-tier={tier.t} aria-label={`${k.label} ${r}`}
      className={`mh-prb mh-prb-t${tier.t}${size === 'sm' ? ' mh-prb-s' : ''}`}>
      <span className="mh-prb-shield" aria-hidden="true"><span className="mh-prb-gloss"/><b data-player-rank-value className={`mh-prb-num${text.length >= 3 ? ' mh-prb-w3' : ''}`}><span className="mh-prb-digits">{text}</span></b></span>
      {showName && <span className="mh-prb-tag" aria-hidden="true"><span className="mh-prb-kind">{tier.name}</span><span className="mh-prb-name">{k.label}</span></span>}
    </span>
  );
}

// 次のランクまでの棒。info は playerRankInfo の { rank, into, need }
function PlayerRankGauge({ kind = 'beat', info, note = '' }) {
  const k = playerRankKind(kind);
  const into = Math.max(0, Number(info && info.into) || 0), need = Math.max(1, Number(info && info.need) || 1);
  return (
    <div data-player-rank-gauge={kind}>
      <div className="h-2 overflow-hidden rounded-full bg-slate-700" role="progressbar" aria-label="次のランクまで" aria-valuemin={0} aria-valuemax={need} aria-valuenow={into}>
        <i className={`block h-full rounded-full bg-gradient-to-r ${k.bar}`} style={{ width: `${Math.min(100, Math.round((into / need) * 100))}%` }}/>
      </div>
      <div className="mt-0.5 flex justify-between gap-2 text-[10px] font-bold text-slate-300">
        <span className="tabular-nums">{`${into.toLocaleString()} / ${need.toLocaleString()}`}</span>
        <span className="min-w-0 text-right" style={JA_WRAP_STYLE}>{jaWrap(note || `次まで ${(need - into).toLocaleString()}`)}</span>
      </div>
    </div>
  );
}

// 画面の上に置くまとめ(モードえらびなど): 札と棒と、ひとこと
function PlayerRankPanel({ kind = 'beat', xp = 0, note = '', sub = '' }) {
  const k = playerRankKind(kind);
  const info = playerRankInfo(xp);
  return (
    <section data-player-rank-panel={kind} className={`rounded-2xl border px-3 py-2 ${k.border} ${k.panel}`}>
      <div className="flex items-center gap-2">
        <PlayerRankBadge kind={kind} rank={info.rank} size="lg"/>
        <small className="ml-auto shrink-0 text-[11px] font-black text-slate-200 tabular-nums">{`次まで ${(info.need - info.into).toLocaleString()}`}</small>
      </div>
      <div className="mt-1.5"><PlayerRankGauge kind={kind} info={info} note={note || ' '}/></div>
      {sub && <p className="mt-1 text-[10px] font-bold leading-snug text-slate-300" style={JA_WRAP_STYLE}>{jaWrap(sub)}</p>}
    </section>
  );
}

// 上の帯に入れる細い1行(2026-10-29 社長「立ち絵が小さくなるのはだめ」→ 上の帯に横長で薄く)。小さいバッジ・細い棒・次まで。
// 次のごほうびは帯には入れない(社長「トップに要らなければ詳しい所だけ」。ヘルプと曲の結果で見せる)
function PlayerRankStrip({ kind = 'beat', xp = 0 }) {
  const k = playerRankKind(kind);
  const info = playerRankInfo(xp);
  return (
    <div data-player-rank-strip={kind} className="flex min-w-0 items-center gap-1.5">
      <PlayerRankBadge kind={kind} rank={info.rank} size="sm"/>
      <div className="h-1.5 min-w-[40px] flex-1 overflow-hidden rounded-full bg-slate-700/80" role="progressbar" aria-label="次のランクまで" aria-valuemin={0} aria-valuemax={info.need} aria-valuenow={info.into}>
        <i className={`block h-full rounded-full bg-gradient-to-r ${k.bar}`} style={{ width: `${Math.min(100, Math.round((info.into / info.need) * 100))}%` }}/>
      </div>
      <small className="shrink-0 whitespace-nowrap text-[9px] font-black text-slate-300 tabular-nums">{`次まで ${(info.need - info.into).toLocaleString()}`}</small>
    </div>
  );
}

// ランクが上がったときの演出。gains は [{ icon, text }](もらった物。カードは引く券・枠が増える知らせなど)
function PlayerRankUp({ kind = 'beat', from = 1, to = 1, gains = [] }) {
  if (!(to > from)) return null;
  return (
    <div data-player-rank-up={kind} className="rounded-2xl border-2 border-fuchsia-300 bg-gradient-to-b from-violet-700/80 to-indigo-950/90 px-3 py-2 text-center">
      <small className="block text-[10px] font-black tracking-[.2em] text-fuchsia-100">RANK UP!</small>
      <div className="mt-0.5 flex items-center justify-center gap-2">
        <PlayerRankBadge kind={kind} rank={from} size="sm" showName={false}/>
        <span aria-hidden="true" className="font-black text-fuchsia-200">→</span>
        <PlayerRankBadge kind={kind} rank={to} size="lg"/>
      </div>
      {gains.length > 0 && <ul data-player-rank-up-gains className="mt-1.5 flex flex-wrap justify-center gap-1.5">
        {gains.map((g, i) => <li key={i} className="rounded-lg border border-fuchsia-200/40 bg-slate-950/70 px-2 py-0.5 text-[11px] font-black text-amber-100">
          {g.icon && <span aria-hidden="true">{cardIconNode(g.icon, 14)} </span>}<span style={JA_WRAP_STYLE}>{jaWrap(String(g.text || ''))}</span>
        </li>)}
      </ul>}
    </div>
  );
}

// ==== 経験値の棒が「前の量」から伸びる演出(2026-10-30 社長「1戦後の経験値のゲージ変動のような演出」→「もっと派手に」×2 →「これで入れて」)。
// 見本: claude.ai/artifact/MXTLj3u53RsFErJp6qd5rV。ビートの曲の結果とカードの対戦の結果の札(PlayerRankGain)で使う。
//   内わけの札が1つずつ出て、その分の「+18」が棒へ飛び込み、棒が段々に伸びる(数字も弾んで数え上がる)。
//   満タンで棒と札全体が光り、光の輪・粒・星・虹色の「RANK UP!」→ 新しいランクの数字が弾んで、次のランクの棒へ。
//   ブリーダーレベルの結果の棒(LevelGrowthBar: 満タンで LEVEL UP の点滅 → 次の棒)と同じ流れ。長くても約2秒。押すと最後まで飛ばす。
//   保存データは触らない(表示だけ)。効果音は「画面の前の効果音」(fgSe)で、効果音の音量設定に従う
const PLAYER_RANK_XP_BAR_CSS = `
.mh-prxb{--prxb-a:#22d3ee;--prxb-b:#f0abfc;--prxb-glow:rgba(103,232,249,.9);position:relative;cursor:pointer;user-select:none}
.mh-prxb.gold{--prxb-a:#f59e0b;--prxb-b:#fde68a;--prxb-glow:rgba(253,224,71,.95)}
.mh-prxb-fx{position:absolute;inset:0;pointer-events:none;overflow:visible;z-index:6}
.mh-prxb::after{content:"";position:absolute;inset:-6px;border-radius:16px;background:#fff;opacity:0;pointer-events:none;z-index:7}
.mh-prxb.flash::after{animation:mhPrxbCardFlash .45s ease-out}
.mh-prxb-add{display:inline-block;font-size:22px;font-weight:900;line-height:1.1;color:#fff;-webkit-text-stroke:4px rgba(30,10,60,.9);paint-order:stroke fill;font-variant-numeric:tabular-nums;text-shadow:0 0 12px var(--prxb-glow)}
.mh-prxb-add.bump{animation:mhPrxbBump .22s cubic-bezier(.2,1.8,.4,1),mhPrxbTint .22s ease-out}
.mh-prxb-add.final{animation:mhPrxbFinal .6s cubic-bezier(.2,1.8,.4,1)}
.mh-prxb-chip{display:inline-block;font-size:10px;font-weight:800;padding:2px 8px;border-radius:999px;background:rgba(255,255,255,.1);color:#e2e8f0;opacity:0;transform:translateY(6px) scale(.8);transition:opacity .18s,transform .25s cubic-bezier(.2,1.6,.4,1)}
.mh-prxb-chip.on{opacity:1;transform:none}
.mh-prxb-chip b{color:#fde68a}
.mh-prxb-track{position:relative}
.mh-prxb-track.shake{animation:mhPrxbShake .28s ease-in-out}
.mh-prxb-bar{position:relative;height:16px;border-radius:999px;background:#1f2937;overflow:hidden;border:2px solid rgba(255,255,255,.18);box-shadow:inset 0 2px 4px rgba(0,0,0,.6)}
.mh-prxb-bar.full{animation:mhPrxbFull .55s ease-out}
.mh-prxb-bar.switch{animation:mhPrxbSwitch .35s ease-out}
.mh-prxb-fill{position:absolute;inset:0 auto 0 0;border-radius:999px;background:linear-gradient(90deg,var(--prxb-a),var(--prxb-b));box-shadow:0 0 12px var(--prxb-glow);transition:width .34s cubic-bezier(.3,.8,.4,1)}
.mh-prxb-fill::after{content:"";position:absolute;inset:0;background:linear-gradient(100deg,transparent 30%,rgba(255,255,255,.75) 45%,transparent 60%);background-size:220% 100%;animation:mhPrxbSheen 1.1s linear infinite}
.mh-prxb-fill::before{content:"";position:absolute;inset:0 0 50% 0;background:linear-gradient(180deg,rgba(255,255,255,.45),transparent);border-radius:999px}
.mh-prxb.instant .mh-prxb-fill,.mh-prxb.instant .mh-prxb-tip{transition:none}
.mh-prxb-tip{position:absolute;top:50%;width:22px;height:22px;margin:-11px 0 0 -11px;border-radius:50%;background:radial-gradient(circle,#fff 0 25%,var(--prxb-glow) 40%,transparent 70%);opacity:0;pointer-events:none;z-index:3;transition:left .34s cubic-bezier(.3,.8,.4,1)}
.mh-prxb-tip.on{opacity:1;animation:mhPrxbTwinkle .25s ease-in-out infinite alternate}
.mh-prxb-up{position:absolute;right:0;top:-18px;font-size:24px;font-weight:900;line-height:1;background:linear-gradient(90deg,#f43f5e,#f59e0b,#fde047,#84cc16,#06b6d4,#8b5cf6,#f43f5e);background-size:200% 100%;-webkit-background-clip:text;background-clip:text;color:transparent;-webkit-text-stroke:2px rgba(124,45,18,.9);text-shadow:none;filter:drop-shadow(0 0 8px rgba(253,224,71,.9));pointer-events:none;z-index:8;animation:mhPrxbUpPop .5s cubic-bezier(.2,1.8,.4,1) both,mhPrxbUpPulse 1s ease-in-out .5s infinite,mhPrxbRainbow 1.2s linear infinite}
.mh-prxb-spark,.mh-prxb-mote{position:absolute;border-radius:50%;background:#fff;box-shadow:0 0 6px var(--prxb-glow);pointer-events:none;z-index:4}
.mh-prxb-spark{width:5px;height:5px;animation:mhPrxbSpark .55s ease-out forwards}
.mh-prxb-mote{width:4px;height:4px;animation:mhPrxbMote .9s ease-out forwards}
.mh-prxb-boom{position:absolute;width:30px;height:30px;margin:-15px 0 0 -15px;border-radius:50%;border:3px solid #fff;box-shadow:0 0 14px var(--prxb-glow);pointer-events:none;z-index:5;animation:mhPrxbBoom .4s ease-out forwards}
.mh-prxb-ring{position:absolute;left:50%;top:50%;width:60px;height:60px;margin:-30px 0 0 -30px;border-radius:50%;border:3px solid var(--prxb-glow);pointer-events:none;z-index:4;animation:mhPrxbRing .6s ease-out forwards}
.mh-prxb-burst,.mh-prxb-rad{position:absolute;border-radius:2px;pointer-events:none;z-index:7}
.mh-prxb-burst{width:7px;height:7px;animation:mhPrxbBurst .8s ease-out forwards}
.mh-prxb-rad{width:8px;height:8px;animation:mhPrxbBurst .9s cubic-bezier(.2,.7,.4,1) forwards}
.mh-prxb-star{position:absolute;z-index:8;color:#fff;font-size:18px;line-height:1;text-shadow:0 0 10px var(--prxb-glow),0 0 18px #fff;pointer-events:none;animation:mhPrxbStar .9s ease-out forwards}
.mh-prxb-fly{position:absolute;z-index:8;font-size:18px;font-weight:900;color:#fde68a;-webkit-text-stroke:3px rgba(30,10,60,.9);paint-order:stroke fill;text-shadow:0 0 10px var(--prxb-glow);pointer-events:none;animation:mhPrxbFly .5s cubic-bezier(.3,.7,.4,1) forwards}
.mh-prxb-newrank{position:absolute;left:50%;top:-6px;z-index:8;font-size:30px;font-weight:900;line-height:1;color:#fff;-webkit-text-stroke:5px rgba(30,10,60,.95);paint-order:stroke fill;text-shadow:0 0 18px var(--prxb-glow);pointer-events:none;animation:mhPrxbNewRank .9s cubic-bezier(.2,1.8,.4,1) forwards}
@keyframes mhPrxbCardFlash{0%{opacity:.85}100%{opacity:0}}
@keyframes mhPrxbBump{0%{transform:scale(1)}50%{transform:scale(1.35)}100%{transform:scale(1)}}
@keyframes mhPrxbTint{0%{color:#fff}40%{color:#fde047}100%{color:#fff}}
@keyframes mhPrxbFinal{0%{transform:scale(1)}35%{transform:scale(1.7);color:#fde047;text-shadow:0 0 24px var(--prxb-glow),0 0 40px #fff}100%{transform:scale(1)}}
@keyframes mhPrxbShake{0%,100%{transform:none}20%{transform:translate(-3px,1px)}40%{transform:translate(3px,-1px)}60%{transform:translate(-2px,0)}80%{transform:translate(2px,0)}}
@keyframes mhPrxbFull{0%{box-shadow:0 0 0 rgba(255,255,255,0)}30%{box-shadow:0 0 26px 8px var(--prxb-glow);background:#fff;border-color:#fff}100%{box-shadow:0 0 0 rgba(255,255,255,0)}}
@keyframes mhPrxbSwitch{0%{background:#fff}100%{background:#1f2937}}
@keyframes mhPrxbSheen{from{background-position:120% 0}to{background-position:-120% 0}}
@keyframes mhPrxbTwinkle{from{transform:scale(.8)}to{transform:scale(1.3)}}
@keyframes mhPrxbUpPop{0%{transform:scale(.2) rotate(-12deg);opacity:0}100%{transform:scale(1) rotate(-6deg);opacity:1}}
@keyframes mhPrxbUpPulse{0%,100%{transform:scale(1) rotate(-6deg)}50%{transform:scale(1.12) rotate(-6deg)}}
@keyframes mhPrxbRainbow{from{background-position:0 0}to{background-position:200% 0}}
@keyframes mhPrxbSpark{to{transform:translate(var(--x),var(--y)) scale(.2);opacity:0}}
@keyframes mhPrxbMote{0%{opacity:0;transform:translate(0,0) scale(.5)}20%{opacity:1}100%{opacity:0;transform:translate(var(--x),var(--y)) scale(1.2)}}
@keyframes mhPrxbBoom{from{transform:scale(.3);opacity:1}to{transform:scale(2.4);opacity:0}}
@keyframes mhPrxbRing{from{transform:scale(.3);opacity:1}to{transform:scale(4.5,2.2);opacity:0}}
@keyframes mhPrxbBurst{0%{opacity:1;transform:translate(0,0) rotate(0)}100%{opacity:0;transform:translate(var(--x),var(--y)) rotate(var(--r))}}
@keyframes mhPrxbStar{0%{transform:scale(0) rotate(0);opacity:0}30%{transform:scale(1.4) rotate(90deg);opacity:1}100%{transform:scale(.4) rotate(180deg);opacity:0}}
@keyframes mhPrxbFly{0%{transform:translate(0,0) scale(.6);opacity:0}25%{transform:translate(calc(var(--dx)*.2),-26px) scale(1.25);opacity:1}100%{transform:translate(var(--dx),var(--dy)) scale(.5);opacity:0}}
@keyframes mhPrxbNewRank{0%{transform:translate(-50%,10px) scale(.2);opacity:0}35%{transform:translate(-50%,-14px) scale(1.5);opacity:1}75%{transform:translate(-50%,-10px) scale(1.1);opacity:1}100%{transform:translate(-50%,-22px) scale(1);opacity:0}}
@media (prefers-reduced-motion:reduce){.mh-prxb *{animation-duration:.01s!important;transition:none!important}.mh-prxb.flash::after{animation:none}}
`;
const ensurePlayerRankXpBarCss = () => {
  try {
    if (typeof document === 'undefined' || document.getElementById('mh-player-rank-xp-bar-css')) return;
    const el = document.createElement('style');
    el.id = 'mh-player-rank-xp-bar-css';
    el.textContent = PLAYER_RANK_XP_BAR_CSS;
    document.head.appendChild(el);
  } catch (_) { /* 入れられなくても、棒と数字は読める */ }
};

// 経験値の棒が伸びる演出の本体。award: { add, parts:[{label,xp}], from, to, xp(足したあとの合計) }
// onFull(): 棒が満タンで光ったとき(ランクが上がるときだけ・1回)。画面いっぱいの演出はここから出す / onDone(): 伸び終わったとき(1回)
const PLAYER_RANK_XP_COLORS = ['#fde047', '#f0abfc', '#22d3ee', '#fff', '#a3e635'];
// 2026-10-30 社長「終わったあとに経験値ゲージのバーの動きが見れない」: 棒が画面に入るまでは前の量で止めておき、
// 見えたところで動き出す(onStart)。見えているかを調べられない端末では、すぐ動かす
function PlayerRankXpBar({ kind = 'beat', award, onFull = null, onDone = null, onStart = null }) {
  ensurePlayerRankXpBarCss();
  const k = playerRankKind(kind);
  const add = Math.max(0, Math.floor(Number(award && award.add) || 0));
  const toXp = playerRankSafeXp(award && award.xp);
  const fromXp = Math.max(0, toXp - add);
  const parts = React.useMemo(() => {
    const list = (Array.isArray(award && award.parts) ? award.parts : []).filter((p) => p && Number(p.xp) > 0).map((p) => ({ label: String(p.label || ''), xp: Math.floor(Number(p.xp)) }));
    const sum = list.reduce((a, p) => a + p.xp, 0);
    if (sum < add) list.push({ label: '経験値', xp: add - sum });
    return list;
  }, [add]);
  const startInfo = playerRankInfo(fromXp), endInfo = playerRankInfo(toXp);
  const rankUp = endInfo.rank > startInfo.rank;
  const [view, setView] = React.useState({ rank: startInfo.rank, into: startInfo.into, shown: 0, chips: 0, up: false, instant: true, tip: false, done: false });
  const rootRef = React.useRef(null), trackRef = React.useRef(null), fxRef = React.useRef(null), addRef = React.useRef(null), chipRefs = React.useRef([]);
  const runRef = React.useRef({ timers: [], fullSent: false, doneSent: false, running: true });
  const [seen, setSeen] = React.useState(false);
  React.useEffect(() => {
    if (seen) return undefined;
    const el = rootRef.current;
    if (!el || typeof IntersectionObserver !== 'function') { setSeen(true); return undefined; }
    const io = new IntersectionObserver((entries) => { if (entries.some((e) => e.isIntersecting)) setSeen(true); }, { threshold: 0.6 });
    io.observe(el);
    return () => io.disconnect();
  }, [seen]);
  const se = (name) => { try { const bank = typeof Audio_ !== 'undefined' ? (Audio_.fgSe || Audio_.se) : null; if (bank && typeof bank[name] === 'function') bank[name](); } catch (_) { /* 音が出なくても続ける */ } };
  const later = (fn, ms) => { const id = setTimeout(fn, ms); runRef.current.timers.push(id); return id; };
  const spawn = (host, cls, style, ms) => { if (!host) return; const e = document.createElement('i'); e.className = cls; Object.entries(style).forEach(([kk, v]) => e.style.setProperty(kk, v)); host.appendChild(e); setTimeout(() => e.remove(), ms); return e; };
  const pct = (rank, into) => Math.min(100, (into / playerRankNeed(rank)) * 100);
  const tipX = () => { const tr = trackRef.current; if (!tr) return 0; const fill = tr.querySelector('.mh-prxb-fill'); return fill ? fill.getBoundingClientRect().right - tr.getBoundingClientRect().left : 0; };
  const sparks = (n) => { const tr = trackRef.current; if (!tr) return; const x = tipX(); for (let i = 0; i < n; i++) spawn(tr, 'mh-prxb-spark', { left: `${x - 2}px`, top: '6px', '--x': `${-10 - Math.random() * 30}px`, '--y': `${Math.random() * 28 - 14}px` }, 600); };
  const motes = () => { const tr = trackRef.current; if (!tr) return; const w = Math.max(20, tipX()); for (let i = 0; i < 3; i++) spawn(tr, 'mh-prxb-mote', { left: `${Math.random() * w}px`, top: `${3 + Math.random() * 10}px`, '--x': `${Math.random() * 30 - 15}px`, '--y': `${-14 - Math.random() * 26}px` }, 950); };
  const boom = () => { const tr = trackRef.current; if (!tr) return; spawn(tr, 'mh-prxb-boom', { left: `${tipX()}px`, top: '8px' }, 420); sparks(12); tr.classList.remove('shake'); void tr.offsetWidth; tr.classList.add('shake'); };
  const flyIn = (i, amount) => {
    const root = rootRef.current, fx = fxRef.current, chip = chipRefs.current[i], tr = trackRef.current; if (!root || !fx || !chip || !tr) return;
    const cr = root.getBoundingClientRect(), hr = chip.getBoundingClientRect(), trr = tr.getBoundingClientRect();
    const e = spawn(fx, 'mh-prxb-fly', { left: `${hr.left - cr.left + hr.width / 2 - 14}px`, top: `${hr.top - cr.top - 4}px`, '--dx': `${trr.left - cr.left + tipX() - (hr.left - cr.left + hr.width / 2)}px`, '--dy': `${trr.top - hr.top + 6}px` }, 560);
    if (e) e.textContent = `+${amount}`;
  };
  const fullBurst = () => {
    const root = rootRef.current, fx = fxRef.current, tr = trackRef.current; if (!root || !fx || !tr) return;
    const bar = tr.querySelector('.mh-prxb-bar'); if (bar) { bar.classList.remove('full'); void bar.offsetWidth; bar.classList.add('full'); }
    root.classList.remove('flash'); void root.offsetWidth; root.classList.add('flash');
    spawn(tr, 'mh-prxb-ring', {}, 650);
    const w = tr.clientWidth;
    for (let i = 0; i < 26; i++) { const a = Math.random() * Math.PI * 2, d = 30 + Math.random() * 60; spawn(tr, 'mh-prxb-burst', { left: `${Math.random() * w}px`, top: '6px', background: PLAYER_RANK_XP_COLORS[i % 5], '--x': `${Math.cos(a) * d}px`, '--y': `${Math.sin(a) * d - 20}px`, '--r': `${Math.random() * 540}deg` }, 850); }
    const cr = root.getBoundingClientRect(), trr = tr.getBoundingClientRect(), ox = cr.width / 2, oy = trr.top - cr.top + 8;
    for (let i = 0; i < 40; i++) { const a = Math.random() * Math.PI * 2, d = 60 + Math.random() * Math.max(cr.width, cr.height) * 0.6; spawn(fx, 'mh-prxb-rad', { left: `${ox}px`, top: `${oy}px`, background: PLAYER_RANK_XP_COLORS[i % 5], '--x': `${Math.cos(a) * d}px`, '--y': `${Math.sin(a) * d}px`, '--r': `${Math.random() * 720}deg` }, 950); }
    for (let j = 0; j < 7; j++) later(() => { const st = spawn(fx, 'mh-prxb-star', { left: `${Math.random() * Math.max(0, cr.width - 20)}px`, top: `${Math.random() * Math.max(0, cr.height - 20)}px` }, 950); if (st) st.textContent = '✦'; }, j * 70);
  };
  const newRankPop = (rank) => { const e = spawn(trackRef.current, 'mh-prxb-newrank', {}, 950); if (e) e.textContent = String(rank); };
  const bumpAdd = (cls) => { const a = addRef.current; if (!a) return; a.classList.remove('bump', 'final'); void a.offsetWidth; a.classList.add(cls); };
  const sendFull = () => { if (rankUp && !runRef.current.fullSent) { runRef.current.fullSent = true; if (onFull) onFull(); } };
  const sendDone = () => { if (!runRef.current.doneSent) { runRef.current.doneSent = true; if (onDone) onDone(); } };
  // 押したとき・終わったとき: 最後の状態にする
  const finish = () => {
    runRef.current.running = false; runRef.current.timers.forEach(clearTimeout); runRef.current.timers = [];
    setView({ rank: endInfo.rank, into: endInfo.into, shown: add, chips: parts.length, up: rankUp, instant: true, tip: false, done: true });
    sendFull(); sendDone();
  };
  React.useEffect(() => {
    if (!seen || !(add > 0) || !runRef.current.running) return undefined;
    const run = runRef.current;
    if (onStart) onStart();
    // 舞う光の粒(伸びている間ずっと)
    const moteTimer = setInterval(() => { if (!run.running) { clearInterval(moteTimer); return; } motes(); }, 90);
    later(() => setView((v) => ({ ...v, instant: false })), 40);
    let t = 250, cum = 0, crossed = false;
    parts.forEach((p, i) => {
      const before = cum; cum += p.xp;
      const crossesHere = !crossed && fromXp + cum >= fromXp - startInfo.into + playerRankNeed(startInfo.rank);
      later(() => setView((v) => ({ ...v, chips: i + 1 })), t);
      later(() => flyIn(i, p.xp), t + 80);
      later(() => {
        // 数字を弾ませながら数え上げる(数が変わるたびに小さい音)
        const t0 = performance.now(); let last = -1;
        const step = (now) => { if (!run.running) return; const kk = Math.min(1, (now - t0) / 320), val = Math.round(before + p.xp * kk); if (val !== last) { last = val; setView((v) => ({ ...v, shown: val })); bumpAdd('bump'); if (val % 3 === 0) se('tap'); } if (kk < 1) requestAnimationFrame(step); };
        requestAnimationFrame(step);
        boom();
        if (crossesHere) {
          setView((v) => ({ ...v, tip: true, into: playerRankNeed(startInfo.rank) }));
          later(() => { fullBurst(); se('levelUp'); setView((v) => ({ ...v, up: true })); sendFull(); }, 340);
          later(() => {
            const mid = playerRankInfo(fromXp + cum);
            setView((v) => ({ ...v, rank: mid.rank, into: 0, instant: true }));
            const bar = trackRef.current && trackRef.current.querySelector('.mh-prxb-bar'); if (bar) { bar.classList.remove('switch'); void bar.offsetWidth; bar.classList.add('switch'); }
            newRankPop(mid.rank);
            later(() => { setView((v) => ({ ...v, instant: false, into: mid.into })); sparks(6); }, 60);
          }, 820);
        } else {
          const mid = playerRankInfo(fromXp + cum);
          setView((v) => ({ ...v, tip: true, rank: mid.rank, into: mid.into }));
          sparks(6);
        }
        later(() => setView((v) => ({ ...v, tip: false })), crossesHere ? 1000 : 420);
      }, t + 320);
      if (crossesHere) crossed = true;
      t += crossesHere ? 1150 : 480;
    });
    later(() => { bumpAdd('final'); sparks(10); se('trainingReward'); }, t + 150);
    later(() => { run.running = false; setView((v) => ({ ...v, done: true })); sendDone(); }, t + 250);
    return () => { run.running = false; clearInterval(moteTimer); run.timers.forEach(clearTimeout); };
  }, [seen]);
  const need = playerRankNeed(view.rank);
  const w = `${pct(view.rank, view.into)}%`;
  return (
    <div ref={rootRef} data-player-rank-xp-bar={kind} data-player-rank-xp-bar-done={view.done ? 'true' : 'false'}
      className={`mh-prxb${kind === 'card' ? ' gold' : ''}${view.instant ? ' instant' : ''}`}
      role="button" tabIndex={0} aria-label={view.done ? `${k.label} 経験値 +${add}` : '押すと最後まで飛ばす'}
      onClick={() => { if (!view.done) finish(); }} onKeyDown={(e) => { if ((e.key === 'Enter' || e.key === ' ') && !view.done) { e.preventDefault(); finish(); } }}>
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
        <span className={`self-center rounded-full px-2 py-0.5 text-[10px] font-black ${k.pill}`}><span aria-hidden="true">{cardIconNode(k.icon, 12)} </span>{k.label}</span>
        <b ref={addRef} data-player-rank-gain-add className="mh-prxb-add">{`経験値 +${view.shown.toLocaleString()}`}</b>
        <span className="text-[12px] font-black text-white tabular-nums">{view.up ? `(ランク${startInfo.rank}→${endInfo.rank})` : `(ランク${view.rank})`}</span>
      </div>
      {parts.length > 0 && <div data-player-rank-gain-parts className="mb-3 mt-1.5 flex flex-wrap gap-1.5">
        {parts.map((p, i) => <span key={i} ref={(el) => { chipRefs.current[i] = el; }} className={`mh-prxb-chip${i < view.chips ? ' on' : ''}`}>{p.label} <b>{`+${p.xp}`}</b></span>)}
      </div>}
      <div ref={trackRef} className="mh-prxb-track">
        <div className="mh-prxb-bar" role="progressbar" aria-label="次のランクまで" aria-valuemin={0} aria-valuemax={need} aria-valuenow={view.into}>
          <i className="mh-prxb-fill" style={{ width: w }}/>
        </div>
        <i className={`mh-prxb-tip${view.tip ? ' on' : ''}`} style={{ left: w }}/>
        {view.up && <span className="mh-prxb-up" aria-hidden="true">RANK UP!</span>}
      </div>
      <div className="mt-1 flex justify-between gap-2 text-[10px] font-bold text-slate-300 tabular-nums">
        <span>{`${view.into.toLocaleString()} / ${need.toLocaleString()}`}</span>
        <span>{`次まで ${(need - view.into).toLocaleString()}`}</span>
      </div>
      <div ref={fxRef} className="mh-prxb-fx" aria-hidden="true"/>
    </div>
  );
}

// 1回ぶんの結果に出す札: 経験値の棒が伸びる演出(PlayerRankXpBar)・次のごほうび・上がったらもらった物。
// award: { add, parts:[{label,xp}], from, to, xp(足したあとの合計), gains:[{icon,text}] }。next は次のごほうびの文(「ランク20で ビートP 300」)
// onFull・onDone・onStart(棒が画面に入って動き出した)は PlayerRankXpBar へそのまま渡す(ビートはここで画面いっぱいの演出を出す。カードは渡さなければ今までどおり)
function PlayerRankGain({ kind = 'beat', award, next = '', onFull = null, onDone = null, onStart = null }) {
  const [done, setDone] = React.useState(false);
  if (!award || !(award.add > 0)) return null;
  const k = playerRankKind(kind);
  const up = award.to > award.from;
  return (
    <section data-player-rank-gain={kind} className={`relative my-3 space-y-1.5 rounded-2xl border p-3 pt-4 text-left ${k.border} ${k.panel}`}>
      <PlayerRankXpBar kind={kind} award={award} onFull={onFull} onStart={onStart} onDone={() => { setDone(true); if (onDone) onDone(); }}/>
      {next && <p data-player-rank-gain-next className="text-[10px] font-bold text-slate-300" style={JA_WRAP_STYLE}>{jaWrap(`次は ${next}`)}</p>}
      {up && done && <PlayerRankUp kind={kind} from={award.from} to={award.to} gains={award.gains || []}/>}
    </section>
  );
}

// ランキングの1行。place は順位(無ければ「—」)。icon は呼ぶ側が描いたアイコン(rankingBreederIcon など)
function PlayerRankRow({ kind = 'beat', place = null, icon = null, name = '', rank = 1, xp = 0, mine = false }) {
  const k = playerRankKind(kind);
  return (
    <li data-player-rank-row={kind} data-player-rank-mine={mine ? 'true' : undefined}
      className={`flex items-center gap-2 rounded-xl border px-2 py-1.5 ${mine ? `border-2 ${k.border} bg-cyan-950/50` : 'border-white/10 bg-slate-900/80'}`}>
      <b className={`w-9 shrink-0 text-center text-sm font-black tabular-nums ${place === 1 ? 'text-amber-300' : 'text-slate-200'}`}>{place ? place.toLocaleString() : '—'}</b>
      {icon}
      <span className="min-w-0 flex-1 truncate text-xs font-black text-white">{name}{mine ? '(あなた)' : ''}</span>
      <span className="flex shrink-0 flex-col items-end gap-0.5">
        <PlayerRankBadge kind={kind} rank={rank} size="sm" showName={false}/>
        <small className="block text-[9px] font-bold text-slate-400 tabular-nums">{`経験値 ${playerRankSafeXp(xp).toLocaleString()}`}</small>
      </span>
    </li>
  );
}

// ランキングのタブの中身: 上位100人と、自分の行(100人に入っていなければ下に順位つきで)。
// 読み込みは呼ぶ側が渡す(ビートは sbFetchBeatRanks・sbFetchBeatRankMine。カードも同じ形で渡す)。
//   fetchTop() → [{ breederId, name, icon, profileFrame, rank, xp }] | null(表がまだ無い)
//   fetchMine() → { …同じ, place } | null
// renderIcon(entry) は行のアイコン(全国ランキングと同じ rankingBreederIcon)。reloadKey が変わると読み直す
function PlayerRankBoard({ kind = 'beat', fetchTop, fetchMine, renderIcon = null, selfBreederId = '', selfXp = 0, reloadKey = 0 }) {
  const [board, setBoard] = React.useState({ status: 'loading', top: [], mine: null });
  React.useEffect(() => {
    let alive = true;
    setBoard((b) => ({ ...b, status: b.top.length ? 'ready' : 'loading' }));
    (async () => {
      try {
        const [top, mine] = await Promise.all([fetchTop ? fetchTop() : null, fetchMine ? fetchMine().catch(() => null) : null]);
        if (!alive) return;
        if (top === null) { setBoard({ status: 'closed', top: [], mine: null }); return; }
        setBoard({ status: 'ready', top, mine });
      } catch (_) { if (alive) setBoard((b) => ({ ...b, status: b.top.length ? 'ready' : 'error' })); }
    })();
    return () => { alive = false; };
  }, [reloadKey]);
  const label = playerRankKind(kind).label;
  const iconOf = (e) => (renderIcon ? renderIcon({ icon: e.icon, profileFrame: e.profileFrame, userName: e.name, breederId: e.breederId }) : null);
  if (board.status === 'loading') return <p data-player-rank-board="loading" className="px-3 py-6 text-center text-xs font-black text-slate-400">読み込んでいます…</p>;
  if (board.status === 'closed') return <p data-player-rank-board="closed" className="px-3 py-6 text-center text-xs font-black text-slate-400" style={JA_WRAP_STYLE}>{jaWrap(`${label}のランキングは準備中です。`)}</p>;
  if (board.status === 'error') return <p data-player-rank-board="error" className="px-3 py-6 text-center text-xs font-black text-rose-300" style={JA_WRAP_STYLE}>{jaWrap('ランキングを読み込めませんでした。電波のよいところで「更新」を押してください。')}</p>;
  const selfId = selfBreederId || (board.mine && board.mine.breederId) || '';
  const inTop = !!selfId && board.top.some((e) => e.breederId === selfId);
  return (
    <div data-player-rank-board={kind} className="space-y-2 px-3 py-2">
      <p className="text-[10px] font-bold text-slate-400" style={JA_WRAP_STYLE}>{jaWrap('ランクの高い順。同じランクなら、経験値の合計が多い順です(上位100人とあなた)。')}</p>
      {board.top.length === 0
        ? <p className="py-4 text-center text-xs font-black text-slate-400" style={JA_WRAP_STYLE}>{jaWrap(`まだだれも載っていません。${kind === 'card' ? 'MFバトルカードで対戦する' : '曲を遊ぶ'}と、ここに載ります。`)}</p>
        : <ol className="space-y-1.5">{board.top.map((e, i) => <PlayerRankRow key={e.breederId || i} kind={kind} place={i + 1} icon={iconOf(e)} name={e.name} rank={e.rank} xp={e.xp} mine={!!selfId && e.breederId === selfId}/>)}</ol>}
      {!inTop && (board.mine
        ? <ol className="border-t border-white/10 pt-2"><PlayerRankRow kind={kind} place={board.mine.place} icon={iconOf(board.mine)} name={board.mine.name} rank={board.mine.rank} xp={board.mine.xp} mine/></ol>
        : selfXp > 0 && <p className="border-t border-white/10 pt-2 text-center text-[10px] font-bold text-slate-400" style={JA_WRAP_STYLE}>{jaWrap(`あなたの記録は、次に${kind === 'card' ? 'ランクが上がった' : '曲を遊んだ'}ときに載ります。`)}</p>)}
    </div>
  );
}

// ==== ランクが上がった瞬間の、画面いっぱいの演出(2026-10-29 社長「この演出で」・見本 claude.ai/artifact/RxkPuST5JAV2JkyAQmB3GX) ====
// ビートランク(曲の結果)とカードランク(対戦の結果)で同じ演出を使う。
//   1. 前のランクの盾が震えて割れ、新しい数字の盾が飛び出す(光の輪・紙吹雪・「RANK UP!」)
//   2. 帯が変わる(シルバー→ゴールドなど)ときは、画面が白く光り、光線が回り、紙吹雪を多めに、「◯◯に昇格!」の帯
//   3. もらった物(gains: [{ icon, text, note?, bonus? }])が1つずつ右から飛び込む(bonus は5ランクごとのおまけの光)
// 押すと先へ進む(演出中 → 最後の状態 → 閉じる)。長くても4秒ほど。一度に何ランクも上がっても演出は1回(to のランクで)。
// 効果音: 割れる crit → ファンファーレ(ふつう rankFanfare・帯が変わるとき rankFanfareGrand。毎回鳴らす)→ もらった物が入るたび trainingReward
const PLAYER_RANK_UP_FX_CSS = `
.mh-prfx{position:fixed;inset:0;z-index:95000;container-type:size;background:radial-gradient(circle at 50% 38%,rgba(64,24,120,.92),rgba(8,4,20,.94) 70%);cursor:pointer;user-select:none;overflow:hidden}
.mh-prfx-stage{position:relative;width:100%;height:100%;box-sizing:border-box;display:flex;flex-direction:column;align-items:center;justify-content:safe center;gap:12px;padding:max(16px,var(--mh-sa-top,0px)) 16px max(16px,var(--mh-sa-bottom,0px));overflow-y:auto}
.mh-prfx-head{position:relative;flex:none;display:flex;flex-direction:column;align-items:center;gap:8px}
.mh-prfx-side{flex:none;display:flex;flex-direction:column;align-items:center;gap:10px;width:min(100%,560px)}
.mh-prfx-big .mh-prb-shield{width:96px;height:107px}
.mh-prfx-big .mh-prb-shield::after{inset:5px}
.mh-prfx-big .mh-prb-num{font-size:46px;-webkit-text-stroke:8px var(--prb-ink)}
.mh-prfx-big .mh-prb-num.mh-prb-w3{font-size:34px}
.mh-prfx-title{font-weight:900;font-size:32px;line-height:1.1;color:#fff;-webkit-text-stroke:6px #4c1d95;paint-order:stroke fill;letter-spacing:.04em}
.mh-prfx-kind{font-weight:900;font-size:15px;line-height:1.2;color:#fff;-webkit-text-stroke:3px #1e293b;paint-order:stroke fill}
.mh-prfx-slot{position:relative;width:96px;height:107px}
.mh-prfx-half{position:absolute;inset:0}
.mh-prfx-half.l{clip-path:polygon(0 0,52% 0,44% 100%,0 100%)}
.mh-prfx-half.r{clip-path:polygon(52% 0,100% 0,100% 100%,44% 100%)}
.mh-prfx-new{position:absolute;inset:0}
.mh-prfx-ring{position:absolute;left:50%;top:53px;width:120px;height:120px;margin:-60px 0 0 -60px;border-radius:50%;border:4px solid rgba(255,255,255,.9);opacity:0;pointer-events:none}
.mh-prfx-conf{position:absolute;left:50%;top:53px;width:8px;height:12px;border-radius:2px;opacity:0;pointer-events:none}
.mh-prfx-rays{position:absolute;left:50%;top:38%;width:560px;height:560px;margin:-280px 0 0 -280px;border-radius:50%;opacity:0;pointer-events:none;background:repeating-conic-gradient(from 0deg,var(--prfx-ray) 0 8deg,transparent 8deg 24deg);-webkit-mask:radial-gradient(circle,#000 25%,transparent 68%);mask:radial-gradient(circle,#000 25%,transparent 68%)}
.mh-prfx-flash{position:absolute;inset:0;background:#fff;opacity:0;pointer-events:none}
.mh-prfx-band{align-self:stretch;text-align:center;padding:8px 0;font-weight:900;font-size:20px;line-height:1.2;color:#fff;-webkit-text-stroke:4px rgba(0,0,0,.6);paint-order:stroke fill;opacity:0;background:linear-gradient(90deg,transparent,var(--prfx-band),transparent)}
/* 2列にするのは、1つの札に字が入りきる幅(220px)が取れるときだけ(2026-10-30 カード部の検査「390幅でセッション券が札の外」) */
.mh-prfx-gains{list-style:none;margin:0;padding:0;width:100%;display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:8px}
.mh-prfx-gain{display:flex;align-items:center;gap:10px;min-width:0;padding:8px 12px;border-radius:14px;background:rgba(15,10,35,.88);border:1px solid rgba(253,224,71,.45);opacity:0}
.mh-prfx-gain.bonus{border-color:#f0abfc;box-shadow:0 0 18px rgba(240,171,252,.45)}
.mh-prfx-gain b{display:block;font-size:18px;font-weight:900;line-height:1.2;color:#fef08a;font-variant-numeric:tabular-nums;word-break:keep-all;overflow-wrap:anywhere}
.mh-prfx-gain small{display:block;font-size:10px;font-weight:700;color:#cbd5e1}
.mh-prfx-gain .ico{flex:none;font-size:24px}
.mh-prfx-hint{flex:none;text-align:center;font-size:11px;font-weight:700;color:rgba(255,255,255,.6)}
/* 横向きで背が低い(画面を回した形も含む。演出の枠の形で見る): 左に盾、右に帯ともらった物 */
@container (orientation:landscape) and (max-height:520px){
  .mh-prfx-stage{flex-direction:row;gap:20px;padding:max(12px,var(--mh-sa-top,0px)) max(16px,var(--mh-sa-right,0px)) max(12px,var(--mh-sa-bottom,0px)) max(16px,var(--mh-sa-left,0px))}
  .mh-prfx-side{flex:1 1 0;min-width:0;max-width:560px}
  .mh-prfx-title{font-size:26px}
  .mh-prfx-gains{grid-template-columns:repeat(auto-fit,minmax(220px,1fr))}
  .mh-prfx-gain{padding:6px 10px}
  .mh-prfx-gain b{font-size:16px}
  .mh-prfx-band{font-size:17px;padding:6px 0}
}
/* さらに背が低いときは盾と題を小さく */
@container (max-height:340px){
  .mh-prfx-head{gap:4px}
  .mh-prfx-slot{transform:scale(.8);margin:-10px 0}
  .mh-prfx-title{font-size:22px}
  .mh-prfx-gain small{display:none}
}
.mh-prfx.play .mh-prfx-half .mh-prb{animation:mhPrfxShake .5s ease-in-out}
.mh-prfx.play .mh-prfx-half.l{animation:mhPrfxSplitL .45s ease-in .5s forwards}
.mh-prfx.play .mh-prfx-half.r{animation:mhPrfxSplitR .45s ease-in .5s forwards}
.mh-prfx.play .mh-prfx-new{animation:mhPrfxPop .5s cubic-bezier(.2,1.6,.4,1) .75s both}
.mh-prfx.play .mh-prfx-ring{animation:mhPrfxRing .7s ease-out .75s both}
.mh-prfx.play .mh-prfx-title{animation:mhPrfxDrop .45s cubic-bezier(.2,1.4,.4,1) .9s both}
.mh-prfx.play .mh-prfx-kind{animation:mhPrfxFade .3s ease-out 1.1s both}
.mh-prfx.play .mh-prfx-conf{animation:mhPrfxConf 1.2s ease-out var(--d) both}
.mh-prfx.play .mh-prfx-flash{animation:mhPrfxFlash .5s ease-out .7s both}
.mh-prfx.play .mh-prfx-rays{animation:mhPrfxRays 2.4s ease-out .75s both}
.mh-prfx.play .mh-prfx-band{animation:mhPrfxBand .5s ease-out 1.3s both}
.mh-prfx.play .mh-prfx-gain{animation:mhPrfxFly .45s cubic-bezier(.2,1.3,.4,1) var(--d) both}
.mh-prfx.done *{animation:none!important}
.mh-prfx.done .mh-prfx-half,.mh-prfx.done .mh-prfx-conf,.mh-prfx.done .mh-prfx-ring,.mh-prfx.done .mh-prfx-flash{display:none}
.mh-prfx.done .mh-prfx-new,.mh-prfx.done .mh-prfx-title,.mh-prfx.done .mh-prfx-kind,.mh-prfx.done .mh-prfx-gain,.mh-prfx.done .mh-prfx-band{opacity:1;transform:none}
.mh-prfx.done .mh-prfx-rays{opacity:.9}
@keyframes mhPrfxShake{0%,100%{transform:translateX(0)}20%{transform:translateX(-6px) rotate(-3deg)}40%{transform:translateX(6px) rotate(3deg)}60%{transform:translateX(-4px)}80%{transform:translateX(4px)}}
@keyframes mhPrfxSplitL{to{transform:translate(-60px,40px) rotate(-25deg);opacity:0}}
@keyframes mhPrfxSplitR{to{transform:translate(60px,40px) rotate(25deg);opacity:0}}
@keyframes mhPrfxPop{from{transform:scale(.2);opacity:0}to{transform:scale(1);opacity:1}}
@keyframes mhPrfxRing{from{transform:scale(.4);opacity:1}to{transform:scale(2.6);opacity:0}}
@keyframes mhPrfxDrop{from{transform:translateY(-30px) scale(1.4);opacity:0}to{transform:none;opacity:1}}
@keyframes mhPrfxFade{from{opacity:0}to{opacity:1}}
@keyframes mhPrfxConf{0%{opacity:1;transform:translate(0,0) rotate(0)}100%{opacity:0;transform:translate(var(--x),var(--y)) rotate(var(--r))}}
@keyframes mhPrfxFlash{0%{opacity:.9}100%{opacity:0}}
@keyframes mhPrfxRays{0%{opacity:0;transform:rotate(0) scale(.6)}30%{opacity:1}100%{opacity:.9;transform:rotate(60deg) scale(1)}}
@keyframes mhPrfxBand{from{opacity:0;transform:scaleX(.2)}to{opacity:1;transform:none}}
@keyframes mhPrfxFly{from{opacity:0;transform:translateX(80px) scale(.8)}to{opacity:1;transform:none}}
@media (prefers-reduced-motion:reduce){.mh-prfx.play *{animation-duration:.01s!important;animation-delay:0s!important}}
`;
const ensurePlayerRankUpFxCss = () => {
  try {
    if (typeof document === 'undefined' || document.getElementById('mh-player-rank-up-fx-css')) return;
    const el = document.createElement('style');
    el.id = 'mh-player-rank-up-fx-css';
    el.textContent = PLAYER_RANK_UP_FX_CSS;
    document.head.appendChild(el);
  } catch (_) { /* 入れられなくても、ランクともらった物の文字は読める */ }
};
// 帯ごとの光線と帯の色
const PLAYER_RANK_UP_TIER_FX = Object.freeze({
  1: { ray: 'rgba(234,138,74,.3)', band: 'rgba(154,75,28,.85)' },
  2: { ray: 'rgba(226,232,240,.3)', band: 'rgba(100,116,139,.85)' },
  3: { ray: 'rgba(253,224,71,.32)', band: 'rgba(217,119,6,.85)' },
  4: { ray: 'rgba(192,132,252,.34)', band: 'rgba(109,40,217,.85)' },
  5: { ray: 'rgba(255,255,255,.3)', band: 'rgba(79,70,229,.85)' },
});
const PLAYER_RANK_UP_CONFETTI = ['#fde047', '#f0abfc', '#22d3ee', '#f472b6', '#a3e635', '#fff'];

function PlayerRankUpFx({ kind = 'beat', from = 1, to = 1, gains = [], onClose = null }) {
  ensurePlayerRankBadgeCss();
  ensurePlayerRankUpFxCss();
  const [stage, setStage] = React.useState('play');
  const tierFrom = playerRankTier(from), tierTo = playerRankTier(to);
  const tierUp = tierTo.t !== tierFrom.t;
  const fx = PLAYER_RANK_UP_TIER_FX[tierTo.t] || PLAYER_RANK_UP_TIER_FX[1];
  // 紙吹雪は最初に1回だけ散らばり方を決める(描き直しで飛び直さないように)
  const confetti = React.useMemo(() => Array.from({ length: tierUp ? 48 : 18 }, (_, i) => {
    const a = Math.random() * Math.PI * 2, d = 60 + Math.random() * 130;
    return { x: `${Math.cos(a) * d}px`, y: `${Math.sin(a) * d + 120}px`, r: `${Math.random() * 720 - 360}deg`, d: `${0.75 + Math.random() * 0.3}s`, c: PLAYER_RANK_UP_CONFETTI[i % PLAYER_RANK_UP_CONFETTI.length] };
  }), []);
  const list = Array.isArray(gains) ? gains : [];
  const gainStart = tierUp ? 1.8 : 1.3;
  React.useEffect(() => {
    // 音は「画面の前の効果音」(fgSe)で鳴らす。Audio_.se はカードの画面にいる間、裏の周回の音を止める印で黙るため(カードランクの演出が無音になる)。
    // 音量は効果音の音量設定に従う(モンヒロビートの画面は効果音の音量を0にしているが、この演出を出している間は戻す: 60 の setSeVolume)
    const se = (name) => { try { const bank = typeof Audio_ !== 'undefined' ? (Audio_.fgSe || Audio_.se) : null; if (bank && typeof bank[name] === 'function') bank[name](); } catch (_) { /* 音が出なくても演出は続ける */ } };
    const timers = [
      setTimeout(() => se('crit'), 500),
      // 2026-10-29 社長「毎回ファンファーレを鳴らす」。ふつうは短く、帯が変わるとき(10・20・30・50)は豪華に。曲は止めない
      setTimeout(() => se(tierUp ? 'rankFanfareGrand' : 'rankFanfare'), 750),
      ...list.map((_, i) => setTimeout(() => se('trainingReward'), (gainStart + i * 0.35) * 1000 + 150)),
      setTimeout(() => setStage((s) => (s === 'play' ? 'done' : s)), (gainStart + list.length * 0.35 + 0.6) * 1000),
    ];
    return () => timers.forEach(clearTimeout);
  }, []);
  // 押すと先へ: 演出中 → 最後の状態 → 閉じる
  const next = () => { if (stage === 'play') setStage('done'); else if (onClose) onClose(); };
  const k = playerRankKind(kind);
  const shield = (rank, cls = '') => (
    <span className={`mh-prb mh-prfx-big mh-prb-t${playerRankTier(rank).t} ${cls}`}>
      <span className="mh-prb-shield"><span className="mh-prb-gloss"/><b className={`mh-prb-num${String(rank).length >= 3 ? ' mh-prb-w3' : ''}`}><span className="mh-prb-digits">{rank}</span></b></span>
    </span>
  );
  return (
    <div data-player-rank-up-fx={kind} data-player-rank-up-fx-stage={stage} className={`mh-prfx ${stage}`} role="dialog" aria-modal="true"
      aria-label={`${k.label}が${to}に上がりました`} tabIndex={0} onClick={next}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ' || e.key === 'Escape') { e.preventDefault(); next(); } }}
      style={{ '--prfx-ray': fx.ray, '--prfx-band': fx.band }}>
      {tierUp && <div className="mh-prfx-rays" aria-hidden="true"/>}
      <div className="mh-prfx-stage">
        <div className="mh-prfx-head">
          <div className="mh-prfx-ring" aria-hidden="true"/>
          <div className="mh-prfx-slot">
            <div className="mh-prfx-half l" aria-hidden="true">{shield(from)}</div>
            <div className="mh-prfx-half r" aria-hidden="true">{shield(from)}</div>
            <div className="mh-prfx-new">{shield(to)}</div>
          </div>
          <div className="mh-prfx-title">RANK UP!</div>
          <div className="mh-prfx-kind">{k.label}</div>
          {confetti.map((c, i) => <span key={i} className="mh-prfx-conf" aria-hidden="true" style={{ '--x': c.x, '--y': c.y, '--r': c.r, '--d': c.d, background: c.c }}/>)}
        </div>
        <div className="mh-prfx-side">
          {tierUp && <div className="mh-prfx-band">{`${tierTo.name}に昇格!`}</div>}
          {list.length > 0 && <ul className="mh-prfx-gains" aria-label="もらった物">
            {list.map((g, i) => (
              <li key={i} className={`mh-prfx-gain${g.bonus ? ' bonus' : ''}`} style={{ '--d': `${gainStart + i * 0.35}s` }}>
                {g.icon && <span className="ico" aria-hidden="true">{cardIconNode(g.icon, 16)}</span>}
                <span className="min-w-0"><b>{String(g.text || '')}</b>{g.note && <small style={JA_WRAP_STYLE}>{jaWrap(String(g.note))}</small>}</span>
              </li>
            ))}
          </ul>}
          <div className="mh-prfx-hint">{stage === 'play' ? '押すと先へ' : '押すと閉じる'}</div>
        </div>
      </div>
      {tierUp && <div className="mh-prfx-flash" aria-hidden="true"/>}
    </div>
  );
}

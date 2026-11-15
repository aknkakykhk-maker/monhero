// ===== モンヒロサクセスの「動いた数字の札」MsxGaugeFx(r1115-047・054 社長「体力回復とかは数値出てたけど演出がなくてわかりにくい」) =====
// 結果の画面で、実際に動いた値(体力・ストレス・忠誠・人気・甘え度・恐れ度・親密度・能力)を、行ごとに
//   ゲージが前の値 → 後の値へ伸び縮みし・数字が数え上がり(下がるときは数え下がり)・増減の数字(+12/−5)が浮かんで・音が鳴る。行は少しずつずらして始まる。
// items: [{ k, e(絵文字・ノード), name, from, to, max, unit, cls }]。from と to が同じ行は出さない(動いた物だけ)。
// 「動きを減らす」設定(msxFxCalm)では、はじめから後の値で出す(数字・ゲージ・増減はそのまま見える)。
// 数は呼ぶ側が芯の前後の差から作る(ここでは計算しない)・何も保存しない・公開の印 monheroSuccess の後ろ
const MSX_GFX_ROW_MS = 900;
const MSX_GFX_STAGGER = 220;
const msxGfxEase = (p) => 1 - Math.pow(1 - Math.max(0, Math.min(1, p)), 3);
function MsxGaugeFx({ items, title = null }) {
  const calm = typeof msxFxCalm === 'function' && msxFxCalm();
  const list = (Array.isArray(items) ? items : []).filter((it) => it && Number.isFinite(it.from) && Number.isFinite(it.to) && Math.round(it.from) !== Math.round(it.to));
  const total = MSX_GFX_ROW_MS + Math.max(0, list.length - 1) * MSX_GFX_STAGGER;
  const [el, setEl] = React.useState(calm ? total : 0);
  React.useEffect(() => {
    if (calm || !list.length) { setEl(total); return undefined; }
    let raf = 0; const t0 = performance.now();
    const loop = (now) => { const e = Math.min(total, now - t0); setEl(e); if (e < total) raf = requestAnimationFrame(loop); };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);
  // 行ごとの効果音(動いた行の頭で、最初の4行まで)。上がる=回復の音・下がる=使った音。消音・音量は SuccessSound が見る
  const se = list.slice(0, 4).map((it, i) => [it.good === false ? 'itemUse' : 'itemHeal', i * MSX_GFX_STAGGER]);
  if (typeof msxUseTimedSe === 'function') msxUseTimedSe(calm ? [] : se, []);
  if (!list.length) return null;
  return (
    <div className="v-gfx" data-msx-gfx={list.length}>
      {title ? <div className="hd2">{title}</div> : null}
      {list.map((it, i) => {
        const p = msxGfxEase((el - i * MSX_GFX_STAGGER) / MSX_GFX_ROW_MS);
        const now = Math.round(it.from + (it.to - it.from) * p);
        const max = Math.max(1, Number(it.max) || Math.max(it.from, it.to, 1));
        const w = Math.max(0, Math.min(100, (it.from + (it.to - it.from) * p) / max * 100));
        const d = Math.round(it.to) - Math.round(it.from); const up = d > 0; const good = it.good === undefined ? up : it.good;
        const started = el - i * MSX_GFX_STAGGER > 0;
        return (
          <div key={it.k} className={`r ${it.cls || ''}${good ? ' gd' : ' bd'}`} data-msx-gfx-row={it.k} data-msx-gfx-to={Math.round(it.to)}>
            <span className="n">{it.e ? <span className="e">{it.e}</span> : null}{it.name}</span>
            <span className="tr"><i style={{ width: `${w}%` }}/></span>
            <b className="v">{now.toLocaleString()}{it.unit || ''}</b>
            <em className={`dl ${up ? 'up' : 'dn'}`} style={{ animationDelay: `${i * MSX_GFX_STAGGER}ms`, visibility: started || calm ? 'visible' : 'hidden' }}>{up ? `+${d.toLocaleString()}` : `−${Math.abs(d).toLocaleString()}`}</em>
          </div>
        );
      })}
    </div>
  );
}

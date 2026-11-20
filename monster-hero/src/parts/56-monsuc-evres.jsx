// ===== モンヒロサクセスの育成イベントの「選んだあとの結果」(2026-11-14 社長「選択のあと何も起きなかったけど、起きないやつもあるの?」) =====
// 芯の SUC.events.pick が返す out.delta(動いた数字)を札で並べる。能力はゲージ(MsxStRow)が出すので、ここは能力以外。
//   msxEvDeltaChips(delta) … [{ k, name, val, good }] の並び(val が無い札は名前だけ)(体力 −10・人気 +3 など)。何も動かなければ空
//   MsxEvResult            … 結果の段の札の行(data-msx-ev-res)。動いた物が無いときは「変わったことはなかった」
// 何も保存しない・公開の印は持たない(モンサクの画面の中からだけ呼ぶ)。

const msxEvSigned = (n) => (n > 0 ? `+${n}` : `−${Math.abs(n)}`);
const msxEvDeltaChips = (d) => {
  if (!d || typeof d !== 'object') return [];
  const out = [];
  const num = (k, name, up = true, unit = '') => { const n = Math.round(Number(d[k])); if (Number.isFinite(n) && n) out.push({ k, name, val: `${msxEvSigned(n)}${unit}`, good: up ? n > 0 : n < 0 }); };
  num('hp', '体力'); num('stress', 'ストレス', false); num('pop', '人気'); num('loyal', '忠誠'); num('bond', '親密度');
  num('fame', '賞金', true, 'G'); num('pts', '能力ポイント'); num('mastery', '技の熟練');
  const BUFFS = typeof msxSuc !== 'undefined' && msxSuc && msxSuc.SUC && msxSuc.SUC.events ? msxSuc.SUC.events.BUFFS || {} : {};
  (Array.isArray(d.buffs) ? d.buffs : []).forEach((b) => { const x = BUFFS[b]; out.push({ k: `buff-${b}`, name: x ? `${x.icon} ${x.name}になった` : 'いい調子になった', good: x ? x.good !== false : true, buff: b }); }); // 中身(何ターン・どう効くか)は下の行で出す(r1119-029)
  const FLAG = typeof MSX_FX_FLAG !== 'undefined' ? MSX_FX_FLAG : {};
  ['guts', 'goalPlus', 'boost', 'fav', 'tagSeen', 'injRisk'].forEach((k) => { if (d[k]) out.push({ k, name: FLAG[k === 'boost' ? 'baseBoost' : k] || 'いいことがある', good: k !== 'injRisk' }); });
  if (d.goal) out.push({ k: 'goal', name: (typeof MSX_FX_GOAL !== 'undefined' && MSX_FX_GOAL[d.goal]) || '期の目標が決まった', good: true });
  return out;
};
// skip … 上のゲージの演出(MsxGaugeFx)が出している物の札は出さない(体力・ストレスが帯・ゲージ・結果の3か所に出ていた・r1119-033 育-98)
function MsxEvResult({ delta, hasStats, skip = null }) {
  const all = msxEvDeltaChips(delta);
  const chips = all.filter((c) => !(Array.isArray(skip) && skip.includes(c.k)));
  if (!chips.length && (hasStats || all.length)) return null; // 動いた物がゲージに全部出ているときは、箱ごと出さない
  // ひとときの状態は、名前と「何ターン・どう効くか」を1行で出す(名前だけの札と二重にしない・r1119-033 観点8)
  const grant = typeof msxBuffGrantText === 'function';
  const row = chips.filter((c) => !(c.buff && grant)); const bufs = chips.filter((c) => c.buff && grant);
  return (
    <div className="v-log" data-msx-ev-res={chips.length}>
      <span className="hd2">📋 結果</span><br/>
      {row.length ? row.map((c, i) => <span key={c.k} data-msx-ev-chip={c.k}>{i ? '・' : ''}{c.name}{c.val ? <> <b className={c.good ? 'gu' : ''} style={c.good ? undefined : { color: '#dc2626' }}>{c.val}</b></> : null}</span>)
        : bufs.length ? null : <span data-msx-ev-none>変わったことはなかった</span>}
      {bufs.map((c) => { const d = typeof msxBuffDef === 'function' ? msxBuffDef(c.buff) : null; return (
        <div key={`bl-${c.buff}`} className="msx-ev-bfl" data-msx-ev-chip={c.k} data-msx-ev-buff={c.buff} style={{ marginTop: row.length ? 4 : 0, fontSize: 12, fontWeight: 800, color: c.good ? '#166534' : '#b91c1c', textAlign: 'left', lineHeight: 1.45 }}>
          {d ? <><b style={{ fontWeight: 900 }}>{d.icon} {d.name}になった({d.dur})</b><br/>{String(d.text).split('・').map((t, i) => <span key={i} style={{ display: 'inline-block', whiteSpace: 'nowrap' }}>{i ? '・' : ''}{t}</span>)}</> : msxBuffGrantText(c.buff, true)}
        </div>); })}
    </div>
  );
}

// ===== モンサクのモンスター表示の共通の型(r1119-017・2026-11-20 社長「全てにサイズ感とか統一感がない」) =====
// 決まりの本文は docs/spec/MONSUC_UI.md の「8. モンスターの札の型」。参考は docs/reference/line-mf/ の assist-hensei・deck-select・assist-card-8-detail。
// 形は1つ(縦長 3:4 の札・全身の絵を下に合わせて収める・左上に得意な能力・右上に評価・下の帯に名前と Lv)で、大きさだけ3つ:
//   's' 一覧の小(5列の升目)/ 'm' 札の中(編成の6枠・3列)/ 'l' 詳細の大(1体の絵)
// 名前・評価・得意な能力・選んだ印・選べない理由は、どの大きさでも置き場所が決まっていて重ならない(r1119-006 の「名前が札に隠れる」を作らない)。
//   m … 保存枠の子と同じ形({ species, nick, colors, awake, lv, grade, rank, fav })。null なら空き枠(「+」)
//   tag … 札の下の色つきの帯 { text, kind: 'friend' | 'memo' | 'base' | 'box' }(参考の「スペシャル」「フレンド」の帯)
//   num … 札の下に添える数字(一覧の総合力など。文字でもよい)/ on … 選んでいる / lock … 選べない理由(文字)
//   slot … 編成に入っている枠の番号(絵の真ん中に青い丸。参考 assist-hensei の「1」「5」)/ note … 選べるが知らせたいこと(「同じ種類が編成中」など。絵を薄くしない帯)
// 小は札の幅が狭い(縦の5列でおよそ 68px)ので、名前を札の外の下に2行まで 11px で出す(8文字の名前が切れない・ミハリ #6897)。
//   Lv は小では出さない: 一覧は総合力と評価で比べる物で、Lv は札を押した詳細で見る(参考は小にも Lv があるが、5列の札に名前・総合力・Lv の3行は入らない)
const MONSUC_CARD_FRAME = Object.freeze({ S: '#fde047', A: '#f87171', B: '#f472b6', C: '#4ade80', D: '#67e8f9', E: '#60a5fa', F: '#a78bfa', G: '#9ca3af', M: '#c084fc' });
const monsucCardFrame = (g) => MONSUC_CARD_FRAME[String(g || '').trim().charAt(0).toUpperCase()] || '#6b6597';
function MonsucMonCard({ m, size = 's', tag = null, num = null, on = false, lock = null, slot = null, note = null, onClick = null, attrs = null, empty = '+' }) {
  const sz = size === 'l' || size === 'm' ? size : 's';
  const grade = m ? (m.grade || m.rank || '') : '';
  const fav = m && Array.isArray(m.fav) ? m.fav.filter((k) => typeof MSX_STAT_ICON === 'object' && MSX_STAT_ICON[k]).slice(0, sz === 's' ? 1 : 2) : [];
  const name = m ? (m.nick || (typeof msxMonName === 'function' ? msxMonName(m.species) : m.species)) : '';
  const lv = m && Number.isFinite(Number(m.lv)) && Number(m.lv) > 0 ? Math.round(Number(m.lv)) : null;
  const inner = (<>
    <span className={`mcd-f${m ? '' : ' empty'}`} style={m ? { '--mcd-c': monsucCardFrame(grade) } : undefined}>
      {m ? <span className="mcd-art">{typeof MsxMmArt === 'function' ? <MsxMmArt m={m} size="100%" thumb={sz === 's'}/> : null}</span> : <span className="mcd-plus" aria-hidden="true">{empty}</span>}
      {fav.length ? <span className="mcd-fav" aria-label={`得意な能力 ${fav.map((k) => MSX_STAT_NAME[k] || k).join('・')}`}>{fav.map((k) => <i key={k}>{MSX_STAT_ICON[k]}</i>)}</span> : null}
      {grade ? <i className="mcd-gd">{grade}</i> : null}
      {m && sz !== 's' ? <span className="mcd-strip"><b className="mcd-nm" style={{ fontSize: `max(9px, min(13cqw, 86cqw / ${Math.max(1, [...name].length)}))` }}>{name}</b></span> : null}
      {m && lv && sz !== 's' ? <small className="mcd-lv">Lv.{lv}</small> : null}
      {slot != null && !lock ? <i className="mcd-slot" aria-label={`編成の${slot}枠目`}>{slot}</i> : null}
      {note && !lock ? <span className="mcd-note">{note}</span> : null}
      {lock ? <span className="mcd-lk">{lock}</span> : null}
      {on ? <i className="mcd-ck" aria-hidden="true">✓</i> : null}
    </span>
    {m && sz === 's' ? <span className="mcd-nms">{name}</span> : null}
    {tag && tag.text ? <span className={`mcd-tag ${tag.kind || ''}`}>{tag.text}</span> : null}
    {num != null && num !== '' ? <span className="mcd-num">{num}</span> : null}
  </>);
  const cls = `mcd ${sz}${on ? ' on' : ''}${lock ? ' lk' : ''}`;
  return onClick
    ? <button type="button" className={cls} disabled={!!lock} onClick={onClick} {...(attrs || {})}><style>{MONSUC_CARD_CSS}</style>{inner}</button>
    : <span className={cls} {...(attrs || {})}><style>{MONSUC_CARD_CSS}</style>{inner}</span>;
}
// 札を並べる升目。's' は5列(小さい横は7列)、'm' は3列(横は6列)。札の幅は升目が決め、札の中の大きさは札の幅で決まる
function MonsucCardGrid({ size = 's', children }) {
  return <div className={`mcd-grid ${size === 'm' ? 'm' : 's'}`}><style>{MONSUC_CARD_CSS}</style>{children}</div>;
}
const MONSUC_CARD_CSS = `
.mcd{position:relative;display:flex;flex-direction:column;align-items:stretch;gap:3px;min-width:0;width:100%;margin:0;padding:0;background:none;border:0;color:#fff;font:inherit;text-align:center;cursor:pointer;container-type:inline-size}
span.mcd{cursor:default}
.mcd:disabled{cursor:default}
.mcd .mcd-f{position:relative;display:block;width:100%;border-radius:8px;overflow:hidden;border:2px solid var(--mcd-c,#6b6597);background:radial-gradient(120% 90% at 50% 30%,#3f3a78 0,#1e1a36 70%);box-shadow:0 2px 0 #0007}
.mcd.s .mcd-f{border-radius:6px}
.mcd.l .mcd-f{border-width:3px;border-radius:12px}
/* 縦長 3:4 はスペーサーで決める(aspect-ratio は対応の弱い端末で高さが付かない) */
.mcd .mcd-f::before{content:'';display:block;padding-top:133.333%}
.mcd .mcd-f.empty{border:0;background:#4a3f2a;box-shadow:inset 0 0 0 2px #0003}
.mcd .mcd-plus{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:28cqw;font-weight:900;color:#fff}
/* 絵は下の帯の上に収める(全身・下合わせ)。帯と重ねないので名前が絵で読めなくならない */
.mcd .mcd-art{position:absolute;left:4%;right:4%;top:6%;bottom:22%}
.mcd .mcd-art .mm-art{display:block;width:100%;height:100%}
.mcd .mcd-art img{width:100%!important;height:100%!important;object-fit:contain;object-position:50% 100%}
.mcd .mcd-strip{position:absolute;left:0;right:0;bottom:0;height:21%;display:flex;align-items:center;justify-content:center;gap:4%;padding:0 5%;background:#0f0d24e6;border-top:1px solid #ffffff22}
.mcd .mcd-nm{min-width:0;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;font-weight:900;font-size:clamp(9px,15cqw,14px);line-height:1.1;letter-spacing:-.02em}
.mcd.s .mcd-art{bottom:5%}
.mcd .mcd-nms{display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:2;overflow:hidden;font-weight:900;font-size:11px;line-height:1.2;word-break:break-all;color:#fff;min-height:2.4em}
.mcd .mcd-slot{position:absolute;left:50%;top:52%;transform:translate(-50%,-50%);display:flex;align-items:center;justify-content:center;width:clamp(20px,30cqw,34px);height:clamp(20px,30cqw,34px);font-style:normal;font-weight:900;font-size:clamp(11px,17cqw,19px);color:#fff;background:#2563eb;border:2px solid #fff;border-radius:50%;box-shadow:0 2px 4px #0008}
.mcd .mcd-note{position:absolute;left:4%;right:4%;top:24%;font-weight:900;font-size:clamp(9px,11cqw,11px);background:#ffffffe6;color:#1e1a36;border-radius:999px;padding:1px 0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.mcd .mcd-lv{position:absolute;right:3%;bottom:23%;line-height:1.3;padding:0 .3em;background:#0f0d24d9;border-radius:6px;font-weight:900;font-size:clamp(9px,11cqw,13px);color:#fde68a}
.mcd .mcd-gd{position:absolute;right:3%;top:3%;font-style:normal;font-weight:900;font-size:clamp(9px,14cqw,15px);line-height:1.35;color:#fff;background:#7c3aed;border:1.5px solid #fde047;border-radius:7px;padding:0 .35em}
.mcd .mcd-fav{position:absolute;left:3%;top:3%;display:flex;flex-direction:column;gap:2px}
.mcd .mcd-fav i{display:flex;align-items:center;justify-content:center;width:clamp(15px,22cqw,26px);height:clamp(15px,22cqw,26px);font-style:normal;font-size:clamp(9px,13cqw,15px);background:#0f0d24d9;border:1.5px solid #fde68a;border-radius:6px}
.mcd .mcd-lk{position:absolute;left:6%;right:6%;top:40%;transform:translateY(-50%);font-weight:900;font-size:clamp(9px,12cqw,12px);background:#0f0d24e6;border-radius:6px;padding:2px 0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.mcd.lk .mcd-art{opacity:.45}
.mcd .mcd-ck{position:absolute;left:3%;bottom:24%;display:flex;align-items:center;justify-content:center;width:clamp(18px,24cqw,28px);height:clamp(18px,24cqw,28px);font-style:normal;font-weight:900;font-size:clamp(11px,15cqw,17px);color:#fff;background:#ec4899;border:2px solid #fff;border-radius:50%}
.mcd.on .mcd-f{border-color:#f472b6;box-shadow:0 0 0 3px #f472b6}
.mcd .mcd-tag{display:block;font-weight:900;font-size:clamp(10px,11cqw,12px);line-height:1.6;border-radius:999px;color:#fff;background:#4f46e5}
.mcd .mcd-tag.friend{background:#e11d48}.mcd .mcd-tag.memo{background:#7c3aed}.mcd .mcd-tag.base{background:#475569}.mcd .mcd-tag.box{background:#2563eb}
.mcd .mcd-num{font-weight:900;font-size:clamp(10px,13cqw,12px);color:#fde68a;line-height:1.1}
.mcd-grid{display:grid;gap:8px 6px;align-content:start;padding:6px 2px}
.mcd-grid.s{grid-template-columns:repeat(5,minmax(0,1fr))}
.mcd-grid.m{grid-template-columns:repeat(3,minmax(0,1fr));gap:10px 8px}
@media (orientation:landscape){.mcd-grid.s{grid-template-columns:repeat(7,minmax(0,1fr))}.mcd-grid.m{grid-template-columns:repeat(6,minmax(0,1fr))}}
`;

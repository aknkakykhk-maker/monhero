// ===== モンヒロサクセス: 自分で操作するバトル(手番ごとに手を選ぶ帯)=====
// 2026-11-12 社長「モンサクは自分操作にして」(台帳 #5751)・「ガッツを消費して戦う。ターンごとに攻撃したり防御したり移動したりガッツ回復したり」。
// 計算は芯 ASSISTANT_MASMON_BATTLE.createMatch(docs/spec/ASSISTANT_MASMON_BATTLE.md「自分で操作する試合」)。
// ここは画面の部品だけ: 試合を進める useMsxManualMatch と、4つの見出し(攻撃・防御・移動・ガッツ回復)+交代の帯 MsxManualBar。
// 観戦の画面(ambwFramesOf・AmbwPanel)は m.log をそのまま読める。保存は「種+手の列(choices)」だけで足りる(replay で同じ所まで進む)。
// 公開の印 monheroSuccess(偽)の後ろで使う。この部品は単独では画面に出ない。
const MSX_MANUAL_DIST = ['零', '近', '中', '遠'];
const MSA_TN_CSS = `.msa-tn{display:block;white-space:normal;word-break:keep-all;overflow-wrap:normal;line-height:1.15;min-width:0}.msa-tn-s{white-space:nowrap}.msa-tn-brk .msa-tn-s{white-space:normal;overflow-wrap:anywhere}`;
const MSX_MANUAL_CSS = `
.msxm{background:#1e1a36;border:1px solid #f472b6aa;border-radius:14px;padding:6px 8px;margin-top:4px;color:#fff;font-weight:700}
.msxm-top{display:flex;align-items:center;gap:8px;font-size:12px;color:#f9a8d4}
.msxm-top b{color:#fff}
.msxm-g{flex:1;height:8px;border-radius:8px;background:#334155;overflow:hidden}.msxm-g i{display:block;height:100%;background:linear-gradient(90deg,#fde047,#facc15)}
.msxm-sec{margin-top:5px}
.msxm-h{font-size:11.5px;color:#cbd5e1;margin-bottom:2px}
.msxm-row{display:flex;flex-wrap:wrap;gap:6px}
.msxm-row.r3{flex-wrap:nowrap;margin-top:5px;gap:5px}.msxm-row.r3 .msxm-btn{flex:1 1 0;min-width:0;text-align:center;padding:4px 3px;font-size:12.5px}.msxm-row.r3 .msxm-btn small .nw{display:inline-block}.msxm-row.r3 .msxm-btn small{font-size:9.5px;white-space:normal;word-break:keep-all;overflow-wrap:anywhere;letter-spacing:-.02em;line-height:1.12}
.msxm-row.gc .msxm-btn{text-align:center}
.msxm-btn{flex:1 1 46%;min-height:44px;border-radius:11px;border:1px solid #4c4680;background:#2b2650;color:#fff;font-weight:900;font-size:13px;padding:5px 8px;text-align:left;line-height:1.25}
.msxm-btn small{display:block;font-size:10.5px;color:#cbd5e1;font-weight:700}
.msxm-nm{margin-bottom:1px}
${MSA_TN_CSS}
.msxm-btn:disabled{opacity:.38}
.msxm-btn.hint{border-color:#fde047;box-shadow:0 0 0 1px #fde04766 inset}
.msxm-btn.atk{background:#3a2448;border-color:#f472b6aa}
.msxm-btn.far{background:#221d3d;border-style:dashed}
.msxm-btn small.p{color:#fde68a}
.msxm-none{font-size:11px;color:#94a3b8}
.msxm-foot{display:flex;justify-content:space-between;align-items:center;margin-top:4px;gap:8px}
.msxm.busy .msxm-sec{opacity:.5}
.msxm-auto{border-radius:99px;border:1px solid #64748b;background:#0f172a;color:#e2e8f0;font-size:12px;padding:5px 12px;font-weight:900}
.msxm-swap{font-size:11px}
.msxm-all{border-radius:99px;border:1px solid #64748b;background:#0f172a;color:#e2e8f0;font-size:11px;padding:3px 10px;font-weight:900}
`;

// ---- 技名を切らずに見せる(2026-11-13 社長「技名の途中切れが気になる」) ----
//   言葉の切れ目(カタカナ・ひらがな・漢字・英数の変わり目と「・」の後。漢字→ひらがなの送りがなは切らない)でだけ折り返す。
//   1つの言葉が札に入りきらないときは、その札の字だけを小さくする(msaFitTechNames)
const msaTechNameParts = (name) => {
  const t = String(name || ''); const cls = (ch) => (/[\u30A0-\u30FF]/.test(ch) ? 'k' : /[\u3040-\u309F]/.test(ch) ? 'h' : /[\u4E00-\u9FFF\u3005]/.test(ch) ? 'c' : /[A-Za-z0-9'’]/.test(ch) ? 'l' : 'o');
  const out = []; let cur = '', prev = '';
  for (const ch of t) {
    const c = ch === '・' ? 'o' : cls(ch);
    const cut = cur && (prev === '・' || (c !== 'o' && prev && cls(prev) !== c && cls(prev) !== 'o' && !(cls(prev) === 'c' && c === 'h')));
    if (cut) { out.push(cur); cur = ''; }
    cur += ch; prev = ch;
  }
  if (cur) out.push(cur);
  return out;
};
// 言葉の幅の目安(字の大きさ1つ分=1)。全角は1・半角の英数は0.62。絵文字のアイコンは1.3(iPhone の絵文字は広い)
const msaTnEm = (str) => [...String(str || '')].reduce((n, ch) => n + (/[\x20-\x7E]/.test(ch) ? 0.62 : 1), 0);
// いちばん長い言葉の幅(先頭の言葉はアイコンと同じ行に並ぶので、アイコンの幅も足す)
const msaTnWidest = (parts, icon) => Math.max(1, ...parts.map((p, i) => msaTnEm(p) + (i === 0 && icon ? 1.3 : 0))) + 0.2;
function MsaTechName({ name, icon = '', className = '' }) {
  const parts = msaTechNameParts(name);
  return (
    <span className={`msa-tn ${className}`} data-msa-tn style={{ '--tnw': msaTnWidest(parts, icon).toFixed(2) }}>
      {icon ? <span className="msa-tn-s">{icon}</span> : null}
      {parts.map((p, i) => <React.Fragment key={i}>{i ? <wbr/> : null}<span className="msa-tn-s">{p}</span></React.Fragment>)}
    </span>
  );
}
// 画面の技名の札で、入りきらない言葉があれば字を 0.5px ずつ小さくする(最低 10px まで。Issue #6807 UI-5: それ以上は小さくせず、言葉の中で折って全文見せる)
const msaFitTechNames = () => {
  try {
    // 字(フォント)が遅れて読み込まれると幅が変わるので、そのあとと、画面の向き・大きさが変わったときにも縮め直す(2026-11-14 社長「札から字がはみ出す」)
    if (typeof window !== 'undefined' && !window.__msaFitHooked) {
      window.__msaFitHooked = true;
      if (document.fonts && document.fonts.addEventListener) document.fonts.addEventListener('loadingdone', () => msaFitTechNames());
      window.addEventListener('resize', () => msaFitTechNames());
    }
    document.querySelectorAll('[data-msa-tn]').forEach((el) => {
      el.style.fontSize = '';
      el.classList.remove('msa-tn-brk');
      let fs = parseFloat(getComputedStyle(el).fontSize) || 12, n = 0;
      while (el.scrollWidth > el.clientWidth + 0.5 && fs > 10 && n++ < 12) { fs -= 0.5; el.style.fontSize = `${fs}px`; }
      // 最低の大きさでも1つの言葉が入りきらないときは、切って隠さず、その言葉の中で折って全文見せる
      if (el.scrollWidth > el.clientWidth + 0.5) el.classList.add('msa-tn-brk');
    });
  } catch (_) {}
};

// ---- 技の札(間合いごとに1枚・2026-11-13 社長「技の札は間合いごとに1つずつ」「押したら必ずその間合いの一覧」) ----
//   技の形はそろえて渡す: { id, name, kind('pow'|'int'), guts, dist:[届く間合い], hit(命中の目安 0〜100), power(威力), base?(技表の元の数 power・hit・gd・crit。性能の段) }
//   代表の技: 決めた技(chosen[d])がその間合いで届けばそれ。決めていない・覚えていない・届かないときは
//   「命中×威力」がいちばん大きい技(同じならガッツの軽いほう・それも同じなら並びの先)。
const MSA_DC_DIST = ['零', '近', '中', '遠'];
const msaTechsAt = (list, d) => (Array.isArray(list) ? list : []).filter((t) => t && Array.isArray(t.dist) && t.dist.includes(d));
const msaRepScore = (t) => (Number(t.hit) || 0) * (Number(t.power) || 0);
const msaRepOf = (list, d, chosenId) => {
  const at = msaTechsAt(list, d);
  if (!at.length) return null;
  const c = typeof chosenId === 'string' ? at.find((t) => t.id === chosenId) : null;
  if (c) return c;
  let best = at[0];
  for (const t of at) { const a = msaRepScore(t), b = msaRepScore(best); if (a > b || (a === b && (Number(t.guts) || 0) < (Number(best.guts) || 0))) best = t; }
  return best;
};
// [零, 近, 中, 遠] の代表の技 id(届く技が無い間合いは null)
const msaRepIds = (list, chosen) => [0, 1, 2, 3].map((d) => { const t = msaRepOf(list, d, Array.isArray(chosen) ? chosen[d] : null); return t ? t.id : null; });
// 一覧の並び: 代表をいちばん上、あとは 命中×威力 の大きい順
const msaSheetOrder = (list, d, repId) => msaTechsAt(list, d).slice().sort((a, b) => (a.id === repId ? -1 : b.id === repId ? 1 : msaRepScore(b) - msaRepScore(a) || (a.guts - b.guts)));
const MSA_DC_CSS = `
.msa-dc{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:4px}
/* 幅360未満は2列×2段(1語の長い技名が4列の札に入りきらない。技名は言葉の途中で折らない) */
@media (max-width:359.98px){.msa-dc{grid-template-columns:repeat(2,minmax(0,1fr))}.msa-dc-c{min-height:52px}}
.msa-dc-c{container-type:inline-size;position:relative;overflow:hidden;min-width:0;min-height:58px;border-radius:10px;border:1px solid #4c4680;background:#1b1733;color:#94a3b8;font-weight:800;font-size:10.5px;padding:3px 4px 4px;text-align:left;line-height:1.2;font-family:inherit;display:flex;flex-direction:column;gap:1px}
.msa-dc-c .msa-dc-h{display:flex;align-items:center;gap:3px;font-size:10px;color:#a5b4fc}
.msa-dc-c .msa-dc-h em{font-style:normal;font-size:9px;background:#fde047;color:#422006;border-radius:6px;padding:0 4px;font-weight:900}
.msa-dc-c .msa-dc-h i{font-style:normal;margin-left:auto;font-size:9px;color:#94a3b8}
.msa-dc-c small{display:block;font-size:9.5px;color:#cbd5e1;white-space:nowrap;overflow:hidden}
.msa-dc-c small.p{color:#fde68a;font-weight:900}
.msa-dc-c small.mv{color:#7dd3fc;font-size:9px;letter-spacing:-.02em}
/* 技の札の技名は、一番長い言葉(--tnw 字ぶん)が札の幅に入る大きさまで CSS で縮める(2026-11-15 r1115-049 iPhone で「デュアルスラッ」と切れた。JS の縮め直しより先に効く) */
@supports (width:1cqw){.msa-dc-c .msa-tn{font-size:max(10px,min(10.5px,calc(100cqw / var(--tnw,1))))}}
.msa-dc-c.now{border-color:#fde047;box-shadow:0 0 0 1px #fde04788 inset;background:#2d2650;color:#fff}
.msa-dc-c.far{opacity:.55}
.msa-dc-c.ng small.p{color:#fca5a5}
/* 案A(2026-11-15 社長 r1115-074・184・185): 2列×2段の横長の札。左に技の絵、右に技名と性能の2行。モンサクの試合で使う(look="a") */
.msa-dc.a{grid-template-columns:repeat(2,minmax(0,1fr));gap:5px}
.msa-dc.a .msa-dc-c{display:grid;grid-template-columns:34px minmax(0,1fr);column-gap:6px;row-gap:1px;align-items:center;min-height:44px;padding:2px 5px}
.msa-dc.a .msa-dc-c.none{display:block}
.msa-dc.a .msa-dc-ic{grid-row:1/span 4;position:relative;width:34px;height:34px;border-radius:9px;overflow:hidden;align-self:center;box-shadow:0 0 0 2px #f59e0b}
.msa-dc.a .msa-dc-ic.wise{box-shadow:0 0 0 2px #22c55e}
.msa-dc.a .msa-dc-ic .tg-img{width:100%;height:100%;display:block}
.msa-dc.a .msa-dc-ic .k{position:absolute;right:0;bottom:0;font-style:normal;font-size:11px;line-height:1;padding:2px 2px 1px 3px;border-radius:6px 0 0 0;background:#1b1733}
.msa-dc.a .msa-dc-ic .mv{position:absolute;left:0;top:0;font-style:normal;font-size:8.5px;font-weight:900;line-height:1.3;color:#fff;background:#0ea5e9;border-radius:0 0 6px 0;padding:0 3px;white-space:nowrap}
.msa-dc.a .msa-dc-ic .mv.kb{background:#f97316}
.msa-dc.a .msa-dc-h,.msa-dc.a .msa-tn,.msa-dc.a .msa-dc-l{grid-column:2;min-width:0}
.msa-dc.a .msa-tn{font-size:12px;line-height:1.15}
@supports (width:1cqw){.msa-dc.a .msa-dc-c .msa-tn{font-size:max(10px,min(12px,calc((100cqw - 50px) / var(--tnw,1))))}}
.msa-dc.a .msa-dc-l{display:block;white-space:normal;word-break:keep-all;overflow-wrap:anywhere;line-height:1.25;letter-spacing:-.01em;font-size:10px;color:#fde68a;font-weight:900}
.msa-dc.a .msa-dc-l.g{font-size:9.5px;color:#cbd5e1;font-weight:800}
.msa-dc.a .msa-dc-l.g b{color:#fff}
.msa-dc.a .msa-dc-c.ng .msa-dc-l{color:#fca5a5}
.msa-dc.a .msa-dc-c.far{opacity:.55}
.msa-dc-c.use{background:#fde047;color:#422006;border-color:#fde047;opacity:1}
.msa-dc-c.use small,.msa-dc-c.use small.p,.msa-dc-c.use .msa-dc-h{color:#422006}
.msa-dc-c.hint{outline:2px solid #fde047;outline-offset:1px}
.msa-dc-c:disabled{opacity:.35}
.msa-dc-none{font-size:10px;color:#64748b}
.msa-sh{position:fixed;inset:0;z-index:9650;background:#000a;display:flex;align-items:flex-end;justify-content:center}
.msa-sh-in{width:100%;max-width:460px;max-height:78vh;overflow-y:auto;background:#1e1a36;border-radius:16px 16px 0 0;padding:12px 12px max(14px,env(safe-area-inset-bottom));color:#fff;font-weight:700}
.msa-sh-top{display:flex;justify-content:space-between;align-items:center;gap:8px}
.msa-sh-top b{font-size:14px;min-width:0}
.msa-sh-x{flex:none;border-radius:99px;border:1px solid #64748b;background:#0f172a;color:#e2e8f0;font-size:12px;padding:5px 14px;font-weight:900;font-family:inherit}
.msa-sh-note{font-size:11px;color:#cbd5e1;margin:4px 0 2px}
.msa-sh-row{display:flex;align-items:center;gap:6px;padding:6px 0;border-top:1px dashed rgba(255,255,255,.12)}
.msa-sh-row.rep{background:#fde04712;border-radius:8px}
.msa-sh-use{flex:1;min-width:0;text-align:left;border:1px solid #4c4680;background:#2b2650;color:#fff;border-radius:10px;padding:5px 8px;font-weight:900;font-size:12.5px;font-family:inherit;line-height:1.25}
.msa-sh-use.view{background:transparent;border-color:transparent;padding-left:2px}
.msa-sh-use.hint{border-color:#fde047}
.msa-sh-use:disabled{opacity:.45}
.msa-sh-use.view:disabled{opacity:1}
.msa-sh-use small{display:block;font-size:10.5px;color:#cbd5e1;font-weight:700}
.msa-sh-use small.p{color:#fde68a}
.msa-tg{display:flex;flex-wrap:wrap;gap:3px 8px;margin:2px 0 1px;font-size:10.5px;color:#cbd5e1;font-weight:800}
.msa-tg-i{white-space:nowrap}.msa-tg-i b{display:inline-block;min-width:14px;margin-left:3px;text-align:center;font-weight:900;color:#e2e8f0}
.msa-tg-i b,.msa-dc-c small.dmg b{color:#94a3b8}
.msa-tg-i.gSS b,.msa-dc-c small.dmg b.gSS{background:linear-gradient(90deg,#f472b6,#fde047,#4ade80,#60a5fa,#c084fc);-webkit-background-clip:text;background-clip:text;color:transparent;text-shadow:0 0 6px #fde04755}
.msa-tg-i.gS b,.msa-dc-c small.dmg b.gS{color:#fde047}.msa-tg-i.gA b,.msa-dc-c small.dmg b.gA{color:#fb923c}.msa-tg-i.gB b,.msa-dc-c small.dmg b.gB{color:#86efac}.msa-tg-i.gC b,.msa-dc-c small.dmg b.gC{color:#e2e8f0}
.msa-dc-c small.dmg b{margin-left:2px}
.msa-sh-rep{flex:none;border-radius:99px;border:1px solid #a78bfa;background:#1e1b4b;color:#ddd6fe;font-size:11px;padding:5px 9px;font-weight:900;font-family:inherit;white-space:nowrap}
.msa-sh-rep.on{border-color:#fde047;background:#3b2f0b;color:#fde047}
${MSA_TN_CSS}
`;
// 技の性能の段(2026-11-13 社長「MF みたいにダメージ・命中・ガッツダウン・クリティカルを文字の段で。消費ガッツは数値・実際の命中率は計算から数値で」)
//   技表の元の数(base: power・hit(命中の補正)・gd・crit)を G〜SS の9段に(社長「最低は G、上は SS まで」)。
//   区切りは技表 第2版(ガッツダウンを強くした版・battle/msa-orig-techs 8c2c7ae2 の tuned-draft)の全515技の分布(下から 5%・12%・22%・36%・52%・70%・86%・97% にいちばん近い値の境目。SS は上位3%ほど)。
//   作り直し: node tools/masmon-battle/masmon-tech-grades.js。ガッツダウンが 0 の技は「−」
const MSA_TECH_GRADE_CUTS = Object.freeze({ power: [8, 11, 16, 21, 26, 33, 39, 51], hit: [-21, -18, -12, -8, -2, 2, 8, 13], gd: [3, 6, 8, 10, 12, 16, 21, 27], crit: [7, 8, 9, 11, 12, 18, 19, 26] });
const MSA_TECH_GRADES = ['G', 'F', 'E', 'D', 'C', 'B', 'A', 'S', 'SS'];
const msaTechGrade = (key, v) => {
  const c = MSA_TECH_GRADE_CUTS[key], n = Number(v);
  if (!c || !Number.isFinite(n)) return '';
  if (key === 'gd' && n <= 0) return '−';
  let i = 0; while (i < c.length && n >= c[i]) i++;
  return MSA_TECH_GRADES[i];
};
const MSA_TECH_GRADE_ROWS = [['power', 'ダメージ'], ['hit', '命中'], ['gd', 'ガッツダウン'], ['crit', 'クリティカル']];
function MsaTechGrades({ base }) {
  if (!base) return null;
  return (
    <span className="msa-tg" data-msa-tg>{MSA_TECH_GRADE_ROWS.map(([k, label]) => {
      const g = msaTechGrade(k, base[k]);
      return <span key={k} className={`msa-tg-i g${g === '−' ? 'x' : g}`}>{label}<b>{g || '−'}</b></span>;
    })}</span>
  );
}
const msaKindIcon = (t) => (t && t.kind === 'pow' ? '🏋️' : '📖');
// 4枚の札。dist … いまの間合い(無ければどれも「いま」にしない)/guts … いまのガッツ(足りない札は命中を赤く)
//   hitAt(t, d) … その間合いで撃つ前の命中%(無ければ t.hit)/lastMove … いま使った技(その札を光らせる)/hintId … 助手のおすすめの技
//   onOpen(d) … 押したら一覧(無ければ見るだけの札)
// look='a' … 案A(2列×2段・技の絵・性能の2行。モンサクの試合)。無ければ今までの4列の札
function MsaDistCards({ list, rep, dist = null, guts = null, hitAt = null, lastMove = null, hintId = null, onOpen = null, busy = false, dataSide = '', look = '' }) {
  useEffect(() => { msaFitTechNames(); });
  const ids = Array.isArray(rep) && rep.length === 4 ? rep : msaRepIds(list, null);
  return (
    <div className={`msa-dc ${look === 'a' ? 'a' : ''}`} data-msa-dc={dataSide || ''} data-msa-dc-look={look || ''}><style>{MSA_DC_CSS}</style>
      {[0, 1, 2, 3].map((d) => {
        const at = msaTechsAt(list, d);
        // いまの間合いで、代表でない技を使ったときは、その技を札に出す(観戦で何を撃ったか分かるように)
        const used = lastMove && d === dist ? at.find((t) => t.id === lastMove) : null;
        const t = used || at.find((x) => x.id === ids[d]) || msaRepOf(list, d, null);
        const now = dist === d, hp = t ? (hitAt ? hitAt(t, d) : t.hit) : null;
        const ng = t && Number.isFinite(guts) && guts < t.guts;
        const cls = `msa-dc-c ${now ? 'now' : dist == null ? '' : 'far'} ${used ? 'use' : ''} ${ng ? 'ng' : ''} ${t && now && hintId && at.some((x) => x.id === hintId) ? 'hint' : ''} ${t ? '' : 'none'}`;
        if (look === 'a') {
          // 案A: 絵(ちから=金・かしこさ=緑のふち、右下に 🏋️/📖、使ったあと動く技は左上に ↪零=自分が移る/💨遠=相手を飛ばす)・技名・「命中率○%・消ガ○」・「ダメ○・命○・ガ○・クリ○」(段は技の欄と同じ)
          const b = t && t.base ? t.base : null;
          const mvTo = t && Number.isInteger(t.moveTo) ? t.moveTo : null;
          const kb = mvTo != null && Array.isArray(t.dist) && t.dist.length && mvTo > Math.min(...t.dist);
          return (
            <button key={d} type="button" className={cls} data-msa-dc-card={d} data-msa-dc-rep={t ? t.id : ''} disabled={!t || busy || !onOpen} onClick={() => { if (onOpen && t && !busy) onOpen(d); }}>
              {t ? <span className={`msa-dc-ic ${t.kind === 'wise' ? 'wise' : 'pow'}`} aria-hidden="true">{typeof MsxSkillArt === 'function' ? <MsxSkillArt t={t} uid={`dc${dataSide}${d}`}/> : null}<i className="k">{t.kind === 'wise' ? '📖' : '🏋️'}</i>{mvTo != null ? <i className={`mv ${kb ? 'kb' : ''}`} data-msa-dc-move={mvTo}>{kb ? '💨' : '↪'}{MSA_DC_DIST[mvTo]}</i> : null}</span> : null}
              <span className="msa-dc-h">{MSA_DC_DIST[d]}{now ? <em>いま</em> : null}<i>{at.length ? `${at.length}技` : ''}</i></span>
              {t ? <MsaTechName name={t.name}/> : <span className="msa-dc-none">届く技なし</span>}
              {t ? <span className="msa-dc-l" data-msa-dc-l1>{dist != null && !now ? (Array.isArray(t.dist) && t.dist.length === 1 ? `${MSA_DC_DIST[t.dist[0]]}でのみ届く` : `届く間合い: ${(Array.isArray(t.dist) ? t.dist : []).map((x) => MSA_DC_DIST[x]).join('・')}`) : `命中率${Number.isFinite(hp) ? Math.round(hp) : '—'}%・\u200b消ガ${t.guts}`}</span> : null}
              {b ? <span className="msa-dc-l g" data-msa-dc-l2>ダメ<b>{msaTechGrade('power', b.power)}</b>・命<b>{msaTechGrade('hit', b.hit)}</b>・{'\u200b'}ガ<b>{msaTechGrade('gd', b.gd)}</b>・クリ<b>{msaTechGrade('crit', b.crit)}</b></span> : null}
            </button>
          );
        }
        return (
          <button key={d} type="button" className={cls} data-msa-dc-card={d} data-msa-dc-rep={t ? t.id : ''} disabled={!t || busy || !onOpen} onClick={() => { if (onOpen && t && !busy) onOpen(d); }}>
            <span className="msa-dc-h">{MSA_DC_DIST[d]}{now ? <em>いま</em> : null}<i>{at.length ? `${at.length}技` : ''}</i></span>
            {t ? <MsaTechName name={t.name} icon={msaKindIcon(t)}/> : <span className="msa-dc-none">届く技なし</span>}
            {t ? <small className="p">{Number.isFinite(hp) ? `命中 ${Math.round(hp)}%` : '命中 —'}</small> : null}
            {t ? <small>ガッツ {t.guts}</small> : null}
            {t && t.base ? (() => { const g = msaTechGrade('power', t.base.power); return <small className="dmg">ダメージ<b className={`g${g}`}>{g}</b></small>; })() : null}
            {t && typeof msxTechMoveTxt === 'function' && msxTechMoveTxt(t) ? <small className="mv" data-msa-dc-move={t.moveTo} title={`使ったあと ${msxTechMoveTxt(t).replace(/\u200b/g, '')}`}>↪ {msxTechMoveTxt(t).replace(/\u200b/g, '')}</small> : null}
          </button>
        );
      })}
    </div>
  );
}
// 間合い d の一覧(d が null なら全部の技)。いちばん上が代表の技。
//   onUse(t) … 押して使う(自分の手番で、いまの間合いの一覧のときだけ渡す)。usable(t) … 押せるか/useNote(t) … 押せないときの添え書き
//   onRep(d, id) … 「☆ 代表にする」(渡したときだけ出す)/hintId … 助手のおすすめ
function MsaTechSheet({ title, list, d = null, dist = null, rep = null, hitAt = null, onUse = null, usable = null, useNote = null, onRep = null, hintId = null, onClose }) {
  useEffect(() => { if (typeof msaFitTechNames === 'function') msaFitTechNames(); });
  const ids = Array.isArray(rep) && rep.length === 4 ? rep : msaRepIds(list, null);
  const repId = d == null ? null : ids[d];
  const rows = d == null ? (Array.isArray(list) ? list.slice() : []).sort((a, b) => (dist != null ? (b.dist.includes(dist) ? 1 : 0) - (a.dist.includes(dist) ? 1 : 0) : 0)) : msaSheetOrder(list, d, repId);
  const distOf = (t) => (Array.isArray(t.dist) ? t.dist.map((x) => MSA_DC_DIST[x]).join('・') : '');
  const note = d == null ? (dist != null ? `いまの間合い: ${MSA_DC_DIST[dist]}・届く技を先に並べています` : 'このモンスターの技')
    : onUse ? '一番上が代表の技。押した技を使います' : `一番上が代表の技${dist != null && d !== dist ? `(いまの間合いは ${MSA_DC_DIST[dist]})` : ''}`;
  return (
    <div className="msa-sh" data-msa-sheet={d == null ? 'all' : d} onClick={onClose}><style>{MSA_DC_CSS}</style>
      <div className="msa-sh-in" onClick={(ev) => ev.stopPropagation()}>
        <div className="msa-sh-top"><b>{title}</b><button type="button" className="msa-sh-x" data-msa-sheet-close onClick={onClose}>閉じる</button></div>
        <p className="msa-sh-note">{note}</p>
        {rows.map((t) => {
          const hd = d == null ? (dist != null && t.dist.includes(dist) ? dist : t.dist[0]) : d;
          const hp = hitAt ? hitAt(t, hd) : t.hit;
          const can = !!onUse && (!usable || usable(t));
          const isRep = d != null && t.id === repId;
          return (
            <div key={t.id} className={`msa-sh-row ${isRep ? 'rep' : ''}`} data-msa-sheet-row={t.id}>
              <button type="button" className={`msa-sh-use ${onUse ? '' : 'view'} ${hintId === t.id ? 'hint' : ''}`} disabled={!can} data-msxm-tech={onUse ? t.id : undefined}
                onClick={() => { if (can) onUse(t); }}>
                <MsaTechName name={t.name} icon={`${isRep ? '★ ' : ''}${msaKindIcon(t)}`}/>
                <MsaTechGrades base={t.base}/>
                <small className="p">{Number.isFinite(hp) ? `命中 ${Math.round(hp)}%` : '命中 —'}・ガッツ {t.guts}{!t.base && Number.isFinite(t.power) ? `・威力 ${Math.round(t.power)}` : ''}{onUse && useNote && !can ? useNote(t) : ''}</small>
                <small>届く {distOf(t)}{typeof msxTechMoveTxt === 'function' && msxTechMoveTxt(t) ? `・使ったあと ${msxTechMoveTxt(t)}` : ''}</small>
              </button>
              {onRep && d != null ? (isRep ? <span className="msa-sh-rep on" data-msa-rep-on={t.id}>★ 代表</span>
                : <button type="button" className="msa-sh-rep" data-msa-rep={t.id} onClick={() => onRep(d, t.id)}>☆ 代表にする</button>) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// 試合を作る(手の列があれば、その所まで進めた試合)。芯が無い・古いときは null
const msxManualOpen = (engine, input, choices) => {
  if (!engine || typeof engine.createMatch !== 'function' || !input) return null;
  try {
    const inp = { ...input, control: { A: 'human' } };
    if (Array.isArray(choices) && choices.length && typeof engine.replay === 'function') {
      const r = engine.replay(inp, choices);
      return r && r.match ? r.match : null;   // 途中で合わない手があっても、合う所までは進んでいる
    }
    return engine.createMatch(inp);
  } catch (e) { return null; }
};

// 進め方のフック。input が変わったら作り直す(key で渡す)
function useMsxManualMatch(engine, input, choices, key) {
  const [match, setMatch] = useState(null);
  const [tick, setTick] = useState(0);
  useEffect(() => { setMatch(msxManualOpen(engine, input, choices)); setTick(0); }, [engine, key]); // eslint-disable-line react-hooks/exhaustive-deps
  const pick = useCallback((c) => {
    if (!match) return false;
    const r = match.choose(c);
    if (r && r.ok) setTick((t) => t + 1);
    return !!(r && r.ok);
  }, [match]);
  const toAuto = useCallback(() => { if (!match) return; match.auto('A'); setTick((t) => t + 1); }, [match]);
  const log = match ? match.log.slice() : [];
  return { match, tick, log, pending: match ? match.pending() : null, done: !!(match && match.done()), result: match ? match.result() : null,
    choices: match ? match.choices() : [], pick, toAuto };
}

// 手を選ぶ帯。opt = match.pending()。busy の間(相手の手を見せている間)は押せない
//   技は間合いごとの4枚の札(2026-11-13 社長)。札を押すと必ずその間合いの一覧が開き、いまの間合いの一覧なら押した技を使う。
//   rep … [零,近,中,遠] の代表の技 id(決めていない所は null。無ければ 命中×威力 で決める)
//   onRep(d, id) … 一覧の「☆ 代表にする」を押したとき(保存は呼ぶ側。β は mh_assistant_masmon_battle_v1・モンサクはモンサク側)
//   title … 一覧の見出しに出す名前/sheetInit … 最初から開いておく一覧(検査用: 0〜3 か 'all')
const msxTechItems = (opt) => (opt && Array.isArray(opt.tech) ? opt.tech : []).map((t) => ({ ...t, id: t.key, hit: Number.isFinite(t.p) ? t.p : 0, power: Number.isFinite(t.power) ? t.power : 1 }));
function MsxManualBar({ opt, onPick, onAuto, busy, rep = null, onRep = null, title = '', sheetInit = null, look = '' }) {
  const [sheet, setSheet] = useState(sheetInit);
  useEffect(() => { msaFitTechNames(); });
  if (!opt) return null;
  const isHint = (c) => !!(opt.hint && opt.hint.type === c.type && (c.key == null || opt.hint.key === c.key) && (c.step == null || opt.hint.step === c.step) && (c.to == null || opt.hint.to === c.to));
  const go = (c) => { if (!busy && onPick) onPick(c); };
  if (opt.kind === 'enter') {
    return (
      <div className="msxm" data-msxm="enter"><style>{MSX_MANUAL_CSS}</style>
        <div className="msxm-h">次に出すモンスターを選んでください</div>
        <div className="msxm-row">{opt.enter.map((x) => (
          <button key={x.to} type="button" className="msxm-btn" disabled={!x.ok || busy} onClick={() => go({ type: 'enter', to: x.to })}>
            {x.name}<small>ライフ {x.hp}/{x.maxHp}</small>
          </button>
        ))}</div>
      </div>
    );
  }
  // 撃つ前の命中%・使うガッツを札と一覧に出す(2026-11-12 社長「命中も技打つ前の技コマンドに出してほしい」)。間合いごとの命中は芯の pd
  const items = msxTechItems(opt);
  const ids = msaRepIds(items, rep);
  const hitAt = (t, d) => (Array.isArray(t.pd) && Number.isFinite(t.pd[d]) ? t.pd[d] : t.hit);
  const hintId = opt.hint && opt.hint.type === 'tech' ? opt.hint.key : null;
  const reachN = items.filter((t) => t.reach).length;
  const sheetOn = sheet != null && (sheet === 'all' || msaTechsAt(items, sheet).length > 0);
  const sd = sheet === 'all' ? null : sheet;
  const useHere = !busy && (sd == null || sd === opt.dist);
  return (
    <div className={`msxm${busy ? ' busy' : ''}`} data-msxm="act"><style>{MSX_MANUAL_CSS}</style>
      <div className="msxm-top">
        <span>{busy ? '相手の番…' : 'あなたの番'}</span>
        <b>間合い {MSX_MANUAL_DIST[opt.dist]}</b>
        <div className="msxm-g"><i style={{ width: `${Math.max(0, Math.min(100, opt.guts))}%` }}/></div>
        <b>ガッツ {Math.round(opt.guts)}</b>
      </div>
      <div className="msxm-sec">
        <div className="msxm-h" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 6 }}>
          <span>⚔ 攻撃{reachN ? '(技のカードを押して選ぶ)' : '(この間合いの技なし)'}</span>
          {items.length ? <button type="button" className="msxm-all" data-msxm-all onClick={() => setSheet('all')}>📜 全部の技({items.length})</button> : null}
        </div>
        <MsaDistCards list={items} rep={ids} dist={opt.dist} guts={opt.guts} hitAt={hitAt} hintId={hintId} busy={busy} onOpen={(d) => setSheet(d)} dataSide="manual" look={look}/>
      </div>
      {sheetOn ? (
        <MsaTechSheet title={`${title ? `${title} の` : ''}${sd == null ? `技(${items.length})` : `${MSX_MANUAL_DIST[sd]}の技`}`} list={items} d={sd} dist={opt.dist} rep={ids} hitAt={hitAt} hintId={hintId}
          onUse={useHere ? (t) => { setSheet(null); go({ type: 'tech', key: t.id }); } : null}
          usable={(t) => t.ok} useNote={(t) => (!t.reach ? '(いまは届かない)' : `(あと${t.need})`)}
          onRep={onRep && sd != null ? (d, id) => onRep(d, id) : null} onClose={() => setSheet(null)}/>
      ) : null}
      <div className="msxm-sec">
        <div className="msxm-h">🛡 防御・↔ 移動・💪 ガッツ回復{opt.moveCost ? `(移動 ガッツ${opt.moveCost})` : ''}</div>
        <div className="msxm-row gc">
          <button type="button" className={`msxm-btn ${isHint(opt.guard) ? 'hint' : ''}`} disabled={busy} onClick={() => go({ type: 'guard' })}>🛡 ガード<small>次の自分の手番まで守る</small></button>
          <button type="button" className={`msxm-btn ${isHint(opt.charge) ? 'hint' : ''}`} disabled={!opt.charge.ok || busy} onClick={() => go({ type: 'charge' })}>💪 ためる<small>{opt.charge.ok ? (Number.isFinite(opt.charge.add) ? `ガッツ +${opt.charge.add}（${Math.round(opt.guts)}→${opt.charge.after}）` : 'この番は合わせて16回復') : 'ガッツは満タン'}</small></button>
        </div>
        {/* 移動の段(2026-11-15 社長 r1115-193): 横3つ「◀ 後退・💨 吹き飛ばし・前進 ▶」。自分は画面の左・相手は右なので、後退(離れる・step +1)は左、前進(近づく・step −1)は右。
            吹き飛ばし(r1115-110)は零距離だけ選べる。ほかの間合いでも押せない形で並べ、どこで使えるかを出す */}
        <div className="msxm-row r3">
          {(() => {
            const mvBtn = (mv) => (
              <button key={mv.step} type="button" data-msxm-move={mv.step} className={`msxm-btn ${isHint(mv) ? 'hint' : ''}`} disabled={!mv.ok || busy} onClick={() => go({ type: 'move', step: mv.step })}>
                {mv.step < 0 ? '前進 ▶' : '◀ 後退'}<small>{mv.to < 0 || mv.to > 3 ? 'これ以上行けない' : Number.isFinite(mv.guts) ? `${MSX_MANUAL_DIST[mv.to]}へ・\u200bガッツ${mv.guts}${mv.ok ? '' : '(足りない)'}` : `${MSX_MANUAL_DIST[mv.to]}へ`}</small>
              </button>
            );
            const back = opt.move.find((mv) => mv.step > 0); const fwd = opt.move.find((mv) => mv.step < 0);
            const near = !!(opt.blow && opt.blow.near);
            const blow = (
              <button key="blow" type="button" data-msxm-blow={near ? '' : 'far'} className={`msxm-btn ${near && isHint(opt.blow) ? 'hint' : ''}`} disabled={!near || !opt.blow.ok || busy} onClick={() => { if (near) go({ type: 'blow' }); }}>
                💨 吹き飛ばし<small>{!near ? <><span className="nw">零の間合いでのみ</span><span className="nw">使える</span></> : opt.blow.wait ? '相手の次の手のあと' : <><span className="nw">相手の手のあと遠へ・</span><span className="nw">{`ガッツ${opt.blow.guts}${opt.blow.ok ? '' : '(足りない)'}`}</span></>}</small>
              </button>
            );
            return [back ? mvBtn(back) : null, blow, fwd ? mvBtn(fwd) : null];
          })()}
        </div>
      </div>
      {opt.swap.length ? (
        <div className="msxm-sec">
          <div className="msxm-h">🔁 交代{opt.swapWait > 0 ? `(あと${opt.swapWait}手番)` : ''}</div>
          <div className="msxm-row">{opt.swap.map((s) => (
            <button key={s.to} type="button" className={`msxm-btn msxm-swap ${isHint(s) ? 'hint' : ''}`} disabled={!s.ok || busy} onClick={() => go({ type: 'swap', to: s.to })}>
              {s.name}<small>ライフ {s.hp}/{s.maxHp}</small>
            </button>
          ))}</div>
        </div>
      ) : null}
      <div className="msxm-foot">
        <span className="msxm-none">{opt.hint ? '黄色のふちは助手のおすすめ' : ''}</span>
        {onAuto ? <button type="button" className="msxm-auto" onClick={() => !busy && onAuto()}>オートにする</button> : null}
      </div>
    </div>
  );
}

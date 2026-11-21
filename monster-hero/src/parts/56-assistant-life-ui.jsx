// ===== 助手ライフの作り直し 段6: 画面の型(docs/spec/ASSISTANT_LIFE_UI.md・ASSISTANT_LIFE.md §5) =====
// どの画面も同じ型に載せる: 上の帯(← 戻る・題・時刻)/ 下のタブ5つ / 中身 / 窓 / 結果の1枚。
// 字は 見出し16・本文13・注11・数字20 の4段だけ(10px 未満は使わない)。主なボタンは1画面に1つ(120×44px 以上・字13px 以上・桃→橙)。
// PC・横は2段組(左に場面の絵・右に中身)。真ん中に細く寄せない。
// 見た目は .alu の中だけに効く(ほかの画面の CSS は触らない)。保存はしない(読むだけの見る口を使う)。
// 段6では画面にまだ差し込まない(家は段7・部屋は段8・町は段9)。止め絵は tools/assistant/life-ui-shoot.js が見本(AssistantLifeUiSample)を撮る。
const ALU_CSS = `
.alu{position:absolute;inset:0;display:flex;flex-direction:column;overflow:hidden;color:#fff;font-weight:700;font-size:13px;line-height:1.5;
  background:linear-gradient(180deg,#1d1740 0,#151130 45%,#0f0d24 100%);word-break:auto-phrase;-webkit-text-size-adjust:100%}
.alu *{box-sizing:border-box}
.alu button{font:inherit;color:inherit;cursor:pointer}
.alu .alu-h{font-size:16px;font-weight:900;line-height:1.35}
.alu .alu-t{font-size:13px}
.alu .alu-n{font-size:11px;font-weight:700;color:#cbd5e1;line-height:1.45}
.alu .alu-num{font-size:20px;font-weight:900;line-height:1.1;font-variant-numeric:tabular-nums}
.alu .alu-nw{white-space:nowrap}
.alu-top{flex:none;height:48px;display:flex;align-items:center;gap:8px;padding:0 10px;background:#151130;border-bottom:1px solid #3b3566}
.alu-top .bk{flex:none;min-width:72px;height:36px;padding:0 12px;border-radius:999px;background:#2b3348;border:1px solid #475569;font-size:13px;font-weight:900;white-space:nowrap}
.alu-top .ti{flex:1;min-width:0;text-align:center;font-size:16px;font-weight:900;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.alu-top .ck{flex:none;min-width:72px;text-align:right;line-height:1.2}
.alu-top .ck b{display:block;font-size:13px;font-weight:900;white-space:nowrap}
.alu-top .ck small{display:block;font-size:11px;font-weight:700;color:#cbd5e1;white-space:nowrap}
.alu-body{flex:1;min-height:0;display:flex}
.alu-main{flex:1;min-width:0;overflow-y:auto;overflow-x:hidden;padding:10px 12px 12px;display:flex;flex-direction:column;gap:10px;overscroll-behavior:contain}
.alu-scene{flex:none;position:relative;border-radius:14px;overflow:hidden;background:#1e1a36;border:1px solid #3b3566}
.alu[data-alu-wide="1"] .alu-body{gap:12px;padding:12px 12px 0}
.alu[data-alu-wide="1"] .alu-scene{flex:1.35 1 0;min-width:0;align-self:stretch;margin-bottom:12px}
.alu[data-alu-wide="1"] .alu-main{flex:1 1 0;padding:0 0 12px;max-width:560px}
.alu-tabs{flex:none;display:flex;height:56px;background:#151130;border-top:1px solid #3b3566;padding-bottom:env(safe-area-inset-bottom)}
.alu-tabs button{flex:1;min-width:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1px;background:none;border:0;color:#cbd5e1;font-size:11px;font-weight:900;white-space:nowrap}
.alu-tabs button i{font-style:normal;font-size:16px;line-height:1.2}
.alu-tabs button.on{background:linear-gradient(90deg,#f472b6,#fb923c);color:#fff}
.alu-card{background:#1e1a36;border:1px solid #3b3566;border-radius:14px;padding:10px 12px}
.alu-card.gold{border-color:#fde047;background:linear-gradient(180deg,#3b2f12,#1e1a36)}
.alu .alu-go{display:flex;align-items:center;justify-content:center;gap:6px;width:100%;min-width:120px;min-height:52px;padding:8px 14px;border:0;border-radius:999px;
  background:linear-gradient(90deg,#f472b6,#fb923c);box-shadow:0 4px 0 #9d174d66;color:#fff;font-size:16px;font-weight:900;text-align:center;line-height:1.3}
.alu .alu-go:disabled{filter:grayscale(.8);opacity:.6}
.alu .alu-btn{display:inline-flex;align-items:center;justify-content:center;gap:4px;min-height:44px;min-width:64px;padding:6px 12px;border-radius:999px;background:#f8fafc;border:1px solid #cbd5e1;color:#1e1b4b !important;font-size:13px;font-weight:900;white-space:nowrap}
.alu-row{display:flex;align-items:center;gap:10px;min-height:56px}
.alu-row .pic{flex:none;width:44px;height:44px;border-radius:50%;overflow:hidden;background:#312e5a;display:grid;place-items:center;font-size:20px}
.alu-row .tx{flex:1;min-width:0}
.alu-chip{display:inline-flex;align-items:center;gap:3px;border-radius:999px;padding:2px 8px;font-size:11px;font-weight:900;background:#0f172a;border:1px solid #475569;color:#cbd5e1;white-space:nowrap}
.alu-chip.ok{background:#064e3b;border-color:#34d399;color:#a7f3d0}
.alu-goal{display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin-top:6px}
.alu-goal span,.alu .alu-goal button{display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:44px;border-radius:10px;background:#0f172a;border:1px solid #475569;font-size:11px;font-weight:900;color:#cbd5e1;white-space:nowrap}
.alu-goal span.on,.alu .alu-goal button.on{background:#064e3b;border-color:#34d399;color:#fff}
.alu-mask{position:absolute;inset:0;z-index:30;background:rgba(8,6,20,.72);display:flex;align-items:flex-end;justify-content:center}
.alu[data-alu-wide="1"] .alu-mask{align-items:center}
.alu-sheet{position:relative;width:100%;max-width:560px;max-height:88%;display:flex;flex-direction:column;background:#1e1a36;border:1px solid #f472b6aa;border-radius:18px 18px 0 0;box-shadow:0 -8px 24px #0009}
.alu[data-alu-wide="1"] .alu-sheet{border-radius:18px;max-height:92%}
.alu-sheet .sh{flex:none;display:flex;align-items:flex-start;gap:8px;padding:12px 6px 8px 14px;border-bottom:1px solid #3b3566}
.alu-sheet .sh .tt{flex:1;min-width:0}
.alu-sheet .x{flex:none;width:44px;height:44px;margin-top:-6px;border-radius:999px;background:none;border:0;font-size:20px;font-weight:900;color:#e2e8f0}
.alu-sheet .q{flex:none;width:44px;height:44px;margin-top:-6px;border-radius:999px;background:none;border:0;font-size:16px;font-weight:900;color:#cbd5e1}
.alu-sheet .sb{flex:1;min-height:0;overflow-y:auto;padding:10px 14px 14px;display:flex;flex-direction:column;gap:10px}
.alu-sheet .help{background:#0f172a;border-radius:10px;padding:8px 10px}
.alu-gains{display:flex;flex-wrap:wrap;justify-content:center;gap:8px}
.alu-gains>div{min-width:88px;padding:8px 10px;border-radius:12px;background:#0f172a;border:1px solid #475569;text-align:center}
.alu-gains>div b{display:block}
.alu-ph{position:absolute;inset:0;display:grid;place-items:center;text-align:center;padding:12px;color:#94a3b8;
  background:repeating-linear-gradient(135deg,#1e1a36 0 12px,#231e40 12px 24px)}
`;

// 下のタブは5つ。どの画面でも同じ並び・同じ位置(町も下)。キーは今の画面のタブと同じ(段7〜で差し替えやすく)
const ALU_TABS = Object.freeze([
  Object.freeze({ key: 'house', icon: '🏡', label: '家' }),
  Object.freeze({ key: 'where', icon: '🗺', label: '町' }),
  Object.freeze({ key: 'friends', icon: '🤝', label: '友情' }),
  Object.freeze({ key: 'visit', icon: '🏠', label: 'フレンド' }),
  Object.freeze({ key: 'masmon', icon: '🐾', label: 'マスモン' }),
]);
// 2段組にする幅(器の幅で決める。🔄横で回した中でも器の大きさで測る)
const ALU_WIDE_MIN = 700;

// 上の帯の時刻: 「15:00 昼」と「次 16:00」(助手は2時間ごとに動く。ASSISTANT_LIFE_PER_DAY = 12)
const aluClock = (now = Date.now()) => {
  const parts = typeof timeOfDayJstParts === 'function' ? timeOfDayJstParts(now) : { h: new Date(now).getHours(), m: 0 };
  const slot = typeof timeOfDayAt === 'function' ? timeOfDayAt(now) : { label: '' };
  const clock = typeof timeOfDayClockText === 'function' ? timeOfDayClockText(now) : `${parts.h}:${String(parts.m).padStart(2, '0')}`;
  const next = (Math.floor(parts.h / 2) * 2 + 2) % 24;
  return { clock, label: slot.label || '', next: `${next}:00` };
};

// 器の幅を測って2段組かを決める
const useAluWide = () => {
  const ref = React.useRef(null);
  const [box, setBox] = React.useState({ wide: false, h: 0, w: 0 });
  React.useLayoutEffect(() => {
    const el = ref.current; if (!el) return undefined;
    const measure = () => { const w = el.clientWidth, h = el.clientHeight; const wide = w >= ALU_WIDE_MIN && w > h * 1.15; setBox(b => (b.wide === wide && b.h === h && b.w === w ? b : { wide, h, w })); };
    measure();
    if (typeof ResizeObserver === 'undefined') { window.addEventListener('resize', measure); return () => window.removeEventListener('resize', measure); }
    const ro = new ResizeObserver(measure); ro.observe(el); return () => ro.disconnect();
  }, []);
  return [ref, box.wide, box.h, box.w];
};

const AluTopBar = ({ title, onBack, now }) => {
  const c = aluClock(now);
  return (
    <div className="alu-top" data-alu-top>
      <button type="button" className="bk" data-alu-back data-assistant-life-close aria-label="戻る" onClick={onBack}>← 戻る</button>
      <div className="ti" data-alu-title>{title}</div>
      <div className="ck" data-alu-clock><b>{c.clock} {c.label}</b><small>次に動く {c.next}</small></div>
    </div>);
};

// tabs … 並びを替えるときだけ渡す(段12 まで5つ目は「📖 紹介」・2026-11-21 社長 r1119-075 ①)
const AluTabBar = ({ tab, onTab, tabs = ALU_TABS }) => (
  <div className="alu-tabs" role="tablist" data-alu-tabs data-assistant-life-icons>
    {tabs.map(t => (
      <button key={t.key} type="button" role="tab" aria-selected={tab === t.key} className={tab === t.key ? 'on' : ''} data-alu-tab={t.key} data-assistant-life-icon={t.key} onClick={() => onTab && onTab(t.key)}>
        <i>{t.icon}</i>{t.label}
      </button>))}
  </div>);

// 画面の型。head = いちばん上の1枚(家なら「次のごほうびまで」)。scene = 場面の絵(家・部屋・町の地図・関係図)
//   縦: head → 場面の絵 → 中身。場面の絵は画面の高さの3割まで(小さい画面でも主なボタンが最初から見える)
//   2段組(PC・横): 左に場面の絵、右に head → 中身
//   scene に関数を渡すと、枠の大きさ { wide, w, h }(縦の h は使ってよい高さの上限=画面の4割)を受け取って絵を返す(家の絵の幅を高さから決める)
const AluFrame = ({ title, onBack, tab, onTab, tabs, now, head, scene, sceneH = 300, children, overlay, ...rest }) => {
  const [ref, wide, frameH, frameW] = useAluWide();
  const fit = typeof scene === 'function';
  const sceneHeight = frameH ? Math.max(140, Math.min(sceneH, Math.round(frameH * 0.3))) : sceneH;
  // 2段組の左の枠: 中身は 1:1.35 で幅 560px まで(ALU_CSS と同じ数)
  const avail = Math.max(0, frameW - 36), mainW = Math.min(560, avail / 2.35);
  const sceneNode = !scene ? null : !fit ? scene
    : wide ? scene({ wide: true, w: Math.floor(avail - mainW), h: Math.max(0, frameH - 48 - 56 - 24) })
    : scene({ wide: false, w: Math.max(0, frameW - 24), h: Math.max(140, Math.round(frameH * 0.42)) });
  return (
    <div className="alu" ref={ref} data-alu-frame data-alu-wide={wide ? '1' : undefined} {...rest}>
      <style>{ALU_CSS}</style>
      <AluTopBar title={title} onBack={onBack} now={now} />
      <div className="alu-body">
        {wide && scene ? <div className="alu-scene" data-alu-scene>{frameW ? sceneNode : null}</div> : null}
        <div className="alu-main" data-alu-main>
          {head || null}
          {!wide && scene ? <div className="alu-scene" data-alu-scene style={fit ? undefined : { height: sceneHeight }}>{frameW ? sceneNode : null}</div> : null}
          {children}
        </div>
      </div>
      <AluTabBar tab={tab} onTab={onTab} tabs={tabs || ALU_TABS} />
      {overlay}
    </div>);
};

// 主なボタン(1画面に1つ)とほかのボタン(白地の同じ形)
const AluGo = ({ children, onClick, disabled, ...rest }) => <button type="button" className="alu-go" data-alu-go onClick={onClick} disabled={disabled} {...rest}>{children}</button>;
const AluBtn = ({ children, onClick, disabled, ...rest }) => <button type="button" className="alu-btn" onClick={onClick} disabled={disabled} {...rest}>{children}</button>;

// 行: 左に絵・中に1行(+注)・右にボタン1つ
const AluRow = ({ pic, text, note, action }) => (
  <div className="alu-row" data-alu-row>
    <div className="pic">{pic}</div>
    <div className="tx"><div className="alu-t">{text}</div>{note ? <div className="alu-n">{note}</div> : null}</div>
    {action || null}
  </div>);

// 窓: 地は不透明・右上に ✕・上に1行「何が上がるか」・説明は「?」に畳む
const AluSheet = ({ title, gain, help, onClose, children }) => {
  const [open, setOpen] = React.useState(false);
  return (
    <div className="alu-mask" data-alu-mask onClick={(e) => { if (e.target === e.currentTarget && onClose) onClose(); }}>
      <div className="alu-sheet" role="dialog" aria-label={title} data-alu-sheet>
        <div className="sh">
          <div className="tt"><div className="alu-h">{title}</div>{gain ? <div className="alu-n" data-alu-sheet-gain>上がる物: {gain}</div> : null}</div>
          {help ? <button type="button" className="q" aria-label="説明" aria-expanded={open} data-alu-sheet-help onClick={() => setOpen(v => !v)}>?</button> : null}
          <button type="button" className="x" aria-label="閉じる" data-alu-sheet-close onClick={onClose}>✕</button>
        </div>
        <div className="sb">
          {open && help ? <div className="help alu-n" data-alu-sheet-help-text>{help}</div> : null}
          {children}
        </div>
      </div>
    </div>);
};

// 結果の1枚: 見る・話す・贈る・誘うの後に必ず出す。上がった物(数字20px)と「次にすること」1つ
//   gains = [{ icon, label, v }](v は数。+ を付けて出す)/ finds = ['拾い物の名前'] / next = { label, onClick }
const AluResult = ({ title = '結果', line, gains = [], finds = [], next, onClose }) => (
  <AluSheet title={title} onClose={onClose}>
    {line ? <div className="alu-t" data-alu-result-line>{line}</div> : null}
    <div className="alu-gains" data-alu-result-gains>
      {gains.map((g, i) => (
        <div key={i}><span className="alu-n">{g.icon} {g.label}</span><b className="alu-num">+{g.v}</b></div>))}
    </div>
    {finds.length ? <div className="alu-t" data-alu-result-finds>🧺 拾い物: {finds.join('・')}</div> : null}
    {next ? <AluGo onClick={next.onClick} data-alu-result-next>{next.label}</AluGo> : null}
  </AluSheet>);

// 次のごほうびまで(家のいちばん上だけ)
const AluNextReward = ({ rest, text }) => (
  <div className="alu-card gold" data-alu-next-reward>
    <div className="alu-t">💗 次のごほうび{rest != null ? <>まで あと <b className="alu-num">{rest}</b></> : null}</div>
    {text ? <div className="alu-n">{text}</div> : null}
  </div>);

// 今日の目標(段5の見る口 assistantLifeGoalView)
// onKind(kind) … 升を押すとその行動へ(家)。below … 札の下に畳んで足す物(7日のごほうびの帯など)。extra … 注の後ろに足す1行
const AluGoalCard = ({ view, onKind, below, extra }) => {
  const v = view || (typeof assistantLifeGoalView === 'function' ? assistantLifeGoalView() : null);
  if (!v) return null;
  const labels = typeof ASSISTANT_LIFE_GOAL_LABEL !== 'undefined' ? ASSISTANT_LIFE_GOAL_LABEL : {};
  const kinds = typeof ASSISTANT_LIFE_GOAL_KINDS !== 'undefined' ? ASSISTANT_LIFE_GOAL_KINDS : Object.keys(v.done || {});
  return (
    <div className="alu-card" data-alu-goal>
      <div className="alu-t">今日の目標 <b className="alu-num">{Math.min(v.count, v.need)}</b>/{v.need}{v.achieved ? ' ✓ 達成' : ''}</div>
      <div className="alu-goal">
        {kinds.map(k => onKind
          ? <button type="button" key={k} className={v.done && v.done[k] ? 'on' : ''} data-alu-goal-kind={k} onClick={() => onKind(k)}>{v.done && v.done[k] ? '✓ ' : ''}{labels[k] || k}</button>
          : <span key={k} className={v.done && v.done[k] ? 'on' : ''}>{v.done && v.done[k] ? '✓ ' : ''}{labels[k] || k}</span>)}
      </div>
      <div className="alu-n" style={{ marginTop: 6 }}>4つのうち3つで達成{extra ? <> · {extra}</> : null}</div>
      {below || null}
    </div>);
};

// 🌡 調子の印(段4の見る口 assistantLifeCondFaceOf)。読み込み前・印が偽なら出さない
const AluCond = ({ id, sleeping, hour, face }) => {
  const f = face || (typeof assistantLifeCondFaceOf === 'function' ? assistantLifeCondFaceOf(id, { sleeping, hour }) : null);
  if (!f) return null;
  return <span className="alu-chip" data-alu-cond={f.key}>{f.emoji} {f.label}{f.mark ? ` ${f.mark}` : ''}</span>;
};
// 予定の通りやすさ ◎○△(段4の見る口 assistantLifePlanEaseOf)
const AluEase = ({ id, abs, ease }) => {
  const e = ease || (typeof assistantLifePlanEaseOf === 'function' ? assistantLifePlanEaseOf(id, abs) : null);
  if (!e) return null;
  return <span className="alu-chip" data-alu-ease={e.mark}>{e.mark} {e.label}</span>;
};

// ---- 見本(止め絵を撮るためだけ。どの画面からも呼ばない。tools/assistant/life-ui-shoot.js が描く) ----
//   kind: 'house'(家の型)/ 'sheet'(窓)/ 'result'(結果の1枚)
const AssistantLifeUiSample = ({ kind = 'house', now }) => {
  const [tab, setTab] = React.useState('house');
  const who = (id) => (typeof assistantById === 'function' ? assistantById(id) : null) || { id, name: id };
  const face = (id) => (typeof AssistantFace === 'function' ? <AssistantFace who={who(id)} size={44} /> : '🙂');
  const a = who('mua'), b = who('atsu');
  const goal = { count: 1, need: 3, achieved: false, done: { watch: true, talk: false, give: false, play: false }, streak: 4, days: 7 };
  const scene = <div className="alu-ph alu-n">場面の絵(段7〜9で入る)</div>;
  const overlay = kind === 'sheet' ? (
    <AluSheet title={`🎁 ${a.name}に贈る`} gain="💗 仲良し度 · 🤝 友情" help="道具を1つ選んで贈ります。好きな物だと 💗 が多く上がります。今日はあと3回。" onClose={() => {}}>
      <AluRow pic="🍪" text="クッキー" note="好き · 持っている数 2" action={<AluBtn>贈る</AluBtn>} />
      <AluRow pic="🧸" text="モンスターのぬいぐるみ" note="まだ分からない · 300P" action={<AluBtn>贈る</AluBtn>} />
      <AluRow pic="🌸" text="花かざり" note="ふつう · 持っている数 1" action={<AluBtn>贈る</AluBtn>} />
    </AluSheet>
  ) : kind === 'result' ? (
    <AluResult title="👀 見た" line={`${a.name}と${b.name}が、おやつの最後の1個を半分こした。`}
      gains={[{ icon: '💗', label: '仲良し度', v: 5 }, { icon: '🤝', label: '友情', v: 3 }]} finds={['星のかけら']}
      next={{ label: `💬 ${b.name}と話す`, onClick: () => {} }} onClose={() => {}} />
  ) : null;
  return (
    <AluFrame title="家" onBack={() => {}} tab={tab} onTab={setTab} now={now} scene={scene} sceneH={250} overlay={overlay}
      head={<AluNextReward rest={120} text={`${a.name} Lv5 で 呼び方が1つ増える`} />}>
      <AluGo>👀 見る — {a.name}と{b.name}の話</AluGo>
      <AluGoalCard view={goal} extra="達成した日 4/7(7日でおやつのバスケット)" />
      <div className="alu-card">
        <div className="alu-h">今日あったこと</div>
        <AluRow pic={face('mua')} text={`🤝 ${a.name}と${b.name}が仲直り`} note="10:00 · 読むと 💗 +2" action={<AluBtn>読む</AluBtn>} />
        <AluRow pic={face('dra')} text={`💢 ${who('dra').name}と${who('kyuko').name}が喧嘩`} note="12:00 · 読むと 💗 +2" action={<AluBtn>読む</AluBtn>} />
        <AluRow pic={face('kiki')} text={`🎵 ${who('kiki').name}とモンヒロビート`} note="13:00 · 誘った" action={<AluBtn>見る</AluBtn>} />
        <AluRow pic={face('atsu')} text={`🧺 ${b.name}が拾い物`} note={<span>星のかけら <AluCond id="atsu" face={{ key: 'genki', emoji: '😊', label: '元気', mark: '' }} /> <AluEase id="atsu" ease={{ mark: '◎', label: '聞いてくれそう' }} /></span>} action={<AluBtn>見る</AluBtn>} />
      </div>
    </AluFrame>);
};

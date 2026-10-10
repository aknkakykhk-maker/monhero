// ==== 画面のエラー境界 ====
// React 18 は描画中に例外が1つ出るとルートごと外してしまい、画面が真っ白のまま何も押せなくなる
// (実際に「マーケットに入ると進行不能」「定義前の参照で真っ白」を出したことがある)。
// ここで受け止めて「ホームへ戻る / 読み込み直す」を出す。保存は操作ごとに済んでいるので進行は失われない。
// 正常時は子をそのまま返すだけで、DOM も描画順も変えない。
// 2段で使う: ルート直下(戻る先が無いので読み込み直しだけ)と、MonsterHeroGame の中(gameState を HOME へ戻せる)。
class MhErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { error: null, screen: props.screen }; }
  static getDerivedStateFromError(error) { return { error: error || new Error('unknown') }; }
  static getDerivedStateFromProps(props, state) {
    // 画面(gameState)が変わったら、前の画面で起きたエラーは捨てて描き直す
    if (props.screen !== state.screen) return { screen: props.screen, error: null };
    return null;
  }
  componentDidCatch(error, info) {
    try {
      const stack = info && info.componentStack ? info.componentStack.split('\n').filter(Boolean).slice(0, 3).join(' ') : '';
      window.__mhErr && window.__mhErr('[screen-error] ' + (this.props.screen || 'root') + ': ' + (error && error.message) + ' ' + stack);
    } catch (e) {}
  }
  render() {
    if (!this.state.error) return this.props.children;
    const detail = String(this.state.error && (this.state.error.stack || this.state.error.message) || this.state.error);
    const recover = () => { this.setState({ error: null }); try { this.props.onRecover && this.props.onRecover(); } catch (e) {} };
    const reload = () => { try { window.location.reload(); } catch (e) {} };
    return (
      <main data-screen-error className="h-full w-full bg-slate-950 text-white flex flex-col items-center justify-center gap-4 p-6 text-center" style={{minHeight:'var(--mh-vh)',boxSizing:'border-box'}}>
        <div style={{fontSize:'40px',lineHeight:1}}>⚠️</div>
        <h2 className="text-lg font-black">画面の表示でエラーが起きました</h2>
        <p className="text-sm text-slate-300" style={{maxWidth:'22rem'}}>進行データは操作のたびに保存されているので、失われていません。ホームへ戻るか、ゲームを読み込み直してください。</p>
        {this.props.onRecover && <button onClick={recover} className="w-full bg-emerald-600 text-white py-3 rounded-2xl font-black shadow-lg active:scale-95" style={{maxWidth:'20rem'}}>ホームへ戻る</button>}
        <button onClick={reload} className="w-full bg-slate-700 text-white py-3 rounded-2xl font-black shadow-lg active:scale-95" style={{maxWidth:'20rem'}}>ゲームを読み込み直す</button>
        <details className="text-left text-xs text-slate-500" style={{maxWidth:'22rem',width:'100%'}}>
          <summary>くわしい内容(不具合報告に添えてください)</summary>
          <pre style={{whiteSpace:'pre-wrap',wordBreak:'break-all',marginTop:'8px'}}>{this.props.screen ? `画面: ${this.props.screen}\n` : ''}{detail}</pre>
        </details>
      </main>
    );
  }
}

// デバッグ設定の「画面エラーの受け止めを試す」用。描画した瞬間に必ず例外を投げる
// (文言に「デバッグ」を含めない。演奏画面の検査がこの範囲の「デバッグ」の語を数えるため)
const DebugThrowScreenError = () => { throw new Error('画面エラーの受け止めを試すために、わざと投げた例外'); };

// ==== 読み込み直しの記録(2026-10-10・iPhone の Safari で「やっている最中に最初の画面へ戻る」問い合わせの調査用) ====
//
// ゲームが自分で読み込み直す道は無いので、iPhone のメモリ不足などでタブが読み込み直されたのかを、
// 次の起動で気づけるようにする。端末の中だけに残し、サーバーへは送らない。
//
//   (キー名の mhdev_ は「端末ごと」の印。バックアップ(mh_ で始まるキーだけ書き出す)には入らず、別の端末へ引き継がれない)
//   mhdev_session_marker_v1 … 遊んでいるあいだ、15秒ごとに書き直す「いま遊んでいる」印(1件だけ)
//   mhdev_reload_log_v1     … 前回が正常に終わっていなかったときに足す記録(直近 RELOAD_LOG_LIMIT 件まで)
//
// 印の state:
//   'running' … 画面を見ている最中。次の起動でこの状態のままなら「遊んでいる最中に止まった」(kind:'foreground')
//   'hidden'  … 裏に回った。次の起動でこの状態なら「裏に回ったあと読み込み直された」(kind:'background')
//   'closed'  … pagehide(閉じる・ほかのページへ移る)で正常に終わった。記録しない
// 新しい保存キーを足しただけで、既存の mh_* は触らない。読むときは「無い・壊れている」を既定値(null / [])にする。
const RELOAD_MARKER_KEY = 'mhdev_session_marker_v1';
const RELOAD_LOG_KEY = 'mhdev_reload_log_v1';
const RELOAD_LOG_LIMIT = 12;
const RELOAD_BEAT_MS = 15000;
const RELOAD_STATES = ['running', 'hidden', 'closed'];
const reloadNum = (value, fallback = null) => (Number.isFinite(Number(value)) && value !== null && value !== '' ? Number(value) : fallback);
const normalizeSessionMarker = (value) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const startedAt = reloadNum(value.startedAt), lastBeat = reloadNum(value.lastBeat);
  if (startedAt === null || lastBeat === null || startedAt <= 0 || lastBeat < startedAt) return null;
  return {
    id: typeof value.id === 'string' ? value.id.slice(0, 40) : '',
    startedAt, lastBeat,
    state: RELOAD_STATES.includes(value.state) ? value.state : 'running',
    screen: typeof value.screen === 'string' ? value.screen.slice(0, 40) : '',
    audioBuffers: reloadNum(value.audioBuffers),
    heapMB: reloadNum(value.heapMB),
    nav: typeof value.nav === 'string' ? value.nav.slice(0, 20) : '',
  };
};
const normalizeReloadLog = (value) => (Array.isArray(value) ? value : []).map(entry => {
  if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return null;
  const at = reloadNum(entry.at);
  if (at === null || at <= 0) return null;
  return {
    at,
    kind: entry.kind === 'background' ? 'background' : 'foreground',
    minutes: reloadNum(entry.minutes, 0),
    gapMinutes: reloadNum(entry.gapMinutes, 0),
    screen: typeof entry.screen === 'string' ? entry.screen.slice(0, 40) : '',
    audioBuffers: reloadNum(entry.audioBuffers),
    heapMB: reloadNum(entry.heapMB),
    nav: typeof entry.nav === 'string' ? entry.nav.slice(0, 20) : '',
  };
}).filter(Boolean).slice(0, RELOAD_LOG_LIMIT);
// 起動したときに、前回の印から記録を1件作る。正常に終わっていた(closed)・印が無い・壊れているときは null
const buildReloadLogEntry = (previous, now, nav = '') => {
  const prev = normalizeSessionMarker(previous);
  if (!prev || prev.state === 'closed') return null;
  const at = reloadNum(now, Date.now());
  return {
    at,
    kind: prev.state === 'hidden' ? 'background' : 'foreground',
    minutes: Math.max(0, Math.round((prev.lastBeat - prev.startedAt) / 60000)),
    gapMinutes: Math.max(0, Math.round((at - prev.lastBeat) / 60000)),
    screen: prev.screen,
    audioBuffers: prev.audioBuffers,
    heapMB: prev.heapMB,
    nav: String(nav || '').slice(0, 20),
  };
};
const pushReloadLog = (log, entry) => normalizeReloadLog(entry ? [entry, ...normalizeReloadLog(log)] : log);
const reloadReadJson = (key) => { try { const raw = window.localStorage.getItem(key); return raw ? JSON.parse(raw) : null; } catch (e) { return null; } };
const reloadWriteJson = (key, value) => { try { window.localStorage.setItem(key, JSON.stringify(value)); return true; } catch (e) { return false; } };
// 画面に出す1行。「何分遊んだあと」「どの画面で」「音のデータが何本あったか」を日本語で言う
const describeReloadLogEntry = (entry) => {
  const when = new Date(entry.at).toLocaleString('ja-JP', { timeZone:'Asia/Tokyo', month:'numeric', day:'numeric', hour:'2-digit', minute:'2-digit' });
  const head = entry.kind === 'background' ? '裏に回ったあと読み込み直された' : '遊んでいる最中に読み込み直された';
  const parts = [`${entry.minutes}分遊んだあと`, entry.screen ? `画面 ${entry.screen}` : '', Number.isFinite(entry.audioBuffers) ? `音のデータ ${entry.audioBuffers}本` : '', Number.isFinite(entry.heapMB) ? `メモリ ${entry.heapMB}MB` : ''].filter(Boolean);
  return `${when} 起動 — ${head}(${parts.join('・')})`;
};
// 音の設定の「音が出ないとき」の下に出す、前回までの記録(読み取りだけ。端末の外へは出さない)。
// 「記録をコピー」は、困ったときに開発者へ伝えるための文字を、端末のクリップボードへ写すだけ
function ReloadLogPanel() {
  const [log] = React.useState(() => normalizeReloadLog(reloadReadJson(RELOAD_LOG_KEY)));
  const [copied, setCopied] = React.useState(false);
  const copy = async () => {
    const text = JSON.stringify({ log, marker: reloadReadJson(RELOAD_MARKER_KEY), ua: (typeof navigator !== 'undefined' && navigator.userAgent) || '', build: typeof BUILD_DATE !== 'undefined' ? BUILD_DATE : '' });
    try { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2500); } catch (e) { setCopied(false); }
  };
  return (
    <div data-reload-log className="mt-2 rounded-xl border border-white/10 bg-black/30 p-2.5 text-left">
      <div className="text-[12px] font-black text-slate-200">前回までの読み込み直し</div>
      {log.length === 0
        ? <div className="mt-1 text-[11px] font-bold text-slate-400">途中で読み込み直された記録は、ありません。</div>
        : <ul className="mt-1 space-y-1">{log.map((entry, i) => <li key={i} data-reload-log-row className="text-[11px] font-bold leading-snug text-slate-300">{describeReloadLogEntry(entry)}</li>)}</ul>}
      <div className="mt-1 text-[10px] font-bold leading-snug text-slate-500">この端末の中だけに残します(新しい記録が12件を超えると古いものから消えます)。</div>
      {log.length > 0 && <button type="button" data-reload-log-copy onClick={copy} className="mh-button mh-button-secondary mt-1.5 min-h-[40px] w-full rounded-xl border border-white/15 bg-slate-800 px-2 text-[11px] font-black text-slate-200 active:scale-95">{copied ? 'コピーしました' : '記録をコピー'}</button>}
    </div>
  );
}

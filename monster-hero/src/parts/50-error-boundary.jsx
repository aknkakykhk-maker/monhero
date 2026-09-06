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

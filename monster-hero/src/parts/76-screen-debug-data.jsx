// ==================== データを用意する(デバッグ専用) ====================
// 「実装したらデバッグで確認できるようになってる？」への答えが半分だったので足した画面
// (2026-09-17)。デバッグの入口はこれまで「画面を開く」ものばかりで、
// **条件が揃わないと始まらないもの**には入口が無かった。
//
//   ログインボーナス … 日付が変わるのを待つ
//   ミッション       … 実際に条件を達成する
//   マーケットの購入 … ダイヤを貯める
//   アイテムの使用   … まず入手する
//   マスモンの育成   … 個体を作って育てる（強化・合体・再生・寄付・魂格）
//
// ここで「用意」だけできるようにすると、上のどれもすぐ確認できるようになる。
//
// 【この画面はセーブデータを書き換える】
// CLAUDE.md ⑦ を守るため、次を必ず通す。
//   ・既存の保存キーだけを使う。新しいキーは1つも作らない
//   ・押すたびに window.confirm を出す(何が変わるかを文面に書く)
//   ・配るもの(ダイヤ・アイテム・マスモン)は**足すだけ**。既存の値を消さない
//   ・「もう一度出す」は進行が消えるので、文面でそれを明言してから確認を取る

// マスモンをどの段階で作るか。育成のどの画面を試したいかで選ぶ
const DEBUG_MASU_STAGES = Object.freeze([
  { id: 'fresh',   label: '登録したて',     desc: '絆Lv.1。強化・合体の入口を見る' },
  { id: 'grown',   label: '上限まで育てた', desc: '絆Lvが上限。限界突破が押せる' },
  { id: 'rebirth', label: '限界突破MAX',    desc: '虹★。転生・超越の条件を満たす' },
]);

function DebugDataScreen({
  gold = 0, breederPoints = 0, ownedItems = {}, masuMons = [],
  itemDefs = [], monsters = [], stageId = 'fresh', monsterId = '',
  onStage, onMonster, onGrantGold, onGrantPoints, onGrantItem, onCreateMasu,
  onResetLoginBonus, onResetMissions, onResetChangelogSeen, onBack,
}) {
  const stage = DEBUG_MASU_STAGES.find(s => s.id === stageId) || DEBUG_MASU_STAGES[0];
  const mon = monsters.find(m => m.id === monsterId) || monsters[0] || null;
  const num = (n) => Math.max(0, Math.floor(Number(n) || 0)).toLocaleString();

  const section = (title, note, children, tone = 'safe') => (
    <section className={`rounded-2xl border p-3 ${tone === 'danger' ? 'border-rose-500/50 bg-rose-950/20' : 'border-cyan-500/40 bg-cyan-950/15'}`}>
      <h3 className={`text-[12px] font-black ${tone === 'danger' ? 'text-rose-200' : 'text-cyan-200'}`}>{title}</h3>
      {note && <p className="mt-0.5 mb-2 text-[9px] font-bold leading-relaxed text-slate-400">{note}</p>}
      {children}
    </section>
  );
  const btn = (label, onClick, tone = 'safe', extra = {}) => (
    <button key={label} type="button" onClick={onClick} {...extra}
      className={`min-h-[48px] rounded-xl border px-2 text-center text-[11px] font-black leading-tight active:scale-95 ${tone === 'danger' ? 'border-rose-400/60 bg-rose-950/50' : 'border-cyan-400/50 bg-cyan-950/40'}`}>
      {label}
    </button>
  );

  return (
    <main data-debug-data-screen data-mh-screen className="flex-1 flex flex-col h-full min-h-0 p-4"
      style={{ paddingTop: 'calc(1rem + env(safe-area-inset-top))', paddingBottom: 'calc(1rem + env(safe-area-inset-bottom))' }}>
      <DebugScreenHead title="データを用意する" note="条件が揃わないと始まらないものを、すぐ試せる状態にする" saves onBack={onBack}/>
      <div className="mh-debug-banner shrink-0 mb-2">DEBUG・この画面はセーブデータを書き換えます</div>
      <div className="flex-1 min-h-0 overflow-y-auto mh-scroll space-y-3">

        {/* ① 通貨。マーケットの購入・アイテムの入手を試すのに要る */}
        {section('① ダイヤとブリーダーP', `いま ダイヤ ${num(gold)} ／ ブリーダーP ${num(breederPoints)}。足すだけで、減らしたり書き換えたりはしません。`, (
          <div className="grid grid-cols-3 gap-2">
            {btn('ダイヤ +1万', () => onGrantGold(10000), 'safe', { 'data-debug-grant-gold': '10000' })}
            {btn('ダイヤ +100万', () => onGrantGold(1000000))}
            {btn('ブリーダーP +100', () => onGrantPoints(100), 'safe', { 'data-debug-grant-points': '100' })}
          </div>
        ))}

        {/* ② アイテム。マーケットの type:'item' をそのまま並べる(手で書き写さない) */}
        {section('② アイテムを配る', 'マーケットの消耗アイテムをそのまま並べています。10個ずつ足します。', (
          <div className="space-y-1.5">
            {!itemDefs.length && <p className="text-[10px] text-slate-400">アイテムが読み込めていません。</p>}
            {itemDefs.map(item => (
              <div key={item.id} className="flex items-center gap-2 rounded-xl bg-black/30 px-2.5 py-2">
                <span className="shrink-0 text-[15px]">{item.emoji || '📦'}</span>
                <span className="min-w-0 flex-1 truncate text-[11px] font-black text-white">{item.name}</span>
                <span className="shrink-0 font-mono text-[11px] font-black text-cyan-300">{num(ownedItems[item.id])}</span>
                <button type="button" data-debug-grant-item={item.id} onClick={() => onGrantItem(item.id, 10)}
                  className="shrink-0 min-h-[40px] rounded-lg border border-cyan-400/50 bg-cyan-950/40 px-3 text-[11px] font-black active:scale-95">+10</button>
              </div>
            ))}
          </div>
        ))}

        {/* ③ マスモン。強化・合体・再生・寄付・魂格はどれも「個体が要る」ので、ここが無いと始まらない */}
        {section('③ テストのマスモンを作る', `いま ${masuMons.length} 体。神殿の強化・合体・再生・寄付・魂格は、個体が無いと何も試せません。`, (
          <div className="space-y-2">
            <div className="grid grid-cols-3 gap-1.5">
              {DEBUG_MASU_STAGES.map(s => (
                <button key={s.id} type="button" data-debug-masu-stage={s.id} onClick={() => onStage(s.id)}
                  className={`min-h-[52px] rounded-xl border px-1 text-[10px] font-black leading-tight active:scale-95 ${stage.id === s.id ? 'border-cyan-300 bg-cyan-700 text-white' : 'border-white/10 bg-slate-900 text-slate-300'}`}>{s.label}</button>
              ))}
            </div>
            <p className="text-[9px] font-bold text-cyan-300/80">{stage.desc}</p>
            <select aria-label="作るモンスター" value={mon ? mon.id : ''} onChange={e => onMonster(e.target.value)}
              className="block min-h-[46px] w-full rounded-xl border border-white/10 bg-slate-900 px-3 text-[12px] font-black text-white">
              {monsters.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
            <button type="button" data-debug-create-masu disabled={!mon} onClick={() => mon && onCreateMasu(mon.id, stage.id)}
              className="min-h-[50px] w-full rounded-xl border border-cyan-400/60 bg-cyan-800 text-[12px] font-black text-white active:scale-95 disabled:opacity-40">
              {mon ? `${mon.name}を「${stage.label}」で1体つくる` : 'モンスターがいません'}
            </button>
          </div>
        ))}

        {/* ④ もう一度出す。ここだけは進行が消えるので、文面で言い切ってから確認を取る */}
        {section('④ もう一度出す（進行が消えます）', '待たずに出すための操作です。いまの進み具合は失われます。押すと確認が出ます。', (
          <div className="grid grid-cols-1 gap-2">
            {btn('ログインボーナスを未受け取りへ戻す', onResetLoginBonus, 'danger', { 'data-debug-reset-login': '1' })}
            {btn('ミッションを未達成へ戻す', onResetMissions, 'danger', { 'data-debug-reset-missions': '1' })}
            {btn('更新履歴を未読へ戻す', onResetChangelogSeen, 'danger', { 'data-debug-reset-changelog': '1' })}
          </div>
        ), 'danger')}

        {/* まだ入口が無いものは、黙って落とさず書いておく */}
        <section className="rounded-2xl border border-white/10 bg-slate-900/50 p-3">
          <h3 className="text-[11px] font-black text-slate-300">まだここから用意できないもの</h3>
          <p className="mt-1 text-[9px] font-bold leading-relaxed text-slate-400">
            ギフトボックスの配布・補償／キャンペーン／ランキングの送信。どれも配布や送信の条件そのものを書き換えることになるため、
            うっかり本物の記録を触らないよう入口を作っていません。
          </p>
        </section>
      </div>
    </main>
  );
}

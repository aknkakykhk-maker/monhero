// ===== モンヒロサクセス: ストーリー選択(シナリオを選ぶ段) =====
// 2026-11-14 社長: シナリオは今後増やす。いまのシナリオの名前は「ヒーローへの道」。参考のストーリー選択の画面
//   (docs/reference/line-mf/scenario-select-2026-11-14/)に合わせて、育成を始める前にシナリオを選ぶ段を作る。
//   止め絵: docs/progress/player-raise/shots/scenario-2026-11-14/scenario-select-mock.png(社長に見せ済み・案のまま)
// 保存: 途中の育成 mh_monsuc_run_v1 に scn(シナリオの id)を足すだけ。無い保存・知らない id は 'hero' として読む(msxScenarioId)
const MSX_STORIES = Object.freeze([
  Object.freeze({
    id: 'hero', name: 'ヒーローへの道', en: 'ROAD TO HERO', badge: 'ヒーローズファイナル',
    lead: ['町の育成場で、きみと1体のモンスターの物語が始まる', '大会で勝ち、修行で技を覚え、仲間と強くなろう。', 'めざすはヒーローズファイナル——ヒーローと呼ばれる日まで。'],
    about: 'デビュー戦から始まり、ジュニア・ミドル・プロの3つの期を経て、最後は「ヒーローズファイナル」に挑む、モンヒロサクセスのいちばん最初のお話。',
    rows: Object.freeze([
      ['📅', '流れ', 'デビュー期 → ジュニア期 → ミドル期 → プロ期 → ヒーローズファイナル(3戦)'],
      ['🏆', '大会', 'モンスターダービー/四大大会/季節の賞 ほか。賞金ランクは ルーキー〜ヒーローの10段'],
      ['👥', '登場人物', '助手(いまはみゅあ)・イッサ博士・ライバルたち'],
      ['🎯', 'めざすもの', 'ヒーローズファイナルの決勝に勝って「ヒーロー」に。'],
    ]),
    cast: Object.freeze({ left: 'issa', center: 'mua', right: 'kiki' }),
  }),
]);
const msxScenarioId = (id) => (MSX_STORIES.some((x) => x.id === id) ? id : 'hero');
const msxScenarioOf = (id) => MSX_STORIES.find((x) => x.id === msxScenarioId(id)) || MSX_STORIES[0];

const MSX_SCN_CSS = `
.msx .scn{position:relative;display:flex;flex-direction:column;flex:1 1 0;min-height:0;overflow:hidden;background:#1e1b4b}
.msx .scn-hd{display:flex;align-items:center;justify-content:space-between;padding:8px 12px;background:#2a2118;color:#fde68a;font-weight:900;font-size:15px;flex:none}
.msx .scn-hd small{font-size:14px;color:#fde68a}
.msx .scn-sc{position:relative;flex:1 1 0;min-height:0;overflow:hidden}
.msx .scn-sc>.bg{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
.msx .scn-sc>.pl{position:absolute;left:0;right:0;bottom:0;height:16%;background:repeating-linear-gradient(0deg,#c9b9a6 0 22px,#b9a690 22px 24px)}
.msx .scn-sc .who{position:absolute;object-fit:contain;pointer-events:none}
.msx .scn-sc .who.l{left:-7%;bottom:40%;height:36%;z-index:2}
.msx .scn-sc .who.r{right:-9%;bottom:38%;height:40%;z-index:2}
.msx .scn-sc .who.c{left:50%;transform:translateX(-50%);bottom:46%;height:46%;z-index:1;animation:msxScnBob 3.2s ease-in-out infinite}
@keyframes msxScnBob{0%,100%{transform:translateX(-50%) translateY(0)}50%{transform:translateX(-50%) translateY(-6px)}}
.msx .scn-bd{position:absolute;z-index:3;right:4%;top:3%;width:68px;height:68px;border-radius:50%;background:radial-gradient(circle at 35% 30%,#fcd34d,#b45309);border:3px solid #fef3c7;box-shadow:0 2px 8px #0006;display:flex;flex-direction:column;align-items:center;justify-content:center;color:#3b1d02;font-weight:900;font-size:11px;line-height:1.15;text-align:center}
.msx .scn-ti{position:absolute;left:0;right:0;top:41%;text-align:center;z-index:3}
.msx .scn-ti b{display:block;font-size:clamp(34px,11vw,46px);font-weight:900;letter-spacing:1px;color:#fde047;background:linear-gradient(180deg,#ffffff 8%,#fef08a 40%,#facc15 68%,#f59e0b 95%);-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;-webkit-text-stroke:1px #c2410c;filter:drop-shadow(0 2px 0 #7c2d12) drop-shadow(0 0 6px #0007)}
.msx .scn-ti small{display:block;margin-top:2px;font-size:12px;font-weight:900;letter-spacing:5px;color:#fff;text-shadow:0 1px 3px #000}
.msx .scn-ld{position:absolute;z-index:3;left:4%;right:4%;top:56%;padding:9px 12px;border-radius:8px;background:linear-gradient(90deg,#4338ca,#7c3aed);border:2px solid #c4b5fd;color:#fff;font-size:12.5px;font-weight:800;line-height:1.6;transform:skewX(-3deg);box-shadow:0 3px 10px #0006}
.msx .scn-ld>div{transform:skewX(3deg)}
.msx .scn-dt{position:absolute;z-index:3;left:0;right:0;top:calc(56% + 92px);text-align:center;color:#fff;font-size:11px;font-weight:800;text-shadow:0 1px 3px #000}
.msx .scn-dt i{display:inline-block;width:7px;height:7px;border-radius:50%;background:#fff;margin:0 3px 4px}
.msx .scn-dt i.off{width:4px;height:4px;opacity:.6}
.msx .scn-ft{display:flex;gap:10px;align-items:center;padding:10px 12px calc(10px + env(safe-area-inset-bottom));background:#c9b9a6;flex:none}
.msx .scn-ft button{height:48px;border-radius:10px;font-weight:900;font-size:16px;border:3px solid #fff;box-shadow:0 3px 0 #0003}
.msx .scn-ft .bk{width:48px;flex:none;background:#f59e0b;color:#fff;font-size:22px}
.msx .scn-ft .go{flex:1 1 0;background:linear-gradient(180deg,#fb923c,#ea580c);color:#fff}
.msx .scn-ft .dt{flex:1 1 0;background:#fff;color:#1f2937;border-color:#e5e7eb}
.msx .scn-win{position:absolute;inset:0;z-index:30;background:#0008;display:flex;align-items:center;justify-content:center;padding:28px 18px}
.msx .scn-win .in{width:100%;max-height:100%;overflow-y:auto;background:#fffbeb;border:4px solid #c2410c;border-radius:14px;padding:14px 16px;color:#1f2937}
.msx .scn-win h3{margin:0 0 8px;text-align:center;font-size:18px;font-weight:900;color:#9a3412}
.msx .scn-win p{margin:0 0 10px;font-size:13.5px;line-height:1.7}
.msx .scn-win .k{font-size:14px;font-weight:900;color:#c2410c;margin-top:4px}
.msx .scn-win .v{font-size:13.5px;line-height:1.6;margin-bottom:8px}
.msx .scn-win .cl{display:block;margin:10px auto 0;padding:8px 28px;border-radius:9px;background:#fff;border:2px solid #d6d3d1;font-weight:900;font-size:14px;color:#1f2937}
`;

// ストーリー選択の画面。value: いま選んでいるシナリオの id。onNext(id): 次へ(育てるモンスターを選ぶ段)。ctx: みゅあの説明(tut.scn)に渡す呼び名など
function MsxScenarioSelect({ value, onBack, onNext, ctx }) {
  const [idx, setIdx] = useState(() => Math.max(0, MSX_STORIES.findIndex((x) => x.id === msxScenarioId(value))));
  const [detail, setDetail] = useState(false);
  const sc = MSX_STORIES[idx] || MSX_STORIES[0];
  const n = MSX_STORIES.length;
  const art = (aid) => { // 全身の絵(助手ごとの表情)。パスは助手の表(assistantFullBodyImage)から引く。無ければ今の立ち絵
    if (aid === 'issa') return typeof MSX_ISSA_ART === 'string' ? MSX_ISSA_ART : '';
    const ex = aid === 'mua' ? 'excited' : 'happy'; const who = typeof assistantById === 'function' ? assistantById(aid) : null;
    return (who && typeof assistantFullBodyImage === 'function' && assistantFullBodyImage(who, ex)) || (typeof msxBody === 'function' ? msxBody(aid, ex) : '');
  };
  const many = n > 1;
  return (
    <div className="scn" data-msx-scenario={sc.id}>
      <style>{MSX_SCN_CSS}</style>
      <div className="scn-hd"><span>📖 ストーリー選択</span><small>シナリオ {idx + 1}/{n}</small></div>
      <div className="scn-sc">
        <img className="bg" src="images/story-bg/monhero_town.jpg" alt=""/>
        <div className="pl"/>
        {sc.cast.left ? <img className="who l" src={art(sc.cast.left)} alt=""/> : null}
        {sc.cast.right ? <img className="who r" src={art(sc.cast.right)} alt=""/> : null}
        {sc.cast.center ? <img className="who c" src={art(sc.cast.center)} alt=""/> : null}
        <div className="scn-bd">{sc.badge}<span style={{ fontSize: 16 }}>👑</span></div>
        <div className="scn-ti"><b>{sc.name}</b><small>{sc.en}</small></div>
        <div className="scn-ld"><div>{sc.lead.map((t, i) => <React.Fragment key={i}>{i ? <br/> : null}{t}</React.Fragment>)}</div></div>
        <div className="scn-dt">
          <div>{MSX_STORIES.map((x, i) => <i key={x.id} className={i === idx ? '' : 'off'}/>)}</div>
          {many ? null : 'ほかのシナリオは 準備中です'}
        </div>
        {many ? <>
          <button type="button" aria-label="前のシナリオ" onClick={() => setIdx((i) => (i + n - 1) % n)} style={{ position: 'absolute', left: 4, top: '44%', background: 'none', border: 0, color: '#fff', fontSize: 28, opacity: 0.8 }}>◀</button>
          <button type="button" aria-label="次のシナリオ" onClick={() => setIdx((i) => (i + 1) % n)} style={{ position: 'absolute', right: 4, top: '44%', background: 'none', border: 0, color: '#fff', fontSize: 28, opacity: 0.8 }}>▶</button>
        </> : null}
      </div>
      <div className="scn-ft">
        <button type="button" className="bk" onClick={onBack} aria-label="戻る">↩</button>
        <button type="button" className="go" onClick={() => onNext(sc.id)} data-msx-scenario-next>次へ ▶</button>
        <button type="button" className="dt" onClick={() => setDetail(true)} data-msx-scenario-detail>ストーリー詳細</button>
      </div>
      {detail ? (
        <div className="scn-win" onClick={() => setDetail(false)}>
          <div className="in" onClick={(e) => e.stopPropagation()}>
            <h3>{sc.name}</h3>
            <p>{sc.about}</p>
            {sc.rows.map(([e, k, v]) => <React.Fragment key={k}><div className="k">{e} {k}</div><div className="v">{v}</div></React.Fragment>)}
            <button type="button" className="cl" onClick={() => setDetail(false)}>閉じる</button>
          </div>
        </div>
      ) : null}
      {typeof MsxBetaTalk === 'function' ? <MsxBetaTalk keys={['scn']} ctx={ctx}/> : null}
    </div>
  );
}

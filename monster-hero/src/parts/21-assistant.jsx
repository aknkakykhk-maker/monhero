// ===== 助手(ナビゲーター) ここから =====
// 助手の名前・画像・セリフは data/assistants.js が持つ。ここは表示だけを受け持つ。
// どの画面でも <AssistantBubble scene="キー"/> の1行で同じ見た目の吹き出しを出せる。
// (今後 HOME・神殿・マーケット・M/B管理・バトル・設定・ランキング・イベント案内・
//  ギフト・ミッション・チュートリアルへ広げる想定)
const ASSISTANT_LIST = (typeof ASSISTANTS !== 'undefined' && Array.isArray(ASSISTANTS)) ? ASSISTANTS : [];
const ASSISTANT_SCENE_MAP = (typeof ASSISTANT_SCENES !== 'undefined' && ASSISTANT_SCENES) || {};
const ASSISTANT_FALLBACK = { id:'', name:'助手', image:null, emoji:'💬', accent:'#f472b6', greeting:'' };
const assistantById = (id) => ASSISTANT_LIST.find(a => a.id === id)
  || ASSISTANT_LIST.find(a => a.id === (typeof DEFAULT_ASSISTANT_ID !== 'undefined' ? DEFAULT_ASSISTANT_ID : ''))
  || ASSISTANT_LIST[0] || ASSISTANT_FALLBACK;
const assistantSceneById = (key) => (key && ASSISTANT_SCENE_MAP[key]) || null;
// ---- 親密度(みゅあとの仲良し度)を各画面へ配る ----
// 吹き出しはどの画面にも置くので、画面ごとに props を渡さずに済むよう Context で配る。
// 画面側はこれまでどおり <AssistantBubble scene="…"/> の1行だけでよい。
//   level  … いまの親密度Lv(呼び方と、出るセリフが変わる)
//   name   … プレイヤー名。セリフの中の {name} が呼び方に置き換わる
//   onTalk … 顔をタップして話しかけたときに呼ぶ(仲良し度が少し増える)
const ASSISTANT_BOND_FALLBACK = { points: 0, level: 1, name: '', callStyle: null, onTalk: null };
const AssistantBondContext = React.createContext(ASSISTANT_BOND_FALLBACK);
const useAssistantBond = () => useContext(AssistantBondContext) || ASSISTANT_BOND_FALLBACK;
// セリフの中の {name} を、そのときの呼び方へ置き換える。
// data/assistants.js が読めなかった場合でも、文が壊れないように {name} だけは消す
// callStyleId … 絆Lv6から選べる呼び方の上書き(省略時は絆Lvの既定のまま)
const assistantSpeakText = (text, name, level, callStyleId) => (typeof assistantSpeak === 'function')
  ? assistantSpeak(text, name, level, callStyleId)
  : String(text == null ? '' : text).replace(/\{name\}/g, String(name || 'キミ'));
// 表情ごとの顔画像のパスを決める。用意されていない表情は data/assistants.js 側で
// 既定の表情(normal)へ落ちる。この関数が無い(古いデータの)ときは画像なし扱いにする
const assistantFaceSrc = (who, expression) => (typeof assistantFaceImage === 'function')
  ? (assistantFaceImage(who, expression) || who.image || null)
  : (who.image || null);
// 助手の顔。表情の画像が読めなかったときは既定の表情へ、それも駄目なら絵文字で代用する。
// size は px
const AssistantFace = ({ who, size = 88, accent, expression = null }) => {
  const wanted = assistantFaceSrc(who, expression);
  const fallback = assistantFaceSrc(who, null);
  const [src, setSrc] = useState(wanted);
  // 場面が変わって表情が切り替わったら読み直す
  useEffect(() => { setSrc(assistantFaceSrc(who, expression)); }, [who.id, expression]);
  return (
    <div className="shrink-0 rounded-2xl overflow-hidden border-2 flex items-center justify-center bg-black/50"
         style={{ width:`${size}px`, height:`${size}px`, borderColor:accent, boxShadow:`0 0 12px ${accent}55` }}>
      {src
        ? <img src={src} alt={who.name} className="w-full h-full object-cover"
               onError={()=>setSrc(src === fallback ? null : fallback)}/>
        : <span style={{ fontSize:`${Math.round(size * 0.5)}px`, lineHeight:1 }}>{who.emoji}</span>}
    </div>
  );
};
// ヘルプ本文のブロックを描く。ヘルプ画面と助手の詳細で同じ見た目にするため1か所にまとめる
const renderHelpBlocks = (blocks, accent) => (blocks || []).map((b, i) => {
  if(b.t==='note') return <div key={i} className="rounded-2xl p-4 border" style={{borderColor:`${accent}55`,backgroundColor:'rgba(0,0,0,0.5)'}}>{b.title&&<div className="text-[11px] font-black text-white mb-1">{b.title}</div>}<div className="text-[12px] text-slate-300 leading-relaxed">{b.text}</div></div>;
  if(b.t==='list') return <ul key={i} className="text-[12px] text-slate-300 leading-relaxed space-y-2 list-disc pl-5">{b.items.map((x,j)=><li key={j}>{x}</li>)}</ul>;
  if(b.t==='steps') return <div key={i} className="space-y-2.5">{b.items.map((x,j)=>(<div key={j} className="flex items-start gap-3"><span className="shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-black text-black" style={{backgroundColor:accent}}>{j+1}</span><span className="text-[12px] text-slate-300 leading-relaxed pt-0.5">{x}</span></div>))}</div>;
  if(b.t==='kv') return <div key={i} className="rounded-2xl bg-black/50 border border-white/5 overflow-hidden">{b.rows.map((r,j)=>(<div key={j} className={`flex gap-3 px-4 py-2.5 ${j>0?'border-t border-white/5':''}`}><span className="shrink-0 w-24 text-[11px] font-black text-slate-400 leading-tight">{r[0]}</span><span className="flex-1 text-[11px] text-white leading-relaxed">{r[1]}</span></div>))}</div>;
  // 実データから作る表。難易度・アイテム・ログボ・ミッションはここで全件出るので取りこぼさない
  if(b.t==='data'){const rows=helpDataRows(b.id);if(rows.length===0)return null;return(<div key={i}><div className="text-[10px] font-black mb-1 tracking-wider" style={{color:accent}}>{HELP_DATA_TITLES[b.id]||''}</div><div className="rounded-2xl bg-black/50 border border-white/5 overflow-hidden">{rows.map((r,j)=>(<div key={j} className={`flex gap-3 px-4 py-2.5 ${j>0?'border-t border-white/5':''}`}><span className="shrink-0 w-24 text-[11px] font-black text-slate-400 leading-tight">{r[0]}</span><span className="flex-1 text-[11px] text-white leading-relaxed">{r[1]}</span></div>))}</div></div>);}
  return <p key={i} className="text-[12px] text-slate-200 leading-relaxed">{b.text}</p>;
});
// 助手の吹き出し。どの画面でもこれ1つ置けばよい。
//   scene       … data/assistants.js の ASSISTANT_SCENES のキー(これだけで完結する)
//   line/detail … sceneを使わず直接セリフと詳細を渡したいとき
//   helpRef     … 'カテゴリid/項目id'。詳細としてヘルプ本文をそのまま開く
//   accent      … 画面のテーマ色に合わせたいとき(省略すると助手ごとの色)
//   compact     … 縦の場所が取れない画面(選択画面・リザルト)向けの小さい表示
//   defaultOpen … 最初から詳細を開いた状態にする(チュートリアルなどで使う)
const AssistantBubble = ({ scene=null, assistantId=null, line=null, detail=null, helpRef=null, condition=null, expression=null, accent=null, faceSize=null, compact=false, defaultOpen=false }) => {
  const [open, setOpen] = useState(defaultOpen);
  const sceneDef = assistantSceneById(scene);
  // 親密度。呼び方と、候補に入るセリフがこれで変わる
  const bond = useAssistantBond();
  // だれが話すか。画面から指定が無ければ、いま選んでいる助手がそのまま話す
  const activeId = assistantId || sceneDef?.assistantId || bond.assistantId || null;
  const who = assistantById(activeId);
  const color = accent || who.accent || ASSISTANT_FALLBACK.accent;
  // 場面ごとに用意した複数のセリフから1つ選ぶ。同じ画面でも毎回ちがうことを話す。
  // 選び直すのは「場面」「条件」「親密度Lv」「助手」が変わったときだけ。ほかの理由で再描画
  // されるたびにセリフが入れ替わると、読んでいる途中で文が変わってしまう
  const pickedRef = useRef(null);
  const pickKey = `${who.id}|${scene || ''}|${condition || ''}|${bond.level}`;
  if (pickedRef.current?.key !== pickKey) {
    pickedRef.current = { key: pickKey, value: (typeof pickAssistantLine === 'function') ? pickAssistantLine(scene, condition, bond.level, who.id) : null };
  }
  // 顔をタップすると次のセリフへ送る。短い間に何度も押されたら連打リアクションに入る。
  // spam は { step, recovering } で、null のときは通常のセリフを話している
  const [tapped, setTapped] = useState(null);   // 顔タップで差し替えたセリフ
  const [spam, setSpam] = useState(null);
  const tapTimesRef = useRef([]);
  const spamTimerRef = useRef(null);
  useEffect(() => () => { if (spamTimerRef.current) clearTimeout(spamTimerRef.current); }, []);
  // 場面が変われば、送ったセリフも連打の状態もリセットする
  useEffect(() => { setTapped(null); setSpam(null); tapTimesRef.current = []; }, [pickKey]);
  const spamLines = (typeof ASSISTANT_SPAM_LINES !== 'undefined' && ASSISTANT_SPAM_LINES) || [];
  const spamRecover = (typeof ASSISTANT_SPAM_RECOVER !== 'undefined' && ASSISTANT_SPAM_RECOVER) || null;
  const onFaceTap = () => {
    // 話しかけると少しだけ仲良くなる(1日に増える量は data/assistants.js 側で頭打ち)
    if (typeof bond.onTalk === 'function') bond.onTalk();
    const now = Date.now();
    const windowMs = (typeof ASSISTANT_SPAM_WINDOW_MS !== 'undefined' && ASSISTANT_SPAM_WINDOW_MS) || 1200;
    const threshold = (typeof ASSISTANT_SPAM_THRESHOLD !== 'undefined' && ASSISTANT_SPAM_THRESHOLD) || 3;
    tapTimesRef.current = [...tapTimesRef.current, now].filter(t => now - t <= windowMs);
    if (spamTimerRef.current) { clearTimeout(spamTimerRef.current); spamTimerRef.current = null; }
    // 連打中: 次の段階へ。最後まで行ったら少し黙ってから笑って戻る
    if (spam || (spamLines.length > 0 && tapTimesRef.current.length >= threshold)) {
      const step = spam ? Math.min(spam.step + 1, spamLines.length - 1) : 0;
      setSpam({ step, recovering: false });
      if (spamLines[step]?.last) {
        const wait = (typeof ASSISTANT_SPAM_RECOVER_MS !== 'undefined' && ASSISTANT_SPAM_RECOVER_MS) || 2600;
        spamTimerRef.current = setTimeout(() => {
          setSpam({ step, recovering: true });
          spamTimerRef.current = setTimeout(() => { setSpam(null); tapTimesRef.current = []; }, 2600);
        }, wait);
      }
      return;
    }
    // ふつうのタップ: 次のセリフへ切り替える(表情も変わる)
    if (typeof pickAssistantLine === 'function') setTapped(pickAssistantLine(scene, condition, bond.level, who.id));
  };
  const spamLine = spam ? (spam.recovering ? spamRecover : spamLines[spam.step]) : null;
  const shown = spamLine || tapped || pickedRef.current.value;
  const picked = pickedRef.current.value;
  // セリフの中の {name} は、そのときの呼び方(さん付け・呼び捨て・ちん付けなど)になる
  const text = assistantSpeakText(line || shown?.t || who.greeting || '', bond.name, bond.level, bond.callStyle, who.id);
  const face = expression || shown?.e || null;
  const paragraphs = detail || sceneDef?.detail || null;
  const ref = helpRef || sceneDef?.help || null;
  const topic = ref && ref.includes('/') ? helpTopicById(ref.split('/')[0], ref.split('/')[1]) : null;
  const hasDetail = !!((paragraphs && paragraphs.length) || topic);
  const Wrapper = hasDetail ? 'button' : 'div';
  const size = faceSize != null ? faceSize : (compact ? 48 : 88);
  return (
    <>
      <div className="w-full flex items-end gap-2">
        {/* 顔をタップすると次のセリフへ。詳細は吹き出し側をタップする(操作を分けている) */}
        <button type="button" onClick={onFaceTap} aria-label={`${who.name}にはなしかける`} className="shrink-0 active:scale-90 transition-transform">
          <AssistantFace who={who} size={size} accent={color} expression={face}/>
        </button>
        <Wrapper
          {...(hasDetail ? { onClick:()=>setOpen(true), 'aria-label':`${who.name}の説明を開く` } : {})}
          className={`relative flex-1 min-w-0 text-left rounded-2xl border-2 ${compact?'px-2.5 py-1.5':'px-3 py-2'} ${hasDetail?'active:scale-[.99]':''}`}
          style={{ borderColor:color, backgroundColor:'rgba(15,23,42,0.92)' }}>
          {/* 吹き出しのしっぽ(左向き) */}
          <span className="absolute" style={{ left:'-9px', bottom:'14px', width:0, height:0, borderTop:'7px solid transparent', borderBottom:'7px solid transparent', borderRight:`9px solid ${color}` }}/>
          <span className="absolute" style={{ left:'-6px', bottom:'14px', width:0, height:0, borderTop:'7px solid transparent', borderBottom:'7px solid transparent', borderRight:'9px solid rgba(15,23,42,0.92)' }}/>
          <span className={`block font-black tracking-widest ${compact?'text-[9px]':'text-[10px]'}`} style={{ color }}>{who.name}</span>
          <span className={`block text-white leading-relaxed ${compact?'text-[10px]':'text-[12px]'}`}>{text}</span>
          {hasDetail&&<span className="mt-0.5 flex items-center justify-end gap-0.5 text-[9px] font-black" style={{ color }}>タップで詳しく<ChevronRight size={11}/></span>}
        </Wrapper>
      </div>
      {open&&(
        <div className="fixed inset-0 flex items-end justify-center" style={{position:'fixed',inset:0,backgroundColor:'rgba(2,6,23,0.94)',zIndex:70000}} role="dialog" aria-modal="true" aria-label={`${who.name}の説明`}>
          <div className="w-full max-w-md rounded-t-3xl border-t-2 border-x-2 bg-slate-950 flex flex-col" style={{ borderColor:color, maxHeight:'88vh' }}>
            <div className="shrink-0 flex items-center gap-3 p-4 border-b border-white/10">
              <AssistantFace who={who} size={68} accent={color} expression={face}/>
              <div className="flex-1 min-w-0">
                <div className="text-[10px] font-black tracking-widest" style={{ color }}>{who.name}</div>
                <div className="text-[12px] text-white leading-relaxed">{text}</div>
              </div>
              <button onClick={()=>setOpen(false)} aria-label="説明を閉じる" className="shrink-0 p-2 bg-white/10 rounded-full active:scale-90"><X size={18}/></button>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto mh-scroll p-4 space-y-3.5">
              {topic
                ? renderHelpBlocks(topic.blocks, color)
                : (paragraphs || []).map((x,i)=><p key={i} className="text-[12px] text-slate-200 leading-relaxed">{x}</p>)}
            </div>
            <div className="shrink-0 p-4 pt-2" style={{ paddingBottom:'calc(1rem + env(safe-area-inset-bottom))' }}>
              <button onClick={()=>setOpen(false)} className="w-full min-h-[48px] rounded-2xl font-black text-sm text-black active:scale-[.98]" style={{ backgroundColor:color }}>とじる</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
// クイックモードの短い演出画面。プレイヤーがタップするまで待つ(自動では進めない)。
// 連打しても onDone は1回しか呼ばない
const QuickStepScreen = ({ onDone, accent = '#2dd4bf', label = 'タップして次へ', children }) => {
  const doneRef = useRef(false);
  const finish = () => { if (doneRef.current) return; doneRef.current = true; onDone(); };
  return (
    // ★背の低い端末で中身がはみ出したときに縦スクロールできるようにしてある。
    //   外側に overflow-y-auto を置き、中央寄せは内側の min-h-full の箱でやるのが要点。
    //   justify-center をスクロールする箱に直接付けると、はみ出したときに上側が切れて
    //   「タップして次へ」の前の文が読めなくなる(2026-09-11・layout-consistency-check)。
    //   中身が収まるときの見た目は今までとまったく同じ。
    <div onClick={finish} role="button" tabIndex={0} aria-label={label}
         className="absolute inset-0 overflow-y-auto mh-scroll"
         style={{ position:'absolute', inset:0, backgroundColor:'#020617', zIndex:30000 }}>
      <div className="min-h-full flex flex-col items-center justify-center p-6 text-center">
        <div className="w-full max-w-sm flex flex-col items-center">{children}</div>
        <div className="mt-5 text-[11px] font-black tracking-widest animate-pulse" style={{ color:accent }}>{label}</div>
      </div>
    </div>
  );
};
// ===== 助手(ナビゲーター) ここまで =====

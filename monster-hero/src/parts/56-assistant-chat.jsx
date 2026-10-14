// ===== 助手とおしゃべり(2026-10-14・社長の決定) =====
// 助手と自由に話せる会話の窓。返事は Claude が作る。ゲームは API キーを持たず、
// 中継役(supabase/functions/assistant-chat)へ送るだけ。仕様: docs/spec/ASSISTANT_CHAT.md
// ★公開の印 RELEASE_FLAGS.assistantChat の後ろ。印が立つまではデバッグ設定からだけ開ける。
// ★会話の中身は端末にだけ置く(新しいキー。既存のキーは触らない)。サーバーへ送るのは直近3往復と今回だけ。
// ★電話番号・住所・メールらしい文字は送る前に止める(回数も使わない)。
const ASSISTANT_CHAT_URL = `${SUPABASE_URL}/functions/v1/assistant-chat`;
const ASSISTANT_CHAT_LOG_KEY = 'mh_assistant_chat_log_v1';   // { [助手id]: [{ role:'user'|'assistant', text, e? }] }
const ASSISTANT_CHAT_MEMO_KEY = 'mh_assistant_chat_memo_v1'; // 前の形 { [助手id]: '120字までの文' }。読むだけで書かない
// 思い出メモを5つの欄に広げた(2026-10-14)。新しいキーに書く。前のキーの文は「前に話した話題」として引き継ぐ(CLAUDE.md ⑦)
const ASSISTANT_CHAT_MEMO_V2_KEY = 'mh_assistant_chat_memo_v2'; // { [助手id]: { likes, goals, events, topics, summary } }
const ASSISTANT_CHAT_MEMO_FIELDS = { likes:100, goals:100, events:100, topics:100, summary:160 };
const ASSISTANT_CHAT_LOG_LIMIT = 60;
// 送る会話は直近10往復まで。10件ずつ区切って送り、前のほうの並びを毎回変えない(中継役でキャッシュが効く)
const ASSISTANT_CHAT_SEND_STEP = 10;
const ASSISTANT_CHAT_SEND_MAX = 21;
const ASSISTANT_CHAT_TEXT_MAX = 200;
const assistantChatSendWindow = (list) => {
  if (list.length <= ASSISTANT_CHAT_SEND_MAX) return list;
  const start = Math.ceil((list.length - ASSISTANT_CHAT_SEND_MAX) / ASSISTANT_CHAT_SEND_STEP) * ASSISTANT_CHAT_SEND_STEP;
  return list.slice(start);
};
const ASSISTANT_CHAT_LINES = {
  sorry: 'ごめん、今うまく話せないや',
  personal: 'それは大事な情報だから、ここには書かないでね',
};
// 中継役(core.js)と同じものを見る。送る前に止めるため
const ASSISTANT_CHAT_PERSONAL_PATTERNS = [
  /0\d{1,4}[-‐ー−\s]?\d{1,4}[-‐ー−\s]?\d{3,4}/,
  /[0-9０-９]{10,11}/,
  /[\w.+-]+@[\w-]+\.[\w.-]+/,
  /〒?\s?\d{3}[-‐ー−]\d{4}/,
  /(都|道|府|県).{0,8}(市|区|町|村).{0,12}\d+[-‐ー−丁番]/,
];
const assistantChatLooksPersonal = (text) => ASSISTANT_CHAT_PERSONAL_PATTERNS.some(re => re.test(String(text || '')));

// 保存値が無い・壊れているときは空にする。助手ごとに最後の30件だけ残す
const normalizeAssistantChatLog = (raw) => {
  const out = {};
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out;
  for (const [id, list] of Object.entries(raw)) {
    if (!Array.isArray(list)) continue;
    out[id] = list
      .filter(m => m && (m.role === 'user' || m.role === 'assistant') && typeof m.text === 'string' && m.text)
      .map(m => ({ role: m.role, text: m.text.slice(0, 700), ...(typeof m.e === 'string' ? { e: m.e } : {}) }))
      .slice(-ASSISTANT_CHAT_LOG_LIMIT);
  }
  return out;
};
// 1人ぶんのメモをそろえる。前の形(文字)は「前に話した話題」へ入れる
const normalizeAssistantChatMemoOne = (memo) => {
  const out = {};
  for (const [k, max] of Object.entries(ASSISTANT_CHAT_MEMO_FIELDS)) out[k] = '';
  if (typeof memo === 'string') out.topics = memo.slice(0, ASSISTANT_CHAT_MEMO_FIELDS.topics);
  else if (memo && typeof memo === 'object' && !Array.isArray(memo)) {
    for (const [k, max] of Object.entries(ASSISTANT_CHAT_MEMO_FIELDS)) if (typeof memo[k] === 'string') out[k] = memo[k].slice(0, max);
  }
  return out;
};
// 新しいキーを優先し、無い助手のぶんだけ前のキーから引き継ぐ
const normalizeAssistantChatMemo = (rawV2, rawV1) => {
  const out = {};
  const v1 = rawV1 && typeof rawV1 === 'object' && !Array.isArray(rawV1) ? rawV1 : {};
  const v2 = rawV2 && typeof rawV2 === 'object' && !Array.isArray(rawV2) ? rawV2 : {};
  for (const [id, memo] of Object.entries(v1)) if (typeof memo === 'string') out[id] = normalizeAssistantChatMemoOne(memo);
  for (const [id, memo] of Object.entries(v2)) out[id] = normalizeAssistantChatMemoOne(memo);
  return out;
};

function AssistantChatWindow({ assistant, playerName, callName, bondLevel, bondTitle, bondTone, onExchange, onClose }) {
  const id = assistant && assistant.id;
  const [logs, setLogs] = React.useState({});
  const [memos, setMemos] = React.useState({});
  const [loaded, setLoaded] = React.useState(false);
  const [input, setInput] = React.useState('');
  const [sending, setSending] = React.useState(false);
  const [remaining, setRemaining] = React.useState(null);
  const listRef = React.useRef(null);
  React.useEffect(() => {
    let alive = true;
    (async () => {
      const [rawLog, rawMemo, rawMemoV2] = await Promise.all([storeGet(ASSISTANT_CHAT_LOG_KEY, {}, false), storeGet(ASSISTANT_CHAT_MEMO_KEY, {}, false), storeGet(ASSISTANT_CHAT_MEMO_V2_KEY, {}, false)]);
      if (!alive) return;
      setLogs(normalizeAssistantChatLog(rawLog));
      setMemos(normalizeAssistantChatMemo(rawMemoV2, rawMemo));
      setLoaded(true);
    })();
    return () => { alive = false; };
  }, []);
  const log = (logs[id] || []);
  React.useEffect(() => { const el = listRef.current; if (el) el.scrollTop = el.scrollHeight; }, [log.length, sending]);
  const lastExpression = (log.slice().reverse().find(m => m.role === 'assistant') || {}).e || 'happy';

  const saveLog = (next) => {
    setLogs(prev => {
      const all = { ...prev, [id]: next.slice(-ASSISTANT_CHAT_LOG_LIMIT) };
      try { storeSet(ASSISTANT_CHAT_LOG_KEY, all, false); } catch {}
      return all;
    });
  };
  const saveMemo = (memo) => {
    setMemos(prev => {
      const all = { ...prev, [id]: normalizeAssistantChatMemoOne(memo) };
      try { storeSet(ASSISTANT_CHAT_MEMO_V2_KEY, all, false); } catch {}
      return all;
    });
  };

  const send = async () => {
    const text = input.trim().slice(0, ASSISTANT_CHAT_TEXT_MAX);
    if (!text || sending || !loaded || !id) return;
    setInput('');
    // 個人情報らしいものは送らず、保存もしない
    if (assistantChatLooksPersonal(text)) {
      saveLog([...log, { role: 'assistant', text: ASSISTANT_CHAT_LINES.personal, e: 'troubled' }]);
      return;
    }
    const withUser = [...log, { role: 'user', text }];
    saveLog(withUser);
    setSending(true);
    let res = null;
    try {
      const breederId = await ensureBreederId();
      const r = await fetch(ASSISTANT_CHAT_URL, {
        method: 'POST',
        headers: SB_HEADERS,
        body: JSON.stringify({
          breederId: breederId || 'unknown',
          assistantId: id,
          messages: assistantChatSendWindow(withUser).map(m => ({ role: m.role, text: m.text })),
          ctx: { playerName, callName, bondLevel, bondTitle, bondTone, memo: memos[id] || null },
        }),
      });
      if (r.ok) res = await r.json();
    } catch {}
    setSending(false);
    const reply = res && typeof res.reply === 'string' && res.reply ? res.reply : ASSISTANT_CHAT_LINES.sorry;
    const e = res && typeof res.expression === 'string' ? res.expression : 'troubled';
    saveLog([...withUser, { role: 'assistant', text: reply, e }]);
    if (res && Number.isFinite(res.remainingToday)) setRemaining(res.remainingToday);
    // 本当に返事が来た1往復だけ、思い出メモと仲良し度に数える(断り・失敗は数えない)
    if (res && res.kind === 'reply') {
      if (res.memo && typeof res.memo === 'object') saveMemo(res.memo);
      if (typeof onExchange === 'function') onExchange();
    }
  };

  if (!assistant) return null;
  const accent = assistant.accent || '#f472b6';
  return (
    <div data-assistant-chat className="fixed inset-0 flex items-end sm:items-center justify-center bg-black/60 p-2" style={{ zIndex: 9000, paddingBottom: 'calc(0.5rem + env(safe-area-inset-bottom))' }} onClick={onClose}>
      <div className="w-full max-w-md max-h-[85vh] flex flex-col rounded-2xl border-2 bg-slate-950 text-slate-100 shadow-2xl" style={{ borderColor: accent }} onClick={ev => ev.stopPropagation()}>
        <div className="flex items-center gap-2 px-3 py-2 border-b border-slate-800 shrink-0">
          <img data-assistant-chat-face={lastExpression} src={assistantFaceSrc(assistant, lastExpression)} alt="" className="h-11 w-11 rounded-full border-2 object-cover bg-slate-900" style={{ borderColor: accent }}/>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-black" style={{ color: accent }}>{assistant.name}とおしゃべり</p>
            <p data-assistant-chat-remaining className="text-[10px] font-bold text-slate-400">{remaining == null ? '1日に話せる回数には上限があります' : `今日あと${remaining}回`}</p>
          </div>
          <button type="button" data-assistant-chat-close onClick={onClose} className="h-9 w-9 rounded-full border border-slate-600 text-slate-300 text-lg font-black active:scale-95" aria-label="閉じる">×</button>
        </div>
        <div ref={listRef} className="flex-1 overflow-y-auto mh-scroll px-3 py-2 space-y-2" style={{ minHeight: 180 }}>
          {log.length === 0 && <p className="text-[11px] text-slate-400 leading-relaxed">{assistant.greeting || '話しかけてみてね'}</p>}
          {log.map((m, i) => (
            <div key={i} data-assistant-chat-msg={m.role} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <p className={`max-w-[80%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-[12px] leading-relaxed ${m.role === 'user' ? 'bg-slate-700 text-white' : 'bg-slate-800/80 text-slate-100 border'}`} style={m.role === 'user' ? undefined : { borderColor: accent }}>{m.text}</p>
            </div>
          ))}
          {sending && <p data-assistant-chat-sending className="text-[11px] text-slate-400">{assistant.name}が考え中…</p>}
        </div>
        <div className="flex items-end gap-2 border-t border-slate-800 p-2 shrink-0">
          <textarea data-assistant-chat-input value={input} maxLength={ASSISTANT_CHAT_TEXT_MAX} rows={2} onChange={ev => setInput(ev.target.value)}
            placeholder="話しかけてみよう(名前や住所などは書かないでね)" className="flex-1 resize-none rounded-xl border border-slate-700 bg-slate-900 px-2 py-1.5 text-[12px] text-white"/>
          <button type="button" data-assistant-chat-send disabled={sending || !loaded || !input.trim()} onClick={send}
            className="min-h-[44px] rounded-xl px-3 text-[12px] font-black text-white active:scale-95 disabled:opacity-40" style={{ background: accent }}>送る</button>
        </div>
      </div>
    </div>
  );
}

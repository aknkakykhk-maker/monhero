// ===== 助手(ナビゲーター) ここから =====
// 助手の名前・画像・セリフは data/assistants.js が持つ。ここは表示だけを受け持つ。
// どの画面でも <AssistantBubble scene="キー"/> の1行で同じ見た目の吹き出しを出せる。
// (今後 HOME・神殿・マーケット・M/B管理・バトル・設定・ランキング・イベント案内・
//  ギフト・ミッション・チュートリアルへ広げる想定)
const ASSISTANT_LIST = (typeof ASSISTANTS !== 'undefined' && Array.isArray(ASSISTANTS)) ? ASSISTANTS : [];
const ASSISTANT_SCENE_MAP = (typeof ASSISTANT_SCENES !== 'undefined' && ASSISTANT_SCENES) || {};
const ASSISTANT_FALLBACK = { id:'', name:'助手', image:null, emoji:'💬', accent:'#f472b6', greeting:'' };
// 再生のときだけ話し手として出る登場人物(ジャックなど)。助手ではないので ASSISTANT_LIST には入れない
const STORY_GUEST_LIST = (typeof STORY_GUEST_SPEAKERS !== 'undefined' && Array.isArray(STORY_GUEST_SPEAKERS)) ? STORY_GUEST_SPEAKERS : [];
// 助手を先に探し、いなければ登場人物、それもなければ今までどおり既定の助手へ
// お話の行の衣装・シークレット(data/assistants.js の eventScriptForPlayer が付ける「助手id@衣装@secret」)。
//   衣装は絵のフォルダだけを替え、secret は名前を「？？？」にして絵を影にする(AssistantFace が secret を見て黒く塗る)。毎回同じものを返す
const STORY_VARIANT_CACHE = new Map();
const storyVariantWho = (id) => {
  if (typeof id !== 'string' || !id.includes('@')) return null;
  if (STORY_VARIANT_CACHE.has(id)) return STORY_VARIANT_CACHE.get(id);
  const [baseId, ...flags] = id.split('@');
  const base = ASSISTANT_LIST.find(a => a.id === baseId);
  if (!base) return null;
  const dirs = (typeof STORY_OUTFIT_DIRS !== 'undefined' && STORY_OUTFIT_DIRS) || {};
  const outfit = flags.find(f => dirs[f]);
  const secret = flags.includes('secret');
  const who = { ...base, id, baseId, ...(outfit ? { imageDir: dirs[outfit], tempImageDir: undefined } : {}), ...(secret ? { name: '？？？', secret: true, accent: '#8a7a5c', emoji: '❔' } : {}) };
  STORY_VARIANT_CACHE.set(id, who);
  return who;
};
const assistantById = (id) => ASSISTANT_LIST.find(a => a.id === id)
  || storyVariantWho(id)
  || STORY_GUEST_LIST.find(a => a.id === id)
  || ASSISTANT_LIST.find(a => a.id === (typeof DEFAULT_ASSISTANT_ID !== 'undefined' ? DEFAULT_ASSISTANT_ID : ''))
  || ASSISTANT_LIST[0] || ASSISTANT_FALLBACK;
// 台本に出てくる話し手(顔を並べる人)。助手に加えて、台本に出てくる登場人物も並べる
// 衣装・シークレットの行(「助手id@…」)は、元の助手として数える
const storyBaseWho = (id) => (typeof id === 'string' ? id.split('@')[0] : id);
const storyCastOf = (script) => [...ASSISTANT_LIST, ...STORY_GUEST_LIST].filter(who => (script || []).some(l => l && storyBaseWho(l.who) === who.id));
// 助手の「ふつう」の表情の絵(outfit を渡すと、その衣装のフォルダの絵)。登録が無ければ null
const storyAssistantArtOf = (id, outfit) => {
  const who = ASSISTANT_LIST.find(a => a && a.id === id);
  if (!who || !who.imageDir || !who.imagePrefix) return null;
  const dirs = (typeof STORY_OUTFIT_DIRS !== 'undefined' && STORY_OUTFIT_DIRS) || {};
  const dir = outfit ? dirs[outfit] : who.imageDir;
  return dir ? `${dir}/${who.imagePrefix}_normal.PNG` : null;
};
// お話の真ん中に出すモンスターの全身の絵(台本の monsters の id → 絵。2026-10-27「推しに会える夜」)。足すときはここへ1行
const STORY_MONSTER_ART = Object.freeze({
  Kyubi: typeof KYUBI_IMG !== 'undefined' ? KYUBI_IMG : null,
  Orihime: typeof ORIHIME_IMG !== 'undefined' ? ORIHIME_IMG : null,
  // イベント「鍵の向こう側へ」(2026-11-02)のパンドラ。Pandora は pose:'idle' で待機アニメ(翼・尾が動く)。
  //   PandoraShadow … 正体が分かる前の影 / PandoraAngel・PandoraDevil … 天使側・悪魔側に分かれた全身(pose:'splitL'/'splitR'・'mergeL'/'mergeR')
  Pandora: typeof PANDORA_IMG !== 'undefined' ? PANDORA_IMG : null,
  PandoraShadow: typeof PANDORA_SHADOW_IMG !== 'undefined' ? PANDORA_SHADOW_IMG : null,
  PandoraAngel: typeof PANDORA_ANGEL_IMG !== 'undefined' ? PANDORA_ANGEL_IMG : null,
  PandoraDevil: typeof PANDORA_DEVIL_IMG !== 'undefined' ? PANDORA_DEVIL_IMG : null,
  // えるびんの登場のお話(2026-11-05)の、胸から上の大きい立ち絵(384x512)。ErubinSekiyuou … 衣装『石油王』(初めて会う場面) / Erubin … 着替えたあとの通常の服
  //   絵の場所は助手の登録(imageDir・imagePrefix)と衣装のフォルダ(STORY_OUTFIT_DIRS)から作る(パスを画面の側に書かない)
  Erubin: storyAssistantArtOf('erubin'),
  ErubinSekiyuou: storyAssistantArtOf('erubin', 'sekiyuou'),
});
// お話の台詞を、決まった行数に収まるページへ分ける(2026-11-02 社長「セリフが長ければページ数増やせばいいだけ」)。
//   上部ゾーン(ゲストの吹き出し)・下部ゾーン(台詞の欄)の高さを固定にしたので、収まらない台詞は「次へ」で送る次のページにする。
//   分けるのは文の切れ目(「。」「！」「？」のあと)。1文で収まらないときだけ「、」のあと。言葉の途中では切らない。台本の字は変えない(表示のときだけ)
//   cpl … 1行に入る字数の見込み(全角1・半角0.55で数える) / maxLines … 行数
// 3つのゾーンのお話の下部ゾーンで、話していない助手の顔の列も小さく1行で残すか(2026-11-03 社長「下部を喋る人を下部横において」の案。
//   false = 顔の列は出さず、話している助手の顔だけを台詞の欄の左に置く / true = その上に小さい顔の列を1行残す)
// 2026-11-03 社長が案B(小さい顔の列を残す)を選んだ。列に並べるのは「その場面にいる人」だけ(60-app.jsx の storyCastNow)
const STORY_BOTTOM_KEEP_ROW = true;
// お話の締め(2026-11-03 社長「ストーリーイベントの最後のページが終わるとあっけないから工夫がほしい」)。続きもののお話(id が …_ep1 〜)だけ。
//   'card' = 終わりの札 / 'next' = 札 + 次のお話の予告 + 次にやることのボタン / 'pull' = 最後の場面を引いて暗転してから 'next' / 'none' = 出さない
const STORY_ENDING_STYLE = 'pull';
// お話の始まり(2026-11-04 社長「イベントストーリーのはじまりもおわりみたいにこだわって」)。終わりの札と対になる幕開け。
//   'title' = 暗い画面に題字が浮かび、場面が近づきながら明るくなって最初のページへ / 'recap' = 'title' + 前のお話の題名・イベントの残り時間 /
//   'iris' = 'title' のあと、鍵穴から広がるように丸く場面が開く / 'none' = 出さない。どれもタップで飛ばせる
const STORY_OPENING_STYLE = 'iris';
// 題(「鍵の向こう側へ 第3話 ～大嫌いで、大好き～」)を、シリーズ名・何話・副題に分ける
//   続きもの(「第◯話」「第◯部」「終章」がある題)は { series, ep, sub, serial:true }。単発のお話(「MFバトルカード ～物置の古い箱～」)は ep に題の前半、sub に「～…～」
//   final … 「終章」(ハロウィンのエンディングA/B・パンドラ第8話)。次のお話は出さず「おしまい」にする
const storyEpisodeTitleParts = (title) => {
  const t = String(title || '').trim();
  const m = t.match(/^(.*?)\s*(第[\d.]+[話部][^～\s]*|終章)\s*(～.*～)?\s*$/);
  if (m) return { series: m[1] || '', ep: m[2] || '', sub: m[3] || '', serial: true, final: /終章/.test(m[2] || '') };
  const s = t.match(/^(.*?)\s*(～.*～)\s*$/);
  return s ? { series: '', ep: s[1] || t, sub: s[2] || '', serial: false, final: false } : { series: '', ep: t, sub: '', serial: false, final: false };
};
// 'YYYY-MM-DD HH:MM'(日本時間)を時刻へ。読めなければ NaN
const storyJstMs = (text) => Date.parse(`${String(text || '').trim().replace(' ', 'T')}:00+09:00`);
const storyTextUnits = (s) => [...String(s)].reduce((a, ch) => a + (/[\x20-\x7e｡-ﾟ]/.test(ch) ? 0.55 : 1), 0);
// ちょうど行の終わりで割り切れる字数は、言葉の切れ目で折ると1行増えやすい(第1話「遊んだ回数も…報われるわけだ」42字が14字×3行で4行になった)。1.5字ぶん余分に見込む
const storyTextLines = (s, cpl) => String(s).split('\n').reduce((a, seg) => a + Math.max(1, Math.ceil((storyTextUnits(seg) + 1.5) / Math.max(1, cpl))), 0);
const storySplitPages = (text, cpl, maxLines) => {
  const s = String(text ?? '');
  if (!s || storyTextLines(s, cpl) <= maxLines) return [s];
  const tidy = (t) => t.replace(/^[\s\n]+|[\s\n]+$/g, '');
  const pack = (pieces) => {
    const out = [];
    let cur = '';
    for (const piece of pieces) {
      const cand = cur + piece;
      if (tidy(cur) && storyTextLines(tidy(cand), cpl) > maxLines) { out.push(cur); cur = piece; } else cur = cand;
    }
    if (tidy(cur)) out.push(cur);
    return out;
  };
  const sentences = (s.match(/[^。！？!?\n]*(?:[。！？!?]+[」』）)♪♡〜～ｗw…]*|\n|$)/g) || [s]).filter(Boolean);
  const pages = pack(sentences).flatMap((page) => (storyTextLines(tidy(page), cpl) > maxLines
    // 半角の「,」では分けない(曲名「Altar of the World Tree, Beneath …」の途中で切れた)
    ? pack((page.match(/[^、，\n]*(?:[、，]+|\n|$)/g) || [page]).filter(Boolean)) : [page]));
  const out = pages.map(tidy).filter((t) => t.length);
  return out.length ? out : [s];
};
// お話の台詞を、文の切れ目ごとのかたまりに分ける(2026-11-04 社長「セリフの改行の位置がちょこちょこ悪い」)。
//   収まる幅があるのに文の途中(「見られたくなかった／んじゃないかな」「ももは／ドラちゃんの」)で折れていたので、
//   かたまり(。！？の後・空白・「」のまとまり。長すぎるかたまりは、さらに「、」の後)を1つずつ inline-block にして、そこで折れるようにする。
//   cap は1行に入る字数(実際の欄の幅から)。かたまりで折ると maxLines を超えそうなら null(今までどおりの折り方)
const STORY_EMOTICON_HEAD_RE = /^[(（][^ぁ-んァ-ヶ一-龠a-zA-Z0-9()（）]{1,10}[)）][0-9９ｂb]?/;
// 台詞を、途中で折らない所(顔文字「(˘ω˘)」・数と単位「5ターン目」「1枚」)とそれ以外に分ける(emo の所は折らずに描く)
const STORY_NOBREAK_SPLIT_RE = /([(（][^ぁ-んァ-ヶ一-龠a-zA-Z0-9()（）]{1,10}[)）][0-9９ｂb]?|[0-9０-９][0-9０-９,.]*(?:ターン目?|段階|回目?|体|枚|位|曲|話|日|時|周|人|個|倍|秒|分|つ))/;
const storyEmoticonParts = (text) => String(text ?? '').split(STORY_NOBREAK_SPLIT_RE).filter((x) => x !== '').map((x, i, all) => ({ t: x, emo: STORY_NOBREAK_SPLIT_RE.test(x) && x.match(STORY_NOBREAK_SPLIT_RE)[0] === x }));
const storyChunkLines = (text, cap, maxLines) => {
  const s = String(text ?? '');
  if (!s || s.includes('\n') || !(cap > 0) || storyTextUnits(s) <= cap) return null;
  const split = (src, soft) => {
    const chars = [...src], out = [];
    let cur = '', sp = false, depth = 0;
    const push = () => { if (cur) out.push({ t: cur, sp }); cur = ''; sp = false; };
    for (let i = 0; i < chars.length; i++) {
      const ch = chars[i], nx = chars[i + 1] ?? '';
      // 空白で分けるのは、文が終わった後(「！ 」「？ 」「…… 」)だけ。「SKY TAP」のような語のあいだでは分けない
      if ((ch === ' ' || ch === '\u3000') && depth === 0 && (!cur || /[。！？!?…」』）)♪♡〜～ｗw\p{Extended_Pictographic}]$/u.test(cur))) { push(); sp = true; continue; }
      // 顔文字「(˘ω˘)」「(´ー`*)」は、中の字で分けない(描くときも途中で折らない。storyEmoticonParts)
      const emo = depth === 0 && /[(（]/.test(ch) ? chars.slice(i).join('').match(STORY_EMOTICON_HEAD_RE) : null;
      if (emo) { cur += emo[0]; i += [...emo[0]].length - 1; continue; }
      if ((ch === '「' || ch === '『') && depth === 0 && !soft && cur) push();
      cur += ch;
      if (ch === '「' || ch === '『') depth++;
      else if ((ch === '」' || ch === '』') && depth > 0) depth--;
      if (!nx || depth > 0) continue;
      if (/[。！？!?]/.test(ch) && !/[。！？!?」』）)♪♡〜～ｗw]/.test(nx)) push();
      else if (/[」』]/.test(ch) && /[「『]/.test(nx)) push();
      else if (soft && /[、，]/.test(ch) && !/[、，」』）)]/.test(nx)) push();
    }
    push();
    return out;
  };
  const chunks = split(s, false).flatMap((c) => {
    if (storyTextUnits(c.t) <= cap) return [c];
    const sub = split(c.t, true);
    if (sub.length) sub[0] = { ...sub[0], sp: c.sp };
    return sub;
  });
  // 字の無いかたまり(「✨」「……」)・2字以下のかたまり(「だ。」)は、前のかたまりにくっつける(それだけが行に残らないように)
  for (let i = chunks.length - 1; i > 0; i--) {
    const c = chunks[i];
    if (!/[ぁ-んァ-ヶ一-龠々a-zA-Z0-9０-９]/.test(c.t) || storyTextUnits(c.t) <= 2) {
      chunks[i - 1] = { ...chunks[i - 1], t: chunks[i - 1].t + (c.sp ? ' ' : '') + c.t };
      chunks.splice(i, 1);
    }
  }
  if (chunks.length < 2) return null;
  // 半角の字は幅の見込みがずれやすいので、1字ぶん余らせて見る。入りきらない長いかたまりは折らずに流す(flow)
  // 絵文字(🔥✨)は字1つより幅が広いので、1つにつき 0.6字ぶん足して見る
  const unitsOf = (t) => storyTextUnits(t) + (/[\x21-\x7e]/.test(t) ? 1 : 0) + 0.6 * ((String(t).match(/\p{Extended_Pictographic}/gu) || []).length);
  let lines = 0, rem = 0;
  for (const c of chunks) {
    const own = unitsOf(c.t), u = own + (c.sp && rem > 0 ? 0.5 : 0);
    if (own > cap) {
      // 新しい行から始めても行数が増えないなら、新しい行から(文の頭を行の頭にそろえる)。増えるなら前の文の後ろへ流す
      //   流すときは言葉の切れ目でしか折れないので、行の終わりが空きやすい(1行につき2字・前の行の残りは3字ぶん少なく見る)
      const fresh = lines + Math.ceil(own / (cap - 1));
      const left = lines > 0 ? u - Math.max(0, rem - 3) : u;
      const flowLines = lines + Math.ceil(left / (cap - 2));
      if (fresh <= flowLines) { lines = fresh; rem = 0; }
      else { c.flow = true; rem = Math.max(0, (flowLines - lines) * (cap - 2) - left - 2); lines = flowLines; }
    }
    else if (lines > 0 && u <= rem) rem -= u;
    else { lines += 1; rem = cap - own; }
  }
  return lines <= maxLines ? chunks : null;
};
// お話の層の位置を測って、いちばん外側の箱([data-event-story])の CSS 変数へ書く ref。
// 上のステージの下端(--story-stage-bottom)と下の窓の高さ(--story-sheet-h)で、真ん中のモンスターの置き場を決める。
// ★動きの途中(登場・揺れ)のずれを拾わないよう、transform の効かない offsetTop / offsetHeight で測る。大きさが変わったら測り直す
const storyMeasureRef = (name, kind) => (el) => {
  if (!el) return;
  const root = el.closest('[data-event-story]');
  if (!root) return;
  const put = () => root.style.setProperty(name, `${Math.round(kind === 'bottom' ? el.offsetTop + el.offsetHeight : el.offsetHeight)}px`);
  put();
  if (!el.__mhStoryRo && typeof ResizeObserver === 'function') { el.__mhStoryRo = new ResizeObserver(put); el.__mhStoryRo.observe(el); }
};
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
// assistantId … 話している助手。助手ごとに既定の呼び方が違うので必ず渡す(ドラは呼び捨て、ききは「ちー」など)
const assistantSpeakText = (text, name, level, callStyleId, assistantId) => (typeof assistantSpeak === 'function')
  ? assistantSpeak(text, name, level, callStyleId, assistantId)
  : String(text == null ? '' : text).replace(/\{name\}/g, String(name || 'キミ'));
// 表情ごとの顔画像のパスを決める。用意されていない表情は data/assistants.js 側で
// 既定の表情(normal)へ落ちる。この関数が無い(古いデータの)ときは画像なし扱いにする
const assistantFaceSrc = (who, expression) => (typeof assistantFaceImage === 'function')
  ? (assistantFaceImage(who, expression) || who.image || null)
  : (who.image || null);
// 助手の顔。表情の画像が読めなかったときは既定の表情へ、それも駄目なら絵文字で代用する。
// size は px。who.imageFit が 'contain' の話し手(全身の絵のゲスト)は、枠いっぱいに切り抜かず全身を収める
const AssistantFace = ({ who, size = 88, accent, expression = null }) => {
  const wanted = assistantFaceSrc(who, expression);
  const fallback = assistantFaceSrc(who, null);
  const [src, setSrc] = useState(wanted);
  // 場面が変わって表情が切り替わったら読み直す
  useEffect(() => { setSrc(assistantFaceSrc(who, expression)); }, [who.id, expression]);
  return (
    <div className="relative shrink-0 rounded-2xl overflow-hidden border-2 flex items-center justify-center bg-black/50"
         // シークレットの話し手は、枠の中を夕方の砂漠の空の色にして、影(頭布と髪の形)が浮かぶようにする(暗い枠に暗い影だと、空っぽの箱に見えた。2026-11-05 社長「？はなしのほうがいい」)
         style={{ width:`${size}px`, height:`${size}px`, borderColor:accent, boxShadow:`0 0 12px ${accent}55`, ...(who.secret ? { background:'linear-gradient(180deg, #9a5a4a 0%, #e7a25c 55%, #f4c784 100%)' } : {}) }}>
      {src
        ? <img src={src} alt={who.name} className={`w-full h-full ${who.imageFit === 'contain' ? 'object-contain p-0.5' : 'object-cover'}`}
               data-story-secret={who.secret ? '1' : undefined}
               // シークレットの話し手(storyVariantWho)は、誰か分からないように影で描く(こげ茶の塗りつぶし)
               style={who.secret ? { filter:'brightness(0) invert(.12) sepia(1) saturate(1.2)' } : undefined}
               onError={()=>setSrc(src === fallback ? null : fallback)}/>
        : <span style={{ fontSize:`${Math.round(size * 0.5)}px`, lineHeight:1 }}>{who.emoji}</span>}
    </div>
  );
};
// ヘルプ本文のブロックを描く。ヘルプ画面と助手の詳細で同じ見た目にするため1か所にまとめる
// ヘルプの文は言葉の切れ目で折る(2026-10-24 窓口「部品を通さずに描いている文の多い画面」の1番目)。
// 長い段落なので行の長さはそろえず(balance は使わない)、言葉の途中で折らないことだけを守る。文字列でないもの(絵・表の部品)はそのまま
const helpWrap = (x) => (typeof x === 'string' && typeof jaWrap === 'function'
  ? <span style={typeof JA_WRAP_STYLE !== 'undefined' ? JA_WRAP_STYLE : undefined}>{jaWrap(x)}</span> : x);
const renderHelpBlocks = (blocks, accent) => (blocks || []).map((b, i) => {
  // その端末で条件を満たした人だけの本文(playerFlag)は、満たしていなければ見出しごと出さない
  if(b&&b.playerFlag&&!(typeof helpPlayerFlagOn==='function'&&helpPlayerFlagOn(b.playerFlag))) return null;
  // 動画(2026-10-13・HELL のプレイ映像)。video は data/rhythm-mode.js の RHYTHM_HELL_GUIDE_VIDEOS の名前。読めないときは見出しだけ残る
  if(b.t==='video') return <div key={i} data-help-video className="rounded-2xl p-3 border" style={{borderColor:`${accent}55`,backgroundColor:'rgba(0,0,0,0.5)'}}>{b.title&&<div className="text-[11px] font-black text-white mb-2">{b.title}</div>}{typeof RhythmHellVideo==='function'&&<RhythmHellVideo id={b.video}/>}{b.text&&<div className="text-[12px] text-slate-300 leading-relaxed mt-2">{helpWrap(b.text)}</div>}</div>;
  if(b.t==='note') return <div key={i} className="rounded-2xl p-4 border" style={{borderColor:`${accent}55`,backgroundColor:'rgba(0,0,0,0.5)'}}>{b.title&&<div className="text-[11px] font-black text-white mb-1">{b.title}</div>}<div className="text-[12px] text-slate-300 leading-relaxed">{helpWrap(b.text)}</div></div>;
  if(b.t==='list') return <ul key={i} className="text-[12px] text-slate-300 leading-relaxed space-y-2 list-disc pl-5">{b.items.map((x,j)=><li key={j}>{helpWrap(x)}</li>)}</ul>;
  if(b.t==='steps') return <div key={i} className="space-y-2.5">{b.items.map((x,j)=>(<div key={j} className="flex items-start gap-3"><span className="shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-black text-black" style={{backgroundColor:accent}}>{j+1}</span><span className="text-[12px] text-slate-300 leading-relaxed pt-0.5">{helpWrap(x)}</span></div>))}</div>;
  // 表の行の3つ目 {notes:[…]} は、その行のノーツの見本の絵(2026-10-21)。演奏画面と同じ描き方の RhythmNoteSwatch で、見出しの上に並べる
  if(b.t==='kv') return <div key={i} className="rounded-2xl bg-black/50 border border-white/5 overflow-hidden">{b.rows.map((r,j)=>(<div key={j} className={`flex gap-3 px-4 py-2.5 ${j>0?'border-t border-white/5':''}`}><span className="shrink-0 w-24 text-[11px] font-black text-slate-400 leading-tight">{Array.isArray(r[2]?.notes)&&r[2].notes.length>0&&<span data-help-note-swatches className="mb-1 flex gap-1">{r[2].notes.map(k=><RhythmNoteSwatch key={k} kind={k} width={r[2].notes.length>1?44:54} height={r[2].notes.length>1?34:42}/>)}</span>}{r[0]}</span><span className="flex-1 text-[11px] text-white leading-relaxed">{helpWrap(r[1])}</span></div>))}</div>;
  // 実データから作る表。難易度・アイテム・ログボ・ミッションはここで全件出るので取りこぼさない
  if(b.t==='data'){const rows=helpDataRows(b.id);if(rows.length===0)return null;return(<div key={i}><div className="text-[10px] font-black mb-1 tracking-wider" style={{color:accent}}>{HELP_DATA_TITLES[b.id]||''}</div><div className="rounded-2xl bg-black/50 border border-white/5 overflow-hidden">{rows.map((r,j)=>(<div key={j} className={`flex gap-3 px-4 py-2.5 ${j>0?'border-t border-white/5':''}`}><span className="shrink-0 w-24 text-[11px] font-black text-slate-400 leading-tight">{r[0]}</span><span className="flex-1 text-[11px] text-white leading-relaxed">{helpWrap(r[1])}</span></div>))}</div></div>);}
  return <p key={i} className="text-[12px] text-slate-200 leading-relaxed">{helpWrap(b.text)}</p>;
});
// ---- 助手のひとことを出す回数(2026-10-10・改善 G6「助手の吹き出しが、ほぼ全画面に出たまま」→ 社長が選択肢1) ----
//   'ALWAYS' … いつも(これまでどおり。既定。保存が無い既存ユーザーも同じ見え方)
//   'DAILY'  … 同じ画面のひとことは1日1回だけ(朝4:00で戻る)
//   'OFF'    … 出さない
// ★止めるのは「画面ごとの決まったひとこと」だけ。次は設定にかかわらず出す(大事な案内まで消さないため):
//   ・文を直接渡す吹き出し(line=。はじめての名前決めの案内・ヘルプ画面)と、最初から開く吹き出し(defaultOpen)
//   ・一度きりの案内の場面(名前が …Intro で終わるもの・quickRhythmBackground・rhythmWeeklyEvent)
//   ・HOMEの助手(scene="home"。お知らせや話しかけの入口)
//   助手の告知(アップデートのお知らせ)はこの部品を使っていないので、この設定の影響を受けない
// 保存は新しいキーだけ(既存の mh_* は触らない・CLAUDE.md ⑦)。読むときは必ず正規化する
const ASSISTANT_BUBBLE_MODES = ['ALWAYS', 'DAILY', 'OFF'];
const normalizeAssistantBubbleMode = (value) => (ASSISTANT_BUBBLE_MODES.includes(String(value)) ? String(value) : 'ALWAYS');
const ASSISTANT_BUBBLE_MODE_KEY = 'mh_assistant_bubble_mode_v1';
const ASSISTANT_BUBBLE_SEEN_KEY = 'mh_assistant_bubble_seen_v1';
const ASSISTANT_BUBBLE_MODE_LABELS = Object.freeze([
  { id: 'ALWAYS', label: 'いつも', note: 'これまでどおり' },
  { id: 'DAILY', label: '1日1回', note: '同じ画面は1日1回' },
  { id: 'OFF', label: '出さない', note: 'ひとことを隠す' },
]);
const ASSISTANT_BUBBLE_ALWAYS_SCENES = Object.freeze(['home', 'quickRhythmBackground', 'rhythmWeeklyEvent']);
const assistantBubbleAlwaysShown = (scene) => !scene || ASSISTANT_BUBBLE_ALWAYS_SCENES.includes(scene) || /Intro$/.test(String(scene));
// 日の区切りは朝4:00(日本時間。jstDayKey4 と同じ。2026-11-07 に5:00からそろえた)
const assistantBubbleDayKey = (now = Date.now()) => new Date(Number(now) + (9 - 4) * 3600000).toISOString().slice(0, 10);
// 見た場面の記録 { day, scenes:[場面のキー] }。日が変わったもの・壊れたものは空にする
const normalizeAssistantBubbleSeen = (raw, day) => (raw && typeof raw === 'object' && raw.day === day && Array.isArray(raw.scenes))
  ? { day, scenes: raw.scenes.filter((x) => typeof x === 'string').slice(0, 300) }
  : { day, scenes: [] };
const ASSISTANT_BUBBLE_STORE = (() => {
  let state = { mode: 'ALWAYS', seen: null, loaded: false };
  let loading = null;
  const listeners = new Set();
  const emit = () => listeners.forEach((fn) => { try { fn(state); } catch (_) { /* 画面側の失敗で止めない */ } });
  return {
    get: () => state,
    load() {
      if (loading) return loading;
      loading = (async () => {
        let mode = 'ALWAYS', seen = null;
        try { mode = normalizeAssistantBubbleMode(await storeGet(ASSISTANT_BUBBLE_MODE_KEY, 'ALWAYS', false)); } catch (_) { /* 読めなければ「いつも」 */ }
        try { seen = await storeGet(ASSISTANT_BUBBLE_SEEN_KEY, null, false); } catch (_) { /* 読めなければ空 */ }
        state = { mode, seen, loaded: true };
        emit();
      })();
      return loading;
    },
    subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    setMode(next) {
      state = { ...state, mode: normalizeAssistantBubbleMode(next) };
      emit();
      void storeSet(ASSISTANT_BUBBLE_MODE_KEY, state.mode).catch(() => {});
    },
    // 見たことだけ覚える(知らせない。いま出ている吹き出しを途中で消さないため)
    markSeen(scene) {
      const day = assistantBubbleDayKey();
      const cur = normalizeAssistantBubbleSeen(state.seen, day);
      if (!scene || cur.scenes.includes(scene)) return;
      const next = { day, scenes: [...cur.scenes, scene] };
      state = { ...state, seen: next };
      void storeSet(ASSISTANT_BUBBLE_SEEN_KEY, next).catch(() => {});
    },
  };
})();
const useAssistantBubbleState = () => {
  const [state, setState] = useState(() => ASSISTANT_BUBBLE_STORE.get());
  useEffect(() => {
    const off = ASSISTANT_BUBBLE_STORE.subscribe(setState);
    setState(ASSISTANT_BUBBLE_STORE.get());
    void ASSISTANT_BUBBLE_STORE.load();
    return off;
  }, []);
  return state;
};
// ── 吹き出しを小さくたたむ(2026-10-26 開発部・マーケットのビートP交換所「押すと小さくたためて、たたんだことを覚える」) ──
// collapseKey を渡した吹き出しだけ、右上の「たたむ」で顔と小さな札だけになり、たたんだことを端末に覚える。
// 保存: 新しいキー mh_bubble_collapsed_v1 = { collapseKey: true }(たたんだものだけ入れる。無い・壊れていれば全部ひらいたまま)。既存のキーは触らない
const ASSISTANT_BUBBLE_COLLAPSED_KEY = 'mh_bubble_collapsed_v1';
const normalizeBubbleCollapsed = (raw) => {
  const out = {};
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) Object.keys(raw).slice(0, 200).forEach((k) => { if (raw[k] === true) out[String(k).slice(0, 80)] = true; });
  return out;
};
const BUBBLE_COLLAPSE_STORE = (() => {
  let state = { map: {}, loaded: false };
  let loading = null;
  const listeners = new Set();
  const emit = () => listeners.forEach((fn) => { try { fn(state); } catch (_) { /* 画面側の失敗で止めない */ } });
  return {
    get: () => state,
    load() {
      if (loading) return loading;
      loading = (async () => {
        let map = {};
        try { map = normalizeBubbleCollapsed(await storeGet(ASSISTANT_BUBBLE_COLLAPSED_KEY, {}, false)); } catch (_) { /* 読めなければ全部ひらく */ }
        state = { map, loaded: true };
        emit();
      })();
      return loading;
    },
    subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    set(key, collapsed) {
      if (!key) return;
      const map = { ...state.map };
      if (collapsed) map[key] = true; else delete map[key];
      state = { ...state, map };
      emit();
      void storeSet(ASSISTANT_BUBBLE_COLLAPSED_KEY, map).catch(() => {});
    },
  };
})();
// [たたんでいるか, たたむ/ひらく]。collapseKey が無ければ常にひらいたまま(今までどおり)
const useBubbleCollapse = (collapseKey) => {
  const [state, setState] = useState(() => BUBBLE_COLLAPSE_STORE.get());
  useEffect(() => {
    if (!collapseKey) return undefined;
    const off = BUBBLE_COLLAPSE_STORE.subscribe(setState);
    setState(BUBBLE_COLLAPSE_STORE.get());
    void BUBBLE_COLLAPSE_STORE.load();
    return off;
  }, [collapseKey]);
  const collapsed = !!collapseKey && state.map[collapseKey] === true;
  return [collapsed, (next) => BUBBLE_COLLAPSE_STORE.set(collapseKey, !!next)];
};
// 助手の吹き出し。どの画面でもこれ1つ置けばよい。
//   scene       … data/assistants.js の ASSISTANT_SCENES のキー(これだけで完結する)
//   line/detail … sceneを使わず直接セリフと詳細を渡したいとき
//   helpRef     … 'カテゴリid/項目id'。詳細としてヘルプ本文をそのまま開く
//   accent      … 画面のテーマ色に合わせたいとき(省略すると助手ごとの色)
//   compact     … 縦の場所が取れない画面(選択画面・リザルト)向けの小さい表示
//   defaultOpen … 最初から詳細を開いた状態にする(チュートリアルなどで使う)
//   collapseKey … 渡すと吹き出しを小さくたためる(たたんだことを mh_bubble_collapsed_v1 に覚える)。画面ごとに別のキー
//   collapseHidden … たたんだら札も出さず何も描かない(ひらく入口が画面の別の所にあるとき。ヘルプの上の助手の顔)
// footerSpace … 吹き出しの下の行の左に空ける幅(px)。HOME はそこへ「💬 おしゃべり」を重ねる(2026-10-16)。指定が無ければ今までどおり
// 吹き出しの本文の折り方(jaWrap・JA_LABEL_STYLE は 41-screen-ui.jsx)。一部だけを描く検査では無いことがあるので、無ければそのまま出す
const bubbleWrap = (text) => (typeof jaWrap === 'function' ? jaWrap(text) : text);
// (どちらも後ろの部品で宣言されるので、読み込み時ではなく描くときに引く)
const bubbleWrapStyle = () => (typeof JA_LABEL_STYLE !== 'undefined' ? JA_LABEL_STYLE : undefined);
const AssistantBubble = ({ scene=null, assistantId=null, line=null, detail=null, helpRef=null, condition=null, expression=null, accent=null, faceSize=null, compact=false, defaultOpen=false, footerSpace=0, maxLines=0, collapseKey=null, collapseHidden=false }) => {
  const [open, setOpen] = useState(defaultOpen);
  const [collapsed, setCollapsed] = useBubbleCollapse(collapseKey);
  // 設定「助手のひとこと」で隠すか。開いた画面ごとに1回だけ決め、見ているあいだに消えたり出たりしない
  const bubbleSetting = useAssistantBubbleState();
  const bubbleExempt = !!line || defaultOpen || assistantBubbleAlwaysShown(scene);
  const bubbleDecisionRef = useRef(null);
  if (!bubbleExempt && bubbleSetting.loaded && bubbleDecisionRef.current?.key !== `${scene}|${bubbleSetting.mode}`) {
    const mode = bubbleSetting.mode;
    const seen = normalizeAssistantBubbleSeen(ASSISTANT_BUBBLE_STORE.get().seen, assistantBubbleDayKey());
    bubbleDecisionRef.current = { key: `${scene}|${mode}`, hide: mode === 'OFF' || (mode === 'DAILY' && seen.scenes.includes(scene)) };
  }
  const bubbleHidden = !bubbleExempt && !!bubbleDecisionRef.current?.hide;
  useEffect(() => {
    if (!bubbleExempt && bubbleSetting.loaded && bubbleSetting.mode === 'DAILY' && !bubbleHidden) ASSISTANT_BUBBLE_STORE.markSeen(scene);
  }, [scene, bubbleSetting.loaded, bubbleSetting.mode, bubbleHidden, bubbleExempt]);
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
  // 連打のセリフは助手ごと(書いていない助手はみゅあのぶん)
  const spamLines = (typeof assistantSpamLinesOf === 'function' ? assistantSpamLinesOf(who.id) : (typeof ASSISTANT_SPAM_LINES !== 'undefined' && ASSISTANT_SPAM_LINES)) || [];
  const spamRecover = (typeof assistantSpamRecoverOf === 'function' ? assistantSpamRecoverOf(who.id) : (typeof ASSISTANT_SPAM_RECOVER !== 'undefined' && ASSISTANT_SPAM_RECOVER)) || null;
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
  if (bubbleHidden) return null;
  // たたんでいる間は、小さな顔と「ひとこと」の札だけ(押すとひらく)
  if (collapseKey && collapsed) {
    if (collapseHidden) return null;
    return (
      <div data-bubble-collapsed className="w-full flex items-center gap-2">
        <AssistantFace who={who} size={32} accent={color} expression={face}/>
        <button type="button" onClick={() => setCollapsed(false)} aria-label={`${who.name}のひとことをひらく`}
          className="mh-hit-expand relative min-h-[32px] rounded-full border px-3 text-[10px] font-black active:scale-95"
          style={{ borderColor:color, color, backgroundColor:'var(--mh-bubble-bg, rgba(15,23,42,0.92))' }}>💬 {who.name}のひとこと ▾</button>
      </div>
    );
  }
  return (
    <>
      <div data-assistant-bubble className={`w-full flex items-end gap-2 ${collapseKey?'relative':''}`}>
        {/* 顔をタップすると次のセリフへ。詳細は吹き出し側をタップする(操作を分けている) */}
        <button type="button" onClick={onFaceTap} aria-label={`${who.name}に話しかける`} className="shrink-0 active:scale-90 transition-transform">
          <AssistantFace who={who} size={size} accent={color} expression={face}/>
        </button>
        <Wrapper
          {...(hasDetail ? { onClick:()=>setOpen(true), 'aria-label':`${who.name}の説明を開く` } : {})}
          className={`relative flex-1 min-w-0 text-left rounded-2xl border-2 ${compact?'px-2.5 py-1.5':'px-3 py-2'} ${hasDetail?'active:scale-[.99]':''}`}
          style={{ borderColor:color, backgroundColor:'var(--mh-bubble-bg, rgba(15,23,42,0.92))' }}>
          {/* 吹き出しのしっぽ(左向き) */}
          <span className="absolute" style={{ left:'-9px', bottom:'14px', width:0, height:0, borderTop:'7px solid transparent', borderBottom:'7px solid transparent', borderRight:`9px solid ${color}` }}/>
          <span className="absolute" style={{ left:'-6px', bottom:'14px', width:0, height:0, borderTop:'7px solid transparent', borderBottom:'7px solid transparent', borderRight:'9px solid rgba(15,23,42,0.92)' }}/>
          <span className={`block font-black tracking-widest ${compact?'text-[9px]':'text-[10px]'}`} style={{ color }}>{who.name}</span>
          {/* maxLines … セリフをこの行数で切る(0なら切らない)。HOMEは吹き出しの下に施設の札があるので2行まで
              (2026-10-23 社長「MB管理に助手のコメントが被ってくる」)。全文は「タップで詳しく」で開く画面の上に出る */}
          {/* 本文は言葉の切れ目で折り、行の長さをそろえる(2026-10-24。「ここからが本番じゃ／ん！」と最後の1字が落ちていた) */}
          <span data-bubble-text data-bubble-max-lines={maxLines>0?maxLines:undefined} className={`block text-white leading-relaxed ${compact?'text-[10px]':'text-[12px]'}`}
            style={maxLines>0?{...bubbleWrapStyle(),display:'-webkit-box',WebkitBoxOrient:'vertical',WebkitLineClamp:maxLines,overflow:'hidden'}:bubbleWrapStyle()}>{bubbleWrap(text)}</span>
          {(hasDetail||footerSpace>0)&&<span className="mt-0.5 flex items-center justify-end gap-0.5 text-[9px] font-black" style={{ color, ...(footerSpace>0?{paddingLeft:`${footerSpace}px`,minHeight:'18px',whiteSpace:'nowrap'}:{}) }}>{hasDetail&&<><span data-bubble-more-text>タップで詳しく</span><ChevronRight size={11}/></>}</span>}
        </Wrapper>
        {collapseKey&&<button type="button" onClick={() => setCollapsed(true)} aria-label="ひとことをたたむ" data-bubble-collapse
          className="mh-hit-expand absolute right-1 top-0 z-10 min-h-[24px] min-w-[24px] rounded-full text-[10px] font-black text-slate-300 bg-slate-900/80 border border-white/20 active:scale-90">▴</button>}
      </div>
      {open&&(
        <div className="fixed inset-0 flex items-end justify-center" style={{position:'fixed',inset:0,backgroundColor:'rgba(2,6,23,0.94)',zIndex:70000}} role="dialog" aria-modal="true" aria-label={`${who.name}の説明`}>
          <div className="w-full max-w-md rounded-t-3xl border-t-2 border-x-2 bg-slate-950 flex flex-col max-h-[88vh] [[data-mh-view-rotation=true]_&]:max-h-[88vw]" style={{ borderColor:color }}>
            <div className="shrink-0 flex items-center gap-3 p-4 border-b border-white/10">
              <AssistantFace who={who} size={68} accent={color} expression={face}/>
              <div className="flex-1 min-w-0">
                <div className="text-[10px] font-black tracking-widest" style={{ color }}>{who.name}</div>
                <div className="text-[12px] text-white leading-relaxed" style={bubbleWrapStyle()}>{bubbleWrap(text)}</div>
              </div>
              <button onClick={()=>setOpen(false)} aria-label="説明を閉じる" className="mh-hit-expand relative shrink-0 p-2 bg-white/10 rounded-full active:scale-90"><X size={18}/></button>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto mh-scroll p-4 space-y-3.5">
              {topic
                ? renderHelpBlocks(topic.blocks, color)
                : (paragraphs || []).map((x,i)=><p key={i} className="text-[12px] text-slate-200 leading-relaxed">{helpWrap(x)}</p>)}
            </div>
            <div className="shrink-0 p-4 pt-2" style={{ paddingBottom:'calc(1rem + var(--mh-sa-bottom))' }}>
              <button onClick={()=>setOpen(false)} className="w-full min-h-[48px] rounded-2xl font-black text-sm text-black active:scale-[.98]" style={{ backgroundColor:color }}>閉じる</button>
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
         className="mh-ph-bg absolute inset-0 overflow-y-auto mh-scroll"
         // 見た目は強化フェーズのほかの画面と同じ mh-ph-bg(70-bootstrap.jsx)。--ph に識別色(accent は #rrggbb)を渡す
         style={{ position:'absolute', inset:0, zIndex:30000,
           '--ph': /^#[0-9a-f]{6}$/i.test(accent) ? [1,3,5].map(i=>parseInt(accent.slice(i,i+2),16)).join(',') : '45,212,191' }}>
      <div className="min-h-full flex flex-col items-center justify-center p-6 text-center">
        <div className="mh-phase-enter w-full max-w-sm flex flex-col items-center">{children}</div>
        <div className="mt-5 text-[11px] font-black tracking-widest animate-pulse" style={{ color:accent }}>{label}</div>
      </div>
    </div>
  );
};
// ===== 助手(ナビゲーター) ここまで =====

// ===== モンヒロサクセスの「見た出来事」・選択肢の詳細ボタン・イベント図鑑(2026-11-13 社長「この形で作る」) =====
// 保存: 新しいキー mh_monsuc_event_seen_v1 = { v:1, ch:{ 選択肢id: 1 }, ev:{ 出来事id: 1 } }(育成をまたぐ・足すだけ。ほかのキーは触らない)
//   出来事id … ランダムイベント・固有イベントは表の id(ev.daily.nut / scn.mua.uq.*)/ 助手のお話 story.<助手>.ep1〜4・story.<助手>.special /
//              イッサ博士 issa / 覚醒 aw.awake・超覚醒 aw.super。選択肢id = 出来事id + '.' + 選択肢(a・b・c、博士は stat など)
//   msxSeenMark(evId, c) … 見た・選んだを書く(読み終わる前に呼ばれても、読んでから足す。書けなくても遊びは止めない)
//   MsxChoiceInfo        … 選択肢の札の「ℹ」で開く効果の行(芯の表から自動。まだ選んだことのない選択肢は「？？？」)
//   MsxDex               … イベント図鑑(上に全体の ◯/◯・タブで種類ごと。見たものは題と中身を読める・まだは題も「？？？」)
// 公開の印は持たない(モンサクの画面の中からだけ呼ぶ)。

const MSX_SEEN_KEY = 'mh_monsuc_event_seen_v1';
const MSX_SEEN_MAX = 4000;
const msxSeenId = (k) => typeof k === 'string' && k.length > 0 && k.length <= 72 && /^[A-Za-z0-9._-]+$/.test(k);
const msxSeenNorm = (raw) => {
  const o = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  const map = (m) => { const out = {}; if (m && typeof m === 'object' && !Array.isArray(m)) Object.keys(m).slice(0, MSX_SEEN_MAX).forEach((k) => { if (msxSeenId(k) && m[k]) out[k] = 1; }); return out; };
  return { v: 1, ch: map(o.ch), ev: map(o.ev) };
};
let msxSeenCache = null; let msxSeenLoading = null; const msxSeenSubs = new Set();
const msxSeenNotify = () => msxSeenSubs.forEach((f) => { try { f((n) => n + 1); } catch (e) { /* 消えた画面 */ } });
const msxSeenLoad = () => {
  if (msxSeenLoading) return msxSeenLoading;
  msxSeenLoading = Promise.resolve(typeof storeGet === 'function' ? storeGet(MSX_SEEN_KEY, null) : null)
    .catch(() => null).then((raw) => { msxSeenCache = msxSeenNorm(raw); msxSeenNotify(); return msxSeenCache; });
  return msxSeenLoading;
};
const msxSeenMark = (evId, c = null) => {
  if (!msxSeenId(evId)) return;
  if (!msxSeenCache) { msxSeenLoad().then(() => msxSeenMark(evId, c)); return; }
  const chId = c != null && c !== '' ? `${evId}.${c}` : null;
  const addEv = !msxSeenCache.ev[evId]; const addCh = chId && msxSeenId(chId) && !msxSeenCache.ch[chId];
  if (!addEv && !addCh) return;
  msxSeenCache = { v: 1, ev: addEv ? { ...msxSeenCache.ev, [evId]: 1 } : msxSeenCache.ev, ch: addCh ? { ...msxSeenCache.ch, [chId]: 1 } : msxSeenCache.ch };
  try { if (typeof storeSet === 'function') Promise.resolve(storeSet(MSX_SEEN_KEY, msxSeenCache)).catch(() => {}); } catch (e) { /* 書けなくても遊びは止めない */ }
  msxSeenNotify();
};
const useMsxSeen = () => {
  const [, tick] = React.useState(0);
  React.useEffect(() => { msxSeenSubs.add(tick); msxSeenLoad(); return () => { msxSeenSubs.delete(tick); }; }, []);
  return msxSeenCache || msxSeenNorm(null);
};

// ---- 効果の文(芯の出来事の表 fx から作る。数は表のまま・能力は小/中/大) ----
const MSX_FX_SIZE = (n) => (n >= 2 ? '大' : n >= 1 ? '中' : '小');
const MSX_FX_TARGET = Object.freeze({ main: '得意の能力', all: '全能力', rand: 'どれかの能力', cheer: '編成のモンスターの得意な能力', type: 'タイプの得意な能力' });
const MSX_FX_FLAG = Object.freeze({ guts: '次の大会でガッツ +', goalPlus: '期の目標のごほうびアップ', baseBoost: 'ベースモンの効きアップ', injRisk: 'けがをしやすくなる', fav: '好きなトレーニングができる', tagSeen: '友情タッグに目ざめる' });
const MSX_FX_GOAL = Object.freeze({ star: '目標「スター」', toku: '目標「得意をのばす」', naka: '目標「みんなと仲良く」' });
const msxSigned = (n) => (n > 0 ? `+${n}` : `−${Math.abs(n)}`);
const msxFxText = (f) => {
  if (!Array.isArray(f)) return '';
  const [k, a, b] = f; const BUFFS = msxSuc && msxSuc.SUC && msxSuc.SUC.events ? msxSuc.SUC.events.BUFFS || {} : {};
  if (k === 'st') return `${(typeof MSX_STAT_NAME !== 'undefined' && MSX_STAT_NAME[a]) || MSX_FX_TARGET[a] || '能力'} ${MSX_FX_SIZE(Number(b) || 0)}アップ`;
  if (k === 'loy') return `忠誠 ${a > 0 ? '+' : '−'}`;
  if (k === 'fear') return '恐れ度 +';
  if (k === 'pop') return `人気 ${msxSigned(a)}`;
  if (k === 'popHi') return `人気 ${msxSigned(a)}(人気60〜のとき)`;
  if (k === 'hp') return `体力 ${msxSigned(a)}`;
  if (k === 'str') return `ストレス ${msxSigned(a)}`;
  if (k === 'bond') return `${a === 'aid' ? '助手' : a === 'team' ? '編成みんな' : '編成のモンスター'}の親密度 ${msxSigned(b)}`;
  if (k === 'buff') return BUFFS[a] ? `${BUFFS[a].icon} ${BUFFS[a].name}` : 'いい調子になる';
  if (k === 'fame') return `賞金 ${msxSigned(a)}G`;
  if (k === 'pts') return `能力ポイント ${msxSigned(a)}`;
  if (k === 'mas') return '技の熟練 +';
  if (k === 'flag') return MSX_FX_FLAG[a] || 'いいことがある';
  if (k === 'goal') return MSX_FX_GOAL[a] || '期の目標を決める';
  if (k === 'apt') return a === 'low' ? '一番低い間合い適性 +1段' : '一番高い間合い適性 +1段';
  return '';
};
const msxFxLine = (list) => { const t = (Array.isArray(list) ? list : []).map(msxFxText).filter(Boolean); return t.length ? t.join('・') : 'なにも変わらない'; };
// 1つの選択肢の効果(行の並び)。ch = 芯の表の選択肢 { fx } か { p, ok, ng } か { lottery }
const msxChoiceLines = (ch) => {
  if (!ch || typeof ch !== 'object') return ['お話の続きが変わる'];
  const out = [];
  if (ch.need && ch.need.fame) out.push(`賞金 ${ch.need.fame}G が要る`);
  if (ch.pay) out.push(`賞金 −${ch.pay}G`);
  if (ch.lottery) out.push('おみくじを引く(大吉・吉・…)');
  if (ch.p) { out.push(`成功 ${Math.round(ch.p * 100)}%: ${msxFxLine(ch.ok)}`); out.push(`失敗: ${msxFxLine(ch.ng)}`); }
  else if (ch.fx) out.push(msxFxLine(ch.fx));
  return out.length ? out : ['なにも変わらない'];
};
// 表の出来事の選択肢(無ければ null)
const msxEvChoice = (evId, c) => { const E = msxSuc && msxSuc.SUC && msxSuc.SUC.events; const e = E && E.BY_ID ? E.BY_ID[evId] : null; return e && e.ch ? (e.ch[c] || (c === 'a' && e.ch.fx ? e.ch : null)) : null; };

function MsxChoiceInfo({ evId, c, open }) {
  msxDexEnsureCss();
  const seen = useMsxSeen();
  if (!open) return null;
  const known = Boolean(seen.ch[`${evId}.${c}`]);
  const lines = known ? (String(evId).startsWith('story.') ? ['お話の続きが変わる'] : msxChoiceLines(msxEvChoice(evId, c))) : ['？？？'];
  return <div className="msx-chinfo" data-msx-chinfo={known ? 'known' : 'unknown'}>{lines.map((l, i) => <div key={i}>{l}</div>)}{known ? null : <small>一度選ぶと、効果が分かるようになる</small>}</div>;
}

// ---- 図鑑の中身(タブと出来事の並び) ----
const MSX_EV_TITLE = Object.freeze({
  'ev.daily.nut': '道ばたの木の実', 'ev.daily.rain': '雨の日のトレーニング', 'ev.daily.night': '星のきれいな夜', 'ev.daily.kids': '子どもたちが集まってきた', 'ev.daily.sweets': '新作スイーツ',
  'ev.daily.book': '古い本', 'ev.daily.chase': '追いかけっこ', 'ev.daily.juggler': '大道芸人', 'ev.daily.arm': '腕ずもう', 'ev.daily.dream': 'こわい夢', 'ev.daily.picky': '好ききらい',
  'ev.daily.mirror': '鏡の前の決めポーズ', 'ev.daily.lost': '迷子', 'ev.daily.range': 'ひとりで間合いの稽古', 'ev.daily.map': '宝の地図', 'ev.daily.gift': 'ファンからの贈り物', 'ev.daily.alone': 'ひとりで自主練',
  'ev.small.omikuji': 'おみくじ', 'ev.small.nut': 'あやしい木の実',
  'ev.team.selfdrill': '編成のモンスターの自主練', 'ev.team.senpai': '先輩の背中', 'ev.team.fight': '編成どうしのケンカ', 'ev.team.base': 'ベースモンのがんばり', 'ev.team.friend': 'フレンドのモンスターが来た',
  'ev.team.typeskill': '得意技を教わる', 'ev.team.sync': '息ぴったり', 'ev.team.tagwake': '心がつながった',
  'ev.self.anniv': '初めての育成記念日', 'ev.self.peakin': '伸びどきが来た', 'ev.self.peakout': '落ち着いてきた', 'ev.self.slump': 'スランプ', 'ev.self.favtrain': '好きなトレーニング', 'ev.self.selfish': 'ご機嫌ななめ', 'ev.self.clingy': '甘えんぼ',
  'ev.goal.pick': '期の目標を決める', 'ev.goal.done': '目標達成', 'ev.goal.miss': '目標に届かなかった',
  'ev.body.injury': 'けがの手前', 'ev.body.runaway': '元気がない', 'ev.body.healed': '治った', 'ev.body.home': '帰ってきた',
  'ev.season.jan1': '初もうで', 'ev.season.jan2': '書きぞめ', 'ev.season.jan3': '新年の願い事', 'ev.season.apr1': 'お花見', 'ev.season.apr2': '春の町', 'ev.season.apr3': '1年前の写真',
  'ev.season.aug1': '夏祭りの金魚すくい', 'ev.season.aug2': '夏祭りの力くらべ', 'ev.season.aug3': '花火', 'ev.season.oct1': 'ハロウィンの仮装', 'ev.season.oct2': 'ハロウィンのお菓子', 'ev.season.oct3': 'ハロウィンのきもだめし',
  'ev.season.dec1': '大そうじ', 'ev.season.dec2': '1年のふりかえり', 'ev.season.dec3': '最後の年に向けて', 'ev.season.finaljan': '最後のお正月', 'ev.season.finalapr': '最後のお花見',
  'ev.cup.eve': '大会の前の晩', 'ev.cup.interview': '取材', 'ev.cup.after': '負けたあと',
  issa: 'イッサ博士があらわれた', 'aw.awake': '覚醒', 'aw.super': '超覚醒',
});
const MSX_DEX_TABS = Object.freeze([
  { key: 'story', name: '助手のお話' }, { key: 'daily', name: 'ふだん', kinds: ['daily', 'small'] }, { key: 'team', name: '編成のモンスター', kinds: ['team'] },
  { key: 'self', name: '育成モンスター', kinds: ['self', 'body', 'goal'] }, { key: 'season', name: '季節の行事', kinds: ['season'] }, { key: 'cup', name: '大会まわり', kinds: ['cup'] },
  { key: 'issa', name: 'イッサ博士' }, { key: 'awake', name: '覚醒・超覚醒' },
]);
// 図鑑に並べる出来事 { id, title, aid?, scene, ep? }。表から作る(足された出来事も自動で入る)
const msxDexList = () => {
  const SUC = msxSuc && msxSuc.SUC; const E = SUC && SUC.events; const out = {};
  MSX_DEX_TABS.forEach((t) => { out[t.key] = []; });
  if (E && Array.isArray(E.LIST)) E.LIST.forEach((e) => { const t = MSX_DEX_TABS.find((x) => x.kinds && x.kinds.includes(e.kind)); if (t) out[t.key].push({ id: e.id, title: MSX_EV_TITLE[e.id] || '出来事', scene: e.id }); });
  const aids = SUC && Array.isArray(SUC.AIDS) ? SUC.AIDS : [];
  aids.forEach((aid) => {
    [1, 2, 3, 4].forEach((n) => out.story.push({ id: `story.${aid}.ep${n}`, aid, title: `第${n}話`, ep: n }));
    out.story.push({ id: `story.${aid}.special`, aid, title: '特別な1話', ep: 'special' });
    (E && Array.isArray(E.UNIQ) ? E.UNIQ : []).filter((u) => u.aid === aid).forEach((u) => out.story.push({ id: u.id, aid, title: u.title || 'お話', scene: u.id }));
  });
  out.issa.push({ id: 'issa', title: MSX_EV_TITLE.issa, scene: 'issa' });
  out.awake.push({ id: 'aw.awake', title: '覚醒', scene: 'turn.awake.fire', awake: 1 }, { id: 'aw.super', title: '超覚醒', scene: 'turn.awake.fire2', awake: 2 });
  return out;
};

function MsxDex({ aid = 'mua', nick = '', onClose }) {
  msxDexEnsureCss();
  const seen = useMsxSeen();
  const list = React.useMemo(() => msxDexList(), []);
  const [tab, setTab] = React.useState('story');
  const [pickAid, setPickAid] = React.useState(aid);
  const [open, setOpen] = React.useState(null);
  const [, setTick] = React.useState(0);
  const all = Object.values(list).flat();
  const got = all.filter((x) => seen.ev[x.id]).length;
  const rows = tab === 'story' ? list.story.filter((x) => x.aid === pickAid) : list[tab] || [];
  const readAid = open && open.aid ? open.aid : aid;
  React.useEffect(() => { if (typeof msxScriptLoad === 'function') { let alive = true; msxScriptLoad(readAid).then(() => { if (alive) setTick((n) => n + 1); }); return () => { alive = false; }; } return undefined; }, [readAid]);
  const se = msxSuc && msxSuc.script;
  const scene = open ? (open.ep != null ? (se && se.SCENE ? se.SCENE.story(open.aid, open.ep) : `scn.${open.aid}.ep${open.ep}`) : open.scene) : null;
  const c2 = { aid: readAid, mon: nick || 'モンスター', name: 'あなた', callName: '', bond: 10, cheer: '編成のモンスター', cheer2: '編成のモンスター', train: 'トレーニング', id: 'dex', turn: 10 };
  let ev0 = null; try { ev0 = open && se && typeof se.event === 'function' && !open.awake ? se.event(scene, c2) : null; } catch (e) { ev0 = null; }
  const aw = open && open.awake && typeof msxPickLine === 'function' ? msxPickLine({ ...c2 }, scene, { bondLv: 10 }) : null;
  const who = (l) => (l.who === 'narr' ? null : l.who === 'issa' ? 'イッサ博士' : l.who === 'mon' ? (nick || 'モンスター') : (typeof msxAidName === 'function' ? msxAidName(l.who) : l.who));
  const chOf = (x) => { const E = msxSuc && msxSuc.SUC && msxSuc.SUC.events; const e = E && E.BY_ID ? E.BY_ID[x.id] : null; return e && e.ch && (e.ch.a || e.ch.b) ? Object.keys(e.ch) : x.ep ? ['a', 'b'] : x.id === 'issa' && typeof MSX_ISSA_KEYS !== 'undefined' ? MSX_ISSA_KEYS.map((k) => k.key) : []; };
  return (
    <div className="msx-ov msx-fade msx-dex" onClick={onClose} data-msx-dex>
      <div className="msx-sheet" onClick={(e) => e.stopPropagation()}>
        <h3>📖 イベント図鑑<span className="msx-dex-all">{got} / {all.length}</span></h3>
        <div className="msx-dex-bar"><i style={{ width: `${all.length ? (got / all.length) * 100 : 0}%` }}/></div>
        <div className="msx-dex-tabs">{MSX_DEX_TABS.map((t) => { const L = list[t.key] || []; const n = L.filter((x) => seen.ev[x.id]).length; return (
          <button type="button" key={t.key} className={t.key === tab ? 'on' : ''} onClick={() => { setTab(t.key); setOpen(null); }} data-msx-dex-tab={t.key}>{t.name}<small>{n}/{L.length}</small></button>); })}</div>
        {tab === 'story' ? <div className="msx-dex-aids">{[...new Set(list.story.map((x) => x.aid))].map((a) => { const L = list.story.filter((x) => x.aid === a); return (
          <button type="button" key={a} className={a === pickAid ? 'on' : ''} onClick={() => { setPickAid(a); setOpen(null); }}>{typeof msxFace === 'function' ? <img src={msxFace(a, 'normal')} alt=""/> : null}{typeof msxAidName === 'function' ? msxAidName(a) : a}<small>{L.filter((x) => seen.ev[x.id]).length}/{L.length}</small></button>); })}</div> : null}
        {open ? (
          <div className="msx-dex-read" data-msx-dex-read={open.id}>
            <div className="h"><b>{open.title}</b><button type="button" className="chip" onClick={() => setOpen(null)}>← 一覧へ</button></div>
            {open.awake ? <div className="ln">{open.awake === 2 ? '覚醒したあと、さらに虹色の光に包まれて、全能力 +40・間合い適性が2つ上がった。' : 'まぶしい光に包まれて、全能力 +30・一番高い間合い適性が上がった。'}</div> : null}
            {aw && aw.t ? <div className="ln"><span className="who">{typeof msxAidName === 'function' ? msxAidName(readAid) : ''}</span>「{aw.t}」</div> : null}
            {open.id === 'issa' ? <div className="ln">夜の町に、のびのび装置を持ったイッサ博士があらわれた。成功すれば大きく強くなれるが、失敗すると…。</div> : null}
            {ev0 ? ev0.lines.slice(0, 8).map((l, i) => <div key={i} className="ln">{who(l) ? <span className="who">{who(l)}</span> : null}{who(l) ? `「${l.t}」` : l.t}</div>) : null}
            {chOf(open).length ? <div className="chs">{chOf(open).map((c) => { const t = ev0 && ev0.choices ? (ev0.choices.find((x) => x.c === c) || {}).t : open.id === 'issa' ? ((MSX_ISSA_KEYS.find((k) => k.key === c) || {}).name || c) : c; const known = Boolean(seen.ch[`${open.id}.${c}`]); return (
              <div key={c} className="ch"><b>{known ? t : '？？？'}</b><span>{known ? (open.id === 'issa' ? (() => { const k = MSX_ISSA_KEYS.find((x) => x.key === c) || {}; return `⭕ ${k.ok} / ❌ ${k.ng}`; })() : open.ep != null ? 'お話の続きが変わる' : msxChoiceLines(msxEvChoice(open.id, c)).join(' / ')) : 'まだ選んだことがない'}</span></div>); })}</div> : null}
          </div>
        ) : (
          <div className="msx-dex-list">{rows.length ? rows.map((x) => { const known = Boolean(seen.ev[x.id]); return (
            <button type="button" key={x.id} className={`msx-dex-row${known ? '' : ' no'}`} disabled={!known} onClick={() => setOpen(x)} data-msx-dex-row={x.id}>
              <span>{known ? x.title : '？？？'}</span><small>{known ? '読む ▶' : 'まだ見ていない'}</small></button>); }) : <div className="msx-note">まだありません</div>}</div>
        )}
        <button type="button" className="msx-btn" onClick={onClose}>閉じる</button>
      </div>
    </div>
  );
}

const MSX_DEX_CSS = `
.msx .msx-optrow{display:flex;gap:6px;align-items:stretch}
.msx .msx-optrow>.v-opt{flex:1;min-width:0}
.msx .msx-info{flex:none;width:38px;border-radius:13px;background:#1e1a36;border:1.5px solid #7dd3fc;border-bottom-width:3px;color:#7dd3fc;font-size:16px;font-weight:900}
.msx .msx-info.on{background:#0c4a6e;color:#fff}
.msx .msx-chinfo{margin:-2px 2px 2px;padding:6px 10px;border-radius:10px;background:#0f172acc;border:1px solid #334155;font-size:11.5px;font-weight:800;line-height:1.5;color:#e0f2fe}
.msx .msx-chinfo small{display:block;color:#94a3b8;font-size:10px}
.msx .msx-dex .msx-sheet{max-height:92vh;display:flex;flex-direction:column}
.msx .msx-dex h3{display:flex;align-items:center;justify-content:space-between}
.msx .msx-dex-all{font-size:15px;color:#fde047}
.msx .msx-dex-bar{height:7px;border-radius:9px;background:#1e293b;overflow:hidden;margin:4px 0 8px}
.msx .msx-dex-bar i{display:block;height:100%;background:linear-gradient(90deg,#f472b6,#fde047)}
.msx .msx-dex-tabs{display:flex;flex-wrap:wrap;gap:4px;margin-bottom:6px}
.msx .msx-dex-tabs button,.msx .msx-dex-aids button{border-radius:999px;padding:3px 9px;font-size:11px;font-weight:900;background:#1e1a36;border:1.5px solid #475569;color:#e2e8f0}
.msx .msx-dex-tabs button small,.msx .msx-dex-aids button small{margin-left:4px;color:#94a3b8;font-size:10px}
.msx .msx-dex-tabs button.on,.msx .msx-dex-aids button.on{border-color:#f472b6;background:#3b0d2e;color:#fff}
.msx .msx-dex-aids{display:flex;flex-wrap:wrap;gap:4px;margin-bottom:6px}
.msx .msx-dex-aids img{width:18px;height:18px;border-radius:50%;margin-right:3px;vertical-align:-4px;object-fit:cover}
.msx .msx-dex-list,.msx .msx-dex-read{flex:1 1 auto;min-height:0;overflow-y:auto;display:flex;flex-direction:column;gap:5px}
.msx .msx-dex-row{display:flex;justify-content:space-between;align-items:center;gap:8px;padding:8px 10px;border-radius:11px;background:#1e1a36;border:1.5px solid #6d28d9;font-size:12.5px;font-weight:900;text-align:left;color:#fff}
.msx .msx-dex-row small{color:#c4b5fd;font-size:10.5px;flex:none}
.msx .msx-dex-row.no{border-color:#334155;color:#64748b}
.msx .msx-dex-row.no small{color:#475569}
.msx .msx-dex-read .h{display:flex;justify-content:space-between;align-items:center;font-size:14px}
.msx .msx-dex-read .ln{font-size:12px;line-height:1.55;font-weight:700;color:#e2e8f0}
.msx .msx-dex-read .who{color:#f9a8d4;font-weight:900;margin-right:2px}
.msx .msx-dex-read .chs{display:grid;gap:4px;margin-top:4px}
.msx .msx-dex-read .ch{padding:5px 9px;border-radius:10px;background:#0f172a;border:1px solid #334155;font-size:11.5px;line-height:1.45}
.msx .msx-dex-read .ch b{display:block;color:#fde047}
.msx .msx-dex-read .ch span{color:#cbd5e1;font-weight:700}
.msx .msx-dex .msx-sheet>.msx-btn{display:block;width:100%;border-radius:12px;padding:10px;font-size:13px;font-weight:900;text-align:center;background:#2b3348;margin-top:6px}
.msx .msx-dex-read .h .chip{border-radius:999px;padding:3px 10px;font-size:11px;font-weight:900;border:1.5px solid #475569;background:#1e1a36}
`;
let msxDexCssDone = false;
const msxDexEnsureCss = () => {
  if (msxDexCssDone || typeof document === 'undefined') return;
  msxDexCssDone = true;
  const el = document.createElement('style'); el.setAttribute('data-msx-dex-css', '1'); el.textContent = MSX_DEX_CSS; document.head.appendChild(el);
};

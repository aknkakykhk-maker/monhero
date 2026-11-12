// モンヒロサクセス 止め絵 第3版(2026-11-12)。看板コンテンツとしての描き直し。見た目は v3.css、部品の一部は lib.js。
// 決まったことを全部入れた版: 案A(住む場所が大きく・下に行動のボタン)・この期の残りターン・体力/ストレスのゲージ・編成と助手の親密度・友情タッグ・結果の4種類・叱る/褒める・イッサ博士・アシスト能力。
// 絵は今ある立ち絵と背景を仮に置いている。文・数字・名前は見た目を決めるための仮
const GROUPS = [];
const grp = (id, name, lead, phones, notes) => GROUPS.push({ id, name, lead, phones, notes });

// 編成の6体+助手の親密度(仮)。80以上がタッグ
const AF = { a: 84, b: 80, c: 55, d: 92, e: 12, f: 72, as: 64 };
const pf = (k, cls = '') => {
  if (k === 'as') return `<span class="v-pf as ${cls}"><img src="${F('myua', 'happy')}"><i class="af"><b style="width:${AF.as}%"></b></i></span>`;
  const o = CH[k];
  return `<span class="v-pf r${rl(o.r)}${o.base ? ' base' : ''}${o.fr ? ' fr' : ''}${AF[k] >= 80 ? ' tag' : ''} ${cls}"><img src="${T(o.t)}"><i class="af"><b style="width:${AF[k]}%"></b></i></span>`;
};
const hdr = (right = '💰 名声 320', back = '中断', sub = 'みゅあ編') => `<div class="v-hd"><span class="bk">← ${back}</span><span class="ti">🌱 モンヒロサクセス${sub ? `<small>${sub}</small>` : ''}</span><span class="rt">${right}</span></div>`;
// 上の帯。o: { hp, max, st, use(使う体力), heal, stAdd(増えるストレス), left(この期の残り), all(最後までの残り), ph, ym, track }
const band = (o = {}) => {
  const { hp = 62, max = 110, st = 34, use = 0, heal = 0, stAdd = 0, left = 7, all = 24, ph = 'ミドル期', ym = '3年目 6月', now = 2, fill = 42 } = o;
  const P = [5, 12, 12, 12, 5];
  return `<div class="v-band">
  <div class="v-b1">
    <div class="v-turn"><span class="ph">${ph}<small>${ym}</small></span><div class="n">残り<b>${left}</b>ターン<small>最後まで あと <em>${all}</em></small></div></div>
    <div class="v-pow"><div><small>総合力</small><b>${o.pow || '6,240'}</b></div>${rk(o.rank || 'C', 1)}</div>
  </div>
  <div class="v-b2">
    <div class="v-ga hp${hp - use < max * 0.3 ? ' low' : ''}"><span>❤️ 体力</span><div class="tr"><i style="width:${(hp - use) / max * 100}%"></i>${use ? `<u style="left:${(hp - use) / max * 100}%;width:${use / max * 100}%"></u>` : ''}${heal ? `<u class="heal" style="left:${hp / max * 100}%;width:${heal / max * 100}%"></u>` : ''}${max > 100 ? `<s style="left:${100 / max * 100}%"></s>` : ''}</div>${use ? `<em>−${use}</em>` : heal ? `<em class="hl">+${heal}</em>` : ''}<b>${hp}<small class="${max > 100 ? 'cap' : ''}">/${max}${max > 100 ? '▲' : ''}</small></b></div>
    <div class="v-ga st"><span>💢 ストレス</span><div class="tr"><i style="width:${st}%"></i>${stAdd ? `<u class="add" style="left:${st}%;width:${stAdd}%"></u>` : ''}</div>${stAdd ? `<em class="pl">+${stAdd}</em>` : ''}<b>${st}<small>/100</small></b></div>
  </div>
  <div class="v-track">${P.map((w, i) => `<span style="flex:${w}" class="${i === now ? 'now' : ''}"><i style="width:${i < now ? 100 : i === now ? fill : 0}%"></i></span>`).join('')}</div>
</div>`;
};
const VAL = [412, 506, 233, 380, 198, 441];
const SHORT = ['ライフ', 'ちから', 'かしこさ', '命中', '回避', '丈夫さ'];
// 6能力の横一列。ups: 見通し(+/−)。main: 主の能力の番号
const stRow = (ups, main = -1, vals = VAL) => `<div class="v-st">${ST.map((s, i) => `<div class="${ups && ups[i] > 0 ? 'up' : ups && ups[i] < 0 ? 'dn' : ''}${i === main ? ' main' : ''}"><small>${s[1]}${SHORT[i]}</small><b>${vals[i]}</b><u><i style="width:${vals[i] / 9.99}%"></i></u>${ups ? `<em>${ups[i] > 0 ? '+' + ups[i] : ups[i] < 0 ? '−' + -ups[i] : ''}</em>` : ''}</div>`).join('')}</div>`;
const pnl = (e, nm, sub, cls = '', extra = '') => `<div class="v-p ${cls}"><div class="e">${e}</div>${nm}<small>${sub}</small>${extra}</div>`;
const foot = `<div class="v-ft"><span>← 中断</span><span>⏩ 早送り</span><span class="on">演出 短く</span><span>📖 きろく</span><span>☰ メニュー</span></div>`;
const footGo = (label, back = '← もどる', cls = 'go') => `<div class="v-ft"><span>${back}</span><span class="${cls}">${label}</span></div>`;
// 住む場所。o: { bg, mon, inner, cls, monStyle }
const scene = (o = {}) => `<div class="v-scene ${o.cls || ''}"><img class="bg" src="${BG(o.bg || 'monhero_plaza')}"><div class="sh"></div>${o.back || ''}
  ${o.noMon ? '' : `<div class="gr" style="${o.grStyle || ''}"></div><img class="mon" src="${M(o.mon || 'mocchi.png')}" style="${o.monStyle || ''}">`}
  ${o.inner || ''}</div>`;
const party = `<div class="v-party"><small>編成</small>${['d', 'a', 'b', 'f', 'c', 'e'].map((k) => pf(k)).join('')}</div>`;
const say = (text, mood = 'happy') => `<div class="v-say"><img class="fc" src="${F('myua', mood)}"><div class="bub">${text}</div></div>`;

// ================= 1. 育成のメイン =================
const mainScene = (yousu) => scene({
  cls: 'home',
  inner: `${party}
  <div class="v-chips"><span class="v-chip">🌸 春・昼</span><span class="v-chip hot">🏆 期末の大会まで 7ターン</span>${yousu ? '<span class="v-chip bad">😪 ようす: サボりグセ</span>' : ''}</div>
  ${yousu ? '<span class="v-yousu">😪 サボりグセ</span>' : ''}
  <span class="v-nm">もちまる<small>方針: 普通</small></span>
  <div class="v-side"><span class="v-mini">🤝 忠誠 <b>72</b></span><span class="v-mini">⭐ 人気 <b>45</b></span></div>
  <div class="v-bagb">🎒<small>持ち物</small><i>2</i></div><div class="v-bagb r">🔍<small>くわしく</small></div>`,
});
const mainSay = (yousu) => `<div class="v-sayrow"><img class="fc" src="${F('myua', yousu ? 'troubled' : 'happy')}"><div class="bub">${yousu ? '最近サボりがちだね…。一度 <em>🏥 通院</em> で診てもらおっか!' : '今月は <em>ちから</em> に3体! らいがと しずくは <em>友情タッグ</em>だよ!'}</div></div>`;
const trainBtn = `<div class="v-p main">💪 訓練<small>🤝 友情タッグのチャンスあり</small></div>`;
const acts = (yousu) => `<div class="v-act" style="grid-template-columns:1fr 2.3fr 1fr">
    ${pnl('🛌', '休む', '体力を回復')}${trainBtn}${pnl('📊', '能力', '技・型・編成', '', '<span class="bd">能力P 21</span>')}
  </div>
  <div class="v-act" style="grid-template-columns:repeat(4,1fr)">
    ${yousu ? pnl('🏥', '通院', 'ようすを治す', 'hosp', '<span class="bd r">!</span>') : pnl('🏥', '通院', 'ようすなし', 'off')}
    ${pnl('🎈', '遊ぶ', '体力+・甘え+')}
    ${pnl('⚔', '修行', '技を覚える', '', `<span class="bd">${tk(13)} 3枚</span>`)}
    ${pnl('🏆', '大会', '今月は3つ', '', '<span class="bd">★★ 出られる</span>')}
  </div>`;
const mainHtml = (yousu, cls = '') => `${hdr()}<div class="v-body">
  ${band(yousu ? { hp: 48 } : {})}
  ${mainSay(yousu)}
  ${mainScene(yousu)}
  ${stRow()}
  ${acts(yousu)}
</div>${foot}`;

// 砂時計・修行チケットの絵(Claude が描いた絵 monster-hero/images/success/items/ を使う)。niji: 虹の砂時計
const hg = (niji, size = 34) => `<img class="v-hg" width="${size}" height="${size}" src="${IMG}/success/items/${niji ? 'hourglass-rainbow' : 'hourglass'}.png">`;
const tk = (size = 14) => `<img class="v-tk" width="${size}" height="${size}" src="${IMG}/success/items/training-ticket.png">`;
// 持ちこみアイテム12種のアイコン(この見本のために新しく描いた仮の絵・参考のゲームの絵は写していない)
const ic = (b) => `<svg class="v-ic" viewBox="0 0 40 40" width="100%" height="100%">${b}</svg>`;
const ICON = {
  guide: ic('<rect x="8" y="6" width="24" height="29" rx="3" fill="#1e3a8a" stroke="#93c5fd" stroke-width="1.5"/><rect x="11" y="9" width="18" height="23" rx="1.5" fill="#dbeafe"/><circle cx="20" cy="17" r="4" fill="#fbbf24"/><path d="M14 27h12M14 30h8" stroke="#64748b" stroke-width="1.5"/><path d="M30 5l1 2.500 2.500 1-2.500 1-1 2.500-1-2.500-2.500-1 2.500-1z" fill="#fde047"/>'),
  loupe: ic('<circle cx="17" cy="17" r="10" fill="#bae6fd" fill-opacity=".55" stroke="#f59e0b" stroke-width="3.500"/><path d="M11 13a8 8 0 0 1 6-4" stroke="#fff" stroke-width="2" fill="none" stroke-linecap="round"/><path d="M25 25l9 9" stroke="#92400e" stroke-width="5" stroke-linecap="round"/><path d="M33 6l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8z" fill="#fde047"/>'),
  band: ic('<path d="M5 15c5-5 25-5 30 0v10c-5-5-25-5-30 0z" fill="#f9a8d4" stroke="#be185d" stroke-width="1.5"/><path d="M9 17l3 5M16 17l3 5M23 17l3 5M30 17l-3 5" stroke="#fde047" stroke-width="2"/><circle cx="20" cy="30" r="3" fill="#a78bfa"/><circle cx="12" cy="31" r="2" fill="#7dd3fc"/><circle cx="28" cy="31" r="2" fill="#86efac"/>'),
  mag: ic('<rect x="7" y="5" width="26" height="31" rx="2.500" fill="#fef3c7" stroke="#b45309" stroke-width="1.5"/><rect x="10" y="8" width="20" height="9" rx="1.500" fill="#fb923c"/><path d="M13 12h14" stroke="#fff" stroke-width="2.500"/><path d="M11 21h18M11 25h18M11 29h11" stroke="#a16207" stroke-width="1.600"/>'),
  hachi: ic('<path d="M4 17c8-6 24-6 32 0v7c-8-6-24-6-32 0z" fill="#ef4444" stroke="#7f1d1d" stroke-width="1.500"/><circle cx="20" cy="19" r="4.500" fill="#fef9c3" stroke="#b45309" stroke-width="1.200"/><path d="M20 16l1.200 2.800 2.800.2-2.200 1.800.8 2.800-2.600-1.600-2.600 1.600.8-2.800L16 19l2.800-.2z" fill="#f59e0b"/><path d="M33 22l5 10M30 23l2 11" stroke="#ef4444" stroke-width="3" stroke-linecap="round"/>'),
  omamori: ic('<path d="M20 4l-2 5h4z" fill="#a78bfa"/><rect x="9" y="8" width="22" height="28" rx="5" fill="#bfdbfe" stroke="#1d4ed8" stroke-width="1.500"/><path d="M20 28c-5-4-7-6-7-9a4 4 0 0 1 7-2 4 4 0 0 1 7 2c0 3-2 5-7 9z" fill="#f472b6"/><path d="M9 14h22" stroke="#1d4ed8" stroke-width="1.500"/><path d="M20 36v3" stroke="#60a5fa" stroke-width="2"/>'),
  dango: ic('<ellipse cx="20" cy="31" rx="13" ry="4.500" fill="#f1f5f9" stroke="#94a3b8" stroke-width="1.200"/><circle cx="13" cy="24" r="6.500" fill="#fbcfe8" stroke="#db2777" stroke-width="1.200"/><circle cx="27" cy="24" r="6.500" fill="#fef9c3" stroke="#ca8a04" stroke-width="1.200"/><circle cx="20" cy="15" r="6.500" fill="#bbf7d0" stroke="#16a34a" stroke-width="1.200"/><path d="M20 4v8" stroke="#92400e" stroke-width="2"/>'),
  grass: ic('<path d="M20 36V18" stroke="#16a34a" stroke-width="2.500"/><path d="M20 24c-8 0-11-6-11-12 7 0 11 4 11 12z" fill="#86efac" stroke="#15803d" stroke-width="1.200"/><path d="M20 20c7 0 10-5 10-11-6 0-10 4-10 11z" fill="#bbf7d0" stroke="#15803d" stroke-width="1.200"/><circle cx="20" cy="12" r="3.500" fill="#fff" stroke="#a78bfa" stroke-width="1.200"/><path d="M13 36h14" stroke="#92400e" stroke-width="3" stroke-linecap="round"/>'),
  juice: ic('<path d="M13 9h14l-2 27H15z" fill="#bbf7d0" stroke="#15803d" stroke-width="1.500"/><path d="M14 20h12l-1 16H15z" fill="#4ade80"/><rect x="12" y="5" width="16" height="5" rx="2" fill="#a16207"/><path d="M27 8l5-5" stroke="#16a34a" stroke-width="2.500" stroke-linecap="round"/><circle cx="20" cy="28" r="3.500" fill="#fff" fill-opacity=".8"/><path d="M20 26v4M18 28h4" stroke="#16a34a" stroke-width="1.200"/>'),
  powder: ic('<path d="M10 14h20l3 22H7z" fill="#e0e7ff" stroke="#4f46e5" stroke-width="1.500"/><path d="M13 10h14l3 5H10z" fill="#a5b4fc" stroke="#4f46e5" stroke-width="1.500"/><path d="M15 25l3 3 7-7" stroke="#16a34a" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"/><circle cx="31" cy="8" r="1.500" fill="#fde047"/><circle cx="8" cy="9" r="1.200" fill="#fde047"/>'),
  license: ic('<rect x="4" y="9" width="32" height="22" rx="3" fill="#fef3c7" stroke="#b45309" stroke-width="1.500"/><circle cx="14" cy="18" r="4.500" fill="#f9a8d4"/><path d="M8 29c1-5 11-5 12 0z" fill="#f9a8d4"/><path d="M24 15h9M24 19h9M24 23h6" stroke="#a16207" stroke-width="1.800"/><path d="M29 26l1 2.500 2.500.3-1.900 1.700.6 2.500-2.200-1.300-2.200 1.300.6-2.500-1.900-1.700 2.500-.3z" fill="#f59e0b"/>'),
  pack: ic('<rect x="6" y="14" width="28" height="22" rx="4" fill="#fde68a" stroke="#b45309" stroke-width="1.500"/><path d="M6 21h28" stroke="#b45309" stroke-width="1.500"/><path d="M13 14c-2-6 3-9 7-5 4-4 9-1 7 5" fill="#86efac" stroke="#15803d" stroke-width="1.200"/><rect x="15" y="24" width="10" height="8" rx="3" fill="#fb923c"/><path d="M17 27h6" stroke="#fff" stroke-width="1.500"/>'),
};
// 持ちこみ12種: [id, 絵, 名前, 一行の説明, いつ使う(before=はじめる前に持っていく / both=育成中にも使える), 持っている数]
// 効き目は参考のゲームのまま。名前はモンヒロに合わせた仮(参考の人物はイッサ博士に読みかえ)。数字は仮
const ITEMS = [
  ['guide', '博士の導き書', 'イッサ博士の大事な書類。1度、イッサ博士が現れる', 'before', 44],
  ['loupe', '博士のルーペ', 'イッサ博士のお気に入り。イッサ博士の実験が成功する', 'both', 54],
  ['band', '出会いのミサンガ', '交流を増やすミサンガ。ようす「イベントメーカー」が付く', 'before', 131],
  ['mag', '週刊!トレーニング', 'ハウツー雑誌。ようす「トレーニング得意」が付く', 'before', 99],
  ['hachi', '修行のハチマキ', '気合いが入るハチマキ。ようす「修行得意」が付く', 'before', 87],
  ['omamori', '縁結びのお守り', '良縁に恵まれるお守り。ようす「スターの素質○」が付く', 'before', 66],
  ['dango', 'モモのキビダンゴ', '食べるとスタミナがつく。体力の最大値が はじめから上がる', 'before', 97],
  ['grass', 'うけつぎ草', '伝授でいい結果が出る草。ようす「うけつぐ魂」が付く', 'before', 26],
  ['juice', 'ガロエ印の野菜ジュース', '体力を完全に回復する', 'both', 79],
  ['powder', '悪様散', '悪いようすを治して、体力を回復する', 'both', 118],
  ['license', 'ブリーダーライセンス', '忠誠度が一定数 上がる', 'both', 9],
  ['pack', 'オイリーパック', 'オイル2個と薬草の詰め合わせ', 'both', 66],
];
const IT = Object.fromEntries(ITEMS.map((t) => [t[0], t]));
const icon = (k) => `<span class="v-icw">${ICON[k]}</span>`;
// 持ち物の小窓(育成中): [絵, 名前, 数, 状態]。使えるのは「育成中にも使える」物だけ
const BAG = [['juice', 3, 'sel'], ['powder', 2, ''], ['license', 1, ''], ['pack', 1, ''], ['loupe', 1, '']].map(([k, c, st]) => [icon(k), IT[k][1], c, st]).concat([[hg(0), '時渡りの砂時計', 2, 'no'], [hg(1), '虹の時渡りの砂時計', 1, 'no'], [tk(30), '修行チケット', 3, 'no']]);
const bagHtml = `${hdr()}<div class="v-body">
  ${band({ heal: 48 })}
  ${mainSay(false).replace(/<div class="bub">.*<\/div><\/div>$/, '<div class="bub">体力がへってきたね。<em>野菜ジュース</em>、いま使っちゃう?</div></div>')}
  ${scene({ cls: 'home dk', noMon: 1, inner: `<div class="v-bagw"><div class="t">🎒 持ち物<small>使えるのは 1ターンに1個まで・使ってもターンは進まない</small><i>✕</i></div>
    <div class="v-bsel"><span class="e">${icon('juice')}</span><div><b>ガロエ印の野菜ジュース <span class="yel">×3</span></b><small>体力を完全に回復する(育成中にも使える)</small><small class="lim">いつ使える: 自分のターン</small></div></div>
    <div class="v-bgrid">${BAG.map(([e, n, c, st]) => `<div class="${st}"><span class="e">${e}</span><i>×${c}</i><small>${n}</small></div>`).join('')}</div>
    <div class="v-bnote">${hg(0, 20)} 時渡りの砂時計: バトルに敗北したときにやり直せる<br>${hg(1, 20)} 虹の時渡りの砂時計: 敗北したとき相手を変えてやり直せる<br><span class="dim2">(うすい物は、ここでは使わない。負けたとき・修行のボタンなどで使う。はじめる前に使う物は、持ちこんだときに効いている)</span></div>
    <div class="v-big" style="font-size:14px;padding:9px;margin-top:0;color:#fff">🥤 野菜ジュースを使う(体力 62 → 110)</div></div>` })}
  ${stRow()}
</div>${foot}`;

grp('M', '1. 育成のメイン(案A の描き直し)', '住む場所が大きく、下に行動のボタン。上の帯で「この期の残りターン(最後までの残りは小さく)・総合力とランク・体力のゲージ(数字つき・上限が上がる)・ストレスのゲージ」がひと目。モンスターの絵は前の見本よりずっと小さくし(社長「もっと小さくしてもいい」)、景色と編成の6体が見える広さを残した。', [
  { id: 'M1', label: 'メイン(ふだん)', html: mainHtml(false) },
  { id: 'M2', label: 'メイン(ようすがあるとき = 🏥通院が光る)', html: mainHtml(true) },
  { id: 'M3', label: '持ち物(🎒を押したとき)', html: bagHtml },
], `<h3>どこに何を置いたか</h3><ul>
  <li><b>上の帯</b>: 「ミドル期 残り7ターン」を大きく、その下に「最後まで あと24」。総合力とランク。体力は数字つきのゲージ(62/110▲ = 上限が上がっている。点線が元の100)。ストレスも0〜100のゲージ。いちばん下の細い線は5つの期(デビュー・ジュニア・ミドル・プロ・最後)のどこにいるか</li>
  <li><b>住む場所</b>: 絵は高さの34%ほど(前の見本は約70%・第3版のはじめは44%)。季節と時間で景色が替わる。左に<b>編成</b>の6体(顔の下が親密度のゲージ・タッグに届いた子は光る枠と🤝)。助手の一言は帯のすぐ下。景色の左下に🎒持ち物(アイテムは1ターンに1個まで)、右下に🔍くわしく</li>
  <li><b>行動のボタン</b>(2段): 上は 休む・訓練(大きく・友情タッグがあるときだけ一言)・能力(能力ポイントの数字つき)/下は 通院・遊ぶ・修行(チケットの枚数の印)・大会(出られる星の印)の4つ並び。<b>🏥通院はいつも置き、「ようす」が無いときは薄く</b>、あるときは水色に光って「!」(社長 2026-11-12)</li>
  <li>いちばん下: 中断・早送り・演出を短く・きろく・メニュー</li></ul>
  <h3>持ち物(M3)</h3><ul>
  <li>メインの景色の上に小窓で開く。上に選んだ物の名前と説明、下に物の一覧と数、いちばん下に「使う」</li>
  <li>砂時計2つ(時渡りの砂時計・虹の時渡りの砂時計)もここに並ぶ。使うのは負けたときの画面</li>
  <li><b>使えるのは1ターンに1個まで</b>(使うと行動は使わない)。使ったターンは残りが薄くなり「このターンはもう使えない」。物と数字は仮</li></ul>
  <h3>動き(ふだんは短く)</h3><ul>
  <li>立ち絵はゆっくり息をする。体力が3割を切るとゲージが赤くなり、立ち絵が少しうつむく</li>
  <li>タッグの子の枠は、ゆっくり明るくなったり暗くなったりする(1.6秒で1往復)</li></ul>`);

// ================= 2. 訓練を選ぶ =================
// その月の集まり: [絵文字, 名前, 訓練Lv, 来ている子, 主の上がり幅]
const TR = [['❤️', 'ライフ', 2, ['e'], 11], ['💪', 'ちから', 3, ['d', 'a', 'c'], 38], ['🧠', 'かしこさ', 1, ['f'], 15], ['🎯', '命中', 2, ['as'], 13], ['💨', '回避', 1, [], 9], ['🛡️', '丈夫さ', 2, ['b'], 19]];
const tagN = (ks) => ks.filter((k) => AF[k] >= 80).length;
const trs = (sel) => `<div class="v-trs">${TR.map((t, i) => `<div class="v-tr${tagN(t[3]) ? ' tag' : ''}${i === sel ? ' sel' : ''}">
  <div class="o">${t[0]}</div><b class="nm">${t[1]}</b><i class="lv">Lv.${t[2]}</i></div>`).join('')}</div>`;
// 選んだ訓練の Lv とトレ経験値(ボタンには載せず、選んだあとに見せる)
const lvx = (lv, pct, add) => `<div class="v-lvx"><b>訓練Lv.${lv}</b><i><u style="width:${pct}%"></u><u class="ad" style="left:${pct}%;width:${add}%"></u></i><span>トレ経験値 +${add}${pct + add >= 100 ? ' → <em>Lvアップ!</em>' : ''}</span></div>`;
const cm = (k, name, eff, tagTxt) => `<div class="v-cm${AF[k] >= 80 ? ' tag' : ''}">${pf(k).replace(/<i class="af">.*?<\/i>/, '')}<div class="tx"><b>${name}</b><small>${AF[k] >= 80 ? '🤝 ' + tagTxt : eff}</small><div class="afl">親密度<i><b style="width:${AF[k]}%"></b></i>${AF[k]}</div></div></div>`;
const trainHeavy = (cls = '') => `${hdr('💰 名声 320', 'もどる')}<div class="v-body">
  ${band({ use: 26, stAdd: 8 })}
  ${scene({ monStyle: 'left:30%;bottom:34%;height:40%', grStyle: 'left:30%;bottom:calc(34% - 5px)', inner: `
    <div class="v-chips" style="right:auto;left:7px"><span class="v-chip ylw">💪 ちからの訓練 Lv3</span></div>
    <div class="v-come">${cm('d', 'らいが', '', 'タッグ +24%')}${cm('a', 'しずく', '', 'タッグ +27%')}${cm('c', 'ぴくりん', '編成の効き +14%', '')}</div>
    <div class="v-fx"><div class="t"><span class="big">🤝 友情タッグ ×2</span><span>効果 +51%</span><span class="fl">失敗 <b>6%</b></span></div>
      <div class="ch"><span>基本 +18</span><i>▶</i><span>編成 +41%</span><i>▶</i><span class="tgx">🤝×2 +51%</span><i>▶</i><span class="res">ちから +38</span></div>${lvx(3, 70, 30)}</div>` })}
  ${stRow([0, 38, 0, 7, 0, 5], 1)}
  ${trs(1)}
</div>${footGo('💪 ちからの訓練をする')}`;
const trainLight = `${hdr('💰 名声 320', 'もどる')}<div class="v-body">
  ${band({ use: 12, stAdd: 3 })}
  ${scene({ monStyle: 'left:30%;bottom:34%;height:40%', grStyle: 'left:30%;bottom:calc(34% - 5px)', inner: `
    <div class="v-chips" style="right:auto;left:7px"><span class="v-chip ylw">🧠 かしこさの訓練 Lv1</span></div>
    <div class="v-come">${cm('f', 'こんこ(借)', '編成の効き +33%', '')}</div>
    <div class="v-fx plain"><div class="t"><span>タッグなし</span><span style="color:#cbd5e1;font-size:10px">こんこ あと8でタッグ</span><span class="fl">失敗 <b>2%</b></span></div>
      <div class="ch"><span>基本 +8</span><i>▶</i><span>編成 +33%</span><i>▶</i><span class="res">かしこさ +11</span></div>${lvx(1, 40, 20)}</div>` })}
  ${stRow([2, 0, 11, 3, 0, 0], 2)}
  ${trs(2)}
</div>${footGo('🧠 かしこさの訓練をする')}`;

grp('T', '2. 訓練を選ぶ', 'メインの「訓練」を押すと、同じ景色のまま下が6つの訓練に替わる。ボタンは絵・名前・小さな Lv だけ(社長「ごちゃついてるから余計な表示はなくして」)。友情タッグがある訓練はボタンが金色に光る。選ぶと、右に来ている子と親密度のゲージ、下の札にタッグで効果が上がる流れと訓練Lv・トレ経験値、6能力の上に上がる量、上の帯に使う体力(赤いしま)と増えるストレス(紫のしま)を、決める前に見せる。訓練でマイナスになる能力はない・軽い/重いの切り替えもない(社長)。', [
  { id: 'T1', label: 'タッグ2体のとき(ちから)', html: trainHeavy() },
  { id: 'T2', label: 'タッグなしのとき(かしこさ)', html: trainLight },
], `<h3>ボタンはすっきり</h3><ul>
  <li>6つの丸いボタンに出すのは <b>訓練の絵・名前・小さな Lv</b> だけ。来ている子の顔・数字・経験値の棒は載せない</li>
  <li><b>友情タッグがある訓練はボタンが金色に光る</b>(光で分かるので顔は出さない)</li></ul>
  <h3>選んだあとに見せる物</h3><ul>
  <li><b>上がる3能力</b>: 主の能力は大きい字(+38)、ほか2つは小さく(+7・+5)。下がる能力はない</li>
  <li><b>使う体力</b>: 体力のゲージの右はしが赤いしまになり「−26」。ストレスは紫のしまで「+8」。失敗の率も数字で</li>
  <li><b>来ている子</b>(景色の右): 顔・名前・親密度のゲージ(白い線 = 80 = タッグ)。タッグの子は金色に光る札で「タッグ +24%」、まだの子は「編成の効き +14%」</li>
  <li><b>タッグで上がる見え方</b>: 「基本 → 編成 → 🤝×2 → ちから +38」と左から右へ積み上がる</li>
  <li><b>訓練Lv とトレ経験値</b>: 訓練は踏むたびに経験値がたまり Lv が上がる(最大5)。今回ふえる分を明るい色で。Lv が上がる回は「Lvアップ!」</li></ul>
  <h3>動き</h3><ul>
  <li>訓練を選び直すと、数字が 0.2秒で入れ替わる(画面は替わらない)。「決定」の2度押しで決まる。長押しでも中身が見える</li></ul>`);

// ================= 3. 結果 → 叱る/褒める → 連続イベント → ターンが進む =================
const resBigF = (lvup) => `${hdr('💰 名声 320', '中断')}<div class="v-body">
  ${band({ hp: 36, st: 42 })}
  ${scene({ bg: 'forest_morning', back: '<div class="v-burst"></div>', monStyle: 'left:62%;bottom:14%;height:46%;transform:translateX(-50%) rotate(6deg)', grStyle: 'left:62%;bottom:calc(14% - 5px)', inner: `
    <span class="v-prop" style="left:12%;bottom:15%">🪵</span><span class="v-prop" style="left:36%;bottom:40%;font-size:40px">💥</span>
    <div class="v-stamp">大成功<small>🤝 友情タッグ ×2・伸び ×1.5</small></div>
    <div class="v-chips" style="top:auto;bottom:8px">${['d', 'a', 'c'].map((k) => `<span class="v-chip">${CH[k].n} 親密度 +8</span>`).join('')}</div>` })}
  ${stRow([0, 57, 0, 10, 0, 7], 1, [412, 563, 233, 390, 198, 448])}
  <div class="v-log">${lvup ? '<div class="v-lvup">⬆ 訓練Lvアップ! 💪 ちから <b>Lv.3 → Lv.4</b><small>次から、ちからの訓練の基本の伸びが上がる</small></div>' : ''}<span class="hd2">💪 ちからの訓練</span><br>ちからが <b class="gu">57</b> 上がった! 命中 <b class="gu">+10</b>・丈夫さ <b class="gu">+7</b><br>体力が <b class="gd">26</b> 下がった<br>らいが・しずく・ぴくりんの親密度が <b class="ga">8</b> 上がった</div>
</div>${footGo('つぎへ ▶', '⏩ とばす')}`;
const res3 = (cls, word, sub, bg, mon, cap) => `<div class="v-scene" style="flex:1"><img class="bg" src="${BG(bg)}"><div class="sh"></div>${cls === 'ok' ? '<div class="v-burst b2"></div>' : ''}<img class="mon" src="${M('mocchi.png')}" style="${mon}"><div class="v-stamp ${cls}">${word}</div><div class="cap">${cap}</div></div>`;
const resOthers = `${hdr('💰 名声 320', '中断')}<div class="v-body">
  <div class="v-res3">
  ${res3('ok', '成功', '', 'forest_morning', '', '⭕ 伸び ×1。<b>ちから +38</b>・命中 +7・丈夫さ +5')}
  ${res3('ng', '失敗…', '', 'forest_evening', 'filter:grayscale(.5) drop-shadow(0 8px 5px #0009);transform:translateX(-50%) rotate(-12deg)', '❌ 能力は<b>上がらない</b>。体力は減る。体力が少ないほど起きやすい')}
  ${res3('zz', 'サボった', '', 'monhero_plaza', 'transform:translateX(-50%) rotate(84deg);bottom:-6%', '💤 伸び ×0.3。<b>ちから +11</b>。方針が甘いときだけ起きる')}
  </div>
</div>${footGo('つぎへ ▶', '⏩ とばす')}`;
const scold = `${hdr('💰 名声 320', '中断')}<div class="v-body">
  ${band({ hp: 36, st: 42 })}
  ${scene({ bg: 'forest_morning', cls: 'dk', noMon: 1, inner: `
    <div class="v-strip"></div><img class="v-body2" src="${BODY('mua__happy')}">
    <div class="v-chips"><span class="v-chip ylw">🌟 大成功のあと</span></div>
    <div class="v-q"><div class="ask">みゅあ「すっごいぢゃん! もちまる、ほめてあげる?」</div>
      <div class="bt"><div class="v-ch">👏 褒める<small>甘え度 +3・方針が甘いほうへ</small></div><div class="v-ch b">📣 叱る<small>恐れ度 +3・方針が厳しいほうへ</small></div><div class="v-ch n">なにもしない(方針はそのまま)</div></div></div>` })}
  <div class="v-pol"><div class="l"><span>超溺愛</span><span>甘い</span><span style="color:#fde047">いまの方針: 普通</span><span>厳しい</span><span>超スパルタ</span></div>
    <div class="m"><i></i><i></i><i></i><i class="on"></i><i></i><i></i><i></i></div>
    <div class="two"><div class="v-ga"><span>🥰 甘え度</span><div class="tr"><i style="width:38%;background:linear-gradient(180deg,#f9a8d4,#f472b6)"></i></div><b>38</b></div><div class="v-ga"><span>😨 恐れ度</span><div class="tr"><i style="width:34%;background:linear-gradient(180deg,#7dd3fc,#3b82f6)"></i></div><b>34</b></div></div>
    <div style="font-size:9.5px;color:#cbd5e1;font-weight:700;margin-top:4px">忠誠度 72 = 甘え度 38 + 恐れ度 34。甘すぎるとサボりやすく、厳しすぎるとストレスがたまりやすい</div></div>
</div>${footGo('えらんでね', '⏩ とばす', 'on')}`;
const chain = `${hdr('💰 名声 320', '中断')}<div class="v-body">
  ${band({ hp: 36, st: 42 })}
  ${scene({ bg: 'monhero_town', monStyle: 'left:30%;bottom:34%;height:36%', grStyle: 'left:30%;bottom:calc(34% - 5px)', inner: `
    <img class="mon" src="${M('tiger.png')}" style="left:70%;bottom:32%;height:46%">
    <div class="v-ev-h"><small>編成の子との出来事</small>らいが 第2話「秘密の練習場」</div>
    <div class="v-dots">らいがの話 <i class="on"></i><i class="on"></i><i></i></div>
    <div class="v-talk"><span class="who">らいが</span>「……ついてこい。オレがいつも使ってる場所だ。<br>だれにも教えてないんだからな」</div>` })}
  <div class="v-opts">
    <div class="v-opt">🔥 思いきりやる!<small>ちから 中アップ・体力 少しダウン・親密度 +10</small></div>
    <div class="v-opt">🍃 のんびり付き合う<small>体力 中回復・ストレス 少しダウン・親密度 +10</small></div>
  </div>
  <div style="font-size:9.5px;color:#cbd5e1;font-weight:700;margin-top:6px;text-align:center">第3話は親密度60から(らいがの持つ技「かみなりの爪」を教えてもらえるかも)。見た話は「とばす」ができる</div>
</div>${footGo('えらんでね', '⏩ とばす', 'on')}`;
const turn = `${hdr('💰 名声 320', '中断')}<div class="v-body">
  ${band({ hp: 36, st: 42, left: 6, all: 23, ym: '3年目 7月', fill: 50 })}
  <div class="v-scene"><div class="v-clock">
    <div class="v-cal"><div class="y">ミドル期・3年目</div><div class="mth">7<small>月</small></div><div class="old">6月 おつかれさま</div></div>
    <div class="v-next">この期の残り <s>7</s><b>6</b> ターン</div>
    <div class="v-chip hot" style="position:static">🏆 期末の大会まで あと6ターン</div>
    <div class="v-chip" style="position:static">🌻 季節が夏になった</div>
    <div class="v-phs">${[['デビュー', 5, 100], ['ジュニア', 12, 100], ['ミドル', 12, 50], ['プロ', 12, 0], ['最後', 5, 0]].map(([n, w, f]) => `<span style="flex:${w}" class="${n === 'ミドル' ? 'now' : ''}"><i style="width:${f}%"></i><b>${n}</b></span>`).join('')}</div>
  </div></div>
</div>${foot}`;

grp('K', '3. 結果 → 叱る/褒める → 編成の子の連続イベント → ターンが進む', '訓練を決めたあとの1ターンの流れ。ふだんは全部で3〜6秒(結果 約1.2秒・ターンが進む 約0.8秒。どれもタップでとばせる)。叱る/褒めると連続イベントだけ、選ぶまで止まる。', [
  { id: 'K1', label: '結果(🌟大成功)', html: resBigF(false) },
  { id: 'K1b', label: '結果(訓練Lvアップのとき)', html: resBigF(true) },
  { id: 'K2', label: '結果のほかの3種類(⭕成功・❌失敗・💤サボり)', html: resOthers },
  { id: 'K3', label: '叱る/褒める', html: scold },
  { id: 'K4', label: '編成の子の連続イベント', html: chain },
  { id: 'K5', label: 'ターンが進む', html: turn },
], `<h3>結果(4種類)</h3><ul>
  <li><b>🌟大成功 ×1.5</b>: 金色の放射と大きな字。<b>⭕成功 ×1</b>: 白とピンクの字。<b>❌失敗 ×0</b>: 灰色・夕方の色・絵が傾く。<b>💤サボり ×0.3</b>: 紫の字・絵が寝ころぶ</li>
  <li>下の白い札に「何が上がった・下がった・だれの親密度が上がった」を文で。6能力の列にも + / − を出す</li>
  <li>K2 は3種類を1枚に並べた説明用(本番は K1 と同じ1画面ずつ)</li>
  <li><b>訓練Lvアップ</b>(K1b): トレ経験値がたまった回は、結果の札のいちばん上に金色の帯で「訓練Lvアップ! Lv.3 → Lv.4」(約0.6秒・結果と同じ画面の中)</li></ul>
  <h3>叱る/褒める</h3><ul>
  <li>助手が斜めの帯で出てきて聞く。褒める(ピンク)・叱る(水色)・なにもしないの3つ。押す前に、甘え度/恐れ度と方針がどちらへ動くかを見せる</li>
  <li>下に育成方針の7段の目盛り(いまどこ)と、甘え度・恐れ度のゲージ</li></ul>
  <h3>編成の子の連続イベント</h3><ul>
  <li>同じ訓練に来た子が50%で出てくる。子ごとに3話。右上の点で「いま何話目か」。選択肢の下に、もらえる物を先に見せる。3話の技の伝授は<b>その編成の子が持つ技</b>を教わる(社長 2026-11-12)</li></ul>
  <h3>ターンが進む</h3><ul>
  <li>カレンダーが1枚めくれ、「残り 7 → 6」。期の変わり目と大会の前だけ一言が足される。期が変わるとき・昇格・引退は長め(5〜6秒)</li></ul>`);

// ================= 4. 始めるまで(6段) =================
const STEP = ['育てる子', '編成', '助手', '持ちこみ', '名前と染色', '確認'];
const steps = (n) => `<div class="v-steps">${STEP.map((s, i) => `${i ? '<u></u>' : ''}<span class="${i < n ? 'ok' : i === n ? 'on' : ''}">${i < n ? '✓' : i === n ? (i + 1) + ' ' + s : i + 1}</span>`).join('')}</div>`;
const sHd = (n) => hdr(`${n + 1} / 6`, n ? 'もどる' : 'やめる', '');
const BASE = ['mocchi', 'suezo', 'golem', 'tiger', 'pixie', 'undine', 'kyubi', 'ham', 'plant', 'monol', 'ghost', 'dreamy'];
const s1 = `${sHd(0)}<div class="v-body">${steps(0)}
  <div class="v-h">だれを育てる?<small>ベースモンか、合体で生まれた未育成の子から1体</small></div>
  <div class="v-tabs"><span class="on">🌱 ベースモン 18</span><span>🧬 合体で生まれた子 2</span></div>
  <div class="v-grid6">${BASE.map((t, i) => `<span class="${i === 0 ? 'on' : i > 9 ? 'lk' : ''}"><img src="${T(t)}"></span>`).join('')}</div>
  ${scene({ monStyle: 'bottom:12%;height:74%', grStyle: 'bottom:calc(12% - 5px)', inner: '<div class="v-chips"><span class="v-chip ylw">モッチー</span><span class="v-chip">えらんだ回数 3回・最高 B</span></div>' })}
  <div class="v-card sel">
    <div class="h1">モッチー <span class="sub">バランスよく育つ。体力の上限が上がりやすい</span></div>
      <div class="v-kv"><b>成長の型</b><span>はじめるとくじで決まる <span class="yel">(早熟〜晩成)</span></span></div>
      <div class="v-kv"><b>覚える技</b><span>もっちキャノン ほか 8つ</span></div>
    <div class="sub" style="margin-top:6px;color:#f9a8d4;font-weight:900">伸びやすさ(素質)</div>
    <div class="v-apt">${[['ライフ', 'A'], ['ちから', 'B'], ['かしこさ', 'C'], ['命中', 'B'], ['回避', 'D'], ['丈夫さ', 'A']].map(([n, g]) => `<div class="${g > 'B' ? 'lo' : ''}">${n}<b>${g}</b></div>`).join('')}</div>
  </div>
</div>${footGo('この子にする ▶', '← やめる')}`;
const SL = [['d', 'らいが', 'ちから18% 命中15%', '親密度25・タッグ+24%', '🔥🤝'], ['a', 'しずく', 'かしこさ21% ライフ17%', '親密度30・タッグ+27%', '🔥✨🎯'], ['b', 'がんてつ', '丈夫さ19% ライフ16%', '親密度25・タッグ+25%', '🧘🩹'], ['c', 'ぴくりん', '回避24% かしこさ20%', '親密度35・タッグ+30%', '🔥📯✨💞'], ['e', 'スエゾー', '命中4% かしこさ3%', '親密度0・タッグ+15%', 'ベースモン'], ['f', 'こんこ', 'かしこさ33% 命中28%', '親密度50・タッグ+35%', '🔥✨🤝⚔']];
const s2 = `${sHd(1)}<div class="v-body">${steps(1)}
  <div class="v-h">編成の6体<small>保存枠から5体+フレンドから1体。強い子ほど訓練がよく伸びる</small></div>
  <div class="v-slots">${SL.map(([k, n, t3, bs, ic]) => `<div class="v-sl${CH[k].fr ? ' fr' : ''}${CH[k].base ? ' base' : ''}">${pf(k, 'lg').replace(/ tag/, '').replace(/<i class="af">.*?<\/i>/, '')}${n} ${rk(CH[k].r)}<div class="t3">${t3}</div><div class="bs">${bs}</div><div class="ic">${ic}</div></div>`).join('')}</div>
  <div class="v-card"><div class="sub" style="color:#f9a8d4;font-weight:900">この編成が集まりやすい訓練</div>
    <div class="v-heat">${[['ライフ', 2, 'x2'], ['ちから', 1, ''], ['かしこさ', 4, 'x3'], ['命中', 3, 'x3'], ['回避', 1, ''], ['丈夫さ', 1, '']].map(([n, c, h]) => `<div class="${h}">${n}<b>${c}体</b></div>`).join('')}</div>
    <div class="sub" style="margin-top:5px">かしこさ・命中に集まりやすい編成。ちから・回避は手うすだよ</div></div>
  <div class="v-card pk"><div class="row">${pf('f', 'lg').replace(/<i class="af">.*?<\/i>/, '')}<div class="f1"><div class="h2">こんこ ${rk('M2')} <span class="chip s">フレンド: ゆうた</span></div><div class="sub">上位3つ: かしこさ 33%・命中 28%・回避 24%</div></div></div>
    <div class="v-kv"><b>基本値</b><span>はじめの親密度 50・タッグ +35%・得意率 65%・はじめ かしこさ +40</span></div>
    <div class="v-kv"><b>アシスト</b><span>🔥 特訓の底力 段3・✨ ひらめき 段3・🤝 人なつっこさ 段3・⚔ 修行の手ほどき 段1</span></div></div>
  <div class="v-card" style="flex:1;min-height:0"><div class="sub" style="color:#7dd3fc;font-weight:900">🤝 フレンドから借りる(1体)</div>
    ${[['kyubi', 'M2', 'ゆうた の こんこ', 'かしこさ・命中・回避', 1], ['dragon', 'S3', 'みさき の りゅうき', 'ちから・ライフ・丈夫さ', 0], ['ham', 'A2', 'けんじ の はむすけ', '回避・命中・かしこさ', 0]].map(([t, r, n, top, on]) => `<div class="v-item${on ? ' sel' : ''}" style="padding:4px 8px"><img src="${t === 'dragon' ? M('dragon.png') : T(t)}" style="width:30px;height:30px;border-radius:9px;object-fit:cover;background:#0f172a"><div>${n} ${rk(r)}<small>${top}</small></div><span class="pr">${on ? '✅ 借りている' : '借りる'}</span></div>`).join('')}</div>
</div>${footGo('この編成でいく ▶')}`;
const s3 = `${sHd(2)}<div class="v-body">${steps(2)}
  <div class="v-h">だれの物語で育てる?<small>助手ごとに、筋書き・出来事・訓練の組み合わせが変わる</small></div>
  <div class="v-faces">${[['myua', 'on'], ['kiki', ''], ['momosuke', ''], ['dra', ''], ['atsu', ''], ['kyuko', ''], ['sorashido', 'lk'], ['erubin', 'lk']].map(([a, c]) => `<span class="${c}"><img src="${F(a)}"></span>`).join('')}</div>
  <div class="v-card sel" style="flex:1;min-height:0;display:flex;flex-direction:column;gap:6px">
    <div class="v-sc"><div class="pic"><img src="${BODY('mua__happy')}"></div><div class="tx">
      <h4><small>シナリオ 1・みゅあ編</small>いっしょに、<br>てっぺんへ!</h4>
      <div style="margin-top:4px">明るく元気なムードメーカーと、笑いながら頂点をめざす物語。はじめての育成におすすめ</div>
      <div style="margin-top:5px"><span class="chip on">やさしい</span> <span class="chip p">仲良し度 Lv4</span></div></div></div>
    <div class="v-kv"><b>助手の効き</b><span>遊ぶ・休むでストレスが 1.3倍 減る。褒めたときの忠誠 +1</span></div>
    <div class="v-kv"><b>訓練の組み合わせ</b><span>❤️ライフ → +🧠+🎯 / 💪ちから → +🎯+🛡️ / 🧠かしこさ → +❤️+🎯 …</span></div>
    <div class="v-kv"><b>出来事</b><span>4話のうち <span class="yel">3話まで</span>(仲良し度 Lv5 で全部+特別な1話)</span></div>
    <div class="v-kv"><b>はじめの親密度</b><span>32(仲良し度 Lv4)。助手も訓練に来て、タッグになる(+25%)</span></div>
    <div class="v-eps">${[['1話', 'はじめての おでかけ', 1], ['2話', 'はげまし合う夜', 1], ['3話', 'ふたりの約束', 1], ['4話', '？？？', 0], ['特別', '？？？', 0]].map(([n, t, ok]) => `<div class="${ok ? '' : 'lk'}"><b>${n}</b>${ok ? t : '🔒 ' + t}</div>`).join('')}</div>
    <div class="row" style="margin-top:auto"><img class="fc" src="${F('myua', 'wink')}"><div class="bub f1">「いっしょに てっぺん めざそ! まぢで楽しいから!」</div></div>
  </div>
</div>${footGo('みゅあ編ではじめる ▶')}`;
// S4 持ちこみ: 12種のうち2つまで。選んだ物 = 体力アップ・トレ得意
const S4SEL = ['dango', 'mag'];
const s4 = `${sHd(3)}<div class="v-body">${steps(3)}
  <div class="v-h">持ちこみ(2つまで)<small>名声で手に入れた物を、育成に持っていける。持っていかなくてもよい</small></div>
  <div class="v-bag">${[0, 1].map((i) => S4SEL[i] ? `<div class="in">${icon(S4SEL[i])}<small>${IT[S4SEL[i]][1].replace('週刊!', '')}</small></div>` : '<div>＋<small style="color:#94a3b8">空き</small></div>').join('')}</div>
  <div class="v-igrid">${ITEMS.map((t) => `<div class="${S4SEL.includes(t[0]) ? 'in' : ''}${t[3] === 'both' ? ' bo' : ''}">${icon(t[0])}<i>×${t[4]}</i><small>${t[1].replace('ガロエ印の', '')}</small>${S4SEL.includes(t[0]) ? '<u>✔</u>' : ''}</div>`).join('')}</div>
  <div class="v-ileg"><span><b class="sw1"></b>はじめる前に効く物</span><span><b class="sw2"></b>育成中にも使える物(1ターン1個まで)</span></div>
  <div class="v-item sel">${icon('dango')}<div>モモのキビダンゴ<small>${IT.dango[2]}</small></div><span class="pr">✅ 持っていく・あと97</span></div>
  <div class="v-item sel">${icon('mag')}<div>週刊!トレーニング<small>${IT.mag[2]}</small></div><span class="pr">✅ 持っていく・あと99</span></div>
  <div style="flex:1"></div>
  <div class="v-card pk"><div class="sub" style="color:#f9a8d4;font-weight:900">持っていくと</div><div class="v-kv"><b>体力の上限</b><span>100 → <span class="yel">110</span></span></div><div class="v-kv"><b>最初から付く ようす</b><span class="yel">トレーニング得意</span></div>
    <div class="row" style="margin-top:6px"><img class="fc" src="${F('myua', 'happy')}"><div class="bub f1">「キビダンゴで体力もりもり! トレもはかどるね!」</div></div></div>
</div>${footGo('これでいく ▶')}`;
const sw = (cols, on) => cols.map((c, i) => `<i class="${i === on ? 'on' : ''}" style="background:${c}"></i>`).join('');
const s5 = `${sHd(4)}<div class="v-body">${steps(4)}
  <div class="v-h">名前と染色<small>あとからいつでも変えられる</small></div>
  ${scene({ monStyle: 'bottom:14%;height:72%', grStyle: 'bottom:calc(14% - 5px)', inner: '<div class="v-chips"><span class="v-chip">成長の型: <b style="color:#fde047">晩成</b>(くじで決まった)</span></div>' })}
  <div class="v-inp">もちまる<small>4 / 8文字</small></div>
  <div class="v-card">
    <div class="v-sw"><b>からだ</b>${sw(['#f9a8d4', '#fde047', '#86efac', '#7dd3fc', '#c4b5fd', '#fff', '#fb923c', '#475569'], 0)}</div>
    <div class="v-sw"><b>あたま</b>${sw(['#f9a8d4', '#fde047', '#86efac', '#7dd3fc', '#c4b5fd', '#fff', '#fb923c', '#475569'], 2)}</div>
    <div class="v-sw"><b>くちばし</b>${sw(['#f9a8d4', '#fde047', '#86efac', '#7dd3fc', '#c4b5fd', '#fff', '#fb923c', '#475569'], 1)}</div>
  </div>
</div>${footGo('これで決める ▶')}`;
const s6 = `${sHd(5)}<div class="v-body">${steps(5)}
  <div class="v-h">これで はじめる?<small>全46ターン・1回 約8〜15分。いつでも中断して続きから</small></div>
  ${scene({ monStyle: 'left:36%;bottom:16%;height:62%', grStyle: 'left:36%;bottom:calc(16% - 5px)', inner: `<span class="v-nm" style="left:36%;bottom:6px">もちまる<small>モッチー・晩成</small></span><img src="${BODY('mua__happy')}" style="position:absolute;right:-9%;bottom:-22%;height:84%">` })}
  <div class="v-sum"><span class="k">編成</span>${['d', 'a', 'b', 'c', 'e', 'f'].map((k) => pf(k, 'sm').replace(/ tag/, '').replace(/<i class="af">.*?<\/i>/, '')).join('')}<span class="ed">変える</span></div>
  <div class="v-sum"><span class="k">助手</span><span>みゅあ編「いっしょに、てっぺんへ!」</span><span class="ed">変える</span></div>
  <div class="v-sum"><span class="k">持ちこみ</span><span class="v-ics">${icon('dango')}${icon('mag')} キビダンゴ・週刊!トレーニング</span><span class="ed">変える</span></div>
  <div class="v-sum"><span class="k">はじめの上乗せ</span><span>編成から ちから +24・かしこさ +67 ほか/体力の上限 110/ようす: トレーニング得意</span></div>
  <div class="v-big">🌱 育成をはじめる</div>
</div>`;

grp('S', '4. 始めるまで(6段)', '育てる子 → 編成 → 助手(シナリオのように選ぶ) → 持ちこみ → 名前と染色 → 確認。上の丸い数字で「いま何段目か」。どの段も下の大きなボタン1つで次へ。', [
  { id: 'S1', label: '① 育てる子', html: s1 }, { id: 'S2', label: '② 編成', html: s2 }, { id: 'S3', label: '③ 助手(シナリオ)', html: s3 },
  { id: 'S4', label: '④ 持ちこみ', html: s4 }, { id: 'S5', label: '⑤ 名前と染色', html: s5 }, { id: 'S6', label: '⑥ 確認', html: s6 },
], `<h3>段ごとに見せる物</h3><ul>
  <li><b>① 育てる子</b>: ベースモン/合体で生まれた子の2つの札。選ぶと立ち絵・伸びやすさ(素質)・覚える技</li>
  <li><b>② 編成</b>: 6体の札に「上位の補正・はじめの親密度・タッグの強さ・アシスト能力のアイコン」。下に「この編成が集まりやすい訓練」を色の濃さで。フレンドから借りた子は水色</li>
  <li><b>③ 助手</b>: 物語を選ぶ感じに。助手の顔を横に並べ、選ぶと大きな札(題・あらすじ・助手の効き・訓練の組み合わせ・出来事の数・はじめの親密度)</li>
  <li><b>④ 持ちこみ</b>: 上に3つの枠、下に持ち物。中身の物は仮(仕組みの案はこれから)</li>
  <li><b>⑤ 名前と染色</b>: 住む場所に立たせて、部位ごとの色を選ぶ。成長の型のくじはここで見せる</li>
  <li><b>⑥ 確認</b>: 全部を1枚に。それぞれ「変える」で戻れる。大きな「育成をはじめる」</li></ul>
  <h3>動き</h3><ul><li>はじめるときだけ長め(景色が開いて、助手が一言・約3秒)</li></ul>`);

// ================= 5. イッサ博士 =================
const dots = (n) => `<span class="pr">成功${[0, 1, 2, 3].map((i) => `<i class="${i < n ? 'on' : ''}"></i>`).join('')}</span>`;
const IX = [['💪 ステータスアップ', 1, '全能力 +50', '全能力 −10・サボりグセ', 'sel'], ['🔋 体力上限アップ', 2, '体力の上限 +20', '体力 −20', ''], ['❤️ 体力回復', 4, '体力を8割回復', '体力 −30・うつ病', ''], ['🤝 忠誠度アップ', 3, '忠誠度 +15', '忠誠度 −5', ''], ['⭐ 人気アップ', 3, '人気 +15', '人気 −5', '']];
const issaScene = (inner) => `<div class="v-scene"><img class="bg" src="${BG('monhero_night')}"><div class="sh" style="background:#0f0d2466"></div>${inner}</div>`;
const issa1 = `${hdr('💰 名声 320', '中断')}<div class="v-body">
  ${band()}
  ${issaScene(`<img class="v-issa" src="../art/issa-hakase.png">
    <div class="v-machine">⚙️💡<small>のびのび装置</small><img src="${M('mocchi.png')}" style="height:46%;aspect-ratio:1;object-fit:contain"></div>
    <div class="v-ev-h" style="top:auto;bottom:8px;border-radius:0 99px 99px 0"><small>大きな賭け</small>イッサ博士があらわれた!</div>
    <div class="v-ibub">「やっほー! ちょっと強くなってみない?<br><b>へーきへーき</b>、痛くない痛くない、たぶん!」</div>`)}
  <div class="v-six">${IX.map(([n, d, ok, ng, c]) => `<div class="v-ix ${c}">${n}${dots(d)}<span class="ok">⭕ ${ok}</span><span class="ng">❌ ${ng}</span></div>`).join('')}
    <div class="v-ix no">🙅 何もしない<span class="ok" style="color:#cbd5e1">ことわる。損はない</span><span class="ng" style="color:#94a3b8">「えー、ノリ悪いなぁ」</span></div></div>
</div>${footGo('💪 ステータスアップを受ける', '← 考え直す')}`;
const issa2 = `${hdr('💰 名声 320', '中断')}<div class="v-body">
  ${band({ pow: '6,840', hp: 62 })}
  ${issaScene(`<div class="v-burst"></div><img class="v-issa" src="../art/issa-hakase.png">
    <img class="mon" src="${M('mocchi.png')}" style="left:70%;bottom:12%;height:44%">
    <div class="v-stamp" style="top:3%;font-size:44px">大成功!<small>装置がぴかーっと光った</small></div>
    <div class="v-ibub" style="top:auto;bottom:8px;left:8px;right:44%">「ほらぁ! 言ったでしょ、へーきって! 天才かも、ぼく!」</div>`)}
  ${stRow([50, 50, 50, 50, 50, 50], -1, VAL.map((v) => v + 50))}
  <div class="v-log"><span class="hd2">💪 ステータスアップ</span><br>全能力が <b class="gu">50</b> 上がった!<br>みゅあ「博士、たまにはやるぢゃんｗ」</div>
  <div class="v-card" style="border-color:#f87171"><div class="row"><span style="font-size:26px">💨</span><div class="f1 sub"><b style="color:#fca5a5">失敗のとき</b>: 装置から煙・博士はピースのまま固まる。「…あっれぇ? ネジ1本あまってるな…」<br>全能力 −10 と、ようす「😪 サボりグセ」が付く(メインに 🏥通院 が出る)</div></div></div>
</div>${footGo('つぎへ ▶', '⏩ とばす')}`;

grp('I', '5. イッサ博士の出来事(大きな賭け)', 'ターンの合間に、町はずれの研究者イッサ博士が現れる。6つから1つ選ぶ(「何もしない」なら断れる)。絵は社長の絵(art/issa-hakase.png)。ここは節目なので長め(装置が動いて結果が出るまで約4秒)。', [
  { id: 'I1', label: '6つから選ぶ', html: issa1 },
  { id: 'I2', label: '結果(成功)と、失敗のときの見え方', html: issa2 },
], `<h3>見せ方</h3><ul>
  <li>夜の景色に博士の全身(上半身が見える大きさ)と「のびのび装置」(ガムテープで直してある)。装置の中に育てる子</li>
  <li>6つの札: 名前・成功しやすさの点(4つの点)・⭕成功したとき・❌失敗したとき。「何もしない」は点線の札</li>
  <li>選ぶと装置のランプの色が変わる → ガタガタ動いて光る → 結果</li>
  <li>成功: 金色の放射と「大成功!」。失敗: 煙と灰色、博士は白衣が少しすすける</li>
  <li>助手とのかけ合いは、シナリオの助手が1人だけ出る</li></ul>
  <h3>社長に聞きたいこと</h3><ul><li>成功の率を、数字(35% など)で見せるか・点で見せるか(この絵は点)</li></ul>`);

// ================= 6. 引退とアシスト能力 =================
const FIN = [612, 768, 402, 655, 318, 590];
const retire = `${hdr('46 / 46ターン', 'とじる', '')}<div class="v-body">
  <div class="v-h">🎓 引退 ── もちまるの育成がおわった<small>みゅあ編「いっしょに、てっぺんへ!」・最後の期の大会に出た</small></div>
  <div class="v-rank"><img class="mon2" src="${M('mocchi.png')}"><div class="tx"><small>育成ランク</small><div class="L">A1</div></div><div class="tx"><small>総合力</small><b>11,480</b><small style="color:#cbd5e1;margin-top:3px">次の S まで あと 2,520</small><small style="color:#86efac">自己ベスト更新!(前 9,210)</small></div></div>
  ${stRow(null, -1, FIN)}
  <div class="v-rec">
    <div><small>🏆 大会</small>12戦 9勝・★★★ 優勝 2回</div>
    <div><small>🤝 忠誠 / ⭐ 人気</small>88 / 71</div>
    <div><small>📯 集まりやすい訓練(上位3つ)</small>💪ちから・🎯命中・❤️ライフ</div>
    <div><small>💥 編成での補正</small>ちから 23%・命中 19%・ライフ 16%</div>
    <div><small>🧩 アシストの基本値</small>親密度 30・タッグ +27%・得意率 65%</div>
    <div><small>📈 はじめの能力</small>ちから +30</div>
  </div>
  <div class="v-card pk"><div class="row"><img class="fc" src="${F('myua', 'excited')}"><div class="bub f1">「もちまる、まぢでがんばったね! 次の子の編成に入ったら、ちからの訓練がすっごい伸びるよ!」</div></div></div>
  <div class="v-card"><div class="sub" style="color:#f9a8d4;font-weight:900">🏅 この育成で手に入れたもの</div><div class="v-kv"><b>名声</b><span>+480(合計 800)</span></div><div class="v-kv"><b>称号</b><span>「春の覇者」「タッグの名手」</span></div><div class="v-kv"><b>助手</b><span>みゅあの仲良し度が上がった(+2)</span></div><div class="v-kv"><b>保存枠</b><span>12 / 30体 に入る。次の育成の編成・対戦・合体に使える</span></div></div>
  <div style="flex:1"></div>
  <div class="v-big">✨ アシスト能力を取る(229ポイント)</div>
</div>`;
// [名前, 説明, 値段3つ, 取った段, 状態]
const AS = [['🔥 特訓の底力', 'いっしょの訓練の伸び +4/7/10%', [40, 80, 128], 2], ['💞 信頼のきずな', '忠誠が高いほど伸びる', [40, 80, 128], 0, 'dim'], ['📯 かけつけ', '得意な訓練に来る率 +8/14/20点', [32, 64, 104], 0, 'dim'], ['✨ ひらめき', '大成功の率 +3/5/8点', [32, 64, 104], 1], ['🤝 人なつっこさ', '親密度の上がり ×1.2/1.4/1.6', [32, 64, 104], 2], ['🎯 得意の後押し', '1位の能力(ちから)の伸び', [24, 48, 80], 2], ['🧘 落ち着き', '失敗の率 −15/25/35%', [24, 48, 80], 0, 'dim'], ['🩹 いたわり', '減る体力 −8/14/20%', [24, 48, 80], 0, 'dim'], ['⚔ 修行の手ほどき', '修行の伸び +10/18/25%', [24, 48, 80], 0, 'dim']];
const asCard = ([n, ex, pr, got, st], i) => `<div class="v-a${got ? ' got' : ''} ${st || ''}${i === 8 ? ' wide' : ''}"><div class="nm">${n}</div><div class="ex">${ex}</div><div class="lv">${pr.map((p, j) => `<span class="${j + 1 === got ? 'on' : ''}">段${j + 1}<b>${p}</b></span>`).join('')}</div></div>`;
const assist = (cls = '') => `${hdr('1体4種類まで', 'もどる', '')}<div class="v-body">
  <div class="v-pt"><div class="n">アシストポイント<b>5<small style="font-size:11px;color:#cbd5e1"> / 229</small></b></div><div class="r">総合力 11,480 ÷ 50 = 229ポイント<br><span class="yel">使った 224</span>・残り 5(あまりは なくなる)<div class="bar p"><i style="width:98%"></i></div></div></div>
  <div class="v-as">${AS.map(asCard).join('')}</div>
  <div class="v-pick">取るもの(4 / 4種類): <b>🔥 特訓の底力 段2</b>・<b>✨ ひらめき 段1</b>・<b>🤝 人なつっこさ 段2</b>・<b>🎯 得意の後押し 段2</b><br>⚠ 決めたあとは変えられない</div>
</div><div class="v-ft"><span>🎲 おまかせ</span><span>やり直す</span><span class="go">これで決める ▶</span></div>`;

grp('E', '6. 引退と、アシスト能力をポイントで取る', '46ターン目(または最後の期の大会で負けたとき)に引退。振り返りと育成ランク → アシスト能力を取る → 保存枠へ。ここは節目なので長め(ランクの字が出るまで5〜6秒・とばせる)。', [
  { id: 'E1', label: '引退(振り返りと育成ランク)', html: retire },
  { id: 'E2', label: 'アシスト能力をポイントで取る', html: assist() },
], `<h3>引退</h3><ul>
  <li>育成ランクの字をいちばん大きく(G〜M の色)。総合力・次のランクまで・自己ベスト</li>
  <li>最後の6能力、大会の成績、この子が編成に入ったときの効き(集まりやすい訓練・補正・基本値)をここで見せる = 「次はこの子を連れていこう」につながる</li></ul>
  <h3>アシスト能力を取る(ASSIST.md §5)</h3><ul>
  <li>上にポイント(総合力 ÷ 50)と残り。9種類の札を2列。札ごとに 段1・段2・段3 と値段。取った段はピンク、4種類取ったら残りは薄く</li>
  <li>下に「取るもの」のまとめと「決めたあとは変えられない」。おまかせ・やり直す・これで決める</li>
  <li>余りは「なくなる」と先に見せる</li></ul>`);

// ================= 6a. 修行(技を選ぶ → 結果) =================
// 覚えられる技: 間合いごと [名前, 覚える率, 状態]
const TECH = [['零', [['もちもちガード', 62, ''], ['ころころタックル', 48, 'sel']]], ['近', [['のびのびパンチ', 55, 'sel'], ['ぺったんプレス', 30, '']]], ['中', [['もっちキャノン', 41, ''], ['はねもち', 0, 'got']]], ['遠', [['おもちの雨', 18, '']]]];
const shugyo = `${hdr('💰 名声 320', 'もどる')}<div class="v-body">
  ${band({ use: 30 })}
  ${scene({ bg: 'forest_deep', cls: 'low', noMon: 1, inner: `<img src="${BODY('mua__happy')}" style="position:absolute;left:-2%;bottom:-98%;height:190%">
    <div class="v-ev-h"><small>${tk(13)} チケット 3枚(1回に1枚)</small>⚔ 修行に出る</div>
    <div class="v-ibub" style="left:40%;top:auto;bottom:10px">「修行は<b>2段</b>! 能力が上がって、最後に<b>技を覚える</b>チャンスだよ。覚えたい技を2つまで選んでね」</div>` })}
  <div class="v-stg"><div><small>第1段・火の山</small>🎯 命中 & ❤️ ライフ</div><i>▶</i><div><small>第2段・氷の谷</small>🛡️ 丈夫さ & 💨 回避</div><i>▶</i><div class="last"><small>さいごに</small>✨ 技のくじ</div></div>
  <div class="v-card pk" style="padding:6px 8px"><div class="sub" style="color:#f9a8d4;font-weight:900">えらんだ技(2つまで)</div>
    <div class="v-pick2"><div class="on"><small>近</small>のびのびパンチ<b>55%</b></div><div class="on"><small>零</small>ころころタックル<b>48%</b></div></div></div>
  <div class="v-card" style="flex:1;min-height:0;display:flex;flex-direction:column;justify-content:space-evenly;padding:6px 8px"><div class="sub" style="color:#f9a8d4;font-weight:900">覚えられる技(間合いごと・覚える率)</div>
    ${TECH.map(([d, ts]) => `<div class="v-tk"><i>${d}</i>${ts.map(([n, p, c]) => `<span class="${c}">${n}<b>${c === 'got' ? '覚えた' : p + '%'}</b></span>`).join('')}</div>`).join('')}
    <div class="sub">前の修行で覚えられなかった技は、覚える率が上がっている(⬆)。助手がドラだと、さらに覚えやすい</div></div>
</div><div class="v-ft"><span>← もどる</span><span class="go">⚔ 修行する(${tk(13)} 3 → 2)</span></div>`;
const shugyoRes = `${hdr('💰 名声 320', '中断')}<div class="v-body">
  ${band({ hp: 32, st: 40 })}
  ${scene({ bg: 'forest_evening', back: '<div class="v-burst"></div>', monStyle: 'bottom:16%;height:44%', grStyle: 'bottom:calc(16% - 5px)', inner: `
    <div class="v-stamp" style="top:5%;font-size:40px">技をおぼえた!<small>✨ のびのびパンチ(近い間合い)</small></div>
    <div class="v-chips" style="top:auto;bottom:8px"><span class="v-chip">第1段 🎯+12 ❤️+9</span><span class="v-chip">第2段 🛡️+10 💨+8</span><span class="v-chip ylw">👥 編成のおかげ +9</span></div>` })}
  ${stRow([9, 0, 0, 12, 8, 10], -1, [421, 506, 233, 392, 206, 451])}
  <div class="v-log"><span class="hd2">⚔ 修行のけっか</span><br>命中 <b class="gu">+12</b>・ライフ <b class="gu">+9</b>・丈夫さ <b class="gu">+10</b>・回避 <b class="gu">+8</b>(うち <b class="ga">+9</b> は編成の子のおかげ)<br>体力が <b class="gd">30</b> 下がった/技「<b class="ga">のびのびパンチ</b>」を覚えた! ころころタックルは覚えられなかった</div>
  <div class="v-card" style="border-color:#94a3b8;padding:6px 9px"><div class="row"><span style="font-size:24px">💭</span><div class="f1 sub"><b style="color:#cbd5e1">どれも覚えられなかったとき</b>: 灰色の字で「おしい…」。能力は同じだけ上がる。<span class="yel">次の修行で、えらんだ技の覚える率が上がる</span>(⬆の印)</div></div></div>
</div>${footGo('つぎへ ▶(叱る/褒める)', '⏩ とばす')}`;
grp('Q', '6a. 修行(技を選ぶ → 結果)', '参考動画の3本目の流れ「技を選ぶ → 2段の修行 → 技のくじ → 結果」。修行は1ターンを使い、チケットの数だけ行ける(回数は期ごとに決めない・チケットは大会でもらえて賞金に応じて増える・社長 2026-11-12)。上の帯は出したまま(使う体力も先に見せる)。技の名前・率・段の中身は見た目のための仮。', [
  { id: 'Q1', label: '修行に出る(覚えたい技を選ぶ)', html: shugyo },
  { id: 'Q2', label: '修行の結果', html: shugyoRes },
], `<h3>修行に出る</h3><ul>
  <li>助手が案内役。上に「2段でどの能力が上がるか → さいごに技のくじ」の流れ</li>
  <li>えらんだ技(2つまで)の枠と、下に覚えられる技の一覧(零・近・中・遠の間合いごと・それぞれに覚える率)。もう覚えた技は薄く</li>
  <li>見出しに「🎫 チケット 3枚」、ボタンに使ったあとの数(3 → 2)。チケットが0枚のときは、メインの修行のボタンが薄くなる</li></ul>
  <h3>結果</h3><ul>
  <li>2段ぶんの能力の上がりを札と6能力の列で。<b>編成の補正で増えた分</b>は黄色の印「👥 編成のおかげ +9」と文で(修行にも編成の補正がかかる・社長)。技を覚えたら金色の字(節目なので少し長め・約3秒)</li>
  <li>覚えられなかったときは灰色で短く、「次は覚える率が上がる」を必ず見せる(がっかりで終わらせない)</li>
  <li>このあと叱る/褒める → ターンが進む(訓練と同じ)</li></ul>`);

// ================= 6b. 大会(受付 → 能力の比べ) =================
// 札: [絵文字, 名前, 星, 系統, 賞金, ごほうび, 状態, 出る条件]
const CUPS = [['💪', 'ちから自慢の大会', '★★', '自慢', '312', '人気 +2・ちから +6', 'sel', 'ちから 400 以上 ✔'], ['🌸', '春の大会', '★★★', '四季', '750', '能力ポイント +10・人気 +4', 'rv', 'ライバル: ゆうた の こんこ'], ['🏟', 'ふつうの大会', '★', 'ふつう', '125', 'なし', 'won', '👑 優勝したことがある → ⏩ スキップできる'], ['🧠', 'かしこさ自慢の大会', '★★', '自慢', '312', '人気 +2・かしこさ +6', 'ng', 'かしこさ 400 以上 ✖(いま 233)']];
const cup = ([e, n, st, kind, g, rw, c, cond]) => `<div class="v-cup ${c}"><div class="e">${e}</div><div class="tx"><b>${n}</b><small>${cond}</small><span class="rw">🎁 ${rw}</span></div><div class="rt"><span class="st">${st}</span><span class="g">💰 ${g}</span><span class="kd">${kind}</span></div>${c === 'rv' ? `<span class="rvi"><img src="${F('kiki', 'happy')}"><b>ライバル</b></span><span class="rvb">ごほうび大</span>` : ''}</div>`;
const entry = `${hdr('💰 名声 320', 'もどる')}<div class="v-body">
  ${band()}
  ${scene({ bg: 'monhero_town', cls: 'low', noMon: 1, inner: `<img src="${BODY('mua__happy')}" style="position:absolute;left:-2%;bottom:-98%;height:190%">
    <div class="v-ev-h"><small>3年目 6月・ミドル期</small>🏆 大会の受付</div>
    <div class="v-ibub" style="left:38%;top:auto;bottom:10px">「今月は3つ出られるよ! 出ると<b>1ターン使う</b>から、訓練とどっちにするか考えてね」</div>` })}
  <div class="v-cups">${CUPS.map(cup).join('')}</div>
  <div class="v-card" style="padding:6px 9px"><div class="v-kv" style="margin:0"><b>出ると</b><span>1戦だけ・体力 −20 くらい・勝つと賞金と人気。<span class="yel">期末の強制大会まで あと7ターン</span></span></div></div>
</div><div class="v-ft"><span>← もどる</span><span class="off">⏩ スキップ</span><span class="go">💪 ちから自慢に出る ▶</span></div>`;
// 比べ: [名前, 自分, 相手]
const VS = [['❤️ ライフ', 412, 455], ['💪 ちから', 506, 472], ['🧠 かしこさ', 233, 180], ['🎯 命中', 380, 341], ['💨 回避', 198, 260], ['🛡️ 丈夫さ', 441, 498]];
const vsRow = ([n, a, b]) => `<div class="v-vs1"><b class="${a >= b ? 'w' : ''}">${a}</b><i class="l"><u style="width:${a / 6}%"></u></i><span>${n}</span><i class="r"><u style="width:${b / 6}%"></u></i><b class="${b > a ? 'w' : ''}">${b}</b></div>`;
const versus = `${hdr('💰 名声 320', 'もどる')}<div class="v-body">
  ${band()}
  <div class="v-bcs"><img class="bg" src="${BG('monhero_plaza_evening')}"><div class="sh"></div>
    <div class="ttl">春の大会 ★★★ ・ 1戦</div>
    <img class="ml" src="${M('mocchi.png')}"><img class="mr" src="${M('golem.png')}"><div class="vsw">VS</div>
    <div class="nb l"><b>もちまる</b><small>${rk('C1')} 6,240</small></div><div class="nb r"><b>いわお</b><small>${rk('C1')} 6,410・👑王者</small></div></div>
  <div class="v-tabs t3"><span class="on">ステータス</span><span>技</span><span>能力</span></div>
  <div class="v-card v-bcd" style="flex:1;min-height:0;display:flex;flex-direction:column;justify-content:space-evenly">
    ${VS.map(vsRow).join('')}
    <div class="v-vs1"><b class="w">45</b><i class="l p"><u style="width:45%"></u></i><span>⭐ 人気</span><i class="r p"><u style="width:38%"></u></i><b>38</b></div>
    <div class="v-vs1"><b class="w">72</b><i class="l p"><u style="width:72%"></u></i><span>🤝 忠誠</span><i class="r p"><u style="width:60%"></u></i><b>60</b></div>
    <div class="v-dist"><div>${['零', '近', '中', '遠'].map((d, i) => `<i class="a${[1, 3, 2, 0][i]}">${d}</i>`).join('')}</div><span>間合いの適性</span><div>${['零', '近', '中', '遠'].map((d, i) => `<i class="a${[3, 2, 1, 0][i]}">${d}</i>`).join('')}</div></div>
    <div class="v-szr"><b>ふつう</b><span>サイズ</span><b>大きい</b></div>
  </div>
  <div class="v-hint"><img src="${F('myua', 'excited')}">ちからと命中は勝ってる! <em>近い間合い</em>で押しきろ!</div>
</div><div class="v-ft"><span class="on" style="flex:1.2">結果だけ見る</span><span class="go" style="flex:1.2">準備完了</span></div>`;
// 負けたとき: 砂時計で、1回の育成に3回までやり直せる(社長 2026-11-12。名前と効果は社長の指示で参考のゲームのものをそのまま・絵は新しく描く)
const lose = `${hdr('💰 名声 320', '中断')}<div class="v-body">
  ${band({ hp: 30, st: 52 })}
  ${scene({ bg: 'monhero_plaza_evening', cls: 'dk', monStyle: 'bottom:44%;height:30%;filter:grayscale(.5) drop-shadow(0 8px 5px #0009);transform:translateX(-50%) rotate(-8deg)', grStyle: 'bottom:calc(44% - 5px)', inner: `
    <div class="v-stamp ng" style="top:5%">負けた…<small>💪 ちから自慢の大会 ★★ いわお に 2−3</small></div>
    <div class="v-meal" style="border-color:#7dd3fc;box-shadow:0 0 18px #38bdf866"><div class="t">時をもどして、やり直す?<small>やり直せるのは 1回の育成で3回まで・<b style="color:#fde047">のこり 2 / 3</b></small></div>
      <div class="v-rm3"><div class="re">${hg(0, 30)}<div>時渡りの砂時計で やり直す<small>同じ相手ともう一度(持っている ×2)</small></div></div>
        <div class="nj">${hg(1, 30)}<div>虹の砂時計で 相手を変えて やり直す<small>ちがう相手と戦える(持っている ×1)</small></div></div>
        <div class="gv">あきらめる<small>準優勝のごほうびをもらう(賞金 💰125)</small></div></div>
      <div class="row" style="margin-top:6px"><img class="fc" src="${F('myua', 'troubled')}"><div class="bub f1">「おしかった! 回避で負けてたね…。もう1回いく?」</div></div></div>` })}
</div><div class="v-ft"><span>⏩ とばす</span><span class="on" style="flex:2">えらんでね</span></div>`;
// 大会のあとのごほうびのごはん(社長 2026-11-12: ごはんは大会のあとのご褒美であげる)
const MEAL = [['🍙', 'おにぎり', 'ただ', '体力 +10', ''], ['🍛', 'いつものごはん', '💰 30', '体力 +25・ストレス −5', ''], ['🍖', 'ごちそう', '💰 120', '体力 +40・ストレス −15・忠誠 +3', 'sel']];
const meal = `${hdr('💰 名声 632', '中断')}<div class="v-body">
  ${band({ hp: 41, st: 40 })}
  ${scene({ bg: 'monhero_plaza_evening', back: '<div class="v-burst"></div>', monStyle: 'bottom:40%;height:34%', grStyle: 'bottom:calc(40% - 5px)', inner: `
    <div class="v-stamp" style="top:4%;font-size:46px">優勝!<small>💪 ちから自慢の大会 ★★<br>賞金 💰312・🎫 修行チケット +1・人気 +2・ちから +6</small></div>
    <div class="v-meal"><div class="t">🍽 がんばったごほうびに、ごはんをあげよう<small>大会のあとだけあげられる(1回)</small></div>
      <div class="ms">${MEAL.map(([e, n, g, fx, c]) => `<div class="v-ml ${c}"><div class="e">${e}</div><b>${n}</b><span class="g">${g}</span><small>${fx}</small></div>`).join('')}</div>
      <div class="row" style="margin-top:6px"><img class="fc" src="${F('myua', 'excited')}"><div class="bub f1">「優勝だもん、今日は ごちそう にしちゃお!」</div></div></div>` })}
</div><div class="v-ft"><span>あげない</span><span class="go">🍖 ごちそうをあげる(💰120)</span></div>`;
grp('C', '6b. 大会(受付 → 能力の比べ)', '参考動画の2本目(デビュー期の大会まで)の流れ「受付 → 組み合わせ → 能力の比べ → 試合 → 賞品」のうち、受付と能力の比べ、大会のあとのごほうびのごはん、負けたときの再戦の4枚。上の帯(期・残りターン・総合力・体力)は大会の間もずっと出したまま。試合そのものは助手マスモン対戦の観戦の画面を使う。', [
  { id: 'C1', label: '大会の受付(今月の大会の札)', html: entry },
  { id: 'C2', label: '試合の前(バトルカード・参考に寄せた形)', html: versus },
  { id: 'C3', label: '大会のあと(ごほうびのごはん)', html: meal },
  { id: 'C4', label: '負けたとき(再戦する/あきらめる)', html: lose },
], `<h3>受付</h3><ul>
  <li>助手が受付の役。今月出られる大会を札で並べる: 名前・星・系統・賞金(名声)・ごほうび・出る条件(✔/✖)</li>
  <li><b>ライバルがいる大会</b>は札の左上に<b>ライバルのアイコン(顔の小さな丸+「ライバル」の印)</b>が付き、右上に「ごほうび大」の小さな札(社長 2026-11-12)。条件に届かない大会は薄く、何が足りないかを数字で</li>
  <li>下に「出ると1ターン使う・1戦だけ・体力がどれくらい減るか」。強制大会までの残りも</li></ul>
  <h3>能力の比べ</h3><ul>
  <li>参考に寄せた形(社長 2026-11-12): 上に2体の絵と VS・名前の帯、タブ「ステータス/技/能力」、6能力の棒を左右に(勝っている方の数字を黄色に)、人気・忠誠・間合いの適性・サイズ、下に「結果だけ見る」「準備完了」</li>
  <li>間合いの適性(零・近・中・遠)は色の濃さで。地形は作らないので出さない</li>
  <li>助手が「どこで勝っているか」を一言。下に小さな組み合わせ表</li>
  <li>ボタンは「結果だけ見る」と「準備完了」(観戦する)の2つ</li></ul>
  <h3>スキップと再戦(社長 2026-11-12)</h3><ul>
  <li><b>スキップ(結果だけ)</b>: 一度でも優勝したことのある大会(前の育成も数える)は、札に「⏩ スキップできる」。選ぶと下の「⏩ スキップ」が押せるようになる。中で試合は計算するので、結果の画面は出る</li>
  <li><b>負けたとき</b>(C4): 「⏳ 時渡りの砂時計で やり直す」(同じ相手)・「🌈 虹の砂時計で 相手を変えて やり直す」・「あきらめる」と、のこり ◯/3。1回の育成で3回まで。アイテムの名前と効果は社長の指示で参考のゲームのものをそのまま使い、絵は新しく描く(この見本の砂時計は仮の絵)</li></ul>
  <h3>大会のあとのごはん(社長 2026-11-12)</h3><ul>
  <li>ごはんは<b>大会のあとのごほうび</b>であげる。メインのボタンにもターンのはじめにも置かない</li>
  <li>結果(優勝・賞金・ごほうび)の上に小窓が出て、3つから1つ選ぶ(あげなくてもよい)。値段(名声)と効き目を先に見せる。物と数字は仮</li></ul>`);

// ================= 8. 回3以降の止め絵(2026-11-12 窓口の依頼): 組み合わせ表・勝利と賞品・最終評価と能力ポイント・総合力ランキング・ゲームオーバー・博士の導き書とルーペ =================
// 組み合わせ表(演出。実際に戦うのは あなたの1戦だけ)。人気順の番号・名前・顔
const BR = [[1, 'いわお', 'golem', 'ch'], [5, 'ぷるぷる', 'ham', ''], [4, 'らんぽ', 'tiger', ''], [6, 'すいすい', 'monol', ''], [3, 'もちまる', 'mocchi', 'me'], [2, 'こんこ', 'kyubi', 'rv'], [7, 'ぴくる', 'pixie', ''], [8, 'ミケ', 'suezo', '']];
const brRow = ([no, n, m, k], i) => `<div class="v-br ${k}${i === 4 || i === 5 ? ' mine' : ''}"><b class="no">${no}</b><span class="nm">${n}${k === 'ch' ? '<em class="mk ch">👑王者</em>' : ''}${k === 'rv' ? '<em class="mk rv">ライバル</em>' : ''}${k === 'me' ? '<em class="mk me">あなた</em>' : ''}</span><i class="cn"></i><span class="fc2"><img src="${M(m + '.png')}"></span></div>`;
const brLines = `<svg class="v-brl" viewBox="0 0 64 272" preserveAspectRatio="none"><g fill="none" stroke="#a89a78" stroke-width="2">${[0, 1, 2, 3].map((q) => { const y1 = 17 + 68 * q, y2 = y1 + 34; return `<path d="M0 ${y1}H14V${y2}H0M14 ${(y1 + y2) / 2}H30"/>`; }).join('')}<path d="M30 34V102H46M30 170V238H46M46 68V204M46 136H64"/></g></svg>`;
const bracket = `${hdr('💰 名声 320', 'もどる')}<div class="v-body">
  ${band()}
  <div class="v-bk1"><img class="bg" src="${BG('monhero_plaza_evening')}"><div class="sh"></div><div class="tt">春の大会 ★★★</div></div>
  <div class="v-bkc">
    <div class="rows">${BR.map(brRow).join('')}</div>
    <div class="rt">${brLines}<div class="win"><span>🏆</span><b>優勝</b></div></div>
  </div>
  <div class="v-bnt"><b>あなたの1戦</b>は 赤い丸の2体のあいだ(もちまる VS こんこ)。<span>ほかの試合の結果は、見せるだけの演出</span></div>
  <div style="flex:1"></div><div class="v-ann"><div class="pic"><img src="${F('myua', 'excited')}"><span>解説</span></div><div class="tx">「<b>1番人気は 王者の いわお!</b> でも、もちまるの相手は ライバルの こんこ だよ。勝てば ごほうび大!」</div></div>
</div><div class="v-ft"><span>← やめる</span><span class="on" style="flex:1.6">⏩ 結果だけ見る</span><span class="go">⚔ 1戦へ</span></div>`;
// 試合のあとの勝利と賞品
const PRZ = [['💪', '全能力', '+12(ライバルに勝った・主なごほうび)', 'new', '大'], ['🏅', '称号', '「春の覇者」「ライバルに勝った」', '', 'NEW'], ['🔷', '能力ポイント', '+10(いま 24 → 34)', '', ''], [tk(24), '修行チケット', '+1(3枚 → 4枚)', '', ''], ['💰', '賞金', '+750(×1.5・名声 320 → 1,070)', '', ''], ['⭐', '人気', '+4(45 → 49)', '', '']];
const prize = `${hdr('💰 名声 1,070', '中断')}<div class="v-body">
  ${band({ hp: 41, st: 40, pow: '6,330' })}
  ${scene({ bg: 'monhero_plaza_evening', back: '<div class="v-burst"></div>', monStyle: 'bottom:40%;height:34%', grStyle: 'bottom:calc(40% - 5px)', inner: `
    <div class="v-stamp" style="top:4%;font-size:46px">優勝!<small>🌸 春の大会 ★★★ ・ 1戦: いわお に 3−1</small></div>
    <div class="v-rvw"><img src="${F('kiki', 'happy')}">ライバルの こんこ にも 勝った!<b>ごほうび大</b></div>
    <div class="v-trophy">🏆</div>` })}
  <div class="v-prz">${PRZ.map(([e, n, t, c, nw]) => `<div class="${c}"><span class="e">${e}</span><b>${n}</b><span class="t">${t}</span>${nw ? `<i>${nw}</i>` : ''}</div>`).join('')}</div>
  <div class="v-card pk" style="padding:6px 8px"><div class="row"><img class="fc" src="${F('myua', 'excited')}"><div class="bub f1">「ライバルに勝ったから、全能力 +12! 賞金も ×1.5 だよ。つぎは ごはんだよ!」</div></div></div>
</div><div class="v-ft"><span>おぼえる(称号のきろく)</span><span class="go">🍽 ごはんへ ▶</span></div>`;
grp('B', '8a. 大会の組み合わせ表と、勝ったあとの賞品', '大会の受付のあと、能力の比べの前に「組み合わせ表」(8体の見た目・実際の試合はあなたの1戦だけ)。自分は黄色の帯、ライバルは赤の帯、王者(前の優勝)は王冠の印。勝ったあとは賞品の画面(称号・能力ポイント・修行チケット・賞金・人気・能力)で、そのあと「ごはん」(C3)へ。', [
  { id: 'B1', label: '大会の組み合わせ表(参考に寄せた形・1戦)', html: bracket },
  { id: 'B2', label: '優勝のあと(称号・能力ポイント・修行チケットの賞品)', html: prize },
], `<h3>組み合わせ表(B1)</h3><ul>
  <li>大会で実際に戦うのは<b>あなたの1戦だけ</b>(社長 2026-11-12・TOURNAMENT.md §15)。表は演出で、ほかの試合の結果は見せるだけ</li>
  <li>参考に寄せた形: 左に<b>人気順の番号と名前の帯</b>・右に子の顔・線で結んで<b>優勝の札</b>・下に<b>解説の一言</b>。上は大会の景色。自分(黄)と相手(ライバル=赤)の帯は光らせる</li>
  <li>ライバルは顔の丸でなく帯の「ライバル」の印(C1と同じ色)、王者は「👑王者」。ボタンは「結果だけ見る」と「1戦へ」(観戦)</li></ul>
  <h3>勝利と賞品(B2)</h3><ul>
  <li>称号が新しいときだけ「NEW」。能力ポイントは足したあとの数も見せる(使い道は能力ボタンと引退のとき)。修行チケットは枚数の変化つき</li>
  <li>ライバルに勝ったときは、景色の上に小さな札「ごほうび大」(全能力 +12・賞金 ×1.5・修行チケット +1・称号「ライバルに勝った」の印)。数字は仮</li>
  <li>つぎは「ごはんへ」で、大会のあとのごはん(C3)</li><li>戦ったのは1戦だけなので、結果は「いわお に 3−1」のように1つだけ見せる</li></ul>`);

// ---- 引退: 最終評価(G〜M)・能力ポイントをまとめて使う
const GR = ['G', 'F', 'E', 'D', 'C', 'B', 'A', 'S', 'SS', 'SSS', 'M'];
const GRS = ['0', '2,000', '3,000', '4,500', '6,000', '8,000', '11,000', '14,000', '16,000', '18,000', '19,500'];
const grade = `${hdr('46 / 46ターン', 'とじる', '')}<div class="v-body">
  <div class="v-h">🎓 最終の評価<small>育成のおわりに、総合力で G〜M の11段が決まり、500ごとに数字が付く</small></div>
  <div class="v-rank"><img class="mon2" src="${M('mocchi.png')}"><div class="tx"><small>最終の評価</small><div class="L">A1</div></div><div class="tx"><small>総合力</small><b>11,480</b><small style="color:#cbd5e1;margin-top:3px">S まで あと 2,520</small></div></div>
  <div class="v-gl">${GR.map((g, i) => `<div class="${i === 6 ? 'now' : i < 6 ? 'ok' : ''}"><b>${g}</b><small>${GRS[i]}〜</small>${i === 6 ? '<em>A1</em>' : ''}</div>`).join('')}</div>
  ${stRow(null, -1, FIN)}
  <div class="v-card pk"><div class="row"><img class="fc" src="${F('myua', 'excited')}"><div class="bub f1">「A だよ A! あと ちょっとで S だったね。能力ポイントが残ってるから、使い切ってからおわろ!」</div></div></div>
  <div class="v-card"><div class="v-kv"><b>残りポイント</b><span><b class="yel">34</b>(使うと総合力が上がる)</span></div><div class="v-kv"><b>そのあと</b><span>アシスト能力をポイントで取る → 保存枠へ</span></div></div>
  <div style="flex:1"></div>
  <div class="v-big">🔷 能力ポイントを使う(34)</div>
</div>`;
const pt = `${hdr('46 / 46ターン', 'もどる', '')}<div class="v-body">
  <div class="v-pt"><div class="n">能力ポイント<b>6<small style="font-size:11px;color:#cbd5e1"> / 34</small></b></div><div class="r">使った <span class="yel">28</span>・残り 6<br>総合力 11,480 → <span class="yel">11,712</span> <i class="rk rA">A</i></div></div>
  <div class="v-pq"><span>まとめて</span><i>全部ちから</i><i>弱いところ</i><i class="on">バランス</i><i>もどす</i></div>
  <div class="v-pa">${ST.map((s, i) => { const add = [4, 8, 4, 6, 2, 4][i]; return `<div><span class="nm">${s[1]} ${SHORT[i]}</span><span class="v0">${FIN[i]}</span><span class="ad">${add ? '+' + add * 10 : ''}</span><span class="st"><i>−</i><b>${add}</b><i>＋</i></span><span class="cs">1pt = +10</span></div>`; }).join('')}</div>
  <div class="v-card"><div class="v-kv"><b>伸びすぎ注意</b><span>能力は 999 まで。ちからは あと 231</span></div></div>
  <div style="flex:1"></div>
</div><div class="v-ft"><span>やり直す</span><span class="go">これで決める ▶</span></div>`;
GROUPS.find((g) => g.id === 'E').phones.unshift({ id: 'E0', label: '最終の評価(G〜M)と能力ポイントの案内', html: grade });
GROUPS.find((g) => g.id === 'E').phones.splice(1, 0, { id: 'E3', label: '能力ポイントをまとめて使う', html: pt });
GROUPS.find((g) => g.id === 'E').notes += `<h3>最終の評価と能力ポイント(2026-11-12・E0・E3)</h3><ul>
  <li>E0: 評価は G・F・E・D・C・B・A・S・SS・SSS・M の11段(助手マスモンと同じ表。M は19,500〜)で、500ごとに下から数字が付く(C1 6,000〜・C2 6,500〜…。M は上限なしで M1・M2…)。総合力のしきい値をはしごで見せ、いまの段が光り、段の下にいまの数字(A1)を出す。残りの能力ポイントがあると、下の大きなボタンが「能力ポイントを使う」になる</li>
  <li>E3: 6つの能力に、ポイントを+/−で振る。上に「まとめて」の4つ(全部ちから・弱いところ・バランス・もどす)。総合力と評価が決める前に見える。決めたあとは変えられない。数字は仮</li></ul>`;

// ---- 総合力ランキング
const RK = [['1', 'mocchi', 'M3', '20,640', 'もちまる', 'ゆうた', 20], ['2', 'tiger', 'SSS1', '18,420', 'とらきち', 'あやか', 200], ['3', 'golem', 'SS2', '16,880', 'いわお', 'ゆうた', 140], ['4', 'monol', 'S3', '15,310', 'すいすい', 'みどり', 300], ['5', 'kyubi', 'S1', '14,260', 'こんこ', 'ゆうた', 330], ['6', 'suezo', 'A3', '12,260', 'ミケ', 'たくみ', 60], ['7', 'pixie', 'A2', '11,980', 'ぴくる', 'ひなた', 270], ['8', 'ham', 'A2', '11,500', 'ぷるぷる', 'れん', 100], ['9', 'ghost', 'A1', '11,210', 'ふわり', 'さくら', 240], ['10', 'dreamy', 'B6', '10,940', 'ゆめこ', 'だいき', 310], ['11', 'golem', 'B5', '10,300', 'ごろん', 'ななみ', 180], ['12', 'suezo', 'B4', '9,870', 'めだま', 'けん', 120]];
const VALX = [[880, 912, 640, 801, 560, 777]];
const rkRow = ([n, m, g, p, nm, who, hue], i, open) => `<div class="v-rr${i === 0 ? ' top' : ''}${open === i ? ' open' : ''}"><div class="r1"><b class="no">${n}</b><span class="im"><img src="${M(m + '.png')}" style="filter:hue-rotate(${hue}deg)"></span><div class="nm"><b>${nm}</b><small>育てた人: ${who}</small></div><span class="gd">${rk(g)}</span><span class="pw">${p}</span></div>${open === i ? `<div class="r2">${ST.map((s, k) => `<span><small>${s[1]}${SHORT[k]}</small><b>${[880, 912, 640, 801, 560, 777][k]}</b></span>`).join('')}</div>` : ''}</div>`;
const rankHead = (tab, sub) => `${hdr('', 'もどる', '')}<div class="v-body">
  <div class="v-h">🏆 総合力ランキング<small>育て終えた子の、育てたときの総合力。育てた子ごとに全部載る(同じ人が何体でも)・助手マスモンとは別</small></div>
  <div class="v-tabs"><span class="${tab === 0 ? 'on' : ''}">全モンスター</span><span class="${tab === 1 ? 'on' : ''}">血統別</span></div>${sub}`;
const rankAll = `${rankHead(0, '<div class="v-rsel">全体 <b>1,284体</b>・あなたの順位 <b class="yel">86位</b></div>')}
  <div class="v-rl">${RK.map((r, i) => rkRow(r, i, 2)).join('')}</div>
  <div class="v-rme"><b class="no">86</b><span class="im"><img src="${M('mocchi.png')}" style="filter:hue-rotate(20deg)"></span><div class="nm"><b>もちまる</b><small>育てた人: あなた</small></div><span class="gd">${rk('A')}</span><span class="pw">11,480</span></div>
</div><div class="v-ft"><span>← もどる</span><span class="on" style="flex:1.6">押すと6能力が開く</span></div>`;
const rankLine = `${rankHead(1, '<div class="v-lines">' + ['もっち系', 'ゴーレム系', 'ピクシー系', 'ドラゴン系', 'ゴースト系', '…'].map((n, i) => `<i class="${i === 0 ? 'on' : ''}">${n}</i>`).join('') + '</div><div class="v-rsel">もっち系 <b>203体</b>・あなたの順位 <b class="yel">12位</b></div>')}
  <div class="v-rl">${RK.map((r, i) => rkRow([r[0], 'mocchi', r[2], r[3], r[4], r[5], r[6]], i, -1)).join('')}</div>
  <div class="v-rme"><b class="no">12</b><span class="im"><img src="${M('mocchi.png')}" style="filter:hue-rotate(20deg)"></span><div class="nm"><b>もちまる</b><small>育てた人: あなた</small></div><span class="gd">${rk('A')}</span><span class="pw">11,480</span></div>
</div><div class="v-ft"><span>← もどる</span><span class="on" style="flex:1.6">血統は 種類のまとまり</span></div>`;
grp('R', '8b. 総合力ランキング(血統別・全モンスター)', '育て終えた子の総合力のランキング(育てた子ごとに全部載せる・同じ人が何体でも並ぶ)。上の切り替えで「全モンスター」と「血統別」。行は 順位・染めた姿・子の名前・評価・総合力・育てた人の名前。押すと6能力が開く。いちばん下に自分の順位を固定。助手マスモンのランキングとは別の表。', [
  { id: 'R1', label: '全モンスター(3位の行が開いて6能力)', html: rankAll },
  { id: 'R2', label: '血統別(上で血統をえらぶ)', html: rankLine },
], `<h3>見せ方</h3><ul>
  <li>切り替えは「全モンスター / 血統別」の2つ。血統別のときだけ、血統のえらぶ札の列が出る(横にスクロール)</li>
  <li>1行: 順位(1〜3位は金・銀・銅の色)・染めた姿(染色したまま)・子の名前+育てた人の名前・評価(G〜M+数字 例: C2)・総合力</li>
  <li>行を押すと下に6能力が開く(1行だけ)。自分の子はいつも下に固定</li>
  <li>育てた子ごとに1行(同じ人の子が何体並んでもよい。社長 2026-11-12)。名前・順位・数字は仮。育てた人の名前は表の名前(個人の情報は載せない)</li></ul>`);

// ---- デビュー戦3回負け
const gameover = `${hdr('💰 名声 320', 'とじる')}<div class="v-body">
  ${band({ hp: 22, st: 78, left: 0, all: 41, ph: 'デビュー期', ym: '1年目 3月', now: 0, fill: 90, pow: '1,980', rank: 'G' })}
  ${scene({ bg: 'monhero_plaza_evening', cls: 'dk', monStyle: 'bottom:36%;height:30%;filter:grayscale(.6) drop-shadow(0 8px 5px #0009);transform:translateX(-50%) rotate(-8deg)', grStyle: 'bottom:calc(36% - 5px)', inner: `
    <div class="v-stamp ng" style="top:5%;font-size:40px">育成は ここまで…<small>デビュー戦に 3回 負けた</small></div>
    <div class="v-lives"><i></i><i></i><i></i><span>デビュー戦 0 / 3 のこり</span></div>` })}
  <div class="v-card"><div class="v-kv"><b>やり直し</b><span>砂時計 ${hg(0, 16)} のこり <b>0 / 3</b>(つかいきった)</span></div><div class="v-kv"><b>記録</b><span>6ターン・訓練 4回・デビュー戦 0勝3敗</span></div><div class="v-kv"><b>もちかえり</b><span>名声はそのまま・使ったアイテムは戻らない(仮)</span></div></div>
  <div class="v-card pk"><div class="row"><img class="fc" src="${F('myua', 'troubled')}"><div class="bub f1">「…つぎは もっと訓練してから挑もう。わたしも 手伝うから! もちまるも、がんばったよ」</div></div></div>
  <div style="flex:1"></div>
</div><div class="v-ft"><span>きろくを見る</span><span class="go">もう1回 はじめから ▶</span></div>`;
grp('G', '8c. デビュー戦に3回負けたとき(ゲームオーバー)', 'デビュー期のデビュー戦に3回負けると育成はおわり。砂時計(1回の育成で3回まで)も使い切った状態。叱るでも責めるでもなく、「もう1回はじめから」へすぐ戻れる。', [
  { id: 'G1', label: 'ゲームオーバー(デビュー戦3回負け)', html: gameover },
], `<h3>見せ方</h3><ul>
  <li>暗い景色に沈んだ子と「育成は ここまで…」。デビュー戦の3つの印(のこりの回数)が全部消えた表示</li>
  <li>やり直しの砂時計・この育成の記録・もちかえるもの(仮)を短く。助手は責めず、次へ向けた一言</li>
  <li>ボタンは「もう1回 はじめから」(始めるまでの6段へ)と「きろくを見る」</li></ul>
  <h3>社長に聞きたいこと</h3><ul><li>3回負けたときに「もちかえるもの」の扱い(使ったアイテム・名声・チケットを戻すか戻さないか)。この絵は戻さない案</li></ul>`);

// ---- イッサ博士: 博士の導き書・博士のルーペを使ったとき
const issa3 = `${hdr('💰 名声 320', '中断')}<div class="v-body">
  ${band()}
  ${issaScene(`<img class="v-issa" src="../art/issa-hakase.png">
    <div class="v-itemfx">${icon('guide')}<small>博士の導き書<br>1度だけ 博士が現れる</small></div>
    <div class="v-ev-h" style="top:auto;bottom:8px;border-radius:0 99px 99px 0"><small>導き書の力・1回だけ</small>イッサ博士があらわれた!</div>
    <div class="v-ibub">「おや、ぼくの書類じゃないか! よく拾ってくれたねぇ。お礼に<b>実験</b>、やってく?」</div>`)}
  <div class="v-card" style="border-color:#fde047"><div class="row"><span style="width:34px;height:34px;flex:none">${ICON.guide}</span><div class="f1 sub"><b style="color:#fde047">博士の導き書を使った</b>: 持ち物から使うと、そのターンの合間に 博士が1度だけ 現れる。使うと なくなる(×44 → ×43)</div></div></div>
  <div class="v-card pk"><div class="row"><img class="fc" src="${F('myua', 'excited')}"><div class="bub f1">「博士が来た! いつもは ふいに来るけど、今日は呼べたね!」</div></div></div>
  <div style="flex:1"></div>
</div>${footGo('実験をする ▶', '⏩ とばす')}`;
const IXL = IX.map((x) => [...x]);
const dotsFull = '<span class="pr">成功<i class="on"></i><i class="on"></i><i class="on"></i><i class="on"></i></span>';
const issa4 = `${hdr('💰 名声 320', '中断')}<div class="v-body">
  ${band()}
  ${issaScene(`<img class="v-issa" src="../art/issa-hakase.png">
    <div class="v-machine">⚙️💡<small>のびのび装置</small><img src="${M('mocchi.png')}" style="height:46%;aspect-ratio:1;object-fit:contain"></div>
    <div class="v-itemfx lp">${icon('loupe')}<small>博士のルーペ<br>実験が成功する</small></div>
    <div class="v-ibub">「そのルーペ、ぼくのお気に入り! それなら どれを選んでも <b>ばっちり成功</b>するよ!」</div>`)}
  <div class="v-six">${IX.map(([n, d, ok, ng, c]) => `<div class="v-ix ${c} lp">${n}${dotsFull}<span class="ok">⭕ ${ok}</span><span class="ng">❌ ${ng}</span></div>`).join('')}
    <div class="v-ix no">🙅 何もしない<span class="ok" style="color:#cbd5e1">ことわる。ルーペは なくならない</span></div></div>
  <div class="v-card" style="border-color:#fde047;padding:5px 8px"><div class="row"><span style="width:28px;height:28px;flex:none">${ICON.loupe}</span><div class="f1 sub"><b style="color:#fde047">博士のルーペを使うと</b> この実験は成功の点が全部そろう。選んだあと はじめて なくなる</div></div></div>
</div>${footGo('💪 ステータスアップを受ける', '← 考え直す')}`;
GROUPS.find((g) => g.id === 'I').phones.push({ id: 'I3', label: '博士の導き書を使ったとき(博士が現れる)', html: issa3 }, { id: 'I4', label: '博士のルーペを使ったとき(6つとも成功)', html: issa4 });
GROUPS.find((g) => g.id === 'I').notes += `<h3>博士の導き書・博士のルーペ(2026-11-12・I3・I4)</h3><ul>
  <li><b>導き書(I3)</b>: 持ち物から使うと、そのターンの合間にイッサ博士が1度だけ現れる。名前は「博士の導き書」(参考のまま・社長)。使うと1つなくなる</li>
  <li><b>ルーペ(I4)</b>: 実験の6つの選択の前に使う。成功の点が全部そろい(点が金色)、どれを選んでも成功。選んだあとにルーペがなくなる。「何もしない」ならなくならない</li></ul>`;

// ================= 9. 保存枠・サクセス杯・特別な1話の効き目・アイテムの小窓(2026-11-12 窓口の依頼) =================
// ---- 保存枠(引退した子の一覧・合体への入口)。PLAN §3: はじめ30体・最大60体
// [絵, 名前, 種類, 評価, 総合力, 色相, 代, 称号, 状態]  状態: ret=引退した子 new=合体で生まれた未育成の子
const SV = [['mocchi', 'もちまる', 'モッチー', 'A1', '11,480', 20, '3代目', 'サクセス杯 優勝', 'ret'], ['tiger', 'とらきち', 'タイガー', 'S4', '15,880', 200, '2代目', '春の覇者', 'ret'], ['golem', 'いわお', 'ゴーレム', 'S2', '14,950', 140, '1代目', '', 'ret'], ['kyubi', 'こんこ', 'キュービ', 'A3', '12,260', 330, '1代目', '', 'ret'], ['pixie', 'ぴくる', 'ピクシー', 'A2', '11,980', 270, '2代目', '', 'ret'], ['suezo', 'もるる', 'スエゾー', 'A1', '11,420', 60, '1代目', '', 'ret'], ['ghost', 'ふわり', 'ゴースト', 'B6', '10,870', 240, '2代目', '', 'ret'], ['dreamy', 'ゆめこ', 'ドリーミー', 'B5', '10,310', 310, '1代目', '', 'ret'], ['ham', 'ぷるぷる', 'ハム', '', '—', 100, '3代目', '', 'new']];
const svRow = ([m, n, k, g, p, hue, gen, tt, st], i, o = {}) => `<div class="v-sv ${st}${o.sel === i ? ' sel' : ''}${o.sel2 === i ? ' sel2' : ''}"><span class="im"><img src="${M(m + '.png')}" style="filter:hue-rotate(${hue}deg)"></span><div class="nm"><b>${n}<small>${k}・${gen}</small></b>${tt ? `<em>🏅 ${tt}</em>` : st === 'new' ? '<em class="nw">未育成・合体で生まれた</em>' : ''}</div><div class="rg">${g ? rk(g) : '<i class="rk rn">—</i>'}<span>${p}</span></div>${o.pick ? `<i class="ck">${o.sel === i ? '主' : o.sel2 === i ? '従' : ''}</i>` : ''}</div>`;
const svHead = (n) => `${hdr('', 'もどる', '')}<div class="v-body">
  <div class="v-h">📦 保存枠<small>引退した子と、合体で生まれた子が入る</small></div>
  <div class="v-svc"><div class="n"><b>${n}</b> / 30体</div><i><u style="width:${n / 30 * 100}%"></u></i><span>引退10回ごとに +5(最大60)</span></div>`;
const saveSlot = `${svHead(12)}
  <div class="v-tabs t3"><span class="on">すべて 12</span><span>引退した子 10</span><span>未育成 2</span></div>
  <div class="v-svl">${SV.map((r, i) => svRow(r, i, { sel: 0 })).join('')}</div>
  <div class="v-svd"><div class="t"><img src="${M('mocchi.png')}" style="filter:hue-rotate(20deg)"><div><b>もちまる</b><small>モッチー・3代目・みゅあ編でそだった・晩成</small></div></div>
    <div class="g">${ST.map((s, i) => `<span><small>${s[1]}${SHORT[i]}</small><b>${FIN[i]}</b></span>`).join('')}</div>
    <div class="b"><span>👑 戦績 12戦9勝</span><span>🧬 覚えた技 8</span></div></div>
</div><div class="v-ft"><span>お別れ</span><span class="on">📖 思い出</span><span class="go">🧬 合体する ▶</span></div>`;
const FUS = `${hdr('', 'もどる', '')}<div class="v-body">
  <div class="v-h">🧬 合体<small>保存枠から 主の親 と もう一方の親 を選ぶ</small></div>
  <div class="v-fu"><div class="p sel"><small>主の親</small><img src="${M('mocchi.png')}" style="filter:hue-rotate(20deg)"><b>もちまる</b><em>A 11,480</em></div><div class="x">＋</div><div class="p sel2"><small>もう一方の親</small><img src="${M('kyubi.png')}" style="filter:hue-rotate(330deg)"><b>こんこ</b><em>B 12,260</em></div></div>
  <div class="v-svl" style="flex:none">${SV.slice(0, 5).map((r, i) => svRow(r, i, { sel: 0, sel2: 3, pick: 1 })).join('')}</div>
  <div class="v-card pk" style="padding:6px 9px"><div class="sub" style="color:#f9a8d4;font-weight:900">生まれる子の見通し</div>
    <div class="v-kv"><b>種類</b><span>ヤオビクニ(血統で決まる)・4代目</span></div>
    <div class="v-kv"><b>はじめの6能力</b><span>初期値 + <span class="yel">約 +200</span>(2体の平均が元)</span></div>
    <div class="v-kv"><b>受け継ぐ技</b><span>2つまで(親の技から)・型は主の親のまま</span></div></div>
  <div class="v-card" style="padding:5px 9px;font-size:10.5px;font-weight:800;color:#fca5a5">⚠ 親の2体は保存枠から外れ、「思い出」に名前とランクだけ残る。2回押して決める</div>
</div><div class="v-ft"><span>← えらびなおす</span><span class="go">🧬 合体する(2回確かめる)</span></div>`;
grp('P', '9a. 保存枠(引退した子の一覧・合体への入口)', 'PLAN §3 の保存枠。引退した子と合体で生まれた未育成の子が入る別枠(はじめ30体・引退10回ごとに+5・最大60)。上の使っている数のゲージ、切り替え(すべて/引退した子/未育成)、1行は 染めた姿・名前・種類と代・称号・評価と総合力。押した子の6能力が下に出て、下のボタンは「お別れ」「育てなおす…」「合体する」。', [
  { id: 'P1', label: '保存枠の一覧', html: saveSlot },
  { id: 'P2', label: '合体の入口(2体えらぶ・見通し)', html: FUS },
], `<h3>見せ方</h3><ul>
  <li>未育成の合体の子は、評価が「—」で「未育成・合体で生まれた」の札。押すと「育成をはじめる」が出る(育て終えた子の育て直しは出ない・台帳の決め)</li>
  <li>お別れは2回確かめる。「思い出」に名前とランクだけ残る(PLAN §3)。いっぱいのときは新しく入れられないだけで、自動では消さない</li>
  <li>合体(P2): 主の親(黄)ともう一方の親(青)を一覧から選ぶ → 生まれる子の種類・6能力の見通し・受け継ぐ技を見る → 親は保存枠から外れる(2回押す)。数字・名前は仮</li></ul>`);

// ---- サクセス杯(モンヒロバトルの新しい大会)。PLAN §5
const MODES = [['⚔', 'チャレンジ', ''], ['⚡', 'クイック', ''], ['🏆', 'プロ', ''], ['🔥', '極限', '']];
const modeSel = `${hdr('', 'もどる', '')}<div class="v-body">
  <div class="v-h">⚔ モンヒロバトル<small>あそぶモードをえらぶ</small></div>
  <div class="v-md">${MODES.map(([e, n]) => `<div><span class="e">${e}</span><b>${n}</b><small>(いまのまま)</small></div>`).join('')}</div>
  <div class="v-mdn"><div class="mh"><div class="bd">NEW</div><div class="ic">🌱</div><div class="tx"><b>サクセス杯</b><small>モンヒロサクセスで育てた子が出られる大会</small></div></div>
    <div class="faces">${[['mocchi', 20], ['tiger', 200], ['golem', 140]].map(([m, h]) => `<img src="${M(m + '.png')}" style="filter:hue-rotate(${h}deg)">`).join('')}<span>保存枠の引退した子</span></div>
    <div class="v-kv"><b>出られる子</b><span>引退した子 <b class="yel">10体</b> ✔(1体以上で出られる)</span></div>
    <div class="v-kv"><b>難易度</b><span>いまの9段のまま(倍率も同じ)</span></div>
    <div class="v-kv"><b>ごほうび</b><span>ブリーダーXP・ダイヤ・<span class="yel">サクセスの名声</span>・優勝の称号</span></div>
    <div class="v-kv"><b>ランキング</b><span>サクセス杯だけの別の表(いまの表には入らない)</span></div></div>
  <div class="v-card" style="padding:5px 9px;font-size:10.5px;font-weight:800"><span style="color:#fca5a5">育てた子が1体もいないとき</span>: 「モンヒロサクセスで育てた子が出られる大会です」と案内し、サクセスへ進むボタンを出す</div>
</div><div class="v-ft"><span>← もどる</span><span class="go">🌱 サクセス杯に出る ▶</span></div>`;
const cup1 = (m, n, k, g, hue, st, ok, why) => `<div class="v-cq ${ok ? '' : 'ng'}${st}"><span class="im"><img src="${M(m + '.png')}" style="filter:hue-rotate(${hue}deg)"></span><div class="nm"><b>${n}</b><small>${k}・評価 ${g}</small></div>${ok ? `<div class="g">${st ? '<small>換算後</small>' : ''}<span>ライフ <b>${[1180, 980, 1310][ok - 1] || 1100}</b></span><span>ちから <b>${[212, 188, 240][ok - 1] || 200}</b></span><span>丈夫さ <b>${[205, 170, 233][ok - 1] || 190}</b></span><span>ガッツ <b>${[198, 176, 221][ok - 1] || 180}</b></span></div>` : `<div class="why">${why}</div>`}</div>`;
const cupPick = `${hdr('', 'もどる', '')}<div class="v-body">
  <div class="v-steps5">${['勇者モン', '置く距離', '供モン', '教えカード', 'WAVE'].map((s, i) => `<span class="${i === 0 ? 'on' : ''}">${i + 1} ${s}</span>`).join('')}</div>
  <div class="v-h">勇者モンを選ぶ<small>サクセス杯のあいだだけ、6能力がバトルの4能力に直って出る</small></div>
  <div class="v-cql">${cup1('mocchi', 'もちまる', 'モッチー', 'A', 20, ' sel', 1)}${cup1('tiger', 'とらきち', 'タイガー', 'S', 200, '', 2)}${cup1('golem', 'いわお', 'ゴーレム', 'S', 140, '', 3)}${cup1('ham', 'ぷるぷる', 'ハム', '—', 100, '', 0, '未育成の合体の子は出られない')}${cup1('suezo', 'めだま', 'スエゾー', '—', 120, '', 0, '育成中は出られない')}</div>
  <div class="v-card pk" style="padding:6px 9px"><div class="sub" style="color:#f9a8d4;font-weight:900">換算(6能力 → 4能力)</div><div class="v-kv"><b>もちまる</b><span>ライフ 720 → <span class="yel">1,180</span>・ちから 140 → <span class="yel">212</span> ほか(仮の式)</span></div><div class="v-kv"><b>持たないもの</b><span>強化ポイント・限界突破・魂格・継承技</span></div></div>
</div><div class="v-ft"><span>← もどる</span><span class="go">この子で出る ▶</span></div>`;
const cupSup = `${hdr('', 'もどる', '')}<div class="v-body">
  <div class="v-steps5">${['勇者モン', '置く距離', '供モン', '教えカード', 'WAVE'].map((s, i) => `<span class="${i < 2 ? 'ok' : i === 2 ? 'on' : ''}">${i + 1} ${s}</span>`).join('')}</div>
  <div class="v-h">供モンの候補<small>5体の中から選ぶ・足りないところはベースモンで埋まる(弱い)</small></div>
  <div class="v-cql">${cup1('tiger', 'とらきち', 'タイガー', 'S', 200, ' sel', 2)}${cup1('golem', 'いわお', 'ゴーレム', 'S', 140, ' sel', 3)}${cup1('kyubi', 'こんこ', 'キュービ', 'A', 330, '', 1)}${cup1('pixie', 'ぴくる', 'ピクシー', 'A', 270, '', 2)}<div class="v-cq base"><span class="im"><img src="${M('mocchi.png')}" style="filter:grayscale(.7)"></span><div class="nm"><b>ベースモン</b><small>保存枠の子が足りないときの代わり</small></div><div class="why">弱い</div></div></div>
  <div class="v-card" style="padding:5px 9px;font-size:10.5px;font-weight:800">供モン 2 / 2 体えらんだ ✔ ・ いまのマスモン(助手マスモンのもの)は使わない</div>
</div><div class="v-ft"><span>← もどる</span><span class="go">教えカードへ ▶</span></div>`;
grp('U', '9b. サクセス杯(モンヒロバトルの新しい大会)', 'PLAN §5。モンヒロバトルのモード選択に新しいカード「サクセス杯」。出る子は保存枠の引退した子だけ(未育成・育成中は出られない)。流れはプロと同じ形(勇者モン → 置く距離 → 供モン5体 → 教えカード → WAVE)で、換算後の4能力を見せる。今のランキングには入れない。', [
  { id: 'U1', label: 'モード選択(新しいカード)', html: modeSel },
  { id: 'U2', label: '勇者モンを保存枠から選ぶ', html: cupPick },
  { id: 'U3', label: '供モンの候補を選ぶ', html: cupSup },
], `<h3>見せ方</h3><ul>
  <li>U1: 4つの既存モードは小さく、新しい「サクセス杯」だけ大きく(NEWの札・出られる子の数・ごほうび)。出られる子が0のときは案内とサクセスへの入口</li>
  <li>U2: 保存枠の子を並べ、出られない子は薄く理由を書く。選ぶと換算後のライフ・ちから・丈夫さ・ガッツが見える(式の幅 ×0.8〜×1.6 は仮・バトル部が測る)</li>
  <li>U3: 供モンの候補5体。保存枠の子が足りない枠はベースモン(弱い)で埋まる。助手マスモン(mh_masu_mons)は使わない</li></ul>`);

// ---- 特別な1話の効き目(ききの「集中」)が頂への道の1回戦で光る
const focusCard = `${hdr('💰 名声 1,070', 'もどる')}<div class="v-body">
  ${band({ ph: '最後の期', ym: '5年目 3月', now: 4, fill: 30, left: 3, all: 3, pow: '11,480', rank: 'A1' })}
  <div class="v-bcs" style="height:156px"><img class="bg" src="${BG('monhero_plaza_evening')}"><div class="sh"></div>
    <div class="ttl">頂への道 1回戦</div>
    <div class="v-aura"></div><img class="ml" src="${M('mocchi.png')}"><img class="mr" src="${M('golem.png')}"><div class="vsw">VS</div>
    <div class="nb l"><b>もちまる</b><small>${rk('A1')} 11,480</small></div><div class="nb r"><b>こうがい</b><small>${rk('A1')} 11,200・1回戦 ×1.2</small></div></div>
  <div class="v-fx2"><div class="av"><img src="${F('kiki', 'happy')}"><i>✨</i></div><div class="tx"><small>特別な1話の効き目</small><b>🌙 ききの「集中」</b><span>あたたかいスープの夜から。1回戦のあいだ 命中 +10%・最初の一撃が当たりやすい(数字は仮)</span></div></div>
  <div class="v-tabs t3"><span class="on">ステータス</span><span>技</span><span>能力</span></div>
  <div class="v-card v-bcd" style="flex:1;min-height:0;display:flex;flex-direction:column;justify-content:space-evenly">
    ${VS.slice(0, 4).map(([n, a, b], i) => vsRow(i === 3 ? [n + ' ✨', Math.round(a * 1.1), b] : [n, a, b])).join('')}
    <div class="v-hint" style="margin:0"><img src="${F('kiki', 'happy')}">「…明日も、いちばん近くで見てまつね」(ききの特別な1話)</div>
  </div>
</div><div class="v-ft"><span class="on" style="flex:1.2">結果だけ見る</span><span class="go" style="flex:1.2">準備完了</span></div>`;
const focusGo = `${hdr('💰 名声 1,070', '中断')}<div class="v-body">
  ${band({ ph: '最後の期', ym: '5年目 3月', now: 4, fill: 30, left: 3, all: 3, pow: '11,480', rank: 'A1' })}
  ${scene({ bg: 'monhero_plaza_evening', cls: 'dk', back: '<div class="v-burst"></div>', monStyle: 'left:30%;bottom:30%;height:44%', grStyle: 'left:30%;bottom:calc(30% - 5px)', inner: `
    <div class="v-aura big"></div><img src="${M('golem.png')}" style="position:absolute;right:6%;bottom:30%;height:40%;transform:scaleX(-1)">
    <div class="v-stamp" style="top:6%;font-size:46px">集中!<small>ききの特別な1話の効き目が かがやいた</small></div>
    <div class="v-cut"><img src="${F('kiki', 'happy')}"><div><small>きき</small>「そのまま、まっすぐ…!」</div></div>` })}
  <div class="v-card pk" style="padding:6px 9px"><div class="v-kv"><b>効いているあいだ</b><span>1回戦だけ(準決勝にはもちこさない)</span></div><div class="v-kv"><b>見え方</b><span>ゲージの横に 🌙集中 の札・命中が金色に</span></div></div>
</div><div class="v-ft"><span>⏩ 早送り</span><span class="on" style="flex:1.6">🌙 集中 ON</span><span class="go">試合へ ▶</span></div>`;
grp('Y', '9c. 特別な1話の効き目が光る(頂への道の1回戦)', '助手のお話の「特別な1話」を見たあと、頂への道の1回戦だけ効き目が光る(例: ききの「集中」。EVENTS.md の案)。試合の前のカードで効き目の札と数字が金色に光り、試合のはじめに助手の顔と大きな文字で短く見せる。1回戦だけで、準決勝には引き継がない(案)。', [
  { id: 'Y1', label: '1回戦の前のバトルカード(集中が光る)', html: focusCard },
  { id: 'Y2', label: '試合のはじめの演出(集中!)', html: focusGo },
], `<h3>見せ方</h3><ul>
  <li>Y1: 通常のバトルカード(C2)に、効き目の札(助手の顔の丸+「集中」+中身)と、効く能力の数字に ✨ を付けて金色に。助手のせりふは特別な1話のもの</li>
  <li>Y2: 試合のはじめの1〜2秒。子のまわりが金色にかがやき、「集中!」の大きな文字と助手の顔のカットイン。節目なので長め(台帳の決め)</li>
  <li>ほかの助手の効き目(あつの「気合」など)も同じ見せ方で札と文字を替える。数字は仮</li></ul>`);

// ---- 修行チケット・砂時計を大会でもらったときの小窓(Claude が描いた絵 monster-hero/images/success/items/ を使う)
const modal = (bg, inner) => `${bg}<div class="v-mdbg"></div><div class="v-mdl">${inner}</div>`;
const itm = (f, n, c) => `<div class="v-gi"><img src="${IMG}/success/items/${f}.png"><b>${n}</b><span>${c}</span></div>`;
const gotTicket = modal(prize, `<div class="t">🎁 手に入れた!</div>${itm('training-ticket', '修行チケット', '× 1')}<div class="sub">3枚 → <b class="yel">4枚</b> ・ 修行のボタンで 1回に1枚つかう</div><div class="row"><img class="fc" src="${F('myua', 'excited')}"><div class="bub f1">「チケットだ! 修行で技を覚えにいこ!」</div></div><div class="ok">OK</div>`);
const gotHour = modal(prize, `<div class="t">🎁 手に入れた!</div><div class="two">${itm('hourglass', '時渡りの砂時計', '× 1')}${itm('hourglass-rainbow', '虹の時渡りの砂時計', '× 1')}</div><div class="sub">負けたとき やり直せる(1回の育成で<b class="yel">3回まで</b>)・持っているのは 2 と 1</div><div class="row"><img class="fc" src="${F('myua', 'happy')}"><div class="bub f1">「負けても、時をもどして やり直せるよ!」</div></div><div class="ok">OK</div>`);
grp('W', '9d. 大会で もらったとき の小窓(修行チケット・砂時計)', '大会に勝ったとき、賞品の画面の上に小窓が出る。Claude が描いたアイテムの絵(monster-hero/images/success/items/)を大きく使う。物の名前・数・どこで使うか・助手の一言。ほかの画面の砂時計と修行チケットの小さな絵も、この絵に差し替える。', [
  { id: 'W1', label: '修行チケットをもらったとき', html: gotTicket },
  { id: 'W2', label: '砂時計(と虹)をもらったとき', html: gotHour },
], `<h3>見せ方</h3><ul>
  <li>賞品の画面を暗くして、まん中に小窓。絵は 96px 前後で大きく。「OK」で閉じる</li>
  <li>修行チケットは「3枚 → 4枚」と増えたあとの数を見せる。砂時計は2種類を横に並べ、「1回の育成で3回まで」を添える</li>
  <li>M3(持ち物)・C4(負けたとき)・メインの修行ボタンの印・修行の画面の砂時計とチケットも、同じ絵に差し替えた</li></ul>`);

// ================= 10. 称号の一覧と記録帳・季節×時間のメイン・助手のお話の結末(2026-11-12 窓口の依頼) =================
// ---- 称号の一覧(TOURNAMENT.md §8)。[絵文字, 名前, どこでもらえるか, 取った/まだ]
const TT = [['👣', 'はじめの一歩', 'デビュー戦に優勝', 1], ['💪', 'ちから自慢の頂点', 'ちから自慢の ★★★ に優勝', 1], ['🏹', '遠の間合いの名手', '間合いの ★★★ に優勝', 1], ['🛡️', 'タンクの誇り', 'タイプの ★★★ に優勝', 0], ['👑', 'ヒーロー記念の覇者', '👑の大会に優勝', 0], ['🌸', '四季を知る子', '四季の大会を制覇', 1], ['🔥', 'ライバルに勝った', 'ライバルのいる大会に優勝', 1], ['🌱', '遅咲きの一歩', 'デビュー戦の再挑戦で優勝', 0], ['🏔', '頂に立った子', '頂への道 優勝(ふつう)', 0], ['⭐', 'ヒーローの頂', '頂への道 優勝(大きいほう)', 0], ['🎓', 'みゅあと町を一周', 'みゅあの特別な1話を見た', 1], ['🏆', 'サクセス杯 優勝', 'サクセス杯で優勝', 1]];
const ttCard = ([e, n, how, got]) => `<div class="v-tt ${got ? 'got' : ''}"><span class="e">${got ? e : '🔒'}</span><b>${got ? n : '？？？'}</b><small>${how}</small></div>`;
const titles = `${hdr('', 'もどる', '')}<div class="v-body">
  <div class="v-h">🏅 称号<small>育成で手に入れた称号の一覧(すべての育成のあわせ)</small></div>
  <div class="v-svc"><div class="n"><b>7</b> / 12</div><i><u style="width:58%"></u></i><span>はじめて取った称号には NEW</span></div>
  <div class="v-tabs t3"><span class="on">すべて</span><span>大会</span><span>助手</span></div>
  <div class="v-ttg">${TT.map(ttCard).join('')}</div>
  <div class="v-card pk" style="padding:6px 9px"><div class="row"><img class="fc" src="${F('myua', 'happy')}"><div class="bub f1">「あと5つ! ◯◯の ★★★ 、まだ出てないよ!」</div></div></div>
</div><div class="v-ft"><span>← もどる</span><span class="on" style="flex:1.6">🔍 取りかたを見る</span><span class="go">記録帳へ ▶</span></div>`;
// ---- 記録帳(育て終えた子の記録): [日付, 名前, 種類, 評価, 総合力, 助手, 称号の数]
const RC = [['2026/11/12', 'もちまる', 'mocchi', 20, 'A1', '11,480', 'myua', 5], ['2026/11/10', 'とらきち', 'tiger', 200, 'S4', '15,880', 'atsu', 7], ['2026/11/08', 'いわお', 'golem', 140, 'S2', '14,950', 'kiki', 4], ['2026/11/05', 'こんこ', 'kyubi', 330, 'A3', '12,260', 'momosuke', 3], ['2026/11/02', 'ぴくる', 'pixie', 270, 'A2', '11,980', 'myua', 2], ['2026/10/30', 'めだま', 'suezo', 120, 'B4', '9,870', 'dra', 1]];
const rcRow = ([d, n, m, hue, g, p, a, t], i) => `<div class="v-rc${i === 0 ? ' sel' : ''}"><span class="dt">${d}</span><span class="im"><img src="${M(m + '.png')}" style="filter:hue-rotate(${hue}deg)"></span><div class="nm"><b>${n}</b><small>🏅 ${t}</small></div><img class="as" src="${F(a, 'happy')}">${rk(g)}<span class="pw">${p}</span></div>`;
const recbook = `${hdr('', 'もどる', '')}<div class="v-body">
  <div class="v-h">📖 記録帳<small>育て終えた子の記録(日付・名前・助手・評価・称号)</small></div>
  <div class="v-rch"><span>日付</span><span>子</span><span>助手</span><span>評価・総合力</span></div>
  <div class="v-rcl">${RC.map(rcRow).join('')}</div>
  <div class="v-svc"><div class="n"><b>6</b> 冊</div><i><u style="width:20%"></u></i><span>育てるたびに1冊ふえる(消えない)</span></div>
</div><div class="v-ft"><span>← もどる</span><span class="on" style="flex:1.2">並べかえ: 日付 ▾</span><span class="go">ひらく ▶</span></div>`;
const recpage = `${hdr('', 'もどる', '')}<div class="v-body">
  <div class="v-h">📖 もちまる の記録<small>2026/11/12 に引退・全46ターン・みゅあ編「いっしょに、てっぺんへ!」</small></div>
  <div class="v-rank"><img class="mon2" src="${M('mocchi.png')}" style="filter:hue-rotate(20deg)"><div class="tx"><small>育成ランク</small><div class="L">A1</div></div><div class="tx"><small>総合力</small><b>11,480</b></div></div>
  ${stRow(null, -1, FIN)}
  <div class="v-card"><div class="sub" style="color:#f9a8d4;font-weight:900">🏅 この育成の称号(5)</div><div class="v-ttw">${['はじめの一歩', 'ちから自慢の頂点', '四季を知る子', 'ライバルに勝った', 'みゅあと町を一周'].map((t) => `<span>${t}</span>`).join('')}</div></div>
  <div class="v-card"><div class="v-kv"><b>助手</b><span><img class="inl" src="${F('myua', 'happy')}">みゅあ(仲良し度 Lv5・特別な1話まで)</span></div><div class="v-kv"><b>大会</b><span>12戦9勝・優勝 2回</span></div><div class="v-kv"><b>日付</b><span>2026/10/28 はじめる → 2026/11/12 引退</span></div></div>
  <div style="flex:1"></div>
</div><div class="v-ft"><span>← 記録帳</span><span class="go">保存枠で見る ▶</span></div>`;
grp('N', '10a. 称号の一覧と記録帳', '取った称号を並べた一覧(取れていないのは鍵と取りかた)と、育て終えた子の記録帳(日付・子・助手・評価・総合力・称号の数)。記録帳から1冊ひらくと、その育成の称号・助手・日付が出る。表そのものは別の担当が作っている途中なので、見た目の形だけを決める。', [
  { id: 'N1', label: '称号の一覧(取った/まだ)', html: titles },
  { id: 'N2', label: '記録帳(育て終えた子の記録の表)', html: recbook },
  { id: 'N3', label: '記録の1冊(称号・助手・日付)', html: recpage },
], `<h3>見せ方</h3><ul>
  <li>N1: 12個ずつ2列。取った称号は金枠で絵と名前、まだのは鍵+「？？？」で取りかただけ見せる(ネタバレになる名前は伏せる)</li>
  <li>N2: 1行 = 日付・子の絵と名前・称号の数・助手の顔・評価・総合力。新しい順(並べかえ可)。育てた分は消えない</li>
  <li>N3: 記録の1ページ。評価・総合力・6能力・称号・助手・日付。ここから保存枠の子へも行ける。称号の名前は TOURNAMENT.md §8 のもの(数字・日付は仮)</li></ul>`);

// ---- 季節×時間のメイン。絵は別の担当が monster-hero/images/success/scenes/ に描いている途中なので、いまは今ある景色に色をかけた仮
const SEAS = [['🌸', '春', 'spring', 'hue-rotate(-25deg) saturate(1.1)'], ['☀️', '夏', 'summer', 'saturate(1.3) brightness(1.05)'], ['🍁', '秋', 'autumn', 'sepia(.5) hue-rotate(-20deg) saturate(1.3)'], ['❄️', '冬', 'winter', 'saturate(.5) brightness(1.1) hue-rotate(160deg)']];
const TIMES = [['朝', 'forest_morning', 'brightness(1.1)'], ['昼', 'monhero_plaza', ''], ['夕', 'monhero_plaza_evening', ''], ['夜', 'monhero_night', '']];
const mainSeason = (si, ti) => { const [e, sn, , sf] = SEAS[si]; const [tn, tb, tf] = TIMES[ti]; return `${hdr()}<div class="v-body">
  ${band()}
  ${mainSay(false)}
  <div class="v-scene home"><img class="bg" src="${BG(tb)}" style="filter:${sf} ${tf}"><div class="sh"></div>${party}
    <div class="v-chips"><span class="v-chip">${e} ${sn}・${tn}</span><span class="v-chip hot">🏆 期末の大会まで 7ターン</span></div>
    <div class="gr"></div><img class="mon" src="${M('mocchi.png')}"><span class="v-nm">もちまる<small>方針: 普通</small></span>
    <div class="v-side"><span class="v-mini">🤝 忠誠 <b>72</b></span><span class="v-mini">⭐ 人気 <b>45</b></span></div>
    <div class="v-bagb">🎒<small>持ち物</small><i>2</i></div><div class="v-bagb r">🔍<small>くわしく</small></div></div>
  ${stRow()}
  ${acts(false)}
</div>${foot}`; };
const sceneTable = `${hdr('', 'もどる', '')}<div class="v-body">
  <div class="v-h">🌸 季節と時間の景色<small>4つの季節 × 4つの時間(朝・昼・夕・夜)= 16まい。メインの住む場所の背景が、ターンと月で替わる</small></div>
  <div class="v-sct"><span></span>${TIMES.map(([t]) => `<b>${t}</b>`).join('')}${SEAS.map(([e, s, , sf], si) => `<b>${e}${s}</b>${TIMES.map(([, tb, tf]) => `<i><img src="${BG(tb)}" style="filter:${sf} ${tf}"></i>`).join('')}`).join('')}</div>
  <div class="v-card" style="padding:6px 9px;font-size:10.5px;font-weight:800;line-height:1.5">いまの見本は、今ある景色に色をかけた<b class="yel">仮</b>。できあがった絵は <code>monster-hero/images/success/scenes/</code> に入る予定で、入ったら差しかえる。季節は月で(春 3〜5・夏 6〜8・秋 9〜11・冬 12〜2)、時間はターンで替わる(案)</div>
  <div style="flex:1"></div>
</div>${footGo('もどる')}`;
GROUPS.find((g) => g.id === 'M').phones.push({ id: 'M4', label: '季節×時間(夏・夕)', html: mainSeason(1, 2) }, { id: 'M5', label: '季節×時間(秋・夜)', html: mainSeason(2, 3) }, { id: 'M6', label: '季節×時間(冬・朝)', html: mainSeason(3, 0) }, { id: 'M7', label: '16まいの景色の一覧', html: sceneTable });
GROUPS.find((g) => g.id === 'M').notes += `<h3>季節×時間の景色(2026-11-12・M4〜M7)</h3><ul>
  <li>メインの住む場所の景色は、月(春夏秋冬)とターン(朝昼夕夜)で替わる。景色の左上の札に「🍁 秋・夜」と出る(いまの見本の札はこの形)</li>
  <li>絵は別の担当が <code>monster-hero/images/success/scenes/</code> に描いている途中。いまは今ある景色に色をかけた<b>仮</b>。できたら差しかえる</li></ul>`;

// ---- 助手のお話: 4話の結末(いい結末/ほろ苦い)と特別な1話の場面(みゅあの台本 script/scenario.js)
const endScene = (kind) => `${hdr('💰 名声 1,070', '中断')}<div class="v-body">
  ${band({ ph: 'プロ期', ym: '4年目 5月', pow: '9,320', rank: 'B3', left: 4, all: 12, now: 3, fill: 60 })}
  ${scene({ bg: 'monhero_plaza_evening', back: kind === 'good' ? '<div class="v-burst"></div>' : '', monStyle: 'left:30%;bottom:26%;height:44%', grStyle: 'left:30%;bottom:calc(26% - 5px)', inner: `
    <img src="${BODY(kind === 'good' ? 'mua__excited' : 'mua__troubled')}" style="position:absolute;right:-10%;bottom:-24%;height:92%">
    <div class="v-ev-h"><small>みゅあの話 4話「みんなの声」${kind === 'good' ? '・いい結末' : '・ほろ苦い結末'}</small>${kind === 'good' ? 'みゅあの声が、届いた' : '声は、歓声にのまれた'}</div>
    <div class="v-ibub" style="left:6px;right:52%;top:auto;bottom:8px">${kind === 'good' ? '「届いた…まぢで届いたよ😭 最高のチームぢゃん!」' : '「…届かなかったかも。でも、ちゃんと戦ってた」'}</div>` })}
  <div class="v-card ${kind === 'good' ? 'pk' : ''}"><div class="sub" style="color:${kind === 'good' ? '#fde047' : '#cbd5e1'};font-weight:900">${kind === 'good' ? '✨ いい結末のごほうび(特大)' : '☁ ほろ苦い結末のごほうび'}</div>
    ${kind === 'good' ? `<div class="v-kv"><b>全能力</b><span class="yel">+40(特大)</span></div><div class="v-kv"><b>技</b><span>「みんなの声」系の ひらめき</span></div><div class="v-kv"><b>つぎは</b><span>最後の期に <b class="yel">特別な1話</b> が開く</span></div>` : `<div class="v-kv"><b>人気</b><span>+12(大)</span></div><div class="v-kv"><b>称号</b><span>「声なき声のファン」</span></div><div class="v-kv"><b>つぎは</b><span>特別な1話は開かない(ふだんの出来事に)</span></div>`}
    <div class="v-kv"><b>3話の選びかた</b><span>${kind === 'good' ? '「いっしょに深呼吸」を選んだ' : '「お守りだけもらう」を選んだ'}</span></div></div>
  ${stRow(kind === 'good' ? [40, 40, 40, 40, 40, 40] : [0, 0, 0, 0, 0, 0], -1, VAL.map((v) => v + (kind === 'good' ? 40 : 0)))}
</div>${footGo('つぎへ ▶', '⏩ とばす')}`;
const specialScene = `${hdr('💰 名声 1,070', '中断')}<div class="v-body">
  ${band({ ph: '最後の期', ym: '5年目 2月', pow: '11,100', rank: 'A1', left: 4, all: 4, now: 4, fill: 20 })}
  ${scene({ bg: 'monhero_plaza_evening', cls: 'dk', monStyle: 'left:26%;bottom:30%;height:38%', grStyle: 'left:26%;bottom:calc(30% - 5px)', inner: `
    <img src="${BODY('mua__happy')}" style="position:absolute;right:-6%;bottom:-18%;height:88%">
    <div class="v-ev-h"><small>特別な1話・仲良し度 Lv5</small>ここまで来たぢゃん</div>
    <div class="v-ibub" style="left:6px;right:48%;top:auto;bottom:8px">「あの日は ちっちゃかったのに…ここまで来たぢゃん😭」</div>` })}
  <div class="v-card"><div class="v-spn">${['おやつ屋さん', '広場', 'ひなたの丘'].map((n, i) => `<span class="${i < 2 ? 'ok' : 'now'}">📍 ${n}</span>`).join('<i>›</i>')}</div>
    <div class="sub" style="margin-top:4px">最後の期の夕方。みゅあに誘われて、ふたりで町を一周する。どこにも、ここまでの思い出がある。</div></div>
  <div class="v-card pk"><div class="row"><img class="fc" src="${F('myua', 'happy')}"><div class="bub f1">「もちまる、ありがと。あたし、このチームで ほんとによかった♪」</div></div></div>
  <div class="v-card" style="padding:5px 9px;font-size:10.5px;font-weight:800">この話を見ると、<b class="yel">引退の振り返りの最後の一言</b>が変わる。節目なので少し長め(5〜6秒・画面を暗く)</div>
  <div style="flex:1"></div>
</div>${footGo('つぎへ ▶', '⏩ とばす')}`;
grp('A', '10b. 助手のお話の結末と特別な1話', 'みゅあの話の4話「みんなの声」の結末2通り(いい結末/ほろ苦い結末)と、最後の期の特別な1話「ここまで来たぢゃん」の場面。台詞は台本(script/scenario.js)のもの。3話の2択の選びかたで4話が分かれ、いい結末だけが特別な1話へつながる。', [
  { id: 'A1', label: '4話の結末(いい結末)', html: endScene('good') },
  { id: 'A2', label: '4話の結末(ほろ苦い結末)', html: endScene('bitter') },
  { id: 'A3', label: '特別な1話の場面(町を一周)', html: specialScene },
], `<h3>見せ方</h3><ul>
  <li>どちらの結末も、大会の景色と助手の立ち絵+せりふ+ごほうびの札。いい結末は金色の放射と「特大」のごほうび、ほろ苦い結末は少し暗い色合いで、それでもごほうびがある(「見てた人がファンになった」)</li>
  <li>特別な1話(A3): 夕方の町を3か所まわる(進み具合の「📍」)。画面を暗くして長めに。見たあと、引退の振り返りの最後の一言が変わる</li>
  <li>ごほうびの数字・称号の名前は仮(EVENTS.md は「全能力 特大」「称号」としか決めていない)</li></ul>`);

// ================= 11. 入口(HOME から)と、はじめて遊ぶ人への案内(2026-11-12 窓口の依頼・RELEASE-DRAFT.md §4 に合わせる) =================
// HOME・更新情報・助手の告知は「入口のつなぎ方」を決めるための概略(本物の HOME の見た目は写していない。配置は home-layout-check で別に確かめる)
const homeTile = (e, n, c = '', note = '') => `<div class="v-ht ${c}"><span class="e">${e}</span><b>${n}</b>${note ? `<small>${note}</small>` : ''}</div>`;
const homeBase = `${hdr('', '', '')}<div class="v-body">
  <div class="v-h">🏠 HOME<small>(この画面は、入口のつなぎ方を決めるための概略)</small></div>
  ${scene({ bg: 'monhero_town', cls: 'low', noMon: 1, inner: `<img src="${BODY('mua__happy')}" style="position:absolute;left:-2%;bottom:-98%;height:190%"><div class="v-ibub" style="left:38%;top:12px">「今日は なにして あそぶ?」</div>` })}
  <div class="v-hg2">${homeTile('🎵', 'モンヒロビート', '', 'いまのまま')}${homeTile('⚔', 'モンヒロバトル', '', 'いまのまま')}${homeTile('🌱', 'モンヒロサクセス', 'new', '育てて、頂をめざす')}${homeTile('👥', 'フレンド', '', 'いまのまま')}${homeTile('📖', 'ヘルプ', '', 'いまのまま')}${homeTile('📜', '更新履歴', '', '')}</div>
</div>`;
const homeNew = homeBase.replace('<div class="v-hg2">', '<div class="v-hg2">').replace(/(<div class="v-ht new">)/, '$1<i class="nw">NEW</i>');
const updInfo = `${hdr('', 'もどる', '')}<div class="v-body">
  <div class="v-h">📜 更新履歴<small>新しい順</small></div>
  <div class="v-upd new"><div class="hd"><span class="bd">NEW</span><b>新コンテンツ「モンヒロサクセス」</b></div><div class="dt">2026/11/12 12:00・🌱 モンヒロサクセス</div>
    <ul><li>育てる子と仲間を選んで、46ターンの育成に出発</li><li>訓練・大会・イッサ博士など、ターンごとにいろいろ起こる</li><li>育て終えた子は保存枠へ。合体やサクセス杯も</li></ul>
    <div class="go">🌱 モンヒロサクセスで あそぶ ▶</div></div>
  <div class="v-upd"><div class="hd"><b>(ほかの更新)</b></div><div class="dt">2026/11/10 ・ いまのまま</div></div>
  <div class="v-upd"><div class="hd"><b>(ほかの更新)</b></div><div class="dt">2026/11/08 ・ いまのまま</div></div>
  <div style="flex:1"></div>
  <div class="v-card" style="padding:5px 9px;font-size:10.5px;font-weight:800">更新履歴の項目に「あそぶ ▶」のボタンを付け、押すとモンヒロサクセスの入口へ飛ぶ(公開の印で出し入れする)</div>
</div>${footGo('もどる')}`;
const noticeModal = homeNew + `<div class="v-mdbg"></div><div class="v-mdl"><div class="t">🌱 新しい遊びだよ!</div>
  <div class="row" style="margin-top:8px"><img class="fc" src="${F('myua', 'excited')}"><div class="bub f1" style="text-align:left">「モンサクが ついに あそべるよ♪ 育てる子を選んで、仲間と いっしょに、頂まで いってみよ!」</div></div>
  <div class="sub" style="margin-top:6px">モンヒロサクセス(育成のあそび)・いま あそべる</div>
  <div class="ok">🌱 モンヒロサクセスへ ▶</div><div class="later">あとで</div></div>`;
const entry0 = `${hdr('', 'HOME', '')}<div class="v-body">
  ${scene({ bg: 'monhero_town', cls: 'low', noMon: 1, inner: `<img src="${BODY('mua__happy')}" style="position:absolute;left:-2%;bottom:-98%;height:190%"><img class="mon" src="${M('mocchi.png')}" style="position:absolute;left:62%;bottom:6%;height:60%;transform:none"><div class="v-logo">🌱 モンヒロサクセス<small>育てて、戦って、頂をめざそう</small></div>` })}
  <div class="v-sayrow"><img class="fc" src="${F('myua', 'happy')}"><div class="bub">モンサクへようこそ♪ 育てる子を選んで、仲間を編成して、46ターンの育成に出発だよ! わからなくなったら ヘルプの『モンヒロサクセス』を見てね!</div></div>
  <div class="v-big" style="margin-top:8px">🌱 はじめから育てる</div>
  <div class="v-ent"><div class="off">▶ つづきから<small>育成中の子はいません</small></div><div>📦 保存枠<small>12 / 30</small></div><div>🏅 称号・記録帳<small>7 / 12</small></div><div>🏆 ランキング<small>総合力・サクセス杯</small></div><div>⚔ サクセス杯<small>モンヒロバトルへ</small></div><div>❓ ヘルプ<small>はじめての人へ</small></div></div>
</div>${footGo('HOMEへ', '← HOME', 'go ghost')}`;
// はじめて遊ぶ人への案内(初回だけ・助手が話す・全部で4枚・とばせる)。ふだんの画面を暗くして、見てほしい所を光らせる
const tour = (n, base, spot, text, mood, who = 'myua') => base + `${spot}<div class="v-tour"><div class="pg">${[1, 2, 3, 4].map((i) => `<i class="${i === n ? 'on' : i < n ? 'ok' : ''}"></i>`).join('')}<span>はじめての あんない ${n} / 4</span></div><div class="row"><img class="fc" src="${F(who, mood)}"><div class="bub f1">${text}</div></div><div class="bt"><span>とばす</span><span class="go">${n === 4 ? 'わかった!' : 'つぎへ ▶'}</span></div></div>`;
const tour1 = tour(1, entry0, '<div class="v-ring" style="left:10px;right:10px;top:326px;height:52px"></div>', '「モンサクへようこそ♪ ここで<em>子を育てて</em>、46ターンの育成に出発するよ。まずは <em>はじめから育てる</em> を押してね!」', 'excited');
const tour2 = tour(2, s2, '<div class="v-ring" style="left:10px;right:10px;top:170px;height:260px"></div>', '「育てる子と一緒に出る<em>仲間</em>を6体えらぶよ。仲良しの仲間が いるほど、訓練が うまくいくんだ!」', 'happy');
const tour3 = tour(3, trainHeavy(), '<div class="v-ring" style="left:6px;right:6px;top:520px;height:120px"></div>', '「訓練の札に仲間の顔が並んでるでしょ? 仲良しの仲間が来ている札は<em>金色に光って</em>、友情タッグになるよ!」', 'excited');
const tour4 = tour(4, saveSlot, '<div class="v-ring" style="left:10px;right:10px;top:150px;height:200px"></div>', '「育て終えた子は<em>保存枠</em>に入るよ。次の育成で仲間になったり、合体したり、サクセス杯に出たりできるんだ!」', 'happy');
GROUPS.find((g) => g.id === 'M').phones.length; // 景色の差しかえは、絵(scenes/)が入ってから
grp('H', '11a. HOME からモンヒロサクセスへ入る入口', 'HOME のボタン(NEW の札)・更新履歴の項目の「あそぶ」・助手の告知の小窓の「モンヒロサクセスへ」の3つが、同じ入口の画面(モンサクのトップ)へ飛ぶ。入口には はじめから/つづきから・保存枠・称号と記録帳・ランキング・サクセス杯・ヘルプ。HOME・更新履歴は概略で、本物の見た目は写していない。', [
  { id: 'H1', label: 'HOME に新しいボタン', html: homeNew },
  { id: 'H2', label: '更新履歴の項目(あそぶ ▶)', html: updInfo },
  { id: 'H3', label: '助手の告知の小窓(モンヒロサクセスへ)', html: noticeModal },
  { id: 'H4', label: '入口の画面(モンサクのトップ)', html: entry0 },
], `<h3>つなぎ方</h3><ul>
  <li>入口は3本: ① HOME のボタン(公開の印が付くまで出ない・NEW の札) ② 更新履歴の「新コンテンツ」の項目の「あそぶ ▶」 ③ 助手の告知(update_notice_monsaku_v1)の小窓のボタン。どれも H4 の入口へ飛ぶ</li>
  <li>H4: はじめて開いたときだけ、助手が ようこそ を言う(既読は新しいキー。RELEASE-DRAFT.md §4)。育成中の子がいるときは「つづきから」が光る</li>
  <li>呼び名は正式名称「モンヒロサクセス」。「モンサク」は助手の台詞だけ(CLAUDE.md ⑤)</li></ul>`);
grp('D', '11b. はじめて遊ぶ人への案内(初回だけ・4枚)', '初めてモンヒロサクセスを開いた人にだけ出る、助手が話す4枚の案内。ふだんの画面を暗くして、見てほしい所を光らせる。「とばす」でいつでも閉じられ、一度見たら出ない。台詞は RELEASE-DRAFT.md の「画面のなかでの案内」に合わせた。', [
  { id: 'D1', label: '案内 1/4(入口: ようこそ)', html: tour1 },
  { id: 'D2', label: '案内 2/4(仲間をえらぶ)', html: tour2 },
  { id: 'D3', label: '案内 3/4(最初のターン: 友情タッグ)', html: tour3 },
  { id: 'D4', label: '案内 4/4(保存枠とその先)', html: tour4 },
], `<h3>見せ方</h3><ul>
  <li>下に助手の吹き出し(顔・せりふ)と、何枚目かの印(●)、「とばす」「つぎへ」。上の画面は暗くして、光る枠で見てほしい所を示す</li>
  <li>1枚目は入口(ようこそ・はじめから育てる)、2枚目は仲間の編成、3枚目は最初のターンの訓練(友情タッグの金色の札・RELEASE-DRAFT.md の台詞)、4枚目は保存枠とその先(合体・サクセス杯)</li>
  <li>一度きり: 既読は新しいキー <code>mh_monsuc_guide_seen_v1</code>(案・既存のキーは触らない)。あとからヘルプでも読める。枚数・台詞は仮</li></ul>`);

// ================= 7. 横と小さい画面 =================
grp('L', '7. 横(844×390)と、小さい画面(幅320)', '同じ部品のまま、横は「左に住む場所・右に帯と能力と行動のボタン」、幅320は字とすき間を詰める。はみ出し・字の切れがないことを撮るときに確かめている。', [
  { id: 'L1', label: '横 メイン', html: mainHtml(false), cls: 'land' },
  { id: 'L2', label: '横 訓練を選ぶ', html: trainHeavy(), cls: 'land' },
  { id: 'N1', label: '幅320 メイン(ようすあり)', html: mainHtml(true), cls: 's320' },
  { id: 'N2', label: '幅320 訓練を選ぶ', html: trainHeavy(), cls: 's320' },
  { id: 'N3', label: '幅320 アシスト能力', html: assist(), cls: 's320' },
], `<h3>崩さないための決まり</h3><ul>
  <li>住む場所だけが伸び縮みする(ほかは高さが決まっている)。画面が低いと景色が狭くなるだけで、ボタンは押しやすい大きさのまま</li>
  <li>横は左4割が住む場所。右に帯・6能力・行動のボタンを縦に積む</li>
  <li>幅320: 行動のボタンは 1列3つ/4つのまま、字を1段小さく。通院が出ても4つで入る</li></ul>`);

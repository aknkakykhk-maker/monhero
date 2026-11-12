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
  return `<span class="v-pf r${o.r}${o.base ? ' base' : ''}${o.fr ? ' fr' : ''}${AF[k] >= 80 ? ' tag' : ''} ${cls}"><img src="${T(o.t)}"><i class="af"><b style="width:${AF[k]}%"></b></i></span>`;
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
  ${say(yousu ? '最近サボりがちだね…。一度 <em>🏥 通院</em> で診てもらおっか!' : '今月は <em>ちから</em> に3体! らいがと しずくは <em>友情タッグ</em>だよ!', yousu ? 'troubled' : 'happy')}`,
});
const trainBtn = `<div class="v-p main">💪 訓練<div class="v-gather"><span>💪に</span>${pf('d')}${pf('a')}${pf('c')}<b style="color:#fde047">🤝タッグ×2</b></div><small>ほか ❤️1 🧠1 🎯助手 🛡️1(🤝)</small></div>`;
const acts = (yousu) => `<div class="v-act" style="grid-template-columns:1fr 2.3fr 1fr">
    ${pnl('🛌', '休む', '体力を回復')}${trainBtn}${pnl('🎈', '遊ぶ', '体力+・甘え+')}
  </div>
  <div class="v-act" style="grid-template-columns:repeat(${yousu ? 4 : 3},1fr)">
    ${pnl('⚔', '修行', 'この期 あと1回')}
    ${pnl('🏆', '大会', '今月は3つ', '', '<span class="bd">★★ 出られる</span>')}
    ${pnl('📊', '能力', '技・型・編成')}
    ${yousu ? pnl('🏥', '通院', 'ようすを治す', 'hosp', '<span class="bd r">!</span>') : ''}
  </div>`;
const mainHtml = (yousu, cls = '') => `${hdr()}<div class="v-body">
  ${band(yousu ? { hp: 48 } : {})}
  ${mainScene(yousu)}
  ${stRow()}
  ${acts(yousu)}
</div>${foot}`;

grp('M', '1. 育成のメイン(案A の描き直し)', '住む場所が大きく、下に行動のボタン。上の帯で「この期の残りターン(最後までの残りは小さく)・総合力とランク・体力のゲージ(数字つき・上限が上がる)・ストレスのゲージ」がひと目。モンスターの絵は前の見本よりずっと小さくし(社長「もっと小さくしてもいい」)、景色と編成の6体が見える広さを残した。', [
  { id: 'M1', label: 'メイン(ふだん)', html: mainHtml(false) },
  { id: 'M2', label: 'メイン(ようすがあるとき = 🏥通院が出る)', html: mainHtml(true) },
], `<h3>どこに何を置いたか</h3><ul>
  <li><b>上の帯</b>: 「ミドル期 残り7ターン」を大きく、その下に「最後まで あと24」。総合力とランク。体力は数字つきのゲージ(62/110▲ = 上限が上がっている。点線が元の100)。ストレスも0〜100のゲージ。いちばん下の細い線は5つの期(デビュー・ジュニア・ミドル・プロ・最後)のどこにいるか</li>
  <li><b>住む場所</b>: 絵は高さの34%ほど(前の見本は約70%・第3版のはじめは44%)。季節と時間で景色が替わる。左に<b>編成</b>の6体(顔の下が親密度のゲージ・タッグに届いた子は光る枠と🤝)。助手は左下で一言</li>
  <li><b>行動のボタン</b>: 休む・訓練(大きく・今月どこに集まっているかを顔で先に見せる)・遊ぶ/修行・大会・能力。<b>🏥通院は「ようす」があるときだけ</b> 4つ目に出る(ほかのボタンの場所は動かない)</li>
  <li>いちばん下: 中断・早送り・演出を短く・きろく・メニュー</li></ul>
  <h3>動き(ふだんは短く)</h3><ul>
  <li>立ち絵はゆっくり息をする。体力が3割を切るとゲージが赤くなり、立ち絵が少しうつむく</li>
  <li>タッグの子の枠は、ゆっくり明るくなったり暗くなったりする(1.6秒で1往復)</li></ul>`);

// ================= 2. 訓練を選ぶ =================
// その月の集まり: [絵文字, 名前, 訓練Lv, 来ている子, 主の上がり幅]
const TR = [['❤️', 'ライフ', 2, ['e'], 11], ['💪', 'ちから', 3, ['d', 'a', 'c'], 38], ['🧠', 'かしこさ', 1, ['f'], 15], ['🎯', '命中', 2, ['as'], 13], ['💨', '回避', 1, [], 9], ['🛡️', '丈夫さ', 2, ['b'], 19]];
const tagN = (ks) => ks.filter((k) => AF[k] >= 80).length;
const trs = (sel, gains) => `<div class="v-trs">${TR.map((t, i) => { const n = tagN(t[3]); return `<div class="v-tr${n ? ' tag' : ''}${i === sel ? ' sel' : ''}">
  ${n ? `<span class="tgb">🤝タッグ${n > 1 ? '×' + n : ''}</span>` : ''}
  <div class="fs">${t[3].length ? t[3].map((k) => pf(k)).join('') : '<span class="no">だれも<br>いない</span>'}</div>
  <div class="o"><i class="lv">Lv${t[2]}</i>${t[0]}<small>${i === sel ? '決定' : t[1]}</small></div><div class="x">+${gains ? gains[i] : t[4]}</div></div>`; }).join('')}</div>`;
const cm = (k, name, eff, tagTxt) => `<div class="v-cm${AF[k] >= 80 ? ' tag' : ''}">${pf(k).replace(/<i class="af">.*?<\/i>/, '')}<div class="tx"><b>${name}</b><small>${AF[k] >= 80 ? '🤝 ' + tagTxt : eff}</small><div class="afl">親密度<i><b style="width:${AF[k]}%"></b></i>${AF[k]}</div></div></div>`;
const trainHeavy = (cls = '') => `${hdr('💰 名声 320', 'もどる')}<div class="v-body">
  ${band({ use: 26, stAdd: 8 })}
  ${scene({ monStyle: 'left:30%;bottom:34%;height:40%', grStyle: 'left:30%;bottom:calc(34% - 5px)', inner: `
    <div class="v-chips" style="right:auto;left:7px"><span class="v-chip ylw">💪 ちからの訓練 Lv3</span></div>
    <div class="v-come">${cm('d', 'らいが', '', 'タッグ +24%')}${cm('a', 'しずく', '', 'タッグ +27%')}${cm('c', 'ぴくりん', '編成の効き +14%', '')}</div>
    <div class="v-fx"><div class="t"><span class="big">🤝 友情タッグ ×2</span><span>効果 +51%</span><span class="fl">失敗 <b>6%</b></span></div>
      <div class="ch"><span>基本 +18</span><i>▶</i><span>編成 +41%</span><i>▶</i><span class="tgx">🤝×2 +51%</span><i>▶</i><span class="res">ちから +38</span></div></div>` })}
  ${stRow([0, 38, -4, 7, 0, 5], 1)}
  <div class="v-tabs"><span>💪 軽い訓練</span><span class="on hv">🔥 重い訓練</span></div>
  ${trs(1)}
</div>${footGo('🔥 ちからの重い訓練をする')}`;
const trainLight = `${hdr('💰 名声 320', 'もどる')}<div class="v-body">
  ${band({ use: 12, stAdd: 3 })}
  ${scene({ monStyle: 'left:30%;bottom:34%;height:40%', grStyle: 'left:30%;bottom:calc(34% - 5px)', inner: `
    <div class="v-chips" style="right:auto;left:7px"><span class="v-chip ylw">🧠 かしこさの訓練 Lv1</span></div>
    <div class="v-come">${cm('f', 'こんこ(借)', '編成の効き +33%', '')}</div>
    <div class="v-fx plain"><div class="t"><span>タッグなし</span><span style="color:#cbd5e1;font-size:10px">こんこ あと8でタッグ</span><span class="fl">失敗 <b>2%</b></span></div>
      <div class="ch"><span>基本 +8</span><i>▶</i><span>編成 +33%</span><i>▶</i><span class="res">かしこさ +11</span></div></div>` })}
  ${stRow([2, 0, 11, 3, 0, 0], 2)}
  <div class="v-tabs"><span class="on">💪 軽い訓練</span><span>🔥 重い訓練</span></div>
  ${trs(2, [8, 24, 11, 9, 6, 13])}
</div>${footGo('🧠 かしこさの軽い訓練をする', '← もどる', 'go2')}`;

grp('T', '2. 訓練を選ぶ', 'メインの「訓練」を押すと、同じ景色のまま下が6つの訓練に替わる。訓練ごとに、来ている編成の子の顔・タッグの目印(光る枠と🤝)。選ぶと、右に来ている子と親密度のゲージ、下の札にタッグで効果が上がる流れ、6能力の上に上がる量・下がる量、上の帯に使う体力(赤いしま)と増えるストレス(紫のしま)を、決める前に見せる。', [
  { id: 'T1', label: '重い訓練・タッグ2体(ちから)', html: trainHeavy() },
  { id: 'T2', label: '軽い訓練・タッグなし(かしこさ)', html: trainLight },
], `<h3>先に見せる物</h3><ul>
  <li><b>上がる3能力</b>: 主の能力は大きい字(+38)、ほか2つは小さく(+7・+5)。<b>下がる能力</b>は赤い枠(−4。重い訓練だけ)</li>
  <li><b>使う体力</b>: 体力のゲージの右はしが赤いしまになり「−26」。ストレスは紫のしまで「+8」。失敗の率も数字で</li>
  <li><b>来ている子</b>: 顔・名前・親密度のゲージ(白い線 = 80 = タッグ)。タッグの子は金色に光る札で「タッグ +24%」、まだの子は「編成の効き +14%」</li>
  <li><b>タッグで上がる見え方</b>: 「基本 → 編成 → 🤝×2 → ちから +38」と左から右へ積み上がる。タッグの数だけ🤝の札が大きく光る(2体なら ×2)</li>
  <li><b>丸いボタン</b>: 訓練のLv・来ている子の顔・主の上がり幅。タッグのいる訓練は金色。助手が来ることもある(🎯命中の丸い顔)</li></ul>
  <h3>動き</h3><ul>
  <li>訓練を選び直すと、数字が 0.2秒で入れ替わる(画面は替わらない)。「決定」の2度押しで決まる</li></ul>`);

// ================= 3. 結果 → 叱る/褒める → 連続イベント → ターンが進む =================
const resBig = `${hdr('💰 名声 320', '中断')}<div class="v-body">
  ${band({ hp: 36, st: 42 })}
  ${scene({ bg: 'forest_morning', back: '<div class="v-burst"></div>', monStyle: 'left:62%;bottom:14%;height:46%;transform:translateX(-50%) rotate(6deg)', grStyle: 'left:62%;bottom:calc(14% - 5px)', inner: `
    <span class="v-prop" style="left:12%;bottom:15%">🪵</span><span class="v-prop" style="left:36%;bottom:40%;font-size:40px">💥</span>
    <div class="v-stamp">大成功<small>🤝 友情タッグ ×2・伸び ×1.5</small></div>
    <div class="v-chips" style="top:auto;bottom:8px">${['d', 'a', 'c'].map((k) => `<span class="v-chip">${CH[k].n} 親密度 +8</span>`).join('')}</div>` })}
  ${stRow([0, 57, -4, 10, 0, 7], 1, [412, 563, 229, 390, 198, 448])}
  <div class="v-log"><span class="hd2">💪 ちからの重い訓練</span><br>ちからが <b class="gu">57</b> 上がった! 命中 <b class="gu">+10</b>・丈夫さ <b class="gu">+7</b><br>かしこさが <b class="gd">4</b> 下がった/体力が <b class="gd">26</b> 下がった<br>らいが・しずく・ぴくりんの親密度が <b class="ga">8</b> 上がった</div>
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
  ${scene({ bg: 'forest_morning', cls: 'dim', noMon: 1, inner: `
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
  <div style="font-size:9.5px;color:#cbd5e1;font-weight:700;margin-top:6px;text-align:center">第3話は親密度60から(技を教えてもらえるかも)。見た話は「とばす」ができる</div>
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
  { id: 'K1', label: '結果(🌟大成功)', html: resBig },
  { id: 'K2', label: '結果のほかの3種類(⭕成功・❌失敗・💤サボり)', html: resOthers },
  { id: 'K3', label: '叱る/褒める', html: scold },
  { id: 'K4', label: '編成の子の連続イベント', html: chain },
  { id: 'K5', label: 'ターンが進む', html: turn },
], `<h3>結果(4種類)</h3><ul>
  <li><b>🌟大成功 ×1.5</b>: 金色の放射と大きな字。<b>⭕成功 ×1</b>: 白とピンクの字。<b>❌失敗 ×0</b>: 灰色・夕方の色・絵が傾く。<b>💤サボり ×0.3</b>: 紫の字・絵が寝ころぶ</li>
  <li>下の白い札に「何が上がった・下がった・だれの親密度が上がった」を文で。6能力の列にも + / − を出す</li>
  <li>K2 は3種類を1枚に並べた説明用(本番は K1 と同じ1画面ずつ)</li></ul>
  <h3>叱る/褒める</h3><ul>
  <li>助手が斜めの帯で出てきて聞く。褒める(ピンク)・叱る(水色)・なにもしないの3つ。押す前に、甘え度/恐れ度と方針がどちらへ動くかを見せる</li>
  <li>下に育成方針の7段の目盛り(いまどこ)と、甘え度・恐れ度のゲージ</li></ul>
  <h3>編成の子の連続イベント</h3><ul>
  <li>同じ訓練に来た子が50%で出てくる。子ごとに3話。右上の点で「いま何話目か」。選択肢の下に、もらえる物を先に見せる</li></ul>
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
  <div class="v-card pk"><div class="row">${pf('f', 'lg').replace(/<i class="af">.*?<\/i>/, '')}<div class="f1"><div class="h2">こんこ ${rk('M')} <span class="chip s">フレンド: ゆうた</span></div><div class="sub">上位3つ: かしこさ 33%・命中 28%・回避 24%</div></div></div>
    <div class="v-kv"><b>基本値</b><span>はじめの親密度 50・タッグ +35%・得意率 65%・はじめ かしこさ +40</span></div>
    <div class="v-kv"><b>アシスト</b><span>🔥 特訓の底力 段3・✨ ひらめき 段3・🤝 人なつっこさ 段3・⚔ 修行の手ほどき 段1</span></div></div>
  <div class="v-card" style="flex:1;min-height:0"><div class="sub" style="color:#7dd3fc;font-weight:900">🤝 フレンドから借りる(1体)</div>
    ${[['kyubi', 'M', 'ゆうた の こんこ', 'かしこさ・命中・回避', 1], ['dragon', 'S', 'みさき の りゅうき', 'ちから・ライフ・丈夫さ', 0], ['ham', 'A', 'けんじ の はむすけ', '回避・命中・かしこさ', 0]].map(([t, r, n, top, on]) => `<div class="v-item${on ? ' sel' : ''}" style="padding:4px 8px"><img src="${t === 'dragon' ? M('dragon.png') : T(t)}" style="width:30px;height:30px;border-radius:9px;object-fit:cover;background:#0f172a"><div>${n} ${rk(r)}<small>${top}</small></div><span class="pr">${on ? '✅ 借りている' : '借りる'}</span></div>`).join('')}</div>
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
const s4 = `${sHd(3)}<div class="v-body">${steps(3)}
  <div class="v-h">持ちこみ(3つまで)<small>名声で手に入れた物を、育成に持っていける。持っていかなくてもよい</small></div>
  <div class="v-bag"><div class="in">🧿<small>体力のおまもり</small></div><div class="in">🍱<small>とくせい弁当</small></div><div>＋<small style="color:#94a3b8">空き</small></div></div>
  <div class="v-item sel"><span class="e">🧿</span><div>体力のおまもり<small>体力の上限 +10(育成のあいだずっと)</small></div><span class="pr">✅ 持っていく・あと2</span></div>
  <div class="v-item sel"><span class="e">🍱</span><div>とくせい弁当<small>好きなターンに1回、体力を50回復</small></div><span class="pr">✅ 持っていく・あと4</span></div>
  <div class="v-item"><span class="e">📘</span><div>特訓の手引き<small>はじめの5ターン、訓練の伸び +10%</small></div><span class="pr">持っている 1</span></div>
  <div class="v-item"><span class="e">🎀</span><div>なかよしリボン<small>編成みんなの はじめの親密度 +5</small></div><span class="pr">持っている 3</span></div>
  <div class="v-item"><span class="e">🏥</span><div>診察券<small>通院が1回、かならず治る</small></div><span class="pr">持っている 0</span></div>
  <div class="v-item"><span class="e">🧸</span><div>お気に入りのおもちゃ<small>遊ぶと、ストレスがさらに 10 減る</small></div><span class="pr">持っている 2</span></div>
  <div style="flex:1"></div>
  <div class="v-card pk"><div class="sub" style="color:#f9a8d4;font-weight:900">持っていくと</div><div class="v-kv"><b>体力の上限</b><span>100 → <span class="yel">110</span></span></div><div class="v-kv"><b>使える物</b><span>🍱 とくせい弁当 ×1(メニューから)</span></div>
    <div class="row" style="margin-top:6px"><img class="fc" src="${F('myua', 'happy')}"><div class="bub f1">「おまもりがあると、重い訓練も続けやすいよ!」</div></div></div>
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
  <div class="v-sum"><span class="k">持ちこみ</span><span>🧿 体力のおまもり・🍱 とくせい弁当</span><span class="ed">変える</span></div>
  <div class="v-sum"><span class="k">はじめの上乗せ</span><span>編成から ちから +24・かしこさ +67 ほか/体力の上限 110</span></div>
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
  <div class="v-h">🎓 引退 ── もちまるの育成がおわった<small>みゅあ編「いっしょに、てっぺんへ!」・最後の期 決勝まで進んだ</small></div>
  <div class="v-rank"><img class="mon2" src="${M('mocchi.png')}"><div class="tx"><small>育成ランク</small><div class="L">A</div></div><div class="tx"><small>総合力</small><b>11,480</b><small style="color:#cbd5e1;margin-top:3px">次の S まで あと 2,520</small><small style="color:#86efac">自己ベスト更新!(前 9,210)</small></div></div>
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

// ================= 6b. 大会(受付 → 能力の比べ) =================
// 札: [絵文字, 名前, 星, 系統, 賞金, ごほうび, 状態, 出る条件]
const CUPS = [['💪', 'ちから自慢の大会', '★★', '自慢', '312', '人気 +2・ちから +6', 'sel', 'ちから 400 以上 ✔'], ['🌸', '春の大会', '★★★', '四季', '750', '能力ポイント +10・人気 +4', 'rv', 'ライバル: ゆうた の こんこ'], ['🏟', 'ふつうの大会', '★', 'ふつう', '125', 'なし', '', 'だれでも出られる'], ['🧠', 'かしこさ自慢の大会', '★★', '自慢', '312', '人気 +2・かしこさ +6', 'ng', 'かしこさ 400 以上 ✖(いま 233)']];
const cup = ([e, n, st, kind, g, rw, c, cond]) => `<div class="v-cup ${c}"><div class="e">${e}</div><div class="tx"><b>${n}</b><small>${cond}</small><span class="rw">🎁 ${rw}</span></div><div class="rt"><span class="st">${st}</span><span class="g">💰 ${g}</span><span class="kd">${kind}</span></div>${c === 'rv' ? '<span class="rvb">🔥 ライバルあり・ごほうび大</span>' : ''}</div>`;
const entry = `${hdr('💰 名声 320', 'もどる')}<div class="v-body">
  ${band()}
  ${scene({ bg: 'monhero_town', cls: 'low', noMon: 1, inner: `<img src="${BODY('mua__happy')}" style="position:absolute;left:-2%;bottom:-98%;height:190%">
    <div class="v-ev-h"><small>3年目 6月・ミドル期</small>🏆 大会の受付</div>
    <div class="v-ibub" style="left:38%;top:auto;bottom:10px">「今月は3つ出られるよ! 出ると<b>1ターン使う</b>から、訓練とどっちにするか考えてね」</div>` })}
  <div class="v-cups">${CUPS.map(cup).join('')}</div>
  <div class="v-card" style="padding:6px 9px"><div class="v-kv" style="margin:0"><b>出ると</b><span>2試合(準決勝・決勝)・体力 −20 くらい・勝つと賞金と人気。<span class="yel">期末の強制大会まで あと7ターン</span></span></div></div>
</div><div class="v-ft"><span>← もどる</span><span>📅 予定</span><span class="go">💪 ちから自慢に出る ▶</span></div>`;
// 比べ: [名前, 自分, 相手]
const VS = [['❤️ ライフ', 412, 455], ['💪 ちから', 506, 472], ['🧠 かしこさ', 233, 180], ['🎯 命中', 380, 341], ['💨 回避', 198, 260], ['🛡️ 丈夫さ', 441, 498]];
const vsRow = ([n, a, b]) => `<div class="v-vs1"><b class="${a >= b ? 'w' : ''}">${a}</b><i class="l"><u style="width:${a / 6}%"></u></i><span>${n}</span><i class="r"><u style="width:${b / 6}%"></u></i><b class="${b > a ? 'w' : ''}">${b}</b></div>`;
const versus = `${hdr('💰 名声 320', 'もどる')}<div class="v-body">
  ${band()}
  <div class="v-vsh"><div class="sd me"><img src="${M('mocchi.png')}"><div><small>あなた</small><b>もちまる</b><span>6,240 ${rk("C")}</span></div></div><div class="vsm">VS<small>準決勝</small></div><div class="sd op"><div><small>1番人気</small><b>いわお</b><span>6,410 ${rk("C")}</span></div><img src="${M('golem.png')}"></div></div>
  <div class="v-card" style="flex:1;min-height:0;display:flex;flex-direction:column;justify-content:space-evenly">
    ${VS.map(vsRow).join('')}
    <div class="v-vs1"><b class="w">45</b><i class="l p"><u style="width:45%"></u></i><span>⭐ 人気</span><i class="r p"><u style="width:38%"></u></i><b>38</b></div>
    <div class="v-vs1"><b class="w">72</b><i class="l p"><u style="width:72%"></u></i><span>🤝 忠誠</span><i class="r p"><u style="width:60%"></u></i><b>60</b></div>
    <div class="v-dist"><div>${['零', '近', '中', '遠'].map((d, i) => `<i class="a${[1, 3, 2, 0][i]}">${d}</i>`).join('')}</div><span>間合いの適性</span><div>${['零', '近', '中', '遠'].map((d, i) => `<i class="a${[3, 2, 1, 0][i]}">${d}</i>`).join('')}</div></div>
  </div>
  <div class="v-card pk" style="padding:6px 8px"><div class="row"><img class="fc" src="${F('myua', 'excited')}"><div class="bub f1">「ちからと命中は勝ってる! <em style="font-style:normal;color:#be185d">近い間合い</em>で押しきろ!」</div></div></div>
  <div class="v-bracket">${['もちまる', 'いわお', 'らんぽ', 'ミケ'].map((n, i) => `<span class="${i === 0 ? 'me' : ''}">${n}</span>${i === 1 ? '<u>決勝</u>' : i < 3 ? '<em>vs</em>' : ''}`).join('')}</div>
</div><div class="v-ft"><span>← やめる</span><span class="on" style="flex:1.6">⏩ 結果だけ見る</span><span class="go">⚔ 準備完了</span></div>`;
// 大会のあとのごほうびのごはん(社長 2026-11-12: ごはんは大会のあとのご褒美であげる)
const MEAL = [['🍙', 'おにぎり', 'ただ', '体力 +10', ''], ['🍛', 'いつものごはん', '💰 30', '体力 +25・ストレス −5', ''], ['🍖', 'ごちそう', '💰 120', '体力 +40・ストレス −15・忠誠 +3', 'sel']];
const meal = `${hdr('💰 名声 632', '中断')}<div class="v-body">
  ${band({ hp: 41, st: 40 })}
  ${scene({ bg: 'monhero_plaza_evening', back: '<div class="v-burst"></div>', monStyle: 'bottom:40%;height:34%', grStyle: 'bottom:calc(40% - 5px)', inner: `
    <div class="v-stamp" style="top:4%;font-size:46px">優勝!<small>💪 ちから自慢の大会 ★★<br>賞金 💰312・人気 +2・ちから +6</small></div>
    <div class="v-meal"><div class="t">🍽 がんばったごほうびに、ごはんをあげよう<small>大会のあとだけあげられる(1回)</small></div>
      <div class="ms">${MEAL.map(([e, n, g, fx, c]) => `<div class="v-ml ${c}"><div class="e">${e}</div><b>${n}</b><span class="g">${g}</span><small>${fx}</small></div>`).join('')}</div>
      <div class="row" style="margin-top:6px"><img class="fc" src="${F('myua', 'excited')}"><div class="bub f1">「優勝だもん、今日は ごちそう にしちゃお!」</div></div></div>` })}
</div><div class="v-ft"><span>あげない</span><span class="go">🍖 ごちそうをあげる(💰120)</span></div>`;
grp('C', '6b. 大会(受付 → 能力の比べ)', '参考動画の2本目(デビュー期の大会まで)の流れ「受付 → 組み合わせ → 能力の比べ → 試合 → 賞品」のうち、受付と能力の比べ、それに大会のあとのごほうびのごはんの3枚。上の帯(期・残りターン・総合力・体力)は大会の間もずっと出したまま。試合そのものは助手マスモン対戦の観戦の画面を使う。', [
  { id: 'C1', label: '大会の受付(今月の大会の札)', html: entry },
  { id: 'C2', label: '試合の前(自分と相手の能力の比べ)', html: versus },
  { id: 'C3', label: '大会のあと(ごほうびのごはん)', html: meal },
], `<h3>受付</h3><ul>
  <li>助手が受付の役。今月出られる大会を札で並べる: 名前・星・系統・賞金(名声)・ごほうび・出る条件(✔/✖)</li>
  <li><b>ライバルがいる大会</b>は赤い帯で「ごほうび大」。条件に届かない大会は薄く、何が足りないかを数字で</li>
  <li>下に「出ると1ターン使う・何試合・体力がどれくらい減るか」。強制大会までの残りも</li></ul>
  <h3>能力の比べ</h3><ul>
  <li>左が自分・右が相手。6能力・人気・忠誠を、まん中から左右にのびる棒で並べ、勝っている方の数字を黄色に</li>
  <li>間合いの適性(零・近・中・遠)は色の濃さで。地形は作らないので出さない</li>
  <li>助手が「どこで勝っているか」を一言。下に小さな組み合わせ表</li>
  <li>ボタンは「結果だけ見る」と「準備完了」(観戦する)の2つ</li></ul>
  <h3>大会のあとのごはん(社長 2026-11-12)</h3><ul>
  <li>ごはんは<b>大会のあとのごほうび</b>であげる。メインのボタンにもターンのはじめにも置かない</li>
  <li>結果(優勝・賞金・ごほうび)の上に小窓が出て、3つから1つ選ぶ(あげなくてもよい)。値段(名声)と効き目を先に見せる。物と数字は仮</li></ul>`);

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

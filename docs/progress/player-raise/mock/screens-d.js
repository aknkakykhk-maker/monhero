// モンヒロサクセス 止め絵の作り直し(2026-11-12)。育成のメイン2案・訓練を選ぶ・始めるまでの段
// 組み立て方の考え方: 育てる子が住む場所を真ん中に大きく/行動の口を下にまとめる/能力・寿命・体調は上の帯と横一列でひと目
// 絵は今ある立ち絵と背景(story-bg/monhero_night)を仮に置いている。文・数字は仮
const seg = (cls, on, use = 0) => `<span class="rd-seg ${cls}">${[0, 1, 2, 3, 4].map((i) => `<i class="${i < on - use ? 'on' : i < on ? 'use' : ''}"></i>`).join('')}</span>`;
// 上の帯。use: 選んだ訓練で使う「げんき」の目盛りの数(赤い斜線で見せる)
const band = (use = 0) => `<div class="rd-band">
  <div class="rd-b1">
    <div class="rd-turn"><small>引退まで</small><div>あと<b>52</b>週</div><span>2年目 6月 3週 <i>98/150</i></span></div>
    <div class="rd-box sum"><small>総合力 ${rk('C')}</small><b>2,170</b></div>
    <div class="rd-box"><small>🤝 忠誠</small><b>72</b></div>
    <div class="rd-box"><small>⭐ 人気</small><b>45</b></div>
    <div class="rd-mood">😊<small>ごきげん</small></div>
  </div>
  ${life(98, 150, [45, 72])}
  <div class="rd-b3"><span>💚 げんき</span>${seg('g', 3, use)}${use ? '<span style="color:#fca5a5">−' + use + '</span>' : ''}<span style="margin-left:4px">💢 ストレス</span>${seg('s', 2)}</div>
</div>`;
const coachRow = (name, text, mood = 'happy') => `<div class="rd-coach"><span class="rd-name">${name}</span><span class="rd-hint">💡 ヒント</span><div class="bub f1">${text}</div><img class="fc" src="${F('myua', mood)}"></div>`;
// 住む場所。h: 高さ / mon: 立ち絵の大きさ / inner: 重ねる物
const home = (h, mon, inner = '', cls = '') => `<div class="rd-home" style="height:${h}px">
  <img class="bg" src="${BG('monhero_night')}"><div class="sh"></div>
  <div class="gr" style="bottom:${Math.round(h * 0.07)}px;width:${mon * 0.8}px;height:${mon * 0.16}px"></div>
  <img class="mon ${cls}" src="${M('mocchi.png')}" style="bottom:${Math.round(h * 0.085)}px;width:${mon}px;height:${mon}px">
  ${inner}</div>`;
const VAL = [412, 506, 233, 380, 198, 441];
const SHORT = ['ライフ', 'ちから', 'かしこさ', '命中', '回避', '丈夫さ'];
// 6能力の横一列。ups: 上がり幅(選んだ訓練の見通し)
const stRow = (ups) => `<div class="rd-st">${ST.map((s, i) => `<div class="${ups && ups[i] > 0 ? 'up' : ups && ups[i] < 0 ? 'dn' : ''}"><small>${s[1]}${SHORT[i]}</small><b>${VAL[i]}</b><u><i style="width:${VAL[i] / 9.99}%"></i></u>${ups ? `<em>${ups[i] > 0 ? '↑' + ups[i] : ups[i] < 0 ? '↓' + -ups[i] : ''}</em>` : ''}</div>`).join('')}</div>`;
const pnl = (e, nm, sub, cls = '', extra = '') => `<div class="rd-p ${cls}"><div class="e">${e}</div>${nm}<small>${sub}</small>${extra}</div>`;
const foot = `<div class="rd-ft"><span>← 中断</span><span>⏩ 早送り</span><span class="on">演出 短く</span><span>📖 きろく</span><span>☰ メニュー</span></div>`;
const homeChips = `<span class="rd-chip" style="left:8px;top:8px">🌙 夏の夜</span><span class="rd-chip hot" style="left:8px;top:32px">🏆 大会まで あと1週</span>
  <div class="rd-cv" style="right:8px;top:8px">成長の曲線 <span class="yel">● いまここ</span>${curve(0.65, 104, 36)}</div>`;
// 訓練の丸い口6つ。sel: 選んでいる番号 / tip: 選んだ口の上の吹き出し
const TR = [['❤️', 'ライフ', 12, [['e', 1]]], ['💪', 'ちから', 19, [['d', 1], ['a', 0], ['c', 0]]], ['🧠', 'かしこさ', 9, [['f', 1]]], ['🎯', '命中', 7, []], ['💨', '回避', 6, []], ['🛡️', '丈夫さ', 11, [['b', 1]]]];
const trs = (sel, tip, tipTop = -22) => `<div class="rd-trs">${TR.map((t, i) => `<div class="rd-tr${t[3].some((x) => x[1]) ? ' fav' : ''}${i === sel ? ' sel' : ''}">
  ${i === sel && tip ? `<span class="tip" style="top:${tipTop}px">${tip}</span>` : ''}
  <div class="fs">${t[3].length ? t[3].map(([k, fav]) => cf({ ...CH[k], fav })).join('') : '<span class="no">だれも<br>いない</span>'}</div>
  <div class="o">${t[0]}<small>${i === sel ? '決定' : t[1]}</small></div><div class="x">+${t[2]}</div></div>`).join('')}</div>`;
const lightHeavy = `<div class="row" style="margin-top:6px;gap:6px"><div class="tabs y f1" style="margin:0"><span class="on">💪 軽い訓練</span><span>🔥 重い訓練</span></div></div>`;

// ---- R4. 育成のメイン(作り直し2案) ----
const redoA = `<div class="in">${hd('💰 名声 320', '中断')}
  ${band()}
  ${coachRow('育成', '今週は ちから にみんな来てるよ! ちょっと疲れが見えるかな…')}
  ${home(364, 262, `${homeChips}
    <span class="rd-nm" style="bottom:7px">もちまる(モッチー)</span>
    <div class="rd-mini" style="left:8px;bottom:8px">👥 応援<small>6体の顔ぶれ</small></div>
    <div class="rd-mini" style="right:8px;bottom:8px">🔍 くわしく<small>疲れ・技・数字</small></div>`, 'a-hop')}
  ${stRow()}
  <div class="rd-act" style="grid-template-columns:1fr 2fr 1fr">
    ${pnl('🛌', '休む', '疲れをとる')}
    <div class="rd-p main"><div style="font-size:17px">💪 訓練</div><div class="rd-gather a-glow"><span>💪</span>${cf({ ...CH.d, fav: 1 })}${cf(CH.a)}${cf(CH.c)}<span class="rd-rib">🎉 みんな集合</span></div><small style="margin-top:2px">ほか ❤️1体 🧠1体 🛡️1体 が来ている</small></div>
    ${pnl('🍚', 'ごはん', '次は 7月1週', 'off', '<span class="lk">✅</span>')}
  </div>
  <div class="rd-act" style="grid-template-columns:repeat(4,1fr)">
    ${pnl('🎈', '遊ぶ', 'ストレスをとる')}
    ${pnl('⚔', '修行', '4週・あと2回')}
    ${pnl('🏆', '大会', '来週 クラスC', 'off', '<span class="lk">🔒</span>')}
    ${pnl('📊', '能力', '6能力・技・型')}
  </div></div>${foot}`;

const redoB = `<div class="in">${hd('💰 名声 320', '中断')}
  ${band(1)}
  ${coachRow('育成', '今週は ちから にみんな来てるよ!')}
  ${home(262, 198, `${homeChips}
    <span class="rd-nm" style="bottom:6px">もちまる(モッチー)</span>
    <div class="rd-mini" style="right:8px;bottom:8px">🔍 くわしく</div>`, 'a-hop')}
  ${stRow([0, 19, 0, 3, 0, 0])}
  ${lightHeavy}
  <div style="height:34px"></div>
  ${trs(1, "🎉 みんな集合 ×1.6", -32)}
  <div class="rd-act" style="grid-template-columns:repeat(5,1fr)">
    ${pnl('🍚', 'ごはん', '次は 7月', 'off', '<span class="lk">✅</span>')}
    ${pnl('🛌', '休む', '疲れをとる')}
    ${pnl('🎈', '遊ぶ', 'ストレス')}
    ${pnl('⚔', '修行', 'あと2回')}
    ${pnl('🏆', '大会', '来週', 'off', '<span class="lk">🔒</span>')}
  </div></div>${foot}`;

scr('R4', '育成のメイン(1週)の作り直し', '社長の答え「もっとLINEモンスターファームやモンスターファームの画面を参考にして」を受けた作り直し。参考にしたのは組み立て方の考え方だけ(絵・用語・文・アイコンは写していない)。育てる子が住む場所を真ん中に大きく置き、上の帯で「あと何週・年月週・総合力・忠誠・人気・機嫌・寿命・げんき」をひと目に、行動の口を下にまとめた。', [
  { id: 'R4-A', label: '作り直し 案A(おすすめ) 住む場所+行動のパネル', html: redoA },
  { id: 'R4-B', label: '作り直し 案B 住む場所+訓練の口も同じ画面', html: redoB },
], `<h3>2案の考え方(社長に聞く)</h3><ul>
  <li><b>A(おすすめ)</b>: メインは「住む場所」と「行動の口7つ」だけ。訓練を押すと、同じ景色のまま訓練を選ぶ画面(R5)へ。住む場所がいちばん大きく、押す口が大きくて迷わない。「今週どこに応援が集まっているか」は訓練のパネルに顔で先に見せる</li>
  <li><b>B</b>: 訓練の丸い口6つもメインに置く(画面を替えずに1回で決まる)。1週が速い。そのぶん住む場所は小さくなり、口も小さい</li></ul>
  <h3>どこに何を置いたか</h3><ul>
  <li><b>上の帯</b>: 「引退まで あと◯週」を大きく、その下に 年・月・週(98/150)。総合力とランク・忠誠・人気・機嫌の顔。寿命の目盛り(点線=のびざかり)。げんき(疲れの逆)とストレスは数字を出さず5段の目盛り</li>
  <li><b>まん中</b>: 住む場所に立ち絵。季節と時間で景色が替わる(春夏秋冬 × 昼・夕・夜)。機嫌で表情、疲れると立ち絵が少し下がる。成長の曲線の「いまここ」は右上の小窓</li>
  <li><b>6能力</b>: 横一列。訓練を選ぶと上がる能力が黄色く光り「↑19」</li>
  <li><b>行動の口</b>: 休む・訓練・ごはん(月のはじめだけ開く)・遊ぶ・修行・大会(大会の週だけ開く)・能力</li>
  <li><b>いちばん下</b>: 中断・早送り・演出を短く・きろく・メニュー</li></ul>
  <h3>動き(ふだんは短く)</h3><ul><li>立ち絵は今の待ちの動き。応援が3体以上の口は <code>mkGlow 1.4s</code></li><li>節目(引退・合体・昇格)だけ 5〜6秒。ほかは 1.5秒ほど・タップでとばせる</li></ul>`);

// ---- R5. 訓練を選ぶ(案Aで「訓練」を押した先) ----
const chCard = (k, fav, pct) => `<div class="rd-ch" style="position:static;width:auto"><div class="r1">${cf({ ...CH[k], fav })}<div>${CH[k].n} ${rk(CH[k].r)}<small>${fav ? '★得意 ' : ''}+${pct}%</small></div></div></div>`;
const redoT = `<div class="in">${hd('💰 名声 320', 'もどる')}
  ${band(1)}
  ${coachRow('訓練', 'らいがは ちから が得意だよ。いっしょにやると よく伸びる!', 'excited')}
  ${home(338, 214, `
    <div class="rd-cv" style="left:8px;top:8px;padding:5px 7px"><div style="margin-bottom:3px">今週の応援の集まり</div><div class="row" style="gap:3px">${['e', 'd', 'a', 'c', 'f', 'b'].map((k) => cf({ ...CH[k] })).join('')}</div></div>
    <div style="position:absolute;right:8px;top:8px;width:120px;display:flex;flex-direction:column;gap:4px">
      <span class="rd-rib" style="align-self:flex-end">🎉 みんな集合 ×1.6</span>
      ${chCard('d', 1, 18)}${chCard('a', 0, 18)}${chCard('c', 0, 22)}</div>
    <span class="rd-nm" style="bottom:7px">もちまる やる気じゅうぶん!</span>`, 'a-hop')}
  ${stRow([0, 19, 0, 3, 0, 0])}
  ${lightHeavy}
  <div style="height:34px"></div>
  ${trs(1, "失敗しにくい", -32)}
  </div>
  <div class="rd-ft"><span>← もどる</span><span style="flex:2" class="on">💪 ちから の軽い訓練をする</span></div>`;
scr('R5', '訓練を選ぶ(案Aの「訓練」を押した先)', 'メインと同じ上の帯・同じ景色のまま、下が訓練の丸い口6つに替わる。口の上に、今週そこへ集まった応援の顔が並ぶ。押すと口が持ち上がって「決定」になり、もう一度押すと始まる。', [
  { id: 'R5', label: '訓練を選ぶ(ちからを選んだところ)', html: redoT },
], `<h3>見せるもの</h3><ul>
  <li><b>口の上の顔</b>: その週に集まった応援の子。得意の子(★)がいる口は黄色。3体以上は「みんな集合」</li>
  <li><b>右の札</b>: 選んだ口に集まった子の顔・名前・ランク・効き(+◯%)</li>
  <li><b>6能力</b>: 上がる能力が光って「↑19」。重い訓練では下がる能力に「↓」</li>
  <li><b>げんきの目盛り</b>: 使うぶんが赤い斜線。疲れの見通しが数字なしで分かる</li>
  <li><b>口の上の吹き出し</b>: 失敗のしやすさをことばで(失敗しにくい/ふつう/あぶない)。数字はコーチがソラシドのときだけ</li>
  <li><b>左上</b>: 今週の応援6体の顔ぶれ(だれが来ていて、だれが来ていないか)</li></ul>
  <h3>動き</h3><ul><li>口を押す: 0.15秒で持ち上がる。集まった顔が <code>mkHop</code> ではねる</li><li>決定 → 結果(前の画面5)へ 約1.5秒</li></ul>`);

// ---- R1. 育成を始めるまでの段 ----
const steps = (n) => `<div class="rd-steps">${['1 育てる子', '2 応援', '3 コーチ', '4 確認'].map((s, i) => `<span class="${i + 1 === n ? 'on' : i + 1 < n ? 'ok' : ''}">${s}</span>`).join('')}</div>`;
const SP = ['mocchi', 'suezo', 'tiger', 'pixie', 'golem', 'undine', 'kyubi', 'plant', 'ham', 'ghost', 'monol', 'zan', 'dreamy', 'eiki', 'spooky', 'oboro', 'orihime', 'yggdrasil'];
const startA = `<div class="in">${hd('1 / 4', 'もどる')}${steps(1)}
  <div class="tabs"><span class="on">🥚 ベースモン</span><span>🧬 合体で生まれた子(2)</span></div>
  ${home(292, 222, `<span class="rd-chip" style="left:8px;top:8px">モッチー</span><span class="rd-chip" style="right:8px;top:8px">寿命 ふつう(約150週)</span>
    <span class="rd-nm" style="bottom:7px">はじめの子におすすめ・ライフが伸びやすい</span>`)}
  <div class="card" style="margin-top:6px;padding:8px 10px"><div class="row" style="justify-content:space-between"><span class="h2">はじめの値と伸びやすさ</span><span class="sub">◎よく伸びる ○ふつう △伸びにくい</span></div>
    <div style="margin-top:6px">${sts([120, 90, 70, 85, 60, 95], null, ['◎', '○', '△', '○', '△', '○'])}</div>
    <div class="row" style="margin-top:6px;gap:5px"><span class="chip on">応援に入ると ❤️ライフ に集まる</span><span class="chip">近い間合いが得意</span></div></div>
  <div class="sub" style="margin-top:8px">解放している種(12 / 30)</div>
  <div class="rd-sp">${SP.map((t, i) => `<span class="${i === 0 ? 'on' : i > 11 ? 'lk2' : ''}"><img src="${T(t)}">${i > 11 ? '<em>🔒</em>' : ''}</span>`).join('')}</div>
  </div><div class="ft row"><span class="btn3 f1">🎲 ぜんぶおまかせ</span><span class="btn" style="flex:1.4">次へ(応援の編成)</span></div>`;
const rdSlot = (k, fav, pct, extra = '') => `<div class="rd-slot ${CH[k].fr ? 'fr' : CH[k].base ? 'base' : ''}">${cf({ ...CH[k], lg: 1 })}${CH[k].n} ${rk(CH[k].r)}<small>${fav} +${pct}%</small>${extra}</div>`;
const startB = `<div class="in">${hd('2 / 4', 'もどる')}${steps(2)}
  <div class="rd-sumrow" style="padding:5px 9px"><span class="k">育てる子</span><img src="${T('mocchi')}" style="width:34px;height:34px;border-radius:10px"><div class="f1"><div class="h2">もちまる</div><div class="sub">モッチー・ベースモン</div></div><span class="btn3 sm">かえる</span></div>
  <div class="row" style="justify-content:space-between;margin-top:8px"><span class="h2">応援の編成(6体)</span><span class="chip g">集まった訓練の伸び 最大 ×1.9</span></div>
  <div class="grid3" style="margin-top:6px">
    ${rdSlot('d', '💪', 12)}${rdSlot('a', '🧠', 18)}${rdSlot('c', '💨', 22)}
    ${rdSlot('b', '🛡️', 15)}${rdSlot('e', '❤️', 4, '<span class="chip" style="position:absolute;left:3px;top:3px;font-size:9px;padding:0 5px">空き枠</span>')}${rdSlot('f', '🧠', 30, '<span class="chip s" style="position:absolute;left:3px;top:3px;font-size:9px;padding:0 5px">🤝 レンタル</span>')}
  </div>
  <div class="row wrap" style="margin-top:7px;gap:4px"><span class="sub">集まりやすい訓練</span><span class="chip">❤️1</span><span class="chip">💪1</span><span class="chip on">🧠2</span><span class="chip">💨1</span><span class="chip">🛡️1</span><span class="chip" style="color:#fca5a5">🎯0</span></div>
  <div class="tabs"><span class="on">📦 保存枠(14)</span><span>🤝 フレンドから借りる 1体</span></div>
  <div class="rd-sp">${[['tiger', 'C', '💪'], ['undine', 'A', '🧠'], ['pixie', 'S', '💨'], ['golem', 'B', '🛡️'], ['plant', 'D', '❤️'], ['ham', 'E', '🎯'], ['ghost', 'B', '🧠'], ['monol', 'C', '🛡️'], ['zan', 'A', '💪'], ['kuromy', 'D', '💨'], ['melody', 'F', '❤️'], ['oboro', 'G', '🎯'], ['dreamy', 'E', '🧠'], ['eiki', 'D', '💪'], ['spooky', 'F', '💨'], ['yggdrasil', 'C', '❤️'], ['orihime', 'E', '🛡️'], ['mitarashi', 'G', '🎯']].map(([t, r, a], i) => `<span class="${i < 4 ? 'on' : ''}"><img src="${T(t)}">${rk(r)}<em>${a}</em></span>`).join('')}</div>
  <div class="sub" style="margin-top:6px">ランクが高い子ほど効きが大きい。空いた枠はベースモンが入る(+4%)。</div>
  <div class="rd-coach" style="margin-top:8px"><div class="bub f1">🎯命中 に集まる子がいないよ。ハムを入れてみる?</div><img class="fc" src="${F('myua', 'normal')}"></div>
  </div><div class="ft row"><span class="btn3 f1">いつもの編成</span><span class="btn" style="flex:1.4">次へ(コーチを選ぶ)</span></div>`;
const startC = `<div class="in">${hd('4 / 4', 'もどる')}${steps(4)}
  ${home(176, 150, `<span class="rd-chip hot" style="left:8px;top:8px">この子を育てる</span><span class="rd-chip" style="right:8px;top:8px">1年目 4月 1週 から</span>`)}
  <div class="rd-sumrow"><span class="k">育てる子</span><img src="${T('mocchi')}" style="width:44px;height:44px;border-radius:12px"><div class="f1"><div class="h2">もちまる <span class="sub">✏️</span></div><div class="sub">モッチー・ベースモン・寿命 約150週</div></div></div>
  <div class="rd-sumrow"><span class="k">応援<br>6体</span><div class="f1"><div class="row" style="gap:4px">${['d', 'a', 'c', 'b', 'e', 'f'].map((k) => cf({ ...CH[k] })).join('')}</div><div class="sub" style="margin-top:3px">効きの合計 <b class="grn">+101%</b>・最大 ×1.9</div></div></div>
  <div class="rd-sumrow"><span class="k">コーチ</span><img class="fc" src="${F('myua', 'happy')}"><div class="f1"><div class="h2">みゅあ <span class="chip p">仲良し Lv4</span></div><div class="sub">遊ぶ・休むでストレスがよく減る</div></div></div>
  <div class="rd-sumrow"><span class="k">成長の型</span><div class="f1"><div class="h2">🎲 始めるとくじで決まる</div><div class="sub">早熟・ふつう・晩成 など(合体の子は親の型)</div></div></div>
  <div class="sub yel" style="margin-top:10px;font-weight:900">▼ 入れるなら(まだ決まっていない・社長に聞く)</div>
  <div class="rd-opt"><b>入れるなら ① 育成の筋書き</b><br>「のんびり3年」「大会をめざす」など、目標とごほうびが違う筋書きを最初に選ぶ</div>
  <div class="rd-opt"><b>入れるなら ② 親からの受け継ぎ</b><br>ベースモンにも保存枠から「親役」を2体選び、伸びやすさを少し上げる</div>
  <div class="rd-opt"><b>入れるなら ③ 持ちこみ</b><br>名声で買った道具を3つまで持って始める(疲れをとる・失敗を防ぐ など)</div>
  </div><div class="ft"><span class="btn a-glow" style="font-size:17px;padding:13px">🌱 育成スタート!</span></div>`;
scr('R1', '育成を始めるまでの段', '上に段の矢印(1 育てる子 → 2 応援の編成 → 3 コーチ → 4 確認)を並べ、いまどこかが分かるようにした。モンヒロサクセスで決まっていること(育てる子はベースモンか合体で生まれた子・応援は6体でうち1体はフレンドから・コーチは助手1人)だけで4段。3段目のコーチは前の画面3のまま。', [
  { id: 'R1-1', label: '1 育てる子を選ぶ', html: startA },
  { id: 'R1-2', label: '2 応援の編成', html: startB },
  { id: 'R1-4', label: '4 さいごの確認(入れるなら、の印つき)', html: startC },
], `<h3>組み立て方</h3><ul>
  <li><b>1 育てる子</b>: 上に住む場所と立ち絵を大きく。6能力のはじめの値と伸びやすさの印。下に持っている種の並び。「ぜんぶおまかせ」で4段を一気に埋める</li>
  <li><b>2 応援の編成</b>: 上に6枠(顔・ランク・集まりやすい能力・効き)。下に保存枠の丸い並びと「フレンドから借りる」のタブ。集まりやすい訓練のかたより(だれも来ない能力は赤)を1行で</li>
  <li><b>3 コーチ</b>: 助手8人(前の画面3)</li>
  <li><b>4 確認</b>: 選んだ物の一覧と効きの合計 →「育成スタート!」</li></ul>
  <h3>「入れるなら」の印(社長に聞く)</h3><ul>
  <li>黄色の点線の3つは、参考の遊びにはあるが、モンヒロサクセスではまだ決まっていない物。入れると段が 5〜7 に増える</li>
  <li>おすすめ: <b>第1弾は入れずに4段で始める</b>(1回 15〜25分の手軽さを守る)。入れるなら ③持ちこみ がいちばん軽い</li></ul>`);

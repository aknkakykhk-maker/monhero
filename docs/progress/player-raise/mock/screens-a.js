// 画面 1〜5(はじめる・応援の編成・コーチ・育成のメイン・訓練の結果)
const spGrid = [['mocchi', 'モッチー', 1], ['pixie', 'ピクシー'], ['suezo', 'スエゾー'], ['golem', 'ゴーレム'], ['tiger', 'ライガー'], ['ghost', 'ゴースト'], ['plant', 'プラント'], ['undine', 'ウンディーネ']];

scr('01', 'はじめる(育てる子)', '入口は2つ。「ベースモン」(解放している種のまっさらな1体)と「合体で生まれた子(未育成)」。選ぶと、はじめの6能力と伸びやすさの印が下に出る。', [
  { id: '1', label: 'はじめる(育てる子)', html: `<div class="in">${hd('1 / 3')}
    <div class="h1" style="margin-top:6px">だれを育てる？</div>
    <div class="tabs"><span class="on">🥚 ベースモン</span><span>✨ 合体で生まれた子 <b class="yel">2</b></span></div>
    <div class="grid4" style="margin-top:8px">${spGrid.map(([t, n, on]) => `<div class="ctr" style="background:${on ? '#3b2f0b' : '#0f172a'};border:1.5px solid ${on ? '#fde047' : '#475569'};border-radius:12px;padding:4px 2px 5px"><img src="${T(t)}" style="width:100%;aspect-ratio:1;border-radius:9px;object-fit:cover"><div style="font-size:10.5px;font-weight:900;margin-top:2px" class="nw">${n}</div></div>`).join('')}</div>
    <div class="sub ctr" style="margin-top:4px">▼ 解放している30種からえらべます</div>
    <div class="card yl"><div class="row"><img src="${M('mocchi.png')}" class="ph" style="width:104px;height:104px">
      <div class="f1"><div class="h1">モッチー</div><div class="sub">ベースモン・Lv1 から</div>
      <div style="margin-top:4px"><span class="chip">寿命 約150週</span> <span class="chip s">型はくじ</span></div>
      <div class="sub" style="margin-top:4px">伸びやすさ ◎ よく伸びる ○ ふつう △ にがて</div></div></div>
      <div style="margin-top:8px">${sts([120, 90, 70, 80, 60, 100], null, ['◎', '○', '△', '○', '△', '◎'])}</div></div>
    <div class="sub" style="margin-top:10px">「✨ 合体で生まれた子」をえらんだときの札</div>
    <div class="card pk"><div class="row"><img src="${M('yaobikuni.PNG')}" class="ph" style="width:64px;height:64px">
      <div class="f1"><div class="row"><span class="h2">うみか</span><span class="chip p">3代目</span><span class="chip">未育成</span></div>
      <div class="sub">ヤオビクニ・📈 かしこさ型(親ゆずり)</div>
      <div class="sub">親: <b class="pnk">しずく</b> ${rk('A')} × <b class="pnk">もちまる</b> ${rk('B')}</div></div></div>
      <div class="sub" style="margin-top:4px">はじめの6能力に <b class="grn">+62</b> の上乗せ・受け継いだ技 2つ</div></div>
    </div><div class="ft"><span class="btn">この子で進む →</span></div>` },
], `<h3>見せたいもの</h3><ul><li>入口は上の2つのタブだけ。引退した子は並ばない</li><li>伸びやすさは ◎○△ の印(数字は出さない)</li><li>合体の子は「◯代目」と親2体の名前・ランク</li></ul><h3>動き</h3><ul><li>種の札を押す → 下の大きい札が <code>mkPop .3s</code> で入れ替わる</li><li>えらんだ札は黄色い枠がゆっくり光る <code>mkGlow 1.4s</code></li></ul>`);

const slot = (o, fav, pct, extra = '') => `<div class="card ${o.fr ? 'sk' : ''} ${o.base ? 'dash' : ''}" style="margin:0;padding:8px;text-align:center">
  <img src="${T(o.t)}" style="width:72px;height:72px;border-radius:12px;object-fit:cover;margin:0 auto;${o.base ? 'opacity:.45' : ''}">
  <div class="row" style="justify-content:center;gap:4px;margin-top:4px">${o.base ? '<span class="chip">ベースモン</span>' : rk(o.r)}<b class="nw" style="font-size:12px">${o.base ? '' : o.n}</b></div>
  <div class="sub nw" style="font-size:10.5px">${fav}に来る</div><div class="yel" style="font-size:15px;font-weight:900">+${pct}%</div>${extra}</div>`;

scr('02', '応援の編成', '6枠。5枠は保存枠から、1枠はフレンドのレンタル。顔・ランクの色・集まりやすい能力・効き(+◯%)を1枚の札で見せる。空き枠はベースモンが薄く入る。', [
  { id: '2', label: '応援の編成', html: `<div class="in">${hd('2 / 3')}
    <div class="row" style="margin-top:6px"><div class="h1 f1">応援の編成</div><span class="chip on">いつもの編成</span></div>
    <div class="sub">集まった訓練がよく伸びます。強い子ほど効きが大きい</div>
    <div class="grid3" style="margin-top:8px">
      ${slot(CH.a, '🧠 かしこさ', 18)}${slot(CH.b, '🛡️ 丈夫さ', 15)}${slot(CH.c, '💨 回避', 22)}
      ${slot(CH.d, '💪 ちから', 12)}${slot({ ...CH.e }, '🎯 命中', 4)}${slot(CH.f, '❤️ ライフ', 30, '<span class="chip s" style="position:absolute;top:-8px;left:50%;transform:translateX(-50%)">🤝 フレンド</span>')}
    </div>
    <div class="card" style="padding:8px 10px"><div class="row"><span class="sub f1">集まりやすい能力のかたより</span><span>❤️1 💪1 🧠1 🎯1 💨1 🛡️1</span></div></div>
    <div class="row" style="margin-top:12px"><div class="h2 f1">🤝 フレンドの貸し出しの子</div><span class="sub">1回の育成に1体</span></div>
    ${[['kyubi', 'M', 'こんこ', 'あかねさん', '❤️ ライフ', 1], ['zan', 'S', 'ざんざん', 'ゆうとさん', '💪 ちから'], ['dreamy', 'B', 'ゆめこ', 'はるさん', '🧠 かしこさ']].map(([t, r, n, who, fav, on]) =>
      `<div class="card ${on ? 'yl' : ''}" style="padding:7px 10px"><div class="row">${cf({ t, r, lg: 1 })}<div class="f1"><div class="row" style="gap:5px">${rk(r)}<b>${n}</b></div><div class="sub">${who}・${fav} によく来る</div></div>${on ? '<span class="chip on">えらび中</span>' : '<span class="btn2 sm">借りる</span>'}</div></div>`).join('')}
    <div class="sub ctr" style="margin-top:6px">同じフレンドの子は続けて2回まで</div>
    </div><div class="ft"><span class="btn">この編成で進む →</span></div>` },
], `<h3>見せたいもの</h3><ul><li>ランクは色の札と顔の枠の色でひと目</li><li>空き枠は点線の枠+薄い絵+「ベースモン」(+4%)</li><li>フレンドの枠は水色の枠と 🤝 の札</li></ul><h3>動き</h3><ul><li>保存枠から入れる → 枠の絵が <code>mkPop</code>、+◯% が <code>mkRise</code> で数え上がる</li><li>「借りる」→ 6枠目へ顔が飛んで入る(<code>transform</code> 0.3秒)</li></ul>`);

const coaches = [['myua', 'みゅあ', '遊ぶ・休むがよく効く。褒めると忠誠 +1', 5, 1], ['atsu', 'あつ', '昇格戦の前の週に「気合」', 3], ['kiki', 'きき', '重い訓練の疲れが軽くなる', 4], ['momosuke', 'ももすけ', '大会で人気がよく上がる', 2], ['dra', 'ドラ', '失敗がへる。修行で技を覚えやすい', 1], ['kyuko', 'きゅうこ', '成長の型とピークを見抜く', 0], ['sorashido', 'ソラシド', 'けが・病気が起きにくい', 0], ['erubin', 'えるびん', '早く治る。寿命 +4週', 0]];
const coachGrid = `<div class="grid2" style="margin-top:8px">${coaches.map(([a, n, eff, lv, on]) => `<div class="card ${on ? 'yl' : ''}" style="margin:0;padding:8px"><div class="row"><img class="fc ${lv ? '' : 'lk'}" src="${F(a, on ? 'happy' : 'normal')}" style="width:46px;height:46px"><div class="f1"><b style="font-size:13px">${lv ? n : '？？？'}</b><div>${lv ? `<span class="chip ${lv >= 5 ? 'p' : ''}">💗 Lv${lv}</span>` : '<span class="chip">🔒 まだ会っていない</span>'}</div></div></div><div class="sub" style="margin-top:5px;min-height:32px">${lv ? eff : 'アシストカードを使うと、助手として迎えられます'}</div>${lv ? `<div class="bar p" style="height:5px"><i style="width:${lv >= 5 ? 100 : lv >= 3 ? 80 : 60}%"></i></div><div class="sub" style="font-size:10px">効き ${lv >= 5 ? 100 : lv >= 3 ? 80 : 60}%・お話 ${lv >= 5 ? '4話+特別' : lv >= 3 ? '3話まで' : '1話'}</div>` : ''}</div>`).join('')}</div>`;

scr('03', 'コーチを選ぶ', '助手8人。効き方・仲良し度の段(効きの%とお話の数)・解放前は鍵。決めると、成長の型のくじの小さな演出へ。', [
  { id: '3a', label: 'コーチを選ぶ', html: `<div class="in">${hd('3 / 3')}<div class="h1" style="margin-top:6px">コーチをえらぶ</div><div class="sub">コーチは様子を教え、育て方の舵とりを助けます</div>${coachGrid}</div><div class="ft"><span class="btn">みゅあ にお願いする →</span></div>` },
  { id: '3b', label: '成長の型のくじ', html: `<div class="in">${hd('3 / 3')}<div class="h1" style="margin-top:6px">コーチをえらぶ</div>${coachGrid}</div>
    <div class="modal"><div class="ctr sub">この子の成長の型は…</div>
    <div class="row" style="justify-content:center;gap:8px;margin-top:14px">
      <div class="card" style="margin:0;width:84px;opacity:.35;text-align:center">📈<br>ライフ型</div>
      <div class="card yl a-spin" style="margin:0;width:128px;text-align:center;padding:14px 6px"><div style="font-size:30px">📈</div><div class="h1 yel">攻撃型</div><div class="sub">ちから・命中が伸びやすい</div></div>
      <div class="card" style="margin:0;width:84px;opacity:.35;text-align:center">📈<br>防御型</div></div>
    <span class="spark" style="left:92px;top:300px">✨</span><span class="spark" style="right:86px;top:318px">✨</span>
    <div class="ctr" style="margin-top:12px">${curve(0, 220, 70)}</div><div class="ctr sub">力がいちばん伸びる時期(ピーク)は <b class="yel">まんなかごろ</b></div>
    <div style="margin-top:14px">${coach('myua', 'excited', '攻撃型だって！ ちからの訓練、いっぱいしようね！', 'みゅあ')}</div>
    <div class="card" style="margin-top:14px"><div class="sub">名前</div><div class="h1" style="background:#0f172a;border-radius:9px;padding:6px 10px;margin-top:3px">もちまる</div></div>
    <span class="btn" style="margin-top:14px">育成をはじめる</span></div>` },
], `<h3>見せたいもの</h3><ul><li>仲良し度の段で「効き◯%・お話◯話」が変わるのを棒で</li><li>解放前は暗い顔+鍵(名前は出さない)</li></ul><h3>動き: 型のくじ</h3><ul><li>型の札が横に流れて回る → 真ん中で止まる <code>mkSpin 1.2s</code>(だんだん遅く)</li><li>止まった瞬間に黄色の枠+✨、曲線が左から描かれる(<code>stroke-dashoffset</code> 0.6秒)</li><li>コーチの一言が <code>mkPop</code>。全部で2秒ほど・タップでとばせる</li></ul>`);

// ---- 4. 育成のメイン(案A=おすすめ・B・C) ----
const dateCard = `<div class="card" style="padding:8px 10px;margin-top:6px"><div class="row"><div class="f1"><span class="h1">2年目 6月 3週</span> <span class="sub">98 / 150週</span></div><span class="chip p">🏆 大会まで あと1週</span></div>${life(98, 150, [45, 70])}<div class="row sub" style="justify-content:space-between;margin-top:3px;font-size:10px"><span>はじまり</span><span class="yel">┗ のびざかり ┛</span><span>引退</span></div></div>`;
const trainGrid = `<div class="tg tall">
  ${tc('❤️', 'ライフ', '+12', [['f', 1]], 'fav')}
  ${tc('💪', 'ちから', '+19', [['d', 1], ['a'], ['c']], 'party', '🎉 みんな集合 ×1.6')}
  ${tc('🧠', 'かしこさ', '+9', [['a', 1]], 'fav')}
  ${tc('🎯', '命中', '+7', [['e']])}
  ${tc('💨', '回避', '+6', [], 'none')}
  ${tc('🛡️', '丈夫さ', '+11', [['b', 1]], 'fav')}</div>`;
const cmdRow = `<div class="cmd"><div>🛌 休む<small>疲れをとる</small></div><div>🎈 遊ぶ<small>ストレスをとる</small></div><div>⚔ 修行<small>4週・あと2回</small></div><div class="off">🏆 大会<small>来週</small></div></div>`;
const mainA = `<div class="in">${hd('💰 名声 320', '中断')}${dateCard}
  <div class="stage" style="height:268px"><img class="mon" src="${M('mocchi.png')}" style="left:2px;bottom:28px;width:186px;height:186px">
    <span class="tag" style="left:40px;bottom:8px">もちまる 😊 ごきげん</span>
    <div style="position:absolute;right:8px;top:8px;width:196px">${coach('myua', 'happy', '今週は ちから にみんな来てるよ！ ちょっと疲れが見えるかな…')}</div>
    <div style="position:absolute;right:8px;bottom:8px;width:196px;background:#0f172acc;border-radius:11px;padding:6px 8px"><div class="row" style="gap:6px"><span class="chip">🤝 忠誠 72</span><span class="chip">⭐ 人気 45</span>${rk('C')}</div>
      <div class="row" style="margin-top:4px"><span class="sub" style="font-size:10px">成長の曲線<br><b class="yel">● いまここ</b></span>${curve(0.65, 108, 40)}</div></div></div>
  <div class="card" style="padding:8px 10px">${sts([412, 506, 233, 380, 198, 441])}</div>
  <div class="tabs y" style="margin-top:8px"><span class="on">💪 軽い訓練</span><span>🔥 重い訓練</span><span style="flex:.7">くわしく見る</span></div>
  ${trainGrid}${cmdRow}</div>`;
const mainB = `<div style="position:absolute;inset:0 0 auto 0;height:520px;background:radial-gradient(ellipse at 50% 90%,#5b4bb0 0,#2a2157 55%,#171230 100%)"></div>
  <div class="in" style="position:relative">${hd('💰 320', '中断')}
  <div class="row" style="margin-top:4px"><span class="h1 f1">2年目 6月 3週</span><span class="chip p">🏆 あと1週</span></div>${life(98, 150, [45, 70])}
  <div style="position:relative;height:372px"><img src="${M('mocchi.png')}" style="position:absolute;left:50%;margin-left:-150px;bottom:0;width:300px;height:300px;object-fit:contain;filter:drop-shadow(0 10px 6px #0009)">
    <div style="position:absolute;left:0;top:10px;width:200px">${coach('myua', 'happy', '今週は ちから にみんな来てるよ！')}</div>
    <div style="position:absolute;right:0;top:86px;display:flex;flex-direction:column;gap:4px;align-items:flex-end">${ST.map((s, i) => `<span class="chip">${s[1]} ${[412, 506, 233, 380, 198, 441][i]}</span>`).join('')}</div>
    <div style="position:absolute;left:0;bottom:6px"><span class="chip">🤝 72</span> <span class="chip">⭐ 45</span></div></div>
  <div class="tabs y"><span class="on">💪 軽い</span><span>🔥 重い</span></div>
  <div style="display:flex;gap:8px;margin-top:8px;width:520px">${[['💪', 'ちから', '+19', [['d', 1], ['a'], ['c']], 'party', '🎉 みんな集合 ×1.6'], ['❤️', 'ライフ', '+12', [['f', 1]], 'fav'], ['🧠', 'かしこさ', '+9', [['a', 1]], 'fav'], ['🛡️', '丈夫さ', '+11', [['b', 1]], 'fav']].map((a, i) =>
    `<div class="tc ${a[4]}" style="width:150px;flex:none;min-height:214px;padding-top:16px">${a[5] ? `<span class="rib">${a[5]}</span>` : ''}<div style="font-size:34px">${a[0]}</div><div class="h1">${a[1]}</div><div class="ex" style="font-size:15px">${a[2]}</div><div class="fs" style="gap:4px;margin-top:8px">${a[3].map(([k, fav]) => cf({ ...CH[k], fav, lg: 1 })).join('')}</div>${i ? '' : '<span class="btn sm" style="margin-top:10px">これにする</span>'}</div>`).join('')}</div>
  <div class="ctr sub" style="margin-top:6px">← 横にめくる →  ● ○ ○ ○ ○ ○</div>${cmdRow}</div>`;
const mainC = `<div class="in">${hd('💰 名声 320', '中断')}
  <div class="card" style="padding:8px;margin-top:6px"><div class="row"><img src="${M('mocchi.png')}" class="ph" style="width:74px;height:74px"><div class="f1"><div class="row"><span class="h2 f1">2年目 6月 3週 <span class="sub">98/150</span></span><span class="chip p">🏆 あと1週</span></div>${life(98, 150, [45, 70])}<div class="row" style="margin-top:6px;gap:5px"><span class="chip">😊 ごきげん</span><span class="chip">🤝 72</span><span class="chip">⭐ 45</span></div></div></div>
  <div style="margin-top:7px">${coach('myua', 'happy', '今週は ちから にみんな来てるよ！ ちょっと疲れが見えるかな…')}</div></div>
  <div class="row sub" style="margin-top:8px;padding:0 4px"><span class="f1">能力と、今週あつまった応援</span><span style="width:122px;text-align:center">訓練する</span></div>
  ${[[412, [['f', 1]], 12, 20], [506, [['d', 1], ['a'], ['c']], 19, 31, 1], [233, [['a', 1]], 9, 15], [380, [['e']], 7, 12], [198, [], 6, 10], [441, [['b', 1]], 11, 18]].map(([v, fs, l, h, party], i) =>
    `<div class="card ${party ? 'pk' : ''}" style="padding:10px 8px;margin-top:7px;${party ? 'background:linear-gradient(90deg,#4a1d5c,#1e1a36)' : ''}"><div class="row"><div class="f1"><div class="row" style="gap:5px"><b style="width:74px" class="nw">${ST[i][1]} ${ST[i][0]}</b><b>${v}</b>${party ? '<span class="chip p">🎉 ×1.6</span>' : ''}</div><div class="bar" style="margin-top:4px"><i style="width:${v / 9.99}%"></i></div><div class="row" style="gap:3px;margin-top:5px;min-height:24px">${fs.length ? fs.map(([k, fav]) => `<span class="cf r${CH[k].r}${fav ? ' fav' : ''}${CH[k].base ? ' base' : ''}" style="width:24px;height:24px"><img src="${T(CH[k].t)}" style="width:24px;height:24px;border-radius:7px"></span>`).join('') : '<span class="sub dim">だれもいない</span>'}</div></div>
    <span class="btn2 sm" style="width:58px;padding:7px 2px">軽い<br><small class="grn">+${l}</small></span><span class="btn2 sm" style="width:58px;padding:7px 2px;background:#7c2d12">重い<br><small class="grn">+${h}</small></span></div></div>`).join('')}
  ${cmdRow}</div>`;

scr('04', '育成のメイン(1週)', 'いちばん長く見る画面。上に日付と寿命の目盛り(のびざかりの帯つき)、モンスターの立ち絵とコーチの一言、6能力・忠誠・人気・曲線の「いまここ」、下に訓練の札(集まった応援の顔が並ぶ)と 休む・遊ぶ・修行・大会。配置を3案ならべた(A がおすすめ)。', [
  { id: '4-A', label: '育成のメイン 案A(おすすめ)', html: mainA },
  { id: '4-B', label: '案B 立ち絵を大きく', html: mainB },
  { id: '4-C', label: '案C 一覧でくらべる', html: mainC },
], `<h3>配置の3案(社長に聞く)</h3><ul><li><b>A(おすすめ)</b>: 上に立ち絵とコーチ、下に訓練の札6枚を全部ならべる。「どの札に何体来ているか」が1画面でくらべられ、1週3〜6秒の速さに合う</li><li><b>B</b>: 立ち絵をいちばん大きく。訓練の札は大きい1枚を横にめくる。かわいさは一番、ただし6枚を見くらべるのに指が要る</li><li><b>C</b>: 能力の一覧がそのまま訓練の入口。軽い/重いを同時に見られて数字に強い。立ち絵は小さくなる</li></ul><h3>訓練の札の見え方</h3><ul><li>得意の子が来た札: 黄色の枠が <code>mkGlow 1.4s</code> でゆっくり光る・顔に ★</li><li>3体以上: ピンクの枠+「🎉 みんな集合」のリボン、顔が順に <code>mkHop .5s</code> ではねる</li><li>だれもいない札は暗く静か</li></ul><h3>立ち絵</h3><ul><li>機嫌で表情の札(😊😐😣)と、ゆっくり上下にゆれる待ちの動き(今のモンスターの待ちの動きを使う)</li><li>疲れているときは立ち絵が少し下がり、色が少しくすむ(<code>filter: saturate(.7)</code>)</li></ul>`);

// ---- 5. 訓練の結果 ----
const resStage = (cutCls, cutSmall, cutBig, monStyle, ups, mood, extra = '') => `<div class="stage" style="height:350px">
  <div class="cut ${cutCls} a-cut" style="top:10px"><small>${cutSmall}</small><b>${cutBig}</b></div>
  <img class="mon a-hop" src="${M('mocchi.png')}" style="left:95px;bottom:44px;width:200px;height:200px;${monStyle}">
  ${ups}${extra}<span class="tag" style="left:50%;transform:translateX(-50%);bottom:10px">もちまる ${mood}</span></div>`;
const cheerBy = `<div style="position:absolute;left:14px;bottom:44px">${cf({ ...CH.d, fav: 1, lg: 1 })}</div><div style="position:absolute;left:44px;bottom:112px">${cf({ ...CH.a, lg: 1 })}</div><div style="position:absolute;right:16px;bottom:52px">${cf({ ...CH.c, lg: 1 })}</div>
  <span class="spark" style="left:66px;top:92px">✨</span><span class="spark" style="right:22px;top:112px">🌟</span><span class="spark" style="right:44px;top:150px">✨</span>`;

scr('05', '訓練の結果', '集まった応援が一緒に動き、伸びた数字が上がる。結果は5種類(大成功・成功・失敗・ズル・サボり)で帯の色と立ち絵の動きを変える。そのあと「📣 叱る」「👏 褒める」を1回(しなくてもよい)。', [
  { id: '5a', label: '結果(大成功)と叱る/褒める', html: `<div class="in">${hd('💰 名声 320', '中断')}
    <div class="row" style="margin-top:6px"><span class="h2 f1">2年目 6月 3週・💪 ちからの軽い訓練</span></div>
    ${resStage('gold', '🎉 みんな集合 ×1.6', '🌟 大成功！', '', `<span class="up a-rise" style="left:230px;top:66px">+30 <small>💪 ちから</small></span>`, '😆', cheerBy)}
    <div class="card" style="padding:8px 10px">${sts([412, 536, 233, 380, 198, 441], [0, 30, 0, 0, 0, 0])}<div class="row sub" style="margin-top:6px"><span class="f1">応援: らいが★ +18%・しずく +18%・ぴくりん +22%・3体そろって +10%</span></div></div>
    <div style="margin-top:8px">${coach('myua', 'excited', 'すごいすごい！ みんなの声が届いたね！', 'みゅあ')}</div>
    <div class="h2 ctr" style="margin-top:12px">声をかける？ <span class="sub">(1回だけ)</span></div>
    <div class="grid2" style="margin-top:8px"><span class="btn2" style="background:#1d4ed8">📣 叱る</span><span class="btn">👏 褒める</span></div>
    <span class="btn3" style="margin-top:8px">なにもしないで次の週へ</span></div>` },
  { id: '5b', label: '5種類の見え方と、褒めたあと', html: `<div class="in">${hd('💰 名声 320', '中断')}
    <div class="sub" style="margin-top:6px">結果の帯(5種類)</div>
    ${[['gold', '🌟 大成功！', '立ち絵がとびはねる・数字は金色で大きく', '+30'], ['', '⭕ 成功', 'うなずく・数字がふつうに上がる', '+19'], ['gray', '❌ 失敗…', 'しょんぼり。数字は小さく白', '+4'], ['sky', '🤫 ズルをした', 'そっぽを向く(叱りどころ)', '+8'], ['gray', '💤 サボった', 'ねころぶ。伸びなし(叱りどころ)', '±0']].map(([c, b, s, n]) =>
      `<div style="position:relative;height:50px;margin-top:6px;border-radius:12px;overflow:hidden;background:#1e1a36;border:1px solid #3b3566"><div class="cut ${c}" style="top:0;bottom:0;left:0;right:60px;padding:5px 14px"><b style="font-size:16px">${b}</b><small>${s}</small></div><b class="yel" style="position:absolute;right:12px;top:13px;font-size:17px">${n}</b></div>`).join('')}
    <div class="sub" style="margin-top:12px">「👏 褒める」を押したあと(合っていたとき)</div>
    <div class="stage" style="height:190px"><img class="mon a-hop" src="${M('mocchi.png')}" style="left:26px;bottom:20px;width:140px;height:140px">
      <span class="spark" style="left:150px;top:26px;font-size:26px">💗</span><span class="spark" style="left:28px;top:30px">💗</span>
      <div style="position:absolute;right:10px;top:16px;width:190px">${coach('myua', 'wink', 'うん、いまのは褒めどき！ うれしそうだよ')}</div>
      <div style="position:absolute;right:10px;bottom:14px;text-align:right"><span class="chip g a-pop">🤝 忠誠 +3</span><br><span class="chip a-pop" style="margin-top:4px">方針: やさしめ へ少し</span></div></div>
    <div class="sub" style="margin-top:10px">「📣 叱る」が合っていなかったとき</div>
    <div class="card sk"><div class="row"><img src="${M('mocchi.png')}" class="ph a-shake" style="width:54px;height:54px;filter:saturate(.6)"><div class="f1">${coach('myua', 'troubled', 'がんばったのに叱られて、しゅんとしちゃった…')}</div></div><div style="margin-top:6px"><span class="chip">🤝 忠誠 −2</span> <span class="chip">ストレスが少したまった</span></div></div>
    </div><div class="ft"><span class="btn">次の週へ →</span></div>` },
], `<h3>動き: 結果(合わせて約1.5秒)</h3><ul><li>帯が左からすべりこむ <code>mkCut .22s</code>(観戦の技の帯と同じ動き)</li><li>応援の顔が1体ずつ <code>mkHop</code> ではねながら立ち絵に寄る</li><li>伸びた数字が立ち絵の上へ <code>mkRise .9s</code>。下の棒が同時に右へ伸びる(<code>width</code> .35s)</li><li><b>大成功</b>: 金の帯・✨が散る・画面が一瞬白く光る(<code>opacity</code> .15s)・数字は 1.3倍</li><li>失敗・サボり: 立ち絵が <code>mkShake</code> か沈む・色をくすませる</li></ul><h3>動き: 叱る/褒める</h3><ul><li>褒める: 💗 が2つ浮く・立ち絵がはねる・「忠誠 +」の札が <code>mkPop</code></li><li>叱る: 📣 の線が立ち絵に当たる → <code>mkShake .4s</code>。合っていれば「しゃきっ」と背がのびる、外れなら色がくすむ</li><li>合っていた/いなかったはコーチの一言で伝える(数字は札で小さく)</li></ul>`);

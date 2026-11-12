// 画面 6〜10(ごはん・修行・イベント・けが/病気/家出・大会・引退)
scr('06', '月のはじめ(ごはん)と修行(4週)', '月のはじめに「ごはん」を3つから選ぶ。修行は 行き先を選ぶ → 途中のできごと → 覚えた技 の3コマ。', [
  { id: '6a', label: '月のはじめ(ごはん)', html: `<div class="in">${hd('💰 名声 320', '中断')}
    <div class="ctr" style="margin-top:10px"><span class="chip p">2年目 7月 のはじまり</span></div>
    <div class="h1 ctr" style="margin-top:8px">今月のごはんは？</div>
    <div class="stage" style="height:200px"><img class="mon" src="${M('mocchi.png')}" style="left:22px;bottom:16px;width:150px;height:150px">
      <span class="spark" style="left:150px;top:44px;font-size:30px">🍽️</span>
      <div style="position:absolute;right:10px;top:22px;width:190px">${coach('myua', 'happy', 'よく動いた月だったね。おいしいもの、食べさせたいな〜')}</div></div>
    ${[['🍙', 'かんたんごはん', '名声 0', 'おなかはふくれる', ''], ['🍱', 'ふつうのごはん', '名声 20', '忠誠が少し上がる', ''], ['🍖', 'ごちそう', '名声 60', '忠誠が上がる・ストレスがよくとれる', 'yl']].map(([i, n, c, e, cl]) =>
      `<div class="card ${cl}"><div class="row"><span style="font-size:34px">${i}</span><div class="f1"><div class="h2">${n}</div><div class="sub">${e}</div></div><span class="chip ${cl ? 'on' : ''}">💰 ${c}</span></div></div>`).join('')}
    <div class="sub ctr" style="margin-top:8px">名声は大会で勝つと増えます</div>
    </div><div class="ft"><span class="btn">🍖 ごちそうにする</span></div>` },
  { id: '6b', label: '修行(4週)', html: `<div class="in">${hd('💰 名声 320', '中断')}
    <div class="sub" style="margin-top:6px">① 行き先をえらぶ(年に2回まで・4週かかる)</div>
    <div class="grid3" style="margin-top:6px">${[['forest_deep', '森の奥', '💨 すばやい技', 1], ['desert_hall', '砂の闘技場', '💪 ちからの技'], ['dark_void', '星の洞くつ', '🧠 かしこさの技']].map(([b, n, t, on]) =>
      `<div style="border-radius:12px;overflow:hidden;border:1.5px solid ${on ? '#fde047' : '#475569'};background:#0f172a"><img src="${BG(b)}" style="width:100%;height:58px;object-fit:cover"><div class="ctr" style="padding:4px 2px 6px"><b style="font-size:12px">${n}</b><div class="sub" style="font-size:10px">${t}</div></div></div>`).join('')}</div>
    <div class="sub" style="margin-top:12px">② 修行のあいだ(1週ずつ進む)</div>
    <div class="stage" style="height:214px"><img class="bgimg" src="${BG('forest_deep')}"><div class="shade"></div>
      <img class="mon" src="${M('mocchi.png')}" style="left:120px;bottom:38px;width:140px;height:140px">
      <div style="position:absolute;left:10px;right:10px;top:10px" class="row"><span class="chip on">3週目 / 4週</span><div class="dots"><i class="ok"></i><i class="ok"></i><i class="on"></i><i></i></div></div>
      <div style="position:absolute;left:10px;right:10px;bottom:8px;background:#0f172acc;border-radius:10px;padding:5px 9px;font-size:11.5px">🍃 木の葉をよける練習で、身のこなしが良くなってきた <b class="grn">💨 回避 +6</b></div></div>
    <div class="sub" style="margin-top:12px">③ 帰ってきた</div>
    <div class="card yl ctr" style="padding:14px 10px"><div class="sub yel">✨ 新しい技を覚えた！</div>
      <div class="a-pop" style="font-size:24px;font-weight:900;letter-spacing:.06em;margin:4px 0">💨 はっぱがえし</div>
      <div><span class="chip">回避の技</span> <span class="chip">ガッツ 14</span> <span class="chip">近・中</span></div>
      <div class="sub" style="margin-top:6px">❤️ ライフ +8 💨 回避 +21 🎯 命中 +9</div></div>
    <div style="margin-top:8px">${coach('myua', 'excited', 'おかえり！ なんだか動きが軽くなってる！', 'みゅあ')}</div>
    </div>` },
], `<h3>見せたいもの</h3><ul><li>ごはんは3枚の札。高いほど効きが良いことを1行で</li><li>修行は行き先の景色で選ぶ(覚える技の系統を1行)</li><li>4週ぶんの進みは点4つ。1週ごとに短いできごとが1行</li></ul><h3>動き</h3><ul><li>ごはん: 選ぶと 🍽️ が立ち絵へ飛び、立ち絵が <code>mkHop</code> で1回はねる。忠誠の札が <code>mkPop</code></li><li>修行: 景色がゆっくり横に流れる(<code>background-position</code> 8秒)。点が1つずつ緑に</li><li>覚えた技: 札が <code>mkPop .45s</code>+黄色の枠が <code>mkGlow</code>。技名は1文字ずつ出す</li></ul>`);

scr('07', 'イベント', 'コーチとモンスターの掛け合い → 2択 → 上がった物。助手ライフの「できごと」と同じ見せ方(景色+立ち絵+ふきだし)に合わせる。', [
  { id: '7', label: 'イベント(掛け合い→2択→上がった物)', html: `<img class="bgimg" src="${BG('monhero_plaza')}"><div class="shade" style="background:linear-gradient(180deg,#0f0d2466 0,#0f0d2400 30%,#0f0d24ee 62%)"></div>
    <div class="in" style="position:relative">${hd('1 / 4話', 'とばす', '💗 みゅあのお話')}
    <div class="ctr" style="margin-top:8px"><span class="chip p">いっしょに出かける</span></div></div>
    <img src="${BODY('mua__happy')}" style="position:absolute;right:-30px;top:120px;height:430px;filter:drop-shadow(0 8px 8px #0009)">
    <img src="${M('mocchi.png')}" style="position:absolute;left:10px;top:330px;width:190px;height:190px;object-fit:contain;filter:drop-shadow(0 8px 6px #0009)">
    <div style="position:absolute;left:12px;right:12px;top:520px">
      <div class="bub" style="font-size:13.5px;padding:10px 12px"><span style="color:#be185d">みゅあ</span><br>きょうは訓練おやすみ！ 広場にお店が出てるんだって。もちまる、どっちに行きたい？</div>
      <div class="bub" style="margin-top:6px;background:#fef9c3;width:70%"><span style="color:#a16207">もちまる</span>　もちっ！(そわそわ)</div>
      <div class="btn2" style="margin-top:10px;background:#1e293b;border:1.5px solid #f472b6;text-align:left">🍡 おだんごの屋台へ行く</div>
      <div class="btn2" style="margin-top:7px;background:#1e293b;border:1.5px solid #38bdf8;text-align:left">🎯 まとあての屋台へ行く</div>
      <div class="sub" style="margin-top:10px">▼ えらんだあと(上がった物が札で出る)</div>
      <div class="row wrap" style="margin-top:4px;gap:5px"><span class="chip g a-pop">🤝 忠誠 +4</span><span class="chip g a-pop">ストレスがとれた</span><span class="chip p a-pop">💗 みゅあと仲良くなった</span></div>
    </div>` },
], `<h3>見せたいもの</h3><ul><li>景色の上にコーチの立ち絵とモンスター。モンスターは短い声+しぐさ</li><li>2択は色ちがいの枠。どちらが得かは書かない</li><li>上がった物は緑の札で下に並ぶ(数字は小さく)</li></ul><h3>動き</h3><ul><li>はじまり: 景色がふわっと出る(<code>opacity</code> .4s)→ 立ち絵が右から入る</li><li>ふきだしは文字送り。タップで全部出る</li><li>選んだ札が光り、もう1枚は消える → 札が1枚ずつ <code>mkPop</code></li><li>コーチの表情は答えで変わる(今ある8つの表情を使う)</li></ul>`);

scr('08', 'けが・病気・家出', '重すぎない見せ方。画面を赤くしない・立ち絵は小さな絵文字の印で伝える・「何週休むか」を点で見せ、コーチがやわらかく伝える。', [
  { id: '8', label: 'けが・病気・家出の知らせ', html: `<div class="in">${hd('💰 名声 320', '中断')}
    <div class="card sk" style="margin-top:10px;padding:14px 12px">
      <div class="ctr"><span class="chip s">🩹 けがをした</span></div>
      <div class="ctr" style="position:relative;height:150px;margin-top:6px"><img src="${M('mocchi.png')}" class="a-shake" style="width:150px;height:150px;object-fit:contain;margin:0 auto;filter:saturate(.75)"><span style="position:absolute;left:214px;top:22px;font-size:30px">🩹</span></div>
      ${coach('myua', 'troubled', '足をひねっちゃったみたい…。しばらくお休みして、ちゃんと治そうね', 'みゅあ')}
      <div class="row" style="margin-top:10px;justify-content:center"><span class="sub">お休み</span><div class="dots"><i class="on"></i><i class="on"></i><i class="on"></i></div><b class="yel">あと3週</b></div>
      <div class="sub ctr" style="margin-top:4px">お休みの間は訓練できません・寿命が1週へります</div></div>
    <div class="sub" style="margin-top:12px">病気・家出も同じ形(色と印だけ変える)</div>
    <div class="card" style="border-color:#a78bfa"><div class="row"><span style="font-size:30px">🤒</span><div class="f1"><div class="h2">かぜをひいた</div><div class="sub">あたたかくして、ゆっくり休もう</div></div><div class="ctr"><div class="dots"><i class="on"></i><i class="on"></i></div><b class="yel" style="font-size:11px">あと2週</b></div></div></div>
    <div class="card" style="border-color:#fb923c"><div class="row"><span style="font-size:30px">🎒</span><div class="f1"><div class="h2">ぷいっと出ていった</div><div class="sub">気がすんだら帰ってくるよ。少し待とう</div></div><div class="ctr"><div class="dots"><i class="on"></i></div><b class="yel" style="font-size:11px">あと1週</b></div></div></div>
    <div class="sub" style="margin-top:12px">治った週</div>
    <div class="card" style="border-color:#34d399"><div class="row"><img src="${M('mocchi.png')}" class="ph a-hop" style="width:54px;height:54px"><div class="f1">${coach('myua', 'happy', 'すっかり元気！ また一緒にがんばろ！')}</div></div></div>
    </div><div class="ft"><span class="btn">🛌 休ませる(次の週へ)</span></div>` },
], `<h3>見せ方の決め</h3><ul><li>赤い警告・大きな×は使わない。水色・むらさき・オレンジのやわらかい枠</li><li>立ち絵は色を少しくすませ、🩹🤒🎒 の印を1つ添えるだけ</li><li>お休みの週はオレンジの点。治ったら緑になって消える</li><li>コーチが ソラシド なら「起きやすさ ◯%」の札が育成のメインに出る(けがの前に気づける)</li></ul><h3>動き</h3><ul><li>知らせの札が下から出る(<code>translateY</code> .3s)。立ち絵が小さく <code>mkShake</code> 1回</li><li>家出: 立ち絵が右へ歩いて消える(<code>translateX</code> 1秒)→ 帰る週に左から戻る</li><li>お休みの週は「🛌 休ませる」1つだけ。1タップで次の週(1〜2秒)</li></ul>`);

// ---- 9. 大会 ----
const side = (cls, who, face, mon, nm, hp, mx, g, chips) => `<div class="card ${cls}" style="padding:9px"><div class="row"><img class="fc" src="${face}" style="width:36px;height:36px"><div class="f1"><div class="sub">${who}</div><b style="font-size:14px">${nm}</b></div></div>
  <div class="row" style="margin-top:6px"><b style="width:74px;font-size:13px" class="nw">${mon}</b><div class="f1"><div class="bar g" style="height:10px"><i style="width:${hp / mx * 100}%"></i></div><div class="bar" style="height:6px;margin-top:4px"><i style="width:${g}%;background:linear-gradient(90deg,#fde047,#facc15)"></i></div></div><div style="width:74px;text-align:right;font-size:14px;font-weight:900;line-height:1.15">${hp}<small class="dim" style="font-size:10px">/${mx}</small><br><span class="yel" style="font-size:11px">ガッツ ${g}</span></div></div>
  <div class="row" style="gap:4px;margin-top:6px">${chips.map(([n, s, use]) => `<span class="f1 ctr" style="font-size:10px;font-weight:800;border-radius:8px;padding:3px 2px;line-height:1.3;${use ? 'background:#fde047;color:#422006;border:1px solid #fde047' : 'background:#3b2f0b;border:1px solid #fde047'}">${n}<br><small>${s}</small></span>`).join('')}</div></div>`;

scr('09', '大会', '案内 → 相手の紹介 → 観戦(助手マスモン対戦の観戦の見た目そのまま)→ 勝ち負け・大会ランクが上がる演出。', [
  { id: '9a', label: '大会の案内と相手の紹介', html: `<div class="in">${hd('💰 名声 320', '中断')}
    <div class="card yl ctr" style="margin-top:8px;padding:12px"><div class="sub yel">2年目 6月 4週</div><div class="h1" style="font-size:20px">🏆 昇格戦 ${rk('C', 1)} → ${rk('B', 1)}</div><div class="sub" style="margin-top:3px">勝てば大会ランクが1つ上がります</div></div>
    <div class="stage" style="height:270px"><img class="mon" src="${M('mocchi.png')}" style="left:8px;bottom:52px;width:150px;height:150px">
      <img class="mon" src="${M('golem.png')}" style="right:8px;bottom:52px;width:160px;height:160px;transform:scaleX(-1)">
      <b style="position:absolute;left:50%;top:92px;transform:translateX(-50%);font-size:38px;font-style:italic;color:#fde047;text-shadow:0 3px 0 #b91c1c">VS</b>
      <span class="tag" style="left:38px;bottom:28px">もちまる</span><span class="tag" style="right:38px;bottom:28px">いわお</span>
      <span class="tag" style="left:22px;bottom:6px;background:none" >${rk('C')} 攻撃型</span><span class="tag" style="right:22px;bottom:6px;background:none">${rk('B')} 防御型</span></div>
    <div class="card"><div class="h2">相手: いわお <span class="sub">ゴーレム・Bクラスの常連</span></div>
      <table class="t" style="margin-top:4px"><tr><td>❤️ ライフ</td><td class="pnk">412</td><td class="sky">588</td><td style="width:92px">🛡️ 丈夫さ</td><td class="pnk">441</td><td class="sky">602</td></tr><tr><td>💪 ちから</td><td class="pnk">536</td><td class="sky">470</td><td>🎯 命中</td><td class="pnk">380</td><td class="sky">300</td></tr></table></div>
    <div style="margin-top:8px">${coach('atsu', 'excited', 'かたい相手だ。だが当たれば勝てる！ 気合を入れていくぞ！', 'あつ')}</div>
    <div style="margin-top:6px"><span class="chip on">🔥 気合(はじめのガッツ +10)</span></div>
    </div><div class="ft"><div class="grid2"><span class="btn3">今回は見おくる</span><span class="btn">⚔ 出場する</span></div></div>` },
  { id: '9b', label: '観戦(今の観戦の見た目)', html: `<div class="in">${hd('ラウンド 3', '中断', '⚔️ 昇格戦 C→B')}
    ${side('sk', '奥・相手', T('golem'), 'いわお', 'Bクラスの常連', 402, 588, 38, [['💪 いわなげ', 'ガッツ18・中'], ['🛡️ かまえ', 'ガッツ10・零近']])}
    <div class="stage" style="height:238px;margin-top:8px"><div class="cut pow a-cut" style="top:8px"><small>💪 ちから技・命中 78%</small><b>もちパンチ</b></div>
      <img class="mon" src="${M('mocchi.png')}" style="left:76px;bottom:44px;width:104px;height:104px">
      <img class="mon a-shake" src="${M('golem.png')}" style="right:76px;bottom:44px;width:108px;height:108px;transform:scaleX(-1)">
      <span class="up a-pop" style="right:66px;top:60px;font-size:27px">−96</span>
      <span class="tag" style="left:96px;bottom:26px">もちまる</span><span class="tag" style="right:100px;bottom:26px">いわお</span>
      <div style="position:absolute;bottom:4px;left:50%;transform:translateX(-50%);display:flex;gap:4px"><span class="chip">零</span><span class="chip on">近</span><span class="chip">中</span><span class="chip">遠</span></div></div>
    ${side('pk', '手前・あなた', F('atsu'), 'もちまる', 'コーチ: あつ', 265, 412, 52, [['💪 もちパンチ', 'ガッツ15・零近', 1], ['💨 はっぱがえし', 'ガッツ14・近中']])}
    <div class="card" style="padding:8px"><p style="margin:2px 0;font-size:11px;color:#cbd5e1;padding-left:6px;border-left:3px solid #f472b6">R3 もちまる の もちパンチ！ 96</p><p style="margin:2px 0;font-size:11px;color:#cbd5e1;padding-left:6px;border-left:3px solid #38bdf8">R2 いわお は かまえた</p>
      <div style="margin-top:5px">${coach('atsu', 'happy', 'いいぞ、その距離だ！')}</div></div>
    <div class="bar p" style="margin-top:12px"><i style="width:34%"></i></div>
    <div class="row" style="justify-content:center;gap:6px;margin-top:10px"><span class="btn2 sm">▶</span><span class="chip on" style="padding:7px 13px">×1</span><span class="chip" style="padding:7px 13px">×2</span><span class="chip" style="padding:7px 13px">×4</span><span class="chip" style="padding:7px 13px">★ 見せ場だけ</span></div>
    <div class="ctr" style="margin-top:8px"><span class="btn2 sm" style="display:inline-block">⏭ 結果へ</span></div></div>` },
  { id: '9c', label: '勝ち・大会ランクが上がる', html: `<div class="in">${hd('💰 名声 320', '中断')}
    <div class="stage" style="height:330px;margin-top:10px;background:radial-gradient(ellipse at 50% 60%,#b45309 0,#4c1d95 50%,#171230 100%)">
      <div class="ctr a-pop" style="position:absolute;left:0;right:0;top:14px;font-size:40px;font-weight:900;letter-spacing:.1em;color:#fde047;text-shadow:0 3px 0 #b91c1c,0 0 14px #f97316">WIN!</div>
      <img class="mon a-hop" src="${M('mocchi.png')}" style="left:95px;bottom:36px;width:200px;height:200px">
      <span class="spark" style="left:44px;top:96px;font-size:26px">🎉</span><span class="spark" style="right:44px;top:110px;font-size:26px">🎊</span><span class="spark" style="left:70px;bottom:60px">✨</span><span class="spark" style="right:76px;bottom:80px">✨</span>
      <span class="tag" style="left:50%;transform:translateX(-50%);bottom:10px">もちまる 😆</span></div>
    <div class="card yl ctr" style="padding:14px"><div class="sub yel">大会ランクが上がった！</div>
      <div class="row" style="justify-content:center;gap:14px;margin-top:6px"><span style="opacity:.45;transform:scale(.9)">${rk('C', 1)}</span><b class="yel" style="font-size:20px">▶▶</b><span class="a-pop" style="transform:scale(1.9);margin:8px 14px;display:inline-block">${rk('B', 1)}</span></div>
      <div class="sub" style="margin-top:8px">Bクラスの大会に出られるようになりました</div></div>
    <div class="row wrap" style="margin-top:8px;gap:5px;justify-content:center"><span class="chip g">💰 名声 +120</span><span class="chip g">⭐ 人気 +8</span><span class="chip g">🤝 忠誠 +2</span></div>
    <div style="margin-top:10px">${coach('atsu', 'excited', 'やったな！ 次はもっと上だ！', 'あつ')}</div>
    <div class="sub ctr" style="margin-top:12px">負けたとき: 帯は灰色で「おしい…」・立ち絵はしょんぼり・コーチがはげます(ランクはそのまま)</div>
    </div><div class="ft"><span class="btn">次の週へ →</span></div>` },
], `<h3>見せたいもの</h3><ul><li>案内: どの大会か・勝つと何が起きるかを1枚の札で。相手とは6能力のうち目立つ4つをくらべる</li><li>観戦: <b>今の助手マスモン対戦の観戦と同じ部品</b>(上下の札・まんなかの舞台・技の帯・距離・速さ・見せ場だけ・結果へ)。違いは助手の顔の代わりに相手の顔が入ることだけ</li></ul><h3>動き: ランクが上がる(約2秒)</h3><ul><li>WIN! が <code>mkPop .45s</code>、紙ふぶきが上から降る(<code>translateY</code> 1.5秒・8〜10個)</li><li>古いランクの札が左へ薄くなり、新しい札が <code>scale(3)→(1.9)</code> で「どん」と落ちる+枠が <code>mkGlow</code></li><li>名声・人気の札が順に <code>mkPop</code></li><li>ふつうのクラス戦の勝ちは WIN! と札だけ(1秒)。速送りの人のため、ぜんぶタップでとばせる</li></ul>`);

// ---- 10. 引退 ----
const lineG = () => { const pts = [[0, 60], [30, 54], [60, 44], [90, 30], [120, 20], [150, 14], [180, 11], [210, 10]]; return `<svg width="340" height="72" viewBox="0 0 220 72" preserveAspectRatio="none"><path d="M${pts.map((p) => p.join(',')).join('L')}" fill="none" stroke="#f472b6" stroke-width="2.2"/><path d="M0,64L40,60L80,52L120,40L160,34L210,30" fill="none" stroke="#38bdf8" stroke-width="2.2"/><path d="M0,66L60,62L120,58L210,50" fill="none" stroke="#a3e635" stroke-width="2.2"/></svg>`; };
scr('10', '引退', '寿命が来た知らせ → 振り返り(能力の伸びの線・大会の成績・コーチの一言)→ 育成ランク(G〜M)と「集まりやすい能力」が決まる演出 → 保存枠へ。さびしくしすぎず、「次の子の応援になる」前向きな終わり方。', [
  { id: '10a', label: '寿命の知らせと振り返り', html: `<div class="in">${hd('150 / 150週', '', '🌱 モンヒロサクセス')}
    <div class="stage" style="height:176px;margin-top:8px"><img class="bgimg" src="${BG('monhero_plaza_evening')}"><div class="shade"></div>
      <img class="mon" src="${M('mocchi.png')}" style="left:16px;bottom:10px;width:140px;height:140px">
      <div style="position:absolute;right:10px;top:14px;width:200px"><div class="h2 yel">3年目 12月 4週</div><div class="h1" style="margin-top:2px">もちまる の育成が<br>おわりました</div><div class="sub" style="margin-top:4px">おつかれさま。ここからは保存枠で、次の子を支えます</div></div></div>
    <div class="card"><div class="row"><span class="h2 f1">📈 能力の伸び</span><span class="sub"><b class="pnk">━</b> ちから <b class="sky">━</b> ライフ <b class="grn">━</b> ほか</span></div>${lineG()}
      <div style="margin-top:4px">${sts([588, 742, 301, 520, 266, 590])}</div></div>
    <div class="card"><div class="h2">🏆 大会の成績</div>
      <table class="t" style="margin-top:3px"><tr><td>出た大会</td><td>31回</td><td style="width:90px">勝ち</td><td class="yel">22回</td></tr><tr><td>大会ランク</td><td>${rk('A')}</td><td>大きな大会</td><td class="yel">準優勝</td></tr><tr><td>🤝 忠誠</td><td>88</td><td>⭐ 人気</td><td>71</td></tr></table></div>
    <div style="margin-top:8px">${coach('myua', 'crying', 'さいごまで、よくがんばったね…！ いっしょに育てられて、たのしかった！', 'みゅあ')}</div>
    </div><div class="ft"><span class="btn">育成ランクを見る →</span></div>` },
  { id: '10b', label: '育成ランクと集まりやすい能力が決まる', html: `<div class="in">${hd('150 / 150週', '', '🌱 モンヒロサクセス')}
    <div class="stage" style="height:356px;margin-top:8px;background:radial-gradient(ellipse at 50% 46%,#f472b6 0,#6d28d9 38%,#171230 78%)">
      <div class="ctr sub" style="position:absolute;left:0;right:0;top:14px;color:#fff">もちまる の育成ランクは…</div>
      <div class="a-pop" style="position:absolute;left:50%;top:44px;margin-left:-62px;width:124px;height:124px;border-radius:30px;background:#f472b6;border:5px solid #fff;display:flex;align-items:center;justify-content:center;font-size:84px;font-weight:900;color:#1e1b4b;box-shadow:0 0 34px #f472b6,0 8px 0 #9d174d">A</div>
      <span class="spark" style="left:66px;top:60px;font-size:24px">✨</span><span class="spark" style="right:64px;top:74px;font-size:24px">🌟</span><span class="spark" style="left:92px;top:160px">✨</span><span class="spark" style="right:90px;top:150px">✨</span>
      <img class="mon" src="${M('mocchi.png')}" style="left:125px;bottom:30px;width:140px;height:140px">
      <span class="tag" style="left:50%;transform:translateX(-50%);bottom:8px">総合力 3,007</span></div>
    <div class="row" style="justify-content:center;gap:3px;margin-top:8px">${['G', 'F', 'E', 'D', 'C', 'B', 'A', 'S', 'SS', 'SSS', 'M'].map((r) => `<span style="${r === 'A' ? 'transform:scale(1.35);margin:0 5px' : 'opacity:.4'}">${rk(r)}</span>`).join('')}</div>
    <div class="card yl ctr" style="padding:12px"><div class="sub yel">集まりやすい能力が決まった</div>
      <div class="a-pop" style="font-size:22px;font-weight:900;margin-top:2px">💪 ちから</div>
      <div class="sub">いちばん高く育った能力です。応援に入ると <b class="yel">ちからの訓練</b> によく顔を出します</div>
      <div class="row" style="justify-content:center;margin-top:6px">${cf({ t: 'mocchi', r: 'A', fav: 1, lg: 1 })}<span class="yel" style="font-size:18px;font-weight:900">応援の効き +18%</span></div></div>
    <div class="row wrap" style="margin-top:8px;gap:5px;justify-content:center"><span class="chip p">💗 みゅあの仲良し度が少し上がった</span></div>
    </div><div class="ft"><span class="btn">📦 保存枠へ入れる</span></div>` },
], `<h3>見せたいもの</h3><ul><li>知らせは夕方の景色でしずかに。「消える」ではなく「次の子を支える」</li><li>振り返りは線・大会の成績・コーチの一言の3段</li><li>ランクは大きな1文字。下に G〜M の並びで位置がわかる</li><li>集まりやすい能力と応援の効きを、応援の顔の形で見せる(次の育成でこう見える、の予告)</li></ul><h3>動き: ランクが決まる(約3秒)</h3><ul><li>暗くなる → G から順に札が光って上がっていく(<code>mkGlow</code> を0.15秒ずつ)→ 決まった所で止まる</li><li>大きな札が <code>scale(0)→(1.25)→(1)</code> <code>mkPop .45s</code>、後ろの光が広がる(<code>radial-gradient</code> の大きさ 0.6秒)</li><li>S 以上は金、M は虹の帯が流れる(<code>background-position</code> 2秒くり返し)</li><li>つづけて「集まりやすい能力」の札が下から出て、能力の名前が <code>mkPop</code></li><li>「保存枠へ入れる」→ 顔の札になって下へ吸いこまれる(<code>scale(.3)+translateY</code> .5秒)</li></ul>`);

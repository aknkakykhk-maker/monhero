// 画面 11〜14(保存枠・合体・サクセス杯・入口)
const box = [['mocchi', 'A', 'もちまる', '💪', 1, 1], ['undine', 'A', 'しずく', '🧠', 2], ['pixie', 'S', 'ぴくりん', '💨', 3], ['golem', 'B', 'がんてつ', '🛡️', 1], ['tiger', 'C', 'らいが', '💪', 1], ['yaobikuni', '', 'うみか', '🧠', 3], ['ghost', 'D', 'ごーくん', '❤️', 1], ['zan', 'SS', 'ざんざん', '🎯', 4], ['plant', 'E', 'はなこ', '❤️', 1], ['kyubi', 'M', 'こはく', '🧠', 6], ['mitarashi', 'B', 'みたらし', '💪', 2], ['dreamy', '', 'ゆめの', '💨', 2]];
const RC = { G: '#94a3b8', F: '#94a3b8', E: '#4ade80', D: '#2dd4bf', C: '#38bdf8', B: '#a78bfa', A: '#f472b6', S: '#fbbf24', SS: '#fb923c', SSS: '#f87171', M: '#fde047', '': '#64748b' };
const boxCell = ([t, r, n, fav, gen, on]) => `<div style="position:relative;background:#0f172a;border:2.5px ${r ? 'solid' : 'dashed'} ${RC[r]};border-radius:13px;padding:4px 3px 5px;text-align:center;${on ? 'box-shadow:0 0 0 2px #fff,0 0 14px #fde047' : ''}${r === 'M' ? ';box-shadow:0 0 12px #fde047aa' : ''}">
  <img src="${T(t)}" style="width:100%;aspect-ratio:1;border-radius:9px;object-fit:cover">
  <span style="position:absolute;left:3px;top:3px">${r ? rk(r) : '<span class="chip p" style="font-size:9px;padding:0 5px">未育成</span>'}</span>
  <span style="position:absolute;right:3px;top:3px;font-size:13px">${fav}</span>
  <div class="nw" style="font-size:10.5px;font-weight:900;margin-top:2px">${n}</div><div class="sub" style="font-size:9.5px">${gen}代目</div></div>`;

scr('11', '保存枠', '子の並び(ランクの色の枠・◯代目・集まりやすい能力)と、くわしい画面。できることは子の状態で変わる: 未育成の合体の子は「育てる」、引退した子は「応援に入れる・貸し出しにする・バトルに出す・サクセス杯へ・合体する」。', [
  { id: '11a', label: '保存枠(並び)', html: `<div class="in">${hd('12 / 30体', 'もどる', '📦 保存枠')}
    <div class="tabs y"><span class="on">ぜんぶ</span><span>引退した子</span><span>未育成 <b>2</b></span><span>思い出</span></div>
    <div class="row" style="margin-top:8px"><span class="sub f1">ならび: ランクの高い順 ▼</span><span class="chip">🤝 貸し出し中: ぴくりん</span></div>
    <div class="grid4" style="margin-top:8px">${box.map(boxCell).join('')}</div>
    <div class="card" style="margin-top:10px;padding:8px 10px"><div class="row"><span class="sub f1">枠の色 = 育成ランク</span>${['E', 'C', 'B', 'A', 'S', 'M'].map((r) => rk(r)).join(' ')}</div><div class="sub" style="margin-top:3px">右上の印 = 集まりやすい能力 / 点線 = 合体で生まれた未育成の子</div></div>
    <div class="card dash"><div class="row"><span class="sub f1">引退10回ごとに枠が +5(最大60体)</span><span class="chip">あと4回</span></div><div class="bar g" style="margin-top:5px"><i style="width:60%"></i></div></div>
    </div><div class="ft"><div class="grid2"><span class="btn2">✨ 合体する</span><span class="btn">🌱 新しく育てる</span></div></div>` },
  { id: '11b', label: 'くわしい画面(引退した子)', html: `<div class="in">${hd('12 / 30体', '保存枠へ', '📦 保存枠')}
    <div class="card pk" style="margin-top:8px"><div class="row" style="align-items:flex-start"><img src="${M('mocchi.png')}" class="ph" style="width:118px;height:118px">
      <div class="f1"><div class="row"><span class="h1">もちまる</span>${rk('A', 1)}</div><div class="sub">モッチー・1代目・📈 攻撃型</div>
      <div style="margin-top:5px"><span class="chip on">💪 ちから によく来る</span></div><div style="margin-top:4px"><span class="chip">応援の効き +18%</span></div>
      <div style="margin-top:4px"><span class="chip p">🏆 大きな大会 準優勝</span></div></div></div>
      <div style="margin-top:8px">${sts([588, 742, 301, 520, 266, 590])}</div>
      <div class="row wrap" style="margin-top:8px;gap:5px"><span class="chip">💪 もちパンチ</span><span class="chip">💨 はっぱがえし</span><span class="chip">🛡️ まるまり</span><span class="sub">コーチ: みゅあ・総合力 3,007</span></div></div>
    <div class="h2" style="margin-top:12px">この子でできること</div>
    <div class="grid2" style="margin-top:6px">
      <span class="btn" style="font-size:13px">📣 応援に入れる</span><span class="btn2" style="font-size:13px">🤝 貸し出しにする</span>
      <span class="btn2" style="font-size:13px">⚔ バトルに出す</span><span class="btn2" style="font-size:13px">🏆 サクセス杯へ</span></div>
    <span class="btn2" style="margin-top:8px;background:#4c1d95;font-size:13px">✨ 合体する(主の親にする)</span>
    <div class="sub ctr" style="margin-top:8px">⋯ お別れする(「思い出」に名前とランクが残ります)</div>
    <div class="sub" style="margin-top:14px">未育成の合体の子のときは、ボタンが1つだけ</div>
    <div class="card dash"><div class="row"><img src="${T('yaobikuni')}" style="width:46px;height:46px;border-radius:10px"><div class="f1"><div class="row"><b>うみか</b><span class="chip p">3代目</span><span class="chip">未育成</span></div><div class="sub">親: しずく × もちまる</div></div><span class="btn sm">🌱 育てる</span></div></div>
    </div>` },
], `<h3>見せたいもの</h3><ul><li>ランクは枠の色(M は光る)。ひと目で「強い子がどこにいるか」</li><li>右上に集まりやすい能力の印 → 応援の編成を考えやすい</li><li>未育成の合体の子は点線の枠+「未育成」。押すと「育てる」だけ</li><li>お別れは目立たせない(小さな文字・2回確かめる)</li></ul><h3>動き</h3><ul><li>札を押す → くわしい画面が下からせり上がる(<code>translateY</code> .25s)</li><li>新しく入った子は NEW の札と <code>mkGlow</code>(1回見たら消える)</li><li>「応援に入れる」→ 小さな顔が編成の枠へ飛ぶ</li></ul>`);

const par = (t, r, n, sp, role, cls) => `<div class="card ${cls}" style="margin:0;padding:8px;text-align:center"><div class="sub">${role}</div><img src="${M(t)}" style="width:96px;height:96px;object-fit:contain;margin:2px auto"><div class="row" style="justify-content:center;gap:5px">${rk(r)}<b>${n}</b></div><div class="sub">${sp}</div></div>`;
const fuseTop = `<div class="row" style="margin-top:8px;gap:6px">${par('undine.PNG', 'A', 'しずく', 'ウンディーネ・2代目', '主の親', 'pk')}<b class="yel" style="font-size:22px">＋</b>${par('mocchi.png', 'A', 'もちまる', 'モッチー・1代目', 'もう一方の親', 'sk')}</div>`;
scr('12', '合体', '2体を選ぶ → 生まれる子の種類(血統の組み合わせ)と6能力の見通し → 最後の確認(親2体が「思い出」へ)→ 生まれる演出。', [
  { id: '12a', label: '2体を選ぶ・生まれる子の見通し', html: `<div class="in">${hd('12 / 30体', '保存枠へ', '✨ 合体')}${fuseTop}
    <div class="ctr yel" style="font-size:20px;line-height:1.1;margin-top:4px">▼</div>
    <div class="card yl"><div class="row" style="align-items:flex-start"><img src="${M('yaobikuni.PNG')}" class="ph" style="width:110px;height:110px">
      <div class="f1"><div class="sub yel">生まれる子</div><div class="h1">ヤオビクニ <span class="chip p">3代目</span></div>
      <div class="row" style="margin-top:5px;gap:4px"><span class="chip s">主: ウンディーネ</span><b>×</b><span class="chip s">副: モッチー</span></div>
      <div class="sub" style="margin-top:4px">主の親の血統 × もう一方の親の血統で決まります</div>
      <div style="margin-top:4px"><span class="chip">📈 かしこさ型(主の親ゆずり)</span></div></div></div>
      <div class="sub" style="margin-top:8px">はじめの6能力の見通し <span class="grn">(緑 = 親からの上乗せ)</span></div>
      <div style="margin-top:4px">${sts([182, 121, 195, 142, 150, 131], [62, 61, 65, 62, 60, 61])}</div>
      <div class="row wrap" style="margin-top:8px;gap:5px"><span class="sub">受け継ぐ技(2つまで)</span><span class="chip on">🧠 みずでっぽう</span><span class="chip on">🛡️ まるまり</span><span class="chip">💪 もちパンチ ✕</span></div></div>
    <div class="card dash" style="padding:8px 10px"><div class="sub">⚠ 合体すると、親の2体は保存枠から外れて「思い出」に残ります</div></div>
    </div><div class="ft"><span class="btn">合体へ進む →</span></div>` },
  { id: '12b', label: '最後の確認', html: `<div class="in">${hd('12 / 30体', '保存枠へ', '✨ 合体')}${fuseTop}</div>
    <div class="modal"><div class="card pk" style="padding:16px 14px"><div class="h1 ctr">ほんとうに合体しますか？</div>
      <div class="row" style="justify-content:center;gap:10px;margin-top:12px"><div class="ctr"><img src="${T('undine')}" style="width:64px;height:64px;border-radius:12px;border:2.5px solid #f472b6"><div style="font-size:11px">${rk('A')} しずく</div></div><b class="yel" style="font-size:20px">＋</b><div class="ctr"><img src="${T('mocchi')}" style="width:64px;height:64px;border-radius:12px;border:2.5px solid #f472b6"><div style="font-size:11px">${rk('A')} もちまる</div></div></div>
      <div class="ctr yel" style="font-size:18px;margin-top:4px">▼</div>
      <div class="card" style="margin-top:2px;background:#0f172a"><div class="sub">📖 思い出に残るもの</div><div style="margin-top:3px">名前・育成ランク・◯代目</div><div class="sub" style="margin-top:6px">もどせないこと</div><div style="margin-top:3px">2体は保存枠から外れます(応援・バトルに出せなくなります)</div></div>
      <div style="margin-top:10px">${coach('myua', 'normal', 'ふたりの力は、新しい子にちゃんと受け継がれるよ')}</div>
      <div class="grid2" style="margin-top:14px"><span class="btn3">やめる</span><span class="btn" style="background:linear-gradient(90deg,#a855f7,#f472b6)">合体する</span></div>
      <div class="sub ctr" style="margin-top:8px">もう1回「合体する」を押すと決まります(2回押し)</div></div></div>` },
  { id: '12c', label: '生まれる演出', html: `<div style="position:absolute;inset:0;background:radial-gradient(ellipse at 50% 40%,#fde047 0,#f472b6 16%,#6d28d9 42%,#0f0d24 78%)"></div>
    <div class="in" style="position:relative"><div class="hd"><span></span><span class="ti" style="color:#fff">✨ 合体</span><span class="rt">とばす</span></div></div>
    <img src="${T('undine')}" style="position:absolute;left:34px;top:96px;width:58px;height:58px;border-radius:14px;opacity:.5;border:2px solid #fff8">
    <img src="${T('mocchi')}" style="position:absolute;right:34px;top:96px;width:58px;height:58px;border-radius:14px;opacity:.5;border:2px solid #fff8">
    <svg style="position:absolute;left:0;top:90px" width="390" height="260"><path d="M92,128 Q150,150 190,230" fill="none" stroke="#fff" stroke-width="3" stroke-dasharray="2 9" stroke-linecap="round" opacity=".8"/><path d="M298,128 Q240,150 200,230" fill="none" stroke="#fff" stroke-width="3" stroke-dasharray="2 9" stroke-linecap="round" opacity=".8"/></svg>
    <div style="position:absolute;left:50%;top:210px;margin-left:-125px;width:250px;height:250px;border-radius:50%;background:radial-gradient(circle,#fff 0,#fff8 30%,#fff0 68%)"></div>
    <img class="a-pop" src="${M('yaobikuni.PNG')}" style="position:absolute;left:50%;top:214px;margin-left:-120px;width:240px;height:240px;object-fit:contain;filter:drop-shadow(0 0 18px #fff)">
    ${[[60, 250, 22], [310, 236, 26], [84, 420, 18], [296, 410, 20], [186, 180, 20]].map(([x, y, s]) => `<span class="spark" style="left:${x}px;top:${y}px;font-size:${s}px">✨</span>`).join('')}
    <div style="position:absolute;left:12px;right:12px;top:478px"><div class="ctr" style="font-size:13px;font-weight:900">新しい子が生まれた！</div>
      <div class="ctr a-pop" style="font-size:30px;font-weight:900;letter-spacing:.06em;text-shadow:0 3px 0 #6d28d9">ヤオビクニ</div>
      <div class="ctr" style="margin-top:4px"><span class="chip p">3代目</span> <span class="chip">📈 かしこさ型</span> <span class="chip on">🧠 かしこさ によく来る</span></div>
      <div class="card" style="margin-top:10px"><div class="sub">名前</div><div class="h1" style="background:#0f172a;border-radius:9px;padding:6px 10px;margin-top:3px">うみか</div></div>
      <div style="margin-top:8px">${coach('myua', 'surprise', 'わあ…！ しずくにも、もちまるにも似てる！', 'みゅあ')}</div></div>
    <div class="ft"><div class="grid2"><span class="btn2">📦 保存枠へ</span><span class="btn">🌱 すぐ育てる</span></div></div>` },
], `<h3>見せたいもの</h3><ul><li>「主の親」と「もう一方の親」を色で分ける(ピンク/水色)</li><li>生まれる種類は「主: ◯ × 副: ◯」の血統の札で理由がわかる</li><li>6能力は緑の上乗せを足して見せる。受け継げない技は ✕</li><li>最後の確認は「残るもの/もどせないこと」を分けて書く・2回押し</li></ul><h3>動き: 生まれる(約3.5秒・とばせる)</h3><ul><li>親2体の顔が左右からまんなかへ寄る(<code>mkMerge</code> <code>translateX</code>+<code>scale(.2)</code> 0.8秒)</li><li>光の点線が2本、まんなかへ流れる(<code>stroke-dashoffset</code>)</li><li>まんなかの光がふくらむ(<code>scale(0)→(1.4)</code> 0.6秒)→ 画面が一瞬白(<code>opacity</code> .2s)</li><li>新しい子が影絵(<code>brightness(0)</code>)で出て、色がつく(0.5秒)+ <code>mkPop</code></li><li>種類の名前が1文字ずつ・✨ がゆっくりまたたく</li></ul>`);

// ---- 13. サクセス杯 ----
const conv = (t, r, n, six, four, hero) => `<div class="card ${hero ? 'yl' : ''}" style="padding:8px"><div class="row"><img src="${T(t)}" style="width:50px;height:50px;border-radius:11px;border:2.5px solid ${RC[r]}"><div style="width:70px"><div class="row" style="gap:4px">${rk(r)}<b class="nw" style="font-size:11.5px">${n}</b></div>${hero ? '<span class="chip p" style="font-size:9.5px">勇者モン</span>' : '<span class="chip" style="font-size:9.5px">供モン</span>'}</div>
  <div class="f1 nw" style="font-size:9.5px;line-height:1.6;color:#cbd5e1">${six}</div><b class="yel">▶</b>
  <div class="nw" style="width:84px;font-size:11px;font-weight:900;line-height:1.6">${four}</div></div></div>`;
scr('13', 'サクセス杯', 'バトルモード選択に足す新しいカード → 保存枠の引退した子から勇者モンと供モンを選ぶ。6能力(育成の数字)が、この大会だけの4能力に換算されるのを左右に並べて見せる。戦いの画面は今のモンヒロバトルのまま。', [
  { id: '13a', label: 'バトルモード選択のカード', html: `<div class="in"><div class="hd"><span class="bk">← HOME</span><span class="ti" style="color:#fff">バトルモードをえらぶ</span><span></span></div>
    ${[['⚔', 'チャレンジ', 'いつものモンヒロバトル'], ['⚡', 'クイック', 'みじかく1戦']].map(([i, n, s]) => `<div class="card" style="opacity:.55"><div class="row"><span style="font-size:26px">${i}</span><div class="f1"><div class="h2">${n}</div><div class="sub">${s}</div></div></div></div>`).join('')}
    <div class="card yl" style="padding:0;overflow:hidden"><div style="position:relative;height:150px;background:linear-gradient(120deg,#be185d,#f59e0b)">
        <img src="${M('mocchi.png')}" style="position:absolute;right:86px;bottom:-8px;width:120px;height:120px;object-fit:contain"><img src="${M('pixie.png')}" style="position:absolute;right:6px;bottom:-6px;width:110px;height:110px;object-fit:contain">
        <div style="position:absolute;left:12px;top:12px"><span class="chip on">NEW</span><div style="font-size:26px;font-weight:900;margin-top:4px;text-shadow:0 3px 0 #0005">🏆 サクセス杯</div><div style="font-size:11.5px;font-weight:900">モンヒロサクセスで育てた子が<br>出られる大会</div></div></div>
      <div style="padding:9px 10px"><div class="row"><span class="sub f1">出られる子(引退した子)</span><b class="yel">10体</b></div><div class="row" style="margin-top:4px"><span class="sub f1">足りない枠はベースモンが入ります</span><span class="chip">ランキングは別枠</span></div></div></div>
    ${[['👑', 'プロ', '供モンを5体からえらぶ']].map(([i, n, s]) => `<div class="card" style="opacity:.55"><div class="row"><span style="font-size:26px">${i}</span><div class="f1"><div class="h2">${n}</div><div class="sub">${s}</div></div></div></div>`).join('')}
    <div class="sub" style="margin-top:14px">はじめてのとき(引退した子が0体)</div>
    <div class="card dash"><div class="row"><span style="font-size:26px">🔒</span><div class="f1"><div class="h2 dim">🏆 サクセス杯</div><div class="sub">モンヒロサクセスで育てた子が出られる大会です。まず1体、育てて引退させよう</div></div></div><span class="btn2 sm" style="margin-top:8px">🌱 モンヒロサクセスへ</span></div>
    </div>` },
  { id: '13b', label: '勇者モンと供モンを選ぶ(換算)', html: `<div class="in">${hd('難易度 ふつう', 'もどる', '🏆 サクセス杯')}
    <div class="row" style="margin-top:6px"><div class="h2 f1">出る子をえらぶ</div><span class="chip">勇者モン 1・供モン 5</span></div>
    <div class="row sub" style="margin-top:6px;padding:0 4px"><span style="width:132px"></span><span class="f1">育成の6能力</span><span style="width:96px">この大会の4能力</span></div>
    ${conv('mocchi', 'A', 'もちまる', '❤️588 💪742 🧠301<br>🎯520 💨266 🛡️590', '❤️ 915 💪 181<br>🛡️ 178 ⚡ 156', 1)}
    ${conv('pixie', 'S', 'ぴくりん', '❤️610 💪402 🧠780<br>🎯655 💨802 🛡️433', '❤️ 742 💪 176<br>🛡️ 138 ⚡ 221')}
    ${conv('undine', 'A', 'しずく', '❤️540 💪280 🧠760<br>🎯500 💨420 🛡️512', '❤️ 801 💪 170<br>🛡️ 149 ⚡ 163')}
    ${conv('golem', 'B', 'がんてつ', '❤️620 💪480 🧠120<br>🎯310 💨140 🛡️700', '❤️ 1,104 💪 153<br>🛡️ 251 ⚡ 108')}
    ${conv('tiger', 'C', 'らいが', '❤️380 💪520 🧠150<br>🎯410 💨300 🛡️290', '❤️ 688 💪 160<br>🛡️ 132 ⚡ 148')}
    <div class="card dash" style="padding:8px"><div class="row"><img src="${T('suezo')}" style="width:50px;height:50px;border-radius:11px;opacity:.5;border:2.5px dashed #64748b"><div class="f1"><span class="chip">ベースモン</span><div class="sub" style="margin-top:2px">空いた枠にはベースモンが入ります(種の基礎の8割)</div></div><span class="btn2 sm">えらぶ</span></div></div>
    <div class="card" style="padding:8px 10px"><div class="sub">換算のしかた(この大会だけ)</div><div style="font-size:11px;margin-top:3px;line-height:1.6">❤️ ← ライフ　💪 ← ちから と かしこさ の高いほう中心<br>🛡️ ← 丈夫さ　⚡ ガッツ ← 命中 と 回避</div></div>
    </div><div class="ft"><span class="btn">置く距離へ進む →</span></div>` },
], `<h3>見せたいもの</h3><ul><li>カードは今のモード選択の並びに1枚足すだけ(金とピンクで「特別な大会」)</li><li>出られる数・ランキングは別枠・足りない枠の扱いをカードに1行ずつ</li><li>選ぶ画面は「育成の6能力 ▶ この大会の4能力」を1行で並べる。どの能力がどこへ効くかは下の札</li><li>ここから先(置く距離・教えカード・WAVE)は今のモンヒロバトルの画面そのまま</li></ul><h3>動き</h3><ul><li>カードの NEW がゆっくり光る <code>mkGlow</code>。立ち絵が小さく上下</li><li>子を選ぶ → 6能力の数字が ▶ を通って4能力へ数え上がる(<code>mkRise</code>+数字のカウント 0.4秒)</li></ul><h3>注意</h3><ul><li>換算の数字は仮(幅は ×0.8〜×1.6 で作り、あとで測って決める)</li></ul>`);

// ---- 14. 入口 ----
const tile = (cls, body) => `<div class="card ${cls}" style="padding:0;overflow:hidden;margin-top:6px">${body}</div>`;
scr('14', '入口', 'HOME などに置く札。状態で3つの顔になる: 育成の途中なら「続きから」、途中でなければ「新しく育てる」、どちらでも「保存枠」「バトル」へ行ける。置く場所は窓口と決める。', [
  { id: '14', label: '入口の札(HOME に置く)', html: `<div class="in"><div class="hd"><span class="ti" style="color:#fff">🏠 HOME(置き場所は仮)</span><span class="rt">💎 1,240</span></div>
    <div class="grid2" style="margin-top:4px;opacity:.45"><div class="card" style="margin:0;height:54px" ><b>⚔ バトル</b></div><div class="card" style="margin:0;height:54px"><b>🎵 モンヒロビート</b></div></div>
    <div class="sub" style="margin-top:10px">① 育成の途中があるとき(大きい札)</div>
    ${tile('yl', `<div style="position:relative;height:124px;background:linear-gradient(120deg,#6d28d9,#be185d 70%,#f59e0b)">
      <img src="${M('mocchi.png')}" style="position:absolute;right:4px;bottom:-10px;width:128px;height:128px;object-fit:contain">
      <img class="fc" src="${F('myua', 'happy')}" style="position:absolute;right:112px;bottom:8px;width:44px;height:44px">
      <div style="position:absolute;left:12px;top:10px;width:220px"><div style="font-size:19px;font-weight:900;text-shadow:0 2px 0 #0005">🌱 モンヒロサクセス</div>
        <div style="font-size:12px;font-weight:900;margin-top:3px">もちまる・2年目 6月 3週</div>${life(98, 150)}<div class="sub" style="color:#fff;margin-top:3px">98 / 150週・🏆 大会まであと1週</div></div></div>
      <div class="row" style="padding:8px;gap:6px"><span class="btn f1 sm">▶ 続きから</span><span class="btn2 sm">📦 保存枠</span><span class="btn2 sm">⚔ バトル</span></div>`)}
    <div class="sub" style="margin-top:10px">② 途中の育成がないとき</div>
    ${tile('pk', `<div class="row" style="padding:10px"><div style="position:relative;width:86px;height:70px"><img src="${T('mocchi')}" style="position:absolute;left:0;top:6px;width:48px;height:48px;border-radius:12px;border:2px solid #f472b6"><img src="${T('yaobikuni')}" style="position:absolute;left:34px;top:18px;width:48px;height:48px;border-radius:12px;border:2px dashed #fde047"></div>
      <div class="f1"><div class="h2">🌱 モンヒロサクセス</div><div class="sub">保存枠 12体・未育成の子が <b class="yel">2体</b> 待っています</div>
      <div class="row" style="margin-top:6px;gap:6px"><span class="btn sm f1">🌱 新しく育てる</span><span class="btn2 sm">📦</span><span class="btn2 sm">⚔</span></div></div></div>`)}
    <div class="sub" style="margin-top:10px">③ 小さい札(場所がせまいとき・知らせの点つき)</div>
    <div class="grid3" style="margin-top:6px">${[['🌱', '続きから', '98/150週', 1], ['📦', '保存枠', '12 / 30体'], ['⚔', 'サクセスの対戦', 'クラス B']].map(([i, n, s, dot]) => `<div class="card ctr" style="margin:0;padding:10px 4px;position:relative">${dot ? '<span style="position:absolute;right:6px;top:6px;width:10px;height:10px;border-radius:50%;background:#f472b6;border:2px solid #fff"></span>' : ''}<div style="font-size:24px">${i}</div><b style="font-size:12px">${n}</b><div class="sub" style="font-size:10px">${s}</div></div>`).join('')}</div>
    <div class="sub" style="margin-top:10px">④ 知らせ(貸した子が応援に行った)</div>
    <div class="card sk" style="padding:8px 10px"><div class="row">${cf({ t: 'pixie', r: 'S', lg: 1 })}<div class="f1"><b>ぴくりん が 3回 応援に行きました</b><div class="sub">フレンドの育成を手伝って 💰 名声 +30</div></div></div></div>
    </div>` },
], `<h3>見せたいもの</h3><ul><li>①続きから: いまの子・日付・寿命の目盛りが札に出る → 押す理由が札でわかる</li><li>②途中なし: 保存枠の数と「未育成の子が待っている」</li><li>③せまい場所用の3つの小札(続きから・保存枠・対戦)</li><li>④貸し出しの知らせは入口の近くに1行</li></ul><h3>動き</h3><ul><li>大会の週・未育成の子がいるときは札の右上にピンクの点(今のHOMEの知らせの点と同じ)</li><li>①の立ち絵はゆっくり上下。押すと札がそのまま広がって育成のメインへ(<code>scale</code>+<code>opacity</code> .3s)</li></ul><h3>置き場所(窓口と決める)</h3><ul><li>候補: HOME の遊びの札の並び / 助手ライフの近く / バトルモード選択の上</li></ul>`);

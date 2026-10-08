// Storage helpers — window.storage は元々の別プラットフォーム向けAPIで、
// GitHub Pages上には存在しない。実ブラウザのlocalStorageを使い、
// それも使えない場合のみメモリ内フォールバック(リロードで消える)にする。
// 本番バトルとDEBUGで共用するパンドラの分身描画。中央像と左右2枚は同じ画像要素を
// 複製し、雷も各分身体の内側に置くことで発射位置が中央1点にならないようにする。
// バトルの記録(ログ)の色分け。何が起きた行なのかを、読む前に色で見分けられるようにする。
// 分け方はRPGテストのメッセージ欄(会心・かわした・戦闘不能…)と同じ考え方にそろえてある。
const BATTLE_LOG_TONE_STYLE = Object.freeze({
  turn:    'border-indigo-400/40 bg-indigo-950/60 text-indigo-200 text-center tracking-[0.18em]',
  card:    'border-violet-400/30 bg-violet-950/40 text-violet-100',
  enemy:   'border-red-500/30 bg-red-950/40 text-red-200',
  crit:    'border-amber-300/40 bg-amber-950/40 text-amber-200',
  damage:  'border-white/10 bg-slate-900/70 text-slate-100',
  miss:    'border-cyan-400/30 bg-cyan-950/40 text-cyan-200',
  guard:   'border-emerald-400/30 bg-emerald-950/40 text-emerald-200',
  heal:    'border-emerald-400/30 bg-emerald-950/40 text-emerald-200',
  down:    'border-rose-500/40 bg-rose-950/50 text-rose-200',
  default: 'border-white/10 bg-slate-900/70 text-slate-300',
});

// ==== 攻撃を「敵の位置」へ向ける(2026-09-24 ユーザー指示「モンスターの位置から上に向かって
// アクションしているのを、敵に位置を合わせて何かをする感じにしたい」)。
// 攻撃する子の絵の中心から敵の丸枠の中心までの差(px)を測り、CSS変数で各モーションへ渡す。
//   --atk-dx / --atk-dy : 敵までの横・縦のずれ(上が負)
//   --atk-len / --atk-rot : 敵までの距離と向き(真上を0degとして時計回り)
//   --pd-l-* / --pd-r-* : パンドラの左右の分身から敵までの雷の長さと向き(分身の位置は下の比率で決まる)
// 変数が無いとき(図鑑・画像デバッグ・RPG)は :root の既定値(真上へ少し)で、今までに近い見え方になる。
// ★計算・保存・ターン進行には一切触れない。見た目だけ。
const PANDORA_CLONE_REACH = .5;   // 分身が敵へ向かって出る割合(0=その場・1=敵の位置)
const PANDORA_CLONE_LIFT = 6;     // 撃っているあいだの分身の浮き(px)。keyframes の -6px と同じ値
const attackAimVars = (dx, dy, {spread = 56} = {}) => {
  const aimOf = (vx, vy) => ({ len: Math.max(24, Math.hypot(vx, vy)), rot: Math.atan2(vx, -vy) * 180 / Math.PI });
  const main = aimOf(dx, dy);
  const cloneY = dy * PANDORA_CLONE_REACH - PANDORA_CLONE_LIFT;
  const left = aimOf(dx - (dx * PANDORA_CLONE_REACH - spread), dy - cloneY);
  const right = aimOf(dx - (dx * PANDORA_CLONE_REACH + spread), dy - cloneY);
  const px = (v) => `${Math.round(v)}px`;
  const deg = (v) => `${Math.round(v * 10) / 10}deg`;
  return {
    '--atk-dx': px(dx), '--atk-dy': px(dy), '--atk-len': px(main.len), '--atk-rot': deg(main.rot),
    // 敵が右にいれば1・左なら-1・ほぼ真上なら0(水攻撃の左右の滑りを敵の側へ寄せるのに使う)
    '--atk-side': String(dx > 12 ? 1 : (dx < -12 ? -1 : 0)),
    '--pd-l-x': px(dx * PANDORA_CLONE_REACH - spread), '--pd-r-x': px(dx * PANDORA_CLONE_REACH + spread),
    '--pd-y': px(dy * PANDORA_CLONE_REACH),
    // 分身は撃つあいだ .95 倍に縮むので、雷はそのぶん長くして敵まで届かせる
    '--pd-l-len': px(left.len / .95), '--pd-l-rot': deg(left.rot),
    '--pd-r-len': px(right.len / .95), '--pd-r-rot': deg(right.rot),
  };
};
// 要素の中心を測る。★自分に掛かっている transform(攻撃中の移動・タメの沈み込み)は含めない。
// getBoundingClientRect は動いている最中の位置を返すので、タメ→本技の2段目で狙いがずれる。
// offsetLeft/offsetTop は transform を含まないので、動かない親の位置に足して中心を出す。
const attackAimCenter = (el) => {
  const parent = el.offsetParent;
  if (!parent) { const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }
  const pr = parent.getBoundingClientRect();
  return {
    x: pr.left + parent.clientLeft - parent.scrollLeft + el.offsetLeft + el.offsetWidth / 2,
    y: pr.top + parent.clientTop - parent.scrollTop + el.offsetTop + el.offsetHeight / 2,
  };
};
// バトル画面で、その枠の子から敵(data-attack-target)までのずれを返す。測れなければ null(既定値で動く)。
// 新しい盤面は絵だけが動く(data-tactics-attack-image)ので絵の中心から、古い盤面は枠ごと動くので枠の中心から測る。
const measureAttackAim = (slotIndex) => {
  if (typeof document === 'undefined' || slotIndex == null) return null;
  const slot = document.querySelector(`[data-slot-index="${slotIndex}"]`);
  const enemy = document.querySelector('[data-attack-target]');
  if (!slot || !enemy) return null;
  const from = attackAimCenter(slot.querySelector('[data-tactics-attack-image]') || slot);
  const to = attackAimCenter(enemy);
  const dx = Math.round(to.x - from.x);
  const dy = Math.round(to.y - from.y);
  if (!Number.isFinite(dx) || !Number.isFinite(dy) || Math.hypot(dx, dy) < 24) return null;
  return { slotIndex, dx, dy };
};
// 敵の側に出す着弾。枠ごと飛んでいく動き(通常の体当たり・固有技の突進・ザン・エイキ)は
// 絵の中に着弾を置くと一緒に動いてしまうので、敵の丸枠の中へ重ねる。
// 水・歌・雷・聖光は自分の演出の中で敵の位置へ着弾を描くので、ここでは何も出さない。
// 時間は各モーションの「当たった瞬間」に合わせてあり、どれも攻撃の尺の中で消える。
const ATTACK_TARGET_OWN_IMPACT = Object.freeze(['waterBurst', 'miaSongNotes', 'pandoraDualThunder', 'arkHolyRain']);
const ATTACK_TARGET_SLASHES = Object.freeze({
  zan:  [{ angle:'-32deg', delay:'80ms'  }, { angle:'24deg', delay:'124ms' }, { angle:'-6deg', delay:'168ms' }],
  eiki: [{ angle:'28deg',  delay:'110ms' }, { angle:'-4deg', delay:'158ms' }, { angle:'-38deg', delay:'206ms' }, { angle:'64deg', delay:'254ms' }],
});
// ==== 体当たりだった初期モンスターの攻撃(2026-09-24 ユーザー指示「初期からいるモンスターは攻撃アクションが
// 体当たりだけだから、モンスターのイメージにあわせたアクションを作って」) ====
// データの atkMotion は 'default' のまま変えない(待ち時間・RPG表示・検査が atkMotion を見ているため)。
// 見た目だけを、攻撃する子の種族で選ぶ。種族→型の表(DEFAULT_ATTACK_THEMES)と型ごとの尺(THEMED_ATTACK_MS)は、
// 本番バトルの待ち時間と図鑑のプレビューも使うので 23-rpg-debug.jsx に置いてある。
// 新しいモンスターを 'default' で足すときは、そこへ1行足せば型を選べる(足さなければ今までどおり体当たり)。
// 技ごとに動きを変える種族(ユグドラシル種)は、anim.skillName から型を選ぶ(23-rpg-debug.jsx の SKILL_ATTACK_THEMES)
const themedAttackKindOf = (anim, baseId) => (
  anim && anim.charge !== true && !anim.zanCombo && !anim.twinBlade && (!anim.motion || anim.motion === 'default')
    ? (skillAttackThemeOf(baseId, anim.skillName, anim.charge === false) || DEFAULT_ATTACK_THEMES[baseId] || null) : null
);
// 飛ぶもの・着弾の小片。x/y は敵の位置からのずれ、d はずらす時間(ms)、a は向き(deg)、s は大きさの倍率。
// hit2 は2回目の着弾(モッチーのモッチ砲)。型ごとの尺は 23-rpg-debug.jsx の THEMED_ATTACK_MS
const THEMED_ATTACK_BITS = Object.freeze({
  stomp:  { hit:[{x:-34,y:10},{x:-22,y:-16},{x:0,y:-24},{x:22,y:-16},{x:34,y:10},{x:0,y:18}],
            hit2:[{x:-30,y:-22},{x:-8,y:-36},{x:18,y:-30},{x:34,y:-4},{x:-26,y:16},{x:22,y:20}] },
  rocks:  { hit:[{x:-64,y:-36,a:20},{x:-40,y:-70,a:-40,s:1.3},{x:-6,y:-84,a:60},{x:30,y:-74,a:-20,s:1.4},{x:64,y:-34,a:45},
                 {x:-58,y:14,a:-60,s:.8},{x:56,y:18,a:30,s:1.1},{x:4,y:34,a:90,s:.8}] },
  claw:   { hit:[
    {x:-12,a:28,d:235},{x:0,a:28,d:245},{x:12,a:28,d:255},
    {x:-12,a:-28,d:295},{x:0,a:-28,d:305},{x:12,a:-28,d:315},
    {x:-12,a:62,d:355},{x:0,a:62,d:365},{x:12,a:62,d:375},
  ],
            // 角からの雷撃が当たったときの火花
            hit2:[{x:-34,y:-20},{x:-14,y:-40},{x:16,y:-38},{x:36,y:-14},{x:-28,y:18},{x:26,y:22}] },
  punch:  { hit:[{x:-10,y:-8,d:186,s:.7},{x:-22,y:-20,d:196,s:.4},
                 {x:6,y:0,d:314,s:1.7},{x:30,y:-22,d:330,s:.8},{x:-24,y:-28,d:340,s:.7},{x:22,y:24,d:350,s:.6}] },
  magic:  { fly:[{x:-10,y:-40,d:120},{x:12,y:-56,d:175},{x:-4,y:-30,d:230}], hit:[{x:-26,y:-18},{x:24,y:-22},{x:-20,y:20},{x:26,y:16},{x:0,y:-30}] },
  crush:  { hit:[{a:-20},{a:35},{a:150},{a:205}] },
  petals: { fly:[{x:-22,y:-30,d:60},{x:16,y:-48,d:100},{x:-10,y:-60,d:140},{x:24,y:-24,d:180},{x:-26,y:-44,d:220},{x:8,y:-36,d:250},{x:-4,y:-52,d:280}] },
  vine:   { hit:[{x:-22,y:-14},{x:20,y:-18},{x:-14,y:16},{x:18,y:12}] },
  fire:   { fly:[{x:-8,y:-6,d:130},{x:10,y:6,d:170},{x:-12,y:10,d:210},{x:6,y:-10,d:250},{x:-4,y:4,d:290},{x:12,y:-4,d:330}],
            hit:[{x:-30,y:-26,d:230},{x:26,y:-30,d:280},{x:-22,y:22,d:330},{x:30,y:14,d:380}] },
});
const THEMED_ATTACK_LINE_KINDS = Object.freeze(['beam','vine','stomp','fire','claw']);
const ThemedAttackBits = ({list}) => (list||[]).map((b,i)=>(
  <i key={i} className="thm-atk__bit" style={{'--bx':`${b.x||0}px`,'--by':`${b.y||0}px`,'--ba':`${b.a||0}deg`,'--bs':b.s||1,...(b.d!=null?{animationDelay:`${b.d}ms`}:{})}}/>
));
// ==== ユグドラシル種の技ごとの動き(2026-09-29 ユーザー指示「これにあった技モーション作って」) ====
// 技の名前 → 型は 23-rpg-debug.jsx の SKILL_ATTACK_THEMES、尺は THEMED_ATTACK_MS。ここは見た目の組み合わせ表。
//   body  : 本体の動き(.skfx-body--◯◯)。bash 突進 / dive 跳んで頭から落ちる / roll 転がる / flip 宙返りして落ちる /
//           toss 投げる / cast その場で力をためて放つ / slash 突進して斬る
//   line  : 本体から敵へのびる帯(beam 光線 / tongue 舌 / arc 光の弧)
//   fx    : 飛ぶもの。path は shot まっすぐ / lob 山なり / fall 敵の上から降る / rise 敵の足元から噴き上がる /
//           orbit 本体のまわりを回ってから敵へ。shape は形(.skfx-p--◯◯)。items の x,y はずれ(px)、d は遅れ(ms)、
//           s は大きさ、h は色相(果物・蝶・飴の色)
//   over  : 敵に重ねる大きな絵(slash 縦の斬撃 / aurora オーロラの幕 / shadow 影の手 /
//           eclipse 相反爆発=黒い核と白い閃光 / twinThunder 反発雷撃=紫と金の雷が交差)
//   twin  : true なら、本体と同じ絵を闇(左)と光(右)の2体ぶん足して描く(.skfx-twin)。body:'split' と組み合わせる
//           (body の gather=魔力集束 / split=分裂は、どちらも2026-10-02 のパンドラ用)
//   hit   : 着弾の時刻(ms)。hit2 は2回目。c1/c2 は光の色
const SKFX_RING = (n, r, d0, dStep, extra={}) => Array.from({length:n}, (_, i) => {
  const a = (Math.PI * 2 * i) / n;
  return { x:Math.round(Math.cos(a) * r), y:Math.round(Math.sin(a) * r), d:d0 + i * dStep, ...extra };
});
const SKFX_SPREAD = (n, w, d0, dStep, extra={}) => Array.from({length:n}, (_, i) => ({
  x:Math.round(((i + .5) / n - .5) * w + ((i * 37) % 11) - 5), y:((i * 23) % 17) - 8, d:d0 + ((i * 7) % n) * dStep, ...extra,
}));
const SKILL_FX_SPECS = Object.freeze({
  // --- 通常技(ちから) ---
  ygHeadbutt:  { body:'bash', hit:250, c1:'#fef9c3', c2:'#facc15',
                 bits:[{x:-26,y:-18},{x:24,y:-22},{x:-30,y:12},{x:30,y:10},{x:0,y:-32}], burst:'star' },
  ygAirDive:   { body:'dive', hit:470, c1:'#ffedd5', c2:'#fb923c',
                 bits:[{x:-40,y:6},{x:-26,y:-24},{x:0,y:-34},{x:26,y:-24},{x:40,y:6},{x:-18,y:20},{x:18,y:20}], burst:'star' },
  ygGreenLight:{ body:'cast', line:'beam', hit:210, c1:'#dcfce7', c2:'#4ade80',
                 bits:[{x:-24,y:-16},{x:22,y:-20},{x:-18,y:18},{x:22,y:14}] },
  ygTongue:    { body:'lick', line:'tongue', hit:270, c1:'#fce7f3', c2:'#f472b6',
                 bits:[{x:-20,y:-14,s:1.2},{x:18,y:-18},{x:0,y:16}], burst:'heart' },
  ygRoll:      { body:'roll', hit:400, c1:'#fef3c7', c2:'#d97706',
                 bits:[{x:-44,y:10,s:1.3},{x:-30,y:-20},{x:0,y:-30,s:1.2},{x:30,y:-20},{x:44,y:10,s:1.3},{x:0,y:22}], burst:'dust' },
  ygMoonDrop:  { body:'flip', hit:540, c1:'#e0f2fe', c2:'#38bdf8',
                 fx:{ path:'rise', shape:'water', dur:270, items:SKFX_SPREAD(10, 120, 520, 5) },
                 bits:[{x:-36,y:-10},{x:36,y:-10},{x:-20,y:-30},{x:20,y:-30}] },
  ygCandy:     { body:'toss', hit:460, c1:'#fdf4ff', c2:'#e879f9',
                 fx:{ path:'lob', shape:'candy', dur:300, items:[{x:-10,y:0,d:160,h:330},{x:8,y:-6,d:200,h:190},{x:-4,y:8,d:240,h:50},{x:12,y:4,d:280,h:120}] },
                 bits:[{x:-34,y:-20,h:330},{x:30,y:-26,h:190},{x:-26,y:22,h:50},{x:30,y:18,h:120},{x:0,y:-36,h:270}], burst:'candy' },
  ygStrawberry:{ body:'cast', hit:330, c1:'#ffe4e6', c2:'#f43f5e',
                 fx:{ path:'rise', shape:'berry', dur:400, items:SKFX_SPREAD(9, 110, 290, 15) },
                 bits:[{x:-30,y:-24},{x:28,y:-28},{x:-36,y:10},{x:36,y:8}] },
  ygCakeCut:   { body:'slash', over:'slash', hit:330, c1:'#fff7ed', c2:'#fda4af',
                 bits:[{x:-8,y:-40},{x:8,y:-20},{x:-8,y:0},{x:8,y:20},{x:-8,y:40}], burst:'cream' },
  ygShadow:    { body:'cast', over:'shadow', hit:520, c1:'#ede9fe', c2:'#6d28d9',
                 fx:{ path:'shot', shape:'ghost', dur:360, items:[{x:-30,y:-20,d:150},{x:24,y:-34,d:200},{x:-12,y:22,d:250},{x:30,y:10,d:300},{x:0,y:-8,d:350}] },
                 bits:[{x:-30,y:-24},{x:30,y:-24},{x:-30,y:20},{x:30,y:20}] },
  // --- 固有技(かしこさ) ---
  ygStarBomb:  { body:'gather', over:'boom', hit:420, c1:'#fef9c3', c2:'#fde047',
                 fx:{ path:'shot', shape:'star', dur:300, items:[{x:-14,y:-10,d:120},{x:12,y:-18,d:170},{x:0,y:8,d:220}] },
                 bits:[{x:-30,y:-22},{x:28,y:-26},{x:-34,y:12},{x:32,y:14},{x:0,y:-36},{x:0,y:28}], burst:'star' },
  ygWonderBlaze:{ body:'cast', over:'tornado', hit:430, c1:'#ecfccb', c2:'#84cc16',
                 fx:{ path:'shot', shape:'flame', dur:280, items:[{x:-8,y:-12,d:140},{x:10,y:0,d:180},{x:-4,y:12,d:220},{x:6,y:-6,d:260}] },
                 bits:[{x:-24,y:-24},{x:24,y:-24},{x:-26,y:16},{x:26,y:16}] },
  ygManyWing:  { body:'spin', over:'bloom', hit:560, c1:'#f0fdf4', c2:'#22c55e',
                 fx:{ path:'orbit', shape:'leaf', dur:460, items:SKFX_RING(8, 34, 80, 18) },
                 bits:[{x:-26,y:-18},{x:26,y:-18},{x:-20,y:20},{x:20,y:20},{x:0,y:-30}], burst:'leaf' },
  ygRiceShower:{ body:'float', over:'bloom', hit:520, c1:'#fffbeb', c2:'#fde68a',
                 fx:{ path:'fall', shape:'rice', dur:340, items:SKFX_SPREAD(26, 140, 200, 10) },
                 bits:[{x:-22,y:-14},{x:22,y:-14},{x:0,y:18}], burst:'petal' },
  ygMeteor:    { body:'cast', over:'boom', hit:470, hit2:640, c1:'#ffedd5', c2:'#f97316',
                 fx:{ path:'fall', shape:'meteor', dur:280, items:[{x:-34,y:-6,d:190,s:1.1},{x:20,y:4,d:280,s:1.4},{x:-6,y:10,d:360,s:1.8}] },
                 bits:[{x:-40,y:-20,s:1.2},{x:36,y:-26},{x:-30,y:18},{x:38,y:16,s:1.2},{x:0,y:-40}] },
  ygPapillon:  { body:'float', over:'aurora', hit:620, c1:'#e0e7ff', c2:'#818cf8',
                 fx:{ path:'orbit', shape:'butterfly', dur:520, items:SKFX_RING(6, 40, 60, 30, {}).map((b, i) => ({...b, h:220 + i * 22})) },
                 bits:[{x:-30,y:-20,h:230},{x:30,y:-20,h:270},{x:-28,y:18,h:300},{x:28,y:18,h:250}], burst:'butterfly' },
  ygHeavyRain: { body:'cast', over:'wave', hit:440, c1:'#dbeafe', c2:'#3b82f6',
                 fx:{ path:'fall', shape:'drop', dur:220, items:SKFX_SPREAD(30, 150, 160, 16) },
                 bits:[{x:-30,y:14},{x:-10,y:20},{x:10,y:20},{x:30,y:14}], burst:'water' },
  ygEternalArc:{ body:'gather', line:'arc', over:'xslash', hit:330, hit2:520, c1:'#fef3c7', c2:'#f59e0b',
                 bits:[{x:-36,y:-10},{x:36,y:-10},{x:-24,y:-30},{x:24,y:-30},{x:0,y:30}] },
  ygAurora:    { body:'float', line:'ray', over:'aurora', hit:600, c1:'#ccfbf1', c2:'#2dd4bf',
                 bits:[{x:-30,y:-24,h:160},{x:30,y:-24,h:200},{x:-30,y:20,h:280},{x:30,y:20,h:120}], burst:'fruit' },
  ygCosmo:     { body:'gather', over:'boom', hit:700, c1:'#fae8ff', c2:'#c084fc',
                 fx:{ path:'orbit', shape:'fruit', dur:560, items:SKFX_RING(7, 38, 60, 26, {}).map((b, i) => ({...b, h:[0,40,90,140,200,270,320][i], s:1.1})) },
                 bits:[{x:-44,y:-20,h:0},{x:42,y:-24,h:90},{x:-38,y:22,h:200},{x:40,y:18,h:270},{x:0,y:-44,h:40},{x:0,y:36,h:140}], burst:'fruit' },
});
// ==== 全モンスターの技ごとの動き(2026-09-29 ユーザー指示「全モンスターも技別の攻撃アクション作って」) ====
// ユーザー選択「技ごとに全部別の動きにする」(専用の動きを持つ子も同じ)。見せ場の動きは 'sig' と書いた1つの技に残す。
// 並びは技の**段階の順**(HERO_ATK_NAMES / unique.names と同じ順)。技の名前を変えても動きは段階についてくる。
// 組み合わせる部品は上の SKILL_FX_SPECS と同じ(本体の動き body・帯 line・飛ぶもの fx・敵に重ねる絵 over・着弾の小片 burst)。
// 着弾の時刻と尺は、書かなければ本体の動きと飛ぶものから決まる(skillFxSpecOf)。色は SKM_COLOR の名前か [明,濃]
const SKM_COLOR = Object.freeze({
  fire:['#ffedd5','#f97316'], blue:['#e0f2fe','#38bdf8'], ice:['#f0f9ff','#7dd3fc'], thunder:['#fef9c3','#facc15'],
  holy:['#fffbeb','#fbbf24'], dark:['#ede9fe','#6d28d9'], plant:['#dcfce7','#22c55e'], pink:['#fce7f3','#ec4899'],
  rock:['#f5f5f4','#a8a29e'], wind:['#f0fdfa','#2dd4bf'], psy:['#fae8ff','#c026d3'], blood:['#fee2e2','#dc2626'],
  sakura:['#fdf2f8','#f9a8d4'], white:['#ffffff','#94a3b8'], mocchi:['#ffe4ef','#f472b6'], gold:['#fef3c7','#f59e0b'],
  gas:['#ecfccb','#84cc16'], cosmic:['#e0e7ff','#8b5cf6'], sky:['#e0f2fe','#0ea5e9'], red:['#ffe4e6','#e11d48'],
});
// 飛ぶものの並べ方。path は shot まっすぐ / lob 山なり / fall 上から降る / rise 足元から噴き上がる / orbit 本体のまわりを回ってから敵へ
const skmFx = (path, shape, n = 3, o = {}) => {
  const dur = o.dur ?? (path === 'orbit' ? 480 : path === 'lob' ? 320 : 300);
  const start = o.start ?? (path === 'orbit' ? 60 : path === 'fall' || path === 'rise' ? 220 : 140);
  const step = o.step ?? (path === 'fall' || path === 'rise' ? 14 : path === 'orbit' ? 22 : 50);
  const hueOf = (i) => (Array.isArray(o.h) ? o.h[i % o.h.length] : (o.h ?? 0));
  const items = path === 'orbit' ? SKFX_RING(n, o.r ?? 36, start, step)
    : path === 'fall' || path === 'rise' ? SKFX_SPREAD(n, o.w ?? 110, start, step)
    : Array.from({ length:n }, (_, i) => ({ x:((i % 3) - 1) * 12 + ((i * 5) % 7) - 3, y:(((i * 7) % 5) - 2) * 7, d:start + i * step }));
  return { path, shape, dur, items:items.map((b, i) => ({ ...b, h:hueOf(i), ...(o.s ? { s:o.s } : {}) })) };
};
const skm = (body, o = {}) => ({ body, ...o });
// 型の子・専用の子の見せ場の動き
const SKM_SIG = 'sig';
const SKILL_MOTION_SETS_BASE = {
  // モッチー: 押しつぶしてモッチ砲(見せ場)。通常技は跳ねる・転がる・桜、固有技はモッチ砲(光線)の強化版
  Mocchi: {
    normal:[SKM_SIG,
      skm('bash', { c:'mocchi', burst:'star' }),
      skm('jump', { c:'mocchi', burst:'dust' }),
      skm('roll', { c:'mocchi', burst:'dust' }),
      skm('jab', { c:'mocchi', over:'fist' }),
      skm('cast', { c:'sakura', fx:skmFx('orbit', 'sakura', 8, { h:330 }), burst:'petal' }),
      skm('kick', { c:'mocchi', burst:'star' }),
      skm('cast', { c:'sakura', fx:skmFx('fall', 'sakura', 16, { h:330 }), over:'bloom', burst:'petal' }),
      skm('flip', { c:'mocchi', over:'boom', burst:'star' })],
    unique:[SKM_SIG,
      skm('cast', { c:'mocchi', line:'ray', over:'boom' }),
      skm('cast', { c:'mocchi', line:'ray', over:'wave' }),
      skm('hop', { c:'mocchi', line:'ray', over:'boom', burst:'star' }),
      skm('cast', { c:'mocchi', line:'ray', over:'pillar' }),
      skm('float', { c:'gold', line:'ray', over:'pillar', burst:'star' }),
      skm('cast', { c:'sky', line:'ray', over:'boom' }),
      skm('warp', { c:'white', line:'ray', over:'xslash' }),
      skm('dash', { c:'white', line:'ray', over:'boom', fx:skmFx('orbit', 'spark', 8, { h:200 }) })],
  },
  // スエゾー: 大きな目の光線(見せ場は固有技の熱視線)。舌・キッス・歌・瞬間移動
  Suezo: {
    normal:[skm('spin', { c:'gold', burst:'dust' }),
      skm('toss', { c:'blue', fx:skmFx('lob', 'water', 2) }),
      skm('warp', { c:'psy', burst:'spark' }),
      skm('lick', { c:'pink', line:'tongue', burst:'heart' }),
      skm('cast', { c:'pink', fx:skmFx('shot', 'heart', 3), burst:'heart' }),
      skm('bash', { c:'white', over:'bite' }),
      skm('lick', { c:'pink', line:'tongue', fx:skmFx('shot', 'heart', 2, { start:260 }), burst:'heart' }),
      skm('toss', { c:'gas', fx:skmFx('lob', 'gas', 3, { h:90 }), over:'gas' }),
      skm('lick', { c:'red', line:'whip', over:'fist' })],
    unique:[skm('cast', { c:'psy', over:'eye', fx:skmFx('orbit', 'orb', 6, { h:290 }) }),
      SKM_SIG,
      skm('jump', { c:'white', over:'bite', burst:'dust' }),
      skm('cast', { c:'cosmic', fx:skmFx('shot', 'ring', 3, { h:250 }), over:'wave' }),
      skm('hop', { c:'pink', fx:skmFx('shot', 'note', 5, { h:[330,280,200,50,160] }), over:'wave' }),
      skm('cast', { c:'red', line:'ray', over:'boom' }),
      skm('jump', { c:'red', over:'bite', burst:'star' }),
      skm('hop', { c:'pink', fx:skmFx('orbit', 'note', 8, { h:[330,280,200,50,160] }), over:'wave' }),
      skm('warp', { c:'red', line:'ray', over:'boom' })],
  },
  // ゴーレム: 殴って岩が飛び散る(見せ場は「パンチ」)。大きい技ほど地面が揺れる
  Golem: {
    normal:[skm('jab', { c:'rock', burst:'star' }),
      SKM_SIG,
      skm('kick', { c:'rock', burst:'rock' }),
      skm('bash', { c:'rock', over:'slash' }),
      skm('jump', { c:'rock', burst:'dust' }),
      skm('jab', { c:'gold', over:'boom' }),
      skm('bash', { c:'rock', over:'fist', burst:'rock' }),
      skm('kick', { c:'rock', over:'boom', burst:'rock' }),
      skm('float', { c:'rock', fx:skmFx('rise', 'rock', 10), burst:'rock' })],
    unique:[skm('jab', { c:'gold', over:'wave' }),
      skm('jump', { c:'rock', over:'boom', burst:'dust' }),
      skm('spin', { c:'wind', over:'tornado' }),
      skm('spin', { c:'rock', burst:'dust', over:'wave' }),
      skm('cast', { c:'rock', fx:skmFx('fall', 'rock', 8, { s:1.6 }), burst:'rock' }),
      skm('cast', { c:'fire', fx:skmFx('fall', 'meteor', 3, { s:1.4 }), over:'boom' }),
      skm('spin', { c:'wind', over:'tornado', fx:skmFx('rise', 'rock', 10) }),
      skm('spin', { c:'rock', over:'boom', burst:'rock' }),
      skm('float', { c:'cosmic', fx:skmFx('orbit', 'star', 10, { h:260 }), over:'boom', burst:'star' })],
  },
  // ライガー: 爪と角からの雷(見せ場は「ひっかき」)。固有技は雷と氷
  Tiger: {
    normal:[skm('bash', { c:'blue', burst:'star' }),
      SKM_SIG,
      skm('dash', { c:'blue' }),
      skm('jab', { c:'blue', over:'claw' }),
      skm('warp', { c:'dark', over:'shadow' }),
      skm('flip', { c:'blue', burst:'star' }),
      skm('dash', { c:'thunder', over:'boom' }),
      skm('bash', { c:'fire', fx:skmFx('shot', 'fire', 3, { h:20 }), over:'boom' }),
      skm('jab', { c:'blue', over:'claw', burst:'spark' })],
    unique:[skm('cast', { c:'thunder', over:'thunder' }),
      skm('cast', { c:'ice', fx:skmFx('shot', 'ice', 3), burst:'snow' }),
      skm('cast', { c:'thunder', line:'bolt', over:'thunder' }),
      skm('cast', { c:'ice', fx:skmFx('fall', 'snow', 18), over:'ice' }),
      skm('dash', { c:'white', over:'slash' }),
      skm('cast', { c:'thunder', over:'thunder', fx:skmFx('orbit', 'bolt', 6) }),
      skm('cast', { c:'white', line:'ray', fx:skmFx('orbit', 'spark', 8, { h:190 }) }),
      skm('jump', { c:'thunder', over:'pillar', burst:'spark' }),
      skm('dash', { c:'ice', over:'thunder', fx:skmFx('rise', 'ice', 8) })],
  },
  // ハム: 拳法(見せ場は「ワンツー」)。固有技はおならと暗勁、デンプシーロール
  Ham: {
    normal:[SKM_SIG,
      skm('kick', { c:'gold', burst:'star' }),
      skm('spin', { c:'gold', over:'fist' }),
      skm('jab', { c:'gold', over:'fist' }),
      skm('kick', { c:'gold', over:'boom' }),
      skm('spin', { c:'gold', over:'slash', burst:'star' }),
      skm('jump', { c:'fire', over:'fist', fx:skmFx('rise', 'fire', 8, { h:20 }) }),
      skm('kick', { c:'gold', over:'boom', burst:'star' }),
      skm('kick', { c:'fire', over:'pillar', fx:skmFx('rise', 'fire', 10, { h:20 }) })],
    unique:[skm('shake', { c:'gas', over:'gas' }),
      skm('dash', { c:'white', over:'xslash' }),
      skm('shake', { c:'gas', over:'gas', fx:skmFx('shot', 'gas', 4, { h:90 }) }),
      skm('jab', { c:'dark', over:'wave' }),
      skm('shake', { c:'pink', fx:skmFx('orbit', 'note', 6, { h:[330,50,200] }), burst:'star' }),
      skm('shake', { c:'gas', over:'tornado', fx:skmFx('shot', 'gas', 5, { h:90 }) }),
      skm('warp', { c:'dark', over:'boom' }),
      skm('jab', { c:'gold', over:'fist', burst:'star', fx:skmFx('shot', 'star', 4) }),
      skm('jab', { c:'holy', over:'boom', burst:'star' })],
  },
  // ピクシー: 魔法の弾(見せ場は固有技の「バン」)。光線・雷・キッス
  Pixie: {
    normal:[skm('bash', { c:'pink', burst:'star' }),
      skm('cast', { c:'white', line:'ray' }),
      skm('cast', { c:'thunder', over:'thunder' }),
      skm('kick', { c:'pink', burst:'star' }),
      skm('cast', { c:'plant', fx:skmFx('orbit', 'orb', 6, { h:140 }), over:'pillar' }),
      skm('cast', { c:'thunder', line:'bolt' }),
      skm('cast', { c:'white', line:'ray', over:'boom' }),
      skm('cast', { c:'pink', fx:skmFx('shot', 'heart', 3) }),
      skm('warp', { c:'pink', over:'boom', burst:'heart' })],
    unique:[SKM_SIG,
      skm('cast', { c:'white', line:'ray', over:'pillar' }),
      skm('cast', { c:'thunder', over:'thunder', burst:'spark' }),
      skm('float', { c:'fire', over:'boom', burst:'star' }),
      skm('cast', { c:'thunder', line:'bolt', over:'thunder' }),
      skm('cast', { c:'cosmic', fx:skmFx('orbit', 'star', 8, { h:260 }), over:'boom' }),
      skm('cast', { c:'white', line:'ray', over:'boom', burst:'star' }),
      skm('hop', { c:'fire', over:'boom', fx:skmFx('orbit', 'orb', 8, { h:30 }) }),
      skm('float', { c:'fire', fx:skmFx('fall', 'meteor', 3, { s:1.3 }), over:'boom' })],
  },
  // ミーア: 歌(見せ場は「ハミング」と固有技の「ボイスバン」)。どの技も歌って跳ねる
  Mia: {
    normal:[SKM_SIG,
      skm('hop', { c:'pink', fx:skmFx('shot', 'note', 4, { h:[330,280,200,50] }), line:'ray' }),
      skm('hop', { c:'thunder', line:'bolt', over:'thunder' }),
      skm('kick', { c:'pink', fx:skmFx('orbit', 'note', 5, { h:[330,280,200,50,160] }) }),
      skm('hop', { c:'plant', fx:skmFx('orbit', 'note', 6, { h:140 }), over:'pillar' }),
      skm('hop', { c:'thunder', over:'thunder', burst:'spark' }),
      skm('hop', { c:'pink', fx:skmFx('shot', 'note', 7, { h:[330,280,200,50,160,20,300] }), over:'wave' }),
      skm('hop', { c:'pink', fx:skmFx('shot', 'heart', 3) }),
      skm('hop', { c:'pink', fx:skmFx('orbit', 'heart', 6), over:'boom', burst:'heart' })],
    unique:[SKM_SIG,
      skm('hop', { c:'pink', fx:skmFx('fall', 'note', 14, { h:[330,280,200,50] }), over:'wave' }),
      skm('hop', { c:'thunder', over:'thunder', burst:'spark' }),
      skm('jump', { c:'fire', over:'boom', fx:skmFx('orbit', 'note', 6, { h:[330,50,200] }) }),
      skm('hop', { c:'thunder', line:'bolt', over:'thunder' }),
      skm('hop', { c:'cosmic', fx:skmFx('orbit', 'star', 8, { h:260 }), over:'wave' }),
      skm('hop', { c:'pink', fx:skmFx('orbit', 'note', 10, { h:[330,280,200,50,160] }), over:'pillar' }),
      skm('hop', { c:'pink', over:'wave', fx:skmFx('shot', 'ring', 3, { h:320 }) }),
      skm('float', { c:'holy', fx:skmFx('fall', 'meteor', 3), over:'boom', burst:'star' })],
  },
  // パンドラ: 光と闇(見せ場は「ナイトサンダー」と固有技の「デュアルバン」)
  Pandora: {
    normal:[skm('bash', { c:'psy', burst:'star' }),
      skm('cast', { c:'holy', line:'ray' }),
      SKM_SIG,
      skm('kick', { c:'white', fx:skmFx('orbit', 'feather', 6), burst:'star' }),
      skm('warp', { c:'dark', over:'shadow' }),
      skm('cast', { c:'holy', line:'bolt', over:'cross' }),
      skm('cast', { c:'dark', line:'ray', over:'boom' }),
      skm('cast', { c:'dark', fx:skmFx('shot', 'heart', 3), burst:'heart' }),
      skm('warp', { c:'psy', fx:skmFx('orbit', 'heart', 6), over:'boom' })],
    // 2026-10-02 ユーザー指示「パンドラも今回変えたもの(エクリプスノヴァ・ダイスキライライ)を除いて他の技も演出強化して」。
    //   光と闇の2つの力を使い分ける子なので、光の技=聖なる羽根と光柱、闇の技=足元から湧く闇と雷、宇宙の技=星と流星
    unique:[SKM_SIG,
      skm('gather', { c:'holy', line:'ray', over:'pillar', fx:skmFx('orbit', 'feather', 10, { h:50, dur:420, start:40, step:16 }), burst:'star', hit:560 }),
      skm('gather', { c:'dark', over:'thunder', fx:skmFx('rise', 'orb', 12, { h:275, w:130 }), burst:'spark', hit2:true, hit:560 }),
      skm('float', { c:'psy', over:'boom', fx:skmFx('orbit', 'orb', 8, { h:[270, 48], dur:440, start:40, step:20 }), burst:'star', hit2:true, hit:600 }),
      skm('warp', { c:'dark', line:'bolt', over:'thunder', fx:skmFx('fall', 'bolt', 8, { h:275, w:120 }), burst:'spark', hit2:true }),
      skm('spin', { c:'cosmic', fx:skmFx('orbit', 'star', 14, { h:270, dur:460, start:40, step:14 }), over:'aurora', burst:'star', hit2:true }),
      skm('gather', { c:'holy', line:'ray', over:'cross', form:'slash', fx:skmFx('orbit', 'cross', 8, { h:[50, 275], dur:420, start:40, step:18 }), burst:'star', hit2:true, hit:600 }),
      // 2026-10-02 設定資料(PAGE 3): エクリプスノヴァ=魔力集束(光と闇をまとって溜める)→相反爆発、
      //   ダイスキライライ=分裂(光と闇の2体)→手を取り合う→反発雷撃(docs/spec/PANDORA_SKILLS.md)
      skm('gather', { c:'cosmic', fx:skmFx('orbit', 'orb', 12, { h:[270, 48], dur:420, start:40, step:14 }), over:'eclipse', burst:'star', hit:600 }),
      skm('split', { c:'cosmic', twin:true, line:'bolt', over:'twinThunder', burst:'spark', hit:700 })],
  },
  // モノリス: 押しつぶし(見せ場は「たおれこみ」)と針、トリオビーム
  Monol: {
    normal:[SKM_SIG,
      skm('toss', { c:'white', fx:skmFx('shot', 'needle', 3) }),
      skm('float', { c:'rock', over:'boom', burst:'dust' }),
      skm('shake', { c:'rock', fx:skmFx('shot', 'rock', 5) }),
      skm('bash', { c:'white', over:'bite' }),
      skm('jab', { c:'rock', burst:'star' }),
      skm('float', { c:'rock', over:'boom', fx:skmFx('rise', 'dust', 10) }),
      skm('cast', { c:'white', fx:skmFx('shot', 'needle', 7, { step:30 }) }),
      skm('jab', { c:'rock', over:'boom', burst:'star' })],
    unique:[skm('cast', { c:'red', line:'ray' }),
      skm('shake', { c:'white', over:'wave' }),
      skm('cast', { c:'plant', line:'ray' }),
      skm('cast', { c:'psy', line:'ray', over:'eye' }),
      skm('shake', { c:'sky', over:'wave', burst:'spark' }),
      skm('cast', { c:'gold', fx:skmFx('shot', 'ring', 3, { h:45 }) }),
      skm('cast', { c:'blue', line:'ray', over:'boom' }),
      skm('cast', { c:'cosmic', fx:skmFx('orbit', 'orb', 8, { h:[0,60,120,180,240,300] }), over:'pillar' }),
      skm('float', { c:'cosmic', line:'ray', over:'boom', fx:skmFx('orbit', 'spark', 8, { h:[0,60,120,180,240,300] }) })],
  },
  // オボロゲソウ: 花びら(見せ場は固有技の「花粉」)。つる・種・花
  Oboro: {
    normal:[skm('bash', { c:'plant', burst:'leaf' }),
      skm('jab', { c:'plant', burst:'leaf' }),
      skm('cast', { c:'plant', line:'whip', fx:skmFx('rise', 'leaf', 8) }),
      skm('jab', { c:'plant', over:'slash' }),
      skm('jump', { c:'plant', over:'bite' }),
      skm('shake', { c:'plant', fx:skmFx('orbit', 'leaf', 8), over:'pillar' }),
      skm('spin', { c:'plant', burst:'leaf' }),
      skm('jump', { c:'plant', over:'bite', burst:'star' }),
      skm('spin', { c:'plant', over:'xslash', burst:'leaf' })],
    unique:[skm('cast', { c:'plant', fx:skmFx('shot', 'seed', 3) }),
      skm('cast', { c:'plant', fx:skmFx('shot', 'leaf', 4), over:'slash' }),
      SKM_SIG,
      skm('cast', { c:'gold', fx:skmFx('fall', 'spark', 18, { h:45 }) }),
      skm('cast', { c:'plant', fx:skmFx('shot', 'seed', 9, { step:25 }) }),
      skm('cast', { c:'pink', line:'ray', over:'bloom' }),
      skm('cast', { c:'sakura', fx:skmFx('orbit', 'sakura', 10, { h:330 }), over:'bloom' }),
      skm('cast', { c:'sky', fx:skmFx('orbit', 'sakura', 10, { h:210 }), over:'boom' }),
      skm('cast', { c:'plant', fx:skmFx('fall', 'star', 12, { h:50 }), over:'pillar' })],
  },
  // ザン: 残像の連撃(見せ場は「シングルショット」と固有技の「アサルトレイド」)
  Zan: {
    normal:[SKM_SIG,
      skm('warp', { c:'blue', over:'slash' }),
      skm('flip', { c:'blue', burst:'star' }),
      skm('kick', { c:'blue', over:'slash' }),
      skm('dash', { c:'white', fx:skmFx('shot', 'blade', 3) }),
      skm('flip', { c:'blue', over:'boom' }),
      skm('dash', { c:'blue', over:'xslash' }),
      skm('flip', { c:'blue', over:'claw' }),
      skm('spin', { c:'blue', over:'xslash', burst:'spark' })],
    unique:[skm('dash', { c:'dark', over:'slash' }),
      skm('dash', { c:'blue', fx:skmFx('shot', 'blade', 5, { step:35 }) }),
      skm('jump', { c:'fire', fx:skmFx('fall', 'meteor', 2), over:'boom' }),
      SKM_SIG,
      skm('jump', { c:'blue', over:'pillar' }),
      skm('cast', { c:'sky', fx:skmFx('shot', 'orb', 6, { h:200, step:35 }) }),
      skm('warp', { c:'dark', over:'shadow' }),
      skm('dash', { c:'blue', over:'pillar', fx:skmFx('orbit', 'blade', 6) }),
      skm('dash', { c:'blood', over:'xslash', burst:'spark' })],
  },
  // エイキ: 桜と氷の斬撃(見せ場は「桜牙」と固有技の「絶華緋閃・零桜」)
  Eiki: {
    normal:[SKM_SIG,
      skm('dash', { c:'sakura', over:'slash', burst:'sakura' }),
      skm('cast', { c:'sakura', fx:skmFx('shot', 'sakura', 6, { h:330, step:30 }), over:'slash' }),
      skm('warp', { c:'sakura', over:'xslash', burst:'sakura' }),
      skm('flip', { c:'sakura', fx:skmFx('orbit', 'sakura', 8, { h:330 }), over:'slash' }),
      skm('spin', { c:'sakura', over:'tornado', fx:skmFx('orbit', 'sakura', 8, { h:330 }) }),
      skm('dash', { c:'sakura', over:'claw', fx:skmFx('fall', 'sakura', 14, { h:330 }) }),
      skm('dash', { c:'sakura', over:'claw', burst:'sakura' }),
      skm('dash', { c:'blood', over:'claw', fx:skmFx('orbit', 'sakura', 10, { h:350 }), burst:'sakura' })],
    unique:[skm('warp', { c:'blood', over:'slash', burst:'sakura' }),
      skm('dash', { c:'ice', over:'ice', burst:'snow' }),
      skm('flip', { c:'sakura', over:'xslash', fx:skmFx('fall', 'sakura', 12, { h:330 }) }),
      skm('spin', { c:'blood', over:'claw', fx:skmFx('fall', 'snow', 16) }),
      skm('dash', { c:'ice', over:'xslash', burst:'snow' }),
      skm('spin', { c:'ice', over:'tornado', fx:skmFx('orbit', 'snow', 10) }),
      skm('dash', { c:'blood', over:'claw', fx:skmFx('orbit', 'sakura', 12, { h:[350,330] }) }),
      skm('warp', { c:'sakura', over:'xslash', fx:skmFx('orbit', 'sakura', 12, { h:[330,200] }), burst:'sakura' }),
      SKM_SIG],
  },
  // 剣士モッチー: 二刀流(見せ場は「ガッチャー・クロス」と固有技の「スターバースト・ストリーム」)
  KenshiMocchi: {
    normal:[skm('dash', { c:'white', over:'slash' }),
      skm('jump', { c:'white', over:'slash' }),
      skm('dash', { c:'sky', over:'slash', burst:'spark' }),
      skm('flip', { c:'white', over:'slash' }),
      SKM_SIG,
      skm('spin', { c:'dark', fx:skmFx('orbit', 'sakura', 10, { h:280 }), over:'xslash' }),
      skm('spin', { c:'white', over:'claw' }),
      skm('jump', { c:'sakura', over:'xslash', fx:skmFx('fall', 'sakura', 12, { h:330 }) }),
      skm('dash', { c:'fire', over:'boom', burst:'spark' })],
    unique:[skm('dash', { c:'plant', over:'slash', burst:'spark' }),
      skm('dash', { c:'sky', over:'claw' }),
      skm('dash', { c:'red', line:'ray', over:'boom' }),
      skm('spin', { c:'white', over:'xslash' }),
      skm('spin', { c:'dark', over:'tornado', burst:'spark' }),
      skm('dash', { c:'dark', over:'claw', burst:'spark' }),
      skm('warp', { c:'dark', over:'xslash', fx:skmFx('orbit', 'blade', 6) }),
      skm('dash', { c:'cosmic', over:'xslash', fx:skmFx('orbit', 'spark', 8, { h:270 }), burst:'star' }),
      SKM_SIG],
  },
  // アーク: 詠唱と聖なる光(見せ場は「神光よ汚れを祓え」と固有技の「聖光よ奇跡を灯せ」)
  Ark: {
    normal:[skm('cast', { c:'holy', over:'eye' }),
      skm('dash', { c:'holy', over:'slash' }),
      skm('cast', { c:'holy', over:'sword' }),
      skm('cast', { c:'holy', fx:skmFx('fall', 'star', 14, { h:50 }) }),
      skm('float', { c:'holy', over:'boom', burst:'star' }),
      skm('cast', { c:'holy', over:'wave' }),
      skm('cast', { c:'white', fx:skmFx('fall', 'feather', 12), over:'pillar' }),
      SKM_SIG,
      skm('cast', { c:'sky', fx:skmFx('shot', 'needle', 6, { step:30 }), line:'whip' })],
    unique:[skm('cast', { c:'holy', fx:skmFx('orbit', 'ring', 5, { h:45 }) }),
      skm('cast', { c:'holy', over:'pillar' }),
      skm('cast', { c:'holy', over:'eye', burst:'star' }),
      skm('hop', { c:'holy', over:'wave', fx:skmFx('fall', 'star', 12, { h:50 }) }),
      skm('cast', { c:'holy', over:'sword', fx:skmFx('fall', 'feather', 10) }),
      SKM_SIG,
      skm('float', { c:'holy', over:'cross', burst:'star' }),
      skm('cast', { c:'white', fx:skmFx('orbit', 'feather', 10), over:'pillar' }),
      skm('cast', { c:'holy', over:'cross', fx:skmFx('fall', 'sword', 5) })],
  },
  // 人魚(スネグーラチカ): 氷と水(見せ場は「スプラッシュ」と固有技の「アクアブラスト」)
  Snegurochka: {
    normal:[skm('dash', { c:'ice', over:'slash', burst:'snow' }),
      skm('cast', { c:'blue', line:'whip' }),
      skm('cast', { c:'blue', over:'wave', fx:skmFx('shot', 'water', 5) }),
      SKM_SIG,
      skm('dash', { c:'ice', over:'xslash', burst:'snow' }),
      skm('cast', { c:'blue', line:'whip', over:'boom' }),
      skm('jump', { c:'blue', over:'boom', fx:skmFx('rise', 'water', 12) }),
      skm('cast', { c:'blood', over:'gas' }),
      skm('hop', { c:'holy', over:'wave', fx:skmFx('fall', 'star', 10, { h:50 }) })],
    unique:[skm('cast', { c:'ice', fx:skmFx('shot', 'ice', 3) }),
      skm('cast', { c:'blue', fx:skmFx('shot', 'water', 2, { step:150 }), hit2:true }),
      skm('cast', { c:'ice', over:'ice' }),
      skm('cast', { c:'pink', fx:skmFx('shot', 'heart', 3), burst:'star' }),
      skm('cast', { c:'ice', fx:skmFx('shot', 'ice', 7, { step:30 }), over:'boom' }),
      SKM_SIG,
      skm('cast', { c:'ice', fx:skmFx('fall', 'snow', 18), over:'wave' }),
      skm('cast', { c:'blue', fx:skmFx('orbit', 'bubble', 8), over:'wave' }),
      skm('cast', { c:'holy', fx:skmFx('fall', 'snow', 14), over:'pillar', burst:'star' })],
  },
};
// 同じ名前の技を持つ子は、表を写して見せ場と色だけ変える
const skmRecolor = (set, color) => ({
  normal:set.normal.map(sp => (sp === SKM_SIG ? sp : { ...sp, c:color })),
  unique:set.unique.map(sp => (sp === SKM_SIG ? sp : { ...sp, c:color })),
});
// 見せ場の段階を付け替える。もとの子の見せ場だった段階(通常・固有とも)は replacement にする
const skmWithSig = (set, kind, index, replacement) => ({
  normal:set.normal.map((sp, i) => (kind === 'normal' && i === index ? SKM_SIG : (sp === SKM_SIG ? replacement : sp))),
  unique:set.unique.map((sp, i) => (kind === 'unique' && i === index ? SKM_SIG : (sp === SKM_SIG ? replacement : sp))),
});
const SKILL_MOTION_SETS_MAIN = Object.freeze({
  ...SKILL_MOTION_SETS_BASE,
  // ミタラシ: モッチーの技に炎を入れた(ユーザー指示「ほぼモッチーでちょっと火炎要素」)。見せ場は炎のビーム
  Mitarashi: {
    normal:SKILL_MOTION_SETS_BASE.Mocchi.normal.map((sp, i) => (i === 5 ? skm('cast', { c:'fire', fx:skmFx('orbit', 'fire', 8, { h:20 }), burst:'spark' })
      : i === 7 ? skm('cast', { c:'fire', fx:skmFx('fall', 'fire', 14, { h:20 }), over:'bloom' }) : sp)),
    unique:SKILL_MOTION_SETS_BASE.Mocchi.unique.map((sp, i) => (sp === SKM_SIG ? sp
      : i === 5 ? skm('float', { c:'fire', line:'ray', over:'pillar', fx:skmFx('rise', 'fire', 10, { h:20 }) })
      : i === 6 ? skm('cast', { c:'sky', line:'ray', over:'boom', fx:skmFx('orbit', 'fire', 8, { h:205 }) })
      : { ...sp, c:sp.c === 'mocchi' ? 'fire' : sp.c })),
  },
  // プラント: オボロゲソウと同じ技。見せ場はつる(「根っこ」)
  Plant: skmWithSig(SKILL_MOTION_SETS_BASE.Oboro, 'normal', 2, skm('cast', { c:'plant', fx:skmFx('orbit', 'petal', 8) })),
  // イブリース: アークと同じ詠唱を、闇の色で
  Iblis: skmRecolor(SKILL_MOTION_SETS_BASE.Ark, 'dark'),
  // ウンディーネ・ヤオビクニ: スネグーラチカと同じ並び。最後の技(アクアゲイザー・オーシャンノヴァ)と
  // 固有技4(アクアキッス)だけ名前が違うので、そこを水の動きにする
  Undine: {
    normal:SKILL_MOTION_SETS_BASE.Snegurochka.normal.map((sp, i) => (i === 8 ? skm('cast', { c:'blue', fx:skmFx('rise', 'water', 14), over:'pillar' }) : sp)),
    unique:SKILL_MOTION_SETS_BASE.Snegurochka.unique.map((sp, i) => (i === 3 ? skm('cast', { c:'blue', fx:skmFx('shot', 'heart', 3), burst:'bubble' })
      : i === 8 ? skm('float', { c:'blue', fx:skmFx('fall', 'water', 16), over:'boom' }) : sp)),
  },
});
// ゴースト(2026-10-05): シルクハットの手品師のおばけ。カード・コイン・ハト・ドクロで見せる(専用の動きは無いので見せ場 sig は置かない)
//   並びは HERO_ATK_NAMES.Ghost / unique.names と同じ段階の順
const SKM_GHOST = Object.freeze({
  normal:[
    skm('jump', { c:'pink', over:'fist', burst:'star' }),                                   // ピコピコハンマー
    skm('cast', { c:'cosmic', line:'ray', burst:'spark' }),                                 // ソウルビーム
    skm('float', { c:'white', fx:skmFx('fall', 'feather', 12), burst:'dust' }),             // ハトのおとしもの
    skm('warp', { c:'psy', over:'eye', burst:'star' }),                                     // びっくり
    skm('dash', { c:'dark', burst:'dust' }),                                                // 体当たり
    skm('toss', { c:'red', fx:skmFx('shot', 'blade', 5), burst:'spark' }),                  // カード
    skm('cast', { c:'gold', fx:skmFx('orbit', 'star', 8, { h:45 }), burst:'star' }),        // すてきステッキ
    skm('jab', { c:'dark', over:'fist', burst:'dust' }),                                    // 大パンチ
    skm('spin', { c:'psy', over:'xslash', burst:'star' })],                                 // コンビネーション
  unique:[
    skm('toss', { c:'red', fx:skmFx('shot', 'blade', 8, { step:35 }), over:'slash', burst:'spark' }),        // 連続カード
    skm('cast', { c:'dark', line:'ray', over:'boom', fx:skmFx('orbit', 'ghost', 6) }),                      // ドクロビーム
    skm('float', { c:'white', fx:skmFx('fall', 'meteor', 3, { s:1.6 }), over:'boom', burst:'dust' }),       // 大きなおとしもの
    skm('warp', { c:'dark', fx:skmFx('shot', 'ghost', 5), over:'eye', burst:'star' }),                      // びっくりドクロ
    skm('shake', { c:'gold', fx:skmFx('shot', 'star', 7, { h:[45, 0, 45] }), over:'pillar', burst:'star' }), // スリーセブン
    skm('cast', { c:'psy', fx:skmFx('orbit', 'orb', 8, { h:[280, 45, 190, 330] }), over:'aurora', burst:'spark' }), // Woフォーチュン
    skm('toss', { c:'gold', fx:skmFx('shot', 'blade', 5, { h:45 }), over:'cross', burst:'star' }),          // RSF(ロイヤルストレートフラッシュ)
    skm('hop', { c:'gold', fx:skmFx('lob', 'ring', 3, { s:1.4, h:45 }), over:'boom', burst:'star' }),       // 運命のコイン
    skm('gather', { c:'cosmic', fx:skmFx('orbit', 'ghost', 10), over:'eclipse', burst:'star' })],           // グランドイリュージョン
});
// スプーキー: かぼちゃ頭の魔女。ゴーストと同じ技の並びを、炎と葉の色で。名前が違う2つ(カード・クラブ / グリンネーション)と、
// 運命の輪(Woフォーチュン)はスプーキーらしい動きにする
const SKM_SPOOKY = Object.freeze({
  normal:SKM_GHOST.normal.map((sp, i) => (i === 2 ? sp
    : i === 5 ? skm('toss', { c:'dark', fx:skmFx('shot', 'blade', 5, { h:270 }), over:'cross', burst:'spark' })   // カード・クラブ
    : i === 6 ? skm('cast', { c:'plant', fx:skmFx('orbit', 'leaf', 8), burst:'leaf' })                             // すてきステッキ(枝)
    : i === 8 ? skm('spin', { c:'plant', fx:skmFx('rise', 'leaf', 10), over:'tornado', burst:'leaf' })            // グリンネーション
    : { ...sp, c:'fire' })),
  unique:SKM_GHOST.unique.map((sp, i) => (i === 5 ? skm('spin', { c:'psy', fx:skmFx('orbit', 'orb', 8, { h:[30, 280, 120, 330] }), over:'aurora', burst:'spark' }) // Woフォーチュン(運命の輪)
    : i === 1 ? skm('cast', { c:'fire', line:'ray', over:'boom', fx:skmFx('orbit', 'flame', 6) })
    : i === 8 ? skm('gather', { c:'fire', fx:skmFx('orbit', 'flame', 10), over:'eclipse', burst:'star' })
    : i === 7 ? sp
    : { ...sp, c:sp.c === 'gold' ? 'gold' : 'fire' })),
});
// ヤオビクニはウンディーネと同じ技の並び(色は深い赤へ)
const SKILL_MOTION_SETS = Object.freeze({ ...SKILL_MOTION_SETS_MAIN, Yaobikuni:skmRecolor(SKILL_MOTION_SETS_MAIN.Undine, 'red'), Ghost:SKM_GHOST, Spooky:SKM_SPOOKY });

// 本体の動きごとの [当たる時刻の割合, 既定の尺ms]。70-bootstrap.jsx の .skfx-body--◯◯ の keyframes で、敵に届く位置に合わせてある
const SKM_BODY_TIMING = Object.freeze({ bash:[.48,560], dive:[.62,760], roll:[.5,780], flip:[.62,840], toss:[.6,720], cast:[.55,700],
  slash:[.46,720], lick:[.42,640], kick:[.44,620], spin:[.54,780], jump:[.58,760], float:[.58,820], dash:[.26,620], shake:[.5,720],
  hop:[.5,720], warp:[.5,760], jab:[.4,620],
  // 2026-10-02 パンドラ: gather 魔力集束(光と闇をまとって溜める) / split 分裂(光と闇の2体に分かれて手を取り合う)
  gather:[.55,900], split:[.6,1100] });
// その場から撃つ動き。当たる時刻は飛ぶものが届く時刻で決まる
const SKM_PROJECTILE_BODIES = Object.freeze(['cast', 'toss', 'shake', 'hop']);
// 敵に重ねる絵が、当たってから消えるまでの長さ(ms)。尺がこれより短いと途中で切れる
const SKM_OVER_TAIL = Object.freeze({ thunder:220, xslash:300, claw:220, pillar:300, tornado:320, ice:440, bite:180, boom:460, wave:560,
  bloom:360, gas:480, cross:360, sword:180, eye:260, fist:160, slash:220, aurora:320, shadow:200,
  // 2026-10-02 パンドラ: eclipse 相反爆発(黒い核と白い閃光) / twinThunder 反発雷撃(紫と金の雷が交差)
  eclipse:460, twinThunder:420 });
const SKM_MAX_MS = 1200;
const skmArrival = (fx) => {
  if (!fx || !fx.items.length) return null;
  const at = (b) => (b.d || 0) + (fx.path === 'rise' ? fx.dur * .25 : fx.path === 'orbit' ? fx.dur * .92 : fx.dur);
  const times = fx.items.map(at);
  return { first:Math.round(Math.min(...times)), last:Math.round(Math.max(...times)) };
};
// ==== 固有技の格上げ(2026-10-02 ユーザー指示「通常とモーションの使い回しも多いから固有技はもっとかっこよくしてほしい」) ====
// 固有技(型の名前が '<id>-u<段階>')だけ、通常技と同じ部品の組み合わせでも次のように派手にする。
//   飛ぶものを1.5倍に増やして大きく / 着弾は必ず二段(hit2) / 着弾の小片を増やして大きく(無ければ星) / 尺を100ms延ばして余韻を出す
// さらに、使う子のオーラ・残像と敵の上の光柱・地割れを SkillFxMotion / ThemedAttackMotion が足す(UniqueFxExtras / UniqueFxImpact)。
// 設定資料どおりに作り込んだ技(パンドラのエクリプスノヴァ・ダイスキライライ)は、そのままにする
const UNIQUE_FX_EXCLUDE = Object.freeze(['Pandora-u7', 'Pandora-u8']);
const skmBoostFx = (fx) => {
  if (!fx || !fx.items || !fx.items.length) return fx;
  const extra = fx.items.slice(0, 12).map((b, i) => ({ ...b, x:-(b.x || 0) * .7 + (i % 2 ? 9 : -9), y:-(b.y || 0) * .6 - 6, d:(b.d || 0) + 26 + (i % 3) * 8, s:(b.s || 1) * 1.2 }));
  return { ...fx, items:fx.items.concat(extra) };
};
const SKM_UNIQUE_BITS = Object.freeze([{x:-34,y:-22,s:1.3},{x:32,y:-26,s:1.3},{x:-36,y:18,s:1.2},{x:34,y:16,s:1.2},{x:0,y:-40,s:1.4},{x:-16,y:26,s:1.1},{x:18,y:28,s:1.1},{x:-44,y:-2,s:1.1},{x:44,y:0,s:1.1},{x:0,y:-14,s:1.5}]);
// ==== 固有技の「着弾の型」(2026-10-02 ユーザー指示「固有技エフェクトで最後に光の柱が出るのが目立って全部似たような技に見えがち」→ 案1「属性ごとの着弾の型」) ====
// 共通の光の柱をやめ、技の色(属性)ごとに敵の上の締めを変える。光の柱が出るのは光(light)の技だけ。
//   fire 噴き上がる炎 / ice 氷柱が突き出す / bolt 稲妻が落ちる / water 水柱としぶき / void 黒い渦に吸い込まれる /
//   thorn つるのとげが伸びる / rubble 岩が降り砕ける / slash 斬撃の筋 / psy 魔法陣と星 / bloom 花びらとハート /
//   rend 爪あとと血しぶき / light 光の柱と地割れ / burst 小さな衝撃(既定)
// 型は技の定義(skm の form)で上書きできる。書かなければ色の名前から決まる
const SKM_FORM_OF_COLOR = Object.freeze({
  fire:'fire', red:'fire', ice:'ice', thunder:'bolt', blue:'water', sky:'water', holy:'light', gold:'light', white:'light', dark:'void',
  plant:'thorn', gas:'thorn', rock:'rubble', wind:'slash', psy:'psy', cosmic:'psy', pink:'bloom', mocchi:'bloom', sakura:'bloom', blood:'rend',
});
const skmFormOf = (c) => (typeof c === 'string' && SKM_FORM_OF_COLOR[c]) || 'burst';
// 色から決まる型が、技の中身と合わない・同じ子の技で重なるときの上書き(型の名前 '<モンスターid>-u<段階>' → 型)。
// 金色(light)の技が多く、全部が光の柱になっていたので、技の名前に合わせて散らした
const SKM_FORM_OVERRIDE = Object.freeze({
  'Mocchi-u5':'bloom', 'Mocchi-u7':'psy',
  'Mitarashi-u7':'fire', 'Mitarashi-u8':'rubble',
  'Ham-u1':'bolt', 'Ham-u7':'rubble', 'Golem-u0':'rubble',
  'Tiger-u4':'bolt', 'Tiger-u6':'ice', 'Pixie-u1':'psy', 'Pixie-u6':'bolt',
  'Suezo-u2':'rend', 'Monol-u1':'void', 'Monol-u5':'rubble', 'Oboro-u3':'bloom', 'Plant-u3':'bloom',
  'KenshiMocchi-u3':'slash', 'Snegurochka-u8':'ice',
  'Ark-u0':'psy', 'Ark-u2':'bolt', 'Ark-u3':'bloom', 'Ark-u4':'slash', 'Ark-u6':'psy',
});
const skmNormalize = (sp0, isUnique = false) => {
  const sp = isUnique ? { ...sp0, fx:skmBoostFx(sp0.fx), hit2:sp0.hit2 ?? true, bits:sp0.bits || SKM_UNIQUE_BITS, burst:sp0.burst || 'star' } : sp0;
  const [ratio, bodyMs] = SKM_BODY_TIMING[sp.body] || [.5, 700];
  const [c1, c2] = Array.isArray(sp.c) ? sp.c : (SKM_COLOR[sp.c] || SKM_COLOR.white);
  const tail = Math.max(sp.over ? (SKM_OVER_TAIL[sp.over] || 260) : 200, sp.hit2 ? 380 : 0);
  const arrival = skmArrival(sp.fx);
  let hit; let ms;
  if (sp.hit != null) { hit = sp.hit; ms = sp.ms ?? Math.max(bodyMs, hit + tail + 80); }
  else if (SKM_PROJECTILE_BODIES.includes(sp.body) && arrival) {
    hit = arrival.first; ms = sp.ms ?? Math.max(bodyMs, hit + tail + 80, arrival.last + 160);
  } else {
    ms = sp.ms ?? Math.max(bodyMs, Math.round((tail + 80) / (1 - ratio)), arrival ? arrival.last + 160 : 0);
    hit = Math.round(ratio * ms);
  }
  if (isUnique) ms += 100;
  ms = Math.min(SKM_MAX_MS, Math.round(ms));
  const bits = sp.bits || [{x:-28,y:-20},{x:26,y:-24},{x:-30,y:16},{x:30,y:14},{x:0,y:-34}];
  return { body:sp.body, line:sp.line, fx:sp.fx, over:sp.over, burst:sp.burst, twin:sp.twin === true, bits, c1, c2, form:sp.form || skmFormOf(sp.c), hit:Math.round(hit),
    ...(sp.hit2 ? { hit2:Math.round(hit + 180) } : {}), ms };
};
// 型の名前(ユグドラシル種は 'ygHeadbutt' など、ほかの子は '<モンスターid>-n<段階>' / '-u<段階>')から、見た目の組み合わせを返す
const SKILL_FX_SPEC_CACHE = {};
// ユグドラシル種・メルホイップの固有技(かしこさの10個)も、skmNormalize の固有技の格上げと同じ考え方で派手にする
const YG_UNIQUE_KINDS = Object.freeze(['ygStarBomb', 'ygWonderBlaze', 'ygManyWing', 'ygRiceShower', 'ygMeteor', 'ygPapillon', 'ygHeavyRain', 'ygEternalArc', 'ygAurora', 'ygCosmo']);
// ユグドラシル種・メルホイップの固有技の着弾の型(技の名前ごとの固定の定義なので、ここに書く)
const YG_UNIQUE_FORM = Object.freeze({ ygStarBomb:'psy', ygWonderBlaze:'fire', ygManyWing:'thorn', ygRiceShower:'light', ygMeteor:'rubble',
  ygPapillon:'bloom', ygHeavyRain:'water', ygEternalArc:'slash', ygAurora:'light', ygCosmo:'psy' });
const skillFxStaticOf = (kind) => {
  const base = SKILL_FX_SPECS[kind];
  const spec = { ...base, ms:THEMED_ATTACK_MS[kind] || 600 };
  if (!YG_UNIQUE_KINDS.includes(kind)) return spec;
  const extraBits = SKM_UNIQUE_BITS.slice(0, 5).map((b, i) => ({ ...b, h:(base.bits && base.bits[i] && base.bits[i].h) || 0 }));
  return { ...spec, fx:skmBoostFx(base.fx), hit2:base.hit2 ?? Math.round(base.hit + 180), bits:(base.bits || []).concat(extraBits), burst:base.burst || 'star', form:YG_UNIQUE_FORM[kind] || 'burst' };
};
const skillFxSpecOf = (kind) => {
  if (!kind) return null;
  if (SKILL_FX_SPECS[kind]) return skillFxStaticOf(kind);
  if (SKILL_FX_SPEC_CACHE[kind]) return SKILL_FX_SPEC_CACHE[kind];
  const m = /^([A-Za-z]+)-([nu])(\d)$/.exec(String(kind));
  const sp = m && SKILL_MOTION_SETS[m[1]] && SKILL_MOTION_SETS[m[1]][m[2] === 'u' ? 'unique' : 'normal'][Number(m[3])];
  if (!sp || sp === SKM_SIG) return null;
  const norm = skmNormalize(sp, m[2] === 'u' && !UNIQUE_FX_EXCLUDE.includes(kind));
  SKILL_FX_SPEC_CACHE[kind] = SKM_FORM_OVERRIDE[kind] ? { ...norm, form:SKM_FORM_OVERRIDE[kind] } : norm;
  return SKILL_FX_SPEC_CACHE[kind];
};
// 歌う技にマイクを出すかどうか。ミーアの技だけ(2026-10-03 ユーザー指示「ミーア以外はマイク出さないで」)
const SKFX_MIC_KIND = (kind) => /^Mia-/.test(String(kind));
const SkillFxMotion = ({kind, image, lunge=false}) => {
  const spec = skillFxSpecOf(kind);
  if (!spec) return null;
  const ms = spec.ms || 600;
  // 光のふちは c2 を透明にした色へ消す(透明な黒へ消すと、ふちが灰色に濁った)
  const hex = String(spec.c2).replace('#', '');
  const c3 = hex.length === 6 ? `rgba(${parseInt(hex.slice(0, 2), 16)},${parseInt(hex.slice(2, 4), 16)},${parseInt(hex.slice(4, 6), 16)},0)` : 'rgba(255,255,255,0)';
  const vars = { '--thm-ms':`${ms}ms`, '--hit-at':`${spec.hit}ms`, '--c1':spec.c1, '--c2':spec.c2, '--c3':c3 };
  if (spec.hit2) vars['--hit-at2'] = `${spec.hit2}ms`;
  const fx = spec.fx;
  const uex = lunge && !UNIQUE_FX_EXCLUDE.includes(kind);
  return (
    <span className={`thm-atk skfx skfx--${kind} skfx-body--${spec.body}${lunge?' thm-atk--lunge':''}${uex?' uex':''}`} style={vars} data-skill-fx={kind}>
      {uex&&<UniqueFxExtras image={image} ghost={!spec.twin}/>}
      {spec.twin&&['dark','light'].map(side=><span key={side} className={`skfx-twin skfx-twin--${side}`} aria-hidden="true">{React.cloneElement(image,{alt:''})}</span>)}
      <span className="thm-atk__monster">{image}</span>
      {/* 音楽系の技(ミーアの歌・音符の技)はマイクを出す。専用の歌モーション(MiaSongNotesMotion)と同じマイクの絵を使う */}
      {SKFX_MIC_KIND(kind)&&<span className="skfx-mic" aria-hidden="true">
        <i className="mia-song-notes__mic-body"/>
        <i className="mia-song-notes__mic-clip"/>
        <i className="mia-song-notes__mic-pole mia-song-notes__mic-pole--upper"/>
        <i className="mia-song-notes__mic-pole"/>
        <i className="mia-song-notes__mic-joint"/>
        <i className="mia-song-notes__mic-base"/>
      </span>}
      {spec.line&&<span className={`thm-atk__line skfx-line skfx-line--${spec.line}`} aria-hidden="true"><i/></span>}
      {fx&&<span className="thm-atk__flys skfx-layer" aria-hidden="true">{fx.items.map((b, i) => (
        <i key={i} className={`skfx-p skfx-p--${fx.shape} skfx-path--${fx.path}`}
          style={{'--px':`${b.x||0}px`,'--py':`${b.y||0}px`,'--ps':b.s||1,'--ph':b.h??0,animationDelay:`${b.d||0}ms`,animationDuration:`${fx.dur}ms`}}/>
      ))}</span>}
      {spec.over&&<span className={`thm-atk__hit skfx-over skfx-over--${spec.over}`} aria-hidden="true"><i/><i/><i/></span>}
      <span className="thm-atk__hit" aria-hidden="true">
        <i className="thm-atk__core"/>
        <i className="thm-atk__ring"/>
        {(spec.bits||[]).map((b, i) => (
          <i key={i} className={`thm-atk__bit${spec.burst?` skfx-bit skfx-p--${spec.burst}`:''}`}
            style={{'--bx':`${b.x||0}px`,'--by':`${b.y||0}px`,'--bs':b.s||1,'--ph':b.h??0}}/>
        ))}
      </span>
      {spec.hit2&&<span className="thm-atk__hit thm-atk__hit--2" aria-hidden="true">
        <i className="thm-atk__core"/>
        <i className="thm-atk__ring"/>
      </span>}
      {uex&&<UniqueFxImpact form={spec.form || 'burst'} offset={(spec.hit || 0) - 240}/>}
    </span>
  );
};
// 固有技だけに足す部品。使う子のオーラ(光の球と広がる輪)と、動きの残像2つ(同じ動きを少し遅れて追う)
const UniqueFxExtras = ({ image, ghost = true }) => (
  <>
    <span className="uex-aura" aria-hidden="true"><i/><i/><i/></span>
    {ghost && [1, 2].map(n => <span key={n} className={`uex-ghost uex-ghost--${n}`} aria-hidden="true">{React.cloneElement(image, { alt:'' })}</span>)}
  </>
);
// 敵の上へ当たった瞬間の、固有技だけの重ね絵: 空から落ちる光柱・足元に走る地割れの輪・白い閃光
// form … 着弾の型(skmFormOf)。'light' だけ従来の光柱と地割れ、'none' は閃光だけ(見せ場の動きは SpecialFinish が締めを持つ)、
//        それ以外は UNIQUE_IMPACT_FORMS の部品(SpecialFinish と同じ部品)を、当たる瞬間(offset+240ms)に合わせて重ねる
const UNIQUE_IMPACT_FORMS = Object.freeze({
  fire:   [{t:'col',w:60,h:300,d:240,flame:true},{t:'col',w:44,h:240,d:290,flame:true,x:-46},{t:'col',w:44,h:240,d:290,flame:true,x:46},{t:'bits',n:10,shape:'flame',dist:100,d:300,rise:true},{t:'ring',d:260,r:3,flat:.45}],
  ice:    [{t:'spike',w:36,h:210,d:240},{t:'spike',w:28,h:160,d:280,x:-46},{t:'spike',w:28,h:160,d:280,x:46},{t:'spike',w:20,h:110,d:320,x:-80},{t:'spike',w:20,h:110,d:320,x:80},{t:'bits',n:10,shape:'spark',dist:100,d:340},{t:'ring',d:260,r:3,flat:.45}],
  bolt:   [{t:'bolt',w:84,h:440,d:240},{t:'bolt',w:56,h:380,d:300,x:-62},{t:'bolt',w:56,h:380,d:330,x:66},{t:'ring',d:280,r:3},{t:'bits',n:8,shape:'spark',dist:100,d:300}],
  water:  [{t:'col',w:56,h:300,d:240,water:true},{t:'wave',d:300},{t:'bits',n:12,shape:'drop',dist:110,d:300},{t:'ring',d:260,r:3.2,flat:.45}],
  void:   [{t:'bits',n:14,shape:'spark',dist:130,d:160,in:true},{t:'ring',d:200,r:3.4,flat:.5,void:true},{t:'bits',n:10,shape:'spark',dist:120,d:480}],
  thorn:  [{t:'spike',w:24,h:170,d:240,x:-42,thorn:true},{t:'spike',w:28,h:210,d:270,thorn:true},{t:'spike',w:24,h:170,d:300,x:42,thorn:true},{t:'bits',n:10,shape:'leaf',dist:110,d:340},{t:'ring',d:260,r:2.8,flat:.45}],
  rubble: [{t:'fall',n:6,shape:'rock',d:200},{t:'ring',d:420,r:3.8,flat:.4},{t:'bits',n:10,shape:'dust',dist:110,d:420}],
  slash:  [{t:'blade',a:-60,len:300,w:8,d:240},{t:'blade',a:-60,len:300,w:8,d:290,x:-22},{t:'blade',a:-60,len:300,w:8,d:340,x:22},{t:'bits',n:8,shape:'spark',dist:90,d:340}],
  psy:    [{t:'ring',d:240,r:3.2,flat:.45,rune:true},{t:'ring',d:340,r:4},{t:'bits',n:12,shape:'star',dist:120,d:300}],
  bloom:  [{t:'bits',n:14,shape:'petal',dist:130,d:260,spin:1},{t:'bits',n:8,shape:'heart',dist:90,d:320},{t:'ring',d:280,r:3}],
  rend:   [{t:'blade',a:-50,len:300,w:10,d:240},{t:'blade',a:-50,len:300,w:10,d:300,x:30},{t:'blade',a:-50,len:300,w:10,d:360,x:-30},{t:'bits',n:12,shape:'drop',dist:110,d:340}],
  burst:  [{t:'ring',d:260,r:3.2},{t:'bits',n:10,shape:'star',dist:110,d:300}],
});
// 型ごとの決まった色(明・濃)。技の色が白や金のままだと、炎が青白く見えるなど型と合わなくなるので、型の絵はこの色で出す。
// slash / burst / light / none は技の色のまま
const UNIQUE_IMPACT_PALETTE = Object.freeze({
  fire:['#fef3c7', '#f97316'], ice:['#e0f2fe', '#38bdf8'], bolt:['#fef9c3', '#facc15'], water:['#e0f2fe', '#3b82f6'], void:['#ede9fe', '#6d28d9'],
  thorn:['#bbf7d0', '#16a34a'], rubble:['#e7d7c1', '#a8865f'], bloom:['#fce7f3', '#ec4899'], rend:['#fee2e2', '#dc2626'], psy:['#fae8ff', '#c026d3'],
});
const UniqueFxImpact = ({ form = 'light', offset = 0 }) => {
  const parts = UNIQUE_IMPACT_FORMS[form];
  const pal = UNIQUE_IMPACT_PALETTE[form];
  return (
    <span className="thm-atk__hit uex-impact" aria-hidden="true" data-impact-form={form}
      style={{ '--spm-c1':pal ? pal[0] : 'var(--c1, #fff)', '--spm-c2':pal ? pal[1] : 'var(--c2, #c026d3)' }}>
      {form === 'light' && <><i className="uex-pillar"/><i className="uex-crack"/></>}
      <i className="uex-flash"/>
      {parts && <SpecialFinish parts={parts} offset={Math.max(0, offset)}/>}
    </span>
  );
};
const ThemedAttackMotion = ({kind, image, lunge=false}) => {
  if (skillFxSpecOf(kind)) return <SkillFxMotion kind={kind} image={image} lunge={lunge}/>;
  const bits = THEMED_ATTACK_BITS[kind] || {};
  const ms = THEMED_ATTACK_MS[kind];
  const px = (v) => `${v || 0}px`;
  return (
    <span className={`thm-atk thm-atk--${kind}${lunge?' thm-atk--lunge uex':''}`} style={ms?{'--thm-ms':`${ms}ms`}:undefined}>
      {lunge&&<UniqueFxExtras image={image} ghost={kind!=='claw'}/>}
      {kind==='magic'&&<span className="thm-atk__circle" aria-hidden="true"><i/><i/></span>}
      {/* ライガーの残像。本体と同じカクカクの動きを少し遅れて追いかける */}
      {kind==='claw'&&[1,2].map(n=>(
        <span key={n} className={`thm-atk__ghost thm-atk__ghost--${n}`} aria-hidden="true">{image}</span>
      ))}
      <span className="thm-atk__monster">{image}</span>
      {THEMED_ATTACK_LINE_KINDS.includes(kind)&&<span className="thm-atk__line" aria-hidden="true"><i/></span>}
      {bits.fly&&<span className="thm-atk__flys" aria-hidden="true">{bits.fly.map((b,i)=>(
        <i key={i} className="thm-atk__fly" style={{'--fx':px(b.x),'--fy':px(b.y),animationDelay:`${b.d}ms`}}/>
      ))}</span>}
      <span className="thm-atk__hit" aria-hidden="true">
        <i className="thm-atk__core"/>
        <i className="thm-atk__ring"/>
        <ThemedAttackBits list={bits.hit}/>
      </span>
      {bits.hit2&&<span className="thm-atk__hit thm-atk__hit--2" aria-hidden="true">
        <i className="thm-atk__core"/>
        <i className="thm-atk__ring"/>
        <ThemedAttackBits list={bits.hit2}/>
      </span>}
      {lunge&&<UniqueFxImpact form="none"/>}
    </span>
  );
};
// ==== タクティクスのEXスキルを使った瞬間のカットイン(2026-09-26 ユーザー指示「EXスキルが演出もなくて寂しい。特別なアクションだから演出はつけてほしい」) ====
// 画面を暗くして、斜めの帯に使った子の立ち絵と「EX SKILL / EX名」を流し、効果の種類ごとの模様と色を重ねる。
// 使った子の距離枠にも同じ色の光(.ex-aura)を出す(71-screen-battle.jsx)。
// 見た目だけで、押せる場所は塞がない(pointer-events:none)。バトルの進行も止めない。
// 色と模様は効果の種類(effect)で決める。モンスターごとには分けない(EXを足しても効果が同じなら同じ演出)
const TACTICS_EX_CUTIN_MS = 1600;
const TACTICS_EX_CUTIN_THEME = Object.freeze({
  coverAll:     { c1:'#ddd6fe', c2:'#7c3aed', motif:'shield' }, // みんなをかばう: 紫の盾
  allIn:        { c1:'#fed7aa', c2:'#dc2626', motif:'flame' },  // 捨て身: 赤い炎
  statBoost:    { c1:'#fef08a', c2:'#f59e0b', motif:'rise' },   // ガッツ全開っちー: 金の光が立ちのぼる
  weaponChange: { c1:'#cffafe', c2:'#0891b2', motif:'blade' },  // ソード・コンバージョン: 青い斬撃
  heal:         { c1:'#bbf7d0', c2:'#10b981', motif:'rise' },   // 緊急回復(2026-09-29): 緑の光が立ちのぼる
  partyGuard:   { c1:'#bbf7d0', c2:'#15803d', motif:'shield' }, // 世界樹の守り: 緑の盾
  comboBurst:   { c1:'#fbcfe8', c2:'#db2777', motif:'rise' },   // スイーツパラダイス: 桃色の光
  // ★2026-10-06 EXが全員そろったので、効果ごとに色と動きを分けた(それまでは default の桃紫の光ばかりだった)
  distMatch:    { c1:'#fecdd3', c2:'#e11d48', motif:'blade' },   // 緋桜瞬歩: 緋色の斬撃
  dodgeCombo:   { c1:'#fecaca', c2:'#b91c1c', motif:'blade' },   // 血踊: 血の色の斬撃
  multiBuff:    { c1:'#fde68a', c2:'#b45309', motif:'flame' },   // 抗えぬ宿命・堕天の烙印・お気に入りの魔法: 燃えるオーラ
  stage:        { c1:'#fbcfe8', c2:'#be185d', motif:'note' },    // オン・ステージ！: 音符が舞う
  present:      { c1:'#fecaca', c2:'#16a34a', motif:'petal' },   // クリスマスプレゼント: きらきらの粒
  lifeSpring:   { c1:'#bae6fd', c2:'#0284c7', motif:'drop' },    // 生命の泉: 水のしずくが立ちのぼる
  timeStop:     { c1:'#e0f2fe', c2:'#475569', motif:'ring' },    // 悠久の刻: 時計の輪が広がる
  pandoraBox:   { c1:'#fae8ff', c2:'#7e22ce', motif:'wing' },    // パンドラの箱: 光と闇の羽
  thunder:      { c1:'#fef9c3', c2:'#eab308', motif:'spark' },   // 雷狼影: 稲妻
  partyBoost:   { c1:'#d9f99d', c2:'#16a34a', motif:'petal' },   // 緑のめぐみ: 緑の葉
  damageBack:   { c1:'#e9d5ff', c2:'#6d28d9', motif:'ring' },    // おぼろ返し: 朧の輪
  psychoLock:   { c1:'#fbcfe8', c2:'#7c3aed', motif:'ring' },    // サイコロックオン: 念力の輪
  counter:      { c1:'#fed7aa', c2:'#ea580c', motif:'fist' },    // ハムボクシング: 拳の衝撃
  avoidCharge:  { c1:'#e9d5ff', c2:'#6d28d9', motif:'blade' },   // オフリィアボイド: 紫の残像(すり抜ける)
  trickConfuse: { c1:'#fed7aa', c2:'#9333ea', motif:'rise' },   // トリックコンフューズ: かぼちゃ色と紫の光
  cookieBox:    { c1:'#fce7f3', c2:'#ec4899', motif:'rise' },    // おねがい♪メロディボックス: ピンクのクッキーが舞う
  nightmareKey: { c1:'#f5d0fe', c2:'#3b0764', motif:'blade' },   // 悪夢全開！メロディ・キー: 黒紫の悪夢
  default:      { c1:'#f5d0fe', c2:'#c026d3', motif:'rise' },
});
const tacticsExCutinTheme = (effect) => TACTICS_EX_CUTIN_THEME[effect] || TACTICS_EX_CUTIN_THEME.default;
// カットインの色。アシストカードはカードごとの色(cutin.theme)を持つ
const battleCutinThemeOf = (cutin) => (cutin && cutin.theme) || tacticsExCutinTheme(cutin && cutin.effect);
// ★2026-09-29 ユーザー選択で、アシストカード(「助手のカットイン」)と緊急回復(「EX風のカットイン」)も同じ部品で出す。
//   variant … 'ex'(EXスキル・1600ms) / 'assist'(細い帯を画面の上のほうに・短い) / 'emergency'(EXと同じ帯・緑)
//   icon があれば立ち絵の代わりにその絵(アシストカードの顔アイコン・💊)を出す。ms は尺(CSSの --cut-ms)
const TacticsExCutin = ({ cutin }) => {
  if (!cutin) return null;
  const t = battleCutinThemeOf(cutin);
  const variant = cutin.variant || 'ex';
  // 盤面の入れ物(transform を持つことがある)の中だと fixed が画面いっぱいにならないので、body へ出す
  return ReactDOM.createPortal(
    <div key={cutin.key} data-tactics-ex-cutin={cutin.effect || 'default'} data-battle-cutin={variant} className={`ex-cutin ex-cutin--${variant}`}
      style={{ '--ex-c1':t.c1, '--ex-c2':t.c2, ...(cutin.ms ? { '--cut-ms':`${cutin.ms}ms` } : {}) }} aria-hidden="true">
      <div className="ex-cutin__shade"/>
      <div className="ex-cutin__rays"/>
      <div className={`ex-cutin__motif ex-cutin__motif--${t.motif}`}>{[0,1,2,3,4,5].map(i => <i key={i} style={{ '--i':i }}/>)}</div>
      <div className="ex-cutin__band">
        <div className="ex-cutin__lines"/>
        <div className="ex-cutin__art">
          {cutin.icon
            ? <span className="ex-cutin__icon">{isImageIconValue(cutin.icon) ? cardIconNode(cutin.icon, variant === 'assist' ? 96 : 120, cutin.cardId) : <span className="ex-cutin__emoji">{cutin.icon}</span>}</span>
            : <DyedMonsterImage baseId={cutin.monId} src={cutin.imgUrl} alt="" masuColors={cutin.colors} draggable={false} className="w-full h-full object-contain"/>}
        </div>
        <div className="ex-cutin__text">
          <div className="ex-cutin__tag">{cutin.tag || 'EX SKILL'}</div>
          {/* 名前は1行に収める(「みんなをか/ばう」のように途中で折り返さない)。長い名前ほど字を小さくする */}
          <div className="ex-cutin__name" style={{ fontSize:`${Math.max(15, Math.min(30, Math.floor(165 / Math.max(1, String(cutin.exName || '').length))))}px` }}>{cutin.exName}</div>
          <div className="ex-cutin__sub">{cutin.monName}{cutin.styleLabel ? ` ／ ${cutin.styleLabel}` : ''}</div>
          {cutin.note ? <div data-ex-cutin-note className="ex-cutin__note">{cutin.note}</div> : null}
        </div>
      </div>
      <div className="ex-cutin__flash"/>
    </div>,
    document.body
  );
};
// ==== EXの説明文(2026-10-06 ユーザー指示「説明欄の見やすさ」) ====
// def.desc の書き方: 1行目＝要約 / 「・」で始まる行＝効果の項目 / 全角空白で始まる行＝その項目の細かい内訳 / 「◯◯：…」の行＝名前つきの項目。
// 図鑑と、距離枠から開く詳細の両方で同じ見た目にする(文字そのものは変えず、段と印だけを付ける)
const ExDescText = ({ text }) => {
  const lines = String(text || '').split('\n').filter(l => l.trim() !== '');
  if (!lines.length) return null;
  const isBullet = (l) => /^[・　]/.test(l);
  const lead = isBullet(lines[0]) ? null : lines[0];
  const rest = lead ? lines.slice(1) : lines;
  return (<>
    {lead ? <p className="ex-desc__lead">{lead}</p> : null}
    {rest.length ? <ul className="ex-desc__list">{rest.map((l, i) => {
      if (/^　/.test(l)) return <li key={i} className="ex-desc__sub">{l.replace(/^[　\s]+/, '')}</li>;
      const body = l.replace(/^・/, '');
      const m = /^([^：]{1,12})：(.*)$/.exec(body);
      return <li key={i} className="ex-desc__item">{m ? <><b className="text-fuchsia-200">{m[1]}</b>：{m[2]}</> : body}</li>;
    })}</ul> : null}
  </>);
};
// ==== ガードのバリア(2026-09-29 ユーザー選択「案A バリア」) ====
// ガードを置いた子の枠に六角形の光の壁を重ねる。ガードの段階(GUARD_EVOLUTION)が上がるほど、
// 色(銅→銀→金→水晶→虹)と飾り(内側の輪・六角の網目・回る紋)が豪華になる。
// state … 'idle' 構えている / 'block' 受け止めきった(光って火花が跳ね返る) / 'break' 受けきれなかった(割れて破片が飛ぶ)
// 見た目だけ。押せる場所は塞がない(pointer-events:none)
const GUARD_BARRIER_TIERS = Object.freeze(['bronze', 'bronze', 'silver', 'silver', 'gold', 'gold', 'crystal', 'crystal', 'rainbow']);
const guardBarrierTierOf = (level) => GUARD_BARRIER_TIERS[Math.max(0, Math.min(GUARD_BARRIER_TIERS.length - 1, Math.floor(Number(level) || 0)))];
const GuardBarrier = ({ tier = 'bronze', state = 'idle' }) => (
  <span data-guard-barrier={state} data-guard-tier={tier} className={`guard-barrier guard-barrier--${tier} guard-barrier--${state}`} aria-hidden="true">
    <svg className="guard-barrier__svg" viewBox="0 0 100 100" preserveAspectRatio="none">
      <polygon className="guard-barrier__hex" points="25,3 75,3 98,50 75,97 25,97 2,50"/>
      <polygon className="guard-barrier__hex2" points="31,13 69,13 88,50 69,87 31,87 12,50"/>
    </svg>
    <i className="guard-barrier__ring"/>
    {state === 'block' && [0,1,2,3,4,5].map(k => <i key={k} className="guard-barrier__spark" style={{ '--k':k }}/>)}
    {state === 'break' && [0,1,2,3,4,5,6,7].map(k => <i key={k} className="guard-barrier__shard" style={{ '--k':k }}/>)}
  </span>
);
// ==== 固有技(必殺技)に必ず乗る共通の演出(2026-10-02 ユーザー指示「全てのモンスターの固有技のモーションを強化してほしい。固有技(必殺技)なのに通常技とそこまで差別化できてない」) ====
// 技ごとの動き(SKILL_MOTION_SETS・専用モーション)はそのままに、その上へ「特別な技が出る」格をそろえて足す。
//   タメのあいだ … 画面が暗くなる / 使う子へ光が集まる / 斜めの帯に「必殺技 ／ 技名」が流れ込む
//   放った瞬間   … 閃光 / 敵の上で広がる衝撃の輪と放射線 / (60-app.jsx 側で)画面の揺れ・効果音・大きな金色のダメージ数字
// 見た目だけ。押せる場所は塞がず(pointer-events:none)、進行も待たない。時間は固有技の流れ(タメ650ms→動き)にそのまま乗る。
// 色は技ごとの色(SKILL_MOTION_SETS の c)があればそれ、無ければ(見せ場の動き 'sig' など)その子の色。
const SPECIAL_MOVE_MON_COLOR = Object.freeze({
  Mocchi:'mocchi', Suezo:'psy', Golem:'gold', Tiger:'thunder', Ham:'gold', Pixie:'psy', Mia:'pink', Pandora:'thunder',
  Monol:'dark', Oboro:'sky', Plant:'plant', Zan:'blood', Eiki:'sakura', KenshiMocchi:'cosmic', Mitarashi:'fire',
  Ark:'holy', Iblis:'dark', Snegurochka:'ice', Undine:'blue', Yaobikuni:'sky', Yggdrasil:'plant', MelWhip:'pink',
});
const specialMoveColorOf = (monId, skillName) => {
  const pick = (c) => (Array.isArray(c) ? c : SKM_COLOR[c] || null);
  // ユグドラシル種・メルホイップは、技名ごとの固定の定義(SKILL_FX_SPECS)の色
  const staticKind = typeof SKILL_ATTACK_THEMES !== 'undefined' ? SKILL_ATTACK_THEMES[skillName] : null;
  if (staticKind && SKILL_FX_SPECS[staticKind] && SKILL_FX_SPECS[staticKind].c1) return [SKILL_FX_SPECS[staticKind].c1, SKILL_FX_SPECS[staticKind].c2];
  let hit = null;
  try { hit = typeof skillMotionSlotOf === 'function' ? skillMotionSlotOf(monId, skillName, true) : null; } catch (e) { hit = null; }
  const own = hit && hit.spec && hit.spec !== 'sig' ? pick(hit.spec.c) : null;
  return own || pick(SPECIAL_MOVE_MON_COLOR[monId]) || SKM_COLOR.gold;
};
// ==== 固有技のフィニッシュ(2026-10-02 ユーザー指示「みんな進めて」=通常技と使い回している見せ場の動きを、固有技だけ別物にする) ====
// 見せ場の動き(専用モーション・体当たり型)は、通常技と固有技の両方で同じ動きが出ていた。固有技が放たれる瞬間に、
// 動きの種類ごとの「フィニッシュ」を敵の上へ重ねる(巨大なX斬り・桜の嵐・音符の爆発・炎の柱…)。
// 部品は data 駆動(blade 斬撃 / ring 輪 / bits 粒 / col 柱 / fall 落下物 / wave 大波)。形は 70-bootstrap.jsx の .fin-*。
// d は放った瞬間からの遅れ(ms)。技ごとの動き(SKILL_MOTION_SETS)がある段階は、そちらが専用に作り込んであるので重ねない
const SPECIAL_FINISH = Object.freeze({
  zan:    [{t:'blade',a:-38,len:300,w:9,d:260},{t:'blade',a:38,len:300,w:9,d:350},{t:'blade',a:90,len:240,w:6,d:450},{t:'ring',d:450,r:3.4}],
  sakura: [{t:'bits',n:16,shape:'petal',dist:130,d:300,spin:1},{t:'bits',n:10,shape:'petal',dist:80,d:380,spin:-1},{t:'ring',d:300,r:3}],
  kenshi: [{t:'blade',a:-40,len:340,w:8,d:240},{t:'blade',a:40,len:340,w:8,d:320},{t:'col',w:34,h:420,d:420,sky:true},{t:'ring',d:420,r:3.6}],
  mia:    [{t:'bits',n:10,shape:'note',dist:150,d:260},{t:'col',w:120,h:420,d:240,sky:true,soft:true},{t:'ring',d:300,r:3}],
  ark:    [{t:'blade',a:0,len:320,w:10,d:280},{t:'col',w:26,h:460,d:280,sky:true},{t:'bits',n:10,shape:'feather',dist:120,d:340,fall:true}],
  iblis:  [{t:'col',w:40,h:300,d:260,flame:true,x:-60},{t:'col',w:46,h:360,d:300,flame:true},{t:'col',w:40,h:300,d:340,flame:true,x:60},{t:'bits',n:10,shape:'spark',dist:110,d:360},{t:'ring',d:300,r:3.2}],
  tide:   [{t:'wave',d:240},{t:'bits',n:12,shape:'drop',dist:140,d:340},{t:'ring',d:340,r:3.2,flat:.45}],
  pandora:[{t:'blade',a:-62,len:380,w:9,d:240},{t:'blade',a:62,len:380,w:9,d:300},{t:'ring',d:360,r:3.8},{t:'bits',n:12,shape:'spark',dist:120,d:360}],
  stomp:  [{t:'ring',d:300,r:4.2,flat:.38},{t:'bits',n:12,shape:'dust',dist:120,d:300},{t:'bits',n:8,shape:'star',dist:100,d:340}],
  beam:   [{t:'blade',a:0,len:360,w:8,d:200},{t:'blade',a:90,len:360,w:8,d:200},{t:'blade',a:45,len:240,w:5,d:230},{t:'blade',a:-45,len:240,w:5,d:230},{t:'ring',d:200,r:3}],
  rocks:  [{t:'fall',n:7,shape:'rock',d:200},{t:'ring',d:420,r:3.8,flat:.4},{t:'bits',n:10,shape:'dust',dist:110,d:420}],
  claw:   [{t:'blade',a:-58,len:330,w:8,d:240,x:-30},{t:'blade',a:-58,len:330,w:8,d:300},{t:'blade',a:-58,len:330,w:8,d:360,x:30},{t:'ring',d:300,r:3}],
  punch:  [{t:'bits',n:8,shape:'star',dist:130,d:300},{t:'ring',d:300,r:4},{t:'blade',a:0,len:260,w:7,d:300},{t:'blade',a:90,len:260,w:7,d:300}],
  magic:  [{t:'ring',d:240,r:2.8,flat:.4,rune:true},{t:'col',w:70,h:420,d:300,soft:true},{t:'bits',n:10,shape:'spark',dist:90,d:360,rise:true}],
  crush:  [{t:'fall',n:1,shape:'slab',d:180},{t:'ring',d:430,r:4.2,flat:.4},{t:'bits',n:12,shape:'dust',dist:130,d:430}],
  petals: [{t:'bits',n:18,shape:'petal',dist:140,d:260,spin:1},{t:'bits',n:12,shape:'petal',dist:90,d:320,spin:-1}],
  vine:   [{t:'blade',a:-20,len:300,w:12,d:220,vine:true},{t:'blade',a:200,len:300,w:12,d:260,vine:true},{t:'blade',a:75,len:300,w:12,d:300,vine:true},{t:'bits',n:10,shape:'leaf',dist:120,d:380}],
  fire:   [{t:'col',w:70,h:440,d:240,flame:true},{t:'bits',n:12,shape:'flame',dist:110,d:300,rise:true},{t:'ring',d:260,r:3.2,flat:.45}],
  // ユグドラシル種・メルホイップの固有技(技の型の名前 = SKILL_ATTACK_THEMES の値)。2026-10-02 ユーザー指示「ユグドラシル、メルホイップも進めて」
  ygStarBomb:   [{t:'bits',n:14,shape:'star',dist:140,d:300},{t:'blade',a:0,len:300,w:8,d:300},{t:'blade',a:90,len:300,w:8,d:300},{t:'ring',d:300,r:4}],
  ygWonderBlaze:[{t:'col',w:56,h:380,d:260,flame:true,x:-52},{t:'col',w:66,h:440,d:240,flame:true},{t:'col',w:56,h:380,d:280,flame:true,x:52},{t:'bits',n:12,shape:'flame',dist:110,d:320,rise:true}],
  ygManyWing:   [{t:'bits',n:18,shape:'leaf',dist:140,d:280,spin:1},{t:'bits',n:10,shape:'leaf',dist:80,d:340,spin:-1},{t:'ring',d:300,r:3.2}],
  ygRiceShower: [{t:'bits',n:14,shape:'spark',dist:110,d:260,fall:true},{t:'col',w:130,h:420,d:240,sky:true,soft:true},{t:'ring',d:320,r:3}],
  ygMeteor:     [{t:'fall',n:5,shape:'rock',d:200},{t:'ring',d:420,r:4,flat:.4},{t:'bits',n:12,shape:'flame',dist:120,d:420},{t:'bits',n:8,shape:'dust',dist:110,d:430}],
  ygPapillon:   [{t:'bits',n:18,shape:'petal',dist:140,d:260,spin:1},{t:'bits',n:12,shape:'petal',dist:90,d:320,spin:-1},{t:'ring',d:280,r:3.4}],
  ygHeavyRain:  [{t:'wave',d:240},{t:'bits',n:16,shape:'drop',dist:130,d:260,fall:true},{t:'ring',d:340,r:3.6,flat:.45}],
  ygEternalArc: [{t:'blade',a:-28,len:400,w:9,d:240},{t:'blade',a:28,len:400,w:9,d:320},{t:'ring',d:360,r:4,flat:.5},{t:'bits',n:10,shape:'spark',dist:120,d:360}],
  ygAurora:     [{t:'col',w:110,h:440,d:240,sky:true,soft:true},{t:'col',w:60,h:380,d:300,sky:true,x:-70},{t:'col',w:60,h:380,d:340,sky:true,x:70},{t:'bits',n:10,shape:'spark',dist:90,d:380,rise:true}],
  ygCosmo:      [{t:'ring',d:240,r:3.4,flat:.45,rune:true},{t:'bits',n:14,shape:'star',dist:140,d:300},{t:'bits',n:8,shape:'star',dist:80,d:380}],
});
// どのフィニッシュを重ねるか。技ごとの動き(SKILL_MOTION_SETS)を持つ段階は重ねず、見せ場の動き('sig')の段階だけ
const specialFinishKindOf = (ownerId, skillName, anim) => {
  if (!anim || anim.charge === true) return null;
  if (anim.zanCombo) return anim.sakura ? 'sakura' : 'zan';
  if (anim.twinBlade || anim.motion === 'kenshiTwinBlade') return 'kenshi';
  switch (anim.motion) {
    case 'miaSongNotes': return 'mia';
    case 'arkHolyRain': return ownerId === 'Iblis' ? 'iblis' : 'ark';
    case 'waterBurst': return 'tide';
    case 'pandoraDualThunder': return 'pandora';
    default: break;
  }
  let own = null;
  try { own = typeof skillAttackThemeOf === 'function' ? skillAttackThemeOf(ownerId, skillName, true) : null; } catch (e) { own = null; }
  if (own) return SPECIAL_FINISH[own] ? own : null;
  const k = typeof DEFAULT_ATTACK_THEMES !== 'undefined' ? DEFAULT_ATTACK_THEMES[ownerId] : null;
  return k && SPECIAL_FINISH[k] ? k : null;
};
// parts … 敵の技のように、表を持たない呼び出し元が部品の並びをそのまま渡すとき(kind より優先)
// offset … 全部の遅れ(d)へ足す時間(ms)。敵の技は「当たる瞬間」が技の長さの途中にあるので、そこに合わせる
const SpecialFinish = ({ kind, parts: partsProp = null, offset = 0 }) => {
  const parts = partsProp || SPECIAL_FINISH[kind];
  if (!parts) return null;
  return (
    <div data-special-finish={kind} className="spm__finish" aria-hidden="true">
      {parts.map((p, pi) => {
        const base = { '--d':`${(p.d || 0) + offset}ms`, '--x':`${p.x || 0}px` };
        if (p.t === 'blade') return <i key={pi} className={`fin-blade${p.vine ? ' fin-blade--vine' : ''}`} style={{ ...base, '--a':`${p.a || 0}deg`, '--len':`${p.len || 260}px`, '--w':`${p.w || 8}px` }}/>;
        if (p.t === 'ring') return <i key={pi} className={`fin-ring${p.flat ? ' fin-ring--flat' : ''}${p.rune ? ' fin-ring--rune' : ''}${p.void ? ' fin-ring--void' : ''}`} style={{ ...base, '--r':p.r || 3, '--flat':p.flat || 1 }}/>;
        if (p.t === 'col') return <i key={pi} className={`fin-col${p.flame ? ' fin-col--flame' : ''}${p.sky ? ' fin-col--sky' : ''}${p.soft ? ' fin-col--soft' : ''}${p.water ? ' fin-col--water' : ''}`} style={{ ...base, '--w':`${p.w || 40}px`, '--h':`${p.h || 360}px` }}/>;
        if (p.t === 'wave') return <i key={pi} className="fin-wave" style={base}/>;
        if (p.t === 'spike') return <i key={pi} className={`fin-spike${p.thorn ? ' fin-spike--thorn' : ''}`} style={{ ...base, '--w':`${p.w || 30}px`, '--h':`${p.h || 160}px` }}/>;
        if (p.t === 'bolt') return <i key={pi} className="fin-bolt" style={{ ...base, '--w':`${p.w || 40}px`, '--h':`${p.h || 360}px` }}/>;
        if (p.t === 'fall') return <React.Fragment key={pi}>{Array.from({ length:p.n || 4 }, (_, i) => <i key={i} className={`fin-fall fin-shape--${p.shape || 'rock'}`} style={{ ...base, '--d':`${(p.d || 0) + offset + i * 36}ms`, '--x':`${((i % 4) - 1.5) * 34}px`, '--s':1 + (i % 3) * .25 }}/>)}</React.Fragment>;
        return <React.Fragment key={pi}>{Array.from({ length:p.n || 8 }, (_, i) => {
          const ang = (360 / (p.n || 8)) * i + (pi % 2 ? 11 : 0);
          return <i key={i} className={`fin-bit fin-shape--${p.shape || 'spark'}${p.rise ? ' fin-bit--rise' : ''}${p.fall ? ' fin-bit--fall' : ''}${p.in ? ' fin-bit--in' : ''}`}
            style={{ '--d':`${(p.d || 0) + offset + i * 14}ms`, '--a':`${ang}deg`, '--dist':`${p.dist || 110}px`, '--spin':p.spin || 0, '--i':i }}/>;
        })}</React.Fragment>;
      })}
    </div>
  );
};
// 固有技の着弾の型(光の技だけ、共通の衝撃の放射線を出す)。技ごとの定義 → 技名の固定の定義 → その子の色、の順で決める
const specialMoveFormOf = (monId, skillName) => {
  const staticKind = typeof SKILL_ATTACK_THEMES !== 'undefined' ? SKILL_ATTACK_THEMES[skillName] : null;
  if (staticKind && YG_UNIQUE_FORM[staticKind]) return YG_UNIQUE_FORM[staticKind];
  let hit = null;
  try { hit = typeof skillMotionSlotOf === 'function' ? skillMotionSlotOf(monId, skillName, true) : null; } catch (e) { hit = null; }
  if (hit && hit.spec && hit.spec !== 'sig') return SKM_FORM_OVERRIDE[`${hit.monId}-u${hit.index}`] || hit.spec.form || skmFormOf(hit.spec.c);
  return skmFormOf(SPECIAL_MOVE_MON_COLOR[monId]);
};
const SpecialMoveFx = ({ slotSkill, attackAnim, mon = null, ownerId = null, compact = false }) => {
  const [pos, setPos] = React.useState(null);
  const slotIndex = slotSkill ? slotSkill.slotIndex : null;
  React.useLayoutEffect(() => {
    if (compact || typeof document === 'undefined' || slotIndex == null) { setPos(null); return; }
    const slotEl = document.querySelector(`[data-slot-index="${slotIndex}"]`);
    const enemyEl = document.querySelector('[data-attack-target]');
    const mid = (el) => { if (!el) return null; const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; };
    setPos({ from: mid(slotEl), to: mid(enemyEl) });
  }, [slotIndex, compact]);
  if (!slotSkill || slotSkill.type !== 'unique') return null;
  // sig=true は図鑑の「固有技」(技を選ばず、その子の見せ場の動きを見せる)。技名は表示だけで、色とフィニッシュは見せ場の動きで決める
  const lookupName = slotSkill.sig ? null : slotSkill.name;
  const [c1, c2] = specialMoveColorOf(ownerId || (mon && mon.id), lookupName);
  const form = specialMoveFormOf(ownerId || (mon && mon.id), lookupName);
  const phase = attackAnim && attackAnim.charge === true ? 'charge' : 'release';
  const name = String(slotSkill.name || '');
  const vw = typeof window !== 'undefined' ? window.innerWidth : 390;
  const vh = typeof window !== 'undefined' ? window.innerHeight : 800;
  const from = (pos && pos.from) || { x: vw / 2, y: vh * 0.72 };
  const to = (pos && pos.to) || { x: vw / 2, y: vh * 0.3 };
  // compact(図鑑の舞台の中)は、舞台の中の割合で置く(使う子は下寄り・敵の位置は上)。バトルは測った位置
  const enemyBarEl = (!compact && typeof document !== 'undefined') ? document.querySelector('[data-enemy-bar]') : null;
  const bandTop = enemyBarEl ? enemyBarEl.getBoundingClientRect().bottom + 10 : vh * 0.14;
  const style = compact
    ? { '--spm-c1':c1, '--spm-c2':c2, '--spm-fx':'50%', '--spm-fy':'72%', '--spm-tx':'50%', '--spm-ty':'24%' }
    : { '--spm-c1':c1, '--spm-c2':c2, '--spm-fx':`${Math.round(from.x)}px`, '--spm-fy':`${Math.round(from.y)}px`, '--spm-tx':`${Math.round(to.x)}px`, '--spm-ty':`${Math.round(to.y)}px`,
      // 技名の帯は、敵のライフ帯のすぐ下(画面の上のほう)に置く。中央固定だと使う子の動きと重なって見えなくなる
      '--spm-by':`${Math.round(bandTop)}px` };
  const body = (
    <div data-special-move-fx={phase} data-special-form={form} className={`spm spm--${phase} spm--form-${form}${compact ? ' spm--compact' : ''}`} style={style} aria-hidden="true">
      <div className="spm__shade"/>
      {phase === 'charge' && <div className="spm__gather">
        {[0,1,2].map(i => <i key={`r${i}`} className="spm__ring" style={{ '--i':i }}/>)}
        {Array.from({ length:12 }, (_, i) => <i key={`p${i}`} className="spm__spark" style={{ '--a':`${i * 30}deg`, '--i':i % 4 }}/>)}
      </div>}
      <div className="spm__band">
        {mon && mon.imgUrl && <span className="spm__face"><DyedMonsterImage baseId={mon.id} src={mon.imgUrl} alt="" masuColors={mon.colors} draggable={false} className="w-full h-full object-contain"/></span>}
        <span className="spm__text">
          <span className="spm__tag">必殺技</span>
          <span className="spm__name" style={{ fontSize:`${Math.max(14, Math.min(26, Math.floor(200 / Math.max(1, name.length))))}px` }}>{name}</span>
        </span>
      </div>
      {phase === 'release' && <>
        <div className="spm__flash"/>
        <div className="spm__shock"><i/><i/><b/></div>
        <SpecialFinish kind={specialFinishKindOf(ownerId || (mon && mon.id), lookupName, attackAnim)}/>
      </>}
    </div>
  );
  return compact ? body : ReactDOM.createPortal(body, document.body);
};
const AttackTargetFx = ({anim, attackerId}) => {
  if (!anim || anim.charge === true || anim.twinBlade) return null;
  // 種族ごとの攻撃(ThemedAttackMotion)は、自分で敵の位置へ着弾を描く
  if (themedAttackKindOf(anim, attackerId)) return null;
  if (anim.zanCombo) {
    const kind = anim.sakura ? 'eiki' : 'zan';
    return (
      <span className={`atk-target-fx atk-target-fx--${kind}`} aria-hidden="true">
        {ATTACK_TARGET_SLASHES[kind].map((slash, index) => (
          <i key={index} className="atk-target-fx__slash" style={{ '--atk-slash-angle':slash.angle, animationDelay:slash.delay }}/>
        ))}
        <i className="atk-target-fx__bloom"/>
      </span>
    );
  }
  if (ATTACK_TARGET_OWN_IMPACT.includes(anim.motion)) return null;
  return (
    <span className={`atk-target-fx atk-target-fx--hit${anim.charge === false ? ' atk-target-fx--special' : ''}`} aria-hidden="true">
      <i className="atk-target-fx__core"/>
      <i className="atk-target-fx__ring"/>
      {[0, 45, 90, 135, 180, 225, 270, 315].map(deg => (
        <i key={deg} className="atk-target-fx__ray" style={{ '--atk-ray-angle':`${deg}deg` }}/>
      ))}
    </span>
  );
};
// ==== 味方モンスターの待機アニメ(2026-09-24 ユーザー指示「ミーアで試して」→「他の味方モンスターもアニメーション実装よろしく」) ====
// 絵は1枚のPNGなので描き足しはしない。同じ絵を「体」と「動かす部分(翼・しっぽ・耳・花…)」にマスクで切り抜いて重ね、
// 部分だけを付け根を軸に回す。全体の動き(浮く・跳ねる・呼吸・揺れる・泳ぐ)は種ごとに1つ。
// ・どこを切り抜いてどう動かすかは tools/monster/idle-rig-build.js の RIGS が正本。下の表はそこから自動で書かれる
// ・image はバトルで使う実際の絵(染色つき DyedMonsterImage)をそのまま受け取り、部分の数だけ複製する
// ・軸の位置は「正方形の枠に絵を contain で置いた」ときの %。バトルの枠(58/64pxの正方形)専用
// ・軽量表示・設定の「待機中の動き：止める」では呼び出し側が使わない。calm と「動きを減らす」は CSS で止める
// ==== MONSTER_IDLE_RIGS(tools/monster/idle-rig-build.js が書く。手で直さない) ====
const MONSTER_IDLE_RIGS = Object.freeze({
  Mocchi: { body:'jelly', bodyMask:null, parts:[] },
  Suezo: { body:'hop', bodyMask:null, parts:[] },
  Golem: { body:'heavy', bodyMask:IDLE_GOLEM_BODY_MASK, parts:[{ mask:IDLE_GOLEM_ARM_L_MASK, origin:'22% 43%', anim:'swing', amp:-4, dur:3000, delay:0, layer:'back' }, { mask:IDLE_GOLEM_ARM_R_MASK, origin:'77% 43%', anim:'swing', amp:4, dur:3000, delay:1500, layer:'back' }] },
  Tiger: { body:'breathe', bodyMask:IDLE_TIGER_BODY_MASK, parts:[{ mask:IDLE_TIGER_TAIL_MASK, origin:'67.8% 53%', anim:'wag', amp:7, dur:1100, delay:0, layer:'back' }] },
  Ham: { body:'breathe', bodyMask:IDLE_HAM_BODY_MASK, parts:[{ mask:IDLE_HAM_EAR_L_MASK, origin:'40% 32.5%', anim:'twitch', amp:-9, dur:3200, delay:0, layer:'back' }, { mask:IDLE_HAM_EAR_R_MASK, origin:'59.5% 33%', anim:'twitch', amp:9, dur:3200, delay:1300, layer:'back' }] },
  Pixie: { body:'hover', bodyMask:IDLE_PIXIE_BODY_MASK, parts:[{ mask:IDLE_PIXIE_WING_L_MASK, origin:'41.8% 41.5%', anim:'flapL', amp:12, dur:900, delay:0, layer:'back' }, { mask:IDLE_PIXIE_WING_R_MASK, origin:'58.2% 42.3%', anim:'flapR', amp:12, dur:900, delay:0, layer:'back' }, { mask:IDLE_PIXIE_TAIL_MASK, origin:'57.8% 67.5%', anim:'wag', amp:7, dur:1600, delay:0, layer:'back' }] },
  Mia: { body:'hover', bodyMask:IDLE_MIA_BODY_MASK, parts:[{ mask:IDLE_MIA_WING_L_MASK, origin:'44.3% 38.1%', anim:'flapL', amp:16, dur:1300, delay:0, layer:'back' }, { mask:IDLE_MIA_WING_R_MASK, origin:'55.7% 38.1%', anim:'flapR', amp:16, dur:1300, delay:0, layer:'back' }] },
  Pandora: { body:'hover', bodyMask:IDLE_PANDORA_BODY_MASK, parts:[{ mask:IDLE_PANDORA_WING_L_MASK, origin:'39% 34%', anim:'flapL', amp:12, dur:1200, delay:0, layer:'back' }, { mask:IDLE_PANDORA_WING_R_MASK, origin:'61.7% 36%', anim:'flapR', amp:12, dur:1200, delay:0, layer:'back' }, { mask:IDLE_PANDORA_TAIL_L_MASK, origin:'40.1% 61.2%', anim:'swing', amp:7, dur:2000, delay:0, layer:'back' }, { mask:IDLE_PANDORA_TAIL_R_MASK, origin:'61.7% 63%', anim:'swing', amp:-7, dur:2200, delay:400, layer:'back' }] },
  Monol: { body:'drift', bodyMask:null, parts:[] },
  Oboro: { body:'sway', bodyMask:IDLE_OBORO_BODY_MASK, parts:[{ mask:IDLE_OBORO_FLOWER_T_MASK, origin:'49.5% 54.5%', anim:'swing', amp:5, dur:2600, delay:0, layer:'front' }, { mask:IDLE_OBORO_FLOWER_L_MASK, origin:'41% 57%', anim:'swing', amp:-6, dur:2300, delay:500, layer:'front' }, { mask:IDLE_OBORO_FLOWER_R_MASK, origin:'59% 57%', anim:'swing', amp:6, dur:2500, delay:900, layer:'front' }] },
  Plant: { body:'sway', bodyMask:IDLE_PLANT_BODY_MASK, parts:[{ mask:IDLE_PLANT_FLOWER_T_MASK, origin:'49.5% 55.5%', anim:'swing', amp:5, dur:2600, delay:0, layer:'front' }, { mask:IDLE_PLANT_FLOWER_L_MASK, origin:'44% 57.5%', anim:'swing', amp:-6, dur:2300, delay:500, layer:'front' }, { mask:IDLE_PLANT_FLOWER_R_MASK, origin:'56% 57.5%', anim:'swing', amp:6, dur:2500, delay:900, layer:'front' }] },
  Zan: { body:'hover', bodyMask:IDLE_ZAN_BODY_MASK, parts:[{ mask:IDLE_ZAN_BLADE_L_MASK, origin:'30% 29.5%', anim:'swing', amp:-5, dur:1800, delay:0, layer:'back' }, { mask:IDLE_ZAN_BLADE_R_MASK, origin:'70% 29.5%', anim:'swing', amp:5, dur:1800, delay:0, layer:'back' }] },
  Mitarashi: { body:'breathe', bodyMask:IDLE_MITARASHI_BODY_MASK, parts:[{ mask:IDLE_MITARASHI_WING_L_MASK, origin:'28% 41.5%', anim:'flapL', amp:9, dur:1400, delay:0, layer:'back' }, { mask:IDLE_MITARASHI_WING_R_MASK, origin:'72% 41.5%', anim:'flapR', amp:9, dur:1400, delay:0, layer:'back' }] },
  Ark: { body:'glide', bodyMask:IDLE_ARK_BODY_MASK, parts:[{ mask:IDLE_ARK_CROWN_MASK, origin:'50% 24%', anim:'bob', amp:-2.2, dur:1800, delay:0, layer:'front' }, { mask:IDLE_ARK_HALO_MASK, origin:'50% 30%', anim:'bob', amp:-1.4, dur:1800, delay:300, layer:'front' }] },
  Iblis: { body:'hover', bodyMask:IDLE_IBLIS_BODY_MASK, parts:[{ mask:IDLE_IBLIS_WING_L_MASK, origin:'24% 56%', anim:'flapL', amp:6, dur:1400, delay:0, layer:'back' }, { mask:IDLE_IBLIS_WING_R_MASK, origin:'74% 57%', anim:'flapR', amp:6, dur:1400, delay:0, layer:'back' }, { mask:IDLE_IBLIS_ORB_MASK, origin:'48% 8%', anim:'bob', amp:-3, dur:1900, delay:0, layer:'front' }] },
  Snegurochka: { body:'swim', bodyMask:IDLE_SNEGUROCHKA_BODY_MASK, parts:[{ mask:IDLE_SNEGUROCHKA_FIN_MASK, origin:'58.5% 80%', anim:'swing', amp:3, dur:1500, delay:0, layer:'front' }] },
  Undine: { body:'swim', bodyMask:IDLE_UNDINE_BODY_MASK, parts:[{ mask:IDLE_UNDINE_FIN_MASK, origin:'58% 80%', anim:'swing', amp:3, dur:1500, delay:0, layer:'front' }] },
  Yaobikuni: { body:'swim', bodyMask:IDLE_YAOBIKUNI_BODY_MASK, parts:[{ mask:IDLE_YAOBIKUNI_FIN_MASK, origin:'60.7% 82%', anim:'swing', amp:3, dur:1500, delay:0, layer:'front' }] },
  Eiki: { body:'glide', bodyMask:null, parts:[] },
  KenshiMocchi: { body:'jelly', bodyMask:IDLE_KENSHI_MOCCHI_BODY_MASK, parts:[{ mask:IDLE_KENSHI_MOCCHI_SWORD_L_MASK, origin:'29.5% 26%', anim:'swing', amp:-4, dur:2400, delay:0, layer:'back' }, { mask:IDLE_KENSHI_MOCCHI_SWORD_R_MASK, origin:'70.5% 26%', anim:'swing', amp:4, dur:2400, delay:1200, layer:'back' }] },
  Yggdrasil: { body:'breathe', bodyMask:IDLE_YGGDRASIL_BODY_MASK, parts:[{ mask:IDLE_YGGDRASIL_LEAF_TOP_MASK, origin:'35.9% 7.3%', anim:'swingIn', amp:3, dur:3200, delay:0, layer:'front' }, { mask:IDLE_YGGDRASIL_LEAF_SIDE_MASK, origin:'27.8% 15.8%', anim:'swing', amp:-7, dur:2600, delay:700, layer:'front' }] },
  MelWhip: { body:'sway', bodyMask:IDLE_MEL_WHIP_BODY_MASK, parts:[{ mask:IDLE_MEL_WHIP_UMBRELLA_MASK, origin:'41.2% 40.5%', anim:'swing', amp:2, dur:3000, delay:0, layer:'back' }] },
  Ghost: { body:'hover', bodyMask:IDLE_GHOST_BODY_MASK, parts:[{ mask:IDLE_GHOST_TAIL_MASK, origin:'63.8% 86%', anim:'wag', amp:6, dur:1700, delay:0, layer:'back' }] },
  Spooky: { body:'hover', bodyMask:IDLE_SPOOKY_BODY_MASK, parts:[{ mask:IDLE_SPOOKY_TAIL_MASK, origin:'58% 86%', anim:'wag', amp:5, dur:1900, delay:0, layer:'back' }, { mask:IDLE_SPOOKY_HAT_TIP_MASK, origin:'66% 12%', anim:'swing', amp:-6, dur:2600, delay:500, layer:'front' }] },
  Melody: { body:'breathe', bodyMask:IDLE_MELODY_BODY_MASK, parts:[{ mask:IDLE_MELODY_TAIL_MASK, origin:'81.8% 79.5%', anim:'wag', amp:8, dur:1800, delay:0, layer:'back' }] },
  Kuromy: { body:'breathe', bodyMask:IDLE_KUROMY_BODY_MASK, parts:[{ mask:IDLE_KUROMY_TAIL_MASK, origin:'65.9% 53.4%', anim:'wag', amp:7, dur:1700, delay:0, layer:'back' }] },
});
// ==== MONSTER_IDLE_RIGS ここまで ====
const MONSTER_IDLE_MASK_STYLE = (url) => ({
  WebkitMaskImage:`url(${url})`, maskImage:`url(${url})`,
  WebkitMaskSize:'contain', maskSize:'contain',
  WebkitMaskPosition:'center', maskPosition:'center',
  WebkitMaskRepeat:'no-repeat', maskRepeat:'no-repeat',
});
// fill: 入れ物いっぱいに広げる(図鑑の立ち絵のように、絵が w-full h-full で大きさを持たないとき)。
//   バトルの絵は幅・高さを px で持っているので要らない
// own: 図鑑のように、その画面のボタンで動かす・止めるを決める場所。軽量表示・「待機中の動き：止める」・
//   端末の「動きを減らす」では止めない(止めたいときは画面のボタンで1枚の絵に戻す)
const MonsterIdleArt = ({baseId, image, fill = false, own = false}) => {
  const rig = monsterIdleRigOf(baseId);
  const fillClass = fill ? ' mon-idle--fill' : '';
  const ownAttr = own ? 'true' : undefined;
  if (!rig || !image) return image || null;
  if (!rig.parts.length) {
    return <span className={`mon-idle mon-idle--${rig.body}${fillClass}`} data-monster-idle={baseId} data-idle-own={ownAttr}>{image}</span>;
  }
  // ★影(drop-shadow)は切り抜く前に付くので、各層に付けたままだと「体」の層に部分の影が残り、
  //   部分を動かしたとき元の位置に影の輪郭が見える。影は層から外し、重ねた全体に1回だけ付ける
  const className = String(image.props.className || '').split(/\s+/).filter(c => c && !/^drop-shadow/.test(c)).join(' ');
  const layer = (url, extra) => React.cloneElement(image, { alt: extra ? '' : image.props.alt, className,
    style:{ ...(image.props.style||{}), ...MONSTER_IDLE_MASK_STYLE(url), ...(extra||{}) } });
  const partNode = (part, index) => (
    <span key={index} className={`mon-idle__part mon-idle__part--${part.anim} mon-idle__part--${part.layer}`} aria-hidden="true"
      style={{ transformOrigin:part.origin, animationDuration:`${part.dur}ms`, animationDelay:`${part.delay}ms`, '--idle-amp':`${part.amp}deg`, '--idle-bob':`${part.amp}%` }}>
      {layer(part.mask, {display:'block'})}
    </span>
  );
  return (
    <span className={`mon-idle mon-idle--${rig.body} mon-idle--rig${fillClass}`} data-monster-idle={baseId} data-idle-own={ownAttr}>
      {rig.parts.filter(p => p.layer === 'back').map(partNode)}
      <span className="mon-idle__body">{layer(rig.bodyMask, null)}</span>
      {rig.parts.filter(p => p.layer !== 'back').map(partNode)}
    </span>
  );
};
// ==== 図鑑でもバトルと同じ待機アニメを出す入口(2026-09-24 ユーザー指示「モンスター図鑑にも同じ動きが出来る基盤を作っといて」) ====
// 図鑑の詳細の立ち絵(DexMonsterIdleArt)と攻撃アクションの画面は、ここを通すだけにする。
// 動かし方の正本は上の MONSTER_IDLE_RIGS(idle-rig-build.js が書く)なので、そこへ1体足せば
// バトルと図鑑の両方で動き出す。図鑑の側でモンスターの名前を見て分岐しない。
// ・軸の % は「正方形の枠」での値なので、図鑑は正方形の箱に入れて渡す(DexMonsterIdleArt)
// ・図鑑は自分のページのボタン(mh_dex_idle_motion_v1。最初は動く)だけで決める。バトルの設定・軽量表示・
//   「動きを減らす」では止めない(own)。止めるときは enabled:false で1枚の絵に戻す
const monsterIdleRigOf = (monsterId) => (monsterId && Object.prototype.hasOwnProperty.call(MONSTER_IDLE_RIGS, monsterId)) ? MONSTER_IDLE_RIGS[monsterId] : null;
const withMonsterIdleArt = (monsterId, image, {enabled = true, fill = false, own = false} = {}) => (
  enabled && monsterIdleRigOf(monsterId) ? <MonsterIdleArt baseId={monsterId} image={image} fill={fill} own={own}/> : image
);
// 図鑑の攻撃アクションで、動きの最中も待機アニメを重ねてよいか。バトル(71-screen-battle.jsx)は
// 聖光・水・歌・通常の動きでは slotArt を通して重ね、パンドラの雷だけは重ねない(分身へ絵を複製するため)。
// それに合わせる。バトル側の分け方を変えたら、ここも合わせる
const MONSTER_IDLE_OFF_MOTIONS = Object.freeze(['pandoraDualThunder']);
const monsterIdleAllowedDuring = (anim) => !anim || !MONSTER_IDLE_OFF_MOTIONS.includes(anim.motion);
// エイキの攻撃中だけ重ねる桜の花びら。
// 常時アニメーションにはせず、攻撃モーションが出ているあいだ(isAnimating)だけ描く。
// スマホの負荷を増やしすぎないよう、要素は固定12枚・CSSアニメーション1本だけにして、
// 画像は使わずCSSの小片を transform / opacity だけで流す。枠の高速斬撃はザンと同じ
// zanComboDash が担当し、花びらだけ斬撃方向へ遅れて散らして短い余韻を作る。
const EIKI_SAKURA_PETALS = Object.freeze([
  { left:'2%',  top:'66%', delay:'0ms',  flowX:'68px', flowY:'-38px', burstX:'86px',  burstY:'-54px', trailX:'112px', trailY:'-68px', spin:'310deg',  size:'7px'  },
  { left:'8%',  top:'54%', delay:'18ms', flowX:'62px', flowY:'-24px', burstX:'76px',  burstY:'-42px', trailX:'104px', trailY:'-52px', spin:'-280deg', size:'9px'  },
  { left:'14%', top:'74%', delay:'36ms', flowX:'74px', flowY:'-44px', burstX:'96px',  burstY:'-30px', trailX:'122px', trailY:'-42px', spin:'360deg',  size:'6px'  },
  { left:'22%', top:'42%', delay:'8ms',  flowX:'70px', flowY:'-18px', burstX:'92px',  burstY:'-34px', trailX:'118px', trailY:'-48px', spin:'-330deg', size:'8px'  },
  { left:'30%', top:'64%', delay:'54ms', flowX:'64px', flowY:'-34px', burstX:'82px',  burstY:'-60px', trailX:'108px', trailY:'-76px', spin:'390deg',  size:'10px' },
  { left:'38%', top:'36%', delay:'26ms', flowX:'72px', flowY:'-20px', burstX:'98px',  burstY:'-10px', trailX:'124px', trailY:'-24px', spin:'-300deg', size:'7px'  },
  { left:'46%', top:'70%', delay:'70ms', flowX:'66px', flowY:'-42px', burstX:'88px',  burstY:'-66px', trailX:'116px', trailY:'-80px', spin:'340deg',  size:'8px'  },
  { left:'54%', top:'48%', delay:'12ms', flowX:'58px', flowY:'-26px', burstX:'80px',  burstY:'-12px', trailX:'106px', trailY:'-28px', spin:'-370deg', size:'9px'  },
  { left:'62%', top:'62%', delay:'44ms', flowX:'70px', flowY:'-36px', burstX:'94px',  burstY:'-48px', trailX:'120px', trailY:'-62px', spin:'320deg',  size:'6px'  },
  { left:'70%', top:'34%', delay:'62ms', flowX:'60px', flowY:'-16px', burstX:'78px',  burstY:'-38px', trailX:'102px', trailY:'-50px', spin:'-350deg', size:'8px'  },
  { left:'78%', top:'72%', delay:'22ms', flowX:'66px', flowY:'-40px', burstX:'92px',  burstY:'-22px', trailX:'116px', trailY:'-38px', spin:'380deg',  size:'9px'  },
  { left:'86%', top:'50%', delay:'48ms', flowX:'56px', flowY:'-28px', burstX:'74px',  burstY:'-50px', trailX:'98px',  trailY:'-64px', spin:'-320deg', size:'7px'  },
]);
const EikiSakuraPetals = () => (
  <span className="eiki-sakura" aria-hidden="true">
    {EIKI_SAKURA_PETALS.map((petal, index) => (
      <span key={index} className="eiki-sakura__petal"
        style={{ left:petal.left, top:petal.top, width:petal.size, height:`${parseFloat(petal.size)*1.45}px`, animationDelay:petal.delay,
          '--eiki-petal-flow-x':petal.flowX, '--eiki-petal-flow-y':petal.flowY,
          '--eiki-petal-burst-x':petal.burstX, '--eiki-petal-burst-y':petal.burstY,
          '--eiki-petal-trail-x':petal.trailX, '--eiki-petal-trail-y':petal.trailY,
          '--eiki-petal-spin-mid':`${parseFloat(petal.spin)*.55}deg`,
          '--eiki-petal-spin-burst':`${parseFloat(petal.spin)*.8}deg`,
          '--eiki-petal-spin':petal.spin }}/>
    ))}
  </span>
);
// 剣士モッチーの二刀流演出。
// 本体は kenshiTwinBladeSlash で敵まで高速移動し、ここでは斬撃・速度線・X字の決め演出だけを重ねる。
// 常時DOMは増やさず、攻撃中だけ描画する。永久追加連撃が何本に増えても、この演出自体は1攻撃1セット。
const KENSHI_TWIN_SLASHES = Object.freeze([
  { angle:'-38deg', delay:'135ms', color:'rgba(139,92,246,.98)', origin:'90% 50%', sweepX:'-18px' }, // 1撃目 ＼
  { angle:'38deg',  delay:'315ms', color:'rgba(34,211,238,.98)', origin:'10% 50%', sweepX:'18px' },  // 2撃目 ／
]);
const KENSHI_TWIN_SPEED_LINES = Object.freeze([
  { left:'8%',  top:'72%', delay:'35ms',  angle:'-20deg', travelX:'-38px', travelY:'-118px', width:'74px' },
  { left:'26%', top:'82%', delay:'70ms',  angle:'-14deg', travelX:'20px',  travelY:'-138px', width:'92px' },
  { left:'68%', top:'78%', delay:'238ms', angle:'18deg',  travelX:'-18px', travelY:'-132px', width:'88px' },
  { left:'82%', top:'66%', delay:'270ms', angle:'24deg',  travelX:'34px',  travelY:'-116px', width:'68px' },
]);
const KENSHI_TWIN_SHARDS = Object.freeze([
  { x:'-76px', y:'-42px', angle:'-34deg', delay:'0ms' },
  { x:'-54px', y:'38px',  angle:'24deg',  delay:'12ms' },
  { x:'-18px', y:'-70px', angle:'-8deg',  delay:'22ms' },
  { x:'28px',  y:'-62px', angle:'18deg',  delay:'8ms' },
  { x:'60px',  y:'-28px', angle:'36deg',  delay:'18ms' },
  { x:'72px',  y:'34px',  angle:'52deg',  delay:'28ms' },
]);
const KenshiTwinSlash = () => (
  <span className="kenshi-twin-slash" aria-hidden="true">
    {KENSHI_TWIN_SLASHES.map((blade, index) => (
      <span key={`blade-${index}`} className="kenshi-twin-slash__blade"
        style={{
          '--kenshi-slash-angle':blade.angle,
          '--kenshi-slash-delay':blade.delay,
          '--kenshi-slash-color':blade.color,
          '--kenshi-slash-origin':blade.origin,
          '--kenshi-slash-sweep-x':blade.sweepX,
        }}/>
    ))}
    {KENSHI_TWIN_SPEED_LINES.map((line, index) => (
      <span key={`speed-${index}`} className="kenshi-twin-slash__speed"
        style={{
          left:line.left, top:line.top, width:line.width,
          '--kenshi-speed-delay':line.delay,
          '--kenshi-speed-angle':line.angle,
          '--kenshi-speed-x':line.travelX,
          '--kenshi-speed-y':line.travelY,
        }}/>
    ))}
    <span className="kenshi-twin-slash__impact">
      <span className="kenshi-twin-slash__impact-core"/>
      <span className="kenshi-twin-slash__impact-ring"/>
    </span>
    {KENSHI_TWIN_SHARDS.map((shard, index) => (
      <span key={`shard-${index}`} className="kenshi-twin-slash__shard"
        style={{
          '--kenshi-shard-x':shard.x,
          '--kenshi-shard-y':shard.y,
          '--kenshi-shard-angle':shard.angle,
          '--kenshi-shard-delay':shard.delay,
        }}/>
    ))}
  </span>
);
// アーク専用の聖光攻撃演出。
// 距離枠は動かさず、本体だけがふわりと浮遊し、敵位置の上空から5本の聖光を時間差で降らせる。
// 追加画像は使わず、攻撃中だけDOMへ出る固定数のCSS要素で光輪・光柱・着弾・光粒を描く。
const ARK_HOLY_RAYS = Object.freeze([
  { left:'18%', delay:'180ms', tilt:'-5deg', scale:'.88' },
  { left:'34%', delay:'255ms', tilt:'3deg',  scale:'1.00' },
  { left:'50%', delay:'330ms', tilt:'-2deg', scale:'1.18' },
  { left:'66%', delay:'405ms', tilt:'4deg',  scale:'1.00' },
  { left:'82%', delay:'480ms', tilt:'-4deg', scale:'.88' },
]);
const ARK_HOLY_SPARKLES = Object.freeze([
  { x:'-78px', y:'-38px', delay:'500ms', size:'7px' },
  { x:'-58px', y:'-72px', delay:'530ms', size:'5px' },
  { x:'-30px', y:'-88px', delay:'555ms', size:'8px' },
  { x:'10px',  y:'-92px', delay:'520ms', size:'6px' },
  { x:'44px',  y:'-76px', delay:'570ms', size:'8px' },
  { x:'76px',  y:'-42px', delay:'545ms', size:'5px' },
  { x:'-62px', y:'18px',  delay:'590ms', size:'6px' },
  { x:'64px',  y:'20px',  delay:'605ms', size:'7px' },
]);
const ArkHolyRainMotion = ({image, charging=false, empowered=false, compact=false}) => (
  <span className={`ark-holy-rain${charging?' ark-holy-rain--charging':''}${empowered?' ark-holy-rain--empowered':''}${compact?' ark-holy-rain--compact':''}`}>
    <span className="ark-holy-rain__sky" aria-hidden="true"><i/><i/></span>
    <span className="ark-holy-rain__monster">{image}</span>
    <span className="ark-holy-rain__rays" aria-hidden="true">
      {ARK_HOLY_RAYS.map((ray,index)=>(
        <i key={`ray-${index}`} className="ark-holy-rain__ray" style={{
          left:ray.left, animationDelay:ray.delay,
          '--ark-ray-tilt':ray.tilt, '--ark-ray-scale':ray.scale,
        }}/>
      ))}
    </span>
    <span className="ark-holy-rain__impact" aria-hidden="true">
      <i className="ark-holy-rain__impact-core"/>
      <i className="ark-holy-rain__impact-ring"/>
    </span>
    <span className="ark-holy-rain__sparkles" aria-hidden="true">
      {ARK_HOLY_SPARKLES.map((spark,index)=>(
        <i key={`spark-${index}`} className="ark-holy-rain__spark" style={{
          width:spark.size, height:spark.size, animationDelay:spark.delay,
          '--ark-spark-x':spark.x, '--ark-spark-y':spark.y,
        }}/>
      ))}
    </span>
  </span>
);
// ウンディーネ種（スネグーラチカ・ウンディーネ・ヤオビクニ）共通の水攻撃演出。
// 距離枠そのものは動かさず、本体だけを左右へ大きく滑らせながら水弾を3発撃つ。
// 水弾は敵の向き(--atk-rot)へ傾けて敵の位置(--atk-dx/dy)まで飛ばし、着弾の飛沫も敵の上に出す。
// x は3発が敵の中心へ寄るための横のずれ、y は当たる場所のばらけ。
// 水弾・水面の引き波・着弾飛沫は攻撃中だけDOMへ出し、常時アニメーションにはしない。
const WATER_BURST_SHOTS = Object.freeze([
  { left:'17%', delay:'120ms', x:'24px',  y:'-8px', angle:'-10deg' },
  { left:'50%', delay:'240ms', x:'0px',   y:'6px',  angle:'2deg'   },
  { left:'83%', delay:'360ms', x:'-24px', y:'-4px', angle:'10deg'  },
]);
const WATER_BURST_SPLASH_DROPS = Object.freeze([
  { x:'-74px', y:'-34px', angle:'-28deg', delay:'0ms'  },
  { x:'-54px', y:'-66px', angle:'-48deg', delay:'18ms' },
  { x:'-24px', y:'-78px', angle:'-72deg', delay:'8ms'  },
  { x:'16px',  y:'-82px', angle:'72deg',  delay:'22ms' },
  { x:'50px',  y:'-62px', angle:'48deg',  delay:'10ms' },
  { x:'76px',  y:'-30px', angle:'26deg',  delay:'28ms' },
  { x:'-60px', y:'18px',  angle:'14deg',  delay:'34ms' },
  { x:'62px',  y:'20px',  angle:'-14deg', delay:'38ms' },
]);
const WaterBurstMotion = ({image, lunge=false, charging=false, compact=false}) => (
  <span className={`water-burst-motion${lunge?' water-burst-motion--lunge':''}${charging?' water-burst-motion--charging':''}${compact?' water-burst-motion--compact':''}`}>
    <span className="water-burst-motion__wake" aria-hidden="true"><i/><i/><i/></span>
    <span className="water-burst-motion__monster">{image}</span>
    <span className="water-burst-motion__shots" aria-hidden="true">
      {WATER_BURST_SHOTS.map((shot,index)=>(
        <i key={`shot-${index}`} className="water-burst-motion__shot" style={{
          left:shot.left, animationDelay:shot.delay,
          '--water-shot-x':shot.x, '--water-shot-y':shot.y, '--water-shot-angle':shot.angle,
        }}/>
      ))}
    </span>
    <span className="water-burst-motion__impact" aria-hidden="true">
      <i className="water-burst-motion__impact-core"/>
      <i className="water-burst-motion__impact-ring"/>
      {WATER_BURST_SPLASH_DROPS.map((drop,index)=>(
        <i key={`drop-${index}`} className="water-burst-motion__drop" style={{
          '--water-drop-x':drop.x, '--water-drop-y':drop.y,
          '--water-drop-angle':drop.angle, '--water-drop-delay':drop.delay,
        }}/>
      ))}
    </span>
  </span>
);
// ミーア専用の歌攻撃演出。
// 距離枠は動かさず、本体はその場で跳ねて体を揺らし、マイクスタンドの前で歌う(敵へは向かわない)。
// 音符は5つ、左右に揺れながら敵の位置(--atk-dx/dy)まで飛び、敵の向きへ音の波を3つ走らせる。
// x は飛ぶ途中の左右の揺れ、y は途中でふくらむ高さ。追加画像・追加音源は使わず、攻撃中だけDOMへ出る
// 固定数のCSS要素で描く(常時アニメーションにはしない)。
// スマホの縦画面でも「歌って攻撃している」と一目で分かるよう、マイクは本体の手前・
// やや左に置いて本体を隠さず、音符は大きさと高さをばらして4つ流す。
const MIA_SONG_NOTES = Object.freeze([
  { glyph:'♪', left:'40%', delay:'70ms',  x:'-26px', y:'-34px', size:'26px', spin:'-18deg', color:'#f9a8d4' },
  { glyph:'♬', left:'56%', delay:'140ms', x:'24px',  y:'-48px', size:'33px', spin:'14deg',  color:'#c4b5fd' },
  { glyph:'♫', left:'46%', delay:'210ms', x:'-18px', y:'-40px', size:'24px', spin:'-12deg', color:'#fda4af' },
  { glyph:'♩', left:'60%', delay:'280ms', x:'30px',  y:'-56px', size:'29px', spin:'20deg',  color:'#a5f3fc' },
  { glyph:'♪', left:'50%', delay:'340ms', x:'-10px', y:'-30px', size:'22px', spin:'10deg',  color:'#fde68a' },
]);
const MIA_SONG_SPARKLES = Object.freeze([
  { x:'-70px', y:'-30px', delay:'0ms',  size:'8px' },
  { x:'-46px', y:'-64px', delay:'22ms', size:'6px' },
  { x:'-14px', y:'-78px', delay:'12ms', size:'9px' },
  { x:'26px',  y:'-72px', delay:'30ms', size:'7px' },
  { x:'58px',  y:'-44px', delay:'18ms', size:'9px' },
  { x:'72px',  y:'6px',   delay:'36ms', size:'6px' },
  { x:'-62px', y:'14px',  delay:'28ms', size:'7px' },
  { x:'4px',   y:'22px',  delay:'42ms', size:'6px' },
]);
const MiaSongNotesMotion = ({image, lunge=false, charging=false, compact=false}) => (
  <span className={`mia-song-notes${lunge?' mia-song-notes--lunge':''}${charging?' mia-song-notes--charging':''}${compact?' mia-song-notes--compact':''}`}>
    <span className="mia-song-notes__stage" aria-hidden="true"><i/><i/></span>
    <span className="mia-song-notes__monster">{image}</span>
    <span className="mia-song-notes__mic" aria-hidden="true">
      <i className="mia-song-notes__mic-body"/>
      <i className="mia-song-notes__mic-clip"/>
      <i className="mia-song-notes__mic-pole mia-song-notes__mic-pole--upper"/>
      <i className="mia-song-notes__mic-pole"/>
      <i className="mia-song-notes__mic-joint"/>
      <i className="mia-song-notes__mic-base"/>
    </span>
    <span className="mia-song-notes__waves" aria-hidden="true"><i/><i/><i/></span>
    <span className="mia-song-notes__notes" aria-hidden="true">
      {MIA_SONG_NOTES.map((note,index)=>(
        <i key={`note-${index}`} className="mia-song-notes__note" style={{
          left:note.left, animationDelay:note.delay, fontSize:note.size, color:note.color,
          '--mia-note-x':note.x, '--mia-note-y':note.y, '--mia-note-spin':note.spin,
        }}>{note.glyph}</i>
      ))}
    </span>
    <span className="mia-song-notes__impact" aria-hidden="true">
      <i className="mia-song-notes__impact-core"/>
      <i className="mia-song-notes__impact-ring"/>
      <i className="mia-song-notes__impact-ring mia-song-notes__impact-ring--late"/>
      {MIA_SONG_SPARKLES.map((spark,index)=>(
        <i key={`spark-${index}`} className="mia-song-notes__spark" style={{
          width:spark.size, height:spark.size,
          '--mia-spark-x':spark.x, '--mia-spark-y':spark.y, '--mia-spark-delay':spark.delay,
        }}/>
      ))}
    </span>
  </span>
);
// パンドラの分身雷撃。本体が光って2体に分かれ、敵をはさむ位置(--pd-l-x / --pd-r-x)まで跳び、
// それぞれの分身から敵へ向けて雷を撃つ(長さと向きは attackAimVars が決める)。
// 同時に敵の真上から大きな落雷を落とし、着弾の閃光と輪を敵の位置に出してから本体へ戻る。
const PandoraDualThunder = ({image, compact=false}) => (
  <span className={`pandora-dual-thunder${compact?' pandora-dual-thunder--compact':''}`} aria-hidden="true">
    <span className="pandora-dual-center">{React.cloneElement(image,{alt:''})}</span>
    {['left','right'].map(side=><span key={side} className={`pandora-dual-clone pandora-dual-clone--${side}`}>
      {React.cloneElement(image,{alt:''})}
      <i className="pandora-dual-orb"/>
      <i className="pandora-dual-bolt"/>
    </span>)}
    <span className="pandora-dual-strike">
      <i className="pandora-dual-strike__bolt"/>
      <i className="pandora-dual-strike__flash"/>
      <i className="pandora-dual-strike__ring"/>
    </span>
  </span>
);
// 図鑑などから本番と同じ攻撃モーション描画を使うための共通ステージ。
// image は用途ごとの実画像要素を受け取り、モーション専用の画像コピーは作らない。
// 敵が居ないので、真上の少し先を「敵の位置」として変数を渡す(本番と同じ keyframes がそのまま動く)。
// ==== 技ごとの動きを1つずつ選んで再生する行(図鑑の攻撃アクションと新モンスター確認で共用) ====
// 2026-09-29 ユーザー指示「せっかく技の種類があるのに図鑑で技ごとのモーションが見れない」
// 「いずれは全モンスター実装予定」。技ごとに動きが違う種族(SKILL_ATTACK_THEME_MONSTERS)へ足した子は、
// 呼び出し側を触らずに図鑑とデバッグ画面の両方でこの行が出る。
// 返すのは [種類, 見出し, 技の名前(段階の順)] の組。動きの無い子・技の名前が無い子は null
const skillMotionListsOf = (mon, { draft = false } = {}) => {
  // 2026-09-29 から全モンスター(SKILL_MOTION_SETS)にも出す
  const hasSet = typeof SKILL_MOTION_SETS !== 'undefined' && !!SKILL_MOTION_SETS[mon?.id];
  if (!mon || typeof SKILL_ATTACK_THEME_MONSTERS === 'undefined' || (!SKILL_ATTACK_THEME_MONSTERS.includes(mon.id) && !hasSet)) return null;
  const normal = (typeof HERO_ATK_NAMES !== 'undefined' && Array.isArray(HERO_ATK_NAMES[mon.id])) ? HERO_ATK_NAMES[mon.id] : [];
  const unique = Array.isArray(mon.unique?.names) ? mon.unique.names : (draft && Array.isArray(mon.draftUniqueNames) ? mon.draftUniqueNames : []);
  const lists = [['normal', '通常技', normal], ['unique', '固有技', unique]].filter(([, , names]) => names.length);
  return lists.length ? lists : null;
};
// 種類ごとに横1行で流す(縦に並べると演出の舞台の高さを削り、上へ飛ぶ演出が見えなくなる)。
// playingName: いま再生中の技名 / disabled: 再生中は押せない / onPlay(kind, name)
const SkillMotionPicker = ({ lists, playingName = null, disabled = false, onPlay }) => {
  if (!lists) return null;
  return (
    <div data-skill-motion-picker className="mx-auto mt-2 w-full max-w-md space-y-1.5">
      {lists.map(([kind, label, names]) => (
        <div key={kind} className="flex items-center gap-1.5 min-w-0">
          <div className="shrink-0 w-9 text-[9px] font-black leading-tight text-cyan-300/80">{label}</div>
          <div className="flex-1 min-w-0 flex gap-1.5 overflow-x-auto mh-scroll pb-0.5">
            {names.map((name, lvl) => (
              <button key={name} type="button" data-skill-motion={name} data-monster-check-skill-motion={name} disabled={disabled}
                onClick={() => { Audio_.se.tap(); if (!disabled) onPlay(kind, name); }}
                className={`shrink-0 min-h-[44px] rounded-xl border px-2.5 text-[10px] font-black leading-tight whitespace-nowrap active:scale-95 disabled:opacity-45 ${playingName === name ? 'border-cyan-200 bg-cyan-700 text-white' : kind === 'unique' ? 'border-amber-400/40 bg-amber-950/40 text-amber-100' : 'border-red-400/40 bg-red-950/40 text-red-100'}`}>
                <span className="block">{name}</span>
                <span className="block text-[8px] font-mono text-slate-400">Lv.{lvl}</span>
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};
const BattleAttackMotionPreview = ({image, anim, compact=false, baseId=null}) => {
  const aimVars = compact ? attackAimVars(0, -70, {spread:30}) : attackAimVars(0, -120);
  // 体当たりだった初期モンスターは、種族ごとの攻撃を同じ部品で再生する(baseId が要る)
  const themedKind = themedAttackKindOf(anim, baseId);
  if(themedKind) {
    return (
      <div className="relative h-full w-full flex items-center justify-center" style={{isolation:'isolate',...aimVars}}>
        <ThemedAttackMotion kind={themedKind} image={image} lunge={anim?.charge===false}/>
      </div>
    );
  }
  if(anim?.motion==='arkHolyRain') {
    return (
      <div className="relative h-full w-full flex items-center justify-center" style={{isolation:'isolate',...aimVars}}>
        <ArkHolyRainMotion image={image} charging={anim?.charge===true} empowered={anim?.charge===false} compact={compact}/>
      </div>
    );
  }
  if(anim?.motion==='waterBurst') {
    return (
      <div className="relative h-full w-full flex items-center justify-center" style={{isolation:'isolate',...aimVars}}>
        <WaterBurstMotion image={image} lunge={anim?.charge===false} charging={anim?.charge===true} compact={compact}/>
      </div>
    );
  }
  if(anim?.motion==='miaSongNotes') {
    return (
      <div className="relative h-full w-full flex items-center justify-center" style={{isolation:'isolate',...aimVars}}>
        <MiaSongNotesMotion image={image} lunge={anim?.charge===false} charging={anim?.charge===true} compact={compact}/>
      </div>
    );
  }
  if(anim?.motion==='pandoraDualThunder') {
    // 大きく見せる版は2.15倍に拡大するので、敵までの距離もそのぶん縮めて渡す
    return (
      <div className="relative h-full w-full flex items-center justify-center" style={{isolation:'isolate',...attackAimVars(0, -56, {spread:26})}}>
        <span style={compact?undefined:{display:'block',transform:'scale(2.15)',transformOrigin:'center'}}>
          <PandoraDualThunder image={image} compact={compact}/>
        </span>
      </div>
    );
  }
  return (
    <div className="relative h-full w-full" style={{isolation:'isolate',...aimVars}}>
      <div className="relative h-full w-full" style={{animation:attackMotionAnimation(anim)}}>
        {image}
        {anim?.sakura&&<EikiSakuraPetals/>}
        {anim?.twinBlade&&<KenshiTwinSlash/>}
      </div>
      {/* 敵の側の着弾。本番は敵の丸枠に重ねるが、ここでは「敵の位置」へずらして重ねる */}
      <span className="atk-target-fx-anchor" aria-hidden="true"><AttackTargetFx anim={anim}/></span>
    </div>
  );
};
// タップ・スライドの波紋。押している場所を指すだけの見た目なのでタップ判定は奪わない。
// 波紋の一覧はこの部品だけが持つ。以前は本体(MonsterHeroGame)の state で、カードを引きずっている
// あいだも波紋1つごとに画面全体を2回(出す・消す)描き直していた。本体は spawnRef.current(x, y) を呼ぶだけ
const TapRippleLayer = ({ spawnRef }) => {
  const [ripples, setRipples] = useState([]);
  useEffect(() => {
    const timers = new Set();
    spawnRef.current = (x, y) => {
      const id = Date.now() + Math.random();
      setRipples(prev => [...prev, { id, x, y }]);
      const timer = setTimeout(() => { timers.delete(timer); setRipples(prev => prev.filter(r => r.id !== id)); }, 650);
      timers.add(timer);
    };
    return () => { spawnRef.current = null; timers.forEach(clearTimeout); };
  }, [spawnRef]);
  return (
      <div style={{position:'absolute',inset:0,pointerEvents:'none',zIndex:2147483647,overflow:'hidden'}}>
        {ripples.map(r=>(
          <span key={r.id} style={{position:'absolute',left:r.x,top:r.y,width:'48px',height:'48px',marginLeft:'-24px',marginTop:'-24px',borderRadius:'9999px',border:'2px solid rgba(255,255,255,0.9)',boxShadow:'0 0 10px rgba(255,255,255,0.6)',transformOrigin:'center',animation:'mhRipple 550ms ease-out forwards'}}/>
        ))}
      </div>
  );
};

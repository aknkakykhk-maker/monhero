---
name: battle-ui-fx
description: Reference implementation for 4 mobile-game UI feedback patterns built with plain React + Tailwind + CSS keyframes (no animation library) — tap ripple, card drag&drop, attack/effect damage popups, and enemy-attack impact effects. Use this when building tactile, juicy UI feedback for a card game, turn-based battle screen, or any touch-driven React app that needs to feel "alive" without adding a dependency like Framer Motion.
---

# バトルUIエフェクト集（React + Tailwind + CSS keyframes）

出典: モンスターヒーロー（`game-system.jsx`）。ビルドツールなし・ライブラリなし、素のReact + Tailwind CDN + `document.createElement('style')`で注入したCSS `@keyframes`だけで実装されている。アニメーションライブラリを追加したくない/追加できない環境でも使える構成なので、そのまま移植可能。

## 共通の考え方

- **アニメーションは全部CSS `@keyframes`**。JS側はいつ・どのクラス/style（`animation:'xxx 500ms ease-out forwards'`）を付けるかだけを管理する「状態マシン」。React側の責務は「今どのエフェクトを表示すべきか」を`useState`で持つことだけ。
- **一過性エフェクトは「配列 + setTimeoutで自己削除」パターン**で統一。`{id, ...payload}`をstateの配列にpushし、`setTimeout`で同じidを探して除去する。同時に何個出ても衝突しない。
- **恒久エフェクト（プレビュー系）は毎レンダー再計算**。タイムアウトで消すのではなく、条件（`previewDmg>0`など)がfalseになったら自然に消える。

---

## 1. タップ時の波紋（リップル）エフェクト

画面のどこをタップしても、タップ位置を中心に波紋が広がって消える。ボタン単位ではなくアプリのルート要素1箇所に仕込むだけで全体に効く。

```js
// state
const [ripples, setRipples] = useState([]);

// トリガー関数
const spawnRipple = useCallback((x, y) => {
  const id = Date.now() + Math.random();
  setRipples(prev => [...prev, { id, x, y }]);
  setTimeout(() => setRipples(prev => prev.filter(r => r.id !== id)), 650); // アニメ尺(550ms)より少し長めに
}, []);
```

```jsx
// ルート要素で pointerdown を拾い、要素内座標に変換して発火
<div
  onPointerDown={(e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    spawnRipple(e.clientX - rect.left, e.clientY - rect.top);
  }}
  className="h-full w-full relative select-none"
>
  {/* 波紋レイヤー: pointer-events:none必須。押下対象より上に重ねる */}
  <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 2147483647, overflow: 'hidden' }}>
    {ripples.map(r => (
      <span
        key={r.id}
        style={{
          position: 'absolute', left: r.x, top: r.y,
          width: '48px', height: '48px', marginLeft: '-24px', marginTop: '-24px',
          borderRadius: '9999px', border: '2px solid rgba(255,255,255,0.9)',
          boxShadow: '0 0 10px rgba(255,255,255,0.6)',
          animation: 'mhRipple 550ms ease-out forwards',
        }}
      />
    ))}
  </div>
  {/* ...実際のUI... */}
</div>
```

```css
@keyframes mhRipple {
  0%   { transform: scale(0.3); opacity: 0.55; }
  100% { transform: scale(1.8);  opacity: 0; }
}
```

**ポイント**
- `pointerEvents:'none'`を波紋レイヤーとspan両方に付けないと、波紋がタップ判定を奪ってしまう。
- ボタンの押下フィードバックはこれとは**別レイヤー**として、Tailwindの`active:scale-95`（小さいアイコンボタンは`active:scale-90`）＋`transition-transform`をほぼ全ボタンに付けている。JS状態を持たない軽量な二段構えにすることで、「押した瞬間ちょっと沈む」＋「そこから波紋が広がる」の2つの触覚フィードバックが両立する。

---

## 2. カードのドラッグ&ドロップ（カード側・ドロップエリア側 双方）

**設計の要点**: タップと判定するかドラッグと判定するかを、移動距離のしきい値（8px）で分岐させる。ドロップ先の判定は座標からの `document.elementFromPoint` + `data-*`属性検索で行い、Reactのドラッグイベント（`onDragOver`等、モバイルでは不安定）を使わない。

```js
// state
const [dragState, setDragState] = useState(null);   // {cardIndex, x, y, active, card}
const [dragOverSlot, setDragOverSlot] = useState(null);
const [slotSettle, setSlotSettle] = useState(null);  // ドロップ成功演出中のスロットindex

// グローバルのpointermove/upで処理(windowにアタッチ。カード個別のonDragではない)
useEffect(() => {
  if (!dragState) return;
  const DRAG_THRESHOLD = 8;
  const startX = dragState.x, startY = dragState.y;

  const findSlot = (x, y) => {
    const el = document.elementFromPoint(x, y);
    const slotEl = el?.closest('[data-slot-index]');
    return slotEl ? Number(slotEl.getAttribute('data-slot-index')) : null;
  };

  const onMove = (e) => {
    const pt = e.touches ? e.touches[0] : e;
    const moved = Math.hypot(pt.clientX - startX, pt.clientY - startY);
    const active = dragState.active || moved > DRAG_THRESHOLD;
    setDragState(prev => prev ? { ...prev, x: pt.clientX, y: pt.clientY, active } : null);
    if (active) setDragOverSlot(findSlot(pt.clientX, pt.clientY));
    if (moved > DRAG_THRESHOLD && e.cancelable) e.preventDefault(); // スクロール抑止
  };

  const onUp = (e) => {
    const pt = e.changedTouches ? e.changedTouches[0] : e;
    const moved = Math.hypot(pt.clientX - startX, pt.clientY - startY);
    const wasActive = dragState.active || moved > DRAG_THRESHOLD;
    const cardIndex = dragState.cardIndex;
    if (wasActive) {
      const si = findSlot(pt.clientX, pt.clientY);
      if (si != null) {
        assignCardToSlot(cardIndex, si); // 自前のビジネスロジック
        setSlotSettle(si);
        setTimeout(() => setSlotSettle(null), 500);
      }
    } else {
      selectCardAt(cardIndex); // 移動なし = タップ扱いのフォールバック
    }
    setDragState(null);
    setDragOverSlot(null);
  };

  window.addEventListener('pointermove', onMove, { passive: false });
  window.addEventListener('pointerup', onUp);
  window.addEventListener('pointercancel', onUp);
  return () => {
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', onUp);
    window.removeEventListener('pointercancel', onUp);
  };
}, [dragState?.cardIndex]);
```

### カード側: 手札から浮き上がって指に追従

```jsx
const isDragging = dragState?.active && dragState?.cardIndex === i;

<button
  onPointerDown={(e) => {
    const pt = e.touches ? e.touches[0] : e;
    setDragState({ cardIndex: i, x: pt.clientX, y: pt.clientY, active: false, card });
  }}
  style={isDragging ? {
    touchAction: 'none',
    position: 'fixed', left: dragState.x, top: dragState.y,
    transform: 'translate(-50%,-50%) rotate(-3deg) scale(1.15)',
    zIndex: 70000, width: '72px',
    pointerEvents: 'none',          // ← 自分自身がelementFromPointに引っかからないように必須
    transition: 'none',             // ← 追従を遅延なしにする(transitionが付いてると指から遅れる)
    filter: 'drop-shadow(0 12px 18px rgba(0,0,0,0.65))',
  } : { touchAction: 'none' }}
  className={`... ${isDragging ? 'ring-4 ring-white shadow-[0_0_24px_rgba(255,255,255,0.6)]' : '...'}`}
>
  {/* カード内容 */}
</button>
```

**ポイント**
- `position:'fixed'` + `left/top`を毎フレーム更新するだけで、`transform: translate3d`より単純かつ十分な性能で追従できる。
- `pointerEvents:'none'`がないと、ドラッグ中のカード自身が`elementFromPoint`に引っかかって`findSlot`が誤検出する。
- `transition:'none'`を明示しないと、他の場所で設定した`transition-all`がドラッグ追従にまで効いてカクつく。

### ドロップエリア側: ホバー中はリング＋拡大、ドロップ成功で波紋＋チェックマーク

```jsx
<button
  data-slot-index={i}  // ← findSlotが検索する属性。これがないとドロップ判定できない
  className={`relative rounded-xl border-2 transition-all
    ${(canAssignByTap || (dragState?.active && dragOverSlot === i)) ? 'ring-2 ring-yellow-400 scale-105 shadow-lg animate-pulse' : ''}
    ${dragState?.active && dragOverSlot === i ? 'ring-4 ring-green-400 scale-110' : ''}
    ${slotSettle === i ? 'ring-4 ring-white' : ''}`}
  style={slotSettle === i ? { animation: 'slotSettle 400ms ease-out' } : undefined}
>
  {/* ドロップ成功時だけ出す波紋+チェックマーク */}
  {slotSettle === i && (
    <div className="absolute inset-0 z-[60] pointer-events-none flex items-center justify-center">
      <div className="absolute rounded-full border-4 border-cyan-300" style={{ width: 40, height: 40, animation: 'setRing 500ms ease-out forwards' }} />
      <div className="absolute rounded-full border-2 border-white" style={{ width: 40, height: 40, animation: 'setRing 500ms ease-out 80ms forwards' }} /> {/* 少し遅らせて二重に */}
      <div className="absolute w-8 h-8 rounded-full bg-cyan-400 border-2 border-white flex items-center justify-center" style={{ animation: 'setPop 500ms cubic-bezier(.2,1.5,.4,1) forwards' }}>
        <CheckIcon size={18} className="text-white" strokeWidth={4} />
      </div>
    </div>
  )}
  {/* スロット内容 */}
</button>
```

```css
@keyframes slotSettle { 0%{transform:scale(1);} 35%{transform:scale(1.12);} 65%{transform:scale(0.96);} 100%{transform:scale(1);} }
@keyframes setRing     { 0%{transform:scale(0.4); opacity:0.9;} 100%{transform:scale(2.4); opacity:0;} }
@keyframes setPop      { 0%{transform:scale(0); opacity:0;} 55%{transform:scale(1.25); opacity:1;} 80%{transform:scale(1); opacity:1;} 100%{transform:scale(1); opacity:0;} }
```

**ポイント**
- リングの色を2段階（黄=割当可能、緑=ドラッグでホバー中）に分けることで、「タップで選択中」と「ドラッグでこのスロットに落とそうとしている」を視覚的に区別できる。
- ドロップ成功演出は`setRing`を2枚、開始タイミングを`80ms`だけずらして重ねることで、輪が1本より「波紋が2段階で広がる」リッチな見た目になる。
- `setPop`は`cubic-bezier(.2,1.5,.4,1)`というオーバーシュートさせるイージングを使い、チェックマークが「バヨンっ」と弾む感じを出している。単純な`ease-out`より生き生きして見える。

---

## 3. 攻撃カード使用時のダメージ表記／効果適用エフェクト

**設計の要点**: ダメージ数値や効果テキストは全部「フローティングポップアップ」という1つの仕組みに統一。`side`（表示位置）と`color`（Tailwindクラス文字列）を呼び出し側が自由に指定できるので、ダメージ・回復・バフ・クリティカルなど見た目が違う通知を全部同じ関数で出せる。

```js
const [popups, setPopups] = useState([]); // [{id, text, side, color}]

const addPopup = (text, side, color) => {
  const id = Date.now() + Math.random();
  setPopups(prev => [...prev, { id, text, side, color }]);
  setTimeout(() => setPopups(p => p.filter(x => x.id !== id)), 2500);
};
```

呼び出し例（通常ダメージ／クリティカル／複数ヒット合計）:

```js
const hitColor = hit.isCrit
  ? 'text-yellow-400 drop-shadow-[0_0_25px_rgba(250,204,21,0.9)] scale-110'
  : 'text-red-600 drop-shadow-[0_0_20px_rgba(220,38,38,0.8)]';
addPopup(hit.isCrit ? `${hit.dmg}!!` : `${hit.dmg}`, 'enemy', `${hitColor} text-5xl font-black animate-bounce`);

// 複数ヒットの合計だけ少し遅れて別途表示
if (multiHit) {
  await wait(150);
  addPopup(`合計 ${totalDmg}`, 'enemy', 'text-white text-3xl font-black drop-shadow-[0_0_20px_rgba(255,255,255,0.6)]');
}
```

`side`ごとに固定のアンカー位置へレンダーするだけ（`side`は自由に増やせる。ここでは`enemy`/`hero`/`life`/`guts`の4種）:

```jsx
{/* 敵の頭上 */}
<div className="absolute inset-0 z-50 pointer-events-none flex flex-col items-center justify-start pt-1 gap-0.5">
  {popups.filter(p => p.side === 'enemy').map(p => (
    <div key={p.id} className={`text-center ${p.color} font-black drop-shadow-[0_0_15px_rgba(0,0,0,1)] whitespace-nowrap`}>{p.text}</div>
  ))}
</div>
```

**ポイント**
- ポップアップ自体にCSS `@keyframes`を付けず、Tailwindの`animate-bounce`＋出現/消滅（mount/unmount）だけで十分「動いている」感が出る。凝ったアニメより「マウント時にふわっと出て2.5秒で消える」のシンプルさが可読性を保つ。
- `side`を「画面上の意味的な位置」（敵の上・自分の上・HPバー・ガッツバー）で分けているので、同時に複数の通知が出ても重ならない。

### 攻撃モーション自体（技名バッジ＋スロットの吹っ飛びアニメ）

ダメージ数値と並行して、技を放つスロット自体もアニメさせる:

```jsx
<div style={{
  animation: attackAnim.charge === true  ? 'specialCharge 650ms ease-out forwards'
           : attackAnim.charge === false ? 'specialLunge 500ms ease-in forwards'
           : 'attackFly 450ms ease-in forwards',
}}>
  {/* カード/モンスター */}
</div>
```

```css
@keyframes attackFly {
  0%   { transform: translateY(0) scale(1);        filter: drop-shadow(0 0 6px rgba(250,204,21,0.5)); }
  45%  { transform: translateY(-180px) scale(1.35); filter: drop-shadow(0 0 20px rgba(250,204,21,0.9)); }
  60%  { transform: translateY(-180px) scale(1.35); filter: drop-shadow(0 0 25px rgba(220,38,38,1)); }
  100% { transform: translateY(0) scale(1);        filter: drop-shadow(0 0 0 rgba(0,0,0,0)); }
}
```
通常技は「飛び上がって→ダメージ色に光って→戻る」の3拍子。固有技（必殺技）は「タメ（少し沈む: `specialCharge`）→敵に向かって突進（`specialLunge`）」の2段階に分け、演出の重みを差別化している。

### 攻撃以外のカード（バフ/回復）の効果エフェクト

「ダメージが出ない」効果系カードは、画面中央に大きなアイコン＋輪っか＋放射状スパーク＋全画面フラッシュを一瞬出す、専用の演出レイヤーを使う。カードの種類ごとに色/アイコン/ラベルだけ変えたテーブルを引く設計:

```js
const EFFECT_FX_STYLE = {
  atkBuff:  { icon: "🌸", label: "闘気上昇!", text: "text-red-300",     ring: "border-red-300",     rgb: "239,68,68" },
  guard:    { icon: "🐉", label: "鉄壁化!",   text: "text-emerald-300", ring: "border-emerald-300", rgb: "16,185,129" },
  // ...効果ごとに追加
};

const fireEffectFx = (key) => {
  if (!EFFECT_FX_STYLE[key]) return;
  const fxId = Date.now() + Math.random();
  setEffectFx({ key, fxId });
  // fxIdガード: 900ms後に「まだ自分が最新のfxか」を確認してからクリアする。
  // 連打で短時間に2回発火した時、古いtimeoutが新しい演出を消してしまう事故を防ぐ。
  setTimeout(() => setEffectFx(p => (p && p.fxId === fxId ? null : p)), 900);
};
```

```jsx
{effectFx && EFFECT_FX_STYLE[effectFx.key] && (() => {
  const fx = EFFECT_FX_STYLE[effectFx.key];
  return (
    <div key={effectFx.fxId} className="fixed inset-0 pointer-events-none flex items-center justify-center" style={{ zIndex: 63000 }}>
      <div style={{ animation: 'guardShine 550ms ease-out forwards' }}>
        <div className="text-[110px] drop-shadow-[0_0_30px_rgba(255,255,255,0.9)]">{fx.icon}</div>
      </div>
      {[0,1,2,3,4,5,6,7].map(k => (
        <div key={k} className="absolute" style={{ transform: `rotate(${k*45}deg)` }}>
          <div className={`rounded-full border-4 ${fx.ring}`} style={{ width: 30, height: 30, animation: `guardSpark 550ms ease-out ${k*20}ms forwards` }} />
        </div>
      ))}
      <div className={`absolute font-black text-3xl tracking-widest ${fx.text}`} style={{ top: '32%', animation: 'guardShine 550ms ease-out forwards' }}>{fx.label}</div>
      <div className="absolute inset-0" style={{
        background: `radial-gradient(circle at 50% 45%, rgba(${fx.rgb},0.5) 0%, rgba(${fx.rgb},0.25) 22%, rgba(0,0,0,0) 48%)`,
        animation: 'guardFlash 400ms ease-out forwards',
      }} />
    </div>
  );
})()}
```

```css
@keyframes guardShine { 0%{transform:scale(0.4); opacity:0;} 30%{transform:scale(1.25); opacity:1;} 70%{transform:scale(1.1); opacity:1;} 100%{transform:scale(1.4); opacity:0;} }
@keyframes guardSpark { 0%{transform:translateY(0) scale(0.3); opacity:0;} 40%{opacity:1;} 100%{transform:translateY(-140px) scale(1); opacity:0;} }
@keyframes guardFlash { 0%{opacity:0;} 25%{opacity:1;} 100%{opacity:0;} }
```

**ポイント**
- 8方向にスパークを`k*20ms`ずつずらして飛ばすと、単純な「一斉に光る」より「炸裂している」感が出る。角度は`[0,45,90,...]`のように均等割りにして、`transform:rotate()`＋`translateY(負の値)`の組み合わせで放射状に配置するのが定石（同じテクニックを敵の攻撃スパーク演出でも使い回している）。
- `key`（技/効果の識別子）と`fxId`（この1回の発火の識別子）を分けて持つことで、「同じ技を連打しても正しく再スタートする」演出になる。

---

## 4. 敵の攻撃によるダメージ表記エフェクト

プレイヤーが被弾する側は、「(a) 画面全体の揺れ」「(b) 自分の頭上に赤いダメージ数値」「(c) 敵側の予備動作（キャラが弾む＋！マーク/オーラ演出）」の3つを組み合わせている。

### (a) 画面シェイク

```js
const [screenShake, setScreenShake] = useState(false);
const [bigShake, setBigShake] = useState(false);

const triggerShake = useCallback((big = false) => {
  // 一度falseにしてから次のフレームでtrueにすることで、
  // 同じアニメーションを連続で当てても(React的に)差分なしと見なされず再生される
  setScreenShake(false); setBigShake(false);
  requestAnimationFrame(() => {
    setScreenShake(true); setBigShake(big);
    setTimeout(() => { setScreenShake(false); setBigShake(false); }, big ? 750 : 450);
  });
}, []);
```

```jsx
<div style={screenShake ? { animation: bigShake ? 'bigShake 750ms ease-in-out' : 'screenShake 450ms ease-in-out' } : undefined}>
  {/* バトル画面全体 */}
</div>
```

```css
@keyframes screenShake {
  0%,100% { transform: translate(0,0); }
  10% { transform: translate(-6px,-4px); } 20% { transform: translate(7px,3px); }
  30% { transform: translate(-8px,5px); }  40% { transform: translate(6px,-6px); }
  50% { transform: translate(-5px,4px); }  60% { transform: translate(7px,2px); }
  70% { transform: translate(-4px,-5px); } 80% { transform: translate(5px,3px); }
  90% { transform: translate(-3px,2px); }
}
```
`big`引数でボス級の攻撃だけ揺れ幅・時間を強化したバージョン（`transform`にわずかな`scale`も混ぜて「地響き」感を追加）を切り替えられるようにしておくと、通常攻撃とボス攻撃の重みの違いを表現できる。

**「一度falseにしてから`requestAnimationFrame`でtrueに戻す」がキモ**: `triggerShake()`を短時間に連打された時、Reactは「同じstyle文字列への変更なし」と判断してCSSアニメーションが再生されないことがある。一度falseを挟んでDOMに反映させてから次フレームでtrueにすることで、毎回確実にアニメーションを最初から再生できる。

### (b) 被ダメージ数値ポップアップ

セクション3の`addPopup`をそのまま再利用し、`side:'hero'`（自分側のアンカー）に赤系の色で出すだけ:

```js
addPopup(`-${incomingDmg}`, 'hero', 'text-pink-600 text-4xl font-black drop-shadow-lg animate-bounce');
triggerShake();
await wait(1000);
currentHp = Math.max(0, currentHp - incomingDmg);
setHp(currentHp); // ポップアップ表示から少し遅れてHPバーを減らすと「衝撃→ダメージ反映」の順序が生まれる
```

同じ仕組みで、ガード成功／貫通ダメージも出し分けられる:
```js
if (guardValue > 0) {
  const diff = guardValue - incomingDmg;
  if (diff < 0) {
    addPopup(`貫通! -${Math.abs(diff)}`, 'hero', 'text-pink-600 text-3xl font-black drop-shadow-lg');
  } else {
    addPopup(`🛡 ガード成功`, 'hero', 'text-emerald-400 text-2xl font-black drop-shadow-md');
    addPopup(`💚 ライフ +${diff}`, 'life', 'text-emerald-400 text-2xl font-black drop-shadow-md');
  }
}
```

### (c) 敵の予備動作エフェクト（種類ごとに出し分け）

```js
const [enemyAttackAnim, setEnemyAttackAnim] = useState(false);
const [enemyAttackFx, setEnemyAttackFx] = useState(null); // null | {kind:'normal'|'special'}

// 攻撃開始時
const fxKind = intent.type === 'CHARGE' ? 'special' : 'normal';
setEnemyAttackFx({ kind: fxKind });
setEnemyAttackAnim(true);
await wait(fxKind === 'special' ? 1100 : 450);
setEnemyAttackAnim(false);
await wait(fxKind === 'special' ? 300 : 100);
setEnemyAttackFx(null);
```

```jsx
{/* 敵スプライト自体の弾む動き */}
<div style={enemyAttackAnim ? { animation: 'enemyAttackFly 450ms ease-in forwards' } : undefined}>
  {/* 通常攻撃: 驚きマーク */}
  {enemyAttackFx?.kind === 'normal' && (
    <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
      <div className="absolute -top-3 -right-2 text-5xl font-black text-yellow-300" style={{ animation: 'exclaimPop 500ms cubic-bezier(.2,1.4,.4,1) forwards' }}>❗</div>
      <div className="absolute inset-0 rounded-full border-4 border-yellow-300/80" style={{ animation: 'shockRing 500ms ease-out forwards' }} />
    </div>
  )}
  {/* チャージ/特殊攻撃: オーラ+雷スパーク */}
  {enemyAttackFx?.kind === 'special' && (
    <div className="absolute inset-0 pointer-events-none flex items-center justify-center overflow-visible">
      <div className="absolute -inset-10 rounded-full" style={{
        background: 'radial-gradient(circle, rgba(251,191,36,0.55) 0%, rgba(239,68,68,0.45) 40%, rgba(0,0,0,0) 75%)',
        animation: 'auraPulse 600ms ease-out infinite',
      }} />
      {[0,30,60,90,120,150,180,210,240,270,300,330].map(deg => (
        <div key={deg} className="absolute text-3xl" style={{
          transform: `rotate(${deg}deg) translateY(-70px)`,
          animation: 'sparkFlicker 300ms ease-in-out infinite',
          animationDelay: `${deg}ms`,
        }}>⚡</div>
      ))}
      <div className="absolute text-7xl" style={{ animation: 'specialThrob 500ms ease-in-out infinite' }}>🔥</div>
    </div>
  )}
</div>
```

```css
@keyframes enemyAttackFly {
  0%   { transform: translateY(0) scale(1);     filter: drop-shadow(0 0 6px rgba(239,68,68,0.5)); }
  45%  { transform: translateY(90px) scale(1.18); filter: drop-shadow(0 0 20px rgba(239,68,68,0.9)); }
  60%  { transform: translateY(90px) scale(1.18); filter: drop-shadow(0 0 28px rgba(220,38,38,1)); }
  100% { transform: translateY(0) scale(1);     filter: drop-shadow(0 0 0 rgba(0,0,0,0)); }
}
@keyframes exclaimPop { 0%{transform:scale(0) translateY(8px) rotate(-12deg); opacity:0;} 55%{transform:scale(1.5) translateY(-4px) rotate(8deg); opacity:1;} 100%{transform:scale(1.15) translateY(0) rotate(0deg); opacity:1;} }
@keyframes shockRing   { 0%{transform:scale(0.6); opacity:0.9;} 100%{transform:scale(1.55); opacity:0;} }
@keyframes auraPulse   { 0%{transform:scale(0.85); opacity:0.55;} 50%{transform:scale(1.12); opacity:0.95;} 100%{transform:scale(0.85); opacity:0.55;} }
@keyframes sparkFlicker{ 0%,100%{opacity:0.2;} 50%{opacity:1;} }
@keyframes specialThrob{ 0%,100%{transform:scale(1); filter:drop-shadow(0 0 12px rgba(251,191,36,0.9));} 50%{transform:scale(1.25); filter:drop-shadow(0 0 22px rgba(239,68,68,1));} }
```

**ポイント**
- 「通常攻撃」と「特殊/チャージ攻撃」で明確に見た目のグレードを分けている（❗1個 vs オーラ+雷12本+輪っか3重+炎アイコン）。プレイヤーは光の量だけで「これは強い攻撃だ」と直感的に判断できる。
- `infinite`ループのキーフレームを使う場合は、必ず親のstate（`enemyAttackFx`）がnullになったタイミングでDOMごとアンマウントする設計にする。CSS側で終了時刻を制御しない代わりに、JS側の`await wait(...)`でライフサイクルを管理する。

---

## 応用のコツ（このリポジトリ全体で一貫している設計原則）

1. **状態は「今何を表示すべきか」だけを持つ**。アニメーションの中身（keyframes）とタイミング（何ms後に消すか）はコンポーネント外の定数/CSSに寄せて、JSXは条件分岐だけにする。
2. **一過性エフェクトは配列+ID+setTimeout自己削除**、**恒久的なプレビュー系は毎レンダー再計算**、と使い分ける。前者は「何が起きたか」の通知、後者は「今どういう状態か」の表示なので、ライフサイクルの持たせ方を変えるのが自然。
3. **`transform`と`opacity`と`filter`だけでアニメーションを組む**。`width`/`height`/`top`/`left`のアニメーションはリフローを引き起こしてカクつくので避ける（唯一の例外はドラッグ追従で、これは`position:fixed`の`left/top`を使っているが、これは「アニメーション」ではなく「毎フレーム別の値を再設定している」だけなのでリフローコストは許容範囲）。
4. **色・アイコン・ラベルはテーブル（オブジェクト）に外出しし、演出のJSXは1つの共通コンポーネント/レンダー分岐にまとめる**。新しい効果を追加するときはテーブルに1行足すだけで済むようにしておく。

// ==== 画面: HOME(村の広場)とそこに重なる案内 ====
//
// MonsterHeroGame から切り出した19本目(docs/refactor/REFACTOR_MASTER_PLAN.md STEP 6-12)。
// 村の広場そのものと、HOME にだけ出るかぶせもの3つ(ききの加入・ももすけの登場・
// アップデートの案内)。
//
// 【この画面ならではの注意】
// ・HOME は**配置の検査がある唯一の画面**。触ったら必ず `node tools/home-layout-check.js` を通す。
//   助手(みゅあ)の吹き出し・施設のボタン・はじめての案内が同じ場所に重なるため、
//   ここだけは実際のブラウザで位置を測って確かめている
// ・施設へ入る7つの行き先は props(onOpen*)で受け取る。画面は行き先の名前を持たない
// ・かぶせもの3つは「HOME にいて、チュートリアルが終わっていて、前の会話が片付いていたら」
//   という順番で出る。その条件は MonsterHeroGame 側に残し、ここは中身だけを持つ
// イベント開催中の角バッジ(2026-09-11・ユーザー指示
// 「右上とか左上とか専用バッジを付けるようにして」「そこそこ派手目に / キラキラ強調されてるような」)。
//
// ★この機能ぶんのCSSは、ここで <style> を置いて閉じる。70-bootstrap.jsx の大きなCSSへ
//   書き足したときは、1行に複数の規則が並ぶ場所へ入って @media の内側になり、
//   文書へ一度も読み込まれなかった(実ブラウザで 0件 / 全1161規則)。
//   さらに消すときに同じ行の続きまで巻き込んで、横画面の配置を壊した。
//   ここへ閉じておけば、ほかのCSSを壊しようがない。
// ★位置は超越バッジ・魂格バッジと同じ「角へ少しはみ出す」置き方にそろえる。
// ★動きを減らす設定の人には光らせない(prefers-reduced-motion)。
// ★位置と見た目は style で直に持たせる。配置の検査(home-layout-check.js)は
//   このCSSを読み込まないので、クラスだけに頼ると検査の中で「ただの文字」になり、
//   ボタンが横に広がって施設の位置がずれてしまう(実際に落ちた)。
//   クラスのほうは「光り方・動き」だけを足す係にする。
// 2026-11-27 r1126-073(すぐできる直し3): 入口の札(β版 開幕！・開催中・近日公開)は「左上・同じ高さ・同じ形」の1種類にそろえる。
//   前は右上の角へはみ出す置き方で、助手の顔の丸の下に7割ほど隠れていた。字は小さい字の決まり(11px)に合わせる
const HOME_EVENT_BADGE_STYLE = Object.freeze({
  position:'absolute', top:'4px', left:'4px', zIndex:8,
  display:'block', overflow:'hidden', padding:'2px 7px',
  border:'1px solid #fff3c4', borderRadius:'999px',
  background:'linear-gradient(135deg,#f59e0b,#fde047 45%,#f97316)',
  color:'#4a1d00', fontSize:'11px', fontWeight:1000, fontStyle:'normal',
  lineHeight:1.35, whiteSpace:'nowrap', textShadow:'0 1px 0 #fff8', pointerEvents:'none',
  boxShadow:'0 0 0 1px #0006,0 2px 8px #000a,0 0 10px #fbbf24cc,0 0 18px #f59e0b80',
});
const HOME_EVENT_BADGE_CSS = `
.mh-home-event-badge{animation:mhHomeEventBadgePulse 1.6s ease-in-out infinite}
.mh-home-event-badge::after{content:'';position:absolute;top:0;bottom:0;left:-60%;width:45%;
  background:linear-gradient(100deg,#fff0,#ffffffcc,#fff0);
  animation:mhHomeEventBadgeShine 2.4s ease-in-out infinite}
@keyframes mhHomeEventBadgePulse{
  0%,100%{box-shadow:0 0 0 1px #0006,0 2px 8px #000a,0 0 10px #fbbf24cc,0 0 18px #f59e0b80;transform:scale(1)}
  50%{box-shadow:0 0 0 1px #0006,0 2px 8px #000a,0 0 16px #fde047,0 0 30px #f59e0bcc;transform:scale(1.06)}}
@keyframes mhHomeEventBadgeShine{0%{left:-60%}55%{left:120%}100%{left:120%}}
@media(prefers-reduced-motion:reduce){
  .mh-home-event-badge{animation:none;transform:none}
  .mh-home-event-badge::after{display:none}}
/* イベントの札の題の2行目(title2)。背の低い横画面では、2行のまま字と余白を詰めて札の高さを1行の題のときと同じくらいにする
   (2026-11-14 横 568×320 の長い台詞で、背が伸びた札が M/B管理 にかかった。1行に並べると横に伸びてモンヒロビートの顔の列にかかる) */
.mh-home-event-banner .t2{display:block}
/* r1119-131: 1行目は題と期間を横に並べる(入らなければ期間だけ折り返す)。札は右の時計の手前まで伸ばしてよい */
.mh-home-event-banner .r1{display:flex;flex-wrap:wrap;align-items:baseline;column-gap:7px;row-gap:0}
.mh-home-event-banner .r1 small{white-space:nowrap}
.mh-home-event-banner .t2{font-size:10px;font-weight:800;color:#ffedd5}
.mh-home-scene .mh-home-event-strip .mh-home-event-banner{max-width:calc(100cqw - 9px - 88px)}
/* 横の小さい端末(568×320 など)では、左39%から始まる札が助手の吹き出し(右端は台詞しだいで 240〜350px)にかかっていた。
   この大きさだけ、札を吹き出しの下の空き(施設の列の上)へ下ろす */
@media(orientation:landscape) and (max-width:620px) and (max-height:340px){
  .mh-home-scene .mh-home-event-strip{top:calc(160px + env(safe-area-inset-top))}}
@media(orientation:landscape) and (max-height:430px){
  .mh-home-scene .mh-home-event-banner{padding:3px 10px;gap:0}
  .mh-home-scene .mh-home-event-banner b,.mh-home-scene .mh-home-event-banner .t2{font-size:10px;line-height:1.1}
  .mh-home-scene .mh-home-event-banner small{line-height:1.1}}
`;
// ★HOME の作り直し(2026-11-27 台帳 r1126-073・社長の選択「A＋Bの入口」・点検と見本は docs/progress/home-review-2026-11/)。
//   上は「名前・ダイヤ・メニュー☰」の1段とイベントの帯1枚(案A)。入口は遊ぶ4つを大きく、たまに行く4つを小さな丸に(案B)。
//   70-bootstrap.jsx の元の HOME の決め方の上に重ねる。どれも .mh-home-scene.mh-home-v2 の中だけに効かせる(ほかの画面は変わらない)。
//   <head> へ1回だけ入れる(HOMEのDOMへ <style> を混ぜると配置の検査の数がずれる・上の★と同じ)
//   字はいちばん小さくても 11px(すぐできる直し7)。横向き・タブレットは README の目安(帯の幅は最大 600px・入口は1列で遊ぶ4つを幅広に)
const HOME_V2_CSS = `
.mh-home-v2{--v2-panel:#102522eb;--v2-line:#f7df9a88}
.mh-home-v2 .mh-home-top{display:flex;align-items:center;gap:6px;padding:calc(6px + env(safe-area-inset-top)) 8px 0;z-index:20}
.mh-home-v2 .mh-home-top .mh-home-player{flex:1 1 auto;min-width:0;height:46px;padding:3px 10px 3px 4px;gap:7px}
.mh-home-v2 .mh-home-top .mh-home-avatar{flex:0 0 36px;width:36px;height:36px}
.mh-home-v2 .mh-home-top .mh-home-player-copy strong{max-width:none;font-size:13px;line-height:1.25}
.mh-home-v2 .mh-home-top .mh-home-player-copy span{font-size:11px;line-height:1.25}
.mh-home-v2 .mh-home-top .mh-home-top-wallet{display:flex;align-items:center;width:auto;height:46px;padding:0 10px;grid-template-columns:none}
.mh-home-v2 .mh-home-top .mh-home-top-wallet>div{display:flex;align-items:center;gap:4px;padding:0}
.mh-home-v2 .mh-home-top .mh-home-top-wallet>div b{font-size:14px;line-height:1.1}
.mh-home-v2 .mh-home-top .mh-home-top-wallet>div small{font-size:11px}
.mh-home-v2 .mh-home-menu-btn{position:relative;flex:0 0 auto;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;width:56px;height:46px;border:1px solid var(--v2-line);border-radius:14px;background:var(--v2-panel);color:#fce6ab;box-shadow:0 4px 14px #071613cc,inset 0 1px #fff3;pointer-events:auto;touch-action:manipulation}
.mh-home-v2 .mh-home-menu-btn:active,.mh-home-v2 .mh-home-menu-btn.is-open{filter:brightness(1.3)}
.mh-home-v2 .mh-home-menu-bars{display:flex;flex-direction:column;gap:3px}
.mh-home-v2 .mh-home-menu-bars i{display:block;width:20px;height:2.5px;border-radius:2px;background:#fce6ab}
.mh-home-v2 .mh-home-menu-lb{font-size:11px;font-weight:900;line-height:1}
.mh-home-v2 .mh-home-menu-btn em,.mh-home-v2 .mh-home-menu .mh-home-side-btn em{display:flex;align-items:center;justify-content:center;min-width:20px;height:20px;padding:0 5px;border-radius:999px;border:2px solid #fff;background:#e11d48;color:#fff;font-size:11px;font-style:normal;font-weight:900;line-height:1;box-shadow:0 2px 6px #0008}
.mh-home-v2 .mh-home-menu-btn em{position:absolute;top:-7px;right:-6px}
.mh-home-v2 .mh-home-menu-shade{position:absolute;inset:0;z-index:28;border:0;background:#0006;cursor:default}
.mh-home-v2 .mh-home-menu{position:absolute;z-index:29;right:8px;top:calc(58px + env(safe-area-inset-top));display:flex;flex-direction:column;gap:6px;width:min(240px,calc(100% - 16px));padding:8px;border:1px solid var(--v2-line);border-radius:16px;background:#0d1f1cf7;box-shadow:0 10px 30px #000c}
/* 閉じているときは目に見えない形(読み上げには残す)。メニューの中の「設定」「ミッション」などを、読み上げの利用者と検査がいつでも見つけられるように */
.mh-home-v2 .mh-home-menu:not(.is-open){width:1px;height:1px;padding:0;margin:0;border:0;overflow:hidden;clip-path:inset(50%);white-space:nowrap;pointer-events:none;box-shadow:none}
.mh-home-v2 .mh-home-menu.is-open{display:flex;animation:mhHomeMenuIn .15s ease-out}
@keyframes mhHomeMenuIn{from{opacity:0;transform:translateY(-6px)}to{opacity:1;transform:none}}
@media(prefers-reduced-motion:reduce){.mh-home-v2 .mh-home-menu.is-open{animation:none}}
.mh-home-v2 .mh-home-menu-info{display:flex;align-items:center;justify-content:space-between;gap:6px;padding:0 2px 4px;border-bottom:1px solid #fff2}
.mh-home-v2 .mh-home-menu .mh-tod-clock{position:static!important}
.mh-home-v2 .mh-home-menu-bp{display:flex;align-items:center;gap:4px;margin-left:auto;color:#ffe08a;font-size:13px;font-weight:900}
.mh-home-v2 .mh-home-menu-bp small{font-size:11px;color:#f4e7c3}
.mh-home-v2 .mh-home-menu .mh-home-side-btn{display:flex;flex-direction:row;align-items:center;gap:10px;width:100%;min-height:46px;padding:5px 10px 5px 6px;border-radius:12px;background:#ffffff10;color:#fff;text-align:left}
.mh-home-v2 .mh-home-menu .mh-home-side-btn:active{background:#ffffff26;transform:none}
.mh-home-v2 .mh-home-menu .mh-home-side-ic{flex:0 0 34px;width:34px;height:34px}
.mh-home-v2 .mh-home-menu .mh-home-side-lb{flex:1;font-size:14px;font-weight:900;text-shadow:none}
.mh-home-v2 .mh-home-menu .mh-home-side-btn em{position:static;margin-left:auto}
/* 更新履歴の未読の数(r1126-074)は「99+」まで出るので、丸を字の幅に合わせて伸ばす */
.mh-home-v2 .mh-home-menu .mh-home-side-btn em.mh-unread-badge{width:auto!important;height:20px!important;min-width:20px;padding:0 6px!important;border-radius:999px!important;font-size:11px!important;line-height:1!important;white-space:nowrap}
.mh-home-v2 .mh-home-settings .mh-home-side-ic{border-color:#cbd5e1aa;background:#1e293be8;color:#e2e8f0}
.mh-home-v2 .mh-home-band{position:relative;z-index:6;margin:6px 8px 0}
.mh-home-v2 .mh-home-band-view{overflow:hidden;border-radius:14px}
.mh-home-v2 .mh-home-band-track{display:flex;transition:transform .35s ease}
.mh-home-v2 .mh-home-band-slide{flex:0 0 100%;min-width:0;height:80px}
.mh-home-v2 .mh-home-band-slide>button{width:100%;height:80px}
.mh-home-v2 .mh-home-band .mh-home-event-banner{max-width:none;justify-content:center;gap:4px;padding:8px 14px;border-radius:14px;font-size:15px}
.mh-home-v2 .mh-home-band .mh-home-event-banner .r1{column-gap:8px}
.mh-home-v2 .mh-home-band .mh-home-event-banner small{font-size:11px}
.mh-home-v2 .mh-home-band .mh-home-event-banner .t2{font-size:12px}
.mh-home-v2 .mh-home-band .mh-home-tour-banner{max-width:none;gap:10px;padding:8px 14px;border-radius:14px}
.mh-home-v2 .mh-home-band .mh-home-tour-banner>span:first-child{font-size:30px}
.mh-home-v2 .mh-home-band .mh-home-tour-banner b{font-size:15px}
.mh-home-v2 .mh-home-band .mh-home-tour-banner small,.mh-home-v2 .mh-home-band .mh-home-tour-banner em{font-size:11px}
.mh-home-v2 .mh-home-band-nav{display:flex;align-items:center;justify-content:space-between;gap:6px;margin-top:2px}
.mh-home-v2 .mh-home-band-nav .mh-home-event-strip-dots button{display:flex;align-items:center;justify-content:center;width:22px;height:22px;padding:0;border:0;background:transparent}
.mh-home-v2 .mh-home-band-nav .mh-home-event-strip-dots i{width:8px;height:8px;box-shadow:0 0 0 1px #0008}
.mh-home-v2 .mh-home-band-nav .mh-home-event-strip-dots button.on i{width:18px;border-radius:4px;background:#fde68a}
.mh-home-v2 .mh-home-band-next{min-width:0;max-width:72%;min-height:22px;overflow:hidden;padding:2px 9px;border-radius:999px;background:#000a;color:#fffbeb;font-size:11px;font-weight:900;text-overflow:ellipsis;white-space:nowrap}
.mh-home-v2 .mh-home-assistant{width:70%;max-width:360px;margin:6px 0 0 8px}
.mh-home-v2 .mh-home-assistant-fold{margin:6px 0 0 8px}
.mh-home-v2 .mh-home-assistant-show-mark{right:-8px;bottom:-6px;width:24px;height:24px;font-size:14px;background:#fff!important;box-shadow:0 0 0 2px #e11d48,0 2px 6px #0009;animation:mhHomePeerMark 1.4s ease-in-out infinite}
@keyframes mhHomePeerMark{0%,100%{transform:scale(1)}50%{transform:scale(1.15)}}
@media(prefers-reduced-motion:reduce){.mh-home-v2 .mh-home-assistant-show-mark{animation:none}}
.mh-home-v2 .mh-home-assistant-news-dot{position:absolute;top:1px;right:1px;width:13px;height:13px;border-radius:50%;border:2px solid #fff;background:#e11d48;box-shadow:0 1px 4px #0009}
.mh-home-v2 .mh-home-peer-mark{position:absolute;left:52px;top:calc(100% + 4px);width:36px;height:36px;display:flex;align-items:center;justify-content:center;border-radius:50%;border:1.5px solid #f9a8d4;background:#1e0b24ee;font-size:16px;box-shadow:0 2px 8px #0009}
.mh-home-v2 .mh-home-dock{gap:6px;padding:8px 8px calc(8px + env(safe-area-inset-bottom))}
.mh-home-v2 .mh-home-dock-row{gap:6px}
.mh-home-v2 .mh-home-dock-top>.mh-home-dock-card,.mh-home-v2 .mh-home-dock-top>.mh-home-success{height:clamp(112px,18cqh,150px);padding:0;gap:0;overflow:hidden;border-radius:14px}
.mh-home-v2 .mh-home-dock-top .mh-home-dock-pic,.mh-home-v2 .mh-home-dock-top .mh-home-success .pic{flex:1 1 auto;width:100%;max-width:none;height:auto;min-height:0;aspect-ratio:auto;border-radius:0}
.mh-home-v2 .mh-home-dock-top .mh-home-dock-pic img,.mh-home-v2 .mh-home-dock-top .mh-home-success .pic img{object-position:50% 30%}
.mh-home-v2 .mh-home-dock-top .mh-home-dock-txt,.mh-home-v2 .mh-home-dock-top .mh-home-success .txt{position:absolute;left:0;right:0;bottom:0;height:auto;gap:0;padding:14px 1px 4px;background:linear-gradient(#0000,#000000c8 45%)}
.mh-home-v2 .mh-home-dock-top .mh-home-dock-name,.mh-home-v2 .mh-home-dock-top .mh-home-success .nm{font-size:11.5px;letter-spacing:-.04em;line-height:1.2}
.mh-home-v2 .mh-home-dock-top .mh-home-dock-sub,.mh-home-v2 .mh-home-dock-top .mh-home-success .sb{font-size:11px;line-height:1.2}
.mh-home-v2 .mh-home-dock-bottom{justify-content:space-around}
.mh-home-v2 .mh-home-dock-bottom>.mh-home-dock-card{flex:1 1 0;max-width:96px;gap:3px;padding:0;border:0;background:transparent;box-shadow:none}
.mh-home-v2 .mh-home-dock-bottom .mh-home-dock-pic{width:50px;height:50px;max-width:none;aspect-ratio:1;border-radius:50%;border:2px solid #ffe6a7c0;box-shadow:0 3px 10px #0009}
.mh-home-v2 .mh-home-dock-bottom .mh-home-dock-txt{height:auto}
.mh-home-v2 .mh-home-dock-bottom .mh-home-dock-name{font-size:11px;line-height:1.2}
@media(max-width:350px){.mh-home-v2 .mh-home-dock-top .mh-home-dock-name,.mh-home-v2 .mh-home-dock-top .mh-home-success .nm{font-size:10.5px;letter-spacing:-.06em}}
@media(orientation:landscape) and (max-height:600px){
  .mh-home-v2 .mh-home-band{position:absolute;left:8px;top:calc(58px + env(safe-area-inset-top));width:min(37%,330px);margin:0}
  .mh-home-v2 .mh-home-band-slide,.mh-home-v2 .mh-home-band-slide>button{height:68px}
  .mh-home-v2 .mh-home-band-slide>button[data-home-xmas-entry]{height:68px!important}
  .mh-home-v2 .mh-home-assistant,.mh-home-v2 .mh-home-assistant-fold{position:absolute;left:8px;top:calc(160px + env(safe-area-inset-top));margin:0}
  .mh-home-v2 .mh-home-assistant{width:min(37%,330px)}
  .mh-home-v2 .mh-home-dock{flex-direction:row;align-items:flex-end;gap:8px;padding:5px 8px calc(6px + env(safe-area-inset-bottom))}
  .mh-home-v2 .mh-home-dock-top{flex:1.9 1 0}
  .mh-home-v2 .mh-home-dock-bottom{flex:1 1 0}
  .mh-home-v2 .mh-home-dock-top>.mh-home-dock-card,.mh-home-v2 .mh-home-dock-top>.mh-home-success{height:clamp(84px,25cqh,104px);max-width:none}
  .mh-home-v2 .mh-home-dock-bottom .mh-home-dock-pic{width:44px;height:44px}
}
@container (min-width:700px) and (min-height:560px){
  .mh-home-v2 .mh-home-band{width:min(600px,calc(100% - 16px));margin:8px auto 0}
  .mh-home-v2 .mh-home-band-slide,.mh-home-v2 .mh-home-band-slide>button{height:92px}
  .mh-home-v2 .mh-home-band-slide>button[data-home-xmas-entry]{height:92px!important}
  .mh-home-v2 .mh-home-assistant{width:360px}
  .mh-home-v2 .mh-home-dock{flex-direction:row;align-items:flex-end;gap:14px;padding:10px 14px calc(12px + env(safe-area-inset-bottom))}
  .mh-home-v2 .mh-home-dock-top{flex:2 1 0;justify-content:center}
  .mh-home-v2 .mh-home-dock-bottom{flex:1 1 0}
  .mh-home-v2 .mh-home-dock-top>.mh-home-dock-card,.mh-home-v2 .mh-home-dock-top>.mh-home-success{height:min(170px,19cqh);max-width:180px;border-radius:16px}
  .mh-home-v2 .mh-home-dock-top .mh-home-dock-name,.mh-home-v2 .mh-home-dock-top .mh-home-success .nm{font-size:13px}
  .mh-home-v2 .mh-home-dock-top .mh-home-dock-sub,.mh-home-v2 .mh-home-dock-top .mh-home-success .sb{font-size:12px}
  .mh-home-v2 .mh-home-dock-bottom .mh-home-dock-pic{width:62px;height:62px}
  .mh-home-v2 .mh-home-dock-bottom .mh-home-dock-name{font-size:12px}
}
/* クリスマスの入口(79-screen-xmas-event.jsx)は、横向きで帯を右の列の横へ動かす決まりを持っている(前の HOME の形のため)。
   新しい帯の中では、ほかの1枚と同じ位置・大きさのままにする(部品の中身は変えない。HOME の側で上書きするだけ) */
.mh-home-v2 .mh-home-band-slide[data-home-xmas-entry-strip]{position:relative!important;left:auto!important;right:auto!important;top:auto!important;width:auto!important;margin:0!important}
@media (orientation:landscape) and (max-height:520px){.mh-home-v2 .mh-home-band .mh-xmas-entry[data-home-xmas-entry="banner"] .mh-xmas-entry-sub{font-size:11px}}
/* 横持ちの iPhone の切り欠き(カメラの欠け)に、押す物を入れない。左右の余白に端末の安全な余白(safe-area)を足す */
.mh-home-v2 .mh-home-top{padding-left:calc(8px + env(safe-area-inset-left));padding-right:calc(8px + env(safe-area-inset-right))}
.mh-home-v2 .mh-home-menu{right:calc(8px + env(safe-area-inset-right))}
.mh-home-v2 .mh-home-band{margin-left:calc(8px + env(safe-area-inset-left));margin-right:calc(8px + env(safe-area-inset-right))}
.mh-home-v2 .mh-home-assistant,.mh-home-v2 .mh-home-assistant-fold{margin-left:calc(8px + env(safe-area-inset-left))}
.mh-home-v2 .mh-home-dock{padding-left:calc(8px + env(safe-area-inset-left));padding-right:calc(8px + env(safe-area-inset-right))}
@media(orientation:landscape) and (max-height:600px){
  .mh-home-v2 .mh-home-band{left:calc(8px + env(safe-area-inset-left));margin:0}
  .mh-home-v2 .mh-home-assistant,.mh-home-v2 .mh-home-assistant-fold{left:calc(8px + env(safe-area-inset-left));margin:0}
}
@container (min-width:700px) and (min-height:560px){
  .mh-home-v2 .mh-home-band{margin-left:auto;margin-right:auto}
  .mh-home-v2 .mh-home-dock{padding-left:calc(14px + env(safe-area-inset-left));padding-right:calc(14px + env(safe-area-inset-right))}
}
`;
// ★イベント・レイドボス「ジャック」(docs/spec/RAID_BOSS_JACK.md)。開催中だけ、HOMEの真ん中でぴょこぴょこ跳ねる。
//   タップでレイド画面を開く。近くに、いま挑める段階の共有HPバーを出す。ときどき両腕を上げたポーズに変わる(HPとは連動しない)。
// ★位置・大きさ・見た目は style で直に持たせ、クラスは「動き」だけを足す係にする(配置の検査はこのCSSを読まないため)。
// ★CSSは <head> へ1回だけ入れる。HOMEのDOMへ <style> を混ぜると、配置の検査が数える要素の数がずれる。
// ★動きを減らす設定の人には跳ねさせない(prefers-reduced-motion)。
const HOME_RAID_JACK_CSS = `
.mh-home-raid-jack-img{animation:mhRaidJackHop 1.15s cubic-bezier(.3,.1,.4,1) infinite;transform-origin:50% 100%}
.mh-home-raid-jack-shadow{animation:mhRaidJackShadow 1.15s cubic-bezier(.3,.1,.4,1) infinite}
@keyframes mhRaidJackHop{
  0%,100%{transform:translateY(0) scale(1.06,.92)}
  18%{transform:translateY(0) scale(.96,1.06)}
  50%{transform:translateY(-16px) scale(1,1) rotate(-2deg)}
  82%{transform:translateY(0) scale(1.05,.94) rotate(1deg)}}
@keyframes mhRaidJackShadow{0%,100%{transform:scaleX(1.05);opacity:.5}50%{transform:scaleX(.7);opacity:.3}}
@media(prefers-reduced-motion:reduce){.mh-home-raid-jack-img,.mh-home-raid-jack-shadow{animation:none}}
/* 背の低い横画面: クリスマスのボスは枠より上へはみ出して描くので、耳が上の欄の裏に隠れた(#7857 点検の8)。絵を少し縮めて上を空ける。足もとの位置は変えない */
@media(orientation:landscape) and (max-height:430px){.mh-home-raid-boss-tall{height:112% !important}}
`;
// ★重なり順は 4(2026-10-11・社長の実機の指摘で、旧・施設の並び(z-index:3)より前にした)。
//   枠そのものは押せなくして(pointerEvents:none)、吹き出しとジャック本体だけを押せるようにする
//   (枠の余白で施設の押し場所をふさがない)。上の帯・みゅあ・ギフトなどと、2026-11-17 からは下のドック(z-index:5)より後ろのまま
const HOME_RAID_JACK_WRAP_STYLE = Object.freeze({
  position:'absolute', left:'50%', top:'44%', transform:'translate(-50%,-50%)', zIndex:4, pointerEvents:'none',
  width:'44%', maxWidth:'190px', minWidth:'120px',
});
// ★炎(オーラ)だけは、施設(z-index:3)より後ろの 2 に分けて描く(2026-10-13・社長「またレイドボスのオーラが各施設に重なってる」)。
//   10/07(#2299)に炎を施設の後ろへ回したが、10/11 に吹き出しを押せるようにするためジャック全体を 4 へ上げたとき、
//   中にある炎も一緒に施設の札・みゅあの吹き出しの前へ出てしまった。ジャック本体と吹き出しは 4 のまま(押せる)、炎は別の層。
//   炎の層には本体と同じ形の見えない枠を置き、炎の位置・大きさは本体の中にあったときと同じにする
const HOME_RAID_JACK_AURA_WRAP_STYLE = Object.freeze({ ...HOME_RAID_JACK_WRAP_STYLE, zIndex:2 });
const HOME_RAID_JACK_AURA_BOX_STYLE = Object.freeze({ display:'flex', flexDirection:'column', alignItems:'center', width:'100%', visibility:'hidden' });
const HOME_RAID_JACK_BUTTON_STYLE = Object.freeze({
  display:'flex', flexDirection:'column', alignItems:'center', width:'100%',
  background:'transparent', border:'0', padding:'0', cursor:'pointer', pointerEvents:'auto',
});
// ★ジャックのひとこと(吹き出し)の置き場所を、その端末の画面で測って決める(2026-10-10・社長の実機の指摘)。
//   iPhone縦では「M/B管理」「神殿」のボタンの下へ吹き出しがもぐって文の頭が隠れ、横では上の帯の裏へ隠れていた。
//   HOMEのボタンの位置は端末ごとに違うので、決め打ちの位置ではどこかで必ず重なる。
//   そこで「ボタン・みゅあの吹き出し・画面の端」を障害物として測り、重ならない場所と幅を順に試す:
//     頭の上で、広い幅から順に、左右へずらし、少しずつ下げて頭の4分の3まで重ねる。帯(〜があらわれた！・共有HP)には乗せない。
//     以前は頭の右・左にも置いたが、狭い画面で帯を隠した(2026-10-24 窓口「iPhone 13 と同じように、かぼちゃの上に」)
//   札・帯にかかる所、かぼちゃの顔を隠す所には置かない。置ける所が無いときは出さない。
//   ボタン側は動かさない(押せる場所を変えない)。
//   head … ジャック本体の絵の箱(跳ねる前の位置) / band … 帯の箱 / obstacles … 避ける箱 / measure(width) … その幅での吹き出しの高さ
// 広い順に試すので、入るならこれまでどおり広いほうになる。いちばん狭くて 144px(2026-10-24 窓口・カゲあつくん「言葉の途中で折れないように」。
// 以前は狭い画面(幅320)でジャックの横へ置くとき用に 104・96 まであったが、1行に8字ほどしか入らず「いってらっ／しゃい」と折れた。
// 144px なら本文が約120pxで、太字の11pxが10字入る(jaWrap は言葉のかたまりを10字までに分ける。41-screen-ui.jsx の JA_WRAP_LINE)。
// 台詞を全部描いて確かめる検査は tools/boot/ja-wrap-lines-check.js
const HOME_RAID_SAY_WIDTHS = Object.freeze([184, 168, 152, 144]);
// 上の幅がどれも置けないときだけ、字を10pxにした 136px、字9pxにした 120px(本文は約96px。10字の言葉のかたまりが1行に入る)も使う。
// 幅320や 360×640 では、みゅあの吹き出しと M/B管理・神殿の札のすき間が狭く、それより広いとかぼちゃの上に置けなかった(2026-10-24)
const HOME_RAID_SAY_SMALL_WIDTHS = Object.freeze([136, 120]);
const HOME_RAID_SAY_INLINE_NEXT = 130; // これより狭い吹き出しは字9pxにし、「▶ つぎ」を下の枠線の上に乗せて1行減らす
const homeRaidSayFont = (width) => (width < HOME_RAID_SAY_INLINE_NEXT ? 9 : width < 144 ? 10 : 11);
// 幅360未満の画面では、帯の「ジャック大王があらわれた！」を字9pxにして1行に収める
const HOME_RAID_SAY_NARROW_VW = 360;
const HOME_RAID_SAY_HOP = 18; // 跳ねる高さ(mhRaidJackHop の16px)+ゆとり。頭の上に置くときは、跳ねても頭がしっぽにかからない
// かぼちゃの目の高さ(絵の箱の上から45%)。吹き出しは、しっぽの先まで、目より HOME_RAID_SAY_FACE_GAP だけ上に置く
// (2026-10-24 窓口「320 で大王の吹き出しがかぼちゃの顔を隠している」。跳ねる16pxの半分のゆとり)
const HOME_RAID_SAY_FACE = 0.45;
const HOME_RAID_SAY_FACE_GAP = 8;
const homeRaidSayPlace = ({ head, band = null, obstacles, vw, vh, measure, top = 0 }) => {
  const widths = [...HOME_RAID_SAY_WIDTHS, ...HOME_RAID_SAY_SMALL_WIDTHS];
  const pad = 4, edge = 6, tail = 9;
  const hit = (r, o, p = 0) => { const w = Math.min(r.right, o.right + p) - Math.max(r.left, o.left - p), h = Math.min(r.bottom, o.bottom + p) - Math.max(r.top, o.top - p); return w > 0 && h > 0 ? w * h : 0; };
  const faceTop = head.top + (head.bottom - head.top) * HOME_RAID_SAY_FACE - HOME_RAID_SAY_FACE_GAP;
  // 置いてよいのは、画面の中で、札(ボタン)・みゅあの吹き出し・帯(〜があらわれた！・共有HP)のどれにもかからず、かぼちゃの顔を隠さない所だけ。
  // 札にかけて置くのはやめた(2026-10-24 窓口「M/B管理の札にかぶり『モンスター・編』で切れている。置ける場所がなければ出さない扱いで構わない」)
  const fits = (r) => {
    if (r.left < edge || r.top < top + edge || r.right > vw - edge || r.bottom > vh - edge) return false;
    if (r.bottom + tail > faceTop) return false;
    if (band && hit({ ...r, bottom: r.bottom + tail }, band, 2)) return false;
    return obstacles.every((o) => !hit(r, o, pad));
  };
  const clampX = (x, w) => Math.max(edge, Math.min(vw - edge - w, x));
  const cx = (head.left + head.right) / 2;
  // いつも頭の上に置く。横へ置くのはやめた(2026-10-24 窓口「狭い画面でも iPhone 13 と同じように、かぼちゃの上に」)。
  // 広い幅から順に、真上(跳ねても頭がしっぽにかからない高さ)から6pxずつ下げ(顔の上まで)、それぞれで左右へ6pxずつ(48pxまで)ずらして、札とのすき間を探す
  const tries = [];
  for (const w of widths) {
    const h = measure(w);
    const from = head.top - HOME_RAID_SAY_HOP - h, to = faceTop - tail - h;
    for (let y = from; y <= Math.max(from, to); y += 6) {
      tries.push({ side: 'top', left: clampX(cx - w / 2, w), top: y, width: w, height: h });
      for (let dx = 6; dx <= 48; dx += 6) for (const sign of [1, -1]) tries.push({ side: 'top', left: clampX(cx - w / 2 + sign * dx, w), top: y, width: w, height: h });
      // 札の端にそろえた位置も試す(幅320は M/B管理と神殿のすき間がちょうど吹き出しの幅ほどで、6pxずつでは当たらない)
      for (const o of obstacles) for (const left of [o.right + pad, o.left - pad - w]) if (Math.abs(left + w / 2 - cx) <= 60) tries.push({ side: 'top', left: clampX(left, w), top: y, width: w, height: h });
    }
  }
  for (const t of tries) if (fits({ left: t.left, top: t.top, right: t.left + t.width, bottom: t.top + t.height })) return { ...t, clear: true };
  // 置ける所が無いときは、吹き出しを出さない(幅320で、みゅあ・ジャックの台詞が長いとき)。ジャックを押せばレイド画面へ行けるのは同じ。
  // みゅあの台詞・ジャックの台詞が変われば、測り直して出す
  return tries.length ? { ...tries[0], clear: false, hidden: true } : null;
};
const homeRaidSayObstacles = (wrap) => {
  if (typeof document === 'undefined') return [];
  const vw = window.innerWidth, vh = window.innerHeight, out = [];
  document.querySelectorAll('button, a[href], [role="button"]').forEach((el) => {
    if (wrap && wrap.contains(el)) return;
    // 施設は下のドックに集まった(2026-11-17 ホーム一新)。ドックのボタンは見えている面そのものが押し場所なので、
    // ほかのボタンと同じくボタン全体を避ける(以前の「見える札だけを避ける」特別扱いは、建物ぶんの透明な押し場所があった頃のもの)
    const r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2 || r.right <= 0 || r.bottom <= 0 || r.left >= vw || r.top >= vh) return;
    if (r.width * r.height > vw * vh * 0.4) return;
    const cs = getComputedStyle(el);
    if (cs.visibility === 'hidden' || cs.display === 'none' || Number(cs.opacity) === 0) return;
    out.push({ left: r.left, top: r.top, right: r.right, bottom: r.bottom });
  });
  return out;
};
// ev: どのレイドか(36-raid-xmas-api.jsx の RAID_EVENT_JACK / RAID_EVENT_XMAS)。クリスマスはジャックと同じ置き方・同じ開き方(台帳 r1126-006)。
//   ジャックだけの物(ひとことの台詞・両腕ポーズ・炎のオーラ・ぱんぷきん)はクリスマスでは出さない(台詞などは決まったら ev に足す)
const HomeRaidJack = ({ eventId, onOpen, ev = RAID_EVENT_JACK }) => {
  const isJack = ev.key !== 'xmas';
  // 前回取れた段階の合計から描き始める(36-raid-jack-api.jsx の raidJackTotalsCache)。読み込みが終わるまでの間を「男爵・ライフ満タン」にしない
  const [totals, setTotalsState] = React.useState(() => raidJackCachedTotals(eventId));
  const setTotals = (t) => { raidJackRememberTotals(eventId, t); setTotalsState((prev) => (t || prev === undefined ? t : prev)); };
  // ひとこと(吹き出し)。押すと次のセリフへ。最初の1つは開くたびに変わる
  const [lineNo, setLineNo] = React.useState(() => Math.floor(Math.random() * 1000));
  const [pose, setPose] = React.useState(false);
  React.useEffect(() => {
    if (typeof document === 'undefined' || document.getElementById('mh-home-raid-jack-css')) return;
    const tag = document.createElement('style'); tag.id = 'mh-home-raid-jack-css'; tag.textContent = HOME_RAID_JACK_CSS; document.head.appendChild(tag);
  }, []);
  React.useEffect(() => {
    let alive = true;
    // 通信が弱くて送れなかった与ダメージが端末に残っていれば、ここで送り直す(空なら通信しない)。本番のイベントだけ
    const flush = async () => { if (eventId !== ev.id) return; try { const id = await ensureBreederId(); await ev.flushPending(id); } catch (e) { /* 次に開いたときに送り直す */ } };
    const load = async () => { await flush(); const t = await sbFetchRaidJackTierTotals(eventId); if (alive) setTotals(t); };
    load();
    const id = setInterval(load, 60000);
    return () => { alive = false; clearInterval(id); };
  }, [eventId]);
  // 吹き出しの置き場所(homeRaidSayPlace)。null のあいだは、これまでどおりジャックの上へ置く
  const wrapRef = React.useRef(null);
  const sayRef = React.useRef(null);
  const [sayPlace, setSayPlace] = React.useState(null);
  const sayInline = !!(sayPlace && sayPlace.width < HOME_RAID_SAY_INLINE_NEXT);
  React.useLayoutEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const place = () => {
      const wrap = wrapRef.current, say = sayRef.current;
      const art = wrap && wrap.querySelector('[data-home-raid-jack] [data-jack-aura], [data-home-raid-jack] [data-home-raid-pumpkin]');
      const img = art && art.querySelector('img.mh-home-raid-jack-img');
      if (!wrap || !say || !art || !img) return;
      // 跳ねている途中の位置ではなく、置かれている位置で測る(img の transform を含まない offset から出す)
      const ar = art.getBoundingClientRect();
      const head = { left: ar.left + img.offsetLeft, top: ar.top + img.offsetTop, right: ar.left + img.offsetLeft + img.offsetWidth, bottom: ar.top + img.offsetTop + img.offsetHeight };
      if (head.right - head.left < 2) return;
      const keep = say.style.width;
      const keepFont = say.style.fontSize;
      const nextInline = say.querySelector('[data-say-next-inline]'), nextRow = say.querySelector('[data-say-next-row]');
      const keepNext = [nextInline && nextInline.style.display, nextRow && nextRow.style.display];
      const measure = (w) => {
        say.style.width = `${w}px`; say.style.fontSize = `${homeRaidSayFont(w)}px`;
        if (nextInline && nextRow) { const inl = w < HOME_RAID_SAY_INLINE_NEXT; nextInline.style.display = inl ? 'block' : 'none'; nextRow.style.display = inl ? 'none' : 'block'; }
        return say.offsetHeight;
      };
      const bandEl = wrap.querySelector('[data-home-raid-jack] [data-home-raid-jack-title]');
      const br = bandEl && bandEl.parentElement.getBoundingClientRect();
      const next = homeRaidSayPlace({ head, band: br ? { left: br.left, top: br.top, right: br.right, bottom: br.bottom } : null, obstacles: homeRaidSayObstacles(wrap), vw: window.innerWidth, vh: window.innerHeight, measure });
      say.style.width = keep; say.style.fontSize = keepFont;
      if (nextInline && nextRow) { nextInline.style.display = keepNext[0]; nextRow.style.display = keepNext[1]; }
      if (!next) return;
      const wr = wrap.getBoundingClientRect();
      const rel = { side: next.side, hidden: !!next.hidden, left: Math.round(next.left - wr.left), top: Math.round(next.top - wr.top), width: next.width,
        tail: Math.round(Math.max(14, Math.min(next.width - 14, (head.left + head.right) / 2 - next.left))) };
      setSayPlace((prev) => (prev && prev.side === rel.side && prev.hidden === rel.hidden && prev.left === rel.left && prev.top === rel.top && prev.width === rel.width && prev.tail === rel.tail ? prev : rel));
    };
    place();
    // ボタンの並び・みゅあの吹き出しの長さは、読み込みやセリフで後から変わる。軽い測り直しをときどき回す
    const timers = [setTimeout(place, 120), setTimeout(place, 700)];
    const id = setInterval(place, 1500);
    window.addEventListener('resize', place);
    window.addEventListener('orientationchange', place);
    // みゅあの吹き出しが伸び縮みしたら測り直す(吹き出しはジャックの吹き出しの障害物になる)
    const mua = document.querySelector('.mh-home-assistant');
    const ro = (mua && typeof ResizeObserver !== 'undefined') ? new ResizeObserver(() => timers.push(setTimeout(place, 60))) : null;
    if (ro) ro.observe(mua);
    return () => { if (ro) ro.disconnect(); timers.forEach(clearTimeout); clearInterval(id); window.removeEventListener('resize', place); window.removeEventListener('orientationchange', place); };
  }, [lineNo, totals]);
  // ときどき両腕ポーズ(約7秒に1回、1.4秒だけ)
  React.useEffect(() => {
    let alive = true; let timer = null;
    const loop = () => { timer = setTimeout(() => { if (!alive) return; setPose(true); timer = setTimeout(() => { if (!alive) return; setPose(false); loop(); }, 1400); }, 5600); };
    loop();
    return () => { alive = false; clearTimeout(timer); };
  }, []);
  // 初めて読み込み中(まだ一度も合計が取れていない)あいだは、段階もライフも分からないので描かない
  if (totals === undefined) return null;
  // いま挑める段階 = まだ共有HPが残っている最初の段階。全部倒していたら「討伐おめでとう」
  const tiers = ev.aTiers;
  const totalOf = (i) => (totals && totals.a && totals.a[i + 1] ? totals.a[i + 1].total : 0);
  // 大王が倒されたか(段階5の合計がライフ以上)で決める。倒されたあとは、小さなぱんぷきんが遊びに来る
  const allDone = ev.bossDown(totals);
  const currentIndex = allDone ? -1 : (totals ? tiers.findIndex((t, i) => totalOf(i) < t.hp) : 0);
  const tier = tiers[Math.max(0, allDone ? tiers.length - 1 : currentIndex)];
  const left = allDone ? 0 : Math.max(0, tier.hp - totalOf(Math.max(0, currentIndex)));
  const rate = tier.hp > 0 ? Math.max(0, Math.min(1, left / tier.hp)) : 0;
  // いま話せるセリフ: 段階(爵位)の話し方 × 残りライフの場面。大王を倒したあとはぱんぷきん(場面なし)
  const speechLines = isJack ? raidJackHomeLines(tier.id, rate, allDone) : [];
  const speech = speechLines.length > 0 ? speechLines[lineNo % speechLines.length] : '';
  const speechAccent = allDone ? '#fdba74' : '#fb923c';
  const tierNo = Number(String(tier.id).slice(1)) || 0;
  // 影と段階・HPの札。本体と、炎の層の見えない枠(高さをそろえるため)の両方で使う
  const shadowEl = <span className="mh-home-raid-jack-shadow" aria-hidden="true" style={{ display:'block', width:'70%', height:'8px', marginTop:'-6px', borderRadius:'50%', background:'#0008', filter:'blur(3px)' }} />;
  const labelEl = (
      <span style={{ display:'block', width:'100%', marginTop:'6px', padding:'3px 6px', borderRadius:'10px', border:'1px solid #fdba74aa', background:'#1c0a02d9', color:'#ffedd5', fontSize:'10px', fontWeight:900, textAlign:'center', lineHeight:1.3 }}>
        {/* 「〜が」のあとだけで折る(2026-10-20 窓口「ジャック大王があらわれ／た！」と言葉の途中で折れていた)。
            keep-all で字の間では折らず、<wbr/> の所だけで折る。それでも入らないときだけ anywhere で折る。
            幅360未満の画面は字を9pxにして1行に収める(2026-10-24 窓口「幅320で『ジャック大王／あらわれた』と折れている」) */}
        <span data-home-raid-jack-title style={{ display:'block', ...JA_WRAP_STYLE, ...(typeof window !== 'undefined' && window.innerWidth < HOME_RAID_SAY_NARROW_VW ? { fontSize:'9px' } : {}) }}>{allDone ? (isJack ? <>{RAID_JACK_PUMPKIN.name}が<wbr/>遊びに来た！</> : <>{ev.afterBoss.name}が<wbr/>{ev.afterBossBadge}</>) : <>{tier.name}が<wbr/>あらわれた！</>}</span>
        {allDone && isJack ? <span data-home-raid-pumpkin-note style={{ display:'block', marginTop:'2px', fontSize:'8px', opacity:.9, ...JA_LABEL_STYLE }}>{jaWrap('ジャックを倒した！遊んでダメージを競おう')}</span> : <>
        <span style={{ display:'block', height:'7px', marginTop:'3px', borderRadius:'999px', overflow:'hidden', background:'#000a', border:'1px solid #fff3' }} role="progressbar" aria-valuemin={0} aria-valuemax={tier.hp} aria-valuenow={left}>
          <span style={{ display:'block', height:'100%', width:`${rate * 100}%`, background:'#f97316' }} />
        </span>
        {totals === null ? <span style={{ display:'block', fontSize:'8px', opacity:.8 }}>準備中</span>
          : totals === undefined ? <span style={{ display:'block', fontSize:'8px', opacity:.8 }}>…</span>
          : <span style={{ display:'block', fontSize:'8px', opacity:.85 }}>共有HP {left.toLocaleString()}</span>}
        </>}
      </span>
  );
  return (
    <>
    {/* 炎(オーラ)の層。施設の札・みゅあの吹き出し・上の帯より後ろ(HOME_RAID_JACK_AURA_WRAP_STYLE)。
        HOMEのジャックは小さいので、オーラは絵より大きな枠へ広げて描く(段階が上がるほど大きく) */}
    {!allDone && ev.aura && <div aria-hidden="true" data-home-raid-aura-wrap style={HOME_RAID_JACK_AURA_WRAP_STYLE}>
      <div style={HOME_RAID_JACK_AURA_BOX_STYLE}>
        <span data-jack-aura={tierNo || undefined} style={{ position:'relative', display:'block', width:'100%', aspectRatio:'1024 / 640' }}>
          <span style={{ position:'absolute', pointerEvents:'none', visibility:'visible', inset:`${-20 - tierNo * 8}% ${-10 - tierNo * 5}% -6%` }}>
            <JackAuraLayer tier={tierNo} />
          </span>
        </span>
        {shadowEl}
        {labelEl}
      </div>
    </div>}
    <div ref={wrapRef} data-home-raid-jack-wrap style={HOME_RAID_JACK_WRAP_STYLE}>
    {/* ひとこと。ジャックの上に出る吹き出し。押すと次のセリフへ(ジャック本体を押すとレイド画面) */}
    {speech && <button type="button" ref={sayRef} key={`say${lineNo}`} data-home-raid-say data-story-pop="1" data-say-side={sayPlace ? sayPlace.side : 'top'} data-say-hidden={sayPlace && sayPlace.hidden ? 'true' : undefined} aria-hidden={sayPlace && sayPlace.hidden ? 'true' : undefined} onClick={() => setLineNo((n) => n + 1)} aria-label="ジャックのひとこと(押すと次のセリフ)"
      style={{ position:'absolute', ...(sayPlace ? { left:sayPlace.left, top:sayPlace.top, width:sayPlace.width } : { left:'50%', bottom:'100%', marginLeft:-92, marginBottom:'4px', width:184 }),
        padding:'6px 10px', borderRadius:'14px', boxSizing:'border-box',
        border:`2px solid ${speechAccent}`, background:'#1c0a02ee', color:'#ffedd5', fontSize:`${homeRaidSayFont(sayPlace ? sayPlace.width : 184)}px`, fontWeight:900, lineHeight:1.45, textAlign:'left', cursor:'pointer',
        boxShadow:`0 0 12px ${speechAccent}66`, animation:'storyPop .25s ease-out both', zIndex:2, pointerEvents:(sayPlace && sayPlace.hidden) ? 'none' : 'auto',
        ...(sayPlace && sayPlace.hidden ? { visibility:'hidden' } : {}) }}>
      {/* 狭い幅(横へ置いたとき)でも「聞こえるの／う」と言葉の途中で折らず、行の長さをならす(2026-10-21) */}
      {/* いちばん狭い120pxのときは「▶ つぎ」を下の枠線の上に乗せ、行を使わない(幅320で、かぼちゃの顔を隠さないため。2026-10-24) */}
      <span data-home-raid-say-text style={{ display:'block', ...JA_LABEL_STYLE }}>{jaWrap(speech)}</span>
      <span aria-hidden="true" data-say-next-inline style={{ display:sayInline ? 'block' : 'none', position:'absolute', right:'10px', bottom:'-6px', padding:'0 4px', borderRadius:'4px', background:'#1c0a02', color:'#ffedd5', fontSize:'8px', lineHeight:'10px', whiteSpace:'nowrap' }}>▶ 次</span>
      <span aria-hidden="true" data-say-next-row style={{ display:sayInline ? 'none' : 'block', textAlign:'right', fontSize:'8px', opacity:.7 }}>▶ 次</span>
      {/* しっぽはジャックのほうへ向ける(上に置いたら下向き、右に置いたら左向き、左に置いたら右向き) */}
      {(!sayPlace || sayPlace.side === 'top') && <span aria-hidden="true" style={{ position:'absolute', left:sayPlace ? sayPlace.tail : '50%', bottom:-9, marginLeft:-8, width:0, height:0, borderLeft:'8px solid transparent', borderRight:'8px solid transparent', borderTop:`9px solid ${speechAccent}` }} />}
    </button>}
    <button type="button" data-home-raid-jack onClick={onOpen} aria-label={allDone ? `${isJack ? RAID_JACK_PUMPKIN.name : ev.afterBoss.name}が遊びに来た！タップでレイド画面を開く` : `${tier.name}があらわれた！タップでレイド画面を開く`} style={HOME_RAID_JACK_BUTTON_STYLE}>
      {/* 通常絵とポーズ絵を重ねて、切り替えは透明度だけで行う(先に両方読み込める・切り替えで枠の高さが変わらない)。
          ポーズ絵は腕が左右に広がるぶん本体が幅の約半分になるので、通常絵を半分の大きさ(RAID_JACK_NORMAL_ART_SCALE)で描いて本体の大きさをそろえる。
          どちらも足もと(本体の下端)をそろえて置く */}
      <span data-jack-aura={allDone ? undefined : (Number(String(tier.id).slice(1)) || undefined)} data-home-raid-pumpkin={allDone ? 'true' : undefined} style={{ position:'relative', display:'block', width:'100%', aspectRatio:'1024 / 640' }}>
        {/* 段階が進むほど派手になるオーラは、施設より後ろの別の層(下の data-home-raid-aura-wrap)で描く */}
        {/* 大王を倒したあとは、小さなぱんぷきんが遊びに来る(オーラ・ポーズ絵なし。跳ねる動きは同じ) */}
        {allDone && isJack ? <img className="mh-home-raid-jack-img" src={PUMPKIN_ICON_IMG} alt="" draggable={false}
          style={{ position:'absolute', left:`${(1 - RAID_JACK_PUMPKIN_ART_SCALE) * 50}%`, bottom:0, width:`${RAID_JACK_PUMPKIN_ART_SCALE * 100}%`, height:'auto', filter:'drop-shadow(0 6px 10px #000a)', pointerEvents:'none' }} />
        : !isJack ? <img className="mh-home-raid-jack-img mh-home-raid-boss-tall" data-home-raid-boss={ev.key} src={allDone ? ev.afterBossImg() : ev.bossImg()} alt="" draggable={false}
          style={{ position:'absolute', left:'50%', bottom:0, height:'135%', width:'auto', transform:'translateX(-50%)', filter:'drop-shadow(0 6px 10px #000a)', pointerEvents:'none' }} /> : <>
        <img className="mh-home-raid-jack-img" src={JACK_IMG} alt="" draggable={false}
          style={{ position:'absolute', left:`${(1 - RAID_JACK_NORMAL_ART_SCALE) * 50}%`, bottom:0, width:`${RAID_JACK_NORMAL_ART_SCALE * 100}%`, height:'auto', opacity:pose ? 0 : 1, filter:`drop-shadow(0 6px 10px #000a) ${raidJackAuraGlowFilter(Number(String(tier.id).slice(1)) || 0, 0.8)}`, pointerEvents:'none' }} />
        <img className="mh-home-raid-jack-img" src={JACK_POSE_IMG} alt="" draggable={false} aria-hidden="true"
          style={{ position:'absolute', left:0, bottom:'-6%', width:'100%', height:'auto', opacity:pose ? 1 : 0, filter:`drop-shadow(0 6px 10px #000a) ${raidJackAuraGlowFilter(Number(String(tier.id).slice(1)) || 0, 0.8)}`, pointerEvents:'none' }} />
        </>}
      </span>
      {shadowEl}
      {labelEl}
    </button>
    </div>
    </>
  );
};
// HOME 右上の枠(ダイヤ・ブリーダーP)を、桁が多いときだけ広げる幅(px)。ふだんの桁数では 0 で、見た目は今のまま。
// 数の字は 10px で1文字およそ 6.4px。枠の中で数に使える幅はダイヤが 50px・ブリーダーP が 29px(幅152pxのとき)なので、
// 足りないぶんだけ最大 24px 広げ、それでも入らないぶんは字を小さくする(70-bootstrap.jsx の --wal-room)。
// tools/home-layout-check.js がこの1行を取り出して同じ計算で測る
// 「億」「兆」のような全角の字は数字より広いので、2.5字ぶんとして数える(N5・2026-10-21)。数字とカンマだけのときは今までと同じ
const homeWalletGrowPx=(goldText,bpText)=>{const w=t=>[...String(t)].reduce((n,c)=>n+(c.charCodeAt(0)>0x7f?2.5:1),0);return Math.min(24,Math.max(0,Math.ceil(w(goldText)*6.4-50),Math.ceil(w(bpText)*6.4-29)));};
function HomeScreen({
  assistantBondUp, friendRequestCount = 0, breederIcon, breederLevel, breederName, breederPoints, gifts, gold,
  hasUnreadChangelog, changelogUnreadCount, homeBackgroundReady, homeArt, homePastureMasumons, masuMons, missions,
  onOpenBattle, onOpenManagement, onOpenMarket, onOpenProfile, onOpenRhythm, onOpenSettings,
  onOpenTemple, openChangelog, openGiftBox, openMissions, profileFrameId, resolveIconUrl, spotClass,
  raidJackVisible = false, raidJackEventId, onOpenRaidJack,
  // クリスマスのイベントページを開く(台帳 r1126-006)。開始時刻までは null(札は今までどおり更新履歴を開く)
  onOpenXmasEvent = null,
  // クリスマスのレイドのボス(ジャックと同じ置き方・押すとイベントページの「レイド」タブ)。出すかどうかは 60-app.jsx が決める
  raidXmasVisible = false, raidXmasEventId = '', onOpenRaidXmas = null,
  // クリスマスのイベントページの入口(台帳 r1126-014)。{ onOpen, preOpen }。null なら出さない(11/28 10:00〜12/31 4:00 に 60-app.jsx が渡す)
  xmasEntry = null,
  // 助手とおしゃべり(2026-10-14)。公開の印 assistantChat が立つまでは null(ボタンを出さない)
  onOpenAssistantChat = null,
  // MFバトルカードの入口(案A・左の列のいちばん下)。公開の印 cardBattle が立ち、公開のお話を見た人だけ(60-app.jsx が決める)
  cardBattleVisible = false, onOpenCardBattle = null, cardBattleTeaser = false, onOpenCardTeaser = null,
  cardTourVisible = false, onOpenCardTour = null,
  // はじめての人の「つぎにやること」(2026-11-11 案4)。{ n:1〜3, title, sub, onTap }。null なら出さない
  nextStep = null,
  // モンヒロサクセス β の札(2026-11-13 社長「HOMEにβの札」)。中身は 56-monhero-success-store.jsx の MonheroSuccessHomeEntry(公開の印が偽なら何も出さない)
  successEntry = null,
}) {
  // 背景の絵は「HOMEの枠の縦横比」で選ぶ。画面の向きでは決めない。
  // パソコンは画面が横長でも、HOMEは幅600の縦長の列に収まるので、横長の絵を出すと村の真ん中だけが大きく写り、
  // 施設ボタンが建物と合わなくなる。枠の大きさは自前で回しているとき(横持ちの描き方)も回す前の値なので、そのまま使える
  // 形の境目(2026-11-17・正方形の絵を追加して3方向に): 比が 3/4 未満は縦長、3/4〜1.2 はほぼ正方形、1.2 を超えたら横長。
  // 下の境目 3/4 は、タイトル絵の「ほぼ正方形」の帯(3:4〜。70-bootstrap.jsx)の下端と、ホームの3枚の比
  // (縦 941/1672・正方形 1600/1600・横 2048/1152)の相乗平均 0.75 に一致する。タブレット縦(768x1024=0.75)は正方形になる。
  // 上の境目は、横長の判定として使ってきた 1.2 をそのまま使う(タブレット横 1024x768=1.33 は横長になる)
  // 助手ライフの「いま行くと得なこと」から施設へ行く口(HOME の札と同じ動き。助手ライフ側が呼ぶ)
  React.useEffect(()=>{ if(typeof ASSISTANT_LIFE_LINKS!=='undefined'&&ASSISTANT_LIFE_LINKS) ASSISTANT_LIFE_LINKS.goPlace={ranch:onOpenManagement,temple:onOpenTemple,market:onOpenMarket,battle:onOpenBattle}; });
  const homeSceneRef=React.useRef(null);
  const [homeSceneShape,setHomeSceneShape]=React.useState('portrait');
  React.useEffect(()=>{
    const el=homeSceneRef.current;
    if(!el)return undefined;
    const measure=()=>{const w=el.clientWidth,h=el.clientHeight;if(w>0&&h>0){const r=w/h;setHomeSceneShape(r>1.2?'wide':r>=0.75?'square':'portrait');}};
    measure();
    if(typeof ResizeObserver==='undefined'){window.addEventListener('resize',measure);return()=>window.removeEventListener('resize',measure);}
    const ro=new ResizeObserver(measure);ro.observe(el);return()=>ro.disconnect();
  },[]);
  // 【2026-11-17 ホーム一新で撤去】吹き出しが伸びたら施設の札を押し下げる測定機構(--mh-home-* の CSS変数6つ)。
  //   施設は下のドックに集約され、吹き出しは上の帯・細バナーの下に流れで置くようになったので、押し下げ合いは起きない。
  //   ジャックの吹き出しの測り直しは HomeRaidJack 自身の ResizeObserver(吹き出しを見る)+1.5秒間隔が受け持つ
  const homeBackgroundSrc=homeArtSrc(homeArt,homeSceneShape);
  const homeBackgroundWide=homeArtIsWide(homeArt,homeSceneShape);
  const homeBackgroundSquare=homeArtIsSquare(homeArt,homeSceneShape);
  // ★バッジのCSSは <head> へ1回だけ入れる。HOMEのDOMへ <style> を混ぜると、
  //   配置の検査(home-layout-check.js)が施設の位置を測るときに数がずれる。
  //   head なら画面の中身に影響しない。
  React.useEffect(()=>{
    if(typeof document==='undefined')return;
    if(document.getElementById('mh-home-event-badge-css'))return;
    const tag=document.createElement('style');
    tag.id='mh-home-event-badge-css';
    tag.textContent=HOME_EVENT_BADGE_CSS;
    document.head.appendChild(tag);
  },[]);
  // 作り直した HOME の見た目(HOME_V2_CSS)も同じく <head> へ1回だけ
  React.useEffect(()=>{
    if(typeof document==='undefined'||document.getElementById('mh-home-v2-css'))return;
    const tag=document.createElement('style');
    tag.id='mh-home-v2-css';
    tag.textContent=HOME_V2_CSS;
    document.head.appendChild(tag);
  },[]);
  // 開催中のキャンペーンのうち、HOMEの札・バナー(banner)を持つもの(ハロウィン・ナイト)。描くたびに数え直す
  const homeEventCampaign=(()=>{
    if(typeof RELEASE_FLAGS==='undefined'||!RELEASE_FLAGS||RELEASE_FLAGS.rhythmEventPoints!==true||typeof rhythmEventPointCampaignAt!=='function')return null;
    const campaign=rhythmEventPointCampaignAt(Date.now());
    return campaign&&campaign.banner?campaign:null;
  })();
  // 公式杯の札(2026-10-31 社長・案A。中身は 99-card-tournament の cardTourHomeBanner)。
  //   一覧は HOME を開いたときと10分ごとに読む。残り時間は1分ごとに数え直す。読めない・大会が無いときは出さない
  const [cardTourList,setCardTourList]=React.useState(null);
  const [cardTourNow,setCardTourNow]=React.useState(()=>Date.now());
  React.useEffect(()=>{
    if(!cardTourVisible||typeof cardTourFetchList!=='function')return undefined;
    let alive=true;
    const load=()=>{cardTourFetchList().then(l=>{if(alive)setCardTourList(Array.isArray(l)?l:null);}).catch(()=>{});};
    load();
    let ticks=0;
    const id=setInterval(()=>{ticks+=1;setCardTourNow(Date.now());if(ticks%10===0)load();},60000);
    return ()=>{alive=false;clearInterval(id);};
  },[cardTourVisible]);
  const homeCardTour=cardTourVisible&&typeof cardTourHomeBanner==='function'?cardTourHomeBanner(cardTourList,cardTourNow):null;
  // モンヒロビートのイベントを開催しているか。描くたびに数え直す(上の★のとおり)
  const homeRhythmEventOpen=(()=>{
    const released=(typeof RELEASE_FLAGS!=='undefined'&&RELEASE_FLAGS&&RELEASE_FLAGS.rhythmWeeklyRanking===true);
    if(!released||typeof rhythmLimitedEventAt!=='function')return false;
    return !!rhythmLimitedEventAt(Date.now());
  })();
  // 期間ものの細バナー(2026-11-17 ホーム一新): イベントと公式杯を上の帯の下の1本に集約する。
  // 両方あるときはカルーセル(5秒ごとに切替・手で切り替える操作は付けない。バナー自体が行き先ボタンのため)
  // 【2026-11-27 HOME の作り直し(台帳 r1126-073・案A＋Bの入口)】上はイベントの帯1枚だけ。2つ目からは帯を横に送る(指で送る・点を押す・
  //   帯の下の「次:」を押す)。手で触らなければ7秒ごとに次へ進み、触ったら20秒は止める。
  //   並び: クリスマスの入口(r1126-014 の大きな帯)→ ほかの開催中のイベント → 公式杯。クリスマスの入口があるときは、同じ中身の「クリスマスイベント」の帯は出さない
  //   ただしクリスマスがまだ予告(序章だけ)のあいだは、いま遊べるイベントを1枚目にする(API の点検 7・予告より開催中を先に)
  const homeBandSlides=[];
  const homeBandEvent=homeEventCampaign&&!(xmasEntry&&homeEventCampaign.id==='xmas_2026');
  if(homeBandEvent&&xmasEntry&&xmasEntry.preOpen)homeBandSlides.push('event');
  if(xmasEntry)homeBandSlides.push('xmas');
  if(homeBandEvent&&!homeBandSlides.includes('event'))homeBandSlides.push('event');
  if(homeCardTour&&typeof onOpenCardTour==='function')homeBandSlides.push('tour');
  const homeBandCount=homeBandSlides.length;
  const [homeBandIdx,setHomeBandIdx]=React.useState(0);
  const homeBandTouchRef=React.useRef({x:null,at:0,swiped:false});
  React.useEffect(()=>{
    if(homeBandCount<2)return undefined;
    const id=setInterval(()=>{if(Date.now()-homeBandTouchRef.current.at>=20000)setHomeBandIdx(i=>i+1);},7000);
    return ()=>clearInterval(id);
  },[homeBandCount]);
  const homeBandShow=homeBandCount?((homeBandIdx%homeBandCount)+homeBandCount)%homeBandCount:0;
  const homeBandGo=(step)=>{homeBandTouchRef.current.at=Date.now();setHomeBandIdx(i=>i+step);};
  const homeBandTitle=(k)=>k==='xmas'?'聖夜の名探偵':k==='event'&&homeEventCampaign?homeEventCampaign.banner.title:k==='tour'&&homeCardTour?homeCardTour.name:'';
  // メニュー☰(案A)。右の列(時計・更新履歴・ミッション・ギフト)と設定・ブリーダーP をここへまとめる。赤い数字は合計
  //   ボタンはいつも描いておき(閉じているときは見えないだけ)、案内(チュートリアル)がミッション・ギフト・設定を指すときは開いておく
  const [homeMenuOpen,setHomeMenuOpen]=React.useState(false);
  const homeMissionCount=missionClaimableCount(normalizeMissions(missions));
  const homeGiftCount=giftClaimableCount(gifts);
  // 更新履歴は未読の数(r1126-074 小5)。数が分からないときだけ1と数える
  const homeChangelogCount=Number(changelogUnreadCount)||0;
  const homeMenuBadge=homeMissionCount+homeGiftCount+(hasUnreadChangelog?Math.max(1,homeChangelogCount):0);
  const homeMenuSpot=`${spotClass('reward')||''}${spotClass('settings')||''}`.trim();
  React.useEffect(()=>{if(homeMenuSpot)setHomeMenuOpen(true);},[homeMenuSpot]);
  const homeMenuGo=(fn)=>()=>{setHomeMenuOpen(false);if(typeof fn==='function')fn();};
  // HOMEの助手コメントを出すか(2026-11-17 あっくん「助手のコメントのオンオフ」)。設定は 21-assistant.jsx の
  // HOME_ASSISTANT_COMMENT_STORE(既定は入)。「切」のときは吹き出しの枠ごと描かず、そのぶん広場が広くなる
  const homeComment=useHomeAssistantComment();
  return (

      <main ref={homeSceneRef} className="mh-home-scene mh-home-v2" aria-label="村の広場">
        {/* 背景は設定の「ホーム画面アレンジ」で選んだ絵。HOMEの枠の形に合った絵を画面いっぱいに出す(横長は is-wide、正方形は is-square) */}
        <picture className={`mh-home-background ${homeBackgroundReady?'is-ready':''} ${homeBackgroundWide?'is-wide':''} ${homeBackgroundSquare?'is-square':''}`} aria-hidden="true"><img className="mh-home-backdrop" src={homeBackgroundSrc} alt=""/><img className="mh-home-main" src={homeBackgroundSrc} alt=""/></picture>
        <div className="mh-home-masumon-layer" aria-hidden="true">{homePastureMasumons.map((masu,index)=><HomeWalkingMasumon key={masu.id} masu={masu} base={ALL_PLAYER_MONSTERS[masu.baseId]} masuColors={getMasuColors(masu)} index={index} count={homePastureMasumons.length}/>)}</div>
        {/* 設定を光らせるときは、上の帯ごと暗幕より前に出す(帯が z-index を持っていて中だけ前に出せないため) */}
        {raidXmasVisible&&typeof onOpenRaidXmas==='function'?<HomeRaidJack key="raid-xmas" ev={RAID_EVENT_XMAS} eventId={raidXmasEventId} onOpen={onOpenRaidXmas}/>
          :raidJackVisible&&<HomeRaidJack eventId={raidJackEventId} onOpen={onOpenRaidJack}/>}
        {/* 上の1段(2026-11-27 r1126-073 案A): 名前と Lv・ダイヤ・メニュー☰ だけ。XP の棒はプロフィールで、ブリーダーP はメニューの中で見せる */}
        <header className={`mh-home-status mh-home-top${spotClass('settings')}`}>
          <button type="button" className="mh-home-player relative" onClick={onOpenProfile} aria-label="プロフィールを開く">
            <HomeProfileIcon src={resolveIconUrl(breederIcon)} id={breederIcon} frameId={profileFrameId}/>
            <div className="mh-home-player-copy"><strong>{breederName}</strong><span>Lv.{breederLevel.level}</span></div>
            {Number(friendRequestCount)>0&&<span data-home-friend-badge aria-label={`フレンド申請が${Number(friendRequestCount)}件届いています`} className="absolute -right-1 -top-2 flex h-6 min-w-[24px] items-center justify-center rounded-full bg-rose-500 px-1.5 text-[12px] font-black text-white shadow-lg">{Math.min(99,Number(friendRequestCount))}</span>}
          </button>
          {/* ダイヤは桁が増えても1行のまま。9桁(1億)からは「67.3億」のように縮めて出し、押すと細かい数が出る(CompactCount・N5) */}
          <section className="mh-home-wallet mh-home-top-wallet" aria-label="ダイヤ">
            <div><Gem size={15}/><CompactCount value={gold} style={{'--len':String(compactCount(gold)).length}}/><small>ダイヤ</small></div>
          </section>
          <button type="button" className={`mh-home-menu-btn${homeMenuOpen?' is-open':''}`} data-home-menu-btn onClick={()=>setHomeMenuOpen(o=>!o)} aria-label={homeMenuBadge>0?`メニュー(${homeMenuBadge}件)`:'メニュー'} aria-expanded={homeMenuOpen}>
            <span className="mh-home-menu-bars" aria-hidden="true"><i/><i/><i/></span><span className="mh-home-menu-lb">メニュー</span>
            {homeMenuBadge>0&&<em data-home-menu-badge>{Math.min(99,homeMenuBadge)}</em>}
          </button>
        </header>
        {/* メニューの中身。閉じているときも描いておく(見えないだけ)。外を押すと閉じる */}
        {homeMenuOpen&&<button type="button" className="mh-home-menu-shade" data-home-menu-shade aria-label="メニューを閉じる" onClick={()=>setHomeMenuOpen(false)}/>}
        <div className={`mh-home-menu${homeMenuOpen?' is-open':''}`} data-home-menu={homeMenuOpen?'open':'closed'}>
          <div className="mh-home-menu-info">
            {typeof TimeOfDayClock==='function'&&<TimeOfDayClock home/>}
            <span className="mh-home-menu-bp"><Coins size={14}/><small>ブリーダーP</small><CompactCount value={breederPoints}/></span>
          </div>
          <button onClick={homeMenuGo(openMissions)} className={`mh-home-side-btn mh-home-mission${spotClass('reward')}`} aria-label="ミッション"><span className="mh-home-side-ic"><List size={18}/></span><span className="mh-home-side-lb">ミッション</span>
            {homeMissionCount>0&&<em>{homeMissionCount}</em>}
          </button>
          <button onClick={homeMenuGo(openGiftBox)} className={`mh-home-side-btn mh-home-gift${spotClass('reward')}`} aria-label="ギフト"><span className="mh-home-side-ic"><Package size={18}/></span><span className="mh-home-side-lb">ギフト</span>
            {homeGiftCount>0&&<em>{homeGiftCount}</em>}
          </button>
          <button onClick={homeMenuGo(openChangelog)} className="mh-home-side-btn mh-home-update" aria-label="更新履歴"><span className="mh-home-side-ic"><RefreshCcw size={17}/></span><span className="mh-home-side-lb">更新履歴</span>{hasUnreadChangelog&&(homeChangelogCount>0
            // 「!」ではなく未読の数(2026-11-27 r1126-074 小5)。メニューの行は横に長いので、2桁でもそのまま出せる
            ?<em className="mh-unread-badge" data-changelog-entry-count={homeChangelogCount} aria-label={`未読${homeChangelogCount}件`}>{homeChangelogCount>99?'99+':homeChangelogCount}</em>
            :<em className="mh-unread-badge" aria-label="未読あり">!</em>)}</button>
          <button onClick={homeMenuGo(onOpenSettings)} className={`mh-home-side-btn mh-home-settings${spotClass('settings')}`} aria-label="設定"><span className="mh-home-side-ic"><Settings size={18}/></span><span className="mh-home-side-lb">設定</span></button>
        </div>
        {/* イベントの帯1枚(案A)。2つ目からは横に送る。並びと送り方は上の homeBandSlides */}
        {homeBandCount>0&&<div className="mh-home-band" data-home-band={homeBandSlides[homeBandShow]}
          onPointerDown={e=>{homeBandTouchRef.current={...homeBandTouchRef.current,x:e.clientX,swiped:false};}}
          onPointerUp={e=>{const t=homeBandTouchRef.current;if(t.x===null||homeBandCount<2)return;const dx=e.clientX-t.x;t.x=null;if(Math.abs(dx)>=40){t.swiped=true;homeBandGo(dx<0?1:-1);}}}
          onClickCapture={e=>{if(homeBandTouchRef.current.swiped){homeBandTouchRef.current.swiped=false;e.stopPropagation();e.preventDefault();}}}>
          <div className="mh-home-band-view">
            <div className="mh-home-band-track" style={{transform:`translateX(${-homeBandShow*100}%)`}}>
              {homeBandSlides.map((k,i)=>(
                <div key={k} className="mh-home-band-slide" aria-hidden={i!==homeBandShow} {...(k==='xmas'?{'data-home-xmas-entry-strip':''}:{'data-home-event-strip':''})}>
                  {k==='xmas'&&<HomeXmasEventEntry onOpen={xmasEntry.onOpen} preOpen={!!xmasEntry.preOpen}/>}
                  {/* 押すとモンヒロビートへ直に入る(2026-11-27 台帳 r1126-073 追記2・入口の整理①。前は更新履歴が開いた) */}
                  {k==='event'&&<button type="button" data-home-event-banner className="mh-home-event-banner" tabIndex={i===homeBandShow?0:-1} onClick={homeEventCampaign.id==='xmas_2026'&&typeof onOpenXmasEvent==='function'?onOpenXmasEvent:onOpenRhythm} aria-label={`${homeEventCampaign.banner.title}${homeEventCampaign.banner.title2||''} ${homeEventCampaign.banner.sub}`}>
                    {/* 1行目に題と期間(sub)、2行目に副題(title2)(r1119-131) */}
                    <b className="r1"><span>{homeEventCampaign.banner.emoji} {homeEventCampaign.banner.title}</span><small>{homeEventCampaign.banner.sub}</small></b>{homeEventCampaign.banner.title2?<span className="t2">{homeEventCampaign.banner.title2}</span>:null}
                  </button>}
                  {k==='tour'&&<button type="button" data-home-card-tour={homeCardTour.id} className="mh-home-tour-banner" tabIndex={i===homeBandShow?0:-1} onClick={()=>onOpenCardTour(homeCardTour.id)} aria-label={`${homeCardTour.name} ${homeCardTour.sub}`}>
                    <span aria-hidden="true">🏆</span><span><b>{homeCardTour.name}</b><small>{homeCardTour.sub}{homeCardTour.prize&&<em>{homeCardTour.prize}</em>}</small></span>
                  </button>}
                </div>))}
            </div>
          </div>
          {homeBandCount>1&&<div className="mh-home-band-nav">
            <span className="mh-home-event-strip-dots">{homeBandSlides.map((k,i)=><button key={k} type="button" className={i===homeBandShow?'on':''} aria-label={`${i+1}枚目を見る`} onClick={()=>homeBandGo(i-homeBandShow)}><i/></button>)}</span>
            <button type="button" className="mh-home-band-next" data-home-band-next onClick={()=>homeBandGo(1)}>次:{homeBandTitle(homeBandSlides[(homeBandShow+1)%homeBandCount])} ›</button>
          </div>}
        </div>}
        {/* 下部の統一ドック(2026-11-17 ホーム一新): 上から「次にやること」→施設カード×8(ふつうは4列×2段、広い場面と横画面では8枚1列。70-bootstrap.jsx)。
            施設ごとに担当の助手が分かれているので、8つとも同じ大きさ・同じ形の正方形カードにそろえた(2026-11-17 あっくん追加指示)。
            施設名は当初ホームだけ略称にしたが、統一カードの実画面を見て「フルネームでもおかしくない」とあっくんが判断し、
            ホームでもフルネームに戻した(2026-11-17 あっくん追加指示)。名前の字の大きさは最長の「モンヒロサクセス」が
            1行に収まるよう全施設一律に決めてある(70-bootstrap.jsx の .mh-home-dock-name)。助手の顔バッジは AssistantLifeHomeFaces が
            data-home-fac のボタンの右上へ重ねる(56-assistant-life-house.jsx) */}
        <div className="mh-home-dock">
          {nextStep&&<button type="button" className="mh-home-nextstep" data-home-next-step={nextStep.n} onClick={nextStep.onTap} aria-label={`次にやること ${nextStep.n}/3 ${nextStep.title}`}>
            <span className="mh-home-nextstep-lab">次に<br/>やること<b>{nextStep.n}/3</b></span>
            <span className="mh-home-nextstep-body"><b>{['①','②','③'][nextStep.n-1]} {nextStep.title}</b><small>{nextStep.sub}</small></span>
            <i aria-hidden="true">›</i>
          </button>}
          <div className="mh-home-dock-row mh-home-dock-top" aria-label="遊ぶ">
            {/* モンヒロサクセス β の入口(2026-11-13 社長)。中身は 56-monhero-success-store.jsx の MonheroSuccessHomeEntry で、
                ドック上段の先頭のセルとして流れる(公開の印が偽なら何も出さず、残りのカードで割り直す) */}
            {successEntry}
            {/* 2026-09-20 ユーザー指示で正式名称を「モンヒロバトル」にした。下の言葉は「挑戦」(2026-11-17 あっくん決定)。
                ホームの名前も正式名称のまま(略称「モンバト」は 2026-11-17 の一新で一時使ったが、同日のあっくん追加指示でフルネームへ戻した) */}
            <button type="button" data-home-fac="battle" className={`mh-home-dock-card battle${spotClass('battle')}`} onClick={onOpenBattle} aria-label="モンヒロバトル">
              <span className="mh-home-dock-pic"><img src="images/home/facility-battle.webp" alt="" draggable={false}/></span>
              <span className="mh-home-dock-txt"><span className="mh-home-dock-name">モンヒロバトル</span><span className="mh-home-dock-sub">挑戦</span></span>
            </button>
            {/* モンヒロビート(2026-09-03に修行の場所を譲った。2026-09-04に正式名称を「モンスタービート」から「モンヒロビート」へ変更)。
                公開フラグが立つまでは「準備中」の案内だけを出し、本編からは遊べない */}
            {/* ★イベント開催中は、その遊びのボタンに札を出す(2026-09-11・ユーザー指示)。いまのイベントはモンヒロビートの曲だけを対象にするので、札もここだけ。
                ★期間の判定は描くたびに行う(読み込み時に1回だけ決めると、開きっぱなしの端末で古いままになる・CLAUDE.md ⑥-4) */}
            <button type="button" data-home-fac="rhythm" className="mh-home-dock-card rhythm" onClick={onOpenRhythm} aria-label={RHYTHM_MODE_PUBLIC_RELEASE?"モンヒロビート":"モンヒロビート（準備中）"}>
              <span className="mh-home-dock-pic"><img src="images/home/facility-beat.webp" alt="" draggable={false}/></span>
              <span className="mh-home-dock-txt"><span className="mh-home-dock-name">モンヒロビート{!RHYTHM_MODE_PUBLIC_RELEASE&&<small className="mh-home-dock-soon">準備中</small>}</span><span className="mh-home-dock-sub">音ゲー</span></span>
              {homeRhythmEventOpen&&<em data-home-event-badge className="mh-home-event-badge" style={HOME_EVENT_BADGE_STYLE}>開催中</em>}
            </button>
            {/* MFバトルカード(公開の印 cardBattle が立ち、公開のお話を見た人だけ。60-app.jsx が決める) */}
            {cardBattleVisible&&typeof onOpenCardBattle==='function'&&<button type="button" data-home-fac="card" data-home-card-battle className="mh-home-dock-card card" onClick={onOpenCardBattle} aria-label="MFバトルカード">
              <span className="mh-home-dock-pic"><img src="images/home/facility-card.webp" alt="" draggable={false}/></span>
              <span className="mh-home-dock-txt"><span className="mh-home-dock-name">MFバトルカード</span><span className="mh-home-dock-sub">カード対戦</span></span>
            </button>}
            {/* 公開前の予告(社長 2026-10-25)。カード自体に「近日公開」を付け、押すと予告の小窓。中には入れない。
                公開の印(RELEASE_FLAGS.cardBattle)を立てると、60-app がこちらを下ろして上のふつうの入口に切り替える */}
            {!cardBattleVisible&&cardBattleTeaser&&typeof onOpenCardTeaser==='function'&&<button type="button" data-home-fac="card" data-home-card-battle-teaser className="mh-home-dock-card card soon" onClick={onOpenCardTeaser} aria-label="MFバトルカード 近日公開">
              <span className="mh-home-dock-pic"><img src="images/home/facility-card.webp" alt="" draggable={false}/></span>
              <span className="mh-home-dock-txt"><span className="mh-home-dock-name">MFバトルカード</span><span className="mh-home-dock-sub">カード対戦</span></span>
              <em data-home-soon-badge style={HOME_EVENT_BADGE_STYLE}>近日公開</em>
            </button>}
          </div>
          {/* 下段の4施設は「下の言葉」が無い。縦位置の受け方は全カード共通で、絵は上端そろえ、
              名前は文字の枠(.mh-home-dock-txt。「名前1行+間+下の言葉1行」ぶんの固定の高さ)の中で
              縦に中央寄せする(70-bootstrap.jsx)。下の言葉が無い施設は名前1行だけが枠の縦中央に来る
              (2026-11-17 あっくん追加指示。センター合わせの対象はカード全体ではなく文字の枠部分) */}
          <nav className="mh-home-dock-row mh-home-dock-bottom" aria-label="拠点施設">
            <button type="button" data-home-fac="management" className={`mh-home-dock-card management${spotClass('management')}`} onClick={onOpenManagement} aria-label="M/B管理">
              <span className="mh-home-dock-pic"><img src="images/home/facility-management.webp" alt="" draggable={false}/></span><span className="mh-home-dock-txt"><span className="mh-home-dock-name">M/B管理</span></span>
            </button>
            <button type="button" data-home-fac="temple" className={`mh-home-dock-card temple${spotClass('temple')}`} onClick={onOpenTemple} aria-label="神殿">
              <span className="mh-home-dock-pic"><img src="images/home/facility-temple.webp" alt="" draggable={false}/></span><span className="mh-home-dock-txt"><span className="mh-home-dock-name">神殿</span></span>
            </button>
            <button type="button" data-home-fac="market" className={`mh-home-dock-card market${spotClass('market')}`} onClick={onOpenMarket} aria-label="マーケット">
              <span className="mh-home-dock-pic"><img src="images/home/facility-market.webp" alt="" draggable={false}/></span><span className="mh-home-dock-txt"><span className="mh-home-dock-name">マーケット</span></span>
            </button>
            {/* 助手ライフ(2026-11-07 社長)。家と町にいる助手の顔は、このボタンの右上のバッジに集まる(56-assistant-life-house.jsx の AssistantLifeHomeFaces) */}
            {typeof assistantLifeEnabled==='function'&&assistantLifeEnabled()&&<button type="button" data-home-fac="life" data-home-assistant-life className="mh-home-dock-card life" onClick={()=>assistantLifeOpenScreen()} aria-label="助手ライフ">
              <span className="mh-home-dock-pic"><img src="images/home/facility-life.webp" alt="" draggable={false}/></span><span className="mh-home-dock-txt"><span className="mh-home-dock-name">助手ライフ</span></span>
            </button>}
          </nav>
        </div>

        {/* 仲良し度が上がった直後だけ、みゅあがそのことに触れる(HOMEを離れると元に戻る)。
            設定「ホームの助手コメント」が「切」のときは、この枠ごと出さない(2026-11-17 あっくん) */}
        {homeComment.on&&<div className={`mh-home-assistant${spotClass('assistant')}`}><AssistantBubble scene="home" condition={assistantBondUp?'bondUp':(masuMons.length===0?'firstRun':null)} compact menu={typeof onOpenAssistantChat==='function'?[{ key:'chat', label:'💬 おしゃべりする', onClick:onOpenAssistantChat, attr:{ 'data-home-assistant-chat':'' } }]:null}/>
          {/* 「💬 おしゃべり」は吹き出しの中に重ねず、吹き出しを押したときのメニューに入れた(押し所が2つで違いが分からなかった。r1119-050 窓-36) */}
          <HomeAssistantCommentToggle on/>
          <HomePeerTalkMark/>
        </div>}
        {/* 「切」のときも、HOME から1押しで吹き出しを戻せる小さな顔のボタンを残す(r1119-081 社長「ホームの助手のオンオフはホーム上で出し入れできるようにして」) */}
        {!homeComment.on&&<div className={`mh-home-assistant-fold${spotClass('assistant')}`}><HomeAssistantCommentToggle on={false} news={!!assistantBondUp||masuMons.length===0}/></div>}
      </main>
    
  );
}

// HOMEの助手コメント(吹き出し)を HOME の上で出し入れする押し所(r1119-081)。
//   値は設定「ホームの助手コメント」と同じ HOME_ASSISTANT_COMMENT_STORE(保存キー mh_home_assistant_comment_v1)。
//   どちらで変えても同じになる。新しい保存キーは作らない(CLAUDE.md ⑦)
//   入 … 顔の下に小さな「隠す」 / 切 … 助手の顔の丸いボタン(押す所 44px)。押すと吹き出しが戻る
// 助手どうしの掛け合いが HOME で待っているか(56-assistant-peer.jsx の ASSISTANT_PEER_STORE.state.homeWaiting)。押したら窓を開く口も返す
const useHomePeerWaiting = () => {
  const has = typeof ASSISTANT_PEER_STORE !== 'undefined' && typeof useAssistantPeerState === 'function';
  const st = has ? useAssistantPeerState() : null;
  return { waiting: !!(st && st.homeWaiting), open: () => { if (has) ASSISTANT_PEER_STORE.set({ homeOpenAt: Date.now() }); } };
};
// 吹き出しを出しているときの、掛け合いの印(顔の丸の下の「隠す」の横)。待っている掛け合いが無ければ出さない
function HomePeerTalkMark() {
  const peer = useHomePeerWaiting();
  if (!peer.waiting) return null;
  return (
    <button type="button" data-home-peer-talk-mark onClick={peer.open} aria-label="助手どうしの会話を見る" className="mh-home-peer-mark active:scale-95">💬</button>
  );
}
// news … 新しい一言があるとき(仲良し度が上がった直後・はじめて)だけ、顔の丸に赤い点を付ける(すぐできる直し2)
function HomeAssistantCommentToggle({ on, news = false }) {
  const peer = useHomePeerWaiting();
  const bond = useAssistantBond();
  const who = assistantById(assistantSceneById('home')?.assistantId || bond.assistantId || null);
  const color = who.accent || ASSISTANT_FALLBACK.accent;
  if (on) {
    return (
      <button type="button" data-home-assistant-toggle="hide" onClick={() => HOME_ASSISTANT_COMMENT_STORE.setOn(false)}
        aria-label={`${who.name}のコメントを隠す`} className="mh-home-assistant-hide active:scale-95">
        <span style={{ borderColor: color, color }}>隠す</span>
      </button>
    );
  }
  return (
    // 掛け合いが待っているときは、押すと掛け合いの窓を開く(吹き出しは畳んだまま)。待っていなければ吹き出しを出す
    <button type="button" data-home-assistant-toggle="show" data-home-peer-waiting={peer.waiting ? '1' : undefined} onClick={() => (peer.waiting ? peer.open() : HOME_ASSISTANT_COMMENT_STORE.setOn(true))}
      aria-label={peer.waiting ? '助手どうしの会話を見る' : `${who.name}のコメントを出す`} className="mh-home-assistant-show active:scale-95">
      <AssistantFace who={who} size={40} accent={color}/>
      {peer.waiting ? <span className="mh-home-assistant-show-mark" data-home-peer-talk-mark style={{ borderColor: color }} aria-hidden="true">💬</span>
        : news ? <span className="mh-home-assistant-news-dot" data-home-assistant-news aria-hidden="true"/> : null}
    </button>
  );
}

function KikiIntroOverlay({
  kikiIntroStep, markKikiIntroSeen, setKikiIntroStep,
}) {

    const script=(typeof ASSISTANT_KIKI_INTRO!=='undefined'&&ASSISTANT_KIKI_INTRO)||[];
    if(script.length===0) return null;
    const step=Math.max(0,Math.min(kikiIntroStep,script.length-1));
    const line=script[step];
    const speaker=assistantById(line.who);
    const last=step===script.length-1;
    // 顔を並べるのは、この台本に出てくる助手だけ。
    // 全員を並べると、まだ登場していない助手までここに映ってしまう
    const cast=ASSISTANT_LIST.filter(who=>script.some(l=>l.who===who.id));
    const next=()=>{ if(last) markKikiIntroSeen(); else setKikiIntroStep(step+1); };
    return(
    <div className="fixed inset-0 flex items-end justify-center" style={{position:'fixed',inset:0,zIndex:77000,backgroundColor:'rgba(2,6,23,.95)'}} role="dialog" aria-modal="true" aria-label="ききが助手に加わりました">
      {/* どこを押しても次へ進む。最後の1回で見たことにする */}
      <button type="button" onClick={next} aria-label="次へ" className="absolute inset-0 w-full h-full" style={{background:'transparent'}}/>
      <div className="relative w-full max-w-md max-h-[calc(var(--mh-vh)-env(safe-area-inset-top))] overflow-y-auto mh-scroll rounded-t-3xl border-t-2 border-x-2 border-pink-400 bg-slate-950 p-4" style={{paddingBottom:'calc(1rem + env(safe-area-inset-bottom))',pointerEvents:'none'}}>
        <p className="mb-2 text-center text-[10px] font-black tracking-widest text-pink-300">新しい助手</p>
        {/* 2人を並べて出し、いま話しているほうを明るくする */}
        <div className="mb-3 flex items-end justify-center gap-3">
          {cast.map(who=>{
            const talking=who.id===line.who;
            return(
              <div key={who.id} className={`flex flex-col items-center gap-1 ${talking?'':'opacity-35'}`} style={{transform:talking?'scale(1)':'scale(.86)',transition:'opacity .18s, transform .18s'}}>
                <AssistantFace who={who} size={talking?84:64} accent={who.accent} expression={talking?line.e:'normal'}/>
                <span className="text-[9px] font-black" style={{color:talking?who.accent:'#64748b'}}>{who.name}</span>
              </div>
            );
          })}
        </div>
        <div className="rounded-2xl border-2 bg-slate-900 px-3 py-3" style={{borderColor:speaker.accent}}>
          <span className="block text-[9px] font-black tracking-widest" style={{color:speaker.accent}}>{speaker.name}</span>
          <span className="block text-[13px] font-bold leading-relaxed text-white mt-1" style={bubbleWrapStyle()}>{bubbleWrap(line.t)}</span>
        </div>
        <p className="mt-2 text-center text-[11px] font-bold tabular-nums text-slate-300">
          {step+1} / {script.length}
        </p>
        {/* スキップ(2026-10-10・改善部の提案K2「あたらしい助手の紹介が10ページでスキップが無い」とユーザー指示)。
            飛ばしても、最後まで見たときと同じ markKikiIntroSeen を通る(見たことになり、次の起動で出ない。回想からいつでも見直せる) */}
        <div className={`relative mt-3 grid ${last?'grid-cols-1':'grid-cols-[1fr_2fr]'} gap-2`} style={{pointerEvents:'auto'}}>
          {!last&&<button type="button" onClick={(e)=>{e.stopPropagation();markKikiIntroSeen();}} className="min-h-[50px] rounded-2xl bg-slate-700 text-sm font-black text-white active:scale-[.98]">スキップ</button>}
          <button type="button" onClick={(e)=>{e.stopPropagation();next();}} className="min-h-[50px] rounded-2xl bg-pink-500 text-sm font-black text-slate-950 active:scale-[.98]">{last?'閉じる':'次へ'}</button>
        </div>
      </div>
    </div>);
  
}

function MomosukeIntroOverlay({
  markMomosukeIntroSeen, momosukeIntroStep, setMomosukeIntroStep,
}) {

    const script=(typeof ASSISTANT_MOMOSUKE_INTRO!=='undefined'&&ASSISTANT_MOMOSUKE_INTRO)||[];
    if(script.length===0) return null;
    const step=Math.max(0,Math.min(momosukeIntroStep,script.length-1));
    const line=script[step];
    const speaker=assistantById(line.who);
    const last=step===script.length-1;
    const cast=ASSISTANT_LIST.filter(who=>script.some(l=>l.who===who.id));
    const next=()=>{ if(last) markMomosukeIntroSeen(); else setMomosukeIntroStep(step+1); };
    return(
    <div className="fixed inset-0 flex items-end justify-center" style={{position:'fixed',inset:0,zIndex:77000,backgroundColor:'rgba(2,6,23,.95)'}} role="dialog" aria-modal="true" aria-label="ももすけが助手に加わりました">
      <button type="button" onClick={next} aria-label="次へ" className="absolute inset-0 w-full h-full" style={{background:'transparent'}}/>
      <div className="relative w-full max-w-md max-h-[calc(var(--mh-vh)-env(safe-area-inset-top))] overflow-y-auto mh-scroll rounded-t-3xl border-t-2 border-x-2 border-pink-300 bg-slate-950 p-4" style={{paddingBottom:'calc(1rem + env(safe-area-inset-bottom))',pointerEvents:'none'}}>
        <p className="mb-2 text-center text-[10px] font-black tracking-widest text-pink-200">新しい助手</p>
        {/* 3人を並べて、いま話しているひとりを明るくする */}
        <div className="mb-3 flex items-end justify-center gap-3">
          {cast.map(who=>{
            const talking=who.id===line.who;
            return(
              <div key={who.id} className={`flex flex-col items-center gap-1 ${talking?'':'opacity-35'}`} style={{transform:talking?'scale(1)':'scale(.86)',transition:'opacity .18s, transform .18s'}}>
                <AssistantFace who={who} size={talking?76:56} accent={who.accent} expression={talking?line.e:'normal'}/>
                <span className="text-[9px] font-black" style={{color:talking?who.accent:'#64748b'}}>{who.name}</span>
              </div>
            );
          })}
        </div>
        <div className="rounded-2xl border-2 bg-slate-900 px-3 py-3" style={{borderColor:speaker.accent}}>
          <span className="block text-[9px] font-black tracking-widest" style={{color:speaker.accent}}>{speaker.name}</span>
          <span className="block text-[13px] font-bold leading-relaxed text-white mt-1" style={bubbleWrapStyle()}>{bubbleWrap(line.t)}</span>
        </div>
        <p className="mt-2 text-center text-[11px] font-bold tabular-nums text-slate-300">{step+1} / {script.length}</p>
        {/* スキップ(2026-10-07・モンヒロくんの報告とユーザー指示)。39場面あり、イベントのお話のように飛ばせなかった。
            飛ばしても見たことになり、回想(EVENT_REPLAYS の momosuke_intro)からいつでも見直せる */}
        <div className={`relative mt-3 grid ${last?'grid-cols-1':'grid-cols-[1fr_2fr]'} gap-2`} style={{pointerEvents:'auto'}}>
          {!last&&<button type="button" onClick={(e)=>{e.stopPropagation();markMomosukeIntroSeen();}} className="min-h-[50px] rounded-2xl bg-slate-700 text-sm font-black text-white active:scale-[.98]">スキップ</button>}
          <button type="button" onClick={(e)=>{e.stopPropagation();next();}} className="min-h-[50px] rounded-2xl bg-pink-400 text-sm font-black text-slate-950 active:scale-[.98]">{last?'閉じる':'次へ'}</button>
        </div>
      </div>
    </div>);
  
}

// フレンド申請が届いているときの、助手の知らせ(HOMEに来たときだけ)。
// 選んでいる助手の口調で一言。「見にいく」でフレンド画面へ、「あとで」で閉じる(閉じるだけで申請は消えない)
const FRIEND_NOTICE_LINES = Object.freeze({
  mua: (who) => `${who}からフレンド申請が届いてるよ♪ 見にいってみよう！`,
  kiki: (who) => `${who}からフレンド申請が届いてまつよ。見にいきまつか？`,
  momosuke: (who) => `${who}からフレンド申請が来てるよw 見にいこ？`,
  dra: (who) => `${who}からフレンド申請が来てるわ。見にいくか`,
  atsu: (who) => `${who}からフレンド申請来てるよ。とりあえず見にいこ`,
  kyuko: (who) => `ほい！ ${who}からフレンド申請来てるよぉ。見にいこ笑`,
  sorashido: (who) => `${who}からフレンド申請が来てますよ！ 見にいきましょう笑`,
  // えるびん(2026-11-05・公開前)。穏やかな大人の口調
  erubin: (who) => `${who}からフレンド申請が来てるよ。よかったら、見にいってみよっか`,
});
function HomeFriendRequestNotice({ activeAssistant, count, names, onOpen, onLater }) {
  const who = activeAssistant;
  const list = Array.isArray(names) ? names.filter(Boolean) : [];
  const label = list.length === 0 ? `${count}人`
    : count > list.length ? `${list.join('さん・')}さんたち` : `${list.join('さん・')}さん`;
  const line = (FRIEND_NOTICE_LINES[who && who.id] || FRIEND_NOTICE_LINES.mua)(label);
  return (
    <div data-friend-request-notice className="fixed inset-0 flex items-end justify-center" style={{position:'fixed',inset:0,zIndex:75000,backgroundColor:'rgba(2,6,23,.80)'}} role="dialog" aria-modal="true" aria-label="フレンド申請のお知らせ">
      <div className="w-full max-w-md rounded-t-3xl border-t-2 border-x-2 border-rose-400 bg-slate-950 p-4" style={{paddingBottom:'calc(1rem + env(safe-area-inset-bottom))'}}>
        <h2 className="mb-2 text-center text-base font-black text-rose-200">フレンド申請が届いています</h2>
        <div className="flex items-end gap-2">
          {who&&<AssistantFace who={who} size={76} accent={who.accent} expression="happy"/>}
          <div className="flex-1 rounded-2xl border-2 border-rose-400 bg-slate-900 p-3 text-[13px] font-bold leading-relaxed text-white" style={bubbleWrapStyle()}>{bubbleWrap(line)}</div>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <button type="button" data-friend-notice-later onClick={onLater} className="min-h-[50px] rounded-2xl border border-white/20 bg-slate-800 text-sm font-black text-slate-200 active:scale-95">あとで</button>
          <button type="button" data-friend-notice-open onClick={onOpen} className="min-h-[50px] rounded-2xl bg-rose-500 text-sm font-black text-white active:scale-95">見にいく</button>
        </div>
      </div>
    </div>);
}

// 起動時のお知らせが2件以上たまっているとき、見出しの一覧を1枚だけ出す(2026-10-10・ユーザー指示「起動時のお知らせを1枚にまとめる」)。
// 読みたい件だけ「くわしく」で開く(開いた件は今までどおりのページ送り)。「あとで読む」はその場の全件を既読にする(更新履歴にはいつでも残る)
function HomeUpdateGuideBundle({ activeAssistant, assistantBondLevelNow, assistantCallStyle, breederName, selectedAssistantId, updateGuideQueue, openUpdateGuideDetail, dismissUpdateGuideAll }) {
const who=activeAssistant;
const headline=n=>{const pages=(typeof assistantNoticePagesFor==='function')?assistantNoticePagesFor(n,who&&who.id):(Array.isArray(n.pages)?n.pages:[]);const first=pages[0];const text=(typeof assistantNoticePageText==='function')?assistantNoticePageText(first):String(first||'');return assistantSpeakText(text,breederName,assistantBondLevelNow,assistantCallStyle,selectedAssistantId);};
return(
  <div data-update-guide-bundle className="fixed inset-0 flex items-end justify-center" style={{position:'fixed',inset:0,zIndex:76000,backgroundColor:'rgba(2,6,23,.94)'}} role="dialog" aria-modal="true" aria-label="新しいお知らせの一覧">
    <div className="w-full max-w-md max-h-[calc(var(--mh-vh)-env(safe-area-inset-top))] flex flex-col overflow-hidden rounded-t-3xl border-t-2 border-x-2 border-pink-400 bg-slate-950 p-4" style={{paddingBottom:'calc(env(safe-area-inset-bottom) + 16px)'}}>
      <div className="flex items-center gap-2"><AssistantFace who={who} size={56} accent={who.accent} expression="happy"/><div className="flex-1 rounded-2xl border-2 border-pink-400 bg-slate-900 p-2.5 text-sm font-bold text-white">新しいお知らせが{updateGuideQueue.length}件あるよ♪ 読みたいものだけ「詳しく」で開いてね。</div></div>
      <div className="mt-3 min-h-0 flex-1 space-y-2 overflow-y-auto">{updateGuideQueue.map(n=><div key={n.id} data-update-guide-bundle-item={n.id} className="flex items-center gap-2 rounded-2xl border border-pink-400/40 bg-slate-900/80 p-2.5">
        <div className="min-w-0 flex-1"><div className="text-[13px] font-black leading-snug text-pink-200" style={typeof JA_LABEL_STYLE!=='undefined'?JA_LABEL_STYLE:undefined}>{typeof jaWrap==='function'?jaWrap(n.title):n.title}</div><div className="mt-0.5 truncate text-[10px] font-bold text-slate-400">{headline(n)}</div></div>
        <button type="button" onClick={()=>openUpdateGuideDetail(n.id)} className="min-h-[44px] shrink-0 rounded-xl bg-pink-500 px-3 text-xs font-black text-slate-950">詳しく</button>
      </div>)}</div>
      <button type="button" data-update-guide-bundle-later onClick={dismissUpdateGuideAll} className="mt-4 min-h-[50px] w-full shrink-0 rounded-2xl bg-slate-700 text-sm font-black text-white">あとで読む</button>
      <p data-update-guide-bundle-foot className="mt-2 shrink-0 text-center text-[10px] font-bold text-slate-500">更新履歴からいつでも読めます</p>
    </div>
  </div>);
}
function HomeUpdateGuideOverlay({
  activeAssistant, assistantBondLevelNow, assistantCallStyle, breederName, finishUpdateGuide,
  selectedAssistantId, setUpdateGuidePage, updateGuidePage, updateGuideQueue,
  updateGuideDetail, openUpdateGuideDetail, dismissUpdateGuideAll,
}) {
if(updateGuideQueue.length>=2&&!updateGuideDetail&&!updateGuideQueue[0].debugPreview)
  return <HomeUpdateGuideBundle activeAssistant={activeAssistant} assistantBondLevelNow={assistantBondLevelNow} assistantCallStyle={assistantCallStyle} breederName={breederName} selectedAssistantId={selectedAssistantId} updateGuideQueue={updateGuideQueue} openUpdateGuideDetail={openUpdateGuideDetail} dismissUpdateGuideAll={dismissUpdateGuideAll}/>;
const notice=updateGuideQueue[0];const who=activeAssistant;
// ★選んでいる助手が自分の口調で話す(2026-09-11・ユーザー指示)。
//   その助手のセリフが用意されていない告知は、今までどおり更新履歴の本文をそのまま読む。
//   1ページは文字列でも { e, t } でも書ける(既存の告知は文字列のまま動く)
const pages=(typeof assistantNoticePagesFor==='function')
  ?assistantNoticePagesFor(notice,who&&who.id)
  :(Array.isArray(notice.pages)&&notice.pages.length?notice.pages:['新しいアップデートがあるよ♪']);
const page=Math.min(updateGuidePage,pages.length-1);const last=page===pages.length-1;
const pageText=(typeof assistantNoticePageText==='function')?assistantNoticePageText(pages[page]):String(pages[page]||'');
const pageExpression=(typeof assistantNoticePageExpression==='function')
  ?assistantNoticePageExpression(pages[page],notice.expression||'happy')
  :(notice.expression||'happy');
return(
    <div className="fixed inset-0 flex items-end justify-center" style={{position:'fixed',inset:0,zIndex:76000,backgroundColor:'rgba(2,6,23,.94)'}} role="dialog" aria-modal="true" aria-label={notice.title} data-home-update-guide>
      <div className="w-full max-w-md max-h-[calc(var(--mh-vh)-env(safe-area-inset-top))] overflow-y-auto rounded-t-3xl border-t-2 border-x-2 border-pink-400 bg-slate-950 p-4" style={{paddingBottom:'calc(1rem + env(safe-area-inset-bottom))'}}>
        {notice.debugOnly&&<div className="mb-2 rounded-lg bg-fuchsia-700 px-2 py-1 text-center text-[9px] font-black text-white">DEBUG・通常ログインでは表示されません</div>}
        {/* 告知画像(イベントなど)。あるときだけ、いちばん上に大きく出す。
            画面の高さを食いすぎないよう上限を付ける(正方形の絵でも説明が読める位置に残る)。
            読めなかったら黙って消す(壊れた画像のアイコンを残さない) */}
        {notice.image&&<img data-update-notice-image src={notice.image} alt={`${notice.title}のお知らせ`}
          onError={e=>{e.currentTarget.style.display='none';}} decoding="async"
          className="mb-3 w-full max-h-[42vh] rounded-2xl border border-pink-400/50 object-contain"/>}
        <h2 className="mb-1 text-center text-base font-black text-pink-200" style={typeof JA_LABEL_STYLE!=='undefined'?JA_LABEL_STYLE:undefined}>{typeof XmasNovelWrap==='function'?<XmasNovelWrap text={notice.title}/>:typeof jaWrap==='function'?jaWrap(notice.title):notice.title}</h2><p className="mb-3 text-center text-[10px] font-bold text-slate-400">{page+1} / {pages.length}</p>
        <div className="flex items-end gap-2"><AssistantFace who={who} size={76} accent={who.accent} expression={pageExpression}/><div className="flex-1 rounded-2xl border-2 border-pink-400 bg-slate-900 px-3 py-3 text-[13px] font-bold leading-relaxed text-white" style={bubbleWrapStyle()}>{/* お知らせは名前・日時・曲名・数と単位で割らない部品で折る(2026-11-28 ミハリの総点検「Battle #／5」「11/30(月)／0:00」) */}{(()=>{const t=assistantSpeakText(pageText,breederName,assistantBondLevelNow,assistantCallStyle,selectedAssistantId);return typeof t==='string'&&typeof XmasNovelWrap==='function'?<XmasNovelWrap text={t}/>:bubbleWrap(t);})()}</div></div>
        {!last?<button onClick={()=>setUpdateGuidePage(page+1)} className="mt-4 min-h-[50px] w-full rounded-2xl bg-pink-500 text-sm font-black text-slate-950">次へ</button>:<div className={`mt-4 grid ${notice.destination?'grid-cols-2':'grid-cols-1'} gap-2`}>{notice.destination&&<button onClick={()=>finishUpdateGuide(notice.destination)} className="min-h-[50px] rounded-2xl bg-pink-500 text-sm font-black text-slate-950">{notice.buttonLabel||'見に行く'}</button>}<button onClick={()=>finishUpdateGuide()} className="min-h-[50px] rounded-2xl bg-slate-700 text-sm font-black text-white">{notice.destination?'あとで':'閉じる'}</button></div>}
      </div>
    </div>);
}

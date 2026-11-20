// ===== モンヒロサクセス(育成の画面・回2)の見た目 =====
// 見本(docs/progress/player-raise/mock/v3.css・mock.css)の部品を、この画面の中(.msx)だけに効くよう切り出したもの。
// 見本の「スマホの枠」(.phone)は、ここでは画面いっぱいの .msx。横向きは .msx.land、幅340以下は .msx.s320。
// アニメの名前は msx- を頭に付けて、ほかの画面とぶつからないようにした。下の「足したもの」はゲームの中で要った分
const MSX_CSS = `

.msx{position:relative;overflow:hidden;color:#fff;font-weight:700;font-size:12px;line-height:1.45;
  background:linear-gradient(180deg,#1d1740 0,#151130 45%,#0f0d24 100%)}
/* 大会まわりの全画面([data-msc-root] は overflow-y:auto だけだと overflow-x も auto になり、
   数pxのはみ出しで横にも動いてしまう。2026-11-18 社長「縦だけでいい所が横にも動く」): 横は止める */
.msc-root{overflow-x:hidden}
.msx .in{padding:10px 12px 0}
.msx .hd{display:flex;align-items:center;justify-content:space-between;gap:8px;height:38px}
.msx .hd .bk{background:#2b3348;border-radius:99px;padding:7px 12px;font-size:12px;font-weight:900;white-space:nowrap}
.msx .hd .ti{font-size:13px;font-weight:900;color:#f9a8d4;white-space:nowrap}
.msx .hd .rt{background:#3b3566;border-radius:99px;padding:4px 11px;font-size:12px;font-weight:900;white-space:nowrap}
.msx .card{background:#1e1a36;border:1px solid #3b3566;border-radius:14px;padding:10px;margin-top:8px;position:relative}
.msx .card.pk{border-color:#f472b6aa}.msx .card.sk{border-color:#38bdf8aa}.msx .card.yl{border-color:#fde047;box-shadow:0 0 14px #fde04755}
.msx .card.dash{border-style:dashed;background:#1e1a3680}
.msx .sub{font-size:11px;color:#cbd5e1;font-weight:500}.msx .dim{color:#94a3b8}.msx .yel{color:#fde047}.msx .pnk{color:#f9a8d4}.msx .sky{color:#7dd3fc}.msx .grn{color:#86efac}
.msx .h1{font-size:17px;font-weight:900}.msx .h2{font-size:14px;font-weight:900}
.msx .row{display:flex;align-items:center;gap:8px}.msx .wrap{flex-wrap:wrap}.msx .f1{flex:1;min-width:0}.msx .ctr{text-align:center}.msx .nw{white-space:nowrap}
.msx .btn,.msx .btn2,.msx .btn3{display:block;border-radius:999px;padding:11px 14px;font-weight:900;font-size:14px;text-align:center;color:#fff;white-space:nowrap}
.msx .btn{background:linear-gradient(90deg,#f472b6,#fb923c);box-shadow:0 4px 0 #9d174d66}
.msx .btn2{background:#334155}.msx .btn3{background:#1e293b;border:1px solid #475569;color:#cbd5e1}
.msx .btn.sm,.msx .btn2.sm,.msx .btn3.sm{padding:7px 10px;font-size:12px}
.msx .tabs{display:flex;gap:6px;margin-top:8px}
.msx .tabs span{flex:1;text-align:center;font-size:12px;font-weight:900;padding:8px 4px;border-radius:99px;background:#1e293b;color:#94a3b8;white-space:nowrap}
.msx .tabs span.on{background:linear-gradient(90deg,#f472b6,#fb923c);color:#fff}
.msx .tabs.y span{border-radius:10px;border:1px solid #475569}.msx .tabs.y span.on{background:#fde047;color:#422006;border-color:#fde047}
.msx .chip{display:inline-flex;align-items:center;justify-content:center;text-align:center;border-radius:99px;padding:2px 9px;font-size:11px;font-weight:900;background:#0f172a;border:1px solid #475569;color:#cbd5e1;white-space:nowrap}
.msx .chip.on{background:#fde047;color:#422006;border-color:#fde047}.msx .chip.p{background:#f472b6;border-color:#f472b6;color:#fff}
.msx .chip.g{background:#064e3b;border-color:#34d399;color:#a7f3d0}.msx .chip.s{background:#0c4a6e;border-color:#38bdf8;color:#bae6fd}
.msx .fc{width:40px;height:40px;border-radius:50%;object-fit:cover;object-position:top;border:2px solid #fff3;background:#312e5a;flex:none}
.msx .bub{background:#fff;color:#1e1b4b;border-radius:12px;padding:7px 10px;font-size:12.5px;font-weight:800;line-height:1.5;position:relative}
.msx .bar{height:8px;border-radius:9px;background:#334155;overflow:hidden;position:relative}
.msx .bar i{display:block;height:100%;border-radius:9px;background:linear-gradient(90deg,#f59e0b,#fb923c)}
.msx .bar.g i{background:linear-gradient(90deg,#34d399,#a3e635)}.msx .bar.p i{background:linear-gradient(90deg,#f472b6,#fb923c)}
.msx .sts{display:grid;grid-template-columns:1fr 1fr;gap:5px 12px}
.msx .st1{display:flex;align-items:center;gap:5px;font-size:11px}
.msx .st1 .nm{width:56px;white-space:nowrap;color:#e2e8f0}.msx .st1 .bar{flex:1;height:7px}.msx .st1 b{width:27px;text-align:right;font-size:12px}
.msx .st1 em{font-style:normal;color:#86efac;font-size:11px;font-weight:900;width:26px}
.msx .st1 .ap{width:14px;text-align:center;font-size:11px;color:#fde047}
.msx .rk{display:inline-flex;align-items:center;justify-content:center;min-width:22px;height:18px;padding:0 5px;border-radius:6px;font-size:11px;font-weight:900;color:#0f172a;background:#94a3b8;font-style:normal}
.msx .rk.rG,.msx .rk.rF{background:#94a3b8}.msx .rk.rE{background:#4ade80}.msx .rk.rD{background:#2dd4bf}.msx .rk.rC{background:#38bdf8}.msx .rk.rB{background:#a78bfa}
.msx .rk.rA{background:#f472b6}.msx .rk.rS{background:#fbbf24}.msx .rk.rSS{background:#fb923c}.msx .rk.rSSS{background:#f87171}
.msx .rk.rM{background:linear-gradient(90deg,#f472b6,#fde047,#34d399,#38bdf8,#a78bfa);color:#1e1b4b}
.msx .rk.big{height:26px;min-width:34px;font-size:16px;border-radius:8px}
.msx .cf{position:relative;width:30px;height:30px;flex:none}
.msx .cf img{width:30px;height:30px;border-radius:9px;object-fit:cover;background:#0f172a;border:2px solid #94a3b8}
.msx .cf.rE img,.msx .cf.rD img{border-color:#2dd4bf}.msx .cf.rC img{border-color:#38bdf8}.msx .cf.rB img{border-color:#a78bfa}.msx .cf.rA img{border-color:#f472b6}.msx .cf.rS img{border-color:#fbbf24}.msx .cf.rM img{border-color:#fde047}
.msx .cf.base img{opacity:.55;border-style:dashed}
.msx .cf.fav::after{content:'★';position:absolute;right:-4px;top:-6px;font-size:11px;color:#fde047;text-shadow:0 1px 0 #422006}
.msx .cf.fr::before{content:'🤝';position:absolute;left:-5px;bottom:-5px;font-size:10px}
.msx .cf.lg{width:46px;height:46px}.msx .cf.lg img{width:46px;height:46px;border-radius:12px}
.msx .tg{display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin-top:6px}
.msx .tc{background:#0f172a;border:1px solid #475569;border-radius:12px;padding:6px 5px 5px;text-align:center;position:relative;min-height:82px}
.msx .tc .ic{font-size:19px;line-height:1.1}.msx .tc .nm{font-size:11.5px;font-weight:900}.msx .tc .ex{font-size:10px;color:#86efac;font-weight:900}
.msx .tc .fs{display:flex;justify-content:center;gap:2px;margin-top:4px;min-height:24px}
.msx .tc .fs .cf,.msx .tc .fs .cf img{width:24px;height:24px;border-radius:7px}
.msx .tc.fav{border-color:#fde047;background:#3b2f0b;box-shadow:0 0 10px #fde04766}
.msx .tc.party{border-color:#f472b6;background:linear-gradient(160deg,#4a1d5c,#3b2f0b);box-shadow:0 0 14px #f472b699}
.msx .tc .rib{position:absolute;top:-7px;left:50%;transform:translateX(-50%);background:linear-gradient(90deg,#f472b6,#fb923c);border-radius:99px;font-size:10px;font-weight:900;padding:1px 8px;white-space:nowrap}
.msx .tc.none .fs{opacity:.5;font-size:10px;color:#64748b;align-items:center}
.msx .cmd{display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin-top:8px}
.msx .cmd div{background:#334155;border-radius:14px;padding:7px 2px;text-align:center;font-size:12px;font-weight:900;line-height:1.3}
.msx .cmd div small{display:block;font-size:10px;color:#cbd5e1;font-weight:700}
.msx .cmd div.off{background:#1e293b;color:#64748b}.msx .cmd div.off small{color:#64748b}.msx .cmd div.hot{background:linear-gradient(90deg,#f472b6,#fb923c)}
.msx .stage{position:relative;border-radius:14px;border:1px solid #3b3566;overflow:hidden;margin-top:8px;
  background:radial-gradient(ellipse at 50% 88%,#4c3f8f 0,#241d4a 55%,#171230 100%)}
.msx .stage .mon{position:absolute;object-fit:contain;filter:drop-shadow(0 8px 5px #0009)}
.msx .stage .tag{position:absolute;font-size:10.5px;font-weight:900;background:#0009;border-radius:7px;padding:1px 8px;white-space:nowrap}
.msx .bgimg{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
.msx .shade{position:absolute;inset:0;background:linear-gradient(180deg,#0f0d2455,#0f0d24dd)}
.msx .cut{position:absolute;left:-6px;right:30px;padding:5px 20px;background:linear-gradient(90deg,#a855f7,#6366f1 70%,#6366f100)}
.msx .cut.pow{background:linear-gradient(90deg,#f97316,#ef4444 70%,#ef444400)}.msx .cut.gold{background:linear-gradient(90deg,#f59e0b,#fde047 60%,#fde04700);color:#422006}
.msx .cut.gray{background:linear-gradient(90deg,#475569,#334155 70%,#33415500)}.msx .cut.sky{background:linear-gradient(90deg,#0ea5e9,#2563eb 70%,#2563eb00)}
.msx .cut b{display:block;font-size:19px;letter-spacing:.05em;text-shadow:0 2px 0 #0005}.msx .cut small{font-size:10.5px;font-weight:900}
.msx .up{position:absolute;font-size:24px;font-weight:900;color:#fde047;text-shadow:0 2px 0 #b91c1c,0 0 8px #f97316;white-space:nowrap}
.msx .up small{font-size:12px;color:#fff;text-shadow:0 1px 0 #0008}
.msx .modal{position:absolute;inset:0;background:#0b0920d9;display:flex;flex-direction:column;justify-content:center;padding:18px}
.msx .spark{position:absolute;font-size:18px}
.msx .ft{position:absolute;left:12px;right:12px;bottom:14px}
.msx .grid2{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.msx .grid3{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:7px}.msx .grid4{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:6px}
.msx .ph{background:#0f172a;border-radius:12px;object-fit:contain}
.msx .lk{filter:grayscale(1) brightness(.5)}
.msx .life{position:relative;height:12px;border-radius:9px;background:#334155;margin-top:5px}
.msx .life i{display:block;height:100%;border-radius:9px;background:linear-gradient(90deg,#34d399,#a3e635)}
.msx .life .pk{position:absolute;top:-2px;height:16px;border:1.5px dashed #fde047;border-radius:6px;background:#fde04722}
.msx .life u{position:absolute;top:-3px;width:2px;height:18px;background:#fff;border-radius:2px}
.msx .dots{display:flex;gap:5px}.msx .dots i{width:22px;height:8px;border-radius:5px;background:#334155}.msx .dots i.on{background:#fb923c}.msx .dots i.ok{background:#34d399}
.msx table.t{width:100%;border-collapse:collapse;font-size:11.5px}.msx table.t td{padding:4px 3px;border-bottom:1px solid #fff1;text-align:right}.msx table.t td:first-child{text-align:left}
@keyframes msx-mkPop{0%{transform:scale(.3);opacity:0}60%{transform:scale(1.25);opacity:1}100%{transform:scale(1)}}
@keyframes msx-mkRise{0%{transform:translateY(14px);opacity:0}25%{opacity:1}100%{transform:translateY(-10px);opacity:1}}
@keyframes msx-mkHop{0%,100%{transform:translateY(0)}45%{transform:translateY(-12px)}}
@keyframes msx-mkCut{0%{transform:translateX(-110%)}100%{transform:translateX(0)}}
@keyframes msx-mkShake{0%,100%{transform:translateX(0)}20%{transform:translateX(-5px)}50%{transform:translateX(5px)}80%{transform:translateX(-3px)}}
@keyframes msx-mkGlow{0%,100%{box-shadow:0 0 6px #fde04755}50%{box-shadow:0 0 18px #fde047cc}}
@keyframes msx-mkSpin{0%{transform:rotateY(0)}100%{transform:rotateY(720deg)}}
@keyframes msx-mkMerge{0%{transform:translateX(var(--dx)) scale(1);opacity:1}100%{transform:translateX(0) scale(.2);opacity:0}}
.msx .tg.tall .tc{min-height:98px;padding-top:9px}.msx .tg.tall .tc .fs{margin-top:7px}
.msx{display:flex;flex-direction:column;container-type:size;font-size:12px}
.msx.s320{}
.msx.land{}
.msx .v-hd{flex:none;display:flex;align-items:center;gap:6px;height:32px;padding:4px 10px 0}
.msx .v-hd .bk{background:#2b3348;border-radius:99px;padding:4px 10px;font-size:11px;font-weight:900;white-space:nowrap}
.msx .v-hd .ti{flex:1;min-width:0;font-size:12.5px;font-weight:900;color:#f9a8d4;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.msx .v-hd .ti small{color:#cbd5e1;font-size:10px;font-weight:700;margin-left:4px}
.msx .v-hd .rt{background:#3b3566;border-radius:99px;padding:3px 9px;font-size:11px;font-weight:900;white-space:nowrap}
.msx .v-body{flex:1;min-height:0;display:flex;flex-direction:column;padding:0 10px 8px}
.msx .v-body>*{flex:none}
.msx .v-body>.msx-scroll{flex:1 1 0;min-height:0}
.msx .v-body.st{overflow-y:auto;overscroll-behavior:contain;-webkit-overflow-scrolling:touch}
.msx .v-band{background:linear-gradient(180deg,#241d4a,#1a1636);border:1px solid #4a4380;border-radius:14px;padding:6px 8px 6px;margin-top:5px;box-shadow:inset 0 1px 0 #ffffff14}
.msx .v-b1{display:flex;align-items:center;gap:6px}
/* ピーク中の印(帯の上の縁にかかる)が「残り◯ターン」の数字に重ならないよう、印のぶんだけ帯の上を空ける(r1115-073) */

.msx.land .v-scene .rcv-myua{top:56px!important;bottom:auto!important;height:420px!important;left:4%!important}
.msx .v-ft{flex-wrap:wrap}.msx .v-ft>button{min-width:0}
.msx .v-turn{flex:1;min-width:0;display:flex;align-items:center;gap:6px}
.msx .v-turn .ph{background:linear-gradient(160deg,#f472b6,#fb923c);border-radius:9px;padding:3px 7px;font-size:11px;font-weight:900;line-height:1.15;text-align:center;white-space:nowrap;box-shadow:0 2px 0 #9d174d}
.msx .v-turn .ph small{display:block;font-size:10px;font-weight:700;opacity:.95}
.msx .v-turn .n{font-size:11px;font-weight:900;white-space:nowrap;line-height:1}
/* 最後の期の帯(HF進出・当日)。参考 taikai-entry 175 */
.msx .v-turn .ph.hf{background:linear-gradient(160deg,#fde047,#f59e0b);color:#422006;box-shadow:0 2px 0 #92400e}
.msx .v-turn .n b.hfday{font-size:20px;color:#fde047;letter-spacing:.06em}
.msx .v-turn .n b{font-size:30px;color:#fde047;margin:0 2px;letter-spacing:-.02em;text-shadow:0 2px 0 #9a3412,0 0 12px #fde04766}
.msx .v-turn .n small{display:block;font-size:10px;color:#cbd5e1;font-weight:700;margin-top:3px}
.msx .v-turn .n small em{font-style:normal;color:#fff;font-weight:900}
.msx .v-pow{display:flex;align-items:center;gap:5px;background:#0f172a;border:1px solid #f472b6aa;border-radius:11px;padding:3px 7px 3px 8px;line-height:1.1}
.msx .v-pow small{display:block;font-size:10px;color:#f9a8d4;font-weight:900;white-space:nowrap}
.msx .v-pow b{font-size:17px;color:#fde047;white-space:nowrap}
.msx .v-pow .rk.big{height:28px;min-width:28px;font-size:17px;box-shadow:0 2px 0 #0008}
/* 体力とストレスは1段ずつ横いっぱいに取る。2つ並べると数字と名前で幅が取られ、棒が短くて残量が読めなかった(2026-11-17 社長「体力のゲージがやたら短くて見にくい」) */
.msx .v-b2{display:grid;grid-template-columns:1fr;gap:5px;margin-top:6px}
.msx .v-ga{position:relative;display:flex;align-items:center;gap:4px;font-size:10px;font-weight:900;white-space:nowrap}
.msx .v-ga .tr{flex:1;min-width:0;height:13px;border-radius:99px;background:#0b0920;border:1px solid #475569;position:relative;overflow:hidden}
.msx .v-ga .tr i{position:absolute;left:0;top:0;bottom:0;border-radius:99px}
.msx .v-ga.hp .tr i{background:linear-gradient(180deg,#bef264,#22c55e)}
.msx .v-ga.hp.low .tr i{background:linear-gradient(180deg,#fdba74,#ef4444)}
.msx .v-ga.st .tr i{background:linear-gradient(180deg,#f9a8d4,#a855f7)}
.msx .v-ga .tr u{position:absolute;top:0;bottom:0;background:repeating-linear-gradient(45deg,#ef4444 0 3px,#7f1d1d 3px 6px)}
.msx .v-ga .tr u.add{background:repeating-linear-gradient(45deg,#e879f9 0 3px,#701a75 3px 6px)}
.msx .v-ga .tr u.heal{background:repeating-linear-gradient(45deg,#86efac 0 3px,#166534 3px 6px)}
.msx .v-ga .tr s{position:absolute;top:0;bottom:0;width:0;border-left:1.5px dashed #fde047}
@keyframes rx-hop{0%,100%{transform:translateX(-50%) translateY(0)}30%{transform:translateX(-50%) translateY(-16px)}60%{transform:translateX(-50%) translateY(0)}78%{transform:translateX(-50%) translateY(-7px)}}
@keyframes rx-sag{0%{transform:translateX(-50%) translateY(0)}35%{transform:translateX(-50%) translateY(6px) scaleY(.94)}100%{transform:translateX(-50%) translateY(3px) scaleY(.97)}}
@keyframes rx-pop{0%{transform:scale(.3);opacity:0}70%{transform:scale(1.12);opacity:1}100%{transform:scale(1);opacity:1}}
.msx .v-body2.rx-hop{animation:rx-hop .9s ease-out 1}.msx .v-body2.rx-sag{animation:rx-sag .8s ease-out 1 forwards}
.msx .rx-bub{position:absolute;left:6%;top:26%;background:#fff;color:#1e1b4b;border:2px solid #f9a8d4;border-radius:14px;padding:4px 10px;font-size:12px;font-weight:900;animation:rx-pop .4s ease-out .25s both;white-space:nowrap;z-index:3}
.msx .v-ga b{font-size:12.5px;width:50px;flex:none;text-align:right}.msx .v-ga b small{font-size:10px;color:#cbd5e1;font-weight:700}
.msx .v-ga b small.cap{color:#fde047}
/* 増減の字(−16・+4)は棒の長さを変えない: 棒と数のあいだにいつも空けてある枠に出す(r1115-083 どの画面でも棒の長さ・位置は同じ・r1115-207 L1 棒の端と「100/100」に重ねない) */
.msx .v-ga .tr{margin-right:26px}
.msx .v-ga em{position:absolute;right:54px;top:50%;transform:translateY(-50%);z-index:2;pointer-events:none;font-style:normal;font-size:10.5px;color:#fca5a5;text-shadow:0 0 3px #0b0920,0 0 3px #0b0920,0 0 2px #0b0920}.msx .v-ga em.pl{color:#f0abfc}.msx .v-ga em.hl{color:#86efac}
.msx .v-scene{flex:1 1 0;min-height:0;position:relative;border-radius:16px;border:1px solid #4a4380;overflow:hidden;margin-top:6px;background:#0f0d24}
/* 選ぶ画面(育成開始)では場面を細い帯にし、一覧に高さを譲る(選ぶ画面の統一。2026-11-18 社長の実機報告でさらに細く。横向きの組み立てでは上の .land の指定が勝つ) */
.msx .v-scene.sm{flex:none;height:68px}
.msx .v-scene .bg{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:50% 78%}
.msx .v-scene .sh{position:absolute;inset:0;background:linear-gradient(180deg,#1d174055 0,#1d174000 26%,#0f0d2400 62%,#0f0d24cc 100%)}
.msx .v-scene.dk .sh{background:#0f0d2499}
.msx .v-scene .mon{position:absolute;left:50%;transform:translateX(-50%);height:44%;aspect-ratio:1;object-fit:contain;bottom:var(--mb,25%);filter:drop-shadow(0 8px 5px #0009)}
.msx .v-scene .gr{position:absolute;left:50%;transform:translateX(-50%);bottom:calc(var(--mb,25%) - 5px);width:30%;height:5%;border-radius:50%;background:radial-gradient(ellipse,#000a 0,#0000 70%)}
.msx .v-chips{position:absolute;right:7px;top:7px;display:flex;flex-direction:column;align-items:flex-end;gap:4px}
.msx .v-chip{background:#0f0d24d0;border:1px solid #ffffff33;border-radius:99px;padding:2px 9px;font-size:10.5px;font-weight:900;white-space:nowrap}
.msx .v-chip.hot{background:linear-gradient(90deg,#f472b6,#fb923c);border-color:#0000;box-shadow:0 2px 6px #0006}
.msx .v-chip.bad{background:#7f1d1d;border-color:#fca5a5;color:#fee2e2}
.msx .v-chip.ylw{background:#fde047;color:#422006;border-color:#0000}
.msx .v-nm{position:absolute;left:50%;transform:translateX(-50%);bottom:calc(var(--mb,25%) - 26px);background:#0f0d24d9;border:1px solid #ffffff33;border-radius:99px;padding:2px 12px;font-size:11.5px;font-weight:900;white-space:nowrap}
.msx .v-nm small{color:#fde047;font-size:10px;margin-left:5px}
.msx .v-yousu{position:absolute;left:50%;bottom:66%;transform:translateX(18%);background:#7f1d1d;border:1.5px solid #fca5a5;border-radius:12px 12px 12px 2px;padding:2px 8px;font-size:11px;font-weight:900;white-space:nowrap;box-shadow:0 0 10px #ef444488}
.msx .v-party{position:absolute;left:6px;top:6px;background:#0f0d24d0;border:1px solid #ffffff2a;border-radius:12px;padding:4px 5px 5px;display:flex;flex-direction:column;gap:4px;align-items:center}
.msx .v-party>small{font-size:10px;font-weight:900;color:#f9a8d4;white-space:nowrap;line-height:1.2}
/* 育成メイン: 編成・持ち物・詳細を風景の下にまとめた帯(2026-11-16 UI改修) */
.msx .v-under{display:flex;gap:6px;align-items:stretch;margin-top:6px}
.msx .v-party.row{position:static;flex:1;flex-direction:row;align-items:center;justify-content:flex-start;flex-wrap:nowrap;min-width:0}
.msx .v-party.row>small{flex:none;min-width:0;overflow:hidden;text-overflow:ellipsis}
.msx .v-party.row .v-pf{flex:0 1 30px;min-width:0}
.msx .v-party.row .v-pf img{width:100%;height:auto;aspect-ratio:1/1}
.msx .v-bagb.st{position:relative;flex:0 0 auto}
/* トレーニング: 実行ボタンの近くのまとめ(上がる能力・失敗率・体力消費。2026-11-16 UI改修) */
.msx .v-trsum{display:flex;gap:10px;align-items:center;justify-content:center;flex-wrap:wrap;margin-top:6px;padding:6px 10px;border-radius:10px;background:#0f0d24d0;border:1px solid #ffffff2a;font-size:12px;font-weight:800;color:#e2e8f0}
.msx .v-trsum .g{color:#fde047;font-weight:900}
.msx .v-trsum b{color:#fff}
.msx .v-pf{position:relative;display:block;width:30px;flex:none}
.msx .v-pf img{display:block;width:30px;height:30px;border-radius:9px;object-fit:cover;background:#0f172a;border:2px solid #94a3b8}
.msx .v-pf.rD img{border-color:#2dd4bf}.msx .v-pf.rC img{border-color:#38bdf8}.msx .v-pf.rB img{border-color:#a78bfa}.msx .v-pf.rA img{border-color:#f472b6}.msx .v-pf.rS img{border-color:#fbbf24}.msx .v-pf.rM img{border-color:#fde047}
.msx .v-pf.base img{border-style:dashed;opacity:.7}
.msx .v-pf.as img{border-radius:50%;border-color:#f9a8d4;object-position:top}
.msx .v-pf .af{display:block;height:4px;border-radius:3px;background:#334155;margin-top:2px;overflow:hidden;position:relative}
.msx .v-pf .af b{display:block;height:100%;background:linear-gradient(90deg,#38bdf8,#f472b6)}
.msx .v-pf.tag img{border-color:#fff;box-shadow:0 0 0 2px #fde047,0 0 10px 2px #fde047,0 0 16px 4px #fb923c}
.msx .v-pf.tag .af b{background:linear-gradient(90deg,#fde047,#fb923c)}
.msx .v-pf.tag::after{content:'🤝';position:absolute;right:-6px;top:-7px;font-size:11px;filter:drop-shadow(0 1px 0 #000)}
.msx .v-pf.fr::before{content:'借';position:absolute;left:-4px;top:-5px;z-index:1;background:#38bdf8;color:#0f172a;font-size:10px;font-weight:900;border-radius:5px;padding:0 2px;line-height:1.4}
.msx .v-pf.sm,.msx .v-pf.sm img{width:24px}.msx .v-pf.sm img{height:24px;border-radius:7px}
.msx .v-pf.lg,.msx .v-pf.lg img{width:42px}.msx .v-pf.lg img{height:42px;border-radius:12px}
.msx .v-say{position:absolute;left:7px;right:7px;bottom:6px;display:flex;align-items:center;gap:6px}
.msx .v-say .fc{width:38px;height:38px;border-color:#f9a8d4}
.msx .v-say .bub{flex:1;min-width:0;font-size:11.5px;padding:5px 9px;line-height:1.35;border-radius:12px 12px 12px 3px}
.msx .v-say .bub em{font-style:normal;color:#be185d}
.msx .v-side{position:absolute;right:7px;bottom:54px;display:flex;flex-direction:column;gap:4px;align-items:flex-end}
.msx .v-mini{background:#0f0d24d9;border:1px solid #475569;border-radius:10px;padding:2px 8px;font-size:10.5px;font-weight:900;white-space:nowrap;line-height:1.3}
.msx .v-mini b{color:#fde047}
.msx .v-st{display:grid;grid-template-columns:repeat(6,1fr);gap:3px;margin-top:6px}
.msx .v-st div{background:#1e1a36;border:1px solid #3b3566;border-radius:9px;padding:2px 1px 3px;text-align:center;line-height:1.15;position:relative;min-width:0}
.msx .v-st small{display:block;font-size:10px;color:#e2e8f0;white-space:nowrap}
.msx .v-st b{display:block;font-size:14px}
.msx .v-st .vl{display:flex;align-items:center;justify-content:center;gap:2px}
.msx .v-st .vl b{display:inline;font-size:14px}
/* ランクの字は小さな札の形にして、カードの中に収める。字だけ大きいと隣のカードや数に重なって読めなかった(2026-11-17 社長) */
.msx .v-st .msx-srk{display:inline-flex;align-items:center;justify-content:center;min-width:16px;height:15px;padding:0 3px;border-radius:5px;font-size:10px;line-height:1;color:#0f172a;text-shadow:none;flex:none}
.msx .v-st .msx-srk.rG{background:#94a3b8}.msx .v-st .msx-srk.rF{background:#a78bfa}.msx .v-st .msx-srk.rE{background:#60a5fa}.msx .v-st .msx-srk.rD{background:#7dd3fc}.msx .v-st .msx-srk.rC{background:#4ade80}.msx .v-st .msx-srk.rB{background:#f472b6}
.msx .v-st .msx-srk.rA,.msx .v-st .msx-srk.rAp{background:#f87171}.msx .v-st .msx-srk.rS,.msx .v-st .msx-srk.rSp{background:#fbbf24}.msx .v-st .msx-srk.rM{background:linear-gradient(90deg,#f472b6,#fde047,#34d399,#38bdf8,#a78bfa)}
/* 上限(/999)は数と同じ行ではなく棒の横に置く。同じ行だと4桁の能力でカードからはみ出すため */
.msx .v-st .br{display:flex;align-items:center;gap:3px;margin:1px 5px 0;flex-wrap:wrap}
.msx .v-st .br u{flex:1;min-width:0;margin:0}
.msx .v-st .br .ap{flex:1;margin-top:0}
.msx .v-st .br .cap{font-size:10px;color:#94a3b8;font-weight:800;flex:none}
.msx .msx-srk{font-style:normal;font-weight:900}
.msx .msx-srk.rM{color:#e879f9}.msx .msx-srk.rSp,.msx .msx-srk.rS{color:#fde047}.msx .msx-srk.rAp,.msx .msx-srk.rA{color:#f87171}.msx .msx-srk.rB{color:#f472b6}.msx .msx-srk.rC{color:#4ade80}.msx .msx-srk.rD{color:#7dd3fc}.msx .msx-srk.rE{color:#60a5fa}.msx .msx-srk.rF{color:#a78bfa}.msx .msx-srk.rG{color:#94a3b8}
.msx .v-st u{display:block;height:3px;border-radius:3px;background:#334155;margin:1px 5px 0;overflow:hidden;text-decoration:none}
.msx .v-st u i{display:block;height:100%;background:linear-gradient(90deg,#f59e0b,#fb923c)}
/* 能力の上限アップ(r1115-103): 999 を超えた分は2周目の帯を紫で重ねる */
.msx .v-st u.ov{position:relative}
.msx .v-st u b.ov{position:absolute;left:0;top:0;bottom:0;background:linear-gradient(90deg,#c084fc,#f0abfc)}
.msx .v-st em{display:block;font-style:normal;font-size:11px;font-weight:900;color:#86efac;height:14px;line-height:14px}
/* font-size:inherit … 浮動文字用の汎用 .up(24px)が漏れると、字の大きさを持たないランクの字が巨大化してカードからはみ出すため、打ち消す */
.msx .v-st div.up{border-color:#fde047;background:#3b2f0b;box-shadow:0 0 8px #fde04766;font-size:inherit}.msx .v-st div.up b{color:#fde047}
.msx .v-st div.up.main em{font-size:13px;color:#fde047}
.msx .v-st div.dn{border-color:#f87171;background:#3b1220}.msx .v-st div.dn em{color:#fca5a5}
.msx .v-st u.g{position:relative;height:6px;overflow:visible}
.msx .v-st u.g i{border-radius:3px;transition:width .9s cubic-bezier(.33,1,.68,1) .25s}
.msx .v-st u.g s{position:absolute;top:0;bottom:0;border-radius:3px;text-decoration:none}
.msx .v-st u.g s.gu{background:linear-gradient(90deg,#fff7c2,#fde047);box-shadow:0 0 6px 1px #fde047,0 0 12px #fbbf24;transition:width .9s cubic-bezier(.33,1,.68,1) .25s}
.msx .v-st.grow.on u.g s.gu{animation:msxStGlow 1.1s ease-in-out 1.15s 3 alternate}
.msx .v-st u.g s.gd{background:#f87171;box-shadow:0 0 6px #f87171;opacity:0}
.msx .v-st.grow:not(.on) u.g s.gd{opacity:.9}
.msx .v-st.grow.on u.g s.gd{opacity:0;transition:opacity .9s ease-out .25s}
@keyframes msxStGlow{from{filter:brightness(1)}to{filter:brightness(1.6)}}
.msx .v-st.gs-a div.up{transition:transform .35s cubic-bezier(.2,.9,.3,1.25),box-shadow .35s;transform-origin:50% 100%}
.msx .v-st.gs-a.zin div.up{transform:translateY(-6px) scale(1.1);z-index:3;box-shadow:0 0 16px #fde047aa,0 8px 14px #000a}
.msx .v-st.gs-a u.g{transition:height .35s,margin .35s}
.msx .v-st.gs-a.zs u.g i,.msx .v-st.gs-a.zs u.g s.gu{transition:none}
.msx .v-st.gs-a:not(.zs) u.g i,.msx .v-st.gs-a:not(.zs) u.g s{transition:left .45s ease-in-out,width .45s ease-in-out}
.msx .v-st.gs-a.zin.many div.up{transform:none;box-shadow:0 0 8px #fde04766}
.msx .v-st.gs-a.zs div.up u.g,.msx .v-st.gs-a.zs div.dn u.g{height:12px;margin:2px 3px 1px;background-color:#334155;background-image:linear-gradient(90deg,transparent calc(100% - 1px),#cbd5e1aa 0)}
.msx .v-st.gs-a.zs div.up u.g i,.msx .v-st.gs-a.zs div.up u.g s,.msx .v-st.gs-a.zs div.dn u.g i,.msx .v-st.gs-a.zs div.dn u.g s{border-radius:2px}
.msx .v-st.gs-a .br q.zl{quotes:none;flex:0 0 100%;display:flex;justify-content:space-between;font-size:10px;font-weight:800;color:#fde68a;line-height:11px;margin-top:1px;pointer-events:none}
.msx .v-st.gs-a .br q.zl::before,.msx .v-st.gs-a .br q.zl::after{content:none}
@container (max-width:340px){.msx .v-st.gs-a .br q.zl{letter-spacing:-.05em}}
@media (max-width:340px){.msx .v-st.gs-a u.g q{font-size:10px;letter-spacing:-.06em;left:-3px;right:-3px}}
@media (prefers-reduced-motion: reduce){.msx .v-st u.g i,.msx .v-st u.g s.gu{transition:none}.msx .v-st.grow.on u.g s.gu{animation:none}}
.msx .v-act{display:grid;gap:5px;margin-top:6px}
.msx .v-p{background:linear-gradient(180deg,#3d4c6b,#2a3247);border:1px solid #64748b;border-bottom:3px solid #0b1020;border-radius:14px;text-align:center;padding:5px 2px 4px;font-size:12.5px;font-weight:900;line-height:1.2;position:relative;display:flex;flex-direction:column;justify-content:center;align-items:center;min-width:0;white-space:nowrap}
.msx .v-p .e{font-size:19px;line-height:1.1}.msx .v-p small{display:block;font-size:10px;color:#cbd5e1;font-weight:700;white-space:nowrap}
.msx .v-p.main{background:linear-gradient(160deg,#f472b6,#fb923c);border-color:#fde047;border-bottom-color:#9d174d;box-shadow:0 0 14px #f472b699;font-size:16px}
.msx .v-p.main small{color:#fff;font-size:10px}
.msx .v-p.off{background:#1e293b;border-color:#334155;color:#64748b}.msx .v-p.off small{color:#64748b}.msx .v-p.off small.hpng{color:#fda4af;line-height:1.15}.msx .v-p small.hpng b{color:#fecdd3}.msx .v-p.off .e{filter:grayscale(1);opacity:.6}
.msx .v-p.hosp{background:linear-gradient(180deg,#0e7490,#155e75);border-color:#67e8f9;box-shadow:0 0 10px #22d3ee88}
.msx .v-p .bd{position:absolute;right:-2px;top:-6px;background:#fde047;color:#422006;border-radius:99px;font-size:10px;font-weight:900;padding:0 5px;white-space:nowrap;line-height:1.5}
.msx .v-p .bd.r{background:#ef4444;color:#fff}
.msx .v-act-pre .v-p{min-height:74px;font-size:15px}.msx .v-act-pre .v-p .e{font-size:24px}
.msx .v-p.hb{font-size:19px;background:linear-gradient(160deg,#f59e0b,#dc2626);border-color:#fde68a;border-bottom-color:#7f1d1d;box-shadow:0 0 16px #f59e0bb3}
.msx .v-p.hb small{white-space:normal;font-size:11px}
.msx .v-p .hbt{position:absolute;left:8px;top:-9px;background:#fff;color:#dc2626;border:2px solid #dc2626;border-radius:6px;font-size:12px;font-weight:900;padding:0 7px;line-height:1.4;transform:rotate(-8deg);box-shadow:0 2px 0 #7f1d1d}
.msx .v-gather{display:flex;align-items:center;justify-content:center;gap:3px;margin-top:2px;background:#0f0d2466;border-radius:9px;padding:2px 5px;font-size:10px;white-space:nowrap}
.msx .v-gather .v-pf,.msx .v-gather .v-pf img{width:20px}.msx .v-gather .v-pf img{height:20px;border-radius:6px;border-width:1.5px}
.msx .v-gather .v-pf.tag::after{display:none}
.msx .v-ft{flex:none;height:40px;background:#0b0920;border-top:1px solid #3b3566;display:flex;align-items:center;gap:5px;padding:0 10px}
.msx .v-ft .v-wait{flex:1 1 0;text-align:center;font-size:12.5px;font-weight:900;color:#fde68a}
.msx .v-ft span,.msx .v-ft button{flex:1;text-align:center;background:#2b3348;border-radius:99px;padding:5px 2px;font-size:10.5px;font-weight:900;white-space:nowrap}
.msx .v-ft span.on,.msx .v-ft button.on{background:#fde047;color:#422006}
.msx .v-ft span.go,.msx .v-ft button.go{flex:2.4;background:linear-gradient(90deg,#fb923c,#f97316);font-size:13px;padding:7px 2px;box-shadow:0 3px 0 #9a3412}
.msx .v-ft span.go2,.msx .v-ft button.go2{flex:2.4;background:#fde047;color:#422006;font-size:13px;padding:7px 2px;box-shadow:0 3px 0 #a16207}
.msx .v-tabs{display:flex;gap:5px;margin-top:6px}
.msx .v-tabs span,.msx .v-tabs button{flex:1;text-align:center;font-size:11.5px;font-weight:900;padding:5px 2px;border-radius:10px;background:#1e293b;border:1px solid #475569;color:#94a3b8;white-space:nowrap}
.msx .v-tabs span.on,.msx .v-tabs button.on{background:#fde047;color:#422006;border-color:#fde047}
.msx .v-tabs span.on.hv,.msx .v-tabs button.on.hv{background:linear-gradient(90deg,#ef4444,#fb923c);color:#fff;border-color:#fecaca}
.msx .v-trs{display:grid;grid-template-columns:repeat(6,1fr);gap:2px;margin-top:4px;align-items:end}
.msx .v-tr{text-align:center;position:relative;min-width:0;padding-top:16px}
.msx .v-tr .fs{display:flex;justify-content:center;align-items:flex-end;min-height:30px}
.msx .v-tr .fs .v-pf,.msx .v-tr .fs .v-pf img{width:22px}.msx .v-tr .fs .v-pf img{height:22px;border-radius:6px;border-width:1.5px}
.msx .v-tr .fs .v-pf+.v-pf{margin-left:-5px}.msx .v-tr .fs .v-pf.tag{z-index:1}
.msx .v-tr .fs .v-pf.tag::after{font-size:10px;right:-4px;top:-6px}
.msx .v-tr .fs .no{font-size:10px;color:#64748b;font-weight:700;line-height:1.2;padding-bottom:3px}
.msx .v-tr .o{width:48px;height:48px;max-width:100%;border-radius:50%;margin:3px auto 0;background:linear-gradient(180deg,#3b4a66,#1e293b);border:2px solid #64748b;border-bottom-width:4px;display:flex;flex-direction:column;align-items:center;justify-content:center;font-size:17px;line-height:1;position:relative}
.msx .v-tr .o small{font-size:10px;font-weight:900;margin-top:2px;white-space:nowrap}
.msx .v-tr .o .lv{position:absolute;left:50%;bottom:-5px;transform:translateX(-50%);background:#0f172a;border:1px solid #94a3b8;border-radius:6px;font-size:10px;font-weight:900;padding:0 3px;line-height:1.4;font-style:normal;white-space:nowrap;z-index:2}
.msx .v-tr .x{font-size:10px;font-weight:900;color:#86efac;margin-top:1px;white-space:nowrap}
.msx .v-tr.tag .o{border-color:#fde047;background:linear-gradient(180deg,#6b5310,#3b2f0b);box-shadow:0 0 0 2px #fde04755,0 0 12px #fde047}
.msx .v-tr.tag .x{color:#fde047}
.msx .v-tr.sel .o{border-color:#fff;background:linear-gradient(160deg,#f472b6,#fb923c);box-shadow:0 0 0 2px #fde047,0 0 16px #f472b6;transform:translateY(-6px) scale(1.08)}
.msx .v-tr.sel .fs{transform:translateY(-5px)}
.msx .v-tr .tgb{position:absolute;left:50%;top:0;transform:translateX(-50%);background:linear-gradient(90deg,#fde047,#fb923c);color:#422006;border-radius:99px;padding:0 6px;font-size:10px;font-weight:900;white-space:nowrap;line-height:1.5;z-index:2;box-shadow:0 0 8px #fde047}
/* 下限は下の効き目パネル(.v-fx)の高さぶん空ける。カードを詰めて、最大の7枚(編成6人+助手)でもスクロールなしで全員が効き目パネルの上に収まるようにする(2026-11-18 あっくん「メンバーカードが切れる・スライドなしで全員表示」) */
.msx .v-come{position:absolute;right:6px;top:6px;width:44%;max-width:176px;display:flex;flex-direction:column;gap:2px;max-height:calc(100% - 88px)}
.msx .v-cm{display:flex;align-items:center;gap:5px;background:#0f0d24e6;border:1px solid #475569;border-radius:11px;padding:1px 5px;min-width:0}
.msx .v-cm .v-pf,.msx .v-cm .v-pf img{width:24px}.msx .v-cm .v-pf img{height:24px;border-radius:7px}
.msx .v-cm .v-pf .af{display:none}
.msx .v-cm .tx .r1{display:flex;align-items:baseline;gap:4px;min-width:0}
.msx .v-cm .tx .r1 b{flex:0 1 auto;min-width:0}
.msx .v-cm .tx .r1 small{display:inline;flex:none}
.msx .v-cm.tag{border-color:#fde047;background:linear-gradient(90deg,#3b2f0bf2,#0f0d24e6);box-shadow:0 0 10px #fde04788}
.msx .v-cm .tx{flex:1;min-width:0;line-height:1.1}
.msx .v-cm .tx b{display:block;font-size:10.5px;white-space:normal;overflow-wrap:anywhere;line-height:1.15} /* 名前は省略しない(API 点検 msx-T3・タッグ相手が「ウンディ…」で読めなかった) */
.msx .v-cm .tx small{display:block;font-size:10px;color:#86efac;font-weight:900;white-space:nowrap}
.msx .v-cm.tag .tx small{color:#fde047}
.msx .v-cm .afl small{display:inline!important;margin-right:2px}.msx .v-cm .afl{display:flex;align-items:center;gap:3px;font-size:10px;color:#cbd5e1;font-weight:900;white-space:nowrap}
.msx .v-cm .afl i{flex:1;height:5px;border-radius:3px;background:#334155;overflow:hidden;position:relative}
.msx .v-cm .afl i b{display:block;height:100%;background:linear-gradient(90deg,#38bdf8,#f472b6)}
.msx .v-cm.tag .afl i b{background:linear-gradient(90deg,#fde047,#fb923c)}
.msx .v-cm .afl i::after{content:'';position:absolute;left:80%;top:0;bottom:0;border-left:1px solid #fff}
.msx .v-fx{position:absolute;left:6px;bottom:6px;right:6px;background:#0f0d24ee;border:1px solid #fde047;border-radius:13px;padding:5px 8px 6px;box-shadow:0 0 14px #fde04755}
.msx .v-fx.plain{border-color:#475569;box-shadow:none}
.msx .v-fx .t{display:flex;align-items:center;gap:6px;font-size:11px;font-weight:900;white-space:nowrap}
.msx .v-fx .t .big{font-size:15px;color:#fde047;text-shadow:0 0 8px #fb923c}
.msx .v-fx .t .fl{margin-left:auto;font-size:10px;color:#cbd5e1}.msx .v-fx .t .fl b{color:#86efac;font-size:12px}.msx .v-fx .t .fl b.warn{color:#fca5a5}
.msx .v-fx .ch{display:flex;align-items:center;gap:3px;margin-top:4px;font-size:10px;font-weight:900;white-space:nowrap}
.msx .v-fx .ch span{background:#1e293b;border:1px solid #475569;border-radius:8px;padding:1px 6px;line-height:1.5}
.msx .v-fx .ch span.tgx{background:linear-gradient(90deg,#fde047,#fb923c);color:#422006;border-color:#0000}
.msx .v-fx .ch span.res{background:linear-gradient(90deg,#f472b6,#fb923c);border-color:#0000;font-size:11.5px}
.msx .v-fx .ch i{font-style:normal;color:#94a3b8}
.msx .v-burst{position:absolute;inset:0;background:repeating-conic-gradient(from 0deg at 50% 42%,#fde04740 0 8deg,#0000 8deg 16deg)}
.msx .v-burst.b2{background:repeating-conic-gradient(from 0deg at 50% 42%,#94a3b830 0 8deg,#0000 8deg 16deg)}
.msx .v-stamp{position:absolute;left:0;right:0;top:9%;text-align:center;font-size:54px;font-weight:900;letter-spacing:.06em;line-height:1;color:#fde047;-webkit-text-stroke:2px #9a3412;text-shadow:0 4px 0 #9a3412,0 0 26px #fb923c,0 0 50px #fde047;transform:rotate(-4deg);white-space:nowrap}
.msx .v-stamp small{display:block;font-size:13px;letter-spacing:0;-webkit-text-stroke:0;color:#fff;text-shadow:0 1px 0 #000;margin-top:8px;transform:rotate(4deg)}
.msx .v-stamp.ok{color:#fff;-webkit-text-stroke:2px #be185d;text-shadow:0 4px 0 #9d174d,0 0 18px #f472b6;font-size:46px}
.msx .v-stamp.ng{color:#cbd5e1;-webkit-text-stroke:2px #334155;text-shadow:0 4px 0 #1e293b;font-size:46px;transform:rotate(3deg)}
.msx .v-stamp.zz{color:#c4b5fd;-webkit-text-stroke:2px #4c1d95;text-shadow:0 4px 0 #4c1d95;font-size:46px;transform:rotate(-2deg)}
.msx .v-prop{position:absolute;font-size:64px;line-height:1;filter:drop-shadow(0 6px 4px #0008)}
.msx .v-log{background:#fff;color:#1e1b4b;border-radius:14px;padding:8px 12px;margin-top:6px;font-size:12.5px;font-weight:800;line-height:1.6;border:2px solid #f9a8d4}
.msx .v-log b.gu{color:#be185d}.msx .v-log b.gd{color:#1d4ed8}.msx .v-log b.ga{color:#c2410c}
.msx .v-log .hd2{font-size:10px;color:#be185d;font-weight:900}
.msx .v-res3{flex:1;min-height:0;display:flex;flex-direction:column;gap:6px;margin-top:6px}
.msx .v-res3 .v-scene{margin-top:0}
.msx .v-res3 .v-stamp{top:10%;font-size:34px!important;text-align:left;left:12px}
.msx .v-res3 .mon{height:70%;bottom:6%;left:76%}
.msx .v-res3 .cap{position:absolute;left:10px;bottom:7px;right:42%;background:#0f0d24e0;border-radius:10px;padding:4px 8px;font-size:10.5px;font-weight:800;line-height:1.4}
.msx .v-res3 .cap b{color:#fde047}
.msx .v-strip{position:absolute;left:-10%;right:-10%;top:16%;height:46%;background:linear-gradient(90deg,#f472b6,#fb923c);transform:rotate(-5deg);box-shadow:0 6px 0 #0005}
.msx .v-body2{position:absolute;left:50%;transform:translateX(-50%);height:62%;top:6%;object-fit:contain;filter:drop-shadow(0 6px 4px #0008)}
.msx .v-q{position:absolute;left:8px;right:8px;bottom:8px}
.msx .v-q .ask{background:#fff;color:#1e1b4b;border-radius:12px;padding:6px 10px;font-size:12.5px;font-weight:900;text-align:center;border:2px solid #f9a8d4}
.msx .v-q .bt{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-top:6px}
.msx .v-ch{background:linear-gradient(180deg,#fff,#fde7f3);color:#1e1b4b;border:2px solid #f472b6;border-bottom-width:4px;border-radius:13px;padding:6px 6px;text-align:center;font-size:13.5px;font-weight:900;line-height:1.25;min-width:0}
.msx .v-ch small{display:block;font-size:10px;font-weight:800;color:#9d174d;white-space:normal} /* 狭い画面では「・」のあとで折る(jaWrap。言葉の途中では折らない) */
.msx .v-ch.b{border-color:#38bdf8;background:linear-gradient(180deg,#fff,#e0f2fe)}.msx .v-ch.b small{color:#075985}
.msx .v-ch.n{grid-column:1/-1;background:#1e293b;color:#cbd5e1;border-color:#475569;font-size:11.5px;padding:4px}
.msx .v-pol{background:#1e1a36;border:1px solid #3b3566;border-radius:12px;padding:6px 9px;margin-top:6px}
.msx .v-pol .l{display:flex;justify-content:space-between;font-size:10px;color:#cbd5e1;font-weight:900;white-space:nowrap}
.msx .v-pol .m{display:grid;grid-template-columns:repeat(7,1fr);gap:2px;margin:3px 0}
.msx .v-pol .m i{height:9px;border-radius:3px;background:#334155}.msx .v-pol .m i.on{background:#fde047;box-shadow:0 0 8px #fde047}
.msx .v-pol .two{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:5px}
.msx .v-ev-h{position:absolute;left:0;top:8px;background:linear-gradient(90deg,#f472b6,#fb923c);border-radius:0 99px 99px 0;padding:3px 14px 3px 10px;font-size:11.5px;font-weight:900;white-space:nowrap}
.msx .v-ev-h small{display:block;font-size:10px;font-weight:800}
.msx .v-ev-h.k-story{background:linear-gradient(90deg,#f97316,#fb923c)}
.msx .v-ev-h.k-days{background:linear-gradient(90deg,#ec4899,#f472b6)}
.msx .v-ev-h.k-team{background:linear-gradient(90deg,#2563eb,#38bdf8)}
.msx .v-ev-h.k-ikusei{background:linear-gradient(90deg,#16a34a,#4ade80)}
.msx .v-ev-h.k-cup{background:linear-gradient(90deg,#b45309,#facc15)}
.msx .v-ev-h.k-issa{background:linear-gradient(90deg,#6d28d9,#a78bfa)}
.msx .msx-ev-tc{position:absolute;inset:0;z-index:6;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;pointer-events:none;background:radial-gradient(ellipse at center,#7c2d12cc,#0000 70%);animation:msxEvTc 1.6s ease-out both}
.msx .msx-ev-tc small{font-size:15px;font-weight:900;color:#fed7aa;letter-spacing:.1em}
.msx .msx-ev-tc b{font-size:40px;font-weight:900;color:#fff;text-shadow:0 3px 0 #c2410c,0 0 18px #fb923c}
@keyframes msxEvTc{0%{opacity:0;transform:scale(1.15)}15%{opacity:1;transform:scale(1)}70%{opacity:1}100%{opacity:0;visibility:hidden}}
@media (prefers-reduced-motion: reduce){.msx .msx-ev-tc{display:none}}
.msx .msx-ev-next{margin:6px 10px 0;padding:6px 12px;border-radius:12px;background:#fff7ed;border:2px solid #fdba74;color:#9a3412;font-size:13px;font-weight:900;text-align:center}
.msx .v-dots{position:absolute;right:8px;top:10px;background:#0f0d24d9;border-radius:99px;padding:2px 9px;font-size:10px;font-weight:900;white-space:nowrap}
.msx .v-dots i{display:inline-block;width:8px;height:8px;border-radius:50%;background:#475569;margin-left:3px}.msx .v-dots i.on{background:#fde047}
.msx .v-talk{position:absolute;left:8px;right:8px;bottom:8px;background:#fffdf5;color:#1e1b4b;border-radius:14px;border:2px solid #fb923c;padding:14px 12px 8px;font-size:12.5px;font-weight:800;line-height:1.55}
.msx .v-talk .who{position:absolute;left:10px;top:-11px;background:#fb923c;color:#fff;border-radius:8px;padding:1px 10px;font-size:11px;font-weight:900;white-space:nowrap}
.msx .v-opts{display:grid;gap:6px;margin-top:6px}
.msx .v-opt{background:#1e1a36;border:1.5px solid #f472b6;border-bottom-width:3px;border-radius:13px;padding:6px 10px;font-size:12.5px;font-weight:900;line-height:1.3}
.msx .v-opt small{display:block;font-size:10px;color:#86efac;font-weight:800}
.msx .v-clock{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;background:radial-gradient(circle at 50% 45%,#3b2f6b 0,#151130 70%)}
.msx .v-scene .v-clock{justify-content:flex-start;padding-top:7%;background:linear-gradient(180deg,#151130e6 0,#15113099 70%,#1511304d 100%)}
.msx .v-cal{width:190px;background:#fff;color:#1e1b4b;border-radius:16px;overflow:hidden;text-align:center;box-shadow:0 8px 0 #0006,0 0 30px #f472b666;transform:rotate(-3deg)}
.msx .v-cal .y{background:linear-gradient(90deg,#f472b6,#fb923c);color:#fff;font-size:12px;font-weight:900;padding:3px}
.msx .v-cal .mth{font-size:84px;font-weight:900;line-height:1.1}.msx .v-cal .mth small{font-size:20px}
.msx .v-cal .old{font-size:11px;color:#94a3b8;padding-bottom:6px;font-weight:800}
.msx .v-next{font-size:13px;font-weight:900;white-space:nowrap}.msx .v-next b{font-size:34px;color:#fde047;text-shadow:0 2px 0 #9a3412}.msx .v-next s{color:#94a3b8;font-size:18px;margin-right:4px}
.msx .v-steps{display:flex;align-items:center;gap:3px;margin-top:5px}
.msx .v-steps span{flex:none;width:22px;height:22px;border-radius:50%;background:#1e293b;border:1px solid #475569;color:#94a3b8;font-size:10.5px;font-weight:900;display:flex;align-items:center;justify-content:center}
.msx .v-steps span.ok{background:#3b3566;border-color:#f472b6;color:#f9a8d4}
.msx .v-steps span.on{flex:1;width:auto;border-radius:99px;background:linear-gradient(90deg,#f472b6,#fb923c);border-color:#0000;color:#fff;font-size:12px;white-space:nowrap;padding:0 8px}
.msx .v-steps u{flex:none;width:6px;height:2px;background:#475569;text-decoration:none}
.msx .v-h{font-size:15px;font-weight:900;margin-top:8px;line-height:1.3}.msx .v-h small{display:block;font-size:10.5px;color:#cbd5e1;font-weight:700}
.msx .v-card{background:#1e1a36;border:1px solid #3b3566;border-radius:14px;padding:8px;margin-top:6px;position:relative;min-width:0}
.msx .v-card.sel{border-color:#fde047;box-shadow:0 0 12px #fde04766}
.msx .v-card.pk{border-color:#f472b6aa}
.msx .v-gridw{flex:1 1 0;min-height:0;overflow-y:auto}
.msx .v-grid6{display:grid;grid-template-columns:repeat(6,1fr);gap:5px;margin-top:6px}
.msx .v-grid6 span{position:relative;display:block;min-width:0}
.msx .v-grid6 button{position:relative;display:flex;flex-direction:column;gap:2px;min-width:0;padding:0;background:none;border:0;color:inherit;font:inherit;text-align:center;cursor:pointer}
/* 升の正方形はスペーサー(padding-top:100%)で決める。aspect-ratio 任せだと、対応の弱い端末では升の高さが付かずに行が重なる(2026-11-16 実機スクショの対策をこの方式へ差し替え) */
.msx .v-grid6 .v-g6f{width:100%}
.msx .v-grid6 .v-g6f::before{content:'';display:block;padding-top:100%}
.msx .v-grid6 img{position:absolute;inset:0;width:100%;height:100%;border-radius:11px;object-fit:cover;background:#0f172a;border:2px solid #475569}
.msx .v-grid6 .v-g6n{font-size:9.5px;font-weight:800;color:#e2e8f0;white-space:nowrap;overflow:visible;letter-spacing:-.03em;line-height:1.3;transform:scaleX(.92)}
.msx .v-grid6 button.on .v-g6n{color:#fde047}
.msx .v-grid6 span.on img,.msx .v-grid6 button.on img{border-color:#fde047;box-shadow:0 0 10px #fde047aa}
.msx .v-grid6 span.lk img,.msx .v-grid6 button.lk img{filter:grayscale(1) brightness(.4)}
.msx .v-grid6 span.lk::after,.msx .v-grid6 button.lk::after{content:'🔒';position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:13px}
.msx .v-grid6 span.new::before,.msx .v-grid6 button.new::before{content:'合体';position:absolute;left:-2px;top:-5px;background:#a78bfa;color:#0f172a;font-size:10px;font-weight:900;border-radius:5px;padding:0 3px;z-index:1}
.msx .v-body.p1 .v-gridw{margin-top:2px;border-radius:12px;background:#0f0d2466;padding:0 4px}
.msx .v-p1sel{flex:none;display:flex;gap:8px;padding:7px;margin-top:6px}
.msx .v-p1art{position:relative;flex:0 0 31%;min-height:128px;border-radius:11px;overflow:hidden;background:#0f0d24;border:1px solid #4a4380}
.msx .v-p1art .bg{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:50% 80%}
.msx .v-p1art .mon{position:absolute;left:4%;right:4%;top:6%;bottom:3%;width:92%;height:91%;object-fit:contain;object-position:50% 100%;filter:drop-shadow(0 6px 4px #0009)}
.msx .v-p1info{flex:1;min-width:0;display:flex;flex-direction:column;gap:4px}
.msx .v-p1hd{display:flex;align-items:center;gap:6px}
.msx .v-p1hd .nm{flex:1;min-width:0;font-size:17px;font-weight:900;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.msx .v-p1grow{font-size:11px;line-height:1.35;color:#cbd5e1}
.msx .v-p1grow .k{display:inline-block;margin-right:5px;padding:0 6px;border-radius:6px;background:#2e2856;color:#f9a8d4;font-weight:900;font-size:10.5px}
.msx .v-p1grow b{margin-right:5px;font-size:12.5px}
.msx .v-p1grow .v{font-weight:700}
.msx .v-p1st{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:3px 8px}
.msx .v-p1st .r{display:grid;grid-template-columns:auto 1fr auto;align-items:center;column-gap:4px;min-width:0}
.msx .v-p1st .n{font-size:10.5px;color:#cbd5e1;font-weight:800;white-space:nowrap}
.msx .v-p1st b{font-size:14px;color:#fff;text-align:right;font-variant-numeric:tabular-nums}
.msx .v-p1st .g{font-style:normal;font-weight:900;font-size:12px;width:18px;height:18px;line-height:18px;text-align:center;border-radius:5px;background:#334155;color:#cbd5e1}
.msx .v-p1st .g.ghi{background:#facc15;color:#1f1300}.msx .v-p1st .g.gmd{background:#22c55e;color:#04210f}.msx .v-p1st .g.gmid{background:#475569;color:#f1f5f9}.msx .v-p1st .g.glo{background:#1e293b;color:#94a3b8}
.msx .v-p1st .bar{grid-column:1/-1;height:4px;border-radius:3px;background:#0f172a;overflow:hidden}
.msx .v-p1st .bar span{display:block;height:100%;border-radius:3px}
.msx .v-p1note{font-size:10px;color:#94a3b8;line-height:1.3}.msx .v-p1note b{color:#fde047}
.msx .v-p1main{flex:1 1 0;min-height:0;display:flex;flex-direction:column}
.msx .v-p1main>*{flex:none}
.msx .v-p1main>.v-gridw{flex:1 1 0;min-height:0}
.msx .v-p1bar>.msx-pt{margin-top:6px}
.msx .v-p1lg{font-style:normal}
.msx.land .v-body.p1>*{min-width:0}
/* 横: 左に選んだモンスター(立ち絵の上・名前と能力の下)、右に一覧。分類と検索は1行 */
.msx.land .v-body.p1{grid-template-columns:36% minmax(0,1fr);grid-template-rows:min-content 1fr}
.msx.land .v-body.p1>.v-p1main{grid-row:2}
.msx.land .v-body.p1>.v-p1sel{grid-column:1;grid-row:1/-1;margin-top:5px;min-height:0;flex-direction:column;gap:5px}
.msx.land .v-body.p1 .v-p1art{flex:1 1 0;min-height:60px}
.msx.land .v-body.p1 .v-p1info{flex:none}
.msx.land .v-body.p1 .v-h small{display:none}
.msx.land .v-p1bar{display:flex;gap:6px;align-items:center;margin-top:5px}
.msx.land .v-p1bar>.v-tabs{flex:0 1 auto;margin-top:0}
.msx.land .v-p1bar>.v-tabs button{padding:4px 10px}
.msx.land .v-p1bar>.msx-pt{flex:1 1 0;margin-top:0;flex-wrap:nowrap}
.msx.land .v-p1bar .msx-pt-c{display:none}
.msx.land .v-p1lg{display:none}
.msx .v-p1grow .v .w{white-space:nowrap}
.msx .v-body.p1.few .v-p1main{flex:none}
.msx .v-body.p1.few .v-p1main>.v-gridw{flex:none;overflow:visible}
.msx .v-body.p1.few>.v-p1sel{flex:1 1 0;min-height:0}
.msx .v-body.p1.few>.v-p1sel{flex-direction:column}
.msx .v-body.p1.few .v-p1art{flex:1 1 0;min-height:110px}
.msx .v-body.p1.few .v-p1info{flex:none}
.msx.land .v-body.p1.few .v-p1main{flex:1 1 0}
.msx .v-sum.v-s6team{display:block;padding:6px 8px 8px}
.msx .v-s6team .v-s6hd{display:flex;align-items:center;justify-content:space-between;margin-bottom:4px}
.msx .v-s6team .v-s6hd .ed{margin:-8px -4px -8px 0;min-height:36px;padding:0 4px;background:none;border:0;color:#7dd3fc;font:inherit;font-size:10px;font-weight:900}
.msx .v-s6team .mcd-grid.s{grid-template-columns:repeat(6,minmax(0,1fr))} /* 6体を1列に(札の作りは型のまま) */
/* 開始の段の横の共通の型(r1119 ⑦ U-5・U-7): 絵の無い段(助手・持ちこみ)は1列にして左を空けない。
   絵のある段(名前と染色・確認)は左に絵、右は見出しの下を流す(決めるボタンが画面の外に出ない) */
.msx .v-lmain{display:contents}
.msx.land .v-body.one{display:flex}
.msx.land .v-body.lg3{grid-template-rows:min-content min-content minmax(0,1fr)}
.msx.land .v-body.lg3>.v-lmain{display:flex;flex-direction:column;grid-row:3;min-height:0;overflow-y:auto;gap:0}
.msx.land .v-body.lg3>.v-lmain>*{flex:none}
.msx.land .v-body.lg3>.v-lmain>.v-card{max-height:none!important;overflow:visible!important}
.msx.land .v-body.lg3>.v-scene{min-height:0}
.msx.land .v-body.lg3>.v-lmain>.v-big{position:sticky;bottom:0;z-index:2;flex:none}
.msx .v-faces .v-soon1{flex:3;align-self:center;min-height:52px;display:flex;align-items:center;gap:6px;padding:4px 8px;border-radius:14px;border:1px dashed #64748b;background:#1e1a36;cursor:pointer}
.msx .v-faces .v-soon1 .fs{display:flex;flex:none}
.msx .v-faces .lk.soon.v-soon1 .fs img{filter:grayscale(1) brightness(.75);width:34px;height:34px;margin-left:-8px;border-width:1.5px}.msx .v-faces .v-soon1 .fs img:first-child{margin-left:0}
.msx .v-faces .lk.soon.v-soon1 b{position:static;flex:1;text-align:left;font-size:11px;font-weight:900;color:#cbd5e1;line-height:1.3;background:none;padding:0}
.msx .v-faces>button{flex:0 0 56px}
.msx .v-nobring{font-size:12px;line-height:1.5;color:#e2e8f0}.msx .v-nobring b{color:#fde047}
.msx .v-shopgo,.msx .v-allgo{display:flex;align-items:center;justify-content:center;text-align:center}
.msx .v-shopgo{margin-top:6px;min-height:44px;border-radius:12px;border:1.5px solid #f472b6;background:#3b1736;color:#fbcfe8;font:inherit;font-size:13px;font-weight:900}
.msx .v-allgo{margin-top:6px;min-height:44px;border-radius:10px;border:1px solid #475569;background:#0f172a;color:#cbd5e1;font:inherit;font-size:12px;font-weight:800}
.msx.land .v-body.one .v-bag{grid-template-columns:repeat(2,minmax(0,170px))}
.msx.land .v-body.one .v-bag div{aspect-ratio:auto;height:64px}
.msx.land .v-body.one .v-igrid{grid-template-columns:repeat(auto-fill,minmax(96px,1fr))}
.msx.land .v-body.one .v-faces>button{flex:0 0 52px}
.msx.land .v-body.one .v-faces .v-soon1{flex:0 1 280px}
.msx.land .v-body.one .v-sc .pic{width:150px;min-height:150px}
/* 小さい横(高さ340以下): 右の列は見出しから一覧までまとめて縦に流す(r1115-195 低い画面は1画面にこだわらない) */
@media (max-height:340px){
  .msx.land .v-body.p1>.v-p1main{overflow-y:auto}
  .msx.land .v-body.p1 .v-p1main>.v-gridw{flex:none;overflow:visible}
  .msx.land .v-body.p1 .v-p1bar{flex-wrap:wrap}
  .msx.land .v-body.p1 .v-p1bar>.v-tabs{flex:1 1 100%}
  .msx.land .v-body.p1 .v-p1note{display:none}
  .msx.land .v-body.p1 .v-p1st b{font-size:12.5px}
}
.msx .v-apt{display:grid;grid-template-columns:repeat(6,1fr);gap:3px;margin-top:6px;text-align:center;font-size:10px;font-weight:900}
.msx .v-apt div{background:#0f172a;border-radius:8px;padding:3px 0;white-space:nowrap;line-height:1.3}.msx .v-apt b{display:block;font-size:13px;color:#fde047}.msx .v-apt div.lo b{color:#94a3b8}
.msx .v-slots{display:grid;grid-template-columns:repeat(3,1fr);gap:5px;margin-top:6px}
.msx .v-sl{background:#0f172a;border:1px solid #475569;border-radius:12px;padding:6px 4px 5px;text-align:center;font-size:10.5px;font-weight:900;line-height:1.3;position:relative;min-width:0}
.msx .v-sl .v-pf{margin:0 auto 3px}
.msx .v-sl .t3{font-size:10px;color:#86efac;display:flex;flex-wrap:wrap;justify-content:center;column-gap:5px}.msx .v-sl .bs{font-size:10px;color:#cbd5e1;font-weight:700;display:flex;flex-wrap:wrap;justify-content:center;column-gap:5px}.msx .v-sl .t3>span,.msx .v-sl .bs>span{white-space:nowrap}
.msx .msx-sl-legend{font-size:10px;line-height:1.45;margin-top:4px;word-break:auto-phrase}.msx .v-sl .ic{font-size:10px;white-space:nowrap;letter-spacing:1px}
.msx .v-sl.fr{border-color:#38bdf8;background:#0c2a4a}.msx .v-sl.base{border-style:dashed}.msx .v-sl.base .t3{color:#94a3b8}
.msx .v-heat{display:grid;grid-template-columns:repeat(6,1fr);gap:3px;margin-top:5px;text-align:center;font-size:10px;font-weight:900}
.msx .v-heat div{border-radius:8px;padding:3px 0;background:#0f172a;white-space:nowrap;line-height:1.3}
.msx .v-heat div b{display:block;font-size:12px}
.msx .v-heat .x3{background:#be185d}.msx .v-heat .x2{background:#7c2d5e}
.msx .v-sc{display:flex;gap:8px;align-items:stretch}
.msx .v-sc .pic{flex:none;width:38%;position:relative;border-radius:12px;overflow:hidden;background:linear-gradient(160deg,#f472b6,#fb923c);min-height:230px}
.msx .v-sc .pic img{position:absolute;left:50%;transform:translateX(-50%);top:6px;height:150%;max-width:none}
.msx .v-sc .tx{flex:1;min-width:0;font-size:11px;line-height:1.45;font-weight:700}
.msx .v-sc .tx h4{margin:0;font-size:15px;font-weight:900;color:#fde047;line-height:1.25}
.msx .v-sc .tx h4 small{display:block;font-size:10px;color:#f9a8d4}
.msx .v-kv{display:flex;gap:6px;margin-top:4px;font-size:10.5px;line-height:1.4}.msx .v-kv>b{flex:none;width:58px;color:#f9a8d4;font-size:10px}
.msx .v-combo{flex:1;min-width:0;display:flex;flex-direction:column;gap:3px}
.msx .v-combo-r{display:flex;align-items:center;gap:4px;flex-wrap:wrap}
.msx .v-ctag{display:inline-flex;align-items:center;justify-content:center;text-align:center;border:1px solid #475569;border-radius:99px;padding:1px 7px;font-size:10.5px;font-weight:900;line-height:1.5;color:#cbd5e1;white-space:nowrap;background:#0f172a}
.msx .v-ctag.main{border-width:2px}
.msx .v-combo-a{color:#94a3b8;font-size:10px;font-weight:900}
.msx .v-faces{display:flex;gap:5px;margin-top:6px}
.msx .v-faces span,.msx .v-faces button{flex:1;min-width:0;position:relative}
.msx .v-faces img{width:100%;aspect-ratio:1;border-radius:50%;object-fit:cover;object-position:top;border:2px solid #475569;background:#312e5a}
.msx .v-faces span.on img,.msx .v-faces button.on img{border-color:#fde047;box-shadow:0 0 10px #fde047}
.msx .v-faces span.lk img,.msx .v-faces button.lk img{filter:grayscale(1) brightness(.4)}
.msx .v-item{display:flex;align-items:center;gap:8px;background:#0f172a;border:1px solid #475569;border-radius:12px;padding:6px 8px;margin-top:5px;font-size:11.5px;font-weight:900;line-height:1.3}
.msx .v-item .e{font-size:22px;flex:none;width:28px;text-align:center}.msx .v-item small{display:block;font-size:10px;color:#cbd5e1;font-weight:700}
.msx .v-item .pr{margin-left:auto;flex:none;font-size:10.5px;color:#fde047;white-space:nowrap}
.msx .v-item.sel{border-color:#fde047;background:#3b2f0b}
.msx .v-bag{display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin-top:6px}
.msx .v-bag div{aspect-ratio:1.5;border-radius:12px;border:2px dashed #64748b;display:flex;flex-direction:column;align-items:center;justify-content:center;font-size:24px;line-height:1.1}
.msx .v-bag div small{font-size:10px;font-weight:900;white-space:nowrap}
.msx .v-bag div.in{border:2px solid #fde047;background:#3b2f0b}
.msx .v-inp{background:#fff;color:#1e1b4b;border-radius:11px;padding:8px 12px;font-size:16px;font-weight:900;margin-top:5px;display:flex;justify-content:space-between;align-items:center}
.msx .v-inp small{font-size:10px;color:#94a3b8}
.msx .v-sw{display:flex;align-items:center;gap:5px;margin-top:6px;font-size:10.5px;font-weight:900}
.msx .v-sw>b{width:52px;flex:none}
.msx .v-sw i{flex:1;aspect-ratio:1;max-width:30px;border-radius:50%;border:2px solid #ffffff55}
.msx .v-sw i.on{border-color:#fff;box-shadow:0 0 0 2px #fde047}
.msx .v-sum{display:flex;align-items:center;gap:8px;background:#1e1a36;border:1px solid #3b3566;border-radius:12px;padding:6px 9px;margin-top:5px;font-size:11.5px;font-weight:900;line-height:1.35;min-width:0}
.msx .v-sum .k{min-width:46px;font-size:10px;color:#f9a8d4;flex:none;white-space:nowrap} /* 見出しは折らない(大きい文字で「持ちこ/み」になっていた) */
.msx .v-sum .ed{margin-left:auto;font-size:10px;color:#7dd3fc;flex:none}
.msx .v-big{display:block;margin-top:8px;border-radius:99px;padding:12px;text-align:center;font-size:16px;font-weight:900;background:linear-gradient(90deg,#f472b6,#fb923c);box-shadow:0 4px 0 #9d174d,0 0 18px #f472b688;white-space:nowrap}
.msx .v-issa{position:absolute;left:2%;bottom:-58%;height:150%;filter:drop-shadow(0 6px 6px #000a)}
.msx .v-machine{position:absolute;right:6%;bottom:8%;width:38%;aspect-ratio:.8;border-radius:20px 20px 10px 10px;background:linear-gradient(180deg,#475569,#1e293b);border:3px solid #94a3b8;box-shadow:0 0 30px #22d3ee88,inset 0 0 20px #22d3ee55;display:flex;flex-direction:column;align-items:center;justify-content:center;font-size:30px;line-height:1.2}
.msx .v-machine small{font-size:10px;font-weight:900;color:#a5f3fc;white-space:nowrap}
.msx .v-machine::before{content:'';position:absolute;left:14%;top:-9px;width:30%;height:10px;background:#d6b36a;transform:rotate(-8deg);border-radius:2px}
.msx .v-ibub{position:absolute;right:6px;top:8px;left:55%;background:#fff;color:#1e1b4b;border-radius:14px 14px 14px 3px;padding:7px 10px;font-size:12px;font-weight:800;line-height:1.5}
.msx .v-ibub b{color:#c2410c}
.msx .v-six{display:grid;grid-template-columns:1fr 1fr;gap:5px;margin-top:6px}
.msx .v-ix{background:#1e1a36;border:1.5px solid #64748b;border-bottom-width:3px;border-radius:13px;padding:5px 7px 5px;font-size:12.5px;font-weight:900;line-height:1.3;min-width:0;position:relative}
.msx .v-ix .ok,.msx .v-ix .ng{display:block;font-size:10px;font-weight:800;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.msx .v-ix .ok{color:#86efac}.msx .v-ix .ng{color:#fca5a5}
.msx .v-ix .pr{display:block;font-size:10px;color:#cbd5e1;font-weight:900;white-space:nowrap}
.msx .v-ix .pr i{display:inline-block;width:6px;height:6px;border-radius:50%;background:#334155;margin-left:2px}.msx .v-ix .pr i.on{background:#fde047}
.msx .v-ix.sel{border-color:#fde047;background:#3b2f0b;box-shadow:0 0 12px #fde04777}
.msx .v-ix.no{border-style:dashed;color:#cbd5e1}
.msx .v-rank{position:relative;border-radius:16px;overflow:hidden;margin-top:6px;border:1px solid #fde047;background:radial-gradient(circle at 28% 50%,#6b5310 0,#1e1a36 70%);display:flex;align-items:center;gap:8px;padding:8px 10px;min-height:118px}
.msx .v-rank .mon2{height:104px;aspect-ratio:1;object-fit:contain;flex:none;filter:drop-shadow(0 6px 4px #0008)}
.msx .v-rank .L{font-size:74px;font-weight:900;line-height:.95;color:#f472b6;-webkit-text-stroke:2px #fff;text-shadow:0 5px 0 #9d174d,0 0 30px #f472b6}
.msx .v-rank .tx{flex:1;min-width:0;line-height:1.3}
.msx .v-rank .tx small{display:block;font-size:10px;color:#f9a8d4;font-weight:900}
.msx .v-rank .tx b{font-size:24px;color:#fde047}
.msx .v-rec{display:grid;grid-template-columns:1fr 1fr;gap:5px;margin-top:5px}
.msx .v-rec div{background:#0f172a;border:1px solid #475569;border-radius:11px;padding:5px 8px;font-size:11px;font-weight:900;line-height:1.4;min-width:0}
.msx .v-rec small{display:block;font-size:10px;color:#f9a8d4}
.msx .v-pt{display:flex;align-items:center;gap:8px;background:linear-gradient(90deg,#3b2f0b,#1e1a36);border:1px solid #fde047;border-radius:14px;padding:6px 10px;margin-top:6px}
.msx .v-pt .n{font-size:10px;font-weight:900;color:#fde047;line-height:1.2;white-space:nowrap}.msx .v-pt .n b{display:block;font-size:26px;color:#fff;text-shadow:0 2px 0 #9a3412}
.msx .v-pt .r{flex:1;min-width:0;font-size:10px;font-weight:800;line-height:1.4}
.msx .v-pt .r .bar{height:7px;margin-top:3px}
.msx .v-as3{display:flex;flex-direction:column;gap:5px;margin-top:6px;flex:1 1 0!important;min-height:0;overflow-y:auto;-webkit-overflow-scrolling:touch}
.msx .v-a3{background:#1e1a36;border:1px solid #475569;border-radius:12px;padding:6px 8px;flex:0 0 auto}
.msx .v-a3.got{border-color:#fbbf24;background:#33270f}.msx .v-a3.dim{opacity:.45}
.msx .v-a3 .h{display:flex;align-items:center;gap:5px;text-align:left}.msx .v-a3 .nm{flex:1 1 auto;min-width:0;font-size:12.5px;font-weight:900;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.msx .v-a3 .rf{flex:0 0 auto;display:inline-block;width:auto;font-size:9px;font-weight:800;padding:1px 6px;border-radius:8px;background:#1d4ed8;color:#fff}.msx .v-a3 .rf.o{background:#7e22ce}
/* 横に流れる札の列は横にだけ動く(2026-11-15 社長 r1115-094「上のタブが上下にも動く」): 縦は隠す・指は横だけ・高さは中身に合わせる */
.msx .r3 .r3-bar.sc{flex-wrap:nowrap;overflow-x:auto;overflow-y:hidden;touch-action:pan-x;overscroll-behavior-x:contain;align-items:center;flex:0 0 auto;scrollbar-width:none;padding:4px 0;margin-top:2px;margin-bottom:-4px}/* 上下 4px = 札の押せる広さ(button::after 44px)が列の中に収まる分。外の間隔は前と同じ */.msx .r3 .r3-bar.sc::-webkit-scrollbar{display:none}.msx .r3 .r3-bar.sc .r3-chip{flex:0 0 auto}
.msx .v-a3 .val{flex:0 0 auto;min-width:54px;text-align:right;font-size:14px;color:#fde68a}
.msx .v-a3 .ex{font-size:11px;color:#cbd5e1;font-weight:700;text-align:left;margin:2px 0 4px;line-height:1.5}
.msx .v-a3 .ex b{color:#fff}
.msx .v-a3 .ex .exd{display:block;font-size:9.5px;color:#94a3b8;font-weight:700;margin-top:1px}
.msx .v-a3 .ctl{display:flex;align-items:center;gap:6px}.msx .v-a3 .ctl button:not(.chip){flex:0 0 34px;height:28px;border-radius:8px;border:1px solid #6d5fa6;background:#2f2550;color:#fff;font-size:16px;font-weight:900;text-align:center;padding:0}
.msx .v-a3 .ctl button:disabled{opacity:.35}
.msx .v-a3 .gauge{flex:1 1 auto;height:12px;border-radius:6px;background:#3a3054;position:relative;overflow:hidden;cursor:pointer}.msx .v-a3 .gauge i{position:absolute;left:0;top:0;bottom:0;background:linear-gradient(90deg,#f59e0b,#fde68a)}
.msx .v-a3 .gauge s{position:absolute;top:0;bottom:0;width:1px;background:rgba(15,10,30,.55)}
.msx .v-a3 .c{flex:0 0 46px;text-align:right;font-size:10.5px;font-weight:800;color:#fde68a}
.msx .v-a3 .ctl .chip.sym{flex:0 0 44px;width:44px;height:44px;padding:0;border-radius:12px;border:1.5px solid #6d5fa6;background:#2f2550;color:#fff} /* −/＋ を能力ポイントの画面と同じ 44px の押せる四角に(API 点検 r3-E2: 20px 前後で「⊂⊃」に見えた) */
.msx .v-a3 .ctl .chip.sym.plus{background:linear-gradient(180deg,#fde047,#f59e0b);border-color:#fde68a;color:#422006}
.msx .v-a3 .ctl .chip.sym::before{width:16px;height:16px;background-size:16px 3px}.msx .v-a3 .ctl .chip.sym.plus::before{background-size:16px 3px,3px 16px}
.msx .v-a3 .ctl .chip.sym::after{inset:0}
.msx .v-a3 .ctl .chip.sym:disabled{opacity:.3}
.msx .v-as{display:grid;grid-template-columns:1fr 1fr;grid-auto-rows:1fr;gap:5px;margin-top:6px;flex:1 1 0!important;min-height:0}
.msx .v-a{background:#1e1a36;border:1px solid #475569;border-radius:12px;padding:5px 6px 6px;min-width:0;position:relative;display:flex;flex-direction:column;justify-content:center}
.msx .v-a .nm{font-size:11.5px;font-weight:900;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.msx .v-a .ex{font-size:10px;color:#cbd5e1;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.msx .v-a .lv{display:grid;grid-template-columns:repeat(3,1fr);gap:3px;margin-top:4px}
.msx .v-a .lv span{background:#0f172a;border:1px solid #64748b;border-radius:8px;text-align:center;font-size:10px;font-weight:900;line-height:1.25;padding:2px 0;white-space:nowrap}
.msx .v-a .lv span b{display:block;font-size:11px;color:#fde047}
.msx .v-a .lv span.on{background:linear-gradient(160deg,#f472b6,#fb923c);border-color:#fde047}.msx .v-a .lv span.on b{color:#fff}
.msx .v-a .lv span.no{opacity:.35}
.msx .v-a.got{border-color:#fde047;background:#3b2f0b;box-shadow:0 0 8px #fde04755}
.msx .v-a.dim{opacity:.55}
.msx .v-a.wide{grid-column:1/-1}
.msx .v-pick{background:#0f172a;border:1px solid #f472b6;border-radius:12px;padding:5px 9px;margin-top:6px;font-size:10.5px;font-weight:800;line-height:1.5}
.msx .v-pick b{color:#fde047;white-space:nowrap} /* 取るものの1項目(名前と効き目)は途中で折らない。折るのは項目のあいだの「・」(r1115-197) */
.msx.land .v-body{display:grid;grid-template-columns:40% 1fr;grid-template-rows:repeat(7,min-content) 1fr;column-gap:8px;padding-bottom:6px}
.msx.land .v-body>*{grid-column:2}
.msx.land .v-body>.v-scene{grid-column:1;grid-row:1/-1;height:auto;margin-top:5px}
.msx.land .v-scene .mon{height:48%}
.msx.land .v-ft{height:34px}
.msx.land .v-come{width:50%}
@container (max-width:340px){
  .msx .v-hd .ti small{display:none}
  .msx .v-body{padding:0 7px 6px}
  .msx .v-hd{height:28px;padding:3px 7px 0}
  .msx .v-band{padding:5px 6px}
  .msx .v-turn .n b{font-size:24px}.msx .v-turn .ph{font-size:10px;padding:2px 5px}
  .msx .v-pow b{font-size:14px}.msx .v-pow .rk.big{height:24px;min-width:24px;font-size:14px}
  .msx .v-ga{font-size:10px;gap:3px}.msx .v-ga b{font-size:11px;width:45px}.msx .v-ga em{right:48px}.msx .v-ga .tr{margin-right:24px}.msx .v-ga .tr{height:11px}
  .msx .v-st b{font-size:12px}.msx .v-st small{font-size:10px}.msx .v-st em{font-size:10px;height:12px;line-height:12px}.msx .v-st div.up.main em{font-size:11px}.msx .v-st .vl{gap:1px}.msx .v-st .msx-srk{min-width:14px;height:14px;font-size:9px;padding:0 2px}.msx .v-st .br{gap:2px;margin:1px 3px 0}
  .msx .v-p{font-size:11px;padding:4px 1px 3px;border-radius:12px}.msx .v-p .e{font-size:16px}.msx .v-p small{font-size:10px}.msx .v-p.main{font-size:14px}
  .msx .v-ft{height:34px;padding:0 7px;gap:3px}.msx .v-ft span,.msx .v-ft button{font-size:10px;padding:4px 1px}.msx .v-ft span.go,.msx .v-ft span.go2,.msx .v-ft button.go,.msx .v-ft button.go2{font-size:11.5px}
  .msx .v-pf,.msx .v-pf img{width:24px}.msx .v-pf img{height:24px;border-radius:7px}
  .msx .v-party{gap:2px;padding:3px 4px}.msx .v-party>small{font-size:10px}
  .msx .v-say .fc{width:32px;height:32px}.msx .v-say .bub{font-size:10.5px;padding:4px 7px}
  .msx .v-chip,.msx .v-mini{font-size:10px;padding:1px 7px}
  .msx .v-nm{font-size:10.5px}
  .msx .v-tr .o{width:42px;height:42px;font-size:15px}.msx .v-tr .o small{font-size:10px}.msx .v-tr .x{font-size:10px}
  .msx .v-tr .fs .v-pf,.msx .v-tr .fs .v-pf img{width:19px}.msx .v-tr .fs .v-pf img{height:19px}
  .msx .v-tabs span,.msx .v-tabs button{font-size:10.5px;padding:4px 2px}
  .msx .v-cm{padding:3px 5px;gap:4px}.msx .v-cm .v-pf,.msx .v-cm .v-pf img{width:22px}.msx .v-cm .v-pf img{height:22px}
  .msx .v-cm .tx b{font-size:10px}.msx .v-cm .tx small{font-size:10px}
  .msx .v-fx{padding:4px 6px 5px}.msx .v-fx .t{font-size:10px}.msx .v-fx .t .big{font-size:13px}.msx .v-fx .ch{font-size:10px;gap:2px}.msx .v-fx .ch span{padding:1px 4px}.msx .v-fx .ch span.res{font-size:10px}
  .msx .v-a .nm{font-size:10.5px}.msx .v-a .ex{font-size:10px}.msx .v-a .lv span{font-size:10px}.msx .v-a .lv span b{font-size:10px}.msx .v-a{padding:4px 5px 5px}
  .msx .v-as{gap:4px;margin-top:4px}.msx .v-pt{padding:4px 8px}.msx .v-pt .n b{font-size:21px}.msx .v-pick{font-size:10px;padding:4px 7px;margin-top:4px}
  .msx .v-steps{margin-top:3px}
}
.msx .v-phs{display:flex;gap:3px;width:86%;margin-top:6px}
.msx .v-phs span{position:relative;min-width:46px;height:26px;border-radius:7px;background:#334155;overflow:hidden;display:flex;align-items:center;justify-content:center}
.msx .v-phs span i{position:absolute;left:0;top:0;bottom:0;background:linear-gradient(90deg,#f472b6,#fb923c)}
.msx .v-phs span b{position:relative;font-size:10px;font-weight:900;white-space:nowrap}
.msx .v-phs span.now{outline:2px solid #fde047}
.msx .v-eps{display:grid;grid-template-columns:1fr 1fr;gap:4px;margin-top:2px}
.msx .v-eps div{background:#0f172a;border:1px solid #475569;border-radius:9px;padding:3px 8px;font-size:10.5px;font-weight:800;white-space:nowrap;overflow:hidden}
.msx .v-eps div b{color:#fde047;margin-right:5px;font-size:10px}.msx .v-eps div.lk{color:#64748b;border-style:dashed}.msx .v-eps div.lk b{color:#64748b}
.msx.land .v-party .v-pf,.msx.land .v-party .v-pf img{width:24px}.msx.land .v-party .v-pf img{height:24px;border-radius:7px}
.msx.land .v-party{gap:3px}
.msx.s320 .v-party{display:grid;grid-template-columns:1fr 1fr;gap:3px 4px}.msx.s320 .v-party>small{grid-column:1/-1;text-align:center}
.msx.s320 .v-party .v-pf,.msx.s320 .v-party .v-pf img{width:22px}.msx.s320 .v-party .v-pf img{height:22px}
.msx.s320 .v-scene{--mb:37%}.msx.s320 .v-scene .mon{height:42%}
.msx.s320 .v-scene.sm{height:32px}
.msx.s320 .v-grid6 .v-g6n{transform:scaleX(.86)}
.msx.s320 .v-h small{font-size:9.5px}
.msx.s320 .v-chips .bad{display:none}.msx.s320 .v-side{bottom:48px}
.msx.s320 .v-yousu{bottom:auto;top:52px;left:auto;right:7px;transform:none}
.msx .v-scene.low{flex:0 0 220px}
.msx .v-cups{display:flex;flex-direction:column;gap:6px;margin-top:6px;flex:1 1 0!important;min-height:0;justify-content:flex-start;overflow-y:auto}
.msx .v-cup{display:flex;align-items:center;gap:8px;background:#1e1a36;border:1.5px solid #475569;border-bottom-width:3px;border-radius:14px;padding:6px 9px;position:relative;min-width:0}
.msx .v-cup .e{font-size:26px;flex:none;width:34px;text-align:center}
.msx .v-cup .tx{flex:1;min-width:0;line-height:1.3}.msx .v-cup .tx b{display:block;font-size:13.5px;white-space:nowrap}
.msx .v-cup .tx small{display:block;font-size:10px;color:#86efac;font-weight:800;white-space:nowrap}.msx .v-cup .tx .rw{display:block;font-size:10px;color:#cbd5e1;font-weight:700;white-space:nowrap}
.msx .v-cup .rt{flex:none;text-align:right;line-height:1.3}.msx .v-cup .rt span{display:block;white-space:nowrap}
.msx .v-cup .st{font-size:14px;color:#fde047;text-shadow:0 1px 0 #9a3412}.msx .v-cup .g{font-size:12px;font-weight:900}.msx .v-cup .kd{font-size:10px;color:#f9a8d4;font-weight:900}
.msx .v-cup.sel{border-color:#fde047;background:#3b2f0b;box-shadow:0 0 12px #fde04766}
.msx .v-cup.rv{border-color:#f87171;background:linear-gradient(90deg,#3b1220,#1e1a36)}.msx .v-cup.rv .tx small{color:#fca5a5}
.msx .v-cup .rvb{position:absolute;right:8px;top:-8px;background:linear-gradient(90deg,#ef4444,#fb923c);border-radius:99px;padding:0 8px;font-size:10px;font-weight:900;line-height:1.6;white-space:nowrap}
.msx .v-cup.ng{opacity:.55;border-style:dashed}
.msx .v-cup .e .gr{position:absolute;left:2px;bottom:-2px;font-size:8.5px;font-weight:900;border-radius:5px;padding:0 3px;color:#1e1b4b;background:#cbd5e1;letter-spacing:0}
.msx .v-cup .e .gr.g-bronze{background:#d9a066}.msx .v-cup .e .gr.g-silver{background:#cbd5e1}.msx .v-cup .e .gr.g-gold{background:#fde047}
.msx .v-cup .e .gr.g-green{background:#86efac}.msx .v-cup .e .gr.g-four{background:#c4b5fd}.msx .v-cup .e .gr.g-rainbow{background:linear-gradient(90deg,#fda4af,#fde047,#86efac,#93c5fd);color:#1e1b4b}
.msx .v-cup.ex .e{position:relative}
.msx .v-cup.ex.g-four{border-color:#a78bfa}.msx .v-cup.ex.g-gold{border-color:#fde047}.msx .v-cup.ex.g-rainbow{border-color:#fda4af}
.msx .v-cup.hard .tx small{color:#fca5a5}
/* 大会の受付(2026-11-13 作り直し): 賞金の帯・月の切り替え・大きな札・確認の窓 */
.msx .v-cupbar{display:flex;align-items:center;gap:8px;margin-top:6px;background:linear-gradient(90deg,#3b2f0b,#1e1a36);border:1px solid #a16207;border-radius:10px;padding:4px 10px;font-size:11px;font-weight:900;color:#fde68a}
.msx .v-cupbar b{margin-left:auto;font-size:17px;color:#fde047;text-align:right}.msx .v-cupbar b small{font-size:11px;margin-left:1px}.msx .v-cupbar i{font-style:normal;font-size:10px;background:#0f172a;border-radius:6px;padding:1px 6px;color:#e2e8f0}
.msx .v-cupmon{display:flex;align-items:center;gap:6px;margin-top:5px}
.msx .v-cupmon b{flex:1;text-align:center;font-size:13px;font-weight:900}.msx .v-cupmon b small{margin-left:6px;font-size:10px;border-radius:6px;padding:1px 6px;background:#334155;color:#cbd5e1}.msx .v-cupmon b small.now{background:#f472b6;color:#fff}
.msx .v-cupmon .ar{width:44px;min-height:30px;border-radius:9px;background:#1e293b;border:1px solid #475569;color:#fde047;font-size:13px;text-align:center}
.msx .v-cup2{align-items:stretch;padding:6px 8px;min-height:66px;flex:none}
.msx .v-cup2 .lg{flex:none;width:66px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;background:#0f172a;border-radius:10px;padding:3px 0}
.msx .v-cup2 .lg .e{font-size:26px;line-height:1}
.msx .v-cup2 .fcst{display:block;width:auto;height:auto;font-size:9px;letter-spacing:-.02em;font-weight:900;border-radius:5px;padding:0 4px;white-space:nowrap;text-align:center;line-height:1.5}
.msx .v-cup2 .fcst.fc-e{background:#86efac;color:#14532d}.msx .v-cup2 .fcst.fc-g{background:#bef264;color:#365314}.msx .v-cup2 .fcst.fc-v{background:#fde047;color:#713f12}.msx .v-cup2 .fcst.fc-h{background:#fdba74;color:#7c2d12}.msx .v-cup2 .fcst.fc-n{background:#ef4444;color:#fff}
.msx .v-cup2 .tx{flex:1;min-width:0;display:flex;flex-direction:column;justify-content:center;gap:1px;text-align:left}
.msx .v-cup2 .tx .hd{display:flex;align-items:center;gap:4px;font-size:9.5px;font-weight:900;height:16px;line-height:16px}.msx .v-cup2 .tx .hd>span{display:inline-block;height:auto;line-height:1.5}
.msx .v-cup2 .tx .hd .gr2{background:#475569;border-radius:5px;padding:0 5px;color:#fff}.msx .v-cup2.g-gold .gr2{background:#ca8a04}.msx .v-cup2.g-silver .gr2{background:#64748b}.msx .v-cup2.g-green .gr2{background:#16a34a}.msx .v-cup2.g-four .gr2{background:#7c3aed}.msx .v-cup2.g-rainbow .gr2{background:linear-gradient(90deg,#f43f5e,#eab308,#22c55e,#3b82f6)}
.msx .v-cup2 .tx .hd .cs{color:#fde047;font-size:11px}.msx .v-cup2 .tx .hd .dn{margin-left:auto;background:#fde047;color:#422006;border-radius:5px;padding:0 5px}
.msx .v-cup2 .tx>b{font-size:13.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.msx .v-cup2 .tx .g{display:block;font-size:18px;font-weight:900;color:#fde047;text-align:right;line-height:1.1}.msx .v-cup2 .tx .g small{display:inline;font-size:11px;margin-left:1px;color:#fde047}
.msx .v-cup2.ng{opacity:1;background:#14121f;border-color:#334155}.msx .v-cup2.ng .lg,.msx .v-cup2.ng .tx>b,.msx .v-cup2.ng .tx .hd,.msx .v-cup2.ng .tx .g{opacity:.45}.msx .v-cup2.later{filter:saturate(.7)}
.msx .v-cup2 .why{display:block;color:#fca5a5;font-size:10.5px;font-weight:900;line-height:1.3;white-space:normal}
.msx .v-cup2 .ok{display:block;color:#86efac;font-size:10.5px;font-weight:900;line-height:1.3}
/* 大会カードのライバルの行: 持ち主のアイコン+モンスター+名前を流れの中で読めるように(2026-11-16 UI改修) */
.msx .v-cup2 .rvl{display:flex;align-items:center;gap:4px;font-size:11px;font-weight:900;color:#fda4af;line-height:1.3;min-width:0}
.msx .v-cup2 .rvl img{width:20px;height:20px;border-radius:50%;object-fit:cover;object-position:50% 20%;background:#1e1a36;flex:none}
.msx .v-cup2 .rvl b{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.msx .v-cup2 .rvl{flex-wrap:wrap}
.msx .v-cup2 .rvl small{max-width:100%;font-size:10px;color:#cbd5e1;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.msx .v-cupwin{position:absolute;inset:0;z-index:40;background:#0009;display:flex;align-items:center;justify-content:center;padding:16px}
.msx .v-cupwin .in{position:relative;width:100%;max-width:360px;background:#fffbeb;color:#1e1b4b;border-radius:16px;border:3px solid #f59e0b;padding:10px 12px 12px;box-shadow:0 8px 0 #0006}
.msx .v-cupwin .h{text-align:center;font-weight:900;font-size:14px;background:#f59e0b;color:#fff;border-radius:10px;padding:3px 0;margin:-2px -2px 8px}
/* 大会参加確認の窓は画面の高さを超えない(中だけ送る)。ボタンの段は下に貼り付ける(2026-11-20 r1119-013 ⑥ API 点検 #4)。
   横向けの並びは作らない(2026-11-20 社長: モンサクの横向きはいったん非対応) */
.msx .v-body>.v-cupwin{position:fixed;inset:0}
.v-cupwin{padding:max(10px,env(safe-area-inset-top)) 12px max(10px,env(safe-area-inset-bottom))}
.v-cupwin .in{max-height:100%;overflow-y:auto;overscroll-behavior:contain}
.v-cupwin .in>.bt{position:sticky;bottom:-12px;z-index:2;margin-bottom:-12px;padding-bottom:12px;background:#fffbeb;box-shadow:0 -10px 10px -4px #fffbeb}
.msx .v-cupwin .sign{display:flex;flex-direction:column;align-items:center;gap:2px;background:linear-gradient(180deg,#1e1a36,#3b3566);color:#fff;border-radius:12px;padding:8px 6px;text-align:center}
.msx .v-cupwin .sign .e{font-size:40px;line-height:1}.msx .v-cupwin .sign b{font-size:15px}.msx .v-cupwin .sign small{font-size:10.5px;color:#fde68a}
.msx .v-cupwin .sign.g-four{background:linear-gradient(180deg,#2e1065,#6d28d9)}.msx .v-cupwin .sign.g-rainbow{background:linear-gradient(180deg,#7f1d1d,#a16207)}
.msx .v-cupwin .sub{margin-top:8px;font-size:11px;font-weight:900;color:#92400e;text-align:left}
.msx .v-cupwin .pz button{display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center}
.msx .v-cupwin .pz{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:5px;padding:4px 0}
.v-cupwin .pzg{display:flex;align-items:center;gap:8px;margin-top:4px;background:#fff;border:2px solid #fcd34d;border-radius:10px;padding:4px 10px;font-weight:900;width:100%;text-align:left;color:#1e1b4b}
.v-cupwin .pzg i{font-style:normal;font-size:11px;background:#78350f;color:#fde68a;border-radius:6px;padding:1px 8px}
.v-cupwin .pzg b{font-size:18px;margin-left:auto}
.v-cupwin .pz button.pt{background:#eef2ff;border-color:#c7d2fe}
.msx-kp{word-break:keep-all;overflow-wrap:anywhere;line-break:strict}
.msx .v-cupwin .pz button{min-width:0;display:flex;flex-direction:column;align-items:center;gap:2px;background:#fff;border:2px solid #e5e7eb;border-radius:10px;padding:4px 2px;text-align:center}
.msx .v-cupwin .pz button span{font-size:24px;line-height:1}.msx .v-cupwin .pz button small{font-size:9.5px;font-weight:900;line-height:1.2;color:#1e1b4b}
.msx .v-cupwin .pz button.rare{border-color:transparent;background:linear-gradient(#fff,#fff) padding-box,linear-gradient(90deg,#f43f5e,#eab308,#22c55e,#3b82f6,#a855f7) border-box}
.msx .v-cupwin .q{margin-top:8px;text-align:center;font-weight:900;font-size:13px}.msx .v-cupwin .q.ng{color:#dc2626;font-size:12px}
.msx .v-cupwin .bt{display:flex;gap:8px;margin-top:8px}
.msx .v-cupwin .bt button{flex:1;min-height:40px;border-radius:99px;background:#e5e7eb;color:#1e1b4b;font-weight:900;font-size:13.5px;text-align:center}
.msx .v-cupwin .bt button.go{background:linear-gradient(90deg,#fb923c,#f97316);color:#fff}
.msx .v-cupwin .det{position:absolute;inset:0;background:#0007;border-radius:14px;display:flex;align-items:center;justify-content:center;padding:12px}
.msx .v-cupwin .dbox{background:#fff;border-radius:12px;padding:10px;text-align:center;width:100%;border:2px solid #f59e0b}
.msx .v-cupwin .dbox .e{font-size:38px}.msx .v-cupwin .dbox b{display:block;font-size:14px}.msx .v-cupwin .dbox p{font-size:11.5px;margin:4px 0 8px;text-align:left;line-height:1.45}
.msx .v-cupwin .dbox button{min-height:36px;width:100%;border-radius:99px;background:#e5e7eb;font-weight:900;text-align:center}
.msx .v-cupwin .dbox .own{display:flex;align-items:center;gap:6px;font-size:11px;font-weight:900;color:#1e1b4b;margin:0 0 8px;text-align:left}.msx .v-cupwin .dbox .own i{font-style:normal;background:#92400e;color:#fff;border-radius:99px;padding:2px 10px}.msx .v-cup.ng .tx small{color:#fca5a5}
.msx .v-vsh{display:flex;align-items:center;gap:4px;margin-top:6px;border-radius:16px;overflow:hidden;border:1px solid #4a4380;background:linear-gradient(100deg,#9d174d 0,#3b2a6b 49%,#0f0d24 50%,#1e3a8a 100%);padding:6px 6px;min-height:104px}
.msx .v-vsh .sd{flex:1;min-width:0;display:flex;align-items:center;gap:4px;line-height:1.3}.msx .v-vsh .sd.op{justify-content:flex-end;text-align:right}
.msx .v-vsh .sd img{height:70px;aspect-ratio:1;object-fit:contain;flex:none;filter:drop-shadow(0 5px 3px #0008)}.msx .v-vsh .sd.op img{transform:scaleX(-1)}
.msx .v-vsh .sd small{display:block;font-size:10px;color:#fde047;font-weight:900}.msx .v-vsh .sd b{display:block;font-size:14px;white-space:nowrap}.msx .v-vsh .sd span{display:block;font-size:10px;font-weight:800;white-space:nowrap}
.msx .v-vsh .vsm{flex:none;font-size:26px;font-weight:900;color:#fde047;text-shadow:0 3px 0 #9a3412,0 0 14px #fb923c;text-align:center;line-height:1}.msx .v-vsh .vsm small{display:block;font-size:10px;color:#fff;text-shadow:none;margin-top:3px}
.msx .v-vs1{display:grid;grid-template-columns:46px 1fr 70px 1fr 46px;align-items:center;gap:5px;font-size:10.5px;font-weight:900}
.msx .v-vs1 span{text-align:center;white-space:nowrap}.msx .v-vs1 b{font-size:13px;text-align:center;color:#cbd5e1;white-space:nowrap}.msx .v-vs1 b.w{color:#fde047}.msx .v-vs1 b .msx-srk{font-size:10px;margin:0 1px}
.msx .v-vs1 i{height:10px;border-radius:99px;background:#0b0920;border:1px solid #475569;position:relative;overflow:hidden}
.msx .v-vs1 i u{position:absolute;top:0;bottom:0;text-decoration:none}
.msx .v-vs1 i.l u{right:0;background:linear-gradient(270deg,var(--bc,#f472b6),var(--bc,#fb923c))}.msx .v-vs1 i.r u{left:0;background:linear-gradient(90deg,var(--bc,#38bdf8),var(--bc,#6366f1))}
.msx .v-vs1 i.p{height:7px}
.msx .v-dist{display:grid;grid-template-columns:1fr 70px 1fr;align-items:center;gap:5px;font-size:10.5px;font-weight:900;text-align:center}
.msx .v-dist div{display:flex;gap:3px;justify-content:center}
.msx .v-dist i{font-style:normal;width:24px;height:22px;border-radius:7px;display:flex;align-items:center;justify-content:center;font-size:11px;background:#1e293b;color:#64748b}
.msx .v-dist i.a1{background:#3b2a52;color:#cbd5e1}.msx .v-dist i.a2{background:#9d174d;color:#fff}.msx .v-dist i.a3{background:#fde047;color:#422006;box-shadow:0 0 8px #fde047}
.msx .v-bracket{display:flex;align-items:center;justify-content:center;gap:5px;margin-top:6px;font-size:10px;font-weight:900;white-space:nowrap}
.msx .v-bracket span{background:#1e293b;border:1px solid #475569;border-radius:8px;padding:2px 8px}.msx .v-bracket span.me{border-color:#fde047;color:#fde047}
.msx .v-bracket em{font-style:normal;color:#94a3b8;font-size:10px}.msx .v-bracket u{text-decoration:none;color:#f9a8d4;font-size:10px;margin:0 4px}
.msx .v-scene.home .mon{height:34%}.msx .v-scene.home .gr{width:24%}
.msx.land .v-scene.home .mon{height:40%}.msx.s320 .v-scene.home .mon{height:36%}
.msx .v-meal{position:absolute;left:8px;right:8px;bottom:8px;background:#151130f2;border:1.5px solid #fde047;border-radius:16px;padding:8px 9px;box-shadow:0 0 18px #fde04766}
.msx .v-meal .t{font-size:13px;font-weight:900;text-align:center;line-height:1.35}.msx .v-meal .t small{display:block;font-size:10px;color:#cbd5e1;font-weight:700}
.msx .v-meal .ms{display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin-top:6px}
.msx .v-ml{background:#1e1a36;border:1.5px solid #64748b;border-bottom-width:3px;border-radius:13px;padding:6px 3px;text-align:center;line-height:1.3;min-width:0}
.msx .v-ml .e{font-size:30px;line-height:1.1}.msx .v-ml b{display:block;font-size:11.5px;white-space:nowrap}
.msx .v-ml .g{display:block;font-size:11px;color:#fde047;font-weight:900}.msx .v-ml small{display:block;font-size:10px;color:#86efac;font-weight:800}
.msx .v-ml.sel{border-color:#fde047;background:#3b2f0b;box-shadow:0 0 12px #fde04788}
.msx .v-sayrow{display:flex;align-items:center;gap:6px;margin-top:5px}
.msx .v-sayrow .fc{width:34px;height:34px;border-color:#f9a8d4}
.msx .v-sayrow .bub{flex:1;min-width:0;font-size:11.5px;padding:5px 9px;line-height:1.35;border-radius:3px 12px 12px 12px}.msx .v-sayrow .bub em{font-style:normal;color:#be185d}
.msx .v-bagb{position:absolute;left:7px;bottom:7px;width:46px;height:46px;border-radius:14px;background:#0f0d24e0;border:1.5px solid #fde047;display:flex;flex-direction:column;align-items:center;justify-content:center;font-size:20px;line-height:1.05}
.msx .v-bagb small{font-size:10px;font-weight:900;white-space:nowrap}
.msx .v-bagb i{position:absolute;right:-5px;top:-6px;background:#ef4444;border-radius:99px;font-style:normal;font-size:10px;font-weight:900;min-width:16px;text-align:center;line-height:16px}
.msx .v-bagb.r{left:auto;right:7px;border-color:#64748b}
.msx .v-scene.home{--mb:20%}.msx .v-scene.home .v-side{bottom:60px}
.msx.s320 .v-scene.home{--mb:24%}.msx.s320 .v-bagb{width:38px;height:38px;font-size:16px;border-radius:11px}.msx.s320 .v-bagb small{font-size:10px}
.msx.s320 .v-scene.home .v-side{bottom:50px}.msx.s320 .v-sayrow .fc{width:28px;height:28px}.msx.s320 .v-sayrow .bub{font-size:10px;padding:3px 7px}
.msx .v-stg{display:flex;align-items:stretch;gap:4px;margin-top:6px}
.msx .v-stg div{flex:1;min-width:0;background:#1e1a36;border:1px solid #fb923c;border-radius:11px;padding:4px 4px;text-align:center;font-size:10.5px;font-weight:900;white-space:nowrap;line-height:1.35}
.msx .v-stg div small{display:block;font-size:10px;color:#fdba74}.msx .v-stg i{align-self:center;font-style:normal;color:#94a3b8;font-size:10px}
.msx .v-stg div.last{flex:.7;border-color:#fde047;background:#3b2f0b}.msx .v-stg div.last small{color:#fde047}
.msx .v-pick2{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-top:4px}
.msx .v-pick2 div{background:#3b2f0b;border:1.5px solid #fde047;border-radius:11px;padding:5px 8px;font-size:12px;font-weight:900;white-space:nowrap;display:flex;align-items:center;gap:5px;min-width:0}
.msx .v-pick2 small{background:#fde047;color:#422006;border-radius:6px;padding:0 5px;font-size:10px}.msx .v-pick2 b{margin-left:auto;color:#fde047}.v-pick2 div.none{grid-column:1/-1;justify-content:center;background:#1e1a36;border-style:dashed;border-color:#64748b;color:#cbd5e1;font-size:11px}
.msx .v-tk{display:flex;align-items:center;gap:5px}
.msx .v-tk>i{flex:none;width:24px;height:24px;border-radius:7px;background:#9d174d;font-style:normal;font-size:11.5px;font-weight:900;display:flex;align-items:center;justify-content:center}
.msx .v-tk span{flex:1;min-width:0;background:#0f172a;border:1px solid #475569;border-radius:9px;padding:4px 7px;font-size:10.5px;font-weight:900;white-space:nowrap;display:flex;justify-content:space-between;gap:4px}
.msx .v-tk span b{color:#86efac}.msx .v-tk span.sel{border-color:#fde047;background:#3b2f0b}.msx .v-tk span.sel b{color:#fde047}.msx .v-tk span.got{opacity:.45}.msx .v-tk span.got b{color:#94a3b8}
.msx .v-bagw{position:absolute;left:8px;right:8px;top:8px;bottom:8px;background:#151130f5;border:1.5px solid #fde047;border-radius:16px;padding:8px 9px;display:flex;flex-direction:column;justify-content:space-evenly;justify-content:safe space-evenly;gap:6px;overflow-y:auto;box-shadow:0 0 18px #fde04755}
.msx .v-bagw .t{font-size:14px;font-weight:900;line-height:1.3;position:relative;padding-right:40px;flex:none}
.msx .v-bagw .t button{position:absolute;right:-14px;top:-14px;width:44px;height:44px;display:flex;align-items:center;justify-content:center;background:transparent;border:0}.msx .v-bagw .t small{display:block;font-size:10px;color:#fca5a5;font-weight:800}
.msx .v-bagw .t i{position:static;width:24px;height:24px;border-radius:50%;background:#2b3348;font-style:normal;font-size:12px;display:flex;align-items:center;justify-content:center}
.msx .v-bagw .v-item{margin-top:0}
.v-bagw .v-bgrid{flex:none;align-content:start;grid-auto-rows:max-content;padding:2px 1px}
.v-bagw > *{flex-shrink:0}
.msx .v-trs{gap:4px;margin-top:8px;align-items:start}
.msx .v-tr{padding-top:0}
.msx .v-tr .o{width:50px;height:50px;font-size:23px;margin:0 auto}
.msx .v-tr .nm{display:block;font-size:10.5px;font-weight:900;margin-top:7px;white-space:nowrap}
.msx .v-tr .tn{display:block;font-size:10px;font-weight:800;color:#fde68a;white-space:normal;word-break:keep-all;overflow-wrap:normal;line-height:1.15;min-height:2.3em;padding:0 1px;text-align:center}
.msx .v-tr.tag .o{box-shadow:0 0 0 2px #fde04788,0 0 14px 3px #fde047,0 0 24px 6px #fb923c88}
.msx .v-tr.tag .nm{color:#fde047}
.msx .v-tr.sel .o{transform:translateY(-8px) scale(1.18)}
.msx .v-tr .o{transition:transform .14s ease-out,box-shadow .14s}
.msx .v-tr:not(.sel) .o{transform:translateY(2px) scale(.96)}
.msx .v-trs{position:relative;padding-top:17px;padding-bottom:12px;touch-action:pan-y}
.msx .v-tr .tn.one{white-space:nowrap;letter-spacing:-.06em;margin:0 -4px;display:flex;align-items:flex-start;justify-content:center}
.msx .v-tr .fb{position:absolute;left:50%;top:-17px;transform:translateX(-50%);background:#fff;color:#7f1d1d;border-radius:8px;padding:1px 6px;font-size:10px;font-weight:900;white-space:nowrap;line-height:1.4;z-index:3;box-shadow:0 1px 4px #0006}
.msx .v-tr .fb::after{content:'';position:absolute;left:50%;bottom:-4px;margin-left:-4px;border:4px solid transparent;border-bottom:0;border-top-color:#fff}
.msx .v-tr .ke{position:absolute;left:50%;bottom:-13px;transform:translateX(-50%);color:#fde047;font-size:11px;font-weight:900;text-shadow:0 1px 2px #000;white-space:nowrap}
.msx .v-trail{position:absolute;left:0;top:0;pointer-events:none;z-index:4;opacity:.85;filter:drop-shadow(0 0 2px #fff8)}
.msx .v-trail.out{opacity:0;transition:opacity .5s ease-out}
.msx .v-tr.sel .nm{color:#fff}
.msx .v-lvx{display:flex;align-items:center;gap:6px;margin-top:5px;font-size:10px;font-weight:900;white-space:nowrap}
.msx .v-lvx b{color:#7dd3fc}.msx .v-lvx i{flex:1;height:6px;border-radius:4px;background:#334155;position:relative;overflow:hidden}
.msx .v-lvx i u{position:absolute;left:0;top:0;bottom:0;background:#38bdf8}.msx .v-lvx i u.ad{background:#bae6fd}
.msx .v-lvx span{color:#cbd5e1}.msx .v-lvx em{font-style:normal;color:#fde047}
.msx .v-lvup{background:linear-gradient(90deg,#fde047,#fb923c);color:#422006;border-radius:10px;padding:4px 10px;margin-bottom:5px;font-size:13px;font-weight:900;line-height:1.35;box-shadow:0 0 12px #fde047}
.msx .v-lvup small{display:block;font-size:10px;font-weight:800}
.msx .v-p.main small{font-size:10px;margin-top:2px}
.msx .v-cup.won .tx small{color:#fde047}
.msx .v-ft span.off,.msx .v-ft button.off{opacity:.45}
.msx .v-rm{display:grid;grid-template-columns:1.25fr 1fr;gap:6px;margin-top:7px}
.msx .v-rm div{background:#1e293b;border:1.5px solid #64748b;border-bottom-width:3px;border-radius:13px;padding:8px 5px;text-align:center;font-size:13.5px;font-weight:900;line-height:1.3;min-width:0}
.msx .v-rm div small{display:block;font-size:10px;font-weight:800;color:#cbd5e1;margin-top:2px}
.msx .v-rm div.re{background:linear-gradient(160deg,#38bdf8,#6366f1);border-color:#bae6fd;box-shadow:0 0 12px #38bdf888}.msx .v-rm div.re small{color:#fff}
@container (max-width:340px){.msx .v-tr .o{width:42px;height:42px;font-size:19px}.msx .v-tr .nm{font-size:10px}.msx .v-lvx{font-size:10px}}
.msx .v-hg{display:inline-block;vertical-align:middle;flex:none}
.msx .v-bsel{display:flex;align-items:center;gap:9px;background:#1e1a36;border:1.5px solid #fde047;border-radius:13px;padding:7px 9px}
.msx .v-bsel .e{font-size:34px;line-height:1;flex:none}.msx .v-bsel b{display:block;font-size:13.5px}
.msx .v-bsel small{display:block;font-size:10px;font-weight:700;color:#e2e8f0;line-height:1.4}.msx .v-bsel small.lim{color:#f9a8d4;font-weight:900}
.msx .v-bgrid{display:grid;grid-template-columns:repeat(4,1fr);gap:6px}
.msx .v-bgrid div,.msx .v-bgrid button{position:relative;background:#0f172a;border:1.5px solid #475569;border-radius:12px;padding:6px 2px 4px;text-align:center;min-width:0}
.msx .v-bgrid .e{display:block;font-size:28px;line-height:34px;height:34px}
.msx .v-bgrid i{position:absolute;right:4px;top:3px;font-style:normal;font-size:10px;font-weight:900;color:#fde047}
.msx .v-bgrid small{display:block;font-size:10px;font-weight:800;line-height:1.25;min-height:22px;margin-top:2px}
.msx .v-bgrid div.sel,.msx .v-bgrid button.sel{border-color:#fde047;background:#3b2f0b;box-shadow:0 0 10px #fde04788}
.msx .v-bgrid div.no,.msx .v-bgrid button.no{opacity:.6}
.msx .v-bnote{font-size:10px;font-weight:800;line-height:1.7}.msx .v-bnote .dim2{color:#94a3b8;font-size:10px}
.msx .v-rm3{display:grid;gap:5px;margin-top:7px}
.msx .v-rm3>div{display:flex;align-items:center;gap:8px;background:#1e293b;border:1.5px solid #64748b;border-bottom-width:3px;border-radius:13px;padding:6px 9px;font-size:12.5px;font-weight:900;line-height:1.3;min-width:0;text-align:left}
.msx .v-rm3 small{display:block;font-size:10px;font-weight:800;color:#e2e8f0}
.msx .v-rm3 .re{background:linear-gradient(160deg,#f59e0b,#b45309);border-color:#fde68a;box-shadow:0 0 10px #f59e0b88}
.msx .v-rm3 .nj{background:linear-gradient(120deg,#be185d,#7c3aed 55%,#2563eb);border-color:#fbcfe8;box-shadow:0 0 10px #a78bfa88}
.msx .v-rm3 .gv{display:block;text-align:center;padding:5px;font-size:11.5px;color:#cbd5e1}.msx .v-rm3 .gv small{color:#94a3b8;display:inline;margin-left:6px}
.msx .v-icw{display:inline-block;width:30px;height:30px;flex:none;vertical-align:middle}.msx .v-icw svg{display:block}
.msx .v-item .v-icw{width:30px;height:30px}.msx .v-bag .v-icw{width:30px;height:30px}
.msx .v-bgrid .v-icw{width:34px;height:34px;display:block;margin:0 auto}.msx .v-bsel .v-icw{width:40px;height:40px}
.msx .v-igrid{display:grid;grid-template-columns:repeat(4,1fr);gap:5px;margin-top:6px}
.msx .v-igrid div,.msx .v-igrid button{position:relative;background:#0f172a;border:1.5px solid #475569;border-radius:11px;padding:5px 1px 3px;text-align:center;min-width:0}
.msx .v-igrid .v-icw{width:30px;height:30px;display:block;margin:0 auto}
.msx .v-igrid i{position:absolute;right:3px;top:2px;font-style:normal;font-size:10px;font-weight:900;color:#fde047}
.msx .v-igrid small{display:block;font-size:10px;font-weight:800;line-height:1.2;min-height:19px;margin-top:2px;overflow:hidden}
.msx .v-igrid div.bo,.msx .v-igrid button.bo{border-color:#38bdf8}
.msx .v-igrid button.none{opacity:.45}.msx .v-igrid button.look{outline:2px solid #f9a8d4;outline-offset:1px}.msx .v-igrid div.in,.msx .v-igrid button.in{border-color:#fde047;background:#3b2f0b;box-shadow:0 0 9px #fde04788}
.msx .v-igrid u{position:absolute;left:3px;top:2px;text-decoration:none;font-size:10px;font-weight:900;color:#86efac}
.msx .v-ileg{display:flex;gap:10px;font-size:10px;font-weight:800;color:#cbd5e1;margin-top:5px;white-space:nowrap}
.msx .v-ileg b{display:inline-block;width:9px;height:9px;border-radius:3px;margin-right:3px;vertical-align:-1px}.msx .v-ileg .sw1{background:#475569}.msx .v-ileg .sw2{background:#38bdf8}
.msx .v-sum .v-ics{display:flex;align-items:center;gap:3px;font-size:10px}.msx .v-sum .v-ics .v-icw{width:20px;height:20px}
.msx .v-cups:has(>.v-cup:first-child .rvi){padding-top:9px} /* いちばん上の札がライバルでも印が枠で切れない(r1115-207 N3) */
.msx .v-cup .rvi{position:absolute;left:4px;top:-9px;display:flex;align-items:center;gap:3px;background:linear-gradient(90deg,#ef4444,#fb923c);border-radius:99px;padding:1px 8px 1px 1px;font-size:10px;font-weight:900;line-height:1.6;white-space:nowrap}
.msx .v-cup .rvi img{width:20px;height:20px;border-radius:50%;object-fit:cover;object-position:50% 20%;background:#1e1a36;border:1.5px solid #fff}
.msx .v-cup .rvb{background:#3b2f0b;border:1px solid #fde047;color:#fde047}
/* ---- 足したもの(ゲームの中で要った分) ---- */
.msx-wrap{position:fixed;inset:0;z-index:9400;background:#0b0920;display:flex;justify-content:center;padding:env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left)}
/* スマホを横にしたときの案内(2026-11-20 r1119-026)。横長で高さが小さく、指で触る端末だけに出す(PC のマウスでは出さない)。
   案内は上に重ねるだけで、下の画面はそのまま残る(回しても進み具合を失わない)。
   重なり順はバトルの演出(決着の大写し 9700・判定 9650)より上の 9800(ミハリの指摘: バトルの画面で案内が下にもぐっていた) */
.msx-portrait-only{display:none}
@media (orientation:landscape) and (max-height:540px) and (hover:none) and (pointer:coarse){
.msx-portrait-only{position:absolute;inset:0;z-index:9800;display:flex;align-items:center;justify-content:center;padding:env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left);background:radial-gradient(circle at 50% 40%,#2a1f55 0,#0b0920 70%);color:#fff;text-align:center;touch-action:none}
.msx-portrait-only .in{display:flex;flex-direction:column;align-items:center;gap:8px;max-width:420px;padding:0 20px}
.msx-portrait-only .ph{width:72px;height:72px;display:flex;align-items:center;justify-content:center}
.msx-portrait-only .ph span{display:block;font-size:48px;line-height:1;transform:rotate(-90deg);animation:msxRotatePhone 2.4s ease-in-out infinite}
.msx-portrait-only b{font-size:18px;font-weight:900;color:#fde68a}
.msx-portrait-only p{margin:0;font-size:13px;font-weight:700;line-height:1.6;color:#e2e8f0}
}
@keyframes msxRotatePhone{0%,20%{transform:rotate(-90deg)}50%,80%{transform:rotate(0deg)}100%{transform:rotate(-90deg)}}
@media (prefers-reduced-motion:reduce){.msx-portrait-only .ph span{animation:none;transform:rotate(0deg)}}
.msx{width:100%;max-width:520px;height:100%;font-family:inherit;-webkit-tap-highlight-color:transparent;user-select:none;-webkit-user-select:none}
.msx.land{max-width:none}
.msx img{display:block}
/* ボタンの初期化は :where で強さを0にする(どのクラスの見た目にも負ける)。2026-11-14 点検: .msx button{padding:0} が .msx-btn{padding:10px} に勝ち、.msx-btn が高さ17〜18pxに潰れていた */
:where(.msx) button{font:inherit;color:inherit;background:none;border:0;padding:0;margin:0;cursor:pointer;text-align:inherit;-webkit-appearance:none;appearance:none}
.msx button:active{transform:scale(.97)}
.msx button[disabled]{opacity:.45;cursor:default}
.msx .v-ft span,.msx .v-ft button{flex:1;text-align:center}
.msx .v-ft button{display:block;border-radius:99px;padding:8px 6px;font-size:12px;font-weight:900;background:#2b3348;white-space:nowrap}
.msx .v-ft button.go{background:linear-gradient(90deg,#fb923c,#f97316);flex:2.2;font-size:13.5px;box-shadow:0 2px 0 #9a3412}
.msx .v-ft button.on{background:#fde047;color:#1e1b4b}
.msx-scroll{flex:1 1 0;min-height:0;overflow-y:auto;-webkit-overflow-scrolling:touch;overscroll-behavior:contain}
.msx-ov{position:absolute;inset:0;z-index:40;background:#0b0920cc;display:flex;align-items:center;justify-content:center;padding:14px}
.msx-ov.msx-ov-deep{z-index:41;background:#0b0920f7}
.msx-sheet{width:100%;max-height:100%;overflow-y:auto;background:linear-gradient(180deg,#241d4a,#16122e);border:1px solid #f472b6aa;border-radius:16px;padding:12px;box-shadow:0 10px 30px #000a}
.msx-sheet h3{margin:0 0 6px;font-size:15px;font-weight:900;color:#f9a8d4}
/* 窓の最後の「閉じる」は、窓の中を送っても下に貼り付ける(2026-11-19 r1119-013 ⑥ U-12・M-5。横・小さい横で閉じるが送った先にあり、
   イベント図鑑では一覧の最後の行が閉じるに重なっていた)。小さい横は幕の余白を詰めて、中身に高さを回す */
.msx-sheet{overscroll-behavior:contain}
.msx-sheet>.msx-btn:last-child{position:sticky;bottom:-12px;z-index:2;margin-bottom:-12px;box-shadow:0 -12px 12px -2px #16122e,0 12px 0 0 #16122e}
@media (max-height:460px){.msx-ov{padding:6px 10px}}
/* 横持ちでは本文(.v-body)が2列の格子になり、本文の直下に置いた窓の幕が右の列(中身の長さぶん)に閉じこめられて、
   詳細の窓の「貸し出す・お別れ・閉じる」が画面の外へ出ていた(2026-11-19 r1119-013 ⑥ U-12)。窓を画面いっぱいに出す
   縦でも同じにする(社長の実機の指摘: 詳細の窓の「閉じる」と、後ろの左上・下の「← 戻る」が両方見えて二重だった)。
   本文の中で開いた窓も、見出しの帯・下の帯ごと幕で覆い、閉じる操作は窓の中の1つにする */
.msx .v-body>.msx-ov{position:fixed;inset:0}
.msx-row{display:flex;align-items:center;gap:6px}
/* モンスターの詳細(2026-11-14 手本の組み立て・見た目はうちの物) */
.msx-md{padding:8px 10px}
.msx-md-ti{text-align:center}
.msx .msx-sheet h3.msx-md-ti{margin:0 0 4px}
.msx-md-scroll{flex:1 1 auto;min-height:0;overflow-y:auto;-webkit-overflow-scrolling:touch;overscroll-behavior:contain}
.msx-md-top{display:grid;grid-template-columns:minmax(0,38%) minmax(0,1fr);gap:6px}
.msx-md-art{position:relative;display:flex;flex-direction:column;align-items:center;border-radius:12px;background:linear-gradient(180deg,#3b2f6b,#1b1638);padding:4px;min-height:150px}
.msx-md-art .nm{align-self:stretch;font-size:12px;font-weight:900;color:#fde047;line-height:1.3;overflow-wrap:anywhere}.msx-md-art .nm small{display:block;font-size:10px;color:#cbd5e1}
.msx-md-art img,.msx-md-art>span{flex:1 1 auto;width:100%;max-height:min(150px,30cqh);object-fit:contain;filter:drop-shadow(0 4px 3px #0008)}
.msx-md-art .pw{align-self:stretch;display:flex;align-items:center;gap:3px;background:#0f172acc;border-radius:999px;padding:2px 8px;margin-top:2px}
.msx-md-art .pw small{flex:none;font-size:10px;color:#cbd5e1;white-space:nowrap}.msx-md-art .pw b{flex:1;min-width:0;font-size:14px;text-align:right;white-space:nowrap}.msx-md-art .pw i{flex:none}
.msx-md-panel{min-width:0;display:flex;flex-direction:column}
.msx-md-tabs{display:grid;grid-template-columns:repeat(3,1fr);gap:2px}
.msx .msx-md-tabs button,.msx .msx-md-dists button{border-radius:8px 8px 0 0;padding:4px 0;text-align:center;font-size:11px;font-weight:900;background:#2b2550;color:#cbd5e1}
.msx .msx-md-tabs button.on,.msx .msx-md-dists button.on{background:#fde047;color:#1e1b4b}
.msx-md-box{flex:1;background:#0f172a;border-radius:0 0 10px 10px;padding:5px 6px}
.msx-md-box .cap{display:flex;justify-content:space-between;font-size:10px;color:#f9a8d4;font-weight:900}
.msx-md-st{display:flex;align-items:center;gap:4px;margin:3px 0;font-size:11px}
.msx-md-st .n{flex:none;width:5.2em;white-space:nowrap;font-size:10.5px}
.msx-md-st .v{flex:1;min-width:0;display:flex;flex-direction:column}
.msx-md-st .v b{font-size:14px;line-height:1.1;text-align:right}
.msx-md-st .g{height:4px;border-radius:2px;background:#334155;overflow:hidden}.msx-md-st .g i{display:block;height:100%}
.msx-md-st .g.ov{position:relative}.msx-md-st .g b.ov{position:absolute;left:0;top:0;bottom:0;background:linear-gradient(90deg,#c084fc,#f0abfc)} /* 999 を超えた分(r1115-103) */
.msx-md-st .a{flex:none;width:1.4em;text-align:center;font-weight:900;color:#fde047}.msx-md-st .a.lo{color:#94a3b8}
.msx-md-kv{display:flex;gap:6px;align-items:baseline;font-size:11px;padding:2px 0;border-bottom:1px solid #1e293b}
.msx-md-kv>b{flex:none;min-width:8.1em;white-space:nowrap;color:#f9a8d4;font-size:10.5px}.msx-md-kv>span{flex:1;min-width:0;overflow-wrap:anywhere}.msx-md-kv .gd{font-size:14px;font-weight:900;color:#fde047}
/* ラベル列の幅: 最も長い「友情タッグの強さ」(8字)が収まる 8.1em に統一。6em のときは「クリティカル率」(7字)だけが列からはみ出し、その行の値だけ右にずれていた(2026-11-18 実機報告) */
.msx-md-dex{font-size:11px;font-weight:500;line-height:1.6;margin-top:4px}
.msx-md-btabs{margin-top:6px}
.msx-md-as .cap span{margin-left:auto}
.msx-md-ac{display:flex;gap:8px;align-items:flex-start;background:linear-gradient(180deg,#2a2150,#1e1a36);border:1px solid #4a4380;border-radius:12px;padding:7px 8px;margin-top:6px}
.msx-md-ac.gold{background:linear-gradient(180deg,#713f12,#451a03);border-color:#f59e0b}
.msx-md-ac .ic{flex:none;width:34px;height:34px;display:flex;align-items:center;justify-content:center;font-size:22px;border-radius:0;clip-path:polygon(50% 0,100% 38%,81% 100%,19% 100%,0 38%);background:#475569}
.msx-md-ac[data-msx-assist-type="with"] .ic{background:#7c3aed}
.msx-md-ac[data-msx-assist-type="stay"] .ic{background:#0284c7}
.msx-md-ac[data-msx-assist-type="self"] .ic{background:#16a34a}
.msx-md-ac[data-msx-assist-type="battle"] .ic{background:#dc2626}
.msx-md-ac .bd{flex:1;min-width:0}.msx-md-ac .hd{display:flex;gap:6px;align-items:flex-start;justify-content:space-between}
.msx-md-ac .hd b{font-size:13px;font-weight:900;line-height:1.3;min-width:0;word-break:keep-all;overflow-wrap:anywhere}.msx-md-ac .hd b em{font-style:normal;color:#fde047}
.msx-md-ac .pips{flex:none;font-size:10px;font-weight:800;color:#cbd5e1;background:#0f172a;border-radius:99px;padding:1px 7px;white-space:nowrap}.msx-md-ac .pips i{font-style:normal;color:#fde047;font-weight:900}
.msx-md-ac .tx{font-size:11px;font-weight:700;color:#e2e8f0;line-height:1.45;margin-top:5px;padding-top:5px;border-top:1.5px dashed #4a4380;word-break:keep-all;overflow-wrap:anywhere}
.msx-md-ac .sc{font-size:10px;font-weight:800;color:#f9a8d4;margin-top:2px}
.msx-md-art .pw{flex-wrap:wrap;row-gap:1px}.msx-md-art .pw b{flex:1 1 auto}
.msx-md-bot{margin-top:6px}
.msx-md-cap{font-size:12px;font-weight:900;color:#f9a8d4}.msx-md-cap small{font-size:10px;color:#cbd5e1;margin-left:6px;font-weight:700}
.msx-md-dists{display:grid;grid-template-columns:repeat(5,1fr);gap:2px;margin-top:3px}
.msx-md-tw{display:grid;grid-template-columns:minmax(0,54%) minmax(0,1fr);gap:6px;background:#0f172a;border-radius:10px;padding:5px;margin-top:3px}
/* 技の升目(参考 monster-detail-basic): 見出しと升を同じ4列にそろえる */
.msx-md-tg{display:grid;grid-template-columns:repeat(4,minmax(0,56px));gap:4px;align-content:start;justify-content:center}
.msx-md-tg .tgh{font-size:10.5px;font-weight:900;text-align:center;border-radius:99px;padding:1px 0;color:#fff}
.msx-md-tg .tgh.apt{display:grid;justify-items:center;align-content:center;padding:1px 0 2px;border-radius:9px;line-height:1.15}.msx-md-tg .tgh .tgn{display:inline-flex;align-items:center;gap:3px;white-space:nowrap}.msx-md-tg .tgh .tga{display:inline-flex;align-items:center;justify-content:center;min-width:17px;height:15px;padding:0 2px;border-radius:5px;background:#fff;color:#0f172a;font-size:10.5px;font-weight:900;line-height:1}.msx-md-tg .tgh .tgp{font-style:normal;white-space:nowrap;font-size:10px;font-weight:900;color:#fff;opacity:.95}.msx-md-tg .tgh .tgp.tgp-up{color:#fef08a}.msx-md-tg .tgh .tgp.tgp-dn{color:#e2e8f0;opacity:.8}
.msx-md-tg .tgh.d3{background:#2563eb}.msx-md-tg .tgh.d2{background:#16a34a}.msx-md-tg .tgh.d1{background:#d97706}.msx-md-tg .tgh.d0{background:#dc2626}
.msx .msx-md-tg .tc,.msx-md-tg .no{position:relative;aspect-ratio:1/1;min-height:0;border-radius:8px;display:flex;align-items:center;justify-content:center}
.msx .msx-md-tg .tc{padding:0;border:1.5px solid transparent}
/* 技の種類で色分け(参考 monster-detail-basic・mm-04: ちから技=金・かしこさ技=緑)。覚えていない技は升の地と枠を暗くし、絵は少しだけ暗く(.msx .lk の白黒の見た目とぶつからないよう tg-not という名前にする) */
.msx .msx-md-tg .tc.pow{background:linear-gradient(160deg,#fde68a,#d97706);border-color:#f59e0b}
.msx .msx-md-tg .tc.wise{background:linear-gradient(160deg,#bbf7d0,#16a34a);border-color:#4ade80}
.msx .msx-md-tg .tc.pow.tg-not{background:linear-gradient(160deg,#9a7420,#5e420c);border-color:#a8801f}
.msx .msx-md-tg .tc.wise.tg-not{background:linear-gradient(160deg,#2f8050,#145230);border-color:#3f9a62}
.msx-md-tg .tc.tg-not .ti{filter:brightness(.55) saturate(.65)}
/* 技の絵(資料の技アイコン・2026-11-15 社長 r1115-003): 升いっぱいに敷く。元絵に焼き込まれた数字は、右下の数字の札(.g)でかぶせる */
.msx-md-tg .tc .ti{position:absolute;inset:0;border-radius:6px;overflow:hidden;display:block}
.msx-md-tg .tc .tg-img{display:block;width:100%;height:100%;object-fit:cover;pointer-events:none}
.msx-md-tg .tc .g{right:2px;bottom:2px;min-width:20px;padding:0 3px;border-radius:5px;background:rgba(18,12,6,.86);text-align:center;line-height:13px;height:13px;z-index:2}
.msx-md-tg .tc .tg-alt{z-index:3}
.msx-md-tg .tc .tg-rk{position:absolute;left:2px;top:2px;z-index:2;min-width:14px;height:14px;border-radius:4px;font-size:10px;font-weight:900;line-height:14px;text-align:center;color:#2a1608;border:1px solid #2a1608}
.tg-rk.rk1{background:linear-gradient(135deg,#e9a46a,#a95f27)}.tg-rk.rk2{background:linear-gradient(135deg,#f4f7fb,#aab4c2)}.tg-rk.rk3{background:linear-gradient(135deg,#fff1a6,#f2b705)}.tg-rk.rk4{background:linear-gradient(135deg,#d9a8ff,#8a3ffc);color:#fff}.tg-rk.rk5{background:linear-gradient(135deg,#ff5a5a,#ffd23f,#4ade80,#38bdf8,#c084fc)}
.msx-md-tg .tc{position:relative}
.msx .sym{position:relative!important;font-size:0!important;line-height:0!important;color:inherit}
.msx .sym::before{content:'';position:absolute;left:50%;top:50%;width:14px;height:14px;transform:translate(-50%,-50%);background:linear-gradient(currentColor,currentColor) center/14px 2.5px no-repeat}
.msx .sym.plus::before,.msx .sym.close::before{background:linear-gradient(currentColor,currentColor) center/14px 2.5px no-repeat,linear-gradient(currentColor,currentColor) center/2.5px 14px no-repeat}
.msx .sym.close::before{transform:translate(-50%,-50%) rotate(45deg)}
.msx .sym.info::before{width:20px;height:20px;border:2.5px solid currentColor;border-radius:50%;box-sizing:border-box;background:linear-gradient(currentColor,currentColor) 50% 3px/2.5px 2.5px no-repeat,linear-gradient(currentColor,currentColor) 50% 7.5px/2.5px 6px no-repeat}
/* 注意: 全ボタンの ::after は「押せる範囲を広げる」用(838行)。記号の線は ::before だけで描く */
.msx .msx-md-alt{margin-top:6px;width:100%;display:flex;align-items:center;justify-content:center;text-align:center;padding:6px 8px;border-radius:10px;font-size:12px;font-weight:900;color:#fff;background:linear-gradient(160deg,#6d4cd9,#4a2fa6);border:1.5px solid #a78bfa}
.msx .msx-md-alt.top{margin:4px 0 6px;min-height:36px}
/* 技の熟練(r1115-082): 升の下に小さなゲージ(覚えた技だけ)・右の欄に熟練の棒 */
.msx-md-tg .tc .tg-ms{position:absolute;left:3px;right:26px;bottom:4px;height:5px;border-radius:3px;background:rgba(18,12,6,.85);border:1px solid rgba(255,255,255,.55);z-index:2;overflow:hidden}
.msx-md-tg .tc .tg-ms i{display:block;height:100%;background:linear-gradient(90deg,#fde68a,#f59e0b)}
.msx .msx-ms-v{white-space:nowrap}.msx .msx-ms-v small{font-size:inherit;opacity:.75;margin-left:1px}
.msx .msx-ms-ef{display:flex;flex-wrap:wrap;justify-content:flex-end;gap:0 6px}.msx .msx-ms-ef i{font-style:normal;white-space:nowrap}
.msx .msx-ms-bar{display:block;height:6px;margin:2px 0 4px;border-radius:4px;background:#0f172a;border:1px solid #475569;overflow:hidden}
.msx .msx-ms-bar i{display:block;height:100%;background:linear-gradient(90deg,#fde68a,#f59e0b)}
/* 覚える技を選ぶ窓の1行(2026-11-15 r1115-149): チーム選びの .msx-tp(縦並び・高さいっぱい)とぶつからないよう名前を msx-tpk に分けた */
.msx .msx-tpk{display:flex;align-items:center;gap:8px;width:100%;margin:0 0 6px;padding:6px 8px;border-radius:12px;text-align:left;color:#fff;background:#1e1b3a;border:1.5px solid #3b3566}
.msx .msx-tpk.on{border-color:#facc15;background:#2a2547}
.msx .msx-tpk:disabled{opacity:.55}
.msx .msx-tpk .tc{position:relative;overflow:hidden;flex:0 0 56px;width:56px;height:56px;min-height:0;padding:0;aspect-ratio:1/1;align-self:center;border-radius:8px;display:flex;align-items:center;justify-content:center;border:1.5px solid transparent}
.msx .msx-tpk .tc.pow{background:linear-gradient(160deg,#fde68a,#d97706);border-color:#f59e0b}
.msx .msx-tpk .tc.wise{background:linear-gradient(160deg,#bbf7d0,#16a34a);border-color:#4ade80}
.msx .msx-tpk .tc.pow.tg-not{background:linear-gradient(160deg,#9a7420,#5e420c);border-color:#a8801f}
.msx .msx-tpk .tc.wise.tg-not{background:linear-gradient(160deg,#2f8050,#145230);border-color:#3f9a62}
.msx .msx-tpk .tc{overflow:hidden}.msx .msx-tpk .tc .ti{position:absolute;inset:0;display:block}.msx .msx-tpk .tc .tg-img{width:100%;height:100%;object-fit:cover;display:block}
.msx .msx-tpk .tc.tg-not .ti{filter:brightness(.55) saturate(.65)}
.msx .msx-tpk .tpb{flex:1;min-width:0;display:flex;flex-direction:column;gap:1px}
.msx .msx-tpk .tpb b{font-size:13px;word-break:keep-all;overflow-wrap:normal;line-break:strict}
.msx .msx-tpk .tpb small{font-size:10.5px;opacity:.85;line-height:1.35}
.msx .msx-tpk .tpb small.tp-nb i{font-style:normal;display:inline-block;white-space:nowrap;margin-right:.6em}
.msx .msx-tpk .tpm{flex:0 0 auto;font-size:11px;font-weight:900;color:#facc15}
.msx .msx-tpk .tc .tg-rk{position:absolute;left:2px;top:2px;z-index:2;min-width:14px;height:14px;border-radius:4px;font-size:10px;font-weight:900;line-height:14px;text-align:center;color:#2a1608;border:1px solid #2a1608}
/* r1115-146①・152①: 同じマスに技が2つ以上ある印「⇄2」。押せない(升を押すと右の欄に技が出て、そこの「⇄ 覚える技を選ぶ」で変える) */
/* 印は升の内側に収まる小さな札にする(字だけだと端末のフォント次第で隣の升へはみ出す。2026-11-16 実機スクショ) */
.msx-md-tg .tc .tg-alt{position:absolute;top:2px;right:2px;z-index:3;display:flex;align-items:center;height:14px;padding:0 3px;border-radius:5px;background:rgba(18,12,6,.86);font-size:10px;font-weight:900;line-height:1;color:#fff;white-space:nowrap;pointer-events:none}

.msx-md-not{display:block;font-size:10px;color:#94a3b8;font-weight:800}
.msx-md-howrow{flex-direction:column;align-items:flex-start;gap:1px}.msx-md-howrow>span{width:100%}
.msx-md-how{display:block;font-size:10.5px;color:#fde68a;font-weight:800;word-break:keep-all;overflow-wrap:anywhere}
.msx .msx-md-tg .tc.on{border-color:#fde047;box-shadow:0 0 0 2px #fde047}
.msx-md-tg .tc .ti{font-size:17px;line-height:1}
.msx-md-tg .tc .g{position:absolute;right:2px;bottom:0;font-size:10px;font-weight:900;color:#fff;text-shadow:0 1px 2px #000}
.msx-md-tg .no{background:#0b0920;border:1px solid #334155;color:#475569;font-size:16px;font-weight:900}
.msx-md-tl{display:flex;flex-direction:column;gap:3px;max-height:200px;overflow-y:auto}.msx-md-tl>*{flex:none}
.msx .msx-md-tl button{display:block;text-align:left;border-radius:8px;padding:3px 6px;background:#1e1a36;border:1px solid #334155;color:#cbd5e1}
.msx .msx-md-tl button.got{color:#fff;border-color:#a78bfa}.msx .msx-md-tl button.on{border-color:#fde047;background:#3b2f0b}
.msx-md-tl b{display:block;font-size:11px;overflow-wrap:anywhere}.msx-md-tl small{display:block;font-size:10px;color:#cbd5e1}
.msx-md-td .tn{font-size:12px;font-weight:900;color:#fde047;margin-bottom:2px;word-break:keep-all;overflow-wrap:normal;line-break:strict}
/* r1115-150: 覚えた技(熟練の行あり)と覚えていない技(覚え方の行)を押し分けても、右の欄の高さで窓がずれないように。
   2列のときは右の欄の高さを左の技の表に合わせ(contain:size で中身の高さを列の高さへ出さない)、はみ出す分は欄の中だけスクロール */
.msx-md-tw>.msx-md-td{contain:size;min-height:0;overflow-y:auto;overscroll-behavior:contain}
@container (max-width: 359px){.msx-md-tw>.msx-md-td{contain:none;height:236px}.msx-md-top{grid-template-columns:1fr}.msx-md-art{flex-direction:row;flex-wrap:wrap;min-height:0}.msx-md-art img,.msx-md-art>span{width:34%;max-height:90px}.msx-md-tw{grid-template-columns:1fr}.msx-md-tl{max-height:150px}}
/* 育成中の「能力」(いじる物だけ・2026-11-14) */
.msx-ab-row{display:flex;align-items:center;gap:6px;margin-top:5px}
.msx-ab-row .n{flex:1;min-width:0;font-size:12px;font-weight:900}.msx-ab-row b{width:3em;text-align:right}
.msx-ab-tech{display:inline-block;background:#0f172a;border:1px solid #a78bfa;border-radius:8px;padding:2px 7px;margin:3px 3px 0 0;font-size:11px}
/* 編成: 枠を押して選ぶ・集まりやすいトレーニングの表(2026-11-14) */
.msx .msx-slot-tap{cursor:pointer;outline:1px dashed #f9a8d488;outline-offset:-2px}
.msx .msx-heat-btn{display:block;width:100%;text-align:left;cursor:pointer}
.msx-pick-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:4px}
.msx .msx-pick{display:flex;flex-direction:column;align-items:center;gap:1px;background:#0f172a;border:1px solid #334155;border-radius:10px;padding:4px 2px;min-width:0;color:#fff}
.msx .msx-pick.on{border-color:#fde047;background:#3b2f0b}
.msx-pick img{width:40px;height:40px;object-fit:contain}.msx-pick b{font-size:11px;max-width:100%;overflow-wrap:anywhere;text-align:center}.msx-pick small{font-size:10px;color:#cbd5e1;text-align:center;line-height:1.25}
.msx-gt-row{background:#0f172a;border-radius:10px;padding:5px 8px;margin:4px 0}
.msx-gt-row .hd{display:flex;align-items:center;gap:5px;font-size:12px}.msx-gt-row .hd .ic{font-size:16px;display:inline-flex;align-items:center;justify-content:center;width:24px;height:24px;border-radius:7px;background:#0f172a}.msx-gt-row[data-msx-assist-type="with"] .hd .ic{background:#7c3aed}.msx-gt-row[data-msx-assist-type="stay"] .hd .ic{background:#0284c7}.msx-gt-row[data-msx-assist-type="self"] .hd .ic{background:#16a34a}.msx-gt-row[data-msx-assist-type="battle"] .hd .ic{background:#dc2626}.msx-gt-row .hd b{flex:1;min-width:0}
.msx-gt-row .hd .st{font-size:10.5px;color:#fde047}.msx-gt-row .hd .n{font-size:11px;color:#f9a8d4;font-weight:900}
.msx-gt-mon{display:flex;align-items:center;gap:5px;margin-top:3px;font-size:11px}
.msx-gt-mon img{flex:none;width:24px;height:24px;border-radius:7px;object-fit:contain;background:#1e1a36}.msx-gt-mon .nm{flex:1;min-width:0;overflow-wrap:anywhere}.msx-gt-mon .v{flex:0 1 auto;font-size:10px;color:#cbd5e1;text-align:right}
.msx-gt-none{font-size:10.5px;color:#94a3b8;margin-top:2px}
/* 選ぶ画面: はじめの能力(数字を大きく・素質は小さく)と「くわしく」の窓(2026-11-14) */
.msx-dt-hd{display:flex;align-items:center;gap:6px}.msx-dt-hd .h1{flex:1;min-width:0}
.msx .msx-dt-more{flex:none;border-radius:999px;padding:3px 10px;font-size:11px;font-weight:900;background:#f472b6;color:#fff;box-shadow:0 2px 0 #9d174d}
.msx-dt-sm{font-size:10px;font-weight:700;color:#cbd5e1}
.msx-st6{display:grid;grid-template-columns:repeat(3,1fr);gap:3px;margin-top:4px;text-align:center}
.msx-st6 div{background:#0f172a;border-radius:8px;padding:2px 0 3px;line-height:1.15;min-width:0}
.msx-st6 .n{display:block;font-size:10px;color:#cbd5e1}
.msx-st6 b{display:block;font-size:20px;color:#fff;letter-spacing:.5px}
.msx-st6 i{display:block;font-style:normal;font-size:10px;color:#fde047}.msx-st6 i.lo{color:#94a3b8}
/* 育成開始の「初めの能力」は1行6列の帯にして、一覧に高さを譲る(2026-11-18 社長。詳しい能力は「詳しく」の詳細で見る) */
.msx-st6.row6{grid-template-columns:repeat(6,minmax(0,1fr))}
.msx-st6.row6 .n{font-size:8.5px}
.msx-st6.row6 b{font-size:14px;letter-spacing:0}
.msx-st6.row6 i{font-size:8.5px}
.msx-dt{display:flex;flex-direction:column;max-height:100%;padding:10px}.msx-dt>*{flex:none}.msx-dt>.msx-dt-body{flex:1 1 auto}
/* 詳細の窓の送り箱も伸び縮みさせる(上の .msx-dt>* が flex:none にしていたため、送り箱が縮まず窓ごと送る形になり、
   低い画面で「貸し出す・お別れ・閉じる」が送った先にあった。2026-11-19 r1119-013 ⑥ U-12) */
.msx-dt>.msx-md-scroll{flex:1 1 auto;min-height:0}
.msx-dt-top{display:flex;align-items:flex-end;gap:8px}
.msx-dt-top img{flex:none;width:30%;max-width:min(120px,24cqh);aspect-ratio:1;object-fit:contain;filter:drop-shadow(0 4px 3px #0008)}
.msx-dt-top .nm{flex:1;min-width:0;line-height:1.5}
.msx-dt-tabs{margin-top:6px}
.msx-dt-body{flex:1 1 auto;min-height:0;overflow-y:auto;margin-top:6px;padding-right:2px}
.msx-dt-cap{font-size:11px;font-weight:900;color:#f9a8d4;margin:2px 0 4px}
.msx-dt-bar{display:flex;align-items:center;gap:6px;margin:3px 0;font-size:11px}
.msx-dt-bar .n{flex:none;width:4.5em}.msx-dt-bar b{flex:none;width:2.4em;text-align:right;font-size:15px}
.msx-dt-bar .g{flex:1;min-width:0;height:8px;border-radius:4px;background:#0f172a;overflow:hidden}.msx-dt-bar .g i{display:block;height:100%;background:linear-gradient(90deg,#f472b6,#fde047)}
.msx-dt-bar .a{flex:none;width:1.6em;text-align:center;font-weight:900;color:#fde047}.msx-dt-bar .a.lo{color:#94a3b8}
.msx-dt-dist{display:grid;grid-template-columns:repeat(4,1fr);gap:4px;text-align:center}
.msx-dt-dist div{background:#0f172a;border-radius:8px;padding:4px 0}.msx-dt-dist span{display:block;font-size:11px;color:#cbd5e1}.msx-dt-dist b{display:block;font-size:18px;color:#fde047}
.msx-dt-tech{display:flex;align-items:center;gap:6px;background:#0f172a;border-radius:8px;padding:4px 8px;margin:3px 0;font-size:11px}
.msx-dt-tech .k{flex:none;font-size:10px;color:#7dd3fc}.msx-dt-tech b{flex:1;min-width:0;overflow-wrap:anywhere}.msx-dt-tech .d{flex:none;font-size:10px;color:#cbd5e1}
.msx .msx-dt-close{display:block;width:100%;margin-top:8px;border-radius:12px;padding:10px;font-size:13px;font-weight:900;text-align:center;color:#fff;background:#1e1a36;border:1px solid #4a4380}
.msx-dt-dex{font-size:12px;font-weight:500;line-height:1.7;background:#0f172a;border-radius:10px;padding:8px 10px}
.msx-btn{display:block;width:100%;min-height:44px;border-radius:12px;padding:10px;font-size:13px;font-weight:900;text-align:center;background:#2b3348;margin-top:6px}
.msx-btn.go{background:linear-gradient(90deg,#fb923c,#f97316);box-shadow:0 2px 0 #9a3412}
.msx-btn.sub{background:#1e1a36;border:1px solid #4a4380}
.msx-note{font-size:10px;color:#cbd5e1;font-weight:700;line-height:1.5}
.msx-soon{display:inline-block;margin-left:4px;padding:0 6px;border-radius:99px;background:#475569;color:#e2e8f0;font-size:10px;font-weight:900;vertical-align:middle}
.msx-dbg{font-size:10px;color:#a3e635;font-weight:900}
.msx .v-pf img{object-fit:contain;background:#0f172a}
.msx .v-scene .mon{animation:msx-breathe 3.2s ease-in-out infinite}
.msx .v-scene.home .mon.low{filter:drop-shadow(0 8px 5px #0009) saturate(.8);transform:translateX(-50%) rotate(4deg)}
.msx .v-pf.tag img{animation:msx-glow 1.6s ease-in-out infinite}
.msx .v-tr.tag .o{animation:msx-glow 1.6s ease-in-out infinite}
.msx-fade{animation:msx-fadein .18s ease-out}
/* 社長「育成中のメイン・トレーニングの画面は、モンスターもっと小さくしてぴょこぴょこ動く」(2026-11-12)。いまの約7割 */
.msx .v-scene.home .msx-roam{position:absolute;inset:0;pointer-events:none;transform-origin:50% 72%;animation:msx-roam-mv 28s linear infinite;will-change:transform}
.msx .v-scene.home .msx-roam-f{position:absolute;inset:0;transform-origin:50% 72%;animation:msx-roam-fl 28s steps(1,end) infinite}
.msx .v-scene.home .msx-roam-h{position:absolute;inset:0;animation:msx-roam-hp 28s linear infinite}
@keyframes msx-roam-mv{0%{transform:translate(0%,0%) scale(1)}10%{transform:translate(24%,0%) scale(1)}14%{transform:translate(24%,0%) scale(1)}15%{transform:translate(24%,0%) scale(1)}26%{transform:translate(-4%,11%) scale(1.2)}30%{transform:translate(-4%,11%) scale(1.2)}31%{transform:translate(-4%,11%) scale(1.2)}40%{transform:translate(-22%,9%) scale(1.15)}41%{transform:translate(-22%,9%) scale(1.15)}52%{transform:translate(-18%,-4%) scale(0.92)}56%{transform:translate(-18%,-4%) scale(0.92)}57%{transform:translate(-18%,-4%) scale(0.92)}68%{transform:translate(20%,-4%) scale(0.92)}72%{transform:translate(20%,-4%) scale(0.92)}73%{transform:translate(20%,-4%) scale(0.92)}88%{transform:translate(0%,0%) scale(1)}92%{transform:translate(0%,0%) scale(1)}93%{transform:translate(0%,0%) scale(1)}100%{transform:translate(0%,0%) scale(1)}}
@keyframes msx-roam-fl{0%{transform:scaleX(1)}10%{transform:scaleX(1)}14%{transform:scaleX(1)}15%{transform:scaleX(-1)}26%{transform:scaleX(-1)}30%{transform:scaleX(-1)}31%{transform:scaleX(1)}40%{transform:scaleX(1)}41%{transform:scaleX(-1)}52%{transform:scaleX(-1)}56%{transform:scaleX(-1)}57%{transform:scaleX(1)}68%{transform:scaleX(1)}72%{transform:scaleX(1)}73%{transform:scaleX(-1)}88%{transform:scaleX(-1)}92%{transform:scaleX(-1)}93%{transform:scaleX(1)}100%{transform:scaleX(1)}}
@keyframes msx-roam-hp{0%{transform:translateY(0)}0.5%{transform:translateY(-3.5%)}1.6%{transform:translateY(0)}2.7%{transform:translateY(-3.5%)}3.8%{transform:translateY(0)}4.9%{transform:translateY(-3.5%)}6.0%{transform:translateY(0)}7.1%{transform:translateY(-3.5%)}8.2%{transform:translateY(0)}9.3%{transform:translateY(-3.5%)}10%{transform:translateY(0)}11.1%{transform:translateY(0)}11.5%{transform:translateY(-9%)}12.0%{transform:translateY(0)}12.2%{transform:translateY(0)}12.6%{transform:translateY(-9%)}13.1%{transform:translateY(0)}15.5%{transform:translateY(-3.5%)}16.6%{transform:translateY(0)}17.7%{transform:translateY(-3.5%)}18.8%{transform:translateY(0)}19.9%{transform:translateY(-3.5%)}21.0%{transform:translateY(0)}22.1%{transform:translateY(-3.5%)}23.2%{transform:translateY(0)}24.3%{transform:translateY(-3.5%)}25.4%{transform:translateY(0)}26%{transform:translateY(0)}31.5%{transform:translateY(-3.5%)}32.6%{transform:translateY(0)}33.7%{transform:translateY(-3.5%)}34.8%{transform:translateY(0)}35.9%{transform:translateY(-3.5%)}37.0%{transform:translateY(0)}38.1%{transform:translateY(-3.5%)}39.2%{transform:translateY(0)}40%{transform:translateY(0)}57.5%{transform:translateY(-3.5%)}58.1%{transform:translateY(0)}58.5%{transform:translateY(-9%)}58.6%{transform:translateY(0)}59.0%{transform:translateY(0)}59.2%{transform:translateY(0)}59.6%{transform:translateY(-9%)}59.7%{transform:translateY(-3.5%)}60.1%{transform:translateY(0)}60.8%{transform:translateY(0)}61.9%{transform:translateY(-3.5%)}63.0%{transform:translateY(0)}64.1%{transform:translateY(-3.5%)}65.2%{transform:translateY(0)}66.3%{transform:translateY(-3.5%)}67.4%{transform:translateY(0)}68%{transform:translateY(0)}73.5%{transform:translateY(-3.5%)}74.6%{transform:translateY(0)}75.7%{transform:translateY(-3.5%)}76.8%{transform:translateY(0)}77.9%{transform:translateY(-3.5%)}79.0%{transform:translateY(0)}80.1%{transform:translateY(-3.5%)}81.2%{transform:translateY(0)}82.3%{transform:translateY(-3.5%)}83.4%{transform:translateY(0)}84.5%{transform:translateY(-3.5%)}85.6%{transform:translateY(0)}86.7%{transform:translateY(-3.5%)}87.8%{transform:translateY(0)}88%{transform:translateY(0)}}
@media (prefers-reduced-motion:reduce){.msx .v-scene.home .msx-roam,.msx .v-scene.home .msx-roam-f,.msx .v-scene.home .msx-roam-h{animation:none}}
.msx .v-scene.home .mon{height:24%}.msx.land .v-scene.home .mon{height:28%}.msx.s320 .v-scene.home .mon{height:26%}
.msx span.mon{display:block}
.msx .mon.msx-live{animation:none;filter:none}
/* 演出の部品が無いときだけの跳ね(小さく4回・5回目に大きく)。translate だけを動かすので、位置の transform とぶつからない */
.msx .mon.msx-hop{animation:msx-hop 3.4s ease-in-out infinite}
@keyframes msx-hop{0%,14%,28%,42%,56%,100%{translate:0 0}7%,21%,35%,49%{translate:0 -5%}70%{translate:0 -16%}84%{translate:0 0}}
.msx-pop{animation:msx-popin .35s cubic-bezier(.2,1.4,.4,1)}
@keyframes msx-breathe{0%,100%{scale:1}50%{scale:1.025}}
@keyframes msx-glow{0%,100%{filter:brightness(1)}50%{filter:brightness(1.25)}}
@keyframes msx-fadein{from{opacity:0}to{opacity:1}}
@keyframes msx-popin{from{transform:scale(.6);opacity:0}to{transform:scale(1);opacity:1}}
/* 押せる大きさ: 見た目は変えず、押せる範囲だけ 44px 四方まで広げる(見張り: tools/success/success-shoot.js) */
:where(.msx) button,:where(.msx) [role=button]{position:relative;min-height:0}
.msx button:not(:disabled)::after,.msx [role=button]::after{content:'';position:absolute;left:50%;top:50%;width:max(100%,44px);height:max(100%,44px);transform:translate(-50%,-50%)}
/* 広がり(44px)が隣の段の札に重ならないようにする(2026-11-19 r1119-013 ⑥ M-6・ミハリの指摘)。札の中を押しても、下の段の札の広がりに当たって
   隣の札が押されていた(図鑑の分類・助手の札、能力ポイントの「1P〜MAX」の下の「まとめて」)。札そのものを 36px にして段の間を 8px 空け、
   広がりは段の間の半分(上下 4px)まで。見張り: tools/success/success-shoot.js「札の端を押しても隣の札に当たらない」 */
.msx .msx-dex-tabs,.msx .msx-dex-aids{row-gap:8px}
.msx .msx-dex-tabs button,.msx .msx-dex-aids button,.msx .msx-pt-bulk .chip{min-height:36px}
.msx .msx-dex-tabs button::after,.msx .msx-dex-aids button::after,.msx .msx-pt-bulk .chip::after{height:calc(100% + 11px)} /* 広がりの 100% は枠の内側(36 - 枠 1.5×2)。+11px で 44px、枠の外へは上下 4px ずつ */
.msx .msx-pt-bulk{margin-top:8px}
/* 図鑑の一覧の行も、行そのものを 44px にする(行の間 5px に、上下 4px の広がりが重なっていた) */
.msx .msx-dex-row{min-height:44px}
/* イッサ博士の選択肢は札そのものが大きいので広げない(小さい画面で、上下の選択肢の札に重なっていた) */
.msx .v-ix::after{height:100%}
/* 横画面・大きい文字で中身が縦にあふれるときは、本体の中で送れるようにする(下のボタンは貼りつけて残す) */
.msx.land .v-body,.msx.s320 .v-body{overflow-y:auto;overscroll-behavior:contain}
.msx.land .v-ft{position:sticky;bottom:0;z-index:3}
.msx .v-inp{padding-top:0;padding-bottom:0}.msx .v-inp input{min-height:44px;align-self:stretch}
.msx .v-ft,.msx.land .v-ft{height:auto;min-height:48px;padding-top:2px;padding-bottom:2px}
/* 下の帯のボタンも見た目で44px(2026-11-14 点検「押しにくい」) */
.msx .v-ft{height:auto;min-height:52px;padding-top:4px;padding-bottom:4px}
.msx .v-ft button{min-height:44px}
.msx .v-hd{height:auto;min-height:32px}
/* 文は言葉の途中で折らない(docs/spec/MONSUC_UI.md の 4)。対応していない端末ではいままでどおり */
.msx button,.msx .v-opt,.msx .bub,.msx .v-log,.msx .v-talk,.msx .v-h{word-break:auto-phrase}
/* 能力の列を押すと素質(A〜E)に切り替わる(2026-11-14 社長)。右上の小さな札が押せる印 */
.msx .v-st.tg{position:relative;cursor:pointer;min-height:44px;margin-top:12px;-webkit-tap-highlight-color:transparent}
.msx .v-st.tg:active{transform:translateY(1px)}
.msx .v-st .v-sttg{position:absolute;right:2px;top:-14px;z-index:2;font-size:10px;font-weight:900;line-height:14px;padding:0 6px;border-radius:99px;background:#334155;color:#fde047;border:1px solid #fde04788;pointer-events:none;white-space:nowrap}
.msx .v-st.apton .v-sttg{background:#fde047;color:#422006}
.msx .v-st .ap{display:block;font-size:10.5px;font-weight:900;line-height:1.2;margin-top:1px;color:#e2e8f0;white-space:nowrap}
.msx .v-st .ap.aA{color:#fde047}.msx .v-st .ap.aB{color:#86efac}.msx .v-st .ap.aC{color:#e2e8f0}.msx .v-st .ap.aD{color:#fdba74}.msx .v-st .ap.aE{color:#fca5a5}
/* 画面の決まり(docs/spec/MONSUC_UI.md)の共通の部品: 見せ場の数字 .v-num(真ん中そろえ)・動いた数字の札 .v-gains */
.msx .v-num{text-align:center;line-height:1.15}
.msx .v-num>small{display:block;font-size:11px;font-weight:900;color:#e2e8f0}
.msx .v-num>b{display:inline-flex;align-items:baseline;justify-content:center;gap:8px;font-size:28px;font-weight:900;color:#fde047;font-variant-numeric:tabular-nums}
.msx .v-num>b>small{font-size:.55em;margin-left:-6px}
.msx .v-num>b>em{font-style:normal;font-size:14px;color:#fde047}.msx .v-num>b>em.dn{color:#fca5a5}
.msx .v-gains{display:flex;flex-wrap:wrap;justify-content:center;gap:5px;margin-top:6px}
.msx .v-gains>span{background:#1e1a36;border:1px solid #3b3566;border-radius:10px;padding:3px 10px;font-size:12px;font-weight:900;text-align:center;white-space:nowrap}
.msx .v-gains>span b{color:#fde047;margin-left:4px;font-variant-numeric:tabular-nums}.msx .v-gains>span.dn b{color:#fca5a5}
@media (prefers-reduced-motion:reduce){.msx *{animation:none!important}}
/* はじめの画面(MsxHome・2026-11-14 作り直し): 題字ロゴ・大きな「続きから」・3つの札 */
.msx .v-scene.hm{--mb:14%}
.msx .v-scene.hm .mon{height:38%}.msx .v-scene.hm .gr{width:26%}
.msx.land .v-scene.hm .mon{height:40%}
.msx .v-hm-logo{position:absolute;left:50%;top:6px;transform:translateX(-50%);width:min(92%,360px);filter:drop-shadow(0 4px 6px #0008)}
.msx .v-hm-logo img{display:block;width:100%;height:auto}
.msx .v-hm-deco{position:absolute;inset:0;pointer-events:none}
.msx .v-hm-deco .gs{position:absolute;left:50%;transform:translateX(-50%);bottom:-3px;width:72%;height:9%;border-radius:50%;background:radial-gradient(ellipse,#000a 0,#0000 70%)}
.msx .v-hm-deco-m{position:absolute;transform:translateX(-50%);aspect-ratio:1;animation:msx-breathe 3.2s ease-in-out infinite}
.msx .v-hm-deco-m img{display:block;width:100%;height:100%;object-fit:contain;filter:drop-shadow(0 6px 4px #0007)}
.msx .v-hm-deco-a{position:absolute;transform:translateX(-50%);animation:msx-breathe 3.6s ease-in-out infinite}
.msx .v-hm-deco-a img{display:block;height:100%;width:auto;filter:drop-shadow(0 6px 4px #0007)}
.msx .v-hm-logo .msx-beta-mk{position:absolute;right:0;top:-4px;transform:rotate(10deg);border:2px solid #fff;box-shadow:0 2px 6px #0007;padding:1px 7px}
.msx .v-hm-cont{display:flex;flex-direction:column;align-items:center;gap:1px;width:100%;margin-top:8px;border-radius:18px;padding:10px 10px 9px;background:linear-gradient(90deg,#f472b6,#fb923c);box-shadow:0 4px 0 #9d174d,0 0 18px #f472b688;line-height:1.3;min-width:0}
.msx .v-hm-cont .t{font-size:21px;font-weight:900;white-space:nowrap}
.msx .v-hm-cont .d{font-size:12.5px;font-weight:900;max-width:100%;overflow-wrap:anywhere;text-align:center}
.msx .v-hm-cont .d2{font-size:11px;font-weight:800;color:#fff7ed;max-width:100%;overflow-wrap:anywhere;text-align:center}
.msx .v-hm-lead{margin-top:8px;font-size:12.5px;font-weight:900;text-align:center;line-height:1.45}
.msx .v-hm-lead small{display:block;font-size:10.5px;font-weight:700;color:#cbd5e1}
.msx .v-hm-new{display:block;width:100%;min-height:44px;margin-top:7px;border-radius:99px;padding:8px 10px;font-size:14px;font-weight:900;text-align:center;background:#1e1a36;border:1.5px solid #f9a8d4;color:#fff;white-space:normal}
.msx .v-big.v-hm-new{font-size:18px;padding:14px 10px;border:0;background:linear-gradient(90deg,#f472b6,#fb923c)}
.msx .v-hm-tiles.t4{grid-auto-flow:row;grid-template-columns:1fr 1fr}
.msx .msx-bm-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:8px}
.msx .msx-bm{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;min-width:0;border-radius:14px;padding:8px 4px;background:#1e1a36;border:1.5px solid #64748b;border-bottom-width:3px;line-height:1.25;text-align:center}
.msx .msx-bm img{width:100%;max-width:84px;aspect-ratio:1;border-radius:11px;object-fit:cover;background:linear-gradient(180deg,#94a3b8,#64748b);border:2px solid #475569}
.msx .msx-bm-grid{padding-bottom:12px}
.msx .msx-bm b{font-size:12px;font-weight:900;max-width:100%;word-break:keep-all}
.msx .msx-bm small{font-size:10px;font-weight:800;color:#fde68a}
.msx .v-hm-tiles{display:grid;grid-auto-flow:column;grid-auto-columns:1fr;gap:7px;margin-top:8px}
.msx .v-hm-tile{display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:62px;min-width:0;border-radius:14px;padding:5px 3px;background:#1e1a36;border:1.5px solid #64748b;border-bottom-width:3px;line-height:1.2}
.msx .v-hm-tile .e{font-size:22px;line-height:1.1}
.msx .v-hm-tile b{font-size:11.5px;font-weight:900;max-width:100%;overflow-wrap:anywhere;text-align:center}
.msx .v-hm-tile small{font-size:10px;font-weight:800;color:#fde047}
.msx.land .v-hm .v-hm-cont{margin-top:5px}
.msx.s320 .v-hm-cont .t{font-size:18px}.msx.s320 .v-hm-tile{min-height:54px}.msx.s320 .v-hm-tile .e{font-size:19px}
/* トレーニングを選ぶ画面: スライドで替わったとき、場面の中身が少し横に流れる(左へスライド=右から入る) */
@keyframes msxSwL{from{transform:translateX(22px);opacity:.55}to{transform:none;opacity:1}}
@keyframes msxSwR{from{transform:translateX(-22px);opacity:.55}to{transform:none;opacity:1}}
.msx .v-scene.msx-swl>*:not(.sh):not(.bg){animation:msxSwL .22s ease-out}
.msx .v-scene.msx-swr>*:not(.sh):not(.bg){animation:msxSwR .22s ease-out}
/* 育成イベントの選択肢(2026-11-14 社長「選択肢が押しにくい。詳細ボタンがずれてる」): 押せる高さ52px以上・塗りと押したときの沈み・「i」は選択肢と同じ高さで中心をそろえる */
.msx .v-opts{gap:10px;margin-top:8px}
.msx .v-opts .v-opt{min-height:52px;display:flex;flex-direction:column;justify-content:center;padding:8px 14px;border-radius:16px;background:linear-gradient(180deg,#43307a,#2a2052);border:2px solid #f472b6;border-bottom-width:5px;box-shadow:0 2px 8px #0006;font-size:14px;font-weight:900;line-height:1.35;color:#fff;text-align:left}
.msx .v-opts .v-opt:not(:disabled):active{transform:translateY(3px);border-bottom-width:2px;margin-bottom:3px;background:linear-gradient(180deg,#5b3f9e,#3b2a6b)}
.msx .v-opts .v-opt small{display:block;font-size:10.5px;color:#86efac;font-weight:800;margin-top:1px}
.msx .v-opts .msx-optrow{display:flex;gap:8px;align-items:stretch}
.msx .v-opts .msx-optrow>.v-opt{flex:1;min-width:0}
.msx .v-opts .msx-info{flex:none;align-self:stretch;width:52px;min-height:52px;display:flex;align-items:center;justify-content:center;padding:0;border-radius:16px;background:linear-gradient(180deg,#164e74,#0c3350);border:2px solid #7dd3fc;border-bottom-width:5px;color:#e0f2fe;font-size:20px;font-weight:900;line-height:1}
.msx .v-opts .msx-info.on{background:#0369a1;color:#fff}
.msx .v-opts .msx-info:not(:disabled):active{transform:translateY(3px);border-bottom-width:2px;margin-bottom:3px}
/* 育成のメイン画面: 編成の顔の列(6体+助手)と「持ち物」が重ならないよう、持ち物は右下の「くわしく」の上へ置く(2026-11-14 社長「持ち物と編成がかぶってる」。
   忠誠・人気の札を上の帯へ移して右下が空いた)。編成の列は場面の高さに合わせて顔を縮め、場面の下からはみ出さない。
   列の中 = 枠の内側9 + 「編成」の字(大きい文字でも収まるよう20) + すき間 + 顔×7(幅320は2列×4段)、上下6ずつ */
.msx .v-scene.home{container-type:size}
.msx .v-scene.home .v-bagb:not(.r){left:auto;right:7px;bottom:59px}
.msx.s320 .v-scene.home .v-bagb:not(.r){bottom:51px}
/* 2026-11-14 社長「編成の7体目が切れる」(iPhone の縦で場面が低いとき): 顔の下の親密度の棒(1体 6px)を式に入れ、場面が低いときは2列×4段に並べ替える */
.msx .v-scene.home .v-party{--pfs:clamp(14px,calc((100cqh - 12px - 29px - 24px - 42px) / 7),30px)}
.msx.land .v-scene.home .v-party{--pfs:clamp(14px,calc((100cqh - 12px - 29px - 18px - 42px) / 7),24px)}
.msx.s320 .v-scene.home .v-party{--pfs:clamp(14px,calc((100cqh - 12px - 29px - 9px - 24px) / 4),22px)}
@container (max-height:260px){
  .msx .v-scene.home .v-party{display:grid;grid-template-columns:1fr 1fr;gap:3px 4px;--pfs:clamp(14px,calc((100cqh - 12px - 29px - 9px - 24px) / 4),26px)}
  .msx .v-scene.home .v-party>small{grid-column:1/-1;text-align:center}
}
.msx .v-scene.home .v-party .v-pf,.msx .v-scene.home .v-party .v-pf img{width:var(--pfs)}
.msx .v-scene.home .v-party .v-pf img{height:var(--pfs)}
/* 場面がとても低いとき(幅320で大きい文字など): 編成は4列×2段に並べ替え、上の札は右下の持ち物・くわしくの左で止める */
@container (max-height:210px){
  .msx .v-scene.home .v-party{display:grid;grid-template-columns:repeat(4,auto);gap:2px 3px;--pfs:20px}
  .msx .v-scene.home .v-party>small{grid-column:1/-1;text-align:center}
  .msx .v-scene.home .v-chips{right:58px}
}
/* 上の帯の忠誠・人気の行(2026-11-14 社長「忠誠度と人気を上部に」)と、休む・遊ぶ・通院で棒が前の値から伸び縮みする動き */
.msx .v-b3{display:flex;gap:14px;margin-top:4px;font-size:10.5px;font-weight:900;white-space:nowrap;color:#e2e8f0;line-height:1.25}
.msx .v-b3 span{display:inline-flex;align-items:baseline;gap:3px}
.msx .v-b3 b{font-size:12.5px;color:#fff}
.msx .v-b3 small{font-size:11px;color:#cbd5e1;font-weight:700} /* 忠誠の「/100」: 指定が無いとブラウザ既定の80%で 8px になっていた(API 点検 ④ 2026-11-20) */
.msx .v-b3 .v-dl{font-style:normal;font-size:10.5px;font-weight:900;animation:msxDl 2.6s ease-out both}
.msx .v-b3 .v-dl.up{color:#86efac}.msx .v-b3 .v-dl.dn{color:#fca5a5}
@keyframes msxDl{0%{opacity:0;transform:translateY(4px)}12%{opacity:1;transform:none}75%{opacity:1}100%{opacity:0}}
@keyframes msxBarGrow{from{width:var(--w0)}}
/* 押し物の見た目の高さをそろえる(2026-11-14 点検「押しにくい」): はじめる画面のタブ・まとめの行・叱る/褒めるの「なにもしない」は44px、上の「← 中断」は36px(押せる範囲は ::after で44px) */
.msx .v-tabs button{min-height:44px;display:flex;align-items:center;justify-content:center}
.msx .v-sum{min-height:44px}
.msx .v-ch{min-height:44px}
.msx .v-hd .bk{min-height:36px;display:inline-flex;align-items:center}
/* はじめる画面の「2 編成」(2026-11-14 社長「文字のはみ出し」): 6体の札は残りの高さを使って中身を真ん中に(下に空きを残さない)・得意の印は札の中に収める・集まりやすさの札は絵を上に大きく */
.msx .v-slots{flex:1 0 auto;align-content:stretch}
.msx .v-sl .v-pf.lg,.msx .v-sl .v-pf.lg img{width:clamp(34px,8.5vh,72px)}.msx .v-sl .v-pf.lg img{height:clamp(34px,8.5vh,72px)}
.msx .v-sl .ic{max-width:100%;white-space:normal;word-break:keep-all;overflow-wrap:anywhere}
.msx .v-sl{display:flex;flex-direction:column;align-items:center;justify-content:center}
.msx .v-heat .hi{display:block;font-size:16px;line-height:1.15;margin-bottom:1px}
/* r1114-065: 札の中の言葉は語の切れ目でだけ折る */
.msx .v-hm-tile b{word-break:keep-all;overflow-wrap:normal}
/* 下のボタンの列・タブの字は、上下左右ともボタンの真ん中(r1115-066) */
.msx .v-ft button,.msx .v-ft span,.msx .v-tabs button,.msx .v-tabs span{display:flex!important;align-items:center;justify-content:center;text-align:center}
/* 編成の選ぶ画面(全画面)・フレンドの一覧・おまかせ/効果一覧(r1115-096・参考 team-select-2026-11-15)。ボタンの中の字は上下左右とも真ん中(r1115-066)・タブと絞り込みは横に流さず画面の幅に収める(r1115-094 の縦揺れも起きない) */
.msx .msx-team6 .v-sl{display:flex;flex-direction:column;align-items:center;justify-content:center}
.msx .msx-sl-fr{display:block;font-style:normal;font-size:10px;font-weight:900;color:#7dd3fc;line-height:1.2;margin-bottom:2px}
.msx .msx-team-acts{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-top:6px;flex:none}
.msx .msx-team-acts button{display:flex;align-items:center;justify-content:center;text-align:center;min-height:44px;border-radius:12px;font-size:13px;font-weight:900;color:#422006;background:linear-gradient(180deg,#fef3c7,#fcd34d);box-shadow:0 3px 0 #a16207}
.msx .msx-team-acts button:disabled{opacity:.45}
.msx .msx-tp-ov{padding:0;align-items:stretch;justify-content:stretch;background:#0b0920;z-index:45}
.msx .msx-tp{display:flex;flex-direction:column;width:100%;min-width:0;max-width:100%;height:100%;min-height:0;background:linear-gradient(180deg,#241d4a,#16122e)}
.msx .msx-tp>*{flex:none;align-self:stretch;min-width:0}
.msx .msx-tp-hd{display:flex;align-items:baseline;gap:8px;padding:8px 12px 4px}.msx .msx-tp-hd b{font-size:15px;color:#f9a8d4}.msx .msx-tp-hd small{font-size:10.5px;color:#cbd5e1}
.msx .msx-tp-team{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:4px;padding:6px 8px;margin:0 8px;background:#0f172a;border:1px solid #f472b688;border-radius:12px}
.msx .msx-tp-tm{display:flex;flex-direction:column;align-items:center;min-width:0}
.msx .msx-tp-tm .fc{flex:none;display:block;width:100%;height:auto;border-radius:10px;background:#1e1a36;border:2px solid #475569;overflow:hidden}
/* 正方形はスペーサーで決める(.v-grid6 と同じ方式。aspect-ratio に頼らない) */
.msx .msx-tp-tm .fc::before{content:'';display:block;padding-top:100%}
.msx .msx-tp-tm .fc>img,.msx .msx-tp-tm .fc>div{position:absolute!important;inset:0;width:100%;height:100%}
.msx .msx-tp-tm .fc img{width:100%;height:100%;object-fit:contain}.msx .msx-tp-tm .fc i{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-style:normal;font-weight:900;color:#64748b}
.msx .msx-tp-tm.on .fc{border-color:#fde047;box-shadow:0 0 0 2px #fde047}
.msx .msx-tp-tm .fc{position:relative}.msx .msx-tp-tm .fc .fr{position:absolute;right:1px;bottom:0;font-size:12px;line-height:1}
.msx .msx-tp-chips{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:4px;padding:6px 8px 2px}
.msx .msx-tp .msx-tp-chips button{min-width:0;padding:0 2px;font-size:11.5px;overflow:hidden}
.msx .msx-tp-tabs{display:flex;flex-wrap:wrap;gap:5px;padding:6px 8px 2px}
.msx .msx-tp .msx-tp-tabs button{flex:1 1 auto;min-width:0;font-size:11.5px;padding:2px 8px;white-space:nowrap;line-height:1.15;flex-direction:column;gap:0;border-radius:12px}
.msx .msx-tp-tabs button,.msx .msx-tp-chips button{flex:none;display:flex;align-items:center;justify-content:center;gap:4px;min-height:44px;padding:0 12px;border-radius:99px;font-size:12px;font-weight:900;color:#fff;background:#2b3348;white-space:nowrap}
.msx .msx-tp-tabs button small{font-size:10px;color:#cbd5e1}.msx .msx-tp-tabs button.fr{background:#0c4a6e;color:#e0f2fe}
.msx .msx-tp-tabs button.on,.msx .msx-tp-chips button.on{background:#fde047;color:#422006}.msx .msx-tp-tabs button.on small{color:#713f12}
.msx .msx-tp-bar{display:flex;align-items:center;gap:6px;padding:4px 8px}
.msx .msx-tp-sel{display:flex;align-items:center;gap:4px;font-size:10.5px;color:#cbd5e1}
.msx .msx-tp-sel select{min-height:44px;border-radius:8px;background:#0f172a;color:#fff;border:1px solid #4a4380;font:inherit;font-size:12px;font-weight:900;padding:0 4px}
.msx .msx-tp-cnt{margin-left:auto;font-size:12px;font-weight:900;color:#f9a8d4}
.msx .msx-tp-note{font-size:10px;color:#cbd5e1;line-height:1.4;padding:2px 10px}
.msx .msx-tp>.msx-tp-list{flex:1 1 0;min-height:0;overflow-y:auto;overflow-x:hidden;display:flex;flex-wrap:wrap;gap:8px 6px;align-content:flex-start;align-items:flex-start;padding:6px 8px 10px}
.msx .msx-tp>.msx-tp-list>.msx-tp-c{flex:none;width:calc((100% - 12px) / 3)}
.msx .msx-tp>.msx-tp-list.one>*{flex:none;width:100%}
.msx .msx-tp>.msx-tp-list>.msx-tp-w{flex:none;width:calc((100% - 12px) / 3);display:flex;flex-direction:column;gap:3px;min-width:0}
.msx .msx-tp>.msx-tp-list.one>.msx-tp-w{width:100%}
.msx .msx-tp-w>.msx-tp-c,.msx .msx-tp-w>.msx-fp-r{width:100%}
.msx .msx-tp-dt{flex:none;width:100%;min-height:44px;border-radius:8px;background:#1e293b;border:1px solid #4a4380;color:#f9a8d4;font:inherit;font-size:11px;font-weight:900;padding:3px 4px;text-align:center}
.msx .msx-md-sup{margin-top:8px}
.msx .msx-pt{display:flex;flex-wrap:wrap;align-items:center;gap:6px;min-width:0}
/* 選ぶ画面の組み立て(統一): 操作行は自然な高さにする。横に伸ばすのは横並びの帯(.msx-tp-bar)の中だけ(縦並びの画面で操作行が縦に伸びて一覧を潰していた) */
.msx .msx-tp-bar>.msx-pt{flex:1 1 220px}
.msx .msx-pt-q{flex:1 1 120px;min-width:0;min-height:44px;border-radius:8px;background:#0f172a;color:#fff;border:1px solid #4a4380;font:inherit;font-size:16px;padding:4px 8px}
.msx .msx-pt-s select{min-height:44px;border-radius:8px;background:#0f172a;color:#fff;border:1px solid #4a4380;font:inherit;font-size:12px;font-weight:900;padding:0 4px}
.msx .msx-pt-r{flex:none;min-height:44px;border-radius:8px;background:#1e293b;border:1px solid #4a4380;color:#cbd5e1;font:inherit;font-size:11px;font-weight:900;padding:4px 10px}
.msx .msx-pt-r.on{background:#3b1736;color:#f9a8d4;border-color:#f472b6}
.msx .msx-pt-c{flex:none;font-size:11px;font-weight:900;color:#f9a8d4;white-space:nowrap}
/* スマホ向け(モンサク改善4): 狭い縦画面で操作が折り返す・効果説明が最後まで読める・下の操作がホームインジケーターに重ならない */
.msx .msx-tp-bar{flex-wrap:wrap}
.msx .msx-tp-ov{padding-bottom:max(14px,var(--mh-sa-bottom,0px))}
.msx [data-msx-team-effects] .msx-gt-mon{flex-wrap:wrap}
.msx [data-msx-team-effects] .msx-gt-mon .v{flex:1 1 100%;text-align:left;padding-left:32px;overflow-wrap:anywhere;line-height:1.45}
.msx .msx-md-kv span{overflow-wrap:anywhere}
/* 高さの短い画面では編成の帯を詰める(選んでいる編成が見えるままにする) */
@media (max-height:620px){
.msx .msx-tp-hd{padding-top:4px;padding-bottom:0}
.msx .msx-tp-team{gap:3px;padding:4px 6px}
.msx .msx-tp-dt{min-height:44px}
.msx .msx-pt-q,.msx .msx-pt-s select,.msx .msx-pt-r{min-height:44px}
}
.msx .msx-tp-c{position:relative;display:flex;flex-direction:column;align-items:center;gap:2px;min-width:0;padding:5px 3px 6px;border-radius:12px;background:#0f172a;border:2px solid #334155;color:#fff;font:inherit;text-align:center;-webkit-touch-callout:none;user-select:none}
.msx .msx-tp-c.on{border-color:#fde047;background:#3b2f0b;box-shadow:0 0 0 2px #fde047,0 0 12px #fde04766}
.msx .msx-tp-c.lk{opacity:.5}
/* 顔はボックス式の升目(.mmg)と同じ円+金の輪にする。height:auto を明示しないと汎用の .msx .fc{height:40px} が勝ち、正方形スペーサーが切れて顔が帯状に潰れる(2026-11-18 社長の実機報告「アシモン一覧の表示がおかしい」の原因) */
.msx .msx-tp-c .fc{display:block;position:relative;flex:none;width:100%;height:auto;border-radius:50%;overflow:hidden;background:radial-gradient(circle at 50% 35%,#e0e7ff 0,#a5b4fc 75%);border:2.5px solid #fde047;box-shadow:0 2px 0 #0006}
.msx .msx-tp-c.on .fc{border-color:#f472b6;box-shadow:0 0 0 3px #f472b6}
/* 正方形はスペーサーで決める(.v-grid6 と同じ方式。aspect-ratio に頼らない) */
.msx .msx-tp-c .fc::before{content:'';display:block;padding-top:100%}
.msx .msx-tp-c .fc>img,.msx .msx-tp-c .fc>.mm-art{position:absolute;inset:0;width:100%;height:100%}
.msx .msx-tp-c .fc img{width:100%!important;height:100%!important;object-fit:contain}
.msx .msx-tp-c .fc .mm-art{display:block;width:100%;height:100%}
.msx .msx-tp-c .rk,.msx .msx-fp-r .rk{position:absolute;right:3px;top:3px;font-style:normal}
.msx .msx-tp-c .ck{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);font-style:normal;font-size:26px;font-weight:900;color:#fff;text-shadow:0 2px 4px #000;z-index:2}
.msx .msx-tp-c .mk{position:absolute;left:50%;transform:translateX(-50%);bottom:4px;max-width:94%;font-style:normal;z-index:2}
.msx .mk{display:block;font-style:normal;font-size:10px;font-weight:900;line-height:16px;border-radius:8px;padding:0 4px;background:#0f0d24e6;color:#fff;border:1px solid #64748b;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;text-align:center}
.msx .mk.in{border-color:#f472b6;color:#f9a8d4}.msx .mk.sp,.msx .mk.own{border-color:#fde047;color:#fde047}.msx .mk.lk{border-color:#94a3b8;color:#e2e8f0}.msx .mk.dup{border-color:#fb923c;color:#fdba74}
.msx .msx-tp-c .nm{max-width:100%;font-size:10.5px;font-weight:900;background:#0f0d24;border-radius:8px;padding:1px 6px;line-height:15px;height:17px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.msx .msx-tp-c .tp,.msx .msx-fp-r .tp{display:flex;flex-wrap:wrap;justify-content:center;column-gap:4px;font-size:10px;font-weight:900;color:#86efac;line-height:1.25}
/* カードの中身は行ごとに高さを固定し、印の有無や得意の折り返しで背丈がずれないようにする(2026-11-18 社長) */
.msx .msx-tp-c .tp{flex-wrap:nowrap;height:13px;overflow:hidden;align-items:center}
.msx .msx-tp-c .lv{font-size:10px;color:#cbd5e1;white-space:nowrap;line-height:13px;height:13px}
.msx .msx-tp-none{width:100%;font-size:11.5px;color:#cbd5e1;text-align:center;padding:24px 8px}
.msx .msx-fp-r{display:flex;align-items:center;gap:8px;min-width:0;min-height:64px;padding:6px 8px;border-radius:12px;background:#0f172a;border:2px solid #334155;color:#fff;font:inherit;text-align:left}
.msx .msx-fp-r.on{border-color:#fde047;background:#3b2f0b;box-shadow:0 0 0 2px #fde047,0 0 12px #fde04766}.msx .msx-fp-r.lk{opacity:.6}
.msx .msx-fp-r .fc{position:relative;flex:none;width:56px;height:56px;border-radius:10px;overflow:hidden;background:#1e1a36}
.msx .msx-fp-r .fc img{width:100%;height:100%;object-fit:cover;object-position:50% 30%}
.msx .msx-fp-r .tx{flex:1;min-width:0;display:flex;flex-direction:column;gap:1px}
.msx .msx-fp-r .tx small{font-size:10px;color:#7dd3fc;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.msx .msx-fp-r .tx b{font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.msx .msx-fp-r .tx .tp{justify-content:flex-start}
.msx .msx-fp-r .st{flex:none;display:flex;flex-direction:column;gap:3px;max-width:42%}
.msx .msx-tp-ft{position:static;flex:none}
.msx .msx-tp-ft button{display:flex;align-items:center;justify-content:center}
/* 能力ポイントの刻み(1・5・10・100・MAX)と長押し(r1115-092) */
.msx .msx-ptunit{display:grid;grid-template-columns:repeat(5,1fr);gap:4px;margin:6px 0}
.msx .msx-ptunit .chip{min-height:40px;padding:0 2px;justify-content:center;text-align:center;font-size:12px;font-weight:900}
.msx .pt44{min-width:44px;min-height:44px}
.msx .sym{-webkit-user-select:none;user-select:none}
/* 動いた数字の札 MsxGaugeFx(r1115-047・054): ゲージが伸び縮み・数字が数え上がり・増減の数字が浮かぶ */
.msx .v-gfx{background:#1e1a36;border:1px solid #3b3566;border-radius:14px;padding:8px;margin-top:6px;display:flex;flex-direction:column;gap:6px}
.msx .v-gfx .hd2{font-size:11px;font-weight:900;color:#fde047}
.msx .v-gfx .r{position:relative;display:grid;grid-template-columns:minmax(64px,28%) 1fr auto;align-items:center;gap:8px;min-height:26px}
.msx .v-gfx .n{font-size:12px;font-weight:900;white-space:nowrap}.msx .v-gfx .n .e{margin-right:3px}
.msx .v-gfx .tr{position:relative;height:9px;border-radius:5px;background:#0f0d24;border:1px solid #2f2a55;overflow:hidden}
.msx .v-gfx .tr i{display:block;height:100%;border-radius:5px;background:linear-gradient(90deg,#fde047,#f59e0b)}
.msx .v-gfx .r.hp .tr i{background:linear-gradient(90deg,#86efac,#22c55e)}
.msx .v-gfx .r.st .tr i{background:linear-gradient(90deg,#c4b5fd,#8b5cf6)}
.msx .v-gfx .r.bd .tr i{background:linear-gradient(90deg,#fca5a5,#ef4444)}
.msx .v-gfx .v{font-size:13px;font-weight:900;font-variant-numeric:tabular-nums;min-width:3.4em;text-align:right}
.msx .v-gfx .dl{position:absolute;right:0;top:-8px;font-style:normal;font-size:13px;font-weight:900;pointer-events:none;animation:msxGfxFloat 1.6s ease-out both;text-shadow:0 1px 0 #000}
.msx .v-gfx .dl.up{color:#fde047}.msx .v-gfx .dl.dn{color:#fca5a5}
@keyframes msxGfxFloat{0%{opacity:0;transform:translateY(8px) scale(.8)}18%{opacity:1;transform:translateY(-4px) scale(1.15)}70%{opacity:1;transform:translateY(-10px) scale(1)}100%{opacity:0;transform:translateY(-16px) scale(1)}}
@media (prefers-reduced-motion:reduce){.msx .v-gfx .dl{animation:none;opacity:1;transform:none}}
/* ④段2(r1119-011・U-4): 枠を選ぶ画面を共通の型(MonsucMonCard・MONSUC_UI.md の 8)へ。上の6枠も下の一覧も同じ縦長の札。
   タブ・検索の段は1行・見た目 36px・押せる範囲 44px。下のボタンは同じ高さ・同じ形で、主は「決定」だけ */
.msx .msx-tp-team{padding:6px;gap:5px}
.msx .msx-tp-tm{position:relative}
.msx .msx-tp-tm .mcd{gap:0}
.msx .msx-tp-tm .mcd-nms,.msx .msx-tp-tm .mcd-fav{display:none}
.msx .msx-tp-tm .mcd .mcd-gd{font-size:10px}
.msx .msx-tp-tm .mcd .mcd-f.empty .mcd-plus{font-size:15px;color:#cbd5e1}
.msx .msx-tp-tm.on .mcd-f{box-shadow:0 0 0 3px #fde047}
.msx .msx-tp-list .mcd.s .mcd-note,.msx .msx-tp-list .mcd.s .mcd-fav i,.msx .msx-tp-list .mcd.s .mcd-gd,.msx .msx-tp-tm .mcd.s .mcd-gd{font-size:10px}
.msx .msx-tp-tm>.fr{position:absolute;right:2px;bottom:2px;font-size:13px;line-height:1}
.msx .msx-tp>.msx-tp-list{display:block;padding:2px 6px 10px}
.msx .msx-tp>.msx-tp-list .mcd-grid{padding:4px 0}
.msx .msx-tp-tabs{flex-wrap:nowrap;gap:5px;padding:6px 8px 0}
.msx .msx-tp .msx-tp-tabs button{flex:1 1 0;min-height:36px;height:36px;padding:0 4px;margin:4px 0;font-size:11.5px;line-height:1.1;border-radius:10px}
.msx .msx-tp .msx-tp-tabs button::after{content:'';position:absolute;left:0;right:0;top:-4px;bottom:-4px}
.msx .msx-tp .msx-tp-tabs button{position:relative}
.msx .msx-tp .msx-tp-tabs button.on{background:linear-gradient(90deg,#f472b6,#fb923c);color:#fff}.msx .msx-tp .msx-tp-tabs button.on small{color:#fff}
.msx .msx-tp-bar{flex-wrap:nowrap;gap:4px;padding:2px 8px}
.msx .msx-tp-bar>.msx-pt{flex:1 1 0;flex-wrap:nowrap;gap:4px}
.msx .msx-tp-bar .msx-pt-q{flex:1 1 0;min-width:60px;height:44px;padding:0 6px}
.msx .msx-tp-bar .msx-pt-s select,.msx .msx-tp-bar .msx-tp-sel select{height:44px;max-width:76px;font-size:11.5px}
.msx .msx-tp-bar .msx-pt-r{height:44px;padding:0 6px}
.msx .msx-tp-ft button{flex:1 1 0;height:40px}.msx .msx-tp-ft button.go{flex:1.5 1 0}
/* ④段2: 2/6「編成の6体」(共通の型の中の札・3列×2段)と、下の帯の3つのボタン(おまかせ・効果一覧・この編成でいく) */
.msx .msx-team6c{flex:none;margin-top:4px}
.msx .msx-team6c~.msx-heat-btn{margin-top:auto} /* 余った高さは表の上に回し、下に空きを残さない */
.msx .msx-team6c .mcd-grid.m{padding:2px 4px;gap:8px 10px}
.msx .msx-team6c .msx-t6w{display:flex;flex-direction:column;gap:2px;min-width:0}
.msx .msx-team6c .msx-t6b{font-size:10.5px;font-weight:800;color:#cbd5e1;text-align:center;white-space:nowrap}
.msx .msx-ft3 button{flex:1 1 0}.msx .msx-ft3 button.go{flex:1.6 1 0}
.msx .msx-ft3 button:disabled{opacity:.45}
/* ④段2: 効果一覧(編成の合計の表・効果ごと/モンスターごと) */
.msx .msx-ef h3{display:flex;align-items:baseline;gap:8px}.msx .msx-ef h3 small{font-size:12px;color:#cbd5e1}
.msx .msx-ef-tabs{display:flex;gap:6px;margin:6px 0}
.msx .msx-ef-tabs button{position:relative;flex:1 1 0;display:flex;align-items:center;justify-content:center;padding:0;height:36px;margin:4px 0;border-radius:10px;background:#1e293b;border:1px solid #4a4380;color:#cbd5e1;font:inherit;font-size:12.5px;font-weight:900}
.msx .msx-ef-tabs button::after{content:'';position:absolute;left:0;right:0;top:-4px;bottom:-4px}
.msx .msx-ef-tabs button.on{background:linear-gradient(90deg,#f472b6,#fb923c);color:#fff;border-color:transparent}
.msx .msx-ef-how{font-size:11px;color:#cbd5e1;line-height:1.5;margin:0 0 6px}
.msx .msx-ef .one{display:inline-block;margin-left:5px;padding:0 6px;border-radius:7px;background:#7c3aed;color:#fff;font-size:10px;font-style:normal;font-weight:900;line-height:1.6;vertical-align:1px}
.msx .msx-ef-row{border:1px solid #3b3566;border-radius:12px;background:#1e1a36;margin-bottom:6px;overflow:hidden}
.msx .msx-ef-row.on{border-color:#f472b6}
.msx .msx-ef-hd{display:flex;align-items:center;gap:7px;width:100%;min-height:52px;padding:6px 8px;background:none;border:0;color:#fff;font:inherit;text-align:left}
.msx .msx-ef-hd .ic{flex:none;width:26px;text-align:center}
.msx .msx-ef-hd .tx{flex:1 1 auto;min-width:0;display:flex;flex-direction:column;gap:3px}
.msx .msx-ef-hd .nm{font-size:13px;font-weight:900;line-height:1.25}
.msx .msx-ef-hd .gg{display:block;height:6px;border-radius:4px;background:#334155;overflow:hidden}.msx .msx-ef-hd .gg i{display:block;height:100%;background:linear-gradient(90deg,#fde047,#fb923c)}
.msx .msx-ef-hd .cap{font-size:10.5px;color:#94a3b8;font-weight:800}
.msx .msx-ef-hd .val{flex:none;font-size:14px;font-weight:900;color:#fde68a;white-space:nowrap}
.msx .msx-ef-hd .fcs{flex:none;display:flex;align-items:center}
.msx .msx-ef-fc{display:inline-block;width:24px;height:24px;border-radius:50%;overflow:hidden;background:#312e81;border:1.5px solid #a5b4fc;margin-left:-6px}
.msx .msx-ef-fc:first-child{margin-left:0}.msx .msx-ef-fc img{width:100%;height:100%;object-fit:cover}
.msx .msx-ef-fc.dim{opacity:.35}
.msx .msx-ef-ex{padding:0 10px 8px;border-top:1px solid #3b3566}
.msx .msx-ef-ex p{font-size:11.5px;line-height:1.55;color:#e2e8f0;margin:6px 0}
.msx .msx-ef-mon{display:flex;align-items:center;gap:6px;font-size:11.5px;padding:2px 0}.msx .msx-ef-mon .nm{font-weight:900}.msx .msx-ef-mon .v{margin-left:auto;color:#fde68a;font-weight:900;text-align:right}
.msx .msx-ef-mon.dim .v{color:#94a3b8;font-weight:700}
.msx .msx-ef-mrow{border:1px solid #3b3566;border-radius:12px;background:#1e1a36;padding:7px 8px;margin-bottom:6px}
.msx .msx-ef-mrow .hd{display:flex;align-items:center;gap:6px;flex-wrap:wrap}.msx .msx-ef-mrow .hd b{font-size:13px;flex:1 1 auto;text-align:left}.msx .msx-ef-mrow .hd small{font-size:10.5px;color:#cbd5e1}
.msx .msx-ef-mrow .chips{display:flex;flex-wrap:wrap;gap:4px;margin-top:5px}
.msx .msx-ef-mrow .chips span{font-size:11px;font-weight:800;background:#0f172a;border:1px solid #475569;border-radius:8px;padding:2px 7px}.msx .msx-ef-mrow .chips span b{color:#fde68a}
.msx .msx-ef-mrow .chips span.dim{opacity:.5}.msx .msx-ef-mrow .chips .none{color:#94a3b8}
/* Muse id51(④段3): 技詳細の項目名の列を中身の幅に合わせる。8.1em 固定だと、いちばん長い「クリティカル率」の行だけ値が右へずれていた。
   技詳細の欄(.msx-md-td)を2列の grid にし、各行は subgrid で同じ列に載せる(subgrid の無い端末は今までの 8.1em のまま) */
@supports (grid-template-columns:subgrid){
.msx-md-td{display:grid;grid-template-columns:max-content minmax(0,1fr);column-gap:8px}
.msx-md-td>*{grid-column:1/-1}
.msx-md-td>.msx-md-kv{display:grid;grid-template-columns:subgrid;gap:normal;align-items:baseline}
.msx-md-td>.msx-md-kv>b{min-width:0}
}
/* r1119-019: 甘え度・恐れ度が何で動いたか(上の帯の右の短い字・能力のページの一覧) */
.msx .v-b3:has(.v-lw){flex-wrap:wrap;row-gap:1px}
.msx .v-b3 .v-lw{margin-left:auto;color:#fde68a;font-size:10.5px} /* 入らないときは次の行の右へ(字は切らない) */
.msx .v-b3 .v-lw small{font-size:10.5px;color:#cbd5e1;font-weight:800;white-space:nowrap}
.msx .v-lwl .r{display:flex;gap:6px;align-items:baseline;font-size:11px;padding:2px 0;border-bottom:1px solid #1e293b}
.msx .v-lwl .r i{flex:none;font-style:normal;color:#94a3b8;width:4.6em}.msx .v-lwl .r span{flex:1;min-width:0}.msx .v-lwl .r b{flex:none;color:#fde68a}
.msx .v-come:has(.msx-cm-tap){gap:4px}
.msx .msx-cm-tap::after{display:none}
.msx .msx-cm-tap{font:inherit;color:inherit;text-align:left;width:100%;cursor:pointer;min-height:44px} /* 編成のモンスターの札(押すとアシスト詳細) */
/* API 点検(④段2 PR): 選んでいないタブは同じ暗い色(フレンドの青緑が「選ばれている」に見えた)・得意の絞りは字が切れない幅 */
.msx .msx-tp .msx-tp-tabs button.fr:not(.on){background:#1e293b;color:#cbd5e1}
.msx .msx-tp-bar .msx-tp-sel select{max-width:none;width:84px}
.msx .msx-tp-bar .msx-pt-s select{max-width:66px}
`;


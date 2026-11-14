// ===== モンヒロサクセス(育成の画面・回2)の見た目 =====
// 見本(docs/progress/player-raise/mock/v3.css・mock.css)の部品を、この画面の中(.msx)だけに効くよう切り出したもの。
// 見本の「スマホの枠」(.phone)は、ここでは画面いっぱいの .msx。横向きは .msx.land、幅340以下は .msx.s320。
// アニメの名前は msx- を頭に付けて、ほかの画面とぶつからないようにした。下の「足したもの」はゲームの中で要った分
const MSX_CSS = `

.msx{position:relative;overflow:hidden;color:#fff;font-weight:700;font-size:12px;line-height:1.45;
  background:linear-gradient(180deg,#1d1740 0,#151130 45%,#0f0d24 100%)}
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
.msx .chip{display:inline-block;border-radius:99px;padding:2px 9px;font-size:11px;font-weight:900;background:#0f172a;border:1px solid #475569;color:#cbd5e1;white-space:nowrap}
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
.msx .v-band{background:linear-gradient(180deg,#241d4a,#1a1636);border:1px solid #4a4380;border-radius:14px;padding:6px 8px 6px;margin-top:5px;box-shadow:inset 0 1px 0 #ffffff14}
.msx .v-b1{display:flex;align-items:center;gap:6px}
.msx .v-turn{flex:1;min-width:0;display:flex;align-items:center;gap:6px}
.msx .v-turn .ph{background:linear-gradient(160deg,#f472b6,#fb923c);border-radius:9px;padding:3px 7px;font-size:11px;font-weight:900;line-height:1.15;text-align:center;white-space:nowrap;box-shadow:0 2px 0 #9d174d}
.msx .v-turn .ph small{display:block;font-size:10px;font-weight:700;opacity:.95}
.msx .v-turn .n{font-size:11px;font-weight:900;white-space:nowrap;line-height:1}
.msx .v-turn .n b{font-size:30px;color:#fde047;margin:0 2px;letter-spacing:-.02em;text-shadow:0 2px 0 #9a3412,0 0 12px #fde04766}
.msx .v-turn .n small{display:block;font-size:10px;color:#cbd5e1;font-weight:700;margin-top:3px}
.msx .v-turn .n small em{font-style:normal;color:#fff;font-weight:900}
.msx .v-pow{display:flex;align-items:center;gap:5px;background:#0f172a;border:1px solid #f472b6aa;border-radius:11px;padding:3px 7px 3px 8px;line-height:1.1}
.msx .v-pow small{display:block;font-size:10px;color:#f9a8d4;font-weight:900;white-space:nowrap}
.msx .v-pow b{font-size:17px;color:#fde047;white-space:nowrap}
.msx .v-pow .rk.big{height:28px;min-width:28px;font-size:17px;box-shadow:0 2px 0 #0008}
.msx .v-b2{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:6px}
.msx .v-ga{display:flex;align-items:center;gap:4px;font-size:10px;font-weight:900;white-space:nowrap}
.msx .v-ga .tr{flex:1;min-width:0;height:13px;border-radius:99px;background:#0b0920;border:1px solid #475569;position:relative;overflow:hidden}
.msx .v-ga .tr i{position:absolute;left:0;top:0;bottom:0;border-radius:99px}
.msx .v-ga.hp .tr i{background:linear-gradient(180deg,#bef264,#22c55e)}
.msx .v-ga.hp.low .tr i{background:linear-gradient(180deg,#fdba74,#ef4444)}
.msx .v-ga.st .tr i{background:linear-gradient(180deg,#f9a8d4,#a855f7)}
.msx .v-ga .tr u{position:absolute;top:0;bottom:0;background:repeating-linear-gradient(45deg,#ef4444 0 3px,#7f1d1d 3px 6px)}
.msx .v-ga .tr u.add{background:repeating-linear-gradient(45deg,#e879f9 0 3px,#701a75 3px 6px)}
.msx .v-ga .tr u.heal{background:repeating-linear-gradient(45deg,#86efac 0 3px,#166534 3px 6px)}
.msx .v-ga .tr s{position:absolute;top:0;bottom:0;width:0;border-left:1.5px dashed #fde047}
.msx .v-ga b{font-size:12.5px;min-width:22px;text-align:right}.msx .v-ga b small{font-size:10px;color:#cbd5e1;font-weight:700}
.msx .v-ga b small.cap{color:#fde047}
.msx .v-ga em{font-style:normal;font-size:10.5px;color:#fca5a5}.msx .v-ga em.pl{color:#f0abfc}.msx .v-ga em.hl{color:#86efac}
.msx .v-scene{flex:1 1 0;min-height:0;position:relative;border-radius:16px;border:1px solid #4a4380;overflow:hidden;margin-top:6px;background:#0f0d24}
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
.msx .v-st u{display:block;height:3px;border-radius:3px;background:#334155;margin:1px 5px 0;overflow:hidden;text-decoration:none}
.msx .v-st u i{display:block;height:100%;background:linear-gradient(90deg,#f59e0b,#fb923c)}
.msx .v-st em{display:block;font-style:normal;font-size:11px;font-weight:900;color:#86efac;height:14px;line-height:14px}
.msx .v-st div.up{border-color:#fde047;background:#3b2f0b;box-shadow:0 0 8px #fde04766}.msx .v-st div.up b{color:#fde047}
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
.msx .v-st.gs-a.zin u.g i,.msx .v-st.gs-a.zin u.g s.gu{transition:none}
.msx .v-st.gs-a:not(.zin) u.g i,.msx .v-st.gs-a:not(.zin) u.g s{transition:left .45s ease-in-out,width .45s ease-in-out}
.msx .v-st.gs-a.zin.many div.up{transform:none;box-shadow:0 0 8px #fde04766}
.msx .v-st.gs-a.zin div.up u.g{height:12px;margin:2px 3px 12px;background-color:#334155;background-image:linear-gradient(90deg,transparent calc(100% - 1px),#cbd5e1aa 0)}
.msx .v-st.gs-a.zin div.up u.g i,.msx .v-st.gs-a.zin div.up u.g s{border-radius:2px}
.msx .v-st.gs-a u.g q{quotes:none;position:absolute;left:0;right:0;top:100%;display:flex;justify-content:space-between;font-size:10px;font-weight:800;color:#fde68a;line-height:11px;pointer-events:none}
.msx .v-st.gs-a u.g q::before,.msx .v-st.gs-a u.g q::after{content:none}
@container (max-width:340px){.msx .v-st.gs-a u.g q{font-size:9.5px;letter-spacing:-.06em;left:-3px;right:-3px}}
@media (max-width:340px){.msx .v-st.gs-a u.g q{font-size:9.5px;letter-spacing:-.06em;left:-3px;right:-3px}}
@media (prefers-reduced-motion: reduce){.msx .v-st u.g i,.msx .v-st u.g s.gu{transition:none}.msx .v-st.grow.on u.g s.gu{animation:none}}
.msx .v-act{display:grid;gap:5px;margin-top:6px}
.msx .v-p{background:linear-gradient(180deg,#3d4c6b,#2a3247);border:1px solid #64748b;border-bottom:3px solid #0b1020;border-radius:14px;text-align:center;padding:5px 2px 4px;font-size:12.5px;font-weight:900;line-height:1.2;position:relative;display:flex;flex-direction:column;justify-content:center;align-items:center;min-width:0;white-space:nowrap}
.msx .v-p .e{font-size:19px;line-height:1.1}.msx .v-p small{display:block;font-size:10px;color:#cbd5e1;font-weight:700;white-space:nowrap}
.msx .v-p.main{background:linear-gradient(160deg,#f472b6,#fb923c);border-color:#fde047;border-bottom-color:#9d174d;box-shadow:0 0 14px #f472b699;font-size:16px}
.msx .v-p.main small{color:#fff;font-size:10px}
.msx .v-p.off{background:#1e293b;border-color:#334155;color:#64748b}.msx .v-p.off small{color:#64748b}.msx .v-p.off .e{filter:grayscale(1);opacity:.6}
.msx .v-p.hosp{background:linear-gradient(180deg,#0e7490,#155e75);border-color:#67e8f9;box-shadow:0 0 10px #22d3ee88}
.msx .v-p .bd{position:absolute;right:-2px;top:-6px;background:#fde047;color:#422006;border-radius:99px;font-size:10px;font-weight:900;padding:0 5px;white-space:nowrap;line-height:1.5}
.msx .v-p .bd.r{background:#ef4444;color:#fff}
.msx .v-gather{display:flex;align-items:center;justify-content:center;gap:3px;margin-top:2px;background:#0f0d2466;border-radius:9px;padding:2px 5px;font-size:10px;white-space:nowrap}
.msx .v-gather .v-pf,.msx .v-gather .v-pf img{width:20px}.msx .v-gather .v-pf img{height:20px;border-radius:6px;border-width:1.5px}
.msx .v-gather .v-pf.tag::after{display:none}
.msx .v-ft{flex:none;height:40px;background:#0b0920;border-top:1px solid #3b3566;display:flex;align-items:center;gap:5px;padding:0 10px}
.msx .v-ft span,.msx .v-ft button{flex:1;text-align:center;background:#2b3348;border-radius:99px;padding:5px 2px;font-size:10.5px;font-weight:900;white-space:nowrap}
.msx .v-ft span.on,.msx .v-ft button.on{background:#fde047;color:#422006}
.msx .v-ft span.go,.msx .v-ft button.go{flex:2.4;background:linear-gradient(90deg,#f472b6,#fb923c);font-size:13px;padding:7px 2px;box-shadow:0 3px 0 #9d174d}
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
.msx .v-tr .o .lv{position:absolute;left:-4px;top:-5px;background:#0f172a;border:1px solid #94a3b8;border-radius:6px;font-size:10px;font-weight:900;padding:0 3px;line-height:1.4;font-style:normal}
.msx .v-tr .x{font-size:10px;font-weight:900;color:#86efac;margin-top:1px;white-space:nowrap}
.msx .v-tr.tag .o{border-color:#fde047;background:linear-gradient(180deg,#6b5310,#3b2f0b);box-shadow:0 0 0 2px #fde04755,0 0 12px #fde047}
.msx .v-tr.tag .x{color:#fde047}
.msx .v-tr.sel .o{border-color:#fff;background:linear-gradient(160deg,#f472b6,#fb923c);box-shadow:0 0 0 2px #fde047,0 0 16px #f472b6;transform:translateY(-6px) scale(1.08)}
.msx .v-tr.sel .fs{transform:translateY(-5px)}
.msx .v-tr .tgb{position:absolute;left:50%;top:0;transform:translateX(-50%);background:linear-gradient(90deg,#fde047,#fb923c);color:#422006;border-radius:99px;padding:0 6px;font-size:10px;font-weight:900;white-space:nowrap;line-height:1.5;z-index:2;box-shadow:0 0 8px #fde047}
.msx .v-come{position:absolute;right:6px;top:6px;width:44%;max-width:176px;display:flex;flex-direction:column;gap:4px}
.msx .v-cm{display:flex;align-items:center;gap:6px;background:#0f0d24e6;border:1px solid #475569;border-radius:11px;padding:4px 6px;min-width:0}
.msx .v-cm.tag{border-color:#fde047;background:linear-gradient(90deg,#3b2f0bf2,#0f0d24e6);box-shadow:0 0 10px #fde04788}
.msx .v-cm .tx{flex:1;min-width:0;line-height:1.2}
.msx .v-cm .tx b{display:block;font-size:10.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.msx .v-cm .tx small{display:block;font-size:10px;color:#86efac;font-weight:900;white-space:nowrap}
.msx .v-cm.tag .tx small{color:#fde047}
.msx .v-cm .afl{display:flex;align-items:center;gap:3px;font-size:10px;color:#cbd5e1;font-weight:900;white-space:nowrap}
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
.msx .v-ch small{display:block;font-size:10px;font-weight:800;color:#9d174d;white-space:nowrap}
.msx .v-ch.b{border-color:#38bdf8;background:linear-gradient(180deg,#fff,#e0f2fe)}.msx .v-ch.b small{color:#075985}
.msx .v-ch.n{grid-column:1/-1;background:#1e293b;color:#cbd5e1;border-color:#475569;font-size:11.5px;padding:4px}
.msx .v-pol{background:#1e1a36;border:1px solid #3b3566;border-radius:12px;padding:6px 9px;margin-top:6px}
.msx .v-pol .l{display:flex;justify-content:space-between;font-size:10px;color:#cbd5e1;font-weight:900;white-space:nowrap}
.msx .v-pol .m{display:grid;grid-template-columns:repeat(7,1fr);gap:2px;margin:3px 0}
.msx .v-pol .m i{height:9px;border-radius:3px;background:#334155}.msx .v-pol .m i.on{background:#fde047;box-shadow:0 0 8px #fde047}
.msx .v-pol .two{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:5px}
.msx .v-ev-h{position:absolute;left:0;top:8px;background:linear-gradient(90deg,#f472b6,#fb923c);border-radius:0 99px 99px 0;padding:3px 14px 3px 10px;font-size:11.5px;font-weight:900;white-space:nowrap}
.msx .v-ev-h small{display:block;font-size:10px;font-weight:800}
.msx .v-dots{position:absolute;right:8px;top:10px;background:#0f0d24d9;border-radius:99px;padding:2px 9px;font-size:10px;font-weight:900;white-space:nowrap}
.msx .v-dots i{display:inline-block;width:8px;height:8px;border-radius:50%;background:#475569;margin-left:3px}.msx .v-dots i.on{background:#fde047}
.msx .v-talk{position:absolute;left:8px;right:8px;bottom:8px;background:#fffdf5;color:#1e1b4b;border-radius:14px;border:2px solid #fb923c;padding:14px 12px 8px;font-size:12.5px;font-weight:800;line-height:1.55}
.msx .v-talk .who{position:absolute;left:10px;top:-11px;background:#fb923c;color:#fff;border-radius:8px;padding:1px 10px;font-size:11px;font-weight:900;white-space:nowrap}
.msx .v-opts{display:grid;gap:6px;margin-top:6px}
.msx .v-opt{background:#1e1a36;border:1.5px solid #f472b6;border-bottom-width:3px;border-radius:13px;padding:6px 10px;font-size:12.5px;font-weight:900;line-height:1.3}
.msx .v-opt small{display:block;font-size:10px;color:#86efac;font-weight:800}
.msx .v-clock{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;background:radial-gradient(circle at 50% 45%,#3b2f6b 0,#151130 70%)}
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
.msx .v-grid6{display:grid;grid-template-columns:repeat(6,1fr);gap:5px;margin-top:6px}
.msx .v-grid6 span,.msx .v-grid6 button{position:relative;display:block;min-width:0}
.msx .v-grid6 img{width:100%;aspect-ratio:1;border-radius:11px;object-fit:cover;background:#0f172a;border:2px solid #475569}
.msx .v-grid6 span.on img,.msx .v-grid6 button.on img{border-color:#fde047;box-shadow:0 0 10px #fde047aa}
.msx .v-grid6 span.lk img,.msx .v-grid6 button.lk img{filter:grayscale(1) brightness(.4)}
.msx .v-grid6 span.lk::after,.msx .v-grid6 button.lk::after{content:'🔒';position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:13px}
.msx .v-grid6 span.new::before,.msx .v-grid6 button.new::before{content:'合体';position:absolute;left:-2px;top:-5px;background:#a78bfa;color:#0f172a;font-size:10px;font-weight:900;border-radius:5px;padding:0 3px;z-index:1}
.msx .v-apt{display:grid;grid-template-columns:repeat(6,1fr);gap:3px;margin-top:6px;text-align:center;font-size:10px;font-weight:900}
.msx .v-apt div{background:#0f172a;border-radius:8px;padding:3px 0;white-space:nowrap;line-height:1.3}.msx .v-apt b{display:block;font-size:13px;color:#fde047}.msx .v-apt div.lo b{color:#94a3b8}
.msx .v-slots{display:grid;grid-template-columns:repeat(3,1fr);gap:5px;margin-top:6px}
.msx .v-sl{background:#0f172a;border:1px solid #475569;border-radius:12px;padding:6px 4px 5px;text-align:center;font-size:10.5px;font-weight:900;line-height:1.3;position:relative;min-width:0}
.msx .v-sl .v-pf{margin:0 auto 3px}
.msx .v-sl .t3{font-size:10px;color:#86efac;white-space:nowrap}.msx .v-sl .bs{font-size:10px;color:#cbd5e1;font-weight:700;white-space:nowrap}.msx .v-sl .ic{font-size:10px;white-space:nowrap;letter-spacing:1px}
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
.msx .v-sum .k{width:46px;font-size:10px;color:#f9a8d4;flex:none}
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
.msx .v-pick b{color:#fde047}
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
  .msx .v-ga{font-size:10px;gap:3px}.msx .v-ga b{font-size:11px;min-width:0}.msx .v-ga .tr{height:11px}
  .msx .v-st b{font-size:12px}.msx .v-st small{font-size:10px}.msx .v-st em{font-size:10px;height:12px;line-height:12px}.msx .v-st div.up.main em{font-size:11px}
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
.msx .v-cupwin{position:absolute;inset:0;z-index:40;background:#0009;display:flex;align-items:center;justify-content:center;padding:16px}
.msx .v-cupwin .in{position:relative;width:100%;max-width:360px;background:#fffbeb;color:#1e1b4b;border-radius:16px;border:3px solid #f59e0b;padding:10px 12px 12px;box-shadow:0 8px 0 #0006}
.msx .v-cupwin .h{text-align:center;font-weight:900;font-size:14px;background:#f59e0b;color:#fff;border-radius:10px;padding:3px 0;margin:-2px -2px 8px}
.msx .v-cupwin .sign{display:flex;flex-direction:column;align-items:center;gap:2px;background:linear-gradient(180deg,#1e1a36,#3b3566);color:#fff;border-radius:12px;padding:8px 6px;text-align:center}
.msx .v-cupwin .sign .e{font-size:40px;line-height:1}.msx .v-cupwin .sign b{font-size:15px}.msx .v-cupwin .sign small{font-size:10.5px;color:#fde68a}
.msx .v-cupwin .sign.g-four{background:linear-gradient(180deg,#2e1065,#6d28d9)}.msx .v-cupwin .sign.g-rainbow{background:linear-gradient(180deg,#7f1d1d,#a16207)}
.msx .v-cupwin .sub{margin-top:8px;font-size:11px;font-weight:900;color:#92400e;text-align:left}
.msx .v-cupwin .pz{display:flex;gap:6px;overflow-x:auto;padding:4px 0}
.msx .v-cupwin .pz button{flex:none;width:72px;display:flex;flex-direction:column;align-items:center;gap:2px;background:#fff;border:2px solid #e5e7eb;border-radius:10px;padding:4px 2px;text-align:center}
.msx .v-cupwin .pz button span{font-size:24px;line-height:1}.msx .v-cupwin .pz button small{font-size:9.5px;font-weight:900;line-height:1.2;color:#1e1b4b}
.msx .v-cupwin .pz button.rare{border-color:transparent;background:linear-gradient(#fff,#fff) padding-box,linear-gradient(90deg,#f43f5e,#eab308,#22c55e,#3b82f6,#a855f7) border-box}
.msx .v-cupwin .q{margin-top:8px;text-align:center;font-weight:900;font-size:13px}.msx .v-cupwin .q.ng{color:#dc2626;font-size:12px}
.msx .v-cupwin .bt{display:flex;gap:8px;margin-top:8px}
.msx .v-cupwin .bt button{flex:1;min-height:40px;border-radius:99px;background:#e5e7eb;color:#1e1b4b;font-weight:900;font-size:13.5px;text-align:center}
.msx .v-cupwin .bt button.go{background:linear-gradient(90deg,#f472b6,#fb923c);color:#fff}
.msx .v-cupwin .det{position:absolute;inset:0;background:#0007;border-radius:14px;display:flex;align-items:center;justify-content:center;padding:12px}
.msx .v-cupwin .dbox{background:#fff;border-radius:12px;padding:10px;text-align:center;width:100%;border:2px solid #f59e0b}
.msx .v-cupwin .dbox .e{font-size:38px}.msx .v-cupwin .dbox b{display:block;font-size:14px}.msx .v-cupwin .dbox p{font-size:11.5px;margin:4px 0 8px;text-align:left;line-height:1.45}
.msx .v-cupwin .dbox button{min-height:36px;width:100%;border-radius:99px;background:#e5e7eb;font-weight:900;text-align:center}.msx .v-cup.ng .tx small{color:#fca5a5}
.msx .v-vsh{display:flex;align-items:center;gap:4px;margin-top:6px;border-radius:16px;overflow:hidden;border:1px solid #4a4380;background:linear-gradient(100deg,#9d174d 0,#3b2a6b 49%,#0f0d24 50%,#1e3a8a 100%);padding:6px 6px;min-height:104px}
.msx .v-vsh .sd{flex:1;min-width:0;display:flex;align-items:center;gap:4px;line-height:1.3}.msx .v-vsh .sd.op{justify-content:flex-end;text-align:right}
.msx .v-vsh .sd img{height:70px;aspect-ratio:1;object-fit:contain;flex:none;filter:drop-shadow(0 5px 3px #0008)}.msx .v-vsh .sd.op img{transform:scaleX(-1)}
.msx .v-vsh .sd small{display:block;font-size:10px;color:#fde047;font-weight:900}.msx .v-vsh .sd b{display:block;font-size:14px;white-space:nowrap}.msx .v-vsh .sd span{display:block;font-size:10px;font-weight:800;white-space:nowrap}
.msx .v-vsh .vsm{flex:none;font-size:26px;font-weight:900;color:#fde047;text-shadow:0 3px 0 #9a3412,0 0 14px #fb923c;text-align:center;line-height:1}.msx .v-vsh .vsm small{display:block;font-size:10px;color:#fff;text-shadow:none;margin-top:3px}
.msx .v-vs1{display:grid;grid-template-columns:32px 1fr 70px 1fr 32px;align-items:center;gap:5px;font-size:10.5px;font-weight:900}
.msx .v-vs1 span{text-align:center;white-space:nowrap}.msx .v-vs1 b{font-size:13px;text-align:center;color:#cbd5e1}.msx .v-vs1 b.w{color:#fde047}
.msx .v-vs1 i{height:10px;border-radius:99px;background:#0b0920;border:1px solid #475569;position:relative;overflow:hidden}
.msx .v-vs1 i u{position:absolute;top:0;bottom:0;text-decoration:none}
.msx .v-vs1 i.l u{right:0;background:linear-gradient(270deg,#f472b6,#fb923c)}.msx .v-vs1 i.r u{left:0;background:linear-gradient(90deg,#38bdf8,#6366f1)}
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
.msx .v-bagw{position:absolute;left:8px;right:8px;top:8px;bottom:8px;background:#151130f5;border:1.5px solid #fde047;border-radius:16px;padding:8px 9px;display:flex;flex-direction:column;justify-content:space-evenly;box-shadow:0 0 18px #fde04755}
.msx .v-bagw .t{font-size:14px;font-weight:900;line-height:1.3;position:relative}.msx .v-bagw .t small{display:block;font-size:10px;color:#fca5a5;font-weight:800}
.msx .v-bagw .t i{position:absolute;right:0;top:0;width:24px;height:24px;border-radius:50%;background:#2b3348;font-style:normal;font-size:12px;display:flex;align-items:center;justify-content:center}
.msx .v-bagw .v-item{margin-top:0}
.msx .v-trs{gap:4px;margin-top:8px;align-items:start}
.msx .v-tr{padding-top:0}
.msx .v-tr .o{width:50px;height:50px;font-size:23px;margin:0 auto}
.msx .v-tr .nm{display:block;font-size:10.5px;font-weight:900;margin-top:4px;white-space:nowrap}
.msx .v-tr .tn{display:block;font-size:10px;font-weight:800;color:#fde68a;white-space:normal;word-break:keep-all;overflow-wrap:normal;line-height:1.15;min-height:2.3em;padding:0 1px;text-align:center}
.msx .v-tr .lv{display:block;position:static;background:none;border:0;font-style:normal;font-size:10px;font-weight:800;color:#94a3b8;line-height:1.3}
.msx .v-tr.tag .o{box-shadow:0 0 0 2px #fde04788,0 0 14px 3px #fde047,0 0 24px 6px #fb923c88}
.msx .v-tr.tag .nm{color:#fde047}
.msx .v-tr.sel .o{transform:scale(1.1)}
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
.msx .v-igrid div.bo,.msx .v-igrid button.bo{border-color:#38bdf8}.msx .v-igrid div.in,.msx .v-igrid button.in{border-color:#fde047;background:#3b2f0b;box-shadow:0 0 9px #fde04788}
.msx .v-igrid u{position:absolute;left:3px;top:2px;text-decoration:none;font-size:10px;font-weight:900;color:#86efac}
.msx .v-ileg{display:flex;gap:10px;font-size:10px;font-weight:800;color:#cbd5e1;margin-top:5px;white-space:nowrap}
.msx .v-ileg b{display:inline-block;width:9px;height:9px;border-radius:3px;margin-right:3px;vertical-align:-1px}.msx .v-ileg .sw1{background:#475569}.msx .v-ileg .sw2{background:#38bdf8}
.msx .v-sum .v-ics{display:flex;align-items:center;gap:3px;font-size:10px}.msx .v-sum .v-ics .v-icw{width:20px;height:20px}
.msx .v-cup .rvi{position:absolute;left:-6px;top:-9px;display:flex;align-items:center;gap:3px;background:linear-gradient(90deg,#ef4444,#fb923c);border-radius:99px;padding:1px 8px 1px 1px;font-size:10px;font-weight:900;line-height:1.6;white-space:nowrap}
.msx .v-cup .rvi img{width:20px;height:20px;border-radius:50%;object-fit:cover;object-position:50% 20%;background:#1e1a36;border:1.5px solid #fff}
.msx .v-cup .rvb{background:#3b2f0b;border:1px solid #fde047;color:#fde047}
/* ---- 足したもの(ゲームの中で要った分) ---- */
.msx-wrap{position:fixed;inset:0;z-index:9400;background:#0b0920;display:flex;justify-content:center;padding:env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left)}
.msx{width:100%;max-width:520px;height:100%;font-family:inherit;-webkit-tap-highlight-color:transparent;user-select:none;-webkit-user-select:none}
.msx.land{max-width:none}
.msx img{display:block}
.msx button{font:inherit;color:inherit;background:none;border:0;padding:0;margin:0;cursor:pointer;text-align:inherit;-webkit-appearance:none;appearance:none}
.msx button:active{transform:scale(.97)}
.msx button[disabled]{opacity:.45;cursor:default}
.msx .v-ft span,.msx .v-ft button{flex:1;text-align:center}
.msx .v-ft button{display:block;border-radius:99px;padding:8px 6px;font-size:12px;font-weight:900;background:#2b3348;white-space:nowrap}
.msx .v-ft button.go{background:linear-gradient(90deg,#f472b6,#fb923c);flex:2.2;font-size:13.5px;box-shadow:0 2px 0 #9d174d}
.msx .v-ft button.on{background:#fde047;color:#1e1b4b}
.msx-scroll{flex:1 1 0;min-height:0;overflow-y:auto;-webkit-overflow-scrolling:touch;overscroll-behavior:contain}
.msx-ov{position:absolute;inset:0;z-index:40;background:#0b0920cc;display:flex;align-items:center;justify-content:center;padding:14px}
.msx-sheet{width:100%;max-height:100%;overflow-y:auto;background:linear-gradient(180deg,#241d4a,#16122e);border:1px solid #f472b6aa;border-radius:16px;padding:12px;box-shadow:0 10px 30px #000a}
.msx-sheet h3{margin:0 0 6px;font-size:15px;font-weight:900;color:#f9a8d4}
.msx-row{display:flex;align-items:center;gap:6px}
.msx-btn{display:block;width:100%;border-radius:12px;padding:10px;font-size:13px;font-weight:900;text-align:center;background:#2b3348;margin-top:6px}
.msx-btn.go{background:linear-gradient(90deg,#f472b6,#fb923c);box-shadow:0 2px 0 #9d174d}
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
.msx button,.msx [role=button]{position:relative;min-height:0}
.msx button:not(:disabled)::after,.msx [role=button]::after{content:'';position:absolute;left:50%;top:50%;width:max(100%,44px);height:max(100%,44px);transform:translate(-50%,-50%)}
/* 横画面・大きい文字で中身が縦にあふれるときは、本体の中で送れるようにする(下のボタンは貼りつけて残す) */
.msx.land .v-body,.msx.s320 .v-body{overflow-y:auto;overscroll-behavior:contain}
.msx.land .v-ft{position:sticky;bottom:0;z-index:3}
.msx .v-inp{padding-top:0;padding-bottom:0}.msx .v-inp input{min-height:44px;align-self:stretch}
.msx .v-ft,.msx.land .v-ft{height:auto;min-height:48px;padding-top:2px;padding-bottom:2px}
.msx .v-ft button{min-height:40px}
.msx .v-hd{height:auto;min-height:32px}
@media (prefers-reduced-motion:reduce){.msx *{animation:none!important}}
/* はじめの画面(MsxHome・2026-11-14 作り直し): 題字ロゴ・大きな「続きから」・3つの札 */
.msx .v-scene.hm{--mb:14%}
.msx .v-scene.hm .mon{height:38%}.msx .v-scene.hm .gr{width:26%}
.msx.land .v-scene.hm .mon{height:40%}
.msx .v-hm-logo{position:absolute;left:50%;top:6px;transform:translateX(-50%);width:min(92%,360px);filter:drop-shadow(0 4px 6px #0008)}
.msx .v-hm-logo img{display:block;width:100%;height:auto}
.msx .v-hm-logo .msx-beta-mk{position:absolute;right:2%;bottom:6%}
.msx .v-hm-cont{display:flex;flex-direction:column;align-items:center;gap:1px;width:100%;margin-top:8px;border-radius:18px;padding:10px 10px 9px;background:linear-gradient(90deg,#f472b6,#fb923c);box-shadow:0 4px 0 #9d174d,0 0 18px #f472b688;line-height:1.3;min-width:0}
.msx .v-hm-cont .t{font-size:21px;font-weight:900;white-space:nowrap}
.msx .v-hm-cont .d{font-size:12.5px;font-weight:900;max-width:100%;overflow-wrap:anywhere;text-align:center}
.msx .v-hm-cont .d2{font-size:11px;font-weight:800;color:#fff7ed;max-width:100%;overflow-wrap:anywhere;text-align:center}
.msx .v-hm-lead{margin-top:8px;font-size:12.5px;font-weight:900;text-align:center;line-height:1.45}
.msx .v-hm-lead small{display:block;font-size:10.5px;font-weight:700;color:#cbd5e1}
.msx .v-hm-new{display:block;width:100%;min-height:44px;margin-top:7px;border-radius:99px;padding:8px 10px;font-size:14px;font-weight:900;text-align:center;background:#1e1a36;border:1.5px solid #f9a8d4;color:#fff;white-space:normal}
.msx .v-big.v-hm-new{font-size:18px;padding:14px 10px;border:0;background:linear-gradient(90deg,#f472b6,#fb923c)}
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
/* 育成のメイン画面: 編成の顔の列(6体+助手)が左下の「持ち物」に重ならないよう、場面の高さに合わせて顔を縮める(2026-11-14 社長「持ち物と編成がかぶってる」)。
   使える高さ = 場面の高さ − 上6 − 持ち物46 − 下7 − すき間6。列の中 = 枠の内側9 + 「編成」の字(大きい文字でも収まるよう16) + すき間 + 顔×7(幅320は2列×4段) */
.msx .v-scene.home{container-type:size}
.msx .v-scene.home .v-party{--pfs:clamp(14px,calc((100cqh - 65px - 25px - 24px) / 7),30px)}
.msx.land .v-scene.home .v-party{--pfs:clamp(14px,calc((100cqh - 65px - 25px - 18px) / 7),24px)}
.msx.s320 .v-scene.home .v-party{--pfs:clamp(14px,calc((100cqh - 65px - 25px - 12px) / 4),22px)}
.msx .v-scene.home .v-party .v-pf,.msx .v-scene.home .v-party .v-pf img{width:var(--pfs)}
.msx .v-scene.home .v-party .v-pf img{height:var(--pfs)}
`;

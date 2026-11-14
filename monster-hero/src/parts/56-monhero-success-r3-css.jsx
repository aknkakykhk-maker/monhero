// ===== モンヒロサクセス 回3(大会・修行・引退・保存枠)の見た目 =====
// 見本 docs/progress/player-raise/mock/v3.css の「回3以降の止め絵」の部品を、回3の画面(.msx .r3)の中だけに効くよう切り出したもの。
// 回2の MSX_CSS(56-monhero-success-css.jsx)はそのまま使い、ここは足りない部品と回3で要った分だけを足す。
const MSX_R3_CSS = `
.msx .r3 .q-say{display:flex;gap:8px;align-items:center;margin-top:5px}
.msx .r3 .q-say img{width:44px;height:44px;border-radius:50%;border:2px solid #fff;background:#fff;object-fit:cover;flex:0 0 auto}
.msx .r3 .q-say p{flex:1;background:#fffdf5;color:#1e1b4b;border-radius:12px;padding:6px 10px;font-size:12px;font-weight:800;line-height:1.45}
.msx .r3 .q-sec{margin-top:6px;padding:6px 8px 7px;border-radius:14px;background:#ffffff0d;border:1px solid #ffffff1f}
.msx .r3 .q-sec h3{font-size:12px;font-weight:900;color:#f9a8d4;margin:0 0 5px;display:flex;align-items:center;gap:6px}
.msx .r3 .q-sec h3 i{font-style:normal;display:inline-flex;width:18px;height:18px;border-radius:50%;background:#f472b6;color:#fff;font-size:11px;align-items:center;justify-content:center}
.msx .r3 .q-sec h3 .tk{margin-left:auto;font-size:10.5px;color:#fed7aa;font-weight:800}
.msx .r3 .q-dest{display:grid;grid-template-columns:repeat(4,1fr);gap:5px}
.msx .r3 .q-dest .r3-chip{justify-content:center;text-align:center}
.msx .r3 .q-sec .v-stg{margin-top:5px}
.msx .r3 .q-note{font-size:10.5px;color:#cbd5e1;font-weight:700;line-height:1.45;margin-top:4px}
.msx .r3 .q-note.y{color:#fde047}
.msx .r3 .q-slots{display:grid;grid-template-columns:1fr 1fr;gap:6px}
.msx .r3 .q-slot{min-height:56px;border-radius:12px;padding:5px 8px;border:2px dashed #ffffff40;font-size:11px;font-weight:800;color:#cbd5e1;display:flex;flex-direction:column;justify-content:center;gap:1px;cursor:pointer}
.msx .r3 .q-slot.on{border:2px solid #fde047;background:#fde04718;color:#fff}
.msx .r3 .q-slot small{font-size:9.5px;color:#cbd5e1}
.msx .r3 .q-slot .n{font-size:14px;font-weight:900;line-height:1.2}
.msx .r3 .q-slot .r{font-size:18px;font-weight:900;color:#fde047;line-height:1.1}
.msx .r3 .q-slot ul{list-style:none;margin:2px 0 0;padding:0;font-size:9.5px;color:#e2e8f0}
.msx .r3 .q-slot li{display:flex;gap:4px;align-items:center}
.msx .r3 .q-slot li i{font-style:normal;color:#94a3b8;flex:0 0 auto}
.msx .r3 .q-slot li em{font-style:normal;margin-left:auto;background:#16a34a;color:#fff;border-radius:4px;padding:0 4px;font-size:9px}
.msx .r3 .q-list{flex:1 1 auto;min-height:0;overflow-y:auto}
.msx .r3 .q-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:5px}
.msx .r3 .q-col{display:flex;flex-direction:column;gap:5px;min-width:0}
.msx .r3 .q-col h4{text-align:center;font-size:12px;font-weight:900;padding:2px 0;margin:0;border-radius:8px;background:#ffffff1a}
.msx .r3 .q-card{border-radius:10px;padding:5px 3px;text-align:center;font-size:10.5px;font-weight:800;line-height:1.25;background:#ffffff10;border:1px solid #ffffff22;color:#fff;min-height:52px;display:flex;flex-direction:column;justify-content:center;align-items:center;gap:1px;min-width:0}
.msx .r3 .q-card .nm{overflow-wrap:anywhere;word-break:break-all}
.msx .r3 .q-card .rk{font-size:9px;color:#cbd5e1}
.msx .r3 .q-card .p{font-size:15px;font-weight:900;color:#86efac}
.msx .r3 .q-card .p.g{font-size:10.5px;color:#cbd5e1}
.msx .r3 .q-card.ok{background:#16a34a2e;border-color:#4ade80}
.msx .r3 .q-card.sel{background:#fde04722;border:2px solid #fde047}.msx .r3 .q-card.sel .p{color:#fde047}
.msx .r3 .q-card.got{opacity:.55}
.msx .r3 .q-card.lock{background:#0f0b2299;border-color:#ffffff1a;color:#94a3b8}
.msx .r3 .q-card .lk{font-size:9px;color:#fca5a5;line-height:1.2;overflow-wrap:anywhere}
.msx .q-lock{display:flex;flex-direction:column;gap:5px;font-size:12px;font-weight:800}
.msx .q-lock>div{display:flex;gap:6px;align-items:center;background:#fee2e2;border-radius:8px;padding:5px 7px}
.msx .q-lock>div.ok{background:#dcfce7}
.msx .q-lock>div i{font-style:normal;color:#64748b;font-size:10.5px;flex:0 0 auto}
.msx .q-lock>div span{flex:1}
.msx .q-lock>div b{font-size:10.5px;color:#b91c1c}.msx .q-lock>div.ok b{color:#15803d}
.msx .q-lock p{font-size:11px;color:#475569;margin:2px 0}
.msx .r3 .v-brh{display:grid;grid-template-columns:1.5fr 1fr 1fr .8fr;gap:5px;margin-top:6px;font-size:9.5px;font-weight:900;color:#cbd5e1;text-align:center}
.msx .r3 .v-brk{display:grid;grid-template-columns:1.5fr 1fr 1fr .8fr;grid-template-rows:repeat(8,minmax(0,1fr));gap:4px 5px;flex:1 1 0;min-height:0;margin-top:3px}
.msx .r3 .v-bc{position:relative;display:flex;align-items:center;gap:5px;background:#1e1a36;border:1.5px solid #475569;border-radius:11px;padding:2px 6px;min-width:0}
.msx .r3 .v-bc>img{height:24px;width:24px;object-fit:contain;flex:none}
.msx .r3 .v-bc div{min-width:0;line-height:1.15}
.msx .r3 .v-bc b{display:block;font-size:11px;white-space:nowrap}
.msx .r3 .v-bc small{font-size:8.5px;color:#cbd5e1;font-weight:800}
.msx .r3 .v-bc.me{border-color:#fde047;background:#3b2f0b;box-shadow:0 0 9px #fde04777}
.msx .r3 .v-bc.rv{border-color:#f87171;background:linear-gradient(90deg,#3b1220,#1e1a36)}
.msx .r3 .v-bc.ch{border-color:#fbbf24;background:linear-gradient(90deg,#3b2f0b,#1e1a36)}
.msx .r3 .v-bc .mk{position:absolute;right:3px;top:-7px;border-radius:99px;font-size:8.5px;font-weight:900;line-height:1.5;padding:0 6px 0 1px;white-space:nowrap;display:flex;align-items:center;gap:2px}
.msx .r3 .v-bc .mk.rv{background:linear-gradient(90deg,#ef4444,#fb923c)}
.msx .r3 .v-bc .mk.rv img{width:15px;height:15px;border-radius:50%;object-fit:cover;object-position:50% 20%;border:1px solid #fff}
.msx .r3 .v-bc .mk.ch{background:#92400e;border:1px solid #fde047;padding:0 6px;color:#fde047}
.msx .r3 .v-bs{display:flex;flex-direction:column;align-items:center;justify-content:center;border:1.5px dashed #64748b;border-radius:11px;font-size:11px;font-weight:900;color:#94a3b8;background:#13102b}
.msx .r3 .v-bs.me{border:1.5px solid #fde047;color:#fde047;background:#3b2f0b}
.msx .r3 .v-bs.win{font-size:24px;border-color:#fde047;color:#fde047;line-height:1.1}
.msx .r3 .v-bs small{font-size:9px;color:#cbd5e1;font-weight:800;text-align:center}
.msx .r3 .v-bleg{display:flex;flex-direction:column;gap:2px;font-size:9px;font-weight:800;color:#cbd5e1;margin-top:5px}
.msx .r3 .v-bleg b{display:inline-block;width:9px;height:9px;border-radius:50%;margin-right:4px}
.msx .r3 .v-bleg .rvd{background:#ef4444}
.msx .r3 .v-bleg .chd{background:#fbbf24}
.msx .r3 .v-rvw{position:absolute;left:8px;right:8px;bottom:8px;background:#3b1220ee;border:1.5px solid #f87171;border-radius:99px;padding:3px 10px 3px 4px;font-size:11px;font-weight:900;display:flex;align-items:center;gap:6px;white-space:nowrap}
.msx .r3 .v-rvw img{width:22px;height:22px;border-radius:50%;object-fit:cover;object-position:50% 20%;border:1.5px solid #fff}
.msx .r3 .v-rvw b{margin-left:auto;background:#3b2f0b;border:1px solid #fde047;color:#fde047;border-radius:99px;padding:0 7px;font-size:9px}
.msx .r3 .v-trophy{position:absolute;right:8%;bottom:30%;font-size:44px;filter:drop-shadow(0 4px 6px #000a)}
.msx .r3 .v-prz{display:flex;flex-direction:column;gap:4px;margin-top:6px}
.msx .r3 .v-prz>div{position:relative;display:flex;align-items:center;gap:8px;background:#1e1a36;border:1.5px solid #475569;border-radius:12px;padding:5px 9px;font-size:12px;font-weight:900}
.msx .r3 .v-prz .e{font-size:20px;width:26px;text-align:center;flex:none}
.msx .r3 .v-prz b{flex:none;width:76px}
.msx .r3 .v-prz .t{flex:1;color:#e2e8f0;font-weight:800;font-size:11px;white-space:nowrap;overflow:hidden}
.msx .r3 .v-prz .new{border-color:#fde047;background:#3b2f0b;box-shadow:0 0 10px #fde04766}
.msx .r3 .v-prz i{font-style:normal;background:#ef4444;border-radius:99px;font-size:9px;padding:0 6px}
.msx .r3 .v-gl{display:grid;grid-template-columns:repeat(4,1fr);gap:5px;margin-top:6px;text-align:center}
.msx .r3 .v-gl div{background:#13102b;border:1.5px solid #475569;border-radius:12px;padding:5px 2px;opacity:.7}
.msx .r3 .v-gl b{display:block;font-size:24px;line-height:1.1;color:#cbd5e1}
.msx .r3 .v-gl small{font-size:9px;color:#94a3b8;font-weight:800}
.msx .r3 .v-gl .ok{opacity:1;border-color:#64748b}
.msx .r3 .v-gl .now{opacity:1;border-color:#fde047;background:#3b2f0b;box-shadow:0 0 12px #fde04788}
.msx .r3 .v-gl .now b{color:#f472b6;-webkit-text-stroke:1px #fff}
.msx .r3 .v-pq{display:flex;gap:5px;align-items:center;margin-top:7px;font-size:10px;font-weight:900;color:#cbd5e1}
.msx .r3 .v-pq i{font-style:normal;background:#1e1a36;border:1.5px solid #64748b;border-radius:99px;padding:3px 9px;color:#fff}
.msx .r3 .v-pq i.on{border-color:#fde047;background:#3b2f0b;color:#fde047}
.msx .r3 .v-pa{display:flex;flex-direction:column;gap:5px;margin-top:7px}
.msx .r3 .v-pa>div{display:grid;grid-template-columns:96px 38px 38px 1fr;gap:5px;align-items:center;background:#1e1a36;border:1.5px solid #475569;border-radius:12px;padding:4px 8px;font-size:11.5px;font-weight:900}
.msx .r3 .v-pa .v0{color:#cbd5e1;text-align:right}
.msx .r3 .v-pa .ad{color:#86efac}
.msx .r3 .v-pa .st{display:flex;align-items:center;justify-content:flex-end;gap:5px}
.msx .r3 .v-pa .st i{font-style:normal;width:22px;height:22px;border-radius:50%;background:#334155;text-align:center;line-height:22px}
.msx .r3 .v-pa .st b{min-width:16px;text-align:center;color:#fde047}
.msx .r3 .v-pa .cs{display:none}
.msx .r3 .v-tabs{display:grid;grid-template-columns:1fr 1fr;gap:5px;margin-top:6px}
.msx .r3 .v-tabs span{text-align:center;background:#1e1a36;border:1.5px solid #475569;border-radius:99px;padding:5px;font-size:12.5px;font-weight:900;color:#cbd5e1}
.msx .r3 .v-tabs .on{border-color:#fde047;background:#3b2f0b;color:#fde047}
.msx .r3 .v-rsel{margin-top:5px;font-size:11px;font-weight:800;color:#cbd5e1}
.msx .r3 .v-lines{display:flex;gap:4px;margin-top:5px;overflow:hidden}
.msx .r3 .v-lines i{font-style:normal;flex:none;background:#1e1a36;border:1.5px solid #475569;border-radius:99px;padding:2px 8px;font-size:10px;font-weight:900;color:#cbd5e1;white-space:nowrap}
.msx .r3 .v-lines i.on{border-color:#fde047;color:#fde047;background:#3b2f0b}
.msx .r3 .v-rl{display:flex;flex-direction:column;gap:3px;margin-top:5px;flex:1 1 0;min-height:0;overflow:hidden}
.msx .r3 .v-rr,.msx .r3 .v-rme{background:#1e1a36;border:1.5px solid #475569;border-radius:12px;padding:3px 8px}
.msx .r3 .v-rr .r1,.msx .r3 .v-rme{display:flex;align-items:center;gap:6px;min-width:0}
.msx .r3 .v-rr .no,.msx .r3 .v-rme .no{flex:none;width:22px;text-align:center;font-size:14px;font-weight:900;color:#cbd5e1}
.msx .r3 .v-rr.top .no{color:#fde047}
.msx .r3 .v-rr .im,.msx .r3 .v-rme .im{flex:none;width:30px;height:30px}
.msx .r3 .v-rr .im img,.msx .r3 .v-rme .im img{width:30px;height:30px;object-fit:contain}
.msx .r3 .v-rr .nm,.msx .r3 .v-rme .nm{flex:1;min-width:0;line-height:1.2}
.msx .r3 .v-rr .nm b,.msx .r3 .v-rme .nm b{display:block;font-size:12px;white-space:nowrap}
.msx .r3 .v-rr .nm small,.msx .r3 .v-rme .nm small{font-size:9px;color:#cbd5e1;font-weight:800;white-space:nowrap}
.msx .r3 .v-rr .gd,.msx .r3 .v-rme .gd{flex:none}
.msx .r3 .v-rr .pw,.msx .r3 .v-rme .pw{flex:none;width:56px;text-align:right;font-size:12.5px;font-weight:900;color:#fde047}
.msx .r3 .v-rr.open{border-color:#fde047;background:#3b2f0b}
.msx .r3 .v-rr .r2{display:grid;grid-template-columns:repeat(6,1fr);gap:3px;margin-top:3px;text-align:center}
.msx .r3 .v-rr .r2 span{background:#0f172a;border-radius:8px;padding:2px 0}
.msx .r3 .v-rr .r2 small{display:block;font-size:7.5px;color:#cbd5e1;font-weight:800;white-space:nowrap}
.msx .r3 .v-rr .r2 b{font-size:11px}
.msx .r3 .v-rme{margin-top:5px;border-color:#f472b6;background:#3b1236}
.msx .r3 .v-lives{position:absolute;left:0;right:0;bottom:8px;display:flex;justify-content:center;align-items:center;gap:6px;font-size:11px;font-weight:900;color:#cbd5e1}
.msx .r3 .v-lives i{width:14px;height:14px;border-radius:50%;border:2px solid #64748b;background:#1e293b}
.msx .r3 .v-itemfx{position:absolute;right:8px;bottom:8px;display:flex;align-items:center;gap:6px;background:#0f0d24ee;border:1.5px solid #fde047;border-radius:12px;padding:4px 8px;font-size:10px;font-weight:900;line-height:1.3;box-shadow:0 0 14px #fde04788}
.msx .r3 .v-itemfx svg{width:30px;height:30px;flex:none}
.msx .r3 .v-itemfx.lp{bottom:auto;top:8px;left:8px;right:auto}
.msx .r3 .v-ix.lp{border-color:#fde047}
.msx .r3 .v-ix.lp .pr i.on{background:#fde047;box-shadow:0 0 5px #fde047}
.msx .r3 .v-bk1{position:relative;height:54px;flex:none;margin-top:6px;border-radius:12px 12px 0 0;overflow:hidden}
.msx .r3 .v-bk1 .bg{width:100%;height:100%;object-fit:cover;filter:brightness(.55)}
.msx .r3 .v-bk1 .tt{position:absolute;left:0;right:0;bottom:0;background:#6b4f2aee;text-align:center;font-size:12px;font-weight:900;padding:2px;letter-spacing:.1em}
.msx .r3 .v-bkc{display:flex;gap:0;background:linear-gradient(180deg,#efe3c4,#e0d0a4);border-radius:0 0 12px 12px;padding:6px 6px 6px 8px;color:#3b2a14;flex:none}
.msx .r3 .v-bkc .rows{flex:1;min-width:0}
.msx .r3 .v-bkc .rt{position:relative;width:104px;flex:none;display:flex}
.msx .r3 .v-br{display:flex;align-items:center;gap:5px;height:34px;box-sizing:border-box;padding:2px 0;min-width:0}
.msx .r3 .v-br .no{flex:none;width:20px;height:20px;border-radius:5px;background:#fef3c7;border:1.5px solid #b45309;text-align:center;line-height:17px;font-size:12px;font-weight:900;color:#92400e}
.msx .r3 .v-br .nm{flex:1;min-width:0;height:24px;border-radius:99px 0 0 99px;background:#fffdf5;border:1px solid #d6c79a;padding:0 8px;display:flex;align-items:center;gap:5px;font-size:12.5px;font-weight:900;white-space:nowrap;overflow:hidden}
.msx .r3 .v-br .mk{font-style:normal;font-size:8.5px;border-radius:99px;padding:0 6px;line-height:1.6;color:#fff}
.msx .r3 .v-br .mk.ch{background:#92400e;color:#fde047}
.msx .r3 .v-br .mk.rv{background:#ef4444}
.msx .r3 .v-br .mk.me{background:#ca8a04}
.msx .r3 .v-br .cn{flex:none;width:12px;height:3px;background:#ef4444;margin-right:-5px}
.msx .r3 .v-br .fc2{flex:none;width:30px;height:30px;border-radius:50%;background:#fffdf5;border:2px solid #b8a674;display:flex;align-items:center;justify-content:center;overflow:hidden}
.msx .r3 .v-br .fc2 img{width:26px;height:26px;object-fit:contain}
.msx .r3 .v-br.me .nm,.msx .r3 .v-br.rv .nm{border-color:#f59e0b}
.msx .r3 .v-br.me .nm{background:#ffe9a8}
.msx .r3 .v-br.rv .nm{background:#ffd9d4}
.msx .r3 .v-br.ch .nm{background:#fff0c2}
.msx .r3 .v-br.mine .fc2{border-color:#ef4444;box-shadow:0 0 0 2px #fde04799}
.msx .r3 .v-brl{position:absolute;left:0;top:0;width:64px;height:100%}
.msx .r3 .v-bkc .win{position:absolute;right:0;top:50%;transform:translateY(-50%);width:46px;height:60px;border-radius:7px;background:linear-gradient(180deg,#7f1d1d,#450a0a);border:2px solid #fbbf24;color:#fde047;display:flex;flex-direction:column;align-items:center;justify-content:center;font-size:20px;line-height:1.1}
.msx .r3 .v-bkc .win b{font-size:10px;letter-spacing:.05em}
.msx .r3 .v-bnt{margin-top:5px;font-size:10.5px;font-weight:800;color:#e2e8f0;line-height:1.4}
.msx .r3 .v-bnt b{color:#fde047}
.msx .r3 .v-bnt span{display:block;font-size:9.5px;color:#94a3b8}
.msx .r3 .v-ann{display:flex;gap:8px;align-items:stretch;margin-top:6px;background:linear-gradient(180deg,#f7ecc8,#e8d9a8);border:2px solid #b8a674;border-radius:12px;padding:6px 8px;color:#3b2a14;flex:none;align-items:center}
.msx .r3 .v-ann .pic{position:relative;flex:none;width:64px}
.msx .r3 .v-ann .pic img{width:64px;height:64px;border-radius:50%;object-fit:cover;object-position:50% 20%;border:2px solid #b8a674;background:#fff}
.msx .r3 .v-ann .pic span{position:absolute;left:0;right:0;bottom:-2px;text-align:center;background:#a67c3c;color:#fff;font-size:10px;font-weight:900;border-radius:5px}
.msx .r3 .v-ann .tx{flex:1;font-size:12.5px;font-weight:800;line-height:1.55;align-self:center}
.msx .r3 .v-ann .tx b{color:#b45309}
.msx .r3 .v-bcs{position:relative;height:150px;flex:none;margin-top:6px;border-radius:14px;overflow:hidden;border:1.5px solid #64748b}
.msx .r3 .v-bcs .bg{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
.msx .r3 .v-bcs .sh{position:absolute;inset:0;background:linear-gradient(180deg,#0f0d2488,#0f0d2400 40%,#0f0d24aa)}
.msx .r3 .v-bcs .ttl{position:absolute;left:30%;right:30%;top:0;background:#6b4f2aee;border-radius:0 0 10px 10px;text-align:center;font-size:10.5px;font-weight:900;padding:1px 0}
.msx .r3 .v-bcs .ml,.msx .r3 .v-bcs .mr{position:absolute;bottom:26px;height:96px;object-fit:contain;filter:drop-shadow(0 6px 4px #0009)}
.msx .r3 .v-bcs .ml{left:10%}
.msx .r3 .v-bcs .mr{right:10%;transform:scaleX(-1)}
.msx .r3 .v-bcs .vsw{position:absolute;left:50%;bottom:34px;transform:translateX(-50%);font-size:34px;font-weight:900;font-style:italic;color:#e2e8f0;-webkit-text-stroke:2px #334155;text-shadow:0 3px 0 #1e293b}
.msx .r3 .v-bcs .nb{position:absolute;bottom:0;height:24px;display:flex;align-items:center;gap:6px;background:#1e1a36e6;padding:0 8px;font-size:11.5px;font-weight:900;white-space:nowrap}
.msx .r3 .v-bcs .nb small{font-size:10px;color:#fde047;display:flex;align-items:center;gap:3px}
.msx .r3 .v-bcs .nb.l{left:0;border-radius:0 12px 0 0;width:47%}
.msx .r3 .v-bcs .nb.r{right:0;border-radius:12px 0 0 0;width:47%;justify-content:flex-end}
.msx .r3 .v-tabs.t3{grid-template-columns:repeat(3,1fr)}
.msx .r3 .v-tabs.t3 span{padding:4px 2px;font-size:12px;border-radius:99px}
.msx .r3 .v-szr{display:grid;grid-template-columns:1fr auto 1fr;gap:6px;text-align:center;font-size:11.5px;font-weight:900}
.msx .r3 .v-szr span{color:#cbd5e1;font-size:10px}
.msx .r3 .v-hint{display:flex;align-items:center;gap:7px;margin-top:5px;font-size:11px;font-weight:800;line-height:1.35}
.msx .r3 .v-hint img{width:30px;height:30px;border-radius:50%;object-fit:cover;object-position:50% 20%;border:1.5px solid #f9a8d4;flex:none}
.msx .r3 .v-hint em{font-style:normal;color:#f9a8d4}
.msx .r3{gap:0}
.msx .v-body.r3{overflow-y:auto;-webkit-overflow-scrolling:touch}
.msx .r3 .v-rm3>button.re{background:linear-gradient(160deg,#f59e0b,#b45309);border-color:#fde68a}
.msx .r3 .v-rm3>button.nj{background:linear-gradient(120deg,#be185d,#7c3aed 55%,#2563eb);border-color:#fbcfe8}
.msx .r3 .r3-bar{display:flex;gap:6px;flex-wrap:wrap;margin-top:6px}
.msx .r3 .r3-chip{flex:1 1 auto;min-height:36px;border-radius:99px;background:#1e1a36;border:1.5px solid #475569;color:#cbd5e1;font-size:11.5px;font-weight:900;padding:4px 10px;white-space:nowrap}
.msx .r3 .r3-chip.on{border-color:#fde047;background:#3b2f0b;color:#fde047}
.msx .r3 .r3-chip:disabled{opacity:.4}
.msx .r3-chip{text-align:center} /* .msx button の text-align:inherit に負けて左へ寄るのを止める(札・タブは中央) */
.msx .r3 .v-cup{cursor:pointer;text-align:left;width:100%;font:inherit;color:inherit}
.msx .r3 .v-cup.ng{cursor:default}
.msx .r3 .v-pa button{width:26px;height:26px;border-radius:50%;background:#334155;color:#fff;font-weight:900;border:0}
.msx .r3 .v-pa button:disabled{opacity:.35}
.msx .r3 .v-a{cursor:pointer}.msx .r3 .v-a .lv span{cursor:pointer}
.msx .r3 .r3-watch{position:relative;margin-top:6px}
.msx .r3 .r3-watch .ambw-ring{height:200px}
.msx .r3 .r3-res{text-align:center;font-size:12px;font-weight:900;color:#cbd5e1;margin-top:6px}
.msx .r3 .r3-box{display:flex;flex-direction:column;gap:5px;margin-top:6px}
.msx .r3 .r3-bm{display:flex;align-items:center;gap:8px;background:#1e1a36;border:1.5px solid #475569;border-radius:12px;padding:5px 9px;text-align:left;color:#fff;font:inherit}
.msx .r3 .r3-bm img{width:38px;height:38px;object-fit:contain;flex:none}
.msx .r3 .r3-bm .nm{flex:1;min-width:0;line-height:1.25}.msx .r3 .r3-bm .nm b{display:block;font-size:12.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.msx .r3 .r3-bm .nm small{font-size:10px;color:#cbd5e1}
.msx .r3 .r3-bm .pw{flex:none;font-size:12px;color:#fde047;font-weight:900}
.msx .r3 .r3-bm.on{border-color:#fde047;background:#3b2f0b}
.msx .r3 .r3-ttl{font-size:10px;color:#94a3b8;margin-top:6px}
.msx .r3 .v-rm3>button{display:flex;align-items:center;gap:8px;border:1.5px solid #64748b;border-bottom-width:3px;border-radius:13px;padding:6px 9px;font-size:12.5px;font-weight:900;line-height:1.3;min-width:0;text-align:left;color:#fff;font-family:inherit;width:100%}
.msx .r3 .v-rm3>button.gv{background:#1e293b;display:block;text-align:center;padding:5px;font-size:11.5px;color:#cbd5e1}
.msx .r3 .v-ml{color:#fff;font-family:inherit}
/* ごはん9種(2026-11-13 社長)。3列×3段に収める */
.msx .r3 .v-meal .ms{gap:4px}.msx .r3 .v-ml{padding:4px 2px}.msx .r3 .v-ml .e{font-size:20px}.msx .r3 .v-ml b{font-size:10.5px;overflow:hidden;text-overflow:clip}.msx .r3 .v-ml .g{font-size:10.5px}.msx .r3 .v-ml small{font-size:10px;line-height:1.25}
.msx .r3 .v-ml.sel{border-color:#fde047;background:#3b2f0b;box-shadow:0 0 10px #fde04788}
.msx .v-ft button:disabled{opacity:.45}
`;


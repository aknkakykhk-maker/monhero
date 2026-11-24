// r1119-165 の案の見た目(撮影のときだけページに差し込む。ゲーム本体には入っていない)。
// 撮影のときは、ゲーム本体のノーツを描く所へ「空中のノーツを地上のあとに描き、そのあいだに __skyLayerVeil を挟む」仮の数行を足して撮った(コミットしていない)。
//   案A … 地上のノーツ → 空中のガラスの面(すりガラス+両端のレール) → 空中のノーツ。地上は「ガラスの向こう」に見える
//   案B … 地上のノーツ → 空中の面と重なる所だけ地上のノーツを暗くする(ノーツの上だけ・背景は変えない) → 空中のノーツ。地上が「奥に沈む」
//   案C … 地上のノーツ → 空中のノーツ(描く順番を変えるだけ。重なった所はいつも空中が上)
// 2回目(社長「空中で濃すぎてみづらい」): 空中の面を薄くし、地上は軽くだけ沈める
//   案D … 面を今の半分(塗り13%→6.5%・区切りとふちも半分)+ 重なる所の地上を3割だけ暗く
//   案E … 面を今の3分の1(塗り13%→4.3%)+ 重なる所の地上を3割だけ暗く
//   案F … 面の塗りと区切りを消し、両端のふちだけ細く残す + 重なる所の地上を2割5分だけ暗く
// 3回目(社長「空中線通るときにちゃんと下を通ってる？なんか線の上にあるように見える」): 空中の判定線と面の両端のふちを、地上のノーツのあとに描く
//   案G … 案E(面3分の1・地上を3割暗く)+ 空中の判定線と両端のふちを地上のノーツの上へ
//   案H … 面を今の5分の1(塗り2.6%)+ 地上を2割暗く + 空中の判定線と両端のふちを地上のノーツの上へ
// 4回目(社長「できたら今までと空中レーンの見た目は変えないで明確に下にあるようにしたい」): 空中の見た目(濃さ・色・太さ)は今のまま
//   案I … 空中の面・区切り・ふち・空中の判定線を、今と同じ濃さのまま地上のノーツのあと(手前)に描くだけ。地上は沈めない
//   案J … 案I + 空中の面と重なる所の地上を1割5分だけ暗く
(() => {
  const LOOK = window.__skyLayerLook;
  const poly = (ctx, plane, rect) => {
    const svgPoly = document.querySelector('[data-rhythm-sky-stage] [data-rhythm-sky-lane-look] > polygon');
    // 演奏の輪が覚えている面の形は判定ラインを測る前のものなので、いま画面に出ている空中の面(SVG)の形を読む
    const pts = String(svgPoly ? svgPoly.getAttribute('points') : plane.poly).trim().split(/\s+/).map(s => s.split(',').map(Number));
    ctx.beginPath(); pts.forEach(([x, y], i) => { const X = x * rect.width / 100, Y = y * rect.height / 100; if (i) ctx.lineTo(X, Y); else ctx.moveTo(X, Y); }); ctx.closePath();
    let y0 = 1e9, y1 = -1e9; for (const [, y] of pts) { y0 = Math.min(y0, y * rect.height / 100); y1 = Math.max(y1, y * rect.height / 100); }
    return { pts, y0, y1 };
  };
  // 案I・J: SVG(ノーツより奥)の空中の面・区切り・ふち・判定線を、同じ形・色・濃さ・太さで canvas に描き直す(地上のノーツの上・空中のノーツの下)
  const redrawSky = (ctx, rect, dim) => {
    const X = v => Number(v) * rect.width / 100, Y = v => Number(v) * rect.height / 100;
    const pts = el => el.getAttribute('points').trim().split(/\s+/).map(q => q.split(','));
    const path = p => { ctx.beginPath(); p.forEach(([x, y], i) => i ? ctx.lineTo(X(x), Y(y)) : ctx.moveTo(X(x), Y(y))); };
    const poly = document.querySelector('[data-rhythm-sky-lane-look="em"] > polygon');
    if (poly && dim) { path(pts(poly)); ctx.closePath(); ctx.globalCompositeOperation = 'source-atop'; ctx.fillStyle = `rgba(10,5,30,${dim})`; ctx.fill(); }
    ctx.globalCompositeOperation = 'source-over';
    if (poly) { const cs = getComputedStyle(poly); path(pts(poly)); ctx.closePath(); ctx.globalAlpha = Number(cs.fillOpacity); ctx.fillStyle = poly.getAttribute('fill'); ctx.fill(); }
    for (const el of document.querySelectorAll('[data-rhythm-sky-lane-look="em"] > polyline')) {
      ctx.globalAlpha = Number(el.getAttribute('stroke-opacity')); ctx.strokeStyle = el.getAttribute('stroke'); ctx.lineWidth = Number(el.getAttribute('stroke-width')) || 1; path(pts(el)); ctx.stroke();
    }
    for (const el of document.querySelectorAll('[data-rhythm-sky-stage] > line')) {
      ctx.globalAlpha = Number(el.getAttribute('stroke-opacity')); ctx.strokeStyle = el.getAttribute('stroke'); ctx.lineWidth = Number(el.getAttribute('stroke-width')) || 1;
      ctx.beginPath(); ctx.moveTo(X(el.getAttribute('x1')), Y(el.getAttribute('y1'))); ctx.lineTo(X(el.getAttribute('x2')), Y(el.getAttribute('y2'))); ctx.stroke();
    }
    ctx.globalAlpha = 1;
  };
  window.__skyLayerVeil = (ctx, plane, rect0) => {
    // 空中の面(SVG)と同じ 0〜100 の座標を、ノーツの canvas の見えている大きさ(CSS px)へ写す
    const rect = { width: ctx.canvas.clientWidth || rect0.width, height: ctx.canvas.clientHeight || rect0.height };
    if (LOOK === 'C') return;
    const SOFT = { D: .3, E: .3, F: .25, G: .3, H: .2, J: .15 }[LOOK];
    if (LOOK === 'I' || LOOK === 'J') { ctx.save(); ctx.setTransform(ctx.canvas.width / rect.width, 0, 0, ctx.canvas.height / rect.height, 0, 0); redrawSky(ctx, rect, SOFT); ctx.restore(); return; }
    ctx.save();
    // ノーツの canvas は解像度の倍率が端末と違うことがある(重いときに下げる)ので、CSS の px で描けるように倍率を合わせ直す
    ctx.setTransform(ctx.canvas.width / rect.width, 0, 0, ctx.canvas.height / rect.height, 0, 0);
    const { pts, y0, y1 } = poly(ctx, plane, rect);
    if (SOFT) {
      ctx.globalCompositeOperation = 'source-atop';
      ctx.fillStyle = `rgba(10,5,30,${SOFT})`; ctx.fill();
      if (LOOK === 'G' || LOOK === 'H') {
        // SVG(ノーツより奥)にある空中の判定線と面の両端のふちを、同じ形・濃さで canvas に描き直す(地上のノーツの上・空中のノーツの下)
        ctx.globalCompositeOperation = 'source-over';
        const X = v => Number(v) * rect.width / 100, Y = v => Number(v) * rect.height / 100;
        const st = el => { const cs = getComputedStyle(el); return { c: cs.stroke, a: Number(cs.strokeOpacity), w: parseFloat(cs.strokeWidth) || 1 }; };
        for (const el of document.querySelectorAll('[data-rhythm-sky-stage] > polyline[data-sky-edge-copy], [data-rhythm-sky-lane-look="em"] > polyline:nth-last-of-type(-n+2)')) {
          const { c, a, w } = st(el); ctx.globalAlpha = a; ctx.strokeStyle = c; ctx.lineWidth = w * 1.2;
          const p = el.getAttribute('points').trim().split(/\s+/).map(q => q.split(','));
          ctx.beginPath(); p.forEach(([x, y], i) => i ? ctx.lineTo(X(x), Y(y)) : ctx.moveTo(X(x), Y(y))); ctx.stroke();
        }
        for (const el of document.querySelectorAll('[data-rhythm-sky-stage] > line')) {
          const { c, a, w } = st(el); ctx.globalAlpha = a; ctx.strokeStyle = c; ctx.lineWidth = w;
          ctx.beginPath(); ctx.moveTo(X(el.getAttribute('x1')), Y(el.getAttribute('y1'))); ctx.lineTo(X(el.getAttribute('x2')), Y(el.getAttribute('y2'))); ctx.stroke();
        }
        ctx.globalAlpha = 1;
      }
    } else if (LOOK === 'B') {
      // 地上のノーツだけを暗く・紫へ寄せる(source-atop … いま描いてあるノーツの上にだけ乗る)
      ctx.globalCompositeOperation = 'source-atop';
      const g = ctx.createLinearGradient(0, y0, 0, y1); g.addColorStop(0, 'rgba(10,5,30,.8)'); g.addColorStop(1, 'rgba(10,5,30,.6)');
      ctx.fillStyle = g; ctx.fill();
    } else if (LOOK === 'A') {
      // 地上のノーツを少しくもらせる → ガラスの面を上に重ねる
      ctx.globalCompositeOperation = 'source-atop';
      ctx.fillStyle = 'rgba(196,186,240,.5)'; ctx.fill();   // 地上のノーツを白っぽく曇らせる(すりガラスの向こう)
      ctx.globalCompositeOperation = 'source-over';
      const g = ctx.createLinearGradient(0, y0, 0, y1); g.addColorStop(0, 'rgba(221,214,254,.06)'); g.addColorStop(1, 'rgba(221,214,254,.3)');
      ctx.fillStyle = g; ctx.fill();
      // 両端のレール(空中の面のふち)
      const n = pts.length / 2, side = (from, to, step) => { ctx.beginPath(); for (let i = from; i !== to; i += step) { const [x, y] = pts[i]; const X = x * rect.width / 100, Y = y * rect.height / 100; if (i === from) ctx.moveTo(X, Y); else ctx.lineTo(X, Y); } ctx.stroke(); };
      ctx.strokeStyle = 'rgba(240,235,255,.85)'; ctx.lineWidth = 2.4;
      side(0, n, 1); side(pts.length - 1, n - 1, -1);
      // 面の手前のふち(空中の判定線の所)を明るく
      const [lx, ly] = pts[n - 1], [rx, ry] = pts[n];
      ctx.strokeStyle = 'rgba(245,240,255,.7)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(lx * rect.width / 100, ly * rect.height / 100); ctx.lineTo(rx * rect.width / 100, ry * rect.height / 100); ctx.stroke();
    }
    ctx.restore();
  };
  // 案A は SVG の空中の面(今の薄い面)をガラスの面に置き換えるので、元の面の塗りは消す(区切りの線は残す)。
  // 案D・E・F は SVG の空中の面(塗り .13・区切り .32・ふち .6)を薄くする
  const G = '[data-rhythm-sky-lane-look="em"]';
  const css = {
    A: `${G} > polygon{fill-opacity:0}`,
    D: `${G} > polygon{fill-opacity:.065}${G} > polyline{stroke-opacity:.16}${G} > polyline:nth-last-of-type(-n+2){stroke-opacity:.3}`,
    E: `${G} > polygon{fill-opacity:.043}${G} > polyline{stroke-opacity:.11}${G} > polyline:nth-last-of-type(-n+2){stroke-opacity:.2}`,
    F: `${G} > polygon{fill-opacity:0}${G} > polyline{stroke-opacity:0}${G} > polyline:nth-last-of-type(-n+2){stroke-opacity:.35}`,
    // G・H: SVG の判定線とふちは canvas に描き直すので、SVG 側は見えなくする(visibility … 形と濃さは読める)
    G: `${G} > polygon{fill-opacity:.043}${G} > polyline{stroke-opacity:.11}${G} > polyline:nth-last-of-type(-n+2){stroke-opacity:.2;visibility:hidden}[data-rhythm-sky-stage] > line{visibility:hidden}`,
    I: `${G}{visibility:hidden}[data-rhythm-sky-stage] > line{visibility:hidden}`,
    J: `${G}{visibility:hidden}[data-rhythm-sky-stage] > line{visibility:hidden}`,
    H: `${G} > polygon{fill-opacity:.026}${G} > polyline{stroke-opacity:.08}${G} > polyline:nth-last-of-type(-n+2){stroke-opacity:.2;visibility:hidden}[data-rhythm-sky-stage] > line{visibility:hidden}`,
  }[LOOK];
  if (css) {
    const add = () => { const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st); };
    if (document.head) add(); else document.addEventListener('DOMContentLoaded', add);
  }
})();

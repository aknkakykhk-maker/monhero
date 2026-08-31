// DEBUG ONLY: 音ゲーの見えるレーンを1枚のSVGへ統一する表示レイヤー。
// 入力判定・ノーツ座標は既存 rhythm-mode.js の共通projection helperをそのまま正本にする。
(() => {
  if (typeof document === 'undefined' || typeof MutationObserver === 'undefined') return;
  if (document.documentElement.dataset.rhythmLaneSvgOverlay === 'ready') return;
  document.documentElement.dataset.rhythmLaneSvgOverlay = 'ready';

  const SVG_NS = 'http://www.w3.org/2000/svg';
  const observedAreas = new WeakSet();
  const svgEl = (tag, attrs = {}) => {
    const el = document.createElementNS(SVG_NS, tag);
    Object.entries(attrs).forEach(([key, value]) => el.setAttribute(key, String(value)));
    return el;
  };
  const point = (x, y) => `${(Number(x) * 1000).toFixed(3)},${(Number(y) * 1000).toFixed(3)}`;
  const lanePoints = lane => {
    const top = rhythmProjectLane(lane, 0), bottom = rhythmProjectLane(lane, 1);
    return [point(top.left, 0), point(top.right, 0), point(bottom.right, 1), point(bottom.left, 1)].join(' ');
  };
  const installStyle = () => {
    if (document.head.querySelector('[data-rhythm-lane-svg-style]')) return;
    const style = document.createElement('style');
    style.dataset.rhythmLaneSvgStyle = '';
    style.textContent = `
      [data-rhythm-play-area]::before,[data-rhythm-play-area]::after{content:none!important;display:none!important}
      [data-rhythm-lane]{background:transparent!important;border:0!important;box-shadow:none!important;filter:none!important}
      [data-rhythm-lane]::before,[data-rhythm-lane]::after{content:none!important;display:none!important}
      [data-rhythm-lane]>span{opacity:0!important}
      [data-rhythm-judgment-line]{opacity:0!important;box-shadow:none!important}
      [data-rhythm-lane-svg]{position:absolute;inset:0;width:100%;height:100%;z-index:1;pointer-events:none;overflow:visible}
      [data-rhythm-note]{z-index:4}
    `;
    document.head.appendChild(style);
  };
  const judgmentRatio = area => {
    const areaRect = area.getBoundingClientRect();
    const line = area.querySelector('[data-rhythm-judgment-line]');
    const lineRect = line?.getBoundingClientRect();
    if (!(areaRect.width > 0 && areaRect.height > 0) || !lineRect) return .88;
    return rhythmClamp01((lineRect.top - areaRect.top + lineRect.height / 2) / areaRect.height);
  };
  const syncPressed = area => {
    const active = new Set(Array.from(area.querySelectorAll('[data-rhythm-lane][data-pressed="true"]')).map(el => Number(el.dataset.rhythmLane)));
    area.querySelectorAll('[data-rhythm-svg-press]').forEach(el => el.setAttribute('opacity', active.has(Number(el.dataset.rhythmSvgPress)) ? '1' : '0'));
  };
  const mount = area => {
    if (!area || area.querySelector(':scope > [data-rhythm-lane-svg]')) return;
    const svg = svgEl('svg', { viewBox:'0 0 1000 1000', preserveAspectRatio:'none', 'aria-hidden':'true' });
    svg.dataset.rhythmLaneSvg = '';

    const defs = svgEl('defs');
    const laneFill = svgEl('linearGradient', { id:'rhythmLaneSvgFill', x1:'0', y1:'0', x2:'0', y2:'1' });
    laneFill.append(
      svgEl('stop', { offset:'0%', 'stop-color':'#111827', 'stop-opacity':'.18' }),
      svgEl('stop', { offset:'72%', 'stop-color':'#0e7490', 'stop-opacity':'.16' }),
      svgEl('stop', { offset:'100%', 'stop-color':'#164e63', 'stop-opacity':'.26' })
    );
    const pressedFill = svgEl('linearGradient', { id:'rhythmLaneSvgPressed', x1:'0', y1:'0', x2:'0', y2:'1' });
    pressedFill.append(
      svgEl('stop', { offset:'0%', 'stop-color':'#22d3ee', 'stop-opacity':'.08' }),
      svgEl('stop', { offset:'62%', 'stop-color':'#22d3ee', 'stop-opacity':'.28' }),
      svgEl('stop', { offset:'100%', 'stop-color':'#d946ef', 'stop-opacity':'.46' })
    );
    const glow = svgEl('filter', { id:'rhythmLaneSvgJudgeGlow', x:'-20%', y:'-400%', width:'140%', height:'900%' });
    glow.appendChild(svgEl('feGaussianBlur', { stdDeviation:'8' }));
    defs.append(laneFill, pressedFill, glow);
    svg.appendChild(defs);

    const roadLeftTop = rhythmProjectBoundary(0, 0), roadRightTop = rhythmProjectBoundary(RHYTHM_LANE_COUNT, 0);
    svg.appendChild(svgEl('polygon', {
      points:[point(roadLeftTop,0), point(roadRightTop,0), point(1,1), point(0,1)].join(' '),
      fill:'#07111f', 'fill-opacity':'.94'
    }));

    for (let lane = 0; lane < RHYTHM_LANE_COUNT; lane++) {
      svg.appendChild(svgEl('polygon', { points:lanePoints(lane), fill:'url(#rhythmLaneSvgFill)', 'fill-opacity':lane % 2 ? '.72' : '.9' }));
      const press = svgEl('polygon', { points:lanePoints(lane), fill:'url(#rhythmLaneSvgPressed)', opacity:'0' });
      press.dataset.rhythmSvgPress = String(lane);
      press.style.transition = 'opacity 55ms linear';
      svg.appendChild(press);
    }

    for (const y of [.25, .5, .75]) {
      svg.appendChild(svgEl('line', {
        x1:(rhythmProjectBoundary(0,y)*1000).toFixed(3), y1:(y*1000).toFixed(3),
        x2:(rhythmProjectBoundary(RHYTHM_LANE_COUNT,y)*1000).toFixed(3), y2:(y*1000).toFixed(3),
        stroke:'#67e8f9', 'stroke-opacity':'.09', 'stroke-width':'1.2'
      }));
    }
    for (let boundary = 0; boundary <= RHYTHM_LANE_COUNT; boundary++) {
      svg.appendChild(svgEl('line', {
        x1:(rhythmProjectBoundary(boundary,0)*1000).toFixed(3), y1:'0',
        x2:(rhythmProjectBoundary(boundary,1)*1000).toFixed(3), y2:'1000',
        stroke:boundary === 0 || boundary === RHYTHM_LANE_COUNT ? '#e0f2fe' : '#a5f3fc',
        'stroke-opacity':boundary === 0 || boundary === RHYTHM_LANE_COUNT ? '.72' : '.46',
        'stroke-width':boundary === 0 || boundary === RHYTHM_LANE_COUNT ? '2.4' : '1.6'
      }));
    }

    const y = judgmentRatio(area), x1 = rhythmProjectBoundary(0,y)*1000, x2 = rhythmProjectBoundary(RHYTHM_LANE_COUNT,y)*1000;
    svg.appendChild(svgEl('line', { x1:x1.toFixed(3), y1:(y*1000).toFixed(3), x2:x2.toFixed(3), y2:(y*1000).toFixed(3), stroke:'#c084fc', 'stroke-opacity':'.72', 'stroke-width':'18', filter:'url(#rhythmLaneSvgJudgeGlow)' }));
    svg.appendChild(svgEl('line', { x1:x1.toFixed(3), y1:(y*1000).toFixed(3), x2:x2.toFixed(3), y2:(y*1000).toFixed(3), stroke:'#ecfeff', 'stroke-width':'4' }));

    for (let lane = 0; lane < RHYTHM_LANE_COUNT; lane++) {
      const at = rhythmProjectLane(lane, .94), label = svgEl('text', { x:(at.center*1000).toFixed(3), y:'950', 'text-anchor':'middle', fill:'#94a3b8', 'fill-opacity':'.62', 'font-size':'28', 'font-weight':'700' });
      label.textContent = String(lane + 1);
      svg.appendChild(label);
    }

    area.insertBefore(svg, area.firstChild);
    syncPressed(area);
    if (!observedAreas.has(area)) {
      observedAreas.add(area);
      new MutationObserver(sync => { if (sync.some(m => m.type === 'attributes')) syncPressed(area); })
        .observe(area, { attributes:true, subtree:true, attributeFilter:['data-pressed'] });
    }
  };
  const scan = () => {
    installStyle();
    const area = document.querySelector('[data-rhythm-play-area]');
    if (area) mount(area);
  };
  const start = () => {
    scan();
    new MutationObserver(scan).observe(document.body, { childList:true, subtree:true });
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once:true });
  else start();
})();

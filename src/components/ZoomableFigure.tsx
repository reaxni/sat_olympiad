import { useRef, useState, type PointerEvent, type ReactNode } from 'react';
import type { ContentBlock, GraphPoint } from '../domain/exam';

type Graph = Extract<ContentBlock, { kind: 'graph' }>;

export function graphPointPosition(graph: Graph, point: GraphPoint) {
  const width = graph.xMax - graph.xMin;
  const height = graph.yMax - graph.yMin;
  if (!(width > 0) || !(height > 0)) return null;
  return { x: 48 + (point.x - graph.xMin) / width * 388, y: 318 - (point.y - graph.yMin) / height * 278 };
}

export function GraphDrawing({ graph }: { graph: Graph }) {
  const ticks = Array.from({ length: 6 }, (_, index) => index);
  return <svg viewBox="0 0 480 360" role="img" aria-label={graph.title} className="data-graph">
    <rect width="480" height="360" fill="white" />
    {ticks.map((index) => <g key={index} stroke="#cbd3e0" strokeWidth="1">
      <path d={`M${48 + index * 77.6} 40V318`} /><path d={`M48 ${318 - index * 55.6}H436`} />
      <text x={48 + index * 77.6} y="338" textAnchor="middle" stroke="none" fill="#273850" fontSize="13">{Number((graph.xMin + (graph.xMax - graph.xMin) * index / 5).toFixed(2))}</text>
      <text x="38" y={323 - index * 55.6} textAnchor="end" stroke="none" fill="#273850" fontSize="13">{Number((graph.yMin + (graph.yMax - graph.yMin) * index / 5).toFixed(2))}</text>
    </g>)}
    <path d="M48 40V318H436" stroke="#17243b" strokeWidth="2" fill="none" />
    {graph.lines?.map((line, index) => { const from = graphPointPosition(graph, line.from); const to = graphPointPosition(graph, line.to); return from && to ? <path key={index} d={`M${from.x} ${from.y}L${to.x} ${to.y}`} stroke="#253a78" strokeWidth="2.5" fill="none" /> : null; })}
    {graph.points.map((point, index) => { const at = graphPointPosition(graph, point); return at ? <circle key={index} cx={at.x} cy={at.y} r="4.5" fill="#152b5d" /> : null; })}
    <text x="242" y="356" textAnchor="middle" fill="#17243b" fontSize="15">{graph.xLabel}</text>
    <text x="14" y="178" textAnchor="middle" fill="#17243b" fontSize="15" transform="rotate(-90 14 178)">{graph.yLabel}</text>
  </svg>;
}

export function ZoomableFigure({ title, caption, children }: { title: string; caption?: string; children: ReactNode }) {
  const [zoom, setZoom] = useState(100);
  const [expanded, setExpanded] = useState(false);
  const viewport = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; y: number; left: number; top: number } | null>(null);
  const panStart = (event: PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === 'touch' || !viewport.current) return;
    drag.current = { x: event.clientX, y: event.clientY, left: viewport.current.scrollLeft, top: viewport.current.scrollTop };
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const panMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!drag.current || !viewport.current) return;
    viewport.current.scrollLeft = drag.current.left - (event.clientX - drag.current.x);
    viewport.current.scrollTop = drag.current.top - (event.clientY - drag.current.y);
  };
  return <figure className={`zoomable-figure ${expanded ? 'is-expanded' : ''}`} aria-label={title} onKeyDown={(event) => { if (event.key === 'Escape') setExpanded(false); }}>
    <div className="figure-toolbar" role="toolbar" aria-label={`${title} zoom controls`}>
      <button type="button" aria-label="Zoom in" disabled={zoom >= 300} onClick={() => setZoom((value) => Math.min(300, value + 25))}>＋</button>
      <button type="button" aria-label="Zoom out" disabled={zoom <= 100} onClick={() => setZoom((value) => Math.max(100, value - 25))}>−</button>
      <span aria-live="polite">{zoom}%</span>
      <button type="button" onClick={() => { setZoom(100); if (viewport.current) { viewport.current.scrollLeft = 0; viewport.current.scrollTop = 0; } }}>Reset</button>
      <button type="button" aria-label={expanded ? 'Close enlarged graph' : 'Enlarge graph'} aria-expanded={expanded} onClick={() => setExpanded((value) => !value)}>{expanded ? '✕' : '⛶'}</button>
    </div>
    <div ref={viewport} className="figure-viewport" tabIndex={0} role="region" aria-label={`${title}; scroll to pan when zoomed`} onPointerDown={panStart} onPointerMove={panMove} onPointerUp={(event) => { drag.current = null; if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId); }} onPointerCancel={() => { drag.current = null; }}>
      <div className="figure-canvas" style={{ width: `${zoom}%` }}>{children}</div>
    </div>
    {caption && <figcaption>{caption}</figcaption>}
  </figure>;
}

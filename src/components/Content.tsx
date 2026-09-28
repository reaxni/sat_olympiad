import { useEffect, useRef, type ReactNode } from 'react';
import 'katex/dist/katex.min.css';
import type { ContentBlock, TextHighlight } from '../domain/exam';
import { formattedTextSegments } from '../exam/highlights';
import { GraphDrawing, ZoomableFigure } from './ZoomableFigure';

function MathText({ latex, accessibleText }: { latex: string; accessibleText: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!ref.current) return;
    let cancelled = false;
    void import('katex').then(({ default: katex }) => {
      if (!cancelled && ref.current) katex.render(latex, ref.current, { throwOnError: false, trust: false, strict: 'warn', maxExpand: 500, maxSize: 20, output: 'html' });
    }).catch(() => { if (!cancelled && ref.current) ref.current.textContent = accessibleText; });
    return () => { cancelled = true; };
  }, [latex, accessibleText]);
  return <span className="math-expression" role="math" aria-label={accessibleText}><span aria-hidden="true" ref={ref} /></span>;
}
function safeMediaUrl(url: string) {
  if (import.meta.env.DEV && url.startsWith('data:image/svg+xml,')) return url;
  if (/^data:image\/(png|jpeg|svg\+xml);base64,[a-z\d+/=]+$/i.test(url)) return url;
  try { const parsed = new URL(url, window.location.origin); return parsed.protocol === 'https:' || (parsed.origin === window.location.origin && parsed.protocol === window.location.protocol) ? parsed.href : undefined; } catch { return undefined; }
}
export function Content({ blocks, blockPrefix = '', blockIndices, highlights = [], onSelectBlock, onHighlightClick, zoomableMedia = false }: { blocks: ContentBlock[]; blockPrefix?: string; blockIndices?: number[]; highlights?: TextHighlight[]; onSelectBlock?: (selection: Omit<TextHighlight, 'id' | 'color'>, element: HTMLElement) => void; onHighlightClick?: (highlight: TextHighlight, element: HTMLElement) => void; zoomableMedia?: boolean }) {
  return <div className="content-blocks">{blocks.map((block, index) => {
    switch (block.kind) {
      case 'text': {
        const blockId = `${blockPrefix}:${blockIndices?.[index] ?? index}`;
        return <div key={index} className="text-block"><p data-highlight-id={blockPrefix ? blockId : undefined} tabIndex={onSelectBlock ? 0 : undefined} aria-keyshortcuts={onSelectBlock ? 'Enter' : undefined} onKeyDown={onSelectBlock ? (event) => { if (event.target !== event.currentTarget) return; if (event.key === 'Enter') { event.preventDefault(); onSelectBlock({ blockId, start: 0, end: block.text.length, text: block.text }, event.currentTarget); } } : undefined}>{formattedTextSegments(block.text, blockId, highlights, block.marks).map((segment) => {
          let content: ReactNode = segment.text;
          if (segment.styles.includes('underline')) content = <u>{content}</u>;
          if (segment.styles.includes('italic')) content = <em>{content}</em>;
          if (segment.styles.includes('bold')) content = <strong>{content}</strong>;
          return segment.color ? <mark key={segment.start} className={`highlight-${segment.color}`} role={onHighlightClick ? 'button' : undefined} tabIndex={onHighlightClick ? 0 : undefined} aria-label={onHighlightClick ? `Edit highlight: ${segment.text}` : undefined} onClick={onHighlightClick ? (event) => { event.preventDefault(); event.stopPropagation(); const value = highlights.find((item) => item.id === segment.highlightId); if (value) onHighlightClick(value, event.currentTarget); } : undefined} onKeyDown={onHighlightClick ? (event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); event.stopPropagation(); const value = highlights.find((item) => item.id === segment.highlightId); if (value) onHighlightClick(value, event.currentTarget); } } : undefined}>{content}</mark> : <span key={segment.start}>{content}</span>;
        })}</p></div>;
      }
      case 'math': return <MathText key={index} {...block} />;
      case 'image': return zoomableMedia ? <ZoomableFigure key={index} title={block.alt} caption={block.caption}><img src={safeMediaUrl(block.url)} alt={block.alt} width={block.width} height={block.height} loading="lazy" onError={(event) => { event.currentTarget.hidden = true; }} /></ZoomableFigure> : <figure key={index}><img src={safeMediaUrl(block.url)} alt={block.alt} width={block.width} height={block.height} loading="lazy" onError={(event) => { event.currentTarget.hidden = true; }} /><figcaption>{block.caption && <span>{block.caption} </span>}{block.alt}</figcaption></figure>;
      case 'table': return <div className="table-scroll" key={index} tabIndex={0} role="region" aria-label={block.caption}><table><caption>{block.caption}</caption><thead><tr>{block.headers.map((header, i) => <th key={i} scope="col">{header}</th>)}</tr></thead><tbody>{block.rows.map((row, i) => <tr key={i}>{row.map((cell, j) => <td key={j}>{cell}</td>)}</tr>)}</tbody></table></div>;
      case 'list': {
        const items = block.items.map((item, i) => <li key={i}><Content blocks={[{ kind: 'text', text: item }]} blockPrefix={`${blockPrefix}:${blockIndices?.[index] ?? index}:item:${i}`} highlights={highlights} onSelectBlock={onSelectBlock} onHighlightClick={onHighlightClick} /></li>);
        return block.ordered ? <ol className="exam-content-list" key={index}>{items}</ol> : <ul className="exam-content-list" key={index}>{items}</ul>;
      }
      case 'graph': return zoomableMedia ? <ZoomableFigure key={index} title={block.title} caption={block.title}><GraphDrawing graph={block} /></ZoomableFigure> : <figure key={index} className="static-graph"><GraphDrawing graph={block} /><figcaption>{block.title}</figcaption></figure>;
    }
  })}</div>;
}

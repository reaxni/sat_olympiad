import type { TextHighlight, TextMark } from '../domain/exam';

/** Pure segmentation preserves text and supports overlapping highlights without HTML injection. */
export function highlightSegments(text: string, blockId: string, highlights: TextHighlight[]) {
  const relevant = highlights.filter((item) => item.blockId === blockId && item.start >= 0 && item.end <= text.length && item.end > item.start);
  const boundaries = [...new Set([0, text.length, ...relevant.flatMap((item) => [item.start, item.end])])].sort((a, b) => a - b);
  return boundaries.slice(0, -1).map((start, index) => {
    const end = boundaries[index + 1]!;
    const highlight = relevant.filter((item) => item.start <= start && item.end >= end).at(-1);
    return { start, text: text.slice(start, end), color: highlight?.color, highlightId: highlight?.id };
  });
}

/** Split on both saved highlight and authored emphasis boundaries. */
export function formattedTextSegments(text: string, blockId: string, highlights: TextHighlight[], marks: TextMark[] = []) {
  const highlighted = highlightSegments(text, blockId, highlights);
  const validMarks = marks.filter((mark) => Number.isInteger(mark.start) && Number.isInteger(mark.end) && mark.start >= 0 && mark.end <= text.length && mark.end > mark.start);
  const boundaries = [...new Set([0, text.length, ...highlighted.flatMap((segment) => [segment.start, segment.start + segment.text.length]), ...validMarks.flatMap((mark) => [mark.start, mark.end])])].sort((a, b) => a - b);
  return boundaries.slice(0, -1).map((start, index) => {
    const end = boundaries[index + 1]!;
    const highlight = highlighted.find((segment) => segment.start <= start && segment.start + segment.text.length >= end);
    return { start, text: text.slice(start, end), color: highlight?.color, highlightId: highlight?.highlightId,
      styles: validMarks.filter((mark) => mark.start <= start && mark.end >= end).map((mark) => mark.style) };
  });
}

export function selectedTextHighlight(root: HTMLElement): Omit<TextHighlight, 'id' | 'color'> | null {
  const selection = window.getSelection();
  if (!selection || selection.isCollapsed || !selection.rangeCount) return null;
  const range = selection.getRangeAt(0);
  const element = (node: Node) => node.nodeType === Node.ELEMENT_NODE ? node as Element : node.parentElement;
  const start = element(range.startContainer)?.closest<HTMLElement>('[data-highlight-id]');
  const end = element(range.endContainer)?.closest<HTMLElement>('[data-highlight-id]');
  if (!start || start !== end || !root.contains(start)) return null;
  const before = range.cloneRange(); before.selectNodeContents(start); before.setEnd(range.startContainer, range.startOffset);
  const offset = before.toString().length; const text = range.toString();
  if (!text.trim()) return null;
  return { blockId: start.dataset.highlightId!, start: offset, end: offset + text.length, text };
}

import { describe, expect, it } from 'vitest';
import { formattedTextSegments, highlightSegments } from './highlights';
describe('highlight rendering', () => {
  it('preserves the original text with overlapping ranges and ignores other blocks', () => {
    const segments = highlightSegments('abcdef', 'p', [
      { id: '1', blockId: 'p', start: 1, end: 4, text: 'bcd', color: 'yellow' },
      { id: '2', blockId: 'p', start: 3, end: 5, text: 'de', color: 'blue' },
      { id: '3', blockId: 'other', start: 0, end: 6, text: 'abcdef', color: 'blue' },
    ]);
    expect(segments.map((item) => item.text).join('')).toBe('abcdef');
    expect(segments.find((item) => item.start === 3)?.color).toBe('blue');
    expect(segments.find((item) => item.start === 3)?.highlightId).toBe('2');
    expect(segments[0]?.color).toBeUndefined();
  });
  it('ignores out-of-bounds or reversed ranges', () => {
    const segments = highlightSegments('text', 'p', [{ id: '1', blockId: 'p', start: -1, end: 99, text: 'bad', color: 'yellow' }]);
    expect(segments).toEqual([{ start: 0, text: 'text', color: undefined, highlightId: undefined }]);
  });
  it('preserves authored underline ranges alongside student highlights', () => {
    const segments = formattedTextSegments('abcdef', 'p', [{ id: 'h', blockId: 'p', start: 2, end: 5, text: 'cde', color: 'yellow' }], [{ start: 1, end: 4, style: 'underline' }]);
    expect(segments.map((segment) => segment.text).join('')).toBe('abcdef');
    expect(segments.find((segment) => segment.start === 2)).toMatchObject({ color: 'yellow', styles: ['underline'] });
  });
});

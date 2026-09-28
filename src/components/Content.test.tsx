import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { Content } from './Content';

describe('authored question content', () => {
  it('renders underline ranges, bullet lists, tables, and zoom controls without raw HTML', () => {
    const html = renderToStaticMarkup(<Content blocks={[
      { kind: 'text', text: 'Read this sentence.', marks: [{ start: 5, end: 9, style: 'underline' }] },
      { kind: 'list', items: ['First note', 'Second note'] },
      { kind: 'table', caption: 'Sample data', headers: ['Group'], rows: [['A']] },
      { kind: 'graph', title: 'Sample graph', xLabel: 'x', yLabel: 'y', xMin: 0, xMax: 2, yMin: 0, yMax: 2, points: [{ x: 1, y: 1 }] },
    ]} blockPrefix="q:passage" zoomableMedia />);
    expect(html).toContain('<u>this</u>');
    expect(html).toContain('<ul class="exam-content-list"');
    expect(html).toContain('Sample data');
    expect(html).toContain('aria-label="Zoom in"');
    expect(html).not.toContain('<script');
  });
});

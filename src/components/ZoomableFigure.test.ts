import { describe, expect, it } from 'vitest';
import { graphPointPosition } from './ZoomableFigure';
import type { ContentBlock } from '../domain/exam';

describe('graph coordinates', () => {
  const graph: Extract<ContentBlock, { kind: 'graph' }> = { kind: 'graph', title: 'Sample', xLabel: 'x', yLabel: 'y', xMin: 0, xMax: 10, yMin: 0, yMax: 10, points: [] };
  it('places the lower left and upper right data bounds on the plot', () => {
    expect(graphPointPosition(graph, { x: 0, y: 0 })).toEqual({ x: 48, y: 318 });
    expect(graphPointPosition(graph, { x: 10, y: 10 })).toEqual({ x: 436, y: 40 });
  });
  it('does not attempt to draw an invalid range', () => {
    expect(graphPointPosition({ ...graph, xMax: 0 }, { x: 0, y: 0 })).toBeNull();
  });
});

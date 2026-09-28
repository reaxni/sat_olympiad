import { describe, expect, it } from 'vitest';
import { arrangeReadingQuestion, splitReadingPrompt } from './readingLayout';
import type { ContentBlock } from '../domain/exam';

describe('reading prompt layout', () => {
  it('puts figures and tables beside passages while preserving block indexes', () => {
    const blocks: ContentBlock[] = [
      { kind: 'text', text: 'Read the passage.' },
      { kind: 'image', url: '/figure.png', alt: 'A figure' },
      { kind: 'table', caption: 'Data', headers: ['A'], rows: [['1']] },
      { kind: 'text', text: 'Choose an answer.' },
    ];
    const result = splitReadingPrompt(blocks);
    expect(result.media.map((item) => item.index)).toEqual([1, 2]);
    expect(result.prompt.map((item) => item.index)).toEqual([0, 3]);
  });
  it('places legacy imported Reading source text on the left', () => {
    const result = arrangeReadingQuestion({ id: 'r1', sectionId: 'reading-writing', position: 1, kind: 'multiple-choice', prompt: [{ kind: 'text', text: 'A long source passage with a blank ____.' }], choices: [] });
    expect(result.passages[0]?.content[0]).toMatchObject({ text: 'A long source passage with a blank ____.' });
    expect(result.prompt[0]?.block).toMatchObject({ text: 'Which choice best completes the text?' });
    expect(result.generatedTask).toBe(true);
  });
});

import { EXAM_SECTIONS, type ContentBlock, type Question } from '../../domain/exam';

// SYNTHETIC_OLYMPIAD_FIXTURES. Layout placeholders only; there are no answer keys.
const text = (value: string): ContentBlock => ({ kind: 'text', text: value });
const diagram: ContentBlock = {
  kind: 'image',
  url: 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="520" height="250" viewBox="0 0 520 250"><rect width="520" height="250" fill="white"/><g stroke="#25354d" fill="none" stroke-width="2"><path d="M65 205V30M65 205H480"/><path d="M100 175L190 150L275 155L370 80L445 48" stroke="#2656a9" stroke-width="3"/><path d="M60 155H70M60 105H70M60 55H70M160 200V210M260 200V210M360 200V210M460 200V210"/></g><g fill="#25354d" font-family="sans-serif" font-size="15"><text x="24" y="30">y</text><text x="483" y="225">x</text><text x="155" y="234">A</text><text x="255" y="234">B</text><text x="355" y="234">C</text><text x="455" y="234">D</text><text x="180" y="24">Illustrative diagram</text></g></svg>'),
  alt: 'Placeholder line graph with four labeled positions A through D and a generally rising line. No question or numeric data is associated with this image.',
  caption: 'Layout illustration only.', width: 520, height: 250,
};
const passage = 'This is placeholder passage text for the mock test interface. It shows how a short reading passage will appear during the Olympiad. Select a few words to highlight them, or add a note to keep track of your thoughts. This text is not an exam question and does not have a correct answer.';
const underlinedPassage = 'A student described the sculpture as a meeting of old and new materials. The artist reused familiar objects to invite a fresh interpretation.';
const readingSkills: NonNullable<Question['readingSkill']>[] = ['words-in-context', 'cross-text-connections', 'inference', 'rhetorical-synthesis', 'standard-english-conventions', 'transitions', 'text-structure'];
const graph: ContentBlock = { kind: 'graph', title: 'Illustrative scatterplot with a trend line', xLabel: 'Time', yLabel: 'Measure', xMin: 0, xMax: 10, yMin: 0, yMax: 10,
  points: [{ x: 1, y: 8 }, { x: 2, y: 7 }, { x: 3, y: 7.5 }, { x: 4, y: 5.5 }, { x: 6, y: 4 }, { x: 7, y: 3 }, { x: 9, y: 2 }], lines: [{ from: { x: 0, y: 9 }, to: { x: 10, y: 1 } }] };
const choices = ['First placeholder answer choice', 'Second placeholder answer choice', 'Third placeholder answer choice', 'Fourth placeholder answer choice'].map((value, i) => ({ id: String.fromCharCode(97 + i), content: [text(value)] }));

// A handful of content templates populate the fixed slots, rather than a question bank.
export const questions: Question[] = EXAM_SECTIONS.flatMap((section) => Array.from({ length: section.questionCount }, (_, index): Question => {
  const position = index + 1;
  const base = { id: `${section.id}-${position}`, sectionId: section.id, position };
  if (section.id === 'reading-writing') return {
    ...base, kind: 'multiple-choice', choices, readingSkill: readingSkills[(position - 1) % readingSkills.length],
    passages: position === 2
      ? [{ id: 'text-1', label: 'Text 1', content: [text(passage)] }, { id: 'text-2', label: 'Text 2', content: [text('A second original placeholder takes a different view. Compare the two ideas before choosing an answer. This text is for layout testing only.')] }]
      : [{ id: 'passage', content: position === 1 ? [{ kind: 'text', text: underlinedPassage, marks: [{ start: underlinedPassage.indexOf('reused familiar objects'), end: underlinedPassage.indexOf('reused familiar objects') + 'reused familiar objects'.length, style: 'underline' }] }] : position === 4 ? [text('A student has taken these notes about an artist:'), { kind: 'list', items: ['The artist works with recycled materials.', 'A public installation opened in spring.', 'Visitors contributed short written reflections.'] }] : position === 5 ? [text('The table summarizes a small fictional survey.'), { kind: 'table', caption: 'Fictional survey responses', headers: ['Response', 'Group A', 'Group B'], rows: [['Agree', '42', '36'], ['Unsure', '18', '24'], ['Disagree', '40', '40']] }] : position % 3 === 2 ? [text(passage), diagram] : [text(passage)] }],
    prompt: [text(position === 2 ? 'Which choice best describes how Text 2 responds to Text 1?' : position === 3 ? 'Which choice is best supported by the passage?' : position === 4 ? 'Which choice best uses the notes to introduce the artist?' : 'Which choice best answers the question based on the passage?')],
  };
  const prompt: ContentBlock[] = [text('Placeholder math problem text appears here. This slot demonstrates the exam layout; there is no problem to solve.')];
  if (position === 1) prompt.push(graph);
  else if (position % 3 === 1) prompt.push(diagram);
  if (position % 3 === 2) prompt.push({ kind: 'math', latex: 'y = mx + b', accessibleText: 'Illustrative notation: y equals m x plus b' });
  if (position % 3 === 0) prompt.push({ kind: 'table', caption: 'Placeholder table', headers: ['Label', 'Example value'], rows: [['A', '…'], ['B', '…'], ['C', '…']] });
  return position >= 16 ? { ...base, sectionId: 'math', kind: 'numeric', prompt, studentProducedResponseDirections: position % 2 === 0, inputHint: 'Try a number, decimal, or fraction. This placeholder is not graded.' } : { ...base, kind: 'multiple-choice', choices, prompt };
}));

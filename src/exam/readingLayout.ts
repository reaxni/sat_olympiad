import type { ContentBlock, Question } from '../domain/exam';

/** Keep source figures beside passages without changing prompt block identities. */
export function splitReadingPrompt(blocks: ContentBlock[]) {
  const indexed = blocks.map((block, index) => ({ block, index }));
  return {
    media: indexed.filter(({ block }) => block.kind === 'image' || block.kind === 'table' || block.kind === 'graph' || block.kind === 'list'),
    prompt: indexed.filter(({ block }) => block.kind !== 'image' && block.kind !== 'table' && block.kind !== 'graph' && block.kind !== 'list'),
  };
}

const taskBySkill: Record<NonNullable<Question['readingSkill']>, string> = {
  'words-in-context': 'Which choice completes the text most logically and precisely?',
  inference: 'Which choice is best supported by the text?',
  'cross-text-connections': 'Which choice best describes the relationship between the texts?',
  'rhetorical-synthesis': 'Which choice best uses the notes to meet the goal?',
  'standard-english-conventions': 'Which choice completes the text according to the conventions of Standard English?',
  transitions: 'Which choice provides the most logical transition?',
  'text-structure': 'Which choice best describes the purpose or structure of the text?',
};

/** Older imported Reading items stored source material in prompt. Display it as a passage. */
export function arrangeReadingQuestion(question: Question) {
  const split = splitReadingPrompt(question.prompt);
  if (question.passages?.length) return { passages: question.passages, media: split.media, prompt: split.prompt, generatedTask: false };
  const text = question.prompt.filter((block) => block.kind === 'text').map((block) => block.text).join(' ');
  const skill = question.readingSkill ?? (text.includes('Text 1:') && text.includes('Text 2:') ? 'cross-text-connections' : undefined);
  const task = skill ? taskBySkill[skill] : text.includes('____') ? 'Which choice best completes the text?' : 'Which choice best answers the question based on the text?';
  return { passages: [{ id: 'prompt', content: question.prompt }], media: [], prompt: [{ block: { kind: 'text', text: task } as ContentBlock, index: 0 }], generatedTask: true };
}

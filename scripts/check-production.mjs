import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import assert from 'node:assert/strict';

const forbidden = ['DEV_MOCK_ADAPTER_ONLY', 'SYNTHETIC_OLYMPIAD_FIXTURES', 'dev-olympiad', '1609-mock-v4', 'learner@example.test', 'This is placeholder passage text for the mock test interface.', 'First placeholder answer choice', 'Local mock code: 123456', 'Simulated development score — not graded'];
let content = '';
async function inspect(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) await inspect(path);
    else {
      assert(!path.endsWith('.map'), `Unexpected source map: ${path}`);
      if (!/\.(js|css|html|json)$/.test(path)) continue;
      const text = await readFile(path, 'utf8');
      for (const marker of forbidden) assert(!text.includes(marker), `Forbidden marker ${marker} in ${path}`);
      content += text;
    }
  }
}
await inspect('dist');
assert(content.includes('Exam service unavailable.'), 'Production must include the unavailable state.');
console.log('Production check passed: development modules/fixtures and answer-key markers absent; unavailable state present.');

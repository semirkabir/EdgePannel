import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { describe, it } from 'node:test';

function getDeductionPanelImportBlock(source) {
  const start = source.indexOf("import('@/components/DeductionPanel').then(({ DeductionPanel }) => {");
  assert.ok(start >= 0, 'DeductionPanel dynamic import should exist');
  const end = source.indexOf('}, () => undefined);', start);
  assert.ok(end >= 0, 'DeductionPanel import should use two-arg .then(onFulfilled, onRejected)');
  return source.slice(start, end + '}, () => undefined);'.length);
}

describe('panel-layout dynamic import guard', () => {
  it('guards DeductionPanel named export before construction', async () => {
    const source = await readFile(new URL('../src/app/panel-layout.ts', import.meta.url), 'utf8');
    const block = getDeductionPanelImportBlock(source);

    assert.match(
      block,
      /if \(typeof DeductionPanel !== 'function'\) return;/,
      'DeductionPanel import should tolerate named export resolution failures',
    );
    assert.doesNotMatch(
      block,
      /\.catch\(/,
      'Use two-arg .then so callback construction errors are not swallowed',
    );
  });
});

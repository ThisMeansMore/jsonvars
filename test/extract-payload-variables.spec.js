import test from 'node:test';
import assert from 'node:assert/strict';
import { extractPayloadVariables, PayloadTemplateError } from '../dist/index.js';

const types = ['string', 'number', 'boolean', 'string[]', 'number[]',
  'string?', 'number?', 'boolean?', 'string[]?', 'number[]?'];

test('extracts all types in first occurrence order through objects and arrays', () => {
  const template = { nested: types.map((type, i) => ({ value: `{{v${i}:${type}}}` })) };
  assert.deepEqual(extractPayloadVariables(template), types.map((type, i) => ({ name: `v${i}`, type })));
});

test('deduplicates repeated declarations and skips constants', () => {
  assert.deepEqual(extractPayloadVariables({ a: '{{x:number}}', b: ['ordinary', '{{x:number}}', null] }),
    [{ name: 'x', type: 'number' }]);
});

test('rejects scalar, array, and nullable conflicts with paths', () => {
  for (const other of ['string', 'number[]', 'number?']) {
    assert.throws(() => extractPayloadVariables({ a: '{{x:number}}', nested: ['{{x:' + other + '}}'] }), error => {
      assert.deepEqual(error.issue, { code: 'VARIABLE_TYPE_CONFLICT', variableName: 'x',
        declaredType: 'number', declaredAt: '$.a', conflictingType: other, conflictingAt: '$.nested[0]' });
      return true;
    });
  }
});

test('rejects unsupported types and modifiers', () => {
  for (const type of ['integer', 'date', 'datetime', 'isodate', 'boolean[]', 'object',
    'string!', 'string?[]', 'string|upper']) {
    assert.throws(() => extractPayloadVariables({ x: `{{x:${type}}}` }), error => {
      assert.deepEqual(error.issue, { code: 'UNSUPPORTED_TYPE', path: '$.x', variableName: 'x', declaredType: type });
      return true;
    });
  }
});

test('rejects whitespace, invalid names, markers, and interpolation', () => {
  const invalid = ['{{ x:string }}', '{{x: string}}', '{{x:string }}', '{{x :string}}',
    '{{x:string[ ]}}', '{{x:string []}}', '{{1x:string}}', '{{x-y:string}}',
    '{{x.y:string}}', 'prefix {{x:string}} suffix', '{{', '}}', '{{x:string}} extra'];
  for (const placeholder of invalid) {
    assert.throws(() => extractPayloadVariables([placeholder]), error => {
      assert.ok(error instanceof PayloadTemplateError);
      assert.deepEqual(error.issue, { code: 'INVALID_PLACEHOLDER', path: '$[0]', placeholder });
      return true;
    });
  }
});

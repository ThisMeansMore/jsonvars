import test from 'node:test';
import assert from 'node:assert/strict';
import { renderPayloadTemplate, PayloadTemplateError } from '../dist/index.js';

test('renders every primitive and array type without changing constants or inputs', () => {
  const strings = Object.freeze(['a', '']);
  const numbers = Object.freeze([0, 1.5]);
  const template = Object.freeze({ nested: Object.freeze([
    '{{s:string}}', '{{n:number}}', '{{b:boolean}}', '{{ss:string[]}}', '{{nn:number[]}}',
    '', 0, false, null, Object.freeze({ repeated: '{{n:number}}' }),
  ]) });
  const variables = Object.freeze({ s: '', n: 2, b: false, ss: strings, nn: numbers, extra: 'ignored' });
  const result = renderPayloadTemplate(template, variables);
  assert.deepEqual(result, { nested: ['', 2, false, ['a', ''], [0, 1.5], '', 0, false, null, { repeated: 2 }] });
  result.nested[3].push('changed');
  assert.deepEqual(strings, ['a', '']);
  assert.deepEqual(numbers, [0, 1.5]);
  assert.equal(template.nested[0], '{{s:string}}');
});

test('normalizes nullable scalars and arrays, preserving zero and false', () => {
  const template = { s: '{{s:string?}}', n: '{{n:number?}}', b: '{{b:boolean?}}',
    ss: '{{ss:string[]?}}', nn: '{{nn:number[]?}}' };
  assert.deepEqual(renderPayloadTemplate(template, { s: '', n: 0, b: false, ss: [], nn: null }),
    { s: null, n: 0, b: false, ss: null, nn: null });
  assert.deepEqual(renderPayloadTemplate(template, {}),
    { s: null, n: null, b: null, ss: null, nn: null });
  assert.deepEqual(renderPayloadTemplate(template, { s: 'text', n: 2, b: true, ss: ['x'], nn: [3] }),
    { s: 'text', n: 2, b: true, ss: ['x'], nn: [3] });
  assert.deepEqual(renderPayloadTemplate(['{{s:string[]}}', '{{n:number[]}}'], { s: [], n: [] }), [[], []]);
});

test('reports missing non-nullable variables at every use', () => {
  assert.throws(() => renderPayloadTemplate({ a: '{{x:string}}', b: ['{{x:string}}'] }, {}), error => {
    assert.deepEqual(error.issue, { code: 'MISSING_VARIABLE', variableName: 'x',
      expectedType: 'string', templatePaths: ['$.a', '$.b[0]'] });
    return true;
  });
});

test('rejects invalid scalar values without coercion', () => {
  const cases = [
    ['string', null, 'null'], ['string', 2, 'number'], ['number', '2', 'string'],
    ['number', NaN, 'non-finite number'], ['number', Infinity, 'non-finite number'],
    ['number', -Infinity, 'non-finite number'], ['boolean', 0, 'number'],
    ['boolean?', 'false', 'string'], ['number?', [], 'array'],
  ];
  for (const [type, value, actualType] of cases) {
    assert.throws(() => renderPayloadTemplate({ a: `{{x:${type}}}`, b: `{{x:${type}}}` }, { x: value }), error => {
      assert.deepEqual(error.issue, { code: 'INVALID_VARIABLE_TYPE', variableName: 'x',
        expectedType: type, actualType, templatePaths: ['$.a', '$.b'] });
      return true;
    });
  }
});

test('rejects invalid array elements with value path', () => {
  const cases = [['string[]', ['a', 2], 'number', '$[1]'],
    ['string[]?', ['a', null], 'null', '$[1]'],
    ['number[]', [1, '2'], 'string', '$[1]'],
    ['number[]?', [1, null], 'null', '$[1]'],
    ['number[]', [NaN], 'non-finite number', '$[0]'],
    ['number[]', [Infinity], 'non-finite number', '$[0]']];
  for (const [type, value, actualType, valuePath] of cases) {
    assert.throws(() => renderPayloadTemplate('{{x:' + type + '}}', { x: value }), error => {
      assert.deepEqual(error.issue, { code: 'INVALID_VARIABLE_TYPE', variableName: 'x',
        expectedType: type, actualType, templatePaths: ['$'], valuePath });
      return true;
    });
  }
});

test('validates template syntax and protects special object keys', () => {
  assert.throws(() => renderPayloadTemplate({ x: 'prefix {{x:string}}' }, { x: 'ok' }),
    { issue: { code: 'INVALID_PLACEHOLDER', path: '$.x', placeholder: 'prefix {{x:string}}' } });
  const template = JSON.parse('{"__proto__":"{{x:string}}"}');
  const result = renderPayloadTemplate(template, { x: 'safe' });
  assert.equal(Object.getOwnPropertyDescriptor(result, '__proto__').value, 'safe');
  assert.equal(Object.getPrototypeOf(result), Object.prototype);
});

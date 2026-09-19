# payload-vars

Extract typed variables from parsed JSON templates and render them with runtime values. This ESM package has no runtime dependencies and works in modern browsers and Node.js 18+.

## Install

```sh
npm install payload-vars
```

## Syntax and types

A variable occupies an entire JSON string: `{{variableName:type}}`. Names match `[A-Za-z_][A-Za-z0-9_]*`. Whitespace variants and partial interpolation are invalid. Strings without `{{` or `}}` are constants.

| Type | Accepted values | Nullable variant |
| --- | --- | --- |
| `string` | Any string, including `""` | `string?`: `""`, `null`, missing or `undefined` becomes `null` |
| `number` | Finite number | `number?`: `""`, `null`, missing or `undefined` becomes `null`; `0` stays `0` |
| `boolean` | `true` or `false` | `boolean?`: `""`, `null`, missing or `undefined` becomes `null`; `false` stays `false` |
| `string[]` | Array of strings | `string[]?`: `[]`, `null`, missing or `undefined` becomes `null` |
| `number[]` | Array of finite numbers | `number[]?`: `[]`, `null`, missing or `undefined` becomes `null` |

Arrays cannot contain `null`. Non-nullable empty arrays stay empty. Values are never coerced. Literal JSON `null` is valid.

## API

```ts
import {
  extractPayloadVariables,
  renderPayloadTemplate,
  PayloadTemplateError,
  type JsonValue,
  type JsonObject,
  type JsonPrimitive,
  type PayloadVariable,
  type PayloadVariableType,
  type PayloadTemplateIssue,
} from 'payload-vars';

const template: JsonValue = {
  orderId: '{{orderId:string}}',
  details: {
    amount: '{{amount:number}}',
    copiedAmount: '{{amount:number}}',
  },
  products: '{{products:string[]}}',
  comment: '{{comment:string?}}',
};

extractPayloadVariables(template);
// [
//   { name: 'orderId', type: 'string' },
//   { name: 'amount', type: 'number' },
//   { name: 'products', type: 'string[]' },
//   { name: 'comment', type: 'string?' },
// ]

const payload = renderPayloadTemplate(template, {
  orderId: 'ORD-123',
  amount: 19.95,
  products: ['A', 'B'],
  comment: '',
});
// {
//   orderId: 'ORD-123',
//   details: { amount: 19.95, copiedAmount: 19.95 },
//   products: ['A', 'B'],
//   comment: null,
// }
```

Both functions accept already parsed JSON values. Extraction traverses nested objects and arrays in first occurrence order. Repeated variables must have identical complete types, including `?`. Rendering ignores unused variables and creates a fresh result without mutating inputs.

## Errors

`PayloadTemplateError.issue` is a discriminated union with stable codes and details:

| Code | Details |
| --- | --- |
| `INVALID_PLACEHOLDER` | `path`, `placeholder` |
| `UNSUPPORTED_TYPE` | `path`, `variableName`, `declaredType` |
| `VARIABLE_TYPE_CONFLICT` | `variableName`, `declaredType`, `declaredAt`, `conflictingType`, `conflictingAt` |
| `MISSING_VARIABLE` | `variableName`, `expectedType`, `templatePaths` |
| `INVALID_VARIABLE_TYPE` | `variableName`, `expectedType`, `actualType`, `templatePaths`, optional `valuePath` |

Paths start at `$`, use `.key` for identifier keys, and `[0]` for array positions. Other object keys use bracketed JSON strings such as `$["order-id"]`. `templatePaths` lists every use of a repeated variable. An invalid array element has a `valuePath` such as `$[2]`. Runtime values are not included in errors.

```ts
try {
  const payload = renderPayloadTemplate(template, variables);
} catch (error) {
  if (error instanceof PayloadTemplateError) {
    switch (error.issue.code) {
      case 'MISSING_VARIABLE':
        // Consumer-specific handling
        break;
    }
  }

  throw error;
}
```

## Limits

Raw JSON parsing, date validation, formatters, partial interpolation, object variables, `boolean[]`, nullable array elements, and non-empty modifiers are outside this API. Dates can be passed as strings without semantic validation. Templates must be parsed JSON trees.

## Development

```sh
npm install
npm run typecheck
npm test
npm run build
npm pack --dry-run
```

The package follows semantic versioning. Error codes and issue shapes are public API.
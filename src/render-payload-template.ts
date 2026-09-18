import { PayloadTemplateError } from './payload-template.error.js';
import type { JsonValue, PayloadVariableType } from './payload-template.types.js';
import { childPath, collectContract, type Declaration } from './template-internal.js';

function actualType(value: unknown): string {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  if (typeof value === 'number' && !Number.isFinite(value)) return 'non-finite number';
  return typeof value;
}

function validate(value: unknown, declaration: Declaration): JsonValue {
  const { name, type, paths } = declaration;
  const nullable = type.endsWith('?');
  if (nullable && (value === null || value === undefined || value === '' ||
      (Array.isArray(value) && value.length === 0 && type.includes('[]')))) return null;
  const base: PayloadVariableType = nullable ? type.slice(0, -1) as PayloadVariableType : type;
  const fail = (bad: unknown, valuePath?: string): never => {
    throw new PayloadTemplateError({
      code: 'INVALID_VARIABLE_TYPE', variableName: name, expectedType: type,
      actualType: actualType(bad), templatePaths: [...paths],
      ...(valuePath === undefined ? {} : { valuePath }),
    });
  };
  if (base === 'string') return typeof value === 'string' ? value : fail(value);
  if (base === 'number') return typeof value === 'number' && Number.isFinite(value) ? value : fail(value);
  if (base === 'boolean') return typeof value === 'boolean' ? value : fail(value);
  if (!Array.isArray(value)) return fail(value);
  const elementType = base === 'string[]' ? 'string' : 'number';
  for (let index = 0; index < value.length; index++) {
    const element: unknown = value[index];
    if (elementType === 'string' ? typeof element !== 'string' :
        typeof element !== 'number' || !Number.isFinite(element)) fail(element, `$[${index}]`);
  }
  return [...value] as JsonValue[];
}

export function renderPayloadTemplate(
  template: JsonValue,
  variables: Readonly<Record<string, unknown>>,
): JsonValue {
  const contract = collectContract(template);
  const values = new Map<string, JsonValue>();
  for (const declaration of contract.declarations.values()) {
    if (!Object.prototype.hasOwnProperty.call(variables, declaration.name) && !declaration.type.endsWith('?')) {
      throw new PayloadTemplateError({ code: 'MISSING_VARIABLE', variableName: declaration.name,
        expectedType: declaration.type, templatePaths: [...declaration.paths] });
    }
    values.set(declaration.name, validate(variables[declaration.name], declaration));
  }
  function render(value: JsonValue, path: string): JsonValue {
    const declaration = contract.locations.get(path);
    if (declaration) return values.get(declaration.name)!;
    if (Array.isArray(value)) return value.map((item, index) => render(item, `${path}[${index}]`));
    if (value !== null && typeof value === 'object') {
      const result: Record<string, JsonValue> = {};
      for (const key of Object.keys(value)) {
        Object.defineProperty(result, key, { value: render(value[key]!, childPath(path, key)),
          enumerable: true, writable: true, configurable: true });
      }
      return result;
    }
    return value;
  }
  return render(template, '$');
}

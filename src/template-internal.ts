import { PayloadTemplateError } from './payload-template.error.js';
import type { JsonValue, PayloadVariableType } from './payload-template.types.js';

export interface Declaration { name: string; type: PayloadVariableType; paths: string[] }
export interface Contract { declarations: Map<string, Declaration>; locations: Map<string, Declaration> }

const validTypes = new Set<string>([
  'string', 'number', 'boolean', 'string[]', 'number[]',
  'string?', 'number?', 'boolean?', 'string[]?', 'number[]?',
]);
const namePattern = /^[A-Za-z_][A-Za-z0-9_]*$/;
const identifierPattern = /^[A-Za-z_$][A-Za-z0-9_$]*$/;

export function childPath(path: string, key: string): string {
  return identifierPattern.test(key) ? `${path}.${key}` : `${path}[${JSON.stringify(key)}]`;
}

export function parsePlaceholder(value: string, path: string): Declaration | undefined {
  if (!value.includes('{{') && !value.includes('}}')) return undefined;
  const match = /^\{\{([^{}:]+):([^{}:]+)\}\}$/.exec(value);
  if (!match || /\s/.test(value) || !namePattern.test(match[1] ?? '')) {
    throw new PayloadTemplateError({ code: 'INVALID_PLACEHOLDER', path, placeholder: value });
  }
  const name = match[1]!;
  const type = match[2]!;
  if (!validTypes.has(type)) {
    throw new PayloadTemplateError({ code: 'UNSUPPORTED_TYPE', path, variableName: name, declaredType: type });
  }
  return { name, type: type as PayloadVariableType, paths: [path] };
}

export function collectContract(template: JsonValue): Contract {
  const declarations = new Map<string, Declaration>();
  const locations = new Map<string, Declaration>();
  function visit(value: JsonValue, path: string): void {
    if (typeof value === 'string') {
      const found = parsePlaceholder(value, path);
      if (!found) return;
      const previous = declarations.get(found.name);
      if (previous && previous.type !== found.type) {
        throw new PayloadTemplateError({
          code: 'VARIABLE_TYPE_CONFLICT', variableName: found.name,
          declaredType: previous.type, declaredAt: previous.paths[0]!,
          conflictingType: found.type, conflictingAt: path,
        });
      }
      if (previous) previous.paths.push(path);
      else declarations.set(found.name, found);
      locations.set(path, found);
    } else if (Array.isArray(value)) {
      value.forEach((item, index) => visit(item, `${path}[${index}]`));
    } else if (value !== null && typeof value === 'object') {
      for (const key of Object.keys(value)) visit(value[key]!, childPath(path, key));
    }
  }
  visit(template, '$');
  return { declarations, locations };
}

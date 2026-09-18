import type { JsonValue, PayloadVariable } from './payload-template.types.js';
import { collectContract } from './template-internal.js';

export function extractPayloadVariables(template: JsonValue): PayloadVariable[] {
  return Array.from(collectContract(template).declarations.values(), ({ name, type }) => ({ name, type }));
}

export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonObject | JsonValue[];
export interface JsonObject { [key: string]: JsonValue }

export type PayloadVariableType =
  | 'string' | 'number' | 'boolean' | 'string[]' | 'number[]'
  | 'string?' | 'number?' | 'boolean?' | 'string[]?' | 'number[]?';

export interface PayloadVariable {
  name: string;
  type: PayloadVariableType;
}

export type PayloadTemplateIssue =
  | { code: 'INVALID_PLACEHOLDER'; path: string; placeholder: string }
  | { code: 'UNSUPPORTED_TYPE'; path: string; variableName: string; declaredType: string }
  | { code: 'VARIABLE_TYPE_CONFLICT'; variableName: string; declaredType: string; declaredAt: string; conflictingType: string; conflictingAt: string }
  | { code: 'MISSING_VARIABLE'; variableName: string; expectedType: PayloadVariableType; templatePaths: string[] }
  | { code: 'INVALID_VARIABLE_TYPE'; variableName: string; expectedType: PayloadVariableType; actualType: string; templatePaths: string[]; valuePath?: string };

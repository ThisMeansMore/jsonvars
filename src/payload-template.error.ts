import type { PayloadTemplateIssue } from './payload-template.types.js';

export class PayloadTemplateError extends Error {
  constructor(public readonly issue: PayloadTemplateIssue) {
    super(issue.code);
    this.name = 'PayloadTemplateError';
  }
}

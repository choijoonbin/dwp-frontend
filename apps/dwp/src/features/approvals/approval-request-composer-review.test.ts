import { describe, expect, it } from 'vitest';

import {
  approvalRequestFormChangeImpact,
  approvalRequestValidationIssues,
} from './approval-request-composer-review';

import type { ApprovalForm, ApprovalTypedField } from '@dwp-frontend/shared-utils';

const forms = [
  { formId: 'source', nameKo: '기존 양식', nameEn: 'Source', currentVersion: 2 },
  { formId: 'target', nameKo: '신규 양식', nameEn: 'Target', currentVersion: 4 },
] as ApprovalForm[];
const typedFields: ApprovalTypedField[] = [
  { key: 'amount', type: 'NUMBER', labelKo: '금액', labelEn: 'Amount', required: true },
  {
    key: 'items',
    type: 'REPEATING_GROUP',
    labelKo: '항목',
    labelEn: 'Items',
    fields: [{ key: 'owner', type: 'USER', labelKo: '담당자', labelEn: 'Owner' }],
  },
];

describe('approval request preflight and form reconciliation', () => {
  it('orders document errors before exact typed paths and deduplicates evaluator errors', () => {
    expect(
      approvalRequestValidationIssues({
        title: ' ',
        summary: '',
        titleLabel: 'Title',
        summaryLabel: 'Summary',
        businessFieldsLabel: 'Business fields',
        korean: false,
        legacyMissing: [],
        typedFields,
        typedMissingPaths: ['amount'],
        invalidPath: 'amount',
        userSourcePath: 'items[0].owner',
      })
    ).toEqual([
      { path: '$title', label: 'Title' },
      { path: '$summary', label: 'Summary' },
      { path: 'amount', label: 'Amount' },
      { path: 'items[0].owner', label: 'Items · Owner' },
    ]);
  });

  it('reports only populated business values as excluded before a form switch', () => {
    expect(
      approvalRequestFormChangeImpact({
        forms,
        sourceFormId: 'source',
        targetFormId: 'target',
        values: { amount: '1200', empty: ' ', items: [{}] },
        korean: false,
        legacyFields: [],
        typedFields,
      })
    ).toEqual({
      source: { formId: 'source', label: 'Source', version: 2 },
      target: { formId: 'target', label: 'Target', version: 4 },
      excluded: [{ path: 'amount', label: 'Amount' }],
    });
  });

  it('fails closed when either form is no longer in the current catalog', () => {
    expect(
      approvalRequestFormChangeImpact({
        forms: forms.slice(0, 1),
        sourceFormId: 'source',
        targetFormId: 'target',
        values: { amount: '1200' },
        korean: false,
        legacyFields: [],
        typedFields,
      })
    ).toBeUndefined();
  });
});

import { describe, expect, it } from 'vitest';

import { approvalFormReadModel } from './approval-form-read-projection';

import type {
  ApprovalFormDetail,
  ApprovalFormOversightProjection,
} from '@dwp-frontend/shared-utils';

const form: ApprovalFormOversightProjection = {
  formId: '11111111-1111-1111-1111-111111111111',
  formKey: 'EXPENSE_FORM',
  categoryId: '22222222-2222-2222-2222-222222222222',
  categoryKey: 'FINANCE',
  categoryNameKo: '재무',
  categoryNameEn: 'Finance',
  nameKo: '비용 요청',
  nameEn: 'Expense request',
  formKind: 'REQUEST',
  lifecycleState: 'PUBLISHED',
  currentVersion: 2,
  fieldCount: 1,
  routeCount: 1,
  usageCount: 8,
  version: 3,
  updatedAt: '2026-10-27T00:00:00Z',
};

describe('approval form read projection', () => {
  it('keeps oversight metadata selectable without promoting it to editable detail', () => {
    expect(approvalFormReadModel(form)).toEqual({ form });
  });

  it('keeps a full-management detail available to the editor', () => {
    const detail: ApprovalFormDetail = {
      form: {
        ...form,
        descriptionKo: '비용 요청 양식',
        descriptionEn: 'Expense request form',
        ownerGroupRef: 'FINANCE_APPROVER',
      },
      schema: {
        schemaVersion: 1,
        fields: [
          {
            key: 'summary',
            labelKo: '요청 내용',
            labelEn: 'Summary',
            type: 'TEXTAREA',
            required: true,
          },
        ],
      },
      schemaHash: 'schema-hash',
      routes: [],
    };

    expect(approvalFormReadModel(detail)).toEqual({ form: detail.form, detail });
  });
});

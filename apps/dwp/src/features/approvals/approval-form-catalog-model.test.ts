import { describe, expect, it } from 'vitest';

import {
  buildApprovalFormCategoryTree,
  descendantCategoryIds,
  validApprovalFormFields,
} from './approval-form-catalog-model';

import type { ApprovalForm, ApprovalFormCategory } from '@dwp-frontend/shared-utils';

const category = (
  categoryId: string,
  parentCategoryId: string | null,
  sortOrder: number
): ApprovalFormCategory => ({
  categoryId,
  categoryKey: categoryId.toUpperCase(),
  parentCategoryId,
  nameKo: categoryId,
  nameEn: categoryId,
  descriptionKo: '',
  descriptionEn: '',
  iconKey: 'files',
  sortOrder,
  lifecycleState: 'ACTIVE',
  formCount: 0,
  version: 0,
});

const form = (formId: string, categoryId: string): ApprovalForm => ({
  formId,
  formKey: formId.toUpperCase(),
  categoryId,
  categoryKey: categoryId.toUpperCase(),
  categoryNameKo: categoryId,
  categoryNameEn: categoryId,
  nameKo: formId,
  nameEn: formId,
  descriptionKo: '설명',
  descriptionEn: 'Description',
  ownerGroupRef: 'APPROVAL_OPERATOR',
  formKind: 'REQUEST',
  lifecycleState: 'DRAFT',
  currentVersion: 1,
  fieldCount: 1,
  routeCount: 1,
  usageCount: 0,
  version: 0,
  updatedAt: '2026-08-19T00:00:00Z',
});

describe('approval form catalog model', () => {
  it('keeps arbitrary category depth and aggregates descendant forms', () => {
    const categories = [
      category('root', null, 10),
      category('child', 'root', 20),
      category('leaf', 'child', 30),
    ];

    expect([...descendantCategoryIds(categories, 'root')]).toEqual(['root', 'child', 'leaf']);
    expect(buildApprovalFormCategoryTree(categories, [form('one', 'leaf')])).toEqual([
      { category: categories[0], depth: 0, count: 1 },
      { category: categories[1], depth: 1, count: 1 },
      { category: categories[2], depth: 2, count: 1 },
    ]);
  });

  it('rejects duplicate field keys and incomplete select options', () => {
    const validField = {
      key: 'reason',
      labelKo: '사유',
      labelEn: 'Reason',
      type: 'TEXT' as const,
      required: true,
      options: [],
    };
    expect(validApprovalFormFields([validField])).toBe(true);
    expect(validApprovalFormFields([validField, validField])).toBe(false);
    expect(
      validApprovalFormFields([{ ...validField, type: 'SELECT', options: ['ONE', 'ONE'] }])
    ).toBe(false);
  });
});

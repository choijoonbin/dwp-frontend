import { describe, expect, it } from 'vitest';

import { queryApprovalFormCatalog } from './approval-form-catalog-query';

import type { ApprovalForm } from '@dwp-frontend/shared-utils';

const form: ApprovalForm = {
  formId: 'form-a',
  formKey: 'FORM_A',
  categoryId: 'category-a',
  categoryKey: 'ACCESS',
  categoryNameKo: 'Access',
  categoryNameEn: 'Access',
  nameKo: 'A',
  nameEn: 'A',
  descriptionKo: 'Description',
  descriptionEn: 'Description',
  ownerGroupRef: 'SECURITY_APPROVER',
  formKind: 'REQUEST',
  lifecycleState: 'PUBLISHED',
  currentVersion: 3,
  fieldCount: 4,
  routeCount: 1,
  usageCount: 7,
  version: 3,
  updatedAt: '2026-08-10T04:00:00Z',
};
const options = {
  search: '',
  categoryIds: null,
  lifecycle: 'ALL',
  sort: 'updated',
  locale: 'en',
} as const;

describe('approval form catalog query', () => {
  it('searches actual owner metadata while preserving category and lifecycle boundaries', () => {
    const draft = { ...form, formId: 'draft', lifecycleState: 'DRAFT' };
    expect(
      queryApprovalFormCatalog([form, draft], {
        ...options,
        search: ' security_approver ',
        lifecycle: 'DRAFT',
        categoryIds: new Set(['category-a']),
      })
    ).toEqual([draft]);
    expect(
      queryApprovalFormCatalog([form], {
        ...options,
        categoryIds: new Set(['category-b']),
      })
    ).toEqual([]);
  });
  it('sorts timestamps by instant with deterministic ties and invalid dates last', () => {
    const same = {
      ...form,
      formId: 'same',
      formKey: 'FORM_B',
      updatedAt: '2026-08-10T13:00:00+09:00',
    };
    const newer = { ...form, formId: 'newer', updatedAt: '2026-08-11T04:00:00Z' };
    const invalid = { ...form, formId: 'invalid', updatedAt: 'invalid' };
    const source = [invalid, same, newer, form];
    expect(queryApprovalFormCatalog(source, options).map((item) => item.formId)).toEqual([
      'newer',
      'form-a',
      'same',
      'invalid',
    ]);
    expect(source[0]).toBe(invalid);
  });
  it('sorts by the selected preview language rather than a fixed translated label', () => {
    const other = { ...form, formId: 'other', nameEn: 'Z', nameKo: '0' };
    expect(
      queryApprovalFormCatalog([form, other], { ...options, sort: 'name', locale: 'en' })[0]
    ).toBe(form);
    expect(
      queryApprovalFormCatalog([form, other], { ...options, sort: 'name', locale: 'ko' })[0]
    ).toBe(other);
  });
});

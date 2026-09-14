import { webcrypto } from 'node:crypto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { approvalPublishedPreviewBinding } from './approval-form-published-preview-binding';
import { compileApprovalTypedForm } from './approval-form-typed-compiler';
import { typedEditorSeed } from './approval-form-builder-typed-model';
import type { ApprovalFormDetail } from '@dwp-frontend/shared-utils/api/approval-management-contract';

const formId = '11111111-1111-1111-1111-111111111111';
const formVersionId = '22222222-2222-2222-2222-222222222222';
const source = async () => {
  vi.stubGlobal('crypto', webcrypto);
  const schema = typedEditorSeed('요약', 'Summary');
  const compiled = await compileApprovalTypedForm(schema);
  const detail: ApprovalFormDetail = {
    form: {
      formId,
      lifecycleState: 'PUBLISHED',
      formKey: 'TEST_FORM',
      categoryId: 'category',
      categoryKey: 'TEST',
      categoryNameKo: '테스트',
      categoryNameEn: 'Test',
      nameKo: '양식',
      nameEn: 'Form',
      descriptionKo: '테스트 양식',
      descriptionEn: 'Test form',
      ownerGroupRef: 'APPROVAL_DESIGNER',
      formKind: 'REQUEST',
      currentVersion: 1,
      fieldCount: schema.fields.length,
      routeCount: 0,
      usageCount: 0,
      version: 1,
      updatedAt: '2026-09-14T00:00:00Z',
    },
    formVersionId,
    schema,
    schemaHash: compiled.schemaSha256,
    routes: [],
  };
  return { detail, compiled };
};

describe('published ADMIN user preview binding', () => {
  afterEach(() => vi.unstubAllGlobals());
  it('binds the actual published version and compiled hash to ADMIN, not WORK', async () => {
    const { detail, compiled } = await source();
    expect(approvalPublishedPreviewBinding(detail, compiled, true)).toEqual({
      formId,
      formVersionId,
      schemaSha256: compiled.schemaSha256,
      surface: 'ADMIN',
    });
  });
  it('fails closed for drafts, archived versions, source failure, absent compilation and missing or malformed UUIDs', async () => {
    const { detail, compiled } = await source();
    for (const lifecycleState of ['DRAFT', 'ARCHIVED'])
      expect(
        approvalPublishedPreviewBinding(
          { ...detail, form: { ...detail.form, lifecycleState } },
          compiled,
          true
        )
      ).toBeUndefined();
    expect(approvalPublishedPreviewBinding(detail, compiled, false)).toBeUndefined();
    expect(approvalPublishedPreviewBinding(detail, undefined, true)).toBeUndefined();
    for (const value of [null, undefined, '', 'not-a-version', formVersionId.toUpperCase() + ' '])
      expect(
        approvalPublishedPreviewBinding({ ...detail, formVersionId: value }, compiled, true)
      ).toBeUndefined();
    expect(
      approvalPublishedPreviewBinding(
        { ...detail, form: { ...detail.form, formId: 'not-a-form' } },
        compiled,
        true
      )
    ).toBeUndefined();
  });
  it('rejects wrong, missing and noncanonical hashes even when the source returned 200', async () => {
    const { detail, compiled } = await source();
    for (const schemaHash of ['', '0'.repeat(64), compiled.schemaSha256.toUpperCase()])
      expect(
        approvalPublishedPreviewBinding({ ...detail, schemaHash }, compiled, true)
      ).toBeUndefined();
    expect(
      approvalPublishedPreviewBinding(
        { ...detail, schema: typedEditorSeed('다른 정의', 'Different definition') },
        compiled,
        true
      )
    ).toBeUndefined();
  });
});

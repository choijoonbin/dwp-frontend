import { describe, expect, it } from 'vitest';
import { compileApprovalTypedForm } from './approval-form-typed-compiler';
import {
  approvalWorkflowFormPinsMatch,
  captureApprovalWorkflowFormSource,
} from './approval-workflow-typed-source';

import type { ApprovalFormDetail } from '@dwp-frontend/shared-utils';

async function detail(): Promise<ApprovalFormDetail> {
  const compiled = await compileApprovalTypedForm({
    schemaContract: 'DWP_APPROVAL_FORM_TYPED_V2',
    schemaVersion: 2,
    fields: [
      { key: 'summary', type: 'TEXTAREA', required: true, labelKo: 'Summary', labelEn: 'Summary' },
    ],
  });
  return {
    form: {
      formId: '11111111-1111-4111-8111-111111111111',
      formKey: 'REVIEW_FORM',
      categoryId: 'category',
      categoryKey: 'GENERAL',
      categoryNameKo: 'General',
      categoryNameEn: 'General',
      nameKo: 'Review',
      nameEn: 'Review',
      descriptionKo: 'Review form',
      descriptionEn: 'Review form',
      formKind: 'REQUEST',
      lifecycleState: 'PUBLISHED',
      currentVersion: 2,
      fieldCount: 1,
      routeCount: 0,
      usageCount: 0,
      version: 4,
      updatedAt: '2026-09-14T00:00:00Z',
    },
    formVersionId: '22222222-2222-4222-8222-222222222222',
    schema: compiled.definition,
    schemaHash: compiled.schemaSha256,
    routes: [],
  };
}

describe('workflow condition form source pins', () => {
  it('accepts only actual published typed owner schema and SHA', async () => {
    const value = await detail();
    const source = await captureApprovalWorkflowFormSource(value);
    expect(source.pin).toMatchObject({
      formId: value.form.formId,
      version: 4,
      currentVersion: 2,
      schemaHash: value.schemaHash,
    });
    expect(source.compiled.schemaSha256).toBe(value.schemaHash);
    expect(Object.isFrozen(source.pin)).toBe(true);
  });
  it.each(['DRAFT', 'LEGACY', 'SHA', 'VERSION_ID', 'VERSION'] as const)(
    'rejects %s without claiming a condition source',
    async (defect) => {
      const value = await detail();
      if (defect === 'DRAFT') value.form.lifecycleState = 'DRAFT';
      if (defect === 'LEGACY')
        value.schema = {
          schemaVersion: 2,
          fields: [{ key: 'summary', type: 'TEXTAREA', required: true }],
        };
      if (defect === 'SHA') value.schemaHash = '0'.repeat(64);
      if (defect === 'VERSION_ID') value.formVersionId = null;
      if (defect === 'VERSION') value.form.version = Number.NaN;
      await expect(captureApprovalWorkflowFormSource(value)).rejects.toThrow();
    }
  );
  it.each(['formId', 'formVersionId', 'version', 'currentVersion', 'schemaHash'] as const)(
    'binds %s independently',
    async (key) => {
      const { pin } = await captureApprovalWorkflowFormSource(await detail());
      const changed = {
        ...pin,
        [key]: typeof pin[key] === 'number' ? Number(pin[key]) + 1 : `${pin[key]}-changed`,
      };
      expect(approvalWorkflowFormPinsMatch(pin, changed)).toBe(false);
      expect(approvalWorkflowFormPinsMatch(pin, { ...pin })).toBe(true);
      expect(approvalWorkflowFormPinsMatch(null, pin)).toBe(false);
    }
  );
});

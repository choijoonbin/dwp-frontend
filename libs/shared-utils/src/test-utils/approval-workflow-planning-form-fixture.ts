import type { ApprovalFormDetail } from '../api/approval-management-contract';
import { planningIds } from './approval-workflow-planning-fixtures';

export function planningFormDetailFixture(): ApprovalFormDetail {
  return {
    form: {
      formId: planningIds.form,
      formKey: 'FORM',
      categoryId: planningIds.form,
      categoryKey: 'GENERAL',
      categoryNameKo: 'General',
      categoryNameEn: 'General',
      nameKo: 'Published form',
      nameEn: 'Published form',
      descriptionKo: '',
      descriptionEn: '',
      formKind: 'REQUEST',
      lifecycleState: 'PUBLISHED',
      currentVersion: 2,
      fieldCount: 2,
      routeCount: 1,
      usageCount: 0,
      version: 4,
      updatedAt: new Date().toISOString(),
    },
    schema: {
      schemaContract: 'DWP_APPROVAL_FORM_TYPED_V2',
      schemaVersion: 2,
      fields: [
        {
          key: 'summary',
          type: 'TEXTAREA',
          labelKo: 'Summary',
          labelEn: 'Summary',
          required: true,
        },
        { key: 'amount', type: 'NUMBER', labelKo: 'Amount', labelEn: 'Amount' },
      ],
    },
    schemaHash: '',
    formVersionId: planningIds.formVersion,
    routes: [],
  };
}

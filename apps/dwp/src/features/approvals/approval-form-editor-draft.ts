import { isApprovalTypedFormSchema } from '@dwp-frontend/shared-utils';
import { typedEditorSeed } from './approval-form-builder-typed-model';
import type { ApprovalFormDraftInput, getApprovalForm } from '@dwp-frontend/shared-utils';
import type { FormDraft, LegacyFormDraft, TypedFormDraft } from './approval-form-catalog-drafts';
import type { CompiledApprovalTypedForm } from './approval-form-typed-model';

export function advancedApprovalFormDraft(legacy: LegacyFormDraft): TypedFormDraft {
  const { fields, ...metadata } = legacy;
  const summary = fields.find((field) => field.key === 'summary');
  return {
    ...metadata,
    typedSchema: typedEditorSeed(summary?.labelKo ?? '', summary?.labelEn ?? ''),
  };
}

export function approvalFormEditorDraft(
  detail: Awaited<ReturnType<typeof getApprovalForm>>
): FormDraft {
  const metadata = {
    formKey: detail.form.formKey,
    categoryId: detail.form.categoryId,
    nameKo: detail.form.nameKo,
    nameEn: detail.form.nameEn,
    descriptionKo: detail.form.descriptionKo,
    descriptionEn: detail.form.descriptionEn,
    ownerGroupRef: detail.form.ownerGroupRef ?? 'APPROVAL_OPERATOR',
    defaultWorkflowId:
      detail.routes.find((item) => item.bindingType === 'DEFAULT')?.workflowId ?? '',
  };
  return isApprovalTypedFormSchema(detail.schema)
    ? { ...metadata, typedSchema: detail.schema }
    : {
        ...metadata,
        fields: detail.schema.fields.map((field) => ({
          ...field,
          labelKo: field.labelKo ?? field.key,
          labelEn: field.labelEn ?? field.key,
          helpKo: field.helpKo ?? '',
          helpEn: field.helpEn ?? '',
          options: field.options ? [...field.options] : [],
        })),
      };
}

export function captureApprovalFormEditorDraft(
  draft: FormDraft,
  compiled: CompiledApprovalTypedForm | null
): FormDraft | null {
  if (draft.typedSchema) return compiled ? { ...draft, typedSchema: compiled.definition } : null;
  return {
    ...draft,
    fields: draft.fields.map((field) => ({
      ...field,
      options: field.options ? [...field.options] : [],
    })),
  };
}

export function approvalFormEditorUpdateInput(draft: FormDraft): ApprovalFormDraftInput {
  const metadata = {
    categoryId: draft.categoryId,
    nameKo: draft.nameKo,
    nameEn: draft.nameEn,
    descriptionKo: draft.descriptionKo,
    descriptionEn: draft.descriptionEn,
    ownerGroupRef: draft.ownerGroupRef,
    defaultWorkflowId: draft.defaultWorkflowId,
  };
  return draft.typedSchema
    ? { ...metadata, typedSchema: draft.typedSchema }
    : { ...metadata, fields: draft.fields };
}

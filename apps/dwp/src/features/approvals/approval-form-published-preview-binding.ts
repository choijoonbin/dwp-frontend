import type { ApprovalFormDetail } from '@dwp-frontend/shared-utils/api/approval-management-contract';
import type { ApprovalFormUserBinding } from '@dwp-frontend/shared-utils/api/approval-form-user-api';
import type { CompiledApprovalTypedForm } from './approval-form-typed-model';
import { freezeTypedJson } from './approval-form-typed-model';

export type ApprovalPublishedPreviewBinding = Pick<
  ApprovalFormUserBinding,
  'formId' | 'formVersionId' | 'schemaSha256'
> &
  Readonly<{ surface: 'ADMIN' }>;

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const sha256 = /^[0-9a-f]{64}$/;

export function approvalPublishedPreviewBinding(
  detail: ApprovalFormDetail,
  compiled: CompiledApprovalTypedForm | undefined,
  sourceReady: boolean
): ApprovalPublishedPreviewBinding | undefined {
  if (
    !sourceReady ||
    detail.form.lifecycleState !== 'PUBLISHED' ||
    !compiled ||
    !uuid.test(detail.form.formId) ||
    !detail.formVersionId ||
    !uuid.test(detail.formVersionId) ||
    !sha256.test(detail.schemaHash) ||
    compiled.schemaSha256 !== detail.schemaHash
  )
    return undefined;
  try {
    if (compiled.canonicalJson !== JSON.stringify(freezeTypedJson(detail.schema))) return undefined;
  } catch {
    return undefined;
  }
  return {
    formId: detail.form.formId,
    formVersionId: detail.formVersionId,
    schemaSha256: compiled.schemaSha256,
    surface: 'ADMIN',
  };
}

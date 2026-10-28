import { isApprovalFormDetailProjection } from '@dwp-frontend/shared-utils';

import type {
  ApprovalFormDetail,
  ApprovalFormOversightProjection,
  ApprovalFormReadProjection,
} from '@dwp-frontend/shared-utils';

export type ApprovalFormReadModel = Readonly<{
  form: ApprovalFormDetail['form'] | ApprovalFormOversightProjection;
  detail?: ApprovalFormDetail;
}>;

export function approvalFormReadModel(
  projection: ApprovalFormReadProjection
): ApprovalFormReadModel {
  return isApprovalFormDetailProjection(projection)
    ? { form: projection.form, detail: projection }
    : { form: projection };
}

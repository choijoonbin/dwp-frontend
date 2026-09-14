import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useApprovalRequestFormEvaluation } from './use-approval-request-form-evaluation';
import { approvalRequestStoredEditingValues } from './approval-request-schema-model';
import { mergeApprovalResponseFields } from './approval-request-model';

import type { ApprovalRequestDetail } from '@dwp-frontend/shared-utils';

export function useApprovalRequestAmendment({
  detail,
  identity,
  enabled,
}: {
  detail?: ApprovalRequestDetail;
  identity: string;
  enabled: boolean;
}) {
  const [values, setValues] = useState<Record<string, unknown>>({});
  const [hydratedRevision, setHydratedRevision] = useState('');
  const preserve = useRef(false);
  const revision = detail
    ? JSON.stringify([identity, detail.request.requestId, detail.request.version])
    : '';
  const stored = useApprovalRequestFormEvaluation({
    schema: detail?.formSchema,
    values: detail?.payload ?? {},
    summary: detail?.request.summary ?? '',
    enabled,
  });
  const summary = typeof values.summary === 'string' ? values.summary : '';
  const evaluation = useApprovalRequestFormEvaluation({
    schema: detail?.formSchema,
    values,
    summary,
    enabled,
  });
  useEffect(() => {
    setValues({});
    setHydratedRevision('');
    preserve.current = false;
  }, [identity]);
  useEffect(() => {
    if (
      !detail ||
      !enabled ||
      !revision ||
      hydratedRevision === revision ||
      !stored.schemaReady ||
      !stored.draftValid
    )
      return;
    if (preserve.current) preserve.current = false;
    else
      setValues({
        ...approvalRequestStoredEditingValues(detail, stored.compiled),
        ...(stored.kind === 'TYPED' || Object.hasOwn(detail.payload, 'summary')
          ? { summary: detail.request.summary }
          : {}),
      });
    setHydratedRevision(revision);
  }, [
    detail,
    enabled,
    revision,
    hydratedRevision,
    stored.schemaReady,
    stored.draftValid,
    stored.compiled,
    stored.kind,
  ]);
  const fields = useMemo(
    () =>
      evaluation.kind === 'TYPED' || evaluation.kind === 'UNSUPPORTED'
        ? []
        : mergeApprovalResponseFields(evaluation.legacyFields, evaluation.legacyValues),
    [evaluation.kind, evaluation.legacyFields, evaluation.legacyValues]
  );
  const ready = Boolean(
    detail && revision && hydratedRevision === revision && evaluation.schemaReady
  );
  const complete =
    ready &&
    evaluation.submitValid &&
    (evaluation.kind === 'TYPED' ||
      fields
        .filter((field) => field.required)
        .every((field) => evaluation.legacyValues[field.key]?.trim()));
  const clear = useCallback(() => {
    setValues({});
    setHydratedRevision('');
    preserve.current = false;
  }, []);
  return {
    values,
    setValues,
    fields,
    evaluation,
    ready,
    complete,
    payload:
      evaluation.kind === 'TYPED' ? evaluation.submitEvaluation?.payload : evaluation.legacyValues,
    schemaHash: evaluation.compiled?.schemaSha256,
    clear,
    preserve: () => {
      preserve.current = true;
    },
  };
}

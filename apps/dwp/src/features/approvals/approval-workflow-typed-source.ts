import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  getApprovalForm,
  getApprovalForms,
  isApprovalTypedFormSchema,
} from '@dwp-frontend/shared-utils';

import { compileApprovalTypedForm } from './approval-form-typed-compiler';
import {
  approvalManagementSourceState,
  retryApprovalManagementRead,
} from './approval-management-source-state';

import type { ApprovalFormDetail } from '@dwp-frontend/shared-utils';
import type { ApprovalManagementRequestScope } from './use-approval-experience';
import type { CompiledApprovalTypedForm } from './approval-form-typed-model';

export type ApprovalWorkflowFormSourcePin = Readonly<{
  formId: string;
  formVersionId: string;
  version: number;
  currentVersion: number;
  schemaHash: string;
}>;

export async function captureApprovalWorkflowFormSource(detail: ApprovalFormDetail): Promise<{
  pin: ApprovalWorkflowFormSourcePin;
  compiled: CompiledApprovalTypedForm;
}> {
  if (
    detail.form.lifecycleState !== 'PUBLISHED' ||
    !detail.formVersionId ||
    !isApprovalTypedFormSchema(detail.schema) ||
    !Number.isSafeInteger(detail.form.version) ||
    !Number.isSafeInteger(detail.form.currentVersion)
  )
    throw new Error('Published typed form source required');
  const compiled = await compileApprovalTypedForm(detail.schema);
  if (compiled.schemaSha256 !== detail.schemaHash) throw new Error('Form owner hash mismatch');
  return Object.freeze({
    compiled,
    pin: Object.freeze({
      formId: detail.form.formId,
      formVersionId: detail.formVersionId,
      version: detail.form.version,
      currentVersion: detail.form.currentVersion,
      schemaHash: detail.schemaHash,
    }),
  });
}

export function approvalWorkflowFormPinsMatch(
  left: ApprovalWorkflowFormSourcePin | null,
  right: ApprovalWorkflowFormSourcePin | null
): boolean {
  return Boolean(
    left &&
    right &&
    left.formId === right.formId &&
    left.formVersionId === right.formVersionId &&
    left.version === right.version &&
    left.currentVersion === right.currentVersion &&
    left.schemaHash === right.schemaHash
  );
}

export function useApprovalWorkflowConditionSource(
  enabled: boolean,
  scope: ApprovalManagementRequestScope
) {
  const identity = JSON.stringify(scope.cacheKey);
  const [selection, setSelection] = useState({ identity, formId: '' });
  const selectedId = selection.identity === identity ? selection.formId : '';
  const [pin, setPin] = useState<ApprovalWorkflowFormSourcePin | null>(null);
  const [blocked, setBlocked] = useState(false);
  const [sourceChanged, setSourceChanged] = useState(false);
  const forms = useQuery({
    queryKey: ['approvals', 'admin', 'workflow-condition-forms', ...scope.cacheKey],
    queryFn: ({ signal }) => getApprovalForms(scope.contextScopeKey, signal),
    enabled,
    retry: retryApprovalManagementRead,
    staleTime: 30_000,
  });
  const source = useQuery({
    queryKey: ['approvals', 'admin', 'workflow-condition-form', selectedId, ...scope.cacheKey],
    queryFn: async ({ signal }) =>
      captureApprovalWorkflowFormSource(
        await getApprovalForm(selectedId, scope.contextScopeKey, signal)
      ),
    enabled: enabled && Boolean(selectedId),
    retry: retryApprovalManagementRead,
    staleTime: 30_000,
  });
  const formsReady = approvalManagementSourceState(forms) === 'READY' && !forms.isFetching;
  const sourceReady = approvalManagementSourceState(source) === 'READY' && !source.isFetching;
  const listed = forms.data?.some(
    (form) =>
      form.formId === selectedId &&
      form.lifecycleState === 'PUBLISHED' &&
      form.version === source.data?.pin.version &&
      form.currentVersion === source.data?.pin.currentVersion
  );
  const available =
    enabled &&
    !blocked &&
    formsReady &&
    sourceReady &&
    Boolean(listed) &&
    approvalWorkflowFormPinsMatch(pin, source.data?.pin ?? null);
  const latest = useRef({ identity, available, pin });
  latest.current = { identity, available, pin };

  useEffect(() => {
    setPin(null);
    setBlocked(false);
    setSourceChanged(false);
  }, [identity]);
  useEffect(() => {
    if (!blocked && !pin && selectedId && formsReady && sourceReady && listed && source.data)
      setPin(source.data.pin);
  }, [blocked, formsReady, listed, pin, selectedId, source.data, sourceReady]);

  const isCurrent = (captured: ApprovalWorkflowFormSourcePin | null) =>
    latest.current.identity === identity &&
    latest.current.available &&
    approvalWorkflowFormPinsMatch(latest.current.pin, captured);
  const verify = async (captured: ApprovalWorkflowFormSourcePin | null) => {
    if (!captured || !isCurrent(captured)) throw new Error('Form source unavailable');
    let changed = false;
    try {
      const [visible, detail] = await Promise.all([
        getApprovalForms(scope.contextScopeKey),
        getApprovalForm(captured.formId, scope.contextScopeKey),
      ]);
      const fresh = await captureApprovalWorkflowFormSource(detail);
      const listedForm = visible.find((form) => form.formId === captured.formId);
      changed =
        !approvalWorkflowFormPinsMatch(captured, fresh.pin) ||
        Boolean(
          listedForm &&
          (listedForm.version !== captured.version ||
            listedForm.currentVersion !== captured.currentVersion)
        );
      if (
        !visible.some(
          (form) =>
            form.formId === captured.formId &&
            form.lifecycleState === 'PUBLISHED' &&
            form.version === captured.version &&
            form.currentVersion === captured.currentVersion
        ) ||
        !approvalWorkflowFormPinsMatch(captured, fresh.pin) ||
        !isCurrent(captured)
      )
        throw new Error('Form source changed');
      return fresh.compiled;
    } catch (error) {
      if (latest.current.identity === identity) {
        latest.current.available = false;
        setBlocked(true);
        setSourceChanged(changed);
      }
      throw error;
    }
  };
  return {
    selectedId,
    pin,
    available,
    compiled: available ? source.data?.compiled : undefined,
    changed:
      sourceChanged ||
      Boolean(pin && source.data && !approvalWorkflowFormPinsMatch(pin, source.data.pin)),
    forms: forms.data?.filter((form) => form.lifecycleState === 'PUBLISHED') ?? [],
    busy: forms.isFetching || source.isFetching,
    select: (formId: string) => {
      setPin(null);
      setBlocked(false);
      setSourceChanged(false);
      setSelection({ identity, formId });
    },
    reload: async () => {
      const list = await forms.refetch();
      const value = await source.refetch();
      if (latest.current.identity !== identity || list.isError || value.isError || !value.data)
        return;
      if (
        list.data?.some(
          (form) =>
            form.formId === selectedId &&
            form.lifecycleState === 'PUBLISHED' &&
            form.version === value.data.pin.version &&
            form.currentVersion === value.data.pin.currentVersion
        )
      ) {
        setPin(value.data.pin);
        setBlocked(false);
        setSourceChanged(false);
      }
    },
    isCurrent,
    verify,
  };
}

export type ApprovalWorkflowConditionSource = ReturnType<typeof useApprovalWorkflowConditionSource>;

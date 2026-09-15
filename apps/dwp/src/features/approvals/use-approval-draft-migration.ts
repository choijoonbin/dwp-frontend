import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  getApprovalRequestDetail,
  getPublishedApprovalForms,
  getPublishedApprovalFormTemplate,
  HttpError,
  HttpTransportError,
  useToast,
} from '@dwp-frontend/shared-utils';
import {
  approvalDraftMigrationPreviewFingerprint,
  getApprovalDraftMigrationPreview,
  migrateApprovalDraft,
} from '@dwp-frontend/shared-utils/api/approval-draft-migration-api';

import { useApprovalManagementCommandScope } from './approval-management-command-scope';
import {
  isProductSurfaceOperationCancelledError,
  useApprovalGovernedMutation,
} from './use-approval-governed-mutation';

import type {
  ApprovalDraftMigrationInput,
  ApprovalDraftMigrationPreview,
} from '@dwp-frontend/shared-utils/api/approval-draft-migration-api';
import type {
  ApprovalRequest,
  ApprovalRequestDetail,
  ApprovalRequestTemplate,
} from '@dwp-frontend/shared-utils';
import type { ApprovalManagementScopedCommand } from './approval-management-command-scope';

export type ApprovalDraftMigrationProblem =
  'CONFLICT' | 'DENIED' | 'INCOMPATIBLE' | 'UNAVAILABLE' | 'UNKNOWN' | 'ERROR';

type MigrationCandidate = Readonly<{
  sourceRequestId: string;
  sourceVersion: number;
  sourceTitle: string;
}>;

type MigrationCommandInput = Readonly<{
  candidate: MigrationCandidate;
  contextScopeKey?: string;
  targetFormId: string;
  targetWorkflowId: string;
  previewFingerprint: string;
  body: ApprovalDraftMigrationInput;
  idempotencyKey: string;
}>;

type MigrationCommand = ApprovalManagementScopedCommand<MigrationCommandInput>;

function sameSource(
  request: ApprovalRequest | undefined,
  detail: ApprovalRequestDetail | undefined,
  candidate: MigrationCandidate
) {
  return Boolean(
    request?.requestId === candidate.sourceRequestId &&
    request.version === candidate.sourceVersion &&
    request.status === 'DRAFT' &&
    detail?.request.requestId === candidate.sourceRequestId &&
    detail.request.version === candidate.sourceVersion &&
    detail.request.status === 'DRAFT'
  );
}

function previewInput(preview: ApprovalDraftMigrationPreview, reason: string) {
  return Object.freeze({
    expectedVersion: preview.sourceVersion,
    targetFormId: preview.target.formId,
    targetFormVersionId: preview.target.formVersionId,
    targetFormSchemaSha256: preview.target.formSchemaSha256,
    targetWorkflowId: preview.target.workflowId,
    targetWorkflowVersionId: preview.target.workflowVersionId,
    targetWorkflowDefinitionSha256: preview.target.workflowDefinitionSha256,
    reason: reason.trim(),
  });
}

function sameTemplate(template: ApprovalRequestTemplate, command: MigrationCommandInput) {
  return (
    template.form.form.formId === command.targetFormId &&
    template.form.formVersionId === command.body.targetFormVersionId &&
    template.form.schemaHash === command.body.targetFormSchemaSha256 &&
    template.workflow.workflowId === command.targetWorkflowId
  );
}

function classify(error: unknown): ApprovalDraftMigrationProblem {
  if (error instanceof HttpError) {
    if ([401, 403, 404].includes(error.status)) return 'DENIED';
    if (error.status === 409) return 'CONFLICT';
    if (error.status === 422) return 'INCOMPATIBLE';
    if (error.status === 503) return 'UNAVAILABLE';
  }
  if (error instanceof HttpTransportError) return 'UNKNOWN';
  return 'ERROR';
}

export function useApprovalDraftMigration({
  cacheKey,
  contextScopeKey,
  ready,
  request,
  detail,
  onCreated,
}: {
  cacheKey: readonly string[];
  contextScopeKey?: string;
  ready: boolean;
  request?: ApprovalRequest;
  detail?: ApprovalRequestDetail;
  onCreated: (draftId: string) => void;
}) {
  const { t } = useTranslation('approvals');
  const toast = useToast();
  const queryClient = useQueryClient();
  const scope = useApprovalManagementCommandScope(cacheKey);
  const runMigrate = useApprovalGovernedMutation(
    'route.approvals.work.request-draft-migrate.action'
  );
  const mounted = useRef(true);
  const active = useRef<MigrationCommand | undefined>(undefined);
  const [candidate, setCandidate] = useState<MigrationCandidate>();
  const [targetFormId, setTargetFormId] = useState('');
  const [reason, setReason] = useState('');
  const [problem, setProblem] = useState<ApprovalDraftMigrationProblem>();

  const forms = useQuery({
    queryKey: ['approvals', ...cacheKey, 'draft-migration', 'forms'],
    queryFn: ({ signal }) => getPublishedApprovalForms(contextScopeKey, signal),
    enabled: ready && Boolean(candidate),
    retry: false,
    staleTime: 0,
  });
  const template = useQuery({
    queryKey: ['approvals', ...cacheKey, 'draft-migration', 'template', targetFormId],
    queryFn: ({ signal }) =>
      getPublishedApprovalFormTemplate(targetFormId, contextScopeKey, signal),
    enabled: ready && Boolean(candidate) && Boolean(targetFormId),
    retry: false,
    staleTime: 0,
  });
  const targetWorkflowId = template.data?.workflow.workflowId ?? '';
  const preview = useQuery({
    queryKey: [
      'approvals',
      ...cacheKey,
      'draft-migration',
      candidate?.sourceRequestId,
      candidate?.sourceVersion,
      targetFormId,
      targetWorkflowId,
    ],
    queryFn: ({ signal }) =>
      getApprovalDraftMigrationPreview(candidate!.sourceRequestId, targetFormId, targetWorkflowId, {
        contextScopeKey,
        signal,
      }),
    enabled:
      ready &&
      Boolean(candidate) &&
      Boolean(targetFormId) &&
      Boolean(targetWorkflowId) &&
      !template.isFetching &&
      !template.isError,
    retry: false,
    staleTime: 0,
  });
  const visiblePreview =
    candidate &&
    !preview.isFetching &&
    !preview.isError &&
    preview.data?.sourceRequestId === candidate.sourceRequestId &&
    preview.data.sourceVersion === candidate.sourceVersion &&
    preview.data.target.formId === targetFormId &&
    preview.data.target.workflowId === targetWorkflowId
      ? preview.data
      : undefined;
  const latest = useRef({
    ready,
    contextScopeKey,
    request,
    detail,
    candidate,
    targetFormId,
    targetWorkflowId,
    visiblePreview,
  });
  latest.current = {
    ready,
    contextScopeKey,
    request,
    detail,
    candidate,
    targetFormId,
    targetWorkflowId,
    visiblePreview,
  };

  const current = (command: MigrationCommand) => {
    const state = latest.current;
    return (
      mounted.current &&
      scope.isCurrent(command) &&
      state.ready &&
      state.contextScopeKey === command.input.contextScopeKey &&
      state.candidate?.sourceRequestId === command.input.candidate.sourceRequestId &&
      state.candidate.sourceVersion === command.input.candidate.sourceVersion &&
      state.targetFormId === command.input.targetFormId &&
      state.targetWorkflowId === command.input.targetWorkflowId &&
      sameSource(state.request, state.detail, command.input.candidate) &&
      Boolean(
        state.visiblePreview &&
        approvalDraftMigrationPreviewFingerprint(state.visiblePreview) ===
          command.input.previewFingerprint
      )
    );
  };
  const assertCurrent = (command: MigrationCommand) => {
    if (!current(command)) throw new HttpError('Approval draft migration context changed.', 409);
  };

  const mutation = useMutation({
    retry: false,
    mutationFn: async (command: MigrationCommand) => {
      assertCurrent(command);
      const source = await getApprovalRequestDetail(
        command.input.candidate.sourceRequestId,
        command.input.contextScopeKey
      );
      assertCurrent(command);
      if (!sameSource(source.request, source, command.input.candidate)) {
        throw new HttpError('Approval draft changed before migration.', 409);
      }
      const freshTemplate = await getPublishedApprovalFormTemplate(
        command.input.targetFormId,
        command.input.contextScopeKey
      );
      assertCurrent(command);
      if (!sameTemplate(freshTemplate, command.input)) {
        throw new HttpError('Approval migration target changed.', 409);
      }
      const freshPreview = await getApprovalDraftMigrationPreview(
        command.input.candidate.sourceRequestId,
        command.input.targetFormId,
        command.input.targetWorkflowId,
        {
          contextScopeKey: command.input.contextScopeKey,
          beforeDispatch: () => assertCurrent(command),
        }
      );
      assertCurrent(command);
      if (
        approvalDraftMigrationPreviewFingerprint(freshPreview) !== command.input.previewFingerprint
      ) {
        throw new HttpError('Approval migration preview changed.', 409);
      }
      return runMigrate((execution) =>
        migrateApprovalDraft(
          command.input.candidate.sourceRequestId,
          command.input.body,
          execution,
          {
            idempotencyKey: command.input.idempotencyKey,
            beforeDispatch: () => assertCurrent(command),
          }
        )
      );
    },
    onSuccess: async (result, command) => {
      if (!current(command)) return;
      active.current = undefined;
      await queryClient.invalidateQueries({ queryKey: ['approvals'] });
      if (!mounted.current || !scope.isCurrent(command)) return;
      toast.success(t('requests.drafts.migrationCreated'));
      setCandidate(undefined);
      onCreated(result.draft.requestId);
    },
    onError: (error, command) => {
      if (!mounted.current || !scope.isCurrent(command)) return;
      if (isProductSurfaceOperationCancelledError(error)) {
        active.current = undefined;
        return;
      }
      const next = classify(error);
      setProblem(next);
      if (!['UNAVAILABLE', 'UNKNOWN'].includes(next)) active.current = undefined;
    },
  });

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  useEffect(() => {
    active.current = undefined;
    setCandidate(undefined);
    setTargetFormId('');
    setReason('');
    setProblem(undefined);
  }, [scope.binding.scopeEpoch, scope.binding.scopeIdentity]);

  const execute = (command: MigrationCommand) => {
    if (mutation.isPending || active.current !== command) return;
    setProblem(undefined);
    mutation.mutate(command);
  };
  const submit = () => {
    if (
      !candidate ||
      !visiblePreview ||
      !reason.trim() ||
      !visiblePreview.migrationRequired ||
      !visiblePreview.routeCompatible ||
      mutation.isPending ||
      active.current ||
      !sameSource(request, detail, candidate)
    ) {
      return;
    }
    const command = scope.capture(
      Object.freeze({
        candidate,
        ...(contextScopeKey ? { contextScopeKey } : {}),
        targetFormId,
        targetWorkflowId,
        previewFingerprint: approvalDraftMigrationPreviewFingerprint(visiblePreview),
        body: previewInput(visiblePreview, reason),
        idempotencyKey: crypto.randomUUID(),
      })
    );
    active.current = command;
    execute(command);
  };

  return {
    candidate,
    targetFormId,
    reason,
    problem,
    forms,
    template,
    preview,
    visiblePreview,
    sourceCurrent: Boolean(candidate && sameSource(request, detail, candidate)),
    pending: mutation.isPending,
    locked: mutation.isPending || Boolean(active.current),
    open: () => {
      if (
        !ready ||
        !request ||
        !detail ||
        !sameSource(request, detail, {
          sourceRequestId: request.requestId,
          sourceVersion: request.version,
          sourceTitle: request.title,
        })
      )
        return;
      setCandidate(
        Object.freeze({
          sourceRequestId: request.requestId,
          sourceVersion: request.version,
          sourceTitle: request.title,
        })
      );
      setTargetFormId('');
      setReason('');
      setProblem(undefined);
    },
    close: () => {
      if (mutation.isPending || active.current) return;
      setCandidate(undefined);
      setTargetFormId('');
      setReason('');
      setProblem(undefined);
    },
    setTargetFormId: (value: string) => {
      if (mutation.isPending || active.current) return;
      setTargetFormId(value);
      setProblem(undefined);
    },
    setReason: (value: string) => {
      if (mutation.isPending || active.current) return;
      setReason(value);
      setProblem(undefined);
    },
    submit,
    retryOriginal: () => {
      const command = active.current;
      if (!command || mutation.isPending || !['UNAVAILABLE', 'UNKNOWN'].includes(problem ?? '')) {
        return;
      }
      execute(command);
    },
    refresh: async () => {
      if (mutation.isPending || active.current) return;
      setProblem(undefined);
      await Promise.all([forms.refetch(), template.refetch(), preview.refetch()]);
    },
  } as const;
}

export type ApprovalDraftMigrationController = ReturnType<typeof useApprovalDraftMigration>;

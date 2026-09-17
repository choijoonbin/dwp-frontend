import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { RotateCcw, ShieldCheck } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import {
  createWorkplaceIdempotencyKey,
  getWorkplaceAuthorizedBookingBeneficiaries,
  getWorkplaceExplore,
  resolveIdempotentMutationIntent,
  useAuth,
} from '@dwp-frontend/shared-utils';
import {
  confirmWorkplaceAssistantRequest,
  createWorkplaceAssistantRequest,
  getWorkplaceAssistantExecution,
  getWorkplaceAssistantRequest,
  submitWorkplaceAssistantFeedback,
  validateWorkplaceAssistantRequest,
} from '@dwp-frontend/shared-utils/api/workplace-assistant-api';
import {
  ActionButton,
  InlineFeedback,
  LoadingState,
  PageCanvas,
} from '@dwp-frontend/design-system';
import Stack from '@mui/material/Stack';

import { RoomsPageHeading } from './rooms-ui';
import { useRoomsCapabilities } from './rooms-capabilities';
import { useWorkplaceAssistantCopy } from './workplace-assistant-copy';
import { useWorkplaceAssistantOnlineState } from './workplace-assistant-online';
import { WorkplaceAssistantRequestForm } from './workplace-assistant-request-form';
import { WorkplaceAssistantReview } from './workplace-assistant-review';

import type { IdempotentMutationIntent } from '@dwp-frontend/shared-utils';
import type {
  WorkplaceAssistantCommandReceipt,
  WorkplaceAssistantConfirmInput,
  WorkplaceAssistantCreateInput,
  WorkplaceAssistantFeedbackInput,
  WorkplaceAssistantFeedbackReceipt,
  WorkplaceAssistantRequest,
  WorkplaceAssistantValidateInput,
} from '@dwp-frontend/shared-utils/api/workplace-assistant-contract';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

export function WorkplaceAssistantUser() {
  const copy = useWorkplaceAssistantCopy();
  const auth = useAuth();
  const capabilities = useRoomsCapabilities();
  const online = useWorkplaceAssistantOnlineState();
  const [params, setParams] = useSearchParams();
  const requestedId = params.get('request');
  const validRequestedId = Boolean(requestedId && UUID.test(requestedId));
  const [activeRequest, setActiveRequest] = useState<WorkplaceAssistantRequest | null>(null);
  const [draftEpoch, setDraftEpoch] = useState(0);
  const [selectedIds, setSelectedIds] = useState<ReadonlySet<string>>(new Set());
  const [pendingCanonicalRequestId, setPendingCanonicalRequestId] = useState<string | null>(null);
  const [lastReceipt, setLastReceipt] = useState<WorkplaceAssistantCommandReceipt | null>(null);
  const [feedbackReceipt, setFeedbackReceipt] = useState<WorkplaceAssistantFeedbackReceipt | null>(
    null
  );
  const intentRef = useRef<IdempotentMutationIntent | null>(null);
  const range = useMemo(() => {
    const from = new Date();
    const to = new Date(from);
    to.setDate(to.getDate() + 60);
    return { from: from.toISOString(), to: to.toISOString() };
  }, []);
  const exploreQuery = useQuery({
    queryKey: ['workplace', 'assistant', 'resource-scope', range.from, range.to],
    queryFn: () => getWorkplaceExplore(range.from, range.to),
    enabled: capabilities.isLoaded && capabilities.canViewWorkplace,
    retry: false,
    staleTime: 60_000,
  });
  const beneficiariesQuery = useQuery({
    queryKey: ['workplace', 'assistant', 'beneficiaries', auth.user?.tenantId, auth.user?.userId],
    queryFn: getWorkplaceAuthorizedBookingBeneficiaries,
    enabled: capabilities.isLoaded && capabilities.canViewWorkplace,
    retry: false,
    staleTime: 30_000,
  });
  const authorizedBeneficiaries = useMemo(
    () =>
      (beneficiariesQuery.data?.beneficiaries ?? []).filter(
        (beneficiary) =>
          beneficiary.self ||
          beneficiary.validUntil === null ||
          Date.parse(beneficiary.validUntil) > Date.now()
      ),
    [beneficiariesQuery.data?.beneficiaries]
  );
  const beneficiaryErrorStatus = (beneficiariesQuery.error as { status?: number } | null)?.status;
  const beneficiarySourceState = !capabilities.isLoaded
    ? 'LOADING'
    : !capabilities.canViewWorkplace
      ? 'DENIED'
      : beneficiariesQuery.isLoading
        ? 'LOADING'
        : beneficiariesQuery.isError
          ? beneficiaryErrorStatus === 403
            ? 'DENIED'
            : 'UNAVAILABLE'
          : !beneficiariesQuery.data || authorizedBeneficiaries.length === 0
            ? 'UNAVAILABLE'
            : Date.now() - Date.parse(beneficiariesQuery.data.generatedAt) > 5 * 60_000
              ? 'STALE'
              : 'READY';
  const requestQuery = useQuery({
    queryKey: ['workplace', 'assistant', 'request', requestedId],
    queryFn: () => getWorkplaceAssistantRequest(requestedId!),
    enabled: validRequestedId && capabilities.canViewWorkplace,
    retry: false,
  });
  useEffect(() => {
    if (requestQuery.data) setActiveRequest(requestQuery.data);
  }, [requestQuery.data]);
  useEffect(() => {
    if (pendingCanonicalRequestId && pendingCanonicalRequestId === requestedId) {
      setPendingCanonicalRequestId(null);
    }
  }, [pendingCanonicalRequestId, requestedId]);
  useEffect(() => {
    if (!activeRequest) return;
    setSelectedIds(new Set(activeRequest.proposals.map(({ proposalItemId }) => proposalItemId)));
  }, [activeRequest]);

  const executionQuery = useQuery({
    queryKey: ['workplace', 'assistant', 'execution', activeRequest?.requestId],
    queryFn: () => getWorkplaceAssistantExecution(activeRequest!.requestId),
    enabled: Boolean(activeRequest?.bookingBatchId),
    retry: false,
    refetchInterval: activeRequest?.state === 'PROCESSING' && online ? 3_000 : false,
  });
  const commandIntent = (kind: string, fingerprint: unknown) => {
    const next = resolveIdempotentMutationIntent(intentRef.current, { kind, fingerprint }, () =>
      createWorkplaceIdempotencyKey(`assistant-${kind}`)
    );
    intentRef.current = next;
    return next;
  };
  const acceptResult = (result: {
    request: WorkplaceAssistantRequest;
    receipt: WorkplaceAssistantCommandReceipt;
  }) => {
    intentRef.current = null;
    if (result.request.requestId !== requestedId) {
      setPendingCanonicalRequestId(result.request.requestId);
      const next = new URLSearchParams(params);
      next.set('request', result.request.requestId);
      setParams(next, { replace: true });
    }
    setActiveRequest(result.request);
    setLastReceipt(result.receipt);
  };
  const createMutation = useMutation({
    mutationFn: (input: WorkplaceAssistantCreateInput) => {
      const intent = commandIntent('create', input);
      return createWorkplaceAssistantRequest(input, {
        idempotencyKey: intent.key,
        correlationId: crypto.randomUUID(),
      });
    },
    onSuccess: acceptResult,
  });
  const validateMutation = useMutation({
    mutationFn: (input: WorkplaceAssistantValidateInput) => {
      if (!activeRequest || activeRequest.state === 'RESULT_UNKNOWN') {
        throw new Error('ASSISTANT_VALIDATE_BLOCKED');
      }
      const intent = commandIntent('validate', input);
      return validateWorkplaceAssistantRequest(activeRequest.requestId, input, {
        idempotencyKey: intent.key,
        correlationId: crypto.randomUUID(),
      });
    },
    onSuccess: acceptResult,
  });
  const confirmMutation = useMutation({
    mutationFn: (input: WorkplaceAssistantConfirmInput) => {
      if (!activeRequest || activeRequest.state === 'RESULT_UNKNOWN') {
        throw new Error('ASSISTANT_CONFIRM_BLOCKED');
      }
      const intent = commandIntent('confirm', input);
      return confirmWorkplaceAssistantRequest(activeRequest.requestId, input, {
        idempotencyKey: intent.key,
        correlationId: crypto.randomUUID(),
      });
    },
    onSuccess: acceptResult,
  });
  const feedbackMutation = useMutation({
    mutationFn: (input: WorkplaceAssistantFeedbackInput) => {
      if (!activeRequest || activeRequest.state === 'RESULT_UNKNOWN') {
        throw new Error('ASSISTANT_FEEDBACK_BLOCKED');
      }
      const intent = commandIntent('feedback', input);
      return submitWorkplaceAssistantFeedback(activeRequest.requestId, input, {
        idempotencyKey: intent.key,
        correlationId: crypto.randomUUID(),
      });
    },
    onSuccess: (result) => {
      intentRef.current = null;
      setFeedbackReceipt(result);
      setLastReceipt(null);
    },
  });
  const recheck = async () => {
    if (!activeRequest) return;
    const requestResult = await getWorkplaceAssistantRequest(activeRequest.requestId);
    setActiveRequest(requestResult);
    if (activeRequest.bookingBatchId) await executionQuery.refetch();
    setLastReceipt(null);
  };
  const refreshRequest = async () => {
    if (!activeRequest) return;
    setActiveRequest(await getWorkplaceAssistantRequest(activeRequest.requestId));
    setLastReceipt(null);
  };
  const resetConversation = () => {
    const next = new URLSearchParams(params);
    next.delete('request');
    setParams(next, { replace: true });
    setActiveRequest(null);
    setSelectedIds(new Set());
    setPendingCanonicalRequestId(null);
    setLastReceipt(null);
    setFeedbackReceipt(null);
    setDraftEpoch((current) => current + 1);
    intentRef.current = null;
    createMutation.reset();
    validateMutation.reset();
    confirmMutation.reset();
    feedbackMutation.reset();
  };
  const commandPending =
    createMutation.isPending ||
    validateMutation.isPending ||
    confirmMutation.isPending ||
    feedbackMutation.isPending ||
    requestQuery.isFetching ||
    executionQuery.isFetching;
  const commandError =
    createMutation.isError ||
    validateMutation.isError ||
    confirmMutation.isError ||
    feedbackMutation.isError ||
    executionQuery.isError;
  const canUpdate = capabilities.canUpdateWorkplaceBooking && online;

  const canonicalRequestPending = Boolean(
    pendingCanonicalRequestId && pendingCanonicalRequestId !== requestedId
  );

  if (
    !capabilities.isLoaded ||
    canonicalRequestPending ||
    (validRequestedId && requestQuery.isLoading)
  ) {
    return <LoadingState label={copy.loading} />;
  }

  return (
    <PageCanvas topInset="compact" data-testid="workplace-assistant-user">
      <RoomsPageHeading
        eyebrow={copy.userEyebrow}
        title={copy.userTitle}
        description={copy.userDescription}
        actions={
          <ActionButton
            intent="secondary"
            size="small"
            startIcon={<RotateCcw size={16} />}
            disabled={commandPending}
            onClick={resetConversation}
          >
            {copy.resetConversation}
          </ActionButton>
        }
      />
      <Stack spacing={2}>
        <InlineFeedback severity="info" icon={<ShieldCheck size={18} />}>
          <strong>{copy.privacyTitle}</strong> {copy.privacyNotice}
        </InlineFeedback>
        {!online && <InlineFeedback severity="warning">{copy.offline}</InlineFeedback>}
        {!capabilities.canUpdateWorkplaceBooking && (
          <InlineFeedback severity="warning">{copy.readOnly}</InlineFeedback>
        )}
        {((requestedId && !validRequestedId) || requestQuery.isError) && (
          <InlineFeedback severity="error">{copy.loadError}</InlineFeedback>
        )}
        {commandError && <InlineFeedback severity="error">{copy.commandError}</InlineFeedback>}
        {!activeRequest ? (
          <WorkplaceAssistantRequestForm
            key={draftEpoch}
            beneficiaries={authorizedBeneficiaries}
            beneficiarySourceState={beneficiarySourceState}
            onRetryBeneficiaries={() => void beneficiariesQuery.refetch()}
            sites={exploreQuery.data?.sites ?? []}
            floors={exploreQuery.data?.floors ?? []}
            disabled={!canUpdate}
            loading={createMutation.isPending}
            onSubmit={(input) => createMutation.mutate(input)}
          />
        ) : (
          <WorkplaceAssistantReview
            request={activeRequest}
            execution={executionQuery.data ?? null}
            selectedIds={selectedIds}
            canUpdate={canUpdate}
            online={online}
            loading={commandPending}
            lastReceipt={lastReceipt}
            feedbackReceipt={feedbackReceipt}
            onSelectionChange={setSelectedIds}
            onValidate={(input) => validateMutation.mutate(input)}
            onConfirm={(input) => confirmMutation.mutate(input)}
            onFeedback={(input) => feedbackMutation.mutate(input)}
            onRecheck={() => void recheck()}
            onRefresh={() => void refreshRequest()}
          />
        )}
      </Stack>
    </PageCanvas>
  );
}

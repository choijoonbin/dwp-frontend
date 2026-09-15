import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { resolveSupportedLocale } from '@dwp-frontend/shared-i18n';
import { ActionButton, FormDialog, InlineFeedback } from '@dwp-frontend/design-system';
import {
  getApprovalRequestDetail,
  HttpError,
  usePermissions,
  useToast,
} from '@dwp-frontend/shared-utils';

import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useTheme } from '@mui/material/styles';

import { ApprovalInformationResponseFields } from './approval-information-response-fields';
import { ApprovalRequestDetailDrawer } from './approval-request-detail-drawer';
import { ApprovalRequestArchiveExport } from './approval-request-archive-export';
import { ApprovalRequestInformationReceipt } from './approval-request-information-receipt';
import { ApprovalResubmitDraftDialog } from './approval-resubmit-draft-dialog';
import { useApprovalAttachmentClient } from './use-approval-attachment-client';
import { ApprovalAttachmentNavigationGuard } from './approval-attachment-navigation-guard';
import { ApprovalRequestSearchControls } from './approval-request-search-controls';
import { useApprovalRequestSearch } from './use-approval-request-search';
import {
  approvalRequestRecovery,
  isApprovalRequestSnapshotCurrent,
} from './approval-request-model';
import { useApprovalManagementCommandScope } from './approval-management-command-scope';
import { useApprovalRequestAmendment } from './use-approval-request-amendment';
import { useApprovalRequestInformationSource } from './use-approval-request-information-source';
import { useApprovalRequestLifecycleAction } from './use-approval-request-lifecycle-action';
import { useApprovalResubmitDraft } from './use-approval-resubmit-draft';
import { sameApprovalRequestInformationSnapshot } from './approval-request-information-snapshot';
import { approvalRequestCommandResultUnknown } from './approval-request-command-model';
import { useApprovalRequestUserSource } from './use-approval-request-user-source';
import { authorizedApprovalWorkReturnTarget } from './approval-return-target';
import { ApprovalSurface } from './approval-ui';
import { useProductSurfaceRequestScope } from '../../components/use-product-surface-request-scope';
import { useApprovalExperience } from './use-approval-experience';
import { isProductSurfaceOperationCancelledError } from './use-approval-governed-mutation';
import { approvalRequestBelongsToView } from './approval-request-lifecycle-deep-link';
import { latestApprovalInformationRequestEvent } from './approval-request-information-context';
import {
  ApprovalRequestActionFeedback,
  ApprovalRequestDeepLinkProblem,
  ApprovalRequestInformationContext,
  ApprovalRequestInformationDetailStatus,
  ApprovalRequestInformationPrompt,
  ApprovalRequestLifecycleCollection,
  ApprovalRequestUnknownResponseNotice,
} from './approval-request-lifecycle-presentation';

import type { ApprovalRequest, ApprovalRequestDetail } from '@dwp-frontend/shared-utils';
import type { ApprovalRequestRecovery, ApprovalRequestView } from './approval-request-model';
import type { ApprovalRequestUserContext } from './approval-request-user-picker';
import type { ApprovalRequestInformationSnapshot } from './approval-request-information-snapshot';
import type { RequestAction, RequestActionCommand } from './approval-request-action-model';

export function ApprovalRequestLifecycle({ view }: { view: ApprovalRequestView }) {
  const { t, i18n } = useTranslation('approvals');
  const korean = resolveSupportedLocale(i18n.resolvedLanguage, i18n.language) === 'ko';
  const theme = useTheme();
  const mobile = useMediaQuery(theme.breakpoints.down('lg'));
  const toast = useToast();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedId = searchParams.get('request')?.trim() || null;
  const requestedReturnTarget = searchParams.get('returnTo');
  const { permissions } = usePermissions();
  const returnTarget = authorizedApprovalWorkReturnTarget(requestedReturnTarget, permissions);
  const { canCreateRequests, canUpdateRequests } = useApprovalExperience();
  const queryClient = useQueryClient();
  const requestScope = useProductSurfaceRequestScope({
    productKey: 'approvals',
    surfaceKey: 'approvals.work',
  });
  const commandScope = useApprovalManagementCommandScope(requestScope.cacheKey);
  const identityKey = commandScope.binding.scopeIdentity;

  const openedRequestRef = useRef<string | undefined>(undefined);
  const [selectedId, setSelectedId] = useState<string | undefined>(requestedId ?? undefined);
  const [detailId, setDetailId] = useState<string | undefined>(undefined);
  const [archiveBlocked, setArchiveBlocked] = useState(false);
  const archiveGuard = useRef<() => boolean>(() => false);
  const [requestAction, setRequestAction] = useState<RequestAction | undefined>(undefined);
  const actionBinding = useRef<typeof commandScope.binding | undefined>(undefined);
  const actionIsOwned = Boolean(
    actionBinding.current && commandScope.isCurrent(actionBinding.current)
  );
  const [actionOpen, setActionOpen] = useState(false);
  const [informationBlocked, setInformationBlocked] = useState(false);
  const [userProofGeneration, setUserProofGeneration] = useState(0);
  const [actionRecovery, setActionRecovery] = useState<
    ApprovalRequestRecovery | 'UNKNOWN' | undefined
  >(undefined);
  const unresolvedResponse = useRef<RequestActionCommand | undefined>(undefined);
  const unknownResponse = useRef<RequestActionCommand | undefined>(undefined);
  const [responseMessage, setResponseMessage] = useState('');

  const search = useApprovalRequestSearch(view, requestScope);
  const requests = search.requests;
  const deepLinkQueryKey = [
    'approvals',
    ...requestScope.cacheKey,
    'requests',
    'lifecycle-deep-link',
    requestedId,
  ];
  const requestedDetail = useQuery({
    queryKey: deepLinkQueryKey,
    queryFn: ({ signal }) =>
      getApprovalRequestDetail(requestedId!, requestScope.contextScopeKey, signal),
    enabled: requestScope.ready && Boolean(requestedId),
    meta: requestScope.queryMeta,
    staleTime: 0,
    retry: false,
  });
  const requestedRequest =
    requestedId &&
    !requestedDetail.isFetching &&
    !requestedDetail.isError &&
    requestedDetail.data?.request.requestId === requestedId &&
    approvalRequestBelongsToView(view, requestedDetail.data.request.status)
      ? requestedDetail.data.request
      : undefined;
  const requestedProblem = (() => {
    if (!requestedId || requestedDetail.isFetching || requestedRequest) return undefined;
    if (requestedDetail.isError) {
      if (requestedDetail.error instanceof HttpError && requestedDetail.error.status === 404)
        return 'NOT_FOUND' as const;
      if (
        requestedDetail.error instanceof HttpError &&
        [401, 403].includes(requestedDetail.error.status)
      )
        return 'DENIED' as const;
      return 'ERROR' as const;
    }
    if (
      requestedDetail.data?.request.requestId !== requestedId ||
      !requestedDetail.data?.request.status ||
      !approvalRequestBelongsToView(view, requestedDetail.data.request.status)
    )
      return 'WRONG_VIEW' as const;
    return 'ERROR' as const;
  })();
  const searchedRequests = useMemo(
    () => (requests.isError || requests.isFetching ? [] : (requests.data ?? [])),
    [requests.data, requests.isError, requests.isFetching]
  );
  const visibleRequests = useMemo(
    () =>
      requestedRequest &&
      !searchedRequests.some((request) => request.requestId === requestedRequest.requestId)
        ? [requestedRequest, ...searchedRequests]
        : searchedRequests,
    [requestedRequest, searchedRequests]
  );
  const selectedRequest = visibleRequests.find((request) => request.requestId === selectedId);

  useEffect(() => {
    setSelectedId(undefined);
    setDetailId(undefined);
    setRequestAction(undefined);
    setActionOpen(false);
    setInformationBlocked(false);
    setUserProofGeneration(0);
    setActionRecovery(undefined);
    setResponseMessage('');
    openedRequestRef.current = undefined;
    activeAction.current = undefined;
    unresolvedResponse.current = undefined;
    unknownResponse.current = undefined;
    actionBinding.current = undefined;
  }, [identityKey, view]);

  useEffect(() => {
    if (!requestedId) {
      openedRequestRef.current = undefined;
      return;
    }
    if (!requestedRequest || openedRequestRef.current === requestedId) return;
    openedRequestRef.current = requestedId;
    setSelectedId(requestedId);
    setDetailId(requestedId);
  }, [requestedId, requestedRequest]);

  useEffect(() => {
    if (!selectedId && !requestedId && visibleRequests[0]) {
      setSelectedId(visibleRequests[0].requestId);
    }
    if (
      selectedId &&
      selectedId !== requestedId &&
      !visibleRequests.some((request) => request.requestId === selectedId)
    ) {
      setSelectedId(visibleRequests[0]?.requestId);
    }
  }, [requestedId, selectedId, visibleRequests]);

  const informationQueryKey = [
    'approvals',
    ...requestScope.cacheKey,
    'requests',
    'information-response',
    requestAction?.request.requestId,
    requestAction?.request.version,
  ];
  const informationDetail = useQuery({
    queryKey: informationQueryKey,
    queryFn: ({ signal }) =>
      getApprovalRequestDetail(
        requestAction!.request.requestId,
        requestScope.contextScopeKey,
        signal
      ),
    enabled:
      requestScope.ready &&
      actionIsOwned &&
      requestAction?.kind === 'respond' &&
      actionRecovery !== 'DENIED',
    meta: requestScope.queryMeta,
    staleTime: 0,
    retry: false,
  });
  const reviewedInformationDetail =
    !actionIsOwned ||
    informationDetail.isError ||
    informationDetail.isFetching ||
    informationDetail.data?.request.requestId !== requestAction?.request.requestId ||
    informationDetail.data?.request.version !== requestAction?.request.version ||
    informationDetail.data?.request.status !== 'NEEDS_INFO'
      ? undefined
      : informationDetail.data;
  const informationRequestEvent = useMemo(
    () => latestApprovalInformationRequestEvent(reviewedInformationDetail),
    [reviewedInformationDetail]
  );
  const amendmentIdentity = JSON.stringify([
    commandScope.binding.scopeIdentity,
    commandScope.binding.scopeEpoch,
    view,
    requestAction?.request.requestId,
  ]);
  const informationSource = useApprovalRequestInformationSource({
    identity: amendmentIdentity,
    detail: reviewedInformationDetail,
  });
  const amendment = useApprovalRequestAmendment({
    detail: informationSource.editingDetail,
    identity: amendmentIdentity,
    enabled:
      requestScope.ready &&
      actionIsOwned &&
      requestAction?.kind === 'respond' &&
      (Boolean(informationSource.snapshot) || actionRecovery !== 'DENIED'),
  });
  const responsePayload = amendment.values;
  const responseFields = amendment.fields;
  const responseRequiredFieldsComplete = amendment.complete;
  const userBinding = useMemo<ApprovalRequestUserContext | undefined>(() => {
    const detail = informationSource.snapshot
      ? informationSource.editingDetail
      : reviewedInformationDetail;
    const hash = amendment.schemaHash;
    if (!detail?.formVersionId || !hash || detail.formSchemaSha256 !== hash) return undefined;
    return {
      formId: detail.formId,
      formVersionId: detail.formVersionId,
      schemaSha256: hash,
      surface: 'WORK',
      requestId: detail.request.requestId,
      requestVersion: detail.request.version,
    };
  }, [
    informationSource.snapshot,
    informationSource.editingDetail,
    reviewedInformationDetail,
    amendment.schemaHash,
  ]);
  const userSource = useApprovalRequestUserSource({
    identity: JSON.stringify([
      commandScope.binding,
      requestAction?.request.requestId,
      userProofGeneration,
    ]),
    binding: userBinding,
    compiled: amendment.evaluation.compiled ?? undefined,
    evaluation: amendment.evaluation.draftEvaluation,
    values: responsePayload,
  });
  const clearAmendment = amendment.clear;
  const informationDenied =
    actionRecovery === 'DENIED' ||
    [informationDetail.error, requests.error].some(
      (error) => error instanceof HttpError && [401, 403, 404].includes(error.status)
    );
  useEffect(() => {
    if (requestAction?.kind !== 'respond' || !informationDenied) return;
    setActionRecovery('DENIED');
    if (informationSource.snapshot) setInformationBlocked(true);
    if (!informationSource.snapshot) {
      setResponseMessage('');
      clearAmendment();
    }
    setDetailId(undefined);
  }, [informationDenied, requestAction?.kind, informationSource.snapshot, clearAmendment]);
  useEffect(() => {
    if (informationSource.snapshot && (informationDetail.isError || requests.isError))
      setInformationBlocked(true);
  }, [informationSource.snapshot, informationDetail.isError, requests.isError]);

  const informationAuthority = useRef({
    ready: false,
    informationQueryKey,
    searchQueryKey: search.queryKey,
    deepLinkQueryKey,
  });
  informationAuthority.current = {
    ready:
      requestScope.ready &&
      actionIsOwned &&
      canUpdateRequests &&
      !requests.isFetching &&
      !requests.isError &&
      !informationDetail.isFetching &&
      !informationDetail.isError &&
      !informationDenied &&
      !informationBlocked &&
      (amendment.evaluation.kind !== 'TYPED' ||
        !informationSource.snapshot ||
        amendment.schemaHash === informationSource.snapshot.formSchemaSha256) &&
      informationSource.matches,
    informationQueryKey,
    searchQueryKey: search.queryKey,
    deepLinkQueryKey,
  };
  const informationSnapshotIsCurrent = (snapshot: ApprovalRequestInformationSnapshot) => {
    const live = informationAuthority.current;
    if (!live.ready) return false;
    const source = queryClient.getQueryState<typeof informationDetail.data>(
      live.informationQueryKey
    );
    const list = queryClient.getQueryState<typeof search.result.data>(live.searchQueryKey);
    const linked = queryClient.getQueryState<ApprovalRequestDetail>(live.deepLinkQueryKey);
    const listOwnsSnapshot = Boolean(
      list?.status === 'success' &&
      list.fetchStatus === 'idle' &&
      list.fetchFailureCount === 0 &&
      !list.error &&
      list.data?.items.some(
        (request) =>
          request.requestId === snapshot.requestId &&
          request.version === snapshot.requestVersion &&
          request.status === 'NEEDS_INFO'
      )
    );
    const deepLinkOwnsSnapshot = Boolean(
      linked?.status === 'success' &&
      linked.fetchStatus === 'idle' &&
      linked.fetchFailureCount === 0 &&
      !linked.error &&
      linked.data?.request.requestId === snapshot.requestId &&
      linked.data.request.version === snapshot.requestVersion &&
      linked.data.request.status === 'NEEDS_INFO'
    );
    return Boolean(
      source?.status === 'success' &&
      source.fetchStatus === 'idle' &&
      source.fetchFailureCount === 0 &&
      !source.error &&
      (listOwnsSnapshot || deepLinkOwnsSnapshot) &&
      sameApprovalRequestInformationSnapshot(snapshot, source.data)
    );
  };

  const deepLinkAuthorityReady =
    !requestedId ||
    Boolean(requestedRequest && !requestedDetail.isFetching && !requestedDetail.isError);
  const requestActionsReady =
    requestScope.ready &&
    canUpdateRequests &&
    !requests.isFetching &&
    !requests.isError &&
    deepLinkAuthorityReady &&
    !actionRecovery &&
    !unresolvedResponse.current;
  const resubmitAuthorized =
    view === 'archive' &&
    requestScope.ready &&
    canCreateRequests &&
    canUpdateRequests &&
    !actionRecovery &&
    !unresolvedResponse.current;
  const resubmitReady = resubmitAuthorized && !requests.isFetching && !requests.isError;
  const resubmitAuthority = useRef(resubmitAuthorized);
  resubmitAuthority.current = resubmitAuthorized;
  const resubmit = useApprovalResubmitDraft({
    identity: JSON.stringify([identityKey, view]),
    enabled: resubmitAuthorized,
    contextScopeKey: requestScope.contextScopeKey,
    requests: requests.data,
    refetch: requests.refetch,
    isAuthorityCurrent: () => resubmitAuthority.current,
    onSuccess: async ({ draft }) => {
      await queryClient.invalidateQueries({ queryKey: ['approvals'] });
      toast.success(t('requests.resubmit.created'));
      navigate(`/approvals/requests/new?draft=${encodeURIComponent(draft.requestId)}`);
    },
  });
  const actionRequestIsCurrent = (request: ApprovalRequest) =>
    requestActionsReady && isApprovalRequestSnapshotCurrent(visibleRequests, request);
  const latestAuthority = useRef({ ready: requestActionsReady, requests: visibleRequests });
  latestAuthority.current = { ready: requestActionsReady, requests: visibleRequests };
  const activeAction = useRef<RequestActionCommand | undefined>(undefined);

  const act = useApprovalRequestLifecycleAction({
    contextScopeKey: requestScope.contextScopeKey,
    wireOwnerKey: view,
    commandScope,
    informationSnapshotIsCurrent,
    userSourceIsReady: userSource.isReady,
    latestAuthority,
    unresolvedResponse,
    onSuccess: async ({ command }) => {
      if (!commandScope.isCurrent(command)) return;
      const { action } = command.input;
      unresolvedResponse.current = undefined;
      unknownResponse.current = undefined;
      setRequestAction(undefined);
      setActionOpen(false);
      setActionRecovery(undefined);
      setResponseMessage('');
      amendment.clear();
      await queryClient.invalidateQueries({ queryKey: ['approvals'] });
      if (!commandScope.isCurrent(command)) return;
      toast.success(
        t(action.kind === 'respond' ? 'requests.informationResponded' : 'requests.withdrawn')
      );
    },
    onError: (error, command) => {
      if (!commandScope.isCurrent(command)) return;
      const unknown =
        unresolvedResponse.current === command &&
        (unknownResponse.current === command || approvalRequestCommandResultUnknown(error));
      if (!unknown && isProductSurfaceOperationCancelledError(error)) return;
      if (!unknown) {
        unresolvedResponse.current = undefined;
        unknownResponse.current = undefined;
      } else unknownResponse.current = command;
      if (command.input.informationSnapshot) setInformationBlocked(true);
      const status = error instanceof HttpError ? error.status : undefined;
      const recovery =
        unknown && ![401, 403, 404].includes(status ?? 0)
          ? 'UNKNOWN'
          : approvalRequestRecovery(status);
      setActionRecovery(recovery);
      if (recovery === 'DENIED') {
        if (!command.input.informationSnapshot) {
          setResponseMessage('');
          amendment.clear();
        }
        setDetailId(undefined);
      }
      if (!command.input.informationSnapshot) toast.error(t('requests.actionError'));
    },
    onSettled: (_, __, command) => {
      if (activeAction.current === command) activeAction.current = undefined;
    },
  });

  const attachmentOwner = useRef<ApprovalRequest | undefined>(undefined);
  const attachmentOwnerEpoch = JSON.stringify([commandScope.binding, view]);
  const attachmentOwnerBinding = useRef(attachmentOwnerEpoch);
  if (attachmentOwnerBinding.current !== attachmentOwnerEpoch) {
    attachmentOwnerBinding.current = attachmentOwnerEpoch;
    attachmentOwner.current = undefined;
  }
  const selectedAttachmentOwner =
    (!requests.isFetching && !requests.isError
      ? requests.data?.find((request) => request.requestId === (detailId ?? selectedId))
      : undefined) ?? (!attachmentOwner.current ? selectedRequest : undefined);
  if (selectedAttachmentOwner) attachmentOwner.current = selectedAttachmentOwner;
  const attachments = useApprovalAttachmentClient({
    owner: { type: 'REQUEST', id: attachmentOwner.current?.requestId ?? '' },
    version: attachmentOwner.current?.version,
    ready: requestScope.ready && !requests.isFetching && !requests.isError && !act.isPending,
    isOwnerCurrent: () => {
      const state = queryClient.getQueryState<{ items: ApprovalRequest[] }>(search.queryKey);
      const linked = queryClient.getQueryState<ApprovalRequestDetail>(deepLinkQueryKey);
      return Boolean(
        (state?.status === 'success' &&
          state.fetchStatus === 'idle' &&
          !state.error &&
          state.data?.items.some(
            (request) =>
              request.requestId === attachmentOwner.current?.requestId &&
              request.version === attachmentOwner.current?.version
          )) ||
        (linked?.status === 'success' &&
          linked.fetchStatus === 'idle' &&
          !linked.error &&
          linked.data?.request.requestId === attachmentOwner.current?.requestId &&
          linked.data?.request.version === attachmentOwner.current?.version)
      );
    },
  });
  const attachmentLocked = () =>
    attachments.controller.getSnapshot().busy || attachments.controller.unresolved;

  const selectRequest = (request: ApprovalRequest, openDetails = false) => {
    if (attachmentLocked() && request.requestId !== attachmentOwner.current?.requestId) return;
    openedRequestRef.current = request.requestId;
    setSelectedId(request.requestId);
    setSearchParams(
      (current) => {
        const next = new URLSearchParams(current);
        next.set('request', request.requestId);
        return next;
      },
      { replace: true }
    );
    if (openDetails || mobile) setDetailId(request.requestId);
  };

  const closeDetail = () => {
    setDetailId(undefined);
    if (!requestedId) return;
    setSearchParams(
      (current) => {
        const next = new URLSearchParams(current);
        next.delete('request');
        return next;
      },
      { replace: true }
    );
  };

  const openAction = (kind: RequestAction['kind'], request: ApprovalRequest) => {
    if (attachmentLocked()) return;
    if (!actionRequestIsCurrent(request) || act.isPending || activeAction.current) return;
    actionBinding.current = commandScope.binding;
    setSelectedId(request.requestId);
    setActionRecovery(undefined);
    setInformationBlocked(false);
    setRequestAction({ kind, request });
    setActionOpen(true);
  };

  const closeAction = () => {
    if (act.isPending || activeAction.current) return;
    if (unresolvedResponse.current) {
      if (unresolvedResponse.current.input.informationSnapshot) {
        setUserProofGeneration((generation) => generation + 1);
        setActionOpen(false);
      }
      return;
    }
    setRequestAction(undefined);
    setActionOpen(false);
    setActionRecovery(undefined);
    setResponseMessage('');
    amendment.clear();
  };

  const refreshActionContext = async () => {
    const binding = commandScope.binding;
    if (informationSource.snapshot) setInformationBlocked(true);
    amendment.preserve();
    try {
      const listResult = await requests.refetch();
      if (!commandScope.isCurrent(binding) || listResult.isError || !requestAction) return;
      const detailResult = await getApprovalRequestDetail(
        requestAction.request.requestId,
        requestScope.contextScopeKey
      );
      if (!commandScope.isCurrent(binding)) return;
      const current = listResult.data?.find(
        (request) => request.requestId === requestAction.request.requestId
      );
      if (
        !current ||
        detailResult.request.requestId !== current.requestId ||
        detailResult.request.version !== current.version ||
        detailResult.request.status !== current.status
      )
        return;
      const unresolved = unresolvedResponse.current;
      const originalSnapshot = unresolved?.input.informationSnapshot ?? informationSource.snapshot;
      if (originalSnapshot) {
        if (!sameApprovalRequestInformationSnapshot(originalSnapshot, detailResult)) {
          setActionRecovery(unresolved ? 'UNKNOWN' : 'CONFLICT');
          return;
        }
        // Refresh only the original round; a generic GET never proves command success.
        await queryClient.fetchQuery({
          queryKey: informationQueryKey,
          queryFn: () => detailResult,
          staleTime: 0,
        });
        if (!commandScope.isCurrent(binding)) return;
        setInformationBlocked(false);
        setUserProofGeneration((generation) => generation + 1);
        setActionRecovery(unresolved ? 'UNKNOWN' : undefined);
        return;
      }
      if (unresolved) {
        if (!commandScope.isCurrent(unresolved)) return;
        if (
          current.status !== 'NEEDS_INFO' &&
          current.version > unresolved.input.action.request.version
        ) {
          unresolvedResponse.current = undefined;
          setRequestAction(undefined);
          setActionOpen(false);
          setActionRecovery(undefined);
          setResponseMessage('');
          amendment.clear();
        } else setActionRecovery('UNKNOWN');
        return;
      }
      queryClient.setQueryData(
        [
          'approvals',
          ...requestScope.cacheKey,
          'requests',
          'information-response',
          current.requestId,
          current.version,
        ],
        detailResult
      );
      setRequestAction({ ...requestAction, request: current });
      setActionRecovery(undefined);
    } catch (error) {
      if (!commandScope.isCurrent(binding)) return;
      const status = error instanceof HttpError ? error.status : undefined;
      setActionRecovery(
        unresolvedResponse.current
          ? [401, 403, 404].includes(status ?? 0)
            ? 'DENIED'
            : 'UNKNOWN'
          : approvalRequestRecovery(status)
      );
    }
  };

  const retryOriginalResponse = () => {
    const original = unresolvedResponse.current;
    const snapshot = original?.input.informationSnapshot;
    if (
      !original ||
      !snapshot ||
      act.isPending ||
      activeAction.current ||
      !commandScope.isCurrent(original) ||
      !informationSnapshotIsCurrent(snapshot) ||
      !userSource.isReady()
    )
      return;
    activeAction.current = original;
    act.mutate(original);
  };

  const returnToWork = () => {
    if (archiveGuard.current()) return;
    const currentTarget = authorizedApprovalWorkReturnTarget(requestedReturnTarget, permissions);
    if (currentTarget) navigate(currentTarget);
  };
  const clearRequested = () => {
    openedRequestRef.current = undefined;
    setSelectedId(undefined);
    setDetailId(undefined);
    setSearchParams(
      (current) => {
        const next = new URLSearchParams(current);
        next.delete('request');
        return next;
      },
      { replace: true }
    );
  };
  return (
    <ApprovalSurface
      title={t(`requests.views.${view}.title`)}
      meta={t(`requests.views.${view}.meta`, { count: search.result.data?.totalElements ?? 0 })}
      action={
        <Stack direction="row" alignItems="center" gap={1} useFlexGap flexWrap="wrap">
          {returnTarget && (
            <ActionButton
              intent="quiet"
              size="small"
              startIcon={<ArrowLeft size={16} />}
              disabled={archiveBlocked}
              onClick={returnToWork}
            >
              {t('common:productSurface.actions.returnToWork')}
            </ActionButton>
          )}
          <Chip size="small" label={search.result.data?.totalElements ?? 0} />
          {view === 'archive' && (
            <ApprovalRequestArchiveExport
              requests={visibleRequests}
              onRefreshRequests={async () => {
                const result = await requests.refetch();
                return result.isSuccess ? result.data : undefined;
              }}
              onBlockedChange={(blocked, isBlocked) => {
                archiveGuard.current = isBlocked;
                setArchiveBlocked(blocked);
              }}
            />
          )}
        </Stack>
      }
    >
      <ApprovalRequestSearchControls
        search={search}
        view={view}
        locked={act.isPending || archiveBlocked}
        isLocked={() => archiveGuard.current()}
      />
      {requestedProblem && (
        <ApprovalRequestDeepLinkProblem
          problem={requestedProblem}
          status={requestedDetail.data?.request.status}
          retrying={requestedDetail.isFetching}
          onRetry={() => void requestedDetail.refetch()}
          onClose={clearRequested}
        />
      )}
      {!actionOpen && actionIsOwned && unresolvedResponse.current?.input.informationSnapshot && (
        <ApprovalRequestUnknownResponseNotice onResume={() => setActionOpen(true)} />
      )}
      <ApprovalRequestLifecycleCollection
        deepLinkLoading={Boolean(requestedId && requestedDetail.isFetching)}
        loading={requests.isFetching}
        error={requests.isError}
        retrying={requests.isFetching}
        filtered={search.filtered}
        requests={visibleRequests}
        selected={selectedRequest}
        actionsReady={requestActionsReady}
        pending={act.isPending}
        attachments={attachments}
        onRetry={() => void requests.refetch()}
        onSelect={(request) => selectRequest(request)}
        onOpenDetails={(request) => selectRequest(request, true)}
        onEdit={(request) => navigate(`/approvals/requests/new?draft=${request.requestId}`)}
        onRespond={(request) => openAction('respond', request)}
        onWithdraw={(request) => openAction('withdraw', request)}
        onResubmit={resubmitReady ? resubmit.open : undefined}
        resubmitPendingId={resubmit.pending ? resubmit.candidate?.requestId : undefined}
      />

      <ApprovalResubmitDraftDialog controller={resubmit} onRefresh={requests.refetch} />

      <FormDialog
        open={Boolean(requestAction) && actionOpen && actionIsOwned}
        mobileFullScreen
        title={t(`requests.dialog.${requestAction?.kind ?? 'respond'}.title`)}
        description={t(`requests.dialog.${requestAction?.kind ?? 'respond'}.description`, {
          title: informationDenied ? undefined : requestAction?.request.title,
        })}
        cancelLabel={t('actions.cancel')}
        submitLabel={t(`requests.dialog.${requestAction?.kind ?? 'respond'}.confirm`)}
        submitIntent={requestAction?.kind === 'withdraw' ? 'danger' : 'primary'}
        busy={act.isPending}
        submitDisabled={
          !requestActionsReady ||
          !requestAction ||
          !isApprovalRequestSnapshotCurrent(visibleRequests, requestAction.request) ||
          (requestAction.kind === 'respond' &&
            (responseMessage.trim().length < 4 ||
              informationDetail.isFetching ||
              informationDetail.isError ||
              !reviewedInformationDetail ||
              !informationSource.matches ||
              informationBlocked ||
              (Boolean(informationSource.snapshot) &&
                amendment.evaluation.kind === 'TYPED' &&
                amendment.schemaHash !== informationSource.snapshot?.formSchemaSha256) ||
              reviewedInformationDetail.request.version !== requestAction.request.version ||
              !responseRequiredFieldsComplete)) ||
          (requestAction?.kind === 'respond' && !userSource.ready)
        }
        onClose={closeAction}
        onSubmit={() => {
          if (
            requestAction &&
            !act.isPending &&
            !activeAction.current &&
            requestActionsReady &&
            actionRequestIsCurrent(requestAction.request) &&
            (requestAction.kind !== 'respond' ||
              (responseMessage.trim().length >= 4 &&
                amendment.complete &&
                userSource.isReady() &&
                informationSource.matches &&
                (!informationSource.snapshot ||
                  informationSnapshotIsCurrent(informationSource.snapshot)) &&
                Boolean(amendment.payload)))
          ) {
            const command = commandScope.capture(
              Object.freeze({
                action: Object.freeze({
                  kind: requestAction.kind,
                  request: Object.freeze({ ...requestAction.request }),
                }),
                responseMessage: responseMessage.trim(),
                responsePayload: structuredClone(amendment.payload ?? {}),
                schemaHash: amendment.schemaHash,
                idempotencyKey: requestAction.kind === 'respond' ? crypto.randomUUID() : undefined,
                informationSnapshot:
                  requestAction.kind === 'respond' ? informationSource.snapshot : undefined,
              })
            );
            activeAction.current = command;
            act.mutate(command);
          }
        }}
      >
        <Stack gap={2}>
          <ApprovalRequestActionFeedback
            recovery={actionRecovery}
            unresolved={Boolean(unresolvedResponse.current)}
            sourceChanged={informationSource.changed || informationBlocked}
            informationDenied={informationDenied}
            pending={act.isPending}
            detailFetching={informationDetail.isFetching}
            requestsFetching={requests.isFetching}
            onRefresh={() => void refreshActionContext()}
          />
          {unresolvedResponse.current?.input.informationSnapshot && (
            <>
              <ApprovalRequestInformationReceipt
                command={unresolvedResponse.current}
                requestScope={requestScope}
                originalWire={act.readOriginalInformationWire}
                isOriginal={(command) =>
                  commandScope.isCurrent(command) &&
                  unresolvedResponse.current === command &&
                  !act.isPending
                }
                sourceIsCurrent={() => {
                  const state = queryClient.getQueryState(search.queryKey);
                  return Boolean(
                    requestScope.ready &&
                    !requests.isError &&
                    !requests.isFetching &&
                    state?.status === 'success' &&
                    state.fetchStatus === 'idle' &&
                    state.data === search.result.data
                  );
                }}
                onConfirmed={async (command) => {
                  if (
                    !commandScope.isCurrent(command) ||
                    unresolvedResponse.current !== command ||
                    !act.clearOriginalInformationWire(command)
                  )
                    return;
                  unresolvedResponse.current = undefined;
                  unknownResponse.current = undefined;
                  setRequestAction(undefined);
                  setActionOpen(false);
                  setActionRecovery(undefined);
                  setResponseMessage('');
                  amendment.clear();
                  await queryClient.invalidateQueries({ queryKey: ['approvals'] });
                  if (commandScope.isCurrent(command))
                    toast.success(t('requests.amendment.receiptCompleted'));
                }}
              />
              <ActionButton
                type="button"
                intent="primary"
                size="small"
                disabled={
                  act.isPending ||
                  !informationSnapshotIsCurrent(
                    unresolvedResponse.current.input.informationSnapshot
                  ) ||
                  !userSource.ready
                }
                onClick={retryOriginalResponse}
              >
                {t('requests.amendment.retryOriginal')}
              </ActionButton>
            </>
          )}
          {requestAction?.kind === 'respond' && !informationDenied && (
            <>
              {reviewedInformationDetail && (
                <ApprovalRequestInformationContext
                  detail={reviewedInformationDetail}
                  event={informationRequestEvent}
                />
              )}
              {informationSource.snapshot && (
                <Chip
                  size="small"
                  label={t('requests.amendment.generation', {
                    generation: informationSource.snapshot.sourceGeneration,
                  })}
                />
              )}
              {requestAction.request.latestInformationRequest && (
                <ApprovalRequestInformationPrompt
                  message={requestAction.request.latestInformationRequest}
                />
              )}
              <ApprovalInformationResponseFields
                key={userProofGeneration}
                responseMessage={responseMessage}
                responsePayload={responsePayload}
                responseFields={responseFields}
                evaluation={amendment.evaluation}
                userBinding={userSource.binding}
                verifyOnlyUserValues={Boolean(
                  unresolvedResponse.current?.input.informationSnapshot &&
                  !act.isPending &&
                  !informationBlocked &&
                  !informationDenied &&
                  informationSource.matches &&
                  informationSource.snapshot &&
                  informationSnapshotIsCurrent(informationSource.snapshot)
                )}
                onUserSourceReadyChange={userSource.report}
                detailReady={amendment.ready}
                disabled={
                  act.isPending ||
                  !requestActionsReady ||
                  !reviewedInformationDetail ||
                  !informationSource.matches ||
                  informationBlocked
                }
                korean={korean}
                detailStatus={
                  <ApprovalRequestInformationDetailStatus
                    loading={informationDetail.isFetching}
                    error={informationDetail.isError}
                    onRetry={() => void informationDetail.refetch()}
                  />
                }
                onResponseMessageChange={(value) => {
                  if (
                    commandScope.isCurrent(commandScope.binding) &&
                    !activeAction.current &&
                    !unresolvedResponse.current
                  )
                    setResponseMessage(value);
                }}
                onResponsePayloadChange={(key, value) => {
                  if (
                    commandScope.isCurrent(commandScope.binding) &&
                    !activeAction.current &&
                    !unresolvedResponse.current
                  )
                    amendment.setValues((current) => ({ ...current, [key]: value }));
                }}
              />
            </>
          )}
          {requestAction?.kind === 'withdraw' && actionRecovery !== 'DENIED' && (
            <InlineFeedback severity="warning">{t('requests.withdrawNotice')}</InlineFeedback>
          )}
        </Stack>
      </FormDialog>

      <ApprovalAttachmentNavigationGuard
        locked={attachments.state.busy || attachments.controller.unresolved}
        ownerId={attachmentOwner.current?.requestId}
      />
      <ApprovalRequestDetailDrawer
        requestId={detailId}
        attachments={attachments}
        canUpdateRequests={requestActionsReady}
        onClose={closeDetail}
        onReturnToWork={returnTarget ? returnToWork : undefined}
        onRespond={(request) => {
          closeDetail();
          openAction('respond', request);
        }}
        onWithdraw={(request) => {
          closeDetail();
          openAction('withdraw', request);
        }}
        onResubmit={resubmitReady ? resubmit.open : undefined}
        resubmitPending={resubmit.pending}
      />
    </ApprovalSurface>
  );
}

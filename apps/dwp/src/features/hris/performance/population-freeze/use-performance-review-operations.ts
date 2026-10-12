import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { HttpError, HttpTransportError } from '@dwp-frontend/shared-utils';

import { useProductSurfaceRequestScope } from '../../../../components/use-product-surface-request-scope';
import { newPerformanceCommandId } from '../model/performance-cycle-command';
import { performanceReviewOperationsDataSource } from './performance-review-operations-api';

import type { ProductSurfaceRequestScope } from '../../../../components/use-product-surface-request-scope';
import type { PerformancePopulationPreview } from '../model/performance-cycle-contract';
import type {
  FreezePerformancePopulationCommand,
  PerformancePopulationFreezeReceipt,
  PerformancePopulationFreezeResult,
} from './population-freeze-contract';
import type { PerformanceReviewOperationsDataSource } from './performance-review-operations-api';
import type {
  PerformanceReviewOperationItem,
  PerformanceReviewOperationsQuery,
} from './performance-review-operations-contract';

export type PerformanceReviewOperationsCommandExecutors = Readonly<{
  previewPopulation?: (
    cycleId: string,
    expectedCycleRevision: number,
    asOf: string
  ) => Promise<PerformancePopulationPreview>;
  freezePopulation?: (
    cycleId: string,
    command: FreezePerformancePopulationCommand
  ) => Promise<PerformancePopulationFreezeResult>;
}>;

export type PerformanceReviewOperationsRuntimeOptions = Readonly<{
  requestScope: ProductSurfaceRequestScope;
  locale: string;
  timeZone: string;
  dataSource?: PerformanceReviewOperationsDataSource;
  commandExecutors: PerformanceReviewOperationsCommandExecutors;
  focusResourcePublicId?: string | null;
  onFocusResourcePublicIdChange?: (resourcePublicId: string | null) => void;
}>;

type PendingFreeze = Readonly<{
  cycleId: string;
  command: FreezePerformancePopulationCommand;
}>;

const FOCUS_PUBLIC_ID = /^[A-Za-z0-9._:-]{1,128}$/;

export function normalizePerformanceReviewOperationsFocus(value: string | null | undefined) {
  return value && FOCUS_PUBLIC_ID.test(value) ? value : null;
}

function operationQueryKey(
  requestScope: ProductSurfaceRequestScope,
  cursor: string | null,
  asOf: string | null,
  correlationId: string,
  focusResourcePublicId: string | null,
  locale: string,
  timeZone: string
) {
  return [
    'hris',
    'performance',
    'review-operations',
    ...requestScope.cacheKey,
    cursor ?? 'first',
    asOf ?? 'current',
    correlationId,
    focusResourcePublicId ?? 'all',
    locale,
    timeZone,
  ] as const;
}

function hasAction(item: PerformanceReviewOperationItem | null, actionKey: string): boolean {
  return Boolean(item?.availableActions.some((action) => action.actionKey === actionKey));
}

function cycleRevision(item: PerformanceReviewOperationItem): number | null {
  const assignment = item.fieldGroups.REVIEW_ASSIGNMENT;
  return assignment?.decision === 'VIEW' ? assignment.value.revision : null;
}

export function isAmbiguousPerformancePopulationFreezeFailure(error: unknown): boolean {
  if (error instanceof HttpTransportError) {
    return error.reason === 'NETWORK' || error.reason === 'TIMEOUT';
  }
  return (
    error instanceof HttpError &&
    (error.status === 408 || error.status === 429 || error.status >= 500)
  );
}

export function useHrisPerformanceReviewOperationsRequestScope() {
  return useProductSurfaceRequestScope({
    productKey: 'hcm',
    surfaceKey: 'hcm.operations',
  });
}

export function usePerformanceReviewOperationsRuntime({
  requestScope,
  locale,
  timeZone,
  dataSource = performanceReviewOperationsDataSource,
  commandExecutors,
  focusResourcePublicId,
  onFocusResourcePublicIdChange,
}: PerformanceReviewOperationsRuntimeOptions) {
  const scopeIdentity = JSON.stringify(requestScope.cacheKey);
  const [cursorHistory, setCursorHistory] = useState<readonly (string | null)[]>([null]);
  const [pageIndex, setPageIndex] = useState(0);
  const [anchorAsOf, setAnchorAsOf] = useState<string | null>(null);
  const [correlationId, setCorrelationId] = useState(newPerformanceCommandId);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [preview, setPreview] = useState<PerformancePopulationPreview | null>(null);
  const [previewCycleId, setPreviewCycleId] = useState<string | null>(null);
  const [previewRefreshCorrelationId, setPreviewRefreshCorrelationId] = useState<string | null>(
    null
  );
  const [freezeResult, setFreezeResult] = useState<PerformancePopulationFreezeResult | null>(null);
  const [receipt, setReceipt] = useState<PerformancePopulationFreezeReceipt | null>(null);
  const [pendingFreeze, setPendingFreeze] = useState<PendingFreeze | null>(null);
  const [commandError, setCommandError] = useState<Error | null>(null);
  const [commandBusy, setCommandBusy] = useState(false);
  const [stateScopeIdentity, setStateScopeIdentity] = useState(scopeIdentity);
  const scopeEpochRef = useRef({ identity: scopeIdentity, epoch: 0 });
  if (scopeEpochRef.current.identity !== scopeIdentity) {
    scopeEpochRef.current = {
      identity: scopeIdentity,
      epoch: scopeEpochRef.current.epoch + 1,
    };
  }
  const scopeCurrent = stateScopeIdentity === scopeIdentity;
  const transitionCorrelationRef = useRef<{
    scopeIdentity: string;
    correlationId: string;
  } | null>(null);
  if (!scopeCurrent && transitionCorrelationRef.current?.scopeIdentity !== scopeIdentity) {
    transitionCorrelationRef.current = {
      scopeIdentity,
      correlationId: newPerformanceCommandId(),
    };
  }
  const activePageIndex = scopeCurrent ? pageIndex : 0;
  const cursor = scopeCurrent ? (cursorHistory[activePageIndex] ?? null) : null;
  const activeAnchorAsOf = scopeCurrent ? anchorAsOf : null;
  const activeCorrelationId = scopeCurrent
    ? correlationId
    : transitionCorrelationRef.current!.correlationId;
  const activeSelectedItemId = scopeCurrent ? selectedItemId : null;
  const activePreview = scopeCurrent ? preview : null;
  const activePreviewCycleId = scopeCurrent ? previewCycleId : null;
  const activePreviewRefreshCorrelationId = scopeCurrent ? previewRefreshCorrelationId : null;
  const activeFreezeResult = scopeCurrent ? freezeResult : null;
  const activeReceipt = scopeCurrent ? receipt : null;
  const activePendingFreeze = scopeCurrent ? pendingFreeze : null;
  const activeCommandError = scopeCurrent ? commandError : null;
  const activeCommandBusy = scopeCurrent ? commandBusy : false;
  const requestedFocus = normalizePerformanceReviewOperationsFocus(focusResourcePublicId);
  const governedFocus = activePendingFreeze?.cycleId ?? requestedFocus;
  const queryContextIdentity = JSON.stringify([locale, timeZone, governedFocus]);
  const previousQueryContextIdentity = useRef(queryContextIdentity);

  useEffect(() => {
    if (scopeCurrent) return;
    const nextCorrelationId = transitionCorrelationRef.current!.correlationId;
    setCursorHistory([null]);
    setPageIndex(0);
    setAnchorAsOf(null);
    setCorrelationId(nextCorrelationId);
    setSelectedItemId(null);
    setPreview(null);
    setPreviewCycleId(null);
    setPreviewRefreshCorrelationId(null);
    setFreezeResult(null);
    setReceipt(null);
    setPendingFreeze(null);
    setCommandError(null);
    setCommandBusy(false);
    previousQueryContextIdentity.current = queryContextIdentity;
    setStateScopeIdentity(scopeIdentity);
  }, [queryContextIdentity, scopeCurrent, scopeIdentity]);

  useEffect(() => {
    if (!scopeCurrent) return;
    if (previousQueryContextIdentity.current === queryContextIdentity) return;
    previousQueryContextIdentity.current = queryContextIdentity;
    setCursorHistory([null]);
    setPageIndex(0);
    setAnchorAsOf(null);
    setCorrelationId(newPerformanceCommandId());
    if (!activePendingFreeze) {
      setSelectedItemId(null);
      setPreview(null);
      setPreviewCycleId(null);
      setPreviewRefreshCorrelationId(null);
      setFreezeResult(null);
      setReceipt(null);
    }
  }, [activePendingFreeze, queryContextIdentity, scopeCurrent]);

  useEffect(() => {
    if (!activePendingFreeze || requestedFocus === activePendingFreeze.cycleId) return;
    onFocusResourcePublicIdChange?.(activePendingFreeze.cycleId);
  }, [activePendingFreeze, onFocusResourcePublicIdChange, requestedFocus]);

  const request = useMemo<PerformanceReviewOperationsQuery>(
    () => ({
      limit: 25,
      filter: governedFocus ? { reviewAssignment: { publicIds: [governedFocus] } } : {},
      sort: ['dueStatus:ASC', 'itemPublicId:ASC'],
      locale,
      timeZone,
      correlationId: activeCorrelationId,
      asOf: activeAnchorAsOf,
      cursor,
    }),
    [activeAnchorAsOf, activeCorrelationId, cursor, governedFocus, locale, timeZone]
  );
  const query = useQuery({
    queryKey: operationQueryKey(
      requestScope,
      cursor,
      activeAnchorAsOf,
      activeCorrelationId,
      governedFocus,
      locale,
      timeZone
    ),
    queryFn: async ({ signal }) => {
      const projection = await dataSource.query(request, requestScope.contextScopeKey, signal);
      if (projection.queryState.correlationId !== activeCorrelationId) {
        throw new Error('Performance review-operations correlation does not match the request.');
      }
      return projection;
    },
    enabled: requestScope.ready,
    meta: requestScope.queryMeta,
    staleTime: 0,
  });
  const projection = query.data;
  const items = projection?.items ?? [];
  const selectedItem =
    items.find((item) => item.deepLink.resourcePublicId === governedFocus) ??
    items.find((item) => item.itemPublicId === activeSelectedItemId) ??
    items[0] ??
    null;
  const selectedCycleId = selectedItem?.deepLink.resourcePublicId ?? null;
  const previewConfirmedByProjection = Boolean(
    activePreview &&
    activePreviewCycleId === selectedCycleId &&
    activePreviewRefreshCorrelationId &&
    projection?.queryState.correlationId === activePreviewRefreshCorrelationId &&
    hasAction(selectedItem, 'hris.action.per.freeze-population')
  );

  useEffect(() => {
    if (!scopeCurrent) return;
    if (!selectedItem) {
      setSelectedItemId(null);
      return;
    }
    if (selectedItem.itemPublicId !== activeSelectedItemId) {
      setSelectedItemId(selectedItem.itemPublicId);
    }
  }, [activeSelectedItemId, scopeCurrent, selectedItem]);

  useEffect(() => {
    if (scopeCurrent && projection && activePreview && activePreviewCycleId !== selectedCycleId) {
      setPreview(null);
      setPreviewCycleId(null);
      setPreviewRefreshCorrelationId(null);
      setFreezeResult(null);
      setReceipt(null);
      setCommandError(null);
    }
  }, [activePreview, activePreviewCycleId, projection, scopeCurrent, selectedCycleId]);

  const selectItem = (itemPublicId: string) => {
    if (!scopeCurrent || activePendingFreeze || activeCommandBusy) return;
    const resourcePublicId = items.find((item) => item.itemPublicId === itemPublicId)?.deepLink
      .resourcePublicId;
    if (resourcePublicId) onFocusResourcePublicIdChange?.(resourcePublicId);
    if (itemPublicId === activeSelectedItemId) return;
    setSelectedItemId(itemPublicId);
    setPreview(null);
    setPreviewCycleId(null);
    setPreviewRefreshCorrelationId(null);
    setFreezeResult(null);
    setReceipt(null);
    setCommandError(null);
  };

  const refresh = () => {
    if (!scopeCurrent || activePendingFreeze || activeCommandBusy) return;
    setCursorHistory([null]);
    setPageIndex(0);
    setAnchorAsOf(null);
    setCorrelationId(newPerformanceCommandId());
    setPreview(null);
    setPreviewCycleId(null);
    setPreviewRefreshCorrelationId(null);
    setFreezeResult(null);
    setReceipt(null);
    setCommandError(null);
  };

  const refreshAfterCommand = () => {
    const nextCorrelationId = newPerformanceCommandId();
    setCursorHistory([null]);
    setPageIndex(0);
    setAnchorAsOf(null);
    setCorrelationId(nextCorrelationId);
    return nextCorrelationId;
  };

  const nextPage = () => {
    if (!scopeCurrent || activePendingFreeze || activeCommandBusy) return;
    const nextCursor = projection?.queryState.nextCursor;
    if (!nextCursor || !projection) return;
    setCursorHistory((current) => [...current.slice(0, activePageIndex + 1), nextCursor]);
    setAnchorAsOf(projection.asOf);
    setPageIndex((current) => current + 1);
    setSelectedItemId(null);
    setPreview(null);
    setPreviewCycleId(null);
    setPreviewRefreshCorrelationId(null);
    setFreezeResult(null);
    setReceipt(null);
  };

  const previousPage = () => {
    if (!scopeCurrent || activePageIndex === 0 || activePendingFreeze || activeCommandBusy) return;
    setPageIndex((current) => current - 1);
    setSelectedItemId(null);
    setPreview(null);
    setPreviewCycleId(null);
    setPreviewRefreshCorrelationId(null);
    setFreezeResult(null);
    setReceipt(null);
  };

  const previewSelected = async () => {
    const commandScopeEpoch = scopeEpochRef.current.epoch;
    const expectedCycleRevision = selectedItem ? cycleRevision(selectedItem) : null;
    if (
      !scopeCurrent ||
      !selectedItem ||
      expectedCycleRevision === null ||
      !commandExecutors?.previewPopulation ||
      !hasAction(selectedItem, 'hris.action.per.preview-population') ||
      activePendingFreeze ||
      activeCommandBusy
    ) {
      return;
    }
    setCommandBusy(true);
    setCommandError(null);
    setFreezeResult(null);
    setReceipt(null);
    try {
      const result = await commandExecutors.previewPopulation(
        selectedItem.deepLink.resourcePublicId,
        expectedCycleRevision,
        new Date().toISOString()
      );
      if (scopeEpochRef.current.epoch !== commandScopeEpoch) return;
      setPreview(result);
      setPreviewCycleId(selectedItem.deepLink.resourcePublicId);
      setPreviewRefreshCorrelationId(refreshAfterCommand());
    } catch (error) {
      if (scopeEpochRef.current.epoch !== commandScopeEpoch) return;
      setCommandError(error instanceof Error ? error : new Error('Preview failed.'));
    } finally {
      if (scopeEpochRef.current.epoch === commandScopeEpoch) setCommandBusy(false);
    }
  };

  const freezeSelected = async (reason: string) => {
    const commandScopeEpoch = scopeEpochRef.current.epoch;
    if (
      !scopeCurrent ||
      !selectedItem ||
      !activePreview ||
      activePreviewCycleId !== selectedItem.deepLink.resourcePublicId ||
      !previewConfirmedByProjection ||
      !commandExecutors?.freezePopulation ||
      !hasAction(selectedItem, 'hris.action.per.freeze-population') ||
      reason.trim().length < 10 ||
      reason.trim().length > 500 ||
      activePendingFreeze ||
      activeCommandBusy
    ) {
      return;
    }
    setCommandBusy(true);
    setCommandError(null);
    const pending: PendingFreeze = {
      cycleId: selectedItem.deepLink.resourcePublicId,
      command: {
        commandId: newPerformanceCommandId(),
        expectedCycleRevision: activePreview.sourceCycleAggregateVersion,
        populationPreviewId: activePreview.populationPreviewId,
        populationRuleId: activePreview.populationRuleVersionId,
        workforceSnapshotId: activePreview.workforceSnapshotId,
        workforceSnapshotRevision: activePreview.workforceSnapshotRevision,
        previewContentHash: activePreview.contentHash,
        reason: reason.trim(),
      },
    };
    setPendingFreeze(pending);
    try {
      const result = await commandExecutors.freezePopulation(pending.cycleId, pending.command);
      if (scopeEpochRef.current.epoch !== commandScopeEpoch) return;
      setFreezeResult(result);
      setReceipt(result.receipt);
      if (result.receipt.state === 'SUCCEEDED') {
        setPendingFreeze(null);
        refreshAfterCommand();
      } else if (['FAILED', 'QUARANTINED'].includes(result.receipt.state)) {
        setPendingFreeze(null);
        setCommandError(
          new Error(result.receipt.errorCode ?? 'Population freeze was not applied.')
        );
      }
    } catch (error) {
      if (scopeEpochRef.current.epoch !== commandScopeEpoch) return;
      if (!isAmbiguousPerformancePopulationFreezeFailure(error)) {
        setPendingFreeze(null);
      }
      setCommandError(error instanceof Error ? error : new Error('Freeze failed.'));
    } finally {
      if (scopeEpochRef.current.epoch === commandScopeEpoch) setCommandBusy(false);
    }
  };

  const reconcileFreeze = async () => {
    const commandScopeEpoch = scopeEpochRef.current.epoch;
    if (
      !scopeCurrent ||
      !activePendingFreeze ||
      !commandExecutors?.freezePopulation ||
      activeCommandBusy
    ) {
      return;
    }
    setCommandBusy(true);
    setCommandError(null);
    try {
      const result = await commandExecutors.freezePopulation(
        activePendingFreeze.cycleId,
        activePendingFreeze.command
      );
      if (scopeEpochRef.current.epoch !== commandScopeEpoch) return;
      setFreezeResult(result);
      setReceipt(result.receipt);
      if (result.receipt.state === 'SUCCEEDED') {
        setPendingFreeze(null);
        refreshAfterCommand();
      } else if (['FAILED', 'QUARANTINED'].includes(result.receipt.state)) {
        setPendingFreeze(null);
        setCommandError(
          new Error(result.receipt.errorCode ?? 'Population freeze was not applied.')
        );
      }
    } catch (error) {
      if (scopeEpochRef.current.epoch !== commandScopeEpoch) return;
      if (!isAmbiguousPerformancePopulationFreezeFailure(error)) {
        setPendingFreeze(null);
      }
      setCommandError(error instanceof Error ? error : new Error('Reconciliation failed.'));
    } finally {
      if (scopeEpochRef.current.epoch === commandScopeEpoch) setCommandBusy(false);
    }
  };

  return {
    ready: requestScope.ready,
    projection,
    selectedItem,
    selectedItemId: activeSelectedItemId,
    preview: activePreview,
    previewConfirmedByProjection,
    freezeResult: activeFreezeResult,
    receipt: activeReceipt,
    commandError: activeCommandError,
    commandBusy: activeCommandBusy,
    previewExecutorConnected: Boolean(commandExecutors?.previewPopulation),
    freezeExecutorConnected: Boolean(commandExecutors?.freezePopulation),
    freezeRetryPending: Boolean(activePendingFreeze),
    loading: query.isPending,
    fetching: query.isFetching,
    error: query.error,
    pageIndex: activePageIndex,
    canNext: Boolean(projection?.queryState.nextCursor),
    canPrevious: activePageIndex > 0,
    selectItem,
    refresh,
    nextPage,
    previousPage,
    previewSelected,
    freezeSelected,
    reconcileFreeze,
  };
}

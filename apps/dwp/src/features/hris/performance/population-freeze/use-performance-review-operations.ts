import { useEffect, useMemo, useRef, useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
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
  const cursor = cursorHistory[pageIndex] ?? null;
  const requestedFocus = normalizePerformanceReviewOperationsFocus(focusResourcePublicId);
  const governedFocus = pendingFreeze?.cycleId ?? requestedFocus;
  const previousScopeIdentity = useRef(scopeIdentity);
  const queryContextIdentity = JSON.stringify([locale, timeZone, governedFocus]);
  const previousQueryContextIdentity = useRef(queryContextIdentity);

  useEffect(() => {
    if (previousScopeIdentity.current === scopeIdentity) return;
    previousScopeIdentity.current = scopeIdentity;
    setCursorHistory([null]);
    setPageIndex(0);
    setAnchorAsOf(null);
    setCorrelationId(newPerformanceCommandId());
    setSelectedItemId(null);
    setPreview(null);
    setPreviewCycleId(null);
    setPreviewRefreshCorrelationId(null);
    setFreezeResult(null);
    setReceipt(null);
    setPendingFreeze(null);
    setCommandError(null);
  }, [scopeIdentity]);

  useEffect(() => {
    if (previousQueryContextIdentity.current === queryContextIdentity) return;
    previousQueryContextIdentity.current = queryContextIdentity;
    setCursorHistory([null]);
    setPageIndex(0);
    setAnchorAsOf(null);
    setCorrelationId(newPerformanceCommandId());
    if (!pendingFreeze) {
      setSelectedItemId(null);
      setPreview(null);
      setPreviewCycleId(null);
      setPreviewRefreshCorrelationId(null);
      setFreezeResult(null);
      setReceipt(null);
    }
  }, [pendingFreeze, queryContextIdentity]);

  useEffect(() => {
    if (!pendingFreeze || requestedFocus === pendingFreeze.cycleId) return;
    onFocusResourcePublicIdChange?.(pendingFreeze.cycleId);
  }, [onFocusResourcePublicIdChange, pendingFreeze, requestedFocus]);

  const request = useMemo<PerformanceReviewOperationsQuery>(
    () => ({
      limit: 25,
      filter: governedFocus ? { reviewAssignment: { publicIds: [governedFocus] } } : {},
      sort: ['dueStatus:ASC', 'itemPublicId:ASC'],
      locale,
      timeZone,
      correlationId,
      asOf: anchorAsOf,
      cursor,
    }),
    [anchorAsOf, correlationId, cursor, governedFocus, locale, timeZone]
  );
  const query = useQuery({
    queryKey: operationQueryKey(
      requestScope,
      cursor,
      anchorAsOf,
      correlationId,
      governedFocus,
      locale,
      timeZone
    ),
    queryFn: async ({ signal }) => {
      const projection = await dataSource.query(request, requestScope.contextScopeKey, signal);
      if (projection.queryState.correlationId !== correlationId) {
        throw new Error('Performance review-operations correlation does not match the request.');
      }
      return projection;
    },
    enabled: requestScope.ready,
    meta: requestScope.queryMeta,
    staleTime: 0,
    placeholderData: keepPreviousData,
  });
  const projection = query.data;
  const items = projection?.items ?? [];
  const selectedItem =
    items.find((item) => item.deepLink.resourcePublicId === governedFocus) ??
    items.find((item) => item.itemPublicId === selectedItemId) ??
    items[0] ??
    null;
  const selectedCycleId = selectedItem?.deepLink.resourcePublicId ?? null;
  const previewConfirmedByProjection = Boolean(
    preview &&
    previewCycleId === selectedCycleId &&
    previewRefreshCorrelationId &&
    projection?.queryState.correlationId === previewRefreshCorrelationId &&
    hasAction(selectedItem, 'hris.action.per.freeze-population')
  );

  useEffect(() => {
    if (!selectedItem) {
      setSelectedItemId(null);
      return;
    }
    if (selectedItem.itemPublicId !== selectedItemId) {
      setSelectedItemId(selectedItem.itemPublicId);
    }
  }, [selectedItem, selectedItemId]);

  useEffect(() => {
    if (preview && previewCycleId !== selectedCycleId) {
      setPreview(null);
      setPreviewCycleId(null);
      setPreviewRefreshCorrelationId(null);
      setFreezeResult(null);
      setReceipt(null);
      setCommandError(null);
    }
  }, [preview, previewCycleId, selectedCycleId]);

  const selectItem = (itemPublicId: string) => {
    if (pendingFreeze || commandBusy) return;
    const resourcePublicId = items.find((item) => item.itemPublicId === itemPublicId)?.deepLink
      .resourcePublicId;
    if (resourcePublicId) onFocusResourcePublicIdChange?.(resourcePublicId);
    if (itemPublicId === selectedItemId) return;
    setSelectedItemId(itemPublicId);
    setPreview(null);
    setPreviewCycleId(null);
    setPreviewRefreshCorrelationId(null);
    setFreezeResult(null);
    setReceipt(null);
    setCommandError(null);
  };

  const refresh = () => {
    if (pendingFreeze || commandBusy) return;
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
    if (pendingFreeze || commandBusy) return;
    const nextCursor = projection?.queryState.nextCursor;
    if (!nextCursor || !projection) return;
    setCursorHistory((current) => [...current.slice(0, pageIndex + 1), nextCursor]);
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
    if (pageIndex === 0 || pendingFreeze || commandBusy) return;
    setPageIndex((current) => current - 1);
    setSelectedItemId(null);
    setPreview(null);
    setPreviewCycleId(null);
    setPreviewRefreshCorrelationId(null);
    setFreezeResult(null);
    setReceipt(null);
  };

  const previewSelected = async () => {
    const expectedCycleRevision = selectedItem ? cycleRevision(selectedItem) : null;
    if (
      !selectedItem ||
      expectedCycleRevision === null ||
      !commandExecutors?.previewPopulation ||
      !hasAction(selectedItem, 'hris.action.per.preview-population') ||
      pendingFreeze ||
      commandBusy
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
      setPreview(result);
      setPreviewCycleId(selectedItem.deepLink.resourcePublicId);
      setPreviewRefreshCorrelationId(refreshAfterCommand());
    } catch (error) {
      setCommandError(error instanceof Error ? error : new Error('Preview failed.'));
    } finally {
      setCommandBusy(false);
    }
  };

  const freezeSelected = async (reason: string) => {
    if (
      !selectedItem ||
      !preview ||
      previewCycleId !== selectedItem.deepLink.resourcePublicId ||
      !previewConfirmedByProjection ||
      !commandExecutors?.freezePopulation ||
      !hasAction(selectedItem, 'hris.action.per.freeze-population') ||
      reason.trim().length < 10 ||
      reason.trim().length > 500 ||
      pendingFreeze ||
      commandBusy
    ) {
      return;
    }
    setCommandBusy(true);
    setCommandError(null);
    const pending: PendingFreeze = {
      cycleId: selectedItem.deepLink.resourcePublicId,
      command: {
        commandId: newPerformanceCommandId(),
        expectedCycleRevision: preview.sourceCycleAggregateVersion,
        populationPreviewId: preview.populationPreviewId,
        populationRuleId: preview.populationRuleVersionId,
        workforceSnapshotId: preview.workforceSnapshotId,
        workforceSnapshotRevision: preview.workforceSnapshotRevision,
        previewContentHash: preview.contentHash,
        reason: reason.trim(),
      },
    };
    setPendingFreeze(pending);
    try {
      const result = await commandExecutors.freezePopulation(pending.cycleId, pending.command);
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
      if (!isAmbiguousPerformancePopulationFreezeFailure(error)) {
        setPendingFreeze(null);
      }
      setCommandError(error instanceof Error ? error : new Error('Freeze failed.'));
    } finally {
      setCommandBusy(false);
    }
  };

  const reconcileFreeze = async () => {
    if (!pendingFreeze || !commandExecutors?.freezePopulation || commandBusy) return;
    setCommandBusy(true);
    setCommandError(null);
    try {
      const result = await commandExecutors.freezePopulation(
        pendingFreeze.cycleId,
        pendingFreeze.command
      );
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
      if (!isAmbiguousPerformancePopulationFreezeFailure(error)) {
        setPendingFreeze(null);
      }
      setCommandError(error instanceof Error ? error : new Error('Reconciliation failed.'));
    } finally {
      setCommandBusy(false);
    }
  };

  return {
    ready: requestScope.ready,
    projection,
    selectedItem,
    selectedItemId,
    preview,
    previewConfirmedByProjection,
    freezeResult,
    receipt,
    commandError,
    commandBusy,
    previewExecutorConnected: Boolean(commandExecutors?.previewPopulation),
    freezeExecutorConnected: Boolean(commandExecutors?.freezePopulation),
    freezeRetryPending: Boolean(pendingFreeze),
    loading: query.isPending,
    fetching: query.isFetching,
    error: query.error,
    pageIndex,
    canNext: Boolean(projection?.queryState.nextCursor),
    canPrevious: pageIndex > 0,
    selectItem,
    refresh,
    nextPage,
    previousPage,
    previewSelected,
    freezeSelected,
    reconcileFreeze,
  };
}

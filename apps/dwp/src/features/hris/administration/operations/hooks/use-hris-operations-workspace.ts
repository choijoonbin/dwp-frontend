import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { HttpError } from '@dwp-frontend/shared-utils';

import { useProductSurfaceRequestScope } from '../../../../../components/use-product-surface-request-scope';
import { hrisOperationsDataSource } from '../api/hris-operations-api';
import { HRIS_OPERATIONS_FEATURE } from '../model/hris-operations-contract';

import type { HrisOperationsDataSource } from '../api/hris-operations-api';
import type { HrisOperationsQueryState } from '../model/hris-operations-contract';

export type HrisOperationsWorkspaceLoadState = 'LOADING' | 'READY' | 'PERMISSION' | 'UNAVAILABLE';

function errorStatus(error: unknown): number | undefined {
  if (error instanceof HttpError) return error.status;
  if (error && typeof error === 'object' && 'status' in error) {
    const status = (error as { status?: unknown }).status;
    return typeof status === 'number' ? status : undefined;
  }
  return undefined;
}

function denied(error: unknown): boolean {
  return [401, 403, 404].includes(errorStatus(error) ?? 0);
}

export function useHrisOperationsRequestScope() {
  return useProductSurfaceRequestScope({
    productKey: 'hcm',
    surfaceKey: 'hcm.management',
  });
}

export function hrisOperationsRuntimeAdmitted(
  input: Readonly<{
    feature: typeof HRIS_OPERATIONS_FEATURE;
    featureEnabled: boolean;
    tenantEnrolled: boolean;
    governed: boolean;
    ready: boolean;
  }>
): boolean {
  return (
    input.feature === HRIS_OPERATIONS_FEATURE &&
    input.featureEnabled &&
    input.tenantEnrolled &&
    input.governed &&
    input.ready
  );
}

function exactExceptionContextScopeKey(value: string | undefined): value is string {
  return value !== undefined && /^scope-[a-f0-9]{32}$/u.test(value);
}

export function useHrisOperationsWorkspace({
  queryState,
  onQueryStateChange,
  featureEnabled,
  tenantEnrolled,
  exceptionContextScopeKey,
  dataSource = hrisOperationsDataSource,
}: Readonly<{
  queryState: HrisOperationsQueryState;
  onQueryStateChange: (patch: Partial<HrisOperationsQueryState>) => void;
  featureEnabled: boolean;
  tenantEnrolled: boolean;
  exceptionContextScopeKey?: string;
  dataSource?: HrisOperationsDataSource;
}>) {
  const requestScope = useHrisOperationsRequestScope();
  const [cursor, setCursor] = useState<string | undefined>();
  const [previousCursors, setPreviousCursors] = useState<readonly (string | undefined)[]>([]);
  const [receiptId, setReceiptId] = useState<string | null>(null);
  const entryAdmitted = hrisOperationsRuntimeAdmitted({
    feature: HRIS_OPERATIONS_FEATURE,
    featureEnabled,
    tenantEnrolled,
    governed: requestScope.governed,
    ready: requestScope.ready,
  });
  const exceptionReadContext = useMemo(
    () =>
      exactExceptionContextScopeKey(exceptionContextScopeKey)
        ? { contextScopeKey: exceptionContextScopeKey }
        : null,
    [exceptionContextScopeKey]
  );
  const exceptionScopeIdentity = JSON.stringify([
    ...requestScope.cacheKey,
    exceptionReadContext?.contextScopeKey ?? null,
  ]);
  const [boundExceptionScopeIdentity, setBoundExceptionScopeIdentity] =
    useState(exceptionScopeIdentity);
  const exceptionScopeChanged = boundExceptionScopeIdentity !== exceptionScopeIdentity;
  const activeCursor = exceptionScopeChanged ? undefined : cursor;
  const activePreviousCursors = exceptionScopeChanged ? [] : previousCursors;
  const activeReceiptId = exceptionScopeChanged ? null : receiptId;

  useEffect(() => {
    if (!exceptionScopeChanged) return;
    setCursor(undefined);
    setPreviousCursors([]);
    setReceiptId(null);
    setBoundExceptionScopeIdentity(exceptionScopeIdentity);
  }, [exceptionScopeChanged, exceptionScopeIdentity]);

  const exceptionAdmitted = entryAdmitted && exceptionReadContext !== null;
  const listQuery = useMemo(
    () => ({
      limit: 50,
      ...(activeCursor ? { cursor: activeCursor } : {}),
      ...(queryState.ownerModule === 'ALL' ? {} : { ownerModule: queryState.ownerModule }),
      ...(queryState.severity === 'ALL' ? {} : { severity: queryState.severity }),
      ...(queryState.state === 'ALL' ? {} : { state: queryState.state }),
    }),
    [activeCursor, queryState.ownerModule, queryState.severity, queryState.state]
  );

  const entry = useQuery({
    queryKey: ['hris', 'operations', 'entry', ...requestScope.cacheKey],
    queryFn: ({ signal }) => dataSource.entry({ signal }),
    enabled: entryAdmitted,
    meta: requestScope.queryMeta,
    staleTime: 20_000,
  });
  const entryAvailable = entry.data !== undefined && entry.data.projectionState !== 'UNAVAILABLE';
  const exceptions = useQuery({
    queryKey: [
      'hris',
      'operations',
      'exceptions',
      ...requestScope.cacheKey,
      exceptionReadContext?.contextScopeKey ?? '',
      listQuery,
    ],
    queryFn: ({ signal }) => dataSource.exceptions(listQuery, { ...exceptionReadContext!, signal }),
    enabled: exceptionAdmitted && entryAvailable,
    meta: requestScope.queryMeta,
    staleTime: 15_000,
  });

  const selectedId = queryState.focus ?? exceptions.data?.items[0]?.exceptionPublicId ?? null;
  useEffect(() => {
    if (queryState.focus === null && selectedId !== null) {
      onQueryStateChange({ focus: selectedId });
    }
  }, [onQueryStateChange, queryState.focus, selectedId]);

  const detail = useQuery({
    queryKey: [
      'hris',
      'operations',
      'exception',
      ...requestScope.cacheKey,
      exceptionReadContext?.contextScopeKey ?? '',
      selectedId,
    ],
    queryFn: ({ signal }) => dataSource.detail(selectedId!, { ...exceptionReadContext!, signal }),
    enabled: exceptionAdmitted && entryAvailable && selectedId !== null,
    meta: requestScope.queryMeta,
    staleTime: 15_000,
  });

  useEffect(() => setReceiptId(null), [selectedId]);
  const receipt = useQuery({
    queryKey: [
      'hris',
      'operations',
      'receipt',
      ...requestScope.cacheKey,
      exceptionReadContext?.contextScopeKey ?? '',
      activeReceiptId,
    ],
    queryFn: ({ signal }) => dataSource.receipt(activeReceiptId!, { signal }),
    enabled: exceptionAdmitted && activeReceiptId !== null,
    meta: requestScope.queryMeta,
    staleTime: 10_000,
  });

  const firstError = entry.error ?? exceptions.error;
  const loadState: HrisOperationsWorkspaceLoadState = !entryAdmitted
    ? 'PERMISSION'
    : denied(firstError)
      ? 'PERMISSION'
      : firstError || entry.data?.projectionState === 'UNAVAILABLE'
        ? 'UNAVAILABLE'
        : entry.isLoading || (exceptionAdmitted && entryAvailable && exceptions.isLoading)
          ? 'LOADING'
          : !exceptionAdmitted
            ? 'PERMISSION'
            : 'READY';

  function updateQueryState(patch: Partial<HrisOperationsQueryState>) {
    setCursor(undefined);
    setPreviousCursors([]);
    setReceiptId(null);
    onQueryStateChange(patch);
  }

  return {
    loadState,
    entry: entry.data,
    page: exceptions.data,
    selectedId,
    detail: detail.data,
    detailLoading: detail.isLoading,
    detailDenied: denied(detail.error),
    detailUnavailable: detail.isError && !denied(detail.error),
    receipt: receipt.data,
    receiptId: activeReceiptId,
    receiptLoading: receipt.isLoading,
    receiptDenied: denied(receipt.error),
    receiptUnavailable: receipt.isError && !denied(receipt.error),
    queryState,
    pageIndex: activePreviousCursors.length,
    canPrevious: activePreviousCursors.length > 0,
    canNext: Boolean(exceptions.data?.nextCursor),
    updateQueryState,
    select(exceptionPublicId: string) {
      setReceiptId(null);
      onQueryStateChange({ focus: exceptionPublicId });
    },
    inspectReceipt(id: string) {
      setReceiptId(id);
    },
    next() {
      const nextCursor = exceptions.data?.nextCursor;
      if (!nextCursor) return;
      setPreviousCursors((current) => [...current, activeCursor]);
      setCursor(nextCursor);
    },
    previous() {
      setPreviousCursors((current) => {
        if (current.length === 0) return current;
        setCursor(current[current.length - 1]);
        return current.slice(0, -1);
      });
    },
    async refresh() {
      const entryResult = await entry.refetch();
      if (exceptionAdmitted && entryResult.data?.projectionState !== 'UNAVAILABLE') {
        await Promise.all([
          exceptions.refetch(),
          selectedId ? detail.refetch() : Promise.resolve(),
        ]);
      }
    },
  };
}

export type HrisOperationsWorkspaceController = ReturnType<typeof useHrisOperationsWorkspace>;

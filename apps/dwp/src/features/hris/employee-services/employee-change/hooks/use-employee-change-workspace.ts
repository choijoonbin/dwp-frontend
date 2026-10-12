import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';

import { useProductActionMutation } from '../../../../../components/use-product-action-mutation';
import { useProductSurfaceRequestScope } from '../../../../../components/use-product-surface-request-scope';
import { employeeChangeDataSource } from '../api/employee-change-api';
import {
  EMPLOYEE_CHANGE_CREATE_ROUTE_CONTRACT,
  EMPLOYEE_CHANGE_SUBMIT_ROUTE_CONTRACT,
  employeeChangeItemVersion,
  hasEmployeeChangeAction,
} from '../model/employee-change-contract';

import type { ProductSurfaceGovernedMutationAuthority } from '@dwp-frontend/shared-utils';
import type {
  EmployeeChangeCreateCommand,
  EmployeeChangeDataSource,
  EmployeeChangeLifecycleCommand,
} from '../api/employee-change-api';
import type {
  EmployeeChangeCommandReceipt,
  EmployeeChangeCreateRequest,
  EmployeeChangeQuery,
} from '../model/employee-change-contract';

export type EmployeeChangeApplyExecutor = <TResult>(
  execute: (authority: ProductSurfaceGovernedMutationAuthority) => Promise<TResult>,
  binding: EmployeeChangeLifecycleCommand
) => Promise<TResult>;

export type EmployeeChangeCommandOwner = Readonly<{
  apply?: Readonly<{
    routeContractKey: 'route.hcm.operations.employee-change-request-apply.action';
    execute: EmployeeChangeApplyExecutor;
  }>;
}>;

export type EmployeeChangeCreateDraft = Readonly<{
  request: EmployeeChangeCreateRequest;
  expectedTargetVersion: number;
}>;

type EmployeeChangeCommandKind = 'create' | 'submit' | 'apply';
type PendingEmployeeChangeCommand = EmployeeChangeCreateCommand | EmployeeChangeLifecycleCommand;

/** Keeps an ambiguous command's exact identity stable until its receipt is recovered. */
export class EmployeeChangePendingCommandLedger {
  private readonly pending = new Map<
    EmployeeChangeCommandKind,
    Readonly<{ signature: string; command: PendingEmployeeChangeCommand }>
  >();

  getOrCreate<TCommand extends PendingEmployeeChangeCommand>(
    kind: EmployeeChangeCommandKind,
    signature: string,
    factory: () => TCommand
  ): TCommand {
    const current = this.pending.get(kind);
    if (current?.signature === signature) return current.command as TCommand;
    const command = factory();
    this.pending.set(kind, { signature, command });
    return command;
  }

  complete(kind: EmployeeChangeCommandKind, signature: string): void {
    if (this.pending.get(kind)?.signature === signature) this.pending.delete(kind);
  }

  recordReceipt(
    kind: EmployeeChangeCommandKind,
    signature: string,
    status: EmployeeChangeCommandReceipt['status']
  ): void {
    if (['SUCCEEDED', 'REJECTED', 'FAILED'].includes(status)) this.complete(kind, signature);
  }

  clear(): void {
    this.pending.clear();
  }
}

function newCommandId(): string {
  if (!globalThis.crypto?.randomUUID) {
    throw new Error('Secure employee-change command identity generation is unavailable.');
  }
  return globalThis.crypto.randomUUID();
}

export function useHrisEmployeeChangeRequestScope() {
  return useProductSurfaceRequestScope({ productKey: 'hcm', surfaceKey: 'hcm.operations' });
}

export function useEmployeeChangeWorkspace({
  enabled,
  locale,
  timeZone,
  dataSource = employeeChangeDataSource,
  commandOwner,
  idFactory = newCommandId,
}: Readonly<{
  enabled: boolean;
  locale: string;
  timeZone: string;
  dataSource?: EmployeeChangeDataSource;
  commandOwner?: EmployeeChangeCommandOwner;
  idFactory?: () => string;
}>) {
  const requestScope = useHrisEmployeeChangeRequestScope();
  const createDispatch = useProductActionMutation(EMPLOYEE_CHANGE_CREATE_ROUTE_CONTRACT);
  const submitDispatch = useProductActionMutation(EMPLOYEE_CHANGE_SUBMIT_ROUTE_CONTRACT);
  const [cursorHistory, setCursorHistory] = useState<readonly (string | null)[]>([null]);
  const [pageIndex, setPageIndex] = useState(0);
  const [asOf, setAsOf] = useState<string | null>(null);
  const [correlationId, setCorrelationId] = useState(idFactory);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<EmployeeChangeCommandReceipt | null>(null);
  const [commandError, setCommandError] = useState<Error | null>(null);
  const [commandBusy, setCommandBusy] = useState(false);
  const pendingCommands = useRef<EmployeeChangePendingCommandLedger | null>(null);
  if (pendingCommands.current === null) {
    pendingCommands.current = new EmployeeChangePendingCommandLedger();
  }
  const scopeIdentity = JSON.stringify(requestScope.cacheKey);
  const previousScopeIdentity = useRef(scopeIdentity);
  const cursor = cursorHistory[pageIndex] ?? null;

  useEffect(() => {
    if (previousScopeIdentity.current === scopeIdentity) return;
    previousScopeIdentity.current = scopeIdentity;
    setCursorHistory([null]);
    setPageIndex(0);
    setAsOf(null);
    setCorrelationId(idFactory());
    setSelectedId(null);
    setReceipt(null);
    setCommandError(null);
    pendingCommands.current?.clear();
  }, [idFactory, scopeIdentity]);

  const resetProjection = useCallback(() => {
    setCursorHistory([null]);
    setPageIndex(0);
    setAsOf(null);
    setCorrelationId(idFactory());
  }, [idFactory]);

  const request = useMemo<EmployeeChangeQuery>(
    () => ({
      limit: 25,
      filter: {},
      sort: ['itemPublicId:ASC'],
      locale,
      timeZone,
      correlationId,
      asOf,
      cursor,
    }),
    [asOf, correlationId, cursor, locale, timeZone]
  );
  const query = useQuery({
    queryKey: [
      'hris',
      'employee-change',
      'workbench',
      ...requestScope.cacheKey,
      cursor ?? 'first',
      asOf ?? 'current',
      correlationId,
      locale,
      timeZone,
    ],
    queryFn: async ({ signal }) => {
      const projection = await dataSource.query(request, requestScope.contextScopeKey, signal);
      if (projection.queryState.correlationId !== correlationId) {
        throw new Error('Employee-change correlation does not match the request.');
      }
      return projection;
    },
    enabled: enabled && requestScope.ready,
    meta: requestScope.queryMeta,
    retry: false,
    staleTime: 0,
  });

  useEffect(() => {
    if (query.data && asOf === null) setAsOf(query.data.asOf);
  }, [asOf, query.data]);

  const items = query.data?.items ?? [];
  const selectedItem = items.find((item) => item.itemPublicId === selectedId) ?? items[0] ?? null;
  const canCreate = items.some((item) =>
    hasEmployeeChangeAction(item, 'hris.action.hrm.create-employee-change-request')
  );

  const runCommand = useCallback(
    async (
      kind: EmployeeChangeCommandKind,
      signature: string,
      operation: () => Promise<EmployeeChangeCommandReceipt>
    ) => {
      setCommandBusy(true);
      setCommandError(null);
      try {
        const nextReceipt = await operation();
        pendingCommands.current?.recordReceipt(kind, signature, nextReceipt.status);
        setReceipt(nextReceipt);
        resetProjection();
        return nextReceipt;
      } catch (error) {
        setCommandError(
          error instanceof Error ? error : new Error('Employee-change command failed.')
        );
        return null;
      } finally {
        setCommandBusy(false);
      }
    },
    [resetProjection]
  );

  const create = useCallback(
    async (draft: EmployeeChangeCreateDraft) => {
      const signature = JSON.stringify({
        expectedTargetVersion: draft.expectedTargetVersion,
        request: draft.request,
      });
      const command = pendingCommands.current!.getOrCreate<EmployeeChangeCreateCommand>(
        'create',
        signature,
        () => ({ ...draft, idempotencyKey: idFactory(), correlationId: idFactory() })
      );
      return runCommand('create', signature, () =>
        createDispatch((authority) => dataSource.create(command, authority))
      );
    },
    [createDispatch, dataSource, idFactory, runCommand]
  );

  const submit = useCallback(async () => {
    const version = selectedItem ? employeeChangeItemVersion(selectedItem) : null;
    if (
      !selectedItem ||
      version === null ||
      !hasEmployeeChangeAction(selectedItem, 'hris.action.hrm.submit-employee-change-request')
    ) {
      return null;
    }
    const signature = JSON.stringify({
      requestPublicId: selectedItem.deepLink.resourcePublicId,
      expectedRequestVersion: version,
    });
    const command = pendingCommands.current!.getOrCreate<EmployeeChangeLifecycleCommand>(
      'submit',
      signature,
      () => ({
        requestPublicId: selectedItem.deepLink.resourcePublicId,
        expectedRequestVersion: version,
        idempotencyKey: idFactory(),
        correlationId: idFactory(),
      })
    );
    return runCommand('submit', signature, () =>
      submitDispatch((authority) => dataSource.submit(command, authority))
    );
  }, [dataSource, idFactory, runCommand, selectedItem, submitDispatch]);

  const apply = useCallback(async () => {
    const version = selectedItem ? employeeChangeItemVersion(selectedItem) : null;
    const executor = commandOwner?.apply?.execute;
    if (
      !selectedItem ||
      !executor ||
      version === null ||
      !hasEmployeeChangeAction(selectedItem, 'hris.action.hrm.apply-employee-change-request')
    ) {
      return null;
    }
    const signature = JSON.stringify({
      requestPublicId: selectedItem.deepLink.resourcePublicId,
      expectedRequestVersion: version,
      purposeCode: 'HR_LIFECYCLE',
    });
    const command = pendingCommands.current!.getOrCreate<EmployeeChangeLifecycleCommand>(
      'apply',
      signature,
      () => ({
        requestPublicId: selectedItem.deepLink.resourcePublicId,
        expectedRequestVersion: version,
        idempotencyKey: idFactory(),
        correlationId: idFactory(),
        purposeCode: 'HR_LIFECYCLE',
      })
    );
    return runCommand('apply', signature, () =>
      executor((authority) => dataSource.apply(command, authority), command)
    );
  }, [commandOwner?.apply?.execute, dataSource, idFactory, runCommand, selectedItem]);

  return {
    requestScope,
    query,
    projection: query.data,
    selectedItem,
    receipt,
    commandError,
    commandBusy,
    pageIndex,
    canPrevious: pageIndex > 0,
    canNext: Boolean(query.data?.queryState.nextCursor),
    canCreate,
    applyConnected: Boolean(commandOwner?.apply),
    select: setSelectedId,
    refresh: () => {
      resetProjection();
      setReceipt(null);
      setCommandError(null);
    },
    next: () => {
      const nextCursor = query.data?.queryState.nextCursor;
      if (!nextCursor) return;
      setCursorHistory((current) => [...current.slice(0, pageIndex + 1), nextCursor]);
      setPageIndex((current) => current + 1);
    },
    previous: () => setPageIndex((current) => Math.max(0, current - 1)),
    create,
    submit,
    apply,
  } as const;
}

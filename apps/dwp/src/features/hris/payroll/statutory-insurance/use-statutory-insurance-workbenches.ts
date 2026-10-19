import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { HttpError, HttpTransportError } from '@dwp-frontend/shared-utils';

import {
  CountryPackActivationOutcomeUnknownError,
  statutoryInsuranceDataSource,
} from './statutory-insurance-api';
import {
  COUNTRY_PACK_ACTIVATE_ROUTE_CONTRACT_KEY,
  SOCIAL_INSURANCE_DATA_ROUTE_CONTRACT_KEY,
  SOCIAL_INSURANCE_PAGE_ROUTE_CONTRACT_KEY,
  STATUTORY_CONFIGURATION_DATA_ROUTE_CONTRACT_KEY,
  STATUTORY_CONFIGURATION_PAGE_ROUTE_CONTRACT_KEY,
  statutoryConfigurationItemIsSafeToActivate,
  validateCountryPackActivationRequest,
} from './statutory-insurance-contract';
import {
  validateSocialInsuranceQuery,
  validateStatutoryConfigurationQuery,
} from './statutory-insurance-query-contract';

import type { ProductSurfaceGovernedMutationAuthority } from '@dwp-frontend/shared-utils';
import type {
  CountryPackActivationAuthority,
  StatutoryInsuranceDataSource,
} from './statutory-insurance-api';
import type {
  CountryPackActivationCommand,
  CountryPackActivationRequest,
  PayrollCommandReceipt,
  SocialInsuranceItem,
  SocialInsuranceProjection,
  SocialInsuranceQuery,
  StatutoryConfigurationItem,
  StatutoryConfigurationProjection,
  StatutoryConfigurationQuery,
} from './statutory-insurance-contract';

export type StatutoryInsuranceScope = Readonly<{
  ready: boolean;
  tenantId: string;
  contextKey?: string;
  contextScopeKey?: string;
  decisionRevision: string;
}>;

export type CountryPackActivationCommandBinding = Readonly<{
  routeContractKey: typeof COUNTRY_PACK_ACTIVATE_ROUTE_CONTRACT_KEY;
  targetType: 'COUNTRY_PACK';
  targetId: string;
  expectedObjectVersion: number;
  idempotencyKey: string;
  correlationId: string;
  contextKey: string;
  contextScopeKey: string;
  decisionRevision: string;
  payload: CountryPackActivationCommand;
}>;

export type CountryPackActivationCommandExecutor = <T>(
  execute: (authority: ProductSurfaceGovernedMutationAuthority) => Promise<T>,
  binding: CountryPackActivationCommandBinding
) => Promise<T>;

export type StatutoryConfigurationOwnerBinding = Readonly<{
  page: Readonly<{
    routeContractKey: typeof STATUTORY_CONFIGURATION_PAGE_ROUTE_CONTRACT_KEY;
  }>;
  data?: Readonly<{
    contractId: 'IAQ-026';
    routeContractKey: typeof STATUTORY_CONFIGURATION_DATA_ROUTE_CONTRACT_KEY;
    read: StatutoryInsuranceDataSource['statutoryConfiguration'];
  }>;
  activate?: Readonly<{
    contractId: 'PEP-PAY-028';
    routeContractKey: typeof COUNTRY_PACK_ACTIVATE_ROUTE_CONTRACT_KEY;
    execute: CountryPackActivationCommandExecutor;
  }>;
}>;

export type SocialInsuranceOwnerBinding = Readonly<{
  page: Readonly<{
    routeContractKey: typeof SOCIAL_INSURANCE_PAGE_ROUTE_CONTRACT_KEY;
  }>;
  data?: Readonly<{
    contractId: 'IAQ-048';
    routeContractKey: typeof SOCIAL_INSURANCE_DATA_ROUTE_CONTRACT_KEY;
    read: StatutoryInsuranceDataSource['socialInsurance'];
  }>;
}>;

export type WorkbenchRuntimeState<T> =
  | Readonly<{ kind: 'CLOSED' | 'IDLE' | 'LOADING' | 'FORBIDDEN' | 'UNAVAILABLE' }>
  | Readonly<{
      kind: 'EMPTY' | 'PARTIAL' | 'STALE' | 'COMPLETE';
      projection: T;
      loadedAt: number;
    }>;

export type CountryPackActivationFeedback =
  | Readonly<{ kind: 'STEP_UP' }>
  | Readonly<{ kind: 'ACCEPTED' | 'SUCCEEDED'; receipt: PayrollCommandReceipt }>
  | Readonly<{ kind: 'RESULT_UNKNOWN'; receipt?: PayrollCommandReceipt }>
  | Readonly<{ kind: 'FORBIDDEN' | 'CONFLICT' | 'REJECTED' }>
  | Readonly<{ kind: 'INVALID'; message: string }>;

export type StatutoryConfigurationReviewRequest = Omit<
  StatutoryConfigurationQuery,
  'correlationId'
>;
export type SocialInsuranceReviewRequest = Omit<SocialInsuranceQuery, 'correlationId'>;

type PendingActivation = Readonly<{
  command: CountryPackActivationCommand;
  binding: CountryPackActivationCommandBinding;
  scopeIdentity: string;
  dispatched: boolean;
}>;

export type StatutoryConfigurationController = Readonly<{
  state: WorkbenchRuntimeState<StatutoryConfigurationProjection>;
  projection: StatutoryConfigurationProjection | null;
  selected: StatutoryConfigurationItem | null;
  select: (itemPublicId: string) => void;
  review: (request: StatutoryConfigurationReviewRequest) => Promise<void>;
  retryRead: () => Promise<void>;
  activate: (request: CountryPackActivationRequest) => Promise<void>;
  retryExactActivation: () => Promise<void>;
  activationAvailable: boolean;
  busy: boolean;
  feedback: CountryPackActivationFeedback | null;
  hasPendingExactRetry: boolean;
}>;

export type SocialInsuranceController = Readonly<{
  state: WorkbenchRuntimeState<SocialInsuranceProjection>;
  projection: SocialInsuranceProjection | null;
  selected: SocialInsuranceItem | null;
  select: (itemPublicId: string) => void;
  review: (request: SocialInsuranceReviewRequest) => Promise<void>;
  retryRead: () => Promise<void>;
}>;

type SharedOptions = Readonly<{
  scope: StatutoryInsuranceScope;
  dataSource?: StatutoryInsuranceDataSource;
  idFactory?: () => string;
  now?: () => number;
}>;

export type UseStatutoryConfigurationOptions = SharedOptions &
  Readonly<{ ownerBinding?: StatutoryConfigurationOwnerBinding }>;
export type UseSocialInsuranceOptions = SharedOptions &
  Readonly<{ ownerBinding?: SocialInsuranceOwnerBinding }>;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/u;

function secureId() {
  if (!globalThis.crypto?.randomUUID) {
    throw new Error('Secure PAY-003 identity generation is unavailable.');
  }
  return globalThis.crypto.randomUUID();
}

function denied(error: unknown) {
  return error instanceof HttpError && [401, 403, 404].includes(error.status);
}

function uncertain(error: unknown) {
  return (
    error instanceof CountryPackActivationOutcomeUnknownError ||
    error instanceof HttpTransportError ||
    (error instanceof HttpError &&
      (error.status === 408 || error.status === 429 || error.status >= 500))
  );
}

function runtimeState<T extends StatutoryConfigurationProjection | SocialInsuranceProjection>(
  projection: T,
  loadedAt: number
): WorkbenchRuntimeState<T> {
  if (projection.queryState.state === 'UNAVAILABLE') return { kind: 'UNAVAILABLE' };
  if (projection.queryState.state === 'EMPTY') return { kind: 'EMPTY', projection, loadedAt };
  if (projection.queryState.state === 'PARTIAL') return { kind: 'PARTIAL', projection, loadedAt };
  if (projection.queryState.freshness === 'STALE') return { kind: 'STALE', projection, loadedAt };
  return { kind: 'COMPLETE', projection, loadedAt };
}

function projectionFromState<T>(state: WorkbenchRuntimeState<T>): T | null {
  return 'projection' in state ? state.projection : null;
}

function exactSettingsReader(ownerBinding?: StatutoryConfigurationOwnerBinding) {
  return ownerBinding?.page.routeContractKey === STATUTORY_CONFIGURATION_PAGE_ROUTE_CONTRACT_KEY &&
    ownerBinding.data?.contractId === 'IAQ-026' &&
    ownerBinding.data.routeContractKey === STATUTORY_CONFIGURATION_DATA_ROUTE_CONTRACT_KEY
    ? ownerBinding.data.read
    : undefined;
}

function exactActivationExecutor(ownerBinding?: StatutoryConfigurationOwnerBinding) {
  return ownerBinding?.page.routeContractKey === STATUTORY_CONFIGURATION_PAGE_ROUTE_CONTRACT_KEY &&
    ownerBinding.activate?.contractId === 'PEP-PAY-028' &&
    ownerBinding.activate.routeContractKey === COUNTRY_PACK_ACTIVATE_ROUTE_CONTRACT_KEY
    ? ownerBinding.activate.execute
    : undefined;
}

function exactOperationsReader(ownerBinding?: SocialInsuranceOwnerBinding) {
  return ownerBinding?.page.routeContractKey === SOCIAL_INSURANCE_PAGE_ROUTE_CONTRACT_KEY &&
    ownerBinding.data?.contractId === 'IAQ-048' &&
    ownerBinding.data.routeContractKey === SOCIAL_INSURANCE_DATA_ROUTE_CONTRACT_KEY
    ? ownerBinding.data.read
    : undefined;
}

function commandAuthority(
  governance: ProductSurfaceGovernedMutationAuthority,
  binding: CountryPackActivationCommandBinding
): CountryPackActivationAuthority {
  if (
    governance.mode !== 'SECURE' ||
    !governance.stepUp ||
    !binding.contextKey.trim() ||
    governance.contextKey !== binding.contextKey ||
    governance.contextScopeKey !== binding.contextScopeKey ||
    governance.expectedDecisionRevision !== binding.decisionRevision ||
    governance.stepUp.decisionRevision !== binding.decisionRevision ||
    governance.objectVersion !== binding.expectedObjectVersion ||
    governance.idempotencyKey !== binding.idempotencyKey
  ) {
    throw new Error('Country-pack activation authority changed before dispatch.');
  }
  return Object.freeze({
    routeContractKey: binding.routeContractKey,
    governance,
    contextKey: binding.contextKey,
    contextScopeKey: binding.contextScopeKey,
    decisionRevision: binding.decisionRevision,
    idempotencyKey: binding.idempotencyKey,
    correlationId: binding.correlationId,
    expectedObjectVersion: binding.expectedObjectVersion,
  });
}

export function useStatutoryConfigurationWorkbench({
  scope,
  ownerBinding,
  dataSource = statutoryInsuranceDataSource,
  idFactory = secureId,
  now = Date.now,
}: UseStatutoryConfigurationOptions): StatutoryConfigurationController {
  const reader = exactSettingsReader(ownerBinding);
  const activationExecutor = exactActivationExecutor(ownerBinding);
  const scopeIdentity = JSON.stringify([
    scope.ready,
    scope.tenantId,
    scope.contextKey ?? '',
    scope.contextScopeKey ?? '',
    scope.decisionRevision,
    ownerBinding?.page.routeContractKey ?? '',
    ownerBinding?.data?.contractId ?? '',
    ownerBinding?.data?.routeContractKey ?? '',
    ownerBinding?.activate?.contractId ?? '',
    ownerBinding?.activate?.routeContractKey ?? '',
  ]);
  const currentScopeRef = useRef(scopeIdentity);
  currentScopeRef.current = scopeIdentity;
  const mountedRef = useRef(true);
  const activeReadRef = useRef<AbortController | null>(null);
  const busyRef = useRef(false);
  const pendingRef = useRef<PendingActivation | null>(null);
  const lastQueryRef = useRef<StatutoryConfigurationQuery | null>(null);
  const [state, setState] = useState<WorkbenchRuntimeState<StatutoryConfigurationProjection>>(() =>
    scope.ready && reader ? { kind: 'IDLE' } : { kind: 'CLOSED' }
  );
  const [stateScopeIdentity, setStateScopeIdentity] = useState(scopeIdentity);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<CountryPackActivationFeedback | null>(null);

  useEffect(() => {
    activeReadRef.current?.abort();
    activeReadRef.current = null;
    pendingRef.current = null;
    busyRef.current = false;
    lastQueryRef.current = null;
    setSelectedId(null);
    setBusy(false);
    setFeedback(null);
    setState(scope.ready && reader ? { kind: 'IDLE' } : { kind: 'CLOSED' });
    setStateScopeIdentity(scopeIdentity);
  }, [reader, scope.ready, scopeIdentity]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      activeReadRef.current?.abort();
    };
  }, []);

  const exposedState = useMemo<WorkbenchRuntimeState<StatutoryConfigurationProjection>>(
    () =>
      stateScopeIdentity === scopeIdentity
        ? state
        : scope.ready && reader
          ? { kind: 'IDLE' }
          : { kind: 'CLOSED' },
    [reader, scope.ready, scopeIdentity, state, stateScopeIdentity]
  );
  const projection = projectionFromState(exposedState);
  const selected =
    projection?.items.find((item) => item.itemPublicId === selectedId) ??
    projection?.items[0] ??
    null;

  const runRead = useCallback(
    async (query: StatutoryConfigurationQuery) => {
      if (!scope.ready || !scope.contextScopeKey || !scope.decisionRevision || !reader) return;
      activeReadRef.current?.abort();
      const abort = new AbortController();
      activeReadRef.current = abort;
      lastQueryRef.current = query;
      setFeedback(null);
      setState({ kind: 'LOADING' });
      try {
        const result = await reader(query, {
          routeContractKey: STATUTORY_CONFIGURATION_DATA_ROUTE_CONTRACT_KEY,
          contextScopeKey: scope.contextScopeKey,
          decisionRevision: scope.decisionRevision,
          signal: abort.signal,
        });
        if (
          !mountedRef.current ||
          abort.signal.aborted ||
          currentScopeRef.current !== scopeIdentity
        ) {
          return;
        }
        setState(runtimeState(result, now()));
        setSelectedId((current) =>
          result.items.some((item) => item.itemPublicId === current)
            ? current
            : (result.items[0]?.itemPublicId ?? null)
        );
      } catch (error) {
        if (
          !mountedRef.current ||
          abort.signal.aborted ||
          currentScopeRef.current !== scopeIdentity
        ) {
          return;
        }
        setSelectedId(null);
        setState({ kind: denied(error) ? 'FORBIDDEN' : 'UNAVAILABLE' });
      } finally {
        if (activeReadRef.current === abort) activeReadRef.current = null;
      }
    },
    [now, reader, scope.contextScopeKey, scope.decisionRevision, scope.ready, scopeIdentity]
  );

  const review = useCallback(
    async (request: StatutoryConfigurationReviewRequest) => {
      if (!scope.ready || !reader) return;
      try {
        const correlationId = idFactory();
        if (!UUID.test(correlationId)) throw new Error('identifier');
        await runRead(validateStatutoryConfigurationQuery({ ...request, correlationId }));
      } catch {
        setFeedback({ kind: 'INVALID', message: 'Enter valid statutory review filters.' });
      }
    },
    [idFactory, reader, runRead, scope.ready]
  );

  const retryRead = useCallback(async () => {
    const query = lastQueryRef.current;
    if (query) await runRead(query);
  }, [runRead]);

  const executeActivation = useCallback(
    async (pending: PendingActivation) => {
      if (
        busyRef.current ||
        !activationExecutor ||
        currentScopeRef.current !== pending.scopeIdentity
      ) {
        return;
      }
      busyRef.current = true;
      setBusy(true);
      setFeedback({ kind: 'STEP_UP' });
      let dispatched = pending.dispatched;
      try {
        const receipt = await activationExecutor((governance) => {
          if (currentScopeRef.current !== pending.scopeIdentity) {
            throw new Error('Country-pack activation scope changed before dispatch.');
          }
          dispatched = true;
          pendingRef.current = Object.freeze({ ...pending, dispatched: true });
          return dataSource.activateCountryPack(
            pending.command,
            commandAuthority(governance, pending.binding)
          );
        }, pending.binding);
        if (!mountedRef.current || currentScopeRef.current !== pending.scopeIdentity) return;
        pendingRef.current = null;
        setFeedback({ kind: receipt.status, receipt });
      } catch (error) {
        if (!mountedRef.current || currentScopeRef.current !== pending.scopeIdentity) return;
        if (dispatched && uncertain(error)) {
          pendingRef.current = Object.freeze({ ...pending, dispatched: true });
          setFeedback({ kind: 'RESULT_UNKNOWN' });
        } else if (denied(error)) {
          pendingRef.current = null;
          setFeedback({ kind: 'FORBIDDEN' });
        } else if (error instanceof HttpError && [409, 412].includes(error.status)) {
          pendingRef.current = null;
          setFeedback({ kind: 'CONFLICT' });
        } else {
          pendingRef.current = null;
          setFeedback({ kind: 'REJECTED' });
        }
      } finally {
        if (mountedRef.current && currentScopeRef.current === pending.scopeIdentity) {
          busyRef.current = false;
          setBusy(false);
        }
      }
    },
    [activationExecutor, dataSource]
  );

  const activate = useCallback(
    async (request: CountryPackActivationRequest) => {
      if (
        !projection ||
        !selected ||
        !scope.contextKey ||
        !scope.contextScopeKey ||
        !scope.decisionRevision ||
        !activationExecutor ||
        !statutoryConfigurationItemIsSafeToActivate(projection, selected)
      ) {
        setFeedback({ kind: 'INVALID', message: 'This country pack is not safe to activate.' });
        return;
      }
      try {
        const activation = selected.fieldGroups.ACTIVATION_STATUS;
        if (activation?.decision !== 'VIEW') throw new Error('activation');
        const command = Object.freeze({
          packId: selected.itemPublicId,
          expectedActivationRevision: activation.value.revision,
          idempotencyKey: idFactory(),
          correlationId: idFactory(),
          request: validateCountryPackActivationRequest(request),
        });
        if (!UUID.test(command.idempotencyKey) || !UUID.test(command.correlationId)) {
          throw new Error('identifier');
        }
        const binding: CountryPackActivationCommandBinding = Object.freeze({
          routeContractKey: COUNTRY_PACK_ACTIVATE_ROUTE_CONTRACT_KEY,
          targetType: 'COUNTRY_PACK',
          targetId: selected.itemPublicId,
          expectedObjectVersion: command.expectedActivationRevision,
          idempotencyKey: command.idempotencyKey,
          correlationId: command.correlationId,
          contextKey: scope.contextKey,
          contextScopeKey: scope.contextScopeKey,
          decisionRevision: scope.decisionRevision,
          payload: command,
        });
        const pending = Object.freeze({
          command,
          binding,
          scopeIdentity,
          dispatched: false,
        });
        pendingRef.current = pending;
        await executeActivation(pending);
      } catch {
        setFeedback({ kind: 'INVALID', message: 'Enter the exact approved activation evidence.' });
      }
    },
    [
      activationExecutor,
      executeActivation,
      idFactory,
      projection,
      scope.contextScopeKey,
      scope.contextKey,
      scope.decisionRevision,
      scopeIdentity,
      selected,
    ]
  );

  const retryExactActivation = useCallback(async () => {
    const pending = pendingRef.current;
    if (pending?.dispatched) await executeActivation(pending);
  }, [executeActivation]);

  return Object.freeze({
    state: exposedState,
    projection,
    selected,
    select: setSelectedId,
    review,
    retryRead,
    activate,
    retryExactActivation,
    activationAvailable: Boolean(
      projection &&
      selected &&
      activationExecutor &&
      statutoryConfigurationItemIsSafeToActivate(projection, selected)
    ),
    busy,
    feedback,
    hasPendingExactRetry: Boolean(pendingRef.current?.dispatched),
  });
}

export function useSocialInsuranceWorkbench({
  scope,
  ownerBinding,
  idFactory = secureId,
  now = Date.now,
}: UseSocialInsuranceOptions): SocialInsuranceController {
  const reader = exactOperationsReader(ownerBinding);
  const scopeIdentity = JSON.stringify([
    scope.ready,
    scope.tenantId,
    scope.contextKey ?? '',
    scope.contextScopeKey ?? '',
    scope.decisionRevision,
    ownerBinding?.page.routeContractKey ?? '',
    ownerBinding?.data?.contractId ?? '',
    ownerBinding?.data?.routeContractKey ?? '',
  ]);
  const currentScopeRef = useRef(scopeIdentity);
  currentScopeRef.current = scopeIdentity;
  const mountedRef = useRef(true);
  const activeReadRef = useRef<AbortController | null>(null);
  const lastQueryRef = useRef<SocialInsuranceQuery | null>(null);
  const [state, setState] = useState<WorkbenchRuntimeState<SocialInsuranceProjection>>(() =>
    scope.ready && reader ? { kind: 'IDLE' } : { kind: 'CLOSED' }
  );
  const [stateScopeIdentity, setStateScopeIdentity] = useState(scopeIdentity);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    activeReadRef.current?.abort();
    activeReadRef.current = null;
    lastQueryRef.current = null;
    setSelectedId(null);
    setState(scope.ready && reader ? { kind: 'IDLE' } : { kind: 'CLOSED' });
    setStateScopeIdentity(scopeIdentity);
  }, [reader, scope.ready, scopeIdentity]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      activeReadRef.current?.abort();
    };
  }, []);

  const exposedState = useMemo<WorkbenchRuntimeState<SocialInsuranceProjection>>(
    () =>
      stateScopeIdentity === scopeIdentity
        ? state
        : scope.ready && reader
          ? { kind: 'IDLE' }
          : { kind: 'CLOSED' },
    [reader, scope.ready, scopeIdentity, state, stateScopeIdentity]
  );
  const projection = projectionFromState(exposedState);
  const selected =
    projection?.items.find((item) => item.itemPublicId === selectedId) ??
    projection?.items[0] ??
    null;

  const runRead = useCallback(
    async (query: SocialInsuranceQuery) => {
      if (!scope.ready || !scope.contextScopeKey || !scope.decisionRevision || !reader) return;
      activeReadRef.current?.abort();
      const abort = new AbortController();
      activeReadRef.current = abort;
      lastQueryRef.current = query;
      setState({ kind: 'LOADING' });
      try {
        const result = await reader(query, {
          routeContractKey: SOCIAL_INSURANCE_DATA_ROUTE_CONTRACT_KEY,
          contextScopeKey: scope.contextScopeKey,
          decisionRevision: scope.decisionRevision,
          signal: abort.signal,
        });
        if (
          !mountedRef.current ||
          abort.signal.aborted ||
          currentScopeRef.current !== scopeIdentity
        ) {
          return;
        }
        setState(runtimeState(result, now()));
        setSelectedId((current) =>
          result.items.some((item) => item.itemPublicId === current)
            ? current
            : (result.items[0]?.itemPublicId ?? null)
        );
      } catch (error) {
        if (
          !mountedRef.current ||
          abort.signal.aborted ||
          currentScopeRef.current !== scopeIdentity
        ) {
          return;
        }
        setSelectedId(null);
        setState({ kind: denied(error) ? 'FORBIDDEN' : 'UNAVAILABLE' });
      } finally {
        if (activeReadRef.current === abort) activeReadRef.current = null;
      }
    },
    [now, reader, scope.contextScopeKey, scope.decisionRevision, scope.ready, scopeIdentity]
  );

  const review = useCallback(
    async (request: SocialInsuranceReviewRequest) => {
      if (!scope.ready || !reader) return;
      try {
        const correlationId = idFactory();
        if (!UUID.test(correlationId)) throw new Error('identifier');
        await runRead(validateSocialInsuranceQuery({ ...request, correlationId }));
      } catch {
        setState({ kind: 'UNAVAILABLE' });
      }
    },
    [idFactory, reader, runRead, scope.ready]
  );

  const retryRead = useCallback(async () => {
    const query = lastQueryRef.current;
    if (query) await runRead(query);
  }, [runRead]);

  return Object.freeze({
    state: exposedState,
    projection,
    selected,
    select: setSelectedId,
    review,
    retryRead,
  });
}

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { HttpError, useAuth, useProductSurfaceAuthority } from '@dwp-frontend/shared-utils';
import { productSurfaceServerNow } from '@dwp-frontend/shared-utils/auth/product-surface-authority-model';
import { PRODUCT_AUTHORIZATION_ROUTE_PROJECTIONS } from '../../routes/product-surface-authorization.generated';
import { useOptionalAllowedProductSurface } from '../../components/allowed-product-surface-context';
import { ApprovalWorkflowPlanningController } from './approval-workflow-planning-controller';
import { approvalWorkflowPlanningEntry } from './approval-workflow-planning-authority';
import { ApprovalTypedFormError } from './approval-form-typed-model';
import type { ApprovalWorkflowPlanningLoaded } from './approval-workflow-planning-controller';
import type { ApprovalWorkflowPlanningOwner } from './approval-workflow-planning-model';
import type { ApprovalWorkflowPlanningResult } from '@dwp-frontend/shared-utils/api/approval-workflow-planning-contract';
import type { ApprovalWorkflowPlanningSource } from './approval-workflow-planning-authority';

type State = Readonly<{
  identity: string;
  pending: boolean;
  loaded?: ApprovalWorkflowPlanningLoaded;
  error?: Error;
  blocked?: 'DENIED' | 'UNAVAILABLE';
  preview?: Readonly<{
    result: ApprovalWorkflowPlanningResult;
    snapshot: ApprovalWorkflowPlanningSource['snapshot'];
    expiresAt: number;
  }>;
}>;
function failedState(
  identity: string,
  error: unknown,
  loaded?: ApprovalWorkflowPlanningLoaded,
  editableValidation = false
): State {
  const blocked =
    editableValidation && error instanceof ApprovalTypedFormError
      ? undefined
      : error instanceof HttpError && [403, 404].includes(error.status)
        ? 'DENIED'
        : 'UNAVAILABLE';
  return {
    identity,
    pending: false,
    blocked,
    loaded: blocked === 'DENIED' ? undefined : loaded,
    error: error instanceof Error ? error : new Error('Planning source unavailable'),
  };
}
export function useApprovalWorkflowPlanning(owner: ApprovalWorkflowPlanningOwner) {
  const auth = useAuth();
  const authority = useProductSurfaceAuthority();
  const page = useOptionalAllowedProductSurface();
  const identity = JSON.stringify([
    auth.user?.tenantId,
    auth.user?.userId,
    owner.workflowId,
    owner.workflowRevision,
    owner.workflowSha256,
    authority.snapshot?.envelope.decisionRevision,
    page?.context.contextKey,
    page?.scope.key,
    authority.snapshot?.envelope.activeAccessMode,
  ]);
  const controller = useRef(new ApprovalWorkflowPlanningController()).current;
  const generation = useRef({ identity, epoch: 0, snapshot: authority.snapshot });
  if (
    generation.current.identity !== identity ||
    generation.current.snapshot !== authority.snapshot
  ) {
    generation.current = {
      identity,
      epoch: generation.current.epoch + 1,
      snapshot: authority.snapshot,
    };
    controller.cancel();
  }
  const [state, setState] = useState<State>({ identity, pending: false });
  const [values, setValues] = useState<{
    identity: string;
    formId?: string;
    value: Readonly<Record<string, unknown>>;
  }>({ identity, value: {} });
  const currentState = useRef(state);
  currentState.current = state;
  const currentValues = useRef(values);
  currentValues.current = values;
  const source: ApprovalWorkflowPlanningSource = {
    ready:
      authority.status === 'ready' &&
      page?.context.productKey === 'approvals' &&
      page.context.surfaceKey === 'approvals.admin',
    tenantId: String(auth.user?.tenantId ?? ''),
    actorId: String(auth.user?.userId ?? ''),
    epoch: generation.current.epoch,
    snapshot: authority.snapshot,
    contextKey: page?.context.contextKey,
    contextScopeKey: page?.scope.key,
    projections: PRODUCT_AUTHORIZATION_ROUTE_PROJECTIONS,
  };
  const live = useRef({ owner, source, authority });
  live.current = { owner, source, authority };
  const mounted = useRef(true);
  const currentSource = useCallback(
    () => ({
      ...live.current.source,
      ready: mounted.current && live.current.source.ready,
      epoch: generation.current.epoch,
    }),
    []
  );
  const available = Boolean(approvalWorkflowPlanningEntry(currentSource()));
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setTick((value) => value + 1), 1000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      generation.current.epoch += 1;
      controller.cancel();
    };
  }, [controller]);
  const stateCurrent =
    state.identity === identity &&
    available &&
    state.loaded?.snapshot === source.snapshot &&
    Boolean(
      state.loaded &&
      source.snapshot &&
      productSurfaceServerNow(source.snapshot) < state.loaded.expiresAt
    );
  const loaded = stateCurrent && state.blocked !== 'DENIED' ? state.loaded : undefined;
  const readOnly = !loaded || Boolean(state.blocked) || state.pending;
  const raw = useMemo(() => (values.identity === identity ? values.value : {}), [values, identity]);
  const load = useCallback(
    async (formId?: string) => {
      if (controller.busy || !approvalWorkflowPlanningEntry(currentSource())) return;
      if (
        formId &&
        (currentState.current.identity !== identity ||
          !currentState.current.loaded?.selection.forms.some((form) => form.formId === formId))
      ) {
        setState({
          identity,
          pending: false,
          error: new Error('Published planning form choice unavailable'),
        });
        return;
      }
      const epoch = generation.current.epoch;
      const previous =
        currentState.current.identity === identity ? currentState.current.loaded : undefined;
      setState({ identity, pending: true, loaded: previous });
      const original = currentValues.current;
      if (original.identity !== identity || (formId && formId !== original.formId))
        setValues({ identity, formId, value: {} });
      try {
        const result = await controller.load(live.current.owner, formId, {
          source: currentSource,
          owner: () => (mounted.current ? live.current.owner : undefined),
          evaluate: (request, options) => live.current.authority.evaluateProduct(request, options),
        });
        if (mounted.current && epoch === generation.current.epoch)
          setState({ identity, pending: false, loaded: result });
      } catch (error) {
        if (mounted.current && epoch === generation.current.epoch)
          setState(failedState(identity, error, previous));
      }
    },
    [controller, currentSource, identity]
  );
  useEffect(() => {
    if (available && !(currentState.current.identity === identity && currentState.current.blocked))
      void load();
    else if (!available) controller.cancel();
  }, [available, source.snapshot, identity, load, controller]);
  const preview = useCallback(async () => {
    if (controller.busy || !loaded || readOnly) return;
    const epoch = generation.current.epoch;
    setState({ identity, pending: true, loaded });
    try {
      const result = await controller.preview(live.current.owner, loaded, raw, {
        source: currentSource,
        owner: () => (mounted.current ? live.current.owner : undefined),
        evaluate: (request, options) => live.current.authority.evaluateProduct(request, options),
      });
      if (mounted.current && epoch === generation.current.epoch)
        setState({ identity, pending: false, loaded, preview: result });
    } catch (error) {
      if (mounted.current && epoch === generation.current.epoch)
        setState(failedState(identity, error, loaded, true));
    }
  }, [controller, loaded, readOnly, raw, identity, currentSource]);
  void tick;
  return {
    available,
    loaded,
    readOnly,
    values: raw,
    pending: state.identity === identity && state.pending,
    error: state.identity === identity && available ? state.error : undefined,
    result:
      stateCurrent &&
      !state.blocked &&
      state.preview &&
      source.snapshot &&
      state.preview.snapshot === source.snapshot &&
      productSurfaceServerNow(source.snapshot) < state.preview.expiresAt
        ? state.preview.result
        : undefined,
    load,
    preview,
    change: (key: string, value: unknown) => {
      if (readOnly) return;
      controller.cancel();
      generation.current.epoch += 1;
      setValues({ identity, formId: values.formId, value: { ...raw, [key]: value } });
      setState({ identity, pending: false, loaded });
    },
  };
}

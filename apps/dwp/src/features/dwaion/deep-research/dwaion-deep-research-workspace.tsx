import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { resolveSupportedLocale } from '@dwp-frontend/shared-i18n';
import {
  commandDwaionResearchRun,
  createDwaionResearchDelivery,
  createDwaionResearchPlan,
  downloadDwaionResearchRun,
  executeDwaionResearchRun,
  getDwaionResearchDelivery,
  getDwaionResearchDeliveries,
  getDwaionResearchCapabilities,
  getDwaionResearchPlan,
  getDwaionResearchRun,
  newDwaionCommandAttempt,
  startDwaionResearchRun,
  updateDwaionResearchPlan,
  type DwaionCommandAttempt,
  type DwaionResearchCommand,
  type DwaionResearchCapabilities,
  type DwaionResearchDelivery,
  type DwaionResearchDeliveryType,
  type DwaionResearchDownloadKind,
  type DwaionResearchPlan,
  type DwaionResearchRun,
} from '@dwp-frontend/shared-utils';

import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';

import { useDwaionGovernedMutation } from '../../../components/use-dwaion-governed-mutation';
import { deepResearchCopy } from './dwaion-deep-research-copy';
import {
  createDwaionResearchDraft,
  dwaionResearchDefinition,
  dwaionResearchDraftFromDefinition,
  dwaionResearchRunNeedsPolling,
  validateDwaionResearchDraft,
  type DwaionResearchDraftError,
} from './dwaion-deep-research-model';
import { DwaionDeepResearchPlanner } from './dwaion-deep-research-planner';
import { DwaionDeepResearchRun } from './dwaion-deep-research-run';

const DELIVERY_TERMINAL = new Set(['COMPLETED', 'FAILED', 'CANCELLED']);

export function DwaionDeepResearchWorkspace({ onExit }: { onExit: () => void }) {
  const { i18n } = useTranslation('work');
  const locale = resolveSupportedLocale(i18n.resolvedLanguage, i18n.language);
  const copy = deepResearchCopy(locale);
  const [searchParams, setSearchParams] = useSearchParams();
  const planId = searchParams.get('researchPlan');
  const runId = searchParams.get('researchRun');
  const [draft, setDraft] = useState(createDwaionResearchDraft);
  const [draftError, setDraftError] = useState<DwaionResearchDraftError | null>(null);
  const [plan, setPlan] = useState<DwaionResearchPlan | null>(null);
  const [dirty, setDirty] = useState(false);
  const [run, setRun] = useState<DwaionResearchRun | null>(null);
  const [capabilities, setCapabilities] = useState<DwaionResearchCapabilities | null>(null);
  const [deliveries, setDeliveries] = useState<DwaionResearchDelivery[]>([]);
  const [loading, setLoading] = useState(Boolean(planId || runId));
  const [busy, setBusy] = useState<string | null>(null);
  const [operationError, setOperationError] = useState(false);
  const saveCommandId = useRef<string | null>(null);
  const startAttempt = useRef<DwaionCommandAttempt | null>(null);
  const commandIds = useRef(new Map<string, string>());
  const deliveryAttempts = useRef(new Map<DwaionResearchDeliveryType, DwaionCommandAttempt>());
  const governPlanCreate = useDwaionGovernedMutation(
    'route.dwaion.work.research-plan-create.action'
  );
  const governPlanUpdate = useDwaionGovernedMutation(
    'route.dwaion.work.research-plan-update.action'
  );
  const governRunStart = useDwaionGovernedMutation('route.dwaion.work.research-run-start.action');
  const governRunExecute = useDwaionGovernedMutation(
    'route.dwaion.work.research-run-execute.action'
  );
  const governRunCommand = useDwaionGovernedMutation(
    'route.dwaion.work.research-run-command.action'
  );
  const governOutput = useDwaionGovernedMutation('route.dwaion.work.research-output.action');

  useEffect(() => {
    const controller = new AbortController();
    void getDwaionResearchCapabilities(controller.signal)
      .then((value) => setCapabilities(value))
      .catch(() => setOperationError(true));
    return () => controller.abort();
  }, []);

  const setIds = useCallback(
    (nextPlanId?: string | null, nextRunId?: string | null) => {
      const next = new URLSearchParams(searchParams);
      if (nextPlanId) next.set('researchPlan', nextPlanId);
      else next.delete('researchPlan');
      if (nextRunId) next.set('researchRun', nextRunId);
      else next.delete('researchRun');
      next.set('mode', 'research');
      setSearchParams(next, { replace: true });
    },
    [searchParams, setSearchParams]
  );

  const refreshRun = useCallback(async () => {
    const target = run?.runId ?? runId;
    if (!target) return;
    try {
      const next = await getDwaionResearchRun(target);
      setRun(next);
      setOperationError(false);
    } catch {
      setOperationError(true);
    }
  }, [run?.runId, runId]);

  useEffect(() => {
    if (!planId && !runId) {
      setLoading(false);
      return;
    }
    const controller = new AbortController();
    setLoading(true);
    Promise.all([
      planId ? getDwaionResearchPlan(planId, controller.signal) : Promise.resolve(null),
      runId ? getDwaionResearchRun(runId, controller.signal) : Promise.resolve(null),
      runId ? getDwaionResearchDeliveries(runId, controller.signal) : Promise.resolve([]),
    ])
      .then(([loadedPlan, loadedRun, loadedDeliveries]) => {
        if (controller.signal.aborted) return;
        if (loadedPlan) {
          setPlan(loadedPlan);
          setDirty(false);
          setDraft(dwaionResearchDraftFromDefinition(loadedPlan.definition));
        }
        if (loadedRun) setRun(loadedRun);
        setDeliveries(loadedDeliveries);
        setOperationError(false);
      })
      .catch(() => {
        if (!controller.signal.aborted) setOperationError(true);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [planId, runId]);

  useEffect(() => {
    if (!run || !dwaionResearchRunNeedsPolling(run.state)) return undefined;
    const timer = globalThis.setInterval(() => void refreshRun(), 2_500);
    return () => globalThis.clearInterval(timer);
  }, [refreshRun, run]);

  useEffect(() => {
    const pending = deliveries.filter((delivery) => !DELIVERY_TERMINAL.has(delivery.state));
    if (!run || !pending.length) return undefined;
    const timer = globalThis.setInterval(() => {
      void Promise.allSettled(
        pending.map((delivery) => getDwaionResearchDelivery(run.runId, delivery.deliveryId))
      ).then((results) => {
        const refreshed = results
          .filter(
            (result): result is PromiseFulfilledResult<DwaionResearchDelivery> =>
              result.status === 'fulfilled'
          )
          .map((result) => result.value);
        if (!refreshed.length) return;
        const byId = new Map(refreshed.map((delivery) => [delivery.deliveryId, delivery]));
        setDeliveries((current) =>
          current.map((delivery) => byId.get(delivery.deliveryId) ?? delivery)
        );
      });
    }, 3_000);
    return () => globalThis.clearInterval(timer);
  }, [deliveries, run]);

  const save = async () => {
    const error = validateDwaionResearchDraft(draft);
    setDraftError(error);
    if (error) return;
    if (!saveCommandId.current) saveCommandId.current = globalThis.crypto.randomUUID();
    setBusy('SAVE');
    setOperationError(false);
    try {
      const definition = dwaionResearchDefinition(draft);
      const saved = plan
        ? await governPlanUpdate((authority) =>
            updateDwaionResearchPlan(
              plan.planId,
              plan.revision,
              definition,
              saveCommandId.current!,
              authority
            )
          )
        : await governPlanCreate((authority) =>
            createDwaionResearchPlan(definition, saveCommandId.current!, authority)
          );
      saveCommandId.current = null;
      startAttempt.current = null;
      setPlan(saved);
      setDirty(false);
      setDraft(dwaionResearchDraftFromDefinition(saved.definition));
      setIds(saved.planId, null);
    } catch {
      setOperationError(true);
    } finally {
      setBusy(null);
    }
  };

  const start = async () => {
    if (!plan || dirty || plan.state !== 'READY') return;
    if (!startAttempt.current) startAttempt.current = newDwaionCommandAttempt();
    setBusy('START');
    setOperationError(false);
    try {
      const started = await governRunStart((authority) =>
        startDwaionResearchRun(plan.planId, plan.revision, startAttempt.current!, authority)
      );
      startAttempt.current = null;
      setRun(started);
      setIds(plan.planId, started.runId);
      const executed = await execute(started);
      setRun(executed);
    } catch {
      setOperationError(true);
    } finally {
      setBusy(null);
    }
  };

  const execute = async (target: DwaionResearchRun) => {
    const key = `${target.runId}:${target.version}:EXECUTE`;
    const commandId = commandIds.current.get(key) ?? globalThis.crypto.randomUUID();
    commandIds.current.set(key, commandId);
    const executed = await governRunExecute((authority) =>
      executeDwaionResearchRun(target.runId, target.version, commandId, authority)
    );
    commandIds.current.delete(key);
    return executed;
  };

  const executeQueued = async () => {
    if (!run || run.state !== 'QUEUED') return;
    setBusy('EXECUTE');
    setOperationError(false);
    try {
      setRun(await execute(run));
    } catch {
      setOperationError(true);
    } finally {
      setBusy(null);
    }
  };

  const command = async (action: DwaionResearchCommand, sourceKey?: string) => {
    if (!run) return;
    const key = `${run.runId}:${run.version}:${action}:${sourceKey ?? ''}`;
    const commandId = commandIds.current.get(key) ?? globalThis.crypto.randomUUID();
    commandIds.current.set(key, commandId);
    setBusy(action);
    setOperationError(false);
    try {
      const updated = await governRunCommand((authority) =>
        commandDwaionResearchRun(
          run.runId,
          run.version,
          action,
          {
            commandId,
            reason: commandReason(action, locale, sourceKey),
            sourceKey,
            extensionMinutes: action === 'EXTEND' ? 15 : undefined,
          },
          authority
        )
      );
      commandIds.current.delete(key);
      setRun(updated);
    } catch {
      setOperationError(true);
    } finally {
      setBusy(null);
    }
  };

  const deliver = async (type: DwaionResearchDeliveryType) => {
    if (!run || run.state !== 'COMPLETED') return;
    const attempt = deliveryAttempts.current.get(type) ?? newDwaionCommandAttempt();
    deliveryAttempts.current.set(type, attempt);
    setBusy(`DELIVER_${type}`);
    setOperationError(false);
    try {
      const delivery = await governOutput((authority) =>
        createDwaionResearchDelivery(run.runId, run.version, type, attempt, { locale }, authority)
      );
      deliveryAttempts.current.delete(type);
      setDeliveries((current) => [
        ...current.filter((item) => item.deliveryId !== delivery.deliveryId),
        delivery,
      ]);
    } catch {
      setOperationError(true);
    } finally {
      setBusy(null);
    }
  };

  const download = async (kind: DwaionResearchDownloadKind) => {
    if (!run || run.state !== 'COMPLETED') return;
    setBusy(`DOWNLOAD_${kind.toUpperCase()}`);
    setOperationError(false);
    try {
      const blob = await downloadDwaionResearchRun(run.runId, kind);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `dwaion-research-${kind}-${run.runId}.${kind === 'audit' ? 'jsonl' : 'json'}`;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch {
      setOperationError(true);
    } finally {
      setBusy(null);
    }
  };

  if (loading)
    return (
      <Box sx={{ minHeight: 320, display: 'grid', placeItems: 'center' }}>
        <CircularProgress aria-label={copy.loading} />
      </Box>
    );
  if (run)
    return (
      <DwaionDeepResearchRun
        locale={locale}
        plan={plan}
        run={run}
        capabilities={capabilities}
        deliveries={deliveries}
        busy={busy}
        operationError={operationError}
        onRefresh={() => void refreshRun()}
        onExecute={() => void executeQueued()}
        onCommand={(action, source) => void command(action, source)}
        onDeliver={(type) => void deliver(type)}
        onDownload={(kind) => void download(kind)}
        onExit={onExit}
      />
    );
  return (
    <DwaionDeepResearchPlanner
      locale={locale}
      draft={draft}
      plan={plan}
      dirty={dirty}
      busy={busy === 'SAVE' || busy === 'START' ? busy : null}
      error={draftError}
      operationError={operationError}
      onChange={(next) => {
        setDraft(next);
        setDraftError(null);
        if (plan) setDirty(true);
      }}
      onSave={() => void save()}
      onStart={() => void start()}
      onReset={() => {
        setDraft(createDwaionResearchDraft());
        setPlan(null);
        setDirty(false);
        setDraftError(null);
        setOperationError(false);
        saveCommandId.current = null;
        startAttempt.current = null;
        setIds(null, null);
      }}
      onExit={onExit}
    />
  );
}

function commandReason(
  action: DwaionResearchCommand,
  locale: 'ko' | 'en',
  sourceKey?: string
): string {
  const source = sourceKey ? ` (${sourceKey})` : '';
  if (locale === 'ko') {
    const reasons: Record<DwaionResearchCommand, string> = {
      PAUSE: '사용자가 현재 조사 진행률과 근거 상태를 검토한 뒤 일시 중지를 요청했습니다.',
      RESUME: '사용자가 중지된 조사 상태와 남은 한도를 검토한 뒤 재개를 요청했습니다.',
      EXCLUDE_SOURCE_AND_CONTINUE: `사용자가 접근 실패 소스${source}와 부분 결과 영향을 검토한 뒤 제외 진행을 요청했습니다.`,
      REPROBE_SOURCE: `사용자가 접근 실패 소스${source}의 권한을 다시 확인하도록 요청했습니다.`,
      SAFE_CANCEL: '사용자가 현재 진행 상태를 검토한 뒤 안전 취소와 중간 결과 보존을 요청했습니다.',
      EXTEND: '사용자가 현재 진행률과 잔여 작업을 검토한 뒤 실행 한도 15분 연장을 요청했습니다.',
    };
    return reasons[action];
  }
  const reasons: Record<DwaionResearchCommand, string> = {
    PAUSE: 'The user reviewed current progress and evidence status, then requested a pause.',
    RESUME: 'The user reviewed the paused state and remaining limits, then requested resume.',
    EXCLUDE_SOURCE_AND_CONTINUE: `The user reviewed the failed source${source} and partial-result impact, then requested exclusion and continuation.`,
    REPROBE_SOURCE: `The user requested a new permission probe for the failed source${source}.`,
    SAFE_CANCEL:
      'The user reviewed current progress, then requested safe cancellation with partial-result preservation.',
    EXTEND:
      'The user reviewed progress and remaining work, then requested a 15-minute limit extension.',
  };
  return reasons[action];
}

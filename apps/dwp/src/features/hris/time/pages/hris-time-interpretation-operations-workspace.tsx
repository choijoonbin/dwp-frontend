import { useCallback, useMemo, useState } from 'react';
import {
  ActionButton,
  DatePickerField,
  FormField,
  InlineFeedback,
} from '@dwp-frontend/design-system';
import { resolveSupportedLocale } from '@dwp-frontend/shared-i18n';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { useTranslation } from 'react-i18next';

import { useProductActionMutation } from '../../../../components/use-product-action-mutation';
import { useProductSurfaceRequestScope } from '../../../../components/use-product-surface-request-scope';
import {
  assertTimeInterpretationRunRequest,
  createTimeInterpretationDataSource,
} from '../interpretation/api/time-interpretation-api';
import { TimeInterpretationWorkbenchRuntime } from '../interpretation/pages/time-interpretation-workbench';
import { workPlanOperationsToday } from '../model/hris-time-work-plan-operations-scope';

import type { ProductActionRouteContractKey } from '../../../../components/use-product-action-mutation';
import type {
  TimeInterpretationOwnerBinding,
  TimeInterpretationRunRequest,
  TimeInterpretationScope,
} from '../interpretation';

export const HRIS_TIME_INTERPRETATION_RUN_ACTION_CONTRACT =
  'route.hcm.operations.time-interpretation-run.action' as const satisfies ProductActionRouteContractKey;

const productionDataSource = createTimeInterpretationDataSource();
const WORKER_SEPARATOR = /[\s,]+/u;

type RunDraft = Readonly<{
  workerIds: string;
  periodStart: string;
  periodEnd: string;
}>;

export function buildTimeInterpretationRunRequest(
  draft: RunDraft,
  asOf = new Date().toISOString()
): TimeInterpretationRunRequest {
  const request: TimeInterpretationRunRequest = Object.freeze({
    workerIds: Object.freeze(
      draft.workerIds
        .split(WORKER_SEPARATOR)
        .map((value) => value.trim())
        .filter(Boolean)
    ),
    periodStart: draft.periodStart.trim(),
    periodEnd: draft.periodEnd.trim(),
    asOf,
  });
  assertTimeInterpretationRunRequest(request);
  return request;
}

function localTimeZone() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
}

/**
 * Control-owned production adapter for the canonical TIM interpretation PAGE. The owner readers
 * and ACTION executor retain their exact generated contracts; an adjacent time grant is never
 * substituted when the PAGE or ACTION projection is unavailable.
 */
export function HrisTimeInterpretationOperationsWorkspace() {
  const { i18n } = useTranslation('hcm');
  const requestScope = useProductSurfaceRequestScope({
    productKey: 'hcm',
    surfaceKey: 'hcm.operations',
  });
  const runMutation = useProductActionMutation(HRIS_TIME_INTERPRETATION_RUN_ACTION_CONTRACT);
  const timeZone = localTimeZone();
  const today = useMemo(() => workPlanOperationsToday(timeZone), [timeZone]);
  const [draft, setDraft] = useState<RunDraft>({
    workerIds: '',
    periodStart: today,
    periodEnd: today,
  });
  const [runRequest, setRunRequest] = useState<TimeInterpretationRunRequest>();
  const [draftError, setDraftError] = useState(false);
  const scopeIdentity =
    requestScope.contextScopeKey && requestScope.queryMeta.decisionRevision
      ? `${requestScope.contextScopeKey}\u0000${requestScope.queryMeta.decisionRevision}`
      : '';
  const correlationId = useMemo(
    () => (scopeIdentity ? (globalThis.crypto?.randomUUID?.() ?? '') : ''),
    [scopeIdentity]
  );
  const locale = resolveSupportedLocale(i18n.resolvedLanguage, i18n.language);
  const scope = useMemo<TimeInterpretationScope>(
    () => ({
      ready:
        requestScope.ready &&
        Boolean(requestScope.contextScopeKey) &&
        Boolean(requestScope.queryMeta.decisionRevision) &&
        Boolean(correlationId),
      contextScopeKey: requestScope.contextScopeKey ?? '',
      decisionRevision: requestScope.queryMeta.decisionRevision,
      locale,
      timeZone,
      correlationId,
    }),
    [
      correlationId,
      locale,
      requestScope.contextScopeKey,
      requestScope.queryMeta.decisionRevision,
      requestScope.ready,
      timeZone,
    ]
  );
  const ownerBinding = useMemo<TimeInterpretationOwnerBinding>(
    () => ({
      page: { contractId: 'IAQ-041', read: productionDataSource.read },
      trace: { contractId: 'PEP-TIM-010', read: productionDataSource.trace },
      run: {
        contractId: 'PEP-TIM-009',
        actionKey: 'hris.action.tim.interpretation.run',
        execute: (execute) => runMutation(execute),
      },
    }),
    [runMutation]
  );
  const updateDraft = useCallback((patch: Partial<RunDraft>) => {
    setDraft((current) => ({ ...current, ...patch }));
    setRunRequest(undefined);
    setDraftError(false);
  }, []);
  const prepareRun = useCallback(() => {
    try {
      setRunRequest(buildTimeInterpretationRunRequest(draft));
      setDraftError(false);
    } catch {
      setRunRequest(undefined);
      setDraftError(true);
    }
  }, [draft]);

  return (
    <Stack gap={3} data-testid="hris-time-interpretation-operations-workspace">
      <Paper component="section" variant="outlined" sx={{ p: { xs: 2, md: 3 } }}>
        <Stack gap={2}>
          <Box>
            <Typography component="h2" variant="h6">
              Interpretation run scope
            </Typography>
            <Typography color="text.secondary">
              Enter the exact worker population and civil-date period before enabling the governed
              run command.
            </Typography>
          </Box>
          <FormField
            label="Worker public IDs"
            value={draft.workerIds}
            onChange={(event) => updateDraft({ workerIds: event.target.value })}
            supportingText="Separate UUIDs with commas, spaces, or new lines. Duplicate IDs are rejected."
            multiline
            minRows={2}
            fullWidth
            inputProps={{ spellCheck: false }}
          />
          <Stack direction={{ xs: 'column', sm: 'row' }} gap={2}>
            <DatePickerField
              label="Period start"
              value={draft.periodStart}
              onValueChange={(value) => updateDraft({ periodStart: value ?? '' })}
              fullWidth
            />
            <DatePickerField
              label="Period end"
              value={draft.periodEnd}
              onValueChange={(value) => updateDraft({ periodEnd: value ?? '' })}
              fullWidth
            />
          </Stack>
          {draftError && (
            <InlineFeedback severity="error" title="Run scope is invalid">
              Use unique worker UUIDs and a valid date range of period start through period end.
            </InlineFeedback>
          )}
          {runRequest && (
            <InlineFeedback severity="success" title="Run scope is prepared">
              The governed command is enabled only when the selected result also advertises the
              exact TIM interpretation action.
            </InlineFeedback>
          )}
          <Box>
            <ActionButton intent="secondary" onClick={prepareRun}>
              Prepare exact run
            </ActionButton>
          </Box>
        </Stack>
      </Paper>
      <TimeInterpretationWorkbenchRuntime
        scope={scope}
        ownerBinding={ownerBinding}
        runRequest={runRequest}
        dataSource={productionDataSource}
      />
    </Stack>
  );
}

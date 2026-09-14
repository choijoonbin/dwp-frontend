import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { resolveSupportedLocale } from '@dwp-frontend/shared-i18n';
import {
  ActionButton,
  AutocompleteField,
  DateTimePickerField,
  FormDialog,
  FormField,
  InlineFeedback,
  SelectField,
} from '@dwp-frontend/design-system';
import {
  getPublishedApprovalWorkflows,
  searchApprovalDelegationCandidates,
} from '@dwp-frontend/shared-utils';

import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';

import {
  buildApprovalDelegationCreateInput,
  buildApprovalDelegationWorkflowOptions,
  isApprovalDelegationPeriodValid,
} from './approval-delegation-model';

import type {
  ApprovalDelegationCandidate,
  ApprovalDelegationCreateInput,
} from '@dwp-frontend/shared-utils';
import type { ProductSurfaceRequestScope } from '../../components/use-product-surface-request-scope';

type ApprovalDelegationEditorProps = {
  open: boolean;
  busy: boolean;
  sourceReady: boolean;
  requestScope: ProductSurfaceRequestScope;
  recoveryMessage?: string;
  onClose: () => void;
  onSubmit: (input: ApprovalDelegationCreateInput) => void;
  onRecover: () => void;
};

export function ApprovalDelegationEditor({
  open,
  busy,
  sourceReady,
  requestScope,
  recoveryMessage,
  onClose,
  onSubmit,
  onRecover,
}: ApprovalDelegationEditorProps) {
  const { t, i18n } = useTranslation('approvals');
  const locale = resolveSupportedLocale(i18n.resolvedLanguage, i18n.language);
  const [candidateQuery, setCandidateQuery] = useState('');
  const [selected, setSelected] = useState<ApprovalDelegationCandidate | null>(null);
  const [scopeType, setScopeType] = useState<'ALL' | 'WORKFLOW'>('ALL');
  const [workflowId, setWorkflowId] = useState('');
  const [reason, setReason] = useState('');
  const [startsAt, setStartsAt] = useState(() => new Date().toISOString());
  const [endsAt, setEndsAt] = useState(() => new Date(Date.now() + 7 * 86_400_000).toISOString());
  const deferredCandidateQuery = useDeferredValue(candidateQuery.trim());

  const candidates = useQuery({
    queryKey: [
      'approvals',
      ...requestScope.cacheKey,
      'delegations',
      'candidates',
      deferredCandidateQuery,
    ],
    queryFn: ({ signal }) =>
      searchApprovalDelegationCandidates(
        deferredCandidateQuery,
        10,
        requestScope.contextScopeKey,
        signal
      ),
    enabled: open && requestScope.ready && deferredCandidateQuery.length >= 2,
    meta: requestScope.queryMeta,
    staleTime: 30_000,
    retry: false,
  });
  const workflows = useQuery({
    queryKey: ['approvals', ...requestScope.cacheKey, 'workflows', 'published'],
    queryFn: ({ signal }) => getPublishedApprovalWorkflows(requestScope.contextScopeKey, signal),
    enabled: open && requestScope.ready,
    meta: requestScope.queryMeta,
    staleTime: 60_000,
    retry: false,
  });

  useEffect(() => {
    if (open) return;
    setCandidateQuery('');
    setSelected(null);
    setScopeType('ALL');
    setWorkflowId('');
    setReason('');
  }, [open]);

  const workflowOptions = useMemo(
    () => buildApprovalDelegationWorkflowOptions(workflows.data ?? [], locale),
    [locale, workflows.data]
  );
  const selectedWorkflowAvailable = workflowOptions.some((option) => option.value === workflowId);
  const input = selected
    ? buildApprovalDelegationCreateInput({
        delegateUserId: selected.userId,
        scopeType,
        workflowId,
        startsAt,
        endsAt,
        reason: reason.trim(),
      })
    : null;
  const valid =
    sourceReady &&
    !busy &&
    !recoveryMessage &&
    selected !== null &&
    !candidates.isError &&
    reason.trim().length >= 10 &&
    isApprovalDelegationPeriodValid(startsAt, endsAt) &&
    (scopeType === 'ALL' ||
      (!workflows.isFetching && !workflows.isError && selectedWorkflowAvailable));

  return (
    <FormDialog
      open={open}
      title={t('delegations.dialog.title')}
      description={t('delegations.dialog.description')}
      cancelLabel={t('actions.cancel')}
      submitLabel={t('actions.save')}
      busy={busy}
      submitDisabled={!valid || !input}
      onClose={onClose}
      onSubmit={() => {
        if (valid && input) onSubmit(input);
      }}
    >
      <Stack gap={2}>
        {recoveryMessage && (
          <InlineFeedback
            severity="error"
            action={
              <ActionButton type="button" intent="quiet" size="small" onClick={onRecover}>
                {t('actions.refresh')}
              </ActionButton>
            }
          >
            {recoveryMessage}
          </InlineFeedback>
        )}
        {candidates.isError && deferredCandidateQuery.length >= 2 && (
          <InlineFeedback
            severity="error"
            action={
              <ActionButton
                type="button"
                intent="quiet"
                size="small"
                disabled={candidates.isFetching}
                onClick={() => void candidates.refetch()}
              >
                {t('actions.retry')}
              </ActionButton>
            }
          >
            {t('delegations.candidateLoadError')}
          </InlineFeedback>
        )}
        <AutocompleteField<ApprovalDelegationCandidate>
          required
          label={t('delegations.fields.delegate')}
          supportingText={t('delegations.fields.delegateHelp')}
          value={selected}
          inputValue={candidateQuery}
          options={candidates.isError ? [] : (candidates.data ?? [])}
          loading={candidates.isFetching}
          disabled={!sourceReady || busy || Boolean(recoveryMessage)}
          filterOptions={(options) => options}
          isOptionEqualToValue={(option, value) => option.userId === value.userId}
          getOptionLabel={(option) =>
            `${option.displayName}${option.email ? ` · ${option.email}` : ''}`
          }
          noOptionsText={
            deferredCandidateQuery.length < 2
              ? t('delegations.searchHint')
              : t('delegations.noCandidates')
          }
          onInputChange={(_event, value) => setCandidateQuery(value)}
          onChange={(_event, value) => setSelected(value)}
        />
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
            gap: 1.5,
          }}
        >
          <SelectField
            label={t('delegations.fields.scope')}
            value={scopeType}
            disabled={!sourceReady || busy || Boolean(recoveryMessage)}
            options={[
              { value: 'ALL', label: t('delegations.scopes.all') },
              { value: 'WORKFLOW', label: t('delegations.scopes.workflow') },
            ]}
            onValueChange={(value) => value && setScopeType(value as 'ALL' | 'WORKFLOW')}
          />
          {scopeType === 'WORKFLOW' ? (
            <Stack gap={1}>
              {workflows.isError && (
                <InlineFeedback
                  severity="error"
                  action={
                    <ActionButton
                      type="button"
                      intent="quiet"
                      size="small"
                      disabled={workflows.isFetching}
                      onClick={() => void workflows.refetch()}
                    >
                      {t('actions.retry')}
                    </ActionButton>
                  }
                >
                  {t('delegations.workflowLoadError')}
                </InlineFeedback>
              )}
              <SelectField
                required
                label={t('delegations.fields.workflow')}
                value={workflowId}
                disabled={workflows.isError || workflows.isFetching || Boolean(recoveryMessage)}
                options={workflows.isError ? [] : workflowOptions}
                onValueChange={(value) => setWorkflowId(value ?? '')}
              />
            </Stack>
          ) : (
            <Box />
          )}
          <DateTimePickerField
            required
            label={t('delegations.fields.startsAt')}
            value={startsAt || null}
            disabled={!sourceReady || busy || Boolean(recoveryMessage)}
            onValueChange={(value) => setStartsAt(value ?? '')}
          />
          <DateTimePickerField
            required
            label={t('delegations.fields.endsAt')}
            value={endsAt || null}
            disabled={!sourceReady || busy || Boolean(recoveryMessage)}
            onValueChange={(value) => setEndsAt(value ?? '')}
          />
        </Box>
        <FormField
          required
          multiline
          minRows={3}
          label={t('delegations.fields.reason')}
          supportingText={t('delegations.fields.reasonHelp')}
          value={reason}
          disabled={!sourceReady || busy || Boolean(recoveryMessage)}
          onChange={(event) => setReason(event.target.value)}
        />
      </Stack>
    </FormDialog>
  );
}

import { useDeferredValue, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import {
  ActionButton,
  AutocompleteField,
  FormDialog,
  FormField,
  InlineFeedback,
} from '@dwp-frontend/design-system';
import { searchApprovalDelegationCandidates } from '@dwp-frontend/shared-utils';

import Stack from '@mui/material/Stack';

import type { ApprovalDelegationCandidate } from '@dwp-frontend/shared-utils';
import type { ApprovalManagementRequestScope } from './use-approval-experience';
import type { ApprovalNativeDeliveryAction } from '@dwp-frontend/shared-utils/api/approval-native-operations-api';

export type ApprovalNativeDialogAction = ApprovalNativeDeliveryAction | 'TASK_REASSIGN';

type ApprovalNativeOperationDialogProps = Readonly<{
  open: boolean;
  action: ApprovalNativeDialogAction;
  count: number;
  busy: boolean;
  sourceReady: boolean;
  requestScope: ApprovalManagementRequestScope;
  onClose: () => void;
  onSubmit: (reason: string, candidate: ApprovalDelegationCandidate | null) => void;
}>;

export function ApprovalNativeOperationDialog({
  open,
  action,
  count,
  busy,
  sourceReady,
  requestScope,
  onClose,
  onSubmit,
}: ApprovalNativeOperationDialogProps) {
  const { t } = useTranslation('approvals');
  const [reason, setReason] = useState('');
  const [candidateQuery, setCandidateQuery] = useState('');
  const [candidate, setCandidate] = useState<ApprovalDelegationCandidate | null>(null);
  const deferredQuery = useDeferredValue(candidateQuery.trim());
  const needsCandidate = action === 'TASK_REASSIGN';
  const candidates = useQuery({
    queryKey: [
      'approvals',
      ...requestScope.cacheKey,
      'native-operations',
      'candidates',
      deferredQuery,
    ],
    queryFn: ({ signal }) =>
      searchApprovalDelegationCandidates(deferredQuery, 10, requestScope.contextScopeKey, signal),
    enabled: open && needsCandidate && sourceReady && deferredQuery.length >= 2,
    retry: false,
  });

  useEffect(() => {
    if (open) return;
    setReason('');
    setCandidateQuery('');
    setCandidate(null);
  }, [open]);

  const actionLabel = t(`admin.nativeOperations.actions.${action}`, {
    defaultValue: {
      RETRY: 'Retry delivery',
      DEAD_LETTER: 'Move to dead-letter',
      REPLAY: 'Replay delivery',
      RECONCILE: 'Reconcile delivery state',
      TASK_REASSIGN: 'Reassign task',
    }[action],
  });
  const valid =
    sourceReady &&
    reason.trim().length >= 10 &&
    reason.trim().length <= 1000 &&
    (!needsCandidate || Boolean(candidate?.personPublicId)) &&
    !candidates.isFetching &&
    !candidates.isError;

  return (
    <FormDialog
      open={open}
      title={actionLabel}
      description={t('admin.nativeOperations.dialog.description', {
        count,
        defaultValue:
          'Review {{count}} selected target(s). This command is not sent until verification is complete.',
      })}
      cancelLabel={t('actions.cancel')}
      submitLabel={t('admin.highRisk.verify')}
      submittingLabel={t('admin.highRisk.verify')}
      busy={busy}
      submitDisabled={!valid}
      onClose={onClose}
      onSubmit={() => {
        if (valid) onSubmit(reason.trim(), candidate);
      }}
      maxWidth="sm"
    >
      <Stack gap={2}>
        <InlineFeedback severity="warning">
          {t('admin.nativeOperations.dialog.atomic', {
            defaultValue:
              'All selected targets commit together. If any target changed or is ineligible, none are changed.',
          })}
        </InlineFeedback>
        {needsCandidate ? (
          <>
            {candidates.isError && deferredQuery.length >= 2 ? (
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
            ) : null}
            <AutocompleteField<ApprovalDelegationCandidate>
              required
              label={t('delegations.fields.delegate')}
              supportingText={t('delegations.fields.delegateHelp')}
              value={candidate}
              inputValue={candidateQuery}
              options={candidates.isError ? [] : (candidates.data ?? [])}
              loading={candidates.isFetching}
              disabled={!sourceReady || busy}
              filterOptions={(options) => options}
              isOptionEqualToValue={(option, value) => option.userId === value.userId}
              getOptionLabel={(option) =>
                `${option.displayName}${option.email ? ` · ${option.email}` : ''}`
              }
              noOptionsText={
                deferredQuery.length < 2
                  ? t('delegations.searchHint')
                  : t('delegations.noCandidates')
              }
              onInputChange={(_event, value) => setCandidateQuery(value)}
              onChange={(_event, value) => setCandidate(value)}
            />
          </>
        ) : null}
        <FormField
          required
          multiline
          minRows={4}
          label={t('delegations.fields.reason')}
          supportingText={t('admin.nativeOperations.dialog.reasonHelp', {
            defaultValue:
              'Enter at least 10 characters. The reason is preserved in the durable operation receipt.',
          })}
          value={reason}
          disabled={!sourceReady || busy}
          inputProps={{ maxLength: 1000 }}
          onChange={(event) => setReason(event.target.value)}
        />
      </Stack>
    </FormDialog>
  );
}

import { useTranslation } from 'react-i18next';
import { Pencil, RotateCcw } from 'lucide-react';
import { ActionButton } from '@dwp-frontend/design-system';
import { formatDate } from '@dwp-frontend/shared-i18n';

import Box from '@mui/material/Box';
import Divider from '@mui/material/Divider';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import {
  buildApprovalDelegationWorkflowReference,
  canRevokeApprovalDelegation,
  canUpdateApprovalDelegation,
} from './approval-delegation-model';
import { StatusChip } from './approval-ui';

import type { ApprovalDelegation } from '@dwp-frontend/shared-utils';

export function ApprovalDelegationInspector({
  delegation,
  canManage,
  sourceReady,
  pending,
  onEdit,
  onRevoke,
}: {
  delegation: ApprovalDelegation;
  canManage: boolean;
  sourceReady: boolean;
  pending: boolean;
  onEdit: (delegation: ApprovalDelegation) => void;
  onRevoke: (delegation: ApprovalDelegation) => void;
}) {
  const { t } = useTranslation('approvals');
  const reference = buildApprovalDelegationWorkflowReference(delegation);
  const entries = [
    [
      t('delegations.fields.scope'),
      delegation.scopeType === 'ALL'
        ? t('delegations.scopes.all')
        : reference.displayKey
          ? t('delegations.scopeWorkflow', { key: reference.displayKey })
          : t('delegations.scopeWorkflowUnavailable'),
    ],
    [
      t('delegations.fields.startsAt'),
      formatDate(delegation.startsAt, { dateStyle: 'medium', timeStyle: 'short' }),
    ],
    [
      t('delegations.fields.endsAt'),
      formatDate(delegation.endsAt, { dateStyle: 'medium', timeStyle: 'short' }),
    ],
    [t('delegations.workspace.evidenceTitle'), delegation.delegationId],
    [
      t('delegations.fields.delegate'),
      delegation.delegatePersonPublicId ?? String(delegation.delegateUserId),
    ],
    ...(reference.workflowId
      ? [
          [
            t('delegations.fields.workflow'),
            t('delegations.workflowIdentity', { id: reference.workflowId }),
          ],
        ]
      : []),
  ];
  return (
    <Stack
      gap={2}
      minWidth={0}
      sx={{
        '& .MuiChip-root': {
          height: 'auto',
          minHeight: 24,
          maxWidth: '100%',
          alignSelf: 'flex-start',
          flexShrink: 0,
        },
        '& .MuiChip-label': { py: 0.25, whiteSpace: 'normal', overflowWrap: 'anywhere' },
      }}
    >
      <Stack direction="row" justifyContent="space-between" gap={1}>
        <Box minWidth={0}>
          <Typography component="h2" variant="subtitle1" sx={{ overflowWrap: 'anywhere' }}>
            {delegation.direction === 'INCOMING'
              ? t('delegations.receivedFrom', { userId: delegation.delegatorUserId })
              : delegation.delegateDisplayName}
          </Typography>
          {delegation.delegateEmail && (
            <Typography variant="caption" color="text.secondary" sx={{ overflowWrap: 'anywhere' }}>
              {delegation.delegateEmail}
            </Typography>
          )}
        </Box>
        <StatusChip status={delegation.lifecycleState} />
      </Stack>
      <Divider />
      <Box>
        <Typography variant="caption" color="text.secondary">
          {t('delegations.fields.reason')}
        </Typography>
        <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
          {delegation.reason}
        </Typography>
      </Box>
      <Box component="dl" sx={{ m: 0, display: 'grid', gap: 1.5 }}>
        {entries.map(([entryLabel, value], index) => (
          <Box key={index}>
            <Typography component="dt" variant="caption" color="text.secondary">
              {entryLabel}
            </Typography>
            <Typography component="dd" variant="body2" sx={{ m: 0, overflowWrap: 'anywhere' }}>
              {value}
            </Typography>
          </Box>
        ))}
      </Box>
      {canManage && canUpdateApprovalDelegation(delegation, sourceReady) && (
        <Stack gap={1}>
          <ActionButton
            intent="secondary"
            startIcon={<Pencil size={16} />}
            disabled={pending}
            onClick={() => onEdit(delegation)}
          >
            {t('delegations.update.action')}
          </ActionButton>
          {canRevokeApprovalDelegation(delegation, sourceReady) && (
            <ActionButton
              intent="danger"
              startIcon={<RotateCcw size={16} />}
              disabled={pending}
              onClick={() => onRevoke(delegation)}
            >
              {t('delegations.revoke.confirm')}
            </ActionButton>
          )}
        </Stack>
      )}
    </Stack>
  );
}

import { useTranslation } from 'react-i18next';
import { BriefcaseBusiness, CircleMinus, GitPullRequest, Plus } from 'lucide-react';
import { formatNumber } from '@dwp-frontend/shared-i18n';
import { ActionButton, FormField } from '@dwp-frontend/design-system';

import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import type { ReactNode } from 'react';

export function signed(value: number, fractionDigits = 0): string {
  return formatNumber(value, {
    signDisplay: 'always',
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  });
}

export function ChangeTypeIcon({
  targetKind,
  changeType,
}: {
  targetKind: string;
  changeType: string;
}) {
  return (
    <Box
      sx={{
        width: 30,
        height: 30,
        display: 'grid',
        placeItems: 'center',
        bgcolor: 'action.hover',
        borderRadius: 1,
      }}
    >
      {changeType === 'CREATE_POSITION' ? (
        <Plus size={16} />
      ) : changeType === 'CLOSE_POSITION' ? (
        <CircleMinus size={16} />
      ) : targetKind === 'POSITION' ? (
        <BriefcaseBusiness size={16} />
      ) : (
        <GitPullRequest size={16} />
      )}
    </Box>
  );
}

export function WorkflowAction({
  title,
  help,
  reason,
  setReason,
  busy,
  disabled,
  icon,
  actionLabel,
  secondaryLabel,
  actionColor = 'primary',
  onAction,
  onSecondary,
}: {
  title: string;
  help: string;
  reason: string;
  setReason: (value: string) => void;
  busy: boolean;
  disabled?: boolean;
  icon: ReactNode;
  actionLabel: string;
  secondaryLabel?: string;
  actionColor?: 'primary' | 'error';
  onAction: () => Promise<void>;
  onSecondary?: () => Promise<void>;
}) {
  const { t } = useTranslation('workforce');
  return (
    <Stack gap={1} sx={{ pt: 1 }}>
      <Box>
        <Typography variant="subtitle2">{title}</Typography>
        <Typography variant="body2" color="text.secondary">
          {help}
        </Typography>
      </Box>
      <FormField
        multiline
        minRows={2}
        size="small"
        label={t('orgChart.scenarios.fields.reason')}
        value={reason}
        onChange={(event) => setReason(event.target.value)}
      />
      <Stack direction="row" justifyContent="flex-end" gap={1}>
        {secondaryLabel && onSecondary && (
          <ActionButton
            intent="danger"
            disabled={busy || !reason.trim()}
            onClick={() => void onSecondary()}
          >
            {secondaryLabel}
          </ActionButton>
        )}
        <ActionButton
          intent={actionColor === 'error' ? 'danger' : 'primary'}
          startIcon={
            busy ? <CircularProgress size={14} color="inherit" aria-hidden="true" /> : icon
          }
          disabled={busy || disabled || !reason.trim()}
          onClick={() => void onAction()}
        >
          {actionLabel}
        </ActionButton>
      </Stack>
    </Stack>
  );
}

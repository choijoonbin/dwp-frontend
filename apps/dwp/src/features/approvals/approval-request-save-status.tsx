import { useTranslation } from 'react-i18next';
import { Check, CircleDashed, LoaderCircle, TriangleAlert } from 'lucide-react';
import { formatDate } from '@dwp-frontend/shared-i18n';

import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import type { ApprovalDraftAutosaveState } from './approval-request-autosave-model';

export function ApprovalRequestSaveStatus({ state }: { state: ApprovalDraftAutosaveState }) {
  const { t } = useTranslation('approvals');
  const saved = state.status === 'SAVED' && Boolean(state.receipt) && !state.dirty;
  const saving = state.status === 'SAVING';
  const unknown = state.status === 'UNKNOWN';
  const Icon = saving ? LoaderCircle : saved ? Check : unknown ? TriangleAlert : CircleDashed;
  return (
    <Stack
      direction="row"
      gap={1}
      alignItems="center"
      role="status"
      aria-live="polite"
      sx={{
        minHeight: 32,
        color: unknown ? 'warning.dark' : saved ? 'success.dark' : 'text.secondary',
      }}
    >
      <Box sx={{ display: 'flex', flexShrink: 0 }}>
        <Icon size={16} aria-hidden="true" />
      </Box>
      <Typography variant="caption">
        {t(
          saving
            ? 'requests.autosave.saving'
            : saved
              ? 'requests.autosave.saved'
              : unknown
                ? 'requests.autosave.unknown'
                : 'requests.autosave.local',
          { version: state.receipt?.version }
        )}
        {saved && state.savedAt && (
          <Box component="span" sx={{ ml: 1 }}>
            {formatDate(new Date(state.savedAt).toISOString(), {
              dateStyle: 'short',
              timeStyle: 'short',
            })}
          </Box>
        )}
      </Typography>
    </Stack>
  );
}

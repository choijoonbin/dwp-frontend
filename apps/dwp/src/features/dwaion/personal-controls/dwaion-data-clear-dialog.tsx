import { useState } from 'react';
import { CheckCircle2, Clock3, Trash2 } from 'lucide-react';

import Box from '@mui/material/Box';
import Checkbox from '@mui/material/Checkbox';
import Chip from '@mui/material/Chip';
import FormControlLabel from '@mui/material/FormControlLabel';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { FormDialog, InlineFeedback } from '@dwp-frontend/design-system';

import { DWAION_PERSONAL_CONTROLS_COPY_KO } from './dwaion-personal-controls-copy';
import { clearRequestIsValid } from './dwaion-personal-controls-model';

import type { DwaionPersonalControlsCopy } from './dwaion-personal-controls-copy';
import type { DwaionClearEvidence, DwaionClearScope } from './dwaion-personal-controls-model';

export function DwaionDataClearDialog({
  open,
  busy = false,
  availableScopes,
  evidence = [],
  onClose,
  onClear,
  copy = DWAION_PERSONAL_CONTROLS_COPY_KO,
  formatTimestamp = (value) => value,
}: {
  open: boolean;
  busy?: boolean;
  availableScopes: readonly DwaionClearScope[];
  evidence?: readonly DwaionClearEvidence[];
  onClose: () => void;
  onClear: (scopes: readonly DwaionClearScope[]) => void | Promise<void>;
  copy?: DwaionPersonalControlsCopy;
  formatTimestamp?: (value: string) => string;
}) {
  const [scopes, setScopes] = useState<readonly DwaionClearScope[]>([]);
  const toggle = (scope: DwaionClearScope) =>
    setScopes((current) =>
      current.includes(scope) ? current.filter((item) => item !== scope) : [...current, scope]
    );

  return (
    <FormDialog
      open={open}
      title={copy.clearTitle}
      description={copy.clearDescription}
      cancelLabel={copy.cancel}
      submitLabel={copy.clearConfirm}
      submittingLabel={copy.clearing}
      submitIntent="danger"
      busy={busy}
      submitDisabled={!clearRequestIsValid(scopes)}
      mobileFullScreen
      onClose={() => {
        setScopes([]);
        onClose();
      }}
      onSubmit={async () => {
        await onClear(scopes);
        setScopes([]);
      }}
    >
      <Stack gap={2}>
        <InlineFeedback severity="warning">{copy.sourceUnaffected}</InlineFeedback>
        <Box component="fieldset" sx={{ border: 0, p: 0, m: 0 }}>
          <Typography component="legend" variant="subtitle2">
            {copy.clearDescription}
          </Typography>
          <Stack sx={{ mt: 1 }}>
            {availableScopes.map((scope) => (
              <FormControlLabel
                key={scope}
                sx={{ minHeight: 44, m: 0 }}
                control={
                  <Checkbox checked={scopes.includes(scope)} onChange={() => toggle(scope)} />
                }
                label={copy.clearScopes[scope]}
              />
            ))}
          </Stack>
        </Box>

        {evidence.length ? (
          <Box
            role="status"
            aria-live="polite"
            sx={{ borderTop: 1, borderColor: 'divider', pt: 2 }}
          >
            <Typography variant="subtitle2">{copy.clearEvidence}</Typography>
            <Stack gap={1.25} sx={{ mt: 1 }}>
              {evidence.map((item) =>
                item.kind === 'PROPOSAL_CLEAR' ? (
                  <Stack
                    key={item.receiptId}
                    direction="row"
                    gap={1}
                    alignItems="flex-start"
                    sx={{ p: 1.5, bgcolor: 'action.hover' }}
                  >
                    <CheckCircle2
                      size={18}
                      color="var(--dwp-semantic-success)"
                      aria-hidden="true"
                    />
                    <Box>
                      <Typography variant="body2" fontWeight="fontWeightBold">
                        {copy.proposalHidden}: {item.hiddenCount}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {formatTimestamp(item.completedAt)}
                      </Typography>
                    </Box>
                  </Stack>
                ) : (
                  <Box key={item.receiptId} sx={{ p: 1.5, bgcolor: 'action.hover' }}>
                    <Stack direction="row" gap={1} alignItems="center">
                      <Clock3 size={18} aria-hidden="true" />
                      <Typography variant="body2" fontWeight="fontWeightBold">
                        {copy.deletionRequested}
                      </Typography>
                      <Chip size="small" variant="outlined" label={copy.requestState[item.state]} />
                    </Stack>
                    <Box component="dl" sx={{ m: 0, mt: 1 }}>
                      <EvidenceRow label={copy.receiptId} value={item.receiptId} />
                      <EvidenceRow
                        label={copy.requestedAt}
                        value={formatTimestamp(item.requestedAt)}
                      />
                    </Box>
                    {!item.deletionExecutionAvailable ? (
                      <Typography variant="caption" color="warning.main">
                        {copy.executionUnavailable}
                      </Typography>
                    ) : null}
                  </Box>
                )
              )}
            </Stack>
          </Box>
        ) : (
          <Stack direction="row" gap={1} alignItems="flex-start">
            <Trash2 size={17} aria-hidden="true" />
            <Typography variant="caption" color="text.secondary">
              {copy.executionUnavailable}
            </Typography>
          </Stack>
        )}
      </Stack>
    </FormDialog>
  );
}

function EvidenceRow({ label, value }: { label: string; value: string }) {
  return (
    <Stack direction={{ xs: 'column', sm: 'row' }} gap={0.5} sx={{ py: 0.5 }}>
      <Typography component="dt" variant="caption" color="text.secondary" sx={{ minWidth: 100 }}>
        {label}
      </Typography>
      <Typography component="dd" variant="body2" sx={{ m: 0, overflowWrap: 'anywhere' }}>
        {value}
      </Typography>
    </Stack>
  );
}

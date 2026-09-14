import type { ReactNode } from 'react';
import { CheckCircle2, CircleHelp, ShieldAlert, TimerOff } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import type { SignatureProviderCheck } from '@dwp-frontend/shared-utils/api/approval-signature-diagnostics-contract';
import { signatureDiagnosticsObservation } from './approval-signature-diagnostics-model';
import type { SignatureDiagnosticsReadState } from './approval-signature-diagnostics-model';

export function SignatureDiagnosticStatus({ status }: { status: string }) {
  const { t } = useTranslation('approvals');
  const verified = [
    'PASS',
    'VERIFIED_PRODUCTION',
    'VERIFIED_SANDBOX',
    'VERIFIED_INTERNAL_KEY',
    'ELIGIBLE',
    'CURRENT',
  ].includes(status);
  const failed = ['FAIL', 'BLOCKED'].includes(status);
  const expired = status === 'EXPIRED';
  const Icon = verified ? CheckCircle2 : failed ? ShieldAlert : expired ? TimerOff : CircleHelp;
  return (
    <Stack
      component="span"
      data-state={status}
      direction="row"
      alignItems="center"
      gap={0.75}
      sx={{
        typography: 'caption',
        color: verified ? 'success.main' : failed ? 'error.main' : 'text.secondary',
        minWidth: 0,
      }}
    >
      <Icon size={15} aria-hidden="true" style={{ flexShrink: 0 }} />
      <Box component="span" sx={{ overflowWrap: 'anywhere' }}>
        {t(`admin.signatureDiagnostics.states.${status}`)}
      </Box>
    </Stack>
  );
}
export function SignatureDiagnosticFacts({
  rows,
}: {
  rows: readonly { key: string; label: string; value: ReactNode }[];
}) {
  return (
    <Box component="dl" sx={{ m: 0, display: 'grid', gap: 1 }}>
      {rows.map((row) => (
        <Box
          component="div"
          key={row.key}
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: 'minmax(0,1fr)', sm: 'minmax(0,0.9fr) minmax(0,1.1fr)' },
            gap: 0.5,
            minWidth: 0,
          }}
        >
          <Box
            component="dt"
            sx={{ typography: 'caption', color: 'text.secondary', overflowWrap: 'anywhere' }}
          >
            {row.label}
          </Box>
          <Box
            component="dd"
            sx={{ m: 0, typography: 'caption', overflowWrap: 'anywhere', minWidth: 0 }}
          >
            {row.value}
          </Box>
        </Box>
      ))}
    </Box>
  );
}
export function SignatureDiagnosticChecks({
  checks,
  readState,
  now,
}: {
  checks: readonly SignatureProviderCheck[];
  readState: SignatureDiagnosticsReadState;
  now: number;
}) {
  const { t } = useTranslation('approvals');
  return (
    <Box
      component="ul"
      aria-label={t('admin.signatureDiagnostics.labels.checks')}
      sx={{ m: 0, p: 0, listStyle: 'none' }}
    >
      {checks.map((check) => (
        <Box
          component="li"
          key={check.checkKey}
          sx={{ py: 1, borderBottom: 1, borderColor: 'divider' }}
        >
          <Stack direction="row" justifyContent="space-between" alignItems="flex-start" gap={1}>
            <Box
              component="code"
              sx={{ typography: 'caption', overflowWrap: 'anywhere', minWidth: 0 }}
            >
              {check.checkKey}
            </Box>
            <SignatureDiagnosticStatus
              status={signatureDiagnosticsObservation(check, readState, now)}
            />
          </Stack>
          {check.reasonCodes.length > 0 ? (
            <Box
              sx={{
                typography: 'caption',
                color: 'text.secondary',
                mt: 0.5,
                overflowWrap: 'anywhere',
              }}
            >
              {check.reasonCodes.join(', ')}
            </Box>
          ) : null}
        </Box>
      ))}
    </Box>
  );
}

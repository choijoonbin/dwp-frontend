import { useTranslation } from 'react-i18next';
import { ActionButton, EmptyState, ErrorState } from '@dwp-frontend/design-system';
import { ArrowRight, History } from 'lucide-react';
import { formatDate, resolveSupportedLocale } from '@dwp-frontend/shared-i18n';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import type { SignatureProviderDiagnosticHistory } from '@dwp-frontend/shared-utils/api/approval-signature-diagnostics-contract';
import type { SignatureProviderPolicyHistory } from '@dwp-frontend/shared-utils/api/approval-signature-provider-policy-contract';
import { signatureDiagnosticsVisible } from './approval-signature-diagnostics-model';
import type { SignatureDiagnosticsReadState } from './approval-signature-diagnostics-model';

export function SignatureDiagnosticsHistory({
  diagnosticHistory,
  policyHistory,
  readState,
  policyReadState,
  onNextDiagnostic,
  onNextPolicy,
}: {
  diagnosticHistory: SignatureProviderDiagnosticHistory | null;
  policyHistory: SignatureProviderPolicyHistory | null;
  readState: SignatureDiagnosticsReadState;
  policyReadState: SignatureDiagnosticsReadState;
  onNextDiagnostic?: () => void;
  onNextPolicy?: () => void;
}) {
  const { t, i18n } = useTranslation('approvals');
  const label = (key: string) => t(`admin.signatureDiagnostics.labels.${key}`);
  const date = (timestamp: string) =>
    formatDate(
      timestamp,
      { dateStyle: 'medium', timeStyle: 'short' },
      resolveSupportedLocale(i18n.resolvedLanguage, i18n.language)
    );
  const diagnosticVisible = diagnosticHistory !== null && signatureDiagnosticsVisible(readState);
  const policyVisible = policyHistory !== null && signatureDiagnosticsVisible(policyReadState);
  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: { xs: 'minmax(0,1fr)', md: 'repeat(2,minmax(0,1fr))' },
        gap: 3,
      }}
    >
      <Stack component="section" aria-label={label('diagnosticHistory')} gap={1.5} minWidth={0}>
        <Box component="h2" sx={{ typography: 'subtitle2', m: 0 }}>
          {label('diagnosticHistory')}
        </Box>
        {!diagnosticVisible ? (
          <ErrorState
            title={label('diagnosticHistory')}
            description={t(`admin.signatureDiagnostics.states.${readState}`)}
            size="compact"
          />
        ) : diagnosticHistory.items.length === 0 ? (
          <EmptyState title={label('none')} icon={<History size={20} />} size="compact" />
        ) : (
          <Box component="ol" sx={{ p: 0, m: 0, listStyle: 'none' }}>
            {diagnosticHistory.items.map((item) => (
              <Box
                component="li"
                key={`${item.probeRunId}-${item.providerId ?? 'ALL'}-${item.evidenceId}`}
                sx={{ py: 1.25, borderBottom: 1, borderColor: 'divider' }}
              >
                <Box sx={{ typography: 'caption' }}>{date(item.occurredAt)}</Box>
                <Box sx={{ typography: 'caption', color: 'text.secondary', mt: 0.5 }}>
                  {t(`admin.signatureDiagnostics.states.${item.state}`)}
                </Box>
                <Box
                  component="code"
                  sx={{
                    typography: 'caption',
                    display: 'block',
                    overflowWrap: 'anywhere',
                    mt: 0.5,
                  }}
                >
                  {item.sourceRevision}
                </Box>
                {item.reasonCodes.length ? (
                  <Box
                    sx={{
                      typography: 'caption',
                      color: 'text.secondary',
                      overflowWrap: 'anywhere',
                    }}
                  >
                    {item.reasonCodes.join(', ')}
                  </Box>
                ) : null}
              </Box>
            ))}
          </Box>
        )}
        {diagnosticVisible && diagnosticHistory.truncated ? (
          <Box sx={{ typography: 'caption', color: 'text.secondary' }}>
            {label('historyContinuation')}
          </Box>
        ) : null}
        {diagnosticVisible && diagnosticHistory.nextCursor !== null && onNextDiagnostic ? (
          <ActionButton
            intent="secondary"
            endIcon={<ArrowRight size={16} />}
            onClick={onNextDiagnostic}
          >
            {label('nextHistory')}
          </ActionButton>
        ) : null}
      </Stack>
      <Stack component="section" aria-label={label('history')} gap={1.5} minWidth={0}>
        <Box component="h2" sx={{ typography: 'subtitle2', m: 0 }}>
          {label('history')}
        </Box>
        {!policyVisible ? (
          <ErrorState
            title={label('history')}
            description={t(`admin.signatureDiagnostics.states.${policyReadState}`)}
            size="compact"
          />
        ) : policyHistory.items.length === 0 ? (
          <EmptyState title={label('none')} icon={<History size={20} />} size="compact" />
        ) : (
          <Box component="ol" sx={{ p: 0, m: 0, listStyle: 'none' }}>
            {policyHistory.items.map((item) => (
              <Box
                component="li"
                key={item.versionId}
                sx={{ py: 1.25, borderBottom: 1, borderColor: 'divider' }}
              >
                <Stack direction="row" justifyContent="space-between" gap={1}>
                  <Box sx={{ typography: 'caption' }}>
                    {t('admin.signatureDiagnostics.labels.revision', { revision: item.revision })}
                  </Box>
                  <Box sx={{ typography: 'caption', color: 'text.secondary' }}>
                    {label(item.state === 'PUBLISHED' ? 'published' : 'workingDraft')}
                  </Box>
                </Stack>
                <Box
                  component="code"
                  sx={{
                    typography: 'caption',
                    display: 'block',
                    overflowWrap: 'anywhere',
                    mt: 0.5,
                  }}
                >
                  {item.rulesSha256}
                </Box>
                <Box sx={{ typography: 'caption', color: 'text.secondary', mt: 0.5 }}>
                  {date(item.publishedAt ?? item.createdAt)}
                </Box>
              </Box>
            ))}
          </Box>
        )}
        {policyVisible && policyHistory.truncated ? (
          <Box sx={{ typography: 'caption', color: 'text.secondary' }}>
            {label('historyContinuation')}
          </Box>
        ) : null}
        {policyVisible && policyHistory.nextCursor !== null && onNextPolicy ? (
          <ActionButton
            intent="secondary"
            endIcon={<ArrowRight size={16} />}
            onClick={onNextPolicy}
          >
            {label('nextHistory')}
          </ActionButton>
        ) : null}
      </Stack>
    </Box>
  );
}

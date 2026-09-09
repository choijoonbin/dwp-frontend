import { CircleCheck, Link2, ShieldCheck, ShieldX } from 'lucide-react';
import { useDisplayDictionary } from '@dwp-frontend/shared-i18n';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { GuidedEmptyState, InlineFeedback } from '@dwp-frontend/design-system';

import { DWAION_ARTIFACT_COPY_KO } from './dwaion-artifact-copy';

import type { DwaionArtifactCopy } from './dwaion-artifact-copy';
import type {
  DwaionArtifactCapabilities,
  DwaionArtifactEvidence,
  DwaionDlpPreflight,
} from './dwaion-artifact-model';

export function DwaionArtifactEvidenceRail({
  evidence,
  preflight,
  capabilities,
  copy = DWAION_ARTIFACT_COPY_KO,
  formatTimestamp = (value) => value,
}: {
  evidence: readonly DwaionArtifactEvidence[];
  preflight: DwaionDlpPreflight | null;
  capabilities: DwaionArtifactCapabilities | null;
  copy?: DwaionArtifactCopy;
  formatTimestamp?: (value: string) => string;
}) {
  const display = useDisplayDictionary();
  return (
    <Stack gap={1.25} sx={{ minWidth: 0 }}>
      <Box
        component="section"
        aria-labelledby="dwaion-artifact-evidence-title"
        sx={{
          p: 1.5,
          border: 1,
          borderColor: 'divider',
          borderRadius: (theme) => Number(theme.shape.borderRadius) * 2 + 'px',
          bgcolor: 'background.paper',
        }}
      >
        <Stack direction="row" gap={0.75} alignItems="center" justifyContent="space-between">
          <Stack direction="row" gap={0.75} alignItems="center">
            <ShieldCheck size={17} aria-hidden="true" />
            <Typography id="dwaion-artifact-evidence-title" component="h2" variant="subtitle2">
              {copy.sources}
            </Typography>
          </Stack>
          <Chip size="small" variant="outlined" label={evidence.length} />
        </Stack>
        <InlineFeedback severity="info" sx={{ mt: 1.25 }}>
          {capabilities?.sourceVerificationAvailable
            ? copy.evidenceMapped.replace('{{count}}', String(evidence.length))
            : copy.verificationUnavailable}
        </InlineFeedback>
        {evidence.length === 0 ? (
          <GuidedEmptyState
            kind="empty"
            title={copy.noEvidence}
            description={copy.noEvidenceDescription}
            size="compact"
            announce={false}
          />
        ) : (
          <Box sx={{ mt: 1.25, borderBlock: 1, borderColor: 'divider' }}>
            {evidence.map((item, index) => (
              <Box key={item.evidenceId}>
                {index > 0 ? <Divider /> : null}
                <Box sx={{ py: 1.25 }}>
                  <Stack direction="row" gap={1} alignItems="flex-start">
                    <Link2 size={17} aria-hidden="true" />
                    <Box sx={{ minWidth: 0 }}>
                      <Typography variant="body2" fontWeight="fontWeightBold">
                        {display('sourceTypes', item.sourceType)}
                      </Typography>
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        sx={{ overflowWrap: 'anywhere' }}
                      >
                        {copy.sourceReference}
                        {copy.labelSeparator} {item.reference}
                      </Typography>
                    </Box>
                  </Stack>
                  <Stack direction="row" flexWrap="wrap" gap={0.5} sx={{ mt: 1 }}>
                    <Chip
                      size="small"
                      variant="outlined"
                      color="warning"
                      label={copy.verificationStates[item.verificationState]}
                    />
                    <Chip
                      size="small"
                      variant="outlined"
                      label={copy.verificationStates[item.freshness]}
                    />
                  </Stack>
                </Box>
              </Box>
            ))}
          </Box>
        )}
      </Box>

      <Box
        component="section"
        aria-labelledby="dwaion-artifact-dlp-title"
        sx={{
          p: 1.5,
          border: 1,
          borderColor: 'divider',
          borderRadius: (theme) => Number(theme.shape.borderRadius) * 2 + 'px',
          bgcolor: 'background.paper',
        }}
      >
        <Stack direction="row" alignItems="center" justifyContent="space-between" gap={1}>
          <Stack direction="row" gap={0.75} alignItems="center">
            {preflight?.outcome === 'PASS' ? (
              <CircleCheck size={17} color="var(--dwp-semantic-success)" aria-hidden="true" />
            ) : (
              <ShieldX size={17} aria-hidden="true" />
            )}
            <Typography id="dwaion-artifact-dlp-title" component="h2" variant="subtitle2">
              {copy.dlpGate}
            </Typography>
          </Stack>
          <Chip
            size="small"
            variant="outlined"
            color={preflight?.outcome === 'PASS' ? 'success' : preflight ? 'warning' : 'default'}
            label={preflight ? copy.preflightStates[preflight.outcome] : copy.dlpNotRun}
          />
        </Stack>
        {preflight ? (
          <Stack gap={0.75} sx={{ mt: 1.25 }}>
            <Typography variant="caption" color="text.secondary">
              {copy.versionPrefix}
              {preflight.versionNumber} {copy.separator} {formatTimestamp(preflight.evaluatedAt)}
            </Typography>
            <Typography variant="body2">
              {copy.dlpFindingCount.replace('{{count}}', String(preflight.findings.length))}
            </Typography>
          </Stack>
        ) : null}
        {!capabilities?.enterpriseDlpConnectorAvailable ? (
          <InlineFeedback severity="info" sx={{ mt: 1.25 }}>
            {copy.enterpriseDlpUnavailable}
          </InlineFeedback>
        ) : null}
        {!capabilities?.recipientSharingAvailable || !capabilities?.externalSharingAvailable ? (
          <Typography variant="caption" color="warning.main" sx={{ display: 'block', mt: 1.25 }}>
            {copy.externalSharingBlocked}
          </Typography>
        ) : null}
      </Box>
    </Stack>
  );
}

import { useTranslation } from 'react-i18next';
import { InlineFeedback } from '@dwp-frontend/design-system';
import { formatDate } from '@dwp-frontend/shared-i18n';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import type { ApprovalSignatureEvidence as Evidence } from '@dwp-frontend/shared-utils/api/approval-signature-contract';

export function ApprovalSignatureEvidence({ evidence }: { evidence: Evidence }) {
  const { t } = useTranslation('approvals');
  const fields = [
    ['proofId', evidence.evidenceId],
    ['keyId', evidence.keyId],
    ['artifactSha', evidence.artifactSha256],
    ['sourceDigest', evidence.sourceDigest],
    ['attestedAt', formatDate(evidence.attestedAt, { dateStyle: 'medium', timeStyle: 'short' })],
  ] as const;
  return (
    <Stack gap={1.5} data-approval-signature-evidence>
      <InlineFeedback severity="success">
        {t('signatureCeremony.verifiedInternalKey')}
      </InlineFeedback>
      <Box
        component="dl"
        sx={{
          m: 0,
          typography: 'caption',
          display: 'grid',
          gridTemplateColumns: 'minmax(100px,.35fr) minmax(0,1fr)',
          gap: 1,
        }}
      >
        {fields.map(([key, value]) => (
          <Box key={key} sx={{ display: 'contents' }}>
            <Box component="dt" color="text.secondary">
              {t(`signatureCeremony.${key}`)}
            </Box>
            <Box component="dd" sx={{ m: 0, overflowWrap: 'anywhere' }}>
              {value}
            </Box>
          </Box>
        ))}
      </Box>
      {(
        [
          ['publicKey', evidence.publicKeyJson],
          ['compactJws', evidence.compactJws],
        ] as const
      ).map(([key, value]) => (
        <Box component="details" key={key} sx={{ typography: 'caption', minWidth: 0 }}>
          <Box component="summary" sx={{ cursor: 'pointer', color: 'primary.main', py: 1 }}>
            {t(`signatureCeremony.${key}`)}
          </Box>
          <Box
            component="pre"
            sx={{ m: 0, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', fontSize: 'inherit' }}
          >
            {value}
          </Box>
        </Box>
      ))}
      <InlineFeedback severity="info">{t('signatureCeremony.preservation')}</InlineFeedback>
    </Stack>
  );
}

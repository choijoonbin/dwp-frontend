import { Link2, ShieldCheck } from 'lucide-react';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { GuidedEmptyState, InlineFeedback } from '@dwp-frontend/design-system';

import { DWAION_ARTIFACT_COPY_KO } from './dwaion-artifact-copy';

import type { DwaionArtifactCopy } from './dwaion-artifact-copy';
import type { DwaionArtifactEvidence } from './dwaion-artifact-model';

export function DwaionArtifactEvidenceRail({
  evidence,
  copy = DWAION_ARTIFACT_COPY_KO,
}: {
  evidence: readonly DwaionArtifactEvidence[];
  copy?: DwaionArtifactCopy;
}) {
  return (
    <Box component="section" aria-labelledby="dwaion-artifact-evidence-title" sx={{ minWidth: 0 }}>
      <Stack direction="row" gap={0.75} alignItems="center">
        <ShieldCheck size={17} aria-hidden="true" />
        <Typography id="dwaion-artifact-evidence-title" component="h2" variant="subtitle2">
          {copy.sources}
        </Typography>
      </Stack>
      <InlineFeedback severity="info" sx={{ mt: 1.25 }}>
        {copy.verificationUnavailable}
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
                      {item.sourceType}
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
  );
}

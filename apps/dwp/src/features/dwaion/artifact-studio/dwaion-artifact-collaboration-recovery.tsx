import { useState } from 'react';

import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';

import { ActionButton } from '@dwp-frontend/design-system';

import type { DwaionTeamArtifactCapabilities } from '@dwp-frontend/shared-utils';

import { DwaionCapabilityActions } from '../dwaion-capability-actions';
import { DWAION_ARTIFACT_COLLABORATION_COPY as COPY } from './dwaion-artifact-collaboration-copy';

export function DwaionArtifactCollaborationRecovery({
  capabilities,
  locale,
  canEdit,
  canResubmit,
  busy,
  onSaveExplanation,
  onSavePrivateDraft,
  onResubmit,
}: {
  capabilities: DwaionTeamArtifactCapabilities | null;
  locale: 'ko' | 'en';
  canEdit: boolean;
  canResubmit: boolean;
  busy: boolean;
  onSaveExplanation: (explanation: string) => Promise<unknown>;
  onSavePrivateDraft: () => Promise<unknown>;
  onResubmit: () => Promise<unknown>;
}) {
  const text = COPY[locale];
  const [explanation, setExplanation] = useState('');
  return (
    <>
      <Box sx={{ borderTop: 1, borderColor: 'divider', pt: 2 }}>
        <Typography variant="subtitle2">{text.recoveryTitle}</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
          {text.recoveryHelp}
        </Typography>
        <TextField
          fullWidth
          multiline
          minRows={2}
          size="small"
          label={text.explanation}
          placeholder={text.explanationPlaceholder}
          value={explanation}
          onChange={(event) => setExplanation(event.target.value)}
          disabled={!canEdit || busy}
        />
        <Stack direction={{ xs: 'column', sm: 'row' }} gap={1} sx={{ mt: 1 }}>
          <ActionButton
            intent="secondary"
            disabled={!canEdit || busy || explanation.trim().length < 5}
            onClick={() =>
              void onSaveExplanation(explanation.trim())
                .then(() => setExplanation(''))
                .catch(() => undefined)
            }
            sx={{ minHeight: 44 }}
          >
            {text.saveExplanation}
          </ActionButton>
          <ActionButton
            intent="quiet"
            disabled={!canEdit || busy}
            onClick={() => void onSavePrivateDraft().catch(() => undefined)}
            sx={{ minHeight: 44 }}
          >
            {text.savePrivateDraft}
          </ActionButton>
          <ActionButton
            intent="primary"
            disabled={!canResubmit || busy}
            onClick={() => void onResubmit().catch(() => undefined)}
            sx={{ minHeight: 44 }}
          >
            {text.resubmit}
          </ActionButton>
        </Stack>
      </Box>

      <DwaionCapabilityActions
        title={text.recoveryTitle}
        description={text.providerActionUnavailable}
        actions={providerActions(capabilities, text)}
      />
    </>
  );
}

function providerActions(
  capabilities: DwaionTeamArtifactCapabilities | null,
  text: (typeof COPY)[keyof typeof COPY]
) {
  return (
    [
      ['automaticMasking', 'automaticMasking'],
      ['syntheticReplacement', 'syntheticReplacement'],
      ['reviewNotification', 'reviewNotification'],
      ['reviewRejection', 'reviewRejection'],
    ] as const
  ).map(([key, label]) => {
    const capability = capabilities?.[key];
    return {
      key,
      label: text[label],
      capability: `artifact-collaboration.${key}`,
      available: Boolean(capability?.available && capability.configured),
      reason: capability?.recoveryHint ?? capability?.reasonCode ?? text.providerActionUnavailable,
    };
  });
}

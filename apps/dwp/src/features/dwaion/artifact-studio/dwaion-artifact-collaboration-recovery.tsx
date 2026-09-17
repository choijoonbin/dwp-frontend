import { useState } from 'react';

import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';

import { ActionButton } from '@dwp-frontend/design-system';

import type {
  DwaionTeamArtifactCapabilities,
  DwaionTeamArtifactRemediationAction,
  DwaionTeamArtifactRemediationReceipt,
} from '@dwp-frontend/shared-utils';

import { DwaionCapabilityActions } from '../dwaion-capability-actions';
import { DWAION_ARTIFACT_COLLABORATION_COPY as COPY } from './dwaion-artifact-collaboration-copy';

export function DwaionArtifactCollaborationRecovery({
  capabilities,
  locale,
  canEdit,
  canResubmit,
  busy,
  receipt,
  canNotifyReview,
  onSaveExplanation,
  onSavePrivateDraft,
  onResubmit,
  onRemediate,
}: {
  capabilities: DwaionTeamArtifactCapabilities | null;
  locale: 'ko' | 'en';
  canEdit: boolean;
  canResubmit: boolean;
  busy: boolean;
  receipt: DwaionTeamArtifactRemediationReceipt | null;
  canNotifyReview: boolean;
  onSaveExplanation: (explanation: string) => Promise<unknown>;
  onSavePrivateDraft: () => Promise<unknown>;
  onResubmit: () => Promise<unknown>;
  onRemediate: (action: DwaionTeamArtifactRemediationAction) => Promise<unknown>;
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
        actions={providerActions(
          capabilities,
          text,
          canEdit && !busy,
          canNotifyReview,
          onRemediate
        )}
      />
      {receipt ? (
        <Box
          data-testid="artifact-remediation-receipt"
          sx={{ mt: 1, p: 1.25, border: 1, borderColor: 'success.main', borderRadius: 1.5 }}
        >
          <Typography variant="body2" fontWeight="fontWeightBold" color="success.main">
            {receipt.action} · {receipt.state}
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ overflowWrap: 'anywhere' }}>
            {receipt.providerReceiptId ?? receipt.receiptId} · {receipt.affectedCount}
          </Typography>
          <Typography variant="caption" display="block" color="text.secondary">
            {receipt.action === 'REVIEW_NOTIFICATION'
              ? text.notificationDelivered
              : `${text.remediationClosed.replace(
                  '{{count}}',
                  String(receipt.residualFindingCount ?? 0)
                )} · ${receipt.remediatedCodes.join(', ')}`}
          </Typography>
          {receipt.findingManifestSha256 ? (
            <Typography
              variant="caption"
              display="block"
              color="text.secondary"
              sx={{ overflowWrap: 'anywhere' }}
            >
              {text.remediationEvidence} · {receipt.findingManifestSha256}
            </Typography>
          ) : null}
        </Box>
      ) : null}
    </>
  );
}

function providerActions(
  capabilities: DwaionTeamArtifactCapabilities | null,
  text: (typeof COPY)[keyof typeof COPY],
  enabled: boolean,
  canNotifyReview: boolean,
  onRemediate: (action: DwaionTeamArtifactRemediationAction) => Promise<unknown>
) {
  return (
    [
      ['automaticMasking', 'automaticMasking'],
      ['syntheticReplacement', 'syntheticReplacement'],
      ['reviewNotification', 'reviewNotification'],
    ] as const
  ).map(([key, label]) => {
    const capability = capabilities?.[key];
    const action: DwaionTeamArtifactRemediationAction =
      key === 'automaticMasking'
        ? 'AUTOMATIC_MASKING'
        : key === 'syntheticReplacement'
          ? 'SYNTHETIC_REPLACEMENT'
          : 'REVIEW_NOTIFICATION';
    return {
      key,
      label: text[label],
      capability: `artifact-collaboration.${key}`,
      available: Boolean(
        enabled &&
        capability?.available &&
        capability.configured &&
        (action !== 'REVIEW_NOTIFICATION' || canNotifyReview)
      ),
      reason: capability?.recoveryHint ?? capability?.reasonCode ?? text.providerActionUnavailable,
      onClick: () => void onRemediate(action).catch(() => undefined),
    };
  });
}

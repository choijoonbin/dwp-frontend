import { LockKeyhole, ShieldCheck } from 'lucide-react';
import { foundationTokens } from '@dwp-frontend/design-system';
import type { DwaionAttachmentStageKey, DwaionSecureAttachment } from '@dwp-frontend/shared-utils';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import type { secureAttachmentCopy } from './dwaion-secure-attachment-copy';
import { formatDwaionAttachmentBytes } from './dwaion-secure-attachment-model';

const ATTACHMENT_STAGE_ORDER: readonly DwaionAttachmentStageKey[] = [
  'UPLOAD',
  'AV',
  'DLP',
  'PARSER',
  'OCR',
  'INDEX',
];

export function DwaionAttachmentPipelineSummary({
  attachments,
  copy,
}: {
  attachments: readonly DwaionSecureAttachment[];
  copy: ReturnType<typeof secureAttachmentCopy>;
}) {
  const ready = attachments.filter((attachment) => attachment.state === 'READY').length;
  const citations = attachments.reduce(
    (total, attachment) => total + attachment.citations.length,
    0
  );
  const maximumFileBytes = Math.min(
    ...attachments.map((attachment) => attachment.capabilities.maximumFileBytes)
  );
  const allowedMediaTypes = Array.from(
    new Set(attachments.flatMap((attachment) => attachment.capabilities.allowedMediaTypes))
  );

  return (
    <Box
      data-testid="dwaion-attachment-pipeline"
      sx={{
        p: 1.25,
        border: 1,
        borderColor: 'divider',
        borderRadius: foundationTokens.radius.control + 'px',
        bgcolor: 'action.hover',
      }}
    >
      <Stack direction={{ xs: 'column', sm: 'row' }} gap={1} justifyContent="space-between">
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="subtitle2" sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
            <ShieldCheck size={16} aria-hidden="true" />
            {copy.pipelineTitle}
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.25 }}>
            {copy.pipelineDescription}
          </Typography>
        </Box>
        <Chip
          size="small"
          color={ready === attachments.length ? 'success' : 'warning'}
          label={copy.pipelineEvidence(ready, attachments.length, citations)}
          sx={{ alignSelf: { xs: 'flex-start', sm: 'center' }, height: 'auto' }}
        />
      </Stack>
      <Stack direction="row" gap={0.5} useFlexGap flexWrap="wrap" sx={{ mt: 1 }}>
        {ATTACHMENT_STAGE_ORDER.map((key) => {
          const stages = attachments.map((attachment) =>
            attachment.stages.find((stage) => stage.key === key)
          );
          const verified =
            stages.length === attachments.length &&
            stages.every(
              (stage) => stage && (stage.state === 'PASSED' || stage.state === 'NOT_REQUIRED')
            );
          return (
            <Chip
              key={key}
              size="small"
              variant="outlined"
              color={verified ? 'success' : 'warning'}
              label={`${copy.stages[key]} · ${
                verified ? copy.pipelineStageReady : copy.pipelineStageAttention
              }`}
            />
          );
        })}
      </Stack>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.9 }}>
        {copy.governedBoundary}
      </Typography>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.2 }}>
        {copy.providerLimits(
          formatDwaionAttachmentBytes(maximumFileBytes),
          formatAllowedMediaTypes(allowedMediaTypes)
        )}
      </Typography>
      <Box sx={{ mt: 1, pt: 1, borderTop: 1, borderColor: 'divider' }}>
        <Typography
          variant="caption"
          fontWeight="fontWeightBold"
          sx={{ display: 'flex', gap: 0.6 }}
        >
          <LockKeyhole size={14} aria-hidden="true" />
          {copy.governanceTitle}
        </Typography>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.3 }}>
          {copy.governanceEvidence}
        </Typography>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.2 }}>
          {copy.providerDisclosure}
        </Typography>
      </Box>
    </Box>
  );
}

function formatAllowedMediaTypes(mediaTypes: readonly string[]): string {
  return Array.from(new Set(mediaTypes.map(formatAttachmentMediaType))).join(', ');
}

export function formatAttachmentMediaType(mediaType: string): string {
  return (
    {
      'application/pdf': 'PDF',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'DOCX',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'XLSX',
      'text/csv': 'CSV',
      'text/plain': 'TXT',
      'image/png': 'PNG',
      'image/jpeg': 'JPEG',
    }[mediaType.toLowerCase()] ?? mediaType
  );
}

import { FileText, Plus } from 'lucide-react';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { ActionButton, GuidedEmptyState } from '@dwp-frontend/design-system';

import { DWAION_ARTIFACT_COPY_KO } from './dwaion-artifact-copy';

import type { DwaionArtifactCopy } from './dwaion-artifact-copy';
import type { DwaionArtifactSummary } from './dwaion-artifact-model';

export function DwaionArtifactConversationRail({
  artifacts,
  selectedId,
  onSelect,
  onCreate,
  canCreate = true,
  copy = DWAION_ARTIFACT_COPY_KO,
  formatTimestamp = (value) => value,
}: {
  artifacts: readonly DwaionArtifactSummary[];
  selectedId?: string;
  onSelect: (artifact: DwaionArtifactSummary) => void;
  onCreate: () => void;
  canCreate?: boolean;
  copy?: DwaionArtifactCopy;
  formatTimestamp?: (value: string) => string;
}) {
  return (
    <Box component="section" aria-labelledby="dwaion-artifact-list-title" sx={{ minWidth: 0 }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" gap={1}>
        <Typography id="dwaion-artifact-list-title" component="h2" variant="subtitle2">
          {copy.artifacts}
        </Typography>
        <ActionButton
          intent="quiet"
          aria-label={copy.create}
          disabled={!canCreate}
          onClick={onCreate}
          sx={{ minWidth: 44, minHeight: 44, px: 1 }}
        >
          <Plus size={18} aria-hidden="true" />
        </ActionButton>
      </Stack>
      {artifacts.length === 0 ? (
        <GuidedEmptyState
          kind="first-use"
          title={copy.emptyTitle}
          description={copy.emptyDescription}
          actionLabel={canCreate ? copy.create : undefined}
          onAction={canCreate ? onCreate : undefined}
          size="compact"
          announce={false}
        />
      ) : (
        <Box sx={{ borderBlock: 1, borderColor: 'divider' }}>
          {artifacts.map((artifact, index) => (
            <Box key={artifact.artifactId}>
              {index > 0 ? <Divider /> : null}
              <Box
                component="button"
                type="button"
                aria-pressed={artifact.artifactId === selectedId}
                onClick={() => onSelect(artifact)}
                sx={{
                  width: '100%',
                  minHeight: 64,
                  display: 'grid',
                  gridTemplateColumns: '32px minmax(0, 1fr)',
                  alignItems: 'start',
                  gap: 1,
                  border: 0,
                  px: 1,
                  py: 1.25,
                  bgcolor:
                    artifact.artifactId === selectedId ? 'var(--dwp-product-soft)' : 'transparent',
                  color: 'text.primary',
                  textAlign: 'left',
                  cursor: 'pointer',
                  '&:hover': { bgcolor: 'action.hover' },
                  '&:focus-visible': {
                    outline: '2px solid',
                    outlineColor: 'primary.main',
                    outlineOffset: -2,
                  },
                  '@media (forced-colors: active)': {
                    border: artifact.artifactId === selectedId ? '1px solid Highlight' : 0,
                  },
                }}
              >
                <FileText size={18} aria-hidden="true" />
                <Box sx={{ minWidth: 0 }}>
                  <Typography
                    variant="body2"
                    fontWeight="fontWeightBold"
                    sx={{ overflowWrap: 'anywhere' }}
                  >
                    {artifact.title}
                  </Typography>
                  <Stack
                    direction="row"
                    gap={0.5}
                    alignItems="center"
                    flexWrap="wrap"
                    sx={{ mt: 0.5 }}
                  >
                    <Chip
                      size="small"
                      variant="outlined"
                      label={copy.artifactTypes[artifact.artifactType]}
                    />
                    <Chip
                      size="small"
                      color={artifact.state === 'PUBLISHED' ? 'success' : 'default'}
                      variant="outlined"
                      label={copy.artifactStates[artifact.state]}
                    />
                    <Typography variant="caption" color="text.secondary">
                      {copy.revisionPrefix}
                      {artifact.revision} {copy.separator} {formatTimestamp(artifact.updatedAt)}
                    </Typography>
                  </Stack>
                </Box>
              </Box>
            </Box>
          ))}
        </Box>
      )}
    </Box>
  );
}

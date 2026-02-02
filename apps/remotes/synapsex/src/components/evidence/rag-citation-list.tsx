import { Iconify } from '@dwp-frontend/design-system';

import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';

import { RagCitationCard } from './rag-citation-card';

import type { RagCitation } from './types';

// ----------------------------------------------------------------------

interface RagCitationListProps {
  citations: RagCitation[];
  title?: string;
  maxItems?: number;
  compact?: boolean;
  onOpenSource?: (source: string) => void;
}

export function RagCitationList({
  citations,
  title = '규정 인용',
  maxItems = 3,
  compact = false,
  onOpenSource,
}: RagCitationListProps) {
  const displayCitations = maxItems > 0 ? citations.slice(0, maxItems) : citations;
  const hasMore = maxItems > 0 && citations.length > maxItems;

  // Empty state
  if (citations.length === 0) {
    return (
      <Box sx={{ py: 8, textAlign: 'center' }}>
        <Iconify
          icon="solar:document-text-bold-duotone"
          width={48}
          sx={{ color: 'text.disabled', mb: 2 }}
        />
        <Typography variant="body2" color="text.secondary">
          규정 인용 근거가 없습니다
        </Typography>
      </Box>
    );
  }

  return (
    <Box>
      {title && (
        <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 2 }}>
          {title}
        </Typography>
      )}
      <Stack spacing={1.5}>
        {displayCitations.map((citation, index) => (
          <RagCitationCard
            key={citation.id || index}
            citation={citation}
            onOpenSource={onOpenSource}
            compact={compact}
          />
        ))}
      </Stack>
      {hasMore && (
        <Box sx={{ mt: 2, textAlign: 'center' }}>
          <Button size="small" variant="text">
            View All {citations.length} Citations
          </Button>
        </Box>
      )}
    </Box>
  );
}

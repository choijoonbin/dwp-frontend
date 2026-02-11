/**
 * RAG 인용 모달 — 규정집 본문 표시 및 인용 문장(quote) 하이라이트
 * 워크벤치·케이스·라인에이지 등에서 공통 사용
 */

import { useMemo } from 'react';
import { Iconify } from '@dwp-frontend/design-system';
import { useTranslation } from '@dwp-frontend/shared-i18n';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Dialog from '@mui/material/Dialog';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import DialogTitle from '@mui/material/DialogTitle';
import { alpha, useTheme } from '@mui/material/styles';
import DialogContent from '@mui/material/DialogContent';

import type { RagCitation } from './types';

// ----------------------------------------------------------------------

/** RagCitation 또는 워크벤치 RagContribution 호환 */
export type RagCitationModalPayload = Pick<
  RagCitation,
  'title' | 'docTitle' | 'quote' | 'relevanceScore' | 'bodyText' | 'policyCode' | 'pageNumber'
> & {
  excerpt?: string;
};

interface RagCitationModalProps {
  open: boolean;
  onClose: () => void;
  citation: RagCitationModalPayload | null;
}

/** bodyText 내에서 quote 문장을 찾아 하이라이트된 React 노드로 반환 */
function highlightQuoteInBody(bodyText: string, quote: string): React.ReactNode {
  const trimmedQuote = (quote ?? '').trim();
  if (!trimmedQuote || !bodyText) {
    return bodyText;
  }
  const idx = bodyText.indexOf(trimmedQuote);
  if (idx === -1) {
    return bodyText;
  }
  const before = bodyText.slice(0, idx);
  const highlighted = bodyText.slice(idx, idx + trimmedQuote.length);
  const after = bodyText.slice(idx + trimmedQuote.length);
  return (
    <>
      {before}
      <Box
        component="mark"
        sx={{
          bgcolor: (theme) => alpha(theme.palette.primary.main, 0.15),
          color: 'text.primary',
          px: 0.5,
          borderRadius: 0.5,
          borderLeft: '3px solid',
          borderColor: 'primary.main',
        }}
      >
        {highlighted}
      </Box>
      {after}
    </>
  );
}

export function RagCitationModal({ open, onClose, citation }: RagCitationModalProps) {
  const theme = useTheme();
  const { t } = useTranslation('common');

  const title = citation?.docTitle ?? citation?.title ?? t('workbench.thought.citation');
  const quote = citation?.quote ?? citation?.excerpt ?? '';
  const bodyText = citation?.bodyText ?? '';
  const score = citation?.relevanceScore;

  const bodyContent = useMemo(() => {
    if (bodyText && quote) {
      return highlightQuoteInBody(bodyText, quote);
    }
    if (quote) {
      return (
        <Box
          component="blockquote"
          sx={{
            pl: 2,
            borderLeft: '4px solid',
            borderColor: 'primary.main',
            bgcolor: (muiTheme) => alpha(muiTheme.palette.primary.main, 0.08),
            py: 1.5,
            pr: 2,
            borderRadius: 1,
          }}
        >
          <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
            {quote}
          </Typography>
        </Box>
      );
    }
    return (
      <Typography variant="body2" color="text.secondary">
        {t('workbench.thought.citationNoExcerpt')}
      </Typography>
    );
  }, [bodyText, quote, t]);

  if (!citation) return null;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 1,
          pr: 6,
        }}
      >
        <Stack direction="row" alignItems="center" spacing={1} sx={{ minWidth: 0 }}>
          <Iconify icon="solar:book-bookmark-bold-duotone" width={24} sx={{ color: 'primary.main', flexShrink: 0 }} />
          <Typography variant="h6" sx={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {title}
          </Typography>
        </Stack>
        <IconButton
          aria-label="Close"
          onClick={onClose}
          sx={{ position: 'absolute', right: 8, top: 8 }}
        >
          <Iconify icon="solar:close-circle-bold" width={24} />
        </IconButton>
      </DialogTitle>
      <DialogContent dividers sx={{ pt: 1 }}>
        <Stack spacing={2}>
          {(score != null || citation.policyCode || citation.pageNumber != null) && (
            <Stack direction="row" flexWrap="wrap" gap={1} alignItems="center">
              {score != null && (
                <Chip
                  size="small"
                  label={`${t('workbench.thought.relevance')} ${score}%`}
                  sx={{
                    fontWeight: 600,
                    bgcolor:
                      score >= 90
                        ? alpha(theme.palette.success.main, 0.15)
                        : score >= 70
                          ? alpha(theme.palette.primary.main, 0.15)
                          : alpha(theme.palette.warning.main, 0.15),
                    color:
                      score >= 90 ? 'success.dark' : score >= 70 ? 'primary.dark' : 'warning.dark',
                  }}
                />
              )}
              {citation.policyCode && (
                <Chip size="small" variant="outlined" label={citation.policyCode} />
              )}
              {citation.pageNumber != null && (
                <Chip
                  size="small"
                  icon={<Iconify icon="solar:document-text-bold" width={12} />}
                  label={`${t('workbench.thought.page')} ${citation.pageNumber}`}
                  variant="outlined"
                />
              )}
            </Stack>
          )}

          <Box>
            <Typography variant="overline" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
              {bodyText && quote ? t('workbench.thought.citedExcerpt') : t('workbench.thought.excerpt')}
            </Typography>
            <Box sx={{ '& .MuiTypography-root': { lineHeight: 1.8 }, '& mark': { whiteSpace: 'pre-wrap' } }}>
              {bodyContent}
            </Box>
          </Box>
        </Stack>
      </DialogContent>
    </Dialog>
  );
}

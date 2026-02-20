import { Iconify } from '@dwp-frontend/design-system';
import { useTranslation } from '@dwp-frontend/shared-i18n';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import CardContent from '@mui/material/CardContent';
import { alpha, useTheme } from '@mui/material/styles';

import { ContextBreadcrumb } from './context-breadcrumb';
import { type RagCitation, type HierarchyPathItem, isScenarioCitation } from './types';

// ----------------------------------------------------------------------

interface RagCitationCardProps {
  citation: RagCitation;
  onOpenSource?: (source: string) => void;
  /** Evidence Link: Severity 클릭 또는 breadcrumb 클릭 시 원문 위치로 이동 */
  onNavigateToEvidence?: (anchorId: string, citation: RagCitation) => void;
  compact?: boolean;
}

export function RagCitationCard({ citation, onOpenSource, onNavigateToEvidence, compact = false }: RagCitationCardProps) {
  const theme = useTheme();
  const { t } = useTranslation('common');
  const isScenario = isScenarioCitation(citation);

  const scoreColor =
    (citation.relevanceScore ?? 0) >= 90
      ? 'success.main'
      : (citation.relevanceScore ?? 0) >= 70
        ? 'primary.main'
        : 'warning.main';

  const displayTitle = citation.docTitle || citation.title;
  const displaySource = citation.source || '';

  const severityColors: Record<string, string> = {
    HIGH: theme.palette.error.main,
    MEDIUM: theme.palette.warning.main,
    LOW: theme.palette.success.main,
  };

  const handleBreadcrumbNavigate = (item: HierarchyPathItem) => {
    if (item.anchorId && onNavigateToEvidence) {
      onNavigateToEvidence(item.anchorId, citation);
    }
  };

  const handleSeverityClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (citation.anchorId && onNavigateToEvidence) {
      onNavigateToEvidence(citation.anchorId, citation);
    }
  };

  return (
    <Card
      sx={{
        cursor: onOpenSource && displaySource ? 'pointer' : 'default',
        '&:hover': onOpenSource && displaySource
          ? { bgcolor: alpha(theme.palette.primary.main, 0.04) }
          : {},
        transition: 'background-color 0.2s',
      }}
      onClick={() => displaySource && onOpenSource?.(displaySource)}
    >
      <CardContent sx={{ p: compact ? 1.5 : 2 }}>
        <Stack spacing={compact ? 1 : 1.5}>
          {/* Context Breadcrumb (계층 경로) */}
          {citation.hierarchyPath && citation.hierarchyPath.length > 0 && (
            <ContextBreadcrumb
              path={citation.hierarchyPath}
              onNavigate={onNavigateToEvidence ? handleBreadcrumbNavigate : undefined}
              compact={compact}
            />
          )}

          {/* Header: Title + Score + Severity */}
          <Stack
            direction="row"
            spacing={1}
            alignItems="center"
            justifyContent="space-between"
          >
            <Stack direction="row" spacing={1} alignItems="center" sx={{ flex: 1, minWidth: 0 }}>
              <Iconify
                icon="solar:book-bookmark-bold-duotone"
                width={compact ? 16 : 18}
                sx={{ color: 'primary.main', flexShrink: 0 }}
              />
              <Typography
                variant={compact ? 'caption' : 'body2'}
                sx={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis' }}
              >
                {displayTitle}
              </Typography>
            </Stack>
            <Stack direction="row" spacing={1} alignItems="center">
              {/* Severity Badge (Evidence Link) */}
              {citation.severity && (
                <Tooltip
                  title={citation.anchorId ? t('evidence.clickToNavigate', { defaultValue: '클릭하여 원문 위치로 이동' }) : ''}
                  arrow
                >
                  <Chip
                    label={citation.severity}
                    size="small"
                    onClick={citation.anchorId ? handleSeverityClick : undefined}
                    sx={{
                      fontWeight: 700,
                      fontSize: '0.625rem',
                      height: 20,
                      bgcolor: alpha(severityColors[citation.severity] || theme.palette.grey[500], 0.12),
                      color: severityColors[citation.severity] || theme.palette.text.primary,
                      cursor: citation.anchorId ? 'pointer' : 'default',
                      '&:hover': citation.anchorId
                        ? { bgcolor: alpha(severityColors[citation.severity] || theme.palette.grey[500], 0.24) }
                        : {},
                    }}
                  />
                </Tooltip>
              )}
              {citation.relevanceScore != null && (
                <Typography variant={compact ? 'body2' : 'h6'} sx={{ fontWeight: 700, color: scoreColor, flexShrink: 0 }}>
                  {citation.relevanceScore}%
                </Typography>
              )}
            </Stack>
          </Stack>

          {/* Policy Code + Page + Scenario Data label */}
          <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
            {isScenario && (
              <Chip
                label={t('workbench.thought.scenarioDataLabel')}
                size="small"
                color="warning"
                variant="filled"
                sx={{ fontWeight: 600 }}
              />
            )}
            {citation.policyCode && (
              <Chip label={citation.policyCode} size="small" variant="outlined" />
            )}
            {citation.pageNumber != null && (
              <Chip
                icon={<Iconify icon="solar:document-text-bold" width={12} />}
                label={`Page ${citation.pageNumber}`}
                size="small"
                variant="filled"
                sx={{ bgcolor: 'action.selected' }}
              />
            )}
          </Stack>

          {/* Quote */}
          {citation.quote && (
            <Stack direction="row" spacing={1} alignItems="flex-start">
              <Iconify
                icon="solar:quotes-bold-duotone"
                width={compact ? 14 : 16}
                sx={{ color: 'text.secondary', mt: 0.25, flexShrink: 0 }}
              />
              <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1.75 }}>
                {citation.quote}
              </Typography>
            </Stack>
          )}

          {/* Open Source Button */}
          {onOpenSource && displaySource && !compact && (
            <Box sx={{ pt: 0.5 }}>
              <Button
                size="small"
                variant="text"
                startIcon={<Iconify icon="solar:eye-bold" width={14} />}
                sx={{ minWidth: 'auto', px: 1 }}
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenSource(displaySource);
                }}
              >
                Open Source
              </Button>
            </Box>
          )}
        </Stack>
      </CardContent>
    </Card>
  );
}

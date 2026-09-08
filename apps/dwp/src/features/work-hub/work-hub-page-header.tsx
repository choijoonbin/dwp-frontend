import { useTranslation } from 'react-i18next';
import { DatabaseZap, Plus } from 'lucide-react';
import { ActionButton, LiveStatus } from '@dwp-frontend/design-system';
import { formatDate } from '@dwp-frontend/shared-i18n';
import type { workspaceWorkFreshness } from '@dwp-frontend/shared-utils';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import type { WorkHubView } from './work-hub-view-navigation';

export function WorkHubPageHeader({
  view,
  count,
  complete,
  freshness,
  generatedAt,
  refreshing,
  canCreate,
  onRefresh,
  onSources,
  onCreate,
}: {
  view: WorkHubView;
  count: number;
  complete: boolean;
  freshness: ReturnType<typeof workspaceWorkFreshness>;
  generatedAt?: string | null;
  refreshing: boolean;
  canCreate: boolean;
  onRefresh: () => void;
  onSources: () => void;
  onCreate: () => void;
}) {
  const { t } = useTranslation('work');
  return (
    <Stack
      direction={{ xs: 'column', md: 'row' }}
      justifyContent="space-between"
      gap={1.5}
      alignItems={{ md: 'center' }}
      sx={{ pb: 1.5 }}
    >
      <Box sx={{ minWidth: 0 }}>
        <Stack direction="row" gap={1} alignItems="center" flexWrap="wrap">
          <Typography
            component="h1"
            variant="h4"
            sx={{
              fontWeight: 'fontWeightBold',
              fontSize: { xs: 'h5.fontSize', md: 'h4.fontSize' },
              letterSpacing: 'h4.letterSpacing',
            }}
          >
            {t(`work:workHub.viewTitles.${view}`)}
          </Typography>
          <Chip
            size="small"
            variant="outlined"
            label={
              complete
                ? t('work:workHub.filters.results', { count: count })
                : t('work:workHub.header.partialCount', { count: count })
            }
          />
        </Stack>
        <Typography
          variant="body2"
          color="text.secondary"
          sx={{ mt: 0.5, fontSize: 'body2.fontSize', display: { xs: 'none', sm: 'block' } }}
        >
          {t(
            view === 'day-plan'
              ? 'work:workHub.todayPlan.independenceNotice'
              : 'work:workHub.header.description'
          )}
        </Typography>
      </Box>
      <Stack direction="row" gap={1} alignItems="center" flexWrap="wrap">
        <Box
          sx={{
            '@media (max-width:899.95px)': {
              '& .MuiIconButton-root': { minWidth: 44, minHeight: 44 },
            },
          }}
        >
          <LiveStatus
            state={freshness}
            label={t(`work:workPage.freshness.${freshness}`)}
            detail={
              generatedAt
                ? t('work:workPage.freshness.generatedAt', {
                    date: formatDate(generatedAt, {
                      dateStyle: 'short',
                      timeStyle: 'short',
                    }),
                  })
                : t('work:workPage.freshness.unknown')
            }
            refreshLabel={t('work:workPage.retry')}
            refreshing={refreshing}
            onRefresh={onRefresh}
          />
        </Box>
        <ActionButton
          intent="quiet"
          startIcon={<DatabaseZap size={17} />}
          onClick={onSources}
          sx={{ display: { xs: 'none', sm: 'inline-flex' } }}
        >
          {t('work:workHub.sourcesDialog.open')}
        </ActionButton>
        {canCreate && (
          <ActionButton
            intent="primary"
            startIcon={<Plus size={17} />}
            onClick={onCreate}
            sx={{ '@media (max-width:899.95px)': { minHeight: 44 } }}
          >
            {t('work:workHub.actions.createTask')}
          </ActionButton>
        )}
      </Stack>
    </Stack>
  );
}

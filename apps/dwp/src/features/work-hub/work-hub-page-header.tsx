import { useId } from 'react';
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
import { useWorkHubKeyboardShortcuts } from './use-work-hub-keyboard-shortcuts';

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
  const createHelpId = useId();
  const showCreate = canCreate && view !== 'day-plan';
  useWorkHubKeyboardShortcuts({ onCreate: canCreate && !refreshing ? onCreate : undefined });
  return (
    <Box
      data-testid="work-hub-page-header"
      sx={{
        display: 'grid',
        gridTemplateColumns: {
          xs: 'minmax(0, 1fr) auto',
          md: 'minmax(0, 1fr) auto auto auto',
        },
        alignItems: 'center',
        columnGap: 1,
        rowGap: { xs: 0.75, md: 1 },
        pb: { xs: 1, md: 1.5 },
      }}
    >
      <Box sx={{ minWidth: 0, gridColumn: 1, gridRow: 1 }}>
        <Stack direction="row" gap={0.75} alignItems="center" flexWrap="wrap">
          <Typography
            component="h1"
            variant="h4"
            sx={{
              fontWeight: 'fontWeightBold',
              fontSize: { xs: 'h5.fontSize', md: 'h4.fontSize' },
              letterSpacing: 'h4.letterSpacing',
              '@media (max-width: 359.95px)': { fontSize: '1.125rem' },
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
        {showCreate && (
          <Typography
            id={createHelpId}
            variant="caption"
            color="text.secondary"
            component="p"
            sx={{
              position: 'absolute',
              width: '1px',
              height: '1px',
              p: 0,
              m: -1,
              overflow: 'hidden',
              clip: 'rect(0 0 0 0)',
              whiteSpace: 'nowrap',
              border: 0,
            }}
          >
            {t('workHub.keyboardShortcuts.createHelp')}
          </Typography>
        )}
      </Box>
      <Box
        sx={{
          gridColumn: { xs: '1 / -1', md: 2 },
          gridRow: { xs: 2, md: 1 },
          minWidth: 0,
          '& .MuiIconButton-root': { minWidth: 44, minHeight: 44 },
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
        sx={{ display: { xs: 'none', md: 'inline-flex' }, gridColumn: 3, gridRow: 1 }}
      >
        {t('work:workHub.sourcesDialog.open')}
      </ActionButton>
      {showCreate && (
        <ActionButton
          intent="primary"
          startIcon={<Plus size={17} />}
          onClick={onCreate}
          aria-keyshortcuts="Alt+Shift+N Meta+N Control+N"
          aria-describedby={createHelpId}
          sx={{
            minHeight: 44,
            px: { xs: 1.25, sm: 2 },
            gridColumn: { xs: 2, md: 4 },
            gridRow: 1,
            whiteSpace: 'nowrap',
          }}
        >
          {t('work:workHub.actions.createTask')}
        </ActionButton>
      )}
    </Box>
  );
}

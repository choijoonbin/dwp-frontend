import { useTranslation } from 'react-i18next';
import { BellRing, RefreshCw, Search } from 'lucide-react';
import { ActionIconButton, FormField } from '@dwp-frontend/design-system';
import { formatDate } from '@dwp-frontend/shared-i18n';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import InputAdornment from '@mui/material/InputAdornment';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { alpha } from '@mui/material/styles';
import type { NotificationConnectionState } from './use-notification-runtime';

export function NotificationHomeHeader({
  search,
  onSearchChange,
  onSearch,
  state,
  generatedAt,
  refreshing,
  onRefresh,
}: {
  search: string;
  onSearchChange: (value: string) => void;
  onSearch: () => void;
  state: NotificationConnectionState;
  generatedAt?: string;
  refreshing: boolean;
  onRefresh: () => void;
}) {
  const { t } = useTranslation('notifications');
  return (
    <Box
      component="header"
      data-testid="notification-home-header"
      sx={{
        display: 'grid',
        gridTemplateColumns: { xs: 'minmax(0, 1fr) auto', md: 'auto minmax(220px, 1fr) auto' },
        gridTemplateAreas: {
          xs: '"title state" "search search"',
          md: '"title search state"',
        },
        alignItems: 'center',
        gap: { xs: 1.25, md: 2 },
        p: { xs: 1.25, md: 2 },
        border: 1,
        borderColor: 'divider',
        borderRadius: (theme) => `${theme.shape.borderRadius}px`,
        bgcolor: 'background.paper',
        boxShadow: 'var(--notification-panel-shadow)',
      }}
    >
      <Stack direction="row" spacing={1.25} alignItems="center" sx={{ gridArea: 'title' }}>
        <Box sx={{ display: 'grid', color: 'primary.main' }}>
          <BellRing size={23} strokeWidth={1.8} aria-hidden="true" />
        </Box>
        <Box>
          <Typography component="h1" variant="h5">
            {t('home.title')}
          </Typography>
        </Box>
      </Stack>
      <Box
        component="form"
        role="search"
        onSubmit={(event) => {
          event.preventDefault();
          onSearch();
        }}
        sx={{ gridArea: 'search', minWidth: 0, display: 'flex', gap: 0.75 }}
      >
        <FormField
          fullWidth
          size="small"
          type="search"
          value={search}
          placeholder={t('home.searchPlaceholder')}
          onChange={(event) => onSearchChange(event.target.value)}
          slotProps={{
            htmlInput: { 'aria-label': t('home.searchLabel') },
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <Search size={16} />
                </InputAdornment>
              ),
            },
          }}
          sx={(theme) => ({
            '& .MuiOutlinedInput-root': { bgcolor: alpha(theme.palette.primary.main, 0.025) },
          })}
        />
        <ActionIconButton label={t('actions.search')} type="submit">
          <Search size={17} />
        </ActionIconButton>
      </Box>
      <Stack
        direction="row"
        gap={0.5}
        alignItems="center"
        sx={{ gridArea: 'state', justifyContent: 'flex-end' }}
      >
        <Chip
          size="small"
          label={
            <Stack direction="row" alignItems="center" gap={1}>
              <Box component="span">{state === 'live' ? t('home.live') : t(`states.${state}`)}</Box>
              {generatedAt && (
                <Typography
                  component="time"
                  dateTime={generatedAt}
                  variant="caption"
                  sx={{ display: { xs: 'none', md: 'inline' } }}
                >
                  {t('workbench.syncedAt', {
                    time: formatDate(generatedAt, { hour: '2-digit', minute: '2-digit' }),
                  })}
                </Typography>
              )}
            </Stack>
          }
          sx={{ height: 32, bgcolor: 'action.hover', '& .MuiChip-icon': { ml: 1.25 } }}
          icon={
            <Box
              component="span"
              sx={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                bgcolor: state === 'live' ? 'success.main' : 'warning.main',
              }}
            />
          }
        />
        <ActionIconButton label={t('actions.refresh')} loading={refreshing} onClick={onRefresh}>
          <RefreshCw size={17} />
        </ActionIconButton>
      </Stack>
    </Box>
  );
}

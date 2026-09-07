import { useTranslation } from 'react-i18next';
import { BellRing, RefreshCw, Search } from 'lucide-react';
import { ActionIconButton, FormField, GlyphSurface } from '@dwp-frontend/design-system';
import { formatDate } from '@dwp-frontend/shared-i18n';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import InputAdornment from '@mui/material/InputAdornment';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
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
      sx={{
        display: 'grid',
        gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: 'auto minmax(220px, 1fr) auto' },
        alignItems: 'center',
        gap: { xs: 1.5, md: 3 },
        pb: 2,
        borderBottom: 1,
        borderColor: 'divider',
      }}
    >
      <Stack direction="row" spacing={1.25} alignItems="center">
        <GlyphSurface size={38} variant="soft">
          <BellRing size={19} />
        </GlyphSurface>
        <Box>
          <Typography component="h1" variant="h5">
            {t('home.title')}
          </Typography>
          {generatedAt && (
            <Typography
              component="time"
              dateTime={generatedAt}
              variant="caption"
              color="text.secondary"
            >
              {t('workbench.syncedAt', {
                time: formatDate(generatedAt, { hour: '2-digit', minute: '2-digit' }),
              })}
            </Typography>
          )}
        </Box>
      </Stack>
      <Box
        component="form"
        role="search"
        onSubmit={(event) => {
          event.preventDefault();
          onSearch();
        }}
        sx={{ order: { xs: 2, md: 0 }, minWidth: 0 }}
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
                  <Search size={17} />
                </InputAdornment>
              ),
              endAdornment: (
                <InputAdornment position="end">
                  <ActionIconButton label={t('home.searchAction')} type="submit" size="small">
                    <Search size={17} />
                  </ActionIconButton>
                </InputAdornment>
              ),
            },
          }}
        />
      </Box>
      <Stack
        direction="row"
        gap={0.5}
        alignItems="center"
        sx={{ justifyContent: { xs: 'flex-start', md: 'flex-end' } }}
      >
        <Chip
          size="small"
          variant="outlined"
          label={state === 'live' ? t('home.live') : t(`states.${state}`)}
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

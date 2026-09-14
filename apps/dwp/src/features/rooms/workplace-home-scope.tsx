import { foundationTokens } from '@dwp-frontend/design-system';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDown, MapPin } from 'lucide-react';
import {
  ActionButton,
  DateTimePickerField,
  DwpDateTimeProvider,
  SelectField,
} from '@dwp-frontend/design-system';
import { formatDate, resolveSupportedLocale } from '@dwp-frontend/shared-i18n';
import { Link } from 'react-router-dom';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useTheme } from '@mui/material/styles';
import type { ReactNode } from 'react';
import type { WorkplaceExploreResponse } from '@dwp-frontend/shared-utils';

export function WorkplaceHomeScope({
  catalog,
  floorId,
  startsAt,
  timeZone,
  discoveryPath,
  status,
  busy,
  onFloorChange,
  onStartChange,
}: {
  catalog: WorkplaceExploreResponse | undefined;
  floorId: string;
  startsAt: string;
  timeZone: string;
  discoveryPath: string;
  status: ReactNode;
  busy: boolean;
  onFloorChange: (floorId: string) => void;
  onStartChange: (value: string | null) => void;
}) {
  const { t, i18n } = useTranslation('rooms');
  const desktop = useMediaQuery(useTheme().breakpoints.up('md'));
  const [editingScope, setEditingScope] = useState(false);
  const floor = catalog?.floors.find((item) => item.floorId === floorId) ?? catalog?.selectedFloor;
  const site = catalog?.sites.find((item) => item.siteId === floor?.siteId) ?? catalog?.sites[0];
  const floors = catalog?.floors.filter((item) => item.siteId === site?.siteId) ?? [];
  const locale = resolveSupportedLocale(i18n.resolvedLanguage);
  return (
    <Box component="header" data-testid="workplace-home-scope">
      <Stack
        direction={{ xs: 'column', md: 'row' }}
        justifyContent="space-between"
        gap={1.5}
        alignItems={{ xs: 'stretch', md: 'center' }}
      >
        <Box minWidth={0}>
          <Stack
            direction="row"
            gap={0.75}
            alignItems="center"
            justifyContent="space-between"
            color="text.secondary"
            sx={{ display: { xs: 'flex', md: 'none' } }}
          >
            <ActionButton
              intent="quiet"
              size="small"
              aria-label={t('workplace.home.changeScope')}
              aria-expanded={editingScope}
              aria-controls="workplace-home-scope-fields"
              startIcon={<MapPin size={14} />}
              endIcon={<ChevronDown size={14} />}
              onClick={() => setEditingScope((current) => !current)}
              sx={{
                ...foundationTokens.workplace.typography.smallBody,
                color: 'text.secondary',
                p: 0,
                minWidth: 0,
                textAlign: 'left',
              }}
            >
              {[site?.name, floor?.name].filter(Boolean).join(' · ') ||
                t('workplace.home.availability.noScope')}
            </ActionButton>
            {status}
          </Stack>
          <Typography
            variant="overline"
            color="primary.main"
            sx={{
              ...foundationTokens.workplace.typography.caption,
              display: { xs: 'none', md: 'block' },
            }}
          >
            {t('workplace.home.eyebrow')}
          </Typography>
          <Typography
            component="h1"
            variant="h5"
            sx={{
              ...foundationTokens.workplace.typography.pageTitle,
              fontSize: {
                xs: foundationTokens.workplace.typography.sectionTitle.fontSize,
                md: foundationTokens.workplace.typography.pageTitle.fontSize,
              },
              lineHeight: {
                xs: foundationTokens.workplace.typography.sectionTitle.lineHeight,
                md: foundationTokens.workplace.typography.pageTitle.lineHeight,
              },
              mt: { xs: 0.5, md: 0 },
            }}
          >
            {desktop
              ? [site?.name, floor?.name].filter(Boolean).join(' · ') ||
                t('workplace.home.availability.noScope')
              : t('workplace.home.mobileTitle')}
          </Typography>
          <Stack
            direction="row"
            gap={0.75}
            alignItems="center"
            sx={{ mt: 0.75, display: { xs: 'none', md: 'flex' } }}
          >
            <MapPin size={14} aria-hidden="true" />
            <Typography
              variant="caption"
              color="text.secondary"
              sx={foundationTokens.workplace.typography.smallBody}
            >
              {formatDate(new Date(), { dateStyle: 'full', timeZone }, locale)}
            </Typography>
          </Stack>
        </Box>
        <Stack
          direction="row"
          gap={1}
          useFlexGap
          flexWrap="wrap"
          alignItems="center"
          sx={{ display: { xs: 'none', md: 'flex' } }}
        >
          {status}
          <ActionButton
            intent="quiet"
            size="small"
            aria-expanded={editingScope}
            aria-controls="workplace-home-scope-fields"
            endIcon={<ChevronDown size={16} />}
            onClick={() => setEditingScope((current) => !current)}
            sx={{ order: { xs: 1, md: 0 } }}
          >
            {t('workplace.home.changeScope')}
          </ActionButton>
          <ActionButton component={Link} to={discoveryPath} intent="primary" size="small">
            {t('workplace.home.findSpace')}
          </ActionButton>
        </Stack>
      </Stack>
      {editingScope && (
        <Box
          id="workplace-home-scope-fields"
          component="section"
          aria-label={t('workplace.home.scopeTitle')}
          sx={{
            display: 'grid',
            gridTemplateColumns: {
              xs: '1fr',
              sm: 'minmax(0, 1fr) minmax(0, 1fr)',
              md: 'minmax(0, 1fr) minmax(0, 1fr) minmax(260px, 1.5fr)',
            },
            gap: 1,
            mt: 1.5,
          }}
        >
          <SelectField
            size="small"
            label={t('workplace.explore.site')}
            value={site?.siteId ?? ''}
            disabled={busy || !catalog?.sites.length}
            options={(catalog?.sites ?? []).map((item) => ({
              value: item.siteId,
              label: item.name,
              disabled: !catalog?.floors.some((candidate) => candidate.siteId === item.siteId),
            }))}
            onValueChange={(value) => {
              const first = catalog?.floors.find((item) => item.siteId === value);
              if (first) onFloorChange(first.floorId);
            }}
          />
          <SelectField
            size="small"
            label={t('workplace.explore.floor')}
            value={floor?.floorId ?? ''}
            disabled={busy || !floors.length}
            options={floors.map((item) => ({ value: item.floorId, label: item.name }))}
            onValueChange={onFloorChange}
          />
          <DwpDateTimeProvider timeZone={timeZone} locale={i18n.resolvedLanguage}>
            <DateTimePickerField
              size="small"
              label={t('workplace.experience.startsAt')}
              value={startsAt}
              disabled={busy || !floor}
              onValueChange={onStartChange}
              sx={{ gridColumn: { sm: '1 / -1', md: 'auto' } }}
            />
          </DwpDateTimeProvider>
        </Box>
      )}
    </Box>
  );
}

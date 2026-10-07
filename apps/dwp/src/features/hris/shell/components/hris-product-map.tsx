import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CircleDashed, ExternalLink, LockKeyhole, TestTube2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import Box from '@mui/material/Box';
import Divider from '@mui/material/Divider';
import Stack from '@mui/material/Stack';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Typography from '@mui/material/Typography';
import { alpha } from '@mui/material/styles';

import {
  filterHrisCatalog,
  HRIS_INVENTORY_GROUP_ORDER,
  HRIS_PRODUCT_MAP_CATALOG,
  resolveHrisCatalogLocale,
} from '../model/hris-product-map-catalog';
import { CatalogGroup } from './hris-product-map-group';

import type {
  HrisLifecycle,
  HrisModule,
  HrisPersona,
  HrisWorkSurface,
} from '../model/hris-product-map-catalog';

const SURFACES: readonly HrisWorkSurface[] = ['HOME', 'MY_HR', 'TEAM', 'OPERATIONS', 'SETTINGS'];
const MODULES: readonly (HrisModule | 'ALL')[] = ['ALL', 'SYS', 'HRM', 'TIM', 'PAY', 'PER'];
const PERSONAS: readonly (HrisPersona | 'ALL')[] = [
  'ALL',
  'EMPLOYEE',
  'MANAGER',
  'OPERATOR',
  'SETTINGS_ADMIN',
  'AUDITOR',
];

const lifecycleIcon = {
  PILOT: TestTube2,
  PLANNED: CircleDashed,
  BLOCKED_EVIDENCE: LockKeyhole,
  EXTERNAL: ExternalLink,
} satisfies Record<HrisLifecycle, typeof CircleDashed>;

type HrisProductMapProps = {
  initialSurface?: HrisWorkSurface;
  canOpenPath: (path: string) => boolean;
};

export function HrisProductMap({ initialSurface = 'HOME', canOpenPath }: HrisProductMapProps) {
  const { t, i18n } = useTranslation('hcm');
  const navigate = useNavigate();
  const locale = resolveHrisCatalogLocale(i18n.resolvedLanguage ?? i18n.language);
  const [surface, setSurface] = useState<HrisWorkSurface>(initialSurface);
  const [module, setModule] = useState<HrisModule | 'ALL'>('ALL');
  const [persona, setPersona] = useState<HrisPersona | 'ALL'>('ALL');
  const visibleItems = useMemo(
    () => filterHrisCatalog(surface, module, persona),
    [module, persona, surface]
  );
  const visibleGroups = useMemo(
    () =>
      HRIS_INVENTORY_GROUP_ORDER.map((group) => ({
        group,
        items: visibleItems.filter((item) => item.inventoryGroup === group),
      })).filter(({ items }) => items.length > 0),
    [visibleItems]
  );
  const pilotCount = HRIS_PRODUCT_MAP_CATALOG.filter((item) => item.lifecycle === 'PILOT').length;

  return (
    <Box
      component="section"
      data-testid="hris-product-map"
      aria-labelledby="hris-product-map-title"
      sx={{ mt: 2.5, mb: 3.5 }}
    >
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', md: 'minmax(0, 1fr) auto' },
          alignItems: 'end',
          gap: 2,
          pb: 2,
        }}
      >
        <Box>
          <Typography variant="overline" color="primary.main">
            {t('productMap.eyebrow')}
          </Typography>
          <Typography id="hris-product-map-title" component="h2" variant="h5">
            {t('productMap.title')}
          </Typography>
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{ mt: 0.65, maxWidth: 760, wordBreak: 'keep-all' }}
          >
            {t('productMap.description')}
          </Typography>
        </Box>
        <Stack
          direction="row"
          divider={<Divider orientation="vertical" flexItem />}
          sx={{ color: 'text.secondary', justifySelf: { md: 'end' } }}
        >
          <Box sx={{ pr: 1.5 }}>
            <Typography component="span" variant="h6" color="text.primary" display="block">
              {HRIS_PRODUCT_MAP_CATALOG.length}
            </Typography>
            <Typography variant="caption">{t('productMap.metrics.total')}</Typography>
          </Box>
          <Box sx={{ px: 1.5 }}>
            <Typography component="span" variant="h6" color="text.primary" display="block">
              {pilotCount}
            </Typography>
            <Typography variant="caption">{t('productMap.metrics.pilot')}</Typography>
          </Box>
          <Box sx={{ pl: 1.5 }}>
            <Typography component="span" variant="h6" color="text.primary" display="block">
              {SURFACES.length}
            </Typography>
            <Typography variant="caption">{t('productMap.metrics.surfaces')}</Typography>
          </Box>
        </Stack>
      </Box>

      <Box
        sx={(theme) => ({
          border: 1,
          borderColor: 'divider',
          borderRadius: 'shape.borderRadius',
          overflow: 'hidden',
          bgcolor: alpha(theme.palette.background.paper, 0.76),
        })}
      >
        <Box
          component="nav"
          aria-label={t('productMap.surfaceLabel')}
          sx={{ px: { xs: 1, sm: 1.5 }, pt: 1.25, overflowX: 'auto' }}
        >
          <ToggleButtonGroup
            exclusive
            size="small"
            value={surface}
            onChange={(_, next: HrisWorkSurface | null) => next && setSurface(next)}
            aria-label={t('productMap.surfaceLabel')}
            sx={{ minWidth: 'max-content' }}
          >
            {SURFACES.map((item) => {
              const count = HRIS_PRODUCT_MAP_CATALOG.filter(
                (entry) => entry.surface === item
              ).length;
              return (
                <ToggleButton
                  key={item}
                  value={item}
                  aria-label={t('productMap.surfaceOption', {
                    label: t(`productMap.surface.${item}`),
                    count,
                  })}
                  sx={{ minHeight: 40, px: { xs: 1.25, sm: 1.8 }, gap: 0.7 }}
                >
                  <span>{t(`productMap.surface.${item}`)}</span>
                  <Typography
                    component="span"
                    aria-hidden="true"
                    variant="caption"
                    color="text.secondary"
                  >
                    {count}
                  </Typography>
                </ToggleButton>
              );
            })}
          </ToggleButtonGroup>
        </Box>

        <Stack
          direction={{ xs: 'column', md: 'row' }}
          gap={1.25}
          sx={{ px: { xs: 1, sm: 1.5 }, py: 1.25 }}
        >
          <ToggleButtonGroup
            exclusive
            size="small"
            value={module}
            onChange={(_, next: HrisModule | 'ALL' | null) => next && setModule(next)}
            aria-label={t('productMap.moduleLabel')}
            sx={{ flexWrap: 'wrap', gap: 0.5, '& .MuiToggleButtonGroup-grouped': { m: 0 } }}
          >
            {MODULES.map((item) => (
              <ToggleButton
                key={item}
                value={item}
                sx={{
                  minHeight: 36,
                  border: 1,
                  borderColor: 'divider',
                  borderRadius: 'shape.borderRadius',
                }}
              >
                {t(`productMap.module.${item}`)}
              </ToggleButton>
            ))}
          </ToggleButtonGroup>
          <ToggleButtonGroup
            exclusive
            size="small"
            value={persona}
            onChange={(_, next: HrisPersona | 'ALL' | null) => next && setPersona(next)}
            aria-label={t('productMap.personaLabel')}
            sx={{ flexWrap: 'wrap', gap: 0.5, '& .MuiToggleButtonGroup-grouped': { m: 0 } }}
          >
            {PERSONAS.map((item) => (
              <ToggleButton
                key={item}
                value={item}
                sx={{
                  minHeight: 36,
                  border: 1,
                  borderColor: 'divider',
                  borderRadius: 'shape.borderRadius',
                }}
              >
                {t(`productMap.persona.${item}`)}
              </ToggleButton>
            ))}
          </ToggleButtonGroup>
        </Stack>

        <Divider />
        <Box
          role="status"
          aria-live="polite"
          aria-atomic="true"
          sx={{ px: { xs: 1.25, sm: 2 }, py: 1, borderBottom: 1, borderColor: 'divider' }}
        >
          <Typography variant="caption" color="text.secondary">
            {t('productMap.filteredResult', {
              surface: t(`productMap.surface.${surface}`),
              count: visibleItems.length,
            })}
          </Typography>
        </Box>
        <Stack
          direction="row"
          alignItems="center"
          flexWrap="wrap"
          gap={1}
          sx={{ px: { xs: 1.25, sm: 2 }, py: 1.15, bgcolor: 'action.hover' }}
          aria-label={t('productMap.legendLabel')}
        >
          {(['PILOT', 'PLANNED', 'BLOCKED_EVIDENCE', 'EXTERNAL'] as const).map((lifecycle) => {
            const Icon = lifecycleIcon[lifecycle];
            return (
              <Stack key={lifecycle} direction="row" alignItems="center" gap={0.45}>
                <Icon size={14} aria-hidden="true" />
                <Typography variant="caption">{t(`productMap.lifecycle.${lifecycle}`)}</Typography>
              </Stack>
            );
          })}
          <Typography variant="caption" color="text.secondary" sx={{ ml: { md: 'auto' } }}>
            {t('productMap.authorizationNote')}
          </Typography>
        </Stack>

        <Box data-testid="hris-product-map-results">
          {visibleGroups.length === 0 ? (
            <Box sx={{ px: 2, py: 4, textAlign: 'center' }} role="status">
              <Typography variant="subtitle2">{t('productMap.emptyTitle')}</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                {t('productMap.emptyDescription')}
              </Typography>
            </Box>
          ) : (
            visibleGroups.map(({ group, items }) => (
              <CatalogGroup
                key={group}
                group={group}
                items={items}
                locale={locale}
                onOpen={navigate}
                canOpenPath={canOpenPath}
              />
            ))
          )}
        </Box>
      </Box>
    </Box>
  );
}

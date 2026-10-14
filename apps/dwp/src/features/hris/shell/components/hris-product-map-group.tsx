import { useTranslation } from 'react-i18next';
import { ArrowUpRight, CircleDashed, ExternalLink, LockKeyhole, TestTube2 } from 'lucide-react';
import { ActionButton } from '@dwp-frontend/design-system';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { HRIS_GOVERNANCE_AUDIT_OVERVIEW_HREF } from '../model/catalog/dwp-control';
import { HRIS_INVENTORY_GROUP_LABELS } from '../model/hris-product-map-catalog';

import type {
  filterHrisCatalog,
  HrisAvailability,
  HrisInventoryGroup,
  HrisLifecycle,
} from '../model/hris-product-map-catalog';

const lifecycleIcon = {
  PILOT: TestTube2,
  PLANNED: CircleDashed,
  BLOCKED_EVIDENCE: LockKeyhole,
  EXTERNAL: ExternalLink,
} satisfies Record<HrisLifecycle, typeof CircleDashed>;

const lifecycleColor = {
  PILOT: 'success',
  PLANNED: 'default',
  BLOCKED_EVIDENCE: 'warning',
  EXTERNAL: 'info',
} satisfies Record<HrisLifecycle, 'success' | 'default' | 'warning' | 'info'>;

const availabilityColor = {
  CURRENT_RUNTIME: 'success',
  LEGACY_PARTIAL: 'info',
  ROADMAP: 'default',
  DWP_CONTROL_PLANE: 'info',
} satisfies Record<HrisAvailability, 'success' | 'default' | 'info'>;

function resolveCatalogOpenPath(
  item: ReturnType<typeof filterHrisCatalog>[number]
): string | undefined {
  if (item.lifecycle === 'PILOT') {
    return item.href;
  }
  if (
    item.id === 'dwp-governance' &&
    item.lifecycle === 'EXTERNAL' &&
    item.externalTarget === 'DWP_GOVERNANCE' &&
    item.authorization === 'CENTRAL_POLICY' &&
    item.href === HRIS_GOVERNANCE_AUDIT_OVERVIEW_HREF
  ) {
    return item.href;
  }
  return undefined;
}

export function CatalogGroup({
  group,
  items,
  locale,
  onOpen,
  canOpenPath,
}: {
  group: HrisInventoryGroup;
  items: ReturnType<typeof filterHrisCatalog>;
  locale: 'ko' | 'en';
  onOpen: (href: string) => void;
  canOpenPath: (path: string) => boolean;
}) {
  const { t } = useTranslation('hcm');
  return (
    <Box component="section" aria-labelledby={`hris-group-${group}`}>
      <Stack
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        sx={{ px: { xs: 1.25, sm: 2 }, py: 1.1, borderTop: 1, borderColor: 'divider' }}
      >
        <Typography id={`hris-group-${group}`} component="h3" variant="subtitle2">
          {HRIS_INVENTORY_GROUP_LABELS[group][locale]}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {t('productMap.resultCount', { count: items.length })}
        </Typography>
      </Stack>
      <Box component="ul" sx={{ p: 0, m: 0, listStyle: 'none' }}>
        {items.map((item) => {
          const Icon = lifecycleIcon[item.lifecycle];
          const openPath = resolveCatalogOpenPath(item);
          const openAllowed = Boolean(openPath && canOpenPath(openPath));
          return (
            <Box
              component="li"
              key={item.id}
              data-catalog-id={item.id}
              data-lifecycle={item.lifecycle}
              data-external-target={item.externalTarget}
              data-open-state={openPath ? (openAllowed ? 'allowed' : 'denied') : 'inert'}
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', sm: 'minmax(0, 1fr) auto' },
                alignItems: 'center',
                gap: 1.25,
                px: { xs: 1.25, sm: 2 },
                py: 1.35,
                borderTop: 1,
                borderColor: 'divider',
              }}
            >
              <Box minWidth={0}>
                <Stack direction="row" alignItems="center" flexWrap="wrap" gap={0.75}>
                  <Chip size="small" variant="outlined" label={item.module} sx={{ height: 22 }} />
                  <Chip
                    size="small"
                    variant="outlined"
                    color={availabilityColor[item.availability]}
                    label={t(`productMap.availability.${item.availability}`)}
                    sx={{ height: 22 }}
                  />
                  <Typography component="h4" variant="subtitle2">
                    {item.label[locale]}
                  </Typography>
                </Stack>
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ display: 'block', mt: 0.45 }}
                >
                  {item.capability[locale]}
                </Typography>
                {item.coverageNote && (
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{ display: 'block', mt: 0.35 }}
                  >
                    {item.coverageNote[locale]}
                  </Typography>
                )}
              </Box>
              {openPath && openAllowed ? (
                <ActionButton
                  intent="secondary"
                  size="small"
                  endIcon={<ArrowUpRight size={15} aria-hidden="true" />}
                  onClick={() => onOpen(openPath)}
                  aria-label={`${item.label[locale]} · ${t('productMap.open')}`}
                  sx={{ justifySelf: { sm: 'end' } }}
                >
                  {t('productMap.open')}
                </ActionButton>
              ) : openPath ? (
                <Chip
                  size="small"
                  variant="outlined"
                  icon={<LockKeyhole size={14} aria-hidden="true" />}
                  label={t('productMap.authorizationRequired')}
                  sx={{ justifySelf: { sm: 'end' }, height: 'auto', minHeight: 28 }}
                />
              ) : (
                <Chip
                  size="small"
                  variant="outlined"
                  color={lifecycleColor[item.lifecycle]}
                  icon={<Icon size={14} aria-hidden="true" />}
                  label={t(`productMap.lifecycle.${item.lifecycle}`)}
                  sx={{ justifySelf: { sm: 'end' }, height: 'auto', minHeight: 28 }}
                />
              )}
            </Box>
          );
        })}
      </Box>
    </Box>
  );
}

import { useTranslation } from 'react-i18next';
import { ActionButton, foundationTokens } from '@dwp-frontend/design-system';
import { Link } from 'react-router-dom';
import {
  Armchair,
  ArrowRight,
  BriefcaseBusiness,
  CarFront,
  LockKeyhole,
  Package,
  Phone,
  UsersRound,
} from 'lucide-react';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { workplaceMemberCard, workplaceMemberSoftSurface } from './workplace-member-surfaces';

import type { WorkplaceResourceType } from '@dwp-frontend/shared-utils';
import type { WorkplaceHomeModel } from './workplace-home-model';

const PRIMARY_TYPES: readonly WorkplaceResourceType[] = [
  'DESK',
  'FOCUS_POD',
  'PHONE_BOOTH',
  'ROOM',
];
const ICONS = {
  DESK: Armchair,
  FOCUS_POD: BriefcaseBusiness,
  PHONE_BOOTH: Phone,
  ROOM: UsersRound,
  LOCKER: LockKeyhole,
  PARKING: CarFront,
  EQUIPMENT: Package,
};

export function WorkplaceReadySpaces({
  model,
  state,
  refreshing,
  onRefresh,
}: {
  model: WorkplaceHomeModel;
  state: 'READY' | 'STALE' | 'UNAVAILABLE';
  refreshing: boolean;
  onRefresh: () => void;
}) {
  const { t } = useTranslation('rooms');
  const verifiedScope = state === 'READY' && ['READY', 'NO_RESOURCE'].includes(model.scopeState);
  const types = [
    ...PRIMARY_TYPES,
    ...model.availability.map((item) => item.type).filter((type) => !PRIMARY_TYPES.includes(type)),
  ];
  return (
    <Box
      component="section"
      aria-labelledby="workplace-ready-spaces"
      sx={(theme) => ({
        ...workplaceMemberCard(theme),
        borderRadius: foundationTokens.workplace.radius.card + 'px',
        borderWidth: { xs: 0, md: 1 },
        bgcolor: { xs: 'transparent', md: 'background.paper' },
        p: { xs: 0, md: foundationTokens.workplace.layout.gutter + 'px' },
      })}
    >
      <Stack
        direction={{ xs: 'column', md: 'row' }}
        justifyContent="space-between"
        alignItems={{ xs: 'stretch', md: 'center' }}
        gap={1.5}
        sx={{ mb: { xs: 1, md: 2 } }}
      >
        <Box minWidth={0}>
          <Typography
            id="workplace-ready-spaces"
            component="h2"
            sx={{
              ...foundationTokens.workplace.typography.subsectionTitle,
              fontSize: {
                xs: foundationTokens.workplace.typography.cardTitle.fontSize,
                md: foundationTokens.workplace.typography.subsectionTitle.fontSize,
              },
              lineHeight: {
                xs: foundationTokens.workplace.typography.cardTitle.lineHeight,
                md: foundationTokens.workplace.typography.subsectionTitle.lineHeight,
              },
              fontWeight: 'fontWeightBold',
            }}
          >
            {t('workplace.home.availability.title')}
          </Typography>
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{
              ...foundationTokens.workplace.typography.smallBody,
              display: { xs: 'none', md: 'block' },
              mt: 0.5,
            }}
          >
            {t('workplace.home.availability.description')}
          </Typography>
        </Box>
        {verifiedScope ? (
          <Stack direction="row" gap={1.5} useFlexGap flexWrap="wrap">
            <Box sx={(theme) => ({ ...workplaceMemberSoftSurface(theme), px: 1.25, py: 0.75 })}>
              <Typography variant="caption" color="text.secondary">
                {t('workplace.home.availability.physicalOpenMetric')}{' '}
              </Typography>
              <Typography
                component="strong"
                variant="body2"
                fontWeight="fontWeightBold"
                data-testid="workplace-physical-open-count"
              >
                {model.availableCount}
              </Typography>
            </Box>
            <Box sx={(theme) => ({ ...workplaceMemberSoftSurface(theme), px: 1.25, py: 0.75 })}>
              <Typography variant="caption" color="primary.main">
                {t('workplace.home.availability.initialChecksMetric')}{' '}
              </Typography>
              <Typography
                component="strong"
                variant="body2"
                fontWeight="fontWeightBold"
                color="primary.main"
                data-testid="workplace-initial-checks-count"
              >
                {model.bookableCount}
              </Typography>
            </Box>
          </Stack>
        ) : state !== 'READY' ? (
          <ActionButton intent="secondary" size="small" loading={refreshing} onClick={onRefresh}>
            {t('workplace.home.nextAction.verify')}
          </ActionButton>
        ) : null}
      </Stack>
      <Box
        component="ul"
        data-testid="workplace-home-type-cards"
        sx={{
          m: 0,
          p: 0,
          listStyle: 'none',
          display: 'grid',
          gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', lg: 'repeat(4, minmax(0, 1fr))' },
          gap: { xs: 0.5, md: foundationTokens.workplace.layout.cardGap + 'px' },
        }}
      >
        {types.map((type) => {
          const item = verifiedScope
            ? model.availability.find((candidate) => candidate.type === type)
            : undefined;
          const Icon = ICONS[type];
          const percent = item?.total ? Math.round((item.bookable / item.total) * 100) : 0;
          const unavailable = !verifiedScope;
          return (
            <Box
              component="li"
              key={type}
              data-resource-type={type}
              aria-label={
                item
                  ? t('workplace.home.availability.meterLabel', {
                      ...item,
                      type: t(`workplace.resourceTypes.${type}`),
                    })
                  : undefined
              }
              sx={(theme) => ({
                ...workplaceMemberSoftSurface(theme),
                bgcolor: { xs: 'background.paper', md: workplaceMemberSoftSurface(theme).bgcolor },
                p: { xs: 1.5, md: 2 },
                minWidth: 0,
                minHeight: { xs: '8rem', md: '11rem' },
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
              })}
            >
              <Stack
                direction="row"
                justifyContent="space-between"
                gap={1}
                alignItems="flex-start"
                sx={{ mb: 1, flexWrap: { xs: 'wrap', md: 'nowrap' } }}
              >
                <Stack
                  direction={{ xs: 'row-reverse', md: 'row' }}
                  gap={0.75}
                  alignItems="center"
                  minWidth={0}
                  sx={{
                    width: { xs: 1, md: 'auto' },
                    justifyContent: 'space-between',
                    color: 'primary.main',
                  }}
                >
                  <Box
                    component="span"
                    sx={{ display: 'flex', flexShrink: 0, color: 'primary.main' }}
                  >
                    <Icon size={18} aria-hidden="true" />
                  </Box>
                  <Typography
                    color="text.primary"
                    sx={{
                      ...foundationTokens.workplace.typography.cardTitle,
                      fontSize: {
                        xs: foundationTokens.workplace.typography.label.fontSize,
                        md: foundationTokens.workplace.typography.cardTitle.fontSize,
                      },
                      lineHeight: {
                        xs: foundationTokens.workplace.typography.label.lineHeight,
                        md: foundationTokens.workplace.typography.cardTitle.lineHeight,
                      },
                      fontWeight: 'fontWeightBold',
                      overflowWrap: 'anywhere',
                    }}
                  >
                    {t(`workplace.resourceTypes.${type}`)}
                  </Typography>
                </Stack>
                {item ? (
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{
                      ...foundationTokens.workplace.typography.caption,
                      display: { xs: 'none', md: 'block' },
                    }}
                  >
                    {t('workplace.home.availability.typeTotal', { count: item.total })}
                  </Typography>
                ) : null}
              </Stack>
              {item ? (
                <>
                  <Box sx={{ display: { xs: 'block', md: 'none' } }}>
                    <Stack direction="row" alignItems="baseline" gap={0.5}>
                      <Typography
                        color="primary.main"
                        sx={{
                          ...foundationTokens.workplace.typography.metric,
                          fontWeight: 'fontWeightBold',
                        }}
                      >
                        {item.available}
                      </Typography>
                      <Typography
                        color="text.secondary"
                        sx={foundationTokens.workplace.typography.caption}
                      >
                        {t('workplace.home.availability.typeOpenCompact')}
                      </Typography>
                    </Stack>
                    <Typography
                      color="text.secondary"
                      sx={{
                        ...foundationTokens.workplace.typography.caption,
                        mt: 0.5,
                        overflowWrap: 'anywhere',
                      }}
                    >
                      {t('workplace.home.availability.typeEligibilityCompact', {
                        bookable: item.bookable,
                        accessible: item.accessible,
                      })}
                    </Typography>
                  </Box>
                  <Stack
                    direction="row"
                    justifyContent="space-between"
                    gap={1}
                    useFlexGap
                    flexWrap="wrap"
                    sx={{ mb: 1, display: { xs: 'none', md: 'flex' } }}
                  >
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      sx={foundationTokens.workplace.typography.smallBody}
                    >
                      {t('workplace.home.availability.typeOpen', { count: item.available })}
                    </Typography>
                    <Typography
                      color="primary.main"
                      sx={foundationTokens.workplace.typography.label}
                    >
                      {t('workplace.home.availability.typeBookable', { count: item.bookable })}
                    </Typography>
                  </Stack>
                  <Box
                    role="img"
                    aria-label={t('workplace.home.availability.meterLabel', {
                      ...item,
                      type: t(`workplace.resourceTypes.${type}`),
                    })}
                    sx={{
                      display: { xs: 'none', md: 'block' },
                      height: 8,
                      bgcolor: 'action.hover',
                      overflow: 'hidden',
                      borderRadius: foundationTokens.radius.compact + 'px',
                    }}
                  >
                    <Box sx={{ width: `${percent}%`, height: 1, bgcolor: 'primary.main' }} />
                  </Box>
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{ mt: 1, display: { xs: 'none', md: 'block' } }}
                  >
                    {item.accessible
                      ? t('workplace.home.availability.accessible', { count: item.accessible })
                      : t('workplace.home.availability.nextHour')}
                  </Typography>
                </>
              ) : (
                <Typography
                  variant="body2"
                  color="text.secondary"
                  data-testid="workplace-home-type-unavailable"
                  sx={{ ...foundationTokens.workplace.typography.smallBody, py: 1.25 }}
                >
                  {t(
                    unavailable
                      ? 'workplace.home.availability.typeUnavailable'
                      : 'workplace.home.availability.typeNotConfigured'
                  )}
                </Typography>
              )}
              <ActionButton
                component={Link}
                to={
                  model.discoveryPaths[type] ??
                  `${model.discoveryPath}${model.discoveryPath.includes('?') ? '&' : '?'}type=${type}`
                }
                intent="quiet"
                size="small"
                disabled={!item}
                endIcon={<ArrowRight size={16} />}
                aria-label={
                  item
                    ? t('workplace.home.availability.openType', {
                        type: t(`workplace.resourceTypes.${type}`),
                        available: item.available,
                        bookable: item.bookable,
                      })
                    : undefined
                }
                sx={{
                  ...foundationTokens.workplace.typography.label,
                  justifyContent: 'space-between',
                  mt: { xs: 1, md: 1.5 },
                  px: { xs: 0.5, md: 0 },
                  bgcolor: { xs: 'action.hover', md: 'transparent' },
                }}
              >
                {t('workplace.home.findSpace')}
              </ActionButton>
            </Box>
          );
        })}
      </Box>
    </Box>
  );
}

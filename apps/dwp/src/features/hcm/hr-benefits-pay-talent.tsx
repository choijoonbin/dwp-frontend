import { useTranslation } from 'react-i18next';
import { CalendarClock, HeartHandshake, LifeBuoy, ShieldCheck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ActionButton, EmptyState } from '@dwp-frontend/design-system';
import { formatDate } from '@dwp-frontend/shared-i18n';
import { getHrBenefits } from '@dwp-frontend/shared-utils';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import {
  DomainSection,
  ProgressSignal,
  QueryBoundary,
  ReferenceNotice,
  StatusChip,
} from './hr-domain-components';

import {
  PRODUCT_PAGE_SHORTCUT_TARGETS,
  useProductPageShortcutAccess,
} from '../../components/product-page-shortcut-access';

export function HrBenefitsWorkspace() {
  const { t } = useTranslation('hcm');
  const navigate = useNavigate();
  const employeeServicesShortcut = useProductPageShortcutAccess(
    PRODUCT_PAGE_SHORTCUT_TARGETS.hcmEmployeeServices
  );
  const query = useQuery({
    queryKey: ['hcm', 'benefits'],
    queryFn: getHrBenefits,
    staleTime: 60_000,
  });
  return (
    <QueryBoundary
      loading={query.isLoading}
      error={query.error}
      retrying={query.isFetching}
      onRetry={() => void query.refetch()}
    >
      <Stack gap={2}>
        {query.data?.referenceData && <ReferenceNotice />}
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', md: 'repeat(3, minmax(0, 1fr))' },
            gap: 1,
          }}
        >
          <ProgressSignal
            label={t('domains.benefits.activePlans')}
            value={String(query.data?.plans.filter((plan) => plan.status === 'ACTIVE').length ?? 0)}
            detail={t('domains.benefits.activePlansDetail')}
            progress={query.data?.plans.length ? 100 : 0}
            tone="success"
          />
          <ProgressSignal
            label={t('domains.benefits.enrollmentWindows')}
            value={String(query.data?.windows.length ?? 0)}
            detail={t('domains.benefits.enrollmentWindowsDetail')}
            progress={query.data?.windows.length ? 100 : 0}
            tone={query.data?.windows.length ? 'warning' : 'primary'}
          />
          <Paper variant="outlined" sx={{ p: 2 }}>
            <Stack direction="row" alignItems="center" justifyContent="space-between" gap={1}>
              <Box>
                <Typography variant="caption" color="text.secondary">
                  {t('domains.benefits.coverageStatus')}
                </Typography>
                <Typography variant="h5" fontWeight={780} sx={{ mt: 0.5 }}>
                  {query.data?.plans.length
                    ? t('domains.benefits.covered')
                    : t('domains.benefits.notEnrolled')}
                </Typography>
              </Box>
              <HeartHandshake size={28} color="#1F7A55" aria-hidden="true" />
            </Stack>
          </Paper>
        </Box>

        <DomainSection
          title={t('domains.benefits.plansTitle')}
          description={t('domains.benefits.plansDescription')}
          action={
            employeeServicesShortcut.disclosed ? (
              <ActionButton
                intent="quiet"
                size="small"
                startIcon={<LifeBuoy size={15} />}
                onClick={() =>
                  navigate(
                    '/services/discover?category=PEOPLE&service=people.benefits-life-event&source=hr'
                  )
                }
              >
                {t('domains.benefits.reportLifeEvent')}
              </ActionButton>
            ) : undefined
          }
        >
          {query.data?.plans.length ? (
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))' },
              }}
            >
              {query.data.plans.map((plan, index) => (
                <Stack
                  key={plan.planId}
                  direction="row"
                  alignItems="flex-start"
                  gap={1.25}
                  sx={{
                    p: 2,
                    borderTop: { xs: index ? 1 : 0, md: index > 1 ? 1 : 0 },
                    borderLeft: { xs: 0, md: index % 2 ? 1 : 0 },
                    borderColor: 'divider',
                  }}
                >
                  <Box
                    sx={{
                      width: 38,
                      height: 38,
                      flex: '0 0 38px',
                      display: 'grid',
                      placeItems: 'center',
                      bgcolor: 'success.light',
                      color: 'success.dark',
                      borderRadius: 1,
                    }}
                  >
                    <ShieldCheck size={19} />
                  </Box>
                  <Box minWidth={0} flex={1}>
                    <Stack direction="row" alignItems="center" gap={0.75} flexWrap="wrap">
                      <Typography variant="body2" fontWeight={760}>
                        {plan.name}
                      </Typography>
                      <StatusChip status={plan.status} />
                    </Stack>
                    <Typography variant="caption" color="text.secondary" display="block">
                      {[plan.planType, plan.providerName].filter(Boolean).join(' · ')}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" display="block">
                      {t('domains.benefits.effectivePeriod', {
                        start: formatDate(plan.effectiveStart, { dateStyle: 'medium' }),
                        end: plan.effectiveEnd
                          ? formatDate(plan.effectiveEnd, { dateStyle: 'medium' })
                          : t('domains.benefits.current'),
                      })}
                    </Typography>
                    <Chip
                      size="small"
                      variant="outlined"
                      label={t(`domains.benefits.coverage.${plan.coverageLevel}`, {
                        defaultValue: plan.coverageLevel,
                      })}
                      sx={{ mt: 1 }}
                    />
                  </Box>
                </Stack>
              ))}
            </Box>
          ) : (
            <EmptyState
              title={t('domains.benefits.emptyTitle')}
              description={t('domains.benefits.emptyDescription')}
            />
          )}
        </DomainSection>

        <DomainSection
          title={t('domains.benefits.windowsTitle')}
          description={t('domains.benefits.windowsDescription')}
        >
          {query.data?.windows.length ? (
            <Box>
              {query.data.windows.map((window, index) => (
                <Box key={window.windowId}>
                  {index > 0 && <Divider />}
                  <Stack
                    direction={{ xs: 'column', sm: 'row' }}
                    alignItems={{ xs: 'stretch', sm: 'center' }}
                    gap={1.25}
                    sx={{ px: 2, py: 1.5 }}
                  >
                    <Stack direction="row" alignItems="flex-start" gap={1.25} minWidth={0} flex={1}>
                      <CalendarClock size={18} aria-hidden="true" />
                      <Box minWidth={0}>
                        <Typography variant="body2" fontWeight={750}>
                          {window.name}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {t('domains.benefits.windowPeriod', {
                            start: formatDate(window.opensAt, {
                              dateStyle: 'medium',
                              timeStyle: 'short',
                            }),
                            end: formatDate(window.closesAt, {
                              dateStyle: 'medium',
                              timeStyle: 'short',
                            }),
                          })}
                        </Typography>
                      </Box>
                    </Stack>
                    <StatusChip status={window.lifecycleState} />
                  </Stack>
                </Box>
              ))}
            </Box>
          ) : (
            <EmptyState
              size="compact"
              title={t('domains.benefits.noWindowTitle')}
              description={t('domains.benefits.noWindowDescription')}
            />
          )}
        </DomainSection>
      </Stack>
    </QueryBoundary>
  );
}

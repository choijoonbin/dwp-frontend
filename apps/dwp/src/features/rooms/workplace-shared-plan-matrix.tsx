import { useTranslation } from 'react-i18next';
import { Temporal } from 'temporal-polyfill';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { workplaceMemberSoftSurface } from './workplace-member-surfaces';

import type { WorkplaceSharedWorkPlan } from '@dwp-frontend/shared-utils';
import type { ReactNode } from 'react';

export function WorkplaceTeamSourceCard({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <Stack
      spacing={0.5}
      sx={(theme) => ({ ...workplaceMemberSoftSurface(theme), minWidth: 0, p: 1.5 })}
    >
      <Typography variant="overline" color="primary.main">
        {eyebrow}
      </Typography>
      <Typography variant="body2" fontWeight="fontWeightBold">
        {title}
      </Typography>
      <Typography variant="caption" color="text.secondary">
        {description}
      </Typography>
    </Stack>
  );
}

export function workplacePublicPlansForWeek(
  plans: readonly WorkplaceSharedWorkPlan[],
  days: readonly string[]
) {
  return plans.filter(
    (plan) =>
      plan.source === 'WORK_PLAN' &&
      plan.visibility !== 'PRIVATE' &&
      ['SITE', 'FLOOR', 'RESOURCE'].includes(plan.visibility) &&
      ['OFFICE', 'REMOTE', 'OFF'].includes(plan.mode) &&
      Number.isSafeInteger(plan.userId) &&
      days.includes(plan.planDate)
  );
}

export function WorkplaceSharedPlanMatrix({
  plans,
  days,
  today,
  dateLabel,
  locationLabel,
  discoveryAction,
}: {
  plans: readonly WorkplaceSharedWorkPlan[];
  days: readonly string[];
  today: string;
  dateLabel: (date: string) => string;
  locationLabel: (plan: WorkplaceSharedWorkPlan) => string;
  discoveryAction?: (plan: WorkplaceSharedWorkPlan) => ReactNode;
}) {
  const { t } = useTranslation('rooms');
  const publicPlans = workplacePublicPlansForWeek(plans, days);
  const displayedDays = days.filter(
    (date) =>
      Temporal.PlainDate.from(date).dayOfWeek <= 5 ||
      publicPlans.some((plan) => plan.planDate === date)
  );
  const people = [...new Set(publicPlans.map((plan) => plan.userId))]
    .map((userId) => ({
      userId,
      name:
        publicPlans.find((plan) => plan.userId === userId && plan.displayName)?.displayName ||
        t('workplace.member.team.anonymousPlan'),
    }))
    .sort((a, b) => a.name.localeCompare(b.name) || a.userId - b.userId);
  if (!people.length) return null;
  return (
    <Box
      component="table"
      data-testid="workplace-team-shared-matrix"
      sx={{
        display: { xs: 'none', lg: 'table' },
        width: 1,
        minWidth: 720,
        tableLayout: 'fixed',
        borderCollapse: 'collapse',
        '& th, & td': {
          p: 1,
          borderBottom: 1,
          borderColor: 'divider',
          textAlign: 'left',
          verticalAlign: 'top',
          overflowWrap: 'anywhere',
        },
      }}
    >
      <Box
        component="caption"
        sx={{
          position: 'absolute',
          width: '1px',
          height: '1px',
          p: 0,
          overflow: 'hidden',
          clipPath: 'inset(50%)',
        }}
      >
        {t('workplace.member.team.matrixCaption')}
      </Box>
      <Box component="thead">
        <Box component="tr">
          <Box
            component="th"
            scope="col"
            sx={{
              width: 156,
              position: 'sticky',
              left: 0,
              zIndex: 2,
              bgcolor: 'var(--dwp-product-soft)',
            }}
          >
            <Typography variant="caption" fontWeight="fontWeightBold">
              {t('workplace.member.team.colleague')}
            </Typography>
          </Box>
          {displayedDays.map((date) => (
            <Box
              component="th"
              scope="col"
              key={date}
              sx={{ bgcolor: date === today ? 'action.selected' : 'var(--dwp-product-soft)' }}
            >
              <Typography variant="caption" fontWeight="fontWeightBold">
                {dateLabel(date)}
              </Typography>
            </Box>
          ))}
        </Box>
      </Box>
      <Box component="tbody">
        {people.map((person) => (
          <Box component="tr" key={person.userId}>
            <Box
              component="th"
              scope="row"
              sx={{ position: 'sticky', left: 0, zIndex: 1, bgcolor: 'background.paper' }}
            >
              <Typography variant="body2" fontWeight="fontWeightBold">
                {person.name}
              </Typography>
            </Box>
            {displayedDays.map((date) => {
              const cellPlans = publicPlans.filter(
                (plan) => plan.userId === person.userId && plan.planDate === date
              );
              const primaryMode = cellPlans[0]?.mode;
              return (
                <Box
                  component="td"
                  key={date}
                  sx={{
                    bgcolor:
                      primaryMode === 'OFFICE'
                        ? 'action.selected'
                        : primaryMode === 'REMOTE'
                          ? 'var(--dwp-product-soft)'
                          : date === today
                            ? 'var(--dwp-product-soft)'
                            : undefined,
                    borderLeft: primaryMode === 'OFFICE' ? 3 : undefined,
                    borderLeftColor: 'var(--dwp-product-accent)',
                  }}
                >
                  {cellPlans.length ? (
                    <Stack spacing={0.75}>
                      {cellPlans.map((plan) => (
                        <Stack key={plan.planId} spacing={0.25}>
                          <Typography variant="body2" fontWeight="fontWeightBold">
                            {t(`workplace.member.team.modes.${plan.mode}`)}
                          </Typography>
                          {plan.mode === 'OFFICE' &&
                          locationLabel(plan) !== t('workplace.member.team.modes.OFFICE') ? (
                            <Typography variant="caption" color="text.secondary">
                              {locationLabel(plan)}
                            </Typography>
                          ) : null}
                          {discoveryAction?.(plan)}
                        </Stack>
                      ))}
                    </Stack>
                  ) : (
                    <Typography variant="caption" color="text.secondary">
                      {t('workplace.member.team.noSharedPlan')}
                    </Typography>
                  )}
                </Box>
              );
            })}
          </Box>
        ))}
      </Box>
    </Box>
  );
}

import { useTranslation } from 'react-i18next';
import { AlertTriangle, Clock3, ListPlus, ShieldCheck } from 'lucide-react';
import {
  ActionButton,
  foundationTokens,
  InlineFeedback,
  SelectField,
} from '@dwp-frontend/design-system';
import { formatDate, resolveSupportedLocale } from '@dwp-frontend/shared-i18n';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import FormControlLabel from '@mui/material/FormControlLabel';
import Radio from '@mui/material/Radio';
import RadioGroup from '@mui/material/RadioGroup';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { candidateById } from './workplace-planner-model';
import { workplaceMemberCard, workplaceMemberSoftSurface } from './workplace-member-surfaces';
import { WorkplacePlannerPlacementEvidence } from './workplace-planner-placement-evidence';

import type {
  WorkplaceBookingFailurePolicy,
  WorkplaceBookingIntentItemInput,
  WorkplaceBookingIntentPreview,
  WorkplaceReservationHold,
} from '@dwp-frontend/shared-utils';

const DECISION_COLORS = {
  AVAILABLE: 'success',
  ALTERNATIVES_AVAILABLE: 'warning',
  UNAVAILABLE: 'error',
  POLICY_DENIED: 'error',
} as const;

function dayKey(value: string) {
  return value.slice(0, 10);
}

export function WorkplacePlannerReview({
  preview,
  inputs,
  selections,
  holds,
  holdSecondsRemaining,
  failurePolicy,
  sourceReady,
  acquiringHold,
  confirming,
  creatingWaitlistFor,
  actorDisplayName,
  onSelect,
  onAcquireHold,
  onFailurePolicy,
  onConfirm,
  onWaitlist,
  onEdit,
  onRefresh,
}: {
  preview: WorkplaceBookingIntentPreview;
  inputs: readonly WorkplaceBookingIntentItemInput[];
  selections: Readonly<Record<string, string>>;
  holds: readonly WorkplaceReservationHold[];
  holdSecondsRemaining: number;
  failurePolicy: WorkplaceBookingFailurePolicy;
  sourceReady: boolean;
  acquiringHold: boolean;
  confirming: boolean;
  creatingWaitlistFor: string | null;
  actorDisplayName: string;
  onSelect: (intentItemId: string, resourceId: string) => void;
  onAcquireHold: () => void;
  onFailurePolicy: (value: WorkplaceBookingFailurePolicy) => void;
  onConfirm: () => void;
  onWaitlist: (item: WorkplaceBookingIntentItemInput) => void;
  onEdit: () => void;
  onRefresh: () => void;
}) {
  const { t, i18n } = useTranslation('rooms');
  const locale = resolveSupportedLocale(i18n.resolvedLanguage ?? i18n.language);
  const activeHolds = holds.filter((hold) => hold.state === 'ACTIVE');
  const expired = activeHolds.length > 0 && holdSecondsRemaining <= 0;
  const byDay = new Map<string, typeof preview.items>();
  for (const item of preview.items) {
    const date = dayKey(item.startsAt);
    byDay.set(date, [...(byDay.get(date) ?? []), item]);
  }
  const decisions = preview.items.reduce<Record<string, number>>((counts, item) => {
    counts[item.decision] = (counts[item.decision] ?? 0) + 1;
    return counts;
  }, {});
  const allHoldableSelected = preview.items
    .filter((item) => item.decision === 'AVAILABLE' || item.decision === 'ALTERNATIVES_AVAILABLE')
    .every((item) => Boolean(candidateById(item.candidates, selections[item.intentItemId])));
  const inputByKey = new Map(inputs.map((item) => [item.clientItemKey, item]));

  return (
    <Box data-testid="workplace-planner-review" sx={workplaceMemberCard}>
      <Box p={{ xs: 1.5, md: 2.5 }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" gap={1.5}>
          <Box>
            <Typography component="h2" variant="h6">
              {t('workplace.planner.review.title')}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {t('workplace.planner.review.description', { count: preview.items.length })}
            </Typography>
          </Box>
          <Stack direction="row" gap={0.75} flexWrap="wrap">
            {Object.entries(decisions).map(([decision, count]) => (
              <Chip
                key={decision}
                size="small"
                color={DECISION_COLORS[decision as keyof typeof DECISION_COLORS]}
                label={t(`workplace.planner.decisions.${decision}`, { count })}
              />
            ))}
          </Stack>
        </Stack>

        {activeHolds.length > 0 && (
          <Box data-testid="workplace-planner-hold-timer">
            <InlineFeedback
              severity={expired || holdSecondsRemaining <= 30 ? 'error' : 'warning'}
              icon={<Clock3 size={19} />}
              sx={{ mt: 2 }}
            >
              <Typography component="p" variant="subtitle2">
                {expired
                  ? t('workplace.planner.hold.expired')
                  : t('workplace.planner.hold.active', { seconds: holdSecondsRemaining })}
              </Typography>
              <Typography variant="caption">
                {t('workplace.planner.hold.serverAuthoritative')}
              </Typography>
            </InlineFeedback>
          </Box>
        )}
        {!sourceReady && (
          <InlineFeedback severity="warning" icon={<ShieldCheck size={19} />} sx={{ mt: 2 }}>
            {t('workplace.planner.states.staleWriteBlocked')}
          </InlineFeedback>
        )}

        <WorkplacePlannerPlacementEvidence
          constraints={preview.teamPlacementConstraints}
          evidence={preview.placementConstraintEvidence}
        />

        <Box
          data-testid="workplace-planner-matrix"
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))' },
            gap: 1.5,
            mt: 2,
          }}
        >
          {[...byDay.entries()].map(([date, items]) => (
            <Box key={date} sx={(theme) => ({ ...workplaceMemberSoftSurface(theme), p: 1.5 })}>
              <Stack direction="row" justifyContent="space-between" gap={1} mb={1.25}>
                <Typography component="h3" variant="subtitle2">
                  {formatDate(
                    `${date}T00:00:00Z`,
                    { dateStyle: 'medium', timeZone: 'UTC' },
                    locale
                  )}
                </Typography>
                <Chip
                  size="small"
                  label={t('workplace.planner.review.itemCount', { count: items.length })}
                />
              </Stack>
              <Stack spacing={1}>
                {items.map((item) => {
                  const selected = candidateById(item.candidates, selections[item.intentItemId]);
                  const original = inputByKey.get(item.clientItemKey);
                  const unavailable =
                    item.decision === 'UNAVAILABLE' || item.decision === 'POLICY_DENIED';
                  return (
                    <Box
                      key={item.intentItemId}
                      data-testid={`workplace-planner-item-${item.intentItemId}`}
                      sx={{
                        bgcolor: 'background.paper',
                        borderRadius: foundationTokens.radius.control,
                        p: 1.25,
                      }}
                    >
                      <Stack direction="row" justifyContent="space-between" gap={1}>
                        <Box minWidth={0}>
                          <Typography component="p" variant="subtitle2" noWrap>
                            {item.beneficiaryDisplayName} ·{' '}
                            {t(`workplace.resourceTypes.${item.resourceType}`)}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {t(`workplace.planner.decisionCodes.${item.decisionCode}`, {
                              defaultValue: item.decisionCode,
                            })}
                          </Typography>
                          <Typography variant="caption" color="text.secondary" display="block">
                            {t('workplace.planner.review.bookedByFor', {
                              actor: actorDisplayName,
                              beneficiary: item.beneficiaryDisplayName,
                            })}
                          </Typography>
                          <Box component="details" sx={{ mt: 0.5 }}>
                            <Typography
                              component="summary"
                              variant="caption"
                              sx={{ cursor: 'pointer' }}
                            >
                              {t('workplace.planner.review.auditDetails')}
                            </Typography>
                            <Typography
                              component="p"
                              variant="caption"
                              color="text.secondary"
                              sx={{ overflowWrap: 'anywhere' }}
                            >
                              {t('workplace.planner.review.auditLineage', {
                                actor: item.actorUserId,
                                beneficiary: item.beneficiaryUserId,
                                person: item.beneficiaryPersonPublicId ?? '—',
                                grant:
                                  item.delegationGrantId ?? t('workplace.planner.review.selfGrant'),
                              })}
                            </Typography>
                          </Box>
                        </Box>
                        <Chip
                          size="small"
                          color={DECISION_COLORS[item.decision]}
                          label={t(`workplace.planner.decisionLabels.${item.decision}`)}
                        />
                      </Stack>
                      {!unavailable && item.candidates.length > 0 && (
                        <SelectField
                          size="small"
                          label={t('workplace.planner.review.candidate')}
                          value={selected?.resourceId ?? ''}
                          options={item.candidates.map((candidate) => ({
                            value: candidate.resourceId,
                            label: `${candidate.name}${candidate.preferred ? ` · ${t('workplace.planner.review.preferred')}` : ''}`,
                          }))}
                          onValueChange={(value) => value && onSelect(item.intentItemId, value)}
                          sx={{ mt: 1, width: 1 }}
                        />
                      )}
                      {item.decision === 'UNAVAILABLE' && original && (
                        <ActionButton
                          intent="quiet"
                          size="small"
                          startIcon={<ListPlus size={15} />}
                          loading={creatingWaitlistFor === original.clientItemKey}
                          onClick={() => onWaitlist(original)}
                          sx={{ mt: 1 }}
                        >
                          {t('workplace.planner.actions.waitlist')}
                        </ActionButton>
                      )}
                    </Box>
                  );
                })}
              </Stack>
            </Box>
          ))}
        </Box>

        <Divider sx={{ my: 2 }} />
        <Typography component="p" variant="subtitle2">
          {t('workplace.planner.review.failurePolicy')}
        </Typography>
        <RadioGroup
          value={failurePolicy}
          onChange={(event) => onFailurePolicy(event.target.value as WorkplaceBookingFailurePolicy)}
        >
          <FormControlLabel
            value="KEEP_SUCCEEDED"
            control={<Radio />}
            label={t('workplace.planner.failurePolicies.KEEP_SUCCEEDED')}
          />
          <FormControlLabel
            value="COMPENSATE_ALL"
            control={<Radio />}
            label={t('workplace.planner.failurePolicies.COMPENSATE_ALL')}
          />
        </RadioGroup>

        {!allHoldableSelected && (
          <InlineFeedback severity="warning" icon={<AlertTriangle size={19} />} sx={{ mt: 1 }}>
            {t('workplace.planner.validation.SELECT_ALL')}
          </InlineFeedback>
        )}
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          gap={1}
          mt={2}
          sx={{
            position: { xs: 'sticky', sm: 'static' },
            bottom: { xs: 0, sm: 'auto' },
            zIndex: 2,
            bgcolor: 'background.paper',
            py: { xs: 1, sm: 0 },
            borderTop: { xs: 1, sm: 0 },
            borderColor: 'divider',
          }}
        >
          <ActionButton intent="secondary" onClick={onEdit}>
            {t('workplace.planner.actions.edit')}
          </ActionButton>
          {activeHolds.length === 0 || expired ? (
            <ActionButton
              data-testid="workplace-planner-acquire-holds"
              intent="primary"
              loading={acquiringHold}
              disabled={!sourceReady || !allHoldableSelected}
              onClick={expired ? onRefresh : onAcquireHold}
              sx={{ flex: 1, minHeight: 44 }}
            >
              {expired
                ? t('workplace.planner.actions.reacquire')
                : t('workplace.planner.actions.hold')}
            </ActionButton>
          ) : (
            <ActionButton
              data-testid="workplace-planner-confirm-batch"
              intent="primary"
              loading={confirming}
              disabled={!sourceReady || expired}
              onClick={onConfirm}
              sx={{ flex: 1, minHeight: 44 }}
            >
              {t('workplace.planner.actions.confirm', { count: activeHolds.length })}
            </ActionButton>
          )}
        </Stack>
      </Box>
    </Box>
  );
}

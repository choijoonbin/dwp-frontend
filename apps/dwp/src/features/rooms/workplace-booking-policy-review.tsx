import { useWorkplaceExperienceAuthority } from './workplace-experience-authority';
import { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { FormDialog } from '@dwp-frontend/design-system';
import {
  applyWorkplaceBookingPolicyChange,
  reviewWorkplaceBookingPolicy,
} from '@dwp-frontend/shared-utils';
import type { WorkplacePolicy } from '@dwp-frontend/shared-utils';
import { useRoomsCapabilities } from './rooms-capabilities';
import {
  useGovernanceChangeReview,
  WorkplaceGovernanceChangeReview,
} from './workplace-governance-change-review';
import { WorkplacePolicyImpactPreview } from './workplace-policy-impact-preview';

export const WORKPLACE_BOOKING_POLICY_FIELDS = [
  ['bookingWindowDays', 'bookingWindow'],
  ['maximumActiveBookings', 'activeLimit'],
  ['maximumConsecutiveDays', 'consecutiveDays'],
  ['workingDayStart', 'workingStart'],
  ['workingDayEnd', 'workingEnd'],
  ['minimumBookingMinutes', 'minimumMinutes'],
  ['maximumBookingMinutes', 'maximumMinutes'],
  ['allowRecurring', 'allowRecurring'],
  ['requireCheckIn', 'requireCheckIn'],
  ['checkInLeadMinutes', 'checkInLead'],
  ['autoReleaseMinutes', 'autoRelease'],
  ['allowAssignedDeskLending', 'allowAssignedDeskLending'],
  ['showColleagueNames', 'showNames'],
  ['bookingRetentionDays', 'bookingRetentionDays'],
] as const satisfies readonly (readonly [keyof WorkplacePolicy, string])[];

export function WorkplaceBookingPolicyReview({
  proposed,
  current,
  valid,
  sourceReady,
  recheck,
  onSaved,
  onClose,
}: {
  proposed: WorkplacePolicy;
  current: WorkplacePolicy;
  valid: boolean;
  sourceReady: boolean;
  recheck: () => Promise<boolean>;
  onSaved: (policy: WorkplacePolicy) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation('rooms');
  const authorityKey = useWorkplaceExperienceAuthority();
  const capabilities = useRoomsCapabilities();
  const queryClient = useQueryClient();
  const pendingSaved = useRef<WorkplacePolicy | null>(null);
  const state = useGovernanceChangeReview({
    contextKey: `${authorityKey}:booking-policy`,
    proposed,
    canManage: capabilities.isLoaded && capabilities.canManageWorkplaceAdmin,
    sourceReady,
    valid,
    review: reviewWorkplaceBookingPolicy,
    apply: async (input) => {
      pendingSaved.current = await applyWorkplaceBookingPolicyChange(input);
    },
    recheck,
    onSaved: async () => {
      if (pendingSaved.current) onSaved(pendingSaved.current);
      await queryClient.invalidateQueries({ queryKey: ['workplace'] });
      onClose();
    },
  });
  const display = (value: unknown) =>
    typeof value === 'boolean' ? (value ? '✓' : '—') : String(value);
  return (
    <FormDialog
      open
      title={t('workplace.experience.policyImpact')}
      description={t('workplace.experience.policyImpactDescription')}
      onClose={onClose}
      onSubmit={state.save}
      showSubmit={false}
      showCancel={false}
      busy={Boolean(state.busy)}
      submitLabel={t('actions.save')}
      cancelLabel={t('actions.close')}
      maxWidth="lg"
      mobileFullScreen
    >
      <WorkplaceGovernanceChangeReview
        state={state}
        rows={WORKPLACE_BOOKING_POLICY_FIELDS.map(([key, label]) => ({
          label: t(`workplace.admin.policy.${label}`),
          current: display(current[key]),
          proposed: display(proposed[key]),
        }))}
        onClose={onClose}
      >
        <WorkplacePolicyImpactPreview proposed={proposed} valid={valid} />
      </WorkplaceGovernanceChangeReview>
    </FormDialog>
  );
}

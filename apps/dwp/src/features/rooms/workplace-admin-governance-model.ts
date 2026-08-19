import type {
  WorkplaceGovernanceFloorPlanRevision,
  WorkplaceGovernancePolicyPatch,
  WorkplaceGovernancePolicyScopeType,
} from '@dwp-frontend/shared-utils';

export type WorkplaceGovernanceTab =
  | 'hierarchy'
  | 'access'
  | 'policy'
  | 'floorPlans'
  | 'delegation';

export const WORKPLACE_GOVERNANCE_TABS = [
  'hierarchy',
  'access',
  'policy',
  'floorPlans',
  'delegation',
] as const satisfies readonly WorkplaceGovernanceTab[];

export function parseWorkplaceGovernanceTab(value: string | null): WorkplaceGovernanceTab {
  return WORKPLACE_GOVERNANCE_TABS.includes(value as WorkplaceGovernanceTab)
    ? (value as WorkplaceGovernanceTab)
    : 'hierarchy';
}

export type WorkplaceGovernancePolicyField = {
  key: keyof WorkplaceGovernancePolicyPatch;
  kind: 'integer' | 'boolean' | 'time';
  minimum?: number;
  maximum?: number;
};

export const WORKPLACE_GOVERNANCE_POLICY_FIELDS = [
  { key: 'bookingWindowDays', kind: 'integer', minimum: 1, maximum: 365 },
  { key: 'maximumActiveBookings', kind: 'integer', minimum: 1, maximum: 100 },
  { key: 'minimumBookingMinutes', kind: 'integer', minimum: 15, maximum: 1440 },
  { key: 'maximumBookingMinutes', kind: 'integer', minimum: 15, maximum: 10080 },
  { key: 'maximumConsecutiveDays', kind: 'integer', minimum: 1, maximum: 31 },
  { key: 'workingDayStart', kind: 'time' },
  { key: 'workingDayEnd', kind: 'time' },
  { key: 'allowRecurring', kind: 'boolean' },
  { key: 'requireCheckIn', kind: 'boolean' },
  { key: 'checkInLeadMinutes', kind: 'integer', minimum: 0, maximum: 240 },
  { key: 'autoReleaseMinutes', kind: 'integer', minimum: 0, maximum: 240 },
  { key: 'allowAssignedDeskLending', kind: 'boolean' },
  { key: 'showColleagueNames', kind: 'boolean' },
  { key: 'bookingRetentionDays', kind: 'integer', minimum: 30, maximum: 3650 },
] as const satisfies readonly WorkplaceGovernancePolicyField[];

export function isWorkplaceGovernanceUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(
    value.trim()
  );
}

export function parseWorkplaceGovernanceUserId(value: string) {
  const parsed = Number(value.trim());
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

export function isWorkplaceGovernancePeriodValid(
  validFrom: string | null,
  validUntil: string | null
) {
  if (!validFrom || !validUntil) return true;
  return Date.parse(validUntil) > Date.parse(validFrom);
}

export function workplaceGovernanceScopeNeedsId(scopeType: WorkplaceGovernancePolicyScopeType) {
  return scopeType !== 'TENANT';
}

export function validateWorkplaceGovernancePolicyPatch(patch: WorkplaceGovernancePolicyPatch) {
  const entries = Object.entries(patch);
  if (entries.length === 0) return false;
  const fieldsValid = entries.every(([key, value]) => {
    const definition = WORKPLACE_GOVERNANCE_POLICY_FIELDS.find((field) => field.key === key);
    if (!definition) return false;
    if (definition.kind === 'boolean') return typeof value === 'boolean';
    if (definition.kind === 'time') {
      return typeof value === 'string' && /^([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/u.test(value);
    }
    return (
      typeof value === 'number' &&
      Number.isInteger(value) &&
      value >= (definition.minimum ?? Number.MIN_SAFE_INTEGER) &&
      value <= (definition.maximum ?? Number.MAX_SAFE_INTEGER)
    );
  });
  if (!fieldsValid) return false;

  const minimum = patch.minimumBookingMinutes;
  const maximum = patch.maximumBookingMinutes;
  if (typeof minimum === 'number' && typeof maximum === 'number' && minimum > maximum) {
    return false;
  }
  const bookingWindow = patch.bookingWindowDays;
  const consecutiveDays = patch.maximumConsecutiveDays;
  if (
    typeof bookingWindow === 'number' &&
    typeof consecutiveDays === 'number' &&
    consecutiveDays > bookingWindow
  ) {
    return false;
  }
  const workingDayStart = patch.workingDayStart;
  const workingDayEnd = patch.workingDayEnd;
  if (
    typeof workingDayStart === 'string' &&
    typeof workingDayEnd === 'string' &&
    workingDayStart >= workingDayEnd
  ) {
    return false;
  }
  return true;
}

export function workplaceGovernanceRevisionActions(
  revision: WorkplaceGovernanceFloorPlanRevision
): readonly ('REVIEW' | 'PUBLISH' | 'RESTORE')[] {
  if (revision.state === 'DRAFT') return ['REVIEW'];
  if (revision.state === 'REVIEW') return ['PUBLISH'];
  if (revision.state === 'PUBLISHED' || revision.state === 'ARCHIVED') return ['RESTORE'];
  return [];
}

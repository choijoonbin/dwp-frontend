/** Synthetic test-only People 360 owner projections. */
import { PEOPLE_360_FIELD_REGISTRY } from '../model/people-360-view-model';

import type {
  People360Access,
  People360Field,
  People360FieldDecisionKind,
} from '../model/people-360-view-model';

const basePerson = {
  personId: '11111111-1111-4111-8111-111111111111',
  displayName: 'Synthetic Worker Alpha',
  preferredLocale: 'en',
  timeZone: 'Asia/Seoul',
  lifecycleState: 'ACTIVE',
};

const baseEmployment = {
  workerNumber: 'SYNTH-0001',
  workerType: 'EMPLOYEE',
  workerStatus: 'ACTIVE',
  originalHireDate: '2024-04-15',
  relationshipType: 'EMPLOYEE',
  relationshipStartDate: '2024-04-15',
  relationshipEndDate: undefined,
  legalEmployerName: 'Synthetic Legal Employer',
};

const baseAssignment = {
  assignmentKey: 'SYNTH-ASSIGNMENT-1',
  assignmentStatus: 'ACTIVE',
  businessTitle: 'Synthetic Product Specialist',
  organizationName: 'Synthetic People Operations',
  jobProfileName: 'Synthetic Specialist',
  jobGradeName: 'Synthetic Grade',
  locationName: 'Synthetic Workplace',
  managerDisplayName: 'Synthetic Manager',
  effectiveStartDate: '2025-01-01',
  effectiveEndDate: undefined,
};

function sectionAndProperty(field: People360Field) {
  const [section, property] = field.split('.', 2);
  return { section: section as 'person' | 'employment' | 'primaryAssignment', property };
}

export function people360Snapshot({
  personId = basePerson.personId,
  displayName = basePerson.displayName,
  asOf = '2026-09-17',
  state = 'READY',
  decisions = {},
  employment = true,
  primaryAssignment = true,
  archetype = 'HR_OPERATOR',
  scope = 'WORKFORCE_POLICY',
}: Readonly<{
  personId?: string;
  displayName?: string;
  asOf?: string;
  state?: 'READY' | 'PARTIAL';
  decisions?: Partial<Record<People360Field, People360FieldDecisionKind>>;
  employment?: boolean;
  primaryAssignment?: boolean;
  archetype?: People360Access['archetype'];
  scope?: People360Access['scope'];
}> = {}) {
  const fields = PEOPLE_360_FIELD_REGISTRY.map((field) => ({
    field,
    decision: decisions[field] ?? (field === 'employment.workerNumber' ? 'MASK' : 'VIEW'),
  })) as People360Access['fieldDecisions'];
  const value: Record<string, unknown> = {
    schemaVersion: 1,
    asOf,
    state,
    projectionRevision: `projection:${personId}:${asOf}`,
    person: { ...basePerson, personId, displayName },
    ...(employment ? { employment: { ...baseEmployment, workerNumber: '••••' } } : {}),
    ...(primaryAssignment ? { primaryAssignment: { ...baseAssignment } } : {}),
    access: {
      archetype,
      scope,
      policyRevision: 'policy:synthetic:7',
      fieldDecisions: fields,
    },
  };
  for (const decision of fields) {
    const { section, property } = sectionAndProperty(decision.field);
    const target = value[section];
    if (decision.decision === 'OMIT' && target && typeof target === 'object') {
      delete (target as Record<string, unknown>)[property];
    }
    if (decision.decision === 'MASK' && target && typeof target === 'object') {
      (target as Record<string, unknown>)[property] = '••••';
    }
  }
  return value;
}

const LIST_VISIBLE_FIELDS = new Set<People360Field>([
  'person.displayName',
  'person.lifecycleState',
  'employment.workerStatus',
  'primaryAssignment.businessTitle',
  'primaryAssignment.organizationName',
  'primaryAssignment.jobProfileName',
]);

export function people360ListSnapshot(options: Parameters<typeof people360Snapshot>[0] = {}) {
  const decisions = Object.fromEntries(
    PEOPLE_360_FIELD_REGISTRY.map((field) => [
      field,
      LIST_VISIBLE_FIELDS.has(field) ? 'VIEW' : 'OMIT',
    ])
  ) as Partial<Record<People360Field, People360FieldDecisionKind>>;
  return people360Snapshot({ ...options, decisions: { ...decisions, ...options.decisions } });
}

export function people360Page(
  items: readonly unknown[],
  options: Readonly<{ asOf?: string; hasMore?: boolean; nextCursor?: string }> = {}
) {
  return {
    items,
    size: items.length,
    hasMore: options.hasMore ?? false,
    ...(options.nextCursor ? { nextCursor: options.nextCursor } : {}),
    asOf: options.asOf ?? '2026-09-17',
  };
}

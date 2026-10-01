const WORKFORCE_ROLES = new Set(['ADMIN', 'HR_ADMIN', 'PEOPLE_ADMIN']);
const POPULATIONS = new Set(['TENANT', 'ORG_UNIT', 'ORG_TREE']);
const SUBJECT_TYPES = new Set(['ROLE', 'USER']);
const FIELD_GROUPS = new Set(['DIRECTORY', 'WORKER_IDENTIFIERS', 'EMPLOYMENT', 'JOB_GRADE']);
const ACTIONS = new Set(['READ', 'EXPORT']);
const STATES = new Set(['ACTIVE', 'SCHEDULED', 'REVOKED', 'EXPIRED']);

function key(group: string, known: Set<string>, value: string): string {
  return `workforceAccess.${group}.${known.has(value) ? value : 'UNKNOWN'}`;
}

export const workforcePopulationLabelKey = (value: string) =>
  key('populations', POPULATIONS, value);
export const workforceRoleLabelKey = (value: string) => key('roles', WORKFORCE_ROLES, value);
export const workforceRoleDescriptionKey = (value: string): string | null =>
  WORKFORCE_ROLES.has(value) ? `workforceAccess.roleDescriptions.${value}` : null;
export const workforceSubjectTypeLabelKey = (value: string) =>
  key('subjectTypes', SUBJECT_TYPES, value);
export const workforceFieldGroupLabelKey = (value: string) =>
  key('fieldGroups', FIELD_GROUPS, value);
export const workforceActionLabelKey = (value: string) => key('actions', ACTIONS, value);
export const workforceStateLabelKey = (value: string) => key('states', STATES, value);

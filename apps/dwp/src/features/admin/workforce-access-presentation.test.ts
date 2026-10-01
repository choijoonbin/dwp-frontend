import { describe, expect, it } from 'vitest';

import {
  workforceActionLabelKey,
  workforceFieldGroupLabelKey,
  workforcePopulationLabelKey,
  workforceRoleDescriptionKey,
  workforceRoleLabelKey,
  workforceStateLabelKey,
  workforceSubjectTypeLabelKey,
} from './workforce-access-presentation';

describe('workforce access presentation', () => {
  it('fails closed for unknown server values', () => {
    expect(workforcePopulationLabelKey('FUTURE')).toBe('workforceAccess.populations.UNKNOWN');
    expect(workforceRoleLabelKey('INTERNAL_ROLE')).toBe('workforceAccess.roles.UNKNOWN');
    expect(workforceRoleDescriptionKey('INTERNAL_ROLE')).toBeNull();
    expect(workforceSubjectTypeLabelKey('FUTURE')).toBe('workforceAccess.subjectTypes.UNKNOWN');
    expect(workforceFieldGroupLabelKey('FUTURE')).toBe('workforceAccess.fieldGroups.UNKNOWN');
    expect(workforceActionLabelKey('FUTURE')).toBe('workforceAccess.actions.UNKNOWN');
    expect(workforceStateLabelKey('FUTURE')).toBe('workforceAccess.states.UNKNOWN');
  });
});

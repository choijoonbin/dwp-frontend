import { describe, expect, it } from 'vitest';

import {
  canSubmitRoleGovernanceDraft,
  roleGovernanceDraftRequest,
} from './role-governance-role-dialog';

describe('role governance role dialog model', () => {
  it('requires a non-empty role code and name and blocks duplicate submission while busy', () => {
    expect(
      canSubmitRoleGovernanceDraft({ code: 'OPS_ADMIN', name: 'Operations admin' }, false)
    ).toBe(true);
    expect(canSubmitRoleGovernanceDraft({ code: ' ', name: 'Operations admin' }, false)).toBe(
      false
    );
    expect(canSubmitRoleGovernanceDraft({ code: 'OPS_ADMIN', name: ' ' }, false)).toBe(false);
    expect(
      canSubmitRoleGovernanceDraft({ code: 'OPS_ADMIN', name: 'Operations admin' }, true)
    ).toBe(false);
  });

  it('normalizes the editable draft without allowing a privileged role to be created here', () => {
    expect(
      roleGovernanceDraftRequest({
        code: ' OPS_ADMIN ',
        name: ' Operations admin ',
        description: ' Manages operations views. ',
        status: 'ACTIVE',
        assignableToGroups: true,
      })
    ).toEqual({
      code: 'OPS_ADMIN',
      name: 'Operations admin',
      description: 'Manages operations views.',
      status: 'ACTIVE',
      privileged: false,
      assignableToGroups: true,
    });
  });
});

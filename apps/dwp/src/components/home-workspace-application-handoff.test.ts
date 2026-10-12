import { describe, expect, it, vi } from 'vitest';

import {
  assignHomeWorkspaceApplication,
  HOME_WORKSPACE_EDIT_TARGET,
  replaceHomeWorkspaceApplication,
} from './home-workspace-application-handoff';

describe('Home workspace application handoff', () => {
  it('assigns the closed Workspace editor target exactly once for an intentional edit action', () => {
    const assign = vi.fn();

    assignHomeWorkspaceApplication(assign);

    expect(HOME_WORKSPACE_EDIT_TARGET).toBe('/?edit=home');
    expect(assign).toHaveBeenCalledTimes(1);
    expect(assign).toHaveBeenCalledWith('/?edit=home');
  });

  it('replaces the closed Workspace editor target exactly once for a legacy route', () => {
    const replace = vi.fn();

    replaceHomeWorkspaceApplication(replace);

    expect(replace).toHaveBeenCalledTimes(1);
    expect(replace).toHaveBeenCalledWith('/?edit=home');
  });
});

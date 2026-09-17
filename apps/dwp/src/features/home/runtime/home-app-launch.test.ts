import { describe, expect, it, vi } from 'vitest';

import { HOME_APPS } from '../../../components/workspace-composer/app-launchpad-model';
import { createHomeAppLauncher } from './home-app-launch';

import type { WorkspaceApp } from '@dwp-frontend/shared-utils';

describe('Home app launch path', () => {
  const approvals = HOME_APPS.find((app) => app.id === 'dwp-approvals')!;

  it('uses the broker-authorized canonical route without a legacy launch mutation in ACTIVE', () => {
    const navigate = vi.fn();
    const onLaunch = vi.fn();
    createHomeAppLauncher({
      navigate,
      onError: vi.fn(),
      onLaunch,
      v2Active: true,
      workspaceApps: [],
    })(approvals);

    expect(navigate).toHaveBeenCalledWith('/approvals/home');
    expect(onLaunch).not.toHaveBeenCalled();
  });

  it('retains the existing workspace launch mutation outside ACTIVE', () => {
    const onLaunch = vi.fn();
    createHomeAppLauncher({
      navigate: vi.fn(),
      onError: vi.fn(),
      onLaunch,
      v2Active: false,
      workspaceApps: [{ id: approvals.id, health: 'healthy' } as WorkspaceApp],
    })(approvals);

    expect(onLaunch).toHaveBeenCalledWith(approvals.id);
  });
});

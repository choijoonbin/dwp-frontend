import { describe, expect, it, vi } from 'vitest';

import {
  canUseMailWritingAssetAdminAction,
  MAIL_WRITING_ASSET_PERMISSION_BY_ACTION,
} from './mail-admin-writing-asset-policy';

describe('mail organization writing asset authorization', () => {
  it('uses the dedicated backend permission for every workflow action', () => {
    expect(MAIL_WRITING_ASSET_PERMISSION_BY_ACTION).toEqual({
      edit: 'WRITING_ASSET_EDIT',
      submit: 'WRITING_ASSET_SUBMIT',
      approve: 'WRITING_ASSET_APPROVE',
      publish: 'WRITING_ASSET_PUBLISH',
      retire: 'WRITING_ASSET_RETIRE',
    });
  });

  it('requires elevated access and prevents creator self-approval', () => {
    const hasPermission = vi.fn(() => true);

    expect(
      canUseMailWritingAssetAdminAction({ action: 'publish', elevated: false, hasPermission })
    ).toBe(false);
    expect(
      canUseMailWritingAssetAdminAction({
        action: 'approve',
        elevated: true,
        hasPermission,
        isCreator: true,
      })
    ).toBe(false);
    expect(
      canUseMailWritingAssetAdminAction({
        action: 'approve',
        elevated: true,
        hasPermission,
        isCreator: false,
      })
    ).toBe(true);
  });
});

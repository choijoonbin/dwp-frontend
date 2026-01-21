// ----------------------------------------------------------------------

import { describe, expect, it } from 'vitest';

import {
  createMatrixState,
  isMatrixDirty,
  generateDiffPayload,
  applyRowPermissions,
  applyColumnPermissions,
  applyAllPermissions,
  resetMatrixState,
  togglePermissionEffect,
  setPermissionEffect,
  getChangedResources,
  cycleState,
} from '../role-permission-matrix-utils';

import type { PermissionMatrixState, RolePermissionResponse } from '../types';

// ----------------------------------------------------------------------

describe('role-permission-matrix-utils', () => {
  describe('cycleState', () => {
    it('should cycle NONE -> ALLOW -> DENY -> NONE', () => {
      expect(cycleState('NONE')).toBe('ALLOW');
      expect(cycleState('ALLOW')).toBe('DENY');
      expect(cycleState('DENY')).toBe('NONE');
    });
  });

  describe('createMatrixState', () => {
    it('should create matrix state from permissions payload', () => {
      const permissions: RolePermissionResponse['permissions'] = [
        {
          resourceKey: 'menu.admin.users',
          permissionCodes: ['VIEW', 'USE'],
        },
        {
          resourceKey: 'menu.admin.roles',
          permissionCodes: ['VIEW'],
        },
      ];

      const state = createMatrixState(permissions);

      expect(state.original.size).toBe(2);
      expect(state.current.size).toBe(2);
      expect(state.original.get('menu.admin.users')?.get('VIEW')).toBe('ALLOW');
      expect(state.original.get('menu.admin.users')?.get('USE')).toBe('ALLOW');
      expect(state.original.get('menu.admin.roles')?.get('VIEW')).toBe('ALLOW');
    });

    it('should handle empty permissions', () => {
      const state = createMatrixState([]);
      expect(state.original.size).toBe(0);
      expect(state.current.size).toBe(0);
    });
  });

  describe('isMatrixDirty', () => {
    it('should return false when no changes', () => {
      const permissions: RolePermissionResponse['permissions'] = [
        {
          resourceKey: 'menu.admin.users',
          permissionCodes: ['VIEW'],
        },
      ];
      const state = createMatrixState(permissions);
      expect(isMatrixDirty(state)).toBe(false);
    });

    it('should return true when permission added', () => {
      const permissions: RolePermissionResponse['permissions'] = [
        {
          resourceKey: 'menu.admin.users',
          permissionCodes: ['VIEW'],
        },
      ];
      const state = createMatrixState(permissions);
      const newState = setPermissionEffect(state, 'menu.admin.users', 'USE', 'ALLOW');
      expect(isMatrixDirty(newState)).toBe(true);
    });

    it('should return true when permission removed', () => {
      const permissions: RolePermissionResponse['permissions'] = [
        {
          resourceKey: 'menu.admin.users',
          permissionCodes: ['VIEW', 'USE'],
        },
      ];
      const state = createMatrixState(permissions);
      const newState = setPermissionEffect(state, 'menu.admin.users', 'USE', 'NONE');
      expect(isMatrixDirty(newState)).toBe(true);
    });

    it('should return true when effect changed', () => {
      const permissions: RolePermissionResponse['permissions'] = [
        {
          resourceKey: 'menu.admin.users',
          permissionCodes: ['VIEW'],
          effect: 'ALLOW',
        },
      ];
      const state = createMatrixState(permissions);
      const newState = setPermissionEffect(state, 'menu.admin.users', 'VIEW', 'DENY');
      expect(isMatrixDirty(newState)).toBe(true);
    });
  });

  describe('generateDiffPayload', () => {
    it('should generate empty payload when no changes', () => {
      const permissions: RolePermissionResponse['permissions'] = [
        {
          resourceKey: 'menu.admin.users',
          permissionCodes: ['VIEW'],
        },
      ];
      const state = createMatrixState(permissions);
      const diff = generateDiffPayload(state, ['VIEW', 'USE']);
      expect(diff.items.length).toBe(0);
    });

    it('should generate diff for added permission', () => {
      const permissions: RolePermissionResponse['permissions'] = [
        {
          resourceKey: 'menu.admin.users',
          permissionCodes: ['VIEW'],
        },
      ];
      const state = createMatrixState(permissions);
      const newState = setPermissionEffect(state, 'menu.admin.users', 'USE', 'ALLOW');
      const diff = generateDiffPayload(newState, ['VIEW', 'USE']);
      expect(diff.items.length).toBe(1);
      expect(diff.items[0].resourceKey).toBe('menu.admin.users');
      expect(diff.items[0].permissionCode).toBe('USE');
      expect(diff.items[0].effect).toBe('ALLOW');
    });

    it('should generate diff for removed permission (effect=null)', () => {
      const permissions: RolePermissionResponse['permissions'] = [
        {
          resourceKey: 'menu.admin.users',
          permissionCodes: ['VIEW', 'USE'],
        },
      ];
      const state = createMatrixState(permissions);
      const newState = setPermissionEffect(state, 'menu.admin.users', 'USE', 'NONE');
      const diff = generateDiffPayload(newState, ['VIEW', 'USE']);
      expect(diff.items.length).toBe(1);
      expect(diff.items[0].resourceKey).toBe('menu.admin.users');
      expect(diff.items[0].permissionCode).toBe('USE');
      expect(diff.items[0].effect).toBe(null);
    });
  });

  describe('applyRowPermissions', () => {
    it('should apply all permissions to a resource', () => {
      const permissions: RolePermissionResponse['permissions'] = [
        {
          resourceKey: 'menu.admin.users',
          permissionCodes: ['VIEW'],
        },
      ];
      const state = createMatrixState(permissions);
      const newState = applyRowPermissions(state, 'menu.admin.users', ['VIEW', 'USE', 'EDIT'], 'ALLOW');

      const resourcePerms = newState.current.get('menu.admin.users');
      expect(resourcePerms?.get('VIEW')).toBe('ALLOW');
      expect(resourcePerms?.get('USE')).toBe('ALLOW');
      expect(resourcePerms?.get('EDIT')).toBe('ALLOW');
    });
  });

  describe('applyColumnPermissions', () => {
    it('should apply permission to all resources', () => {
      const permissions: RolePermissionResponse['permissions'] = [
        {
          resourceKey: 'menu.admin.users',
          permissionCodes: ['VIEW'],
        },
        {
          resourceKey: 'menu.admin.roles',
          permissionCodes: [],
        },
      ];
      const state = createMatrixState(permissions);
      const newState = applyColumnPermissions(state, 'USE', ['menu.admin.users', 'menu.admin.roles'], 'ALLOW');

      expect(newState.current.get('menu.admin.users')?.get('USE')).toBe('ALLOW');
      expect(newState.current.get('menu.admin.roles')?.get('USE')).toBe('ALLOW');
    });
  });

  describe('applyAllPermissions', () => {
    it('should apply all permissions to all resources', () => {
      const permissions: RolePermissionResponse['permissions'] = [
        {
          resourceKey: 'menu.admin.users',
          permissionCodes: ['VIEW'],
        },
        {
          resourceKey: 'menu.admin.roles',
          permissionCodes: [],
        },
      ];
      const state = createMatrixState(permissions);
      const newState = applyAllPermissions(state, ['menu.admin.users', 'menu.admin.roles'], ['VIEW', 'USE'], 'ALLOW');

      expect(newState.current.get('menu.admin.users')?.get('VIEW')).toBe('ALLOW');
      expect(newState.current.get('menu.admin.users')?.get('USE')).toBe('ALLOW');
      expect(newState.current.get('menu.admin.roles')?.get('VIEW')).toBe('ALLOW');
      expect(newState.current.get('menu.admin.roles')?.get('USE')).toBe('ALLOW');
    });
  });

  describe('togglePermissionEffect', () => {
    it('should toggle NONE -> ALLOW -> DENY -> NONE', () => {
      const permissions: RolePermissionResponse['permissions'] = [
        {
          resourceKey: 'menu.admin.users',
          permissionCodes: [],
        },
      ];
      const state = createMatrixState(permissions);

      // NONE -> ALLOW
      const state1 = togglePermissionEffect(state, 'menu.admin.users', 'VIEW');
      expect(state1.current.get('menu.admin.users')?.get('VIEW')).toBe('ALLOW');

      // ALLOW -> DENY
      const state2 = togglePermissionEffect(state1, 'menu.admin.users', 'VIEW');
      expect(state2.current.get('menu.admin.users')?.get('VIEW')).toBe('DENY');

      // DENY -> NONE
      const state3 = togglePermissionEffect(state2, 'menu.admin.users', 'VIEW');
      expect(state3.current.get('menu.admin.users')?.get('VIEW')).toBe('NONE');
    });
  });

  describe('resetMatrixState', () => {
    it('should reset current to original', () => {
      const permissions: RolePermissionResponse['permissions'] = [
        {
          resourceKey: 'menu.admin.users',
          permissionCodes: ['VIEW'],
        },
      ];
      const state = createMatrixState(permissions);
      const modifiedState = setPermissionEffect(state, 'menu.admin.users', 'USE', 'ALLOW');
      expect(isMatrixDirty(modifiedState)).toBe(true);

      const resetState = resetMatrixState(modifiedState);
      expect(isMatrixDirty(resetState)).toBe(false);
    });
  });

  describe('getChangedResources', () => {
    it('should return empty set when no changes', () => {
      const permissions: RolePermissionResponse['permissions'] = [
        {
          resourceKey: 'menu.admin.users',
          permissionCodes: ['VIEW'],
        },
      ];
      const state = createMatrixState(permissions);
      const changed = getChangedResources(state);
      expect(changed.size).toBe(0);
    });

    it('should return changed resources', () => {
      const permissions: RolePermissionResponse['permissions'] = [
        {
          resourceKey: 'menu.admin.users',
          permissionCodes: ['VIEW'],
        },
        {
          resourceKey: 'menu.admin.roles',
          permissionCodes: ['VIEW'],
        },
      ];
      const state = createMatrixState(permissions);
      const modifiedState = setPermissionEffect(state, 'menu.admin.users', 'USE', 'ALLOW');
      const changed = getChangedResources(modifiedState);
      expect(changed.size).toBe(1);
      expect(changed.has('menu.admin.users')).toBe(true);
    });
  });
});

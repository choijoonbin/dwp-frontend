import { describe, expect, it } from 'vitest';

import { resolveRoleDisplayCopy } from './role-display';

import type { TFunction } from 'i18next';

const translations: Record<string, string> = {
  'roleGovernance.systemRoles.ADMIN.name': '관리자',
  'roleGovernance.systemRoles.ADMIN.description': '플랫폼 전반의 기본 관리 권한을 수행합니다.',
};

const t = ((key: string, options?: { defaultValue?: string }) =>
  translations[key] ?? options?.defaultValue ?? key) as TFunction<'admin'>;

describe('resolveRoleDisplayCopy', () => {
  it('localizes a governed system role by its stable code', () => {
    expect(
      resolveRoleDisplayCopy(
        {
          code: 'ADMIN',
          name: 'Administrator',
          description: 'Foundation administrator role',
        },
        t
      )
    ).toEqual({
      name: '관리자',
      description: '플랫폼 전반의 기본 관리 권한을 수행합니다.',
    });
  });

  it('preserves customer-defined role copy', () => {
    expect(
      resolveRoleDisplayCopy(
        {
          code: 'SKAX_FINANCE_REVIEWER',
          name: '재무 검토자',
          description: '결산 자료를 검토합니다.',
        },
        t
      )
    ).toEqual({
      name: '재무 검토자',
      description: '결산 자료를 검토합니다.',
    });
  });

  it('falls back to server copy when a catalog translation is unavailable', () => {
    expect(
      resolveRoleDisplayCopy(
        {
          code: 'PLATFORM_ADMIN',
          name: 'Platform administrator',
          description: null,
        },
        t
      )
    ).toEqual({ name: 'Platform administrator', description: '' });
  });
});

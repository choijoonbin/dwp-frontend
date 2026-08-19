import { describe, expect, it } from 'vitest';

import english from '../locales/en/display.json';
import korean from '../locales/ko/display.json';
import { SYSTEM_ROLE_CODES, resolveRoleDisplayCopy } from './role-display';

import type { TFunction } from 'i18next';

function translation(bundle: typeof english): TFunction<'display'> {
  return ((key: string, options?: { defaultValue?: string }) => {
    const value = key.split('.').reduce<unknown>((current, part) => {
      if (!current || typeof current !== 'object') return undefined;
      return (current as Record<string, unknown>)[part];
    }, bundle);
    return typeof value === 'string' ? value : (options?.defaultValue ?? key);
  }) as TFunction<'display'>;
}

describe('system role display dictionary', () => {
  it('covers every governed system role in every product locale', () => {
    for (const code of SYSTEM_ROLE_CODES) {
      expect(english.roleNames[code]).toBeTruthy();
      expect(english.roleDescriptions[code]).toBeTruthy();
      expect(korean.roleNames[code]).toBeTruthy();
      expect(korean.roleDescriptions[code]).toBeTruthy();
    }
  });

  it('localizes a system role using its stable code', () => {
    expect(
      resolveRoleDisplayCopy(
        {
          code: 'CALENDAR_ADMIN',
          name: 'Calendar administrator',
          description: 'English server copy',
        },
        translation(korean)
      )
    ).toEqual({
      name: '일정 관리자',
      description:
        '비공개 일정 세부정보를 열람하지 않고 일정 정책, 업무 공간 리소스 및 캘린더 연동을 관리합니다.',
    });
  });

  it('preserves customer-authored copy for a tenant role', () => {
    expect(
      resolveRoleDisplayCopy(
        {
          code: 'SKAX_FINANCE_REVIEWER',
          name: '재무 검토자',
          description: '결산 자료를 검토합니다.',
        },
        translation(korean)
      )
    ).toEqual({
      name: '재무 검토자',
      description: '결산 자료를 검토합니다.',
    });
  });
});

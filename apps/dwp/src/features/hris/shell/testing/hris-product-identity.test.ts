import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import { HOME_APPS } from '../../../../components/workspace-composer/app-launchpad-model';

function locale(path: string): unknown {
  return JSON.parse(readFileSync(resolve(process.cwd(), path), 'utf8'));
}

describe('HRIS visible product identity', () => {
  it('keeps canonical technical identifiers while renaming the launchpad product', () => {
    expect(HOME_APPS.find((app) => app.id === 'ref-app-people')).toMatchObject({
      name: 'HRIS',
      shortName: 'HRIS',
      route: '/hr',
      resourceKey: 'APP.HCM',
      notificationSourceKey: 'hcm',
    });
  });

  it.each(['ko', 'en'])('uses HRIS at the shell and home app entry in %s', (language) => {
    const hcm = locale(`libs/shared-i18n/src/locales/${language}/hcm.json`) as {
      shell: { hcm: { name: string; context: string } };
      navigation: {
        items: {
          hcm: Record<string, { label: string }>;
        };
      };
    };
    const shell = locale(`libs/shared-i18n/src/locales/${language}/shell.json`) as {
      navigation: { items: { hcm: string; hris: string } };
    };
    const home = locale(`libs/shared-i18n/src/locales/${language}/home.json`) as {
      apps: {
        items: { 'ref-app-people': { name: string; shortName: string; description: string } };
      };
    };
    expect(hcm.shell.hcm).toEqual({
      name: 'HRIS',
      context: 'DWP HRIS',
      navigationLabel: language === 'ko' ? 'HRIS 메뉴' : 'HRIS navigation',
    });
    expect(hcm.navigation.items.hcm.home.label).toBe(language === 'ko' ? 'HRIS 홈' : 'HRIS home');
    expect(
      [
        'shell-home',
        'workbench-my-hr',
        'workbench-team',
        'workbench-hr-operations',
        'workbench-time',
        'workbench-payroll',
        'workbench-performance',
        'workbench-settings',
      ].map((key) => hcm.navigation.items.hcm[key]?.label)
    ).toEqual(
      language === 'ko'
        ? ['HRIS 홈', '내 HR', '팀', '인사 운영', '근태', '급여', '성과', '설정']
        : [
            'HRIS home',
            'My HR',
            'Team',
            'People operations',
            'Time',
            'Payroll',
            'Performance',
            'Settings',
          ]
    );
    expect(shell.navigation.items).toMatchObject({ hcm: 'HRIS', hris: 'HRIS' });
    expect(home.apps.items['ref-app-people']).toMatchObject({ name: 'HRIS', shortName: 'HRIS' });
    expect(home.apps.items['ref-app-people'].description).not.toContain('DWP HCM');
  });
});

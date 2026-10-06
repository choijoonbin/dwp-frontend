import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

function locale(path: string): unknown {
  return JSON.parse(readFileSync(resolve(process.cwd(), path), 'utf8'));
}

describe('HRIS visible product identity', () => {
  it.each(['ko', 'en'])('uses HRIS across direct product labels in %s', (language) => {
    const hcm = locale(`libs/shared-i18n/src/locales/${language}/hcm.json`) as {
      shell: {
        openNavigation: string;
        hcm: { name: string; context: string; navigationLabel: string };
      };
      navigation: { items: { hcm: { home: { label: string } } } };
      pages: { hcm: Record<string, { eyebrow: string }> };
      home: {
        customizeLabel: string;
        saved: string;
        saveConflict: string;
        saveError: string;
        mode: { label: string };
      };
    };
    const shell = locale(`libs/shared-i18n/src/locales/${language}/shell.json`) as {
      navigation: { items: { hcm: string; hris: string } };
    };
    const home = locale(`libs/shared-i18n/src/locales/${language}/home.json`) as {
      flow: {
        apps: { 'APP.HCM': string };
        context: { domains: { people: string } };
        contributions: { notification: { apps: { hcm: string } } };
        sources: { people: string };
      };
      apps: {
        items: { 'ref-app-people': { name: string; shortName: string; description: string } };
      };
    };
    const work = locale(`libs/shared-i18n/src/locales/${language}/work.json`) as {
      reference: { apps: { 'ref-app-people': { name: string } } };
    };
    const admin = locale(`libs/shared-i18n/src/locales/${language}/admin.json`) as {
      appGovernance: { adoption: { products: { hcm: string } } };
    };
    const notifications = locale(`libs/shared-i18n/src/locales/${language}/notifications.json`) as {
      sources: { hcm: string };
    };
    const mail = locale(`libs/shared-i18n/src/locales/${language}/mail.json`) as {
      proposal: {
        targets: { hr: string };
        types: { leaveRequest: { confirm: string } };
      };
    };

    expect(hcm.shell.openNavigation).toContain('HRIS');
    expect(hcm.shell.hcm).toEqual({
      name: 'HRIS',
      context: 'DWP HRIS',
      navigationLabel: language === 'ko' ? 'HRIS 메뉴' : 'HRIS navigation',
    });
    expect(hcm.navigation.items.hcm.home.label).toBe(language === 'ko' ? 'HRIS 홈' : 'HRIS home');
    expect(Object.values(hcm.pages.hcm).every(({ eyebrow }) => eyebrow.startsWith('HRIS /'))).toBe(
      true
    );
    expect(
      [
        hcm.home.customizeLabel,
        hcm.home.saved,
        hcm.home.saveConflict,
        hcm.home.saveError,
        hcm.home.mode.label,
      ].every((label) => label.includes('HRIS'))
    ).toBe(true);
    expect(shell.navigation.items).toMatchObject({ hcm: 'HRIS', hris: 'HRIS' });
    expect(home.apps.items['ref-app-people']).toMatchObject({ name: 'HRIS', shortName: 'HRIS' });
    expect(home.apps.items['ref-app-people'].description).not.toContain('DWP HCM');
    expect(home.flow.apps['APP.HCM']).toBe('HRIS');
    expect(home.flow.context.domains.people).toBe('HRIS');
    expect(home.flow.contributions.notification.apps.hcm).toBe('HRIS');
    expect(home.flow.sources.people).toBe('HRIS');
    expect(work.reference.apps['ref-app-people'].name).toBe('HRIS');
    expect(admin.appGovernance.adoption.products.hcm).toBe('HRIS');
    expect(notifications.sources.hcm).toBe('HRIS');
    expect(mail.proposal.targets.hr).toBe('HRIS');
    expect(mail.proposal.types.leaveRequest.confirm).toContain('HRIS');
  });
});

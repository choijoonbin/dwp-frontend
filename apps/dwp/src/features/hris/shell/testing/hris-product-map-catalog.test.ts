import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import {
  countHrisCatalogByInventoryGroup,
  filterHrisCatalog,
  HRIS_PRODUCT_MAP_CATALOG,
  HRIS_RETAINED_OUTSIDE_TARGET,
} from '../index';

const HCM_AUDIT_OVERVIEW_HREF = '/admin/governance/audit-overview?product=HCM&tab=overview';

describe('HRIS target product map catalog', () => {
  it('preserves the exact 76-node semantic contract and immutable boundary', () => {
    const semanticJson = JSON.stringify(HRIS_PRODUCT_MAP_CATALOG);

    expect(createHash('sha256').update(semanticJson).digest('hex')).toBe(
      'beec4808ea853830be012778ddf67758ac04459071fd6dbd50213e1d85dc0ff2'
    );
    expect(Object.isFrozen(HRIS_PRODUCT_MAP_CATALOG)).toBe(true);
    expect(HRIS_PRODUCT_MAP_CATALOG.every((item) => Object.isFrozen(item))).toBe(true);
  });

  it('freezes the complete 76-menu target inventory by domain', () => {
    expect(HRIS_PRODUCT_MAP_CATALOG).toHaveLength(76);
    expect(countHrisCatalogByInventoryGroup()).toEqual({
      MY_HR: 8,
      TEAM: 7,
      HR_OPERATIONS: 10,
      TIME: 10,
      PAYROLL: 14,
      PERFORMANCE: 8,
      SETTINGS: 13,
      DWP_CONTROL: 6,
    });
    expect(new Set(HRIS_PRODUCT_MAP_CATALOG.map((item) => item.id)).size).toBe(76);
  });

  it('opens only delivered, governed pilot routes', () => {
    const pilot = HRIS_PRODUCT_MAP_CATALOG.filter((item) => item.lifecycle === 'PILOT');
    expect(pilot.map(({ module, href }) => [module, href])).toEqual([
      ['SYS', '/hr/home'],
      ['HRM', '/hr/me/employment-documents'],
      ['TIM', '/hr/time'],
      ['PAY', '/hr/pay'],
      ['PER', '/hr/talent'],
      ['HRM', '/hr/operations/people'],
      ['HRM', '/hr/operations/people/employment-assignments'],
      ['TIM', '/hr/operations/time/clock-ingestion'],
      ['TIM', '/hr/operations/time/interpretation'],
      ['TIM', '/hr/operations/time/exceptions'],
      ['PER', '/hr/operations/performance/review-operations'],
      ['PAY', '/hr/settings/payroll'],
    ]);
    expect(new Set(pilot.map((item) => item.module))).toEqual(
      new Set(['SYS', 'HRM', 'TIM', 'PAY', 'PER'])
    );
  });

  it('promotes only the four delivered Wave 2 nodes with honest bounded coverage', () => {
    const promoted = [
      ['my-employment-documents', '/hr/me/employment-documents'],
      ['hr-employment-assignments', '/hr/operations/people/employment-assignments'],
      ['time-interpretation', '/hr/operations/time/interpretation'],
      ['settings-payroll', '/hr/settings/payroll'],
    ] as const;

    for (const [id, href] of promoted) {
      expect(HRIS_PRODUCT_MAP_CATALOG.find((item) => item.id === id)).toMatchObject({
        lifecycle: 'PILOT',
        availability: 'CURRENT_RUNTIME',
        authorization: 'RUNTIME_POLICY_REQUIRED',
        href,
        coverageNote: {
          ko: expect.any(String),
          en: expect.any(String),
        },
      });
    }
    expect(
      HRIS_PRODUCT_MAP_CATALOG.find((item) => item.id === 'hr-employment-assignments')?.legacyPaths
    ).toEqual(['/hr/operations/assignments', '/hr/operations/people/employment-assignments']);
  });

  it('keeps non-pilot work inert except for the exact governed HCM audit handoff', () => {
    const future = HRIS_PRODUCT_MAP_CATALOG.filter((item) => item.lifecycle !== 'PILOT');
    expect(future).toHaveLength(64);
    expect(future.filter((item) => item.href !== undefined)).toEqual([
      expect.objectContaining({
        id: 'dwp-governance',
        lifecycle: 'EXTERNAL',
        externalTarget: 'DWP_GOVERNANCE',
        authorization: 'CENTRAL_POLICY',
        href: HCM_AUDIT_OVERVIEW_HREF,
      }),
    ]);
    expect(HRIS_PRODUCT_MAP_CATALOG.find((item) => item.id === 'pay-year-end-tax')).toMatchObject({
      lifecycle: 'BLOCKED_EVIDENCE',
      authorization: 'NOT_EVALUATED',
    });
    expect(HRIS_PRODUCT_MAP_CATALOG.filter((item) => item.lifecycle === 'EXTERNAL')).toHaveLength(
      6
    );
  });

  it('assigns every external setting to its DWP owner and only governance to an href', () => {
    const external = HRIS_PRODUCT_MAP_CATALOG.filter((item) => item.lifecycle === 'EXTERNAL');
    expect(external.map((item) => [item.id, item.externalTarget])).toEqual([
      ['dwp-experience', 'DWP_EXPERIENCE'],
      ['dwp-identity', 'DWP_IDENTITY'],
      ['dwp-platform', 'DWP_PLATFORM'],
      ['dwp-integrations', 'DWP_INTEGRATIONS'],
      ['dwp-governance', 'DWP_GOVERNANCE'],
      ['dwp-extensibility', 'DWP_EXTENSIBILITY'],
    ]);
    expect(
      external.filter((item) => item.href !== undefined).map((item) => [item.id, item.href])
    ).toEqual([['dwp-governance', HCM_AUDIT_OVERVIEW_HREF]]);
    expect(
      external
        .filter((item) => item.id !== 'dwp-governance')
        .every((item) => item.href === undefined)
    ).toBe(true);
    expect(
      HRIS_PRODUCT_MAP_CATALOG.filter((item) => item.lifecycle !== 'EXTERNAL').every(
        (item) => item.externalTarget === undefined
      )
    ).toBe(true);
  });

  it('keeps delivery, availability, and authorization as independent facts', () => {
    expect(
      HRIS_PRODUCT_MAP_CATALOG.filter((item) => item.lifecycle === 'PILOT').every(
        (item) =>
          item.availability === 'CURRENT_RUNTIME' &&
          item.authorization === 'RUNTIME_POLICY_REQUIRED'
      )
    ).toBe(true);
    expect(
      HRIS_PRODUCT_MAP_CATALOG.some(
        (item) =>
          item.lifecycle === 'PLANNED' &&
          item.availability === 'LEGACY_PARTIAL' &&
          item.authorization === 'RUNTIME_POLICY_REQUIRED'
      )
    ).toBe(true);
    expect(
      HRIS_PRODUCT_MAP_CATALOG.some(
        (item) =>
          item.lifecycle === 'PLANNED' &&
          item.availability === 'ROADMAP' &&
          item.authorization === 'NOT_EVALUATED'
      )
    ).toBe(true);
    expect(
      HRIS_PRODUCT_MAP_CATALOG.filter((item) => item.lifecycle === 'EXTERNAL').every(
        (item) => item.authorization === 'CENTRAL_POLICY'
      )
    ).toBe(true);
    expect(
      new Set(
        HRIS_PRODUCT_MAP_CATALOG.filter((item) => item.lifecycle === 'EXTERNAL').map(
          (item) => item.availability
        )
      )
    ).toEqual(new Set(['DWP_CONTROL_PLANE', 'LEGACY_PARTIAL']));
  });

  it('reconciles every governed route without folding retained legacy or BENSK work into HRIS', () => {
    const navigationSource = readFileSync(
      new URL('../../../hcm/hcm-navigation.ts', import.meta.url),
      'utf8'
    );
    const governed = [...navigationSource.matchAll(/path: '(\/hr\/[^']+)'/gu)].map(
      (match) => match[1]!
    );
    const mapped = HRIS_PRODUCT_MAP_CATALOG.flatMap((item) => item.legacyPaths);
    const retained = HRIS_RETAINED_OUTSIDE_TARGET.map((item) => item.path);
    const deliveredModern = [
      '/hr/operations/performance/compensation-planning',
      '/hr/settings/navigation-policy',
    ];

    expect(new Set([...mapped, ...retained, ...deliveredModern])).toEqual(new Set(governed));
    expect(HRIS_RETAINED_OUTSIDE_TARGET.map((item) => [item.path, item.sourceModule])).toEqual([
      ['/hr/data/reference', 'LEGACY_WORKFORCE_REFERENCE'],
      ['/hr/benefits', 'BENSK'],
      ['/hr/operations/benefits', 'BENSK'],
    ]);
    expect(
      HRIS_PRODUCT_MAP_CATALOG.filter((item) => item.availability === 'LEGACY_PARTIAL').every(
        (item) =>
          Boolean(item.coverageNote) &&
          (item.id === 'dwp-governance'
            ? item.href === HCM_AUDIT_OVERVIEW_HREF
            : item.href === undefined)
      )
    ).toBe(true);
  });

  it('allows only reviewed one-to-many legacy mappings and never exposes them as actions', () => {
    const occurrences = new Map<string, number>();
    for (const path of HRIS_PRODUCT_MAP_CATALOG.flatMap((item) => item.legacyPaths)) {
      occurrences.set(path, (occurrences.get(path) ?? 0) + 1);
    }
    expect(
      [...occurrences]
        .filter(([, count]) => count > 1)
        .sort(([left], [right]) => left.localeCompare(right))
    ).toEqual([
      ['/hr/data/integrations', 3],
      ['/hr/me', 2],
      ['/hr/team', 2],
    ]);
    expect(
      HRIS_PRODUCT_MAP_CATALOG.filter(
        (item) => item.lifecycle !== 'PILOT' && item.href !== undefined
      ).map((item) => [item.id, item.href])
    ).toEqual([['dwp-governance', HCM_AUDIT_OVERVIEW_HREF]]);
  });

  it('projects work surfaces by module and persona without changing the catalog', () => {
    expect(filterHrisCatalog('OPERATIONS', 'TIM', 'OPERATOR')).toHaveLength(10);
    expect(filterHrisCatalog('OPERATIONS', 'PAY', 'EMPLOYEE')).toEqual([]);
    expect(filterHrisCatalog('SETTINGS', 'SYS', 'AUDITOR').map((item) => item.id)).toEqual([
      'dwp-identity',
      'dwp-governance',
    ]);
    expect(HRIS_PRODUCT_MAP_CATALOG).toHaveLength(76);
  });
});

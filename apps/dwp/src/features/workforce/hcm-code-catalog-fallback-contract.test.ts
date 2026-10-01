import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

type WorkforceCopy = Readonly<{
  orgChart: {
    scenarios: { positionPlan: { catalogFallback: string } };
  };
  provisioning: {
    hris: { create: { catalogFallback: string } };
  };
}>;

function workspaceSource(relativePath: string): string {
  return readFileSync(path.resolve(process.cwd(), relativePath), 'utf8');
}

function workforceCopy(locale: 'en' | 'ko'): WorkforceCopy {
  return JSON.parse(
    workspaceSource(`libs/shared-i18n/src/locales/${locale}/workforce.json`)
  ) as WorkforceCopy;
}

describe('HCM governed code catalog fallback disclosure', () => {
  it('keeps registered labels on success and discloses only query failures', () => {
    const hris = workspaceSource('apps/dwp/src/features/workforce/hris-operations-dialogs.tsx');
    const position = workspaceSource(
      'apps/dwp/src/features/people/organization/organization-scenario-position-editor.tsx'
    );

    expect(hris).toContain(
      'sourceCatalog.isError || connectorCatalog.isError || authCatalog.isError'
    );
    expect(hris).toContain("t('provisioning.hris.create.catalogFallback')");
    expect(hris).toContain('catalog.data?.values');
    expect(position).toContain('positionTypeCatalog.isError || criticalityCatalog.isError');
    expect(position).toContain("t('orgChart.scenarios.positionPlan.catalogFallback')");
    expect(position).toContain('positionTypeCatalog.data?.values');
    expect(position).toContain('criticalityCatalog.data?.values');
  });

  it.each(['en', 'ko'] as const)('provides honest %s fallback copy', (locale) => {
    const copy = workforceCopy(locale);

    expect(copy.provisioning.hris.create.catalogFallback).toMatch(/catalog|카탈로그/iu);
    expect(copy.provisioning.hris.create.catalogFallback).toMatch(/built-in|내장/iu);
    expect(copy.orgChart.scenarios.positionPlan.catalogFallback).toMatch(/catalog|카탈로그/iu);
    expect(copy.orgChart.scenarios.positionPlan.catalogFallback).toMatch(/built-in|내장/iu);
  });
});

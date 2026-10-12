import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import { refetchReferenceConfigurationCommandResult } from '../hooks/use-reference-configuration-workspace';
import {
  HRIS_REFERENCE_CONFIGURATION_RUNTIME_STATE,
  HrisReferenceConfigurationWorkspace,
} from '../pages/hris-reference-configuration-workspace';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, options?: { defaultValue?: string }) => options?.defaultValue ?? _key,
  }),
}));

describe('HrisReferenceConfigurationWorkspace', () => {
  it('exposes a dedicated default-off boundary without lifecycle actions', () => {
    const html = renderToStaticMarkup(createElement(HrisReferenceConfigurationWorkspace));

    expect(HRIS_REFERENCE_CONFIGURATION_RUNTIME_STATE).toBe('OFF');
    expect(html).toContain('data-testid="hris-reference-configuration-workspace"');
    expect(html).toContain('data-runtime-state="OFF"');
    expect(html).toContain('Reference-configuration lifecycle is unavailable');
    expect(html).toContain('Feature state: OFF');
    expect(html).toContain('/hr/data/reference');
    expect(html).not.toContain('<button');
    expect(html).not.toContain('<form');
  });

  it('mounts the governed settings route without reusing workforce reference data', () => {
    const hcmPage = readFileSync(new URL('../../../../../pages/hcm.tsx', import.meta.url), 'utf8');
    const workspace = readFileSync(
      new URL('../pages/hris-reference-configuration-workspace.tsx', import.meta.url),
      'utf8'
    );

    expect(hcmPage).toContain("import('../features/hris/administration/reference-configuration')");
    expect(hcmPage).toContain("'settings-reference': <HrisReferenceConfigurationWorkspace />");
    expect(hcmPage).toContain("'reference-data': <WorkforceReferenceData />");
    expect(workspace).not.toContain('features/workforce');
    expect(workspace).not.toContain('WorkforceReferenceData');
    expect(workspace).toContain('commandOwner={commandOwner}');
    expect(workspace).toContain('workspace.refreshAfterCommand(receipt)');
    expect(workspace).not.toContain('productSurfaceHighRiskMutationConfig');
    expect(workspace).not.toContain('preparedAction');
  });

  it('refetches both workbench and immutable detail before command success is accepted', async () => {
    const workbench = vi.fn(async () => ({ isError: false }));
    const detail = vi.fn(async () => ({ isError: false }));

    await expect(
      refetchReferenceConfigurationCommandResult(workbench, detail)
    ).resolves.toBeUndefined();
    expect(workbench).toHaveBeenCalledTimes(1);
    expect(detail).toHaveBeenCalledTimes(1);

    await expect(
      refetchReferenceConfigurationCommandResult(
        async () => ({ isError: false }),
        async () => ({ isError: true, error: new Error('stale CAS detail') })
      )
    ).rejects.toThrow('stale CAS detail');
  });
});

// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { HrisPayrollConfigurationWorkspace } from './hris-payroll-configuration-workspace';

const runtime = vi.hoisted(() => ({
  formula: vi.fn(() => null),
  foundation: vi.fn(() => null),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: 'en', resolvedLanguage: 'en' },
  }),
}));

vi.mock('@dwp-frontend/shared-i18n', () => ({
  resolveSupportedLocale: () => 'en',
}));

vi.mock('../payroll', () => ({
  HrisPayrollFoundationSettingsWorkspace: runtime.foundation,
  PayrollConfigurationWorkbenchRuntime: runtime.formula,
  payrollElementFormulaDataSource: { workbench: vi.fn() },
}));

vi.mock('../../../components/use-product-surface-request-scope', () => ({
  useProductSurfaceRequestScope: () => ({
    governed: true,
    ready: false,
    cacheKey: [],
    queryMeta: { decisionRevision: undefined },
  }),
}));

vi.mock('../../../components/use-product-action-mutation', () => ({
  useProductActionMutation: () => vi.fn(),
}));

vi.mock('../../../components/use-product-surface-high-risk-command-executor', () => ({
  useProductSurfaceHighRiskCommandExecutor: () => ({ execute: vi.fn(), controller: {} }),
}));

vi.mock('../../../components/product-surface-high-risk-command', () => ({
  ProductSurfaceHighRiskCommandDialog: () => null,
  productSurfaceHighRiskCommand: (value: unknown) => value,
}));

let host: HTMLDivElement;
let root: Root;

async function render(entry: string, foundationEnabled: boolean) {
  await act(async () => {
    root.render(
      <MemoryRouter initialEntries={[entry]}>
        <HrisPayrollConfigurationWorkspace foundationEnabled={foundationEnabled} />
      </MemoryRouter>
    );
  });
}

describe('payroll configuration composite tab authority', () => {
  beforeEach(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    runtime.formula.mockClear();
    runtime.foundation.mockClear();
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    host.remove();
  });

  it('keeps formula on the existing PAGE and admits Foundation only through the allowlisted tab', async () => {
    await render('/hr/settings/payroll', true);
    expect(runtime.formula).toHaveBeenCalledOnce();
    expect(runtime.foundation).not.toHaveBeenCalled();

    await act(async () => root.unmount());
    host.remove();
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
    runtime.formula.mockClear();

    await render('/hr/settings/payroll?tab=foundation', true);
    expect(runtime.foundation).toHaveBeenCalledOnce();
    expect(runtime.formula).not.toHaveBeenCalled();
  });

  it('is default-off and mounts no data runtime for disabled or unknown deep links', async () => {
    await render('/hr/settings/payroll?tab=foundation', false);
    expect(host.textContent).toContain('pages.hcm.settings-payroll.foundationOffTitle');
    expect(runtime.formula).not.toHaveBeenCalled();
    expect(runtime.foundation).not.toHaveBeenCalled();

    await act(async () => root.unmount());
    host.remove();
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);

    await render('/hr/settings/payroll?tab=not-allowlisted', true);
    expect(host.textContent).toContain('pages.hcm.settings-payroll.invalidTabTitle');
    expect(runtime.formula).not.toHaveBeenCalled();
    expect(runtime.foundation).not.toHaveBeenCalled();
  });
});

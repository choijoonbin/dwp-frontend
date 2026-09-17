// @vitest-environment jsdom
import { act } from 'react';
import { fireEvent, getByRole, queryByRole } from '@testing-library/dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AdminV2StateBoundary } from './admin-v2-foundation';
import { stateCopy } from './admin-v2-test-fixtures';
import { createAdminV2TestHarness, type AdminV2TestHarness } from './admin-v2-test-harness';

describe('admin v2 source states', () => {
  let harness: AdminV2TestHarness;

  beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    harness = createAdminV2TestHarness();
  });

  afterEach(async () => {
    await harness.destroy();
    vi.unstubAllGlobals();
  });

  it('renders loading and forbidden as closed full-workspace states without a retry on 403', async () => {
    await harness.render(
      <AdminV2StateBoundary state="loading" copy={stateCopy}>
        <div>ready content</div>
      </AdminV2StateBoundary>
    );
    expect(getByRole(harness.node, 'status', { name: stateCopy.loadingTitle })).toBeDefined();
    expect(harness.node.textContent).not.toContain('ready content');

    await harness.render(
      <AdminV2StateBoundary state="forbidden" copy={stateCopy} actions={{ onRetry: vi.fn() }}>
        <div>ready content</div>
      </AdminV2StateBoundary>
    );
    expect(getByRole(harness.node, 'alert').textContent).toContain(stateCopy.forbiddenTitle);
    expect(queryByRole(harness.node, 'button', { name: stateCopy.retryAction })).toBeNull();
  });

  it('offers explicit recovery for 503 and preserves content while resolving 409', async () => {
    const retry = vi.fn();
    const resolveConflict = vi.fn();
    await harness.render(
      <AdminV2StateBoundary state="unavailable" copy={stateCopy} actions={{ onRetry: retry }}>
        <div>ready content</div>
      </AdminV2StateBoundary>
    );
    await act(async () => fireEvent.click(getByRole(harness.node, 'button')));
    expect(retry).toHaveBeenCalledTimes(1);

    await harness.render(
      <AdminV2StateBoundary
        state="conflict"
        copy={stateCopy}
        actions={{ onResolveConflict: resolveConflict }}
      >
        <div>preserved input</div>
      </AdminV2StateBoundary>
    );
    expect(harness.node.textContent).toContain('preserved input');
    await act(async () =>
      fireEvent.click(getByRole(harness.node, 'button', { name: stateCopy.conflictAction }))
    );
    expect(resolveConflict).toHaveBeenCalledTimes(1);
  });

  it('keeps stale data visible while exposing an authority refresh', async () => {
    const retry = vi.fn();
    await harness.render(
      <AdminV2StateBoundary state="stale" copy={stateCopy} actions={{ onRetry: retry }}>
        <div>stale review data</div>
      </AdminV2StateBoundary>
    );
    expect(harness.node.textContent).toContain('stale review data');
    await act(async () =>
      fireEvent.click(getByRole(harness.node, 'button', { name: stateCopy.staleAction }))
    );
    expect(retry).toHaveBeenCalledTimes(1);
  });
});

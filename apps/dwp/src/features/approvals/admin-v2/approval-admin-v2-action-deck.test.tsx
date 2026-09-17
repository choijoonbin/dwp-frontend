// @vitest-environment jsdom
import { act } from 'react';
import { fireEvent, getByRole } from '@testing-library/dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ApprovalAdminV2ActionDeck } from './approval-admin-v2-action-deck';
import { createAdminV2TestHarness, type AdminV2TestHarness } from './admin-v2-test-harness';

describe('APR-21 to APR-24 governed action deck', () => {
  let harness: AdminV2TestHarness;

  beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    harness = createAdminV2TestHarness();
  });

  afterEach(async () => {
    await harness.destroy();
    vi.unstubAllGlobals();
  });

  it('keeps safe evidence reads available while risky commands are mobile review-only', async () => {
    const onRead = vi.fn();
    const onGoverned = vi.fn();
    await harness.render(
      <ApprovalAdminV2ActionDeck
        state="ready"
        deck={{
          id: 'deployment',
          title: 'Deployment evidence controls',
          description: 'Read current telemetry before dispatching governed commands.',
          actions: [
            {
              id: 'telemetry',
              risk: 'READ',
              label: 'Open telemetry',
              description: 'Reads the latest server-authored evidence window.',
              ready: true,
              onAction: onRead,
            },
            {
              id: 'rollback',
              risk: 'GOVERNED',
              label: 'Request rollback',
              description: 'Uses the bound package, version, and feasibility evidence.',
              mobileLabel: 'Review rollback only',
              mobileReason: 'Rollback dispatch requires a desktop governed review.',
              ready: true,
              onAction: onGoverned,
            },
          ],
        }}
      />
    );

    await act(async () => {
      fireEvent.click(getByRole(harness.node, 'button', { name: 'Open telemetry' }));
      fireEvent.click(getByRole(harness.node, 'button', { name: 'Request rollback' }));
    });

    expect(onRead).toHaveBeenCalledOnce();
    expect(onGoverned).toHaveBeenCalledOnce();
    expect(
      getByRole<HTMLButtonElement>(harness.node, 'button', { name: 'Review rollback only' })
        .disabled
    ).toBe(true);
  });

  it('fails every action closed when the source snapshot is stale', async () => {
    const onRead = vi.fn();
    await harness.render(
      <ApprovalAdminV2ActionDeck
        state="stale"
        deck={{
          id: 'audit',
          title: 'Audit evidence controls',
          description: 'Actions are bound to the current source snapshot.',
          actions: [
            {
              id: 'verify',
              risk: 'READ',
              label: 'Verify current hash',
              description: 'Checks the immutable event projection.',
              ready: true,
              disabledReason: 'Refresh the stale evidence snapshot.',
              onAction: onRead,
            },
          ],
        }}
      />
    );

    const action = getByRole<HTMLButtonElement>(harness.node, 'button', {
      name: 'Verify current hash',
    });
    expect(action.disabled).toBe(true);
    expect(harness.node.textContent).toContain('Refresh the stale evidence snapshot.');
    await act(async () => fireEvent.click(action));
    expect(onRead).not.toHaveBeenCalled();
  });
});

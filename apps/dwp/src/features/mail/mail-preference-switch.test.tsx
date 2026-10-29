// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { PreferenceSwitch } from './mail-preferences-workspace';

let root: Root;
let host: HTMLDivElement;

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});

afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
});

describe('PreferenceSwitch accessibility', () => {
  it('binds the visible name, description, and policy lock to the native input', async () => {
    await act(async () =>
      root.render(
        <PreferenceSwitch
          label="New mail notifications"
          description="Notify me when a message arrives."
          checked={false}
          locked="Managed by your organization"
          onChange={vi.fn()}
        />
      )
    );

    const input = host.querySelector('input[type="checkbox"]')!;
    const labelledBy = input.getAttribute('aria-labelledby')!;
    const describedBy = input.getAttribute('aria-describedby')!.split(' ');

    expect(document.getElementById(labelledBy)?.textContent).toBe('New mail notifications');
    expect(describedBy.map((id) => document.getElementById(id)?.textContent)).toEqual([
      'Notify me when a message arrives.',
      'Managed by your organization',
    ]);
    expect((input as HTMLInputElement).disabled).toBe(true);
  });
});

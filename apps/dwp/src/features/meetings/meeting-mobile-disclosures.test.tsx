// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const viewport = vi.hoisted(() => ({ compact: true }));
vi.mock('@mui/material/useMediaQuery', () => ({ default: () => viewport.compact }));
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

import { MeetingPreparationDisclosure } from './meeting-preparation-disclosure';
import {
  MeetingAdminPolicyDesignSections,
  MeetingAdminPolicySection,
} from './meeting-admin-policy-layout';

let mount: HTMLDivElement;
let root: Root;
beforeEach(() => {
  viewport.compact = true;
  mount = document.createElement('div');
  document.body.append(mount);
  root = createRoot(mount);
});
afterEach(async () => {
  await act(async () => root.unmount());
  mount.remove();
});

describe('compact meeting content without removing safeguards', () => {
  it('keeps the complete preparation notice behind a native mobile disclosure', async () => {
    await act(async () =>
      root.render(
        <MeetingPreparationDisclosure label="Safeguards">
          No media is captured until an explicit device action.
        </MeetingPreparationDisclosure>
      )
    );
    const details = mount.querySelector('details')!;
    expect(details.open).toBe(false);
    expect(details.textContent).toContain('No media is captured until an explicit device action.');
    await act(async () => {
      details.open = true;
      details.dispatchEvent(new Event('toggle'));
    });
    expect(details.open).toBe(true);
  });

  it('exposes a changed invitation or conflict immediately instead of concealing it', async () => {
    const render = (forceOpen: boolean) =>
      root.render(
        <MeetingPreparationDisclosure label="Invitation" forceOpen={forceOpen}>
          Review the revised invitation.
        </MeetingPreparationDisclosure>
      );
    await act(async () => render(false));
    expect(mount.querySelector('details')!.open).toBe(false);
    await act(async () => render(true));
    expect(mount.querySelector('details')!.open).toBe(true);
  });

  it('preserves the expanded desktop preparation content', async () => {
    viewport.compact = false;
    await act(async () =>
      root.render(
        <MeetingPreparationDisclosure label="Safeguards">Full notice</MeetingPreparationDisclosure>
      )
    );
    expect(mount.querySelector('details')!.open).toBe(true);
  });

  it('keeps advanced policy groups initially compact but opens changed fields', async () => {
    const render = (forceOpen: boolean) =>
      root.render(
        <MeetingAdminPolicySection
          title="Collaboration"
          number="06"
          defaultExpanded={false}
          forceOpen={forceOpen}
        >
          Existing policy controls
        </MeetingAdminPolicySection>
      );
    await act(async () => render(false));
    expect(mount.querySelector('details')!.open).toBe(false);
    expect(mount.textContent).toContain('Existing policy controls');
    await act(async () => render(true));
    expect(mount.querySelector('details')!.open).toBe(true);
  });

  it('does not invent or enable unknown AI policy values in the compact groups', async () => {
    await act(async () =>
      root.render(createElement(MeetingAdminPolicyDesignSections, { kind: 'ai' }))
    );
    expect(mount.querySelector('details')!.open).toBe(true);
    expect(mount.querySelectorAll('[data-testid^="meeting-policy-unavailable-"]')).toHaveLength(3);
    expect(mount.querySelectorAll('button,input,select')).toHaveLength(0);
    expect(mount.textContent).toContain('admin.design.policyControls.masking.description');
    expect(mount.textContent).toContain('admin.intelligence.unavailable');
  });
});

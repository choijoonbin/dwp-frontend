// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock('@mui/material/useMediaQuery', () => ({ default: () => true }));

import { MeetingRecapOutcome } from './meeting-recap-outcome';
import { derivePublishedMeetingRecap } from './meeting-recap-intelligence-model';

let root: Root;
let mount: HTMLDivElement;
const scroll = vi.fn();

beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  Element.prototype.scrollIntoView = scroll;
  scroll.mockReset();
  mount = document.createElement('div');
  document.body.append(mount);
  root = createRoot(mount);
});
afterEach(async () => {
  await act(async () => root.unmount());
  mount.remove();
});

function renderOutcome(focusFollowUps: boolean) {
  root.render(
    <MemoryRouter>
      <MeetingRecapOutcome
        meetingId="81000000-0000-4000-8000-000000000301"
        recap={derivePublishedMeetingRecap(null, false)}
        agenda="Current meeting agenda"
        evidence={<div>Authorized evidence controls</div>}
        focusFollowUps={focusFollowUps}
      />
    </MemoryRouter>
  );
}

describe('approved recap follow-up tab region', () => {
  it('does not scroll or steal focus while the overview is selected', async () => {
    await act(async () => renderOutcome(false));
    expect(scroll).not.toHaveBeenCalled();
    expect(document.activeElement).not.toBe(mount.querySelector('#meeting-recap-follow-ups'));
  });

  it('focuses and scrolls the existing authorized region only on explicit follow-up selection', async () => {
    await act(async () => renderOutcome(false));
    await act(async () => renderOutcome(true));
    const region = mount.querySelector('#meeting-recap-follow-ups');
    expect(document.activeElement).toBe(region);
    expect(region?.getAttribute('aria-labelledby')).toBe('meeting-recap-follow-ups-title');
    expect(scroll).toHaveBeenCalledWith({ block: 'start', behavior: 'auto' });
    expect(scroll).toHaveBeenCalledTimes(1);
    await act(async () => renderOutcome(true));
    expect(scroll).toHaveBeenCalledTimes(1);
  });

  it('keeps the empty authorized state and never fabricates a candidate for the new tab', async () => {
    await act(async () => renderOutcome(true));
    const region = mount.querySelector('#meeting-recap-follow-ups');
    expect(region?.textContent).toContain('history.recap.actionsEmpty');
    expect(region?.textContent).not.toContain('followUps.candidates.reviewCandidate');
    expect(mount.querySelector('[role="dialog"]')).toBeNull();
  });
});

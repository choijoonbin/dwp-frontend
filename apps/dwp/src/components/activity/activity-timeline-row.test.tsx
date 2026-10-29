// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ThemeProvider } from '@mui/material/styles';
import { buildDwpTheme, foundationTokens } from '@dwp-frontend/design-system';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

import { ActivityTimelineRow } from './activity-timeline-row';

import type { ActivityTimelineRowData } from './activity-timeline-row';

const event: ActivityTimelineRowData = {
  id: '21000000-0000-4000-8000-000000000001',
  occurredAt: '2026-10-28T02:00:00Z',
  time: '11:00 AM',
  date: 'Oct 28, 2026',
  actor: 'agent',
  actorName: 'DWAI·ON work agent',
  state: 'running',
  title: 'Evidence retrieval in progress',
  summary: 'Connected to the owning workflow',
  objectType: 'AGENT_RUN',
  objectLabel: 'Governed answer execution',
  source: 'DWAI_ON',
  auditId: null,
  eventKind: 'CHANGE',
  workStatus: 'IN_PROGRESS',
  progress: 42,
  dataProvenance: 'SAMPLE',
};

let root: Root;
let host: HTMLDivElement;

describe('Activity timeline row', () => {
  beforeEach(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    host = document.createElement('div');
    document.body.append(host);
    root = createRoot(host);
  });

  afterEach(() => {
    act(() => root.unmount());
    host.remove();
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: false });
  });

  it('preserves event evidence and selects the exact event', () => {
    const onSelect = vi.fn();
    const theme = buildDwpTheme({
      mode: 'light',
      highContrast: false,
      density: 'standard',
      reduceMotion: true,
      accentColor: foundationTokens.color.product.primary,
      fontFamily: foundationTokens.font.ui,
    });

    act(() => {
      root.render(
        <ThemeProvider theme={theme}>
          <ol>
            <ActivityTimelineRow event={event} active onSelect={onSelect} />
          </ol>
        </ThemeProvider>
      );
    });

    const trigger = host.querySelector<HTMLButtonElement>('button');
    expect(trigger?.getAttribute('aria-pressed')).toBe('true');
    expect(trigger?.textContent).toContain(event.title);
    expect(trigger?.textContent).toContain(event.summary);
    expect(trigger?.textContent).toContain('activityFoundation.sample.title');
    expect(trigger?.textContent).toContain('42%');
    expect(trigger?.textContent).toContain('activityPage.states.running');
    const progress = host.querySelector('[role="progressbar"]');
    expect(progress?.getAttribute('aria-label')).toBe('activityPage.progressLabel');
    expect(progress?.getAttribute('aria-valuenow')).toBe('42');

    act(() => trigger?.click());
    expect(onSelect).toHaveBeenCalledWith(event.id);
  });
});

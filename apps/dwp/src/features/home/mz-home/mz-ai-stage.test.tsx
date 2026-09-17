// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { createInstance } from 'i18next';
import { I18nextProvider } from 'react-i18next';
import { fireEvent } from '@testing-library/dom';
import { ThemeProvider } from '@mui/material/styles';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { buildDwpTheme } from '@dwp-frontend/design-system';
import { foundationTokens } from '@dwp-frontend/design-system/foundation/tokens';
import home from '@dwp-frontend/shared-i18n/locales/en/home.json';

import { MzAiStage } from './mz-ai-stage';

const theme = buildDwpTheme({
  mode: 'light',
  density: 'standard',
  highContrast: false,
  reduceMotion: true,
  accentColor: foundationTokens.color.product.primary,
  fontFamily: foundationTokens.font.ui,
});

let root: Root;
let container: HTMLDivElement;

async function renderStage(onStart = vi.fn(), withEvidence = true, contextLoading = false) {
  const i18n = createInstance();
  await i18n.init({
    lng: 'en',
    ns: ['home'],
    defaultNS: 'home',
    resources: { en: { home } },
    interpolation: { escapeValue: false },
    react: { useSuspense: false },
  });
  await act(async () => {
    root.render(
      <I18nextProvider i18n={i18n}>
        <ThemeProvider theme={theme}>
          <MzAiStage
            currentDate="September 17, 2026"
            headline="Today at DWP"
            subheadline="Review the evidence before handing work to DWAI·ON."
            actionCount={2}
            timelineCount={1}
            responseCount={1}
            appCount={18}
            contextLoading={contextLoading}
            contextFetching={false}
            contextPartial={false}
            busy={false}
            aiAvailable
            starterEvidence={
              withEvidence
                ? [
                    {
                      id: 'action-1',
                      title: 'Review launch approval',
                      source: 'Approvals',
                      bucket: 'action',
                      appKey: 'APP.APPROVALS',
                    },
                    {
                      id: 'timeline-1',
                      title: 'Prepare the 10:30 meeting',
                      source: 'Calendar',
                      bucket: 'timeline',
                      appKey: 'APP.CALENDAR',
                    },
                    {
                      id: 'pulse-1',
                      title: 'Read the team change',
                      source: 'Space',
                      bucket: 'pulse',
                      appKey: 'APP.SPACE',
                    },
                  ]
                : []
            }
            relatedApps={[
              {
                id: 'approvals',
                name: 'Approvals',
                shortName: 'Approvals',
                description: 'Review governed approvals',
                groupId: 'work',
                resourceKey: 'APP.APPROVALS',
                route: '/approvals',
                iconKey: 'approvals',
                tone: '#315FD5',
              },
              {
                id: 'calendar',
                name: 'Calendar',
                shortName: 'Calendar',
                description: 'Review meetings',
                groupId: 'connect',
                resourceKey: 'APP.CALENDAR',
                route: '/calendar',
                iconKey: 'calendar',
                tone: '#087E8B',
              },
            ]}
            onStart={onStart}
          />
        </ThemeProvider>
      </I18nextProvider>
    );
  });
  return onStart;
}

describe('MzAiStage', () => {
  beforeEach(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    vi.clearAllMocks();
  });

  it('changes the grounded evidence and related app projection when the user changes scene', async () => {
    await renderStage();

    expect(container.querySelector('[data-mz-grounded-starter="action-1"]')).not.toBeNull();
    expect(container.textContent).toContain('Approvals');
    expect(container.textContent).not.toContain('Prepare the 10:30 meeting');

    await act(async () => {
      fireEvent.click(container.querySelector('[data-mz-context-scene="meeting"]')!);
    });

    expect(container.querySelector('[data-mz-grounded-starter="timeline-1"]')).not.toBeNull();
    expect(container.querySelector('[data-mz-grounded-starter="action-1"]')).toBeNull();
    expect(container.textContent).toContain('Calendar');
    expect(container.textContent).not.toContain('Review launch approval');
  });

  it('keeps execution in DWAI·ON after a grounded scene selection', async () => {
    const onStart = await renderStage();

    await act(async () => {
      fireEvent.click(container.querySelector('[data-mz-context-scene="team"]')!);
    });
    const starter = container.querySelector<HTMLElement>('[data-mz-grounded-starter="pulse-1"]');
    expect(starter).not.toBeNull();
    await act(async () => fireEvent.click(starter!));
    await act(async () => {
      fireEvent.submit(container.querySelector('form')!);
    });

    expect(onStart).toHaveBeenCalledWith(expect.stringContaining('Read the team change'));
    expect(
      container
        .querySelector('[data-mz-execution-boundary]')
        ?.getAttribute('data-mz-execution-boundary')
    ).toBe('dwaion-review-required');
  });

  it('labels generic starters as suggestions when no runtime evidence is available', async () => {
    await renderStage(vi.fn(), false);

    const starter = container.querySelector<HTMLElement>('[data-mz-grounded-starter="brief"]');
    expect(starter).not.toBeNull();
    expect(starter?.getAttribute('title')).toBe(home.mz.stage.suggestedSource);
    expect(container.textContent).toContain(home.mz.stage.suggestedTitle);
    expect(container.querySelector('[data-mz-stage-related-apps]')).toBeNull();
  });

  it('does not expose zero counts or generic starters while provider truth is still loading', async () => {
    await renderStage(vi.fn(), false, true);

    const stage = container.querySelector('[data-testid="mz-ai-stage"]');
    expect(stage?.getAttribute('data-mz-context-state')).toBe('loading');
    expect(stage?.getAttribute('aria-busy')).toBe('true');
    expect(container.querySelector('[data-mz-grounded-starter]')).toBeNull();
    expect(container.textContent).toContain(home.mz.stage.loadingEvidence);
    expect(container.textContent).not.toContain(home.mz.stage.suggestedTitle);
    expect(container.querySelectorAll('aside .MuiTypography-h6')).toHaveLength(4);
    expect(
      [...container.querySelectorAll('aside .MuiTypography-h6')].every(
        (value) => value.textContent === '—'
      )
    ).toBe(true);
  });
});

// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { createInstance } from 'i18next';
import { I18nextProvider } from 'react-i18next';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from '@mui/material/styles';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { buildDwpTheme } from '@dwp-frontend/design-system';
import { foundationTokens } from '@dwp-frontend/design-system/foundation/tokens';
import homeStudioKo from '@dwp-frontend/shared-i18n/locales/ko/homeStudio.json';

import { staticHomeWidgetRuntimeDecisions } from '../home/runtime/widget-registry-runtime';
import { HomePersonalizationStudio } from './home-personalization-studio';

import type { HomePersonalizationStudioProps } from './home-personalization-studio-contracts';

const theme = buildDwpTheme({
  mode: 'light',
  density: 'compact',
  highContrast: false,
  reduceMotion: true,
  accentColor: foundationTokens.color.product.primary,
  fontFamily: foundationTokens.font.ui,
});

const baseProps: HomePersonalizationStudioProps = {
  open: true,
  composerEnabled: false,
  modeKey: 'CLASSIC',
  modeScopedViews: false,
  preferenceStore: 'LEGACY',
  fourDeviceLayoutsSupported: false,
  seedLayout: null,
  overviewLoading: false,
  overviewFetching: false,
  overviewFailed: false,
  widgetRuntimeDecisions: staticHomeWidgetRuntimeDecisions(),
  feedbackBusy: false,
  onRetryOverview: () => undefined,
  onClose: () => undefined,
  onEditView: () => undefined,
  modePreset: {
    currentMode: 'CLASSIC',
    initialSelectedMode: 'FLOW_V1',
    allowedModes: ['CLASSIC', 'FLOW_V1', 'MZ_V1'],
    defaultMode: 'CLASSIC',
    sharedAppOrder: [],
  },
};

let container: HTMLDivElement;
let root: Root;

async function renderStudio(
  presentation: NonNullable<HomePersonalizationStudioProps['presentation']>,
  initialSection: NonNullable<HomePersonalizationStudioProps['initialSection']>
) {
  const i18n = createInstance();
  await i18n.init({
    lng: 'ko',
    ns: ['homeStudio'],
    defaultNS: 'homeStudio',
    resources: { ko: { homeStudio: homeStudioKo } },
    interpolation: { escapeValue: false },
    react: { useSuspense: false },
  });
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  await act(async () => {
    root.render(
      <QueryClientProvider client={queryClient}>
        <I18nextProvider i18n={i18n}>
          <ThemeProvider theme={theme}>
            <HomePersonalizationStudio
              {...baseProps}
              presentation={presentation}
              initialSection={initialSection}
            />
          </ThemeProvider>
        </I18nextProvider>
      </QueryClientProvider>
    );
  });

  return document.querySelector<HTMLElement>('[role="tabpanel"]');
}

describe('HomePersonalizationStudio scroll ownership', () => {
  beforeEach(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: () => ({
        matches: false,
        media: '',
        onchange: null,
        addListener: () => undefined,
        removeListener: () => undefined,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
        dispatchEvent: () => false,
      }),
    });
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    document.body.replaceChildren();
  });

  it('delegates non-layout page scrolling to the document', async () => {
    const panel = await renderStudio('page', 'mode');

    expect(panel).not.toBeNull();
    expect(panel?.dataset.homeEditorScrollScope).toBe('document');
    expect(getComputedStyle(panel!).overflowY).toBe('visible');
    expect(getComputedStyle(panel!).overscrollBehaviorY).toBe('auto');
  });

  it('preserves owned scrolling for dialog panels and clipping for the page layout workbench', async () => {
    let panel = await renderStudio('dialog', 'mode');

    expect(panel).not.toBeNull();
    expect(panel?.dataset.homeEditorScrollScope).toBe('active-panel');
    expect(getComputedStyle(panel!).overflowY).toBe('auto');
    expect(getComputedStyle(panel!).overscrollBehaviorY).toBe('contain');

    await act(async () => root.unmount());
    root = createRoot(container);
    panel = await renderStudio('page', 'layout');

    expect(panel).not.toBeNull();
    expect(panel?.dataset.homeEditorScrollScope).toBe('active-panel');
    expect(getComputedStyle(panel!).overflowY).toBe('hidden');
    expect(getComputedStyle(panel!).overscrollBehaviorY).toBe('contain');
  });
});

// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { createInstance } from 'i18next';
import { I18nextProvider } from 'react-i18next';
import { ThemeProvider } from '@mui/material/styles';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { buildDwpTheme } from '@dwp-frontend/design-system';
import { foundationTokens } from '@dwp-frontend/design-system/foundation/tokens';
import home from '@dwp-frontend/shared-i18n/locales/en/home.json';

import { MzRelevantContext } from './mz-relevant-context';

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

async function renderContext(state: 'loading' | 'refreshing' | 'failed') {
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
          <MzRelevantContext
            loading={state === 'loading'}
            fetching={state === 'refreshing'}
            failed={state === 'failed'}
            onOpenRoute={vi.fn()}
          />
        </ThemeProvider>
      </I18nextProvider>
    );
  });
}

describe('MzRelevantContext', () => {
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

  it.each([
    ['loading', 'loading', home.mz.relatedNews.loading, 'true'],
    ['refreshing', 'refreshing', home.mz.relatedNews.refreshing, 'true'],
    ['failed', 'error', home.mz.relatedNews.error, 'false'],
  ] as const)('keeps %s distinct from a true empty feed', async (input, state, copy, busy) => {
    await renderContext(input);

    const surface = container.querySelector('[data-mz-relevant-context]');
    expect(surface?.getAttribute('data-mz-relevant-context-state')).toBe(state);
    expect(surface?.getAttribute('aria-busy')).toBe(busy);
    expect(container.textContent).toContain(copy);
    expect(container.textContent).not.toContain(home.mz.relatedNews.empty);
  });
});

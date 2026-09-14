import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';
import { ThemeProvider, getContrastRatio } from '@mui/material/styles';
import { useToastStore } from '@dwp-frontend/shared-utils/toast/toast-store';

import { buildDwpTheme } from '../../theme/build-theme';
import { ToastViewport } from './toast-viewport';

afterEach(() => useToastStore.getState().hide());
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe('ToastViewport contrast', () => {
  for (const mode of ['light', 'dark'] as const) {
    for (const highContrast of [false, true]) {
      it.each(['success', 'warning', 'error'] as const)(
        `${mode}/${highContrast} %s keeps readable text and its severity background`,
        async (severity) => {
          const theme = buildDwpTheme({
            mode,
            highContrast,
            density: 'comfortable',
            reduceMotion: true,
            accentColor: '#2153EB',
            fontFamily: 'sans-serif',
          });
          useToastStore.getState().show('Approval command complete', severity);
          const background = theme.palette[severity].dark;
          const { black, white } = theme.palette.common;
          const foreground =
            getContrastRatio(background, black) > getContrastRatio(background, white)
              ? black
              : white;
          const container = document.createElement('div');
          document.body.appendChild(container);
          const root = createRoot(container);
          try {
            await act(async () =>
              root.render(
                <ThemeProvider theme={theme}>
                  <ToastViewport />
                </ThemeProvider>
              )
            );
            const alert = container.querySelector<HTMLElement>('.MuiAlert-root');
            expect(alert).not.toBeNull();
            const style = getComputedStyle(alert!);
            const colorProbe = document.createElement('span');
            colorProbe.style.color = foreground;
            expect(style.backgroundColor).toBe(background);
            expect(style.color).toBe(colorProbe.style.color);
            expect(getContrastRatio(style.backgroundColor, style.color)).toBeGreaterThanOrEqual(
              4.5
            );
            expect(alert?.textContent).toContain('Approval command complete');
          } finally {
            await act(async () => root.unmount());
            container.remove();
          }
        }
      );
    }
  }
  it('preserves an actionable error link and dismissal', async () => {
    useToastStore.getState().show('Delivery requires review', 'error', {
      label: 'Review delivery',
      href: '/approvals/admin/operations',
    });
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    try {
      await act(async () => root.render(<ToastViewport />));
      expect(container.querySelector('a')?.textContent).toBe('Review delivery');
      expect(container.querySelector('a')?.getAttribute('href')).toBe(
        '/approvals/admin/operations'
      );
      const action = container.querySelector<HTMLAnchorElement>('a');
      action?.addEventListener('click', (event) => event.preventDefault());
      await act(async () => action?.click());
      expect(useToastStore.getState().open).toBe(false);
    } finally {
      await act(async () => root.unmount());
      container.remove();
    }
  });
});

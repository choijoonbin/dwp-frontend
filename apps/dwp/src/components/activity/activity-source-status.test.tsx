import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { ThemeProvider, getContrastRatio } from '@mui/material/styles';
import { buildDwpTheme, foundationTokens } from '@dwp-frontend/design-system';
import { ActivitySourceStatus } from './activity-source-status';

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));

describe('activity source status', () => {
  it('does not invent source coverage while data is unavailable', () => {
    expect(renderToStaticMarkup(<ActivitySourceStatus />)).toBe('');
  });

  it('distinguishes a permission boundary from a retrieved source', () => {
    const html = renderToStaticMarkup(
      <ActivitySourceStatus
        sources={[
          { sourceScope: 'WORKSPACE', status: 'AVAILABLE', generatedAt: '2026-09-04T09:00:00Z' },
          { sourceScope: 'DWAI_ON', status: 'FORBIDDEN' },
        ]}
      />
    );
    expect(html).toContain('DWP Workspace');
    expect(html).toContain('activityFoundation.sources.AVAILABLE');
    expect(html).toContain('activityFoundation.sources.FORBIDDEN');
    expect(html).not.toContain('activityFoundation.sources.partial');
  });

  it('announces partial history rather than implying a complete zero', () => {
    const html = renderToStaticMarkup(
      <ActivitySourceStatus
        partial
        sources={[
          { sourceScope: 'WORKSPACE', status: 'AVAILABLE' },
          { sourceScope: 'DWAI_ON', status: 'UNAVAILABLE' },
        ]}
      />
    );
    expect(html).toContain('role="status"');
    expect(html).toContain('activityFoundation.sources.partial');
    expect(html).toContain('activityFoundation.sources.UNAVAILABLE');
  });

  it.each(['light', 'dark'] as const)(
    'keeps unavailable source text legible in %s mode',
    (mode) => {
      const theme = buildDwpTheme({
        mode,
        highContrast: false,
        density: 'standard',
        reduceMotion: true,
        accentColor: foundationTokens.color.product.primary,
        fontFamily: foundationTokens.font.ui,
      });
      const color = mode === 'light' ? theme.palette.warning.dark : theme.palette.warning.light;
      const html = renderToStaticMarkup(
        <ThemeProvider theme={theme}>
          <ActivitySourceStatus sources={[{ sourceScope: 'DWAI_ON', status: 'UNAVAILABLE' }]} />
        </ThemeProvider>
      );
      expect(html).toContain(`color:${color}`);
      expect(getContrastRatio(color, theme.palette.background.default)).toBeGreaterThanOrEqual(4.5);
    }
  );
});

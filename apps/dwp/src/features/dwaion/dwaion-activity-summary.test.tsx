import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { ThemeProvider } from '@mui/material/styles';
import { buildDwpTheme, foundationTokens } from '@dwp-frontend/design-system';

import { DwaionActivitySummary } from './dwaion-activity-summary';

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock('@mui/material/useMediaQuery', () => ({
  default: (query: string) => !query.includes('max-height'),
}));

describe('DWAI compact run summary', () => {
  it.each(['light', 'dark'] as const)('preserves four named metric actions in %s mode', (mode) => {
    const theme = buildDwpTheme({
      mode,
      highContrast: false,
      density: 'standard',
      reduceMotion: true,
      accentColor: foundationTokens.color.product.primary,
      fontFamily: foundationTokens.font.ui,
    });
    const html = renderToStaticMarkup(
      <ThemeProvider theme={theme}>
        <DwaionActivitySummary
          metrics={{ total: 14, running: 2, completed: 10, attention: 2, sample: 4 }}
          filter="ATTENTION"
          onFilter={() => {}}
        />
      </ThemeProvider>
    );
    expect(html.match(/aria-pressed=/g)).toHaveLength(4);
    expect(html.match(/aria-pressed="true"/g)).toHaveLength(1);
    for (const [key, value] of [
      ['total', 14],
      ['running', 2],
      ['completed', 10],
      ['attention', 2],
    ]) {
      expect(html).toContain(`dwaionActivity.metrics.${key}: ${value}`);
      expect(html).toContain(`dwaionActivity.mobileMetrics.${key}`);
      expect(html).toContain(`dwaionActivity.metrics.${key}Detail`);
    }
    expect(html).toContain('dwaionActivity.mobileWindowNotice');
    expect(html).toContain('data-testid="dwaion-sample-summary"');
    expect(html).toContain('dwaionActivity.observability.sample.summaryExcluded');
    expect(html).toContain(`color:${theme.palette.success[mode === 'dark' ? 'light' : 'dark']}`);
    expect(html).toContain(`color:${theme.palette.warning[mode === 'dark' ? 'light' : 'dark']}`);
    expect(html).not.toContain('attempt');
    expect(html).not.toContain('lease');
  });
});

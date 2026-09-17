import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { ThemeProvider } from '@mui/material/styles';

import { buildDwpTheme, foundationTokens } from '@dwp-frontend/design-system';
import type { DwaionDeletionJob } from '@dwp-frontend/shared-utils';

import { DwaionDeletionHistory } from './dwaion-deletion-history';

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));

describe('DWAI.ON personal data deletion history', () => {
  it('renders a contract-valid job when optional evidence arrays are omitted', () => {
    const job: DwaionDeletionJob = {
      attemptCount: 0,
      deletionExecutionAvailable: false,
      deletionJobId: '00000000-0000-4000-8000-000000000251',
      deletionPerformed: false,
      domains: ['MEMORY'],
      requestedAt: '2026-09-17T00:00:00Z',
      state: 'REQUESTED',
    };
    const theme = buildDwpTheme({
      mode: 'light',
      highContrast: false,
      density: 'standard',
      reduceMotion: true,
      accentColor: foundationTokens.color.product.primary,
      fontFamily: foundationTokens.font.ui,
    });

    const html = renderToStaticMarkup(
      <ThemeProvider theme={theme}>
        <DwaionDeletionHistory
          jobs={[job]}
          capabilities={null}
          loading={false}
          error={null}
          canManage
          locale="en"
          onRefresh={() => {}}
          onRetry={() => {}}
          formatTimestamp={(value) => value}
        />
      </ThemeProvider>
    );

    expect(html).toContain('data-testid="dwaion-deletion-history"');
    expect(html).toContain(job.deletionJobId);
    expect(html).not.toContain('data-testid="dwaion-deletion-receipt"');
  });
});

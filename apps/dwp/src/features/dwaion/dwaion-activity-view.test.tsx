import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { ThemeProvider } from '@mui/material/styles';
import { buildDwpTheme, foundationTokens } from '@dwp-frontend/design-system';

import { ActivityListBody } from './dwaion-activity-view';

import type { DwaionUserRun } from '@dwp-frontend/shared-utils';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

const expiredRun: DwaionUserRun = {
  runId: '10000000-0000-4000-8000-000000000001',
  agentKey: 'DWP_ASSISTANT',
  agentRevision: 1,
  runState: 'RUNNING',
  answerState: null,
  riskTier: 'L1',
  policyOutcome: 'HANDOFF',
  statusCode: null,
  sourceCount: 2,
  latencyMs: 120,
  conversationId: null,
  createdAt: '2026-09-09T00:00:00Z',
  completedAt: null,
  lease: { status: 'EXPIRED', expiresAt: '2026-09-09T00:01:00Z' },
};

function renderRun(run: DwaionUserRun) {
  const theme = buildDwpTheme({
    mode: 'light',
    highContrast: false,
    density: 'standard',
    reduceMotion: true,
    accentColor: foundationTokens.color.product.primary,
    fontFamily: foundationTokens.font.ui,
  });
  return renderToStaticMarkup(
    <ThemeProvider theme={theme}>
      <ActivityListBody
        runs={{ data: [run], isPending: false, isError: false, isFetching: false }}
        visibleRuns={[run]}
        selectedRunId=""
        filter="ATTENTION"
        locale="en"
        onSelect={() => {}}
        onResetFilter={() => {}}
        onStart={() => {}}
        accessDenied={false}
      />
    </ThemeProvider>
  );
}

describe('DWAI activity attention row', () => {
  it('identifies an expired lease while a run is still reported as running', () => {
    const html = renderRun(expiredRun);

    expect(html).toContain('dwaionActivity.attentionSignals.leaseExpired');
    expect(html).toContain('dwaionActivity.attentionSignals.leaseExpiredDescription');
  });

  it('does not label an active running lease as expired', () => {
    const html = renderRun({
      ...expiredRun,
      lease: { status: 'ACTIVE', expiresAt: '2026-09-09T00:02:00Z' },
    });

    expect(html).not.toContain('dwaionActivity.attentionSignals.leaseExpired');
    expect(html).toContain('dwaionActivity.states.RUNNING');
  });
});

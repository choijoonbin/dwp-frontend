import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { ThemeProvider } from '@mui/material/styles';
import { buildDwpTheme, foundationTokens } from '@dwp-frontend/design-system';
import type { DwaionUserRun } from '@dwp-frontend/shared-utils';
import { DwaionActivityLatency } from './dwaion-activity-latency';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    i18n: { language: 'en' },
    t: (_key: string, values: { count: number }) => `${values.count} ms`,
  }),
}));

const run: DwaionUserRun = {
  runId: '10000000-0000-4000-8000-000000000001',
  agentKey: 'DWP_ASSISTANT',
  agentRevision: 1,
  runState: 'COMPLETED',
  answerState: 'COMPLETED',
  riskTier: 'L1',
  policyOutcome: 'ALLOW',
  statusCode: null,
  sourceCount: 2,
  latencyMs: 120,
  conversationId: null,
  createdAt: '2026-09-09T00:00:00Z',
  completedAt: '2026-09-09T00:00:01Z',
  dataProvenance: 'LIVE',
  measurementStatus: 'MEASURED',
};
function render(runs: DwaionUserRun[]) {
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
      <DwaionActivityLatency runs={runs} selectedRunId={run.runId} onSelect={() => {}} />
    </ThemeProvider>
  );
}

describe('operational run latency evidence', () => {
  it.each([
    { dataProvenance: 'SAMPLE' },
    { dataProvenance: undefined },
    { measurementStatus: 'PARTIAL' },
    { measurementStatus: undefined },
    { runState: 'RUNNING' },
    { completedAt: null },
    { latencyMs: -1 },
  ] as const)('does not chart unverified or incomplete values %j', (override) => {
    const html = render([{ ...run, ...override }]);
    expect(html).toContain('Measurements unavailable');
    expect(html).not.toContain('aria-pressed=');
  });
  it('exposes verified measurements as named actions and preserves the selected run', () => {
    const html = render([run, { ...run, runId: 'sample', dataProvenance: 'SAMPLE' }]);
    expect(html.match(/aria-pressed=/g)).toHaveLength(1);
    expect(html).toContain('aria-pressed="true"');
    expect(html).toContain('DWP_ASSISTANT · 120 ms');
    expect(html).not.toContain('Measurements unavailable');
  });
});

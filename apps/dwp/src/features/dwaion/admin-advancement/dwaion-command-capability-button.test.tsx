import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { DwaionCommandCapabilityButton } from './dwaion-command-capability-button';

const QUERY_KEY = ['dwaion', 'admin', 'control-plane', 'command-capabilities'];

describe('DwaionCommandCapabilityButton', () => {
  it('allows an available internal command even when its page snapshot is partial', () => {
    const html = renderButton({
      kind: 'MODEL_ROUTE_SIMULATE',
      family: 'A01',
      executionMode: 'INTERNAL',
      status: 'AVAILABLE',
      configured: true,
      reason: null,
      recoveryHint: null,
    });

    expect(html).toContain('Simulate route');
    expect(html).not.toContain('disabled=""');
  });

  it('blocks an unconfigured provider command and exposes its recovery guidance', () => {
    const html = renderButton({
      kind: 'CONNECTOR_SYNC',
      family: 'A03',
      executionMode: 'EXTERNAL_ADAPTER',
      status: 'NOT_CONFIGURED',
      configured: false,
      reason: 'The connector adapter is not configured.',
      recoveryHint: 'Configure the allowlisted connector adapter URL and token.',
    });

    expect(html).toContain('disabled=""');
    expect(html).toContain('The connector adapter is not configured.');
    expect(html).toContain('Configure the allowlisted connector adapter URL and token.');
  });

  it('keeps a typed routing action disabled until its governed provider is configured', () => {
    const html = renderButton({
      kind: 'MODEL_CANARY_START',
      family: 'A01',
      executionMode: 'EXTERNAL_ADAPTER',
      status: 'NOT_CONFIGURED',
      configured: false,
      reason: 'The model-routing adapter is not configured.',
      recoveryHint: 'Configure the allowlisted model-routing adapter URL and token.',
    });

    expect(html).toContain('disabled=""');
    expect(html).toContain('The model-routing adapter is not configured.');
    expect(html).toContain('Configure the allowlisted model-routing adapter URL and token.');
  });
});

function renderButton(command: {
  kind: 'MODEL_ROUTE_SIMULATE' | 'MODEL_CANARY_START' | 'CONNECTOR_SYNC';
  family: 'A01' | 'A03';
  executionMode: 'INTERNAL' | 'EXTERNAL_ADAPTER';
  status: 'AVAILABLE' | 'NOT_CONFIGURED';
  configured: boolean;
  reason: string | null;
  recoveryHint: string | null;
}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  client.setQueryData(QUERY_KEY, {
    generatedAt: '2026-09-17T00:00:00Z',
    workerAvailable: true,
    commands: [command],
  });
  return renderToStaticMarkup(
    <QueryClientProvider client={client}>
      <DwaionCommandCapabilityButton commandKind={command.kind}>
        {command.kind === 'MODEL_ROUTE_SIMULATE'
          ? 'Simulate route'
          : command.kind === 'MODEL_CANARY_START'
            ? 'Start canary'
            : 'Sync connector'}
      </DwaionCommandCapabilityButton>
    </QueryClientProvider>
  );
}

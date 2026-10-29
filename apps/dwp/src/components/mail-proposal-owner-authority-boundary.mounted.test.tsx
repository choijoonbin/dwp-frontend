// @vitest-environment jsdom
import { act, useLayoutEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mailGovernedRequestConfig } from '@dwp-frontend/shared-utils';

import { ProductSurfaceCanaryProvider } from './product-surface-canary-runtime';
import {
  mailProposalOwnerRequestAuthority,
  MailProposalOwnerAuthorityBoundary,
} from './mail-proposal-owner-authority-boundary';

import type { Root } from 'react-dom/client';
import type { AllowedSurfaceDecision } from '../features/shell/product-surface-context';

let root: Root;
let host: HTMLDivElement;

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});

afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
});

function Probe({ onConfig }: { onConfig: (value: unknown) => void }) {
  useLayoutEffect(() => onConfig(mailGovernedRequestConfig()), [onConfig]);
  return null;
}

describe('Mail proposal owner authority boundary', () => {
  it('registers explicit legacy authority before an owner child reads a receipt', async () => {
    let config: unknown = 'not-called';
    await act(async () =>
      root.render(
        <MemoryRouter
          initialEntries={[
            '/hr/absence?proposalId=60000000-0000-4000-8000-000000000001&commandId=60000000-0000-4000-8000-000000000002&returnTo=%2Fmail%2Factions&focus=mail-proposal-60000000-0000-4000-8000-000000000001',
          ]}
        >
          <ProductSurfaceCanaryProvider
            authority={{
              flags: {
                contextShadow: false,
                capabilityEnforcement: false,
                surfaceUi: false,
                surfaceUiEvaluation: 'resolved',
              },
            }}
          >
            <MailProposalOwnerAuthorityBoundary>
              <Probe onConfig={(value) => (config = value)} />
            </MailProposalOwnerAuthorityBoundary>
          </ProductSurfaceCanaryProvider>
        </MemoryRouter>
      )
    );

    expect(config).toBeUndefined();
  });

  it('builds secure authority only from explicit Mail surface evidence', () => {
    const decision = {
      scope: { key: 'mail-scope', validUntil: '2099-01-01T00:00:00.000Z' },
      decisionRevision: 'revision-9',
      revalidateAt: '2099-01-01T00:00:00.000Z',
      context: { scopes: [{ key: 'mail-scope' }, { key: 'shared-scope' }] },
    } as unknown as AllowedSurfaceDecision;

    expect(mailProposalOwnerRequestAuthority('surface-ui', decision)).toEqual({
      mode: 'SECURE',
      rolloutState: '111',
      contextScopeKey: 'mail-scope',
      expectedDecisionRevision: 'revision-9',
      revalidateAt: '2099-01-01T00:00:00.000Z',
      scopeValidUntil: '2099-01-01T00:00:00.000Z',
      eligibleContextScopeKeys: ['mail-scope', 'shared-scope'],
    });
    expect(mailProposalOwnerRequestAuthority('surface-ui', null)).toBeNull();
  });
});

// @vitest-environment jsdom
import { act, useLayoutEffect } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mailGovernedRequestConfig } from '@dwp-frontend/shared-utils';

import { ProductSurfaceCanaryProvider } from '../components/product-surface-canary-runtime';
import { AllowedProductSurfaceProvider } from '../features/shell/allowed-product-surface-context';
import { mailRolloutState, MailGovernedRoutePage } from './mail-governed-route-page';

import type { AllowedSurfaceDecision } from '../features/shell/product-surface-context';
import type { MailGovernedAuthorityError } from '@dwp-frontend/shared-utils';

let root: Root;
let host: HTMLDivElement;

function decision(scopeKey: string, revision: string): AllowedSurfaceDecision {
  return {
    state: 'allowed',
    context: { scopes: [{ key: scopeKey }] },
    scope: { key: scopeKey, validUntil: '2099-01-01T00:00:00.000Z' },
    decisionRevision: revision,
    revalidateAt: '2099-01-01T00:00:00.000Z',
  } as unknown as AllowedSurfaceDecision;
}

function Probe({
  onConfig,
}: {
  onConfig: (value: ReturnType<typeof mailGovernedRequestConfig>) => void;
}) {
  useLayoutEffect(() => {
    onConfig(mailGovernedRequestConfig());
  }, [onConfig]);
  return null;
}

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

describe('Mail governed route page wiring', () => {
  it.each([
    ['baseline', '000'],
    ['shadow', '100'],
    ['enforced-compatibility', '110'],
    ['surface-ui', '111'],
  ] as const)('maps %s rollout to governed Mail state %s', (mode, state) => {
    expect(mailRolloutState(mode)).toBe(state);
  });

  it('registers secure scope and revision before descendant layout work, then cleans up', async () => {
    let config: ReturnType<typeof mailGovernedRequestConfig>;
    await act(async () => {
      root.render(
        <ProductSurfaceCanaryProvider
          authority={{
            flags: {
              contextShadow: true,
              capabilityEnforcement: true,
              surfaceUi: true,
              surfaceUiEvaluation: 'resolved',
            },
          }}
        >
          <AllowedProductSurfaceProvider
            decision={decision('scope-a/b', 'revision-1')}
            boundaryKind="exact-route"
          >
            <MailGovernedRoutePage>
              <Probe onConfig={(value) => (config = value)} />
            </MailGovernedRoutePage>
          </AllowedProductSurfaceProvider>
        </ProductSurfaceCanaryProvider>
      );
    });

    expect(config?.contextScopeKey).toBe('scope-a/b');
    expect(config?.headers).toMatchObject({
      'X-DWP-Expected-Decision-Revision': 'revision-1',
    });

    await act(async () => {
      root.render(
        <ProductSurfaceCanaryProvider
          authority={{
            flags: {
              contextShadow: true,
              capabilityEnforcement: true,
              surfaceUi: true,
              surfaceUiEvaluation: 'resolved',
            },
          }}
        >
          <AllowedProductSurfaceProvider
            decision={decision('scope-c', 'revision-2')}
            boundaryKind="exact-route"
          >
            <MailGovernedRoutePage>
              <Probe onConfig={(value) => (config = value)} />
            </MailGovernedRoutePage>
          </AllowedProductSurfaceProvider>
        </ProductSurfaceCanaryProvider>
      );
    });

    expect(config?.contextScopeKey).toBe('scope-c');
    expect(config?.headers).toMatchObject({
      'X-DWP-Expected-Decision-Revision': 'revision-2',
    });

    await act(async () => root.unmount());
    root = createRoot(host);
    expect(() => mailGovernedRequestConfig()).toThrowError(
      expect.objectContaining({
        code: 'AUTHORITY_MISSING',
      } satisfies Partial<MailGovernedAuthorityError>)
    );
  });

  it('registers explicit legacy compatibility authority without an allowed decision', async () => {
    let config: ReturnType<typeof mailGovernedRequestConfig> = { headers: { unexpected: 'yes' } };
    await act(async () => {
      root.render(
        <ProductSurfaceCanaryProvider
          authority={{
            flags: {
              contextShadow: true,
              capabilityEnforcement: false,
              surfaceUi: false,
              surfaceUiEvaluation: 'resolved',
            },
          }}
        >
          <MailGovernedRoutePage>
            <Probe onConfig={(value) => (config = value)} />
          </MailGovernedRoutePage>
        </ProductSurfaceCanaryProvider>
      );
    });

    expect(config).toBeUndefined();
  });
});

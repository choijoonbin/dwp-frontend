// @vitest-environment jsdom
import { act, createElement, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { WorkplaceAccessPassPanel } from './workplace-access-pass';

import type { WorkplaceNavigationPoi } from '@dwp-frontend/shared-utils/api/workplace-navigation-contract';
import type {
  WorkplaceAccessPass,
  WorkplaceAccessPassCommandResult,
  WorkplaceAccessPassContext,
  WorkplaceAccessPassPreview,
  WorkplaceAccessPassPreviewInput,
} from '@dwp-frontend/shared-utils/api/workplace-access-pass-api';

const api = vi.hoisted(() => ({
  context: vi.fn(),
  audit: vi.fn(),
  command: vi.fn(),
  preview: vi.fn(),
  execute: vi.fn(),
}));

vi.mock('@dwp-frontend/shared-utils/api/workplace-access-pass-api', () => ({
  getWorkplaceAccessPassContext: api.context,
  getWorkplaceAccessPassAuditEvents: api.audit,
  getWorkplaceAccessPassCommand: api.command,
  previewWorkplaceAccessPass: api.preview,
  executeWorkplaceAccessPass: api.execute,
}));

vi.mock('@dwp-frontend/design-system', () => ({
  ActionButton: ({
    children,
    disabled,
    loading,
    onClick,
  }: {
    children: ReactNode;
    disabled?: boolean;
    loading?: boolean;
    onClick?: () => void;
  }) => createElement('button', { disabled: Boolean(disabled || loading), onClick }, children),
  InlineFeedback: ({ children, action }: { children: ReactNode; action?: ReactNode }) =>
    createElement('div', null, children, action),
}));

vi.mock('qrcode.react', () => ({
  QRCodeSVG: ({ value, ...props }: { value: string; 'aria-label': string }) =>
    createElement('svg', { ...props, 'data-value': value }),
}));

const siteId = '19000000-0000-4000-8000-000000000001';
const floorId = '19000000-0000-4000-8000-000000000002';
const destinations = {
  first: poi('19000000-0000-4000-8000-000000000003', 'First room'),
  second: poi('19000000-0000-4000-8000-000000000004', 'Second room'),
};

function poi(resourceId: string, name: string): WorkplaceNavigationPoi {
  return {
    poiId: resourceId,
    nodeId: `${resourceId}-node`,
    siteId,
    floorId,
    resourceId,
    category: 'ROOM',
    nameKo: name,
    nameEn: name,
    directionHintKo: null,
    directionHintEn: null,
  };
}

function pass(
  destination: WorkplaceNavigationPoi,
  passId: string,
  version: number
): WorkplaceAccessPass {
  return {
    passId,
    sourceBookingId: 'booking-1',
    siteId: destination.siteId,
    floorId: destination.floorId,
    resourceId: destination.resourceId!,
    destinationPoiId: destination.poiId,
    state: 'ACTIVE',
    credentialLastFour: '1234',
    pairingAvailable: true,
    nfcEnabled: true,
    qrEnabled: true,
    nfcProviderCode: 'nfc-provider',
    nfcProviderConfigurationVersion: 1,
    nfcProviderEvidenceReference: 'nfc-evidence',
    qrProviderCode: 'qr-provider',
    qrProviderConfigurationVersion: 1,
    qrProviderEvidenceReference: 'qr-evidence',
    version,
    issuedAt: new Date(Date.now() - 60_000).toISOString(),
    expiresAt: new Date(Date.now() + 15 * 60_000).toISOString(),
    revokedAt: null,
    updatedAt: new Date().toISOString(),
  };
}

function context(value: WorkplaceAccessPass): WorkplaceAccessPassContext {
  return {
    pass: value,
    providers: [],
    bookingEligible: true,
    bookingEndsAt: value.expiresAt,
    evaluatedAt: new Date().toISOString(),
  };
}

function result(value: WorkplaceAccessPass): WorkplaceAccessPassCommandResult {
  return {
    receipt: {
      commandId: `${value.passId}-command`,
      passId: value.passId,
      commandType: 'ROTATE',
      state: 'RESULT_UNKNOWN',
      reason: 'Verified rotation',
      resultCode: null,
      version: value.version,
      recoveryByGetOnly: true,
      statusHref: `/commands/${value.passId}-command`,
      correlationId: 'correlation-1',
      acceptedAt: value.updatedAt,
      completedAt: null,
      updatedAt: value.updatedAt,
    },
    pass: value,
    oneTimeCredential: `credential-${value.passId}`,
    pairingCode: 'ABCDEFGH1234',
    replayed: false,
  };
}

describe('Workplace access-pass command state', () => {
  let root: Root;
  let host: HTMLDivElement;
  let client: QueryClient;
  let activePasses: Map<string, WorkplaceAccessPass>;

  beforeEach(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    activePasses = new Map([
      [destinations.first.resourceId!, pass(destinations.first, 'pass-first', 1)],
      [destinations.second.resourceId!, pass(destinations.second, 'pass-second', 1)],
    ]);
    api.context.mockImplementation(async (_siteId: string, resourceId: string) =>
      context(activePasses.get(resourceId)!)
    );
    api.audit.mockResolvedValue([]);
    api.preview.mockImplementation(async (input: WorkplaceAccessPassPreviewInput) => ({
      ...input,
      previewId: `preview-${input.destinationPoiId}`,
      nfcEnabled: true,
      qrEnabled: true,
      eligible: true,
      impact: ['NEW_ONE_TIME_CREDENTIAL_ISSUED'],
      limitations: [],
      expiresAt: new Date(Date.now() + 5 * 60_000).toISOString(),
      createdAt: new Date().toISOString(),
    }));
    api.execute.mockImplementation(async () => {
      const current = activePasses.get(destinations.first.resourceId!)!;
      const rotated = {
        ...current,
        version: current.version + 1,
        updatedAt: new Date().toISOString(),
      };
      activePasses.set(destinations.first.resourceId!, rotated);
      return result(rotated);
    });
    api.command.mockImplementation(async () =>
      result(activePasses.get(destinations.first.resourceId!)!)
    );
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: vi.fn() },
    });
    client = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } },
    });
    host = document.createElement('div');
    document.body.append(host);
    root = createRoot(host);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    client.clear();
    host.remove();
    vi.clearAllMocks();
  });

  async function render(destination: WorkplaceNavigationPoi) {
    await act(async () => {
      root.render(
        <QueryClientProvider client={client}>
          <WorkplaceAccessPassPanel destination={destination} locale="en" canUpdate elevated />
        </QueryClientProvider>
      );
    });
    await settle();
  }

  async function settle() {
    for (let attempt = 0; attempt < 4; attempt += 1) {
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
      });
    }
  }

  function button(name: string) {
    return [...document.querySelectorAll('button')].find(
      (candidate) => candidate.textContent?.trim() === name
    );
  }

  async function click(name: string) {
    const target = button(name);
    expect(target).toBeDefined();
    await act(async () => target!.click());
    await settle();
  }

  async function revealCredential() {
    await click('Rotate security token');
    const reason = document.querySelector<HTMLTextAreaElement>('textarea');
    expect(reason).not.toBeNull();
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set;
      setter?.call(reason, 'Verified rotation');
      reason?.dispatchEvent(new Event('input', { bubbles: true }));
      document.querySelector<HTMLInputElement>('input[type="checkbox"]')?.click();
    });
    await click('Confirm and execute');
    expect(document.body.textContent).toContain('ABCD EFGH 1234');
  }

  it('handles clipboard failure and clears secrets and command UI when destination identity changes', async () => {
    await render(destinations.first);
    await revealCredential();

    const writeText = vi.mocked(navigator.clipboard.writeText);
    writeText.mockRejectedValueOnce(new Error('denied'));
    const copyButton = document.querySelector<HTMLButtonElement>(
      'button[aria-label="Copy pairing code"]'
    );
    expect(copyButton).not.toBeNull();
    await act(async () => copyButton?.click());
    await settle();
    expect(document.body.textContent).toContain(
      'The pairing code could not be copied. Select and copy it manually.'
    );
    expect(copyButton?.getAttribute('aria-label')).toBe('Copy pairing code');

    writeText.mockResolvedValueOnce(undefined);
    await act(async () => copyButton?.click());
    await settle();
    expect(document.body.textContent).toContain('Pairing code copied.');
    expect(copyButton?.getAttribute('aria-label')).toBe('Pairing code copied.');

    await click('Activate NFC presentation');
    expect(document.body.textContent).toContain('NFC presentation is ready.');
    await click('Show kiosk QR');
    expect(document.querySelector('svg[aria-label="Scan at the kiosk"]')).not.toBeNull();
    expect(button('Refresh command status')).toBeDefined();

    await render(destinations.second);

    expect(document.body.textContent).not.toContain('ABCD EFGH 1234');
    expect(document.body.textContent).not.toContain('Pairing code copied.');
    expect(document.body.textContent).not.toContain('NFC presentation is ready.');
    expect(document.querySelector('svg[aria-label="Scan at the kiosk"]')).toBeNull();
    expect(button('Refresh command status')).toBeUndefined();
    expect(button('Activate NFC presentation')).toHaveProperty('disabled', true);
  });

  it('clears an open preview and revealed state when the pass identity changes in place', async () => {
    await render(destinations.first);
    await revealCredential();
    await click('Rotate security token');
    expect(document.body.textContent).toContain('Review access-pass impact');

    const replacement = pass(destinations.first, 'pass-replacement', 1);
    activePasses.set(destinations.first.resourceId!, replacement);
    await act(async () => {
      client.setQueryData(
        [
          'workplace',
          'navigation',
          'access-pass',
          destinations.first.siteId,
          destinations.first.resourceId,
        ],
        context(replacement)
      );
    });
    await settle();

    expect(document.body.textContent).not.toContain('Review access-pass impact');
    expect(document.body.textContent).not.toContain('ABCD EFGH 1234');
    expect(button('Refresh command status')).toBeUndefined();
    expect(button('Activate NFC presentation')).toHaveProperty('disabled', true);
  });

  it('ignores a preview that completes after the pass identity was replaced', async () => {
    const pending: {
      input?: WorkplaceAccessPassPreviewInput;
      resolve?: (value: WorkplaceAccessPassPreview) => void;
    } = {};
    api.preview.mockImplementationOnce(
      (input: WorkplaceAccessPassPreviewInput) =>
        new Promise<WorkplaceAccessPassPreview>((resolve) => {
          pending.input = input;
          pending.resolve = resolve;
        })
    );
    await render(destinations.first);
    await click('Rotate security token');

    const replacement = pass(destinations.first, 'pass-replacement', 1);
    activePasses.set(destinations.first.resourceId!, replacement);
    await act(async () => {
      client.setQueryData(
        [
          'workplace',
          'navigation',
          'access-pass',
          destinations.first.siteId,
          destinations.first.resourceId,
        ],
        context(replacement)
      );
    });
    await settle();

    expect(pending.input).toBeDefined();
    await act(async () => {
      pending.resolve?.({
        ...pending.input!,
        previewId: 'stale-preview',
        nfcEnabled: true,
        qrEnabled: true,
        eligible: true,
        impact: ['NEW_ONE_TIME_CREDENTIAL_ISSUED'],
        limitations: [],
        expiresAt: new Date(Date.now() + 5 * 60_000).toISOString(),
        createdAt: new Date().toISOString(),
      });
    });
    await settle();

    expect(document.body.textContent).not.toContain('Review access-pass impact');
  });

  it('reuses one command identity when a committed response may have been lost', async () => {
    api.execute.mockRejectedValueOnce(new Error('connection lost'));
    await render(destinations.first);

    await click('Rotate security token');
    const reason = document.querySelector<HTMLTextAreaElement>('textarea');
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set;
      setter?.call(reason, 'Verified rotation');
      reason?.dispatchEvent(new Event('input', { bubbles: true }));
      document.querySelector<HTMLInputElement>('input[type="checkbox"]')?.click();
    });
    await click('Confirm and execute');

    expect(document.body.textContent).toContain('Retry in this dialog');
    expect(reason?.disabled).toBe(true);
    await click('Confirm and execute');

    expect(api.execute).toHaveBeenCalledTimes(2);
    expect(api.execute.mock.calls[1]?.[1]).toEqual(api.execute.mock.calls[0]?.[1]);
    expect(api.execute.mock.calls[1]?.[0]).toEqual(api.execute.mock.calls[0]?.[0]);
    expect(document.body.textContent).toContain('ABCD EFGH 1234');
  });
});

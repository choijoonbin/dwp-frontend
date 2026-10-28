// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { createInstance } from 'i18next';
import { I18nextProvider } from 'react-i18next';
import { fireEvent, getAllByRole, getByRole, queryByRole } from '@testing-library/dom';
import { ThemeProvider } from '@mui/material/styles';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildDwpTheme } from '@dwp-frontend/design-system';
import { foundationTokens } from '@dwp-frontend/design-system/foundation/tokens';
import en from '@dwp-frontend/shared-i18n/locales/en/approvals.json';
import ko from '@dwp-frontend/shared-i18n/locales/ko/approvals.json';
import {
  diagnosticDetails,
  diagnosticFixtureDraftId,
  diagnosticFixtureNow,
  diagnosticOverview,
  diagnosticPolicy,
} from '@dwp-frontend/shared-utils/api/approval-signature-diagnostics.test-support';
import type { useApprovalSignatureProviderDiagnostics as useController } from './use-approval-signature-provider-diagnostics';
import type { useApprovalSignatureReadProjection as useReadController } from './use-approval-signature-read-projection';
import { ApprovalSignatureAdmin } from './approval-signature-admin';

type Controller = ReturnType<typeof useController>;
type ReadController = ReturnType<typeof useReadController>;

const state = vi.hoisted(() => ({
  controller: null as unknown,
  readController: null as unknown,
  diagnosticsCalls: 0,
}));

vi.mock('./use-approval-signature-provider-diagnostics', () => ({
  useApprovalSignatureProviderDiagnostics: () => {
    state.diagnosticsCalls += 1;
    return state.controller;
  },
}));
vi.mock('./use-approval-signature-read-projection', () => ({
  useApprovalSignatureReadProjection: () => state.readController,
}));
vi.mock('./approval-admin-attachment-policy-controller', () => ({
  ApprovalAdminAttachmentPolicyController: () => null,
}));
vi.mock('./approval-signature-policy-workspace', () => ({
  ApprovalSignaturePolicyWorkspace: () => null,
}));

let root: Root;
let container: HTMLDivElement;

function query(data: unknown, isFetching = false) {
  return { data, isFetching };
}

function controller(patch: Partial<Controller> = {}): Controller {
  const openProvider = vi.fn();
  const runProbe = vi.fn(async () => undefined);
  const runKmsProbe = vi.fn(async () => undefined);
  return {
    contractAvailable: true,
    runtimeReady: true,
    installed: true,
    overview: query(diagnosticOverview()),
    overviewState: 'CURRENT',
    details: query(diagnosticDetails()),
    detailsState: 'CURRENT',
    policy: query(diagnosticPolicy()),
    policyState: 'CURRENT',
    diagnosticHistory: query(null),
    diagnosticHistoryState: 'CURRENT',
    policyHistory: query(null),
    policyHistoryState: 'CURRENT',
    selectedProviderId: null,
    historyOpen: false,
    probeFeedback: null,
    uncertainOperation: null,
    probeBusy: false,
    canProbe: true,
    canKmsProbe: true,
    openProvider,
    closeProvider: vi.fn(),
    openHistory: vi.fn(),
    closeHistory: vi.fn(),
    nextDiagnosticHistory: vi.fn(),
    nextPolicyHistory: vi.fn(),
    refresh: vi.fn(async () => undefined),
    runProbe,
    runKmsProbe,
    ...patch,
  } as unknown as Controller;
}

function readController(patch: Partial<ReadController> = {}): ReadController {
  return {
    scopeReady: true,
    sourceState: 'READY',
    source: {
      data: {
        mode: 'FULL_MANAGEMENT',
        providers: [
          {
            providerId: diagnosticFixtureDraftId,
            providerKey: 'DOCUSIGN',
            displayName: 'DocuSign',
            providerType: 'REMOTE',
            lifecycleState: 'ACTIVE',
            credentialConfigured: true,
            lastHealthCheckedAt: diagnosticFixtureNow,
            version: 2,
            capabilities: {
              internalAttestation: false,
              auditEvidence: true,
              verifiedIdentity: true,
              remoteSigningSupported: true,
              readiness: 'EXTERNAL_VERIFICATION_REQUIRED',
            },
          },
        ],
      },
      dataUpdatedAt: Date.parse(diagnosticFixtureNow),
      isFetching: false,
      refetch: vi.fn(async () => undefined),
    },
    ...patch,
  } as unknown as ReadController;
}

async function render(
  value: Controller,
  locale: 'en' | 'ko' = 'en',
  readValue: ReadController = readController()
) {
  state.controller = value;
  state.readController = readValue;
  const i18n = createInstance();
  await i18n.init({
    lng: locale,
    ns: ['approvals'],
    defaultNS: 'approvals',
    resources: { en: { approvals: en }, ko: { approvals: ko } },
    interpolation: { escapeValue: false },
    react: { useSuspense: false },
  });
  const theme = buildDwpTheme({
    mode: 'light',
    density: 'compact',
    highContrast: false,
    reduceMotion: true,
    accentColor: foundationTokens.color.product.primary,
    fontFamily: foundationTokens.font.ui,
  });
  await act(async () => {
    root.render(
      <I18nextProvider i18n={i18n}>
        <ThemeProvider theme={theme}>
          <ApprovalSignatureAdmin />
        </ThemeProvider>
      </I18nextProvider>
    );
  });
}

describe('APR16B production signature administration', () => {
  beforeEach(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    vi.useFakeTimers();
    vi.setSystemTime(new Date(diagnosticFixtureNow));
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
    state.diagnosticsCalls = 0;
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('mounts current native facts while separating SELF evidence from the external ceremony', async () => {
    await render(controller());

    expect(container.textContent).toContain(en.admin.signatureDiagnostics.directiveTitle);
    expect(container.textContent).toContain(
      en.admin.signatureDiagnostics.separation.internalDecision.title
    );
    expect(container.textContent).toContain(
      en.admin.signatureDiagnostics.separation.externalGate.title
    );
    expect(container.textContent).toContain(
      en.admin.signatureDiagnostics.separation.verifiedArchive.title
    );
    expect(getAllByRole(container, 'article')).toHaveLength(3);
    getByRole(container, 'region', { name: en.admin.signatureDiagnostics.labels.kms });
    getByRole(container, 'region', { name: en.admin.signatureDiagnostics.labels.worm });
    expect(container.textContent).toContain(en.admin.signatureDiagnostics.secretBoundary);
    expect(container.textContent).not.toContain('credentialSecret');
    expect(container.textContent).not.toContain('admin.signatureDiagnostics.');
  });

  it('renders the oversight oneOf projection as metadata without mounting management diagnostics', async () => {
    const oversight = readController({
      source: {
        data: {
          mode: 'OVERSIGHT',
          providers: [
            {
              providerId: diagnosticFixtureDraftId,
              providerKey: 'DOCUSIGN',
              displayName: 'DocuSign oversight',
              providerType: 'REMOTE',
              lifecycleState: 'ACTIVE',
              credentialConfigured: true,
              lastHealthCheckedAt: diagnosticFixtureNow,
              version: 2,
            },
          ],
        },
        dataUpdatedAt: Date.parse(diagnosticFixtureNow),
        isFetching: false,
        refetch: vi.fn(async () => undefined),
      },
    } as unknown as Partial<ReadController>);

    await render(controller(), 'en', oversight);

    expect(container.textContent).toContain('DocuSign oversight');
    expect(
      container.querySelector('[data-approval-signature-projection="OVERSIGHT"]')
    ).not.toBeNull();
    expect(state.diagnosticsCalls).toBe(0);
    expect(
      queryByRole(container, 'button', {
        name: en.admin.signatureDiagnostics.labels.runAllProbes,
      })
    ).toBeNull();
    expect(
      queryByRole(container, 'button', {
        name: en.admin.signatureDiagnostics.labels.viewConfiguration,
      })
    ).toBeNull();
  });

  it('demotes a stale full projection to metadata and keeps all commands unmounted', async () => {
    await render(controller(), 'en', readController({ sourceState: 'STALE' }));

    expect(
      container.querySelector('[data-approval-signature-projection="STALE_FULL"]')
    ).not.toBeNull();
    expect(state.diagnosticsCalls).toBe(0);
    expect(
      queryByRole(container, 'button', {
        name: en.admin.signatureDiagnostics.labels.runAllProbes,
      })
    ).toBeNull();
    expect(
      queryByRole(container, 'button', {
        name: en.admin.signatureDiagnostics.labels.viewConfiguration,
      })
    ).toBeNull();
  });

  it('dispatches provider inspection and governed probes from the current controller only', async () => {
    const value = controller();
    await render(value);

    fireEvent.click(
      getAllByRole(container, 'button', {
        name: en.admin.signatureDiagnostics.labels.viewConfiguration,
      })[1]!
    );
    expect(value.openProvider).toHaveBeenCalledWith(diagnosticFixtureDraftId);

    fireEvent.click(
      getByRole(container, 'button', {
        name: en.admin.signatureDiagnostics.labels.runAllProbes,
      })
    );
    expect(value.runProbe).toHaveBeenCalledWith(null);

    fireEvent.click(
      getAllByRole(container, 'button', {
        name: en.admin.signatureDiagnostics.labels.runProviderProbe,
      })[0]!
    );
    expect(value.runProbe).toHaveBeenCalledWith(diagnosticFixtureDraftId);

    fireEvent.click(
      getByRole(container, 'button', {
        name: en.admin.signatureDiagnostics.labels.runKmsProbe,
      })
    );
    expect(value.runKmsProbe).toHaveBeenCalledTimes(1);
  });

  it('fails closed when the official Source13 public route contract is unavailable', async () => {
    await render(controller({ contractAvailable: false, runtimeReady: false, installed: false }));

    expect(container.textContent).toContain(en.admin.signatureDiagnostics.nativeUnavailable);
    expect(
      container.querySelector('[data-approval-signature-contract="UNAVAILABLE"]')
    ).not.toBeNull();
    expect(queryByRole(container, 'article')).toBeNull();
    expect(
      queryByRole(container, 'button', {
        name: en.admin.signatureDiagnostics.labels.runAllProbes,
      })
    ).toBeNull();
  });

  it('keeps diagnostics visible but marks installation blocked until runtime evidence is ready', async () => {
    await render(controller({ runtimeReady: false, installed: false }));

    expect(
      container.querySelector('[data-approval-signature-contract="AVAILABLE"]')
    ).not.toBeNull();
    expect(
      container.querySelector('[data-approval-signature-runtime-readiness="BLOCKED"]')
    ).not.toBeNull();
    expect(container.textContent).toContain(en.admin.signatureDiagnostics.directiveTitle);
    expect(getAllByRole(container, 'article')).toHaveLength(3);
  });

  it('masks cached provider facts and disables mutations after a stale source result', async () => {
    const value = controller({ overviewState: 'STALE', canProbe: false, canKmsProbe: false });
    await render(value);

    expect(container.textContent).toContain(en.admin.signatureDiagnostics.states.STALE);
    expect(container.querySelector('[data-state="PASS"]')).toBeNull();
    expect(container.querySelector('[data-state="READY"]')).toBeNull();
    expect(
      getByRole(container, 'button', {
        name: en.admin.signatureDiagnostics.labels.runAllProbes,
      }).hasAttribute('disabled')
    ).toBe(true);
  });
});

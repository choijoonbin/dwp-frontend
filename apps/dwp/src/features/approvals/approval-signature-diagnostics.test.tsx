// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { createInstance } from 'i18next';
import { I18nextProvider } from 'react-i18next';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getAllByRole, getByRole } from '@testing-library/dom';
import { ThemeProvider } from '@mui/material/styles';
import { buildDwpTheme } from '@dwp-frontend/design-system';
import { foundationTokens } from '@dwp-frontend/design-system/foundation/tokens';
import en from '@dwp-frontend/shared-i18n/locales/en/approvals.json';
import ko from '@dwp-frontend/shared-i18n/locales/ko/approvals.json';
import {
  diagnosticCard,
  diagnosticDetails,
  diagnosticFixtureId,
  diagnosticFixtureNow,
  diagnosticFixtureSha,
  diagnosticOverview,
  diagnosticPolicy,
} from '@dwp-frontend/shared-utils/api/approval-signature-diagnostics.test-support';
import { SignatureDiagnosticsOverview } from './approval-signature-diagnostics-overview';
import { SignatureDiagnosticsInspector } from './approval-signature-diagnostics-inspector';
import { SignatureDiagnosticsPolicyInspector } from './approval-signature-diagnostics-policy-inspector';
import { SignatureDiagnosticsHistory } from './approval-signature-diagnostics-history';
import {
  signatureDiagnosticsObservation,
  signatureDiagnosticsScopeMatches,
} from './approval-signature-diagnostics-model';

let root: Root;
let container: HTMLDivElement;
const now = Date.parse(diagnosticFixtureNow);
const fetch = vi.fn();
async function render(
  view: React.ReactNode,
  locale: 'ko' | 'en' = 'ko',
  mode: 'light' | 'dark' = 'light'
) {
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
    mode,
    density: 'compact',
    highContrast: false,
    reduceMotion: true,
    accentColor: foundationTokens.color.product.primary,
    fontFamily: foundationTokens.font.ui,
  });
  await act(async () =>
    root.render(
      <I18nextProvider i18n={i18n}>
        <ThemeProvider theme={theme}>{view}</ThemeProvider>
      </I18nextProvider>
    )
  );
}
describe('APR16B actual DTO read-only presentation before Source13 installation', () => {
  beforeEach(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
    fetch.mockReset();
    vi.stubGlobal('fetch', fetch);
  });
  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
  });
  it.each(['ko', 'en'] as const)(
    'renders four native KPI sections, three native providers, and two inspection sections in %s',
    async (locale) => {
      await render(
        <SignatureDiagnosticsOverview data={diagnosticOverview()} readState="CURRENT" now={now} />,
        locale
      );
      const translations = locale === 'ko' ? ko : en;
      getByRole(container, 'region', {
        name: translations.admin.signatureDiagnostics.labels.metrics,
      });
      expect(getAllByRole(container, 'article')).toHaveLength(3);
      getByRole(container, 'region', { name: translations.admin.signatureDiagnostics.labels.kms });
      getByRole(container, 'region', { name: translations.admin.signatureDiagnostics.labels.worm });
      expect(container.textContent).not.toContain('admin.signatureDiagnostics.');
      expect(fetch).not.toHaveBeenCalled();
      expect(container.querySelector('button')).toBeNull();
    }
  );
  it('uses only the published policy requirement count, never the three cards as a denominator', async () => {
    const source = diagnosticOverview();
    const data = {
      ...source,
      policy: {
        sourceState: 'AVAILABLE' as const,
        pin: { sourceId: diagnosticFixtureId, version: 1, sha256: diagnosticFixtureSha },
        requiredProviderKinds: ['DOCUSIGN', 'ADOBE_SIGN'] as const,
        maxProbeAgeSeconds: 3600,
        probeIntervalSeconds: 300,
        retentionFloorSeconds: 3600,
      },
      kpis: {
        ...source.kpis,
        requiredProviderCount: 2,
        requiredProviderKinds: ['DOCUSIGN', 'ADOBE_SIGN'] as const,
        probeIntervalSeconds: 300,
      },
    };
    await render(<SignatureDiagnosticsOverview data={data} readState="CURRENT" now={now} />, 'en');
    expect(container.textContent).toContain('Registered 3 · published policy requirements 2');
    expect(container.textContent).not.toContain('0 / 3');
    expect(fetch).not.toHaveBeenCalled();
  });
  it('keeps registered custom providers visible even when their adapter is not installed', async () => {
    const source = diagnosticOverview();
    await render(
      <SignatureDiagnosticsOverview
        data={{
          ...source,
          kpis: { ...source.kpis, registeredProviderCount: 4 },
          providers: [
            ...source.providers,
            { ...diagnosticCard('CUSTOM'), providerId: '44444444-4444-4444-8444-444444444444' },
          ],
        }}
        readState="CURRENT"
        now={now}
      />
    );
    expect(getAllByRole(container, 'article')).toHaveLength(4);
    getByRole(container, 'article', { name: 'CUSTOM' });
    expect(fetch).not.toHaveBeenCalled();
  });
  it('does not present prior PASS observations or verification counts as current after a source failure', async () => {
    const source = diagnosticOverview();
    const kms = {
      backend: 'INTERNAL_JCA' as const,
      verificationKind: 'INTERNAL_KEY' as const,
      state: 'PASS' as const,
      algorithm: 'RS256',
      keySha256: diagnosticFixtureSha,
      source: 'INTERNAL_JCA',
      checkedAt: diagnosticFixtureNow,
      validUntil: '2026-09-14T00:01:00Z',
      evidenceId: diagnosticFixtureId,
      evidenceSha256: diagnosticFixtureSha,
      reasonCodes: [],
    };
    await render(
      <SignatureDiagnosticsOverview data={{ ...source, kms }} readState="STALE" now={now} />,
      'en',
      'dark'
    );
    expect(container.querySelector('[data-state="PASS"]')).toBeNull();
    expect(container.textContent).toContain('Current source unavailable');
    expect(container.textContent).toContain('Stale source');
  });
  it.each(['DENIED', 'UNAVAILABLE'] as const)(
    'masks source data in %s instead of showing cached provider/settings information',
    async (readState) => {
      const details = diagnosticDetails();
      await render(
        <SignatureDiagnosticsInspector
          details={{
            ...details,
            settings: { ...details.settings, configurationOwner: 'sensitive prior configuration' },
          }}
          policy={diagnosticPolicy()}
          readState={readState}
          policyReadState={readState}
          now={now}
        />
      );
      expect(container.textContent).not.toContain('sensitive prior configuration');
      expect(container.textContent).not.toContain(diagnosticFixtureSha);
      expect(fetch).not.toHaveBeenCalled();
    }
  );
  it('shows actual saved unpublished disabled draft separately, without inventing a published policy or publish control', async () => {
    await render(
      <SignatureDiagnosticsPolicyInspector
        policy={{ ...diagnosticPolicy(), published: null }}
        readState="CURRENT"
        now={now}
      />,
      'en'
    );
    expect(container.textContent).toContain('No published policy');
    expect(container.textContent).toContain('Working draft');
    expect(container.querySelector('[data-state="NOT_EVALUATED"]')).not.toBeNull();
    expect(container.querySelector('button')).toBeNull();
    expect(fetch).not.toHaveBeenCalled();
  });
  it('displays the native review digest but does not turn expired eligibility into an enabled action', async () => {
    const policy = diagnosticPolicy();
    const review = {
      draftVersionId: policy.workingDraft!.versionId,
      policyVersion: policy.version,
      draftRevision: policy.workingDraft!.revision,
      reviewContentSha256: diagnosticFixtureSha,
      eligibility: 'ELIGIBLE' as const,
      reasonCodes: [],
      stepUpRequired: true as const,
      validUntil: '2026-09-14T00:00:01Z',
    };
    await render(
      <SignatureDiagnosticsPolicyInspector
        policy={{ ...policy, publishReview: review }}
        readState="CURRENT"
        now={now + 2000}
      />,
      'en'
    );
    expect(container.querySelector('[data-state="EXPIRED"]')).not.toBeNull();
    expect(container.querySelector('[data-state="ELIGIBLE"]')).toBeNull();
    expect(container.textContent).toContain(diagnosticFixtureSha);
    expect(fetch).not.toHaveBeenCalled();
  });
  it('requires every native scope pin, without conflating opaque context and resource set', () => {
    const scope = diagnosticOverview().scope;
    expect(signatureDiagnosticsScopeMatches(scope, scope)).toBe(true);
    for (const key of [
      'resourceSetKey',
      'contextScopeKey',
      'decisionRevision',
      'registrySha256',
      'sourceRevision',
      'sourceSha256',
    ] as const)
      expect(signatureDiagnosticsScopeMatches(scope, { ...scope, [key]: 'changed' })).toBe(false);
  });
  it('reports expired observation windows without rewriting the stored native state', () => {
    const kms = { ...diagnosticOverview().kms, validUntil: '2026-09-13T23:59:59Z' };
    expect(signatureDiagnosticsObservation(kms, 'CURRENT', now)).toBe('EXPIRED');
    expect(signatureDiagnosticsObservation(kms, 'CHECKING', now)).toBe('SOURCE_UNAVAILABLE');
    expect(kms.state).toBe('NOT_OBSERVED');
  });
  it('does not label future or invalid-clock observations as verified', () => {
    const kms = {
      ...diagnosticOverview().kms,
      checkedAt: '2026-09-14T00:00:01Z',
      state: 'PASS' as const,
    };
    expect(signatureDiagnosticsObservation(kms, 'CURRENT', now)).toBe('SOURCE_UNAVAILABLE');
    expect(signatureDiagnosticsObservation(kms, 'CURRENT', Number.NaN)).toBe('SOURCE_UNAVAILABLE');
  });
  it('keeps denied policy history separate from readable diagnostic history with no eager or fake pagination RPC', async () => {
    const policy = diagnosticPolicy();
    const diagnosticHistory = {
      scope: policy.scope,
      items: [
        {
          probeRunId: diagnosticFixtureId,
          providerId: null,
          sourceRevision: `sigp-${diagnosticFixtureSha}`,
          sourceSha256: diagnosticFixtureSha,
          state: 'PARTIAL' as const,
          occurredAt: diagnosticFixtureNow,
          reasonCodes: [],
          evidenceId: null,
          evidenceSha256: null,
        },
      ],
      nextCursor: 'native-opaque-cursor',
      truncated: true,
    };
    await render(
      <SignatureDiagnosticsHistory
        diagnosticHistory={diagnosticHistory}
        policyHistory={{
          scope: policy.scope,
          policyId: policy.policyId,
          items: [],
          nextCursor: null,
          truncated: false,
        }}
        readState="CURRENT"
        policyReadState="DENIED"
      />,
      'en'
    );
    expect(container.textContent).toContain('Partial result');
    expect(container.textContent).toContain('Access unavailable');
    expect(container.textContent).toContain('More recorded history is available');
    expect(container.querySelector('button')).toBeNull();
    expect(fetch).not.toHaveBeenCalled();
  });
});

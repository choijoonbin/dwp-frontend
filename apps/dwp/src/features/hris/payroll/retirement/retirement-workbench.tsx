import { GuidedEmptyState, LoadingState, LocalErrorState } from '@dwp-frontend/design-system';

import { RetirementCommandCenter } from './components/retirement-command-center';
import {
  PAY004_ADAPTER_KIND,
  PAY004_DEFAULT_ROLLOUT,
  assertPay004TrustedAdmission,
  pay004EnabledForTenant,
} from './retirement-contract';
import { pay004Copy } from './retirement-copy';
import { pay004ErrorIsConcealed, usePay004WorkbenchQuery } from './use-retirement-workbench';

import type { Pay004QueryAdapter } from './retirement-api';
import type {
  Pay004Rollout,
  Pay004TrustedAdmission,
  Pay004TrustedScope,
} from './retirement-contract';

export type Pay004RetirementWorkbenchProps = Readonly<{
  rollout?: Pay004Rollout;
  /** Supplied only by exact central PAGE and DATA admission. */
  admission?: Pay004TrustedAdmission;
  adapter?: Pay004QueryAdapter;
}>;

function ActiveWorkbench({
  tenantId,
  scope,
  adapter,
}: Readonly<{ tenantId: string; scope: Pay004TrustedScope; adapter: Pay004QueryAdapter }>) {
  const copy = pay004Copy(scope.locale);
  const query = usePay004WorkbenchQuery({ adapter, scope, tenantId });
  const projection = query.projection;

  if (query.loading && !projection) {
    return (
      <div data-testid="pay-004-loading" data-runtime-state="loading">
        <LoadingState
          label={copy.loadingTitle}
          description={copy.loadingDescription}
          variant="skeleton"
          skeletonRows={6}
          size="page"
        />
      </div>
    );
  }
  if (query.error && !projection && pay004ErrorIsConcealed(query.error)) {
    return (
      <div data-testid="pay-004-denied" data-runtime-state="denied">
        <GuidedEmptyState
          kind="permission"
          title={copy.deniedTitle}
          description={copy.deniedDescription}
          size="page"
        />
      </div>
    );
  }
  if (!projection || projection.queryState.state === 'UNAVAILABLE') {
    return (
      <div data-testid="pay-004-unavailable" data-runtime-state="unavailable">
        <LocalErrorState
          title={copy.unavailableTitle}
          description={copy.unavailableDescription}
          requestIdLabel={projection?.queryState.correlationId}
          size="page"
        />
      </div>
    );
  }
  return (
    <RetirementCommandCenter
      projection={projection}
      scope={scope}
      copy={copy}
      stale={query.stale}
      fetching={query.fetching}
      canPrevious={query.canPrevious}
      canNext={query.canNext}
      criteria={query.criteria}
      onApplyCriteria={query.applyCriteria}
      onResetCriteria={query.resetCriteria}
      onRefresh={query.refresh}
      onPrevious={query.previous}
      onNext={query.next}
    />
  );
}

function requestedLocale(admission: unknown): string | undefined {
  if (!admission || typeof admission !== 'object' || Array.isArray(admission)) return undefined;
  const locale = (admission as Readonly<Record<string, unknown>>).locale;
  return typeof locale === 'string' ? locale : undefined;
}

export function Pay004RetirementWorkbench({
  rollout = PAY004_DEFAULT_ROLLOUT,
  admission,
  adapter,
}: Pay004RetirementWorkbenchProps) {
  const copy = pay004Copy(requestedLocale(admission));
  const tenantId = admission?.tenantId ?? '';
  if (!pay004EnabledForTenant(rollout, tenantId)) {
    return (
      <div data-testid="pay-004-disabled" data-runtime-state="disabled" data-owner-calls="0">
        <GuidedEmptyState
          kind="permission"
          title={copy.disabledTitle}
          description={copy.disabledDescription}
          size="page"
        />
      </div>
    );
  }

  let trusted: Pay004TrustedAdmission;
  try {
    trusted = assertPay004TrustedAdmission(admission);
  } catch {
    return (
      <div data-testid="pay-004-denied" data-runtime-state="denied" data-owner-calls="0">
        <GuidedEmptyState
          kind="permission"
          title={copy.deniedTitle}
          description={copy.deniedDescription}
          size="page"
        />
      </div>
    );
  }
  if (!adapter || adapter.kind !== PAY004_ADAPTER_KIND) {
    return (
      <div data-testid="pay-004-unavailable" data-runtime-state="unavailable" data-owner-calls="0">
        <LocalErrorState
          title={copy.unavailableTitle}
          description={copy.adapterUnavailableDescription}
          size="page"
        />
      </div>
    );
  }
  const scope: Pay004TrustedScope = Object.freeze({
    contextScopeKey: trusted.contextScopeKey,
    decisionRevision: trusted.decisionRevision,
    locale: trusted.locale,
    timeZone: trusted.timeZone,
    correlationId: trusted.correlationId,
  });
  const runtimeIdentity = JSON.stringify([trusted.tenantId, scope, adapter.kind]);
  return (
    <ActiveWorkbench
      key={runtimeIdentity}
      tenantId={trusted.tenantId}
      scope={scope}
      adapter={adapter}
    />
  );
}

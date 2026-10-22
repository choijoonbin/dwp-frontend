import { GuidedEmptyState, LoadingState, LocalErrorState } from '@dwp-frontend/design-system';

import { DataQualityCommandCenter } from './components/data-quality-command-center';
import {
  HRM012_ADAPTER_KIND,
  HRM012_FEATURE,
  assertHrm012TrustedScope,
} from './data-quality-contract';
import { hrm012Copy } from './data-quality-copy';
import { hrm012ErrorIsConcealed, useHrm012WorkbenchQuery } from './use-data-quality-workbench';

import type { Hrm012QueryAdapter } from './data-quality-api';
import type { Hrm012TrustedScope } from './data-quality-contract';

export type Hrm012RuntimeGate = Readonly<{
  feature: typeof HRM012_FEATURE;
  enabled: boolean;
  tenantEnrolled: boolean;
}>;

export const HRM012_DEFAULT_GATE: Hrm012RuntimeGate = Object.freeze({
  feature: HRM012_FEATURE,
  enabled: false,
  tenantEnrolled: false,
});

export type Hrm012DataQualityWorkbenchProps = Readonly<{
  gate?: Hrm012RuntimeGate;
  /** Trusted read scope supplied only by central PAGE-to-DATA admission. */
  scope?: Hrm012TrustedScope;
  adapter?: Hrm012QueryAdapter;
}>;

function ActiveWorkbench({
  scope,
  adapter,
}: Readonly<{ scope: Hrm012TrustedScope; adapter: Hrm012QueryAdapter }>) {
  const copy = hrm012Copy(scope.locale);
  const query = useHrm012WorkbenchQuery({ adapter, scope });
  const projection = query.projection;

  if (query.loading && !projection) {
    return (
      <div data-testid="hrm-012-loading" data-runtime-state="loading">
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
  if (query.error && !projection && hrm012ErrorIsConcealed(query.error)) {
    return (
      <div data-testid="hrm-012-denied" data-runtime-state="denied">
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
      <div data-testid="hrm-012-unavailable" data-runtime-state="unavailable">
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
    <DataQualityCommandCenter
      projection={projection}
      scope={scope}
      copy={copy}
      stale={query.stale}
      fetching={query.fetching}
      canPrevious={query.canPrevious}
      canNext={query.canNext}
      onRefresh={query.refresh}
      onPrevious={query.previous}
      onNext={query.next}
    />
  );
}

function requestedLocale(scope: unknown): string | undefined {
  if (!scope || typeof scope !== 'object' || Array.isArray(scope)) return undefined;
  const locale = (scope as Readonly<Record<string, unknown>>).locale;
  return typeof locale === 'string' ? locale : undefined;
}

export function Hrm012DataQualityWorkbench({
  gate = HRM012_DEFAULT_GATE,
  scope,
  adapter,
}: Hrm012DataQualityWorkbenchProps) {
  const copy = hrm012Copy(requestedLocale(scope));
  const rolloutAdmitted = gate.feature === HRM012_FEATURE && gate.enabled && gate.tenantEnrolled;
  if (!rolloutAdmitted) {
    return (
      <div data-testid="hrm-012-disabled" data-runtime-state="disabled" data-owner-calls="0">
        <GuidedEmptyState
          kind="permission"
          title={copy.disabledTitle}
          description={copy.disabledDescription}
          size="page"
        />
      </div>
    );
  }
  let trustedScope: Hrm012TrustedScope;
  try {
    trustedScope = assertHrm012TrustedScope(scope);
  } catch {
    return (
      <div data-testid="hrm-012-denied" data-runtime-state="denied" data-owner-calls="0">
        <GuidedEmptyState
          kind="permission"
          title={copy.deniedTitle}
          description={copy.deniedDescription}
          size="page"
        />
      </div>
    );
  }
  if (!adapter || adapter.kind !== HRM012_ADAPTER_KIND) {
    return (
      <div data-testid="hrm-012-unavailable" data-runtime-state="unavailable" data-owner-calls="0">
        <LocalErrorState
          title={copy.unavailableTitle}
          description={copy.adapterUnavailableDescription}
          size="page"
        />
      </div>
    );
  }
  const runtimeIdentity = JSON.stringify([trustedScope, adapter.kind]);
  return <ActiveWorkbench key={runtimeIdentity} scope={trustedScope} adapter={adapter} />;
}

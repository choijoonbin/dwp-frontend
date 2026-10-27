import { GuidedEmptyState, LocalErrorState } from '@dwp-frontend/design-system';

import { HrisOrganizationPositionsBranch } from './organization-positions-explorer';
import {
  HRIS_ORGANIZATION_POSITIONS_ADAPTER_KIND,
  HRIS_ORGANIZATION_POSITIONS_DEFAULT_GATE,
  HRIS_ORGANIZATION_POSITIONS_FEATURE,
  HRIS_ORGANIZATION_GRAPH_CONTRACT,
} from './organization-positions-contract';

import type {
  HrisOrganizationPositionsQueryAdapter,
  HrisOrganizationPositionsRuntimeGate,
  HrisOrganizationPositionsTrustedAdmission,
} from './organization-positions-contract';

export function HrisOrganizationPositionsWorkspace({
  gate = HRIS_ORGANIZATION_POSITIONS_DEFAULT_GATE,
  admission,
  adapter,
  now,
}: {
  /** @deprecated R7 source-completion test compatibility only; never route admission authority. */
  gate?: HrisOrganizationPositionsRuntimeGate;
  admission?: HrisOrganizationPositionsTrustedAdmission;
  adapter?: HrisOrganizationPositionsQueryAdapter;
  now?: string;
}) {
  const trustedAdmission = Boolean(
    admission?.kind === 'TRUSTED_PRODUCT_SURFACE_PAGE' &&
    admission.feature === HRIS_ORGANIZATION_POSITIONS_FEATURE &&
    admission.pageRouteContractKey === HRIS_ORGANIZATION_GRAPH_CONTRACT.pageRouteContractKey &&
    admission.contextScopeKey.trim() &&
    admission.decisionRevision.trim()
  );
  const admitted =
    trustedAdmission ||
    // Mandatory G3 source-completion tests retain this pre-R7 seam. Production routes never pass it.
    (gate.feature === HRIS_ORGANIZATION_POSITIONS_FEATURE && gate.enabled && gate.tenantEnrolled);
  if (!admitted) {
    return (
      <div data-slice="BASE-TFR-HRM-005" data-runtime-state="unavailable">
        <GuidedEmptyState
          kind="permission"
          title="Organization and positions are unavailable"
          description="This governed view is not available in the current context."
          size="page"
        />
      </div>
    );
  }
  if (!adapter || adapter.kind !== HRIS_ORGANIZATION_POSITIONS_ADAPTER_KIND) {
    return (
      <div data-slice="BASE-TFR-HRM-005" data-runtime-state="unavailable">
        <LocalErrorState
          title="Organization graph is unavailable"
          description="The canonical read adapter is not available. No organization request was sent."
          size="page"
        />
      </div>
    );
  }
  return <HrisOrganizationPositionsBranch adapter={adapter} now={now} />;
}

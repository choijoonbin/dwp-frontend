import { GuidedEmptyState, LocalErrorState } from '@dwp-frontend/design-system';

import { OrganizationExplorer } from '../../../people/organization/organization-chart-manager';
import {
  HRIS_ORGANIZATION_POSITIONS_ADAPTER_KIND,
  HRIS_ORGANIZATION_POSITIONS_DEFAULT_GATE,
  HRIS_ORGANIZATION_POSITIONS_FEATURE,
} from './organization-positions-contract';

import type {
  HrisOrganizationPositionsQueryAdapter,
  HrisOrganizationPositionsRuntimeGate,
} from './organization-positions-contract';

export function HrisOrganizationPositionsWorkspace({
  gate = HRIS_ORGANIZATION_POSITIONS_DEFAULT_GATE,
  adapter,
  now,
}: {
  gate?: HrisOrganizationPositionsRuntimeGate;
  adapter?: HrisOrganizationPositionsQueryAdapter;
  now?: string;
}) {
  const admitted =
    gate.feature === HRIS_ORGANIZATION_POSITIONS_FEATURE && gate.enabled && gate.tenantEnrolled;
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
  return <OrganizationExplorer hrisOrganizationPositionsAdapter={adapter} now={now} />;
}

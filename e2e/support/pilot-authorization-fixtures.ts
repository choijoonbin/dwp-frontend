import {
  toPilotE2ESessionFixture,
  type PilotFixtureSelector,
  type PilotFrontendFixtureProjection,
} from '@dwp-frontend/shared-utils/test-utils/pilot-authorization-fixture-adapter';

import type { ApprovalAuthorityOptions } from './product-surface-authority';

export function pilotAuthorizationE2ESessionEvidence(
  selector: PilotFixtureSelector
): PilotFrontendFixtureProjection {
  return toPilotE2ESessionFixture(selector);
}

export function approvalPilotAuthorityOptions(testId: `PS-A${string}`): {
  authority: ApprovalAuthorityOptions;
  fixture: PilotFrontendFixtureProjection;
} {
  const fixture = pilotAuthorizationE2ESessionEvidence({ testId });
  const components = fixture.composition.flatMap((source) =>
    source.source === 'COMPONENT' ? [source.value] : []
  );
  const capabilities = components.flatMap((component) => [
    ...(component.capabilityContractKeys ?? []),
  ]);
  const workCapabilityKeys = capabilities.filter((key) => key.startsWith('approvals.work.'));
  const managementCapabilityKeys = capabilities.filter(
    (key) => key.startsWith('approvals.') && !key.startsWith('approvals.work.')
  );
  const hasWorkPolicy = components.some(
    (component) =>
      component.accessPolicyKeys?.includes('approvals.work-access.v1') ||
      component.appEntitlements?.includes('APP.APPROVALS:VIEW')
  );
  const managementComponents = components.filter((component) =>
    component.capabilityContractKeys?.some(
      (key) => key.startsWith('approvals.') && !key.startsWith('approvals.work.')
    )
  );
  const assignmentDenied = fixture.expectedOutcome === 'SOD_ASSIGNMENT_DENIED';
  const revoked = fixture.expectedOutcome === 'IMMEDIATE_CONTEXT_REMOVAL';
  const deltaValidUntil = fixture.delta?.validUntil;
  const revalidateAt =
    typeof deltaValidUntil === 'string'
      ? deltaValidUntil
      : components
          .map((component) => component.validUntil)
          .filter((value): value is string => typeof value === 'string')
          .sort()[0];
  return {
    fixture,
    authority: {
      work: hasWorkPolicy && !revoked,
      management: managementCapabilityKeys.length > 0 && !assignmentDenied && !revoked,
      workCapabilityKeys,
      managementCapabilityKeys,
      managementReadOnly:
        managementComponents.length > 0 &&
        managementComponents.every((component) => component.readOnly === true),
      generatedAt: fixture.fixedClock,
      revalidateAt,
    },
  };
}

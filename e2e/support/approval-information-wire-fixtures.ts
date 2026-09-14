import { approvalInformationWireBody } from '@dwp-frontend/shared-utils/api/approval-information-wire-body';

import type { respondToApprovalInformationRequest } from '@dwp-frontend/shared-utils/api/approval-api';

// Legacy component harnesses replace the transport, not the real wire capture contract.
export function captureApprovalInformationFixtureWire(
  args: Parameters<typeof respondToApprovalInformationRequest>
) {
  const [, message, payload, expectedVersion, , options] = args;
  if (!options?.onOriginalWireBody) return;
  approvalInformationWireBody(
    {
      message,
      payload: structuredClone(payload),
      expectedVersion,
      ...(options.sourceGeneration === undefined
        ? {}
        : { sourceGeneration: options.sourceGeneration }),
    },
    options.onOriginalWireBody
  );
}

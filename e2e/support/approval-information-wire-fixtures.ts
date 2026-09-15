import { approvalInformationWireBody } from '@dwp-frontend/shared-utils/api/approval-information-wire-body';
import type { Page } from '@playwright/test';

import type { respondToApprovalInformationRequest } from '@dwp-frontend/shared-utils/api/approval-api';

const APPROVAL_INFORMATION_WIRE_CAPTURE_BINDING = '__dwpCaptureApprovalInformationWireBody';

export interface ApprovalInformationWireCapture {
  pathname: string;
  body: Record<string, unknown>;
}

export async function installApprovalInformationWireCapture(page: Page) {
  const captures: ApprovalInformationWireCapture[] = [];
  await page.exposeFunction(
    APPROVAL_INFORMATION_WIRE_CAPTURE_BINDING,
    (capture: ApprovalInformationWireCapture) => {
      captures.push(structuredClone(capture));
    }
  );
  await page.addInitScript(
    ({ bindingName }) => {
      const originalFetch = window.fetch.bind(window);
      window.fetch = async (input, init) => {
        const requestUrl =
          typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
        const url = new URL(requestUrl, window.location.href);
        if (url.pathname.endsWith('/information-response') && init?.body instanceof Blob) {
          const capture = {
            pathname: url.pathname,
            body: JSON.parse(await init.body.text()) as Record<string, unknown>,
          };
          await (
            window as unknown as Record<
              string,
              (value: ApprovalInformationWireCapture) => Promise<void>
            >
          )[bindingName]!(capture);
        }
        return originalFetch(input, init);
      };
    },
    { bindingName: APPROVAL_INFORMATION_WIRE_CAPTURE_BINDING }
  );
  return captures;
}

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

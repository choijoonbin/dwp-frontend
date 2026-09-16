import { useCallback, useEffect, useState } from 'react';

import {
  ServiceInformationResponseBridge,
  type ServiceInformationResponseBinding,
} from '../features/services/service-information-response-bridge';
import type { WorkHubAssistDraft } from '../features/work-hub/work-hub-assist';
import type { WorkHubItem } from '../features/work-hub/work-hub-contracts';

export function useWorkHubServiceResponse({
  owner,
  item,
  onConfirmed,
}: {
  owner: string | null;
  item: WorkHubItem | undefined;
  onConfirmed: () => void;
}) {
  const [draft, setDraft] = useState<(WorkHubAssistDraft & { key: string; owner: string }) | null>(
    null
  );
  const [binding, setBinding] = useState<ServiceInformationResponseBinding | null>(null);
  const clear = useCallback(() => {
    setDraft(null);
    setBinding(null);
  }, []);
  useEffect(clear, [clear, owner]);
  const applyDraft = useCallback(
    (candidate: WorkHubAssistDraft) => {
      if (
        !owner ||
        item?.reference.sourceSystem !== 'SERVICE_REQUEST' ||
        item.sourceStatus !== 'AWAITING_REQUESTER' ||
        candidate.workKey !== item.key ||
        candidate.sourceVersion !== item.version ||
        binding?.requestId !== item.reference.sourceReference ||
        binding.version !== candidate.sourceVersion ||
        binding.status !== 'AWAITING_REQUESTER'
      ) {
        return false;
      }
      setDraft({ ...candidate, key: crypto.randomUUID(), owner });
      return true;
    },
    [binding, item, owner]
  );
  const bridge =
    item?.reference.sourceSystem === 'SERVICE_REQUEST' &&
    item.sourceContext?.kind === 'SERVICE_REQUEST' ? (
      <ServiceInformationResponseBridge
        requestId={item.reference.sourceReference}
        expectedVersion={item.version}
        expectedServiceKey={item.sourceContext.serviceKey}
        expectedDataClassification={item.dataClassification}
        appliedDraft={
          draft?.owner === owner &&
          draft.workKey === item.key &&
          draft.sourceVersion === item.version
            ? {
                key: draft.key,
                expectedVersion: draft.sourceVersion,
                message: draft.message,
              }
            : null
        }
        onDraftApplied={() => {
          // A consumed or explicitly dismissed draft must not return when the bridge remounts.
          setDraft(null);
          requestAnimationFrame(() => {
            const response = document.querySelector<HTMLElement>(
              '[data-testid="service-information-response"]'
            );
            response?.scrollIntoView({ block: 'nearest' });
            response
              ?.querySelector<HTMLTextAreaElement>('textarea')
              ?.focus({ preventScroll: true });
          });
        }}
        onBindingChange={setBinding}
        onConfirmed={() => {
          setDraft(null);
          onConfirmed();
        }}
      />
    ) : null;
  return { applyDraft, bridge, clear };
}

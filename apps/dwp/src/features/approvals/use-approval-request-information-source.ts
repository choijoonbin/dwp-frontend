import { useRef } from 'react';

import {
  approvalRequestInformationSnapshot,
  sameApprovalRequestInformationSnapshot,
} from './approval-request-information-snapshot';

import type { ApprovalRequestDetail } from '@dwp-frontend/shared-utils';
import type { ApprovalRequestInformationSnapshot } from './approval-request-information-snapshot';

type InformationOrigin = Readonly<{
  identity: string;
  detail: ApprovalRequestDetail;
  snapshot: ApprovalRequestInformationSnapshot;
}>;

export function useApprovalRequestInformationSource({
  identity,
  detail,
}: {
  identity: string;
  detail?: ApprovalRequestDetail;
}) {
  const origin = useRef<InformationOrigin | undefined>(undefined);
  const previousIdentity = useRef(identity);
  if (previousIdentity.current !== identity) {
    origin.current = undefined;
    previousIdentity.current = identity;
  }
  let invalid = false;
  if (!origin.current && detail) {
    try {
      const snapshot = approvalRequestInformationSnapshot(detail);
      if (snapshot) origin.current = { identity, detail: structuredClone(detail), snapshot };
    } catch {
      invalid = true;
    }
  }
  const current = origin.current;
  const matches = current
    ? sameApprovalRequestInformationSnapshot(current.snapshot, detail)
    : !invalid;
  return {
    snapshot: current?.snapshot,
    editingDetail: current?.detail ?? (invalid ? undefined : detail),
    matches,
    changed: invalid || Boolean(current && detail && !matches),
  };
}

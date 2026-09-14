import { describe, expect, it } from 'vitest';

import {
  approvalInformationDetail,
  INFORMATION_SOURCE_CHANGES,
} from '../../../../../e2e/support/approval-information-generation-fixtures';
import {
  approvalRequestInformationSnapshot,
  sameApprovalRequestInformationSnapshot,
} from './approval-request-information-snapshot';

describe('information response editing origin', () => {
  it('freezes the exact round and accepts only its original source', async () => {
    const detail = await approvalInformationDetail();
    const snapshot = approvalRequestInformationSnapshot(detail)!;
    expect(Object.isFrozen(snapshot)).toBe(true);
    expect(Object.keys(snapshot)).toHaveLength(14);
    expect(sameApprovalRequestInformationSnapshot(snapshot, structuredClone(detail))).toBe(true);
  });
  it.each(INFORMATION_SOURCE_CHANGES)('rejects changed $key', async ({ change }) => {
    const detail = await approvalInformationDetail();
    expect(
      sameApprovalRequestInformationSnapshot(
        approvalRequestInformationSnapshot(detail)!,
        change(detail)
      )
    ).toBe(false);
  });
  it('keeps truly absent legacy generation compatible, without malformed fallback', async () => {
    const detail = await approvalInformationDetail();
    expect(
      approvalRequestInformationSnapshot({
        ...detail,
        informationRound: null,
        informationGeneration: null,
      })
    ).toBeUndefined();
    expect(() =>
      approvalRequestInformationSnapshot({ ...detail, informationRound: null })
    ).toThrow();
  });
});

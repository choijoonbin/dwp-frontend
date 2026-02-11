/**
 * Case Action Proposals — Phase3 fingerprint dedup
 * 동일 fingerprint끼리 그룹화, 최신 createdAt 1건만 유지.
 */

import type { CaseActionProposalDto } from '@dwp-frontend/shared-utils';

export function dedupeProposalsByFingerprint(
  items: CaseActionProposalDto[]
): CaseActionProposalDto[] {
  const byKey = new Map<string, CaseActionProposalDto>();
  for (const item of items) {
    const key = item.fingerprint ?? item.proposalId ?? (item as { id?: string }).id ?? '';
    const existing = byKey.get(key);
    const itemTime = item.createdAt ? new Date(item.createdAt).getTime() : 0;
    const existingTime = existing?.createdAt ? new Date(existing.createdAt).getTime() : 0;
    if (!existing || itemTime >= existingTime) byKey.set(key, item);
  }
  return Array.from(byKey.values());
}

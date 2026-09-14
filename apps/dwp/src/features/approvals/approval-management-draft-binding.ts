export type ApprovalManagementDraftBinding = Readonly<{
  objectId: string;
  version: number;
}>;

export function approvalManagementDraftBindingMatches(
  binding: ApprovalManagementDraftBinding | null,
  current: { objectId: string; version: number; lifecycleState: string } | undefined
): boolean {
  return Boolean(
    binding &&
    binding.objectId &&
    Number.isSafeInteger(binding.version) &&
    binding.version >= 0 &&
    current?.objectId === binding.objectId &&
    current.version === binding.version &&
    current.lifecycleState === 'DRAFT'
  );
}

export type MailProposalMutationBinding = Readonly<{
  proposalId: string;
  commandId: string;
  version: number;
}>;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

export function mailProposalMutationHeaders(
  binding?: MailProposalMutationBinding
): Record<string, string> {
  if (!binding) return {};
  if (
    !UUID_PATTERN.test(binding.proposalId) ||
    !UUID_PATTERN.test(binding.commandId) ||
    !Number.isSafeInteger(binding.version) ||
    binding.version < 0
  ) {
    throw new Error('A valid Mail proposal mutation binding is required.');
  }
  return {
    'X-DWP-Mail-Proposal-ID': binding.proposalId,
    'X-DWP-Mail-Command-ID': binding.commandId,
    'X-DWP-Mail-Proposal-Version': String(binding.version),
  };
}

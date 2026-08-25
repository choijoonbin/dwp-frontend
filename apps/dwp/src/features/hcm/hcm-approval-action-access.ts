export type HcmApprovalDecisionScope = 'operations' | 'team';
export type HcmApprovalDomain = 'time' | 'absence';

export type HcmApprovalCapabilityAccess = Readonly<{
  governed: boolean;
  hasWritableCapability: (capabilityContractKey: string) => boolean;
}>;

export function hcmApprovalCapabilityKey(
  decisionScope: HcmApprovalDecisionScope,
  domain: HcmApprovalDomain
): string {
  return `hcm.${decisionScope}.${domain}.approve`;
}

export function canDiscloseHcmApprovalAction(
  access: HcmApprovalCapabilityAccess,
  decisionScope: HcmApprovalDecisionScope,
  domain: HcmApprovalDomain
): boolean {
  return (
    !access.governed ||
    access.hasWritableCapability(hcmApprovalCapabilityKey(decisionScope, domain))
  );
}

type CapabilityAccess = Readonly<{
  governed: boolean;
  hasWritableCapability: (capabilityContractKey: string) => boolean;
}>;

export function hrisIntegrationActionAccess(access: CapabilityAccess, legacyCanManage: boolean) {
  return {
    create: access.governed
      ? access.hasWritableCapability('hcm.integration.create')
      : legacyCanManage,
    update: access.governed
      ? access.hasWritableCapability('hcm.integration.update')
      : legacyCanManage,
    // Execution crosses an external-system boundary. A legacy role is not exact authority.
    execute: access.governed && access.hasWritableCapability('hcm.integration.execute'),
  } as const;
}

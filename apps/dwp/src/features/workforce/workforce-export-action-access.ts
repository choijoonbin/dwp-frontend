type CapabilityAccess = Readonly<{
  governed: boolean;
  hasWritableCapability: (capabilityContractKey: string) => boolean;
}>;

export function workforceExportActionAccess(access: CapabilityAccess, legacyCanGovern: boolean) {
  void legacyCanGovern;
  return {
    // A legacy administrator role is not target-population-bound export evidence.
    create: access.governed && access.hasWritableCapability('hcm.controlled-export.create'),
    cancel: access.governed && access.hasWritableCapability('hcm.controlled-export.cancel'),
    retry: access.governed && access.hasWritableCapability('hcm.controlled-export.retry'),
  } as const;
}

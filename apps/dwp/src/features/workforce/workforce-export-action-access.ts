type CapabilityAccess = Readonly<{
  governed: boolean;
  hasWritableCapability: (capabilityContractKey: string) => boolean;
}>;

export function workforceExportActionAccess(access: CapabilityAccess, legacyCanGovern: boolean) {
  return {
    create: access.governed
      ? access.hasWritableCapability('hcm.controlled-export.create')
      : legacyCanGovern,
    cancel: access.governed
      ? access.hasWritableCapability('hcm.controlled-export.cancel')
      : legacyCanGovern,
    retry: access.governed
      ? access.hasWritableCapability('hcm.controlled-export.retry')
      : legacyCanGovern,
  } as const;
}

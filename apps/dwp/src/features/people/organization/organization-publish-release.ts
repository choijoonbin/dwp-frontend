type CapabilityAccess = Readonly<{
  governed: boolean;
  hasWritableCapability: (capabilityContractKey: string) => boolean;
}>;

/**
 * G-05 and PS-03 still require independent HCM + Security approval. This constant deliberately
 * has no environment override: enabling publication requires a reviewed release change after
 * both immutable approval evidence items are complete.
 */
export const ORGANIZATION_PUBLISH_RELEASE = Object.freeze({
  enabled: false,
  blockers: ['G-05', 'PS-03'] as const,
});

export function organizationPublishAccess(
  access: CapabilityAccess,
  releaseEnabled: boolean = ORGANIZATION_PUBLISH_RELEASE.enabled
) {
  const authorized = access.governed && access.hasWritableCapability('hcm.org-design.publish');
  return {
    authorized,
    enabled: authorized && releaseEnabled,
  } as const;
}

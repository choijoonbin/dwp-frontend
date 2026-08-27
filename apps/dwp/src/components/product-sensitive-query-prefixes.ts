export const GOVERNED_PRODUCT_LEGACY_QUERY_PREFIXES = {
  approvals: ['approvals'],
  calendar: ['calendar'],
  communications: ['communications', 'communication', 'announcements'],
  dwaion: ['dwaion'],
  hcm: ['hcm', 'hr', 'workforce', 'system-code-set'],
  mail: ['mail'],
  meetings: ['meetings'],
  messaging: ['messaging'],
  notifications: ['notifications'],
  services: ['services', 'service-center', 'service-catalog'],
  spaces: ['spaces'],
  workplace: ['workplace', 'rooms'],
} as const satisfies Readonly<Record<string, readonly string[]>>;

export const GOVERNED_PRODUCT_LEGACY_SENSITIVE_QUERY_PREFIXES = Object.freeze(
  Object.values(GOVERNED_PRODUCT_LEGACY_QUERY_PREFIXES).flat()
);

const SOURCES: Record<string, string> = {
  IDENTITY: 'audit.sources.IDENTITY',
  PLATFORM: 'audit.sources.PLATFORM',
};

const ACTOR_TYPES: Record<string, string> = {
  USER: 'audit.actorTypes.USER',
  AGENT: 'audit.actorTypes.AGENT',
  SYSTEM: 'audit.actorTypes.SYSTEM',
};

export function auditSourceLabelKey(source: string): string {
  return SOURCES[source] ?? 'audit.sources.UNKNOWN';
}

export function auditActorTypeLabelKey(actorType: string): string {
  return ACTOR_TYPES[actorType] ?? 'audit.actorTypes.UNKNOWN';
}

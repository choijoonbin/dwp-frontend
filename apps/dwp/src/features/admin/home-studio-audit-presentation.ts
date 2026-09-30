const ACTION_KEYS: Record<string, string> = {
  'home-experience.updated': 'homeStudio.audit.actions.settingsUpdated',
  'home-experience.published': 'homeStudio.audit.actions.experiencePublished',
  'home-experience.launchpad-updated': 'homeStudio.audit.actions.launchpadUpdated',
  'home-experience.composition-updated': 'homeStudio.audit.actions.compositionUpdated',
  'home-experience.background-uploaded': 'homeStudio.audit.actions.backgroundUploaded',
  'home-experience.background-reset': 'homeStudio.audit.actions.backgroundReset',
  'home-experience.rolled-back': 'homeStudio.audit.actions.rolledBack',
};

const TARGET_KEYS: Record<string, string> = {
  HOME_EXPERIENCE: 'homeStudio.audit.targets.experience',
  HOME_LAUNCHPAD_CONFIGURATION: 'homeStudio.audit.targets.launchpad',
  HOME_COMPOSITION_POLICY: 'homeStudio.audit.targets.composition',
};

const OUTCOME_KEYS: Record<string, string> = {
  SUCCESS: 'homeStudio.audit.outcomes.success',
  DENIED: 'homeStudio.audit.outcomes.denied',
  FAILED: 'homeStudio.audit.outcomes.failed',
};

export function homeStudioAuditActionLabelKey(value: string): string {
  return ACTION_KEYS[value] ?? 'homeStudio.audit.actions.managed';
}

export function homeStudioAuditTargetLabelKey(value: string): string {
  return TARGET_KEYS[value] ?? 'homeStudio.audit.targets.managed';
}

export function homeStudioAuditOutcomeLabelKey(value: string): string {
  return OUTCOME_KEYS[value] ?? 'homeStudio.audit.outcomes.unavailable';
}

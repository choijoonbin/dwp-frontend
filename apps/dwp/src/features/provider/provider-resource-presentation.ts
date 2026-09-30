type Translate = (key: string) => string;

const RESOURCE_UNIT_KEYS: Readonly<Record<string, string>> = {
  SEAT: 'resourceGovernance.units.SEAT',
  GIB: 'resourceGovernance.units.GIB',
  REQUEST: 'resourceGovernance.units.REQUEST',
  CURRENCY_MINOR: 'resourceGovernance.units.CURRENCY_MINOR',
  COUNT: 'resourceGovernance.units.COUNT',
};

const CONTROL_MODE_KEYS: Readonly<Record<string, string>> = {
  SOFT_ALERT: 'resourceGovernance.controlModes.SOFT_ALERT',
  HARD_BLOCK: 'resourceGovernance.controlModes.HARD_BLOCK',
};

const COMMITMENT_LIFECYCLE_KEYS: Readonly<Record<string, string>> = {
  ACTIVE: 'resourceGovernance.commitmentLifecycle.ACTIVE',
  SUSPENDED: 'resourceGovernance.commitmentLifecycle.SUSPENDED',
  RETIRED: 'resourceGovernance.commitmentLifecycle.RETIRED',
};

const FRESHNESS_KEYS: Readonly<Record<string, string>> = {
  LEGACY_UNCONFIGURED: 'resourceGovernance.freshness.LEGACY_UNCONFIGURED',
  PERIOD_NOT_ACTIVE: 'resourceGovernance.freshness.PERIOD_NOT_ACTIVE',
  NO_CURRENT_PERIOD_EVIDENCE: 'resourceGovernance.freshness.NO_CURRENT_PERIOD_EVIDENCE',
  CURRENT_PERIOD_EVIDENCE: 'resourceGovernance.freshness.CURRENT_PERIOD_EVIDENCE',
};

const LEDGER_ENTRY_TYPE_KEYS: Readonly<Record<string, string>> = {
  ALLOCATE: 'resourceGovernance.entryTypes.ALLOCATE',
  RELEASE: 'resourceGovernance.entryTypes.RELEASE',
  METER: 'resourceGovernance.entryTypes.METER',
  ADJUST: 'resourceGovernance.entryTypes.ADJUST',
  BUDGET_RESERVE: 'resourceGovernance.entryTypes.BUDGET_RESERVE',
  BUDGET_RELEASE: 'resourceGovernance.entryTypes.BUDGET_RELEASE',
  BUDGET_SPEND: 'resourceGovernance.entryTypes.BUDGET_SPEND',
};

const CHANGE_KIND_KEYS: Readonly<Record<string, string>> = {
  CONTRACT_CHANGE: 'resourceGovernance.changes.kinds.CONTRACT_CHANGE',
  TEMPORARY_OVERRIDE: 'resourceGovernance.changes.kinds.TEMPORARY_OVERRIDE',
};

const TENANT_LIFECYCLE_ACTION_KEYS: Readonly<Record<string, string>> = {
  RETIRE: 'resourceGovernance.lifecycle.actions.RETIRE',
  PURGE: 'resourceGovernance.lifecycle.actions.PURGE',
};

const TENANT_HOLD_STATE_KEYS: Readonly<Record<string, string>> = {
  OWNER_VERIFICATION_REQUIRED: 'resourceGovernance.lifecycle.hold.OWNER_VERIFICATION_REQUIRED',
  ACTIVE_GLOBAL_LEGAL_HOLD: 'resourceGovernance.lifecycle.hold.ACTIVE_GLOBAL_LEGAL_HOLD',
};

function label(t: Translate, dictionary: Readonly<Record<string, string>>, value: unknown): string {
  const key = typeof value === 'string' ? dictionary[value] : undefined;
  return t(key ?? 'resourceGovernance.unknownValue');
}

export function providerResourceUnitLabel(t: Translate, value: unknown): string {
  return label(t, RESOURCE_UNIT_KEYS, value);
}

export function providerResourceControlModeLabel(t: Translate, value: unknown): string {
  return label(t, CONTROL_MODE_KEYS, value);
}

export function providerCommitmentLifecycleLabel(t: Translate, value: unknown): string {
  return label(t, COMMITMENT_LIFECYCLE_KEYS, value);
}

export function providerResourceFreshnessLabel(t: Translate, value: unknown): string {
  return label(t, FRESHNESS_KEYS, value);
}

export function providerResourceLedgerEntryTypeLabel(t: Translate, value: unknown): string {
  return label(t, LEDGER_ENTRY_TYPE_KEYS, value);
}

export function providerResourceChangeKindLabel(t: Translate, value: unknown): string {
  return label(t, CHANGE_KIND_KEYS, value);
}

export function providerTenantLifecycleActionLabel(t: Translate, value: unknown): string {
  return label(t, TENANT_LIFECYCLE_ACTION_KEYS, value);
}

export function providerTenantHoldStateLabel(t: Translate, value: unknown): string {
  return label(t, TENANT_HOLD_STATE_KEYS, value);
}

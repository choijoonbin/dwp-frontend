// Local feature types: rendering and drafts do not depend on transport DTO aliases.
export type PerformanceGoal = Readonly<{
  goalId: string;
  title: string;
  goalType: string;
  progressPercent: number;
  dueDate?: string | null;
  status: string;
  version: number;
}>;

export type PerformanceEmployee = Readonly<{
  displayName: string;
  organizationName?: string | null;
}>;

export type PerformanceWorkspaceSource = Readonly<{
  employee: PerformanceEmployee;
  goals: readonly PerformanceGoal[];
}>;

export const HRIS_PERFORMANCE_PHASE_ONE_ROUTE = '/hr/talent' as const;

export type PerformanceGoalSaveFailure =
  'CONFLICT' | 'FORBIDDEN' | 'NOT_FOUND' | 'LOCKED' | 'UNAVAILABLE' | 'UNKNOWN';

export type PerformanceDataProvenance = 'SOURCE' | 'REFERENCE' | 'UNKNOWN';

export type PerformanceGoalDraft = Readonly<{
  goalId: string;
  title: string;
  baselineProgressPercent: number;
  progressPercent: number;
  baselineStatus: string;
  version: number;
  saveFailure: PerformanceGoalSaveFailure | null;
}>;

export type PerformanceGoalUpdate = Readonly<{
  goalId: string;
  request: Readonly<{
    progressPercent: number;
    status: string;
    version: number;
  }>;
}>;

export type PerformanceGoalDraftValidation =
  'READY' | 'UNCHANGED' | 'NOT_EDITABLE' | 'LATEST_VERSION_REQUIRED' | 'FORBIDDEN';

export type PerformancePersonalGoals = Readonly<{
  employee: PerformanceWorkspaceSource['employee'];
  goals: readonly PerformanceGoal[];
  provenance: PerformanceDataProvenance;
}>;

const EDITABLE_GOAL_STATUSES = new Set(['ACTIVE', 'AT_RISK']);

function normalizedStatus(status: string): string {
  return status.trim().toUpperCase();
}

function normalizedProgress(progressPercent: number): number {
  if (!Number.isFinite(progressPercent)) return 0;
  return Math.min(100, Math.max(0, Math.round(progressPercent)));
}

function statusCode(error: unknown): number | undefined {
  if (!error || typeof error !== 'object') return undefined;
  const direct = (error as { status?: unknown }).status;
  if (typeof direct === 'number') return direct;
  const response = (error as { response?: unknown }).response;
  if (!response || typeof response !== 'object') return undefined;
  const nested = (response as { status?: unknown }).status;
  return typeof nested === 'number' ? nested : undefined;
}

function invalidSource(): never {
  throw new Error('Performance source payload is invalid.');
}

function sourceRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return invalidSource();
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) return invalidSource();
  return value as Record<string, unknown>;
}

function sourceText(value: unknown, maximum: number): string {
  const containsControlCharacter =
    typeof value === 'string' &&
    [...value].some((character) => {
      const codePoint = character.codePointAt(0);
      return codePoint !== undefined && (codePoint <= 0x1f || codePoint === 0x7f);
    });
  if (
    typeof value !== 'string' ||
    value.trim().length === 0 ||
    value.length > maximum ||
    containsControlCharacter
  )
    return invalidSource();
  return value;
}

function sourceCivilDate(value: unknown): string | null | undefined {
  if (value === undefined || value === null) return value;
  const text = sourceText(value, 10);
  if (text.length !== 10 || !/^\d{4}-\d{2}-\d{2}$/.test(text)) return invalidSource();
  const [year, month, day] = text.split('-').map(Number);
  if (year < 1 || month < 1 || month > 12 || day < 1 || day > 31) return invalidSource();
  const date = new Date(0);
  date.setUTCFullYear(year, month - 1, day);
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  )
    return invalidSource();
  return text;
}

function detectedProvenance(workspace: Record<string, unknown>): PerformanceDataProvenance {
  if (workspace.referenceData !== undefined && typeof workspace.referenceData !== 'boolean') {
    return invalidSource();
  }
  if (workspace.dataOrigin !== undefined && typeof workspace.dataOrigin !== 'string') {
    return invalidSource();
  }
  const origin =
    workspace.dataOrigin === undefined
      ? undefined
      : sourceText(workspace.dataOrigin, 100).trim().toUpperCase();
  if (workspace.referenceData === false && (origin === 'REFERENCE' || origin === 'LOCAL_SEED'))
    return invalidSource();
  if (workspace.referenceData === true) return 'REFERENCE';
  if (workspace.referenceData === false) return 'SOURCE';
  if (origin === 'REFERENCE' || origin === 'LOCAL_SEED') return 'REFERENCE';
  if (origin === 'SOURCE') return 'SOURCE';
  return 'UNKNOWN';
}

export function isPerformanceGoalEditable(goal: Pick<PerformanceGoal, 'status'>): boolean {
  return EDITABLE_GOAL_STATUSES.has(normalizedStatus(goal.status));
}

export function createPerformanceGoalDraft(goal: PerformanceGoal): PerformanceGoalDraft {
  const progressPercent = normalizedProgress(goal.progressPercent);
  return {
    goalId: goal.goalId,
    title: goal.title,
    baselineProgressPercent: progressPercent,
    progressPercent,
    baselineStatus: normalizedStatus(goal.status),
    version: goal.version,
    saveFailure: null,
  };
}

export function setPerformanceGoalDraftProgress(
  draft: PerformanceGoalDraft,
  progressPercent: number
): PerformanceGoalDraft {
  const nextProgress = normalizedProgress(progressPercent);
  return {
    ...draft,
    progressPercent: nextProgress,
  };
}

export function withPerformanceGoalSaveFailure(
  draft: PerformanceGoalDraft,
  saveFailure: PerformanceGoalSaveFailure | null
): PerformanceGoalDraft {
  return { ...draft, saveFailure };
}

export function validatePerformanceGoalDraft(
  draft: PerformanceGoalDraft
): PerformanceGoalDraftValidation {
  if (!EDITABLE_GOAL_STATUSES.has(normalizedStatus(draft.baselineStatus))) {
    return 'NOT_EDITABLE';
  }
  if (draft.saveFailure === 'CONFLICT' || draft.saveFailure === 'NOT_FOUND') {
    return 'LATEST_VERSION_REQUIRED';
  }
  if (draft.saveFailure === 'FORBIDDEN' || draft.saveFailure === 'LOCKED') {
    return draft.saveFailure === 'FORBIDDEN' ? 'FORBIDDEN' : 'NOT_EDITABLE';
  }
  if (draft.progressPercent === draft.baselineProgressPercent) {
    return 'UNCHANGED';
  }
  return 'READY';
}

export function buildPerformanceGoalUpdate(
  draft: PerformanceGoalDraft
): PerformanceGoalUpdate | null {
  if (validatePerformanceGoalDraft(draft) !== 'READY') return null;
  return {
    goalId: draft.goalId,
    request: {
      progressPercent: draft.progressPercent,
      status: normalizedStatus(draft.baselineStatus),
      version: draft.version,
    },
  };
}

export function classifyPerformanceGoalSaveFailure(error: unknown): PerformanceGoalSaveFailure {
  const status = statusCode(error);
  if (status === 401 || status === 403) return 'FORBIDDEN';
  if (status === 404) return 'NOT_FOUND';
  if (status === 409) return 'CONFLICT';
  if (status === 429 || (typeof status === 'number' && status >= 500)) return 'UNAVAILABLE';
  if (error instanceof Error && error.name === 'HttpTransportError') return 'UNAVAILABLE';
  return 'UNKNOWN';
}

export function rebasePerformanceGoalDraft(
  draft: PerformanceGoalDraft,
  latestGoal: PerformanceGoal | undefined
): PerformanceGoalDraft {
  if (!latestGoal) return withPerformanceGoalSaveFailure(draft, 'NOT_FOUND');
  if (!isPerformanceGoalEditable(latestGoal)) {
    return {
      ...draft,
      title: latestGoal.title,
      baselineProgressPercent: normalizedProgress(latestGoal.progressPercent),
      baselineStatus: normalizedStatus(latestGoal.status),
      version: latestGoal.version,
      saveFailure: 'LOCKED',
    };
  }
  return {
    ...draft,
    title: latestGoal.title,
    baselineProgressPercent: normalizedProgress(latestGoal.progressPercent),
    baselineStatus: normalizedStatus(latestGoal.status),
    version: latestGoal.version,
    saveFailure: null,
  };
}

export function selectPerformancePersonalGoals(
  source: unknown,
  declaredProvenance?: PerformanceDataProvenance
): PerformancePersonalGoals {
  const workspace = sourceRecord(source);
  const employeeSource = sourceRecord(workspace.employee);
  const organization = employeeSource.organizationName;
  const employee: PerformanceEmployee = Object.freeze({
    displayName: sourceText(employeeSource.displayName, 500),
    ...(organization === undefined
      ? {}
      : {
          organizationName: organization === null ? null : sourceText(organization, 500),
        }),
  });
  if (!Array.isArray(workspace.goals)) return invalidSource();
  const identifiers = new Set<string>();
  const goals: PerformanceGoal[] = [];
  for (let index = 0; index < workspace.goals.length; index += 1) {
    if (!Object.hasOwn(workspace.goals, index)) return invalidSource();
    const goal = sourceRecord(workspace.goals[index]);
    const goalId = sourceText(goal.goalId, 500);
    if (goalId !== goalId.trim() || identifiers.has(goalId)) return invalidSource();
    identifiers.add(goalId);
    const progressPercent = goal.progressPercent;
    const version = goal.version;
    if (
      typeof progressPercent !== 'number' ||
      !Number.isFinite(progressPercent) ||
      progressPercent < 0 ||
      progressPercent > 100 ||
      typeof version !== 'number' ||
      !Number.isSafeInteger(version) ||
      version < 0
    )
      return invalidSource();
    const dueDate = sourceCivilDate(goal.dueDate);
    goals.push(
      Object.freeze({
        goalId,
        title: sourceText(goal.title, 2_000),
        goalType: sourceText(goal.goalType, 100),
        progressPercent,
        ...(dueDate === undefined ? {} : { dueDate }),
        status: sourceText(goal.status, 100),
        version,
      })
    );
  }
  return withDeclaredPerformanceProvenance(
    Object.freeze({
      employee,
      goals: Object.freeze(goals),
      provenance: detectedProvenance(workspace),
    }),
    declaredProvenance
  );
}

/** Display metadata is not native authorization or an authoritative source attestation. */
export function withDeclaredPerformanceProvenance(
  model: PerformancePersonalGoals,
  declaredProvenance?: PerformanceDataProvenance
): PerformancePersonalGoals {
  if (model.provenance !== 'UNKNOWN' || !declaredProvenance || declaredProvenance === 'UNKNOWN') {
    return model;
  }
  return Object.freeze({ ...model, provenance: declaredProvenance });
}

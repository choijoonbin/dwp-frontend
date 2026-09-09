import type {
  PersonalDayPlan,
  PersonalWorkChecklistItem,
  PersonalWorkDeleteResult,
  PersonalWorkSource,
  PersonalWorkTask,
  PersonalWorkTaskInput,
  WorkSourceReference,
} from '@dwp-frontend/shared-utils/api/personal-work-contracts';

const personalTaskId = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
const dateTime = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/u;
const personalStatuses = new Set(['OPEN', 'IN_PROGRESS', 'WAITING', 'COMPLETED', 'ARCHIVED']);
const personalPriorities = new Set(['LOW', 'NORMAL', 'HIGH', 'URGENT']);

function isCanonicalText(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.trim() === value;
}

function isTimestamp(value: unknown): value is string {
  return isCanonicalText(value) && dateTime.test(value) && Number.isFinite(Date.parse(value));
}

function isReference(value: unknown): value is WorkSourceReference {
  if (!value || typeof value !== 'object') return false;
  const reference = value as Partial<WorkSourceReference>;
  return (
    isCanonicalText(reference.sourceSystem) &&
    isCanonicalText(reference.sourceReference) &&
    (reference.obligationKey == null || isCanonicalText(reference.obligationKey))
  );
}

function sameReference(left: WorkSourceReference, right: WorkSourceReference): boolean {
  return (
    left.sourceSystem === right.sourceSystem &&
    left.sourceReference === right.sourceReference &&
    (left.obligationKey ?? null) === (right.obligationKey ?? null)
  );
}

function sourceReference(source: PersonalWorkSource | null): WorkSourceReference | null | false {
  if (source === null) return null;
  if (!source || typeof source !== 'object') return false;
  if (source.availability === 'UNAVAILABLE') {
    return source.reference === null &&
      source.title === null &&
      source.sourceRoute === null &&
      source.status === null &&
      source.dueAt === null
      ? null
      : false;
  }
  if (!isReference(source.reference)) return false;
  if (source.availability === 'REFERENCE_ONLY') {
    return source.title === null &&
      source.sourceRoute === null &&
      source.status === null &&
      source.dueAt === null
      ? source.reference
      : false;
  }
  if (
    source.availability !== 'AVAILABLE' ||
    !isCanonicalText(source.title) ||
    !isCanonicalText(source.sourceRoute) ||
    !isCanonicalText(source.status) ||
    (source.dueAt != null && !isTimestamp(source.dueAt))
  ) {
    return false;
  }
  return source.reference;
}

function isChecklistItem(value: unknown): value is PersonalWorkChecklistItem {
  if (!value || typeof value !== 'object') return false;
  const item = value as Partial<PersonalWorkChecklistItem>;
  return (
    isCanonicalText(item.itemId) &&
    typeof item.title === 'string' &&
    typeof item.completed === 'boolean'
  );
}

function sameChecklist(
  receipt: readonly PersonalWorkChecklistItem[] | undefined,
  submitted: readonly PersonalWorkChecklistItem[]
): boolean {
  const normalizedReceipt = receipt ?? [];
  return (
    normalizedReceipt.length === submitted.length &&
    normalizedReceipt.every(
      (item, index) =>
        isChecklistItem(item) &&
        item.itemId === submitted[index]?.itemId &&
        item.title === submitted[index]?.title &&
        item.completed === submitted[index]?.completed
    )
  );
}

function sameReceiptSources(left: PersonalWorkTask, right: PersonalWorkTask): boolean {
  const leftSources = receiptSources(left);
  const rightSources = receiptSources(right);
  return (
    leftSources !== false &&
    rightSources !== false &&
    leftSources.length === rightSources.length &&
    leftSources.every((reference, index) => {
      const other = rightSources[index];
      return reference === null
        ? other === null
        : other !== null && other !== undefined && sameReference(reference, other);
    })
  );
}

type SourceExpectation =
  | { state: 'PRESERVE' }
  | { state: 'REPLACE'; references: readonly WorkSourceReference[] }
  | { state: 'INVALID' };

function expectedSources(input: PersonalWorkTaskInput, creation: boolean): SourceExpectation {
  const multiple = input.sourceReferences;
  const singular = input.sourceReference;
  const clear = input.clearSourceReference === true;
  const replacesMultiple = Array.isArray(multiple);
  const replacesSingular = singular != null;
  if ([replacesMultiple, replacesSingular, clear].filter(Boolean).length > 1)
    return { state: 'INVALID' };
  if (replacesMultiple) {
    return multiple.every(isReference)
      ? { state: 'REPLACE', references: multiple }
      : { state: 'INVALID' };
  }
  if (replacesSingular) {
    return isReference(singular)
      ? { state: 'REPLACE', references: [singular] }
      : { state: 'INVALID' };
  }
  if (clear || creation) return { state: 'REPLACE', references: [] };
  return { state: 'PRESERVE' };
}

function receiptSources(
  receipt: PersonalWorkTask
): readonly (WorkSourceReference | null)[] | false {
  const singular = sourceReference(receipt.source);
  if (singular === false) return false;
  if (receipt.sources === undefined)
    return singular ? [singular] : receipt.source?.availability === 'UNAVAILABLE' ? [null] : [];
  if (!Array.isArray(receipt.sources)) return false;
  const references: Array<WorkSourceReference | null> = [];
  for (const source of receipt.sources) {
    const reference = sourceReference(source);
    if (reference === false || source === null) return false;
    references.push(reference);
  }
  if (references.length === 0) return receipt.source === null ? references : false;
  if (receipt.source === null) return false;
  const first = references[0]!;
  if (singular === null ? first !== null : first === null || !sameReference(singular, first))
    return false;
  return references;
}

function taskShape(receipt: unknown): receipt is PersonalWorkTask {
  if (!receipt || typeof receipt !== 'object') return false;
  const task = receipt as Partial<PersonalWorkTask>;
  return (
    typeof task.taskId === 'string' &&
    personalTaskId.test(task.taskId) &&
    typeof task.title === 'string' &&
    (task.description === null || typeof task.description === 'string') &&
    typeof task.status === 'string' &&
    personalStatuses.has(task.status) &&
    typeof task.priority === 'string' &&
    personalPriorities.has(task.priority) &&
    (task.dueAt === null || isTimestamp(task.dueAt)) &&
    Number.isSafeInteger(task.version) &&
    Number(task.version) >= 0 &&
    isTimestamp(task.createdAt) &&
    isTimestamp(task.updatedAt) &&
    (task.completedAt === null || isTimestamp(task.completedAt)) &&
    (task.checklist === undefined ||
      (Array.isArray(task.checklist) && task.checklist.every(isChecklistItem))) &&
    receiptSources(task as PersonalWorkTask) !== false
  );
}

function submittedFieldsMatch(
  receipt: PersonalWorkTask,
  input: PersonalWorkTaskInput,
  creation: boolean,
  reviewed?: PersonalWorkTask
): boolean {
  if (
    receipt.title !== input.title ||
    receipt.priority !== input.priority ||
    (creation
      ? receipt.description !== (input.description ?? null)
      : input.description !== undefined && receipt.description !== input.description) ||
    (creation
      ? receipt.dueAt !== (input.dueAt ?? null)
      : input.dueAt !== undefined && receipt.dueAt !== input.dueAt)
  ) {
    return false;
  }
  if (
    (creation || input.checklist != null) &&
    !sameChecklist(receipt.checklist, input.checklist ?? [])
  ) {
    return false;
  }
  const expected = expectedSources(input, creation);
  if (expected.state === 'INVALID') return false;
  if (expected.state === 'PRESERVE') {
    return reviewed !== undefined && taskShape(reviewed) && sameReceiptSources(receipt, reviewed);
  }
  const received = receiptSources(receipt);
  return (
    received !== false &&
    received.length === expected.references.length &&
    received.every(
      (reference, index) =>
        reference !== null && sameReference(reference, expected.references[index]!)
    )
  );
}

export function isPersonalTaskCreateReceipt(
  receipt: unknown,
  input: PersonalWorkTaskInput
): receipt is PersonalWorkTask {
  return (
    taskShape(receipt) &&
    receipt.status === 'OPEN' &&
    receipt.version === 0 &&
    receipt.createdAt === receipt.updatedAt &&
    receipt.completedAt === null &&
    submittedFieldsMatch(receipt, input, true)
  );
}

export function isPersonalTaskEditReceipt(
  receipt: unknown,
  taskId: string,
  input: PersonalWorkTaskInput & { version: number },
  expectedStatus: string,
  reviewed: PersonalWorkTask
): receipt is PersonalWorkTask {
  return (
    taskShape(reviewed) &&
    taskShape(receipt) &&
    reviewed.taskId === taskId &&
    reviewed.version === input.version &&
    receipt.taskId === taskId &&
    receipt.version === input.version + 1 &&
    receipt.status === expectedStatus &&
    receipt.createdAt === reviewed.createdAt &&
    Date.parse(receipt.updatedAt) >= Date.parse(reviewed.updatedAt) &&
    receipt.completedAt === reviewed.completedAt &&
    submittedFieldsMatch(receipt, input, false, reviewed)
  );
}

export function isPersonalTaskReviewedReceipt(
  receipt: unknown,
  taskId: string,
  version: number
): receipt is PersonalWorkTask {
  return taskShape(receipt) && receipt.taskId === taskId && receipt.version === version;
}

export function isPersonalTaskDeleteReceipt(
  receipt: unknown,
  reviewed: PersonalWorkTask
): receipt is PersonalWorkDeleteResult {
  if (!receipt || typeof receipt !== 'object' || Array.isArray(receipt) || !taskShape(reviewed)) {
    return false;
  }
  const deleted = receipt as Partial<PersonalWorkDeleteResult>;
  return (
    deleted.taskId === reviewed.taskId &&
    personalTaskId.test(deleted.taskId) &&
    deleted.version === reviewed.version + 1 &&
    isTimestamp(deleted.deletedAt) &&
    Date.parse(deleted.deletedAt) >= Date.parse(reviewed.updatedAt)
  );
}

export function isPersonalTaskLifecycleReceipt(
  receipt: unknown,
  reviewed: {
    taskId: string;
    title: string;
    description: string | null;
    priority: PersonalWorkTask['priority'];
    dueAt: string | null;
    status: PersonalWorkTask['status'];
    version: number;
    updatedAt: string | null;
  }
): receipt is PersonalWorkTask {
  if (
    !taskShape(receipt) ||
    receipt.taskId !== reviewed.taskId ||
    receipt.title !== reviewed.title ||
    receipt.description !== reviewed.description ||
    receipt.priority !== reviewed.priority ||
    receipt.dueAt !== reviewed.dueAt ||
    receipt.status !== reviewed.status ||
    receipt.version !== reviewed.version + 1 ||
    !isTimestamp(reviewed.updatedAt) ||
    Date.parse(receipt.updatedAt) < Date.parse(reviewed.updatedAt) ||
    Date.parse(receipt.createdAt) > Date.parse(receipt.updatedAt)
  ) {
    return false;
  }
  return reviewed.status === 'COMPLETED'
    ? receipt.completedAt === receipt.updatedAt
    : receipt.completedAt === null;
}

export function isPersonalTaskConflictReceipt(
  receipt: unknown,
  taskId: string,
  submittedVersion: number
): receipt is PersonalWorkTask {
  return taskShape(receipt) && receipt.taskId === taskId && receipt.version > submittedVersion;
}

export type PersonalTaskCommandExpectation =
  | { kind: 'CHECKLIST'; checklist: readonly PersonalWorkChecklistItem[] }
  | { kind: 'STATUS'; status: PersonalWorkTask['status'] };

/** Verifies that a command changed only the reviewed checklist or lifecycle fields. */
export function isPersonalTaskCommandReceipt(
  receipt: unknown,
  reviewed: PersonalWorkTask,
  expected: PersonalTaskCommandExpectation
): receipt is PersonalWorkTask {
  if (
    !taskShape(reviewed) ||
    !taskShape(receipt) ||
    receipt.taskId !== reviewed.taskId ||
    receipt.version !== reviewed.version + 1 ||
    receipt.title !== reviewed.title ||
    receipt.description !== reviewed.description ||
    receipt.priority !== reviewed.priority ||
    receipt.dueAt !== reviewed.dueAt ||
    receipt.createdAt !== reviewed.createdAt ||
    Date.parse(receipt.updatedAt) < Date.parse(reviewed.updatedAt) ||
    !sameReceiptSources(receipt, reviewed)
  ) {
    return false;
  }
  if (expected.kind === 'CHECKLIST') {
    return (
      receipt.status === reviewed.status &&
      receipt.completedAt === reviewed.completedAt &&
      sameChecklist(receipt.checklist, expected.checklist)
    );
  }
  return (
    receipt.status === expected.status &&
    sameChecklist(receipt.checklist, reviewed.checklist ?? []) &&
    (expected.status === 'COMPLETED'
      ? receipt.completedAt === receipt.updatedAt
      : receipt.completedAt === null)
  );
}

function isDayPlanShape(
  receipt: unknown,
  date: string,
  version: number
): receipt is PersonalDayPlan & { updatedAt: string } {
  if (!receipt || typeof receipt !== 'object') return false;
  const plan = receipt as Partial<PersonalDayPlan>;
  return (
    plan.date === date &&
    Number.isSafeInteger(plan.version) &&
    Number(plan.version) > version &&
    isTimestamp(plan.updatedAt) &&
    Array.isArray(plan.items) &&
    plan.items.every((item, index) => {
      if (!item || typeof item !== 'object') return false;
      const reference = sourceReference(item.source);
      return item.position === index && isReference(item.selectionReference) && reference !== false;
    })
  );
}

export function isPersonalDayPlanReceipt(
  receipt: unknown,
  date: string,
  version: number
): receipt is PersonalDayPlan {
  return isDayPlanShape(receipt, date, version);
}

export function isPersonalDayPlanSaveReceipt(
  receipt: unknown,
  date: string,
  version: number,
  submitted: readonly WorkSourceReference[],
  base?: PersonalDayPlan
): receipt is PersonalDayPlan {
  if (
    !isDayPlanShape(receipt, date, version) ||
    receipt.version !== version + 1 ||
    (base !== undefined &&
      (base.date !== date ||
        base.version !== version ||
        (base.updatedAt === null
          ? version !== 0 || base.items.length !== 0
          : !isTimestamp(base.updatedAt) ||
            Date.parse(receipt.updatedAt) < Date.parse(base.updatedAt)))) ||
    receipt.items.length !== submitted.length
  )
    return false;
  return receipt.items.every((item, index) => {
    const expected = submitted[index]!;
    if (expected.sourceSystem === 'DAY_PLAN_SELECTION') {
      if (!sameReference(item.selectionReference, expected)) return false;
      if (!base) return true;
      const previous = base.items.find((candidate) =>
        sameReference(candidate.selectionReference, expected)
      );
      if (!previous) return false;
      const previousSource = sourceReference(previous.source);
      const receivedSource = sourceReference(item.source);
      return (
        previousSource !== false &&
        receivedSource !== false &&
        (previousSource === null
          ? receivedSource === null
          : receivedSource !== null && sameReference(previousSource, receivedSource))
      );
    }
    const receivedSource = sourceReference(item.source);
    return (
      receivedSource !== null && receivedSource !== false && sameReference(receivedSource, expected)
    );
  });
}

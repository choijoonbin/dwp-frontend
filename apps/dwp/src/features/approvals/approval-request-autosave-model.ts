import type { ApprovalPriority } from '@dwp-frontend/shared-utils';

export type ApprovalDraftSnapshot = Readonly<{
  workflowId: string;
  formId: string;
  title: string;
  summary: string;
  priority: ApprovalPriority;
  payload: Readonly<Record<string, unknown>>;
}>;

export type ApprovalDraftReceipt = Readonly<{
  requestId: string;
  version: number;
  status: string;
}>;

export type ApprovalDraftSaveAttempt = Readonly<{
  idempotencyKey: string;
  input: ApprovalDraftSnapshot;
  requestId?: string;
  expectedVersion?: number;
}>;

export type ApprovalDraftSaveProblem = 'CONFLICT' | 'DENIED' | 'UNAVAILABLE' | 'UNKNOWN' | 'ERROR';

export type ApprovalDraftConflictField = Readonly<{
  path: string;
  localValue: unknown;
  serverValue: unknown;
}>;

export type ApprovalDraftMergeReview = Readonly<{
  merged: ApprovalDraftSnapshot;
  conflicts: readonly ApprovalDraftConflictField[];
}>;

export type ApprovalDraftReapplyResult = Readonly<{
  receipt: ApprovalDraftReceipt;
  input: ApprovalDraftSnapshot;
}>;

export type ApprovalDraftAutosaveState = Readonly<{
  status: 'LOCAL' | 'SAVING' | 'SAVED' | ApprovalDraftSaveProblem;
  dirty: boolean;
  receipt?: ApprovalDraftReceipt;
  savedAt?: number;
  latestLoaded: boolean;
  unresolved: boolean;
  conflicts: readonly ApprovalDraftConflictField[];
}>;

function ordered(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(ordered);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, entry]) => [key, ordered(entry)])
    );
  }
  return value;
}

export function approvalDraftFingerprint(input: ApprovalDraftSnapshot): string {
  return JSON.stringify(ordered(input));
}

function sameValue(left: unknown, right: unknown): boolean {
  return JSON.stringify(ordered(left)) === JSON.stringify(ordered(right));
}

function cloneValue<T>(value: T): T {
  return value === undefined ? value : structuredClone(value);
}

function mergeValue(
  path: string,
  baseline: unknown,
  local: unknown,
  server: unknown,
  conflicts: ApprovalDraftConflictField[]
): unknown {
  if (sameValue(local, server)) return cloneValue(local);
  const localChanged = !sameValue(local, baseline);
  const serverChanged = !sameValue(server, baseline);
  if (localChanged && serverChanged) {
    conflicts.push({
      path,
      localValue: cloneValue(local),
      serverValue: cloneValue(server),
    });
    return cloneValue(server);
  }
  return cloneValue(localChanged ? local : server);
}

export function approvalDraftMergeReview(input: {
  baseline: ApprovalDraftSnapshot | undefined;
  local: ApprovalDraftSnapshot;
  server: ApprovalDraftSnapshot;
  currentSchemaHash?: string;
  serverSchemaHash?: string;
}): ApprovalDraftMergeReview {
  const conflicts: ApprovalDraftConflictField[] = [];
  if (!sameValue(input.currentSchemaHash, input.serverSchemaHash)) {
    conflicts.push({
      path: '$schema',
      localValue: input.currentSchemaHash,
      serverValue: input.serverSchemaHash,
    });
  }
  const baseline = input.baseline;
  const payload: Record<string, unknown> = {};
  const payloadKeys = new Set([
    ...Object.keys(baseline?.payload ?? {}),
    ...Object.keys(input.local.payload),
    ...Object.keys(input.server.payload),
  ]);
  for (const key of [...payloadKeys].sort()) {
    const value = mergeValue(
      `payload.${key}`,
      baseline?.payload[key],
      input.local.payload[key],
      input.server.payload[key],
      conflicts
    );
    if (value !== undefined) payload[key] = value;
  }
  return {
    merged: {
      workflowId: mergeValue(
        'workflowId',
        baseline?.workflowId,
        input.local.workflowId,
        input.server.workflowId,
        conflicts
      ) as string,
      formId: mergeValue(
        'formId',
        baseline?.formId,
        input.local.formId,
        input.server.formId,
        conflicts
      ) as string,
      title: mergeValue(
        'title',
        baseline?.title,
        input.local.title,
        input.server.title,
        conflicts
      ) as string,
      summary: mergeValue(
        'summary',
        baseline?.summary,
        input.local.summary,
        input.server.summary,
        conflicts
      ) as string,
      priority: mergeValue(
        'priority',
        baseline?.priority,
        input.local.priority,
        input.server.priority,
        conflicts
      ) as ApprovalPriority,
      payload,
    },
    conflicts,
  };
}

export function approvalDraftHasContent(input: ApprovalDraftSnapshot): boolean {
  return Boolean(
    input.title.trim() ||
    input.summary.trim() ||
    Object.entries(input.payload).some(
      ([key, value]) => !['summary', 'createdFrom'].includes(key) && String(value ?? '').trim()
    )
  );
}

export class ApprovalDraftSaveBlockedError extends Error {
  constructor() {
    super('Approval draft saving requires current authority and a resolved save result.');
  }
}

export class ApprovalDraftSaveConflictError extends Error {
  constructor(readonly receipt: ApprovalDraftReceipt) {
    super('Approval draft changed after the saved command. Review before reapplying.');
  }
}

type AutosaveDependencies = Readonly<{
  save: (attempt: ApprovalDraftSaveAttempt) => Promise<ApprovalDraftReceipt>;
  reconcile: (attempt: ApprovalDraftSaveAttempt) => Promise<ApprovalDraftReceipt>;
  classify: (error: unknown) => ApprovalDraftSaveProblem;
  debounceMs?: number;
  key?: () => string;
  now?: () => number;
}>;

/** One editor session owns the queue; unknown results never allocate a replacement command. */
export class ApprovalDraftAutosave {
  private state: ApprovalDraftAutosaveState = {
    status: 'LOCAL',
    dirty: false,
    latestLoaded: false,
    unresolved: false,
    conflicts: [],
  };
  private listeners = new Set<() => void>();
  private input?: ApprovalDraftSnapshot;
  private committed?: string;
  private ready = false;
  private active = true;
  private generation = 0;
  private timer?: ReturnType<typeof setTimeout>;
  private flight?: Promise<ApprovalDraftReceipt>;
  private unresolved?: ApprovalDraftSaveAttempt;
  private committedInput?: ApprovalDraftSnapshot;
  private latest?: Readonly<{
    receipt: ApprovalDraftReceipt;
    input: ApprovalDraftSnapshot;
    currentSchemaHash?: string;
    serverSchemaHash?: string;
  }>;
  private reviewedMerge?: ApprovalDraftSnapshot;

  constructor(private readonly dependencies: AutosaveDependencies) {}

  getSnapshot = (): ApprovalDraftAutosaveState => this.state;

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  activate() {
    this.active = true;
  }

  dispose() {
    this.active = false;
    this.generation += 1;
    this.cancelTimer();
  }

  hydrate(receipt: ApprovalDraftReceipt, input: ApprovalDraftSnapshot) {
    if (this.flight || this.state.dirty || this.state.receipt) return;
    this.requireReceipt(receipt);
    this.committed = approvalDraftFingerprint(input);
    this.committedInput = structuredClone(input);
    this.publish({ receipt, status: 'SAVED', dirty: false });
  }

  update(input: ApprovalDraftSnapshot | undefined, ready: boolean) {
    this.input = input ? structuredClone(input) : undefined;
    this.ready = ready;
    const dirty = Boolean(input && approvalDraftFingerprint(input) !== this.committed);
    const status = this.blocked() || this.flight ? this.state.status : dirty ? 'LOCAL' : 'SAVED';
    this.publish({ dirty, status });
    if (this.state.status === 'CONFLICT' && this.latest) this.reviewLatestInput();
    this.cancelTimer();
    if (
      ready &&
      dirty &&
      input &&
      approvalDraftHasContent(input) &&
      !this.blocked() &&
      !this.flight
    ) {
      this.timer = setTimeout(() => {
        this.timer = undefined;
        void this.flush().catch(() => undefined);
      }, this.dependencies.debounceMs ?? 1750);
    }
  }

  async flush(): Promise<ApprovalDraftReceipt> {
    this.cancelTimer();
    if (!this.active || this.blocked() || !this.ready || !this.input) {
      throw new ApprovalDraftSaveBlockedError();
    }
    // Explicit close/submit drains edits made while the preceding request was in flight.
    if (this.flight) await this.flight;
    if (!this.active || this.blocked() || !this.ready) throw new ApprovalDraftSaveBlockedError();
    if (this.state.dirty || !this.state.receipt) {
      await this.persist();
      return this.flush();
    }
    return this.state.receipt;
  }

  async reconcile(): Promise<ApprovalDraftReceipt> {
    if (!this.active || !this.ready || !this.unresolved || this.state.status !== 'UNKNOWN') {
      throw new ApprovalDraftSaveBlockedError();
    }
    if (this.flight) return this.flight;
    const attempt = this.unresolved;
    const generation = this.generation;
    this.publish({ status: 'SAVING' });
    return this.track(
      this.dependencies.reconcile(attempt).then(
        (receipt) => this.accept(receipt, attempt, generation),
        (error) => this.fail(error, attempt, generation)
      )
    );
  }

  reviewLatest(
    receipt: ApprovalDraftReceipt,
    input?: ApprovalDraftSnapshot,
    schema: Readonly<{ currentSchemaHash?: string; serverSchemaHash?: string }> = {}
  ) {
    if (this.state.status !== 'CONFLICT' || this.flight) throw new ApprovalDraftSaveBlockedError();
    this.requireReceipt(receipt);
    if (receipt.requestId !== this.state.receipt?.requestId)
      throw new ApprovalDraftSaveBlockedError();
    if (!input) {
      this.latest = undefined;
      this.reviewedMerge = undefined;
      this.publish({
        latestLoaded: true,
        conflicts: [
          {
            path: '$document',
            localValue: this.input ? structuredClone(this.input) : undefined,
            serverValue: undefined,
          },
        ],
      });
      return;
    }
    this.latest = {
      receipt,
      input: structuredClone(input),
      currentSchemaHash: schema.currentSchemaHash,
      serverSchemaHash: schema.serverSchemaHash,
    };
    this.reviewLatestInput();
  }

  markConflict() {
    if (this.flight) throw new ApprovalDraftSaveBlockedError();
    this.latest = undefined;
    this.reviewedMerge = undefined;
    this.publish({ status: 'CONFLICT', latestLoaded: false, conflicts: [] });
  }

  reviewedInput(): ApprovalDraftSnapshot | undefined {
    return this.latest &&
      this.reviewedMerge &&
      this.state.latestLoaded &&
      this.state.conflicts.length === 0 &&
      this.state.status === 'CONFLICT'
      ? structuredClone(this.reviewedMerge)
      : undefined;
  }

  async reapply(): Promise<ApprovalDraftReapplyResult> {
    if (
      !this.latest ||
      !this.reviewedMerge ||
      !this.state.latestLoaded ||
      this.state.conflicts.length > 0 ||
      this.state.status !== 'CONFLICT'
    ) {
      throw new ApprovalDraftSaveBlockedError();
    }
    const latest = this.latest;
    const merged = structuredClone(this.reviewedMerge);
    this.unresolved = undefined;
    this.committedInput = structuredClone(latest.input);
    this.committed = approvalDraftFingerprint(latest.input);
    this.input = structuredClone(merged);
    this.latest = undefined;
    this.reviewedMerge = undefined;
    const dirty = approvalDraftFingerprint(merged) !== this.committed;
    this.publish({
      receipt: latest.receipt,
      status: dirty ? 'LOCAL' : 'SAVED',
      dirty,
      latestLoaded: false,
      unresolved: false,
      conflicts: [],
    });
    const receipt = dirty ? await this.flush() : latest.receipt;
    return { receipt, input: merged };
  }

  resume() {
    if (['UNAVAILABLE', 'ERROR', 'DENIED'].includes(this.state.status)) {
      if (this.unresolved) {
        this.publish({ status: 'UNKNOWN' });
        return;
      }
      this.publish({ status: this.state.dirty ? 'LOCAL' : 'SAVED' });
      this.update(this.input, this.ready);
    }
  }

  private async persist(): Promise<ApprovalDraftReceipt> {
    if (this.flight) return this.flight;
    if (!this.input || !this.ready || this.blocked()) throw new ApprovalDraftSaveBlockedError();
    const receipt = this.state.receipt;
    const attempt: ApprovalDraftSaveAttempt = {
      idempotencyKey: this.dependencies.key?.() ?? crypto.randomUUID(),
      input: structuredClone(this.input),
      ...(receipt ? { requestId: receipt.requestId, expectedVersion: receipt.version } : {}),
    };
    const generation = this.generation;
    this.publish({ status: 'SAVING' });
    return this.track(
      this.dependencies.save(attempt).then(
        (saved) => this.accept(saved, attempt, generation),
        (error) => this.fail(error, attempt, generation)
      )
    );
  }

  private track(promise: Promise<ApprovalDraftReceipt>): Promise<ApprovalDraftReceipt> {
    const tracked = promise.finally(() => {
      if (this.flight === tracked) this.flight = undefined;
    });
    this.flight = tracked;
    return tracked;
  }

  private accept(
    receipt: ApprovalDraftReceipt,
    attempt: ApprovalDraftSaveAttempt,
    generation: number
  ): ApprovalDraftReceipt {
    if (!this.active || generation !== this.generation) throw new ApprovalDraftSaveBlockedError();
    try {
      this.requireReceipt(receipt);
      if (
        (attempt.requestId && receipt.requestId !== attempt.requestId) ||
        (attempt.expectedVersion !== undefined && receipt.version <= attempt.expectedVersion)
      ) {
        throw new ApprovalDraftSaveBlockedError();
      }
    } catch (error) {
      this.unresolved = attempt;
      this.publish({ status: 'UNKNOWN', unresolved: true });
      throw error;
    }
    this.committed = approvalDraftFingerprint(attempt.input);
    this.committedInput = structuredClone(attempt.input);
    this.unresolved = undefined;
    const dirty = Boolean(this.input && approvalDraftFingerprint(this.input) !== this.committed);
    this.publish({
      receipt,
      dirty,
      status: dirty ? 'LOCAL' : 'SAVED',
      savedAt: this.dependencies.now?.() ?? Date.now(),
      unresolved: false,
      conflicts: [],
    });
    return receipt;
  }

  private fail(error: unknown, attempt: ApprovalDraftSaveAttempt, generation: number): never {
    if (this.active && generation === this.generation) {
      const status = this.dependencies.classify(error);
      if (error instanceof ApprovalDraftSaveConflictError && error.receipt.status === 'DRAFT') {
        this.publish({ receipt: error.receipt });
      }
      this.latest = undefined;
      this.reviewedMerge = undefined;
      this.unresolved =
        status === 'UNKNOWN' || (this.unresolved === attempt && status !== 'CONFLICT')
          ? attempt
          : undefined;
      this.publish({
        status,
        latestLoaded: false,
        unresolved: Boolean(this.unresolved),
        conflicts: [],
      });
    }
    throw error;
  }

  private requireReceipt(receipt: ApprovalDraftReceipt) {
    if (
      !receipt.requestId ||
      !Number.isSafeInteger(receipt.version) ||
      receipt.version < 0 ||
      receipt.status !== 'DRAFT'
    ) {
      throw new ApprovalDraftSaveBlockedError();
    }
  }

  private blocked() {
    return ['CONFLICT', 'DENIED', 'UNAVAILABLE', 'UNKNOWN', 'ERROR'].includes(this.state.status);
  }

  private reviewLatestInput() {
    if (!this.latest || !this.input || this.state.status !== 'CONFLICT') {
      this.reviewedMerge = undefined;
      this.publish({ latestLoaded: false, conflicts: [] });
      return;
    }
    const review = approvalDraftMergeReview({
      baseline: this.committedInput,
      local: this.input,
      server: this.latest.input,
      currentSchemaHash: this.latest.currentSchemaHash,
      serverSchemaHash: this.latest.serverSchemaHash,
    });
    this.reviewedMerge = structuredClone(review.merged);
    this.publish({ latestLoaded: true, conflicts: review.conflicts });
  }

  private cancelTimer() {
    if (this.timer) clearTimeout(this.timer);
    this.timer = undefined;
  }

  private publish(patch: Partial<ApprovalDraftAutosaveState>) {
    const next = { ...this.state, ...patch };
    if (
      Object.entries(next).every(
        ([key, value]) => value === this.state[key as keyof ApprovalDraftAutosaveState]
      )
    )
      return;
    this.state = next;
    if (this.active) for (const listener of this.listeners) listener();
  }
}

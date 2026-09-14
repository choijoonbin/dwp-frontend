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

export type ApprovalDraftAutosaveState = Readonly<{
  status: 'LOCAL' | 'SAVING' | 'SAVED' | ApprovalDraftSaveProblem;
  dirty: boolean;
  receipt?: ApprovalDraftReceipt;
  savedAt?: number;
  latestLoaded: boolean;
  unresolved: boolean;
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
  private latest?: ApprovalDraftReceipt;

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
    this.publish({ receipt, status: 'SAVED', dirty: false });
  }

  update(input: ApprovalDraftSnapshot | undefined, ready: boolean) {
    this.input = input ? structuredClone(input) : undefined;
    this.ready = ready;
    const dirty = Boolean(input && approvalDraftFingerprint(input) !== this.committed);
    const status = this.blocked() || this.flight ? this.state.status : dirty ? 'LOCAL' : 'SAVED';
    this.publish({ dirty, status });
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

  reviewLatest(receipt: ApprovalDraftReceipt) {
    if (this.state.status !== 'CONFLICT' || this.flight) throw new ApprovalDraftSaveBlockedError();
    this.requireReceipt(receipt);
    if (receipt.requestId !== this.state.receipt?.requestId)
      throw new ApprovalDraftSaveBlockedError();
    this.latest = receipt;
    this.publish({ latestLoaded: true });
  }

  markConflict() {
    if (this.flight) throw new ApprovalDraftSaveBlockedError();
    this.publish({ status: 'CONFLICT', latestLoaded: false });
  }

  async reapply(): Promise<ApprovalDraftReceipt> {
    if (!this.latest || !this.state.latestLoaded || this.state.status !== 'CONFLICT') {
      throw new ApprovalDraftSaveBlockedError();
    }
    this.unresolved = undefined;
    this.publish({ receipt: this.latest, status: 'LOCAL', latestLoaded: false, unresolved: false });
    this.latest = undefined;
    return this.flush();
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
    this.unresolved = undefined;
    const dirty = Boolean(this.input && approvalDraftFingerprint(this.input) !== this.committed);
    this.publish({
      receipt,
      dirty,
      status: dirty ? 'LOCAL' : 'SAVED',
      savedAt: this.dependencies.now?.() ?? Date.now(),
      unresolved: false,
    });
    return receipt;
  }

  private fail(error: unknown, attempt: ApprovalDraftSaveAttempt, generation: number): never {
    if (this.active && generation === this.generation) {
      const status = this.dependencies.classify(error);
      if (error instanceof ApprovalDraftSaveConflictError && error.receipt.status === 'DRAFT') {
        this.publish({ receipt: error.receipt });
      }
      this.unresolved =
        status === 'UNKNOWN' || (this.unresolved === attempt && status !== 'CONFLICT')
          ? attempt
          : undefined;
      this.publish({ status, latestLoaded: false, unresolved: Boolean(this.unresolved) });
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

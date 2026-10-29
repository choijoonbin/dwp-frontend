// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { act, createElement, useLayoutEffect } from 'react';
import { flushSync } from 'react-dom';
import { createRoot, type Root } from 'react-dom/client';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import enHcm from '../../../../../../../../libs/shared-i18n/src/locales/en/hcm.json';

import {
  CanonicalTimecardWorkspace,
  TIMECARD_API_CONTRACTS,
  TIMECARD_AUTHORIZATION_CONTRACT,
  TIMECARD_STATES,
  TimecardCommandOutcomeUnknownError,
  assertTimecardOperationScope,
  assertTimecardReceiptBinding,
  assertTimecardReceiptProgression,
  correctTimecard,
  decideTimecard,
  parseTimecard,
  parseTimecardSnapshot,
  parseTimeCommandReceipt,
  readTimecard,
  readTimeCommandReceipt,
  submitTimecard,
  timecardCommandAllowed,
  timecardStateAfterCommand,
} from '../../index';

import { HttpError, HttpTransportError } from '@dwp-frontend/shared-utils';
import type {
  TimecardDataSource,
  TimecardHttpClient,
  TimecardOperationScope,
  TimecardSnapshot,
} from '../../index';

import {
  TIMECARD_ID,
  WORKER_ID,
  ACTOR_ID,
  RECEIPT_ID,
  OTHER_TIMECARD_ID,
  IDEMPOTENCY_KEY,
  REFRESHED_IDEMPOTENCY_KEY,
  OPAQUE_ETAG,
  timecardSource,
  snapshot,
  scope,
  receiptSource,
  authorityFor,
  ownerBinding,
  buttonByText,
  inputByLabel,
  setInputValue,
  flush,
} from './base-tfr-tim-017.test-support';

describe('[SLICE:BASE-TFR-TIM-017] canonical timecard workspace', () => {
  let host: HTMLDivElement;
  let root: Root;

  beforeAll(async () => {
    await i18n.use(initReactI18next).init({
      lng: 'en',
      fallbackLng: 'en',
      defaultNS: 'hcm',
      ns: ['hcm'],
      resources: { en: { hcm: enHcm } },
      interpolation: { escapeValue: false },
    });
  });

  beforeEach(() => {
    host = document.createElement('div');
    document.body.append(host);
    root = createRoot(host);
    (
      globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
  });

  afterEach(() => {
    act(() => root.unmount());
    host.remove();
    vi.restoreAllMocks();
  });

  it('pins the five browser PEPs and the corrected v42 contract evidence', () => {
    expect(TIMECARD_API_CONTRACTS).toEqual([
      {
        bindingId: 'PEP-TIM-011',
        method: 'GET',
        path: '/api/time/v1/timecards/{timecardId}',
      },
      {
        bindingId: 'PEP-TIM-012',
        method: 'POST',
        path: '/api/time/v1/timecards/{timecardId}/corrections',
      },
      {
        bindingId: 'PEP-TIM-013',
        method: 'POST',
        path: '/api/time/v1/timecards/{timecardId}/submit',
      },
      {
        bindingId: 'PEP-TIM-014',
        method: 'POST',
        path: '/api/time/v1/timecards/{timecardId}/decisions',
      },
      {
        bindingId: 'PEP-TIM-028',
        method: 'GET',
        path: '/api/time/v1/command-receipts/{receiptId}',
      },
    ]);
    expect(TIMECARD_AUTHORIZATION_CONTRACT).toMatchObject({
      version: 42,
      sha256: 'f73f9a64816ac8f5567a2a7c292821f4a40e6d675915ebc3c3ac8aad7d1fd983',
      gatewayOpenApiSha256: '50a57ad5aa93178f47d724ca3dfa08a64985de93a099071db66220dfe686c2a2',
      timeOpenApiSha256: '6702161141add3acde02896bb6844e5e40c6c6c0dc4b93eab859e77e9446f0e5',
      trustedHeadersFromBrowser: [],
    });
  });

  it('parses exactly eight states, an eight-field DTO, and an opaque ETag without version coupling', () => {
    expect(TIMECARD_STATES).toEqual([
      'OPEN',
      'SUBMITTED',
      'APPROVED',
      'REJECTED',
      'CORRECTION_REQUIRED',
      'LOCKED',
      'CLOSED',
      'SUPERSEDED',
    ]);
    for (const state of TIMECARD_STATES) {
      expect(parseTimecard(timecardSource(state)).state).toBe(state);
    }

    const parsed = parseTimecardSnapshot(timecardSource('OPEN', { version: 91 }), OPAQUE_ETAG);
    expect(parsed.etag).toBe(OPAQUE_ETAG);
    expect(parsed.timecard.version).toBe(91);
    expect(() => parseTimecard({ ...timecardSource(), history: [] })).toThrow(
      'Invalid canonical TIM timecard response.'
    );
    const partial = timecardSource();
    delete partial.ledgerRevision;
    expect(() => parseTimecard(partial)).toThrow('Invalid canonical TIM timecard response.');
    expect(parseTimecardSnapshot(timecardSource(), 'opaque-unquoted-v7').etag).toBe(
      'opaque-unquoted-v7'
    );
    expect(() => parseTimecardSnapshot(timecardSource(), '"seal"\r\nX-Forged: yes')).toThrow(
      'Invalid canonical TIM timecard ETag.'
    );
  });

  it('enforces exact scope shape, state transitions, population gates, and local no-self decision', () => {
    expect(() => assertTimecardOperationScope(scope())).not.toThrow();
    expect(() => assertTimecardOperationScope(scope('SELF', { contextScopeKey: 'ab' }))).toThrow(
      'Invalid canonical TIM operation scope.'
    );
    expect(() =>
      assertTimecardOperationScope(scope('SELF', { contextScopeKey: `a${'.'.repeat(200)}` }))
    ).toThrow('Invalid canonical TIM operation scope.');

    const open = parseTimecard(timecardSource('OPEN'));
    const submitted = parseTimecard(timecardSource('SUBMITTED'));
    expect(timecardCommandAllowed('CORRECT', open, scope('SELF'))).toBe(true);
    expect(timecardCommandAllowed('CORRECT', open, scope('TARGET_POPULATION'))).toBe(true);
    expect(timecardCommandAllowed('SUBMIT', open, scope('SELF'))).toBe(true);
    expect(timecardCommandAllowed('SUBMIT', open, scope('TARGET_POPULATION'))).toBe(false);
    expect(timecardCommandAllowed('DECIDE', submitted, scope('TARGET_POPULATION'))).toBe(true);
    expect(
      timecardCommandAllowed(
        'DECIDE',
        submitted,
        scope('TARGET_POPULATION', { actorWorkerId: submitted.workerId })
      )
    ).toBe(false);
    expect(
      timecardStateAfterCommand('SUBMITTED', {
        kind: 'DECIDE',
        body: { decision: 'REQUIRE_CORRECTION', reasonCode: 'NEEDS_FIX' },
      })
    ).toBe('CORRECTION_REQUIRED');
    expect(
      timecardStateAfterCommand('CLOSED', {
        kind: 'CORRECT',
        body: {
          reasonCode: 'NO_BYPASS',
          entries: [{ workDate: '2026-10-01', payCode: 'REGULAR', minutes: 1 }],
        },
      })
    ).toBeNull();
  });

  it('uses raw GET DTOs, preserves the opaque ETag, and binds receipt lookup to its public PEP', async () => {
    const get = vi.fn<TimecardHttpClient['get']>();
    const post = vi.fn<TimecardHttpClient['post']>();
    const client: TimecardHttpClient = { get, post };
    const signal = new AbortController().signal;
    const requestScope = scope();
    get
      .mockResolvedValueOnce({
        data: timecardSource(),
        headers: { etag: OPAQUE_ETAG },
        status: 200,
      })
      .mockResolvedValueOnce({
        data: receiptSource('SUBMIT', 'RUNNING'),
        status: 200,
      });

    await expect(readTimecard(TIMECARD_ID, requestScope, signal, client)).resolves.toEqual(
      snapshot()
    );
    expect(get).toHaveBeenNthCalledWith(1, `/api/time/v1/timecards/${TIMECARD_ID}`, {
      contextScopeKey: requestScope.contextScopeKey,
      signal,
    });

    await expect(readTimeCommandReceipt(RECEIPT_ID, requestScope, signal, client)).resolves.toEqual(
      parseTimeCommandReceipt(receiptSource('SUBMIT', 'RUNNING'))
    );
    expect(get).toHaveBeenNthCalledWith(2, `/api/time/v1/command-receipts/${RECEIPT_ID}`, {
      contextScopeKey: requestScope.contextScopeKey,
      signal,
    });
    expect(post).not.toHaveBeenCalled();
  });

  it('dispatches all three raw commands with exact CAS headers and no trusted or step-up headers', async () => {
    const get = vi.fn<TimecardHttpClient['get']>();
    const post = vi.fn<TimecardHttpClient['post']>(async (url) => ({
      data: receiptSource(
        url.endsWith('/corrections') ? 'CORRECT' : url.endsWith('/submit') ? 'SUBMIT' : 'DECIDE',
        'ACCEPTED'
      ),
      status: 202,
    }));
    const client: TimecardHttpClient = { get, post };
    const signal = new AbortController().signal;
    const selfScope = scope('SELF');
    const managerScope = scope('TARGET_POPULATION');

    await correctTimecard(
      snapshot(),
      {
        reasonCode: 'CORRECTION',
        entries: [{ workDate: '2026-10-02', payCode: 'REGULAR', minutes: -30 }],
      },
      IDEMPOTENCY_KEY,
      selfScope,
      authorityFor(selfScope),
      signal,
      client
    );
    await submitTimecard(
      snapshot(),
      {},
      IDEMPOTENCY_KEY,
      selfScope,
      authorityFor(selfScope),
      signal,
      client
    );
    await decideTimecard(
      snapshot('SUBMITTED'),
      { decision: 'APPROVE', reasonCode: 'REVIEWED', comment: '' },
      IDEMPOTENCY_KEY,
      managerScope,
      authorityFor(managerScope),
      signal,
      client
    );

    expect(post.mock.calls.map(([url]) => url)).toEqual([
      `/api/time/v1/timecards/${TIMECARD_ID}/corrections`,
      `/api/time/v1/timecards/${TIMECARD_ID}/submit`,
      `/api/time/v1/timecards/${TIMECARD_ID}/decisions`,
    ]);
    for (const [, , config] of post.mock.calls) {
      expect(config).toEqual({
        contextScopeKey: expect.any(String),
        signal,
        csrfReplay: 'NEVER',
        headers: {
          'X-DWP-Expected-Decision-Revision': 'decision-revision-42',
          'Idempotency-Key': IDEMPOTENCY_KEY,
          'If-Match': OPAQUE_ETAG,
        },
      });
      expect(config.headers).not.toHaveProperty('X-Purpose-Code');
      expect(config.headers).not.toHaveProperty('X-DWP-Population-Kind');
      expect(config.headers).not.toHaveProperty('X-DWP-Step-Up-Challenge');
      expect(config.headers).not.toHaveProperty('X-DWP-Expected-Object-Version');
    }
    expect(get).not.toHaveBeenCalled();
  });

  it('requires explicit 200/202 success statuses and rejects envelope or hostile receipt binding', async () => {
    const signal = new AbortController().signal;
    const requestScope = scope();
    const wrongGet: TimecardHttpClient = {
      get: vi.fn(() =>
        Promise.resolve({ data: timecardSource(), headers: { etag: OPAQUE_ETAG }, status: 202 })
      ),
      post: vi.fn(),
    };
    await expect(readTimecard(TIMECARD_ID, requestScope, signal, wrongGet)).rejects.toThrow(
      'Invalid TIM timecard success status.'
    );
    const missingGetStatus = {
      get: vi.fn(() => Promise.resolve({ data: timecardSource(), headers: { etag: OPAQUE_ETAG } })),
      post: vi.fn(),
    } as unknown as TimecardHttpClient;
    await expect(readTimecard(TIMECARD_ID, requestScope, signal, missingGetStatus)).rejects.toThrow(
      'Invalid TIM timecard success status.'
    );
    const wrongReceiptStatus: TimecardHttpClient = {
      get: vi.fn(() => Promise.resolve({ data: receiptSource('SUBMIT', 'RUNNING'), status: 202 })),
      post: vi.fn(),
    };
    await expect(
      readTimeCommandReceipt(RECEIPT_ID, requestScope, signal, wrongReceiptStatus)
    ).rejects.toThrow('Invalid TIM receipt success status.');
    const missingReceiptStatus = {
      get: vi.fn(() => Promise.resolve({ data: receiptSource('SUBMIT', 'RUNNING') })),
      post: vi.fn(),
    } as unknown as TimecardHttpClient;
    await expect(
      readTimeCommandReceipt(RECEIPT_ID, requestScope, signal, missingReceiptStatus)
    ).rejects.toThrow('Invalid TIM receipt success status.');
    const wrongReceiptIdentity: TimecardHttpClient = {
      get: vi.fn(() =>
        Promise.resolve({
          data: receiptSource('SUBMIT', 'RUNNING', { receiptId: OTHER_TIMECARD_ID }),
          status: 200,
        })
      ),
      post: vi.fn(),
    };
    await expect(
      readTimeCommandReceipt(RECEIPT_ID, requestScope, signal, wrongReceiptIdentity)
    ).rejects.toThrow('Invalid TIM receipt resource binding.');

    const envelopeClient: TimecardHttpClient = {
      get: vi.fn(() =>
        Promise.resolve({
          data: { status: 'SUCCESS', data: timecardSource() },
          headers: { etag: OPAQUE_ETAG },
          status: 200,
        })
      ),
      post: vi.fn(),
    };
    await expect(readTimecard(TIMECARD_ID, requestScope, signal, envelopeClient)).rejects.toThrow(
      'Invalid canonical TIM timecard response.'
    );

    const wrongPost: TimecardHttpClient = {
      get: vi.fn(),
      post: vi.fn(() =>
        Promise.resolve({ data: receiptSource('SUBMIT', 'ACCEPTED'), status: 200 })
      ),
    };
    await expect(
      submitTimecard(
        snapshot(),
        {},
        IDEMPOTENCY_KEY,
        requestScope,
        authorityFor(requestScope),
        signal,
        wrongPost
      )
    ).rejects.toBeInstanceOf(TimecardCommandOutcomeUnknownError);
    const missingPostStatus = {
      get: vi.fn(),
      post: vi.fn(() => Promise.resolve({ data: receiptSource('SUBMIT', 'ACCEPTED') })),
    } as unknown as TimecardHttpClient;
    await expect(
      submitTimecard(
        snapshot(),
        {},
        IDEMPOTENCY_KEY,
        requestScope,
        authorityFor(requestScope),
        signal,
        missingPostStatus
      )
    ).rejects.toBeInstanceOf(TimecardCommandOutcomeUnknownError);

    const arbitraryCommandType = parseTimeCommandReceipt(
      receiptSource('CORRECT', 'ACCEPTED', { commandType: 'FUTURE_OWNER_OPERATION' })
    );
    expect(() =>
      assertTimecardReceiptBinding(arbitraryCommandType, 'CORRECT', TIMECARD_ID)
    ).not.toThrow();
    expect(() =>
      assertTimecardReceiptBinding(
        parseTimeCommandReceipt(
          receiptSource('CORRECT', 'ACCEPTED', {
            originatingAction: 'TIME_TIMECARD_SUBMIT',
          })
        ),
        'CORRECT',
        TIMECARD_ID
      )
    ).toThrow('Invalid canonical TIM timecard receipt binding.');
    expect(() =>
      assertTimecardReceiptBinding(
        parseTimeCommandReceipt(
          receiptSource('CORRECT', 'ACCEPTED', { timecardId: OTHER_TIMECARD_ID })
        ),
        'CORRECT',
        TIMECARD_ID
      )
    ).toThrow('Invalid canonical TIM timecard receipt binding.');
  });

  it('accepts monotonic same-receipt recovery and rejects a forged replay identity', () => {
    const accepted = parseTimeCommandReceipt(receiptSource('CORRECT', 'ACCEPTED'));
    const succeeded = parseTimeCommandReceipt(receiptSource('CORRECT', 'SUCCEEDED'));
    expect(() => assertTimecardReceiptProgression(accepted, succeeded)).not.toThrow();
    expect(() =>
      assertTimecardReceiptProgression(
        accepted,
        parseTimeCommandReceipt(
          receiptSource('CORRECT', 'SUCCEEDED', { requestDigest: 'b'.repeat(64) })
        )
      )
    ).toThrow('Invalid canonical TIM timecard receipt replay.');
    expect(() =>
      assertTimecardReceiptProgression(
        accepted,
        parseTimeCommandReceipt(
          receiptSource('CORRECT', 'SUCCEEDED', { commandType: 'ADJACENT_COMMAND' })
        )
      )
    ).toThrow('Invalid canonical TIM timecard receipt replay.');
  });

  it('stays unmounted and fail-closed for missing owner contracts or malformed scope', async () => {
    const read = vi.fn<TimecardDataSource['read']>(() => Promise.resolve(snapshot()));
    const dataSource: TimecardDataSource = {
      read,
      correct: vi.fn(),
      submit: vi.fn(),
      decide: vi.fn(),
      receipt: vi.fn(),
    };

    await act(async () => {
      root.render(
        createElement(CanonicalTimecardWorkspace, {
          timecardId: TIMECARD_ID,
          scope: scope(),
          dataSource,
        })
      );
      await flush();
    });
    expect(read).not.toHaveBeenCalled();
    expect(host.textContent).toContain('Canonical timecard is not connected');
    expect(host.textContent).toContain('legacy');

    await act(async () => {
      root.render(
        createElement(CanonicalTimecardWorkspace, {
          timecardId: TIMECARD_ID,
          scope: scope('SELF', { contextScopeKey: 'bad scope' }),
          ownerBinding: ownerBinding(scope()),
          dataSource,
        })
      );
      await flush();
    });
    expect(read).not.toHaveBeenCalled();
    expect(host.textContent).toContain('access context is unavailable');

    const partialScope = scope('SELF', {
      contextScopeKey: 'scope.tim-017-partial',
      decisionRevision: 'decision-revision-partial',
    });
    const partialRead = vi.fn<TimecardDataSource['read']>(() =>
      Promise.reject(new Error('The canonical response omitted a required field.'))
    );
    await act(async () => {
      root.render(
        createElement(CanonicalTimecardWorkspace, {
          timecardId: TIMECARD_ID,
          scope: partialScope,
          ownerBinding: ownerBinding(partialScope),
          dataSource: { ...dataSource, read: partialRead },
        })
      );
      await flush();
    });
    expect(partialRead).toHaveBeenCalledTimes(1);
    expect(host.textContent).toContain('response could not be verified');
    expect(host.textContent).not.toContain('Record correction');
  });

  it('renders an accessible responsive eight-state summary and only state-aware actions', async () => {
    const requestScope = scope();
    const dataSource: TimecardDataSource = {
      read: vi.fn(() => Promise.resolve(snapshot())),
      correct: vi.fn(),
      submit: vi.fn(),
      decide: vi.fn(),
      receipt: vi.fn(),
    };

    await act(async () => {
      root.render(
        createElement(CanonicalTimecardWorkspace, {
          timecardId: TIMECARD_ID,
          scope: requestScope,
          ownerBinding: ownerBinding(requestScope),
          dataSource,
        })
      );
      await flush();
    });

    expect(host.querySelector('main[aria-labelledby="canonical-timecard-title"]')).not.toBeNull();
    expect(host.querySelector('h1')?.textContent).toBe('Canonical timecard');
    expect(
      host.querySelectorAll('ol[aria-labelledby="timecard-state-model-title"] > li')
    ).toHaveLength(8);
    expect(host.querySelector('li[aria-current="step"]')?.textContent).toContain('Open');
    expect(buttonByText(host, 'Record correction').disabled).toBe(false);
    expect(buttonByText(host, 'Submit timecard').disabled).toBe(false);
    expect(host.textContent).not.toContain('Record independent decision');
    expect(host.textContent).not.toContain('history');
    expect(host.textContent).not.toContain('availableActions');

    const opener = buttonByText(host, 'Record correction');
    opener.focus();
    act(() => opener.click());
    await act(flush);
    const dialog = document.querySelector('[role="dialog"]');
    if (!(dialog instanceof HTMLElement)) throw new Error('Correction dialog did not open');
    const titleId = dialog.getAttribute('aria-labelledby');
    const descriptionId = dialog.getAttribute('aria-describedby');
    expect(titleId && document.getElementById(titleId)?.textContent).toBe(
      'Record an immutable correction'
    );
    expect(descriptionId && document.getElementById(descriptionId)?.textContent).toContain(
      'Period 2026-10-01 to 2026-10-14'
    );
    expect(dialog.contains(document.activeElement)).toBe(true);
    act(() => dialog.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true })));
    expect(dialog.contains(document.activeElement)).toBe(true);
    await act(async () => {
      dialog.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      await new Promise((resolveTimer) => setTimeout(resolveTimer, 250));
    });
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    expect(document.activeElement).toBe(opener);
  });

  it('clears a dialog draft when any operation-scope identity field changes', async () => {
    const read = vi.fn<TimecardDataSource['read']>(() => Promise.resolve(snapshot()));
    const dataSource: TimecardDataSource = {
      read,
      correct: vi.fn(),
      submit: vi.fn(),
      decide: vi.fn(),
      receipt: vi.fn(),
    };
    const renderScope = async (requestScope: TimecardOperationScope) => {
      await act(async () => {
        root.render(
          createElement(CanonicalTimecardWorkspace, {
            timecardId: TIMECARD_ID,
            scope: requestScope,
            ownerBinding: ownerBinding(requestScope),
            dataSource,
          })
        );
        await flush();
      });
    };
    const openDraft = async (minutes: string) => {
      act(() => buttonByText(host, 'Record correction').click());
      await act(flush);
      expect(document.querySelector('[role="dialog"]')).not.toBeNull();
      act(() => setInputValue(inputByLabel('Minute adjustment'), minutes));
      expect(inputByLabel('Minute adjustment').value).toBe(minutes);
    };

    const initialScope = scope();
    await renderScope(initialScope);
    await openDraft('15');

    const actorChangedScope = { ...initialScope, actorWorkerId: ACTOR_ID };
    await renderScope(actorChangedScope);
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    await openDraft('30');

    const populationChangedScope = {
      ...actorChangedScope,
      populationKind: 'TARGET_POPULATION' as const,
    };
    await renderScope(populationChangedScope);
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    await openDraft('45');

    await renderScope({ ...populationChangedScope, ready: false });
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    expect(host.textContent).toContain('access context is unavailable');

    await renderScope(populationChangedScope);
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    expect(host.textContent).toContain('Canonical timecard');
    expect(read).toHaveBeenCalledTimes(4);
  });

  it('hides a prior READY snapshot synchronously before new-scope effects run', async () => {
    let resolveNext: ((value: TimecardSnapshot) => void) | undefined;
    const nextSnapshot = new Promise<TimecardSnapshot>((resolve) => {
      resolveNext = resolve;
    });
    const initialScope = scope();
    const nextScope = { ...initialScope, actorWorkerId: ACTOR_ID };
    const read = vi
      .fn<TimecardDataSource['read']>()
      .mockResolvedValueOnce(snapshot())
      .mockReturnValueOnce(nextSnapshot);
    const dataSource: TimecardDataSource = {
      read,
      correct: vi.fn(),
      submit: vi.fn(),
      decide: vi.fn(),
      receipt: vi.fn(),
    };
    const immediateCommits: Array<{
      dialogVisible: boolean;
      readCalls: number;
      text: string;
    }> = [];
    function ImmediateCommitProbe({ requestScope }: { requestScope: TimecardOperationScope }) {
      useLayoutEffect(() => {
        immediateCommits.push({
          dialogVisible: document.querySelector('[role="dialog"]') !== null,
          readCalls: read.mock.calls.length,
          text: host.textContent ?? '',
        });
      }, [requestScope]);
      return createElement(CanonicalTimecardWorkspace, {
        timecardId: TIMECARD_ID,
        scope: requestScope,
        ownerBinding: ownerBinding(requestScope),
        dataSource,
      });
    }

    await act(async () => {
      root.render(createElement(ImmediateCommitProbe, { requestScope: initialScope }));
      await flush();
    });
    act(() => buttonByText(host, 'Record correction').click());
    expect(document.querySelector('[role="dialog"]')).not.toBeNull();
    expect(host.textContent).toContain('Aggregate version7');

    act(() => {
      flushSync(() => {
        root.render(createElement(ImmediateCommitProbe, { requestScope: nextScope }));
      });
    });

    const immediateScopeCommit = immediateCommits[immediateCommits.length - 1];
    expect(immediateScopeCommit).toEqual({
      dialogVisible: false,
      readCalls: 1,
      text: expect.stringContaining('Loading canonical timecard'),
    });
    expect(immediateScopeCommit?.text).not.toContain('Aggregate version7');
    expect(immediateScopeCommit?.text).not.toContain(WORKER_ID);
    expect(read).toHaveBeenCalledTimes(2);
    await act(async () => {
      resolveNext?.(snapshot());
      await flush();
    });
    expect(host.textContent).toContain('Aggregate version7');
    expect(document.querySelector('[role="dialog"]')).toBeNull();
  });

  it('declares high-contrast, reduced-motion, and 200-percent zoom safeguards', () => {
    const workspaceSource = readFileSync(
      resolve(
        process.cwd(),
        'apps/dwp/src/features/hris/time/pages/canonical-timecard-workspace.tsx'
      ),
      'utf8'
    );
    const dialogSource = readFileSync(
      resolve(
        process.cwd(),
        'apps/dwp/src/features/hris/time/components/timecard-command-dialogs.tsx'
      ),
      'utf8'
    );
    const summarySource = readFileSync(
      resolve(process.cwd(), 'apps/dwp/src/features/hris/time/components/timecard-summary.tsx'),
      'utf8'
    );

    expect(workspaceSource).toContain('@media (forced-colors: active)');
    expect(workspaceSource).toContain('CanvasText');
    expect(workspaceSource).toContain('@media (prefers-reduced-motion: reduce)');
    expect(workspaceSource).toContain("width: '100%'");
    expect(dialogSource).toContain('mobileFullScreen');
    expect(dialogSource).toContain("maxWidth: 'min(calc(100% - 2rem), 40rem)'");
    expect(summarySource).toContain(
      "gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 13rem), 1fr))'"
    );
  });

  it('preserves dialog input and one idempotency key through unknown-outcome retry and receipt recovery', async () => {
    const requestScope = scope();
    const correct = vi
      .fn<TimecardDataSource['correct']>()
      .mockRejectedValueOnce(new Error('connection reset after dispatch'))
      .mockResolvedValueOnce(parseTimeCommandReceipt(receiptSource('CORRECT', 'RESULT_UNKNOWN')));
    const receipt = vi.fn<TimecardDataSource['receipt']>(() =>
      Promise.resolve(parseTimeCommandReceipt(receiptSource('CORRECT', 'SUCCEEDED')))
    );
    const read = vi.fn<TimecardDataSource['read']>(() => Promise.resolve(snapshot()));
    const dataSource: TimecardDataSource = {
      read,
      correct,
      submit: vi.fn(),
      decide: vi.fn(),
      receipt,
    };

    await act(async () => {
      root.render(
        createElement(CanonicalTimecardWorkspace, {
          timecardId: TIMECARD_ID,
          scope: requestScope,
          ownerBinding: ownerBinding(requestScope),
          dataSource,
          idFactory: () => IDEMPOTENCY_KEY,
        })
      );
      await flush();
    });

    const correctionButton = buttonByText(host, 'Record correction');
    correctionButton.focus();
    act(() => correctionButton.click());
    const dialog = document.querySelector('[role="dialog"]');
    if (!(dialog instanceof HTMLElement)) throw new Error('Correction dialog did not open');
    act(() => setInputValue(inputByLabel('Minute adjustment'), '60'));
    expect(inputByLabel('Minute adjustment').value).toBe('60');

    await act(async () => {
      buttonByText(dialog, 'Record correction').click();
      await flush();
    });
    expect(correct).toHaveBeenCalledTimes(1);
    expect(document.body.textContent).toContain('outcome is not confirmed');
    expect(document.querySelector('[role="alert"][aria-live="assertive"]')).not.toBeNull();
    expect(inputByLabel('Minute adjustment').value).toBe('60');

    await act(async () => {
      buttonByText(document, 'Retry exact command').click();
      await flush();
    });
    expect(correct).toHaveBeenCalledTimes(2);
    expect(correct.mock.calls[0]?.[2]).toBe(IDEMPOTENCY_KEY);
    expect(correct.mock.calls[1]?.[2]).toBe(IDEMPOTENCY_KEY);
    expect(document.body.textContent).toContain('The command outcome is not confirmed');

    await act(async () => {
      buttonByText(document, 'Check existing receipt').click();
      await flush();
      await flush();
    });
    expect(receipt).toHaveBeenCalledWith(RECEIPT_ID, requestScope, expect.any(AbortSignal));
    expect(read).toHaveBeenCalledTimes(2);
    expect(host.textContent).toContain('Command completed');
    expect(host.querySelector('[role="status"][aria-live="polite"]')).not.toBeNull();
    await act(() => new Promise((resolve) => setTimeout(resolve, 250)));
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    expect(document.activeElement).toBe(correctionButton);
  });

  it('keeps a conflict draft through failed refresh and dispatches only with a refreshed ETag', async () => {
    const requestScope = scope();
    const refreshed = snapshot('OPEN', '"tim-v8-new-seal"');
    const read = vi
      .fn<TimecardDataSource['read']>()
      .mockResolvedValueOnce(snapshot())
      .mockRejectedValueOnce(new HttpTransportError('NETWORK'))
      .mockResolvedValueOnce({
        ...refreshed,
        timecard: { ...refreshed.timecard, version: 8 },
      })
      .mockRejectedValueOnce(new HttpError('Canonical access was revoked.', 403));
    const correct = vi
      .fn<TimecardDataSource['correct']>()
      .mockRejectedValueOnce(new HttpError('Canonical version changed.', 412))
      .mockResolvedValueOnce(parseTimeCommandReceipt(receiptSource('CORRECT', 'ACCEPTED')));
    const idFactory = vi
      .fn<() => string>()
      .mockReturnValueOnce(IDEMPOTENCY_KEY)
      .mockReturnValueOnce(REFRESHED_IDEMPOTENCY_KEY);
    const dataSource: TimecardDataSource = {
      read,
      correct,
      submit: vi.fn(),
      decide: vi.fn(),
      receipt: vi.fn(),
    };

    await act(async () => {
      root.render(
        createElement(CanonicalTimecardWorkspace, {
          timecardId: TIMECARD_ID,
          scope: requestScope,
          ownerBinding: ownerBinding(requestScope),
          dataSource,
          idFactory,
        })
      );
      await flush();
    });
    act(() => buttonByText(host, 'Record correction').click());
    const dialog = document.querySelector('[role="dialog"]');
    if (!(dialog instanceof HTMLElement)) throw new Error('Correction dialog did not open');
    act(() => setInputValue(inputByLabel('Minute adjustment'), '-45'));

    await act(async () => {
      buttonByText(dialog, 'Record correction').click();
      await flush();
    });
    expect(document.body.textContent).toContain('The timecard changed');
    expect(inputByLabel('Minute adjustment').value).toBe('-45');
    expect(buttonByText(dialog, 'Record correction').disabled).toBe(true);
    expect(idFactory).toHaveBeenCalledTimes(1);
    await act(async () => {
      buttonByText(dialog, 'Record correction').click();
      await flush();
    });
    expect(correct).toHaveBeenCalledTimes(1);
    expect(idFactory).toHaveBeenCalledTimes(1);

    await act(async () => {
      buttonByText(document, 'Refresh canonical timecard').click();
      await flush();
      await flush();
    });
    expect(read).toHaveBeenCalledTimes(2);
    expect(inputByLabel('Minute adjustment').value).toBe('-45');
    expect(document.querySelector('[role="dialog"]')).not.toBeNull();
    expect(document.body.textContent).toContain(
      'Refresh failed — showing the last verified timecard'
    );
    expect(document.body.textContent).toContain('all commands remain disabled');
    expect(buttonByText(dialog, 'Record correction').disabled).toBe(true);
    expect(host.textContent).toContain('Aggregate version7');

    await act(async () => {
      buttonByText(dialog, 'Retry canonical refresh').click();
      await flush();
      await flush();
    });
    expect(read).toHaveBeenCalledTimes(3);
    expect(inputByLabel('Minute adjustment').value).toBe('-45');
    expect(document.querySelector('[role="dialog"]')).not.toBeNull();
    expect(host.textContent).toContain('Aggregate version8');
    expect(buttonByText(dialog, 'Record correction').disabled).toBe(false);

    await act(async () => {
      buttonByText(dialog, 'Record correction').click();
      await flush();
    });
    expect(correct).toHaveBeenCalledTimes(2);
    expect(correct.mock.calls[1]?.[0].etag).toBe('"tim-v8-new-seal"');
    expect(correct.mock.calls[1]?.[2]).toBe(REFRESHED_IDEMPOTENCY_KEY);
    expect(idFactory).toHaveBeenCalledTimes(2);

    await act(async () => {
      buttonByText(host, 'Refresh').click();
      await flush();
      await flush();
    });
    expect(read).toHaveBeenCalledTimes(4);
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    expect(host.textContent).toContain('Timecard is not available');
    expect(host.textContent).not.toContain('Aggregate version8');
  });

  it('suppresses a late canonical response after the scope identity changes', async () => {
    let resolveA: ((value: TimecardSnapshot) => void) | undefined;
    let resolveB: ((value: TimecardSnapshot) => void) | undefined;
    const resultA = new Promise<TimecardSnapshot>((resolve) => {
      resolveA = resolve;
    });
    const resultB = new Promise<TimecardSnapshot>((resolve) => {
      resolveB = resolve;
    });
    const scopeA = scope('SELF');
    const scopeB = scope('SELF', {
      contextScopeKey: 'scope.tim-017-b',
      decisionRevision: 'decision-revision-43',
    });
    const read = vi.fn<TimecardDataSource['read']>((_id, currentScope) =>
      currentScope.contextScopeKey === scopeA.contextScopeKey ? resultA : resultB
    );
    const dataSource: TimecardDataSource = {
      read,
      correct: vi.fn(),
      submit: vi.fn(),
      decide: vi.fn(),
      receipt: vi.fn(),
    };

    await act(async () => {
      root.render(
        createElement(CanonicalTimecardWorkspace, {
          timecardId: TIMECARD_ID,
          scope: scopeA,
          ownerBinding: ownerBinding(scopeA),
          dataSource,
        })
      );
      await flush();
    });
    await act(async () => {
      root.render(
        createElement(CanonicalTimecardWorkspace, {
          timecardId: TIMECARD_ID,
          scope: scopeB,
          ownerBinding: ownerBinding(scopeB),
          dataSource,
        })
      );
      await flush();
    });

    await act(async () => {
      resolveB?.({
        timecard: parseTimecard(timecardSource('OPEN', { workerId: ACTOR_ID })),
        etag: '"scope-b-seal"',
      });
      await flush();
    });
    expect(host.textContent).toContain(ACTOR_ID);

    await act(async () => {
      resolveA?.(snapshot());
      await flush();
    });
    expect(host.textContent).toContain(ACTOR_ID);
    expect(host.textContent).not.toContain(WORKER_ID);
  });
});

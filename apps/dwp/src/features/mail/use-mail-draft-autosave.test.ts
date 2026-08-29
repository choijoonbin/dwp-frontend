// @vitest-environment jsdom

import { act, createElement, StrictMode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { createMailDraft, saveMailDraft } = vi.hoisted(() => ({
  createMailDraft: vi.fn(),
  saveMailDraft: vi.fn(),
}));

vi.mock('@dwp-frontend/shared-utils', () => ({
  createMailDraft,
  saveMailDraft,
  HttpError: class HttpError extends Error {
    constructor(
      message: string,
      public readonly status: number
    ) {
      super(message);
    }
  },
}));

import {
  mailDraftCanSend,
  mailDraftHasContent,
  mailDraftPayload,
  useMailDraftAutosave,
  type MailDraftFields,
} from './use-mail-draft-autosave';

import type { MailThreadDetail } from '@dwp-frontend/shared-utils';

type Autosave = ReturnType<typeof useMailDraftAutosave>;

function detail(threadId: string, version: number): MailThreadDetail {
  return {
    thread: {
      threadId,
      accountId: 'account-1',
      accountName: 'Mina Kim',
      folderType: 'DRAFTS',
      subject: 'Launch note',
      preview: 'Draft body',
      participants: [],
      latestMessageAt: '2026-08-29T00:00:00Z',
      unread: false,
      starred: false,
      importance: 'NORMAL',
      triageLane: 'PRIORITY',
      workflowState: 'DRAFT',
      attachments: false,
      externalSender: false,
      classification: 'INTERNAL',
      messageCount: 1,
      version,
    },
    messages: [],
    internalComments: [],
    proposals: [],
    sharedInboxMembers: [],
  };
}

let latest!: Autosave;

function Harness({
  fields,
  initialThreadId,
  initialVersion,
  initiallySaved,
}: {
  fields: MailDraftFields;
  initialThreadId?: string;
  initialVersion?: number;
  initiallySaved?: boolean;
}) {
  latest = useMailDraftAutosave({
    enabled: true,
    fields,
    initialThreadId,
    initialVersion,
    initiallySaved,
    delayMs: 1_750,
  });
  return null;
}

function strictHarness(props: Parameters<typeof Harness>[0]) {
  return createElement(StrictMode, null, createElement(Harness, props));
}

describe('mail draft autosave', () => {
  let host: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    vi.useFakeTimers();
    createMailDraft.mockReset();
    saveMailDraft.mockReset();
    host = document.createElement('div');
    document.body.append(host);
    root = createRoot(host);
  });

  afterEach(() => {
    act(() => root.unmount());
    document.body.replaceChildren();
    vi.useRealTimers();
  });

  it('keeps an asynchronously loaded existing draft clean until the user edits it', async () => {
    const initial = { toEmail: '', subject: 'Launch note', body: 'Draft body' };
    await act(async () =>
      root.render(
        strictHarness({
          fields: initial,
          initialThreadId: 'draft-1',
          initialVersion: 7,
          initiallySaved: true,
        })
      )
    );
    await act(async () => vi.advanceTimersByTimeAsync(2_000));
    expect(createMailDraft).not.toHaveBeenCalled();
    expect(saveMailDraft).not.toHaveBeenCalled();
    expect(latest.status).toBe('SAVED');

    saveMailDraft.mockResolvedValue(detail('draft-1', 8));
    await act(async () =>
      root.render(
        strictHarness({
          fields: { ...initial, body: 'Updated draft body' },
          initialThreadId: 'draft-1',
          initialVersion: 7,
          initiallySaved: true,
        })
      )
    );
    await act(async () => vi.advanceTimersByTimeAsync(1_750));
    expect(saveMailDraft).toHaveBeenCalledWith(
      'draft-1',
      expect.objectContaining({ body: 'Updated draft body', version: 7 })
    );
    expect(createMailDraft).not.toHaveBeenCalled();
    expect(latest.status).toBe('SAVED');
  });

  it('retries one uncertain create with the same idempotency key', async () => {
    const fields = { toEmail: '', subject: 'Subject-only draft', body: '' };
    createMailDraft
      .mockRejectedValueOnce(new Error('network'))
      .mockResolvedValueOnce(detail('draft-2', 1));
    await act(async () => root.render(strictHarness({ fields })));
    await act(async () => vi.advanceTimersByTimeAsync(1_750));
    expect(latest.status).toBe('ERROR');
    const firstInput = createMailDraft.mock.calls[0]?.[0];

    await act(async () => {
      await latest.saveNow();
    });
    expect(createMailDraft).toHaveBeenCalledTimes(2);
    expect(createMailDraft.mock.calls[1]?.[0].idempotencyKey).toBe(firstInput.idempotencyKey);
    expect(latest.identity).toEqual({ threadId: 'draft-2', version: 1 });
  });

  it('accepts partial draft content while retaining full send validation', () => {
    const subjectOnly = { toEmail: '', subject: 'Planning note', body: '' };
    expect(mailDraftPayload(subjectOnly)).toEqual({ subject: 'Planning note' });
    expect(mailDraftHasContent(subjectOnly)).toBe(true);
    expect(mailDraftCanSend(subjectOnly)).toBe(false);
    expect(
      mailDraftCanSend({
        toEmail: 'mina.kim@sk.com',
        subject: 'Planning note',
        body: 'Ready to send',
      })
    ).toBe(true);
  });
});

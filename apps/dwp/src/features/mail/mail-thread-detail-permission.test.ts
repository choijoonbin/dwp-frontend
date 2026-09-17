import { describe, expect, it } from 'vitest';

import { HttpError } from '@dwp-frontend/shared-utils';

import { mailThreadAccessRevoked, permitsSharedInboxAction } from './mail-thread-detail';

import type { MailThreadDetail } from '@dwp-frontend/shared-utils';

function detail(actions?: MailThreadDetail['sharedInboxActions']) {
  return {
    thread: { sharedInboxId: 'shared-1' },
    sharedInboxActions: actions,
  } as MailThreadDetail;
}

describe('mail shared inbox action projection', () => {
  it('fails closed when the server omits or denies an action', () => {
    expect(permitsSharedInboxAction(detail(undefined), 'ASSIGN')).toBe(false);
    expect(permitsSharedInboxAction(detail(['COMMENT']), 'ASSIGN')).toBe(false);
    expect(permitsSharedInboxAction(detail(['ASSIGN']), 'ASSIGN')).toBe(true);
  });

  it('recognizes authoritative access revocation responses', () => {
    expect(mailThreadAccessRevoked(new HttpError('Forbidden', 403))).toBe(true);
    expect(mailThreadAccessRevoked(new HttpError('Missing', 404))).toBe(true);
    expect(mailThreadAccessRevoked(new HttpError('Conflict', 409))).toBe(false);
  });
});

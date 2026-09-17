import { describe, expect, it } from 'vitest';

import { HttpError } from '@dwp-frontend/shared-utils';

import {
  mailThreadAccessRevoked,
  permitsSharedInboxAction,
  withoutMailSharedInboxActions,
} from './mail-thread-detail';

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

  it('removes denied actions and the projected sender identity from the cached detail', () => {
    const current = {
      ...detail(['REPLY', 'SEND_AS', 'COMMENT']),
      sharedInboxReplyIdentity: {
        displayName: 'People Help',
        emailAddress: 'people@example.com',
        senderMode: 'SEND_AS' as const,
      },
    };

    expect(withoutMailSharedInboxActions(current, ['REPLY', 'SEND_AS'])).toMatchObject({
      sharedInboxActions: ['COMMENT'],
      sharedInboxReplyIdentity: null,
    });
  });
});

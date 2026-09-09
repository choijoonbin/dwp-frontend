// @vitest-environment jsdom

import { afterEach, describe, expect, it } from 'vitest';

import {
  consumeActivitySourceReturnFocus,
  recordActivitySourceReturnFocus,
} from './activity-source-focus-handoff';

import type { WorkspaceActivityEvent } from '@dwp-frontend/shared-utils';

const event = {
  id: '90000000-0000-4000-8000-000000000001',
  occurredAt: '2026-09-08T01:00:00Z',
  actor: 'person',
  actorName: 'Mina Kim',
  state: 'completed',
  title: 'Personal work completed',
  objectType: 'WORK_ITEM',
  objectId: 'b1111111-1111-4111-8111-111111111111',
  objectLabel: 'Prepare the customer handover notes',
  source: 'PERSONAL_TASK',
  sourceAccess: 'AVAILABLE',
  sourceRoute: '/work/queue?work=PERSONAL_TASK%3Ab1111111-1111-4111-8111-111111111111%3A',
  auditId: null,
} satisfies WorkspaceActivityEvent;

afterEach(() => history.replaceState(null, '', '/'));

describe('Activity source return focus history', () => {
  it('consumes the exact event, Activity location, and canonical source route once', () => {
    history.replaceState({ idx: 4 }, '', `/activity/timeline?event=${event.id}`);
    recordActivitySourceReturnFocus(event);

    expect(consumeActivitySourceReturnFocus(event)).toBe(true);
    expect(consumeActivitySourceReturnFocus(event)).toBe(false);
    expect(history.state).toEqual({ idx: 4 });
  });

  it('consumes without restoring when the source route has changed or access was revoked', () => {
    history.replaceState(null, '', `/activity/timeline?event=${event.id}`);
    recordActivitySourceReturnFocus(event);

    expect(consumeActivitySourceReturnFocus({ ...event, sourceAccess: 'FORBIDDEN' })).toBe(false);
    expect(consumeActivitySourceReturnFocus(event)).toBe(false);
  });

  it('does not consume another Activity history entry', () => {
    history.replaceState(null, '', `/activity/timeline?event=${event.id}`);
    recordActivitySourceReturnFocus(event);
    history.replaceState(history.state, '', '/activity/home');

    expect(consumeActivitySourceReturnFocus(event)).toBe(false);
    history.replaceState(history.state, '', `/activity/timeline?event=${event.id}`);
    expect(consumeActivitySourceReturnFocus(event)).toBe(true);
  });
});

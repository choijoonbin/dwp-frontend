// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';

import { focusApprovalRequestIssue } from './approval-request-preflight-focus';

describe('approval request validation focus', () => {
  afterEach(() => document.body.replaceChildren());

  it('focuses the exact document field before a generic section', () => {
    const title = document.createElement('input');
    title.id = 'approval-request-title';
    document.body.append(title);

    expect(focusApprovalRequestIssue('$title')).toBe(true);
    expect(document.activeElement).toBe(title);
  });

  it('focuses an interactive control inside the exact typed path', () => {
    const owner = document.createElement('div');
    owner.dataset.approvalFieldPath = 'items[0].owner';
    const input = document.createElement('input');
    owner.append(input);
    document.body.append(owner);

    expect(focusApprovalRequestIssue('items[0].owner')).toBe(true);
    expect(document.activeElement).toBe(input);
  });

  it('does not move focus when a stale issue path is absent', () => {
    const current = document.createElement('button');
    document.body.append(current);
    current.focus();

    expect(focusApprovalRequestIssue('removedField')).toBe(false);
    expect(document.activeElement).toBe(current);
  });
});

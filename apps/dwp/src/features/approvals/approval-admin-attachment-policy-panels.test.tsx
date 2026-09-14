// @vitest-environment jsdom
import { act, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { fireEvent, getByLabelText, getByRole } from '@testing-library/dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApprovalAdminAttachmentPolicy } from './approval-admin-attachment-policy';
import { ApprovalAdminAttachmentPolicyReview } from './approval-admin-attachment-policy-review';
import type {
  ApprovalAttachmentPolicy,
  ApprovalAttachmentRules,
} from '@dwp-frontend/shared-utils/api/approval-attachment-policy-contract';

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
const rules: ApprovalAttachmentRules = {
  allowUpload: false,
  allowDownload: false,
  maxFileBytes: 10_485_760,
  maxFiles: 5,
  maxRequestBytes: 52_428_800,
  maxConcurrentUploads: 1,
  allowedMediaTypes: ['application/pdf'],
  grantTtlSeconds: 300,
  retentionDays: 365,
};
const policy: ApprovalAttachmentPolicy = {
  policyId: '11111111-1111-4111-8111-111111111111',
  resourceSetKey: 'RS_APPROVAL_FINANCE',
  version: 4,
  published: rules,
  pending: { ...rules, maxFiles: 6 },
  providerReadiness: 'NOT_CONFIGURED',
  publishedRevision: 1,
  pendingRevision: 2,
  pendingMakerUserId: 31,
  publishedRulesSha256: 'a'.repeat(64),
  pendingRulesSha256: 'b'.repeat(64),
  downloadReadiness: 'VERSIONING_VERIFIED',
  publishEligible: true,
  publishReason: 'ALLOWED',
};
let root: Root;
let container: HTMLDivElement;
async function settle(callback: () => void) {
  await act(async () => {
    callback();
    await new Promise((resolve) => setTimeout(resolve, 10));
  });
}
async function fill(input: HTMLInputElement | HTMLTextAreaElement, value: string) {
  await settle(() => {
    const prototype =
      input instanceof HTMLTextAreaElement
        ? HTMLTextAreaElement.prototype
        : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(prototype, 'value')!.set!.call(input, value);
    fireEvent.input(input, { bubbles: true });
  });
}
describe('attachment admin actual design-system editor and review', () => {
  beforeEach(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
  });
  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
  });
  it('compares actual current/proposed fields, revisions and complete source hashes without inferred provider readiness', async () => {
    await settle(() =>
      root.render(
        <ApprovalAdminAttachmentPolicy
          policy={policy}
          draft={null}
          draftPolicy={null}
          canEdit={false}
          canPublish={false}
          busy={false}
          refreshing={false}
          draftReady={false}
          draftLocked={false}
          onEdit={() => {}}
          onReview={() => {}}
          onRefresh={() => {}}
          onChange={() => {}}
          onSave={() => {}}
          onClose={() => {}}
        />
      )
    );
    expect(getByRole(container, 'table', { name: 'admin.attachmentPolicy.title' })).toBeDefined();
    expect(
      getByRole(container, 'columnheader', { name: 'admin.document.published 1' })
    ).toBeDefined();
    expect(
      getByRole(container, 'columnheader', { name: 'admin.document.pending 2' })
    ).toBeDefined();
    expect(container.textContent).toContain(policy.pendingRulesSha256);
    expect(container.textContent).toContain('NOT_CONFIGURED');
    expect(container.textContent).toContain('VERSIONING_VERIFIED');
    expect(container.textContent).toContain('admin.attachmentPolicy.readinessNotice');
    expect(
      getByRole<HTMLButtonElement>(container, 'button', { name: 'actions.publish' }).disabled
    ).toBe(true);
  });
  it('binary/allowlist/bounded integer controls validate actual schema before save and preserve input when source becomes readonly', async () => {
    const save = vi.fn();
    let ready = true;
    let currentRules = rules;
    function Editor() {
      const [value, setValue] = useState(rules);
      currentRules = value;
      return (
        <ApprovalAdminAttachmentPolicy
          policy={policy}
          draft={value}
          draftPolicy={policy}
          canEdit
          canPublish={false}
          busy={false}
          refreshing={false}
          draftReady={ready}
          draftLocked={false}
          onEdit={() => {}}
          onReview={() => {}}
          onRefresh={() => {}}
          onChange={setValue}
          onSave={save}
          onClose={() => {}}
        />
      );
    }
    const render = () => root.render(<Editor />);
    await settle(render);
    const dialog = getByRole(document.body, 'dialog', { name: 'admin.attachmentPolicy.edit' });
    const submit = getByRole<HTMLButtonElement>(dialog, 'button', { name: 'actions.save' });
    await settle(() =>
      fireEvent.click(getByLabelText(dialog, 'admin.attachmentPolicy.allowDownload'))
    );
    expect(currentRules.allowDownload).toBe(true);
    await settle(() => fireEvent.click(getByLabelText(dialog, 'application/pdf')));
    expect(submit.disabled).toBe(true);
    await settle(() => fireEvent.click(getByLabelText(dialog, 'text/plain')));
    expect(submit.disabled).toBe(false);
    const files = getByLabelText<HTMLInputElement>(dialog, 'admin.attachmentPolicy.maxFiles');
    await fill(files, '1.5');
    expect(submit.disabled).toBe(true);
    await fill(files, '10');
    expect(submit.disabled).toBe(false);
    ready = false;
    await settle(render);
    expect(files.value).toBe('10');
    expect(files.disabled).toBe(true);
    expect(submit.disabled).toBe(true);
    await settle(() => fireEvent.click(submit));
    expect(save).not.toHaveBeenCalled();
    expect(rules.allowDownload).toBe(false);
  });
  it('review preserves original comment/SHA on background source invalidation, disables publish and requires explicit new review', async () => {
    const submit = vi.fn();
    let ready = true;
    let original = policy;
    const render = () =>
      root.render(
        <ApprovalAdminAttachmentPolicyReview
          policy={original}
          ready={ready}
          busy={false}
          onClose={() => {}}
          onSubmit={submit}
        />
      );
    await settle(render);
    const dialog = getByRole(document.body, 'dialog', { name: 'admin.attachmentPolicy.review' });
    const comment = getByLabelText<HTMLTextAreaElement>(dialog, 'admin.document.reviewComment');
    await fill(comment, 'Independent source review');
    const publish = getByRole<HTMLButtonElement>(dialog, 'button', { name: 'actions.publish' });
    expect(publish.disabled).toBe(false);
    ready = false;
    await settle(render);
    expect(comment.value).toBe('Independent source review');
    expect(publish.disabled).toBe(true);
    expect(dialog.textContent).toContain(policy.pendingRulesSha256);
    await settle(() => fireEvent.click(publish));
    expect(submit).not.toHaveBeenCalled();
    original = { ...policy, pendingRulesSha256: 'c'.repeat(64) };
    ready = true;
    await settle(render);
    expect(comment.value).toBe('');
    expect(publish.disabled).toBe(true);
  });
});

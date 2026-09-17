import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { detail, fulfill, mailAddressBook, mockMailMember, thread } from './support/mail-fixtures';

for (const recovery of [
  'none',
  'response-loss',
  'rejected',
  'stale-group',
  'original-replay',
] as const) {
  test(`personal groups require recipient review and replay safely (${recovery})`, async ({
    page,
  }) => {
    await mockMailMember(page);
    const contacts: Array<Record<string, unknown>> = [];
    const groups: Array<Record<string, unknown>> = [];
    const sends: Array<Record<string, unknown>> = [];
    const contactId = '61000000-0000-0000-0000-000000000001';
    const groupId = '62000000-0000-0000-0000-000000000001';

    await page.route('**/api/platform/v1/mail/address-book**', (route) =>
      fulfill(route, mailAddressBook(contacts, groups))
    );
    await page.route('**/api/people/v1/people**', (route) =>
      fulfill(route, {
        items: [
          {
            personId: 'person-mina',
            personPublicId: 'person-mina',
            displayName: 'Mina Partner',
            workEmail: 'mina.partner@example.com',
            organizationName: 'Enterprise Sales',
            businessTitle: 'Account director',
            status: 'ACTIVE',
          },
        ],
        nextCursor: null,
        asOf: '2026-09-03',
      })
    );
    await page.route('**/api/platform/v1/mail/contacts', async (route) => {
      const input = (await route.request().postDataJSON()) as Record<string, unknown>;
      expect(input).toMatchObject({
        displayName: 'Mina Partner',
        emailAddress: 'mina.partner@example.com',
        sourceKind: 'MANUAL',
        sourcePersonPublicId: null,
      });
      const contact = {
        contactId,
        ...input,
        sourceKind: 'MANUAL',
        sourcePersonPublicId: null,
        version: 0,
        updatedAt: '2026-09-03T03:00:00Z',
      };
      contacts.splice(0, contacts.length, contact);
      return fulfill(route, contact);
    });
    await page.route('**/api/platform/v1/mail/contact-groups**', async (route) => {
      const request = route.request();
      const path = new URL(request.url()).pathname;
      if (request.method() === 'GET' && path.endsWith(`/${groupId}/messages/history`)) {
        return fulfill(route, []);
      }
      const input = ((await request.postDataJSON()) ?? {}) as Record<string, unknown>;
      if (request.method() === 'POST' && path.endsWith('/contact-groups')) {
        const group = {
          groupId,
          displayName: input.displayName,
          description: input.description,
          members: [],
          version: 0,
          updatedAt: '2026-09-03T03:00:00Z',
        };
        groups.splice(0, groups.length, group);
        return fulfill(route, group);
      }
      if (request.method() === 'PUT' && path.endsWith(`/${groupId}/members`)) {
        expect(input).toMatchObject({ contactIds: [contactId], version: 0 });
        const group = {
          ...groups[0],
          members: [
            {
              contactId,
              displayName: 'Mina Partner',
              emailAddress: 'mina.partner@example.com',
              organizationName: 'Enterprise Sales',
              sortOrder: 0,
            },
          ],
          version: 1,
          updatedAt: '2026-09-03T03:01:00Z',
        };
        groups.splice(0, groups.length, group, {
          ...group,
          groupId: '62000000-0000-0000-0000-000000000002',
          displayName: 'Other project',
          members: [
            ...group.members,
            {
              ...group.members[0],
              contactId: 'other-contact',
              displayName: 'Other recipient',
              emailAddress: 'other@example.com',
            },
          ],
        });
        return fulfill(route, group);
      }
      if (request.method() === 'POST' && path.endsWith(`/${groupId}/messages`)) {
        sends.push(input);
        if (recovery === 'response-loss' && sends.length === 1) return route.abort('failed');
        if (recovery === 'rejected' && sends.length === 1) {
          return route.fulfill({
            status: 422,
            contentType: 'application/json',
            body: JSON.stringify({ message: 'Review the message.' }),
          });
        }
        if (
          ((recovery === 'stale-group' || recovery === 'original-replay') && sends.length === 1) ||
          (recovery === 'original-replay' && sends.length === 2)
        ) {
          groups[0] = { ...groups[0], version: 2, members: groups[1].members };
          return route.fulfill({
            status: 409,
            contentType: 'application/json',
            body: JSON.stringify({
              status: 'ERROR',
              code: 'RESOURCE_CONFLICT',
              message: 'Review recipients.',
            }),
          });
        }
        const sentThread = detail(
          thread('63000000-0000-0000-0000-000000000001', {
            subject: String(input.subject),
          }),
          'SENT'
        );
        return fulfill(route, {
          thread: sentThread,
          receipt: {
            receiptId: '64000000-0000-0000-0000-000000000001',
            groupId,
            groupVersion: Number(input.groupVersion),
            recipientMode: input.recipientMode,
            recipientCount: 1,
            threadId: sentThread.thread.threadId,
            acceptedAt: '2026-09-03T03:03:00Z',
            state: 'ACCEPTED',
          },
        });
      }
      return route.fallback();
    });

    await page.goto('/mail/contacts');
    await expect(page.getByRole('heading', { name: 'Contacts and mail groups' })).toBeVisible();
    await page.getByRole('tab', { name: 'Company directory' }).click();
    await page.getByLabel('Search the company directory').fill('Mina');
    await expect(page.getByText('mina.partner@example.com')).toBeVisible();
    await page.getByRole('button', { name: 'Add to my contacts' }).click();
    const contactDialog = page.getByRole('dialog', { name: 'New contact' });
    await expect(contactDialog.getByLabel('Name')).toHaveValue('Mina Partner');
    await contactDialog.getByRole('button', { name: 'Save' }).click();
    await expect(page.getByText('Contact saved.')).toBeVisible();

    await page.getByRole('tab', { name: 'My mail groups' }).click();
    await page.getByRole('button', { name: 'Create mail group' }).click();
    const groupDialog = page.getByRole('dialog', { name: 'New mail group' });
    await groupDialog.getByLabel('Group name').fill('Launch steering');
    await groupDialog.getByLabel('Group description').fill('Weekly launch decision recipients');
    await groupDialog.getByRole('button', { name: 'Save' }).click();

    const membersDialog = page.getByRole('dialog', { name: 'Members of Launch steering' });
    await membersDialog.getByRole('checkbox').check();
    await membersDialog.getByRole('button', { name: 'Save members' }).click();
    await expect(page.getByText('1 member')).toBeVisible();

    await page.getByRole('button', { name: 'Send mail' }).first().click();
    const sendDialog = page.getByRole('dialog', { name: 'Send mail to Launch steering' });
    await sendDialog.getByLabel('Subject').fill('Launch review');
    await sendDialog
      .getByRole('textbox', { name: 'Message', exact: true })
      .fill('Please review the decision package.');
    await expect(
      sendDialog.getByRole('list', { name: 'Recipients of this group message' })
    ).toContainText('mina.partner@example.com');
    if (recovery === 'none') {
      await sendDialog.getByLabel('Recipient privacy').click();
      await page.getByRole('option', { name: 'Private recipients (Bcc)' }).click();
      await expect(sendDialog.getByText('Recipients stay private from one another')).toBeVisible();
      await expect(sendDialog.getByText(/placed in Bcc/u)).toBeVisible();
    } else {
      await expect(
        sendDialog.getByText('Recipient names and email addresses will be visible to everyone')
      ).toBeVisible();
      await expect(
        sendDialog.getByText(/places every group member in the To field/u)
      ).toBeVisible();
    }
    await expect(sendDialog.getByRole('button', { name: 'Send to group' })).toBeDisabled();
    await sendDialog
      .getByRole('checkbox', {
        name:
          recovery === 'none'
            ? 'I have reviewed every private recipient and the current group version.'
            : 'I understand the recipient list is public to this group and have reviewed every name and email address.',
      })
      .check();
    await sendDialog.getByRole('button', { name: 'Send to group' }).click();
    if (recovery === 'response-loss') {
      await expect(sendDialog.getByText(/The delivery result is not confirmed\./u)).toBeVisible();
      await expect(sendDialog.getByLabel('Subject')).toBeDisabled();
      await page.reload();
      await expect(page.getByRole('heading', { name: 'Contacts and mail groups' })).toBeVisible();
      await page.getByRole('tab', { name: 'My mail groups' }).click();
      await expect(page.getByRole('button', { name: 'Send mail' })).toHaveCount(2);
      await page.getByRole('button', { name: 'Send mail' }).last().click();
      const otherDialog = page.getByRole('dialog', { name: 'Send mail to Other project' });
      await expect(otherDialog).toBeVisible();
      await expect(otherDialog.getByLabel('Subject')).toHaveValue('');
      await otherDialog.getByRole('button', { name: 'Cancel' }).click();
      await page.getByRole('button', { name: 'Send mail' }).first().click();
      await expect(sendDialog.getByLabel('Subject')).toHaveValue('Launch review');
      await expect(
        sendDialog.getByRole('list', { name: 'Recipients of this group message' })
      ).toContainText('mina.partner@example.com');
      await sendDialog.getByRole('button', { name: 'Retry the same message' }).click();
    }
    if (recovery === 'rejected') {
      await expect(sendDialog.getByText(/The request was rejected/u)).toBeVisible();
      await expect(sendDialog.getByLabel('Subject')).toBeEnabled();
      await sendDialog
        .getByRole('textbox', { name: 'Message', exact: true })
        .fill('Please review the corrected decision package.');
      await sendDialog.getByRole('checkbox').check();
      await sendDialog.getByRole('button', { name: 'Send to group' }).click();
    }
    if (recovery === 'stale-group' || recovery === 'original-replay') {
      await sendDialog.getByRole('button', { name: 'Review latest recipients' }).click();
      await expect(
        sendDialog.getByRole('list', { name: 'Recipients of this group message' })
      ).toContainText('other@example.com');
      await expect(sendDialog.getByRole('button', { name: 'Send to group' })).toBeDisabled();
      await sendDialog.getByRole('checkbox').check();
      await sendDialog.getByRole('button', { name: 'Send to group' }).click();
      if (recovery === 'original-replay') {
        await expect(
          sendDialog.getByRole('button', { name: 'Check original request' })
        ).toBeEnabled();
        await sendDialog.getByRole('button', { name: 'Check original request' }).click();
      }
    }
    await expect(
      page.getByText('The group message was safely added to the delivery queue.')
    ).toBeVisible();
    await expect
      .poll(() => sends.length)
      .toBe(recovery === 'none' ? 1 : recovery === 'original-replay' ? 3 : 2);
    if (recovery === 'response-loss') expect(sends[1]).toEqual(sends[0]);
    if (recovery === 'rejected') {
      expect(sends[1]).toMatchObject({
        body: 'Please review the corrected decision package.',
        groupVersion: 1,
      });
      expect(sends[1]?.idempotencyKey).not.toBe(sends[0]?.idempotencyKey);
    }
    if (recovery === 'stale-group' || recovery === 'original-replay') {
      const { idempotencyKey: originalKey, ...originalPayload } = sends[0] ?? {};
      expect(sends[1]).toMatchObject({ ...originalPayload, groupVersion: 2 });
      expect(sends[1]?.idempotencyKey).toEqual(expect.any(String));
      expect(sends[1]?.idempotencyKey).not.toBe(originalKey);
      if (recovery === 'original-replay') expect(sends[2]).toEqual(sends[0]);
    }
    expect(sends[0]).toMatchObject({
      subject: 'Launch review',
      body: 'Please review the decision package.',
      classification: 'INTERNAL',
      recipientMode: recovery === 'none' ? 'BCC' : 'TO',
      groupVersion: 1,
    });
    expect(sends[0]?.idempotencyKey).toEqual(expect.any(String));

    const accessibility = await new AxeBuilder({ page }).include('main').analyze();
    expect(
      accessibility.violations.filter(
        (violation) => violation.impact === 'critical' || violation.impact === 'serious'
      )
    ).toEqual([]);
  });
}

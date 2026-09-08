import { expect, test } from '@playwright/test';
import { mockApprovedTemplatesAndPreferences } from './support/meeting-approved-frame-evidence-fixtures';
import ko from '../libs/shared-i18n/src/locales/ko/meetings.json' with { type: 'json' };

test('template import reviews only editable structure before making an explicit personal-template command', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 960 });
  await mockApprovedTemplatesAndPreferences(page, true);
  const commands: Record<string, unknown>[] = [];
  await page.route('**/api/meetings/v1/templates', async (route) => {
    if (route.request().method() !== 'POST') return route.fallback();
    const body = route.request().postDataJSON() as Record<string, unknown>;
    commands.push(body);
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        status: 'SUCCESS',
        success: true,
        message: 'OK',
        data: {
          ...body,
          templateId: '88100000-0000-4000-8000-000000000001',
          scope: 'PERSONAL',
          favorite: false,
          canEdit: true,
          version: 1,
          updatedAt: '2026-09-07T00:00:00Z',
        },
      }),
    });
  });
  await page.goto('/meetings/templates');
  await page.getByRole('button', { name: ko.stitch.templates.import, exact: true }).click();
  await page.getByRole('textbox', { name: ko.stitch.templates.importJson, exact: true }).fill(
    JSON.stringify({
      name: 'Imported decision workshop',
      purpose: 'Review risks and agree owners.',
      category: 'DECISION',
      durationMinutes: 30,
      agendaItems: [
        {
          title: 'Review risks',
          description: 'Discuss evidence',
          role: 'Facilitator',
          durationMinutes: 30,
        },
      ],
      scope: 'ORGANIZATION',
      canEdit: true,
      consent: true,
      participants: ['private-person'],
    })
  );
  await page.getByRole('button', { name: ko.stitch.templates.importReview, exact: true }).click();
  await expect(
    page.getByRole('textbox', { name: ko.templates.fields.name, exact: false })
  ).toHaveValue('Imported decision workshop');
  expect(commands).toHaveLength(0);
  await page.getByRole('button', { name: ko.templates.save, exact: true }).click();
  await expect.poll(() => commands.length).toBe(1);
  expect(commands[0]).toEqual({
    name: 'Imported decision workshop',
    purpose: 'Review risks and agree owners.',
    category: 'DECISION',
    durationMinutes: 30,
    agendaItems: [
      {
        title: 'Review risks',
        description: 'Discuss evidence',
        role: 'Facilitator',
        durationMinutes: 30,
      },
    ],
  });
});

test('template sharing copies only the same-origin selection URL without participant or consent data', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 960 });
  await mockApprovedTemplatesAndPreferences(page, true);
  await page.addInitScript(() =>
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: async (value: string) => {
          Reflect.set(window, '__meetingTemplateCopiedLink', value);
        },
      },
    })
  );
  await page.goto('/meetings/templates');
  await page.getByRole('button', { name: ko.stitch.templates.share, exact: true }).click();
  const copied = await page.evaluate(
    () => Reflect.get(window, '__meetingTemplateCopiedLink') as string
  );
  const url = new URL(copied);
  expect(url.origin).toBe(new URL(page.url()).origin);
  expect(url.pathname).toBe('/meetings/templates');
  expect([...url.searchParams.keys()].sort()).toEqual(['scope', 'template']);
  expect(url.searchParams.get('scope')).toBe('PERSONAL');
  expect(url.searchParams.get('template')).toMatch(/^[\da-f-]{36}$/u);
});

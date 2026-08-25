import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page, type Route } from '@playwright/test';

import { fulfillSuccess, mockShellSession } from './support/shell-session';

type ReaderState = {
  unread: boolean;
  saved: boolean;
  acknowledged: boolean;
  dismissed: boolean;
  openedAt: string | null;
  savedAt: string | null;
  acknowledgedAt: string | null;
};

const baseReaderState: ReaderState = {
  unread: true,
  saved: false,
  acknowledged: false,
  dismissed: false,
  openedAt: null,
  savedAt: null,
  acknowledgedAt: null,
};

const featuredStory = {
  communicationId: 101,
  title: 'The ideas reshaping how we work',
  summary: 'Three teams turned small experiments into measurable workplace improvements.',
  body: 'People closest to the work proposed each experiment.\n\nThe next lab opens this month.',
  severity: 'INFO',
  contentType: 'NEWS',
  categoryKey: 'INNOVATION',
  publisherName: 'Digital Workplace team',
  coverImageUrl: '/media/communications/innovation-lab.jpg',
  featured: true,
  pinned: false,
  acknowledgementRequired: false,
  acknowledgementDueAt: null,
  dismissible: true,
  readingMinutes: 4,
  sourceLocale: 'en',
  actionLabel: 'Explore the lab',
  actionUrl: '/communications/all',
  publishedAt: '2026-08-13T00:00:00Z',
  endsAt: '2026-09-30T00:00:00Z',
  reactions: { counts: { CELEBRATE: 2 }, viewerReaction: null, total: 2 },
};

const requiredStory = {
  communicationId: 102,
  title: 'Required: updated security principles',
  summary: 'Review the rules for devices, external collaboration, and governed AI.',
  body: 'The updated principles clarify how company information may be used.\n\nConfirm after review.',
  severity: 'WARNING',
  contentType: 'POLICY_UPDATE',
  categoryKey: 'SECURITY',
  publisherName: 'Information Security',
  coverImageUrl: '/media/communications/security-readiness.jpg',
  featured: false,
  pinned: true,
  acknowledgementRequired: true,
  acknowledgementDueAt: '2026-08-23T00:00:00Z',
  dismissible: false,
  readingMinutes: 3,
  sourceLocale: 'en',
  actionLabel: null,
  actionUrl: null,
  publishedAt: '2026-08-12T00:00:00Z',
  endsAt: '2026-09-30T00:00:00Z',
  reactions: { counts: {}, viewerReaction: null, total: 0 },
};

async function mockCommunications(page: Page) {
  const states = new Map<number, ReaderState>([
    [featuredStory.communicationId, { ...baseReaderState }],
    [requiredStory.communicationId, { ...baseReaderState }],
  ]);
  const events: string[] = [];
  const reactions = new Map([
    [featuredStory.communicationId, featuredStory.reactions],
    [requiredStory.communicationId, requiredStory.reactions],
  ]);

  await page.route('**/api/platform/v1/communications**', async (route: Route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;
    const idMatch = path.match(/\/communications\/(\d+)/u);
    const id = idMatch ? Number(idMatch[1]) : null;

    if (request.method() === 'POST' && path.includes('/events/')) {
      events.push(path.split('/').at(-1) ?? '');
      return fulfillSuccess(route, null);
    }
    if (id && request.method() === 'PUT' && path.endsWith('/reaction')) {
      const selected = (request.postDataJSON() as { reaction?: string | null }).reaction ?? null;
      const previous = reactions.get(id) ?? { counts: {}, viewerReaction: null, total: 0 };
      const counts = { ...previous.counts } as Record<string, number>;
      if (previous.viewerReaction) {
        counts[previous.viewerReaction] = Math.max(0, (counts[previous.viewerReaction] ?? 1) - 1);
      }
      if (selected) counts[selected] = (counts[selected] ?? 0) + 1;
      const next = {
        counts,
        viewerReaction: selected,
        total: Object.values(counts).reduce((sum, value) => sum + value, 0),
      };
      reactions.set(id, next);
      return fulfillSuccess(route, next);
    }
    if (id && request.method() === 'PUT' && path.endsWith('/reader-state')) {
      const patch = request.postDataJSON() as { saved?: boolean; dismissed?: boolean };
      const next = {
        ...(states.get(id) ?? baseReaderState),
        saved: patch.saved ?? states.get(id)?.saved ?? false,
        dismissed: patch.dismissed ?? states.get(id)?.dismissed ?? false,
        savedAt: patch.saved ? '2026-08-13T00:10:00Z' : null,
      };
      states.set(id, next);
      return fulfillSuccess(route, { communicationId: id, readerState: next });
    }
    if (id && request.method() === 'POST' && path.endsWith('/acknowledgement')) {
      const next = {
        ...(states.get(id) ?? baseReaderState),
        unread: false,
        acknowledged: true,
        openedAt: '2026-08-13T00:12:00Z',
        acknowledgedAt: '2026-08-13T00:12:00Z',
      };
      states.set(id, next);
      return fulfillSuccess(route, { communicationId: id, readerState: next });
    }
    if (id && request.method() === 'GET') {
      const story = id === featuredStory.communicationId ? featuredStory : requiredStory;
      return fulfillSuccess(route, {
        ...story,
        readerState: states.get(id),
        reactions: reactions.get(id),
      });
    }

    const scope = url.searchParams.get('scope') ?? 'for-you';
    const stories = [featuredStory, requiredStory]
      .map((story) => ({
        ...story,
        readerState: states.get(story.communicationId),
        reactions: reactions.get(story.communicationId),
      }))
      .filter((story) => !story.readerState?.dismissed)
      .filter((story) => scope !== 'required' || story.acknowledgementRequired)
      .filter((story) => scope !== 'saved' || story.readerState?.saved);
    return fulfillSuccess(route, {
      featured: stories[0] ?? null,
      items: stories.slice(1),
      summary: {
        total: 2,
        unread: [...states.values()].filter((state) => state.unread).length,
        required: states.get(requiredStory.communicationId)?.acknowledged ? 0 : 1,
        saved: [...states.values()].filter((state) => state.saved).length,
      },
      generatedAt: '2026-08-13T00:15:00Z',
    });
  });

  return events;
}

test('newsroom presents a responsive personalized editorial feed', async ({ page }, testInfo) => {
  await mockShellSession(page, ['WORKSPACE_MEMBER'], {
    displayName: 'Mina Kim',
    jobTitle: 'Network operations lead',
  });
  const events = await mockCommunications(page);

  await page.goto('/communications/for-you');

  await expect(page.getByRole('heading', { name: 'Know what is moving today' })).toBeVisible();
  await expect(page.getByRole('heading', { name: featuredStory.title })).toBeVisible();
  const actionRail = page.getByTestId('communications-action-rail');
  await expect(actionRail.getByText(requiredStory.title, { exact: true })).toBeVisible();
  await expect(page.getByText(requiredStory.title, { exact: true })).toHaveCount(1);
  await expect(page.getByTestId('communications-header')).toHaveAttribute(
    'data-dwp-shell',
    'communications'
  );
  const featuredImage = page.locator(`img[src="${featuredStory.coverImageUrl}"]`).first();
  await expect(featuredImage).toBeVisible();
  expect(
    await featuredImage.evaluate((image: HTMLImageElement) => image.naturalWidth)
  ).toBeGreaterThan(0);
  await page
    .locator('article')
    .first()
    .evaluate((article) => article.scrollIntoView({ block: 'center' }));

  if (testInfo.project.name === 'mobile') {
    await page.getByRole('button', { name: 'Open newsroom navigation' }).click();
    await expect(page.getByRole('link', { name: 'Required' })).toBeVisible();
    await page.keyboard.press('Escape');
  } else {
    await expect(page.getByTestId('communications-sidebar')).toHaveCSS('width', '248px');
  }

  const geometry = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    content: document.documentElement.scrollWidth,
  }));
  expect(geometry.content).toBeLessThanOrEqual(geometry.viewport);
  const accessibility = await new AxeBuilder({ page }).analyze();
  expect(accessibility.violations).toEqual([]);
  await expect.poll(() => events).toContain('impression');
});

test('action-first rail expands beyond four items without duplicate editorial links', async ({
  page,
}) => {
  await mockShellSession(page, ['WORKSPACE_MEMBER']);
  const criticalStories = Array.from({ length: 5 }, (_, index) => ({
    ...featuredStory,
    communicationId: 700 + index,
    title: `Critical newsroom action ${index + 1}`,
    severity: 'CRITICAL',
    featured: false,
    acknowledgementRequired: false,
    readerState: { ...baseReaderState },
  }));
  const editorialFeature = {
    ...featuredStory,
    communicationId: 799,
    readerState: { ...baseReaderState },
  };

  await page.route('**/api/platform/v1/communications**', (route) =>
    fulfillSuccess(route, {
      featured: editorialFeature,
      items: criticalStories,
      actionableItems: criticalStories,
      summary: {
        total: 6,
        unread: 6,
        required: 0,
        saved: 0,
        criticalUnread: 5,
        actionable: 5,
      },
      generatedAt: '2026-08-24T09:10:00Z',
    })
  );

  await page.goto('/communications/for-you');

  const actionRail = page.getByTestId('communications-action-rail');
  await expect(actionRail.getByText(criticalStories[0]!.title, { exact: true })).toBeVisible();
  await expect(actionRail.getByText(criticalStories[3]!.title, { exact: true })).toBeVisible();
  await expect(page.getByText(criticalStories[4]!.title, { exact: true })).toHaveCount(0);

  const showMore = actionRail.getByRole('button', { name: 'Show 1 more priority updates' });
  await expect(showMore).toHaveAttribute('aria-expanded', 'false');
  await showMore.click();
  await expect(actionRail.getByText(criticalStories[4]!.title, { exact: true })).toBeVisible();
  await expect(page.getByText(criticalStories[4]!.title, { exact: true })).toHaveCount(1);
  await expect(
    actionRail.getByRole('button', { name: 'Show fewer priority updates' })
  ).toHaveAttribute('aria-expanded', 'true');
});

test('required communication preserves acknowledgement evidence', async ({ page }) => {
  await mockShellSession(page, ['WORKSPACE_MEMBER']);
  const events = await mockCommunications(page);

  await page.goto(`/communications/required/${requiredStory.communicationId}`);

  await expect(page.getByRole('heading', { name: requiredStory.title })).toBeVisible();
  await expect(
    page.getByText('Your confirmation is retained as governed compliance evidence.')
  ).toBeVisible();
  await page.getByRole('button', { name: 'I have reviewed this update' }).click();
  await expect(page.getByRole('button', { name: 'Confirmed' })).toBeDisabled();
  const insightful = page.getByRole('button', { name: 'Insightful 0' });
  await insightful.click();
  await expect(page.getByRole('button', { name: 'Insightful 1' })).toHaveAttribute(
    'aria-pressed',
    'true'
  );
  expect(events).toContain('open');
});

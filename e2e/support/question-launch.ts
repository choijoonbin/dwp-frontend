import type { Page } from '@playwright/test';

type QuestionLaunchHarness = {
  seed: (question: string) => string;
};

export async function mockQuestionLaunches(page: Page): Promise<QuestionLaunchHarness> {
  const launches = new Map<string, string>();
  let sequence = 16;
  const seed = (question: string) => {
    const suffix = String(sequence).padStart(12, '0');
    sequence += 1;
    const launchId = `00000000-0000-4000-8000-${suffix}`;
    launches.set(launchId, question.trim());
    return launchId;
  };

  await page.route('**/api/agent/v1/question-launches/consume', (route) => {
    const request = route.request().postDataJSON() as { launchId?: string };
    const launchId = request.launchId ?? '';
    const question = launches.get(launchId);
    if (!question) {
      return route.fulfill({
        status: 404,
        contentType: 'application/json',
        body: JSON.stringify({ detail: 'Question launch is unavailable.' }),
      });
    }
    launches.delete(launchId);
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: { question } }),
    });
  });
  await page.route('**/api/agent/v1/question-launches', (route) => {
    const request = route.request().postDataJSON() as { question?: string };
    const launchId = seed(request.question ?? '');
    return route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: { launchId, expiresAt: new Date(Date.now() + 60_000).toISOString() },
      }),
    });
  });
  return { seed };
}

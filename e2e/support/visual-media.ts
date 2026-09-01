import type { Page } from '@playwright/test';

type VisualTransparencyPreference = 'no-preference' | 'reduce';

export async function emulateVisualTransparency(
  page: Page,
  preference: VisualTransparencyPreference = 'no-preference',
  features: ReadonlyArray<{ name: string; value: string }> = []
) {
  const browserName = page.context().browser()?.browserType().name();
  if (browserName === 'chromium') {
    const session = await page.context().newCDPSession(page);
    await session.send('Emulation.setEmulatedMedia', {
      media: '',
      features: [...features, { name: 'prefers-reduced-transparency', value: preference }],
    });
  }

  const reducedTransparency = await page.evaluate(
    () => window.matchMedia('(prefers-reduced-transparency: reduce)').matches
  );
  if (reducedTransparency !== (preference === 'reduce')) {
    throw new Error(
      `Unable to establish prefers-reduced-transparency: ${preference} on ${browserName ?? 'unknown browser'}`
    );
  }
}

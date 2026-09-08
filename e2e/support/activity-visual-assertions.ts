import { expect, type Page } from '@playwright/test';

/** Visual polish must not imply unsupported source-owned commands or unreported evidence. */
export async function expectNoInventedCommands(scope: Page | ReturnType<Page['getByRole']>) {
  for (const text of ['의견 제출', '서명 확인', '예외 승인 신청', '수동 동기화', 'BLAKE3']) {
    await expect(scope.getByText(text, { exact: false })).toHaveCount(0);
  }
}

export function screenshotOptions() {
  return {
    animations: 'disabled' as const,
    caret: 'hide' as const,
    maxDiffPixelRatio: 0.002,
    timeout: 15_000,
  };
}

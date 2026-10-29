// @vitest-environment jsdom

import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { fireEvent, getByRole, getByText, queryByRole } from '@testing-library/dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { copyNotificationSupportId, NotificationErrorState } from './notification-error-support';

const runtime = vi.hoisted(() => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock('@dwp-frontend/shared-utils/toast/toast-store', () => ({
  useToast: () => runtime.toast,
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, values?: Record<string, unknown>) =>
      ({
        'support.idLabel': `Support ID: ${String(values?.supportId ?? '')}`,
        'actions.copySupportId': 'Copy support ID',
        'feedback.supportIdCopied': 'Support ID copied.',
        'feedback.supportIdCopyFailed': 'Support ID copy failed.',
      })[key] ?? key,
  }),
}));

const containers: HTMLElement[] = [];

beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  runtime.toast.success.mockReset();
  runtime.toast.error.mockReset();
});

afterEach(() => {
  for (const container of containers.splice(0)) container.remove();
});

describe('Notification error support reference', () => {
  it('renders and copies only the bounded correlation header', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });
    const container = document.createElement('div');
    containers.push(container);
    document.body.append(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <NotificationErrorState
          error={{
            message: 'private user@example.com detail',
            headers: new Headers({ 'X-Correlation-ID': 'corr-safe-123' }),
          }}
          title="Could not load notifications"
          description="Try again."
        />
      );
    });

    getByText(container, 'Support ID: corr-safe-123');
    expect(container.textContent).not.toContain('private user@example.com detail');
    await act(async () => {
      fireEvent.click(getByRole(container, 'button', { name: 'Copy support ID' }));
      await Promise.resolve();
    });
    expect(writeText).toHaveBeenCalledWith('corr-safe-123');
    expect(runtime.toast.success).toHaveBeenCalledWith('Support ID copied.');

    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: undefined });
    await act(async () => {
      fireEvent.click(getByRole(container, 'button', { name: 'Copy support ID' }));
      await Promise.resolve();
    });
    expect(runtime.toast.error).toHaveBeenCalledWith('Support ID copy failed.');

    await act(async () => root.unmount());
  });

  it('hides unsafe references and reports clipboard unavailability without throwing', async () => {
    const container = document.createElement('div');
    containers.push(container);
    document.body.append(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <NotificationErrorState
          error={{ correlationId: 'unsafe\nidentifier', message: 'secret details' }}
          title="Could not load notifications"
        />
      );
    });
    expect(queryByRole(container, 'button', { name: 'Copy support ID' })).toBeNull();
    expect(container.textContent).not.toContain('secret details');
    await expect(copyNotificationSupportId('corr-safe-123', null)).resolves.toBe(false);

    await act(async () => root.unmount());
  });
});

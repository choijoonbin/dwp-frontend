import { describe, expect, it, vi } from 'vitest';

import {
  closeStepUpPopupWithFallback,
  resolveOidcCallbackDestination,
  STEP_UP_POPUP_CLOSE_GRACE_MS,
} from './oidc-callback';

describe('OIDC callback destination', () => {
  it('uses the normal login query return URL only for LOGIN callbacks', () => {
    expect(
      resolveOidcCallbackDestination(
        { purpose: 'LOGIN', response: { status: 'OK', message: '', data: {} } },
        '/approvals/home?scope=S1'
      )
    ).toBe('/approvals/home?scope=S1');
  });

  it('uses only the server-normalized header return path for STEP_UP callbacks', () => {
    expect(
      resolveOidcCallbackDestination(
        {
          purpose: 'STEP_UP',
          response: { status: 'OK', message: '', data: {} },
          flowId: '8f879f98-2476-4c33-a228-2984567ab889',
          returnTo: '/approvals/admin/workflows?scope=S2',
        },
        '/attacker-controlled'
      )
    ).toBe('/approvals/admin/workflows?scope=S2');
  });

  it('allows the popup close to settle before deciding whether navigation fallback is needed', () => {
    const closePopup = vi.fn();
    const navigateFallback = vi.fn();
    let scheduled: (() => void) | undefined;
    const schedule = vi.fn((callback: () => void) => {
      scheduled = callback;
    });

    closeStepUpPopupWithFallback({
      closePopup,
      isPopupClosed: () => true,
      schedule,
      navigateFallback,
    });

    expect(closePopup).toHaveBeenCalledOnce();
    expect(schedule).toHaveBeenCalledWith(expect.any(Function), STEP_UP_POPUP_CLOSE_GRACE_MS);
    expect(navigateFallback).not.toHaveBeenCalled();
    scheduled?.();
    expect(navigateFallback).not.toHaveBeenCalled();
  });

  it('uses the server-normalized destination only when the popup remains open', () => {
    const navigateFallback = vi.fn();
    let scheduled: (() => void) | undefined;

    closeStepUpPopupWithFallback({
      closePopup: vi.fn(),
      isPopupClosed: () => false,
      schedule: (callback) => {
        scheduled = callback;
      },
      navigateFallback,
    });

    expect(navigateFallback).not.toHaveBeenCalled();
    scheduled?.();
    expect(navigateFallback).toHaveBeenCalledOnce();
  });
});

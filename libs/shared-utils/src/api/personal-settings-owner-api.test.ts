import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  cancelPersonalPrivacyRequest,
  createPersonalPrivacyRequest,
  getPersonalPrivacyConsentLedger,
  getPersonalSettingsWorkspace,
  recordPersonalSettingView,
  updatePersonalSettingFavorite,
  updateProductAnalyticsConsent,
} from './personal-settings-owner-api';

const http = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn() }));
vi.mock('../axios-instance', () => ({ axiosInstance: http }));

beforeEach(() => vi.resetAllMocks());

describe('personal settings owner API', () => {
  it('uses the tenant/user-bound workspace and versioned favorite routes', async () => {
    const workspace = { favorites: [], recentActivity: [] };
    const favorite = { settingKey: 'security', favorite: true, version: 1 };
    http.get.mockResolvedValue({ data: { data: workspace } });
    http.put.mockResolvedValue({ data: { data: favorite } });

    await expect(getPersonalSettingsWorkspace()).resolves.toEqual(workspace);
    await expect(updatePersonalSettingFavorite('security', true, 0)).resolves.toEqual(favorite);
    expect(http.get).toHaveBeenCalledWith('/api/platform/v1/personal-settings/workspace');
    expect(http.put).toHaveBeenCalledWith('/api/platform/v1/personal-settings/favorites/security', {
      favorite: true,
      version: 0,
    });
  });

  it('records a settings view through the owner route', async () => {
    const activity = {
      activityId: 'a1',
      settingKey: 'profile',
      activityType: 'VIEW',
      changedFields: [],
      occurredAt: '2026-09-17T10:00:00',
    };
    http.post.mockResolvedValue({ data: { data: activity } });

    await expect(recordPersonalSettingView('profile')).resolves.toEqual(activity);
    expect(http.post).toHaveBeenCalledWith('/api/platform/v1/personal-settings/activity/view', {
      settingKey: 'profile',
    });
  });

  it('keeps consent and request intake separate from external fulfillment', async () => {
    const ledger = { currentProductAnalytics: null, history: [] };
    const consent = {
      consentId: 'c1',
      purposeKey: 'PRODUCT_ANALYTICS',
      consentState: 'GRANTED',
      noticeVersion: 'notice-1',
      source: 'ACCOUNT_SETTINGS',
      occurredAt: '2026-09-17T10:00:00',
    };
    const request = {
      requestId: 'r1',
      requestType: 'ACCOUNT_DELETION',
      requestState: 'RECEIVED',
      requestedScope: 'ALL_PERSONAL_DATA',
      fulfillmentAvailable: false,
      fulfillmentBoundary: 'PRIVACY_OWNER_EXECUTION_NOT_CONNECTED',
      version: 0,
      createdAt: '2026-09-17T10:00:00',
      updatedAt: '2026-09-17T10:00:00',
    };
    http.get.mockResolvedValue({ data: { data: ledger } });
    http.put.mockResolvedValue({ data: { data: consent } });
    http.post.mockResolvedValue({ data: { data: request } });
    http.patch.mockResolvedValue({
      data: { data: { ...request, requestState: 'CANCELLED', version: 1 } },
    });

    await expect(getPersonalPrivacyConsentLedger()).resolves.toEqual(ledger);
    await expect(updateProductAnalyticsConsent(true, 'notice-1')).resolves.toEqual(consent);
    await expect(createPersonalPrivacyRequest('ACCOUNT_DELETION', true)).resolves.toEqual(request);
    await cancelPersonalPrivacyRequest('r1', 0);

    expect(http.post).toHaveBeenCalledWith('/api/platform/v1/personal-settings/privacy/requests', {
      requestType: 'ACCOUNT_DELETION',
      requestedScope: 'ALL_PERSONAL_DATA',
      accountDeletionAcknowledged: true,
    });
    expect(request.fulfillmentAvailable).toBe(false);
    expect(http.patch).toHaveBeenCalledWith(
      '/api/platform/v1/personal-settings/privacy/requests/r1/cancel',
      { version: 0 }
    );
  });
});

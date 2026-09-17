import { afterEach, describe, expect, it, vi } from 'vitest';

import { axiosInstance } from '../axios-instance';
import {
  createMailOrganizationWritingAssetDraft,
  getMailOrganizationWritingAssets,
  transitionMailOrganizationWritingAsset,
} from './mail-admin-completion-api';
import { getMailWritingAssets } from './mail-user-completion-api';

describe('mail writing asset API boundaries', () => {
  afterEach(() => vi.restoreAllMocks());

  it('requests archived personal and published organization assets explicitly', async () => {
    const get = vi.spyOn(axiosInstance, 'get').mockResolvedValue({ data: { data: [] } });

    await getMailWritingAssets({ includeArchived: true });
    await getMailOrganizationWritingAssets({ kind: 'TEMPLATE', state: 'PUBLISHED' });

    expect(get).toHaveBeenNthCalledWith(
      1,
      '/api/platform/v1/mail/writing-assets?includeArchived=true'
    );
    expect(get).toHaveBeenNthCalledWith(
      2,
      '/api/platform/v1/admin/mail/writing-assets?kind=TEMPLATE&state=PUBLISHED'
    );
  });

  it('keeps elevated access, draft content, and optimistic version on governed mutations', async () => {
    const post = vi.spyOn(axiosInstance, 'post').mockResolvedValue({ data: { data: {} } });
    const input = {
      name: 'Customer notice',
      subject: 'Hello {{recipientName}}',
      body: 'Hello {{recipientName}}',
      bodyFormat: 'TEXT' as const,
      mandatoryContent: 'Required company notice',
      defaultForNew: false,
      defaultForReply: false,
      supersedesId: null,
      version: null,
    };
    const options = {
      activeAccessMode: 'ELEVATED' as const,
      idempotencyKey: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      correlationId: 'corr-assets',
    };

    await createMailOrganizationWritingAssetDraft('TEMPLATE', input, options);
    await transitionMailOrganizationWritingAsset(
      { assetId: 'asset/1', kind: 'TEMPLATE', version: 7 },
      'publish',
      options
    );

    expect(post).toHaveBeenNthCalledWith(
      1,
      '/api/platform/v1/admin/mail/writing-assets/TEMPLATE/drafts',
      input,
      {
        headers: {
          'X-DWP-Active-Access-Mode': 'ELEVATED',
          'Idempotency-Key': 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
          'X-Correlation-ID': 'corr-assets',
        },
      }
    );
    expect(post).toHaveBeenNthCalledWith(
      2,
      '/api/platform/v1/admin/mail/writing-assets/TEMPLATE/asset%2F1/publish',
      { version: 7 },
      {
        headers: {
          'X-DWP-Active-Access-Mode': 'ELEVATED',
          'Idempotency-Key': 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
          'X-Correlation-ID': 'corr-assets',
        },
      }
    );
  });
});

import { describe, expect, it, vi } from 'vitest';

import {
  mailWritingAssetCommandKey,
  mailWritingAssetDraftFingerprint,
  mailWritingAssetTransitionFingerprint,
} from './mail-writing-asset-command-key';

describe('mail writing asset idempotent commands', () => {
  it('reuses a command key for an exact retry and creates a new key after success cleanup', () => {
    const keys = new Map<string, string>();
    const createKey = vi.fn().mockReturnValueOnce('key-1').mockReturnValueOnce('key-2');
    const fingerprint = mailWritingAssetDraftFingerprint('new:TEMPLATE', { body: 'Notice' });

    expect(mailWritingAssetCommandKey(keys, fingerprint, createKey)).toBe('key-1');
    expect(mailWritingAssetCommandKey(keys, fingerprint, createKey)).toBe('key-1');
    expect(createKey).toHaveBeenCalledTimes(1);

    keys.delete(fingerprint);
    expect(mailWritingAssetCommandKey(keys, fingerprint, createKey)).toBe('key-2');
  });

  it('binds transition retries to the asset version and action', () => {
    expect(
      mailWritingAssetTransitionFingerprint({
        kind: 'TEMPLATE',
        assetId: 'asset-1',
        action: 'publish',
        version: 4,
      })
    ).toBe('transition:TEMPLATE:asset-1:publish:4');
  });
});

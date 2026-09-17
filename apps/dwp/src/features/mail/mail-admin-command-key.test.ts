import { describe, expect, it, vi } from 'vitest';

import { resolveMailAdminCommandKey } from './mail-admin-command-key';

describe('Mail admin command idempotency keys', () => {
  it('reuses the key for an unchanged failed command and rotates it after completion', () => {
    const keys = new Map<string, string>();
    const create = vi
      .fn()
      .mockReturnValueOnce('10000000-0000-4000-8000-000000000001')
      .mockReturnValueOnce('10000000-0000-4000-8000-000000000002');

    const first = resolveMailAdminCommandKey(keys, 'policy:{"version":1}', create);
    const retry = resolveMailAdminCommandKey(keys, 'policy:{"version":1}', create);
    expect(retry).toBe(first);
    expect(create).toHaveBeenCalledTimes(1);

    keys.delete('policy:{"version":1}');
    expect(resolveMailAdminCommandKey(keys, 'policy:{"version":1}', create)).not.toBe(first);
    expect(create).toHaveBeenCalledTimes(2);
  });
});

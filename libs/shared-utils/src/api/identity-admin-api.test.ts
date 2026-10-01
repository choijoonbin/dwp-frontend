import { beforeEach, describe, expect, it, vi } from 'vitest';

import { listIdentityUsers, type IdentityUserAccess } from './identity-admin-api';

const http = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock('../axios-instance', () => ({ axiosInstance: http }));

const user = (userId: number): IdentityUserAccess => ({
  userId,
  displayName: `User ${userId}`,
  status: 'ACTIVE',
  mfaEnabled: false,
  roles: [],
  roleManagement: { allowed: true, reason: 'ALLOWED' },
  accessRevision: 1,
  version: 1,
});

const page = (pageNumber: number, content: IdentityUserAccess[], totalElements = 3) => ({
  data: {
    data: {
      content,
      page: pageNumber,
      size: 100,
      totalElements,
      totalPages: 2,
    },
  },
});

beforeEach(() => vi.resetAllMocks());

describe('identity admin complete directory reader', () => {
  it('collects every server page before returning tenant-wide users', async () => {
    http.get
      .mockResolvedValueOnce(page(0, [user(1), user(2)]))
      .mockResolvedValueOnce(page(1, [user(3)]));

    await expect(listIdentityUsers('people')).resolves.toMatchObject({
      content: [{ userId: 1 }, { userId: 2 }, { userId: 3 }],
      totalElements: 3,
    });
    expect(http.get.mock.calls.map(([url]) => url)).toEqual([
      '/api/auth/admin/identity/users?page=0&size=100&query=people',
      '/api/auth/admin/identity/users?page=1&size=100&query=people',
    ]);
  });

  it('fails closed when pagination metadata changes while collecting pages', async () => {
    http.get
      .mockResolvedValueOnce(page(0, [user(1), user(2)]))
      .mockResolvedValueOnce(page(1, [user(3)], 4));

    await expect(listIdentityUsers()).rejects.toThrow('IDENTITY_DIRECTORY_PAGINATION_CHANGED');
  });

  it('fails closed when a principal appears on more than one page', async () => {
    http.get
      .mockResolvedValueOnce(page(0, [user(1), user(2)]))
      .mockResolvedValueOnce(page(1, [user(2)]));

    await expect(listIdentityUsers()).rejects.toThrow('IDENTITY_DIRECTORY_DUPLICATE_PRINCIPAL');
  });
});

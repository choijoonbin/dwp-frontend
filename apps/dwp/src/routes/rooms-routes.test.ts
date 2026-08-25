import { describe, expect, it } from 'vitest';

import { resolveLegacyRoomsPath } from './rooms-routes';

describe('legacy Rooms route resolver', () => {
  it('canonicalizes case-insensitive registered aliases without accepting unknown targets', () => {
    expect(resolveLegacyRoomsPath('/ROOMS')).toBe('/workplace/home');
    expect(resolveLegacyRoomsPath('/ROOMS/ADMIN/OVERVIEW')).toBe('/workplace/admin/overview');
    expect(resolveLegacyRoomsPath('/ROOMS/UNKNOWN')).toBeUndefined();
  });
});
